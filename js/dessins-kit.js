/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Charte des dessins des cours de compétences et pièces communes. Illustration à plat, deux ou trois tons par
 * matière, sans dégradé ni ombre floue ; police de l'app ; « Juste » et « Faux » toujours écrits. Un dessin fait
 * 320 unités de large et se lit sur un téléphone (343 px) : texte d'au moins 11 px, trait d'au moins 1 px
 * (tests/aides-dessins.mjs).
 *
 * Traits : le jeu de quatre épaisseurs de CHARTE.traits, et lui seul. Les liserés (CHARTE.liseres) ne sont pas des
 * traits : un liseré clair, de cette largeur de part et d'autre, borde un filet d'étiquette, son point ou une flèche,
 * pour qu'ils restent lisibles quand ils passent sur un objet sombre. Peau : une seule teinte, en deux tons seulement,
 * CHARTE.peau et CHARTE.peauOmbre ; dans le style schématique, elle ne sert plus qu'aux repères des mains (disqueMain), et les
 * personnes sont des silhouettes de pictogramme (SILHOUETTE, en fin de fichier).
 */
import { n } from "./dessin-svg.js?v=20261027a";

export const CHARTE = {
  fond: "#F1F4F0", carte: "#FBFCFA", texte: "#1F2924", texteDoux: "#46554A", texteDiscret: "#6E7A6F",
  accent: "#6B7F4E", accentFort: "#556641", accentDoux: "#EAEFD9", accentDoux2: "#D8E1C0",
  filet: "#D8DED2", filetFort: "#B7C0AA",
  juste: "#4D7C0F", justeFond: "#ECF6D5", faux: "#A05A3D", fauxFond: "#F6E4D7",
  police: "Outfit, -apple-system, 'Segoe UI', sans-serif",
  traits: { fin: 1, moyen: 1.5, appuye: 2.5, fort: 4 },
  tailles: { petite: 11, etiquette: 12, titre: 13 },
  // Largeur d'un liseré clair (teinte de la carte), de chaque côté de ce qu'il borde.
  liseres: 1.25,
  // Peau : brun chaud et neutre, assez soutenu pour qu'une main se lise sans contour sur le fond et sur la carte
  // (contraste de 3:1 au moins, celui d'un élément graphique) ; l'ombre, du même ton, plus sombre.
  peau: "#B47B5A", peauOmbre: "#966040",
};
/** Largeur de lecture d'un dessin sur un iPhone de 375 px, marges du cours déduites. */
export const LARGEUR_TELEPHONE = 343;
export const TAILLE_TEXTE_MIN_PX = 11;
export const TRAIT_MIN_PX = 1;

/** Teintes d'écran des quatre couleurs de voyant de la norme (rouge, orange ou jaune ambre, vert, bleu) : franches, et
 *  lisibles allumées sur la tuile sombre du tableau de bord (contraste de 3:1 au moins, tests/dessins-voyants.test.mjs). Les
 *  voyants (js/dessins-voyants.js) et le témoin des feux de détresse sur sa commande (js/dessins-poste.js) les partagent. */
export const COULEURS_VOYANTS = figer({ rouge: "#FF453A", orange: "#FFAA00", vert: "#30D158", bleu: "#3D8BFF" });

/** Le symbole du freinage (ISO 7000-0239, celui du voyant), en parts de son carré : rayon du cercle ; les deux arcs de part et
 *  d'autre (rayon, demi-ouverture de chacun autour de l'horizontale, en degrés). Le voyant du freinage et celui de l'ABS
 *  (js/dessins-voyants.js) et le pictogramme du bouchon du liquide de frein (js/dessins-entretien.js) le partagent. */
export const SYMBOLE_FREIN = figer({ cercle: 0.277, arcs: { rayon: 0.372, demiOuverture: 44 } });

/** Le symbole de la température du liquide de refroidissement (ISO 7000-0246, celui du voyant : un thermomètre dans les vagues),
 *  en parts de son carré, u vers la droite, v vers le bas : tige (son axe, son haut) ; bulbe plein (sa hauteur, son rayon) ;
 *  graduations, à droite de la tige (de gauche à droite, leurs hauteurs) ; vagues, chaque morceau (bords, hauteur, nombre de
 *  demi-ondes ; la vague haute coupée par le bulbe, la vague basse) ; amplitude des vagues. Le voyant (js/dessins-voyants.js) et
 *  le pictogramme du bouchon du vase d'expansion (js/dessins-entretien.js) le partagent, et tracent ses vagues par vagueSymbole. */
export const SYMBOLE_TEMPERATURE = figer({
  tige: { u: 0.5, haut: 0.13 },
  bulbe: { v: 0.628, rayon: 0.072 },
  graduations: { gauche: 0.535, droite: 0.71, v: [0.226, 0.341, 0.462] },
  vagues: [
    { gauche: 0.09, droite: 0.37, v: 0.615, demiOndes: 2 },
    { gauche: 0.63, droite: 0.91, v: 0.615, demiOndes: 2 },
    { gauche: 0.16, droite: 0.84, v: 0.75, demiOndes: 5 },
  ],
  amplitude: 0.026,
});
// Demi-onde de sinusoïde en courbe de Bézier : poignées au tiers et aux deux tiers, à 4/3 de l'amplitude.
const TIERS_ONDE = 1 / 3, POIGNEE_ONDE = 4 / 3;
/** Tracé d'un morceau de vague d'un symbole (SYMBOLE_TEMPERATURE.vagues) : ses demi-ondes, chacune une courbe de Bézier, la
 *  première vers le haut ; q(u, v) ramène un point du carré du symbole au cadre. */
export function vagueSymbole(q, { gauche, droite, v, demiOndes }, amplitude) {
  const l = (droite - gauche) / demiOndes, creux = POIGNEE_ONDE * amplitude;
  let d = `M${point(q(gauche, v))}`;
  for (let i = 0; i < demiOndes; i++) {
    const u = gauche + i * l, dv = i % 2 === 0 ? -creux : creux;
    d += ` C${point(q(u + l * TIERS_ONDE, v + dv))} ${point(q(u + 2 * l * TIERS_ONDE, v + dv))} ${point(q(u + l, v))}`;
  }
  return d;
}

/** Repères d'Outfit, la police des dessins, en tailles de texte (mesurés dans Chrome : capitales 0,70 au-dessus de la ligne
 *  de base, accents des capitales 0,98, jambages 0,22), arrondis vers le large : ligne de base sous le milieu des capitales
 *  (milieuCapitales) ; place d'une ligne au-dessus de sa ligne de base, sans capitale accentuée (haut) ou avec (hautAccent),
 *  et au-dessous (bas) ; pas des lignes d'une étiquette (interligne). Les familles posent leurs textes avec eux, comme le kit
 *  pose les siens. */
export const METRIQUES_POLICE = figer({ milieuCapitales: 0.35, haut: 0.8, hautAccent: 1.0, bas: 0.25, interligne: 1.25 });

/** Mise en page des pièces communes, en unités du cadre : rayon des coins d'une vignette ; marge de sa pastille (de la pastille
 *  aux bords de la vignette) et hauteur de la pastille ; espace du bout d'un filet d'étiquette à son texte. */
export const MISE_EN_PAGE = figer({ rayonVignette: 8, margePastille: 8, hauteurPastille: 20, espaceEtiquette: 4 });

// Choix de dessin des pièces communes, en unités du cadre.
const RAYON_CADRE = 10;
const RAYON_VIGNETTE = MISE_EN_PAGE.rayonVignette;
const MARGE_PASTILLE = MISE_EN_PAGE.margePastille;
const ESPACE_ETIQUETTE = MISE_EN_PAGE.espaceEtiquette;
const INTERLIGNE = METRIQUES_POLICE.interligne;
const RAYON_POINT = 2.2;            // point posé sur l'objet désigné
const MILIEU_CAPITALES = METRIQUES_POLICE.milieuCapitales;
const HAUT_TEXTE = METRIQUES_POLICE.haut, HAUT_TEXTE_ACCENT = METRIQUES_POLICE.hautAccent, BAS_TEXTE = METRIQUES_POLICE.bas;
const CAPITALE_ACCENTUEE = /[ÀÂÄÉÈÊËÎÏÔÖÙÛÜŸ]/;
const ANCRAGES = ["start", "middle", "end"];
const ETATS = ["juste", "faux"];

// Une valeur inconnue est une erreur, jamais un choix par défaut : une pastille « Faux » à la place de « Juste » serait
// la pire faute d'un dessin en paire.
function connu(valeur, permises, quoi) {
  if (!permises.includes(valeur)) {
    throw new Error(`${quoi} « ${valeur} » inconnu : ${permises.map((v) => `« ${v} »`).join(", ")} attendu.`);
  }
  return valeur;
}

// Géométrie plane. Les tracés (attribut d) s'écrivent à deux décimales : jamais d'écriture flottante à rallonge. Les familles
// écrivent les leurs avec les mêmes aides.
/** Une coordonnée d'un tracé, à deux décimales au plus (« 12 », « 3.14 »). */
export const coord = (v) => String(Number(v.toFixed(2)));
/** Un point [x, y] d'un tracé : « x y », chaque coordonnée écrite par coord. */
export const point = ([x, y]) => `${coord(x)} ${coord(y)}`;
/** Tracé « M x y L x y ... » d'une ligne brisée, fermé (« Z ») sauf si `ferme` est faux, chaque point écrit par point. */
export const trace = (pts, ferme = true) => `M${pts.map(point).join(" L")}${ferme ? " Z" : ""}`;
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1]];
/** Le point de [a, b] à la fraction t (0 : a ; 1 : b). */
export const entre = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const tourner = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const angleEntre = (u, v) => Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);

/** Racine d'un dessin : cadre, fond de la charte, description pour les lecteurs d'écran. */
export function cadre({ largeur, hauteur, titre, description = "" }, ...enfants) {
  return n("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, class: "dessin-svg", role: "img",
    "aria-label": description ? `${titre}. ${description}` : titre },
  n("rect", { x: 0, y: 0, width: largeur, height: hauteur, rx: RAYON_CADRE, fill: CHARTE.fond, "data-r": "fond" }), ...enfants);
}

export function texte(x, y, contenu, { taille = CHARTE.tailles.etiquette, ancrage = "start", graisse = 400, couleur = CHARTE.texte, role } = {}) {
  connu(ancrage, ANCRAGES, `Texte « ${contenu} » : ancrage`);
  return n("text", { x, y, "font-size": taille, "font-family": CHARTE.police, "font-weight": graisse, fill: couleur,
    "text-anchor": ancrage, ...(role ? { "data-r": role } : {}) }, contenu);
}

/** Étiquette : un filet fin de la cible (un point posé sur l'objet) jusqu'à l'ancre, et le texte, une ligne ou plus,
 *  posé à côté du bout du filet, jamais dessus. Ancrage « start » : le texte part à droite de l'ancre ; « end » : il
 *  finit à sa gauche ; dans les deux cas, le bloc de lignes est centré en hauteur sur l'ancre. « middle » : le texte
 *  est centré sous l'ancre quand la cible est au-dessus d'elle, au-dessus sinon. Le filet arrive donc du côté opposé
 *  au texte quand la cible l'est aussi : pour « start », une cible à gauche de l'ancre ; pour « end », à sa droite ;
 *  sinon le filet passerait sur le texte. Le filet porte le rôle « filet » : les contrôles communs vérifient qu'il ne
 *  passe sur aucun texte du dessin, le sien compris. */
export function etiquette({ cible, ancre, lignes, ancrage = "start", taille = CHARTE.tailles.etiquette, role = "etiquette" }) {
  connu(ancrage, ANCRAGES, "Étiquette : ancrage");
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
    n("line", { x1: cx, y1: cy, x2: ax, y2: ay, stroke: CHARTE.carte, "stroke-width": CHARTE.traits.fin + 2 * CHARTE.liseres, "stroke-linecap": "round" }),
    n("circle", { cx, cy, r: RAYON_POINT + CHARTE.liseres, fill: CHARTE.carte }),
    n("line", { x1: cx, y1: cy, x2: ax, y2: ay, stroke: CHARTE.texteDoux, "stroke-width": CHARTE.traits.fin, "stroke-linecap": "round", "data-r": "filet" }),
    n("circle", { cx, cy, r: RAYON_POINT, fill: CHARTE.texteDoux }),
    lignes.map((l, i) => texte(x, base + i * pas, l, { taille, ancrage })));
}

