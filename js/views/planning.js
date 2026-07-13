import {
  listStagiaires, listProfs, listThemes, getPlanning,
  upsertPlanningEntry, deletePlanningEntryById,
  getHalfMetaForWeek, upsertHalfMeta,
  getJoursOff, setJourOff, deleteJourOff,
  getSetting, setSetting,
  addPassagesBatch, deletePassagesBatch, getPassagesInRange, updateTheme,
  listBenevoles, listBenevolesNoms,
} from "../db.js?v=20260713m";
import { el, clear, isoDate, getMonday, addDays, formatDayShort, formatDate, debounce, toast, displayStagiaire, compareByNom } from "../utils.js?v=20260713m";
import { icon } from "../icons.js?v=20260713m";
import { ACTIVITES, ACTIVITY_SHAPES, JOURS, HALF_DAYS, RESULTATS } from "../config.js?v=20260713m";
import { isAdmin, getAdminEmail } from "../auth-admin.js?v=20260713m";
import { recordUndo } from "../undo.js?v=20260713m";
import { getCurrentWho } from "../identity.js?v=20260713m";
import { openBenevolesPanel } from "./benevoles.js?v=20260713m";

let stagiaires = [];
let profs = [];
let themes = [];
let benevoles = [];  // admin : lignes complètes + display ; sinon : {id, display} via RPC
let entries = [];
let halfMetas = [];  // [{semaine_lundi, day_index, half_day, start_time, end_time, pause_start, pause_minutes}]
let joursOff = [];   // [{day_index, label}] jours désactivés manuellement de la semaine affichée
let autresProfsMem = [];  // noms de formateurs « Autre » déjà saisis (mémorisés, réutilisables)
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

// === Jours fériés français (calculés, pas stockés) + jours désactivés manuellement ===

// Dimanche de Pâques (algorithme de Meeus/Butcher) → base des fériés mobiles.
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);   // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Map "AAAA-MM-JJ" -> libellé, pour une année. Fériés nationaux métropole.
const _holidayCache = {};
function frenchHolidays(year) {
  if (_holidayCache[year]) return _holidayCache[year];
  const map = {};
  const add = (dt, label) => { map[isoDate(dt)] = label; };
  add(new Date(year, 0, 1), "Jour de l'an");
  add(new Date(year, 4, 1), "Fête du Travail");
  add(new Date(year, 4, 8), "Victoire 1945");
  add(new Date(year, 6, 14), "Fête nationale");
  add(new Date(year, 7, 15), "Assomption");
  add(new Date(year, 10, 1), "Toussaint");
  add(new Date(year, 10, 11), "Armistice");
  add(new Date(year, 11, 25), "Noël");
  const easter = easterSunday(year);
  add(addDays(easter, 1), "Lundi de Pâques");
  add(addDays(easter, 39), "Ascension");
  add(addDays(easter, 50), "Lundi de Pentecôte");
  _holidayCache[year] = map;
  return map;
}

// État d'un jour : off (désactivé), son libellé, et s'il est manuel (donc réactivable en 1 clic)
// ou automatique (férié calculé — pas de ligne en base).
function dayOffInfo(dayIndex, monday) {
  const manual = joursOff.find((j) => j.day_index === dayIndex);
  if (manual) return { off: true, label: manual.label || "Désactivé", manual: true };
  const date = addDays(monday, dayIndex);
  const holiday = frenchHolidays(date.getFullYear())[isoDate(date)];
  if (holiday) return { off: true, label: holiday, manual: false, ferie: true };
  return { off: false };
}

// Raccourci : un jour de la semaine affichée est-il désactivé (manuel ou férié) ?
function dayIsOff(dayIndex) {
  if (!semaineLundi) return false;
  return dayOffInfo(dayIndex, new Date(semaineLundi + "T00:00:00")).off;
}

