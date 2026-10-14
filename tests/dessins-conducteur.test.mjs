import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-conducteur.js";
import { SOURCES } from "../sources/dessins-conducteur.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { imageA, PAS_IMAGE } from "../js/geste-regles.js";

const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "conducteur");

test("conducteur : chaque code du catalogue est dessiné et passe les contrôles communs", () => {
  for (const code of codes) {
    const e = CATALOGUE[code];
    if (e.bloc === "dessin") assert.deepEqual(verifierDessin(famille.DESSINS[code](), e.cadre), [], code);
    else assert.deepEqual(verifierGeste(famille.GESTES[code].construire(), e), [], code);
  }
  const fournis = [...Object.keys(famille.DESSINS), ...Object.keys(famille.GESTES || {})].sort();
  assert.deepEqual(fournis, [...codes].sort());
});

test("conducteur : chaque dessin a ses sources, dont ses choix de dessin", () => {
  for (const code of codes) {
    assert.ok(Array.isArray(SOURCES[code]) && SOURCES[code].length >= 2, code);
    assert.ok(SOURCES[code].some((s) => s.startsWith("Choix de dessin")), code);
  }
});

// ===== Lecture des repères et des tracés =====

const { CM } = famille;
const TIRET_CADRATIN = String.fromCharCode(0x2014);

/** Le point [x, y] d'un rôle (data-x, data-y), en unités du cadre ; le rôle doit exister. */
function point(noeud, role) {
  const r = trouverRole(noeud, role);
  assert.ok(r, `rôle « ${role} » absent`);
  const p = [Number(r.attributs["data-x"]), Number(r.attributs["data-y"])];
  assert.ok(p.every(Number.isFinite), `rôle « ${role} » : point non numérique`);
  return p;
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Segment [p, q] porté par un rôle (data-x1, data-y1, data-x2, data-y2). */
function segment(noeud, role) {
  const r = trouverRole(noeud, role);
  assert.ok(r, `rôle « ${role} » absent`);
  const v = ["data-x1", "data-y1", "data-x2", "data-y2"].map((k) => Number(r.attributs[k]));
  assert.ok(v.every(Number.isFinite), `rôle « ${role} » : segment non numérique`);
  return [[v[0], v[1]], [v[2], v[3]]];
}
/** Distance signée de p à la droite (a, b) : son signe dit de quel côté de la droite est p (produit vectoriel). */
function distanceDroite(p, [a, b]) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  return ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.hypot(dx, dy);
}
/** Points d'un attribut « x,y x,y ... » (data-points, points d'un polygone). */
function points(texte) {
  return String(texte).trim().split(/\s+/).map((c) => c.split(",").map(Number));
}
function pointsRole(noeud, role, attribut = "data-points") {
  const r = trouverRole(noeud, role);
  assert.ok(r, `rôle « ${role} » absent`);
  const p = points(r.attributs[attribut]);
  assert.ok(p.length >= 2 && p.every((q) => q.length === 2 && q.every(Number.isFinite)), `rôle « ${role} » : ${attribut} illisible`);
  return p;
}
/** Points d'un tracé « d » fait de M, L, C, Q et Z absolus, courbes échantillonnées : de quoi lire un contour dessiné sans
 *  passer par les repères du module. */
