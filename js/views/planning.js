import {
  listStagiaires, listProfs, listThemes, getPlanning,
  upsertPlanningEntry, deletePlanningEntryById,
  getSetting, setSetting,
} from "../db.js";
import { el, clear, isoDate, getMonday, addDays, formatDayShort, debounce, toast } from "../utils.js";
import { icon } from "../icons.js";
import { ACTIVITES, ACTIVITY_SHAPES, JOURS, HALF_DAYS } from "../config.js";

let stagiaires = [];
let profs = [];
let themes = [];
let entries = [];
let semaineLundi = null;
let currentContainer = null;

const debouncedSave = {};

function entriesFor(d, half) {
  return entries.filter((e) => e.day_index === d && e.half_day === half);
}

// On groupe par "slot" (ordre temporel). Dans chaque slot, plusieurs "lane" (parallèle).
function rowsFor(d, half) {
  const list = entriesFor(d, half);
  const slotsByNumber = new Map();
  list.forEach((e) => {
    if (!slotsByNumber.has(e.slot)) slotsByNumber.set(e.slot, []);
    slotsByNumber.get(e.slot).push(e);
  });
  return [...slotsByNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slot, items]) => ({
      slot,
      lanes: items.sort((a, b) => a.lane - b.lane),
    }));
}

async function saveEntry(localId, patch) {
  const entry = entries.find((e) => e._lid === localId);
  if (!entry) return;
  Object.assign(entry, patch);

  const payload = {
    semaine_lundi: semaineLundi,
    day_index: entry.day_index,
    half_day: entry.half_day,
    slot: entry.slot,
    lane: entry.lane ?? 0,
    activite: entry.activite ?? null,
    prof_id: entry.prof_id ?? null,
    sujet: entry.sujet ?? null,
    pedagogue_id: entry.pedagogue_id ?? null,
    eleves_ids: entry.eleves_ids ?? [],
    notes: entry.notes ?? null,
  };

  try {
    await upsertPlanningEntry(payload);
    const cellEl = document.querySelector(`[data-lid="${localId}"]`);
    if (cellEl) cellEl.dataset.activite = payload.activite || "";
    // Si on change l'activité, on re-render la cellule (shape change)
    if (patch.activite !== undefined && cellEl) {
      const newCell = renderLaneCell(entry);
      cellEl.replaceWith(newCell);
    }
  } catch (e) {
    console.error(e);
    toast("Erreur d'enregistrement", "error");
  }
}

async function addSlotAfter(d, half, afterSlot) {
  // Décale les slots suivants pour insérer juste après
  const list = entriesFor(d, half);
  const toShift = list.filter((e) => e.slot > afterSlot);
  // Pour éviter conflits unique : shift en deux temps via slot temporaire
  for (const e of toShift) {
    const payload = {
      semaine_lundi: e.semaine_lundi, day_index: e.day_index,
      half_day: e.half_day, slot: e.slot + 1000, lane: e.lane,
      activite: e.activite, prof_id: e.prof_id, sujet: e.sujet,
      pedagogue_id: e.pedagogue_id, eleves_ids: e.eleves_ids, notes: e.notes,
    };
    // Insertion à nouvelle position
    await upsertPlanningEntry(payload);
    // Delete ancien
    if (e.id) await deletePlanningEntryById(e.id);
  }
  // Renomme les slot temp
  for (const e of toShift) {
    const newSlot = e.slot + 1;  // anciennement slot+1000, on veut +1 par rapport à l'original
    // ré-upsert
    const payload = {
      semaine_lundi: e.semaine_lundi, day_index: e.day_index,
      half_day: e.half_day, slot: newSlot, lane: e.lane,
      activite: e.activite, prof_id: e.prof_id, sujet: e.sujet,
      pedagogue_id: e.pedagogue_id, eleves_ids: e.eleves_ids, notes: e.notes,
    };
    await upsertPlanningEntry(payload);
    // Supprime version temp
    await deletePlanningEntryById(undefined); // skip, géré au reload
  }
  // Nouveau slot
  await upsertPlanningEntry({
    semaine_lundi: semaineLundi, day_index: d, half_day: half,
    slot: afterSlot + 1, lane: 0,
    activite: null, prof_id: null, sujet: null,
    pedagogue_id: null, eleves_ids: [], notes: null,
  });
  await loadPlanning();
  renderInto(currentContainer);
}

