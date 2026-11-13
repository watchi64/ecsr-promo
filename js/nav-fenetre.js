// Les fenêtres de l'app, en un seul endroit. Deux sortes :
// - ouvrirFenetre : les fenêtres de la navigation (refonte, lot 1), le menu du compte (js/menu-compte.js), le tiroir
//   « Plus » du téléphone (js/nav-shell.js), puis Signaler, le registre et les questionnaires. Une seule ouverte à la fois ;
// - ouvrirModale : les fenêtres des écrans (formulaire, choix, aperçu), qui peuvent s'empiler (ménage du 11/11/2026 :
//   quinze fichiers bâtissaient chacun leur voile, avec ou sans Échap, avec ou sans focus gardé). Voir plus bas.
// Les questions oui/non et les saisies courtes passent par js/confirmer.js.
//
// Chacune est un calque plein écran, racine de la coquille (data-nav-coquille vaut « compte » ou
// « plus ») qui porte aussi la classe modal-backdrop des fenêtres de l'app : même voile, et le
// planning (Échap) comme l'émargement (relecture) savent qu'une fenêtre est ouverte. Dans le calque,
// la fenêtre role="dialog" prend le focus à l'ouverture (elle-même, pas sa première ligne, qui
// paraîtrait choisie) et Tab y reste. Échap, un clic sur le voile, « Fermer » (en haut de la fenêtre,
// sur téléphone) ou fermerFenetre() la ferment et rendent le focus (voir rendreFocus, jamais au corps
// de la page) ; une adresse qui change sous elle aussi (geste retour, adresse saisie) : ses lignes
// appartiennent à la page quittée. Choisir un lien de la fenêtre la ferme sans rendre le focus : la
// page change. Un remontage de la coquille ferme la fenêtre ouverte, dont les lignes et le bouton sont
// ceux de la coquille remplacée, et rend son focus dans la nouvelle.

import { el, suspendreAnnonce } from "./utils.js?v=20261113a";

const FOCALISABLES = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), '
  + 'textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// La fenêtre ouverte : son nom, son calque, la fenêtre elle-même, le bouton qui l'a ouverte et son action.
let ouverte = null;

const affiche = (e) => !!e && e.isConnected && e.getClientRects().length > 0;

// `contenu` : les nœuds de la fenêtre, en liste (imbriquée au besoin, les null sont ignorés). En tête, la
// poignée du tiroir et « Fermer », que css/navigation.css n'affiche que sur téléphone : hors du voile, le
// seul moyen visible d'en sortir sans choisir une ligne.
// `retour` (facultatif) : l'élément, ou la fonction qui le rend au moment de la fermeture, où rendre le focus quand le
// bouton d'ouverture manque ou a disparu (fenêtre ouverte par un lien, bandeau redessiné) ; l'ancienne barre n'a pas de
// bouton du compte où retomber.
// `avantFermeture` (facultatif) : appelée quand la personne ferme la fenêtre par un geste (« Fermer » du haut, voile,
// Échap, ou demanderFermeture() pour le « Fermer » propre à une fenêtre) ; rendre false garde la fenêtre ouverte (saisie
// modifiée : la fenêtre demande d'abord, puis se ferme elle-même). Une fermeture par le programme (fermerFenetre(), barre
// remontée) ou par l'adresse qui change ne la consulte pas : la page a déjà changé (limite écrite dans PROJECT_NOTES.md).
export function ouvrirFenetre({ nom, ancre, etiquette, classe, contenu, retour = null, avantFermeture = null }) {
  fermerFenetre({ focus: false });
  const haut = el("div", { class: "nav-fenetre-haut" },
    el("button", { type: "button", class: "nav-fenetre-fermer", onClick: () => demanderFermeture() }, "Fermer"));
  const fenetre = el("div", {
    class: "nav-fenetre " + classe, role: "dialog", "aria-modal": "true", "aria-label": etiquette, tabindex: "-1",
  }, haut, contenu.flat(Infinity));
  const calque = el("div", { class: "modal-backdrop nav-calque", "data-nav-coquille": nom }, fenetre);
  calque.addEventListener("click", (e) => {
    if (e.target === calque) demanderFermeture();
    else if (e.target.closest("a[href]")) fermerFenetre({ focus: false });
  });
  document.body.appendChild(calque);
  // L'annonce de l'ouverture (« Ton signalement a avancé ») ne recouvre pas la fenêtre : elle attend sa fermeture.
  suspendreAnnonce();
  document.addEventListener("keydown", auClavier, true);
  window.addEventListener("hashchange", surChangementAdresse);
  if (ancre) ancre.setAttribute("aria-expanded", "true");
  ouverte = { nom, calque, fenetre, ancre, action: ancre ? ancre.dataset.navAction : null, retour, avantFermeture };
  fenetre.focus({ preventScroll: true });
  return fenetre;
}

