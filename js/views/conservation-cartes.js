// Les cartes des échéances de conservation (Qualiopi Q5) et le geste de chacune, partagés par deux écrans :
//   - la section « Conservation des données » de la page Qualiopi (js/views/conservation.js), au fondateur ;
//   - la section « Données personnelles » des Réglages du centre (js/views/reglages-donnees.js), où la direction lance les deux
//     étapes des promos de son centre (20261111_conservation_direction).
// Mêmes cartes, mêmes boutons, même fenêtre de confirmation par saisie (confirmationEcheance, js/effacement-rules.js) : la base
// décide du droit et des dates. Module à part, sans rien de la page Qualiopi : les Réglages du centre partent avec l'app.

import { el } from "../utils.js?v=20261111k";
import {
  effacerPromoEtape1, effacerPromoEtape2, cloreAnneeFormateurs, effacerCommentairesFormateurs, figerQuestionnaireFormateurs,
} from "../db.js?v=20261111k";
import { dateLongue } from "../dates.js?v=20261111k";

export const CONSERVATION_ABSENTE = "La conservation sera disponible après la mise à jour de la base.";

// Le geste de chaque échéance : la fonction de js/db.js qu'appelle son bouton.
export const ACTIONS = {
  etape1: (c) => effacerPromoEtape1(c.id),
  etape2: (c) => effacerPromoEtape2(c.id),
  cloture_formateurs: (c) => cloreAnneeFormateurs(c.lieu_id, c.annee),
  commentaires_formateurs: (c) => effacerCommentairesFormateurs(c.lieu_id, c.annee),
  figeage_formateurs: (c) => figerQuestionnaireFormateurs(c.lieu_id, c.annee),
};

const SORTES = {
  etape1: "Fiches : étape des 12 mois",
  etape2: "Fiches : étape des 3 ans",
  date_fin_manquante: "Fiches : date de fin manquante",
  fin_contredite: "Fiches : date de fin à vérifier",
  cloture_formateurs: "Questionnaire des formateurs",
  commentaires_formateurs: "Questionnaire des formateurs",
  figeage_formateurs: "Questionnaire des formateurs",
  registre: "Registre qualité",
};

function quand(e) {
  if (e.type === "fin_contredite") return "À vérifier";
  if (!e.du) return "Sans date";
  if (e.due) return e.restant === 0 ? "À faire aujourd'hui" : `À faire depuis le ${dateLongue(e.du)}`;
  return `À partir du ${dateLongue(e.du)}`;
}

// La carte d'une échéance : sa sorte, sa date, ce qui part et ce qui reste, et son bouton quand la date est passée. `agir(e)`
// lance le geste (après la fenêtre de confirmation) ; `ouvrirRegistre()` passe au registre qualité (page Qualiopi seulement).
export function carteEcheance(e, { agir, ouvrirRegistre }) {
  const titre = e.cible?.kind === "promo" ? (e.cible.nom || "Promo") : e.cible?.kind === "formateurs"
    ? `${e.cible.annee}, ${e.cible.lieu_nom || "centre"}` : "Tout l'organisme";
  const details = e.part.length || e.reste.length
    ? el("details", { class: "cons-details" },
      el("summary", {}, "Ce qui part, ce qui reste"),
      el("p", { class: "cons-liste-titre" }, "Ce qui est effacé"),
      el("ul", { class: "cons-liste" }, ...e.part.map((x) => el("li", {}, x))),
      el("p", { class: "cons-liste-titre" }, "Ce qui reste"),
      el("ul", { class: "cons-liste" }, ...e.reste.map((x) => el("li", {}, x))))
    : null;
  let action = null;
  if (e.type === "registre") {
    action = el("button", { class: "btn", type: "button", onClick: () => ouvrirRegistre() }, "Voir le registre qualité");
  } else if (e.bouton) {
    action = el("button", { class: "btn primary", type: "button", "data-cons": e.type, onClick: () => agir(e) }, e.bouton);
  }
  return el("li", { class: "cons-carte" + (e.due ? " due" : "") },
    el("div", { class: "cons-carte-tete" },
      el("span", { class: "cons-sorte" }, SORTES[e.type] ?? ""),
      el("span", { class: "cons-quand" + (e.due ? " due" : "") }, quand(e))),
    el("p", { class: "cons-carte-titre" }, titre),
    el("p", { class: "cons-texte" }, e.texte),
    details,
    action ? el("div", { class: "qualiopi-boutons" }, action) : null);
}
