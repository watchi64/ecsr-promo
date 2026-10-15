/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « dessus » : la voiture et la route vues du dessus, comme dans les scènes de route. Le tour du
 * véhicule (C1.1), les roues braquées en pente, vers le trottoir en descente et vers la chaussée en montée (C1.2), le
 * sous-virage et le survirage (C1.3), le regard porté loin dans un virage (C1.3).
 *
 * La voiture est celle du kit (js/dessins-kit.js : dimensions et teintes des scènes) ; la route reprend celle des scènes
 * (js/scene-decors.js : voies de 3,50 m, axiale T'1, trottoirs ; teintes de js/scene-rendu.js) et le regard, le cône des
 * scènes (REGARD_SCENES du kit). Les valeurs de la rue sont recopiées dans RECOPIE_SCENES (le module ne charge pas les scènes,
 * trop lourdes) ; tests/dessins-dessus.test.mjs vérifie la recopie. Chaque dimension part d'une mesure en mètres, ramenée en
 * unités du cadre par l'échelle du dessin ; les valeurs sans portée réglementaire sont des choix de dessin, recopiés avec leur
 * raison dans sources/dessins-dessus.js. Titres et cadres viennent du catalogue des blocs (js/catalogue-blocs.js).
 */
import { n, trouverRole } from "./dessin-svg.js?v=20261015c";
import { CHARTE, TEINTES_ROUTE, REGARD_SCENES, VOITURE, MATIERES, METRIQUES_POLICE, MISE_EN_PAGE, cadre, texte, etiquette, fleche,
  voitureDessus, reperesDessus, voitureProfil, arc, couper, coord, trace, entre } from "./dessins-kit.js?v=20261015c";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261015c";

/** Valeurs de la rue des scènes reprises ici, recopiées : largeur d'une voie et axiale T'1 d'agglomération (js/scene-decors.js,
 *  DESSIN.voie et IISR : 1,50 m de trait, 5 m de vide, 2u = 0,10 m de large) ; jeu entre le flanc d'une voiture garée et la
 *  bordure (DESSIN.jeuStationnement). */
export const RECOPIE_SCENES = Object.freeze({
  voie: 3.5,
  axiale: Object.freeze({ trait: 1.5, vide: 5, largeur: 0.1 }),
  jeuStationnement: 0.3,
});

// ===== Géométrie plane =====

const RAD = Math.PI / 180;
const QUART = 90;     // degrés : un quart de tour ; dans le repère du cadre (y vers le bas), + QUART tourne vers la droite
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const fois = (a, k) => [a[0] * k, a[1] * k];
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const direction = (angle) => [Math.cos(angle * RAD), Math.sin(angle * RAD)];
const polaire = (centre, rayon, angle) => plus(centre, fois(direction(angle), rayon));
const angleDe = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
const centreDe = (pts) => [0, 1].map((k) => pts.reduce((somme, p) => somme + p[k], 0) / pts.length);
const rectangle = (x, y, largeur, hauteur) => [[x, y], [x + largeur, y], [x + largeur, y + hauteur], [x, y + hauteur]];
const boite = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
};
// Courbe de Bézier (quadratique ou cubique), échantillonnée en `nombre` segments, bouts compris.
function bezier(controles, nombre) {
  return Array.from({ length: nombre + 1 }, (_, k) => {
    let q = controles;
    while (q.length > 1) q = q.slice(1).map((p, i) => entre(q[i], p, k / nombre));
    return q[0];
  });
}
// Valeur qui annule une fonction croissante entre deux bornes, par dichotomie (PAS_DICHOTOMIE pas : bien en deçà du
// micromètre).
const PAS_DICHOTOMIE = 60;
function annuler(f, bas, haut) {
  for (let k = 0; k < PAS_DICHOTOMIE; k++) { const m = (bas + haut) / 2; if (f(m) < 0) bas = m; else haut = m; }
  return (bas + haut) / 2;
}

/** Arc de cercle échantillonné au degré au plus : les arcs du kit, de 6 degrés au plus, mis bout à bout. Sur le grand rayon d'un
 *  virage (près de 300 unités), une corde de 6 degrés s'écarterait de l'arc de 0,4 unité, des facettes visibles ; d'un degré, de
 *  0,01 unité. */
const PAS_FIN = 1;
function arcFin(centre, rayon, de, a) {
  const nombre = Math.max(1, Math.ceil(Math.abs(a - de) / PAS_FIN));
  return Array.from({ length: nombre }, (_, k) => arc(centre, rayon, de + ((a - de) * k) / nombre, de + ((a - de) * (k + 1)) / nombre))
    .flatMap((morceauArc, k) => (k ? morceauArc.slice(1) : morceauArc));
}

/** Fenêtre convexe en forme de rectangle aux coins arrondis : ses coins sont des arcs de cercle exacts (arc du kit), et la
 *  ligne brisée qui les suit reste dans le rectangle arrondi que dessine un rect SVG de même rayon. */
function fenetreArrondie(x, y, largeur, hauteur, rayon) {
  const [x2, y2] = [x + largeur, y + hauteur];
  return [...arc([x2 - rayon, y + rayon], rayon, -QUART, 0), ...arc([x2 - rayon, y2 - rayon], rayon, 0, QUART),
    ...arc([x + rayon, y2 - rayon], rayon, QUART, 2 * QUART), ...arc([x + rayon, y + rayon], rayon, 2 * QUART, 3 * QUART)];
}
// Position d'un point par rapport au côté [a, b] d'une fenêtre : produit vectoriel.
const cote = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
// La même fenêtre rentrée de `retrait` : un pointillé qu'on y découpe garde ses points ronds entiers dans la fenêtre.
const fenetreRentree = ({ x, y, largeur, hauteur, rayon }, retrait) =>
  fenetreArrondie(x + retrait, y + retrait, largeur - 2 * retrait, hauteur - 2 * retrait, Math.max(0, rayon - retrait));
/** Partie d'un polygone dans une fenêtre convexe : une découpe (couper du kit) par côté de la fenêtre. */
function dansFenetre(poly, fenetre) {
  const c = centreDe(fenetre);
  let q = poly;
  for (let i = 0; i < fenetre.length && q.length; i++) {
    const a = fenetre[i], b = fenetre[(i + 1) % fenetre.length], signe = Math.sign(cote(a, b, c));
    q = couper(q, (p) => -signe * cote(a, b, p));
  }
  return q;
}
function dedans(p, fenetre) {
  const c = centreDe(fenetre);
  return fenetre.every((a, i) => { const b = fenetre[(i + 1) % fenetre.length]; return cote(a, b, p) * cote(a, b, c) >= 0; });
}
/** Partie d'une ligne brisée dans une fenêtre convexe : du point où elle y entre à celui où elle en sort (elle y entre une
 *  fois) ; chaque bout coupé au bord. */
