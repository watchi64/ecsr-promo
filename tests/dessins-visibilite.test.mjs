import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-visibilite.js";
import { SOURCES } from "../sources/dessins-visibilite.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { reperesProfil, reperesDessus, voitureDessus, TEINTES_ROUTE, VOITURE } from "../js/dessins-kit.js";
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
// lignes brisées, et les coins de la boîte de chaque ellipse (qui la contient).
function pointsPoses(g) {
  const t = String(g.attributs.transform || "");
  const tr = t.match(/translate\(([-\d.]+) ([-\d.]+)\)/), ro = t.match(/rotate\(([-\d.]+)\)/), sc = t.match(/scale\(([-\d.]+)\)/);
  const [tx, ty] = tr ? [Number(tr[1]), Number(tr[2])] : [0, 0], a = ro ? (Number(ro[1]) * Math.PI) / 180 : 0, k = sc ? Number(sc[1]) : 1;
  const poser = ([px, py]) => [tx + k * (px * Math.cos(a) - py * Math.sin(a)), ty + k * (px * Math.sin(a) + py * Math.cos(a))];
  return trouverTous(g, (x) => x !== g).flatMap((x) => {
    if (x.balise === "polyline") return String(x.attributs.points).trim().split(/\s+/).map((c) => c.split(",").map(Number));
    if (x.balise === "ellipse") {
      const [cx, cy, rx, ry] = ["cx", "cy", "rx", "ry"].map((c) => Number(x.attributs[c]));
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
const ceintureAttendue = (X) => {
  const { arriereBas: a, avantBas: b } = VOITURE.vitrage;
  return a[1] + ((X - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
};
// Une image de rétroviseur extérieur lue dans le dessin : verre, côté de la caisse (s = 1 si elle est à droite de l'image),
// bord intérieur, point de fuite, focale, horizon, hauteur de l'œil reflété.
function imageDe(r, role) {
  const g = trouverRole(r, role);
  assert.ok(g, `${role} absent`);
  const v = boite(pointsRole(g, "verre")), s = role.includes("gauche") ? 1 : -1;
  return { g, v, s, W: v.x2 - v.x1, interieur: s > 0 ? v.x2 : v.x1, fuite: Number(g.attributs["data-fuite"]), f: Number(g.attributs["data-focale"]),
    yH: boite(pointsRole(g, "route")).y1, h: Number(g.attributs["data-hauteur"]) };
}
const IMAGES = [["miroir-gauche", "gauche", famille.PART_LISERE, "lisere"], ["miroir-droit", "droit", famille.PART_LISERE, "lisere"],
  ["miroir-gauche-faux", "gauche", famille.PART_FAUX, "carrosserie"]];

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

test("retroviseurs : selon le modèle de l'œil reflété tenu devant le miroir, la caisse vue du miroir s'arrête au coin arrière de la voiture du kit, sous l'épaule, et prend la part annoncée de la largeur", () => {
  const r = famille.DESSINS.retroviseurs();
  for (const [role, cote, part, nom] of IMAGES) {
    const im = imageDe(r, role), c = coinAttendu(cote), b = boite(pointsRole(im.g, nom));
    const [interieur, exterieur] = im.s > 0 ? [b.x2, b.x1] : [b.x1, b.x2];
    assert.ok(Math.abs(interieur - im.interieur) < 0.01, `${role} : la caisse au bord intérieur`);
    const coin = im.fuite + (im.s * im.f * c.flanc) / c.recul;
    assert.ok(Math.abs(exterieur - coin) < 0.05, `${role} : la caisse s'arrête à ${exterieur.toFixed(2)}, le coin arrière est à ${coin.toFixed(2)}`);
    assert.ok(Math.abs((im.s * (im.interieur - exterieur)) / im.W - part) < 0.001, `${role} : la caisse prend ${((100 * im.s * (im.interieur - exterieur)) / im.W).toFixed(1)} % de la largeur`);
    const haut = im.yH + (im.f * (im.h - ceintureAttendue(c.T[0]))) / c.recul;
    assert.ok(Math.abs(b.y1 - haut) < 0.05, `${role} : haut de la caisse à ${b.y1.toFixed(2)}, l'épaule au coin à ${haut.toFixed(2)}`);
    assert.ok(Math.abs(b.y2 - im.v.y2) < 0.01, `${role} : la caisse jusqu'au bas du miroir`);
  }
});

// ===== Ce que montrent les rétroviseurs =====
function miroir(d, role) {
  const g = trouverRole(d, role);
  assert.ok(g, `${role} absent`);
  const verre = boite(pointsRole(g, "verre"));
  return { g, verre, largeur: verre.x2 - verre.x1, hauteur: verre.y2 - verre.y1, milieu: (verre.y1 + verre.y2) / 2 };
}
const horizonDe = (m) => boite(pointsRole(m.g, "route")).y1;

test("retroviseurs : extérieur gauche juste, l'horizon à mi-hauteur à 2 % près, un liseré de carrosserie d'au plus 12 % de la largeur, au bord intérieur (à droite)", () => {
  const d = famille.DESSINS.retroviseurs();
  const m = miroir(d, "miroir-gauche");
  const yH = horizonDe(m);
  assert.ok(Math.abs(yH - m.milieu) <= 0.02 * m.hauteur, `horizon à ${(((yH - m.verre.y1) / m.hauteur) * 100).toFixed(1)} % de la hauteur`);
  const l = boite(pointsRole(m.g, "lisere"));
  assert.ok(l.x2 - l.x1 <= 0.12 * m.largeur, `liseré de ${(((l.x2 - l.x1) / m.largeur) * 100).toFixed(1)} % de la largeur`);
  assert.ok(Math.abs(l.x2 - m.verre.x2) <= 0.5 && l.x1 > m.verre.x1 + 0.88 * m.largeur, "liseré au bord droit du miroir gauche");
});

test("retroviseurs : extérieur droit juste, un peu plus bas (l'horizon au-dessus du milieu, le bord de la chaussée visible), liseré au bord intérieur (à gauche)", () => {
  const d = famille.DESSINS.retroviseurs();
  const m = miroir(d, "miroir-droit");
  assert.ok(horizonDe(m) < m.milieu, "horizon au-dessus du milieu");
  const l = boite(pointsRole(m.g, "lisere"));
  assert.ok(l.x2 - l.x1 <= 0.12 * m.largeur, "liseré mince");
  assert.ok(Math.abs(l.x1 - m.verre.x1) <= 0.5 && l.x2 < m.verre.x1 + 0.12 * m.largeur, "liseré au bord gauche du miroir droit");
  const bord = pointsRole(m.g, "bord-chaussee");
  assert.ok(aire(bord) > 1, "le bord de la chaussée se voit");
});

test("retroviseurs : extérieur tourné vers la carrosserie (faux), une bande de carrosserie d'au moins 40 % de la largeur, côté intérieur", () => {
  const d = famille.DESSINS.retroviseurs();
  const m = miroir(d, "miroir-gauche-faux");
  const c = boite(pointsRole(m.g, "carrosserie"));
  assert.ok(c.x2 - c.x1 >= 0.4 * m.largeur, `bande de ${(((c.x2 - c.x1) / m.largeur) * 100).toFixed(1)} % de la largeur`);
  assert.ok(Math.abs(c.x2 - m.verre.x2) <= 0.5, "du côté de la voiture");
});

test("retroviseurs : les vitres et le montant arrière, en retrait du flanc, ne se voient que dans le faux, au-dessus de la caisse et loin du point de fuite", () => {
  const d = famille.DESSINS.retroviseurs();
  const im = imageDe(d, "miroir-gauche-faux"), { P } = coinAttendu("gauche");
  // Face extérieure des vitres : relue sur la vitre arrière gauche de la voiture du kit vue du dessus, à 100 unités par mètre.
  const vitresDessus = Math.max(...pointsDe(trouverRole(voitureDessus({ x: 0, y: 0, cap: 0, echelle: 100 }), "vitre-arriere-gauche").attributs.d)
    .map((p) => Math.abs(p[1]))) / 100;
  assert.ok(Math.abs(vitresDessus - (VOITURE.largeur / 2 - 0.15)) < 1e-9, "vitres du kit à 0,15 m en retrait du flanc");
  const ecart = (X) => (im.f * (Math.abs(P[1]) - vitresDessus)) / (P[0] - X);     // écart au point de fuite d'un point des vitres, à X
  const vitre = pointsRole(im.g, "vitre"), montant = pointsRole(im.g, "montant"), caisse = pointsRole(im.g, "carrosserie");
  const [vb, mb] = [boite(vitre), boite(montant)];
  // Le plus près du point de fuite : le pied de la lunette pour le montant, le pied de la vitre arrière pour la vitre.
  assert.ok(Math.abs(mb.x1 - im.fuite - ecart(VOITURE.lunette.bas[0])) < 0.05, `montant à ${(mb.x1 - im.fuite).toFixed(2)} unités du point de fuite`);
  assert.ok(vb.x1 - im.fuite >= ecart(VOITURE.vitrage.arriereBas[0]) - 0.05, `vitre à ${(vb.x1 - im.fuite).toFixed(2)} unités du point de fuite`);
  assert.ok(mb.x1 - im.fuite >= 20, "loin du point de fuite");
  assert.ok(mb.x1 < vb.x1, "le montant plus près du point de fuite que la vitre");
  const commun = dansConvexe(vitre, caisse);
  assert.ok(commun.length < 3 || aire(commun) < 0.5, "la vitre au-dessus de la caisse, sans la recouvrir");
  for (const role of ["miroir-gauche", "miroir-droit"]) {
    const g = trouverRole(d, role);
    for (const r of ["vitre", "montant"]) {
      const n = trouverRole(g, r);
      assert.ok(!n || pointsDe(n.attributs.d).length < 3 || aire(pointsDe(n.attributs.d)) < 0.01, `${role} : aucune vitre au-dessus du liseré`);
    }
  }
});

test("retroviseurs : les images montrent la rue des sources (axiale à gauche, bordure à droite, bord d'en face à gauche)", () => {
  const d = famille.DESSINS.retroviseurs();
  const gauche = miroir(d, "miroir-gauche"), interieur = trouverRole(d, "miroir-interieur");
  assert.ok(aire(pointsRole(gauche.g, "bord-en-face")) > 1, "gauche : le bord d'en face");
  assert.ok(trouverTous(gauche.g, (x) => x.attributs["data-r"] === "tiret").length >= 1, "gauche : l'axiale");
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

test("retroviseurs : le liseré se reconnaît sur un téléphone, et chaque rangée porte sa pastille et les mots du cours", () => {
  const d = famille.DESSINS.retroviseurs();
  const [L] = CATALOGUE.retroviseurs.cadre;
  for (const role of ["miroir-gauche", "miroir-droit"]) {
    const l = boite(pointsRole(trouverRole(d, role), "lisere"));
    assert.ok((l.x2 - l.x1) * (343 / L) >= 6 && (l.y2 - l.y1) * (343 / L) >= 20, `${role} : liseré trop petit sur un téléphone`);
  }
  const attendus = [
    ["juste", ["Intérieur", "toute la lunette arrière"]],
    ["juste", ["Extérieur gauche", "horizon à mi-hauteur,", "mince liseré de carrosserie"]],
    ["juste", ["Extérieur droit", "souvent un peu plus bas :", "le bord de la chaussée"]],
    ["faux", ["Extérieur gauche", "tourné vers la carrosserie :", "angle mort élargi"]],
  ];
  const vignettes = trouverTous(d, (x) => /^vignette-/.test(x.attributs["data-r"] || ""));
  assert.equal(vignettes.length, attendus.length);
  vignettes.forEach((v, i) => {
    assert.equal(v.attributs["data-r"], `vignette-${attendus[i][0]}`, `rangée ${i}`);
    assert.deepEqual(textes(trouverRole(v, `legende-${i}`)), attendus[i][1], `rangée ${i}`);
  });
  assert.ok(trouverRole(trouverTous(d, (x) => x.attributs["data-r"] === "vignette-juste")[1], "miroir-gauche"), "le gauche juste dans la deuxième rangée");
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
  const attendues = new Set([TEINTES.cycliste, TEINTES.cyclisteOmbre, TEINTES.cyclisteBord, TEINTES.tete, TEINTES.velo, TEINTES.pneu]);
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

// Sous le cône du coup d'œil, la zone d'angle mort qu'il couvre est voilée de son propre fond : ses hachures s'y éclaircissent, et la
// teinte du regard y domine, comme sur la chaussée devant le conducteur ; sans ce voile, derrière le conducteur, le cône n'était
// qu'une teinte sur la hachure (relecture finale du lot D1). La zone que le coup d'œil ne couvre pas (à droite) garde ses hachures.
test("angles-morts : le cône du coup d'œil se lit sur la zone gauche qu'il couvre : un voile du fond de la zone, entre ses hachures et le cône", () => {
  const d = famille.DESSINS["angles-morts"]();
  const cone = pointsRole(d, "coup-d-oeil"), zone = zoneDe(d, "angle-mort-gauche");
  const voile = trouverRole(d, "voile-coup-d-oeil");
  assert.ok(voile, "aucun voile sous le cône");
  const pts = pointsDe(voile.attributs.d);
  assert.equal(voile.attributs.fill, trouverRole(trouverRole(d, "angle-mort-gauche"), "zone").attributs.fill, "voile du fond de la zone");
  const opacite = Number(voile.attributs["fill-opacity"]);
  assert.ok(opacite >= 0.3 && opacite <= 0.7, `voile à ${opacite} d'opacité`);
  // Le voile est la part de la zone gauche sous le cône : dans les deux, et de même aire que leur partie commune.
  for (const q of pts) {
    assert.ok(dansPolygoneConvexe(q, cone, -0.01) && dansPolygoneConvexe(q, zone, -0.01), `point ${q} du voile hors du cône ou de la zone`);
  }
  const commun = dansConvexe(zone, cone);
  assert.ok(Math.abs(aire(pts) - aire(commun)) <= 0.5, `voile de ${aire(pts).toFixed(1)} unités carrées pour ${aire(commun).toFixed(1)} de zone sous le cône`);
  // Empilement : les hachures de la zone, puis le voile, puis le cône.
  const ordre = trouverTous(d, () => true);   // ordre du document : de dessous à dessus
  const rang = (x) => ordre.indexOf(x);
  const hachuresGauche = trouverRole(d, "angle-mort-gauche").enfants.find((x) => x.balise === "path" && x.attributs["data-r"] !== "zone");
  assert.ok(rang(hachuresGauche) < rang(voile) && rang(voile) < rang(trouverRole(d, "coup-d-oeil")), "voile hors de sa place, entre hachures et cône");
  // La zone droite, hors du cône, n'est pas voilée.
  assert.equal(trouverTous(d, (x) => /^voile/.test(x.attributs["data-r"] || "")).length, 1, "un seul voile");
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
