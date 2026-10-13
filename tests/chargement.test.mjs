import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { creerChargeur, montageDiffere, adresseDeReprise } from "../js/cours-blocs-rules.js";
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
    .filter((n) => /^(scenes|scene-[a-z]+|lecteur-anime|geste-moteur|geste-regles|animation-courbes|dessin-svg|dessins-[a-z]+)\.js$/.test(n));
  assert.deepEqual(lourds, []);
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
