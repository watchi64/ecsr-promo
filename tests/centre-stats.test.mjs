// Calculs du tableau de bord du centre (spec 2026-10-23). Jeu fait à la main, attendus
// recalculés à la main dans les commentaires : un écart vient du module, pas du test.
// Lancer depuis la racine du dépôt : node tests/centre-stats.test.mjs
import assert from "node:assert/strict";
import {
  indicateursPromo, ligneComparaison, METHODES, COUT_ABANDON_ESTIME,
} from "../js/centre-stats.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const proche = (a, b, msg) => { assert.ok(Math.abs(a - b) < 1e-9, `${msg} : ${a} au lieu de ${b}`); n++; };

const REF = {
  qcm: [
    { id: 10, theme_id: 100, titre: "QCM Feux", exam_pass_20: 15 },
    { id: 11, theme_id: 101, titre: "QCM Vitesse", exam_pass_20: null },   // seuil par défaut 15
    { id: 12, theme_id: 102, titre: "QCM Alcool", exam_pass_20: 12 },
  ],
  themes: [
    { id: 100, numero: 1, titre: "Feux", type: "theme" },
    { id: 101, numero: 2, titre: "Vitesse", type: "theme" },
    { id: 102, numero: 3, titre: "Alcool", type: "theme" },
  ],
};

// 5 inscrits, dont E (5) en abandon : rien de E ne compte dans les résultats.
const STAG = [
  { id: 1, prenom: "Ana", nom: "A", actif: true, ordre: 1 },
  { id: 2, prenom: "Bob", nom: "B", actif: true, ordre: 2 },
  { id: 3, prenom: "Cid", nom: "C", actif: true, ordre: 3 },
  { id: 4, prenom: "Dan", nom: "D", actif: true, ordre: 4 },
  { id: 5, prenom: "Eve", nom: "E", actif: false, ordre: 5 },
];
const P = (stagiaire_id, type, resultat) => ({ stagiaire_id, type, resultat, date: "2026-10-01" });
const PASSAGES = [
  P(1, "Salle", "Effectué"), P(1, "Salle", "Effectué"), P(1, "Voiture", "Effectué"), P(1, "Voiture", "Effectué"),
  P(2, "Salle", "Effectué"), P(2, "Salle", "Absence"), P(2, "Voiture", "Absence"), P(2, "Voiture", "Effectué"),
  P(3, "Salle", "Bonus"), P(3, "Voiture", "Effectué"), P(3, "Voiture", "Effectué"), P(3, "Voiture", "Effectué"),
  P(5, "Salle", "Absence"),
];
const T = (stagiaire_id, qcm_id, mode, score, total, note_20, jour) =>
  ({ stagiaire_id, qcm_id, mode, score, total, note_20, finished_at: jour + "T10:00:00+00:00" });
const TENTATIVES = [
  T(1, 10, "entrainement", 15, 20, 15, "2026-10-20"),
  T(1, 11, "entrainement", 5, 10, 10, "2026-10-20"),
  T(2, 10, "entrainement", 10, 20, 10, "2026-10-01"),
  T(3, 11, "entrainement", 4, 10, 8, "2026-10-22"),
  T(3, 12, "entrainement", 9, 10, 18, "2026-10-22"),
  T(5, 12, "entrainement", 0, 10, 0, "2026-10-22"),
  T(1, 10, "examen", 16, 20, 16, "2026-10-21"),
  T(2, 11, "examen", 14, 20, 14, "2026-10-21"),
  T(3, 12, "examen", 12, 20, 12, "2026-10-21"),
  T(5, 10, "examen", 20, 20, 20, "2026-10-21"),
];
const E = (stagiaire_id, type, num, note, note_max, extra = {}) =>
  ({ stagiaire_id, type, theme_numero: type === "Thème" ? num : null, competence_code: type === "Compétence" ? num : null,
     note, note_max, date_eval: "2026-10-10", ...extra });
const EVALS = [
  E(1, "Thème", 1, 12, 20), E(1, "Thème", 2, 14, 20),
  E(2, "Thème", 1, 4, 20), E(2, "Thème", 2, 6, 20), E(2, "Thème", 3, 8, 20),
  E(3, "Thème", 1, 18, 20), E(3, "Compétence", "C1", 15, 20),
  E(4, "Thème", 2, 5, 10), E(4, "Thème", 3, null, 20), E(4, "Thème", 3, 5, 0),
  E(5, "Thème", 1, 0, 20),
];
const X = (id, stagiaire_id, trame, date_eval, scores, extra = {}) =>
  ({ id, stagiaire_id, trame, contexte: "EPCF", auto_eval: false, date_eval, scores, ...extra });
