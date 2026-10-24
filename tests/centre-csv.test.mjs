// Export CSV de la matrice des notes (tableau de bord du centre, spec 2026-10-23).
// Lancer depuis la racine du dépôt : node tests/centre-csv.test.mjs
import assert from "node:assert/strict";
import { matriceNotesCsv, nomFichierCsv } from "../js/centre-csv.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

const STAG = [
  { id: 1, prenom: "Zoé", nom: "BERT", actif: true },
  { id: 2, prenom: "Luc", nom: "ARNAUD", actif: true },
  { id: 3, prenom: "Max", nom: "=CMD", actif: true },
  { id: 4, prenom: "Ana", nom: "DU;PONT \"dit\"", actif: true },
  { id: 5, prenom: "Eve", nom: "ABANDON", actif: false },
];
const E = (id, stagiaire_id, type, cle, note, note_max, date_eval) => ({
  id, stagiaire_id, type, note, note_max, date_eval,
  theme_numero: type === "Thème" ? cle : null,
  competence_code: type === "Compétence" ? cle : null,
  controle_libelle: type === "Contrôle" ? cle : null,
});
const EVALS = [
  E(1, 1, "Thème", 1, 10, 20, "2026-10-01"),
  E(2, 1, "Thème", 1, 15, 20, "2026-10-05"),       // la plus récente : 15
  E(3, 1, "Compétence", "C1", 8, 10, "2026-10-02"), // 16 sur 20
  E(4, 1, "Thème", 46, 13.25, 20, "2026-10-03"),    // 13,3 dans la colonne 46-47
  E(5, 1, "Contrôle", "Contrôle blanc", 12, 20, "2026-10-04"), // compte dans la moyenne seulement
  E(6, 2, "Thème", 57, 5, 0, "2026-10-04"),         // barème nul : ignorée
  E(7, 2, "Compétence", "MGDE", 18, 20, "2026-10-04"),
  E(8, 5, "Thème", 1, 2, 20, "2026-10-04"),         // abandon : hors export
  E(9, 2, "Thème", 3, null, 20, "2026-10-04"),      // non notée
];

const csv = matriceNotesCsv({ stagiaires: STAG, evaluations: EVALS, anonymiser: false });
assert.ok(csv.startsWith("﻿"), "BOM pour Excel"); n++;
const lignes = csv.slice(1).split("\r\n");
eq(lignes[lignes.length - 1], "", "fin de fichier par CRLF");
const entete = lignes[0].split(";");
eq(entete.slice(0, 7), ["Stagiaire", "Moyenne", "C1", "C2", "REMC", "GDE", "Thème 01"], "début d'en-tête");
eq(entete.includes("Thèmes 46-47"), true, "46 et 47 en une colonne");
eq(entete.includes("Thème 46") || entete.includes("Thème 47"), false, "pas de colonnes 46 et 47 séparées");
eq(entete[entete.length - 1], "Thème 57", "fin d'en-tête");
eq(entete.length, 2 + 4 + 56, "colonnes : 2 + 4 compétences + 56 thèmes");
eq(lignes.length - 2, 4, "4 stagiaires en formation, abandon exclu");

const col = (nom) => entete.indexOf(nom);
const cellules = lignes.slice(1, -1).map((l) => l);
// Ordre alphabétique des noms : =CMD, ARNAUD, BERT, DU;PONT (localeCompare fr).
eq(cellules[0].startsWith("'=CMD Max;"), true, "formule neutralisée");
const arnaud = cellules[1].split(";");
eq(arnaud[0], "ARNAUD Luc", "nom puis prénom");
eq(arnaud[col("GDE")], "18", "GDE");
eq(arnaud[col("Thème 57")], "", "barème nul : cellule vide");
eq(arnaud[col("Moyenne")], "18", "moyenne de Luc : 18 seule note valable");
const bert = cellules[2].split(";");
eq(bert[col("Thème 01")], "15", "dernière note du thème");
eq(bert[col("C1")], "16", "8/10 ramené sur 20");
eq(bert[col("Thèmes 46-47")], "13,3", "virgule décimale, arrondi au dixième");
// Moyenne de Zoé : 10, 15, 16, 13,25, 12 → 66,25/5 = 13,25 → 13,3.
eq(bert[col("Moyenne")], "13,3", "moyenne de toutes les notes");
eq(cellules[3].startsWith("\"DU;PONT \"\"dit\"\" Ana\";"), true, "point-virgule et guillemets cités");

const anon = matriceNotesCsv({ stagiaires: STAG, evaluations: EVALS, anonymiser: true }).slice(1).split("\r\n");
eq(anon.slice(1, -1).map((l) => l.split(";")[0]), ["Stagiaire 1", "Stagiaire 2", "Stagiaire 3", "Stagiaire 4"],
  "noms remplacés par des numéros, même ordre");
assert.ok(!anon.join("").includes("BERT"), "aucun nom dans la version anonyme"); n++;

const videCsv = matriceNotesCsv({ stagiaires: [], evaluations: [], anonymiser: false }).slice(1).split("\r\n");
eq(videCsv.length, 2, "promo vide : en-tête seul");

eq(nomFichierCsv("Nîmes, mars 2026", "2026-10-23"), "matrice-notes_nimes-mars-2026_2026-10-23.csv", "nom de fichier");
eq(nomFichierCsv("Démonstration (données fictives)", "2026-10-23"),
  "matrice-notes_demonstration-donnees-fictives_2026-10-23.csv", "nom de fichier sans accents ni parenthèses");

console.log(`centre-csv : ${n} assertions OK`);
