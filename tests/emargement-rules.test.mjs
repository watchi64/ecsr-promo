import test from "node:test";
import assert from "node:assert/strict";
import {
  REPERE, TRACE_MAX, cheminDepuisTraits, cheminValide, traitsSuffisants,
  absentsDuPlanning, etatLigne, resumeSeance, libelleHeure, libelleCreneau, dureeMinutes,
  heureLocale, jourDe, lundiDe, dayIndexDe, lireAdresseEmargement, nomsFormateursProposes,
  minutesPresence, libelleDuree, jourFerie,
} from "../js/emargement-rules.js";

const pts = (...xy) => xy.map(([x, y]) => ({ x, y }));

test("le tracé est ramené au repère 400 x 160, en entiers", () => {
  assert.deepEqual(REPERE, { largeur: 400, hauteur: 160 });
  const d = cheminDepuisTraits([pts([0, 0], [100, 40], [200, 80])], { largeur: 200, hauteur: 80 });
  assert.equal(d, "M0 0L200 80L400 160");
});

test("un point isolé devient un trait d'un point, lisible à l'impression", () => {
  assert.equal(cheminDepuisTraits([pts([50, 20])], { largeur: 400, hauteur: 160 }), "M50 20L50 20");
});

test("les points à moins de 2 unités du précédent sont retirés, la fin du trait reste", () => {
  const d = cheminDepuisTraits([pts([10, 10], [10.5, 10.4], [11, 11], [30, 30], [30.4, 30.2])], REPERE);
  assert.equal(d, "M10 10L30 30");
  const d2 = cheminDepuisTraits([pts([10, 10], [11, 10], [11.5, 10])], REPERE);
  assert.equal(d2, "M10 10L12 10");
});

test("un point hors de la zone est ramené au bord", () => {
  assert.equal(cheminDepuisTraits([pts([-5, 200], [500, -3])], REPERE), "M0 160L400 0");
});

test("plusieurs traits donnent plusieurs M, les traits vides sont ignorés", () => {
  assert.equal(cheminDepuisTraits([pts([0, 0], [10, 0]), [], pts([5, 5], [5, 20])], REPERE), "M0 0L10 0M5 5L5 20");
  assert.equal(cheminDepuisTraits([], REPERE), "");
});

test("cheminValide n'accepte que des commandes M et L en entiers", () => {
  assert.equal(cheminValide("M10 10L20 20M5 5L6 6"), true);
  assert.equal(cheminValide("M1 1<script>"), false);
  assert.equal(cheminValide(""), false);
  assert.equal(cheminValide(null), false);
  assert.equal(cheminValide("L1 1"), false);
  assert.equal(cheminValide("M1.5 2L3 4"), false);
  assert.equal(cheminValide("M1000 2L3 4"), false);
  const long = "M1 1" + "L2 2".repeat(5000);
  assert.ok(long.length > TRACE_MAX);
  assert.equal(cheminValide(long), false);
});

test("une signature trop courte est refusée", () => {
  assert.equal(traitsSuffisants([pts([5, 5])], REPERE), false);
  // Assez de points mais tous au même endroit : un gribouillis de 10 unités de large.
  assert.equal(traitsSuffisants([pts(...Array.from({ length: 12 }, (_, i) => [100 + (i % 10), 50]))], REPERE), false);
  assert.equal(traitsSuffisants([pts(...Array.from({ length: 10 }, (_, i) => [i * 40, 60 + (i % 2) * 20]))], REPERE), true);
  // La largeur se mesure dans le repère, pas en pixels de l'écran.
  const etroit = [pts(...Array.from({ length: 10 }, (_, i) => [i * 4, 30]))];
  assert.equal(traitsSuffisants(etroit, { largeur: 100, hauteur: 40 }), true);
});

