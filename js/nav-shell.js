// Coquille de la nouvelle navigation (refonte, lot 1) : la barre de l'espace, montée dans #app
// quand l'interrupteur de la promo est allumé (js/nav-etat.js). Rendu seulement : les entrées,
// l'entrée allumée, la barre du téléphone et le repère des modules fermés viennent de
// js/nav-rules.js. Les entrées sont des liens « #/route » : un clic passe par navigate() et sa
// garde de saisie. L'ancienne barre (header.topbar) reste dans la page, masquée par
// css/navigation.css sous body[data-nav="v2"].
//
// Stagiaire : un en-tête collant (logo et promo, onglets en capsule, Assistant, compte) ; sur
// téléphone, l'en-tête garde le logo, l'Assistant et le compte, et les onglets passent dans une
// barre fixe en bas de l'écran.
// Équipe : une barre latérale sombre (la promo affichée et le bouton qui replie la barre, les
// entrées groupées, l'Assistant et le compte en pied), en colonne d'icônes quand elle est repliée
// (choix mémorisé sur l'appareil) et toujours sur tablette. Sur téléphone, la même barre devient
// l'en-tête (promo, compte) et les entrées passent dans la barre du bas : quatre, plus « Plus »,
// qui ouvre un tiroir avec les autres, l'Assistant et le compte. Une entrée dont la page est
// fermée pour la promo porte le repère « masqué aux stagiaires » (œil barré), et « Plus » un point
// quand l'une des siennes le porte.
//
// Crochets : chaque racine porte data-nav-coquille (« haut » en-tête du stagiaire, « cote » barre
// de l'équipe, « bas » barre du téléphone ; « compte » ou « plus » pour la fenêtre ouverte, voir
// js/nav-fenetre.js) ; une entrée porte data-entree (son id) ; un bouton porte data-nav-action :
// « compte » ouvre le menu du compte (js/menu-compte.js), « plus » le tiroir, « replier » plie ou
// déplie la barre latérale, « assistant » attend l'assistant (il ne fait rien encore).
// majEntreeActive allume par aria-current="page" l'entrée de la page affichée, ou « Plus »
// (data-nav-action="plus") quand le téléphone range cette entrée dans son tiroir : les ids de
// barreTelephone(espace, entrees).plus.

import { el } from "./utils.js?v=20261027a";
import { icon } from "./icons.js?v=20261027a";
import { getProfile } from "./auth-admin.js?v=20261027a";
import { getPromoCourante } from "./db.js?v=20261027a";
import { construirePastille } from "./promo-pastille.js?v=20261027a";
import { routeMasquee, repereMasque } from "./modules-etat.js?v=20261027a";
import {
  barreTelephone, entreeActive, entreeMasquee, initialesDe, prenomDe, libelleRole,
} from "./nav-rules.js?v=20261027a";
import { ouvrirFenetre, fermerFenetre } from "./nav-fenetre.js?v=20261027a";
import { ouvrirMenuCompte } from "./menu-compte.js?v=20261027a";

// Barre latérale repliée en colonne d'icônes : choix mémorisé sur l'appareil.
const CLE_REPLIEE = "ecsr_nav_repliee";
// Tailles de css/navigation.css : la barre de l'équipe est une colonne d'icônes sur tablette.
const TABLETTE_OU_PLUS = window.matchMedia("(min-width: 700px)");
const ORDINATEUR = window.matchMedia("(min-width: 1080px)");

// La coquille en place (null quand aucune n'est montée) : son espace, ses entrées, celles que le
// téléphone range dans « Plus », la route de la page affichée, la personne et le geste
// « Actualiser » de l'app, que le menu du compte propose.
let montee = null;
// Choix « barre repliée », lu une fois ; gardé ici quand le stockage de l'appareil est indisponible.
let repliee = null;

// Icône décorative : le libellé de l'entrée la nomme déjà.
function deco(noeud) {
  noeud.setAttribute("aria-hidden", "true");
  noeud.setAttribute("focusable", "false");
  return noeud;
}

// Icône d'une entrée (nom tiré de nav-rules.js). Un nom absent de js/icons.js se signale une fois
// en console (le test des règles l'attrape aussi) et l'entrée garde une icône de repli.
const iconesInconnues = new Set();
function iconeDe(nom) {
  if (Object.prototype.hasOwnProperty.call(icon, nom)) return deco(icon[nom]());
  if (!iconesInconnues.has(nom)) {
    iconesInconnues.add(nom);
    console.error(`Navigation : icône « ${nom} » absente de js/icons.js, icône de repli dessinée.`);
  }
  return deco(icon.info());
}

