import { listStagiaires, getStats, getPedagogueCountsFromPlanning, getSetting } from "../db.js";
import { el, clear, isoDate, getMonday } from "../utils.js";

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
  return { "a-prioriser": "À prioriser", "peut-attendre": "Peut attendre", "a-jour": "À jour" }[key];
}

function priorityClass(salleKey, voitureKey) {
  if (salleKey === "a-prioriser" || voitureKey === "a-prioriser") return "priority-a-prioriser";
  if (salleKey === "peut-attendre" || voitureKey === "peut-attendre") return "priority-peut-attendre";
  return "priority-a-jour";
}

function renderCard(s, statsSalle, statsVoiture, prioSalle, prioVoiture) {
  return el("div", { class: "dashboard-card " + priorityClass(prioSalle, prioVoiture) },
    el("div", { class: "name" }, s.prenom),
    el("div", { class: "stats" },
      el("span", { class: "stat" },
        "🪑 " + statsSalle.effectif + " ✅",
        statsSalle.bonus > 0 ? el("span", { class: "bonus" }, "+" + statsSalle.bonus + "⭐") : null,
        statsSalle.absence > 0 ? el("span", { class: "miss" }, statsSalle.absence + "❌") : null
      ),
      el("span", { class: "stat" },
        "🚗 " + statsVoiture.effectif + " ✅",
        statsVoiture.bonus > 0 ? el("span", { class: "bonus" }, "+" + statsVoiture.bonus + "⭐") : null,
        statsVoiture.absence > 0 ? el("span", { class: "miss" }, statsVoiture.absence + "❌") : null
      ),
    ),
    el("div", { class: "priority-badges" },
      el("span", { class: "priority-badge " + prioSalle },
        el("span", { class: "label-type" }, "Salle"),
        labelText(prioSalle)
      ),
      el("span", { class: "priority-badge " + prioVoiture },
        el("span", { class: "label-type" }, "Voiture"),
        labelText(prioVoiture)
      ),
    )
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
  const pedaCounts = await getPedagogueCountsFromPlanning(monday);

  // Calculer le max pour chaque type
  let maxSalle = 0, maxVoiture = 0;
  stagiaires.forEach((s) => {
    const sa = statForType(stats[s.id], "Salle", pedaCounts[s.id] || 0);
    const vo = statForType(stats[s.id], "Voiture");
    if (sa.effectif > maxSalle) maxSalle = sa.effectif;
    if (vo.effectif > maxVoiture) maxVoiture = vo.effectif;
  });

  // Trier : 🔴 d'abord, puis 🟠, puis 🟢
  const enriched = stagiaires.map((s) => {
    const sa = statForType(stats[s.id], "Salle", pedaCounts[s.id] || 0);
    const vo = statForType(stats[s.id], "Voiture");
    const prioSalle = priorityLabel(sa, maxSalle);
    const prioVoiture = priorityLabel(vo, maxVoiture);
    const score = ["a-prioriser", "peut-attendre", "a-jour"].indexOf(
      priorityClass(prioSalle, prioVoiture).replace("priority-", "")
    );
    return { s, sa, vo, prioSalle, prioVoiture, score };
  });
  enriched.sort((a, b) => a.score - b.score || a.s.ordre - b.s.ordre);

  clear(container);

  container.appendChild(el("div", { class: "view-header" },
    el("h2", {}, "📊 Tableau de bord"),
    el("p", { class: "subtitle" }, "Qui doit passer la semaine prochaine ?")
  ));

  const grid = el("div", { class: "dashboard-grid" });
  enriched.forEach(({ s, sa, vo, prioSalle, prioVoiture }) => {
    grid.appendChild(renderCard(s, sa, vo, prioSalle, prioVoiture));
  });
  container.appendChild(grid);

  const legend = el("p", { class: "muted", style: "margin-top:1.5rem;font-size:0.9rem;text-align:center" },
    "🔴 À prioriser : pas encore eu l'occasion de passer  ·  🟠 Peut attendre : a déjà eu une opportunité  ·  🟢 À jour"
  );
  container.appendChild(legend);
}
