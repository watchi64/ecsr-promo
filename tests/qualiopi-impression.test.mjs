// Impression des documents Qualiopi (js/qualiopi-impression.js) : ce que la page laisse dans le document, de l'impression au
// nettoyage. Le module n'a aucun import et ne touche que `document` et `window` : le test lui en donne de factices, qui ne
// connaissent que ce qu'il appelle (createElement ; appendChild, qui refuse ce qui n'est pas un nœud comme le fait un
// navigateur ; remove ; querySelectorAll par identifiants ; classList ; title ; écouteurs ; print).
// Lancer depuis la racine du dépôt : node tests/qualiopi-impression.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (v, msg) => { assert.ok(v, msg); n++; };

// --- Document et fenêtre factices ---
class Noeud {
  constructor(nom) { this.nodeName = nom; this.id = ""; this.textContent = ""; this.parent = null; this.enfants = []; }
  appendChild(x) {
    if (!(x instanceof Noeud)) throw new TypeError("appendChild : le paramètre 1 n'est pas de type Node");
    x.remove();
    x.parent = this;
    this.enfants.push(x);
    return x;
  }
  remove() {
    if (this.parent) { this.parent.enfants = this.parent.enfants.filter((e) => e !== this); this.parent = null; }
  }
}
const descendants = (racine) => racine.enfants.flatMap((e) => [e, ...descendants(e)]);
const TITRE = "TP ECSR App";
const head = new Noeud("head");
const body = new Noeud("body");
const classes = new Set();
body.classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) };
const ecouteurs = new Map();    // type d'événement -> ensemble d'écouteurs
const impressions = [];         // l'état de la page à chaque window.print()

