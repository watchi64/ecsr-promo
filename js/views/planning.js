import {
  listStagiaires, listProfs, listThemes, getPlanning,
  upsertPlanningEntry, deletePlanningEntryById,
  getHalfMetaForWeek, upsertHalfMeta,
  getSetting, setSetting,
} from "../db.js?v=20260625a";
import { el, clear, isoDate, getMonday, addDays, formatDayShort, debounce, toast, displayStagiaire } from "../utils.js?v=20260625a";
import { icon } from "../icons.js?v=20260625a";
import { ACTIVITES, ACTIVITY_SHAPES, JOURS, HALF_DAYS } from "../config.js?v=20260625a";
import { isAdmin } from "../auth-admin.js?v=20260625a";

let stagiaires = [];
let profs = [];
let themes = [];
let entries = [];
let halfMetas = [];  // [{semaine_lundi, day_index, half_day, start_time, end_time, pause_start, pause_minutes}]
let semaineLundi = null;
let currentContainer = null;

// Défauts horaires si pas de meta en DB
const DEFAULT_HALF_META = {
  matin: { start_time: "09:00", end_time: "12:30", pause_start: "10:45", pause_minutes: 20 },
  aprem: { start_time: "13:30", end_time: "17:00", pause_start: "15:15", pause_minutes: 20 },
};

function metaFor(d, half) {
  return halfMetas.find((m) => m.day_index === d && m.half_day === half)
      || { day_index: d, half_day: half, ...DEFAULT_HALF_META[half] };
}

function timesLabel(meta) {
  return `${meta.start_time.replace(":", "h")} à ${meta.end_time.replace(":", "h")}`;
}

function pauseLabel(meta) {
  if (!meta.pause_start) return null;
  const end = addMinutes(meta.pause_start, meta.pause_minutes);
  return `Pause ${meta.pause_start.replace(":", "h")}-${end.replace(":", "h")}`;
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

const debouncedSave = {};
const pendingSaves = new Set();

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
    prof_id: entry.prof_ids && entry.prof_ids.length ? entry.prof_ids[0] : null,  // legacy compat (1er prof)
    prof_ids: entry.prof_ids ?? [],
    sujet: entry.sujet ?? null,
    pedagogue_id: entry.pedagogue_id ?? null,
    eleves_ids: entry.eleves_ids ?? [],
    notes: entry.notes ?? null,
  };

  // Track la promesse pour que flushPendingInputs puisse l'attendre avant un re-render
  const p = (async () => {
    try {
      await upsertPlanningEntry(payload);
      const cellEl = document.querySelector(`[data-lid="${localId}"]`);
      if (cellEl) cellEl.dataset.activite = payload.activite || "";
      if (patch.activite !== undefined && cellEl) {
        const newCell = renderLaneCell(entry);
        cellEl.replaceWith(newCell);
      }
    } catch (e) {
      console.error(e);
      toast("Erreur d'enregistrement", "error");
    }
  })();
  pendingSaves.add(p);
  p.finally(() => pendingSaves.delete(p));
  return p;
}

// Force le blur de l'input actif (déclenche les saves pendant blur),
// puis attend que TOUTES les promesses de save en cours soient résolues.
async function flushPendingInputs() {
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === "function") {
    active.blur();
  }
  // Microtask + délai court pour laisser les handlers blur asynchrones
  // ajouter leurs promesses dans pendingSaves.
  await new Promise((resolve) => setTimeout(resolve, 50));
  // Maintenant on attend que TOUS les saves en cours se terminent (vraie DB round-trip).
  if (pendingSaves.size > 0) {
    await Promise.all([...pendingSaves]);
  }
}

