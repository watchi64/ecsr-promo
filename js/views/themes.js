import { listThemes, updateTheme, addTheme, deleteTheme, listQcmIndex, getQcmFull, publishQcm, unpublishQcm, setExamDraw, listExamAttempts, resetExamAttempt } from "../db.js?v=20260701d";
import { el, clear, isoDate, formatDate, toast, debounce } from "../utils.js?v=20260701d";
import { icon } from "../icons.js?v=20260701d";
import { isAdmin, getAdminEmail, isFounder, getViewAs, isProf, isStagiaire } from "../auth-admin.js?v=20260701d";
import { recordUndo } from "../undo.js?v=20260701d";
import { openQcmEntrainement, openQcmExamen } from "./qcm.js?v=20260701d";

let themes = [];
let qcmByTheme = new Map();  // theme_id -> { id, nb_questions, published, ... }

// Phase dev : le QCM n'est visible que par le fondateur en vue réelle.
// En aperçu « Voir en tant que … », il disparaît (= ce que verra un élève).
// La RLS (lecture QCM = fondateur) double cette restriction côté serveur.
function canSeeQcm() {
  return isFounder() && !getViewAs();
}

async function loadQcmIndex() {
  if (!canSeeQcm()) { qcmByTheme = new Map(); return; }
  try {
    const list = await listQcmIndex();
    qcmByTheme = new Map(list.filter((q) => q.nb_questions > 0).map((q) => [q.theme_id, q]));
  } catch (e) {
    qcmByTheme = new Map();  // dégradation douce : on n'affiche simplement pas de QCM
  }
}

// Puce compacte de la colonne QCM : ▶ + nombre de questions.
function qcmHintEl(theme, qcm) {
  return el("button", {
    class: "theme-qcm-hint", type: "button",
    title: `Lancer l'entraînement (${qcm.nb_questions} questions)`,
    onClick: (ev) => { ev.preventDefault(); ev.stopPropagation(); openQcmEntrainement(theme, qcm); },
  }, icon.play(), `${qcm.nb_questions} Q`);
}

// Tire n éléments au hasard (ordre aléatoire). n falsy ou >= longueur => tout.
function sampleN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return (n && n < a.length) ? a.slice(0, n) : a;
}

function canManageExam() { return isAdmin() || isProf(); }

// Bloc QCM dans la modale thème (remplace le placeholder quand un QCM existe).
function themeQcmBlock(theme) {
  const qcm = qcmByTheme.get(theme.id);
  if (!qcm) {
    return el("div", { class: "theme-modal-placeholder" },
      el("p", {}, "Contenu pédagogique à venir : cours, QCM, exercices, supports."),
      el("p", { class: "muted", style: "font-size:0.82rem" }, "Cette zone affichera les ressources liées au thème dès qu'elles seront disponibles."),
    );
  }
  const block = el("div", { class: "theme-qcm-block" },
    el("div", { class: "theme-qcm-block-head" },
      el("span", { class: "theme-qcm-block-icon" }, icon.quiz()),
      el("div", { style: "min-width:0" },
        el("p", { class: "theme-qcm-block-title" }, "QCM disponible"),
        el("p", { class: "muted", style: "font-size:0.82rem;margin:0" },
          `${qcm.nb_questions} questions` + (qcm.published ? " · examen en ligne" : " · examen non publié")),
      ),
    ),
    el("button", { class: "btn primary", type: "button",
      onClick: (ev) => { ev.preventDefault(); openQcmEntrainement(theme, qcm); },
    }, icon.play(), "Lancer l'entraînement"),
    el("p", { class: "muted", style: "font-size:0.78rem;text-align:center;margin:0.5rem 0 0" },
      "L'entraînement est libre et ne compte pas dans les notes."),
  );

  // Entrée examen (stagiaire) : visible si publié.
  if (isStagiaire() && qcm.published) {
    block.appendChild(el("div", { class: "theme-exam-entry" },
      el("button", { class: "btn accent", type: "button",
        onClick: (ev) => { ev.preventDefault(); openQcmExamen(theme, qcm); },
      }, "Passer l'examen"),
      el("p", { class: "muted", style: "font-size:0.78rem;text-align:center;margin:0.4rem 0 0" },
        "Une seule passe, chronométrée, notée sur 20."),
    ));
  }

  // Panneau formateur : publier / dépublier / régénérer / réinitialiser.
  if (canManageExam()) {
    block.appendChild(themeExamPanel(theme, qcm));
  }
  return block;
}

