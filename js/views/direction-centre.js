// Pages de la direction qui regardent tout le centre (lot 5, Task 7) : Vue d'ensemble (#/centre), Émargement (#/emargement)
// et Notes et examens (#/notes). Chacune montre d'abord toutes les promos du centre en résumé, puis le détail de la promo
// affichée (feuilles, matrice), en lecture. « Voir … » d'une autre promo la rend affichée (ouvrirDansUnePromo, D7).
// Les calculs vivent dans js/centre-stats.js, js/comptes-reseau.js, js/centre-csv.js et js/emargement-rules.js (purs, testés) :
// ici, seulement l'affichage. Le centre affiché est celui du compte (getCentre), jamais celui de la promo affichée par hasard :
// la fiche d'un autre centre n'est jamais montrée.

import {
  lireDonneesCentre, lireReferentielCentre, getMesPromos, getPromoCourante, lireReglagePromo, lireEmargementPromo,
  ouvrirDansUnePromo, lireEffacementsSurDemande,
} from "../db.js?v=20261112e";
import { el, clear, isoDate, formatDate, formatLongDate, toast, tableauEnListe } from "../utils.js?v=20261112e";
import { getCentre } from "../auth-admin.js?v=20261112e";
import { promosDuCentre } from "../espaces-rules.js?v=20261112e";
import {
  indicateursPromo, ligneComparaison, aSuivrePromo, fusionnerASuivre,
} from "../centre-stats.js?v=20261112e";
import { comptesDepuisIndicateurs, concatenerDonnees, promosEnCours } from "../comptes-reseau.js?v=20261112e";
import { tableauCentreCsv, slug } from "../centre-csv.js?v=20261112e";
import { resumeEmargement, lireAdresseEmargement, CLE_ACTIVATION, estActif } from "../emargement-rules.js?v=20261112e";
import { estAdresseAttestations } from "../attestations-rules.js?v=20261112e";
import { jourLong, DEMI_LONG } from "../emargement-feuilles.js?v=20261112e";
import {
  cartesCles, cartesResultats, sectionThemes, sectionASuivre, sectionComparaison, sectionMethodes, etiquette,
  telecharger,
} from "./centre.js?v=20261112e";
import { surChangementAdresse } from "../navigation.js?v=20261112e";
import { renderEmargement } from "./emargement.js?v=20261112e";
import { renderNotes } from "./notes.js?v=20261112e";
import { entier, pluriel } from "../nombres.js?v=20261112e";

export const PHRASE_SANS_PROMO = "Ce centre n'a pas encore de promo";
const PHRASE_SANS_CENTRE = "Ce compte ne dirige aucun centre.";
const phraseHorsCentre = (quoi, geste) => `La promo affichée n'est pas une promo de ce centre : ${quoi} ne sont pas montrées ici. Ouvrez une promo du centre avec « ${geste} ».`;
const PHRASE_LECTURE_ECHEC = "Les chiffres du centre n'ont pas pu être chargés.";

// Le centre dirigé et ses promos (la plus récente d'abord) ; `affichee` : la promo affichée SI elle est de ce centre, sinon nulle
// (le détail d'une promo d'un autre centre ne s'affiche jamais).
function contexteCentre() {
  const centre = getCentre();
  if (!centre) return { centre: null, promos: [], affichee: null };
  const promos = promosDuCentre(getMesPromos(), centre.id)
    .slice().sort((a, b) => String(b.date_debut || "").localeCompare(String(a.date_debut || "")) || a.id - b.id);
  const courante = getPromoCourante();
  return { centre, promos, affichee: courante && courante.lieu_id === centre.id ? courante : null };
}

function entete(centre, titre, sousTitre, actions = null) {
  return el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Centre de " + (centre.nom || "")),
      el("h2", {}, titre),
      el("p", { class: "subtitle" }, sousTitre)),
    actions);
}

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