test("absentsDuPlanning lit les absences des cartes de la seule demi-journée demandée", () => {
  const entries = [
    { day_index: 0, half_day: "matin", absences: [{ sid: 3, rid: null }, { sid: 4, rid: 9 }] },
    { day_index: 0, half_day: "matin", absences: [] },
    { day_index: 0, half_day: "aprem", absences: [{ sid: 5, rid: null }] },
    { day_index: 1, half_day: "matin", absences: [{ sid: 6, rid: null }] },
    { day_index: 0, half_day: "matin" },
  ];
  assert.deepEqual([...absentsDuPlanning(entries, 0, "matin")].sort(), [3, 4]);
  assert.deepEqual([...absentsDuPlanning(entries, 0, "aprem")], [5]);
  assert.equal(absentsDuPlanning([], 0, "matin").size, 0);
});

test("état d'une ligne", () => {
  const signe = etatLigne({ ligne: { trace: "M1 1L2 2", signe_le: "2026-10-26T08:04:00Z", sur_appareil_formateur: false }, absentPlanning: true, close: false });
  assert.equal(signe.code, "signe");
  assert.equal(signe.libelle, "Signé à 9h04");
  assert.equal(signe.origine, "soi");
  assert.equal(etatLigne({ ligne: { trace: "M1 1L2 2", signe_le: "2026-10-26T08:04:00Z", sur_appareil_formateur: true }, close: false }).origine, "appareil_formateur");

  const absent = etatLigne({ ligne: { absent: true, absence_origine: "formateur" }, absentPlanning: false, close: false });
  assert.deepEqual(absent, { code: "absent", libelle: "Absent", origine: "formateur" });
  assert.equal(etatLigne({ ligne: { absent: true, absence_origine: "planning" }, close: true }).libelle, "Absent (noté au planning)");
  assert.equal(etatLigne({ ligne: { absent: true, absence_origine: "non_signe" }, close: true }).libelle, "Absent (non signé)");

  assert.deepEqual(etatLigne({ ligne: null, absentPlanning: true, close: false }), { code: "attente", libelle: "Absent au planning", origine: "planning" });
  assert.deepEqual(etatLigne({ ligne: { observation: "Arrivé à 9h40" }, absentPlanning: false, close: false }), { code: "attente", libelle: "En attente", origine: null });
  assert.equal(etatLigne({ ligne: null, absentPlanning: false, close: true }).code, "absent");
});

test("résumé d'une séance", () => {
  const lignes = [
    { stagiaire_id: 1, trace: "M1 1L2 2" },
    { stagiaire_id: 2, absent: true },
    { stagiaire_id: 3, observation: "Retard" },
    { stagiaire_id: 99, trace: "M1 1L2 2" },  // hors liste : ignoré
  ];
  assert.deepEqual(resumeSeance(lignes, [1, 2, 3, 4], false), { signes: 1, absents: 1, attente: 2, total: 4 });
  assert.deepEqual(resumeSeance(lignes, [1, 2, 3, 4], true), { signes: 1, absents: 3, attente: 0, total: 4 });
});

test("horaires et durées", () => {
  assert.equal(libelleHeure("09:00"), "9h00");
  assert.equal(libelleHeure("13:30"), "13h30");
  assert.equal(libelleCreneau({ debut: "09:00", fin: "12:30" }), "9h00 à 12h30");
  assert.equal(dureeMinutes("09:00", "12:30"), 210);
  assert.equal(dureeMinutes("13:30", "17:00"), 210);
  assert.equal(libelleDuree(210), "3 h 30");
  assert.equal(libelleDuree(420), "7 h");
  assert.equal(libelleDuree(0), "0 h");
});

test("heure locale de Paris, été comme hiver", () => {
  assert.equal(heureLocale("2026-10-26T08:04:00Z"), "9h04");    // heure d'hiver (UTC+1)
  assert.equal(heureLocale("2026-10-23T07:30:00Z"), "9h30");    // heure d'été (UTC+2)
  assert.equal(heureLocale(null), "");
});