const EPCF = [
  X(1, 1, "salle", "2026-10-06", { a: "A", b: "R", c: "NA" }),
  X(2, 1, "salle", "2026-10-08", { a: "A", b: "A", c: "R" }),          // la plus récente de Ana
  X(3, 2, "salle", "2026-10-09", { a: "NA" }, { auto_eval: true }),     // auto-évaluation : ignorée
  X(4, 2, "vehicule", "2026-10-07", { x: "A", y: "NA" }),
  X(5, 3, "vehicule", "2026-10-07", { x: "A" }, { contexte: "Entraînement" }), // hors EPCF : ignorée
  X(6, 5, "salle", "2026-10-07", { a: "A" }),                           // abandon : ignorée
];

const D = { stagiaires: STAG, passages: PASSAGES, evaluations: EVALS, tentatives: TENTATIVES, epcf: EPCF };
const ind = indicateursPromo(D, REF, { aujourdhui: "2026-10-23" });

// Effectif et abandons : 5 inscrits, 4 en formation, 1 abandon, 1/5.
eq(ind.effectif.detail, { inscrits: 5, enFormation: 4, abandons: 1 }, "effectif");
eq(ind.effectif.valeur, 5, "effectif = inscrits");
proche(ind.abandon.valeur, 0.2, "taux d'abandon 1/5");
eq(ind.abandon.nature, "mesuré", "abandon mesuré");
eq(COUT_ABANDON_ESTIME, [3500, 5000], "hypothèse de coût");
eq(ind.valeurAbandons.valeur, [3500, 5000], "1 abandon x 3 500 à 5 000 €");
eq(ind.valeurAbandons.nature, "estimé", "valeur des abandons estimée");

// Absences : en formation, Absence = 2 (Bob) ; prévus = Effectué + Absence = 4 + 4 + 3 = 11.
eq(ind.absences.detail, { absences: 2, prevus: 11 }, "absences");
proche(ind.absences.valeur, 2 / 11, "taux d'absence 2/11");

// Passages réalisés (Effectué + Bonus) : salle 2,1,1,0 ; voiture 2,1,3,0.
eq(ind.passages.detail.salle, { total: 4, moyenne: 1, min: 0, max: 2 }, "salle");
eq(ind.passages.detail.voiture, { total: 6, moyenne: 1.5, min: 0, max: 3 }, "voiture");
proche(ind.passages.valeur, 2.5, "passages par stagiaire");

// QCM d'entraînement (en formation) : Ana 2, Bob 1, Cid 2 ; 70 questions, 43 bonnes.
eq(ind.activiteQcm.detail, { actifs: 3, enFormation: 4, tentatives: 5, questions: 70 }, "activité QCM");
proche(ind.activiteQcm.valeur, 0.75, "3 stagiaires sur 4");
eq(ind.reussiteQcm.detail, { bonnes: 43, questions: 70 }, "réussite QCM");
proche(ind.reussiteQcm.valeur, 43 / 70, "43/70");

// Examens QCM : 16 >= 15 oui, 14 >= 15 (défaut) non, 12 >= 12 oui ; moyenne 14.
eq(ind.examensQcm.detail, { passes: 3, reussis: 2, moyenne20: 14 }, "examens");
proche(ind.examensQcm.valeur, 2 / 3, "2 examens réussis sur 3");

// Notes (en formation, notées, barème non nul) : 12 14 4 6 8 18 15 10 → 87/8, médiane 11, 3 sous 10.
eq(ind.notes.detail.n, 8, "8 notes");
proche(ind.notes.valeur, 87 / 8, "moyenne des notes");
eq(ind.notes.detail.mediane, 11, "médiane");
eq(ind.notes.detail.sous10, 3, "3 notes sous 10");

// EPCF : salle = dernière EPCF de Ana (A A R) ; véhicule = Bob (A NA).
eq(ind.epcf.detail.salle, { evalues: 1, enFormation: 4, A: 2, R: 1, NA: 0, score: 5 / 6 }, "EPCF salle");
eq(ind.epcf.detail.vehicule, { evalues: 1, enFormation: 4, A: 1, R: 0, NA: 1, score: 0.5 }, "EPCF véhicule");
proche(ind.epcf.valeur, 3 / 5, "3 critères acquis sur 5");

eq(ind.titre.valeur, null, "titre non mesuré");
eq(ind.titre.nature, "non mesuré", "titre : nature");

