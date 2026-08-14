import test from "node:test";
import assert from "node:assert/strict";
import { fournisseursDisponibles, planTentatives } from "../supabase/functions/chatbot/providers.mjs";

function envDe(objet) { return (cle) => objet[cle]; }

test("fournisseursDisponibles ne garde que les cles presentes, Mistral d'abord", () => {
  const les2 = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" }));
  assert.deepEqual(les2.map((f) => f.nom), ["mistral", "gemini"]);
  assert.equal(les2[0].modele, "mistral-small-latest");
  assert.equal(les2[1].modele, "gemini-2.5-flash");

  const seul = fournisseursDisponibles(envDe({ GEMINI_API_KEY: "g" }));
  assert.deepEqual(seul.map((f) => f.nom), ["gemini"]);
  assert.deepEqual(fournisseursDisponibles(envDe({})), []);
});

test("les modeles se surchargent par variable d'environnement", () => {
  const [m] = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-medium-latest" }));
  assert.equal(m.modele, "mistral-medium-latest");
});

test("planTentatives double Mistral (retry) puis passe au suivant", () => {
  const fs = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" }));
  assert.deepEqual(planTentatives(fs).map((f) => f.nom), ["mistral", "mistral", "gemini"]);
});
