import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLE_ACTIVATION, estActif, SEUIL_INACTIVITE_MS, PERIODE_ECRITURE_MS, PART_PLANCHER,
  creerCompteur, plancherLecture, formatDuree, resumeAutonomie,
} from "../js/autonomie-rules.js";

test("constantes et activation", () => {
  assert.equal(CLE_ACTIVATION, "autonomie_active");
  assert.deepEqual([SEUIL_INACTIVITE_MS, PERIODE_ECRITURE_MS, PART_PLANCHER], [60000, 30000, 0.3]);
  assert.equal(estActif(true), true);
  assert.equal(estActif("true"), true);
  assert.equal(estActif(false), false);
  assert.equal(estActif("false"), false);
  assert.equal(estActif(null), false);
});

test("le temps s'arrête 60 s après la dernière action", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  assert.equal(c.prelever(3_600_000), 60);      // une heure sans toucher : 60 s
  c.action(3_600_000);
  assert.equal(c.prelever(3_610_000), 10);      // reprise à l'action suivante
});
test("rien n'est compté page masquée", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  c.visible(20_000, false); c.action(25_000);   // une action page masquée ne relance rien
  c.visible(50_000, true);                      // revenir sans agir ne compte pas
  assert.equal(c.prelever(55_000), 20);
});
test("des actions rapprochées ne se cumulent pas deux fois", () => {
  const c = creerCompteur();
  c.visible(0, true);
  for (let t = 0; t <= 30_000; t += 1_000) c.action(t);
  assert.equal(c.prelever(30_000), 30);
});
test("le reste sous la seconde est gardé", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  assert.equal(c.prelever(1_500), 1);
  c.action(1_500);
  assert.equal(c.prelever(2_000), 1);
});
test("prélever deux fois sans action ne recompte rien", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  assert.equal(c.prelever(10_000), 10);
  assert.equal(c.prelever(10_000), 0);
  assert.equal(c.prelever(20_000), 10);
});
test("visible(t, true) répété ne remet pas le compteur à zéro", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  c.visible(10_000, true);
  assert.equal(c.prelever(20_000), 20);
});
test("sans page visible, rien n'est compté", () => {
  const c = creerCompteur();
  c.action(0);
  assert.equal(c.prelever(30_000), 0);
});
test("plancher : 30 % du temps estimé, une minute estimée au moins", () => {
  assert.equal(plancherLecture("mot ".repeat(2000)), 180);   // 10 min estimées
  assert.equal(plancherLecture("court"), 18);                // 1 min estimée
});
test("formatDuree", () => {
  assert.equal(formatDuree(0), "0 min");
  assert.equal(formatDuree(59), "1 min");       // arrondi à la minute, une trace non nulle ne s'affiche pas 0
  assert.equal(formatDuree(720), "12 min");
  assert.equal(formatDuree(3900), "1 h 05");
});
test("résumé : un cours dépublié sort du total, la semaine va du lundi au dimanche", () => {
  const r = resumeAutonomie({
    coursPublies: ["a", "b", "c"],
    lectures: [{ cours_id: "a", lu_le: "2026-11-10T10:00:00Z", vu_le: "2026-11-10T10:00:00Z" },
               { cours_id: "z", lu_le: "2026-11-09T10:00:00Z", vu_le: "2026-11-09T10:00:00Z" },
               { cours_id: "b", lu_le: null, vu_le: "2026-11-12T08:00:00Z" }],
    temps: [{ jour: "2026-11-08", secondes: 600 }, { jour: "2026-11-09", secondes: 300 }, { jour: "2026-11-12", secondes: 120 }],
    entrainements: [{ finished_at: "2026-11-11T09:00:00Z" }],
    aujourdhui: "2026-11-12",
  });
  assert.deepEqual([r.coursLus, r.coursTotal], [1, 3]);
  assert.deepEqual([r.secondesSemaine, r.secondesTotal], [420, 1020]);   // le dimanche 08/11 est hors semaine
  assert.equal(r.entrainements, 1);
  assert.equal(r.derniereActivite, "2026-11-12T08:00:00Z");
});
test("résumé vide", () => {
  const r = resumeAutonomie({ coursPublies: [], lectures: [], temps: [], entrainements: [], aujourdhui: "2026-11-12" });
  assert.deepEqual(r, { coursLus: 0, coursTotal: 0, secondesSemaine: 0, secondesTotal: 0, entrainements: 0, derniereActivite: null });
});
