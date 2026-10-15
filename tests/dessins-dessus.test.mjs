import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-dessus.js";
import { SOURCES } from "../sources/dessins-dessus.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { imageA, imageFigee } from "../js/geste-regles.js";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { VOITURE, MATIERES, reperesDessus, LARGEUR_TELEPHONE, TRAIT_MIN_PX } from "../js/dessins-kit.js";
import { GABARITS } from "../js/scene-geometrie.js";
import { TEINTES } from "../js/scene-rendu.js";
import { REGARD_PORTEE, REGARD_OUVERTURE } from "../js/scene-regard.js";
import { OPACITE_CONE } from "../js/scene-moteur.js";
import { DESSIN, IISR } from "../js/scene-decors.js";

const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "dessus");

test("dessus : chaque code du catalogue est dessiné et passe les contrôles communs", () => {
  for (const code of codes) {
    const e = CATALOGUE[code];
    if (e.bloc === "dessin") assert.deepEqual(verifierDessin(famille.DESSINS[code](), e.cadre), [], code);
    else assert.deepEqual(verifierGeste(famille.GESTES[code].construire(), e), [], code);
  }
  const fournis = [...Object.keys(famille.DESSINS), ...Object.keys(famille.GESTES || {})].sort();
  assert.deepEqual(fournis, [...codes].sort());
});

test("dessus : chaque dessin a ses sources, dont ses choix de dessin", () => {
  for (const code of codes) {
    assert.ok(Array.isArray(SOURCES[code]) && SOURCES[code].length >= 2, code);
    assert.ok(SOURCES[code].some((s) => s.startsWith("Choix de dessin")), code);
  }
});

// ===== Aides de lecture des dessins (tests seulement) =====

const DEG = Math.PI / 180;
const dessin = (code) => famille.DESSINS[code]();
const nombres = (s) => String(s).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g).map(Number);
const paires = (s) => { const v = nombres(s), r = []; for (let i = 0; i + 1 < v.length; i += 2) r.push([v[i], v[i + 1]]); return r; };
// Points d'un tracé fait de segments (M ... L ... Z), tels qu'écrits.
const pointsDe = (noeud) => paires(noeud.attributs.d);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const textesDe = (noeud) => trouverTous(noeud, (x) => x.balise === "text").map(texteDe);
const point = (noeud) => [Number(noeud.attributs["data-x"]), Number(noeud.attributs["data-y"])];
const ecartAngle = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;   // degrés, dans ]-180 ; 180]

function dansPolygone([x, y], poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
// Projection d'un point sur une ligne brisée : abscisse curviligne du point le plus proche et distance à lui.
function projeter(p, ligne) {
  let meilleur = { s: 0, distance: Infinity }, cumul = 0;
  for (let i = 0; i + 1 < ligne.length; i++) {
    const [a, b] = [ligne[i], ligne[i + 1]], l = distance(a, b);
    const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (l * l)));
    const q = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], dq = distance(p, q);
    if (dq < meilleur.distance - 1e-9) meilleur = { s: cumul + t * l, distance: dq };
    cumul += l;
  }
  return meilleur;
}
const longueur = (ligne) => ligne.slice(1).reduce((somme, p, i) => somme + distance(ligne[i], p), 0);

// Pose d'une voiture du kit vue du dessus : centre et cap (degrés) écrits sur son groupe, échelle (unités par mètre) lue sur
// la largeur de sa caisse, ramenée à la longueur de la voiture des scènes.
function poseDe(voiture) {
  const a = voiture.attributs, caisse = trouverRole(voiture, "caisse").attributs;
  return { x: a["data-x"], y: a["data-y"], cap: a["data-angle"], echelle: caisse.width / GABARITS.voiture.longueur };
}
// Repère local d'une voiture (unités, avant son translate et son rotate) vers le cadre ; mètres de la voiture (x vers l'avant,
// y vers sa droite) vers le cadre ; et du cadre vers les mètres de la voiture.
const localVersCadre = ({ x, y, cap }) => ([px, py]) => [x + px * Math.cos(cap * DEG) - py * Math.sin(cap * DEG),
  y + px * Math.sin(cap * DEG) + py * Math.cos(cap * DEG)];
const metresVersCadre = (pose) => ([mx, my]) => localVersCadre(pose)([mx * pose.echelle, my * pose.echelle]);
const cadreVersMetres = ({ x, y, cap, echelle }) => ([px, py]) => {
  const dx = px - x, dy = py - y, c = Math.cos(cap * DEG), s = Math.sin(cap * DEG);
  return [(dx * c + dy * s) / echelle, (-dx * s + dy * c) / echelle];
};
// Translation et rotation d'un attribut transform « translate(a b) rotate(c) ».
function transformDe(noeud) {
  const t = String(noeud.attributs.transform || "");
  const tr = t.match(/translate\(([^)]*)\)/), ro = t.match(/rotate\(([^)]*)\)/);
  const [tx, ty] = tr ? nombres(tr[1]) : [0, 0];
  const [angle, rx = 0, ry = 0] = ro ? nombres(ro[1]) : [0];
  return { tx, ty, angle, rx, ry };
}
const tourner = ([px, py], [cx, cy], angle) => {
  const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG);
  return [cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c];
};

// Forme, dans le cadre, d'une partie de la voiture du kit qu'une étiquette désigne : polygones (caisse découpée, vitre, feu,
// roue) ou segments épais (balais d'essuie-glace).
function formeDe(partie, pose) {
  const versCadre = localVersCadre(pose);
  if (partie.balise === "path") return { polygones: [pointsDe(partie).map(versCadre)], segments: [] };
  const lignes = trouverTous(partie, (x) => x.balise === "line");
  if (lignes.length) {
    return { polygones: [], segments: lignes.map((l) => ({ a: versCadre([l.attributs.x1, l.attributs.y1]), b: versCadre([l.attributs.x2, l.attributs.y2]),
      demi: Number(l.attributs["stroke-width"]) / 2 })) };
  }
  const rect = trouverTous(partie, (x) => x.balise === "rect")[0].attributs, t = transformDe(partie);
  const coins = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]]
    .map((p) => tourner(p, [0, 0], t.angle)).map(([px, py]) => versCadre([px + t.tx, py + t.ty]));
  return { polygones: [coins], segments: [] };
}
// Distance d'un point à un segment.
function distanceSegment(p, a, b) {
  const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2));
  return distance(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}
// Le point d'une étiquette est-il posé sur la forme ? Et quelle part de la forme son disque (liseré compris) recouvre-t-il ?
// Polygones : part de leur aire, échantillonnée sur une grille de 0,1 unité ; segments : part de leur longueur.
const PAS_GRILLE = 0.1;
function poseSur(centre, forme) {
  return forme.polygones.some((poly) => dansPolygone(centre, poly)) || forme.segments.some((s) => distanceSegment(centre, s.a, s.b) <= s.demi);
}
function partCachee(centre, rayon, forme) {
  let dedans = 0, cache = 0;
  for (const poly of forme.polygones) {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += PAS_GRILLE) {
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += PAS_GRILLE) {
        if (!dansPolygone([x, y], poly)) continue;
        dedans++;
        if (distance([x, y], centre) <= rayon) cache++;
      }
    }
  }
  for (const s of forme.segments) {
    const n = Math.ceil(distance(s.a, s.b) / PAS_GRILLE);
    for (let k = 0; k <= n; k++) {
      const p = [s.a[0] + ((s.b[0] - s.a[0]) * k) / n, s.a[1] + ((s.b[1] - s.a[1]) * k) / n];
      dedans++;
      if (distance(p, centre) <= rayon) cache++;
    }
  }
  return cache / dedans;
}
// Distance d'un point au contour d'une forme (côtés de ses polygones, ou bords de ses segments épais).
function distanceAuBord(p, forme) {
  const cotes = forme.polygones.flatMap((poly) => poly.map((a, i) => distanceSegment(p, a, poly[(i + 1) % poly.length])));
  const bords = forme.segments.map((s) => Math.abs(distanceSegment(p, s.a, s.b) - s.demi));
  return Math.min(...cotes, ...bords);
}
// Rayon du disque du point d'une étiquette, liseré compris : le plus grand cercle de l'étiquette.
const rayonPoint = (etiquette) => Math.max(...trouverTous(etiquette, (x) => x.balise === "circle").map((c) => Number(c.attributs.r)));
// Px d'un téléphone par unité du cadre (le cadre fait 320 unités de large).
const PX = LARGEUR_TELEPHONE / 320;
// Distance de deux segments, nulle s'ils se coupent.
function distanceSegments(a, b, c, e) {
  const cote = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  if (cote(a, b, c) * cote(a, b, e) < 0 && cote(c, e, a) * cote(c, e, b) < 0) return 0;
  return Math.min(distanceSegment(a, c, e), distanceSegment(b, c, e), distanceSegment(c, a, b), distanceSegment(e, a, b));
}
// Deux polygones se recouvrent-ils ? Un sommet de l'un dans l'autre, ou deux côtés qui se coupent.
function seRecouvrent(P, Q) {
  if (P.some((p) => dansPolygone(p, Q)) || Q.some((q) => dansPolygone(q, P))) return true;
  return P.some((a, i) => Q.some((c, j) => distanceSegments(a, P[(i + 1) % P.length], c, Q[(j + 1) % Q.length]) === 0));
}
// Polygone de la caisse d'une voiture du kit vue du dessus, dans le cadre (rectangle, coins vifs).
function caisseDe(voiture, pose) {
  const c = trouverRole(voiture, "caisse").attributs;
  return [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]].map(localVersCadre(pose));
}
// Un point d'étiquette cache au plus le quart de ce qu'il désigne (décision commune 3 du lot : le détail se reconnaît sur un
// téléphone et le point ne le recouvre pas). Posé au milieu d'un phare, d'un feu ou d'une roue braquée, il en cacherait de 27 à
// 31 % (mesures du 15/10/2026).
const PART_CACHEE_MAX = 0.25;

