// DOM minimal et doublures du navigateur pour tester sous Node ce qui monte un schéma : le lecteur commun
// (js/lecteur-anime.js) et les moteurs (js/geste-moteur.js). Éléments (attributs, enfants, classes, texte, écouteurs,
// appartenance au document), document (createElement, createElementNS, createTextNode), temps (requestAnimationFrame,
// cancelAnimationFrame, performance.now) et observateur de visibilité, que chaque test pilote à la main.
import { ecrireValeur } from "../js/dessin-svg.js";

const echapper = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Ancêtre commun des nœuds factices : ce que `x instanceof Node` reconnaît (js/utils.js, el) quand le test pose Node. */
export class NoeudFactice {}

export class NoeudTexte extends NoeudFactice {
  constructor(valeur) { super(); this.nodeValue = String(valeur); this.parentNode = null; }
  get textContent() { return this.nodeValue; }
}

/** Le nœud et tous ses descendants, éléments et textes, en profondeur. */
export function descendants(noeud) {
  return [noeud, ...(noeud.childNodes || []).flatMap(descendants)];
}

export class ElementFactice extends NoeudFactice {
  constructor(nom, espace = null) {
    super();
    this.nodeName = nom;
    this.namespaceURI = espace;
    this.attributs = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this.classes = new Set();
    this.ecouteurs = new Map();
    this.dansLeDocument = false;   // vrai pour un conteneur posé dans le document ; ses descendants en héritent
    this.type = "";
    this.dataset = {};
  }
  get isConnected() { return this.dansLeDocument || (this.parentNode !== null && this.parentNode.isConnected); }
  setAttribute(k, v) { this.attributs.set(k, String(v)); }
  getAttribute(k) { return this.attributs.has(k) ? this.attributs.get(k) : null; }
  hasAttribute(k) { return this.attributs.has(k); }
  removeAttribute(k) { this.attributs.delete(k); }
  appendChild(noeud) { noeud.parentNode = this; this.childNodes.push(noeud); return noeud; }
  append(...noeuds) { for (const x of noeuds) this.appendChild(typeof x === "string" ? new NoeudTexte(x) : x); }
  replaceChildren(...noeuds) {
    for (const x of this.childNodes) x.parentNode = null;
    this.childNodes = [];
    this.append(...noeuds);
  }
  get classList() {
    const el = this;
    return {
      toggle(nom, force) {
        const present = force === undefined ? !el.classes.has(nom) : Boolean(force);
        if (present) el.classes.add(nom); else el.classes.delete(nom);
        return present;
      },
      contains: (nom) => el.classes.has(nom),
      add: (...noms) => noms.forEach((x) => el.classes.add(x)),
      remove: (...noms) => noms.forEach((x) => el.classes.delete(x)),
    };
  }
  get className() { return [...this.classes].join(" "); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.childNodes.map((x) => x.textContent).join(""); }
  set textContent(v) {
    this.childNodes = [];
    if (String(v) !== "") this.appendChild(new NoeudTexte(v));
  }
  /** Sélecteurs simples seulement : un nom de balise (« button ») ou une classe (« .on »). */
  querySelector(selecteur) {
    const convient = selecteur.startsWith(".")
      ? (x) => x.classes.has(selecteur.slice(1))
      : (x) => x.nodeName.toLowerCase() === selecteur.toLowerCase();
    return descendants(this).find((x) => x !== this && x instanceof ElementFactice && convient(x)) || null;
  }
  addEventListener(type, rappel) {
    if (!this.ecouteurs.has(type)) this.ecouteurs.set(type, []);
    this.ecouteurs.get(type).push(rappel);
  }
  declencher(type) {
    for (const rappel of this.ecouteurs.get(type) || []) rappel({ type, target: this });
  }
  click() { this.declencher("click"); }
}

function definir(nom, valeur) {
  Object.defineProperty(globalThis, nom, { value: valeur, configurable: true, writable: true });
}
function sauvegarder(noms) {
  const avant = noms.map((nom) => [nom, Object.getOwnPropertyDescriptor(globalThis, nom)]);
  return () => { for (const [nom, d] of avant) { if (d) Object.defineProperty(globalThis, nom, d); else delete globalThis[nom]; } };
}

