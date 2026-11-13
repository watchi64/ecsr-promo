import test from "node:test";
import assert from "node:assert/strict";
import { peutTracerAvec, estCompteEquipe } from "../js/autonomie-rules.js";

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

// --- estCompteEquipe : la décision « compte d'équipe » (fiche stagiaire ou non, la base refuse tout compte d'équipe) ---
const simple = { droits: {}, profil: { role: "stagiaire", is_admin: false, is_founder: false, stagiaire_id: 15 }, affectations: [] };

test("un stagiaire simple n'est pas un compte d'équipe", () => {
  assert.equal(estCompteEquipe(simple), false);
  assert.equal(estCompteEquipe({ droits: { stagiaire: true }, profil: simple.profil, affectations: [] }), false);
});

test("formateur (prof), administrateur et droits d'équipe : compte d'équipe, même avec une fiche stagiaire", () => {
  assert.equal(estCompteEquipe({ ...simple, droits: { prof: true } }), true);
  assert.equal(estCompteEquipe({ ...simple, droits: { admin: true } }), true);
  assert.equal(estCompteEquipe({ ...simple, droits: { equipe: true } }), true);
  assert.equal(estCompteEquipe({ ...simple, profil: { ...simple.profil, is_admin: true } }), true);
});

test("fondateur avec une fiche stagiaire : compte d'équipe", () => {
  assert.equal(estCompteEquipe({ ...simple, profil: { ...simple.profil, is_founder: true } }), true);
});

test("affectation de direction, de formateur ou de siège : compte d'équipe", () => {
  assert.equal(estCompteEquipe({ ...simple, affectations: [{ role: "direction", promo_id: null, lieu_id: 1 }] }), true);
  assert.equal(estCompteEquipe({ ...simple, affectations: [{ role: "siege" }] }), true);
});

test("stagiaire d'une promo, formateur d'une autre : l'affectation ailleurs suffit, la base refuse", () => {
  assert.equal(estCompteEquipe({ ...simple, affectations: [{ role: "formateur", promo_id: 2 }] }), true);
});

test("sans profil ni faits : pas de compte d'équipe", () => {
  assert.equal(estCompteEquipe(), false);
  assert.equal(estCompteEquipe({ profil: null, affectations: null }), false);
});
