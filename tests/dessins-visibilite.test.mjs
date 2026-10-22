import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-visibilite.js";
import { SOURCES } from "../sources/dessins-visibilite.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { reperesProfil, reperesDessus, voitureDessus, voitureProfil, TEINTES_ROUTE, VOITURE, CHARTE, MATIERES } from "../js/dessins-kit.js";
import { REGARD_PORTEE, oeil as oeilScene } from "../js/scene-regard.js";
import { TEINTES } from "../js/scene-rendu.js";
import { OPACITE_CONE } from "../js/scene-moteur.js";
import { cycliste, GABARIT_VELO, TEINTES_VELO } from "../js/piece-cycliste.js";
import { versChaine } from "../js/dessin-svg.js";
import { GABARITS } from "../js/scene-geometrie.js";
import { DESSIN, IISR } from "../js/scene-decors.js";
import * as conducteur from "../js/dessins-conducteur.js";
import { imageA } from "../js/geste-regles.js";

const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "visibilite");

test("visibilite : chaque code du catalogue est dessiné et passe les contrôles communs", () => {
  for (const code of codes) {
    const e = CATALOGUE[code];
    if (e.bloc === "dessin") assert.deepEqual(verifierDessin(famille.DESSINS[code](), e.cadre), [], code);
    else assert.deepEqual(verifierGeste(famille.GESTES[code].construire(), e), [], code);
  }
  const fournis = [...Object.keys(famille.DESSINS), ...Object.keys(famille.GESTES || {})].sort();
  assert.deepEqual(fournis, [...codes].sort());
});

test("visibilite : chaque dessin a ses sources, dont ses choix de dessin", () => {
  for (const code of codes) {
    assert.ok(Array.isArray(SOURCES[code]) && SOURCES[code].length >= 2, code);
    assert.ok(SOURCES[code].some((s) => s.startsWith("Choix de dessin")), code);
  }
});

// ===== Aides de géométrie =====
// Points d'un tracé « M x y L x y ... Z » (plusieurs sous-tracés possibles, ici concaténés).
const pointsDe = (d) => {
  const v = String(d).match(/-?\d+(?:\.\d+)?/g).map(Number);
  return v.flatMap((_, i) => (i % 2 ? [] : [[v[i], v[i + 1]]]));
};
const pointsRole = (racine, role) => {
  const n = trouverRole(racine, role);
  assert.ok(n, `rôle ${role} absent`);
  return pointsDe(n.attributs.d);
};
// Points d'un nœud dessiné : les sommets d'un tracé, les coins d'un rectangle.
const pointsNoeud = (n) => (n.balise === "rect"
  ? [["x", "y"], ["x+", "y"], ["x+", "y+"], ["x", "y+"]].map(([kx, ky]) => [Number(n.attributs.x) + (kx === "x+" ? Number(n.attributs.width) : 0),
    Number(n.attributs.y) + (ky === "y+" ? Number(n.attributs.height) : 0)])
  : pointsDe(n.attributs.d));
// Points d'un groupe posé par son transform (translate, rotate en degrés, scale), dans le cadre : ceux de ses rectangles, tracés et
// lignes brisées, et les coins de la boîte de chaque ellipse ou cercle (qui le contient).
function pointsPoses(g) {
  const t = String(g.attributs.transform || "");
  const tr = t.match(/translate\(([-\d.]+) ([-\d.]+)\)/), ro = t.match(/rotate\(([-\d.]+)\)/), sc = t.match(/scale\(([-\d.]+)\)/);
  const [tx, ty] = tr ? [Number(tr[1]), Number(tr[2])] : [0, 0], a = ro ? (Number(ro[1]) * Math.PI) / 180 : 0, k = sc ? Number(sc[1]) : 1;
  const poser = ([px, py]) => [tx + k * (px * Math.cos(a) - py * Math.sin(a)), ty + k * (px * Math.sin(a) + py * Math.cos(a))];
  return trouverTous(g, (x) => x !== g).flatMap((x) => {
    if (x.balise === "polyline") return String(x.attributs.points).trim().split(/\s+/).map((c) => c.split(",").map(Number));
    if (x.balise === "ellipse" || x.balise === "circle") {
      const [cx, cy, rx, ry] = x.balise === "circle" ? ["cx", "cy", "r", "r"].map((c) => Number(x.attributs[c]))
        : ["cx", "cy", "rx", "ry"].map((c) => Number(x.attributs[c]));
      return [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry]];
    }
    return x.balise === "rect" || x.balise === "path" ? pointsNoeud(x) : [];
  }).map(poser);
}
const boite = (pts) => ({
  x1: Math.min(...pts.map((p) => p[0])), x2: Math.max(...pts.map((p) => p[0])),
  y1: Math.min(...pts.map((p) => p[1])), y2: Math.max(...pts.map((p) => p[1])),
});
// Distance du point p à la droite (a, b).
const distanceDroite = (p, a, b) => Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
const aireSignee = (poly) => poly.reduce((s, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;
const aire = (poly) => Math.abs(aireSignee(poly));
// Partie du polygone `sujet` dans le polygone convexe `convexe` (Sutherland et Hodgman).
function dansConvexe(sujet, convexe) {
  const o = Math.sign(aireSignee(convexe));
  let r = sujet;
  for (let i = 0; i < convexe.length && r.length; i++) {
    const a = convexe[i], b = convexe[(i + 1) % convexe.length];
    const f = (p) => o * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));   // >= 0 : du côté intérieur
    const sortie = [];
    for (let k = 0; k < r.length; k++) {
      const p = r[k], q = r[(k + 1) % r.length], fp = f(p), fq = f(q);
      if (fp >= 0) sortie.push(p);
      if ((fp > 0 && fq < 0) || (fp < 0 && fq > 0)) {
        const t = fp / (fp - fq);
        sortie.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    r = sortie;
  }
  return r;
}
const dansPolygoneConvexe = (p, poly, marge = 0) => {
  const o = Math.sign(aireSignee(poly));
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return (o * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]))) / Math.hypot(b[0] - a[0], b[1] - a[1]) >= marge;
  });
};
// Étendue en x d'un polygone convexe sur la ligne d'ordonnée y (null si elle ne le coupe pas).
function etendueA(poly, y) {
  const xs = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    if ((p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1]) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
  });
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
}
const textes = (racine) => trouverTous(racine, (x) => x.balise === "text").map(texteDe);
const DEG = Math.PI / 180;

// ===== Ce qu'on ne voit pas depuis le siège =====
const VUES = (d) => ["detail", "ensemble"].map((nom) => {
  const g = trouverRole(d, nom);
  assert.ok(g, `vue ${nom} absente`);
  const [x, sol, echelle] = ["data-x", "data-y", "data-echelle"].map((k) => Number(g.attributs[k]));
  return { nom, g, sol, echelle, r: reperesProfil({ x, y: sol, echelle, sens: "gauche" }) };
});
const ligne = (g, role) => {
  const l = trouverRole(trouverRole(g, role), "ligne");
  assert.ok(l, `${role} sans ligne`);
  return [[Number(l.attributs.x1), Number(l.attributs.y1)], [Number(l.attributs.x2), Number(l.attributs.y2)]];
};

test("zones-invisibles : chaque ligne de visée part de l'œil, passe par le repère qu'elle frôle (haut du capot, haut du coffre) et touche le sol, à 0,5 unité près", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  for (const v of VUES(d)) {
    const lignes = [["visee-avant", v.r.hautCapot]];
    if (v.nom === "ensemble") lignes.push(["visee-arriere", v.r.hautCoffre]);
    else assert.equal(trouverRole(v.g, "visee-arriere"), null, "le détail ne montre que l'avant");
    for (const [role, repere] of lignes) {
      const [a, b] = ligne(v.g, role);
      assert.ok(Math.hypot(a[0] - v.r.oeil[0], a[1] - v.r.oeil[1]) <= 0.5, `${v.nom}, ${role} : départ ${a} loin de l'œil ${v.r.oeil}`);
      assert.ok(distanceDroite(repere, a, b) <= 0.5, `${v.nom}, ${role} : le repère ${repere} est à ${distanceDroite(repere, a, b).toFixed(2)} unité de la ligne`);
      assert.ok((repere[0] - a[0]) * (repere[0] - b[0]) < 0, `${v.nom}, ${role} : le repère n'est pas entre l'œil et le sol`);
      assert.ok(Math.abs(b[1] - v.sol) <= 0.5, `${v.nom}, ${role} : la ligne s'arrête à ${b[1]}, le sol est à ${v.sol}`);
    }
  }
});

