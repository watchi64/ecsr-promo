import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-entretien.js";
import { SOURCES } from "../sources/dessins-entretien.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { reperesProfil, VOITURE } from "../js/dessins-kit.js";

const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "entretien");

test("entretien : chaque code du catalogue est dessiné et passe les contrôles communs", () => {
  for (const code of codes) {
    const e = CATALOGUE[code];
    if (e.bloc === "dessin") assert.deepEqual(verifierDessin(famille.DESSINS[code](), e.cadre), [], code);
    else assert.deepEqual(verifierGeste(famille.GESTES[code].construire(), e), [], code);
  }
  const fournis = [...Object.keys(famille.DESSINS), ...Object.keys(famille.GESTES || {})].sort();
  assert.deepEqual(fournis, [...codes].sort());
});

test("entretien : chaque dessin a ses sources, dont ses choix de dessin", () => {
  for (const code of codes) {
    assert.ok(Array.isArray(SOURCES[code]) && SOURCES[code].length >= 2, code);
    assert.ok(SOURCES[code].some((s) => s.startsWith("Choix de dessin")), code);
  }
});

// ----- Aides de lecture -----

const nb = (noeud, attribut) => {
  const v = Number(noeud.attributs[attribut]);
  assert.ok(Number.isFinite(v), `${noeud.attributs["data-r"] || noeud.balise} : ${attribut} absent ou non numérique`);
  return v;
};
const textes = (noeud) => trouverTous(noeud, (x) => x.balise === "text").map(texteDe);
// Lignes d'une étiquette du kit, jointes par une espace.
const lignes = (etiquette) => textes(etiquette).join(" ");
// Point désigné par une étiquette du kit (son filet part de là).
const cible = (etiquette) => [nb(etiquette, "data-x"), nb(etiquette, "data-y")];
// Boîte d'une partie : centre (data-x, data-y), largeur et hauteur (data-largeur, data-hauteur).
function boite(partie) {
  const [x, y, l, h] = ["data-x", "data-y", "data-largeur", "data-hauteur"].map((k) => nb(partie, k));
  return { x1: x - l / 2, x2: x + l / 2, y1: y - h / 2, y2: y + h / 2 };
}
const dans = ([x, y], b) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
// Nombres d'un tracé, lus par paires [x, y].
function points(d) {
  const v = String(d).match(/-?\d+(?:\.\d+)?/g).map(Number), r = [];
  for (let i = 0; i + 1 < v.length; i += 2) r.push([v[i], v[i + 1]]);
  return r;
}
const hautDe = (chemin) => Math.min(...points(chemin.attributs.d).map((p) => p[1]));
const basDe = (chemin) => Math.max(...points(chemin.attributs.d).map((p) => p[1]));
const droiteDe = (chemin) => Math.max(...points(chemin.attributs.d).map((p) => p[0]));

// ----- Sous le capot -----

test("capot : chaque organe à vérifier est dessiné et nommé des mots du cours, le point du filet posé sur lui", () => {
  const d = famille.DESSINS.capot();
  const mots = {
    huile: "Huile moteur",
    jauge: "Jauge",
    "vase-expansion": "Liquide de refroidissement (vase d'expansion)",
    "liquide-frein": "Liquide de frein",
    "lave-glace": "Lave-glace",
    batterie: "Batterie",
  };
  for (const [role, attendu] of Object.entries(mots)) {
    const partie = trouverRole(d, role);
    assert.ok(partie, `partie « ${role} » absente`);
    const e = trouverRole(d, `etiquette-${role}`);
    assert.ok(e, `étiquette de « ${role} » absente`);
    assert.ok(lignes(e) === attendu || lignes(e).startsWith(`${attendu} `), `${role} : « ${lignes(e)} »`);
    assert.ok(dans(cible(e), boite(partie)), `${role} : le filet ne part pas de la partie désignée`);
  }
});

test("capot : « Jamais moteur chaud » désigne le bouchon du vase d'expansion ; la disposition varie, c'est écrit", () => {
  const d = famille.DESSINS.capot();
  assert.ok(textes(d).includes("Jamais moteur chaud"));
  assert.ok(textes(d).includes("La disposition varie selon les modèles"));
  const e = trouverRole(d, "etiquette-vase-expansion");
  assert.ok(textes(e).includes("Jamais moteur chaud"), "la mise en garde fait partie de l'étiquette du vase d'expansion");
  const bouchon = trouverRole(trouverRole(d, "vase-expansion"), "bouchon");
  assert.ok(bouchon, "bouchon du vase d'expansion absent");
  const [cx, cy] = cible(e);
  assert.ok(Math.hypot(cx - nb(bouchon, "cx"), cy - nb(bouchon, "cy")) <= nb(bouchon, "r"), "le filet ne part pas du bouchon");
});

