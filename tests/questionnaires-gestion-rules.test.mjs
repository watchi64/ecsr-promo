// Règles de la section « Questionnaires » de la page Qualiopi (gestion) : portée, années des formateurs, état de l'ouverture
// et boutons, résumé, lignes de résultats, commentaires montrables, messages. Lancer : node --test tests/questionnaires-gestion-rules.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  QUESTIONNAIRES_GESTION, porteeGestion, anneesFormateur, libellePorteeFormateur, ouvertureDe, etatOuverture, actionsOuverture,
  messageOuverture, questionnairesAbsents, resumeReponses, texteAccord, satisfactionGlobale, lignesResultats,
  commentairesMontrables, messageLectureGestion, messageEchecOuverture, jourParis,
} from "../js/questionnaires-gestion-rules.js";
import { QUESTIONNAIRES } from "../js/questionnaires-data.js";

const NBSP = String.fromCharCode(0xa0);
const NIMES = { id: 1, lieu_id: 1, date_fin: "2026-12-11" };
const SEPT = { id: 2, lieu_id: 1, date_fin: null };
const DEMO = { id: 7, lieu_id: 4, date_fin: "2026-12-10" };

test("les trois questionnaires, dans l'ordre du catalogue", () => {
  assert.deepEqual(QUESTIONNAIRES_GESTION.map((q) => q.cle), Object.keys(QUESTIONNAIRES));
});

test("portée : promo pour les stagiaires, centre et année pour les formateurs, nulle sinon", () => {
  assert.deepEqual(porteeGestion("fin_stagiaire", NIMES, 2026), { promo_id: 1 });
  assert.deepEqual(porteeGestion("six_mois_stagiaire", NIMES, 2026), { promo_id: 1 });
  assert.deepEqual(porteeGestion("fin_formateur", NIMES, 2026), { lieu_id: 1, annee: 2026 });
  assert.equal(porteeGestion("fin_formateur", { id: 3, lieu_id: null }, 2026), null, "promo sans centre");
  assert.equal(porteeGestion("fin_formateur", NIMES, null), null, "année illisible");
  assert.equal(porteeGestion("fin_stagiaire", {}, 2026), null, "promo sans identifiant");
  assert.equal(porteeGestion("inconnu", NIMES, 2026), null);
});

test("années des formateurs : celle du jour et celles des fenêtres, jamais dans le futur", () => {
  assert.deepEqual(anneesFormateur([NIMES, SEPT], "2026-11-08"), [2026], "en novembre 2026, 2027 n'existe pas encore");
  assert.deepEqual(anneesFormateur([NIMES, SEPT], "2027-01-05"), [2027, 2026], "en janvier 2027, la fenêtre de Nîmes touche deux années");
  assert.deepEqual(anneesFormateur([], "2026-11-08"), [2026]);
  assert.deepEqual(anneesFormateur([NIMES], "pas une date"), []);
});

test("libellé de la portée formateur", () => {
  assert.match(libellePorteeFormateur("Nîmes", 2026), /^Formateurs du centre de Nîmes, année 2026\./);
  assert.match(libellePorteeFormateur(null, 2026), /^Formateurs du centre, année 2026\./);
});

test("ouverture posée à la main : lue par portée exacte", () => {
  const lignes = [
    { cle: "fin_stagiaire", promo_id: 1, lieu_id: null, annee: null, ouvert: false },
    { cle: "fin_formateur", promo_id: null, lieu_id: 1, annee: 2026, ouvert: true },
  ];
  assert.equal(ouvertureDe(lignes, "fin_stagiaire", { promo_id: 1 }), false);
  assert.equal(ouvertureDe(lignes, "fin_stagiaire", { promo_id: 2 }), null);
  assert.equal(ouvertureDe(lignes, "six_mois_stagiaire", { promo_id: 1 }), null);
  assert.equal(ouvertureDe(lignes, "fin_formateur", { lieu_id: 1, annee: 2026 }), true);
  assert.equal(ouvertureDe(lignes, "fin_formateur", { lieu_id: 1, annee: 2027 }), null);
  assert.equal(ouvertureDe(null, "fin_stagiaire", { promo_id: 1 }), null);
  assert.equal(ouvertureDe(lignes, "fin_stagiaire", null), null);
});