// ===== Recopie des valeurs des scènes =====

test("dessus : les valeurs de la rue reprises des scènes sont celles des scènes (voie, axiale, jeu au trottoir)", () => {
  const r = famille.RECOPIE_SCENES;
  assert.equal(r.voie, DESSIN.voie);
  assert.deepEqual(r.axiale, { trait: IISR.axialeAgglo.trait, vide: IISR.axialeAgglo.vide, largeur: 2 * IISR.u });
  assert.equal(r.jeuStationnement, DESSIN.jeuStationnement);
  // Le regard et les valeurs du kit (repères d'Outfit, rayon des vignettes, joints du capot, matières) ne sont plus recopiés
  // ici : le module les lit dans le kit (REGARD_SCENES, METRIQUES_POLICE, MISE_EN_PAGE, VOITURE, MATIERES).
  assert.deepEqual(Object.keys(r).sort(), ["axiale", "jeuStationnement", "voie"]);
  assert.equal(famille.RECOPIE_KIT, undefined);
});

// ===== tour-vehicule =====

// Parcours du tour : le tour extérieur, puis le chemin qui gagne le devant du capot, puis celui de l'habitacle, bout à bout.
function parcoursDe(d) {
  const [exterieur, capot, habitacle] = ["parcours-exterieur", "parcours-capot", "parcours-habitacle"].map((r) => pointsDe(trouverRole(d, r)));
  return { exterieur, capot, habitacle, tout: [...exterieur, ...capot.slice(1), ...habitacle.slice(1)] };
}
// Écart d'un point (mètres de la voiture) au rectangle de la caisse.
const ecartCaisse = ([mx, my]) => Math.hypot(Math.max(Math.abs(mx) - GABARITS.voiture.longueur / 2, 0),
  Math.max(Math.abs(my) - GABARITS.voiture.largeur / 2, 0));
// Région d'un point (mètres de la voiture) autour d'elle : devant, derrière, à sa gauche, à sa droite, ou dans un coin.
function region([mx, my]) {
  const [dl, dw] = [GABARITS.voiture.longueur / 2, GABARITS.voiture.largeur / 2];
  if (Math.abs(my) <= dw) return mx > dl ? "avant" : mx < -dl ? "arriere" : "caisse";
  if (Math.abs(mx) <= dl) return my < 0 ? "gauche" : "droite";
  return "coin";
}

test("tour-vehicule : le tour entoure la caisse, coins et rétroviseurs compris, à distance d'elle", () => {
  const d = dessin("tour-vehicule");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const { exterieur, capot } = parcoursDe(d);
  const tour = [...exterieur, ...capot.slice(1)];
  for (const coin of caisseDe(voiture, pose)) assert.ok(dansPolygone(coin, tour), `coin de la caisse hors du tour : ${coin}`);
  for (const r of ["retroviseur-gauche", "retroviseur-droit"]) assert.ok(dansPolygone(point(trouverRole(voiture, r)), tour), r);
  // On tourne autour de la voiture sans la frôler : le tour extérieur à 0,5 m au moins du rectangle de la caisse ; le chemin qui
  // gagne le devant du capot, plus près, à 0,25 m au moins (au-delà des rétroviseurs, 0,12 m hors de la caisse).
  for (const p of exterieur) {
    const e = ecartCaisse(cadreVersMetres(pose)(p));
    assert.ok(e >= 0.5, `point du tour à ${e.toFixed(2)} m de la caisse`);
  }
  for (const p of capot) {
    const e = ecartCaisse(cadreVersMetres(pose)(p));
    assert.ok(e >= 0.25, `point du chemin du capot à ${e.toFixed(2)} m de la caisse`);
  }
});

test("tour-vehicule : le tour suit l'ordre du cours : l'avant d'abord, un côté, l'arrière, l'autre côté ; puis le capot, puis l'habitacle", () => {
  const d = dessin("tour-vehicule");
  const pose = poseDe(trouverRole(d, "voiture"));
  const { exterieur, capot, habitacle } = parcoursDe(d);
  const enMetres = exterieur.map(cadreVersMetres(pose)), regions = enMetres.map(region);
  assert.equal(regions[0], "avant", `le tour commence devant la voiture, pas ${regions[0]}`);
  const troncons = regions.filter((r) => r !== "coin").filter((r, i, t) => i === 0 || r !== t[i - 1]);
  assert.equal(troncons.length, 4, `tronçons du tour : ${troncons.join(", ")}`);
  assert.deepEqual([troncons[0], troncons[2]], ["avant", "arriere"], `tronçons du tour : ${troncons.join(", ")}`);
  assert.deepEqual([troncons[1], troncons[3]].sort(), ["droite", "gauche"], `tronçons du tour : ${troncons.join(", ")}`);
  // Le premier tronçon longe tout l'avant, d'un coin de la caisse à l'autre.
  const premier = enMetres.slice(0, regions.findIndex((r) => r !== "avant")).map((p) => p[1]);
  assert.ok(Math.max(...premier) - Math.min(...premier) >= 2 * (VOITURE.largeur / 2 - VOITURE.rayon) - 0.01, "le tour longe tout l'avant d'abord");
  // Puis le capot : le chemin qui suit le tour finit devant le capot (en avant du nez, dans l'axe) ; puis l'habitacle : le parcours
  // finit à la place du conducteur.
  const [m2x, m2y] = cadreVersMetres(pose)(capot[capot.length - 1]);
  assert.ok(region([m2x, m2y]) === "avant" && Math.abs(m2y) < 0.45, `le chemin du capot finit devant le capot : ${m2x}, ${m2y}`);
  assert.ok(distance(habitacle[habitacle.length - 1], reperesDessus(pose).oeil) < 0.01, "le parcours finit à la place du conducteur");
});

// Deux passages du parcours, à plus de ELOIGNES unités l'un de l'autre le long du parcours, restent à ECART_PASSAGES unités au
// moins l'un de l'autre : le tour ne repasse pas sur lui-même (ses deux chemins, extérieur et intérieur, sont à 15 unités).
const ELOIGNES = 40, ECART_PASSAGES = 12;

test("tour-vehicule : le parcours ne repasse jamais sur lui-même, ses passages restent séparés", () => {
  const { tout } = parcoursDe(dessin("tour-vehicule"));
  const s = [0];
  for (let i = 1; i < tout.length; i++) s.push(s[i - 1] + distance(tout[i - 1], tout[i]));
  for (let i = 0; i + 1 < tout.length; i++) {
    for (let j = i + 1; j + 1 < tout.length; j++) {
      if (s[j] - s[i + 1] <= ELOIGNES) continue;
      const e = distanceSegments(tout[i], tout[i + 1], tout[j], tout[j + 1]);
      assert.ok(e >= ECART_PASSAGES, `deux passages à ${e.toFixed(1)} unités, vers ${tout[i].map((x) => x.toFixed(0))} et ${tout[j].map((x) => x.toFixed(0))}`);
    }
  }
});

