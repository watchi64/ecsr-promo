// Heures de présence d'une promo d'après ses feuilles d'émargement closes (lot Q5, tâche 11) : calcul pur, sans DOM ni base.
// Rien n'est recopié des attestations : les heures viennent de `bilanStagiaire` (js/attestations-rules.js), qui compte une
// demi-journée signée pour sa durée entière. Une ligne dont le dessin de signature est effacé reste signée (`signe_le` est gardé).
//
// Entrée `emargement` (posée par lireDonneesQualiopi) :
//   { etat: "lue", seances }  les feuilles de la promo, légères (id, promo_id, jour, demi_journee, debut, fin, statut, lignes)
//   { etat: "non_lue" }       la lecture a échoué (ou n'a pas eu lieu) : jamais un chiffre, ni « aucune feuille »
// Sortie de presenceDePromo :
//   { etat: "non_lue" }
//   { etat: "absente", motif, ouvertes }   rien à mesurer ; `motif` : "aucune" (aucune feuille), "ouvertes" (des feuilles ouvertes,
//                                           aucune close), "sans_ligne" (des feuilles closes, mais sans aucune ligne de stagiaire)
//   { etat: "mesuree", feuilles, ouvertes, effectif, prevuesMin, realiseesMin, taux, premier, dernier, bilans }
// Les totaux portent sur TOUTES les lignes des feuilles closes : stagiaires partis, fiches sans nom et fiches effacées à la
// demande comprises (preuve de présence anonyme). `bilans` : stagiaire_id vers bilanStagiaire, pour les tableaux nominatifs.

import { bilanStagiaire, seancesDeLaPromo, feuillesOuvertes } from "./attestations-rules.js?v=20261111d";

export function presenceDePromo(emargement, promoId) {
  if (!emargement || emargement.etat !== "lue" || !Array.isArray(emargement.seances)) return { etat: "non_lue" };
  const seances = seancesDeLaPromo(emargement.seances, promoId);
  const closes = seances.filter((s) => s.statut === "close");
  const ouvertes = feuillesOuvertes(seances);
  const ids = [...new Set(closes.flatMap((s) => (s.lignes || []).map((l) => l.stagiaire_id)))];
  const bilans = new Map(ids.map((id) => [id, bilanStagiaire(closes, id)]));
  const prevuesMin = [...bilans.values()].reduce((t, b) => t + b.prevuesMin, 0);
  if (!prevuesMin) return { etat: "absente", motif: closes.length ? "sans_ligne" : ouvertes ? "ouvertes" : "aucune", ouvertes };
  const realiseesMin = [...bilans.values()].reduce((t, b) => t + b.realiseesMin, 0);
  const jours = closes.map((s) => s.jour).filter(Boolean).sort();
  return {
    etat: "mesuree", feuilles: closes.length, ouvertes, effectif: ids.length, prevuesMin, realiseesMin,
    taux: realiseesMin / prevuesMin, premier: jours[0] ?? null, dernier: jours[jours.length - 1] ?? null, bilans,
  };
}

// La raison de l'absence de mesure, dite de la même façon par la pièce de l'inventaire et par le dossier (aucun chiffre dedans : les
// dossiers du centre regroupent les raisons par texte).
export const RAISONS_ABSENCE = {
  aucune: "feuilles d'émargement non utilisées pour cette promo",
  ouvertes: "feuilles ouvertes seulement, aucune feuille close",
  sans_ligne: "feuilles closes sans aucune ligne de stagiaire",
};
export const raisonAbsence = (presence) => RAISONS_ABSENCE[presence?.motif] ?? RAISONS_ABSENCE.aucune;

// Ce que la fiche des résultats attend : { taux, effectif } quand la présence est mesurée, { etat: "non_lue" } quand la lecture a
// échoué, rien sinon.
export function presenceDeLaFiche(presence) {
  if (presence?.etat === "mesuree") return { taux: presence.taux, effectif: presence.effectif };
  if (presence?.etat === "non_lue") return { etat: "non_lue" };
  return null;
}
