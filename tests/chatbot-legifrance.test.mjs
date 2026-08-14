import test from "node:test";
import assert from "node:assert/strict";
import {
  corpsRechercheArticle, extraireIdArticle, formaterArticle, CODE_NAMES,
} from "../supabase/functions/chatbot/legifrance-parse.mjs";

test("corpsRechercheArticle vise NUM_ARTICLE en recherche exacte datee", () => {
  const corps = corpsRechercheArticle("R416-11", "Code de la route", 1755000000000);
  assert.equal(corps.fond, "CODE_DATE");
  assert.equal(corps.recherche.champs[0].typeChamp, "NUM_ARTICLE");
  assert.equal(corps.recherche.champs[0].criteres[0].valeur, "R416-11");
  assert.deepEqual(corps.recherche.filtres[0], { facette: "NOM_CODE", valeurs: ["Code de la route"] });
  assert.equal(corps.recherche.filtres[1].singleDate, 1755000000000);
});

test("extraireIdArticle retrouve l'id du numero exact, sinon null", () => {
  const reponse = { results: [{ sections: [{ extracts: [
    { num: "R416-10", id: "LEGIARTI000AAA" },
    { num: "R416-11", id: "LEGIARTI000BBB" },
  ] }] }] };
  assert.equal(extraireIdArticle(reponse, "R416-11"), "LEGIARTI000BBB");
  assert.equal(extraireIdArticle(reponse, "R999-99"), null);
  assert.equal(extraireIdArticle({}, "R1"), null);
});

test("formaterArticle nettoie le HTML et construit l'URL article_lc", () => {
  const brut = { article: { num: "R416-11", id: "LEGIARTI000CCC",
    texte: "<p>Texte  officiel</p>", etat: "VIGUEUR" } };
  const a = formaterArticle(brut, "R416-11");
  assert.equal(a.num, "R416-11");
  assert.equal(a.etat, "VIGUEUR");
  assert.equal(a.texte, "Texte officiel");
  assert.equal(a.url, "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000CCC/");
});

test("CODE_NAMES couvre les quatre codes du client Python", () => {
  assert.equal(CODE_NAMES.route.nom, "Code de la route");
  assert.ok(CODE_NAMES.penal && CODE_NAMES.procedure_penale && CODE_NAMES.assurances);
});
