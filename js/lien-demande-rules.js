// Règles de la page des liens d'e-mail (demande.html) : lire le jeton de l'adresse, dire où en est la page, nommer le geste.
// Lancer : node tests/lien-demande-rules.test.mjs

const ADRESSE_JETON = /^#j=([A-Za-z0-9_-]{43})$/;

/** Le jeton de l'adresse (#j=, 43 caractères base64url), sinon null. Il reste dans le fragment : il ne part pas dans une requête de page. */
export function jetonDeLAdresse(hash) {
  const m = ADRESSE_JETON.exec(String(hash ?? ""));
  return m ? m[1] : null;
}

/**
 * Où en est la page, d'après la réponse de la fonction (lien ou agir) :
 *   invalide      lien inconnu, expiré ou illisible
 *   a_confirmer   la demande est montrée, un seul bouton attend le toucher (ouvrir ne fait jamais le geste)
 *   deja          le geste est déjà fait (lien rouvert, ou second toucher)
 *   fait          le geste vient d'être fait
 *   voir          lien de lecture : rien à confirmer
 */
export function etatDeLaPage(reponse) {
  if (!reponse || reponse.invalide) return "invalide";
  if (reponse.fait) return "fait";
  if (reponse.deja) return "deja";
  if (reponse.action === "voir") return "voir";
  return "a_confirmer";
}

/** Le nom du geste : « Pris en compte », une réponse toute faite par son libellé (« Absence enregistrée »), « Justificatif reçu ». */
export function libelleAction(action, libelle_reponse) {
  if (action === "prise") return "Pris en compte";
  if (action === "justificatif") return "Justificatif reçu";
  if (action === "reponse" && libelle_reponse) return libelle_reponse;
  return "Réponse envoyée";
}
