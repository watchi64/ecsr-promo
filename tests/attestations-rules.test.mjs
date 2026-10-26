import test from "node:test";
import assert from "node:assert/strict";
import {
  bilanStagiaire, stagiairesDeLaPeriode, feuillesOuvertes, demiJourneesSansFeuille, periodeParDefaut,
  moisDeLaPeriode, dureeEnToutesLettres, dateFr, estAdresseAttestations, seancesDeLaPromo, LIBELLE_ORIGINE,
} from "../js/attestations-rules.js";

const signe = (sid, quand, observation = null) => ({ stagiaire_id: sid, signe_le: quand, absent: false, absence_origine: null, observation });
const absent = (sid, origine, observation = null) => ({ stagiaire_id: sid, signe_le: null, absent: true, absence_origine: origine, observation });

// Deux feuilles closes de 3 h 30 (lundi 12/10 matin, lundi 19/10 après-midi) et une ouverte.
const S1 = { id: 1, promo_id: 7, jour: "2026-10-12", demi_journee: "matin", debut: "09:00", fin: "12:30", statut: "close",
  lignes: [signe(1, "2026-10-12T07:05:00Z"), absent(2, "planning", "Absence justifiée")] };
const S2 = { id: 2, promo_id: 7, jour: "2026-10-19", demi_journee: "aprem", debut: "13:30", fin: "17:00", statut: "close",
  lignes: [absent(1, "non_signe"), signe(2, "2026-10-19T11:50:00Z", "Arrivée à 13h50")] };
const S3 = { id: 3, promo_id: 7, jour: "2026-10-20", demi_journee: "matin", debut: "09:00", fin: "12:30", statut: "ouverte",
  lignes: [signe(1, "2026-10-20T07:02:00Z"), signe(4, "2026-10-20T07:03:00Z")] };
const SEANCES = [S3, S2, S1];

test("heures prévues, réalisées, absences et taux : seules les feuilles closes comptent", () => {
  const b = bilanStagiaire(SEANCES, 1);
  assert.equal(b.prevuesMin, 420);
  assert.equal(b.realiseesMin, 210);
  assert.equal(b.absencesMin, 210);
  assert.equal(b.taux, 50);
  assert.equal(b.demiPrevues, 2);
  assert.equal(b.demiSignees, 1);
  assert.equal(feuillesOuvertes(SEANCES), 1);
});

test("dates : prévues (attestation) et signées (certificat)", () => {
  const b = bilanStagiaire(SEANCES, 1);
  assert.equal(b.premierPrevu, "2026-10-12");
  assert.equal(b.dernierPrevu, "2026-10-19");
  assert.equal(b.premierSigne, "2026-10-12");
  assert.equal(b.dernierSigne, "2026-10-12");
  const b2 = bilanStagiaire(SEANCES, 2);
  assert.equal(b2.premierSigne, "2026-10-19");
  assert.equal(b2.dernierSigne, "2026-10-19");
});

test("détail par semaine, rangé par lundi", () => {
  assert.deepEqual(bilanStagiaire(SEANCES, 1).semaines, [
    { lundi: "2026-10-12", demiPrevues: 1, demiSignees: 1, prevuesMin: 210, realiseesMin: 210 },
    { lundi: "2026-10-19", demiPrevues: 1, demiSignees: 0, prevuesMin: 210, realiseesMin: 0 },
  ]);
});

test("absences et notes : chaque absence, et la note d'une demi-journée signée", () => {
  assert.deepEqual(bilanStagiaire(SEANCES, 1).evenements, [
    { jour: "2026-10-19", demi: "aprem", debut: "13:30", fin: "17:00", minutes: 210, absent: true, origine: "non_signe", observation: null },
  ]);
  assert.deepEqual(bilanStagiaire(SEANCES, 2).evenements, [
    { jour: "2026-10-12", demi: "matin", debut: "09:00", fin: "12:30", minutes: 210, absent: true, origine: "planning", observation: "Absence justifiée" },
    { jour: "2026-10-19", demi: "aprem", debut: "13:30", fin: "17:00", minutes: 210, absent: false, origine: null, observation: "Arrivée à 13h50" },
  ]);
  assert.equal(LIBELLE_ORIGINE.planning, "Noté absent au planning");
});

