// Pages du siège qui regardent le réseau (lot 5, Task 11) : Vue d'ensemble (#/reseau) et fiche d'un centre (#/reseau/<id>).
// Chiffres agrégés par centre, jamais un nom : la base (comptes_reseau) n'envoie au siège ni nom, ni e-mail, ni détail par promo,
// et masque les centres de moins de 5 stagiaires en formation (aucun chiffre, hors des totaux). Les calculs vivent dans
// js/comptes-reseau.js et js/centre-csv.js (purs, testés) : ici, seulement l'affichage. Lecture seule.

import { comptesReseau } from "../db.js?v=20261109i";
import { el, clear, isoDate, toast, tableauEnListe } from "../utils.js?v=20261109i";
import { icon } from "../icons.js?v=20261109i";
import { phraseDeRefus } from "../espaces-rules.js?v=20261109i";
import { lireAdresse } from "../route-rules.js?v=20261109i";
import { pct } from "../centre-stats.js?v=20261109i";
import { vueDuReseau, ratiosDeComptes, mentionMasques, SEUIL_SECRET } from "../comptes-reseau.js?v=20261109i";
import { tableauReseauCsv } from "../centre-csv.js?v=20261109i";
import { carte, telecharger } from "./centre.js?v=20261109i";
import { ouvrirAjoutCentre } from "./siege-directions.js?v=20261109i";

const entier = (x) => Number(x).toLocaleString("fr-FR");
const pluriel = (nb, mot, motPluriel = mot + "s") => `${entier(nb)} ${nb > 1 ? motPluriel : mot}`;
const fr1 = (x) => x.toFixed(1).replace(".", ",");

export const PHRASE_ECHEC_RESEAU = "Les chiffres du réseau n'ont pas pu être chargés.";
export const PHRASE_MASQUE = `Moins de ${SEUIL_SECRET} stagiaires en formation : chiffres non affichés.`;
export const PHRASE_CENTRE_INCONNU = "Ce centre n'existe pas.";
export const PHRASE_SANS_PROMO_EN_COURS = "Aucune promo en cours.";
export const LIBELLE_DEMO = "Centre de démonstration (données fictives, hors totaux)";

// Un refus qui a sa phrase (droit manquant, fonction absente avant la migration) la dit ; toute autre panne, la phrase commune.
function phraseDEchec(e) {
  const code = e && e.code;
  return code === "42501" || code === "PGRST202" ? phraseDeRefus(e.message, code) : PHRASE_ECHEC_RESEAU;
}

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

function entete(surtitre, titre, sousTitre, actions = null) {
  return el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, surtitre),
      el("h2", {}, titre),
      sousTitre ? el("p", { class: "subtitle" }, sousTitre) : null),
    actions);
}

// Tous les centres que la base a envoyés, démonstration comprise (comme le nombre en tête de la barre).
const surtitreReseau = (vue) => "Réseau · " + pluriel(vue.centres.length + (vue.demonstration ? 1 : 0), "centre");

// Les cartes d'un ensemble de comptes (le réseau, ou un centre) : mêmes définitions que la direction (D10), chacune avec sa méthode.
function cartes(c) {
  const r = ratiosDeComptes(c);
  return [
    carte({ cle: "effectif", titre: "Stagiaires en formation", nature: "mesuré",
      valeur: pluriel(c.enFormation, "stagiaire"), detail: `${pluriel(c.inscrits, "inscrit")} · ${pluriel(c.abandons, "abandon")}` }),
    carte({ cle: "abandon", titre: "Taux d'abandon", nature: "mesuré",
      valeur: r.abandon == null ? null : pct(r.abandon),
      detail: r.abandon == null ? null : `${pluriel(c.abandons, "abandon")} sur ${pluriel(c.inscrits, "inscrit")}` }),
    carte({ cle: "absences", titre: "Absences aux passages prévus", nature: "mesuré", nuance: "partiel",
      valeur: r.absences == null ? null : pct(r.absences),
      detail: r.absences == null ? null
        : `${pluriel(c.absences, "absence")} de dernière minute sur ${pluriel(c.prevus, "passage prévu", "passages prévus")}` }),
    carte({ cle: "reussiteQcm", titre: "Réussite aux QCM", nature: "mesuré",
      valeur: r.reussiteQcm == null ? null : pct(r.reussiteQcm),
      detail: r.reussiteQcm == null ? null : `${pluriel(c.qcmBonnes, "bonne réponse", "bonnes réponses")} sur ${entier(c.qcmQuestions)}` }),
    carte({ cle: "notes", titre: "Moyenne des notes", nature: "mesuré",
      valeur: r.notes == null ? null : `${fr1(r.notes)}/20`,
      detail: r.notes == null ? null : `${pluriel(c.notesN, "note")} · ${entier(c.notesSous10)} sous 10` }),
    carte({ cle: "epcf", titre: "Critères EPCF acquis", nature: "mesuré",
      valeur: r.epcf == null ? null : pct(r.epcf),
      detail: r.epcf == null ? null : `${pluriel(c.epcfAcquis, "critère acquis", "critères acquis")} sur ${entier(c.epcfRenseignes)}` }),
  ];
}

