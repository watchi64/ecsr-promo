import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  lireRegles, couleursLitterales, estNeutre, contientCouleur, sansCommentaires, sansUrlNiChaines,
} from "./aides-css.mjs";
import { PREFIXES_HABILLAGE, FAMILLES_FIXES, familleDe, correspond } from "../js/habillage-familles.js";

// Lot 3 (habillage « Couleurs ECF ») : garde des couleurs écrites en dur. Un habillage n'est possible que si toute
// couleur de l'interface passe par une variable CSS que l'habillage peut redéfinir d'un bloc. Ce test le garantit,
// à cliquet : le nombre d'écarts de chaque fichier est figé dans DETTE, il ne peut que baisser, et il doit atteindre
// zéro à la fin de la tâche 5 (DETTE vide). Les écarts sont ceux de quatre règles :
//   1. CSS : une couleur non neutre n'apparaît que comme valeur d'une variable (--nom: ...) ou sous @media print.
//   2. CSS : une variable dont la valeur contient une couleur ne se déclare que dans :root (css/style.css), dans le
//      bloc ECF (css/habillage-ecf.css) ou sur une racine de document (RACINES_DOCUMENTS).
//   3. JS : aucune couleur hex, rgb ou hsl non neutre, hors EXEMPTS_JS.
//   4. Tout jeton de couleur de :root a une famille (js/habillage-familles.js).
//   6. CSS : une règle qui vise un document imprimé (feuille d'émargement, dossier Qualiopi, certificats et
//      attestations, dossier professionnel) n'emploie aucune variable de la famille d'habillage, même en repli
//      de var() : un document imprimé a le même aspect quelle que soit la personne qui l'imprime (décision H5).
//   7. CSS : une règle qui prend la police des titres (var(--font-display)) en prend aussi le poids par un jeton
//      --poids-titre*, et une déclaration font-weight numérique n'existe pas dans une règle qui vise h1, h2, h3 ou
//      .display : l'habillage « Couleurs ECF » change la police des titres et remappe leurs poids en redéfinissant ces
//      seules variables. Les documents imprimés (règle 6) gardent leurs jetons --doc-poids-titre* et sont laissés hors champ.
// La cinquième règle est le cliquet lui-même.

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Ces feuilles ne sont pas des feuilles d'interface : fonts.css (polices) et livret.css (document officiel TP-01303
// relevé du .docx, dont la petite barre d'outils écran garde ses gris et ses statuts).
const CSS_IGNORES = new Set(["css/fonts.css", "css/livret.css"]);

// Les racines où une variable de couleur peut se déclarer en dehors de :root : un document (feuille imprimable)
// qui a sa propre palette, indépendante de l'habillage de l'écran.
const RACINES_DOCUMENTS = [".dp-doc"];

// Fichiers JS dont les couleurs sont un dessin réglementaire, un document officiel ou une encre de signature, et
// non un habillage. Une vue de l'interface n'y figure jamais : elle va dans DETTE. Chaque entrée dit pourquoi.
// Le joker * remplace un morceau de nom de fichier.
export const EXEMPTS_JS = [
  "js/dessins-*.js",          // dessins des cours (véhicule, poste de conduite, voyants...) : couleurs réglementaires
  "js/dessin-svg.js",         // moteur des dessins des cours : couleurs des panneaux et du marquage
  "js/scene-*.js",            // scènes animées des cours (décors, véhicules, signalisation) : couleurs du réel
  "js/scenes.js",             // catalogue des scènes animées : mêmes couleurs que ses modules
  "js/signaux.js",            // panneaux du Code de la route : couleurs réglementaires
  "js/signaux-catalogue.js",  // catalogue de 384 panneaux : couleurs réglementaires
  "js/marquage.js",           // marquage au sol : blanc, jaune, rouge réglementaires
  "js/piece-cycliste.js",     // dessin d'un cycliste (cours) : couleurs du réel
  "js/signature-pad.js",      // encre de la signature manuscrite : noir sur blanc, fixé par le document signé
  "js/views/epcf-livret.js",  // livret officiel TP-01303 : mise en page du document
  "js/doc-officiel.js",       // gabarit des documents officiels imprimés
  "js/epcf-trames.js",        // palette des trames EPCF : une couleur par rubrique du titre professionnel
  "js/echelle-notes.js",      // échelle continue des notes (teinte calculée, une par dixième de point) : un sens, pas un habillage
];

// Le cliquet : nombre d'écarts aux règles 1 à 4, par fichier. Il ne peut que baisser. Vide depuis la tâche 5 : toute nouvelle couleur en dur est refusée d'emblée.
export const DETTE = {};

