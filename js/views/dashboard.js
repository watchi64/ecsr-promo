import { listStagiaires, listEvaluations, getStats, getPedagogueCountsFromPlanning, getSetting } from "../db.js";
import { el, clear, isoDate, getMonday } from "../utils.js";
import { icon } from "../icons.js";

function statForType(s, type, pedaCount = 0) {
  const e = (s?.[type]?.["Effectué"] || 0) + (type === "Salle" ? pedaCount : 0);
  const b = s?.[type]?.["Bonus"] || 0;
  const a = s?.[type]?.["Absence"] || 0;
  return { effectif: e, bonus: b, absence: a };
}

function priorityLabel(stat, maxEffectif) {
  if (stat.effectif >= maxEffectif) return "a-jour";
  if (stat.absence > 0) return "peut-attendre";
  return "a-prioriser";
}

function labelText(key) {
  return { "a-prioriser": "À prioriser", "peut-attendre": "Opportunité ratée", "a-jour": "À jour" }[key];
}

/** Moyenne pondérée /20 des évaluations d'un stagiaire. null si pas d'évaluations notées. */
function computeAverage(evaluations, stagiaireId) {
  const evals = evaluations.filter((e) =>
    e.stagiaire_id === stagiaireId && e.note != null && e.note_max
  );
  if (evals.length === 0) return null;
  // Pondération : ramène chaque note sur 20, puis moyenne arithmétique
  const total = evals.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0);
  return Math.round((total / evals.length) * 10) / 10;  // 1 décimale
}

function avgColor(avg) {
  if (avg == null) return "muted";
  if (avg < 8) return "bad";
  if (avg < 12) return "warn";
  if (avg < 16) return "ok";
  return "great";
}

function cardClass(salleKey, voitureKey) {
  if (salleKey === "a-prioriser" || voitureKey === "a-prioriser") return "urgent";
  if (salleKey === "peut-attendre" || voitureKey === "peut-attendre") return "warn";
  return "ok";
}

function buildStatPill(iconFn, stat) {
  const pill = el("span", { class: "stat-pill" }, iconFn(), String(stat.effectif));
  if (stat.bonus > 0) pill.appendChild(el("span", { class: "add" }, "+" + stat.bonus + "★"));
  if (stat.absence > 0) pill.appendChild(el("span", { class: "miss" }, stat.absence + "✕"));
  return pill;
}

function renderCard(s, statsSalle, statsVoiture, prioSalle, prioVoiture, avg, nbEvals) {
  return el("article", { class: "dashboard-card " + cardClass(prioSalle, prioVoiture) },
    el("div", { class: "card-head" },
      el("h3", { class: "name" }, s.prenom),
      // Moyenne pill
      avg != null
        ? el("span", { class: "avg-pill " + avgColor(avg), title: nbEvals + " évaluation(s)" },
            el("span", { class: "avg-num" }, String(avg)),
            el("span", { class: "avg-max" }, "/20"),
          )
        : el("span", { class: "avg-pill muted", title: "Aucune évaluation" },
            el("span", { class: "avg-num" }, "—"),
          ),
    ),
    el("div", { class: "dashboard-stats" },
      buildStatPill(icon.presentation, statsSalle),
      buildStatPill(icon.car,          statsVoiture),
    ),
    el("div", { class: "priority-row" },
      el("span", { class: "priority-badge " + prioSalle },
        el("span", { class: "dot" }),
        el("span", { class: "scope" }, "Salle"),
        labelText(prioSalle),
      ),
      el("span", { class: "priority-badge " + prioVoiture },
        el("span", { class: "dot" }),
        el("span", { class: "scope" }, "Voiture"),
        labelText(prioVoiture),
      ),
    )
  );
}

export async function renderDashboard(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const [stagiaires, stats, semaineLundi, evaluations] = await Promise.all([
    listStagiaires(),
    getStats(),
    getSetting("current_week_lundi"),
    listEvaluations(),
  ]);

  const monday = semaineLundi || isoDate(getMonday(new Date()));
  const pedaCounts = await getPedagogueCountsFromPlanning(monday);

  // Max par type
  let maxSalle = 0, maxVoiture = 0;
  stagiaires.forEach((s) => {
    const sa = statForType(stats[s.id], "Salle", pedaCounts[s.id] || 0);
    const vo = statForType(stats[s.id], "Voiture");
    if (sa.effectif > maxSalle) maxSalle = sa.effectif;
    if (vo.effectif > maxVoiture) maxVoiture = vo.effectif;
  });

  const enriched = stagiaires.map((s) => {
    const sa = statForType(stats[s.id], "Salle", pedaCounts[s.id] || 0);
    const vo = statForType(stats[s.id], "Voiture");
    const prioSalle = priorityLabel(sa, maxSalle);
    const prioVoiture = priorityLabel(vo, maxVoiture);
    const cls = cardClass(prioSalle, prioVoiture);
    const score = { urgent: 0, warn: 1, ok: 2 }[cls];
    const avg = computeAverage(evaluations, s.id);
    const nbEvals = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null).length;
    return { s, sa, vo, prioSalle, prioVoiture, score, avg, nbEvals };
  });
  enriched.sort((a, b) => a.score - b.score || a.s.ordre - b.s.ordre);

  const stats_summary = {
    urgent: enriched.filter((x) => x.score === 0).length,
    warn:   enriched.filter((x) => x.score === 1).length,
    ok:     enriched.filter((x) => x.score === 2).length,
  };

  clear(container);

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Semaine du " + new Date(monday + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })),
      el("h2", {}, "Tableau de bord"),
      el("p", { class: "subtitle" }, "Qui doit passer en priorité. Calculé à partir de l'historique et du planning en cours."),
    ),
  ));

  // Sommaire
  container.appendChild(el("div", { class: "dashboard-meta" },
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(stats_summary.urgent)),
      el("span", { class: "label" }, "À prioriser"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(stats_summary.warn)),
      el("span", { class: "label" }, "Opportunité ratée"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(stats_summary.ok)),
      el("span", { class: "label" }, "À jour"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(stagiaires.length)),
      el("span", { class: "label" }, "Stagiaires"),
    ),
  ));

  const grid = el("div", { class: "dashboard-grid" });
  enriched.forEach(({ s, sa, vo, prioSalle, prioVoiture, avg, nbEvals }) => {
    grid.appendChild(renderCard(s, sa, vo, prioSalle, prioVoiture, avg, nbEvals));
  });
  container.appendChild(grid);

  container.appendChild(el("div", { class: "dashboard-legend" },
    el("span", {}, el("span", { class: "dot", style: "background:var(--c-stop)" }), "À prioriser : n'a pas encore eu l'occasion de passer"),
    el("span", {}, el("span", { class: "dot", style: "background:var(--c-wait)" }), "Opportunité ratée : a déjà eu sa chance (absence/refus)"),
    el("span", {}, el("span", { class: "dot", style: "background:var(--c-go)" }), "À jour : au niveau du groupe"),
  ));
}
