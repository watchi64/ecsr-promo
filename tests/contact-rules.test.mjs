// Routage des demandes de l'espace contact : la table de parité commune au JS et à la base. Lancer : node tests/contact-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routerDemande } from "../js/contact-rules.js";

const table = JSON.parse(readFileSync(new URL("./fixtures/contact-routage.json", import.meta.url), "utf8"));

test("la table de parité porte les cas demandés, chacun avec ses entrées et son attendu", () => {
  const noms = table.cas.map((c) => c.nom);
  for (const nom of ["mode_choix", "absence_cpf", "absence_sans_financement_defaut", "absence_choix_precoche", "retard_regle_formateurs_du_jour",
    "retard_sans_regle_choix", "retard_regle_planning_vide_defaut", "type_sans_regle_defaut", "titulaire_en_conge_relais",
    "relais_en_conge_defaut", "relais_et_defaut_en_conge_choix", "relais_autre_centre", "liste_vide"]) {
    assert.ok(noms.includes(nom), `cas ${nom}`);
  }
  assert.equal(new Set(noms).size, noms.length, "noms uniques");
  for (const c of table.cas) {
    assert.ok(c.entree && c.attendu, c.nom);
    assert.deepEqual(Object.keys(c.attendu).sort(), ["mode", "possibles", "principaux", "source"], c.nom);
  }
});

for (const c of table.cas) {
  test(`parité : ${c.nom}`, () => {
    assert.deepEqual(routerDemande(c.entree), c.attendu);
  });
}

test("le délégué n'est jamais principal : un stagiaire n'est ni une fiche ni un possible", () => {
  // Une règle qui viserait une fiche inconnue (absente des fiches du centre) ne route rien : mode choix.
  const r = routerDemande({ type: "autre", aujourdhui: "2031-03-04", regles: [{ type: "autre", financement_id: null, cible: "fiche", fiche_id: 99 }],
    fiches: [], possibles: [3, 1, 2] });
  assert.equal(r.mode, "choix");
  assert.deepEqual(r.possibles.map((p) => p.fiche_id), [1, 2, 3]);
});

test("identifiants numériques triés par valeur ; doublons de formateurs du jour retirés ; entrées vides", () => {
  const r = routerDemande({ type: "retard", aujourdhui: "2031-03-04", regles: [{ type: "retard", financement_id: null, cible: "formateurs_du_jour", fiche_id: null }],
    fiches: [{ fiche_id: 10, nom: "a" }, { fiche_id: 9, nom: "b" }], formateurs_du_jour: [10, 9, 10] });
  assert.deepEqual(r, { mode: "regle", principaux: [{ fiche_id: 9, relais_de: null }, { fiche_id: 10, relais_de: null }], source: "regle_type", possibles: [] });
  assert.deepEqual(routerDemande({ type: "autre", aujourdhui: "2031-03-04" }), { mode: "choix", principaux: [], source: null, possibles: [] });
});
