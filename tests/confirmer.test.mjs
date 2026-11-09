import test from "node:test";
import assert from "node:assert/strict";
import { ElementFactice, NoeudFactice, descendants, installerDocument } from "./aides-dom.mjs";
import { readFileSync } from "node:fs";
import { confirmer } from "../js/confirmer.js";

// Finitions du lot C : la confirmation d'un geste qui efface (une note) se fait dans une fenêtre de l'app, plus par la
// boîte du navigateur (confirm()), que le robot et le vérificateur comptent comme un défaut. Ce que la fenêtre garantit,
// sur un DOM factice : oui ou non selon le bouton, Échap et un toucher à côté valent « non », rien ne reste derrière
// (ni la fenêtre, ni l'écoute du clavier), et le focus revient où il était. Le robot (parcours « saisir-une-note ») joue
// le même geste dans de vrais navigateurs.

function registre() {
  const ecouteurs = new Map();
  return {
    addEventListener(type, rappel) { ecouteurs.set(type, [...(ecouteurs.get(type) || []).filter((f) => f !== rappel), rappel]); },
    removeEventListener(type, rappel) { ecouteurs.set(type, (ecouteurs.get(type) || []).filter((f) => f !== rappel)); },
    ecoutes: (type) => ecouteurs.get(type) || [],
  };
}

const AJOUTS = {
  focus() { document.activeElement = this; },
  contains(noeud) { return descendants(this).includes(noeud); },
  remove() {
    if (!this.parentNode) return;
    this.parentNode.childNodes = this.parentNode.childNodes.filter((n) => n !== this);
    this.parentNode = null;
  },
};

function avecDocument(corps) {
  const dom = installerDocument();
  const avant = Object.getOwnPropertyDescriptor(globalThis, "Node");
  Object.assign(ElementFactice.prototype, AJOUTS);
  const document_ = Object.assign(dom.doc, registre(), { body: dom.conteneur(), activeElement: null });
  Object.defineProperty(globalThis, "Node", { value: NoeudFactice, configurable: true, writable: true });
  const fin = () => {
    for (const nom of Object.keys(AJOUTS)) delete ElementFactice.prototype[nom];
    if (avant) Object.defineProperty(globalThis, "Node", avant); else delete globalThis.Node;
    dom.restaurer();
  };
  return Promise.resolve().then(() => corps(document_)).finally(fin);
}

// La fenêtre s'ouvre au tour suivant (après le geste qui l'a demandée).
const tour = () => new Promise((r) => setTimeout(r, 0));
const fenetre = (document) => document.body.childNodes.find((n) => n.classes?.has("modal-backdrop")) || null;
const boutons = (document) => descendants(fenetre(document)).filter((n) => n.nodeName === "button");
const bouton = (document, texte) => boutons(document).find((b) => b.textContent === texte);

test("« Effacer la note » répond oui, ferme la fenêtre et rend le focus au champ d'avant", () => avecDocument(async (document) => {
  const champ = document.createElement("input");
  document.body.appendChild(champ);
  champ.focus();
  const reponse = confirmer({ titre: "Effacer la note de Léa Martin ?", phrase: "Sa note de 14/20 disparaît.", oui: "Effacer la note" });
  assert.equal(fenetre(document), null, "rien tant que le geste en cours n'est pas fini");
  await tour();
  const f = fenetre(document);
  assert.ok(f, "une fenêtre de l'app s'ouvre");
  const dialogue = descendants(f).find((n) => n.getAttribute?.("role") === "dialog");
  assert.equal(dialogue.getAttribute("aria-modal"), "true");
  const titre = descendants(f).find((n) => n.nodeName === "h3");
  assert.equal(titre.textContent, "Effacer la note de Léa Martin ?");
  assert.equal(dialogue.getAttribute("aria-labelledby"), titre.getAttribute("id"), "le titre nomme la fenêtre");
  assert.ok(descendants(f).some((n) => n.textContent === "Sa note de 14/20 disparaît."));
  assert.deepEqual(boutons(document).map((b) => b.textContent), ["Annuler", "Effacer la note"]);
  assert.equal(document.activeElement, bouton(document, "Effacer la note"), "le focus va au bouton du geste");
  assert.equal(document.ecoutes("keydown").length, 1, "Échap est écouté");
  bouton(document, "Effacer la note").click();
  assert.equal(await reponse, true);
  assert.equal(fenetre(document), null, "la fenêtre est partie");
  assert.equal(document.ecoutes("keydown").length, 0, "plus d'écoute du clavier");
  assert.equal(document.activeElement, champ, "le focus revient au champ");
}));

test("« Annuler » répond non", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Effacer cette note ?", oui: "Effacer la note" });
  await tour();
  bouton(document, "Annuler").click();
  assert.equal(await reponse, false);
  assert.equal(fenetre(document), null);
}));

test("Échap répond non, sans que la page en dessous le reçoive", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Effacer cette note ?", oui: "Effacer la note" });
  await tour();
  let arrete = false;
  for (const f of document.ecoutes("keydown")) f({ key: "Escape", stopPropagation() { arrete = true; } });
  assert.equal(await reponse, false);
  assert.ok(arrete, "Échap s'arrête à la fenêtre (l'écran « Saisir » ne revient pas à la liste)");
  assert.equal(fenetre(document), null);
  assert.equal(document.ecoutes("keydown").length, 0);
}));

test("une autre touche ne ferme rien", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Effacer cette note ?", oui: "Effacer la note" });
  await tour();
  for (const f of document.ecoutes("keydown")) f({ key: "Tab", stopPropagation() {} });
  assert.ok(fenetre(document), "la fenêtre reste");
  bouton(document, "Annuler").click();
  assert.equal(await reponse, false);
}));

test("toucher à côté de la fenêtre répond non ; toucher dedans ne ferme rien", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Effacer cette note ?", oui: "Effacer la note" });
  await tour();
  const f = fenetre(document);
  const dedans = descendants(f).find((n) => n.nodeName === "h3");
  for (const rappel of f.ecouteurs.get("click") || []) rappel({ type: "click", target: dedans });
  assert.ok(fenetre(document), "un toucher sur le titre ne ferme pas");
  for (const rappel of f.ecouteurs.get("click") || []) rappel({ type: "click", target: f });
  assert.equal(await reponse, false);
  assert.equal(fenetre(document), null);
}));

test("le focus ne revient pas à un champ qui a quitté la page (« Retour » pendant la question)", () => avecDocument(async (document) => {
  const champ = document.createElement("input");
  document.body.appendChild(champ);
  champ.focus();
  const reponse = confirmer({ titre: "Effacer cette note ?", oui: "Effacer la note" });
  await tour();
  champ.remove();
  const oui = bouton(document, "Effacer la note");
  oui.click();
  assert.equal(await reponse, true);
  assert.equal(document.activeElement, oui, "le focus n'est pas rendu à un champ sorti de la page");
}));

test("la page Notes n'ouvre plus aucune boîte du navigateur (effacer une note, partout)", () => {
  for (const fichier of ["js/views/notes.js", "js/views/notes-saisie.js"]) {
    const src = readFileSync(new URL("../" + fichier, import.meta.url), "utf8")
      .replace(/\/\/.*$/gm, "");   // les commentaires peuvent parler de confirm()
    assert.doesNotMatch(src, /(^|[^\w.])confirm\s*\(|window\.confirm\s*\(/, fichier + " : un confirm() du navigateur");
  }
});
