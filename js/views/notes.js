import {
  listStagiaires, listCompetences, listEvaluations, listThemes,
  addEvaluation, updateEvaluation, deleteEvaluation, listAuditForEvaluation,
  listUserProfiles,
} from "../db.js";
import { el, clear, isoDate, formatDate, toast, displayStagiaire, compareByNom } from "../utils.js";
import { icon } from "../icons.js";
import { getAdminEmail, isAdmin } from "../auth-admin.js";
import { recordUndo } from "../undo.js";

let userProfiles = [];  // pour résoudre l'anonymat par stagiaire_id

let stagiaires = [];
let competences = [];
let evaluations = [];
let themesOfficiels = [];  // les 57 thèmes du référentiel (chargés en + pour les titres dans la matrice)

let filterStagiaire = "";
let filterType = "";
let currentEvalDate = null;  // Date appliquée aux nouvelles notes saisies dans la matrice

const NOTES_SORT_OPTIONS = [
  { key: "default",   label: "Ordre par défaut" },
  { key: "alpha",     label: "Alphabétique" },
  { key: "avg-desc",  label: "Moyenne : meilleure d'abord" },
  { key: "avg-asc",   label: "Moyenne : plus faible d'abord" },
  { key: "nb-desc",   label: "Nombre de notes : plus d'abord" },
];

let currentNotesSort = localStorage.getItem("ecsr_notes_sort") || "default";

function stagiaireAvg(stagiaireId) {
  const evs = evaluations.filter((e) => e.stagiaire_id === stagiaireId && e.note != null && e.note_max);
  if (evs.length === 0) return null;
  return evs.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / evs.length;
}

function stagiaireNbNotes(stagiaireId) {
  return evaluations.filter((e) => e.stagiaire_id === stagiaireId && e.note != null).length;
}

function isStagiaireAnonymous(stagiaireId) {
  return userProfiles.some((p) => p.stagiaire_id === stagiaireId && p.anonymous_notes);
}

function displayName(s) {
  // Les admins voient toujours le vrai nom (besoin métier : noter, repérer).
  // Les autres voient "Anonyme" si la personne a coché le flag.
  if (isAdmin()) return displayStagiaire(s);
  return isStagiaireAnonymous(s.id) ? "Anonyme" : displayStagiaire(s);
}

function sortStagiaires(list, mode) {
  // Les anonymes sont toujours en fin, peu importe le tri
  const anonymous = list.filter((s) => isStagiaireAnonymous(s.id));
  const visible = list.filter((s) => !isStagiaireAnonymous(s.id));
  const arr = visible.slice();
  switch (mode) {
    case "alpha":
      arr.sort(compareByNom);
      break;
    case "avg-desc":
      arr.sort((a, b) => (stagiaireAvg(b.id) ?? -1) - (stagiaireAvg(a.id) ?? -1) || compareByNom(a, b));
      break;
    case "avg-asc":
      arr.sort((a, b) => (stagiaireAvg(a.id) ?? 99) - (stagiaireAvg(b.id) ?? 99) || compareByNom(a, b));
      break;
    case "nb-desc":
      arr.sort((a, b) => stagiaireNbNotes(b.id) - stagiaireNbNotes(a.id));
      break;
    case "default":
    default:
      arr.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      break;
  }
  // anonymes à la fin, dans l'ordre par défaut
  anonymous.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  return [...arr, ...anonymous];
}

const TYPES_EVAL = ["Thème", "Compétence", "Contrôle"];

// Colonnes "spéciales" du tableau matrice (en plus des 57 thèmes)
const MATRIX_SPECIAL_COLS = [
  { key: "C1",   label: "C1",   tooltip: "Compétence formateur C1 — Accueillir & sensibiliser SR" },
  { key: "C2",   label: "C2",   tooltip: "Compétence formateur C2 — Concevoir & animer" },
  { key: "REMC", label: "REMC", tooltip: "REMC — Vision globale du référentiel mobilité citoyenne" },
  { key: "MGDE", label: "GDE",  tooltip: "Matrice GDE — Goals for Driver Education" },
];

function noteColor(note, max) {
  if (note == null || max == null) return "muted";
  const ratio = note / max;
  if (ratio < 0.4) return "bad";
  if (ratio < 0.6) return "warn";
  if (ratio < 0.8) return "ok";
  return "great";
}

function describeEval(e) {
  if (e.type === "Thème") {
    const num = e.theme_numero ? `Thème ${String(e.theme_numero).padStart(2, "0")}` : "Thème";
    return e.theme_titre ? `${num} · ${e.theme_titre}` : num;
  }
  if (e.type === "Compétence") {
    return e.competence_code ? `${e.competence_code} · ${e.competence?.libelle?.split(",")[0] || ""}` : "Compétence";
  }
  if (e.type === "Contrôle") {
    return e.controle_libelle || "Contrôle";
  }
  return "—";
}