test("tour-vehicule : les repères 1, 2 et 3 se suivent dans l'ordre du parcours : extérieur, puis capot, puis habitacle", () => {
  const d = dessin("tour-vehicule");
  const pose = poseDe(trouverRole(d, "voiture"));
  const { exterieur, capot, habitacle, tout } = parcoursDe(d);
  assert.ok(distance(exterieur[exterieur.length - 1], capot[0]) < 1e-6 && distance(capot[capot.length - 1], habitacle[0]) < 1e-6,
    "le parcours est d'un seul tenant");
  const reperes = [1, 2, 3].map((k) => {
    const g = trouverRole(d, `repere-${k}`);
    assert.equal(textesDe(g).join(""), String(k), `numéro du repère ${k}`);
    return point(g);
  });
  const abscisses = reperes.map((p, i) => {
    const pr = projeter(p, tout);
    assert.ok(pr.distance < 0.01, `repère ${i + 1} hors du parcours`);
    return pr.s;
  });
  assert.ok(abscisses[0] < abscisses[1] && abscisses[1] < abscisses[2], `ordre du parcours : ${abscisses.map((s) => s.toFixed(1))}`);
  // 1 au départ du tour extérieur ; 2 au bout du chemin qui gagne le devant du capot ; 3 au bout du parcours, à la place du
  // conducteur (l'œil du conducteur de la voiture du kit, à gauche).
  assert.ok(abscisses[0] < 0.01, "repère 1 au départ");
  assert.ok(Math.abs(abscisses[1] - (longueur(exterieur) + longueur(capot))) < 0.01, "repère 2 au bout du chemin du capot");
  assert.ok(Math.abs(abscisses[2] - longueur(tout)) < 0.01, "repère 3 au bout du parcours");
  assert.ok(distance(reperes[2], reperesDessus(pose).oeil) < 0.01, "repère 3 à la place du conducteur");
  assert.ok(longueur(habitacle) > 0, "chemin de l'habitacle");
  // Chaque repère porte le nom de son étape, les mots du cours.
  const noms = { 1: "Extérieur", 2: "Capot", 3: "Habitacle" };
  for (const k of [1, 2, 3]) {
    const nom = trouverRole(d, `nom-${k}`);
    assert.equal(textesDe(nom).join(" "), noms[k], `nom du repère ${k}`);
    const rayonDisque = Number(trouverTous(trouverRole(d, `repere-${k}`), (x) => x.balise === "circle")[0].attributs.r);
    if (trouverRole(nom, "filet")) {
      assert.ok(distance(point(nom), reperes[k - 1]) <= rayonDisque + 0.01, `le filet du nom ${k} part de son repère`);
    } else {
      const t = trouverTous(nom, (x) => x.balise === "text")[0].attributs;
      const proches = reperes.map((p) => distance(p, [Number(t.x), Number(t.y)]));
      assert.equal(proches.indexOf(Math.min(...proches)), k - 1, `le nom ${k} est à côté de son repère`);
    }
  }
});

test("tour-vehicule : les flèches du sens de marche suivent le parcours", () => {
  const d = dessin("tour-vehicule");
  const parcours = parcoursDe(d).tout;
  const fleches = trouverTous(d, (x) => x.attributs["data-r"] === "sens-parcours");
  assert.ok(fleches.length >= 3, `${fleches.length} flèches`);
  for (const f of fleches) {
    const depart = pointsDe(trouverRole(f, "fleche-trait"))[0], pointe = pointsDe(trouverRole(f, "fleche-tete"))[0];
    const [a, b] = [projeter(depart, parcours), projeter(pointe, parcours)];
    assert.ok(a.distance < 0.5 && b.distance < 0.5, "flèche posée sur le parcours");
    assert.ok(b.s > a.s, "la flèche va dans le sens du parcours");
  }
});

test("tour-vehicule : chaque étiquette de l'extérieur reprend les mots du cours et désigne sa partie, sans la cacher", () => {
  const d = dessin("tour-vehicule");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const ATTENDUS = [
    ["feux-avant", "Feux et clignotants", ["phare-gauche", "phare-droit"]],
    ["pneus", "Pneus", ["roue-avant-gauche", "roue-avant-droite", "roue-arriere-gauche", "roue-arriere-droite"]],
    ["balais", "Balais d'essuie-glace", ["essuie-glaces"]],
    ["feux-arriere", "Feux et plaque", ["feu-gauche", "feu-droit"]],
    ["vitres", "Vitres", ["vitre-avant-gauche", "vitre-avant-droite", "vitre-arriere-gauche", "vitre-arriere-droite"]],
  ];
  for (const [role, mots, parties] of ATTENDUS) {
    const e = trouverRole(d, `etiquette-${role}`);
    assert.ok(e, role);
    assert.equal(textesDe(e).join(" "), mots, role);
    const centre = point(e);
    const formes = parties.map((p) => formeDe(trouverRole(voiture, p), pose)).filter((f) => poseSur(centre, f));
    assert.equal(formes.length, 1, `${role} : le point n'est posé sur aucune des parties ${parties.join(", ")}`);
    const part = partCachee(centre, rayonPoint(e), formes[0]);
    assert.ok(part <= PART_CACHEE_MAX, `${role} : le point cache ${(100 * part).toFixed(0)} % de sa partie`);
    // Le point mord sur le bord de sa pièce (une part de son disque dehors), jamais en plein milieu : son centre à moins d'un
    // demi-rayon de point du contour.
    const bord = distanceAuBord(centre, formes[0]);
    assert.ok(bord <= rayonPoint(e) / 2, `${role} : point à ${bord.toFixed(2)} unités du bord de sa partie, en plein milieu`);
  }
});