// La zone : un polygone dont les points posés au sol vont de la voiture au point où la ligne de visée touche le sol, et dont
// les autres points sont sur la ligne de visée (elle en est le bord haut).
function verifierZone(v, role, [a, b], bordVoiture) {
  const pts = pointsRole(trouverRole(v.g, role), "zone");
  const auSol = pts.filter((p) => Math.abs(p[1] - v.sol) <= 0.01).map((p) => p[0]);
  assert.ok(auSol.length >= 2, `${v.nom}, ${role} : pas de bord au sol`);
  const [min, max] = [Math.min(...auSol), Math.max(...auSol)];
  const attendu = [Math.min(b[0], bordVoiture), Math.max(b[0], bordVoiture)];
  assert.ok(Math.abs(min - attendu[0]) <= 0.5 && Math.abs(max - attendu[1]) <= 0.5,
    `${v.nom}, ${role} : au sol de ${min.toFixed(1)} à ${max.toFixed(1)}, attendu de ${attendu[0].toFixed(1)} à ${attendu[1].toFixed(1)}`);
  for (const p of pts.filter((q) => Math.abs(q[1] - v.sol) > 0.01)) {
    assert.ok(distanceDroite(p, a, b) <= 0.5, `${v.nom}, ${role} : le point ${p} n'est ni au sol ni sur la ligne de visée`);
  }
}

test("zones-invisibles : la zone avant s'étend de l'avant de la voiture au point où la ligne de visée touche le sol, sous cette ligne", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  for (const v of VUES(d)) verifierZone(v, "zone-avant", ligne(v.g, "visee-avant"), v.r.solAvant[0]);
});

test("zones-invisibles : la zone arrière s'étend de l'arrière de la voiture au point où la ligne de visée touche le sol, dans le cadre", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  const v = VUES(d).find((x) => x.nom === "ensemble");
  const l = ligne(v.g, "visee-arriere");
  verifierZone(v, "zone-arriere", l, v.r.solArriere[0]);
  const [L] = CATALOGUE["zones-invisibles"].cadre;
  assert.ok(l[1][0] > 0 && l[1][0] < L, "le point où la ligne de visée arrière touche le sol est dans le cadre");
});

test("zones-invisibles : l'obstacle est posé au sol dans la zone avant, entièrement sous la ligne de visée", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  const v = VUES(d).find((x) => x.nom === "detail");
  const [a, b] = ligne(v.g, "visee-avant");
  const obstacle = trouverRole(d, "obstacle");
  const pts = trouverTous(obstacle, (x) => x.balise === "path").flatMap((x) => pointsDe(x.attributs.d));
  assert.ok(pts.length > 0, "obstacle sans tracé");
  const hauteurLigne = (x) => a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  for (const p of pts) assert.ok(p[1] > hauteurLigne(p[0]), `le point ${p} de l'obstacle dépasse la ligne de visée`);
  const bo = boite(pts);
  assert.ok(Math.abs(bo.y2 - v.sol) <= 0.01, "posé au sol");
  assert.ok(bo.x1 > b[0] && bo.x2 < v.r.solAvant[0], "dans la zone avant, devant la voiture");
});

// Le disque le plus grand d'une étiquette : son point et le liseré qui le borde.
const disqueEtiquette = (racine, role) => trouverTous(trouverRole(racine, role), (x) => x.balise === "circle")
  .map((c) => [Number(c.attributs.cx), Number(c.attributs.cy), Number(c.attributs.r)]).reduce((m, c) => (c[2] > m[2] ? c : m));

test("zones-invisibles : l'obstacle se reconnaît sur un téléphone et le point de son étiquette n'en cache presque rien", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  const [L] = CATALOGUE["zones-invisibles"].cadre;
  const cone = pointsRole(d, "cone"), bo = boite(cone);
  assert.ok((bo.y2 - bo.y1) * (343 / L) >= 14, `cône de ${((bo.y2 - bo.y1) * (343 / L)).toFixed(1)} px de haut à 343 px`);
  // Part de la surface du cône sous le disque, par un quadrillage.
  const disque = disqueEtiquette(d, "nom-obstacle");
  let dedans = 0, caches = 0;
  const pas = 0.1;
  for (let x = bo.x1; x <= bo.x2; x += pas) {
    for (let y = bo.y1; y <= bo.y2; y += pas) {
      if (!dansPolygoneConvexe([x, y], cone)) continue;
      dedans++;
      if (Math.hypot(x - disque[0], y - disque[1]) < disque[2]) caches++;
    }
  }
  assert.ok(caches / dedans < 0.1, `le point de l'étiquette cache ${((100 * caches) / dedans).toFixed(0)} % du cône`);
});

test("zones-invisibles : le point de l'étiquette de l'obstacle laisse voir l'écart entre la pointe et la ligne de visée (2 unités entre les liserés)", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  const v = VUES(d).find((x) => x.nom === "detail");
  const [a, b] = ligne(v.g, "visee-avant");
  const lisere = trouverRole(trouverRole(v.g, "visee-avant"), "lisere-ligne");
  const demiLargeur = Number(lisere.attributs["stroke-width"]) / 2;
  const [cx, cy, r] = disqueEtiquette(d, "nom-obstacle");
  const ecart = distanceDroite([cx, cy], a, b) - r - demiLargeur;
  assert.ok(ecart >= 2, `${ecart.toFixed(2)} unité entre le liseré du point et celui de la ligne de visée`);
});

test("zones-invisibles : l'œil est nommé, et les zones portent les mots du cours", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  const v = VUES(d).find((x) => x.nom === "detail");
  const nomOeil = trouverRole(d, "nom-oeil");
  assert.deepEqual([Number(nomOeil.attributs["data-x"]), Number(nomOeil.attributs["data-y"])], v.r.oeil);
  const t = textes(d);
  for (const mot of ["Œil du conducteur", "Obstacle caché", "Non visible", "Devant le capot", "Derrière le coffre"]) assert.ok(t.includes(mot), mot);
});

// ===== Le rétroviseur extérieur : une seule définition, recalculée ici sans le module =====
// Miroir plan du kit : verre de 2 (RETRO.centre - RETRO.pied), centré sur le miroir, normale bissectrice de l'œil et de l'arrière ;
// champ = angle sous lequel l'œil voit le verre ; image en projection perpendiculaire à l'axe, vue de l'œil reflété (devant le
// miroir, à la distance de l'œil), la direction de l'arrière fuyant à la part p de la largeur depuis le bord intérieur :
// atan(p W / f) + atan((1 - p) W / f) = champ.
function miroirAttendu(cote) {
  const R = VOITURE.retroviseur, O = VOITURE.oeil, sg = cote === "gauche" ? -1 : 1;
  const M = [R.miroir, sg * R.centre], E = [O.avant, -O.gauche], demi = R.centre - R.pied;
  const vers = [E[0] - M[0], E[1] - M[1]], l = Math.hypot(...vers);
  const bis = [vers[0] / l - 1, vers[1] / l], lb = Math.hypot(...bis);
  const t = [-bis[1] / lb, bis[0] / lb];
  const p1 = [M[0] + demi * t[0], M[1] + demi * t[1]], p2 = [M[0] - demi * t[0], M[1] - demi * t[1]];
  const [interieur, exterieur] = Math.abs(p1[1]) < Math.abs(p2[1]) ? [p1, p2] : [p2, p1];
  const champ = Math.abs(Math.atan2(p1[1] - E[1], p1[0] - E[0]) - Math.atan2(p2[1] - E[1], p2[0] - E[0])) / DEG;
  return { sg, M, reflet: [M[0] + l, M[1]], champ, verre: { interieur, exterieur } };
}
const champAttendu = (cote) => miroirAttendu(cote).champ;
// La caisse vue de l'œil reflété P : le point T de l'arrondi du coin arrière que frôle le rayon issu de P, pris depuis P (la
// tangente à un cercle de rayon r, vue à la distance d de son centre, s'écarte de la direction du centre de asin(r / d)), du côté
// extérieur ; la ligne de ceinture du kit (le bas des vitres, droite prolongée).
function coinAttendu(cote) {
  const { sg, reflet: P } = miroirAttendu(cote), r = VOITURE.rayon;
  const C = [-(VOITURE.longueur / 2 - r), sg * (VOITURE.largeur / 2 - r)];
  const w = [C[0] - P[0], C[1] - P[1]], dist = Math.hypot(...w), g = Math.asin(r / dist), lg = Math.sqrt(dist * dist - r * r);
  const T = [g, -g].map((a) => {
    const dir = [(w[0] * Math.cos(a) - w[1] * Math.sin(a)) / dist, (w[0] * Math.sin(a) + w[1] * Math.cos(a)) / dist];
    return [P[0] + lg * dir[0], P[1] + lg * dir[1]];
  }).reduce((m, q) => (sg * q[1] > sg * m[1] ? q : m));
  return { P, T, flanc: Math.abs(P[1]) - Math.abs(T[1]), recul: P[0] - T[0] };
}
// Une image de rétroviseur extérieur lue dans le dessin : verre, côté de la caisse (s = 1 si elle est à droite de l'image),
// bord intérieur, point de fuite, focale, horizon, hauteur de l'œil reflété.
function imageDe(r, role) {
  const g = trouverRole(r, role);
  assert.ok(g, `${role} absent`);
  const v = boite(pointsRole(g, "verre")), s = role.includes("gauche") ? 1 : -1;
  return { g, v, s, W: v.x2 - v.x1, interieur: s > 0 ? v.x2 : v.x1, fuite: Number(g.attributs["data-fuite"]), f: Number(g.attributs["data-focale"]),
    yH: boite(pointsRole(g, "route")).y1, h: Number(g.attributs["data-hauteur"]) };
}
const IMAGES = [["miroir-gauche", "gauche"], ["miroir-droit", "droit"]];

