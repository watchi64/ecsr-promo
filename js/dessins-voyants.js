/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Famille « voyants » des dessins des cours de compétences (C1.1) : les douze pictogrammes normalisés des voyants du cours,
 * la planche des voyants groupés par couleur avec leur conduite à tenir (voyants), et l'autotest du combiné d'instruments à
 * la mise du contact (autotest, animé). Sources, références et choix de dessin : sources/dessins-voyants.js.
 */
import { n } from "./dessin-svg.js?v=20261024d";
import { CHARTE, COULEURS_VOYANTS, SYMBOLE_FREIN, SYMBOLE_TEMPERATURE, vagueSymbole, METRIQUES_POLICE, cadre, texte, fleche, coord as ecrit, point as pt, trace, entre } from "./dessins-kit.js?v=20261024d";
import { adoucir, sortieDouce, avancement } from "./animation-courbes.js?v=20261024d";

// ------------------------------------------------------------------------------------------------ Couleurs et tons

// Les quatre couleurs de voyant de la norme sont celles de la charte (COULEURS_VOYANTS du kit), partagées avec le témoin des
// feux de détresse sur sa commande (js/dessins-poste.js) ; réexportées ici pour les tests de la famille.
export { COULEURS_VOYANTS };

/** Couleur de chacun des douze voyants du cours (C1.1, tableau « Les voyants » ; thèmes 25 et 48). */
export const COULEUR_DE = {
  huile: "rouge", temperature: "rouge", freinage: "rouge", batterie: "rouge", airbag: "rouge",
  abs: "orange", pneus: "orange", prechauffage: "orange", reserve: "orange",
  clignotants: "vert", croisement: "vert", route: "bleu",
};

/** Tons du tableau de bord, en pictogramme (style schématique, décision du formateur du 15/10/2026) : tuile et combiné d'un
 *  seul aplat sombre, sans bord ; voyant éteint à peine plus clair que le fond (on le devine, comme un symbole sous la vitre
 *  du combiné) ; graduations, légendes et aiguille claires, l'aiguille la plus claire. */
export const TABLEAU = {
  fond: CHARTE.texte, eteint: "#3A4741",
  graduation: "#C7D0C2", legende: "#A7B2A3", aiguille: "#F2F5EF",
};

// Traits des pictogrammes, pris dans le jeu de la charte : 1,5 unité pour les traits du symbole, 1 pour ses traits fins
// (cercle intérieur du freinage et de l'ABS, lettres ABS, ceinture de l'airbag).
const TRAIT = CHARTE.traits.moyen;
const TRAIT_FIN = CHARTE.traits.fin;

// ------------------------------------------------------------------------------------------------ Géométrie

