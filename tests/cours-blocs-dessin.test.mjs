import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rendreBlocInteractif, detruireScenes } from "../js/cours-blocs.js";

// Le rendu lit le catalogue sous l'adresse que porte son import, jeton de cache compris : pour Node, c'est un autre module que
// « catalogue-blocs.js » seul. C'est cette instance-là qu'on lit et qu'on complète, avec le jeton que le fichier porte aujourd'hui.
const jeton = readFileSync("js/cours-blocs.js", "utf8").match(/catalogue-blocs\.js(\?v=[0-9a-z]+)/)[1];
const { CATALOGUE } = await import(`../js/catalogue-blocs.js${jeton}`);

// Les blocs illustrés sous Node : le bloc « :::dessin » (ce que le stagiaire voit, jamais un dessin deviné ; ce que l'éditeur
// reçoit ; ce que l'assistant garde en texte) et, pour que chacun garde son mot (« dessin » ou « schéma »), le bloc « :::scene ».
// DOM minimal, juste ce que lit le rendu : js/utils.js (el : document et Node), et js/dessin-svg.js (versDom : createElementNS).
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
const avecNom = (n, nom) => descendants(n).filter((x) => x instanceof Element && x.nom === nom);

let avant;
before(() => {
  avant = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = Noeud;
  globalThis.document = {
    createElement: (nom) => new Element(nom),
    createElementNS: (_espace, nom) => new Element(nom),   // versDom : un dessin se monte dans cette même vue
    createTextNode: (t) => new Texte(t),
  };
});
after(() => {
  for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
});

const inline = (texte) => document.createTextNode(texte);
const nouveauContexte = (extra = {}) => ({ erreurs: [], scenes: [], ...extra });
const attendre = () => new Promise((resolu) => setTimeout(resolu, 0));
// Attend qu'une condition soit vraie (un module qui se charge pour de vrai, comme « route » sous Node, prend quelques millisecondes).
async function attendreQue(condition, delai = 5000) {
  const fin = Date.now() + delai;
  while (!condition()) {
    if (Date.now() > fin) throw new Error("délai dépassé : l'état attendu n'est pas venu");
    await new Promise((resolu) => setTimeout(resolu, 2));
  }
}
const dessiner = (arg, lignes, contexte, ferme = true) => rendreBlocInteractif("dessin", arg, lignes, contexte, inline, ferme);
// Une entrée d'essai du catalogue, retirée à la fin du test ; la console, captée pour que le test dise ce qui s'y est écrit.
async function avecEntrees(entrees, essai) {
  const journal = [], erreurConsole = console.error;
  Object.assign(CATALOGUE, entrees);
  console.error = (...args) => journal.push(args);
  try { await essai(journal); } finally {
    for (const code of Object.keys(entrees)) delete CATALOGUE[code];
    console.error = erreurConsole;
  }
}

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
  assert.equal(avecNom(figure, "svg").length, 0);
  assert.equal(contexte.scenes.length, 0, "rien à détruire : aucun module n'a été demandé");

  // Sans légende, le bloc est vide : l'erreur reste dite à l'éditeur.
  const sansLegende = nouveauContexte();
  assert.equal(dessiner("inconnu", [], sansLegende).enfants.length, 0);
  assert.equal(sansLegende.erreurs.length, 1);
});

test(":::dessin ne dessine que ce que le catalogue donne comme dessin : ni propriété héritée, ni schéma animé (dont le message nomme :::scene)", () => {
  const cas = [
    ...["constructor", "toString", "__proto__", "hasOwnProperty"].map((code) => [code, `Dessin « ${code} » inconnu : seule la légende s'affiche.`]),
    ...["tourner-droite", "tirer-glisser", "autotest"].map((code) =>
      [code, `« ${code} » est un schéma animé, pas un dessin : écrire « :::scene ${code} » avec ses étapes. Seule la légende s'affiche.`]),
  ];
  for (const [code, message] of cas) {
    const contexte = nouveauContexte();
    const figure = dessiner(code, ["Légende."], contexte);
    assert.deepEqual(contexte.erreurs, [message], `${code} : l'erreur de l'éditeur`);
    assert.deepEqual(figure.className.split(" "), ["dessin-bloc", "dessin-inconnu"], `${code} : bloc sans dessin`);
    assert.equal(avecClasse(figure, "dessin-vue").length, 0, `${code} : aucune vue de dessin`);
    assert.equal(contexte.scenes.length, 0, `${code} : rien de monté`);
  }
});