test("capot : la batterie porte ses deux cosses, marquées + et −", () => {
  const d = famille.DESSINS.capot();
  const batterie = trouverRole(d, "batterie"), b = boite(batterie);
  const signes = trouverTous(batterie, (x) => x.balise === "text");
  assert.deepEqual(signes.map(texteDe).sort(), ["+", "−"].sort());
  for (const s of signes) assert.ok(dans([nb(s, "x"), nb(s, "y")], b), `signe « ${texteDe(s)} » hors de la batterie`);
  const cosses = trouverTous(batterie, (x) => /^cosse-/.test(x.attributs["data-r"] || ""));
  assert.equal(cosses.length, 2);
  for (const c of cosses) assert.ok(dans([nb(c, "data-x"), nb(c, "data-y")], b), "cosse hors de la batterie");
});

// ----- Lire un niveau -----

test("niveaux : jauge tenue pointe en bas, repère mini sous le repère maxi, haut de la trace d'huile entre les deux", () => {
  const d = famille.DESSINS.niveaux();
  const [poignee, pointe, mini, maxi, trace] = ["poignee-jauge", "pointe-jauge", "repere-mini", "repere-maxi", "trace-huile"]
    .map((r) => { const x = trouverRole(d, r); assert.ok(x, `${r} absent`); return x; });
  assert.ok(nb(poignee, "data-y") < nb(pointe, "data-y"), "jauge tenue pointe en bas");
  assert.ok(nb(mini, "data-y") > nb(maxi, "data-y"), "mini sous maxi");
  const haut = hautDe(trace);
  assert.ok(Math.abs(haut - nb(trace, "data-y")) < 0.01, "data-y de la trace : son haut tracé");
  assert.ok(haut > nb(maxi, "data-y") && haut < nb(mini, "data-y"), `haut de la trace (${haut}) hors de l'intervalle`);
  assert.ok(Math.abs(basDe(trace) - nb(pointe, "data-y")) < 0.01, "la trace part de la pointe");
  assert.ok(textes(mini).includes("mini") && textes(maxi).includes("maxi"));
});

test("niveaux : réservoir translucide, niveau strictement entre MIN et MAX ; voiture posée sur un sol horizontal", () => {
  const d = famille.DESSINS.niveaux();
  const [min, max, niveau] = ["repere-min", "repere-max", "niveau"].map((r) => { const x = trouverRole(d, r); assert.ok(x, r); return x; });
  assert.ok(textes(min).includes("MIN") && textes(max).includes("MAX"));
  assert.ok(nb(min, "data-y") > nb(max, "data-y"), "MIN sous MAX");
  assert.ok(nb(niveau, "data-y") > nb(max, "data-y") && nb(niveau, "data-y") < nb(min, "data-y"), "niveau hors de l'intervalle");
  const liquide = trouverRole(d, "liquide");
  assert.ok(Math.abs(hautDe(liquide) - nb(niveau, "data-y")) < 0.01, "le liquide monte jusqu'au niveau dessiné");
  const sol = trouverRole(d, "sol");
  assert.equal(sol.balise, "line");
  assert.equal(nb(sol, "y1"), nb(sol, "y2"), "sol horizontal");
  const voiture = trouverRole(d, "voiture-profil");
  assert.equal(nb(voiture, "data-y"), nb(sol, "y1"), "la voiture est posée sur ce sol");
  assert.ok(nb(voiture, "data-x") > nb(sol, "x1") && nb(voiture, "data-x") < nb(sol, "x2"));
  assert.ok(textes(d).includes("Sol plat"));
});

// ----- Contrôler un pneu -----

test("pneu : le témoin d'usure mesure 1,6 mm à l'échelle de la coupe, coté « 1,6 mm »", () => {
  const d = famille.DESSINS.pneu();
  assert.ok(Number.isFinite(famille.MM) && famille.MM > 0);
  for (const etat of ["juste", "faux"]) {
    const v = trouverRole(d, `bande-${etat}`);
    assert.ok(v, `coupe de la bande de roulement (${etat}) absente`);
    const temoin = trouverRole(v, "temoin");
    const hauteur = basDe(temoin) - hautDe(temoin);
    assert.ok(Math.abs(hauteur - 1.6 * famille.MM) <= 0.1, `${etat} : témoin de ${hauteur} unités`);
    const cote = trouverRole(v, "cote");
    assert.ok(textes(cote).includes("1,6 mm"), `${etat} : cote absente`);
    assert.ok(Math.abs(nb(cote, "data-y1") - hautDe(temoin)) <= 0.1 && Math.abs(nb(cote, "data-y2") - basDe(temoin)) <= 0.1,
      `${etat} : la cote ne mesure pas le témoin`);
  }
});

