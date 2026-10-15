import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, basename, relative } from "node:path";
import { creerChargeur, montageDiffere, adresseDeReprise, piloterBloc, trouverDansRegistre } from "../js/cours-blocs-rules.js";
import { MODULES_BLOCS } from "../js/catalogue-blocs.js";

// Imports statiques d'un module (pas les import() dynamiques) : « import … from "x" », « export … from "x" », « import "x" ».
function importsStatiques(fichier) {
  const src = readFileSync(fichier, "utf8");
  const motifs = [/^\s*(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/gms, /^\s*import\s*["']([^"']+)["']/gm];
  return motifs.flatMap((re) => [...src.matchAll(re)].map((m) => m[1]));
}

test("le démarrage de l'app n'atteint ni moteur, ni registre de scènes, ni dessin", () => {
  const vus = new Set();
  const pile = [resolve("js/main.js")];
  while (pile.length) {
    const f = pile.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    for (const spec of importsStatiques(f)) if (spec.startsWith(".")) pile.push(resolve(dirname(f), spec.split("?")[0]));
  }
  const noms = [...vus].map((f) => basename(f));
  // Le parcours n'est pas aveugle : il atteint le lecteur de cours et le catalogue, qui sont bien chargés au démarrage.
  for (const attendu of ["main.js", "cours-reader.js", "cours-blocs.js", "cours-blocs-rules.js", "catalogue-blocs.js"]) {
    assert.ok(noms.includes(attendu), `${attendu} devrait être atteint depuis main.js`);
  }
  const lourds = noms
    .filter((n) => /^(scenes|scene-[a-z]+|lecteur-anime|geste-moteur|geste-regles|animation-courbes|dessin-svg|dessins-[a-z]+|piece-[a-z]+)\.js$/.test(n));
  assert.deepEqual(lourds, []);
});

// Object.hasOwn n'existe qu'à partir de Safari 15.4 : sur un iPhone resté plus ancien, un dessin qui l'appelle afficherait « Ce
// dessin n'a pas pu s'afficher » (relecture finale du lot D1, M7). L'app écrit Object.prototype.hasOwnProperty.call.
test("le code de l'app n'emploie pas Object.hasOwn (Safari 15.4 et plus)", () => {
  const fautes = fichiersJs(resolve("js")).filter((f) => /\bObject\.hasOwn\s*\(/.test(readFileSync(f, "utf8")))
    .map((f) => relative(resolve("."), f).replace(/\\/g, "/"));
  assert.deepEqual(fautes, []);
});

test("creerChargeur : un seul chargement par module, un échec oublié, un nom inconnu refusé", async () => {
  let appels = 0, echoue = true;
  const charger = creerChargeur({ route: () => { appels++; return echoue ? Promise.reject(new Error("réseau")) : Promise.resolve({ ok: 1 }); } });
  await assert.rejects(charger("route"), /réseau/);
  echoue = false;
  const a = charger("route"), b = charger("route");
  assert.equal(a, b);
  assert.deepEqual(await a, { ok: 1 });
  assert.equal(appels, 2);
  await assert.rejects(charger("absent"), /Module de blocs inconnu : absent/);
});

test("creerChargeur : le chargeur reçoit le nombre d'échecs déjà essuyés, pour redemander le module sous une adresse nouvelle", async () => {
  const recus = [];
  const charger = creerChargeur({
    poste: (essai) => { recus.push(essai); return recus.length < 3 ? Promise.reject(new Error("réseau")) : Promise.resolve({ ok: 1 }); },
    voyants: (essai) => { recus.push(`voyants ${essai}`); return Promise.resolve({}); },
  });
  await assert.rejects(charger("poste"), /réseau/);
  await assert.rejects(charger("poste"), /réseau/);
  assert.deepEqual(await charger("poste"), { ok: 1 });
  await charger("poste");                 // chargé : le chargeur n'est plus appelé
  await charger("voyants");               // le compte est propre à chaque module
  assert.deepEqual(recus, [0, 1, 2, "voyants 0"]);
});

test("creerChargeur : un chargeur qui lève sans rendre de promesse est un échec comme un autre, jamais une exception", async () => {
  let appels = 0;
  const charger = creerChargeur({ poste: () => { appels++; if (appels === 1) throw new Error("levé"); return Promise.resolve(1); } });
  let promesse;
  assert.doesNotThrow(() => { promesse = charger("poste"); });
  await assert.rejects(promesse, /levé/);
  assert.equal(await charger("poste"), 1);
});

test("adresseDeReprise : le même fichier et le même jeton de cache, sous un paramètre d'essai qui change à chaque reprise", () => {
  assert.equal(adresseDeReprise("./scenes.js", "?v=20261013a", 1), "./scenes.js?v=20261013a&essai=1");
  assert.equal(adresseDeReprise("./scenes.js", "?v=20261013a", 2), "./scenes.js?v=20261013a&essai=2");
  assert.equal(adresseDeReprise("./dessins-poste.js", "", 1), "./dessins-poste.js?essai=1");
});

// « Réessayer » (Review Focus 1) : un import() qui a échoué reste en échec pour la même adresse jusqu'au rechargement de la page.
// La reprise doit donc demander le module sous une adresse nouvelle ; sinon, le bouton ne relance rien.
test("creerImporteur : au premier essai, l'import littéral du module ; à l'essai N, le même fichier sous le jeton et « essai=N », jamais l'adresse d'avant", async () => {
  const { creerImporteur } = await import("../js/cours-blocs.js");
  const demandes = [];
  const importer = creerImporteur("?v=20261015a", (adresse) => { demandes.push(adresse); return Promise.resolve({ adresse }); });
  let premiers = 0;
  const premier = () => { premiers++; return Promise.resolve({ premier: true }); };
  assert.deepEqual(await importer(0, "./dessins-poste.js", premier), { premier: true });
  assert.deepEqual(demandes, [], "au premier essai, aucune adresse calculée : l'import littéral sert");
  assert.deepEqual(await importer(1, "./dessins-poste.js", premier), { adresse: "./dessins-poste.js?v=20261015a&essai=1" });
  assert.deepEqual(await importer(2, "./dessins-poste.js", premier), { adresse: "./dessins-poste.js?v=20261015a&essai=2" });
  assert.equal(premiers, 1, "une reprise ne redemande jamais l'import littéral, que le navigateur garde en échec");
});

test("CHARGEURS de cours-blocs.js : chaque reprise redemande vraiment son module, sous une adresse nouvelle (sous Node, une autre instance du module)", async () => {
  const { CHARGEURS } = await import("../js/cours-blocs.js");
  // Ce qu'un chargeur rend : le module, ou, pour « route », ses deux pièces utiles (le moteur dit de quelle instance elles viennent).
  const instance = (m) => (typeof m.monterScene === "function" ? m.monterScene : m);
  assert.deepEqual(Object.keys(CHARGEURS).sort(), [...MODULES_BLOCS, "geste"].sort());
  for (const nom of Object.keys(CHARGEURS)) {
    const [premier, reprise, autre] = await Promise.all([0, 1, 2].map((essai) => CHARGEURS[nom](essai)));
    assert.notEqual(instance(reprise), instance(premier), `${nom} : la reprise rend le module déjà demandé à la même adresse`);
    assert.notEqual(instance(autre), instance(reprise), `${nom} : deux reprises sous la même adresse`);
    assert.deepEqual(Object.keys(reprise).sort(), Object.keys(premier).sort(), `${nom} : la reprise charge un autre module`);
  }
});

test("montageDiffere : rien ne se monte après une destruction ; un moteur monté est détruit", async () => {
  let resoudre;
  const charge = new Promise((r) => { resoudre = r; });
  let montes = 0;
  const p = montageDiffere(charge, () => { montes++; return { detruire() {} }; });
  p.detruire();
  resoudre({});
  await charge; await Promise.resolve();
  assert.equal(montes, 0);
  let detruits = 0;
  const q = montageDiffere(Promise.resolve({}), () => ({ detruire() { detruits++; } }));
  await Promise.resolve(); await Promise.resolve();
  assert.ok(q.monte);
  q.detruire();
  assert.equal(detruits, 1);
  let echecs = 0;
  montageDiffere(Promise.reject(new Error("x")), () => ({}), { echec: () => echecs++ });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(echecs, 1);
});

test("montageDiffere : un bloc détruit pendant un chargement qui échoue ne signale rien", async () => {
  let rejeter;
  const charge = new Promise((_, r) => { rejeter = r; });
  let echecs = 0;
  const p = montageDiffere(charge, () => ({}), { echec: () => echecs++ });
  p.detruire();
  rejeter(new Error("réseau"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(echecs, 0);
});

test("montageDiffere : un montage qui lève est un échec du bloc, signalé une fois, sans promesse rejetée sans suite", async () => {
  const erreurs = [];
  const p = montageDiffere(Promise.resolve({}), () => { throw new Error("montage"); }, { echec: (e) => erreurs.push(e.message) });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(erreurs, ["montage"]);
  assert.equal(p.monte, null);
  p.detruire();                           // rien à détruire, aucune erreur
});

test("cours-blocs.js : un chargeur par module du catalogue, un import littéral par module, et la reprise vise le même fichier", () => {
  const src = readFileSync("js/cours-blocs.js", "utf8");
  const debut = src.indexOf("const CHARGEURS = {");
  const fin = src.indexOf("\n};", debut);
  assert.ok(debut > 0 && fin > debut, "table CHARGEURS introuvable");
  const table = src.slice(debut, fin);
  const noms = [...table.matchAll(/^  ([a-z]+): \(essai\) =>/gm)].map((m) => m[1]).sort();
  assert.deepEqual(noms, [...MODULES_BLOCS, "geste"].sort());
  const paires = [...table.matchAll(/importer\(essai, "(\.\/[a-z-]+\.js)", \(\) => import\("(\.\/[a-z-]+\.js)\?v=[0-9a-z]+"\)\)/g)];
  assert.equal(paires.length, (table.match(/import\(/g) || []).length, "tout import() de la table passe par importer(), avec le jeton de cache");
  assert.equal(paires.length, MODULES_BLOCS.length + 2, "route en demande deux (registre et moteur), geste un, les autres familles un chacune");
  for (const [, reprise, premier] of paires) assert.equal(reprise, premier);
});

test("montageDiffere : echec reçoit la phase, « chargement » quand le module n'arrive pas, « montage » quand le montage lève", async () => {
  const phases = [];
  montageDiffere(Promise.reject(new Error("réseau")), () => ({}), { echec: (e, phase) => phases.push(["chargement?", e.message, phase]) });
  montageDiffere(Promise.resolve({}), () => { throw new Error("montage"); }, { echec: (e, phase) => phases.push(["montage?", e.message, phase]) });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(phases.sort(), [["chargement?", "réseau", "chargement"], ["montage?", "montage", "montage"]]);
});

// ===== piloterBloc : le cycle de vie d'un bloc illustré, sans DOM =====

const tick = () => new Promise((r) => setTimeout(r, 0));

// Des doublures de ce que lui donne js/cours-blocs.js : le chargement, le montage, l'affichage, le canal vers l'éditeur.
function banc({ charger = () => Promise.resolve({}), monter = () => ({}), code = "autotest", module = "voyants" } = {}) {
  const j = { affiche: [], signaux: [], journal: [], reessayer: null, charges: 0 };
  const bloc = piloterBloc({
    code, module,
    charger: () => { j.charges++; return charger(j.charges); },
    monter,
    afficher: {
      attente: () => j.affiche.push("attente"),
      echecReseau: (reessayer) => { j.affiche.push("reseau"); j.reessayer = reessayer; },
      indisponible: (nature) => j.affiche.push(`indisponible:${nature}`),
    },
    signaler: (message) => j.signaux.push(message),
    journaliser: (message, erreur) => j.journal.push({ message, erreur }),
  });
  return { bloc, j };
}

test("piloterBloc : un chargement qui échoue montre l'échec de réseau avec sa reprise et le signale une fois, avec le code", async () => {
  const { bloc, j } = banc({ charger: () => Promise.reject(new Error("Failed to fetch dynamically imported module: http://h/js/dessins-voyants.js?v=1")) });
  bloc.demarrer();
  await tick();
  assert.deepEqual(j.affiche, ["attente", "reseau"]);
  assert.equal(j.signaux.length, 1);
  assert.match(j.signaux[0], /« autotest »/);
  assert.match(j.signaux[0], /n'a pas pu se charger/);
  assert.equal(j.journal.length, 1);
  // « Réessayer » relance le chargement ; un nouvel échec est signalé de nouveau, une fois.
  j.reessayer();
  await tick();
  assert.equal(j.charges, 2);
  assert.deepEqual(j.affiche, ["attente", "reseau", "attente", "reseau"]);
  assert.equal(j.signaux.length, 2);
});

test("piloterBloc : après un échec de réseau, la reprise qui réussit monte le moteur, qu'une destruction arrête ensuite", async () => {
  let detruits = 0;
  const { bloc, j } = banc({ charger: (n) => (n === 1 ? Promise.reject(new Error("réseau")) : Promise.resolve({})), monter: () => ({ detruire() { detruits++; } }) });
  bloc.demarrer();
  await tick();
  j.reessayer();
  await tick();
  assert.deepEqual(j.affiche, ["attente", "reseau", "attente"]);
  assert.equal(j.signaux.length, 1);
  bloc.detruire();
  assert.equal(detruits, 1);
});

test("piloterBloc : un code absent du module chargé n'est pas une panne de réseau : pas de reprise, un message précis à l'éditeur", async () => {
  const { bloc, j } = banc({
    charger: () => Promise.resolve({ GESTES: {} }),
    monter: (modules) => trouverDansRegistre(modules.GESTES, "autotest", "voyants").construire(),
  });
  bloc.demarrer();
  await tick();
  assert.deepEqual(j.affiche, ["attente", "indisponible:absent"]);
  assert.equal(j.reessayer, null);
  assert.deepEqual(j.signaux, ["Schéma « autotest » : absent du module « voyants »."]);
});

test("piloterBloc : une erreur au montage n'est pas une panne de réseau non plus : pas de reprise, l'erreur est dite à l'éditeur", async () => {
  const { bloc, j } = banc({ monter: () => { throw new TypeError("boom"); } });
  bloc.demarrer();
  await tick();
  assert.deepEqual(j.affiche, ["attente", "indisponible:montage"]);
  assert.equal(j.reessayer, null);
  assert.deepEqual(j.signaux, ["Schéma « autotest » : erreur au montage (boom)."]);
  assert.equal(j.journal.length, 1);
});

test("piloterBloc : un bloc détruit pendant le chargement ne montre rien de plus et ne signale rien, qu'il échoue ou réussisse", async () => {
  let rejeter, resoudre, montes = 0;
  const { bloc, j } = banc({ charger: () => new Promise((res, rej) => { resoudre = res; rejeter = rej; }), monter: () => { montes++; return {}; } });
  bloc.demarrer();
  bloc.detruire();
  rejeter(new Error("réseau"));
  await tick();
  assert.deepEqual(j.affiche, ["attente"]);
  assert.deepEqual(j.signaux, []);
  assert.deepEqual(j.journal, []);
  const b2 = banc({ charger: () => new Promise((res) => { resoudre = res; }), monter: () => { montes++; return {}; } });
  b2.bloc.demarrer();
  b2.bloc.detruire();
  resoudre({});
  await tick();
  assert.equal(montes, 0);
  assert.deepEqual(b2.j.affiche, ["attente"]);
});

test("piloterBloc : « Réessayer » sur un bloc détruit entre-temps ne recharge rien et ne signale rien", async () => {
  const { bloc, j } = banc({ charger: () => Promise.reject(new Error("réseau")) });
  bloc.demarrer();
  await tick();
  bloc.detruire();
  j.reessayer();
  await tick();
  assert.equal(j.charges, 1);
  assert.equal(j.signaux.length, 1);
  assert.deepEqual(j.affiche, ["attente", "reseau"]);
});

test("piloterBloc : un appui sur une étape avant le montage est retenu et appliqué au montage ; après, il va droit au moteur", async () => {
  const appels = [];
  let resoudre;
  const moteur = { allerEtape: (i) => appels.push(i), detruire() {} };
  const { bloc } = banc({ charger: () => new Promise((res) => { resoudre = res; }), monter: () => moteur });
  bloc.demarrer();
  bloc.allerEtape(2);
  bloc.allerEtape(4);          // le dernier appui l'emporte
  assert.deepEqual(appels, []);
  resoudre({});
  await tick();
  assert.deepEqual(appels, [4]);
  bloc.allerEtape(0);
  assert.deepEqual(appels, [4, 0]);
});

test("piloterBloc : une étape qui ne s'applique pas ne coûte pas le moteur monté : il reste rendu à montageDiffere, donc détruit avec le bloc", async () => {
  let detruits = 0;
  const moteur = { allerEtape() { throw new Error("étape"); }, detruire() { detruits++; } };
  const { bloc, j } = banc({ monter: () => moteur });
  bloc.allerEtape(3);          // retenu avant le montage
  bloc.demarrer();
  await tick();
  assert.deepEqual(j.affiche, ["attente"], "pas d'échec affiché : le schéma est monté");
  assert.deepEqual(j.signaux, [], "ni signalé à l'éditeur");
  assert.equal(j.journal.length, 1, "mais consigné");
  assert.match(j.journal[0].message, /étape 4/);
  bloc.detruire();
  assert.equal(detruits, 1, "le moteur monté n'est pas resté en vie");
});

test("piloterBloc : un chargeur qui lève sans promesse est un échec de réseau comme un autre, jamais une exception du rendu", async () => {
  const { bloc, j } = banc({ charger: () => { throw new Error("levé"); } });
  assert.doesNotThrow(() => bloc.demarrer());
  await tick();
  assert.deepEqual(j.affiche, ["attente", "reseau"]);
  assert.equal(j.signaux.length, 1);
});

// ===== Les modules racines de la table CHARGEURS =====

// Tous les fichiers JavaScript d'un dossier, sous-dossiers compris.
function fichiersJs(dossier) {
  return readdirSync(dossier, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? fichiersJs(resolve(dossier, e.name)) : e.name.endsWith(".js") ? [resolve(dossier, e.name)] : []));
}

test("cours-blocs.js se charge sous Node (aucun DOM à l'import) et garde ses exports", async () => {
  const blocs = await import("../js/cours-blocs.js");
  assert.equal(typeof blocs.rendreBlocInteractif, "function");
  assert.equal(typeof blocs.detruireScenes, "function");
  assert.equal(typeof blocs.chargerModule, "function");
  await assert.rejects(blocs.chargerModule("absent"), /Module de blocs inconnu : absent/);
});

test("aucun module n'importe statiquement un module racine de CHARGEURS : une reprise en évalue une seconde copie, qui n'a le droit d'être ni utilisée ni dédoublée", () => {
  const src = readFileSync("js/cours-blocs.js", "utf8");
  const racines = [...new Set([...src.matchAll(/importer\(essai, "(\.\/[a-z-]+\.js)"/g)].map((m) => resolve("js", m[1])))];
  assert.ok(racines.length >= MODULES_BLOCS.length + 1, "les modules racines de la table sont lus");
  const fautes = [];
  for (const f of fichiersJs(resolve("js"))) {
    for (const spec of importsStatiques(f)) {
      if (!spec.startsWith(".")) continue;
      const cible = resolve(dirname(f), spec.split("?")[0]);
      if (racines.includes(cible)) fautes.push(`${relative(resolve("."), f).replace(/\\/g, "/")} importe ${basename(cible)}`);
    }
  }
  assert.deepEqual(fautes, []);
});
