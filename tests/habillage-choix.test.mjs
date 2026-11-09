import test from "node:test";
import assert from "node:assert/strict";
import { ElementFactice, NoeudFactice, descendants, installerDocument } from "./aides-dom.mjs";
import { blocHabillage } from "../js/habillage-choix.js";
import { CLE_APPAREIL, lireAppareil } from "../js/habillage-regles.js";

// Lot 3, tâche 11 (fix round 1) : les deux pastilles d'Apparence sur un DOM factice. Toucher la pastille déjà pressée ne fait
// rien : ni envoi, ni message, ni choix personnel (un habillage appliqué sans avoir été choisi, le défaut, celui du centre ou
// l'appareil d'une autre personne, ne devient pas un choix par ce toucher), et le focus reste où il était. L'autre pastille
// choisit, garde le focus, confirme, et les deux pastilles suivent l'habillage appliqué.

async function avecBloc(corps, { skin = "ecsr", appareil = null } = {}) {
  const dom = installerDocument();
  const avant = ["Node", "window"].map((nom) => [nom, Object.getOwnPropertyDescriptor(globalThis, nom)]);
  const ecouteurs = [];
  const window_ = {
    addEventListener: (type, f) => ecouteurs.push([type, f]),
    dispatchEvent: (ev) => { for (const [type, f] of ecouteurs) if (type === ev.type) f(ev); return true; },
  };
  const racine = dom.conteneur();
  Object.assign(dom.doc, {
    documentElement: { dataset: { skin } },
    activeElement: null,
    getElementById: () => null,   // pas de zone de message : le vrai toast n'affiche rien
    querySelector: () => null,
    // Le faux DOM ne lit pas les sélecteurs : il honore seulement l'exclusion des pastilles d'un réglage (mode réglage, lot 5).
    querySelectorAll: (sel) => descendants(racine).filter((x) => x instanceof ElementFactice && x.classes.has("habillage-pastille")
      && !(String(sel).includes(":not([data-reglage])") && x.getAttribute("data-reglage") != null)),
  });
  ElementFactice.prototype.focus = function () { document.activeElement = this; };
  Object.defineProperty(globalThis, "Node", { value: NoeudFactice, configurable: true, writable: true });
  Object.defineProperty(globalThis, "window", { value: window_, configurable: true, writable: true });
  const stockage = new Map(appareil ? [[CLE_APPAREIL, appareil]] : []);
  const t = {
    racine, envois: [], messages: [], stockage,
    deps: {
      stockage: { getItem: (k) => (stockage.has(k) ? stockage.get(k) : null), setItem: (k, v) => stockage.set(k, String(v)) },
      styleCalcule: () => ({ getPropertyValue: () => "" }),
      email: "A@x.fr",
      enregistrer: async (nom) => { t.envois.push(nom); return nom; },
      toast: (m) => t.messages.push(m),
    },
  };
  try {
    return await corps(t);
  } finally {
    delete ElementFactice.prototype.focus;
    for (const [nom, d] of avant) { if (d) Object.defineProperty(globalThis, nom, d); else delete globalThis[nom]; }
    dom.restaurer();
  }
}

const pastilles = (bloc) => descendants(bloc).filter((x) => x instanceof ElementFactice && x.classes.has("habillage-pastille"));
const de = (bloc, nom) => pastilles(bloc).find((b) => b.getAttribute("data-habillage") === nom);
const pressees = (bloc) => pastilles(bloc).filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-habillage"));
const tick = () => new Promise((r) => setImmediate(r));

test("pastille déjà pressée : rien ne part, aucun message, le choix n'est pas fait, le focus ne bouge pas", async () => {
  // L'appareil retient le défaut, appliqué sans avoir été choisi.
  await avecBloc(async (t) => {
    const bloc = blocHabillage({ deps: t.deps });
    t.racine.appendChild(bloc);
    assert.deepEqual(pressees(bloc), ["ecsr"]);
    const avant = t.stockage.get(CLE_APPAREIL);
    de(bloc, "ecsr").click();
    await tick();
    assert.deepEqual(t.envois, []);
    assert.deepEqual(t.messages, []);
    assert.equal(t.stockage.get(CLE_APPAREIL), avant);
    assert.equal(lireAppareil(t.stockage.get(CLE_APPAREIL)).choisi, false);
    assert.equal(document.activeElement, null);
    assert.equal(document.documentElement.dataset.skin, "ecsr");
    assert.deepEqual(pressees(bloc), ["ecsr"]);
  }, { appareil: '{"nom":"ecsr","email":"A@x.fr","aEnvoyer":false,"choisi":false}' });
});

test("pastille déjà pressée en Couleurs ECF venues d'ailleurs : rien ne part non plus", async () => {
  await avecBloc(async (t) => {
    const bloc = blocHabillage({ deps: t.deps });
    t.racine.appendChild(bloc);
    de(bloc, "ecf").click();
    await tick();
    assert.deepEqual([t.envois, t.messages], [[], []]);
    assert.equal(lireAppareil(t.stockage.get(CLE_APPAREIL)).choisi, false);
  }, { skin: "ecf", appareil: '{"nom":"ecf","email":"A@x.fr","aEnvoyer":false,"choisi":false}' });
});

