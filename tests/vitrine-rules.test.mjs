import { test } from "node:test";
import assert from "node:assert/strict";
import { stagiaireVitrine, VITRINES } from "../js/vitrine-rules.js";

test("vitrine : le fondateur en aperçu Stagiaire dans la promo de démonstration voit Camille", () => {
  assert.equal(stagiaireVitrine({ promoId: 7, apercu: "stagiaire", fondateur: true }), 1634);
});
test("vitrine : jamais hors de l'aperçu Stagiaire du fondateur, jamais dans une vraie promo", () => {
  assert.equal(stagiaireVitrine({ promoId: 7, apercu: "stagiaire", fondateur: false }), null);
  assert.equal(stagiaireVitrine({ promoId: 7, apercu: "formateur", fondateur: true }), null);
  assert.equal(stagiaireVitrine({ promoId: 7, apercu: null, fondateur: true }), null);
  assert.equal(stagiaireVitrine({ promoId: 1, apercu: "stagiaire", fondateur: true }), null);
  assert.equal(stagiaireVitrine({ promoId: null, apercu: "stagiaire", fondateur: true }), null);
  assert.deepEqual(Object.keys(VITRINES), ["7"]);
});