function contour(d) {
  const jetons = String(d).match(/[MLCQZ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g);
  const sortie = [];
  let i = 0, courant = null, commande = null;
  const lire = () => Number(jetons[i++]);
  while (i < jetons.length) {
    if (/[MLCQZ]/.test(jetons[i])) commande = jetons[i++];
    if (commande === "Z") continue;
    if (commande === "M" || commande === "L") { courant = [lire(), lire()]; sortie.push(courant); }
    else if (commande === "Q") {
      const c = [lire(), lire()], f = [lire(), lire()];
      for (let k = 1; k <= 16; k++) {
        const t = k / 16, u = 1 - t;
        sortie.push([0, 1].map((j) => u * u * courant[j] + 2 * u * t * c[j] + t * t * f[j]));
      }
      courant = f;
    } else if (commande === "C") {
      const c1 = [lire(), lire()], c2 = [lire(), lire()], f = [lire(), lire()];
      for (let k = 1; k <= 24; k++) {
        const t = k / 24, u = 1 - t;
        sortie.push([0, 1].map((j) => u * u * u * courant[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * f[j]));
      }
      courant = f;
    } else throw new Error(`commande de tracé inattendue : ${commande}`);
  }
  return sortie;
}
const hautDuContour = (noeud, role) => {
  const r = trouverRole(noeud, role);
  assert.ok(r, `rôle « ${role} » absent`);
  return Math.min(...contour(r.attributs.d).map((p) => p[1]));
};
/** Intersection de deux segments, ou null. */
function croisement([a, b], [c, d]) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}
function croisementsPolyligne(polyligne, seg) {
  const r = [];
  for (let i = 1; i < polyligne.length; i++) {
    const p = croisement([polyligne[i - 1], polyligne[i]], seg);
    if (p) r.push(p);
  }
  return r;
}
const vignettes = (d) => [trouverRole(d, "vignette-juste"), trouverRole(d, "vignette-faux")];

// Écart entre le dos et le dossier : distance du repère « dos » à la face avant du dossier (segment du rôle
// « siege-dossier ») ; le repère « dossier » est le pied de cette perpendiculaire. Les repères s'écrivent au millième
// d'unité : un écart « nul » se lit à ce millième près (NUL, un centième d'unité, moins d'un dixième de millimètre).
const NUL = 0.01;
function ecartDos(v) {
  const dos = point(v, "dos"), face = segment(v, "siege-dossier");
  const ecart = Math.abs(distanceDroite(dos, face));
  assert.ok(Math.abs(distance(dos, point(v, "dossier")) - ecart) < NUL, "le repère « dossier » est le pied de la perpendiculaire");
  return ecart;
}
// Écart entre l'arrière de la tête et la face avant de l'appuie-tête, compté positif quand la tête est devant la face.
function ecartTete(v) {
  const face = segment(v, "appuie-tete");
  const tete = point(v, "arriereTete");
  // Le conducteur regarde vers la gauche du dessin : l'avant est du côté des x décroissants. La face va du bas vers le
  // haut ; la tête est devant elle quand elle est à sa gauche.
  const d = distanceDroite(tete, face);
  const devant = distanceDroite([face[0][0] - 10, face[0][1]], face);
  return Math.sign(devant) === Math.sign(d) ? Math.abs(d) : -Math.abs(d);
}

// ===== Dessins fixes =====

test("siege : juste, 25 cm (à 1 cm près) du sternum au centre du volant, dos contre le dossier ; faux, siège plus reculé et dos décollé d'au moins 5 cm", () => {
  const [juste, faux] = vignettes(famille.DESSINS.siege());
  assert.ok(juste && faux, "deux vignettes, juste et faux");
  const d = distance(point(juste, "sternum"), point(juste, "centreVolant"));
  assert.ok(Math.abs(d - 25 * CM) <= 1 * CM, `sternum à ${(d / CM).toFixed(2)} cm du centre du volant`);
  assert.ok(ecartDos(juste) < NUL, `juste : dos à ${(ecartDos(juste) / CM).toFixed(3)} cm du dossier`);
  assert.ok(ecartDos(faux) >= 5 * CM, `faux : dos à ${(ecartDos(faux) / CM).toFixed(2)} cm du dossier seulement`);
  // Les 25 cm s'obtiennent en reculant le siège : le siège du faux est plus reculé encore, et son conducteur s'est décollé
  // du dossier pour atteindre le volant.
  const recul = (v) => Number(trouverRole(v, "siege").attributs["data-recul"]);
  assert.ok(recul(faux) > recul(juste), "faux : siège plus reculé que le juste");
  assert.equal(Number(trouverRole(faux, "siege").attributs["data-dossier"]), Number(trouverRole(juste, "siege").attributs["data-dossier"]),
    "même inclinaison du dossier dans les deux vignettes : seul le dos change");
});

test("appuie-tete : juste, haut au sommet du crâne (1 cm près), à 4 cm au plus de la tête ; faux, haut à la nuque, 10 cm au moins sous le sommet", () => {
  const [juste, faux] = vignettes(famille.DESSINS["appuie-tete"]());
  for (const v of [juste, faux]) {
    // Les repères sont ceux des contours dessinés : le haut du crâne et le haut du coussin, lus dans leurs tracés.
    assert.ok(Math.abs(point(v, "sommetCrane")[1] - hautDuContour(v, "tete")) < 0.05, "sommet du crâne = haut du contour de la tête");
    assert.ok(Math.abs(point(v, "hautAppuieTete")[1] - hautDuContour(v, "appuie-tete-coussin")) < 0.05, "haut de l'appuie-tête = haut de son coussin");
  }
  const ecartHaut = point(juste, "hautAppuieTete")[1] - point(juste, "sommetCrane")[1];
  assert.ok(Math.abs(ecartHaut) <= 1 * CM, `juste : haut de l'appuie-tête à ${(ecartHaut / CM).toFixed(2)} cm du sommet du crâne`);
  const ecart = ecartTete(juste);
  assert.ok(ecart >= 0 && ecart <= 4 * CM, `juste : ${(ecart / CM).toFixed(2)} cm entre la tête et l'appuie-tête`);
  const sousSommet = point(faux, "hautAppuieTete")[1] - point(faux, "sommetCrane")[1];
  assert.ok(sousSommet >= 10 * CM, `faux : haut de l'appuie-tête ${(sousSommet / CM).toFixed(2)} cm sous le sommet seulement`);
  assert.ok(Math.abs(point(faux, "hautAppuieTete")[1] - point(faux, "nuque")[1]) <= 1 * CM, "faux : haut au niveau de la nuque");
  assert.ok(ecartTete(faux) >= 0, "faux : la tête reste devant l'appuie-tête");
});

test("ceinture : juste, brin ventral sous la ligne des hanches, brin diagonal au tiers central de l'épaule ; faux, ventral au-dessus du nombril, diagonal sous le bras", () => {
  const [juste, faux] = vignettes(famille.DESSINS.ceinture());
  for (const v of [juste, faux]) {
    // Repères anatomiques en ordre : nombril au-dessus de la ligne des crêtes iliaques, épaule gauche du conducteur à droite du
    // dessin (vue de face), cou entre les deux épaules.
    assert.ok(point(v, "nombril")[1] < point(v, "hanches")[1], "nombril au-dessus de la ligne des hanches");
    assert.ok(point(v, "epauleGauche")[0] > point(v, "cou")[0] && point(v, "cou")[0] > point(v, "epauleDroite")[0], "épaule gauche à droite du dessin");
  }
  const epaule = (v) => [point(v, "cou"), point(v, "epauleGauche")];
  // Juste : tout le bord haut du brin ventral, sur la largeur du bassin, est sur la ligne des hanches ou dessous.
  const hanches = point(juste, "hanches")[1];
  const bord = pointsRole(juste, "brin-ventral", "data-haut");
  assert.ok(bord.every((p) => p[1] >= hanches - 1e-6), `juste : bord haut du brin ventral à ${Math.min(...bord.map((p) => p[1])).toFixed(2)}, ligne des hanches à ${hanches.toFixed(2)}`);
  // Juste : le brin diagonal coupe la ligne d'épaule une fois, dans le tiers central entre le cou et le bout de l'épaule.
  const [cou, bout] = epaule(juste);
  const coupe = croisementsPolyligne(pointsRole(juste, "brin-diagonal"), [cou, bout]);
  assert.equal(coupe.length, 1, "juste : le brin diagonal passe une fois sur l'épaule");
  const part = (coupe[0][0] - cou[0]) / (bout[0] - cou[0]);
  assert.ok(part >= 1 / 3 && part <= 2 / 3, `juste : coupe l'épaule à ${(part * 100).toFixed(0)} % du cou au bout de l'épaule`);
  // Faux : le brin ventral passe au-dessus du nombril, sur le ventre.
  const nombril = point(faux, "nombril");
  const ventral = pointsRole(faux, "brin-ventral", "data-haut");
  const auNombril = ventral.reduce((a, b) => (Math.abs(b[0] - nombril[0]) < Math.abs(a[0] - nombril[0]) ? b : a));
  assert.ok(auNombril[1] < nombril[1], "faux : brin ventral au-dessus du nombril");
  const centreVentral = pointsRole(faux, "brin-ventral");
  const auNombrilCentre = centreVentral.reduce((a, b) => (Math.abs(b[0] - nombril[0]) < Math.abs(a[0] - nombril[0]) ? b : a));
  assert.ok(auNombrilCentre[1] < nombril[1], "faux : axe du brin ventral au-dessus du nombril");
  // Faux : le brin diagonal ne coupe pas la ligne d'épaule et n'apparaît que sous l'aisselle.
  const diagonal = pointsRole(faux, "brin-diagonal");
  assert.equal(croisementsPolyligne(diagonal, epaule(faux)).length, 0, "faux : le brin diagonal ne passe pas sur l'épaule");
  const aisselle = point(faux, "aisselleGauche");
  assert.ok(diagonal.every((p) => p[1] >= aisselle[1]), "faux : brin diagonal tout entier sous l'aisselle");
});

test("dessins fixes : textes du cours, sans tiret cadratin, et description pour les lecteurs d'écran", () => {
  for (const code of ["siege", "appuie-tete", "ceinture"]) {
    const d = famille.DESSINS[code]();
    assert.match(d.attributs["aria-label"], /Juste : .*Faux : /, code);
    for (const t of trouverTous(d, (x) => x.balise === "text")) assert.ok(!texteDe(t).includes(TIRET_CADRATIN), code);
  }
  const textes = (code) => trouverTous(famille.DESSINS[code](), (x) => x.balise === "text").map(texteDe).join(" | ");
  assert.match(textes("siege"), /25 cm/);
  assert.match(textes("siege"), /Dos contre le dossier/);
  assert.match(textes("siege"), /Dos décollé/);
  assert.match(textes("appuie-tete"), /sommet du crâne/);
  assert.match(textes("ceinture"), /milieu de l'épaule/i);
  assert.match(textes("ceinture"), /bas sur le bassin/i);
  assert.match(textes("ceinture"), /sous le bras/i);
  assert.match(textes("ceinture"), /sur le ventre/i);
});

// ===== Geste de l'installation =====

const def = famille.GESTES.installation.construire();
const debut = (k) => def.etapes[k].t;
const fin = (k) => (k + 1 < def.etapes.length ? def.etapes[k + 1].t : def.duree);
const instants = (() => {
  const nombre = Math.ceil(def.duree / PAS_IMAGE);
  return Array.from({ length: nombre + 1 }, (_, k) => (k === nombre ? def.duree : k * PAS_IMAGE));
})();
const valeur = (etat, chemin) => chemin.split(".").reduce((o, k) => o[k], etat);

test("installation : cinq étapes dans l'ordre du cours, chaque réglage ne bouge que pendant son étape", () => {
  assert.equal(def.etapes.length, 5);
  const REGLAGES = {
    "siege.recul": 0, "siege.hauteur": 0, "siege.dossier": 0,
    "appuieTete.hauteur": 1,
    "volant.inclinaison": 2, "volant.longueur": 2,
    "ceinture.avancement": 3,
    "retroviseur.orientation": 4,
  };
  const etats = instants.map((t) => def.etat(t));
  for (const [chemin, etape] of Object.entries(REGLAGES)) {
    let bouge = false;
    for (let i = 1; i < instants.length; i++) {
      const avant = valeur(etats[i - 1], chemin), apres = valeur(etats[i], chemin);
      assert.ok(Number.isFinite(avant) && Number.isFinite(apres), `${chemin} non numérique`);
      if (Math.abs(apres - avant) > 1e-9) {
        bouge = true;
        assert.ok(instants[i - 1] >= debut(etape) - 1e-9 && instants[i] <= fin(etape) + 1e-9,
          `${chemin} bouge entre ${instants[i - 1].toFixed(3)} et ${instants[i].toFixed(3)} s, hors de l'étape ${etape + 1}`);
      }
    }
    assert.ok(bouge, `${chemin} ne bouge jamais : l'étape ${etape + 1} ne montre pas son réglage`);
  }
});

test("installation : fin de l'étape 1, 25 cm du sternum au volant et dos contre le dossier ; fin de l'étape 2, appuie-tête au sommet du crâne", () => {
  const apres1 = imageA(def, fin(0), false);
  const d = distance(point(apres1, "sternum"), point(apres1, "centreVolant"));
  assert.ok(Math.abs(d - 25 * CM) <= 1 * CM, `fin de l'étape 1 : ${(d / CM).toFixed(2)} cm`);
  assert.ok(ecartDos(apres1) < NUL, "fin de l'étape 1 : dos contre le dossier");
  // Au départ, le conducteur est trop près du volant : c'est le recul du siège qui donne les 25 cm.
  const depart = imageA(def, 0, false);
  assert.ok(distance(point(depart, "sternum"), point(depart, "centreVolant")) < 20 * CM, "au départ, trop près du volant");
  const apres2 = imageA(def, fin(1), false);
  const ecartHaut = point(apres2, "hautAppuieTete")[1] - point(apres2, "sommetCrane")[1];
  assert.ok(Math.abs(ecartHaut) <= 1 * CM, `fin de l'étape 2 : haut de l'appuie-tête à ${(ecartHaut / CM).toFixed(2)} cm du sommet`);
  assert.ok(Math.abs(point(apres2, "hautAppuieTete")[1] - hautDuContour(apres2, "appuie-tete-coussin")) < 0.05);
  assert.ok(Math.abs(point(apres2, "sommetCrane")[1] - hautDuContour(apres2, "tete")) < 0.05);
  const ecart = ecartTete(apres2);
  assert.ok(ecart >= 0 && ecart <= 4 * CM, `fin de l'étape 2 : ${(ecart / CM).toFixed(2)} cm de la tête à l'appuie-tête`);
  // Au départ, l'appuie-tête est trop bas.
  assert.ok(point(depart, "hautAppuieTete")[1] - point(depart, "sommetCrane")[1] >= 5 * CM, "au départ, appuie-tête trop bas");
});

test("installation : fin de l'étape 3, mains à 9 h et 3 h ; le volant reste à 25 cm du sternum", () => {
  const e = def.etat(fin(2));
  const { rayon } = famille.VOLANT;
  assert.ok(Math.abs(e.mains.gauche.y - rayon) < 0.05 && Math.abs(e.mains.droite.y + rayon) < 0.05, "mains de part et d'autre du centre, sur la jante");
  assert.ok(e.mains.gauche.prise === 1 && e.mains.droite.prise === 1, "les deux mains tiennent la jante");
  const image = imageA(def, fin(2), false);
  // De profil, 9 h et 3 h se voient au centre du volant (la jante y passe de part et d'autre, à hauteur du centre).
  assert.ok(distance(point(image, "main-gauche"), point(image, "centreVolant")) < 0.3, "main gauche à hauteur du centre du volant");
  const d = distance(point(image, "sternum"), point(image, "centreVolant"));
  assert.ok(Math.abs(d - 25 * CM) <= 1 * CM, `fin de l'étape 3 : ${(d / CM).toFixed(2)} cm`);
});

test("installation : fin de l'étape 4, ceinture placée comme le juste (brin ventral sous les hanches, diagonal sur l'épaule)", () => {
  const image = imageA(def, fin(3), false);
  const hanches = point(image, "hanches")[1];
  const bord = pointsRole(image, "brin-ventral", "data-haut");
  assert.ok(bord.every((p) => p[1] >= hanches - 1e-6), `bord haut du brin ventral à ${Math.min(...bord.map((p) => p[1])).toFixed(2)}, hanches à ${hanches.toFixed(2)}`);
  // De profil, le brin diagonal passe sur le dessus de l'épaule, au-dessus de l'aisselle.
  const epaule = point(image, "epaule"), aisselle = point(image, "aisselle");
  const diagonal = pointsRole(image, "brin-diagonal");
  const verticale = [[epaule[0], epaule[1] - 40], [epaule[0], aisselle[1] + 40]];
  const coupes = croisementsPolyligne(diagonal, verticale);
  assert.equal(coupes.length, 1, "le brin diagonal passe une fois à l'aplomb de l'épaule");
  assert.ok(Math.abs(coupes[0][1] - epaule[1]) <= 3 * CM, `brin diagonal à ${((coupes[0][1] - epaule[1]) / CM).toFixed(2)} cm du dessus de l'épaule`);
  assert.ok(coupes[0][1] < aisselle[1], "au-dessus de l'aisselle");
  // Avant l'étape 4, la ceinture est rangée ; à sa fin, bouclée.
  assert.ok(def.etat(debut(3)).ceinture.avancement === 0 && def.etat(fin(3)).ceinture.avancement === 1);
});

test("installation : à la fin, le rétroviseur intérieur cadre toute la lunette arrière", () => {
  const dedans = (image) => {
    const m = trouverRole(image, "miroir");
    assert.ok(m, "rôle « miroir » absent");
    const [x, y, l, h, r] = ["x", "y", "width", "height", "rx"].map((k) => Number(m.attributs[k]));
    // Rectangle aux coins arrondis : un point est sûrement dedans s'il est dans le rectangle rentré du rayon des coins.
    return pointsRole(image, "lunette", "points").every(([px, py]) => px >= x + r && px <= x + l - r && py >= y + r && py <= y + h - r);
  };
  assert.ok(dedans(imageA(def, def.duree, false)), "fin : lunette entière dans le miroir");
  assert.ok(dedans(imageA(def, def.duree, true)), "fin, image figée : lunette entière dans le miroir");
  assert.ok(!dedans(imageA(def, debut(4), true)), "début de l'étape 5 : le miroir ne cadre pas encore la lunette");
  // La tête ne bouge pas pendant le réglage du rétroviseur (« sans bouger la tête »).
  const sommet = (t) => point(imageA(def, t, false), "sommetCrane");
  assert.ok(distance(sommet(debut(4)), sommet(def.duree)) < 1e-6, "la tête reste immobile à l'étape 5");
});

// ===== Correctif, tour 1 : continuité des bras, main hors du visage, volant, découpes, repères =====

// Une articulation du bras ne va pas plus vite que ARTICULATION_MAX unités par image de 1/60 s : les mouvements de main les
// plus rapides du geste (0,8 s, adoucir) restent sous 5 unités par image ; au-delà de 8 (7,5 px sur un téléphone, 480 unités
// par seconde), une articulation saute. Lu dans le dessin (data-x, data-y des rôles), pas dans l'état.
const ARTICULATION_MAX = 8;
const ARTICULATIONS = ["epaule", "coude", "poignet", "main"].flatMap((a) => [`${a}-gauche`, `${a}-droite`]);
const images = instants.map((t) => imageA(def, t, false));

test("installation : aucune articulation dessinée (épaule, coude, poignet, main) ne bouge de plus de 8 unités en une image", () => {
  for (const role of ARTICULATIONS) {
    let pire = { d: 0, t: 0 };
    for (let i = 1; i < images.length; i++) {
      const d = distance(point(images[i - 1], role), point(images[i], role));
      if (d > pire.d) pire = { d, t: instants[i] };
    }
    assert.ok(pire.d <= ARTICULATION_MAX, `${role} : ${pire.d.toFixed(1)} unités en une image à ${pire.t.toFixed(3)} s`);
  }
});

// Point dans un polygone (règle du rayon) ; distance d'un point à un polygone (au plus près de ses côtés).
function dansPolygone([x, y], poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
function distancePolygone(p, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[j], poly[i]], ab = [b[0] - a[0], b[1] - a[1]];
    const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2 || 1)));
    m = Math.min(m, distance(p, [a[0] + k * ab[0], a[1] + k * ab[1]]));
  }
  return m;
}

