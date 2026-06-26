import { listStagiaires, listPassages, addPassage, deletePassage, listRecentPassagesAudit } from "../db.js?v=20260626b";
import { el, clear, isoDate, formatDate, toast, displayStagiaire } from "../utils.js?v=20260626b";
import { icon } from "../icons.js?v=20260626b";
import { recordUndo } from "../undo.js?v=20260626b";
import { TYPES, RESULTATS } from "../config.js?v=20260626b";
import { isAdmin, getAdminEmail } from "../auth-admin.js?v=20260626b";
import { getCurrentWho } from "../identity.js?v=20260626b";

let stagiaires = [];
let passages = [];
let filterStagiaire = "";
let filterType = "";
let filterResultat = "";

function openAddModal(onSaved) {
  const today = isoDate(new Date());
  const backdrop = el("div", { class: "modal-backdrop" });

  // Non-admins : date min = aujourd'hui - 2 jours (anti backdating)
  const admin = isAdmin();
  const minDateForNonAdmin = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return isoDate(d);
  })();
  const dateInput = el("input", {
    type: "date",
    value: today,
    max: today,
    min: admin ? undefined : minDateForNonAdmin,
  });
  const stagiaireSel = el("select");
  stagiaireSel.appendChild(el("option", { value: "" }, "—"));
  stagiaires.forEach((s) => stagiaireSel.appendChild(el("option", { value: s.id }, displayStagiaire(s))));

  const typeSel = el("select");
  TYPES.forEach((t) => typeSel.appendChild(el("option", { value: t }, t)));

  const resultatSel = el("select");
  RESULTATS.forEach((r) => resultatSel.appendChild(el("option", { value: r.value }, r.value)));

  const remplacantSel = el("select");
  remplacantSel.appendChild(el("option", { value: "" }, "—"));
  stagiaires.forEach((s) => remplacantSel.appendChild(el("option", { value: s.id }, displayStagiaire(s))));

  const commentInput = el("input", { type: "text", placeholder: "Optionnel" });

  async function save() {
    if (!stagiaireSel.value) { toast("Choisir un stagiaire", "error"); return; }

    // Garde-fou : non-admin ne peut pas rétro-dater de plus de 2 jours
    if (!admin && dateInput.value < minDateForNonAdmin) {
      toast("Date trop ancienne. Limite de 2 jours en arrière (admin uniquement pour les dates plus anciennes).", "error", 4000);
      return;
    }
    if (dateInput.value > today) {
      toast("Pas de date future", "error");
      return;
    }

    try {
      const who = getCurrentWho();
      const inserted = await addPassage({
        date: dateInput.value,
        stagiaire_id: Number(stagiaireSel.value),
        type: typeSel.value,
        resultat: resultatSel.value,
        remplacant_id: remplacantSel.value ? Number(remplacantSel.value) : null,
        commentaire: commentInput.value || null,
        origine: "Manuel",
        created_by_who: who,
        updated_by_who: who,
      });
      toast("Passage enregistré · Ctrl+Z pour annuler", "success", 2400);
      if (inserted?.id) {
        recordUndo("passage ajouté", async () => { await deletePassage(inserted.id); });
      }
      backdrop.remove();
      onSaved();
    } catch (e) {
      console.error(e);
      toast(e.message, "error");
    }
  }

  const cancelBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler");
  const saveBtn = el("button", { class: "btn primary", onClick: save },
    icon.check(), "Enregistrer"
  );

  const dateField = el("div", { class: "field" },
    el("label", {}, "Date"),
    dateInput,
  );
  if (!admin) {
    dateField.appendChild(el("small", { class: "field-hint muted" },
      "Tu peux ajouter des passages des 2 derniers jours. Pour les dates plus anciennes, un admin doit s'en charger."
    ));
  }

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Ajouter un passage"),
    el("div", { class: "modal-form" },
      dateField,
      el("div", { class: "field" }, el("label", {}, "Stagiaire"), stagiaireSel),
      el("div", { class: "field" }, el("label", {}, "Type"), typeSel),
      el("div", { class: "field" }, el("label", {}, "Résultat"), resultatSel),
      el("div", { class: "field" }, el("label", {}, "Remplacé par"), remplacantSel),
      el("div", { class: "field" }, el("label", {}, "Commentaire"), commentInput),
    ),
    el("div", { class: "modal-actions" }, cancelBtn, saveBtn)
  );

  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function resultTag(resultat) {
  const r = RESULTATS.find((x) => x.value === resultat);
  return el("span", { class: "tag " + (r?.color || "") }, resultat);
}

