import { peutMontrer, aReprendre, perimee } from "./messages-rules.js?v=20261111m";
import { lundiDe } from "./dates.js?v=20261111m";

// === Date helpers ===

export function isoDate(d) {
  // Format YYYY-MM-DD en heure LOCALE (pas UTC).
  // Évite le bug timezone qui décalait d'un jour en arrière en France (UTC+1/+2).
  if (!(d instanceof Date)) d = new Date(d);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(str) {
  const s = String(str);
  // Une date seule (« 2026-07-30 ») se lit en heure LOCALE : le suffixe T00:00:00 évite
  // le décalage UTC qui la ferait reculer d'un jour. Un horodatage complet porte déjà son
  // heure et parfois son fuseau ; le concaténer donnait une date invalide, ce qui affichait
  // NaN/NaN/NaN sur chaque ligne du panneau des signalements.
  return new Date(s.includes("T") ? s : s + "T00:00:00");
}

/** Renvoie le lundi de la semaine d'une date donnée (date locale, à minuit) : le calcul est celui de lundiDe (js/dates.js). */
export function getMonday(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return new Date(NaN);
  // L'année sur quatre chiffres : une année tapée à moitié (« 0002 », dans « Aller à la semaine d'une date ») reste lisible.
  const jour = String(date.getFullYear()).padStart(4, "0") + isoDate(date).slice(-6);
  return parseDate(lundiDe(jour));
}

export function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

export function formatDayShort(d) {
  if (!(d instanceof Date)) d = parseDate(d);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
}

export function formatDate(d) {
  if (!(d instanceof Date)) d = parseDate(d);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

// « samedi 9 novembre 2026 » ; avec { sansJour: true } : « 9 novembre 2026 ».
export function formatLongDate(d, { sansJour = false } = {}) {
  if (!(d instanceof Date)) d = parseDate(d);
  return d.toLocaleDateString("fr-FR", { ...(sansJour ? {} : { weekday: "long" }), day: "numeric", month: "long", year: "numeric" });
}

// === DOM helpers ===

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dataset") {
      Object.assign(node.dataset, v);
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    // Convertit tout primitif (string, number, boolean true) en TextNode
    if (typeof c === "string" || typeof c === "number" || typeof c === "boolean") {
      node.appendChild(document.createTextNode(String(c)));
    } else if (c instanceof Node) {
      node.appendChild(c);
    } else {
      // Fallback safe : tout autre objet/array imbriqué (déjà flatté par .flat())
      node.appendChild(document.createTextNode(String(c)));
    }
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// === Rien ne défile de côté (règle de Timy du 27/10) : graphes et tableaux tiennent dans la largeur de l'écran ===

/** Largeur, en unités du viewBox, d'un graphe SVG qui se dessine à la largeur de son conteneur (width: 100 %, height: auto).
 *  Celle de la fenêtre moins les marges de la page et de la carte, bornée : le viewBox est ainsi à peu près aussi large que
 *  ce que le graphe occupe à l'écran, ses textes gardent leur taille, et width: 100 % le ramène exactement à son conteneur. */
export function largeurDeGraphe(max = 720, min = 260) {
  const fenetre = document.documentElement.clientWidth || max + 80;   // fenêtre sans largeur mesurable : le plafond
  return Math.max(min, Math.min(max, fenetre - 80));
}

/** Tableau qui devient une liste hors ordinateur (spec § 4.1, sous 1 080 px) : la feuille de style empile les cellules
 *  d'une ligne en une carte et écrit devant chaque valeur le titre de sa colonne (data-label, lu ici dans l'en-tête).
 *  La cellule qui porte la classe liste-titre est le titre de la carte : elle n'a pas de libellé devant elle.
 *  Les rôles ARIA gardent au tableau sa sémantique quand la feuille change l'affichage de ses éléments. */
export function tableauEnListe(table) {
  const titres = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
  table.classList.add("tableau-liste");
  table.setAttribute("role", "table");
  table.querySelectorAll("thead, tbody").forEach((groupe) => groupe.setAttribute("role", "rowgroup"));
  table.querySelectorAll("tr").forEach((ligne) => {
    ligne.setAttribute("role", "row");
    [...ligne.children].forEach((cellule, i) => {
      const entete = cellule.tagName === "TH";
      cellule.setAttribute("role", entete ? (cellule.closest("thead") ? "columnheader" : "rowheader") : "cell");
      if (!entete && titres[i] && !cellule.classList.contains("liste-titre")) cellule.setAttribute("data-label", titres[i]);
    });
  });
  return table;
}

// === Affichage stagiaire / prof ===

/** Renvoie l'affichage court : "Timy V." (prénom, espace, initiale du nom, point).
 *  Sans nom : le prénom seul. Format unique de tous les écrans (décision du 10/11) ;
 *  les documents officiels imprimés gardent le nom complet. */
export function displayStagiaire(s) {
  if (!s) return "";
  const prenom = (s.prenom || "").trim();
  const nom = (s.nom || "").trim();
  const initial = nom ? nom.charAt(0).toUpperCase() + "." : "";
  return [prenom, initial].filter(Boolean).join(" ");
}

/** Signature d'un stagiaire dans les champs « qui a modifié » de la base (created_by_who, updated_by_who…) :
 *  « M. Lucie », l'ancien format, gardé tel quel. L'effacement des données (_anonymiser_stagiaire) retrouve les
 *  traces d'un stagiaire sous cette forme : la changer laisserait son nom en base après un effacement. L'écran
 *  remet ces signatures dans l'ordre « Lucie M. » avec nomLisible. */
export function signatureStagiaire(s) {
  if (!s) return "";
  const initial = s.nom ? s.nom.trim().charAt(0).toUpperCase() + "." : "";
  return initial ? `${initial} ${s.prenom}` : s.prenom;
}

/** Un nom lu en base au format « M. Pierre » (signature, bénévole) s'affiche « Pierre M. ». Le reste passe tel quel. */
export function nomLisible(texte) {
  const t = String(texte ?? "").trim();
  const m = t.match(/^(\p{Lu})\.\s+(.+)$/u);
  return m ? `${m[2]} ${m[1]}.` : t;
}

/** Compare deux stagiaires par nom de famille (alphabétique), fallback prénom. */
export function compareByNom(a, b) {
  const na = (a.nom || "").trim();
  const nb = (b.nom || "").trim();
  if (na && nb) return na.localeCompare(nb, "fr");
  if (na && !nb) return -1;
  if (!na && nb) return 1;
  return (a.prenom || "").localeCompare(b.prenom || "", "fr");
}

// === Toast ===
// Le message du bas n'a qu'une place (règles dans js/messages-rules.js) : un message (toast : confirmation d'un geste,
// erreur) s'affiche tout de suite ; une annonce (annoncer : un mot de l'app à l'ouverture) attend que la place soit libre
// et qu'aucune fenêtre ne couvre la page, pour ne jamais effacer une confirmation (audit du 09/11, A2).

let toastTimer = null;
let relance = null;
let courant = null;            // le message affiché : { genre, texte, type, duree, depuis }, ou null
const enAttente = [];          // les annonces qui attendent : { genre: "annonce", texte, type, duree, depose }

function fenetreOuverte() {
  return [...document.querySelectorAll('[aria-modal="true"], .modal-backdrop')].some((e) => e.getClientRects().length > 0);
}

function afficherToast(m) {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = m.texte;
  node.className = "toast";
  if (m.type) node.classList.add(m.type);
  node.classList.remove("hidden");
  courant = { ...m, depuis: Date.now() };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(libererToast, m.duree);
}

function libererToast() {
  const node = document.getElementById("toast");
  if (node) node.classList.add("hidden");
  courant = null;
  servirAnnonces();
}

function servirAnnonces() {
  clearTimeout(relance);
  relance = null;
  const maintenant = Date.now();
  while (enAttente.length && perimee(enAttente[0], maintenant)) enAttente.shift();
  if (!enAttente.length) return;
  if (peutMontrer(enAttente[0], { courant, fenetreOuverte: fenetreOuverte() })) afficherToast(enAttente.shift());
  else relance = setTimeout(servirAnnonces, 1000);
}

export function toast(msg, type = "info", duration = 2400) {
  const m = { genre: "message", texte: msg, type, duree: duration };
  if (aReprendre(courant, m, Date.now())) enAttente.unshift({ ...courant, depose: Date.now() });
  afficherToast(m);
}

export function annoncer(msg, type = "info", duration = 6000) {
  enAttente.push({ genre: "annonce", texte: msg, type, duree: duration, depose: Date.now() });
  servirAnnonces();
}

// Une fenêtre vient de s'ouvrir (js/nav-fenetre.js) : l'annonce affichée se retire et attend qu'elle se ferme.
export function suspendreAnnonce() {
  if (!courant || courant.genre !== "annonce") return;
  const annonce = courant;
  clearTimeout(toastTimer);
  const node = document.getElementById("toast");
  if (node) node.classList.add("hidden");
  courant = null;
  enAttente.unshift({ ...annonce, depose: Date.now() });
  servirAnnonces();
}

// === Tirage au sort ===

// Une copie de la liste dans un ordre au hasard (mélange de Fisher-Yates) : le placement du planning et l'ordre des
// questions d'un QCM.
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// === Debounce ===

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