// --- Rappels des règles, sur un texte (pur, donc testable sur de petits exemples) ---

const CONTEXTE_IMPRESSION = /^@media\s+print\b/i;
const estImpression = (contexte) => contexte.some((c) => CONTEXTE_IMPRESSION.test(c));
const normaliseSelecteurs = (s) => s.split(",").map((x) => x.trim().replace(/\s+/g, " "));

// Où une variable de couleur a le droit d'être déclarée (règle 2).
function declarationAutorisee(fichier, selecteur) {
  const lesSelecteurs = normaliseSelecteurs(selecteur);
  return lesSelecteurs.every((s) => {
    if (s === ":root") return fichier === "css/style.css";
    if (s === ':root[data-skin="ecf"]') return fichier === "css/habillage-ecf.css";
    return RACINES_DOCUMENTS.includes(s);
  });
}

// Les écarts d'un fichier CSS aux règles 1 et 2. Chaque écart : { fichier, ligne, regle, litteral }.
export function ecartsCss(fichier, texte) {
  const ecarts = [];
  for (const regle of lireRegles(texte)) {
    const impression = estImpression(regle.contexte);
    for (const d of regle.declarations) {
      const valeur = sansUrlNiChaines(d.valeur);
      if (d.propriete.startsWith("--")) {
        if (contientCouleur(d.valeur) && !declarationAutorisee(fichier, regle.selecteur)) {
          ecarts.push({ fichier, ligne: d.ligne, regle: 2, litteral: `${d.propriete} dans « ${regle.selecteur} »` });
        }
        continue; // la valeur d'une variable est exactement la couleur que la règle 1 permet
      }
      if (impression) continue;
      for (const c of couleursLitterales(valeur)) {
        if (!estNeutre(c)) ecarts.push({ fichier, ligne: d.ligne, regle: 1, litteral: c });
      }
    }
  }
  return ecarts;
}

// Règle 6. Les sélecteurs qui désignent un document imprimé : .emf-* et .em-feuille (feuille d'émargement),
// .qdoc et .qres-* (dossier Qualiopi), les classes .at-* du certificat et de l'attestation, .dp-doc (dossier
// professionnel), et leurs conteneurs d'impression. Les .at-* de la page écran des attestations (période,
// puces, lignes, chiffres) suivent l'habillage : seules les classes de document sont nommées, une classe
// de document nouvelle s'ajoute ici.
const AT_DOCUMENT = "doc|certificat|attestation|pagination|marge|entete|organisme|adresse|titre|espace|justifie|val|vide|consigne|pointilles|case|signature|fait|cadre|notes|resume|sous-titre|table|nombre|source";
const SELECTEUR_DOCUMENT = new RegExp(String.raw`\.emf-|\.em-feuille|\.qdoc|\.qres-|\.at-(?:${AT_DOCUMENT})|\.dp-doc|#emargement-print|#qualiopi-print|#dp-print`);

// Les écarts d'un fichier CSS à la règle 6 : { fichier, ligne, regle: 6, litteral }.
export function ecartsDocuments(fichier, texte) {
  const ecarts = [];
  for (const regle of lireRegles(texte)) {
    if (!SELECTEUR_DOCUMENT.test(regle.selecteur)) continue;
    for (const d of regle.declarations) {
      for (const m of d.valeur.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (familleDe(m[1]) === "habillage") {
          ecarts.push({ fichier, ligne: d.ligne, regle: 6, litteral: `${m[1]} dans « ${regle.selecteur} »` });
        }
      }
    }
  }
  return ecarts;
}

// Un sélecteur de la liste vise un titre : une balise h1, h2, h3 ou la classe .display, seuls ou en fin de composé.
const VISE_TITRE = /(?:^|[\s>+~])(?:h[123]|\.display)(?![\w-])/;

