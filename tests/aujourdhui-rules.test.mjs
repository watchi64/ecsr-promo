import test from "node:test";
import assert from "node:assert/strict";
import {
  titreSelonDemis, auTableauDuJour, enVoitureDuJour, feuilleDuJour, lignesATraiter, ligneDeLEnTete,
} from "../js/aujourdhui-rules.js";
import { journeeDuJour } from "../js/journee-rules.js";

// Lot 2B, tâche 4 : « Aujourd'hui » du formateur. Les règles seulement : quels titres, qui est au tableau et en voiture,
// où en est la feuille d'émargement du jour, ce qui attend le formateur. Les cartes viennent de journeeDuJour (tâche 2),
// pour que les remplacements et les absences soient lus d'un seul endroit.

const MARDI = "2026-10-27";

const noms = () => ({
  stagiaires: new Map([[1, "Timy"], [2, "Anissa"], [3, "Lorie"], [4, "Valentin"], [5, "Cassandre"], [6, "Céline"]]),
  formateurs: new Map([[1, "Romain"]]),
  benevoles: new Map([[1, "C. Camille"], [2, "Y. Yanis"]]),
  autres: [],
});

function carte(extra) {
  return {
    id: 1, day_index: 1, half_day: "matin", slot: 0, lane: 0, activite: "Pédagogie salle",
    prof_id: null, prof_ids: [1], prof_autre: null, autonomie: false, sujet: null, sujet_2: null,
    pedagogue_id: null, pedagogue_id_2: null, eleves_ids: [], eleves_ids_2: [], salle_double: false,
    benevoles_ids: [], notes: null, absences: [], ...extra,
  };
}

const journee = (entries) => journeeDuJour({ entries, metas: [], joursOff: [], jour: MARDI, moi: null, noms: noms() });

// === titreSelonDemis ===

test("titreSelonDemis : le matin, l'après-midi, la journée", () => {
  assert.equal(titreSelonDemis("Au tableau", ["matin"]), "Au tableau ce matin");
  assert.equal(titreSelonDemis("Au tableau", ["aprem"]), "Au tableau cet après-midi");
  assert.equal(titreSelonDemis("Au tableau", ["matin", "aprem"]), "Au tableau aujourd'hui");
  assert.equal(titreSelonDemis("En voiture", ["aprem"]), "En voiture cet après-midi");
});

test("titreSelonDemis : sans demi-journée, ou en double, le titre dit aujourd'hui", () => {
  assert.equal(titreSelonDemis("En voiture", []), "En voiture aujourd'hui");
  assert.equal(titreSelonDemis("En voiture", ["matin", "matin"]), "En voiture ce matin");
});

// === auTableauDuJour ===

test("auTableauDuJour : deux groupes sur une salle double, chacun avec le sujet de son groupe", () => {
  const j = journee([carte({ salle_double: true, pedagogue_id: 2, pedagogue_id_2: 3, sujet: "Feux", sujet_2: "Pneus" })]);
  assert.deepEqual(auTableauDuJour(j), [
    { id: 2, nom: "Anissa", demi: "matin", sujet: "Feux" },
    { id: 3, nom: "Lorie", demi: "matin", sujet: "Pneus" },
  ]);
});

test("auTableauDuJour : salle double dont un seul groupe a un sujet écrit, l'autre reprend les sujets de la carte", () => {
  const j = journee([carte({ salle_double: true, pedagogue_id: 2, pedagogue_id_2: 3, sujet: "Feux", sujet_2: null })]);
  assert.deepEqual(auTableauDuJour(j), [
    { id: 2, nom: "Anissa", demi: "matin", sujet: "Feux" },
    { id: 3, nom: "Lorie", demi: "matin", sujet: "Feux" },
  ]);
});

test("auTableauDuJour : le remplaçant d'un pédagogue de salle double garde le sujet de son groupe", () => {
  const j = journee([carte({ salle_double: true, pedagogue_id: 2, pedagogue_id_2: 3, sujet: "Feux", sujet_2: "Pneus",
    absences: [{ sid: 3, rid: 5 }] })]);
  assert.deepEqual(auTableauDuJour(j), [
    { id: 2, nom: "Anissa", demi: "matin", sujet: "Feux" },
    { id: 5, nom: "Cassandre", demi: "matin", sujet: "Pneus" },
  ]);
});

test("auTableauDuJour : un absent est remplacé, un absent sans remplaçant n'y figure plus", () => {
  const remplace = journee([carte({ pedagogue_id: 2, sujet: "Feux", absences: [{ sid: 2, rid: 5 }] })]);
  assert.deepEqual(auTableauDuJour(remplace), [{ id: 5, nom: "Cassandre", demi: "matin", sujet: "Feux" }]);
  const sans = journee([carte({ pedagogue_id: 2, sujet: "Feux", absences: [{ sid: 2, rid: null }] })]);
  assert.deepEqual(auTableauDuJour(sans), []);
});