// La personne ferme la fenêtre (« Fermer », voile, Échap) : la fenêtre peut refuser par avantFermeture. Une erreur de
// avantFermeture ne bloque pas la personne dans la fenêtre : elle se ferme.
export function demanderFermeture() {
  if (!ouverte) return;
  const avant = ouverte.avantFermeture;
  if (typeof avant === "function") {
    let garder = false;
    try { garder = avant() === false; } catch (e) { console.error(e); }
    if (garder) return;
  }
  fermerFenetre();
}

// Nom de la fenêtre ouverte (« compte », « plus »), null s'il n'y en a pas.
export function fenetreOuverte() {
  return ouverte ? ouverte.nom : null;
}

// L'adresse change sous la fenêtre ouverte (geste retour, adresse saisie dans l'app ouverte) : elle se
// ferme comme par Échap. Un lien choisi dans la fenêtre l'a déjà fermée avant que l'adresse ne change. Une
// fenêtre déjà sortie de la page n'a plus rien à fermer : elle est seulement oubliée, comme par le clavier
// (auClavier), sans ramener le focus à un bouton que la personne a pu quitter.
function surChangementAdresse() {
  if (!ouverte) return;
  if (!ouverte.calque.isConnected) {
    oublierFenetre();
    return;
  }
  fermerFenetre();
}

// Plus de fenêtre ouverte : ses écouteurs du document et de la fenêtre du navigateur partent avec elle.
function oublierFenetre() {
  ouverte = null;
  document.removeEventListener("keydown", auClavier, true);
  window.removeEventListener("hashchange", surChangementAdresse);
}

// Ferme la fenêtre ouverte. `focus` : rendre le focus tout de suite. Sans lui, et si le focus était dans
// la fenêtre, renvoie la fonction qui le rendra plus tard (après le remontage de la coquille) ; null sinon.
export function fermerFenetre({ focus = true } = {}) {
  if (!ouverte) return null;
  const { calque, ancre, action, retour } = ouverte;
  const focusDedans = calque.contains(document.activeElement);
  oublierFenetre();
  calque.remove();
  if (ancre) ancre.setAttribute("aria-expanded", "false");
  const rendre = () => rendreFocus(ancre, action, retour);
  if (focus) {
    rendre();
    return null;
  }
  return focusDedans ? rendre : null;
}

// Le focus revient au bouton qui a ouvert la fenêtre (ou le panneau de l'assistant, js/nav-shell.js).
// S'il a disparu ou ne s'affiche plus (coquille remontée, autre espace, écran élargi), il va à un bouton
// affiché de la même action, sinon au point de retour de la fenêtre (`retour`, élément ou fonction), sinon au bouton
// du compte, que chaque espace de la nouvelle navigation affiche à toute taille : jamais au corps de la page.
export function rendreFocus(ancre, action, retour = null) {
  const visible = (a) => (a ? [...document.querySelectorAll(`[data-nav-coquille] [data-nav-action="${a}"]`)].find(affiche) : null);
  let point = null;
  try { point = typeof retour === "function" ? retour() : retour; } catch (e) { point = null; }
  const cible = (affiche(ancre) && ancre) || visible(action) || (affiche(point) && point) || visible("compte");
  if (cible) cible.focus({ preventScroll: true });
}