// Les écarts d'un fichier CSS à la règle 7 : { fichier, ligne, regle: 7, litteral }.
export function ecartsPoidsTitres(fichier, texte) {
  const ecarts = [];
  for (const regle of lireRegles(texte)) {
    if (SELECTEUR_DOCUMENT.test(regle.selecteur)) continue;
    const poids = regle.declarations.filter((d) => d.propriete === "font-weight");
    const jeton = (d) => /^var\(\s*--poids-titre[\w-]*\s*\)$/.test(d.valeur.trim());
    const police = regle.declarations.some((d) => d.propriete === "font-family" && /var\(\s*--font-display/.test(d.valeur));
    if (police && !poids.some(jeton)) {
      ecarts.push({ fichier, ligne: regle.declarations.find((d) => d.propriete === "font-family").ligne, regle: 7, litteral: `police des titres sans poids en jeton dans « ${regle.selecteur} »` });
    }
    if (regle.selecteur.split(",").some((part) => VISE_TITRE.test(part.trim()))) {
      for (const d of poids) {
        if (!jeton(d)) ecarts.push({ fichier, ligne: d.ligne, regle: 7, litteral: `font-weight: ${d.valeur.trim()} dans « ${regle.selecteur} »` });
      }
    }
  }
  return ecarts;
}

// Les écarts d'un fichier JS à la règle 3 : couleurs hex, rgb, hsl non neutres, hors commentaires.
export function ecartsJs(fichier, texte) {
  const ecarts = [];
  const lignes = sansCommentaires(texte).split("\n");
  lignes.forEach((brut, n) => {
    const ligne = retireCommentaireDeLigne(brut);
    for (const c of couleursLitterales(ligne, { noms: false })) {
      if (!estNeutre(c)) ecarts.push({ fichier, ligne: n + 1, regle: 3, litteral: c });
    }
  });
  return ecarts;
}

// Retire un commentaire « // ... » de fin de ligne, sauf s'il est dans une chaîne ou dans une adresse (https://).
function retireCommentaireDeLigne(ligne) {
  let guillemet = null;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemet) {
      if (c === "\\") i++;
      else if (c === guillemet) guillemet = null;
    } else if (c === '"' || c === "'" || c === "`") guillemet = c;
    else if (c === "/" && ligne[i + 1] === "/" && ligne[i - 1] !== ":") return ligne.slice(0, i);
  }
  return ligne;
}

