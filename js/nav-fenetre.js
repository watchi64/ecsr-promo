// Fenêtres de la nouvelle navigation (refonte, lot 1) : le menu du compte (js/menu-compte.js) et
// le tiroir « Plus » du téléphone (js/nav-shell.js). Une seule ouverte à la fois.
//
// Chacune est un calque plein écran, racine de la coquille (data-nav-coquille vaut « compte » ou
// « plus ») qui porte aussi la classe modal-backdrop des fenêtres de l'app : même voile, et le
// planning (Échap) comme l'émargement (relecture) savent qu'une fenêtre est ouverte. Dans le calque,
// la fenêtre role="dialog" prend le focus à l'ouverture (elle-même, pas sa première ligne, qui
// paraîtrait choisie) et Tab y reste. Échap, un clic sur le voile ou fermerFenetre() la ferment et
// rendent le focus au bouton qui l'a ouverte ; si une coquille remontée l'a remplacé entre-temps
// (rôle changé depuis le menu, modules relus), à son équivalent visible (même data-nav-action).
// Choisir un lien de la fenêtre la ferme sans rendre le focus : la page change. Le calque survit
// au remontage des barres de la coquille ; demonterCoquille() le ferme.

import { el } from "./utils.js?v=20261027a";

const FOCALISABLES = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), '
  + 'textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// La fenêtre ouverte : son calque, la fenêtre elle-même, le bouton qui l'a ouverte et son action.
let ouverte = null;

const affiche = (e) => !!e && e.isConnected && e.getClientRects().length > 0;

// `contenu` : les nœuds de la fenêtre, en liste (imbriquée au besoin, les null sont ignorés).
export function ouvrirFenetre({ nom, ancre, etiquette, classe, contenu }) {
  fermerFenetre({ focus: false });
  const fenetre = el("div", {
    class: "nav-fenetre " + classe, role: "dialog", "aria-modal": "true", "aria-label": etiquette, tabindex: "-1",
  }, contenu.flat(Infinity));
  const calque = el("div", { class: "modal-backdrop nav-calque", "data-nav-coquille": nom }, fenetre);
  calque.addEventListener("click", (e) => {
    if (e.target === calque) fermerFenetre();
    else if (e.target.closest("a[href]")) fermerFenetre({ focus: false });
  });
  document.body.appendChild(calque);
  document.addEventListener("keydown", auClavier, true);
  if (ancre) ancre.setAttribute("aria-expanded", "true");
  ouverte = { calque, fenetre, ancre, action: ancre ? ancre.dataset.navAction : null };
  fenetre.focus({ preventScroll: true });
  return fenetre;
}

export function fermerFenetre({ focus = true } = {}) {
  if (!ouverte) return;
  const { calque, ancre, action } = ouverte;
  ouverte = null;
  document.removeEventListener("keydown", auClavier, true);
  calque.remove();
  if (ancre) ancre.setAttribute("aria-expanded", "false");
  if (!focus) return;
  const cible = affiche(ancre) ? ancre : action
    ? [...document.querySelectorAll(`[data-nav-coquille] [data-nav-action="${action}"]`)].find(affiche) : null;
  if (cible) cible.focus({ preventScroll: true });
}

// Clavier, écouté sur le document en capture tant que la fenêtre est ouverte. Échap s'arrête ici :
// sinon le planning quitterait aussi son mode Modifier derrière la fenêtre. Tab et Maj+Tab passent
// d'une ligne à l'autre de la fenêtre, en boucle, menés ici et non par le navigateur : Safari saute
// les liens à la tabulation, et le focus sortirait alors de la fenêtre par Maj+Tab.
function auClavier(e) {
  if (!ouverte) return;
  if (!ouverte.calque.isConnected) {
    ouverte = null;
    document.removeEventListener("keydown", auClavier, true);
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