test("retroviseurs et angles-morts : le champ de chaque rétroviseur extérieur est celui du miroir plan du kit, le même dans les deux dessins", () => {
  const r = famille.DESSINS.retroviseurs(), a = famille.DESSINS["angles-morts"]();
  for (const cote of ["gauche", "droit"]) {
    const attendu = champAttendu(cote);
    assert.ok(attendu > 1 && attendu < 20, `${cote} : champ de miroir plan plausible (${attendu.toFixed(2)} degrés)`);
    // retroviseurs : le champ annoncé, et la focale de l'image qui le tient dans la largeur avec le point de fuite dessiné.
    for (const [role] of IMAGES.filter((i) => i[1] === cote)) {
      const im = imageDe(r, role), { f, W } = im;
      assert.ok(Math.abs(Number(im.g.attributs["data-champ"]) - attendu) < 1e-6, `${role} : champ ${im.g.attributs["data-champ"]} au lieu de ${attendu}`);
      const part = (im.s * (im.interieur - im.fuite)) / W;
      assert.ok(part > 0 && part < 1, `${role} : point de fuite dans l'image`);
      const champImage = (Math.atan((part * W) / f) + Math.atan(((1 - part) * W) / f)) / DEG;
      assert.ok(Math.abs(champImage - attendu) < 1e-3, `${role} : l'image couvre ${champImage.toFixed(3)} degrés au lieu de ${attendu.toFixed(3)}`);
      assert.ok(Math.abs(Number(im.g.attributs["data-lisere"]) - Math.atan((part * W) / f) / DEG) < 1e-6, `${role} : angle du liseré`);
      // La route fuit vers ce point : un bord de chaussée part du point de fuite, sur l'horizon ; chaque point d'un trait de
      // l'axiale est à f h / D sous l'horizon et à f l / D du point de fuite, pour D et l dans le trait (à 1 cm près).
      const bords = ["bord-chaussee", "bord-en-face"].map((b) => trouverRole(im.g, b)).filter(Boolean);
      assert.ok(bords.length >= 1, `${role} : un bord de chaussée`);
      for (const b of bords) {
        assert.ok(pointsDe(b.attributs.d).some((p) => Math.hypot(p[0] - im.fuite, p[1] - im.yH) < 0.02), `${role} : le bord de chaussée ne part pas du point de fuite`);
      }
      for (const tiret of trouverTous(im.g, (x) => x.attributs["data-r"] === "tiret")) {
        const [d1, d2, l] = ["data-d1", "data-d2", "data-l"].map((k) => Number(tiret.attributs[k]));
        for (const p of pointsDe(tiret.attributs.d)) {
          const D = (f * im.h) / (p[1] - im.yH), lat = (im.s * (im.fuite - p[0]) * D) / f;
          assert.ok(D >= d1 - 0.05 && D <= d2 + 0.05, `${role} : point ${p} d'un trait de ${d1} à ${d2} m, à ${D.toFixed(2)} m`);
          assert.ok(lat >= l - 0.01 && lat <= l + 0.1 + 0.01, `${role} : point ${p} d'un trait à ${l} m du miroir, à ${lat.toFixed(3)} m`);
        }
      }
    }
    // angles-morts : le champ dessiné a l'ouverture du même miroir, son bord extérieur tourné de l'angle du liseré.
    const champ = trouverRole(a, `champ-${cote}`);
    assert.ok(Math.abs(Number(champ.attributs["data-champ"]) - attendu) < 1e-6, `angles-morts, ${cote} : champ annoncé`);
    const ext = trouverRole(a, `bord-${cote}`), lisere = Number(trouverRole(r, `miroir-${cote}`).attributs["data-lisere"]);
    const direction = (l) => Math.atan2(Number(l.attributs.x2) - Number(l.attributs.x1), Number(l.attributs.y2) - Number(l.attributs.y1)) / DEG;
    // Cap vers le haut : l'arrière est la direction (0, 1) du cadre ; un angle vers l'extérieur se compte du côté du miroir.
    const sg = cote === "gauche" ? -1 : 1;
    assert.ok(Math.abs(sg * direction(ext) - (attendu - lisere)) < 0.05, `angles-morts, ${cote} : bord extérieur à ${(sg * direction(ext)).toFixed(2)} degrés`);
    const pts = pointsRole(a, `champ-${cote}`);
    assert.ok(pts.length >= 3, `angles-morts, ${cote} : champ dessiné`);
  }
});

// ===== Régler les rétroviseurs =====
// Retour du formateur du 22/10/2026 : d'abord le rétroviseur intérieur, puis les extérieurs ; dans ceux-ci, la ligne d'horizon au
// milieu, et la poignée de la portière arrière dans le coin inférieur côté voiture (en bas à droite du gauche, en bas à gauche du
// droit), très nette, ou pas de dessin.
function miroir(d, role) {
  const g = trouverRole(d, role);
  assert.ok(g, `${role} absent`);
  const verre = boite(pointsRole(g, "verre"));
  return { g, verre, largeur: verre.x2 - verre.x1, hauteur: verre.y2 - verre.y1, milieu: (verre.y1 + verre.y2) / 2 };
}
// Les deux miroirs extérieurs et le côté de leur voiture : le bord intérieur du verre, à droite du gauche, à gauche du droit.
const EXTERIEURS = [["miroir-gauche", "droite"], ["miroir-droit", "gauche"]];
const bordInterieur = (m, cote) => (cote === "droite" ? m.verre.x2 : m.verre.x1);
// Un polygone sans ses points répétés (un découpage en laisse) : un côté de longueur nulle n'a pas de direction.
const sansDoublons = (poly) => poly.filter((p, i) => Math.hypot(p[0] - poly[(i + 1) % poly.length][0], p[1] - poly[(i + 1) % poly.length][1]) > 1e-6);
// Contraste de deux teintes (#RRGGBB), au sens des WCAG.
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

