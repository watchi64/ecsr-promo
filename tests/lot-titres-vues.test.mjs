// Titres, étape 3, tâche 30 : chaque page écrit selon sa case, l'accueil suit les cases.
// Lancer : node --test tests/lot-titres-vues.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync, execFileSync } from "node:child_process";
import { selonLaCase, casesDeLEspace, caseDe, directionFixeSur, donneesDuCentreVisibles } from "../js/titres-rules.js";

const maxPromo = { planning: 2, emargement: 2, stagiaires: 2, notes: 2, cours: 2, ccp2: 1, indicateurs: 1, reglages: 2 };
const formateurFixe = { titre_id: 1, nom: "Formateur", niveau: "promo", lieu_id: 1, promo_ids: [1], cases: maxPromo };
const intervenant = {
  titre_id: 5, nom: "Intervenant", niveau: "promo", lieu_id: 1, promo_ids: [1],
  cases: { planning: "voir", emargement: "modifier", stagiaires: "voir", notes: "non", cours: "voir", ccp2: "non", indicateurs: "non", reglages: "non" },
};
const directionFixe = {
  titre_id: 2, nom: "Direction de centre", niveau: "centre", lieu_id: 1, promo_ids: [],
  cases: { promos: 2, stagiaires: 2, emargement: 1, notes: 1, equipe: 2, reglages: 2 },
};
const secretariat = {
  titre_id: 7, nom: "Secrétariat", niveau: "centre", lieu_id: 1, promo_ids: [],
  cases: { promos: "non", stagiaires: "modifier", emargement: "voir", notes: "non", equipe: "non", reglages: "non" },
};

// Ce que font js/auth-admin.js (ecritSelonLaCase, litSelonLaCase) : la même composition, sans le navigateur.
const ecrit = (cases, niveau, page, ancien) => selonLaCase({ cases, droit: caseDe(cases, page, niveau) === 2, ancien });
const lit = (cases, niveau, page, ancien) => selonLaCase({ cases, droit: caseDe(cases, page, niveau) >= 1, ancien });
const casesPromo = (titre) => casesDeLEspace({ espace: "equipe", titres: [titre], promoId: 1 });
const casesCentre = (titre) => casesDeLEspace({ espace: "direction", titres: [titre], lieuId: 1 });

test("selonLaCase : cases lues, la case décide ; cases nulles, l'ancien prédicat seul décide", () => {
  assert.equal(selonLaCase({ cases: { a: 2 }, droit: true, ancien: false }), true);
  assert.equal(selonLaCase({ cases: { a: 0 }, droit: false, ancien: true }), false);
  assert.equal(selonLaCase({ cases: null, droit: true, ancien: true }), true);
  assert.equal(selonLaCase({ cases: null, droit: true, ancien: false }), false, "aucun compte ne gagne un accès : droit vrai (plafond), ancien faux");
  assert.equal(selonLaCase({ cases: null, droit: false, ancien: true }), true);
  assert.equal(selonLaCase({ cases: null, droit: false, ancien: false }), false);
  assert.equal(selonLaCase({}), false);
});

test("titre fixe : chaque remplacement vaut l'ancien appel (équipe)", () => {
  const cases = casesPromo(formateurFixe);
  for (const page of ["planning", "emargement", "stagiaires", "notes", "cours", "reglages"]) {
    assert.equal(ecrit(cases, "promo", page, true), true, `écrire ${page}`);
    assert.equal(lit(cases, "promo", page, true), true, `lire ${page}`);
  }
});

test("direction fixe : stagiaires et réglages à Modifier, émargement et notes à Voir (comme isEquipe sans isAdmin)", () => {
  const cases = casesCentre(directionFixe);
  assert.equal(ecrit(cases, "centre", "stagiaires", true), true);
  assert.equal(ecrit(cases, "centre", "reglages", true), true);
  assert.equal(ecrit(cases, "centre", "promos", true), true);
  assert.equal(lit(cases, "centre", "emargement", true), true);
  assert.equal(lit(cases, "centre", "notes", true), true);
  assert.equal(ecrit(cases, "centre", "emargement", false), false, "la direction n'écrit pas l'émargement");
  assert.equal(ecrit(cases, "centre", "notes", false), false, "la direction n'écrit aucune note");
});

test("cases non lues : aucun compte ne gagne d'accès, quelle que soit la page", () => {
  for (const page of ["planning", "emargement", "stagiaires", "notes", "cours", "reglages", "promos"]) {
    for (const niveau of ["promo", "centre"]) {
      assert.equal(ecrit(null, niveau, page, false), false, `${niveau}/${page} écriture`);
      assert.equal(lit(null, niveau, page, false), false, `${niveau}/${page} lecture`);
      assert.equal(ecrit(null, niveau, page, true), true);
      assert.equal(lit(null, niveau, page, true), true);
    }
  }
});