// Un centre sans promo : la phrase et le geste suivant (créer la première promo, page Promos).
function sansPromo() {
  return el("div", { class: "centre-section centre-vide" },
    el("p", {}, PHRASE_SANS_PROMO + "."),
    el("a", { class: "btn primary", href: "#/promos" }, "Créer une promo"));
}

// Ouvrir une page d'une autre promo du centre : la promo devient la promo affichée, l'app se recharge sur l'adresse visée. Une
// bascule impossible le dit, rien ne change.
async function aller(promoId, adresse) {
  const phrase = await ouvrirDansUnePromo(promoId, adresse);
  if (phrase) toast(phrase, "error", 4000);
}

// Les données brutes de chaque promo du centre, par l'en-tête de lecture. Une promo illisible fait échouer l'ensemble : des
// totaux sans l'une des promos seraient faux sans le dire. `demandes` : les fiches effacées à la demande de la personne (lot Q5),
// ni en formation ni abandon dans les indicateurs.
async function lireToutesLesPromos(promos) {
  const [referentiel, demandes, ...donnees] = await Promise.all([lireReferentielCentre(),
    lireEffacementsSurDemande(promos.map((p) => p.id)), ...promos.map((p) => lireDonneesCentre(p.id))]);
  return { referentiel, demandes, parPromo: new Map(promos.map((p, i) => [p.id, donnees[i]])) };
}

// ============================================================== Vue d'ensemble

let renduVue = 0;

export async function renderVueCentre(container) {
  const jeton = ++renduVue;
  clear(container);
  const { centre, promos, affichee } = contexteCentre();
  const aujourdhui = isoDate(new Date());
  if (!centre) {
    container.appendChild(el("p", { class: "muted" }, PHRASE_SANS_CENTRE));
    return;
  }
  const racine = el("div", { class: "centre" });
  container.appendChild(racine);
  if (!promos.length) {
    racine.appendChild(entete(centre, "Vue d'ensemble", "0 promo en cours · édité le " + formatLongDate(aujourdhui, { sansJour: true })));
    racine.appendChild(sansPromo());
    return;
  }
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  let lu;
  try {
    lu = await lireToutesLesPromos(promos);
  } catch (e) {
    console.error(e);
    if (jeton !== renduVue) return;
    clear(racine);
    racine.appendChild(entete(centre, "Vue d'ensemble", "Édité le " + formatLongDate(aujourdhui, { sansJour: true })));
    racine.appendChild(boiteErreur(PHRASE_LECTURE_ECHEC, () => renderVueCentre(container)));
    return;
  }
  if (jeton !== renduVue) return;
  const { referentiel, parPromo, demandes } = lu;
  const enCours = promosEnCours(promos, aujourdhui);
  // Les indicateurs de chaque promo, calculés une fois ; ceux du centre, une fois sur les données des promos en cours.
  const indParPromo = new Map(promos.map((p) => [p.id, indicateursPromo(parPromo.get(p.id), referentiel, { aujourdhui, demandes })]));
  const indDe = (p) => indParPromo.get(p.id);
  const indCentre = enCours.length
    ? indicateursPromo(concatenerDonnees(enCours.map((p) => parPromo.get(p.id))), referentiel, { aujourdhui, demandes }) : null;
  const lignesParPromo = promos.map((p) => ({ nom: p.nom, debut: p.date_debut ? formatDate(p.date_debut) : "",
    fin: p.date_fin ? formatDate(p.date_fin) : "", comptes: comptesDepuisIndicateurs(indDe(p)) }));

  clear(racine);
  const exporter = el("button", { class: "btn small solo-ordinateur", type: "button", onClick: () => {
    telecharger(`tableau-centre_${slug(centre.nom) || "centre"}_${aujourdhui}.csv`, tableauCentreCsv(lignesParPromo));
    toast("Tableau du centre téléchargé", "success");
  } }, "Exporter le tableau (CSV)");
  racine.appendChild(entete(centre, "Vue d'ensemble",
    `${pluriel(enCours.length, "promo")} en cours · édité le ${formatLongDate(aujourdhui, { sansJour: true })}`,
    el("div", { class: "centre-actions" }, exporter)));

  if (enCours.length) {
    const ind = indCentre;
    racine.appendChild(el("p", { class: "centre-legende" },
      etiquette("mesuré"), " compté dans l'app · ", etiquette("estimé"), " hypothèse ou signal · Chaque chiffre a sa méthode. ",
      "Les chiffres du centre additionnent ses promos en cours."));
    racine.appendChild(el("section", { class: "centre-section" },
      el("h3", {}, "Assiduité et abandons"),
      el("div", { class: "centre-grille" }, ...cartesCles(ind))));
    racine.appendChild(el("section", { class: "centre-section" },
      el("h3", {}, "Résultats"),
      el("div", { class: "centre-grille" }, ...cartesResultats(ind))));
  } else {
    racine.appendChild(el("section", { class: "centre-section" },
      el("h3", {}, "Aucune promo en cours"),
      el("p", { class: "muted" }, "Les chiffres du centre portent sur ses promos en cours. Les promos terminées ou à venir sont dans la comparaison ci-dessous et dans la page Promos."),
      el("a", { class: "btn small", href: "#/promos" }, "Voir les promos")));
  }

  if (promos.length >= 2) {
    const courante = affichee || promos[0];
    const comparaison = sectionComparaison(promos, courante, indDe(courante));
    racine.appendChild(comparaison.section);
    comparaison.autres.forEach((p) => comparaison.remplir(p.id, ligneComparaison(indDe(p))));
  }

  if (enCours.length) {
    const fusion = fusionnerASuivre(enCours.map((p) => ({
      promoId: p.id, promoNom: p.nom, liste: aSuivrePromo(parPromo.get(p.id), referentiel, { aujourdhui }) })));
    racine.appendChild(sectionASuivre(fusion, {
      promoDe: (x) => x.promoNom,
      lien: (x) => {
        const adresse = "#/stagiaires/" + x.stagiaire.id;
        const ailleurs = !affichee || x.promoId !== affichee.id;
        return { href: adresse, onClick: ailleurs ? (e) => { e.preventDefault(); aller(x.promoId, adresse); } : null };
      },
    }));
    racine.appendChild(sectionThemes(indCentre.themes));
  }
  racine.appendChild(sectionMethodes());
}