function ligneDansFenetre(points, fenetre) {
  const bord = (a, b) => entre(a, b, annuler((t) => (dedans(entre(a, b, t), fenetre) ? -1 : 1), 0, 1));   // a dedans, b dehors
  const r = [];
  for (let i = 0; i < points.length; i++) {
    if (dedans(points[i], fenetre)) {
      if (!r.length && i > 0) r.push(bord(points[i], points[i - 1]));
      r.push(points[i]);
    } else if (r.length) {
      r.push(bord(points[i - 1], points[i]));
      break;
    }
  }
  return r;
}
/** Morceau d'une ligne brisée entre les abscisses curvilignes s0 et s1 (unités). */
function morceau(points, s0, s1) {
  const r = [];
  let cumul = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]], l = distance(a, b);
    if (l > 0 && cumul + l >= s0 && cumul <= s1) {
      if (!r.length) r.push(entre(a, b, Math.max(0, (s0 - cumul) / l)));
      r.push(entre(a, b, Math.min(1, (s1 - cumul) / l)));
    }
    cumul += l;
  }
  return r;
}
/** Abscisse curviligne, sur une ligne brisée, du point le plus proche de p. */
function abscisse(points, p) {
  let meilleur = { s: 0, ecart: Infinity }, cumul = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]], l = distance(a, b);
    const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (l * l)));
    const ecart = distance(p, entre(a, b, t));
    if (ecart < meilleur.ecart) meilleur = { s: cumul + t * l, ecart };
    cumul += l;
  }
  return meilleur.s;
}

// ===== Pièces de la famille =====

// Pointillé d'un trajet : des points ronds (traits presque nuls aux bouts arrondis), comme le trajet prévu des scènes. Avec
// `lisere`, chaque point est bordé d'un liseré clair (CHARTE.liseres), comme les filets et les flèches du kit : il reste lisible
// quand il passe sur la voiture.
const PRESQUE_NUL = 0.01;
function pointille(points, { couleur, epaisseur, pas, role, attributs = {}, lisere = false }) {
  const trait = (couleurTrait, largeur, autres) => n("path", { d: trace(points, false), fill: "none", stroke: couleurTrait, "stroke-width": largeur,
    "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": `${PRESQUE_NUL} ${coord(pas - PRESQUE_NUL)}`, ...autres });
  return [lisere && trait(CHARTE.carte, epaisseur + 2 * CHARTE.liseres, {}), trait(couleur, epaisseur, { "data-r": role, ...attributs })];
}

/**
 * Virage à gauche d'une route d'agglomération vu du dessus, comme les routes des scènes (routeVirages de js/scene-decors.js) :
 * chaussée de deux voies de `voie` unités, axiale T'1 sur l'axe, trottoirs au-delà (le fond de la fenêtre), sans ligne de rive.
 * `centre` : centre du virage dans le cadre ; `rayon` : rayon de l'axe de la chaussée ; on parcourt le virage dans le sens où
 * l'angle polaire (degrés, repère du cadre) décroît, de `entree` à `sortie` ; une ligne droite le prolonge à chaque bout,
 * jusqu'au-delà de la fenêtre. Rend le nœud de la route et `parallele(o)`, la ligne parallèle à l'axe, à `o` unités vers
 * l'extérieur du virage (négatif : vers l'intérieur), découpée à `fenetreLignes` (la fenêtre, ou la fenêtre rentrée d'un
 * pointillé).
 */
function virageAGauche({ centre, rayon, entree, sortie, voie, echelle, fenetre, fenetreLignes = fenetre }) {
  const loin = Math.max(...fenetre.map((p) => distance(p, centre))) + rayon;   // une ligne droite qui sort de la fenêtre
  const parallele = (o) => {
    const debut = polaire(centre, rayon + o, entree), fin = polaire(centre, rayon + o, sortie);
    return [plus(debut, fois(direction(entree + QUART), loin)), ...arcFin(centre, rayon + o, entree, sortie),
      plus(fin, fois(direction(sortie - QUART), loin))];
  };
  // Point de l'axe à l'abscisse s (unités, depuis le bout lointain de la ligne droite d'approche), à o unités vers l'extérieur.
  const longueurArc = rayon * (entree - sortie) * RAD;
  const surAxe = (s, o) => {
    if (s <= loin) return plus(polaire(centre, rayon + o, entree), fois(direction(entree + QUART), loin - s));
    if (s <= loin + longueurArc) return polaire(centre, rayon + o, entree - (s - loin) / rayon / RAD);
    return plus(polaire(centre, rayon + o, sortie), fois(direction(sortie - QUART), s - loin - longueurArc));
  };
  // Axiale T'1 : traits et vides comptés depuis le bout de l'approche, chaque trait une bande de la largeur du marquage qui suit
  // l'axe, échantillonnée tous les PAS_TRAIT degrés au plus dans le virage.
  const { trait, vide, largeur } = RECOPIE_SCENES.axiale;
  const [t, v, demi] = [trait * echelle, vide * echelle, (largeur * echelle) / 2];
  const traits = [];
  for (let s0 = 0; s0 < 2 * loin + longueurArc; s0 += t + v) {
    const nombre = Math.max(1, Math.ceil(t / rayon / RAD / PAS_TRAIT));
    const abscisses = Array.from({ length: nombre + 1 }, (_, k) => s0 + (t * k) / nombre);
    const bande = [...abscisses.map((s) => surAxe(s, demi)), ...[...abscisses].reverse().map((s) => surAxe(s, -demi))];
    const vu = dansFenetre(bande, fenetre);
    if (vu.length >= 3) traits.push(n("path", { d: trace(vu), fill: TEINTES_ROUTE.peinture, "data-r": "axiale" }));
  }
  const chaussee = dansFenetre([...parallele(-voie), ...parallele(voie).reverse()], fenetre);
  return {
    noeud: n("g", { "data-r": "route", "data-cx": centre[0], "data-cy": centre[1], "data-rayon": rayon, "data-voie": voie },
      n("path", { d: trace(fenetre), fill: TEINTES_ROUTE.trottoir, "data-r": "trottoirs" }),
      n("path", { d: trace(chaussee), fill: TEINTES_ROUTE.chaussee, "data-r": "chaussee" }),
      traits),
    parallele: (o) => ligneDansFenetre(parallele(o), fenetreLignes),
  };
}
const PAS_TRAIT = 2;   // degrés : un trait de l'axiale suit l'arc à mieux qu'un millième d'unité près