test(":::scene d'un code de dessin : les étapes en simple liste, et le message nomme :::dessin ; un code inconnu garde son message", () => {
  const contexte = nouveauContexte();
  const bloc = rendreBlocInteractif("scene", "mains-volant", ["Première étape", "Deuxième étape"], contexte, inline, true);
  assert.deepEqual(contexte.erreurs,
    ["« mains-volant » est un dessin, pas un schéma animé : écrire « :::dessin mains-volant » avec sa légende. Les étapes s'affichent en simple liste."]);
  assert.deepEqual(bloc.className.split(" "), ["scene-bloc", "scene-inconnue"]);
  assert.equal(avecClasse(bloc, "scene-vue").length, 0);
  assert.equal(avecNom(bloc, "button").length, 0, "des étapes en texte, pas de bouton mort");
  assert.equal(contexte.scenes.length, 0);

  const inconnu = nouveauContexte();
  rendreBlocInteractif("scene", "tourner-droit", ["Une étape"], inconnu, inline, true);
  assert.deepEqual(inconnu.erreurs, ["Schéma « tourner-droit » inconnu : les étapes s'affichent en simple liste."]);
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
  const signaux = [];
  await avecEntrees({}, async (journal) => {
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
    assert.equal(attente.textContent, "Chargement du dessin…", "un dessin dit « dessin », jamais « schéma »");
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
  });
});

test(":::dessin dont le module ne vient pas : message de réseau et « Réessayer » qui relance vraiment le chargement, l'éditeur est prévenu", async () => {
  // Entrée d'essai : un nom de module que la table des chargeurs ne connaît pas, donc un échec de chargement à coup sûr,
  // où que tourne le test (les modules de famille existeront un à un, au fil des tâches).
  const entree = { bloc: "dessin", module: "inexistant", titre: "Essai", legendeModele: "Légende d'essai.", cadre: [320, 240] };
  const signaux = [];
  await avecEntrees({ "essai-reseau": entree }, async (journal) => {
    const contexte = nouveauContexte({ signaler: (m) => signaux.push(m) });
    const figure = dessiner("essai-reseau", ["Légende du cours."], contexte);
    const vue = figure.enfants[0];
    assert.equal(vue.enfants[0].className, "bloc-attente");
    assert.equal(vue.enfants[0].getAttribute("style"), "aspect-ratio: 320 / 240");
    assert.equal(vue.enfants[0].textContent, "Chargement du dessin…");

    await attendre();
    const echec = vue.enfants[0];
    assert.equal(echec.className, "bloc-echec");
    const [message, ...suite] = echec.enfants;
    assert.equal(message.textContent, "Le dessin n'a pas pu se charger. Vérifier la connexion.");
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
    assert.equal(vue.enfants[0].textContent, "Chargement du dessin…");
    await attendre();
    const echec2 = vue.enfants[0];
    assert.equal(echec2.className, "bloc-echec");
    assert.equal(echec2.enfants.length, 3);
    assert.equal(echec2.enfants[0].textContent, "Le dessin n'a pas pu se charger. Vérifier la connexion.");
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
  });
});

