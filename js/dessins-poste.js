/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « poste » : tenir le volant (C1.3), les commandes du poste de conduite (C1.1), les pédales et les
 * pieds (C1.2). Les pièces volant, main et pointHeure servent aussi aux gestes du volant (tâche 7, registre GESTES).
 *
 * Vue du siège : le volant est vu de face, comme le conducteur le voit ; « sens horaire » est celui des aiguilles d'une
 * montre pour lui, et les heures du volant sont celles d'un cadran (12 en haut, 3 à droite). Chaque dimension part d'une
 * mesure en centimètres, ramenée en unités du cadre par l'échelle du dessin : rien n'est placé à l'œil. Les valeurs sans
 * portée réglementaire sont des choix de dessin, recopiés avec leur raison dans sources/dessins-poste.js. Titres et cadres
 * viennent du catalogue des blocs (js/catalogue-blocs.js), la seule source de ces métadonnées.
 */
import { n, trouverRole } from "./dessin-svg.js?v=20261015c";
import { CHARTE, COULEURS_VOYANTS, METRIQUES_POLICE, cadre, texte, etiquette, vignette, fleche, couper, arc, voitureDessus, coord, point as pt, trace }
  from "./dessins-kit.js?v=20261015c";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261015c";
import { interpoler, cles } from "./animation-courbes.js?v=20261015c";

// ===== Teintes de l'habitacle (choix de dessin) =====
// Tons neutres (spec § 3) : plastique sombre des commandes en trois tons (base, reflet, ombre), planche claire, symboles clairs
// sur les commandes ; le symbole des feux de détresse est rouge (règlement ONU n° 121, symbole 6), du rouge normalisé des voyants
// (COULEURS_VOYANTS du kit, celui du dessin « voyants »).
const TEINTES = {
  commande: "#2E3732", commandeReflet: "#56635B", commandeOmbre: "#1D2420",
  colonne: "#3E4843",
  planche: "#E1E6DB", plancheOmbre: "#CBD3C4", console: "#D3DACC",
  symbole: "#EEF2EB",
  metal: "#A9B2A8", metalOmbre: "#7F8A80",
};

// ===== Géométrie de base =====
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const fois = (a, k) => [a[0] * k, a[1] * k];
const moins = (a, b) => [a[0] - b[0], a[1] - b[1]];
const longueur = (a) => Math.hypot(a[0], a[1]);
const unitaire = (a) => fois(a, 1 / longueur(a));
const normale = ([x, y]) => [-y, x];
const PAS_HEURE = Math.PI / 6;           // une heure du cadran, en radians
const HEURES_PAR_TOUR = 12;
const DEGRES_PAR_HEURE = 30;

// Courbe lisse qui passe par chaque point (Catmull-Rom uniforme), en segments de Bézier cubiques [départ, contrôle,
// contrôle, arrivée] ; fermée, elle revient au premier point.
const TENSION = 6;   // 1/6 de la corde entre voisins : la tangente de Catmull-Rom uniforme
function segmentsLisses(points, ferme) {
  const m = points.length;
  const p = (i) => (ferme ? points[(i + m) % m] : points[Math.max(0, Math.min(m - 1, i))]);
  const segments = [];
  for (let i = 0; i < (ferme ? m : m - 1); i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    segments.push([p1, plus(p1, fois(moins(p2, p0), 1 / TENSION)), moins(p2, fois(moins(p3, p1), 1 / TENSION)), p2]);
  }
  return segments;
}
const traceSegments = (segments) => segments.map((s) => `C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`).join(" ");
function cheminLisse(points, ferme = true) {
  const segments = segmentsLisses(points, ferme);
  return `M${pt(points[0])} ${traceSegments(segments)}${ferme ? " Z" : ""}`;
}

// Point d'un segment de Bézier à l'instant t.
function surBezier([a, b, c, d], t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
}
// Contour échantillonné d'une courbe lisse fermée (pour savoir si un point est dedans).
const ECHANTILLONS_SEGMENT = 4;
function contourEchantillonne(segments) {
  return segments.flatMap((s) => Array.from({ length: ECHANTILLONS_SEGMENT }, (_, i) => surBezier(s, i / ECHANTILLONS_SEGMENT)));
}
// Un point dans un polygone quelconque (parité des croisements d'une demi-droite horizontale).
function dedans([x, y], poly) {
  let compte = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) compte = !compte;
  }
  return compte;
}
// Contour entre deux surfaces de même ton (spec § 3) : les morceaux d'une courbe fermée qui passent sur une autre surface,
// et eux seuls, en un tracé ouvert.
function contourSur(segments, autre) {
  const morceaux = [];
  let courant = null;
  for (const s of segments) {
    if (dedans(surBezier(s, 1 / 2), autre)) {
      if (!courant) { courant = [`M${pt(s[0])}`]; morceaux.push(courant); }
      courant.push(`C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`);
    } else courant = null;
  }
  return morceaux.map((m) => m.join(" ")).join(" ") || `M${pt(segments[0][0])}`;
}

// Partie d'un polygone comprise dans le rectangle [x1, y1, x2, y2] (quatre demi-plans, `couper` du kit) : un avant-bras qui
// sort d'une vignette s'arrête à son bord.
const dansRectangle = (poly, [x1, y1, x2, y2]) =>
  [(p) => x1 - p[0], (p) => p[0] - x2, (p) => y1 - p[1], (p) => p[1] - y2].reduce((q, f) => (q.length ? couper(q, f) : q), poly);

// ===== Volant =====

/** Point de la jante (ou d'un cercle de même centre) à une heure du cadran : 12 en haut, 3 à droite, sens horaire. */
export function pointHeure(cx, cy, rayon, heure) {
  const a = heure * PAS_HEURE;
  return [cx + rayon * Math.sin(a), cy - rayon * Math.cos(a)];
}

// Volant d'une voiture particulière, vu de face, en centimètres : ligne médiane de la jante (37 cm de diamètre), épaisseur
// de la jante, moyeu (le coussin de l'airbag, où est l'avertisseur), branches de 3 h et 9 h, branche de 6 h plus large.
// Reflets (lumière venue d'en haut à gauche, qui ne tourne pas avec le volant) : un trait moyen de la charte, de 9 h 40 à
// 11 h 20 sur la moitié intérieure de la jante, de 9 h 30 à 11 h 30 au bord du moyeu.
const VOLANT = {
  rayon: 18.5, jante: 3.4, moyeu: 6.6,
  branche: { moyeu: 5.6, jante: 4.4, depart: 3.0 },
  brancheBas: { moyeu: 6.4, jante: 4.8, depart: 3.0 },
  reflet: { debut: 9.67, fin: 11.33, decalage: -0.75 },
  refletMoyeu: { debut: 9.5, fin: 11.5, decalage: -0.6 },
};
/** Épaisseur de la jante vue de face, en fraction du rayon de sa ligne médiane. */
export const EPAISSEUR_JANTE = VOLANT.jante / VOLANT.rayon;

// Klaxon normalisé (règlement ONU n° 121, symbole 29) : l'embouchure, le tube, le pavillon qui s'évase vers la droite et
// l'ellipse de son ouverture ; abscisses et demi-hauteurs en fraction de sa longueur (6 cm), centré sur le moyeu.
const AVERTISSEUR = {
  longueur: 6.0, gauche: -0.5,
  embouchure: { largeur: 0.07, demi: 0.16 }, tube: { fin: -0.08, demi: 0.06 }, pavillon: { fin: 0.3, demi: 0.3 },
  ouverture: { centre: 0.34, rx: 0.14, ry: 0.31, epaisseur: 0.08 },
};

function arcHeures(cx, cy, rayon, debut, fin) {
  const [a, b] = [pointHeure(cx, cy, rayon, debut), pointHeure(cx, cy, rayon, fin)];
  const grand = (fin - debut) * DEGRES_PAR_HEURE > 180 ? 1 : 0;
  return `M${pt(a)} A${coord(rayon)} ${coord(rayon)} 0 ${grand} 1 ${pt(b)}`;
}
// Anneau plein entre deux cercles de même centre (la jante) : une surface, pas un trait épais hors du jeu de la charte.
function anneau(cx, cy, exterieur, interieur) {
  const cercle = (r) => `M${pt([cx - r, cy])} A${coord(r)} ${coord(r)} 0 1 0 ${pt([cx + r, cy])} A${coord(r)} ${coord(r)} 0 1 0 ${pt([cx - r, cy])} Z`;
  return `${cercle(exterieur)} ${cercle(interieur)}`;
}

/** Volant vu du conducteur : jante, trois branches à 3 h, 6 h et 9 h tournées de `angle` degrés (sens horaire positif),
 *  moyeu. Le groupe porte le centre (data-x, data-y), le rayon de la ligne médiane de la jante (data-rayon) et l'angle
 *  (data-angle). Les branches et le moyeu tournent autour du centre (groupe « volant-tournant », avec le klaxon) ; la jante
 *  et les reflets ne tournent pas (un cercle reste un cercle, la lumière ne tourne pas). `avertisseur` : le pictogramme du
 *  klaxon sur le moyeu, qui prend alors le rôle « avertisseur » et sa boîte. */
export function volant({ cx, cy, rayon, angle = 0, role = "volant", avertisseur = false }) {
  const k = rayon / VOLANT.rayon;
  const centre = [cx, cy], e = EPAISSEUR_JANTE * rayon;
  const branche = (heure, { moyeu, jante, depart }) => {
    const a = heure * PAS_HEURE;
    const d = [Math.sin(a), -Math.cos(a)], p = normale(d);
    const [r0, r1] = [depart * k, rayon];
    const points = [
      plus(plus(centre, fois(d, r0)), fois(p, (moyeu * k) / 2)), plus(plus(centre, fois(d, r1)), fois(p, (jante * k) / 2)),
      plus(plus(centre, fois(d, r1)), fois(p, (-jante * k) / 2)), plus(plus(centre, fois(d, r0)), fois(p, (-moyeu * k) / 2)),
    ];
    const vrai = (((heure * DEGRES_PAR_HEURE + angle) % 360) + 360) % 360;
    // Repère : le bout de la branche sur la ligne médiane de la jante, tourné avec le volant (unités du cadre).
    const [bx, by] = pointHeure(cx, cy, rayon, heure + angle / DEGRES_PAR_HEURE);
    return n("path", { d: trace(points), fill: TEINTES.commande, "data-r": `branche-${heure}`, "data-angle": vrai, "data-x": bx, "data-y": by });
  };
  const rMoyeu = VOLANT.moyeu * k;
  const moyeu = n("g", avertisseur
    ? { "data-r": "avertisseur", "data-x": cx, "data-y": cy, "data-largeur": 2 * rMoyeu, "data-hauteur": 2 * rMoyeu }
    : { "data-r": "moyeu" },
  n("circle", { cx, cy, r: rMoyeu, fill: TEINTES.commande }),
  avertisseur ? pictoAvertisseur(cx, cy, AVERTISSEUR.longueur * k, TEINTES.commande) : null);
  const reflet = (r, { debut, fin }, roleReflet) => n("path", { d: arcHeures(cx, cy, r, debut, fin), fill: "none",
    stroke: TEINTES.commandeReflet, "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round", "data-r": roleReflet });
  return n("g", { "data-r": role, "data-x": cx, "data-y": cy, "data-rayon": rayon, "data-angle": angle },
    n("g", { "data-r": "volant-tournant", transform: `rotate(${angle} ${cx} ${cy})` },
      branche(3, VOLANT.branche), branche(9, VOLANT.branche), branche(6, VOLANT.brancheBas), moyeu),
    reflet(rMoyeu + VOLANT.refletMoyeu.decalage * k, VOLANT.refletMoyeu, "reflet-moyeu"),
    n("path", { d: anneau(cx, cy, rayon + e / 2, rayon - e / 2), fill: TEINTES.commande, "fill-rule": "evenodd", "data-r": "jante" }),
    reflet(rayon + VOLANT.reflet.decalage * k, VOLANT.reflet, "reflet-jante"));
}

// Le klaxon en plein, sur le fond `fond` (celui du moyeu, qui fait le creux de l'ouverture).
function pictoAvertisseur(cx, cy, longueur, fond) {
  const a = AVERTISSEUR, x = (f) => cx + f * longueur, h = (f) => f * longueur;
  const bord = a.gauche + a.embouchure.largeur;
  const haut = [[x(a.gauche), h(a.embouchure.demi)], [x(bord), h(a.embouchure.demi)], [x(bord), h(a.tube.demi)],
    [x(a.tube.fin), h(a.tube.demi)], [x(a.pavillon.fin), h(a.pavillon.demi)]];
  const corps = [...haut.map(([px, dy]) => [px, cy - dy]), ...[...haut].reverse().map(([px, dy]) => [px, cy + dy])];
  const o = a.ouverture;
  return n("g", { "data-r": "pictogramme-avertisseur" },
    n("path", { d: trace(corps), fill: TEINTES.symbole }),
    n("ellipse", { cx: x(o.centre), cy, rx: h(o.rx), ry: h(o.ry), fill: TEINTES.symbole }),
    n("ellipse", { cx: x(o.centre), cy, rx: h(o.rx - o.epaisseur), ry: h(o.ry - o.epaisseur), fill: fond }));
}

