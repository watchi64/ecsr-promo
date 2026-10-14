import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rendreBlocInteractif, detruireScenes } from "../js/cours-blocs.js";

// Le rendu lit le catalogue sous l'adresse que porte son import, jeton de cache compris : pour Node, c'est un autre module que
// « catalogue-blocs.js » seul. C'est cette instance-là qu'on lit et qu'on complète, avec le jeton que le fichier porte aujourd'hui.
const jeton = readFileSync("js/cours-blocs.js", "utf8").match(/catalogue-blocs\.js(\?v=[0-9a-z]+)/)[1];
const { CATALOGUE } = await import(`../js/catalogue-blocs.js${jeton}`);

// Le bloc « :::dessin » sous Node : ce que le stagiaire voit (jamais un dessin deviné), ce que l'éditeur reçoit, ce que
// l'assistant garde en texte. DOM minimal, juste ce que lit le rendu (js/utils.js : el, qui lit document et Node).
class Noeud {}
class Texte extends Noeud {
  constructor(texte) { super(); this.texte = texte; }
  get textContent() { return this.texte; }
}
class Element extends Noeud {
  constructor(nom) { super(); this.nom = nom; this.attributs = new Map(); this.enfants = []; this.dataset = {}; this.className = ""; this.ecouteurs = {}; }
  setAttribute(k, v) { this.attributs.set(k, String(v)); }
  getAttribute(k) { return this.attributs.has(k) ? this.attributs.get(k) : null; }
  appendChild(n) { this.enfants.push(n); return n; }
  replaceChildren(...ns) { this.enfants = []; ns.forEach((n) => this.appendChild(n)); }
  addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); }
  get textContent() { return this.enfants.map((e) => e.textContent).join(""); }
}
const descendants = (n) => (n instanceof Element ? [n, ...n.enfants.flatMap(descendants)] : [n]);
const avecClasse = (n, classe) => descendants(n).filter((x) => x instanceof Element && x.className.split(" ").includes(classe));

let avant;
before(() => {
  avant = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = Noeud;
  globalThis.document = { createElement: (nom) => new Element(nom), createTextNode: (t) => new Texte(t) };
});
after(() => {
  for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
});

const inline = (texte) => document.createTextNode(texte);
const nouveauContexte = (extra = {}) => ({ erreurs: [], scenes: [], ...extra });
const attendre = () => new Promise((resolu) => setTimeout(resolu, 0));
const dessiner = (arg, lignes, contexte, ferme = true) => rendreBlocInteractif("dessin", arg, lignes, contexte, inline, ferme);

test(":::dessin sans code ou avec deux codes : l'erreur va à l'éditeur, le bloc reste du texte brut, rien n'est monté", () => {
  const sans = nouveauContexte();
  const brutSans = dessiner("", ["Une légende."], sans);
  assert.deepEqual(sans.erreurs, ["Bloc « :::dessin » sans code : ajouter le code du dessin après « :::dessin »."]);
  assert.equal(brutSans.nom, "pre");
  assert.ok(avecClasse(brutSans, "cours-bloc-brut").length === 1);
  assert.equal(brutSans.textContent, ":::dessin\nUne légende.\n:::");
  assert.equal(sans.scenes.length, 0);

  const deux = nouveauContexte();
  const brutDeux = dessiner("a b", [], deux);
  assert.deepEqual(deux.erreurs, ["Bloc « :::dessin a b » : un seul dessin par bloc."]);
  assert.equal(brutDeux.textContent, ":::dessin a b\n:::");
  assert.equal(deux.scenes.length, 0);
});