// Repère numéroté d'une étape : un disque clair cerclé de foncé, son numéro au centre, comme les repères des étapes des scènes
// (disque blanc cerclé de #1F2924, le texte de la charte) ; le numéro est en Outfit 700, la police des dessins, et le cercle d'un
// trait moyen, pour se lire à côté des étiquettes.
const REPERE = { rayon: 7.5, taille: CHARTE.tailles.etiquette, graisse: 700, trait: CHARTE.traits.moyen };
function repere(numero, [x, y]) {
  return n("g", { "data-r": `repere-${numero}`, "data-x": x, "data-y": y },
    n("circle", { cx: x, cy: y, r: REPERE.rayon, fill: CHARTE.carte, stroke: CHARTE.texte, "stroke-width": REPERE.trait }),
    texte(x, y + METRIQUES_POLICE.milieuCapitales * REPERE.taille, String(numero), { taille: REPERE.taille, ancrage: "middle", graisse: REPERE.graisse }));
}

// Points du tracé d'une pièce du kit (M ... L ... Z), dans le repère local de la voiture.
const pointsDuTrace = (noeud) => {
  const v = String(noeud.attributs.d).match(/-?\d+(?:\.\d+)?/g).map(Number);
  return Array.from({ length: v.length / 2 }, (_, i) => [v[2 * i], v[2 * i + 1]]);
};
// Repère local d'une voiture (unités, avant le translate et le rotate de son groupe) vers le cadre.
const localVersCadre = ({ x, y, cap }) => ([px, py]) => plus([x, y], [px * Math.cos(cap * RAD) - py * Math.sin(cap * RAD),
  px * Math.sin(cap * RAD) + py * Math.cos(cap * RAD)]);
// Contour d'une roue du kit vue du dessus, dans le cadre : le pneu, centré sur la roue, tourné du cap et du braquage.
function contourRoue(roue, { cap, echelle }) {
  const a = roue.attributs, centre = [Number(a["data-x"]), Number(a["data-y"])], angle = cap + Number(a["data-angle"]);
  const [l, w] = [(VOITURE.roue.diametre / 2) * echelle, (VOITURE.roue.largeur / 2) * echelle];
  return [[l, w], [l, -w], [-l, -w], [-l, w]].map(([u, v]) => plus(centre, plus(fois(direction(angle), u), fois(direction(angle + QUART), v))));
}
/** Point d'une étiquette sur la pièce qu'elle désigne : le point du contour le plus proche de l'ancre, rentré de `retrait`
 *  vers le centre de la pièce. Le point couvre ainsi le bout de la pièce tourné vers son texte, pas son milieu. */
function pointVers(contour, ancre, retrait) {
  let meilleur = null;
  contour.forEach((a, i) => {
    const b = contour[(i + 1) % contour.length], l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((ancre[0] - a[0]) * (b[0] - a[0]) + (ancre[1] - a[1]) * (b[1] - a[1])) / l2));
    const q = entre(a, b, t);
    if (!meilleur || distance(q, ancre) < distance(meilleur, ancre)) meilleur = q;
  });
  const c = centreDe(contour);
  return entre(meilleur, c, retrait / distance(meilleur, c));
}
/** Point d'une étiquette au bout d'une pièce allongée : le point du contour le plus avancé dans la direction `vers` (degrés),
 *  rentré de `retrait` vers le centre de la pièce. Pour un feu qui fait le tour d'un coin, le point couvre son bout, pas sa
 *  largeur entière. */
function pointAuBout(contour, vers, retrait) {
  const u = direction(vers), avance = (p) => p[0] * u[0] + p[1] * u[1];
  const bout = contour.reduce((m, p) => (avance(p) > avance(m) ? p : m)), c = centreDe(contour);
  return entre(bout, c, retrait / distance(bout, c));
}

// ===== Tour du véhicule =====
// Vue du dessus, cap 0 : l'avant à droite du cadre, le côté du conducteur (gauche) en haut. Mètres dans le repère de la
// voiture : x vers l'avant, y vers sa droite ; un angle d'arc part de l'avant et tourne vers la droite de la voiture.
// Le parcours suit l'ordre du cours (thème 25) : l'avant, un côté, l'arrière, l'autre côté, puis le capot, puis l'habitacle. Il
// part de devant le phare droit et longe l'avant vers la gauche : le côté du conducteur vient d'abord. Revenu par le flanc droit, il
// coupe le coin avant droit, plus près de la caisse, pour gagner le devant du capot, puis repart le long du flanc du conducteur
// jusqu'à sa portière : une spirale du dehors vers la voiture, qui ne repasse jamais sur le tour.
const TOUR = {
  echelle: 36,              // unités par mètre
  centre: [130, 128],       // centre de la voiture : à gauche du cadre, pour loger à droite les noms des repères 1 et 2
  ecartTour: 0.75,          // m : du tour extérieur à la caisse
  // m : du chemin intérieur à la caisse (devant le capot, puis le long du flanc du conducteur), au-delà du rétroviseur (1,02 m de
  // l'axe) et 0,42 m en dedans du tour extérieur (15 unités).
  ecartInterieur: 0.33,
  // m, en avant de l'œil : le chemin quitte le flanc à `entree`, puis gagne la place du conducteur en biais (point de contrôle de
  // la courbe à `controleEntree`) : il y arrive par l'avant et laisse libre le côté où part l'étiquette « Habitacle ».
  entree: 0.7, controleEntree: 0.55,
  pointille: { epaisseur: CHARTE.traits.appuye, pas: 6 },
  pasCourbe: 12,            // segments de la courbe qui gagne la place du conducteur
  fleche: 10,               // unités : longueur d'une flèche du sens de marche
  ecartFleche: 4,           // unités : du disque du repère 1 à la flèche qui part de lui le long de l'avant
  ouvertureCapot: 60,       // degrés : capot relevé, tenu par sa béquille
  nom: 4,                   // unités : du disque d'un repère au texte de son nom
  // Étiquettes et nom du repère 2 : ancre de chacun, en unités depuis le centre de la voiture. En haut, « Habitacle » et les
  // balais ; en bas, sur une même ligne, l'arrière, les pneus, les vitres et l'avant ; à droite, « Capot », au-dessus du nom du
  // repère 1, écrit à droite de son disque.
  ancres: { habitacle: [-38, -78], balais: [55, -82], feuxArriere: [-98, 70], pneus: [-52, 70], vitres: [10, 70], feuxAvant: [88, 74],
    capot: [118, -32] },
  retraitPoint: 1,          // unités : du contour de la pièce désignée au point de son étiquette, vers l'intérieur
};
// Noms des trois temps du tour, les mots du cours (C1.1), dans son ordre.
const NOMS_REPERES = ["Extérieur", "Capot", "Habitacle"];

