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
  assert.equal(r.derniereActivite, "2026-11-12");   // un jour (Paris), pas un instant
});
test("dernière activité : le temps actif compte, comparé en jours", () => {
  const vide = { coursPublies: ["a"], lectures: [], entrainements: [], aujourdhui: "2026-11-12" };
  // 20 minutes cette semaine et rien d'autre : la dernière activité est ce jour-là.
  assert.equal(resumeAutonomie({ ...vide, temps: [{ jour: "2026-11-10", secondes: 1200 }] }).derniereActivite, "2026-11-10");
  // Le temps d'un jour plus récent l'emporte sur une lecture plus ancienne, et inversement.
  assert.equal(resumeAutonomie({
    ...vide, temps: [{ jour: "2026-11-11", secondes: 60 }],
    lectures: [{ cours_id: "a", vu_le: "2026-11-10T16:00:00Z", lu_le: null }],
  }).derniereActivite, "2026-11-11");
  assert.equal(resumeAutonomie({
    ...vide, temps: [{ jour: "2026-11-09", secondes: 60 }],
    entrainements: [{ finished_at: "2026-11-11T08:00:00Z" }],
  }).derniereActivite, "2026-11-11");
  // Une ligne de temps sans secondes ne dit rien.
  assert.equal(resumeAutonomie({ ...vide, temps: [{ jour: "2026-11-11", secondes: 0 }] }).derniereActivite, null);
});
test("dernière activité : le jour d'un instant est celui de Paris", () => {
  // 23 h 30 UTC le 11 = 0 h 30 à Paris le 12 : plus récent que le temps du 11.
  assert.equal(resumeAutonomie({
    coursPublies: ["a"], aujourdhui: "2026-11-12", entrainements: [],
    temps: [{ jour: "2026-11-11", secondes: 60 }],
    lectures: [{ cours_id: "a", vu_le: "2026-11-11T23:30:00Z", lu_le: null }],
  }).derniereActivite, "2026-11-12");
});
test("dernière activité : la lecture d'un cours qui n'est plus publié ne compte pas", () => {
  const r = resumeAutonomie({
    coursPublies: ["a"], aujourdhui: "2026-11-12", temps: [], entrainements: [],
    lectures: [{ cours_id: "a", vu_le: "2026-11-09T10:00:00Z", lu_le: "2026-11-09T10:00:00Z" },
               { cours_id: "z", vu_le: "2026-11-12T10:00:00Z", lu_le: "2026-11-12T10:00:00Z" }],
  });
  assert.equal(r.derniereActivite, "2026-11-09");
  const seul = resumeAutonomie({
    coursPublies: ["a"], aujourdhui: "2026-11-12", temps: [], entrainements: [],
    lectures: [{ cours_id: "z", vu_le: "2026-11-12T10:00:00Z", lu_le: null }],
  });
  assert.equal(seul.derniereActivite, null);
});
test("résumé vide", () => {
  const r = resumeAutonomie({ coursPublies: [], lectures: [], temps: [], entrainements: [], aujourdhui: "2026-11-12" });
  assert.deepEqual(r, { coursLus: 0, coursTotal: 0, secondesSemaine: 0, secondesTotal: 0, entrainements: 0, derniereActivite: null });
});

import {
  MAX_SECONDES_ECRITURE, trancheAEnvoyer, sectionDeReprise, sectionEnHaut, repriseDepassee,
} from "../js/autonomie-rules.js";

test("une tranche d'envoi est un entier de 0 à 60", () => {
  assert.equal(MAX_SECONDES_ECRITURE, 60);
  assert.equal(trancheAEnvoyer(0), 0);
  assert.equal(trancheAEnvoyer(-5), 0);
  assert.equal(trancheAEnvoyer(NaN), 0);
  assert.equal(trancheAEnvoyer(12), 12);
  assert.equal(trancheAEnvoyer(12.9), 12);
  assert.equal(trancheAEnvoyer(60), 60);
  assert.equal(trancheAEnvoyer(61), 60);
  assert.equal(trancheAEnvoyer(1000), 60);
});

test("reprise : lecture existante, non terminee, section encore presente", () => {
  const ids = ["cours-sec-1", "cours-sec-2", "cours-sec-3"];
  assert.equal(sectionDeReprise({ section: "cours-sec-2", lu_le: null }, ids), "cours-sec-2");
  assert.equal(sectionDeReprise({ section: "cours-sec-2" }, ids), "cours-sec-2");
  assert.equal(sectionDeReprise({ section: "cours-sec-2", lu_le: "2026-11-12T10:00:00Z" }, ids), null);
  assert.equal(sectionDeReprise({ section: "cours-sec-9", lu_le: null }, ids), null);
  assert.equal(sectionDeReprise({ section: null, lu_le: null }, ids), null);
  assert.equal(sectionDeReprise(null, ids), null);
  assert.equal(sectionDeReprise(undefined, ids), null);
  assert.equal(sectionDeReprise({ section: "cours-sec-1", lu_le: null }, []), null);
});

