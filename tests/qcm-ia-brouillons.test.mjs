import test from "node:test";
import assert from "node:assert/strict";
import {
  articlesCites, titresDuCours, extrairePartie, construireMessages, analyserReponse,
} from "../supabase/functions/qcm-ia/brouillons.mjs";

const COURS = [
  "# THÈME 12 - Vitesse",
  "",
  "> **L'essentiel en 6 lignes**",
  "> 50 km/h en agglomération.",
  "",
  "## 1. Définition / Introduction",
  "",
  "La vitesse se règle selon le lieu et les conditions.",
  "",
  "## 2. Contenu du cours",
  "",
  "### A. Les limitations générales",
  "",
  "En agglomération, la vitesse maximale est de 50 km/h. Sur autoroute, 130 km/h.",
  "",
  "_Textes : R413-2, R413-3_",
  "",
  "### B. Intempéries et visibilité",
  "",
  "Sous 50 m de visibilité, 50 km/h partout.",
  "",
  "_Textes : R. 413-4_",
  "",
  "## 3. Risques / Comportements / Sanctions",
  "",
  "| Infraction | Article | Amende |",
  "| Excès de 20 km/h | R413-14 | 135 € |",
  "| Homicide involontaire | article 221-6 du Code pénal | |",
].join("\n");

function brouillon(extra = {}) {
  return {
    section: "Les limitations générales",
    enonce: "Quelle est la vitesse maximale en agglomération ?",
    options: [
      { texte: "50 km/h", correcte: true },
      { texte: "70 km/h", correcte: false },
      { texte: "30 km/h", correcte: false },
      { texte: "80 km/h", correcte: false },
      { texte: "90 km/h", correcte: false },
    ],
    explication: "50 km/h en agglomération (R413-3).",
    partie_cours: "A. Les limitations générales",
    ...extra,
  };
}

function contexte() {
  return {
    articlesCours: articlesCites(COURS),
    titres: titresDuCours(COURS).map((t) => t.titre),
    existants: ["En cas de pluie, quelle vitesse sur autoroute ?"],
  };
}

test("articlesCites : formes avec lettre, point, espace, et sans lettre", () => {
  assert.deepEqual(
    articlesCites("Voir R413-3, R. 413-4, L.234-1, l'article 221-6 et D 221-10-1."),
    ["R413-3", "R413-4", "L234-1", "221-6", "D221-10-1"],
  );
});

test("articlesCites : ignore les années, les vitesses et les identifiants Légifrance", () => {
  assert.deepEqual(articlesCites("Bilan 2024-2025, 50 km/h, LEGIARTI000006842030, 1-2 s."), []);
});

test("articlesCites : le cours d'essai porte ses cinq articles", () => {
  assert.deepEqual(articlesCites(COURS).sort(), ["221-6", "R413-14", "R413-2", "R413-3", "R413-4"]);
});

test("titresDuCours : niveaux 2 et 3, dans l'ordre", () => {
  assert.deepEqual(titresDuCours(COURS), [
    { niveau: 2, titre: "1. Définition / Introduction" },
    { niveau: 2, titre: "2. Contenu du cours" },
    { niveau: 3, titre: "A. Les limitations générales" },
    { niveau: 3, titre: "B. Intempéries et visibilité" },
    { niveau: 2, titre: "3. Risques / Comportements / Sanctions" },
  ]);
});

test("extrairePartie : une sous-partie s'arrête au titre suivant de même niveau", () => {
  const p = extrairePartie(COURS, "A. Les limitations générales");
  assert.match(p, /^### A\. Les limitations générales/);
  assert.match(p, /130 km\/h/);
  assert.doesNotMatch(p, /Intempéries/);
});

test("extrairePartie : une partie de niveau 2 garde ses sous-parties", () => {
  const p = extrairePartie(COURS, "2. Contenu du cours");
  assert.match(p, /Intempéries/);
  assert.doesNotMatch(p, /Sanctions/);
});

test("extrairePartie : titre inconnu ou vide = cours entier", () => {
  assert.equal(extrairePartie(COURS, ""), COURS);
  assert.equal(extrairePartie(COURS, "Z. Inexistant"), COURS);
});

test("construireMessages : le cours et les énoncés existants partent, rien d'autre", () => {
  const msgs = construireMessages({
    titreTheme: "12 · Vitesse", coursMd: COURS, partie: "", nombre: 3,
    existants: ["Question déjà là ?"], sections: ["Les limitations générales"],
  });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].content, /numéro d'article/i);
  assert.match(msgs[1].content, /Question déjà là \?/);
  assert.match(msgs[1].content, /130 km\/h/);
  assert.match(msgs[1].content, /3 questions/);
  assert.doesNotMatch(msgs[0].content + msgs[1].content, /\u2014/);
});

test("construireMessages : une partie visée réduit le cours envoyé à cette partie", () => {
  const msgs = construireMessages({
    titreTheme: "12 · Vitesse", coursMd: COURS, partie: "B. Intempéries et visibilité", nombre: 1,
    existants: [], sections: [],
  });
  assert.match(msgs[1].content, /Sous 50 m/);
  assert.doesNotMatch(msgs[1].content, /130 km\/h/);
});