/** Compartiment moteur découvert et capot relevé, dans le repère local de la voiture (le groupe a la pose de la voiture) : le
 *  capot tourne autour de sa charnière, son bord arrière, côté pare-brise ; vu du dessus, chacun de ses points garde sa distance à
 *  l'axe et ne s'avance plus que de sa distance à la charnière multipliée par le cosinus de l'ouverture : son bord avant relevé
 *  garde la largeur de son bord avant fermé, et le capot cache l'arrière du compartiment. */
function capotOuvert({ x, y, cap, echelle, ouverture }) {
  const { arriere: [xa, ya], avant: [xv, yv] } = VOITURE.jointsCapot;
  const m = ([mx, my]) => [mx * echelle, my * echelle];
  const portee = xa + (xv - xa) * Math.cos(ouverture * RAD);
  return n("g", { "data-r": "capot-ouvert", "data-angle": ouverture, transform: `translate(${coord(x)} ${coord(y)}) rotate(${coord(cap)})` },
    n("path", { d: trace([[xa, -ya], [xv, -yv], [xv, yv], [xa, ya]].map(m)), fill: MATIERES.compartiment, "data-r": "compartiment" }),
    n("path", { d: trace([[xa, -ya], [portee, -yv], [portee, yv], [xa, ya]].map(m)), fill: TEINTES_ROUTE.eleve,
      stroke: TEINTES_ROUTE.eleveBord, "stroke-width": CHARTE.traits.fin, "stroke-linejoin": "round", "data-r": "capot-releve" }));
}

function tourVehicule() {
  const code = "tour-vehicule";
  const [L, H] = CATALOGUE[code].cadre;
  const T = TOUR, E = T.echelle;
  const pose = { x: T.centre[0], y: T.centre[1], cap: 0, echelle: E };
  const versCadre = ([mx, my]) => [pose.x + mx * E, pose.y + my * E];
  const demiL = VOITURE.longueur / 2, demiW = VOITURE.largeur / 2, r = VOITURE.rayon;
  const coin = (sx, sy) => [sx * (demiL - r), sy * (demiW - r)];   // centre de l'arrondi d'un coin de la caisse
  const R = r + T.ecartTour, Ri = r + T.ecartInterieur;

  // Tour extérieur, à `ecartTour` de la caisse : de devant le phare droit (au bout de la partie droite de l'avant), l'avant vers la
  // gauche, le flanc du conducteur, l'arrière, puis le flanc droit jusqu'au droit du coin avant droit.
  const exterieur = [[demiL + T.ecartTour, demiW - r], ...arc(coin(1, -1), R, 0, -QUART), ...arc(coin(-1, -1), R, -QUART, -2 * QUART),
    ...arc(coin(-1, 1), R, 2 * QUART, QUART), [demiL - r, demiW + T.ecartTour]].map(versCadre);
  // Puis le capot : du flanc droit, le chemin coupe le coin avant droit au plus court (un quart de cercle de rayon Ri, tangent au
  // tour et au chemin intérieur) et gagne le devant du capot, à `ecartInterieur` du nez, dans l'axe.
  const devantCapot = [demiL + T.ecartInterieur, 0];
  const capot = [...arc([demiL - r, demiW + T.ecartTour - Ri], Ri, QUART, 0), devantCapot].map(versCadre);
  // Puis l'habitacle : de devant le capot, le long du nez vers la gauche, le coin avant gauche et le flanc du conducteur, à
  // `ecartInterieur` de la caisse, jusqu'à sa portière ; puis la place du conducteur, l'œil du conducteur de la voiture du kit.
  const flanc = -(demiW + T.ecartInterieur);
  const oeil = reperesDessus(pose).oeil, oeilM = [VOITURE.oeil.avant, -VOITURE.oeil.gauche];
  const verseSiege = bezier([[oeilM[0] + T.entree, flanc], [oeilM[0] + T.controleEntree, flanc], oeilM], T.pasCourbe);
  const habitacle = [devantCapot, ...arc(coin(1, -1), Ri, 0, -QUART), ...verseSiege].map(versCadre);
  habitacle[habitacle.length - 1] = oeil;
  const parcours = [...exterieur, ...capot.slice(1), ...habitacle.slice(1)];
  const reperes = [exterieur[0], habitacle[0], oeil];

  // Flèches du sens de marche du tour : la première part du repère 1 le long de l'avant ; les autres ont leur pointe au milieu du
  // flanc gauche, de l'arrière et du flanc droit. Les chemins du capot et de l'habitacle n'en ont pas : ils vont d'un repère au
  // suivant.
  const premiere = morceau(parcours, REPERE.rayon + T.ecartFleche, REPERE.rayon + T.ecartFleche + T.fleche);
  const pointes = [[0, -(demiW + T.ecartTour)], [-(demiL + T.ecartTour), 0], [0, demiW + T.ecartTour]].map(versCadre);
  const fleches = [premiere, ...pointes.map((p) => { const s = abscisse(parcours, p); return morceau(parcours, s - T.fleche, s); })]
    .map((trait) => fleche(trait, { couleur: CHARTE.accentFort, epaisseur: CHARTE.traits.appuye, role: "sens-parcours" }));

  const voiture = voitureDessus({ ...pose, retroviseurs: true, roues: true });
  const vers = localVersCadre(pose), A = Object.fromEntries(Object.entries(T.ancres).map(([k, [dx, dy]]) => [k, [pose.x + dx, pose.y + dy]]));
  // Points des étiquettes, sur la pièce qu'elles désignent (pointVers) : phare avant droit, roue arrière droite, vitre avant
  // droite, feu arrière droit ; balai d'essuie-glace gauche, son bout extérieur.
  const contour = (role) => pointsDuTrace(trouverRole(voiture, role)).map(vers);
  const balai = trouverRole(voiture, "essuie-glaces").enfants[0].attributs;
  const lab = (role, cible, ancre, lignes, ancrage) => etiquette({ cible, ancre, lignes, ancrage, role: `etiquette-${role}` });
  // Nom d'un repère au bout d'un filet : le filet part du bord de son disque, du côté de son ancre.
  const nomAuFilet = (k, ancre, ancrage) => etiquette({ cible: plus(reperes[k - 1], fois(direction(angleDe(reperes[k - 1], ancre)), REPERE.rayon)),
    ancre, lignes: [NOMS_REPERES[k - 1]], ancrage, role: `nom-${k}` });
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "La voiture vue du dessus et le parcours, toujours le même : 1, l'extérieur, en commençant par l'avant, puis un côté, "
      + "l'arrière et l'autre côté (feux et clignotants, pneus, balais d'essuie-glace, vitres, feux et plaque) ; 2, le capot ouvert ; "
      + "3, l'habitacle, à la place du conducteur." },
  voiture,
  capotOuvert({ ...pose, ouverture: T.ouvertureCapot }),
  pointille(exterieur, { couleur: CHARTE.accentFort, ...T.pointille, role: "parcours-exterieur", lisere: true }),
  pointille(capot, { couleur: CHARTE.accentFort, ...T.pointille, role: "parcours-capot", lisere: true }),
  pointille(habitacle, { couleur: CHARTE.accentFort, ...T.pointille, role: "parcours-habitacle", lisere: true }),
  fleches,
  lab("feux-avant", pointVers(contour("phare-droit"), A.feuxAvant, T.retraitPoint), A.feuxAvant, ["Feux et", "clignotants"], "start"),
  lab("pneus", pointVers(contourRoue(trouverRole(voiture, "roue-arriere-droite"), pose), A.pneus, T.retraitPoint), A.pneus, ["Pneus"], "middle"),
  lab("vitres", pointVers(contour("vitre-avant-droite"), A.vitres, T.retraitPoint), A.vitres, ["Vitres"], "middle"),
  lab("feux-arriere", pointAuBout(contour("feu-droit"), pose.cap, T.retraitPoint), A.feuxArriere, ["Feux et", "plaque"], "middle"),
  etiquette({ cible: vers([balai.x1, balai.y1]), ancre: A.balais, lignes: ["Balais", "d'essuie-glace"], ancrage: "middle", role: "etiquette-balais" }),
  reperes.map((p, i) => repere(i + 1, p)),
  texte(reperes[0][0] + REPERE.rayon + T.nom, reperes[0][1] + METRIQUES_POLICE.milieuCapitales * CHARTE.tailles.etiquette, NOMS_REPERES[0], { role: "nom-1" }),
  nomAuFilet(2, A.capot, "start"),
  nomAuFilet(3, A.habitacle, "end"));
}

