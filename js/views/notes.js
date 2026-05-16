import {
  listStagiaires, listCompetences, listEvaluations, listThemes,
  addEvaluation, updateEvaluation, deleteEvaluation, listAuditForEvaluation,
} from "../db.js";
import { el, clear, isoDate, formatDate, toast } from "../utils.js";
import { icon } from "../icons.js";
import { getAdminEmail, isAdmin } from "../auth-admin.js";

let stagiaires = [];
let competences = [];
let evaluations = [];
let themesOfficiels = [];  // les 57 thèmes du référentiel (chargés en + pour les titres dans la matrice)

let filterStagiaire = "";
let filterType = "";
let currentEvalDate = null;  // Date appliquée aux nouvelles notes saisies dans la matrice

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
    const opt = el("option", { value: s.id }, s.prenom);
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
  evaluations = await listEvaluations();
  rerender(container);
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
          await deleteEvaluation(existing.id);
          toast("Note effacée", "success");
          await reload(container);
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
        await updateEvaluation(existing.id, {
          note,
          note_max: 20,
          date_eval: currentEvalDate,
          updated_by_email: email,
        });
      } else {
        await addEvaluation({
          stagiaire_id: stagiaireId,
          ...fixedFields,
          note,
          note_max: 20,
          date_eval: currentEvalDate,
          created_by_email: email,
          updated_by_email: email,
        });
      }
      await reload(container);
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

  stagiaires.forEach((s) => {
    const tr = el("tr");

    // Colonne prénom (sticky)
    tr.appendChild(el("td", { class: "m-td-name sticky" }, s.prenom));

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
      el("span", { class: "matrice-toolbar-label" }, "Date des notes saisies :"),
      dateInput,
      todayBtn,
      el("span", { class: "matrice-toolbar-hint muted" },
        "→ clique une cellule, tape une note (0-20), Entrée pour valider. Esc pour annuler."
      ),
    ));
  }

  container.appendChild(renderMatrice(container));
}

export async function renderNotes(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  let allThemes;
  [stagiaires, competences, evaluations, allThemes] = await Promise.all([
    listStagiaires(), listCompetences(), listEvaluations(), listThemes()
  ]);
  themesOfficiels = allThemes.filter((t) => t.type === "theme" && t.numero != null);
  rerender(container);
}