// ============================================================== Émargement

let renduEmargement = 0;

function libelleFeuille(f) {
  return f ? `${jourLong(f.jour, { annee: false })}, ${DEMI_LONG[f.demi_journee] || ""}` : "";
}

// La ligne d'une promo : activée ou non, son résumé, le bouton pour ouvrir ses feuilles.
function ligneEmargement(p, etat, affichee) {
  const memeP = affichee && affichee.id === p.id;
  const periode = [p.date_debut ? "Du " + formatLongDate(p.date_debut, { sansJour: true }) : null, p.date_fin ? "au " + formatLongDate(p.date_fin, { sansJour: true }) : null]
    .filter(Boolean).join(" ");
  const titre = el("td", { class: "liste-titre" },
    el("strong", {}, p.nom), periode ? el("span", { class: "centre-detail" }, " " + periode) : null,
    memeP ? el("span", { class: "chip centre-promo" }, "Affichée ci-dessous") : null);
  if (etat.erreur) {
    return el("tr", {}, titre, el("td", {}, "Lecture impossible"), el("td"), el("td"), el("td"), el("td"), el("td", { class: "liste-actions" }));
  }
  if (!etat.actif) {
    return el("tr", {}, titre, el("td", {}, "Non activé"), el("td"), el("td"), el("td"), el("td"), el("td", { class: "liste-actions" }));
  }
  const r = etat.resume;
  const voir = memeP ? null : el("button", { class: "btn small", type: "button", onClick: () => aller(p.id, "#/emargement") },
    "Voir les feuilles");
  return el("tr", {}, titre,
    el("td", {}, "Activé", r.feuilleOuverte ? el("span", { class: "chip centre-ouverte" }, "Feuille ouverte") : null),
    el("td", {}, r.derniere ? libelleFeuille(r.derniere) : "Aucune feuille"),
    el("td", { class: "num" }, String(r.feuillesCloses)),
    el("td", { class: "num" }, String(r.absences)),
    el("td", { class: "num" }, String(r.nonSignees)),
    el("td", { class: "liste-actions" }, voir));
}

