// Noyau commun aux documents officiels de l'app (livret EPCF TP-01303, Dossier
// Professionnel). Principe WYSIWYG : le document affiché à l'écran EST le
// document imprimé. Ce module ne connaît aucun document en particulier, il
// porte la mécanique : sérialisation des champs, édition, clone d'impression.
//
// Les classes techniques .lv-f (champ) et .lv-cb (case à cocher) sont communes
// à tous les documents : le préfixe est celui du livret, premier document
// implémenté, et n'a pas été renommé pour ne pas toucher un gabarit validé.

import { el, clear } from "./utils.js?v=20260809f";

// ---------------------------------------------------------------------------
// Sérialisation <-> DOM
// ---------------------------------------------------------------------------

export function collectData(doc) {
  const out = {};
  doc.querySelectorAll(".lv-f[data-k]").forEach((n) => {
    // Le motif est U+00A0 (espace insecable), que contenteditable insere volontiers.
    const v = n.innerText.replace(/ /g, " ").trim();
    if (v) out[n.dataset.k] = v;
  });
  doc.querySelectorAll(".lv-cb[data-k].on").forEach((n) => { out[n.dataset.k] = true; });
  return out;
}

export function fillData(doc, data) {
  doc.querySelectorAll(".lv-f[data-k]").forEach((n) => {
    const v = data[n.dataset.k];
    n.textContent = typeof v === "string" ? v : "";
  });
  doc.querySelectorAll(".lv-cb[data-k]").forEach((n) => {
    n.classList.toggle("on", data[n.dataset.k] === true);
  });
}

// Rend les champs saisissables. Séparé de wireDocEditing parce que le DP
// reconstruit son document quand sa pagination change : les écouteurs posés sur
// `doc` (délégation) survivent au remplacement de innerHTML, mais l'attribut
// contentEditable des champs, lui, doit être ré-appliqué sur les nouveaux nœuds.
export function applyEditable(doc) {
  doc.querySelectorAll(".lv-f[data-k]").forEach((n) => {
    n.contentEditable = "plaintext-only";
    if (n.contentEditable !== "plaintext-only") n.contentEditable = "true";
  });
}

