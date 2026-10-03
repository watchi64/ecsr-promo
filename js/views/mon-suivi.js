import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getJoursOff, getSetting,
         listProfs, listEpcf, getEpcfMoyennes, listThemes,
         getStagiaire, setDateNaissance, listPassages,
         listLivretsIndex, listDossiersIndex } from "../db.js?v=20261003b";
import { el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, toast } from "../utils.js?v=20261003b";
import { HALF_DAYS, RESULTATS } from "../config.js?v=20261003b";
import { isAdmin, isProf, monStagiaireId } from "../auth-admin.js?v=20261003b";
import { renderEpcfTrameSection } from "../epcf-restitution.js?v=20261003b";
import { renderSubTabs } from "../subtabs.js?v=20261003b";
import { renderDp } from "./dp.js?v=20261003b";
import { renderEpcfLivret } from "./epcf-livret.js?v=20261003b";
import { rolesPourEntry, ROLE_ORDER } from "../creneaux-rules.js?v=20261003b";
import { statsPassages } from "../passages-stats.js?v=20261003b";
import { moduleVisible, moduleMasque, repereMasque } from "../modules-etat.js?v=20261003b";
import { icon } from "../icons.js?v=20261003b";
import { PARTIES, lireAdresse, adresseFiche } from "../route-rules.js?v=20261003b";
import { etatsSommaire, passagesAVenir, EVT_DOCUMENT } from "../fiche-rules.js?v=20261003b";
import { surChangementAdresse, remplacerAdresse, peutQuitter } from "../navigation.js?v=20261003b";

const HALF_ORDER = { matin: 0, aprem: 1 };

// Profs/moyennes EPCF : chargés une fois par rendu (indépendants de l'élève sélectionné).
let profs = [];
let moySalle = [];
let moyVehicule = [];
// id stagiaire -> "V. Timy" : sert à nommer le stagiaire au tableau sur les
// créneaux où l'utilisateur est élève.
let stagiaireNoms = {};
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

// Jours fériés français (calculés) + jours désactivés manuellement : même logique que le planning.
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

