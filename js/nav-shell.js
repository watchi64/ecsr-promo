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
// fermée aux stagiaires porte le repère « masqué aux stagiaires » (œil barré).
//
// Crochets : chaque racine porte data-nav-coquille (« haut » en-tête du stagiaire, « cote » barre
// de l'équipe, « bas » barre du téléphone ; « compte » ou « plus » pour la fenêtre ouverte, voir
// js/nav-fenetre.js) ; une entrée porte data-entree (son id) ; un bouton porte data-nav-action :
// « compte » ouvre le menu du compte (js/menu-compte.js), « plus » le tiroir, « replier » plie ou
// déplie la barre latérale, « assistant » ouvre ou ferme le panneau de l'assistant (js/chatbot.js),
// « signaler » ouvre la fenêtre « Signaler un problème » (js/signalement.js).
// majEntreeActive allume par aria-current="page" l'entrée de la page affichée, ou « Plus »
// (data-nav-action="plus") quand le téléphone range cette entrée dans son tiroir : les ids de
// barreTelephone(espace, entrees).plus. majNouveautesCompte pose sur les boutons du compte la
// pastille des nouveautés non lues (celle de l'ancien onglet Accueil) et la dit dans leur nom.

import { el } from "./utils.js?v=20261028a";
import { icon, deco } from "./icons.js?v=20261028a";
import { getProfile, fondateurHorsApercu } from "./auth-admin.js?v=20261028a";
import { getPromoCourante } from "./db.js?v=20261028a";
import { construirePastille } from "./promo-pastille.js?v=20261028a";
import { routeMasquee, repereMasque, moduleVisible, moduleMasque } from "./modules-etat.js?v=20261028a";
import {
  barreTelephone, entreeActive, entreeMasquee, initialesDe, prenomDe, libelleRole, nomDuBoutonCompte,
} from "./nav-rules.js?v=20261028a";
import { ouvrirFenetre, fermerFenetre, fenetreOuverte, rendreFocus } from "./nav-fenetre.js?v=20261028a";
import { ouvrirMenuCompte } from "./menu-compte.js?v=20261028a";
import { basculerAssistant, assistantOuvert, onAssistantChange } from "./chatbot.js?v=20261028a";
import { ouvrirSignalement } from "./signalement.js?v=20261028a";
import { etatSignalements, onSignalementsChange } from "./signalement-etat.js?v=20261028a";
import { pastilleSignalement } from "./signalement-rules.js?v=20261028a";

// Barre latérale repliée en colonne d'icônes : choix mémorisé sur l'appareil.
const CLE_REPLIEE = "ecsr_nav_repliee";
// Tailles de css/navigation.css : la barre de l'équipe est une colonne d'icônes sur tablette.
const TABLETTE_OU_PLUS = window.matchMedia("(min-width: 700px)");
const ORDINATEUR = window.matchMedia("(min-width: 1080px)");

// La coquille en place (null tant qu'aucune n'est montée) : son espace, ses entrées, celles que le
// téléphone range dans « Plus », la route de la page affichée, la personne et le geste
// « Actualiser » de l'app, que le menu du compte propose.
let montee = null;
// Choix « barre repliée », lu une fois ; gardé ici quand le stockage de l'appareil est indisponible.
let repliee = null;
// Nouveautés non lues, en texte de pastille (libellePastille : "" à zéro), posées par js/main.js : gardées
// ici pour les boutons d'une coquille remontée ensuite.
let nonLues = "";
// Ce que nomme chaque bouton du compte (le nom affiché, et le rôle là où la barre le montre) : la pastille
// des nouveautés le renomme sur place.
const identites = new WeakMap();

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

// Bouton qui ouvre le menu du compte (en-tête du stagiaire, barre de l'équipe et son en-tête de téléphone).
// `qui` : ce qu'il montre, { nom, role } (le rôle dans la barre de l'équipe seulement), que son nom
// reprend ; son contenu commence par l'avatar, où se pose la pastille des nouveautés non lues.
function boutonCompte(classe, qui, ...contenu) {
  const bouton = el("button", {
    type: "button", class: classe, "data-nav-action": "compte", "aria-haspopup": "dialog", "aria-expanded": "false",
  }, ...contenu);
  identites.set(bouton, qui);
  nommerCompte(bouton);
  bouton.addEventListener("click", () => ouvrirMenuCompte(bouton,
    { actualiser: montee && montee.actualiser, entrees: montee ? montee.entrees : [], espace: montee ? montee.espace : null }));
  return bouton;
}