test("analyserReponse : un brouillon conforme passe, au format de la banque", () => {
  const r = analyserReponse(JSON.stringify({ questions: [brouillon()] }), contexte());
  assert.equal(r.ecartes.length, 0);
  assert.equal(r.brouillons.length, 1);
  const b = r.brouillons[0];
  assert.equal(b.enonce, "Quelle est la vitesse maximale en agglomération ?");
  assert.equal(b.options.length, 5);
  assert.deepEqual(b.options[0], { texte: "50 km/h", is_correct: true });
  assert.equal(b.partie_cours, "A. Les limitations générales");
  assert.match(b.explication, /Voir le cours : « A\. Les limitations générales »\.$/);
});

test("RÈGLE D'OR : un article absent du cours fait écarter le brouillon", () => {
  const faux = brouillon({ explication: "50 km/h, voir l'article R413-99 du Code de la route." });
  const r = analyserReponse(JSON.stringify({ questions: [faux, brouillon({ enonce: "Vitesse sur autoroute par temps sec ?" })] }), contexte());
  assert.equal(r.brouillons.length, 1);
  assert.equal(r.brouillons[0].enonce, "Vitesse sur autoroute par temps sec ?");
  assert.equal(r.ecartes.length, 1);
  assert.equal(r.ecartes[0].motif, "cite R413-99, absent du cours");
  assert.equal(r.ecartes[0].enonce, faux.enonce);
});

test("RÈGLE D'OR : l'article peut se cacher dans une option ou l'énoncé", () => {
  const dansOption = brouillon();
  dansOption.options[1] = { texte: "Article L. 999-1", correcte: false };
  const dansEnonce = brouillon({ enonce: "Que prévoit l'article 222-19 du Code pénal ?" });
  const r = analyserReponse(JSON.stringify({ questions: [dansOption, dansEnonce] }), contexte());
  assert.equal(r.brouillons.length, 0);
  assert.deepEqual(r.ecartes.map((e) => e.motif), [
    "cite L999-1, absent du cours",
    "cite 222-19, absent du cours",
  ]);
});

test("RÈGLE D'OR : un article présent dans le cours, même écrit autrement, est accepté", () => {
  const r = analyserReponse(JSON.stringify({ questions: [brouillon({ explication: "Voir R. 413-4 et l'article 221-6." })] }), contexte());
  assert.equal(r.ecartes.length, 0);
  assert.equal(r.brouillons.length, 1);
});

test("analyserReponse : structure invalide écartée avec un motif lisible", () => {
  const sansBonne = brouillon({ options: brouillon().options.map((o) => ({ ...o, correcte: false })) });
  const toutBon = brouillon({ enonce: "Tout est juste ?", options: brouillon().options.map((o) => ({ ...o, correcte: true })) });
  const deuxOptions = brouillon({ enonce: "Deux options ?", options: brouillon().options.slice(0, 2) });
  const doublonOpt = brouillon({ enonce: "Doublon ?", options: [
    { texte: "50 km/h", correcte: true }, { texte: "50 KM/H", correcte: false }, { texte: "70 km/h", correcte: false },
  ] });
  const r = analyserReponse(JSON.stringify({ questions: [sansBonne, toutBon, deuxOptions, doublonOpt, { enonce: "" }] }), contexte());
  assert.equal(r.brouillons.length, 0);
  assert.deepEqual(r.ecartes.map((e) => e.motif), [
    "aucune bonne réponse",
    "aucune mauvaise réponse",
    "moins de 3 réponses",
    "deux réponses identiques",
    "énoncé vide",
  ]);
});

test("analyserReponse : doublon d'une question existante écarté", () => {
  const r = analyserReponse(JSON.stringify({ questions: [brouillon({ enonce: "En cas de pluie, quelle vitesse sur autoroute ?" })] }), contexte());
  assert.equal(r.brouillons.length, 0);
  assert.equal(r.ecartes[0].motif, "doublon d'une question existante");
});

test("analyserReponse : tiret cadratin remplacé partout", () => {
  const b = brouillon({ enonce: "Vitesse \u2014 en agglomération ?", explication: "50 km/h \u2014 règle générale." });
  b.options[0].texte = "\u2014 50 km/h";
  const r = analyserReponse(JSON.stringify({ questions: [b] }), contexte());
  const tout = JSON.stringify(r.brouillons);
  assert.doesNotMatch(tout, /\u2014/);
  assert.equal(r.brouillons[0].enonce, "Vitesse : en agglomération ?");
  assert.equal(r.brouillons[0].options[0].texte, "50 km/h");
});

test("analyserReponse : renvoi au cours inconnu retiré, brouillon gardé", () => {
  const r = analyserReponse(JSON.stringify({ questions: [brouillon({ partie_cours: "Z. Partie inventée" })] }), contexte());
  assert.equal(r.brouillons.length, 1);
  assert.equal(r.brouillons[0].partie_cours, null);
  assert.doesNotMatch(r.brouillons[0].explication, /Voir le cours/);
});

test("analyserReponse : réponse illisible = aucune question, une erreur claire", () => {
  assert.throws(() => analyserReponse("pas du json", contexte()), /illisible/);
  assert.throws(() => analyserReponse(JSON.stringify({ autre: 1 }), contexte()), /illisible/);
});

test("analyserReponse : au plus `nombre` brouillons gardés", () => {
  const qs = [1, 2, 3, 4].map((i) => brouillon({ enonce: `Question numéro ${i} sur la vitesse ?` }));
  const r = analyserReponse(JSON.stringify({ questions: qs }), { ...contexte(), nombre: 2 });
  assert.equal(r.brouillons.length, 2);
});
