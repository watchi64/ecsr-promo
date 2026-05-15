// === Date helpers ===

export function isoDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toISOString().slice(0, 10);
}

export function parseDate(str) {
  return new Date(str + "T00:00:00");
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
    else if (k === "html") node.innerHTML = v;
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
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
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
