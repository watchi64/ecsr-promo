import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  appliquerHabillage, choisirHabillage, habillageAuDemarrage, habillageCourant,
} from "../js/habillage.js";
import { CLE_APPAREIL, lireAppareil } from "../js/habillage-regles.js";

// --- Faux environnement ---------------------------------------------------------------------

function fauxStockage(initial = {}, { leve = false } = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem(k) { if (leve) throw new Error("bloqué"); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (leve) throw new Error("bloqué"); m.set(k, String(v)); },
    brut: m,
  };
}
function fauxDocument() {
  const meta = { contenu: "#depart", setAttribute(n, v) { if (n === "content") this.contenu = v; } };
  return {
    documentElement: { dataset: {} },
    querySelector: (s) => (s === 'meta[name="theme-color"]' ? meta : null),
    meta,
  };
}
// Couleur de la barre d'état : celle d'un jeton CSS, simulée d'après l'attribut posé.
const barre = (doc) => ({
  getPropertyValue: (n) => (n === "--barre-etat" ? (doc.documentElement.dataset.skin === "ecf" ? " BARRE-ECF " : "BARRE-ECSR") : ""),
});
function env(initial = {}, opts = {}) {
  const doc = fauxDocument();
  const evenements = [];
  const appels = [];
  return {
    doc, evenements, appels,
    deps: {
      stockage: fauxStockage(initial, opts.stockage),
      document: doc,
      styleCalcule: () => barre(doc),
      fenetre: { dispatchEvent: (e) => evenements.push(e.detail.nom) },
      email: opts.email ?? "A@x.fr",
      enregistrer: async (nom) => { appels.push(nom); if (opts.echec) throw new Error("réseau"); return nom; },
    },
  };
}
const appareilDe = (e) => lireAppareil(e.deps.stockage.brut.get(CLE_APPAREIL));

// --- Script d'avant-peinture ----------------------------------------------------------------

const SCRIPT = fs.readFileSync(new URL("../js/habillage-avant-peinture.js", import.meta.url), "utf8");
function jouerAvantPeinture(stockage, { styleLeve = false } = {}) {
  const doc = fauxDocument();
  const contexte = {
    localStorage: stockage, document: doc,
    getComputedStyle: () => { if (styleLeve) throw new Error("pas de style"); return barre(doc); },
  };
  vm.runInNewContext(SCRIPT, contexte);
  return doc;
}

test("avant-peinture : ce que l'appareil a retenu est posé, avec la couleur de la barre d'état", () => {
  const ecf = jouerAvantPeinture(fauxStockage({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A","aEnvoyer":false,"choisi":false}' }));
  assert.equal(ecf.documentElement.dataset.skin, "ecf");
  assert.equal(ecf.meta.contenu, "BARRE-ECF");
  const ecsr = jouerAvantPeinture(fauxStockage({ [CLE_APPAREIL]: '{"nom":"ecsr"}' }));
  assert.equal(ecsr.documentElement.dataset.skin, "ecsr");
  assert.equal(ecsr.meta.contenu, "BARRE-ECSR");
});

test("avant-peinture : vide, illisible, inconnu ou stockage qui lève : ecsr, sans exception", () => {
  for (const brut of [null, "", "{", '"ecf"', "[]", '{"nom":"sombre"}', '{"nom":"ECF"}']) {
    const doc = jouerAvantPeinture(fauxStockage(brut === null ? {} : { [CLE_APPAREIL]: brut }));
    assert.equal(doc.documentElement.dataset.skin, "ecsr", String(brut));
    assert.equal(doc.meta.contenu, "BARRE-ECSR");
  }
  const doc = jouerAvantPeinture(fauxStockage({}, { leve: true }));
  assert.equal(doc.documentElement.dataset.skin, "ecsr");
});

test("avant-peinture : si le style ne se lit pas, l'attribut est posé et la page s'ouvre", () => {
  const doc = jouerAvantPeinture(fauxStockage({ [CLE_APPAREIL]: '{"nom":"ecf"}' }), { styleLeve: true });
  assert.equal(doc.documentElement.dataset.skin, "ecf");
  assert.equal(doc.meta.contenu, "#depart");
});

// --- appliquer, courant ---------------------------------------------------------------------

test("appliquerHabillage : attribut, theme-color, événement", () => {
  const e = env();
  appliquerHabillage("ecf", e.deps);
  assert.equal(habillageCourant(e.deps), "ecf");
  assert.equal(e.doc.meta.contenu, "BARRE-ECF");
  assert.deepEqual(e.evenements, ["ecf"]);
  appliquerHabillage("ecsr", e.deps);
  assert.equal(habillageCourant(e.deps), "ecsr");
  assert.equal(e.doc.meta.contenu, "BARRE-ECSR");
});

// --- choisir --------------------------------------------------------------------------------

test("choisirHabillage ecf : appliqué, gardé, enregistré, puis plus rien à envoyer", async () => {
  const e = env();
  assert.deepEqual(await choisirHabillage("ecf", e.deps), { nom: "ecf", enregistre: true });
  assert.equal(habillageCourant(e.deps), "ecf");
  assert.deepEqual(e.appels, ["ecf"]);
  assert.deepEqual(appareilDe(e), { nom: "ecf", email: "A@x.fr", aEnvoyer: false, choisi: true });
});

test("choisirHabillage : l'enregistrement échoue, le choix reste appliqué et à envoyer, sans exception", async () => {
  const e = env({}, { echec: true });
  const avertissements = [];
  const avant = console.warn;
  console.warn = (...a) => avertissements.push(a);
  try {
    assert.deepEqual(await choisirHabillage("ecf", e.deps), { nom: "ecf", enregistre: false });
  } finally { console.warn = avant; }
  assert.equal(habillageCourant(e.deps), "ecf");
  assert.deepEqual(appareilDe(e), { nom: "ecf", email: "A@x.fr", aEnvoyer: true, choisi: true });
  assert.equal(avertissements.length, 1);
});

test("choisirHabillage : nom invalide, null et rien ne change", async () => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecsr","email":"A@x.fr"}' });
  const avant = e.deps.stockage.brut.get(CLE_APPAREIL);
  assert.equal(await choisirHabillage("violet", e.deps), null);
  assert.equal(await choisirHabillage(null, e.deps), null);
  assert.equal(e.deps.stockage.brut.get(CLE_APPAREIL), avant);
  assert.equal(e.doc.documentElement.dataset.skin, undefined);
  assert.deepEqual(e.appels, []);
  assert.deepEqual(e.evenements, []);
});

test("choisirHabillage : un stockage bloqué n'empêche ni l'application ni l'enregistrement", async () => {
  const e = env({}, { stockage: { leve: true } });
  assert.deepEqual(await choisirHabillage("ecf", e.deps), { nom: "ecf", enregistre: true });
  assert.equal(habillageCourant(e.deps), "ecf");
});

// --- démarrage ------------------------------------------------------------------------------

test("démarrage : l'appareil d'une autre personne est ignoré et rien n'est envoyé", async () => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"B@x.fr","aEnvoyer":true,"choisi":true}' });
  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: null }, e.deps), "ecsr");
  assert.deepEqual(e.appels, []);
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: false });
});

