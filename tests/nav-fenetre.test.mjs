import test from "node:test";
import assert from "node:assert/strict";
import { ElementFactice, NoeudFactice, descendants, installerDocument } from "./aides-dom.mjs";
import { ouvrirFenetre, fermerFenetre, fenetreOuverte, demanderFermeture, ouvrirModale } from "../js/nav-fenetre.js";

// Lot 2A, tâche 6 : les fenêtres de la coquille (menu du compte, tiroir « Plus ») sur un DOM factice. Ce que la
// mécanique garantit sans navigateur : une adresse qui change ferme la fenêtre et rend le focus ; une fenêtre déjà sortie
// de la page est seulement oubliée, par l'adresse comme par le clavier, sans voler le focus. Le banc d'essai
// (outils/verifier_navigation.py) joue les mêmes gestes dans de vrais navigateurs.

// Un registre d'écouteurs, comme celui d'un document ou d'une fenêtre : le rappel d'un même type ne s'inscrit qu'une fois.
function registre() {
  const ecouteurs = new Map();
  return {
    addEventListener(type, rappel) { ecouteurs.set(type, [...(ecouteurs.get(type) || []).filter((f) => f !== rappel), rappel]); },
    removeEventListener(type, rappel) { ecouteurs.set(type, (ecouteurs.get(type) || []).filter((f) => f !== rappel)); },
    ecoutes: (type) => ecouteurs.get(type) || [],
    declencher(type, evenement = {}) { for (const f of [...(ecouteurs.get(type) || [])]) f({ type, ...evenement }); },
  };
}

// Ce que le DOM factice ne sait pas et que les fenêtres demandent : le focus, l'appartenance d'un nœud, son retrait, et
// d'être affiché (ici : dans le document).
const AJOUTS = {
  focus() { document.activeElement = this; },
  contains(noeud) { return descendants(this).includes(noeud); },
  remove() {
    if (!this.parentNode) return;
    this.parentNode.childNodes = this.parentNode.childNodes.filter((n) => n !== this);
    this.parentNode = null;
  },
  getClientRects() { return this.isConnected ? [{ width: 1, height: 1 }] : []; },
};

function avecFenetres(corps) {
  const dom = installerDocument();
  const avant = ["Node", "window"].map((nom) => [nom, Object.getOwnPropertyDescriptor(globalThis, nom)]);
  Object.assign(ElementFactice.prototype, AJOUTS);
  const document_ = Object.assign(dom.doc, registre(), { body: dom.conteneur(), activeElement: null, querySelectorAll: () => [] });
  const window_ = registre();
  Object.defineProperty(globalThis, "Node", { value: NoeudFactice, configurable: true, writable: true });
  Object.defineProperty(globalThis, "window", { value: window_, configurable: true, writable: true });
  try {
    return corps({ document: document_, window: window_ });
  } finally {
    fermerFenetre({ focus: false });
    for (const nom of Object.keys(AJOUTS)) delete ElementFactice.prototype[nom];
    for (const [nom, d] of avant) { if (d) Object.defineProperty(globalThis, nom, d); else delete globalThis[nom]; }
    dom.restaurer();
  }
}

// Un bouton du corps de la page, tel que le menu du compte ou « Plus » en ont un (`data-nav-action`).
function bouton(document, action) {
  const b = document.createElement("button");
  b.dataset.navAction = action;
  document.body.appendChild(b);
  return b;
}

const ouvrir = (ancre) => ouvrirFenetre({ nom: "compte", ancre, etiquette: "Mon compte", classe: "nav-menu-compte", contenu: [] });

test("une adresse qui change ferme la fenêtre et rend le focus au bouton qui l'a ouverte", () => avecFenetres(({ document, window }) => {
  const ancre = bouton(document, "compte");
  ouvrir(ancre);
  assert.equal(fenetreOuverte(), "compte");
  assert.equal(ancre.getAttribute("aria-expanded"), "true");
  assert.equal(window.ecoutes("hashchange").length, 1);
  window.declencher("hashchange");
  assert.equal(fenetreOuverte(), null);
  assert.equal(ancre.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, ancre, "le focus revient au bouton");
  assert.equal(window.ecoutes("hashchange").length, 0, "plus d'écouteur d'adresse");
  assert.equal(document.ecoutes("keydown").length, 0, "plus d'écouteur de clavier");
}));