// ===== Roues braquées en pente : en descente, en montée =====
// Deux colonnes, la descente à gauche, la montée à droite. Dans chacune, de haut en bas : son titre ; l'étiquette des roues, au-dessus
// de la rue, dont le filet descend jusqu'à la roue avant gauche ; la rue vue du dessus, la voiture garée le long du trottoir de droite,
// cap 0 (l'avant à droite du cadre, le trottoir en bas) ; la même voiture de profil, vue du trottoir (côté droit, l'avant à droite),
// garée sur la pente. Même voiture, même trottoir, même échelle dans les deux colonnes : seuls changent le sens de la pente et celui
// du braquage. En descente, les roues avant sont braquées vers le trottoir : si la voiture avance, la roue bute contre lui ; en
// montée, vers la chaussée : si elle recule, la roue vient buter contre lui (cours C1.2).
const PENTE = {
  marge: 8, gouttiere: 8,      // bords du cadre ; entre les deux colonnes
  echelle: 26,                 // unités par mètre, pour les deux vues des deux colonnes
  titre: { taille: CHARTE.tailles.titre, graisse: 600 },
  // Étiquette des roues : son texte sous le titre, à `ecartTitre` unités ; son ancre à `ancre` unités du bord gauche de la colonne
  // (le texte, 98 unités au plus, tient dans la colonne, au-dessus des roues avant) et `jour` unités au-dessus de la vue du dessus ;
  // son point sur le bout de la roue avant gauche tourné vers la chaussée, `retrait` unité en dedans de son contour : ce bout
  // dépasse de la caisse, et le point ne couvre que lui.
  etiquette: { ecartTitre: 4, ancre: 96, jour: 4, retrait: 1 },
  // Vue du dessus : chaussée au-dessus de la voiture, trottoir sous la bordure (m) ; rayon de ses coins ; mot « Trottoir » à `nom`
  // unités de son bord gauche.
  plan: { chaussee: 0.5, trottoir: 0.95, rayon: MISE_EN_PAGE.rayonVignette, nom: 6 },
  braquage: 30,                // degrés : roues avant nettement braquées, en deçà de la butée de la voiture du kit (40)
  entreVues: 6,                // unités entre la vue du dessus et le profil
  // Profil : pente de la rue (pour cent) ; épaisseur de la chaussée montrée sous sa surface (m), qui finit juste au bas de la vignette,
  // au bord où la rue descend ; jour au-dessus du toit (unités, au moins) ; rayon des coins de sa vignette.
  profil: { pourcent: 12, epaisseurSol: 0.3, jour: 7, rayon: MISE_EN_PAGE.rayonVignette },
};
// Les deux cas : nom (rôles), titre, sens de la pente (1 : l'avant plus bas que l'arrière), mots de l'étiquette des roues. Le
// braquage en découle : vers le trottoir en descente, vers la chaussée en montée.
const CAS_PENTE = [
  { nom: "descente", titre: "En descente", descend: 1, lignes: ["Roues braquées", "vers le trottoir"] },
  { nom: "montee", titre: "En montée", descend: -1, lignes: ["Roues braquées", "vers la chaussée"] },
];
const COTE_TROTTOIR = 1;       // le trottoir à droite de la voiture : un braquage positif tourne les roues vers lui

