// Assembleur des répétitions du lot 4 (rôles et portées).
//
// Une preuve du lot se joue sur la vraie base dans un bloc do qui finit toujours par une levée : tout ce qu'elle fait
// est annulé. Les migrations y entrent sous forme de littéraux. Ce script fabrique le fichier à jouer à partir d'un
// gabarit (tests/sql/roles-*-preuve.sql) qui porte trois sortes de marqueurs, chacun seul sur sa ligne :
//   -- @@INJECTER <chemin>@@  remplacé par le texte du fichier, retours chariot retirés, en littéral dollar dont le
//                             délimiteur ne figure ni dans le gabarit ni dans aucun fichier assemblé ; le gabarit écrit
//                             avant le marqueur « execute » ou une affectation, et « ; » ou « into ...; » après ;
//   -- @@INCLURE <chemin>@@   remplacé par le texte du fichier, collé tel quel au niveau du script (aides communes) ;
//   -- @@MODE@@               remplacé par le libellé du mode en littéral simple (la preuve le dit dans son verdict).
// Les chemins partent de la racine du dépôt. Un mode peut neutraliser des injections : le marqueur devient le littéral
// 'select 1' et le fichier n'est pas lu (preuve jouée sans la migration : ROUGE attendu).
// Tout écart arrête l'assemblage sur un message clair (code de sortie 1) : fichier absent, marqueur inconnu ou mal
// formé, délimiteur du gabarit présent dans un fichier injecté (le littéral fermerait le bloc qui l'entoure).
//
// Modes :
//   etape-1, etape-1-sans      preuve de l'étape 1 (tests/sql/roles-1-preuve.sql), avec ou sans la migration ;
//   repetition [--etapes 1,2]  preuve rôle par rôle (tests/sql/roles-preuve.sql) : migrations des étapes demandées
//                              (1, 2, 3 par défaut), contrôles, retours dans l'ordre inverse ; les étapes non demandées
//                              sont neutralisées ; une étape demandée dont un fichier manque arrête l'assemblage ;
//   contre-epreuve             la même preuve avec la seule étape 1 : ROUGE attendu là où les étapes 2 et 3 changent
//                              quelque chose, VERT sur la non-régression ;
//   en-ligne                   la même preuve sans aucune migration, après leur application réelle.
//   espaces                    preuve du lot 5, étapes 1 à 3 (tests/sql/espaces-preuve.sql) : les migrations du siège
//                              (20261108_espaces_1_siege), de l'équipe (20261108_espaces_2_equipe) et de l'habillage
//                              (20261108_espaces_3_habillage) avec leurs retours, la
//                              fixture commune et la requête d'empreinte injectées ;
//   espaces-contre-epreuve     la même preuve sans aucune des deux migrations ni leurs retours (neutralisés, non lus) : ROUGE
//                              attendu sur comptes_reseau, creer_centre, demonstration et l'équipe ;
//   espaces-contre-epreuve-2   la même preuve avec la migration du siège seule : ROUGE attendu sur les seuls contrôles de
//                              l'équipe et de l'habillage (migrations 2 et 3 et leurs retours neutralisés) ;
//   espaces-contre-epreuve-3   la même preuve avec les migrations du siège et de l'équipe seules : ROUGE attendu sur les seuls
//                              contrôles de l'habillage (migration 3 et son retour neutralisés) ;
//   espaces-en-ligne           la même preuve sans aucune migration, après leur application réelle (la fixture, elle, reste
//                              injectée) ;
//   donnees                    preuve de la suite du lot 5 (tests/sql/espaces-donnees-preuve.sql) : la migration
//                              20261111_espaces_4_donnees et son retour injectés (après les migrations 1 à 3 du lot) ;
//   donnees-contre-epreuve     la même sans la migration ni son retour : ROUGE attendu sur ses seules lignes ;
//   donnees-en-ligne           la même sans rien d'injecté, après l'application réelle de la migration.
//   titres [--etapes 1,2]      preuve du chantier « titres et droits à la carte » (tests/sql/titres-preuve.sql) : les
//                              migrations 20261112_titres_1 à _4 puis, dans l'ordre inverse (4, 3, 2, 1), leurs retours ;
//                              une étape dont la migration ou le retour manque est neutralisée (select 1) tant que sa tâche
//                              n'est pas faite ; --etapes (1 à 1,2,3,4) fixe les étapes injectées, et une étape demandée
//                              dont un fichier manque arrête l'assemblage ;
//   titres-contre-epreuve      la même preuve sans aucune migration ni retour (neutralisés, non lus) : ROUGE attendu sur
//                              chaque contrôle du groupe titres ;
//   titres-en-ligne            la même sans rien d'injecté, après l'application réelle des migrations.
//
// Option --compact (tous les modes) : retire du gabarit et des aides les lignes vides et les lignes de commentaire, pour
// une requête plus courte à transmettre (R27). Les textes injectés (migrations, retours, requête d'empreinte) restent
// intacts, octet pour octet, comme l'en-tête qui porte les md5 des fichiers. Le gabarit ne doit donc contenir ni ligne
// vide ni ligne de commentaire dans un littéral de données (le retrait changerait ce littéral) : un test le garde.
// L'assembleur affiche la longueur et le md5 du texte produit ; la preuve rend ceux de la requête qu'elle a reçue
// (suffixe de la passerelle MCP retiré), ce qui montre que la base a reçu exactement ce fichier.
//
// Usage : node outils/assembler_repetition_roles.mjs <mode> [--etapes 1,2] [--compact] <sortie.sql>
// La sortie, jetable, s'écrit hors du dépôt ; elle se joue ensuite en une requête (MCP execute_sql).
// Tests : tests/assembler-roles.test.mjs.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Racine du dépôt : le dossier parent de outils/. */
export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const GABARIT_1 = "tests/sql/roles-1-preuve.sql";
const GABARIT_ROLES = "tests/sql/roles-preuve.sql";
const GABARIT_ESPACES = "tests/sql/espaces-preuve.sql";
const GABARIT_DONNEES = "tests/sql/espaces-donnees-preuve.sql";
const GABARIT_TITRES = "tests/sql/titres-preuve.sql";