// Aire et périmètre d'un polygone ; épaisseur et longueur d'une pièce mince : pour un polygone, son aire sur son demi-périmètre et
// son demi-périmètre ; pour un segment épais (balai), sa largeur et sa longueur.
const aire = (poly) => Math.abs(poly.reduce((somme, p, i) => { const q = poly[(i + 1) % poly.length]; return somme + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const perimetre = (poly) => poly.reduce((somme, p, i) => somme + distance(p, poly[(i + 1) % poly.length]), 0);
function dimensions(forme, centre) {
  const segment = forme.segments.find((s) => distanceSegment(centre, s.a, s.b) <= s.demi);
  if (segment) return { epaisseur: 2 * segment.demi, longueur: distance(segment.a, segment.b) };
  const poly = forme.polygones.find((q) => dansPolygone(centre, q)), demiPerimetre = perimetre(poly) / 2;
  return { epaisseur: aire(poly) / demiPerimetre, longueur: demiPerimetre };
}

test("tour-vehicule : chaque pièce désignée se voit sur un téléphone, épaisse d'un trait, longue de deux points d'étiquette", () => {
  const d = dessin("tour-vehicule");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const PARTIES = { "feux-avant": ["phare-gauche", "phare-droit"], pneus: ["roue-avant-gauche", "roue-avant-droite", "roue-arriere-gauche", "roue-arriere-droite"],
    balais: ["essuie-glaces"], "feux-arriere": ["feu-gauche", "feu-droit"], vitres: ["vitre-avant-gauche", "vitre-avant-droite", "vitre-arriere-gauche", "vitre-arriere-droite"] };
  for (const [role, parties] of Object.entries(PARTIES)) {
    const e = trouverRole(d, `etiquette-${role}`), centre = point(e);
    const forme = parties.map((p) => formeDe(trouverRole(voiture, p), pose)).find((f) => poseSur(centre, f));
    const { epaisseur, longueur: long } = dimensions(forme, centre);
    // Épaisse d'au moins un trait sur un téléphone, et plus longue que deux fois le point de son étiquette (liseré compris) : le point
    // n'en couvre qu'un bout.
    assert.ok(epaisseur * PX >= TRAIT_MIN_PX, `${role} : ${(epaisseur * PX).toFixed(2)} px d'épaisseur`);
    assert.ok(long >= 2 * 2 * rayonPoint(e), `${role} : ${long.toFixed(1)} unités de long, moins de deux points d'étiquette`);
  }
});

test("tour-vehicule : capot ouvert, charnière côté pare-brise, compartiment découvert devant le capot relevé", () => {
  const d = dessin("tour-vehicule");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const capot = trouverRole(d, "capot-ouvert");
  const ouverture = Number(capot.attributs["data-angle"]);
  assert.ok(ouverture > 0 && ouverture < 90, `ouverture de ${ouverture} degrés`);
  // Le groupe du capot a la pose de la voiture : ses tracés sont dans le repère local de la caisse.
  const versM = (p) => cadreVersMetres(pose)(localVersCadre(pose)(p));
  const compartiment = pointsDe(trouverRole(capot, "compartiment")).map(versM);
  const releve = pointsDe(trouverRole(capot, "capot-releve")).map(versM);
  // Le fond sombre du compartiment est la matière du kit, celle du compartiment du dessin « capot ».
  assert.equal(trouverRole(capot, "compartiment").attributs.fill, MATIERES.compartiment);
  // Le compartiment est le capot fermé de la voiture du kit : ses deux joints (les traits de la caisse) en sont les bords.
  const joints = voiture.enfants.filter((x) => x.balise === "line").map((l) => [[l.attributs.x1, l.attributs.y1], [l.attributs.x2, l.attributs.y2]].map(versM));
  assert.equal(joints.length, 2, "les deux joints du capot de la voiture du kit");
  for (const joint of joints) {
    for (const bout of joint) assert.ok(compartiment.some((p) => distance(p, bout) < 0.005), `bout de joint ${bout} hors du bord du compartiment`);
  }
  const pied = VOITURE.longueur / 2 - VOITURE.pareBrise.recul + VOITURE.pareBrise.profondeur;
  for (const [mx, my] of compartiment) assert.ok(mx >= pied && mx <= VOITURE.longueur / 2 && Math.abs(my) <= VOITURE.largeur / 2, "compartiment hors du capot");
  // Charnière à l'arrière du capot (côté pare-brise) : le capot relevé part d'elle et, vu du dessus, ne s'étend vers l'avant que de
  // sa longueur multipliée par le cosinus de l'ouverture.
  const xs = compartiment.map((p) => p[0]), charniere = Math.min(...xs), long = Math.max(...xs) - charniere;
  const rx = releve.map((p) => p[0]);
  assert.ok(Math.abs(Math.min(...rx) - charniere) < 0.005, "le capot relevé part de la charnière");
  assert.ok(Math.abs(Math.max(...rx) - (charniere + long * Math.cos(ouverture * DEG))) < 0.005, "raccourci du capot relevé");
  // En pivotant autour de sa charnière, le capot garde ses largeurs : vu du dessus, son bord avant relevé a la largeur de son bord
  // avant fermé (le bout avant des joints) ; son bord arrière, celle de la charnière.
  const bouts = joints.flat(), xAvant = Math.max(...bouts.map((p) => p[0])), xArriere = Math.min(...bouts.map((p) => p[0]));
  const demiLargeur = (x) => Math.abs(bouts.find((p) => Math.abs(p[0] - x) < 1e-6)[1]);
  const bord = (x) => releve.filter((p) => Math.abs(p[0] - x) < 0.005);
  for (const [nom, x, demi] of [["avant", Math.max(...rx), demiLargeur(xAvant)], ["arrière", Math.min(...rx), demiLargeur(xArriere)]]) {
    assert.ok(bord(x).length >= 2 && bord(x).every((p) => Math.abs(Math.abs(p[1]) - demi) < 0.005),
      `bord ${nom} du capot relevé à ${bord(x).map((p) => Math.abs(p[1]).toFixed(3))} m de l'axe, ${demi} m attendu`);
  }
});

// ===== roues-trottoir =====
// Deux cas côte à côte : en descente (à gauche), en montée (à droite). Dans chaque cas (groupe cas-<nom>) : son titre, l'étiquette
// des roues, la rue vue du dessus (groupe plan) et la voiture de profil sur la pente (groupe vignette-pente).
const CAS_PENTE = [
  { nom: "descente", titre: "En descente", roues: "Roues braquées vers le trottoir" },
  { nom: "montee", titre: "En montée", roues: "Roues braquées vers la chaussée" },
];
// Un cas lu dans le dessin : la voiture vue du dessus et sa pose ; le côté du trottoir dans le repère de la voiture (1 : à sa droite)
// et le jeu entre son flanc et la bordure (m) ; l'angle des roues avant et arrière ; de profil, la pente (degrés), les centres des
// roues avant et arrière une fois la voiture tournée de la pente, et l'échelle de la voiture de profil (empattement dessiné).
function casDe(d, nom) {
  const g = trouverRole(d, `cas-${nom}`);
  assert.ok(g, `cas ${nom} absent`);
  const plan = trouverRole(g, "plan"), voiture = trouverRole(plan, "voiture"), pose = poseDe(voiture);
  const trottoir = pointsDe(trouverRole(plan, "trottoir"));
  const ys = trottoir.map(cadreVersMetres(pose)).map((p) => p[1]);
  const [cote, coteMax] = [Math.sign(Math.min(...ys)), Math.sign(Math.max(...ys))];
  const angle = (r) => Number(trouverRole(voiture, r).attributs["data-angle"]);
  const vignette = trouverRole(g, "vignette-pente"), pente = trouverRole(vignette, "pente"), t = transformDe(pente);
  const profil = trouverRole(pente, "voiture-profil");
  const brut = ["roue-avant", "roue-arriere"].map((r) => point(trouverRole(profil, r)));
  const [av, ar] = brut.map((p) => tourner(p, [t.rx, t.ry], t.angle));
  return { g, plan, voiture, pose, trottoir, cote: cote === coteMax ? cote : 0, jeu: Math.min(...ys.map(Math.abs)) - GABARITS.voiture.largeur / 2,
    avant: ["roue-avant-gauche", "roue-avant-droite"].map(angle), arriere: ["roue-arriere-gauche", "roue-arriere-droite"].map(angle),
    vignette, pente, t, profil, av, ar, echelleProfil: distance(brut[0], brut[1]) / VOITURE.empattement };
}

test("roues-trottoir : deux cas côte à côte, « En descente » à gauche puis « En montée », chacun sous son titre", () => {
  const d = dessin("roues-trottoir");
  const [descente, montee] = CAS_PENTE.map((c) => casDe(d, c.nom));
  for (const [c, cas] of [[CAS_PENTE[0], descente], [CAS_PENTE[1], montee]]) {
    assert.deepEqual(textesDe(trouverRole(cas.g, `titre-${c.nom}`)), [c.titre], c.nom);
  }
  assert.ok(descente.pose.x < montee.pose.x, "la descente à gauche, la montée à droite");
  assert.equal(descente.pose.y, montee.pose.y, "les deux vues du dessus à la même hauteur");
  assert.equal(descente.t.ry, montee.t.ry, "les deux profils à la même hauteur");
});

test("roues-trottoir : dans chaque cas, la voiture garée le long du trottoir de droite, roues avant nettement braquées, roues arrière droites ; de profil, la même voiture à la même échelle, l'avant du même côté", () => {
  const d = dessin("roues-trottoir");
  for (const c of CAS_PENTE) {
    const cas = casDe(d, c.nom);
    assert.equal(cas.cote, 1, `${c.nom} : trottoir d'un seul côté, à droite de la voiture`);
    assert.ok(cas.jeu > 0 && cas.jeu <= 0.5, `${c.nom} : jeu de ${cas.jeu.toFixed(2)} m au trottoir`);
    // Le long du trottoir : bordure parallèle à la voiture, plus longue qu'elle.
    const bordure = cas.trottoir.map(cadreVersMetres(cas.pose)).filter((p) => Math.abs(p[1] - (GABARITS.voiture.largeur / 2 + cas.jeu)) < 1e-6);
    assert.ok(bordure.length >= 2 && Math.max(...bordure.map((p) => p[0])) - Math.min(...bordure.map((p) => p[0])) > GABARITS.voiture.longueur, `${c.nom} : bordure le long de la voiture`);
    assert.equal(cas.avant[0], cas.avant[1], `${c.nom} : les deux roues avant au même angle`);
    assert.ok(Math.abs(cas.avant[0]) >= 15, `${c.nom} : braquage visible (${cas.avant[0]} degrés)`);
    assert.deepEqual(cas.arriere, [0, 0], `${c.nom} : roues arrière droites`);
    assert.equal(cas.pose.cap, 0, `${c.nom} : vue du dessus, l'avant à droite`);
    assert.ok(cas.av[0] > cas.ar[0], `${c.nom} : de profil, l'avant à droite aussi (vue du trottoir)`);
    assert.ok(Math.abs(cas.echelleProfil - cas.pose.echelle) < 1e-6, `${c.nom} : profil à ${cas.echelleProfil} unités par mètre, vue du dessus à ${cas.pose.echelle}`);
  }
});

test("roues-trottoir : le braquage suit la pente, lu dans le dessin : l'avant plus bas que l'arrière (en descente), roues vers le trottoir ; l'avant plus haut (en montée), vers la chaussée", () => {
  const d = dessin("roues-trottoir");
  const vus = new Set();
  for (const c of CAS_PENTE) {
    const cas = casDe(d, c.nom);
    assert.notEqual(cas.av[1], cas.ar[1], `${c.nom} : voiture de profil à plat`);
    const descend = cas.av[1] > cas.ar[1];   // l'avant plus bas : y croît vers le bas du cadre
    assert.equal(c.titre, descend ? "En descente" : "En montée", `${c.nom} : le titre ne dit pas la pente dessinée`);
    // Vers le trottoir : braquage du signe du côté du trottoir (à droite, positif) ; vers la chaussée : du signe opposé.
    const vers = Math.sign(cas.avant[0]) === cas.cote ? "le trottoir" : "la chaussée";
    assert.equal(vers, descend ? "le trottoir" : "la chaussée", `${c.nom} : roues avant braquées vers ${vers} (${cas.avant[0]} degrés)`);
    vus.add(descend);
  }
  assert.equal(vus.size, 2, "une descente et une montée");
});

test("roues-trottoir : de profil, le sol et la voiture suivent la même pente, nette, les deux roues posées sur le sol", () => {
  const d = dessin("roues-trottoir");
  for (const c of CAS_PENTE) {
    const cas = casDe(d, c.nom), a = Number(cas.pente.attributs["data-angle"]);
    assert.ok(Math.abs(a) >= 3 && Math.abs(a) <= 20, `${c.nom} : pente de ${a} degrés`);
    assert.equal(cas.t.angle, a, `${c.nom} : la voiture de profil tourne de la pente`);
    // Le sol suit la pente ; son tracé commence par sa surface, de gauche à droite.
    const [s0, s1] = pointsDe(trouverRole(cas.vignette, "sol"));
    assert.ok(s1[0] > s0[0] && Math.abs(Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) / DEG - a) < 0.01, `${c.nom} : sol incliné de la pente`);
    const rayon = (r) => Number(trouverTous(trouverRole(cas.profil, r), (x) => x.attributs["data-r"] === "pneu")[0].attributs.r);
    for (const [r, centre] of [["roue-avant", cas.av], ["roue-arriere", cas.ar]]) {
      const pied = [centre[0] - rayon(r) * Math.sin(a * DEG), centre[1] + rayon(r) * Math.cos(a * DEG)];
      assert.ok(distanceSegment(pied, s0, s1) < 0.05, `${c.nom} : ${r} posée sur le sol`);
    }
  }
});

test("roues-trottoir : rien ne recouvre les roues avant braquées, aucun rétroviseur posé dessus", () => {
  const d = dessin("roues-trottoir");
  for (const c of CAS_PENTE) {
    const cas = casDe(d, c.nom);
    const roues = ["roue-avant-gauche", "roue-avant-droite"].map((r) => formeDe(trouverRole(cas.voiture, r), cas.pose).polygones[0]);
    for (const r of ["retroviseur-gauche", "retroviseur-droit"]) {
      const g = trouverRole(cas.voiture, r);
      if (!g) continue;
      const boitier = pointsDe(trouverTous(g, (x) => x.balise === "path")[0]).map(localVersCadre(cas.pose));
      roues.forEach((roue, i) => assert.ok(!seRecouvrent(boitier, roue), `${c.nom} : ${r} posé sur la roue avant ${i ? "droite" : "gauche"}`));
    }
  }
});

test("roues-trottoir : étiquettes aux mots du cours ; leur point désigne une roue avant sans la cacher ; le mot « Trottoir » écrit sur le trottoir", () => {
  const d = dessin("roues-trottoir");
  for (const c of CAS_PENTE) {
    const cas = casDe(d, c.nom);
    const e = trouverRole(cas.g, `etiquette-roues-${c.nom}`);
    assert.ok(e, `${c.nom} : étiquette des roues`);
    assert.equal(textesDe(e).join(" "), c.roues, c.nom);
    const roue = ["roue-avant-gauche", "roue-avant-droite"].map((r) => formeDe(trouverRole(cas.voiture, r), cas.pose)).find((f) => poseSur(point(e), f));
    assert.ok(roue, `${c.nom} : le point n'est posé sur aucune roue avant`);
    assert.ok(partCachee(point(e), rayonPoint(e), roue) <= PART_CACHEE_MAX, `${c.nom} : le point cache la roue`);
    assert.ok(distanceAuBord(point(e), roue) <= rayonPoint(e) / 2, `${c.nom} : le point en plein milieu de la roue`);
    const nom = trouverRole(cas.plan, "nom-trottoir");
    assert.deepEqual(textesDe(nom), ["Trottoir"], c.nom);
    const t = trouverTous(nom, (x) => x.balise === "text")[0].attributs;
    assert.ok(dansPolygone([Number(t.x), Number(t.y)], cas.trottoir), `${c.nom} : le mot « Trottoir » est écrit sur le trottoir`);
  }
});

// ===== sous-survirage =====

// Virage d'une vignette : centre et rayon de la trajectoire voulue, échelle, et les poses des quatre positions de la voiture.
function virageDe(vignette) {
  const tv = trouverRole(vignette, "trajectoire-voulue"), a = tv.attributs;
  const positions = [1, 2, 3, 4].map((k) => {
    const g = trouverRole(vignette, `position-${k}`);
    return { groupe: g, voiture: trouverRole(g, "voiture"), pose: poseDe(trouverRole(g, "voiture")) };
  });
  return { tv, centre: [Number(a["data-cx"]), Number(a["data-cy"])], rayon: Number(a["data-rayon"]), positions, echelle: positions[0].pose.echelle };
}
// Dans un virage à gauche (sens inverse des aiguilles d'une montre à l'écran), cap de la tangente à la trajectoire voulue au
// point de la pose : la direction du rayon moins 90 degrés.
const tangente = ({ centre }, p) => Math.atan2(p[1] - centre[1], p[0] - centre[0]) / DEG - 90;

test("sous-survirage : deux vignettes, le même virage à gauche, trajectoire voulue en pointillé, trois positions estompées puis la finale", () => {
  const d = dessin("sous-survirage");
  const virages = ["sous-virage", "survirage"].map((n) => virageDe(trouverRole(d, `vignette-${n}`)));
  for (const v of virages) {
    assert.ok(String(v.tv.attributs["stroke-dasharray"] || "").trim(), "trajectoire voulue en pointillé");
    // Les points de l'arc de la trajectoire voulue sont au rayon annoncé, sur l'axe de la voie.
    const [de, a] = [Number(v.tv.attributs["data-de"]), Number(v.tv.attributs["data-a"])];
    const surArc = pointsDe(v.tv).filter((p) => {
      const phi = Math.atan2(p[1] - v.centre[1], p[0] - v.centre[0]) / DEG;
      return ecartAngle(phi, a) * ecartAngle(phi, de) <= 0;
    });
    assert.ok(surArc.length > 10, "arc de la trajectoire voulue");
    for (const p of surArc) assert.ok(Math.abs(distance(p, v.centre) - v.rayon) < 0.05, "point de l'arc au rayon");
    // Trois positions estompées, de plus en plus visibles, puis la position finale, pleine.
    const opacites = v.positions.map((p) => Number(p.groupe.attributs.opacity ?? 1));
    assert.ok(opacites.slice(0, 3).every((o) => o > 0 && o < 1) && opacites[3] === 1, `opacités ${opacites}`);
    assert.ok(opacites[0] < opacites[1] && opacites[1] < opacites[2], "estompées de la plus ancienne à la plus récente");
    // Première position sur la trajectoire voulue, dans l'axe ; virage à gauche : le centre est à sa gauche.
    const p1 = v.positions[0].pose, c1 = [p1.x, p1.y];
    assert.ok(Math.abs(distance(c1, v.centre) - v.rayon) < 0.05 * v.echelle, "première position sur la trajectoire voulue");
    assert.ok(Math.abs(ecartAngle(p1.cap, tangente(v, c1))) < 0.5, "première position dans l'axe");
    const cap = [Math.cos(p1.cap * DEG), Math.sin(p1.cap * DEG)], versCentre = [v.centre[0] - c1[0], v.centre[1] - c1[1]];
    assert.ok(cap[0] * versCentre[1] - cap[1] * versCentre[0] < 0, "virage à gauche");
    // Les positions se suivent dans le virage (l'angle autour du centre décroît, sens du virage à gauche).
    const angles = v.positions.map(({ pose }) => Math.atan2(pose.y - v.centre[1], pose.x - v.centre[0]) / DEG);
    for (let k = 1; k < 4; k++) assert.ok(ecartAngle(angles[k], angles[k - 1]) < 0, `position ${k + 1} après la ${k}`);
  }
  // Le même virage : même rayon, même échelle, mêmes premières positions par rapport au centre.
  const [a, b] = virages;
  assert.equal(a.rayon, b.rayon);
  assert.equal(a.echelle, b.echelle);
  const relative = (v) => [v.positions[0].pose.x - v.centre[0], v.positions[0].pose.y - v.centre[1], v.positions[0].pose.cap];
  relative(a).forEach((x, i) => assert.ok(Math.abs(x - relative(b)[i]) < 1e-6, "même entrée dans le virage"));
});

test("sous-survirage : la trajectoire voulue suit l'axe de la voie de droite de la chaussée dessinée", () => {
  const d = dessin("sous-survirage");
  for (const n of ["sous-virage", "survirage"]) {
    const vignette = trouverRole(d, `vignette-${n}`), v = virageDe(vignette);
    const route = trouverRole(vignette, "route").attributs;
    const axe = Number(route["data-rayon"]), voie = Number(route["data-voie"]);
    assert.ok(Math.abs(voie / v.echelle - DESSIN.voie) < 1e-9, "voie des scènes");
    assert.deepEqual([Number(route["data-cx"]), Number(route["data-cy"])], v.centre, "même centre");
    // Virage à gauche : la voie de droite est à l'extérieur, son axe à une demi-voie au-delà de l'axe de la chaussée.
    assert.ok(Math.abs(v.rayon - (axe + voie / 2)) < 1e-9, `${n} : trajectoire voulue sur l'axe de la voie de droite`);
    // Les traits de l'axiale du virage sont sur l'axe de la chaussée (à un quart de mètre près : ce qui compte, c'est qu'ils ne
    // soient pas sur l'axe de la voie, 1,75 m plus loin).
    const [de, a] = [Number(v.tv.attributs["data-de"]), Number(v.tv.attributs["data-a"])];
    const dansArc = (p) => { const phi = Math.atan2(p[1] - v.centre[1], p[0] - v.centre[0]) / DEG; return ecartAngle(phi, a) * ecartAngle(phi, de) <= 0; };
    const traits = trouverTous(vignette, (x) => x.attributs["data-r"] === "axiale");
    assert.ok(traits.length >= 3, `${traits.length} traits d'axiale`);
    for (const trait of traits) {
      for (const p of pointsDe(trait).filter(dansArc)) assert.ok(Math.abs(distance(p, v.centre) - axe) <= 0.25 * v.echelle, "trait de l'axiale sur l'axe");
    }
  }
});

// Cap (degrés) de la trajectoire qui passe par trois positions A, B et C, au point P : la tangente du cercle qui passe par elles
// (la droite, si elles sont alignées), dans le sens de la marche, de A vers C.
function capTrajectoire(A, B, C, P) {
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  let t = [C[0] - A[0], C[1] - A[1]];
  if (Math.abs(d) > 1e-9) {
    const [a2, b2, c2] = [A, B, C].map((q) => q[0] ** 2 + q[1] ** 2);
    const O = [(a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / d, (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / d];
    const n = [-(P[1] - O[1]), P[0] - O[0]];
    t = n[0] * t[0] + n[1] * t[1] < 0 ? [-n[0], -n[1]] : n;
  }
  return Math.atan2(t[1], t[0]) / DEG;
}

test("sous-survirage : sous-virage, la voiture tire tout droit : dans l'axe de sa trajectoire, elle tourne deux fois moins que la route au plus et sort de sa voie ; roues avant braquées vers l'intérieur", () => {
  const d = dessin("sous-survirage");
  const v = virageDe(trouverRole(d, "vignette-sous-virage"));
  const P = v.positions.map(({ pose }) => [pose.x, pose.y]), caps = v.positions.map(({ pose }) => pose.cap);
  // Pas de tête-à-queue : à chaque position, la caisse est dans l'axe de sa propre trajectoire, à 10 degrés près.
  P.forEach((p, k) => {
    const [a, b, c] = k === 0 ? [0, 1, 2] : k === 3 ? [1, 2, 3] : [k - 1, k, k + 1];
    const ecart = ecartAngle(caps[k], capTrajectoire(P[a], P[b], P[c], p));
    assert.ok(Math.abs(ecart) <= 10, `position ${k + 1} : cap à ${ecart.toFixed(1)} degrés de sa trajectoire`);
  });
  // Tout droit : de la première à la dernière position, la caisse tourne au plus de la moitié de l'angle dont tourne la route.
  const polaire = (p) => Math.atan2(p[1] - v.centre[1], p[0] - v.centre[0]) / DEG;
  const route = -ecartAngle(polaire(P[3]), polaire(P[0])), caisse = Math.abs(ecartAngle(caps[3], caps[0]));
  assert.ok(route > 0 && caisse <= route / 2, `la caisse tourne de ${caisse.toFixed(1)} degrés quand la route tourne de ${route.toFixed(1)}`);
  // Sortie de sa voie : la dernière position est plus loin du centre du virage que la trajectoire voulue, d'une demi-voie au moins ;
  // l'écart croît de position en position.
  const derives = P.map((p) => (distance(p, v.centre) - v.rayon) / v.echelle);
  assert.ok(derives[3] >= DESSIN.voie / 2, `dérive finale de ${derives[3].toFixed(2)} m, moins d'une demi-voie`);
  for (let k = 1; k < 4; k++) assert.ok(derives[k] > derives[k - 1], `la voiture s'écarte de position en position : ${derives.map((x) => x.toFixed(2))}`);
  // Le train avant glisse : roues avant braquées vers l'intérieur du virage (à gauche, angle négatif), nettement.
  for (const r of ["roue-avant-gauche", "roue-avant-droite"]) {
    const angle = Number(trouverRole(v.positions[3].voiture, r).attributs["data-angle"]);
    assert.ok(angle <= -10, `${r} : ${angle} degrés`);
  }
});

// Roues avant du sous-virage : leur braquage est ce que le dessin oppose à la trajectoire ; à 7 px sur 2 (première version), il se
// lisait à peine sur un téléphone (relecture du 15/10/2026).
const ROUE_LISIBLE = { longueur: 9, largeur: 3 };   // px sur un téléphone

test("sous-survirage : les roues avant braquées de la position finale se lisent sur un téléphone", () => {
  const v = virageDe(trouverRole(dessin("sous-survirage"), "vignette-sous-virage"));
  for (const r of ["roue-avant-gauche", "roue-avant-droite"]) {
    const pneu = trouverTous(trouverRole(v.positions[3].voiture, r), (x) => x.balise === "rect")[0].attributs;
    const [long, large] = [pneu.width * PX, pneu.height * PX];
    assert.ok(long >= ROUE_LISIBLE.longueur && large >= ROUE_LISIBLE.largeur, `${r} : ${long.toFixed(1)} px sur ${large.toFixed(1)} sur un téléphone`);
  }
});

test("sous-survirage : le point de l'étiquette « Trajectoire voulue » est posé sur le pointillé, hors des voitures", () => {
  const vignette = trouverRole(dessin("sous-survirage"), "vignette-sous-virage"), v = virageDe(vignette);
  const e = trouverRole(vignette, "etiquette-trajectoire"), p = point(e);
  assert.equal(textesDe(e).join(" "), "Trajectoire voulue");
  assert.ok(projeter(p, pointsDe(v.tv)).distance < 0.05, "le point est posé sur la trajectoire voulue");
  v.positions.forEach(({ voiture, pose }, k) => {
    const caisse = caisseDe(voiture, pose);
    const ecart = dansPolygone(p, caisse) ? 0 : Math.min(...caisse.map((a, i) => distanceSegment(p, a, caisse[(i + 1) % caisse.length])));
    assert.ok(ecart >= rayonPoint(e), `le point touche la voiture de la position ${k + 1} (${ecart.toFixed(1)} unités)`);
  });
});

test("sous-survirage : survirage, la caisse tourne vers l'intérieur d'au moins 20 degrés au-delà de la tangente, l'arrière plus loin du centre que l'avant", () => {
  const d = dessin("sous-survirage");
  const v = virageDe(trouverRole(d, "vignette-survirage"));
  const finale = v.positions[3].pose, c = [finale.x, finale.y];
  // Vers l'intérieur d'un virage à gauche : cap plus à gauche (plus petit) que la tangente.
  const lacet = -ecartAngle(finale.cap, tangente(v, c));
  assert.ok(lacet >= 20, `la caisse ne tourne que de ${lacet.toFixed(1)} degrés au-delà de la tangente`);
  const demi = (GABARITS.voiture.longueur / 2) * v.echelle, u = [Math.cos(finale.cap * DEG), Math.sin(finale.cap * DEG)];
  const avant = [c[0] + demi * u[0], c[1] + demi * u[1]], arriere = [c[0] - demi * u[0], c[1] - demi * u[1]];
  assert.ok(distance(arriere, v.centre) > distance(avant, v.centre), "l'arrière chasse vers l'extérieur");
  // Le lacet croît de position en position ; le centre de la voiture reste sur la trajectoire voulue (son écart n'est pas dessiné).
  const lacets = v.positions.map(({ pose }) => -ecartAngle(pose.cap, tangente(v, [pose.x, pose.y])));
  for (let k = 1; k < 4; k++) assert.ok(lacets[k] > lacets[k - 1], `lacet ${lacets.map((x) => x.toFixed(1))}`);
  for (const { pose } of v.positions) assert.ok(Math.abs(distance([pose.x, pose.y], v.centre) - v.rayon) < 0.01, "centre sur la trajectoire voulue");
});

test("sous-survirage : titres aux mots du cours", () => {
  const d = dessin("sous-survirage");
  const titres = (n) => textesDe(trouverRole(d, `titre-${n}`)).join(" ");
  assert.equal(titres("sous-virage"), "Sous-virage : le train avant glisse");
  assert.equal(titres("survirage"), "Survirage : le train arrière glisse");
});

// ===== regard-loin (geste animé) =====
// Tout se lit dans les images que le moteur dessine (imageA, imageFigee) : la route (centre, rayon de la ligne médiane, largeur
// d'une voie, angles polaires des bouts de l'arc), la voiture (pose), le cône (sommet, direction, tracé), le repère du point de
// corde ; la géométrie attendue se recalcule ici, sans les aides du module.

const geste = () => famille.GESTES["regard-loin"].construire();
const IMAGE = 1 / 60;
const instantsDe = (def) => Array.from({ length: Math.ceil(def.duree / IMAGE) + 1 }, (_, k) => Math.min(def.duree, k * IMAGE));
// Lecture d'une image : route, pose de la voiture, œil, cône (sommet, direction, points), point de corde, trait de visée.
function lireRegard(image) {
  const r = trouverRole(image, "route").attributs, voiture = trouverRole(image, "voiture"), cone = trouverRole(image, "regard");
  const route = { centre: [Number(r["data-cx"]), Number(r["data-cy"])], rayon: Number(r["data-rayon"]), voie: Number(r["data-voie"]),
    angles: [Number(r["data-entree"]), Number(r["data-sortie"])].sort((a, b) => a - b) };
  const pose = poseDe(voiture);
  return { route, pose, oeil: reperesDessus(pose).oeil, cone: { sommet: point(cone), direction: Number(cone.attributs["data-angle"]),
    pts: pointsDe(cone), noeud: cone }, corde: point(trouverRole(image, "point-corde")), visee: trouverRole(image, "visee") };
}
const versLe = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG;
const polaireDe = (centre, p) => ((versLe(centre, p) % 360) + 360) % 360;
const surCercle = (centre, rayon, angle) => [centre[0] + rayon * Math.cos(angle * DEG), centre[1] + rayon * Math.sin(angle * DEG)];
// Virage à droite, voiture dans la voie de droite, à l'intérieur : bord intérieur de sa voie (le bord de la chaussée) une voie en
// deçà de la ligne médiane, axe de sa voie une demi-voie en deçà. Distance « au centre » d'un point : dans le secteur de l'arc, sa
// distance au centre ; sur l'approche ou la sortie (lignes droites tangentes aux bouts de l'arc), sa coordonnée le long du rayon
// du bout le plus proche. Le point est dans la voie de la voiture quand elle est entre le bord intérieur et la ligne médiane.
const dir = (a) => [Math.cos(a * DEG), Math.sin(a * DEG)], scal = (u, w) => u[0] * w[0] + u[1] * w[1];
function partie({ centre, angles: [a0, a1] }, p) {
  const v = [p[0] - centre[0], p[1] - centre[1]], phi = polaireDe(centre, p);
  if (phi >= a0 && phi <= a1) return { nom: "arc", v, phi };
  return scal(v, dir(a0 - 90)) > 0 ? { nom: "approche", v, angle: a0 } : { nom: "sortie", v, angle: a1 };
}
function auCentre(route, p) {
  const q = partie(route, p);
  return q.nom === "arc" ? Math.hypot(...q.v) : scal(q.v, dir(q.angle));
}
// Cap d'une voiture qui roule sur l'axe de sa voie, au point p : perpendiculaire au rayon dans l'arc, celui de la ligne droite
// sur l'approche et la sortie (sens horaire : le rayon plus un quart de tour).
function capTangent(route, p) {
  const q = partie(route, p);
  return (q.nom === "arc" ? q.phi : q.angle) + 90;
}
const coinsCaisse = (pose) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) =>
  metresVersCadre(pose)([(a * GABARITS.voiture.longueur) / 2, (b * GABARITS.voiture.largeur) / 2]));

test("regard-loin : le cône du regard des scènes, sommet à l'œil, 22 m de portée, 16 degrés de demi-ouverture, teinte et opacité des scènes", () => {
  const def = geste();
  assert.deepEqual([REGARD_PORTEE, REGARD_OUVERTURE], [22, 16], "le cône des scènes");
  for (const t of [0, ...def.etapes.map((e) => e.t), def.duree]) {
    const image = imageA(def, t, false), { pose, oeil, cone } = lireRegard(image), portee = REGARD_PORTEE * pose.echelle;
    assert.ok(distance(cone.sommet, oeil) < 0.01 && distance(cone.pts[0], oeil) < 0.01, `${t} s : sommet à l'œil du conducteur`);
    // Le tracé est le triangle des scènes, découpé au bord du cadre : chaque point est dans l'ouverture et à la portée.
    for (const p of cone.pts.slice(1)) {
      assert.ok(distance(p, oeil) <= portee + 0.01, `${t} s : point du cône au-delà de 22 m`);
      assert.ok(Math.abs(ecartAngle(versLe(oeil, p), cone.direction)) <= REGARD_OUVERTURE + 0.01, `${t} s : point hors de l'ouverture`);
    }
    assert.equal(cone.noeud.attributs.fill, TEINTES.regard);
    assert.equal(Number(cone.noeud.attributs.opacity), OPACITE_CONE);
    const ordre = trouverTous(image, (x) => ["regard", "voiture"].includes(x.attributs["data-r"])).map((x) => x.attributs["data-r"]);
    assert.deepEqual(ordre, ["regard", "voiture"], "le cône passe sous la voiture, comme dans les scènes");
  }
  // Au début, le cône tient dans le cadre : le triangle entier, ses deux côtés de 22 m, 32 degrés d'ouverture.
  const { pose, cone } = lireRegard(imageA(def, 0, false)), [s, p1, p2] = cone.pts;
  assert.equal(cone.pts.length, 3, "un triangle entier");
  for (const p of [p1, p2]) assert.ok(Math.abs(distance(p, s) - REGARD_PORTEE * pose.echelle) < 0.01, "côtés de 22 m");
  assert.ok(Math.abs(Math.abs(ecartAngle(versLe(s, p1), versLe(s, p2))) - 2 * REGARD_OUVERTURE) < 0.01, "ouverture de 32 degrés");
});

// Tolérance sur la place du point de corde : 0,05 m, un demi-unité du cadre à 10 unités par mètre, soit un demi-pixel sur un
// téléphone (invisible), bien en deçà de ce qu'un repère mal placé déplacerait : l'axe de la voie est à 1,75 m du bord, un degré
// d'arc fait 0,21 m sur ce bord.
const TOLERANCE_CORDE = 0.05;
test("regard-loin, étape 1 : en entrée de virage, l'axe du regard part de l'œil et vise le point de corde, au bord intérieur de la voie, au sommet du virage", () => {
  const def = geste(), image = imageFigee(def, 0);
  const { route, pose, oeil, cone, corde, visee } = lireRegard(image), E = pose.echelle;
  assert.ok(Math.abs(route.voie / E - DESSIN.voie) < 1e-9, "voie des scènes");
  assert.deepEqual(route.angles, [180, 270], "virage d'un quart de tour, à droite : l'approche monte, la sortie va vers la droite");
  // Le point de corde : sur le bord intérieur de la voie de la voiture (le bord de la chaussée), au milieu de l'arc.
  const bord = route.rayon - route.voie, sommet = (route.angles[0] + route.angles[1]) / 2;
  const attendu = surCercle(route.centre, bord, sommet);
  assert.ok(distance(corde, attendu) <= TOLERANCE_CORDE * E,
    `point de corde à ${(distance(corde, attendu) / E).toFixed(3)} m du bord intérieur au sommet du virage`);
  // L'axe du cône passe par l'œil et par le point de corde, que le cône atteint (sinon l'axe serait prolongé jusqu'à lui).
  assert.ok(Math.abs(ecartAngle(cone.direction, versLe(oeil, corde))) < 0.01, "l'axe du regard vise le point de corde");
  const axe = REGARD_PORTEE * Math.cos(REGARD_OUVERTURE * DEG) * E;
  assert.ok(distance(oeil, corde) <= axe, "le cône atteint le point de corde");
  assert.ok(distance(oeil, corde) >= 10 * E, `point de corde à ${(distance(oeil, corde) / E).toFixed(1)} m de l'œil : loin devant`);
  // Le trait de visée va de l'œil au point de corde.
  const traitVisee = pointsDe(visee);
  assert.equal(Number(visee.attributs.opacity), 1, "trait de visée affiché");
  assert.ok(distance(traitVisee[0], oeil) < 0.01 && distance(traitVisee[traitVisee.length - 1], corde) < 0.01, "trait de l'œil à la corde");
  // La voiture, en entrée de virage : sur l'approche, son avant au plus à une longueur de voiture du début de l'arc, cap vers le haut.
  const debut = surCercle(route.centre, route.rayon - route.voie / 2, route.angles[0]);
  const avant = metresVersCadre(pose)([GABARITS.voiture.longueur / 2, 0]);
  assert.ok(avant[1] > debut[1] && avant[1] - debut[1] <= GABARITS.voiture.longueur * E, "avant de la voiture juste avant le virage");
  assert.ok(Math.abs(ecartAngle(pose.cap, -90)) < 1e-6, "cap vers le haut");
  // L'étiquette du repère.
  assert.equal(textesDe(trouverRole(image, "etiquette-corde")).join(" "), "Point de corde");
});

test("regard-loin, étape 2 : la voiture au sommet du virage, à la corde ; le regard porte déjà vers la sortie, l'axe de sa voie à la fin de l'arc", () => {
  const def = geste(), { route, pose, oeil, cone, visee } = lireRegard(imageFigee(def, 1)), E = pose.echelle;
  const rVoie = route.rayon - route.voie / 2, sommet = (route.angles[0] + route.angles[1]) / 2;
  const c = [pose.x, pose.y];
  assert.ok(Math.abs(distance(c, route.centre) - rVoie) < 0.01, "voiture sur l'axe de sa voie");
  assert.ok(Math.abs(polaireDe(route.centre, c) - sommet) < 0.5, `voiture à ${polaireDe(route.centre, c).toFixed(2)} degrés, au sommet (${sommet})`);
  const sortie = surCercle(route.centre, rVoie, route.angles[1]);
  assert.ok(Math.abs(ecartAngle(cone.direction, versLe(oeil, sortie))) < 0.01, "l'axe du regard vise la sortie, dans la voie");
  assert.ok(distance(oeil, sortie) <= REGARD_PORTEE * Math.cos(REGARD_OUVERTURE * DEG) * E, "le cône atteint la sortie");
  assert.ok(Number(visee.attributs.opacity) < 1e-9, "trait de visée effacé (il passerait sur la flèche de la voiture)");
});

test("regard-loin, étape 3 : en sortie, la voiture a quitté l'arc, et le regard porte droit devant, jusqu'à la fin", () => {
  const def = geste(), debut = def.etapes[2].t;
  for (const t of instantsDe(def).filter((x) => x >= debut)) {
    const { route, pose, cone } = lireRegard(imageA(def, t, false));
    const fin = surCercle(route.centre, route.rayon - route.voie / 2, route.angles[1]);
    const arriere = metresVersCadre(pose)([-GABARITS.voiture.longueur / 2, 0]);
    assert.ok(Math.abs(ecartAngle(pose.cap, route.angles[1] + 90)) < 1e-6, `${t.toFixed(3)} s : cap de la sortie`);
    assert.ok(arriere[0] >= fin[0] - 0.01, `${t.toFixed(3)} s : l'arrière de la voiture encore dans l'arc`);
    assert.ok(Math.abs(ecartAngle(cone.direction, pose.cap)) < 0.01, `${t.toFixed(3)} s : regard à ${ecartAngle(cone.direction, pose.cap).toFixed(3)} degrés du cap`);
  }
});

test("regard-loin : la voiture reste dans sa voie, à droite, sur l'axe de sa voie, à chaque image du geste", () => {
  const def = geste();
  for (const t of instantsDe(def)) {
    const { route, pose } = lireRegard(imageA(def, t, false)), E = pose.echelle;
    const bord = route.rayon - route.voie, mediane = route.rayon;
    for (const p of coinsCaisse(pose)) {
      const d = auCentre(route, p);
      assert.ok(d > bord && d < mediane, `${t.toFixed(3)} s : coin de la caisse à ${((d - bord) / E).toFixed(2)} m du bord intérieur (voie de ${route.voie / E} m)`);
    }
    assert.ok(Math.abs(auCentre(route, [pose.x, pose.y]) - (route.rayon - route.voie / 2)) < 0.01, `${t.toFixed(3)} s : centre hors de l'axe de la voie`);
    const tangente = capTangent(route, [pose.x, pose.y]);
    assert.ok(Math.abs(ecartAngle(pose.cap, tangente)) < 1e-6, `${t.toFixed(3)} s : cap ${pose.cap} au lieu de ${tangente}`);
  }
});

// Continuité propre au regard, au-delà des contrôles communs (état, points dessinés) : d'une image (1/60 s) à la suivante, la
// direction du regard tourne de 1 degré au plus (60 degrés par seconde ; mesuré : 0,69, quand il passe de la sortie au lointain),
// le cap de la voiture de 0,5 degré au plus (30 degrés par seconde : à allure constante dans le virage, 6,4 m/s sur 13,75 m de
// rayon, il tourne de 26,7 degrés par seconde, 0,44 par image).
const ROTATION_REGARD_MAX = 1, ROTATION_CAP_MAX = 0.5;
test("regard-loin : le regard et la voiture tournent sans saut, d'une image à la suivante", () => {
  const def = geste();
  let avant = null;
  for (const t of instantsDe(def)) {
    const { pose, cone } = lireRegard(imageA(def, t, false));
    if (avant) {
      const dRegard = Math.abs(ecartAngle(cone.direction, avant.direction)), dCap = Math.abs(ecartAngle(pose.cap, avant.cap));
      assert.ok(dRegard <= ROTATION_REGARD_MAX, `${t.toFixed(3)} s : le regard tourne de ${dRegard.toFixed(2)} degrés en une image`);
      assert.ok(dCap <= ROTATION_CAP_MAX, `${t.toFixed(3)} s : la voiture tourne de ${dCap.toFixed(2)} degrés en une image`);
    }
    avant = { direction: cone.direction, cap: pose.cap };
  }
});

test("regard-loin : chaque étape dure au moins 1 s, et son image figée montre la flèche de la voiture, devant elle, dans sa voie", () => {
  const def = geste();
  def.etapes.forEach((e, i) => {
    const fin = i + 1 < def.etapes.length ? def.etapes[i + 1].t : def.duree;
    assert.ok(fin - e.t >= 1, `étape ${i + 1} : ${(fin - e.t).toFixed(2)} s`);
    const image = imageFigee(def, i), { route, pose } = lireRegard(image);
    const visibles = trouverTous(image, (x) => /^fleche-\d$/.test(x.attributs["data-r"] || "") && x.attributs.display !== "none");
    assert.deepEqual(visibles.map((x) => x.attributs["data-r"]), [`fleche-${i + 1}`]);
    const trait = pointsDe(trouverRole(visibles[0], "fleche-trait"));
    assert.ok(cadreVersMetres(pose)(trait[0])[0] > GABARITS.voiture.longueur / 2, "la flèche part devant la voiture");
    assert.ok(Math.abs(auCentre(route, trait[0]) - (route.rayon - route.voie / 2)) < 0.01, "la flèche part de l'axe de la voie");
    for (const p of trait) {
      const d = auCentre(route, p);
      assert.ok(d > route.rayon - route.voie && d < route.rayon, "la flèche reste dans la voie de la voiture");
    }
  });
});

// Style schématique (décision du formateur du 15/10/2026, essai sur C1.3) : la voiture est la silhouette du kit ; à cette
// échelle (10 unités par mètre), la voiture détaillée dessinerait ses vitres latérales, ses phares et ses feux.
test("regard-loin : la voiture en silhouette (style schématique) : la caisse, le pare-brise et la lunette, sans toit, vitres latérales, phares ni feux", () => {
  const voiture = trouverRole(imageFigee(geste(), 0), "voiture");
  for (const role of ["toit", "vitre-avant-gauche", "vitre-arriere-droite", "phare-gauche", "feu-droit", "reflet-pare-brise"]) {
    assert.equal(trouverRole(voiture, role), null, `${role} dans la silhouette`);
  }
  for (const role of ["caisse", "pare-brise", "lunette"]) assert.ok(trouverRole(voiture, role), role);
});
