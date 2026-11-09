// Page Équipe de la direction (lot 5, Task 10) : la direction et les formateurs du centre, « Inviter un formateur » (adresse, promos du
// centre à cocher, fiche formateur libre facultative), « Modifier » (les promos d'un formateur) et « Retirer du centre » (après
// confirmation). Tout passe par regler_affectations_formateur (la base décide : droit, centre, compte stagiaire) ; ses refus se
// disent par leur phrase (phraseDeRefus), la saisie gardée. Les règles d'affichage (rôle, promos, tri) vivent dans
// js/direction-rules.js (equipeAffichee). Le centre est celui du compte (getCentre) : l'équipe d'un autre centre n'est jamais lue.
// Pas d'e-mail envoyé : la personne crée son mot de passe avec l'adresse invitée (onglet Créer mon compte). Le module commun
// d'invitation (envoyerInvitation, stagiaires-gestion.js) ne sert pas ici : il appelle inviter_compte pour UNE fiche et UNE promo
// affichée, alors que cette page règle plusieurs promos d'un centre d'un coup ; seule la forme de l'adresse est reprise.

import { getMesPromos, lireEquipeDuCentre, lireFichesFormateurLibres, reglerAffectationsFormateur } from "../db.js?v=20261109i";
import { el, clear, toast, tableauEnListe } from "../utils.js?v=20261109i";
import { icon } from "../icons.js?v=20261109i";
import { getCentre, getAdminEmail } from "../auth-admin.js?v=20261109i";
import { promosDuCentre, phraseDeRefus } from "../espaces-rules.js?v=20261109i";
import { equipeAffichee, unionPromos } from "../direction-rules.js?v=20261109i";

const entier = (x) => Number(x).toLocaleString("fr-FR");
const pluriel = (nb, mot, motPluriel = mot + "s") => `${entier(nb)} ${nb > 1 ? motPluriel : mot}`;

const PHRASE_SANS_CENTRE = "Ce compte ne dirige aucun centre.";
const PHRASE_LECTURE_ECHEC = "L'équipe du centre n'a pas pu être chargée.";
const PHRASE_ADRESSE = "Adresse e-mail invalide.";
const PHRASE_SANS_PROMO_CHOISIE = "Choisis au moins une promo.";
export const PHRASE_COMPTE_CREE = "Compte créé. La personne crée son mot de passe avec cette adresse, onglet Créer mon compte.";
export const PHRASE_PROMOS_MAJ = "Promos mises à jour.";
const PHRASE_RIEN_A_CHANGER = "Rien à changer : les promos sont les mêmes.";
const PHRASE_RIEN_RETIRE = "Cette personne n'avait aucune promo dans ce centre : rien n'a changé.";
const DELAI_MS = 15000;

let rendu = 0;

// Le centre dirigé et ses promos (la plus récente d'abord).
function contexte() {
  const centre = getCentre();
  if (!centre) return { centre: null, promos: [] };
  const promos = promosDuCentre(getMesPromos(), centre.id)
    .slice().sort((a, b) => String(b.date_debut || "").localeCompare(String(a.date_debut || "")) || a.id - b.id);
  return { centre, promos };
}

