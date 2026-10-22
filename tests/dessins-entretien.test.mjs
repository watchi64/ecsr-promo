import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-entretien.js";
import { SOURCES } from "../sources/dessins-entretien.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { CHARTE, reperesProfil, VOITURE, VOITURE_PROFIL, SYMBOLE_FREIN, SYMBOLE_TEMPERATURE } from "../js/dessins-kit.js";

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
// Point d'une étiquette du kit tel qu'il est dessiné : son centre, le rayon du disque sombre et celui de son liseré clair.
function pointDe(etiquette) {
  const rayons = trouverTous(etiquette, (x) => x.balise === "circle").map((c) => nb(c, "r"));
  const [x, y] = cible(etiquette);
  return { x, y, rayon: Math.min(...rayons), lisere: Math.max(...rayons) };
}
// Boîte d'une partie : centre (data-x, data-y), largeur et hauteur (data-largeur, data-hauteur).
function boite(partie) {
  const [x, y, l, h] = ["data-x", "data-y", "data-largeur", "data-hauteur"].map((k) => nb(partie, k));
  return { x1: x - l / 2, x2: x + l / 2, y1: y - h / 2, y2: y + h / 2 };
}
const dans = ([x, y], b) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
const auBord = ([x, y], b) => Math.min(x - b.x1, b.x2 - x, y - b.y1, b.y2 - y);
// Nombres d'un tracé, lus par paires [x, y].
function points(d) {
  const v = String(d).match(/-?\d+(?:\.\d+)?/g).map(Number), r = [];
  for (let i = 0; i + 1 < v.length; i += 2) r.push([v[i], v[i + 1]]);
  return r;
}
const hautDe = (chemin) => Math.min(...points(chemin.attributs.d).map((p) => p[1]));
const basDe = (chemin) => Math.max(...points(chemin.attributs.d).map((p) => p[1]));
const droiteDe = (chemin) => Math.max(...points(chemin.attributs.d).map((p) => p[0]));
const gaucheDe = (chemin) => Math.min(...points(chemin.attributs.d).map((p) => p[0]));
// Translation d'un groupe (« translate(x y) », suivi ou non d'une rotation).
const translation = (g) => String(g.attributs.transform).match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/).slice(1).map(Number);
// Point dans un polygone (règle pair-impair) ; distance d'un point au contour d'un polygone.
function dansPolygone([px, py], poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
function distanceContour([px, py], poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], l2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2)) : 0;
    d = Math.min(d, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))));
  }
  return d;
}

// ----- Sous le capot -----

const ORGANES = {
  huile: "Huile moteur",
  jauge: "Jauge",
  "vase-expansion": "Liquide de refroidissement (vase d'expansion)",
  "liquide-frein": "Liquide de frein",
  "lave-glace": "Lave-glace",
  batterie: "Batterie",
};

test("capot : chaque organe à vérifier est dessiné et nommé des mots du cours, le point du filet posé sur lui", () => {
  const d = famille.DESSINS.capot();
  for (const [role, attendu] of Object.entries(ORGANES)) {
    const partie = trouverRole(d, role);
    assert.ok(partie, `partie « ${role} » absente`);
    const e = trouverRole(d, `etiquette-${role}`);
    assert.ok(e, `étiquette de « ${role} » absente`);
    assert.ok(lignes(e) === attendu || lignes(e).startsWith(`${attendu} `), `${role} : « ${lignes(e)} »`);
    assert.ok(dans(cible(e), boite(partie)), `${role} : le filet ne part pas de la partie désignée`);
  }
});

// Un organe désigné se reconnaît sur un téléphone et le point de son étiquette ne le cache pas : dans sa plus petite dimension,
// il mesure au moins une fois et demie le point (liseré compris), et le centre du point est sur lui, à moins d'un rayon de
// point de son bord (le point en déborde). Pour la mise en garde, l'organe désigné est le bouchon du vase.
test("capot : chaque organe se lit sur un téléphone et le point de son étiquette n'en couvre qu'un bord", () => {
  const d = famille.DESSINS.capot();
  for (const role of Object.keys(ORGANES)) {
    const p = pointDe(trouverRole(d, `etiquette-${role}`));
    const partie = trouverRole(d, role);
    if (role === "vase-expansion") {
      const bouchon = trouverRole(partie, "bouchon"), r = nb(bouchon, "r");
      const ecart = Math.hypot(p.x - nb(bouchon, "cx"), p.y - nb(bouchon, "cy"));
      assert.ok(2 * r >= 3 * p.lisere, `bouchon du vase de ${2 * r} unités pour un point de ${2 * p.lisere}`);
      assert.ok(ecart <= r && r - ecart <= p.rayon, `vase : point à ${(r - ecart).toFixed(2)} du bord du bouchon`);
      continue;
    }
    const b = boite(partie), petite = Math.min(b.x2 - b.x1, b.y2 - b.y1);
    assert.ok(petite >= 3 * p.lisere, `${role} : ${petite.toFixed(1)} unités dans sa plus petite dimension, point de ${2 * p.lisere}`);
    assert.ok(dans([p.x, p.y], b) && auBord([p.x, p.y], b) <= p.rayon, `${role} : point à ${auBord([p.x, p.y], b).toFixed(2)} du bord`);
  }
});

test("capot : « Jamais moteur chaud » désigne le bouchon du vase d'expansion, dans la teinte « faux » ; la disposition la plus courante, qui varie, c'est écrit", () => {
  const d = famille.DESSINS.capot();
  assert.ok(textes(d).includes("Disposition la plus courante ; elle varie selon les modèles"));
  const e = trouverRole(d, "etiquette-vase-expansion");
  assert.ok(lignes(e).endsWith("Jamais moteur chaud"), `étiquette du vase : « ${lignes(e)} »`);
  const bouchon = trouverRole(trouverRole(d, "vase-expansion"), "bouchon");
  assert.ok(bouchon, "bouchon du vase d'expansion absent");
  const [cx, cy] = cible(e);
  assert.ok(Math.hypot(cx - nb(bouchon, "cx"), cy - nb(bouchon, "cy")) <= nb(bouchon, "r"), "le filet ne part pas du bouchon");
  // La mise en garde, et elle seule, dans la teinte « faux », en demi-gras.
  for (const t of trouverTous(e, (x) => x.balise === "text")) {
    const garde = texteDe(t) === "Jamais moteur chaud";
    assert.equal(t.attributs.fill === CHARTE.faux && Number(t.attributs["font-weight"]) === 600, garde, `ligne « ${texteDe(t)} »`);
  }
});