// Rend le document éditable : champs contenteditable en texte brut, cases à
// cocher cliquables (groupes exclusifs via data-x). onChange est appelé à
// chaque modification. Les écouteurs sont posés en DÉLÉGATION sur `doc` : ils
// survivent au remplacement de son innerHTML, donc cette fonction ne doit être
// appelée QU'UNE FOIS par document (sinon ils s'empilent).
export function wireDocEditing(doc, onChange, opts = {}) {
  const names = Array.isArray(opts.names) ? opts.names : [];
  applyEditable(doc);
  // Collage : toujours en texte brut (sinon du HTML copié casserait le gabarit).
  doc.addEventListener("paste", (e) => {
    const t = e.target.closest?.(".lv-f[data-k]");
    if (!t) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });
  const toggleCb = (n) => {
    const on = !n.classList.contains("on");
    if (on && n.dataset.x) {
      doc.querySelectorAll(`.lv-cb[data-x="${n.dataset.x}"]`).forEach((o) => o.classList.remove("on"));
    }
    n.classList.toggle("on", on);
    onChange();
  };
  doc.addEventListener("click", (e) => {
    const n = e.target.closest?.(".lv-cb[data-k]");
    if (n) toggleCb(n);
  });
  doc.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && e.target.classList?.contains("lv-cb")) {
      e.preventDefault();
      toggleCb(e.target);
    }
  });
  doc.addEventListener("input", () => onChange());

  // Mini-sélecteur sur les champs date : « Aujourd'hui » en un clic, ou une
  // date au choix (input natif). On peut toujours taper au clavier à la place.
  const closePicker = () => doc.querySelectorAll(".lv-datepick").forEach((n) => n.remove());
  // short : année sur 2 chiffres (colonne « Dates » étroite du tableau officiel).
  const frDate = (iso, short) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${short ? y.slice(2) : y}`;
  };
  doc.addEventListener("click", (e) => {
    const field = e.target.closest?.(".lv-f.lv-date[data-k]");
    if (!field) { if (!e.target.closest?.(".lv-datepick")) closePicker(); return; }
    if (field.parentElement.querySelector(".lv-datepick")) return;   // déjà ouvert
    closePicker();
    const today = new Date();
    const todayIso = [today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")].join("-");
    const short = field.classList.contains("lv-date-short");
    const apply = (iso) => {
      field.textContent = frDate(iso, short);
      closePicker();
      field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    };
    const inp = el("input", { type: "date", value: todayIso });
    inp.addEventListener("change", () => { if (inp.value) apply(inp.value); });
    const pick = el("div", { class: "lv-datepick" },
      el("button", { type: "button", class: "lv-dp-today", onClick: () => apply(todayIso) },
        "Aujourd'hui (" + frDate(todayIso, short) + ")"),
      inp,
      el("button", { type: "button", onClick: () => { field.textContent = ""; closePicker(); field.dispatchEvent(new InputEvent("input", { bubbles: true })); } }, "Effacer"),
    );
    const cell = field.parentElement;
    if (getComputedStyle(cell).position === "static") cell.style.position = "relative";
    cell.appendChild(pick);
  });

  // Auto-complétion des noms de formateurs / évaluateurs : au clic sur un champ
  // « Nom » de visa, liste des formateurs (filtrée par ce qui est déjà tapé) ;
  // clic = remplit. La saisie libre reste possible (évaluateur externe).
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const closeNamePick = () => doc.querySelectorAll(".lv-namepick").forEach((n) => n.remove());
  function openNamePick(field) {
    closeNamePick();
    if (!names.length) return;
    const q = norm(field.textContent);
    const matches = names.filter((n) => norm(n).includes(q));
    // Rien à proposer, ou le champ contient déjà exactement un nom de la liste.
    if (!matches.length || (matches.length === 1 && norm(matches[0]) === q)) return;
    const pick = el("div", { class: "lv-namepick" });
    matches.forEach((name) => {
      // mousedown (pas click) : sélectionne avant que le blur du champ ne ferme la liste.
      pick.appendChild(el("button", { type: "button", class: "lv-namepick-item",
        onMousedown: (e) => {
          e.preventDefault();
          field.textContent = name;
          closeNamePick();
          onChange();
        } }, name));
    });
    const cell = field.parentElement;
    if (getComputedStyle(cell).position === "static") cell.style.position = "relative";
    cell.appendChild(pick);
  }
  doc.addEventListener("click", (e) => {
    const field = e.target.closest?.(".lv-f.lv-name[data-k]");
    if (field) { closePicker(); openNamePick(field); }
    else if (!e.target.closest?.(".lv-namepick")) closeNamePick();
  });
  doc.addEventListener("input", (e) => {
    const field = e.target.closest?.(".lv-f.lv-name[data-k]");
    if (field) openNamePick(field);
  });
}

// ---------------------------------------------------------------------------
// Impression : clone du document dans un conteneur enfant direct de <body>,
// même architecture éprouvée que l'impression du planning (pas de setTimeout,
// rafraîchi avant chaque impression). Le clone est en lecture pure.
//
// Un seul document officiel est ouvert à la fois : le livret et le DP sont deux
// sous-onglets de Notes, jamais affichés ensemble.
// ---------------------------------------------------------------------------

let courant = null;              // { doc, printId, bodyClass }
let listenersPrets = false;

export function bindDocPrint(doc, { printId, bodyClass }) {
  courant = { doc, printId, bodyClass };
  ensurePrintListeners();
  refreshDocPrint();
}

export function refreshDocPrint() {
  if (!courant) return;
  const { doc, printId, bodyClass } = courant;
  // Format de page injecté seulement tant qu'un document est ouvert : une règle
  // @page en dur écraserait le « A4 landscape » de l'impression du planning.
  if (!document.getElementById("doc-officiel-page-style")) {
    const st = document.createElement("style");
    st.id = "doc-officiel-page-style";
    st.textContent = "@page { size: A4 portrait; margin: 0; }";
    document.head.appendChild(st);
  }
  let c = document.getElementById(printId);
  if (!c) {
    c = document.createElement("div");
    c.id = printId;
    document.body.appendChild(c);
  }
  clear(c);
  const clone = doc.cloneNode(true);
  clone.classList.remove("lv-screen", "lv-edit", "dp-screen", "dp-edit");
  clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  clone.querySelectorAll("[tabindex]").forEach((n) => n.removeAttribute("tabindex"));
  clone.querySelectorAll(".lv-datepick, .lv-namepick").forEach((n) => n.remove());
  c.appendChild(clone);
  document.body.classList.add(bodyClass);
}

export function teardownDocPrint() {
  if (courant) {
    document.getElementById(courant.printId)?.remove();
    document.body.classList.remove(courant.bodyClass);
  }
  // Ceinture et bretelles : les deux conteneurs connus, au cas où la route
  // change alors qu'un autre document était monté.
  document.getElementById("livret-print")?.remove();
  document.getElementById("dp-print")?.remove();
  document.body.classList.remove("livret-printable", "dp-printable");
  document.getElementById("doc-officiel-page-style")?.remove();
  courant = null;
}

// Si le document n'est plus à l'écran (sous-onglet changé), on ne doit surtout
// pas intercepter l'impression d'autre chose.
function ensurePrintListeners() {
  if (listenersPrets) return;
  listenersPrets = true;
  const beforePrint = () => {
    if (courant && document.contains(courant.doc)) refreshDocPrint();
    else teardownDocPrint();
  };
  window.addEventListener("beforeprint", beforePrint);
  // iOS Safari n'émet pas beforeprint : matchMedia est son seul signal.
  const mm = window.matchMedia("print");
  const onMm = (e) => { if (e.matches) beforePrint(); };
  if (mm.addEventListener) mm.addEventListener("change", onMm);
  else if (mm.addListener) mm.addListener(onMm);
}
