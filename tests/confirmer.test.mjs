import test from "node:test";
import assert from "node:assert/strict";
import { ElementFactice, NoeudFactice, descendants, installerDocument } from "./aides-dom.mjs";
import { readFileSync } from "node:fs";
import { confirmer } from "../js/confirmer.js";

// Finitions du lot C : la confirmation d'un geste qui efface (une note) se fait dans une fenêtre de l'app, plus par la
// boîte du navigateur (confirm()), que le robot et le vérificateur comptent comme un défaut. Ce que la fenêtre garantit,
// sur un DOM factice : oui ou non selon le bouton, Échap et un toucher à côté valent « non », rien ne reste derrière
// (ni la fenêtre, ni l'écoute du clavier), et le focus revient où il était. Le robot (parcours « saisir-une-note ») joue
// le même geste dans de vrais navigateurs. Le clavier s'écoute sur la fenêtre du navigateur (window), en capture : la
// fenêtre de l'app reçoit Échap et Tab avant tout le reste (l'assistant écoute Échap sur le document).

function registre() {
  const ecouteurs = new Map();
  const captures = new Set();
  return {
    addEventListener(type, rappel, options) {
      ecouteurs.set(type, [...(ecouteurs.get(type) || []).filter((f) => f !== rappel), rappel]);
      if (options === true || options?.capture) captures.add(rappel);
    },
    removeEventListener(type, rappel) { ecouteurs.set(type, (ecouteurs.get(type) || []).filter((f) => f !== rappel)); },
    ecoutes: (type) => ecouteurs.get(type) || [],
    enCapture: (rappel) => captures.has(rappel),
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
  const avant = ["Node", "window"].map((nom) => [nom, Object.getOwnPropertyDescriptor(globalThis, nom)]);
  Object.assign(ElementFactice.prototype, AJOUTS);
  const document_ = Object.assign(dom.doc, registre(), { body: dom.conteneur(), activeElement: null });
  Object.defineProperty(globalThis, "Node", { value: NoeudFactice, configurable: true, writable: true });
  Object.defineProperty(globalThis, "window", { value: registre(), configurable: true, writable: true });
  const fin = () => {
    for (const nom of Object.keys(AJOUTS)) delete ElementFactice.prototype[nom];
    for (const [nom, d] of avant) { if (d) Object.defineProperty(globalThis, nom, d); else delete globalThis[nom]; }
    dom.restaurer();
  };
  return Promise.resolve().then(() => corps(document_)).finally(fin);
}

// La fenêtre s'ouvre au tour suivant (après le geste qui l'a demandée).
const tour = () => new Promise((r) => setTimeout(r, 0));
const clavier = () => globalThis.window.ecoutes("keydown");
const touche = (key, extra = {}) => {
  const e = { key, shiftKey: false, arrete: false, empeche: false,
    stopPropagation() { this.arrete = true; }, preventDefault() { this.empeche = true; }, ...extra };
  for (const f of clavier()) f(e);
  return e;
};
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
  assert.equal(clavier().length, 1, "Échap est écouté");
  assert.ok(globalThis.window.enCapture(clavier()[0]), "sur la fenêtre du navigateur, en capture : avant l'assistant et la page");
  assert.equal(document.ecoutes("keydown").length, 0, "rien sur le document");
  bouton(document, "Effacer la note").click();
  assert.equal(await reponse, true);
  assert.equal(fenetre(document), null, "la fenêtre est partie");
  assert.equal(clavier().length, 0, "plus d'écoute du clavier");
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
  const e = touche("Escape");
  assert.equal(await reponse, false);
  assert.ok(e.arrete, "Échap s'arrête à la fenêtre (ni l'écran « Saisir » ni l'assistant ne le reçoivent)");
  assert.equal(fenetre(document), null);
  assert.equal(clavier().length, 0);
}));

test("une lettre ne ferme rien", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Effacer cette note ?", oui: "Effacer la note" });
  await tour();
  touche("a");
  assert.ok(fenetre(document), "la fenêtre reste");
  bouton(document, "Annuler").click();
  assert.equal(await reponse, false);
}));

