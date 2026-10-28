// Assembleur des répétitions du lot 4 (rôles et portées).
//
// Une preuve du lot se joue sur la vraie base dans un bloc do qui finit toujours par une levée : tout ce qu'elle fait
// est annulé. La migration y entre par execute, sous forme de littéral. Ce script fabrique le fichier à jouer à partir
// d'un gabarit (tests/sql/roles-*-preuve.sql) qui porte deux sortes de marqueurs, chacun seul sur sa ligne :
//   -- @@INJECTER <chemin>@@  remplacé par le texte du fichier, retours chariot retirés, en littéral dollar dont le
//                             délimiteur ne figure ni dans le gabarit ni dans aucun fichier assemblé ; le gabarit écrit
//                             « execute » avant le marqueur, et « ; » ou « into ...; » après ;
//   -- @@INCLURE <chemin>@@   remplacé par le texte du fichier, collé tel quel au niveau du script (aides communes).
// Les chemins partent de la racine du dépôt. Un mode peut neutraliser des injections : le marqueur devient le littéral
// 'select 1' et le fichier n'est pas lu (preuve jouée sans la migration : ROUGE attendu).
// Tout écart arrête l'assemblage sur un message clair (code de sortie 1) : fichier absent, marqueur inconnu ou mal
// formé, délimiteur du gabarit présent dans un fichier injecté (le littéral fermerait le bloc qui l'entoure).
//
// Usage : node outils/assembler_repetition_roles.mjs <mode> <sortie.sql>
// La sortie, jetable, s'écrit hors du dépôt ; elle se joue ensuite en une requête (MCP execute_sql).
// Tests : tests/assembler-roles.test.mjs.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Racine du dépôt : le dossier parent de outils/. */
export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const GABARIT_1 = "tests/sql/roles-1-preuve.sql";
const MIGRATION_1 = "supabase/migrations/20261028_roles_1_fondations.sql";
const RETOUR_1 = "supabase/migrations/20261028_roles_1_fondations_retour.sql";

/** Les modes : le gabarit à assembler et les injections à neutraliser (remplacées par 'select 1', sans lecture).
 *  Les répétitions des étapes 2 et 3 (repetition, contre-epreuve, en-ligne) viendront s'ajouter ici. */
export const MODES = {
  "etape-1": { gabarit: GABARIT_1, neutres: [] },
  "etape-1-sans": { gabarit: GABARIT_1, neutres: [MIGRATION_1, RETOUR_1] },
};

export const USAGE = `node outils/assembler_repetition_roles.mjs <mode> <sortie.sql>   (modes : ${Object.keys(MODES).join(", ")})`;

/** Ce qui remplace une injection neutralisée : un littéral inoffensif, que execute joue sans effet. */
export const NEUTRE = "'select 1'";

const LIGNE_MARQUEUR = /^(\s*)--\s*@@(.*)$/; // une ligne de commentaire qui commence par @@ : un marqueur
const FORME = /^(INJECTER|INCLURE) (\S+)@@\s*$/; // sa seule forme admise, une fois « -- @@ » retiré
const MOT_CLE = /@@(?:INJECTER|INCLURE)\b/; // un mot-clé de marqueur ailleurs dans une ligne : marqueur mal placé
const DELIMITEUR = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g; // délimiteurs dollar ($$, $tag$)

const sansRetourChariot = (texte) => texte.replace(/\r/g, "");

/** md5 hexadécimal d'un texte (UTF-8), celui que rend md5() en SQL. */
export const md5 = (texte) => createHash("md5").update(texte, "utf8").digest("hex");