/** Lot 5, étape 1 : la migration du siège et son retour. */
export const MIGRATION_ESPACES = { migration: "supabase/migrations/20261108_espaces_1_siege.sql",
                                   retour: "supabase/migrations/20261108_espaces_1_siege_retour.sql" };

/** Lot 5, étape 2 : la migration de l'équipe et son retour. */
export const MIGRATION_ESPACES_2 = { migration: "supabase/migrations/20261108_espaces_2_equipe.sql",
                                     retour: "supabase/migrations/20261108_espaces_2_equipe_retour.sql" };

/** Lot 5, étape 3 : la migration de l'habillage par défaut du centre et du réseau, et son retour. */
export const MIGRATION_ESPACES_3 = { migration: "supabase/migrations/20261108_espaces_3_habillage.sql",
                                     retour: "supabase/migrations/20261108_espaces_3_habillage_retour.sql" };

/** Lot 5, suite (étape 4) : l'ancien stagiaire invité au personnel et les données personnelles de la direction, avec le retour. */
export const MIGRATION_ESPACES_4 = { migration: "supabase/migrations/20261111_espaces_4_donnees.sql",
                                     retour: "supabase/migrations/20261111_espaces_4_donnees_retour.sql" };

/** Les trois étapes du lot : la migration et son retour. */
export const ETAPES = {
  1: { migration: "supabase/migrations/20261028_roles_1_fondations.sql",
       retour: "supabase/migrations/20261028_roles_1_fondations_retour.sql" },
  2: { migration: "supabase/migrations/20261028_roles_2_fonctions.sql",
       retour: "supabase/migrations/20261028_roles_2_fonctions_retour.sql" },
  3: { migration: "supabase/migrations/20261028_roles_3_regles.sql",
       retour: "supabase/migrations/20261028_roles_3_regles_retour.sql" },
};