// Version simplifiée : ajoute en fin de séquence (la plupart des cas)
async function addSlotEnd(d, half) {
  const list = entriesFor(d, half);
  const nextSlot = list.length === 0 ? 0 : Math.max(...list.map((e) => e.slot)) + 1;
  try {
    await upsertPlanningEntry({
      semaine_lundi: semaineLundi, day_index: d, half_day: half,
      slot: nextSlot, lane: 0,
      activite: null, prof_id: null, sujet: null,
      pedagogue_id: null, eleves_ids: [], notes: null,
    });
    await loadPlanning();
    renderInto(currentContainer);
  } catch (e) {
    console.error(e);
    toast("Erreur création créneau", "error");
  }
}

async function addLaneInSlot(d, half, slot) {
  const lanesInSlot = entries.filter((e) => e.day_index === d && e.half_day === half && e.slot === slot);
  const nextLane = lanesInSlot.length === 0 ? 0 : Math.max(...lanesInSlot.map((e) => e.lane)) + 1;
  try {
    await upsertPlanningEntry({
      semaine_lundi: semaineLundi, day_index: d, half_day: half,
      slot, lane: nextLane,
      activite: null, prof_id: null, sujet: null,
      pedagogue_id: null, eleves_ids: [], notes: null,
    });
    await loadPlanning();
    renderInto(currentContainer);
  } catch (e) {
    console.error(e);
    toast("Erreur création parallèle", "error");
  }
}

async function deleteCell(entry) {
  // Empêche de supprimer s'il ne reste qu'une cellule pour cette demi-journée
  const list = entriesFor(entry.day_index, entry.half_day);
  if (list.length <= 1) {
    toast("Au moins une activité par demi-journée", "error");
    return;
  }
  if (!confirm("Supprimer ce créneau ?")) return;
  try {
    if (entry.id) await deletePlanningEntryById(entry.id);
    entries = entries.filter((e) => e._lid !== entry._lid);
    renderInto(currentContainer);
  } catch (e) {
    console.error(e);
    toast("Erreur suppression", "error");
  }
}

// === Composants ===

function selectFromList(items, currentVal, onChange, placeholder = "—") {
  const sel = el("select");
  sel.appendChild(el("option", { value: "" }, placeholder));
  items.forEach((it) => {
    const opt = el("option", { value: String(it.value) }, it.label);
    if (String(currentVal) === String(it.value)) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => onChange(sel.value === "" ? null : sel.value));
  return sel;
}

function chipsSelect(allStagiaires, currentIds, onChange) {
  const wrap = el("div", { class: "chips-select" });
  const display = el("div", { class: "chips-display", tabindex: "0" });
  const dropdown = el("div", { class: "chips-dropdown hidden" });
  let selected = [...(currentIds || [])];

  function render() {
    clear(display);
    if (selected.length === 0) {
      display.appendChild(el("span", { class: "chips-placeholder" }, "Élèves…"));
    } else {
      selected.forEach((id) => {
        const s = allStagiaires.find((x) => x.id === id);
        if (!s) return;
        display.appendChild(el("span", { class: "chip" },
          s.prenom,
          el("span", { class: "x", onClick: (ev) => {
            ev.stopPropagation();
            selected = selected.filter((x) => x !== id);
            render();
            onChange([...selected]);
          }}, "×")
        ));
      });
    }
    clear(dropdown);
    allStagiaires.forEach((s) => {
      dropdown.appendChild(el("div", {
        class: "chips-dropdown-item" + (selected.includes(s.id) ? " selected" : ""),
        onClick: (ev) => {
          ev.stopPropagation();
          if (selected.includes(s.id)) selected = selected.filter((x) => x !== s.id);
          else selected = [...selected, s.id];
          render();
          onChange([...selected]);
        }
      }, s.prenom));
    });
  }

  display.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
    display.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) {
      dropdown.classList.add("hidden");
      display.classList.remove("open");
    }
  });

  wrap.appendChild(display);
  wrap.appendChild(dropdown);
  render();
  return wrap;
}