// ===== Main sur la jante =====
// Repère de la jante, en centimètres : s le long de la ligne médiane de la jante, compté vers le pouce ; ρ (rho) en travers,
// compté vers l'extérieur du volant. Main gauche à 9 h : s monte, ρ va vers la gauche. La prise (cours C1.3, fiche ECF C1-C,
// thème 44) : la main entoure la jante ; vue du siège, le dos de la main en couvre la moitié extérieure, les doigts passent
// derrière elle et reviennent par son bord intérieur sur sa face avant, le pouce est posé le long de la jante. Engagé, le
// pouce passe à l'intérieur de la jante, autour de la branche. Dimensions d'une main adulte.
const MAIN = {
  // Dos de la main : contour lissé, de l'index (s positif) à l'auriculaire ; il couvre la moitié extérieure de la jante.
  dos: [[3.6, 1.5], [3.0, 3.9], [1.0, 4.7], [-2.0, 4.6], [-3.9, 3.9], [-4.6, 2.2], [-4.1, 0.3], [-2.0, -0.15], [1.0, -0.2], [3.0, 0.2]],
  // Doigts, de l'index à l'auriculaire : place le long de la jante, largeur, et longueur dépliée relative (le majeur est le
  // plus long, l'auriculaire le plus court) ; ils se chevauchent un peu, un pli les sépare.
  doigts: [{ s: 2.45, largeur: 1.95, longueur: 0.95 }, { s: 0.6, largeur: 2.0, longueur: 1.05 }, { s: -1.3, largeur: 1.95, longueur: 1 },
    { s: -3.1, largeur: 1.7, longueur: 0.85 }],
  // Doigt refermé (prise 1) : il déborde du bord intérieur de la jante de 1,2 cm et revient sur sa face avant jusqu'à 0,15 cm
  // au-delà de la ligne médiane ; forme d'un rectangle à coins ronds (superellipse d'exposant 3). Doigts entrouverts (prise
  // `glisse`, 0,5 : la jante glisse dans la main) : dépliés, ils sortent de derrière la jante par son bord intérieur, qui
  // les coupe net, et le dépassent de `depasse` cm (fois leur longueur relative), côtés droits (exposant `cotes`), bout
  // arrondi (exposant `bout`) ; la jante se voit entre eux et le dos de la main. Entre ces deux prises, ils se déplient
  // continûment : leur bout extérieur quitte la face avant de la jante (coupé `recouvre` cm avant son extrémité, ce qui
  // passe derrière), leur bout intérieur s'allonge vers le centre. Main lâchée (prise 0) : main ouverte, écartée de la jante,
  // doigts tendus devant elle, de `ouverte.longueur` cm (fois leur longueur relative) au-delà du bord du dos de la main, où
  // ils commencent `ouverte.recouvre` cm sous lui. Entre la prise `glisse` et 0, leur base suit le bord du dos de la main, et
  // ils passent de derrière la jante à devant elle au début du lâcher, sur la part `passage` de la plage (la coupe va du bord
  // intérieur de la jante à leur base) : passés plus lentement, ils restaient plusieurs images détachés de la main, la jante
  // entre eux et le dos de la main. `points` : points du contour d'un doigt. Entrouverts, ils dépassent la jante de 5 cm :
  // plus courts (4,4 cm), ils se lisaient comme des perles posées à son bord.
  doigt: { debord: 1.2, bout: 0.15, exposant: 3, points: 32, glisse: 0.5, depasse: 5.0, recouvre: 1.0, passage: 0.4,
    ouvert: { bout: 2.4, cotes: 4 }, ouverte: { longueur: 6.8, recouvre: 0.6 } },
  // Pouce : axe de la base au bout (centre de l'arrondi), largeur à la base et au bout. Main qui lâche (prise sous
  // `doigt.glisse`) : il quitte la jante et se pose le long de l'index, comme dans une main ouverte et détendue (`ouvert`, plus
  // court que posé sur la jante, et un peu écarté de l'index) ; son axe s'interpole sur toute la plage du lâcher. Posé le long
  // de la jante sur une main ouverte, il se lisait comme un pouce levé (main droite à 3 h) ou baissé (main gauche à 3 h).
  pouce: {
    jante: [[1.4, 1.3], [4.0, 0.35], [6.8, 0.05]],
    interieur: [[2.0, 1.2], [3.3, -1.2], [2.1, -4.1]],
    ouvert: [[3.0, 1.3], [4.2, -0.7], [4.8, -2.8]],
    base: 2.15, bout: 1.75, points: 9,
  },
  // Poignet : il quitte la main par son bord tourné vers le coude, à `rayon` cm du centre de la main (repère de la jante) :
  // à 9 h et à 3 h, coude en bas, sous le dos de la main (-2,4 et 2,6) ; main à midi, au-dessous de la jante, l'avant-bras
  // descendant devant le volant. Puis sa largeur, la longueur de peau avant la manche, son départ sous la main. L'avant-bras
  // passe devant la jante et devant les doigts, mais sous le dos de la main, qui le prolonge : voir construireMain.
  poignet: { centre: [-0.5, 2.5], rayon: 1.9, largeur: 3.8, peau: 3.6, recul: 1.5 },
  // Manche : largeur vers le coude, longueur du revers (bande plus sombre au bord de la manche).
  manche: { coude: 6.0, revers: 1.1 },
  // Main qui relâche : elle s'écarte de la jante, de 0 (prise 1) à 3,2 cm (prise 0, main ouverte) : le dos de la main, qui
  // couvre la jante jusqu'à 0,2 cm au-delà de sa ligne médiane, en est alors à 1,3 cm, et la jante se voit tout entière.
  ouverture: 3.2,
};
// Bord intérieur du dos de la main (repère de la jante, main refermée) : là où commencent les doigts tendus d'une main ouverte.
const BORD_DOS = Math.min(...MAIN.dos.map((p) => p[1]));
// Lâcher d'une main, de 0 (elle tient ou laisse glisser la jante, prise d'au moins `glisse`) à 1 (lâchée, prise 0) ; et ses
// doigts devant la jante, de 0 (derrière elle) à 1 (tout entiers devant), au début du lâcher (MAIN.doigt.passage).
const lacher = (prise) => Math.min(1, Math.max(0, 1 - prise / MAIN.doigt.glisse));
const doigtsDevant = (prise) => Math.min(1, lacher(prise) / MAIN.doigt.passage);
// Coupe de l'avant-bras, en traits fins au-delà du point du dos de la main le plus avancé vers le coude : le demi-trait du pli
// de ce bord, son bout arrondi et le flou de son bord (le contour du dos de la main est lu en points échantillonnés).
const MARGE_COUPE = 1.5;
// Écart à la couture de la peau et de la manche en deçà duquel un sommet de la peau de l'avant-bras est sur elle (unités) : ses
// deux sommets y sont posés par le calcul, au bruit près.
const COUTURE_JEU = 1e-6;
const COTES = { gauche: 1, droite: -1 };   // sens du pouce : horaire pour la main gauche, inverse pour la droite
const POUCES = ["jante", "interieur"];
// Teintes de la manche (un tissu neutre, deux tons).
const MANCHE = { tissu: "#7E8B81", revers: "#66736A" };

function connu(valeur, permises, quoi) {
  if (!permises.includes(valeur)) throw new Error(`Main : ${quoi} « ${valeur} » inconnu : ${permises.map((v) => `« ${v} »`).join(", ")} attendu.`);
  return valeur;
}

// Pouce : contour en centimètres du repère de la jante, le long d'un axe courbe (Bézier quadratique qui passe par les trois
// points), de largeur décroissante, arrondi aux deux bouts.
const ARRONDI = [Math.PI / 4, 0, -Math.PI / 4];
function contourPouce(axe, base, bout, nombre) {
  const [p0, p1, p2] = axe;
  const c = moins(fois(p1, 2), fois(plus(p0, p2), 1 / 2));
  const point = (t) => plus(plus(fois(p0, (1 - t) * (1 - t)), fois(c, 2 * t * (1 - t))), fois(p2, t * t));
  const tangente = (t) => unitaire(plus(fois(moins(c, p0), 2 * (1 - t)), fois(moins(p2, c), 2 * t)));
  const gauche = [], droite = [];
  for (let i = 0; i <= nombre; i++) {
    const t = i / nombre, demi = (base + (bout - base) * t) / 2;
    const nrm = normale(tangente(t));
    gauche.push(plus(point(t), fois(nrm, demi)));
    droite.push(plus(point(t), fois(nrm, -demi)));
  }
  const arrondi = (centre, dir, demi) => {
    const nrm = normale(dir);
    return ARRONDI.map((a) => plus(centre, plus(fois(dir, demi * Math.cos(a)), fois(nrm, demi * Math.sin(a)))));
  };
  return [...gauche, ...arrondi(p2, tangente(1), bout / 2), ...droite.reverse(), ...arrondi(p0, fois(tangente(0), -1), base / 2)];
}

// Quadrilatère d'une portion d'avant-bras, de `a` à `b`, de largeurs la et lb.
function troncon(a, b, la, lb) {
  const nrm = normale(unitaire(moins(b, a)));
  return [plus(a, fois(nrm, la / 2)), plus(b, fois(nrm, lb / 2)), plus(b, fois(nrm, -lb / 2)), plus(a, fois(nrm, -la / 2))];
}
const traceOuPoint = (points, repli) => (points.length >= 3 ? trace(points) : `M${pt(repli)}`);

/** Contour d'un doigt, en centimètres du repère de la jante, selon la prise (MAIN.doigt) : `s` et `largeur` le placent le
 *  long de la jante, `longueur` est sa longueur dépliée relative. Deux bouts de superellipse (le bout intérieur, le bout
 *  extérieur), chacun de sa demi-hauteur et de son exposant, reliés par des côtés droits ; refermé, les deux bouts ont le
 *  même centre (la superellipse entière). Le tout est coupé par la droite ρ = coupe : ce qui est au-delà passe derrière la
 *  jante. */
function contourDoigt({ s, largeur, longueur: relative }, prise) {
  const bord = -VOLANT.jante / 2, d = MAIN.doigt, o = d.ouvert, a = largeur / 2;
  // Trois états clés : refermé (prise 1), entrouvert (prise d.glisse), lâché (prise 0) ; entre deux, tout s'interpole.
  const entrouvert = { interieur: bord - d.depasse * relative, exterieur: bord + d.recouvre, coupe: bord, base: o.cotes };
  let interieur, exterieur, coupe, base;
  if (prise >= d.glisse) {
    const u = (prise - d.glisse) / (1 - d.glisse);   // 0 : entrouvert ; 1 : refermé
    interieur = interpoler(entrouvert.interieur, bord - d.debord, u);
    exterieur = interpoler(entrouvert.exterieur, d.bout, u);
    coupe = exterieur - (1 - u) * d.recouvre;
    base = interpoler(o.cotes, d.exposant, u);
  } else {
    const v = prise / d.glisse;                       // 0 : lâché ; 1 : entrouvert
    const pied = BORD_DOS + MAIN.ouverture;           // bord du dos de la main ouverte, écartée de la jante
    interieur = interpoler(pied - d.ouverte.longueur * relative, entrouvert.interieur, v);
    // Leur base suit le bord du dos de la main, qui s'écarte de la jante (derrière la jante, elle ne se voit pas) ; la coupe va du
    // bord intérieur de la jante à cette base pendant qu'ils passent devant elle.
    exterieur = BORD_DOS + (1 - prise) * MAIN.ouverture + d.ouverte.recouvre;
    coupe = interpoler(entrouvert.coupe, exterieur, doigtsDevant(prise));
    base = interpoler(d.exposant, o.cotes, v);
  }
  const u = Math.min(1, Math.max(0, (prise - d.glisse) / (1 - d.glisse)));
  const demi = (exterieur - interieur) / 2;
  const hauteur = Math.max(Math.min(interpoler(a, demi, u), demi), Number.EPSILON);   // demi-hauteur de chaque bout
  const bouts = [   // [centre, exposant] : extérieur (sinus positif), intérieur
    [exterieur - hauteur, base],
    [interieur + hauteur, interpoler(o.bout, d.exposant, u)],
  ];
  const points = Array.from({ length: d.points }, (_, i) => {
    const t = (2 * Math.PI * i) / d.points, c = Math.cos(t), si = Math.sin(t);
    const [centre, e] = bouts[si < 0 ? 1 : 0];
    return [s + a * Math.sign(c) * Math.abs(c) ** (2 / e), centre + hauteur * Math.sign(si) * Math.abs(si) ** (2 / e)];
  });
  const coupes = couper(points, (p) => p[1] - coupe);
  return coupes.length >= 3 ? coupes : [[s - a, coupe], [s + a, coupe], [s, coupe - Number.EPSILON]];
}

