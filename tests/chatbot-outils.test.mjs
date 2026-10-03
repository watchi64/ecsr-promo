import test from "node:test";
import assert from "node:assert/strict";
import { OUTILS, construirePromptSysteme, etiquetteCours } from "../supabase/functions/chatbot/outils.mjs";
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

test("le prompt systeme demande de citer aussi les competences", () => {
  const p = construirePromptSysteme({ aide: "CORPUS_TEST", page: "themes" });
  assert.ok(p.includes("Compétence"), "le prompt cite aussi les cours de competence");
  assert.ok(p.includes("thèmes, compétences, sections et liens"), "la ligne Sources liste aussi les competences");
});

test("le corpus d'aide est substantiel et sans tiret cadratin", () => {
  assert.ok(AIDE_APP.length > 1500);
  assert.ok(!AIDE_APP.includes("\u2014"));
});

test("le corpus d'aide ne promet les cours de conduite C1 a C4 qu'au fil de leur publication", () => {
  assert.ok(AIDE_APP.includes("au fil de leur publication par les formateurs"));
  assert.ok(!AIDE_APP.includes("Compétences porte aussi les cours"), "plus d'affirmation inconditionnelle");
});

test("etiquetteCours : une ligne a code donne le libelle de competence", () => {
  assert.equal(
    etiquetteCours({ numero: null, code: "C2.4", titre: "Tourner a droite et a gauche en agglomeration" }),
    "Competence C2.4 : Tourner a droite et a gauche en agglomeration",
  );
  assert.equal(
    etiquetteCours({ numero: null, code: "C1", titre: "Maitriser le maniement du vehicule" }),
    "Competence C1 : Maitriser le maniement du vehicule",
  );
});

test("etiquetteCours : une ligne a numero et code null donne le libelle de theme sur deux chiffres", () => {
  assert.equal(etiquetteCours({ numero: 22, code: null, titre: "Feux du vehicule" }), "Theme 22 : Feux du vehicule");
  assert.equal(etiquetteCours({ numero: 7, code: null, titre: "Vitesse" }), "Theme 07 : Vitesse");
});

test("etiquetteCours : une ligne de l'ancienne forme, sans cle code, donne le libelle de theme", () => {
  const ancienne = { numero: 5, titre: "Alcool et stupefiants" };
  assert.ok(!("code" in ancienne));
  assert.equal(etiquetteCours(ancienne), "Theme 05 : Alcool et stupefiants");
});
