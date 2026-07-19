/**
 * Vue Calendrier — dates importantes (examens, stages, formations, etc.).
 * Lecture publique, écriture admin only.
 */
import {
  listAgendaEvents, addAgendaEvent, updateAgendaEvent, deleteAgendaEvent,
} from "../db.js?v=20260719b";
import { el, clear, isoDate, formatDate, formatLongDate, parseDate, toast } from "../utils.js?v=20260719b";
import { icon } from "../icons.js?v=20260719b";
import { isAdmin, getAdminEmail } from "../auth-admin.js?v=20260719b";
import { recordUndo } from "../undo.js?v=20260719b";

let events = [];

const EVENT_TYPES = [
  { key: "examen",    label: "Examen",     emoji: "📝", color: "examen"    },
  { key: "stage",     label: "Stage",      emoji: "🏢", color: "stage"     },
  { key: "formation", label: "Formation",  emoji: "🎓", color: "formation" },
  { key: "ferie",     label: "Férié / pause", emoji: "🌴", color: "ferie"   },
  { key: "autre",     label: "Autre",      emoji: "📌", color: "autre"     },
];

const TYPE_MAP = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t]));

function groupByMonth(list) {
  const map = new Map();
  list.forEach((e) => {
    const d = parseDate(e.date_start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        items: [],
      });
    }
    map.get(key).items.push(e);
  });
  return Array.from(map.values());
}

function eventDateLabel(e) {
  if (!e.date_end || e.date_end === e.date_start) return formatLongDate(e.date_start);
  return `Du ${formatDate(e.date_start)} au ${formatDate(e.date_end)}`;
}

function eventDuration(e) {
  if (!e.date_end || e.date_end === e.date_start) return null;
  const start = parseDate(e.date_start);
  const end = parseDate(e.date_end);
  const days = Math.round((end - start) / 86400000) + 1;
  return `${days} jour${days > 1 ? "s" : ""}`;
}

function isPast(e) {
  const end = parseDate(e.date_end || e.date_start);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}

function isToday(e) {
  const today = isoDate(new Date());
  return e.date_start <= today && (e.date_end || e.date_start) >= today;
}