test("Intervenant : Planning sans écriture, Émargement complet, Stagiaires en lecture, rien sur Notes ni Réglages", () => {
  const c = casesPromo(intervenant);
  assert.equal(ecrit(c, "promo", "planning", true), false);
  assert.equal(lit(c, "promo", "planning", true), true);
  assert.equal(ecrit(c, "promo", "emargement", false), true);
  assert.equal(ecrit(c, "promo", "stagiaires", true), false);
  assert.equal(lit(c, "promo", "stagiaires", true), true);
  assert.equal(ecrit(c, "promo", "notes", true), false);
  assert.equal(lit(c, "promo", "notes", true), false);
  assert.equal(ecrit(c, "promo", "reglages", true), false);
});

test("Accueil : blocs visibles avec les cases du titre fixe, masqués avec celles de l'Intervenant", () => {
  const blocs = (cases) => ({
    emargement: ecrit(cases, "promo", "emargement", true),
    atraiter: ecrit(cases, "promo", "cours", true),
    tableau: lit(cases, "promo", "planning", true),
    voiture: lit(cases, "promo", "planning", true),
    asuivre: lit(cases, "promo", "notes", true),
  });
  assert.deepEqual(blocs(casesPromo(formateurFixe)), { emargement: true, atraiter: true, tableau: true, voiture: true, asuivre: true });
  assert.deepEqual(blocs(casesPromo(intervenant)), { emargement: true, atraiter: false, tableau: true, voiture: true, asuivre: false });
  assert.deepEqual(blocs(null), { emargement: true, atraiter: true, tableau: true, voiture: true, asuivre: true }, "cases non lues : tout comme avant");
});

test("Vue d'ensemble et vues de la direction : Secrétariat sans Résultats ni « Créer une promo », avec Stagiaires", () => {
  const f = casesCentre(directionFixe);
  const s = casesCentre(secretariat);
  const vue = (cases) => ({
    assiduite: lit(cases, "centre", "stagiaires", true),
    resultats: lit(cases, "centre", "notes", true),
    creerPromo: ecrit(cases, "centre", "promos", true),
    inviter: ecrit(cases, "centre", "stagiaires", true),
  });
  assert.deepEqual(vue(f), { assiduite: true, resultats: true, creerPromo: true, inviter: true });
  assert.deepEqual(vue(s), { assiduite: true, resultats: false, creerPromo: false, inviter: true });
  assert.deepEqual(vue(null), { assiduite: true, resultats: true, creerPromo: true, inviter: true });
});

test("Données personnelles du centre : fondateur et direction fixe seulement ; titres non lus, comme avant", () => {
  const titreCentreNonFixe = { ...secretariat, fixe: false, cases: { ...secretariat.cases, reglages: "modifier" } };
  assert.equal(directionFixeSur([directionFixe], 1), true);
  assert.equal(directionFixeSur([{ ...directionFixe, fixe: true }], 1), true);
  assert.equal(directionFixeSur([titreCentreNonFixe], 1), false);
  assert.equal(directionFixeSur([directionFixe], 2), false, "autre centre");
  assert.equal(directionFixeSur(null, 1), null);
  assert.equal(donneesDuCentreVisibles({ titres: [directionFixe], lieuId: 1 }), true);
  assert.equal(donneesDuCentreVisibles({ titres: [titreCentreNonFixe], lieuId: 1 }), false, "Réglages : Modifier non fixe ne les voit pas");
  assert.equal(donneesDuCentreVisibles({ titres: [], lieuId: 1, fondateur: true }), true);
  assert.equal(donneesDuCentreVisibles({ titres: [], lieuId: 1 }), false);
  assert.equal(donneesDuCentreVisibles({ titres: null, lieuId: 1 }), true, "lecture ratée : comme avant");
});

// Garde de régression : chaque isAdmin() restant dans js/ est un appel déclaré (voir task-30-report.md).
const RESTANTS = {
  "js/autonomie-etat.js": 1, "js/main.js": 1, "js/modules-etat.js": 1, "js/views/centre.js": 1, "js/views/config.js": 3,
  "js/views/dp.js": 1, "js/views/epcf-livret.js": 1, "js/views/mon-suivi.js": 3, "js/views/notes.js": 1, "js/views/themes.js": 1,
};
test("les seuls isAdmin() qui restent dans js/ sont ceux du rapport", () => {
  const racine = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const sortie = execSync('git grep -c "isAdmin()" -- js', { cwd: racine, encoding: "utf8" });
  const trouves = {};
  for (const ligne of sortie.trim().split("\n")) {
    const [fichier, n] = ligne.split(/:(?=\d+$)/);
    if (fichier === "js/auth-admin.js" || fichier === "js/titres-rules.js") continue;
    trouves[fichier] = Number(n);
  }
  // planning.js (vues) ne garde que le commentaire de canEditWeek.
  delete trouves["js/views/planning.js"];
  assert.deepEqual(trouves, RESTANTS);
});