test(":::dessin dont le module est chargé mais ne connaît pas le code : message sobre sans « Réessayer », l'éditeur dit où il manque", async () => {
  // Entrée d'essai : le module « route » se charge pour de vrai sous Node (scenes.js et scene-moteur.js n'ont pas besoin de DOM à
  // l'import) et n'a aucun registre DESSINS : le code est absent de son module, un cas qui ne dépend d'aucune famille à venir.
  const entree = { bloc: "dessin", module: "route", titre: "Essai", legendeModele: "Légende d'essai.", cadre: [320, 200] };
  const signaux = [];
  await avecEntrees({ "essai-absent": entree }, async (journal) => {
    const contexte = nouveauContexte({ signaler: (m) => signaux.push(m) });
    const figure = dessiner("essai-absent", ["Légende du cours."], contexte);
    const vue = figure.enfants[0];
    assert.equal(vue.enfants[0].className, "bloc-attente");

    await attendreQue(() => vue.enfants[0].className !== "bloc-attente");
    const indisponible = vue.enfants[0];
    assert.equal(indisponible.className, "bloc-indisponible");
    assert.equal(indisponible.textContent, "Ce dessin n'est pas encore disponible.");
    assert.equal(avecClasse(vue, "bloc-echec").length, 0, "pas une panne de réseau");
    assert.equal(avecNom(vue, "button").length, 0, "pas de « Réessayer » : le module est chargé, il n'y changerait rien");
    assert.equal(figure.enfants[1].textContent, "Légende du cours.", "la légende reste affichée");
    // L'éditeur apprend où il manque ; la console garde la trace ; le rendu n'a rien eu à dire.
    assert.deepEqual(signaux, ["Dessin « essai-absent » : absent du module « route »."]);
    assert.equal(journal.length, 1);
    assert.deepEqual(contexte.erreurs, []);
    detruireScenes(contexte);
  });
});

test(":::scene garde le mot « schéma » : attente, échec de réseau avec « Réessayer », code absent de son module", async () => {
  // Deux scènes d'essai : l'une dont le module ne vient pas, l'autre dans le module « route », qui ne la connaît pas.
  const etapesModele = ["Une étape", "Une autre étape"];
  const entrees = {
    "essai-scene-reseau": { bloc: "scene", module: "inexistant", titre: "Essai", etapesModele },
    "essai-scene-absente": { bloc: "scene", module: "route", titre: "Essai", etapesModele },
  };
  const signaux = [];
  await avecEntrees(entrees, async (journal) => {
    const lancer = (code) => {
      const contexte = nouveauContexte({ signaler: (m) => signaux.push(m) });
      const figure = rendreBlocInteractif("scene", code, etapesModele, contexte, inline, true);
      return { contexte, figure, vue: figure.enfants[0] };
    };
    // Réseau.
    const reseau = lancer("essai-scene-reseau");
    assert.equal(reseau.figure.className, "scene-bloc");
    assert.equal(reseau.vue.className, "scene-vue");
    assert.equal(reseau.vue.enfants[0].textContent, "Chargement du schéma…");
    assert.equal(avecClasse(reseau.figure, "scene-etapes").length, 1, "la liste des étapes est là tout de suite");
    await attendre();
    assert.equal(reseau.vue.enfants[0].className, "bloc-echec");
    assert.equal(reseau.vue.enfants[0].enfants[0].textContent, "Le schéma n'a pas pu se charger. Vérifier la connexion.");
    assert.equal(avecNom(reseau.vue, "button")[0].textContent, "Réessayer");
    // Les étapes sont des boutons branchés sur le bloc que l'aide a déjà démarré : un appui, module absent, est retenu sans erreur.
    const etapes = avecClasse(reseau.figure, "scene-etape");
    assert.equal(etapes.length, 2);
    assert.doesNotThrow(() => etapes[1].ecouteurs.click[0]());
    // Code absent de son module.
    const absente = lancer("essai-scene-absente");
    await attendreQue(() => absente.vue.enfants[0].className !== "bloc-attente");
    assert.equal(absente.vue.enfants[0].className, "bloc-indisponible");
    assert.equal(absente.vue.enfants[0].textContent, "Ce schéma n'est pas encore disponible.");
    assert.equal(avecNom(absente.vue, "button").length, 0);
    // L'éditeur lit le genre de chaque bloc : « Schéma » pour une scène.
    assert.deepEqual(signaux, [
      "Schéma « essai-scene-reseau » : le module « inexistant » n'a pas pu se charger.",
      "Schéma « essai-scene-absente » : absent du module « route ».",
    ]);
    assert.equal(journal.length, 2);
    // Le cycle de vie est celui du dessin, par la même aide : chaque scène est inscrite pour la destruction, et démarrée.
    assert.equal(reseau.contexte.scenes.length, 1);
    assert.equal(absente.contexte.scenes.length, 1);
    detruireScenes(reseau.contexte);
    detruireScenes(absente.contexte);
    assert.equal(reseau.contexte.scenes.length, 0);
    assert.equal(absente.contexte.scenes.length, 0);
  });
});

