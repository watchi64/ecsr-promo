// Contrôles communs à tous les dessins du catalogue (tests/dessins-*.test.mjs) et à chaque image d'un geste.
import { parcourir, texteDe } from "../js/dessin-svg.js";
import { CHARTE, LARGEUR_TELEPHONE, TAILLE_TEXTE_MIN_PX, TRAIT_MIN_PX } from "../js/dessins-kit.js";

const TIRET_CADRATIN = String.fromCharCode(0x2014);
const ESPACE_INSECABLE = String.fromCharCode(0xa0), ESPACE_FINE = String.fromCharCode(0x202f);
const MOINS = String.fromCharCode(0x2212), TIRET_DEMI = String.fromCharCode(0x2013);

// Chasse d'Outfit, la police des dessins : largeur d'avance de chaque caractère en fraction de la taille du texte,
// mesurée dans Chrome avec la police de l'app (css/fonts.css), graisses 400 à 700, le 14/10/2026, puis rangée par
// paliers. Chaque caractère compte pour le haut de son palier, un caractère absent pour CHASSE_INCONNUE (Œ, symboles).
// Le crénage ne fait que resserrer ; mais sur un écran de densité 1, à la largeur d'un téléphone, Chrome arrondit les
// avances des glyphes, et le texte rendu dépasse alors la somme des paliers de 2,7 % au plus (mesures du même jour,
// getBBox ; aucun dépassement en densité 2 ou 3) : MARGE_RENDU le couvre. L'estimation majore donc la largeur rendue et
// ne laisse passer aucun chevauchement réel. Une chasse moyenne unique ne le peut pas : de 0,43 par caractère pour un
// texte courant à 0,68 pour « Commodo » et 0,75 pour « MAX ».
const PALIERS = [
  [0.21, " ·" + ESPACE_INSECABLE + ESPACE_FINE],
  [0.31, "'’.,;:!()iljîïIÎÏ"],
  [0.41, "[]1/°t"],
  [0.47, 'frs"-'],
  [0.55, "cçeéèêëkuùûüvxyÿzJ7?_«»*"],
  [0.6, "aàâäbdghnoôöpq235689FLS+=×<>" + MOINS + TIRET_DEMI],
  [0.74, "AÀÂÄBCÇEÉÈÊËHKNPRTUÙÛÜVXYŸZ04%&"],
  [0.88, "DGOÔÖQMmw…"],
  [1.01, "WæœÆ"],
];
export const CHASSE_INCONNUE = 1.2;
const MARGE_RENDU = 1.03;
const CHASSE = new Map(PALIERS.flatMap(([chasse, caracteres]) => [...caracteres].map((c) => [c, chasse])));
// Hauteur au-dessus de la ligne de base, en fraction de la taille : 0,77 au plus pour les minuscules, accents et
// hampes compris, 0,98 pour une capitale accentuée (mesures du même jour) ; jambages : 0,22.
const HAUT = 0.8, HAUT_CAPITALE_ACCENTUEE = 1.0, BAS = 0.25;
const CAPITALE_ACCENTUEE = /[ÀÂÄÉÈÊËÎÏÔÖÙÛÜŸ]/;

/** Largeur majorée d'un texte d'une ligne, en unités du dessin. */
export function largeurTexte(contenu, taille) {
  let somme = 0;
  for (const c of contenu) somme += CHASSE.get(c) ?? CHASSE_INCONNUE;
  return somme * taille * MARGE_RENDU;
}

// translate(x y), translate(x, y) ou translate(x) ; un nombre peut s'écrire avec un exposant (1e-7).
function translation(transform) {
  let dx = 0, dy = 0;
  for (const m of String(transform || "").matchAll(/translate\(\s*([-+\d.eE]+)(?:[ ,]+([-+\d.eE]+))?\s*\)/g)) {
    dx += Number(m[1]); dy += Number(m[2] ?? 0);
  }
  return [dx, dy];
}

