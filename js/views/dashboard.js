import { listStagiaires, getStats, getSetting } from "../db.js?v=20260713i";
import { el, clear, isoDate, getMonday, displayStagiaire, compareByNom } from "../utils.js?v=20260713i";
import { icon } from "../icons.js?v=20260713i";
import { renderPassages } from "./passages.js?v=20260713i";

const SORT_OPTIONS = [
  { key: "priorite",   label: "Priorité de passage" },
  { key: "alpha",      label: "Alphabétique" },
  { key: "passages",   label: "Plus de passages d'abord" },
];

const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.key));
let currentSort = localStorage.getItem("ecsr_dash_sort");
if (!VALID_SORTS.has(currentSort)) currentSort = "priorite";

function sortEnriched(list, mode) {
  const arr = list.slice();
  switch (mode) {
    case "alpha":
      arr.sort((a, b) => compareByNom(a.s, b.s));
      break;
    case "passages":
      arr.sort((a, b) => (b.sa.effectif + b.vo.effectif) - (a.sa.effectif + a.vo.effectif));
      break;
    case "priorite":
    default:
      // Le plus de retard sur la moyenne d'abord
      arr.sort((a, b) => b.score - a.score || a.s.ordre - b.s.ordre);
      break;
  }
  return arr;
}

// prio = "tours utilisés" = passages faits (+ bonus) + refus/absences. Un refus compte comme un
// tour : il fait perdre la place de prioritaire, mais le vrai compteur (effectif) reste plus bas.
// Comptés UNIQUEMENT depuis les passages enregistrés (table `passages`, via « Valider la
// semaine » ou saisie manuelle) — le planning seul ne compte pas → suivi sans ambiguïté.
function statForType(s, type) {
  const e = s?.[type]?.["Effectué"] || 0;
  const b = s?.[type]?.["Bonus"] || 0;
  const a = s?.[type]?.["Absence"] || 0;
  return { effectif: e, bonus: b, absence: a, prio: e + b + a };
}

function priorityLabel(prio, objectif) {
  return prio >= objectif ? "a-jour" : "a-prioriser";
}

function labelText(key) {
  return { "a-prioriser": "À prioriser", "a-jour": "À jour" }[key];
}

function badgeTitle(stat, objectif) {
  const done = stat.effectif + stat.bonus;
  const detail = stat.absence ? `${done} fait(s) + ${stat.absence} refus/absence` : `${done} fait(s)`;
  return `Compté ${stat.prio} (${detail}) · objectif ${objectif}`;
}

function cardClass(salleKey, voitureKey) {
  return (salleKey === "a-prioriser" || voitureKey === "a-prioriser") ? "urgent" : "ok";
}

function buildStatPill(iconFn, stat) {
  return el("span", { class: "stat-pill" }, iconFn(), String(stat.effectif));
}

function priorityBadge(scope, key, retard, stat, objectif) {
  return el("span", { class: "priority-badge " + key, title: badgeTitle(stat, objectif) },
    el("span", { class: "dot" }),
    el("span", { class: "scope" }, scope),
    el("span", { class: "plabel" }, labelText(key)),
    retard > 0 ? el("span", { class: "retard", title: "retard sur la moyenne" }, "−" + retard) : null,
  );
}

function renderCard(x, objSalle, objVoiture) {
  const { s, sa, vo, prioSalle, prioVoiture, retardSalle, retardVoiture } = x;
  return el("article", { class: "dashboard-card " + cardClass(prioSalle, prioVoiture) },
    el("div", { class: "card-head" },
      el("h3", { class: "name" }, displayStagiaire(s)),
    ),
    el("div", { class: "dashboard-stats" },
      buildStatPill(icon.presentation, sa),
      buildStatPill(icon.car,          vo),
    ),
    el("div", { class: "priority-row" },
      priorityBadge("Salle", prioSalle, retardSalle, sa, objSalle),
      priorityBadge("Voiture", prioVoiture, retardVoiture, vo, objVoiture),
    )
  );
}

function explainPanel(objSalle, objVoiture) {
  return el("details", { class: "dash-explain" },
    el("summary", {}, "Comment la priorité est calculée ?"),
    el("div", { class: "dash-explain-body" },
      el("p", {},
        el("strong", {}, "Les passages se comptent à « Valider la semaine »."),
        " Placer quelqu'un dans le planning, c'est planifier — ça ne compte pas tant que la semaine n'est pas validée. Le tableau de bord n'affiche que les passages enregistrés."),
      el("p", {},
        el("strong", {}, "Objectif = moyenne de la classe"),
        ` (cette semaine : Salle ${objSalle}, Voiture ${objVoiture}). Au niveau ou au-dessus → `,
        el("em", {}, "à jour"), ". En dessous → ", el("em", {}, "à prioriser"),
        " ; plus le retard est grand, plus c'est prioritaire."),
      el("p", {},
        el("strong", {}, "Un refus ou une absence compte comme un tour utilisé."),
        " Il fait perdre sa place de prioritaire — refuser n'est donc pas « gratuit ». Mais le vrai compteur de passages, lui, reste en dessous : on redevient prioritaire dès que la classe avance. ",
        el("strong", {}, "On rattrape son retard, le refus a juste coûté un tour.")),
    ),
  );
}