/** Un chemin depuis la racine du dépôt : relatif, en barres obliques, sans segment vide, « . » ni « .. ». */
function cheminValide(chemin) {
  return /^[A-Za-z0-9_.\-/]+$/.test(chemin) && !isAbsolute(chemin)
    && chemin.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** Le délimiteur des littéraux : $injection$, ou $injection_1$, $injection_2$… s'il figure déjà dans le gabarit ou dans
 *  un fichier assemblé, ou si un texte injecté se terminait de façon à le former avec le délimiteur fermant. */
function choisirDelimiteur(textes, injectes) {
  for (let k = 0; ; k++) {
    const d = k === 0 ? "$injection$" : `$injection_${k}$`;
    if (textes.some((t) => t.includes(d))) continue;
    if (injectes.some((t) => (t + d).indexOf(d) !== t.length)) continue;
    return d;
  }
}

/**
 * Assemble un gabarit. Pure : aucune lecture de disque, `lire(chemin)` rend le texte d'un fichier (chemin depuis la
 * racine du dépôt) ou null s'il n'existe pas. `nom` désigne le gabarit dans les messages ; `neutres` liste les chemins
 * dont les injections deviennent le littéral 'select 1' (le fichier n'est pas lu).
 * Rend { texte, injections: [{ chemin, delimiteur, md5 }], inclusions: [{ chemin, md5 }], neutralises: [chemin] },
 * dans l'ordre du gabarit ; lève une Error au message clair sur tout écart.
 */
export function assembler(gabarit, lire, { nom = "gabarit", neutres = [] } = {}) {
  const modele = sansRetourChariot(gabarit);
  const lignes = modele.split("\n");

  // 1. Les marqueurs : seuls sur leur ligne, d'une forme connue, vers un chemin du dépôt.
  const marqueurs = new Map();
  lignes.forEach((ligne, i) => {
    const m = LIGNE_MARQUEUR.exec(ligne);
    if (!m) {
      if (MOT_CLE.test(ligne)) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur mal placé, il doit être seul sur sa ligne (-- @@INJECTER <chemin>@@).`);
      }
      return;
    }
    const forme = FORME.exec(m[2]);
    if (!forme) {
      const mot = /^\w*/.exec(m[2])[0];
      if (mot !== "INJECTER" && mot !== "INCLURE") {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur inconnu « @@${mot} » (connus : -- @@INJECTER <chemin>@@ et -- @@INCLURE <chemin>@@).`);
      }
      throw new Error(`${nom}, ligne ${i + 1} : marqueur mal formé « ${ligne.trim()} » (attendu : -- @@${mot} <chemin>@@, seul sur sa ligne).`);
    }
    const [, sorte, chemin] = forme;
    if (!cheminValide(chemin)) {
      throw new Error(`${nom}, ligne ${i + 1} : chemin « ${chemin} » refusé (relatif à la racine du dépôt, sans « . » ni « .. »).`);
    }
    marqueurs.set(i, { retrait: m[1], sorte, chemin });
  });
  const liste = [...marqueurs.values()];
  for (const chemin of neutres) {
    if (!liste.some((m) => m.sorte === "INJECTER" && m.chemin === chemin)) {
      throw new Error(`Mode mal décrit : ${chemin} est à neutraliser, mais ${nom} ne l'injecte nulle part.`);
    }
  }

  // 2. Les fichiers, lus une fois chacun, retours chariot retirés (les neutralisés ne sont pas lus).
  const textes = new Map();
  for (const m of liste) {
    if (textes.has(m.chemin) || (m.sorte === "INJECTER" && neutres.includes(m.chemin))) continue;
    const texte = lire(m.chemin);
    if (texte == null) throw new Error(`Fichier introuvable : ${m.chemin} (marqueur @@${m.sorte} de ${nom}).`);
    textes.set(m.chemin, sansRetourChariot(texte));
  }
  const injectes = liste.filter((m) => m.sorte === "INJECTER" && !neutres.includes(m.chemin));
  const inclus = liste.filter((m) => m.sorte === "INCLURE");

  // 3. Un fichier inclus est collé tel quel : un marqueur y resterait sans être traité.
  for (const m of inclus) {
    const ligne = textes.get(m.chemin).split("\n").findIndex((l) => LIGNE_MARQUEUR.test(l) || MOT_CLE.test(l));
    if (ligne >= 0) {
      throw new Error(`${m.chemin}, ligne ${ligne + 1} : marqueur dans un fichier inclus ; les marqueurs ne se traitent que dans le gabarit.`);
    }
  }

  // 4. Collisions : un délimiteur du gabarit présent dans un texte injecté fermerait le bloc qui entoure le littéral.
  const delimiteursGabarit = new Set(modele.match(DELIMITEUR) ?? []);
  for (const m of injectes) {
    for (const d of delimiteursGabarit) {
      if (textes.get(m.chemin).includes(d)) {
        throw new Error(`Collision de délimiteur : ${d} figure dans ${m.chemin} et dans ${nom} ; injecté, le texte fermerait le bloc qui l'entoure.`);
      }
    }
  }
  const delimiteur = choisirDelimiteur([modele, ...textes.values()], injectes.map((m) => textes.get(m.chemin)));

  // 5. L'assemblage, précédé d'un en-tête qui dit d'où il vient (md5 des textes, pour rapprocher un verdict d'un état
  //    du dépôt).
  const injections = [];
  const inclusions = [];
  const neutralises = [];
  const corps = lignes.map((ligne, i) => {
    const m = marqueurs.get(i);
    if (!m) return ligne;
    if (m.sorte === "INCLURE") {
      inclusions.push({ chemin: m.chemin, md5: md5(textes.get(m.chemin)) });
      return textes.get(m.chemin);
    }
    if (neutres.includes(m.chemin)) {
      neutralises.push(m.chemin);
      return m.retrait + NEUTRE;
    }
    const texte = textes.get(m.chemin);
    injections.push({ chemin: m.chemin, delimiteur, md5: md5(texte) });
    return m.retrait + delimiteur + texte + delimiteur;
  });
  const entete = [
    `-- Fichier assemblé par outils/assembler_repetition_roles.mjs depuis ${nom} : ne pas le modifier, le réassembler.`,
    ...inclusions.map((x) => `-- inclus : ${x.chemin} (md5 ${x.md5})`),
    ...injections.map((x) => `-- injecté : ${x.chemin} (md5 ${x.md5})`),
    ...neutralises.map((chemin) => `-- neutralisé : ${chemin} (remplacé par un select 1 sans effet)`),
  ];
  return { texte: [...entete, ...corps].join("\n"), injections, inclusions, neutralises };
}

