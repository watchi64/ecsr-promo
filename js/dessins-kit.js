/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Charte des dessins des cours de compétences et pièces communes. Illustration à plat, deux ou trois tons par
 * matière, sans dégradé ni ombre floue ; police de l'app ; « Juste » et « Faux » toujours écrits. Un dessin fait
 * 320 unités de large et se lit sur un téléphone (343 px) : texte d'au moins 11 px, trait d'au moins 1 px
 * (tests/aides-dessins.mjs).
 */
import { n } from "./dessin-svg.js?v=20261013a";

export const CHARTE = {
  fond: "#F1F4F0", carte: "#FBFCFA", texte: "#1F2924", texteDoux: "#46554A", texteDiscret: "#6E7A6F",
  accent: "#6B7F4E", accentFort: "#556641", accentDoux: "#EAEFD9", accentDoux2: "#D8E1C0",
  filet: "#D8DED2", filetFort: "#B7C0AA",
  juste: "#4D7C0F", justeFond: "#ECF6D5", faux: "#A05A3D", fauxFond: "#F6E4D7",
  police: "Outfit, -apple-system, 'Segoe UI', sans-serif",
  traits: { fin: 1, moyen: 1.5, appuye: 2.5, fort: 4 },
  tailles: { petite: 11, etiquette: 12, titre: 13 },
};
/** Largeur de lecture d'un dessin sur un iPhone de 375 px, marges du cours déduites. */
export const LARGEUR_TELEPHONE = 343;
export const TAILLE_TEXTE_MIN_PX = 11;
export const TRAIT_MIN_PX = 1;

// Choix de dessin des pièces communes, en unités du cadre. Repères d'Outfit en tailles de texte (mesurés dans Chrome) :
// capitales 0,70 au-dessus de la ligne de base, accents des capitales 0,98, jambages 0,22.
const RAYON_CADRE = 10;
const RAYON_VIGNETTE = 8;
const MARGE_PASTILLE = 8;           // de la pastille aux bords de sa vignette
const ESPACE_ETIQUETTE = 4;         // du bout du filet au texte
const INTERLIGNE = 1.25;            // pas des lignes d'une étiquette, en tailles de texte
const RAYON_POINT = 2.2;            // point posé sur l'objet désigné
const HALO = 1;                     // liseré clair sous le filet et le point : ils restent lisibles sur un objet sombre
const MILIEU_CAPITALES = 0.35;      // ligne de base sous le milieu des capitales
const HAUT_TEXTE = 0.8, HAUT_TEXTE_ACCENT = 1.0, BAS_TEXTE = 0.25;
const CAPITALE_ACCENTUEE = /[ÀÂÄÉÈÊËÎÏÔÖÙÛÜŸ]/;

// Géométrie plane. Les tracés (attribut d) s'écrivent à deux décimales : jamais d'écriture flottante à rallonge.
const coord = (v) => String(Number(v.toFixed(2)));
const point = ([x, y]) => `${coord(x)} ${coord(y)}`;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1]];
const entre = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const tourner = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const angleEntre = (u, v) => Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);

/** Racine d'un dessin : cadre, fond de la charte, description pour les lecteurs d'écran. */
export function cadre({ largeur, hauteur, titre, description = "" }, ...enfants) {
  return n("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, class: "dessin-svg", role: "img",
    "aria-label": description ? `${titre}. ${description}` : titre },
  n("rect", { x: 0, y: 0, width: largeur, height: hauteur, rx: RAYON_CADRE, fill: CHARTE.fond, "data-r": "fond" }), ...enfants);
}

export function texte(x, y, contenu, { taille = CHARTE.tailles.etiquette, ancrage = "start", graisse = 400, couleur = CHARTE.texte, role } = {}) {
  return n("text", { x, y, "font-size": taille, "font-family": CHARTE.police, "font-weight": graisse, fill: couleur,
    "text-anchor": ancrage, ...(role ? { "data-r": role } : {}) }, contenu);
}

