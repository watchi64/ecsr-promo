// Vitrine de la promo de démonstration (11/11/2026, demande de Timy pour la présentation du 12/11) : dans la promo
// « Démonstration (données fictives) » seulement, le fondateur en aperçu Stagiaire voit l'app comme Camille, une
// stagiaire fictive (Accueil, Mon suivi, Notes, QCM). Son compte n'est relié qu'à sa vraie fiche (promo 1) : sans
// vitrine, l'aperçu montrerait une promo vide de « moi ».
// Dans la vitrine, l'en-tête x-apercu-role n'est pas envoyé (js/db.js) : la base lit la promo de démonstration avec
// les droits du fondateur, et l'écran garde ses droits de stagiaire (js/roles-rules.js). Aucune vraie promo n'est
// concernée : la table ne nomme que la promo de démonstration.

// Promo de démonstration → fiche du stagiaire fictif montré dans l'aperçu.
export const VITRINES = { 7: 1634 };

// La fiche montrée, ou null hors vitrine.
export function stagiaireVitrine({ promoId, apercu, fondateur }) {
  if (!fondateur || apercu !== "stagiaire" || promoId == null) return null;
  return VITRINES[promoId] ?? null;
}
