// Certificat de réalisation et attestation d'assiduité (spec 2026-10-24) : pièces A4 portrait,
// construites hors écran puis imprimées comme les feuilles d'émargement (imprimer() de
// emargement-feuilles.js). Le certificat reprend mot pour mot le modèle du ministère du Travail
// (version applicable au 1er juin 2020) ; il s'établit sur l'en-tête de l'organisme, sans logo.

import { el } from "./utils.js?v=20261114b";
import { libelleCreneau, libelleDuree } from "./emargement-rules.js?v=20261114b";
import { nomComplet, jourLong } from "./emargement-feuilles.js?v=20261114b";
import { dureeEnToutesLettres, LIBELLE_ORIGINE } from "./attestations-rules.js?v=20261114b";
import { dateFr } from "./dates.js?v=20261114b";

// Champ du modèle : la valeur, ou la consigne du modèle et des pointillés à compléter à la main.
function champ(valeur, consigne = "", { consigneApres = false } = {}) {
  if (valeur) return el("span", { class: "at-val" }, valeur);
  const pointilles = el("span", { class: "at-pointilles" });
  const c = consigne ? el("em", { class: "at-consigne" }, consigne) : null;
  return el("span", { class: "at-vide" }, ...(consigneApres ? [pointilles, c] : [c, pointilles]).filter(Boolean));
}

function enTete(entete) {
  return el("header", { class: "at-entete" },
    el("p", { class: "at-organisme" }, entete.organisme),
    ...[entete.adresse1, entete.adresse2].filter(Boolean).map((l) => el("p", { class: "at-adresse" }, l)));
}

function blocSignature({ entete, lieuDefaut, faitLe, responsable }) {
  const signataire = [entete.signataire, entete.qualite].filter(Boolean).join(", ");
  return el("div", { class: "at-signature" },
    el("div", { class: "at-fait" },
      el("p", {}, "Fait à : ", champ(entete.lieu || lieuDefaut || "")),
      el("p", {}, "Le : ", champ(dateFr(faitLe)))),
    el("div", { class: "at-cadre" },
      el("p", {}, "Cachet et signature"),
      el("p", {}, responsable),
      el("p", {}, el("em", {}, "(nom, prénom, qualité du signataire)")),
      signataire ? el("p", { class: "at-cadre-nom" }, signataire) : null));
}

export function certificatRealisation({ entete, lieuDefaut, stagiaire, bilan, faitLe }) {
  const caseCochee = (texte, coche, note) => el("li", {}, el("span", { class: "at-case" }, coche ? "☒" : "☐"), " " + texte,
    note ? el("sup", {}, note) : null);
  return el("article", { class: "at-doc at-certificat" },
    enTete(entete),
    el("h1", { class: "at-titre" }, "CERTIFICAT DE REALISATION"),
    el("p", {}, el("strong", {}, "Je soussigné(e) "), champ(entete.signataire, "(prénom et nom)")),
    el("p", {}, el("strong", {}, "représentant légal du dispensateur de l'action concourant au développement des compétences "),
      champ(entete.organisme, "(raison sociale du dispensateur de formation ou de l'employeur en cas de formation interne)"), ","),
    el("p", {}, el("strong", {}, "atteste que :")),
    el("p", { class: "at-espace" }, "Mme/M. ", champ(nomComplet(stagiaire), "(nom et prénom du bénéficiaire)")),
    el("p", {}, "salarié(e) de l'entreprise ", champ("", "(raison sociale)")),
    el("p", {}, "a suivi l'action ", champ(entete.intitule, "(intitulé)")),
    el("p", { class: "at-espace" }, el("em", {}, "Nature de l'action concourant au développement des compétences :")),
    el("ul", { class: "at-cases" },
      caseCochee("action de formation", true, "1"),
      caseCochee("bilan de compétences", false),
      caseCochee("action de VAE", false),
      caseCochee("action de formation par apprentissage", false)),
    el("p", { class: "at-espace" }, "qui s'est déroulée du ", champ(dateFr(bilan.premierSigne)), " au ",
      champ(dateFr(bilan.dernierSigne), "(dates)", { consigneApres: true })),
    el("p", {}, "pour une durée de ", champ(bilan.realiseesMin ? dureeEnToutesLettres(bilan.realiseesMin) : "",
      "(nombre d'heures réalisées ou, s'agissant d'une formation par apprentissage, nombre de mois réalisés)",
      { consigneApres: true }), ".", el("sup", {}, "2")),
    el("p", { class: "at-espace at-justifie" },
      "Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver "
      + "l'ensemble des pièces justificatives qui ont permis d'établir le présent certificat pendant une durée de 3 ans "
      + "à compter de la fin de l'année du dernier paiement. En cas de cofinancement des fonds européens la durée de "
      + "conservation est étendue conformément aux obligations conventionnelles spécifiques."),
    blocSignature({ entete, lieuDefaut, faitLe, responsable: "du responsable du dispensateur de formation" }),
    el("footer", { class: "at-notes" },
      el("p", {}, el("sup", {}, "1"), " Lorsque l'action est mise en œuvre dans le cadre d'un projet de transition "
        + "professionnelle, le certificat de réalisation doit être transmis mensuellement."),
      el("p", {}, el("sup", {}, "2"), " Dans le cadre des formations à distance prendre en compte la réalisation des "
        + "activités pédagogiques et le temps estimé pour les réaliser.")),
  );
}

