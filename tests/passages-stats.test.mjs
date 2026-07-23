// tests/passages-stats.test.mjs
// node tests/passages-stats.test.mjs
import { statsPassages } from "../js/passages-stats.js";

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log("  ok   " + label); }
  else { failures++; console.error("  FAIL " + label + "\n    attendu " + e + "\n    obtenu  " + a); }
}

// Base : salle + voiture comptées, avec élève, répartition formateur
check("cas nominal", statsPassages([
  { type: "Salle",   resultat: "Effectué", avec_eleve: null,  prof_id: null },
  { type: "Salle",   resultat: "Effectué", avec_eleve: null,  prof_id: null },
  { type: "Voiture", resultat: "Effectué", avec_eleve: true,  prof_id: 1 },
  { type: "Voiture", resultat: "Effectué", avec_eleve: false, prof_id: 2 },
]), { salle: 2, voiture: 2, avecEleve: 1, byProf: { 1: 1, 2: 1 } });

// Règle d'équité : Absence compte, Bonus et Report non (mais restent listables ailleurs)
check("bonus/report exclus, absence comptée", statsPassages([
  { type: "Salle",   resultat: "Absence",  avec_eleve: null, prof_id: null },
  { type: "Salle",   resultat: "Bonus",    avec_eleve: null, prof_id: null },
  { type: "Voiture", resultat: "Report",   avec_eleve: true, prof_id: 1 },
]), { salle: 1, voiture: 0, avecEleve: 0, byProf: {} });

// avec_eleve NULL (historique inconnu) ne compte pas comme « avec élève »
check("avec_eleve null ignoré", statsPassages([
  { type: "Voiture", resultat: "Effectué", avec_eleve: null, prof_id: 1 },
]), { salle: 0, voiture: 1, avecEleve: 0, byProf: { 1: 1 } });

// Robustesse : liste vide / prof_id absent
check("liste vide", statsPassages([]), { salle: 0, voiture: 0, avecEleve: 0, byProf: {} });
check("voiture sans formateur", statsPassages([
  { type: "Voiture", resultat: "Effectué", avec_eleve: true, prof_id: null },
]), { salle: 0, voiture: 1, avecEleve: 1, byProf: {} });

if (failures) { console.error(failures + " échec(s)"); process.exit(1); }
console.log("Tous les tests passent.");
