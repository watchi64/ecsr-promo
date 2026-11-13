import { test } from "node:test";
import assert from "node:assert/strict";
import { ficheAutonomie, autonomieVisible, jourSansAnnee, jourAvecSemaine } from "../js/autonomie-rules.js";
import { partiesDeLaFiche } from "../js/route-rules.js";

const COURS = [
  { id: 1, titre: "Signalisation", published: true },
  { id: 2, titre: "Vitesse", published: true },
  { id: 3, titre: "Priorités", published: true },
  { id: 9, titre: "Brouillon", published: false },
];
const AUJ = "2026-11-12"; // jeudi

const base = (extra = {}) => ({ lectures: [], temps: [], entrainements: [], cours: COURS, aujourdhui: AUJ, soi: true, ...extra });

test("dates courtes : sans l'année de la date du jour, avec sinon", () => {
  assert.equal(jourSansAnnee("2026-11-10T09:00:00Z", AUJ), "10 novembre");
  assert.equal(jourSansAnnee("2026-11-01T09:00:00Z", AUJ), "1er novembre");
  assert.equal(jourSansAnnee("2025-12-30T09:00:00Z", AUJ), "30 décembre 2025");
  assert.equal(jourSansAnnee(null, AUJ), "");
  assert.equal(jourSansAnnee("pas une date", AUJ), "");
});

test("la date d'un instant est celle de Paris", () => {
  // 23 h 30 UTC le 9 novembre = 0 h 30 à Paris le 10
  assert.equal(jourSansAnnee("2026-11-09T23:30:00Z", AUJ), "10 novembre");
});

test("dernière activité avec le jour de la semaine", () => {
  assert.equal(jourAvecSemaine("2026-11-10T09:00:00Z", AUJ), "mardi 10 novembre");
  assert.equal(jourAvecSemaine("2026-11-01T09:00:00Z", AUJ), "dimanche 1er novembre");
});

test("aucune trace : état vide, tu pour le stagiaire", () => {
  const f = ficheAutonomie(base());
  assert.equal(f.vide, true);
  assert.equal(f.texteVide, "Rien pour l'instant. Les cours que tu lis et tes entraînements apparaîtront ici.");
  assert.equal(f.note, "Ton formateur voit exactement cette page.");
  assert.deepEqual(f.lignes, []);
});

test("aucune trace : état vide, vous pour l'équipe, sans note", () => {
  const f = ficheAutonomie(base({ soi: false }));
  assert.equal(f.vide, true);
  assert.equal(f.texteVide, "Rien pour l'instant. Les cours lus et les entraînements de ce stagiaire apparaîtront ici.");
  assert.equal(f.note, null);
});

test("cinq repères dans l'ordre, avec les libellés exacts", () => {
  const f = ficheAutonomie(base({
    lectures: [
      { cours_id: 1, ouvert_le: "2026-11-08T08:00:00Z", vu_le: "2026-11-08T08:05:00Z", lu_le: "2026-11-10T09:00:00Z" },
      { cours_id: 2, ouvert_le: "2026-11-08T10:00:00Z", vu_le: null, lu_le: null },
    ],
    temps: [
      { jour: "2026-11-09", genre: "cours", ressource: "1", secondes: 3000 },
      { jour: "2026-11-10", genre: "qcm", ressource: "4", secondes: 900 },
      { jour: "2026-11-02", genre: "cours", ressource: "1", secondes: 3600 },
    ],
    entrainements: [
      { mode: "entrainement", finished_at: "2026-11-10T09:30:00Z" },
      { mode: "entrainement", finished_at: "2026-11-09T09:30:00Z" },
      { mode: "examen", finished_at: "2026-11-11T09:30:00Z" },
    ],
  }));
  assert.equal(f.vide, false);
  assert.deepEqual(f.reperes, [
    "Cours lus : 1 sur 3",
    "Temps cette semaine : 1 h 05",
    "Temps depuis le début : 2 h 05",
    "Entraînements QCM : 2",
    "Dernière activité : mardi 10 novembre",
  ]);
});

test("l'examen ne compte jamais, ni dans les entraînements ni dans la dernière activité", () => {
  const f = ficheAutonomie(base({ entrainements: [{ mode: "examen", finished_at: "2026-11-11T09:30:00Z" }] }));
  assert.equal(f.reperes[3], "Entraînements QCM : 0");
  assert.equal(f.reperes[4], "Dernière activité : aucune");
  assert.equal(f.vide, true);
});

test("une tentative sans fin n'est pas comptée", () => {
  const f = ficheAutonomie(base({ entrainements: [{ mode: "entrainement", finished_at: null }] }));
  assert.equal(f.reperes[3], "Entraînements QCM : 0");
});

test("du temps sans autre trace : repères affichés, dernière activité aucune", () => {
  const f = ficheAutonomie(base({ temps: [{ jour: "2026-11-11", genre: "cours", ressource: "1", secondes: 60 }] }));
  assert.equal(f.vide, false);
  assert.equal(f.reperes[1], "Temps cette semaine : 1 min");
  assert.equal(f.reperes[4], "Dernière activité : aucune");
});

test("liste : lus et commencés, du plus récent au plus ancien", () => {
  const f = ficheAutonomie(base({
    lectures: [
      { cours_id: 2, ouvert_le: "2026-11-08T10:00:00Z", vu_le: null, lu_le: null },
      { cours_id: 1, ouvert_le: "2026-11-05T08:00:00Z", vu_le: "2026-11-05T08:05:00Z", lu_le: "2026-11-10T09:00:00Z" },
      { cours_id: 3, ouvert_le: "2026-11-06T08:00:00Z", vu_le: null, lu_le: "2026-11-06T09:00:00Z" },
    ],
  }));
  assert.deepEqual(f.lignes.map((l) => [l.titre, l.texte]), [
    ["Signalisation", "Lu le 10 novembre"],
    ["Vitesse", "Commencé le 8 novembre"],
    ["Priorités", "Lu le 6 novembre"],
  ]);
});

