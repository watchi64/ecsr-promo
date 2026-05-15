import { listStagiaires, listPassages, addPassage, deletePassage } from "../db.js";
import { el, clear, isoDate, formatDate, toast } from "../utils.js";
import { icon } from "../icons.js";
import { TYPES, RESULTATS } from "../config.js";

let stagiaires = [];
let passages = [];
let filterStagiaire = "";
let filterType = "";
let filterResultat = "";

function openAddModal(onSaved) {
  const today = isoDate(new Date());
  const backdrop = el("div", { class: "modal-backdrop" });

  const dateInput = el("input", { type: "date", value: today });
  const stagiaireSel = el("select");
  stagiaireSel.appendChild(el("option", { value: "" }, "—"));
  stagiaires.forEach((s) => stagiaireSel.appendChild(el("option", { value: s.id }, s.prenom)));

  const typeSel = el("select");
  TYPES.forEach((t) => typeSel.appendChild(el("option", { value: t }, t)));

  const resultatSel = el("select");
  RESULTATS.forEach((r) => resultatSel.appendChild(el("option", { value: r.value }, r.value)));

  const remplacantSel = el("select");
  remplacantSel.appendChild(el("option", { value: "" }, "—"));
  stagiaires.forEach((s) => remplacantSel.appendChild(el("option", { value: s.id }, s.prenom)));

  const commentInput = el("input", { type: "text", placeholder: "Optionnel" });

  async function save() {
    if (!stagiaireSel.value) { toast("Choisir un stagiaire", "error"); return; }
    try {
      await addPassage({
        date: dateInput.value,
        stagiaire_id: Number(stagiaireSel.value),
        type: typeSel.value,
        resultat: resultatSel.value,
        remplacant_id: remplacantSel.value ? Number(remplacantSel.value) : null,
        commentaire: commentInput.value || null,
        origine: "Manuel",
      });
      toast("Passage enregistré", "success");
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

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Ajouter un passage"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Date"), dateInput),
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
      el("th", {}, "Origine"),
      el("th", { style: "width:50px" }, "")
    )
  ));

  const tbody = el("tbody");
  filtered.forEach((p) => {
    const delBtn = el("button", {
      class: "btn small danger icon-only",
      "aria-label": "Supprimer",
      onClick: async () => {
        if (!confirm(`Supprimer ce passage ?`)) return;
        await deletePassage(p.id);
        toast("Supprimé", "success");
        await reload(container);
      }
    });
    delBtn.appendChild(icon.trash());

    const tr = el("tr", {},
      el("td", { class: "date" }, formatDate(p.date)),
      el("td", {}, p.stagiaire?.prenom || "?"),
      el("td", {}, el("span", { class: "tag " + (p.type === "Salle" ? "salle" : "voiture") }, p.type)),
      el("td", {}, resultTag(p.resultat)),
      el("td", { class: "muted" }, p.remplacant?.prenom || "—"),
      el("td", {}, el("span", { class: "tag " + (p.origine === "Manuel" ? "origine-manuel" : "origine-auto") }, p.origine)),
      el("td", {}, delBtn)
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

function rerender(container) {
  clear(container);

  const stagiaireFilter = el("select");
  stagiaireFilter.appendChild(el("option", { value: "" }, "Tous les stagiaires"));
  stagiaires.forEach((s) => {
    const opt = el("option", { value: s.id }, s.prenom);
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

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, passages.length + " entrées au total"),
      el("h2", {}, "Historique des passages"),
      el("p", { class: "subtitle" }, "Tous les passages enregistrés — manuels ou synchronisés depuis le planning."),
    ),
    addBtn
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