// Facteur d'échelle d'un transform (le plus petit des deux axes, signe ignoré : un miroir ne change pas l'épaisseur).
function facteurEchelle(transform) {
  let f = 1;
  for (const m of String(transform || "").matchAll(/scale\(\s*([-+\d.eE]+)(?:[ ,]+([-+\d.eE]+))?\s*\)/g)) {
    const sx = Math.abs(Number(m[1])), sy = m[2] === undefined ? sx : Math.abs(Number(m[2]));
    f *= Math.min(sx, sy);
  }
  return f;
}

// Conteneurs dont le contenu ne se rend pas là où il est écrit (seulement par un use) : un texte n'y a pas de place.
const DEFINITIONS = new Set(["defs", "symbol", "clipPath", "mask", "pattern", "marker"]);
// Attributs qu'un texte peut porter : ceux que les boîtes savent lire, ceux qui ne déplacent pas le texte (couleur,
// opacité, affichage, liseré, translation) et les rôles data-*. Tout autre attribut (dx, dy, dominant-baseline,
// letter-spacing, style, textLength...) le déplacerait hors de sa boîte estimée : il est signalé.
const ATTRIBUTS_TEXTE = new Set(["x", "y", "font-size", "font-family", "font-weight", "text-anchor", "fill", "fill-opacity",
  "opacity", "display", "transform", "stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "paint-order"]);
// Propriétés de texte qu'un groupe transmet à ses textes sans qu'ils les surchargent : signalées sur leurs ancêtres.
// (x, y, taille, police, graisse et ancrage, eux, sont exigés sur le texte même : ceux d'un groupe ne comptent pas.)
const TEXTE_HERITE = ["dominant-baseline", "letter-spacing", "word-spacing", "writing-mode", "direction", "font-style",
  "font-stretch", "font-variant", "style"];
const ANCRAGES = ["start", "middle", "end"];
const GRAISSE_MAX = 700; // graisse la plus forte d'Outfit dans l'app (css/fonts.css) et des mesures de chasse

const nombre = (v) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v));

// Parcours en profondeur, chaque nœud avec ce qu'il hérite de ses ancêtres (et de lui-même pour les quatre premiers) :
// translation cumulée ; rotate, matrix ou skew (un texte n'y a plus de boîte) ; scale et son facteur (pour les traits) ;
// masquage par display none ; conteneur de définitions ; couleur et épaisseur de trait ; propriétés de texte posées
// par un ancêtre.
function parcourirHerite(racine, visite) {
  (function visiter(noeud, h) {
    if (typeof noeud === "string") return;
    const a = noeud.attributs, transform = String(a.transform ?? "");
    const [tx, ty] = translation(transform);
    const ici = {
      dx: h.dx + tx, dy: h.dy + ty,
      tourne: h.tourne || /rotate|matrix|skew/.test(transform),
      echelle: h.echelle || /scale/.test(transform),
      facteur: h.facteur * facteurEchelle(transform),
      cache: h.cache || a.display === "none",
      definition: h.definition ?? (DEFINITIONS.has(noeud.balise) ? noeud.balise : null),
      stroke: a.stroke ?? h.stroke, epaisseur: a["stroke-width"] ?? h.epaisseur,
      texteHerite: h.texteHerite,
    };
    visite(noeud, ici);
    const pourEnfants = { ...ici, texteHerite: [...h.texteHerite, ...TEXTE_HERITE.filter((p) => p in a)] };
    for (const e of noeud.enfants) visiter(e, pourEnfants);
  })(racine, { dx: 0, dy: 0, tourne: false, echelle: false, facteur: 1, cache: false, definition: null,
    stroke: undefined, epaisseur: undefined, texteHerite: [] });
}

/** Boîtes estimées des textes affichés : { texte, x1, y1, x2, y2 }, translations des groupes parents comprises. Un texte
 *  masqué (display none, sur lui ou un ancêtre) n'a pas de boîte, pas plus qu'un texte que les boîtes ne savent pas
 *  placer (rotation, coordonnées ou taille non numériques, définition) : verifierDessin signale ces derniers. */
