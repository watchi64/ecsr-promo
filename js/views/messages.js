// Messages (espace contact), pour l'équipe et la direction : les demandes qu'on leur adresse ou qu'elles ont écrites, rangées en « À traiter »,
// « Ouvertes » et « Terminées » (js/contact-rules.js, rangerDemandes). « Écrire à un stagiaire » et « Écrire à un collègue » ouvrent la
// fenêtre d'écriture. Un suivi s'ouvre à #/messages/<id> (js/views/demande.js). À l'ouverture, les e-mails en attente partent
// (declencherEnvois). La direction lit aussi les demandes de son centre. Vouvoiement, des listes et jamais de tableau.

import { listeDemandes, declencherEnvois } from "../db.js?v=20261126a";
import { el, clear } from "../utils.js?v=20261126a";
import { icon } from "../icons.js?v=20261126a";
import { vueStagiaire, getCentre, getEspace } from "../auth-admin.js?v=20261126a";
import { lireAdresse } from "../route-rules.js?v=20261126a";
import { rangerDemandes, phraseContact } from "../contact-rules.js?v=20261126a";
import { ligneDemande, renderDemande } from "./demande.js?v=20261126a";
import { ouvrirEcrire } from "./contact-ecrire.js?v=20261126a";

const PHRASE_ECHEC_LECTURE = "Les messages n'ont pas pu être chargés.";

let rendu = 0;

const boiteErreur = (phrase, reessayer) => el("div", { class: "contact-erreur", role: "alert" },
  el("p", {}, phrase), el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));

function section(id, titre, lignes, vide, { repliee = false } = {}) {
  const corps = lignes.length
    ? el("ul", { class: "demande-liste" }, ...lignes.map((l) => ligneDemande(l, "messages")))
    : el("p", { class: "muted" }, vide);
  if (repliee && lignes.length) {
    return el("details", { class: "contact-section demande-repliee" },
      el("summary", { class: "contact-section-titre" }, `${titre} (${lignes.length})`), corps);
  }
  return el("section", { class: "contact-section", "aria-labelledby": id },
    el("h3", { id, class: "contact-section-titre" }, lignes.length ? `${titre} (${lignes.length})` : titre), corps);
}

export async function renderMessages(container) {
  const adresse = lireAdresse(location.hash);
  // Le stagiaire est renvoyé vers Contacts ; un compte cumulé (fondateur et stagiaire) dans l'espace de l'équipe garde Messages.
  if (vueStagiaire()) { location.replace("#/contacts" + (adresse.id ? "/" + adresse.id : "")); return; }
  if (adresse.id) return renderDemande(container, adresse.id);

  const jeton = ++rendu;
  clear(container);
  const racine = el("div", { class: "contacts-page messages-page" });
  container.appendChild(racine);
  const centre = getEspace() === "direction" ? getCentre() : null;
  const entete = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      centre?.nom ? el("p", { class: "eyebrow" }, centre.nom) : null,
      el("h2", { tabindex: "-1" }, "Messages"),
      el("p", { class: "subtitle" }, "Les demandes des stagiaires et les échanges avec l'équipe.")));
  racine.appendChild(entete);
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));

  let lignes;
  try {
    lignes = await listeDemandes(centre?.id ?? null);
  } catch (e) {
    console.error("messages", e);
    if (jeton !== rendu) return;
    clear(racine);
    racine.appendChild(entete);
    racine.appendChild(boiteErreur(phraseContact(e, PHRASE_ECHEC_LECTURE), () => renderMessages(container)));
    return;
  }
  if (jeton !== rendu) return;
  // Les e-mails en attente partent à l'ouverture, sans attendre.
  declencherEnvois();
  clear(racine);
  racine.appendChild(entete);
  racine.appendChild(el("div", { class: "contact-gestes-fiche messages-ecrire" },
    el("button", { class: "btn small accent", type: "button",
      onClick: (e) => ouvrirEcrire({ cible: "stagiaire", ancre: e.currentTarget }) }, icon.plus(), "Écrire à un stagiaire"),
    el("button", { class: "btn small", type: "button",
      onClick: (e) => ouvrirEcrire({ cible: "collegue", ancre: e.currentTarget }) }, icon.plus(), "Écrire à un collègue")));

  const rang = rangerDemandes(lignes);
  racine.appendChild(section("messages-a-traiter", "À traiter", rang.aTraiter, "Rien à traiter."));
  racine.appendChild(section("messages-ouvertes", "Ouvertes", rang.ouvertes, "Aucune demande ouverte."));
  racine.appendChild(section("messages-terminees", "Terminées", rang.terminees, "Aucune demande terminée.", { repliee: true }));
}
