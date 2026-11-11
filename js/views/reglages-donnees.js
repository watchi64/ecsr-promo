// Données personnelles du centre (suite du lot 5) : la section des Réglages du centre où la direction applique les durées de
// conservation promises dans les conditions d'utilisation, sur son centre et sans changer la promo affichée. Une ligne par promo du
// centre (son état, et « Anonymiser la promo » quand les 12 mois après la fin de promo sont écoulés et qu'il reste des fiches),
// puis les élèves bénévoles du centre sans venue depuis 12 mois. La base décide de tout (droit, délais) : etat_anonymisation_promo(p_promo),
// anonymiser_promo(p_promo), benevoles_a_purger(p_lieu) et purger_benevoles(p_ids, p_lieu) ; ses refus se disent par leur phrase
// (phraseDeRefus), une lecture qui échoue par sa phrase et « Réessayer ». Textes destinés à l'équipe : au vouvoiement.

import {
  getMesPromos, etatAnonymisationPromoDe, anonymiserPromoDe, listBenevolesAPurgerDuCentre, purgerBenevolesDuCentre,
} from "../db.js?v=20261111e";
import { el, clear, toast } from "../utils.js?v=20261111e";
import { icon } from "../icons.js?v=20261111e";
import { demander, confirmer } from "../confirmer.js?v=20261111e";
import { promosDuCentre } from "../espaces-rules.js?v=20261111e";
import {
  dateCourte, lignesDonneesCentre, questionAnonymiserPromo, questionPurgerBenevoles, phraseAnonymises, phrasePurges,
  phraseDePanne, phraseDEffacement, PHRASE_SANS_PROMO_CENTRE, PHRASE_SANS_BENEVOLE,
} from "../effacement-rules.js?v=20261111e";

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
      el("p", { class: "muted" }, "Durées de conservation promises dans les conditions d'utilisation, appliquées aux promos et aux élèves bénévoles du centre."))));
  const corps = el("div", { class: "reglage-donnees-corps" });
  section.appendChild(corps);
  let jeton = 0;
  let occupe = false;

  async function charger() {
    const mien = ++jeton;
    clear(corps);
    corps.appendChild(el("div", { class: "loading", role: "status" }, "Chargement"));
    const promos = promosDuCentre(getMesPromos(), centre.id);
    const [lectures, benevoles] = await Promise.all([
      Promise.allSettled(promos.map((p) => etatAnonymisationPromoDe(p.id))),
      listBenevolesAPurgerDuCentre(centre.id).then((liste) => ({ liste }), (erreur) => ({ erreur })),
    ]);
    if (mien !== jeton) return;
    const etats = {};
    lectures.forEach((r, i) => { if (r.status === "fulfilled" && r.value) etats[promos[i].id] = r.value; });
    const echecs = lectures.filter((r) => r.status === "rejected");
    clear(corps);
    corps.appendChild(blocPromos(promos, etats, echecs.length === promos.length && promos.length > 0 ? echecs[0].reason : null));
    corps.appendChild(blocBenevoles(benevoles));
  }

  function blocPromos(promos, etats, panne) {
    const bloc = el("div", { class: "param-block" }, el("div", { class: "block-head" }, el("h4", {}, "Fin de promo")));
    if (panne) {
      console.warn("Données personnelles : états illisibles", panne);
      bloc.appendChild(boiteErreur(phraseDePanne(panne), charger));
      return bloc;
    }
    if (!promos.length) {
      bloc.appendChild(el("p", { class: "muted donnees-texte" }, PHRASE_SANS_PROMO_CENTRE));
      return bloc;
    }
    const liste = el("ul", { class: "config-list donnees-liste donnees-promos" });
    const lignes = lignesDonneesCentre(promos, etats);
    for (const l of lignes) {
      const texte = el("div", { class: "donnees-promo-texte" },
        el("strong", {}, l.nom),
        el("p", { class: "muted donnees-texte" }, l.texte));
      const ligne = el("li", { class: "donnees-promo" }, texte);
      if (l.bouton) {
        ligne.appendChild(el("button", {
          class: "btn danger", type: "button", "aria-label": "Anonymiser la promo " + l.nom,
          onClick: (e) => anonymiser(l, e.currentTarget),
        }, "Anonymiser la promo"));
      }
      liste.appendChild(ligne);
    }
    bloc.appendChild(liste);
    // Une partie seulement des lectures a échoué : les lignes le disent, et on peut relire.
    if (lignes.some((l) => l.indisponible)) {
      bloc.appendChild(el("button", { class: "btn small", type: "button", onClick: charger }, "Réessayer"));
    }
    return bloc;
  }

  async function anonymiser(ligne, bouton) {
    if (occupe) return;
    const saisie = await demander(questionAnonymiserPromo(ligne.nom));
    if (typeof saisie !== "string") return;
    occupe = true;
    bouton.disabled = true;
    try {
      const r = await anonymiserPromoDe(ligne.promoId);
      toast(phraseAnonymises(r && r.anonymises), "success", 6000);
    } catch (e) {
      console.error(e);
      toast(phraseDEffacement(e), "error");
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
      el("span", { class: "muted" }, b.derniere_venue ? "dernière venue le " + dateCourte(b.derniere_venue) : "jamais venu"))));
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