test("retroviseurs : deux temps dans l'ordre, 1 le rétroviseur intérieur, puis 2 les extérieurs (numéros, place, ordre de lecture, description)", () => {
  const d = famille.DESSINS.retroviseurs();
  const [t1, t2] = ["temps-1", "temps-2"].map((r) => trouverRole(d, r));
  assert.ok(t1 && t2, "deux temps");
  assert.deepEqual(textes(trouverRole(t1, "numero-1")), ["1"]);
  assert.deepEqual(textes(trouverRole(t2, "numero-2")), ["2"]);
  assert.ok(trouverRole(t1, "miroir-interieur") && !trouverRole(t1, "miroir-gauche") && !trouverRole(t1, "miroir-droit"), "1 : l'intérieur seul");
  assert.ok(trouverRole(t2, "miroir-gauche") && trouverRole(t2, "miroir-droit") && !trouverRole(t2, "miroir-interieur"), "2 : les extérieurs seuls");
  assert.deepEqual(textes(trouverRole(t1, "legende-1")), ["Rétroviseur intérieur", "toute la lunette arrière"]);
  assert.deepEqual(textes(trouverRole(t2, "legende-2")), ["Rétroviseurs extérieurs", "l'horizon au milieu"]);
  // Le temps 1 au-dessus du temps 2, lu avant lui, et dit avant lui.
  const [c1, c2] = [t1, t2].map((t) => trouverRole(t, "carte").attributs).map((a) => ({ y1: Number(a.y), y2: Number(a.y) + Number(a.height) }));
  assert.ok(c1.y2 <= c2.y1, `carte 1 de ${c1.y1} à ${c1.y2}, carte 2 dès ${c2.y1}`);
  const ordre = trouverTous(d, () => true);
  assert.ok(ordre.indexOf(t1) < ordre.indexOf(t2), "le temps 1 se lit avant le temps 2");
  const description = d.attributs["aria-label"];
  const [i1, i2] = ["1 : le rétroviseur intérieur", "2 : les rétroviseurs extérieurs"].map((m) => description.indexOf(m));
  assert.ok(i1 >= 0 && i2 > i1, "la description dit l'intérieur, puis les extérieurs");
  // Les extérieurs comme le conducteur les voit : le gauche à gauche, chacun sous son nom.
  const [g, dr] = ["miroir-gauche", "miroir-droit"].map((r) => miroir(d, r));
  assert.ok(g.verre.x2 < dr.verre.x1, "le gauche à gauche du droit");
  for (const [m, role, mot] of [[g, "nom-gauche", "Gauche"], [dr, "nom-droit", "Droit"]]) {
    const nom = trouverRole(d, role);
    assert.equal(texteDe(nom), mot);
    assert.ok(Math.abs(Number(nom.attributs.x) - (m.verre.x1 + m.verre.x2) / 2) < 0.01 && Number(nom.attributs.y) < m.verre.y1, `${mot} au-dessus de son miroir`);
  }
});

test("retroviseurs : dans chaque miroir extérieur, l'horizon au milieu de la hauteur du verre (ciel dessus, route dessous, ligne d'horizon, repères de mi-hauteur), à 0,01 unité près", () => {
  const d = famille.DESSINS.retroviseurs();
  for (const [role] of EXTERIEURS) {
    const m = miroir(d, role), route = boite(pointsRole(m.g, "route"));
    assert.ok(Math.abs(route.y1 - m.milieu) < 0.01, `${role} : horizon à ${(((route.y1 - m.verre.y1) / m.hauteur) * 100).toFixed(1)} % de la hauteur`);
    assert.ok(Math.abs(route.y2 - m.verre.y2) < 0.01, `${role} : la route jusqu'au bas du verre`);
    const h = trouverRole(m.g, "horizon").attributs;
    assert.ok([h.y1, h.y2].every((y) => Math.abs(Number(y) - m.milieu) < 0.01), `${role} : ligne d'horizon hors du milieu`);
    assert.ok(Math.abs(Number(h.x1) - m.verre.x1) < 0.01 && Math.abs(Number(h.x2) - m.verre.x2) < 0.01, `${role} : la ligne d'horizon traverse le verre`);
    const reperes = trouverTous(m.g, (x) => x.attributs["data-r"] === "mi-hauteur").map((x) => x.attributs);
    assert.equal(reperes.length, 2, `${role} : deux repères de mi-hauteur`);
    for (const r of reperes) assert.ok(Math.abs(Number(r.y1) - m.milieu) < 0.01 && Math.abs(Number(r.y2) - m.milieu) < 0.01, `${role} : repère hors du milieu`);
    assert.ok(reperes.some((r) => Number(r.x2) < m.verre.x1) && reperes.some((r) => Number(r.x1) > m.verre.x2), `${role} : un repère de chaque côté, hors du verre`);
    assert.ok(boite(pointsRole(m.g, "caisse")).y1 >= m.milieu - 0.01, `${role} : la caisse ne monte pas au-dessus de l'horizon`);
  }
});

test("retroviseurs : la poignée de la portière arrière, entière dans le coin inférieur côté voiture (en bas à droite du gauche, en bas à gauche du droit), sur la caisse", () => {
  const d = famille.DESSINS.retroviseurs();
  for (const [role, cote] of EXTERIEURS) {
    const m = miroir(d, role), p = boite(pointsRole(m.g, "poignee")), xi = bordInterieur(m, cote);
    const loin = Math.max(Math.abs(p.x1 - xi), Math.abs(p.x2 - xi)), pres = Math.min(Math.abs(p.x1 - xi), Math.abs(p.x2 - xi));
    assert.ok(loin <= m.largeur / 3, `${role} : la poignée va à ${((100 * loin) / m.largeur).toFixed(0)} % de la largeur depuis le bord ${cote}`);
    assert.ok(pres >= 3, `${role} : la poignée colle au bord du verre (${pres.toFixed(1)} unités)`);
    assert.ok(p.y1 >= m.verre.y1 + 0.6 * m.hauteur, `${role} : le haut de la poignée à ${(((p.y1 - m.verre.y1) / m.hauteur) * 100).toFixed(0)} % de la hauteur`);
    assert.ok((p.y1 + p.y2) / 2 >= m.verre.y1 + 0.75 * m.hauteur, `${role} : la poignée hors du quart bas`);
    assert.ok(m.verre.y2 - p.y2 >= 3, `${role} : la poignée colle au bas du verre`);
    const caisse = sansDoublons(pointsRole(m.g, "caisse"));
    for (const q of pointsRole(m.g, "poignee")) assert.ok(dansPolygoneConvexe(q, caisse, 1.5), `${role} : le point ${q} de la poignée n'est pas sur la caisse`);
  }
});

