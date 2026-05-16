import { listThemes, updateTheme, addTheme, deleteTheme } from "../db.js";
import { el, clear, isoDate, formatDate, toast, debounce } from "../utils.js";
import { icon } from "../icons.js";
import { isAdmin, getAdminEmail } from "../auth-admin.js";

let themes = [];
let filterStatut = "";
let filterType = "";
let filterCategorie = "";
let search = "";

const STATUTS = [
  { value: "À faire",  color: "todo"     },
  { value: "En cours", color: "doing"    },
  { value: "Fait",     color: "done"     },
];

function nextStatut(current) {
  const idx = STATUTS.findIndex((s) => s.value === current);
  return STATUTS[(idx + 1) % STATUTS.length].value;
}

async function cycleStatut(theme, container) {
  const newStatut = nextStatut(theme.statut);
  const patch = {
    statut: newStatut,
    updated_by_email: getAdminEmail(),
    date_fait: newStatut === "Fait" ? isoDate(new Date()) : null,
  };
  try {
    await updateTheme(theme.id, patch);
    Object.assign(theme, patch);
    rerender(container);
  } catch (e) {
    toast(e.message, "error");
  }
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
  const statutObj = STATUTS.find((s) => s.value === theme.statut) || STATUTS[0];

  // Statut chip cliquable (admin only)
  const statutChip = el(admin ? "button" : "span", {
    class: "theme-statut " + statutObj.color + (admin ? " clickable" : ""),
    title: admin ? "Cliquer pour changer le statut" : ""
  },
    el("span", { class: "theme-statut-dot" }),
    theme.statut
  );
  if (admin) statutChip.addEventListener("click", () => cycleStatut(theme, container));

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

  // Date
  const dateLabel = theme.date_fait
    ? el("span", { class: "theme-date" }, formatDate(theme.date_fait))
    : el("span", { class: "theme-date muted" }, "—");

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

  return el("div", { class: "theme-row " + statutObj.color, dataset: { id: theme.id } },
    el("span", { class: "theme-num" }, num),
    el("div", { class: "theme-titre-block" },
      el("span", { class: "theme-titre" }, theme.titre),
      theme.categorie ? el("span", { class: "theme-cat" }, theme.categorie) : null,
    ),
    statutChip,
    dateLabel,
    notesInput,
    delBtn || el("span"),
  );
}

function uniqueCategories(list) {
  return [...new Set(list.map((t) => t.categorie).filter(Boolean))];
}

function matchesFilters(t) {
  if (filterStatut    && t.statut    !== filterStatut)    return false;
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

function rerender(container) {
  clear(container);

  const admin = isAdmin();
  const filtered = themes.filter(matchesFilters);
  const themesCount = themes.filter((t) => t.type === "theme").length;
  const doneCount = themes.filter((t) => t.type === "theme" && t.statut === "Fait").length;
  const doingCount = themes.filter((t) => t.type === "theme" && t.statut === "En cours").length;

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, doneCount + " / " + themesCount + " thèmes officiels terminés"),
      el("h2", {}, "Thèmes & progression"),
      el("p", { class: "subtitle" }, "57 thèmes officiels du référentiel + notions pédagogiques. Clic sur le statut pour faire défiler À faire → En cours → Fait."),
    ),
    admin ? el("button", { class: "btn primary", onClick: () => openAddNotionModal(() => reload(container)) },
      icon.plus(), "Ajouter une notion"
    ) : null,
  ));

  // Stats
  container.appendChild(el("div", { class: "dashboard-meta" },
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(doneCount)),
      el("span", { class: "label" }, "Faits"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(doingCount)),
      el("span", { class: "label" }, "En cours"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(themesCount - doneCount - doingCount)),
      el("span", { class: "label" }, "À faire"),
    ),
    el("div", { class: "stat-block" },
      el("span", { class: "value" }, String(Math.round(doneCount / themesCount * 100)) + "%"),
      el("span", { class: "label" }, "Progression"),
    ),
  ));

  // Filtres
  const searchInput = el("input", { type: "search", placeholder: "Rechercher un thème…", value: search });
  searchInput.addEventListener("input", debounce(() => { search = searchInput.value; rerender(container); }, 200));

  const statutSel = el("select");
  statutSel.appendChild(el("option", { value: "" }, "Tous les statuts"));
  STATUTS.forEach((s) => {
    const opt = el("option", { value: s.value }, s.value);
    if (filterStatut === s.value) opt.selected = true;
    statutSel.appendChild(opt);
  });
  statutSel.addEventListener("change", () => { filterStatut = statutSel.value; rerender(container); });

  const typeSel = el("select");
  typeSel.appendChild(el("option", { value: "" }, "Thèmes + notions"));
  [["theme", "Thèmes officiels"], ["notion", "Notions pédagogiques"]].forEach(([v, l]) => {
    const opt = el("option", { value: v }, l);
    if (filterType === v) opt.selected = true;
    typeSel.appendChild(opt);
  });
  typeSel.addEventListener("change", () => { filterType = typeSel.value; rerender(container); });

  const catSel = el("select");
  catSel.appendChild(el("option", { value: "" }, "Toutes catégories"));
  uniqueCategories(themes).forEach((c) => {
    const opt = el("option", { value: c }, c);
    if (filterCategorie === c) opt.selected = true;
    catSel.appendChild(opt);
  });
  catSel.addEventListener("change", () => { filterCategorie = catSel.value; rerender(container); });

  container.appendChild(el("div", { class: "passages-toolbar" },
    el("div", { class: "passages-filters" }, searchInput, statutSel, typeSel, catSel),
  ));

  // Liste groupée par catégorie
  if (filtered.length === 0) {
    container.appendChild(el("p", { class: "muted", style: "padding:2rem 0;text-align:center" }, "Aucun thème ne correspond aux filtres."));
    return;
  }

  // Header
  const list = el("div", { class: "themes-list" });
  list.appendChild(el("div", { class: "theme-row theme-header" },
    el("span", { class: "theme-num" }, "N°"),
    el("span", {}, "Thème"),
    el("span", {}, "Statut"),
    el("span", {}, "Fait le"),
    el("span", {}, "Notes"),
    el("span", {}),
  ));

  // Groupage par catégorie
  const grouped = {};
  filtered.forEach((t) => {
    const key = t.categorie || "Sans catégorie";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });
  Object.entries(grouped).forEach(([cat, items]) => {
    list.appendChild(el("div", { class: "theme-group-head" }, cat, el("span", { class: "muted" }, " · " + items.length)));
    items.forEach((t) => list.appendChild(renderThemeRow(t, container)));
  });

  container.appendChild(list);
}

async function reload(container) {
  themes = await listThemes();
  rerender(container);
}

export async function renderThemes(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  themes = await listThemes();
  rerender(container);
}
