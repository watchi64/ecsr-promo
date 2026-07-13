// Vue EPCF (formateurs/admin) : liste des stagiaires × trames, saisie de grille,
// vue classe. Les stagiaires n'y ont pas accès (garde + onglet masqué + RLS).

import { listStagiaires, listProfs, listEpcf, upsertEpcf } from "../db.js?v=20260713n";
import { el, clear, isoDate, formatDate, displayStagiaire, compareByNom, toast } from "../utils.js?v=20260713n";
import { isAdmin, isProf, getProfile } from "../auth-admin.js?v=20260713n";
import { getCurrentWho } from "../identity.js?v=20260713n";
import { EPCF_TRAMES, NOTE_LABELS, NOTE_VALUES } from "../epcf-trames.js?v=20260713n";
import { phaseScoreFromMoyennes } from "../epcf-restitution.js?v=20260713n";

let stagiaires = [];
let profs = [];
let evals = [];   // toutes les évals (les profs/admin lisent tout via RLS)

const TRAME_KEYS = ["salle", "vehicule"];

function evalsFor(sid, trameKey) {
  return evals.filter((e) => e.stagiaire_id === sid && e.trame === trameKey);
}

export async function renderEpcf(container) {
  clear(container);
  if (!isAdmin() && !isProf()) {
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" }, el("h2", {}, "EPCF"))));
    container.appendChild(el("p", { class: "muted" },
      "Espace réservé aux formateurs. Tes résultats EPCF sont dans l'onglet Mon suivi."));
    return;
  }
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  [stagiaires, profs, evals] = await Promise.all([
    listStagiaires(), listProfs(), listEpcf(),
  ]);
  stagiaires = stagiaires.slice().sort(compareByNom);
  clear(container);

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Formateurs"),
      el("h2", {}, "EPCF"),
      el("p", { class: "subtitle" }, "Évaluations en cours de formation — grilles CCP1 salle et véhicule."),
    ),
  ));

  const body = el("div", { class: "epcf-body" });
  container.appendChild(body);
  showListe(body);
}

