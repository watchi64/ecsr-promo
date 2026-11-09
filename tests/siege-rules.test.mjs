// Règles pures de la page Directions de centre du siège (lot 5, Task 12). Lancer : node --test tests/siege-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { directionsParCentre } from "../js/siege-rules.js";

const LIEUX = [
  { id: 3, nom: "Nîmes", demonstration: false },
  { id: 1, nom: "Béziers", demonstration: false },
  { id: 4, nom: "Démonstration", demonstration: true },
  { id: 2, nom: "Alès", demonstration: false },
];
const DIRS = [
  { id: 10, email: "marc@exemple.invalid", nom: "Marc Dir", lieu_id: 3 },
  { id: 11, email: "anne@exemple.invalid", nom: null, lieu_id: 3 },
  { id: 12, email: "ben@exemple.invalid", nom: "Ben Chef", lieu_id: 1 },
  { id: 13, email: "demo@exemple.invalid", nom: "Démo", lieu_id: 4 },
  { id: 14, email: "perdu@exemple.invalid", nom: "Perdu", lieu_id: 99 },
];

test("directionsParCentre : un centre par ligne, triés par nom, centre sans direction compris", () => {
  const r = directionsParCentre(LIEUX, DIRS);
  assert.deepEqual(r.map((x) => x.centre.nom), ["Alès", "Béziers", "Nîmes", "Démonstration"]);
  assert.deepEqual(r[0].directions, [], "Alès n'a pas de direction");
  assert.deepEqual(r[1].directions.map((d) => d.id), [12]);
});

test("directionsParCentre : nom de la fiche, sinon l'adresse ; tri par ce libellé", () => {
  const nimes = directionsParCentre(LIEUX, DIRS).find((x) => x.centre.id === 3);
  assert.deepEqual(nimes.directions.map((d) => d.libelle), ["anne@exemple.invalid", "Marc Dir"]);
  assert.equal(nimes.directions[0].email, "anne@exemple.invalid");
});

test("directionsParCentre : démonstration à part (en dernier, marquée), direction d'un centre inconnu écartée", () => {
  const r = directionsParCentre(LIEUX, DIRS);
  assert.equal(r[r.length - 1].centre.demonstration, true);
  assert.deepEqual(r[r.length - 1].directions.map((d) => d.id), [13]);
  assert.ok(!r.some((x) => x.directions.some((d) => d.id === 14)));
});

test("directionsParCentre : listes vides", () => {
  assert.deepEqual(directionsParCentre([], DIRS), []);
  assert.deepEqual(directionsParCentre(undefined, undefined), []);
  assert.deepEqual(directionsParCentre([LIEUX[0]], undefined), [{ centre: LIEUX[0], directions: [] }]);
});
