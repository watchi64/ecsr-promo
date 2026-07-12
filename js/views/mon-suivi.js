import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getJoursOff, getSetting,
         listFiches, upsertFiche, getVoitureAggregats, listProfs } from "../db.js?v=20260712i";
import { el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, compareByNom, toast } from "../utils.js?v=20260712i";
import { HALF_DAYS } from "../config.js?v=20260712i";
import { isAdmin, getProfile } from "../auth-admin.js?v=20260712i";
import { getCurrentWho } from "../identity.js?v=20260712i";
import { COMPETENCES_REMC } from "./benevoles.js?v=20260712i";

const HALF_ORDER = { matin: 0, aprem: 1 };

// Fiches/agrégats/profs : chargés une fois par rendu (indépendants de l'élève sélectionné).
let fiches = [];
let aggregats = {};
let profs = [];
const ficheOf = (sid) => fiches.find((f) => f.stagiaire_id === sid) || { stagiaire_id: sid, souhaits: [] };

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

// Jours fériés français (calculés) + jours désactivés manuellement — même logique que le planning.
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

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

// Un jour (index 0..n) de la semaine commençant à `monday` est-il désactivé (manuel) ou férié ?
function dayIsOff(joursOff, monday, day_index) {
  if ((joursOff || []).some((j) => j.day_index === day_index)) return true;
  const date = addDays(monday, day_index);
  return Boolean(frenchHolidays(date.getFullYear())[isoDate(date)]);
}

// Applique la MÊME règle métier que « Valider la semaine » :
// Pédagogie salle -> pédagogue au tableau = Salle ; Voiture (conduite) -> chaque élève = Voiture.
function extractMyPassages(entries, metas, monday, id, joursOff) {
  const out = [];
  (entries || []).forEach((e) => {
    if (dayIsOff(joursOff, monday, e.day_index)) return;
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
  const [e1, m1, off1, e2, m2, off2] = await Promise.all([
    getPlanning(mondayIso), getHalfMetaForWeek(mondayIso), getJoursOff(mondayIso),
    getPlanning(nextIso),   getHalfMetaForWeek(nextIso),   getJoursOff(nextIso),
  ]);
  let items = extractMyPassages(e1, m1, monday1, id, off1);
  if (e2 && e2.length) items = items.concat(extractMyPassages(e2, m2, monday2, id, off2));
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

function avgTier(v) {
  if (v < 8) return "bad";
  if (v < 12) return "warn";
  if (v < 16) return "ok";
  return "great";
}

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

// evals : triés par date croissante, chacun a { norm, note, note_max, date_eval, competence?, type? }
function buildChart(evals) {
  const W = 640, H = 280, padL = 40, padR = 16, padT = 16, padB = 48;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = evals.length;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v) => padT + innerH * (1 - Math.max(0, Math.min(20, v)) / 20);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "ms-chart", role: "img" });

  [0, 5, 10, 15, 20].forEach((v) => {
    const gy = y(v);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: gy, y2: gy, class: "ms-grid" }));
    const lbl = svgEl("text", { x: padL - 6, y: gy + 4, "text-anchor": "end", class: "ms-axis-label" });
    lbl.textContent = String(v);
    svg.appendChild(lbl);
  });

  // Courbe = moyenne cumulée
  let sum = 0;
  const avgPts = evals.map((e, i) => { sum += e.norm; return `${x(i)},${y(sum / (i + 1))}`; });
  svg.appendChild(svgEl("polyline", { points: avgPts.join(" "), class: "ms-avg-line" }));

  // Points = notes individuelles + libellés de date
  const labelStep = Math.ceil(n / 12);
  evals.forEach((e, i) => {
    const c = svgEl("circle", { cx: x(i), cy: y(e.norm), r: 5, class: "ms-pt " + avgTier(e.norm) });
    const title = svgEl("title");
    const lib = e.competence?.libelle || e.type || "Évaluation";
    title.textContent = `${lib} · ${e.note}/${e.note_max} (${e.norm.toFixed(1)}/20) · ${formatDate(e.date_eval)}`;
    c.appendChild(title);
    svg.appendChild(c);

    if (i % labelStep === 0 || i === n - 1) {
      const dl = svgEl("text", { x: x(i), y: H - padB + 18, "text-anchor": "middle", class: "ms-axis-label small" });
      dl.textContent = formatDate(e.date_eval);
      svg.appendChild(dl);
    }
  });

  return svg;
}

