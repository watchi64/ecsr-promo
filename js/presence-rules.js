// Taux de présence d'après les feuilles d'émargement closes : calcul pur, sans DOM ni base, partagé par le tableau de bord du
// centre (js/centre-stats.js), la Vue d'ensemble de la direction et le dossier Qualiopi (js/qualiopi-presence.js). Un seul calcul :
// les trois affichent le même chiffre. Rien n'est recopié des attestations : les heures viennent de `bilanStagiaire`
// (js/attestations-rules.js), qui compte une demi-journée signée pour sa durée entière. Une ligne dont le dessin de signature est
// effacé reste signée (`signe_le` est gardé).
//
// Entrée `emargement` (posée par lireDonneesCentre, js/db.js) :
//   { etat: "lue", seances }  les feuilles, légères (id, promo_id, jour, demi_journee, debut, fin, statut, lignes)
//   { etat: "non_lue" }       la lecture a échoué (ou n'a pas eu lieu) : jamais un chiffre, ni « aucune feuille »
// Sortie de presenceDesFeuilles et de presenceDePromo :
//   { etat: "non_lue" }
//   { etat: "absente", motif, ouvertes }   rien à mesurer ; `motif` : "aucune" (aucune feuille), "ouvertes" (des feuilles ouvertes,
//                                           aucune close), "sans_ligne" (des feuilles closes, mais sans aucune ligne de stagiaire)
//   { etat: "mesuree", feuilles, ouvertes, effectif, prevuesMin, realiseesMin, taux, premier, dernier, bilans }
// Les totaux portent sur TOUTES les lignes des feuilles closes : stagiaires partis, fiches sans nom et fiches effacées à la
// demande comprises (preuve de présence anonyme). `bilans` : stagiaire_id vers bilanStagiaire, pour les tableaux nominatifs.

import { bilanStagiaire, seancesDeLaPromo, feuillesOuvertes } from "./attestations-rules.js?v=20261114b";

export function presenceDePromo(emargement, promoId) {
  if (!lue(emargement)) return { etat: "non_lue" };
  return presenceDesFeuilles({ ...emargement, seances: seancesDeLaPromo(emargement.seances, promoId) });
}

const lue = (emargement) => !!emargement && emargement.etat === "lue" && Array.isArray(emargement.seances);

// Le même calcul sur toutes les feuilles reçues, sans tri par promo : le tableau de bord du centre (indicateursPromo) reçoit les
// feuilles déjà rangées par promo (en-tête de lecture), et la Vue d'ensemble de la direction additionne celles de plusieurs
// promos (fusionnerEmargements). Une fiche n'appartient qu'à une promo : les bilans ne se mélangent pas.
export function presenceDesFeuilles(emargement) {
  if (!lue(emargement)) return { etat: "non_lue" };
  const seances = emargement.seances;
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

// Les feuilles de plusieurs promos en une seule entrée. Une lecture en échec rend l'ensemble « non lue » : un total sans l'une des
// promos serait faux sans le dire.
export function fusionnerEmargements(liste) {
  const l = liste || [];
  if (l.some((e) => !lue(e))) return { etat: "non_lue" };
  return { etat: "lue", seances: l.flatMap((e) => e.seances) };
}

// La raison de l'absence de mesure, dite de la même façon par la pièce de l'inventaire et par le dossier (aucun chiffre dedans : les
// dossiers du centre regroupent les raisons par texte).
export const RAISONS_ABSENCE = {
  aucune: "feuilles d'émargement non utilisées pour cette promo",
  ouvertes: "feuilles ouvertes seulement, aucune feuille close",
  sans_ligne: "feuilles closes sans aucune ligne de stagiaire",
};
export const raisonAbsence = (presence) => RAISONS_ABSENCE[presence?.motif] ?? RAISONS_ABSENCE.aucune;

