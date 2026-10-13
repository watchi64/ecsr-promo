// Contrôles communs à tous les dessins du catalogue (tests/dessins-*.test.mjs) et à chaque image d'un geste.
import { parcourir, texteDe } from "../js/dessin-svg.js";
import { LARGEUR_TELEPHONE, TAILLE_TEXTE_MIN_PX, TRAIT_MIN_PX } from "../js/dessins-kit.js";

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

/** Boîtes estimées des textes : { texte, x1, y1, x2, y2 }, translations des groupes parents comprises ; un texte sous
 *  une rotation n'a pas de boîte (il est signalé à part s'il en a besoin). */
export function boitesTextes(racine) {
  const boites = [];
  (function visiter(noeud, dx, dy, tourne) {
    if (typeof noeud === "string") return;
    const [tx, ty] = translation(noeud.attributs.transform);
    const rot = tourne || /rotate|matrix|skew/.test(String(noeud.attributs.transform || ""));
    if (noeud.balise === "text" && !rot) {
      const t = Number(noeud.attributs["font-size"]);
      const contenu = texteDe(noeud);
      const largeur = largeurTexte(contenu, t);
      const x = Number(noeud.attributs.x) + dx + tx, y = Number(noeud.attributs.y) + dy + ty;
      const ancrage = noeud.attributs["text-anchor"] || "start";
      const x1 = ancrage === "middle" ? x - largeur / 2 : ancrage === "end" ? x - largeur : x;
      const haut = CAPITALE_ACCENTUEE.test(contenu) ? HAUT_CAPITALE_ACCENTUEE : HAUT;
      boites.push({ texte: contenu, x1, x2: x1 + largeur, y1: y - haut * t, y2: y + BAS * t });
      return;
    }
    for (const e of noeud.enfants) visiter(e, dx + tx, dy + ty, rot);
  })(racine, 0, 0, false);
  return boites;
}

/** Problèmes d'un dessin (tableau vide si tout va) : racine, cadre, accessibilité, tailles sur téléphone, valeurs,
 *  tiret cadratin, échelle sur du texte, boîtes de texte hors du cadre ou qui se chevauchent. Un trait se mesure tel
 *  qu'il est rendu : couleur et épaisseur héritées du groupe parent, épaisseur multipliée par les échelles. */
export function verifierDessin(racine, [largeur, hauteur]) {
  const pb = [];
  if (racine.balise !== "svg") pb.push("racine autre que svg");
  if (racine.attributs.viewBox !== `0 0 ${largeur} ${hauteur}`) pb.push(`viewBox « ${racine.attributs.viewBox} » au lieu de « 0 0 ${largeur} ${hauteur} »`);
  if (racine.attributs.role !== "img" || !String(racine.attributs["aria-label"] || "").trim()) pb.push("role img et aria-label requis");
  const pxParUnite = LARGEUR_TELEPHONE / largeur;
  (function visiter(noeud, herite) {
    if (typeof noeud === "string") return;
    const a = noeud.attributs;
    const echelle = herite.echelle || /scale/.test(String(a.transform || ""));
    const facteur = herite.facteur * facteurEchelle(a.transform);
    const stroke = a.stroke ?? herite.stroke, epaisseur = a["stroke-width"] ?? herite.epaisseur;
    for (const [k, v] of Object.entries(a)) {
      if (/NaN|undefined|Infinity/.test(String(v))) pb.push(`${noeud.balise} ${k}="${v}"`);
    }
    if (noeud.balise === "text") {
      const t = Number(a["font-size"]);
      const contenu = texteDe(noeud);
      if (!(t * pxParUnite >= TAILLE_TEXTE_MIN_PX - 1e-9)) pb.push(`texte « ${contenu} » : ${(t * pxParUnite).toFixed(1)} px sur téléphone`);
      if (contenu.includes(TIRET_CADRATIN)) pb.push(`tiret cadratin dans « ${contenu} »`);
      if (echelle) pb.push(`texte « ${contenu} » sous un transform qui change l'échelle`);
    }
    const trait = noeud.balise !== "g" && noeud.balise !== "svg" && stroke && stroke !== "none" ? Number(epaisseur ?? 1) * facteur : null;
    if (trait !== null && !(trait * pxParUnite >= TRAIT_MIN_PX - 1e-9)) pb.push(`${noeud.balise} : trait de ${Number(trait.toFixed(3))} unité, ${(trait * pxParUnite).toFixed(2)} px`);
    for (const e of noeud.enfants) visiter(e, { echelle, facteur, stroke, epaisseur });
  })(racine, { echelle: false, facteur: 1, stroke: undefined, epaisseur: undefined });
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
  return pb;
}

/** Forme d'un arbre (balises et nombres d'enfants), pour vérifier qu'une animation garde ses nœuds. */
export function formeArbre(noeud) {
  return typeof noeud === "string" ? "#" : `${noeud.balise}(${noeud.enfants.map(formeArbre).join(",")})`;
}