// Pastille : icône (coche ou croix) puis le mot, en texte sombre sur le fond clair de l'état, la couleur de l'état
// dans le liseré et l'icône (comme les marques de correction des quiz du cours : css/cours-blocs.css). Largeur des
// mots dans Outfit 600 à 11 unités, mesurée dans Chrome : « Juste » 26,4, « Faux » 24,2.
const PASTILLE = { hauteur: MISE_EN_PAGE.hauteurPastille, taille: 11, graisse: 600, gauche: 7, icone: 8, espace: 4.5, droite: 7,
  trait: CHARTE.traits.moyen };
const MOTS = { juste: { mot: "Juste", largeur: 26.4 }, faux: { mot: "Faux", largeur: 24.2 } };

/** Largeur de la pastille d'un état (« juste » ou « faux »), en unités du cadre : pour poser un texte à côté d'elle. */
export function largeurPastille(etat) {
  const p = PASTILLE;
  return p.gauche + p.icone + p.espace + MOTS[connu(etat, ETATS, "Pastille : état")].largeur + p.droite;
}

/** Pastille d'état (« juste » ou « faux », toute autre valeur est une erreur) : coche ou croix, et le mot. */
export function pastille({ x, y, etat }) {
  const juste = connu(etat, ETATS, "Pastille : état") === "juste";
  const couleur = juste ? CHARTE.juste : CHARTE.faux;
  const { mot, largeur: largeurMot } = MOTS[juste ? "juste" : "faux"];
  const p = PASTILLE, ix = x + p.gauche, iy = y + (p.hauteur - p.icone) / 2;
  const q = (dx, dy) => point([ix + dx, iy + dy]);
  const icone = juste
    ? `M${q(0.6, 4.4)} L${q(3.1, 6.9)} L${q(7.6, 1.5)}`
    : `M${q(1.1, 1.1)} L${q(6.9, 6.9)} M${q(6.9, 1.1)} L${q(1.1, 6.9)}`;
  return n("g", { "data-r": `pastille-${etat}` },
    n("rect", { x, y, width: p.gauche + p.icone + p.espace + largeurMot + p.droite, height: p.hauteur, rx: p.hauteur / 2,
      fill: juste ? CHARTE.justeFond : CHARTE.fauxFond, stroke: couleur, "stroke-width": CHARTE.traits.fin }),
    n("path", { d: icone, fill: "none", stroke: couleur, "stroke-width": p.trait, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    texte(ix + p.icone + p.espace, y + p.hauteur / 2 + MILIEU_CAPITALES * p.taille, mot, { taille: p.taille, graisse: p.graisse }));
}

/** Vignette d'une paire juste et faux : la carte, son contenu, puis la pastille en haut à gauche. */
export function vignette({ x, y, largeur, hauteur, etat }, ...contenu) {
  connu(etat, ETATS, "Vignette : état");
  return n("g", { "data-r": `vignette-${etat}` },
    n("rect", { x, y, width: largeur, height: hauteur, rx: RAYON_VIGNETTE, fill: CHARTE.carte, stroke: CHARTE.filet, "stroke-width": CHARTE.traits.fin }),
    ...contenu,
    pastille({ x: x + MARGE_PASTILLE, y: y + MARGE_PASTILLE, etat }));
}

// Flèche : proportions de la tête rapportées à l'épaisseur du trait ; le trait s'arrête sous la tête (son bout arrondi
// ne dépasse pas de la pointe) ; un liseré clair (CHARTE.liseres) la détache du dessin qu'elle survole.
const TETE_LONGUEUR = 3.4, TETE_DEMI_LARGEUR = 1.6, TETE_ENCOCHE = 0.25, RETRAIT_TRAIT = 1.5;

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

// Direction de la courbe à son arrivée (vecteur unitaire), lue sur le dernier point de contrôle distinct de la pointe.
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
 *  flèche garde les mêmes nœuds : seul l'attribut display change, comme l'exige une animation. Visible ou masquée, une
 *  flèche a au moins deux points distincts et finis ; son épaisseur est l'une des quatre de la charte. */
export function fleche(points, { couleur = CHARTE.accentFort, epaisseur = CHARTE.traits.appuye, role = "fleche", visible = true } = {}) {
  if (!Object.values(CHARTE.traits).includes(epaisseur)) {
    throw new Error(`Flèche « ${role} » : épaisseur ${epaisseur} hors du jeu de la charte (1 ; 1,5 ; 2,5 ; 4).`);
  }
  const fautif = points.find((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]));
  if (fautif) throw new Error(`Flèche « ${role} » : point non fini (${fautif}).`);
  const pts = points.filter((p, i) => i === 0 || distance(points[i - 1], p) > 1e-6);
  if (pts.length < 2) {
    throw new Error(`Flèche « ${role} » : il faut au moins deux points distincts, même masquée (elle garde sa forme d'une image à l'autre).`);
  }
  const pointe = pts[pts.length - 1];
  const courbe = spline(pts);
  const [ux, uy] = directionArrivee(courbe);
  const longueur = TETE_LONGUEUR * epaisseur, demi = TETE_DEMI_LARGEUR * epaisseur;
  const aile = (s) => [pointe[0] - longueur * ux - s * demi * uy, pointe[1] - longueur * uy + s * demi * ux];
  const encoche = [pointe[0] - (1 - TETE_ENCOCHE) * longueur * ux, pointe[1] - (1 - TETE_ENCOCHE) * longueur * uy];
  const morceaux = arreter(courbe, RETRAIT_TRAIT * epaisseur);
  const trait = [`M${point(pts[0])}`, ...morceaux.map((s) => `C${point(s[1])} ${point(s[2])} ${point(s[3])}`)].join(" ");
  const tete = `M${point(pointe)} L${point(aile(1))} L${point(encoche)} L${point(aile(-1))} Z`;
  const rond = { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
  return n("g", { "data-r": role, display: visible ? "inline" : "none" },
    n("path", { d: trait, ...rond, stroke: CHARTE.carte, "stroke-width": epaisseur + 2 * CHARTE.liseres }),
    n("path", { d: tete, fill: CHARTE.carte, stroke: CHARTE.carte, "stroke-width": 2 * CHARTE.liseres, "stroke-linejoin": "round" }),
    n("path", { d: trait, ...rond, stroke: couleur, "stroke-width": epaisseur, "data-r": "fleche-trait" }),
    n("path", { d: tete, fill: couleur, "data-r": "fleche-tete" }));
}

// ===== Voitures : vue du dessus et profil =====
//
// Deux voitures. Vue du dessus, celle des scènes de route, pour qu'un dessin et une scène d'un même cours montrent la même
// voiture ; de profil, une citadine à hayon réelle, à ses cotes (voir « Profil » plus bas).
//
// Vue du dessus : choix de dessin (mètres, sans portée réglementaire). Sont repris des scènes : la caisse, 4,5 m sur 1,8 m,
// coins de 0,4 m de rayon, essieu arrière 1,45 m derrière le centre (GABARITS.voiture de js/scene-geometrie.js) ; son
// pare-brise, de 1,55 m à 1,00 m de l'avant et à 0,18 m des flancs (dessinerVoiture de js/scene-moteur.js) ; ses teintes
// (TEINTES de js/scene-rendu.js) ; l'œil du conducteur, 0,20 m devant le centre et 0,40 m à sa gauche, la France roulant à
// droite (js/scene-regard.js). Le kit, chargé par chaque famille de dessins, n'importe pas ces modules lourds : il recopie
// leurs valeurs, et tests/dessins-kit.test.mjs vérifie la recopie. Le reste est choisi ici, pour une voiture courante :
// - empattement 2,6 m : l'essieu avant est alors 1,15 m devant le centre ; porte-à-faux de 1,10 m à l'avant et de
//   0,80 m à l'arrière, l'ordre de grandeur d'une compacte de 4,5 m de long ;
// - voie 1,52 m, celle d'une voiture de 1,8 m de large (Clio V : 1,51 m) ;
// - roues de 0,64 m sur 0,21 m, un pneu courant 205/55 R16, sur une jante de 16 pouces (0,41 m, rebord compris) ;
// - rétroviseurs extérieurs au coin avant des vitres avant : miroir 0,96 m devant le centre, centré à 0,93 m de l'axe,
//   soit 3 cm hors de la caisse ; largeur hors tout 2,04 m (Clio V : 1,99 m) ; rétroviseur intérieur collé au haut du
//   pare-brise, dans l'axe, visible à travers lui ;
// - flanc (vitres latérales, montants, lunette), celui que montrent les rétroviseurs extérieurs (dessin « retroviseurs ») :
//   VITRAGE_CONTOUR et ceinture ; lunette de 1,55 m à 2,03 m derrière le centre ;
// - portière avant de 1,16 m (de 1,10 m devant le centre au joint du montant milieu, 6 cm derrière le centre), charnière
//   verticale à l'avant, 4 cm derrière le bord et 6 cm en dedans du flanc ; la portière du conducteur s'ouvre de 0 à 70
//   degrés, la butée d'une portière courante, et son rétroviseur tourne avec elle ; elle découvre l'habitacle à mesure
//   qu'elle s'ouvre, et son contour apparaît sur ses 6 premiers degrés, pour qu'une animation n'ait aucun saut ;
// - braquage des roues avant de 40 degrés au plus, la butée d'une voiture courante ; les deux roues avant prennent le
//   même angle : l'épure de braquage, qui tourne un peu plus la roue intérieure au virage, n'est pas dessinée ;
// - les roues sont cachées sous la caisse (la voie et le pneu tiennent dans sa largeur) : demandées, elles se dessinent
//   par-dessus elle, en écorché, sous la portière ouverte et sous les rétroviseurs.
// Les deux voitures : un détail de finition plus petit que DETAIL_MIN unités (1,3 px sur un téléphone) ne se dessine pas :
// vitres latérales vues du dessus (portière comprise), phares et feux, reflets des vitres, montant milieu, bas de caisse,
// épaule, poignées, rétroviseur vu de profil, fond, fenêtres et moyeu des jantes ; un trait de détail (joints, essuie-glaces,
// joint de la trappe fermée) seulement quand son unité d'épaisseur figure au plus TRAIT_DETAIL_MAX mètre. Se dessinent
// toujours la caisse, le toit, le pare-brise, la lunette, le vitrage de profil, les pneus et les jantes, les passages de roue,
// et les pièces demandées : roues, rétroviseurs vus du dessus, portière, trappe ouverte.

function figer(objet) {
  for (const v of Object.values(objet)) if (v && typeof v === "object") figer(v);
  return Object.freeze(objet);
}

/** Teintes de la route des scènes (TEINTES de js/scene-rendu.js) dont les dessins ont besoin, recopiées. */
export const TEINTES_ROUTE = figer({
  chaussee: "#5D635B", trottoir: "#DAD6CA", ilot: "#B9CB9B", peinture: "#FFFFFF",
  eleve: "#6B7F4E", eleveBord: "#3E4A2D", autre: "#8D97A3", autreBord: "#4E5863", pieton: "#2E2E2B",
  clignotant: "#F4A900", stop: "#D2232A", recul: "#FFFFFF", vitre: "#C9D6DF", regard: "#FFD45C", trajet: "#B5C98A",
});

/** Cône du regard des scènes, recopié comme ses teintes : portée (m) et demi-ouverture (degrés) de js/scene-regard.js
 *  (REGARD_PORTEE, REGARD_OUVERTURE), opacité de js/scene-moteur.js (OPACITE_CONE). tests/dessins-kit.test.mjs vérifie la
 *  recopie : un dessin qui montre le regard le montre comme les scènes. */
export const REGARD_SCENES = figer({ portee: 22, demiOuverture: 16, opacite: 0.4 });

// Repère de la caisse : x vers l'avant, depuis le centre ; vue du dessus, y vers la droite de la voiture ; de profil, la
// hauteur au-dessus du sol. Un point de profil est [x, hauteur] ; un point vu du dessus, [x, y]. Ici, la voiture vue du dessus.
const GABARIT = { longueur: 4.5, largeur: 1.8, rayon: 0.4, essieu: 1.45 };          // scènes
const PARE_BRISE = { recul: 1.55, profondeur: 0.55, marge: 0.18 };                 // scènes
const DEMI_L = GABARIT.longueur / 2, DEMI_W = GABARIT.largeur / 2;
const HAUT_PARE_BRISE = DEMI_L - PARE_BRISE.recul, PIED_PARE_BRISE = HAUT_PARE_BRISE + PARE_BRISE.profondeur;
const OEIL_CONDUCTEUR = { avant: 0.2, gauche: 0.4 };                             // scènes
const EMPATTEMENT = 2.6, VOIE = 1.52;
const ESSIEU_AVANT = EMPATTEMENT - GABARIT.essieu, ESSIEU_ARRIERE = -GABARIT.essieu;
const ROUE = { diametre: 0.64, largeur: 0.21, jante: 0.41 };
const RAYON_ROUE = ROUE.diametre / 2;
const BRAQUAGE_MAX = 40;
// Rétroviseur extérieur droit (le gauche en miroir) : miroir sur la face arrière du boîtier, son centre, et le boîtier vu
// du dessus (avant, pied sur la portière, bout).
const RETRO = { miroir: 0.96, centre: 0.93, avant: 1.08, pied: 0.85, bout: 1.02,
  boitier: [[0.96, 0.85], [1.05, 0.85], [1.08, 0.93], [1.04, 1.02], [0.96, 1.01]], arrondis: [0.01, 0.03, 0.04, 0.03, 0.01] };
const RETRO_INTERIEUR = { miroir: 0.72, avant: 0.78, demiLargeur: 0.13, arrondi: 0.025 };
// Flanc de la voiture vue du dessus. Vitres latérales, vues du dessus et de profil (VITRAGE_CONTOUR, que montrent les
// rétroviseurs) : pied et haut du montant de pare-brise, haut du cadre, haut et pied du montant arrière ; montant milieu entre
// les deux portières (de l'arrière à l'avant).
const VITRAGE = { avantBas: [1.10, 0.985], avantHaut: [0.68, 1.36], hautAvant: [0.10, 1.385], hautArriere: [-0.70, 1.38],
  arriereHaut: [-1.16, 1.335], arriereBas: [-1.45, 1.05], montant: [-0.105, -0.015],
  arrondis: [0.03, 0.10, 0.4, 0.4, 0.08, 0.03] };
const LUNETTE = { haut: [-1.55, 1.36], bas: [-2.03, 1.00] };
// Portière avant : bord avant (au pied du montant de pare-brise), bord arrière (joint du montant milieu) ; charnière [x, distance
// à l'axe] ; ouverture maximale en degrés ; fondu : les premiers degrés d'ouverture, sur lesquels le contour de la portière
// vue du dessus apparaît.
const PORTIERE = { avant: VITRAGE.avantBas[0], arriere: -0.06, charniere: [1.06, 0.84], ouvertureMax: 70, fondu: 6 };
// Joints du capot vue du dessus, de chaque côté : du bord arrière du capot (côté pare-brise) à son bord avant, chacun [x, distance
// à l'axe]. Le capot fermé est entre eux.
const JOINTS_CAPOT = { arriere: [1.32, 0.74], avant: [1.94, 0.68] };

/** Dimensions (mètres) et choix de dessin de la voiture vue du dessus (celle des scènes) ; `vitrage` et `lunette` : son flanc ;
 *  `jointsCapot` : les joints du capot vus du dessus. Figées, comme TEINTES_ROUTE : un dessin ne peut pas déformer la voiture
 *  des autres. La voiture de profil a les siennes : VOITURE_PROFIL. */
export const VOITURE = figer({
  ...GABARIT, pareBrise: PARE_BRISE, empattement: EMPATTEMENT, voie: VOIE, roue: ROUE, retroviseur: RETRO,
  retroviseurInterieur: RETRO_INTERIEUR, oeil: OEIL_CONDUCTEUR, braquageMax: BRAQUAGE_MAX,
  vitrage: VITRAGE, lunette: LUNETTE, portiere: PORTIERE, jointsCapot: JOINTS_CAPOT,
});

// Vue du dessus : toit, pare-brise et lunette (demi-largeurs), bandes des vitres latérales (distances à l'axe), phares et
// feux (voir feuDessus), joints du capot, essuie-glaces au repos au pied du pare-brise, reflet du pare-brise (bande des
// points où x + pente y va de debut à fin), arrondi des pneus.
const DESSUS = {
  toit: { demiAvant: 0.62, demiArriere: 0.60, arrondi: 0.12 },
  pareBrise: { demiHaut: 0.62, demiPied: DEMI_W - PARE_BRISE.marge, arrondiHaut: 0.06, arrondiPied: 0.08 },
  lunette: { demiHaut: 0.60, demiBas: 0.66, arrondi: 0.07 },
  vitres: { interieur: 0.62, exterieur: 0.75, arrondi: 0.03 },
  phare: { debut: 0.36, angle: 58, retrait: 0.03, profondeur: 0.18, arrondi: 0.03 },
  feu: { debut: 0.44, angle: 72, retrait: 0.025, profondeur: 0.12, arrondi: 0.02 },
  capot: [JOINTS_CAPOT.arriere, JOINTS_CAPOT.avant],
  essuieGlaces: [[[1.225, -0.60], [1.215, -0.12]], [[1.225, -0.04], [1.215, 0.44]]],
  reflet: { pente: 0.55, debut: 0.86, fin: 0.98 },
  arrondiPneu: 0.06,
};
const CARROSSERIES = {
  eleve: { base: TEINTES_ROUTE.eleve, bord: TEINTES_ROUTE.eleveBord, ombre: "#58683F", reflet: "#819269" },
  autre: { base: TEINTES_ROUTE.autre, bord: TEINTES_ROUTE.autreBord, ombre: "#737D89", reflet: "#A2ABB5" },
};
/** Matières des voitures du kit : vitres et leur reflet, joints, habitacle, siège, pneu, passage de roue, jante (fond et
 *  moyeu), phare, feu, bouchon ; et le fond sombre du compartiment moteur, capot ouvert (dessins « capot » et
 *  « tour-vehicule »). Les familles qui montrent une pièce de la voiture de plus près la peignent de la même matière. */
export const MATIERES = figer({
  vitre: TEINTES_ROUTE.vitre, vitreReflet: "#E3EAEF", joint: "#2E3430", habitacle: "#3A403C", siege: "#545B56",
  pneu: "#343A36", passage: "#1E2220", jante: "#CBD0CC", janteFond: "#9DA59F", moyeu: "#7E8781", fenetres: "#464D48",
  phare: "#E9EEEA", feu: TEINTES_ROUTE.stop, bouchon: "#5E6660", compartiment: "#2B302D",
});

const DETAIL_MIN = 1.2;
const TRAIT_DETAIL_MAX = 0.05;
const PAS_ARRONDI = 8;     // segments d'un coin arrondi
const PAS_ARC = 6;         // degrés au plus entre deux points d'un arc
const PAS_FEU = 6;         // segments du bord d'un feu vu du dessus
const RAD = Math.PI / 180;

// Formes planes des dessins, partagées par les familles. Un polygone est une liste de points [x, y] (unités ou mètres,
// au choix de l'appelant), fermé implicitement ; les fonctions rendent de nouvelles listes, sans toucher à leurs entrées.
// Les points rendus ne contiennent que des segments : un tracé « M ... L ... Z » les dessine tels quels, et un test peut
// les relire.

/** Polygone aux coins arrondis, échantillonné : le coin du sommet i devient un arc de Bézier quadratique (le sommet en
 *  point de contrôle), de PAS_ARRONDI segments, qui part et finit à `rayons[i]` du sommet le long de ses deux côtés, au
 *  plus à la moitié de chacun ; un rayon nul ou absent garde le coin vif. La courbe ne touche jamais le sommet. */
export function arrondir(sommets, rayons) {
  const m = sommets.length, r = [];
  for (let i = 0; i < m; i++) {
    const v = sommets[i], rayon = rayons[i] || 0;
    if (!rayon) { r.push(v); continue; }
    const avant = sommets[(i - 1 + m) % m], apres = sommets[(i + 1) % m];
    const la = distance(v, avant), lb = distance(v, apres);
    const a = entre(v, avant, Math.min(rayon, la / 2) / la), b = entre(v, apres, Math.min(rayon, lb / 2) / lb);
    for (let k = 0; k <= PAS_ARRONDI; k++) {
      const t = k / PAS_ARRONDI, u = 1 - t;
      r.push([u * u * a[0] + 2 * u * t * v[0] + t * t * b[0], u * u * a[1] + 2 * u * t * v[1] + t * t * b[1]]);
    }
  }
  return r;
}

/** Points d'un arc de cercle de centre [cx, cy], de l'angle `de` à l'angle `a` (degrés, dans un sens ou dans l'autre),
 *  extrémités comprises, par pas d'au plus PAS_ARC degrés. Un angle t donne le point [cx + rayon cos t, cy + rayon sin t] :
 *  dans le plan [x, hauteur] d'un profil, le sens trigonométrique ; dans le repère du cadre (y vers le bas), le sens des
 *  aiguilles d'une montre. */
export function arc([cx, cy], rayon, de, a) {
  const nb = Math.max(1, Math.ceil(Math.abs(a - de) / PAS_ARC));
  return Array.from({ length: nb + 1 }, (_, k) => {
    const t = (de + ((a - de) * k) / nb) * RAD;
    return [cx + rayon * Math.cos(t), cy + rayon * Math.sin(t)];
  });
}

/** Partie d'un polygone où f(p) <= 0, pour f affine (découpage de Sutherland et Hodgman par un demi-plan) : chaque côté
 *  qui traverse la droite f = 0 y est coupé exactement. Juste pour un polygone convexe ; pour un polygone concave, les
 *  morceaux restent reliés par des côtés posés sur la droite, ce qui ne change rien au remplissage. */
export function couper(poly, f) {
  const r = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
    if (fp <= 0) r.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) r.push(entre(p, q, fp / (fp - fq)));
  }
  return r;
}
/** Partie d'un polygone comprise entre deux droites parallèles : les points où x + pente (y - origine) va de `debut` à
 *  `fin` (reflets des vitres, bandes de teinte). */