/** Assemble le gabarit d'un mode, en lisant les fichiers sous `racine` (la racine du dépôt par défaut). */
export function assemblerMode(mode, racine = RACINE) {
  const decrit = MODES[mode];
  if (!decrit) throw new Error(`Mode inconnu « ${mode} » (modes : ${Object.keys(MODES).join(", ")}).`);
  const lire = (chemin) => {
    const fichier = resolve(racine, chemin);
    return existsSync(fichier) ? readFileSync(fichier, "utf8") : null;
  };
  const gabarit = lire(decrit.gabarit);
  if (gabarit == null) throw new Error(`Gabarit introuvable : ${decrit.gabarit}.`);
  return assembler(gabarit, lire, { nom: decrit.gabarit, neutres: decrit.neutres });
}

/** La ligne de commande : rend le code de sortie (0 si le fichier est écrit, 1 sinon). */
export function principal(argv, { racine = RACINE, journal = console.log, erreur = console.error } = {}) {
  if (argv.length !== 2) {
    erreur(`Usage : ${USAGE}`);
    return 1;
  }
  const [mode, sortie] = argv;
  try {
    const cible = resolve(sortie);
    const chemin = relative(racine, cible);
    if (chemin === "" || (!isAbsolute(chemin) && chemin !== ".." && !chemin.startsWith(`..${sep}`))) {
      throw new Error(`sortie dans le dépôt refusée (${sortie}) : le fichier assemblé est jetable, l'écrire hors du dépôt.`);
    }
    if (!existsSync(dirname(cible))) throw new Error(`dossier de sortie introuvable : ${dirname(cible)}.`);
    const r = assemblerMode(mode, racine);
    writeFileSync(cible, r.texte);
    journal(`${mode} : ${cible}`);
    for (const x of r.inclusions) journal(`  inclus      ${x.chemin}  md5 ${x.md5}`);
    for (const x of r.injections) journal(`  injecté     ${x.chemin}  md5 ${x.md5}`);
    for (const chemin of r.neutralises) journal(`  neutralisé  ${chemin}`);
    return 0;
  } catch (e) {
    erreur(`Assemblage refusé : ${e.message}`);
    return 1;
  }
}

const lance = process.argv[1] ? resolve(process.argv[1]) : "";
if (lance.toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  process.exitCode = principal(process.argv.slice(2));
}
