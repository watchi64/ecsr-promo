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
  assert.equal(ligneDeFiche(f, { jour: "2026-11-15", parId: new Map([[9, "Claire"]]) }).conge, "En congé jusqu'au 15, relais : Claire");
  assert.equal(ligneDeFiche(f, { jour: "2026-11-16", parId: new Map() }).conge, null);
  assert.equal(ligneDeFiche(f, { jour: "2026-11-15", parId: new Map() }).conge, "En congé jusqu'au 15");
  const autreMois = { conge_du: "2026-11-28", conge_au: "2026-12-03", relais_id: 9 };
  assert.equal(ligneDeFiche(autreMois, { jour: "2026-11-30", parId: new Map([[9, "Claire"]]) }).conge,
    "En congé jusqu'au 3 décembre, relais : Claire");
  assert.equal(ligneDeFiche(autreMois, { jour: "2026-12-01", parId: new Map() }).conge, "En congé jusqu'au 3");
  // Le premier du mois se dit « 1er ».
  const premier = { conge_du: "2026-11-28", conge_au: "2026-12-01" };
  assert.equal(ligneDeFiche(premier, { jour: "2026-11-30", parId: new Map() }).conge, "En congé jusqu'au 1er décembre");
  assert.equal(ligneDeFiche({ conge_du: "2026-12-01", conge_au: "2026-12-01" }, { jour: "2026-12-01", parId: new Map() }).conge, "En congé jusqu'au 1er");
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
  // Une date absente des champs envoyés n'est pas jugée : la base la fusionne avec la valeur gardée.
  assert.equal(validerMaFiche({ conge_du: "2026-11-15" }).ok, true);
  assert.equal(validerMaFiche({ conge_au: "2026-11-15" }).ok, true);
  assert.equal(validerMaFiche({ conge_du: "2026-02-30" }).erreurs.conge_du, phrase);
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

// ---- Tâche 6 : fiches à supprimer, liste des financements
import { peutModifierCoordonnees, fichesASupprimer, aQuitte, listeFinancements, validerLibelleFinancement } from "../js/contact-annuaire-rules.js";

test("fiches à supprimer : sans compte, date de départ strictement passée", () => {
  const f = [
    { id: 1, avec_compte: false, depart_le: "2026-11-13", nom_affiche: "Bruno Exemple" },
    { id: 2, avec_compte: false, depart_le: "2026-11-14", nom_affiche: "Aujourd'hui" },
    { id: 3, avec_compte: false, depart_le: null, nom_affiche: "Sans date" },
    { id: 4, avec_compte: true, depart_le: "2026-01-01", nom_affiche: "Avec compte" },
    { id: 5, avec_compte: false, depart_le: "2026-02-01", nom_affiche: "Alice Exemple" },
  ];
  assert.deepEqual(fichesASupprimer(f, "2026-11-14").map((x) => x.id), [5, 1]);
  assert.equal(aQuitte(f[0], "2026-11-14"), true);
  assert.equal(aQuitte(f[1], "2026-11-14"), false);
  assert.deepEqual(fichesASupprimer(null, "2026-11-14"), []);
});

const FIN = [
  { id: 1, libelle: "CPF", ordre: 10, retire: false },
  { id: 2, libelle: "Région", ordre: 20, retire: false },
  { id: 3, libelle: "Autre", ordre: 30, retire: true },
];
test("financements : un geste, la liste entière renumérotée de 10 en 10", () => {
  assert.deepEqual(listeFinancements(FIN, { geste: "renommer", id: 2, libelle: "  Conseil   régional " }),
    [{ id: 1, libelle: "CPF", ordre: 10, retire: false }, { id: 2, libelle: "Conseil régional", ordre: 20, retire: false },
      { id: 3, libelle: "Autre", ordre: 30, retire: true }]);
  assert.deepEqual(listeFinancements(FIN, { geste: "ajouter", libelle: "Pôle emploi" }).at(-1),
    { id: null, libelle: "Pôle emploi", ordre: 40, retire: false });
  assert.equal(listeFinancements(FIN, { geste: "retirer", id: 1, retire: true })[0].retire, true);
  assert.equal(listeFinancements(FIN, { geste: "retirer", id: 3, retire: false })[2].retire, false);
  assert.deepEqual(listeFinancements(FIN, { geste: "deplacer", id: 2, sens: -1 }).map((x) => [x.id, x.ordre]), [[2, 10], [1, 20], [3, 30]]);
  assert.deepEqual(listeFinancements(FIN, { geste: "deplacer", id: 1, sens: -1 }).map((x) => x.id), [1, 2, 3]);
  assert.deepEqual(listeFinancements(FIN, { geste: "deplacer", id: 3, sens: 1 }).map((x) => x.id), [1, 2, 3]);
  assert.equal(FIN[1].libelle, "Région", "la liste reçue n'est pas modifiée");
});
test("financements : nom de 1 à 40 caractères, jamais deux fois le même", () => {
  assert.equal(validerLibelleFinancement("Pôle emploi", FIN), null);
  assert.equal(validerLibelleFinancement("   ", FIN), "Le nom d'un financement compte de 1 à 40 caractères.");
  assert.equal(validerLibelleFinancement("x".repeat(41), FIN), "Le nom d'un financement compte de 1 à 40 caractères.");
  assert.equal(validerLibelleFinancement("cpf", FIN), "Deux financements portent le même nom.");
  assert.equal(validerLibelleFinancement("CPF", FIN, 1), null, "garder son propre nom n'est pas un doublon");
  assert.equal(validerLibelleFinancement("Région", FIN, 1), "Deux financements portent le même nom.");
});

test("coordonnées d'un stagiaire : modifiables par le formateur et par la direction, jamais par soi", () => {
  assert.equal(peutModifierCoordonnees({ soi: false, admin: true, direction: false }), true);
  assert.equal(peutModifierCoordonnees({ soi: false, admin: false, direction: true }), true);
  assert.equal(peutModifierCoordonnees({ soi: false, admin: false, direction: false }), false);
  assert.equal(peutModifierCoordonnees({ soi: true, admin: true, direction: true }), false);
  assert.equal(peutModifierCoordonnees(), false);
});
