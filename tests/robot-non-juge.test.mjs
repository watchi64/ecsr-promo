// Robot des parcours (lot I, mineur 5) : le contrôle « aucun nom de stagiaire » devient « non jugé » (NonJuge, le mécanisme INCOMPLET,
// code 2 du robot) quand la liste des noms lus dans les fichiers du banc est trop courte, jamais vert. Joué en Python, sans navigateur.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUTILS = fileURLToPath(new URL("../outils", import.meta.url));
const python = spawnSync("python", ["--version"], { encoding: "utf8" });
const SANS_PYTHON = python.error ? "python absent" : false;
// Les fichiers du banc ne sont pas versionnés : sans eux (dépôt neuf), le second test n'a rien à lire.
const SANS_BANC = ["_harness_supabase.js", "_banc_centre_demo.js"].some((f) => !existsSync(new URL("../" + f, import.meta.url))) ? "fichiers du banc absents" : false;

function jouer(code) {
  return spawnSync("python", ["-X", "utf8", "-c", code], { cwd: OUTILS, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
}

test("fichiers du banc absents : le contrôle des noms est non jugé", { skip: SANS_PYTHON }, () => {
  const r = jouer(`
import pathlib, tempfile
from parcours import banc, direction
from parcours.visite import NonJuge
banc.RACINE = pathlib.Path(tempfile.mkdtemp())
direction.paires_de_noms()
try:
    direction.exiger_assez_de_noms(direction._NB_PAIRES_LUES, "la vue d'ensemble")
    print("VERT")
except NonJuge as e:
    print("NONJUGE", e)
`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^NONJUGE .*trop courte \(0 lus/);
});

test("fichiers du banc présents : assez de noms, le contrôle se joue", { skip: SANS_PYTHON || SANS_BANC }, () => {
  const r = jouer(`
from parcours import direction
direction.paires_de_noms()
direction.exiger_assez_de_noms(direction._NB_PAIRES_LUES, "la vue d'ensemble")
print("ASSEZ", direction._NB_PAIRES_LUES >= direction.MIN_PAIRES_LUES)
`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ASSEZ True/);
});
