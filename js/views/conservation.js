// Sous-onglet « Conservation des données » de la page Qualiopi (lot Q5, spec 2026-11-08 § 6 et § 11.2). Réservé au fondateur
// comme toute la page (porte de js/main.js ; la base le vérifie aussi, peut_gerer_qualite()). Deux parties :
//   - Les échéances : toutes les promos et tous les centres accessibles (etat_conservation()), chacune avec sa date, ce qui
//     part et ce qui reste, et son bouton quand la date est passée. Aucun effacement ne part tout seul : chaque bouton ouvre une
//     fenêtre de l'app (js/confirmer.js) qui dit exactement ce qui part, et n'agit qu'après la saisie du mot EFFACER. Le
//     registre qualité garde son propre bouton (lot Q4) : sa carte renvoie au sous-onglet « Registre qualité ».
//   - L'effacement à la demande : une carte par fiche de la promo choisie en tête de page, avec « Effacer à la demande »
//     (saisie du prénom). La fiche n'est pas déclarée en abandon.
// Rien sous le seuil (lot Q3) : les portées des formateurs portent des drapeaux, et aucun nombre de répondants n'est écrit
// sous 3 formateurs (5 stagiaires). Migration pas encore appliquée : lireEtatConservation() rend null, la section le dit.
// Une liste de cartes, jamais un tableau, sur téléphone comme sur ordinateur.

import { el, clear, toast } from "../utils.js?v=20261111l";
import { lireEtatConservation, effacerSurDemande, lireEffacementsSurDemande } from "../db.js?v=20261111l";
import {
  echeancesConservation, confirmationEcheance, confirmationDemande, compteRenduConservation, rappelConservation, statutFiche,
} from "../effacement-rules.js?v=20261111l";
import { confirmer } from "../confirmer.js?v=20261111l";
import { tableau } from "../qualiopi-preuves.js?v=20261111l";
import { nomPromo } from "../qualiopi-page-rules.js?v=20261111l";
// Les cartes des échéances et leurs gestes, partagés avec les Réglages du centre (direction) : module à part, qui part avec l'app
// sans tirer la page Qualiopi.
import { ACTIONS, CONSERVATION_ABSENTE, carteEcheance } from "./conservation-cartes.js?v=20261111l";

export { CONSERVATION_ABSENTE };

