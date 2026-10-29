import test from "node:test";
import assert from "node:assert/strict";
import { ElementFactice, NoeudFactice, descendants, installerDocument } from "./aides-dom.mjs";
import { ouvrirFenetre, fermerFenetre, fenetreOuverte } from "../js/nav-fenetre.js";

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
