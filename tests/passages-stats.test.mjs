import assert from "node:assert/strict";
import { statsPassages } from "../js/passages-stats.js";

// Base : salle + voiture comptées, avec élève, répartition formateur
assert.deepEqual(
  statsPassages([
    { type: "Salle",   resultat: "Effectué", avec_eleve: null,  prof_id: null },
    { type: "Salle",   resultat: "Effectué", avec_eleve: null,  prof_id: null },
    { type: "Voiture", resultat: "Effectué", avec_eleve: true,  prof_id: 1 },
    { type: "Voiture", resultat: "Effectué", avec_eleve: false, prof_id: 2 },
  ]),
  { salle: 2, voiture: 2, avecEleve: 1, byProf: { 1: 1, 2: 1 } });

// Règle d'équité : Absence compte, Bonus et Report non (mais restent listables ailleurs)
assert.deepEqual(
  statsPassages([
    { type: "Salle",   resultat: "Absence",  avec_eleve: null, prof_id: null },
    { type: "Salle",   resultat: "Bonus",    avec_eleve: null, prof_id: null },
    { type: "Voiture", resultat: "Report",   avec_eleve: true, prof_id: 1 },
  ]),
  { salle: 1, voiture: 0, avecEleve: 0, byProf: {} });

// avec_eleve NULL (historique inconnu) ne compte pas comme « avec élève »
assert.deepEqual(
  statsPassages([
    { type: "Voiture", resultat: "Effectué", avec_eleve: null, prof_id: 1 },
  ]),
  { salle: 0, voiture: 1, avecEleve: 0, byProf: { 1: 1 } });

// Robustesse : liste vide / prof_id absent
assert.deepEqual(
  statsPassages([]),
  { salle: 0, voiture: 0, avecEleve: 0, byProf: {} });

assert.deepEqual(
  statsPassages([
    { type: "Voiture", resultat: "Effectué", avec_eleve: true, prof_id: null },
  ]),
  { salle: 0, voiture: 1, avecEleve: 1, byProf: {} });

console.log("passages-stats : 5 assertions OK");