// === Mémoire des formateurs « Autre » (réutilisation) ===
// La colonne settings.value stocke du TEXTE : on (dé)sérialise la liste en JSON pour ne
// pas qu'un tableau s'y transforme en chaîne et soit itéré caractère par caractère
// (bug datalist « Autre » 2026-07-09).
function parseAutresProfs(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); if (Array.isArray(v)) return v.filter((x) => typeof x === "string"); } catch (e) { /* ignore */ }
  }
  return [];
}
function autresProfsSuggestions() {
  const set = new Set(Array.isArray(autresProfsMem) ? autresProfsMem : []);
  entries.forEach((e) => { if (e.prof_autre) set.add(e.prof_autre); });
  return [...set].sort((a, b) => a.localeCompare(b));
}
function rememberAutreProf(name) {
  if (!name || autresProfsMem.includes(name)) return;
  autresProfsMem = [...autresProfsMem, name].slice(-50);   // borne raisonnable
  setSetting("profs_autres", JSON.stringify(autresProfsMem)).catch(() => {});
}
function forgetAutreProf(name) {
  if (!autresProfsMem.includes(name)) return;
  autresProfsMem = autresProfsMem.filter((n) => n !== name);
  setSetting("profs_autres", JSON.stringify(autresProfsMem)).catch(() => {});
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

// Construit le payload d'upsert (clé de conflit = semaine,jour,demi-journée,slot,lane).
// La position (slot/lane) identifie la ligne en base : on ne la change jamais lors
// d'un échange — c'est le contenu qu'on permute (cf. swapEntries).
function entryUpsertPayload(entry) {
  return {
    semaine_lundi: semaineLundi,
    day_index: entry.day_index,
    half_day: entry.half_day,
    slot: entry.slot,
    lane: entry.lane ?? 0,
    activite: entry.activite ?? null,
    prof_id: entry.prof_ids && entry.prof_ids.length ? entry.prof_ids[0] : null,  // legacy compat (1er prof)
    prof_ids: entry.prof_ids ?? [],
    prof_autre: entry.prof_autre ?? null,        // formateur externe (nom libre)
    autonomie: entry.autonomie ?? false,          // groupe en autonomie (aucun formateur)
    sujet: entry.sujet ?? null,
    pedagogue_id: entry.pedagogue_id ?? null,
    eleves_ids: entry.eleves_ids ?? [],
    // Pédagogie salle 2e groupe (un seul créneau peut faire tourner 2 tableaux)
    pedagogue_id_2: entry.pedagogue_id_2 ?? null,
    eleves_ids_2: entry.eleves_ids_2 ?? [],
    salle_double: entry.salle_double ?? false,
    benevoles_ids: entry.benevoles_ids ?? [],
    notes: entry.notes ?? null,
  };
}

async function saveEntry(localId, patch) {
  // Garde d'accès : seuls les admins (formateurs) écrivent le planning. Backstop
  // si un contrôle d'édition fuit en lecture seule (la RLS bloque déjà côté serveur,
  // mais on évite ici la mutation locale optimiste + le toast d'erreur trompeur).
  if (!isAdmin()) return;
  const entry = entries.find((e) => e._lid === localId);
  if (!entry) return;
  Object.assign(entry, patch);

  // Garde le DOM d'impression caché en phase avec CHAQUE édition en place. Beaucoup
  // d'éditions (sujet, élèves, profs, note, activité) ne passent pas par renderInto,
  // et iOS Safari ne déclenche pas `beforeprint` : sans ça, un Partage→Imprimer après
  // une saisie imprimerait un planning périmé. No-op hors planning.
  syncPrintTargetIfMounted();

  const payload = entryUpsertPayload(entry);

  // Track la promesse pour que flushPendingInputs puisse l'attendre avant un re-render
  const p = (async () => {
    try {
      await upsertPlanningEntry(payload);
      const cellEl = document.querySelector(`[data-lid="${localId}"]`);
      if (cellEl) cellEl.dataset.activite = payload.activite || "";
      if (patch.activite !== undefined && cellEl) {
        const newCell = renderLaneCell(entry);
        // Conserve le positionnement en grille, sinon la cellule retombe en colonne 1
        // (auto-placement) et chevauche les lanes parallèles jusqu'au prochain re-render.
        newCell.style.gridColumn = String((entry.lane ?? 0) + 1);
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

// === Échange de deux cartes (drag & drop) ===
// On permute le CONTENU des deux cartes (pas leur position en base) : les lignes
// gardent leur (slot, lane), donc aucun conflit avec la contrainte d'unicité, et on
// réutilise l'upsert existant. Visuellement = un déplacement. Undo via Ctrl+Z.
const SWAP_FIELDS = ["activite", "prof_ids", "prof_id", "prof_autre", "autonomie", "sujet", "pedagogue_id", "eleves_ids", "pedagogue_id_2", "eleves_ids_2", "salle_double", "benevoles_ids", "notes"];

function snapshotFields(entry) {
  const o = {};
  SWAP_FIELDS.forEach((f) => { o[f] = entry[f]; });
  return o;
}

async function swapEntries(lidA, lidB, opts = {}) {
  await flushPendingInputs();
  const a = entries.find((e) => e._lid === lidA);
  const b = entries.find((e) => e._lid === lidB);
  if (!a || !b || a === b) return;

  const beforeA = snapshotFields(a);
  const beforeB = snapshotFields(b);
  // Permute le contenu en mémoire
  SWAP_FIELDS.forEach((f) => { const t = a[f]; a[f] = b[f]; b[f] = t; });

  const persistBoth = () => Promise.all([
    upsertPlanningEntry(entryUpsertPayload(a)),
    upsertPlanningEntry(entryUpsertPayload(b)),
  ]);

  try {
    await persistBoth();
    renderInto(currentContainer);
    toast(opts.toast || "Cartes échangées · Ctrl+Z pour annuler", "success", 2000);
    recordUndo(opts.undoLabel || "échange de cartes", async () => {
      Object.assign(a, beforeA);
      Object.assign(b, beforeB);
      await persistBoth();
      renderInto(currentContainer);
    });
  } catch (e) {
    console.error(e);
    // Revert mémoire si l'enregistrement échoue
    Object.assign(a, beforeA);
    Object.assign(b, beforeB);
    renderInto(currentContainer);
    toast("Erreur lors de l'échange", "error");
  }
}

// Confirmation (friction) avant un déplacement vers une AUTRE demi-journée / un autre
// jour, pour éviter les déplacements par inadvertance. Retourne true si on continue.
function confirmCrossMove(sourceLid, targetLid) {
  const src = entries.find((e) => e._lid === sourceLid);
  const tgt = entries.find((e) => e._lid === targetLid);
  if (!src || !tgt) return false;
  const jour = (JOURS[tgt.day_index] || "").toLowerCase();
  const demi = tgt.half_day === "matin" ? "matin" : "après-midi";
  const srcLabel = src.activite || "cette carte";
  return tgt.activite
    ? confirm(`Échanger « ${srcLabel} » avec « ${tgt.activite} » (${jour} ${demi}) ?`)
    : confirm(`Déplacer « ${srcLabel} » vers ${jour} ${demi} ?`);
}

// --- Contrôleur de glisser-déposer (Pointer Events, souris + tactile) ---
// Glisser depuis la poignée d'une carte ; lâcher sur une autre carte => échange.
// Même demi-journée : direct. Autre demi-journée / autre jour : confirmation (friction),
// cible surlignée en ambre « Déplacer ici ». Hors d'une cible => annulé.
let dragState = null;

function beginCardDrag(ev, sourceLid, sourceCell) {
  if (!isAdmin()) return;
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  ev.preventDefault();
  const handleEl = ev.currentTarget;
  dragState = {
    sourceLid, sourceCell,
    sourceHalf: sourceCell.closest(".p-half"),
    handleEl,
    pointerId: ev.pointerId,
    startX: ev.clientX, startY: ev.clientY,
    lastX: ev.clientX, lastY: ev.clientY,
    grabDX: 0, grabDY: 0,
    active: false, ghost: null, target: null, scrollTimer: null,
  };
  try { handleEl.setPointerCapture(ev.pointerId); } catch (_) {}
  handleEl.addEventListener("pointermove", onDragMove);
  handleEl.addEventListener("pointerup", onDragEnd);
  handleEl.addEventListener("pointercancel", onDragEnd);
}

function activateDrag() {
  const s = dragState;
  s.active = true;
  document.body.classList.add("p-dragging-active");
  s.sourceCell.classList.add("p-drag-source");
  const rect = s.sourceCell.getBoundingClientRect();
  s.grabDX = s.lastX - rect.left;
  s.grabDY = s.lastY - rect.top;
  const ghost = s.sourceCell.cloneNode(true);
  ghost.classList.add("p-drag-ghost");
  ghost.style.width = rect.width + "px";
  positionGhost();
  document.body.appendChild(ghost);
  s.ghost = ghost;
  // Autoscroll quand le doigt approche du haut/bas de l'écran
  s.scrollTimer = setInterval(() => {
    if (!dragState || !dragState.active) return;
    const y = dragState.lastY, edge = 72, step = 14;
    if (y < edge) window.scrollBy(0, -step);
    else if (y > window.innerHeight - edge) window.scrollBy(0, step);
    updateDropTarget();
  }, 16);
}

function positionGhost() {
  const s = dragState;
  if (!s.ghost) return;
  s.ghost.style.left = (s.lastX - s.grabDX) + "px";
  s.ghost.style.top = (s.lastY - s.grabDY) + "px";
}

function updateDropTarget() {
  const s = dragState;
  if (!s) return;
  const under = document.elementFromPoint(s.lastX, s.lastY);
  let cell = under ? under.closest(".p-lane-cell") : null;
  if (cell === s.sourceCell) cell = null;  // pas soi-même
  if (cell !== s.target) {
    if (s.target) s.target.classList.remove("p-drop-target", "cross");
    s.target = cell;
    if (cell) {
      cell.classList.add("p-drop-target");
      // Cible dans une autre demi-journée / un autre jour => style « déplacer »
      if (cell.closest(".p-half") !== s.sourceHalf) cell.classList.add("cross");
    }
  }
}

function onDragMove(ev) {
  const s = dragState;
  if (!s) return;
  s.lastX = ev.clientX;
  s.lastY = ev.clientY;
  if (!s.active) {
    if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < 6) return;
    activateDrag();
  }
  ev.preventDefault();
  positionGhost();
  updateDropTarget();
}

function onDragEnd() {
  const s = dragState;
  if (!s) return;
  const target = s.target;
  const sourceLid = s.sourceLid;
  const sourceHalf = s.sourceHalf;
  cleanupDrag();
  if (!target) return;
  const targetLid = target.dataset.lid;
  if (!targetLid || targetLid === sourceLid) return;
  const crossHalf = target.closest(".p-half") !== sourceHalf;
  if (crossHalf) {
    // Friction : confirmation avant un déplacement vers une autre demi-journée / jour
    if (!confirmCrossMove(sourceLid, targetLid)) return;
    swapEntries(sourceLid, targetLid, {
      toast: "Carte déplacée · Ctrl+Z pour annuler",
      undoLabel: "déplacement de carte",
    });
  } else {
    swapEntries(sourceLid, targetLid);
  }
}

function cleanupDrag() {
  const s = dragState;
  if (!s) return;
  if (s.scrollTimer) clearInterval(s.scrollTimer);
  if (s.ghost) s.ghost.remove();
  if (s.target) s.target.classList.remove("p-drop-target");
  s.sourceCell.classList.remove("p-drag-source");
  document.body.classList.remove("p-dragging-active");
  try { s.handleEl.releasePointerCapture(s.pointerId); } catch (_) {}
  s.handleEl.removeEventListener("pointermove", onDragMove);
  s.handleEl.removeEventListener("pointerup", onDragEnd);
  s.handleEl.removeEventListener("pointercancel", onDragEnd);
  dragState = null;
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

/**
 * Compte, pour la semaine courante, le nb d'apparitions de chaque stagiaire dans un rôle
 * d'une activité, en excluant un créneau (celui qu'on remplit). role = "pedagogue" | "eleve".
 * Sert à prioriser ceux qui sont passés le moins de fois dans ce rôle cette semaine.
 */
function roleCounts(activite, role, exceptLid) {
  const counts = {};
  const bump = (id) => { if (id != null) counts[id] = (counts[id] || 0) + 1; };
  entries.forEach((e) => {
    if (e.activite !== activite) return;
    if (e._lid === exceptLid) return;
    if (role === "pedagogue") {
      bump(e.pedagogue_id);
      if (e.salle_double) bump(e.pedagogue_id_2);   // 2e tableau seulement si 2 groupes actifs
    } else {
      (e.eleves_ids || []).forEach(bump);
      if (e.salle_double) (e.eleves_ids_2 || []).forEach(bump);  // 2e groupe seulement si actif
    }
  });
  return counts;
}

// Rôles EFFECTIFS d'un créneau selon la FORME de son activité (ACTIVITY_SHAPES).
// Quand on change l'activité d'un créneau, la donnée des rôles (tableau/élèves) reste
// stockée — pratique si on rebascule l'activité — mais un rôle absent de la forme courante
// (ex. élèves restés sur un Cours, ou « au tableau » resté sur une Voiture) ne doit JAMAIS
// être affiché ni utilisé. Source unique de vérité, utilisée par l'impression et le blocage
// de créneau (la validation et les compteurs filtrent déjà par activité).
function entryShape(e) { return ACTIVITY_SHAPES[e.activite || ""] || ACTIVITY_SHAPES[""]; }
function effPedagogueId(e, group = 1) {
  if (!entryShape(e).includes("pedagogue")) return null;
  if (group === 2) return e.salle_double ? (e.pedagogue_id_2 ?? null) : null;
  return e.pedagogue_id ?? null;
}
function effElevesIds(e, group = 1) {
  if (!entryShape(e).includes("eleves")) return [];
  if (group === 2) return e.salle_double ? (e.eleves_ids_2 || []) : [];
  return e.eleves_ids || [];
}
function effBenevolesIds(e) {
  if (!entryShape(e).includes("benevoles")) return [];
  return e.benevoles_ids || [];
}

// Bénévoles déjà placés sur une AUTRE carte du même créneau (cartes parallèles =
// simultanées : pas deux voitures à la fois). Les slots successifs restent permis :
// un bénévole reste souvent toute la demi-journée et change d'élève moniteur.
function benevoleSlotOccupants(entry) {
  const ids = new Set();
  entries.forEach((e) => {
    if (e.day_index !== entry.day_index || e.half_day !== entry.half_day || e.slot !== entry.slot) return;
    if (e._lid === entry._lid) return;
    effBenevolesIds(e).forEach((id) => ids.add(id));
  });
  return ids;
}

// Dispo récurrente du bénévole sur le jour + demi-journée d'une carte.
function isBenevoleDispo(b, entry) {
  return (b.dispos?.[JOURS[entry.day_index]] || []).includes(entry.half_day);
}

// Ids des stagiaires déjà placés dans le MÊME créneau et VRAIMENT en même temps que le champ
// qu'on remplit. Les 2 groupes d'une carte salle sont SÉQUENTIELS (l'un après l'autre) : sur
// la carte courante, seul l'AUTRE rôle du MÊME groupe bloque (tableau ≠ ses élèves). Donc une
// personne peut être élève au groupe 1 puis tableau / élève au groupe 2. Les AUTRES cartes du
// créneau (voiture, etc.) sont simultanées => elles bloquent en entier (2 groupes compris).
// exceptField ∈ "pedagogue" | "eleves" | "pedagogue_2" | "eleves_2"
const SAME_GROUP_BLOCK = {
  pedagogue:   "eleves_ids",
  eleves:      "pedagogue_id",
  pedagogue_2: "eleves_ids_2",
  eleves_2:    "pedagogue_id_2",
};
const ACT_VOITURE = "Voiture (conduite)";
function slotOccupants(entry, exceptField) {
  const ids = new Set();
  const add = (v) => { if (Array.isArray(v)) v.forEach((id) => ids.add(id)); else if (v != null) ids.add(v); };
  // Une Voiture (conduite) s'étale sur TOUTE la demi-journée (la conduite tourne en continu).
  // Donc deux cartes d'une même demi-journée, même sur des créneaux différents, se
  // chevauchent dès que l'une des deux est une voiture → on bloque la personne (règle
  // 2026-07-10 : élève voiture = occupé toute la demi-journée, ne peut pas être aussi en salle).
  const entryIsVoiture = entry.activite === ACT_VOITURE;
  entries.forEach((e) => {
    if (e.day_index !== entry.day_index || e.half_day !== entry.half_day) return;  // même demi-journée
    if (e._lid === entry._lid) {
      add(e[SAME_GROUP_BLOCK[exceptField]]);  // même carte : même groupe, l'autre rôle uniquement
      return;
    }
    // Bloque si simultané : même créneau, OU l'une des deux cartes est une voiture (chevauche
    // toute la demi-journée). On bloque ses rôles EFFECTIFS (selon sa forme), pour ignorer une
    // donnée périmée laissée par un changement d'activité.
    if (e.slot === entry.slot || entryIsVoiture || e.activite === ACT_VOITURE) {
      add(effPedagogueId(e, 1));
      add(effElevesIds(e, 1));
      add(effPedagogueId(e, 2));
      add(effElevesIds(e, 2));
    }
  });
  return ids;
}

// Élèves salle (groupe 1 ou 2) : priorise les moins passés, SANS plafond bloquant (re-placement
// possible en fin de semaine). Exclut quiconque est déjà sur le même créneau (l'autre groupe, le
// tableau, une carte parallèle). Comptage indépendant entre tableau et élève sur les AUTRES créneaux.
async function randomFillEleves(lid, group = 1) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;

  const field = group === 2 ? "eleves_ids_2" : "eleves_ids";
  const eleveCount = roleCounts("Pédagogie salle", "eleve", lid);
  const blocked = slotOccupants(entry, group === 2 ? "eleves_2" : "eleves");
  const eligible = stagiaires.filter((s) => !blocked.has(s.id));
  if (eligible.length === 0) {
    toast("Aucun stagiaire disponible sur ce créneau", "info", 3000);
    return;
  }
  // Mélange puis tri stable par nb de passages croissant => priorité aux moins servis
  const ordered = shuffle(eligible).sort((a, b) => (eleveCount[a.id] || 0) - (eleveCount[b.id] || 0));
  const picked = ordered.slice(0, 4).map((s) => s.id);

  toast(picked.length < 4
    ? `${picked.length} élève(s) tiré(s) · priorité aux moins passés`
    : "4 élèves tirés · priorité aux moins passés", "success", 1600);
  await saveEntry(lid, { [field]: picked });
  renderInto(currentContainer);
}

// Au tableau (groupe 1 ou 2) : le plus rigoureux (toujours le moins passé au tableau). Exclut
// quiconque est déjà sur le même créneau (élèves, autre tableau, carte parallèle).
async function randomFillPedagogue(lid, group = 1) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;

  const field = group === 2 ? "pedagogue_id_2" : "pedagogue_id";
  const pedaCount = roleCounts("Pédagogie salle", "pedagogue", lid);
  const blocked = slotOccupants(entry, group === 2 ? "pedagogue_2" : "pedagogue");
  const eligible = stagiaires.filter((s) => !blocked.has(s.id));
  if (eligible.length === 0) {
    toast("Aucun stagiaire disponible sur ce créneau", "info", 3000);
    return;
  }
  const ordered = shuffle(eligible).sort((a, b) => (pedaCount[a.id] || 0) - (pedaCount[b.id] || 0));
  const picked = ordered[0];
  await saveEntry(lid, { [field]: picked.id });
  renderInto(currentContainer);
  toast(displayStagiaire(picked) + " désigné(e) au tableau", "success", 1800);
}

// Voiture : priorise les moins passés en voiture, sans plafond. Exclut quiconque est déjà
// sur le même créneau (carte parallèle, ex. salle) — pas deux endroits à la fois.
async function randomFillVoitureEleves(lid, count) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;

  const voitCount = roleCounts("Voiture (conduite)", "eleve", lid);
  const blocked = slotOccupants(entry, "eleves");
  const eligible = stagiaires.filter((s) => !blocked.has(s.id));
  if (eligible.length === 0) {
    toast("Aucun stagiaire disponible sur ce créneau", "info", 3000);
    return;
  }
  const ordered = shuffle(eligible).sort((a, b) => (voitCount[a.id] || 0) - (voitCount[b.id] || 0));
  const picked = ordered.slice(0, count).map((s) => s.id);

  toast(picked.length < count
    ? `${picked.length} élève(s) en voiture tiré(s) · priorité aux moins passés`
    : `${count} élève(s) en voiture tiré(s) · priorité aux moins passés`, "success", 1600);
  await saveEntry(lid, { eleves_ids: picked });
  renderInto(currentContainer);
}

// === Placement automatique de toute la semaine ===
// Remplit tableaux (1/groupe) + élèves (salle : 4/groupe, voiture : 2) selon la priorité
// « moins passés », équilibré sur la semaine, anti-doublon par créneau, abandons ignorés.
// Profs / sujets / notes ne sont JAMAIS touchés. Deux temps : tant qu'il reste des places
// vides on ne remplit QUE les vides (respecte le manuel) ; quand tout est placé, un clic
// propose de tout remélanger (re-tirage complet, avec confirmation). Undo via Ctrl+Z.
function snapshotPlacement(e) {
  return {
    pedagogue_id: e.pedagogue_id ?? null,
    eleves_ids: [...(e.eleves_ids || [])],
    pedagogue_id_2: e.pedagogue_id_2 ?? null,
    eleves_ids_2: [...(e.eleves_ids_2 || [])],
  };
}

function placementEmpties(e) {
  const out = [];
  if (e.activite === "Pédagogie salle") {
    if (e.pedagogue_id == null) out.push("t1");
    if (!(e.eleves_ids && e.eleves_ids.length)) out.push("e1");
    if (e.salle_double) {
      if (e.pedagogue_id_2 == null) out.push("t2");
      if (!(e.eleves_ids_2 && e.eleves_ids_2.length)) out.push("e2");
    }
  } else if (e.activite === "Voiture (conduite)") {
    if (!(e.eleves_ids && e.eleves_ids.length)) out.push("v");
  }
  return out;
}

async function autoPlaceWeek() {
  await flushPendingInputs();
  const targets = entries.filter((e) =>
    (e.activite === "Pédagogie salle" || e.activite === "Voiture (conduite)")
    && !dayIsOff(e.day_index));   // ne place rien sur un jour désactivé/férié
  if (targets.length === 0) {
    toast("Aucune Pédagogie salle ni Voiture à placer cette semaine", "info", 3500);
    return;
  }

  const reroll = !targets.some((e) => placementEmpties(e).length > 0);
  if (reroll && !confirm("Toute la semaine est déjà placée.\n\nTout remélanger (tableaux + élèves) ? Tes ajustements manuels seront écrasés.")) return;

  const before = targets.map((e) => ({ e, snap: snapshotPlacement(e) }));

  // Compteurs par rôle (équité). En remélange on repart de zéro ; en remplissage on amorce
  // avec l'existant pour équilibrer autour des places déjà occupées.
  const tab = {}, salleEl = {}, voit = {};
  const bump = (m, id) => { if (id != null) m[id] = (m[id] || 0) + 1; };

  if (reroll) {
    targets.forEach((e) => { e.pedagogue_id = null; e.eleves_ids = []; e.pedagogue_id_2 = null; e.eleves_ids_2 = []; });
  } else {
    targets.forEach((e) => {
      if (e.activite === "Pédagogie salle") {
        bump(tab, e.pedagogue_id); (e.eleves_ids || []).forEach((id) => bump(salleEl, id));
        if (e.salle_double) { bump(tab, e.pedagogue_id_2); (e.eleves_ids_2 || []).forEach((id) => bump(salleEl, id)); }
      } else {
        (e.eleves_ids || []).forEach((id) => bump(voit, id));
      }
    });
  }

  const halfRank = (h) => (h === "matin" ? 0 : 1);
  const ordered = targets.slice().sort((a, b) =>
    a.day_index - b.day_index ||
    halfRank(a.half_day) - halfRank(b.half_day) ||
    a.slot - b.slot ||
    (a.lane ?? 0) - (b.lane ?? 0));

  const pickLeast = (countMap, blocked, n) =>
    shuffle(stagiaires.filter((s) => !blocked.has(s.id)))
      .sort((a, b) => (countMap[a.id] || 0) - (countMap[b.id] || 0))
      .slice(0, n).map((s) => s.id);

  let unfilled = 0;
  for (const e of ordered) {
    if (e.activite === "Pédagogie salle") {
      for (const g of (e.salle_double ? [1, 2] : [1])) {
        const pField = g === 2 ? "pedagogue_id_2" : "pedagogue_id";
        const eField = g === 2 ? "eleves_ids_2" : "eleves_ids";
        if (e[pField] == null) {  // tableau vide => 1 personne (la moins passée au tableau)
          const pick = pickLeast(tab, slotOccupants(e, g === 2 ? "pedagogue_2" : "pedagogue"), 1)[0];
          if (pick != null) { e[pField] = pick; bump(tab, pick); } else unfilled++;
        }
        if (!(e[eField] && e[eField].length)) {  // élèves vides => 4
          const pick = pickLeast(salleEl, slotOccupants(e, g === 2 ? "eleves_2" : "eleves"), 4);
          e[eField] = pick; pick.forEach((id) => bump(salleEl, id));
          unfilled += 4 - pick.length;
        }
      }
    } else if (!(e.eleves_ids && e.eleves_ids.length)) {  // Voiture, élèves vides => 2
      const pick = pickLeast(voit, slotOccupants(e, "eleves"), 2);
      e.eleves_ids = pick; pick.forEach((id) => bump(voit, id));
      unfilled += 2 - pick.length;
    }
  }

  // N'enregistre que les cartes réellement modifiées
  const changed = before.filter(({ e, snap }) =>
    e.pedagogue_id !== snap.pedagogue_id ||
    e.pedagogue_id_2 !== snap.pedagogue_id_2 ||
    JSON.stringify(e.eleves_ids || []) !== JSON.stringify(snap.eleves_ids) ||
    JSON.stringify(e.eleves_ids_2 || []) !== JSON.stringify(snap.eleves_ids_2)
  ).map((x) => x.e);

  try {
    await Promise.all(changed.map((e) => upsertPlanningEntry(entryUpsertPayload(e))));
    renderInto(currentContainer);
    toast(`Semaine placée${unfilled ? ` · ${unfilled} place(s) non remplie(s)` : ""} · Ctrl+Z pour annuler`, "success", 3000);
    recordUndo("placement auto de la semaine", async () => {
      before.forEach(({ e, snap }) => Object.assign(e, snap));
      await Promise.all(changed.map((e) => upsertPlanningEntry(entryUpsertPayload(e))));
      renderInto(currentContainer);
    });
  } catch (err) {
    console.error(err);
    before.forEach(({ e, snap }) => Object.assign(e, snap));
    renderInto(currentContainer);
    toast("Erreur lors du placement", "error");
  }
}

async function deleteCell(entry) {
  if (!isAdmin()) return;  // garde d'accès : suppression réservée aux admins (formateurs)
  // Commit les saisies en cours avant le re-render complet (sinon une note/sujet en attente est perdu)
  await flushPendingInputs();
  // Une demi-journée peut rester vide : on autorise la suppression de n'importe quelle activité.
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
// Multi-select formateur : profs réels (table profs) + « Autre » (nom libre, mémorisé pour
// réutilisation) + « Groupe (autonomie) » (le groupe bosse seul, aucun formateur).
// Écrit directement dans l'entry via saveEntry (prof_ids / prof_autre / autonomie).
function profChipsSelect(allProfs, entry, lid) {
  const wrap = el("div", { class: "p-prof-multi" });
  const display = el("div", { class: "p-prof-display", tabindex: "0" });
  const dropdown = el("div", { class: "p-prof-dropdown hidden" });
  let selected = [...(entry.prof_ids || [])];

  const chipX = (onClick) => el("span", { class: "p-prof-x", onClick: (ev) => { ev.stopPropagation(); onClick(); } }, "×");

  function render() {
    clear(display);
    const hasAny = selected.length > 0 || entry.prof_autre || entry.autonomie;
    if (!hasAny) {
      display.appendChild(el("span", { class: "p-prof-placeholder" }, "Formateur…"));
    } else {
      selected.forEach((id) => {
        const p = allProfs.find((x) => x.id === id);
        if (!p) return;
        display.appendChild(el("span", { class: "p-prof-chip" }, p.nom, chipX(() => {
          selected = selected.filter((x) => x !== id);
          saveEntry(lid, { prof_ids: [...selected] });
          render();
        })));
      });
      if (entry.prof_autre) {
        display.appendChild(el("span", { class: "p-prof-chip autre" }, entry.prof_autre, chipX(() => {
          saveEntry(lid, { prof_autre: null });
          render();
        })));
      }
      if (entry.autonomie) {
        display.appendChild(el("span", { class: "p-prof-chip autonomie" }, "Groupe (autonomie)", chipX(() => {
          saveEntry(lid, { autonomie: false });
          render();
        })));
      }
    }

    clear(dropdown);
    allProfs.forEach((p) => {
      dropdown.appendChild(el("div", {
        class: "p-prof-dropdown-item" + (selected.includes(p.id) ? " selected" : ""),
        onClick: (ev) => {
          ev.stopPropagation();
          if (selected.includes(p.id)) selected = selected.filter((x) => x !== p.id);
          else selected = [...selected, p.id];
          saveEntry(lid, { prof_ids: [...selected] });
          render();
        },
      }, p.nom));
    });
    dropdown.appendChild(el("div", { class: "p-prof-dropdown-sep" }));
    // « Groupe (autonomie) »
    dropdown.appendChild(el("div", {
      class: "p-prof-dropdown-item special" + (entry.autonomie ? " selected" : ""),
      onClick: (ev) => {
        ev.stopPropagation();
        saveEntry(lid, { autonomie: !entry.autonomie });
        render();
      },
    }, "Groupe (autonomie)"));
    // « Autre » : champ nom libre
    const nameInput = el("input", {
      type: "text", class: "p-prof-autre-input", placeholder: "Autre formateur — nom…",
      autocomplete: "off", autocorrect: "off", autocapitalize: "words", spellcheck: "false",
    });
    const commitAutre = (v) => {
      const name = (v ?? nameInput.value).trim();
      if (!name) return;
      saveEntry(lid, { prof_autre: name });
      rememberAutreProf(name);
      nameInput.value = "";
      render();
    };
    nameInput.addEventListener("click", (e) => e.stopPropagation());
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitAutre(); }
    });
    const okBtn = el("button", { class: "p-prof-autre-ok", type: "button",
      onClick: (ev) => { ev.stopPropagation(); commitAutre(); } }, "+");
    dropdown.appendChild(el("div", { class: "p-prof-autre-row" }, nameInput, okBtn));

    // Noms déjà utilisés : clic = réutiliser, × = oublier (retire de la mémoire).
    const suggs = autresProfsSuggestions();
    if (suggs.length) {
      const sw = el("div", { class: "p-prof-autre-sugg" });
      suggs.forEach((n) => {
        const tag = el("span", { class: "p-prof-autre-tag" });
        tag.appendChild(el("span", { class: "p-prof-autre-tag-name",
          onClick: (ev) => { ev.stopPropagation(); commitAutre(n); } }, n));
        tag.appendChild(el("span", { class: "p-prof-autre-tag-x", title: "Oublier ce nom",
          onClick: (ev) => { ev.stopPropagation(); forgetAutreProf(n); render(); } }, "×"));
        sw.appendChild(tag);
      });
      dropdown.appendChild(sw);
    }
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

// Badge « nb de fois déjà placé(e) cette semaine dans ce rôle AU PLANNING » (0 = prioritaire).
// NB : c'est le PLAN, pas un passage enregistré — les passages ne se comptent qu'à « Valider
// la semaine ». Sert juste à équilibrer les placements de la semaine en cours.
function prioBadge(n) {
  return el("span", { class: "prio-count" + (n === 0 ? " zero" : ""), title: "déjà placé(e) cette semaine au planning (≠ passage validé)" }, String(n));
}
// Légende affichée en tête des menus de sélection de personne.
function prioLegend() {
  return el("div", { class: "prio-legend" }, "Déjà placé(e) cette semaine au planning · 0 = à prioriser");
}

// Sélecteur d'UNE personne (tableau) : même habillage que les chips élèves / profs, trié par
// priorité (moins passés en tête) avec compteur. counts (optionnel) = map id -> nb de passages.
function personSelect(allStagiaires, currentId, onChange, counts, placeholder = "—") {
  const wrap = el("div", { class: "person-select" });
  const display = el("div", { class: "person-display", tabindex: "0" });
  const dropdown = el("div", { class: "chips-dropdown person-dropdown hidden" });
  let value = currentId ?? null;

  const close = () => { dropdown.classList.add("hidden"); display.classList.remove("open"); };

  function render() {
    clear(display);
    const s = value != null ? allStagiaires.find((x) => x.id === value) : null;
    display.appendChild(s
      ? el("span", { class: "person-value" }, displayStagiaire(s))
      : el("span", { class: "person-placeholder" }, placeholder));

    clear(dropdown);
    if (counts) dropdown.appendChild(prioLegend());
    const none = el("div", { class: "person-item" + (value == null ? " selected" : "") },
      el("span", { class: "person-item-name person-none" }, placeholder));
    none.addEventListener("click", (ev) => { ev.stopPropagation(); value = null; onChange(null); render(); close(); });
    dropdown.appendChild(none);
    const ordered = counts ? allStagiaires.slice().sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0)) : allStagiaires;
    ordered.forEach((s) => {
      const item = el("div", { class: "person-item" + (value === s.id ? " selected" : "") },
        el("span", { class: "person-item-name" }, displayStagiaire(s)));
      if (counts) item.appendChild(prioBadge(counts[s.id] || 0));
      item.addEventListener("click", (ev) => { ev.stopPropagation(); value = s.id; onChange(s.id); render(); close(); });
      dropdown.appendChild(item);
    });
  }

  display.addEventListener("click", () => { dropdown.classList.toggle("hidden"); display.classList.toggle("open"); });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });

  wrap.appendChild(display);
  wrap.appendChild(dropdown);
  render();
  return wrap;
}