test("une adresse qui change sous une fenêtre déjà sortie de la page : elle est oubliée, le focus reste où il est", () => avecFenetres(({ document, window }) => {
  const ancre = bouton(document, "compte");
  const ailleurs = bouton(document, "plus");
  ouvrir(ancre);
  // La fenêtre quitte la page sans passer par fermerFenetre (un rendu qui vide le corps, par exemple).
  document.body.childNodes.at(-1).remove();
  ailleurs.focus();
  window.declencher("hashchange");
  assert.equal(fenetreOuverte(), null, "la fenêtre est oubliée");
  assert.equal(document.activeElement, ailleurs, "le focus n'est pas ramené au bouton qui l'avait ouverte");
  assert.equal(window.ecoutes("hashchange").length, 0, "plus d'écouteur d'adresse");
  assert.equal(document.ecoutes("keydown").length, 0, "plus d'écouteur de clavier");
}));

test("le clavier fait de même : une touche pressée sous une fenêtre déjà sortie de la page l'oublie sans voler le focus", () => avecFenetres(({ document, window }) => {
  const ancre = bouton(document, "compte");
  const ailleurs = bouton(document, "plus");
  ouvrir(ancre);
  document.body.childNodes.at(-1).remove();
  ailleurs.focus();
  document.declencher("keydown", { key: "Tab", shiftKey: false, preventDefault() {}, stopPropagation() {} });
  assert.equal(fenetreOuverte(), null);
  assert.equal(document.activeElement, ailleurs);
  assert.equal(window.ecoutes("hashchange").length, 0);
}));

test("Échap ferme la fenêtre dans la page et rend le focus au bouton", () => avecFenetres(({ document }) => {
  const ancre = bouton(document, "compte");
  ouvrir(ancre);
  let arrete = false;
  document.declencher("keydown", { key: "Escape", preventDefault() {}, stopPropagation() { arrete = true; } });
  assert.equal(arrete, true, "Échap s'arrête là : le planning derrière ne le voit pas");
  assert.equal(fenetreOuverte(), null);
  assert.equal(document.activeElement, ancre);
}));

// Questionnaires (tâche 8, mineur de la tâche 5) : une fenêtre ouverte par un lien n'a pas de bouton d'ouverture, et
// l'ancienne barre n'a pas de bouton du compte où retomber. Le point de retour de la fenêtre prend alors le focus.
const ouvrirSansAncre = (retour, ancre = null) => ouvrirFenetre({
  nom: "questionnaire", ancre, etiquette: "Ton avis", classe: "questionnaire-fenetre", contenu: [], retour });

