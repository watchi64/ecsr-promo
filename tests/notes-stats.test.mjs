// Statistiques de groupe de la page Notes. Le même jeu de notes et les mêmes attendus sont
// rejoués côté base par tests/sql/confidentialite-preuve.sql (fonction notes_stats_groupe) :
// toute divergence entre le calcul local et le serveur se voit dans l'un ou l'autre.
// Lancer depuis la racine du dépôt : node tests/notes-stats.test.mjs
import assert from "node:assert/strict";
import {
  statsLocales, statsServeur, moyenneGenerale, moyenneCompetence, moyenneThemes, statsParTheme,
} from "../js/notes-stats.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const proche = (a, b, msg) => { assert.ok(Math.abs(a - b) < 1e-9, `${msg} : ${a} au lieu de ${b}`); n++; };

// Jeu de référence (stagiaires 1, 2, 3 actifs, 4 abandon).
export const JEU = [
  { stagiaire_id: 1, type: "Thème", theme_numero: 1, note: 10, note_max: 20 },
  { stagiaire_id: 1, type: "Thème", theme_numero: 1, note: 15, note_max: 20 },
  { stagiaire_id: 2, type: "Thème", theme_numero: 1, note: 4, note_max: 5 },
  { stagiaire_id: 2, type: "Thème", theme_numero: 2, note: 8, note_max: 20 },
  { stagiaire_id: 3, type: "Compétence", competence_code: "C1", note: 20, note_max: 20 },
  { stagiaire_id: 4, type: "Thème", theme_numero: 2, note: 3, note_max: 20 },
  { stagiaire_id: 3, type: "Thème", theme_numero: 3, note: null, note_max: 20 },   // non notée
  { stagiaire_id: 1, type: "Thème", theme_numero: 2, note: 5, note_max: 0 },       // barème nul
  { stagiaire_id: 2, type: "Compétence", competence_code: "C2", note: 12, note_max: 20 },
];
const ACTIFS = new Set([1, 2, 3]);

const st = statsLocales(JEU, ACTIFS);
eq(st.n_lignes, 9, "toutes les lignes comptent dans l'en-tête");
eq(st.n, 7, "7 notes renseignées");
proche(st.somme, 84, "somme des scores sur 20");
eq(st.mediane, 12, "médiane de 3, 8, 10, 12, 15, 16, 20");
eq(st.sous_10, 2, "deux notes sous 10");
eq(st.repartition, [1, 0, 2, 2, 2], "répartition par tranche");
eq(st.themes, [
  { num: 1, n: 3, somme: 41, mediane: 15 },
  { num: 2, n: 2, somme: 11, mediane: 5.5 },
], "thèmes (le 3 n'a aucune note renseignée)");
eq(st.competences, [{ code: "C1", n: 1, somme: 20 }, { code: "C2", n: 1, somme: 12 }], "compétences");
eq(st.moy_stagiaire_max, 20, "meilleure moyenne individuelle (actifs)");
eq(st.moy_stagiaire_min, 12, "plus faible moyenne individuelle (l'abandon à 3 ne compte pas)");

proche(moyenneGenerale(st), 12, "moyenne générale");
proche(moyenneCompetence(st, "C2"), 12, "moyenne d'une compétence");
eq(moyenneCompetence(st, "C9"), null, "compétence sans note");
proche(moyenneThemes(st, [1, 2]), 10.4, "colonne de deux thèmes regroupés : 52 / 5");
eq(moyenneThemes(st, [9]), null, "thème sans note");

const parTheme = statsParTheme(st, [
  { numero: 2, titre: "Deux" }, { numero: 1, titre: "Un" }, { numero: 3, titre: "Trois" }, { numero: null },
]);
eq(parTheme.map((t) => t.num), [2, 1], "ordre des thèmes officiels, sans les thèmes vides");
proche(parTheme[1].avg, 41 / 3, "moyenne du thème 1");
eq(parTheme[0].med, 5.5, "médiane du thème 2");

// La réponse du serveur, une fois normalisée, a exactement la forme locale.
const serveur = statsServeur(JSON.parse(JSON.stringify(st)));
eq(serveur, st, "statsServeur conserve la forme");
eq(statsServeur(null).repartition, [0, 0, 0, 0, 0], "réponse absente : répartition à zéro");
eq(moyenneGenerale(statsServeur(null)), null, "réponse absente : pas de moyenne");

// Jeu vide
const vide = statsLocales([], new Set());
eq([vide.n, vide.mediane, vide.moy_stagiaire_max, moyenneGenerale(vide)], [0, null, null, null], "jeu vide");

console.log(`notes-stats : ${n} vérifications OK`);
