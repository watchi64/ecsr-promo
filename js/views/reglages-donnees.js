// Données personnelles du centre (suite du lot 5) : la section des Réglages du centre où la direction applique les durées de
// conservation promises dans les conditions d'utilisation, sur son centre et sans changer la promo affichée. La conservation des
// fiches (étapes à 12 mois et à 3 ans, effacement à la demande) est au fondateur, sur la page Qualiopi (lot Q5, question 3 du
// plan) : la section le dit par la phrase de Réglages, sans bouton. Restent les élèves bénévoles du centre sans venue depuis
// 12 mois. La base décide de tout (droit, délais) : benevoles_a_purger(p_lieu) et purger_benevoles(p_ids, p_lieu) ; ses refus se
// disent par leur phrase (phraseDeRefus), une lecture qui échoue par sa phrase et « Réessayer ». Textes destinés à l'équipe : au
// vouvoiement.

import { listBenevolesAPurgerDuCentre, purgerBenevolesDuCentre } from "../db.js?v=20261111h";
import { el, clear, toast } from "../utils.js?v=20261111h";
import { icon } from "../icons.js?v=20261111h";
import { confirmer } from "../confirmer.js?v=20261111h";
import {
  questionPurgerBenevoles, phrasePurges, phraseDePanne, phraseDEffacement, PHRASE_CONSERVATION, PHRASE_SANS_BENEVOLE,
} from "../effacement-rules.js?v=20261111h";
import { dateFr } from "../dates.js?v=20261111h";

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

export function sectionDonneesCentre(centre) {
  const section = el("section", { class: "param-section reglage-donnees", "aria-labelledby": "donnees-centre-titre" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.trash()),
    el("div", {},
      el("h3", { id: "donnees-centre-titre" }, "Données personnelles"),
      el("p", { class: "muted" }, "Durées de conservation promises dans les conditions d'utilisation."))));
  const corps = el("div", { class: "reglage-donnees-corps" });
  section.appendChild(corps);
  let jeton = 0;
  let occupe = false;

  async function charger() {
    const mien = ++jeton;
    clear(corps);
    corps.appendChild(el("div", { class: "loading", role: "status" }, "Chargement"));
    const benevoles = await listBenevolesAPurgerDuCentre(centre.id).then((liste) => ({ liste }), (erreur) => ({ erreur }));
    if (mien !== jeton) return;
    clear(corps);
    corps.appendChild(blocConservation());
    corps.appendChild(blocBenevoles(benevoles));
  }

  // La conservation des fiches : la phrase de Réglages, sans bouton (le fondateur fait chaque effacement, page Qualiopi).
  function blocConservation() {
    return el("div", { class: "param-block", "data-conservation": "" },
      el("div", { class: "block-head" }, el("h4", {}, "Conservation des fiches")),
      el("p", { class: "muted donnees-texte" }, PHRASE_CONSERVATION));
  }

  function blocBenevoles(lecture) {
    const liste = lecture.liste;
    const bloc = el("div", { class: "param-block" }, el("div", { class: "block-head" },
      el("h4", {}, "Élèves bénévoles sans venue depuis 12 mois"),
      liste ? el("span", { class: "count" }, String(liste.length)) : null));
    if (!liste) {
      console.warn("Données personnelles : bénévoles illisibles", lecture.erreur);
      bloc.appendChild(boiteErreur(phraseDePanne(lecture.erreur), charger));
      return bloc;
    }
    if (!liste.length) {
      bloc.appendChild(el("p", { class: "muted donnees-texte" }, PHRASE_SANS_BENEVOLE));
      return bloc;
    }
    const ul = el("ul", { class: "config-list donnees-liste" });
    liste.forEach((b) => ul.appendChild(el("li", {},
      el("span", {}, b.display),
      el("span", { class: "muted" }, b.derniere_venue ? "dernière venue le " + dateFr(b.derniere_venue) : "jamais venu"))));
    bloc.appendChild(ul);
    bloc.appendChild(el("button", { class: "btn danger", type: "button", onClick: (e) => purger(liste, e.currentTarget) },
      liste.length > 1 ? `Supprimer ces ${liste.length} élèves` : "Supprimer cet élève"));
    return bloc;
  }

  async function purger(liste, bouton) {
    if (occupe) return;
    if (!(await confirmer(questionPurgerBenevoles(liste.length)))) return;
    occupe = true;
    bouton.disabled = true;
    try {
      const n = await purgerBenevolesDuCentre(liste.map((b) => b.id), centre.id);
      toast(phrasePurges(n), "success", 6000);
    } catch (e) {
      console.error(e);
      toast(phraseDEffacement(e), "error");
    } finally {
      occupe = false;
    }
    await charger();
  }

  charger();
  return section;
}