// Autocomplete Sujet/Thème — input texte avec suggestions issues de la table themes
function sujetAutocomplete(currentValue, onChange) {
  const wrap = el("div", { class: "sujet-ac" });
  const input = el("input", { type: "text", placeholder: "Sujet / thème…", value: currentValue || "" });
  const dropdown = el("div", { class: "sujet-ac-dropdown hidden" });

  function renderSuggestions(query) {
    clear(dropdown);
    const q = query.trim().toLowerCase();
    let matches = themes;
    if (q) {
      matches = themes.filter((t) => {
        const numStr = t.numero != null ? String(t.numero) : "";
        return t.titre.toLowerCase().includes(q)
            || numStr.includes(q)
            || (t.categorie || "").toLowerCase().includes(q);
      });
    }
    matches = matches.slice(0, 12);
    if (matches.length === 0) {
      dropdown.appendChild(el("div", { class: "sujet-ac-empty muted" }, "Aucun thème — saisis ton propre sujet"));
      return;
    }
    matches.forEach((t) => {
      const item = el("div", { class: "sujet-ac-item " + t.type });
      if (t.numero != null) {
        item.appendChild(el("span", { class: "sujet-ac-num" }, String(t.numero).padStart(2, "0")));
      } else {
        item.appendChild(el("span", { class: "sujet-ac-num notion" }, "·"));
      }
      item.appendChild(el("span", { class: "sujet-ac-titre" }, t.titre));
      item.appendChild(el("span", { class: "sujet-ac-cat muted" }, t.categorie || ""));
      item.addEventListener("mousedown", (ev) => {
        ev.preventDefault();  // évite que blur ferme avant le click
        input.value = t.titre;
        dropdown.classList.add("hidden");
        onChange(t.titre);
      });
      dropdown.appendChild(item);
    });
  }

  input.addEventListener("focus", () => {
    renderSuggestions(input.value);
    dropdown.classList.remove("hidden");
  });
  input.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.add("hidden"), 150);
  });
  input.addEventListener("input", () => {
    renderSuggestions(input.value);
    debouncedSujetSave(onChange, input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { dropdown.classList.add("hidden"); input.blur(); }
  });

  wrap.appendChild(input);
  wrap.appendChild(dropdown);
  return wrap;
}

const _sujetDebouncers = new WeakMap();
function debouncedSujetSave(onChange, val) {
  if (!_sujetDebouncers.has(onChange)) {
    _sujetDebouncers.set(onChange, debounce((v) => onChange(v), 500));
  }
  _sujetDebouncers.get(onChange)(val);
}

// === Rendu d'une cellule (un lane d'un slot) ===