// Version simplifiée : ajoute en fin de séquence (la plupart des cas)
async function addSlotEnd(d, half) {
  await flushPendingInputs();
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
  await flushPendingInputs();
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

// === Tirage aléatoire (Pédagogue, élèves Pédagogie salle, élèves Voiture) ===
// Règle commune : pas de doublon dans la semaine pour la même activité.

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** IDs déjà mobilisés dans la semaine pour une activité donnée (sauf l'entry courante). */
function busyIdsForActivity(activite, currentLid, { includePedagogue = true, includeEleves = true } = {}) {
  const busy = new Set();
  entries.forEach((e) => {
    if (e.activite !== activite) return;
    if (e._lid === currentLid) return;
    if (includePedagogue && e.pedagogue_id) busy.add(e.pedagogue_id);
    if (includeEleves) (e.eleves_ids || []).forEach((id) => busy.add(id));
  });
  return busy;
}

async function randomFillEleves(lid) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;

  const busy = busyIdsForActivity("Pédagogie salle", lid);
  if (entry.pedagogue_id) busy.add(entry.pedagogue_id);

  const candidates = stagiaires.filter((s) => !busy.has(s.id));
  if (candidates.length === 0) {
    toast("Plus aucun stagiaire disponible cette semaine", "error", 3500);
    return;
  }
  const picked = shuffle(candidates).slice(0, 4).map((s) => s.id);

  if (picked.length < 4) {
    toast(`Seulement ${picked.length} stagiaire(s) disponible(s)`, "info", 3500);
  } else {
    toast("4 élèves tirés au hasard", "success", 1500);
  }
  await saveEntry(lid, { eleves_ids: picked });
  renderInto(currentContainer);
}

async function randomFillPedagogue(lid) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;

  // Exclut tout pédagogue déjà désigné cette semaine + les élèves de cette cellule
  const busy = busyIdsForActivity("Pédagogie salle", lid, { includeEleves: false });
  (entry.eleves_ids || []).forEach((id) => busy.add(id));

  const candidates = stagiaires.filter((s) => !busy.has(s.id));
  if (candidates.length === 0) {
    toast("Tous les stagiaires sont déjà passés au tableau cette semaine", "error", 3500);
    return;
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  await saveEntry(lid, { pedagogue_id: picked.id });
  renderInto(currentContainer);
  toast(displayStagiaire(picked) + " désigné(e) au tableau", "success", 1800);
}

async function randomFillVoitureEleves(lid, count) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;

  const busy = busyIdsForActivity("Voiture (conduite)", lid, { includePedagogue: false });

  const candidates = stagiaires.filter((s) => !busy.has(s.id));
  if (candidates.length === 0) {
    toast("Plus aucun stagiaire disponible en voiture cette semaine", "error", 3500);
    return;
  }
  const picked = shuffle(candidates).slice(0, count).map((s) => s.id);
  if (picked.length < count) {
    toast(`Seulement ${picked.length} stagiaire(s) disponible(s)`, "info", 3500);
  } else {
    toast(`${count} élève(s) en voiture tiré(s) au hasard`, "success", 1500);
  }
  await saveEntry(lid, { eleves_ids: picked });
  renderInto(currentContainer);
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

// Select profs multi-choix : compact, fond bg-subtle pour bien se distinguer dans le header
function profChipsSelect(allProfs, currentIds, onChange) {
  const wrap = el("div", { class: "p-prof-multi" });
  const display = el("div", { class: "p-prof-display", tabindex: "0" });
  const dropdown = el("div", { class: "p-prof-dropdown hidden" });
  let selected = [...(currentIds || [])];

  function render() {
    clear(display);
    if (selected.length === 0) {
      display.appendChild(el("span", { class: "p-prof-placeholder" }, "Formateur…"));
    } else {
      selected.forEach((id) => {
        const p = allProfs.find((x) => x.id === id);
        if (!p) return;
        display.appendChild(el("span", { class: "p-prof-chip" },
          p.nom,
          el("span", {
            class: "p-prof-x",
            onClick: (ev) => {
              ev.stopPropagation();
              selected = selected.filter((x) => x !== id);
              render();
              onChange([...selected]);
            },
          }, "×"),
        ));
      });
    }
    clear(dropdown);
    allProfs.forEach((p) => {
      dropdown.appendChild(el("div", {
        class: "p-prof-dropdown-item" + (selected.includes(p.id) ? " selected" : ""),
        onClick: (ev) => {
          ev.stopPropagation();
          if (selected.includes(p.id)) selected = selected.filter((x) => x !== p.id);
          else selected = [...selected, p.id];
          render();
          onChange([...selected]);
        },
      }, p.nom));
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
          displayStagiaire(s),
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
      }, displayStagiaire(s)));
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

// Sujet multi-thèmes : chips inline + autocomplete continue (virgule ou Enter pour valider).
// Stocké en DB comme chaîne "Thème A, Thème B".
function parseSujet(val) {
  if (!val) return [];
  return String(val).split(",").map((s) => s.trim()).filter(Boolean);
}
function joinSujet(arr) { return arr.join(", "); }

function sujetMultiSelect(currentValue, onChange) {
  const wrap = el("div", { class: "sujet-ac sujet-multi" });
  const chipsBox = el("div", { class: "sujet-chips" });
  const input = el("input", {
    type: "text",
    class: "sujet-chip-input",
    placeholder: "Ajouter un thème…",
    autocomplete: "off",
    autocorrect: "off",
    autocapitalize: "off",
    spellcheck: "false",
  });
  const dropdown = el("div", { class: "sujet-ac-dropdown hidden" });

  let selected = parseSujet(currentValue);

  function commit() { onChange(joinSujet(selected)); }

  function renderChips() {
    clear(chipsBox);
    selected.forEach((titre, idx) => {
      const t = themes.find((x) => x.titre === titre);
      const chip = el("span", { class: "sujet-chip" + (t ? " has-num" : "") });
      if (t && t.numero != null) {
        chip.appendChild(el("span", { class: "sujet-chip-num" }, String(t.numero).padStart(2, "0")));
      }
      chip.appendChild(el("span", { class: "sujet-chip-label" }, titre));
      chip.appendChild(el("button", {
        class: "sujet-chip-x", type: "button", "aria-label": "Retirer",
        onClick: (ev) => {
          ev.stopPropagation();
          selected.splice(idx, 1);
          renderChips();
          commit();
        }
      }, "×"));
      chipsBox.appendChild(chip);
    });
    chipsBox.appendChild(input);
    if (selected.length === 0) input.placeholder = "Sujet / thème…";
    else input.placeholder = "+";
  }

  function addLabel(label) {
    const v = label.trim();
    if (!v) return;
    if (!selected.includes(v)) selected.push(v);
    input.value = "";
    renderChips();
    commit();
    renderSuggestions("");
  }

  function renderSuggestions(query) {
    clear(dropdown);
    const q = query.trim().toLowerCase();
    let matches = themes.filter((t) => !selected.includes(t.titre));
    if (q) {
      matches = matches.filter((t) => {
        const numStr = t.numero != null ? String(t.numero) : "";
        return t.titre.toLowerCase().includes(q)
            || numStr.includes(q)
            || (t.categorie || "").toLowerCase().includes(q);
      });
    }
    matches = matches.slice(0, 12);
    if (matches.length === 0) {
      dropdown.appendChild(el("div", { class: "sujet-ac-empty muted" },
        q ? "Aucun thème. Tape virgule ou Entrée pour l'ajouter tel quel." : "Plus de thèmes à ajouter."));
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
        ev.preventDefault();
        addLabel(t.titre);
        input.focus();
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
    // Auto-commit du texte en cours (avant perte de focus = avant un éventuel add lane)
    if (input.value.trim()) addLabel(input.value);
  });
  input.addEventListener("input", () => {
    const v = input.value;
    // virgule = valider
    if (v.endsWith(",")) {
      addLabel(v.slice(0, -1));
      renderSuggestions("");
      return;
    }
    renderSuggestions(v);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.value.trim()) addLabel(input.value);
    } else if (e.key === "Backspace" && input.value === "" && selected.length > 0) {
      selected.pop();
      renderChips();
      commit();
    } else if (e.key === "Escape") {
      dropdown.classList.add("hidden");
      input.blur();
    }
  });

  wrap.appendChild(chipsBox);
  wrap.appendChild(dropdown);
  renderChips();
  return wrap;
}