test("matin avant après-midi le même jour, quel que soit l'ordre reçu", () => {
  const apm = { ...S1, id: 9, demi_journee: "aprem", debut: "13:30", fin: "17:00", lignes: [absent(1, "formateur")] };
  const mat = { ...S1, id: 8, lignes: [absent(1, "non_signe")] };
  assert.deepEqual(bilanStagiaire([apm, mat], 1).evenements.map((e) => e.demi), ["matin", "aprem"]);
});

test("aucune feuille prévue : zéro, taux nul, dates vides", () => {
  const b = bilanStagiaire(SEANCES, 99);
  assert.equal(b.prevuesMin, 0);
  assert.equal(b.taux, null);
  assert.equal(b.premierSigne, null);
  assert.deepEqual(b.semaines, []);
});

test("stagiaires listés : une ligne sur une feuille close, triés par nom", () => {
  const tous = [
    { id: 1, nom: "Bernard", prenom: "Léa", actif: true },
    { id: 2, nom: "Arnaud", prenom: "Kevin", actif: false },
    { id: 3, nom: "Coste", prenom: "Nadia", actif: true },
    { id: 4, nom: "Durand", prenom: "Marc", actif: true },
  ];
  assert.deepEqual(stagiairesDeLaPeriode(SEANCES, tous).map((s) => s.id), [2, 1]);
});

test("feuilles d'une autre promo écartées", () => {
  const autre = { ...S1, id: 5, promo_id: 1 };
  assert.deepEqual(seancesDeLaPromo([S1, autre], 7).map((s) => s.id), [1]);
});

test("demi-journées de semaine sans feuille, jours fériés exclus", () => {
  const lundiMatin = { ...S1, jour: "2026-11-09" };
  const lundiAprem = { ...S2, jour: "2026-11-09" };
  // 9 au 13/11 : 5 jours, le mercredi 11 est férié, deux feuilles le lundi.
  assert.equal(demiJourneesSansFeuille([lundiMatin, lundiAprem], "2026-11-07", "2026-11-15"), 6);
});

test("période par défaut : début de promo, bornée par sa fin", () => {
  assert.deepEqual(periodeParDefaut({ date_debut: "2026-09-30", date_fin: "2026-10-15" }, "2026-10-26"),
    { du: "2026-09-30", au: "2026-10-15" });
  assert.deepEqual(periodeParDefaut({ date_debut: "2026-09-30", date_fin: null }, "2026-10-26"),
    { du: "2026-09-30", au: "2026-10-26" });
  assert.deepEqual(periodeParDefaut(null, "2026-10-28"), { du: "2026-10-26", au: "2026-10-28" });
});

test("raccourcis par mois : les mois qui ont une feuille close", () => {
  const nov = { ...S1, id: 6, jour: "2026-11-02" };
  assert.deepEqual(moisDeLaPeriode([S3, S2, S1, nov]), [
    { cle: "2026-10", du: "2026-10-01", au: "2026-10-31", libelle: "Octobre 2026" },
    { cle: "2026-11", du: "2026-11-01", au: "2026-11-30", libelle: "Novembre 2026" },
  ]);
});

test("durée en toutes lettres et dates", () => {
  assert.equal(dureeEnToutesLettres(3990), "66 heures 30 minutes");
  assert.equal(dureeEnToutesLettres(4200), "70 heures");
  assert.equal(dureeEnToutesLettres(60), "1 heure");
  assert.equal(dureeEnToutesLettres(61), "1 heure 1 minute");
  assert.equal(dureeEnToutesLettres(0), "0 heure");
  assert.equal(dateFr("2026-10-12"), "12/10/2026");
  assert.equal(dateFr(null), "");
});

test("adresse de la page", () => {
  assert.equal(estAdresseAttestations("#/emargement/attestations"), true);
  assert.equal(estAdresseAttestations("#/emargement/2026-10-12"), false);
  assert.equal(estAdresseAttestations("#/emargement"), false);
});
