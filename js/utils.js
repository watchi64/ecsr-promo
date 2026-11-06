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

/** Renvoie le lundi de la semaine d'une date donnée (date locale) */
export function getMonday(d) {
  if (!(d instanceof Date)) d = new Date(d);
  const day = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
  const diff = (day === 0 ? -6 : 1 - day); // recule au lundi
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
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

export function formatLongDate(d) {
  if (!(d instanceof Date)) d = parseDate(d);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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

/** Renvoie l'affichage court : "V. Timy" (initiale du nom + prénom). */
export function displayStagiaire(s) {
  if (!s) return "";
  const initial = s.nom ? s.nom.trim().charAt(0).toUpperCase() + "." : "";
  return initial ? `${initial} ${s.prenom}` : s.prenom;
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

// === Crypto ===

export async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// === Toast ===

let toastTimer = null;
export function toast(msg, type = "info", duration = 2400) {
  const node = document.getElementById("toast");
  node.textContent = msg;
  node.className = "toast";
  if (type) node.classList.add(type);
  node.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add("hidden"), duration);
}

// === Debounce ===

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
