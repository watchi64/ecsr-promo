// Page Qualiopi, section « Questionnaires de satisfaction » (plan Q3, tâche 6) : ce que le code de la page, de js/db.js et de la
// feuille de style doit garantir et qu'aucun test de règle ne voit. Les règles elles-mêmes sont dans
// tests/questionnaires-gestion-rules.test.mjs ; le rendu se contrôle au banc. Lancer : node --test tests/qualiopi-questionnaires-page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const vue = lire("js/views/qualiopi.js");
const codeVue = sansCommentaires(vue);
const db = lire("js/db.js");
const css = sansCommentaires(lire("css/qualiopi.css"));
const jeton = lire("index.html").match(/js\/main\.js\?v=(\w+)/)[1];

test("la page prend les lectures et l'ouverture de js/db.js, et ses règles du module pur, au jeton de l'app", () => {
  for (const nom of ["lireResultatsQuestionnaire", "lireCommentairesQuestionnaire", "lireOuverturesQuestionnaires", "ouvrirQuestionnaire"]) {
    assert.match(vue, new RegExp(`import \\{[^}]*\\b${nom}\\b[^}]*\\} from "\\.\\./db\\.js\\?v=${jeton}";`), nom);
  }
  assert.match(vue, new RegExp(`\\} from "\\.\\./questionnaires-gestion-rules\\.js\\?v=${jeton}";`));
  const regles = lire("js/questionnaires-gestion-rules.js");
  const imports = [...regles.matchAll(/from "(\.\.?\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(imports.length === 3 && imports.every((a) => a.endsWith(`.js?v=${jeton}`)), "le module pur importe au jeton de l'app");
  assert.ok(!/document\.|window\.|fetch\(|new Date\(/.test(sansCommentaires(regles)), "le module de règles est pur");
});

test("la section se place entre les documents et les critères, et se lit sans retenir la page", () => {
  assert.match(codeVue, /corps\.append\(construireActions\(\), zoneQuestionnaires, zoneCriteres\);/);
  assert.match(codeVue, /chargerQuestionnaires\(promo\);\s+try \{/, "lancée sans attendre, avant la lecture de la promo");
  assert.match(codeVue, /if \(moi !== lectureQq \|\| !pageVivante\(\) \|\| etat\.promo !== promo\) return;/, "une lecture caduque n'écrit rien");
});

test("commentaires : lus à partir du seuil seulement, jamais avec « Sans aucun nom », jamais imprimés", () => {
  const appels = codeVue.match(/lireCommentairesQuestionnaire\(/g) || [];
  assert.equal(appels.length, 1, "un seul appel");
  assert.match(codeVue, /resumeReponses\(cle, resultats\)\.assez \? await lireCommentairesQuestionnaire\(cle, portee\) : \[\]/);
  const carte = codeVue.slice(codeVue.indexOf("function carteQuestionnaire("), codeVue.indexOf("function afficherQuestionnaires("));
  const garde = carte.indexOf("if (etat.sansNoms) {");
  assert.ok(garde > 0 && carte.indexOf("commentairesMontrables(", garde) > garde, "les commentaires sont montés derrière la garde de la case");
  assert.match(carte, /commentairesMontrables\(carte\.commentaires, \{ sansNoms: etat\.sansNoms, assez: resume\.assez \}\)/);
  assert.match(codeVue, /caseSansNom\.addEventListener\("change", \(\) => \{ if \(qq\.lu\?\.cartes\) afficherQuestionnaires\(\); \}\);/, "la case redessine la section");
  assert.match(css, /@media print \{\s*\.qualiopi-commentaires \{ display: none !important; \}/, "cachés à l'impression du navigateur");
  for (const fichier of ["js/qualiopi-documents.js", "js/qualiopi-resultats.js", "js/qualiopi-preuves.js"]) {
    assert.ok(!/commentairesQuestionnaire|lireCommentaires|questionnaires-gestion/.test(lire(fichier)), `${fichier} : aucun commentaire de questionnaire dans les documents ni le CSV`);
  }
  const documents = codeVue.slice(codeVue.indexOf("function tableauImprimable("), codeVue.indexOf("function pastilleNiveau("));
  assert.ok(!/commentaire/i.test(documents), "la mise en page des documents imprimables ne connaît pas les commentaires");
});

test("ouverture : les trois états, et un retour au clavier après l'action", () => {
  assert.match(codeVue, /await ouvrirQuestionnaire\(cle, portee, valeur\);/);
  assert.match(codeVue, /actionsOuverture\(etatO\)\.map\(/);
  assert.match(codeVue, /await chargerQuestionnaires\(promo, `button\[data-cle="\$\{cle\}"\]`\);/, "le focus revient au bouton de la carte");
  assert.match(codeVue, /if \(focus\) zoneQuestionnaires\.querySelector\(focus\)\?\.focus\(\);/);
  assert.match(codeVue, /messageEchecOuverture\(e\)/);
});

test("migration absente : la section le dit sans erreur ; une lecture qui échoue dit « lus », pas « envoi »", () => {
  assert.match(codeVue, /"Les questionnaires ne sont pas encore en service\."/);
  assert.match(codeVue, /lu = \{ erreur: messageLectureGestion\(e\) \};/);
  const fonction = db.slice(db.indexOf("export async function lireOuverturesQuestionnaires()"), db.indexOf("export async function ouvrirQuestionnaire("));
  assert.match(fonction, /\.from\("questionnaire_ouvertures"\)\.select\("cle, promo_id, lieu_id, annee, ouvert"\)/);
  assert.match(fonction, /PGRST205/);
  assert.match(fonction, /return null;/);
  assert.ok(!/L'envoi n'a pas abouti/.test(fonction));
});

test("feuille de style : cibles de 44 px, pas de rouge, pas de défilement de côté", () => {
  assert.match(css, /\.qq-details > summary \{[^}]*min-height: 44px/);
  assert.match(css, /\.qualiopi \.btn \{[^}]*min-height: 44px/, "les boutons des cartes sont des .btn de la page");
  assert.ok(!/--c-stop|\bred\b/.test(css));
  assert.ok(!/overflow(-x)?\s*:\s*(auto|scroll)/.test(css));
});

test("aucun tiret cadratin, « formateur » jamais « prof »", () => {
  for (const fichier of ["js/views/qualiopi.js", "js/questionnaires-gestion-rules.js", "css/qualiopi.css", "js/db.js",
    "tests/qualiopi-questionnaires-page.test.mjs", "tests/questionnaires-gestion-rules.test.mjs"]) {
    assert.ok(!lire(fichier).includes(String.fromCharCode(0x2014)), fichier);
  }
  for (const fichier of ["js/questionnaires-gestion-rules.js"]) {
    assert.ok(!/\bprof\b/i.test(lire(fichier)), fichier);
  }
});
