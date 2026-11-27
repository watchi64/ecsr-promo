// La fenêtre « Écrire » de l'espace contact, pour les quatre gestes : un stagiaire écrit au centre (l'encadré « Sera envoyé à » vient de
// la base : les noms quand le centre a réglé qui reçoit, des cases à cocher quand il n'a rien réglé), un stagiaire ou l'équipe écrit à
// une personne depuis sa fiche, l'équipe écrit à un stagiaire ou à un collègue. Les règles de l'encadré sont dans js/contact-rules.js
// (lignesEncadre) ; la base juge tout (droit, destinataires), ses refus se disent par leur phrase. Le stagiaire est tutoyé, l'équipe vouvoyée.

import {
  apercuEnvoi, ecrireAuCentre, ecrireA, ecrireAuStagiaire, lireAnnuaire, listStagiaires,
} from "../db.js?v=20261127a";
import { el, clear, displayStagiaire } from "../utils.js?v=20261127a";
import { icon } from "../icons.js?v=20261127a";
import { vueStagiaire, selonPublic } from "../auth-admin.js?v=20261127a";
import { ouvrirModale } from "../nav-fenetre.js?v=20261127a";
import { lignesEncadre, libelleDestinataire, phraseContact, basculerCoche } from "../contact-rules.js?v=20261127a";

// Les types qu'un stagiaire peut écrire (l'absence a son propre geste).
export const TYPES_ECRITS = [
  ["retard", "Retard"], ["administratif", "Question administrative"], ["document", "Document"], ["autre", "Autre"],
];

export const PHRASE_ENCADRE_ECHEC = "Les destinataires n'ont pas pu être chargés.";

// Où mène le suivi d'une demande : la page Contacts pour le stagiaire, Messages pour l'équipe et la direction.
export const routeDesDemandes = () => (vueStagiaire() ? "contacts" : "messages");

/**
 * Ouvre la fenêtre. `cible` : « centre » (stagiaire), « fiche » (avec `ficheId`, `nomDestinataire`), « stagiaire » (équipe vers un
 * stagiaire, `stagiaireId` facultatif : sinon une liste), « collegue » (équipe vers une fiche : liste). `ancre` : le bouton qui rend le
 * focus. `apres(id)` : appelée avec l'identifiant de la demande créée (défaut : ouvrir son suivi).
 */
