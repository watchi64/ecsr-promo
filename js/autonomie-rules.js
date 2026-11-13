/*
 * Regles pures de l'autonomie (lecture et temps actif) : aucune dependance DOM ni reseau,
 * l'horloge est passee en argument (millisecondes), tout se teste par node.
 */
import { tempsLecture } from "./cours-rules.js";
import { lundiDe, jourDe } from "./dates.js";

/** Cle de reglage (promo) qui allume la fonction. */
export const CLE_ACTIVATION = "autonomie_active";
/** Sans action depuis ce delai, le temps cesse de compter. */
export const SEUIL_INACTIVITE_MS = 60000;
/** Periode entre deux ecritures du temps en base. */
export const PERIODE_ECRITURE_MS = 30000;
/** Part du temps de lecture estime en dessous de laquelle un cours n'est pas compte lu. */
export const PART_PLANCHER = 0.3;

/** Vrai pour `true` et `"true"` (les reglages sont stockes en texte). */
export function estActif(valeur) {
  return valeur === true || valeur === "true";
}

/** Compteur de temps actif. Un intervalle compte de la derniere borne jusqu'au plus petit de
 *  « maintenant » et « derniere action + seuil », seulement page visible. Masquer la page clot
 *  la fenetre d'activite : au retour, rien ne compte avant une nouvelle action. */
export function creerCompteur() {
  let derniereAction = null;
  let estVisible = false;
  let borne = 0;
  let cumulMs = 0;

  const avancer = (t) => {
    if (estVisible && derniereAction !== null) {
      const fin = Math.min(t, derniereAction + SEUIL_INACTIVITE_MS);
      if (fin > borne) cumulMs += fin - borne;
    }
    if (t > borne) borne = t;
  };

  return {
    action(t) {
      avancer(t);
      if (estVisible) derniereAction = t;
    },
    visible(t, visible) {
      avancer(t);
      if (visible === estVisible) return;
      estVisible = visible;
      derniereAction = null;
    },
    prelever(t) {
      avancer(t);
      const secondes = Math.floor(cumulMs / 1000);
      cumulMs -= secondes * 1000;
      return secondes;
    },
  };
}

/** Secondes de lecture en dessous desquelles un cours n'est pas compte lu. */
export function plancherLecture(texte) {
  return Math.round(tempsLecture(texte) * 60 * PART_PLANCHER);
}

/** « 0 min », « 12 min », « 1 h 05 » : arrondi a la minute superieure. */
export function formatDuree(secondes) {
  const minutes = Math.ceil(Math.max(0, secondes) / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Fiche d'un stagiaire : cours lus parmi les publies, temps de la semaine (lundi a dimanche de
 *  `aujourdhui`) et total, entrainements, derniere trace. */
export function resumeAutonomie({ lectures, temps, entrainements, coursPublies, aujourdhui }) {
  const publies = new Set(coursPublies.map(String));
  const lus = new Set(lectures.filter((l) => l.lu_le && publies.has(String(l.cours_id))).map((l) => String(l.cours_id)));
  const lundi = lundiDe(aujourdhui);
  const dimanche = jourDe(lundi, 6);
  let secondesSemaine = 0;
  let secondesTotal = 0;
  for (const t of temps) {
    secondesTotal += t.secondes;
    if (t.jour >= lundi && t.jour <= dimanche) secondesSemaine += t.secondes;
  }
  let derniere = null;
  const voir = (iso) => {
    if (iso && (derniere === null || Date.parse(iso) > Date.parse(derniere))) derniere = iso;
  };
  for (const l of lectures) { voir(l.vu_le); voir(l.lu_le); }
  for (const e of entrainements) voir(e.finished_at);
  return {
    coursLus: lus.size,
    coursTotal: publies.size,
    secondesSemaine,
    secondesTotal,
    entrainements: entrainements.length,
    derniereActivite: derniere,
  };
}
