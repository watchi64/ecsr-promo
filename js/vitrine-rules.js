// Vitrine de la promo de démonstration (11/11/2026, demande de Timy pour la présentation du 12/11) : dans la promo
// « Démonstration (données fictives) » seulement, le fondateur en aperçu Stagiaire voit l'app comme Camille, une
// stagiaire fictive (Accueil, Mon suivi, Notes, QCM). Son compte n'est relié qu'à sa vraie fiche (promo 1) : sans
// vitrine, l'aperçu montrerait une promo vide de « moi ».
//
// LA VITRINE EST EN LECTURE SEULE (règle du 12/11). Trois sorts pour une requête vers l'API de données (js/db.js) :
//   - une lecture (GET, HEAD) part sans l'en-tête x-apercu-role : la base répond au fondateur ce qu'il lit déjà hors
//     aperçu, rien de plus (l'en-tête ne fait que retirer des droits) ;
//   - un appel de fonction (POST /rpc/...) part AVEC l'en-tête, comme hors vitrine : la base y voit un stagiaire sans
//     fiche dans cette promo, et lui refuse ce qu'elle refuse déjà ;
//   - toute autre requête (ajout, modification, suppression d'une ligne) ne quitte pas le navigateur.
// Rien ne s'écrit donc au nom de Camille : ni tentative de QCM, ni note, ni signature. L'écran garde ses droits de
// stagiaire (js/roles-rules.js). Aucune vraie promo n'est concernée : la table ne nomme que la promo de démonstration.
// La fiche empruntée ne quitte pas la vitrine : elle n'entre ni dans la promo courante ni dans le profil du compte
// (js/db.js, getPromoCourante), et sortir de la vitrine recharge l'app après avoir coupé les requêtes (js/auth-admin.js,
// setViewAs), pour qu'un examen ou une saisie commencés en vitrine ne finissent pas avec les droits du fondateur.

// Promo de démonstration → fiche du stagiaire fictif montré dans l'aperçu.
export const VITRINES = { 7: 1634 };

// La fiche montrée, ou null hors vitrine. Les trois conditions sont strictes : `fondateur` doit être le booléen vrai,
// l'aperçu exactement « stagiaire », la promo un entier nommé dans la table (ni « 7 » ni un nom hérité d'Object).
export function stagiaireVitrine({ promoId, apercu, fondateur } = {}) {
  if (fondateur !== true || apercu !== "stagiaire" || !Number.isInteger(promoId)) return null;
  return Object.prototype.hasOwnProperty.call(VITRINES, promoId) ? VITRINES[promoId] : null;
}

// Une fiche de vitrine qui n'est pas la vraie fiche du compte : jamais écrite, vitrine active ou non.
export function ficheEmpruntee(ficheEcrite, ficheDuCompte = null) {
  if (!Number.isInteger(ficheEcrite) || ficheEcrite === ficheDuCompte) return false;
  return Object.keys(VITRINES).some((promo) => VITRINES[promo] === ficheEcrite);
}

// Ce que la base ou l'app répond à un geste d'écriture fait dans la vitrine.
export const MESSAGE_VITRINE = "Vitrine de démonstration : rien n'est enregistré.";

// Le sort d'une requête vers l'API de données quand la vitrine est active : « lecture » (part sans l'en-tête d'aperçu),
// « fonction » (part avec l'en-tête, comme hors vitrine) ou « ecriture » (ne part pas). Dans le doute, « ecriture ».
export function sortEnVitrine({ methode, chemin } = {}) {
  const m = String(methode || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD") return "lecture";
  if (m === "POST" && /\/rest\/v1\/rpc\/[A-Za-z0-9_]+$/.test(String(chemin || ""))) return "fonction";
  return "ecriture";
}

// La décision complète pour une requête de données : `apercu` est l'en-tête x-apercu-role à poser (null : aucun),
// `refus` le message quand la requête ne doit pas partir. Hors vitrine, l'aperçu en cours part tel quel.
export function requeteDeDonnees({ promoId, apercu, fondateur, methode, chemin } = {}) {
  if (!apercu) return { apercu: null, refus: null };
  if (stagiaireVitrine({ promoId, apercu, fondateur }) == null) return { apercu, refus: null };
  const sort = sortEnVitrine({ methode, chemin });
  if (sort === "lecture") return { apercu: null, refus: null };
  if (sort === "fonction") return { apercu, refus: null };
  return { apercu, refus: MESSAGE_VITRINE };
}