export async function ouvrirEcrire({ cible, ficheId = null, nomDestinataire = null, stagiaireId = null, ancre = null, apres = null }) {
  const stagiaire = vueStagiaire();
  let modale = null;
  let jeton = 0;

  const titre = cible === "centre" ? "Écrire au centre"
    : cible === "stagiaire" ? "Écrire à un stagiaire" : cible === "collegue" ? "Écrire à un collègue"
      : "Écrire à " + (nomDestinataire || "cette personne");

  const champ = (libelle, saisie) => {
    const id = saisie.id || (saisie.id = "ecrire-" + Math.random().toString(36).slice(2, 8));
    const erreur = el("p", { class: "contact-champ-erreur", role: "alert" });
    return { noeud: el("div", { class: "field" }, el("label", { for: id }, libelle), saisie, erreur), erreur, saisie };
  };

  // Le destinataire : une liste pour « stagiaire » sans stagiaire donné et pour « collegue ».
  let choixDest = null;
  if ((cible === "stagiaire" && stagiaireId == null) || cible === "collegue") {
    const select = el("select", {}, el("option", { value: "" }, "Choisir une personne"));
    choixDest = champ(cible === "stagiaire" ? "Stagiaire" : "Collègue", select);
    const charger = cible === "stagiaire"
      ? listStagiaires().then((l) => l.map((s) => [s.id, displayStagiaire(s)]))
      : lireAnnuaire().then((l) => l.filter((f) => !f.moi && f.joignable).map((f) => [f.id, f.nom_affiche || "Sans nom"]));
    charger.then((lignes) => {
      for (const [id, nom] of lignes) select.appendChild(el("option", { value: String(id) }, nom));
    }).catch((e) => {
      console.error("destinataires", e);
      choixDest.erreur.textContent = phraseContact(e, "La liste des personnes n'a pas pu être chargée.");
    });
  }

  const type = stagiaire && cible !== "stagiaire"
    ? champ("Type", el("select", {}, ...TYPES_ECRITS.map(([v, l]) => el("option", { value: v }, l)))) : null;
  const sujet = champ("Sujet", el("input", { type: "text", maxlength: "80", autocomplete: "off" }));
  const texte = champ("Message", el("textarea", { rows: "5", maxlength: "1000" }));
  const general = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });

  // L'encadré « Sera envoyé à ».
  const encadre = el("div", { class: "contact-encadre ecrire-encadre", role: "group", "aria-live": "polite" });
  let apercu = null;
  let coches = null;   // null : les cases pré-cochées par la base ; sinon l'ensemble des cases cochées
  let bouton = null;

  const peutEnvoyer = () => (cible !== "centre" || (apercu != null && lignesEncadre(apercu, coches).envoyable));
  const majBouton = () => { if (bouton) bouton.disabled = !peutEnvoyer(); };

  function dessinerEncadre() {
    clear(encadre);
    if (cible !== "centre") {
      // Le destinataire est celui de la fiche ; quand on le choisit dans la liste, il n'y a pas d'encadré.
      if (!choixDest) encadre.appendChild(el("p", {}, el("b", {}, "Sera envoyé à : "), nomDestinataire || "cette personne"));
      return;
    }
    if (apercu == null) { encadre.appendChild(el("p", {}, "Chargement des destinataires")); return; }
    const l = lignesEncadre(apercu, coches);
    if (l.mode === "regle") {
      const noms = (apercu.principaux ?? []).map((p) => libelleDestinataire({ nom: p.nom, relais_de: p.relais_de }));
      encadre.appendChild(el("p", {}, el("b", {}, "Sera envoyé à : "), noms.join(", ")));
      return;
    }
    encadre.appendChild(el("p", {}, el("b", {}, "Sera envoyé à : ")));
    encadre.appendChild(el("p", { class: "contact-aide" }, l.phrase));
    if (l.cases.length === 0) return;
    const liste = el("div", { class: "ecrire-cases" });
    for (const c of l.cases) {
      const id = "ecrire-dest-" + c.fiche_id;
      const saisie = el("input", { type: "checkbox", id, value: String(c.fiche_id), checked: c.coche });
      saisie.addEventListener("change", () => {
        // L'ensemble courant (celui de l'écran à cet instant), jamais celui du dessin : les clics successifs se cumulent.
        const courants = lignesEncadre(apercu, coches).cases.filter((x) => x.coche).map((x) => x.fiche_id);
        coches = basculerCoche(courants, c.fiche_id, saisie.checked);
        majBouton();
      });
      liste.appendChild(el("label", { class: "contact-case", for: id }, saisie,
        el("span", {}, c.titre ? `${c.nom} (${c.titre})` : c.nom)));
    }
    encadre.appendChild(liste);
  }

  async function chargerApercu() {
    if (cible !== "centre") return;
    const mien = ++jeton;
    apercu = null;
    coches = null;
    majBouton();
    dessinerEncadre();
    try {
      const a = await apercuEnvoi(type ? type.saisie.value : "autre");
      if (mien !== jeton) return;
      apercu = a;
      dessinerEncadre();
    } catch (e) {
      console.error("aperçu de l'envoi", e);
      if (mien !== jeton) return;
      clear(encadre);
      encadre.appendChild(el("p", { role: "alert" }, phraseContact(e, PHRASE_ENCADRE_ECHEC)));
      encadre.appendChild(el("button", { class: "btn small", type: "button", onClick: () => chargerApercu() }, "Réessayer"));
    }
    majBouton();
  }
  if (type) type.saisie.addEventListener("change", chargerApercu);

  async function envoyer() {
    general.textContent = "";
    sujet.erreur.textContent = "";
    if (choixDest) choixDest.erreur.textContent = "";
    const s = sujet.saisie.value.trim();
    const t = texte.saisie.value.trim();
    let erreur = false;
    if (!s) { sujet.erreur.textContent = "Le sujet est nécessaire."; erreur = true; }
    let destId = cible === "fiche" ? ficheId : stagiaireId;
    if (choixDest) {
      destId = choixDest.saisie.value === "" ? null : Number(choixDest.saisie.value);
      if (destId == null) { choixDest.erreur.textContent = "Choisissez une personne."; erreur = true; }
    }
    if (erreur) { modale.fenetre.querySelector(".contact-champ-erreur:not(:empty)")?.closest(".field")?.querySelector("input, select, textarea")?.focus(); return; }
    bouton.disabled = true;
    try {
      let id;
      if (cible === "centre") {
        const l = lignesEncadre(apercu, coches);
        id = await ecrireAuCentre({ type: type.saisie.value, sujet: s, texte: t,
          choisis: l.mode === "choix" ? l.cases.filter((c) => c.coche).map((c) => c.fiche_id) : null });
      } else if (cible === "stagiaire") {
        id = await ecrireAuStagiaire({ stagiaireId: destId, sujet: s, texte: t });
      } else {
        id = await ecrireA({ ficheId: destId, type: type ? type.saisie.value : null, sujet: s, texte: t });
      }
      modale.fermer({ focus: false });
      if (apres) await apres(id);
      else location.hash = `#/${routeDesDemandes()}/${id}`;
    } catch (e) {
      console.error("écrire", e);
      general.textContent = phraseContact(e, selonPublic("Le message n'a pas été envoyé. Réessaie dans un instant.",
        "Le message n'a pas été envoyé. Réessayez dans un instant."));
      bouton.disabled = !peutEnvoyer();
    }
  }

  bouton = el("button", { class: "btn primary", type: "button", disabled: cible === "centre", onClick: envoyer }, icon.check(), "Envoyer");
  const fenetre = el("div", { class: "modal contact-modal" },
    el("h3", {}, titre),
    el("div", { class: "modal-form" },
      choixDest ? choixDest.noeud : null,
      type ? type.noeud : null,
      sujet.noeud, texte.noeud, encadre, general),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: () => modale.demanderFermeture() }, "Annuler"),
      bouton));
  modale = ouvrirModale(fenetre, { retour: ancre, focus: () => (choixDest ? choixDest.saisie : type ? type.saisie : sujet.saisie) });
  dessinerEncadre();
  chargerApercu();
}
