import test from "node:test";
import assert from "node:assert/strict";
import { lignesQcmStagiaire, lignesQcmRedaction } from "../js/qcm-rules.js";

// Lot 2B, tâche 6 : la liste « Tes QCM » du stagiaire (sous-onglet QCM de Cours et QCM). Règles pures :
// quels QCM, dans quel ordre, avec quelle phrase d'état. L'affichage est mesuré au banc.

const NOW = Date.parse("2026-11-08T10:00:00Z");
const themes = [
  { id: 1, type: "theme", numero: 22, titre: "Feux du véhicule" },
  { id: 2, type: "theme", numero: 12, titre: "Intersections" },
  { id: 3, type: "theme", numero: 5, titre: "Les pneumatiques" },
  { id: 101, type: "notion", categorie: "QCM transversal", titre: "QCM des sanctions" },
  { id: 102, type: "notion", categorie: "QCM transversal", titre: "Psychologie du conducteur" },
];
const qcm = (id, theme_id, extra = {}) => ({ id, theme_id, titre: "QCM " + id, nb_questions: 10, published: false, exam_ferme_a: null, ...extra });
const essai = (qcm_id, note_20, finished_at, mode = "entrainement") => ({ qcm_id, mode, note_20, finished_at });
const ids = (lignes) => lignes.map((l) => l.qcm.id);

test("un QCM sans question n'est pas proposé", () => {
  const l = lignesQcmStagiaire({ qcm: [qcm(1, 1), qcm(2, 2, { nb_questions: 0 })], themes, tentatives: [], now: NOW });
  assert.deepEqual(ids(l), [1]);
});

test("la ligne : titre du thème numéroté, état « Pas encore fait », action « Ouvrir »", () => {
  const [l] = lignesQcmStagiaire({ qcm: [qcm(1, 1)], themes, tentatives: [], now: NOW });
  assert.equal(l.titre, "Thème 22 · Feux du véhicule");
  assert.equal(l.etat, "Pas encore fait");
  assert.equal(l.note, null);
  assert.equal(l.examenOuvert, false);
  assert.equal(l.action, "Ouvrir");
  assert.equal(l.theme.id, 1);
  assert.equal(l.etiquette, null);
});

test("l'état dit la DERNIÈRE note d'entraînement, pas la meilleure", () => {
  const tentatives = [
    essai(1, 18, "2026-10-01T10:00:00Z"),
    essai(1, 11, "2026-11-02T10:00:00Z"),
    essai(1, 15, "2026-10-20T10:00:00Z"),
  ];
  const [l] = lignesQcmStagiaire({ qcm: [qcm(1, 1)], themes, tentatives, now: NOW });
  assert.equal(l.note, 11);
  assert.equal(l.etat, "Dernière note 11/20");
});

test("la dernière tentative se lit sur finished_at, quel que soit l'ordre reçu", () => {
  const tentatives = [essai(1, 9, "2026-11-02T10:00:00Z"), essai(1, 17, "2026-09-02T10:00:00Z")];
  const [l] = lignesQcmStagiaire({ qcm: [qcm(1, 1)], themes, tentatives, now: NOW });
  assert.equal(l.note, 9);
});

test("une tentative d'examen ne fait pas la « dernière note » d'entraînement, ni celle d'un autre QCM", () => {
  const tentatives = [essai(1, 19, "2026-11-05T10:00:00Z", "examen"), essai(2, 14, "2026-11-05T10:00:00Z")];
  const [l] = lignesQcmStagiaire({ qcm: [qcm(1, 1)], themes, tentatives, now: NOW });
  assert.equal(l.etat, "Pas encore fait");
});

test("la note décimale s'écrit à la française, sans zéro inutile", () => {
  const [l] = lignesQcmStagiaire({ qcm: [qcm(1, 1)], themes, tentatives: [essai(1, 13.5, "2026-11-02T10:00:00Z")], now: NOW });
  assert.equal(l.etat, "Dernière note 13,5/20");
  const [m] = lignesQcmStagiaire({ qcm: [qcm(1, 1)], themes, tentatives: [essai(1, 14, "2026-11-02T10:00:00Z")], now: NOW });
  assert.equal(m.etat, "Dernière note 14/20");
});