// Thèmes. QCM : Feux 25/40, Vitesse 9/20, Alcool 9/10 (sous 20 réponses : hors liste).
eq(ind.themes.qcm.map((t) => [t.num, t.n]), [[2, 20], [1, 40]], "QCM : le plus faible d'abord, minimum 20");
proche(ind.themes.qcm[0].taux, 0.45, "Vitesse 9/20");
// Notes : Feux 12 4 18 (11,33), Vitesse 14 6 10 (10), Alcool 8 seul (hors liste).
eq(ind.themes.notes.map((t) => [t.num, t.n]), [[2, 3], [1, 3]], "notes : la plus faible d'abord, minimum 3");
proche(ind.themes.notes[0].moyenne, 10, "Vitesse 10/20");
eq(ind.themes.complet.map((t) => t.num), [1, 2, 3], "tableau complet par numéro");
eq(ind.themes.complet[2], { num: 3, titre: "Alcool", qcmTaux: 0.9, qcmN: 10, notesMoy: 8, notesN: 1 }, "Alcool complet");

// À suivre de près : Bob (absences 2, moyenne 6 sur 3 notes, pas d'entraînement depuis le 01/10)
// et Dan (jamais d'entraînement, voiture : objectif round(1,75) = 2, Dan 0, retard 2).
eq(ind.aSuivre.map((x) => [x.stagiaire.id, x.signaux.map((s) => s.code)]),
  [[2, ["absences", "notes", "inactivite"]], [4, ["inactivite", "retard"]]], "à suivre");
eq(ind.aSuivre[1].signaux.map((s) => s.texte),
  ["Aucun entraînement QCM", "Retard de passages : 2 tours en voiture"], "textes de Dan");
eq(ind.aSuivre[0].signaux[0].texte, "2 absences de dernière minute aux passages", "texte absences");
eq(ind.aSuivre[0].signaux[1].texte, "Moyenne des notes : 6,0/20 (3 notes)", "texte notes");
eq(ind.aSuivre[0].signaux[2].texte, "Aucun entraînement QCM depuis 14 jours", "texte inactivité");

// Chaque indicateur porte sa méthode et sa nature.
for (const cle of ["effectif", "abandon", "valeurAbandons", "absences", "passages", "activiteQcm",
  "reussiteQcm", "examensQcm", "notes", "epcf", "titre"]) {
  assert.ok(METHODES[cle] && ind[cle].methode === METHODES[cle], "méthode de " + cle); n++;
  assert.ok(["mesuré", "estimé", "non mesuré"].includes(ind[cle].nature), "nature de " + cle); n++;
}
assert.ok(!JSON.stringify(METHODES).includes(String.fromCharCode(0x2014)), "aucun tiret cadratin"); n++;

// Comparaison des promos : textes courts.
eq(ligneComparaison(ind), {
  effectif: "5 inscrits",
  abandon: "20 % (1)",
  absences: "18 %",
  passages: "2,5 par stagiaire",
  reussiteQcm: "61 %",
  examensQcm: "67 % (2/3)",
  notes: "10,9/20",
  epcf: "60 % acquis",
}, "ligne de comparaison");

// Promo vide (Montpellier) : aucune exception, aucune valeur inventée.
const vide = indicateursPromo({ stagiaires: [], passages: [], evaluations: [], tentatives: [], epcf: [] },
  REF, { aujourdhui: "2026-10-23" });
for (const cle of ["effectif", "abandon", "valeurAbandons", "absences", "passages", "activiteQcm",
  "reussiteQcm", "examensQcm", "notes", "epcf", "titre"]) {
  eq(cle === "effectif" ? vide[cle].valeur : vide[cle].valeur, cle === "effectif" ? 0 : null, "vide : " + cle);
}
eq(vide.aSuivre, [], "vide : personne à suivre");
eq(vide.themes, { qcm: [], notes: [], complet: [] }, "vide : aucun thème");
eq(Object.values(ligneComparaison(vide)).filter((v) => v === "aucune donnée").length, 7, "vide : 7 cases sans donnée");

// Stagiaires sans activité (promo qui commence) : effectif oui, résultats non.
const debut = indicateursPromo({ stagiaires: STAG.slice(0, 2), passages: [], evaluations: [], tentatives: [], epcf: [] },
  REF, { aujourdhui: "2026-10-23" });
proche(debut.abandon.valeur, 0, "aucun abandon");
eq(debut.reussiteQcm.valeur, null, "pas de réussite QCM sans question");
eq(debut.aSuivre, [], "personne : aucun signal sans activité de la promo");

// Promo endormie : toute l'activité QCM a plus de 14 jours → aucun signal d'inactivité.
const dort = indicateursPromo(D, REF, { aujourdhui: "2026-11-30" });
assert.ok(dort.aSuivre.every((x) => x.signaux.every((s) => s.code !== "inactivite")), "promo endormie"); n++;

console.log(`centre-stats : ${n} assertions OK`);