function renderChartSection(evaluations) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Mon évolution"));
  const noted = (evaluations || [])
    .filter((e) => e.note != null && e.note_max)
    .map((e) => ({ ...e, norm: (Number(e.note) / Number(e.note_max)) * 20 }))
    .sort((a, b) => String(a.date_eval).localeCompare(String(b.date_eval)) || (a.id - b.id));
  if (noted.length === 0) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Pas encore d'évaluation notée."));
    return section;
  }
  const wrap = el("div", { class: "ms-chart-wrap" });
  wrap.appendChild(buildChart(noted));
  section.appendChild(wrap);
  const avg = Math.round((noted.reduce((s, e) => s + e.norm, 0) / noted.length) * 10) / 10;
  section.appendChild(el("p", { class: "ms-chart-legend muted" },
    `Moyenne actuelle : ${avg}/20 · ${noted.length} évaluation(s)`));
  return section;
}

function renderFicheSection(id, onSaved) {
  const fiche = ficheOf(id);
  const selected = new Set(fiche.souhaits || []);

  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Mes souhaits de compétences (permis B)"));

  const comps = el("div", { class: "suivi-comps" });
  COMPETENCES_REMC.forEach((c) => {
    const det = el("details", { class: "suivi-comp" });
    const mainCb = el("input", { type: "checkbox" });
    mainCb.checked = selected.has(c.code);
    mainCb.addEventListener("change", () => { mainCb.checked ? selected.add(c.code) : selected.delete(c.code); });
    mainCb.addEventListener("click", (ev) => ev.stopPropagation());  // ne pas replier l'accordéon
    det.appendChild(el("summary", {}, el("label", { class: "suivi-comp-main" }, mainCb, ` ${c.code} · ${c.titre}`)));
    c.sous.forEach(([code, libelle]) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = selected.has(code);
      cb.addEventListener("change", () => { cb.checked ? selected.add(code) : selected.delete(code); });
      det.appendChild(el("label", { class: "suivi-souscomp" }, cb, ` ${code} · ${libelle}`));
    });
    comps.appendChild(det);
  });
  section.appendChild(comps);

  const saveBtn = el("button", { class: "btn primary", onClick: async () => {
    try {
      await upsertFiche({ stagiaire_id: id, souhaits: [...selected].sort(), updated_by_who: getCurrentWho() });
      toast("Souhaits enregistrés", "success", 2000);
      fiches = await listFiches();
      if (onSaved) onSaved();
    } catch (e) { console.error(e); toast(e.message, "error"); }
  } }, "Enregistrer mes souhaits");
  section.appendChild(el("div", { style: "margin-top:0.75rem" }, saveBtn));

  return section;
}

function renderHistoriqueSection(id) {
  const a = aggregats[id] || { total: 0, avecEleve: 0, byProf: {} };
  const profLine = Object.entries(a.byProf)
    .map(([pid, n]) => `${profs.find((p) => p.id === Number(pid))?.nom || "?"} ×${n}`)
    .join(" · ") || "—";
  return el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Historique voiture"),
    el("div", { class: "suivi-histo" },
      el("p", {}, `${a.total} passage(s) · dont ${a.avecEleve} avec élève`),
      el("p", { class: "muted" }, "Formateurs : " + profLine),
    ),
  );
}

export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const myId = getProfile()?.stagiaire_id ?? null;
  const needSelector = isAdmin() || myId == null;

  let stagiaires = [];
  const [fichesData, aggregatsData, profsData] = await Promise.all([
    listFiches(), getVoitureAggregats(), listProfs(),
  ]);
  fiches = fichesData; aggregats = aggregatsData; profs = profsData;
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
    const [items, evaluations] = await Promise.all([
      loadUpcoming(id),
      listEvaluations({ stagiaire_id: id }),
    ]);
    clear(body);
    body.appendChild(renderPassagesSection(items));
    body.appendChild(renderFicheSection(id, () => renderFor(id)));
    body.appendChild(renderHistoriqueSection(id));
    body.appendChild(renderChartSection(evaluations));
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
