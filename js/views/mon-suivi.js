import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getJoursOff, getSetting,
         getVoitureAggregats, listProfs, listEpcf, getEpcfMoyennes, listThemes,
         getStagiaire, setDateNaissance } from "../db.js?v=20260720d";
import { el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, compareByNom, toast } from "../utils.js?v=20260720d";
import { HALF_DAYS } from "../config.js?v=20260720d";
import { isAdmin, isProf, getProfile } from "../auth-admin.js?v=20260720d";
import { renderEpcfTrameSection } from "../epcf-restitution.js?v=20260720d";
import { renderSubTabs } from "../subtabs.js?v=20260720d";

const HALF_ORDER = { matin: 0, aprem: 1 };

// Agrégats/profs/moyennes EPCF : chargés une fois par rendu (indépendants de l'élève sélectionné).
let aggregats = {};
let profs = [];
let moySalle = [];
let moyVehicule = [];
// Titre de thème (normalisé) -> numéro, construit depuis les 57 thèmes officiels.
// Sert à retrouver le numéro quand la ligne d'éval ne le porte pas (ou quand un
// « Contrôle » a pour intitulé un thème officiel).
let themeNumByTitre = {};

function normTitre(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function themeNumFor(titre) {
  const n = themeNumByTitre[normTitre(titre)];
  return n == null ? null : n;
}

// Noms des formateurs d'un passage : prof_ids (résolus via `profs`) + prof_autre (texte libre).
function profNamesFor(prof_ids, prof_autre) {
  const names = (prof_ids || [])
    .map((pid) => profs.find((p) => p.id === Number(pid))?.nom)
    .filter(Boolean);
  if (prof_autre) names.push(prof_autre);
  return names;
}

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
    const prof_ids = (e.prof_ids && e.prof_ids.length) ? e.prof_ids : (e.prof_id ? [e.prof_id] : []);
    // Salle 2 groupes : le tableau du groupe 2 anime le sujet du groupe 2 (sujet_2)
    const sujet = (type === "Salle" && e.salle_double && e.pedagogue_id_2 === id)
      ? (e.sujet_2 || null) : (e.sujet || null);
    out.push({
      iso: isoDate(date), date, day_index: e.day_index, half_day: e.half_day,
      slot: e.slot ?? 0, type, sujet,
      horaire: horaireFor(metas, e.day_index, e.half_day),
      profs: profNamesFor(prof_ids, e.prof_autre),
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
        it.profs && it.profs.length
          ? el("span", { class: "ms-passage-prof muted" }, "avec " + it.profs.join(", "))
          : null,
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

// Libellé « thème / compétence / contrôle abordé » d'une évaluation (même logique que la vue Notes).
function describeEval(e) {
  if (e.type === "Thème") {
    // Le numéro peut manquer sur la ligne : on le retrouve via le titre dans les 57 thèmes.
    const n = e.theme_numero ?? themeNumFor(e.theme_titre);
    const num = n ? `Thème ${String(n).padStart(2, "0")}` : "Thème";
    return e.theme_titre ? `${num} · ${e.theme_titre}` : num;
  }
  if (e.type === "Compétence") {
    return e.competence_code ? `${e.competence_code} · ${e.competence?.libelle?.split(",")[0] || ""}` : "Compétence";
  }
  if (e.type === "Contrôle") {
    // Un contrôle porte parfois l'intitulé d'un thème officiel → on affiche son numéro.
    // Sinon on préfixe « Contrôle » : le sujet n'est pas un des 57 thèmes, il n'a donc
    // pas de numéro (et l'absence de numéro n'a plus l'air d'un oubli).
    const n = themeNumFor(e.controle_libelle);
    if (n) return `Thème ${String(n).padStart(2, "0")} · ${e.controle_libelle}`;
    return e.controle_libelle ? `Contrôle · ${e.controle_libelle}` : "Contrôle";
  }
  return "Évaluation";
}

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

// evals : triés par date croissante, chacun a { norm, note, note_max, date_eval, competence?, type? }
// Regroupe les évals (déjà triées par date) par mois calendaire contigu.
function groupByMonth(evals) {
  const groups = [];
  evals.forEach((e, i) => {
    const d = new Date(String(e.date_eval) + "T00:00:00");
    const key = d.getFullYear() + "-" + d.getMonth();
    const last = groups[groups.length - 1];
    if (last && last.key === key) { last.end = i; }
    else groups.push({ key, start: i, end: i,
      label: capitalize(d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })) });
  });
  return groups;
}

// Graphe SVG maison. Largeur dynamique (espace mini par point → scroll horizontal
// si beaucoup d'évals). Bandes de fond alternées par mois + un libellé de mois
// centré sous chaque bande (fini les dates qui se chevauchent). Chaque point porte
// des data-* lus par le tooltip stylé branché dans renderChartSection.
function buildChart(evals) {
  const H = 280, padL = 40, padR = 16, padT = 16, padB = 40;
  const n = evals.length;
  const months = groupByMonth(evals);
  // Largeur mini : 26 px/point ET 46 px/mois (sinon, avec ~1 éval/mois, les bandes
  // deviennent plus étroites que le libellé de mois → chevauchement).
  const innerW = Math.max(540, months.length * 46, (n - 1) * 26);
  const W = padL + padR + innerW, innerH = H - padT - padB;
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v) => padT + innerH * (1 - Math.max(0, Math.min(20, v)) / 20);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: String(W), height: String(H),
    class: "ms-chart", role: "img", "aria-label": "Graphe d'évolution des notes" });

  // Bandes mensuelles (colonnes alternées) + libellé de mois
  months.forEach((m, mi) => {
    const left = m.start === 0 ? padL : (x(m.start) + x(m.start - 1)) / 2;
    const right = m.end === n - 1 ? (W - padR) : (x(m.end) + x(m.end + 1)) / 2;
    if (mi % 2 === 1) svg.appendChild(svgEl("rect",
      { x: left, y: padT, width: Math.max(0, right - left), height: innerH, class: "ms-month-band" }));
    // Libellé toujours affiché pour le 1er et le dernier mois (bandes de bord =
    // demi-largeur) ; pour les mois du milieu, seulement si la bande est assez large.
    if (mi === 0 || mi === months.length - 1 || right - left >= 30) {
      const lbl = svgEl("text", { x: (left + right) / 2, y: H - padB + 20, "text-anchor": "middle", class: "ms-axis-label small" });
      lbl.textContent = m.label;
      svg.appendChild(lbl);
    }
  });

  // Grille + axe Y
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

  // Points visibles (pointer-events désactivés en CSS : ce sont les cibles
  // invisibles ci-dessous qui reçoivent survol et tap).
  evals.forEach((e, i) => {
    svg.appendChild(svgEl("circle", {
      cx: x(i), cy: y(e.norm), r: 5, class: "ms-pt " + avgTier(e.norm), "data-i": String(i),
    }));
  });
  // Cibles de survol/tap, transparentes et plus larges (r=12) : un point de 5px
  // est intappable au doigt. Elles portent les données lues par le tooltip.
  evals.forEach((e, i) => {
    svg.appendChild(svgEl("circle", {
      cx: x(i), cy: y(e.norm), r: 12, class: "ms-pt-hit", "data-i": String(i),
      "data-lib": describeEval(e),
      "data-note": `${e.note}/${e.note_max}`,
      "data-norm": e.norm.toFixed(1),
      "data-date": formatDate(e.date_eval),
    }));
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
  // Conteneur positionné : le graphe scrolle horizontalement à l'intérieur (wrap),
  // le tooltip est posé au niveau de l'outer pour ne pas être coupé par l'overflow.
  const outer = el("div", { class: "ms-chart-outer" });
  const wrap = el("div", { class: "ms-chart-wrap" });
  const svg = buildChart(noted);
  const tip = el("div", { class: "ms-tip" });
  tip.style.display = "none";
  wrap.appendChild(svg);
  outer.appendChild(wrap);
  outer.appendChild(tip);

  // Le point visible correspondant à une cible de tap (même data-i).
  const dotFor = (hit) => svg.querySelector('.ms-pt[data-i="' + hit.getAttribute("data-i") + '"]');
  const showTip = (hit) => {
    const c = dotFor(hit) || hit;
    tip.replaceChildren(
      el("div", { class: "ms-tip-lib" }, hit.getAttribute("data-lib")),
      el("div", { class: "ms-tip-note" }, `${hit.getAttribute("data-note")} · ${hit.getAttribute("data-norm")}/20`),
      el("div", { class: "ms-tip-date" }, hit.getAttribute("data-date")),
    );
    // Affiché d'abord pour pouvoir mesurer sa largeur réelle avant de le clamper.
    tip.style.display = "block";
    const r = c.getBoundingClientRect(), o = outer.getBoundingClientRect();
    // Centre sur le point, puis clampé dans le conteneur visible pour ne pas
    // déborder à gauche (1er point) ni à droite (dernier point).
    const M = 6, tipW = tip.offsetWidth;
    const center = r.left - o.left + r.width / 2;
    tip.style.left = Math.max(M, Math.min(center - tipW / 2, o.width - tipW - M)) + "px";
    // Pas la place au-dessus (point haut) → on bascule le tooltip sous le point.
    const below = (r.top - o.top) < 60;
    tip.classList.toggle("below", below);
    tip.style.top = ((below ? r.bottom : r.top) - o.top) + "px";
    c.classList.add("hover");
  };
  const clearHover = (hit) => { const d = hit && dotFor(hit); if (d) d.classList.remove("hover"); };
  const hideTip = (hit) => { tip.style.display = "none"; clearHover(hit); };
  const isHit = (n) => n && n.classList && n.classList.contains("ms-pt-hit");

  // Sur mobile il n'y a pas de survol : un tap « épingle » le tooltip, qui reste
  // affiché jusqu'au tap suivant (autre point, ou fond du graphe).
  let pinned = null;
  svg.addEventListener("mouseover", (ev) => {
    if (!isHit(ev.target) || pinned) return;
    showTip(ev.target);
  });
  svg.addEventListener("mouseout", (ev) => {
    if (!isHit(ev.target) || pinned) return;
    hideTip(ev.target);
  });
  svg.addEventListener("click", (ev) => {
    if (isHit(ev.target)) {
      if (pinned === ev.target) { hideTip(pinned); pinned = null; return; }   // re-tap : ferme
      if (pinned) clearHover(pinned);
      pinned = ev.target;
      showTip(pinned);
    } else if (pinned) {                        // tap sur le fond du graphe : ferme
      hideTip(pinned);
      pinned = null;
    }
  });

  section.appendChild(outer);
  const avg = Math.round((noted.reduce((s, e) => s + e.norm, 0) / noted.length) * 10) / 10;
  section.appendChild(el("p", { class: "ms-chart-legend muted" },
    `Moyenne actuelle : ${avg}/20 · ${noted.length} évaluation(s)`));
  return section;
}

function renderHistoriqueSection(id) {
  const a = aggregats[id] || { total: 0, avecEleve: 0, byProf: {} };
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Historique voiture"));
  if (!a.total) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Aucun passage voiture pour l'instant."));
    return section;
  }
  const aVide = Math.max(0, a.total - a.avecEleve);
  const pctVide = a.total ? Math.round((aVide / a.total) * 100) : 0;
  const tile = (v, l) => el("div", { class: "histo-stat" },
    el("div", { class: "histo-stat-value" }, String(v)),
    el("div", { class: "histo-stat-label" }, l));

  const card = el("div", { class: "suivi-histo" },
    el("div", { class: "histo-stats" },
      tile(a.total, "passages"),
      tile(a.avecEleve, "avec élève"),
      tile(aVide, "à vide"),
      tile(pctVide + "%", "taux à vide"),
    ));

  const rows = Object.entries(a.byProf)
    .map(([pid, k]) => ({ nom: profs.find((p) => p.id === Number(pid))?.nom || "?", n: k }))
    .sort((x, y) => y.n - x.n);
  if (rows.length) {
    const maxN = Math.max(1, ...rows.map((r) => r.n));
    card.appendChild(el("p", { class: "histo-profs-title" }, "Répartition par formateur"));
    const list = el("div", { class: "histo-profs" });
    rows.forEach((r) => {
      list.appendChild(el("div", { class: "histo-prof-row" },
        el("span", { class: "histo-prof-nom" }, r.nom),
        el("span", { class: "histo-prof-bar" },
          el("span", { class: "histo-prof-bar-fill", style: `width:${Math.round((r.n / maxN) * 100)}%` })),
        el("span", { class: "histo-prof-n muted" }, "×" + r.n),
      ));
    });
    card.appendChild(list);
  }
  section.appendChild(card);
  return section;
}

