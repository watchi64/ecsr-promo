// Version des conditions d'utilisation : l'app (VERSION_CONDITIONS de js/legal-data.js) et la base
// (conditions_version_publiee(), la seule version qu'accepter_conditions enregistre) doivent dire la même chose,
// sinon personne ne peut plus accepter les conditions. La base en vigueur est celle de la dernière migration qui
// définit la fonction (ordre des noms de fichiers, retours exclus).
// Lancer depuis la racine du dépôt : node tests/conditions-version.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { VERSION_CONDITIONS } from "../js/legal-data.js";

const dossier = new URL("../supabase/migrations/", import.meta.url);
const definition = /create\s+or\s+replace\s+function\s+public\.conditions_version_publiee\(\)[\s\S]*?select\s+'([^']+)'::text/i;

const migrations = readdirSync(dossier)
  .filter((f) => f.endsWith(".sql") && !f.endsWith("_retour.sql"))
  .sort()
  .map((f) => ({ f, m: readFileSync(new URL(f, dossier), "utf8").match(definition) }))
  .filter((x) => x.m);

let n = 0;
assert.ok(migrations.length >= 1, "au moins une migration définit conditions_version_publiee()"); n++;
const derniere = migrations[migrations.length - 1];
assert.equal(derniere.m[1], VERSION_CONDITIONS,
  `${derniere.f} publie « ${derniere.m[1]} », js/legal-data.js demande « ${VERSION_CONDITIONS} » : ` +
  "écrire une migration qui remplace conditions_version_publiee() (modèle : 20261114_restes_1_conditions.sql)"); n++;

// Le refus de la base pour une autre version doit rester distinct du refus de forme, que l'app reconnaît.
const restes = readFileSync(new URL("20261114_restes_1_conditions.sql", dossier), "utf8");
assert.match(restes, /raise exception 'Version de conditions inconnue'/, "message de refus attendu par js/legal.js"); n++;
const legal = readFileSync(new URL("../js/legal.js", import.meta.url), "utf8");
assert.match(legal, /Version de conditions inconnue/, "js/legal.js reconnaît le refus d'une version"); n++;

console.log(`conditions-version : ${n} vérifications OK`);