test("auTableauDuJour : le matin puis l'après-midi, sans sujet quand la carte n'en a pas", () => {
  const j = journee([
    carte({ id: 1, pedagogue_id: 2 }),
    carte({ id: 2, half_day: "aprem", pedagogue_id: 3, sujet: "Pneus" }),
  ]);
  assert.deepEqual(auTableauDuJour(j), [
    { id: 2, nom: "Anissa", demi: "matin", sujet: "" },
    { id: 3, nom: "Lorie", demi: "aprem", sujet: "Pneus" },
  ]);
});

test("auTableauDuJour : personne au tableau, un jour de repos, une journée absente", () => {
  assert.deepEqual(auTableauDuJour(journee([carte({ activite: "Cours", sujet: "Feux" })])), []);
  assert.deepEqual(auTableauDuJour(journeeDuJour({ entries: [], metas: [], joursOff: [], jour: "2026-10-31", moi: null, noms: noms() })), []);
  assert.deepEqual(auTableauDuJour(null), []);
});

// === enVoitureDuJour ===

test("enVoitureDuJour : deux cartes voiture, un stagiaire une seule fois, les bénévoles sans doublon", () => {
  const j = journee([
    carte({ id: 1, half_day: "aprem", activite: "Voiture (conduite)", eleves_ids: [1, 2], benevoles_ids: [2] }),
    carte({ id: 2, half_day: "aprem", slot: 1, activite: "Voiture (conduite)", eleves_ids: [2, 3], benevoles_ids: [2, 1] }),
  ]);
  assert.deepEqual(enVoitureDuJour(j), {
    stagiaires: [{ id: 1, nom: "Timy" }, { id: 2, nom: "Anissa" }, { id: 3, nom: "Lorie" }],
    benevoles: ["Y. Yanis", "C. Camille"],
    demis: ["aprem"],
  });
});

test("enVoitureDuJour : le matin et l'après-midi, les cartes de salle ne comptent pas", () => {
  const j = journee([
    carte({ id: 1, activite: "Voiture (conduite)", eleves_ids: [1] }),
    carte({ id: 2, half_day: "aprem", activite: "Voiture (conduite)", benevoles_ids: [1] }),
    carte({ id: 3, slot: 1, pedagogue_id: 2, eleves_ids: [4], benevoles_ids: [2] }),
  ]);
  assert.deepEqual(enVoitureDuJour(j), { stagiaires: [{ id: 1, nom: "Timy" }], benevoles: ["C. Camille"], demis: ["matin", "aprem"] });
});

test("enVoitureDuJour : une voiture sans personne ne compte pas ; rien du tout", () => {
  const j = journee([carte({ activite: "Voiture (conduite)", sujet: "Rond-point" })]);
  assert.deepEqual(enVoitureDuJour(j), { stagiaires: [], benevoles: [], demis: [] });
  assert.deepEqual(enVoitureDuJour(null), { stagiaires: [], benevoles: [], demis: [] });
});

test("enVoitureDuJour : un conducteur absent est remplacé", () => {
  const j = journee([carte({ activite: "Voiture (conduite)", eleves_ids: [1, 2], absences: [{ sid: 1, rid: 4 }] })]);
  assert.deepEqual(enVoitureDuJour(j).stagiaires, [{ id: 4, nom: "Valentin" }, { id: 2, nom: "Anissa" }]);
});

// === feuilleDuJour ===

const stagiaires = [
  { id: 1, prenom: "Timy", nom: "Vigne", actif: true },
  { id: 2, prenom: "Anissa", nom: "Boulet", actif: true },
  { id: 3, prenom: "Lorie", nom: "Martin", actif: true },
  { id: 4, prenom: "Valentin", nom: "Roux", actif: true },
  { id: 9, prenom: "Zoé", nom: "Abandon", actif: false },
];
const sig = (id, extra = {}) => ({ stagiaire_id: id, absent: false, signe_le: "2026-10-27T07:52:00Z", ...extra });
const seance = (demi, statut, lignes, extra = {}) => ({ id: demi === "matin" ? 10 : 11, jour: MARDI, demi_journee: demi, debut: "09:00", fin: "12:30", statut, lignes, ...extra });

test("feuilleDuJour : la feuille ouverte, qui a signé, qui attend", () => {
  const f = feuilleDuJour({ seances: [seance("matin", "ouverte", [sig(2)])], stagiaires, entries: [] });
  assert.equal(f.statut, "ouverte");
  assert.equal(f.titre, "Émargement du matin");
  assert.equal(f.seance.id, 10);
  assert.equal(f.signes, 1);
  assert.equal(f.total, 4);
  // Dans l'ordre alphabétique des noms de famille, comme la feuille.
  assert.deepEqual(f.enAttente, ["M. Lorie", "R. Valentin", "V. Timy"]);
});

test("feuilleDuJour : un absent noté ne figure pas parmi ceux qui attendent mais reste dans le total", () => {
  const f = feuilleDuJour({ seances: [seance("matin", "ouverte", [sig(2), { stagiaire_id: 3, absent: true, signe_le: null }])], stagiaires, entries: [] });
  assert.deepEqual(f.enAttente, ["R. Valentin", "V. Timy"]);
  assert.equal(f.signes, 1);
  assert.equal(f.total, 4);
});

