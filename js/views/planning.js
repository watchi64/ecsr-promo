import {
  listStagiaires, listProfs, getPlanning,
  upsertPlanningEntry, deletePlanningEntryById,
  getSetting, setSetting,
} from "../db.js";
import { el, clear, isoDate, getMonday, addDays, formatDayShort, debounce, toast } from "../utils.js";
import { icon } from "../icons.js";
import { ACTIVITES, ACTIVITY_SHAPES, JOURS, HALF_DAYS } from "../config.js";

let stagiaires = [];
let profs = [];
let entries = [];  // tableau de planning_entries (avec id) au lieu d'objet keyed
let semaineLundi = null;
let currentContainer = null;

const debouncedSave = {};

function entriesFor(d, half) {
  return entries
    .filter((e) => e.day_index === d && e.half_day === half)
    .sort((a, b) => a.slot - b.slot);
}

function nextSlotNumber(d, half) {
  const list = entriesFor(d, half);
  if (list.length === 0) return 0;
  return Math.max(...list.map((e) => e.slot)) + 1;
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
    activite: entry.activite ?? null,
    prof_id: entry.prof_id ?? null,
    sujet: entry.sujet ?? null,
    pedagogue_id: entry.pedagogue_id ?? null,
    eleves_ids: entry.eleves_ids ?? [],
    notes: entry.notes ?? null,
  };

  try {
    await upsertPlanningEntry(payload);
    // Mise à jour dataset activité sur le slot (pour CSS)
    const slotEl = document.querySelector(`[data-lid="${localId}"]`);
    if (slotEl) slotEl.dataset.activite = payload.activite || "";
    // Si on a changé l'activité, on re-render le slot pour appliquer la nouvelle shape
    if (patch.activite !== undefined && slotEl) {
      const newSlot = renderSlot(entry);
      slotEl.replaceWith(newSlot);
    }
  } catch (e) {
    console.error(e);
    toast("Erreur d'enregistrement", "error");
  }
}

async function addSlot(d, half) {
  const slot = nextSlotNumber(d, half);
  const payload = {
    semaine_lundi: semaineLundi,
    day_index: d, half_day: half, slot,
    activite: null, prof_id: null, sujet: null, pedagogue_id: null, eleves_ids: [], notes: null,
  };
  try {
    await upsertPlanningEntry(payload);
    // Recharge pour récupérer l'id généré
    await loadPlanning();
    renderInto(currentContainer);
  } catch (e) {
    console.error(e);
    toast("Erreur création slot", "error");
  }
}

