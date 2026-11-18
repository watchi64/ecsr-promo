import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTIL = join(RACINE, "outils", "recette_courriel.mjs");
// Aucune clé dans l'environnement du test : rien ne peut partir.
const ENV = { ...process.env, RESEND_API_KEY: "" };

function lancer(args) {
  return spawnSync(process.execPath, [OUTIL, ...args], { cwd: RACINE, env: ENV, encoding: "utf8" });
}

test("--a-blanc : l'e-mail s'affiche, sans motif ni texte, avec trois liens vers le banc", () => {
  const r = lancer(["--a-blanc", "--a", "destinataire@exemple.invalid"]);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /personnel|santé|sante|rdv/i);
  const liens = new Set(r.stdout.match(/http:\/\/localhost:8000\/_harness_demande\.html#j=[A-Za-z0-9_-]{43}/g) || []);
  assert.equal(liens.size, 3);
  assert.match(r.stdout, /destinataire@exemple\.invalid/);
  assert.match(r.stdout, /jeudi 19 novembre, matin/);
});

test("sans --a : code de sortie 2", () => {
  const r = lancer(["--a-blanc"]);
  assert.equal(r.status, 2);
});

test("envoi réel vers une adresse fictive : refusé (code 2) avant tout réseau", () => {
  const r = lancer(["--a", "destinataire@exemple.invalid"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /fictive/);
});

test("envoi réel sans clé : refusé (code 3), rien ne part", () => {
  const r = lancer(["--a", "quelquun@centre-ecsr.internal"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /RESEND_API_KEY/);
});
