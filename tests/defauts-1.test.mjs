import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fermerParEchap } from "../js/fenetre-echap.js";
import { messageLectureEnEchec } from "../js/qcm-rules.js";
import { coursAUnTexte, MESSAGE_COURS_VIDE } from "../js/cours-rules.js";

// Premier lot de défauts du robot des parcours (09/11/2026) : Échap dans la fenêtre du QCM, lecture en échec de
// Cours et QCM, cours sans texte.

function documentFactice() {
  const ecouteurs = [];
  return {
    addEventListener(type, f) { if (type === "keydown") ecouteurs.push(f); },
    removeEventListener(type, f) { const i = ecouteurs.indexOf(f); if (i >= 0) ecouteurs.splice(i, 1); },
    touche(key) {
      const e = { key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      for (const f of [...ecouteurs]) f(e);
      return e;
    },
    nb: () => ecouteurs.length,
  };
}

test("Échap ferme la fenêtre du QCM par l'action de sa croix", () => {
  const doc = documentFactice();
  let appels = 0;
  fermerParEchap({ isConnected: true }, () => { appels++; }, doc);
  const e = doc.touche("Escape");
  assert.equal(appels, 1);
  assert.equal(e.defaultPrevented, true);
});

test("une autre touche ne ferme rien", () => {
  const doc = documentFactice();
  let appels = 0;
  fermerParEchap({ isConnected: true }, () => { appels++; }, doc);
  doc.touche("Enter");
  assert.equal(appels, 0);
});

test("une fenêtre déjà fermée n'écoute plus Échap", () => {
  const doc = documentFactice();
  let appels = 0;
  const fenetre = { isConnected: true };
  fermerParEchap(fenetre, () => { appels++; }, doc);
  fenetre.isConnected = false;
  doc.touche("Escape");
  assert.equal(appels, 0);
  assert.equal(doc.nb(), 0);
});

test("les fenêtres du QCM branchent Échap sur leur fermeture (entraînement, examen, écrans d'examen)", () => {
  const src = readFileSync("js/views/qcm.js", "utf8");
  assert.match(src, /fermerParEchap\(overlay, close\);\s*\n\s*\n\s*const numPrefix/);   // entraînement
  assert.match(src, /fermerParEchap\(overlay, requestClose\)/);                         // examen : avec confirmation
  assert.match(src, /if \(dismissible\) \{[\s\S]{0,250}fermerParEchap\(overlay, close\)/);     // pré-écran et « déjà passé »
});

test("lecture en échec : un message précis selon ce qui n'a pas pu être lu", () => {
  assert.equal(messageLectureEnEchec({ qcm: true }), "QCM non chargés. Vérifie ta connexion.");
  assert.equal(messageLectureEnEchec({ cours: true }), "Cours non chargés. Vérifie ta connexion.");
  assert.equal(messageLectureEnEchec({ cours: true, qcm: true }), "Cours et QCM non chargés. Vérifie ta connexion.");
});

test("aucune lecture en échec : pas de message (le cas « aucun QCM » garde son affichage)", () => {
  assert.equal(messageLectureEnEchec({}), null);
  assert.equal(messageLectureEnEchec(), null);
});

test("la liste des thèmes affiche le bandeau « Réessayer » quand une lecture a échoué", () => {
  const src = readFileSync("js/views/themes.js", "utf8");
  assert.match(src, /echecQcm = true/);
  assert.match(src, /echecCours = true/);
  assert.match(src, /"Réessayer"/);
  assert.match(src, /const echec = bandeauLectureEnEchec\(\);/);
});

test("un cours sans texte (absent, nul, blanc) est reconnu", () => {
  assert.equal(coursAUnTexte({ corps_md: undefined }), false);
  assert.equal(coursAUnTexte({ corps_md: null }), false);
  assert.equal(coursAUnTexte({ corps_md: "  \n " }), false);
  assert.equal(coursAUnTexte(null), false);
  assert.equal(coursAUnTexte({ corps_md: "# THÈME 1 - Titre" }), true);
  assert.equal(MESSAGE_COURS_VIDE, "Ce cours n'a pas encore de contenu.");
});

test("le lecteur n'affiche plus le texte brut d'un corps absent", () => {
  const src = readFileSync("js/views/cours-reader.js", "utf8");
  assert.match(src, /const texte = vide \? MESSAGE_COURS_VIDE : cours\.corps_md;/);
});

test("lireToutes attend les lectures lentes même quand une autre échoue vite", async () => {
  const { lireToutes } = await import("../js/qcm-rules.js");
  const echoue = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("panne")), ms));
  const r = await lireToutes({ list: echoue(1), cours: echoue(40), evals: Promise.resolve([1]) });
  assert.deepEqual(r.echecs.sort(), ["cours", "list"]);
  assert.deepEqual(r.valeurs, { evals: [1] });
});

test("sans échec, lireToutes rend toutes les valeurs", async () => {
  const { lireToutes } = await import("../js/qcm-rules.js");
  const r = await lireToutes({ a: Promise.resolve(1), b: Promise.resolve(2) });
  assert.deepEqual(r.echecs, []);
  assert.deepEqual(r.valeurs, { a: 1, b: 2 });
});
