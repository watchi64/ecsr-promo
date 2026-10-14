import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-dessus.js";
import { SOURCES } from "../sources/dessins-dessus.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { VOITURE, reperesDessus } from "../js/dessins-kit.js";
import { GABARITS } from "../js/scene-geometrie.js";
import { TEINTES } from "../js/scene-rendu.js";
import { REGARD_PORTEE, REGARD_OUVERTURE } from "../js/scene-regard.js";
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
// Un point d'étiquette cache au plus le quart de ce qu'il désigne (décision commune 3 du lot : le détail se reconnaît sur un
// téléphone et le point ne le recouvre pas). Posé au milieu d'un phare, d'un feu ou d'une roue braquée, il en cacherait de 27 à
// 31 % (mesures du 15/10/2026).
const PART_CACHEE_MAX = 0.25;

// ===== Recopie des valeurs des scènes =====

test("dessus : les valeurs reprises des scènes sont celles des scènes (voie, axiale, regard, teintes)", () => {
  const r = famille.RECOPIE_SCENES;
  assert.equal(r.voie, DESSIN.voie);
  assert.deepEqual(r.axiale, { trait: IISR.axialeAgglo.trait, vide: IISR.axialeAgglo.vide, largeur: 2 * IISR.u });
  assert.equal(r.jeuStationnement, DESSIN.jeuStationnement);
  assert.equal(r.regard.portee, REGARD_PORTEE);
  assert.equal(r.regard.ouverture, REGARD_OUVERTURE);
  const source = readFileSync(new URL("../js/scene-moteur.js", import.meta.url), "utf8");
  const opacite = source.match(/const OPACITE_CONE = ([\d.]+);/);
  assert.ok(opacite, "js/scene-moteur.js a changé : revoir la recopie de l'opacité du cône");
  assert.equal(r.regard.opacite, Number(opacite[1]));
  // Les scènes dessinent bien ce cône dans cette teinte, à cette opacité.
  assert.match(source, /fill: TEINTES\.regard, opacity: OPACITE_REGARD\.cone/);
});

// ===== tour-vehicule =====

test("tour-vehicule : le tour extérieur entoure la caisse, coins et rétroviseurs compris, à distance d'elle", () => {
  const d = dessin("tour-vehicule");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const tour = pointsDe(trouverRole(d, "parcours-exterieur"));
  const c = trouverRole(voiture, "caisse").attributs;
  const coins = [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]].map(localVersCadre(pose));
  for (const coin of coins) assert.ok(dansPolygone(coin, tour), `coin de la caisse hors du tour : ${coin}`);
  for (const r of ["retroviseur-gauche", "retroviseur-droit"]) assert.ok(dansPolygone(point(trouverRole(voiture, r)), tour), r);
  // On tourne autour de la voiture sans la frôler : chaque point du tour à 0,5 m au moins du rectangle de la caisse.
  const demi = [GABARITS.voiture.longueur / 2, GABARITS.voiture.largeur / 2];
  for (const p of tour) {
    const [mx, my] = cadreVersMetres(pose)(p);
    const ecart = Math.hypot(Math.max(Math.abs(mx) - demi[0], 0), Math.max(Math.abs(my) - demi[1], 0));
    assert.ok(ecart >= 0.5, `point du tour à ${ecart.toFixed(2)} m de la caisse`);
  }
});

test("tour-vehicule : les repères 1, 2 et 3 se suivent dans l'ordre du parcours : extérieur, puis capot, puis habitacle", () => {
  const d = dessin("tour-vehicule");
  const pose = poseDe(trouverRole(d, "voiture"));
  const exterieur = pointsDe(trouverRole(d, "parcours-exterieur")), habitacle = pointsDe(trouverRole(d, "parcours-habitacle"));
  assert.ok(distance(exterieur[exterieur.length - 1], habitacle[0]) < 1e-6, "le parcours est d'un seul tenant");
  const parcours = [...exterieur, ...habitacle.slice(1)];
  const reperes = [1, 2, 3].map((k) => {
    const g = trouverRole(d, `repere-${k}`);
    assert.equal(textesDe(g).join(""), String(k), `numéro du repère ${k}`);
    return point(g);
  });
  const abscisses = reperes.map((p, i) => {
    const pr = projeter(p, parcours);
    assert.ok(pr.distance < 0.01, `repère ${i + 1} hors du parcours`);
    return pr.s;
  });
  assert.ok(abscisses[0] < abscisses[1] && abscisses[1] < abscisses[2], `ordre du parcours : ${abscisses.map((s) => s.toFixed(1))}`);
  // 1 au départ du tour extérieur ; 2 à son bout, devant le capot (en avant du nez, dans l'axe) ; 3 au bout du parcours, à la
  // place du conducteur (l'œil du conducteur de la voiture du kit, à gauche).
  assert.ok(abscisses[0] < 0.01, "repère 1 au départ");
  assert.ok(Math.abs(abscisses[1] - longueur(exterieur)) < 0.01, "repère 2 au bout du tour extérieur");
  assert.ok(Math.abs(abscisses[2] - longueur(parcours)) < 0.01, "repère 3 au bout du parcours");
  const [m2x, m2y] = cadreVersMetres(pose)(reperes[1]);
  assert.ok(m2x > GABARITS.voiture.longueur / 2 && Math.abs(m2y) < 0.45, `repère 2 devant le capot : ${m2x}, ${m2y}`);
  assert.ok(distance(reperes[2], reperesDessus(pose).oeil) < 0.01, "repère 3 à la place du conducteur");
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
  const parcours = [...pointsDe(trouverRole(d, "parcours-exterieur")), ...pointsDe(trouverRole(d, "parcours-habitacle")).slice(1)];
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
});

