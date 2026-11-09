// Règles des moyennes EPCF de la classe : nombre de stagiaires évalués, k-anonymat, titres des épreuves et carte de l'état
// vide (même règle que le lot C : une phrase et une action).
// Lancer depuis la racine du dépôt : node tests/epcf-classe-rules.test.mjs
import assert from "node:assert/strict";
import {
  SEUIL_MOYENNE_EPCF, nbEvalues, moyennesMontrables, stagiairesEvalues, titreEpreuve, PHRASE_SANS_MOYENNE, etatVideEpcf,
  ACTIONS_CARTE_EPCF,
} from "../js/epcf-classe-rules.js";

const m = (critere, moyenne, effectif) => ({ critere, moyenne, effectif });

// --- Nombre de stagiaires évalués : le plus grand effectif d'un critère (la RPC peut rendre des chaînes) ---
assert.equal(SEUIL_MOYENNE_EPCF, 2);
assert.equal(nbEvalues([]), 0);
assert.equal(nbEvalues(null), 0);
assert.equal(nbEvalues(undefined), 0);
assert.equal(nbEvalues([m("PREP1", "1.5", "3"), m("PREP2", 1, 1)]), 3);
assert.equal(nbEvalues([m("PREP1", 1, "abc")]), 0);

// --- k-anonymat : une moyenne n'est montrée qu'à partir de 2 stagiaires évalués ---
assert.deepEqual(moyennesMontrables([m("A", 1, 1), m("B", 1.5, "2"), m("C", 2, 3)]).map((x) => x.critere), ["B", "C"]);
assert.deepEqual(moyennesMontrables(null), []);

// --- Le pluriel s'accorde, jamais « stagiaire(s) évalué(s) » ---
assert.equal(stagiairesEvalues(0), "aucun stagiaire évalué");
assert.equal(stagiairesEvalues(1), "1 stagiaire évalué");
assert.equal(stagiairesEvalues(3), "3 stagiaires évalués");
assert.equal(titreEpreuve("Salle", [m("PREP1", 1.5, 3)]), "Salle : 3 stagiaires évalués");
assert.equal(titreEpreuve("Véhicule", [m("COND1", 2, 1)]), "Véhicule : 1 stagiaire évalué");
assert.equal(titreEpreuve("Véhicule", []), "Véhicule : aucun stagiaire évalué");
assert.equal(PHRASE_SANS_MOYENNE, "La moyenne apparaîtra à partir de deux stagiaires évalués.");

// --- La carte vide : seulement quand aucune épreuve n'a de moyenne montrable ---
const vide = { salle: [], vehicule: [] };
const unEnSalle = { salle: [m("PREP1", 2, 1)], vehicule: [] };
const unEnVehicule = { salle: [], vehicule: [m("COND1", 2, 1)] };
const unPartout = { salle: [m("PREP1", 2, 1)], vehicule: [m("COND1", 1, 1)] };
const phrase = "Les moyennes de la classe apparaîtront dès que deux stagiaires auront passé la même épreuve, en salle ou en véhicule.";

// Une épreuve montrable suffit : pas de carte (la page montre le tableau, et l'autre épreuve dit ce qui lui manque).
assert.equal(etatVideEpcf({ moyennesParEpreuve: { salle: [m("PREP1", 1.5, 2)], vehicule: [] }, contexte: "classe-stagiaire" }), null);
assert.equal(etatVideEpcf({ moyennesParEpreuve: { salle: [], vehicule: [m("COND1", 1.8, "3")] }, contexte: "equipe-matrice" }), null);

// Stagiaire : ses propres résultats EPCF, sans avancement de la classe.
assert.deepEqual(etatVideEpcf({ moyennesParEpreuve: vide, contexte: "classe-stagiaire" }),
  { titre: "Pas encore de moyennes EPCF", phrase, avancement: null, actions: ["mon-epcf"] });
assert.equal(etatVideEpcf({ moyennesParEpreuve: unEnSalle, contexte: "classe-stagiaire" }).avancement, null);