test("capot : la batterie porte ses deux cosses, marquées + et −, chacune au bout d'un câble", () => {
  const d = famille.DESSINS.capot();
  const batterie = trouverRole(d, "batterie"), b = boite(batterie);
  const signes = trouverTous(batterie, (x) => x.balise === "text");
  assert.deepEqual(signes.map(texteDe).sort(), ["+", "−"].sort());
  for (const s of signes) assert.ok(dans([nb(s, "x"), nb(s, "y")], b), `signe « ${texteDe(s)} » hors de la batterie`);
  const cosses = trouverTous(batterie, (x) => /^cosse-/.test(x.attributs["data-r"] || ""));
  assert.equal(cosses.length, 2);
  for (const c of cosses) {
    assert.ok(dans([nb(c, "data-x"), nb(c, "data-y")], b), "cosse hors de la batterie");
    const cable = trouverRole(c, "cable"), pince = trouverTous(c, (x) => x.balise === "path")[0];
    assert.ok(cable, "cosse sans câble");
    // Le câble part du bord de la cosse tourné vers l'arrière de la voiture (le bas du dessin), et s'en éloigne.
    assert.ok(Math.abs(nb(cable, "y1") - basDe(pince)) < 0.01 && nb(cable, "x1") > gaucheDe(pince) && nb(cable, "x1") < droiteDe(pince),
      "le câble ne part pas de la cosse");
    assert.ok(nb(cable, "y2") > nb(cable, "y1"), "le câble part vers l'arrière");
    assert.ok(Math.hypot(nb(cable, "x2") - nb(cable, "x1"), nb(cable, "y2") - nb(cable, "y1")) >= 2 * pointDe(trouverRole(d, "etiquette-batterie")).lisere,
      "amorce de câble trop courte pour se voir");
  }
});

test("capot : la voiture est celle du kit, vue du dessus, l'avant en haut, découpée à un identifiant propre à chaque dessin ; le compartiment est sous son capot", () => {
  const d1 = famille.DESSINS.capot(), d2 = famille.DESSINS.capot();
  const ids = [d1, d2].map((d) => {
    const decoupe = trouverTous(d, (x) => x.balise === "clipPath");
    assert.equal(decoupe.length, 1);
    const id = decoupe[0].attributs.id;
    assert.equal(trouverRole(d, "decoupe").attributs["clip-path"], `url(#${id})`);
    // Un seul rôle « caisse », celui de la voiture du kit : le groupe de la découpe a son nom à lui (relecture finale du lot
    // D1, T10 n° 4 : deux « caisse » faisaient lire au premier trouvé le groupe au lieu de la caisse).
    assert.equal(trouverTous(d, (x) => x.attributs["data-r"] === "caisse").length, 1, "un seul rôle « caisse »");
    return id;
  });
  assert.notEqual(ids[0], ids[1], "deux dessins du capot partagent un identifiant de découpe");
  const voiture = trouverRole(d1, "voiture");
  assert.ok(voiture, "voiture du kit absente");
  assert.equal(nb(voiture, "data-angle"), -90, "l'avant en haut");
  // Tournée d'un quart de tour, la caisse (rectangle du kit, x le long de la voiture) est en hauteur dans le dessin : un point
  // [lx, ly] du repère de la voiture se voit en [tx + ly, ty - lx].
  const [tx, ty] = translation(voiture);
  const caisse = trouverRole(voiture, "caisse"), pareBrise = trouverRole(voiture, "pare-brise");
  const [lx1, ly1, lx2, ly2] = [nb(caisse, "x"), nb(caisse, "y"), nb(caisse, "x") + nb(caisse, "width"), nb(caisse, "y") + nb(caisse, "height")];
  const [cx1, cx2, cy1, cy2] = [tx + ly1, tx + ly2, ty - lx2, ty - lx1];
  assert.ok(Math.abs((cy2 - cy1) / (cx2 - cx1) - VOITURE.longueur / VOITURE.largeur) < 1e-6, "proportions de la caisse du kit");
  const compartiment = points(trouverRole(d1, "compartiment").attributs.d);
  for (const [x, y] of compartiment) assert.ok(x > cx1 && x < cx2 && y > cy1 && y < cy2, `compartiment hors de la caisse en ${x}, ${y}`);
  // Le pare-brise, derrière le compartiment : plus bas dans le dessin.
  const avantPareBrise = ty - Math.max(...points(pareBrise.attributs.d).map((q) => q[0]));
  assert.ok(Math.max(...compartiment.map((q) => q[1])) < avantPareBrise, "compartiment sur le pare-brise");
});

// ----- Style schématique (décision du formateur du 15/10/2026 : « pictogramme plutôt qu'illustration ») -----

// Teintes peintes par les formes d'un nœud (ni textes ni groupes), « none » exclu ; présence d'un bord sur une forme pleine.
const teintesFormes = (noeud) => {
  const vues = new Set();
  for (const x of trouverTous(noeud, (y) => y.balise !== "text" && y.balise !== "g")) {
    for (const k of ["fill", "stroke"]) if (x.attributs[k] !== undefined && x.attributs[k] !== "none") vues.add(x.attributs[k]);
  }
  return [...vues];
};
const bordees = (noeud) => trouverTous(noeud, (x) => x.balise !== "line" && x.balise !== "text" && x.balise !== "g"
  && x.attributs.stroke !== undefined && x.attributs.stroke !== "none" && x.attributs.fill !== "none");