export function boitesTextes(racine) {
  const boites = [];
  parcourirHerite(racine, (noeud, h) => {
    if (noeud.balise !== "text" || h.cache || h.tourne || h.definition) return;
    const a = noeud.attributs;
    if (![a.x, a.y, a["font-size"]].every(nombre)) return;
    const t = Number(a["font-size"]), contenu = texteDe(noeud);
    const largeur = largeurTexte(contenu, t);
    const x = Number(a.x) + h.dx, y = Number(a.y) + h.dy;
    const ancrage = a["text-anchor"] || "start";
    const x1 = ancrage === "middle" ? x - largeur / 2 : ancrage === "end" ? x - largeur : x;
    const haut = CAPITALE_ACCENTUEE.test(contenu) ? HAUT_CAPITALE_ACCENTUEE : HAUT;
    boites.push({ texte: contenu, x1, x2: x1 + largeur, y1: y - haut * t, y2: y + BAS * t });
  });
  return boites;
}

// Tout ce qui empêcherait d'estimer la place d'un texte est signalé : les contrôles échouent fermés.
function verifierTexte(noeud, h, pxParUnite, pb) {
  const a = noeud.attributs, contenu = texteDe(noeud), nom = `texte « ${contenu} »`;
  const t = Number(a["font-size"]);
  if (!(t * pxParUnite >= TAILLE_TEXTE_MIN_PX - 1e-9)) pb.push(`${nom} : ${(t * pxParUnite).toFixed(1)} px sur téléphone`);
  if (contenu.includes(TIRET_CADRATIN)) pb.push(`tiret cadratin dans « ${contenu} »`);
  if (h.echelle) pb.push(`${nom} sous un transform qui change l'échelle`);
  if (h.tourne) pb.push(`${nom} sous rotate, matrix ou skew : sa place et sa taille ne se vérifient pas`);
  for (const k of ["x", "y", "font-size"]) if (!nombre(a[k])) pb.push(`${nom} : ${k} non numérique`);
  if (!("text-anchor" in a)) pb.push(`${nom} sans text-anchor à lui (start, middle ou end)`);
  else if (!ANCRAGES.includes(a["text-anchor"])) pb.push(`${nom} : text-anchor « ${a["text-anchor"]} » inconnu`);
  if (a["font-family"] !== CHARTE.police) pb.push(`${nom} : police « ${a["font-family"]} » au lieu de celle de la charte`);
  if (!nombre(a["font-weight"])) pb.push(`${nom} : graisse « ${a["font-weight"]} » non numérique`);
  else if (Number(a["font-weight"]) > GRAISSE_MAX) pb.push(`${nom} : graisse « ${a["font-weight"]} » au-delà de ${GRAISSE_MAX}`);
  for (const k of Object.keys(a)) {
    if (!ATTRIBUTS_TEXTE.has(k) && !k.startsWith("data-")) pb.push(`${nom} : attribut « ${k} » que les contrôles ne savent pas lire`);
  }
  for (const p of h.texteHerite) pb.push(`${nom} sous un groupe qui porte « ${p} »`);
  for (const e of noeud.enfants) {
    if (typeof e !== "string") pb.push(`${nom} : élément « ${e.balise} » à l'intérieur, que les contrôles ne savent pas lire`);
  }
  if (h.definition) pb.push(`${nom} dans un élément « ${h.definition} » : il ne se vérifie pas là où il est rendu`);
}