export async function renderEmargementCentre(container) {
  const jeton = ++renduEmargement;
  const { centre, promos, affichee } = contexteCentre();
  // Une feuille ou les attestations (adresses à segments) : la page de la promo affichée, seule, en lecture. « Semaine » en revient.
  if (estAdresseAttestations(location.hash) || lireAdresseEmargement(location.hash).demi) {
    if (!affichee) {
      clear(container);
      container.appendChild(el("p", { class: "muted" }, centre ? phraseHorsCentre("ses feuilles", "Voir les feuilles") : PHRASE_SANS_CENTRE));
      container.appendChild(el("a", { class: "btn small", href: "#/emargement" }, "Les promos du centre"));
      return;
    }
    return renderEmargement(container);
  }
  clear(container);
  if (!centre) {
    container.appendChild(el("p", { class: "muted" }, PHRASE_SANS_CENTRE));
    return;
  }
  const racine = el("div", { class: "centre" });
  container.appendChild(racine);
  racine.appendChild(entete(centre, "Émargement",
    "Une ligne par promo du centre, puis les feuilles de la promo affichée, en lecture."));
  if (!promos.length) {
    racine.appendChild(sansPromo());
    return;
  }
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  // Chaque promo se lit à part : une promo illisible le dit sur sa ligne, les autres s'affichent.
  const etats = await Promise.all(promos.map(async (p) => {
    try {
      const actif = estActif(await lireReglagePromo(p.id, CLE_ACTIVATION));
      return { actif, resume: actif ? resumeEmargement(await lireEmargementPromo(p.id)) : null, erreur: false };
    } catch (e) {
      console.error("émargement du centre : promo " + p.id, e);
      return { actif: false, resume: null, erreur: true };
    }
  }));
  if (jeton !== renduEmargement) return;
  clear(racine);
  racine.appendChild(entete(centre, "Émargement",
    "Une ligne par promo du centre, puis les feuilles de la promo affichée, en lecture."));
  const table = tableauEnListe(el("table", { class: "centre-table centre-emargement" },
    el("thead", {}, el("tr", {}, ...["Promo", "Émargement", "Dernière feuille", "Feuilles closes", "Absences notées",
      "Lignes non signées", ""].map((t) => el("th", { scope: "col", "aria-label": t || "Actions" }, t)))),
    el("tbody", {}, ...promos.map((p, i) => ligneEmargement(p, etats[i], affichee)))));
  racine.appendChild(el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Les promos du centre")),
    el("p", { class: "centre-intro" },
      "Les absences sont celles notées par le formateur ou reprises du planning ; une ligne non signée est celle d'une feuille close sans signature."),
    el("div", { class: "centre-defile" }, table)));
  if (etats.some((e) => e.erreur)) {
    racine.appendChild(boiteErreur("Une promo n'a pas pu être lue.", () => renderEmargementCentre(container)));
  }
  if (affichee) {
    const zone = el("div", { class: "centre-detail-promo" });
    racine.appendChild(el("section", { class: "centre-section" },
      el("div", { class: "centre-section-tete" }, el("h3", {}, "Feuilles de " + affichee.nom)), zone));
    const dessinerDetail = () => renderEmargement(zone, { dansLeCentre: true }).catch((e) => {
      console.error(e);
      clear(zone);
      zone.appendChild(boiteErreur("Les feuilles de la promo n'ont pas pu être chargées.", () => renderEmargementCentre(container)));
    });
    dessinerDetail();
    // Changer de semaine ou de date dans le détail ne redessine que le détail : le résumé par promo (déjà lu) et la position de
    // défilement restent. Une adresse de feuille ou d'attestations, ou une zone sortie de la page, retombe sur le rendu complet.
    surChangementAdresse("emargement", async () => {
      if (!zone.isConnected || estAdresseAttestations(location.hash) || lireAdresseEmargement(location.hash).demi) {
        throw new Error("rendu complet");
      }
      zone.style.minHeight = zone.offsetHeight + "px";
      try { await dessinerDetail(); } finally { zone.style.minHeight = ""; }
    });
  } else {
    racine.appendChild(el("p", { class: "muted" }, phraseHorsCentre("ses feuilles", "Voir les feuilles")));
  }
}

