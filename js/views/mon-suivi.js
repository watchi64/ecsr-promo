import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getSetting } from "../db.js?v=20260712b";
import { el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, compareByNom } from "../utils.js?v=20260712b";
import { HALF_DAYS } from "../config.js?v=20260712b";
import { isAdmin, getProfile } from "../auth-admin.js?v=20260712b";

const HALF_ORDER = { matin: 0, aprem: 1 };

function halfLabel(half) { return half === "matin" ? "Matin" : "Après-midi"; }
function fmtTime(t) { return t ? String(t).slice(0, 5) : null; }        // "09:00:00" -> "09:00"
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function horaireFor(metas, day_index, half) {
  const m = metas.find((x) => x.day_index === day_index && x.half_day === half);
  if (m && m.start_time && m.end_time) return `${fmtTime(m.start_time)}–${fmtTime(m.end_time)}`;
  const def = HALF_DAYS.find((h) => h.key === half);
  return def ? def.label : null;
}

function dayDateLabel(date) {
  return capitalize(date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
}

// Applique la MÊME règle métier que « Valider la semaine » :
// Pédagogie salle -> pédagogue au tableau = Salle ; Voiture (conduite) -> chaque élève = Voiture.
function extractMyPassages(entries, metas, monday, id) {
  const out = [];
  (entries || []).forEach((e) => {
    let type = null;
    if (e.activite === "Pédagogie salle" &&
        (e.pedagogue_id === id || (e.salle_double && e.pedagogue_id_2 === id))) {
      type = "Salle";
    } else if (e.activite === "Voiture (conduite)" && (e.eleves_ids || []).includes(id)) {
      type = "Voiture";
    }
    if (!type) return;
    const date = addDays(monday, e.day_index);
    out.push({
      iso: isoDate(date), date, day_index: e.day_index, half_day: e.half_day,
      slot: e.slot ?? 0, type, sujet: e.sujet || null,
      horaire: horaireFor(metas, e.day_index, e.half_day),
    });
  });
  return out;
}

// Semaine active (settings) + semaine suivante si un planning y existe.
async function loadUpcoming(id) {
  const mondayIso = (await getSetting("current_week_lundi")) || isoDate(getMonday(new Date()));
  const monday1 = new Date(mondayIso + "T00:00:00");
  const nextIso = isoDate(addDays(monday1, 7));
  const monday2 = new Date(nextIso + "T00:00:00");
  const [e1, m1, e2, m2] = await Promise.all([
    getPlanning(mondayIso), getHalfMetaForWeek(mondayIso),
    getPlanning(nextIso),   getHalfMetaForWeek(nextIso),
  ]);
  let items = extractMyPassages(e1, m1, monday1, id);
  if (e2 && e2.length) items = items.concat(extractMyPassages(e2, m2, monday2, id));
  items.sort((a, b) =>
    a.iso.localeCompare(b.iso) ||
    (HALF_ORDER[a.half_day] - HALF_ORDER[b.half_day]) ||
    (a.slot - b.slot));
  return items;
}

function renderPassagesSection(items) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Mes passages à venir"));
  if (items.length === 0) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Aucun passage planifié pour l'instant."));
    return section;
  }
  const todayIso = isoDate(new Date());
  let nextMarked = false;
  const list = el("div", { class: "ms-passage-list" });
  items.forEach((it) => {
    const past = it.iso < todayIso;
    const today = it.iso === todayIso;
    const isNext = !past && !today && !nextMarked;
    if (isNext) nextMarked = true;
    const cls = "ms-passage" + (past ? " past" : "") + (today ? " today" : "") + (isNext ? " next" : "");
    const badge = past ? el("span", { class: "ms-passage-badge muted" }, "passé")
      : today ? el("span", { class: "ms-passage-badge today" }, "aujourd'hui")
      : isNext ? el("span", { class: "ms-passage-badge next" }, "prochain") : null;
    list.appendChild(el("div", { class: cls },
      el("div", { class: "ms-passage-when" },
        el("span", { class: "ms-passage-day" }, dayDateLabel(it.date)),
        el("span", { class: "ms-passage-half muted" },
          halfLabel(it.half_day) + (it.horaire ? " · " + it.horaire : "")),
      ),
      el("div", { class: "ms-passage-meta" },
        el("span", { class: "tag " + (it.type === "Salle" ? "salle" : "voiture") }, it.type),
        it.sujet ? el("span", { class: "ms-passage-sujet muted" }, it.sujet) : null,
        badge,
      ),
    ));
  });
  section.appendChild(list);
  return section;
}

export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const myId = getProfile()?.stagiaire_id ?? null;
  const needSelector = isAdmin() || myId == null;

  let stagiaires = [];
  if (needSelector) stagiaires = (await listStagiaires()).slice().sort(compareByNom);
  const selectedId = myId ?? (stagiaires[0]?.id ?? null);

  clear(container);

  const header = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Espace personnel"),
      el("h2", {}, "Mon suivi"),
      el("p", { class: "subtitle" }, "Mes passages à venir et l'évolution de mes résultats."),
    ),
  );
  container.appendChild(header);

  const body = el("div", { class: "ms-body" });
  container.appendChild(body);

  async function renderFor(id) {
    clear(body);
    if (id == null) {
      body.appendChild(el("p", { class: "muted" }, "Aucun stagiaire sélectionné."));
      return;
    }
    body.appendChild(el("div", { class: "loading" }, "Chargement"));
    const items = await loadUpcoming(id);
    clear(body);
    body.appendChild(renderPassagesSection(items));
  }

  if (needSelector) {
    const sel = el("select", { class: "ms-selector" });
    stagiaires.forEach((s) => {
      const o = el("option", { value: s.id }, displayStagiaire(s));
      if (String(s.id) === String(selectedId)) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => renderFor(Number(sel.value)));
    header.appendChild(el("div", { class: "ms-selector-wrap" },
      el("label", { class: "muted" }, "Élève"), sel));
  }

  await renderFor(selectedId);
}