test("calendrier de la semaine", () => {
  assert.equal(jourDe("2026-10-26", 0), "2026-10-26");
  assert.equal(jourDe("2026-10-26", 4), "2026-10-30");
  assert.equal(jourDe("2026-12-28", 4), "2027-01-01");
  assert.equal(lundiDe("2026-10-30"), "2026-10-26");
  assert.equal(lundiDe("2026-10-26"), "2026-10-26");
  assert.equal(lundiDe("2026-11-01"), "2026-10-26");   // dimanche
  assert.equal(dayIndexDe("2026-10-26"), 0);
  assert.equal(dayIndexDe("2026-10-30"), 4);
  assert.equal(dayIndexDe("2026-11-01"), 6);
});

test("adresse d'une séance", () => {
  assert.deepEqual(lireAdresseEmargement("#/emargement/2026-10-26/matin"), { jour: "2026-10-26", demi: "matin" });
  assert.deepEqual(lireAdresseEmargement("#/emargement/2026-10-26/aprem"), { jour: "2026-10-26", demi: "aprem" });
  assert.deepEqual(lireAdresseEmargement("#/emargement/2026-10-26"), { jour: "2026-10-26", demi: null });
  assert.deepEqual(lireAdresseEmargement("#/emargement/2026-10-26/soir"), { jour: "2026-10-26", demi: null });
  assert.deepEqual(lireAdresseEmargement("#/emargement/2026-13-01/matin"), { jour: null, demi: null });
  assert.deepEqual(lireAdresseEmargement("#/emargement/2026-02-30/matin"), { jour: null, demi: null });
  assert.deepEqual(lireAdresseEmargement("#/emargement"), { jour: null, demi: null });
});

test("noms proposés pour la signature du formateur", () => {
  const profs = [{ id: 1, nom: "Romain" }, { id: 2, nom: "Hocine" }, { id: 3, nom: "Raphaël" }];
  const entries = [
    { prof_ids: [2, 1], prof_autre: null },
    { prof_ids: [], prof_autre: "Claire" },
    { prof_ids: [2], prof_autre: "Claire" },
  ];
  assert.deepEqual(nomsFormateursProposes({ entries, profs, monNom: "Romain" }), ["Romain", "Claire", "Hocine"]);
  assert.deepEqual(nomsFormateursProposes({ entries, profs, monNom: null }), ["Claire", "Hocine", "Romain"]);
  assert.deepEqual(nomsFormateursProposes({ entries: [], profs, monNom: null }), []);
});

test("jours fériés (mêmes règles que le planning)", () => {
  assert.equal(jourFerie("2026-11-01"), "Toussaint");
  assert.equal(jourFerie("2026-11-11"), "Armistice");
  assert.equal(jourFerie("2026-04-06"), "Lundi de Pâques");
  assert.equal(jourFerie("2026-05-14"), "Ascension");
  assert.equal(jourFerie("2026-05-25"), "Lundi de Pentecôte");
  assert.equal(jourFerie("2027-03-29"), "Lundi de Pâques");
  assert.equal(jourFerie("2026-10-26"), null);
});

test("minutes de présence d'un stagiaire sur une semaine", () => {
  const seances = [
    { id: 1, debut: "09:00", fin: "12:30" },
    { id: 2, debut: "13:30", fin: "17:00" },
    { id: 3, debut: "09:00", fin: "12:00" },
  ];
  const lignes = [
    { seance_id: 1, stagiaire_id: 7, trace: "M1 1L2 2" },
    { seance_id: 2, stagiaire_id: 7, absent: true },
    { seance_id: 3, stagiaire_id: 7, trace: "M1 1L2 2" },
    { seance_id: 2, stagiaire_id: 8, trace: "M1 1L2 2" },
  ];
  assert.equal(minutesPresence(seances, lignes, 7), 390);
  assert.equal(minutesPresence(seances, lignes, 8), 210);
  assert.equal(minutesPresence(seances, lignes, 9), 0);
});