test("état selon les dates (stagiaires) : la fenêtre de la promo, bornes comprises", () => {
  const avant = etatOuverture({ cle: "fin_stagiaire", promo: NIMES, ouverture: null, aujourdhui: "2026-12-03" });
  assert.deepEqual(avant, { ouvert: false, mode: "dates", etiquette: "Fermé", detail: "Selon les dates : du 04/12/2026 au 10/01/2027." });
  assert.equal(etatOuverture({ cle: "fin_stagiaire", promo: NIMES, ouverture: null, aujourdhui: "2026-12-04" }).ouvert, true);
  assert.equal(etatOuverture({ cle: "fin_stagiaire", promo: NIMES, ouverture: null, aujourdhui: "2027-01-10" }).ouvert, true);
  assert.equal(etatOuverture({ cle: "fin_stagiaire", promo: NIMES, ouverture: null, aujourdhui: "2027-01-11" }).ouvert, false);
  const six = etatOuverture({ cle: "six_mois_stagiaire", promo: NIMES, ouverture: null, aujourdhui: "2026-12-05" });
  assert.equal(six.ouvert, false);
  assert.equal(six.detail, "Selon les dates : du 11/06/2027 au 11/07/2027.");
  const sansFin = etatOuverture({ cle: "fin_stagiaire", promo: SEPT, ouverture: undefined, aujourdhui: "2026-12-05" });
  assert.equal(sansFin.ouvert, false);
  assert.match(sansFin.detail, /pas de date de fin/);
});

test("état selon les dates (formateurs) : une promo du centre dans sa fenêtre, l'année du jour seulement", () => {
  const ouvert = etatOuverture({ cle: "fin_formateur", promosDuLieu: [SEPT, NIMES], annee: 2026, ouverture: null, aujourdhui: "2026-12-05" });
  assert.equal(ouvert.ouvert, true);
  assert.equal(ouvert.detail, "Selon les dates : du 04/12/2026 au 10/01/2027 (fin des promos du centre).");
  assert.equal(etatOuverture({ cle: "fin_formateur", promosDuLieu: [NIMES], annee: 2026, ouverture: null, aujourdhui: "2026-11-08" }).ouvert, false);
  const passee = etatOuverture({ cle: "fin_formateur", promosDuLieu: [NIMES], annee: 2026, ouverture: null, aujourdhui: "2027-01-05" });
  assert.equal(passee.ouvert, false, "en janvier 2027, les réponses vont à 2027 : 2026 ne s'ouvre plus");
  assert.match(passee.detail, /2026/);
  assert.equal(etatOuverture({ cle: "fin_formateur", promosDuLieu: [NIMES], annee: 2027, ouverture: null, aujourdhui: "2027-01-05" }).ouvert, true);
  const rien = etatOuverture({ cle: "fin_formateur", promosDuLieu: [SEPT], annee: 2026, ouverture: null, aujourdhui: "2026-12-05" });
  assert.equal(rien.ouvert, false);
  assert.match(rien.detail, /aucune promo du centre/);
});

test("état à la main : il prime dans les deux sens", () => {
  const ferme = etatOuverture({ cle: "fin_stagiaire", promo: NIMES, ouverture: false, aujourdhui: "2026-12-05" });
  assert.deepEqual([ferme.ouvert, ferme.mode, ferme.etiquette], [false, "main", "Fermé"]);
  assert.match(ferme.detail, /^Fermé à la main/);
  const ouvert = etatOuverture({ cle: "fin_stagiaire", promo: SEPT, ouverture: true, aujourdhui: "2026-11-08" });
  assert.deepEqual([ouvert.ouvert, ouvert.mode, ouvert.etiquette], [true, "main", "Ouvert"]);
});

test("boutons : l'inverse de l'état, et le retour aux dates quand il est posé à la main", () => {
  assert.deepEqual(actionsOuverture({ ouvert: false, mode: "dates" }), [{ libelle: "Ouvrir le questionnaire", valeur: true }]);
  assert.deepEqual(actionsOuverture({ ouvert: true, mode: "dates" }), [{ libelle: "Fermer le questionnaire", valeur: false }]);
  assert.deepEqual(actionsOuverture({ ouvert: true, mode: "main" }), [{ libelle: "Fermer le questionnaire", valeur: false }, { libelle: "Revenir aux dates", valeur: null }]);
  assert.deepEqual(actionsOuverture({ ouvert: false, mode: "main" }), [{ libelle: "Ouvrir le questionnaire", valeur: true }, { libelle: "Revenir aux dates", valeur: null }]);
  assert.equal(messageOuverture(true), "Questionnaire ouvert à la main.");
  assert.equal(messageOuverture(false), "Questionnaire fermé à la main.");
  assert.equal(messageOuverture(null), "Questionnaire revenu aux dates.");
});

