/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Description pure d'un dessin SVG : un nœud est { balise, attributs, enfants }, un texte est une chaîne. Les dessins
 * du catalogue (js/dessins-*.js) et chaque image d'un geste animé se décrivent ainsi : les tests les lisent sous Node,
 * le navigateur les convertit en DOM (versDom), et une animation met à jour le même DOM d'une image à l'autre
 * (mettreAJour) sans recréer ses nœuds. Aucun texte de cours ne devient du balisage : tout passe par l'API du DOM.
 */
const NS = "http://www.w3.org/2000/svg";

/** Un nœud ; les enfants null, false ou undefined sont ignorés, les tableaux aplatis. */
export function n(balise, attributs = {}, ...enfants) {
  return { balise, attributs, enfants: enfants.flat(Infinity).filter((e) => e !== null && e !== false && e !== undefined) };
}

/** Valeur d'attribut écrite : nombres à trois décimales au plus (« 12 », « 3.142 ») ; un nombre non fini est une erreur. */
export function ecrireValeur(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`Valeur d'attribut non finie : ${v}`);
    return String(Number(v.toFixed(3)));
  }
  return String(v);
}

export function versDom(noeud, doc = document) {
  if (typeof noeud === "string") return doc.createTextNode(noeud);
  const e = doc.createElementNS(NS, noeud.balise);
  for (const [k, v] of Object.entries(noeud.attributs)) e.setAttribute(k, ecrireValeur(v));
  for (const enfant of noeud.enfants) e.appendChild(versDom(enfant, doc));
  return e;
}

/** Met à jour `dom` (rendu de `ancien`) pour qu'il représente `nouveau`. Mêmes balises et mêmes nombres d'enfants,
 *  sinon erreur : une animation garde ses nœuds, ce qui apparaît ou disparaît passe par l'attribut display. */
export function mettreAJour(dom, ancien, nouveau) {
  if (typeof nouveau === "string" || typeof ancien === "string") {
    if (typeof nouveau !== typeof ancien) throw new Error("Structure du dessin changée : texte et nœud échangés");
    if (ancien !== nouveau) dom.nodeValue = nouveau;
    return;
  }
  if (ancien.balise !== nouveau.balise || ancien.enfants.length !== nouveau.enfants.length) {
    throw new Error(`Structure du dessin changée à la balise ${nouveau.balise}`);
  }
  for (const [k, v] of Object.entries(nouveau.attributs)) {
    const ecrit = ecrireValeur(v);
    if (!(k in ancien.attributs) || ecrireValeur(ancien.attributs[k]) !== ecrit) dom.setAttribute(k, ecrit);
  }
  for (const k of Object.keys(ancien.attributs)) if (!(k in nouveau.attributs)) dom.removeAttribute(k);
  nouveau.enfants.forEach((enfant, i) => mettreAJour(dom.childNodes[i], ancien.enfants[i], enfant));
}

const ECHAPPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ECHAPPE[c]);

/** Texte SVG du dessin (tests, planche) ; la racine svg reçoit l'espace de noms. */
export function versChaine(noeud, racine = true) {
  if (typeof noeud === "string") return echapper(noeud);
  const attributs = racine && noeud.balise === "svg" ? { xmlns: NS, ...noeud.attributs } : noeud.attributs;
  const a = Object.entries(attributs).map(([k, v]) => ` ${k}="${echapper(ecrireValeur(v))}"`).join("");
  if (!noeud.enfants.length) return `<${noeud.balise}${a}/>`;
  return `<${noeud.balise}${a}>${noeud.enfants.map((e) => versChaine(e, false)).join("")}</${noeud.balise}>`;
}

/** Parcours en profondeur des nœuds (pas des textes), dans l'ordre du document. */
export function parcourir(noeud, visite) {
  if (typeof noeud === "string") return;
  visite(noeud);
  for (const e of noeud.enfants) parcourir(e, visite);
}
export function trouverTous(noeud, predicat) {
  const r = [];
  parcourir(noeud, (x) => { if (predicat(x)) r.push(x); });
  return r;
}
export function trouverRole(noeud, role) {
  return trouverTous(noeud, (x) => x.attributs["data-r"] === role)[0] || null;
}
/** Texte d'un nœud : ses chaînes, dans l'ordre, sous-éléments compris. */
export function texteDe(noeud) {
  return typeof noeud === "string" ? noeud : noeud.enfants.map(texteDe).join("");
}
