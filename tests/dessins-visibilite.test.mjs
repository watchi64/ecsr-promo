import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-visibilite.js";
import { SOURCES } from "../sources/dessins-visibilite.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { CHARTE, cadre, reperesProfil, reperesDessus, TEINTES_ROUTE, VOITURE } from "../js/dessins-kit.js";
import { REGARD_PORTEE, REGARD_OUVERTURE, regardContient, oeil as oeilScene } from "../js/scene-regard.js";
import { TEINTES } from "../js/scene-rendu.js";
import { GABARITS } from "../js/scene-geometrie.js";

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
const boite = (pts) => ({
  x1: Math.min(...pts.map((p) => p[0])), x2: Math.max(...pts.map((p) => p[0])),
  y1: Math.min(...pts.map((p) => p[1])), y2: Math.max(...pts.map((p) => p[1])),
});
// Distance du point p à la droite (a, b).
const distanceDroite = (p, a, b) => Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
const aire = (poly) => Math.abs(poly.reduce((s, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;
// Orientation d'un polygone convexe : +1 si l'intérieur est à gauche de chaque côté (sens direct dans le repère du calcul).
const sens = (poly) => Math.sign(poly.reduce((s, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0));
// Partie du polygone `sujet` dans le polygone convexe `convexe` (Sutherland et Hodgman).
function dansConvexe(sujet, convexe) {
  const o = sens(convexe);
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
  const o = sens(poly);
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return (o * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]))) / Math.hypot(b[0] - a[0], b[1] - a[1]) >= marge;
  });
};
const textes = (racine) => trouverTous(racine, (x) => x.balise === "text").map(texteDe);

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

test("zones-invisibles : l'obstacle se reconnaît sur un téléphone et le point de son étiquette n'en cache presque rien", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  const [L] = CATALOGUE["zones-invisibles"].cadre;
  const cone = pointsRole(d, "cone"), bo = boite(cone);
  assert.ok((bo.y2 - bo.y1) * (343 / L) >= 14, `cône de ${((bo.y2 - bo.y1) * (343 / L)).toFixed(1)} px de haut à 343 px`);
  // Le disque le plus grand de l'étiquette (le point et son liseré) : part de la surface du cône qu'il recouvre, par un quadrillage.
  const nom = trouverRole(d, "nom-obstacle");
  const disque = trouverTous(nom, (x) => x.balise === "circle").map((c) => [Number(c.attributs.cx), Number(c.attributs.cy), Number(c.attributs.r)])
    .reduce((m, c) => (c[2] > m[2] ? c : m));
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

test("zones-invisibles : l'œil est nommé, et les zones portent les mots du cours", () => {
  const d = famille.DESSINS["zones-invisibles"]();
  const v = VUES(d).find((x) => x.nom === "detail");
  const nomOeil = trouverRole(d, "nom-oeil");
  assert.deepEqual([Number(nomOeil.attributs["data-x"]), Number(nomOeil.attributs["data-y"])], v.r.oeil);
  const t = textes(d);
  for (const mot of ["Œil du conducteur", "Obstacle caché", "Non visible", "Devant le capot", "Derrière le coffre"]) assert.ok(t.includes(mot), mot);
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
    ["juste", ["Extérieur droit", "un peu plus bas :", "le bord de la chaussée"]],
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
function vueDessus(d) {
  const g = trouverRole(d, "vue-dessus");
  const [x, y, s] = ["data-x", "data-y", "data-echelle"].map((k) => Number(g.attributs[k]));
  return { g, x, y, s, r: reperesDessus({ x, y, cap: -90, echelle: s }) };
}
const zoneDe = (d, role) => pointsRole(trouverRole(d, role), "zone");

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

test("angles-morts : la zone gauche est tout entière dans le cône du coup d'œil par-dessus l'épaule gauche (celui des scènes)", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d);
  // Le regard des scènes : cap et angle en radians dans le repère de l'écran, distances en mètres.
  const cap = -Math.PI / 2, angle = cap - (120 * Math.PI) / 180;
  const o = { x: v.r.oeil[0] / v.s, y: v.r.oeil[1] / v.s };
  for (const p of zoneDe(d, "angle-mort-gauche")) {
    assert.ok(regardContient(angle, o, { x: p[0] / v.s, y: p[1] / v.s }), `le point ${p} de la zone gauche est hors du cône`);
  }
  // Le cône dessiné est celui des scènes : il part de l'œil, à REGARD_OUVERTURE degrés de part et d'autre de -120, sur REGARD_PORTEE.
  const cone = pointsRole(d, "coup-d-oeil");
  assert.ok(cone.some((p) => Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) < 0.01), "le cône part de l'œil");
  const ecarts = cone.filter((p) => Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) > 1)
    .map((p) => {
      let e = (Math.atan2(p[1] - v.r.oeil[1], p[0] - v.r.oeil[0]) - angle) * (180 / Math.PI);
      while (e > 180) e -= 360;
      while (e <= -180) e += 360;
      return e;
    });
  assert.ok(Math.abs(Math.min(...ecarts) + REGARD_OUVERTURE) < 0.01 && Math.abs(Math.max(...ecarts) - REGARD_OUVERTURE) < 0.01,
    `demi-ouverture : de ${Math.min(...ecarts).toFixed(2)} à ${Math.max(...ecarts).toFixed(2)} degrés`);
  for (const p of cone) assert.ok(Math.hypot(p[0] - v.r.oeil[0], p[1] - v.r.oeil[1]) <= REGARD_PORTEE * v.s + 0.01, "portée");
  // L'œil est celui des scènes.
  const os = oeilScene({ x: v.x / v.s, y: v.y / v.s, cap });
  assert.ok(Math.hypot(os.x * v.s - v.r.oeil[0], os.y * v.s - v.r.oeil[1]) < 1e-6, "œil des scènes");
});