function rouesTrottoir() {
  const code = "roues-trottoir";
  const [L, H] = CATALOGUE[code].cadre;
  const P = PENTE, E = P.echelle, Pl = P.plan, Pr = P.profil, Et = P.etiquette, M = METRIQUES_POLICE;
  const largeur = (L - 2 * P.marge - P.gouttiere) / 2;
  const angle = Math.atan(Pr.pourcent / 100) / RAD;   // degrés ; positif, le sol descend vers la droite du cadre
  // Haut de la voiture de profil au-dessus du point du sol sous son milieu (m), dans les deux sens de la pente (le plus haut des
  // deux) : les sommets de son contour de profil (VOITURE.profil), tournés de la pente ; l'arrondi des coins ne fait que rentrer
  // le contour.
  const hauteurProfil = Math.max(...[angle, -angle].flatMap((a) => Object.values(VOITURE.profil).filter(Array.isArray)
    .map(([px, ph]) => ph * Math.cos(a * RAD) - px * Math.sin(a * RAD))));
  // Rangées, de haut en bas : titre, étiquette (son ancre), vue du dessus, profil.
  const baseTitre = P.marge + M.haut * P.titre.taille;
  const ancreY = baseTitre + M.bas * P.titre.taille + Et.ecartTitre + M.haut * CHARTE.tailles.etiquette
    + (CAS_PENTE[0].lignes.length - 1) * M.interligne * CHARTE.tailles.etiquette + M.bas * CHARTE.tailles.etiquette + MISE_EN_PAGE.espaceEtiquette;
  const hautPlan = ancreY + Et.jour, hauteurPlan = (Pl.chaussee + VOITURE.largeur + RECOPIE_SCENES.jeuStationnement + Pl.trottoir) * E;
  // Le profil va de sous la vue du dessus à la marge du bas du cadre ; la chaussée, en coupe, y finit au bord où la rue descend.
  const hautProfil = hautPlan + hauteurPlan + P.entreVues, basProfil = H - P.marge;
  const solY = basProfil - (largeur / 2) * Math.tan(angle * RAD) - (Pr.epaisseurSol * E) / Math.cos(angle * RAD);
  const jour = solY - hauteurProfil * E - hautProfil;
  if (jour < Pr.jour) throw new Error(`Roues en pente : cadre de ${H} unités de haut, il en faut ${H + Pr.jour - jour}.`);

  const colonne = (cas, x0) => {
    const cx = x0 + largeur / 2, braquage = cas.descend * COTE_TROTTOIR * P.braquage, a = cas.descend * angle;
    // Rue vue du dessus : chaussée au-dessus de la bordure, trottoir dessous ; la bordure à `jeuStationnement` du flanc droit.
    const pose = { x: cx, y: hautPlan + (Pl.chaussee + VOITURE.largeur / 2) * E, cap: 0, echelle: E };
    const fenetre = fenetreArrondie(x0, hautPlan, largeur, hauteurPlan, Pl.rayon);
    const bordure = pose.y + (VOITURE.largeur / 2 + RECOPIE_SCENES.jeuStationnement) * E;
    // Sans rétroviseurs : ils n'apprennent rien ici, et le gauche se poserait sur le bout arrière de la roue avant gauche braquée.
    const voiture = voitureDessus({ ...pose, roues: true, braquage });
    const roue = trouverRole(voiture, "roue-avant-gauche"), axeRoue = pose.cap + braquage;
    const versChaussee = Math.sin(axeRoue * RAD) < 0 ? axeRoue : axeRoue + 2 * QUART;   // le bout de la roue tourné vers le haut du cadre
    const ancre = [x0 + Et.ancre, ancreY], cible = pointAuBout(contourRoue(roue, pose), versChaussee, Et.retrait);
    // Profil : le sol de la rue (sa surface d'abord, de gauche à droite), incliné de la pente ; la voiture posée dessus, tournée de
    // la pente autour du point du sol sous son milieu.
    const sol0 = [cx, solY];
    const fenetreProfil = fenetreArrondie(x0, hautProfil, largeur, basProfil - hautProfil, Pr.rayon);
    const surPente = (s, h) => plus(sol0, plus(fois(direction(a), s * E), fois(direction(a - QUART), h * E)));   // s le long, h au-dessus
    const loin = L / E;
    const sol = dansFenetre([surPente(-loin, 0), surPente(loin, 0), surPente(loin, -Pr.epaisseurSol), surPente(-loin, -Pr.epaisseurSol)], fenetreProfil);
    return n("g", { "data-r": `cas-${cas.nom}` },
      texte(x0, baseTitre, cas.titre, { taille: P.titre.taille, graisse: P.titre.graisse, role: `titre-${cas.nom}` }),
      n("g", { "data-r": "plan" },
        n("path", { d: trace(dansFenetre(rectangle(0, 0, L, bordure), fenetre)), fill: TEINTES_ROUTE.chaussee, "data-r": "chaussee" }),
        n("path", { d: trace(dansFenetre(rectangle(0, bordure, L, H), fenetre)), fill: TEINTES_ROUTE.trottoir, "data-r": "trottoir" }),
        voiture,
        texte(x0 + Pl.nom, bordure + (Pl.trottoir * E) / 2 + M.milieuCapitales * CHARTE.tailles.etiquette, "Trottoir", { role: "nom-trottoir" })),
      etiquette({ cible, ancre, lignes: cas.lignes, ancrage: "middle", role: `etiquette-roues-${cas.nom}` }),
      n("g", { "data-r": "vignette-pente" },
        n("path", { d: trace(fenetreProfil), fill: CHARTE.carte, stroke: CHARTE.filet, "stroke-width": CHARTE.traits.fin }),
        n("path", { d: trace(sol), fill: TEINTES_ROUTE.chaussee, "data-r": "sol" }),
        n("g", { "data-r": "pente", "data-angle": a, transform: `rotate(${a} ${sol0[0]} ${sol0[1]})` },
          voitureProfil({ x: sol0[0], y: sol0[1], echelle: E, sens: "droite" }))));
  };
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Deux cas, la même voiture garée le long du trottoir de droite, vue du dessus puis de profil. En descente, l'avant vers "
      + "le bas de la pente : roues avant braquées vers le trottoir. En montée, l'avant vers le haut : roues avant braquées vers la "
      + "chaussée ; si la voiture recule, la roue vient buter contre le trottoir." },
  CAS_PENTE.map((cas, i) => colonne(cas, P.marge + i * (largeur + P.gouttiere))));
}

