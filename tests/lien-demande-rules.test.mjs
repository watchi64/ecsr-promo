// Règles de la page des liens d'e-mail. Lancer : node tests/lien-demande-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { jetonDeLAdresse, etatDeLaPage, libelleAction } from "../js/lien-demande-rules.js";

const JETON = "A".repeat(20) + "b_-" + "0".repeat(20);

test("jetonDeLAdresse : #j= et 43 caractères base64url, sinon nul", () => {
  assert.equal(JETON.length, 43);
  assert.equal(jetonDeLAdresse(`#j=${JETON}`), JETON);
  assert.equal(jetonDeLAdresse("#j=abc"), null);
  assert.equal(jetonDeLAdresse(`#j=${JETON}x`), null);
  assert.equal(jetonDeLAdresse(`#k=${JETON}`), null);
  assert.equal(jetonDeLAdresse(`#j=${"+".repeat(43)}`), null);
  assert.equal(jetonDeLAdresse(""), null);
  assert.equal(jetonDeLAdresse(undefined), null);
});

test("etatDeLaPage : l'ouverture rend a_confirmer, jamais fait sans toucher", () => {
  assert.equal(etatDeLaPage({ invalide: true }), "invalide");
  assert.equal(etatDeLaPage(null), "invalide");
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "prise", libelle_reponse: null, deja: false }), "a_confirmer");
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "reponse", libelle_reponse: "Absence enregistrée", deja: false }), "a_confirmer");
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "voir", libelle_reponse: null, deja: false }), "voir");
  assert.equal(etatDeLaPage({ fait: true }), "fait");
});

test("etatDeLaPage : deja après une action faite (lien rouvert, ou second toucher)", () => {
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "prise", libelle_reponse: null, deja: true }), "deja");
  assert.equal(etatDeLaPage({ deja: true }), "deja");
});

test("libelleAction", () => {
  assert.equal(libelleAction("prise", null), "Pris en compte");
  assert.equal(libelleAction("reponse", "Absence enregistrée"), "Absence enregistrée");
  assert.equal(libelleAction("justificatif", null), "Justificatif reçu");
  assert.equal(libelleAction("reponse", "Justificatif reçu"), "Justificatif reçu");
});
