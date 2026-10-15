import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-conducteur.js";
import { SOURCES } from "../sources/dessins-conducteur.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { imageA, PAS_IMAGE, SAUT_POINT_MAX, pointsDessines } from "../js/geste-regles.js";

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
    const m = trouverRole(vivante(image), "miroir");
    assert.ok(m, "rôle « miroir » absent");
    const [x, y, l, h, r] = ["x", "y", "width", "height", "rx"].map((k) => Number(m.attributs[k]));
    // Rectangle aux coins arrondis : un point est sûrement dedans s'il est dans le rectangle rentré du rayon des coins.
    return pointsRole(vivante(image), "lunette", "points").every(([px, py]) => px >= x + r && px <= x + l - r && py >= y + r && py <= y + h - r);
  };
  assert.ok(dedans(imageA(def, def.duree, false)), "fin : lunette entière dans le miroir");
  assert.ok(dedans(imageA(def, def.duree, true)), "fin, image figée : lunette entière dans le miroir");
  assert.ok(!dedans(imageA(def, debut(4), true)), "début de l'étape 5 : le miroir ne cadre pas encore la lunette");
  // La tête ne bouge pas pendant le réglage du rétroviseur (« sans bouger la tête »).
  const sommet = (t) => point(imageA(def, t, false), "sommetCrane");
  assert.ok(distance(sommet(debut(4)), sommet(def.duree)) < 1e-6, "la tête reste immobile à l'étape 5");
});

// ===== Correctif, tour 1 : continuité des bras, main hors du visage, volant, découpes, repères =====

// Une articulation du bras ne va pas plus vite que SAUT_POINT_MAX unités par image de 1/60 s (js/geste-regles.js) : les
// mouvements de main les plus rapides du geste (0,8 s, adoucir) restent sous 5 unités par image ; au-delà de 8 (7,5 px sur un
// téléphone, 480 unités par seconde), une articulation saute. Le contrôle commun des gestes (pointsDessines, par verifierGeste)
// le vérifie sur chaque point dessiné (data-x, data-y des rôles) ; ce test garde que les articulations en sont, à chaque image.
const ARTICULATION_MAX = SAUT_POINT_MAX;
const ARTICULATIONS = ["epaule", "coude", "poignet", "main"].flatMap((a) => [`${a}-gauche`, `${a}-droite`]);
const images = instants.map((t) => imageA(def, t, false));

test("installation : les articulations dessinées (épaule, coude, poignet, main) sont des points dessinés, suivis par le contrôle commun de continuité", () => {
  images.forEach((image, i) => {
    const roles = new Set([...pointsDessines(image).values()].map((p) => p.role));
    for (const role of ARTICULATIONS) assert.ok(roles.has(role), `${role} absent des points dessinés à ${instants[i].toFixed(3)} s`);
  });
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

// ===== Correctif, tour 2 : sens du rétroviseur, filet, vue visée, flèche du volant, coussin, continuité de tous les points =====

/** Vignette vivante (hors du groupe des flèches) et vue visée (rangée dans le groupe des flèches) d'une image du geste. */
function vivante(image) {
  const g = trouverRole(image, "vignette-vivante");
  assert.ok(g, "rôle « vignette-vivante » absent");
  return g;
}
function visee(image) {
  const g = trouverRole(image, "vue-visee");
  assert.ok(g, "rôle « vue-visee » absent");
  return g;
}
const centreDe = (pts) => [0, 1].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
function centreMiroir(g) {
  const m = trouverRole(g, "miroir");
  return [Number(m.attributs.x) + Number(m.attributs.width) / 2, Number(m.attributs.y) + Number(m.attributs.height) / 2];
}
// Sens de rotation de a vers b autour de o : signe du produit vectoriel, dans le repère du cadre.
const sens = (o, a, b) => Math.sign((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]));
/** Trait (points) et tête (contour) de la flèche d'une image figée : le groupe « fleche » porte une flèche du kit. */
function flecheDe(image) {
  const groupe = trouverRole(image, "fleche");
  assert.ok(groupe, "groupe des flèches absent");
  return { trait: contour(trouverRole(groupe, "fleche-trait").attributs.d), tete: contour(trouverRole(groupe, "fleche-tete").attributs.d) };
}
/** Part d'un polygone que cache une forme (`cache(point)` vrai sous elle), comptée sur une grille de `pas` unité. */
function partCachee(poly, cache, pas = 0.1) {
  const [xs, ys] = [poly.map((p) => p[0]), poly.map((p) => p[1])];
  let dedans = 0, caches = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += pas) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += pas) {
      if (!dansPolygone([x, y], poly)) continue;
      dedans++;
      if (cache([x, y])) caches++;
    }
  }
  return dedans ? caches / dedans : 0;
}

