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

test("un geste qui n'efface rien : bouton vert (primary) ; la fenêtre passe au-dessus de l'écran d'examen", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Terminer l'examen ?", oui: "Terminer", non: "Continuer l'examen", danger: false });
  await tour();
  const f = fenetre(document);
  assert.ok(f.classes.has("confirmer-fond"), "le fond porte sa classe (plan au-dessus de l'examen, css/style.css)");
  assert.ok(bouton(document, "Terminer").classes.has("primary"));
  assert.ok(!bouton(document, "Terminer").classes.has("danger"));
  assert.deepEqual(boutons(document).map((b) => b.textContent), ["Continuer l'examen", "Terminer"]);
  bouton(document, "Terminer").click();
  assert.equal(await reponse, true);
}));

test("par défaut le bouton du geste est rouge (danger)", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Supprimer ce passage ?", oui: "Supprimer" });
  await tour();
  assert.ok(bouton(document, "Supprimer").classes.has("danger"));
  bouton(document, "Annuler").click();
  assert.equal(await reponse, false);
}));

test("un signal d'abandon referme la fenêtre (fin du temps d'un examen) : réponse non", () => avecDocument(async (document) => {
  const arret = new AbortController();
  const reponse = confirmer({ titre: "Terminer l'examen ?", oui: "Terminer", danger: false, signal: arret.signal });
  await tour();
  assert.ok(fenetre(document));
  arret.abort();
  assert.equal(await reponse, false);
  assert.equal(fenetre(document), null, "la fenêtre est partie");
  assert.equal(clavier().length, 0, "plus d'écoute du clavier");
}));

test("un signal déjà abandonné : rien ne s'ouvre, réponse non", () => avecDocument(async (document) => {
  const arret = new AbortController();
  arret.abort();
  const reponse = confirmer({ titre: "Terminer l'examen ?", oui: "Terminer", signal: arret.signal });
  assert.equal(await reponse, false);
  assert.equal(fenetre(document), null);
}));

// Les fichiers déjà passés à la fenêtre de l'app : Notes (finitions du lot C), puis le lot A du 09/11 (tout fichier
// qu'aucun autre chantier ne touchait). Le lot B (réglages, émargement, Cours et QCM, EPCF, garde de sortie) suivra.
const SANS_BOITE_NATIVE = ["js/views/notes.js", "js/views/notes-saisie.js",
  "js/views/benevoles.js", "js/views/calendrier.js", "js/views/modules-reglage.js", "js/views/passages.js",
  "js/views/planning.js", "js/views/problemes.js", "js/views/qcm.js", "js/views/ressources.js"];

test("ces pages n'ouvrent plus aucune confirmation du navigateur", () => {
  for (const fichier of SANS_BOITE_NATIVE) {
    const src = readFileSync(new URL("../" + fichier, import.meta.url), "utf8")
      .replace(/\/\/.*$/gm, "");   // les commentaires peuvent parler de confirm()
    assert.ok(!/(^|[^\w.])confirm\s*\(|window\.confirm\s*\(/.test(src), fichier + " : un confirm() du navigateur");
  }
});
