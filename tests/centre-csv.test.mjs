// Export CSV de la matrice des notes (tableau de bord du centre, spec 2026-10-23).
// Lancer depuis la racine du dépôt : node tests/centre-csv.test.mjs
import assert from "node:assert/strict";
import { matriceNotesCsv, nomFichierCsv, tableauCentreCsv, tableauReseauCsv } from "../js/centre-csv.js";
import { vueDuReseau } from "../js/comptes-reseau.js";

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

// === Tableau du centre : une ligne par promo (lot 5, Task 7) ===
const cptes = (o) => ({ inscrits: 0, enFormation: 0, abandons: 0, absences: 0, prevus: 0, qcmBonnes: 0, qcmQuestions: 0,
  examensPasses: 0, examensReussis: 0, notesN: 0, notesSomme: 0, notesSous10: 0, epcfAcquis: 0, epcfRenseignes: 0, ...o });
const tc = tableauCentreCsv([
  { nom: "Nîmes mars", debut: "2026-03-02", fin: "2026-12-18",
    comptes: cptes({ inscrits: 20, enFormation: 18, abandons: 2, absences: 3, prevus: 30, qcmBonnes: 75, qcmQuestions: 100,
      examensPasses: 4, examensReussis: 3, notesN: 4, notesSomme: 50, epcfAcquis: 6, epcfRenseignes: 8 }), presence: 0.925 },
  { nom: "=Récente; test", debut: "2026-11-02", fin: null, comptes: cptes({ inscrits: 10, enFormation: 10 }) },
]);
eq(tc.charCodeAt(0), 0xFEFF, "BOM comme la matrice");
const tcl = tc.slice(1).split("\r\n");
eq(tcl.length, 4, "en-tête + 2 promos + fin de ligne");
eq(tcl[0], "Promo;Début;Fin;Inscrits;En formation;Abandons (%);Absences (%);Réussite aux QCM (%);Examens QCM réussis (%);Moyenne des notes (/20);Critères EPCF acquis (%);Présence (%)", "en-têtes");
eq(tcl[1], "Nîmes mars;2026-03-02;2026-12-18;20;18;10;10;75;75;12,5;75;92,5", "ligne chiffrée, virgule décimale");
eq(tcl[2], "\"'=Récente; test\";2026-11-02;;10;10;0;;;;;;", "nom neutralisé et cité ; fin absente ; ratios sans base vides, abandon 0");
eq(tcl[3], "", "fin de ligne finale");
eq(tableauCentreCsv([]).slice(1).split("\r\n").length, 2, "aucune promo : en-tête seul");

// === Tableau du réseau : une ligne par centre (lot 5, Task 11) ===
const lr = (o) => ({ lieu_id: 1, lieu_nom: "Nîmes", demonstration: false, promos_en_cours: 1, masque: false, inscrits: 20, en_formation: 18,
  abandons: 2, absences: 3, prevus: 30, qcm_bonnes: 75, qcm_questions: 100, examens_passes: 4, examens_reussis: 3, notes_n: 4,
  notes_somme: 50, notes_sous10: 0, epcf_acquis: 6, epcf_renseignes: 8, ...o });
const nul = { masque: false, inscrits: null, en_formation: null, abandons: null, absences: null, prevus: null, qcm_bonnes: null,
  qcm_questions: null, examens_passes: null, examens_reussis: null, notes_n: null, notes_somme: null, notes_sous10: null,
  epcf_acquis: null, epcf_renseignes: null };
const vue = vueDuReseau([
  lr({}),
  lr({ lieu_id: 2, lieu_nom: "Béziers", ...nul, masque: true, promos_en_cours: 1 }),
  lr({ lieu_id: 3, lieu_nom: "Alès", ...nul, promos_en_cours: 0 }),
  lr({ lieu_id: 4, lieu_nom: "Démonstration", demonstration: true, en_formation: 12 }),
]);
const rc = tableauReseauCsv(vue);
eq(rc.charCodeAt(0), 0xFEFF, "BOM");
const rl = rc.slice(1).split("\r\n");
eq(rl[0], "Centre;Promos en cours;Stagiaires en formation;Abandons (%);Absences (%);Réussite aux QCM (%);Moyenne des notes (/20);Critères EPCF acquis (%);Remarque", "en-têtes");
eq(rl[1], "Alès;0;;;;;;;aucune promo en cours", "centre sans promo en cours");
eq(rl[2], "Béziers;1;;;;;;;moins de 5 stagiaires en formation", "centre masqué : aucun chiffre");
eq(rl[3], "Nîmes;1;18;10;10;75;12,5;75;", "centre chiffré, triés par nom");
eq(rl[4], "Total du réseau;1;18;10;10;75;12,5;75;hors centres de moins de 5 stagiaires en formation", "total sans le masqué ni la démonstration");
eq(rl[5], "Centre de démonstration (données fictives, hors totaux);1;12;10;10;75;12,5;75;", "démonstration à part, après le total");
eq(rl.length, 7, "fin de ligne finale");
assert.ok(!rl.slice(1, 3).join("").match(/\d{2}/), "aucun chiffre pour les lignes sans données"); n++;
const sansDemo = tableauReseauCsv(vueDuReseau([lr({})])).slice(1).split("\r\n");
eq(sansDemo.length, 4, "sans démonstration : en-tête, centre, total");

console.log(`centre-csv : ${n} assertions OK`);
