// Règles des moyennes EPCF de la classe : nombre de stagiaires évalués, k-anonymat, titres des épreuves et carte de l'état
// vide (même règle que le lot C : une phrase et une action).
// Lancer depuis la racine du dépôt : node tests/epcf-classe-rules.test.mjs
import assert from "node:assert/strict";
import {
  SEUIL_MOYENNE_EPCF, nbEvalues, moyennesMontrables, stagiairesEvalues, titreEpreuve, PHRASE_SANS_MOYENNE, etatVideEpcf,
  ACTIONS_CARTE_EPCF, scoresDuGroupe, etatVideEpcfFiche, ACTIONS_FICHE_EPCF, phraseSansEvaluation,
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
// Sans moyenne montrable, pas de nombre : un stagiaire ne reçoit pas les critères évalués chez un seul camarade
// (k-anonymat en base), il lirait « aucun » alors qu'un stagiaire, peut-être lui, est évalué. La phrase dessous dit ce
// qui manque.
assert.equal(titreEpreuve("Véhicule", [m("COND1", 2, 1)]), "Véhicule");
assert.equal(titreEpreuve("Véhicule", []), "Véhicule");
assert.equal(titreEpreuve("Salle", [m("PREP1", 1.5, 2), m("PREP2", 1, 1)]), "Salle : 2 stagiaires évalués");
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
assert.deepEqual(ACTIONS_CARTE_EPCF["mon-epcf"], { libelle: "Voir mes évaluations EPCF", href: "#/mon-suivi/epcf" });
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

// --- Radar de la fiche : la série « groupe » ne compte que les critères montrables (k-anonymat) ---
const sections = [{ criteres: [{ code: "A" }, { code: "B" }] }, { criteres: [{ code: "C" }] }];
assert.equal(scoresDuGroupe(sections, []), null);
assert.equal(scoresDuGroupe(sections, null), null);
// Rien sur 2 stagiaires : pas de série « groupe » du tout.
assert.equal(scoresDuGroupe(sections, [m("A", 2, 1), m("C", 0, 1)]), null);
// A sur 3 stagiaires est montrable ; B et C, chacun chez un seul stagiaire, ne comptent pas. La phase de C n'a alors
// aucun critère montrable : pas de série du tout (un sommet tracé à 0 se lirait « le groupe est à 0 »).
assert.equal(scoresDuGroupe(sections, [m("A", "2", "3"), m("B", 0, 1), m("C", 1, 1)]), null);
// Chaque phase a un critère montrable : la série, et un critère d'un seul stagiaire n'entre dans aucune phase (la
// première ne vaut que A, sinon elle mêlerait la note exacte de B).
assert.deepEqual(scoresDuGroupe(sections, [m("A", "2", "3"), m("B", 0, 1), m("C", 1, 2)]), [1, 0.5]);
assert.deepEqual(scoresDuGroupe(sections, [m("A", 1, 2), m("B", 2, 2), m("C", 0.5, 4)]), [0.75, 0.25]);

// --- Fiche d'une personne, partie EPCF, aucune épreuve évaluée ---
const aucune = { salle: 0, vehicule: 0 };
// Une épreuve évaluée suffit : la fiche montre son radar, l'autre épreuve dit seulement qu'elle n'est pas évaluée.
assert.equal(etatVideEpcfFiche({ nbEvaluations: { salle: 1, vehicule: 0 }, soi: true }), null);
assert.equal(etatVideEpcfFiche({ nbEvaluations: { salle: 0, vehicule: 2 }, outils: true }), null);
// Le formateur a déjà ses lignes « à évaluer » et ses boutons « Évaluer » : rien de plus dessous.
assert.deepEqual(etatVideEpcfFiche({ nbEvaluations: aucune, outils: true, soi: false }), { carte: false });
// Le stagiaire, sur sa propre fiche : la carte, au tutoiement, et son livret quand le module est ouvert.
assert.deepEqual(etatVideEpcfFiche({ nbEvaluations: aucune, soi: true, livretOuvert: true }), {
  carte: true, titre: "Pas encore d'évaluation EPCF",
  phrase: "Tes résultats apparaîtront ici après ta première épreuve, en salle ou en véhicule.", actions: ["livret"],
});
assert.deepEqual(etatVideEpcfFiche({ nbEvaluations: aucune, soi: true, livretOuvert: false }).actions, []);
// Quelqu'un d'autre qui lit sans évaluer (la direction) : la carte à la troisième personne, sans bouton.
assert.deepEqual(etatVideEpcfFiche({ nbEvaluations: aucune, soi: false, outils: false, livretOuvert: true }), {
  carte: true, titre: "Pas encore d'évaluation EPCF",
  phrase: "Ses résultats apparaîtront ici après sa première épreuve, en salle ou en véhicule.", actions: [],
});
assert.deepEqual(etatVideEpcfFiche({ nbEvaluations: null, soi: true, livretOuvert: true }).actions, ["livret"]);
assert.deepEqual(ACTIONS_FICHE_EPCF.livret, { libelle: "Voir mon livret EPCF", href: "#/mon-suivi/livret" });

// --- Une épreuve pas encore évaluée, quand l'autre l'est ---
assert.equal(phraseSansEvaluation("salle"), "Pas encore d'évaluation en salle.");
assert.equal(phraseSansEvaluation("vehicule"), "Pas encore d'évaluation en véhicule.");

[etatVideEpcfFiche({ nbEvaluations: aucune, soi: true }).phrase, etatVideEpcfFiche({ nbEvaluations: aucune }).phrase,
  phraseSansEvaluation("salle"), ACTIONS_FICHE_EPCF.livret.libelle].forEach((t) => {
  assert.ok(!t.includes("(s)"), t);
  assert.ok(!t.includes(String.fromCharCode(0x2014)), t);
});

console.log("epcf-classe-rules (fiche et radar) : OK");