const DEMI = { matin: "Matin", aprem: "Après-midi" };

export function attestationAssiduite({ entete, lieuDefaut, promo, stagiaire, bilan, faitLe }) {
  const ligneResume = (k, v) => el("tr", {}, el("th", {}, k), el("td", {}, v));
  const semaines = bilan.semaines.map((s) => el("tr", {},
    el("td", {}, "Semaine du " + dateFr(s.lundi)),
    el("td", { class: "at-nombre" }, `${s.demiSignees} sur ${s.demiPrevues}`),
    el("td", { class: "at-nombre" }, `${libelleDuree(s.realiseesMin)} sur ${libelleDuree(s.prevuesMin)}`)));
  const evenements = bilan.evenements.map((e) => el("tr", { class: e.absent ? "emf-absent" : "" },
    el("td", {}, jourLong(e.jour)),
    el("td", {}, `${DEMI[e.demi] || e.demi}, ${libelleCreneau(e)}`),
    el("td", { class: "at-nombre" }, libelleDuree(e.minutes)),
    el("td", {}, e.absent ? "Absent" + (LIBELLE_ORIGINE[e.origine] ? " : " + LIBELLE_ORIGINE[e.origine] : "") : "Présent, signé"),
    el("td", {}, e.observation || "")));
  const qualite = entete.qualite ? ", " + entete.qualite : "";

  return el("article", { class: "at-doc at-attestation" }, avecMarges(
    enTete(entete),
    el("h1", { class: "at-titre" }, "ATTESTATION D'ASSIDUITÉ"),
    el("p", { class: "at-justifie" }, "Je soussigné(e) ", champ(entete.signataire, "(prénom et nom)"), qualite,
      ", représentant l'organisme de formation ", entete.organisme, ", atteste que ", el("strong", {}, nomComplet(stagiaire)),
      " a suivi la formation « ", entete.intitule, " »", promo?.nom ? `, promotion « ${promo.nom} »` : "",
      ", avec l'assiduité suivante, du ", dateFr(bilan.premierPrevu), " au ", dateFr(bilan.dernierPrevu), "."),
    el("table", { class: "at-resume" }, el("tbody", {},
      ligneResume("Heures prévues", libelleDuree(bilan.prevuesMin)),
      ligneResume("Heures réalisées", libelleDuree(bilan.realiseesMin)),
      ligneResume("Heures d'absence", libelleDuree(bilan.absencesMin)),
      ligneResume("Taux d'assiduité", bilan.taux == null ? "aucune heure prévue" : bilan.taux + " %"),
      ligneResume("Demi-journées signées", `${bilan.demiSignees} sur ${bilan.demiPrevues}`))),
    el("h2", { class: "at-sous-titre" }, "Détail par semaine"),
    el("table", { class: "emf-table at-table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Semaine"), el("th", {}, "Demi-journées signées"), el("th", {}, "Heures réalisées"))),
      el("tbody", {}, ...semaines)),
    el("h2", { class: "at-sous-titre" }, "Absences et observations"),
    evenements.length
      ? el("table", { class: "emf-table at-table at-table-evenements" },
          el("thead", {}, el("tr", {}, el("th", {}, "Date"), el("th", {}, "Demi-journée"), el("th", {}, "Durée"),
            el("th", {}, "Présence"), el("th", {}, "Observation"))),
          el("tbody", {}, ...evenements))
      : el("p", {}, "Aucune absence ni observation sur la période."),
    el("p", { class: "at-source" },
      (bilan.demiPrevues > 1
        ? `Établie à partir des ${bilan.demiPrevues} feuilles d'émargement closes de la période où figure le stagiaire, `
        : "Établie à partir de la feuille d'émargement close de la période où figure le stagiaire, ")
      + "signées dans l'application TP ECSR et horodatées par le serveur. Une demi-journée signée compte pour sa durée entière. "
      + "Les heures sans feuille d'émargement (stage en entreprise) ne sont pas comptées."),
    blocSignature({ entete, lieuDefaut, faitLe, responsable: "du responsable de l'organisme de formation" }),
  ));
}

// Marge répétée sur chaque page imprimée. L'impression se fait sans marge de page (sinon Chrome y
// imprime l'adresse et la date) et une attestation longue court sur plusieurs pages : un tableau
// répète son en-tête et son pied sur chaque page, ils portent la marge du haut et celle du bas.
function avecMarges(...contenu) {
  return el("table", { class: "at-pagination" },
    el("thead", {}, el("tr", {}, el("td", {}, el("div", { class: "at-marge-haut" })))),
    el("tfoot", {}, el("tr", {}, el("td", {}, el("div", { class: "at-marge-bas" })))),
    el("tbody", {}, el("tr", {}, el("td", {}, ...contenu))));
}

// Plusieurs pièces à la suite, une par page.
export function liasse(documents) {
  return el("div", { class: "at-liasse" }, ...documents);
}