test("installation : le rétroviseur, sa flèche et sa vignette tournent dans le même sens (verre d'abord vers le pavillon)", () => {
  // Inclinaison du boîtier dessiné : x de son bas moins x de son haut (data-x1..y2 du rôle « retroviseur »). Positive, le bas
  // est du côté du conducteur et le verre regarde le pavillon ; quand elle baisse, le verre se tourne vers le plancher et
  // montre plus bas : la lunette monte dans le miroir (le y de son centre baisse). La vue de la vignette et le boîtier
  // tiennent leur sens du même tangage : ce test lie les deux, lus dans le dessin.
  // Les bouts du boîtier s'écrivent au millième, la lunette au centième : au tout début et à la toute fin du réglage
  // (adoucir), les variations d'une image restent sous l'arrondi ; on ne compare que les images où le boîtier tourne de plus
  // de BRUIT_INCLINAISON (la lunette bouge alors de plus de quatre centièmes).
  const BRUIT_INCLINAISON = 0.005;
  const inclinaison = (image) => { const [haut, bas] = segment(image, "retroviseur"); return bas[0] - haut[0]; };
  const lunette = (image) => centreDe(pointsRole(vivante(image), "lunette", "points"))[1];
  let tourne = false;
  for (let i = 1; i < images.length; i++) {
    if (instants[i - 1] < debut(4)) continue;
    const t = instants[i].toFixed(3);
    const dI = inclinaison(images[i]) - inclinaison(images[i - 1]), dL = lunette(images[i]) - lunette(images[i - 1]);
    if (Math.abs(dI) < BRUIT_INCLINAISON) continue;
    tourne = true;
    assert.equal(Math.sign(dL), Math.sign(dI),
      `à ${t} s, le verre se tourne vers le ${dI < 0 ? "plancher" : "pavillon"} et la lunette ${dL < 0 ? "monte" : "descend"} dans le miroir`);
  }
  assert.ok(tourne, "le rétroviseur ne tourne pas à l'étape 5");
  // Au départ, verre vers le pavillon (comme le disent les sources) : lunette basse dans le miroir ; à la fin, boîtier droit et
  // lunette au centre du miroir.
  const [depart, arrivee] = [imageA(def, debut(4), false), imageA(def, def.duree, false)];
  assert.ok(inclinaison(depart) > 0, "au départ, le verre regarde le plancher (les sources disent : vers le pavillon)");
  assert.ok(lunette(depart) > centreMiroir(vivante(depart))[1], "au départ, la lunette est basse dans le miroir");
  assert.ok(Math.abs(inclinaison(arrivee)) < 1e-6, "à la fin, boîtier droit");
  assert.ok(Math.abs(lunette(arrivee) - centreMiroir(vivante(arrivee))[1]) < 1e-6, "à la fin, lunette au centre du miroir");
  // La flèche de l'étape tourne autour de la rotule dans le sens où va le bas du boîtier.
  const tige = trouverRole(depart, "tige-retroviseur");
  assert.ok(tige, "rôle « tige-retroviseur » absent");
  const rotule = [Number(tige.attributs.x2), Number(tige.attributs.y2)];
  const fleche5 = flecheDe(imageA(def, debut(4), true));
  const [basDepart, basArrivee] = [segment(depart, "retroviseur")[1], segment(arrivee, "retroviseur")[1]];
  assert.equal(sens(rotule, fleche5.trait[0], fleche5.tete[0]), sens(rotule, basDepart, basArrivee), "la flèche tourne à l'envers du bas du boîtier");
});