export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const myId = getProfile()?.stagiaire_id ?? null;
  const needSelector = isAdmin() || myId == null;

  let stagiaires = [];
  const [aggregatsData, profsData, moySalleData, moyVehiculeData, themesData] = await Promise.all([
    getVoitureAggregats(), listProfs(), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule"), listThemes(),
  ]);
  aggregats = aggregatsData; profs = profsData; moySalle = moySalleData; moyVehicule = moyVehiculeData;
  themeNumByTitre = {};
  (themesData || []).forEach((t) => {
    if (t.type === "theme" && t.numero != null && t.titre) themeNumByTitre[normTitre(t.titre)] = t.numero;
  });
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

  // Garde anti-race : chaque rendu obtient un jeton ; après l'await, si un rendu plus
  // récent a démarré (changement d'élève), on abandonne pour ne pas écraser le corps
  // avec les données d'un élève qui n'est plus sélectionné.
  let renderToken = 0;

  async function renderFor(id) {
    const token = ++renderToken;
    clear(body);
    if (id == null) {
      body.appendChild(el("p", { class: "muted" }, "Aucun stagiaire sélectionné."));
      return;
    }
    body.appendChild(el("div", { class: "loading" }, "Chargement"));
    const [items, evaluations, epcfEvals, stagiaireRow] = await Promise.all([
      loadUpcoming(id),
      listEvaluations({ stagiaire_id: id }),
      listEpcf({ stagiaire_id: id }),
      getStagiaire(id),
    ]);
    if (token !== renderToken) return;   // un rendu plus récent a pris la main
    clear(body);

    // Date de naissance du profil : saisie par le stagiaire lui-même (son propre
    // suivi) ou par formateur/admin. Reportée automatiquement sur le livret EPCF.
    if (isAdmin() || isProf() || id === myId) {
      const dob = el("input", { type: "date", value: stagiaireRow?.date_naissance || "" });
      dob.addEventListener("change", async () => {
        try {
          await setDateNaissance(id, dob.value || null);
          toast("Date de naissance enregistrée", "success", 2000);
        } catch (e) { console.error(e); toast(e?.message || String(e), "error"); }
      });
      body.appendChild(el("div", { class: "ms-naissance" },
        el("label", {}, "Date de naissance"), dob,
        el("span", { class: "muted ms-naissance-hint" }, "Reportée automatiquement sur le livret EPCF.")));
    }
    // Sous-onglets : Passages · EPCF · Évolution. Le rendu de chaque onglet est
    // paresseux ; toutes les données sont déjà chargées (closures ci-dessus).
    body.appendChild(renderSubTabs([
      { key: "passages", label: "Passages",
        render: (p) => p.appendChild(renderPassagesSection(items)) },
      { key: "epcf", label: "EPCF", render: (p) => {
          p.appendChild(renderEpcfTrameSection("salle",
            epcfEvals.filter((e) => e.trame === "salle"), moySalle));
          p.appendChild(renderEpcfTrameSection("vehicule",
            epcfEvals.filter((e) => e.trame === "vehicule"), moyVehicule));
        } },
      { key: "evolution", label: "Évolution", render: (p) => {
          p.appendChild(renderHistoriqueSection(id));
          p.appendChild(renderChartSection(evaluations));
        } },
    ], { storageKey: "ecsr_monsuivi_subtab" }));
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