// Nom (aria-label et infobulle) d'un bouton du compte, nouveautés non lues comprises, et sa pastille, la
// même que celle de l'ancien onglet Accueil, sur le coin de l'avatar. L'avatar est caché aux lecteurs
// d'écran : le nombre passe par le nom du bouton.
function nommerCompte(bouton) {
  const nom = nomDuBoutonCompte({ ...identites.get(bouton), nonLues });
  bouton.setAttribute("aria-label", nom);
  bouton.setAttribute("title", nom);
  const avatarDuBouton = bouton.querySelector(".nav-avatar");
  let pastille = avatarDuBouton && avatarDuBouton.querySelector(".nav-compte-pastille");
  if (!nonLues || !avatarDuBouton) {
    if (pastille) pastille.remove();
    return;
  }
  if (!pastille) pastille = avatarDuBouton.appendChild(el("span", { class: "nav-compte-pastille" }));
  pastille.textContent = nonLues;
}

// Nouveautés non lues (texte de la pastille, vide à zéro) : js/main.js l'appelle par le même chemin que la
// pastille de l'ancien onglet Accueil (après chaque montage, au changement de rôle ou de modules, et quand
// des nouveautés viennent d'être lues).
export function majNouveautesCompte(texte) {
  nonLues = texte || "";
  document.querySelectorAll('[data-nav-coquille] button[data-nav-action="compte"]').forEach((b) => {
    if (identites.has(b)) nommerCompte(b);
  });
}

// Bouton « Assistant » : `geste(bouton)` ouvre ou ferme le panneau de l'assistant (js/chatbot.js). Il suit
// le module « assistant » comme la bulle de l'ancienne navigation : absent chez un stagiaire quand le
// module est fermé pour la promo, repéré chez un formateur. Son nom ne dépend pas de son libellé, que la
// tablette et la colonne d'icônes masquent.
function boutonAssistant(classe, geste, ...contenu) {
  if (!moduleVisible("assistant")) return null;
  const bouton = el("button", {
    type: "button", class: classe, "data-nav-action": "assistant", title: "Assistant",
    "aria-controls": "chatbot-panel", "aria-expanded": assistantOuvert() ? "true" : "false",
  }, ...contenu);
  repereMasque(bouton, moduleMasque("assistant"));
  bouton.setAttribute("aria-label", bouton.getAttribute("title"));
  bouton.addEventListener("click", () => geste(bouton));
  return bouton;
}

// Les boutons « Assistant » disent si le panneau est ouvert, quel que soit le geste qui l'ouvre ou le ferme
// (bouton, croix, Échap, module fermé).
onAssistantChange((ouvert) => {
  document.querySelectorAll('[data-nav-coquille] [data-nav-action="assistant"]')
    .forEach((b) => b.setAttribute("aria-expanded", ouvert ? "true" : "false"));
});

// En-tête du stagiaire, barre latérale : le panneau s'ouvre ou se ferme ; fermé, il rend le focus à ce
// bouton, ou à son équivalent affiché si la coquille a changé entre-temps (js/nav-fenetre.js).
const basculerDepuis = (bouton) => basculerAssistant(() => rendreFocus(bouton, "assistant"));

// Depuis le tiroir « Plus » : le tiroir se ferme (le focus revient à « Plus ») et l'assistant s'ouvre, puis
// rend le focus à « Plus » en se fermant ; déjà ouvert derrière le tiroir, il le reste.
function assistantDepuisLeTiroir(plus) {
  fermerFenetre();
  if (!assistantOuvert()) basculerAssistant(() => rendreFocus(plus, "plus"));
}

// Bouton « Signaler un problème » (pied de barre de l'équipe, tiroir « Plus ») : `geste(bouton)` ouvre la
// fenêtre (js/signalement.js). Sa pastille et son nom suivent l'état des signalements : les nouveaux chez
// le fondateur hors aperçu, ceux de la personne qui ont avancé chez les autres.
function boutonSignaler(classe, geste, ...contenu) {
  const bouton = el("button", {
    type: "button", class: classe, "data-nav-action": "signaler", "aria-haspopup": "dialog",
  }, ...contenu);
  nommerSignaler(bouton);
  bouton.addEventListener("click", () => geste(bouton));
  return bouton;
}

function nommerSignaler(bouton) {
  const { texte, nom } = pastilleSignalement({ fondateur: fondateurHorsApercu(), ...etatSignalements() });
  bouton.setAttribute("aria-label", nom);
  bouton.setAttribute("title", nom);
  let pastille = bouton.querySelector(".nav-pastille");
  if (!texte) {
    if (pastille) pastille.remove();
    return;
  }
  if (!pastille) pastille = bouton.appendChild(el("span", { class: "nav-pastille", "aria-hidden": "true" }));
  pastille.textContent = texte;
}