// Centre de surface de polygones de même orientation (leurs centres, pondérés par leur aire) : il glisse continûment quand la
// coupe d'un doigt avance, là où la moyenne des points de leurs contours sauterait dès qu'un groupe de points est découvert.
// Sans surface, la moyenne de leurs points.
function centreSurface(polygones) {
  let [aire, sx, sy] = [0, 0, 0];
  for (const p of polygones) {
    p.forEach(([x0, y0], i) => {
      const [x1, y1] = p[(i + 1) % p.length], c = x0 * y1 - x1 * y0;
      aire += c; sx += (x0 + x1) * c; sy += (y0 + y1) * c;
    });
  }
  if (Math.abs(aire) > SURFACE_MIN) return [sx / (3 * aire), sy / (3 * aire)];
  const points = polygones.flat();
  return [0, 1].map((i) => points.reduce((somme, q) => somme + q[i], 0) / points.length);
}
const SURFACE_MIN = 1e-9;   // deux fois l'aire, en unités carrées : en deçà, des polygones sans surface

// Côtés d'un polygone en segments de Bézier droits d'au plus PAS_COTE unités : contourSur juge chaque segment par son milieu,
// un long côté droit se borde donc au plus près morceau par morceau.
const PAS_COTE = 2;
function segmentsCote(a, b) {
  const nombre = Math.max(1, Math.ceil(longueur(moins(b, a)) / PAS_COTE));
  return Array.from({ length: nombre }, (_, j) => {
    const [p, q] = [j / nombre, (j + 1) / nombre].map((t) => plus(a, fois(moins(b, a), t)));
    return [p, plus(p, fois(moins(q, p), 1 / 3)), plus(p, fois(moins(q, p), 2 / 3)), q];
  });
}
function segmentsDroits(poly) {
  return poly.flatMap((a, i) => segmentsCote(a, poly[(i + 1) % poly.length]));
}
// Contour de chaque courbe fermée de `listes` là où elle passe sur l'un des `polygones` (une autre surface du même ton), en un
// tracé ; `repli` quand il n'y a rien à border (le nœud reste, une animation ne change que ses attributs).
function contoursSur(listes, polygones, repli) {
  const morceaux = listes.flatMap((segments) => polygones.map((poly) => contourSur(segments, poly)))
    .filter((trace) => /C/.test(trace));
  return morceaux.length ? morceaux.join(" ") : `M${pt(repli)}`;
}

/** Main posée sur la jante d'un volant de centre (cx, cy) et de rayon `rayon` (ligne médiane de la jante), à `heure` (12 en
 *  haut, 3 à droite). `cote` : « gauche » ou « droite » (le pouce file dans le sens horaire pour la main gauche, en sens
 *  inverse pour la droite : les deux mains sont en miroir). `prise` : de 0 (main ouverte, écartée de la jante, doigts tendus
 *  devant elle, le pouce posé le long de l'index) à 1 (main refermée, les doigts repliés sur la face avant de la jante), en
 *  passant par 0,5 (doigts entrouverts, sortis de derrière la jante par son bord intérieur : la jante glisse dans la main).
 *  `pouce` : « jante » (posé le long de la jante) ou « interieur » (engagé à l'intérieur de la jante), tant que la main tient
 *  ou glisse.
 *  `avantBras` : { coude: [x, y], limite: [x1, y1, x2, y2] } ajoute l'avant-bras (poignet, puis manche) du poignet vers le
 *  coude, coupé au rectangle `limite` : il passe sous le dos de la main et devant les doigts. `deplacement` : [dx, dy], la main en l'air, déplacée d'un bloc (le coude reste en
 *  place). `dessous` : { peau, manche }, les surfaces d'une autre main que celle-ci recouvre (construireMain les rend) : un
 *  contour sépare alors deux surfaces de même ton. Rôles : main-<cote> (point de prise sur la ligne médiane de la jante,
 *  déplacement compris, data-x et data-y), pouce-<cote> (centre de l'arrondi du bout du pouce), doigts-<cote> (centre de la
 *  surface visible des doigts), poignet-<cote> (la peau du poignet sous le dos de la main), avant-bras-<cote> (le reste de l'avant-bras, sa
 *  manche comprise ; repère : le poignet), doigts-devant-<cote> (les doigts redessinés devant l'avant-bras, main ouverte). Mêmes nœuds quelles que soient l'heure, la prise, le pouce, le côté et le
 *  déplacement : une animation ne fait que changer leurs attributs. */
export function main(options) {
  return construireMain(options).noeud;
}

/** La main (voir main) et ses surfaces : { noeud, surfaces: { peau, manche } }, les polygones de sa peau et de sa manche, à
 *  passer en `dessous` à une main qui la recouvre. */
function construireMain({ cx, cy, rayon, heure, cote, prise = 1, pouce = "jante", avantBras = null, deplacement = [0, 0], dessous = null }) {
  const sens = COTES[connu(cote, Object.keys(COTES), "côté")];
  connu(pouce, POUCES, "pouce");
  if (!Number.isFinite(heure)) throw new Error(`Main : heure « ${heure} » non finie.`);
  if (!(prise >= 0 && prise <= 1)) throw new Error(`Main : prise « ${prise} » hors de 0 à 1.`);
  if (!(Array.isArray(deplacement) && deplacement.length === 2 && deplacement.every(Number.isFinite))) {
    throw new Error(`Main : déplacement « ${deplacement} » invalide, [dx, dy] attendu.`);
  }
  const k = rayon / VOLANT.rayon;
  const ecart = (1 - prise) * MAIN.ouverture;
  const local = ([s, r]) => plus(pointHeure(cx, cy, rayon + r * k, heure + (sens * s * k * HEURES_PAR_TOUR) / (2 * Math.PI * rayon)), deplacement);
  const decale = ([s, r]) => local([s, r + ecart]);

  // Dos de la main, et la surface qu'il couvre (pour poser les plis entre deux surfaces de peau).
  const dos = MAIN.dos.map(decale);
  const segmentsDos = segmentsLisses(dos, true);
  const surfaces = [contourEchantillonne(segmentsDos)];

  // Avant-bras : la peau du poignet, puis la manche et son revers. Le poignet part du bord de la main tourné vers le coude
  // (direction du coude lue dans le repère de la jante, depuis le centre de la main). L'avant-bras passe devant la jante et
  // devant les doigts, mais sous le dos de la main, qui le prolonge : sa peau se coupe au-delà du point du dos de la main le
  // plus avancé vers le coude, d'un trait fin (le pli du bord du dos de la main, centré sur ce bord, reste entier) ; la partie
  // d'avant la coupe passe sous le dos de la main, le reste et la manche passent sur les doigts, en reprenant la première sur
  // un demi-trait fin (pas de jour entre les deux).
  let bras = null;
  if (avantBras) {
    const { poignet: p, manche: mc } = MAIN;
    const a = heure * PAS_HEURE, dehors = [Math.sin(a), -Math.cos(a)], long = fois([Math.cos(a), Math.sin(a)], sens);
    const vers = unitaire(moins(avantBras.coude, decale(p.centre)));
    const w = decale(plus(p.centre, fois([vers[0] * long[0] + vers[1] * long[1], vers[0] * dehors[0] + vers[1] * dehors[1]], p.rayon)));
    const axe = unitaire(moins(avantBras.coude, w));
    const point = (d) => plus(w, fois(axe, d * k));   // à d cm du poignet, vers le coude
    const total = longueur(moins(avantBras.coude, w)) / k;
    const largeurA = (dist) => (p.largeur + ((mc.coude - p.largeur) * dist) / total) * k;   // la manche s'élargit vers le coude
    // Peau du poignet, de `recul` cm sous la main jusqu'à la manche, sa largeur passant de celle du poignet à celle de la manche.
    const largeurPeau = (d) => interpoler(p.largeur * k, largeurA(p.peau), (d + p.recul) / (p.recul + p.peau));
    const tronconPeau = (de, jusqua) => dansRectangle(troncon(point(de), point(jusqua), largeurPeau(de), largeurPeau(jusqua)), avantBras.limite);
    const avancee = Math.max(...surfaces[0].map((q) => ((q[0] - w[0]) * axe[0] + (q[1] - w[1]) * axe[1]) / k));
    const [marge, reprise] = [MARGE_COUPE * CHARTE.traits.fin / k, CHARTE.traits.fin / 2 / k];   // en centimètres
    const coupe = Math.min(avancee + marge + reprise, p.peau);
    const peauSous = tronconPeau(-p.recul, coupe), peauDessus = tronconPeau(coupe - reprise, p.peau);
    const manche = dansRectangle(troncon(point(p.peau), avantBras.coude, largeurA(p.peau), mc.coude * k), avantBras.limite);
    const revers = dansRectangle(troncon(point(p.peau), point(p.peau + mc.revers), largeurA(p.peau), largeurA(p.peau + mc.revers)), avantBras.limite);
    bras = { w, peauSous, peauDessus, manche, revers, couture: { point: point(p.peau), axe },
      pli: peauSous.length >= 3 ? contourSur(segmentsDos, peauSous) : `M${pt(dos[0])}` };
    if (peauSous.length >= 3) surfaces.push(peauSous);
  }

  // Doigts, de l'auriculaire à l'index (chacun pose son pli sur le précédent, sur le dos de la main et sur le poignet).
  const doigts = [...MAIN.doigts].reverse().map((doigt) => {
    const forme = contourDoigt(doigt, prise).map(local);
    const segments = segmentsDroits(forme);
    const sous = [...surfaces];   // ce qu'il recouvre
    const plis = sous.map((surface) => contourSur(segments, surface)).join(" ");
    surfaces.push(forme);
    return { trace: trace(forme), plis, segments, forme, sous };
  });
  // Repère des doigts : le centre de leur surface visible.
  const milieuDoigts = centreSurface(doigts.map((x) => x.forme));
  // L'avant-bras posé sur les doigts : un pli là où sa peau passe sur la leur, côté par côté, sauf sur sa couture avec la
  // manche (d'un autre ton, les doigts continuent dessous). Main lâchée (prise sous MAIN.doigt.glisse), ses doigts tendus
  // devant la jante passent aussi devant son avant-bras : les mêmes doigts, redessinés par-dessus lui, opaques tant qu'ils sont
  // tout entiers devant la jante, effacés dès qu'ils sont derrière elle (`devant`, un fondu pendant qu'ils passent de l'un à
  // l'autre), leurs plis posés aussi sur l'avant-bras.
  let plisBras = null, plisDevant = null;
  const devant = doigtsDevant(prise);
  if (bras) {
    const { point: c, axe } = bras.couture, q = bras.peauDessus;
    const surCouture = (p) => Math.abs((p[0] - c[0]) * axe[0] + (p[1] - c[1]) * axe[1]) < COUTURE_JEU;
    const cotes = q.length >= 3 ? q.map((a, i) => [a, q[(i + 1) % q.length]]).filter(([a, b]) => !(surCouture(a) && surCouture(b))) : [];
    plisBras = contoursSur(cotes.map(([a, b]) => segmentsCote(a, b)), doigts.map((x) => x.forme), bras.w);
    const dessousDevant = q.length >= 3 ? [q] : [];
    plisDevant = doigts.map((x) => [...x.sous, ...dessousDevant].map((surface) => contourSur(x.segments, surface)).join(" "));
    if (q.length >= 3) surfaces.push(q);
  }

  // Pouce, posé sur tout ce qui précède. La main qui lâche (prise sous MAIN.doigt.glisse) l'amène le long de l'index, sur toute
  // la plage du lâcher.
  const axePouce = MAIN.pouce[pouce].map((p, i) => [0, 1].map((k) => interpoler(p[k], MAIN.pouce.ouvert[i][k], lacher(prise))));
  const formePouce = contourPouce(axePouce, MAIN.pouce.base, MAIN.pouce.bout, MAIN.pouce.points).map(decale);
  const segmentsPouce = segmentsLisses(formePouce, true);
  const plisPouce = surfaces.map((surface) => contourSur(segmentsPouce, surface)).join(" ");
  const boutPouce = decale(axePouce[2]);
  const prisePoint = local([0, 0]);

  const peau = { fill: CHARTE.peau };
  const pli = { fill: "none", stroke: CHARTE.peauOmbre, "stroke-width": CHARTE.traits.fin, "stroke-linecap": "round", "stroke-linejoin": "round" };
  // Sur une autre main (`dessous`) : le contour de chaque surface de celle-ci là où elle passe sur une surface de même ton de
  // l'autre, posé juste après elle (ce qui la recouvre dans cette main le recouvre aussi).
  const sur = (listes, polygones, repli) => n("path", { d: contoursSur(listes, polygones, repli), ...pli, "data-r": `contour-peau-${cote}` });
  const surManche = (listes, repli) => n("path", { d: contoursSur(listes, dessous.manche, repli), ...pli, stroke: MANCHE.revers,
    "data-r": `contour-manche-${cote}` });
  const surPeau = (poly) => (poly.length >= 3 ? [segmentsDroits(poly)] : []);
  // De dessous à dessus : la peau du poignet sous le dos de la main, le dos de la main, les doigts, le reste de l'avant-bras
  // (peau et manche, qui passent devant les doigts), les doigts redessinés devant lui (main ouverte), le pouce.
  const noeud = n("g", { "data-r": `main-${cote}`, "data-x": prisePoint[0], "data-y": prisePoint[1], "data-heure": heure, "data-prise": prise },
    bras ? n("g", { "data-r": `poignet-${cote}` },
      n("path", { d: traceOuPoint(bras.peauSous, bras.w), ...peau }),
      dessous ? sur(surPeau(bras.peauSous), dessous.peau, bras.w) : null) : null,
    n("path", { d: `M${pt(dos[0])} ${traceSegments(segmentsDos)} Z`, ...peau, "data-r": `dos-${cote}` }),
    dessous ? sur([segmentsDos], dessous.peau, dos[0]) : null,
    bras ? n("path", { d: bras.pli, ...pli }) : null,
    n("g", { "data-r": `doigts-${cote}`, "data-x": milieuDoigts[0], "data-y": milieuDoigts[1] },
      doigts.map((x) => n("g", {}, n("path", { d: x.trace, ...peau }), n("path", { d: x.plis, ...pli }),
        dessous ? sur([x.segments], dessous.peau, x.forme[0]) : null))),
    bras ? n("g", { "data-r": `avant-bras-${cote}`, "data-x": bras.w[0], "data-y": bras.w[1] },
      n("g", { "data-r": `manche-${cote}` },
        n("path", { d: traceOuPoint(bras.manche, bras.w), fill: MANCHE.tissu }),
        n("path", { d: traceOuPoint(bras.revers, bras.w), fill: MANCHE.revers }),
        dessous ? surManche([bras.manche, bras.revers].filter((q) => q.length >= 3).map(segmentsDroits), bras.w) : null),
      n("path", { d: traceOuPoint(bras.peauDessus, bras.w), ...peau }),
      n("path", { d: plisBras, ...pli, "data-r": `pli-avant-bras-${cote}` }),
      dessous ? sur(surPeau(bras.peauDessus), dessous.peau, bras.w) : null) : null,
    bras ? n("g", { "data-r": `doigts-devant-${cote}`, opacity: devant },
      doigts.map((x, i) => n("g", {}, n("path", { d: x.trace, ...peau }), n("path", { d: plisDevant[i], ...pli }),
        dessous ? sur([x.segments], dessous.peau, x.forme[0]) : null))) : null,
    n("g", { "data-r": `pouce-${cote}`, "data-x": boutPouce[0], "data-y": boutPouce[1] },
      n("path", { d: `M${pt(formePouce[0])} ${traceSegments(segmentsPouce)} Z`, ...peau }),
      n("path", { d: plisPouce, ...pli }),
      dessous ? sur([segmentsPouce], dessous.peau, formePouce[0]) : null));
  const surfacesPeau = [surfaces[0], ...(bras ? [bras.peauSous, bras.peauDessus].filter((q) => q.length >= 3) : []),
    ...doigts.map((x) => x.forme), contourEchantillonne(segmentsPouce)];
  return { noeud, surfaces: { peau: surfacesPeau, manche: bras ? [bras.manche, bras.revers].filter((q) => q.length >= 3) : [] } };
}

