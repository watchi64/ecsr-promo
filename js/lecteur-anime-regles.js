/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Règles du lecteur commun des animations (js/lecteur-anime.js), partagées par les scènes de route et par les gestes.
 * Module pur (ni DOM ni réseau) : étape en cours à un instant, facteur de lecture affiché sous le schéma, visibilité du
 * schéma (quand la lecture démarre, quand elle s'interrompt). Les tests (tests/lecteur-anime.test.mjs) les vérifient ;
 * js/scene-rendu.js les réexporte, pour les modules et les tests qui les lisaient dans ce fichier.
 *
 * Toutes les valeurs ci-dessous sont des choix de dessin, sans portée réglementaire.
 */

/** Indice de l'étape en cours à `instant` : la dernière dont le début est atteint (0 avant la première). `etapes` :
 *  [{ t }], instants croissants. La tolérance de 1e-9 absorbe l'arrondi d'une somme de durées. */
export function etapeA(etapes, instant) {
  let k = 0;
  etapes.forEach((et, i) => { if (instant + 1e-9 >= et.t) k = i; });
  return k;
}

/**
 * Facteur de lecture affiché sous le schéma quand la scène ne se joue pas à sa vitesse réelle : { texte, libelle }
 * (« × 0,5 » et sa lecture en clair pour les lecteurs d'écran), ou null à vitesse réelle.
 */
export function facteurLecture(vitesse) {
  if (vitesse === 1) return null;
  const nombre = String(vitesse).replace(".", ",");
  return { texte: "× " + nombre, libelle: `Lecture ${vitesse < 1 ? "ralentie" : "accélérée"} : ${nombre} fois la vitesse réelle` };
}

/** Part visible du schéma (de 0 à 1) à partir de laquelle la première lecture démarre. */
export const SEUIL_DEMARRAGE = 0.6;
/** Seuils de l'observateur de visibilité du schéma : 0, pour être prévenu quand il sort tout à fait de l'écran, et
 *  SEUIL_DEMARRAGE. */
export const SEUILS_VISIBILITE = [0, SEUIL_DEMARRAGE];

/**
 * Ce que fait la lecture quand la part visible du schéma (`rapport`, de 0 à 1) change : "demarrer" la première fois que
 * 60 % au moins du schéma sont visibles, "pause" quand il sort tout à fait de l'écran en pleine lecture, sinon rien
 * (null). Lire les dernières étapes de la liste, sous un schéma à moitié sorti de l'écran, ne l'interrompt donc pas.
 * `dejaVu` : la première lecture a déjà été lancée (automatique ou demandée) ; `enCours` : la lecture tourne.
 */
export function actionVisibilite(rapport, dejaVu, enCours) {
  if (rapport >= SEUIL_DEMARRAGE && !dejaVu) return "demarrer";
  if (rapport <= 0 && enCours) return "pause";
  return null;
}