onSignalementsChange(() => {
  document.querySelectorAll('[data-nav-coquille] [data-nav-action="signaler"]').forEach(nommerSignaler);
});

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

// Le logo mène à l'accueil ; le nom de la promo, à côté, est un texte et non une partie du lien (le
// nom du lien est sa destination).
function enTeteStagiaire(entrees, nom, initiales) {
  const promo = getPromoCourante()?.nom;
  const gauche = el("div", { class: "nav-gauche" },
    el("a", { href: "#/home", class: "nav-marque", title: "Accueil", "aria-label": "TP ECSR, accueil" },
      el("img", { class: "nav-logo", src: "assets/logo/tpecsr-logo.svg", alt: "TP ECSR" })),
    promo ? el("span", { class: "nav-marque-promo" }, promo) : null);
  const onglets = el("nav", { class: "nav-onglets", "aria-label": "Navigation principale" },
    entrees.map((e) => el("a", { href: "#/" + e.route, class: "nav-onglet", "data-entree": e.id },
      iconeDe(e.icone), libelle(e.libelle, "nav-onglet-texte"))));
  const assistant = boutonAssistant("nav-assistant", basculerDepuis,
    deco(icon.chat()), el("span", { class: "nav-assistant-texte" }, "Assistant"));
  const prenom = prenomDe(nom);
  const compte = boutonCompte("nav-compte", { nom }, avatar(initiales),
    prenom ? el("span", { class: "nav-compte-prenom" }, prenom) : null, deco(icon.chevronDown()));
  return el("header", { class: "nav-haut", "data-nav-coquille": "haut" },
    gauche, onglets, el("div", { class: "nav-droite" }, assistant, compte));
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
      boutonAssistant("nav-entree nav-cote-assistant", basculerDepuis,
        deco(icon.chat()), el("span", { class: "nav-entree-texte" }, "Assistant")),
      boutonSignaler("nav-entree nav-cote-signaler", (b) => ouvrirSignalement({ ancre: b }),
        deco(icon.signaler()), el("span", { class: "nav-entree-texte" }, "Signaler un problème")),
      boutonCompte("nav-cote-compte", { nom, role }, avatar(initiales),
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
// Rejoué à chaque montage et quand la fenêtre passe 700 ou 1 080 px ; rien à faire tant qu'aucune
// coquille n'est montée (interrupteur éteint).
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

// Le tiroir « Plus » n'existe que sur téléphone : il se ferme quand l'écran s'élargit (iPhone couché),
// et son focus va à un bouton affiché (js/nav-fenetre.js).
function surPassage700() {
  if (TABLETTE_OU_PLUS.matches && fenetreOuverte() === "plus") fermerFenetre();
  appliquerColonne();
}
TABLETTE_OU_PLUS.addEventListener("change", surPassage700);
ORDINATEUR.addEventListener("change", appliquerColonne);

// ----- Téléphone : barre du bas et tiroir « Plus » -----

function barreDuBas(barre, plus, equipe) {
  const cases = barre.map((e) => {
    const lien = el("a", { href: "#/" + e.route, class: "nav-case", "data-entree": e.id },
      el("span", { class: "nav-case-icone" }, iconeDe(e.icone)), libelle(e.court, "nav-case-texte"));
    return equipe ? reperer(lien, e) : lien;
  });
  if (plus.length) cases.push(boutonPlus());
  return el("nav", { class: "nav-bas", "data-nav-coquille": "bas", "aria-label": "Navigation principale" }, cases);
}

function boutonPlus() {
  const bouton = el("button", {
    type: "button", class: "nav-case nav-plus", "data-nav-action": "plus", "aria-haspopup": "dialog", "aria-expanded": "false",
  }, el("span", { class: "nav-case-icone" }, iconeDe("grid")), libelle("Plus", "nav-case-texte"));
  bouton.addEventListener("click", () => ouvrirPlus(bouton));
  return bouton;
}

function ouvrirPlus(bouton) {
  if (!montee) return;
  const { entrees, nom, initiales, actualiser, espace } = montee;
  const allumee = entreeActive(montee.route, entrees);
  const lien = (e) => reperer(el("a", {
    href: "#/" + e.route, class: "nav-fenetre-lien", "data-entree": e.id, "aria-current": e.id === allumee ? "page" : null,
  }, iconeDe(e.icone), el("span", { class: "nav-fenetre-texte" }, e.libelle)), e);
  const compte = el("button", {
    type: "button", class: "nav-fenetre-lien", "data-nav-action": "compte", "aria-haspopup": "dialog",
    title: nomDuBoutonCompte({ nom }),
  }, avatar(initiales), el("span", { class: "nav-fenetre-texte" }, "Mon compte"));
  // Le menu du compte prend la place du tiroir ; Échap rend alors le focus à « Plus ».
  compte.addEventListener("click", () => {
    fermerFenetre({ focus: false });
    ouvrirMenuCompte(bouton, { actualiser, entrees, espace });
  });
  ouvrirFenetre({
    nom: "plus", ancre: bouton, etiquette: "Plus", classe: "nav-tiroir",
    contenu: [
      el("p", { class: "nav-fenetre-section" }, "Tout l'espace formateur"),
      groupes(entrees.filter((e) => montee.plus.includes(e.id)), "plus", lien),
      el("p", { class: "nav-fenetre-section" }, "Outils"),
      boutonAssistant("nav-fenetre-lien", () => assistantDepuisLeTiroir(bouton),
        deco(icon.chat()), el("span", { class: "nav-fenetre-texte" }, "Assistant")),
      // La fenêtre de signalement remplace le tiroir ; le focus reviendra à « Plus ».
      boutonSignaler("nav-fenetre-lien", () => ouvrirSignalement({ ancre: bouton }),
        deco(icon.signaler()), el("span", { class: "nav-fenetre-texte" }, "Signaler un problème")),
      compte,
    ],
  });
}

// ----- Montage -----

// L'élément des barres de la coquille qui a le focus clavier, en sélecteur : remonter la coquille
// (modules ouverts ou fermés, rôle changé) le rend à l'élément équivalent au lieu de le perdre.
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

// Monte la coquille de l'espace dans #app : sa barre (en-tête du stagiaire ou barre latérale de
// l'équipe) en tête de #app, la barre du téléphone juste après (navigation avant le contenu, dans
// l'ordre du clavier). Remonter remplace la coquille en place. `actualiser` : le geste
// « Actualiser » de l'app, proposé par le menu du compte.
export function monterCoquille({ espace, entrees, nom, initiales, actualiser }) {
  const app = document.getElementById("app");
  if (!app) return;
  // Une fenêtre ouverte (menu du compte, tiroir) se ferme : ses lignes et son bouton sont ceux de la
  // coquille remplacée. Le focus qu'elle avait revient dans la nouvelle coquille, à la fin.
  const rendreFocusDeLaFenetre = fermerFenetre({ focus: false });
  const focus = focusDansLaCoquille();
  document.querySelectorAll("[data-nav-coquille]").forEach((r) => r.remove());
  const { barre, plus } = barreTelephone(espace, entrees);
  const equipe = espace === "equipe";
  // Avant header.topbar, toujours : à la fermeture du choix de la promo, js/promo-pastille.js rend le
  // focus à la PREMIÈRE .promo-pastille du document, et l'ancienne barre, masquée, en garde une dans
  // #admin-slot (updateBadge) ; celle de la barre de l'équipe doit donc venir avant elle.
  app.prepend(equipe ? barreLaterale(entrees, nom, initiales) : enTeteStagiaire(entrees, nom, initiales),
    barreDuBas(barre, plus, equipe));
  document.body.dataset.nav = "v2";
  document.body.dataset.espace = espace;
  montee = { espace, entrees: entrees.map((e) => ({ ...e })), plus: plus.map((e) => e.id), route: null, nom, initiales, actualiser };
  appliquerColonne();
  if (rendreFocusDeLaFenetre) rendreFocusDeLaFenetre();
  else if (focus) document.querySelector(focus)?.focus();
}

// Retire tout ce que la coquille pose : ses barres et sa fenêtre ouverte, ses attributs de body, son état.
// Seul appelant : le repli de js/main.js, quand le montage lève une exception (la coquille peut alors être
// à moitié posée) ; la session repasse à l'ancienne navigation. Sinon rien ne démonte la coquille (R8, R22).
export function retirerCoquille() {
  fermerFenetre({ focus: false });
  document.querySelectorAll("[data-nav-coquille]").forEach((r) => r.remove());
  delete document.body.dataset.nav;
  delete document.body.dataset.espace;
  delete document.body.dataset.navColonne;
  montee = null;
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

export function coquilleMontee() {
  return montee !== null;
}