// Une écriture ne reste jamais en attente : au-delà de 15 s, la phrase le dit et la saisie reste.
function avecDelai(promesse) {
  let minuteur;
  const delai = new Promise((_, rejet) => {
    minuteur = setTimeout(() => rejet(Object.assign(new Error("Délai dépassé (15 s). Réseau lent : réessaie dans un instant."), { phrase: true })), DELAI_MS);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}
const phraseDe = (err) => (err && err.phrase === true ? err.message : phraseDeRefus(err && err.message, err && err.code));

// ============================================================== Fenêtres

// Fenêtre générique : `corps` (nœuds du formulaire), `valeurs()` rend les saisies ou une phrase de refus (texte), `enregistrer(valeurs)`
// rend une promesse (si elle lève, la phrase s'affiche dans la fenêtre et la saisie reste ; sinon la fenêtre se ferme).
export function ouvrirFenetre({ titre, intro, corps, ancre, libelleBouton, valider, enregistrer, premierChamp, apresFermeture }) {
  const message = el("p", { class: "promo-refus", role: "alert" });
  const annuler = el("button", { class: "btn ghost", type: "button" }, "Annuler");
  const ok = el("button", { class: "btn primary", type: "submit" }, libelleBouton);
  const fond = el("div", { class: "modal-backdrop" });
  const fermer = () => {
    document.removeEventListener("keydown", auClavier, true);
    fond.remove();
    if (ancre && ancre.isConnected) ancre.focus({ preventScroll: true });
  };
  function auClavier(e) {
    if (e.key === "Escape") { e.stopPropagation(); if (!ok.disabled) fermer(); }
  }
  annuler.addEventListener("click", () => { if (!ok.disabled) fermer(); });
  const formulaire = el("form", { class: "modal-form", novalidate: "" },
    intro ? el("p", { class: "muted equipe-intro" }, intro) : null,
    ...corps, message,
    el("div", { class: "modal-actions" }, annuler, ok));
  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (ok.disabled) return;
    const v = valider ? valider() : {};
    if (typeof v === "string") { message.textContent = v; return; }
    message.textContent = "";
    ok.disabled = true;
    annuler.disabled = true;
    try {
      await avecDelai(enregistrer(v));
      fermer();
      // Facultatif : ce qui s'ouvre une fois la fenêtre fermée (une autre fenêtre, qui prend alors le focus).
      if (apresFermeture) apresFermeture();
    } catch (err) {
      console.error(err);
      message.textContent = phraseDe(err);
      ok.disabled = false;
      annuler.disabled = false;
    }
  });
  fond.appendChild(el("div", { class: "modal promo-fenetre equipe-fenetre", role: "dialog", "aria-modal": "true", "aria-labelledby": "equipe-fenetre-titre" },
    el("h3", { id: "equipe-fenetre-titre" }, titre), formulaire));
  document.addEventListener("keydown", auClavier, true);
  document.body.appendChild(fond);
  (premierChamp ? premierChamp() : ok).focus();
}

// Les cases « promos du centre » : une case par promo, cible de 44 px. `cochees` : identifiants déjà cochés.
function casesPromos(promos, cochees) {
  const cases = promos.map((p) => {
    const c = el("input", { type: "checkbox", value: String(p.id), id: "equipe-promo-" + p.id });
    c.checked = cochees.includes(p.id);
    return { promo: p, c };
  });
  const groupe = el("fieldset", { class: "equipe-cases" },
    el("legend", {}, "Promos du centre"),
    ...cases.map(({ promo, c }) => el("label", { class: "equipe-case", for: "equipe-promo-" + promo.id }, c, el("span", {}, promo.nom))));
  return { groupe, choisies: () => cases.filter(({ c }) => c.checked).map(({ promo }) => promo.id) };
}

// `equipe` : les lignes affichées (equipeAffichee) ; « Inviter » AJOUTE des promos à une adresse déjà dans l'équipe, il ne remplace rien.
function ouvrirInvitation({ centre, promos, equipe, ancre, apres }) {
  const champEmail = el("input", { type: "email", id: "equipe-email", autocomplete: "off", maxlength: "200", placeholder: "prenom.nom@exemple.fr" });
  const { groupe, choisies } = casesPromos(promos, []);
  const choixFiche = el("select", { id: "equipe-fiche", disabled: "" }, el("option", { value: "" }, "Aucune fiche"));
  const noteFiche = el("p", { class: "muted equipe-note" }, "Chargement des fiches libres.");
  // Les fiches libres se lisent à l'ouverture : une lecture qui échoue ne bloque pas l'invitation (la fiche est facultative).
  lireFichesFormateurLibres().then((fiches) => {
    for (const f of fiches) choixFiche.appendChild(el("option", { value: String(f.id) }, f.nom));
    choixFiche.disabled = false;
    noteFiche.textContent = fiches.length
      ? "Relie la personne à une fiche formateur existante, si elle en a une. Sinon, laisse « Aucune fiche »."
      : "Aucune fiche formateur libre : la personne sera invitée sans fiche.";
  }).catch((e) => {
    console.error("fiches formateur libres", e);
    noteFiche.textContent = "Les fiches formateur n'ont pas pu être lues : tu peux inviter sans fiche.";
  });
  ouvrirFenetre({
    titre: "Inviter un formateur",
    intro: "Aucun e-mail n'est envoyé : la personne crée son mot de passe avec cette adresse, onglet Créer mon compte.",
    corps: [
      el("div", { class: "field" }, el("label", { for: "equipe-email" }, "Adresse e-mail du formateur"), champEmail),
      groupe,
      el("div", { class: "field" }, el("label", { for: "equipe-fiche" }, "Fiche formateur (facultative)"), choixFiche, noteFiche),
    ],
    ancre, libelleBouton: "Inviter", premierChamp: () => champEmail,
    valider: () => {
      const email = champEmail.value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return PHRASE_ADRESSE;
      const ids = choisies();
      if (!ids.length) return PHRASE_SANS_PROMO_CHOISIE;
      const connue = equipe.find((l) => l.email === email);
      return { email, promoIds: unionPromos(connue ? connue.promoIds : [], ids), profId: choixFiche.value ? Number(choixFiche.value) : null };
    },
    enregistrer: async (v) => {
      const r = await reglerAffectationsFormateur({ email: v.email, lieuId: centre.id, promoIds: v.promoIds, profId: v.profId });
      let phrase = r.cree ? PHRASE_COMPTE_CREE : PHRASE_PROMOS_MAJ;
      // La base rend ce qu'elle a retiré : si c'est non vide (une promo ôtée entre-temps), la phrase le dit.
      const retirees = (r.retirees || []).map((id) => (promos.find((p) => p.id === id) || {}).nom || "promo " + id);
      if (retirees.length) phrase += ` Retirée${retirees.length > 1 ? "s" : ""} : ${retirees.join(", ")}.`;
      // Un compte qui existe déjà garde sa fiche : celle qui a été choisie n'est pas reliée.
      if (!r.cree && v.profId != null) phrase += " Ce compte existait déjà : la fiche formateur choisie n'a pas été reliée.";
      toast(phrase, "success", 7000);
      await apres(v.email);
    },
  });
}