test("aucun tiret cadratin ni « prof » ajouté dans les fichiers de la tâche", () => {
  for (const f of ["js/titres-rules.js", "js/auth-admin.js", "js/views/direction-promos.js", "js/views/direction-stagiaires.js",
    "js/views/direction-centre.js", "js/views/reglages-habillage.js", "tests/lot-titres-vues.test.mjs"]) {
    const s = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(!s.includes(String.fromCharCode(0x2014)), f);
  }
});

// ---- Câblage des vues (ronde 1) : les deux ReferenceError de dp.js n'étaient vues par aucun test ----
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function fichiersJs(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiersJs(chemin, sortie); else if (nom.endsWith(".js")) sortie.push(chemin);
  }
  return sortie;
}
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const cheminJs = new URL("../js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("câblage : chaque fonction de auth-admin.js appelée dans js/ est importée (ou déclarée) dans son fichier", () => {
  const exportees = [...readFileSync(join(cheminJs, "auth-admin.js"), "utf8").matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]);
  assert.ok(exportees.includes("ecritSelonLaCase") && exportees.includes("gesteDefinitif"));
  const manquants = [];
  for (const f of fichiersJs(cheminJs)) {
    if (f.endsWith("auth-admin.js")) continue;
    const src = sansCommentaires(readFileSync(f, "utf8"));
    const importes = new Set();
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*auth-admin\.js[^"]*"/g)) {
      for (const part of m[1].split(",")) { const [, alias] = part.trim().split(/\s+as\s+/); if (part.trim()) importes.add((alias || part.trim().split(/\s+as\s+/)[0]).trim()); }
    }
    for (const nom of exportees) {
      if (!new RegExp(String.raw`(^|[^\w.$])` + nom + String.raw`\(`).test(src)) continue;
      if (importes.has(nom) || new RegExp(String.raw`function\s+` + nom + String.raw`\b`).test(src)) continue;
      manquants.push(f.slice(cheminJs.length + 1) + " : " + nom);
    }
  }
  assert.deepEqual(manquants, []);
});

test("câblage : un nom utilisé dans une fonction de module est déclaré dans cette fonction ou au niveau du module (dp.js)", () => {
  const src = sansCommentaires(readFileSync(join(cheminJs, "views/dp.js"), "utf8"));
  const corps = src.slice(src.indexOf("function showListe("), src.indexOf("async function renderReload("));
  assert.ok(/const ecrit = ecritSelonLaCase\("notes"\)/.test(corps), "showListe calcule `ecrit` lui-même");
  assert.ok(/monStagiaireId as maFiche/.test(src) && /maFiche\(\)/.test(src), "l'alias maFiche reste importé tant qu'il est appelé");
});

test("les vraies fonctions (ecritSelonLaCase, litSelonLaCase, gesteDefinitif) sans session : l'ancien prédicat seul, jamais un gain", () => {
  const script = `
    globalThis.window = globalThis;
    globalThis.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; },
      createElement() { return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} }; }, documentElement: { style: {}, classList: { add() {}, remove() {} } }, body: {} };
    globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    globalThis.sessionStorage = globalThis.localStorage;
    globalThis.location = { hash: "", search: "" };
    const m = await import(${JSON.stringify(new URL("../js/auth-admin.js", import.meta.url).href)});
    console.log(JSON.stringify({
      ecrit: m.ecritSelonLaCase("planning"), ecritAncienVrai: m.ecritSelonLaCase("planning", true), ecritDirection: m.ecritSelonLaCase("promos", true, ["direction"]),
      lit: m.litSelonLaCase("notes", false), litAncienVrai: m.litSelonLaCase("notes", true), definitif: m.gesteDefinitif(), cases: m.casesAffichees(),
    }));
    process.exit(0);
  `;
  const fichier = join(tmpdir(), "titres-vues-" + process.pid + ".mjs");
  writeFileSync(fichier, script);
  let sortie;
  try { sortie = execFileSync(process.execPath, [fichier], { encoding: "utf8", timeout: 60000 }); } finally { rmSync(fichier, { force: true }); }
  assert.deepEqual(JSON.parse(sortie.trim().split("\n").pop()),
    { ecrit: false, ecritAncienVrai: true, ecritDirection: true, lit: false, litAncienVrai: true, definitif: false, cases: null });
});