// Clavier, écouté sur le document en capture tant que la fenêtre est ouverte. Échap s'arrête ici :
// sinon le planning quitterait aussi son mode Modifier derrière la fenêtre. Tab et Maj+Tab passent
// d'une ligne à l'autre de la fenêtre, en boucle, menés ici et non par le navigateur : Safari saute
// les liens à la tabulation, et le focus sortirait alors de la fenêtre par Maj+Tab.
function auClavier(e) {
  if (!ouverte) return;
  if (!ouverte.calque.isConnected) {
    oublierFenetre();
    return;
  }
  // Une fenêtre d'écran ouverte par-dessus (ouvrirModale) mène le clavier : celle-ci attend dessous.
  if (voileDuDessus() !== ouverte.calque && pile.length) return;
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    demanderFermeture();
    return;
  }
  if (e.key !== "Tab") return;
  e.preventDefault();
  const cibles = [...ouverte.fenetre.querySelectorAll(FOCALISABLES)].filter(affiche);
  if (!cibles.length) return;
  const ici = cibles.indexOf(document.activeElement);
  const pas = e.shiftKey ? -1 : 1;
  const suivante = ici < 0 ? (e.shiftKey ? cibles.length - 1 : 0) : (ici + pas + cibles.length) % cibles.length;
  cibles[suivante].focus();
}

// =====================================================================================================================
// Les fenêtres des écrans : ouvrirModale
// =====================================================================================================================
// L'écran bâtit sa fenêtre comme avant (un élément .modal et son contenu, son aspect ne change pas) ; ouvrirModale la pose
// sur le voile des fenêtres de l'app (.modal-backdrop) et lui donne ce que chaque écran refaisait à sa façon :
// - role="dialog", aria-modal et un nom (son titre h2 ou h3, sinon `etiquette`) ;
// - le focus à l'ouverture : `focus` (un champ, un bouton), sinon la fenêtre elle-même, pour qu'un téléphone n'ouvre pas son
//   clavier sur un champ que la personne n'a pas choisi ;
// - Tab et Maj+Tab qui tournent dans la fenêtre sans en sortir ;
// - Échap et un toucher sur le voile (si `fermerAuVoile`, vrai par défaut) qui demandent la fermeture, comme le bouton
//   Annuler de l'écran (`demanderFermeture`) : `avantFermeture` peut la refuser (envoi en cours, saisie à garder). Un champ
//   de la fenêtre qui se sert d'Échap (saisie en place, suggestions) le garde pour lui par preventDefault() ;
// - le focus rendu à la fermeture : à `retour` (élément, ou fonction qui le rend au moment de fermer) s'il est donné, sinon à
//   ce qui l'avait avant l'ouverture, s'il est encore affiché.
// Les fenêtres s'empilent (un formulaire ouvert depuis un autre) : seule celle du dessus écoute le clavier, et Échap s'arrête
// là (le planning ne quitte pas son mode Modifier derrière). Une confirmation (js/confirmer.js) passe au-dessus de tout et
// garde le clavier pour elle. `auClavier` (facultatif) reçoit les autres touches (les flèches d'une liste de choix).
// Rend { fond, fenetre, fermer, demanderFermeture } : fermer() ferme sans demander (après un enregistrement ; fermer({ focus:
// false }) quand un écran plein prend la suite) ;
// `apresFermeture` est appelée une fois, quel que soit le chemin. Une fenêtre retirée de la page par son écran (ancienne
// manière, fond.remove()) est oubliée à la touche suivante. Testé par tests/nav-fenetre.test.mjs.

// Les fenêtres d'écran ouvertes, de la plus ancienne à celle du dessus.
const pile = [];
let numeroModale = 0;

// Le calque affiché le plus haut : le dernier posé dans la page. Fenêtres d'écran, de navigation, confirmations et calques plein
// écran (lecture d'un cours ou des conditions, QCM) s'ajoutent au corps de la page, chacun au-dessus des précédents : une
// fenêtre recouverte par l'un d'eux laisse le clavier à celui du dessus.
const CALQUES = ".modal-backdrop, .cours-overlay, .qcm-overlay";
function voileDuDessus() {
  return [...document.querySelectorAll(CALQUES)].filter(affiche).pop() || null;
}