// === Rendu d'une cellule (un lane d'un slot) ===

function renderLaneCell(entry) {
  const lid = entry._lid;
  const cell = el("div", {
    class: "p-lane-cell",
    dataset: { lid, activite: entry.activite || "" }
  });

  const shape = ACTIVITY_SHAPES[entry.activite || ""] || ACTIVITY_SHAPES[""];

  // === Header strip : activité + prof + delete ===
  const header = el("div", { class: "p-lane-header" });
  header.appendChild(el("div", { class: "p-lane-activite-wrap" },
    selectFromList(
      ACTIVITES.map((a) => ({ value: a, label: a })),
      entry.activite,
      (v) => saveEntry(lid, { activite: v }),
      "Choisir activité…"
    )
  ));
  if (shape.includes("prof")) {
    header.appendChild(el("div", { class: "p-lane-prof-wrap" },
      profChipsSelect(profs, entry.prof_ids || [], (ids) => {
        saveEntry(lid, { prof_ids: ids });
      })
    ));
  }
  const trashBtn = el("button", {
    class: "p-lane-delete", "aria-label": "Supprimer",
    onClick: () => deleteCell(entry)
  });
  trashBtn.appendChild(icon.trash());
  header.appendChild(trashBtn);
  cell.appendChild(header);

  const body = el("div", { class: "p-lane-body" });

  // === Sujet : mis en avant ===
  if (shape.includes("sujet")) {
    const sujetWrap = sujetMultiSelect(entry.sujet, (v) => saveEntry(lid, { sujet: v }));
    body.appendChild(el("div", { class: "p-lane-sujet" }, sujetWrap));
  }

  // === Participants : pédagogue + élèves côte à côte avec labels ===
  const hasPedagogue = shape.includes("pedagogue");
  const hasEleves = shape.includes("eleves");
  if (hasPedagogue || hasEleves) {
    const participants = el("div", { class: "p-lane-participants" });
    if (hasPedagogue) {
      const pedaRole = el("div", { class: "p-lane-role pedagogue" });
      pedaRole.appendChild(el("span", { class: "p-lane-role-label" }, "Au tableau"));
      pedaRole.appendChild(selectFromList(
        stagiaires.map((s) => ({ value: s.id, label: displayStagiaire(s) })),
        entry.pedagogue_id,
        (v) => saveEntry(lid, { pedagogue_id: v ? Number(v) : null }),
        "—"
      ));
      // Bouton tirage aléatoire du pédagogue (Pédagogie salle uniquement)
      if (entry.activite === "Pédagogie salle") {
        const diceBtn = el("button", {
          class: "p-dice-btn",
          type: "button",
          title: "Tirer 1 stagiaire au hasard (parmi ceux qui n'ont pas encore été au tableau cette semaine)",
          onClick: () => randomFillPedagogue(lid),
        }, "🎲");
        pedaRole.appendChild(diceBtn);
      }
      participants.appendChild(pedaRole);
    }
    if (hasEleves) {
      const eleveRole = el("div", { class: "p-lane-role eleves" });
      eleveRole.appendChild(el("span", { class: "p-lane-role-label" }, "Élèves"));
      const eleveCol = el("div", { class: "p-lane-eleves-col" });
      eleveCol.appendChild(chipsSelect(stagiaires, entry.eleves_ids || [], (ids) => {
        saveEntry(lid, { eleves_ids: ids });
      }));
      if (entry.activite === "Pédagogie salle") {
        const diceBtn = el("button", {
          class: "p-dice-btn",
          type: "button",
          "aria-label": "Tirer 4 élèves au hasard",
          title: "Tirer 4 élèves au hasard (sans doublon dans la semaine)",
          onClick: () => randomFillEleves(lid),
        }, "🎲");
        eleveCol.appendChild(el("div", { class: "p-eleves-dice-toolbar" }, diceBtn));
      } else if (entry.activite === "Voiture (conduite)") {
        // Bouton 🎲 seul : ouvre un mini-picker (1/2/3) au clic
        const wrap = el("div", { class: "p-dice-picker-wrap" });
        const diceBtn = el("button", {
          class: "p-dice-btn",
          type: "button",
          "aria-label": "Tirer des élèves",
          title: "Tirer des élèves voiture",
        }, "🎲");
        const picker = el("div", { class: "p-dice-picker hidden" });
        [1, 2, 3].forEach((n) => {
          picker.appendChild(el("button", {
            class: "p-dice-option", type: "button",
            onClick: (ev) => {
              ev.stopPropagation();
              picker.classList.add("hidden");
              randomFillVoitureEleves(lid, n);
            },
          }, String(n)));
        });
        diceBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          picker.classList.toggle("hidden");
        });
        document.addEventListener("click", (ev) => {
          if (!wrap.contains(ev.target)) picker.classList.add("hidden");
        });
        wrap.appendChild(diceBtn);
        wrap.appendChild(picker);
        eleveCol.appendChild(el("div", { class: "p-eleves-dice-toolbar" }, wrap));
      }
      eleveRole.appendChild(eleveCol);
      participants.appendChild(eleveRole);
    }
    body.appendChild(participants);
  }

  // === Notes : discret, en bas ===
  if (shape.includes("notes")) {
    const notesInput = el("input", { type: "text", class: "p-lane-notes-input", placeholder: "+ note", value: entry.notes || "", autocomplete: "off" });
    const key = lid + "-notes";
    if (!debouncedSave[key]) {
      debouncedSave[key] = debounce((v) => saveEntry(lid, { notes: v }), 500);
    }
    notesInput.addEventListener("input", () => debouncedSave[key](notesInput.value));
    // Sur blur, sauvegarde immédiate (annule le debounce) pour éviter la perte avant un re-render
    notesInput.addEventListener("blur", () => {
      if (notesInput.value !== (entry.notes || "")) {
        saveEntry(lid, { notes: notesInput.value });
      }
    });
    body.appendChild(el("div", { class: "p-lane-notes" }, notesInput));
  }

  cell.appendChild(body);
  return cell;
}