// ===== Dessin 1 : tenir le volant (C1.3) =====
// Deux vignettes côte à côte, la légende de chacune écrite dessous. Échelle : 2,7 unités par centimètre (un volant de 37 cm
// fait 100 unités, 107 px sur un téléphone). Avant-bras coupés au bord de la vignette, sous son filet.
const MAINS_VOLANT = {
  echelle: 2.7, marge: 8, gouttiere: 8, bandeLegende: 26, hautPastille: 36, degagement: 7,
  // Coudes : 30 cm sous le centre du volant, 4 cm plus à l'extérieur que la ligne médiane de la jante (l'avant-bras sort
  // de la vignette par son bord bas, jamais par un coin).
  coude: { dessous: 30, dehors: 4 },
  legende: { taille: 11, base: 15 },
  // Anneau qui désigne le pouce engagé, lu sur son repère (le bout du pouce, rôle pouce-gauche) : centré 1,9 cm plus loin
  // du centre du volant que ce bout, donc sur la partie du pouce passée à l'intérieur de la jante ; 3,5 cm de rayon.
  anneau: { versJante: 1.9, rayon: 3.5 },
};

function mainsVolant() {
  const code = "mains-volant";
  const [L, H] = CATALOGUE[code].cadre;
  const m = MAINS_VOLANT, k = m.echelle;
  const carte = { largeur: (L - 2 * m.marge - m.gouttiere) / 2, hauteur: H - m.marge - m.bandeLegende };
  const rayon = VOLANT.rayon * k, e = EPAISSEUR_JANTE * rayon;
  const vignetteMains = (x, etat, pouce, legende) => {
    const cx = x + carte.largeur / 2, cy = m.marge + m.hautPastille + m.degagement + rayon + e / 2;
    const bord = CHARTE.traits.fin / 2;   // l'avant-bras passe sous le filet de la carte, qui reste entier
    const limite = [x + bord, m.marge + bord, x + carte.largeur - bord, m.marge + carte.hauteur - bord];
    const coude = (cote) => [cx + COTES[cote] * -1 * (rayon + m.coude.dehors * k), cy + m.coude.dessous * k];
    const mainDe = (cote, heure, sonPouce) => main({ cx, cy, rayon, heure, cote, pouce: sonPouce, avantBras: { coude: coude(cote), limite } });
    const gauche = mainDe("gauche", 9, pouce);
    let cercle = null;
    if (pouce === "interieur") {
      const repere = trouverRole(gauche, "pouce-gauche").attributs, bout = [repere["data-x"], repere["data-y"]];
      const [ax, ay] = plus(bout, fois(unitaire(moins(bout, [cx, cy])), m.anneau.versJante * k));
      cercle = n("g", { "data-r": "anneau-pouce", "data-x": ax, "data-y": ay, "data-rayon": m.anneau.rayon * k },
        n("circle", { cx: ax, cy: ay, r: m.anneau.rayon * k, fill: "none", stroke: CHARTE.carte, "stroke-width": CHARTE.traits.moyen + 2 * CHARTE.liseres }),
        n("circle", { cx: ax, cy: ay, r: m.anneau.rayon * k, fill: "none", stroke: CHARTE.faux, "stroke-width": CHARTE.traits.moyen }));
    }
    return vignette({ x, y: m.marge, largeur: carte.largeur, hauteur: carte.hauteur, etat },
      volant({ cx, cy, rayon }),
      gauche, mainDe("droite", 3, "jante"),
      cercle,
      texte(cx, m.marge + carte.hauteur + m.legende.base, legende, { taille: m.legende.taille, ancrage: "middle", role: `legende-${etat}` }));
  };
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Juste : mains à 9 h et 3 h, ou 10 h 10, les pouces posés le long de la jante. Faux : le pouce gauche engagé à l'intérieur de la jante, autour de la branche." },
  vignetteMains(m.marge, "juste", "jante", "9 h et 3 h, ou 10 h 10"),
  vignetteMains(m.marge + carte.largeur + m.gouttiere, "faux", "interieur", "Pouce engagé dans la jante"));
}

// ===== Pictogrammes normalisés des commandes =====
// Formes du règlement ONU n° 121 (identification des commandes, témoins et indicateurs), tableau 1, « en substance identiques
// à l'ISO 2575:2004 » (note 2 du tableau) : feux de détresse (symbole 6, deux triangles l'un dans l'autre), dégivrage et
// désembuage du pare-brise (17 : le pare-brise et trois flèches ondulées), de la lunette arrière (18 : la lunette et trois
// flèches ondulées), climatisation (33 : le flocon), ventilateur du chauffage et de la climatisation (39 : l'hélice à quatre
// pales, pleines comme le permet la note 1). Proportions en fraction de la taille du pictogramme.
const HEURE_DROITE = 3, ANGLE_ENTRE_PALES = 90;   // l'axe des x du cadre pointe vers 3 h ; quatre pales
const PICTO = {
  detresse: { interieur: 0.42 },
  ondulee: { amplitude: 0.055, tete: { longueur: 0.17, largeur: 0.2 }, ecart: 0.21 },
  pareBrise: { bas: 0.62, bombeHaut: 0.12, bombeBas: 0.08, hauteur: 0.62 },
  lunette: { hauteur: 0.6, rayon: 0.13, talon: 0.16 },
  helice: { centre: 0.55, longueur: 0.44, largeur: 0.25, vrille: 20, moyeu: 0.17 },
  flocon: { bras: 6, premier: 90, branche: 0.62, longueurBranche: 0.3, ouverture: 40 },
};

function pictoDetresse(x, y, t) {
  const triangle = (c) => {
    const h = (c * Math.sqrt(3)) / 2;
    return [[x, y - (2 * h) / 3], [x + c / 2, y + h / 3], [x - c / 2, y + h / 3]];
  };
  const trait = { fill: "none", stroke: COULEURS_VOYANTS.rouge, "stroke-width": CHARTE.traits.moyen };
  return [n("path", { d: trace(triangle(t)), ...trait }), n("path", { d: trace(triangle(t * PICTO.detresse.interieur)), ...trait })];
}

// Flèche ondulée qui monte de yBas à yHaut (une période de sinusoïde), tête pleine.
const ECHANTILLONS_ONDE = 12;
function flecheOndulee(x, yBas, yHaut, t) {
  const o = PICTO.ondulee, finTige = yHaut + o.tete.longueur * t;
  const points = Array.from({ length: ECHANTILLONS_ONDE + 1 }, (_, i) => {
    const u = i / ECHANTILLONS_ONDE;
    return [x + o.amplitude * t * Math.sin(2 * Math.PI * u), yBas + (finTige - yBas) * u];
  });
  const demi = (o.tete.largeur * t) / 2;
  return [
    n("path", { d: trace(points, false), fill: "none", stroke: TEINTES.symbole, "stroke-width": CHARTE.traits.fin, "stroke-linejoin": "round" }),
    n("path", { d: trace([[x, yHaut], [x + demi, finTige], [x - demi, finTige]]), fill: TEINTES.symbole }),
  ];
}
const troisFleches = (x, yBas, yHaut, t) => [-1, 0, 1].map((i) => flecheOndulee(x + i * PICTO.ondulee.ecart * t, yBas, yHaut, t));

function pictoPareBrise(x, y, t) {
  const p = PICTO.pareBrise, h = p.hauteur * t, haut = y - h / 2, bas = y + h / 2;
  const [g, d] = [x - t / 2, x + t / 2], [gb, db] = [x - (p.bas * t) / 2, x + (p.bas * t) / 2];
  const contour = `M${pt([g, haut])} Q${pt([x, haut - 2 * p.bombeHaut * t])} ${pt([d, haut])} L${pt([db, bas])} Q${pt([x, bas - 2 * p.bombeBas * t])} ${pt([gb, bas])} Z`;
  return [n("path", { d: contour, fill: "none", stroke: TEINTES.symbole, "stroke-width": CHARTE.traits.moyen, "stroke-linejoin": "round" }),
    troisFleches(x, bas + p.bombeBas * t * 2, haut + p.bombeHaut * t, t)];
}