test("un examen ouvert se lit par la règle de la fenêtre : publié et non échu", () => {
  const ouvert = qcm(1, 1, { published: true });
  const sansLimite = qcm(2, 2, { published: true, exam_ferme_a: null });
  const echu = qcm(3, 3, { published: true, exam_ferme_a: "2026-11-08T09:00:00Z" });
  const futur = qcm(4, 101, { published: true, exam_ferme_a: "2026-11-08T11:00:00Z" });
  const ferme = qcm(5, 102);
  const l = lignesQcmStagiaire({ qcm: [ouvert, sansLimite, echu, futur, ferme], themes, tentatives: [], now: NOW });
  const par = Object.fromEntries(l.map((x) => [x.qcm.id, x.examenOuvert]));
  assert.deepEqual(par, { 1: true, 2: true, 3: false, 4: true, 5: false });
});

test("l'ordre : examens ouverts, puis jamais faits, puis faits ; dans chaque groupe par numéro de thème", () => {
  const liste = [
    qcm(1, 1),                                  // thème 22, fait
    qcm(2, 2),                                  // thème 12, jamais fait
    qcm(3, 3),                                  // thème 5, fait
    qcm(4, 1, { published: true }),             // thème 22, examen ouvert
    qcm(5, 3, { published: true }),             // thème 5, examen ouvert
    qcm(6, 101),                                // transversal, jamais fait
    qcm(7, 2, { published: true }),             // thème 12, examen ouvert ET fait
  ];
  const tentatives = [essai(1, 10, "2026-11-01T10:00:00Z"), essai(3, 12, "2026-11-01T10:00:00Z"), essai(7, 16, "2026-11-01T10:00:00Z")];
  const l = lignesQcmStagiaire({ qcm: liste, themes, tentatives, now: NOW });
  assert.deepEqual(ids(l), [5, 7, 4, 2, 6, 3, 1]);
});

test("les QCM transversaux passent après les thèmes numérotés de leur groupe, par titre, et gardent l'étiquette", () => {
  const liste = [qcm(1, 102), qcm(2, 101), qcm(3, 1)];
  const l = lignesQcmStagiaire({ qcm: liste, themes, tentatives: [], now: NOW });
  assert.deepEqual(ids(l), [3, 1, 2], "Psychologie avant Sanctions (ordre alphabétique des titres)");
  assert.equal(l[0].etiquette, null);
  assert.equal(l[1].etiquette, "Transversal");
  assert.equal(l[1].titre, "Psychologie du conducteur");
});

test("un thème introuvable ne fait pas disparaître le QCM : il garde son propre titre", () => {
  const [l] = lignesQcmStagiaire({ qcm: [qcm(1, 999, { titre: "Ronds-points" })], themes, tentatives: [], now: NOW });
  assert.equal(l.theme, null);
  assert.equal(l.titre, "Ronds-points");
});

test("des entrées absentes ne font pas lever la règle", () => {
  assert.deepEqual(lignesQcmStagiaire(), []);
  assert.deepEqual(lignesQcmStagiaire({ qcm: [qcm(1, 1)] }).map((l) => l.etat), ["Pas encore fait"]);
});

// Lot 5, tâche 13 : la liste des QCM du siège, qui les rédige sans promo : ni note, ni examen, ni état d'entraînement.
test("siège : un QCM sans question reste proposé (on y écrit les questions), sans note ni examen", () => {
  const l = lignesQcmRedaction({ qcm: [qcm(1, 1, { nb_questions: 12, published: true, exam_ferme_a: null }), qcm(2, 2, { nb_questions: 0 })], themes });
  assert.deepEqual(ids(l).sort(), [1, 2]);
  const un = l.find((x) => x.qcm.id === 1);
  assert.equal(un.titre, "Thème 22 · Feux du véhicule");
  assert.equal(un.detail, "12 questions");
  assert.equal(un.action, "Modifier les questions");
  assert.equal("examenOuvert" in un, false);
  assert.equal("note" in un, false);
});

test("siège : singulier, vide, ordre par numéro de thème puis transversaux", () => {
  const l = lignesQcmRedaction({ qcm: [qcm(9, 101, { nb_questions: 1 }), qcm(1, 1), qcm(2, 2, { nb_questions: 0 }), qcm(3, 3)], themes });
  assert.deepEqual(ids(l), [3, 2, 1, 9]);
  assert.equal(l.find((x) => x.qcm.id === 9).detail, "1 question");
  assert.equal(l.find((x) => x.qcm.id === 2).detail, "Aucune question");
  assert.equal(l.find((x) => x.qcm.id === 9).etiquette, "Transversal");
  assert.deepEqual(lignesQcmRedaction({}), []);
});