export async function renderDashboard(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const [stagiaires, stats, semaineLundi] = await Promise.all([
    listStagiaires(),
    getStats(),
    getSetting("current_week_lundi"),
  ]);

  const monday = semaineLundi || isoDate(getMonday(new Date()));

  // Objectif par type = moyenne de classe du compteur de priorité (faits + bonus + refus), arrondie.
  const n = stagiaires.length || 1;
  let sumSalle = 0, sumVoiture = 0;
  stagiaires.forEach((s) => {
    sumSalle += statForType(stats[s.id], "Salle").prio;
    sumVoiture += statForType(stats[s.id], "Voiture").prio;
  });
  const objSalle = Math.round(sumSalle / n);
  const objVoiture = Math.round(sumVoiture / n);

  const enriched = stagiaires.map((s) => {
    const sa = statForType(stats[s.id], "Salle");
    const vo = statForType(stats[s.id], "Voiture");
    const prioSalle = priorityLabel(sa.prio, objSalle);
    const prioVoiture = priorityLabel(vo.prio, objVoiture);
    const retardSalle = Math.max(0, objSalle - sa.prio);
    const retardVoiture = Math.max(0, objVoiture - vo.prio);
    const score = retardSalle + retardVoiture;  // tri priorité : plus de retard d'abord
    return { s, sa, vo, prioSalle, prioVoiture, retardSalle, retardVoiture, score };
  });

  const summary = {
    aPrioriser: enriched.filter((x) => x.prioSalle === "a-prioriser" || x.prioVoiture === "a-prioriser").length,
    aJour:      enriched.filter((x) => x.prioSalle === "a-jour" && x.prioVoiture === "a-jour").length,
  };

  clear(container);

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Semaine du " + new Date(monday + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })),
      el("h2", {}, "Tableau de bord"),
      el("p", { class: "subtitle" }, "Qui doit passer en priorité, par rapport à la moyenne de la classe."),
    ),
  ));

  container.appendChild(explainPanel(objSalle, objVoiture));

  // Toolbar de tri
  const sortSel = el("select", { class: "dash-sort" });
  SORT_OPTIONS.forEach((o) => {
    const opt = el("option", { value: o.key }, o.label);
    if (o.key === currentSort) opt.selected = true;
    sortSel.appendChild(opt);
  });
  const grid = el("div", { class: "dashboard-grid" });
  const fillGrid = () => {
    clear(grid);
    sortEnriched(enriched, currentSort).forEach((x) => grid.appendChild(renderCard(x, objSalle, objVoiture)));
  };
  sortSel.addEventListener("change", () => {
    currentSort = sortSel.value;
    localStorage.setItem("ecsr_dash_sort", currentSort);
    fillGrid();
  });
  container.appendChild(el("div", { class: "dash-toolbar" },
    el("label", {}, "Trier par"),
    sortSel,
  ));

  // Sommaire
  container.appendChild(el("div", { class: "dashboard-meta" },
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(summary.aPrioriser)),
      el("span", { class: "label" }, "À prioriser"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(summary.aJour)),
      el("span", { class: "label" }, "À jour"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, objSalle + " · " + objVoiture),
      el("span", { class: "label" }, "Objectif S · V"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(stagiaires.length)),
      el("span", { class: "label" }, "Stagiaires"),
    ),
  ));

  fillGrid();
  container.appendChild(grid);

  container.appendChild(el("div", { class: "dashboard-legend" },
    el("span", {}, el("span", { class: "dot", style: "background:var(--c-stop)" }), "À prioriser : sous la moyenne (le nombre = retard)"),
    el("span", {}, el("span", { class: "dot", style: "background:var(--c-go)" }), "À jour : au niveau du groupe (≥ moyenne)"),
  ));

  // Historique des passages : fusionné dans le même onglet (c'est la même donnée
  // vue autrement — priorités au-dessus, détail des passages en dessous).
  const passagesSection = el("section", { style: "margin-top:2.5rem" });
  container.appendChild(passagesSection);
  await renderPassages(passagesSection);
}