// Libellé qui réserve la place de sa version en gras (copie invisible tirée de data-texte, voir
// css/navigation.css) : allumer une entrée ne décale pas ses voisines.
const libelle = (texte, classe) => el("span", { class: classe, "data-texte": texte }, texte);

const avatar = (initiales) => el("span", { class: "nav-avatar", "aria-hidden": "true" }, initiales || deco(icon.user()));

// Repère « masqué aux stagiaires » (œil barré et infobulle) d'une entrée de l'équipe.
const reperer = (noeud, e) => repereMasque(noeud, entreeMasquee(e.route, routeMasquee));

function boutonCompte(classe, nom, ...contenu) {
  const nomDuCompte = nom ? `Mon compte (${nom})` : "Mon compte";
  const bouton = el("button", {
    type: "button", class: classe, "data-nav-action": "compte", "aria-haspopup": "dialog", "aria-expanded": "false",
    "aria-label": nomDuCompte, title: nomDuCompte,
  }, ...contenu);
  bouton.addEventListener("click", () => ouvrirMenuCompte(bouton, { actualiser: montee && montee.actualiser }));
  return bouton;
}

// L'assistant s'y branchera (Task 6) : d'ici là, le bouton ne fait rien.
const boutonAssistant = (classe, attrs, ...contenu) =>
  el("button", { type: "button", class: classe, "data-nav-action": "assistant", title: "Assistant", ...attrs }, ...contenu);

// Les entrées dans l'ordre, celles d'un même groupe sous son titre (« Promo »). `ou` distingue les
// identifiants des titres (barre latérale, tiroir).
function groupes(entrees, ou, faire) {
  const blocs = [];
  entrees.forEach((e) => {
    const dernier = blocs[blocs.length - 1];
    if (dernier && dernier.titre === e.groupe) dernier.entrees.push(e);
    else blocs.push({ titre: e.groupe, entrees: [e] });
  });
  return blocs.flatMap((b, i) => {
    const liens = b.entrees.map(faire);
    if (!b.titre) return liens;
    const id = `nav-groupe-${ou}-${i}`;
    return [el("div", { class: "nav-groupe", role: "group", "aria-labelledby": id },
      el("p", { class: "nav-groupe-titre", id }, b.titre), liens)];
  });
}

// ----- Stagiaire : en-tête -----

function enTeteStagiaire(entrees, nom, initiales) {
  const promo = getPromoCourante()?.nom;
  const marque = el("a", { href: "#/home", class: "nav-marque", title: "Accueil", "aria-label": "TP ECSR, accueil" },
    el("img", { class: "nav-logo", src: "assets/logo/tpecsr-logo.svg", alt: "TP ECSR" }),
    promo ? el("span", { class: "nav-marque-promo" }, promo) : null);
  const onglets = el("nav", { class: "nav-onglets", "aria-label": "Navigation principale" },
    entrees.map((e) => el("a", { href: "#/" + e.route, class: "nav-onglet", "data-entree": e.id },
      iconeDe(e.icone), libelle(e.libelle, "nav-onglet-texte"))));
  const assistant = boutonAssistant("nav-assistant", {},
    deco(icon.chat()), el("span", { class: "nav-assistant-texte" }, "Assistant"));
  const prenom = prenomDe(nom);
  const compte = boutonCompte("nav-compte", nom, avatar(initiales),
    prenom ? el("span", { class: "nav-compte-prenom" }, prenom) : null, deco(icon.chevronDown()));
  return el("header", { class: "nav-haut", "data-nav-coquille": "haut" },
    marque, onglets, el("div", { class: "nav-droite" }, assistant, compte));
}

// ----- Équipe : barre latérale (en-tête sur téléphone) -----

// La promo affichée : la pastille (le choix de la promo) à qui en a au moins deux, sinon son nom.
// Sa marque, les initiales de la promo, reste seule dans la colonne d'icônes.
function contexteDePromo() {
  const nomPromo = getPromoCourante()?.nom || "";
  const marque = el("span", { class: "nav-contexte-marque", "aria-hidden": "true" },
    initialesDe(nomPromo) || deco(icon.users()));
  const type = el("span", { class: "nav-contexte-type" }, "Promo");
  const pastille = construirePastille();
  if (pastille) {
    pastille.classList.add("nav-contexte");
    pastille.prepend(marque, type);
    return pastille;
  }
  return el("div", { class: "nav-contexte", title: nomPromo || null },
    marque, nomPromo ? type : null, el("span", { class: "nav-contexte-nom" }, nomPromo || "TP ECSR"));
}