test("migration absente : table des ouvertures introuvable ou seuil nul", () => {
  const ok = { seuil: 5, reponses: null, questions: {} };
  assert.equal(questionnairesAbsents({ ouvertures: [], resultats: [ok, ok, { ...ok, seuil: 3 }] }), false);
  assert.equal(questionnairesAbsents({ ouvertures: null, resultats: [ok] }), true);
  assert.equal(questionnairesAbsents({ ouvertures: [], resultats: [ok, { seuil: null, reponses: null, questions: {} }] }), true);
});

test("résumé : « moins de N réponses » sous le seuil, le nombre au-dessus", () => {
  assert.deepEqual(resumeReponses("fin_stagiaire", { seuil: 5, reponses: null, questions: {} }), { assez: false, n: null, texte: "moins de 5 réponses" });
  assert.deepEqual(resumeReponses("fin_formateur", { seuil: 3, reponses: null }), { assez: false, n: null, texte: "moins de 3 réponses" });
  assert.deepEqual(resumeReponses("fin_stagiaire", { seuil: 5, reponses: 5 }), { assez: true, n: 5, texte: "5 réponses" });
  assert.deepEqual(resumeReponses("fin_formateur", { seuil: 3, reponses: 3 }), { assez: true, n: 3, texte: "3 réponses" });
  // Défense : un nombre sous le seuil qui arriverait quand même n'est pas affiché.
  assert.equal(resumeReponses("fin_stagiaire", { reponses: 4 }).assez, false);
  assert.equal(resumeReponses("fin_stagiaire", null).texte, "moins de 5 réponses");
});

const COMPTES_5 = {
  objectifs: { 4: 2, 3: 2, 1: 1 },
  contenus: { 3: 5 },
  formateurs: { 4: 3, sans_avis: 2 },
  organisation: { 2: 2, 3: 3 },
  accompagnement: { 4: 5 },
  preparation: { 3: 4, 2: 1 },
  recommandation: { 4: 4, 3: 1 },
  globalement: { 4: 2, 3: 2, 2: 1 },
  // « app » (facultative) : 4 réponses seulement, sous le seuil ; la base ne l'aurait pas rendue, on vérifie la défense.
  app: { 4: 4 },
};

test("lignes de résultats : une par question du catalogue, commentaire à part, dans l'ordre", () => {
  const lignes = lignesResultats("fin_stagiaire", { seuil: 5, reponses: 5, questions: COMPTES_5 });
  const attendu = QUESTIONNAIRES.fin_stagiaire.questions.filter((q) => q.type !== "commentaire").map((q) => q.id);
  assert.deepEqual(lignes.map((l) => l.id), attendu);
  const objectifs = lignes[0];
  assert.equal(objectifs.n, 5);
  assert.deepEqual(objectifs.parts.map((p) => [p.cle, p.libelle, p.nombre]), [
    ["1", "Pas du tout", 1], ["2", "Plutôt non", 0], ["3", "Plutôt oui", 2], ["4", "Tout à fait", 2], ["sans_avis", "Sans avis", 0],
  ]);
  assert.equal(objectifs.accord.taux, 80);
  assert.equal(objectifs.accord.texte, `80${NBSP}% d'accord (plutôt oui ou tout à fait), sur 5 notes`);
  const formateurs = lignes.find((l) => l.id === "formateurs");
  assert.equal(formateurs.n, 5, "« sans avis » compte dans les réponses");
  assert.equal(formateurs.accord, null, "3 notes seulement : pas de taux sous le seuil des notes");
  const app = lignes.find((l) => l.id === "app");
  assert.deepEqual(app, { id: "app", type: "echelle", texte: QUESTIONNAIRES.fin_stagiaire.questions.find((q) => q.id === "app").texte, globale: false, facultative: true, sousSeuil: true, texteSousSeuil: "moins de 5 réponses" });
  assert.equal(lignes.find((l) => l.id === "globalement").globale, true);
});