/** Étiquette : un filet fin de la cible (un point posé sur l'objet) jusqu'à l'ancre, et le texte, une ligne ou plus,
 *  qui commence à l'ancre. Ancrage « start » : le texte part à droite de l'ancre ; « end » : il finit à sa gauche ;
 *  dans les deux cas, le bloc de lignes est centré en hauteur sur l'ancre. « middle » : le texte est centré sous
 *  l'ancre quand la cible est au-dessus d'elle, au-dessus sinon. Le filet ne traverse jamais le texte. */
export function etiquette({ cible, ancre, lignes, ancrage = "start", taille = CHARTE.tailles.etiquette, role = "etiquette" }) {
  const [cx, cy] = cible, [ax, ay] = ancre;
  const pas = taille * INTERLIGNE;
  let x = ax, base;
  if (ancrage === "middle") {
    const haut = CAPITALE_ACCENTUEE.test(lignes[0]) ? HAUT_TEXTE_ACCENT : HAUT_TEXTE;
    base = cy <= ay ? ay + ESPACE_ETIQUETTE + haut * taille : ay - ESPACE_ETIQUETTE - BAS_TEXTE * taille - (lignes.length - 1) * pas;
  } else {
    x = ancrage === "end" ? ax - ESPACE_ETIQUETTE : ax + ESPACE_ETIQUETTE;
    base = ay + MILIEU_CAPITALES * taille - ((lignes.length - 1) * pas) / 2;
  }
  return n("g", { "data-r": role, "data-x": cx, "data-y": cy },
    n("line", { x1: cx, y1: cy, x2: ax, y2: ay, stroke: CHARTE.carte, "stroke-width": CHARTE.traits.fin + 2 * HALO, "stroke-linecap": "round" }),
    n("circle", { cx, cy, r: RAYON_POINT + HALO, fill: CHARTE.carte }),
    n("line", { x1: cx, y1: cy, x2: ax, y2: ay, stroke: CHARTE.texteDoux, "stroke-width": CHARTE.traits.fin, "stroke-linecap": "round" }),
    n("circle", { cx, cy, r: RAYON_POINT, fill: CHARTE.texteDoux }),
    lignes.map((l, i) => texte(x, base + i * pas, l, { taille, ancrage })));
}

// Pastille : icône (coche ou croix) puis le mot, en texte sombre sur le fond clair de l'état, la couleur de l'état
// dans le liseré et l'icône (comme les marques de correction des quiz du cours : css/cours-blocs.css). Largeur des
// mots dans Outfit 600 à 11 unités, mesurée dans Chrome : « Juste » 26,4, « Faux » 24,2.
const PASTILLE = { hauteur: 20, taille: 11, graisse: 600, gauche: 7, icone: 8, espace: 4.5, droite: 7, trait: 2 };
const MOTS = { juste: { mot: "Juste", largeur: 26.4 }, faux: { mot: "Faux", largeur: 24.2 } };