test("retroviseurs : la poignée est dans le coin où le miroir plan du kit la montre (le quart bas, le quart côté voiture), ce qu'il ne ferait que d'un trait", () => {
  const d = famille.DESSINS.retroviseurs();
  // La poignée arrière de la voiture du kit de profil (relue sur son tracé, à 100 unités par mètre) : de X1 à X2, de z1 à z2.
  const pts = pointsRole(voitureProfil({ x: 0, y: 0, echelle: 100, sens: "droite" }), "poignee-arriere").map(([x, y]) => [x / 100, -y / 100]);
  const b = boite(pts);
  for (const [role, cote] of EXTERIEURS) {
    const im = imageDe(d, role), m = miroir(d, role), { P } = coinAttendu(role === "miroir-gauche" ? "gauche" : "droit");
    const flanc = Math.abs(P[1]) - VOITURE.largeur / 2;
    // Vue de l'œil reflété P, le flanc à `flanc` en dedans de lui : un point de la poignée au recul D est à f flanc / D du point de
    // fuite vers la caisse, et à f (h - z) / D sous l'horizon.
    const D = P[0] - (b.x1 + b.x2) / 2, z = (b.y1 + b.y2) / 2;
    const xModele = im.fuite + (im.s * im.f * flanc) / D, yModele = im.yH + (im.f * (im.h - z)) / D;
    const xi = bordInterieur(m, cote), partX = (x) => Math.abs(x - xi) / m.largeur, partY = (y) => (y - m.verre.y1) / m.hauteur;
    assert.ok(partX(xModele) < 0.25 && partY(yModele) > 0.75, `${role} : le modèle met la poignée à ${(100 * partX(xModele)).toFixed(0)} % et ${(100 * partY(yModele)).toFixed(0)} %`);
    const p = boite(pointsRole(m.g, "poignee")), centre = [(p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2];
    assert.ok(partX(centre[0]) < 0.25 && partY(centre[1]) > 0.75, `${role} : la poignée dessinée hors du coin du modèle`);
    // Le modèle exact n'en montrerait qu'un trait : moins d'une unité de large.
    const large = im.f * flanc * (1 / (P[0] - b.x2) - 1 / (P[0] - b.x1));
    assert.ok(large < 1 && p.x2 - p.x1 >= 15 * large, `${role} : ${large.toFixed(2)} unité de large dans le modèle, ${(p.x2 - p.x1).toFixed(1)} dessinées`);
  }
});

test("retroviseurs : la poignée se lit sur un téléphone (taille, contraste, levier), et le point de son étiquette la désigne sans la couvrir", () => {
  const d = famille.DESSINS.retroviseurs();
  const [L] = CATALOGUE.retroviseurs.cadre, px = 343 / L;
  const rayon = (x) => Math.max(...trouverTous(x, (y) => y.balise === "circle").map((c) => Number(c.attributs.r)));
  const ancres = new Set();
  for (const [role] of EXTERIEURS) {
    const m = miroir(d, role), noeud = trouverRole(m.g, "poignee"), p = boite(pointsDe(noeud.attributs.d));
    assert.ok((p.x2 - p.x1) * px >= 18 && (p.y2 - p.y1) * px >= 6.5, `${role} : poignée de ${((p.x2 - p.x1) * px).toFixed(1)} sur ${((p.y2 - p.y1) * px).toFixed(1)} px`);
    const levier = trouverRole(m.g, "levier"), l = boite(pointsDe(levier.attributs.d));
    assert.ok(l.x1 > p.x1 && l.x2 < p.x2 && l.y1 > p.y1 && l.y2 < p.y2, `${role} : le levier dans son creux`);
    assert.ok((l.x2 - l.x1) * px >= 12 && (l.y2 - l.y1) * px >= 2, `${role} : levier trop petit`);
    const caisse = trouverRole(m.g, "caisse").attributs.fill;
    assert.ok(contraste(noeud.attributs.fill, caisse) >= 3, `${role} : creux à ${contraste(noeud.attributs.fill, caisse).toFixed(2)}:1 sur la caisse`);
    assert.ok(contraste(levier.attributs.fill, noeud.attributs.fill) >= 3, `${role} : levier à ${contraste(levier.attributs.fill, noeud.attributs.fill).toFixed(2)}:1 sur le creux`);
    // L'étiquette : son point juste sous la poignée, dans sa longueur, sans la toucher (liseré compris).
    const e = trouverRole(d, `nom-poignee-${role.slice("miroir-".length)}`);
    const [cx, cy] = [Number(e.attributs["data-x"]), Number(e.attributs["data-y"])], r = rayon(e);
    assert.ok(cx > p.x1 && cx < p.x2, `${role} : le point n'est pas sous la poignée`);
    assert.ok(cy - p.y2 >= r && cy - p.y2 <= r + 1, `${role} : le point à ${(cy - p.y2).toFixed(2)} unité du bas de la poignée, rayon ${r}`);
    const filet = trouverRole(e, "filet").attributs;
    ancres.add(`${filet.x2} ${filet.y2}`);
  }
  assert.equal(ancres.size, 1, "les deux filets mènent au même nom");
  assert.equal(textes(d).filter((t) => t === "Poignée de la portière arrière").length, 1, "le nom, une fois");
});

test("retroviseurs : la caisse, au bord intérieur sous l'horizon, mince à l'horizon (le liseré du réglage) et large en bas, tient dans le tiers côté voiture ; le reste du miroir montre la route", () => {
  const d = famille.DESSINS.retroviseurs();
  for (const [role, cote] of EXTERIEURS) {
    const m = miroir(d, role), xi = bordInterieur(m, cote), c = sansDoublons(pointsRole(m.g, "caisse"));
    // Part de la largeur, du bord intérieur au bord de la caisse ; au-dessus de l'arrondi du coin du verre, la caisse touche le bord.
    const largeurA = (y) => {
      const e = etendueA(c, y);
      assert.ok(e, `${role} : pas de caisse à ${y}`);
      if (y < m.verre.y2 - 7) assert.ok(Math.abs((cote === "droite" ? e[1] : e[0]) - xi) < 0.01, `${role} : la caisse quitte le bord intérieur à ${y}`);
      return Math.max(...e.map((x) => Math.abs(x - xi))) / m.largeur;
    };
    const haut = largeurA(m.milieu + 0.01), bas = largeurA(m.verre.y2 - 0.5);
    assert.ok(Math.abs(haut - famille.PART_LISERE) < 0.01, `${role} : ${(100 * haut).toFixed(1)} % de la largeur à l'horizon`);
    assert.ok(bas >= 0.25 && bas <= 1 / 3, `${role} : ${(100 * bas).toFixed(1)} % de la largeur en bas`);
    for (let y = m.milieu + 1; y < m.verre.y2 - 1; y += 1) assert.ok(largeurA(y) <= bas + 0.005, `${role} : la caisse plus large au-dessus du bas`);
    const route = sansDoublons(pointsRole(m.g, "route"));
    assert.ok(aire(c) / aire(route) <= 1 / 3, `${role} : la caisse prend ${((100 * aire(c)) / aire(route)).toFixed(0)} % du bas du miroir`);
  }
});

test("retroviseurs : les images montrent la rue des sources, celle des scènes avec stationnement (axiale à gauche, bordure à droite, bord d'en face à gauche)", () => {
  const d = famille.DESSINS.retroviseurs();
  const gauche = miroir(d, "miroir-gauche"), interieur = trouverRole(d, "miroir-interieur");
  assert.ok(aire(pointsRole(gauche.g, "bord-en-face")) > 1, "gauche : le bord d'en face");
  assert.ok(trouverTous(gauche.g, (x) => x.attributs["data-r"] === "tiret").length >= 1, "gauche : l'axiale");
  assert.ok(aire(pointsRole(miroir(d, "miroir-droit").g, "bord-chaussee")) > 1, "droit : le bord de la chaussée");
  // Chaque bordure part du point de fuite à l'écart de la rue des scènes : voie de 3,5 m, bande de stationnement de 2 m, la voiture
  // au milieu de sa voie ; un sommet sous l'horizon de son bord le plus proche est à l'écart l, l = |x - fuite| h / (y - horizon).
  const R = VOITURE.retroviseur.centre;
  for (const [role, bord, l] of [["miroir-droit", "bord-chaussee", DESSIN.voie / 2 + DESSIN.largeurStationnement - R],
    ["miroir-gauche", "bord-en-face", (3 * DESSIN.voie) / 2 + DESSIN.largeurStationnement - R]]) {
    const im = imageDe(d, role);
    const ecarts = pointsRole(im.g, bord).filter((p) => p[1] > im.yH + 1).map((p) => (Math.abs(p[0] - im.fuite) * im.h) / (p[1] - im.yH));
    assert.ok(ecarts.length && Math.abs(Math.min(...ecarts) - l) < 0.01, `${role} : bordure à ${Math.min(...ecarts).toFixed(3)} m du miroir au lieu de ${l.toFixed(3)}`);
  }
  const ci = boite(pointsRole(interieur, "verre")), milieu = (ci.x1 + ci.x2) / 2;
  const tirets = trouverTous(interieur, (x) => x.attributs["data-r"] === "tiret");
  assert.ok(tirets.length >= 1 && tirets.every((t) => boite(pointsDe(t.attributs.d)).x2 < milieu), "intérieur : l'axiale, à gauche");
  assert.ok(boite(pointsRole(interieur, "bord-chaussee")).x1 >= milieu - 0.01, "intérieur : la bordure, à droite");
  assert.ok(boite(pointsRole(interieur, "bord-en-face")).x2 <= milieu + 0.01, "intérieur : le bord d'en face, à gauche");
});

test("retroviseurs : intérieur, la lunette arrière entière dans le miroir", () => {
  const d = famille.DESSINS.retroviseurs();
  const g = trouverRole(d, "miroir-interieur");
  const verre = pointsRole(g, "verre"), lunette = pointsRole(g, "lunette");
  for (const p of lunette) assert.ok(dansPolygoneConvexe(p, verre), `le point ${p} de la lunette sort du miroir`);
});

// ===== Les angles morts =====
const CAP_HAUT = -90;
function vueDessus(d) {
  const g = trouverRole(d, "vue-dessus");
  const [x, y, s] = ["data-x", "data-y", "data-echelle"].map((k) => Number(g.attributs[k]));
  return { g, x, y, s, r: reperesDessus({ x, y, cap: CAP_HAUT, echelle: s }) };
}
const zoneDe = (d, role) => pointsRole(trouverRole(d, role), "zone");
// Angle d'un point vu de l'œil, depuis le cap (vers le haut du cadre), en degrés, négatif à gauche.
const angleDepuisCap = (oeil, p) => Math.atan2(p[0] - oeil[0], oeil[1] - p[1]) / DEG;

test("angles-morts : chaque zone d'angle mort est hors des champs des trois rétroviseurs (recouvrement d'au plus 1 unité carrée)", () => {
  const d = famille.DESSINS["angles-morts"]();
  for (const zone of ["angle-mort-gauche", "angle-mort-droit"]) {
    const z = zoneDe(d, zone);
    assert.ok(aire(z) > 100, `${zone} : zone vide`);
    for (const champ of ["champ-interieur", "champ-gauche", "champ-droit"]) {
      const commun = dansConvexe(z, pointsRole(d, champ));
      const a = commun.length > 2 ? aire(commun) : 0;
      assert.ok(a <= 1, `${zone} et ${champ} : ${a.toFixed(1)} unités carrées en commun`);
    }
  }
});

test("angles-morts : chaque zone commence le long du flanc à hauteur du conducteur et longe le flanc arrière", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d), s = v.s, yOeil = v.r.oeil[1], yArriere = v.y + (VOITURE.longueur / 2) * s;
  for (const [zone, sg] of [["angle-mort-gauche", -1], ["angle-mort-droit", 1]]) {
    const z = zoneDe(d, zone), flanc = v.x + sg * (VOITURE.largeur / 2) * s;
    assert.ok(z.every((p) => p[1] >= yOeil - 0.5), `${zone} : rien devant le conducteur`);
    const auConducteur = etendueA(z, yOeil + 0.5);
    assert.ok(auConducteur, `${zone} : la zone ne commence pas à hauteur du conducteur`);
    const plusPres = sg < 0 ? auConducteur[1] : auConducteur[0];
    assert.ok(Math.abs(plusPres - flanc) <= 0.3 * s, `${zone} : à hauteur du conducteur, à ${(Math.abs(plusPres - flanc) / s).toFixed(2)} m du flanc`);
    for (let y = yOeil + 1; y <= yArriere; y += 2) {
      const e = etendueA(z, y), pres = sg < 0 ? e[1] : e[0];
      assert.ok(Math.abs(pres - flanc) <= 0.75 * s, `${zone} : à ${((y - v.y) / s).toFixed(2)} m, à ${(Math.abs(pres - flanc) / s).toFixed(2)} m du flanc`);
    }
  }
});