// counts (optionnel) : map id -> nb de passages dans le rôle cette semaine. Si fourni, le
// menu est trié par priorité (moins passés en tête) et affiche le compteur à côté de chaque nom.
// opts (optionnel) : { labelFn, placeholder, itemBadge } pour réutiliser le composant avec
// d'autres listes que les stagiaires (ex. bénévoles : badge « dispo » à la place du compteur).
function chipsSelect(allStagiaires, currentIds, onChange, counts, opts = {}) {
  const { labelFn = displayStagiaire, placeholder = "Élèves…", itemBadge = null } = opts;
  const wrap = el("div", { class: "chips-select" });
  const display = el("div", { class: "chips-display", tabindex: "0" });
  const dropdown = el("div", { class: "chips-dropdown hidden" });
  let selected = [...(currentIds || [])];

  function render() {
    clear(display);
    if (selected.length === 0) {
      display.appendChild(el("span", { class: "chips-placeholder" }, placeholder));
    } else {
      selected.forEach((id) => {
        const s = allStagiaires.find((x) => x.id === id);
        if (!s) return;
        display.appendChild(el("span", { class: "chip" },
          labelFn(s),
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
    if (counts) dropdown.appendChild(prioLegend());
    // Tri par priorité (moins passés en tête) si on a les compteurs
    const ordered = counts
      ? allStagiaires.slice().sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))
      : allStagiaires;
    ordered.forEach((s) => {
      const item = el("div", {
        class: "chips-dropdown-item" + (selected.includes(s.id) ? " selected" : ""),
        onClick: (ev) => {
          ev.stopPropagation();
          if (selected.includes(s.id)) selected = selected.filter((x) => x !== s.id);
          else selected = [...selected, s.id];
          render();
          onChange([...selected]);
        }
      }, labelFn(s));
      if (counts) item.appendChild(prioBadge(counts[s.id] || 0));
      if (itemBadge) { const badge = itemBadge(s); if (badge) item.appendChild(badge); }
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
    // NE PAS clear(chipsBox) : ça détacherait l'input du DOM, ce qui lui fait perdre
    // le focus → le dropdown se ferme et l'autocomplétion « ne marche plus » après
    // l'ajout d'un thème (bug 2026-07-09). On retire uniquement les chips existantes
    // et on insère les nouvelles AVANT l'input, qui reste en place et gardé focus.
    chipsBox.querySelectorAll(".sujet-chip").forEach((c) => c.remove());
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
      chipsBox.insertBefore(chip, input);
    });
    input.placeholder = selected.length === 0 ? "Sujet / thème…" : "+";
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

  chipsBox.appendChild(input);   // l'input reste dans le DOM en permanence (jamais détaché)
  wrap.appendChild(chipsBox);
  wrap.appendChild(dropdown);
  renderChips();
  return wrap;
}

// === Rendu d'une cellule (un lane d'un slot) ===

// Bloc « Au tableau » d'un groupe (1 ou 2) d'une carte Pédagogie salle.
function buildTableauRole(entry, lid, group) {
  const field = group === 2 ? "pedagogue_id_2" : "pedagogue_id";
  const exceptField = group === 2 ? "pedagogue_2" : "pedagogue";
  const currentVal = entry[field] ?? null;
  const pedaRole = el("div", { class: "p-lane-role pedagogue" });
  pedaRole.appendChild(el("span", { class: "p-lane-role-label" }, "Au tableau"));
  // Filtre + sélecteur trié par priorité (personSelect gère le tri et le compteur).
  const blocked = slotOccupants(entry, exceptField);
  const counts = roleCounts("Pédagogie salle", "pedagogue", lid);
  const options = stagiaires.filter((s) => !blocked.has(s.id) || s.id === currentVal);
  pedaRole.appendChild(personSelect(
    options, currentVal, (id) => saveEntry(lid, { [field]: id }), counts, "—"
  ));
  pedaRole.appendChild(el("button", {
    class: "p-dice-btn", type: "button",
    title: "Tirer 1 stagiaire au tableau (le moins passé cette semaine)",
    onClick: () => randomFillPedagogue(lid, group),
  }, "🎲"));
  return pedaRole;
}

// Bloc « Élèves » d'un groupe (1 ou 2) d'une carte Pédagogie salle.
function buildElevesRoleSalle(entry, lid, group) {
  const field = group === 2 ? "eleves_ids_2" : "eleves_ids";
  const exceptField = group === 2 ? "eleves_2" : "eleves";
  const current = entry[field] || [];
  const eleveRole = el("div", { class: "p-lane-role eleves" });
  eleveRole.appendChild(el("span", { class: "p-lane-role-label" }, "Élèves"));
  const eleveCol = el("div", { class: "p-lane-eleves-col" });
  const blocked = slotOccupants(entry, exceptField);
  const counts = roleCounts("Pédagogie salle", "eleve", lid);
  const options = stagiaires.filter((s) => !blocked.has(s.id) || current.includes(s.id));
  eleveCol.appendChild(chipsSelect(options, current, (ids) => saveEntry(lid, { [field]: ids }), counts));
  eleveCol.appendChild(el("div", { class: "p-eleves-dice-toolbar" },
    el("button", {
      class: "p-dice-btn", type: "button",
      "aria-label": "Tirer 4 élèves au hasard", title: "Tirer 4 élèves (priorité aux moins passés)",
      onClick: () => randomFillEleves(lid, group),
    }, "🎲")
  ));
  eleveRole.appendChild(eleveCol);
  return eleveRole;
}

function renderLaneCell(entry) {
  const lid = entry._lid;
  const cell = el("div", {
    class: "p-lane-cell",
    dataset: { lid, activite: entry.activite || "" }
  });

  const shape = ACTIVITY_SHAPES[entry.activite || ""] || ACTIVITY_SHAPES[""];

  // === Header strip : poignée + activité + prof + delete ===
  const header = el("div", { class: "p-lane-header" });
  // Poignée de glisse (échange de cartes par drag & drop) — masquée en lecture seule via CSS
  const dragHandle = el("button", {
    class: "p-lane-drag", type: "button",
    "aria-label": "Glisser pour échanger avec une autre carte",
    title: "Glisser pour échanger avec une autre carte de la demi-journée",
  });
  dragHandle.appendChild(icon.grip());
  dragHandle.addEventListener("pointerdown", (ev) => beginCardDrag(ev, lid, cell));
  header.appendChild(dragHandle);
  header.appendChild(el("div", { class: "p-lane-activite-wrap" },
    selectFromList(
      ACTIVITES.map((a) => ({ value: a, label: a })),
      entry.activite,
      (v) => {
        // Passer à Pédagogie salle => 2 groupes par défaut (cas le plus courant)
        const patch = { activite: v };
        if (v === "Pédagogie salle" && entry.activite !== "Pédagogie salle") patch.salle_double = true;
        saveEntry(lid, patch);
      },
      "Choisir activité…"
    )
  ));
  if (shape.includes("prof")) {
    header.appendChild(el("div", { class: "p-lane-prof-wrap" },
      profChipsSelect(profs, entry, lid)
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

  // === Participants ===
  if (entry.activite === "Pédagogie salle") {
    // Pédagogie salle : 1 ou 2 groupes (2 tableaux qui tournent en même temps).
    const double = !!entry.salle_double;
    const toggle = el("div", { class: "p-salle-toggle" });
    [[1, "1 groupe"], [2, "2 groupes"]].forEach(([n, label]) => {
      const active = (n === 2) === double;
      toggle.appendChild(el("button", {
        class: "p-salle-toggle-btn" + (active ? " active" : ""),
        type: "button",
        onClick: () => {
          if (active) return;            // déjà dans cet état
          saveEntry(lid, { salle_double: n === 2 });  // garde les données du groupe 2 si on repasse à 1
          renderInto(currentContainer);
        },
      }, label));
    });
    body.appendChild(el("div", { class: "p-salle-groupes" }, toggle));

    const g1 = el("div", { class: "p-lane-participants p-salle-group" });
    if (double) g1.appendChild(el("div", { class: "p-salle-group-tag" }, "Groupe 1"));
    g1.appendChild(buildTableauRole(entry, lid, 1));
    g1.appendChild(buildElevesRoleSalle(entry, lid, 1));
    body.appendChild(g1);

    if (double) {
      const g2 = el("div", { class: "p-lane-participants p-salle-group" });
      g2.appendChild(el("div", { class: "p-salle-group-tag" }, "Groupe 2"));
      g2.appendChild(buildTableauRole(entry, lid, 2));
      g2.appendChild(buildElevesRoleSalle(entry, lid, 2));
      body.appendChild(g2);
    }
  } else if (shape.includes("eleves")) {
    // Voiture (conduite) : élèves seuls, avec mini-picker 1/2/3.
    const participants = el("div", { class: "p-lane-participants" });
    const eleveRole = el("div", { class: "p-lane-role eleves" });
    eleveRole.appendChild(el("span", { class: "p-lane-role-label" }, "Élèves"));
    const eleveCol = el("div", { class: "p-lane-eleves-col" });
    const eleveBlocked = slotOccupants(entry, "eleves");
    const voitCounts = roleCounts("Voiture (conduite)", "eleve", lid);
    const eleveOptions = stagiaires.filter((s) => !eleveBlocked.has(s.id) || (entry.eleves_ids || []).includes(s.id));
    eleveCol.appendChild(chipsSelect(eleveOptions, entry.eleves_ids || [], (ids) => {
      saveEntry(lid, { eleves_ids: ids });
    }, voitCounts));
    if (entry.activite === "Voiture (conduite)") {
      const wrap = el("div", { class: "p-dice-picker-wrap" });
      const diceBtn = el("button", {
        class: "p-dice-btn", type: "button",
        "aria-label": "Tirer des élèves", title: "Tirer des élèves voiture",
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

    // Bénévoles (volontaires conduite) : chips depuis la banque, dispos du jour en tête.
    // Côté stagiaire, `benevoles` vient de la RPC ({id, display}) : pas de dispos ni
    // d'actif → tri stable, pas de badge, chips en lecture seule comme les élèves.
    if (shape.includes("benevoles")) {
      const bnvRole = el("div", { class: "p-lane-role benevoles" });
      bnvRole.appendChild(el("span", { class: "p-lane-role-label" }, "Bénévoles"));
      const currentBnv = entry.benevoles_ids || [];
      const taken = benevoleSlotOccupants(entry);
      // Actifs non pris sur le créneau (+ ceux déjà sélectionnés, même retirés depuis),
      // dispos du jour en tête puis alphabétique.
      const bnvOptions = benevoles
        .filter((b) => (b.actif !== false && !taken.has(b.id)) || currentBnv.includes(b.id))
        .sort((a, b) =>
          (isBenevoleDispo(a, entry) ? 0 : 1) - (isBenevoleDispo(b, entry) ? 0 : 1)
          || compareByNom(a, b));
      bnvRole.appendChild(chipsSelect(bnvOptions, currentBnv,
        (ids) => saveEntry(lid, { benevoles_ids: ids }), null, {
          labelFn: (b) => b.display,
          placeholder: "Bénévoles…",
          itemBadge: (b) => isBenevoleDispo(b, entry)
            ? el("span", { class: "bnv-dispo-badge" }, "dispo") : null,
        }));
      participants.appendChild(bnvRole);
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
  // `has-parallel` : 2+ activités au même horaire → encadrées en groupe sur mobile.
  const lanes = el("div", { class: "p-lanes" + (row.lanes.length > 1 ? " has-parallel" : "") });
  // Grid template : N colonnes de cellules de même largeur + 1 colonne 40px pour le "+"
  lanes.style.gridTemplateColumns = `repeat(${maxLanes}, minmax(0, 1fr)) 40px`;

  row.lanes.forEach((entry) => {
    const cell = renderLaneCell(entry);
    // Place la cellule dans la colonne correspondant à son lane index
    cell.style.gridColumn = String((entry.lane ?? 0) + 1);
    lanes.appendChild(cell);
  });

  // Bouton "+" en parallèle : barre verticale au bout sur desktop, bouton labellisé
  // pleine largeur sous le créneau sur mobile (le label est masqué en desktop via CSS).
  const addParBtn = el("button", {
    class: "p-add-parallele-mini",
    title: "Ajouter une activité en parallèle (même horaire)",
    onClick: () => addLaneInSlot(d, half, row.slot)
  });
  addParBtn.style.gridColumn = String(maxLanes + 1);
  addParBtn.appendChild(icon.plus());
  addParBtn.appendChild(el("span", { class: "p-add-parallele-label" }, "En parallèle"));
  lanes.appendChild(addParBtn);

  slotEl.appendChild(lanes);
  return slotEl;
}

function renderDayCard(d, monday) {
  const date = addDays(monday, d);
  const off = dayOffInfo(d, monday);
  const admin = isAdmin();
  const card = el("article", { class: "p-day-card" + (off.off ? " off" : "") });

  const head = el("div", { class: "p-day-head" },
    el("span", { class: "p-day-name" }, JOURS[d]),
    el("span", { class: "p-day-date" }, formatDayShort(date)),
  );
  // Toggle désactiver / réactiver (admin) : petite icône discrète. Un férié auto (non
  // manuel) reste simplement grisé, sans bouton.
  if (admin && off.off && off.manual) {
    const reBtn = el("button", { class: "p-day-toggle", type: "button",
      "aria-label": "Réactiver ce jour", title: "Réactiver ce jour", onClick: () => enableDay(d) });
    reBtn.appendChild(icon.refresh());
    head.appendChild(reBtn);
  } else if (admin && !off.off) {
    const offBtn = el("button", { class: "p-day-toggle", type: "button",
      "aria-label": "Désactiver ce jour", title: "Désactiver ce jour (férié, vacances, pont…)", onClick: () => disableDay(d) });
    offBtn.appendChild(icon.ban());
    head.appendChild(offBtn);
  }
  card.appendChild(head);

  // Jour désactivé : bandeau + aucune activité (les cartes restent conservées en base).
  if (off.off) {
    card.appendChild(el("div", { class: "p-day-off-banner" },
      el("span", { class: "p-day-off-tag" }, off.ferie ? "FÉRIÉ" : "FERMÉ"),
      el("span", { class: "p-day-off-label" }, off.label),
    ));
    return card;
  }

  const content = el("div", { class: "p-day-content" });

  HALF_DAYS.forEach((half) => {
    const meta = metaFor(d, half.key);
    const pauseLbl = pauseLabel(meta);

    const section = el("div", { class: "p-half " + half.key });

    // Header : bouton d'édition des horaires pour les admins ; simple bandeau statique
    // pour les autres. NE PAS le masquer en lecture seule : il porte MATIN/APRÈS-MIDI,
    // les horaires et la pause — sans lui, les demi-journées sont indistinguables
    // (bug élèves 2026-07-03, ancien `.read-only .p-half-head.editable { display:none }`).
    const headBtn = isAdmin()
      ? el("button", {
          class: "p-half-head editable",
          title: "Modifier les horaires et la pause",
          onClick: () => openHalfMetaEditor(d, half.key, headBtn),
        })
      : el("div", { class: "p-half-head" });
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

// Banque des bénévoles pour les sélecteurs et l'affichage des cartes voiture.
// Admin : table complète (dispos, actif...). Stagiaire : RPC noms seulement
// (la table est RLS admin-only, téléphone jamais transmis).
async function loadBenevoles() {
  if (isAdmin()) {
    const list = await listBenevoles();
    return list.map((b) => ({ ...b, display: displayStagiaire(b) }));
  }
  return await listBenevolesNoms();
}

async function loadPlanning() {
  const [data, metas, offs] = await Promise.all([
    getPlanning(semaineLundi),
    getHalfMetaForWeek(semaineLundi),
    getJoursOff(semaineLundi),
  ]);
  let counter = 0;
  entries = data.map((row) => {
    // Compat ascendante : si prof_ids vide mais prof_id présent, on l'utilise
    let prof_ids = row.prof_ids;
    if ((!prof_ids || prof_ids.length === 0) && row.prof_id) prof_ids = [row.prof_id];
    return { ...row, prof_ids: prof_ids || [], _lid: "lid-" + (++counter) };
  });
  halfMetas = metas;
  joursOff = offs || [];
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
  // La « semaine affichée » est persistée comme réglage GLOBAL de la promo (table settings,
  // écriture admin-only en RLS) : c'est la semaine que tout le monde retrouve à l'ouverture.
  // Les non-admins naviguent donc en LOCAL uniquement — persister ici levait une erreur RLS
  // qui court-circuitait loadPlanning/renderInto → navigation bloquée pour les stagiaires
  // (bug Gaëlle 2026-07-02), alors qu'un stagiaire ne doit de toute façon pas déplacer la
  // semaine courante de toute la promo.
  if (isAdmin()) await setSetting("current_week_lundi", dateStr);
  await loadPlanning();
  renderInto(currentContainer);
}

// Désactive un jour (férié, vacances, pont, formation externe…) : grisé, aucune activité
// affichée, exclu du placement auto et de la validation. Les cartes restent en base.
async function disableDay(d) {
  if (!isAdmin()) return;
  const monday = new Date(semaineLundi + "T00:00:00");
  const info = dayOffInfo(d, monday);
  const def = info.ferie ? info.label : "Vacances";
  const label = prompt("Désactiver « " + JOURS[d] + " » — libellé (ex. Vacances, Pont, Férié…) :", def);
  if (label === null) return;   // annulé
  try {
    await setJourOff(semaineLundi, d, label.trim() || "Désactivé", getCurrentWho());
    await loadPlanning();
    renderInto(currentContainer);
    toast(JOURS[d] + " désactivé · Ctrl+Z pour annuler", "success", 2400);
    recordUndo("jour désactivé", async () => { await deleteJourOff(semaineLundi, d); await loadPlanning(); renderInto(currentContainer); });
  } catch (e) { toast("Erreur : " + e.message, "error"); }
}

async function enableDay(d) {
  if (!isAdmin()) return;
  try {
    await deleteJourOff(semaineLundi, d);
    await loadPlanning();
    renderInto(currentContainer);
    toast(JOURS[d] + " réactivé", "success");
  } catch (e) { toast("Erreur : " + e.message, "error"); }
}

// === Valider la semaine : transforme le planning des jours écoulés en passages ===
// Salle -> 1 passage Salle pour le pédagogue. Voiture -> 1 passage Voiture par élève.
// Écran de confirmation : résultat « Effectué » par défaut, ajustable, dédoublonné.
function openValiderSemaineModal() {
  const monday = new Date(semaineLundi + "T00:00:00");
  const todayIso = isoDate(new Date());
  const activeIds = new Set(stagiaires.map((s) => s.id));

  // 1. Candidats depuis le planning, jours écoulés uniquement (date du jour <= aujourd'hui)
  const raw = [];
  entries.forEach((e) => {
    const dateIso = isoDate(addDays(monday, e.day_index));
    if (dateIso > todayIso) return;
    if (dayIsOff(e.day_index)) return;   // jour désactivé/férié : aucun passage validé
    if (e.activite === "Pédagogie salle") {
      if (e.pedagogue_id && activeIds.has(e.pedagogue_id)) {
        raw.push({ stagiaire_id: e.pedagogue_id, type: "Salle", date: dateIso, day_index: e.day_index });
      }
      // 2e tableau (si la carte a 2 groupes) = un 2e passage Salle
      if (e.salle_double && e.pedagogue_id_2 && activeIds.has(e.pedagogue_id_2)) {
        raw.push({ stagiaire_id: e.pedagogue_id_2, type: "Salle", date: dateIso, day_index: e.day_index });
      }
    } else if (e.activite === "Voiture (conduite)") {
      (e.eleves_ids || []).forEach((id) => {
        if (activeIds.has(id)) raw.push({ stagiaire_id: id, type: "Voiture", date: dateIso, day_index: e.day_index });
      });
    }
  });

  // Dédoublonnage par (stagiaire + type + JOUR) : au plus 1 passage par stagiaire,
  // par type et par jour. Conséquence assumée : 2 sessions voiture le même jour
  // (matin + après-midi) comptent pour 1. La table passages est au grain jour
  // (pas de demi-journée), donc on ne peut pas distinguer plus finement ; pour un
  // 2e passage le même jour, l'ajouter à la main dans l'onglet Passages.
  const seen = new Set();
  const candidates = raw.filter((c) => {
    const k = c.stagiaire_id + "|" + c.type + "|" + c.date;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 2. Thèmes présents dans les sujets des jours écoulés, pas encore « Fait ».
  // date_fait = date du créneau (la plus ancienne si le thème apparaît plusieurs fois).
  const themeByDate = new Map();
  entries.forEach((e) => {
    const dateIso = isoDate(addDays(monday, e.day_index));
    if (dateIso > todayIso) return;
    parseSujet(e.sujet).forEach((titre) => {
      const t = themes.find((x) => x.titre === titre);
      if (!t || t.statut === "Fait") return;  // texte libre non rattaché ou déjà fait : ignoré
      const prev = themeByDate.get(t.id);
      if (!prev || dateIso < prev.date) themeByDate.set(t.id, { theme: t, date: dateIso });
    });
  });
  const themeCandidates = [...themeByDate.values()];

  if (candidates.length === 0 && themeCandidates.length === 0) {
    toast("Rien à valider : aucune pédagogie, voiture ni thème sur les jours écoulés de cette semaine.", "info", 4500);
    return;
  }

  // 3. Dédoublonnage des passages contre l'existant (manuel ou auto) sur la semaine
  const friday = isoDate(addDays(monday, 4));
  getPassagesInRange(semaineLundi, friday).then((existing) => {
    const existKey = new Set(existing.map((p) => p.stagiaire_id + "|" + p.type + "|" + p.date));
    const keyOf = (c) => c.stagiaire_id + "|" + c.type + "|" + c.date;
    const toCreate = candidates.filter((c) => !existKey.has(keyOf(c)));
    const already = candidates.filter((c) => existKey.has(keyOf(c)));
    if (toCreate.length === 0 && themeCandidates.length === 0) {
      toast("Tout est déjà enregistré pour cette semaine (" + already.length + " passage(s)).", "info", 4500);
      return;
    }
    renderValiderModal(toCreate, already, existKey, themeCandidates);
  }).catch((e) => {
    console.error(e);
    toast("Erreur lecture des passages existants", "error");
  });
}

function renderValiderModal(toCreate, already, existKey, themeCandidates) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const nameOf = (id) => {
    const s = stagiaires.find((x) => x.id === id);
    return s ? displayStagiaire(s) : "?";
  };
  const dayLabel = (di) => {
    const j = JOURS[di] || "";
    return j.charAt(0) + j.slice(1).toLowerCase();
  };

  const rowState = toCreate.map(() => ({ include: true, resultat: "Effectué", remplacant_id: null }));
  const themeState = (themeCandidates || []).map(() => ({ include: true }));
  const list = el("div", { class: "valider-list" });

  toCreate.forEach((c, i) => {
    const cb = el("input", { type: "checkbox", "aria-label": "Inclure " + nameOf(c.stagiaire_id) + " " + dayLabel(c.day_index) + " " + c.type });
    cb.checked = true;
    cb.addEventListener("change", () => { rowState[i].include = cb.checked; });

    const resSel = el("select", { class: "valider-res" });
    RESULTATS.forEach((r) => {
      const opt = el("option", { value: r.value }, r.icon + " " + r.value);
      if (r.value === "Effectué") opt.selected = true;
      resSel.appendChild(opt);
    });

    // Sélecteur « remplacé par » : visible seulement sur Absence. Le remplaçant
    // choisi sera crédité d'un passage Effectué (même type, même jour).
    const remplSel = el("select", { class: "valider-res valider-rempl hidden", "aria-label": "Remplacé par" });
    remplSel.appendChild(el("option", { value: "" }, "— remplacé par —"));
    stagiaires
      .filter((s) => s.id !== c.stagiaire_id)
      .forEach((s) => remplSel.appendChild(el("option", { value: s.id }, displayStagiaire(s))));
    remplSel.addEventListener("change", () => {
      rowState[i].remplacant_id = remplSel.value ? Number(remplSel.value) : null;
    });

    resSel.addEventListener("change", () => {
      rowState[i].resultat = resSel.value;
      if (resSel.value === "Absence") {
        remplSel.classList.remove("hidden");
      } else {
        remplSel.classList.add("hidden");
        remplSel.value = "";
        rowState[i].remplacant_id = null;
      }
    });

    const top = el("div", { class: "valider-row-top" },
      cb,
      el("span", { class: "valider-row-main" },
        el("span", { class: "valider-row-name" }, nameOf(c.stagiaire_id)),
        el("span", { class: "valider-row-meta" }, dayLabel(c.day_index) + " · " + c.type),
      ),
      resSel,
    );
    const row = el("div", { class: "valider-row" }, top, remplSel);
    // Clic sur la ligne (hors selects et hors case) = bascule la case
    row.addEventListener("click", (ev) => {
      if (ev.target === resSel || resSel.contains(ev.target)) return;
      if (ev.target === remplSel || remplSel.contains(ev.target)) return;
      if (ev.target === cb) return;
      cb.checked = !cb.checked;
      rowState[i].include = cb.checked;
    });
    list.appendChild(row);
  });

  if (already.length) {
    list.appendChild(el("div", { class: "valider-already-head" }, already.length + " déjà enregistré(s), ignoré(s)"));
    already.forEach((c) => {
      list.appendChild(el("div", { class: "valider-row already" },
        el("div", { class: "valider-row-top" },
          el("span", { class: "valider-row-main" },
            el("span", { class: "valider-row-name" }, nameOf(c.stagiaire_id)),
            el("span", { class: "valider-row-meta" }, dayLabel(c.day_index) + " · " + c.type),
          ),
          el("span", { class: "valider-done" }, "déjà fait"),
        ),
      ));
    });
  }

  // Section « Thèmes traités » : marque les thèmes du planning comme Fait à la date du créneau
  if (themeCandidates && themeCandidates.length) {
    list.appendChild(el("div", { class: "valider-already-head" }, "Thèmes traités (" + themeCandidates.length + ")"));
    themeCandidates.forEach((tc, i) => {
      const cb = el("input", { type: "checkbox", "aria-label": "Marquer « " + tc.theme.titre + " » traité" });
      cb.checked = true;
      cb.addEventListener("change", () => { themeState[i].include = cb.checked; });
      const numBadge = tc.theme.numero != null ? String(tc.theme.numero).padStart(2, "0") + " · " : "";
      const row = el("div", { class: "valider-row" },
        el("div", { class: "valider-row-top" },
          cb,
          el("span", { class: "valider-row-main" },
            el("span", { class: "valider-row-name" }, numBadge + tc.theme.titre),
            el("span", { class: "valider-row-meta" }, "Traité le " + formatDate(tc.date)),
          ),
        ),
      );
      row.addEventListener("click", (ev) => {
        if (ev.target === cb) return;
        cb.checked = !cb.checked;
        themeState[i].include = cb.checked;
      });
      list.appendChild(row);
    });
  }

  const cancelBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler");
  const saveBtn = el("button", { class: "btn primary" }, icon.check(), "Enregistrer");

  async function save() {
    const who = getCurrentWho();
    const rows = [];
    const batchKeys = new Set();  // évite les doublons intra-lot (ex: remplaçant déjà candidat)
    const addRow = (stagiaire_id, type, date, resultat, remplacant_id) => {
      const key = stagiaire_id + "|" + type + "|" + date;
      if (existKey.has(key) || batchKeys.has(key)) return;
      batchKeys.add(key);
      rows.push({
        date, stagiaire_id, type, resultat,
        remplacant_id: remplacant_id || null,
        origine: "Planning",
        semaine_lundi: semaineLundi,
        created_by_who: who,
        updated_by_who: who,
      });
    };

    toCreate.forEach((c, i) => {
      const st = rowState[i];
      if (!st.include) return;
      const rempl = st.resultat === "Absence" ? st.remplacant_id : null;
      addRow(c.stagiaire_id, c.type, c.date, st.resultat, rempl);
      // Absence + remplaçant => le remplaçant est crédité d'un Effectué (même type, même jour)
      if (rempl) addRow(rempl, c.type, c.date, "Effectué", null);
    });

    const themesToMark = (themeCandidates || []).filter((tc, i) => themeState[i].include);

    if (rows.length === 0 && themesToMark.length === 0) { toast("Rien à enregistrer (tout décoché)", "info"); return; }
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Enregistrement…";

      let insertedIds = [];
      if (rows.length) {
        const inserted = await addPassagesBatch(rows);
        insertedIds = inserted.map((p) => p.id);
      }

      // Marque les thèmes « Fait » à la date du créneau ; mémorise l'état pour Ctrl+Z.
      const themeUndo = [];
      const email = getAdminEmail();
      for (const tc of themesToMark) {
        const prev = { statut: tc.theme.statut, date_fait: tc.theme.date_fait };
        await updateTheme(tc.theme.id, { statut: "Fait", date_fait: tc.date, updated_by_email: email });
        tc.theme.statut = "Fait";
        tc.theme.date_fait = tc.date;  // maj en mémoire pour ne pas le re-proposer
        themeUndo.push({ theme: tc.theme, prev });
      }

      const parts = [];
      if (insertedIds.length) parts.push(insertedIds.length + " passage(s)");
      if (themesToMark.length) parts.push(themesToMark.length + " thème(s)");
      toast(parts.join(" + ") + " enregistré(s) · Ctrl+Z pour annuler", "success", 2800);

      recordUndo("validation de la semaine", async () => {
        if (insertedIds.length) await deletePassagesBatch(insertedIds);
        for (const u of themeUndo) {
          await updateTheme(u.theme.id, { statut: u.prev.statut, date_fait: u.prev.date_fait });
          u.theme.statut = u.prev.statut;
          u.theme.date_fait = u.prev.date_fait;
        }
      });
      backdrop.remove();
    } catch (e) {
      console.error(e);
      saveBtn.disabled = false;
      clear(saveBtn);
      saveBtn.appendChild(icon.check());
      saveBtn.appendChild(document.createTextNode("Enregistrer"));
      toast(e.message || "Erreur enregistrement", "error", 4000);
    }
  }
  saveBtn.addEventListener("click", save);

  const modal = el("div", { class: "modal valider-modal" },
    el("h3", {}, "Valider la semaine"),
    el("p", { class: "muted", style: "margin:0 0 0.6rem; font-size:0.85rem;" },
      "Passages et thèmes déduits du planning des jours écoulés. Résultat « Effectué » par défaut : sur une absence, indique qui a remplacé (le remplaçant est crédité). Décoche pour exclure."),
    list,
    el("div", { class: "modal-actions" }, cancelBtn, saveBtn),
  );

  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
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

  const weekBar = el("div", { class: "week-bar" },
    el("span", { class: "week-bar-label" }, "Semaine du"),
    dateInput, prevBtn, nextBtn, todayBtn,
    el("span", { style: "flex:1" }),
  );
  // Banque d'élèves bénévoles (voiture) : gestion réservée aux formateurs/admins
  if (admin) {
    const bnvBtn = el("button", { class: "btn small",
      title: "Banque d'élèves bénévoles (voiture) : fiches, dispos, téléphones",
      onClick: () => openBenevolesPanel({ onClose: async () => {
        benevoles = await loadBenevoles();
        renderInto(currentContainer);
      }}) }, "Bénévoles");
    weekBar.appendChild(bnvBtn);
  }
  // Placer la semaine : tirage global (tableaux + élèves de toute la semaine), admin uniquement
  if (admin) {
    const placeBtn = el("button", { class: "btn small",
      title: "Placer automatiquement tableaux et élèves de toute la semaine (priorité aux moins passés)",
      onClick: () => autoPlaceWeek() });
    placeBtn.appendChild(document.createTextNode("🎲 Placer la semaine"));
    weekBar.appendChild(placeBtn);
  }
  // Valider la semaine : admin uniquement, sur une semaine au moins partiellement écoulée
  if (admin && semaineLundi <= isoDate(new Date())) {
    const validBtn = el("button", { class: "btn small primary", onClick: () => openValiderSemaineModal() });
    validBtn.appendChild(icon.check());
    validBtn.appendChild(document.createTextNode("Valider la semaine"));
    weekBar.appendChild(validBtn);
  }
  weekBar.appendChild(printBtn);
  container.appendChild(weekBar);

  const wrap = el("div", { class: "p-days" });
  JOURS.forEach((_, d) => wrap.appendChild(renderDayCard(d, monday)));
  container.appendChild(wrap);

  container.appendChild(el("div", { class: "planning-helper" },
    el("strong", {}, "À la suite "), "↓ = nouveau créneau dans le temps (après celui qui précède). ",
    el("strong", {}, "Parallèle "), "→ = autre activité au même horaire (ex: voiture qui tourne pendant un cours). ",
    "Au moins 1 créneau par demi-journée. Min. 1 lane (rangée) → bouton « Parallèle » l'étoffe."
  ));

  // Monte/rafraîchit le DOM d'impression dédié (caché à l'écran, utilisé par @media print).
  mountPrintTarget();
}

// === Rendu print 1 page (DOM dédié, compact, vide masqué) ===

function nonEmpty(v) {
  return v != null && String(v).trim() !== "";
}

function lookupProf(id) { return profs.find((p) => p.id === id)?.nom || ""; }
function lookupBenevole(id) { return benevoles.find((b) => b.id === id)?.display || ""; }
function lookupStagiaire(id) {
  const s = stagiaires.find((x) => x.id === id);
  return s ? displayStagiaire(s) : "";
}

// Prénoms portés par AU MOINS 2 stagiaires (normalisés) → il faut garder l'initiale du
// nom pour les distinguer. Recalculé à chaque impression (liste ~15 stagiaires).
function ambiguousPrenoms() {
  const count = {};
  stagiaires.forEach((s) => {
    const p = (s.prenom || "").trim().toLowerCase();
    if (p) count[p] = (count[p] || 0) + 1;
  });
  return new Set(Object.keys(count).filter((p) => count[p] >= 2));
}

// Nom affiché à l'impression : PRÉNOM SEUL, sauf si le prénom est ambigu (partagé par un
// autre stagiaire) → « Initiale. Prénom » (displayStagiaire) pour lever le doute.
function printName(id, ambig) {
  const s = stagiaires.find((x) => x.id === id);
  if (!s) return "";
  const p = (s.prenom || "").trim().toLowerCase();
  return (p && ambig.has(p)) ? displayStagiaire(s) : (s.prenom || displayStagiaire(s));
}

function entryHasContent(e) {
  const hasPed = effPedagogueId(e, 1) != null || effPedagogueId(e, 2) != null;
  const hasEl = effElevesIds(e, 1).length > 0 || effElevesIds(e, 2).length > 0;
  return nonEmpty(e.activite) || (entryShape(e).includes("sujet") && nonEmpty(e.sujet)) || nonEmpty(e.notes)
      || (e.prof_ids && e.prof_ids.length) || e.prof_id
      || hasPed || hasEl || effBenevolesIds(e).length > 0;
}

function printEntryCell(e, ambig) {
  const cell = el("div", { class: "pp-cell", dataset: { activite: e.activite || "" } });

  // Ligne titre : activité + prof
  const header = el("div", { class: "pp-cell-head" });
  if (nonEmpty(e.activite)) {
    header.appendChild(el("span", { class: "pp-act" }, e.activite));
  } else {
    header.appendChild(el("span", { class: "pp-act muted" }, "—"));
  }
  const profIds = (e.prof_ids && e.prof_ids.length) ? e.prof_ids : (e.prof_id ? [e.prof_id] : []);
  const profParts = profIds.map(lookupProf).filter(Boolean);
  if (e.prof_autre) profParts.push(e.prof_autre);
  if (e.autonomie) profParts.push("Autonomie");
  if (profParts.length) {
    header.appendChild(el("span", { class: "pp-prof" }, profParts.join(" · ")));
  }
  cell.appendChild(header);

  // Sujet → thèmes abordés, chacun préfixé de son NUMÉRO s'il est rattaché à un thème
  // connu (sinon texte libre sans numéro), un par ligne. (« Autre » n'a pas de sujet.)
  if (entryShape(e).includes("sujet") && nonEmpty(e.sujet)) {
    const box = el("div", { class: "pp-sujet" });
    parseSujet(e.sujet).forEach((titre) => {
      const t = themes.find((x) => x.titre === titre);
      const line = el("div", { class: "pp-theme" });
      if (t && t.numero != null) {
        line.appendChild(el("span", { class: "pp-theme-num" }, String(t.numero).padStart(2, "0")));
      }
      line.appendChild(el("span", { class: "pp-theme-titre" }, titre));
      box.appendChild(line);
    });
    cell.appendChild(box);
  }

  // Au tableau + Élèves — rôles EFFECTIFS selon la forme de l'activité (ignore une donnée
  // périmée d'un rôle absent du type courant : ex. élèves restés sur un Cours, « au tableau »
  // resté sur une Voiture). Noms seulement s'ils se résolvent (évite un label orphelin).
  // « Au tableau » (1 personne) reste en ligne ; les élèves sont listés UN PAR LIGNE.
  const addTableau = (key, id) => {
    const n = id ? printName(id, ambig) : "";
    if (nonEmpty(n)) cell.appendChild(el("div", { class: "pp-line" },
      el("span", { class: "pp-key" }, key + " : "),
      el("span", { class: "pp-val" }, n)));
  };
  const addEleves = (key, ids) => {
    const names = (ids || []).map((id) => printName(id, ambig)).filter(Boolean);
    if (!names.length) return;
    cell.appendChild(el("div", { class: "pp-line" }, el("span", { class: "pp-key" }, key + " :")));
    names.forEach((n) => cell.appendChild(el("div", { class: "pp-line pp-eleve" }, n)));
  };
  if (e.activite === "Pédagogie salle" && e.salle_double) {
    addTableau("Au tableau G1", effPedagogueId(e, 1));
    addEleves("Élèves G1", effElevesIds(e, 1));
    addTableau("Au tableau G2", effPedagogueId(e, 2));
    addEleves("Élèves G2", effElevesIds(e, 2));
  } else {
    addTableau("Au tableau", effPedagogueId(e, 1));
    addEleves("Élèves", effElevesIds(e, 1));
  }

  // Bénévoles (voiture) : sous les élèves moniteurs, en italique. Format « N. Prénom »
  // (banque séparée : pas de dédoublonnage avec les prénoms des stagiaires).
  const bnvNames = effBenevolesIds(e).map(lookupBenevole).filter(Boolean);
  if (bnvNames.length) {
    cell.appendChild(el("div", { class: "pp-line" }, el("span", { class: "pp-key" }, "Bénévoles :")));
    bnvNames.forEach((n) => cell.appendChild(el("div", { class: "pp-line pp-eleve pp-benevole" }, n)));
  }

  // Notes
  if (nonEmpty(e.notes)) {
    cell.appendChild(el("div", { class: "pp-line pp-notes" }, e.notes));
  }

  return cell;
}

function buildPrintHtml(monday) {
  const root = el("div", { class: "print-root" });
  const ambig = ambiguousPrenoms();  // prénoms à désambiguïser (gardent l'initiale)

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
    const off = dayOffInfo(d, monday);
    const dayCol = el("div", { class: "pp-day" + (off.off ? " off" : "") });

    dayCol.appendChild(el("div", { class: "pp-day-head" },
      el("span", { class: "pp-day-name" }, jour),
      el("span", { class: "pp-day-date" }, formatDayShort(date)),
    ));

    // Jour désactivé/férié : bandeau, aucune activité imprimée.
    if (off.off) {
      dayCol.appendChild(el("div", { class: "pp-day-off" },
        el("span", { class: "pp-day-off-tag" }, off.ferie ? "FÉRIÉ" : "FERMÉ"),
        el("span", {}, off.label),
      ));
      grid.appendChild(dayCol);
      return;
    }

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
          row.lanes.forEach((e) => rowEl.appendChild(printEntryCell(e, ambig)));
          halfBlock.appendChild(rowEl);
        });
      }

      dayCol.appendChild(halfBlock);
    });

    grid.appendChild(dayCol);
  });

  root.appendChild(grid);

  // Footer (+ emplacement de la ligne diagnostic, remplie par fitPrintToPage APRÈS mesure
  // pour ne pas fausser le calcul d'échelle).
  root.appendChild(el("div", { class: "pp-footer" },
    "Promo ECSR · généré le " + new Date().toLocaleDateString("fr-FR"),
    el("span", { class: "pp-diag" }),
  ));

  return root;
}

// Le DOM d'impression dédié (#print-container) est monté EN PERMANENCE tant qu'on est sur
// le planning, rendu HORS ÉCRAN (position:fixed, left:-200vw) mais bien dans le layout
// (donc MESURABLE — indispensable pour la mise à l'échelle auto). La bascule écran↔impression
// est faite uniquement par `@media print` + la classe `planning-printable` sur <body>.
// Avantage : marche pour TOUS les chemins (bouton, Cmd/Ctrl+P, Partage→Imprimer iOS, Chrome
// Android), sans course critique (l'ancien setTimeout retirait le DOM pendant que l'aperçu
// iOS se générait encore → l'app entière s'imprimait sur ~10 pages).

let printBeforeprintBound = false;

// Dimensions CIBLES du contenu imprimé (mm), PAR PLATEFORME. Les navigateurs MOBILES (iOS
// Safari ET Android Chrome) ajoutent des marges (latérales ET hautes/basses) + en-têtes/pieds
// (date, URL, n° de page) NON contrôlables en CSS → leur zone imprimable réelle est plus PETITE
// (hauteur ~157mm et largeur ~235mm) que sur desktop (~196 × ~285mm). On vise donc plus bas sur
// mobile. Valeurs CONFIRMÉES sur iPhone réel (230×148 → planning entier, 1 page à 100 %) ;
// appliquées aussi à Android (zone ≈ ou plus large qu'iOS → tient à coup sûr).
// ⚠️ Si ça déborde/rogne ENCORE sur un mobile, baisser la valeur mobile correspondante.
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
               || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad iOS 13+
const PRINT_FIT_MM = IS_MOBILE ? 148 : 180;     // hauteur cible
const PRINT_WIDTH_MM = IS_MOBILE ? 230 : 270;   // largeur (zone imprimable mobile plus étroite)
// Hauteur de COUPE (mm) : un peu AU-DESSUS de la cible (headroom) mais SOUS la zone
// imprimable → si le rendu print réel sort plus haut que la mesure écran (polices chargées
// entre-temps, métriques du pilote d'imprimante… — vu sur le PC d'Hocine : planning rogné),
// l'écart est absorbé au lieu de couper le contenu, et la page reste UNIQUE quoi qu'il arrive.
const PRINT_CLIP_MM = IS_MOBILE ? 152 : 188;

function ensurePrintContainer() {
  let c = document.getElementById("print-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "print-container";
    c.setAttribute("aria-hidden", "true");
    c.style.width = PRINT_WIDTH_MM + "mm";   // largeur par plateforme (CSS = simple fallback)
    // Hauteur de coupe lue par le CSS @media print (var(--print-clip)) : appliquée par le
    // MOTEUR au moment du print → indépendante de tout px figé côté écran.
    c.style.setProperty("--print-clip", PRINT_CLIP_MM + "mm");
    document.body.appendChild(c);
  }
  return c;
}

// Réduit le contenu pour qu'il ne dépasse JAMAIS PRINT_FIT_MM de hauteur → 1 seule page,
// automatiquement (= régler « Mise à l'échelle » à la main, mais calculé). On utilise
// `transform: scale` : sa taille est reflétée de façon FIABLE par getBoundingClientRect (au
// contraire de `zoom`, dont l'interaction avec les largeurs en % casse la mesure). On
// dichotomie en pré-élargissant la largeur pour rester pleine largeur (largeur×scale = 100 %),
// car un layout plus large se raccourcit.
function fitPrintToPage(root) {
  const pxPerMm = 96 / 25.4;
  const target = PRINT_FIT_MM * pxPerMm;
  const container = root.parentElement;
  root.style.transformOrigin = "top left";
  root.style.transform = "none";
  root.style.width = "100%";
  container.style.height = "";
  // Conteneur rendu hors écran (≠ display:none) → hauteur réelle mesurable.
  const h0 = root.getBoundingClientRect().height;

  let scale = 1;
  if (h0 > target + 1) {
    // scale ∈ ]lo, 1] : plus le scale baisse, plus on élargit (width = 100/scale %) → contenu
    // plus court. On cherche le plus GRAND scale dont la hauteur effective tient dans la cible.
    let lo = target / h0, hi = 1, best = lo;
    for (let i = 0; i < 7; i++) {
      const s = (lo + hi) / 2;
      root.style.width = (100 / s) + "%";
      const rendered = root.getBoundingClientRect().height * s;   // hauteur effective après scale(s)
      if (rendered > target) hi = s;
      else { best = s; lo = s; }
    }
    root.style.width = (100 / best) + "%";
    root.style.transform = "scale(" + best + ")";
    scale = best;
  }

  // VERROU de pagination : `transform` ne réduit pas la BOÎTE de layout → hauteur explicite
  // + overflow:hidden. Version robuste : hauteur de coupe FIXE (PRINT_CLIP_MM, budget par
  // plateforme), INDÉPENDANTE de la mesure. Avant : hauteur = mesure exacte → tout écart
  // mesure écran ↔ rendu print réel (polices, pilote…) rognait le bas du planning (bug PC
  // Hocine 2026-07-02). Le contenu vise PRINT_FIT_MM, la coupe est à PRINT_CLIP_MM → headroom.
  // En print, c'est le CSS (height: var(--print-clip) !important) qui fait foi, sans JS.
  container.style.height = Math.ceil(PRINT_CLIP_MM * pxPerMm) + "px";

  // Ligne diagnostic imprimée (discrète, dans le footer) : quand une impression sort mal sur
  // une machine qu'on n'a pas sous la main, une simple photo de l'aperçu donne les conditions
  // exactes du calcul (échelle, hauteurs, viewport, zoom, navigateur, état des polices).
  const diag = root.querySelector(".pp-diag");
  if (diag) {
    const m = navigator.userAgent.match(/(Edg|OPR|CriOS|Chrome|Firefox|Version)\/(\d+)/);
    const brow = m ? (m[1] === "Version" ? "Safari" : m[1]) + " " + m[2] : "?";
    diag.textContent = " · [" + Math.round(scale * 100) + "% · "
      + Math.round(h0 / pxPerMm) + "→" + Math.round(root.getBoundingClientRect().height / pxPerMm)
      + "/" + PRINT_CLIP_MM + "mm · " + window.innerWidth + "×" + window.innerHeight
      + " @" + (window.devicePixelRatio || 1).toFixed(2) + " · " + brow
      + " · pol " + (document.fonts && document.fonts.status === "loaded" ? "ok" : "…") + "]";
  }
}

// (Re)génère le contenu compact 1 page A4 paysage depuis les données de la semaine courante,
// puis le met à l'échelle pour tenir sur une page.
function refreshPrintTarget() {
  if (!semaineLundi) return;
  const c = ensurePrintContainer();
  const monday = new Date(semaineLundi + "T00:00:00");
  c.innerHTML = "";
  const root = buildPrintHtml(monday);
  c.appendChild(root);
  document.body.classList.add("planning-printable");
  fitPrintToPage(root);
}

// Rafraîchit le DOM d'impression UNIQUEMENT s'il est déjà monté (= on est sur le planning).
// Évite qu'un save différé (note debouncée) qui tombe après avoir quitté la vue ne
// ressuscite la cible d'impression sur une autre vue.
function syncPrintTargetIfMounted() {
  if (document.body.classList.contains("planning-printable")) refreshPrintTarget();
}

function mountPrintTarget() {
  refreshPrintTarget();
  if (!printBeforeprintBound) {
    // Rafraîchit le DOM d'impression juste avant un print natif, pour qu'il reflète
    // toujours les dernières éditions. Deux déclencheurs complémentaires :
    //  - `beforeprint` : desktop (Chrome/Edge/Firefox/Safari macOS) + Ctrl/Cmd+P.
    //  - changement de `matchMedia('print')` : seul signal émis par iOS Safari/WebKit,
    //    qui n'implémente pas `beforeprint` → couvre le Partage→Imprimer sur iPhone.
    window.addEventListener("beforeprint", syncPrintTargetIfMounted);
    const mq = window.matchMedia("print");
    const onMq = (e) => { if (e.matches) syncPrintTargetIfMounted(); };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
    else if (mq.addListener) mq.addListener(onMq); // anciens Safari
    // La 1re mesure peut tomber AVANT le chargement de la police Outfit → hauteur (donc
    // échelle) erronée. On re-calcule une fois les polices prêtes.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncPrintTargetIfMounted);
    printBeforeprintBound = true;
  }
}

// Appelé par le routeur en quittant le planning : on retire la cible d'impression
// pour qu'un print natif depuis une autre vue n'imprime pas un planning périmé.
export function teardownPrintTarget() {
  document.getElementById("print-container")?.remove();
  document.body.classList.remove("planning-printable");
}

async function printPlanning() {
  // Attend (borné à 1,5 s) le chargement des polices avant de mesurer : mesurer avec la
  // police de repli puis rendre l'aperçu avec Outfit chargée entre-temps = hauteurs
  // différentes → risque de coupe. Si le CDN fonts est bloqué, on imprime quand même
  // (repli utilisé de façon cohérente à la mesure ET au rendu).
  if (document.fonts && document.fonts.status !== "loaded") {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  }
  refreshPrintTarget();
  window.print();
}

export async function renderPlanning(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  [stagiaires, profs, themes, benevoles] = await Promise.all([
    listStagiaires(), listProfs(), listThemes(), loadBenevoles(),
  ]);
  autresProfsMem = parseAutresProfs(await getSetting("profs_autres"));
  semaineLundi = (await getSetting("current_week_lundi")) || isoDate(getMonday(new Date()));
  await loadPlanning();
  renderInto(container);
}