const somme = (a, b) => [a[0] + b[0], a[1] + b[1]];
const ecart = (a, b) => [a[0] - b[0], a[1] - b[1]];
const fois = (a, k) => [a[0] * k, a[1] * k];
const unitaire = (a) => fois(a, 1 / Math.hypot(a[0], a[1]));
const normale = (a) => [-a[1], a[0]];
const scalaire = (a, b) => a[0] * b[0] + a[1] * b[1];
const radians = (degres) => (degres * Math.PI) / 180;
// Point de rencontre de la droite (p, direction d) et de la droite (r, direction e).
function rencontre(p, d, r, e) {
  const t = ((r[0] - p[0]) * e[1] - (r[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]);
  return somme(p, fois(d, t));
}
const traitDe = (couleur, epaisseur, bout = "round") => ({
  fill: "none", stroke: couleur, "stroke-width": epaisseur, "stroke-linecap": bout, "stroke-linejoin": "round",
});
const plein = (couleur) => ({ fill: couleur });
// Poignées d'une courbe de Bézier au tiers et aux deux tiers (les vagues des symboles : vagueSymbole du kit).
const TIERS = 1 / 3;

// ------------------------------------------------------------------------------------------------ Pictogrammes

// Proportions des symboles en fraction du carré de base de la norme (côté `taille`), u vers la droite et v vers le bas,
// relevées sur les dessins ISO 7000 de référence (sources/dessins-voyants.js) puis arrondies.
// MILIEU : le centre du carré, axe des symboles symétriques.
const MILIEU = 0.5;

const HUILE = {
  // Contour du corps et du bec : coin haut gauche, haut du corps jusqu'à l'encoche, encoche, pointe du bec, crochet de la
  // pointe, dessous du bec, coin bas droit, coin bas gauche.
  contour: [[0.23, 0.42], [0.535, 0.42], [0.58, 0.485], [0.928, 0.372], [0.943, 0.403], [0.905, 0.403], [0.641, 0.641], [0.23, 0.641]],
  pointe: 3,
  couvercle: { u: 0.385, haut: 0.33, bas: 0.42, gauche: 0.32, droite: 0.45 },
  poignee: [[0.23, 0.445], [0.045, 0.315], [0.065, 0.455], [0.23, 0.53]],
  // Goutte : pointe en haut, rond en bas ; épaule et col : forme du haut de la goutte, en fraction de sa hauteur et du rayon.
  goutte: { u: 0.927, haut: 0.475, centre: 0.578, rayon: 0.03, epaule: 0.45, col: 0.2, flanc: 0.8 },
};

function huile({ q, s, couleur }) {
  const F = HUILE, c = F.couvercle, g = F.goutte;
  const contour = F.contour.map(([u, v]) => q(u, v));
  const bec = contour[F.pointe];
  const [gx, gHaut] = q(g.u, g.haut), [, gCentre] = q(g.u, g.centre);
  const r = g.rayon * s, h = gCentre - gHaut;
  const goutte = `M${pt([gx, gHaut])} C${pt([gx + r * g.col, gHaut + h * g.epaule])} ${pt([gx + r, gCentre - r * g.flanc])} `
    + `${pt([gx + r, gCentre])} A${ecrit(r)} ${ecrit(r)} 0 0 1 ${pt([gx - r, gCentre])} `
    + `C${pt([gx - r, gCentre - r * g.flanc])} ${pt([gx - r * g.col, gHaut + h * g.epaule])} ${pt([gx, gHaut])} Z`;
  return [
    n("path", { d: trace(F.poignee.map(([u, v]) => q(u, v)), false), ...traitDe(couleur, TRAIT) }),
    n("path", { d: `${trace(contour, false)} Z`, ...traitDe(couleur, TRAIT), "data-r": "bec", "data-x": bec[0], "data-y": bec[1] }),
    n("path", { d: `${trace([q(c.gauche, c.haut), q(c.droite, c.haut)], false)} ${trace([q(c.u, c.haut), q(c.u, c.bas)], false)}`,
      ...traitDe(couleur, TRAIT), "data-r": "couvercle", "data-x": q(c.u, c.haut)[0] }),
    n("path", { d: goutte, ...plein(couleur), "data-r": "goutte", "data-x": gx, "data-y": gCentre }),
  ];
}

// Le thermomètre dans les vagues : le symbole du kit (SYMBOLE_TEMPERATURE), que reprend le bouchon du vase d'expansion
// (js/dessins-entretien.js).
const TEMPERATURE = SYMBOLE_TEMPERATURE;

function temperature({ q, s, couleur }) {
  const F = TEMPERATURE, g = F.graduations;
  const [bx, by] = q(F.tige.u, F.bulbe.v);
  return [
    n("path", { d: trace([q(F.tige.u, F.tige.haut), [bx, by]], false), ...traitDe(couleur, TRAIT) }),
    n("circle", { cx: bx, cy: by, r: F.bulbe.rayon * s, ...plein(couleur) }),
    n("path", { d: g.v.map((v) => trace([q(g.gauche, v), q(g.droite, v)], false)).join(" "), ...traitDe(couleur, TRAIT, "butt") }),
    n("path", { d: F.vagues.map((w) => vagueSymbole(q, w, F.amplitude)).join(" "), ...traitDe(couleur, TRAIT, "butt") }),
  ];
}

// Le cercle et les deux arcs de part et d'autre (rayon, demi-ouverture de chacun autour de l'horizontale, degrés) : le symbole du
// freinage du kit (SYMBOLE_FREIN), que reprend le bouchon du liquide de frein (js/dessins-entretien.js) ; le point d'exclamation.
const FREINAGE = {
  cercle: SYMBOLE_FREIN.cercle,
  exclamation: { haut: 0.315, bas: 0.615, point: 0.69, rayonPoint: 0.036 },
  arcs: SYMBOLE_FREIN.arcs,
};

function arcsLateraux(q, s, { rayon, demiOuverture }) {
  const [cx, cy] = q(MILIEU, MILIEU), r = rayon * s, a = radians(demiOuverture);
  const sur = (angle) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  const arc = (debut, fin) => `M${pt(sur(debut))} A${ecrit(r)} ${ecrit(r)} 0 0 1 ${pt(sur(fin))}`;
  return `${arc(Math.PI - a, Math.PI + a)} ${arc(-a, a)}`;
}

function freinage({ q, s, couleur }) {
  const F = FREINAGE, e = F.exclamation, [cx, cy] = q(MILIEU, MILIEU);
  return [
    n("circle", { cx, cy, r: F.cercle * s, ...traitDe(couleur, TRAIT_FIN) }),
    n("path", { d: trace([q(MILIEU, e.haut), q(MILIEU, e.bas)], false), ...traitDe(couleur, TRAIT) }),
    n("circle", { cx, cy: q(MILIEU, e.point)[1], r: e.rayonPoint * s, ...plein(couleur) }),
    n("path", { d: arcsLateraux(q, s, F.arcs), ...traitDe(couleur, TRAIT, "butt") }),
  ];
}

const BATTERIE = {
  boite: { gauche: 0.1, droite: 0.9, haut: 0.3, bas: 0.755 },
  bornes: { centres: [0.272, 0.728], largeur: 0.123, hauteur: 0.075 },
  // Signes : moins à gauche, plus à droite ; demi : demi-longueur de leurs traits.
  signes: { v: 0.48, demi: 0.075, moins: 0.263, plus: 0.738 },
};

function batterie({ q, s, couleur }) {
  const F = BATTERIE, b = F.boite, g = F.signes;
  const [x0, y0] = q(b.gauche, b.haut), [x1, y1] = q(b.droite, b.bas);
  const [mx, my] = q(g.moins, g.v), [px, py] = q(g.plus, g.v), demi = g.demi * s;
  return [
    n("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, ...traitDe(couleur, TRAIT, "butt") }),
    F.bornes.centres.map((u) => {
      const [bx, by] = q(u - F.bornes.largeur / 2, b.haut - F.bornes.hauteur);
      return n("rect", { x: bx, y: by, width: F.bornes.largeur * s, height: F.bornes.hauteur * s, ...plein(couleur) });
    }),
    n("path", { d: trace([[mx - demi, my], [mx + demi, my]], false), ...traitDe(couleur, TRAIT, "butt"), "data-r": "moins", "data-x": mx }),
    n("path", { d: `${trace([[px - demi, py], [px + demi, py]], false)} ${trace([[px, py - demi], [px, py + demi]], false)}`,
      ...traitDe(couleur, TRAIT, "butt"), "data-r": "plus", "data-x": px }),
  ];
}

const AIRBAG = {
  coussin: { u: 0.377, v: 0.262, rayon: 0.185 },
  tete: { u: 0.71, v: 0.208, rayon: 0.074 },
  buste: { epaule: [0.705, 0.4], largeur: 0.123 },
  jambe: { pied: [0.146, 0.762], genou: [0.3, 0.531], largeur: 0.1 },
  // Ceinture : brin bas devant le bassin, brin haut de l'épaule à l'ancrage ; la hanche est sur le brin bas, à cette part de
  // sa longueur ; jeu : vide entre la ceinture et le corps ; buste et cuisse dépassent la hanche de cette part, puis la
  // ceinture les coupe.
  ceinture: { bas: [[0.482, 0.513], [0.603, 0.821]], haut: [[0.787, 0.346], [0.928, 0.244]], hanche: 0.55, jeu: 0.045, depassement: 0.15 },
};

// Membre plein de `a` vers `b`, de largeur `l`, coupé avant la ceinture (ligne passant par `c`, direction `e`) à `retrait` de
// son axe, du côté de `a` ; bout arrondi en `a` si `rond`.
function membre(a, b, l, c, e, retrait, rond) {
  const d = unitaire(ecart(b, a)), nl = fois(normale(d), l / 2);
  const cote = Math.sign(scalaire(ecart(a, c), normale(e)));
  const coupe = somme(c, fois(normale(e), cote * retrait));
  const [a1, a2] = [somme(a, nl), ecart(a, nl)];
  const [q1, q2] = [rencontre(a1, d, coupe, e), rencontre(a2, d, coupe, e)];
  const r = ecrit(l / 2);
  return `M${pt(a1)} L${pt(q1)} L${pt(q2)} L${pt(a2)} ${rond ? `A${r} ${r} 0 0 0 ${pt(a1)}` : `L${pt(a1)}`} Z`;
}
// Segment plein aux deux bouts arrondis, de `a` à `b`, de largeur `l`.
function capsule(a, b, l) {
  const nl = fois(normale(unitaire(ecart(b, a))), l / 2), r = ecrit(l / 2);
  return `M${pt(somme(a, nl))} L${pt(somme(b, nl))} A${r} ${r} 0 0 0 ${pt(ecart(b, nl))} L${pt(ecart(a, nl))} A${r} ${r} 0 0 0 ${pt(somme(a, nl))} Z`;
}

function airbag({ q, s, couleur }) {
  const F = AIRBAG, cb = F.ceinture;
  const Q = ([u, v]) => q(u, v);
  const [b1, b2] = cb.bas.map(Q), e = unitaire(ecart(b2, b1));
  const hanche = entre(b1, b2, cb.hanche), retrait = TRAIT_FIN / 2 + cb.jeu * s;
  const epaule = Q(F.buste.epaule), genou = Q(F.jambe.genou);
  const auDela = (a) => entre(a, hanche, 1 + cb.depassement);
  const [cx, cy] = q(F.coussin.u, F.coussin.v), [tx, ty] = q(F.tete.u, F.tete.v);
  return [
    n("circle", { cx, cy, r: F.coussin.rayon * s, ...plein(couleur), "data-r": "coussin", "data-x": cx }),
    n("circle", { cx: tx, cy: ty, r: F.tete.rayon * s, ...plein(couleur), "data-r": "tete", "data-x": tx }),
    n("path", { d: membre(epaule, auDela(epaule), F.buste.largeur * s, b1, e, retrait, true), ...plein(couleur) }),
    n("path", { d: membre(genou, auDela(genou), F.jambe.largeur * s, b1, e, retrait, false), ...plein(couleur) }),
    n("path", { d: capsule(Q(F.jambe.pied), genou, F.jambe.largeur * s), ...plein(couleur) }),
    n("path", { d: `${trace([b1, b2], false)} ${trace(cb.haut.map(Q), false)}`, ...traitDe(couleur, TRAIT_FIN, "butt") }),
  ];
}

const ABS = {
  cercle: 0.264,
  // Lettres : haut et bas des capitales, largeur de chacune, espace entre deux ; hauteur de la barre du A depuis le bas, et
  // largeur de la panse haute du B en part de la basse, en fraction de la hauteur ; terminaisons du S (degrés).
  lettres: { haut: 0.4, bas: 0.6, largeurs: [0.125, 0.1, 0.1], espace: 0.032, barreA: 0.36, panseHaute: 0.88, terminaisonS: 25 },
};

function lettresABS(q, s) {
  const L = ABS.lettres, [la, lb, ls] = L.largeurs.map((l) => l * s);
  const total = la + lb + ls + 2 * L.espace * s;
  const [x0, haut] = q(MILIEU, L.haut), bas = q(MILIEU, L.bas)[1], h = bas - haut, milieu = haut + h / 2;
  let x = x0 - total / 2;
  // A : deux jambages et la barre, posée sur les jambages.
  const yBarre = bas - h * L.barreA, retrait = (la / 2) * L.barreA;
  const a = `${trace([[x, bas], [x + la / 2, haut], [x + la, bas]], false)} ${trace([[x + retrait, yBarre], [x + la - retrait, yBarre]], false)}`;
  x += la + L.espace * s;
  // B : le fût et deux panses en demi-cercles.
  const rh = (milieu - haut) / 2, rb = (bas - milieu) / 2, lh = lb * L.panseHaute;
  const b = `M${pt([x, bas])} L${pt([x, haut])} L${pt([x + lh - rh, haut])} A${ecrit(rh)} ${ecrit(rh)} 0 0 1 ${pt([x + lh - rh, milieu])} `
    + `L${pt([x, milieu])} M${pt([x + lh - rh, milieu])} L${pt([x + lb - rb, milieu])} A${ecrit(rb)} ${ecrit(rb)} 0 0 1 ${pt([x + lb - rb, bas])} L${pt([x, bas])}`;
  x += lb + L.espace * s;
  // S : deux demi-ellipses enchaînées, de la terminaison haute à droite à la terminaison basse à gauche.
  const cx = x + ls / 2, rx = ls / 2, ry = h / 4, t = radians(L.terminaisonS);
  const debut = [cx + rx * Math.cos(-t), haut + ry + ry * Math.sin(-t)];
  const fin = [cx + rx * Math.cos(Math.PI - t), bas - ry + ry * Math.sin(Math.PI - t)];
  const sLettre = `M${pt(debut)} A${ecrit(rx)} ${ecrit(ry)} 0 1 0 ${pt([cx, milieu])} A${ecrit(rx)} ${ecrit(ry)} 0 1 1 ${pt(fin)}`;
  return `${a} ${b} ${sLettre}`;
}

function abs({ q, s, couleur }) {
  const [cx, cy] = q(MILIEU, MILIEU);
  return [
    n("circle", { cx, cy, r: ABS.cercle * s, ...traitDe(couleur, TRAIT_FIN) }),
    n("path", { d: lettresABS(q, s), ...traitDe(couleur, TRAIT_FIN) }),
    n("path", { d: arcsLateraux(q, s, FREINAGE.arcs), ...traitDe(couleur, TRAIT, "butt") }),
  ];
}

const PNEUS = {
  // Coupe du pneu (la moitié gauche, la droite en miroir) : talon, épaule du flanc (point de contrôle), point le plus large et
  // longueur de ses tangentes verticales, coin de la bande de roulement et son arrondi.
  talon: { u: 0.215, haut: 0.1, bas: 0.235 },
  epaule: [0.18, 0.3],
  flanc: { u: 0.105, v: 0.51, tangente: 0.13 },
  coin: { u: 0.235, v: 0.8, arrondi: 0.07 },
  pains: { nombre: 5, largeur: 0.052, bas: 0.885, pas: 0.09 },
  exclamation: { haut: 0.25, bas: 0.545, largeurHaut: 0.08, largeurBas: 0.045, point: 0.665, rayonPoint: 0.036 },
};

function pneus({ q, s, couleur }) {
  const F = PNEUS, t = F.talon, f = F.flanc, c = F.coin, e = F.exclamation, p = F.pains;
  const Q = (u, v) => pt(q(u, v)), miroir = (u) => 1 - u;
  const coupe = `M${Q(t.u, t.haut)} L${Q(t.u, t.bas)} C${Q(...F.epaule)} ${Q(f.u, f.v - f.tangente)} ${Q(f.u, f.v)} `
    + `C${Q(f.u, f.v + f.tangente)} ${Q(c.u - c.arrondi, c.v)} ${Q(c.u, c.v)} L${Q(miroir(c.u), c.v)} `
    + `C${Q(miroir(c.u - c.arrondi), c.v)} ${Q(miroir(f.u), f.v + f.tangente)} ${Q(miroir(f.u), f.v)} `
    + `C${Q(miroir(f.u), f.v - f.tangente)} ${Q(miroir(F.epaule[0]), F.epaule[1])} ${Q(miroir(t.u), t.bas)} L${Q(miroir(t.u), t.haut)}`;
  const [cx, haut] = q(MILIEU, e.haut), bas = q(MILIEU, e.bas)[1], rh = (e.largeurHaut * s) / 2, rb = (e.largeurBas * s) / 2;
  const barre = `M${pt([cx - rh, haut])} A${ecrit(rh)} ${ecrit(rh)} 0 0 1 ${pt([cx + rh, haut])} L${pt([cx + rb, bas])} `
    + `A${ecrit(rb)} ${ecrit(rb)} 0 0 1 ${pt([cx - rb, bas])} Z`;
  return [
    n("path", { d: coupe, ...traitDe(couleur, TRAIT) }),
    Array.from({ length: p.nombre }, (_, i) => {
      const [x, y] = q(MILIEU + (i - (p.nombre - 1) / 2) * p.pas - p.largeur / 2, c.v);
      return n("rect", { x, y, width: p.largeur * s, height: (p.bas - c.v) * s, ...plein(couleur) });
    }),
    n("path", { d: barre, ...plein(couleur) }),
    n("circle", { cx, cy: q(MILIEU, e.point)[1], r: e.rayonPoint * s, ...plein(couleur) }),
  ];
}

const PRECHAUFFAGE = {
  // Spirale vue de côté (cycloïde allongée) : u = origine + pas × t + boucle × sin t, v = milieu − demiHauteur × cos t, sur
  // `boucles` tours, prolongée de `bout` radians à chaque extrémité ; tracée en `segments` courbes de Bézier.
  origine: 0.18, pas: 0.051, boucle: 0.2, milieu: 0.4775, demiHauteur: 0.2275, boucles: 2, bout: 0.45, segments: 40,
};

function prechauffage({ q, couleur }) {
  const F = PRECHAUFFAGE;
  const u = (t) => F.origine + F.pas * t + F.boucle * Math.sin(t), v = (t) => F.milieu - F.demiHauteur * Math.cos(t);
  const du = (t) => F.pas + F.boucle * Math.cos(t), dv = (t) => F.demiHauteur * Math.sin(t);
  const debut = -F.bout, fin = 2 * Math.PI * F.boucles + F.bout, h = (fin - debut) / F.segments;
  let d = `M${pt(q(u(debut), v(debut)))}`;
  for (let i = 0; i < F.segments; i++) {
    const a = debut + i * h, b = a + h;
    d += ` C${pt(q(u(a) + du(a) * h * TIERS, v(a) + dv(a) * h * TIERS))} ${pt(q(u(b) - du(b) * h * TIERS, v(b) - dv(b) * h * TIERS))} ${pt(q(u(b), v(b)))}`;
  }
  return [n("path", { d, ...traitDe(couleur, TRAIT) })];
}

const RESERVE = {
  colonne: { gauche: 0.18, droite: 0.55, haut: 0.12, rayon: 0.05 },
  vitre: 0.41,
  socle: { gauche: 0.13, droite: 0.6, v: 0.86 },
  // Tuyau : sortie de la colonne, coude vers le bas, boucle en U, remontée jusqu'au pistolet.
  tuyau: { v: 0.43, coude: 0.645, rayonCoude: 0.04, descente: 0.745, remontee: 0.815, haut: 0.34 },
  pistolet: { pointe: [0.625, 0.115], dos: [[0.8, 0.16], [0.865, 0.34]], ventre: [[0.76, 0.215], [0.775, 0.34]] },
};

function reserve({ q, s, couleur }) {
  const F = RESERVE, c = F.colonne, t = F.tuyau, p = F.pistolet;
  const Q = (u, v) => pt(q(u, v));
  const colonne = `M${Q(c.gauche, F.socle.v)} L${Q(c.gauche, c.haut + c.rayon)} Q${Q(c.gauche, c.haut)} ${Q(c.gauche + c.rayon, c.haut)} `
    + `L${Q(c.droite - c.rayon, c.haut)} Q${Q(c.droite, c.haut)} ${Q(c.droite, c.haut + c.rayon)} L${Q(c.droite, F.socle.v)} `
    + `M${Q(c.gauche, F.vitre)} L${Q(c.droite, F.vitre)} M${Q(F.socle.gauche, F.socle.v)} L${Q(F.socle.droite, F.socle.v)}`;
  const rayonU = ((t.remontee - t.coude) / 2) * s;
  const tuyau = `M${Q(c.droite, t.v)} L${Q(t.coude - t.rayonCoude, t.v)} Q${Q(t.coude, t.v)} ${Q(t.coude, t.v + t.rayonCoude)} `
    + `L${Q(t.coude, t.descente)} A${ecrit(rayonU)} ${ecrit(rayonU)} 0 0 0 ${Q(t.remontee, t.descente)} L${Q(t.remontee, t.haut)}`;
  const pistolet = `M${Q(...p.pointe)} Q${Q(...p.dos[0])} ${Q(...p.dos[1])} L${Q(...p.ventre[1])} Q${Q(...p.ventre[0])} ${Q(...p.pointe)} Z`;
  return [
    n("path", { d: colonne, ...traitDe(couleur, TRAIT, "butt"), "data-r": "colonne", "data-x": q((c.gauche + c.droite) / 2, c.haut)[0] }),
    n("path", { d: tuyau, ...traitDe(couleur, TRAIT, "butt"), "data-r": "tuyau", "data-x": q(t.remontee, t.haut)[0] }),
    n("path", { d: pistolet, ...plein(couleur) }),
  ];
}

const CLIGNOTANTS = { pointe: 0.03, base: 0.255, queue: 0.42, demiTete: 0.24, demiCorps: 0.095 };

function clignotants({ q, couleur }) {
  const F = CLIGNOTANTS;
  const forme = (u) => [
    [u(F.pointe), MILIEU], [u(F.base), MILIEU - F.demiTete], [u(F.base), MILIEU - F.demiCorps], [u(F.queue), MILIEU - F.demiCorps],
    [u(F.queue), MILIEU + F.demiCorps], [u(F.base), MILIEU + F.demiCorps], [u(F.base), MILIEU + F.demiTete],
  ].map(([a, b]) => q(a, b));
  return [["gauche", (u) => u], ["droite", (u) => 1 - u]].map(([cote, u]) => {
    const points = forme(u);
    return n("path", { d: `${trace(points, false)} Z`, ...plein(couleur), "data-r": `cligno-${cote}`, "data-x": points[1][0], "data-pointe": points[0][0] });
  });
}

const PHARE = {
  // Lampe : bord gauche (le verre, légèrement bombé vers les faisceaux), haut et bas, fin de la partie droite avant le
  // demi-cercle du dos.
  lampe: { gauche: 0.475, haut: 0.245, bas: 0.76, finCorps: 0.645, renflement: 0.022 },
  // Faisceaux : quatre traits (la norme en permet quatre ou cinq) ; feux de croisement, inclinés de `chute` vers le bas.
  faisceaux: { nombre: 4, gauche: 0.09, droite: 0.405, haut: 0.27, bas: 0.735, chute: 0.08 },
};

function phare({ q, s, couleur }, croisement) {
  const L = PHARE.lampe, F = PHARE.faisceaux;
  const Q = (u, v) => pt(q(u, v)), r = ((L.bas - L.haut) / 2) * s;
  const lampe = `M${Q(L.gauche, L.haut)} L${Q(L.finCorps, L.haut)} A${ecrit(r)} ${ecrit(r)} 0 0 1 ${Q(L.finCorps, L.bas)} `
    + `L${Q(L.gauche, L.bas)} Q${Q(L.gauche - 2 * L.renflement, (L.haut + L.bas) / 2)} ${Q(L.gauche, L.haut)} Z`;
  const chute = croisement ? F.chute : 0;
  return [
    n("path", { d: lampe, ...traitDe(couleur, TRAIT), "data-r": "lampe", "data-x": q(L.gauche, L.haut)[0] }),
    Array.from({ length: F.nombre }, (_, i) => {
      const v = F.haut + (i * (F.bas - F.haut)) / (F.nombre - 1);
      const [a, b] = [q(F.droite, v), q(F.gauche, v + chute)];
      return n("path", { d: trace([a, b], false), ...traitDe(couleur, TRAIT, "butt"), "data-r": "faisceau", "data-x": b[0], "data-chute": chute * s });
    }),
  ];
}

const PICTOGRAMMES = {
  huile, temperature, freinage, batterie, airbag, abs, pneus, prechauffage, reserve, clignotants,
  croisement: (c) => phare(c, true), route: (c) => phare(c, false),
};

/** Le pictogramme normalisé du voyant `nom`, centré en (x, y) dans un carré de côté `taille` (le carré de base de la norme),
 *  tracé de la seule `couleur`. Un nom inconnu est une erreur, jamais un symbole deviné. */
export function pictogramme(nom, { x, y, taille, couleur }) {
  if (!Object.prototype.hasOwnProperty.call(PICTOGRAMMES, nom)) throw new Error(`Pictogramme « ${nom} » inconnu : ${Object.keys(PICTOGRAMMES).join(", ")} attendu.`);
  const q = (u, v) => [x - taille / 2 + u * taille, y - taille / 2 + v * taille];
  return n("g", { "data-r": `picto-${nom}`, "data-x": x, "data-y": y }, PICTOGRAMMES[nom]({ q, s: taille, couleur }));
}

// ------------------------------------------------------------------------------------------------ Texte

// Repères d'Outfit, en tailles de texte (METRIQUES_POLICE du kit) : haut d'une ligne de minuscules ou de capitales sans accent,
// bas des jambages, milieu des capitales au-dessus de la ligne de base ; pas des lignes, celui des étiquettes du kit.
const { haut: HAUT_TEXTE, bas: BAS_TEXTE, milieuCapitales: MILIEU_CAPITALES, interligne: INTERLIGNE } = METRIQUES_POLICE;
// Noms sous les voyants : taille et graisse.
const NOM = { taille: CHARTE.tailles.petite, interligne: CHARTE.tailles.petite * INTERLIGNE, graisse: 500 };

// ------------------------------------------------------------------------------------------------ Planche « voyants »

// Mise en page de la planche : marges, tuiles et pictogrammes, pas des tuiles d'une rangée, écarts verticaux ; en-tête
// d'un groupe : pastilles de couleur, nom de la couleur, conduite à tenir alignée sur une colonne commune.
const PLANCHE = {
  largeur: 320, hauteur: 380,
  marge: 8,
  tuile: 32, rayonTuile: 6, picto: 27, pas: 76,
  ecartNom: 4, ecartRangees: 5, ecartEnTete: 7, ecartGroupes: 12,
  enTete: { taille: CHARTE.tailles.etiquette, interligne: 15, pastille: 4.5, ecartPastilles: 3, ecartNom: 6, xConduite: 118 },
};

const GROUPES = [
  { cle: "rouge", couleurs: ["rouge"], nom: "Rouge", conduite: ["S'arrêter dès que possible", "en sécurité, couper le moteur"],
    rangees: [["huile", "temperature", "freinage"], ["batterie", "airbag"]] },
  { cle: "orange", couleurs: ["orange"], nom: "Orange", conduite: ["Poursuivre prudemment,", "faire contrôler sans attendre"],
    rangees: [["abs", "pneus", "prechauffage", "reserve"]] },
  { cle: "vert-bleu", couleurs: ["vert", "bleu"], nom: "Vert ou bleu", conduite: ["Aucune action"],
    rangees: [["clignotants", "croisement", "route"]] },
];

// Les mots du tableau du cours, sur une ou deux lignes ; le seul voyant bleu est dit bleu, comme dans le cours.
const NOMS_PLANCHE = {
  huile: ["Pression", "d'huile"], temperature: ["Température", "moteur"], freinage: ["Freinage"],
  batterie: ["Charge", "de la batterie"], airbag: ["Airbag"], abs: ["ABS"], pneus: ["Pression", "des pneus"],
  prechauffage: ["Préchauffage"], reserve: ["Réserve de", "carburant"], clignotants: ["Clignotants"],
  croisement: ["Feux de", "croisement"], route: ["Feux de route", "(bleu)"],
};

const TITRE_PLANCHE = "Les voyants et leur couleur";
const DESCRIPTION_PLANCHE = "Douze voyants groupés par couleur. Rouge : pression d'huile, température moteur, freinage, "
  + "charge de la batterie, airbag ; s'arrêter dès que possible en sécurité, couper le moteur. Orange : ABS, pression des "
  + "pneus, préchauffage, réserve de carburant ; poursuivre prudemment, faire contrôler sans attendre. Vert ou bleu : "
  + "clignotants, feux de croisement, feux de route en bleu ; aucune action.";

function tuileVoyant(nom, x, yHaut) {
  const P = PLANCHE, yCentre = yHaut + P.tuile / 2, lignes = NOMS_PLANCHE[nom];
  const premiere = yHaut + P.tuile + P.ecartNom + HAUT_TEXTE * NOM.taille;
  return n("g", { "data-r": `voyant-${nom}`, "data-couleur": COULEUR_DE[nom], "data-x": x, "data-y": yCentre },
    n("rect", { x: x - P.tuile / 2, y: yHaut, width: P.tuile, height: P.tuile, rx: P.rayonTuile, fill: TABLEAU.fond, "data-r": "tuile" }),
    pictogramme(nom, { x, y: yCentre, taille: P.picto, couleur: COULEURS_VOYANTS[COULEUR_DE[nom]] }),
    lignes.map((l, i) => texte(x, premiere + i * NOM.interligne, l, { taille: NOM.taille, ancrage: "middle", graisse: NOM.graisse })));
}

// Un groupe à partir de `yHaut` : { noeud, bas }.
function groupe(g, yHaut) {
  const P = PLANCHE, E = P.enTete, T = E.taille;
  const base = yHaut + HAUT_TEXTE * T, yPastille = base - MILIEU_CAPITALES * T;
  const pastilles = g.couleurs.map((c, i) => n("circle", {
    cx: P.marge + E.pastille + i * (2 * E.pastille + E.ecartPastilles), cy: yPastille, r: E.pastille, fill: COULEURS_VOYANTS[c] }));
  const xNom = P.marge + g.couleurs.length * 2 * E.pastille + (g.couleurs.length - 1) * E.ecartPastilles + E.ecartNom;
  const basEnTete = base + (g.conduite.length - 1) * E.interligne + BAS_TEXTE * T;
  let y = basEnTete + P.ecartEnTete;
  const rangees = g.rangees.map((noms, k) => {
    if (k > 0) y += P.ecartRangees;
    const yTuile = y;
    const lignes = Math.max(...noms.map((nom) => NOMS_PLANCHE[nom].length));
    y = yTuile + P.tuile + P.ecartNom + HAUT_TEXTE * NOM.taille + (lignes - 1) * NOM.interligne + BAS_TEXTE * NOM.taille;
    return noms.map((nom, i) => tuileVoyant(nom, P.largeur / 2 + (i - (noms.length - 1) / 2) * P.pas, yTuile));
  });
  const noeud = n("g", { "data-r": `groupe-${g.cle}` },
    pastilles,
    texte(xNom, base, g.nom, { taille: T, graisse: 700, role: `couleur-${g.cle}` }),
    n("g", { "data-r": `conduite-${g.cle}` },
      g.conduite.map((l, i) => texte(E.xConduite, base + i * E.interligne, l, { taille: T, graisse: 500 }))),
    rangees);
  return { noeud, bas: y };
}

function planche() {
  const P = PLANCHE;
  const morceaux = [];
  let y = P.marge;
  GROUPES.forEach((g, i) => {
    if (i > 0) {
      const yFilet = y + P.ecartGroupes / 2;
      morceaux.push(n("line", { x1: P.marge, y1: yFilet, x2: P.largeur - P.marge, y2: yFilet, stroke: CHARTE.filet, "stroke-width": TRAIT_FIN }));
      y += P.ecartGroupes;
    }
    const { noeud, bas } = groupe(g, y);
    morceaux.push(noeud);
    y = bas;
  });
  if (y + P.marge > P.hauteur) throw new Error(`Planche des voyants : ${ecrit(y + P.marge)} unités de haut pour un cadre de ${P.hauteur}.`);
  return cadre({ largeur: P.largeur, hauteur: P.hauteur, titre: TITRE_PLANCHE, description: DESCRIPTION_PLANCHE }, morceaux);
}

// ------------------------------------------------------------------------------------------------ Geste « autotest »

/** Régime de ralenti montré par l'aiguille du compte-tours une fois le moteur démarré (tr/min). */
export const RALENTI = 800;

// Déroulé (secondes) : début des trois étapes et durée ; le changement de chaque étape arrive `delai` après son début (le
// temps de lire l'étape) : mise du contact, fin de l'autotest, démarrage du moteur. Les six voyants et la pastille
// « Contact » s'allument ensemble en `allumage` ; un voyant s'éteint en `extinction` ; la pastille « Moteur » s'allume en
// `allumage` ; l'aiguille monte au ralenti en `montee`, et huile et charge finissent de s'éteindre quand elle l'atteint.
const DEROULE = { debuts: [0, 2.4, 4.4], duree: 7, delai: 0.4, allumage: 0.2, extinction: 0.12, montee: 1 };

// Les six voyants du combiné, en deux rangées ; ceux qui s'éteignent à la fin de l'autotest, puis quand le moteur tourne.
const RANGEES_AUTOTEST = [["airbag", "abs", "pneus"], ["temperature", "huile", "batterie"]];
const FIN_AUTOTEST = ["airbag", "abs", "pneus", "temperature"];
const DEMARRAGE = ["huile", "batterie"];
const SIX = [...FIN_AUTOTEST, ...DEMARRAGE];
// Noms courts sous les voyants du combiné : ceux des étapes du cours (« sauf huile et charge »).
const NOMS_AUTOTEST = { airbag: "Airbag", abs: "ABS", pneus: "Pneus", temperature: "Température", huile: "Huile", batterie: "Charge" };

// Combiné (le cadre sombre, un aplat), cadran du compte-tours en pictogramme (son arc, de 0 à 7 000 tr/min sur 240 degrés, de
// 8 h à 4 h, un trait tous les 1 000 tr/min, l'aiguille du moyeu à sa pointe ; nommé dessous), voyants en deux rangées de
// trois, repère « Contact » et « Moteur » sous les voyants.
const COMBINE = {
  largeur: 320, hauteur: 200,
  panneau: { x: 8, y: 8, largeur: 304, hauteur: 138, rayon: 14 },
  cadran: { cx: 76, cy: 74, rayon: 46, regimeMax: 7000, pasGraduations: 1000, angleZero: -120, angleMax: 120,
    graduation: 39, aiguille: 40, moyeu: 4.5, ecartNom: 4, flecheRayon: 52 },
  voyants: { colonnes: [168, 226, 284], rangees: [42, 98], taille: 24, ecartNom: 6 },
  // Repère : deux pastilles ; dans chacune, un témoin rond (plein quand l'état est atteint, creux sinon) puis le mot.
  repere: { centre: 226, y: 164, largeur: 78, hauteur: 22, ecart: 6, temoin: 4, xTemoin: 12, xMot: 22 },
  // Marques des étapes : jeu de la pointe des flèches du contact et du moteur au bord du combiné ; rayon de l'anneau autour d'un
  // voyant (il passe entre le symbole et son nom).
  marques: { jeu: 2, anneau: 14 },
};
const NOM_CADRAN = "Compte-tours";

// Ce que chaque étape change, montré par ses marques (dans le groupe de la flèche, visibles sur une image figée seulement) :
// étape 1, la flèche du repère « Contact » vers le combiné, qui s'allume ; étapes 2 et 3, un anneau autour de chaque voyant
// qui va s'éteindre ; étape 3, en plus, la flèche du repère « Moteur » vers le combiné (le moteur démarre) et celle de la montée
// de l'aiguille.
const MARQUES = [
  { contact: true, moteur: false, anneaux: [], aiguille: false },
  { contact: false, moteur: false, anneaux: FIN_AUTOTEST, aiguille: false },
  { contact: false, moteur: true, anneaux: DEMARRAGE, aiguille: true },
];

// Angle (degrés depuis midi, sens horaire) et point du cadran à un régime donné.
const angleRegime = (regime) => {
  const C = COMBINE.cadran;
  return C.angleZero + ((C.angleMax - C.angleZero) * regime) / C.regimeMax;
};
const surCadran = (angle, r) => {
  const C = COMBINE.cadran, a = radians(angle);
  return [C.cx + r * Math.sin(a), C.cy - r * Math.cos(a)];
};

function etatAutotest(t) {
  const D = DEROULE, [debut1, debut2, debut3] = D.debuts;
  const contact = debut1 + D.delai, finAutotest = debut2 + D.delai, demarrage = debut3 + D.delai;
  // Huile et charge restent allumés tant que le moteur ne tourne pas : ils finissent de s'éteindre à l'instant où l'aiguille
  // atteint le ralenti.
  const finHuileCharge = demarrage + D.montee - D.extinction;
  const allume = sortieDouce(avancement(t, contact, contact + D.allumage));
  const eteint = (debut) => sortieDouce(avancement(t, debut, debut + D.extinction));
  const voyants = {};
  for (const nom of FIN_AUTOTEST) voyants[nom] = allume * (1 - eteint(finAutotest));
  for (const nom of DEMARRAGE) voyants[nom] = allume * (1 - eteint(finHuileCharge));
  return {
    // Luminosité de chaque voyant (0 éteint, 1 allumé), et ceux qui éclairent à cet instant.
    voyants,
    allumes: SIX.filter((nom) => voyants[nom] > 0),
    // Repère : part allumée de chaque pastille ; « Contact » reste allumé une fois le moteur démarré.
    repere: {
      contact: sortieDouce(avancement(t, contact, contact + D.allumage)),
      moteur: sortieDouce(avancement(t, demarrage, demarrage + D.allumage)),
    },
    regime: RALENTI * adoucir(avancement(t, demarrage, demarrage + D.montee)),
  };
}

function pointsFleches() {
  const C = COMBINE, R = C.repere, P = C.panneau;
  const vers = (cote) => { const x = R.centre + (cote * (R.largeur + R.ecart)) / 2; return [[x, R.y - TRAIT], [x, P.y + P.hauteur + C.marques.jeu]]; };
  const a0 = angleRegime(0), a1 = angleRegime(RALENTI), r = C.cadran.flecheRayon;
  return {
    // Du haut de la pastille « Contact », puis de celle de « Moteur », au bord du combiné.
    contact: vers(-1), moteur: vers(1),
    // Juste hors du cadran, le long de la course de l'aiguille, de 0 au ralenti.
    aiguille: [surCadran(a0, r), surCadran((a0 + a1) / 2, r), surCadran(a1, r)],
  };
}

const TITRE_AUTOTEST = "L'autotest des voyants";
const DESCRIPTION_AUTOTEST = "Combiné d'instruments, contact coupé : tout est éteint. À la mise du contact, six voyants "
  + "s'allument ensemble : airbag, ABS, pression des pneus, température moteur, pression d'huile, charge de la batterie. À "
  + "la fin de l'autotest, ils s'éteignent, sauf huile et charge, qui restent allumés jusqu'à ce que le moteur tourne : au "
  + "démarrage, l'aiguille du compte-tours monte au ralenti, puis ils s'éteignent à leur tour.";

// Une image du geste : l'état de l'instant, toujours ; `fige` ne fait que montrer le groupe de la flèche de l'étape (ses
// marques), seule différence entre une image figée et l'image de lecture du même instant.
function dessinerAutotest(etat, { fige, etape }) {
  const C = COMBINE, P = C.panneau, D = C.cadran, V = C.voyants, R = C.repere;
  // L'arc du cadran, de 0 au régime maximal par le haut (plus d'un demi-tour, dans le sens des aiguilles d'une montre).
  const [xDebut, yDebut] = surCadran(D.angleZero, D.rayon), [xFin, yFin] = surCadran(D.angleMax, D.rayon);
  const cadranNoeuds = [
    n("path", { d: `M${pt([xDebut, yDebut])} A${ecrit(D.rayon)} ${ecrit(D.rayon)} 0 1 1 ${pt([xFin, yFin])}`,
      ...traitDe(TABLEAU.graduation, TRAIT, "butt"), "data-r": "arc-cadran" }),
  ];
  for (let regime = 0; regime <= D.regimeMax; regime += D.pasGraduations) {
    const a = angleRegime(regime);
    const [x1, y1] = surCadran(a, D.graduation), [x2, y2] = surCadran(a, D.rayon);
    cadranNoeuds.push(n("line", { x1, y1, x2, y2, stroke: TABLEAU.graduation, "stroke-width": TRAIT, "data-r": "graduation" }));
  }
  cadranNoeuds.push(texte(D.cx, D.cy + D.rayon + D.ecartNom + HAUT_TEXTE * NOM.taille, NOM_CADRAN,
    { taille: NOM.taille, ancrage: "middle", graisse: NOM.graisse, couleur: TABLEAU.legende }));
  // L'aiguille part du moyeu ; sa pointe est un point dessiné (data-x, data-y), suivi par le contrôle de continuité commun.
  const angle = angleRegime(etat.regime);
  const [xa, ya] = surCadran(angle, D.aiguille);
  cadranNoeuds.push(
    n("line", { x1: D.cx, y1: D.cy, x2: xa, y2: ya, stroke: TABLEAU.aiguille, "stroke-width": CHARTE.traits.appuye, "stroke-linecap": "round",
      "data-r": "aiguille", "data-angle": angle, "data-x": xa, "data-y": ya }),
    n("circle", { cx: D.cx, cy: D.cy, r: D.moyeu, fill: TABLEAU.aiguille, "data-r": "moyeu" }));

  const places = RANGEES_AUTOTEST.flatMap((rangee, k) => rangee.map((nom, i) => ({ nom, x: V.colonnes[i], y: V.rangees[k] })));
  const voyants = places.map(({ nom, x, y }) => n("g", { "data-r": `combine-${nom}` },
    pictogramme(nom, { x, y, taille: V.taille, couleur: TABLEAU.eteint }),
    n("g", { "data-r": `allume-${nom}`, opacity: etat.voyants[nom] },
      pictogramme(nom, { x, y, taille: V.taille, couleur: COULEURS_VOYANTS[COULEUR_DE[nom]] })),
    texte(x, y + V.taille / 2 + V.ecartNom + HAUT_TEXTE * NOM.taille, NOMS_AUTOTEST[nom],
      { taille: NOM.taille, ancrage: "middle", graisse: NOM.graisse, couleur: TABLEAU.legende })));

  // Le mot reste sombre sur la pastille claire, l'état passe par le témoin (plein ou creux) et par le fond de la pastille :
  // lisible à chaque image.
  const pastilles = [["contact", "Contact", -1], ["moteur", "Moteur", 1]].map(([cle, mot, cote]) => {
    const actif = etat.repere[cle];
    const x0 = R.centre + cote * (R.largeur + R.ecart) / 2 - R.largeur / 2, yc = R.y + R.hauteur / 2;
    const forme = { x: x0, y: R.y, width: R.largeur, height: R.hauteur, rx: R.hauteur / 2 };
    const taille = CHARTE.tailles.etiquette;
    return n("g", { "data-r": `pastille-${cle}` },
      n("rect", { ...forme, fill: CHARTE.carte, stroke: CHARTE.filetFort, "stroke-width": TRAIT_FIN }),
      n("rect", { ...forme, fill: CHARTE.accentDoux, stroke: CHARTE.accent, "stroke-width": TRAIT_FIN, opacity: actif, "data-r": `actif-${cle}` }),
      n("circle", { cx: x0 + R.xTemoin, cy: yc, r: R.temoin, fill: "none", stroke: CHARTE.accentFort, "stroke-width": TRAIT }),
      n("circle", { cx: x0 + R.xTemoin, cy: yc, r: R.temoin, fill: CHARTE.accentFort, opacity: actif }),
      texte(x0 + R.xMot, yc + MILIEU_CAPITALES * taille, mot, { taille, graisse: 600, role: `repere-${cle}` }));
  });

  const m = MARQUES[etape], f = pointsFleches(), montre = (oui) => (oui ? "inline" : "none");
  const marques = n("g", { "data-r": "fleche", display: montre(fige) },
    fleche(f.contact, { role: "fleche-contact", visible: m.contact }),
    fleche(f.moteur, { role: "fleche-moteur", visible: m.moteur }),
    fleche(f.aiguille, { role: "fleche-aiguille", visible: m.aiguille }),
    places.map(({ nom, x, y }) => n("circle", { cx: x, cy: y, r: C.marques.anneau, fill: "none", stroke: CHARTE.accentDoux2,
      "stroke-width": TRAIT, display: montre(m.anneaux.includes(nom)), "data-r": `anneau-${nom}` })));

  return cadre({ largeur: C.largeur, hauteur: C.hauteur, titre: TITRE_AUTOTEST, description: DESCRIPTION_AUTOTEST },
    n("rect", { x: P.x, y: P.y, width: P.largeur, height: P.hauteur, rx: P.rayon, fill: TABLEAU.fond, "data-r": "combine" }),
    n("g", { "data-r": "compte-tours" }, cadranNoeuds),
    voyants,
    pastilles,
    marques);
}

function autotest() {
  const D = DEROULE;
  // Variation maximale en une image (1/60 s) : allumage en 0,2 s, 0,23 au plus ; extinction en 0,12 s, 0,36 au plus ; une
  // pastille du repère s'allume en 0,2 s, 0,23 au plus. La raison est dans les sources du geste.
  const sautsMax = { "repere.contact": 0.3, "repere.moteur": 0.3 };
  for (const nom of SIX) sautsMax[`voyants.${nom}`] = 0.4;
  return {
    titre: TITRE_AUTOTEST,
    description: DESCRIPTION_AUTOTEST,
    cadre: [COMBINE.largeur, COMBINE.hauteur],
    duree: D.duree,
    etapes: D.debuts.map((t) => ({ t })),
    sautsMax,
    etat: etatAutotest,
    dessiner: dessinerAutotest,
  };
}

// ------------------------------------------------------------------------------------------------ Registres

export const DESSINS = { voyants: planche };
export const GESTES = { autotest: { construire: autotest } };
export { versDom } from "./dessin-svg.js?v=20261024d";
