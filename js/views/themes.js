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
  const fait = items.filter((t) => t.statut === "Fait").length;
  const enCours = items.filter((t) => t.statut === "En cours").length;
  return { total, fait, enCours, aFaire: total - fait - enCours, pct: total ? Math.round(fait / total * 100) : 0 };
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
      if (filterStatut && t.statut !== filterStatut) return false;
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
          el("span", { class: "theme-section-stat-value" }, String(stats.enCours)),
          el("span", { class: "theme-section-stat-label" }, "En cours"),
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
    const list = el("div", { class: "themes-list" });
    list.appendChild(el("div", { class: "theme-row theme-header" },
      el("span", { class: "theme-num" }, "N°"),
      el("span", {}, "Thème"),
      el("span", {}, "Statut"),
      el("span", {}, "Fait le"),
      el("span", {}, "Notes"),
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
  rerender(container);
}

export async function renderThemes(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  themes = await listThemes();
  rerender(container);
}