test("angles-morts : le deux-roues est tout entier dans la zone gauche", () => {
  const d = famille.DESSINS["angles-morts"]();
  const z = zoneDe(d, "angle-mort-gauche");
  const g = trouverRole(d, "deux-roues");
  const [x, y, lo, la] = ["data-x", "data-y", "data-longueur", "data-largeur"].map((k) => Number(g.attributs[k]));
  const v = vueDessus(d);
  assert.ok(Math.abs(lo - GABARITS.velo.longueur * v.s) < 1e-9 && Math.abs(la - GABARITS.velo.largeur * v.s) < 1e-9, "gabarit du vélo des scènes");
  const emprise = [[x - la / 2, y - lo / 2], [x + la / 2, y - lo / 2], [x + la / 2, y + lo / 2], [x - la / 2, y + lo / 2]];
  const dessin = trouverTous(g, (n) => n.balise === "path").flatMap((n) => pointsDe(n.attributs.d));
  for (const p of [...emprise, ...dessin]) assert.ok(dansPolygoneConvexe(p, z), `le point ${p} du deux-roues sort de la zone gauche`);
});

test("angles-morts : la voiture, la chaussée, le marquage, le cône du regard et le cycliste ont les teintes et les proportions des scènes", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d);
  const caisse = trouverRole(v.g, "caisse");
  assert.ok(Math.abs(Number(caisse.attributs.width) - GABARITS.voiture.longueur * v.s) < 1e-6, "longueur de la voiture des scènes");
  assert.ok(Math.abs(Number(caisse.attributs.height) - GABARITS.voiture.largeur * v.s) < 1e-6, "largeur de la voiture des scènes");
  assert.equal(caisse.attributs.fill, TEINTES.eleve);
  assert.equal(caisse.attributs.stroke, TEINTES.eleveBord);
  assert.equal(trouverRole(d, "chaussee").attributs.fill, TEINTES.chaussee);
  assert.equal(trouverRole(d, "coup-d-oeil").attributs.fill, TEINTES.regard);
  for (const t1 of trouverTous(d, (x) => x.attributs["data-r"] === "t1")) assert.equal(t1.attributs.fill, TEINTES.peinture);
  const couleurs = new Set(trouverTous(trouverRole(d, "deux-roues"), () => true).flatMap((x) => [x.attributs.fill, x.attributs.stroke]).filter((c) => c && c !== "none"));
  const attendues = new Set([TEINTES.cycliste, TEINTES.cyclisteOmbre, TEINTES.cyclisteBord, TEINTES.tete, TEINTES.velo, TEINTES.pneu]);
  assert.deepEqual([...couleurs].sort(), [...attendues].sort(), "teintes du cycliste des scènes");
  assert.equal(TEINTES_ROUTE.chaussee, TEINTES.chaussee);
  // Le fond de la chaussée épouse les coins du cadre du kit.
  const rayonKit = Number(cadre({ largeur: 1, hauteur: 1, titre: "essai" }).enfants[0].attributs.rx);
  const ch = pointsRole(d, "chaussee"), [L, H] = CATALOGUE["angles-morts"].cadre;
  const coin = ch.filter((p) => p[0] < rayonKit && p[1] > H - rayonKit);
  // (Tracés écrits à deux décimales : 0,01 unité de tolérance.)
  assert.ok(coin.length > 2 && coin.every((p) => Math.hypot(p[0] - rayonKit, p[1] - (H - rayonKit)) <= rayonKit + 0.01), "coins du bas de la chaussée arrondis au rayon du cadre");
  assert.ok(ch.every((p) => p[0] >= 0 && p[0] <= L && p[1] <= H), "chaussée dans le cadre");
});

test("angles-morts : chaque nom désigne ce qu'il nomme (angle mort dans sa zone, hors du deux-roues ; coup d'œil dans le cône)", () => {
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
  const t = textes(d);
  for (const mot of ["Angle mort", "Coup d'œil", "par-dessus l'épaule", "Rétroviseur gauche", "Rétroviseur droit", "Rétroviseur", "intérieur"]) {
    assert.ok(t.includes(mot), mot);
  }
});

test("angles-morts : les rétroviseurs extérieurs regardent vers l'arrière le long du flanc, l'intérieur dans l'axe", () => {
  const d = famille.DESSINS["angles-morts"]();
  const v = vueDessus(d);
  // Le bord intérieur de chaque champ extérieur part du miroir, droit vers l'arrière (parallèle à l'axe de la voiture).
  for (const [role, miroirPt] of [["champ-gauche", v.r.retroGauche], ["champ-droit", v.r.retroDroit]]) {
    const pts = pointsRole(d, role);
    assert.ok(pts.some((p) => Math.hypot(p[0] - miroirPt[0], p[1] - miroirPt[1]) < 0.01), `${role} : part du miroir`);
    assert.ok(pts.some((p) => Math.abs(p[0] - miroirPt[0]) < 0.01 && p[1] > miroirPt[1] + 100), `${role} : bord intérieur le long du flanc`);
  }
  // Le champ intérieur est symétrique par rapport à l'axe de la voiture.
  const ci = pointsRole(d, "champ-interieur"), b = boite(ci);
  assert.ok(Math.abs((b.x1 + b.x2) / 2 - v.x) < 0.01, "champ intérieur dans l'axe");
  assert.ok(VOITURE.longueur === GABARITS.voiture.longueur, "la voiture du kit est celle des scènes");
});