function pictoLunette(x, y, t) {
  const p = PICTO.lunette, h = p.hauteur * t, haut = y - h / 2, bas = y + h / 2, r = p.rayon * t;
  const [g, d] = [x - t / 2, x + t / 2], talon = p.talon * t;
  const contour = `M${pt([g + talon, bas])} L${pt([g + r, bas])} A${coord(r)} ${coord(r)} 0 0 1 ${pt([g, bas - r])} L${pt([g, haut + r])}`
    + ` A${coord(r)} ${coord(r)} 0 0 1 ${pt([g + r, haut])} L${pt([d - r, haut])} A${coord(r)} ${coord(r)} 0 0 1 ${pt([d, haut + r])}`
    + ` L${pt([d, bas - r])} A${coord(r)} ${coord(r)} 0 0 1 ${pt([d - r, bas])} L${pt([d - talon, bas])}`;
  return [n("path", { d: contour, fill: "none", stroke: TEINTES.symbole, "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    troisFleches(x, bas + r, haut + r, t)];
}

function pictoHelice(x, y, t, fond) {
  const p = PICTO.helice, r = t / 2;
  const pales = Array.from({ length: 360 / ANGLE_ENTRE_PALES }, (_, i) => i * ANGLE_ENTRE_PALES).map((a) => {
    const rad = ((a + p.vrille) * Math.PI) / 180;
    const [px, py] = [x + p.centre * r * Math.cos(rad), y + p.centre * r * Math.sin(rad)];
    return n("ellipse", { cx: px, cy: py, rx: p.longueur * r, ry: p.largeur * r, fill: TEINTES.symbole,
      transform: `rotate(${a + p.vrille} ${coord(px)} ${coord(py)})` });
  });
  return [...pales, n("circle", { cx: x, cy: y, r: p.moyeu * r, fill: fond })];
}

function pictoFlocon(x, y, t) {
  const p = PICTO.flocon, r = t / 2;
  const fin = { fill: "none", stroke: TEINTES.symbole, "stroke-linecap": "round" };
  const angles = Array.from({ length: p.bras }, (_, i) => p.premier + (360 * i) / p.bras);   // un bras tous les 60 degrés
  const bras = angles.slice(0, p.bras / 2).map((a) => {
    const [dx, dy] = [r * Math.cos((a * Math.PI) / 180), -r * Math.sin((a * Math.PI) / 180)];
    return `M${pt([x - dx, y - dy])} L${pt([x + dx, y + dy])}`;
  }).join(" ");
  const branches = angles.map((a) => {
    const u = [Math.cos((a * Math.PI) / 180), -Math.sin((a * Math.PI) / 180)];
    const depart = [x + u[0] * p.branche * r, y + u[1] * p.branche * r];
    return [-1, 1].map((s) => {
      const b = ((a + s * p.ouverture) * Math.PI) / 180;
      return `M${pt(depart)} L${pt([depart[0] + Math.cos(b) * p.longueurBranche * r, depart[1] - Math.sin(b) * p.longueurBranche * r])}`;
    }).join(" ");
  }).join(" ");
  return [n("path", { d: bras, ...fin, "stroke-width": CHARTE.traits.moyen }), n("path", { d: branches, ...fin, "stroke-width": CHARTE.traits.fin })];
}

// Boîte d'un élément désigné par une étiquette (data-x, data-y : centre ; data-largeur, data-hauteur).
const boite = (x, y, largeur, hauteur) => ({ "data-x": x, "data-y": y, "data-largeur": largeur, "data-hauteur": hauteur });
function boiteDe(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return boite((x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1);
}

// ===== Dessin 2 : les commandes du poste de conduite (C1.1) =====
// Le poste vu du siège, dans la disposition la plus courante (elle varie selon les modèles) : le volant et ses deux commodos,
// l'avertisseur au centre du volant, le contacteur à droite de la colonne de direction ; au centre de la planche, le bouton
// des feux de détresse, puis les commandes de ventilation, de désembuage et de climatisation ; entre les sièges, le frein de
// stationnement. Plan schématique : le volant, sa colonne, ses commodos et le contacteur sont à l'échelle (2,6 unités par
// centimètre) ; la console centrale est placée à sa place relative courante, ses commandes à la taille qui garde leurs
// pictogrammes lisibles sur un téléphone.
const POSTE = {
  echelle: 2.6,
  volant: { cx: 96, cy: 116 },
  planche: { x1: 4, y1: 50, x2: 228, y2: 104, rayon: 10 },
  console: { x1: 188, x2: 228, rayon: 8 },
  // Colonne de direction (son carénage, derrière le volant), en centimètres depuis le centre du volant.
  colonne: { largeur: 13, haut: -4, bas: 11.5, rayon: 3 },
  // Commodo gauche (le droit en miroir), en centimètres depuis le centre du volant : du carénage au bout, à 29,2 cm du
  // centre et 2,2 cm au-dessus, soit 9,1 cm au-delà du bord de la jante ; tige, bague au bout (commande tournante), rainures.
  commodo: { base: [-7, 0], bout: [-29.2, -2.2], tige: 2.0, bague: 2.8, longueurBague: 5.0, rainures: [0.3, 0.7] },
  // Contacteur à droite de la colonne, vu par l'ouverture du volant entre 3 h et 6 h : centre, collerette, cœur, fente.
  contacteur: { centre: [6.6, 7.6], rayon: 2.5, coeur: 1.6, fente: 2.3, largeurFente: 0.55, angleFente: -30 },
  boutons: { x: 208, largeur: 30, hauteur: 19, rayon: 4, picto: 16, cible: 2.5 },
  detresse: { y: 62, picto: 13 },
  ventilation: { y: 93, rayon: 11.5, picto: 16 },
  desembuage: { avant: 123, arriere: 147 },
  climatisation: { y: 171, picto: 13 },
  // Frein de stationnement (levier, vu d'au-dessus), entre les sièges.
  // Levier entre les sièges, vu d'au-dessus : son bout avant (vers la planche, en haut) porte la poignée et le bouton de
  // déverrouillage ; son pivot, sous le soufflet, est à l'arrière (vers le siège, en bas).
  frein: { x: 208, avant: 192, arriere: 233, largeur: 6, poignee: 22, largeurPoignee: 8, bouton: 2.6, cible: 2,
    soufflet: { largeur: 14, hauteur: 9 } },
  etiquettes: { taille: 11, colonneDroite: 230, commodoGauche: [40, 44], commodoDroit: [140, 44], avertisseur: [40, 192],
    contacteur: [128, 192], mention: [8, 232], ciblePosteVolant: 0.55 },
};

function posteCommandes() {
  const code = "poste-commandes";
  const [L, H] = CATALOGUE[code].cadre;
  const p = POSTE, k = p.echelle;
  const { cx, cy } = p.volant;
  const rayon = VOLANT.rayon * k;
  const cm = ([x, y]) => [cx + x * k, cy + y * k];   // centimètres depuis le centre du volant vers le cadre
  const miroir = ([x, y]) => [-x, y];
  const b = p.boutons, t = p.etiquettes.taille;

  // Planche, console centrale (jusqu'en bas du cadre) et carénage de la colonne.
  const planche = n("g", { "data-r": "planche" },
    n("rect", { x: p.planche.x1, y: p.planche.y1, width: p.planche.x2 - p.planche.x1, height: p.planche.y2 - p.planche.y1, rx: p.planche.rayon, fill: TEINTES.planche }),
    n("rect", { x: p.console.x1, y: p.planche.y1, width: p.console.x2 - p.console.x1, height: H - p.planche.y1 + p.console.rayon, rx: p.console.rayon, fill: TEINTES.console }));
  const col = p.colonne;
  const colonne = n("rect", { x: cx - (col.largeur * k) / 2, y: cy + col.haut * k, width: col.largeur * k, height: (col.bas - col.haut) * k, rx: col.rayon * k,
    fill: TEINTES.colonne, "data-r": "colonne" });

  // Commodos : tige, bague et rainures ; la boîte de l'élément est celle de la bague, ce que l'étiquette désigne.
  const commodo = (cote) => {
    const c = p.commodo, sym = cote === "gauche" ? (q) => q : miroir;
    const [base, bout] = [cm(sym(c.base)), cm(sym(c.bout))];
    const axe = unitaire(moins(bout, base));
    const debutBague = moins(bout, fois(axe, c.longueurBague * k));
    const bague = troncon(debutBague, bout, c.bague * k, c.bague * k);
    const rainures = c.rainures.map((f) => {
      const centre = plus(debutBague, fois(axe, f * c.longueurBague * k)), nrm = normale(axe);
      return `M${pt(plus(centre, fois(nrm, (c.bague * k) / 2)))} L${pt(plus(centre, fois(nrm, (-c.bague * k) / 2)))}`;
    }).join(" ");
    return n("g", { "data-r": `commodo-${cote}`, ...boiteDe(bague) },
      n("path", { d: trace(troncon(base, debutBague, c.tige * k, c.tige * k)), fill: TEINTES.colonne }),
      n("path", { d: trace(bague), fill: TEINTES.commande, stroke: TEINTES.commande, "stroke-width": CHARTE.traits.fin, "stroke-linejoin": "round" }),
      n("path", { d: rainures, fill: "none", stroke: TEINTES.commandeReflet, "stroke-width": CHARTE.traits.fin }));
  };

  // Contacteur : collerette métallique, cœur sombre, fente de la clé.
  const ct = p.contacteur, [kx, ky] = cm(ct.centre);
  const fente = troncon(...[-1, 1].map((s) => [kx + s * Math.cos((ct.angleFente * Math.PI) / 180) * (ct.fente * k) / 2,
    ky + s * Math.sin((ct.angleFente * Math.PI) / 180) * (ct.fente * k) / 2]), ct.largeurFente * k, ct.largeurFente * k);
  const contacteur = n("g", { "data-r": "contacteur", ...boite(kx, ky, 2 * ct.rayon * k, 2 * ct.rayon * k) },
    n("circle", { cx: kx, cy: ky, r: ct.rayon * k, fill: TEINTES.metal }),
    n("circle", { cx: kx, cy: ky, r: ct.coeur * k, fill: TEINTES.commande }),
    n("path", { d: trace(fente), fill: TEINTES.metal, "data-r": "fente", "data-epaisseur": ct.largeurFente * k,
      "data-x1": (fente[0][0] + fente[3][0]) / 2, "data-y1": (fente[0][1] + fente[3][1]) / 2,
      "data-x2": (fente[1][0] + fente[2][0]) / 2, "data-y2": (fente[1][1] + fente[2][1]) / 2 }));

  // Commandes de la console centrale : un bouton, son pictogramme.
  const bouton = (y, role, ...picto) => n("g", { "data-r": role, ...boite(b.x, y, b.largeur, b.hauteur) },
    n("rect", { x: b.x - b.largeur / 2, y: y - b.hauteur / 2, width: b.largeur, height: b.hauteur, rx: b.rayon, fill: TEINTES.commande }),
    ...picto);
  const v = p.ventilation;
  const ventilation = n("g", { "data-r": "ventilation", ...boite(b.x, v.y, 2 * v.rayon, 2 * v.rayon) },
    n("circle", { cx: b.x, cy: v.y, r: v.rayon, fill: TEINTES.commande }),
    pictoHelice(b.x, v.y, v.picto, TEINTES.commande));
  const desembuage = n("g", { "data-r": "desembuage" },
    bouton(p.desembuage.avant, "desembuage-avant", pictoPareBrise(b.x, p.desembuage.avant, b.picto)),
    bouton(p.desembuage.arriere, "desembuage-arriere", pictoLunette(b.x, p.desembuage.arriere, b.picto)));

  // Frein de stationnement : soufflet du pivot à l'arrière, levier, poignée et bouton de déverrouillage à l'avant.
  const f = p.frein;
  const frein = n("g", { "data-r": "frein-stationnement", ...boite(f.x, (f.avant + f.arriere) / 2, f.largeurPoignee, f.arriere - f.avant) },
    n("rect", { x: f.x - f.soufflet.largeur / 2, y: f.arriere - f.soufflet.hauteur / 2, width: f.soufflet.largeur, height: f.soufflet.hauteur,
      rx: f.soufflet.hauteur / 2, fill: TEINTES.commandeOmbre, "data-r": "soufflet" }),
    n("rect", { x: f.x - f.largeur / 2, y: f.avant, width: f.largeur, height: f.arriere - f.avant, rx: f.largeur / 2, fill: TEINTES.commande }),
    n("rect", { x: f.x - f.largeurPoignee / 2, y: f.avant, width: f.largeurPoignee, height: f.poignee, rx: f.largeurPoignee / 2, fill: TEINTES.commandeReflet,
      "data-r": "poignee" }),
    n("circle", { cx: f.x, cy: f.avant + f.largeurPoignee / 2, r: f.bouton, fill: TEINTES.metal, "data-r": "bouton-deverrouillage" }));

  // Étiquettes : les mots du cours ; à droite de la console, en colonne ; les autres au-dessus ou au-dessous de leur commande.
  const e = p.etiquettes, droite = e.colonneDroite;
  const bordBouton = b.x + b.largeur / 2 - b.cible;   // le point de l'étiquette, à droite du pictogramme
  const lab = (role, cible, ancre, lignes, ancrage = "start") => etiquette({ cible, ancre, lignes, ancrage, taille: t, role: `etiquette-${role}` });
  // Le point de l'étiquette de la ventilation se pose entre deux pales, du côté de l'étiquette (3 h) : à la moitié de l'angle
  // entre deux pales avant la première, en heures du cadran.
  const heureEntrePales = HEURE_DROITE + (PICTO.helice.vrille - ANGLE_ENTRE_PALES / 2) / DEGRES_PAR_HEURE;
  const centreBague = (role) => [Number(commodos[role].attributs["data-x"]), Number(commodos[role].attributs["data-y"])];
  const commodos = { "commodo-gauche": commodo("gauche"), "commodo-droit": commodo("droit") };
  const rMoyeu = VOLANT.moyeu * k;
  const cibleAvertisseur = [cx - e.ciblePosteVolant * rMoyeu, cy + e.ciblePosteVolant * rMoyeu];
  const etiquettes = [
    lab("commodo-gauche", centreBague("commodo-gauche"), e.commodoGauche, ["Feux et", "clignotants"], "middle"),
    lab("commodo-droit", centreBague("commodo-droit"), e.commodoDroit, ["Essuie-glaces", "et lave-glace"], "middle"),
    lab("avertisseur", cibleAvertisseur, e.avertisseur, ["Avertisseur"], "middle"),
    lab("contacteur", plus([kx, ky], fois(unitaire(moins(e.contacteur, [kx, ky])), ((ct.rayon + ct.coeur) / 2) * k)), e.contacteur, ["Contacteur"], "middle"),
    lab("feux-detresse", [bordBouton, p.detresse.y], [droite, p.detresse.y], ["Feux de", "détresse"]),
    lab("ventilation", pointHeure(b.x, v.y, v.rayon - b.cible, heureEntrePales), [droite, v.y], ["Ventilation"]),
    n("g", { "data-r": "etiquette-desembuage" },
      etiquette({ cible: [bordBouton, p.desembuage.avant], ancre: [droite, (p.desembuage.avant + p.desembuage.arriere) / 2], lignes: ["Désembuage"], taille: t }),
      etiquette({ cible: [bordBouton, p.desembuage.arriere], ancre: [droite, (p.desembuage.avant + p.desembuage.arriere) / 2], lignes: [], taille: t })),
    lab("climatisation", [bordBouton, p.climatisation.y], [droite, p.climatisation.y], ["Climatisation"]),
    lab("frein-stationnement", [f.x + f.largeurPoignee / 2 - f.cible, f.avant + f.poignee / 2], [droite, f.avant + f.poignee / 2], ["Frein de", "stationnement"]),
  ];

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Vu du siège, disposition la plus courante : le commodo gauche commande les feux et les clignotants, le droit les essuie-glaces et le lave-glace ; l'avertisseur est au centre du volant, le contacteur à droite de la colonne ; au centre de la planche, les feux de détresse, la ventilation, le désembuage et la climatisation ; entre les sièges, le frein de stationnement." },
  planche, colonne, commodos["commodo-gauche"], commodos["commodo-droit"], contacteur,
  volant({ cx, cy, rayon, avertisseur: true }),
  bouton(p.detresse.y, "feux-detresse", pictoDetresse(b.x, p.detresse.y, p.detresse.picto)),
  ventilation, desembuage,
  bouton(p.climatisation.y, "climatisation", pictoFlocon(b.x, p.climatisation.y, p.climatisation.picto)),
  frein,
  etiquettes,
  texte(e.mention[0], e.mention[1], "Disposition la plus courante", { taille: t, couleur: CHARTE.texteDoux, role: "mention" }));
}

// ===== Dessin 3 : les pédales et les pieds (C1.2) =====
// Le pédalier vu du siège : de gauche à droite l'embrayage, le frein, l'accélérateur, suspendus (leurs bras montent sous la
// planche, hors du cadre). Pied gauche sur l'embrayage, pied droit sur le frein, son talon posé entre le frein et
// l'accélérateur, d'où il pivote vers l'accélérateur (flèche). Échelle : 3,2 unités par centimètre. Mesures en centimètres
// depuis le centre de l'embrayage (x vers la droite) et le haut du cadre (y vers le bas, vers le siège).
const PEDALES = {
  echelle: 3.2, origine: [112, 8],
  // Centre des patins, largeur et hauteur ; l'accélérateur, plus étroit et plus long, descend un peu plus bas.
  embrayage: { x: 0, y: 19.5, largeur: 7, hauteur: 6.5 },
  frein: { x: 16, y: 19.5, largeur: 8, hauteur: 6.5 },
  accelerateur: { x: 30, y: 21, largeur: 5, hauteur: 11 },
  bras: 1.6, rainures: 3, rayonPatin: 1.1,
  // Chaussures : le bout à mi-hauteur du patin (le haut du patin reste visible), le talon au sol ; longueur vue du siège
  // (inclinée du talon au patin, une chaussure paraît plus courte qu'à plat), largeur au plus large ; appui : là où la
  // semelle presse le patin, 1,5 cm derrière le bout.
  // Inclinaison de chaque chaussure (degrés, du bout vers le talon, comptée vers la droite) : le talon gauche un peu à
  // l'extérieur, le talon droit posé entre le frein et l'accélérateur (à 21,5 cm de l'embrayage), d'où le pied pivote.
  chaussure: { longueur: 25, largeur: 10, semelle: 0.5, appui: 1.5 },
  inclinaison: { gauche: -2.3, droit: 12.7 },
  // Flèche du pied droit : un arc centré sur le talon droit, du frein vers l'accélérateur ; elle part à côté du bras du
  // frein et finit à côté de celui de l'accélérateur, au-dessus de son patin, son axe à 1,4 cm de chacun (son liseré, de
  // 0,8 cm de demi-largeur, ne les touche pas).
  pivot: { jeu: 1.4 },
  // Étiquettes : taille, écart (cm) entre l'objet et le bout du filet, ancre de « Frein » (cm), point de la chaussure désigné,
  // ligne de base de la règle du cours au-dessus du bas du cadre (unités).
  etiquettes: { taille: 11, ecart: 2.4, frein: [8.5, 9.0], cibleChaussure: [0.3, 0.55], regleBas: 16 },
};
const CHAUSSURE = { dessus: "#3A4540", semelle: "#232A26", reflet: "#5A675F", lacets: "#6E7B72" };
const PEDALIER = { patin: "#2B322E", rainure: "#4C5852", bras: "#6E7A70" };

// Contour d'une chaussure vue de dessus, bout vers le haut, en fractions de sa longueur (y, du bout au talon) et de sa largeur
// (x, positif côté extérieur du pied) : le bord intérieur, côté du gros orteil, est le plus droit. Puis les lacets (quatre
// traits clairs en travers, au milieu) et le reflet du bout.
const SEMELLE = [[0.05, 0], [0.4, 0.05], [0.5, 0.2], [0.43, 0.42], [0.36, 0.62], [0.38, 0.82], [0.24, 0.97], [0, 1],
  [-0.24, 0.97], [-0.36, 0.82], [-0.33, 0.62], [-0.45, 0.4], [-0.47, 0.2], [-0.34, 0.05]];
const LACETS = { debut: 0.3, fin: 0.6, nombre: 4, largeur: 0.34 };
const REFLET_BOUT = [[0.32, 0.1], [0.1, 0.05], [-0.15, 0.07]];

function pedales() {
  const code = "pedales";
  const [L, H] = CATALOGUE[code].cadre;
  const p = PEDALES, k = p.echelle;
  const cm = ([x, y]) => [p.origine[0] + x * k, p.origine[1] + y * k];
  const t = p.etiquettes.taille;
  // Talon d'une chaussure : à sa longueur de son bout, posé à mi-hauteur du patin, selon son inclinaison.
  const talonDe = (cote) => {
    const q = p[cote === "gauche" ? "embrayage" : "frein"], a = (p.inclinaison[cote] * Math.PI) / 180;
    return [q.x + p.chaussure.longueur * Math.sin(a), q.y + p.chaussure.longueur * Math.cos(a)];
  };

  // Une pédale : bras qui monte sous la planche, patin et ses rainures ; la boîte de l'élément est celle du patin.
  const pedale = (role) => {
    const q = p[role], [x, y] = cm([q.x, q.y]), [l, h] = [q.largeur * k, q.hauteur * k];
    const rainures = Array.from({ length: p.rainures }, (_, i) => {
      const yy = y - h / 2 + ((i + 1) * h) / (p.rainures + 1);
      return `M${pt([x - l / 2 + p.rayonPatin * k, yy])} L${pt([x + l / 2 - p.rayonPatin * k, yy])}`;
    }).join(" ");
    return n("g", { "data-r": role, ...boite(x, y, l, h) },
      n("rect", { x: x - (p.bras * k) / 2, y: 0, width: p.bras * k, height: y, fill: PEDALIER.bras, "data-r": "bras" }),
      n("rect", { x: x - l / 2, y: y - h / 2, width: l, height: h, rx: p.rayonPatin * k, fill: PEDALIER.patin, "data-r": "patin" }),
      n("path", { d: rainures, fill: "none", stroke: PEDALIER.rainure, "stroke-width": CHARTE.traits.fin, "stroke-linecap": "round" }));
  };

  // Un pied : la chaussure, de son bout posé sur le patin à son talon au sol. Point de référence (data-x, data-y) : l'appui de
  // la semelle sur le patin ; `cible` : un point de la chaussure, côté extérieur, que désigne son étiquette.
  const pied = (cote, pedaleSous) => {
    const c = p.chaussure, q = p[pedaleSous], sens = cote === "gauche" ? 1 : -1;   // côté extérieur : à gauche pour le pied gauche
    const bout = [q.x, q.y], talon = talonDe(cote);
    const axe = unitaire(moins(talon, bout)), nrm = normale(axe);
    const longueurAxe = longueur(moins(talon, bout));
    // Repère de la chaussure (fx en largeurs, côté extérieur positif ; fy en longueurs, du bout au talon) vers le cadre.
    const versCadre = ([fx, fy]) => cm(plus(plus(bout, fois(axe, fy * longueurAxe)), fois(nrm, sens * fx * c.largeur)));
    const dessus = SEMELLE.map(versCadre);
    const marge = c.semelle / c.largeur, margeL = c.semelle / longueurAxe;
    const semelle = SEMELLE.map(([fx, fy]) => versCadre([fx * (1 + 2 * marge), fy * (1 + 2 * margeL) - margeL]));
    const lacets = Array.from({ length: LACETS.nombre }, (_, i) => {
      const fy = LACETS.debut + ((LACETS.fin - LACETS.debut) * i) / (LACETS.nombre - 1);
      return `M${pt(versCadre([-LACETS.largeur / 2, fy]))} L${pt(versCadre([LACETS.largeur / 2, fy]))}`;
    }).join(" ");
    const appui = cm(plus(bout, fois(axe, c.appui)));
    return {
      cible: versCadre(p.etiquettes.cibleChaussure), contour: dessus,
      noeud: n("g", { "data-r": `pied-${cote}`, "data-x": appui[0], "data-y": appui[1] },
        n("path", { d: cheminLisse(semelle), fill: CHAUSSURE.semelle }),
        n("path", { d: cheminLisse(dessus), fill: CHAUSSURE.dessus }),
        n("path", { d: lacets, fill: "none", stroke: CHAUSSURE.lacets, "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round" }),
        n("path", { d: cheminLisse(REFLET_BOUT.map(versCadre), false), fill: "none", stroke: CHAUSSURE.reflet, "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round" })),
    };
  };
  const gauche = pied("gauche", "embrayage"), droit = pied("droit", "frein");

  // Flèche du pied droit : arc centré sur le talon droit, du frein à l'accélérateur.
  const [tx, ty] = cm(talonDe("droit"));
  const ecartBras = (p.bras / 2 + p.pivot.jeu) * k;
  const fin = [cm([p.accelerateur.x, 0])[0] - ecartBras, cm([0, p.accelerateur.y - p.accelerateur.hauteur / 2 - p.pivot.jeu])[1]];
  const rayon = Math.hypot(fin[0] - tx, fin[1] - ty);
  const angleDe = (x) => (Math.asin((x - tx) / rayon) * 180) / Math.PI - 90;   // angle du kit (degrés, sens horaire depuis 3 h)
  const trajet = arc([tx, ty], rayon, angleDe(cm([p.frein.x, 0])[0] + ecartBras), angleDe(fin[0]));
  const [depart, arrivee] = [trajet[0], trajet[trajet.length - 1]];
  const pivot = n("g", { "data-r": "pivot", "data-x1": depart[0], "data-y1": depart[1], "data-x2": arrivee[0], "data-y2": arrivee[1] },
    fleche(trajet));

  // Étiquettes : chaque pédale, chaque pied, puis la règle du cours.
  const e = p.etiquettes, ecart = e.ecart * k;
  const coinPatin = (role, cote) => {   // un point du patin, dans son quart haut, du côté demandé (-1 gauche, 1 droite)
    const q = p[role], [x, y] = cm([q.x, q.y]);
    return [x + (cote * q.largeur * k) / 4, y - (q.hauteur * k) / 4];
  };
  const bordPatin = (role, cote) => p[role].x * k + p.origine[0] + (cote * p[role].largeur * k) / 2;
  const lab = (role, cible, ancre, lignes, ancrage) => etiquette({ cible, ancre, lignes, ancrage, taille: t, role: `etiquette-${role}` });
  const [cibleEmb, cibleFrein, cibleAcc] = [coinPatin("embrayage", -1), coinPatin("frein", -1), coinPatin("accelerateur", 1)];
  const bordChaussure = (pied, cote) => {   // abscisse du bord extérieur de la chaussure (la semelle comprise)
    const xs = pied.contour.map((q) => q[0]);
    return cote < 0 ? Math.min(...xs) - p.chaussure.semelle * k : Math.max(...xs) + p.chaussure.semelle * k;
  };
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Vu du siège, de gauche à droite : embrayage, frein, accélérateur. Pied gauche sur l'embrayage, pied droit sur le frein, prêt à pivoter vers l'accélérateur. Jamais deux pieds sur la même pédale." },
  pedale("embrayage"), pedale("frein"), pedale("accelerateur"),
  gauche.noeud, droit.noeud,
  pivot,
  lab("embrayage", cibleEmb, [bordPatin("embrayage", -1) - ecart, cibleEmb[1]], ["Embrayage"], "end"),
  lab("frein", cibleFrein, cm(e.frein), ["Frein"], "middle"),
  lab("accelerateur", cibleAcc, [bordPatin("accelerateur", 1) + ecart, cibleAcc[1]], ["Accélérateur"], "start"),
  lab("pied-gauche", gauche.cible, [bordChaussure(gauche, -1) - ecart, gauche.cible[1]], ["Pied gauche"], "end"),
  lab("pied-droit", droit.cible, [bordChaussure(droit, 1) + ecart, droit.cible[1]], ["Pied droit"], "start"),
  texte(L / 2, H - e.regleBas, "Jamais deux pieds sur la même pédale", { taille: t, ancrage: "middle", role: "regle" }));
}

// ===== Gestes du volant (C1.3) : tirer-glisser, chevauchement, retour du volant =====
// Le volant vu du siège, comme dans « mains-volant », à plus grande échelle, les deux avant-bras en manche sortant du cadre par
// le bas ; à côté, la voiture vue du dessus (celle des scènes) braque ses roues avant dans le même sens que le volant, et un
// compteur discret dit l'angle du volant ; en haut à droite, un libellé dit la situation (en circulation, en manœuvre, en
// roulant, basse allure). Les trois gestes tournent à droite (le cours : « Symétrique pour la gauche »).
//
// État d'une image : { volant, mains: { gauche, droite }, allure? }. `volant` : degrés, sens horaire positif vu du conducteur.
// Une main : { heure, prise, decalage } : `heure`, sa place dans l'espace (12 en haut ; nombre continu, 15 est 3 h un tour
// plus loin) ; `prise`, 1 quand elle tient la jante (elle tourne alors avec le volant : heure - volant / 30 reste constant),
// moins de 1 quand la jante glisse dans ses doigts (elle reste en place quand le volant tourne, ou se déplace volant
// immobile), 0 quand elle l'a lâchée ; `decalage`, en centimètres vers le centre du volant, la main en l'air (0 sur la
// jante). `allure` (retour du volant) : « roulant » ou « basse ». Le libellé de situation se lit dans l'état : il nomme la
// situation d'une étape et change à l'instant où l'étape commence, comme la légende des étapes du lecteur, sans fondu.
const GESTE = {
  echelle: 3.2,             // unités par centimètre : un volant de 37 cm fait 118 unités, 127 px sur un téléphone
  centre: [112, 118],
  // Coudes : 48 cm sous le centre du volant, 4 cm au-delà de la ligne médiane de la jante : hors du cadre, les manches en
  // sortent par le bas.
  coude: { dessous: 48, dehors: 4 },
  voiture: { x: 268, y: 132, echelle: 30, cap: -90 },   // vue du dessus, l'avant vers le haut (unités par mètre)
  rapport: 15,              // rapport de direction : degrés au volant pour un degré aux roues avant
  compteur: { x: 268, libelle: 220, valeur: 240, tailleLibelle: 11, tailleValeur: 14 },
  indication: { x: 268, haut: 14, hauteur: 22, largeur: 92, taille: 11 },
  // Flèches d'une main qui se déplace le long de la jante (qu'elle y glisse ou qu'elle tourne avec le volant), et du volant qui
  // revient droit : arcs à 28 cm du centre, au-delà des mains, même ouvertes ; écart (heures) qui sépare deux flèches qui se
  // suivent, à leur jonction.
  fleche: { rayon: 28, jeu: 0.25 },
  // Flèche de la jante qui glisse dans la main gauche (tirer-glisser) : heures avant et après 9 h.
  glisse: { avant: 0.55, apres: 0.1 },
};
const MILIEU_CAPITALES = METRIQUES_POLICE.milieuCapitales;   // ligne de base sous le milieu des capitales d'Outfit
// Position de référence du cours : main gauche à 9 h, main droite à 3 h ; midi en haut.
const POSITION = { gauche: 9, droite: 3, midi: 0 };
const posee = (heure, prise, decalage = 0) => ({ heure, prise, decalage });

/** Repère des gestes du volant, en unités du cadre : centre (cx, cy) et rayon (ligne médiane de la jante) du volant, et coude
 *  de l'avant-bras du côté `cote`, hors du cadre (GESTE.coude). */
export function repereGeste(cote) {
  const g = GESTE, k = g.echelle, [cx, cy] = g.centre;
  const dehors = -COTES[connu(cote, Object.keys(COTES), "côté")];   // le coude gauche à gauche, le droit à droite
  return { cx, cy, rayon: VOLANT.rayon * k, coude: [cx + dehors * (VOLANT.rayon + g.coude.dehors) * k, cy + g.coude.dessous * k] };
}

// Arc de cercle autour du volant, de l'heure `debut` à l'heure `fin` (sens horaire si fin > debut), à `rayonCm` du centre.
const arcAutour = (debut, fin, rayonCm) => arc(GESTE.centre, rayonCm * GESTE.echelle, (debut - HEURE_DROITE) * DEGRES_PAR_HEURE,
  (fin - HEURE_DROITE) * DEGRES_PAR_HEURE);
// Flèche d'une main qui tourne avec le volant (ou qui glisse sur la jante) de `debut` à `fin`, en arc hors des mains ; `jeu`
// retranché aux bouts quand deux flèches se suivent.
const flecheArc = (debut, fin, { avant = 0, apres = 0 } = {}) => {
  const sens = Math.sign(fin - debut);
  return arcAutour(debut + sens * avant, fin - sens * apres, GESTE.fleche.rayon);
};

// Places d'une main dans le dessin : son repère sur le volant, son avant-bras et son déplacement en l'air.
function placeMain(cote, { heure, prise, decalage }, limite) {
  const { cx, cy, rayon, coude } = repereGeste(cote), k = GESTE.echelle, a = heure * PAS_HEURE;
  return { cx, cy, rayon, heure, cote, prise, avantBras: { coude, limite },
    deplacement: [-Math.sin(a) * decalage * k, Math.cos(a) * decalage * k] };
}

// Centre visible d'une main en l'air (dos de la main), pour la flèche qui suit son trajet.
function centreMain({ heure, prise, decalage }) {
  const k = GESTE.echelle, ecart = (1 - prise) * MAIN.ouverture;
  return pointHeure(...GESTE.centre, (VOLANT.rayon + MAIN.poignet.centre[1] + ecart - decalage) * k, heure);
}

/** Dessin d'une image d'un geste du volant : `code` (titre et cadre du catalogue), `description` (lecteurs d'écran),
 *  `fleches(etape)` : les trajets (listes de points) que montrent les flèches de l'étape, deux au plus, null pour aucune ;
 *  `libelle(etat)` : le libellé de situation. Mains : la gauche d'abord, la droite par-dessus, toujours : dans le
 *  chevauchement, la droite (la main du côté du virage) passe par-dessus le bras gauche, et la gauche remonte sous le bras
 *  droit. Un contour sépare la peau de la droite de celle de la gauche là où elle passe dessus, et les deux manches. */
const FLECHES_PAR_ETAPE = 2;
function dessinGeste({ code, description, fleches, libelle }) {
  const [L, H] = CATALOGUE[code].cadre;
  const g = GESTE, [cx, cy] = g.centre, rayon = VOLANT.rayon * g.echelle;
  const limite = [0, 0, L, H];
  const repli = [[cx, cy], [cx + 1, cy]];   // trajet d'une flèche masquée : elle garde sa forme (le kit l'exige)
  return (etat, { fige, etape }) => {
    const gauche = construireMain(placeMain("gauche", etat.mains.gauche, limite));
    const droite = construireMain({ ...placeMain("droite", etat.mains.droite, limite), dessous: gauche.surfaces });
    const c = g.compteur, ind = g.indication, v = g.voiture;
    const trajets = fleches(etape);
    return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre, description },
      volant({ cx, cy, rayon, angle: etat.volant }),
      gauche.noeud, droite.noeud,
      voitureDessus({ x: v.x, y: v.y, cap: v.cap, echelle: v.echelle, roues: true, braquage: etat.volant / g.rapport }),
      texte(c.x, c.libelle, "Volant", { taille: c.tailleLibelle, ancrage: "middle", couleur: CHARTE.texteDoux }),
      texte(c.x, c.valeur, `${Math.round(etat.volant)}°`, { taille: c.tailleValeur, ancrage: "middle", graisse: 600, role: "compteur" }),
      n("g", { "data-r": "indication" },
        n("rect", { x: ind.x - ind.largeur / 2, y: ind.haut, width: ind.largeur, height: ind.hauteur, rx: ind.hauteur / 2,
          fill: CHARTE.accentDoux, stroke: CHARTE.accent, "stroke-width": CHARTE.traits.fin }),
        texte(ind.x, ind.haut + ind.hauteur / 2 + MILIEU_CAPITALES * ind.taille, libelle(etat),
          { taille: ind.taille, ancrage: "middle", graisse: 600, role: "indication-texte" })),
      n("g", { "data-r": "fleche", display: fige ? "inline" : "none" },
        Array.from({ length: FLECHES_PAR_ETAPE }, (_, i) =>
          fleche(trajets[i] || repli, { role: `fleche-${i + 1}`, visible: Boolean(trajets[i]) }))));
  };
}

