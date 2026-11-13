import test from "node:test";
import assert from "node:assert/strict";
import { peutTracerAvec } from "../js/autonomie-rules.js";

// Un vrai compte stagiaire, interrupteur allumé : le seul cas qui trace.
const stagiaire = { actif: true, apercu: null, fondateur: false, equipe: false, stagiaireId: 15 };

test("un vrai stagiaire, interrupteur allumé : la trace est permise", () => {
  assert.equal(peutTracerAvec(stagiaire), true);
});

test("interrupteur éteint (ou inconnu) : jamais de trace", () => {
  assert.equal(peutTracerAvec({ ...stagiaire, actif: false }), false);
  assert.equal(peutTracerAvec({ ...stagiaire, actif: undefined }), false);
});

test("aperçu « Voir en tant que » : jamais de trace, même en aperçu stagiaire", () => {
  for (const a of ["stagiaire", "formateur", "direction", "siege"]) {
    assert.equal(peutTracerAvec({ ...stagiaire, apercu: a }), false, a);
  }
});

test("compte d'équipe ou fondateur : jamais de trace, même avec une fiche stagiaire", () => {
  assert.equal(peutTracerAvec({ ...stagiaire, equipe: true }), false);
  assert.equal(peutTracerAvec({ ...stagiaire, fondateur: true }), false);
  assert.equal(peutTracerAvec({ ...stagiaire, equipe: true, fondateur: true }), false);
});

test("sans fiche stagiaire dans la promo affichée : jamais de trace", () => {
  assert.equal(peutTracerAvec({ ...stagiaire, stagiaireId: null }), false);
  assert.equal(peutTracerAvec({ ...stagiaire, stagiaireId: undefined }), false);
});

test("sans argument : refus", () => {
  assert.equal(peutTracerAvec(), false);
  assert.equal(peutTracerAvec({}), false);
});