// Règle 4 : tous les jetons de couleur de :root (valeur avec une couleur, ou var() vers un tel jeton) ont une famille.
export function ecartsFamilles(fichier, texte) {
  const jetons = new Map(); // nom -> { valeur, ligne }
  for (const regle of lireRegles(texte)) {
    if (!normaliseSelecteurs(regle.selecteur).every((s) => s === ":root" || s === ':root[data-skin="ecf"]')) continue;
    for (const d of regle.declarations) if (d.propriete.startsWith("--")) jetons.set(d.propriete, { valeur: d.valeur, ligne: d.ligne });
  }
  const colores = new Set();
  for (const [nom, { valeur }] of jetons) if (contientCouleur(valeur)) colores.add(nom);
  for (let change = true; change;) { // un jeton qui pointe vers un jeton de couleur en est un aussi
    change = false;
    for (const [nom, { valeur }] of jetons) {
      if (colores.has(nom)) continue;
      const cibles = [...valeur.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
      if (cibles.some((c) => colores.has(c))) { colores.add(nom); change = true; }
    }
  }
  const ecarts = [];
  for (const nom of colores) {
    const dansLesDeux = PREFIXES_HABILLAGE.some((p) => correspond(nom, p)) && FAMILLES_FIXES.some((p) => correspond(nom, p));
    if (familleDe(nom) === null || dansLesDeux) {
      ecarts.push({
        fichier, ligne: jetons.get(nom).ligne, regle: 4,
        litteral: `${nom} ${dansLesDeux ? "est dans les deux listes" : "n'a pas de famille (js/habillage-familles.js)"}`,
      });
    }
  }
  return ecarts;
}

// --- Relevé des fichiers du dépôt ---

function listeFichiers(dossier, extension, recursif) {
  const sortie = [];
  for (const e of fs.readdirSync(path.join(RACINE, dossier), { withFileTypes: true })) {
    const rel = `${dossier}/${e.name}`;
    if (e.isDirectory()) { if (recursif) sortie.push(...listeFichiers(rel, extension, true)); }
    else if (e.name.endsWith(extension)) sortie.push(rel);
  }
  return sortie.sort();
}

function glob(motif) {
  return new RegExp("^" + motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$");
}
const exemptsJs = EXEMPTS_JS.map(glob);
const estExemptJs = (f) => exemptsJs.some((re) => re.test(f));

function releveEcarts() {
  const parFichier = new Map();
  const note = (fichier, ecarts) => { if (ecarts.length) parFichier.set(fichier, ecarts); };
  for (const f of listeFichiers("css", ".css", false)) {
    if (CSS_IGNORES.has(f)) continue;
    const texte = fs.readFileSync(path.join(RACINE, f), "utf8");
    note(f, [...ecartsCss(f, texte), ...ecartsFamilles(f, texte), ...ecartsDocuments(f, texte), ...ecartsPoidsTitres(f, texte)]);
  }
  for (const f of listeFichiers("js", ".js", true)) {
    if (estExemptJs(f)) continue;
    note(f, ecartsJs(f, fs.readFileSync(path.join(RACINE, f), "utf8")));
  }
  return parFichier;
}

const DECRIT = { 1: "couleur écrite en dur", 2: "variable de couleur hors :root", 3: "couleur écrite en dur (JS)", 4: "jeton sans famille", 6: "jeton d'habillage dans un document imprimé", 7: "poids de titre en dur" };
const decrit = (e) => `  ${e.fichier}:${e.ligne}  règle ${e.regle} (${DECRIT[e.regle]})  ${e.litteral}`;

// --- Le cliquet (règle 5) ---

const RELEVE = releveEcarts();

test("cliquet : aucun fichier n'a plus d'écarts de couleur que sa dette", () => {
  const trop = [];
  for (const [fichier, ecarts] of RELEVE) {
    const dette = DETTE[fichier] ?? 0;
    if (ecarts.length > dette) {
      trop.push(`${fichier} : ${ecarts.length} écarts pour une dette de ${dette}. Remplacer par une variable (jeton de js/habillage-familles.js) :\n${ecarts.map(decrit).join("\n")}`);
    }
  }
  assert.equal(trop.length, 0, `\n${trop.join("\n\n")}\n`);
});

test("cliquet : aucune dette n'est restée plus haute que le nombre d'écarts réel", () => {
  const dessous = [];
  for (const [fichier, dette] of Object.entries(DETTE)) {
    const reel = (RELEVE.get(fichier) ?? []).length;
    if (reel < dette) dessous.push(`baisser la dette de ${fichier} à ${reel} (elle est à ${dette})`);
  }
  assert.equal(dessous.length, 0, `\n${dessous.join("\n")}\n`);
});

test("cliquet : DETTE ne nomme que des fichiers couverts par la garde", () => {
  const inconnus = Object.keys(DETTE).filter((f) => {
    if (!fs.existsSync(path.join(RACINE, f))) return true;
    return CSS_IGNORES.has(f) || estExemptJs(f);
  });
  assert.deepEqual(inconnus, [], "ces fichiers n'existent pas, ou sont exemptés");
});

// --- Les familles de jetons ---

test("familles : les deux listes sont gelées et sans doublon", () => {
  assert.ok(Object.isFrozen(PREFIXES_HABILLAGE) && Object.isFrozen(FAMILLES_FIXES));
  const tous = [...PREFIXES_HABILLAGE, ...FAMILLES_FIXES];
  assert.equal(new Set(tous).size, tous.length);
  for (const p of tous) assert.match(p, /^--[a-z-]+$/);
});

test("familles : aucun préfixe d'une liste ne recouvre un préfixe de l'autre", () => {
  for (const p of PREFIXES_HABILLAGE) for (const q of FAMILLES_FIXES) {
    assert.ok(!correspond(p, q) && !correspond(q, p), `${p} et ${q} se recouvrent`);
  }
});

test("familleDe : habillage, fixe ou rien, sans confondre un nom qui ressemble", () => {
  assert.equal(familleDe("--bg"), "habillage");
  assert.equal(familleDe("--bg-elev"), "habillage");
  assert.equal(familleDe("--accent-soft-2"), "habillage");
  assert.equal(familleDe("--shadow-1"), "habillage");
  assert.equal(familleDe("--font-display"), "habillage");
  assert.equal(familleDe("--act-cours-border"), "fixe");
  assert.equal(familleDe("--c-stop"), "fixe");
  assert.equal(familleDe("--note-bonne"), "fixe");
  assert.equal(familleDe("--accent"), "habillage", "« --act » ne couvre pas « --accent »");
  assert.equal(familleDe("--background"), null, "« --bg » ne couvre pas « --background »");
  assert.equal(familleDe("--font-mono"), null);
  assert.equal(familleDe("--r"), null);
  assert.equal(familleDe("bg"), null);
});

// --- Les aides de lecture du CSS ---

test("lireRegles : commentaires ignorés, lignes justes, declarations par règle", () => {
  const css = "/* #123456 */\n.a { color: red;\n  /* background: #123456; */\n  background: var(--bg); }\n";
  const r = lireRegles(css);
  assert.equal(r.length, 1);
  assert.equal(r[0].selecteur, ".a");
  assert.deepEqual(r[0].declarations.map((d) => [d.propriete, d.valeur, d.ligne]), [["color", "red", 2], ["background", "var(--bg)", 4]]);
  assert.equal(couleursLitterales(sansCommentaires(css)).join(), "red");
});

test("lireRegles : un @media print imbriqué rend son contexte, et les at-rules sans corps sont sautées", () => {
  const css = "@import url(x.css);\n@media screen { .x { color: #111; } }\n@media print {\n  .p { color: #F5E8D0; }\n}\n.z { color: #222 }";
  const r = lireRegles(css);
  assert.deepEqual(r.map((x) => [x.selecteur, x.contexte]), [[".x", ["@media screen"]], [".p", ["@media print"]], [".z", []]]);
  assert.equal(r[1].declarations[0].ligne, 4);
});

test("lireRegles : une url data: avec des points-virgules ne coupe pas la déclaration", () => {
  const r = lireRegles(".a { background: url(\"data:image/svg+xml;utf8,<svg fill='%23fff'/>\") no-repeat; color: blue }");
  assert.deepEqual(r[0].declarations.map((d) => d.propriete), ["background", "color"]);
});

test("couleursLitterales : hex de 3, 4, 6 et 8 chiffres, rgb, rgba, hsl, hsla, noms", () => {
  assert.deepEqual(couleursLitterales("#abc #abcd #aabbcc #aabbccdd"), ["#abc", "#abcd", "#aabbcc", "#aabbccdd"]);
  assert.deepEqual(couleursLitterales("rgb(1,2,3) rgba(1,2,3,.5) hsl(10 20% 30%) hsla(1,2%,3%,.4)"),
    ["rgb(1,2,3)", "rgba(1,2,3,.5)", "hsl(10 20% 30%)", "hsla(1,2%,3%,.4)"]);
  assert.deepEqual(couleursLitterales("1px solid red"), ["red"]);
});

test("couleursLitterales : pas de faux positif sur un hex à 5 chiffres, un identifiant ou un nom collé à un tiret", () => {
  assert.deepEqual(couleursLitterales("#abcde #12345678a .a-red var(--red) &#8212; background-color"), []);
});

test("couleursLitterales : le repli d'un var() compte, et rgba( 255,255,255, .5 ) est lu en entier", () => {
  assert.deepEqual(couleursLitterales("var(--x, #6B7F4E)"), ["#6B7F4E"]);
  assert.deepEqual(couleursLitterales("rgba( 255,255,255, .5 )"), ["rgba( 255,255,255, .5 )"]);
});

test("estNeutre : blanc, noir, transparent, currentColor, blanc et noir translucides (casse et espaces indifférents)", () => {
  for (const n of ["#fff", "#FFFFFF", "#000", "#000000", "white", "Black", "transparent", "currentColor",
    "rgba(255, 255, 255, 0.5)", "rgba( 255,255,255, .5 )", "RGBA(0,0,0,.2)", "rgba(0, 0, 0, 1)"]) {
    assert.ok(estNeutre(n), n);
  }
  for (const n of ["#F5E8D0", "#fffffe", "red", "rgba(60, 40, 20, 0.04)", "rgba(255, 255, 254, .5)", "rgb(10,10,10)"]) {
    assert.ok(!estNeutre(n), n);
  }
});

test("contientCouleur : ignore transparent, currentColor, les url et les chaînes", () => {
  assert.ok(contientCouleur("0 1px 2px rgba(60, 40, 20, 0.04)"));
  assert.ok(contientCouleur("#fff"));
  assert.ok(!contientCouleur("transparent"));
  assert.ok(!contientCouleur("url(img/red.png) no-repeat"));
  assert.ok(!contientCouleur('"red" 4px'));
});

// --- Les règles, sur de petits exemples ---

test("règle 1 : une couleur non neutre est refusée, le neutre et les variables passent, le print est libre", () => {
  const css = [
    ".a { color: #F5E8D0; border: 1px solid var(--line); background: rgba(255,255,255,.5); }",
    ".b { box-shadow: 0 1px rgba(60,40,20,.04), 0 0 var(--x, #6B7F4E); color: black; }",
    "@media print { .c { color: #123456; } }",
    ".d { --perso: #123456; }",
  ].join("\n");
  const ecarts = ecartsCss("css/pages.css", css).filter((e) => e.regle === 1);
  assert.deepEqual(ecarts.map((e) => [e.ligne, e.litteral]), [[1, "#F5E8D0"], [2, "rgba(60,40,20,.04)"], [2, "#6B7F4E"]]);
});

test("règle 2 : une variable de couleur ne se déclare que dans :root, le bloc ECF ou une racine de document", () => {
  const css = ":root { --bg: #F1F4F0; }\n.dp-doc { --encre: #112233; }\n.autre { --encre: #112233; }\n:root[data-skin=\"ecf\"] { --bg: #124483; }\n.x { --taille: 12px; }";
  assert.deepEqual(ecartsCss("css/style.css", css).filter((e) => e.regle === 2).map((e) => e.ligne), [3, 4],
    "hors css/habillage-ecf.css, le bloc ECF est refusé");
  assert.deepEqual(ecartsCss("css/habillage-ecf.css", css).filter((e) => e.regle === 2).map((e) => e.ligne), [1, 3],
    "le bloc ECF n'est accepté que dans son fichier, et :root seulement dans css/style.css");
});

test("règle 6 : un document imprimé n'emploie aucun jeton d'habillage, même en repli", () => {
  const css = [
    ".emf-titre { font-family: var(--doc-police-titre); color: var(--doc-encre); }",
    ".qdoc h2 { color: var(--text); }",
    ".at-titre { font-family: var(--font-display); }",
    ".dp-doc .x { border: 1px solid var(--doc-trait-fort, var(--line)); }",
    ".at-ligne { color: var(--text); }",
    ".em-demi { color: var(--text-muted); }",
  ].join("\n");
  assert.deepEqual(ecartsDocuments("css/x.css", css).map((e) => [e.ligne, e.litteral.split(" ")[0]]),
    [[2, "--text"], [3, "--font-display"], [4, "--line"]]);
});

test("règle 7 : la police des titres exige un poids en jeton, et un titre n'a pas de font-weight numérique", () => {
  const css = [
    ".a { font-family: var(--font-display); font-weight: 700; }",
    ".b { font-family: var(--font-display); font-weight: var(--poids-titre-leger); }",
    ".c { font-family: var(--font-display); }",
    ".d h3 { font-weight: 400; }",
    ".e, .f .display { font-weight: var(--poids-titre); }",
    ".g h2 { font-weight: 600; }",
    ".qdoc h2 { font-family: var(--doc-police-titre); font-weight: var(--doc-poids-titre); }",
    ".h { font-weight: 700; }",
    ".display-x { font-weight: 700; }",
  ].join("\n");
  assert.deepEqual(ecartsPoidsTitres("css/x.css", css).map((e) => e.ligne), [1, 3, 4, 6]);
});

test("règle 3 : le JS refuse hex, rgb, hsl non neutres, ignore les commentaires et les chaînes d'adresse", () => {
  const js = [
    "const a = '#F5E8D0'; // #123456 dans un commentaire",
    "/* rgb(1,2,3) */ const b = `rgba(10, 20, 30, .5)`;",
    "const c = '#fff', d = 'rgba(0,0,0,.2)', e = 'https://x.fr/#aabbcc';",
    "const f = 'hsl(10 20% 30%)';",
  ].join("\n");
  assert.deepEqual(ecartsJs("js/x.js", js).map((e) => [e.ligne, e.litteral]),
    [[1, "#F5E8D0"], [2, "rgba(10, 20, 30, .5)"], [3, "#aabbcc"], [4, "hsl(10 20% 30%)"]]);
});

test("règle 4 : un jeton de couleur de :root sans famille est refusé, y compris par var() vers un jeton de couleur", () => {
  const css = ":root {\n  --bg: #F1F4F0;\n  --mystere: #123456;\n  --alias: var(--mystere);\n  --bg-ok: var(--bg);\n  --r: 10px;\n  --c-stop: #964F33;\n}";
  assert.deepEqual(ecartsFamilles("css/style.css", css).map((e) => e.litteral.split(" ")[0]), ["--mystere", "--alias"]);
});

test("la garde lit les vrais fichiers : le CSS et le JS de l'app", () => {
  assert.ok(listeFichiers("css", ".css", false).includes("css/style.css"));
  assert.ok(listeFichiers("js", ".js", true).includes("js/views/home.js"));
  assert.ok(estExemptJs("js/dessins-poste.js") && estExemptJs("js/scene-moteur.js") && !estExemptJs("js/views/home.js"));
});

// --- Le bloc « Couleurs ECF » (css/habillage-ecf.css) ---

const FICHIER_ECF = "css/habillage-ecf.css";
const SELECTEUR_ECF = ':root[data-skin="ecf"]';
// Les seuls fichiers JS qui nomment data-skin : le mécanisme de l'habillage et son script d'avant peinture.
const JS_AVEC_DATA_SKIN = ["js/habillage.js", "js/habillage-avant-peinture.js"];

const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), "utf8");