// ===== Sous-virage et survirage =====
// Deux vignettes l'une sous l'autre, le même virage à gauche, vu du dessus : la voiture le prend dans la voie de droite (à
// l'extérieur), la trajectoire voulue est l'axe de cette voie. Quatre positions de la voiture, tous les `pas` mètres, à partir
// du décrochage : trois estompées, puis la position finale. Le virage est posé en creux (son centre au-dessus) : on y entre en
// haut à gauche, on en sort en haut à droite ; les huit voitures des deux vignettes sont centrées dans chacune. Angles polaires
// autour du centre du virage : CREUX, le point le plus bas, sous le centre ; dans un virage à gauche, le cap vaut l'angle polaire
// moins un quart de tour.
const CREUX = QUART;
const VIRAGE = {
  echelle: 14,              // unités par mètre : une roue fait 9 unités de long, 9,6 px sur un téléphone
  rayonVoie: 16,            // m : axe de la voie de droite, la trajectoire voulue
  angle: 90,                // degrés dont le virage fait tourner la route
  pas: 5.5,                 // m entre deux positions, le long de la trajectoire de la voiture : sa longueur et 1 m d'intervalle
  entree: 20,               // degrés : la première position, avant le creux du virage (angle polaire CREUX + entree)
  // Sous-virage : rayon de la trajectoire de la voiture, en rayons de la trajectoire voulue. Elle la quitte tangentiellement à la
  // première position et tourne trois fois moins qu'elle : elle tire tout droit.
  elargissement: 3,
  braquage: -25,            // degrés : sous-virage, roues avant braquées à gauche, vers l'intérieur
  lacets: [0, 7, 16, 30],   // degrés : survirage, rotation de la caisse au-delà de la tangente, position par position
  opacites: [0.3, 0.45, 0.6, 1],
  marge: 8, rayonPanneau: MISE_EN_PAGE.rayonVignette,
  titre: { taille: CHARTE.tailles.titre, graisse: 600, haut: 0.8, bas: 0.25, ecart: 5 },   // haut et bas en tailles de texte
  entrePanneaux: 8,         // unités entre la première vignette et le titre de la seconde ; la hauteur des vignettes suit le cadre
  pointille: { epaisseur: CHARTE.traits.appuye, pas: 4.5 },
  // Étiquette de la trajectoire voulue (première vignette) : son point sur la trajectoire voulue, au milieu de l'intervalle entre
  // les deux premières positions, que rien ne cache ; son ancre (unités depuis le coin haut gauche de la vignette), son texte
  // centré dessous, dans le coin bas gauche, sur le trottoir extérieur.
  trajectoire: { ancre: [75, 110], taille: CHARTE.tailles.petite },
};

/** Positions de la voiture dans les deux vignettes, en mètres, autour du centre du virage (repère du cadre) : sous-virage, la
 *  voiture quitte la trajectoire voulue tangentiellement à la première position et suit un cercle `elargissement` fois plus
 *  large, la caisse dans l'axe de sa trajectoire ; survirage, son centre reste sur la trajectoire voulue (son écart éventuel n'est
 *  pas dessiné) et la caisse tourne au-delà de la tangente. */
function positionsVirage() {
  const V = VIRAGE, R = V.rayonVoie, s = V.lacets.map((_, k) => k * V.pas);
  const premier = CREUX + V.entree, rayon2 = V.elargissement * R;
  const centre2 = fois(direction(premier), R - rayon2);   // sur le rayon de la première position, au-delà du centre du virage
  const sous = s.map((sk) => { const t = premier - sk / rayon2 / RAD; return { p: polaire(centre2, rayon2, t), cap: t - QUART }; });
  const sur = s.map((sk, k) => { const t = premier - sk / R / RAD; return { p: polaire([0, 0], R, t), cap: t - QUART - V.lacets[k] }; });
  return { premier, sous, sur };
}

function sousSurvirage() {
  const code = "sous-survirage";
  const [L, H] = CATALOGUE[code].cadre;
  const V = VIRAGE, E = V.echelle, T = V.titre;
  const { premier, sous, sur } = positionsVirage();
  const blocTitre = (T.haut + T.bas) * T.taille + T.ecart;
  const hauteurPanneau = (H - 2 * V.marge - 2 * blocTitre - V.entrePanneaux) / 2;
  // Boîte des huit voitures (mètres, autour du centre du virage) : elle fixe la place du centre dans chaque vignette.
  const coins = ({ p, cap }) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) =>
    plus(p, plus(fois(direction(cap), (a * VOITURE.longueur) / 2), fois(direction(cap + QUART), (b * VOITURE.largeur) / 2))));
  const b = boite([...sous, ...sur].flatMap(coins));
  const largeurPanneau = L - 2 * V.marge;
  const vignette = (rang, nom, titre, poses, roues) => {
    const haut = V.marge + (rang + 1) * blocTitre + rang * (hauteurPanneau + V.entrePanneaux);
    const geometrie = { x: V.marge, y: haut, largeur: largeurPanneau, hauteur: hauteurPanneau, rayon: V.rayonPanneau };
    const fenetre = fenetreArrondie(geometrie.x, geometrie.y, geometrie.largeur, geometrie.hauteur, geometrie.rayon);
    const centre = [V.marge + largeurPanneau / 2 - ((b.x1 + b.x2) / 2) * E, haut + hauteurPanneau / 2 - ((b.y1 + b.y2) / 2) * E];
    const axe = (V.rayonVoie - RECOPIE_SCENES.voie / 2) * E, voie = RECOPIE_SCENES.voie * E;
    const route = virageAGauche({ centre, rayon: axe, entree: CREUX + V.angle / 2, sortie: CREUX - V.angle / 2, voie, echelle: E, fenetre,
      fenetreLignes: fenetreRentree(geometrie, V.pointille.epaisseur / 2) });
    const voulue = route.parallele(voie / 2);
    const positions = poses.map(({ p, cap }, k) => n("g", { "data-r": `position-${k + 1}`, ...(V.opacites[k] < 1 ? { opacity: V.opacites[k] } : {}) },
      voitureDessus({ x: centre[0] + p[0] * E, y: centre[1] + p[1] * E, cap, echelle: E, roues, braquage: roues ? V.braquage : 0 })));
    const etiquetteVoulue = rang === 0 && (() => {
      const cible = polaire(centre, V.rayonVoie * E, premier - V.pas / 2 / V.rayonVoie / RAD);
      return etiquette({ cible, ancre: plus([V.marge, haut], V.trajectoire.ancre), lignes: ["Trajectoire voulue"], ancrage: "middle",
        taille: V.trajectoire.taille, role: "etiquette-trajectoire" });
    })();
    return n("g", { "data-r": `vignette-${nom}` },
      texte(V.marge, haut - T.ecart - T.bas * T.taille, titre, { taille: T.taille, graisse: T.graisse, role: `titre-${nom}` }),
      route.noeud,
      pointille(voulue, { couleur: TEINTES_ROUTE.trajet, ...V.pointille, role: "trajectoire-voulue",
        attributs: { "data-cx": centre[0], "data-cy": centre[1], "data-rayon": V.rayonVoie * E, "data-de": CREUX + V.angle / 2,
          "data-a": CREUX - V.angle / 2 } }),
      positions, etiquetteVoulue);
  };
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Le même virage à gauche, deux fois, la trajectoire voulue en pointillé. Sous-virage : le train avant glisse ; roues "
      + "avant braquées, la voiture tire tout droit, élargit et sort de la chaussée, vers l'extérieur du virage. Survirage : le train arrière "
      + "glisse, l'arrière chasse vers l'extérieur, la voiture tourne sur elle-même : amorce du tête-à-queue." },
  vignette(0, "sous-virage", "Sous-virage : le train avant glisse", sous, true),
  vignette(1, "survirage", "Survirage : le train arrière glisse", sur, false));
}

