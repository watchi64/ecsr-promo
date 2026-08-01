import assert from "node:assert/strict";
import {
  nbQuestionsExamen, budgetPasseMs, examenDemarrable, remiseToleree,
  tempsRestantMs, formatTempsRestant, echeanceDepuisChoix, DUREES_OUVERTURE,
} from "../js/qcm-exam-rules.js";

const T0 = Date.parse("2026-08-01T10:00:00Z");
const dans = (min) => new Date(T0 + min * 60000).toISOString();
const ilYA = (min) => new Date(T0 - min * 60000).toISOString();

// --- Nombre de questions d'une passe : gelées > tirage > banque entière ---
assert.equal(nbQuestionsExamen({ exam_question_ids: [1, 2, 3], exam_nb_questions: 10, nb_questions: 40 }), 3);
assert.equal(nbQuestionsExamen({ exam_question_ids: null, exam_nb_questions: 10, nb_questions: 40 }), 10);
assert.equal(nbQuestionsExamen({ exam_question_ids: null, exam_nb_questions: null, nb_questions: 40 }), 40);
assert.equal(nbQuestionsExamen({}), 0);
assert.equal(nbQuestionsExamen(null), 0);

// --- Budget chrono : questions x secondes, 30 s par defaut ---
assert.equal(budgetPasseMs({ nb_questions: 20, exam_seconds_per_question: 30 }), 20 * 30 * 1000);
assert.equal(budgetPasseMs({ nb_questions: 10 }), 10 * 30 * 1000);
assert.equal(budgetPasseMs({ exam_question_ids: [1, 2], exam_seconds_per_question: 60 }), 2 * 60 * 1000);

// --- Demarrage : ferme, ouvert sans limite, echeance future, echeance passee ---
assert.equal(examenDemarrable({ published: false, exam_ferme_a: null }, T0), false,
  "examen ferme : jamais demarrable");
assert.equal(examenDemarrable({ published: true, exam_ferme_a: null }, T0), true,
  "ouvert sans limite : demarrable");
assert.equal(examenDemarrable({ published: true, exam_ferme_a: dans(30) }, T0), true,
  "echeance future : demarrable");
assert.equal(examenDemarrable({ published: true, exam_ferme_a: ilYA(1) }, T0), false,
  "echeance passee : plus demarrable");
assert.equal(examenDemarrable(null, T0), false);
assert.equal(examenDemarrable({ published: true, exam_ferme_a: "pas une date" }, T0), true,
  "date illisible : traitee comme sans limite, on ne bloque pas a tort");

// --- Remise : la fenetre gouverne le DEMARRAGE, pas la remise ---
const q20 = { published: true, nb_questions: 20, exam_seconds_per_question: 30 }; // budget = 10 min
assert.equal(remiseToleree({ ...q20, exam_ferme_a: ilYA(1) }, T0), true,
  "echeance passee de 1 min, budget 10 min : remise encore acceptee");
assert.equal(remiseToleree({ ...q20, exam_ferme_a: ilYA(9) }, T0), true,
  "echeance passee de 9 min : encore dans la marge");
assert.equal(remiseToleree({ ...q20, exam_ferme_a: ilYA(11) }, T0), false,
  "echeance passee de 11 min : marge depassee");
assert.equal(remiseToleree({ ...q20, exam_ferme_a: null }, T0), true,
  "sans limite : toujours acceptee");
assert.equal(remiseToleree({ ...q20, published: false, exam_ferme_a: null }, T0), false,
  "examen referme a la main : plus aucune remise");

// Le budget suit les questions GELEES quand il y en a : 2 questions = 1 min de marge.
const gele = { published: true, exam_question_ids: [1, 2], exam_seconds_per_question: 30, nb_questions: 40 };
assert.equal(remiseToleree({ ...gele, exam_ferme_a: ilYA(0.5) }, T0), true,
  "QCM gele a 2 questions : marge de 1 min, on est dedans");
assert.equal(remiseToleree({ ...gele, exam_ferme_a: ilYA(2) }, T0), false,
  "QCM gele a 2 questions : au-dela de la marge d'1 min");

// --- Temps restant ---
assert.equal(tempsRestantMs({ exam_ferme_a: null }, T0), null);
assert.equal(tempsRestantMs({ exam_ferme_a: dans(30) }, T0), 30 * 60000);
assert.equal(tempsRestantMs({ exam_ferme_a: ilYA(5) }, T0), 0, "jamais negatif");

// --- Formatage du compte a rebours ---
assert.equal(formatTempsRestant(null), "sans limite");
assert.equal(formatTempsRestant(30 * 1000), "moins d'une minute");
assert.equal(formatTempsRestant(12 * 60000), "12 min");
assert.equal(formatTempsRestant(60 * 60000), "1 h");
assert.equal(formatTempsRestant(65 * 60000), "1 h 05");
assert.equal(formatTempsRestant(125 * 60000), "2 h 05");

// --- Echeance depuis un choix de duree ---
assert.equal(echeanceDepuisChoix({ minutes: 30 }, T0), dans(30));
assert.equal(echeanceDepuisChoix({ minutes: null }, T0), null, "sans limite");
assert.equal(echeanceDepuisChoix(null, T0), null);
const soir = echeanceDepuisChoix({ jusquASoir: true }, T0);
assert.ok(soir && new Date(soir).getTime() > T0, "jusqu'a ce soir : echeance dans le futur");
assert.equal(new Date(soir).getHours(), 23, "jusqu'a ce soir : 23h59 heure locale");

// Les cinq durees proposees restent coherentes.
assert.equal(DUREES_OUVERTURE.length, 5);
assert.ok(DUREES_OUVERTURE.every((d) => typeof d.label === "string" && d.label.length > 0));

console.log("qcm-exam-rules : tous les cas passent");