test("installation : la main proche ne passe jamais sur le visage ni sur le crâne, l'avant-bras non plus", () => {
  const rayonAvantBras = famille.MEMBRES.poignet * CM;
  for (let i = 0; i < images.length; i++) {
    const image = images[i], t = instants[i].toFixed(3);
    const tete = contour(trouverRole(image, "tete").attributs.d);
    const main = contour(trouverRole(image, "main-gauche-forme").attributs.d);
    assert.ok(main.every((p) => !dansPolygone(p, tete)), `main sur la tête à ${t} s`);
    const [c, w] = [point(image, "coude-gauche"), point(image, "poignet-gauche")];
    for (let k = 0; k <= 10; k++) {
      const p = [c[0] + ((w[0] - c[0]) * k) / 10, c[1] + ((w[1] - c[1]) * k) / 10];
      assert.ok(!dansPolygone(p, tete) && distancePolygone(p, tete) >= rayonAvantBras, `avant-bras sur la tête à ${t} s`);
    }
  }
});

test("installation : aucune main ne passe devant le plan du volant à l'intérieur de sa jante (elle ne le traverse pas)", () => {
  // Dans le cercle de la jante, une main reste du côté du conducteur (derrière le plan) ou sur la jante (dans le plan, quand
  // elle la tient) : passer devant voudrait dire traverser le volant.
  const { rayon, jante } = famille.VOLANT;
  for (const cote of ["gauche", "droite"]) {
    for (const t of instants) {
      const e = def.etat(t), m = e.mains[cote], g = famille.geometrieVolant(e.volant);
      const rel = [m.x - g.centre[0], m.z - g.centre[1]];
      const s = rel[0] * g.axe[0] + rel[1] * g.axe[1];                 // distance signée au plan de la jante (vers l'avant)
      const h = rel[0] * g.haut[0] + rel[1] * g.haut[1];               // dans le plan, vers le haut
      if (Math.hypot(h, m.y) < rayon + jante) assert.ok(s <= 1e-6, `main ${cote} devant le volant, dans sa jante, à ${t.toFixed(3)} s (${s.toFixed(2)} cm)`);
    }
  }
});