export function bande(poly, { pente, debut, fin, origine = 0 }) {
  const abscisse = (p) => p[0] + pente * (p[1] - origine);
  return couper(couper(poly, (p) => debut - abscisse(p)), (p) => abscisse(p) - fin);
}

const tournerAutour = ([px, py], [cx, cy], angleDeg) => {
  const [dx, dy] = tourner([px - cx, py - cy], angleDeg * RAD);
  return [cx + dx, cy + dy];
};

function fini(v, quoi) {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${quoi} : nombre fini attendu (reçu : ${String(v)}).`);
  return v;
}
function borne(v, min, max, quoi) {
  fini(v, quoi);
  if (v < min || v > max) throw new Error(`${quoi} : ${v} hors des bornes (de ${min} à ${max}).`);
  return v;
}
function verifierPose(qui, { x, y, cap = 0, echelle }) {
  fini(x, `${qui} : x`);
  fini(y, `${qui} : y`);
  fini(cap, `${qui} : cap`);
  if (!(typeof echelle === "number" && Number.isFinite(echelle) && echelle > 0)) {
    throw new Error(`${qui} : échelle ${String(echelle)} invalide (unités par mètre, nombre fini positif attendu).`);
  }
}
const carrosserie = (teinte, qui) => CARROSSERIES[connu(teinte, Object.keys(CARROSSERIES), `${qui} : nom de teinte`)];
const SENS = { droite: 1, gauche: -1 };
const signeSens = (sens, qui) => SENS[connu(sens, Object.keys(SENS), `${qui} : sens`)];

// ----- Vue du dessus -----

/** Contour des vitres latérales de la voiture vue du dessus, de profil, [x, hauteur] (m), coins arrondis : du pied du montant de
 *  pare-brise au pied du montant arrière, par le haut du cadre. Le flanc que montrent les rétroviseurs extérieurs. */
export const VITRAGE_CONTOUR = Object.freeze(arrondir(["avantBas", "avantHaut", "hautAvant", "hautArriere", "arriereHaut", "arriereBas"]
  .map((k) => VITRAGE[k]), VITRAGE.arrondis));
/** Ligne de ceinture de la voiture vue du dessus : hauteur (m) du bas des vitres à l'abscisse px, droite du pied du montant arrière
 *  au pied du montant de pare-brise, prolongée au-delà. */
export const ceinture = (px) => VITRAGE.arriereBas[1]
  + ((px - VITRAGE.arriereBas[0]) / (VITRAGE.avantBas[0] - VITRAGE.arriereBas[0])) * (VITRAGE.avantBas[1] - VITRAGE.arriereBas[1]);

// Point du repère de la caisse dans le cadre, pour une voiture posée en (x, y), de cap `cap` degrés (0 vers la droite du
// cadre, croissant dans le sens des aiguilles d'une montre, comme dans les scènes), à `echelle` unités par mètre.
function versCadreDessus({ x, y, cap, echelle }) {
  const c = Math.cos(cap * RAD), s = Math.sin(cap * RAD);
  return ([ax, ay]) => [x + echelle * (ax * c - ay * s), y + echelle * (ax * s + ay * c)];
}
const PIVOT_PORTIERE = [PORTIERE.charniere[0], -PORTIERE.charniere[1]];
// Part d'une forme devant la charnière de la portière avant (x plus grand) : celle qui rentre sous l'aile en s'ouvrant.
const devantCharniere = (p) => p[0] - PORTIERE.charniere[0];

/** Repères d'une voiture vue du dessus, en points du cadre : œil du conducteur, centres des miroirs des rétroviseurs (le
 *  gauche tourne avec la portière ouverte de `portiere` degrés), centres des roues avant. */
export function reperesDessus({ x, y, cap = 0, echelle, portiere = 0 }) {
  const qui = "Repères de la voiture vue du dessus";
  verifierPose(qui, { x, y, cap, echelle });
  borne(portiere, 0, PORTIERE.ouvertureMax, `${qui} : ouverture de la portière`);
  const v = versCadreDessus({ x, y, cap, echelle });
  return {
    oeil: v([OEIL_CONDUCTEUR.avant, -OEIL_CONDUCTEUR.gauche]),
    retroGauche: v(tournerAutour([RETRO.miroir, -RETRO.centre], PIVOT_PORTIERE, portiere)),
    retroDroit: v([RETRO.miroir, RETRO.centre]),
    retroInterieur: v([RETRO_INTERIEUR.miroir, 0]),
    roueAvantGauche: v([ESSIEU_AVANT, -VOIE / 2]),
    roueAvantDroite: v([ESSIEU_AVANT, VOIE / 2]),
  };
}

// Feu vu du dessus : une bande d'épaisseur constante qui suit le bord de la caisse, à l'avant (avant 1) ou à l'arrière
// (-1), du côté cote : du bord droit, à la distance `debut` de l'axe, jusqu'à l'angle `angle` (degrés) du coin arrondi,
// entre les retraits `retrait` et `retrait + profondeur` du bord.
function feuDessus({ debut, angle, retrait, profondeur, arrondi }, avant, cote) {
  const r = GABARIT.rayon, centre = [DEMI_L - r, DEMI_W - r];
  const bord = (recul) => [[DEMI_L - recul, debut], [DEMI_L - recul, centre[1]],
    ...Array.from({ length: PAS_FEU }, (_, k) => {
      const t = ((angle * (k + 1)) / PAS_FEU) * RAD;
      return [centre[0] + (r - recul) * Math.cos(t), centre[1] + (r - recul) * Math.sin(t)];
    })];
  const exterieur = bord(retrait), pts = [...exterieur, ...bord(retrait + profondeur).reverse()].map(([px, py]) => [avant * px, cote * py]);
  const coins = [0, exterieur.length - 1, exterieur.length, pts.length - 1];
  return arrondir(pts, pts.map((_, i) => (coins.includes(i) ? arrondi : 0)));
}
const centreDe = (pts) => [0, 1].map((k) => pts.reduce((somme, p) => somme + p[k], 0) / pts.length);

// Vitre latérale vue du dessus, avant (avant vrai) ou arrière, du côté cote (-1 à gauche, 1 à droite) : la bande vitrée
// entre le toit et le haut des portières, du montant de pare-brise au montant milieu, ou de lui au montant arrière.
function vitreDessus(avant, cote) {
  const vi = DESSUS.vitres, [montantArriere, montantAvant] = VITRAGE.montant;
  const pts = avant
    ? [[VITRAGE.avantHaut[0], cote * vi.interieur], [VITRAGE.avantBas[0], cote * vi.exterieur], [montantAvant, cote * vi.exterieur],
      [montantAvant, cote * vi.interieur]]
    : [[montantArriere, cote * vi.interieur], [montantArriere, cote * vi.exterieur], [VITRAGE.arriereBas[0], cote * vi.exterieur],
      [VITRAGE.arriereHaut[0], cote * vi.interieur]];
  return arrondir(pts, pts.map(() => vi.arrondi));
}
// Portière du conducteur vue du dessus, fermée : son empreinte (sa vitre et le haut de son panneau, de son bord arrière à
// sa charnière) et sa vitre. La part devant la charnière rentre sous l'aile en s'ouvrant : elle n'en fait pas partie.
const EMPREINTE_PORTIERE = couper([[PORTIERE.arriere, -DESSUS.vitres.interieur], [VITRAGE.avantHaut[0], -DESSUS.vitres.interieur],
  [VITRAGE.avantBas[0], -DESSUS.vitres.exterieur], [VITRAGE.avantBas[0], -DEMI_W], [PORTIERE.arriere, -DEMI_W]], devantCharniere);
const VITRE_PORTIERE = couper(vitreDessus(true, -1), devantCharniere);
// Largeur d'une bande de reflet (distance de ses deux droites) ; plus petite dimension d'une forme (feux de profil).
const largeurBande = ({ pente, debut, fin }) => (fin - debut) / Math.hypot(1, pente);
const petiteDimension = (pts) => Math.min(...[0, 1].map((k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]))));

/** Voiture vue du dessus, celle des scènes en plus fin : caisse, toit, pare-brise, lunette, vitres latérales, phares et feux,
 *  essuie-glaces ; rétroviseurs, roues (avant braquées de `braquage` degrés, positifs à droite) et portière du conducteur
 *  ouverte de `portiere` degrés à la demande. (x, y) : centre de la voiture ; cap en degrés, 0 vers la droite du cadre,
 *  croissant dans le sens des aiguilles d'une montre ; échelle en unités par mètre ; teinte « eleve » ou « autre ». La
 *  portière garde ses nœuds fermée (display none) et s'anime sans saut : l'habitacle qu'elle découvre croît avec l'angle
 *  depuis 0, et son contour apparaît sur ses premiers degrés. Les roues, cachées sous la caisse, se dessinent en écorché,
 *  sous la portière ouverte et les rétroviseurs. `schema` : le style schématique (décision du formateur du 15/10/2026,
 *  « pictogramme plutôt qu'illustration ») : la silhouette de la caisse et son contour, le pare-brise et la lunette, aux mêmes
 *  tracés ; roues, rétroviseurs et portière à la demande ; aucun détail de finition (ni toit, ni vitres latérales, ni phares,
 *  ni feux, ni essuie-glaces, ni reflet, ni joints) : trois teintes, celles de la caisse, des vitres et des pneus. */
export function voitureDessus({ x, y, cap = 0, echelle, teinte = "eleve", retroviseurs = false, roues = false, braquage = 0,
  portiere = 0, schema = false, role = "voiture" }) {
  const qui = "Voiture vue du dessus";
  verifierPose(qui, { x, y, cap, echelle });
  const c = carrosserie(teinte, qui);
  borne(braquage, -BRAQUAGE_MAX, BRAQUAGE_MAX, `${qui} : braquage`);
  borne(portiere, 0, PORTIERE.ouvertureMax, `${qui} : ouverture de la portière`);
  const e = echelle, vers = versCadreDessus({ x, y, cap, echelle });
  const u = ([px, py]) => [px * e, py * e];
  const forme = (pts, attributs) => n("path", { d: trace(pts.map(u)), ...attributs });
  const repere = (p) => { const [px, py] = vers(p); return { "data-x": px, "data-y": py }; };
  // Détails de finition : seulement hors du style schématique, et assez grands pour se voir.
  const finition = !schema;
  const assez = (metres) => finition && metres * e >= DETAIL_MIN, traitDetail = finition && 1 / e <= TRAIT_DETAIL_MAX;
  const fin = CHARTE.traits.fin;
  const D = DESSUS;
  const rotationPortiere = `rotate(${coord(portiere)} ${coord(PIVOT_PORTIERE[0] * e)} ${coord(PIVOT_PORTIERE[1] * e)})`;

  const caisse = n("rect", { x: (-GABARIT.longueur / 2) * e, y: (-GABARIT.largeur / 2) * e, width: GABARIT.longueur * e,
    height: GABARIT.largeur * e, rx: GABARIT.rayon * e, fill: c.base, stroke: c.bord, "stroke-width": fin, "data-r": "caisse" });

  const roue = (role, centre, angle) => n("g", { "data-r": role, ...repere(centre), "data-angle": angle,
    transform: `translate(${coord(centre[0] * e)} ${coord(centre[1] * e)}) rotate(${coord(angle)})` },
  n("rect", { x: (-ROUE.diametre / 2) * e, y: (-ROUE.largeur / 2) * e, width: ROUE.diametre * e, height: ROUE.largeur * e,
    rx: D.arrondiPneu * e, fill: MATIERES.pneu, "data-r": "pneu" }));
  const lesRoues = roues && [
    roue("roue-avant-gauche", [ESSIEU_AVANT, -VOIE / 2], braquage), roue("roue-avant-droite", [ESSIEU_AVANT, VOIE / 2], braquage),
    roue("roue-arriere-gauche", [ESSIEU_ARRIERE, -VOIE / 2], 0), roue("roue-arriere-droite", [ESSIEU_ARRIERE, VOIE / 2], 0)];

  const toit = [[HAUT_PARE_BRISE, -D.toit.demiAvant], [HAUT_PARE_BRISE, D.toit.demiAvant], [LUNETTE.haut[0], D.toit.demiArriere],
    [LUNETTE.haut[0], -D.toit.demiArriere]];
  const pb = D.pareBrise;
  const pareBrise = arrondir([[HAUT_PARE_BRISE, -pb.demiHaut], [PIED_PARE_BRISE, -pb.demiPied], [PIED_PARE_BRISE, pb.demiPied],
    [HAUT_PARE_BRISE, pb.demiHaut]], [pb.arrondiHaut, pb.arrondiPied, pb.arrondiPied, pb.arrondiHaut]);
  const lunette = [[LUNETTE.haut[0], -D.lunette.demiHaut], [LUNETTE.haut[0], D.lunette.demiHaut], [LUNETTE.bas[0], D.lunette.demiBas],
    [LUNETTE.bas[0], -D.lunette.demiBas]];
  const vi = D.vitres, vitresVisibles = assez(vi.exterieur - vi.interieur);
  const vitres = vitresVisibles && [-1, 1].flatMap((cote) => {
    const nom = cote < 0 ? "gauche" : "droite";
    return [forme(vitreDessus(true, cote), { fill: MATIERES.vitre, "data-r": `vitre-avant-${nom}` }),
      forme(vitreDessus(false, cote), { fill: MATIERES.vitre, "data-r": `vitre-arriere-${nom}` })];
  });
  const feux = [-1, 1].flatMap((cote) => {
    const nom = cote < 0 ? "gauche" : "droit";
    const phare = feuDessus(D.phare, 1, cote), feu = feuDessus(D.feu, -1, cote);
    return [assez(D.phare.profondeur) && forme(phare, { fill: MATIERES.phare, "data-r": `phare-${nom}`, ...repere(centreDe(phare)) }),
      assez(D.feu.profondeur) && forme(feu, { fill: MATIERES.feu, "data-r": `feu-${nom}`, ...repere(centreDe(feu)) })];
  });
  const ligne = ([a, b], couleur) => n("line", { x1: a[0] * e, y1: a[1] * e, x2: b[0] * e, y2: b[1] * e, stroke: couleur,
    "stroke-width": fin, "stroke-linecap": "round" });
  const joints = traitDetail && [-1, 1].map((cote) => ligne(D.capot.map(([px, py]) => [px, cote * py]), c.ombre));
  const essuieGlaces = traitDetail && n("g", { "data-r": "essuie-glaces", ...repere([PIED_PARE_BRISE, 0]) },
    D.essuieGlaces.map((balai) => ligne(balai, MATIERES.joint)));

  // Portière du conducteur : son empreinte fermée (EMPREINTE_PORTIERE) tourne autour de la charnière ; l'habitacle qu'elle
  // découvre est cette même empreinte, laissée en place sous elle. Ce qui s'en voit croît donc avec l'angle, sans saut, le
  // pare-brise restant en place ; le contour de la portière apparaît sur ses PORTIERE.fondu premiers degrés.
  const ouverte = portiere > 0 ? "inline" : "none";
  const ouverture = forme(EMPREINTE_PORTIERE, { fill: MATIERES.habitacle, display: ouverte, "data-r": "ouverture" });
  const laPortiere = n("g", { "data-r": "portiere", transform: rotationPortiere, display: ouverte, "data-angle": portiere,
    ...repere(PIVOT_PORTIERE) },
  forme(EMPREINTE_PORTIERE, { fill: c.base, stroke: c.bord, "stroke-width": fin, "stroke-opacity": Math.min(1, portiere / PORTIERE.fondu),
    "stroke-linejoin": "round", "data-r": "panneau" }),
  vitresVisibles && forme(VITRE_PORTIERE, { fill: MATIERES.vitre }));

  const boitier = (cote) => {
    const pts = RETRO.boitier.map(([px, py]) => [px, cote * py]);
    return [forme(arrondir(pts, RETRO.arrondis), { fill: c.base, stroke: c.bord, "stroke-width": fin, "stroke-linejoin": "round" })];
  };
  const pi = RETRO_INTERIEUR;
  const lesRetroviseurs = retroviseurs && [
    n("g", { "data-r": "retroviseur-gauche", transform: rotationPortiere,
      ...repere(tournerAutour([RETRO.miroir, -RETRO.centre], PIVOT_PORTIERE, portiere)) }, boitier(-1)),
    n("g", { "data-r": "retroviseur-droit", ...repere([RETRO.miroir, RETRO.centre]) }, boitier(1)),
    forme(arrondir([[pi.miroir, -pi.demiLargeur], [pi.avant, -pi.demiLargeur], [pi.avant, pi.demiLargeur], [pi.miroir, pi.demiLargeur]],
      [pi.arrondi, pi.arrondi, pi.arrondi, pi.arrondi]), { fill: MATIERES.joint, "data-r": "retroviseur-interieur", ...repere([pi.miroir, 0]) })];

  return n("g", { "data-r": role, transform: `translate(${coord(x)} ${coord(y)}) rotate(${coord(cap)})`, "data-x": x, "data-y": y,
    "data-angle": cap },
  caisse, joints,
  finition && forme(arrondir(toit, toit.map(() => D.toit.arrondi)), { fill: c.reflet, "data-r": "toit", ...repere([(HAUT_PARE_BRISE + LUNETTE.haut[0]) / 2, 0]) }),
  forme(pareBrise, { fill: MATIERES.vitre, "data-r": "pare-brise", ...repere([(HAUT_PARE_BRISE + PIED_PARE_BRISE) / 2, 0]) }),
  assez(largeurBande(D.reflet)) && forme(bande(pareBrise, D.reflet), { fill: MATIERES.vitreReflet, "data-r": "reflet-pare-brise" }),
  forme(arrondir(lunette, lunette.map(() => D.lunette.arrondi)), { fill: MATIERES.vitre, "data-r": "lunette",
    ...repere([(LUNETTE.haut[0] + LUNETTE.bas[0]) / 2, 0]) }),
  vitres, feux, essuieGlaces, lesRoues, ouverture, laPortiere, lesRetroviseurs);
}

// ----- Profil : une citadine à hayon réelle -----
//
// Retour du formateur du 22/10/2026 sur la voiture de profil précédente (une compacte de 4,5 m tracée sans modèle) : « les
// proportions sont complètement disproportionnées. La porte avant est toute petite, alors que l'arrière est immense. Je dirais :
// un break étrange. » La voiture de profil est désormais une citadine à hayon cinq portes réelle, la Dacia Sandero III (depuis
// 2020), dont la silhouette se dérive de ses cotes :
// - cotes du constructeur, reprises telles quelles : longueur 4,088 m, largeur 1,85 m, hauteur 1,499 m, empattement 2,604 m,
//   porte-à-faux avant 0,819 m et arrière 0,665 m ; pneus 195/55 R16, 0,62 m de diamètre (185/65 R15 sur d'autres versions : le
//   même diamètre) ; garde au sol 0,162 m (fiche technique de L'argus, Sandero III 1.0 TCe 90 Confort, largus.fr ; mêmes cotes
//   chez autotijd.be, Sandero TCe 90 ; consultées le 22/10/2026) ;
// - le reste relevé sur une vue de côté de la voiture (carsized.com, « Dacia Sandero 2020 side view », consultée le 22/10/2026),
//   mise à l'échelle par l'empattement (les roues et le flanc sont dans le même plan, face à l'objectif) : capot, pare-brise, toit,
//   lunette, vitres et montants, portières et leurs joints, poignées, trappe, phare et feu. La photo, prise en perspective,
//   raccourcit les extrémités, plus éloignées de l'objectif que le flanc : ce qui est devant l'essieu avant ou derrière l'essieu
//   arrière est étiré jusqu'aux porte-à-faux cotés, et le toit, de même, porté à la hauteur cotée ;
// - relevés, en mètres, x vers l'avant depuis le milieu de la voiture : capot de 0,83 m à son rebord avant à 1,05 m au pied du
//   pare-brise, 0,26 m derrière l'essieu avant ; pare-brise penché de 64 degrés sur la verticale ; toit au plus haut au-dessus des
//   sièges avant, puis descendant jusqu'au becquet, 0,10 m derrière l'essieu arrière ; lunette penchée de 48 degrés, puis hayon
//   presque vertical ; bas de caisse à 0,245 m ; passages de roue de 0,37 m de rayon ;
// - vitres : de la pointe du montant de pare-brise (0,34 m derrière l'essieu avant, au pied du rétroviseur) à la pointe arrière de
//   la vitre de custode, 1,28 m derrière le milieu ; la ligne de ceinture monte doucement de 0,965 à 1,04 m, puis le bas des vitres
//   remonte d'un coup vers la pointe arrière : un montant arrière large, plein, celui d'une berline à hayon. Montant milieu de
//   0,17 m (noir sur la voiture : de la teinte des joints dans la voiture détaillée, de celle de la caisse en silhouette) ;
// - portière avant de 1,04 m de long, de son bord avant, juste derrière le passage de la roue avant, au joint du montant milieu ;
//   portière arrière de 0,97 m à la ceinture, 0,68 m en bas, son bord arrière contournant le passage de la roue arrière : la
//   portière avant est la plus longue ; poignées de 0,22 m à l'arrière de chaque portière ;
// - trappe à carburant de 0,26 m sur 0,16 au-dessus de la roue arrière, devant le feu (elle est à droite sur la voiture : dessinée
//   du côté que montre la vue), charnière à l'avant ; ouverte à 120 degrés, sa face intérieure, où se colle souvent l'étiquette des
//   pressions, se voit de profil ; une portière ouverte l'est à 60 degrés, la portière tenue pour plane ;
// - œil du conducteur à 1,20 m du sol (assise vers 0,55 m, œil 0,65 m au-dessus) et 0,15 m derrière le milieu : la tête juste
//   devant le montant milieu, l'appuie-tête derrière lui sur la photo. Choix de dessin, sans référence mesurée ;
// - la vue du dessus garde la voiture des scènes (4,5 m sur 1,8 m) : la voiture de profil est plus courte qu'elle de 41 cm.

// Cotes du constructeur (mètres).
const COTES_PROFIL = { longueur: 4.088, largeur: 1.85, hauteur: 1.499, empattement: 2.604, porteAFauxAvant: 0.819,
  porteAFauxArriere: 0.665, pneu: 0.62, gardeAuSol: 0.162 };
const DEMI_LP = COTES_PROFIL.longueur / 2, DEMI_WP = COTES_PROFIL.largeur / 2;
const ESSIEU_AVANT_P = DEMI_LP - COTES_PROFIL.porteAFauxAvant, ESSIEU_ARRIERE_P = ESSIEU_AVANT_P - COTES_PROFIL.empattement;
const RAYON_ROUE_P = COTES_PROFIL.pneu / 2;
const JANTE_P = 0.41;                     // jante de 16 pouces, rebord compris
const BAS_CAISSE_P = 0.245, JEU_PASSAGE_P = 0.06;
// Contour de la caisse (relevé), sommets [x, hauteur], de l'avant du bouclier, sous le nez, au bas du bouclier arrière, par le
// toit ; puis les passages de roue. Le pied de la lunette est sur la pente qui va du becquet au coin du hayon.
const PROFIL_P = {
  bouclierAvant: [1.88, 0.25], nezBas: [DEMI_LP, 0.34], nezHaut: [DEMI_LP, 0.66], levreCapot: [1.94, 0.83], capot: [1.45, 0.975],
  auvent: [0.95, 1.05], tetePareBrise: [0.12, 1.45], toitAvant: [-0.30, COTES_PROFIL.hauteur], toitArriere: [-0.70, COTES_PROFIL.hauteur],
  hautLunette: [-1.48, 1.426], basLunette: [-1.83, 1.115], hayon: [-1.92, 1.035], arriereHaut: [-DEMI_LP, 0.66],
  arriereBas: [-DEMI_LP, 0.42], bouclierArriere: [-1.90, 0.27],
};
// Arrondis du contour (mètres le long de chaque côté) ; le pied de la lunette reste vif : c'est le repère que frôle la ligne de
// visée vers l'arrière.
const ARRONDIS_P = { bouclierAvant: 0.05, nezBas: 0.06, nezHaut: 0.12, levreCapot: 0.10, capot: 0.40, auvent: 0.04, tetePareBrise: 0.25,
  toitAvant: 0.30, toitArriere: 0.60, hautLunette: 0.05, basLunette: 0, hayon: 0.08, arriereHaut: 0.08, arriereBas: 0.08, bouclierArriere: 0.06 };
const ORDRE_P = Object.keys(PROFIL_P);
// Points du nez et de l'arrière que désignent les repères avantCapot et arriereCoffre : sur les faces verticales du bouclier.
const NEZ_P = 0.45, ARRIERE_P = 0.54;
// Vitres latérales (relevé) : pointe avant, coude du montant de pare-brise, haut du cadre (avant, milieu, arrière), pointe
// arrière, remontée du bas de la vitre de custode, pied de la ceinture à l'arrière ; montant milieu entre les deux portières.
const VITRAGE_P = { avantBas: [0.88, 0.965], pilier: [0.66, 1.135], hautAvant: [0.02, 1.415], haut: [-0.55, 1.437],
  hautArriere: [-1.22, 1.37], pointe: [-1.285, 1.29], coude: [-1.10, 1.125], arriereBas: [-0.82, 1.04], montant: [-0.36, -0.19] };
const ARRONDIS_VITRAGE_P = [0.02, 0.06, 0.25, 0.35, 0.06, 0.03, 0.08, 0.12];
const ORDRE_VITRAGE_P = ["avantBas", "pilier", "hautAvant", "haut", "hautArriere", "pointe", "coude", "arriereBas"];
// Portière avant : bord avant, joint du montant milieu, bas, épaisseur ; charnière [x, distance à l'axe] ; ouverture (degrés).
const PORTIERE_P = { avant: 0.80, arriere: -0.24, bas: 0.29, epaisseur: 0.12, charniere: [0.78, 0.86], ouverture: 60 };
// Portière arrière : son bord arrière, vertical sous la vitre de custode, puis un arc de ce rayon autour de la roue arrière.
const PORTE_ARRIERE_P = { bord: -1.21, rayon: 0.46 };
// Poignées : longueur, hauteur, arrondi ; centre de celle de la portière avant et de la portière arrière.
const POIGNEES_P = { longueur: 0.22, hauteur: 0.045, arrondi: 0.02, avant: [-0.06, 0.817], arriere: [-0.97, 0.871] };
// Trappe à carburant : centre, taille, arrondi, ouverture (degrés), rayon du bouchon.
const TRAPPE_P = { centre: [-1.40, 0.90], largeur: 0.26, hauteur: 0.16, arrondi: 0.04, ouverture: 120, bouchon: 0.045 };
const PHARE_P = { points: [[1.58, 0.86], [1.90, 0.815], [1.96, 0.72], [1.66, 0.80]], arrondis: [0.03, 0.03, 0.03, 0.05] };
const FEU_P = { points: [[-1.56, 1.028], [-1.885, 1.035], [-1.945, 0.905], [-1.76, 0.935]], arrondis: [0.02, 0.03, 0.03, 0.05] };
// Rétroviseur, au pied du montant de pare-brise : de profil, entre miroir (arrière) et avant, bas et haut ; vu du dessus, du pied
// (sur la portière) au bout, distances à l'axe.
const RETRO_P = { miroir: 0.53, avant: 0.70, pied: 0.88, bout: 1.00,
  profil: [[0.545, 0.965], [0.70, 0.985], [0.695, 1.10], [0.56, 1.12]], arrondis: [0.02, 0.04, 0.04, 0.03] };
const OEIL_P = [-0.15, 1.20];
// Montant découvert portière ouverte (la face où se colle souvent l'étiquette des pressions) : son bord avant ; le repère.
const MONTANT_P = { avant: -0.15, etiquette: [-0.195, 0.74] };
// Reflets des vitres (voiture détaillée), siège du conducteur découvert portière ouverte, épaule, seuil.
const REFLETS_P = [{ pente: -0.45, debut: 0.25, fin: 0.39, origine: 1 }, { pente: -0.45, debut: -0.80, fin: -0.70, origine: 1 }];
const SIEGE_P = {
  assise: [[-0.12, 0.50], [0.40, 0.53], [0.41, 0.61], [-0.06, 0.62]],
  dossier: [[-0.12, 0.55], [0.00, 0.60], [-0.22, 1.10], [-0.34, 1.07]],
  appuieTete: [[-0.37, 1.13], [-0.25, 1.14], [-0.26, 1.33], [-0.37, 1.32]],
  arrondi: 0.04,
};
const EPAULE_P = 0.18, SEUIL_PORTE_P = 0.34;
const JANTE = { fond: 0.175, moyeu: 0.05, cache: 0.022, fenetres: 5, ouverture: 44, interieur: 0.065, exterieur: 0.16, arrondi: 0.02,
  calage: -90 };

const RAYON_PASSAGE_P = RAYON_ROUE_P + JEU_PASSAGE_P;
// Passage de roue : l'arc du bas de caisse, à l'arrière de la roue, jusqu'au bas de caisse, à l'avant, par le haut.
function passage(essieu) {
  const pied = Math.asin((BAS_CAISSE_P - RAYON_ROUE_P) / RAYON_PASSAGE_P) / RAD;
  return arc([essieu, RAYON_ROUE_P], RAYON_PASSAGE_P, 180 - pied, pied);
}
const CONTOUR_PROFIL = (() => {
  const sommets = [...ORDRE_P.map((k) => [PROFIL_P[k], ARRONDIS_P[k]]),
    ...passage(ESSIEU_ARRIERE_P).map((p) => [p, 0]), ...passage(ESSIEU_AVANT_P).map((p) => [p, 0])];
  return arrondir(sommets.map(([p]) => p), sommets.map(([, r]) => r));
})();
// Repères que frôlent les lignes de visée de l'œil : le point du capot (devant le pied du pare-brise) et celui du hayon
// (derrière le pied de la lunette) les plus hauts vus de l'œil. Le pare-brise et la lunette, vitrés, laissent voir.
function frole(garder, pente) {
  let meilleur = null, max = -Infinity;
  for (const p of CONTOUR_PROFIL) if (garder(p) && pente(p) > max) { max = pente(p); meilleur = p; }
  return meilleur;
}
const [OEIL_X, OEIL_H] = OEIL_P;
const HAUT_CAPOT = frole((p) => p[0] >= PROFIL_P.auvent[0], ([px, ph]) => (ph - OEIL_H) / (px - OEIL_X));
const HAUT_COFFRE = frole((p) => p[0] <= PROFIL_P.basLunette[0], ([px, ph]) => (ph - OEIL_H) / (OEIL_X - px));

/** Contour des vitres latérales de la voiture de profil, [x, hauteur] (m), coins arrondis : de la pointe avant, par le montant
 *  de pare-brise et le haut du cadre, à la pointe arrière, puis le bas des vitres. */
export const VITRAGE_PROFIL = Object.freeze(arrondir(ORDRE_VITRAGE_P.map((k) => VITRAGE_P[k]), ARRONDIS_VITRAGE_P));
// Ligne de ceinture de la voiture de profil : hauteur (m) du bas des vitres à l'abscisse px, droite du pied arrière de la ceinture
// à la pointe avant, prolongée au-delà.
const ceintureP = (px) => VITRAGE_P.arriereBas[1]
  + ((px - VITRAGE_P.arriereBas[0]) / (VITRAGE_P.avantBas[0] - VITRAGE_P.arriereBas[0])) * (VITRAGE_P.avantBas[1] - VITRAGE_P.arriereBas[1]);
// Hauteur du bas des vitres à l'abscisse px (la plus basse des traversées du contour), entre les deux pointes.
function basDesVitres(px) {
  let bas = Infinity;
  VITRAGE_PROFIL.forEach((a, i) => {
    const b = VITRAGE_PROFIL[(i + 1) % VITRAGE_PROFIL.length];
    if ((a[0] - px) * (b[0] - px) <= 0 && a[0] !== b[0]) bas = Math.min(bas, a[1] + ((px - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
  });
  return bas;
}
// Joints : le bord avant de la portière avant, vertical, juste derrière le passage de la roue avant ; le joint du montant milieu ;
// le bord arrière de la portière arrière, vertical sous la vitre de custode puis en arc autour du passage de la roue arrière.
const JOINT_AVANT = [[PORTIERE_P.avant, PORTIERE_P.bas], [PORTIERE_P.avant, ceintureP(PORTIERE_P.avant)]];
const JOINT_MILIEU = [[PORTIERE_P.arriere, PORTIERE_P.bas], [PORTIERE_P.arriere, ceintureP(PORTIERE_P.arriere)]];
const JOINT_ARRIERE = (() => {
  const { bord, rayon } = PORTE_ARRIERE_P;
  const de = Math.acos((bord - ESSIEU_ARRIERE_P) / rayon) / RAD, a = Math.asin((PORTIERE_P.bas - RAYON_ROUE_P) / rayon) / RAD;
  return [[bord, basDesVitres(bord)], ...arc([ESSIEU_ARRIERE_P, RAYON_ROUE_P], rayon, de, a)];
})();
// Cadre de la vitre de la portière avant : le contour des vitres, de la pointe avant jusqu'au joint du montant milieu
// (RANG_JOINT_MILIEU, premier point derrière lui), et le haut du bord arrière de la portière, où ce joint coupe le haut du cadre.
const RANG_JOINT_MILIEU = VITRAGE_PROFIL.findIndex((p, i) => i > 0 && p[0] < PORTIERE_P.arriere);
const HAUT_BORD_ARRIERE = (() => {
  const a = VITRAGE_PROFIL[RANG_JOINT_MILIEU - 1], b = VITRAGE_PROFIL[RANG_JOINT_MILIEU];
  return entre(a, b, (PORTIERE_P.arriere - a[0]) / (b[0] - a[0]));
})();
// Bord arrière de la portière avant, du bas au haut du cadre ; contour de la portière fermée, vitre comprise : bord avant, bas,
// bord arrière, cadre.
const BORD_ARRIERE_PORTIERE = [[PORTIERE_P.arriere, PORTIERE_P.bas], [PORTIERE_P.arriere, ceintureP(PORTIERE_P.arriere)], HAUT_BORD_ARRIERE];
const CONTOUR_PORTIERE = [...JOINT_AVANT.slice().reverse(), ...BORD_ARRIERE_PORTIERE,
  ...VITRAGE_PROFIL.slice(0, RANG_JOINT_MILIEU).reverse()];
const BAS_DE_CAISSE = (() => {
  const angle = (dh) => Math.asin(dh / RAYON_PASSAGE_P) / RAD;
  const [bas, haut] = [angle(BAS_CAISSE_P - RAYON_ROUE_P), angle(PORTIERE_P.bas - RAYON_ROUE_P)];
  return [...arc([ESSIEU_AVANT_P, RAYON_ROUE_P], RAYON_PASSAGE_P, 180 - haut, 180 - bas),
    ...arc([ESSIEU_ARRIERE_P, RAYON_ROUE_P], RAYON_PASSAGE_P, bas, haut)];
})();
// Portière ouverte de profil, tenue pour plane : un point à x, à dz mètre hors de l'axe de la charnière (vers l'extérieur),
// se voit en charnière + (x - charnière) cos a + dz sin a. La peau extérieure est à la demi-largeur de la voiture.
const DZ_PEAU = DEMI_WP - PORTIERE_P.charniere[1];
function projeterPortiere([px, ph], dz, angle = PORTIERE_P.ouverture) {
  return [PORTIERE_P.charniere[0] + (px - PORTIERE_P.charniere[0]) * Math.cos(angle * RAD) + dz * Math.sin(angle * RAD), ph];
}
const devantCharniereP = (p) => p[0] - PORTIERE_P.charniere[0];
const EPAULE_CONTOUR = couper(couper(CONTOUR_PROFIL, (p) => ceintureP(p[0]) - EPAULE_P - p[1]), (p) => p[1] - ceintureP(p[0]));
// Trappe : rectangle arrondi ; ouverte, tournée autour de sa charnière (bord avant) au-delà de l'angle droit.
const TRAPPE_CONTOUR = (() => {
  const [cx, ch] = TRAPPE_P.centre, dl = TRAPPE_P.largeur / 2, dh = TRAPPE_P.hauteur / 2;
  const coins = [[cx - dl, ch - dh], [cx + dl, ch - dh], [cx + dl, ch + dh], [cx - dl, ch + dh]];
  return arrondir(coins, coins.map(() => TRAPPE_P.arrondi));
})();
const CHARNIERE_TRAPPE = TRAPPE_P.centre[0] + TRAPPE_P.largeur / 2;
const ouvrirTrappe = ([px, ph]) => [CHARNIERE_TRAPPE + (px - CHARNIERE_TRAPPE) * Math.cos(TRAPPE_P.ouverture * RAD), ph];
const TRAPPE_OUVERTE_CENTRE = ouvrirTrappe(TRAPPE_P.centre);

/** La voiture de profil (Dacia Sandero III), cotes et choix de dessin, en mètres, x vers l'avant depuis le milieu de la voiture,
 *  hauteur au-dessus du sol : cotes du constructeur (longueur, largeur, hauteur, empattement, porte-à-faux, diamètre du pneu, garde
 *  au sol) ; essieux ; contour de la caisse (`profil`, ses sommets) ; vitres et montant milieu ; portières, poignées, trappe à
 *  carburant, rétroviseur ; œil du conducteur. Figée, comme VOITURE. */
export const VOITURE_PROFIL = figer({
  ...COTES_PROFIL, essieuAvant: ESSIEU_AVANT_P, essieuArriere: ESSIEU_ARRIERE_P, jante: JANTE_P, basCaisse: BAS_CAISSE_P,
  jeuPassage: JEU_PASSAGE_P, profil: PROFIL_P, vitrage: VITRAGE_P, portiere: PORTIERE_P, porteArriere: PORTE_ARRIERE_P,
  poignees: POIGNEES_P, trappe: TRAPPE_P, retroviseur: RETRO_P, oeil: OEIL_P,
});

/** Repères d'une voiture de profil, en points du cadre : œil du conducteur ; avant et arrière de la caisse (sur les faces des
 *  boucliers, aux points les plus avancé et reculé) ; hautCapot et hautCoffre, les points que frôlent les lignes de visée de l'œil
 *  par-dessus le capot et par le pied de la lunette ; montant milieu découvert portière ouverte (là où se colle souvent l'étiquette
 *  des pressions) ; trappe à carburant (son centre, ou, ouverte, celui de sa face intérieure) ; sol sous l'avant et sous l'arrière. */
export function reperesProfil({ x, y, echelle, sens = "droite", trappeOuverte = false }) {
  const qui = "Repères de la voiture de profil";
  verifierPose(qui, { x, y, echelle });
  const s = signeSens(sens, qui), v = ([px, ph]) => [x + s * px * echelle, y - ph * echelle];
  return {
    oeil: v(OEIL_P), avantCapot: v([DEMI_LP, NEZ_P]), hautCapot: v(HAUT_CAPOT),
    arriereCoffre: v([-DEMI_LP, ARRIERE_P]), hautCoffre: v(HAUT_COFFRE), montantPortiere: v(MONTANT_P.etiquette),
    trappe: v(trappeOuverte ? TRAPPE_OUVERTE_CENTRE : TRAPPE_P.centre), solAvant: v([DEMI_LP, 0]), solArriere: v([-DEMI_LP, 0]),
  };
}

/** Voiture de profil, une citadine à hayon cinq portes (Dacia Sandero III, à ses cotes) : caisse, vitres et montants, roues (pneu,
 *  jante), passages de roue, phare et feu, rétroviseur, poignées, joints, trappe à carburant. (x, y) : point du sol sous le milieu
 *  de la voiture ; échelle en unités par mètre ; sens : vers où regarde l'avant, « droite » montre le côté droit de la voiture,
 *  « gauche » son côté gauche, celui du conducteur ; portiereOuverte : la portière avant de ce côté, ouverte ; trappeOuverte : la
 *  trappe à carburant de ce côté, ouverte. Ouvertes ou fermées, la portière et la trappe gardent leurs nœuds (display none).
 *  `schema` : le style schématique (décision du formateur du 15/10/2026, « pictogramme plutôt qu'illustration »), comme
 *  voitureDessus : la silhouette de la caisse et son contour, les vitres latérales (le montant milieu, assez grand pour se voir, les
 *  sépare dans la teinte de la caisse), les roues en deux tons, pneu et jante pleine, et leurs passages de la teinte du pneu (la
 *  roue remplit son passage : aucun anneau clair autour d'elle) ; portière et trappe ouvertes à la demande, en aplats (l'habitacle
 *  découvert, le montant, le seuil, la portière, son chant et sa vitre ; le logement et le volet de la trappe) ; aux mêmes tracés
 *  que la voiture détaillée. Aucun détail de finition : ni fond, fenêtres ou moyeu des jantes, ni bas de caisse, ni épaule, ni
 *  reflets, ni phare, ni feu, ni rétroviseur, ni poignées, ni joints, ni trappe fermée, ni bouchon, ni siège. */
export function voitureProfil({ x, y, echelle, teinte = "eleve", sens = "droite", portiereOuverte = false, trappeOuverte = false,
  schema = false, role = "voiture-profil" }) {
  const qui = "Voiture de profil";
  verifierPose(qui, { x, y, echelle });
  const c = carrosserie(teinte, qui), s = signeSens(sens, qui), e = echelle;
  const v = ([px, ph]) => [x + s * px * e, y - ph * e];
  const forme = (pts, attributs) => n("path", { d: trace(pts.map(v)), ...attributs });
  const ligne = (pts, attributs) => n("path", { d: trace(pts.map(v), false), fill: "none", "stroke-linecap": "round",
    "stroke-linejoin": "round", ...attributs });
  const repere = (p) => { const [px, py] = v(p); return { "data-x": px, "data-y": py }; };
  // Détails de finition : seulement hors du style schématique, et assez grands pour se voir.
  const finition = !schema, visible = (metres) => metres * e >= DETAIL_MIN;
  const assez = (metres) => finition && visible(metres), traitDetail = finition && 1 / e <= TRAIT_DETAIL_MAX;
  const fin = CHARTE.traits.fin;
  const affiche = (oui) => (oui ? "inline" : "none");

  const roue = (role, essieu) => {
    const [cx, cy] = v([essieu, RAYON_ROUE_P]), j = JANTE;
    const fenetres = assez(j.exterieur - j.interieur) && Array.from({ length: j.fenetres }, (_, k) => {
      const milieu = j.calage + (360 / j.fenetres) * (k + 1 / 2), de = milieu - j.ouverture / 2, a = milieu + j.ouverture / 2;
      const pts = [...arc([essieu, RAYON_ROUE_P], j.exterieur, de, a), ...arc([essieu, RAYON_ROUE_P], j.interieur, a, de)];
      const coins = [0, pts.length / 2 - 1, pts.length / 2, pts.length - 1];
      return forme(arrondir(pts, pts.map((_, i) => (coins.includes(i) ? j.arrondi : 0))), { fill: MATIERES.fenetres });
    });
    return n("g", { "data-r": role, ...repere([essieu, RAYON_ROUE_P]) },
      n("circle", { cx, cy, r: RAYON_ROUE_P * e, fill: MATIERES.pneu, "data-r": "pneu" }),
      n("circle", { cx, cy, r: (JANTE_P / 2) * e, fill: MATIERES.jante, "data-r": "jante" }),
      assez(JANTE_P / 2 - j.fond) && n("circle", { cx, cy, r: j.fond * e, fill: MATIERES.janteFond }),
      fenetres,
      assez(j.moyeu) && n("circle", { cx, cy, r: j.moyeu * e, fill: MATIERES.jante }),
      assez(j.cache) && n("circle", { cx, cy, r: j.cache * e, fill: MATIERES.moyeu }));
  };

  const montantMilieu = couper(couper(VITRAGE_PROFIL, (p) => VITRAGE_P.montant[0] - p[0]), (p) => p[0] - VITRAGE_P.montant[1]);
  const vitreAvant = couper(VITRAGE_PROFIL, (p) => VITRAGE_P.montant[1] - p[0]);
  const vitreArriere = couper(VITRAGE_PROFIL, (p) => p[0] - VITRAGE_P.montant[0]);
  const poignee = ([px, ph]) => {
    const p = POIGNEES_P, dl = p.longueur / 2, dh = p.hauteur / 2;
    const coins = [[px - dl, ph - dh], [px + dl, ph - dh], [px + dl, ph + dh], [px - dl, ph + dh]];
    return arrondir(coins, coins.map(() => p.arrondi));
  };
  const retroviseur = arrondir(RETRO_P.profil, RETRO_P.arrondis), retroVisible = assez(RETRO_P.avant - RETRO_P.miroir);
  const [retroBas, retroHaut] = [Math.min(...RETRO_P.profil.map((p) => p[1])), Math.max(...RETRO_P.profil.map((p) => p[1]))];

  // Trappe fermée (son joint) ou ouverte : le logement sombre et le bouchon, la trappe tournée devant sa charnière.
  const trappeFermee = n("g", { "data-r": "trappe-fermee", display: affiche(!trappeOuverte), ...repere(TRAPPE_P.centre) },
    traitDetail && forme(TRAPPE_CONTOUR, { fill: c.base, stroke: c.ombre, "stroke-width": fin, "data-r": "volet" }));
  const trappeOuverteG = n("g", { "data-r": "trappe-ouverte", display: affiche(trappeOuverte), "data-angle": TRAPPE_P.ouverture,
    ...repere(TRAPPE_OUVERTE_CENTRE) },
  forme(TRAPPE_CONTOUR, { fill: MATIERES.joint }),
  finition && n("circle", { cx: v(TRAPPE_P.centre)[0], cy: v(TRAPPE_P.centre)[1], r: TRAPPE_P.bouchon * e, fill: MATIERES.bouchon }),
  forme(TRAPPE_CONTOUR.map(ouvrirTrappe), { fill: c.ombre, stroke: c.bord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "volet" }));

  // Portière fermée : son joint avant, sa poignée, son rétroviseur. Ouverte : l'habitacle découvert (siège, montant milieu,
  // seuil), puis la portière vue de biais, son chant derrière elle.
  const portiereFermee = n("g", { "data-r": "portiere-fermee", display: affiche(!portiereOuverte) },
    traitDetail && ligne(JOINT_AVANT, { stroke: c.ombre, "stroke-width": fin, "data-r": "joint-avant" }),
    assez(POIGNEES_P.hauteur) && forme(poignee(POIGNEES_P.avant), { fill: c.ombre, "data-r": "poignee-avant" }),
    retroVisible && forme(retroviseur, { fill: c.base, stroke: c.bord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "retroviseur",
      ...repere([(RETRO_P.miroir + RETRO_P.avant) / 2, (retroBas + retroHaut) / 2]) }));
  const derriere = (pts) => couper(pts, devantCharniereP);
  const panneau = derriere(CONTOUR_PORTIERE).map((p) => projeterPortiere(p, DZ_PEAU));
  const vitreOuverte = derriere(vitreAvant).map((p) => projeterPortiere(p, DZ_PEAU));
  const epauleOuverte = derriere(couper(couper(CONTOUR_PORTIERE, (p) => ceintureP(p[0]) - EPAULE_P - p[1]), (p) => p[1] - ceintureP(p[0])))
    .map((p) => projeterPortiere(p, DZ_PEAU));
  const chant = [...BORD_ARRIERE_PORTIERE.map((p) => projeterPortiere(p, DZ_PEAU)),
    ...BORD_ARRIERE_PORTIERE.map((p) => projeterPortiere(p, DZ_PEAU - PORTIERE_P.epaisseur)).reverse()];
  // Rétroviseur de la portière ouverte : son boîtier, du pied au bout, se voit entre les projections de ses coins.
  const coinsRetro = [RETRO_P.miroir, RETRO_P.avant].flatMap((px) => [RETRO_P.pied, RETRO_P.bout].map((d) =>
    projeterPortiere([px, 0], d - PORTIERE_P.charniere[1])[0]));
  const [retroDe, retroA] = [Math.min(...coinsRetro), Math.max(...coinsRetro)];
  const retroOuvert = retroviseur.map(([px, ph]) => [retroDe + ((px - RETRO_P.miroir) / (RETRO_P.avant - RETRO_P.miroir)) * (retroA - retroDe), ph]);
  const portiereOuverteG = n("g", { "data-r": "portiere-ouverte", display: affiche(portiereOuverte), "data-angle": PORTIERE_P.ouverture,
    ...repere([PORTIERE_P.charniere[0], PORTIERE_P.bas]) },
  forme(CONTOUR_PORTIERE, { fill: MATIERES.habitacle, "data-r": "ouverture" }),
  finition && n("g", { "data-r": "siege" }, ["assise", "dossier", "appuieTete"].map((k) =>
    forme(couper(arrondir(SIEGE_P[k], SIEGE_P[k].map(() => SIEGE_P.arrondi)), (p) => PORTIERE_P.arriere - p[0]), { fill: MATIERES.siege }))),
  forme(couper(CONTOUR_PORTIERE, (p) => p[0] - MONTANT_P.avant), { fill: c.ombre, "data-r": "montant", ...repere(MONTANT_P.etiquette) }),
  forme(couper(CONTOUR_PORTIERE, (p) => p[1] - SEUIL_PORTE_P), { fill: c.base }),
  forme(chant, { fill: c.ombre, "data-r": "chant" }),
  forme(panneau, { fill: c.base, stroke: c.bord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "panneau" }),
  assez(EPAULE_P) && forme(epauleOuverte, { fill: c.reflet }),
  forme(vitreOuverte, { fill: MATIERES.vitre }),
  assez(POIGNEES_P.hauteur) && forme(derriere(poignee(POIGNEES_P.avant)).map((p) => projeterPortiere(p, DZ_PEAU)), { fill: c.ombre }),
  retroVisible && forme(retroOuvert, { fill: c.base, stroke: c.bord, "stroke-width": fin, "stroke-linejoin": "round" }));

  return n("g", { "data-r": role, "data-x": x, "data-y": y },
    // Passages de roue : sombres ; en silhouette, de la teinte du pneu, que la roue prolonge sans anneau clair autour d'elle.
    forme(passage(ESSIEU_AVANT_P), { fill: finition ? MATIERES.passage : MATIERES.pneu, "data-r": "passage-avant" }),
    forme(passage(ESSIEU_ARRIERE_P), { fill: finition ? MATIERES.passage : MATIERES.pneu, "data-r": "passage-arriere" }),
    roue("roue-avant", ESSIEU_AVANT_P), roue("roue-arriere", ESSIEU_ARRIERE_P),
    forme(CONTOUR_PROFIL, { fill: c.base, stroke: c.bord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "caisse" }),
    assez(PORTIERE_P.bas - BAS_CAISSE_P) && forme(BAS_DE_CAISSE, { fill: c.ombre, "data-r": "bas-de-caisse" }),
    assez(EPAULE_P) && forme(EPAULE_CONTOUR, { fill: c.reflet }),
    forme(VITRAGE_PROFIL, { fill: MATIERES.vitre, "data-r": "vitrage" }),
    REFLETS_P.map((r) => [vitreAvant, vitreArriere].map((vitre) => {
      const b = bande(vitre, r);
      return assez(largeurBande(r)) && b.length > 2 && forme(b, { fill: MATIERES.vitreReflet });
    })),
    visible(VITRAGE_P.montant[1] - VITRAGE_P.montant[0]) && forme(montantMilieu, { fill: finition ? MATIERES.joint : c.base, "data-r": "montant-milieu" }),
    traitDetail && ligne(JOINT_MILIEU, { stroke: c.ombre, "stroke-width": fin, "data-r": "joint-milieu" }),
    traitDetail && ligne(JOINT_ARRIERE, { stroke: c.ombre, "stroke-width": fin, "data-r": "joint-arriere" }),
    assez(POIGNEES_P.hauteur) && forme(poignee(POIGNEES_P.arriere), { fill: c.ombre, "data-r": "poignee-arriere" }),
    assez(petiteDimension(PHARE_P.points)) && forme(arrondir(PHARE_P.points, PHARE_P.arrondis), { fill: MATIERES.phare, "data-r": "phare",
      ...repere(PHARE_P.points[0]) }),
    assez(petiteDimension(FEU_P.points)) && forme(arrondir(FEU_P.points, FEU_P.arrondis), { fill: MATIERES.feu, "data-r": "feu",
      ...repere(FEU_P.points[0]) }),
    trappeFermee, trappeOuverteG, portiereFermee, portiereOuverteG);
}

// ===== Rétroviseur intérieur vu de face =====
// Le verre d'un rétroviseur intérieur courant, 25 cm sur 7, aux bouts arrondis (rayon de 45 % de sa hauteur), et ce qu'il
// montre une fois réglé : toute la lunette arrière, qui le remplit presque, centrée ; 80 % de la largeur du verre en haut, 75 %
// en bas (son bord haut, plus près de l'œil reflété, paraît plus large), 78 % de sa hauteur, coins arrondis (rayon de 4/37 de
// la hauteur du verre) ; l'horizon dans le quart haut de la lunette (le miroir, au haut du pare-brise, est au-dessus de l'œil :
// le regard plonge un peu par la lunette inclinée). Pièce commune des dessins qui le montrent de face (« retroviseurs »,
// vignette d'« installation ») : un seul verre, une seule lunette, à l'échelle que chacun choisit.
export const MIROIR_INTERIEUR = figer({
  rapport: 25 / 7,                                              // largeur du verre sur sa hauteur
  arrondi: 0.45,                                                // rayon des bouts du verre, en part de sa hauteur
  lunette: { haut: 0.80, bas: 0.75, hauteur: 0.78, arrondi: 4 / 37 },   // parts du verre (largeur, hauteur ; arrondi : hauteur)
  horizon: 0.25,                                                // part de la hauteur de la lunette, depuis son haut
});

/** Verre d'un rétroviseur intérieur de `largeur` unités, son coin haut gauche en (x, y), et la lunette arrière qu'il montre,
 *  décalée de `decal` (unités, [dx, dy]) tant que le miroir n'est pas réglé : hauteur du verre et rayon de ses bouts, contour
 *  du verre, coins de la lunette (haut gauche, haut droit, bas droit, bas gauche), son contour aux coins arrondis, ordonnée de
 *  l'horizon. Les contours sont des listes de points reliés par des segments, comme ceux d'arrondir. */
export function miroirInterieur({ x, y, largeur }, decal = [0, 0]) {
  const qui = "Rétroviseur intérieur";
  fini(x, `${qui} : x`);
  fini(y, `${qui} : y`);
  if (!(typeof largeur === "number" && Number.isFinite(largeur) && largeur > 0)) {
    throw new Error(`${qui} : largeur ${String(largeur)} invalide (nombre fini positif attendu).`);
  }
  decal.forEach((d, i) => fini(d, `${qui} : décalage ${i ? "vertical" : "de côté"}`));
  const M = MIROIR_INTERIEUR, L = M.lunette;
  const hauteur = largeur / M.rapport, rayon = M.arrondi * hauteur;
  const verre = arrondir([[x, y], [x + largeur, y], [x + largeur, y + hauteur], [x, y + hauteur]], [rayon, rayon, rayon, rayon]);
  const cx = x + largeur / 2 + decal[0], h = L.hauteur * hauteur;
  const yHaut = y + (hauteur - h) / 2 + decal[1], yBas = yHaut + h;
  const coins = [[cx - (L.haut * largeur) / 2, yHaut], [cx + (L.haut * largeur) / 2, yHaut], [cx + (L.bas * largeur) / 2, yBas],
    [cx - (L.bas * largeur) / 2, yBas]];
  const r = L.arrondi * hauteur;
  return { hauteur, rayon, verre, coins, lunette: arrondir(coins, [r, r, r, r]), horizon: yHaut + M.horizon * h };
}

// ===== Personnes et mains en pictogramme (style schématique) =====
// Décision du formateur du 15/10/2026 : « quelque chose de très schématisé et simple » pour tous les dessins. Une personne est
// une silhouette de pictogramme, comme sur un panneau : une tête ronde, un buste et des membres en formes simples (gélules,
// formes arrondies), d'une seule teinte, sans visage, sans cheveux, sans doigts ; un membre n'est dessiné que si la règle en a
// besoin. Une main n'est jamais dessinée : là où elle tient ou agit, un repère la marque (disqueMain), un disque du ton sombre de
// la peau marqué « G » ou « D », plein quand elle tient, creux quand elle a lâché ou se déplace.
//
// Teintes : la personne est sombre, comme le piéton des scènes, et se lit sur le fond, la carte et les objets clairs ; le membre
// du côté opposé (derrière le buste, de profil) prend un ton éclairci de la même teinte, qui le sépare du buste qu'il croise.
// Une partie posée devant une autre de la même teinte (le bras proche sur le buste) est bordée d'un liseré clair, comme sur un
// pictogramme : deux formes de même teinte ne se touchent jamais sans séparation.

/** Teintes d'une personne en pictogramme : la silhouette (teinte), et le membre du côté opposé (loin). Contrastes : la teinte à
 *  9,5:1 sur le fond, le ton éloigné à 3,2:1 sur le fond et à 2,9:1 sur la teinte (tests/dessins-kit.test.mjs). */
export const SILHOUETTE = figer({ teinte: "#36423C", loin: "#7E8982" });
const PLANS_SILHOUETTE = ["corps", "devant", "loin"];

/** Tracé d'une gélule : l'enveloppe de deux disques, de centres p1 et p2 et de rayons r1 et r2, arcs exacts (coordonnées du
 *  cadre). Le membre d'un pictogramme : bras, avant-bras, cuisse, jambe, buste vu de profil, pied vu du dessus. */
export function gelule(p1, r1, p2, r2) {
  const d = Math.max(distance(p1, p2), 1e-6);
  const u = [(p2[0] - p1[0]) * (1 / d), (p2[1] - p1[1]) * (1 / d)], v = [-u[1], u[0]];
  const sb = Math.max(-1, Math.min(1, (r1 - r2) / d)), cb = Math.sqrt(1 - sb * sb);
  const nA = [u[0] * sb + v[0] * cb, u[1] * sb + v[1] * cb], nB = [u[0] * sb - v[0] * cb, u[1] * sb - v[1] * cb];
  const sur = (p, nn, r) => [p[0] + nn[0] * r, p[1] + nn[1] * r];
  const a1 = sur(p1, nA, r1), a2 = sur(p2, nA, r2), b2 = sur(p2, nB, r2), b1 = sur(p1, nB, r1);
  const vectoriel = (a, b) => a[0] * b[1] - a[1] * b[0];
  const sens2 = vectoriel(moins(a2, p2), u) > 0 ? 1 : 0, sens1 = vectoriel(moins(b1, p1), [-u[0], -u[1]]) > 0 ? 1 : 0;
  return `M${point(a1)} L${point(a2)} A${coord(r2)} ${coord(r2)} 0 ${sb < 0 ? 1 : 0} ${sens2} ${point(b2)} `
    + `L${point(b1)} A${coord(r1)} ${coord(r1)} 0 ${sb > 0 ? 1 : 0} ${sens1} ${point(a1)} Z`;
}

/** Une partie d'une personne en pictogramme, faite d'un ou de plusieurs tracés fermés (gélules, formes arrondies) : plan
 *  « corps », de la teinte ; « devant », de la teinte, bordée d'un liseré clair (CHARTE.liseres de chaque côté) qui la détache de
 *  ce qu'elle recouvre ; « loin », du ton éloigné. Les liserés de tous les tracés passent sous toutes les formes pleines : deux
 *  tracés d'une même partie (le bras et l'avant-bras) se joignent sans trait clair entre eux. `roles` : le rôle de chaque forme
 *  pleine (son tracé se relit), dans l'ordre des tracés. */
export function formePictogramme(traces, { plan = "corps", roles = [] } = {}) {
  connu(plan, PLANS_SILHOUETTE, "Pictogramme : plan");
  const liste = Array.isArray(traces) ? traces : [traces], noms = Array.isArray(roles) ? roles : [roles];
  const pleins = liste.map((d, i) => n("path", { d, fill: plan === "loin" ? SILHOUETTE.loin : SILHOUETTE.teinte,
    ...(noms[i] ? { "data-r": noms[i] } : {}) }));
  const liseres = plan === "devant" ? liste.map((d) => n("path", { d, fill: CHARTE.carte, stroke: CHARTE.carte,
    "stroke-width": 2 * CHARTE.liseres, "stroke-linejoin": "round" })) : [];
  return n("g", { "data-r": "pictogramme", "data-plan": plan }, ...liseres, ...pleins);
}

/** Un membre en gélules, d'articulation en articulation : `points` (au moins deux, unités du cadre) et leurs `rayons`, un par
 *  point ; chaque segment est une gélule, et deux segments voisins ont le même rayon à leur articulation : le membre se plie sans
 *  cassure. Le buste vu de profil est un membre d'un seul segment. */
export function membrePictogramme({ points, rayons, plan = "corps", roles = [] }) {
  if (!Array.isArray(points) || points.length < 2 || !Array.isArray(rayons) || rayons.length !== points.length) {
    throw new Error("Membre en pictogramme : au moins deux points, et un rayon par point.");
  }
  points.forEach((p, i) => { fini(p[0], `Membre en pictogramme : x du point ${i}`); fini(p[1], `Membre en pictogramme : y du point ${i}`); });
  rayons.forEach((r, i) => { if (!(fini(r, `Membre en pictogramme : rayon ${i}`) > 0)) throw new Error(`Membre en pictogramme : rayon ${i} non positif.`); });
  const traces = points.slice(1).map((p, i) => gelule(points[i], rayons[i], p, rayons[i + 1]));
  return formePictogramme(traces, { plan, roles });
}

/** La tête ronde d'une personne en pictogramme : un disque de la teinte, de centre `centre` et de rayon `rayon` (unités du
 *  cadre). Un pictogramme la sépare du buste par un vide : rien ne la relie au cou. */
export function tetePictogramme({ centre, rayon, role = "tete" }) {
  return n("circle", { cx: centre[0], cy: centre[1], r: rayon, fill: SILHOUETTE.teinte, "data-r": role });
}

// Repère d'une main : un disque de rayon `rayon`, marqué « G » ou « D » (Outfit 700 de `lettre` unités), bordé d'un liseré clair,
// son contour un anneau de `anneau` unités. `plein` : de 0 (creux : le fond clair, la lettre du ton de la peau) à 1 (plein : le ton
// sombre de la peau, la lettre claire) ; entre les deux, le disque passe d'une teinte à l'autre en fondu, la lettre garde une
// teinte pure et s'efface au milieu du fondu (opacité |2 plein - 1|), là où elle change de teinte. Le ton sombre de la peau porte
// la lettre claire à 5:1 (le ton clair ne la porterait qu'à 3,5:1, sous les 4,5:1 d'un texte de cette taille).
const LETTRES_MAINS = { gauche: "G", droite: "D" };
const GRAISSE_REPERE = 700;
// Teinte à la part t du chemin de la couleur a à la couleur b (#RRGGBB, composantes arrondies à l'entier) : a à 0, b à 1.
function teinteEntre(a, b, t) {
  const composante = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(composante(a, i) + (composante(b, i) - composante(a, i)) * t).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Repère d'une main en (x, y) : « gauche » (G) ou « droite » (D) ; plein de 0 (creux) à 1 (plein) ; rayon, taille de la
 *  lettre et épaisseur de l'anneau en unités du cadre ; `attributs` : ceux que la famille ajoute au groupe (data-heure...) ;
 *  `lettreVisible` (0 à 1), le cas échéant : la part de la lettre qui se montre, quand l'autre repère passe sur celui-ci (la
 *  lettre d'un repère caché ne se lit pas à travers l'autre) ; à 0, elle est masquée (display none). Rôles : main-<cote> (centre
 *  en data-x et data-y), liseret-<cote>, disque-<cote>, anneau-<cote>, lettre-fondu-<cote>, lettre-<cote>. Mêmes nœuds quel que
 *  soit l'état : une animation ne change que leurs attributs. */
export function disqueMain({ x, y, cote, plein = 1, rayon, lettre, anneau, attributs = {}, lettreVisible }) {
  connu(cote, Object.keys(LETTRES_MAINS), "Repère de main : côté");
  [x, y, rayon, lettre, anneau].forEach((v, i) => fini(v, `Repère de main : ${["x", "y", "rayon", "lettre", "anneau"][i]}`));
  borne(plein, 0, 1, "Repère de main : plein");
  const f = plein;
  const opaciteLettre = Math.abs(2 * f - 1) * (lettreVisible === undefined ? 1 : borne(lettreVisible, 0, 1, "Repère de main : lettre visible"));
  const masque = lettreVisible === undefined ? {} : { display: opaciteLettre > 0 ? "inline" : "none" };
  return n("g", { "data-r": `main-${cote}`, "data-x": x, "data-y": y, ...attributs },
    n("circle", { cx: x, cy: y, r: rayon + CHARTE.liseres, fill: CHARTE.carte, "data-r": `liseret-${cote}` }),
    n("circle", { cx: x, cy: y, r: rayon, fill: teinteEntre(CHARTE.carte, CHARTE.peauOmbre, f), "data-r": `disque-${cote}` }),
    n("circle", { cx: x, cy: y, r: rayon - anneau / 2, fill: "none", stroke: CHARTE.peauOmbre, "stroke-width": anneau,
      "data-r": `anneau-${cote}` }),
    n("g", { opacity: opaciteLettre, ...masque, "data-r": `lettre-fondu-${cote}` },
      texte(x, y + MILIEU_CAPITALES * lettre, LETTRES_MAINS[cote], { taille: lettre, ancrage: "middle", graisse: GRAISSE_REPERE,
        couleur: f >= 1 / 2 ? CHARTE.carte : CHARTE.peauOmbre, role: `lettre-${cote}` })));
}
