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

/** Un nœud ; les enfants null, false ou undefined sont ignorés, les tableaux aplatis, un nombre fini devient son texte
 *  (un décimal affiché s'écrit plutôt en chaîne, avec la virgule : « 1,6 mm ») ; tout autre enfant est une erreur.
 *  Les attributs sont copiés : un objet réutilisé et modifié d'une image à l'autre ne change pas l'image d'avant. */
export function n(balise, attributs = {}, ...enfants) {
  const liste = [];
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === false || e === undefined) continue;
    if (typeof e === "number") {
      if (!Number.isFinite(e)) throw new Error(`Texte non fini dans le dessin (balise ${balise}) : ${e}`);
      liste.push(String(e));
    } else if (typeof e === "string" || (typeof e === "object" && typeof e.balise === "string")) liste.push(e);
    else throw new Error(`Enfant de dessin invalide dans la balise ${balise} : ${String(e)}`);
  }
  return { balise, attributs: { ...attributs }, enfants: liste };
}

/** Valeur d'attribut écrite : nombres à trois décimales au plus (« 12 », « 3.142 ») ; un nombre non fini ou une valeur
 *  absente (null, undefined) est une erreur. */
export function ecrireValeur(v) {
  if (v === null || v === undefined) throw new Error(`Valeur d'attribut absente : ${v}`);
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

// Vérification complète avant toute écriture : `nouveau` a la forme de `ancien` (balises, nombres d'enfants, textes à
// la place des textes) et chacune de ses valeurs d'attribut s'écrit. L'erreur dit où, chemin depuis la racine. Une
// image fautive ne laisse ainsi jamais un DOM à moitié mis à jour, que les images suivantes ne corrigeraient pas.
function verifierAvantEcriture(a, b, chemin) {
  if (typeof a === "string" || typeof b === "string") {
    if (typeof a !== typeof b) throw new Error(`Structure du dessin changée : texte et nœud échangés sous ${chemin || "la racine"}`);
    return;
  }
  const ici = chemin ? `${chemin} > ${a.balise}` : a.balise;
  if (a.balise !== b.balise) throw new Error(`Structure du dessin changée : ${b.balise} au lieu de ${a.balise} (${ici})`);
  if (a.enfants.length !== b.enfants.length) {
    throw new Error(`Structure du dessin changée : ${b.enfants.length} enfants au lieu de ${a.enfants.length} (${ici})`);
  }
  for (const [k, v] of Object.entries(b.attributs)) {
    try { ecrireValeur(v); } catch (e) { throw new Error(`${e.message} (${ici}, attribut ${k})`); }
  }
  a.enfants.forEach((e, i) => verifierAvantEcriture(e, b.enfants[i], `${ici}[${i}]`));
}

function ecrire(dom, ancien, nouveau) {
  if (typeof nouveau === "string") {
    if (ancien !== nouveau) dom.nodeValue = nouveau;
    return;
  }
  for (const [k, v] of Object.entries(nouveau.attributs)) {
    const ecrit = ecrireValeur(v);
    if (!(k in ancien.attributs) || ecrireValeur(ancien.attributs[k]) !== ecrit) dom.setAttribute(k, ecrit);
  }
  for (const k of Object.keys(ancien.attributs)) if (!(k in nouveau.attributs)) dom.removeAttribute(k);
  nouveau.enfants.forEach((enfant, i) => ecrire(dom.childNodes[i], ancien.enfants[i], enfant));
}

/** Met à jour `dom` (rendu de `ancien`) pour qu'il représente `nouveau`. Mêmes balises et mêmes nombres d'enfants,
 *  valeurs écrivables, sinon erreur, levée avant toute écriture : une animation garde ses nœuds, ce qui apparaît ou
 *  disparaît passe par l'attribut display. */
export function mettreAJour(dom, ancien, nouveau) {
  verifierAvantEcriture(ancien, nouveau, "");
  ecrire(dom, ancien, nouveau);
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