test("démarrage : un choix en attente part une fois, puis l'appareil ne le redemande plus", async () => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":true,"choisi":true}' });
  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: "ecsr" }, e.deps), "ecf");
  assert.deepEqual(e.appels, ["ecf"]);
  assert.deepEqual(appareilDe(e), { nom: "ecf", email: "A@x.fr", aEnvoyer: false, choisi: true });
  await habillageAuDemarrage({ email: "A@x.fr", compte: "ecf" }, e.deps);
  assert.deepEqual(e.appels, ["ecf"]);
});

test("démarrage : un envoi qui échoue laisse le choix à envoyer", async () => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":true,"choisi":true}' }, { echec: true });
  const avant = console.warn;
  console.warn = () => {};
  try { await habillageAuDemarrage({ email: "A@x.fr", compte: null }, e.deps); } finally { console.warn = avant; }
  assert.deepEqual(appareilDe(e), { nom: "ecf", email: "A@x.fr", aEnvoyer: true, choisi: true });
});

test("démarrage : le compte l'emporte sur un appareil déjà envoyé", async () => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":false,"choisi":true}' });
  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: "ecsr" }, e.deps), "ecsr");
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: true });
  assert.deepEqual(e.appels, []);
});

test("trois démarrages sur un appareil vierge : défaut, puis centre ecf, puis centre ecsr suivi, rien envoyé", async () => {
  const e = env();
  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: null }, e.deps), "ecsr");
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: false });

  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: null, centre: "ecf" }, e.deps), "ecf");
  assert.equal(habillageCourant(e.deps), "ecf");
  // L'avant-peinture reprend ce nom sans éclair, mais ce n'est pas un choix de la personne.
  assert.deepEqual(appareilDe(e), { nom: "ecf", email: "A@x.fr", aEnvoyer: false, choisi: false });
  assert.equal(jouerAvantPeinture(e.deps.stockage).documentElement.dataset.skin, "ecf");

  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: null, centre: "ecsr" }, e.deps), "ecsr");
  assert.equal(habillageCourant(e.deps), "ecsr");
  assert.deepEqual(e.appels, []);
});

test("démarrage : un choix fait pendant un envoi lent n'est pas écrasé par le démarrage", async () => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":true,"choisi":true}' });
  // Le premier envoi (celui du démarrage) ne revient qu'une fois le choix fait ; les suivants tout de suite.
  let liberer;
  const lent = new Promise((r) => { liberer = r; });
  let premier = true;
  e.deps.enregistrer = async (nom) => {
    e.appels.push(nom);
    if (premier) { premier = false; await lent; }
    return nom;
  };
  const demarrage = habillageAuDemarrage({ email: "A@x.fr", compte: null }, e.deps);
  await new Promise((r) => setImmediate(r));   // le démarrage attend son envoi
  assert.deepEqual(e.appels, ["ecf"]);
  assert.deepEqual(await choisirHabillage("ecsr", e.deps), { nom: "ecsr", enregistre: true });
  liberer();
  assert.equal(await demarrage, "ecf");
  assert.equal(habillageCourant(e.deps), "ecsr");
  assert.deepEqual(e.appels, ["ecf", "ecsr"]);
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: true });
});

test("démarrage : un choix fait pendant un envoi qui échoue n'est pas écrasé non plus", async () => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":true,"choisi":true}' });
  let liberer;
  const lent = new Promise((r) => { liberer = r; });
  let premier = true;
  e.deps.enregistrer = async (nom) => {
    e.appels.push(nom);
    if (premier) { premier = false; await lent; throw new Error("réseau"); }
    return nom;
  };
  const avant = console.warn;
  console.warn = () => {};
  try {
    const demarrage = habillageAuDemarrage({ email: "A@x.fr", compte: null }, e.deps);
    await new Promise((r) => setImmediate(r));
    await choisirHabillage("ecsr", e.deps);
    liberer();
    await demarrage;
  } finally { console.warn = avant; }
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: true });
});

test("démarrage : sans stockage, l'habillage est quand même appliqué", async () => {
  const e = env({}, { stockage: { leve: true } });
  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: "ecf" }, e.deps), "ecf");
  assert.equal(habillageCourant(e.deps), "ecf");
});
