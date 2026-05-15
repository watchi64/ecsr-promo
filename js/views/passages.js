import { listStagiaires, listPassages, addPassage, deletePassage } from "../db.js";
import { el, clear, isoDate, formatDate, toast } from "../utils.js";
import { TYPES, RESULTATS } from "../config.js";

let stagiaires = [];
let passages = [];
let filterStagiaire = "";
let filterType = "";

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
  RESULTATS.forEach((r) => resultatSel.appendChild(el("option", { value: r.value }, r.icon + " " + r.value)));

  const remplacantSel = el("select");
  remplacantSel.appendChild(el("option", { value: "" }, "— (aucun)"));
  stagiaires.forEach((s) => remplacantSel.appendChild(el("option", { value: s.id }, s.prenom)));

  const commentInput = el("input", { type: "text", placeholder: "Commentaire (optionnel)" });

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
      toast("Passage ajouté", "success");
      backdrop.remove();
      onSaved();
    } catch (e) {
      console.error(e);
      toast("Erreur : " + e.message, "error");
    }
  }

  const modal = el("div", { class: "modal" },
    el("h3", {}, "➕ Ajouter un passage"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Date"), dateInput),
      el("div", { class: "field" }, el("label", {}, "Stagiaire"), stagiaireSel),
      el("div", { class: "field" }, el("label", {}, "Type"), typeSel),
      el("div", { class: "field" }, el("label", {}, "Résultat"), resultatSel),
      el("div", { class: "field" }, el("label", {}, "Remplacé par (si absence)"), remplacantSel),
      el("div", { class: "field" }, el("label", {}, "Commentaire"), commentInput),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn outline", onClick: () => backdrop.remove() }, "Annuler"),
      el("button", { class: "btn primary", style: "width:auto", onClick: save }, "Enregistrer")
    )
  );

  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function renderTable(container) {
  let filtered = passages;
  if (filterStagiaire) filtered = filtered.filter((p) => p.stagiaire_id === Number(filterStagiaire));
  if (filterType) filtered = filtered.filter((p) => p.type === filterType);

  const table = el("table", { class: "passages-table" });
  const thead = el("thead");
  thead.appendChild(el("tr", {},
    el("th", {}, "Date"),
    el("th", {}, "Stagiaire"),
    el("th", {}, "Type"),
    el("th", {}, "Résultat"),
    el("th", {}, "Remplacé par"),
    el("th", {}, "Origine"),
    el("th", {}, "")
  ));
  table.appendChild(thead);

  const tbody = el("tbody");
  filtered.forEach((p) => {
    const res = RESULTATS.find((r) => r.value === p.resultat) || { icon: "", color: "" };
    const tr = el("tr", {},
      el("td", {}, formatDate(p.date)),
      el("td", {}, p.stagiaire?.prenom || "?"),
      el("td", {}, el("span", { class: "tag " + (p.type === "Salle" ? "salle" : "voiture") }, p.type)),
      el("td", {}, el("span", { class: "tag " + res.color }, res.icon + " " + p.resultat)),
      el("td", {}, p.remplacant?.prenom || ""),
      el("td", {}, el("span", { class: "tag " + (p.origine === "Manuel" ? "origine-manuel" : "origine-auto") }, p.origine)),
      el("td", {},
        el("button", {
          class: "btn small danger",
          onClick: async () => {
            if (!confirm("Supprimer ce passage ?")) return;
            await deletePassage(p.id);
            toast("Supprimé", "success");
            await reload(container);
          }
        }, "🗑")
      )
    );
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

async function reload(container) {
  passages = await listPassages();
  rerender(container);
}

function rerender(container) {
  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("h2", {}, "📝 Passages — historique"),
    el("p", { class: "subtitle" }, passages.length + " passages enregistrés")
  ));

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

  container.appendChild(el("div", { class: "passages-toolbar" },
    el("div", { class: "passages-filters" }, stagiaireFilter, typeFilter),
    el("button", { class: "btn primary", style: "width:auto", onClick: () => openAddModal(() => reload(container)) }, "➕ Ajouter un passage")
  ));

  container.appendChild(renderTable(container));
}

export async function renderPassages(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  [stagiaires, passages] = await Promise.all([listStagiaires(), listPassages()]);
  rerender(container);
}