test(":::dessin inconnu : seule la légende s'affiche, jamais un dessin deviné, et l'éditeur reçoit l'erreur", () => {
  const contexte = nouveauContexte();
  const figure = dessiner("inconnu", ["Juste : 9 h et 3 h.", "Faux : pouce engagé."], contexte);
  assert.deepEqual(contexte.erreurs, ["Dessin « inconnu » inconnu : seule la légende s'affiche."]);
  assert.equal(figure.nom, "figure");
  assert.deepEqual(figure.className.split(" "), ["dessin-bloc", "dessin-inconnu"]);
  assert.equal(figure.enfants.length, 1, "la légende et rien d'autre");
  assert.equal(figure.enfants[0].nom, "figcaption");
  assert.equal(figure.enfants[0].className, "signaux-legende");
  assert.equal(figure.enfants[0].textContent, "Juste : 9 h et 3 h. Faux : pouce engagé.");
  assert.equal(avecClasse(figure, "dessin-vue").length, 0);
  assert.equal(descendants(figure).filter((x) => x instanceof Element && x.nom === "svg").length, 0);
  assert.equal(contexte.scenes.length, 0, "rien à détruire : aucun module n'a été demandé");

  // Sans légende, le bloc est vide : l'erreur reste dite à l'éditeur.
  const sansLegende = nouveauContexte();
  assert.equal(dessiner("inconnu", [], sansLegende).enfants.length, 0);
  assert.equal(sansLegende.erreurs.length, 1);
});

test(":::dessin ne dessine que ce que le catalogue donne comme dessin : ni propriété héritée, ni schéma animé", () => {
  for (const code of ["constructor", "toString", "__proto__", "hasOwnProperty", "tourner-droite", "tirer-glisser", "autotest"]) {
    const contexte = nouveauContexte();
    const figure = dessiner(code, ["Légende."], contexte);
    assert.equal(contexte.erreurs.length, 1, `${code} : une erreur pour l'éditeur`);
    assert.match(contexte.erreurs[0], new RegExp(`^Dessin « ${code} » inconnu`), code);
    assert.deepEqual(figure.className.split(" "), ["dessin-bloc", "dessin-inconnu"], `${code} : bloc sans dessin`);
    assert.equal(avecClasse(figure, "dessin-vue").length, 0, `${code} : aucune vue de dessin`);
    assert.equal(contexte.scenes.length, 0, `${code} : rien de monté`);
  }
});

test(":::dessin non refermé, ou dans l'assistant : du texte brut, rien n'est chargé ni monté", () => {
  const ouvert = nouveauContexte();
  const brutOuvert = dessiner("capot", ["Une légende."], ouvert, false);
  assert.equal(brutOuvert.textContent, ":::dessin capot\nUne légende.");
  assert.match(ouvert.erreurs[0], /« :::dessin » non refermé/);
  assert.equal(ouvert.scenes.length, 0);

  // L'assistant : un bloc copié dans une réponse reste du texte, même avec un code valable ; aucune erreur n'est dite.
  const assistant = nouveauContexte({ blocs: false });
  const brutAssistant = dessiner("capot", ["La disposition varie selon les modèles."], assistant);
  assert.equal(brutAssistant.nom, "pre");
  assert.equal(brutAssistant.textContent, ":::dessin capot\nLa disposition varie selon les modèles.\n:::");
  assert.deepEqual(assistant.erreurs, []);
  assert.equal(assistant.scenes.length, 0);
  // Même un bloc mal formé reste du texte, sans erreur : l'assistant n'a pas d'éditeur pour la lire.
  const assistantSansCode = nouveauContexte({ blocs: false });
  assert.equal(dessiner("", [], assistantSansCode).nom, "pre");
  assert.deepEqual(assistantSansCode.erreurs, []);
});