function renderLaneCell(entry) {
  const lid = entry._lid;
  const cell = el("div", {
    class: "p-lane-cell",
    dataset: { lid, activite: entry.activite || "" }
  });

  const shape = ACTIVITY_SHAPES[entry.activite || ""] || ACTIVITY_SHAPES[""];

  const rows = el("div", { class: "p-lane-rows" });

  // Ligne 1 : Activité + Prof + trash
  const r1 = el("div", { class: "p-lane-row" });
  r1.appendChild(el("div", { class: "p-lane-field activite-field" },
    selectFromList(
      ACTIVITES.map((a) => ({ value: a, label: a })),
      entry.activite,
      (v) => saveEntry(lid, { activite: v }),
      "Choisir activité…"
    )
  ));
  if (shape.includes("prof")) {
    r1.appendChild(el("div", { class: "p-lane-field prof-field" },
      selectFromList(
        profs.map((p) => ({ value: p.id, label: p.nom })),
        entry.prof_id,
        (v) => saveEntry(lid, { prof_id: v ? Number(v) : null }),
        "Prof…"
      )
    ));
  }
  const trashBtn = el("button", {
    class: "p-lane-delete", "aria-label": "Supprimer",
    onClick: () => deleteCell(entry)
  });
  trashBtn.appendChild(icon.trash());
  r1.appendChild(trashBtn);
  rows.appendChild(r1);

  // Ligne 2 : Sujet (autocomplete)
  if (shape.includes("sujet")) {
    const sujetWrap = sujetAutocomplete(entry.sujet, (v) => saveEntry(lid, { sujet: v }));
    rows.appendChild(el("div", { class: "p-lane-row" },
      el("div", { class: "p-lane-field full" }, sujetWrap)
    ));
  }

  // Ligne 3 : Pédagogue (si applicable)
  if (shape.includes("pedagogue")) {
    rows.appendChild(el("div", { class: "p-lane-row" },
      el("div", { class: "p-lane-field full pedagogue-cell" },
        selectFromList(
          stagiaires.map((s) => ({ value: s.id, label: s.prenom })),
          entry.pedagogue_id,
          (v) => saveEntry(lid, { pedagogue_id: v ? Number(v) : null }),
          "Au tableau…"
        )
      )
    ));
  }

  // Ligne 4 : Élèves (si applicable)
  if (shape.includes("eleves")) {
    rows.appendChild(el("div", { class: "p-lane-row" },
      el("div", { class: "p-lane-field full" },
        chipsSelect(stagiaires, entry.eleves_ids || [], (ids) => {
          saveEntry(lid, { eleves_ids: ids });
        })
      )
    ));
  }

  // Ligne 5 : Notes
  if (shape.includes("notes")) {
    const notesInput = el("input", { type: "text", placeholder: "Notes", value: entry.notes || "" });
    const key = lid + "-notes";
    if (!debouncedSave[key]) {
      debouncedSave[key] = debounce((v) => saveEntry(lid, { notes: v }), 500);
    }
    notesInput.addEventListener("input", () => debouncedSave[key](notesInput.value));
    rows.appendChild(el("div", { class: "p-lane-row" },
      el("div", { class: "p-lane-field full" }, notesInput)
    ));
  }

  cell.appendChild(rows);
  return cell;
}

// === Rendu d'un slot (rangée = série, contient N lanes en parallèle) ===

function renderSlotRow(d, half, row) {
  const slotEl = el("div", { class: "p-slot-row" });

  // Marqueur du slot
  slotEl.appendChild(el("div", { class: "p-slot-marker" },
    el("span", { class: "p-slot-num" }, String(row.slot + 1))
  ));

  // Lanes
  const lanes = el("div", { class: "p-lanes" });
  row.lanes.forEach((entry) => {
    lanes.appendChild(renderLaneCell(entry));
  });

  // Bouton "+ Parallèle" à la fin des lanes
  const addParBtn = el("button", {
    class: "p-add-parallele",
    title: "Ajouter une activité en parallèle (même créneau horaire)",
    onClick: () => addLaneInSlot(d, half, row.slot)
  });
  addParBtn.appendChild(icon.plus());
  addParBtn.appendChild(el("span", { class: "label" }, "Parallèle"));
  lanes.appendChild(addParBtn);

  slotEl.appendChild(lanes);
  return slotEl;
}

function renderDayCard(d, monday) {
  const date = addDays(monday, d);
  const card = el("article", { class: "p-day-card" });
  card.appendChild(el("div", { class: "p-day-head" },
    el("span", { class: "p-day-name" }, JOURS[d]),
    el("span", { class: "p-day-date" }, formatDayShort(date)),
  ));

  HALF_DAYS.forEach((half) => {
    const section = el("div", { class: "p-half " + half.key });
    section.appendChild(el("div", { class: "p-half-head" },
      el("span", { class: "p-half-tag " + half.key }, half.short),
      el("span", { class: "p-half-hours" }, half.label),
    ));

    const slotsWrap = el("div", { class: "p-slots-wrap" });
    const rows = rowsFor(d, half.key);
    rows.forEach((row) => slotsWrap.appendChild(renderSlotRow(d, half.key, row)));

    // Bouton "+ À la suite" (ajoute un nouveau slot après le dernier)
    const addSuiteBtn = el("button", {
      class: "p-add-suite",
      title: "Ajouter un créneau à la suite (après dans le temps)",
      onClick: () => addSlotEnd(d, half.key),
    });
    addSuiteBtn.appendChild(icon.plus());
    addSuiteBtn.appendChild(document.createTextNode("Ajouter un créneau à la suite"));
    slotsWrap.appendChild(addSuiteBtn);

    section.appendChild(slotsWrap);
    card.appendChild(section);
  });
  return card;
}