const dans = (racine, id) => descendants(racine).filter((x) => x.id === id);
function etat() {
  return {
    classe: classes.has("qualiopi-printable"),
    conteneurs: dans(body, "qualiopi-print").length,
    styles: dans(head, "qualiopi-page-style").map((s) => s.textContent),
    titre: document.title,
    ecouteursFin: ecouteurs.get("afterprint")?.size ?? 0,
  };
}
globalThis.document = {
  head,
  body,
  title: TITRE,
  createElement: (nom) => new Noeud(nom),
  querySelectorAll(selecteur) {
    const ids = selecteur.split(",").map((s) => s.trim().replace(/^#/, ""));
    return [...descendants(head), ...descendants(body)].filter((x) => ids.includes(x.id));
  },
};
globalThis.window = {
  addEventListener(type, f) { if (!ecouteurs.has(type)) ecouteurs.set(type, new Set()); ecouteurs.get(type).add(f); },
  removeEventListener(type, f) { ecouteurs.get(type)?.delete(f); },
  print() { impressions.push(etat()); },
};
const RIEN = { classe: false, conteneurs: 0, styles: [], titre: TITRE, ecouteursFin: 0 };
const FORMAT = "@page { size: A4 portrait; margin: 12mm; }";
const finirImpression = () => [...(ecouteurs.get("afterprint") || [])].forEach((f) => f());   // le navigateur : afterprint
const nouveauContenu = () => { const c = new Noeud("article"); c.id = "contenu"; return c; };

// Le module se charge après la pose des doublures (un import statique serait évalué avant elles).
const { imprimerQualiopi, teardownQualiopiPrint } = await import("../js/qualiopi-impression.js");

// =====================================================================================================
// Page propre
// =====================================================================================================
eq(etat(), RIEN, "page propre au départ");
teardownQualiopiPrint();
eq(etat(), RIEN, "nettoyer une page propre n'y change rien (le routeur le fait à chaque page, imprimée ou non)");
ok(document.title === TITRE, "et ne touche pas au titre");

// =====================================================================================================
// Une impression : ce qui est posé au moment d'imprimer, puis afterprint
// =====================================================================================================
const contenu = nouveauContenu();
imprimerQualiopi(contenu, "qualiopi-dossier-formation-nimes-2026-10-28");
eq(impressions.length, 1, "une seule demande d'impression");
eq(impressions[0], { classe: true, conteneurs: 1, styles: [FORMAT], titre: "qualiopi-dossier-formation-nimes-2026-10-28", ecouteursFin: 1 },
  "au moment d'imprimer : classe sur <body>, un conteneur, le format A4 portrait à 12 mm, le titre devenu le nom du fichier, un écouteur d'afterprint");
ok(dans(body, "qualiopi-print")[0].parent === body && dans(body, "qualiopi-print")[0].enfants[0] === contenu, "le conteneur #qualiopi-print est un enfant direct de <body> et porte le document");
ok(dans(head, "qualiopi-page-style")[0].parent === head, "le format de page est dans <head>");
eq(etat(), impressions[0], "l'impression terminée, rien n'est retiré tant qu'afterprint n'est pas arrivé");
finirImpression();
eq(etat(), RIEN, "après afterprint : ni conteneur, ni style, ni classe, titre rendu, plus d'écouteur");

// =====================================================================================================
// Deux impressions, nettoyage par le routeur
// =====================================================================================================
imprimerQualiopi(nouveauContenu(), "premier-nom");
imprimerQualiopi(nouveauContenu(), "second-nom");
eq(etat(), { classe: true, conteneurs: 1, styles: [FORMAT], titre: "second-nom", ecouteursFin: 1 },
  "deux impressions sans afterprint entre elles : la deuxième remplace la première (un conteneur, un style, un écouteur)");
eq(impressions.slice(-2).map((i) => i.conteneurs), [1, 1], "jamais deux conteneurs, même au moment d'imprimer");
finirImpression();
eq(etat(), RIEN, "le titre rendu est celui de l'app, jamais le nom du premier fichier");

imprimerQualiopi(nouveauContenu(), "nom");
teardownQualiopiPrint();
eq(etat(), RIEN, "changement de page (teardownQualiopiPrint, appelé par le routeur) : plus rien dans le document, titre rendu");
teardownQualiopiPrint();
finirImpression();
eq(etat(), RIEN, "nettoyer deux fois, ou un afterprint qui arrive après le nettoyage : sans effet");

// =====================================================================================================
// Un contenu qui n'en est pas un : l'erreur part avant tout effet sur la page
// =====================================================================================================
for (const mauvais of ["du texte", undefined, null, 42]) {
  const avant = impressions.length;
  assert.throws(() => imprimerQualiopi(mauvais, "nom"), TypeError);
  n++;
  eq(etat(), RIEN, `contenu ${String(mauvais)} : la page n'a rien reçu (ni conteneur, ni style, ni classe, ni titre, ni écouteur)`);
  eq(impressions.length, avant, "et rien n'a été imprimé");
}
// Une erreur après une impression réussie ne défait pas ce qui est déjà monté... mais elle ne le double pas non plus.
imprimerQualiopi(nouveauContenu(), "bon");
assert.throws(() => imprimerQualiopi({}, "mauvais"), TypeError);
n++;
eq(etat(), { classe: true, conteneurs: 1, styles: [FORMAT], titre: "bon", ecouteursFin: 1 }, "un appel invalide pendant qu'un document est monté ne touche pas à ce document");
teardownQualiopiPrint();
eq(etat(), RIEN, "et le nettoyage suivant le retire");

// =====================================================================================================
// Accord avec la feuille de style et hygiène
// =====================================================================================================
const css = readFileSync(new URL("../css/qualiopi.css", import.meta.url), "utf8");
ok(css.includes("#qualiopi-print") && css.includes("body.qualiopi-printable"), "le conteneur et la classe du module sont ceux de la feuille de style");
ok(!readFileSync(new URL("../js/qualiopi-impression.js", import.meta.url), "utf8").includes(String.fromCharCode(0x2014)), "aucun tiret cadratin dans le module");

console.log(`qualiopi-impression : ${n} assertions OK`);