// === Rendu d'un slot (rangée = série, contient N lanes en parallèle) ===

function renderSlotRow(d, half, row, maxLanes) {
  const slotEl = el("div", { class: "p-slot-row" });

  // Marqueur du slot
  slotEl.appendChild(el("div", { class: "p-slot-marker" },
    el("span", { class: "p-slot-num" }, String(row.slot + 1))
  ));

  // Lanes — grid à `maxLanes` colonnes (+ une colonne fine pour le bouton parallèle)
  const lanes = el("div", { class: "p-lanes" });
  // Grid template : N colonnes de cellules de même largeur + 1 colonne 40px pour le "+"
  lanes.style.gridTemplateColumns = `repeat(${maxLanes}, minmax(0, 1fr)) 40px`;

  row.lanes.forEach((entry) => {
    const cell = renderLaneCell(entry);
    // Place la cellule dans la colonne correspondant à son lane index
    cell.style.gridColumn = String((entry.lane ?? 0) + 1);
    lanes.appendChild(cell);
  });

  // Bouton "+" en parallèle : dernière colonne, prend toutes les lignes
  const addParBtn = el("button", {
    class: "p-add-parallele-mini",
    title: "Ajouter une activité en parallèle (même horaire)",
    onClick: () => addLaneInSlot(d, half, row.slot)
  });
  addParBtn.style.gridColumn = String(maxLanes + 1);
  addParBtn.appendChild(icon.plus());
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
  const content = el("div", { class: "p-day-content" });

  HALF_DAYS.forEach((half) => {
    const meta = metaFor(d, half.key);
    const pauseLbl = pauseLabel(meta);

    const section = el("div", { class: "p-half " + half.key });

    // Header cliquable
    const headBtn = el("button", {
      class: "p-half-head editable",
      title: "Modifier les horaires et la pause",
      onClick: () => openHalfMetaEditor(d, half.key, headBtn),
    });
    headBtn.appendChild(el("span", { class: "p-half-tag " + half.key }, half.short));
    headBtn.appendChild(el("span", { class: "p-half-hours" }, timesLabel(meta)));
    if (pauseLbl) {
      headBtn.appendChild(el("span", { class: "p-half-pause" },
        el("span", { class: "pause-dot" }), pauseLbl
      ));
    }
    section.appendChild(headBtn);

    const slotsWrap = el("div", { class: "p-slots-wrap" });
    const rows = rowsFor(d, half.key);
    // Calcule combien de "colonnes parallèles" maximum dans cette demi-journée
    // = max(lane index + 1) parmi toutes les entries de la demi-journée
    const allLanes = rows.flatMap((r) => r.lanes.map((e) => e.lane ?? 0));
    const maxLanes = Math.max(1, ...allLanes.map((l) => l + 1));
    rows.forEach((row) => slotsWrap.appendChild(renderSlotRow(d, half.key, row, maxLanes)));

    // Bouton "+ À la suite"
    const addSuiteBtn = el("button", {
      class: "p-add-suite",
      title: "Ajouter un créneau à la suite",
      onClick: () => addSlotEnd(d, half.key),
    });
    addSuiteBtn.appendChild(icon.plus());
    addSuiteBtn.appendChild(document.createTextNode("À la suite"));
    slotsWrap.appendChild(addSuiteBtn);

    section.appendChild(slotsWrap);
    content.appendChild(section);
  });
  card.appendChild(content);
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
  const [data, metas] = await Promise.all([
    getPlanning(semaineLundi),
    getHalfMetaForWeek(semaineLundi),
  ]);
  let counter = 0;
  entries = data.map((row) => {
    // Compat ascendante : si prof_ids vide mais prof_id présent, on l'utilise
    let prof_ids = row.prof_ids;
    if ((!prof_ids || prof_ids.length === 0) && row.prof_id) prof_ids = [row.prof_id];
    return { ...row, prof_ids: prof_ids || [], _lid: "lid-" + (++counter) };
  });
  halfMetas = metas;
}

