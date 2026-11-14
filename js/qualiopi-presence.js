// Heures de présence d'une promo pour le dossier Qualiopi (lot Q5, tâche 11). Le calcul vit dans js/presence-rules.js (partagé
// avec le tableau de bord du centre) ; ici, ce que la fiche des résultats en attend. Réexporte le calcul pour les appelants
// historiques (inventaire, documents, page Qualiopi).

export { presenceDePromo, presenceDesFeuilles, fusionnerEmargements, RAISONS_ABSENCE, raisonAbsence } from "./presence-rules.js?v=20261114d";

// Ce que la fiche des résultats attend : { taux, effectif } quand la présence est mesurée, { etat: "non_lue" } quand la lecture a
// échoué, rien sinon.
export function presenceDeLaFiche(presence) {
  if (presence?.etat === "mesuree") return { taux: presence.taux, effectif: presence.effectif };
  if (presence?.etat === "non_lue") return { etat: "non_lue" };
  return null;
}