// Luminance relative (WCAG) d'une couleur #RRGGBB et contraste de deux couleurs.
function luminance(hex) {
  const lineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lineaire(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("capot : en pictogramme : la voiture en silhouette du kit ; sous le capot, le compartiment, le moteur d'un ton et les organes nommés, en aplats sans bord", () => {
  const d = famille.DESSINS.capot();
  const voiture = trouverRole(d, "voiture");
  const details = trouverTous(voiture, (x) => /^(toit|phare-|feu-|essuie-glaces|reflet-|vitre-)/.test(x.attributs["data-r"] || ""));
  assert.deepEqual(details.map((x) => x.attributs["data-r"]), [], "détails de finition de la voiture");
  // Hors de la voiture et des étiquettes, seulement le compartiment, le moteur et les six organes du cours, chacun en aplats.
  const racines = d.enfants.filter((x) => typeof x !== "string" && x.balise !== "defs" && x.balise !== "text"
    && !/^(fond|decoupe|etiquette-)/.test(x.attributs["data-r"] || ""));
  assert.deepEqual(racines.map((x) => x.attributs["data-r"]).sort(), ["compartiment", "moteur", ...Object.keys(ORGANES)].sort());
  assert.deepEqual(teintesFormes(trouverRole(d, "moteur")), [trouverRole(d, "moteur").attributs.fill], "moteur d'un seul ton");
  for (const role of Object.keys(ORGANES)) {
    const partie = trouverRole(d, role);
    // Le pictogramme d'un bouchon est fait de traits (sans aplat) ou d'aplats (sans trait) : jamais d'une forme bordée.
    assert.deepEqual(bordees(partie).length, 0, `${role} : forme bordée`);
    // Deux tons par organe ; trois pour la batterie (bac, cosses, câbles) et pour un réservoir dont le bouchon porte un
    // pictogramme (plastique, bouchon, pictogramme).
    const tons = teintesFormes(partie).length, max = role === "batterie" || trouverRole(partie, "pictogramme") ? 3 : 2;
    assert.ok(tons <= max, `${role} : ${tons} tons pour ${max} au plus`);
  }
});

// Teinte (degrés), saturation et clarté (de 0 à 1) d'une couleur #RRGGBB.
function tsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, dd = max - min;
  if (!dd) return { t: 0, s: 0, l };
  const s = dd / (1 - Math.abs(2 * l - 1));
  const t = max === r ? 60 * (((g - b) / dd) % 6) : max === g ? 60 * ((b - r) / dd + 2) : 60 * ((r - g) / dd + 4);
  return { t: (t + 360) % 360, s, l };
}
// Retour du formateur du 22/10/2026 : « l'idée est bonne, mais assez peu représentative. On ne connaît pas suffisamment les
// éléments, et les logos, types voyants, sur les différents récipients, ça pourrait être intéressant de les ajouter. »
const proche = (a, b, tolerance, quoi) => assert.ok(Math.abs(a - b) <= tolerance, `${quoi} : ${a} au lieu de ${b}`);
const PICTOS_CAPOT = { huile: "7000-0248", "vase-expansion": "7000-0246", "lave-glace": "7000-0088", "liquide-frein": "7000-0239" };

test("capot : chaque bouchon de remplissage porte son pictogramme normalisé, sur lui, lisible sur un téléphone", () => {
  const d = famille.DESSINS.capot();
  const [L] = CATALOGUE.capot.cadre, px = 343 / L;
  for (const [role, iso] of Object.entries(PICTOS_CAPOT)) {
    const partie = trouverRole(d, role), bouchon = trouverRole(partie, "bouchon"), picto = trouverRole(partie, "pictogramme");
    assert.ok(picto, `${role} : pictogramme absent`);
    assert.equal(picto.attributs["data-iso"], iso, `${role} : symbole ISO ${picto.attributs["data-iso"]}`);
    // Sur le bouchon : chaque point de ses tracés est dans le disque du bouchon, et le pictogramme est centré sur lui.
    const [bx, by, br] = ["cx", "cy", "r"].map((k) => nb(bouchon, k));
    for (const chemin of trouverTous(picto, (x) => x.balise === "path")) {
      for (const q of points(chemin.attributs.d)) assert.ok(Math.hypot(q[0] - bx, q[1] - by) < br, `${role} : point ${q} hors du bouchon`);
    }
    for (const c of trouverTous(picto, (x) => x.balise === "circle")) {
      assert.ok(Math.hypot(nb(c, "cx") - bx, nb(c, "cy") - by) + nb(c, "r") < br, `${role} : cercle hors du bouchon`);
    }
    assert.ok(Math.hypot(nb(picto, "data-x") - bx, nb(picto, "data-y") - by) < 0.01, `${role} : pictogramme décentré`);
    // Lisible : 18 px au moins dans sa plus grande dimension sur un téléphone, d'une teinte à 4,5:1 au moins sur le bouchon.
    const taille = Math.max(nb(picto, "data-largeur"), nb(picto, "data-hauteur")) * px;
    assert.ok(taille >= 18, `${role} : pictogramme de ${taille.toFixed(1)} px sur un téléphone`);
    for (const forme of trouverTous(picto, (x) => x.balise === "path" || x.balise === "circle")) {
      const teinte = forme.attributs.fill !== "none" ? forme.attributs.fill : forme.attributs.stroke;
      assert.ok(contraste(teinte, bouchon.attributs.fill) >= 4.5, `${role} : pictogramme à ${contraste(teinte, bouchon.attributs.fill).toFixed(2)}:1 sur le bouchon`);
    }
    // Le point de l'étiquette ne couvre pas le pictogramme : son disque (liseré compris) reste hors de sa boîte.
    const point = pointDe(trouverRole(d, `etiquette-${role}`)), b = boite(picto);
    const dx = Math.max(b.x1 - point.x, 0, point.x - b.x2), dy = Math.max(b.y1 - point.y, 0, point.y - b.y2);
    assert.ok(Math.hypot(dx, dy) >= point.lisere, `${role} : le point de l'étiquette couvre le pictogramme`);
    // Chaque symbole dessiné est cité dans les sources, avec sa référence.
    assert.ok(SOURCES.capot.some((t) => t.includes(`ISO ${iso}`)), `${role} : ISO ${iso} absent des sources`);
  }
});

// Consigne du formateur du 22/10/2026, après le bouchon du frein : « pareil pour le liquide de refroidissement, c'est le même que le
// voyant ». Le bouchon du vase d'expansion porte le symbole du voyant de température du liquide de refroidissement.
test("capot : le bouchon du vase d'expansion porte le symbole du voyant de température : le thermomètre dans les vagues, aux proportions du voyant", () => {
  const d = famille.DESSINS.capot();
  const vase = trouverRole(d, "vase-expansion"), bouchon = trouverRole(vase, "bouchon"), picto = trouverRole(vase, "pictogramme");
  assert.ok(picto, "symbole absent du bouchon du vase d'expansion");
  const F = SYMBOLE_TEMPERATURE, [bx, by] = ["cx", "cy"].map((k) => nb(bouchon, k));
  // Le carré du symbole, lu sur le pictogramme : sa largeur dessinée est celle des vagues.
  const parts = Math.max(...F.vagues.map((w) => w.droite)) - Math.min(...F.vagues.map((w) => w.gauche)), cote = nb(picto, "data-largeur") / parts;
  const [tige, bulbe, graduations, vagues] = ["tige", "bulbe", "graduations", "vagues"].map((r) => { const x = trouverRole(picto, r); assert.ok(x, `${r} absent`); return x; });
  // La tige, verticale, du haut du symbole au bulbe plein, centré sur l'axe du bouchon.
  const [t1, t2] = points(tige.attributs.d);
  proche(t1[0], t2[0], 0.01, "tige verticale");
  proche(t1[0], bx, 0.01, "tige dans l'axe du bouchon");
  proche(t2[1] - t1[1], (F.bulbe.v - F.tige.haut) * cote, 0.02, "longueur de la tige");
  proche(nb(bulbe, "cx"), t2[0], 0.01, "bulbe au pied de la tige");
  proche(nb(bulbe, "cy"), t2[1], 0.01, "bulbe au pied de la tige");
  proche(nb(bulbe, "r"), F.bulbe.rayon * cote, 0.01, "rayon du bulbe");
  assert.notEqual(bulbe.attributs.fill, "none", "bulbe plein");
  // Trois graduations à droite de la tige ; trois morceaux de vagues, sous le haut du bulbe.
  const traits = String(graduations.attributs.d).split(/(?=M)/).map((x) => points(x));
  assert.equal(traits.length, F.graduations.v.length, "graduations");
  for (const [a, b] of traits) assert.ok(Math.abs(a[1] - b[1]) < 0.01 && Math.min(a[0], b[0]) > t1[0], "graduation horizontale, à droite de la tige");
  const morceaux = String(vagues.attributs.d).split(/(?=M)/);
  assert.equal(morceaux.length, F.vagues.length, "morceaux de vagues");
  for (const m of morceaux) {
    assert.ok(/C/.test(m), "vague en courbes");
    for (const q of points(m)) assert.ok(q[1] > nb(bulbe, "cy") - nb(bulbe, "r") - 0.01, "vague au-dessus du bulbe");
  }
  // Ni flacon ni point d'exclamation : rien d'autre que ces quatre pièces.
  assert.equal(picto.enfants.filter((x) => typeof x !== "string").length, 4, "pièces en trop");
  assert.ok(Math.hypot(nb(picto, "data-x") - bx, nb(picto, "data-y") - by) < 0.01, "symbole centré sur le bouchon");
  assert.ok(SOURCES.capot.some((t) => t.includes("22/10/2026") && t.includes("ISO 7000-0246") && t.includes("même que le voyant")), "sources du symbole");
});

// Retour du formateur du 22/10/2026, photo d'un vrai bouchon à l'appui : le bouchon du liquide de frein porte « simplement un voyant
// de frein » : un cercle, un disque plein au centre, deux arcs de part et d'autre, sans point d'exclamation.
test("capot : le bouchon du liquide de frein porte le symbole du freinage du voyant, cercle et deux arcs, un disque plein au centre, sans point d'exclamation", () => {
  const d = famille.DESSINS.capot();
  const bouchon = trouverRole(trouverRole(d, "liquide-frein"), "bouchon"), picto = trouverRole(trouverRole(d, "liquide-frein"), "pictogramme");
  assert.ok(picto, "symbole absent du bouchon du liquide de frein");
  const [bx, by] = ["cx", "cy"].map((k) => nb(bouchon, k));
  const cercles = trouverTous(picto, (x) => x.balise === "circle"), chemins = trouverTous(picto, (x) => x.balise === "path");
  const cercle = cercles.find((c) => c.attributs.fill === "none"), disque = cercles.find((c) => c.attributs.fill !== "none");
  assert.ok(cercle && disque && cercles.length === 2, "un cercle et un disque plein");
  for (const c of cercles) assert.ok(Math.hypot(nb(c, "cx") - bx, nb(c, "cy") - by) < 0.01, "cercle et disque centrés sur le bouchon");
  assert.ok(nb(disque, "r") < nb(cercle, "r") - nb(cercle, "stroke-width"), "le disque est dans le cercle, détaché de lui");
  // Deux arcs, de part et d'autre, au rayon du voyant (SYMBOLE_FREIN : même proportion au cercle), symétriques ; aucun autre trait :
  // pas de point d'exclamation.
  assert.equal(chemins.length, 2, `${chemins.length} traits au lieu des deux arcs`);
  const rayons = chemins.map((c) => points(c.attributs.d).map((q) => Math.hypot(q[0] - bx, q[1] - by)));
  for (const r of rayons.flat()) proche(r / nb(cercle, "r"), SYMBOLE_FREIN.arcs.rayon / SYMBOLE_FREIN.cercle, 0.01, "arc au rayon du voyant");
  const [gauche, droite] = chemins.map((c) => points(c.attributs.d).map((q) => q[0] - bx)).sort((a, b) => a[0] - b[0]);
  assert.ok(Math.max(...gauche) < 0 && Math.min(...droite) > 0, "un arc de chaque côté");
  proche(Math.min(...gauche), -Math.max(...droite), 0.01, "arcs symétriques");
  assert.equal(trouverTous(picto, (x) => x.balise === "line").length, 0, "point d'exclamation");
  // Sources : la photo du formateur et la norme du voyant.
  assert.ok(SOURCES.capot.some((t) => t.includes("photo") && t.includes("22/10/2026") && t.includes("ISO 7000-0239")), "sources du symbole du frein");
});

test("capot : les couleurs usuelles : anneau de la jauge jaune, bouchon du lave-glace bleu, bouchons d'huile et des réservoirs noirs", () => {
  const d = famille.DESSINS.capot();
  const teinte = (role, sous) => trouverRole(trouverRole(d, role), sous).attributs.fill;
  const { t, s: sat, l } = tsl(teinte("jauge", "anneau"));
  assert.ok(t >= 40 && t <= 56 && sat >= 0.7 && l >= 0.4 && l <= 0.7, `anneau de la jauge de teinte ${teinte("jauge", "anneau")}`);
  const bleu = tsl(teinte("lave-glace", "bouchon"));
  assert.ok(bleu.t >= 200 && bleu.t <= 230 && bleu.s >= 0.5, `bouchon du lave-glace de teinte ${teinte("lave-glace", "bouchon")}`);
  for (const role of ["huile", "vase-expansion", "liquide-frein"]) assert.ok(luminance(teinte(role, "bouchon")) < 0.05, `${role} : bouchon noir`);
  // L'anneau jaune se détache du fond du compartiment, où il est posé.
  assert.ok(contraste(teinte("jauge", "anneau"), trouverRole(d, "compartiment").attributs.fill) >= 3, "anneau lisible sur le compartiment");
});

test("capot : les cosses, leurs câbles et les signes + et − se lisent sur la batterie et le fond du compartiment", () => {
  const d = famille.DESSINS.capot();
  const fondCompartiment = trouverRole(d, "compartiment").attributs.fill;
  const batterie = trouverRole(d, "batterie"), bac = trouverTous(batterie, (x) => x.balise === "path")[0].attributs.fill;
  for (const s of trouverTous(batterie, (x) => x.balise === "text")) {
    assert.ok(contraste(s.attributs.fill, bac) >= 4.5, `signe « ${texteDe(s)} » à ${contraste(s.attributs.fill, bac).toFixed(2)}:1 sur la batterie`);
  }
  for (const c of trouverTous(batterie, (x) => /^cosse-/.test(x.attributs["data-r"] || ""))) {
    const cable = trouverRole(c, "cable").attributs.stroke, pince = trouverTous(c, (x) => x.balise === "path")[0].attributs.fill;
    assert.ok(contraste(cable, fondCompartiment) >= 3, `câble à ${contraste(cable, fondCompartiment).toFixed(2)}:1 sur le compartiment`);
    assert.ok(contraste(pince, bac) >= 3, `cosse à ${contraste(pince, bac).toFixed(2)}:1 sur la batterie`);
  }
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
  assert.ok(textes(mini).includes("MIN") && textes(maxi).includes("MAX"), "repères MIN et MAX, écrits comme sur la jauge");
});

test("niveaux : chaque encoche de la lame est à la hauteur de son repère, de part et d'autre de la lame", () => {
  const d = famille.DESSINS.niveaux();
  const lame = points(trouverRole(d, "pointe-jauge").attributs.d);
  const [x1, x2] = [Math.min(...lame.map((p) => p[0])), Math.max(...lame.map((p) => p[0]))];
  const bas = Math.max(...lame.map((p) => p[1])), demi = (x2 - x1) / 2;
  // Sommets rentrants : ni sur un bord de la lame, ni dans l'arrondi de la pointe.
  const fonds = lame.filter(([x, y]) => x > x1 + 0.01 && x < x2 - 0.01 && y < bas - demi);
  const attendus = ["repere-mini", "repere-maxi"].map((r) => nb(trouverRole(d, r), "data-y"));
  assert.equal(fonds.length, 2 * attendus.length, `${fonds.length} sommets rentrants`);
  for (const y of attendus) {
    const deux = fonds.filter((p) => Math.abs(p[1] - y) < 0.01);
    assert.equal(deux.length, 2, `encoches du repère à ${y} : ${deux.length}`);
    assert.ok(deux.some((p) => p[0] < (x1 + x2) / 2) && deux.some((p) => p[0] > (x1 + x2) / 2), "une encoche de chaque côté");
  }
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

// Style schématique : la voiture du kit en silhouette (ni phare, ni feu, ni poignée, ni rétroviseur, ni
// siège) ; le réservoir en aplats, sans reflet ni col, le bouchon posé sur son haut.
const DETAILS_PROFIL = /^(phare$|feu$|poignee-|retroviseur$|siege$|bas-de-caisse$)/;
const detailsProfil = (v) => trouverTous(v, (x) => DETAILS_PROFIL.test(x.attributs["data-r"] || "")).map((x) => x.attributs["data-r"]);

const jaune = (hex) => { const c = tsl(hex); return c.t >= 40 && c.t <= 56 && c.s >= 0.7 && c.l >= 0.4 && c.l <= 0.7; };

// Retour du formateur du 22/10/2026 : « mettre quelque chose de plus représentatif de la réalité : un thème de design et un thème
// de couleurs ; l'anneau où on vient tirer dessus est souvent jaune ».
test("niveaux : la jauge d'une voiture courante : anneau de prise jaune, troué, au-dessus d'un col jaune et de la lame d'acier", () => {
  const d = famille.DESSINS.niveaux();
  const [poignee, col, pointe] = ["poignee-jauge", "col-jauge", "pointe-jauge"].map((r) => { const x = trouverRole(d, r); assert.ok(x, `${r} absent`); return x; });
  assert.ok(jaune(poignee.attributs.fill), `anneau de teinte ${poignee.attributs.fill}, pas jaune`);
  assert.equal(col.attributs.fill, poignee.attributs.fill, "col de la teinte de l'anneau");
  // Un anneau : deux contours, le second (le trou) découpé du premier.
  assert.equal(poignee.attributs["fill-rule"], "evenodd");
  const [exterieur, trou] = String(poignee.attributs.d).split(/(?=M)/).map((t) => points(t));
  assert.ok(trou && trou.length > 2, "anneau sans trou");
  const boiteDe = (pts) => ({ x1: Math.min(...pts.map((q) => q[0])), x2: Math.max(...pts.map((q) => q[0])), y1: Math.min(...pts.map((q) => q[1])), y2: Math.max(...pts.map((q) => q[1])) });
  const [be, bt] = [boiteDe(exterieur), boiteDe(trou)];
  assert.ok(bt.x1 > be.x1 && bt.x2 < be.x2 && bt.y1 > be.y1 && bt.y2 < be.y2, "le trou est dans l'anneau");
  // Son bord se détache du fond du dessin (3:1, un élément graphique).
  assert.ok(contraste(poignee.attributs.stroke, CHARTE.fond) >= 3, `bord de l'anneau à ${contraste(poignee.attributs.stroke, CHARTE.fond).toFixed(2)}:1`);
  // L'anneau en haut, le col dessous, puis la lame, tenue pointe en bas.
  assert.ok(basDe(poignee) <= hautDe(col) + 0.01 && basDe(col) < hautDe(pointe), "anneau, col, puis lame");
  assert.ok(!jaune(pointe.attributs.fill), "lame d'acier, pas jaune");
});

test("niveaux : la zone striée occupe la lame entre MIN et MAX ; la trace d'huile s'y arrête, les stries mouillées sous elle, sèches au-dessus", () => {
  const d = famille.DESSINS.niveaux();
  const z = trouverRole(d, "stries"), [x1, x2, y1, y2] = ["data-x1", "data-x2", "data-y1", "data-y2"].map((k) => nb(z, k));
  const [mini, maxi] = ["repere-mini", "repere-maxi"].map((r) => nb(trouverRole(d, r), "data-y"));
  const lame = points(trouverRole(d, "pointe-jauge").attributs.d), largeur = Math.max(...lame.map((q) => q[0])) - Math.min(...lame.map((q) => q[0]));
  assert.ok(y1 > maxi && y2 < mini && y1 - maxi < 3 && mini - y2 < 3, `zone de ${y1} à ${y2}, repères à ${maxi} et ${mini}`);
  assert.ok(x2 - x1 >= 0.8 * largeur, `zone de ${(x2 - x1).toFixed(1)} unités sur une lame de ${largeur.toFixed(1)}`);
  const haut = hautDe(trouverRole(d, "trace-huile"));
  assert.ok(haut > y1 && haut < y2, "le haut de la trace d'huile est dans la zone striée");
  for (const [role, de, a] of [["stries-seches", y1, haut], ["stries-huile", haut, y2]]) {
    const segments = String(trouverRole(z, role).attributs.d).split(/(?=M)/).map((t) => points(t));
    // Hachures croisées : des stries dans les deux sens.
    const montantes = segments.filter(([p, q]) => (q[0] - p[0]) * (q[1] - p[1]) > 0).length;
    assert.ok(montantes >= 2 && segments.length - montantes >= 2, `${role} : ${montantes} et ${segments.length - montantes} stries par sens`);
    for (const q of segments.flat()) {
      assert.ok(q[0] >= x1 - 0.01 && q[0] <= x2 + 0.01 && q[1] >= de - 0.01 && q[1] <= a + 0.01, `${role} : point ${q} hors de sa part de la zone`);
    }
  }
  // Mouillées, les stries prennent la teinte de l'huile, plus sombre : on lit le niveau à la frontière.
  const [seches, huile] = ["stries-seches", "stries-huile"].map((r) => trouverRole(z, r).attributs.stroke);
  assert.notEqual(seches, huile);
  assert.ok(contraste(huile, trouverRole(d, "trace-huile").attributs.fill) >= 2, "stries mouillées visibles sur l'huile");
  assert.ok(contraste(seches, trouverRole(d, "pointe-jauge").attributs.fill) >= 1.8, "stries sèches visibles sur l'acier");
});

// Style schématique : la voiture du kit en silhouette ; le réservoir d'une voiture : plastique translucide, col, bouchon noir strié
// posé sur le col, tuyau de sortie sur son flanc, sans reflet.
test("niveaux : la voiture du kit en silhouette ; le réservoir : corps translucide, col, bouchon noir strié posé sur le col, tuyau sur le flanc", () => {
  const d = famille.DESSINS.niveaux();
  assert.deepEqual(detailsProfil(trouverRole(d, "voiture-profil")), [], "détails de finition de la voiture");
  const r = trouverRole(d, "reservoir");
  assert.deepEqual(trouverTous(r, (x) => x.attributs.opacity !== undefined).length, 0, "forme translucide (reflet)");
  const [corps, col, bouchon, stries, tuyau, liquide] = ["corps", "col", "bouchon-corps", "bouchon-stries", "tuyau", "liquide"]
    .map((role) => { const x = trouverRole(r, role); assert.ok(x, `${role} absent`); return x; });
  assert.ok(Math.abs(basDe(col) - hautDe(corps)) < 0.01, "col posé sur le corps");
  assert.ok(Math.abs(basDe(bouchon) - hautDe(col)) < 0.01, `bouchon à ${(hautDe(col) - basDe(bouchon)).toFixed(2)} du haut du col`);
  assert.ok(gaucheDe(bouchon) < gaucheDe(col) && droiteDe(bouchon) > droiteDe(col), "bouchon plus large que le col");
  assert.ok(gaucheDe(col) > gaucheDe(corps) && droiteDe(col) < droiteDe(corps), "col plus étroit que le corps");
  assert.ok(luminance(bouchon.attributs.fill) < 0.05, "bouchon noir");
  assert.ok(luminance(corps.attributs.fill) > 0.7, "plastique blanc translucide");
  assert.ok(String(stries.attributs.d).split(/(?=M)/).length >= 4, "bouchon strié pour la prise");
  for (const q of points(stries.attributs.d)) assert.ok(q[0] > gaucheDe(bouchon) && q[0] < droiteDe(bouchon) && q[1] > hautDe(bouchon) && q[1] < basDe(bouchon), "stries sur le bouchon");
  // Le tuyau sort du flanc droit, sous le niveau : il est plein de liquide.
  assert.ok(gaucheDe(tuyau) < droiteDe(corps) && droiteDe(tuyau) > droiteDe(corps), "tuyau sur le flanc");
  assert.ok(hautDe(tuyau) > hautDe(liquide), "tuyau sous le niveau");
  assert.equal(tuyau.attributs.fill, liquide.attributs.fill, "tuyau plein de liquide");
});

// ----- Contrôler un pneu -----

test("pneu : le témoin d'usure mesure 1,6 mm à l'échelle du morceau de bande de roulement, coté « 1,6 mm »", () => {
  const d = famille.DESSINS.pneu();
  assert.ok(Number.isFinite(famille.MM) && famille.MM > 0);
  for (const etat of ["juste", "faux"]) {
    const v = trouverRole(d, `bande-${etat}`);
    assert.ok(v, `bande de roulement (${etat}) absente`);
    const temoin = trouverRole(v, "temoin");
    const hauteur = basDe(temoin) - hautDe(temoin);
    assert.ok(Math.abs(hauteur - 1.6 * famille.MM) <= 0.1, `${etat} : témoin de ${hauteur} unités`);
    const cote = trouverRole(v, "cote");
    assert.ok(textes(cote).includes("1,6 mm"), `${etat} : cote absente`);
    assert.ok(Math.abs(nb(cote, "data-y1") - hautDe(temoin)) <= 0.1 && Math.abs(nb(cote, "data-y2") - basDe(temoin)) <= 0.1,
      `${etat} : la cote ne mesure pas le témoin`);
  }
});

test("pneu : bon, sculptures plus hautes que le témoin d'au moins 2 mm ; à remplacer, sculptures au niveau du témoin, son dessus à fleur de celui des pains", () => {
  const d = famille.DESSINS.pneu();
  const bon = trouverRole(d, "bande-juste"), use = trouverRole(d, "bande-faux");
  const sculptures = (v) => trouverTous(v, (x) => x.attributs["data-r"] === "sculpture");
  for (const v of [bon, use]) assert.ok(sculptures(v).length >= 2, "au moins deux pains de sculpture");
  const temoinBon = hautDe(trouverRole(bon, "temoin"));
  for (const s of sculptures(bon)) assert.ok(temoinBon - hautDe(s) >= 2 * famille.MM, `bon : sculpture ${temoinBon - hautDe(s)} unités au-dessus`);
  const temoinUse = hautDe(trouverRole(use, "temoin"));
  for (const s of sculptures(use)) assert.ok(Math.abs(hautDe(s) - temoinUse) <= 0.5, `à remplacer : écart ${hautDe(s) - temoinUse}`);
  // En perspective : le bord avant du dessus du témoin est au niveau de celui des pains quand il affleure, nettement dessous sinon.
  const bordAvant = (forme) => basDe(forme);
  const dessusTemoin = (v) => bordAvant(trouverRole(v, "temoin-dessus"));
  const dessusPains = (v) => trouverTous(v, (x) => x.attributs["data-r"] === "dessus-pain").map(bordAvant);
  for (const y of dessusPains(use)) assert.ok(Math.abs(y - dessusTemoin(use)) <= 0.5, "à remplacer : le témoin n'affleure pas");
  for (const y of dessusPains(bon)) assert.ok(dessusTemoin(bon) - y >= 2 * famille.MM, "bon : le témoin n'est pas au fond de la rainure");
  assert.ok(textes(use).join(" ").includes("affleure"));
});

// Retour du formateur du 22/10/2026 sur la coupe précédente : « le bas pour la sculpture, on ne comprend pas ». Un morceau de la
// bande de roulement, en perspective : deux pains vus de dessus, la rainure entre eux, le témoin, une bosse au fond de la rainure.
test("pneu : un morceau de bande de roulement en perspective : deux pains vus de dessus, la rainure entre eux, de la largeur de celles de la coupe du haut, le témoin au fond", () => {
  const d = famille.DESSINS.pneu();
  const sain = trouverRole(d, "flanc-juste"), k = nb(sain, "data-echelle");
  const rainures = trouverTous(sain, (x) => x.attributs["data-r"] === "rainure");
  assert.ok(rainures.length >= 2, "rainures de la coupe du haut absentes");
  const largeurs = rainures.map((r) => (droiteDe(r) - gaucheDe(r)) / k);
  const fonds = [];
  for (const etat of ["juste", "faux"]) {
    const v = trouverRole(d, `bande-${etat}`), temoin = trouverRole(v, "temoin");
    const rainure = (droiteDe(temoin) - gaucheDe(temoin)) / famille.MM;
    for (const l of largeurs) assert.ok(Math.abs(l - rainure) < 0.05, `${etat} : rainure de ${rainure} mm, ${l} mm en haut`);
    // Le témoin est dans la rainure : entre les faces avant des deux pains, posé sur la gomme sous la rainure.
    const [gauche, droit] = trouverTous(v, (x) => x.attributs["data-r"] === "sculpture").sort((a, b) => gaucheDe(a) - gaucheDe(b));
    assert.ok(gaucheDe(temoin) >= droiteDe(gauche) - 0.01 && droiteDe(temoin) <= gaucheDe(droit) + 0.01, `${etat} : témoin hors de la rainure`);
    assert.ok(Math.abs(basDe(temoin) - hautDe(trouverRole(v, "base"))) < 0.01, `${etat} : témoin pas posé au fond de la rainure`);
    // Les dessus des pains fuient vers le haut et la droite : chacun est un parallélogramme, décalé du même vecteur que le fond.
    const fuite = (forme) => { const q = points(forme.attributs.d); return [q[3][0] - q[0][0], q[3][1] - q[0][1]]; };
    const dessus = trouverTous(v, (x) => x.attributs["data-r"] === "dessus-pain");
    assert.equal(dessus.length, 2, `${etat} : dessus des deux pains`);
    const [fx, fy] = fuite(trouverRole(v, "fond-rainure"));
    assert.ok(fx > 0 && fy < 0, `${etat} : la longueur du morceau ne fuit pas vers le haut et la droite`);
    for (const f of dessus) { const [ax, ay] = fuite(f); assert.ok(Math.abs(ax - fx) < 0.02 && Math.abs(ay - fy) < 0.02, `${etat} : dessus de pain`); }
    // Le témoin, lui, ne va pas jusqu'au bout du morceau : la rainure continue derrière lui.
    const [tx] = fuite(trouverRole(v, "temoin-dessus"));
    assert.ok(tx > 0 && tx < fx / 2, `${etat} : témoin aussi long que la rainure`);
    fonds.push(points(trouverRole(v, "fond-rainure").attributs.d));
  }
  // Le même morceau dans les deux vignettes : le même fond de rainure, décalé d'une vignette à l'autre, au même niveau.
  const decalage = fonds[1][0][0] - fonds[0][0][0];
  fonds[0].forEach((q, i) => {
    assert.ok(Math.abs(fonds[1][i][0] - q[0] - decalage) < 0.01 && Math.abs(fonds[1][i][1] - q[1]) < 0.01, "fond de la rainure différent d'une vignette à l'autre");
  });
});

test("pneu : les noms désignent ce qu'ils nomment : « Sculptures » le dessus d'un pain, « Témoin d'usure » le dessus du témoin, hors de la cote", () => {
  const d = famille.DESSINS.pneu();
  for (const etat of ["juste", "faux"]) {
    const v = trouverRole(d, `bande-${etat}`);
    const sculptures = pointDe(trouverRole(v, "nom-sculptures")), temoin = pointDe(trouverRole(v, "nom-temoin"));
    const dessus = trouverTous(v, (x) => x.attributs["data-r"] === "dessus-pain").map((f) => points(f.attributs.d));
    assert.ok(dessus.some((poly) => dansPolygone([sculptures.x, sculptures.y], poly)), `${etat} : « Sculptures » hors du dessus des pains`);
    assert.ok(dansPolygone([temoin.x, temoin.y], points(trouverRole(v, "temoin-dessus").attributs.d)), `${etat} : « Témoin d'usure » hors du dessus du témoin`);
    // Le point ne couvre pas la cote : son liseré reste hors des traits de la cote.
    for (const l of trouverTous(trouverRole(v, "cote"), (x) => x.balise === "line")) {
      const [a, b] = [[nb(l, "x1"), nb(l, "y1")], [nb(l, "x2"), nb(l, "y2")]];
      const t = Math.max(0, Math.min(1, ((temoin.x - a[0]) * (b[0] - a[0]) + (temoin.y - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1)));
      const ecart = Math.hypot(temoin.x - a[0] - t * (b[0] - a[0]), temoin.y - a[1] - t * (b[1] - a[1]));
      assert.ok(ecart >= temoin.lisere, `${etat} : le point du témoin couvre la cote (${ecart.toFixed(2)} unité)`);
    }
  }
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

// Style schématique : la jante est une bande plate et ses rebords, sans le creux de montage ; elle ne descend pas sous le pied
// des talons de plus que son épaisseur (5,75 mm). Le pneu est d'une seule gomme, la jante d'un aplat et de son bord.
test("pneu : en pictogramme, la jante est une bande plate sous les talons, le pneu d'une seule gomme", () => {
  const d = famille.DESSINS.pneu();
  for (const etat of ["juste", "faux"]) {
    const v = trouverRole(d, `flanc-${etat}`), k = nb(v, "data-echelle");
    const jante = trouverRole(v, "jante"), pneu = trouverRole(v, "pneu");
    const pied = basDe(pneu);
    assert.ok(basDe(jante) - pied <= 5.75 * k + 0.05, `${etat} : la jante descend de ${((basDe(jante) - pied) / k).toFixed(1)} mm sous les talons`);
    assert.deepEqual(teintesFormes(pneu).length, 1, `${etat} : pneu en plusieurs tons`);
    assert.deepEqual(teintesFormes(jante).length, 2, `${etat} : jante, un aplat et son bord`);
  }
});

// La paroi du pneu est plus mince que le point d'une étiquette : le point se pose hors de la gomme et la touche, sans couvrir
// la paroi.
test("pneu : le point des noms « Flanc » et « Hernie » touche la paroi de l'extérieur, sans la couvrir", () => {
  const d = famille.DESSINS.pneu();
  for (const [vignette, role] of [["flanc-juste", "nom-flanc"], ["flanc-faux", "nom-hernie"]]) {
    const v = trouverRole(d, vignette), p = pointDe(trouverRole(v, role));
    const contour = points(trouverRole(v, "pneu").attributs.d);
    assert.ok(!dansPolygone([p.x, p.y], contour), `${role} : point dans la gomme`);
    assert.ok(distanceContour([p.x, p.y], contour) <= p.rayon, `${role} : point à ${distanceContour([p.x, p.y], contour).toFixed(2)} du flanc`);
  }
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
  const echelle = (x - nb(roueAvant, "data-x")) / VOITURE_PROFIL.essieuAvant;
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

// Style schématique : la voiture du kit en silhouette ; chaque étiquette reste entière sur la pièce qu'elle désigne, le montant
// découvert par la portière et la face intérieure de la trappe ouverte, toutes deux dessinées.
test("pression : en pictogramme, la voiture du kit en silhouette ; chaque étiquette entière sur le montant et sur le volet de la trappe", () => {
  const d = famille.DESSINS.pression();
  const v = trouverRole(d, "voiture-profil");
  assert.deepEqual(detailsProfil(v), [], "détails de finition de la voiture");
  const montant = points(trouverRole(trouverRole(v, "portiere-ouverte"), "montant").attributs.d);
  const volet = points(trouverRole(trouverRole(v, "trappe-ouverte"), "volet").attributs.d);
  for (const [role, piece] of [["etiquette-montant", montant], ["etiquette-trappe", volet]]) {
    const coinsEtiquette = points(trouverRole(d, role).attributs.d);
    for (const p of coinsEtiquette) assert.ok(dansPolygone(p, piece), `${role} : point ${p} hors de sa pièce`);
  }
});

// ----- Typographie -----

test("entretien : aucune ligne ne finit par un article ou une préposition courte", () => {
  const mots = new Set(["de", "la", "le", "les", "du", "des", "à", "au", "aux", "un", "une", "et", "ou", "en", "sur"]);
  for (const code of codes) {
    for (const t of textes(famille.DESSINS[code]())) {
      const dernier = t.trim().split(/\s+/).pop().toLowerCase();
      assert.ok(!mots.has(dernier) && !/'$/.test(dernier), `${code} : ligne « ${t} »`);
    }
  }
});
