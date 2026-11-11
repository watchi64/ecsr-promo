// La ligne « Élève bénévole : … » de la journée, sur l'Accueil du stagiaire (js/accueil-rules.js, ligneBenevoles).
// Relevé du 11/11 : « Paul D.. », le point de fin de phrase doublait celui de l'initiale abrégée.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ligneBenevoles } from "../js/accueil-rules.js";

test("un nom qui finit par une initiale abrégée ne prend pas de second point", () => {
  assert.equal(ligneBenevoles(["Paul D."]), "Élève bénévole : Paul D.");
  assert.equal(ligneBenevoles(["Paul D.", "Emma L."]), "Élèves bénévoles : Paul D., Emma L.");
});

test("un nom sans abréviation reçoit le point de fin de phrase", () => {
  assert.equal(ligneBenevoles(["Paul"]), "Élève bénévole : Paul.");
  assert.equal(ligneBenevoles(["Emma L.", "Paul"]), "Élèves bénévoles : Emma L., Paul.");
});

test("aucun bénévole : aucune ligne", () => {
  assert.equal(ligneBenevoles([]), null);
  assert.equal(ligneBenevoles(undefined), null);
});
