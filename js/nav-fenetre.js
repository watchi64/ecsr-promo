// Fenêtres de la nouvelle navigation (refonte, lot 1) : le menu du compte (js/menu-compte.js) et
// le tiroir « Plus » du téléphone (js/nav-shell.js). Une seule ouverte à la fois.
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

import { el } from "./utils.js?v=20261029a";

const FOCALISABLES = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), '
  + 'textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// La fenêtre ouverte : son nom, son calque, la fenêtre elle-même, le bouton qui l'a ouverte et son action.
let ouverte = null;

const affiche = (e) => !!e && e.isConnected && e.getClientRects().length > 0;

// `contenu` : les nœuds de la fenêtre, en liste (imbriquée au besoin, les null sont ignorés). En tête, la
// poignée du tiroir et « Fermer », que css/navigation.css n'affiche que sur téléphone : hors du voile, le
// seul moyen visible d'en sortir sans choisir une ligne.
export function ouvrirFenetre({ nom, ancre, etiquette, classe, contenu }) {
  fermerFenetre({ focus: false });
  const haut = el("div", { class: "nav-fenetre-haut" },
    el("button", { type: "button", class: "nav-fenetre-fermer", onClick: () => fermerFenetre() }, "Fermer"));
  const fenetre = el("div", {
    class: "nav-fenetre " + classe, role: "dialog", "aria-modal": "true", "aria-label": etiquette, tabindex: "-1",
  }, haut, contenu.flat(Infinity));
  const calque = el("div", { class: "modal-backdrop nav-calque", "data-nav-coquille": nom }, fenetre);
  calque.addEventListener("click", (e) => {
    if (e.target === calque) fermerFenetre();
    else if (e.target.closest("a[href]")) fermerFenetre({ focus: false });
  });
  document.body.appendChild(calque);
  document.addEventListener("keydown", auClavier, true);
  window.addEventListener("hashchange", surChangementAdresse);
  if (ancre) ancre.setAttribute("aria-expanded", "true");
  ouverte = { nom, calque, fenetre, ancre, action: ancre ? ancre.dataset.navAction : null };
  fenetre.focus({ preventScroll: true });
  return fenetre;
}

// Nom de la fenêtre ouverte (« compte », « plus »), null s'il n'y en a pas.
export function fenetreOuverte() {
  return ouverte ? ouverte.nom : null;
}

// L'adresse change sous la fenêtre ouverte (geste retour, adresse saisie dans l'app ouverte) : elle se
// ferme comme par Échap. Un lien choisi dans la fenêtre l'a déjà fermée avant que l'adresse ne change.
function surChangementAdresse() {
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
  const { calque, ancre, action } = ouverte;
  const focusDedans = calque.contains(document.activeElement);
  oublierFenetre();
  calque.remove();
  if (ancre) ancre.setAttribute("aria-expanded", "false");
  const rendre = () => rendreFocus(ancre, action);
  if (focus) {
    rendre();
    return null;
  }
  return focusDedans ? rendre : null;
}

// Le focus revient au bouton qui a ouvert la fenêtre (ou le panneau de l'assistant, js/nav-shell.js).
// S'il a disparu ou ne s'affiche plus (coquille remontée, autre espace, écran élargi), il va à un bouton
// affiché de la même action, sinon au bouton du compte, que chaque espace affiche à toute taille : jamais au
// corps de la page.
export function rendreFocus(ancre, action) {
  const visible = (a) => (a ? [...document.querySelectorAll(`[data-nav-coquille] [data-nav-action="${a}"]`)].find(affiche) : null);
  const cible = (affiche(ancre) && ancre) || visible(action) || visible("compte");
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
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    fermerFenetre();
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