test("sans bouton d'ouverture, Échap rend le focus au point de retour (fonction lue à la fermeture)", () => avecFenetres(({ document }) => {
  let point = null;
  ouvrirSansAncre(() => point);
  point = bouton(document, "repondre");
  document.declencher("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(fenetreOuverte(), null);
  assert.equal(document.activeElement, point, "le point de retour lu au moment de la fermeture");
}));

test("bouton d'ouverture disparu (bandeau redessiné) : le focus va au point de retour", () => avecFenetres(({ document }) => {
  const ancre = bouton(document, "repondre");
  const point = bouton(document, "titre");
  ouvrirSansAncre(point, ancre);
  ancre.remove();
  fermerFenetre();
  assert.equal(document.activeElement, point);
}));

test("bouton d'ouverture encore affiché : il passe avant le point de retour", () => avecFenetres(({ document }) => {
  const ancre = bouton(document, "repondre");
  const point = bouton(document, "titre");
  ouvrirSansAncre(point, ancre);
  fermerFenetre();
  assert.equal(document.activeElement, ancre);
}));

test("point de retour absent, hors de la page ou en erreur : rien ne casse, le focus n'est pas volé", () => avecFenetres(({ document }) => {
  const ailleurs = bouton(document, "plus");
  for (const retour of [null, () => null, () => { throw new Error("x"); }, () => { const b = document.createElement("button"); return b; }]) {
    ouvrirSansAncre(retour);
    ailleurs.focus();
    assert.doesNotThrow(() => fermerFenetre());
    assert.equal(fenetreOuverte(), null);
    assert.equal(document.activeElement, ailleurs);
  }
}));

// Registre qualité (Q4, tâche 4) : une fenêtre de saisie peut refuser une fermeture demandée par un geste (« Fermer » du
// haut, voile, Échap, demanderFermeture) tant que sa saisie n'est pas enregistrée. L'adresse qui change et la fermeture par
// le programme ne la consultent pas (limite écrite dans PROJECT_NOTES.md).
const ouvrirAvecGarde = (ancre, garde) => ouvrirFenetre({
  nom: "registre", ancre, etiquette: "Entrée du registre", classe: "registre-fenetre", contenu: [], avantFermeture: garde });
const echap = (document) => document.declencher("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
const calqueDe = (document) => document.body.childNodes.at(-1);
const boutonFermerDuHaut = (calque) => calque.childNodes[0].childNodes[0].childNodes[0];

test("avantFermeture : Échap, le voile et « Fermer » la consultent ; false garde la fenêtre, true la ferme", () => avecFenetres(({ document }) => {
  const ancre = bouton(document, "registre");
  let reponse = false;
  let appels = 0;
  ouvrirAvecGarde(ancre, () => { appels += 1; return reponse; });
  echap(document);
  assert.equal(fenetreOuverte(), "registre", "Échap : gardée");
  const calque = calqueDe(document);
  calque.declencher("click");
  assert.equal(fenetreOuverte(), "registre", "voile : gardée");
  const fermer = boutonFermerDuHaut(calque);
  assert.equal(fermer.textContent, "Fermer");
  fermer.click();
  assert.equal(fenetreOuverte(), "registre", "« Fermer » du haut : gardée");
  demanderFermeture();
  assert.equal(fenetreOuverte(), "registre", "demanderFermeture : gardée");
  assert.equal(appels, 4);
  reponse = true;
  echap(document);
  assert.equal(fenetreOuverte(), null, "true : fermée");
  assert.equal(document.activeElement, ancre, "le focus revient au bouton");
}));

test("avantFermeture : l'adresse qui change et fermerFenetre() ne la consultent pas ; une erreur ne bloque pas", () => avecFenetres(({ document, window }) => {
  const ancre = bouton(document, "registre");
  let appels = 0;
  ouvrirAvecGarde(ancre, () => { appels += 1; return false; });
  window.declencher("hashchange");
  assert.equal(fenetreOuverte(), null, "adresse changée : fermée sans demander");
  ouvrirAvecGarde(ancre, () => { appels += 1; return false; });
  fermerFenetre();
  assert.equal(fenetreOuverte(), null, "fermeture par le programme : sans demander");
  assert.equal(appels, 0);
  const erreur = console.error;
  console.error = () => {};
  try {
    ouvrirAvecGarde(ancre, () => { throw new Error("x"); });
    echap(document);
  } finally {
    console.error = erreur;
  }
  assert.equal(fenetreOuverte(), null, "une erreur de la garde ferme la fenêtre");
}));

test("sans avantFermeture, rien ne change : Échap et le voile ferment", () => avecFenetres(({ document }) => {
  const ancre = bouton(document, "compte");
  ouvrir(ancre);
  calqueDe(document).declencher("click");
  assert.equal(fenetreOuverte(), null);
  ouvrir(ancre);
  echap(document);
  assert.equal(fenetreOuverte(), null);
}));

// =====================================================================================================================
// Fenêtres des écrans (ouvrirModale, ménage du 11/11/2026) : ce que chaque écran refaisait à sa façon, une seule fois.
// =====================================================================================================================

// Le document voit les voiles posés dans le corps de la page, comme querySelectorAll(".modal-backdrop, ...") du navigateur.
function avecModales(corps) {
  return avecFenetres((env) => {
    env.document.querySelectorAll = (sel) => (sel.includes("modal-backdrop")
      ? env.document.body.childNodes.filter((n) => n.classes?.has("modal-backdrop")) : []);
    return corps(env);
  });
}
// Une fenêtre d'écran : un .modal et ses boutons, ceux que Tab parcourt.
function fenetreEcran(document, ...noms) {
  const f = document.createElement("div");
  f.classList.add("modal");
  const boutons = noms.map((n) => { const b = document.createElement("button"); b.textContent = n; f.appendChild(b); return b; });
  f.querySelectorAll = () => boutons.filter((b) => b.isConnected);
  return { f, boutons };
}
const touche = (key, plus = {}) => ({ key, shiftKey: false, defaultPrevented: false, arrete: false,
  preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.arrete = true; }, ...plus });
// Échap tapé dans la fenêtre : il remonte jusqu'à son voile.
const echapDans = (fond, plus = {}) => {
  const e = touche("Escape", { target: fond, ...plus });
  for (const f of fond.ecouteurs.get("keydown") || []) f(e);
  return e;
};
const voiles = (document) => document.body.childNodes.filter((n) => n.classes?.has("modal-backdrop"));

test("ouvrirModale : voile, rôle et nom, focus dans la fenêtre puis rendu ; Échap ferme une fois", () => avecModales(({ document }) => {
  const ouvreur = bouton(document, "ouvrir");
  ouvreur.focus();
  const { f } = fenetreEcran(document, "Annuler", "Enregistrer");
  let apres = 0;
  const m = ouvrirModale(f, { etiquette: "Ajouter un passage", classeFond: "qcm-form-backdrop", apresFermeture: () => { apres += 1; } });
  assert.equal(m.fond.className, "modal-backdrop qcm-form-backdrop");
  assert.equal(m.fond.parentNode, document.body);
  assert.equal(f.getAttribute("role"), "dialog");
  assert.equal(f.getAttribute("aria-modal"), "true");
  assert.equal(f.getAttribute("aria-label"), "Ajouter un passage");
  assert.equal(f.getAttribute("tabindex"), "-1");
  assert.equal(document.activeElement, f, "le focus va à la fenêtre, pas à un champ (pas de clavier imposé au téléphone)");
  assert.equal(document.ecoutes("keydown").length, 1, "un écouteur de clavier pendant l'ouverture");
  const e = echapDans(m.fond);
  assert.equal(e.arrete, true, "Échap s'arrête là : le planning derrière ne le voit pas");
  assert.equal(voiles(document).length, 0);
  assert.equal(document.activeElement, ouvreur, "le focus revient où il était");
  assert.equal(document.ecoutes("keydown").length, 0, "plus d'écouteur de clavier");
  m.fermer();
  assert.equal(apres, 1, "apresFermeture une seule fois");
}));

test("ouvrirModale : un champ qui se sert d'Échap (preventDefault) garde la fenêtre ouverte", () => avecModales(({ document }) => {
  const m = ouvrirModale(fenetreEcran(document, "OK").f);
  echapDans(m.fond, { defaultPrevented: true });
  assert.equal(voiles(document).length, 1);
  m.fermer();
  assert.equal(voiles(document).length, 0);
}));

test("ouvrirModale : avantFermeture garde la fenêtre (Échap, voile, Annuler) ; fermer() ne la consulte pas", () => avecModales(({ document }) => {
  let envoi = true;
  const m = ouvrirModale(fenetreEcran(document, "OK").f, { avantFermeture: () => !envoi });
  echapDans(m.fond);
  m.fond.declencher("click");
  m.demanderFermeture();
  assert.equal(voiles(document).length, 1, "envoi en cours : gardée");
  envoi = false;
  m.demanderFermeture();
  assert.equal(voiles(document).length, 0, "envoi fini : fermée");
  const m2 = ouvrirModale(fenetreEcran(document, "OK").f, { avantFermeture: () => false });
  m2.fermer();
  assert.equal(voiles(document).length, 0, "fermer() après un enregistrement");
}));

test("ouvrirModale : fermerAuVoile false ignore le toucher à côté ; un toucher dans la fenêtre ne ferme jamais", () => avecModales(({ document }) => {
  const m = ouvrirModale(fenetreEcran(document, "OK").f, { fermerAuVoile: false });
  m.fond.declencher("click");
  assert.equal(voiles(document).length, 1);
  m.fermer();
  const m2 = ouvrirModale(fenetreEcran(document, "OK").f);
  for (const r of m2.fond.ecouteurs.get("click")) r({ type: "click", target: m2.fenetre });
  assert.equal(voiles(document).length, 1, "clic dans la fenêtre");
  m2.fond.declencher("click");
  assert.equal(voiles(document).length, 0, "clic sur le voile");
}));

test("ouvrirModale : Tab et Maj+Tab tournent dans la fenêtre du dessus, focus et retour sur demande", () => avecModales(({ document }) => {
  const point = bouton(document, "pastille");
  const { f, boutons: [a, b, c] } = fenetreEcran(document, "A", "B", "C");
  const m = ouvrirModale(f, { focus: () => b, retour: () => point });
  assert.equal(document.activeElement, b, "focus demandé");
  document.declencher("keydown", touche("Tab", { target: b }));
  assert.equal(document.activeElement, c);
  document.declencher("keydown", touche("Tab", { target: c }));
  assert.equal(document.activeElement, a, "après le dernier, le premier");
  document.declencher("keydown", touche("Tab", { target: a, shiftKey: true }));
  assert.equal(document.activeElement, c, "Maj+Tab du premier : le dernier");
  m.fermer();
  assert.equal(document.activeElement, point, "le point de retour plutôt que l'ouvreur");
}));

test("ouvrirModale : deux fenêtres empilées, seule celle du dessus répond ; Échap tapé hors fenêtre ferme celle du dessus", () => avecModales(({ document }) => {
  const dessous = ouvrirModale(fenetreEcran(document, "Choisir à la main").f);
  const { f, boutons: [x] } = fenetreEcran(document, "Valider");
  const dessus = ouvrirModale(f);
  echapDans(dessous.fond);
  assert.equal(voiles(document).length, 2, "la fenêtre du dessous ne se ferme pas par-dessous");
  document.declencher("keydown", touche("Tab", { target: x }));
  assert.equal(document.activeElement, x, "Tab reste dans celle du dessus");
  let arrete = false;
  document.declencher("keydown", touche("Escape", { target: document.body, stopPropagation() { arrete = true; } }));
  assert.equal(arrete, true, "Échap s'arrête là");
  assert.deepEqual(voiles(document), [dessous.fond], "celle du dessus fermée, l'autre reste");
  assert.equal(document.ecoutes("keydown").length, 1);
  dessus.fermer();
  dessous.fermer();
  assert.equal(document.ecoutes("keydown").length, 0);
}));

test("ouvrirModale : une fenêtre de navigation posée par-dessus garde le clavier ; une fenêtre retirée par son écran est oubliée", () => avecModales(({ document }) => {
  const m = ouvrirModale(fenetreEcran(document, "OK").f);
  const ancre = bouton(document, "compte");
  ouvrir(ancre);
  document.declencher("keydown", touche("Escape", { target: document.body }));
  assert.equal(fenetreOuverte(), null, "Échap ferme le menu du compte, au-dessus");
  assert.equal(voiles(document).length, 1, "la fenêtre d'écran reste dessous");
  m.fond.remove();   // ancienne manière : l'écran retire son voile lui-même
  document.declencher("keydown", touche("Tab", { target: document.body }));
  assert.equal(document.ecoutes("keydown").length, 0, "oubliée à la touche suivante");
}));

test("une seule fabrique de fenêtres : aucun écran ne bâtit plus son voile .modal-backdrop lui-même", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const racine = new URL("../js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const fichiers = [];
  const parcourir = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (nom.endsWith(".js")) fichiers.push(chemin);
    }
  };
  parcourir(racine);
  const fabriques = fichiers.filter((f) => /class:\s*\(?["'`]modal-backdrop/.test(readFileSync(f, "utf8")))
    .map((f) => f.split("\\").join("/").replace(/^.*\/js\//, "js/")).sort();
  assert.deepEqual(fabriques, ["js/confirmer.js", "js/nav-fenetre.js"]);
});