test("Tab et Maj+Tab restent dans la fenêtre : on passe d'un bouton à l'autre", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Effacer cette note ?", oui: "Effacer la note" });
  await tour();
  const oui = bouton(document, "Effacer la note"), non = bouton(document, "Annuler");
  assert.equal(document.activeElement, oui);
  let e = touche("Tab");
  assert.equal(document.activeElement, non, "après le dernier bouton, le premier");
  assert.ok(e.empeche, "le navigateur ne sort pas de la fenêtre");
  e = touche("Tab", { shiftKey: true });
  assert.equal(document.activeElement, oui, "Maj+Tab sur le premier : le dernier");
  assert.ok(e.empeche);
  document.activeElement = null;   // le focus est sorti de la fenêtre (un clic ailleurs)
  touche("Tab");
  assert.equal(document.activeElement, non, "Tab ramène dans la fenêtre");
  non.click();
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

// Geste irréversible de la conservation des données (page Qualiopi, lot Q5) : les listes de ce qui part et de ce qui reste,
// un champ où taper le mot ou le prénom demandé, et un bouton qui n'agit qu'une fois la saisie juste.
const champ = (document) => descendants(fenetre(document)).find((n) => n.nodeName === "input") || null;
const taper = (c, valeur) => { c.value = valeur; c.declencher("input"); };
const entree = (c) => {
  const e = { key: "Enter", empeche: false, preventDefault() { this.empeche = true; } };
  for (const f of c.ecouteurs.get("keydown") || []) f(e);
  return e;
};
const detaillee = () => ({
  titre: "Effacer les données de Hélène Durand ?", phrase: "Irréversible.",
  part: ["le dossier professionnel", "le livret EPCF"], reste: ["ses résultats, sans nom"],
  saisie: { consigne: "Pour confirmer, tape son prénom : Hélène", attendu: "Hélène" }, oui: "Effacer ses données",
});

test("saisie : les listes et la consigne sont dans la fenêtre, le focus va au champ, le geste attend la bonne saisie", () => avecDocument(async (document) => {
  const reponse = confirmer(detaillee());
  await tour();
  const f = fenetre(document);
  const textes = descendants(f).map((n) => n.textContent);
  for (const attendu of ["Ce qui est effacé", "le dossier professionnel", "le livret EPCF", "Ce qui reste", "ses résultats, sans nom", "Pour confirmer, tape son prénom : Hélène"]) {
    assert.ok(textes.includes(attendu), "la fenêtre dit : " + attendu);
  }
  const c = champ(document);
  assert.ok(c, "un champ de saisie");
  const etiquette = descendants(f).find((n) => n.nodeName === "label");
  assert.equal(etiquette.getAttribute("for"), c.getAttribute("id"), "la consigne nomme le champ");
  assert.equal(document.activeElement, c, "le focus va au champ");
  const oui = bouton(document, "Effacer ses données");
  assert.equal(oui.disabled, true, "le geste attend la saisie");
  oui.click();
  assert.ok(fenetre(document), "un clic sans saisie ne fait rien");
  taper(c, "Helene");
  assert.equal(oui.disabled, true, "sans les accents : toujours non");
  entree(c);
  assert.ok(fenetre(document), "Entrée avec une mauvaise saisie ne fait rien");
  taper(c, "  hélène ");
  assert.equal(oui.disabled, false, "casse et espaces ignorés : le geste est permis");
  const e = entree(c);
  assert.ok(e.empeche, "Entrée ne soumet rien d'autre");
  assert.equal(await reponse, true, "Entrée dans le champ vaut le geste");
  assert.equal(fenetre(document), null);
  assert.equal(clavier().length, 0);
}));

test("saisie : Tab fait le tour du champ et des boutons, le geste seulement quand il est permis ; Annuler répond non", () => avecDocument(async (document) => {
  const reponse = confirmer(detaillee());
  await tour();
  const c = champ(document), non = bouton(document, "Annuler"), oui = bouton(document, "Effacer ses données");
  touche("Tab");
  assert.equal(document.activeElement, non, "du champ à « Annuler »");
  touche("Tab");
  assert.equal(document.activeElement, c, "le geste encore interdit est sauté : retour au champ");
  taper(c, "Hélène");
  touche("Tab"); touche("Tab");
  assert.equal(document.activeElement, oui, "permis, le geste entre dans le tour");
  touche("Tab", { shiftKey: true });
  assert.equal(document.activeElement, non, "Maj+Tab recule");
  non.click();
  assert.equal(await reponse, false);
}));

test("la page Notes n'ouvre plus aucune boîte du navigateur (effacer une note, partout)", () => {
  for (const fichier of ["js/views/notes.js", "js/views/notes-saisie.js"]) {
    const src = readFileSync(new URL("../" + fichier, import.meta.url), "utf8")
      .replace(/\/\/.*$/gm, "");   // les commentaires peuvent parler de confirm()
    assert.doesNotMatch(src, /(^|[^\w.])confirm\s*\(|window\.confirm\s*\(/, fichier + " : un confirm() du navigateur");
  }
});
