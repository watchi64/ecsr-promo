import test from "node:test";
import assert from "node:assert/strict";
import { phraseStatut } from "../js/espaces-rules.js";

// Lot J : la ligne d'état des réglages d'habillage (centre, réseau).
test("phraseStatut : rien de fixé, avec ce que les comptes reçoivent", () => {
  assert.equal(phraseStatut(null, { repli: "Les comptes reçoivent celui du réseau." }), "Aucun habillage fixé. Les comptes reçoivent celui du réseau.");
  assert.equal(phraseStatut(null), "Aucun habillage fixé.");
});
test("phraseStatut : un habillage fixé, puis enregistré", () => {
  assert.equal(phraseStatut("ecf"), "Habillage fixé : Couleurs ECF.");
  assert.equal(phraseStatut("ecsr", { enregistre: true }), "Enregistré. Habillage fixé : ECSR Promo.");
  assert.equal(phraseStatut(null, { enregistre: true, repli: "X." }), "Enregistré. Aucun habillage fixé. X.");
});
