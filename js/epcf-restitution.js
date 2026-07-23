// Restitution EPCF : scoring des phases, radar SVG, section réutilisable
// (affichée dans Mon suivi ; réutilisable ailleurs).

import { el, clear, formatDate } from "./utils.js?v=20260723b";
import { EPCF_TRAMES, NOTE_VALUES, NOTE_LABELS, EPCF_PHASE_COLORS } from "./epcf-trames.js?v=20260723b";

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

// Score 0..1 d'une phase pour UNE éval ({code:'A'|'R'|'NA'}). null si rien de renseigné.
export function phaseScore(section, scores) {
  const vals = section.criteres
    .map((c) => NOTE_VALUES[scores?.[c.code]])
    .filter((v) => v !== undefined);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / (vals.length * 2);
}

// Score 0..1 d'une phase depuis les moyennes RPC ([{critere, moyenne, effectif}]).
// `moyenne` est sur 0..2 (A=2) et peut arriver en string (numeric PostgREST).
export function phaseScoreFromMoyennes(section, moyennes) {
  const byCode = Object.fromEntries((moyennes || []).map((m) => [m.critere, Number(m.moyenne)]));
  const vals = section.criteres.map((c) => byCode[c.code]).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / (vals.length * 2);
}

// Radar SVG. axes = [libellé] OU [{ label, color }] ; series = [{ values: [0..1|null], className }].
// Une phase non renseignée est tracée à 0 (le détail dessous fait foi).
export function buildRadar(axes, series, size = 340) {
  const padX = 40;                          // marge horizontale pour les labels des axes latéraux
  const W = size + 2 * padX;                // 420, aligné sur le max-width CSS du wrap
  const cx = W / 2, cy = size / 2 + 4, R = size * 0.32;
  const n = axes.length;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const px = (i, f) => cx + Math.cos(ang(i)) * R * f;
  const py = (i, f) => cy + Math.sin(ang(i)) * R * f;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${size}`, class: "epcf-radar", role: "img",
    "aria-label": "Radar EPCF" });
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    const pts = Array.from({ length: n }, (_, i) => `${px(i, f)},${py(i, f)}`).join(" ");
    svg.appendChild(svgEl("polygon", { points: pts, class: "epcf-radar-ring" }));
  });
  axes.forEach((a, i) => {
    const label = typeof a === "string" ? a : a.label;
    const color = typeof a === "object" && a.color ? a.color : null;
    const spoke = svgEl("line", { x1: cx, y1: cy, x2: px(i, 1), y2: py(i, 1), class: "epcf-radar-spoke" });
    if (color) spoke.setAttribute("stroke", color);
    svg.appendChild(spoke);
    const c = Math.cos(ang(i));
    const t = svgEl("text", {
      x: px(i, 1.14), y: py(i, 1.14), class: "epcf-radar-label",
      "text-anchor": Math.abs(c) < 0.3 ? "middle" : (c > 0 ? "start" : "end"),
    });
    if (color) t.setAttribute("fill", color);
    t.textContent = label;
    svg.appendChild(t);
  });
  series.forEach((s) => {
    const pts = s.values.map((v, i) => `${px(i, v ?? 0)},${py(i, v ?? 0)}`).join(" ");
    svg.appendChild(svgEl("polygon", { points: pts, class: "epcf-radar-serie " + s.className }));
  });
  return svg;
}

// Détail par critère d'une éval : sections, chips Acquis / À renforcer / Non acquis.
export function renderEpcfDetail(trameKey, evalRow) {
  const trame = EPCF_TRAMES[trameKey];
  const wrap = el("div", { class: "epcf-detail" });
  trame.sections.forEach((sec) => {
    const color = EPCF_PHASE_COLORS[sec.code] || null;
    const box = el("div", { class: "epcf-detail-section" },
      el("h5", { class: "epcf-detail-title" }, sec.titre,
        sec.competenceTP ? el("span", { class: "muted epcf-detail-tp" }, " — " + sec.competenceTP) : null));
    if (color) {
      box.style.borderLeftColor = color;
      box.querySelector(".epcf-detail-title").style.color = color;
    }
    sec.criteres.forEach((c) => {
      const note = evalRow.scores?.[c.code];
      box.appendChild(el("div", { class: "epcf-detail-row" },
        el("span", { class: "epcf-chip " + (note || "vide") }, note ? NOTE_LABELS[note] : "—"),
        el("span", {}, c.libelle),
      ));
    });
    wrap.appendChild(box);
  });
  const comps = evalRow.competences_acquises || [];
  if (comps.length) {
    wrap.appendChild(el("p", { class: "epcf-comps" }, "Compétences acquises : ",
      el("strong", {}, comps.join(", "))));
  }
  if (evalRow.commentaire) {
    wrap.appendChild(el("p", { class: "epcf-commentaire" },
      el("strong", {}, "Commentaire : "), evalRow.commentaire));
  }
  return wrap;
}

// Section complète pour UNE trame : radar (éval choisie vs moyenne groupe) + détail.
// evals : évals du stagiaire pour cette trame, triées desc (listEpcf). moyennes : RPC.
// ATTENTION : moyennes DOIT venir de getEpcfMoyennes(trameKey) — les codes critères collisionnent entre trames.
export function renderEpcfTrameSection(trameKey, evals, moyennes) {
  const trame = EPCF_TRAMES[trameKey];
  const section = el("div", { class: "epcf-resti" },
    el("h4", { class: "epcf-resti-title" }, "EPCF " + trame.label));
  if (!evals.length) {
    section.appendChild(el("p", { class: "muted" }, "Pas encore d'évaluation " + trame.label.toLowerCase() + "."));
    return section;
  }
  const body = el("div");
  section.appendChild(body);

  const show = (evalRow) => {
    clear(body);
    const axes = trame.sections.map((s) => ({ label: s.court, color: EPCF_PHASE_COLORS[s.code] }));
    const serieMoi = { values: trame.sections.map((s) => phaseScore(s, evalRow.scores)), className: "moi" };
    const series = [serieMoi];
    const maxEffectif = Math.max(0, ...(moyennes || []).map((m) => m.effectif));
    if (maxEffectif >= 2) {
      series.unshift({ values: trame.sections.map((s) => phaseScoreFromMoyennes(s, moyennes)), className: "groupe" });
    }
    body.appendChild(el("div", { class: "epcf-radar-wrap" }, buildRadar(axes, series)));
    body.appendChild(el("p", { class: "epcf-legende muted" },
      el("span", { class: "epcf-leg moi" }), " Moi",
      maxEffectif >= 2 ? el("span", {}, "  ·  ") : null,
      maxEffectif >= 2 ? el("span", { class: "epcf-leg groupe" }) : null,
      maxEffectif >= 2 ? " Moyenne du groupe" : null,
    ));
    body.appendChild(el("p", { class: "muted epcf-eval-meta" },
      `Évaluation du ${formatDate(evalRow.date_eval)}` +
      (evalRow.evaluateur?.nom ? ` · par ${evalRow.evaluateur.nom}` : "")));
    body.appendChild(renderEpcfDetail(trameKey, evalRow));
  };

  if (evals.length > 1) {
    const sel = el("select", { class: "epcf-eval-select" });
    evals.forEach((ev, i) => {
      const o = el("option", { value: String(i) }, formatDate(ev.date_eval) + (ev.evaluateur?.nom ? " — " + ev.evaluateur.nom : ""));
      if (i === 0) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => show(evals[Number(sel.value)]));
    section.insertBefore(el("div", { class: "epcf-eval-select-wrap" }, sel), body);
  }
  show(evals[0]);
  return section;
}

// Tier couleur d'une moyenne 0..2 (frontières : ≥1.5 acquis, ≥0.8 à renforcer).
export function tierOf(moyenne) {
  return moyenne >= 1.5 ? "A" : moyenne >= 0.8 ? "R" : "NA";
}

// Vue classe : moyennes par phase et par critère, pour chaque trame, à partir des
// agrégats de la RPC getEpcfMoyennes. Ne montre QUE des moyennes (aucune donnée
// individuelle) → affichable par n'importe quel compte connecté.
// moyennesByTrame = { salle: [{critere,moyenne,effectif}], vehicule: [...] }.
export function renderEpcfClasse(container, moyennesByTrame) {
  ["salle", "vehicule"].forEach((trameKey) => {
    const trame = EPCF_TRAMES[trameKey];
    const all = (moyennesByTrame && moyennesByTrame[trameKey]) || [];
    const nEval = Math.max(0, ...all.map((m) => Number(m.effectif) || 0));
    const box = el("div", { class: "epcf-classe-trame" },
      el("h4", {}, `${trame.label} — ${nEval} stagiaire(s) évalué(s)`));
    if (!all.length) {
      box.appendChild(el("p", { class: "muted" }, "Aucune évaluation."));
      container.appendChild(box);
      return;
    }
    // k-anonymat : cette vue est affichée aussi aux stagiaires → on n'expose une
    // moyenne que si AU MOINS 2 stagiaires ont ce critère (même seuil que la série
    // groupe du radar). Sinon la « moyenne » serait la note exacte d'une personne.
    const moyennes = all.filter((m) => Number(m.effectif) >= 2);
    if (!moyennes.length) {
      box.appendChild(el("p", { class: "muted" },
        "Pas encore assez d'évaluations pour une moyenne de groupe (2 minimum)."));
      container.appendChild(box);
      return;
    }
    const byCode = Object.fromEntries(moyennes.map((m) =>
      [m.critere, { moyenne: Number(m.moyenne), effectif: Number(m.effectif) }]));

    const table = el("table", { class: "epcf-table classe" });
    table.appendChild(el("thead", {}, el("tr", {},
      el("th", {}, "Critère"), el("th", {}, "Moyenne /2"), el("th", {}, "Évalués"))));
    const tbody = el("tbody");
    trame.sections.forEach((sec) => {
      const ps = phaseScoreFromMoyennes(sec, moyennes);   // 0..1
      const color = EPCF_PHASE_COLORS[sec.code] || null;
      const phaseCell = el("td", {}, el("strong", {}, sec.court));
      if (color) phaseCell.style.color = color;
      tbody.appendChild(el("tr", { class: "epcf-classe-phase" },
        phaseCell,
        el("td", {}, ps == null ? el("strong", {}, "—")
          : el("span", { class: "epcf-chip " + tierOf(ps * 2) }, el("strong", {}, (ps * 2).toFixed(2)))),
        el("td", {}, "")));
      sec.criteres.forEach((c) => {
        const m = byCode[c.code];
        const tier = m ? tierOf(m.moyenne) : "";
        tbody.appendChild(el("tr", {},
          el("td", { class: "epcf-classe-lib" }, c.libelle),
          el("td", {}, el("span", { class: "epcf-chip " + (tier || "vide") }, m ? m.moyenne.toFixed(2) : "—")),
          el("td", { class: "muted" }, m ? String(m.effectif) : "")));
      });
    });
    table.appendChild(tbody);
    box.appendChild(el("div", { class: "epcf-table-wrap" }, table));
    container.appendChild(box);
  });
}
