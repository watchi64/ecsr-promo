import { listStagiaires, listProfs, getPlanning, upsertPlanningEntry, getSetting, setSetting } from "../db.js";
import { el, clear, isoDate, getMonday, addDays, formatDayShort, debounce, toast } from "../utils.js";
import { icon } from "../icons.js";
import { ACTIVITES, JOURS, HALF_DAYS } from "../config.js";

let stagiaires = [];
let profs = [];
let entries = {};
let semaineLundi = null;
let currentContainer = null;

const debouncedSave = {};
const entryKey = (d, half, slot) => `${d}-${half}-${slot}`;

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
    const slotEl = document.querySelector(`[data-slotkey="${key}"]`);
    if (slotEl) slotEl.dataset.activite = payload.activite || "";
  } catch (e) {
    console.error(e);
    toast("Erreur d'enregistrement", "error");
  }
}

function selectFromList(items, currentVal, onChange, placeholder = "—") {
  const sel = el("select");
  sel.appendChild(el("option", { value: "" }, placeholder));
  items.forEach((it) => {
    const opt = el("option", { value: String(it.value) }, it.label);
    if (String(currentVal) === String(it.value)) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => {
    onChange(sel.value === "" ? null : sel.value);
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
    class: "p-slot" + (slot === 1 ? " parallele" : ""),
    dataset: { slotkey: key, activite: entry.activite || "" }
  });

  // Marker (principal / parallèle)
  const marker = el("div", { class: "p-slot-marker" }, slot === 0 ? "•" : "↳");
  slotEl.appendChild(marker);

  // Activité
  slotEl.appendChild(el("div", { class: "p-cell" },
    selectFromList(
      ACTIVITES.map((a) => ({ value: a, label: a })),
      entry.activite,
      (v) => saveEntry(d, half, slot, { activite: v }),
      "Activité…"
    )
  ));

  // Prof
  slotEl.appendChild(el("div", { class: "p-cell" },
    selectFromList(
      profs.map((p) => ({ value: p.id, label: p.nom })),
      entry.prof_id,
      (v) => saveEntry(d, half, slot, { prof_id: v ? Number(v) : null }),
      "Prof…"
    )
  ));

  // Sujet
  const sujetInput = el("input", { type: "text", placeholder: "Sujet / thème", value: entry.sujet || "" });
  if (!debouncedSave[key + "-sujet"]) {
    debouncedSave[key + "-sujet"] = debounce((v) => saveEntry(d, half, slot, { sujet: v }), 500);
  }
  sujetInput.addEventListener("input", () => debouncedSave[key + "-sujet"](sujetInput.value));
  slotEl.appendChild(el("div", { class: "p-cell" }, sujetInput));

  // Pédagogue
  slotEl.appendChild(el("div", { class: "p-cell pedagogue-cell" },
    selectFromList(
      stagiaires.map((s) => ({ value: s.id, label: s.prenom })),
      entry.pedagogue_id,
      (v) => saveEntry(d, half, slot, { pedagogue_id: v ? Number(v) : null }),
      "Au tableau…"
    )
  ));

  // Élèves
  slotEl.appendChild(el("div", { class: "p-cell" },
    chipsSelect(stagiaires, entry.eleves_ids || [], (ids) => {
      saveEntry(d, half, slot, { eleves_ids: ids });
    })
  ));

  // Notes
  const notesInput = el("input", { type: "text", placeholder: "Notes", value: entry.notes || "" });
  if (!debouncedSave[key + "-notes"]) {
    debouncedSave[key + "-notes"] = debounce((v) => saveEntry(d, half, slot, { notes: v }), 500);
  }
  notesInput.addEventListener("input", () => debouncedSave[key + "-notes"](notesInput.value));
  slotEl.appendChild(el("div", { class: "p-cell" }, notesInput));

  return slotEl;
}

function renderDayCard(d, monday) {
  const date = addDays(monday, d);
  const card = el("article", { class: "p-day-card" });

  // Day header
  const header = el("div", { class: "p-day-head" },
    el("span", { class: "p-day-name" }, JOURS[d]),
    el("span", { class: "p-day-date" }, formatDayShort(date)),
  );
  card.appendChild(header);

  HALF_DAYS.forEach((half) => {
    const section = el("div", { class: "p-half " + half.key });
    section.appendChild(el("div", { class: "p-half-head" },
      el("span", { class: "p-half-tag " + half.key }, half.short),
      el("span", { class: "p-half-hours" }, half.label),
    ));
    const slots = el("div", { class: "p-slots" });
    slots.appendChild(renderSlot(d, half.key, 0));
    slots.appendChild(renderSlot(d, half.key, 1));
    section.appendChild(slots);
    card.appendChild(section);
  });

  return card;
}

async function changeWeek(dateStr) {
  semaineLundi = dateStr;
  await setSetting("current_week_lundi", dateStr);
  await loadPlanning();
  renderInto(currentContainer);
}

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
  const longLabel = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Édition · Semaine du " + longLabel),
      el("h2", {}, "Planning de la semaine"),
      el("p", { class: "subtitle" }, "Sélectionne les activités, profs et stagiaires. Tout s'enregistre automatiquement."),
    ),
  ));

  // Week bar
  const prevBtn = el("button", { class: "btn small icon-only", "aria-label": "Semaine précédente" });
  prevBtn.appendChild(icon.chevronLeft());
  prevBtn.addEventListener("click", () => changeWeek(isoDate(addDays(monday, -7))));

  const nextBtn = el("button", { class: "btn small icon-only", "aria-label": "Semaine suivante" });
  nextBtn.appendChild(icon.chevronRight());
  nextBtn.addEventListener("click", () => changeWeek(isoDate(addDays(monday, 7))));

  const dateInput = el("input", { type: "date", value: semaineLundi });
  dateInput.addEventListener("change", () => {
    let d = new Date(dateInput.value + "T00:00:00");
    d = getMonday(d);
    changeWeek(isoDate(d));
  });

  const todayBtn = el("button", { class: "btn small" }, "Cette semaine");
  todayBtn.addEventListener("click", () => changeWeek(isoDate(getMonday(new Date()))));

  container.appendChild(el("div", { class: "week-bar" },
    el("span", { class: "week-bar-label" }, "Semaine du"),
    dateInput,
    prevBtn,
    nextBtn,
    todayBtn,
  ));

  // Days
  const wrap = el("div", { class: "p-days" });
  JOURS.forEach((_, d) => wrap.appendChild(renderDayCard(d, monday)));
  container.appendChild(wrap);

  // Helper
  container.appendChild(el("div", { class: "planning-helper" },
    el("strong", {}, "Comment remplir"), " — ",
    "1ʳᵉ ligne ", el("span", { style: "color:var(--accent);font-weight:600" }, "•"), " principal, ",
    "2ᵉ ligne ", el("span", { style: "color:var(--text-muted)" }, "↳"), " activité en parallèle (sinon laisser vide).  ",
    "Cours / Contrôle = tout le monde présent, Élèves vide.  ",
    "Pédagogie salle = mettre dans « Au tableau » le stagiaire qui anime (compté dans le Tableau de bord automatiquement)."
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