function ouvrirModification({ centre, promos, ligne, ancre, apres }) {
  const { groupe, choisies } = casesPromos(promos, ligne.promoIds);
  ouvrirFenetre({
    titre: "Modifier les promos",
    intro: ligne.nom === ligne.email ? ligne.email : `${ligne.nom} (${ligne.email})`,
    corps: [groupe],
    ancre, libelleBouton: "Enregistrer", premierChamp: () => groupe.querySelector("input"),
    valider: () => {
      const ids = choisies();
      // Une direction peut n'être formateur d'aucune promo ; un formateur sans promo n'est plus de l'équipe (c'est « Retirer du centre »).
      if (!ids.length && !ligne.direction) return PHRASE_SANS_PROMO_CHOISIE + " Pour le retirer du centre, utilise « Retirer du centre ».";
      return { promoIds: ids };
    },
    enregistrer: async (v) => {
      const r = await reglerAffectationsFormateur({ email: ligne.email, lieuId: centre.id, promoIds: v.promoIds, profId: null });
      const rien = !(r.ajoutees || []).length && !(r.retirees || []).length;
      toast(rien ? PHRASE_RIEN_A_CHANGER : PHRASE_PROMOS_MAJ, "success", 5000);
      await apres(ligne.email);
    },
  });
}

function ouvrirRetrait({ centre, ligne, ancre, apres }) {
  ouvrirFenetre({
    titre: "Retirer du centre",
    intro: `${ligne.nom === ligne.email ? ligne.email : `${ligne.nom} (${ligne.email})`} ne sera plus formateur d'aucune promo de ${centre.nom || "ce centre"}. `
      + "Son compte et ses promos dans d'autres centres ne changent pas.",
    corps: [],
    ancre, libelleBouton: "Retirer du centre",
    enregistrer: async () => {
      const r = await reglerAffectationsFormateur({ email: ligne.email, lieuId: centre.id, promoIds: [], profId: null });
      const retirees = (r.retirees || []).length;
      toast(retirees ? "Retiré du centre." : PHRASE_RIEN_RETIRE, retirees ? "success" : "info", 5000);
      await apres(null);
    },
  });
}

// ============================================================== Page

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

