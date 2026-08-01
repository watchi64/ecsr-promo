/*
 * Fenêtre d'ouverture des examens QCM : règles pures.
 *
 * L'AUTORITÉ EST LA BASE. Ces fonctions ne servent qu'à ne pas proposer un bouton
 * qui échouerait à l'insertion : elles doublent volontairement les fonctions SQL
 * `qcm_exam_demarrable` et `qcm_exam_remise_toleree`. Toute correction ici doit
 * être répercutée là-bas, et l'inverse.
 *
 * `now` est toujours reçu en argument : sans ça le test ne peut pas fixer l'heure,
 * et l'horloge du navigateur (potentiellement fausse) déciderait seule.
 *
 * Rappel : `published` signifie « examen ouvert », pas « QCM visible ». La lecture
 * des QCM et l'entraînement n'en dépendent pas.
 */

// Nombre de questions d'une passe d'examen : les questions gelées si le formateur
// en a figé une liste, sinon le tirage configuré, sinon toute la banque.
export function nbQuestionsExamen(qcm) {
  if (!qcm) return 0;
  const gelees = qcm.exam_question_ids;
  if (Array.isArray(gelees)) return gelees.length;
  if (Number.isFinite(qcm.exam_nb_questions) && qcm.exam_nb_questions > 0) return qcm.exam_nb_questions;
  return Number(qcm.nb_questions) || 0;
}

// Budget chrono d'une passe, en millisecondes.
export function budgetPasseMs(qcm) {
  const parQuestion = Number(qcm?.exam_seconds_per_question) || 30;
  return nbQuestionsExamen(qcm) * parQuestion * 1000;
}

function echeance(qcm) {
  if (!qcm?.exam_ferme_a) return null;
  const t = new Date(qcm.exam_ferme_a).getTime();
  return Number.isNaN(t) ? null : t;
}

// Peut-on DÉMARRER l'examen maintenant ?
export function examenDemarrable(qcm, now = Date.now()) {
  if (!qcm?.published) return false;
  const fin = echeance(qcm);
  return fin === null || now < fin;
}

// Une remise est-elle encore acceptée ? La fenêtre gouverne le démarrage, pas la
// remise : qui a démarré à temps doit pouvoir finir. D'où la tolérance d'un budget
// chrono complet après l'échéance.
export function remiseToleree(qcm, now = Date.now()) {
  if (!qcm?.published) return false;
  const fin = echeance(qcm);
  return fin === null || now < fin + budgetPasseMs(qcm);
}

// Millisecondes restantes avant fermeture, ou null si sans limite. Jamais négatif.
export function tempsRestantMs(qcm, now = Date.now()) {
  const fin = echeance(qcm);
  if (fin === null) return null;
  return Math.max(0, fin - now);
}

// « 1 h 05 », « 12 min », « moins d'une minute » : formulation courte pour un
// compte à rebours indicatif. Le chiffre exact n'a pas d'importance, la base tranche.
export function formatTempsRestant(ms) {
  if (ms == null) return "sans limite";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste ? `${h} h ${String(reste).padStart(2, "0")}` : `${h} h`;
}

// Échéances proposées au formateur. `null` = sans limite, il refermera à la main.
export const DUREES_OUVERTURE = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 heure", minutes: 60 },
  { label: "2 heures", minutes: 120 },
  { label: "Jusqu'à ce soir", minutes: null, jusquASoir: true },
  { label: "Sans limite", minutes: null },
];

// Échéance correspondant à un choix de durée, ou null pour « sans limite ».
export function echeanceDepuisChoix(choix, now = Date.now()) {
  if (!choix) return null;
  if (choix.jusquASoir) {
    const d = new Date(now);
    d.setHours(23, 59, 0, 0);
    return d.getTime() <= now ? null : new Date(d).toISOString();
  }
  if (!Number.isFinite(choix.minutes)) return null;
  return new Date(now + choix.minutes * 60000).toISOString();
}
