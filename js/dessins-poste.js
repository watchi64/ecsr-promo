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
import { n } from "./dessin-svg.js?v=20261013a";
import { CHARTE, cadre, texte, etiquette, vignette, fleche } from "./dessins-kit.js?v=20261013a";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261013a";

// ===== Teintes de l'habitacle (choix de dessin) =====
// Tons neutres (spec § 3) : plastique sombre des commandes en trois tons (base, reflet, ombre), planche claire, symboles clairs
// sur les commandes ; le rouge est celui du témoin des feux de détresse (couleur normalisée, règlement ONU n° 121, symbole 6).
const TEINTES = {
  commande: "#2E3732", commandeReflet: "#56635B", commandeOmbre: "#1D2420",
  colonne: "#3E4843",
  planche: "#E1E6DB", plancheOmbre: "#CBD3C4", console: "#D3DACC",
  symbole: "#EEF2EB",
  metal: "#A9B2A8", metalOmbre: "#7F8A80",
  rouge: "#D3392B",
};

// ===== Géométrie de base =====
const coord = (v) => String(Number(v.toFixed(2)));
const pt = ([x, y]) => `${coord(x)} ${coord(y)}`;
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
const polygone = (points) => `M${points.map(pt).join(" L")} Z`;

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

// Découpe d'un polygone convexe ou non par un rectangle [x1, y1, x2, y2] (Sutherland et Hodgman) : un avant-bras qui sort du
// cadre d'une vignette s'arrête à son bord.
function decouper(points, [x1, y1, x2, y2]) {
  const bords = [
    [(p) => p[0] >= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x2, (a, b) => [x2, a[1] + ((b[1] - a[1]) * (x2 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
    [(p) => p[1] <= y2, (a, b) => [a[0] + ((b[0] - a[0]) * (y2 - a[1])) / (b[1] - a[1]), y2]],
  ];
  let sortie = points;
  for (const [garde, couper] of bords) {
    const entree = sortie;
    sortie = [];
    entree.forEach((p, i) => {
      const precedent = entree[(i + entree.length - 1) % entree.length];
      if (garde(p)) {
        if (!garde(precedent)) sortie.push(couper(precedent, p));
        sortie.push(p);
      } else if (garde(precedent)) sortie.push(couper(precedent, p));
    });
    if (!sortie.length) break;
  }
  return sortie;
}

// ===== Volant =====

/** Point de la jante (ou d'un cercle de même centre) à une heure du cadran : 12 en haut, 3 à droite, sens horaire. */
export function pointHeure(cx, cy, rayon, heure) {
  const a = heure * PAS_HEURE;
  return [cx + rayon * Math.sin(a), cy - rayon * Math.cos(a)];
}

// Volant d'une voiture particulière, vu de face, en centimètres : ligne médiane de la jante (37 cm de diamètre), épaisseur
// de la jante, moyeu (le coussin de l'airbag, où est l'avertisseur), branches de 3 h et 9 h, branche de 6 h plus large.
const VOLANT = {
  rayon: 18.5, jante: 3.4, moyeu: 6.6,
  branche: { moyeu: 5.6, jante: 4.4, depart: 3.0 },
  brancheBas: { moyeu: 6.4, jante: 4.8, depart: 3.0 },
  // Reflet de la jante (lumière venue d'en haut à gauche) : de 9 h 40 à 11 h 20, sur la moitié intérieure de la jante.
  reflet: { debut: 9.67, fin: 11.33, decalage: -0.75, largeur: 0.6 },
  // Bord clair du moyeu, du même côté.
  refletMoyeu: { debut: 9.5, fin: 11.5, decalage: -0.6, largeur: 0.5 },
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

/** Volant vu du conducteur : jante, trois branches à 3 h, 6 h et 9 h tournées de `angle` degrés (sens horaire positif),
 *  moyeu. Le groupe porte le centre (data-x, data-y), le rayon de la ligne médiane de la jante (data-rayon) et l'angle
 *  (data-angle). Les branches et le moyeu tournent autour du centre (groupe « volant-tournant ») ; la jante et son reflet ne
 *  tournent pas (un cercle reste un cercle, la lumière ne tourne pas). `avertisseur` : le pictogramme du klaxon sur le moyeu,
 *  qui prend alors le rôle « avertisseur » et sa boîte. */
export function volant({ cx, cy, rayon, angle = 0, role = "volant", avertisseur = false }) {
  const k = rayon / VOLANT.rayon;
  const centre = [cx, cy];
  const branche = (heure, { moyeu, jante, depart }) => {
    const a = heure * PAS_HEURE;
    const d = [Math.sin(a), -Math.cos(a)], p = normale(d);
    const [r0, r1] = [depart * k, rayon];
    const points = [
      plus(plus(centre, fois(d, r0)), fois(p, (moyeu * k) / 2)), plus(plus(centre, fois(d, r1)), fois(p, (jante * k) / 2)),
      plus(plus(centre, fois(d, r1)), fois(p, (-jante * k) / 2)), plus(plus(centre, fois(d, r0)), fois(p, (-moyeu * k) / 2)),
    ];
    const vrai = (((heure * DEGRES_PAR_HEURE + angle) % 360) + 360) % 360;
    return n("path", { d: polygone(points), fill: TEINTES.commande, "data-r": `branche-${heure}`, "data-angle": vrai });
  };
  const rMoyeu = VOLANT.moyeu * k;
  const moyeu = n("g", avertisseur
    ? { "data-r": "avertisseur", "data-x": cx, "data-y": cy, "data-largeur": 2 * rMoyeu, "data-hauteur": 2 * rMoyeu }
    : { "data-r": "moyeu" },
  n("circle", { cx, cy, r: rMoyeu, fill: TEINTES.commande }),
  n("path", { d: arcHeures(cx, cy, rMoyeu + VOLANT.refletMoyeu.decalage * k, VOLANT.refletMoyeu.debut, VOLANT.refletMoyeu.fin),
    fill: "none", stroke: TEINTES.commandeReflet, "stroke-width": VOLANT.refletMoyeu.largeur * k, "stroke-linecap": "round" }),
  avertisseur ? pictoAvertisseur(cx, cy, AVERTISSEUR.longueur * k, TEINTES.commande) : null);
  return n("g", { "data-r": role, "data-x": cx, "data-y": cy, "data-rayon": rayon, "data-angle": angle },
    n("g", { "data-r": "volant-tournant", transform: `rotate(${angle} ${cx} ${cy})` },
      branche(3, VOLANT.branche), branche(9, VOLANT.branche), branche(6, VOLANT.brancheBas), moyeu),
    n("circle", { cx, cy, r: rayon, fill: "none", stroke: TEINTES.commande, "stroke-width": EPAISSEUR_JANTE * rayon, "data-r": "jante" }),
    n("path", { d: arcHeures(cx, cy, rayon + VOLANT.reflet.decalage * k, VOLANT.reflet.debut, VOLANT.reflet.fin),
      fill: "none", stroke: TEINTES.commandeReflet, "stroke-width": VOLANT.reflet.largeur * k, "stroke-linecap": "round" }));
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
    n("path", { d: polygone(corps), fill: TEINTES.symbole }),
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
  // Doigts, de l'index à l'auriculaire : place le long de la jante et largeur ; ils se chevauchent un peu, un pli les sépare.
  doigts: [{ s: 2.45, largeur: 1.95 }, { s: 0.6, largeur: 2.0 }, { s: -1.3, largeur: 1.95 }, { s: -3.1, largeur: 1.7 }],
  // Doigt refermé : il déborde du bord intérieur de la jante de 1,2 cm et revient sur sa face avant jusqu'à 0,15 cm au-delà
  // de la ligne médiane ; forme d'un rectangle à coins ronds (superellipse d'exposant 3).
  doigt: { debord: 1.2, bout: 0.15, exposant: 3, points: 16 },
  // Pouce : axe de la base au bout (centre de l'arrondi), largeur à la base et au bout.
  pouce: {
    jante: [[1.4, 1.3], [4.0, 0.35], [6.8, 0.05]],
    interieur: [[2.0, 1.2], [3.3, -1.2], [2.1, -4.1]],
    base: 2.15, bout: 1.75, points: 9,
  },
  // Poignet : départ de l'avant-bras sous le dos de la main, sa largeur, la longueur de peau avant la manche.
  poignet: { point: [-2.4, 2.6], largeur: 3.8, peau: 3.6, recul: 1.5 },
  // Manche : largeur vers le coude, longueur du revers (bande plus sombre au bord de la manche).
  manche: { coude: 6.0, revers: 1.1 },
  // Main ouverte (prise 0) : elle s'écarte de la jante de 0,8 cm ; les doigts sont cachés sous ce seuil de prise.
  ouverture: 0.8, seuilDoigts: 0.06,
};
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

// Rectangle à coins ronds de centre (s, ρ), de demi-largeurs a (le long de la jante) et b (en travers) : superellipse.
function superellipse([s, r], a, b, exposant, nombre) {
  return Array.from({ length: nombre }, (_, i) => {
    const t = (2 * Math.PI * i) / nombre, c = Math.cos(t), si = Math.sin(t);
    return [s + a * Math.sign(c) * Math.abs(c) ** (2 / exposant), r + b * Math.sign(si) * Math.abs(si) ** (2 / exposant)];
  });
}

// Quadrilatère d'une portion d'avant-bras, de `a` à `b`, de largeurs la et lb.
function troncon(a, b, la, lb) {
  const nrm = normale(unitaire(moins(b, a)));
  return [plus(a, fois(nrm, la / 2)), plus(b, fois(nrm, lb / 2)), plus(b, fois(nrm, -lb / 2)), plus(a, fois(nrm, -la / 2))];
}
const traceOuPoint = (points, repli) => (points.length >= 3 ? polygone(points) : `M${pt(repli)}`);

/** Main posée sur la jante d'un volant de centre (cx, cy) et de rayon `rayon` (ligne médiane de la jante), à `heure` (12 en
 *  haut, 3 à droite). `cote` : « gauche » ou « droite » (le pouce file dans le sens horaire pour la main gauche, en sens
 *  inverse pour la droite : les deux mains sont en miroir). `prise` : de 0 (main ouverte, écartée de la jante, doigts cachés)
 *  à 1 (main refermée, les doigts repliés sur la face avant de la jante). `pouce` : « jante » (posé le long de la jante) ou
 *  « interieur » (engagé à l'intérieur de la jante). `avantBras` : { coude: [x, y], limite: [x1, y1, x2, y2] } ajoute
 *  l'avant-bras (poignet, puis manche) du poignet vers le coude, coupé au rectangle `limite`. Rôles : main-<cote> (point de
 *  prise sur la ligne médiane de la jante, data-x et data-y), pouce-<cote> (centre de l'arrondi du bout du pouce),
 *  doigts-<cote>. Mêmes nœuds quelles que soient l'heure, la prise, le pouce et le côté : une animation ne fait que changer
 *  leurs attributs. */
export function main({ cx, cy, rayon, heure, cote, prise = 1, pouce = "jante", avantBras = null }) {
  const sens = COTES[connu(cote, Object.keys(COTES), "côté")];
  connu(pouce, POUCES, "pouce");
  if (!Number.isFinite(heure)) throw new Error(`Main : heure « ${heure} » non finie.`);
  if (!(prise >= 0 && prise <= 1)) throw new Error(`Main : prise « ${prise} » hors de 0 à 1.`);
  const k = rayon / VOLANT.rayon;
  const ecart = (1 - prise) * MAIN.ouverture;
  const local = ([s, r]) => pointHeure(cx, cy, rayon + r * k, heure + (sens * s * k * HEURES_PAR_TOUR) / (2 * Math.PI * rayon));
  const decale = ([s, r]) => local([s, r + ecart]);

  // Dos de la main, et la surface qu'il couvre (pour poser les plis entre deux surfaces de peau).
  const dos = MAIN.dos.map(decale);
  const segmentsDos = segmentsLisses(dos, true);
  const surfaces = [contourEchantillonne(segmentsDos)];

  // Avant-bras : la peau du poignet sous le dos de la main, puis la manche et son revers.
  let bras = null;
  if (avantBras) {
    const { poignet: p, manche: mc } = MAIN;
    const w = decale(p.point);
    const axe = unitaire(moins(avantBras.coude, w));
    const [debut, finPeau] = [moins(w, fois(axe, p.recul * k)), plus(w, fois(axe, p.peau * k))];
    const finRevers = plus(finPeau, fois(axe, mc.revers * k));
    const total = longueur(moins(avantBras.coude, w)) / k;
    const largeurA = (dist) => (p.largeur + ((mc.coude - p.largeur) * dist) / total) * k;   // la manche s'élargit vers le coude
    const peauBras = decouper(troncon(debut, finPeau, p.largeur * k, largeurA(p.peau)), avantBras.limite);
    const manche = decouper(troncon(finPeau, avantBras.coude, largeurA(p.peau), mc.coude * k), avantBras.limite);
    const revers = decouper(troncon(finPeau, finRevers, largeurA(p.peau), largeurA(p.peau + mc.revers)), avantBras.limite);
    bras = { peau: traceOuPoint(peauBras, w), manche: traceOuPoint(manche, w), revers: traceOuPoint(revers, w),
      pli: peauBras.length >= 3 ? contourSur(segmentsDos, peauBras) : `M${pt(dos[0])}` };
  }

  // Doigts, de l'auriculaire à l'index (chacun pose son pli sur le précédent et sur le dos de la main).
  const e = VOLANT.jante, d = MAIN.doigt;
  const doigts = [...MAIN.doigts].reverse().map(({ s, largeur }) => {
    const interieur = -e / 2 - d.debord * prise, bout = -e / 2 + (d.bout + e / 2) * prise;
    const forme = superellipse([s, (interieur + bout) / 2], largeur / 2, Math.max((bout - interieur) / 2, Number.EPSILON), d.exposant, d.points).map(local);
    const segments = segmentsLisses(forme, true);
    const trace = `M${pt(forme[0])} ${traceSegments(segments)} Z`;
    const plis = surfaces.map((surface) => contourSur(segments, surface)).join(" ");
    surfaces.push(contourEchantillonne(segments));
    return { trace, plis };
  });

  // Pouce, posé sur tout ce qui précède.
  const formePouce = contourPouce(MAIN.pouce[pouce], MAIN.pouce.base, MAIN.pouce.bout, MAIN.pouce.points).map(decale);
  const segmentsPouce = segmentsLisses(formePouce, true);
  const plisPouce = surfaces.map((surface) => contourSur(segmentsPouce, surface)).join(" ");
  const boutPouce = decale(MAIN.pouce[pouce][2]);
  const prisePoint = local([0, 0]);

  const peau = { fill: CHARTE.peau };
  const pli = { fill: "none", stroke: CHARTE.peauOmbre, "stroke-width": CHARTE.traits.fin, "stroke-linecap": "round", "stroke-linejoin": "round" };
  return n("g", { "data-r": `main-${cote}`, "data-x": prisePoint[0], "data-y": prisePoint[1], "data-heure": heure, "data-prise": prise },
    bras ? n("g", { "data-r": `avant-bras-${cote}` },
      n("path", { d: bras.manche, fill: MANCHE.tissu }),
      n("path", { d: bras.revers, fill: MANCHE.revers }),
      n("path", { d: bras.peau, ...peau })) : null,
    n("path", { d: `M${pt(dos[0])} ${traceSegments(segmentsDos)} Z`, ...peau, "data-r": `dos-${cote}` }),
    bras ? n("path", { d: bras.pli, ...pli }) : null,
    n("g", { "data-r": `doigts-${cote}`, display: prise > MAIN.seuilDoigts ? "inline" : "none" },
      doigts.map((x) => n("g", {}, n("path", { d: x.trace, ...peau }), n("path", { d: x.plis, ...pli })))),
    n("g", { "data-r": `pouce-${cote}`, "data-x": boutPouce[0], "data-y": boutPouce[1] },
      n("path", { d: `M${pt(formePouce[0])} ${traceSegments(segmentsPouce)} Z`, ...peau }),
      n("path", { d: plisPouce, ...pli })));
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
  // Anneau qui désigne le pouce engagé : centré sur sa partie passée à l'intérieur de la jante, 3,5 cm de rayon.
  anneau: { s: 2.6, rho: -2.2, rayon: 3.5 },
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
    let anneau = null;
    if (pouce === "interieur") {
      const [ax, ay] = pointHeure(cx, cy, rayon + m.anneau.rho * k, 9 + (m.anneau.s * k * HEURES_PAR_TOUR) / (2 * Math.PI * rayon));
      anneau = n("g", { "data-r": "anneau-pouce" },
        n("circle", { cx: ax, cy: ay, r: m.anneau.rayon * k, fill: "none", stroke: CHARTE.carte, "stroke-width": CHARTE.traits.moyen + 2 * CHARTE.liseres }),
        n("circle", { cx: ax, cy: ay, r: m.anneau.rayon * k, fill: "none", stroke: CHARTE.faux, "stroke-width": CHARTE.traits.moyen }));
    }
    return vignette({ x, y: m.marge, largeur: carte.largeur, hauteur: carte.hauteur, etat },
      volant({ cx, cy, rayon }),
      mainDe("gauche", 9, pouce), mainDe("droite", 3, "jante"),
      anneau,
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
  flocon: { branche: 0.62, longueurBranche: 0.3, ouverture: 40 },
};

function pictoDetresse(x, y, t) {
  const triangle = (c) => {
    const h = (c * Math.sqrt(3)) / 2;
    return [[x, y - (2 * h) / 3], [x + c / 2, y + h / 3], [x - c / 2, y + h / 3]];
  };
  const trait = { fill: "none", stroke: TEINTES.rouge, "stroke-width": CHARTE.traits.moyen };
  return [n("path", { d: polygone(triangle(t)), ...trait }), n("path", { d: polygone(triangle(t * PICTO.detresse.interieur)), ...trait })];
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
    n("path", { d: `M${points.map(pt).join(" L")}`, fill: "none", stroke: TEINTES.symbole, "stroke-width": CHARTE.traits.fin, "stroke-linejoin": "round" }),
    n("path", { d: polygone([[x, yHaut], [x + demi, finTige], [x - demi, finTige]]), fill: TEINTES.symbole }),
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
  const pales = [0, 1, 2, 3].map((i) => i * ANGLE_ENTRE_PALES).map((a) => {
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
  const bras = [90, 30, 150].map((a) => {
    const [dx, dy] = [r * Math.cos((a * Math.PI) / 180), -r * Math.sin((a * Math.PI) / 180)];
    return `M${pt([x - dx, y - dy])} L${pt([x + dx, y + dy])}`;
  }).join(" ");
  const branches = [30, 90, 150, 210, 270, 330].map((a) => {
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
  // Commodo gauche (le droit en miroir), en centimètres depuis le centre du volant : du carénage au bout, 7 cm au-delà de la
  // jante ; tige, bague au bout (commande tournante) et ses rainures.
  commodo: { base: [-7, 0], bout: [-29.2, -2.2], tige: 2.0, bague: 2.8, longueurBague: 5.0, rainures: [0.3, 0.7] },
  // Contacteur à droite de la colonne, vu par l'ouverture du volant entre 3 h et 6 h : centre, collerette, cœur, fente.
  contacteur: { centre: [6.6, 7.6], rayon: 2.2, coeur: 1.5, fente: 2.3, largeurFente: 0.55, angleFente: -30 },
  boutons: { x: 208, largeur: 30, hauteur: 19, rayon: 4, picto: 16, cible: 2.5 },
  detresse: { y: 62, picto: 13 },
  ventilation: { y: 93, rayon: 11.5, picto: 16 },
  desembuage: { avant: 123, arriere: 147 },
  climatisation: { y: 171, picto: 13 },
  // Frein de stationnement (levier, vu d'au-dessus), entre les sièges.
  frein: { x: 208, haut: 192, bas: 233, largeur: 6, poignee: 22, largeurPoignee: 8, bouton: 2.6, soufflet: { largeur: 14, hauteur: 9 } },
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
      n("path", { d: polygone(troncon(base, debutBague, c.tige * k, c.tige * k)), fill: TEINTES.colonne }),
      n("path", { d: polygone(bague), fill: TEINTES.commande, stroke: TEINTES.commande, "stroke-width": CHARTE.traits.fin, "stroke-linejoin": "round" }),
      n("path", { d: rainures, fill: "none", stroke: TEINTES.commandeReflet, "stroke-width": CHARTE.traits.fin }));
  };

  // Contacteur : collerette métallique, cœur sombre, fente de la clé.
  const ct = p.contacteur, [kx, ky] = cm(ct.centre);
  const fente = troncon(...[-1, 1].map((s) => [kx + s * Math.cos((ct.angleFente * Math.PI) / 180) * (ct.fente * k) / 2,
    ky + s * Math.sin((ct.angleFente * Math.PI) / 180) * (ct.fente * k) / 2]), ct.largeurFente * k, ct.largeurFente * k);
  const contacteur = n("g", { "data-r": "contacteur", ...boite(kx, ky, 2 * ct.rayon * k, 2 * ct.rayon * k) },
    n("circle", { cx: kx, cy: ky, r: ct.rayon * k, fill: TEINTES.metal }),
    n("circle", { cx: kx, cy: ky, r: ct.coeur * k, fill: TEINTES.commande }),
    n("path", { d: polygone(fente), fill: TEINTES.metal }));

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

  // Frein de stationnement : soufflet, levier, poignée, bouton de déverrouillage au bout.
  const f = p.frein;
  const frein = n("g", { "data-r": "frein-stationnement", ...boite(f.x, (f.haut + f.bas) / 2, f.largeurPoignee, f.bas - f.haut) },
    n("rect", { x: f.x - f.soufflet.largeur / 2, y: f.haut - f.soufflet.hauteur / 2, width: f.soufflet.largeur, height: f.soufflet.hauteur,
      rx: f.soufflet.hauteur / 2, fill: TEINTES.commandeOmbre }),
    n("rect", { x: f.x - f.largeur / 2, y: f.haut, width: f.largeur, height: f.bas - f.haut, rx: f.largeur / 2, fill: TEINTES.commande }),
    n("rect", { x: f.x - f.largeurPoignee / 2, y: f.bas - f.poignee, width: f.largeurPoignee, height: f.poignee, rx: f.largeurPoignee / 2, fill: TEINTES.commandeReflet }),
    n("circle", { cx: f.x, cy: f.bas - f.largeurPoignee / 2, r: f.bouton, fill: TEINTES.metal }));

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
    lab("contacteur", [kx, ky], e.contacteur, ["Contacteur"], "middle"),
    lab("feux-detresse", [bordBouton, p.detresse.y], [droite, p.detresse.y], ["Feux de", "détresse"]),
    lab("ventilation", pointHeure(b.x, v.y, v.rayon - b.cible, heureEntrePales), [droite, v.y], ["Ventilation"]),
    n("g", { "data-r": "etiquette-desembuage" },
      etiquette({ cible: [bordBouton, p.desembuage.avant], ancre: [droite, (p.desembuage.avant + p.desembuage.arriere) / 2], lignes: ["Désembuage"], taille: t }),
      etiquette({ cible: [bordBouton, p.desembuage.arriere], ancre: [droite, (p.desembuage.avant + p.desembuage.arriere) / 2], lignes: [], taille: t })),
    lab("climatisation", [bordBouton, p.climatisation.y], [droite, p.climatisation.y], ["Climatisation"]),
    lab("frein-stationnement", [f.x + f.largeurPoignee / 2 - 1, f.bas - f.poignee / 2], [droite, f.bas - f.poignee / 2], ["Frein de", "stationnement"]),
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
  chaussure: { longueur: 25, largeur: 10, semelle: 0.5, appui: 1.5 },
  talons: { gauche: [-1.0, 44.5], droit: [21.5, 44.5] },
  // Flèche du pied droit : un arc centré sur le talon, du frein vers l'accélérateur, passant 5 cm au-delà du bout de la
  // chaussure, donc au-dessus des patins.
  pivot: { dessus: 5, points: 7 },
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

  // Une pédale : bras qui monte sous la planche, patin et ses rainures ; la boîte de l'élément est celle du patin.
  const pedale = (role) => {
    const q = p[role], [x, y] = cm([q.x, q.y]), [l, h] = [q.largeur * k, q.hauteur * k];
    const rainures = Array.from({ length: p.rainures }, (_, i) => {
      const yy = y - h / 2 + ((i + 1) * h) / (p.rainures + 1);
      return `M${pt([x - l / 2 + p.rayonPatin * k, yy])} L${pt([x + l / 2 - p.rayonPatin * k, yy])}`;
    }).join(" ");
    return n("g", { "data-r": role, ...boite(x, y, l, h) },
      n("rect", { x: x - (p.bras * k) / 2, y: 0, width: p.bras * k, height: y, fill: PEDALIER.bras }),
      n("rect", { x: x - l / 2, y: y - h / 2, width: l, height: h, rx: p.rayonPatin * k, fill: PEDALIER.patin }),
      n("path", { d: rainures, fill: "none", stroke: PEDALIER.rainure, "stroke-width": CHARTE.traits.fin, "stroke-linecap": "round" }));
  };

  // Un pied : la chaussure, de son bout posé sur le patin à son talon au sol. Point de référence (data-x, data-y) : l'appui de
  // la semelle sur le patin ; `cible` : un point de la chaussure, côté extérieur, que désigne son étiquette.
  const pied = (cote, pedaleSous) => {
    const c = p.chaussure, q = p[pedaleSous], sens = cote === "gauche" ? 1 : -1;   // côté extérieur : à gauche pour le pied gauche
    const bout = [q.x, q.y], talon = p.talons[cote];
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
  const [tx, ty] = cm(p.talons.droit);
  const [fx, fy] = cm([p.frein.x, p.frein.y]), [ax] = cm([p.accelerateur.x, p.accelerateur.y]);
  const rayon = Math.hypot(fx - tx, fy - ty) + p.pivot.dessus * k;
  const angleDe = (x) => Math.asin((x - tx) / rayon);
  const [a1, a2] = [angleDe(fx), angleDe(ax)];
  const arc = Array.from({ length: p.pivot.points }, (_, i) => {
    const a = a1 + ((a2 - a1) * i) / (p.pivot.points - 1);
    return [tx + rayon * Math.sin(a), ty - rayon * Math.cos(a)];
  });
  const [depart, arrivee] = [arc[0], arc[arc.length - 1]];
  const pivot = n("g", { "data-r": "pivot", "data-x1": depart[0], "data-y1": depart[1], "data-x2": arrivee[0], "data-y2": arrivee[1] },
    fleche(arc));

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

// ===== Registre =====
export const DESSINS = {
  "poste-commandes": posteCommandes,
  "mains-volant": mainsVolant,
  pedales,
};
// Les gestes du volant (tirer-glisser, chevauchement, retour-volant) arrivent avec la tâche 7.
export const GESTES = {};
export { versDom } from "./dessin-svg.js?v=20261013a";