// Les jetons d'un bloc : nom -> valeur (la dernière déclaration l'emporte, comme en CSS).
function jetonsDuBloc(texte, selecteur) {
  const jetons = new Map();
  for (const regle of lireRegles(texte)) {
    if (!normaliseSelecteurs(regle.selecteur).every((s) => s === selecteur)) continue;
    for (const d of regle.declarations) if (d.propriete.startsWith("--")) jetons.set(d.propriete, d.valeur.trim());
  }
  return jetons;
}

const JETONS_DEFAUT = jetonsDuBloc(lire("css/style.css"), ":root");
const JETONS_ECF = fs.existsSync(path.join(RACINE, FICHIER_ECF)) ? jetonsDuBloc(lire(FICHIER_ECF), SELECTEUR_ECF) : new Map();

test("ECF : un seul bloc, de sélecteur exact, qui ne contient que des variables", () => {
  assert.ok(fs.existsSync(path.join(RACINE, FICHIER_ECF)), `${FICHIER_ECF} est absent`);
  const texte = sansCommentaires(lire(FICHIER_ECF));
  assert.match(texte.trim(), /^:root\[data-skin="ecf"\]\s*\{[^{}]*\}$/, "le fichier ne contient qu'une règle, sans @media ni autre sélecteur");
  const regles = lireRegles(lire(FICHIER_ECF));
  assert.equal(regles.length, 1);
  assert.equal(regles[0].selecteur.trim(), SELECTEUR_ECF);
  for (const d of regles[0].declarations) assert.ok(d.propriete.startsWith("--"), `${d.propriete} n'est pas une variable (ligne ${d.ligne})`);
  assert.ok(JETONS_ECF.size > 50);
});