export async function renderEquipeCentre(container) {
  const jeton = ++rendu;
  clear(container);
  const { centre, promos } = contexte();
  if (!centre) {
    container.appendChild(el("p", { class: "muted" }, PHRASE_SANS_CENTRE));
    return;
  }
  // Les lignes de l'équipe, remplies après la lecture (le bouton « Inviter » n'est cliquable qu'ensuite).
  let equipeCourante = [];
  const racine = el("div", { class: "centre equipe-centre" });
  container.appendChild(racine);
  const boutonInviter = promos.length
    ? el("button", { class: "btn primary", type: "button", onClick: (e) => ouvrirInvitation({ centre, promos, equipe: equipeCourante, ancre: e.currentTarget, apres }) },
      icon.plus(), "Inviter un formateur")
    : null;
  const entete = (sousTitre) => el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Centre de " + (centre.nom || "")),
      el("h2", { tabindex: "-1" }, "Équipe"),
      el("p", { class: "subtitle" }, sousTitre)),
    boutonInviter ? el("div", { class: "centre-actions" }, boutonInviter) : null);

  // Après une écriture : la page se relit ; le focus revient sur le bouton « Modifier » de la personne (ou sur « Inviter »).
  async function apres(email) {
    await renderEquipeCentre(container);
    if (jeton + 1 !== rendu) return;
    const cible = email
      ? [...document.querySelectorAll(".equipe-centre [data-email]")].find((n) => n.getAttribute("data-email") === email)
      : null;
    // Sinon « Inviter », sinon le titre de la page (il prend le focus sans entrer dans l'ordre de tabulation).
    const bouton = (cible && cible.querySelector("button")) || document.querySelector(".equipe-centre .centre-actions button")
      || document.querySelector(".equipe-centre h2");
    if (bouton) bouton.focus({ preventScroll: true });
  }

  racine.appendChild(entete("Chargement"));
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  let lignes;
  try {
    lignes = await lireEquipeDuCentre(centre.id);
  } catch (e) {
    console.error("équipe du centre", e);
    if (jeton !== rendu) return;
    clear(racine);
    racine.appendChild(entete("L'équipe du centre"));
    racine.appendChild(boiteErreur(PHRASE_LECTURE_ECHEC, () => renderEquipeCentre(container)));
    return;
  }
  if (jeton !== rendu) return;
  clear(racine);
  const equipe = equipeAffichee(lignes, promos);
  equipeCourante = equipe;
  racine.appendChild(entete(equipe.length ? pluriel(equipe.length, "personne") + " dans l'équipe" : "Personne dans l'équipe pour le moment"));

  if (!promos.length) {
    racine.appendChild(el("div", { class: "centre-section centre-vide" },
      el("p", {}, "Ce centre n'a pas encore de promo."),
      el("p", { class: "muted" }, "Une promo est nécessaire pour inviter un formateur."),
      el("a", { class: "btn primary", href: "#/promos" }, "Créer une promo")));
  }
  if (!equipe.length) {
    if (promos.length) {
      racine.appendChild(el("div", { class: "centre-section centre-vide" },
        el("p", {}, "Aucun formateur dans ce centre pour le moment."),
        el("p", { class: "muted" }, "Invite un formateur : il choisira son mot de passe avec l'adresse que tu donnes.")));
    }
    return;
  }

  const moi = String(getAdminEmail() || "").toLowerCase();
  const lignesTable = equipe.map((l) => {
    const direction = l.role !== "Formateur";
    // Une direction ne se retire pas d'ici (ses promos de formateur se règlent par « Modifier ») ; on ne se retire jamais soi-même.
    const retirable = !direction && l.email !== moi;
    const ancre = (b) => b.currentTarget;
    const actions = [];
    if (promos.length) {
      actions.push(el("button", { class: "btn small", type: "button", "aria-label": `Modifier les promos de ${l.nom}`,
        onClick: (e) => ouvrirModification({ centre, promos, ligne: { ...l, direction }, ancre: ancre(e), apres }) }, icon.pencil(), "Modifier"));
    }
    if (retirable) {
      actions.push(el("button", { class: "btn small", type: "button", "aria-label": `Retirer ${l.nom} du centre`,
        onClick: (e) => ouvrirRetrait({ centre, ligne: { ...l, direction }, ancre: ancre(e), apres }) }, icon.trash(), "Retirer du centre"));
    }
    return el("tr", { "data-email": l.email },
      el("td", { class: "liste-titre" }, el("div", { class: "equipe-nom" }, el("strong", {}, l.nom),
        l.nom !== l.email ? el("span", { class: "muted equipe-adresse" }, l.email) : null,
        l.email === moi ? el("span", { class: "chip centre-promo" }, "Toi") : null)),
      el("td", {}, el("span", { class: "chip equipe-role" + (direction ? " equipe-role-direction" : "") }, l.role)),
      el("td", {}, l.promos || el("span", { class: "muted" }, "Aucune promo")),
      el("td", { class: "liste-actions" }, el("div", { class: "equipe-actions" }, ...actions)));
  });
  const table = tableauEnListe(el("table", { class: "centre-table equipe-table" },
    el("thead", {}, el("tr", {}, ...["Nom", "Rôle", "Promos", ""].map((t) => el("th", { scope: "col", "aria-label": t || "Actions" }, t)))),
    el("tbody", {}, ...lignesTable)));
  racine.appendChild(el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Direction et formateurs")),
    el("div", { class: "centre-defile" }, table)));
}