function renderTable(container) {
  const admin = isAdmin();
  let filtered = passages;
  if (filterStagiaire) filtered = filtered.filter((p) => p.stagiaire_id === Number(filterStagiaire));
  if (filterType)     filtered = filtered.filter((p) => p.type === filterType);
  if (filterResultat) filtered = filtered.filter((p) => p.resultat === filterResultat);

  if (filtered.length === 0) {
    return el("div", { style: "padding:3rem 1rem;text-align:center;color:var(--text-muted)" },
      el("p", {}, "Aucun passage à afficher."),
      el("p", { class: "faint", style: "font-size:0.85rem" }, "Modifie les filtres ou ajoute un passage.")
    );
  }

  const wrap = el("div", { class: "passages-table-wrap" });
  const table = el("table", { class: "passages-table" });
  table.appendChild(el("thead", {},
    el("tr", {},
      el("th", {}, "Date"),
      el("th", {}, "Stagiaire"),
      el("th", {}, "Type"),
      el("th", {}, "Résultat"),
      el("th", {}, "Remplacé par"),
      el("th", {}, "Ajouté par"),
      admin ? el("th", { style: "width:50px" }, "") : null
    )
  ));

  const tbody = el("tbody");
  filtered.forEach((p) => {
    // Suppression réservée aux admins (RLS : seul is_admin() peut DELETE).
    const delBtn = admin ? el("button", {
      class: "btn small danger icon-only",
      "aria-label": "Supprimer",
      onClick: async () => {
        if (!confirm(`Supprimer ce passage ?`)) return;
        const snapshot = { ...p };
        delete snapshot.id; delete snapshot.created_at; delete snapshot.updated_at;
        delete snapshot.stagiaire; delete snapshot.remplacant;
        await deletePassage(p.id);
        toast("Passage supprimé · Ctrl+Z pour annuler", "success", 2400);
        recordUndo("passage supprimé", async () => { await addPassage(snapshot); });
        await reload(container);
      }
    }) : null;
    if (delBtn) delBtn.appendChild(icon.trash());

    const whoLabel = p.created_by_who || (p.origine === "Planning" ? "Auto" : "—");
    const isAdmin_ = whoLabel.includes("@");

    const tr = el("tr", {},
      el("td", { class: "date" }, formatDate(p.date)),
      el("td", {}, p.stagiaire ? displayStagiaire(p.stagiaire) : "?"),
      el("td", {}, el("span", { class: "tag " + (p.type === "Salle" ? "salle" : "voiture") }, p.type)),
      el("td", {}, resultTag(p.resultat)),
      el("td", { class: "muted" }, p.remplacant ? displayStagiaire(p.remplacant) : "—"),
      el("td", {}, el("span", { class: "tag who" + (isAdmin_ ? " admin" : "") }, whoLabel)),
      admin ? el("td", {}, delBtn) : null
    );
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

async function reload(container) {
  passages = await listPassages();
  rerender(container);
}

async function openAuditModal() {
  const backdrop = el("div", { class: "modal-backdrop" });
  const modal = el("div", { class: "modal", style: "max-width:680px" });
  modal.appendChild(el("h3", {}, "Historique des modifications"));
  modal.appendChild(el("p", { class: "muted", style: "margin:0 0 1rem;font-size:0.88rem" },
    "100 dernières actions (ajout / modification / suppression) sur les passages."
  ));

  const list = el("div", { class: "audit-list" });
  list.appendChild(el("div", { class: "loading" }, "Chargement"));
  modal.appendChild(list);
  modal.appendChild(el("div", { class: "modal-actions" },
    el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer")
  ));
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);

  try {
    const audit = await listRecentPassagesAudit(100);
    clear(list);
    if (audit.length === 0) {
      list.appendChild(el("p", { class: "muted" }, "Aucune modification encore."));
      return;
    }
    audit.forEach((a) => {
      const time = new Date(a.changed_at).toLocaleString("fr-FR");
      const who = a.changed_by_who || "Anonyme";
      const actLabel = a.action === "insert" ? "Création" : a.action === "update" ? "Modification" : "Suppression";

      let summary = "";
      const data = a.after_data || a.before_data || {};
      if (data) {
        const stagId = data.stagiaire_id;
        const stag = stagiaires.find((s) => s.id === stagId);
        const stagName = stag ? displayStagiaire(stag) : `#${stagId}`;
        summary = `${stagName} · ${data.type} · ${data.resultat}`;
      }

      list.appendChild(el("div", { class: "audit-item " + a.action },
        el("div", { class: "audit-head" },
          el("span", { class: "audit-action " + a.action }, actLabel),
          el("span", { class: "audit-time" }, time),
        ),
        el("div", { class: "audit-meta" }, "par ", el("strong", {}, who)),
        el("div", { class: "audit-summary" }, summary),
      ));
    });
  } catch (e) {
    clear(list);
    list.appendChild(el("p", { class: "error" }, "Erreur : " + e.message));
  }
}

function rerender(container) {
  clear(container);

  const stagiaireFilter = el("select");
  stagiaireFilter.appendChild(el("option", { value: "" }, "Tous les stagiaires"));
  stagiaires.forEach((s) => {
    const opt = el("option", { value: s.id }, displayStagiaire(s));
    if (String(filterStagiaire) === String(s.id)) opt.selected = true;
    stagiaireFilter.appendChild(opt);
  });
  stagiaireFilter.addEventListener("change", () => { filterStagiaire = stagiaireFilter.value; rerender(container); });

  const typeFilter = el("select");
  typeFilter.appendChild(el("option", { value: "" }, "Tous les types"));
  TYPES.forEach((t) => {
    const opt = el("option", { value: t }, t);
    if (filterType === t) opt.selected = true;
    typeFilter.appendChild(opt);
  });
  typeFilter.addEventListener("change", () => { filterType = typeFilter.value; rerender(container); });

  const resFilter = el("select");
  resFilter.appendChild(el("option", { value: "" }, "Tous les résultats"));
  RESULTATS.forEach((r) => {
    const opt = el("option", { value: r.value }, r.value);
    if (filterResultat === r.value) opt.selected = true;
    resFilter.appendChild(opt);
  });
  resFilter.addEventListener("change", () => { filterResultat = resFilter.value; rerender(container); });

  const addBtn = el("button", { class: "btn primary", onClick: () => openAddModal(() => reload(container)) },
    icon.plus(), "Ajouter"
  );

  const histBtn = el("button", { class: "btn ghost", onClick: () => openAuditModal() },
    icon.clock(), "Historique"
  );

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, passages.length + " entrées au total"),
      el("h2", {}, "Historique des passages"),
      el("p", { class: "subtitle" }, "Tous les passages. Ajout ouvert à tous, suppression réservée aux admins. Chaque action est tracée."),
    ),
    el("div", { style: "display:flex;gap:0.5rem;flex-wrap:wrap" }, histBtn, addBtn),
  ));

  container.appendChild(el("div", { class: "passages-toolbar" },
    el("div", { class: "passages-filters" }, stagiaireFilter, typeFilter, resFilter)
  ));

  container.appendChild(renderTable(container));
}

export async function renderPassages(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  [stagiaires, passages] = await Promise.all([listStagiaires(), listPassages()]);
  rerender(container);
}
