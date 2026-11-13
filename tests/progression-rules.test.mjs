import test from "node:test";
import assert from "node:assert/strict";
import {
  SEUIL_ENTRAINEMENT, SEUIL_EXAMEN_DEFAUT, ETATS_PROGRESSION,
  dateExamen, etatProgression, bilanProgression, phraseBilan,
} from "../js/progression-rules.js";

// Progression du stagiaire sur la liste des thèmes (spec du 12/11/2026) : le résultat le plus récent décide.

const T = (s) => Date.parse(s);
const ex = (note, date) => ({ note, date: T(date) });

test("constantes et libellés", () => {
  assert.equal(SEUIL_ENTRAINEMENT, 12);
  assert.equal(SEUIL_EXAMEN_DEFAUT, 15);
  assert.deepEqual(ETATS_PROGRESSION.map((e) => e.libelle), ["Acquis", "À revoir", "En cours", "À commencer"]);
});

test("rien de fait : à commencer", () => {
  assert.equal(etatProgression({ seuil: 15, examen: null, entrainement: null }), "commencer");
});

test("examen seul : au seuil acquis, sous le seuil à revoir", () => {
  assert.equal(etatProgression({ seuil: 15, examen: ex(15, "2026-11-01T10:00"), entrainement: null }), "acquis");
  assert.equal(etatProgression({ seuil: 15, examen: ex(14.9, "2026-11-01T10:00"), entrainement: null }), "revoir");
});

test("seuil absent : 15 par défaut ; seuil propre au QCM respecté", () => {
  assert.equal(etatProgression({ seuil: null, examen: ex(14, "2026-11-01T10:00"), entrainement: null }), "revoir");
  assert.equal(etatProgression({ seuil: 12, examen: ex(13, "2026-11-01T10:00"), entrainement: null }), "acquis");
});

test("entraînement seul : sous 12 à revoir, à 12 ou plus en cours", () => {
  assert.equal(etatProgression({ seuil: 15, examen: null, entrainement: ex(11.9, "2026-11-01T10:00") }), "revoir");
  assert.equal(etatProgression({ seuil: 15, examen: null, entrainement: ex(12, "2026-11-01T10:00") }), "encours");
  assert.equal(etatProgression({ seuil: 15, examen: null, entrainement: ex(20, "2026-11-01T10:00") }), "encours");
});

test("le plus récent décide : entraînement faible après un examen réussi", () => {
  assert.equal(etatProgression({ seuil: 15, examen: ex(18.5, "2026-05-16T10:00"), entrainement: ex(11.6, "2026-06-01T10:00") }), "revoir");
});

test("le plus récent décide : entraînement faible avant un examen réussi", () => {
  assert.equal(etatProgression({ seuil: 15, examen: ex(18.5, "2026-06-01T10:00"), entrainement: ex(11.6, "2026-05-16T10:00") }), "acquis");
});

test("entraînement bon après un examen réussi : acquis", () => {
  assert.equal(etatProgression({ seuil: 15, examen: ex(16, "2026-05-16T10:00"), entrainement: ex(13, "2026-06-01T10:00") }), "acquis");
});

test("entraînement bon après un examen raté : en cours", () => {
  assert.equal(etatProgression({ seuil: 15, examen: ex(10, "2026-05-16T10:00"), entrainement: ex(17, "2026-06-01T10:00") }), "encours");
});

test("examen raté après un bon entraînement : à revoir", () => {
  assert.equal(etatProgression({ seuil: 15, examen: ex(10, "2026-06-01T10:00"), entrainement: ex(17, "2026-05-16T10:00") }), "revoir");
});

test("même instant : l'examen l'emporte", () => {
  assert.equal(etatProgression({ seuil: 15, examen: ex(18, "2026-06-01T10:00"), entrainement: ex(5, "2026-06-01T10:00") }), "acquis");
});

test("date d'examen absente : l'examen est réputé le plus ancien", () => {
  assert.equal(etatProgression({ seuil: 15, examen: { note: 18, date: null }, entrainement: ex(5, "2026-06-01T10:00") }), "revoir");
  assert.equal(etatProgression({ seuil: 15, examen: { note: 18, date: null }, entrainement: null }), "acquis");
});

test("dateExamen : la tentative si son jour n'est pas antérieur à la note de la matrice", () => {
  const tentative = { finished_at: "2026-05-16T09:30:00Z" };
  assert.equal(dateExamen(tentative, { date_eval: "2026-05-16" }), T("2026-05-16T09:30:00Z"));
  assert.equal(dateExamen(tentative, null), T("2026-05-16T09:30:00Z"));
});

test("dateExamen : note de matrice plus récente que la tentative, ou sans tentative : fin de journée", () => {
  assert.equal(dateExamen({ finished_at: "2026-05-10T09:30:00Z" }, { date_eval: "2026-05-16" }), T("2026-05-16T23:59:59"));
  assert.equal(dateExamen(null, { date_eval: "2026-05-16" }), T("2026-05-16T23:59:59"));
  assert.equal(dateExamen(null, null), null);
});

test("bilanProgression ignore les thèmes sans état", () => {
  assert.deepEqual(bilanProgression(["acquis", "revoir", null, "encours", "acquis", "commencer"]),
    { acquis: 2, revoir: 1, total: 5 });
  assert.deepEqual(bilanProgression([]), { acquis: 0, revoir: 0, total: 0 });
});

test("phraseBilan", () => {
  assert.equal(phraseBilan(0, 57), "Aucun thème acquis pour l'instant");
  assert.equal(phraseBilan(1, 57), "Tu as acquis 1 thème officiel sur 57");
  assert.equal(phraseBilan(12, 57), "Tu as acquis 12 thèmes officiels sur 57");
});