test("pneu : bon, sculptures plus hautes que le témoin d'au moins 2 mm ; à remplacer, sculptures au niveau du témoin", () => {
  const d = famille.DESSINS.pneu();
  const bon = trouverRole(d, "bande-juste"), use = trouverRole(d, "bande-faux");
  const sculptures = (v) => trouverTous(v, (x) => x.attributs["data-r"] === "sculpture");
  for (const v of [bon, use]) assert.ok(sculptures(v).length >= 2, "au moins deux pains de sculpture");
  const temoinBon = hautDe(trouverRole(bon, "temoin"));
  for (const s of sculptures(bon)) assert.ok(temoinBon - hautDe(s) >= 2 * famille.MM, `bon : sculpture ${temoinBon - hautDe(s)} unités au-dessus`);
  const temoinUse = hautDe(trouverRole(use, "temoin"));
  for (const s of sculptures(use)) assert.ok(Math.abs(hautDe(s) - temoinUse) <= 0.5, `à remplacer : écart ${hautDe(s) - temoinUse}`);
  assert.ok(textes(use).join(" ").includes("affleure"));
});

test("pneu : flanc sain d'un côté, hernie de l'autre, une bosse vers l'extérieur du flanc", () => {
  const d = famille.DESSINS.pneu();
  const sain = trouverRole(d, "flanc-juste"), malade = trouverRole(d, "flanc-faux");
  assert.ok(sain && malade);
  assert.equal(trouverRole(sain, "hernie"), null, "aucune hernie dans la vignette juste");
  const hernie = trouverRole(malade, "hernie");
  assert.ok(hernie, "hernie absente");
  // Demi-largeur du pneu sain, mesurée sur le contour de son flanc, depuis l'axe de la coupe.
  const demiSain = droiteDe(trouverRole(sain, "pneu")) - nb(sain, "data-x");
  const sommet = nb(hernie, "data-x") - nb(malade, "data-x");
  const echelle = nb(malade, "data-echelle");
  assert.ok(sommet - demiSain >= 8 * echelle, `bosse de ${(sommet - demiSain) / echelle} mm seulement`);
  assert.ok(Math.abs(droiteDe(trouverRole(malade, "pneu")) - nb(hernie, "data-x")) < 0.01, "le sommet de la bosse est sur le contour");
  // La bosse est sur le flanc : entre l'épaule et le talon.
  const y = nb(hernie, "data-y");
  assert.ok(y > nb(malade, "data-epaule") && y < nb(malade, "data-talon"), "la hernie n'est pas sur le flanc");
  assert.ok(textes(malade).includes("Hernie"));
});

// ----- La pression des pneus -----

test("pression : étiquette sur le montant de la portière conducteur et dans la trappe ; à froid, roue de secours comprise", () => {
  const d = famille.DESSINS.pression();
  const montant = trouverRole(d, "etiquette-montant"), trappe = trouverRole(d, "etiquette-trappe");
  assert.ok(montant && trappe);
  assert.ok(textes(d).some((t) => t.includes("À froid")));
  assert.ok(textes(d).some((t) => t.includes("roue de secours comprise")));
  assert.ok(textes(d).some((t) => t.includes("Souvent")), "l'emplacement varie : « souvent »");
  // Côté conducteur : l'avant de la voiture à gauche (sens « gauche » du kit), portière et trappe ouvertes.
  const v = trouverRole(d, "voiture-profil");
  const [x, y] = [nb(v, "data-x"), nb(v, "data-y")];
  const roueAvant = trouverRole(v, "roue-avant");
  assert.ok(nb(roueAvant, "data-x") < x, "avant à gauche : on voit le côté du conducteur");
  const echelle = (x - nb(roueAvant, "data-x")) / (VOITURE.empattement - VOITURE.essieu);
  const r = reperesProfil({ x, y, echelle, sens: "gauche", trappeOuverte: true });
  assert.equal(trouverRole(v, "portiere-ouverte").attributs.display, "inline");
  assert.equal(trouverRole(v, "trappe-ouverte").attributs.display, "inline");
  const pres = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01;
  assert.ok(pres([nb(montant, "data-x"), nb(montant, "data-y")], r.montantPortiere), "étiquette hors du montant");
  assert.ok(pres([nb(trappe, "data-x"), nb(trappe, "data-y")], r.trappe), "étiquette hors de la trappe");
  // Chaque étiquette est nommée : un filet part du cercle qui la désigne.
  for (const [role, mots] of [["montant", "montant de la portière conducteur"], ["trappe", "trappe à carburant"]]) {
    const e = trouverRole(d, `nom-${role}`);
    assert.ok(e && lignes(e).includes(mots), `${role} : « ${e && lignes(e)} »`);
    const repere = trouverRole(d, `repere-${role}`);
    const [cx, cy] = cible(e);
    const ecart = Math.hypot(cx - nb(repere, "cx"), cy - nb(repere, "cy"));
    assert.ok(Math.abs(ecart - nb(repere, "r")) < 0.01, `${role} : le filet ne part pas du cercle`);
  }
});