// Panneau formateur pour piloter l'examen d'un QCM (dans la modale thème).
function themeExamPanel(theme, qcm) {
  const panel = el("div", { class: "theme-exam-panel" });

  const status = el("p", { class: "theme-exam-status" });
  function refreshStatus() {
    clear(status);
    const on = !!qcm.published;
    const frozenN = Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids.length : null;
    status.appendChild(el("span", { class: "exam-badge " + (on ? "on" : "off") }, on ? "En ligne" : "Brouillon"));
    if (on) {
      status.appendChild(el("span", { class: "muted", style: "font-size:0.8rem" },
        ` ${frozenN ?? qcm.nb_questions} questions · seuil ${qcm.exam_pass_20}/20 · ${qcm.exam_seconds_per_question || 30}s/q`
        + (qcm.exam_draw_mode === "manual" ? " · sélection manuelle" : " · tirage aléatoire")));
    }
  }

  // Réglages (pré-remplis depuis la config courante).
  const nbInput = el("input", { type: "number", min: 1, max: qcm.nb_questions, placeholder: "toutes",
    value: qcm.exam_nb_questions ?? "" });
  const passInput = el("input", { type: "number", min: 0, max: 20, step: "0.5", value: qcm.exam_pass_20 ?? 12 });
  const secInput = el("input", { type: "number", min: 5, max: 300, step: 5, value: qcm.exam_seconds_per_question ?? 30 });
  const settings = el("div", { class: "theme-exam-settings" },
    el("label", {}, "Questions (N)", nbInput),
    el("label", {}, "Seuil /20", passInput),
    el("label", {}, "Secondes/question", secInput),
  );

  // Applique une publication (ou régénération) avec un set d'ids donné.
  async function doPublish(examQuestionIds, drawMode) {
    const pass = Number(passInput.value) || 12;
    const secs = Number(secInput.value) || 30;
    const nb = nbInput.value ? Number(nbInput.value) : null;
    try {
      await publishQcm(qcm.id, {
        examQuestionIds, drawMode, nbQuestions: nb, pass20: pass,
        secondsPerQuestion: secs, email: getAdminEmail(),
      });
      Object.assign(qcm, {
        published: true, exam_question_ids: examQuestionIds, exam_draw_mode: drawMode,
        exam_nb_questions: nb, exam_pass_20: pass, exam_seconds_per_question: secs,
      });
      toast(`Examen publié (${examQuestionIds.length} questions).`, "success");
      refreshStatus();
    } catch (e) {
      toast("Publication impossible : " + (e?.message || e), "error");
    }
  }

  // Tirage aléatoire : charge la banque, échantillonne N, publie.
  async function publishRandom() {
    try {
      const full = await getQcmFull(qcm.id);
      const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
      const nb = nbInput.value ? Number(nbInput.value) : null;
      const ids = sampleN(qs, nb).map((q) => q.id);
      if (ids.length === 0) { toast("Aucune question exploitable.", "error"); return; }
      await doPublish(ids, "random");
    } catch (e) {
      toast("Tirage impossible : " + (e?.message || e), "error");
    }
  }

  // Sélection manuelle : modale de cases à cocher, ordre = ordre des questions.
  async function chooseManual() {
    let full;
    try { full = await getQcmFull(qcm.id); }
    catch (e) { toast("Chargement impossible : " + (e?.message || e), "error"); return; }
    const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
    const preset = new Set(Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids : []);
    const backdrop = el("div", { class: "modal-backdrop" });
    const list = el("div", { class: "exam-pick-list" });
    qs.forEach((q, i) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = preset.has(q.id);
      cb.dataset.qid = String(q.id);
      list.appendChild(el("label", { class: "exam-pick-item" }, cb,
        el("span", {}, `${i + 1}. ${q.enonce}`)));
    });
    const modal = el("div", { class: "modal" },
      el("h3", {}, "Choisir les questions de l'examen"),
      el("p", { class: "muted", style: "font-size:0.85rem" }, "Coche les questions à inclure. L'ordre suivra l'ordre des questions."),
      list,
      el("div", { class: "modal-actions" },
        el("button", { class: "btn ghost", type: "button", onClick: () => backdrop.remove() }, "Annuler"),
        el("button", { class: "btn primary", type: "button", onClick: async () => {
          const ids = qs.filter((q) => list.querySelector(`input[data-qid="${q.id}"]`).checked).map((q) => q.id);
          if (ids.length === 0) { toast("Sélectionne au moins une question.", "error"); return; }
          backdrop.remove();
          await doPublish(ids, "manual");
        } }, "Publier cette sélection"),
      ),
    );
    backdrop.appendChild(modal);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  // Régénère le tirage (aléatoire) après contrôle « 0 tentative ».
  async function regenerate() {
    try {
      const attempts = await listExamAttempts(qcm.id);
      if (attempts.length > 0) {
        toast(`${attempts.length} stagiaire(s) ont déjà passé l'examen. Réinitialise-les avant de régénérer.`, "error");
        return;
      }
      const full = await getQcmFull(qcm.id);
      const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
      const nb = qcm.exam_nb_questions ?? (nbInput.value ? Number(nbInput.value) : null);
      const ids = sampleN(qs, nb).map((q) => q.id);
      await setExamDraw(qcm.id, { examQuestionIds: ids, drawMode: "random", nbQuestions: nb });
      Object.assign(qcm, { exam_question_ids: ids, exam_draw_mode: "random", exam_nb_questions: nb });
      toast(`Nouveau tirage de ${ids.length} questions.`, "success");
      refreshStatus();
    } catch (e) {
      toast("Régénération impossible : " + (e?.message || e), "error");
    }
  }

  async function doUnpublish() {
    try {
      await unpublishQcm(qcm.id);
      qcm.published = false;
      toast("Examen dépublié.", "success");
      refreshStatus();
    } catch (e) {
      toast("Dépublication impossible : " + (e?.message || e), "error");
    }
  }

  // Modale de gestion des tentatives (réinitialisation par stagiaire).
  async function manageAttempts() {
    let attempts;
    try { attempts = await listExamAttempts(qcm.id); }
    catch (e) { toast("Chargement impossible : " + (e?.message || e), "error"); return; }
    const backdrop = el("div", { class: "modal-backdrop" });
    const body = el("div", { class: "exam-attempts-list" });
    function fill() {
      clear(body);
      if (attempts.length === 0) {
        body.appendChild(el("p", { class: "muted" }, "Aucune tentative pour l'instant."));
        return;
      }
      attempts.forEach((a) => {
        const row = el("div", { class: "exam-attempt-row" },
          el("span", {}, (a.stagiaire?.prenom || `Stagiaire ${a.stagiaire_id}`) + ` — ${a.note_20}/20`),
          el("button", { class: "btn danger", type: "button", onClick: async () => {
            if (!window.confirm("Réinitialiser cette tentative ? La note sera supprimée.")) return;
            try {
              await resetExamAttempt(qcm.id, a.stagiaire_id);
              attempts = attempts.filter((x) => x.id !== a.id);
              toast("Tentative réinitialisée.", "success");
              fill();
            } catch (e) {
              toast("Réinitialisation impossible : " + (e?.message || e), "error");
            }
          } }, "Réinitialiser"),
        );
        body.appendChild(row);
      });
    }
    fill();
    const modal = el("div", { class: "modal" },
      el("h3", {}, "Tentatives d'examen"),
      body,
      el("div", { class: "modal-actions" },
        el("button", { class: "btn ghost", type: "button", onClick: () => backdrop.remove() }, "Fermer"),
      ),
    );
    backdrop.appendChild(modal);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  const actions = el("div", { class: "theme-exam-actions" },
    el("button", { class: "btn primary", type: "button", onClick: publishRandom }, "Tirer au hasard et publier"),
    el("button", { class: "btn ghost", type: "button", onClick: chooseManual }, "Choisir les questions"),
    el("button", { class: "btn ghost", type: "button", onClick: regenerate }, "Régénérer le tirage"),
    el("button", { class: "btn ghost", type: "button", onClick: manageAttempts }, "Gérer les tentatives"),
    el("button", { class: "btn ghost", type: "button", onClick: doUnpublish }, "Dépublier"),
  );

  panel.appendChild(el("p", { class: "theme-exam-panel-title" }, "Examen (formateur)"));
  panel.appendChild(status);
  panel.appendChild(settings);
  panel.appendChild(actions);
  refreshStatus();
  return panel;
}
let filterStatut = "";
let filterType = "";
let filterCategorie = "";
let search = "";

const STATUTS = [
  { value: "À faire", color: "todo" },
  { value: "Fait",    color: "done" },
];

function normalizeStatut(s) {
  // Migration douce : "En cours" historique → traité comme "À faire"
  if (s === "Fait") return "Fait";
  return "À faire";
}

function toggleStatut(current) {
  return normalizeStatut(current) === "Fait" ? "À faire" : "Fait";
}

async function cycleStatut(theme, container, chipEl) {
  const newStatut = toggleStatut(theme.statut);
  const prevStatut = theme.statut;
  const prevDate = theme.date_fait;
  const patch = {
    statut: newStatut,
    updated_by_email: getAdminEmail(),
    date_fait: newStatut === "Fait" ? isoDate(new Date()) : null,
  };
  try {
    await updateTheme(theme.id, patch);
    Object.assign(theme, patch);
    // Update in-place sans rerender complet (évite le scroll jump)
    updateThemeRowInPlace(theme, chipEl);
    refreshStatsInPlace(container);
    recordUndo("statut thème", async () => {
      await updateTheme(theme.id, { statut: prevStatut, date_fait: prevDate });
      theme.statut = prevStatut;
      theme.date_fait = prevDate;
    });
  } catch (e) {
    toast(e.message, "error");
  }
}

function updateThemeRowInPlace(theme, chipEl) {
  const row = chipEl?.closest(".theme-row");
  if (!row) return;
  const newColor = normalizeStatut(theme.statut) === "Fait" ? "done" : "todo";
  row.classList.remove("todo", "done", "doing");
  row.classList.add(newColor);
  chipEl.classList.remove("todo", "done", "doing");
  chipEl.classList.add(newColor);
  // Update text inside chip
  const dot = chipEl.querySelector(".theme-statut-dot");
  clear(chipEl);
  if (dot) chipEl.appendChild(dot);
  else chipEl.appendChild(el("span", { class: "theme-statut-dot" }));
  chipEl.appendChild(document.createTextNode(theme.statut));
  // Update date column (4th child : .theme-date)
  const dateEl = row.querySelector(".theme-date");
  if (dateEl) {
    clear(dateEl);
    if (theme.date_fait) {
      dateEl.classList.remove("muted");
      dateEl.appendChild(document.createTextNode(formatDate(theme.date_fait)));
    } else {
      dateEl.classList.add("muted");
      dateEl.appendChild(document.createTextNode("—"));
    }
  }
}

function openDateEditor(theme, anchorEl, container) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const dateInput = el("input", {
    type: "date",
    value: theme.date_fait || isoDate(new Date()),
    style: "width:100%",
  });

  async function save(newDate) {
    const prevDate = theme.date_fait;
    const prevStatut = theme.statut;
    try {
      await updateTheme(theme.id, {
        date_fait: newDate || null,
        statut: newDate ? "Fait" : theme.statut,
        updated_by_email: getAdminEmail(),
      });
      theme.date_fait = newDate || null;
      if (newDate) theme.statut = "Fait";
      recordUndo("date thème", async () => {
        await updateTheme(theme.id, { date_fait: prevDate, statut: prevStatut });
        theme.date_fait = prevDate;
        theme.statut = prevStatut;
      });
      // Mise à jour locale : le label affiche la nouvelle date sans tout rerender
      anchorEl.textContent = newDate ? formatDate(newDate) : "+ date";
      anchorEl.classList.toggle("muted", !newDate);
      // Si on a posé une date, statut devient Fait → couleur ligne / chip
      if (newDate) {
        const row = anchorEl.closest(".theme-row");
        if (row) {
          row.classList.remove("todo", "doing");
          row.classList.add("done");
          const chip = row.querySelector(".theme-statut");
          if (chip) {
            chip.classList.remove("todo", "doing");
            chip.classList.add("done");
            const dot = chip.querySelector(".theme-statut-dot");
            chip.textContent = "";
            if (dot) chip.appendChild(dot);
            else chip.appendChild(el("span", { class: "theme-statut-dot" }));
            chip.appendChild(document.createTextNode("Fait"));
          }
        }
      }
      refreshStatsInPlace(container);
      backdrop.remove();
      toast("Date mise à jour", "success", 1500);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  const modal = el("div", { class: "modal", style: "max-width:360px" },
    el("h3", {}, "Date du thème"),
    el("p", { class: "muted", style: "margin:0 0 0.8rem;font-size:0.85rem" },
      "Quand le thème a-t-il été traité ? Définir une date force le statut à « Fait »."),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Date"), dateInput),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler"),
      theme.date_fait ? el("button", { class: "btn danger", onClick: () => save(null) }, "Effacer") : null,
      el("button", { class: "btn primary", onClick: () => save(dateInput.value) }, icon.check(), "Enregistrer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  setTimeout(() => dateInput.focus(), 80);
}

function openThemeModal(theme) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const num = theme.numero ? String(theme.numero).padStart(2, "0") : null;
  const modal = el("div", { class: "modal theme-modal" },
    el("div", { class: "theme-modal-head" },
      num ? el("span", { class: "theme-modal-num" }, num) : null,
      el("h3", { class: "theme-modal-titre" }, theme.titre),
    ),
    theme.categorie ? el("p", { class: "muted theme-modal-cat" }, theme.categorie) : null,
    themeQcmBlock(theme),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn primary", onClick: () => backdrop.remove() }, "Fermer"),
    ),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function debouncedNoteSave(theme) {
  const key = "theme-note-" + theme.id;
  if (!window.__debSavers) window.__debSavers = {};
  if (!window.__debSavers[key]) {
    window.__debSavers[key] = debounce(async (val) => {
      try {
        await updateTheme(theme.id, { notes: val, updated_by_email: getAdminEmail() });
        theme.notes = val;
      } catch (e) { toast(e.message, "error"); }
    }, 600);
  }
  return window.__debSavers[key];
}

function renderThemeRow(theme, container) {
  const admin = isAdmin();
  const num = theme.numero ? String(theme.numero).padStart(2, "0") : "—";
  const statutNorm = normalizeStatut(theme.statut);
  const color = statutNorm === "Fait" ? "done" : "todo";

  // Statut chip cliquable (admin only) — toggle binaire
  const statutChip = el(admin ? "button" : "span", {
    class: "theme-statut " + color + (admin ? " clickable" : ""),
    type: admin ? "button" : undefined,
    title: admin ? "Cliquer pour basculer fait / à faire" : ""
  },
    el("span", { class: "theme-statut-dot" }),
    statutNorm
  );
  if (admin) statutChip.addEventListener("click", (ev) => {
    ev.preventDefault();
    cycleStatut(theme, container, statutChip);
  });

  // Notes (toujours visible, mais readonly si pas admin)
  const notesInput = el("input", {
    type: "text",
    class: "theme-notes",
    placeholder: admin ? "Notes pédagogiques…" : "",
    value: theme.notes || "",
    readonly: !admin || undefined,
  });
  if (admin) {
    notesInput.addEventListener("input", () => debouncedNoteSave(theme)(notesInput.value));
  }

  // Date — éditable si admin
  let dateLabel;
  if (admin) {
    dateLabel = el("button", {
      class: "theme-date editable" + (theme.date_fait ? "" : " muted"),
      type: "button",
      title: "Modifier la date",
      onClick: (ev) => {
        ev.preventDefault();
        openDateEditor(theme, dateLabel, container);
      },
    }, theme.date_fait ? formatDate(theme.date_fait) : "+ date");
  } else {
    dateLabel = theme.date_fait
      ? el("span", { class: "theme-date" }, formatDate(theme.date_fait))
      : el("span", { class: "theme-date muted" }, "—");
  }

  // Delete (admin notion seulement, jamais sur thèmes officiels)
  let delBtn = null;
  if (admin && theme.type === "notion") {
    delBtn = el("button", {
      class: "btn small danger icon-only", "aria-label": "Supprimer la notion",
      onClick: async () => {
        if (!confirm(`Supprimer la notion « ${theme.titre} » ?`)) return;
        await deleteTheme(theme.id);
        themes = themes.filter((t) => t.id !== theme.id);
        rerender(container);
      }
    });
    delBtn.appendChild(icon.trash());
  }

  const titreBtn = el("button", {
    class: "theme-titre-link", type: "button",
    title: "Voir le contenu du thème",
    onClick: () => openThemeModal(theme),
  }, theme.titre);

  // Colonne QCM (fondateur seulement) : cellule dédiée à droite, jamais sous le titre.
  const qcm = qcmByTheme.get(theme.id);
  const qcmCell = canSeeQcm()
    ? el("div", { class: "theme-qcm-cell" }, qcm ? qcmHintEl(theme, qcm) : null)
    : null;

  return el("div", { class: "theme-row " + color, dataset: { id: theme.id } },
    el("span", { class: "theme-num" }, num),
    el("div", { class: "theme-titre-block" },
      titreBtn,
      theme.categorie ? el("span", { class: "theme-cat" }, theme.categorie) : null,
    ),
    statutChip,
    dateLabel,
    notesInput,
    qcmCell,
    delBtn || el("span"),
  );
}

function uniqueCategories(list) {
  return [...new Set(list.map((t) => t.categorie).filter(Boolean))];
}

function matchesFilters(t) {
  if (filterStatut    && normalizeStatut(t.statut) !== filterStatut) return false;
  if (filterType      && t.type      !== filterType)      return false;
  if (filterCategorie && t.categorie !== filterCategorie) return false;
  if (search) {
    const q = search.toLowerCase();
    const inTitle = t.titre.toLowerCase().includes(q);
    const inNum = t.numero != null && String(t.numero).includes(q);
    const inCat = (t.categorie || "").toLowerCase().includes(q);
    if (!inTitle && !inNum && !inCat) return false;
  }
  return true;
}

function openAddNotionModal(onSaved) {
  const backdrop = el("div", { class: "modal-backdrop" });

  const titreInput = el("input", { type: "text", placeholder: "Ex. Matrice GDE" });
  const catInput = el("input", { type: "text", placeholder: "Catégorie (optionnel)", value: "Notion pédagogique" });

  async function save() {
    if (!titreInput.value.trim()) { toast("Le titre est requis", "error"); return; }
    try {
      await addTheme({
        titre: titreInput.value.trim(),
        categorie: catInput.value.trim() || null,
        type: "notion",
        ordre: 999,
        updated_by_email: getAdminEmail(),
      });
      toast("Notion ajoutée", "success");
      backdrop.remove();
      onSaved();
    } catch (e) { toast(e.message, "error"); }
  }

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Ajouter une notion pédagogique"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Titre"), titreInput),
      el("div", { class: "field" }, el("label", {}, "Catégorie"), catInput),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler"),
      el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

// Méta de présentation par "famille" (groupe top-level dans la nav)
// L'ordre ici détermine l'ordre d'affichage.
const FAMILLES = [
  {
    key: "themes-officiels",
    label: "Thèmes officiels",
    short: "Thèmes",
    match: (t) => t.type === "theme",
  },
  {
    key: "competences-formateur",
    label: "Compétences formateur (TP ECSR)",
    short: "TP ECSR",
    match: (t) => t.type === "notion" && t.categorie === "Compétence formateur (TP ECSR)",
  },
  {
    key: "competences-conduite",
    label: "Compétences conduite (REMC)",
    short: "REMC",
    match: (t) => t.type === "notion" && t.categorie === "Compétence conduite (REMC)",
  },
  {
    key: "notions-pedagogiques",
    label: "Notions pédagogiques",
    short: "Notions",
    match: (t) => t.type === "notion" && t.categorie === "Notion pédagogique",
  },
];

let activeFamille = "all";  // "all" ou clé de famille

function familleStats(items) {
  const total = items.length;
  const fait = items.filter((t) => normalizeStatut(t.statut) === "Fait").length;
  return { total, fait, aFaire: total - fait, pct: total ? Math.round(fait / total * 100) : 0 };
}

// Items visibles d'une famille selon les filtres courants (même logique que rerender).
function visibleFamilleItems(f) {
  return themes.filter(f.match).filter((t) => {
    if (filterStatut && normalizeStatut(t.statut) !== filterStatut) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTitle = t.titre.toLowerCase().includes(q);
      const inNum = t.numero != null && String(t.numero).includes(q);
      const inCat = (t.categorie || "").toLowerCase().includes(q);
      if (!inTitle && !inNum && !inCat) return false;
    }
    return true;
  });
}

// Recalcule en place les stats des sections (Faits / À faire / barre + %) et
// l'eyebrow global, sans rerender complet (préserve scroll + inputs ouverts).
// Corrige le décalage : la ligne se mettait à jour mais pas l'en-tête de section.
function refreshStatsInPlace(container) {
  FAMILLES.forEach((f) => {
    const section = container.querySelector(".theme-section-" + f.key);
    if (!section) return;
    const stats = familleStats(visibleFamilleItems(f));
    const vals = section.querySelectorAll(".theme-section-stat-value");
    if (vals[0]) vals[0].textContent = String(stats.fait);
    if (vals[1]) vals[1].textContent = String(stats.aFaire);
    const fill = section.querySelector(".theme-progress-fill");
    if (fill) fill.style.width = stats.pct + "%";
    const label = section.querySelector(".theme-progress-label");
    if (label) label.textContent = stats.pct + "%";
  });
  const tp = familleStats(themes.filter((t) => t.type === "theme"));
  const eyebrow = container.querySelector(".view-header .eyebrow");
  if (eyebrow) eyebrow.textContent = tp.fait + " / " + tp.total + " thèmes officiels terminés";
}

function rerender(container) {
  clear(container);

  const admin = isAdmin();

  // Toutes les familles avec leur contenu (avant search)
  const famillesData = FAMILLES.map((f) => {
    const items = themes.filter(f.match);
    return { ...f, items, stats: familleStats(items) };
  }).filter((f) => f.items.length > 0);

  // Stats globales (uniquement thèmes officiels)
  const themesOfficiels = themes.filter((t) => t.type === "theme");
  const totalProgress = familleStats(themesOfficiels);

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, totalProgress.fait + " / " + totalProgress.total + " thèmes officiels terminés"),
      el("h2", {}, "Thèmes & progression"),
      el("p", { class: "subtitle" }, "Référentiel officiel ECF (57 thèmes) + compétences TP ECSR (formateur) + compétences REMC (conduite) + notions pédagogiques."),
    ),
    admin ? el("button", { class: "btn primary", onClick: () => openAddNotionModal(() => reload(container)) },
      icon.plus(), "Ajouter une notion"
    ) : null,
  ));

  // Navigation par pills (par famille)
  const pillsWrap = el("div", { class: "theme-pills" });
  const pillAll = el("button", {
    class: "theme-pill" + (activeFamille === "all" ? " active" : ""),
    onClick: () => { activeFamille = "all"; rerender(container); }
  }, "Tout", el("span", { class: "theme-pill-count" }, themes.length));
  pillsWrap.appendChild(pillAll);

  famillesData.forEach((f) => {
    const pill = el("button", {
      class: "theme-pill theme-pill-" + f.key + (activeFamille === f.key ? " active" : ""),
      onClick: () => { activeFamille = f.key; rerender(container); }
    },
      f.short,
      el("span", { class: "theme-pill-count" }, f.items.length),
    );
    pillsWrap.appendChild(pill);
  });
  container.appendChild(pillsWrap);

  // Filtres supplémentaires (recherche + statut + catégorie fine)
  const searchInput = el("input", { type: "search", placeholder: "Rechercher…", value: search });
  searchInput.addEventListener("input", debounce(() => { search = searchInput.value; rerender(container); }, 200));

  const statutSel = el("select");
  statutSel.appendChild(el("option", { value: "" }, "Tous les statuts"));
  STATUTS.forEach((s) => {
    const opt = el("option", { value: s.value }, s.value);
    if (filterStatut === s.value) opt.selected = true;
    statutSel.appendChild(opt);
  });
  statutSel.addEventListener("change", () => { filterStatut = statutSel.value; rerender(container); });

  container.appendChild(el("div", { class: "passages-toolbar" },
    el("div", { class: "passages-filters" }, searchInput, statutSel),
  ));

  // Détermine les familles à afficher (active ou toutes)
  const famillesToShow = activeFamille === "all"
    ? famillesData
    : famillesData.filter((f) => f.key === activeFamille);

  // Rendu de chaque famille comme section autonome
  famillesToShow.forEach((f) => {
    // Filtre interne par search + statut
    const items = f.items.filter((t) => {
      if (filterStatut && normalizeStatut(t.statut) !== filterStatut) return false;
      if (search) {
        const q = search.toLowerCase();
        const inTitle = t.titre.toLowerCase().includes(q);
        const inNum = t.numero != null && String(t.numero).includes(q);
        const inCat = (t.categorie || "").toLowerCase().includes(q);
        if (!inTitle && !inNum && !inCat) return false;
      }
      return true;
    });

    if (items.length === 0) return;

    const stats = familleStats(items);

    const section = el("section", { class: "theme-section theme-section-" + f.key });

    // Header de section
    section.appendChild(el("div", { class: "theme-section-head" },
      el("div", { class: "theme-section-title-wrap" },
        el("h3", { class: "theme-section-title" }, f.label),
        el("p", { class: "muted theme-section-subtitle" }, items.length + " entrée" + (items.length > 1 ? "s" : "")),
      ),
      el("div", { class: "theme-section-stats" },
        el("div", { class: "theme-section-stat" },
          el("span", { class: "theme-section-stat-value" }, String(stats.fait)),
          el("span", { class: "theme-section-stat-label" }, "Faits"),
        ),
        el("div", { class: "theme-section-stat" },
          el("span", { class: "theme-section-stat-value" }, String(stats.aFaire)),
          el("span", { class: "theme-section-stat-label" }, "À faire"),
        ),
      ),
    ));

    // Barre de progression
    if (stats.total > 0) {
      const bar = el("div", { class: "theme-progress" },
        el("div", { class: "theme-progress-fill", style: `width: ${stats.pct}%` }),
      );
      section.appendChild(el("div", { class: "theme-progress-wrap" },
        bar,
        el("span", { class: "theme-progress-label" }, stats.pct + "%"),
      ));
    }

    // Liste des thèmes/notions, sous-groupée par catégorie si c'est une famille avec sous-cats (thèmes officiels)
    const list = el("div", { class: "themes-list" + (canSeeQcm() ? " qcm-on" : "") });
    list.appendChild(el("div", { class: "theme-row theme-header" },
      el("span", { class: "theme-num" }, "N°"),
      el("span", {}, "Thème"),
      el("span", {}, "Statut"),
      el("span", {}, "Fait le"),
      el("span", {}, "Notes"),
      canSeeQcm() ? el("span", {}, "QCM") : null,
      el("span", {}),
    ));

    // Sous-groupage par catégorie uniquement pour les thèmes officiels (qui ont 11 sous-catégories)
    const needsSubGroup = f.key === "themes-officiels";
    if (needsSubGroup) {
      const grouped = {};
      items.forEach((t) => {
        const key = t.categorie || "Sans catégorie";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(t);
      });
      Object.entries(grouped).forEach(([cat, gItems]) => {
        list.appendChild(el("div", { class: "theme-group-head" }, cat, el("span", { class: "muted" }, " · " + gItems.length)));
        gItems.forEach((t) => list.appendChild(renderThemeRow(t, container)));
      });
    } else {
      items.forEach((t) => list.appendChild(renderThemeRow(t, container)));
    }
    section.appendChild(list);

    container.appendChild(section);
  });

  // Aucun résultat
  const anyShown = famillesToShow.some((f) => f.items.length > 0);
  if (!anyShown) {
    container.appendChild(el("p", { class: "muted", style: "padding:2rem 0;text-align:center" }, "Aucun thème ne correspond aux filtres."));
  }
}

async function reload(container) {
  themes = await listThemes();
  await loadQcmIndex();
  rerender(container);
}

export async function renderThemes(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  themes = await listThemes();
  await loadQcmIndex();
  rerender(container);
}
