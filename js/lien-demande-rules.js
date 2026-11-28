// Règles de la page des liens d'e-mail (demande.html) : lire le jeton de l'adresse, dire où en est la page, nommer le geste.
// Lancer : node tests/lien-demande-rules.test.mjs

import { libelleAbsence } from "./contact-absences-rules.js?v=20261128c";

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

/**
 * Le titre de la demande montrée par le lien : son sujet ; pour une absence, qui n'a pas de sujet, le jour et le moment
 * (`moment` rendu par _contact_srv_lien : { du, au, quand, debut, fin }) ; sinon le nom du type (`types` : TYPES_DEMANDE).
 */
export function titreDeLaDemande(d, types = {}) {
  if (d?.sujet) return d.sujet;
  const quand = d?.moment ? libelleAbsence(d.moment) : "";
  return quand || types[d?.type] || "Message";
}

/**
 * Les lignes d'une absence sur la page du lien ([libellé, valeur]) : « Quand » seulement (même libellé que le suivi dans l'app). Vide
 * pour une autre demande (sans `moment`). Depuis la migration 5 (décision de Timy du 18/11), la page sans connexion ne montre ni le
 * motif, ni le mot, ni les messages d'une absence : la base ne les envoie plus, et la page ne les montrerait pas s'ils arrivaient.
 */
export function lignesAbsence(d) {
  if (!d?.moment) return [];
  return [["Quand", libelleAbsence(d.moment)]].filter(([, v]) => v);
}

/** Une absence : la page du lien n'en montre que le jour et le moment, et renvoie à l'app pour le reste. */
export function estAbsence(d) {
  return d?.type === "absence";
}

/** La phrase qui remplace le détail d'une absence sur la page du lien (vouvoyée : la page s'adresse à l'équipe). */
export const PHRASE_DETAIL_ABSENCE = "Pour lire le détail de cette absence (motif, mot, échanges), connectez-vous à l'application.";

/** La première lecture du lien a échoué (réseau, fonction injoignable) : le titre, la phrase et le bouton qui relance la lecture. */
export const LECTURE_EN_ECHEC = Object.freeze({
  titre: "Demande indisponible",
  phrase: "La connexion a échoué. Vérifiez le réseau, puis touchez « Réessayer ».",
  bouton: "Réessayer",
});