export function ouvrirModale(fenetre, {
  etiquette = null, classeFond = "", focus = null, retour = null, fermerAuVoile = true,
  avantFermeture = null, apresFermeture = null, auClavier: autresTouches = null,
} = {}) {
  const avant = document.activeElement;
  fenetre.setAttribute("role", fenetre.getAttribute("role") || "dialog");
  fenetre.setAttribute("aria-modal", "true");
  if (!fenetre.hasAttribute("tabindex")) fenetre.setAttribute("tabindex", "-1");
  if (!fenetre.hasAttribute("aria-label") && !fenetre.hasAttribute("aria-labelledby")) {
    const titre = fenetre.querySelector("h2, h3");
    if (titre) {
      if (!titre.id) titre.id = `modale-titre-${++numeroModale}`;
      fenetre.setAttribute("aria-labelledby", titre.id);
    } else if (etiquette) {
      fenetre.setAttribute("aria-label", etiquette);
    }
  }
  const fond = el("div", { class: ("modal-backdrop " + classeFond).trim() }, fenetre);
  const entree = { fond, fenetre, autresTouches };
  let fini = false;

  // `focus: false` : un écran plein (examen, éditeur, cours) s'ouvre à la place, le focus ne retourne pas sous lui.
  const fermer = ({ focus: rendre = true } = {}) => {
    if (fini) return;
    fini = true;
    retirer(entree);
    fond.remove();
    let cible = null;
    try { cible = typeof retour === "function" ? retour() : retour; } catch (e) { cible = null; }
    if (!retour) cible = avant;
    if (rendre && cible && cible !== document.body && affiche(cible) && typeof cible.focus === "function") cible.focus({ preventScroll: true });
    if (typeof apresFermeture === "function") {
      try { apresFermeture(); } catch (e) { console.error(e); }
    }
  };
  // Le geste de la personne (Annuler, Échap, voile) : `avantFermeture` peut garder la fenêtre ouverte. Une erreur de sa part
  // ne l'enferme pas : la fenêtre se ferme.
  const demanderFermeture = () => {
    if (fini) return;
    if (typeof avantFermeture === "function") {
      let garder = false;
      try { garder = avantFermeture() === false; } catch (e) { console.error(e); }
      if (garder) return;
    }
    fermer();
  };
  entree.demanderFermeture = demanderFermeture;

  fond.addEventListener("click", (e) => { if (e.target === fond && fermerAuVoile) demanderFermeture(); });
  // Échap venu de la fenêtre, à la remontée : un champ qui s'en sert d'abord (annuler une saisie en place, fermer une liste
  // de suggestions) l'arrête par preventDefault(), et la fenêtre reste ouverte.
  fond.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || pile[pile.length - 1] !== entree) return;
    e.preventDefault();
    e.stopPropagation();
    demanderFermeture();
  });
  document.body.appendChild(fond);
  if (!pile.length) document.addEventListener("keydown", clavierModale, true);
  pile.push(entree);
  const premier = typeof focus === "function" ? focus() : focus;
  (premier && typeof premier.focus === "function" ? premier : fenetre).focus({ preventScroll: true });
  return { fond, fenetre, fermer, demanderFermeture };
}

function retirer(entree) {
  const i = pile.indexOf(entree);
  if (i >= 0) pile.splice(i, 1);
  if (!pile.length) document.removeEventListener("keydown", clavierModale, true);
}

// Clavier des fenêtres d'écran, écouté sur le document en capture tant qu'il y en a une ouverte.
function clavierModale(e) {
  // Les fenêtres retirées de la page par leur écran sont oubliées.
  for (const entree of [...pile]) if (!entree.fond.isConnected) retirer(entree);
  const haut = pile[pile.length - 1];
  if (!haut || voileDuDessus() !== haut.fond) return;   // une fenêtre de navigation ou une confirmation est au-dessus
  // Échap tapé hors de la fenêtre (focus resté dessous) : elle se ferme ici. Venu de la fenêtre, il remonte jusqu'à son voile.
  if (e.key === "Escape" && !haut.fond.contains(e.target)) {
    e.preventDefault();
    e.stopPropagation();
    haut.demanderFermeture();
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    const cibles = [...haut.fenetre.querySelectorAll(FOCALISABLES)].filter(affiche);
    if (!cibles.length) { haut.fenetre.focus({ preventScroll: true }); return; }
    const ici = cibles.indexOf(document.activeElement);
    const pas = e.shiftKey ? -1 : 1;
    const suivante = ici < 0 ? (e.shiftKey ? cibles.length - 1 : 0) : (ici + pas + cibles.length) % cibles.length;
    cibles[suivante].focus();
    return;
  }
  if (typeof haut.autresTouches === "function") haut.autresTouches(e);
}