async function ensureMinimumSlots() {
  const toCreate = [];
  for (let d = 0; d < 5; d++) {
    for (const half of HALF_DAYS) {
      if (entriesFor(d, half.key).length === 0) {
        toCreate.push({
          semaine_lundi: semaineLundi, day_index: d, half_day: half.key,
          slot: 0, lane: 0,
          activite: null, prof_id: null, sujet: null,
          pedagogue_id: null, eleves_ids: [], notes: null,
        });
      }
    }
  }
  if (toCreate.length === 0) return;
  for (const p of toCreate) {
    try { await upsertPlanningEntry(p); } catch (e) { console.error(e); }
  }
  await loadPlanning();
}

async function loadPlanning() {
  const data = await getPlanning(semaineLundi);
  let counter = 0;
  entries = data.map((row) => ({ ...row, _lid: "lid-" + (++counter) }));
}

async function changeWeek(dateStr) {
  semaineLundi = dateStr;
  await setSetting("current_week_lundi", dateStr);
  await loadPlanning();
  await ensureMinimumSlots();
  renderInto(currentContainer);
}

function renderInto(container) {
  currentContainer = container;
  clear(container);

  const monday = new Date(semaineLundi + "T00:00:00");
  const longLabel = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Édition · Semaine du " + longLabel),
      el("h2", {}, "Planning de la semaine"),
      el("p", { class: "subtitle" }, "Ajoute des créneaux à la suite (dans le temps) ou en parallèle (même horaire). Le champ Sujet propose les 57 thèmes et notions pédagogiques."),
    ),
  ));

  // Toolbar semaine
  const prevBtn = el("button", { class: "btn small icon-only", "aria-label": "Semaine précédente",
    onClick: () => changeWeek(isoDate(addDays(monday, -7))) });
  prevBtn.appendChild(icon.chevronLeft());

  const nextBtn = el("button", { class: "btn small icon-only", "aria-label": "Semaine suivante",
    onClick: () => changeWeek(isoDate(addDays(monday, 7))) });
  nextBtn.appendChild(icon.chevronRight());

  const dateInput = el("input", { type: "date", value: semaineLundi });
  dateInput.addEventListener("change", () => {
    let d = new Date(dateInput.value + "T00:00:00");
    d = getMonday(d);
    changeWeek(isoDate(d));
  });

  const todayBtn = el("button", { class: "btn small" }, "Cette semaine");
  todayBtn.addEventListener("click", () => changeWeek(isoDate(getMonday(new Date()))));

  const printBtn = el("button", { class: "btn small", onClick: () => printPlanning() });
  printBtn.appendChild(icon.list());
  printBtn.appendChild(document.createTextNode("Imprimer / PDF"));

  container.appendChild(el("div", { class: "week-bar" },
    el("span", { class: "week-bar-label" }, "Semaine du"),
    dateInput, prevBtn, nextBtn, todayBtn,
    el("span", { style: "flex:1" }),
    printBtn,
  ));

  const wrap = el("div", { class: "p-days" });
  JOURS.forEach((_, d) => wrap.appendChild(renderDayCard(d, monday)));
  container.appendChild(wrap);

  container.appendChild(el("div", { class: "planning-helper" },
    el("strong", {}, "À la suite "), "↓ = nouveau créneau dans le temps (après celui qui précède). ",
    el("strong", {}, "Parallèle "), "→ = autre activité au même horaire (ex: voiture qui tourne pendant un cours). ",
    "Au moins 1 créneau par demi-journée. Min. 1 lane (rangée) → bouton « Parallèle » l'étoffe."
  ));
}

function printPlanning() {
  document.body.classList.add("printing-planning");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-planning"), 500);
}

export async function renderPlanning(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  [stagiaires, profs, themes] = await Promise.all([
    listStagiaires(), listProfs(), listThemes(),
  ]);
  semaineLundi = (await getSetting("current_week_lundi")) || isoDate(getMonday(new Date()));
  await loadPlanning();
  await ensureMinimumSlots();
  renderInto(container);
}