/** Installe un `document` factice. `compte` compte les éléments et les textes créés ; `conteneur()` rend un élément posé
 *  dans le document. `restaurer()` remet l'état d'avant. */
export function installerDocument() {
  const restaurer = sauvegarder(["document"]);
  const compte = { elements: 0, textes: 0 };
  const doc = {
    createElement: (nom) => { compte.elements++; return new ElementFactice(nom); },
    createElementNS: (espace, nom) => { compte.elements++; return new ElementFactice(nom, espace); },
    createTextNode: (texte) => { compte.textes++; return new NoeudTexte(texte); },
  };
  definir("document", doc);
  const conteneur = () => { const c = doc.createElement("div"); c.dansLeDocument = true; return c; };
  return { doc, compte, conteneur, restaurer };
}

/** Installe le temps du navigateur sous la main du test : une file d'images d'animation (requestAnimationFrame), les
 *  annulations (cancelAnimationFrame), l'horloge (performance.now) et un IntersectionObserver dont le test déclenche le
 *  rappel. `avancer(ms)` fait avancer l'horloge et exécute la prochaine image demandée (faux s'il n'y en a pas). */
export function installerTemps() {
  const restaurer = sauvegarder(["requestAnimationFrame", "cancelAnimationFrame", "performance", "IntersectionObserver"]);
  const temps = { maintenant: 1000, file: new Map(), prochain: 1, demandes: 0, annules: [], observateurs: [] };
  definir("requestAnimationFrame", (rappel) => { const id = temps.prochain++; temps.demandes++; temps.file.set(id, rappel); return id; });
  definir("cancelAnimationFrame", (id) => { temps.annules.push(id); temps.file.delete(id); });
  definir("performance", { now: () => temps.maintenant });
  definir("IntersectionObserver", class {
    constructor(rappel, options) { this.rappel = rappel; this.options = options; this.observes = []; this.deconnecte = false; temps.observateurs.push(this); }
    observe(element) { this.observes.push(element); }
    disconnect() { this.deconnecte = true; }
    /** Le navigateur signale que `rapport` (de 0 à 1) du schéma est visible. */
    declencher(rapport) { this.rappel([{ intersectionRatio: rapport }]); }
  });
  temps.avancer = (ms) => {
    temps.maintenant += ms;
    const premiere = temps.file.entries().next().value;
    if (!premiere) return false;
    temps.file.delete(premiere[0]);
    premiere[1](temps.maintenant);
    return true;
  };
  temps.enAttente = () => temps.file.size;
  temps.restaurer = restaurer;
  return temps;
}

/** Exécute `corps(dom, temps)` avec le document et le temps factices installés, puis les retire, que le corps réussisse
 *  ou qu'il échoue : un test ne laisse rien derrière lui. */
export function avecBanc(corps) {
  const dom = installerDocument(), temps = installerTemps();
  try { return corps(dom, temps); } finally { temps.restaurer(); dom.restaurer(); }
}

/** Texte d'un dessin décrit (js/dessin-svg.js), attributs rangés par nom : comparable à serialiserDom. */
export function serialiserDescription(noeud) {
  if (typeof noeud === "string") return echapper(noeud);
  const attributs = Object.entries(noeud.attributs).map(([k, v]) => [k, ecrireValeur(v)]).sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => ` ${k}="${echapper(v)}"`).join("");
  return `<${noeud.balise}${attributs}>${noeud.enfants.map(serialiserDescription).join("")}</${noeud.balise}>`;
}

/** Texte du DOM factice, attributs rangés par nom : un DOM mis à jour doit égaler le rendu neuf de la même image. */
export function serialiserDom(noeud) {
  if (noeud instanceof NoeudTexte) return echapper(noeud.nodeValue);
  const attributs = [...noeud.attributs.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => ` ${k}="${echapper(v)}"`).join("");
  return `<${noeud.nodeName}${attributs}>${noeud.childNodes.map(serialiserDom).join("")}</${noeud.nodeName}>`;
}