function boutonReplier() {
  const bouton = el("button", { type: "button", class: "nav-replier", "data-nav-action": "replier" });
  bouton.addEventListener("click", () => {
    repliee = !barreRepliee();
    try {
      if (repliee) localStorage.setItem(CLE_REPLIEE, "1");
      else localStorage.removeItem(CLE_REPLIEE);
    } catch (e) { /* stockage indisponible : le choix vaut pour la session */ }
    appliquerColonne();
  });
  return bouton;
}

function entreeLaterale(e) {
  const lien = el("a", { href: "#/" + e.route, class: "nav-entree", "data-entree": e.id, title: e.libelle },
    iconeDe(e.icone), el("span", { class: "nav-entree-texte" }, e.libelle));
  reperer(lien, e);
  // En colonne d'icônes, le libellé ne se voit plus : le nom (repère compris) passe par aria-label.
  lien.setAttribute("aria-label", lien.getAttribute("title"));
  return lien;
}

function barreLaterale(entrees, nom, initiales) {
  const role = libelleRole(getProfile());
  return el("aside", { class: "nav-cote", "data-nav-coquille": "cote", "aria-label": "Barre de l'équipe" },
    el("div", { class: "nav-cote-tete" }, contexteDePromo(), boutonReplier()),
    el("nav", { class: "nav-cote-entrees", "aria-label": "Navigation principale" }, groupes(entrees, "cote", entreeLaterale)),
    el("div", { class: "nav-cote-pied" },
      boutonAssistant("nav-entree nav-cote-assistant", { "aria-label": "Assistant" },
        deco(icon.chat()), el("span", { class: "nav-entree-texte" }, "Assistant")),
      boutonCompte("nav-cote-compte", nom, avatar(initiales),
        el("span", { class: "nav-cote-compte-texte" }, el("b", {}, nom || "Mon compte"), role ? el("small", {}, role) : null))));
}

function barreRepliee() {
  if (repliee === null) {
    try { repliee = localStorage.getItem(CLE_REPLIEE) === "1"; } catch (e) { repliee = false; }
  }
  return repliee;
}

// Colonne d'icônes : la barre de l'équipe sur tablette, ou repliée sur ordinateur. L'état est posé
// sur body (data-nav-colonne), que css/navigation.css lit pour la barre et le décalage du contenu.
// Rejoué à chaque montage et quand la fenêtre passe 700 ou 1 080 px ; sans coquille, rien à faire
// (demonterCoquille retire l'état).
function appliquerColonne() {
  if (!montee) return;
  const colonne = montee.espace === "equipe" && TABLETTE_OU_PLUS.matches && (!ORDINATEUR.matches || barreRepliee());
  if (colonne) document.body.dataset.navColonne = "";
  else delete document.body.dataset.navColonne;
  const bouton = document.querySelector('[data-nav-coquille="cote"] [data-nav-action="replier"]');
  if (!bouton) return;
  const texte = barreRepliee() ? "Déplier la barre" : "Replier la barre";
  bouton.setAttribute("aria-label", texte);
  bouton.setAttribute("title", texte);
  bouton.replaceChildren(deco(barreRepliee() ? icon.panelOpen() : icon.panel()));
}
TABLETTE_OU_PLUS.addEventListener("change", appliquerColonne);
ORDINATEUR.addEventListener("change", appliquerColonne);

// ----- Téléphone : barre du bas et tiroir « Plus » -----

function barreDuBas(barre, plus, equipe) {
  const cases = barre.map((e) => {
    const lien = el("a", { href: "#/" + e.route, class: "nav-case", "data-entree": e.id },
      el("span", { class: "nav-case-icone" }, iconeDe(e.icone)), libelle(e.court, "nav-case-texte"));
    return equipe ? reperer(lien, e) : lien;
  });
  if (plus.length) cases.push(boutonPlus(plus));
  return el("nav", { class: "nav-bas", "data-nav-coquille": "bas", "aria-label": "Navigation principale" }, cases);
}

function boutonPlus(plus) {
  const point = plus.some((e) => entreeMasquee(e.route, routeMasquee))
    ? el("span", { class: "nav-point", role: "img", "aria-label": "une page y est masquée aux stagiaires" }) : null;
  const bouton = el("button", {
    type: "button", class: "nav-case nav-plus", "data-nav-action": "plus", "aria-haspopup": "dialog", "aria-expanded": "false",
  }, el("span", { class: "nav-case-icone" }, iconeDe("grid")), libelle("Plus", "nav-case-texte"), point);
  bouton.addEventListener("click", () => ouvrirPlus(bouton));
  return bouton;
}