// Durées (secondes ; choix de dessin, raisons dans les sources) : doigts qui s'entrouvrent ou se referment en 0,3 s, main qui
// lâche ou reprend la jante tout à fait en 0,35 s, main qui glisse d'un quart de tour sur la jante en 1 s, main qui remonte en
// l'air de 3 h à midi en 1,1 s, volant tourné d'un quart de tour en 1 s, de 150 degrés en 1,4 s, d'un demi-tour en 1,5 s ;
// chaque étape commence par une pause de 0,3 s (0,4 s à la première étape du retour du volant), le temps de lire l'étape, et
// finit sur une pause courte (le volant laissé tourné, 1,1 s, à l'étape 3 du retour du volant).
// Une main qui tient la jante tourne avec le volant : sa place se calcule à partir de l'angle du volant, jamais à part.

// 1. Tirer-glisser, virage à droite.
const TIRER_GLISSER = {
  debuts: [0, 2.2], duree: 4.6,
  lacher: [0.3, 0.6], montee: [0.6, 1.6], reprise: [1.6, 1.9],   // étape 1 : la droite monte à midi en glissant sur la jante
  tirage: [2.5, 3.9], angle: 150,                                // étape 2 : elle tire le volant vers le bas, jusqu'à 5 h
};
function etatTirerGlisser(t) {
  const T = TIRER_GLISSER, G = MAIN.doigt.glisse;
  const volant = cles([{ t: T.tirage[0], v: 0 }, { t: T.tirage[1], v: T.angle }], t);
  const droite = t < T.reprise[1]
    ? posee(cles([{ t: T.montee[0], v: POSITION.droite }, { t: T.montee[1], v: POSITION.midi }], t),
      cles([{ t: T.lacher[0], v: 1 }, { t: T.lacher[1], v: G }, { t: T.reprise[0], v: G }, { t: T.reprise[1], v: 1 }], t))
    : posee(POSITION.midi + volant / DEGRES_PAR_HEURE, 1);
  // La gauche tient la jante pendant que la droite monte, puis entrouvre les doigts : la jante y glisse, elle reste à 9 h.
  const gauche = posee(POSITION.gauche, cles([{ t: T.reprise[0], v: 1 }, { t: T.reprise[1], v: G }], t));
  return { volant, mains: { gauche, droite } };
}
const FLECHES_TIRER_GLISSER = [
  [flecheArc(POSITION.droite, POSITION.midi), null],
  [flecheArc(POSITION.midi, TIRER_GLISSER.angle / DEGRES_PAR_HEURE),
    // la jante qui glisse vers le haut dans la main gauche, sur sa ligne médiane, entre le dos de la main et les doigts, sa
    // pointe sous la base du pouce
    arcAutour(POSITION.gauche - GESTE.glisse.avant, POSITION.gauche + GESTE.glisse.apres, VOLANT.rayon)],
];