test("installation : ni le point ni le trait du filet ne cachent le boîtier du rétroviseur (décision commune 3) ; la main en laisse voir plus de la moitié", () => {
  // Le filet est l'étiquette du kit : un trait et un point, chacun sur un liseré clair. Part du boîtier sous le liseré du
  // point ou sous celui du trait, à chaque image de l'étape 5 (le boîtier tourne, le filet ne bouge pas).
  for (let i = 0; i < images.length; i++) {
    if (instants[i] < debut(4)) continue;
    const image = images[i], t = instants[i].toFixed(3);
    const filet = trouverRole(vivante(image), "filet-retroviseur");
    assert.ok(filet, "rôle « filet-retroviseur » absent");
    const disque = trouverTous(filet, (x) => x.balise === "circle").sort((a, b) => b.attributs.r - a.attributs.r)[0];
    const trait = trouverTous(filet, (x) => x.balise === "line").sort((a, b) => b.attributs["stroke-width"] - a.attributs["stroke-width"])[0];
    const centre = [Number(disque.attributs.cx), Number(disque.attributs.cy)], rayon = Number(disque.attributs.r);
    const seg = [[Number(trait.attributs.x1), Number(trait.attributs.y1)], [Number(trait.attributs.x2), Number(trait.attributs.y2)]];
    const demi = Number(trait.attributs["stroke-width"]) / 2;
    const boitier = contour(trouverRole(image, "retroviseur").attributs.d);
    const part = partCachee(boitier, (p) => distance(p, centre) <= rayon || distancePolygone(p, seg) <= demi);
    assert.equal(part, 0, `le filet cache ${Math.round(part * 100)} % du boîtier à ${t} s`);
  }
  // Pendant que le rétroviseur tourne, la main droite le tient par-dessous et en laisse voir plus de la moitié : on le voit
  // tourner.
  let reglage = false;
  for (let i = 0; i < images.length; i++) {
    const o = def.etat(instants[i]).retroviseur.orientation;
    if (o <= 0 || o >= 1) continue;
    reglage = true;
    const image = images[i];
    const boitier = contour(trouverRole(image, "retroviseur").attributs.d);
    const [main, pouce] = ["main-droite-forme", "pouce-droit"].map((r) => contour(trouverRole(image, r).attributs.d));
    const part = partCachee(boitier, (p) => dansPolygone(p, main) || dansPolygone(p, pouce));
    assert.ok(part <= 0.5, `la main cache ${Math.round(part * 100)} % du boîtier à ${instants[i].toFixed(3)} s`);
  }
  assert.ok(reglage, "le rétroviseur ne tourne jamais");
});

