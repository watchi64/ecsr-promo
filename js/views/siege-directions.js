// Page Directions de centre du siège (lot 5, Task 12) : pour chaque centre du réseau, ses directions (la fiche formateur liée au
// compte, sinon l'adresse). « Inviter une direction » (adresse, centre) passe par inviter_compte, « Retirer » (après confirmation)
// supprime l'affectation, « Ajouter un centre » crée le centre (creer_centre) puis propose d'inviter sa direction. La base décide de
// tout (siège seul, centre requis, nom en double) : ses refus se disent par leur phrase (phraseDeRefus), la saisie gardée. Les règles
// d'ordre (centres par nom, démonstration en dernier) vivent dans js/siege-rules.js. Aucune donnée de stagiaire n'est lue ici.
// Les fenêtres sont celles de la page Équipe de la direction (ouvrirFenetre).

import { lireLieuxDuReseau, lireDirectionsDuReseau, retirerAffectation, creerCentre, inviteUser } from "../db.js?v=20261109g";
import { el, clear, toast, tableauEnListe } from "../utils.js?v=20261109g";
import { icon } from "../icons.js?v=20261109g";
import { phraseDeRefus } from "../espaces-rules.js?v=20261109g";
import { messageInvitationReussie } from "../roles-rules.js?v=20261109g";
import { directionsParCentre } from "../siege-rules.js?v=20261109g";
import { ouvrirFenetre } from "./direction-equipe.js?v=20261109g";

const entier = (x) => Number(x).toLocaleString("fr-FR");
const pluriel = (nb, mot, motPluriel = mot + "s") => `${entier(nb)} ${nb > 1 ? motPluriel : mot}`;

export const PHRASE_ECHEC_DIRECTIONS = "Les directions des centres n'ont pas pu être chargées.";
export const PHRASE_ADRESSE = "Adresse e-mail invalide.";
export const PHRASE_CENTRE_REQUIS = "Le centre est requis.";
export const PHRASE_NOM_REQUIS = "Le nom est requis.";
export const PHRASE_SANS_DIRECTION = "Aucune direction pour ce centre.";
export const PHRASE_SANS_CENTRE = "Le réseau n'a pas encore de centre.";
export const LIBELLE_DEMO = "Centre de démonstration";

let rendu = 0;

// Un refus qui a sa phrase (droit manquant, fonction absente avant la migration) la dit ; toute autre panne, la phrase commune.
function phraseDEchec(e) {
  const code = e && e.code;
  return code === "42501" || code === "PGRST202" ? phraseDeRefus(e.message, code) : PHRASE_ECHEC_DIRECTIONS;
}

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

// ============================================================== Fenêtres

// Les centres du choix : par nom, la démonstration en dernier et nommée comme telle.
function optionsCentres(lieux, choisi) {
  return directionsParCentre(lieux, []).map(({ centre }) => {
    const o = el("option", { value: String(centre.id) }, centre.nom + (centre.demonstration ? " (démonstration)" : ""));
    if (choisi != null && centre.id === choisi) o.selected = true;
    return o;
  });
}

// « Inviter une direction » : adresse et centre. `lieuId` : centre déjà choisi (depuis un centre, ou juste après sa création) ;
// `intro` remplace la phrase d'explication.
export function ouvrirInvitationDirection({ lieux, lieuId = null, intro = null, ancre, apres }) {
  const champEmail = el("input", { type: "email", id: "direction-email", autocomplete: "off", maxlength: "200", placeholder: "prenom.nom@exemple.fr" });
  const choixCentre = el("select", { id: "direction-centre" }, el("option", { value: "" }, "Choisir un centre"), ...optionsCentres(lieux, lieuId));
  ouvrirFenetre({
    titre: "Inviter une direction",
    intro: intro || "Aucun e-mail n'est envoyé : la personne crée son mot de passe avec cette adresse, onglet Créer mon compte.",
    corps: [
      el("div", { class: "field" }, el("label", { for: "direction-email" }, "Adresse e-mail de la direction"), champEmail),
      el("div", { class: "field" }, el("label", { for: "direction-centre" }, "Centre"), choixCentre),
    ],
    ancre, libelleBouton: "Inviter", premierChamp: () => champEmail,
    valider: () => {
      const email = champEmail.value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return PHRASE_ADRESSE;
      if (!choixCentre.value) return PHRASE_CENTRE_REQUIS;
      return { email, lieuId: Number(choixCentre.value) };
    },
    enregistrer: async (v) => {
      const resultat = await inviteUser({ email: v.email, role: "direction", lieu_id: v.lieuId });
      const { texte, ton } = messageInvitationReussie({ resultat, email: v.email });
      toast(texte, ton, 6000);
      await apres();
    },
  });
}