// 2. Chevauchement, virage à droite en manœuvre (le cours : la main du côté où l'on tourne monte vers midi et tire ; l'autre
// suit sans lâcher prise jusqu'à midi, puis tire à son tour pendant que la première remonte ; l'alternance continue). Chaque
// traction fait un quart de tour, de midi à 3 h : la gauche, qui suit de 9 h à midi puis tire jusqu'à 3 h, tient ainsi la
// jante un demi-tour sans la lâcher, ce que permet la rotation de l'avant-bras (raison dans les sources). Celle qui a tiré
// lâche la jante et remonte à midi pendant que l'autre tire : la droite par-dessus le bras gauche (étape 3), la gauche sous
// le bras droit (étape 4).
const CHEVAUCHEMENT = {
  debuts: [0, 2.2, 3.8, 5.9], duree: 9.0,
  traction: 90,                                                  // degrés : un quart de tour, de midi à 3 h
  lacher: [0.3, 0.6], montee: [0.6, 1.6], reprise: [1.6, 1.9],   // étape 1 : la droite monte à midi en glissant sur la jante
  tirage1: [2.5, 3.5],                                           // étape 2 : elle tire ; la gauche suit, de 9 h à midi
  lacherDroite: [4.1, 4.45],                                     // étape 3 : la droite lâche la jante à 3 h ;
  tirage2: [4.6, 5.6], traversee: [4.5, 5.6],                    //   la gauche tire, la droite remonte à midi en l'air,
  passage: 10.5,                                                 //   en dedans de la jante, par-dessus le bras gauche
  repriseDroite: [6.2, 6.55], lacherGauche: [6.55, 6.9],         // étape 4 : la droite reprend la jante, la gauche la lâche ;
  tirage3: [7.0, 8.0], traverseeGauche: [6.95, 8.05],            //   la droite tire, la gauche remonte à midi sous le bras droit
  repriseGauche: [8.2, 8.55],                                    //   et reprend la jante
};
// Une main en l'air qui remonte de 3 h à midi (la droite à l'étape 3, la gauche à l'étape 4), à l'avancée `u` (0 à 3 h, 1 à
// midi) : le centre de la main suit une courbe de Bézier quadratique, de sa place lâchée à 3 h à sa place lâchée à midi, qui
// passe à mi-chemin à `passage` cm du centre du volant, sur la bissectrice : en dedans de la jante, là où passe l'avant-bras
// de l'autre main. La main garde le repère de la jante à l'angle où elle se trouve, déplacée vers le centre ; `tours` : tours
// ajoutés à son heure (la gauche, à 3 h un tour plus loin que 9 h, y est à 15 h).
function enTraversee(u, tours = 0) {
  const C = CHEVAUCHEMENT, lachee = VOLANT.rayon + MAIN.poignet.centre[1] + MAIN.ouverture;   // centre de la main lâchée
  const [a, b] = [POSITION.droite, POSITION.midi].map((h) => fois([Math.sin(h * PAS_HEURE), -Math.cos(h * PAS_HEURE)], lachee));
  const bissectrice = (POSITION.droite + POSITION.midi) / 2 * PAS_HEURE;
  const m = fois([Math.sin(bissectrice), -Math.cos(bissectrice)], C.passage);
  const q = moins(fois(m, 2), fois(plus(a, b), 1 / 2));   // point de contrôle : la courbe passe par m à mi-chemin
  const p = plus(plus(fois(a, (1 - u) ** 2), fois(q, 2 * u * (1 - u))), fois(b, u ** 2));
  const heure = Math.atan2(p[0], -p[1]) / PAS_HEURE + tours * HEURES_PAR_TOUR;
  return posee(heure, 0, lachee - longueur(p));
}
function etatChevauchement(t) {
  const C = CHEVAUCHEMENT, G = MAIN.doigt.glisse, q = C.traction;
  const volant = cles([{ t: C.tirage1[0], v: 0 }, { t: C.tirage1[1], v: q }, { t: C.tirage2[0], v: q }, { t: C.tirage2[1], v: 2 * q },
    { t: C.tirage3[0], v: 2 * q }, { t: C.tirage3[1], v: 3 * q }], t);
  const avancee = ([debut, fin]) => cles([{ t: debut, v: 0 }, { t: fin, v: 1 }], t);
  const ouvre = ([debut, fin]) => cles([{ t: debut, v: 1 }, { t: fin, v: 0 }], t);
  // La droite : elle glisse jusqu'à midi, tire, lâche la jante à 3 h, remonte en l'air, la reprend à midi et tire.
  let droite;
  if (t < C.reprise[1]) {
    droite = posee(cles([{ t: C.montee[0], v: POSITION.droite }, { t: C.montee[1], v: POSITION.midi }], t),
      cles([{ t: C.lacher[0], v: 1 }, { t: C.lacher[1], v: G }, { t: C.reprise[0], v: G }, { t: C.reprise[1], v: 1 }], t));
  } else if (t < C.traversee[0]) {
    droite = posee(POSITION.midi + volant / DEGRES_PAR_HEURE, ouvre(C.lacherDroite));
  } else if (t < C.repriseDroite[0]) {
    droite = enTraversee(avancee(C.traversee));
  } else {
    droite = posee(POSITION.midi + (volant - 2 * q) / DEGRES_PAR_HEURE, avancee(C.repriseDroite));
  }
  // La gauche : elle tient la jante de 9 h à 3 h (elle suit, puis tire), la lâche, remonte en l'air et la reprend à midi.
  let gauche;
  if (t < C.traverseeGauche[0]) {
    gauche = posee(POSITION.gauche + volant / DEGRES_PAR_HEURE, ouvre(C.lacherGauche));
  } else if (t < C.repriseGauche[0]) {
    gauche = enTraversee(avancee(C.traverseeGauche), 1);
  } else {
    gauche = posee(HEURES_PAR_TOUR + (volant - 3 * q) / DEGRES_PAR_HEURE, avancee(C.repriseGauche));
  }
  return { volant, mains: { gauche, droite } };
}
// Trajet d'une main en l'air qui remonte (centre visible de la main), pour sa flèche : la part de la courbe qui va de juste
// après le bout des doigts de la main qui tient encore la jante à 3 h, au début de l'étape, jusqu'à juste avant la main qui
// est à midi.
const TRAJET_TRAVERSEE = { echantillons: 24, depart: 0.3, arrivee: 0.75 };
function trajetTraversee() {
  const T = TRAJET_TRAVERSEE;
  return Array.from({ length: T.echantillons + 1 }, (_, i) => centreMain(enTraversee(interpoler(T.depart, T.arrivee, i / T.echantillons))));
}
// Flèches : étape 1, la droite qui monte ; étape 2, la droite qui tire, la gauche qui suit jusqu'à midi ; étapes 3 et 4, la
// main à midi qui tire jusqu'à 3 h et l'autre qui remonte de 3 h à midi, en dedans de la jante.
const FLECHES_CHEVAUCHEMENT = (() => {
  const C = CHEVAUCHEMENT, j = GESTE.fleche.jeu, midi = HEURES_PAR_TOUR, quart = C.traction / DEGRES_PAR_HEURE;
  const alternance = [flecheArc(POSITION.midi, quart), trajetTraversee()];
  return [
    [flecheArc(POSITION.droite, POSITION.midi), null],
    [flecheArc(POSITION.midi, quart, { avant: j }), flecheArc(POSITION.gauche, midi, { apres: j })],
    alternance,
    alternance,
  ];
})();