// Créneaux du stagiaire sur une semaine : ses passages (tableau salle, conduite,
// MÊME règle métier que « Valider la semaine ») ET les demi-journées où il est
// simplement élève dans la salle. Le rôle est porté par le champ `role` :
// seul `passage` compte comme un passage, `eleve` est de l'affichage.
function extractMyCreneaux(entries, metas, monday, id, joursOff) {
  const out = [];
  (entries || []).forEach((e) => {
    if (dayIsOff(joursOff, monday, e.day_index)) return;
    const roles = rolesPourEntry(e, id);
    if (!roles.length) return;
    const date = addDays(monday, e.day_index);
    const prof_ids = (e.prof_ids && e.prof_ids.length) ? e.prof_ids : (e.prof_id ? [e.prof_id] : []);
    const base = {
      iso: isoDate(date), date, day_index: e.day_index, half_day: e.half_day,
      slot: e.slot ?? 0,
      horaire: horaireFor(metas, e.day_index, e.half_day),
      profs: profNamesFor(prof_ids, e.prof_autre),
    };
    roles.forEach((r) => out.push({ ...base, ...r }));
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
  let items = extractMyCreneaux(e1, m1, monday1, id, off1);
  if (e2 && e2.length) items = items.concat(extractMyCreneaux(e2, m2, monday2, id, off2));
  items.sort((a, b) =>
    a.iso.localeCompare(b.iso) ||
    (HALF_ORDER[a.half_day] - HALF_ORDER[b.half_day]) ||
    (a.slot - b.slot) ||
    (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]));
  return items;
}

const TAG_CLASS = { Salle: "salle", Voiture: "voiture", "Élève salle": "eleve" };

// « au tableau : M. Marie · Croisement, puis P. Paul · Priorités » : une vague
// par groupe où le stagiaire est élève. Nom ou sujet manquant : on affiche ce
// qui existe ; les deux manquants : la vague est passée sous silence.
function tableauxLabel(waves) {
  const parts = (waves || [])
    .map((w) => [w.tableau_id != null ? stagiaireNoms[w.tableau_id] : null, w.sujet]
      .filter(Boolean).join(" · "))
    .filter(Boolean);
  if (!parts.length) return null;
  return "au tableau : " + parts[0] + (parts[1] ? ", puis " + parts[1] : "");
}

function renderPassagesSection(items, soi = true) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, soi ? "Mon planning à venir" : "Planning à venir"));
  if (items.length === 0) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Aucun créneau planifié pour l'instant."));
    return section;
  }
  const todayIso = isoDate(new Date());
  let nextMarked = false;
  const list = el("div", { class: "ms-passage-list" });
  items.forEach((it) => {
    const eleve = it.role === "eleve";
    const past = it.iso < todayIso;
    const today = it.iso === todayIso;
    // « prochain » repère le prochain VRAI passage : une présence en salle ne
    // doit pas lui voler la place.
    const isNext = !past && !today && !nextMarked && !eleve;
    if (isNext) nextMarked = true;
    const cls = "ms-passage" + (eleve ? " eleve" : "") + (past ? " past" : "")
      + (today ? " today" : "") + (isNext ? " next" : "");
    const badge = past ? el("span", { class: "ms-passage-badge muted" }, "passé")
      : today ? el("span", { class: "ms-passage-badge today" }, "aujourd'hui")
      : isNext ? el("span", { class: "ms-passage-badge next" }, "prochain") : null;
    const detail = eleve ? tableauxLabel(it.waves) : it.sujet;
    list.appendChild(el("div", { class: cls },
      el("div", { class: "ms-passage-when" },
        el("span", { class: "ms-passage-day" }, dayDateLabel(it.date)),
        el("span", { class: "ms-passage-half muted" },
          halfLabel(it.half_day) + (it.horaire ? " · " + it.horaire : "")),
      ),
      el("div", { class: "ms-passage-meta" },
        el("span", { class: "tag " + (TAG_CLASS[it.type] || "") }, it.type),
        it.profs && it.profs.length
          ? el("span", { class: "ms-passage-prof muted" }, "avec " + it.profs.join(", "))
          : null,
        detail ? el("span", { class: "ms-passage-sujet muted" }, detail) : null,
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

function renderChartSection(evaluations, soi = true) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, soi ? "Mon évolution" : "Évolution"));
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

// « Passages effectués » : compteurs (règle d'équité) + historique détaillé, depuis
// la MÊME liste listPassages : compteurs et lignes toujours cohérents entre eux.
// Remplace l'« Historique voiture » qui vivait dans l'onglet Évolution : les tuiles
// et la répartition par formateur déménagent ici, avec la salle en plus.
function renderEffectuesSection(rows, soi = true) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, soi ? "Mes passages effectués" : "Passages effectués"));
  if (!rows || !rows.length) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Aucun passage enregistré pour l'instant."));
    return section;
  }
  const s = statsPassages(rows);

  const tile = (v, l) => el("div", { class: "histo-stat" },
    el("div", { class: "histo-stat-value" }, String(v)),
    el("div", { class: "histo-stat-label" }, l));
  const card = el("div", { class: "suivi-histo" },
    el("div", { class: "histo-stats" },
      tile(s.salle, "salle"),
      tile(s.voiture, "voiture"),
      tile(s.avecEleve, "avec élève"),
    ));

  // Répartition par formateur (voiture) : mêmes classes CSS que l'ancien historique.
  const profRows = Object.entries(s.byProf)
    .map(([pid, k]) => ({ nom: profs.find((p) => p.id === Number(pid))?.nom || "?", n: k }))
    .sort((x, y) => y.n - x.n);
  if (profRows.length) {
    const maxN = Math.max(1, ...profRows.map((r) => r.n));
    card.appendChild(el("p", { class: "histo-profs-title" }, "Voiture · répartition par formateur"));
    const list = el("div", { class: "histo-profs" });
    profRows.forEach((r) => {
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

  // Historique détaillé : rows déjà triées date desc par listPassages. Les lignes
  // non comptées (Bonus/Report) sont listées quand même, leur tag dit leur statut.
  const list = el("div", { class: "ms-histo-list" });
  rows.forEach((p) => {
    const res = RESULTATS.find((r) => r.value === p.resultat);
    list.appendChild(el("div", { class: "ms-histo-item" },
      el("span", { class: "ms-histo-date" }, formatDate(p.date)),
      el("span", { class: "tag " + (p.type === "Salle" ? "salle" : "voiture") }, p.type),
      el("span", { class: "tag " + (res?.color || "") }, p.resultat),
      p.commentaire ? el("span", { class: "ms-histo-comment muted" }, p.commentaire) : null,
    ));
  });
  section.appendChild(list);
  return section;
}

// === La fiche d'une personne (chantier D, lot 2) ===
// Partagée par Mon espace (sa propre fiche) et la page Stagiaires (la fiche d'un
// stagiaire, vue par un formateur). Deux dispositions, choisies à l'affichage :
// onglets sur ordinateur ; sur iPhone, un sommaire puis la partie en plein écran.

const LIBELLE_PARTIE = { passages: "Passages", epcf: "EPCF", evolution: "Évolution", livret: "Livret", dp: "Dossier pro" };
// Module de chaque partie (js/modules-data.js) : fermé pour la promo, la partie
// disparaît chez un stagiaire et porte le repère chez un formateur.
const MODULE_DE_PARTIE = { passages: null, epcf: "epcf", evolution: "notes", livret: "livret", dp: "dp" };

export function dispositionFiche() {
  return window.matchMedia("(max-width: 760px)").matches ? "sommaire" : "onglets";
}

// Contexte commun à toutes les fiches (formateurs, moyennes EPCF de la classe,
// thèmes, noms) : une lecture par ouverture de page. Renvoie les stagiaires actifs.
export async function chargerContexteFiche() {
  const [profsData, moySalleData, moyVehiculeData, themesData, stagiairesData] = await Promise.all([
    listProfs(), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule"), listThemes(), listStagiaires(),
  ]);
  profs = profsData; moySalle = moySalleData; moyVehicule = moyVehiculeData;
  themeNumByTitre = {};
  (themesData || []).forEach((t) => {
    if (t.type === "theme" && t.numero != null && t.titre) themeNumByTitre[normTitre(t.titre)] = t.numero;
  });
  stagiaireNoms = {};
  (stagiairesData || []).forEach((s) => { stagiaireNoms[s.id] = displayStagiaire(s); });
  return stagiairesData || [];
}

// Données d'une personne, pour toutes les parties de sa fiche.
export async function chargerFiche(id) {
  const [items, evaluations, epcfEvals, stagiaireRow, passRows, livrets, dossiers] = await Promise.all([
    loadUpcoming(id),
    listEvaluations({ stagiaire_id: id }),
    listEpcf({ stagiaire_id: id }),
    getStagiaire(id),
    listPassages({ stagiaire_id: id }),
    listLivretsIndex({ stagiaire_id: id }),
    listDossiersIndex({ stagiaire_id: id }),
  ]);
  return { id, items, evaluations, epcfEvals, stagiaireRow, passRows,
    livret: (livrets || [])[0] || null, dossier: (dossiers || [])[0] || null };
}

// Livret ou dossier enregistré (événement EVT_DOCUMENT) : l'état de la fiche suit.
export function noterDocument(d, detail) {
  if (!d || !detail || detail.stagiaireId !== d.id) return false;
  const ligne = { stagiaire_id: d.id, updated_at: detail.updatedAt };
  if (detail.genre === "livret") d.livret = ligne;
  else if (detail.genre === "dossier") d.dossier = ligne;
  else return false;
  return true;
}

// Une seule écoute pour toute l'app : la page affichée y branche son traitement.
let surDocument = null;
let ecouteDocumentsPosee = false;
export function ecouterDocuments(fn) {
  surDocument = fn;
  if (ecouteDocumentsPosee) return;
  document.addEventListener(EVT_DOCUMENT, (e) => { if (surDocument) surDocument(e.detail); });
  ecouteDocumentsPosee = true;
}

// Boîte d'erreur de chargement, dans la zone donnée (l'en-tête reste utilisable).
export function afficherErreur(zone, e, reessayer) {
  console.error(e);
  clear(zone);
  const isTimeout = /abort|timeout|network|fetch/i.test(e?.message || String(e));
  const retry = el("button", { class: "btn primary" }, "Réessayer");
  retry.addEventListener("click", () => reessayer());
  zone.appendChild(el("div", { class: "view-error-box" },
    el("p", { class: "view-error-title" }, isTimeout ? "Connexion trop lente" : "Une erreur est survenue"),
    el("p", { class: "view-error-sub" }, isTimeout
      ? "Le serveur n'a pas répondu à temps. Vérifie ta connexion et réessaie."
      : "Détail : " + (e?.message || e)),
    retry));
  toast(isTimeout ? "Connexion trop lente, réessaie" : (e?.message || String(e)), "error");
}

function partiesVisibles() {
  return PARTIES.filter((p) => !MODULE_DE_PARTIE[p] || moduleVisible(MODULE_DE_PARTIE[p]));
}

function lienRetour(label, href) {
  return el("a", { class: "fiche-retour", href }, icon.chevronLeft(), el("span", {}, label));
}

export function renderFiche(container, d, opts) {
  clear(container);
  const parties = partiesVisibles();
  const partie = parties.includes(opts.partie) ? opts.partie : null;
  if (opts.disposition === "onglets") {
    if (opts.titre) container.appendChild(el("h2", { class: "fiche-titre" }, opts.titre));
    container.appendChild(renderSubTabs(parties.map((p) => ({
      key: p, label: LIBELLE_PARTIE[p], module: MODULE_DE_PARTIE[p] || undefined,
      render: (panel, ctx) => rendrePartie(panel, p, d, opts, ctx),
    })), {
      activeKey: partie || undefined,
      storageKey: opts.storageKey,
      // L'onglet choisi s'inscrit dans l'adresse, sans étape d'historique.
      onChange: (p) => remplacerAdresse(opts.adresse(p)),
      avantChangement: () => peutQuitter(),
    }));
    return;
  }
  if (partie) {
    // iPhone, une partie en plein écran : le retour mène au sommaire.
    container.appendChild(lienRetour(opts.titre || "Mon espace", opts.adresse(null)));
    container.appendChild(el("h2", { class: "fiche-titre" }, LIBELLE_PARTIE[partie]));
    const panel = el("div", { class: "fiche-partie" });
    container.appendChild(panel);
    rendrePartie(panel, partie, d, opts, { isActive: () => panel.isConnected });
    return;
  }
  // iPhone : le sommaire.
  if (opts.retour) container.appendChild(lienRetour(opts.retour.label, opts.retour.href));
  if (opts.titre) container.appendChild(el("h2", { class: "fiche-titre" }, opts.titre));
  container.appendChild(rendreSommaire(d, parties, opts));
}

function rendreSommaire(d, parties, opts) {
  const etats = etatsSommaire({
    aVenir: passagesAVenir(d.items, isoDate(new Date())),
    evals: d.epcfEvals, livret: d.livret, dossier: d.dossier, soi: !!opts.soi,
  });
  const liste = el("nav", { class: "fiche-sommaire", "aria-label": "Parties de la fiche" });
  parties.forEach((p) => {
    const etat = etats[p];
    const nom = el("span", { class: "fiche-ligne-nom" }, LIBELLE_PARTIE[p]);
    const ligne = el("a", { class: "fiche-ligne", href: opts.adresse(p) },
      nom,
      etat ? el("span", { class: "fiche-ligne-etat" + (etat.afaire ? " afaire" : "") }, etat.texte) : null,
      icon.chevronRight());
    if (MODULE_DE_PARTIE[p]) repereMasque(ligne, moduleMasque(MODULE_DE_PARTIE[p]), nom);
    liste.appendChild(ligne);
  });
  return liste;
}

// Date de naissance du profil, reportée sur le livret : la personne elle-même,
// un formateur ou un admin la saisit. Rangée dans la partie Livret, seule à s'en servir.
function champNaissance(d, soi) {
  if (!(soi || isAdmin() || isProf())) return null;
  const dob = el("input", { type: "date", value: d.stagiaireRow?.date_naissance || "" });
  dob.addEventListener("change", async () => {
    try {
      await setDateNaissance(d.id, dob.value || null);
      if (d.stagiaireRow) d.stagiaireRow.date_naissance = dob.value || null;
      toast("Date de naissance enregistrée", "success", 2000);
    } catch (e) { console.error(e); toast(e?.message || String(e), "error"); }
  });
  return el("div", { class: "ms-naissance" },
    el("label", {}, "Date de naissance"), dob,
    el("span", { class: "muted ms-naissance-hint" }, "Reportée automatiquement sur le livret EPCF."));
}

function erreurPartie(zone, isActive, texte) {
  return (e) => {
    console.error(e);
    if (!isActive || isActive()) {
      clear(zone);
      zone.appendChild(el("p", { class: "muted" }, texte));
    }
  };
}

// Contenu d'une partie. ctx.isActive : faux si l'on est passé à autre chose
// pendant un chargement (la partie ne doit plus écrire).
function rendrePartie(panel, partie, d, opts, ctx) {
  const isActive = ctx && ctx.isActive;
  const soi = !!opts.soi;
  if (partie === "passages") {
    panel.appendChild(renderPassagesSection(d.items, soi));
    panel.appendChild(renderEffectuesSection(d.passRows, soi));
  } else if (partie === "epcf") {
    panel.appendChild(renderEpcfTrameSection("salle", d.epcfEvals.filter((e) => e.trame === "salle"), moySalle));
    panel.appendChild(renderEpcfTrameSection("vehicule", d.epcfEvals.filter((e) => e.trame === "vehicule"), moyVehicule));
  } else if (partie === "evolution") {
    panel.appendChild(renderChartSection(d.evaluations, soi));
  } else if (partie === "livret") {
    const naissance = champNaissance(d, soi);
    if (naissance) panel.appendChild(naissance);
    const zone = el("div");
    panel.appendChild(zone);
    renderEpcfLivret(zone, { stagiaireId: d.id, embedded: true, isActive })
      .catch(erreurPartie(zone, isActive, "Erreur de chargement du livret EPCF. Rouvre la partie pour réessayer."));
  } else if (partie === "dp") {
    // Le DP appartient au candidat : éditable dans son espace ; un formateur
    // peut aussi y écrire pour l'accompagner (droits révisés le 16/09).
    renderDp(panel, { stagiaireId: d.id, embedded: true, isActive })
      .catch(erreurPartie(panel, isActive, "Erreur de chargement du dossier professionnel. Rouvre la partie pour réessayer."));
  }
}

// === Mon espace : la fiche de la personne connectée ===
export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const monId = monStagiaireId();
  await chargerContexteFiche();
  clear(container);

  const header = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Espace personnel"),
      el("h2", {}, "Mon espace"),
      el("p", { class: "subtitle" }, moduleVisible("notes")
        ? "Mon planning à venir et l'évolution de mes résultats."
        : "Mon planning à venir."),
    ),
  );
  const corps = el("div", { class: "ms-body" });
  container.appendChild(header);
  container.appendChild(corps);
  if (monId == null) {
    corps.appendChild(el("p", { class: "muted" }, "Aucun profil stagiaire n'est relié à ce compte."));
    return;
  }

  let d = null;
  const dessiner = (adr) => {
    const disposition = dispositionFiche();
    // iPhone, dans une partie : le retour « ‹ Mon espace » remplace l'en-tête.
    header.hidden = disposition === "sommaire" && !!adr.partie;
    renderFiche(corps, d, {
      soi: true, partie: adr.partie, disposition, titre: null, retour: null,
      adresse: (p) => adresseFiche("mon-suivi", null, p),
      storageKey: "ecsr_monsuivi_subtab",
    });
    if (disposition === "sommaire") window.scrollTo(0, 0);
  };
  const charger = async () => {
    clear(corps);
    corps.appendChild(el("div", { class: "loading" }, "Chargement"));
    try { d = await chargerFiche(monId); }
    catch (e) { afficherErreur(corps, e, charger); return; }
    dessiner(lireAdresse(location.hash));
  };
  surChangementAdresse("mon-suivi", async (adr) => { if (d) dessiner(adr); });
  ecouterDocuments((detail) => { noterDocument(d, detail); });
  await charger();
}