async function saveHalfMeta(d, half, patch) {
  const existing = metaFor(d, half);
  const merged = { ...existing, ...patch };
  const payload = {
    semaine_lundi: semaineLundi,
    day_index: d,
    half_day: half,
    start_time: merged.start_time,
    end_time: merged.end_time,
    pause_start: merged.pause_start || null,
    pause_minutes: merged.pause_minutes ?? 20,
  };
  try {
    await upsertHalfMeta(payload);
    // Met à jour le cache local
    const idx = halfMetas.findIndex((m) => m.day_index === d && m.half_day === half);
    if (idx >= 0) Object.assign(halfMetas[idx], payload);
    else halfMetas.push(payload);
    renderInto(currentContainer);
  } catch (e) {
    console.error(e);
    toast("Erreur sauvegarde horaires", "error");
  }
}

function openHalfMetaEditor(d, half, anchorEl) {
  const meta = metaFor(d, half);
  const backdrop = el("div", { class: "modal-backdrop" });

  const startInput = el("input", { type: "time", value: meta.start_time });
  const endInput = el("input", { type: "time", value: meta.end_time });
  const pauseInput = el("input", { type: "time", value: meta.pause_start || "" });
  const pauseMinInput = el("input", { type: "number", min: 0, max: 60, value: meta.pause_minutes || 20 });

  const halfLabel = half === "matin" ? "matin" : "après-midi";

  async function save() {
    await saveHalfMeta(d, half, {
      start_time: startInput.value || (half === "matin" ? "09:00" : "13:30"),
      end_time: endInput.value || (half === "matin" ? "12:30" : "17:00"),
      pause_start: pauseInput.value || null,
      pause_minutes: Number(pauseMinInput.value) || 20,
    });
    backdrop.remove();
  }

  async function clearPause() {
    pauseInput.value = "";
  }

  const modal = el("div", { class: "modal" },
    el("h3", {}, `Horaires · ${JOURS[d].toLowerCase()} ${halfLabel}`),
    el("div", { class: "modal-form" },
      el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.6rem" },
        el("div", { class: "field" }, el("label", {}, "Début"), startInput),
        el("div", { class: "field" }, el("label", {}, "Fin"),   endInput),
      ),
      el("hr", { style: "border:none;border-top:1px solid var(--line);margin:0.25rem 0" }),
      el("p", { class: "muted", style: "margin:0;font-size:0.82rem" }, "Pause (laisser vide = pas de pause)"),
      el("div", { style: "display:grid;grid-template-columns:1fr 100px;gap:0.6rem" },
        el("div", { class: "field" }, el("label", {}, "Début pause"), pauseInput),
        el("div", { class: "field" }, el("label", {}, "Durée (min)"), pauseMinInput),
      ),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler"),
      el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
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

  const admin = isAdmin();
  container.classList.toggle("read-only", !admin);

  const monday = new Date(semaineLundi + "T00:00:00");
  const longLabel = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, (admin ? "Édition" : "Consultation") + " · Semaine du " + longLabel),
      el("h2", {}, "Planning de la semaine"),
      el("p", { class: "subtitle" },
        admin
          ? "Sélectionne les activités, profs et stagiaires. Tout s'enregistre automatiquement."
          : "Lecture seule. Connexion admin requise pour modifier."
      ),
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

// === Rendu print 1 page (DOM dédié, compact, vide masqué) ===

function nonEmpty(v) {
  return v != null && String(v).trim() !== "";
}

function lookupProf(id) { return profs.find((p) => p.id === id)?.nom || ""; }
function lookupStagiaire(id) {
  const s = stagiaires.find((x) => x.id === id);
  return s ? displayStagiaire(s) : "";
}

function entryHasContent(e) {
  return nonEmpty(e.activite) || nonEmpty(e.sujet) || nonEmpty(e.notes)
      || (e.prof_ids && e.prof_ids.length) || e.prof_id
      || e.pedagogue_id || (e.eleves_ids && e.eleves_ids.length);
}

function printEntryCell(e) {
  const cell = el("div", { class: "pp-cell", dataset: { activite: e.activite || "" } });

  // Ligne titre : activité + prof
  const header = el("div", { class: "pp-cell-head" });
  if (nonEmpty(e.activite)) {
    header.appendChild(el("span", { class: "pp-act" }, e.activite));
  } else {
    header.appendChild(el("span", { class: "pp-act muted" }, "—"));
  }
  const profIds = (e.prof_ids && e.prof_ids.length) ? e.prof_ids : (e.prof_id ? [e.prof_id] : []);
  if (profIds.length) {
    header.appendChild(el("span", { class: "pp-prof" }, profIds.map(lookupProf).filter(Boolean).join(" · ")));
  }
  cell.appendChild(header);

  // Sujet
  if (nonEmpty(e.sujet)) {
    cell.appendChild(el("div", { class: "pp-sujet" }, e.sujet));
  }

  // Pédagogue (Au tableau)
  if (e.pedagogue_id) {
    cell.appendChild(el("div", { class: "pp-line" },
      el("span", { class: "pp-key" }, "Au tableau : "),
      el("span", { class: "pp-val" }, lookupStagiaire(e.pedagogue_id))
    ));
  }

  // Élèves
  if (e.eleves_ids && e.eleves_ids.length) {
    cell.appendChild(el("div", { class: "pp-line" },
      el("span", { class: "pp-key" }, "Élèves : "),
      el("span", { class: "pp-val" }, e.eleves_ids.map(lookupStagiaire).filter(Boolean).join(", "))
    ));
  }

  // Notes
  if (nonEmpty(e.notes)) {
    cell.appendChild(el("div", { class: "pp-line pp-notes" }, e.notes));
  }

  return cell;
}

function buildPrintHtml(monday) {
  const root = el("div", { class: "print-root" });

  // En-tête
  const semaineLabel = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  root.appendChild(el("div", { class: "pp-header" },
    el("div", { class: "pp-title" }, "Planning de la semaine"),
    el("div", { class: "pp-week" }, "Semaine du " + semaineLabel),
  ));

  // Grille 5 jours × 2 demi-journées
  const grid = el("div", { class: "pp-grid" });

  JOURS.forEach((jour, d) => {
    const date = addDays(monday, d);
    const dayCol = el("div", { class: "pp-day" });

    dayCol.appendChild(el("div", { class: "pp-day-head" },
      el("span", { class: "pp-day-name" }, jour),
      el("span", { class: "pp-day-date" }, formatDayShort(date)),
    ));

    HALF_DAYS.forEach((half) => {
      const meta = metaFor(d, half.key);
      const pauseLbl = pauseLabel(meta);

      const halfBlock = el("div", { class: "pp-half " + half.key });

      // Header demi-journée
      const head = el("div", { class: "pp-half-head" });
      head.appendChild(el("span", { class: "pp-half-tag " + half.key }, half.short.slice(0, 3).toUpperCase()));
      head.appendChild(el("span", { class: "pp-half-hours" }, timesLabel(meta)));
      if (pauseLbl) head.appendChild(el("span", { class: "pp-half-pause" }, "· " + pauseLbl));
      halfBlock.appendChild(head);

      // Slots non vides
      const rows = rowsFor(d, half.key)
        .map((row) => ({
          slot: row.slot,
          lanes: row.lanes.filter(entryHasContent),
        }))
        .filter((row) => row.lanes.length > 0);

      if (rows.length === 0) {
        halfBlock.appendChild(el("div", { class: "pp-empty" }, "—"));
      } else {
        rows.forEach((row) => {
          const rowEl = el("div", { class: "pp-row" });
          row.lanes.forEach((e) => rowEl.appendChild(printEntryCell(e)));
          halfBlock.appendChild(rowEl);
        });
      }

      dayCol.appendChild(halfBlock);
    });

    grid.appendChild(dayCol);
  });

  root.appendChild(grid);

  // Footer
  root.appendChild(el("div", { class: "pp-footer" }, "Promo ECSR · généré le " + new Date().toLocaleDateString("fr-FR")));

  return root;
}

function printPlanning() {
  const monday = new Date(semaineLundi + "T00:00:00");
  const printContainer = document.createElement("div");
  printContainer.id = "print-container";
  printContainer.appendChild(buildPrintHtml(monday));
  document.body.appendChild(printContainer);
  document.body.classList.add("printing-planning");

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-planning");
      printContainer.remove();
    }, 500);
  }, 100);
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