function openEditModal(existing, onSaved) {
  const isNew = !existing;
  const backdrop = el("div", { class: "modal-backdrop" });

  const stagiaireSel = el("select");
  stagiaireSel.appendChild(el("option", { value: "" }, "—"));
  stagiaires.forEach((s) => {
    const opt = el("option", { value: s.id }, displayStagiaire(s));
    if (existing && existing.stagiaire_id === s.id) opt.selected = true;
    stagiaireSel.appendChild(opt);
  });

  const typeSel = el("select");
  TYPES_EVAL.forEach((t) => {
    const opt = el("option", { value: t }, t);
    if (existing?.type === t) opt.selected = true;
    typeSel.appendChild(opt);
  });

  // Champs conditionnels (thème / compétence / contrôle)
  const themeNum = el("input", { type: "number", min: 1, max: 57, placeholder: "1-57", value: existing?.theme_numero || "" });
  const themeTitre = el("input", { type: "text", placeholder: "Titre du thème (optionnel)", value: existing?.theme_titre || "" });

  const compSel = el("select");
  compSel.appendChild(el("option", { value: "" }, "—"));
  competences.forEach((c) => {
    const opt = el("option", { value: c.code }, `${c.code} · ${c.libelle.slice(0, 60)}${c.libelle.length > 60 ? "…" : ""}`);
    if (existing?.competence_code === c.code) opt.selected = true;
    compSel.appendChild(opt);
  });

  const controleLib = el("input", { type: "text", placeholder: "Ex. Matrice GDE + REMC", value: existing?.controle_libelle || "" });

  const themeField = el("div", { class: "field" }, el("label", {}, "Numéro de thème"), themeNum, el("label", { style: "margin-top:0.5rem" }, "Titre"), themeTitre);
  const compField = el("div", { class: "field" }, el("label", {}, "Compétence"), compSel);
  const controleField = el("div", { class: "field" }, el("label", {}, "Libellé du contrôle"), controleLib);

  function updateConditional() {
    themeField.style.display = typeSel.value === "Thème" ? "" : "none";
    compField.style.display = typeSel.value === "Compétence" ? "" : "none";
    controleField.style.display = typeSel.value === "Contrôle" ? "" : "none";
  }
  typeSel.addEventListener("change", updateConditional);
  updateConditional();

  const noteInput = el("input", { type: "number", min: 0, step: "0.25", placeholder: "Ex. 14.5", value: existing?.note ?? "" });
  const noteMaxInput = el("input", { type: "number", min: 1, step: "0.5", value: existing?.note_max ?? 20 });
  const dateInput = el("input", { type: "date", value: existing?.date_eval || isoDate(new Date()) });
  const obsInput = el("input", { type: "text", placeholder: "Observation (optionnel)", value: existing?.observation || "" });

  async function save() {
    if (!stagiaireSel.value) { toast("Choisir un stagiaire", "error"); return; }
    if (!typeSel.value) { toast("Choisir un type", "error"); return; }

    const payload = {
      stagiaire_id: Number(stagiaireSel.value),
      type: typeSel.value,
      theme_numero: typeSel.value === "Thème" && themeNum.value ? Number(themeNum.value) : null,
      theme_titre: typeSel.value === "Thème" ? (themeTitre.value || null) : null,
      competence_code: typeSel.value === "Compétence" ? (compSel.value || null) : null,
      controle_libelle: typeSel.value === "Contrôle" ? (controleLib.value || null) : null,
      note: noteInput.value === "" ? null : Number(noteInput.value),
      note_max: Number(noteMaxInput.value),
      observation: obsInput.value || null,
      date_eval: dateInput.value,
    };
    const email = getAdminEmail();
    try {
      if (isNew) {
        payload.created_by_email = email;
        payload.updated_by_email = email;
        await addEvaluation(payload);
        toast("Note enregistrée", "success");
      } else {
        payload.updated_by_email = email;
        await updateEvaluation(existing.id, payload);
        toast("Note mise à jour", "success");
      }
      backdrop.remove();
      onSaved();
    } catch (e) {
      console.error(e);
      toast(e.message, "error");
    }
  }

  const cancelBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler");
  const saveBtn = el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer");

  const modal = el("div", { class: "modal" },
    el("h3", {}, isNew ? "Ajouter une note" : "Modifier la note"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Stagiaire"), stagiaireSel),
      el("div", { class: "field" }, el("label", {}, "Type d'évaluation"), typeSel),
      themeField,
      compField,
      controleField,
      el("div", { style: "display:grid;grid-template-columns:1fr 100px;gap:0.6rem" },
        el("div", { class: "field" }, el("label", {}, "Note"), noteInput),
        el("div", { class: "field" }, el("label", {}, "Max"), noteMaxInput),
      ),
      el("div", { class: "field" }, el("label", {}, "Date"), dateInput),
      el("div", { class: "field" }, el("label", {}, "Observation"), obsInput),
    ),
    el("div", { class: "modal-actions" }, cancelBtn, saveBtn)
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

async function openHistoryModal(evaluation_id) {
  const audit = await listAuditForEvaluation(evaluation_id);
  const backdrop = el("div", { class: "modal-backdrop" });

  const list = el("div", { class: "audit-list" });
  if (audit.length === 0) {
    list.appendChild(el("p", { class: "muted" }, "Aucun historique."));
  } else {
    audit.forEach((a) => {
      const time = new Date(a.changed_at).toLocaleString("fr-FR");
      const author = a.changed_by_email || "Anonyme";
      const item = el("div", { class: "audit-item " + a.action },
        el("div", { class: "audit-head" },
          el("span", { class: "audit-action " + a.action }, a.action === "insert" ? "Création" : a.action === "update" ? "Modification" : "Suppression"),
          el("span", { class: "audit-time" }, time),
        ),
        el("div", { class: "audit-meta" }, "par ", el("strong", {}, author)),
      );
      if (a.action === "update" && a.before_data && a.after_data) {
        const diffs = [];
        const interesting = ["note", "note_max", "observation", "type", "theme_numero", "theme_titre", "competence_code", "controle_libelle", "date_eval"];
        interesting.forEach((k) => {
          if (JSON.stringify(a.before_data[k]) !== JSON.stringify(a.after_data[k])) {
            diffs.push(el("div", { class: "audit-diff" },
              el("span", { class: "audit-field" }, k),
              el("span", { class: "audit-before" }, String(a.before_data[k] ?? "—")),
              el("span", { class: "audit-arrow" }, "→"),
              el("span", { class: "audit-after" }, String(a.after_data[k] ?? "—")),
            ));
          }
        });
        if (diffs.length) item.appendChild(el("div", { class: "audit-diffs" }, ...diffs));
      }
      list.appendChild(item);
    });
  }

  const closeBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer");
  const modal = el("div", { class: "modal", style: "max-width:560px" },
    el("h3", {}, "Historique de la note"),
    list,
    el("div", { class: "modal-actions" }, closeBtn)
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function renderTable(container) {
  let filtered = evaluations;
  if (filterStagiaire) filtered = filtered.filter((e) => e.stagiaire_id === Number(filterStagiaire));
  if (filterType)      filtered = filtered.filter((e) => e.type === filterType);

  if (filtered.length === 0) {
    return el("div", { style: "padding:3rem 1rem;text-align:center;color:var(--text-muted)" },
      el("p", {}, "Aucune note enregistrée."),
      isAdmin() ? el("p", { class: "faint", style: "font-size:0.85rem" }, "Clique sur « Ajouter une note » pour commencer.") : null,
    );
  }

  const wrap = el("div", { class: "passages-table-wrap" });
  const table = el("table", { class: "passages-table" });
  table.appendChild(el("thead", {},
    el("tr", {},
      el("th", {}, "Date"),
      el("th", {}, "Stagiaire"),
      el("th", {}, "Type"),
      el("th", {}, "Évaluation"),
      el("th", {}, "Note"),
      el("th", {}, "Observation"),
      el("th", { style: "width:120px" }, ""),
    )
  ));
  const tbody = el("tbody");
  filtered.forEach((e) => {
    const noteCell = el("td", {},
      e.note == null
        ? el("span", { class: "muted" }, "—")
        : el("span", { class: "note-pill " + noteColor(e.note, e.note_max) },
            el("span", { class: "note-num" }, String(e.note)),
            el("span", { class: "note-max" }, "/" + (e.note_max ?? 20))
          )
    );

    const actions = el("td", { style: "white-space:nowrap" });
    const histBtn = el("button", { class: "btn small ghost icon-only", "aria-label": "Historique", onClick: () => openHistoryModal(e.id) });
    histBtn.appendChild(icon.clock());
    actions.appendChild(histBtn);

    if (isAdmin()) {
      const editBtn = el("button", {
        class: "btn small ghost icon-only", style: "margin-left:0.3rem",
        "aria-label": "Modifier",
        onClick: () => openEditModal(e, () => reload(container))
      });
      editBtn.appendChild(icon.settings());
      actions.appendChild(editBtn);

      const delBtn = el("button", {
        class: "btn small danger icon-only", style: "margin-left:0.3rem",
        "aria-label": "Supprimer",
        onClick: async () => {
          if (!confirm("Supprimer cette note ?")) return;
          await deleteEvaluation(e.id);
          toast("Supprimée", "success");
          await reload(container);
        }
      });
      delBtn.appendChild(icon.trash());
      actions.appendChild(delBtn);
    }

    tbody.appendChild(el("tr", {},
      el("td", { class: "date" }, formatDate(e.date_eval)),
      el("td", {}, e.stagiaire?.prenom || "?"),
      el("td", {}, el("span", { class: "tag eval-type-" + (e.type === "Thème" ? "theme" : e.type === "Compétence" ? "competence" : "controle") }, e.type)),
      el("td", {}, describeEval(e)),
      noteCell,
      el("td", { class: "muted", style: "max-width:300px" }, e.observation || ""),
      actions
    ));
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

async function reload(container) {
  [evaluations, userProfiles] = await Promise.all([listEvaluations(), listUserProfiles()]);
  rerender(container);
}

// Rafraîchit uniquement les panneaux Synthèse + Graphiques, sans toucher à la matrice
// (préserve les autres inputs ouverts pendant qu'on enchaîne les notes)
function refreshAnalyticsInPlace(container) {
  const oldSynth = container.querySelector(".notes-synthese");
  const oldChart = container.querySelector(".notes-chart");
  if (oldSynth) oldSynth.replaceWith(renderSynthese());
  if (oldChart) oldChart.replaceWith(renderChartsSection());
}

// === Tableau matrice : lignes stagiaires × colonnes (synthèse + 57 thèmes) ===

function noteForStagiaireCompetence(stagId, code) {
  // Dernière évaluation de type 'Compétence' avec competence_code matching
  const matches = evaluations
    .filter((e) => e.stagiaire_id === stagId && e.type === "Compétence" && e.competence_code === code)
    .sort((a, b) => new Date(b.date_eval) - new Date(a.date_eval));
  return matches[0] || null;
}

function noteForStagiaireTheme(stagId, themeNum) {
  // Dernière évaluation de type 'Thème' avec theme_numero matching
  const matches = evaluations
    .filter((e) => e.stagiaire_id === stagId && e.type === "Thème" && e.theme_numero === themeNum)
    .sort((a, b) => new Date(b.date_eval) - new Date(a.date_eval));
  return matches[0] || null;
}

function noteMatrixCell(evaluation) {
  if (!evaluation) return null;
  const note = Number(evaluation.note);
  const max = Number(evaluation.note_max) || 20;
  return { note, max, ratio: note / max, eval: evaluation };
}

function cellColorClass(ratio) {
  if (ratio == null) return "empty";
  if (ratio < 0.4) return "bad";
  if (ratio < 0.6) return "warn";
  if (ratio < 0.8) return "ok";
  return "great";
}

// Édition inline d'une cellule : remplace le contenu par un input et sauvegarde au blur/Enter
function inlineCellEdit(td, stagiaireId, fixedFields, container) {
  // fixedFields : { type, theme_numero?, competence_code?, controle_libelle? }
  let existing = null;
  if (fixedFields.type === "Thème" && fixedFields.theme_numero != null) {
    existing = noteForStagiaireTheme(stagiaireId, fixedFields.theme_numero);
  } else if (fixedFields.type === "Compétence" && fixedFields.competence_code) {
    existing = noteForStagiaireCompetence(stagiaireId, fixedFields.competence_code);
  }

  // Sauvegarde l'état visuel actuel
  const originalText = td.textContent;
  const originalClass = td.className;

  const input = el("input", {
    type: "number",
    min: 0,
    max: 20,
    step: "0.25",
    class: "matrice-inline-input",
    value: existing?.note != null ? String(existing.note) : "",
    placeholder: "/20",
  });

  td.textContent = "";
  td.appendChild(input);
  input.focus();
  input.select();

  let cancelled = false;
  async function save() {
    if (cancelled) return;
    cancelled = true;
    const raw = input.value.trim();
    // Cas 1 : champ vide
    if (raw === "") {
      // Si existing, propose la suppression
      if (existing) {
        if (!confirm("Effacer cette note ?")) {
          td.textContent = originalText;
          td.className = originalClass;
          return;
        }
        try {
          const snapshot = { ...existing };
          await deleteEvaluation(existing.id);
          // Met à jour localement + DOM en place (pas de rerender complet)
          evaluations = evaluations.filter((x) => x.id !== existing.id);
          td.textContent = "";
          td.className = "m-td-cell empty" + (isAdmin() ? " editable" : "");
          toast("Note effacée · Ctrl+Z pour annuler", "success", 2200);
          recordUndo("note effacée", async () => {
            const { id, created_at, updated_at, ...payload } = snapshot;
            const re = await addEvaluation(payload);
            evaluations.push(re || snapshot);
          });
          refreshAnalyticsInPlace(container);
        } catch (e) { toast(e.message, "error"); restore(); }
        return;
      }
      // Cellule vide, input vide → restore
      td.textContent = originalText;
      td.className = originalClass;
      return;
    }

    const note = Number(raw);
    if (isNaN(note) || note < 0 || note > 20) {
      toast("Note entre 0 et 20", "error");
      restore();
      return;
    }
    // Pas de changement si la note est identique
    if (existing && Number(existing.note) === note) {
      td.textContent = originalText;
      td.className = originalClass;
      return;
    }

    const email = getAdminEmail();
    try {
      if (existing) {
        const prevNote = existing.note;
        const prevMax = existing.note_max;
        const prevDate = existing.date_eval;
        await updateEvaluation(existing.id, {
          note,
          note_max: 20,
          date_eval: currentEvalDate,
          updated_by_email: email,
        });
        existing.note = note;
        existing.note_max = 20;
        existing.date_eval = currentEvalDate;
        const id = existing.id;
        recordUndo("note modifiée", async () => {
          await updateEvaluation(id, { note: prevNote, note_max: prevMax, date_eval: prevDate });
          const ev = evaluations.find((x) => x.id === id);
          if (ev) { ev.note = prevNote; ev.note_max = prevMax; ev.date_eval = prevDate; }
        });
      } else {
        const newRow = {
          stagiaire_id: stagiaireId,
          ...fixedFields,
          note,
          note_max: 20,
          date_eval: currentEvalDate,
          created_by_email: email,
          updated_by_email: email,
        };
        const inserted = await addEvaluation(newRow);
        evaluations.push(inserted || newRow);
        const insertedId = inserted?.id;
        recordUndo("note ajoutée", async () => {
          if (insertedId) {
            await deleteEvaluation(insertedId);
            evaluations = evaluations.filter((x) => x.id !== insertedId);
          }
        });
      }
      // Met à jour la cellule en place (sans détruire les autres inputs)
      const ratio = note / 20;
      td.textContent = String(note);
      td.className = "m-td-cell " + cellColorClass(ratio) + (isAdmin() ? " editable" : "");
      refreshAnalyticsInPlace(container);
    } catch (e) {
      toast(e.message, "error");
      restore();
    }
  }

  function restore() {
    td.textContent = originalText;
    td.className = originalClass;
  }

  input.addEventListener("blur", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    else if (e.key === "Escape") {
      cancelled = true;
      restore();
    }
  });
}

// === Vue détaillée d'un stagiaire (modale, idéale mobile) ===

function openStagiaireDetail(stagiaire, themeByNum, container) {
  const admin = isAdmin();
  const backdrop = el("div", { class: "modal-backdrop" });

  function buildBody() {
    const body = el("div", { class: "sd-body" });

    // Moyenne
    const allEvals = evaluations.filter((e) => e.stagiaire_id === stagiaire.id && e.note != null && e.note_max);
    if (allEvals.length > 0) {
      const avg = allEvals.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / allEvals.length;
      const rounded = Math.round(avg * 10) / 10;
      const cls = cellColorClass(avg / 20);
      body.appendChild(el("div", { class: "sd-avg " + cls },
        el("span", { class: "sd-avg-num" }, String(rounded)),
        el("span", { class: "sd-avg-max" }, "/20"),
        el("span", { class: "sd-avg-count muted" }, allEvals.length + " note" + (allEvals.length > 1 ? "s" : "")),
      ));
    } else {
      body.appendChild(el("div", { class: "sd-avg empty" }, el("span", { class: "muted" }, "Aucune note pour l'instant")));
    }

    function row(label, sublabel, ev, fixedFields) {
      const r = el("div", { class: "sd-row" });
      r.appendChild(el("div", { class: "sd-label" },
        el("span", { class: "sd-label-main" }, label),
        sublabel ? el("span", { class: "sd-label-sub muted" }, sublabel) : null,
      ));
      const valueWrap = el("div", { class: "sd-value" });
      if (ev && ev.note != null) {
        const ratio = Number(ev.note) / (Number(ev.note_max) || 20);
        const cls = cellColorClass(ratio);
        valueWrap.appendChild(el("span", { class: "sd-note " + cls }, String(ev.note)));
      } else {
        valueWrap.appendChild(el("span", { class: "sd-note empty" }, "—"));
      }
      if (admin) {
        valueWrap.classList.add("editable");
        valueWrap.title = "Cliquer pour modifier";
        valueWrap.addEventListener("click", () => {
          startInlineEditInModal(valueWrap, stagiaire.id, fixedFields, container, backdrop);
        });
      }
      r.appendChild(valueWrap);
      return r;
    }

    // Section : Compétences clés
    body.appendChild(el("h4", { class: "sd-section-title" }, "Compétences"));
    MATRIX_SPECIAL_COLS.forEach((c) => {
      const ev = noteForStagiaireCompetence(stagiaire.id, c.key);
      body.appendChild(row(c.label, c.tooltip, ev, { type: "Compétence", competence_code: c.key }));
    });

    // Section : Thèmes 57
    body.appendChild(el("h4", { class: "sd-section-title" }, "Thèmes du référentiel"));
    for (let n = 1; n <= 57; n++) {
      const ev = noteForStagiaireTheme(stagiaire.id, n);
      const theme = themeByNum.get(n);
      const numStr = String(n).padStart(2, "0");
      const title = theme ? theme.titre : `Thème ${n}`;
      body.appendChild(row(numStr + " · " + title, null, ev, {
        type: "Thème",
        theme_numero: n,
        theme_titre: theme ? theme.titre : null,
      }));
    }

    return body;
  }

  const modal = el("div", { class: "modal sd-modal" },
    el("div", { class: "sd-head" },
      el("h3", {}, stagiaire.prenom),
      el("p", { class: "muted", style: "margin:0;font-size:0.85rem" },
        admin ? "Clique sur une note pour la modifier." : "Lecture seule."),
    ),
    buildBody(),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn primary", onClick: () => backdrop.remove() }, "Fermer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

// Édition inline dans la modale détail (similaire à la cellule matrice)
function startInlineEditInModal(valueWrap, stagiaireId, fixedFields, container, backdrop) {
  let existing = null;
  if (fixedFields.type === "Thème" && fixedFields.theme_numero != null) {
    existing = noteForStagiaireTheme(stagiaireId, fixedFields.theme_numero);
  } else if (fixedFields.type === "Compétence" && fixedFields.competence_code) {
    existing = noteForStagiaireCompetence(stagiaireId, fixedFields.competence_code);
  }
  const originalHtml = valueWrap.innerHTML;
  const input = el("input", {
    type: "number", min: 0, max: 20, step: "0.25",
    class: "matrice-inline-input sd-edit-input",
    value: existing?.note != null ? String(existing.note) : "",
    placeholder: "/20",
  });
  valueWrap.innerHTML = "";
  valueWrap.appendChild(input);
  input.focus(); input.select();

  let done = false;
  async function commit() {
    if (done) return; done = true;
    const raw = input.value.trim();
    if (raw === "") {
      if (existing && confirm("Effacer cette note ?")) {
        try { await deleteEvaluation(existing.id); toast("Note effacée", "success"); }
        catch (e) { toast(e.message, "error"); }
      }
      backdrop.remove();
      await reload(container);
      return;
    }
    const note = Number(raw);
    if (isNaN(note) || note < 0 || note > 20) {
      toast("Note entre 0 et 20", "error");
      valueWrap.innerHTML = originalHtml;
      return;
    }
    const email = getAdminEmail();
    try {
      if (existing) {
        await updateEvaluation(existing.id, { note, note_max: 20, date_eval: currentEvalDate, updated_by_email: email });
      } else {
        await addEvaluation({
          stagiaire_id: stagiaireId, ...fixedFields,
          note, note_max: 20, date_eval: currentEvalDate,
          created_by_email: email, updated_by_email: email,
        });
      }
      backdrop.remove();
      await reload(container);
    } catch (e) {
      toast(e.message, "error");
      valueWrap.innerHTML = originalHtml;
    }
  }
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    else if (e.key === "Escape") { done = true; valueWrap.innerHTML = originalHtml; }
  });
}

function renderMatrice(container) {
  // Construction des colonnes : Prénom, Moy, [4 spéciales], [57 thèmes]
  const wrap = el("div", { class: "matrice-wrap" });
  const table = el("table", { class: "matrice-table" });

  // Liste des thèmes officiels présents en DB (par numero 1..57)
  const themesByNum = new Map();
  themesOfficiels.forEach((t) => {
    if (t.numero != null) themesByNum.set(t.numero, t);
  });
  const themeNumbers = [];
  for (let n = 1; n <= 57; n++) themeNumbers.push(n);

  // Header row
  const thead = el("thead");
  const headRow1 = el("tr");
  headRow1.appendChild(el("th", { class: "m-th-name sticky" }, "Stagiaire"));
  headRow1.appendChild(el("th", { class: "m-th-avg" }, "Moy."));
  MATRIX_SPECIAL_COLS.forEach((c) => {
    headRow1.appendChild(el("th", { class: "m-th-spe", title: c.tooltip }, c.label));
  });
  themeNumbers.forEach((n) => {
    const theme = themesByNum.get(n);
    const title = theme ? theme.titre : `Thème ${n}`;
    const numStr = String(n).padStart(2, "0");
    const th = el("th", { class: "m-th-theme", title: `Thème ${numStr} : ${title}` },
      el("div", { class: "m-th-theme-label" },
        el("span", { class: "m-th-theme-num" }, numStr),
        el("span", { class: "m-th-theme-title" }, title),
      )
    );
    headRow1.appendChild(th);
  });
  thead.appendChild(headRow1);
  table.appendChild(thead);

  // Body rows
  const tbody = el("tbody");
  const admin = isAdmin();

  // Construction d'un Map themes par numero pour la modale détail
  const themeByNumLocal = themesByNum;

  sortStagiaires(stagiaires, currentNotesSort).forEach((s) => {
    const tr = el("tr");

    // Colonne prénom (sticky) — cliquable pour ouvrir la vue détaillée
    const visibleName = displayName(s);
    const nameBtn = el("button", {
      class: "m-name-btn" + (isStagiaireAnonymous(s.id) ? " anon" : ""), type: "button",
      title: isStagiaireAnonymous(s.id) ? "Profil anonyme" : "Voir toutes les notes de " + displayStagiaire(s),
      onClick: () => openStagiaireDetail(s, themeByNumLocal, container),
    }, visibleName);
    tr.appendChild(el("td", { class: "m-td-name sticky" }, nameBtn));

    // Moyenne globale
    const allEvals = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null && e.note_max);
    if (allEvals.length > 0) {
      const avg = allEvals.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / allEvals.length;
      const rounded = Math.round(avg * 10) / 10;
      const cls = cellColorClass(avg / 20);
      tr.appendChild(el("td", { class: "m-td-avg " + cls, title: allEvals.length + " évaluations" }, String(rounded)));
    } else {
      tr.appendChild(el("td", { class: "m-td-avg empty" }, ""));
    }

    // Colonnes spéciales (C1, C2, REMC, MGDE)
    MATRIX_SPECIAL_COLS.forEach((c) => {
      const ev = noteForStagiaireCompetence(s.id, c.key);
      const cell = noteMatrixCell(ev);
      const td = el("td", { class: "m-td-cell " + (cell ? cellColorClass(cell.ratio) : "empty") });
      if (cell) {
        td.textContent = String(cell.note);
        td.title = `${c.label} : ${cell.note}/${cell.max} le ${formatDate(cell.eval.date_eval)}`;
      }
      if (admin) {
        td.classList.add("editable");
        td.addEventListener("click", () => inlineCellEdit(td, s.id, { type: "Compétence", competence_code: c.key }, container));
      }
      tr.appendChild(td);
    });

    // 57 colonnes thèmes
    for (let n = 1; n <= 57; n++) {
      const ev = noteForStagiaireTheme(s.id, n);
      const cell = noteMatrixCell(ev);
      const td = el("td", { class: "m-td-cell " + (cell ? cellColorClass(cell.ratio) : "empty") });
      if (cell) {
        td.textContent = String(cell.note);
        td.title = `Thème ${n} : ${cell.note}/${cell.max} le ${formatDate(cell.eval.date_eval)}`;
      }
      if (admin) {
        td.classList.add("editable");
        td.addEventListener("click", () => {
          const theme = themesByNum.get(n);
          inlineCellEdit(td, s.id, {
            type: "Thème",
            theme_numero: n,
            theme_titre: theme ? theme.titre : null,
          }, container);
        });
      }
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  return wrap;
}

function rerender(container) {
  clear(container);

  const admin = isAdmin();

  // Initialise la date courante si pas encore définie
  if (!currentEvalDate) currentEvalDate = isoDate(new Date());

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, evaluations.length + " note" + (evaluations.length > 1 ? "s" : "") + " enregistrée" + (evaluations.length > 1 ? "s" : "")),
      el("h2", {}, "Notes & évaluations"),
      el("p", { class: "subtitle" }, "Tableau matrice : stagiaires × thèmes/compétences. Clique une cellule pour saisir la note."),
    ),
    admin ? null : el("span", { class: "muted", style: "font-size:0.85rem" }, "Lecture seule. Connexion admin requise pour modifier."),
  ));

  // Tri (toujours visible)
  const sortSel = el("select", { class: "notes-sort" });
  NOTES_SORT_OPTIONS.forEach((o) => {
    const opt = el("option", { value: o.key }, o.label);
    if (o.key === currentNotesSort) opt.selected = true;
    sortSel.appendChild(opt);
  });
  sortSel.addEventListener("change", () => {
    currentNotesSort = sortSel.value;
    localStorage.setItem("ecsr_notes_sort", currentNotesSort);
    rerender(container);
  });

  if (admin) {
    // Barre date globale : toutes les notes saisies prendront cette date
    const dateInput = el("input", { type: "date", value: currentEvalDate });
    dateInput.addEventListener("change", () => {
      currentEvalDate = dateInput.value || isoDate(new Date());
    });
    const todayBtn = el("button", { class: "btn small", onClick: () => {
      currentEvalDate = isoDate(new Date());
      dateInput.value = currentEvalDate;
    }}, "Aujourd'hui");

    container.appendChild(el("div", { class: "matrice-toolbar" },
      el("span", { class: "matrice-toolbar-label" }, "Trier :"),
      sortSel,
      el("span", { class: "matrice-toolbar-label", style: "margin-left:1rem" }, "Date des notes :"),
      dateInput,
      todayBtn,
      el("span", { class: "matrice-toolbar-hint muted" },
        "→ clique une cellule, tape une note (0-20), Entrée valide, Esc annule."
      ),
    ));
  } else {
    container.appendChild(el("div", { class: "matrice-toolbar" },
      el("span", { class: "matrice-toolbar-label" }, "Trier :"),
      sortSel,
    ));
  }

  container.appendChild(renderMatrice(container));
  container.appendChild(renderSynthese());
  container.appendChild(renderChartsSection());
}

// === Helpers stats ===

function ratedEvals() {
  return evaluations.filter((e) => e.note != null && e.note_max);
}

function evalScore20(e) {
  return (Number(e.note) / Number(e.note_max)) * 20;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avgColorHex(avg) {
  if (avg == null) return "#D5D5D5";
  const ratio = avg / 20;
  if (ratio < 0.4) return "#DC2626";
  if (ratio < 0.6) return "#D97706";
  if (ratio < 0.8) return "#65A30D";
  return "#3F7012";
}

function cellColorClassFromAvg(avg) {
  if (avg == null) return "empty";
  return cellColorClass(avg / 20);
}

/** Moyenne classe par thème : { num, titre, avg, count } */
function themeStats() {
  const out = [];
  themesOfficiels.forEach((t) => {
    if (t.numero == null) return;
    const notes = evaluations
      .filter((e) => e.type === "Thème" && e.theme_numero === t.numero && e.note != null && e.note_max)
      .map(evalScore20);
    if (notes.length === 0) return;
    const avg = notes.reduce((a, b) => a + b, 0) / notes.length;
    out.push({ num: t.numero, titre: t.titre, avg, med: median(notes), count: notes.length });
  });
  return out;
}

// === Section Synthèse ===

function renderSynthese() {
  const rated = ratedEvals();
  const scores = rated.map(evalScore20);
  const classAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const classMed = median(scores);
  const below10 = scores.filter((s) => s < 10).length;

  const wrap = el("section", { class: "notes-synthese" },
    el("h3", { class: "notes-chart-title" }, "Synthèse classe"),
  );

  // KPIs
  const kpis = el("div", { class: "notes-kpis" });
  function kpi(label, value, cls) {
    return el("div", { class: "notes-kpi " + (cls || "") },
      el("span", { class: "notes-kpi-value" }, value),
      el("span", { class: "notes-kpi-label" }, label),
    );
  }
  kpis.appendChild(kpi("Moyenne classe", classAvg != null ? (Math.round(classAvg * 10) / 10) + " /20" : "—", cellColorClassFromAvg(classAvg)));
  kpis.appendChild(kpi("Médiane", classMed != null ? (Math.round(classMed * 10) / 10) + " /20" : "—", cellColorClassFromAvg(classMed)));
  kpis.appendChild(kpi("Notes saisies", String(rated.length)));
  kpis.appendChild(kpi("Notes < 10/20", String(below10), below10 > 0 ? "bad" : "ok"));
  wrap.appendChild(kpis);

  // Top 3 thèmes faibles + solides
  const stats = themeStats();
  if (stats.length === 0) {
    wrap.appendChild(el("p", { class: "muted", style: "margin-top:1rem" }, "Pas encore assez de notes par thème pour ranker."));
    return wrap;
  }

  const weak = stats.slice().sort((a, b) => a.avg - b.avg).slice(0, 3);
  const strong = stats.slice().sort((a, b) => b.avg - a.avg).slice(0, 3);

  function themeCard(t) {
    const avgR = Math.round(t.avg * 10) / 10;
    return el("div", { class: "theme-stat-card " + cellColorClassFromAvg(t.avg) },
      el("span", { class: "theme-stat-num" }, String(t.num).padStart(2, "0")),
      el("div", { class: "theme-stat-body" },
        el("span", { class: "theme-stat-title" }, t.titre || `Thème ${t.num}`),
        el("span", { class: "theme-stat-meta" },
          el("strong", { style: "color:" + avgColorHex(t.avg) }, avgR + "/20"),
          " · médiane ", String(Math.round(t.med * 10) / 10),
          " · ", t.count, " note" + (t.count > 1 ? "s" : ""),
        ),
      )
    );
  }

  wrap.appendChild(el("div", { class: "notes-rankings" },
    el("div", { class: "ranking-block" },
      el("h4", { class: "ranking-title weak" }, "🔻 3 thèmes les plus faibles"),
      el("p", { class: "muted ranking-sub" }, "À retravailler en priorité"),
      ...weak.map(themeCard),
    ),
    el("div", { class: "ranking-block" },
      el("h4", { class: "ranking-title strong" }, "🔺 3 thèmes les plus solides"),
      el("p", { class: "muted ranking-sub" }, "Acquis confirmés"),
      ...strong.map(themeCard),
    ),
  ));

  return wrap;
}

// === Section Graphiques (tabs) ===

let chartView = "stagiaires";  // "stagiaires" | "themes" | "distribution"

function renderChartsSection() {
  const wrap = el("section", { class: "notes-chart" });
  wrap.appendChild(el("h3", { class: "notes-chart-title" }, "Graphiques"));

  const tabs = el("div", { class: "chart-tabs" });
  [
    { key: "stagiaires",   label: "Par stagiaire" },
    { key: "themes",       label: "Par thème" },
    { key: "distribution", label: "Distribution" },
  ].forEach((t) => {
    const btn = el("button", {
      class: "chart-tab" + (chartView === t.key ? " active" : ""),
      type: "button",
      onClick: () => { chartView = t.key; wrap.replaceWith(renderChartsSection()); }
    }, t.label);
    tabs.appendChild(btn);
  });
  wrap.appendChild(tabs);

  const body = el("div", { class: "notes-chart-svg-wrap" });
  if (chartView === "stagiaires")        body.appendChild(buildAveragesChartSvg());
  else if (chartView === "themes")       body.appendChild(buildThemesChartSvg());
  else if (chartView === "distribution") body.appendChild(buildDistributionChartSvg());
  wrap.appendChild(body);

  return wrap;
}

// Le bar chart par stagiaire (extrait pour réutiliser dans les onglets)
function buildAveragesChartSvg() {
  return renderAveragesChartInner();
}

function renderAveragesChartInner() {
  // Code repris de renderAveragesChart mais retourne seulement le SVG
  const sorted = sortStagiaires(stagiaires, "avg-desc");
  const data = sorted.map((s) => {
    const evs = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null && e.note_max);
    const avg = evs.length === 0 ? null : evs.reduce((sum, e) => sum + evalScore20(e), 0) / evs.length;
    return { name: displayName(s), avg, count: evs.length, anon: isStagiaireAnonymous(s.id) };
  });
  return horizontalBarChart(data, 22);
}

function buildThemesChartSvg() {
  const stats = themeStats().sort((a, b) => a.avg - b.avg);  // pire en haut
  const data = stats.map((t) => ({
    name: String(t.num).padStart(2, "0") + " · " + (t.titre || ""),
    avg: t.avg, count: t.count,
  }));
  if (data.length === 0) {
    const empty = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    empty.setAttribute("viewBox", "0 0 200 40");
    return empty;
  }
  return horizontalBarChart(data, 18, 200);
}

function buildDistributionChartSvg() {
  const rated = ratedEvals();
  const buckets = [
    { min: 0,  max: 4,  label: "0–4",   count: 0, color: "#991B1B" },
    { min: 4,  max: 8,  label: "4–8",   count: 0, color: "#DC2626" },
    { min: 8,  max: 12, label: "8–12",  count: 0, color: "#D97706" },
    { min: 12, max: 16, label: "12–16", count: 0, color: "#65A30D" },
    { min: 16, max: 20.01, label: "16–20", count: 0, color: "#3F7012" },
  ];
  rated.forEach((e) => {
    const s = evalScore20(e);
    for (const b of buckets) if (s >= b.min && s < b.max) { b.count++; break; }
  });
  const max = Math.max(1, ...buckets.map((b) => b.count));

  const svgNS = "http://www.w3.org/2000/svg";
  const W = 720, H = 280, padL = 30, padR = 30, padT = 30, padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = chartW / buckets.length - 16;

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "notes-chart-svg");

  // Axe Y graduations
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((max / yTicks) * i);
    const y = padT + chartH - (val / max) * chartH;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", padL); line.setAttribute("x2", W - padR);
    line.setAttribute("y1", y); line.setAttribute("y2", y);
    line.setAttribute("stroke", i === 0 ? "#B7C0AA" : "#E2E7DA");
    if (i !== 0) line.setAttribute("stroke-dasharray", "2,3");
    svg.appendChild(line);
    const tx = document.createElementNS(svgNS, "text");
    tx.setAttribute("x", padL - 6); tx.setAttribute("y", y + 3);
    tx.setAttribute("text-anchor", "end"); tx.setAttribute("font-size", "10");
    tx.setAttribute("fill", "#8A7458");
    tx.textContent = String(val);
    svg.appendChild(tx);
  }

  // Bars
  buckets.forEach((b, i) => {
    const cx = padL + (chartW / buckets.length) * i + (chartW / buckets.length) / 2;
    const h = (b.count / max) * chartH;
    const x = cx - barW / 2;
    const y = padT + chartH - h;

    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", x); rect.setAttribute("y", y);
    rect.setAttribute("width", barW); rect.setAttribute("height", h);
    rect.setAttribute("rx", 4); rect.setAttribute("fill", b.color);
    svg.appendChild(rect);

    const txVal = document.createElementNS(svgNS, "text");
    txVal.setAttribute("x", cx); txVal.setAttribute("y", y - 6);
    txVal.setAttribute("text-anchor", "middle"); txVal.setAttribute("font-size", "12");
    txVal.setAttribute("font-weight", "700"); txVal.setAttribute("fill", "#1F2924");
    txVal.textContent = String(b.count);
    svg.appendChild(txVal);

    const txLab = document.createElementNS(svgNS, "text");
    txLab.setAttribute("x", cx); txLab.setAttribute("y", padT + chartH + 18);
    txLab.setAttribute("text-anchor", "middle"); txLab.setAttribute("font-size", "11");
    txLab.setAttribute("fill", "#46554A");
    txLab.textContent = b.label;
    svg.appendChild(txLab);
  });

  // Axe X label
  const xLabel = document.createElementNS(svgNS, "text");
  xLabel.setAttribute("x", W / 2); xLabel.setAttribute("y", H - 8);
  xLabel.setAttribute("text-anchor", "middle"); xLabel.setAttribute("font-size", "11");
  xLabel.setAttribute("fill", "#8A7458");
  xLabel.textContent = "Tranches de note / 20";
  svg.appendChild(xLabel);

  return svg;
}

function horizontalBarChart(data, barHeight = 22, labelWidth = 100) {
  const width = 720;
  const barGap = 8;
  const padTop = 30, padBottom = 30;
  const chartHeight = padTop + data.length * (barHeight + barGap) + padBottom;
  const chartWidth = width - labelWidth - 70;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${chartHeight}`);
  svg.setAttribute("class", "notes-chart-svg");

  [0, 5, 10, 15, 20].forEach((val) => {
    const x = labelWidth + (val / 20) * chartWidth;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x); line.setAttribute("x2", x);
    line.setAttribute("y1", padTop - 8); line.setAttribute("y2", chartHeight - padBottom + 4);
    line.setAttribute("stroke", val === 10 ? "#B7C0AA" : "#E2E7DA");
    if (val !== 10) line.setAttribute("stroke-dasharray", "2,3");
    svg.appendChild(line);

    const tx = document.createElementNS(svgNS, "text");
    tx.setAttribute("x", x); tx.setAttribute("y", padTop - 12);
    tx.setAttribute("text-anchor", "middle"); tx.setAttribute("font-size", "10");
    tx.setAttribute("fill", "#8A7458");
    tx.textContent = String(val);
    svg.appendChild(tx);
  });

  data.forEach((d, i) => {
    const y = padTop + i * (barHeight + barGap);

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", labelWidth - 8); label.setAttribute("y", y + barHeight / 2 + 4);
    label.setAttribute("text-anchor", "end"); label.setAttribute("font-size", "10");
    label.setAttribute("font-weight", d.anon ? "400" : "600");
    label.setAttribute("fill", d.anon ? "#8A7458" : "#1F2924");
    // Trunc label si trop long
    const lbl = (d.name || "").length > 24 ? (d.name.substring(0, 22) + "…") : d.name;
    label.textContent = lbl;
    svg.appendChild(label);

    const track = document.createElementNS(svgNS, "rect");
    track.setAttribute("x", labelWidth); track.setAttribute("y", y);
    track.setAttribute("width", chartWidth); track.setAttribute("height", barHeight);
    track.setAttribute("rx", 4); track.setAttribute("fill", "#F0F0EC");
    svg.appendChild(track);

    if (d.avg != null) {
      const w = Math.max(2, (d.avg / 20) * chartWidth);
      const bar = document.createElementNS(svgNS, "rect");
      bar.setAttribute("x", labelWidth); bar.setAttribute("y", y);
      bar.setAttribute("width", w); bar.setAttribute("height", barHeight);
      bar.setAttribute("rx", 4); bar.setAttribute("fill", avgColorHex(d.avg));
      svg.appendChild(bar);

      const val = document.createElementNS(svgNS, "text");
      val.setAttribute("x", labelWidth + w + 6); val.setAttribute("y", y + barHeight / 2 + 4);
      val.setAttribute("font-size", "10"); val.setAttribute("font-weight", "700");
      val.setAttribute("fill", "#1F2924");
      val.textContent = (Math.round(d.avg * 10) / 10).toString() + (d.count != null ? ` · ${d.count}n` : "");
      svg.appendChild(val);
    } else {
      const val = document.createElementNS(svgNS, "text");
      val.setAttribute("x", labelWidth + 10); val.setAttribute("y", y + barHeight / 2 + 4);
      val.setAttribute("font-size", "10"); val.setAttribute("fill", "#9DA89A");
      val.textContent = "Aucune note";
      svg.appendChild(val);
    }
  });

  return svg;
}

export async function renderNotes(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  let allThemes;
  [stagiaires, competences, evaluations, allThemes, userProfiles] = await Promise.all([
    listStagiaires(), listCompetences(), listEvaluations(), listThemes(), listUserProfiles(),
  ]);
  themesOfficiels = allThemes.filter((t) => t.type === "theme" && t.numero != null);
  rerender(container);
}

// === Graphique de synthèse : moyennes par stagiaire (SVG bar chart) ===

function renderAveragesChart() {
  const sorted = sortStagiaires(stagiaires, "avg-desc");
  const data = sorted.map((s) => {
    const evs = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null && e.note_max);
    const avg = evs.length === 0 ? null
      : evs.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / evs.length;
    return { name: displayName(s), avg, count: evs.length, anon: isStagiaireAnonymous(s.id) };
  });

  const width = 720;
  const labelWidth = 90;
  const barHeight = 22;
  const barGap = 8;
  const padTop = 30;
  const padBottom = 30;
  const chartHeight = padTop + data.length * (barHeight + barGap) + padBottom;
  const chartWidth = width - labelWidth - 50;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${chartHeight}`);
  svg.setAttribute("class", "notes-chart-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Moyennes par stagiaire");

  function avgColor(avg) {
    if (avg == null) return "#D5D5D5";
    const ratio = avg / 20;
    if (ratio < 0.4) return "#DC2626";
    if (ratio < 0.6) return "#D97706";
    if (ratio < 0.8) return "#65A30D";
    return "#3F7012";
  }

  // Axe vertical : graduations 0, 5, 10, 15, 20
  [0, 5, 10, 15, 20].forEach((val) => {
    const x = labelWidth + (val / 20) * chartWidth;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x); line.setAttribute("x2", x);
    line.setAttribute("y1", padTop - 8); line.setAttribute("y2", chartHeight - padBottom + 4);
    line.setAttribute("stroke", val === 10 ? "#B7C0AA" : "#E2E7DA");
    line.setAttribute("stroke-dasharray", val === 10 ? "" : "2,3");
    svg.appendChild(line);

    const tx = document.createElementNS(svgNS, "text");
    tx.setAttribute("x", x); tx.setAttribute("y", padTop - 12);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("font-size", "10");
    tx.setAttribute("fill", "#8A7458");
    tx.textContent = String(val);
    svg.appendChild(tx);
  });

  data.forEach((d, i) => {
    const y = padTop + i * (barHeight + barGap);

    // Label
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", labelWidth - 8); label.setAttribute("y", y + barHeight / 2 + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "11");
    label.setAttribute("font-weight", d.anon ? "400" : "600");
    label.setAttribute("fill", d.anon ? "#8A7458" : "#1F2924");
    label.textContent = d.name;
    svg.appendChild(label);

    // Track (gris)
    const track = document.createElementNS(svgNS, "rect");
    track.setAttribute("x", labelWidth); track.setAttribute("y", y);
    track.setAttribute("width", chartWidth); track.setAttribute("height", barHeight);
    track.setAttribute("rx", 4); track.setAttribute("fill", "#F0F0EC");
    svg.appendChild(track);

    if (d.avg != null) {
      // Bar
      const w = Math.max(2, (d.avg / 20) * chartWidth);
      const bar = document.createElementNS(svgNS, "rect");
      bar.setAttribute("x", labelWidth); bar.setAttribute("y", y);
      bar.setAttribute("width", w); bar.setAttribute("height", barHeight);
      bar.setAttribute("rx", 4); bar.setAttribute("fill", avgColor(d.avg));
      svg.appendChild(bar);

      // Value
      const val = document.createElementNS(svgNS, "text");
      const valX = labelWidth + w + 6;
      val.setAttribute("x", valX); val.setAttribute("y", y + barHeight / 2 + 4);
      val.setAttribute("font-size", "11");
      val.setAttribute("font-family", "var(--font-mono)");
      val.setAttribute("font-weight", "700");
      val.setAttribute("fill", "#1F2924");
      val.textContent = (Math.round(d.avg * 10) / 10).toString() + " / 20";
      svg.appendChild(val);
    } else {
      const val = document.createElementNS(svgNS, "text");
      val.setAttribute("x", labelWidth + 10); val.setAttribute("y", y + barHeight / 2 + 4);
      val.setAttribute("font-size", "10");
      val.setAttribute("fill", "#9DA89A");
      val.textContent = "Aucune note";
      svg.appendChild(val);
    }
  });

  const wrap = el("section", { class: "notes-chart" },
    el("h3", { class: "notes-chart-title" }, "Moyennes par stagiaire"),
    el("p", { class: "muted notes-chart-sub" }, "Trié par moyenne décroissante. Les profils anonymes apparaissent en fin de liste."),
    el("div", { class: "notes-chart-svg-wrap" }, svg),
  );
  return wrap;
}