test("ECF : il redéfinit chaque jeton d'habillage de :root, et seulement eux", () => {
  const inconnus = [...JETONS_ECF.keys()].filter((n) => !JETONS_DEFAUT.has(n));
  assert.deepEqual(inconnus, [], "ces jetons n'existent pas dans :root (faute de frappe ?)");
  const pasHabillage = [...JETONS_ECF.keys()].filter((n) => familleDe(n) !== "habillage");
  assert.deepEqual(pasHabillage, [], "ces jetons ne sont pas de la famille d'habillage (un jeton fixe ne se redéfinit jamais)");
  const fixes = [...JETONS_ECF.keys()].filter((n) => FAMILLES_FIXES.some((p) => correspond(n, p)));
  assert.deepEqual(fixes, []);
  const oublies = [...JETONS_DEFAUT.keys()].filter((n) => familleDe(n) === "habillage" && !JETONS_ECF.has(n));
  assert.deepEqual(oublies, [], "ces jetons d'habillage restent à la couleur de l'habillage par défaut sous ECF");
});

// Les fichiers (chemin -> texte) qui nomment data-skin sans y avoir droit : le bloc ECF pour le CSS, le mécanisme de
// l'habillage pour le JS. Pure : le test la nourrit des vrais fichiers, puis d'un faux contrevenant.
export function fichiersAvecDataSkinInterdit(fichiers) {
  return Object.keys(fichiers).filter((f) => {
    if (!/data-skin|dataset\.skin/.test(fichiers[f])) return false;
    if (f.endsWith(".css")) return f !== FICHIER_ECF;
    return !JS_AVEC_DATA_SKIN.includes(f);
  });
}