test("l'autre pastille : choisie, envoyée, confirmée, focus gardé, les deux pastilles suivent", async () => {
  await avecBloc(async (t) => {
    const bloc = blocHabillage({ deps: t.deps });
    const autre = blocHabillage({ deps: t.deps });   // le même choix, ailleurs (menu du compte et page)
    t.racine.append(bloc, autre);
    de(bloc, "ecf").click();
    await tick();
    assert.equal(document.documentElement.dataset.skin, "ecf");
    assert.deepEqual(t.envois, ["ecf"]);
    assert.deepEqual(t.messages, ["Couleurs ECF appliquées"]);
    assert.equal(document.activeElement, de(bloc, "ecf"));
    assert.deepEqual([pressees(bloc), pressees(autre)], [["ecf"], ["ecf"]]);
    assert.deepEqual(lireAppareil(t.stockage.get(CLE_APPAREIL)), { nom: "ecf", email: "A@x.fr", aEnvoyer: false, choisi: true });
    de(autre, "ecsr").click();
    await tick();
    assert.deepEqual(t.messages, ["Couleurs ECF appliquées", "Habillage ECSR Promo appliqué"]);
    assert.deepEqual([pressees(bloc), pressees(autre)], [["ecsr"], ["ecsr"]]);
  });
});

test("le groupe est nommé par son titre : le sien, ou celui de la section qui le porte", async () => {
  await avecBloc((t) => {
    const bloc = blocHabillage({ deps: t.deps });
    assert.equal(bloc.getAttribute("role"), "group");
    const titre = descendants(bloc).find((x) => x instanceof ElementFactice && x.classes.has("habillage-titre"));
    assert.equal(titre.textContent, "Apparence");
    assert.equal(bloc.getAttribute("aria-labelledby"), titre.getAttribute("id") ?? titre.id);
    const h3 = document.createElement("h3");
    h3.textContent = "Apparence";
    const nomme = blocHabillage({ titre: h3, deps: t.deps });
    assert.equal(nomme.getAttribute("aria-labelledby"), h3.id);
    assert.ok(!descendants(nomme).includes(h3), "le titre de la section n'est pas recopié dans le groupe");
    const ligne = (b, classe) => descendants(b).find((x) => x instanceof ElementFactice && x.classes.has(classe))?.textContent;
    assert.deepEqual(pastilles(nomme).map((b) => [b.getAttribute("type"), ligne(b, "habillage-libelle"), ligne(b, "habillage-legende")]),
      [["button", "ECSR Promo", "d'origine"], ["button", "Couleurs ECF", "du réseau ECF"]]);
  });
});

// Lot 5, Task 14 : le même bloc en mode réglage (Réglages du centre et du réseau) : une valeur tenue ailleurs, rien n'est appliqué à
// l'écran, gardé sur l'appareil ni envoyé au compte.

test("mode réglage : la pastille en vigueur est pressée, un toucher appelle surChoix et rien d'autre ne bouge", async () => {
  await avecBloc(async (t) => {
    const appels = [];
    const bloc = blocHabillage({ deps: t.deps, reglage: { courant: "ecf", surChoix: async (nom) => { appels.push(nom); return true; } } });
    t.racine.appendChild(bloc);
    assert.deepEqual(pressees(bloc), ["ecf"], "l'habillage de l'écran (ecsr) n'est pas celui du réglage");
    de(bloc, "ecf").click();
    await tick();
    assert.deepEqual(appels, [], "la pastille en vigueur ne fait rien");
    de(bloc, "ecsr").click();
    await tick();
    assert.deepEqual(appels, ["ecsr"]);
    assert.deepEqual(pressees(bloc), ["ecsr"]);
    assert.equal(document.documentElement.dataset.skin, "ecsr", "l'écran de la personne n'est pas touché");
    assert.deepEqual(t.envois, []);
    assert.deepEqual(t.messages, []);
    assert.equal(t.stockage.has(CLE_APPAREIL), false, "rien n'est gardé sur l'appareil");
    assert.equal(de(bloc, "ecf").getAttribute("data-reglage"), "");
  });
});

test("mode réglage : un choix refusé (faux ou exception) revient à la pastille d'avant ; nul : aucune pastille pressée", async () => {
  await avecBloc(async (t) => {
    for (const surChoix of [async () => false, async () => { throw new Error("refus"); }]) {
      const bloc = blocHabillage({ deps: t.deps, reglage: { courant: null, surChoix } });
      t.racine.appendChild(bloc);
      assert.deepEqual(pressees(bloc), []);
      de(bloc, "ecf").click();
      await tick();
      assert.deepEqual(pressees(bloc), [], "le choix refusé n'est pas resté");
    }
    const bloc = blocHabillage({ deps: t.deps, reglage: { courant: "ecsr", surChoix: async () => true } });
    t.racine.appendChild(bloc);
    bloc.poserChoix(null);
    assert.deepEqual(pressees(bloc), []);
    bloc.poserChoix("ecf");
    assert.deepEqual(pressees(bloc), ["ecf"]);
  });
});

test("mode réglage : un habillage appliqué à l'écran ne déplace pas les pastilles d'un réglage", async () => {
  await avecBloc(async (t) => {
    const reglage = blocHabillage({ deps: t.deps, reglage: { courant: "ecsr", surChoix: async () => true } });
    const perso = blocHabillage({ deps: t.deps });
    t.racine.appendChild(reglage);
    t.racine.appendChild(perso);
    globalThis.window.dispatchEvent({ type: "ecsr:habillage", detail: { nom: "ecf" } });
    assert.deepEqual(pressees(reglage), ["ecsr"]);
  });
});