test("angles-morts : le coup d'œil par-dessus l'épaule gauche couvre toute la zone gauche ; axe, portée, teinte et opacité du regard des scènes", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d);
  const os = oeilScene({ x: v.x / v.s, y: v.y / v.s, cap: CAP_HAUT * DEG });
  assert.ok(Math.hypot(os.x * v.s - v.r.oeil[0], os.y * v.s - v.r.oeil[1]) < 1e-6, "œil des scènes");
  const coneNoeud = trouverRole(d, "coup-d-oeil"), cone = pointsDe(coneNoeud.attributs.d);
  assert.equal(coneNoeud.attributs.fill, TEINTES.regard);
  assert.equal(Number(coneNoeud.attributs.opacity), OPACITE_CONE);
  assert.ok(cone.some((p) => Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) < 0.01), "le cône part de l'œil");
  const angles = cone.filter((p) => Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) > 1).map((p) => angleDepuisCap(v.r.oeil, p));
  const [min, max] = [Math.min(...angles), Math.max(...angles)];
  assert.ok(Math.abs((min + max) / 2 + 120) < 0.01, `axe à ${((min + max) / 2).toFixed(2)} degrés au lieu de -120`);
  for (const p of cone) assert.ok(Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) <= REGARD_PORTEE * v.s + 0.01, "portée des scènes");
  for (const p of zoneDe(d, "angle-mort-gauche")) {
    const a = angleDepuisCap(v.r.oeil, p);
    assert.ok(a >= min - 1e-6 && a <= max + 1e-6, `le point ${p} de la zone gauche, à ${a.toFixed(2)} degrés, est hors du coup d'œil (${min.toFixed(1)} à ${max.toFixed(1)})`);
    assert.ok(Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) <= REGARD_PORTEE * v.s, "zone dans la portée du regard");
  }
});

test("angles-morts : le deux-roues est tout entier dans la zone gauche, le long du flanc arrière, à moins de 1,5 m du flanc", () => {
  const d = famille.DESSINS["angles-morts"]();
  const z = zoneDe(d, "angle-mort-gauche");
  const g = trouverRole(d, "deux-roues");
  const [x, y, lo, la] = ["data-x", "data-y", "data-longueur", "data-largeur"].map((k) => Number(g.attributs[k]));
  const v = vueDessus(d);
  assert.ok(Math.abs(lo - GABARITS.velo.longueur * v.s) < 1e-9 && Math.abs(la - GABARITS.velo.largeur * v.s) < 1e-9, "gabarit du vélo des scènes");
  const emprise = [[x - la / 2, y - lo / 2], [x + la / 2, y - lo / 2], [x + la / 2, y + lo / 2], [x - la / 2, y + lo / 2]];
  const dessin = pointsPoses(g);
  assert.ok(dessin.length >= 4 * 4 + 8 + 6 + 4, "roues, cadre, guidon, dos, bras et tête du cycliste lus");
  for (const p of [...emprise, ...dessin]) assert.ok(dansPolygoneConvexe(p, z), `le point ${p} du deux-roues sort de la zone gauche`);
  const flanc = v.x - (VOITURE.largeur / 2) * v.s;
  assert.ok(emprise.every((p) => flanc - p[0] < 1.5 * v.s), "à moins de 1,5 m du flanc");
  const X = (v.y - y) / v.s;
  assert.ok(X <= VOITURE.portiere.arriere && X >= -VOITURE.longueur / 2, `centre à X = ${X.toFixed(2)} m : le long de la portière arrière ou de l'aile arrière`);
});

test("angles-morts : le cycliste est la pièce de la scène « sortie-portiere » (js/piece-cycliste.js), posée cap vers le haut à l'échelle du dessin", () => {
  const d = famille.DESSINS["angles-morts"]();
  const g = trouverRole(d, "deux-roues"), v = vueDessus(d);
  // Les mêmes nœuds, au caractère près : ni copie ni variante.
  assert.equal(g.enfants.map((x) => versChaine(x, false)).join(""), cycliste().enfants.map((x) => versChaine(x, false)).join(""));
  assert.equal(g.attributs.transform, `translate(${g.attributs["data-x"]} ${g.attributs["data-y"]}) rotate(-90) scale(${v.s})`);
  // La pièce porte le gabarit et les teintes des scènes.
  assert.deepEqual(GABARITS.velo, GABARIT_VELO);   // par valeur : sous Node, x.js et x.js?v=... sont deux instances du module
  for (const [k, c] of Object.entries(TEINTES_VELO)) assert.equal(TEINTES[k], c, k);
});

test("angles-morts : la voiture, la rue, le marquage, le cône du regard et le cycliste ont les teintes et les dimensions des scènes", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d);
  const caisse = trouverRole(v.g, "caisse");
  assert.ok(Math.abs(Number(caisse.attributs.width) - GABARITS.voiture.longueur * v.s) < 1e-6, "longueur de la voiture des scènes");
  assert.ok(Math.abs(Number(caisse.attributs.height) - GABARITS.voiture.largeur * v.s) < 1e-6, "largeur de la voiture des scènes");
  assert.equal(caisse.attributs.fill, TEINTES.eleve);
  assert.equal(caisse.attributs.stroke, TEINTES.eleveBord);
  assert.equal(trouverRole(d, "chaussee").attributs.fill, TEINTES.chaussee);
  assert.equal(trouverRole(d, "trottoir").attributs.fill, TEINTES.trottoir);
  // Rue des scènes avec stationnement : voiture à DESSIN.jeuStationnement de la bordure, bande de DESSIN.largeurStationnement, voie
  // de DESSIN.voie, axiale T'1 (IISR.axialeAgglo, 2u de large).
  const bordure = boite(pointsRole(d, "trottoir")).x1, flancDroit = v.x + (VOITURE.largeur / 2) * v.s;
  assert.ok(Math.abs(bordure - flancDroit - DESSIN.jeuStationnement * v.s) < 0.01, "voiture à 0,3 m de la bordure");
  const axiale = trouverTous(d, (x) => x.attributs["data-r"] === "axiale").map((t) => boite(pointsDe(t.attributs.d)));
  assert.ok(axiale.length >= 1, "axiale dessinée");
  for (const t of axiale) {
    assert.ok(Math.abs((t.x1 + t.x2) / 2 - (bordure - (DESSIN.largeurStationnement + DESSIN.voie) * v.s)) < 0.01, "axiale à 5,5 m de la bordure");
    assert.ok(Math.abs(t.x2 - t.x1 - 2 * IISR.u * v.s) < 0.01, "axiale de 2u de large");
    assert.ok(t.y2 - t.y1 <= IISR.axialeAgglo.trait * v.s + 0.01, "traits de 1,5 m au plus");
  }
  for (const t of trouverTous(d, (x) => x.attributs["data-r"] === "axiale")) assert.equal(t.attributs.fill, TEINTES.peinture);
  assert.equal(trouverRole(d, "coup-d-oeil").attributs.fill, TEINTES.regard);
  const couleurs = new Set(trouverTous(trouverRole(d, "deux-roues"), () => true).flatMap((x) => [x.attributs.fill, x.attributs.stroke]).filter((c) => c && c !== "none"));
  const attendues = new Set([TEINTES.cycliste, TEINTES.cyclisteBord, TEINTES.velo]);
  assert.deepEqual([...couleurs].sort(), [...attendues].sort(), "teintes du cycliste des scènes");
  assert.equal(TEINTES_ROUTE.chaussee, TEINTES.chaussee);
});

