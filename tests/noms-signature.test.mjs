import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { displayStagiaire, signatureStagiaire, nomLisible } from "../js/utils.js";

// Deux formats, deux usages (relecture du lot D, 11/11). L'écran écrit « Lucie M. » ; la base garde la signature
// « M. Lucie » dans les champs « qui a modifié », parce que l'effacement des données (_anonymiser_stagiaire) la
// cherche sous cette forme. Changer la signature laisserait le nom d'un stagiaire en base après un effacement.

test("signatureStagiaire : « M. Lucie », la forme que l'effacement des données retrouve", () => {
  assert.equal(signatureStagiaire({ prenom: "Lucie", nom: "Martin" }), "M. Lucie");
  assert.equal(signatureStagiaire({ prenom: "Lucie", nom: "" }), "Lucie");
  assert.equal(signatureStagiaire(null), "");
  const sql = readFileSync(new URL("../supabase/migrations/20261028_roles_2_fonctions.sql", import.meta.url), "utf8");
  assert.match(sql, /upper\(left\(/i, "la fonction d'effacement construit toujours l'initiale suivie du prénom");
});

test("displayStagiaire : « Lucie M. », le format des écrans", () => {
  assert.equal(displayStagiaire({ prenom: "Lucie", nom: "Martin" }), "Lucie M.");
});

test("nomLisible : une signature lue en base s'affiche dans l'ordre des écrans", () => {
  assert.equal(nomLisible("M. Lucie"), "Lucie M.");
  assert.equal(nomLisible(nomLisible("M. Lucie")), "Lucie M.", "appliqué deux fois, rien ne bouge");
  assert.equal(nomLisible("lucie@example.invalid"), "lucie@example.invalid");
  assert.equal(nomLisible("Jean Dupont"), "Jean Dupont");
  assert.equal(nomLisible(null), "");
});

test("auth-admin : la signature enregistrée reste signatureStagiaire, l'affichage passe par getProfileNom", () => {
  const src = readFileSync(new URL("../js/auth-admin.js", import.meta.url), "utf8");
  const corps = src.slice(src.indexOf("export function getProfileWho"), src.indexOf("export function getProfileNom"));
  assert.match(corps, /signatureStagiaire\(s\)/);
  assert.doesNotMatch(corps, /displayStagiaire\(/);
});