test("installation : l'image figée de l'étape 5 montre la vue visée, rangée avec la flèche et identique à la fin de la lecture", () => {
  const sansIdentifiants = (noeuds) => JSON.stringify(noeuds).replace(/conducteur-installation-miroir(?:-vise)?-\d+/g, "decoupe");
  const figee = imageA(def, debut(4), true);
  // Rangée dans le groupe des flèches ; montrée sur l'image figée de l'étape 5, et sur elle seule parmi les images figées
  // d'étape ; la vignette vivante y est encore à l'opacité 0 : les deux vues ne se superposent pas.
  assert.ok(trouverRole(trouverRole(figee, "fleche"), "vue-visee"), "la vue visée n'est pas dans le groupe des flèches");
  assert.equal(visee(figee).attributs.display, "inline", "image figée de l'étape 5 : vue visée masquée");
  for (const partie of vivante(figee).enfants) {
    assert.ok(partie.attributs.display === "none" && Number(partie.attributs.opacity) === 0,
      `image figée de l'étape 5 : « ${partie.attributs["data-r"]} » de la vignette vivante visible sous la vue visée`);
  }
  for (let k = 0; k < 4; k++) assert.equal(visee(imageA(def, debut(k), true)).attributs.display, "none", `image figée de l'étape ${k + 1} : vue visée affichée`);
  // Même vue que la fin de la lecture (filet et vignette) : mêmes nœuds, mêmes attributs ; seuls les identifiants de découpe
  // diffèrent.
  assert.equal(sansIdentifiants(visee(figee).enfants), sansIdentifiants(vivante(imageA(def, def.duree, false)).enfants),
    "la vue visée n'est pas la vue de fin de lecture");
  // La légende « Toute la lunette » se lit sur l'image figée de fin, par-dessus la vue visée : dessinée après le groupe des
  // flèches.
  const fin = imageA(def, def.duree, true);
  const ordre = trouverTous(fin, (x) => ["fleche", "legende-lunette"].includes(x.attributs["data-r"])).map((x) => x.attributs["data-r"]);
  assert.deepEqual(ordre, ["fleche", "legende-lunette"], "la légende est cachée par la vue visée sur l'image figée de fin");
  assert.equal(trouverRole(fin, "legende-lunette").attributs.display, "inline", "image figée de fin : légende masquée");
});

test("installation : la flèche de l'étape 3 part de la jante, loin de celle de l'étape 5", () => {
  const f3 = imageA(def, debut(2), true), f5 = imageA(def, debut(4), true);
  const [fl3, fl5] = [flecheDe(f3), flecheDe(f5)];
  const jante = segment(f3, "volant");
  const ecart = Math.min(...fl3.trait.map((p) => distancePolygone(p, jante)));
  assert.ok(ecart <= 5 * CM, `flèche de l'étape 3 à ${(ecart / CM).toFixed(1)} cm de la jante`);
  const boite = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  // Boîtes des deux flèches (axe du trait et tête) séparées d'au moins ECART_FLECHES : la moitié du trait et le liseré de
  // chacune (2,5 unités pour le trait appuyé de l'étape 3, 2 pour le trait moyen de l'étape 5) ne se touchent pas.
  const ECART_FLECHES = 4.5;
  const [a, b] = [boite([...fl3.trait, ...fl3.tete]), boite([...fl5.trait, ...fl5.tete])];
  const separees = Math.max(b[0] - a[2], a[0] - b[2], b[1] - a[3], a[1] - b[3]);
  assert.ok(separees >= ECART_FLECHES,
    `flèches des étapes 3 et 5 au même endroit (x ${a[0].toFixed(0)} à ${a[2].toFixed(0)}, y ${a[1].toFixed(0)} à ${a[3].toFixed(0)} ; x ${b[0].toFixed(0)} à ${b[2].toFixed(0)}, y ${b[1].toFixed(0)} à ${b[3].toFixed(0)})`);
});

test("installation : coussin de l'appuie-tête et dossier, de même teinte, séparés par un contour", () => {
  // En position basse (étapes 1 et 2), le coussin passe sous le haut du dossier : le dossier, dessiné par-dessus, porte un
  // contour d'une autre teinte que son fond.
  for (const t of [0, debut(1)]) {
    const image = imageA(def, t, true);
    const coussin = trouverRole(image, "appuie-tete-coussin"), dossier = trouverRole(image, "siege-dossier").enfants[0];
    assert.ok(contour(coussin.attributs.d).some((p) => dansPolygone(p, contour(dossier.attributs.d))), `${t} s : le coussin bas ne passe pas sous le dossier`);
    assert.equal(coussin.attributs.fill, dossier.attributs.fill, `${t} s : coussin et dossier de teintes différentes`);
    assert.ok(dossier.attributs.stroke && dossier.attributs.stroke !== dossier.attributs.fill && Number(dossier.attributs["stroke-width"]) > 0,
      `${t} s : coussin et dossier de même teinte, sans contour de séparation`);
  }
});

