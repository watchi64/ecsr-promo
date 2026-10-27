// Coquille de la nouvelle navigation (refonte, lot 1) : la barre de l'espace, montée dans #app
// quand l'interrupteur de la promo est allumé (js/nav-etat.js). Rendu seulement : les entrées,
// l'entrée allumée et la barre du téléphone viennent de js/nav-rules.js. Les entrées sont des
// liens « #/route » : un clic passe par navigate() et sa garde de saisie. L'ancienne barre
// (header.topbar) reste dans la page, masquée par css/navigation.css sous body[data-nav="v2"].
//
// Stagiaire : un en-tête collant (logo, onglets en capsule, Assistant, compte) ; sur téléphone,
// l'en-tête garde le logo, l'Assistant et le compte, et les onglets passent dans une barre fixe en
// bas de l'écran. Chaque racine de la coquille porte data-nav-coquille. Les boutons Assistant et
// compte portent data-nav-action (« assistant », « compte ») : l'assistant et le menu du compte
// de la coquille s'y brancheront ; d'ici là, ils ne font rien.

import { el } from "./utils.js?v=20261027a";
import { icon } from "./icons.js?v=20261027a";
import { barreTelephone, entreeActive } from "./nav-rules.js?v=20261027a";

// La coquille en place : ses entrées et celles que le téléphone range dans « Plus » (équipe).
// null quand aucune n'est montée.
let montee = null;

// Icône décorative : le libellé de l'entrée la nomme déjà.
function deco(noeud) {
  noeud.setAttribute("aria-hidden", "true");
  noeud.setAttribute("focusable", "false");
  return noeud;
}
const iconeDe = (nom) => deco((icon[nom] || icon.info)());

// Libellé qui réserve la place de sa version en gras (copie invisible tirée de data-texte, voir
// css/navigation.css) : allumer une entrée ne décale pas ses voisines.
const libelle = (texte, classe) => el("span", { class: classe, "data-texte": texte }, texte);

function enTete(entrees, nom, initiales) {
  const marque = el("a", { href: "#/home", class: "nav-marque", title: "Accueil" },
    el("img", { class: "nav-logo", src: "assets/logo/tpecsr-logo.svg", alt: "TP ECSR" }));
  const onglets = el("nav", { class: "nav-onglets", "aria-label": "Navigation principale" },
    entrees.map((e) => el("a", { href: "#/" + e.route, class: "nav-onglet", "data-entree": e.id },
      iconeDe(e.icone), libelle(e.libelle, "nav-onglet-texte"))));
  const assistant = el("button", { type: "button", class: "nav-assistant", "data-nav-action": "assistant", title: "Assistant" },
    deco(icon.chat()), el("span", { class: "nav-assistant-texte" }, "Assistant"));
  const nomDuCompte = nom ? `Mon compte (${nom})` : "Mon compte";
  const compte = el("button", {
    type: "button", class: "nav-compte", "data-nav-action": "compte", "aria-label": nomDuCompte, title: nomDuCompte,
  }, el("span", { class: "nav-avatar", "aria-hidden": "true" }, initiales || deco(icon.user())), deco(icon.chevronDown()));
  return el("header", { class: "nav-haut", "data-nav-coquille": "haut" },
    marque, onglets, el("div", { class: "nav-droite" }, assistant, compte));
}

function barreDuBas(entrees) {
  return el("nav", { class: "nav-bas", "data-nav-coquille": "bas", "aria-label": "Navigation principale" },
    entrees.map((e) => el("a", { href: "#/" + e.route, class: "nav-case", "data-entree": e.id },
      el("span", { class: "nav-case-icone" }, iconeDe(e.icone)), libelle(e.court, "nav-case-texte"))));
}

// L'élément de la coquille qui a le focus clavier, en sélecteur : remonter la coquille (modules
// ouverts ou fermés, rôle changé) le rend à l'élément équivalent au lieu de le perdre.
function focusDansLaCoquille() {
  const actif = document.activeElement;
  const racine = actif && actif.closest ? actif.closest("[data-nav-coquille]") : null;
  if (!racine) return null;
  const cible = actif.dataset.entree ? `[data-entree="${actif.dataset.entree}"]`
    : actif.dataset.navAction ? `[data-nav-action="${actif.dataset.navAction}"]`
      : actif.classList.contains("nav-marque") ? ".nav-marque" : null;
  return cible && `[data-nav-coquille="${racine.dataset.navCoquille}"] ${cible}`;
}

function retirerRacines() {
  document.querySelectorAll("[data-nav-coquille]").forEach((r) => r.remove());
}

// Monte la coquille de l'espace dans #app : en-tête en tête de #app, barre du bas juste après
// (navigation avant le contenu, dans l'ordre du clavier). Remonter remplace la coquille en place.
export function monterCoquille({ espace, entrees, nom, initiales }) {
  const app = document.getElementById("app");
  if (!app) return;
  const focus = focusDansLaCoquille();
  retirerRacines();
  const { barre, plus } = barreTelephone(espace, entrees);
  app.prepend(enTete(entrees, nom, initiales), barreDuBas(barre));
  document.body.dataset.nav = "v2";
  document.body.dataset.espace = espace;
  montee = { entrees: entrees.map((e) => ({ ...e })), plus: plus.map((e) => e.id) };
  if (focus) document.querySelector(focus)?.focus();
}

// Allume l'entrée de la page affichée (entreeActive : alias compris), et « Plus » quand le
// téléphone range cette entrée dans son tiroir. Une page sans entrée n'allume rien.
export function majEntreeActive(route) {
  if (!montee) return;
  const id = entreeActive(route, montee.entrees);
  const dansPlus = id !== null && montee.plus.includes(id);
  document.querySelectorAll("[data-nav-coquille] [data-entree], [data-nav-coquille] [data-nav-action='plus']").forEach((n) => {
    const allume = n.dataset.navAction === "plus" ? dansPlus : n.dataset.entree === id;
    if (allume) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  });
}

// Retire la coquille : l'ancienne barre réapparaît (plus rien sous body[data-nav="v2"]).
export function demonterCoquille() {
  retirerRacines();
  montee = null;
  delete document.body.dataset.nav;
  delete document.body.dataset.espace;
}

export function coquilleMontee() {
  return montee !== null;
}