// --- Liste : stagiaires × trames, statut + boutons ---
function showListe(body) {
  clear(body);
  const table = el("table", { class: "epcf-table" });
  table.appendChild(el("thead", {}, el("tr", {},
    el("th", {}, "Stagiaire"),
    ...TRAME_KEYS.map((k) => el("th", {}, EPCF_TRAMES[k].label)),
  )));
  const tbody = el("tbody");
  stagiaires.forEach((s) => {
    const tr = el("tr", {}, el("td", {}, displayStagiaire(s)));
    TRAME_KEYS.forEach((k) => {
      const list = evalsFor(s.id, k);
      const cell = el("td", { class: "epcf-cell" });
      if (list.length) {
        cell.appendChild(el("span", { class: "epcf-statut ok" }, "évalué le " + formatDate(list[0].date_eval)));
        cell.appendChild(el("button", { class: "btn small ghost", onClick: () => showForm(body, s, k, list[0]) }, "Modifier"));
      } else {
        cell.appendChild(el("span", { class: "epcf-statut muted" }, "à évaluer"));
      }
      cell.appendChild(el("button", { class: "btn small primary", onClick: () => showForm(body, s, k, null) },
        list.length ? "Nouvelle éval" : "Évaluer"));
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(el("div", { class: "epcf-table-wrap" }, table));
  body.appendChild(el("div", { style: "margin-top:1rem" },
    el("button", { class: "btn ghost", onClick: () => showClasse(body) }, "Vue classe (moyennes)")));
}

// --- Formulaire de saisie d'une grille ---
function showForm(body, stagiaire, trameKey, existing) {
  clear(body);
  const trame = EPCF_TRAMES[trameKey];
  const scores = { ...(existing?.scores || {}) };
  const compSel = new Set(existing?.competences_acquises || []);
  let dirty = false;

  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn small ghost", onClick: () => {
      if (dirty && !confirm("Abandonner la saisie en cours ?")) return;
      showListe(body);
    } }, "← Retour"),
    el("h3", {}, `${trame.label} — ${displayStagiaire(stagiaire)}`),
  ));

  const dateInput = el("input", { type: "date", value: existing?.date_eval || isoDate(new Date()) });
  const metaInputs = {};
  const metaWrap = el("div", { class: "epcf-form-meta" },
    el("div", { class: "field" }, el("label", {}, "Date"), dateInput));
  trame.metaFields.forEach((f) => {
    const inp = el("input", { type: "text", value: existing?.meta?.[f.key] || "" });
    metaInputs[f.key] = inp;
    metaWrap.appendChild(el("div", { class: "field" }, el("label", {}, f.label), inp));
  });
  // Évaluateur facultatif. En édition, on respecte la valeur stockée (y compris null) ;
  // en création, pré-rempli avec le prof connecté s'il en est un (le fondateur admin
  // n'a pas de prof_id → option vide, pas d'attribution silencieuse au premier prof).
  const preset = existing ? existing.evaluateur_prof_id : (getProfile()?.prof_id ?? null);
  const evalSel = el("select");
  const optVide = el("option", { value: "" }, "—");
  if (preset == null) optVide.selected = true;
  evalSel.appendChild(optVide);
  profs.forEach((p) => {
    const o = el("option", { value: String(p.id) }, p.nom);
    if (p.id === preset) o.selected = true;
    evalSel.appendChild(o);
  });
  metaWrap.appendChild(el("div", { class: "field" }, el("label", {}, "Évaluateur"), evalSel));
  body.appendChild(metaWrap);

  // Sections + boutons A/R/NA (re-cliquer la note active la dé-sélectionne)
  trame.sections.forEach((sec) => {
    const box = el("div", { class: "epcf-form-section" },
      el("h4", {}, sec.titre,
        sec.competenceTP ? el("span", { class: "muted epcf-detail-tp" }, " — " + sec.competenceTP) : null));
    sec.criteres.forEach((c) => {
      const seg = el("div", { class: "epcf-seg" });
      const btns = {};
      const sync = () => {
        Object.entries(btns).forEach(([note, b]) => b.classList.toggle("active", scores[c.code] === note));
      };
      ["A", "R", "NA"].forEach((note) => {
        const b = el("button", { type: "button", class: "epcf-seg-btn " + note }, NOTE_LABELS[note]);
        b.addEventListener("click", () => {
          if (scores[c.code] === note) delete scores[c.code];
          else scores[c.code] = note;
          dirty = true;
          sync();
        });
        btns[note] = b;
        seg.appendChild(b);
      });
      sync();
      box.appendChild(el("div", { class: "epcf-form-row" }, el("span", { class: "epcf-form-lib" }, c.libelle), seg));
    });
    body.appendChild(box);
  });

  const compWrap = el("div", { class: "epcf-form-comps" }, el("h4", {}, "Compétences acquises"));
  trame.competences.forEach((code) => {
    const cb = el("input", { type: "checkbox" });
    cb.checked = compSel.has(code);
    cb.addEventListener("change", () => { cb.checked ? compSel.add(code) : compSel.delete(code); dirty = true; });
    compWrap.appendChild(el("label", { class: "epcf-comp-cb" }, cb, " " + code));
  });
  body.appendChild(compWrap);

  const commentTa = el("textarea", { rows: "4", class: "epcf-commentaire-ta", placeholder: "Commentaire global…" });
  commentTa.value = existing?.commentaire || "";
  body.appendChild(el("div", { class: "epcf-form-comment" }, el("h4", {}, "Commentaire global"), commentTa));
  [dateInput, ...Object.values(metaInputs), commentTa].forEach((n) => n.addEventListener("input", () => { dirty = true; }));
  evalSel.addEventListener("change", () => { dirty = true; });

  const saveBtn = el("button", { class: "btn primary", onClick: async () => {
    if (Object.keys(scores).length === 0) { toast("Renseigne au moins un critère", "error"); return; }
    if (!dateInput.value) { toast("Renseigne la date", "error"); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = "Enregistrement…";
    try {
      const meta = {};
      trame.metaFields.forEach((f) => { const v = metaInputs[f.key].value.trim(); if (v) meta[f.key] = v; });
      await upsertEpcf({
        id: existing?.id,
        stagiaire_id: stagiaire.id,
        trame: trameKey,
        trame_version: trame.version,
        date_eval: dateInput.value,
        evaluateur_prof_id: Number(evalSel.value) || null,
        meta,
        scores,
        competences_acquises: [...compSel].sort(),
        commentaire: commentTa.value.trim() || null,
        updated_by_who: getCurrentWho(),
      });
      toast("Évaluation enregistrée", "success", 2000);
      evals = await listEpcf();
      dirty = false;
      showListe(body);
    } catch (e) {
      console.error(e);
      toast(e?.message || String(e), "error");
      saveBtn.disabled = false;
      saveBtn.textContent = prev;
    }
  } }, "Enregistrer l'évaluation");
  body.appendChild(el("div", { style: "margin:1rem 0 2rem" }, saveBtn));
}