test("ECF : data-skin n'apparaît que dans le bloc ECF et, en JavaScript, dans le mécanisme de l'habillage", () => {
  const fichiers = {};
  for (const f of listeFichiers("css", ".css", false)) fichiers[f] = lire(f);
  for (const f of listeFichiers("js", ".js", true)) fichiers[f] = lire(f);
  assert.deepEqual(fichiersAvecDataSkinInterdit(fichiers), [], "l'habillage s'applique par le seul attribut posé par js/habillage.js ; le reste de l'app l'ignore");
});

test("ECF : la règle data-skin sait échouer (faux contrevenants CSS et JS, faux autorisés)", () => {
  const faux = {
    "css/habillage-ecf.css": ':root[data-skin="ecf"] { --bg: #fff; }',
    "css/pages.css": '[data-skin="ecf"] .x { color: red; }',
    "js/habillage.js": 'document.documentElement.dataset.skin = "ecf";',
    "js/habillage-avant-peinture.js": 'setAttribute("data-skin", nom);',
    "js/views/home.js": 'document.documentElement.dataset.skin = "ecf";',
    "js/autre.js": "const a = 1;",
  };
  assert.deepEqual(fichiersAvecDataSkinInterdit(faux), ["css/pages.css", "js/views/home.js"]);
});

// --- Contrastes, calculés pour les deux habillages ---