test("le DOM minimal sait rendre un dessin (versDom) : de quoi tester le montage réussi d'un dessin réel", async () => {
  // Le montage réussi d'un dessin réel (famille « poste ») est le test suivant. Ce test-ci garantit seulement que le DOM de ce
  // fichier porte ce que versDom lui demande (createElementNS, attributs, texte).
  const { n, versDom } = await import("../js/dessin-svg.js");
  const racine = versDom(n("svg", { viewBox: "0 0 320 200", role: "img" }, n("text", { x: 160, y: 100 }, "Essai")));
  assert.equal(racine.nom, "svg");
  assert.equal(racine.getAttribute("viewBox"), "0 0 320 200");
  assert.equal(racine.getAttribute("role"), "img");
  assert.equal(racine.enfants[0].nom, "text");
  assert.equal(racine.enfants[0].getAttribute("x"), "160");
  assert.equal(racine.textContent, "Essai");
});

test(":::dessin d'un dessin réel (famille « poste ») : le dessin remplace l'attente dans sa vue, la légende reste, rien n'est signalé", async () => {
  // Les dessins fixes de la famille « poste » (js/dessins-poste.js), chargés pour de vrai sous Node par le chargeur du lecteur,
  // montés par rendreDessin dans le DOM minimal de ce fichier : figure.dessin-bloc > div.dessin-vue > svg.
  const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "poste" && CATALOGUE[c].bloc === "dessin");
  assert.deepEqual(codes.sort(), ["mains-volant", "pedales", "poste-commandes"]);
  await avecEntrees({}, async (journal) => {
    for (const code of codes) {
      const signaux = [];
      const contexte = nouveauContexte({ signaler: (m) => signaux.push(m) });
      const figure = dessiner(code, ["Légende du cours."], contexte);
      const vue = figure.enfants[0];
      assert.equal(vue.enfants[0].className, "bloc-attente", `${code} : l'attente d'abord`);
      await attendreQue(() => vue.enfants[0].className !== "bloc-attente");
      assert.equal(vue.enfants.length, 1, `${code} : le dessin seul dans la vue`);
      const svg = vue.enfants[0];
      assert.equal(svg.nom, "svg", code);
      assert.equal(svg.getAttribute("viewBox"), `0 0 ${CATALOGUE[code].cadre[0]} ${CATALOGUE[code].cadre[1]}`, `${code} : le cadre du catalogue`);
      assert.equal(svg.getAttribute("class"), "dessin-svg");
      assert.equal(svg.getAttribute("role"), "img");
      assert.ok(svg.getAttribute("aria-label").startsWith(`${CATALOGUE[code].titre}. `), `${code} : titre du catalogue, puis la description`);
      assert.ok(avecNom(svg, "text").length > 0, `${code} : les textes du dessin sont des nœuds de texte du DOM`);
      assert.deepEqual(figure.enfants.map((e) => e.className), ["dessin-vue", "signaux-legende"]);
      assert.equal(figure.enfants[1].textContent, "Légende du cours.");
      assert.deepEqual(signaux, [], `${code} : rien à dire à l'éditeur`);
      assert.deepEqual(contexte.erreurs, []);
      assert.equal(contexte.scenes.length, 1, `${code} : inscrit pour la destruction`);
      detruireScenes(contexte);
      assert.equal(vue.enfants[0], svg, `${code} : détruire un dessin monté le laisse affiché`);
    }
    assert.deepEqual(journal, [], "rien en console");
  });
});