// Le segment [p, q] passe-t-il dans la boîte (réduite de `marge` de chaque côté) ? Découpage de Liang et Barsky.
function segmentDansBoite([px, py], [qx, qy], b, marge = 0.5) {
  const [xmin, xmax, ymin, ymax] = [b.x1 + marge, b.x2 - marge, b.y1 + marge, b.y2 - marge];
  if (xmin >= xmax || ymin >= ymax) return false;
  const [dx, dy] = [qx - px, qy - py];
  let [t0, t1] = [0, 1];
  for (const [p, q] of [[-dx, px - xmin], [dx, xmax - px], [-dy, py - ymin], [dy, ymax - py]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}

/** Problèmes d'un dessin (tableau vide si tout va) : racine, cadre, accessibilité, tailles sur téléphone, valeurs,
 *  tiret cadratin, texte qu'on ne sait pas placer, boîtes de texte hors du cadre ou qui se chevauchent, filet
 *  d'étiquette qui passe sur un texte. Un trait se mesure tel qu'il est rendu : couleur et épaisseur héritées du
 *  groupe parent, épaisseur multipliée par les échelles. Ce qui est masqué (display none) garde ses contrôles de
 *  taille, de trait et de valeur (il s'affiche dans une autre image), mais n'a pas de boîte. */
export function verifierDessin(racine, [largeur, hauteur]) {
  const pb = [];
  if (racine.balise !== "svg") pb.push("racine autre que svg");
  if (racine.attributs.viewBox !== `0 0 ${largeur} ${hauteur}`) pb.push(`viewBox « ${racine.attributs.viewBox} » au lieu de « 0 0 ${largeur} ${hauteur} »`);
  if (racine.attributs.role !== "img" || !String(racine.attributs["aria-label"] || "").trim()) pb.push("role img et aria-label requis");
  const pxParUnite = LARGEUR_TELEPHONE / largeur;
  const filets = [];
  parcourirHerite(racine, (noeud, h) => {
    const a = noeud.attributs;
    for (const [k, v] of Object.entries(a)) {
      if (v === null || v === undefined || /NaN|undefined|Infinity|\bnull\b/.test(String(v))) pb.push(`${noeud.balise} ${k}="${v}"`);
    }
    if (noeud.balise === "foreignObject") pb.push("foreignObject : contenu que les contrôles ne savent pas lire");
    if (noeud.balise === "text") verifierTexte(noeud, h, pxParUnite, pb);
    const trait = noeud.balise !== "g" && noeud.balise !== "svg" && h.stroke && h.stroke !== "none" ? Number(h.epaisseur ?? 1) * h.facteur : null;
    if (trait !== null && !(trait * pxParUnite >= TRAIT_MIN_PX - 1e-9)) pb.push(`${noeud.balise} : trait de ${Number(trait.toFixed(3))} unité, ${(trait * pxParUnite).toFixed(2)} px`);
    if (noeud.balise === "line" && a["data-r"] === "filet" && !h.cache) {
      if (h.tourne || h.echelle) pb.push("filet d'étiquette sous rotate, matrix, skew ou scale : sa place ne se vérifie pas");
      else filets.push([[Number(a.x1) + h.dx, Number(a.y1) + h.dy], [Number(a.x2) + h.dx, Number(a.y2) + h.dy]]);
    }
  });
  const boites = boitesTextes(racine);
  for (const b of boites) {
    if (b.x1 < 0 || b.y1 < 0 || b.x2 > largeur || b.y2 > hauteur) pb.push(`texte « ${b.texte} » hors du cadre`);
  }
  for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
    const a = boites[i], b = boites[j];
    if (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 0.5 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 0.5) {
      pb.push(`textes « ${a.texte} » et « ${b.texte} » qui se chevauchent`);
    }
  }
  for (const [p, q] of filets) {
    for (const b of boites) if (segmentDansBoite(p, q, b)) pb.push(`filet d'étiquette qui passe sur le texte « ${b.texte} »`);
  }
  return pb;
}

/** Forme d'un arbre (balises et nombres d'enfants), pour vérifier qu'une animation garde ses nœuds. */
export function formeArbre(noeud) {
  return typeof noeud === "string" ? "#" : `${noeud.balise}(${noeud.enfants.map(formeArbre).join(",")})`;
}