// ===== roues-trottoir =====

test("roues-trottoir : voiture garée le long du trottoir de droite, roues avant braquées vers lui, roues arrière droites", () => {
  const d = dessin("roues-trottoir");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const trottoir = pointsDe(trouverRole(d, "trottoir")).map(cadreVersMetres(pose));
  const ys = trottoir.map((p) => p[1]);
  // Le trottoir est tout entier d'un côté de la voiture ; ici, à sa droite (y positif dans le repère de la voiture).
  const cote = Math.sign(Math.min(...ys));
  assert.equal(cote, Math.sign(Math.max(...ys)), "trottoir d'un seul côté");
  assert.equal(cote, 1, "trottoir de droite");
  // Le long du trottoir : flanc droit parallèle à la bordure, à moins de 0,5 m, sans la toucher.
  const bordure = trottoir.filter((p) => Math.abs(p[1] - Math.min(...ys)) < 1e-6);
  assert.ok(bordure.length >= 2 && Math.max(...bordure.map((p) => p[0])) - Math.min(...bordure.map((p) => p[0])) > GABARITS.voiture.longueur, "bordure parallèle à la voiture, plus longue qu'elle");
  const jeu = Math.min(...ys) - GABARITS.voiture.largeur / 2;
  assert.ok(jeu > 0 && jeu <= 0.5, `jeu de ${jeu.toFixed(2)} m`);
  for (const r of ["roue-avant-gauche", "roue-avant-droite"]) {
    const angle = Number(trouverRole(voiture, r).attributs["data-angle"]);
    assert.equal(Math.sign(angle), cote, `${r} : braquée vers le trottoir (angle ${angle})`);
    assert.ok(Math.abs(angle) >= 15, `${r} : braquage visible (${angle} degrés)`);
  }
  for (const r of ["roue-arriere-gauche", "roue-arriere-droite"]) assert.equal(Number(trouverRole(voiture, r).attributs["data-angle"]), 0, r);
});

test("roues-trottoir : la vignette de profil montre la pente, la voiture tournée vers le bas, une flèche qui descend", () => {
  const d = dessin("roues-trottoir");
  const vignette = trouverRole(d, "vignette-pente");
  const pente = trouverRole(vignette, "pente"), a = Number(pente.attributs["data-angle"]);
  assert.ok(a >= 3 && a <= 20, `pente de ${a} degrés`);
  const t = transformDe(pente);
  assert.equal(t.angle, a, "la voiture de profil tourne de la pente");
  // Le sol suit la pente ; il descend vers la droite (y croît avec x dans le cadre). Son tracé commence par sa surface, de
  // gauche à droite.
  const [s0, s1] = pointsDe(trouverRole(vignette, "sol"));
  assert.ok(Math.abs(Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) / DEG - a) < 0.01, "sol incliné de la pente");
  // La voiture de profil, avant à droite comme sur la vue du dessus, a l'avant plus bas que l'arrière : garée tournée vers le bas.
  const profil = trouverRole(pente, "voiture-profil");
  const [av, ar] = ["roue-avant", "roue-arriere"].map((r) => tourner(point(trouverRole(profil, r)), [t.rx, t.ry], t.angle));
  assert.ok(av[0] > ar[0] && av[1] > ar[1], "avant à droite et plus bas que l'arrière");
  assert.equal(Number(trouverRole(d, "voiture").attributs["data-angle"]), 0, "vue du dessus : avant à droite aussi");
  // Chaque roue de profil touche le sol.
  const rayon = (r) => Number(trouverTous(trouverRole(profil, r), (x) => x.attributs["data-r"] === "pneu")[0].attributs.r);
  for (const [r, centre] of [["roue-avant", av], ["roue-arriere", ar]]) {
    const pied = [centre[0] - rayon(r) * Math.sin(a * DEG), centre[1] + rayon(r) * Math.cos(a * DEG)];
    assert.ok(distanceSegment(pied, s0, s1) < 0.05, `${r} posée sur le sol`);
  }
  // Une flèche le long de la pente, vers le bas, et les mots du cours.
  const f = trouverRole(vignette, "fleche-pente");
  const depart = pointsDe(trouverRole(f, "fleche-trait"))[0], pointe = pointsDe(trouverRole(f, "fleche-tete"))[0];
  assert.ok(pointe[1] > depart[1] && pointe[0] > depart[0], "la flèche descend la pente");
  assert.ok(Math.abs(Math.atan2(pointe[1] - depart[1], pointe[0] - depart[0]) / DEG - a) < 1, "la flèche suit la pente");
  assert.ok(textesDe(vignette).includes("En pente"));
});