// Une couleur : { r, g, b, a } (r, g, b sur 255, a sur 1), ou null si elle n'en est pas une.
function lireCouleur(texte) {
  const t = texte.trim().toLowerCase();
  let m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

// La valeur d'un jeton pour un habillage, ses var() suivies jusqu'à une couleur.
function couleurDe(jetons, valeur, vus = new Set()) {
  const v = valeur.trim();
  const direct = lireCouleur(v);
  if (direct) return direct;
  const m = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (!m || vus.has(m[1]) || !jetons.has(m[1])) throw new Error(`pas de couleur pour « ${valeur} »`);
  vus.add(m[1]);
  return couleurDe(jetons, jetons.get(m[1]), vus);
}

// Une couleur translucide posée sur un fond opaque.
const composer = (c, fond) => ({
  r: c.r * c.a + fond.r * (1 - c.a), g: c.g * c.a + fond.g * (1 - c.a), b: c.b * c.a + fond.b * (1 - c.a), a: 1,
});
const luminance = ({ r, g, b }) => {
  const lin = (x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
export function rapportDeContraste(a, b) {
  const [h, l] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
}

// Les paires texte / fond de l'interface : [texte, fond, seuil]. Un nom commence par « -- » (jeton) ou par « # » (couleur
// écrite : le blanc d'un texte sur un fond plein). Seuil 4,5 : texte courant (WCAG AA) ; 3 : repère graphique (un trait,
// une pastille). --text-faint n'y figure pas : c'est du décor, aucun texte ne l'emploie.
export const PAIRES = [
  ...["--text", "--text-soft", "--text-muted"].flatMap((t) => ["--bg", "--bg-elev", "--bg-soft", "--bg-subtle"].map((f) => [t, f, 4.5])),
  ["--accent", "--bg", 4.5], ["--accent", "--bg-elev", 4.5], ["--accent", "--accent-soft", 4.5],
  ["--accent-strong", "--accent-soft-2", 4.5],
  ["#FFFFFF", "--accent", 4.5],
  ["--accent-texte", "--accent", 4.5],
  ["--sur-sombre", "--bg-deep", 4.5], ["--sur-sombre-doux", "--bg-deep", 4.5],
  ["--accent-on-dark", "--bg-deep", 4.5],
  ["--sur-repere-sombre", "--repere-sombre", 4.5], ["--sur-pastille", "--pastille", 4.5],
  ["--repere-sombre", "--bg-deep", 3], ["--pastille", "--bg-elev", 3],
  ["--sur-sombre-marque", "--sombre-marque", 4.5], ["--sombre-marque", "--bg-deep", 3],
  ["--sur-sombre-actif", "--bg-deep", 3],
  ["--repere-admin", "--bg-deep", 4.5],
];

export function contrastesDe(jetons) {
  const lire1 = (n) => couleurDe(jetons, n.startsWith("--") ? `var(${n})` : n);
  return PAIRES.map(([texte, fond, seuil]) => {
    const f = lire1(fond);
    const c = composer(lire1(texte), f);
    return { texte, fond, seuil, rapport: rapportDeContraste(c, f) };
  });
}

const JETONS_ECF_COMPLETS = new Map([...JETONS_DEFAUT, ...JETONS_ECF]);

for (const [nom, jetons] of [["ECSR Promo", JETONS_DEFAUT], ["Couleurs ECF", JETONS_ECF_COMPLETS]]) {
  test(`contrastes (${nom}) : chaque paire texte / fond atteint son seuil`, (t) => {
    const lignes = contrastesDe(jetons);
    t.diagnostic(lignes.map((l) => `${l.texte} sur ${l.fond} : ${l.rapport.toFixed(2)} (seuil ${l.seuil})`).join("\n"));
    const tropBas = lignes.filter((l) => l.rapport < l.seuil)
      .map((l) => `${l.texte} sur ${l.fond} : ${l.rapport.toFixed(2)}:1 pour ${l.seuil}:1`);
    assert.deepEqual(tropBas, []);
  });
}

test("contrastes : le calcul est juste (noir sur blanc 21, rouge d'ECF sur le bleu nuit 3,01) et compose les transparences", () => {
  assert.ok(Math.abs(rapportDeContraste(lireCouleur("#000"), lireCouleur("#fff")) - 21) < 1e-9);
  const rouge = rapportDeContraste(lireCouleur("#DB1418"), lireCouleur("#0D2546"));
  assert.ok(rouge >= 3 && rouge < 3.1, `rouge sur bleu nuit : ${rouge}`);
  assert.deepEqual(composer(lireCouleur("rgba(255,255,255,0.5)"), lireCouleur("#000")), { r: 127.5, g: 127.5, b: 127.5, a: 1 });
  assert.equal(couleurDe(new Map([["--a", "var(--b)"], ["--b", "#112233"]]), "var(--a)").g, 0x22);
});