const sansPromo = (c) => c.promosEnCours === 0;

// La ligne d'un centre dans le tableau : le nom ouvre la fiche. Sans chiffre, une cellule le dit sur toute la largeur.
function ligne(c, nom) {
  const titre = el("td", { class: "liste-titre" },
    el("a", { class: "reseau-lien", href: "#/reseau/" + c.lieuId }, nom || c.lieuNom));
  const promos = el("td", { class: "num" }, String(c.promosEnCours));
  if (sansPromo(c) || c.masque) {
    return el("tr", {}, titre, promos,
      el("td", { class: "reseau-remarque", colspan: "6" }, sansPromo(c) ? PHRASE_SANS_PROMO_EN_COURS : PHRASE_MASQUE));
  }
  const r = ratiosDeComptes(c);
  const num = (v) => el("td", { class: "num" + (v == null ? " muted" : "") }, v == null ? "Aucune donnée" : v);
  return el("tr", {}, titre, promos, num(entier(c.enFormation)), num(r.abandon == null ? null : pct(r.abandon)),
    num(r.absences == null ? null : pct(r.absences)), num(r.reussiteQcm == null ? null : pct(r.reussiteQcm)),
    num(r.notes == null ? null : fr1(r.notes) + "/20"), num(r.epcf == null ? null : pct(r.epcf)));
}

function tableau(lignes) {
  const t = tableauEnListe(el("table", { class: "centre-table reseau-table" },
    el("thead", {}, el("tr", {}, ...["Centre", "Promos en cours", "En formation", "Abandons", "Absences", "QCM", "Moyenne", "EPCF"]
      .map((x) => el("th", { scope: "col" }, x)))),
    el("tbody", {}, ...lignes)));
  // La cellule de remarque couvre plusieurs colonnes : elle n'a pas de titre de colonne devant elle.
  t.querySelectorAll(".reseau-remarque").forEach((td) => td.removeAttribute("data-label"));
  return t;
}

async function lire() {
  return vueDuReseau(await comptesReseau());
}

// ============================================================== Vue d'ensemble

let renduVue = 0;

