// Données personnelles du centre (suite du lot 5) : la section des Réglages du centre où la direction applique les durées de
// conservation promises dans les conditions d'utilisation, sur son centre et sans changer la promo affichée. Deux blocs :
//   - Conservation des fiches (20261111_conservation_direction, décision de Timy du 11/11) : les échéances des deux étapes de Q5
//     pour les promos du centre (etat_conservation_centre(p_lieu), echeancesConservation), avec les cartes, les boutons et la
//     fenêtre de confirmation par saisie de la page Qualiopi (carteEcheance et ACTIONS de js/views/conservation-cartes.js,
//     confirmationEcheance). L'effacement à la demande, le questionnaire des formateurs et le registre restent au fondateur.
//   - Les élèves bénévoles du centre sans venue depuis 12 mois : benevoles_a_purger(p_lieu), purger_benevoles(p_ids, p_lieu).
// La base décide de tout (droit, délais) ; ses refus se disent par leur phrase, une lecture qui échoue par sa phrase et
// « Réessayer ». Textes destinés à l'équipe : au vouvoiement.

import { listBenevolesAPurgerDuCentre, purgerBenevolesDuCentre, lireEtatConservationCentre } from "../db.js?v=20261112c";
import { el, clear, toast } from "../utils.js?v=20261112c";
import { icon } from "../icons.js?v=20261112c";
import { confirmer } from "../confirmer.js?v=20261112c";
import {
  questionPurgerBenevoles, phrasePurges, phraseDePanne, phraseDEffacement, PHRASE_CONSERVATION_CENTRE, PHRASE_SANS_BENEVOLE,
  PHRASE_SANS_ECHEANCE, echeancesConservation, confirmationEcheance, compteRenduConservation,
} from "../effacement-rules.js?v=20261112c";
import { carteEcheance, ACTIONS, CONSERVATION_ABSENTE } from "./conservation-cartes.js?v=20261112c";
import { dateFr } from "../dates.js?v=20261112c";

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
  // Le compte rendu du dernier geste, relu par les lecteurs d'écran ; gardé d'un chargement à l'autre.
  const annonce = el("p", { class: "cons-statut", role: "status", "aria-live": "polite" });
  let jeton = 0;
  let occupe = false;

  async function charger() {
    const mien = ++jeton;
    clear(corps);
    corps.appendChild(el("div", { class: "loading", role: "status" }, "Chargement"));
    const [conservation, benevoles] = await Promise.all([
      lireEtatConservationCentre(centre.id).then(
        (etat) => (etat === null ? { absent: true } : { etat, echeances: echeancesConservation(etat) }),
        (erreur) => ({ erreur })),
      listBenevolesAPurgerDuCentre(centre.id).then((liste) => ({ liste }), (erreur) => ({ erreur })),
    ]);
    if (mien !== jeton) return;
    clear(corps);
    corps.appendChild(blocConservation(conservation));
    corps.appendChild(blocBenevoles(benevoles));
  }

  function dire(texte, erreur = false) {
    annonce.textContent = "";
    annonce.classList.toggle("erreur", erreur);
    if (texte) setTimeout(() => { annonce.textContent = texte; }, 50);   // vidée puis remplie : le même message est relu
  }

  // La conservation des fiches : les échéances des deux étapes pour les promos du centre, leur bouton quand la date est passée.
  function blocConservation(lecture) {
    const bloc = el("div", { class: "param-block", "data-conservation": "" },
      el("div", { class: "block-head" }, el("h4", {}, "Conservation des fiches")),
      el("p", { class: "muted donnees-texte" }, PHRASE_CONSERVATION_CENTRE),
      annonce);
    if (lecture.absent) {
      bloc.appendChild(el("p", { class: "muted donnees-texte" }, CONSERVATION_ABSENTE));
      return bloc;
    }
    if (lecture.erreur) {
      console.warn("Données personnelles : échéances illisibles", lecture.erreur);
      bloc.appendChild(boiteErreur(lecture.erreur.message || phraseDePanne(lecture.erreur), charger));
      return bloc;
    }
    const echeances = lecture.echeances;
    if (!echeances.length) {
      bloc.appendChild(el("p", { class: "muted donnees-texte" }, PHRASE_SANS_ECHEANCE));
      return bloc;
    }
    const carte = (e) => carteEcheance(e, { agir: (x) => agir(x), ouvrirRegistre: () => {} });
    const dues = echeances.filter((e) => e.due);
    const avenir = echeances.filter((e) => !e.due);
    if (dues.length) {
      bloc.append(el("p", { class: "qualiopi-rangee-titre" }, "À faire maintenant"),
        el("ul", { class: "cons-cartes" }, ...dues.map(carte)));
    }
    if (avenir.length) {
      bloc.append(el("p", { class: "qualiopi-rangee-titre" }, "À venir"),
        el("ul", { class: "cons-cartes" }, ...avenir.map(carte)));
    }
    return bloc;
  }

  // Une étape : la fenêtre de l'app dit exactement ce qui part et ce qui reste, et n'agit qu'après la saisie du mot EFFACER.
  async function agir(e) {
    if (occupe) return;
    const question = confirmationEcheance(e);
    if (!question || !ACTIONS[e.type]) return;
    if (!(await confirmer(question))) return;
    occupe = true;
    section.querySelectorAll("button[data-cons]").forEach((b) => { b.disabled = true; });
    try {
      const texte = compteRenduConservation(e.type, await ACTIONS[e.type](e.cible));
      dire(texte);
      toast(texte, "success", 6000);
    } catch (err) {
      console.error(err);
      const phrase = err.message || "L'opération n'a pas abouti.";
      dire(phrase, true);
      toast(phrase, "error");
    } finally {
      occupe = false;
    }
    await charger();
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