async function deleteSlot(entry) {
  // Empêche de supprimer s'il ne reste qu'un seul slot pour cette demi-journée
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

// === Composants de saisie ===

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

// === Render slot (dynamique selon activité) ===

function renderSlot(entry) {
  const lid = entry._lid;
  const slotEl = el("div", {
    class: "p-slot",
    dataset: { lid, activite: entry.activite || "" }
  });

  // Marker (toujours visible)
  slotEl.appendChild(el("div", { class: "p-slot-marker" }, "•"));

  const shape = ACTIVITY_SHAPES[entry.activite || ""] || ACTIVITY_SHAPES[""];

  // Activité (toujours présente — sinon comment changer ?)
  slotEl.appendChild(el("div", { class: "p-cell p-cell-activite" },
    selectFromList(
      ACTIVITES.map((a) => ({ value: a, label: a })),
      entry.activite,
      (v) => saveEntry(lid, { activite: v }),
      "Choisir activité…"
    )
  ));

  // Prof
  if (shape.includes("prof")) {
    slotEl.appendChild(el("div", { class: "p-cell" },
      selectFromList(
        profs.map((p) => ({ value: p.id, label: p.nom })),
        entry.prof_id,
        (v) => saveEntry(lid, { prof_id: v ? Number(v) : null }),
        "Prof…"
      )
    ));
  }

  // Sujet
  if (shape.includes("sujet")) {
    const sujetInput = el("input", { type: "text", placeholder: "Sujet / thème", value: entry.sujet || "" });
    const key = lid + "-sujet";
    if (!debouncedSave[key]) {
      debouncedSave[key] = debounce((v) => saveEntry(lid, { sujet: v }), 500);
    }
    sujetInput.addEventListener("input", () => debouncedSave[key](sujetInput.value));
    slotEl.appendChild(el("div", { class: "p-cell" }, sujetInput));
  }

  // Pédagogue (uniquement si shape l'inclut)
  if (shape.includes("pedagogue")) {
    slotEl.appendChild(el("div", { class: "p-cell pedagogue-cell" },
      selectFromList(
        stagiaires.map((s) => ({ value: s.id, label: s.prenom })),
        entry.pedagogue_id,
        (v) => saveEntry(lid, { pedagogue_id: v ? Number(v) : null }),
        "Au tableau…"
      )
    ));
  }

  // Élèves (uniquement si shape l'inclut)
  if (shape.includes("eleves")) {
    slotEl.appendChild(el("div", { class: "p-cell" },
      chipsSelect(stagiaires, entry.eleves_ids || [], (ids) => {
        saveEntry(lid, { eleves_ids: ids });
      })
    ));
  }

  // Notes
  if (shape.includes("notes")) {
    const notesInput = el("input", { type: "text", placeholder: "Notes", value: entry.notes || "" });
    const key = lid + "-notes";
    if (!debouncedSave[key]) {
      debouncedSave[key] = debounce((v) => saveEntry(lid, { notes: v }), 500);
    }
    notesInput.addEventListener("input", () => debouncedSave[key](notesInput.value));
    slotEl.appendChild(el("div", { class: "p-cell" }, notesInput));
  }

  // Trash
  const trashBtn = el("button", {
    class: "p-slot-delete", "aria-label": "Supprimer ce créneau",
    onClick: () => deleteSlot(entry)
  });
  trashBtn.appendChild(icon.trash());
  slotEl.appendChild(trashBtn);

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
    const slots = el("div", { class: "p-slots" });
    const list = entriesFor(d, half.key);
    list.forEach((entry) => slots.appendChild(renderSlot(entry)));

    // Bouton + Ajouter un créneau
    const addBtn = el("button", { class: "p-add-slot", onClick: () => addSlot(d, half.key) });
    addBtn.appendChild(icon.plus());
    addBtn.appendChild(document.createTextNode("Ajouter un créneau"));
    slots.appendChild(addBtn);

    section.appendChild(slots);
    card.appendChild(section);
  });

  return card;
}

// === Charge & assure le minimum de slots (1 matin + 1 aprem par jour) ===

async function ensureMinimumSlots() {
  const toCreate = [];
  for (let d = 0; d < 5; d++) {
    for (const half of HALF_DAYS) {
      if (entriesFor(d, half.key).length === 0) {
        toCreate.push({
          semaine_lundi: semaineLundi, day_index: d, half_day: half.key, slot: 0,
          activite: null, prof_id: null, sujet: null, pedagogue_id: null, eleves_ids: [], notes: null,
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

// === Render principal ===

function renderInto(container) {
  currentContainer = container;
  clear(container);

  const monday = new Date(semaineLundi + "T00:00:00");
  const longLabel = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Édition · Semaine du " + longLabel),
      el("h2", {}, "Planning de la semaine"),
      el("p", { class: "subtitle" }, "Au moins une activité par demi-journée. Ajoute des créneaux en parallèle si besoin. Tout s'enregistre automatiquement."),
    ),
  ));

  // Toolbar : semaine + actions
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
    dateInput,
    prevBtn,
    nextBtn,
    todayBtn,
    el("span", { style: "flex:1" }),
    printBtn,
  ));

  // Cards
  const wrap = el("div", { class: "p-days" });
  JOURS.forEach((_, d) => wrap.appendChild(renderDayCard(d, monday)));
  container.appendChild(wrap);

  container.appendChild(el("div", { class: "planning-helper" },
    el("strong", {}, "Activités modulables"), " — clic sur ", el("span", { style: "color:var(--accent);font-weight:600" }, "+"),
    " pour ajouter un créneau en parallèle, ",
    el("span", { style: "color:var(--c-stop)" }, "🗑"),
    " pour en retirer un (min. 1 par demi-journée). ",
    "Les colonnes « Au tableau » et « Élèves » apparaissent automatiquement quand tu sélectionnes Pédagogie salle ou Voiture."
  ));
}

// === Export print ===

function printPlanning() {
  document.body.classList.add("printing-planning");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-planning"), 500);
}

export async function renderPlanning(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  [stagiaires, profs] = await Promise.all([listStagiaires(), listProfs()]);
  semaineLundi = (await getSetting("current_week_lundi")) || isoDate(getMonday(new Date()));
  await loadPlanning();
  await ensureMinimumSlots();
  renderInto(container);
}
