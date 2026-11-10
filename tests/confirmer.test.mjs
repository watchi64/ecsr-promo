import test from "node:test";
import assert from "node:assert/strict";
import { ElementFactice, NoeudFactice, descendants, installerDocument } from "./aides-dom.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { confirmer, demander } from "../js/confirmer.js";

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
    declencher(type, evenement = {}) { for (const f of [...(ecouteurs.get(type) || [])]) f({ type, ...evenement }); },
  };
}

const AJOUTS = {
  focus() { document.activeElement = this; },
  select() { this.selectionne = true; },
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

test("les autres touches ne vont pas plus loin (Ctrl+Z ne défait rien sous la question) ; Entrée garde son effet", () => avecDocument(async (document) => {
  const reponse = confirmer({ titre: "Vider les placements de la semaine ?", oui: "Vider" });
  await tour();
  let e = touche("z", { ctrlKey: true });
  assert.ok(e.arrete, "Ctrl+Z s'arrête à la fenêtre");
  assert.ok(!e.empeche, "sans empêcher le navigateur");
  e = touche("Enter");
  assert.ok(e.arrete && !e.empeche, "Entrée : rien d'autre ne la reçoit, mais elle active toujours le bouton qui a le focus");
  assert.ok(fenetre(document), "la fenêtre reste");
  bouton(document, "Annuler").click();
  assert.equal(await reponse, false);
}));

test("un changement de page (Retour du téléphone) referme la question : réponse non, focus non rendu", () => avecDocument(async (document) => {
  const champ = document.createElement("input");
  document.body.appendChild(champ);
  champ.focus();
  const reponse = confirmer({ titre: "Vider les placements de la semaine ?", oui: "Vider" });
  await tour();
  const oui = bouton(document, "Vider");
  globalThis.window.declencher("hashchange");
  assert.equal(await reponse, false);
  assert.equal(fenetre(document), null);
  assert.equal(document.activeElement, oui, "le focus n'est pas rendu au champ de la page quittée");
  assert.equal(clavier().length, 0, "plus d'écoute du clavier");
  assert.equal(globalThis.window.ecoutes("hashchange").length, 0, "plus d'écoute de l'adresse");
}));

test("après une réponse, l'arrêt du signal ne fait plus rien (un même signal sert à plusieurs questions)", () => avecDocument(async (document) => {
  const arret = new AbortController();
  const reponse = confirmer({ titre: "Terminer l'examen ?", oui: "Terminer", danger: false, signal: arret.signal });
  await tour();
  bouton(document, "Terminer").click();
  assert.equal(await reponse, true);
  arret.abort();
  assert.equal(fenetre(document), null);
}));

test("le plan de la fenêtre : au-dessus des calques de la navigation (1600), sous les messages du bas (2000)", () => {
  const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
  const m = css.match(/\.modal-backdrop\.confirmer-fond\s*\{\s*z-index:\s*(\d+)/);
  assert.ok(m, "la règle .modal-backdrop.confirmer-fond existe");
  const z = Number(m[1]);
  assert.ok(z > 1600 && z < 2000, "plan " + z);
});

test("un signal déjà abandonné : rien ne s'ouvre, réponse non", () => avecDocument(async (document) => {
  const arret = new AbortController();
  arret.abort();
  const reponse = confirmer({ titre: "Terminer l'examen ?", oui: "Terminer", signal: arret.signal });
  assert.equal(await reponse, false);
  assert.equal(fenetre(document), null);
}));

// Lot B (10/11) : plus aucune boîte du navigateur dans toute l'app, ni confirm(), ni prompt(), ni alert().
function fichiersJs(dossier) {
  return readdirSync(new URL("../" + dossier, import.meta.url)).flatMap((nom) => {
    const chemin = dossier + "/" + nom;
    return statSync(new URL("../" + chemin, import.meta.url)).isDirectory() ? fichiersJs(chemin) : (nom.endsWith(".js") ? [chemin] : []);
  });
}

test("l'app ne demande plus rien au navigateur : ni confirm(), ni prompt(), ni alert()", () => {
  const fichiers = fichiersJs("js");
  assert.ok(fichiers.length > 50, "les fichiers de js/ sont lus");
  for (const fichier of fichiers) {
    const src = readFileSync(new URL("../" + fichier, import.meta.url), "utf8")
      .replace(/\/\/.*$/gm, "");   // les commentaires peuvent parler de confirm()
    assert.ok(!/(^|[^\w.])(confirm|prompt|alert)\s*\(|window\.(confirm|prompt|alert)\s*\(/.test(src),
      fichier + " : une boîte du navigateur");
  }
});

// --- demander() : la même fenêtre avec un champ (libellé d'un jour désactivé, confirmation tapée) ---
const champ = (document) => descendants(fenetre(document)).find((n) => n.nodeName === "input");

test("demander : le champ a le focus et sa valeur de départ ; le bouton rend ce qui est tapé", () => avecDocument(async (document) => {
  const reponse = demander({ titre: "Désactiver lundi ?", libelle: "Libellé", valeur: "Vacances", oui: "Désactiver", danger: false });
  await tour();
  const c = champ(document);
  assert.ok(c, "un champ");
  assert.equal(c.value, "Vacances");
  assert.equal(document.activeElement, c, "le focus va au champ");
  assert.ok(c.selectionne, "son texte est sélectionné, prêt à être remplacé");
  assert.ok(descendants(fenetre(document)).some((n) => n.nodeName === "label" && n.textContent.includes("Libellé")), "le champ est nommé");
  c.value = "Pont";
  bouton(document, "Désactiver").click();
  assert.equal(await reponse, "Pont");
  assert.equal(fenetre(document), null);
}));

test("demander : « Annuler » et Échap rendent null", () => avecDocument(async (document) => {
  let reponse = demander({ titre: "Désactiver lundi ?", libelle: "Libellé", oui: "Désactiver" });
  await tour();
  bouton(document, "Annuler").click();
  assert.equal(await reponse, null);
  reponse = demander({ titre: "Désactiver lundi ?", libelle: "Libellé", oui: "Désactiver" });
  await tour();
  touche("Escape");
  assert.equal(await reponse, null);
}));

test("demander : toucher à côté de la fenêtre rend null (jamais false : un appelant qui efface ne doit rien lancer)", () => avecDocument(async (document) => {
  const reponse = demander({ titre: "Anonymiser la promo ?", libelle: "Pour confirmer, tapez ANONYMISER", oui: "Anonymiser",
    verifier: (v) => v.trim() === "ANONYMISER" });
  await tour();
  const f = fenetre(document);
  for (const rappel of f.ecouteurs.get("click") || []) rappel({ type: "click", target: f });
  assert.equal(await reponse, null);
}));

test("demander : un focus sorti de la fenêtre revient au champ par Tab", () => avecDocument(async (document) => {
  const reponse = demander({ titre: "Désactiver lundi ?", libelle: "Libellé", oui: "Désactiver" });
  await tour();
  const c = champ(document);
  document.activeElement = null;
  touche("Tab");
  assert.equal(document.activeElement, c);
  bouton(document, "Annuler").click();
  assert.equal(await reponse, null);
}));

test("demander : Entrée dans le champ valide", () => avecDocument(async (document) => {
  const reponse = demander({ titre: "Désactiver lundi ?", libelle: "Libellé", valeur: "Férié", oui: "Désactiver" });
  await tour();
  const e = touche("Enter");
  assert.ok(e.empeche, "Entrée ne fait rien d'autre");
  assert.equal(await reponse, "Férié");
}));

test("demander : une saisie refusée par `verifier` laisse la fenêtre ouverte et le dit ; la bonne saisie passe", () => avecDocument(async (document) => {
  const reponse = demander({ titre: "Effacer les données de Léa ?", libelle: "Pour confirmer, tapez le prénom", oui: "Effacer",
    verifier: (v) => v.trim() === "Léa", erreur: "Le prénom ne correspond pas : rien n'est effacé." });
  await tour();
  const c = champ(document);
  c.value = "Lea";
  bouton(document, "Effacer").click();
  await tour();
  assert.ok(fenetre(document), "la fenêtre reste ouverte");
  const alerte = descendants(fenetre(document)).find((n) => n.getAttribute?.("role") === "alert");
  assert.equal(alerte.textContent, "Le prénom ne correspond pas : rien n'est effacé.");
  assert.equal(document.activeElement, c, "le focus revient au champ");
  c.value = "Léa";
  bouton(document, "Effacer").click();
  assert.equal(await reponse, "Léa");
}));

test("demander : Tab passe du champ aux deux boutons et revient", () => avecDocument(async (document) => {
  const reponse = demander({ titre: "Désactiver lundi ?", libelle: "Libellé", oui: "Désactiver" });
  await tour();
  const c = champ(document), non = bouton(document, "Annuler"), oui = bouton(document, "Désactiver");
  touche("Tab"); assert.equal(document.activeElement, non);
  touche("Tab"); assert.equal(document.activeElement, oui);
  touche("Tab"); assert.equal(document.activeElement, c, "après le dernier, le champ");
  touche("Tab", { shiftKey: true }); assert.equal(document.activeElement, oui, "Maj+Tab sur le champ : le dernier bouton");
  non.click();
  assert.equal(await reponse, null);
}));