export async function renderVueReseau(container) {
  const jeton = ++renduVue;
  clear(container);
  const racine = el("div", { class: "centre reseau" });
  container.appendChild(racine);
  const sousTitre = "Chiffres agrégés par centre, sans données nominatives";
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  let vue;
  try {
    vue = await lire();
  } catch (e) {
    console.error(e);
    if (jeton !== renduVue) return;
    clear(racine);
    racine.appendChild(entete("Réseau", "Vue d'ensemble", sousTitre));
    racine.appendChild(boiteErreur(phraseDEchec(e), () => renderVueReseau(container)));
    return;
  }
  if (jeton !== renduVue) return;
  clear(racine);
  const aujourdhui = isoDate(new Date());
  const exporter = el("button", { class: "btn small solo-ordinateur", type: "button", onClick: () => {
    telecharger(`tableau-reseau_${aujourdhui}.csv`, tableauReseauCsv(vue));
    toast("Tableau du réseau téléchargé", "success");
  } }, "Exporter le tableau (CSV)");
  // « Ajouter un centre » : le siège crée un centre sans quitter la Vue d'ensemble ; la page se relit ensuite, puis propose d'inviter sa direction.
  const ajouter = el("button", { class: "btn", type: "button",
    onClick: (e) => ouvrirAjoutCentre({ ancre: e.currentTarget, apres: () => renderVueReseau(container) }) }, icon.plus(), "Ajouter un centre");
  racine.appendChild(entete(surtitreReseau(vue), "Vue d'ensemble", sousTitre, el("div", { class: "centre-actions" }, ajouter, exporter)));

  racine.appendChild(el("p", { class: "centre-legende" },
    `Promos en cours, hors centres de moins de ${SEUIL_SECRET} stagiaires en formation${mentionMasques(vue.masques)}. Chaque chiffre a sa méthode.`));
  racine.appendChild(el("section", { class: "centre-section" },
    el("h3", {}, "Le réseau"),
    el("div", { class: "centre-grille" }, ...cartes(vue.total))));

  racine.appendChild(el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Les centres")),
    vue.centres.length
      ? el("div", { class: "centre-defile" }, tableau(vue.centres.map((c) => ligne(c))))
      : el("p", { class: "muted" }, "Le réseau n'a pas encore de centre.")));

  if (vue.demonstration) {
    racine.appendChild(el("section", { class: "centre-section" },
      el("div", { class: "centre-section-tete" }, el("h3", {}, LIBELLE_DEMO)),
      el("div", { class: "centre-defile" }, tableau([ligne(vue.demonstration)]))));
  }
}

// ============================================================== Fiche d'un centre

let renduFiche = 0;

const retour = () => el("a", { class: "fiche-retour", href: "#/reseau" }, icon.chevronLeft(), el("span", {}, "Vue d'ensemble"));

export async function renderFicheCentre(container) {
  const jeton = ++renduFiche;
  clear(container);
  const id = lireAdresse(location.hash).id;
  const racine = el("div", { class: "centre reseau" });
  container.appendChild(racine);
  racine.appendChild(retour());
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  let vue;
  try {
    vue = await lire();
  } catch (e) {
    console.error(e);
    if (jeton !== renduFiche) return;
    clear(racine);
    racine.appendChild(retour());
    racine.appendChild(boiteErreur(phraseDEchec(e), () => renderFicheCentre(container)));
    return;
  }
  if (jeton !== renduFiche) return;
  clear(racine);
  racine.appendChild(retour());
  const c = [...vue.centres, ...(vue.demonstration ? [vue.demonstration] : [])].find((x) => x.lieuId === id);
  if (!c) {
    racine.appendChild(entete("Centre", "Centre introuvable", null));
    racine.appendChild(el("div", { class: "centre-section centre-vide" }, el("p", {}, PHRASE_CENTRE_INCONNU)));
    return;
  }
  racine.appendChild(entete(c.demonstration ? "Centre de démonstration" : "Centre", c.lieuNom,
    `${pluriel(c.promosEnCours, "promo")} en cours · lecture seule`));
  if (c.demonstration) {
    racine.appendChild(el("p", { class: "centre-legende" }, "Données fictives, hors des totaux du réseau."));
  }
  if (sansPromo(c)) {
    racine.appendChild(el("p", { class: "muted" }, PHRASE_SANS_PROMO_EN_COURS));
    return;
  }
  if (c.masque) {
    racine.appendChild(el("p", { class: "muted" }, PHRASE_MASQUE));
    return;
  }
  racine.appendChild(el("p", { class: "centre-legende" }, "Les chiffres du centre additionnent ses promos en cours. Chaque chiffre a sa méthode."));
  racine.appendChild(el("section", { class: "centre-section" },
    el("div", { class: "centre-grille" }, ...cartes(c))));
}

// La page du siège pour l'adresse courante : la fiche d'un centre (#/reseau/<id>) ou la Vue d'ensemble. Un identifiant illisible
// (#/reseau/abc) tombe sur la Vue d'ensemble.
export function renderReseau(container) {
  return lireAdresse(location.hash).id != null ? renderFicheCentre(container) : renderVueReseau(container);
}