test("roues-trottoir : étiquettes aux mots du cours ; le point désigne la roue avant côté trottoir sans la cacher", () => {
  const d = dessin("roues-trottoir");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const e = trouverRole(d, "etiquette-roues");
  assert.equal(textesDe(e).join(" "), "Roues avant braquées vers le trottoir");
  const roue = formeDe(trouverRole(voiture, "roue-avant-droite"), pose);
  assert.ok(poseSur(point(e), roue), "le point est sur la roue avant droite");
  assert.ok(partCachee(point(e), rayonPoint(e), roue) <= PART_CACHEE_MAX, "le point ne cache pas la roue");
  assert.ok(distanceAuBord(point(e), roue) <= rayonPoint(e) / 2, "le point mord sur le bord de la roue, pas en son milieu");
  const nom = trouverRole(d, "nom-trottoir");
  assert.equal(textesDe(nom).join(" "), "Trottoir");
  const t = trouverTous(nom, (x) => x.balise === "text")[0].attributs;
  assert.ok(dansPolygone([Number(t.x), Number(t.y)], pointsDe(trouverRole(d, "trottoir"))), "le mot « Trottoir » est écrit sur le trottoir");
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

test("sous-survirage : sous-virage, la voiture élargit d'au moins une demi-voie, cap à 10 degrés au plus de la tangente, roues avant braquées vers l'intérieur", () => {
  const d = dessin("sous-survirage");
  const v = virageDe(trouverRole(d, "vignette-sous-virage"));
  const derives = v.positions.map(({ pose }) => (distance([pose.x, pose.y], v.centre) - v.rayon) / v.echelle);
  const finale = v.positions[3].pose, c = [finale.x, finale.y];
  assert.ok(derives[3] >= DESSIN.voie / 2, `dérive finale de ${derives[3].toFixed(2)} m, moins d'une demi-voie`);
  for (let k = 1; k < 4; k++) assert.ok(derives[k] > derives[k - 1], "la voiture élargit de position en position");
  const ecart = ecartAngle(finale.cap, tangente(v, c));
  assert.ok(Math.abs(ecart) <= 10, `cap à ${ecart.toFixed(1)} degrés de la tangente`);
  // Le train avant glisse : roues avant braquées vers l'intérieur du virage (à gauche, angle négatif), nettement.
  for (const r of ["roue-avant-gauche", "roue-avant-droite"]) {
    const angle = Number(trouverRole(v.positions[3].voiture, r).attributs["data-angle"]);
    assert.ok(angle <= -10, `${r} : ${angle} degrés`);
  }
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

// ===== regard-loin =====

function regardDe() {
  const d = dessin("regard-loin");
  const voiture = trouverRole(d, "voiture"), pose = poseDe(voiture);
  const cone = trouverRole(d, "regard"), pts = pointsDe(cone);
  const route = trouverRole(d, "route").attributs;
  return { d, pose, cone, pts, centre: [Number(route["data-cx"]), Number(route["data-cy"])], axe: Number(route["data-rayon"]),
    voie: Number(route["data-voie"]) };
}

test("regard-loin : le cône du regard des scènes, sommet à l'œil, 22 m de portée, 16 degrés de demi-ouverture, teinte et opacité des scènes", () => {
  const { d, pose, cone, pts } = regardDe();
  assert.equal(pts.length, 3, "un triangle");
  const [sommet, p1, p2] = pts;
  const oeil = reperesDessus(pose).oeil;
  assert.ok(distance(sommet, oeil) < 0.01, "sommet à l'œil du conducteur");
  for (const p of [p1, p2]) assert.ok(Math.abs(distance(p, sommet) - 22 * pose.echelle) < 0.01, "côtés de 22 m");
  const ouverture = Math.abs(ecartAngle(Math.atan2(p1[1] - sommet[1], p1[0] - sommet[0]) / DEG, Math.atan2(p2[1] - sommet[1], p2[0] - sommet[0]) / DEG));
  assert.ok(Math.abs(ouverture - 2 * 16) < 0.01, `ouverture de ${ouverture} degrés`);
  assert.equal(cone.attributs.fill, TEINTES.regard);
  assert.equal(Number(cone.attributs.opacity), 0.4);
  // Le cône passe sous la voiture, comme dans les scènes.
  const ordre = trouverTous(d, (x) => ["regard", "voiture"].includes(x.attributs["data-r"])).map((x) => x.attributs["data-r"]);
  assert.deepEqual(ordre, ["regard", "voiture"]);
});

test("regard-loin : l'axe du cône vise l'axe de la voie de la voiture, au moins 20 m plus loin le long du virage", () => {
  const { d, pose, pts, centre, axe, voie } = regardDe();
  const E = pose.echelle;
  assert.ok(Math.abs(voie / E - DESSIN.voie) < 1e-9, "voie des scènes");
  // Virage à gauche, voiture dans la voie de droite, à l'extérieur : axe de la voie une demi-voie au-delà de l'axe de la chaussée.
  const rVoie = axe + voie / 2;
  const c = [pose.x, pose.y];
  assert.ok(Math.abs(distance(c, centre) - rVoie) < 0.01, "voiture sur l'axe de sa voie");
  const cap = [Math.cos(pose.cap * DEG), Math.sin(pose.cap * DEG)], versCentre = [centre[0] - c[0], centre[1] - c[1]];
  assert.ok(cap[0] * versCentre[1] - cap[1] * versCentre[0] < 0, "virage à gauche : le centre à gauche de la voiture");
  assert.ok(Math.abs(ecartAngle(pose.cap, Math.atan2(c[1] - centre[1], c[0] - centre[0]) / DEG - 90)) < 0.01, "voiture dans l'axe de sa voie");
  // Point visé : sur l'axe du cône, au milieu de son bord lointain.
  const [, p1, p2] = pts, vise = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  assert.ok(Math.abs(distance(vise, centre) - rVoie) <= (DESSIN.voie / 4) * E, "point visé sur l'axe de la voie, à un quart de voie près");
  const angle = (p) => Math.atan2(p[1] - centre[1], p[0] - centre[0]);
  let balaye = angle(c) - angle(vise);
  if (balaye < 0) balaye += 2 * Math.PI;
  assert.ok(rVoie * balaye >= 20 * E, `point visé à ${((rVoie * balaye) / E).toFixed(1)} m le long de la voie`);
  // Le repère du point visé est là, et son étiquette dit où l'on veut aller.
  assert.ok(distance(point(trouverRole(d, "point-vise")), vise) < 0.01, "repère du point visé");
  assert.equal(textesDe(trouverRole(d, "etiquette-point-vise")).join(" "), "Là où l'on veut aller");
});

test("regard-loin : la marque du point visé se lit sur un téléphone et le point de son étiquette n'en cache qu'une petite part", () => {
  const { d } = regardDe();
  const marque = trouverRole(d, "point-vise"), e = trouverRole(d, "etiquette-point-vise");
  const rayon = Math.max(...trouverTous(marque, (x) => x.balise === "circle").map((c) => Number(c.attributs.r)));
  assert.ok(rayon * (343 / 320) >= 7, `marque de ${(rayon * (343 / 320)).toFixed(1)} px de rayon sur un téléphone, moins de 7`);
  // Le point de l'étiquette est posé sur le cercle de la marque et n'en couvre qu'un arc court.
  const centre = point(marque), p = point(e);
  assert.ok(Math.abs(distance(p, centre) - rayon) < 0.01, "point posé sur le cercle de la marque");
  const cercleMarque = { polygones: [], segments: Array.from({ length: 360 }, (_, k) => ({
    a: [centre[0] + rayon * Math.cos(k * DEG), centre[1] + rayon * Math.sin(k * DEG)],
    b: [centre[0] + rayon * Math.cos((k + 1) * DEG), centre[1] + rayon * Math.sin((k + 1) * DEG)], demi: 0.5 })) };
  assert.ok(partCachee(p, rayonPoint(e), cercleMarque) <= PART_CACHEE_MAX, "le point ne cache pas la marque");
});