/** Pastille d'état : coche ou croix, et le mot. */
export function pastille({ x, y, etat }) {
  const juste = etat === "juste";
  const couleur = juste ? CHARTE.juste : CHARTE.faux;
  const { mot, largeur: largeurMot } = MOTS[juste ? "juste" : "faux"];
  const p = PASTILLE, ix = x + p.gauche, iy = y + (p.hauteur - p.icone) / 2;
  const q = (dx, dy) => point([ix + dx, iy + dy]);
  const trace = juste
    ? `M${q(0.6, 4.4)} L${q(3.1, 6.9)} L${q(7.6, 1.5)}`
    : `M${q(1.1, 1.1)} L${q(6.9, 6.9)} M${q(6.9, 1.1)} L${q(1.1, 6.9)}`;
  return n("g", { "data-r": `pastille-${etat}` },
    n("rect", { x, y, width: p.gauche + p.icone + p.espace + largeurMot + p.droite, height: p.hauteur, rx: p.hauteur / 2,
      fill: juste ? CHARTE.justeFond : CHARTE.fauxFond, stroke: couleur, "stroke-width": CHARTE.traits.fin }),
    n("path", { d: trace, fill: "none", stroke: couleur, "stroke-width": p.trait, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    texte(ix + p.icone + p.espace, y + p.hauteur / 2 + MILIEU_CAPITALES * p.taille, mot, { taille: p.taille, graisse: p.graisse }));
}

/** Vignette d'une paire juste et faux : la carte, son contenu, puis la pastille en haut à gauche. */
export function vignette({ x, y, largeur, hauteur, etat }, ...contenu) {
  return n("g", { "data-r": `vignette-${etat}` },
    n("rect", { x, y, width: largeur, height: hauteur, rx: RAYON_VIGNETTE, fill: CHARTE.carte, stroke: CHARTE.filet, "stroke-width": CHARTE.traits.fin }),
    ...contenu,
    pastille({ x: x + MARGE_PASTILLE, y: y + MARGE_PASTILLE, etat }));
}

// Flèche : proportions de la tête rapportées à l'épaisseur du trait ; le trait s'arrête sous la tête (son bout arrondi
// ne dépasse pas de la pointe) ; un liseré clair la détache du dessin qu'elle survole.
const TETE_LONGUEUR = 3.4, TETE_DEMI_LARGEUR = 1.6, TETE_ENCOCHE = 0.25, RETRAIT_TRAIT = 1.5, HALO_FLECHE = 1.25;

// Point fictif qui prolonge le tracé au-delà de `bout` à la courbure de ses deux derniers segments (bornée à un
// huitième de tour) : un arc donné par peu de points reste un arc jusqu'à ses extrémités, une droite reste droite.
// Sans `avantAvant` (deux points en tout), le prolongement est droit.
function prolonger(avantAvant, avant, bout) {
  const c2 = moins(bout, avant);
  let rotation = 0;
  if (avantAvant) {
    const c1 = moins(avant, avantAvant);
    const courbure = (2 * angleEntre(c1, c2)) / (Math.hypot(...c1) + Math.hypot(...c2));
    rotation = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, courbure * Math.hypot(...c2)));
  }
  const prolongement = tourner(c2, rotation);
  return [bout[0] + prolongement[0], bout[1] + prolongement[1]];
}

// Courbe lissée par une spline de Catmull-Rom centripète, en segments de Bézier cubiques [départ, contrôle, contrôle,
// arrivée] : elle passe par chaque point, sans boucle ni rebroussement.
function spline(points) {
  const m = points.length;
  const p = [prolonger(points[2], points[1], points[0]), ...points, prolonger(points[m - 3], points[m - 2], points[m - 1])];
  const segments = [];
  for (let i = 1; i + 2 < p.length; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const [l1, l2, l3] = [distance(p0, p1), distance(p1, p2), distance(p2, p3)];
    const [r1, r2, r3] = [Math.sqrt(l1), Math.sqrt(l2), Math.sqrt(l3)];
    const b1 = [0, 1].map((k) => (l1 * p2[k] - l2 * p0[k] + (2 * l1 + 3 * r1 * r2 + l2) * p1[k]) / (3 * r1 * (r1 + r2)));
    const b2 = [0, 1].map((k) => (l3 * p1[k] - l2 * p3[k] + (2 * l3 + 3 * r3 * r2 + l2) * p2[k]) / (3 * r3 * (r3 + r2)));
    segments.push([p1, b1, b2, p2]);
  }
  return segments;
}

// Segment de Bézier coupé à l'instant t (de Casteljau) : le point de la courbe et la première partie du segment.
function couperSegment(s, t) {
  const a = entre(s[0], s[1], t), b = entre(s[1], s[2], t), c = entre(s[2], s[3], t);
  const d = entre(a, b, t), e = entre(b, c, t), f = entre(d, e, t);
  return { point: f, debut: [s[0], a, d, f] };
}

