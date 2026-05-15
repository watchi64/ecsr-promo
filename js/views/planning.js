import { listStagiaires, listProfs, getPlanning, upsertPlanningEntry, getSetting, setSetting } from "../db.js";
import { el, clear, isoDate, getMonday, addDays, formatDayShort, debounce, toast } from "../utils.js";
import { ACTIVITES, JOURS, HALF_DAYS } from "../config.js";

let stagiaires = [];
let profs = [];
let entries = {}; // keyed by "d-half-slot"
let semaineLundi = null;

const debouncedSave = {};

function entryKey(d, half, slot) { return `${d}-${half}-${slot}`; }

async function saveEntry(d, half, slot, patch) {
  const key = entryKey(d, half, slot);
  const current = entries[key] || {};
  const merged = { ...current, ...patch };
  entries[key] = merged;
  const payload = {
    semaine_lundi: semaineLundi,
    day_index: d,
    half_day: half,
    slot,
    activite: merged.activite ?? null,
    prof_id: merged.prof_id ?? null,
    sujet: merged.sujet ?? null,
    pedagogue_id: merged.pedagogue_id ?? null,
    eleves_ids: merged.eleves_ids ?? [],
    notes: merged.notes ?? null,
  };
  try {
    await upsertPlanningEntry(payload);
    // Update slot color
    const slotEl = document.querySelector(`[data-slotkey="${key}"]`);
    if (slotEl) slotEl.dataset.activite = payload.activite || "";
  } catch (e) {
    console.error(e);
    toast("Erreur d'enregistrement", "error");
  }
}