test("lignes : une question absente des comptes s'affiche sous le seuil (jamais oubliée)", () => {
  const { app, ...sansApp } = COMPTES_5;
  const lignes = lignesResultats("fin_stagiaire", { seuil: 5, reponses: 5, questions: sansApp });
  assert.equal(lignes.find((l) => l.id === "app").sousSeuil, true);
  assert.equal(lignes.length, 9);
});

test("lignes : sous le seuil global, toutes les questions sont masquées même si des comptes arrivent", () => {
  const lignes = lignesResultats("fin_stagiaire", { seuil: 5, reponses: null, questions: COMPTES_5 });
  assert.ok(lignes.every((l) => l.sousSeuil && l.texteSousSeuil === "moins de 5 réponses" && !("parts" in l) && !("n" in l)));
  assert.deepEqual(lignesResultats("inconnu", {}), []);
});

test("lignes : un choix suit l'ordre de ses options ; seuil de 3 pour les formateurs", () => {
  const options = QUESTIONNAIRES.six_mois_stagiaire.questions[0].options;
  const lignes = lignesResultats("six_mois_stagiaire", { seuil: 5, reponses: 5, questions: { situation: { [options[1]]: 3, [options[0]]: 2 } } });
  assert.deepEqual(lignes[0].parts.map((p) => p.nombre), [2, 3, 0, 0]);
  assert.equal(lignes[0].accord, null);
  const formateurs = lignesResultats("fin_formateur", { seuil: 3, reponses: 3, questions: { objectifs: { 4: 3 }, supports: { 3: 2 } } });
  assert.equal(formateurs.find((l) => l.id === "objectifs").accord.taux, 100);
  assert.equal(formateurs.find((l) => l.id === "supports").texteSousSeuil, "moins de 3 réponses");
});

test("satisfaction globale : la question globale, sur les seules notes", () => {
  const s = satisfactionGlobale("fin_stagiaire", { seuil: 5, reponses: 5, questions: COMPTES_5 });
  assert.equal(s.taux, 80);
  assert.equal(s.repondants, 5);
  assert.equal(s.valeur, `80${NBSP}% d'accord`);
  assert.equal(s.detail, "plutôt oui ou tout à fait, sur 5 notes");
  assert.equal(satisfactionGlobale("fin_stagiaire", { seuil: 5, reponses: null, questions: COMPTES_5 }), null);
  assert.equal(satisfactionGlobale("fin_stagiaire", { seuil: 5, reponses: 5, questions: { globalement: { 4: 2, sans_avis: 3 } } }), null);
  assert.equal(texteAccord(null), null);
});

test("commentaires : jamais avec « Sans aucun nom », jamais sous le seuil, ordre de la base gardé", () => {
  const textes = ["Bien.", "  ", null, " Les salles étaient froides. "];
  assert.deepEqual(commentairesMontrables(textes, { sansNoms: false, assez: true }), ["Bien.", "Les salles étaient froides."]);
  assert.deepEqual(commentairesMontrables(textes, { sansNoms: true, assez: true }), []);
  assert.deepEqual(commentairesMontrables(textes, { sansNoms: false, assez: false }), []);
  assert.deepEqual(commentairesMontrables(null, { sansNoms: false, assez: true }), []);
});