// ============================================================== Notes et examens

let renduNotes = 0;

export async function renderNotesCentre(container) {
  const jeton = ++renduNotes;
  clear(container);
  const { centre, promos, affichee } = contexteCentre();
  if (!centre) {
    container.appendChild(el("p", { class: "muted" }, PHRASE_SANS_CENTRE));
    return;
  }
  const racine = el("div", { class: "centre" });
  container.appendChild(racine);
  const sousTitre = "Moyenne des notes, critères EPCF acquis et examens QCM réussis par promo, puis la matrice de la promo affichée, en lecture.";
  racine.appendChild(entete(centre, "Notes et examens", sousTitre));
  if (!promos.length) {
    racine.appendChild(sansPromo());
    return;
  }
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  const aujourdhui = isoDate(new Date());
  let lu;
  try {
    lu = await lireToutesLesPromos(promos);
  } catch (e) {
    console.error(e);
    if (jeton !== renduNotes) return;
    clear(racine);
    racine.appendChild(entete(centre, "Notes et examens", sousTitre));
    racine.appendChild(boiteErreur(PHRASE_LECTURE_ECHEC, () => renderNotesCentre(container)));
    return;
  }
  if (jeton !== renduNotes) return;
  clear(racine);
  racine.appendChild(entete(centre, "Notes et examens", sousTitre));
  const lignes = promos.map((p) => ({ p, texte: ligneComparaison(indicateursPromo(lu.parPromo.get(p.id), lu.referentiel, { aujourdhui, demandes: lu.demandes })) }));
  const table = tableauEnListe(el("table", { class: "centre-table centre-notes-promos" },
    el("thead", {}, el("tr", {}, ...["Promo", "Moyenne des notes", "Critères EPCF acquis", "Examens QCM réussis", ""]
      .map((t) => el("th", { scope: "col", "aria-label": t || "Matrice" }, t)))),
    el("tbody", {}, ...lignes.map(({ p, texte }) => el("tr", {},
      el("td", { class: "liste-titre" }, el("strong", {}, p.nom),
        affichee && affichee.id === p.id ? el("span", { class: "chip centre-promo" }, "Affichée ci-dessous") : null),
      el("td", { class: "num" }, texte.notes),
      el("td", { class: "num" }, texte.epcf),
      el("td", { class: "num" }, texte.examensQcm),
      el("td", { class: "liste-actions" }, affichee && affichee.id === p.id ? null
        : el("button", { class: "btn small", type: "button", onClick: () => aller(p.id, "#/notes") }, "Voir la matrice")))))));
  racine.appendChild(el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Les promos du centre")),
    el("p", { class: "centre-intro" }, "Mêmes méthodes pour chaque promo, sans aucun nom."),
    el("div", { class: "centre-defile" }, table)));
  if (affichee) {
    const zone = el("div", { class: "centre-detail-promo" });
    racine.appendChild(el("section", { class: "centre-section" },
      el("div", { class: "centre-section-tete" }, el("h3", {}, "Matrice de " + affichee.nom)), zone));
    renderNotes(zone, { dansLeCentre: true }).catch((e) => {
      console.error(e);
      clear(zone);
      zone.appendChild(boiteErreur("La matrice de la promo n'a pas pu être chargée.", () => renderNotesCentre(container)));
    });
  } else {
    racine.appendChild(el("p", { class: "muted" }, phraseHorsCentre("sa matrice et ses notes", "Voir la matrice")));
  }
}