// Tier couleur d'une moyenne 0..2 (frontières : ≥1.5 acquis, ≥0.8 à renforcer).
function tierOf(moyenne) {
  return moyenne >= 1.5 ? "A" : moyenne >= 0.8 ? "R" : "NA";
}

// --- Vue classe : moyennes par critère et par phase (dernière éval formateur
// de chaque stagiaire, contexte EPCF) — même sémantique que le RPC epcf_moyennes ---
function showClasse(body) {
  clear(body);
  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn ghost sm", onClick: () => showListe(body) }, "← Retour"),
    el("h3", {}, "Vue classe — moyennes"),
  ));

  TRAME_KEYS.forEach((trameKey) => {
    const trame = EPCF_TRAMES[trameKey];
    // dernière éval formateur par stagiaire (evals est déjà triée desc par listEpcf)
    const seen = new Set();
    const dernieres = evals.filter((e) => {
      if (e.trame !== trameKey || e.contexte !== "EPCF" || e.auto_eval) return false;
      if (seen.has(e.stagiaire_id)) return false;
      seen.add(e.stagiaire_id);
      return true;
    });
    const box = el("div", { class: "epcf-classe-trame" },
      el("h4", {}, `${trame.label} — ${dernieres.length} stagiaire(s) évalué(s)`));
    if (!dernieres.length) {
      box.appendChild(el("p", { class: "muted" }, "Aucune évaluation."));
      body.appendChild(box);
      return;
    }
    // moyennes par critère (0..2), même sémantique que le RPC epcf_moyennes
    const moyennes = [];
    trame.sections.forEach((sec) => sec.criteres.forEach((c) => {
      const vals = dernieres.map((e) => NOTE_VALUES[e.scores?.[c.code]]).filter((v) => v !== undefined);
      if (vals.length) moyennes.push({ critere: c.code, moyenne: vals.reduce((s, v) => s + v, 0) / vals.length, effectif: vals.length });
    }));
    const byCode = Object.fromEntries(moyennes.map((m) => [m.critere, m]));

    const table = el("table", { class: "epcf-table classe" });
    table.appendChild(el("thead", {}, el("tr", {},
      el("th", {}, "Critère"), el("th", {}, "Moyenne /2"), el("th", {}, "Évalués"))));
    const tbody = el("tbody");
    trame.sections.forEach((sec) => {
      const ps = phaseScoreFromMoyennes(sec, moyennes);
      tbody.appendChild(el("tr", { class: "epcf-classe-phase" },
        el("td", {}, el("strong", {}, sec.court)),
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
    body.appendChild(box);
  });
}
