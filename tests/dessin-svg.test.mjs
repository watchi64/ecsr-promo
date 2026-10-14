import { test } from "node:test";
import assert from "node:assert/strict";
import { n, ecrireValeur, versChaine, trouverRole, trouverTous, texteDe, mettreAJour, versDom, problemeMiseAJour } from "../js/dessin-svg.js";

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


// Document minimal pour versDom et mettreAJour : il compte les écritures d'attributs de chaque élément.
const docFactice = () => ({
  createElementNS: (ns, balise) => ({ ns, balise, attributs: {}, ecritures: 0, childNodes: [],
    setAttribute(k, v) { this.attributs[k] = v; this.ecritures++; },
    removeAttribute(k) { delete this.attributs[k]; },
    appendChild(e) { this.childNodes.push(e); return e; } }),
  createTextNode: (t) => ({ nodeValue: t }),
});

test("mettreAJour : seuls les attributs changés sont écrits, les retirés supprimés, les textes changés ; mêmes nœuds", () => {
  const ancien = n("g", { "data-r": "main", transform: "translate(1 2)", fill: "red" },
    n("circle", { cx: 1, r: 2 }), n("text", { x: 0 }, "9 h"));
  const nouveau = n("g", { "data-r": "main", transform: "translate(3 4)" },
    n("circle", { cx: 1.0001, r: 2 }), n("text", { x: 0 }, "3 h"));
  const dom = versDom(ancien, docFactice());
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

test("mettreAJour : une structure changée en profondeur est refusée avant toute écriture", () => {
  const ancien = n("svg", { viewBox: "0 0 10 10" }, n("g", { transform: "translate(1 1)" }, n("rect", {}), n("circle", {})));
  const nouveau = n("svg", { viewBox: "0 0 20 20" }, n("g", { transform: "translate(2 2)" }, n("rect", {}), n("rect", {})));
  const dom = versDom(ancien, docFactice());
  const groupe = dom.childNodes[0];
  const avant = [dom.ecritures, groupe.ecritures];
  assert.throws(() => mettreAJour(dom, ancien, nouveau), /Structure du dessin changée/);
  assert.deepEqual([dom.ecritures, groupe.ecritures], avant, "aucun attribut écrit avant le refus");
  assert.equal(dom.attributs.viewBox, "0 0 10 10");
});

test("mettreAJour : une valeur fautive, même en profondeur, est refusée avant toute écriture, et dite avec sa place", () => {
  const ancien = n("g", { transform: "translate(0 0)" }, n("circle", { cx: 1 }));
  const nouveau = n("g", { transform: "translate(5 5)" }, n("circle", { cx: NaN }));
  const dom = versDom(ancien, docFactice());
  assert.throws(() => mettreAJour(dom, ancien, nouveau), /non finie.*circle.*cx/);
  assert.equal(dom.attributs.transform, "translate(0 0)");
  assert.equal(dom.ecritures, 1, "seule l'écriture de versDom");
});

test("n : attributs copiés ; un objet d'attributs réutilisé et modifié d'une image à l'autre est bien écrit", () => {
  const attributs = { cx: 1, r: 2 };
  const image1 = n("circle", attributs);
  attributs.cx = 5;
  const image2 = n("circle", attributs);
  assert.equal(image1.attributs.cx, 1);
  const dom = versDom(image1, docFactice());
  mettreAJour(dom, image1, image2);
  assert.equal(dom.attributs.cx, "5");
});

test("n : un nombre devient du texte ; un nombre non fini ou un enfant inconnu est une erreur dite comme telle", () => {
  assert.deepEqual(n("text", {}, 90).enfants, ["90"]);
  assert.equal(texteDe(n("text", {}, 25, " cm")), "25 cm");
  assert.throws(() => n("text", {}, NaN), /non fini/);
  assert.throws(() => n("text", {}, Infinity), /non fini/);
  assert.throws(() => n("g", {}, true), /Enfant de dessin invalide/);
  assert.throws(() => n("g", {}, { x: 1 }), /Enfant de dessin invalide/);
});

test("ecrireValeur : une valeur absente (null, undefined) est une erreur", () => {
  assert.throws(() => ecrireValeur(null), /Valeur d'attribut absente/);
  assert.throws(() => ecrireValeur(undefined), /Valeur d'attribut absente/);
  assert.throws(() => versDom(n("rect", { width: null }), docFactice()), /Valeur d'attribut absente/);
});

test("problemeMiseAJour : le refus exact que mettreAJour opposerait, sans rien écrire ; null quand la mise à jour s'écrirait", () => {
  const base = () => n("svg", { viewBox: "0 0 10 10" }, n("circle", { cx: 1, r: 2 }), n("g", { display: "none" }, n("text", { x: 0 }, "9 h")));
  // Des mises à jour qui s'écrivent : valeurs changées, attribut ajouté ou retiré, texte changé, rien de changé.
  const bonne = n("svg", { viewBox: "0 0 10 10", fill: "red" }, n("circle", { cx: 5.5, r: 3 }), n("g", {}, n("text", { x: 4 }, "3 h")));
  assert.equal(problemeMiseAJour(base(), bonne), null);
  assert.equal(problemeMiseAJour(base(), base()), null);
  // Chaque faute : un message, qui est mot pour mot celui de l'erreur de mettreAJour (c'est sa propre vérification).
  const sous = (...enfants) => n("svg", { viewBox: "0 0 10 10" }, ...enfants);
  const texte = n("g", { display: "none" }, n("text", { x: 0 }, "9 h"));
  const fautes = {
    "balise changée": sous(n("rect", {}), texte),
    "enfant en trop": sous(n("circle", { cx: 1, r: 2 }), texte, n("rect", {})),
    "enfant en moins": sous(n("circle", { cx: 1, r: 2 })),
    "texte à la place d'un nœud": sous(n("circle", { cx: 1, r: 2 }), n("g", { display: "none" }, n("text", { x: 0 }, n("tspan", {})))),
    "nœud à la place d'un texte": n("svg", { viewBox: "0 0 10 10" }, "texte", n("g", {})),
    "valeur non finie en profondeur": sous(n("circle", { cx: 1, r: NaN }), texte),
    "valeur infinie": sous(n("circle", { cx: Infinity, r: 2 }), texte),
    "valeur nulle": sous(n("circle", { cx: null, r: 2 }), texte),
    "valeur indéfinie": sous(n("circle", { cx: 1, r: undefined }), texte),
  };
  for (const [nom, nouveau] of Object.entries(fautes)) {
    const ancien = nom === "nœud à la place d'un texte" ? n("svg", { viewBox: "0 0 10 10" }, n("g", {}), n("g", {})) : base();
    const avant = JSON.stringify(ancien), avantNouveau = JSON.stringify(nouveau);
    const message = problemeMiseAJour(ancien, nouveau);
    assert.equal(typeof message, "string", nom);
    assert.equal(JSON.stringify(ancien) + JSON.stringify(nouveau), avant + avantNouveau, `${nom} : les descriptions ne sont pas modifiées`);
    const dom = versDom(ancien, docFactice());
    assert.throws(() => mettreAJour(dom, ancien, nouveau), (erreur) => erreur.message === message, nom);
  }
  // La place de la faute est dite : le chemin depuis la racine, l'attribut.
  assert.match(problemeMiseAJour(base(), fautes["valeur non finie en profondeur"]), /non finie.*circle.*attribut r/);
  assert.match(problemeMiseAJour(base(), fautes["enfant en trop"]), /3 enfants au lieu de 2 \(svg\)/);
});
