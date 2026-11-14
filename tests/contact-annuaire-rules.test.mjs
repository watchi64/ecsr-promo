// Règles de l'annuaire de l'espace contact. Lancer : node tests/contact-annuaire-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  libelleTitres, enConge, ligneDeFiche, phraseDelegue, exigerLignes, trierFiches, validerMaFiche,
} from "../js/contact-annuaire-rules.js";

test("titres : une promo, plusieurs promos, plusieurs titres", () => {
  assert.equal(libelleTitres([{ nom: "Formateur", niveau: "promo", promos: 1 }]), "Formateur");
  assert.equal(libelleTitres([{ nom: "Formateur", niveau: "promo", promos: 2 }]), "Formateur · 2 promos");
  assert.equal(libelleTitres([{ nom: "Secrétariat", niveau: "centre" }, { nom: "Formateur", niveau: "promo", promos: 1 }]),
    "Secrétariat, Formateur");
  assert.equal(libelleTitres([]), "");
  assert.equal(libelleTitres(null), "");
});
test("le numéro devient un lien d'appel sans espaces", () => {
  assert.equal(ligneDeFiche({ telephone: "04 12 34 56 78" }, { jour: "2026-11-14" }).appeler, "tel:0412345678");
  assert.equal(ligneDeFiche({ telephone: "+33 (0)4 12-34.56.78" }, { jour: "2026-11-14" }).appeler, "tel:+330412345678");
  assert.equal(ligneDeFiche({ telephone: null }, { jour: "2026-11-14" }).appeler, null);
});
test("congé : relais nommé, borne incluse", () => {
  const f = { conge_du: "2026-11-10", conge_au: "2026-11-15", relais_id: 9 };
  assert.equal(ligneDeFiche(f, { jour: "2026-11-15", parId: new Map([[9, "Claire"]]) }).conge, "Absente jusqu'au 15, relais : Claire");
  assert.equal(ligneDeFiche(f, { jour: "2026-11-16", parId: new Map() }).conge, null);
  assert.equal(ligneDeFiche(f, { jour: "2026-11-15", parId: new Map() }).conge, "Absente jusqu'au 15");
  assert.equal(enConge(f, "2026-11-10"), true);
  assert.equal(enConge(f, "2026-11-09"), false);
  assert.equal(enConge({}, "2026-11-10"), false);
});
test("ma fiche : 81 caractères refusés", () => {
  assert.equal(validerMaFiche({ pour_quoi: "x".repeat(81) }).erreurs.pour_quoi, "80 caractères au plus.");
  assert.equal(validerMaFiche({ pour_quoi: "x".repeat(80) }).ok, true);
});
test("ma fiche : e-mail, téléphone et congé suivent la base", () => {
  assert.equal(validerMaFiche({ email: "pas-un-mail" }).erreurs.email, "Adresse e-mail invalide.");
  assert.equal(validerMaFiche({ email: "claire@exemple.invalid" }).ok, true);
  assert.equal(validerMaFiche({ telephone: "abc" }).erreurs.telephone, "Numéro de téléphone invalide.");
  assert.equal(validerMaFiche({ telephone: "04 12 34 56 78" }).ok, true);
  assert.equal(validerMaFiche({ email: "", telephone: null }).ok, true);
  const phrase = "Les dates du congé ne se suivent pas.";
  assert.equal(validerMaFiche({ conge_du: "2026-11-15", conge_au: "2026-11-10" }).erreurs.conge_au, phrase);
  assert.equal(validerMaFiche({ conge_du: "2026-11-15", conge_au: null }).erreurs.conge_au, phrase);
  assert.equal(validerMaFiche({ conge_du: "2026-02-30", conge_au: "2026-03-01" }).erreurs.conge_du, phrase);
  assert.equal(validerMaFiche({ conge_du: "2026-11-10", conge_au: "2026-11-10" }).ok, true);
  assert.equal(validerMaFiche({}).ok, true);
});
test("pour quoi : la note sert de repli", () => {
  assert.equal(ligneDeFiche({ pour_quoi: null, note: "si X et Y indisponibles" }, { jour: "2026-11-19" }).pourQuoi,
    "si X et Y indisponibles");
  assert.equal(ligneDeFiche({ pour_quoi: "Absences", note: "autre" }, { jour: "2026-11-19" }).pourQuoi, "Absences");
});
test("écrire : suit joignable", () => {
  assert.equal(ligneDeFiche({ joignable: true }, {}).ecrire, true);
  assert.equal(ligneDeFiche({}, {}).ecrire, false);
});
test("délégué : 23505 devient une phrase", () => {
  assert.equal(phraseDelegue("23505"), "Il y a déjà un délégué de ce rang dans cette promo.");
  assert.equal(phraseDelegue("42501"), null);
  assert.equal(phraseDelegue(undefined), null);
});
test("une écriture qui ne touche aucune ligne lève", () => {
  assert.throws(() => exigerLignes([], "Cette fiche ne peut pas être modifiée d'ici."), /modifiée d'ici/);
  assert.throws(() => exigerLignes(null, "x"), /x/);
  assert.deepEqual(exigerLignes([{ id: 1 }], "x"), [{ id: 1 }]);
});
test("tri : ordre, puis nom ; l'entrée n'est pas modifiée", () => {
  const e = [{ ordre: 20, nom_affiche: "Zoé" }, { ordre: 10, nom_affiche: "Émile" }, { ordre: 10, nom_affiche: "Albert" }, { nom_affiche: "Ada" }];
  assert.deepEqual(trierFiches(e).map((f) => f.nom_affiche), ["Albert", "Émile", "Zoé", "Ada"]);
  assert.equal(e[0].nom_affiche, "Zoé");
});