test("reprise : jamais sur la première section (le saut serait nul)", () => {
  const ids = ["cours-sec-1", "cours-sec-2", "cours-sec-3"];
  assert.equal(sectionDeReprise({ section: "cours-sec-1", lu_le: null }, ids), null);
  assert.equal(sectionDeReprise({ section: "cours-sec-3", lu_le: null }, ids), "cours-sec-3");
  assert.equal(sectionDeReprise({ section: "cours-sec-1", lu_le: null }, ["cours-sec-1"]), null);
});

test("section en haut : le dernier titre passe, a la marge pres", () => {
  const p = [{ id: "a", haut: 100 }, { id: "b", haut: 600 }, { id: "c", haut: 1200 }];
  assert.equal(sectionEnHaut(p, 0, 0), null);
  assert.equal(sectionEnHaut(p, 0, 120), "a");
  assert.equal(sectionEnHaut(p, 500, 100), "b");
  assert.equal(sectionEnHaut(p, 5000, 0), "c");
  assert.equal(sectionEnHaut([], 300), null);
});

test("le bandeau de reprise disparait au-dela d'un ecran de defilement", () => {
  assert.equal(repriseDepassee(1000, 1500, 800), false);
  assert.equal(repriseDepassee(1000, 1800, 800), false);
  assert.equal(repriseDepassee(1000, 1801, 800), true);
  assert.equal(repriseDepassee(1000, 100, 800), true);
});

test("coursLus : les cours dont la lecture est terminée, par identifiant", async () => {
  const { coursLus } = await import("../js/autonomie-rules.js");
  const lus = coursLus([
    { cours_id: "a", ouvert_le: "2026-11-13", lu_le: "2026-11-13T10:00:00Z" },
    { cours_id: "b", ouvert_le: "2026-11-13", lu_le: null },
    { cours_id: 7, lu_le: "2026-11-12T09:00:00Z" },
  ]);
  assert.equal(lus.has("a"), true);
  assert.equal(lus.has("b"), false);
  assert.equal(lus.has("7"), true);
  assert.equal(coursLus(null).size, 0);
  assert.equal(coursLus(undefined).size, 0);
});

test("phraseLecteurs : Map vide = rien nulle part ; Map non vide = phrase, bornée à T", async () => {
  const { phraseLecteurs } = await import("../js/autonomie-rules.js");
  const m = new Map([["a", 5], ["b", 1]]);
  const base = { parCours: m, total: 12, publie: true };
  assert.equal(phraseLecteurs({ ...base, coursId: "a" }), "5 sur 12 l'ont lu");
  assert.equal(phraseLecteurs({ ...base, coursId: "b" }), "1 sur 12 l'a lu");
  assert.equal(phraseLecteurs({ ...base, coursId: "c" }), "Personne ne l'a encore lu");
  assert.equal(phraseLecteurs({ parCours: new Map(), coursId: "c", total: 12, publie: true }), null);
  assert.equal(phraseLecteurs({ parCours: null, coursId: "c", total: 12, publie: true }), null);
  assert.equal(phraseLecteurs({ ...base, coursId: "a", total: 4 }), "4 sur 4 l'ont lu");
  assert.equal(phraseLecteurs({ parCours: new Map([["a", 3]]), coursId: "a", total: 1, publie: true }), "1 sur 1 l'a lu");
  assert.equal(phraseLecteurs({ ...base, coursId: "a", total: 0 }), null);
  assert.equal(phraseLecteurs({ ...base, coursId: "a", total: NaN }), null);
  assert.equal(phraseLecteurs({ ...base, coursId: "a", publie: false }), null);
});

test("creerSignalLu : une seule notification par cours, seulement quand l'écriture rend vrai", async () => {
  const { creerSignalLu } = await import("../js/autonomie-rules.js");
  const vus = [];
  const signal = creerSignalLu((id) => vus.push(id));
  signal("a", false);
  signal("a", undefined);
  assert.deepEqual(vus, []);
  signal("a", true);
  signal("a", true);
  signal("b", true);
  signal(null, true);
  assert.deepEqual(vus, ["a", "b"]);
});
