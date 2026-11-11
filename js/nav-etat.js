// Transition : retiré en phase 2 quand les vues ne l'appellent plus. Une seule navigation depuis le 10/11 (la nouvelle,
// js/nav-shell.js) : plus de réglage par promo, d'aperçu ni de mémoire de l'appareil, et plus de section dans Paramètres.

// La nouvelle navigation, toujours.
export function navigationV2Active() {
  return true;
}

// Transition : retiré en phase 2 quand les vues ne l'appellent plus. Plus de section « Nouvelle navigation » dans Réglages
// (js/views/config.js n'ajoute rien quand elle vaut null).
export function renderNavigationReglage() {
  return null;
}