// Formateur, sur la page de l'équipe ou dans La classe : évaluer un stagiaire, et l'avancement dès qu'un stagiaire est évalué.
assert.deepEqual(etatVideEpcf({ moyennesParEpreuve: vide, contexte: "equipe-matrice" }),
  { titre: "Pas encore de moyennes EPCF", phrase, avancement: null, actions: ["evaluer"] });
assert.deepEqual(etatVideEpcf({ moyennesParEpreuve: vide, contexte: "classe-formateur" }).actions, ["evaluer"]);
assert.equal(etatVideEpcf({ moyennesParEpreuve: unEnSalle, contexte: "classe-formateur" }).avancement,
  "Pour l'instant : 1 stagiaire évalué en salle, aucun en véhicule.");
assert.equal(etatVideEpcf({ moyennesParEpreuve: unEnVehicule, contexte: "equipe-matrice" }).avancement,
  "Pour l'instant : 1 stagiaire évalué en véhicule, aucun en salle.");
assert.equal(etatVideEpcf({ moyennesParEpreuve: unPartout, contexte: "equipe-matrice" }).avancement,
  "Pour l'instant : 1 stagiaire évalué en salle, 1 en véhicule.");

// Direction : elle lit sans écrire, donc pas de bouton ; l'avancement, oui.
assert.deepEqual(etatVideEpcf({ moyennesParEpreuve: unEnSalle, contexte: "direction" }), {
  titre: "Pas encore de moyennes EPCF", phrase,
  avancement: "Pour l'instant : 1 stagiaire évalué en salle, aucun en véhicule.", actions: [],
});

// Contexte inconnu ou absent : la carte, sans bouton ni avancement.
assert.deepEqual(etatVideEpcf({ moyennesParEpreuve: unEnSalle, contexte: undefined }),
  { titre: "Pas encore de moyennes EPCF", phrase, avancement: null, actions: [] });
assert.deepEqual(etatVideEpcf({ moyennesParEpreuve: null, contexte: "classe-stagiaire" }).actions, ["mon-epcf"]);

// Les actions rendues sont une copie : la modifier ne change pas la règle.
etatVideEpcf({ moyennesParEpreuve: vide, contexte: "equipe-matrice" }).actions.push("x");
assert.deepEqual(etatVideEpcf({ moyennesParEpreuve: vide, contexte: "equipe-matrice" }).actions, ["evaluer"]);

// Où mènent les boutons : le stagiaire à sa propre partie EPCF de Mon suivi ; le formateur à la page Stagiaires, sur la
// liste (et non sur les élèves bénévoles, que la page rouvre si c'est son dernier sous-onglet).
assert.deepEqual(ACTIONS_CARTE_EPCF["mon-epcf"], { libelle: "Voir mon EPCF", href: "#/mon-suivi/epcf" });
assert.deepEqual(ACTIONS_CARTE_EPCF.evaluer, { libelle: "Évaluer un stagiaire", href: "#/stagiaires", sousOnglet: "stagiaires" });
// Chaque action qu'une carte peut proposer a sa destination.
["classe-stagiaire", "classe-formateur", "equipe-matrice", "direction"].forEach((contexte) => {
  etatVideEpcf({ moyennesParEpreuve: vide, contexte }).actions.forEach((a) => assert.ok(ACTIONS_CARTE_EPCF[a], contexte + " : " + a));
});

// Aucun texte ne porte de pluriel entre parenthèses ni de tiret cadratin.
const textes = [phrase, PHRASE_SANS_MOYENNE, stagiairesEvalues(0), stagiairesEvalues(1), stagiairesEvalues(2),
  etatVideEpcf({ moyennesParEpreuve: unPartout, contexte: "direction" }).avancement];
textes.forEach((t) => { assert.ok(!t.includes("(s)"), t); assert.ok(!t.includes(String.fromCharCode(0x2014)), t); });

console.log("epcf-classe-rules : OK");
