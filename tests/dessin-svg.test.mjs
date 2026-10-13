import { test } from "node:test";
import assert from "node:assert/strict";
import { n, ecrireValeur, versChaine, trouverRole, trouverTous, texteDe, mettreAJour, versDom } from "../js/dessin-svg.js";

test("n : enfants aplatis, valeurs nulles ignorées", () => {
  const x = n("g", { "data-r": "a" }, [n("rect", {}), null, false, [n("circle", {})]], "texte");
  assert.equal(x.enfants.length, 3);
  assert.equal(texteDe(x), "texte");
});

test("ecrireValeur : trois décimales au plus, jamais NaN", () => {
  assert.equal(ecrireValeur(12), "12");
  assert.equal(ecrireValeur(3.14159), "3.142");
  assert.equal(ecrireValeur("rouge"), "rouge");
  assert.throws(() => ecrireValeur(NaN), /non finie/);
});

test("versChaine : espace de noms sur la racine, échappement du texte", () => {
  const s = versChaine(n("svg", { viewBox: "0 0 10 10" }, n("text", { x: 1, y: 2 }, "a < b & c")));
  assert.equal(s, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="2">a &lt; b &amp; c</text></svg>');
});

test("trouverRole et trouverTous", () => {
  const d = n("svg", {}, n("g", { "data-r": "main-gauche" }, n("rect", { "data-r": "pouce-gauche" })));
  assert.equal(trouverRole(d, "pouce-gauche").balise, "rect");
  assert.equal(trouverRole(d, "absent"), null);
  assert.equal(trouverTous(d, (x) => x.balise === "rect").length, 1);
});

test("mettreAJour refuse une structure changée", () => {
  const faux = { setAttribute() {}, removeAttribute() {}, childNodes: [] };
  assert.throws(() => mettreAJour(faux, n("g", {}), n("rect", {})), /Structure du dessin changée/);
  assert.throws(() => mettreAJour(faux, n("g", {}, n("rect", {})), n("g", {})), /Structure du dessin changée/);
});

test("mettreAJour : seuls les attributs changés sont écrits, les retirés supprimés, les textes changés ; mêmes nœuds", () => {
  // Document minimal : il compte les écritures d'attributs.
  const doc = {
    createElementNS: (ns, balise) => ({ ns, balise, attributs: {}, ecritures: 0, childNodes: [],
      setAttribute(k, v) { this.attributs[k] = v; this.ecritures++; },
      removeAttribute(k) { delete this.attributs[k]; },
      appendChild(e) { this.childNodes.push(e); return e; } }),
    createTextNode: (t) => ({ nodeValue: t }),
  };
  const ancien = n("g", { "data-r": "main", transform: "translate(1 2)", fill: "red" },
    n("circle", { cx: 1, r: 2 }), n("text", { x: 0 }, "9 h"));
  const nouveau = n("g", { "data-r": "main", transform: "translate(3 4)" },
    n("circle", { cx: 1.0001, r: 2 }), n("text", { x: 0 }, "3 h"));
  const dom = versDom(ancien, doc);
  assert.equal(dom.ns, "http://www.w3.org/2000/svg");
  const [cercle, texte] = dom.childNodes;
  const ecritures = cercle.ecritures;
  mettreAJour(dom, ancien, nouveau);
  assert.equal(dom.attributs.transform, "translate(3 4)");
  assert.equal("fill" in dom.attributs, false);
  assert.equal(dom.childNodes[0], cercle);
  assert.equal(cercle.ecritures, ecritures, "cx s'écrit « 1 » dans les deux images : rien à réécrire");
  assert.equal(texte.childNodes[0].nodeValue, "3 h");
});
