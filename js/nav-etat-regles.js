// Nouvelle navigation (refonte, lot 1) : quelle navigation s'affiche. Règles pures, sans DOM,
// sans stockage et sans base : lues par node (tests/nav-etat.test.mjs) et par js/nav-etat.js,
// qui y ajoute la lecture du réglage, l'aperçu de l'appareil et la section de Paramètres.

// Réglage de la promo : une ligne de la table `settings`, propre à la promo (même mécanique
// que l'émargement, js/emargement-etat.js). Éteint tant qu'il n'est pas allumé.
export const CLE_REGLAGE = "navigation_v2";

// Aperçu du fondateur, propre à l'appareil (localStorage) : "1" montre la nouvelle navigation
// quel que soit le réglage de la promo, "0" montre l'ancienne ; absent, l'appareil suit le réglage.
export const CLE_APERCU = "ecsr_nav_v2";

// Ce que la base garde pour le réglage : le texte « true » (ou le booléen). Tout le reste,
// « pas de réglage » compris, est éteint : une valeur inattendue n'allume jamais.
export function reglageAllume(valeur) {
  return valeur === true || valeur === "true";
}

// reglagePromo : true ou false, null tant que le réglage n'est pas lu ou s'il est illisible.
// apercu : "1", "0" ou null, lu sur l'appareil. Seul le fondateur a un aperçu : pour tout autre,
// la valeur posée sur l'appareil est ignorée, comme toute valeur autre que "1" ou "0".
export function decideNavigationV2({ reglagePromo = null, apercu = null, fondateur = false } = {}) {
  if (fondateur === true && (apercu === "1" || apercu === "0")) return apercu === "1";
  return reglagePromo === true;
}

// Mémoire de l'appareil (ruling R17) : le dernier réglage lu de la promo, "1" quand il était allumé (une
// promo éteinte ne laisse rien). Une clé par promo ; sans promo connue, pas de mémoire (null).
const PREFIXE_MEMOIRE = "ecsr_nav_v2_promo:";
export function cleMemoire(promoId) {
  return promoId === null || promoId === undefined ? null : PREFIXE_MEMOIRE + promoId;
}

// La navigation attendue à l'ouverture, avant la lecture du réglage : la même règle que decideNavigationV2,
// la mémoire de l'appareil pour la promo affichée (lireMemoire reçoit sa clé, et seulement la sienne)
// tenant lieu du réglage pas encore lu. Elle décide seulement si l'ancienne barre attend la décision sans
// se peindre ; la navigation de la session reste celle de la lecture.
export function navigationAttendue({ promoId = null, lireMemoire = () => null, apercu = null, fondateur = false } = {}) {
  const cle = cleMemoire(promoId);
  const memoire = cle ? lireMemoire(cle) : null;
  return decideNavigationV2({ reglagePromo: memoire === "1" ? true : null, apercu, fondateur });
}