// Nombre de jours avant le DÉBUT de l'événement (négatif si déjà commencé/passé)
function daysUntilStart(e) {
  const d = parseDate(e.date_start);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

// Badge "jours restants" : null si déjà commencé/passé
function countdownInfo(e) {
  if (isToday(e)) return { text: "Aujourd'hui", cls: "today" };
  const days = daysUntilStart(e);
  if (days < 0) return null;       // déjà commencé ou passé
  if (days === 0) return { text: "Aujourd'hui", cls: "today" };
  if (days === 1) return { text: "Demain", cls: "soon" };
  return { text: `J − ${days}`, cls: days <= 7 ? "soon" : "later" };
}

function openEventModal(existing, onSaved) {
  const isNew = !existing;
  const backdrop = el("div", { class: "modal-backdrop" });

  const typeSel = el("select");
  EVENT_TYPES.forEach((t) => {
    const opt = el("option", { value: t.key }, `${t.emoji}  ${t.label}`);
    if (existing?.type === t.key) opt.selected = true;
    typeSel.appendChild(opt);
  });

  const titleInput = el("input", {
    type: "text",
    placeholder: "Ex. Examen théorique général (ETG)",
    value: existing?.title || "",
  });

  const startInput = el("input", { type: "date", value: existing?.date_start || isoDate(new Date()) });
  const endInput = el("input", { type: "date", value: existing?.date_end || "" });

  const locInput = el("input", {
    type: "text",
    placeholder: "Ex. Centre ECF Pau (facultatif)",
    value: existing?.location || "",
  });

  const descInput = el("textarea", {
    rows: 3,
    placeholder: "Notes complémentaires (facultatif)",
  });
  descInput.value = existing?.description || "";

  async function save() {
    const title = titleInput.value.trim();
    if (!title) { toast("Titre requis", "error"); return; }
    if (!startInput.value) { toast("Date de début requise", "error"); return; }
    if (endInput.value && endInput.value < startInput.value) {
      toast("La date de fin doit être après le début", "error"); return;
    }

    const payload = {
      type: typeSel.value,
      title,
      date_start: startInput.value,
      date_end: endInput.value || null,
      location: locInput.value.trim() || null,
      description: descInput.value.trim() || null,
    };

    try {
      if (isNew) {
        payload.created_by_email = getAdminEmail();
        const inserted = await addAgendaEvent(payload);
        toast("Événement ajouté · Ctrl+Z pour annuler", "success", 2400);
        if (inserted?.id) {
          recordUndo("événement ajouté", async () => { await deleteAgendaEvent(inserted.id); });
        }
      } else {
        const prev = { ...existing };
        await updateAgendaEvent(existing.id, payload);
        recordUndo("événement modifié", async () => {
          await updateAgendaEvent(existing.id, {
            type: prev.type, title: prev.title,
            date_start: prev.date_start, date_end: prev.date_end,
            location: prev.location, description: prev.description,
          });
        });
        toast("Événement mis à jour", "success", 1800);
      }
      backdrop.remove();
      onSaved();
    } catch (e) {
      console.error(e);
      toast("Erreur : " + e.message, "error");
    }
  }

  const modal = el("div", { class: "modal" },
    el("h3", {}, isNew ? "Nouvel événement" : "Modifier l'événement"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Type"), typeSel),
      el("div", { class: "field" }, el("label", {}, "Titre"), titleInput),
      el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:0.6rem" },
        el("div", { class: "field" }, el("label", {}, "Début"), startInput),
        el("div", { class: "field" }, el("label", {}, "Fin (optionnel)"), endInput),
      ),
      el("div", { class: "field" }, el("label", {}, "Lieu"), locInput),
      el("div", { class: "field" }, el("label", {}, "Notes"), descInput),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler"),
      el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  setTimeout(() => titleInput.focus(), 80);
}

function renderEventCard(e, admin, onChanged) {
  const type = TYPE_MAP[e.type] || TYPE_MAP.autre;
  const past = isPast(e);
  const today = isToday(e);
  const card = el("article", {
    class: "agenda-card agenda-" + type.color + (past ? " past" : "") + (today ? " today" : ""),
  });

  // Pastille date
  const start = parseDate(e.date_start);
  const dayNum = start.getDate();
  const monthShort = start.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  const datePill = el("div", { class: "agenda-date" },
    el("span", { class: "agenda-date-day" }, String(dayNum)),
    el("span", { class: "agenda-date-month" }, monthShort.toUpperCase()),
  );
  card.appendChild(datePill);

  // Corps
  const body = el("div", { class: "agenda-body" });
  const cd = countdownInfo(e);
  const header = el("div", { class: "agenda-head" },
    el("span", { class: "agenda-emoji" }, type.emoji),
    el("h4", { class: "agenda-title" }, e.title),
    (cd && cd.cls === "today")
      ? el("span", { class: "agenda-today-pill" }, "Aujourd'hui")
      : (cd ? el("span", { class: "agenda-countdown " + cd.cls }, cd.text) : null),
  );
  body.appendChild(header);

  const meta = el("div", { class: "agenda-meta" });
  meta.appendChild(el("span", { class: "agenda-meta-date" }, eventDateLabel(e)));
  const dur = eventDuration(e);
  if (dur) meta.appendChild(el("span", { class: "agenda-meta-duration" }, " · " + dur));
  if (e.location) meta.appendChild(el("span", { class: "agenda-meta-loc" }, " · 📍 " + e.location));
  body.appendChild(meta);

  if (e.description) {
    body.appendChild(el("p", { class: "agenda-desc" }, e.description));
  }
  card.appendChild(body);

  // Actions admin
  if (admin) {
    const actions = el("div", { class: "agenda-actions" });
    const editBtn = el("button", {
      class: "btn small ghost icon-only",
      "aria-label": "Modifier",
      onClick: () => openEventModal(e, onChanged),
    });
    editBtn.appendChild(icon.settings());
    actions.appendChild(editBtn);

    const delBtn = el("button", {
      class: "btn small danger icon-only",
      "aria-label": "Supprimer",
      onClick: async () => {
        if (!confirm(`Supprimer « ${e.title} » ?`)) return;
        try {
          const snapshot = { ...e };
          delete snapshot.id; delete snapshot.created_at; delete snapshot.updated_at;
          await deleteAgendaEvent(e.id);
          toast("Supprimé · Ctrl+Z pour annuler", "success", 2400);
          recordUndo("événement supprimé", async () => { await addAgendaEvent(snapshot); });
          onChanged();
        } catch (err) { toast(err.message, "error"); }
      }
    });
    delBtn.appendChild(icon.trash());
    actions.appendChild(delBtn);
    card.appendChild(actions);
  }

  return card;
}

let showPast = false;

function rerender(container) {
  clear(container);
  const admin = isAdmin();

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, events.length + " événement" + (events.length > 1 ? "s" : "") + " au calendrier"),
      el("h2", {}, "Calendrier"),
      el("p", { class: "subtitle" }, "Dates importantes : examens, stages, formations, fériés."),
    ),
    admin ? el("button", {
      class: "btn primary",
      onClick: () => openEventModal(null, () => reload(container)),
    }, icon.plus(), "Ajouter un événement") : null,
  ));

  // Filtre passés / à venir
  const filterBar = el("div", { class: "agenda-filters" },
    el("button", {
      class: "filter-pill" + (!showPast ? " active" : ""),
      onClick: () => { showPast = false; rerender(container); },
    }, "À venir"),
    el("button", {
      class: "filter-pill" + (showPast ? " active" : ""),
      onClick: () => { showPast = true; rerender(container); },
    }, "Tout"),
  );
  container.appendChild(filterBar);

  const filtered = showPast ? events : events.filter((e) => !isPast(e));

  if (filtered.length === 0) {
    container.appendChild(el("div", { class: "agenda-empty" },
      el("p", {}, showPast ? "Aucun événement enregistré." : "Aucun événement à venir."),
      admin ? el("p", { class: "muted" }, "Clique « Ajouter un événement » pour commencer.") : null,
    ));
    return;
  }

  // Grouper par mois
  const groups = groupByMonth(filtered);
  groups.forEach((group) => {
    container.appendChild(el("div", { class: "agenda-month" },
      el("h3", { class: "agenda-month-title" }, group.label),
      el("div", { class: "agenda-month-items" },
        ...group.items.map((e) => renderEventCard(e, admin, () => reload(container))),
      ),
    ));
  });
}

async function reload(container) {
  events = await listAgendaEvents();
  rerender(container);
}

export async function renderCalendrier(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  events = await listAgendaEvents();
  rerender(container);
}