test(":::dessin d'un code du catalogue : cadre, légende et place du dessin tout de suite, détruit avec le cours", async () => {
  const signaux = [], journal = [];
  const erreurConsole = console.error;
  console.error = (...args) => journal.push(args);
  try {
    const contexte = nouveauContexte({ signaler: (m) => signaux.push(m) });
    const figure = dessiner("mains-volant", ["Juste : 9 h et 3 h."], contexte);
    assert.deepEqual(contexte.erreurs, []);
    assert.equal(figure.nom, "figure");
    assert.equal(figure.className, "dessin-bloc");
    assert.deepEqual(figure.enfants.map((e) => e.className), ["dessin-vue", "signaux-legende"]);
    assert.equal(figure.enfants[1].textContent, "Juste : 9 h et 3 h.");
    // La place du dessin est réservée aux proportions de son cadre (320 sur 200 au catalogue) : rien ne saute à l'arrivée.
    const [attente] = figure.enfants[0].enfants;
    assert.equal(attente.className, "bloc-attente");
    assert.equal(attente.getAttribute("style"), `aspect-ratio: ${CATALOGUE["mains-volant"].cadre[0]} / ${CATALOGUE["mains-volant"].cadre[1]}`);
    assert.equal(attente.textContent, "Chargement du schéma…");
    // Le bloc est enregistré pour être détruit à la fermeture du cours ou au nouveau rendu de l'aperçu.
    assert.equal(contexte.scenes.length, 1);
    detruireScenes(contexte);
    assert.equal(contexte.scenes.length, 0);
    // Détruit avant l'arrivée du module : ni dessin, ni message, ni signal, ni trace en console, quelle que soit l'issue.
    await attendre(); await attendre();
    assert.equal(figure.enfants[0].enfants.length, 1);
    assert.equal(figure.enfants[0].enfants[0].className, "bloc-attente");
    assert.deepEqual(signaux, []);
    assert.deepEqual(journal, []);
  } finally {
    console.error = erreurConsole;
  }
});

test(":::dessin dont le module ne vient pas : message de réseau et « Réessayer » qui relance vraiment le chargement, l'éditeur est prévenu", async () => {
  // Entrée d'essai : un nom de module que la table des chargeurs ne connaît pas, donc un échec de chargement à coup sûr,
  // où que tourne le test (les modules de famille existeront un à un, au fil des tâches).
  CATALOGUE["essai-reseau"] = { bloc: "dessin", module: "inexistant", titre: "Essai", legendeModele: "Légende d'essai.", cadre: [320, 240] };
  const signaux = [], journal = [];
  const erreurConsole = console.error;
  console.error = (...args) => journal.push(args);
  try {
    const contexte = nouveauContexte({ signaler: (m) => signaux.push(m) });
    const figure = dessiner("essai-reseau", ["Légende du cours."], contexte);
    const vue = figure.enfants[0];
    assert.equal(vue.enfants[0].className, "bloc-attente");
    assert.equal(vue.enfants[0].getAttribute("style"), "aspect-ratio: 320 / 240");

    await attendre();
    const echec = vue.enfants[0];
    assert.equal(echec.className, "bloc-echec");
    const [message, ...suite] = echec.enfants;
    assert.equal(message.textContent, "Le schéma n'a pas pu se charger. Vérifier la connexion.");
    const bouton = suite[suite.length - 1];
    assert.equal(bouton.nom, "button");
    assert.equal(bouton.textContent, "Réessayer");
    assert.equal(suite.length, 1, "au premier échec, le message et le bouton, rien d'autre");
    assert.equal(figure.enfants[1].textContent, "Légende du cours.", "la légende reste affichée pendant l'échec");
    // L'éditeur apprend la cause précise, une fois ; la console garde la trace.
    assert.deepEqual(signaux, ["Dessin « essai-reseau » : le module « inexistant » n'a pas pu se charger."]);
    assert.equal(journal.length, 1);
    assert.deepEqual(contexte.erreurs, []);

    // « Réessayer » relance le chargement : l'attente revient tout de suite, puis le deuxième échec ajoute de recharger la page.
    bouton.ecouteurs.click[0]();
    assert.equal(vue.enfants[0].className, "bloc-attente");
    await attendre();
    const echec2 = vue.enfants[0];
    assert.equal(echec2.className, "bloc-echec");
    assert.equal(echec2.enfants.length, 3);
    assert.match(echec2.enfants[1].textContent, /recharger la page/);
    assert.equal(signaux.length, 2, "chaque échec est dit à l'éditeur (qui ne répète pas une ligne identique)");
    assert.equal(signaux[1], signaux[0]);

    // Détruit pendant l'échec, « Réessayer » ne recharge ni ne signale plus rien.
    const bouton2 = echec2.enfants[2];
    detruireScenes(contexte);
    bouton2.ecouteurs.click[0]();
    await attendre();
    assert.equal(signaux.length, 2);
    assert.equal(vue.enfants[0].className, "bloc-echec", "le bloc détruit ne montre rien de plus");
  } finally {
    delete CATALOGUE["essai-reseau"];
    console.error = erreurConsole;
  }
});