test("dessins et geste : chaque montage a ses propres identifiants de découpe", () => {
  const ids = (d) => trouverTous(d, (x) => x.balise === "clipPath").map((x) => x.attributs.id);
  for (const code of ["siege", "appuie-tete", "ceinture"]) {
    const [a, b] = [ids(famille.DESSINS[code]()), ids(famille.DESSINS[code]())];
    assert.equal(a.length, 2, code);
    assert.ok(a.every((id) => !b.includes(id)), `${code} : deux montages, mêmes identifiants`);
    assert.equal(new Set(a).size, a.length, `${code} : identifiants en double dans un même dessin`);
  }
  const geste = (d) => ids(imageA(d, 0, false));
  const [g1, g2] = [famille.GESTES.installation.construire(), famille.GESTES.installation.construire()];
  assert.ok(geste(g1).every((id) => !geste(g2).includes(id)), "installation : deux montages, mêmes identifiants");
  assert.deepEqual(geste(g1), ids(imageA(g1, def.duree, true)), "installation : identifiants constants d'une image à l'autre");
});

test("installation : les repères d'une étape restent dans leur étape ; la vignette du rétroviseur n'apparaît qu'à l'étape 5", () => {
  const dans = (t, k) => t >= debut(k) && t < fin(k);
  for (const t of instants) {
    const r = def.etat(t).reperes;
    if (r.cote > 0) assert.ok(dans(t, 0), `cote visible à ${t.toFixed(3)} s`);
    if (r.guide > 0) assert.ok(dans(t, 1), `ligne du sommet du crâne visible à ${t.toFixed(3)} s`);
    if (r.vignette > 0 || r.lunette > 0) assert.ok(t >= debut(4), `vignette visible à ${t.toFixed(3)} s`);
  }
  // Chaque repère se montre bien dans son étape.
  assert.ok(instants.some((t) => def.etat(t).reperes.cote === 1) && instants.some((t) => def.etat(t).reperes.guide === 1));
  assert.equal(def.etat(def.duree).reperes.vignette, 1);
});
