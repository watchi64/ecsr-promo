import test from "node:test";
import assert from "node:assert/strict";
import { OUTILS, construirePromptSysteme } from "../supabase/functions/chatbot/outils.mjs";
import { AIDE_APP } from "../supabase/functions/chatbot/aide.mjs";

test("OUTILS expose les deux outils au format OpenAI", () => {
  const noms = OUTILS.map((o) => o.function.name);
  assert.deepEqual(noms, ["chercher_dans_les_cours", "consulter_article_legifrance"]);
  for (const o of OUTILS) {
    assert.equal(o.type, "function");
    assert.equal(o.function.parameters.type, "object");
    assert.ok(o.function.parameters.required.length >= 1);
  }
});

test("le prompt systeme porte la regle d'or, la page et l'aide", () => {
  const p = construirePromptSysteme({ aide: "CORPUS_TEST", page: "planning" });
  assert.ok(p.includes("planning"));
  assert.ok(p.includes("CORPUS_TEST"));
  assert.ok(p.includes("consulter_article_legifrance"));
  assert.ok(/jamais|INTERDICTION/i.test(p));
  assert.ok(!p.includes("\u2014"), "pas de tiret cadratin dans le prompt");
});

test("le corpus d'aide est substantiel et sans tiret cadratin", () => {
  assert.ok(AIDE_APP.length > 1500);
  assert.ok(!AIDE_APP.includes("\u2014"));
});