// La section. `ouvrirRegistre()` passe au sous-onglet « Registre qualité » ; `ouvrirConservation()` à celui-ci (le bouton du
// rappel) ; `apresEffacement(promoId)` relit la promo touchée (null : aucune promo en particulier). Rend { noeud, rappel,
// lireEtat, majPromo } : le contenu du sous-onglet, la ligne de rappel en tête de page, la lecture des échéances et la promo
// dont les fiches s'affichent.
export function creerConservation({ ouvrirRegistre, ouvrirConservation, apresEffacement }) {
  const noeud = el("section", { class: "cons", "aria-labelledby": "cons-titre" });
  const rappel = el("div", { class: "qualiopi-rappel-registre cons-rappel" });
  const annonce = el("p", { class: "cons-statut", role: "status", "aria-live": "polite" });
  const zoneEcheances = el("div", { class: "cons-zone" });
  const zoneFiches = el("div", { class: "cons-zone" });
  // lu : null pendant la lecture, { absent: true }, { erreur }, ou { etat, echeances }.
  // fiches : null pendant la lecture, { erreur }, ou { promo, liste, surDemande: Set }.
  const s = { lu: null, promo: null, fiches: null, occupe: false };
  let lecture = 0;
  let lectureFiches = 0;

  noeud.append(
    el("h3", { class: "qualiopi-titre", id: "cons-titre" }, "Conservation des données"),
    el("p", { class: "qualiopi-intro" },
      "Les preuves d'une formation sont gardées jusqu'au 31 décembre de la 3e année après sa fin, le reste part 12 mois après "
      + "la fin. Rien ne part tout seul : à chaque date, un bouton s'allume ici et attend votre clic."),
    annonce,
    el("h4", { class: "cons-sous-titre" }, "Échéances, toutes promos et tous centres"),
    zoneEcheances,
    el("h4", { class: "cons-sous-titre" }, "Effacer à la demande d'une personne"),
    zoneFiches);

  function dire(texte, erreur = false) {
    annonce.textContent = "";
    annonce.classList.toggle("erreur", erreur);
    if (texte) setTimeout(() => { annonce.textContent = texte; }, 50);   // vidée puis remplie : le même message est relu
  }

  function bloquer(valeur) {
    s.occupe = valeur;
    noeud.querySelectorAll("button[data-cons]").forEach((b) => { b.disabled = valeur; });
  }

  // --- Échéances ---
  async function lireEtat() {
    const moi = ++lecture;
    if (!s.lu?.echeances) { s.lu = null; afficherEcheances(); }
    let lu;
    try {
      const etat = await lireEtatConservation();
      lu = etat === null ? { absent: true } : { etat, echeances: echeancesConservation(etat) };
    } catch (e) {
      console.error(e);
      lu = { erreur: e.message || "Les échéances n'ont pas pu être lues." };
    }
    if (moi !== lecture) return;
    s.lu = lu;
    afficherEcheances();
    afficherFiches();
    majRappel();
  }

  function majRappel() {
    clear(rappel);
    const texte = s.lu?.echeances ? rappelConservation(s.lu.echeances) : null;
    if (!texte) return;
    rappel.append(
      el("div", { class: "qualiopi-rappel-textes" }, el("p", {}, texte)),
      el("button", { class: "btn", type: "button", onClick: () => ouvrirConservation() }, "Voir la conservation"));
  }

  function afficherEcheances() {
    clear(zoneEcheances);
    const lu = s.lu;
    if (lu === null) { zoneEcheances.appendChild(el("div", { class: "loading" }, "Chargement")); return; }
    if (lu.absent) { zoneEcheances.appendChild(el("p", { class: "qualiopi-vide" }, CONSERVATION_ABSENTE)); return; }
    if (lu.erreur) {
      zoneEcheances.appendChild(el("div", { class: "centre-erreur qualiopi-erreur", role: "alert" },
        el("p", {}, lu.erreur),
        el("button", { class: "btn small", type: "button", onClick: () => lireEtat() }, "Réessayer")));
      return;
    }
    const dues = lu.echeances.filter((e) => e.due);
    const avenir = lu.echeances.filter((e) => !e.due);
    if (!lu.echeances.length) {
      zoneEcheances.appendChild(el("p", { class: "qualiopi-vide" }, "Aucune échéance : rien n'est à effacer pour le moment."));
      return;
    }
    if (dues.length) {
      zoneEcheances.append(el("p", { class: "qualiopi-rangee-titre" }, "À faire maintenant"),
        el("ul", { class: "cons-cartes" }, ...dues.map((e) => carteEcheance(e, { agir, ouvrirRegistre }))));
    }
    if (avenir.length) {
      zoneEcheances.append(el("p", { class: "qualiopi-rangee-titre" }, "À venir"),
        el("ul", { class: "cons-cartes" }, ...avenir.map((e) => carteEcheance(e, { agir, ouvrirRegistre }))));
    }
  }

  async function agir(e) {
    if (s.occupe) return;
    const question = confirmationEcheance(e);
    if (!question || !ACTIONS[e.type]) return;
    if (!(await confirmer(question))) return;
    bloquer(true);
    let promoTouchee = null;
    try {
      const retour = await ACTIONS[e.type](e.cible);
      const texte = compteRenduConservation(e.type, retour);
      dire(texte);
      toast(texte, "success", 6000);
      if (e.cible?.kind === "promo") promoTouchee = e.cible.id;
    } catch (err) {
      console.error(err);
      dire(err.message || "L'opération n'a pas abouti.", true);
    } finally {
      bloquer(false);
    }
    await lireEtat();
    if (promoTouchee !== null) apresEffacement(promoTouchee);
  }

  // --- Effacement à la demande : les fiches de la promo choisie ---
  // `stagiaires` : la promesse des fiches de la promo (celles de la lecture du dossier, js/views/qualiopi.js).
  async function majPromo(promo, stagiaires) {
    const moi = ++lectureFiches;
    s.promo = promo;
    s.fiches = null;
    afficherFiches();
    let fiches;
    try {
      const [liste, surDemande] = await Promise.all([Promise.resolve(stagiaires), lireEffacementsSurDemande([promo.id])]);
      fiches = { promo, liste: tableau(liste), surDemande };
    } catch (e) {
      console.error(e);
      fiches = { erreur: "Les fiches de cette promo n'ont pas pu être lues." };
    }
    if (moi !== lectureFiches) return;
    s.fiches = fiches;
    afficherFiches();
  }

  function carteFiche(f, promo, surDemande, jour) {
    const nom = [f.prenom, f.nom].filter(Boolean).join(" ") || "Fiche sans nom";
    const terminee = !!promo.date_fin && promo.date_fin < jour;
    const effaceeDemande = surDemande.has(Number(f.id));
    const sansNom = !!f.anonymise_le;
    let statut = statutFiche(f, terminee, effaceeDemande);
    if (!effaceeDemande && sansNom) statut = "Nom effacé au terme de la durée de conservation";
    else if (!effaceeDemande && f.efface_le) statut += " · comptes et textes effacés (étape des 12 mois)";
    const bouton = sansNom ? null : el("button", {
      class: "btn", type: "button", "data-cons": "demande", onClick: () => effacerFiche(f),
    }, "Effacer à la demande");
    return el("li", { class: "cons-fiche" + (sansNom ? " sans-nom" : "") },
      el("div", { class: "cons-fiche-texte" },
        el("p", { class: "cons-fiche-nom" }, nom),
        el("p", { class: "cons-fiche-statut" }, statut)),
      bouton);
  }

  function afficherFiches() {
    clear(zoneFiches);
    const promo = s.promo;
    if (!promo) return;
    zoneFiches.appendChild(el("p", { class: "qualiopi-aide cons-aide" },
      `Promo « ${nomPromo(promo)} » (choisie en haut de la page). Une personne qui demande l'effacement de ses données : tout `
      + "part tout de suite, sans attendre les dates et sans la déclarer en abandon."));
    if (s.lu?.absent) { zoneFiches.appendChild(el("p", { class: "qualiopi-vide" }, CONSERVATION_ABSENTE)); return; }
    if (s.fiches === null) { zoneFiches.appendChild(el("div", { class: "loading" }, "Chargement")); return; }
    if (s.fiches.erreur) {
      zoneFiches.appendChild(el("div", { class: "centre-erreur qualiopi-erreur", role: "alert" },
        el("p", {}, s.fiches.erreur),
        el("button", { class: "btn small", type: "button", onClick: () => apresEffacement(promo.id) }, "Réessayer")));
      return;
    }
    const liste = [...s.fiches.liste].sort((a, b) => (Number(a.ordre) || 0) - (Number(b.ordre) || 0) || Number(a.id) - Number(b.id));
    if (!liste.length) { zoneFiches.appendChild(el("p", { class: "qualiopi-vide" }, "Aucune fiche dans cette promo.")); return; }
    const jour = s.lu?.etat?.jour || new Date().toISOString().slice(0, 10);
    zoneFiches.appendChild(el("ul", { class: "cons-fiches" }, ...liste.map((f) => carteFiche(f, promo, s.fiches.surDemande, jour))));
  }

  async function effacerFiche(f) {
    if (s.occupe) return;
    if (!(await confirmer(confirmationDemande(f)))) return;
    bloquer(true);
    let fait = false;
    try {
      const retour = await effacerSurDemande(f.id);
      const texte = compteRenduConservation("demande", retour);
      dire(texte);
      toast(texte, "success", 6000);
      fait = true;
    } catch (err) {
      console.error(err);
      dire(err.message || "L'opération n'a pas abouti.", true);
    } finally {
      bloquer(false);
    }
    if (fait) {
      lireEtat();
      apresEffacement(s.promo?.id ?? null);
    }
  }

  return { noeud, rappel, lireEtat, majPromo };
}