test("feuilleDuJour : un absent noté au planning n'attend pas non plus", () => {
  const entries = [carte({ pedagogue_id: 1, absences: [{ sid: 1, rid: null }] })];
  const f = feuilleDuJour({ seances: [seance("matin", "ouverte", [])], stagiaires, entries });
  assert.deepEqual(f.enAttente, ["B. Anissa", "M. Lorie", "R. Valentin"]);
  assert.equal(f.total, 4);
});

test("feuilleDuJour : un abandon qui a signé reste compté, comme sur le bandeau", () => {
  const f = feuilleDuJour({ seances: [seance("matin", "ouverte", [sig(9)])], stagiaires, entries: [] });
  assert.equal(f.signes, 1);
  assert.equal(f.total, 5);
  assert.ok(!f.enAttente.includes("A. Zoé"));
});

test("feuilleDuJour : une feuille close, figée sur ses lignes, personne n'attend", () => {
  const f = feuilleDuJour({ seances: [seance("matin", "close", [sig(1), sig(2), { stagiaire_id: 3, absent: true, signe_le: null }])], stagiaires, entries: [] });
  assert.equal(f.statut, "close");
  assert.equal(f.signes, 2);
  assert.equal(f.total, 3);
  assert.deepEqual(f.enAttente, []);
});

test("feuilleDuJour : sans feuille ouverte, la dernière close du jour", () => {
  const f = feuilleDuJour({
    seances: [seance("aprem", "close", [sig(1)]), seance("matin", "close", [sig(1), sig(2)])],
    stagiaires, entries: [],
  });
  assert.equal(f.seance.demi_journee, "aprem");
  assert.equal(f.titre, "Émargement de l'après-midi");
});

test("feuilleDuJour : la feuille ouverte passe avant une feuille close", () => {
  const f = feuilleDuJour({ seances: [seance("matin", "close", [sig(1)]), seance("aprem", "ouverte", [])], stagiaires, entries: [] });
  assert.equal(f.statut, "ouverte");
  assert.equal(f.seance.demi_journee, "aprem");
});

test("feuilleDuJour : matin et après-midi ouvertes ensemble, le matin", () => {
  const f = feuilleDuJour({ seances: [seance("aprem", "ouverte", []), seance("matin", "ouverte", [])], stagiaires, entries: [] });
  assert.equal(f.seance.demi_journee, "matin");
  assert.equal(f.titre, "Émargement du matin");
});

test("feuilleDuJour : aucune feuille", () => {
  assert.equal(feuilleDuJour({ seances: [], stagiaires, entries: [] }), null);
  assert.equal(feuilleDuJour({ seances: null, stagiaires, entries: [] }), null);
});

// === lignesATraiter ===

test("lignesATraiter : les deux lignes, au pluriel", () => {
  assert.deepEqual(lignesATraiter({ signalements: 3, propositionsIA: 2 }), [
    { cle: "signalements", titre: "3 signalements sur des QCM", nombre: 3, sousOnglet: "signalements" },
    { cle: "ia", titre: "2 questions proposées par l'IA", nombre: 2, sousOnglet: "ia" },
  ]);
});

test("lignesATraiter : au singulier", () => {
  assert.deepEqual(lignesATraiter({ signalements: 1, propositionsIA: 1 }).map((l) => l.titre),
    ["1 signalement sur un QCM", "1 question proposée par l'IA"]);
});

test("lignesATraiter : un compte nul, à zéro ou illisible n'a pas de ligne", () => {
  assert.deepEqual(lignesATraiter({ signalements: null, propositionsIA: null }), []);
  assert.deepEqual(lignesATraiter({ signalements: 0, propositionsIA: 0 }), []);
  assert.deepEqual(lignesATraiter({ signalements: "3", propositionsIA: -2 }), []);
  assert.deepEqual(lignesATraiter({ signalements: 4, propositionsIA: null }).map((l) => l.cle), ["signalements"]);
  assert.deepEqual(lignesATraiter({ signalements: null, propositionsIA: 2 }).map((l) => l.cle), ["ia"]);
  assert.deepEqual(lignesATraiter(undefined), []);
});

// === ligneDeLEnTete ===

test("ligneDeLEnTete : la promo, puis le nombre de stagiaires en formation", () => {
  assert.equal(ligneDeLEnTete("Promo Nîmes · semaine 3", 14), "Promo Nîmes · semaine 3 · 14 stagiaires en formation");
  assert.equal(ligneDeLEnTete("Promo Nîmes", 1), "Promo Nîmes · 1 stagiaire en formation");
});

test("ligneDeLEnTete : un compte qui n'a pas pu être lu laisse la ligne sans lui", () => {
  assert.equal(ligneDeLEnTete("Promo Nîmes", null), "Promo Nîmes");
  assert.equal(ligneDeLEnTete("", 14), "14 stagiaires en formation");
  assert.equal(ligneDeLEnTete("", null), "");
});