test("messages : une lecture n'est pas un envoi ; la phrase de la base est gardée", () => {
  const lecture = messageLectureGestion(new Error("L'envoi n'a pas abouti : vérifie ta connexion et réessaie."));
  assert.match(lecture, /^Les questionnaires n'ont pas pu être lus/);
  assert.doesNotMatch(lecture, /envoi/i);
  assert.equal(messageLectureGestion(new Error("Réservé à la gestion de la qualité.")), "Réservé à la gestion de la qualité.");
  assert.equal(messageLectureGestion({ message: "questionnaire: Réservé à l'éditeur." }), "Réservé à l'éditeur.");
  assert.match(messageLectureGestion(null), /^Les questionnaires n'ont pas pu être lus/);
  assert.match(messageLectureGestion(new TypeError("Failed to fetch")), /^Les questionnaires n'ont pas pu être lus/);
  assert.match(messageEchecOuverture(new Error("L'envoi n'a pas abouti : vérifie ta connexion et réessaie.")), /^Le changement n'a pas abouti/);
  assert.equal(messageEchecOuverture(new Error("Promo introuvable.")), "Promo introuvable.");
});

test("jour de Paris : celui de la base (_questionnaire_jour), pas celui de l'appareil", () => {
  // Juste après minuit à Paris, encore la veille en UTC (hiver, UTC+1).
  assert.equal(jourParis(new Date("2026-12-03T23:30:00Z")), "2026-12-04", "00 h 30 à Paris : déjà le 4, premier jour de la fenêtre de Nîmes");
  assert.equal(jourParis(new Date("2026-12-03T22:59:59Z")), "2026-12-03", "23 h 59 à Paris : encore le 3");
  // Été (UTC+2) : 22 h 30 UTC est déjà le lendemain à Paris.
  assert.equal(jourParis(new Date("2026-07-14T22:30:00Z")), "2026-07-15");
  assert.equal(jourParis(new Date("2026-07-14T21:59:00Z")), "2026-07-14");
  // Changements d'heure : 29/03/2026 (passage à l'été, 2 h devient 3 h) et 25/10/2026 (retour à l'hiver).
  assert.equal(jourParis(new Date("2026-03-28T22:59:00Z")), "2026-03-28", "veille du passage à l'heure d'été, 23 h 59 à Paris");
  assert.equal(jourParis(new Date("2026-03-28T23:00:00Z")), "2026-03-29", "minuit à Paris (UTC+1)");
  assert.equal(jourParis(new Date("2026-03-29T21:59:00Z")), "2026-03-29", "soir du passage, 23 h 59 à Paris (UTC+2)");
  assert.equal(jourParis(new Date("2026-03-29T22:00:00Z")), "2026-03-30");
  assert.equal(jourParis(new Date("2026-10-24T22:00:00Z")), "2026-10-25", "minuit à Paris (UTC+2) la nuit du retour");
  assert.equal(jourParis(new Date("2026-10-25T22:59:00Z")), "2026-10-25", "23 h 59 à Paris (UTC+1) après le retour");
  assert.equal(jourParis(new Date("2026-10-25T23:00:00Z")), "2026-10-26");
  assert.equal(jourParis(Date.UTC(2026, 11, 3, 23, 30)), "2026-12-04", "un nombre de millisecondes est accepté");
  assert.equal(jourParis(new Date("pas une date")), null);
});

test("état et boutons suivent le jour de Paris : à 00 h 30, la fenêtre de Nîmes est ouverte et le bouton propose de fermer", () => {
  const jour = jourParis(new Date("2026-12-03T23:30:00Z"));
  const etat = etatOuverture({ cle: "fin_stagiaire", promo: NIMES, ouverture: null, aujourdhui: jour });
  assert.equal(etat.ouvert, true);
  assert.deepEqual(actionsOuverture(etat), [{ libelle: "Fermer le questionnaire", valeur: false }]);
  const veille = etatOuverture({ cle: "fin_stagiaire", promo: NIMES, ouverture: null, aujourdhui: jourParis(new Date("2026-12-03T22:30:00Z")) });
  assert.deepEqual(actionsOuverture(veille), [{ libelle: "Ouvrir le questionnaire", valeur: true }]);
});

test("messages : droit, panne brute, et phrases légitimes de la base gardées telles quelles", () => {
  const droit = "Réservé à la gestion de la qualité : ce compte n'a pas ce droit.";
  assert.equal(messageLectureGestion({ code: "42501", message: "permission denied for table questionnaire_ouvertures" }), droit);
  assert.equal(messageLectureGestion(new Error("permission denied for function resultats_questionnaire")), droit);
  assert.equal(messageEchecOuverture({ code: "42501", message: "x" }), droit);
  assert.equal(messageLectureGestion(new Error("Réservé à l'éditeur.")), "Réservé à l'éditeur.");
  for (const panne of ["Failed to fetch", "TypeError: Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed"]) {
    assert.match(messageLectureGestion(new Error(panne)), /^Les questionnaires n'ont pas pu être lus/, panne);
  }
  for (const phrase of ["Le délai de réponse (timeout) de la promo est dépassé.", "Promo introuvable sur le network du centre.", "Impossible de fetch la portée."]) {
    assert.equal(messageLectureGestion(new Error(phrase)), phrase, "une phrase de la base qui contient ces mots passe telle quelle");
  }
});

test("aucun tiret cadratin dans le module", () => {
  const source = readFileSync(new URL("../js/questionnaires-gestion-rules.js", import.meta.url), "utf8");
  assert.ok(!source.includes(String.fromCharCode(0x2014)));
});