// Tous les points dessinés, pas seulement les articulations des bras : chaque point de chaque nœud visible d'une image de
// lecture à la suivante (tracés d, points, data-points, data-haut ; paires x/y, cx/cy, x1/y1, x2/y2, data-x/data-y,
// data-x1/data-y1, data-x2/data-y2), même borne que les articulations. Un tracé qui change de nombre de points est un saut.
const LISTES_COORDONNEES = ["d", "points", "data-points", "data-haut"];
const PAIRES_COORDONNEES = [["x", "y"], ["cx", "cy"], ["x1", "y1"], ["x2", "y2"], ["data-x", "data-y"], ["data-x1", "data-y1"], ["data-x2", "data-y2"]];
/** Points d'un tracé « d » (M, L, C, Q, A, Z absolus), courbes non échantillonnées : extrémités et points de contrôle ; d'un
 *  arc, ses deux rayons (lus comme un point) et son extrémité. */
function pointsDuTrace(d) {
  const ARGUMENTS = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 };
  const jetons = String(d).match(/[A-Za-z]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g) || [];
  const sortie = [];
  let i = 0, commande = null;
  while (i < jetons.length) {
    if (/[A-Za-z]/.test(jetons[i])) commande = jetons[i++];
    assert.ok(Object.hasOwn(ARGUMENTS, commande), `commande de tracé inattendue : ${commande}`);
    if (commande === "Z") { assert.ok(i >= jetons.length || /[A-Za-z]/.test(jetons[i]), "nombre après Z"); continue; }
    const v = jetons.slice(i, i + ARGUMENTS[commande]).map(Number);
    i += ARGUMENTS[commande];
    if (commande === "A") sortie.push([v[0], v[1]], [v[5], v[6]]);
    else for (let k = 0; k < v.length; k += 2) sortie.push([v[k], v[k + 1]]);
  }
  return sortie;
}

test("installation : aucun point dessiné (siège, appuie-tête, volant, rétroviseur, sangle, vignette, corps) ne bouge de plus de 8 unités en une image", () => {
  const pire = { d: 0, role: "", t: "" };
  const garder = (d, role, t) => { if (d > pire.d) Object.assign(pire, { d, role, t }); };
  function comparer(a, b, role, t) {
    if (typeof a === "string" || a.attributs.display === "none" || b.attributs.display === "none") return;
    const ici = a.attributs["data-r"] || role;
    for (const k of LISTES_COORDONNEES) {
      if (!(k in a.attributs)) continue;
      const lire = k === "d" ? pointsDuTrace : points;
      const [pa, pb] = [lire(a.attributs[k]), lire(b.attributs[k])];
      assert.equal(pb.length, pa.length, `${ici} : ${k} change de nombre de points à ${t} s`);
      pa.forEach((p, i) => garder(distance(p, pb[i]), ici, t));
    }
    for (const [kx, ky] of PAIRES_COORDONNEES) {
      if (kx in a.attributs && ky in a.attributs) {
        garder(Math.hypot(Number(b.attributs[kx]) - Number(a.attributs[kx]), Number(b.attributs[ky]) - Number(a.attributs[ky])), ici, t);
      }
    }
    a.enfants.forEach((e, i) => comparer(e, b.enfants[i], ici, t));
  }
  for (let i = 1; i < images.length; i++) comparer(images[i - 1], images[i], "cadre", instants[i].toFixed(3));
  assert.ok(pire.d <= ARTICULATION_MAX, `${pire.role} : ${pire.d.toFixed(1)} unités en une image à ${pire.t} s`);
});
