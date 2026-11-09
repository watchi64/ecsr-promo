// Le message du bas (#toast) n'a qu'une place à l'écran. Deux genres s'y succèdent (audit du 09/11, A2) :
//  - « message » : la confirmation d'un geste ou une erreur, que la personne attend : il s'affiche tout de suite ;
//  - « annonce » : un mot de l'app à l'ouverture (« Ton signalement a avancé ») : il attend que la place soit libre et
//    qu'aucune fenêtre ne soit ouverte (le tiroir « Plus » sur téléphone, où il recouvrait la ligne qu'il désigne).
// Avant, une annonce arrivée 1,5 s après l'ouverture effaçait la confirmation d'un geste fait entre-temps.
// Règles pures, testées par tests/defauts-2.test.mjs ; l'affichage est dans js/utils.js (toast, annoncer).

// Une annonce coupée par un message avant d'avoir été lue ce temps-là revient après lui.
export const REPRISE_MS = 2000;
// Une annonce qui attend depuis plus longtemps n'est plus d'actualité : elle est oubliée.
export const ATTENTE_MAX_MS = 60000;

// Peut-on montrer `nouveau` maintenant ? `courant` : le message affiché (ou null) ; `fenetreOuverte` : une fenêtre
// (tiroir, menu du compte, fenêtre modale) couvre la page.
export function peutMontrer(nouveau, { courant = null, fenetreOuverte = false } = {}) {
  if (!nouveau || nouveau.genre !== "annonce") return true;
  if (fenetreOuverte) return false;
  return !courant || courant.genre === "annonce";
}

// `nouveau` remplace `courant` (affiché depuis `courant.depuis`) : faut-il remettre `courant` en attente ? Seulement une
// annonce, coupée par un message, avant d'avoir été lue.
export function aReprendre(courant, nouveau, maintenant) {
  return !!courant && courant.genre === "annonce" && !!nouveau && nouveau.genre !== "annonce"
    && maintenant - courant.depuis < REPRISE_MS;
}

// Une annonce déposée à `annonce.depose` est-elle périmée à `maintenant` ? Un message ne l'est jamais.
export function perimee(annonce, maintenant) {
  return !!annonce && annonce.genre === "annonce" && maintenant - annonce.depose >= ATTENTE_MAX_MS;
}
