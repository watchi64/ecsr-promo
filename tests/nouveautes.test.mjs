import assert from "node:assert/strict";
import {
  triees, visibles, nonLues, libellePastille, purger, ajouterVues, idsDeReprise,
} from "../js/nouveautes.js";

const E = [
  { id: "a", date: "2026-07-02", pour: "formateurs" },
  { id: "b", date: "2026-07-31", pour: "tous" },
  { id: "c", date: "2026-07-31", pour: "tous" },
  { id: "d", date: "2026-07-19", pour: "tous" },
];

// Tri antéchronologique. À date égale (b et c), l'ordre du fichier de contenu
// est conservé : Array.prototype.sort est stable depuis ES2019.
assert.deepEqual(triees(E).map((e) => e.id), ["b", "c", "d", "a"]);
// Le tri ne modifie pas le tableau reçu.
assert.deepEqual(E.map((e) => e.id), ["a", "b", "c", "d"]);

// Audience : une entrée « formateurs » disparaît pour un stagiaire.
assert.deepEqual(visibles(E, true).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(visibles(E, false).map((e) => e.id), ["b", "c", "d"]);

// Non-lu : une entrée est neuve tant que son id n'a pas été vu.
assert.deepEqual(nonLues(E, ["b", "d"]).map((e) => e.id), ["a", "c"]);
assert.deepEqual(nonLues(E, []).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(nonLues(E, null).map((e) => e.id), ["a", "b", "c", "d"]);

// Pastille : rien à zéro, le compte jusqu'à 9, « 9+ » au-delà.
assert.equal(libellePastille(0), "");
assert.equal(libellePastille(3), "3");
assert.equal(libellePastille(9), "9");
assert.equal(libellePastille(10), "9+");

// Purge : un id mémorisé qui ne correspond plus à aucune entrée disparaît.
assert.deepEqual(purger(["a", "obsolete"], E), ["a"]);
// Ajout sans doublon, purgé au passage.
assert.deepEqual(ajouterVues(["a"], ["a", "b", "obsolete"], E), ["a", "b"]);

// Amorce : au premier accès, les entrées antérieures ou égales à la mise en
// ligne sont déjà lues. Celles qui lui sont postérieures restent neuves, sinon
// une nouveauté publiée le jour même passerait inaperçue.
assert.deepEqual(idsDeReprise(E, "2026-07-31"), ["a", "b", "c", "d"]);
assert.deepEqual(idsDeReprise(E, "2026-07-19"), ["a", "d"]);
assert.deepEqual(idsDeReprise(E, "2026-07-01"), []);
// Une entrée postérieure à la mise en ligne n'est jamais amorcée.
const AVEC_FUTURE = [...E, { id: "futur", date: "2026-08-15", pour: "tous" }];
assert.ok(!idsDeReprise(AVEC_FUTURE, "2026-08-01").includes("futur"));

console.log("nouveautes : 17 assertions OK");