// La courbe arrêtée là où elle passe à `rayon` de son dernier point ; vide si elle est tout entière plus près.
function arreter(segments, rayon) {
  const fin = segments[segments.length - 1][3];
  for (let j = segments.length - 1; j >= 0; j--) {
    if (distance(segments[j][0], fin) < rayon) continue;
    let [loin, pres] = [0, 1];
    for (let k = 0; k < 40; k++) {
      const t = (loin + pres) / 2;
      if (distance(couperSegment(segments[j], t).point, fin) >= rayon) loin = t; else pres = t;
    }
    return [...segments.slice(0, j), couperSegment(segments[j], loin).debut];
  }
  return [];
}

// Direction de la courbe à son arrivée (vecteur unitaire) ; vers la droite pour une courbe réduite à un point.
function directionArrivee(segments) {
  const s = segments[segments.length - 1];
  for (const controle of [s[2], s[1], s[0]]) {
    const l = distance(controle, s[3]);
    if (l > 1e-6) return [(s[3][0] - controle[0]) / l, (s[3][1] - controle[1]) / l];
  }
  return [1, 0];
}

/** Flèche du mouvement d'une étape (images figées des gestes) : un trait lissé qui passe par les points donnés, et
 *  une tête pleine dont la pointe est exactement le dernier point, dans l'axe de la courbe. Un arc se donne par
 *  quelques points : la courbe se prolonge à courbure constante jusqu'à ses extrémités. Masquée (visible faux), la
 *  flèche garde les mêmes nœuds : seul l'attribut display change, comme l'exige une animation. Une flèche visible a au
 *  moins deux points distincts. */
export function fleche(points, { couleur = CHARTE.accentFort, epaisseur = CHARTE.traits.appuye, role = "fleche", visible = true } = {}) {
  const pts = points.filter((p, i) => i === 0 || distance(points[i - 1], p) > 1e-6);
  if (!pts.length || (visible && pts.length < 2)) throw new Error(`Flèche « ${role} » : il faut au moins deux points distincts.`);
  const pointe = pts[pts.length - 1];
  const courbe = pts.length > 1 ? spline(pts) : [];
  const [ux, uy] = courbe.length ? directionArrivee(courbe) : [1, 0];
  const longueur = TETE_LONGUEUR * epaisseur, demi = TETE_DEMI_LARGEUR * epaisseur;
  const aile = (s) => [pointe[0] - longueur * ux - s * demi * uy, pointe[1] - longueur * uy + s * demi * ux];
  const encoche = [pointe[0] - (1 - TETE_ENCOCHE) * longueur * ux, pointe[1] - (1 - TETE_ENCOCHE) * longueur * uy];
  const morceaux = courbe.length ? arreter(courbe, RETRAIT_TRAIT * epaisseur) : [];
  const trait = [`M${point(pts[0])}`, ...morceaux.map((s) => `C${point(s[1])} ${point(s[2])} ${point(s[3])}`)].join(" ");
  const tete = `M${point(pointe)} L${point(aile(1))} L${point(encoche)} L${point(aile(-1))} Z`;
  const rond = { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
  return n("g", { "data-r": role, display: visible ? "inline" : "none" },
    n("path", { d: trait, ...rond, stroke: CHARTE.carte, "stroke-width": epaisseur + 2 * HALO_FLECHE }),
    n("path", { d: tete, fill: CHARTE.carte, stroke: CHARTE.carte, "stroke-width": 2 * HALO_FLECHE, "stroke-linejoin": "round" }),
    n("path", { d: trait, ...rond, stroke: couleur, "stroke-width": epaisseur, "data-r": "fleche-trait" }),
    n("path", { d: tete, fill: couleur, "data-r": "fleche-tete" }));
}