function ouvrirPlus(bouton) {
  if (!montee) return;
  const { entrees, nom, initiales, actualiser } = montee;
  const allumee = entreeActive(montee.route, entrees);
  const lien = (e) => reperer(el("a", {
    href: "#/" + e.route, class: "nav-fenetre-lien", "data-entree": e.id, "aria-current": e.id === allumee ? "page" : null,
  }, iconeDe(e.icone), el("span", { class: "nav-fenetre-texte" }, e.libelle)), e);
  const compte = el("button", {
    type: "button", class: "nav-fenetre-lien", "data-nav-action": "compte", "aria-haspopup": "dialog",
    title: nom ? `Mon compte (${nom})` : "Mon compte",
  }, avatar(initiales), el("span", { class: "nav-fenetre-texte" }, "Mon compte"));
  // Le menu du compte prend la place du tiroir ; Échap rend alors le focus à « Plus ».
  compte.addEventListener("click", () => {
    fermerFenetre({ focus: false });
    ouvrirMenuCompte(bouton, { actualiser });
  });
  ouvrirFenetre({
    nom: "plus", ancre: bouton, etiquette: "Plus", classe: "nav-tiroir",
    contenu: [
      el("p", { class: "nav-fenetre-section" }, "Tout l'espace formateur"),
      groupes(entrees.filter((e) => montee.plus.includes(e.id)), "plus", lien),
      el("p", { class: "nav-fenetre-section" }, "Outils"),
      boutonAssistant("nav-fenetre-lien", {}, deco(icon.chat()), el("span", { class: "nav-fenetre-texte" }, "Assistant")),
      compte,
    ],
  });
}

// ----- Montage -----

// L'élément de la coquille qui a le focus clavier, en sélecteur : remonter la coquille (modules
// ouverts ou fermés, rôle changé) le rend à l'élément équivalent au lieu de le perdre.
function focusDansLaCoquille() {
  const actif = document.activeElement;
  const racine = actif && actif.closest ? actif.closest("[data-nav-coquille]") : null;
  if (!racine) return null;
  const cible = actif.dataset.entree ? `[data-entree="${actif.dataset.entree}"]`
    : actif.dataset.navAction ? `[data-nav-action="${actif.dataset.navAction}"]`
      : actif.classList.contains("nav-marque") ? ".nav-marque"
        : actif.classList.contains("promo-pastille") ? ".promo-pastille" : null;
  return cible && `[data-nav-coquille="${racine.dataset.navCoquille}"] ${cible}`;
}

// Les barres de la coquille, pas la fenêtre ouverte : elle survit au remontage (js/nav-fenetre.js).
function retirerBarres() {
  document.querySelectorAll("[data-nav-coquille]:not(.nav-calque)").forEach((r) => r.remove());
}

// Monte la coquille de l'espace dans #app : sa barre (en-tête du stagiaire ou barre latérale de
// l'équipe) en tête de #app, la barre du téléphone juste après (navigation avant le contenu, dans
// l'ordre du clavier). Remonter remplace la coquille en place. `actualiser` : le geste
// « Actualiser » de l'app, proposé par le menu du compte.
export function monterCoquille({ espace, entrees, nom, initiales, actualiser }) {
  const app = document.getElementById("app");
  if (!app) return;
  const focus = focusDansLaCoquille();
  retirerBarres();
  const { barre, plus } = barreTelephone(espace, entrees);
  const equipe = espace === "equipe";
  app.prepend(equipe ? barreLaterale(entrees, nom, initiales) : enTeteStagiaire(entrees, nom, initiales),
    barreDuBas(barre, plus, equipe));
  document.body.dataset.nav = "v2";
  document.body.dataset.espace = espace;
  montee = { espace, entrees: entrees.map((e) => ({ ...e })), plus: plus.map((e) => e.id), route: null, nom, initiales, actualiser };
  appliquerColonne();
  if (focus) document.querySelector(focus)?.focus();
}

// Allume l'entrée de la page affichée (entreeActive : alias compris), et « Plus » quand le
// téléphone range cette entrée dans son tiroir. Une page sans entrée n'allume rien.
export function majEntreeActive(route) {
  if (!montee) return;
  montee.route = route;
  const id = entreeActive(route, montee.entrees);
  const dansPlus = id !== null && montee.plus.includes(id);
  document.querySelectorAll("[data-nav-coquille] [data-entree], [data-nav-coquille] [data-nav-action='plus']").forEach((n) => {
    const allume = n.dataset.navAction === "plus" ? dansPlus : n.dataset.entree === id;
    if (allume) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  });
}

// Retire la coquille, fenêtre comprise : l'ancienne barre réapparaît (plus rien sous body[data-nav="v2"]).
export function demonterCoquille() {
  fermerFenetre({ focus: false });
  retirerBarres();
  montee = null;
  delete document.body.dataset.nav;
  delete document.body.dataset.espace;
  delete document.body.dataset.navColonne;
}

export function coquilleMontee() {
  return montee !== null;
}