/** Chantier titres et droits à la carte : les quatre migrations du chantier, chacune avec son retour. */
export const ETAPES_TITRES = {
  1: { migration: "supabase/migrations/20261112_titres_1_tables.sql",
       retour: "supabase/migrations/20261112_titres_1_tables_retour.sql" },
  2: { migration: "supabase/migrations/20261112_titres_2_gestes.sql",
       retour: "supabase/migrations/20261112_titres_2_gestes_retour.sql" },
  3: { migration: "supabase/migrations/20261112_titres_3_regles.sql",
       retour: "supabase/migrations/20261112_titres_3_regles_retour.sql" },
  4: { migration: "supabase/migrations/20261112_titres_4_journal.sql",
       retour: "supabase/migrations/20261112_titres_4_journal_retour.sql" },
};
const NB_ETAPES_TITRES = 4;
const TOUS_TITRES = Object.values(ETAPES_TITRES).flatMap((e) => [e.migration, e.retour]);

/** Les modes : le gabarit et, soit les injections à neutraliser (preuve de l'étape 1), soit les étapes à injecter
 *  (preuve rôle par rôle, les autres étapes étant neutralisées). */
export const MODES = {
  "etape-1": { gabarit: GABARIT_1, neutres: [] },
  "etape-1-sans": { gabarit: GABARIT_1, neutres: [ETAPES[1].migration, ETAPES[1].retour] },
  "repetition": { gabarit: GABARIT_ROLES, etapes: [1, 2, 3], etapesAuChoix: true },
  "contre-epreuve": { gabarit: GABARIT_ROLES, etapes: [1], libelle: "contre-epreuve (étape 1 seule)" },
  "en-ligne": { gabarit: GABARIT_ROLES, etapes: [], libelle: "en-ligne (aucune migration injectée)" },
  // Lot 5 : les migrations se neutralisent comme à l'étape 1 de la preuve du lot 4 ; le gabarit porte un marqueur de mode,
  // d'où un libellé (sans apostrophe : il s'écrit en littéral SQL).
  "espaces": { gabarit: GABARIT_ESPACES, neutres: [], libelle: "espaces (migrations siège, équipe et habillage injectées)" },
  "espaces-contre-epreuve": { gabarit: GABARIT_ESPACES,
                              neutres: [MIGRATION_ESPACES.migration, MIGRATION_ESPACES.retour, MIGRATION_ESPACES_2.migration, MIGRATION_ESPACES_2.retour,
                                        MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                              libelle: "espaces-contre-epreuve (aucune migration injectée)" },
  "espaces-contre-epreuve-2": { gabarit: GABARIT_ESPACES, neutres: [MIGRATION_ESPACES_2.migration, MIGRATION_ESPACES_2.retour, MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                                libelle: "espaces-contre-epreuve-2 (migrations équipe et habillage non injectées)" },
  "espaces-contre-epreuve-3": { gabarit: GABARIT_ESPACES, neutres: [MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                                libelle: "espaces-contre-epreuve-3 (migration habillage non injectée)" },
  // Lot 5, suite : preuve à part (tests/sql/espaces-donnees-preuve.sql), jouée après les migrations 1 à 3 du lot 5.
  "donnees": { gabarit: GABARIT_DONNEES, neutres: [], libelle: "donnees (migration 4 injectee)" },
  "donnees-contre-epreuve": { gabarit: GABARIT_DONNEES, neutres: [MIGRATION_ESPACES_4.migration, MIGRATION_ESPACES_4.retour],
                              libelle: "donnees-contre-epreuve (migration 4 non injectee)" },
  "donnees-en-ligne": { gabarit: GABARIT_DONNEES, neutres: [MIGRATION_ESPACES_4.migration, MIGRATION_ESPACES_4.retour],
                        libelle: "donnees-en-ligne (aucune migration injectee)" },
  // Chantier titres : preuve à part, jouée après la suite du lot 5. Le mode « titres » décide des étapes injectées selon les
  // fichiers présents (ou --etapes) ; les deux autres neutralisent tout.
  "titres": { gabarit: GABARIT_TITRES, titres: true, etapesAuChoix: true },
  "titres-contre-epreuve": { gabarit: GABARIT_TITRES, neutres: TOUS_TITRES, libelle: "titres-contre-epreuve (aucune migration injectee)" },
  "titres-en-ligne": { gabarit: GABARIT_TITRES, neutres: TOUS_TITRES, libelle: "titres-en-ligne (aucune migration injectee)" },
  "espaces-en-ligne": { gabarit: GABARIT_ESPACES,
                        neutres: [MIGRATION_ESPACES.migration, MIGRATION_ESPACES.retour, MIGRATION_ESPACES_2.migration, MIGRATION_ESPACES_2.retour,
                                  MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                        libelle: "espaces-en-ligne (aucune migration injectée)" },
};

export const USAGE = `node outils/assembler_repetition_roles.mjs <mode> [--etapes 1,2] [--compact] <sortie.sql>   (modes : ${Object.keys(MODES).join(", ")})`;

/** Ce qui remplace une injection neutralisée : un littéral inoffensif, que execute joue sans effet. */
export const NEUTRE = "'select 1'";

const LIGNE_MARQUEUR = /^(\s*)--\s*@@(.*)$/; // une ligne de commentaire qui commence par @@ : un marqueur
const FORME = /^(INJECTER|INCLURE) (\S+)@@\s*$/; // la forme admise d'une injection ou d'une inclusion
const FORME_MODE = /^MODE@@\s*$/; // la forme admise du marqueur de mode
const MOTS = ["INJECTER", "INCLURE", "MODE"];
const MOT_CLE = /@@(?:INJECTER|INCLURE|MODE)\b/; // un mot-clé de marqueur ailleurs dans une ligne : marqueur mal placé
const DELIMITEUR = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g; // délimiteurs dollar ($$, $tag$)
const LIBELLE = /^[\p{L}\p{N} ,()'.:_-]+$/u; // un libellé de mode : une ligne de texte simple, sans dollar
const VIDE_OU_COMMENTAIRE = /^\s*(?:--.*)?$/; // une ligne vide, ou qui ne porte qu'un commentaire (--)

const sansRetourChariot = (texte) => texte.replace(/\r/g, "");

/** md5 hexadécimal d'un texte (UTF-8), celui que rend md5() en SQL. */
export const md5 = (texte) => createHash("md5").update(texte, "utf8").digest("hex");

/** Les lignes d'un texte, sans les lignes vides ni les lignes de commentaire : le compactage d'un gabarit ou d'aides. */
export const sansVidesNiCommentaires = (texte) => texte.split("\n").filter((ligne) => !VIDE_OU_COMMENTAIRE.test(ligne));

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

/** Les fichiers des étapes données, étape par étape : la migration, puis son retour. */
export function lireEtapes(etapes) {
  return etapes.flatMap((n) => [ETAPES[n].migration, ETAPES[n].retour]);
}

/** Les étapes admises : chacune s'appuie sur la précédente (1 ; 1, 2 ; 1, 2, 3 ; au plus `max`). */
function etapesValides(etapes, max = 3) {
  return Array.isArray(etapes) && etapes.length >= 1 && etapes.length <= max && etapes.every((n, i) => n === i + 1);
}

/** Les fichiers des étapes du chantier titres, étape par étape : la migration, puis son retour. */
export function lireEtapesTitres(etapes) {
  return etapes.flatMap((n) => [ETAPES_TITRES[n].migration, ETAPES_TITRES[n].retour]);
}

/**
 * Ce qu'un mode assemble : { gabarit, neutres, etapes, mode, requis }. `mode` est le libellé écrit à la place du
 * marqueur de mode (nul pour les modes de l'étape 1), `requis` les fichiers qui doivent exister. Lève une Error au
 * message clair pour un mode inconnu ou des étapes refusées.
 */
export function decrireMode(mode, { etapes } = {}) {
  const d = MODES[mode];
  if (!d) throw new Error(`Mode inconnu « ${mode} » (modes : ${Object.keys(MODES).join(", ")}).`);
  if (etapes !== undefined && !d.etapesAuChoix) {
    throw new Error(`--etapes ne vaut que pour le mode repetition ou titres (mode demandé : ${mode}).`);
  }
  if (d.titres) {
    if (etapes !== undefined && !etapesValides(etapes, NB_ETAPES_TITRES)) {
      throw new Error(`étapes refusées : « ${etapes.join(",")} » (attendu : 1, 1,2, 1,2,3 ou 1,2,3,4 ; chaque étape s'appuie sur la précédente).`);
    }
    // Les fichiers présents se jugent sur le disque, dans assemblerMode : ici, seulement ce que l'appelant a demandé.
    return { gabarit: d.gabarit, titres: true, etapesTitres: etapes ?? null, neutres: [], etapes: null, mode: null, requis: [] };
  }
  if (!d.etapes) return { gabarit: d.gabarit, neutres: d.neutres, etapes: null, mode: d.libelle ?? null, requis: [] };
  const choisies = etapes ?? d.etapes;
  if (etapes !== undefined && !etapesValides(choisies)) {
    throw new Error(`étapes refusées : « ${choisies.join(",")} » (attendu : 1, 1,2 ou 1,2,3 ; chaque étape s'appuie sur la précédente).`);
  }
  const absentes = [1, 2, 3].filter((n) => !choisies.includes(n));
  const libelle = d.libelle ?? `${mode} (${choisies.length === 1 ? "étape" : "étapes"} ${choisies.join(", ")})`;
  return { gabarit: d.gabarit, neutres: lireEtapes(absentes), etapes: choisies, mode: libelle, requis: lireEtapes(choisies) };
}

/**
 * Assemble un gabarit. Pure : aucune lecture de disque, `lire(chemin)` rend le texte d'un fichier (chemin depuis la
 * racine du dépôt) ou null s'il n'existe pas. `nom` désigne le gabarit dans les messages ; `neutres` liste les chemins
 * dont les injections deviennent le littéral 'select 1' (le fichier n'est pas lu) ; `mode` est le libellé écrit à la
 * place du marqueur de mode (obligatoire si le gabarit en porte un, interdit sinon) ; `compact` retire du gabarit et des
 * fichiers inclus les lignes vides et les lignes de commentaire (les marqueurs, eux, sont traités d'abord ; les textes
 * injectés restent intacts, l'en-tête aussi, avec une ligne de plus qui dit le compactage).
 * Rend { texte, injections: [{ chemin, delimiteur, md5 }], inclusions: [{ chemin, md5 }], neutralises: [chemin], mode,
 * compact, longueur (caractères), octets (UTF-8), md5 (du texte produit) }, dans l'ordre du gabarit ; lève une Error au
 * message clair sur tout écart.
 */
export function assembler(gabarit, lire, { nom = "gabarit", neutres = [], mode = null, compact = false } = {}) {
  const modele = sansRetourChariot(gabarit);
  const lignes = modele.split("\n");

  // 1. Les marqueurs : seuls sur leur ligne, d'une forme connue, vers un chemin du dépôt.
  const marqueurs = new Map();
  let ligneMode = null;
  lignes.forEach((ligne, i) => {
    const m = LIGNE_MARQUEUR.exec(ligne);
    if (!m) {
      if (MOT_CLE.test(ligne)) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur mal placé, il doit être seul sur sa ligne (-- @@INJECTER <chemin>@@).`);
      }
      return;
    }
    if (FORME_MODE.test(m[2])) {
      if (ligneMode !== null) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur de mode en double (déjà ligne ${ligneMode + 1}).`);
      }
      ligneMode = i;
      marqueurs.set(i, { retrait: m[1], sorte: "MODE" });
      return;
    }
    const forme = FORME.exec(m[2]);
    if (!forme) {
      const mot = /^\w*/.exec(m[2])[0];
      if (!MOTS.includes(mot)) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur inconnu « @@${mot} » (connus : -- @@INJECTER <chemin>@@, -- @@INCLURE <chemin>@@ et -- @@MODE@@).`);
      }
      const attendu = mot === "MODE" ? "-- @@MODE@@" : `-- @@${mot} <chemin>@@`;
      throw new Error(`${nom}, ligne ${i + 1} : marqueur mal formé « ${ligne.trim()} » (attendu : ${attendu}, seul sur sa ligne).`);
    }
    const [, sorte, chemin] = forme;
    if (!cheminValide(chemin)) {
      throw new Error(`${nom}, ligne ${i + 1} : chemin « ${chemin} » refusé (relatif à la racine du dépôt, sans « . » ni « .. »).`);
    }
    marqueurs.set(i, { retrait: m[1], sorte, chemin });
  });
  if (ligneMode !== null && mode == null) {
    throw new Error(`${nom}, ligne ${ligneMode + 1} : marqueur de mode, mais aucun mode donné (le libellé du mode s'écrit à sa place).`);
  }
  if (mode != null && ligneMode === null) {
    throw new Error(`Mode mal décrit : ${nom} n'a pas de marqueur -- @@MODE@@ ; le mode « ${mode} » n'aurait nulle part où s'écrire.`);
  }
  if (mode != null && !LIBELLE.test(mode)) {
    throw new Error(`libellé de mode refusé « ${mode} » : une ligne de lettres, chiffres, espaces et ponctuation simple, sans dollar.`);
  }
  const liste = [...marqueurs.values()].filter((m) => m.sorte !== "MODE");
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
  const corps = [];
  lignes.forEach((ligne, i) => {
    const m = marqueurs.get(i);
    if (!m) {
      if (!compact || !VIDE_OU_COMMENTAIRE.test(ligne)) corps.push(ligne);
      return;
    }
    if (m.sorte === "MODE") {
      corps.push(`${m.retrait}'${mode.replace(/'/g, "''")}'`);
    } else if (m.sorte === "INCLURE") {
      inclusions.push({ chemin: m.chemin, md5: md5(textes.get(m.chemin)) });
      if (!compact) {
        corps.push(textes.get(m.chemin));
      } else {
        const gardees = sansVidesNiCommentaires(textes.get(m.chemin));
        if (gardees.length > 0) corps.push(gardees.join("\n"));
      }
    } else if (neutres.includes(m.chemin)) {
      neutralises.push(m.chemin);
      corps.push(m.retrait + NEUTRE);
    } else {
      const texte = textes.get(m.chemin);
      injections.push({ chemin: m.chemin, delimiteur, md5: md5(texte) });
      corps.push(m.retrait + delimiteur + texte + delimiteur);
    }
  });
  const entete = [
    `-- Fichier assemblé par outils/assembler_repetition_roles.mjs depuis ${nom} : ne pas le modifier, le réassembler.`,
    ...(mode != null ? [`-- mode : ${mode}`] : []),
    ...(compact ? ["-- compact : lignes vides et de commentaire du gabarit et des aides retirées, textes injectés intacts"] : []),
    ...inclusions.map((x) => `-- inclus : ${x.chemin} (md5 ${x.md5})`),
    ...injections.map((x) => `-- injecté : ${x.chemin} (md5 ${x.md5})`),
    ...neutralises.map((chemin) => `-- neutralisé : ${chemin} (remplacé par un select 1 sans effet)`),
  ];
  const texte = [...entete, ...corps].join("\n");
  return {
    texte, injections, inclusions, neutralises, mode, compact,
    longueur: Array.from(texte).length, // en caractères (points de code), comme length() en SQL
    octets: Buffer.byteLength(texte, "utf8"), md5: md5(texte),
  };
}

/**
 * Assemble le gabarit d'un mode, en lisant les fichiers sous `racine` (la racine du dépôt par défaut), ou par
 * `lire(chemin)` s'il est donné (tests). `etapes` : les étapes du mode repetition (1, 2, 3 par défaut). Une étape
 * demandée dont la migration ou le retour manque arrête l'assemblage, en disant quoi jouer en attendant. `compact` :
 * voir assembler().
 */
export function assemblerMode(mode, racine = RACINE, { etapes, lire, compact = false } = {}) {
  const decrit = decrireMode(mode, { etapes });
  const lireFichier = lire ?? ((chemin) => {
    const fichier = resolve(racine, chemin);
    return existsSync(fichier) ? readFileSync(fichier, "utf8") : null;
  });
  for (const n of decrit.etapes ?? []) {
    for (const chemin of lireEtapes([n])) {
      if (lireFichier(chemin) == null) {
        const pretes = [1, 2, 3].filter((k) => k < n);
        throw new Error(`Étape ${n} demandée (${mode}) : ${chemin} n'existe pas encore. En attendant : mode contre-epreuve, ou repetition --etapes ${pretes.join(",")}.`);
      }
    }
  }
  let { neutres, mode: libelle } = decrit;
  if (decrit.titres) {
    // Étapes injectées : celles qu'on a demandées (un fichier manquant arrête alors l'assemblage), sinon celles dont la
    // migration et le retour existent déjà ; les autres sont neutralisées, sans être lues.
    const injectees = [];
    for (let n = 1; n <= NB_ETAPES_TITRES; n++) {
      const fichiers = lireEtapesTitres([n]);
      if (decrit.etapesTitres) {
        if (!decrit.etapesTitres.includes(n)) continue;
        for (const chemin of fichiers) {
          if (lireFichier(chemin) == null) {
            const pretes = [1, 2, 3, 4].filter((k) => k < n);
            throw new Error(`Étape ${n} demandée (${mode}) : ${chemin} n'existe pas encore. En attendant : mode titres-contre-epreuve, ou titres${pretes.length ? ` --etapes ${pretes.join(",")}` : ""}.`);
          }
        }
        injectees.push(n);
      } else if (fichiers.every((chemin) => lireFichier(chemin) != null)) {
        injectees.push(n);
      }
    }
    neutres = lireEtapesTitres([1, 2, 3, 4].filter((n) => !injectees.includes(n)));
    libelle = injectees.length === 0 ? "titres (aucune etape injectee)"
      : `titres (${injectees.length === 1 ? "etape" : "etapes"} ${injectees.join(", ")} injectees)`;
  }
  const gabarit = lireFichier(decrit.gabarit);
  if (gabarit == null) throw new Error(`Gabarit introuvable : ${decrit.gabarit}.`);
  return assembler(gabarit, lireFichier, { nom: decrit.gabarit, neutres, mode: libelle, compact });
}

/** Une liste d'étapes écrite en ligne de commande (« 1,2 ») ; la validité se juge dans decrireMode. */
function lireListeEtapes(texte) {
  if (!/^\d+(,\d+)*$/.test(texte ?? "")) {
    throw new Error(`étapes refusées : « ${texte ?? ""} » (attendu : 1, 1,2 ou 1,2,3 ; chaque étape s'appuie sur la précédente).`);
  }
  return texte.split(",").map(Number);
}

/** La ligne de commande : rend le code de sortie (0 si le fichier est écrit, 1 sinon). */
export function principal(argv, { racine = RACINE, journal = console.log, erreur = console.error } = {}) {
  const positionnels = [];
  let etapesTexte;
  let compact = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--etapes") {
      if (i + 1 >= argv.length) {
        erreur(`Usage : ${USAGE}`);
        return 1;
      }
      etapesTexte = argv[++i];
    } else if (a.startsWith("--etapes=")) {
      etapesTexte = a.slice("--etapes=".length);
    } else if (a === "--compact") {
      compact = true;
    } else {
      positionnels.push(a);
    }
  }
  if (positionnels.length !== 2 || positionnels.some((a) => a.startsWith("--"))) {
    erreur(`Usage : ${USAGE}`);
    return 1;
  }
  const [mode, sortie] = positionnels;
  try {
    const etapes = etapesTexte === undefined ? undefined : lireListeEtapes(etapesTexte);
    const cible = resolve(sortie);
    const chemin = relative(racine, cible);
    if (chemin === "" || (!isAbsolute(chemin) && chemin !== ".." && !chemin.startsWith(`..${sep}`))) {
      throw new Error(`sortie dans le dépôt refusée (${sortie}) : le fichier assemblé est jetable, l'écrire hors du dépôt.`);
    }
    if (!existsSync(dirname(cible))) throw new Error(`dossier de sortie introuvable : ${dirname(cible)}.`);
    const r = assemblerMode(mode, racine, { etapes, compact });
    writeFileSync(cible, r.texte);
    journal(`${mode} : ${cible}`);
    if (r.mode != null) journal(`  mode        ${r.mode}`);
    for (const x of r.inclusions) journal(`  inclus      ${x.chemin}  md5 ${x.md5}`);
    for (const x of r.injections) journal(`  injecté     ${x.chemin}  md5 ${x.md5}`);
    for (const chemin of r.neutralises) journal(`  neutralisé  ${chemin}`);
    // La taille et l'empreinte du texte produit : celles que la preuve doit rendre pour la requête qu'elle a reçue (la
    // passerelle MCP y ajoute un suffixe, que la preuve retire avant de hacher).
    if (compact) {
      const complet = assemblerMode(mode, racine, { etapes });
      journal(`  compact     ${r.longueur} caractères au lieu de ${complet.longueur} (lignes vides et de commentaire du gabarit et des aides retirées)`);
    }
    journal(`  texte       ${r.longueur} caractères, ${r.octets} octets, md5 ${r.md5}`);
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