test("angles-morts : chaque nom désigne ce qu'il nomme (angle mort dans sa zone, hors du deux-roues ; coup d'œil dans son cône ; rétroviseurs dans leur champ)", () => {
  const d = famille.DESSINS["angles-morts"]();
  const g = trouverRole(d, "deux-roues");
  const [x, y, lo, la] = ["data-x", "data-y", "data-longueur", "data-largeur"].map((k) => Number(g.attributs[k]));
  const cible = (role) => { const n = trouverRole(d, role); return [Number(n.attributs["data-x"]), Number(n.attributs["data-y"])]; };
  for (const [role, zone] of [["nom-gauche", "angle-mort-gauche"], ["nom-droite", "angle-mort-droit"]]) {
    assert.ok(dansPolygoneConvexe(cible(role), zoneDe(d, zone), 3), `${role} : la cible n'est pas dans ${zone}`);
  }
  const c = cible("nom-gauche");
  assert.ok(Math.abs(c[0] - x) > la / 2 + 3 || Math.abs(c[1] - y) > lo / 2 + 3, "le point de l'étiquette ne couvre pas le deux-roues");
  assert.ok(dansPolygoneConvexe(cible("nom-regard"), pointsRole(d, "coup-d-oeil"), 2), "le coup d'œil désigne son cône");
  const champs = { "nom-champGauche": "champ-gauche", "nom-champInterieur": "champ-interieur", "nom-champDroit": "champ-droit" };
  for (const [role, champ] of Object.entries(champs)) {
    assert.ok(dansPolygoneConvexe(cible(role), pointsRole(d, champ), 1), `${role} : la cible n'est pas dans ${champ}`);
    for (const autre of Object.values(champs).filter((a) => a !== champ)) {
      assert.ok(!dansPolygoneConvexe(cible(role), pointsRole(d, autre)), `${role} : la cible est aussi dans ${autre}`);
    }
  }
  const t = textes(d);
  for (const mot of ["Angle mort", "Coup d'œil", "par-dessus l'épaule", "Rétroviseur", "gauche", "intérieur", "droit"]) assert.ok(t.includes(mot), mot);
});

// Le coup d'œil se lit par-dessus l'épaule, vers l'arrière : le point de son étiquette est derrière l'œil (le long du cap), dans le
// cône, sur son axe (à 5 degrés près), à 2 m au moins de l'œil ; posé devant l'œil, au bord avant du cône, il faisait lire « regarder
// à gauche » (relecture finale du lot D1).
const AXE_REGARD_ECART_MAX = 5, DISTANCE_REGARD_MIN = 2;
test("angles-morts : l'étiquette du coup d'œil désigne sa partie tournée vers l'arrière : derrière l'œil, sur l'axe du regard, dans le cône", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d), e = trouverRole(d, "nom-regard");
  const p = [Number(e.attributs["data-x"]), Number(e.attributs["data-y"])];
  const cone = pointsRole(d, "coup-d-oeil");
  assert.ok(dansPolygoneConvexe(p, cone, 2), "le point est hors du cône");
  // Le long du cap (vers le haut du cadre), le point est derrière l'œil.
  const avance = (v.r.oeil[1] - p[1]) / v.s;
  assert.ok(avance < 0, `le point est ${avance.toFixed(2)} m devant l'œil`);
  const ecart = Math.abs(angleDepuisCap(v.r.oeil, p) + 120);
  assert.ok(ecart <= AXE_REGARD_ECART_MAX, `le point est à ${ecart.toFixed(1)} degrés de l'axe du regard (-120)`);
  assert.ok(Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) / v.s >= DISTANCE_REGARD_MIN, "le point colle à l'œil");
  // Il ne touche pas le point de l'étiquette « Angle mort » ni le deux-roues.
  const autre = trouverRole(d, "nom-gauche"), q = [Number(autre.attributs["data-x"]), Number(autre.attributs["data-y"])];
  const rayon = (x) => Math.max(...trouverTous(x, (y) => y.balise === "circle").map((c) => Number(c.attributs.r)));
  assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) > rayon(e) + rayon(autre) + 4, "les points des deux étiquettes se touchent");
  const g = trouverRole(d, "deux-roues");
  const [x, y, lo, la] = ["data-x", "data-y", "data-longueur", "data-largeur"].map((k) => Number(g.attributs[k]));
  assert.ok(Math.abs(p[0] - x) > la / 2 + rayon(e) || Math.abs(p[1] - y) > lo / 2 + rayon(e), "le point couvre le deux-roues");
});

// Style schématique (décision du formateur du 15/10/2026 : aplats, aucune texture) : une zone que le conducteur ne voit pas est un
// aplat translucide de la teinte « faux » de la charte, le même dans les deux dessins qui en montrent, sans hachures. Le cône du coup
// d'œil, translucide aussi, passe par-dessus la zone gauche qu'il couvre : elle s'y teinte du regard (la zone droite, hors du cône,
// non) ; il n'y a plus de voile, qui éclaircissait les hachures sous le cône.
test("zones-invisibles et angles-morts : chaque zone non visible est un aplat translucide de la teinte « faux », le même partout, sans hachures ; le coup d'œil passe par-dessus la zone gauche", () => {
  const zones = [["zones-invisibles", ["zone-avant", "zone-arriere"]], ["angles-morts", ["angle-mort-gauche", "angle-mort-droit"]]];
  const aplats = new Set();
  for (const [code, roles] of zones) {
    const d = famille.DESSINS[code]();
    for (const role of roles) {
      const g = trouverTous(d, (x) => x.attributs["data-r"] === role);
      assert.ok(g.length >= 1, `${code} : ${role}`);
      for (const z of g) {
        assert.equal(z.enfants.length, 1, `${code}, ${role} : un seul aplat, sans hachures`);
        const a = z.enfants[0].attributs;
        assert.equal(a["data-r"], "zone", `${code}, ${role}`);
        assert.ok(!a.stroke, `${code}, ${role} : sans contour`);
        aplats.add(`${a.fill} ${a["fill-opacity"]}`);
      }
    }
    assert.equal(trouverTous(d, (x) => /^voile/.test(x.attributs["data-r"] || "")).length, 0, `${code} : voile`);
  }
  assert.equal(aplats.size, 1, `aplats : ${[...aplats].join(", ")}`);
  const [teinte, opacite] = [...aplats][0].split(" ");
  assert.equal(teinte, CHARTE.faux);
  assert.ok(Number(opacite) >= 0.3 && Number(opacite) <= 0.5, `opacité ${opacite}`);
  // Empilement : la zone gauche, puis le cône du coup d'œil, puis la voiture.
  const d = famille.DESSINS["angles-morts"](), ordre = trouverTous(d, () => true), rang = (role) => ordre.indexOf(trouverRole(d, role));
  assert.ok(rang("angle-mort-gauche") < rang("coup-d-oeil") && rang("coup-d-oeil") < rang("vue-dessus"), "zone, puis coup d'œil, puis voiture");
});

