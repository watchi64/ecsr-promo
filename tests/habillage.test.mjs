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

test("démarrage : un choix fait pendant un envoi lent n'est pas écrasé par le démarrage", async (t) => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":true,"choisi":true}' });
  // Le premier envoi (celui du démarrage) ne revient qu'une fois le choix fait ; les suivants tout de suite.
  let liberer;
  const lent = new Promise((r) => { liberer = r; });
  // Une assertion cassée avant la libération ne doit pas laisser la file d'envois pendue : la suite échoue au lieu de pendre.
  t.after(() => liberer());
  let premier = true;
  e.deps.enregistrer = async (nom) => {
    e.appels.push(nom);
    if (premier) { premier = false; await lent; }
    return nom;
  };
  const demarrage = habillageAuDemarrage({ email: "A@x.fr", compte: null }, e.deps);
  await new Promise((r) => setImmediate(r));   // le démarrage attend son envoi
  assert.deepEqual(e.appels, ["ecf"]);
  // Le choix est fait (appliqué, appareil écrit) ; son envoi part derrière celui du démarrage (fix round 1).
  const choix = choisirHabillage("ecsr", e.deps);
  await new Promise((r) => setImmediate(r));
  assert.equal(habillageCourant(e.deps), "ecsr");
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: true, choisi: true });
  liberer();
  assert.deepEqual(await choix, { nom: "ecsr", enregistre: true });
  assert.equal(await demarrage, "ecf");
  assert.equal(habillageCourant(e.deps), "ecsr");
  assert.deepEqual(e.appels, ["ecf", "ecsr"]);
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: true });
});

test("démarrage : un choix fait pendant un envoi qui échoue n'est pas écrasé non plus", async (t) => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":true,"choisi":true}' });
  let liberer;
  const lent = new Promise((r) => { liberer = r; });
  // Une assertion cassée avant la libération ne doit pas laisser la file d'envois pendue : la suite échoue au lieu de pendre.
  t.after(() => liberer());
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
    const choix = choisirHabillage("ecsr", e.deps);
    await new Promise((r) => setImmediate(r));
    liberer();
    await Promise.all([choix, demarrage]);
  } finally { console.warn = avant; }
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: true });
});

test("démarrage : sans stockage, l'habillage est quand même appliqué", async () => {
  const e = env({}, { stockage: { leve: true } });
  assert.equal(await habillageAuDemarrage({ email: "A@x.fr", compte: "ecf" }, e.deps), "ecf");
  assert.equal(habillageCourant(e.deps), "ecf");
});

// --- Touchers rapprochés (fix round 1 de la tâche 11) ---------------------------------------
// Deux pastilles non attendues : deux touchers peuvent partir dans le temps d'un aller-retour. Les envois sont pilotés à la main :
// chacun attend que le test le libère, réussi ou en échec ; `compte` est ce que le compte détient, dans l'ordre où les envois
// aboutissent. `toutLiberer` libère toujours l'envoi en cours le plus récent d'abord (le pire ordre de réponse possible).

const tick = () => new Promise((r) => setImmediate(r));
function envoisPilotes(e, echecs = []) {
  const p = { enCours: [], compte: null, demandes: 0 };
  e.deps.enregistrer = (nom) => new Promise((ok, ko) => {
    const i = p.demandes++;
    e.appels.push(nom);
    p.enCours.push({ i, ok: () => { p.compte = nom; ok(nom); }, ko: () => ko(new Error("réseau")) });
  });
  p.toutLiberer = async () => {
    for (let n = 0; n < 200; n++) {
      await tick();
      const envoi = p.enCours.pop();
      if (!envoi) { if (n > 20 && p.enCours.length === 0) break; continue; }
      (echecs.includes(envoi.i) ? envoi.ko : envoi.ok)();
    }
  };
  return p;
}
async function sansAvertissement(f) {
  const avant = console.warn;
  console.warn = () => {};
  try { return await f(); } finally { console.warn = avant; }
}

test("deux touchers : le premier envoi réussit tard, le second échoue : le second reste choisi et à envoyer", async () => {
  const e = env();
  const p = envoisPilotes(e, [1]);
  await sansAvertissement(async () => {
    const a = choisirHabillage("ecf", e.deps);
    await tick();
    const b = choisirHabillage("ecsr", e.deps);
    await p.toutLiberer();
    await Promise.all([a, b]);
  });
  assert.equal(habillageCourant(e.deps), "ecsr");
  assert.deepEqual(e.appels, ["ecf", "ecsr"]);
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: true, choisi: true });
});

test("deux touchers qui réussissent : le compte les reçoit dans l'ordre, l'appareil garde le dernier, plus rien à envoyer", async () => {
  const e = env();
  const p = envoisPilotes(e);
  const a = choisirHabillage("ecf", e.deps);
  await tick();
  const b = choisirHabillage("ecsr", e.deps);
  await p.toutLiberer();
  assert.deepEqual(await Promise.all([a, b]), [{ nom: "ecf", enregistre: true }, { nom: "ecsr", enregistre: true }]);
  assert.equal(habillageCourant(e.deps), "ecsr");
  assert.equal(p.compte, "ecsr");
  assert.deepEqual(appareilDe(e), { nom: "ecsr", email: "A@x.fr", aEnvoyer: false, choisi: true });
});

test("envoi du démarrage en cours, puis deux touchers dont le dernier échoue : le dernier reste choisi et à envoyer", async (t) => {
  const e = env({ [CLE_APPAREIL]: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":true,"choisi":true}' });
  // Dans l'ordre : le démarrage aboutit, puis « ECSR Promo », puis « Couleurs ECF » échoue.
  const p = { enCours: [] };
  e.deps.enregistrer = (nom) => new Promise((ok, ko) => { e.appels.push(nom); p.enCours.push({ ok: () => ok(nom), ko: () => ko(new Error("réseau")) }); });
  t.after(() => p.enCours.forEach((x) => x.ok()));   // rien ne reste pendu si une assertion casse
  const liberer = async (i, reussi) => {
    for (let n = 0; n < 50 && !p.enCours[i]; n++) await tick();
    assert.ok(p.enCours[i], `l'envoi ${i} n'est jamais parti`);
    (reussi ? p.enCours[i].ok : p.enCours[i].ko)();
    await tick();
  };
  await sansAvertissement(async () => {
    const d = habillageAuDemarrage({ email: "A@x.fr", compte: null }, e.deps);
    await tick();
    const y = choisirHabillage("ecsr", e.deps);
    await tick();
    const x = choisirHabillage("ecf", e.deps);
    await tick();
    await liberer(0, true);
    await liberer(1, true);
    await liberer(2, false);
    await Promise.all([d, y, x]);
  });
  assert.equal(habillageCourant(e.deps), "ecf");
  assert.deepEqual(e.appels, ["ecf", "ecsr", "ecf"]);
  assert.deepEqual(appareilDe(e), { nom: "ecf", email: "A@x.fr", aEnvoyer: true, choisi: true });
});

test("les envois partent un par un : un toucher n'envoie qu'une fois l'envoi précédent revenu", async () => {
  const e = env();
  const p = envoisPilotes(e);
  const a = choisirHabillage("ecf", e.deps);
  await tick();
  const b = choisirHabillage("ecsr", e.deps);
  await tick();
  assert.equal(p.enCours.length, 1, "le second envoi attend le premier");
  await p.toutLiberer();
  await Promise.all([a, b]);
});