// 3. Retour du volant, en sortie d'un virage à droite.
const RETOUR_VOLANT = {
  debuts: [0, 1.3, 3.6, 6.9], duree: 9.2,
  angle: 180,                                     // en roulant : volant tourné d'un demi-tour en sortie de virage
  ouverture: [0.4, 0.7],                          // étape 1 : les doigts s'entrouvrent, volant encore tourné
  retour: [1.6, 3.1],                             // étape 2 : il revient droit seul, en glissant dans les doigts
  angleBasse: 90,                                 // étape 3 : à basse allure, d'un quart de tour : les mains
  prise: [3.9, 4.2], braquage: [4.35, 5.35],      //   reprennent la jante et tournent le volant,
  lache: [5.5, 5.8],                              //   entrouvrent les doigts : il reste tourné, jusqu'à l'étape 4 ;
  reprise: [7.2, 7.5], ramene: [7.65, 8.65],      // étape 4 : elles le reprennent et le ramènent droit
};
const LIBELLES_ALLURE = { roulant: "En roulant", basse: "Basse allure" };
function etatRetourVolant(t) {
  const R = RETOUR_VOLANT, G = MAIN.doigt.glisse;
  const volant = cles([{ t: R.retour[0], v: R.angle }, { t: R.retour[1], v: 0 }, { t: R.braquage[0], v: 0 }, { t: R.braquage[1], v: R.angleBasse },
    { t: R.ramene[0], v: R.angleBasse }, { t: R.ramene[1], v: 0 }], t);
  const prise = cles([{ t: R.ouverture[0], v: 1 }, { t: R.ouverture[1], v: G }, { t: R.prise[0], v: G }, { t: R.prise[1], v: 1 },
    { t: R.lache[0], v: 1 }, { t: R.lache[1], v: G }, { t: R.reprise[0], v: G }, { t: R.reprise[1], v: 1 }], t);
  const basse = t >= R.debuts[2];
  // En roulant, les mains restent à 9 h et 3 h dans l'espace (la jante glisse dedans) ; à basse allure, elles tournent avec le
  // volant quand elles le tiennent, et il ne bouge pas quand elles l'ont lâché (le volant est droit quand l'étape 3 commence).
  const place = (base) => (basse ? base + volant / DEGRES_PAR_HEURE : base);
  return {
    volant,
    mains: { gauche: posee(place(POSITION.gauche), prise), droite: posee(place(POSITION.droite), prise) },
    allure: basse ? "basse" : "roulant",
  };
}
// Flèches de la jante qui glisse (étape 1) : sur sa ligne médiane, elles partent `depart` heure au-delà du bord de la main,
// sur `longueur` heure ; le volant qui revient (étape 2) : arc en haut, raccourci de `bord` heure de chaque côté pour ne pas
// toucher les mains.
const RETOUR_FLECHES = { depart: 0.65, longueur: 0.9, bord: 0.5 };
// Flèches : étape 1, la jante qui glisse dans chaque main (vers le bas dans la gauche, vers le haut dans la droite), sur sa ligne
// médiane, juste au-delà de la main ; étape 2, le volant qui revient droit (arc en haut) ; étape 3, à basse allure, chaque main
// qui tourne le volant d'un quart de tour ; étape 4, chaque main qui le ramène, à partir de là où elle l'a laissé.
const FLECHES_RETOUR_VOLANT = (() => {
  const R = RETOUR_VOLANT, F = RETOUR_FLECHES, f = GESTE.fleche;
  const [demi, quart] = [R.angle / DEGRES_PAR_HEURE / 2, R.angleBasse / DEGRES_PAR_HEURE];
  const [g, d] = [POSITION.gauche, POSITION.droite];
  return [
    [arcAutour(g - F.depart, g - F.depart - F.longueur, VOLANT.rayon), arcAutour(d + F.depart + F.longueur, d + F.depart, VOLANT.rayon)],
    [arcAutour(POSITION.midi + demi - F.bord, POSITION.midi - demi + F.bord, f.rayon), null],
    [flecheArc(g, g + quart), flecheArc(d, d + quart)],
    [flecheArc(g + quart, g), flecheArc(d + quart, d)],
  ];
})();

// Construction d'un geste du volant : le registre appelle construire() à chaque montage.
function geste(code, { debuts, duree }, etat, fleches, description, libelle) {
  return {
    titre: CATALOGUE[code].titre,
    description,
    cadre: CATALOGUE[code].cadre,
    duree,
    etapes: debuts.map((t) => ({ t })),
    etat,
    dessiner: dessinGeste({ code, description, fleches: (etape) => fleches[etape], libelle }),
  };
}

const DESCRIPTIONS = {
  "tirer-glisser": "Volant vu du siège, virage à droite. La main droite monte de 3 h à midi en glissant sur la jante, volant immobile, "
    + "puis tire le volant vers le bas ; la main gauche reste à 9 h et laisse le volant glisser entre ses doigts. Les mains ne se "
    + "croisent jamais. À côté, la voiture vue du dessus braque ses roues avant à droite ; un compteur dit l'angle du volant.",
  chevauchement: "Volant vu du siège, virage à droite en manœuvre. La main droite monte à midi et tire d'un quart de tour ; la gauche "
    + "suit sans lâcher prise jusqu'à midi, puis tire à son tour d'un quart de tour pendant que la droite lâche la jante et remonte "
    + "à midi en passant par-dessus le bras gauche. Puis la droite reprend la jante et tire, pendant que la gauche la lâche et "
    + "remonte à midi en passant sous le bras droit. À côté, la voiture vue du dessus braque ses roues avant à droite ; un "
    + "compteur dit l'angle du volant.",
  "retour-volant": "Volant vu du siège, en sortie d'un virage à droite. En roulant, les doigts s'entrouvrent et le volant revient "
    + "droit seul en glissant dans les mains, qui restent à 9 h et 3 h. À basse allure, les mains tournent le volant d'un quart de "
    + "tour puis entrouvrent les doigts : il reste tourné, il ne revient pas seul ; elles le reprennent et le ramènent droit. À "
    + "côté, la voiture vue du dessus et ses roues avant ; un compteur dit l'angle du volant.",
};
// Libellé de situation de chaque geste, lu dans l'état.
const LIBELLES = {
  "tirer-glisser": () => "En circulation",
  chevauchement: () => "En manœuvre",
  "retour-volant": (etat) => LIBELLES_ALLURE[etat.allure],
};

// ===== Registre =====
export const DESSINS = {
  "poste-commandes": posteCommandes,
  "mains-volant": mainsVolant,
  pedales,
};
export const GESTES = {
  "tirer-glisser": { construire: () => geste("tirer-glisser", TIRER_GLISSER, etatTirerGlisser, FLECHES_TIRER_GLISSER, DESCRIPTIONS["tirer-glisser"], LIBELLES["tirer-glisser"]) },
  chevauchement: { construire: () => geste("chevauchement", CHEVAUCHEMENT, etatChevauchement, FLECHES_CHEVAUCHEMENT, DESCRIPTIONS.chevauchement, LIBELLES.chevauchement) },
  "retour-volant": { construire: () => geste("retour-volant", RETOUR_VOLANT, etatRetourVolant, FLECHES_RETOUR_VOLANT, DESCRIPTIONS["retour-volant"], LIBELLES["retour-volant"]) },
};
export { versDom } from "./dessin-svg.js?v=20261015c";
