import test from "node:test";
import assert from "node:assert/strict";
import { messageErreurRegistre, tableAbsente, PHRASE_DOUBLON, PHRASE_DROIT, PHRASE_CONTRAINTE, PHRASE_RESEAU } from "../js/registre-erreurs.js";

test("doublon de signalement (23505)", () => {
  assert.equal(messageErreurRegistre({ code: "23505", message: "duplicate key" }), "Ce signalement est déjà au registre.");
  assert.equal(PHRASE_DOUBLON, "Ce signalement est déjà au registre.");
});

test("refus de droit (42501)", () => {
  assert.equal(messageErreurRegistre({ code: "42501", message: "permission denied" }), "Réservé à la gestion de la qualité : ce compte n'a pas ce droit.");
  assert.equal(PHRASE_DROIT, "Réservé à la gestion de la qualité : ce compte n'a pas ce droit.");
});

test("refus d'une contrainte de la base (23514)", () => {
  assert.equal(messageErreurRegistre({ code: "23514", message: 'new row violates check constraint "registre_qualite_date_reponse_ordre"' }), "Une valeur n'est pas acceptée par le registre : vérifie les dates et les champs, puis réessaie.");
  assert.equal(PHRASE_CONTRAINTE, "Une valeur n'est pas acceptée par le registre : vérifie les dates et les champs, puis réessaie.");
});

test("phrase de la base : « registre: phrase » devient « phrase »", () => {
  assert.equal(messageErreurRegistre({ code: "P0001", message: "registre: Un risque ne se clôt pas sans mesure de prévention." }), "Un risque ne se clôt pas sans mesure de prévention.");
  assert.equal(messageErreurRegistre(new Error("registre:   Une entrée close ne se rouvre pas.  ")), "Une entrée close ne se rouvre pas.");
});

test("toute autre erreur : phrase de réseau", () => {
  const attendu = "Le registre n'a pas pu être enregistré : vérifie ta connexion, puis réessaie.";
  assert.equal(PHRASE_RESEAU, attendu);
  assert.equal(messageErreurRegistre({ message: "Failed to fetch" }), attendu);
  assert.equal(messageErreurRegistre({ code: "P0001", message: "registre:" }), attendu);
  assert.equal(messageErreurRegistre(null), attendu);
});

test("table absente : PGRST205, 42P01 ou texte", () => {
  assert.equal(tableAbsente({ code: "PGRST205", message: "x" }), true);
  assert.equal(tableAbsente({ code: "42P01", message: "x" }), true);
  assert.equal(tableAbsente({ message: "Could not find the table 'public.registre_qualite' in the schema cache" }), true);
  assert.equal(tableAbsente({ message: 'relation "registre_qualite" does not exist' }), true);
  assert.equal(tableAbsente({ code: "42501", message: "permission denied" }), false);
  assert.equal(tableAbsente(null), false);
});

test("aucun tiret cadratin dans les phrases", () => {
  const tiret = String.fromCharCode(0x2014);
  for (const p of [PHRASE_DOUBLON, PHRASE_DROIT, PHRASE_CONTRAINTE, PHRASE_RESEAU]) assert.ok(!p.includes(tiret));
});