// « Ajouter un centre » : le nom, puis la proposition d'inviter sa direction. Le nom en double est refusé par la base (sa phrase
// s'affiche dans la fenêtre, le nom reste). `apres()` relit la page qui a ouvert la fenêtre.
export function ouvrirAjoutCentre({ ancre, apres }) {
  let ouvrirSuite = null;
  const champNom = el("input", { type: "text", id: "centre-nom", autocomplete: "off", maxlength: "120", placeholder: "Nom du centre" });
  ouvrirFenetre({
    titre: "Ajouter un centre",
    intro: "Le centre est créé sans promo. Tu pourras ensuite inviter sa direction.",
    corps: [el("div", { class: "field" }, el("label", { for: "centre-nom" }, "Nom du centre"), champNom)],
    ancre, libelleBouton: "Ajouter", premierChamp: () => champNom,
    apresFermeture: () => { if (ouvrirSuite) ouvrirSuite(); },
    valider: () => {
      const nom = champNom.value.trim().replace(/\s+/g, " ");
      return nom ? { nom } : PHRASE_NOM_REQUIS;
    },
    enregistrer: async (v) => {
      const id = await creerCentre(v.nom);
      toast(`Centre créé : ${v.nom}.`, "success", 5000);
      // Les lieux sont relus pour que le choix de l'invitation porte le centre qui vient d'exister.
      let lieux;
      try { lieux = await lireLieuxDuReseau(); } catch (e) { console.error("lieux du réseau", e); lieux = []; }
      if (!lieux.some((l) => l.id === id)) lieux = [...lieux, { id, nom: v.nom, demonstration: false }];
      // La page se relit d'abord (elle rend le focus à son titre) ; la fenêtre d'invitation s'ouvre ensuite, une fois celle-ci fermée,
      // pour que son champ garde le focus et qu'un seul fond de fenêtre existe à la fois.
      await apres();
      ouvrirSuite = () => ouvrirInvitationDirection({
        lieux, lieuId: id, ancre,
        intro: `${v.nom} est créé. Invite sa direction, ou ferme cette fenêtre pour le faire plus tard.`,
        apres,
      });
    },
  });
}

function ouvrirRetrait({ centre, direction, ancre, apres }) {
  ouvrirFenetre({
    titre: "Retirer une direction",
    intro: `${direction.libelle === direction.email ? direction.email : `${direction.libelle} (${direction.email})`} ne dirigera plus ${centre.nom}. `
      + "Son compte et ses autres rôles ne changent pas.",
    corps: [],
    ancre, libelleBouton: "Retirer",
    enregistrer: async () => {
      await retirerAffectation(direction.id);
      toast("Direction retirée.", "success", 5000);
      await apres();
    },
  });
}

// ============================================================== Page

function sectionCentre({ centre, directions }, lieux, apres) {
  const tete = el("div", { class: "centre-section-tete" },
    el("h3", {}, centre.demonstration ? LIBELLE_DEMO : centre.nom),
    el("span", { class: "muted" }, pluriel(directions.length, "direction")));
  if (!directions.length) {
    return el("section", { class: "centre-section", "data-centre": String(centre.id) }, tete,
      el("p", { class: "muted" }, PHRASE_SANS_DIRECTION),
      el("button", { class: "btn small", type: "button", onClick: (e) => ouvrirInvitationDirection({ lieux, lieuId: centre.id, ancre: e.currentTarget, apres }) },
        icon.plus(), "Inviter une direction"));
  }
  const lignes = directions.map((d) => el("tr", { "data-email": d.email },
    el("td", { class: "liste-titre" }, el("div", { class: "equipe-nom" }, el("strong", {}, d.libelle),
      d.libelle !== d.email ? el("span", { class: "muted equipe-adresse" }, d.email) : null)),
    el("td", { class: "liste-actions" }, el("div", { class: "equipe-actions" },
      el("button", { class: "btn small", type: "button", "aria-label": `Retirer ${d.libelle} de la direction de ${centre.nom}`,
        onClick: (e) => ouvrirRetrait({ centre, direction: d, ancre: e.currentTarget, apres }) }, icon.trash(), "Retirer")))));
  const table = tableauEnListe(el("table", { class: "centre-table equipe-table" },
    el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Direction"), el("th", { scope: "col", "aria-label": "Actions" }, ""))),
    el("tbody", {}, ...lignes)));
  return el("section", { class: "centre-section", "data-centre": String(centre.id) }, tete, el("div", { class: "centre-defile" }, table));
}

export async function renderDirections(container) {
  const jeton = ++rendu;
  clear(container);
  const racine = el("div", { class: "centre equipe-centre directions-siege" });
  container.appendChild(racine);
  const apres = async () => {
    await renderDirections(container);
    const titre = document.querySelector(".directions-siege h2");
    if (titre) titre.focus({ preventScroll: true });
  };
  const entete = (surtitre, sousTitre, actions) => el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, surtitre),
      el("h2", { tabindex: "-1" }, "Directions de centre"),
      sousTitre ? el("p", { class: "subtitle" }, sousTitre) : null),
    actions);

  racine.appendChild(entete("Réseau", "Chargement", null));
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  let lieux, directions;
  try {
    [lieux, directions] = await Promise.all([lireLieuxDuReseau(), lireDirectionsDuReseau()]);
  } catch (e) {
    console.error("directions du réseau", e);
    if (jeton !== rendu) return;
    clear(racine);
    racine.appendChild(entete("Réseau", null, null));
    racine.appendChild(boiteErreur(phraseDEchec(e), () => renderDirections(container)));
    return;
  }
  if (jeton !== rendu) return;
  clear(racine);
  const centres = directionsParCentre(lieux, directions);
  const actions = el("div", { class: "centre-actions" },
    centres.length
      ? el("button", { class: "btn primary", type: "button", onClick: (e) => ouvrirInvitationDirection({ lieux, ancre: e.currentTarget, apres }) },
        icon.plus(), "Inviter une direction")
      : null,
    el("button", { class: centres.length ? "btn" : "btn primary", type: "button", onClick: (e) => ouvrirAjoutCentre({ ancre: e.currentTarget, apres }) },
      icon.plus(), "Ajouter un centre"));
  racine.appendChild(entete("Réseau · " + pluriel(centres.length, "centre"), "Les directions de chaque centre", actions));

  if (!centres.length) {
    racine.appendChild(el("div", { class: "centre-section centre-vide" },
      el("p", {}, PHRASE_SANS_CENTRE),
      el("p", { class: "muted" }, "Ajoute un centre, puis invite sa direction.")));
    return;
  }
  for (const c of centres) racine.appendChild(sectionCentre(c, lieux, apres));
}