test("zones-invisibles et angles-morts : les voitures en silhouette (style schématique), aux mêmes tracés que les voitures du kit", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  for (const v of VUES(d)) {
    const profil = trouverRole(v.g, "voiture-profil");
    const [x, sol, echelle] = ["data-x", "data-y", "data-echelle"].map((k) => Number(v.g.attributs[k]));
    assert.deepEqual(profil, voitureProfil({ x, y: sol, echelle, sens: "gauche", schema: true }), `${v.nom} : silhouette du kit`);
    for (const role of ["phare", "feu", "poignee-arriere", "retroviseur", "bas-de-caisse"]) assert.equal(trouverRole(profil, role), null, `${v.nom} : ${role}`);
  }
  const a = famille.DESSINS["angles-morts"](), v = vueDessus(a);
  const voiture = trouverRole(v.g, "voiture");
  assert.deepEqual(voiture, voitureDessus({ x: v.x, y: v.y, cap: CAP_HAUT, echelle: v.s, retroviseurs: true, schema: true }), "angles-morts : silhouette du kit");
  for (const role of ["toit", "vitre-avant-gauche", "phare-gauche", "feu-droit", "essuie-glaces", "reflet-pare-brise"]) assert.equal(trouverRole(voiture, role), null, role);
  for (const role of ["retroviseur-gauche", "retroviseur-droit", "retroviseur-interieur"]) assert.ok(trouverRole(voiture, role), role);
});

// Le cycliste en pictogramme (style schématique) : trois teintes, le cycliste d'une seule teinte (dos, bras et tête ronde, le dos et
// la tête bordés de foncé), le vélo d'une seule teinte foncée ; sans visage ni détail.
test("cycliste : une silhouette de pictogramme, trois teintes ; la tête ronde ; les bras et la tête de la teinte du dos ; pneus, cadre et guidon d'une teinte", () => {
  const c = cycliste();
  assert.deepEqual(Object.keys(TEINTES_VELO).sort(), ["cycliste", "cyclisteBord", "velo"]);
  const couleurs = new Set(trouverTous(c, () => true).flatMap((x) => [x.attributs.fill, x.attributs.stroke]).filter((t) => t && t !== "none"));
  assert.deepEqual([...couleurs].sort(), Object.values(TEINTES_VELO).sort());
  const tete = trouverTous(c, (x) => x.balise === "circle");
  assert.equal(tete.length, 1, "une tête ronde");
  assert.equal(trouverTous(c, (x) => x.balise === "ellipse").length, 0, "aucune ellipse");
  assert.equal(tete[0].attributs.fill, TEINTES_VELO.cycliste);
  for (const b of trouverTous(c, (x) => x.balise === "polyline")) assert.equal(b.attributs.stroke, TEINTES_VELO.cycliste, "bras");
  for (const r of trouverTous(c, (x) => x.balise === "rect")) assert.equal(r.attributs.fill, TEINTES_VELO.velo, "vélo");
  // Tête ronde devant les épaules, dans la largeur des épaules.
  const { cx, r } = tete[0].attributs;
  assert.ok(Number(cx) > 0 && Number(r) * 2 < GABARIT_VELO.largeur, "tête");
});

test("angles-morts : les champs extérieurs partent du verre du miroir et s'arrêtent au rayon qui frôle le coin arrière ; le champ intérieur est dans l'axe", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d);
  const versCadre = ([X, Y]) => [v.x + Y * v.s, v.y - X * v.s];
  for (const cote of ["gauche", "droit"]) {
    const m = miroirAttendu(cote), c = coinAttendu(cote);
    const pts = pointsRole(d, `champ-${cote}`);
    const [verreInt, verreExt, P, T] = [m.verre.interieur, m.verre.exterieur, c.P, c.T].map(versCadre);
    assert.ok(pts.some((p) => Math.hypot(p[0] - verreExt[0], p[1] - verreExt[1]) < 0.02), `champ ${cote} : part du bout extérieur du verre`);
    // Le bord intérieur du champ : la droite de l'œil reflété par le coin arrière (la caisse cache ce qui est en deçà) ; il part du
    // verre, entre ses deux bouts, et longe le coin à 1 cm près.
    const surRasant = pts.filter((p) => distanceDroite(p, P, T) < 0.02);
    assert.ok(surRasant.length >= 2, `champ ${cote} : bord intérieur hors du rayon rasant`);
    const depart = surRasant.find((p) => distanceDroite(p, verreInt, verreExt) < 0.02);
    assert.ok(depart && Math.hypot(depart[0] - verreInt[0], depart[1] - verreInt[1]) + Math.hypot(depart[0] - verreExt[0], depart[1] - verreExt[1])
      < Math.hypot(verreExt[0] - verreInt[0], verreExt[1] - verreInt[1]) + 0.02, `champ ${cote} : le rayon rasant ne part pas du verre`);
    assert.ok(surRasant.some((p) => (p[1] - T[1]) * (depart[1] - T[1]) < 0), `champ ${cote} : le bord intérieur ne passe pas le coin arrière`);
    // Le miroir du modèle est celui du kit : son centre est le repère du rétroviseur de reperesDessus.
    const repere = cote === "gauche" ? v.r.retroGauche : v.r.retroDroit, centre = versCadre(m.M);
    assert.ok(Math.hypot(centre[0] - repere[0], centre[1] - repere[1]) < 1e-6, `${cote} : miroir du kit`);
  }
  const ci = boite(pointsRole(d, "champ-interieur"));
  assert.ok(Math.abs((ci.x1 + ci.x2) / 2 - v.x) < 0.01, "champ intérieur dans l'axe");
});

// Un seul rétroviseur intérieur dans le cours C1.2 : la vignette d'« installation » (fin du réglage) et la rangée « Intérieur »
// de « retroviseurs » montrent le même verre et la même lunette, rapportés au verre ; lunette plus large en haut, son bord haut
// étant le plus près de l'œil reflété (relecture finale du lot D1, m5).
test("retroviseurs et installation : le même rétroviseur intérieur, même verre et même lunette, plus large en haut", () => {
  const nombres = (s) => String(s).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g).map(Number);
  const paires = (v) => v.flatMap((_, i) => (i % 2 ? [] : [[v[i], v[i + 1]]]));
  const contourDe = (noeud) => {
    assert.ok(noeud, "rôle absent");
    if (noeud.balise === "rect") {
      const [x, y, l, h] = ["x", "y", "width", "height"].map((k) => Number(noeud.attributs[k]));
      return [[x, y], [x + l, y], [x + l, y + h], [x, y + h]];
    }
    return paires(nombres(noeud.balise === "polygon" ? noeud.attributs.points : noeud.attributs.d));
  };
  const lire = (g, roleVerre) => {
    const verre = contourDe(trouverRole(g, roleVerre)), xs = verre.map((p) => p[0]), ys = verre.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const l = x1 - x0, h = y1 - y0;
    return { rapport: l / h, lunette: contourDe(trouverRole(g, "lunette")).map(([x, y]) => [(x - x0) / l, (y - y0) / h]) };
  };
  const retro = lire(trouverRole(famille.DESSINS.retroviseurs(), "miroir-interieur"), "verre");
  const def = conducteur.GESTES.installation.construire();
  for (const [quand, image] of [["fin de lecture", imageA(def, def.duree, false)], ["image figée de fin", imageA(def, def.duree, true)]]) {
    const inst = lire(trouverRole(image, "vignette-vivante"), "miroir");
    assert.ok(Math.abs(inst.rapport - retro.rapport) < 0.005 * retro.rapport,
      `${quand} : verre de ${inst.rapport.toFixed(3)} fois sa hauteur, ${retro.rapport.toFixed(3)} dans « retroviseurs »`);
    assert.equal(inst.lunette.length, retro.lunette.length, `${quand} : la lunette n'a pas le même contour`);
    inst.lunette.forEach((p, i) => assert.ok(Math.hypot(p[0] - retro.lunette[i][0], p[1] - retro.lunette[i][1]) < 0.003,
      `${quand} : point ${i} de la lunette en (${p.map((v) => v.toFixed(3))}), (${retro.lunette[i].map((v) => v.toFixed(3))}) dans « retroviseurs »`));
  }
  // Plus large en haut : son étendue au dixième de sa hauteur dépasse celle aux neuf dixièmes.
  const ys = retro.lunette.map((p) => p[1]), [haut, bas] = [Math.min(...ys), Math.max(...ys)];
  const largeur = (part) => { const e = etendueA(retro.lunette, haut + part * (bas - haut)); return e[1] - e[0]; };
  assert.ok(largeur(0.1) > largeur(0.9), "la lunette est plus large en haut");
});