function selectFromList(items, currentVal, onChange, options = {}) {
  const sel = el("select");
  const placeholder = el("option", { value: "" }, options.placeholder || "—");
  sel.appendChild(placeholder);
  items.forEach((it) => {
    const opt = el("option", { value: String(it.value) }, it.label);
    if (String(currentVal) === String(it.value)) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => {
    const v = sel.value;
    onChange(v === "" ? null : v);
  });
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
        const chip = el("span", { class: "chip" },
          s.prenom,
          el("span", { class: "x", onClick: (ev) => {
            ev.stopPropagation();
            selected = selected.filter((x) => x !== id);
            render();
            onChange([...selected]);
          }}, "×")
        );
        display.appendChild(chip);
      });
    }
    clear(dropdown);
    allStagiaires.forEach((s) => {
      const item = el("div", {
        class: "chips-dropdown-item" + (selected.includes(s.id) ? " selected" : ""),
        onClick: (ev) => {
          ev.stopPropagation();
          if (selected.includes(s.id)) selected = selected.filter((x) => x !== s.id);
          else selected = [...selected, s.id];
          render();
          onChange([...selected]);
        }
      }, s.prenom);
      dropdown.appendChild(item);
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

function renderSlot(d, half, slot) {
  const key = entryKey(d, half, slot);
  const entry = entries[key] || {};
  const slotEl = el("div", {
    class: "planning-slot" + (slot === 1 ? " parallele" : ""),
    dataset: { slotkey: key, activite: entry.activite || "" }
  });

  // Activité
  const activiteCell = el("div", { class: "planning-cell" });
  activiteCell.appendChild(selectFromList(
    ACTIVITES.map((a) => ({ value: a, label: a })),
    entry.activite,
    (v) => saveEntry(d, half, slot, { activite: v }),
    { placeholder: "Activité…" }
  ));
  slotEl.appendChild(activiteCell);

  // Prof
  const profCell = el("div", { class: "planning-cell" });
  profCell.appendChild(selectFromList(
    profs.map((p) => ({ value: p.id, label: p.nom })),
    entry.prof_id,
    (v) => saveEntry(d, half, slot, { prof_id: v ? Number(v) : null }),
    { placeholder: "Prof…" }
  ));
  slotEl.appendChild(profCell);

  // Sujet
  const sujetCell = el("div", { class: "planning-cell" });
  const sujetInput = el("input", { type: "text", placeholder: "Sujet / Thème", value: entry.sujet || "" });
  if (!debouncedSave[key + "-sujet"]) {
    debouncedSave[key + "-sujet"] = debounce((v) => saveEntry(d, half, slot, { sujet: v }), 500);
  }
  sujetInput.addEventListener("input", () => debouncedSave[key + "-sujet"](sujetInput.value));
  sujetCell.appendChild(sujetInput);
  slotEl.appendChild(sujetCell);

  // Pédagogue
  const pedaCell = el("div", { class: "planning-cell pedagogue-cell" });
  pedaCell.appendChild(selectFromList(
    stagiaires.map((s) => ({ value: s.id, label: s.prenom })),
    entry.pedagogue_id,
    (v) => saveEntry(d, half, slot, { pedagogue_id: v ? Number(v) : null }),
    { placeholder: "Passe au tableau…" }
  ));
  slotEl.appendChild(pedaCell);

  // Élèves (chips)
  const elevesCell = el("div", { class: "planning-cell" });
  elevesCell.appendChild(chipsSelect(stagiaires, entry.eleves_ids || [], (ids) => {
    saveEntry(d, half, slot, { eleves_ids: ids });
  }));
  slotEl.appendChild(elevesCell);

  // Notes
  const notesCell = el("div", { class: "planning-cell" });
  const notesInput = el("input", { type: "text", placeholder: "Notes", value: entry.notes || "" });
  if (!debouncedSave[key + "-notes"]) {
    debouncedSave[key + "-notes"] = debounce((v) => saveEntry(d, half, slot, { notes: v }), 500);
  }
  notesInput.addEventListener("input", () => debouncedSave[key + "-notes"](notesInput.value));
  notesCell.appendChild(notesInput);
  slotEl.appendChild(notesCell);

  return slotEl;
}

async function changeWeek(dateStr) {
  semaineLundi = dateStr;
  await setSetting("current_week_lundi", dateStr);
  await loadPlanning();
  renderInto(currentContainer);
}

let currentContainer = null;

async function loadPlanning() {
  const data = await getPlanning(semaineLundi);
  entries = {};
  data.forEach((row) => {
    entries[entryKey(row.day_index, row.half_day, row.slot)] = row;
  });
}

function renderInto(container) {
  currentContainer = container;
  clear(container);

  const monday = new Date(semaineLundi + "T00:00:00");

  // Week bar
  const dateInput = el("input", { type: "date", value: semaineLundi });
  dateInput.addEventListener("change", () => {
    let d = new Date(dateInput.value + "T00:00:00");
    d = getMonday(d);
    changeWeek(isoDate(d));
  });
  const prevBtn = el("button", { class: "btn small", onClick: () => changeWeek(isoDate(addDays(monday, -7))) }, "← Semaine précédente");
  const nextBtn = el("button", { class: "btn small", onClick: () => changeWeek(isoDate(addDays(monday, 7))) }, "Semaine suivante →");

  container.appendChild(el("div", { class: "view-header" },
    el("h2", {}, "📅 Planning de la semaine"),
    el("p", { class: "subtitle" }, "1 ligne = activité principale  ·  2ᵉ ligne (grisée) = activité en parallèle. Tout s'enregistre automatiquement.")
  ));

  container.appendChild(el("div", { class: "week-bar" },
    el("strong", {}, "Semaine du :"),
    dateInput,
    prevBtn,
    nextBtn
  ));

  const grid = el("div", { class: "planning-grid" });

  // Header row
  grid.appendChild(el("div", { class: "planning-day-cell", style: "background:#1F4E78;color:white" }, "Jour"));
  grid.appendChild(el("div", { class: "planning-day-cell", style: "background:#1F4E78;color:white" }, "Demi-journée"));
  const headSlots = el("div", { class: "planning-slots" });
  const headSlot = el("div", { class: "planning-slot", style: "background:#1F4E78;color:white;font-weight:600" });
  ["Activité", "Prof", "Sujet / Thème", "Passe au tableau", "Élèves", "Notes"].forEach((h) => {
    headSlot.appendChild(el("div", { class: "planning-cell", style: "color:white;justify-content:center;font-size:0.85rem;text-transform:uppercase" }, h));
  });
  headSlots.appendChild(headSlot);
  grid.appendChild(headSlots);

  // Days
  JOURS.forEach((jourName, d) => {
    const date = addDays(monday, d);

    const dayCell = el("div", { class: "planning-day-cell" },
      el("span", { class: "day-name" }, jourName),
      el("span", { class: "day-date" }, formatDayShort(date))
    );

    HALF_DAYS.forEach((half, idx) => {
      if (idx === 0) {
        // place dayCell only once spanning both halves via grid: simpler to render twice
        const dc = el("div", { class: "planning-day-cell" },
          el("span", { class: "day-name" }, jourName),
          el("span", { class: "day-date" }, formatDayShort(date))
        );
        grid.appendChild(dc);
      } else {
        // empty cell to align row
        grid.appendChild(el("div", { class: "planning-day-cell" }));
      }
      const halfCell = el("div", { class: "planning-half-cell " + half.key },
        el("span", {}, half.short),
        el("small", { style: "font-weight:400;opacity:0.8;font-size:0.7rem" }, half.label)
      );
      grid.appendChild(halfCell);
      const slotsWrap = el("div", { class: "planning-slots" });
      slotsWrap.appendChild(renderSlot(d, half.key, 0));
      slotsWrap.appendChild(renderSlot(d, half.key, 1));
      grid.appendChild(slotsWrap);
    });
  });

  container.appendChild(grid);

  // Légende
  container.appendChild(el("p", { class: "muted", style: "margin-top:1rem;font-size:0.88rem" },
    "💡 Cours / Contrôle : tout le monde présent → Élèves vide. ",
    "🟡 Pédagogie salle : mettre dans « Passe au tableau » le stagiaire qui anime (compté auto dans le Tableau de bord), et dans Élèves les autres. ",
    "Voiture : Prof + 2 élèves."
  ));
}

export async function renderPlanning(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  [stagiaires, profs] = await Promise.all([listStagiaires(), listProfs()]);
  semaineLundi = (await getSetting("current_week_lundi")) || isoDate(getMonday(new Date()));
  await loadPlanning();
  renderInto(container);
}