test("un cours non publié ou inconnu n'est ni listé ni compté", () => {
  const f = ficheAutonomie(base({
    lectures: [
      { cours_id: 9, ouvert_le: "2026-11-08T10:00:00Z", lu_le: "2026-11-09T10:00:00Z" },
      { cours_id: 77, ouvert_le: "2026-11-08T10:00:00Z", lu_le: "2026-11-09T10:00:00Z" },
    ],
  }));
  assert.deepEqual(f.lignes, []);
  assert.equal(f.reperes[0], "Cours lus : 0 sur 3");
});

test("une lecture par cours : la lue l'emporte sur la commencée", () => {
  const f = ficheAutonomie(base({
    lectures: [
      { cours_id: 1, ouvert_le: "2026-11-08T10:00:00Z", lu_le: null },
      { cours_id: 1, ouvert_le: "2026-11-05T10:00:00Z", lu_le: "2026-11-06T10:00:00Z" },
    ],
  }));
  assert.deepEqual(f.lignes.map((l) => l.texte), ["Lu le 6 novembre"]);
});

test("égalité de date : ordre alphabétique, stable", () => {
  const f = ficheAutonomie(base({
    lectures: [
      { cours_id: 2, ouvert_le: "2026-11-08T10:00:00Z", lu_le: null },
      { cours_id: 1, ouvert_le: "2026-11-08T10:00:00Z", lu_le: null },
    ],
  }));
  assert.deepEqual(f.lignes.map((l) => l.titre), ["Signalisation", "Vitesse"]);
});

test("lecture sans aucune date : « Commencé » seul, en fin de liste", () => {
  const f = ficheAutonomie(base({
    lectures: [
      { cours_id: 1, ouvert_le: null, vu_le: null, lu_le: null },
      { cours_id: 2, ouvert_le: "2026-11-08T10:00:00Z", lu_le: null },
    ],
  }));
  assert.deepEqual(f.lignes.map((l) => l.texte), ["Commencé le 8 novembre", "Commencé"]);
});

test("entrées absentes : pas d'exception", () => {
  const f = ficheAutonomie({ aujourdhui: AUJ, soi: false });
  assert.equal(f.vide, true);
  assert.equal(f.reperes.length, 5);
  assert.equal(f.reperes[0], "Cours lus : 0 sur 0");
});

test("le modèle ne porte rien d'autre que cinq repères, la liste, la note et le texte vide", () => {
  assert.deepEqual(Object.keys(ficheAutonomie(base())).sort(), ["lignes", "note", "reperes", "texteVide", "vide"]);
});

test("même contenu pour le stagiaire et l'équipe, hors note et texte vide", () => {
  const donnees = {
    lectures: [{ cours_id: 1, ouvert_le: "2026-11-08T10:00:00Z", lu_le: "2026-11-09T10:00:00Z" }],
    temps: [{ jour: "2026-11-10", genre: "cours", ressource: "1", secondes: 600 }],
    entrainements: [{ mode: "entrainement", finished_at: "2026-11-10T09:30:00Z" }],
  };
  const a = ficheAutonomie(base({ ...donnees, soi: true }));
  const b = ficheAutonomie(base({ ...donnees, soi: false }));
  assert.deepEqual(a.reperes, b.reperes);
  assert.deepEqual(a.lignes, b.lignes);
});

test("qui voit la partie", () => {
  const v = (o) => autonomieVisible({ actif: true, soi: false, peutTracer: false, litNotes: false, espace: "equipe", ...o });
  assert.equal(v({ actif: false, soi: true, peutTracer: true }), false, "interrupteur éteint");
  assert.equal(v({ soi: true, peutTracer: true, espace: "stagiaire" }), true, "stagiaire réel");
  assert.equal(v({ soi: true, peutTracer: false, espace: "stagiaire" }), false, "aperçu stagiaire du fondateur");
  assert.equal(v({ soi: false, litNotes: true }), true, "équipe qui lit les notes");
  assert.equal(v({ soi: false, litNotes: true, espace: "direction" }), true, "direction");
  assert.equal(v({ soi: false, litNotes: false }), false, "équipe sans le droit");
  assert.equal(v({ soi: false, litNotes: true, espace: "siege" }), false, "jamais le siège");
  assert.equal(v({ soi: true, peutTracer: true, litNotes: true }), true, "stagiaire : la condition de la trace");
});

test("liste des parties : identique interrupteur éteint, partie ajoutée allumé", () => {
  assert.deepEqual(partiesDeLaFiche({ soi: true }), ["resultats", "passages", "epcf", "livret", "dp"]);
  assert.deepEqual(partiesDeLaFiche({ soi: true, autonomie: false }), ["resultats", "passages", "epcf", "livret", "dp"]);
  assert.deepEqual(partiesDeLaFiche({ soi: false, autonomie: false }), ["passages", "epcf", "evolution", "livret", "dp"]);
  assert.deepEqual(partiesDeLaFiche({ soi: true, autonomie: true }), ["resultats", "passages", "epcf", "autonomie", "livret", "dp"]);
  assert.deepEqual(partiesDeLaFiche({ soi: false, autonomie: true }), ["passages", "epcf", "evolution", "autonomie", "livret", "dp"]);
  assert.deepEqual(partiesDeLaFiche({ autonomie: true }), ["passages", "epcf", "evolution", "autonomie", "livret", "dp"]);
});