// ===== Regard porté loin =====
// Un virage à gauche, vu du dessus : la voiture à son entrée, dans la voie de droite, cap 0 (avant à droite du cadre) ; le cône
// du regard des scènes vise l'axe de sa voie, loin dans le virage : son axe passe par le milieu de son bord lointain, à
// 22 cos 16 degrés (21,15 m) de l'œil, sur l'axe de la voie.
const REGARD_LOIN = {
  echelle: 11.5,            // unités par mètre
  rayonChaussee: 20,        // m : axe de la chaussée
  angle: 90,                // degrés dont le virage fait tourner la route
  pointille: { epaisseur: CHARTE.traits.appuye, pas: 5 },
  vise: { rayon: 7, trait: CHARTE.traits.moyen, lisere: CHARTE.traits.appuye },   // marque du point visé : 15 px de large sur un téléphone
  // Étiquette du point visé : son ancre (unités du cadre), sur le trottoir intérieur du virage, au-dessus du cône ; le texte
  // finit à sa gauche, le filet part du bord de la marque, de son côté.
  ancre: [212, 26],
};

function regardLoin() {
  const code = "regard-loin";
  const [L, H] = CATALOGUE[code].cadre;
  const RL = REGARD_LOIN, E = RL.echelle, { portee, demiOuverture: ouverture, opacite } = REGARD_SCENES;
  const rVoie = RL.rayonChaussee + RECOPIE_SCENES.voie / 2;   // virage à gauche : la voie de droite est à l'extérieur
  // En mètres, autour du centre du virage : la voiture à l'entrée, sous le centre (angle polaire CREUX), cap 0 ; son œil (kit) ;
  // le point visé, sur l'axe de sa voie, à la distance de l'œil où l'axe du cône rencontre son bord lointain.
  const enMetres = { x: 0, y: rVoie, cap: 0, echelle: 1 };
  const oeilM = reperesDessus(enMetres).oeil, axeCone = portee * Math.cos(ouverture * RAD);
  const angleVise = annuler((t) => axeCone - distance(polaire([0, 0], rVoie, t), oeilM), 0, CREUX);
  const viseM = polaire([0, 0], rVoie, angleVise), visee = angleDe(oeilM, viseM);
  const coneM = [oeilM, plus(oeilM, fois(direction(visee - ouverture), portee)), plus(oeilM, fois(direction(visee + ouverture), portee))];
  const coinsVoiture = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [(a * VOITURE.longueur) / 2, rVoie + (b * VOITURE.largeur) / 2]);
  const b = boite([...coneM, ...coinsVoiture]);
  // Centre du virage dans le cadre : la voiture et le cône centrés.
  const centre = [L / 2 - ((b.x1 + b.x2) / 2) * E, H / 2 - ((b.y1 + b.y2) / 2) * E];
  const versCadre = (p) => plus(centre, fois(p, E));
  const geometrie = { x: 0, y: 0, largeur: L, hauteur: H, rayon: Number(trouverRole(cadre({ largeur: L, hauteur: H, titre: "" }), "fond").attributs.rx) };
  const fenetre = fenetreArrondie(geometrie.x, geometrie.y, geometrie.largeur, geometrie.hauteur, geometrie.rayon);
  const voie = RECOPIE_SCENES.voie * E;
  const route = virageAGauche({ centre, rayon: RL.rayonChaussee * E, entree: CREUX, sortie: CREUX - RL.angle, voie, echelle: E, fenetre,
    fenetreLignes: fenetreRentree(geometrie, RL.pointille.epaisseur / 2) });
  const pose = { x: centre[0], y: centre[1] + rVoie * E, cap: 0, echelle: E };
  const oeil = reperesDessus(pose).oeil, vise = versCadre(viseM);
  const cone = [oeil, ...coneM.slice(1).map((p) => plus(oeil, fois(plus(p, fois(oeilM, -1)), E)))];
  // Trajet prévu, comme dans les scènes : l'axe de la voie, de l'avant de la voiture jusqu'au bord du cadre.
  const axeVoie = route.parallele(voie / 2);
  const trajet = axeVoie.slice(axeVoie.findIndex((q) => q[0] >= pose.x + (VOITURE.longueur / 2) * E));
  const v = RL.vise;
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Un virage à gauche vu du dessus, la voiture à son entrée, dans sa voie. Le cône du regard part de l'œil du conducteur "
      + "et porte loin dans le virage : il vise sa voie, plus de 20 m plus loin, là où il veut aller." },
  route.noeud,
  pointille(trajet, { couleur: TEINTES_ROUTE.trajet, ...RL.pointille, role: "trajet" }),
  n("path", { d: trace(cone), fill: TEINTES_ROUTE.regard, opacity: opacite, "data-r": "regard" }),
  voitureDessus(pose),
  n("g", { "data-r": "point-vise", "data-x": vise[0], "data-y": vise[1] },
    n("circle", { cx: vise[0], cy: vise[1], r: v.rayon, fill: "none", stroke: CHARTE.carte, "stroke-width": v.lisere }),
    n("circle", { cx: vise[0], cy: vise[1], r: v.rayon, fill: "none", stroke: CHARTE.texte, "stroke-width": v.trait })),
  etiquette({ cible: plus(vise, fois(direction(angleDe(vise, RL.ancre)), v.rayon)), ancre: RL.ancre, lignes: ["Là où l'on veut aller"],
    ancrage: "end", role: "etiquette-point-vise" }));
}

// ===== Registre =====
export const DESSINS = {
  "tour-vehicule": tourVehicule,
  "roues-trottoir": rouesTrottoir,
  "sous-survirage": sousSurvirage,
  "regard-loin": regardLoin,
};
export const GESTES = {};
export { versDom } from "./dessin-svg.js?v=20261015c";
