import { listRessources, addRessource, updateRessource, deleteRessource } from "../db.js";
import { el, clear, toast } from "../utils.js";
import { icon } from "../icons.js";
import { isAdmin } from "../auth-admin.js";

let ressources = [];

const CATEGORIES_ORDER = ["Officiel", "Référentiels", "Pédagogie", "Examens", "Autre"];
const CATEGORY_ICONS = {
  "Officiel": "signpost",
  "Référentiels": "list",
  "Pédagogie": "edu",
  "Examens": "clock",
  "Autre": "list",
};

function openEditModal(existing, onSaved) {
  const isNew = !existing;
  const backdrop = el("div", { class: "modal-backdrop" });

  const titreInput = el("input", { type: "text", placeholder: "Titre", value: existing?.titre || "" });
  const urlInput = el("input", { type: "url", placeholder: "https://…", value: existing?.url || "" });
  const descInput = el("input", { type: "text", placeholder: "Description courte", value: existing?.description || "" });

  const catSel = el("select");
  CATEGORIES_ORDER.forEach((c) => {
    const opt = el("option", { value: c }, c);
    if ((existing?.categorie || "Autre") === c) opt.selected = true;
    catSel.appendChild(opt);
  });

  const badgeInput = el("input", { type: "text", placeholder: "Badge (Officiel, PDF, etc.)", value: existing?.badge || "" });

  async function save() {
    if (!titreInput.value.trim() || !urlInput.value.trim()) {
      toast("Titre et URL obligatoires", "error");
      return;
    }
    const payload = {
      titre: titreInput.value.trim(),
      url: urlInput.value.trim(),
      description: descInput.value.trim() || null,
      categorie: catSel.value,
      badge: badgeInput.value.trim() || null,
    };
    try {
      if (isNew) await addRessource(payload);
      else await updateRessource(existing.id, payload);
      toast(isNew ? "Ressource ajoutée" : "Ressource mise à jour", "success");
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
    el("h3", {}, isNew ? "Ajouter une ressource" : "Modifier la ressource"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Titre"), titreInput),
      el("div", { class: "field" }, el("label", {}, "URL"), urlInput),
      el("div", { class: "field" }, el("label", {}, "Description"), descInput),
      el("div", { class: "field" }, el("label", {}, "Catégorie"), catSel),
      el("div", { class: "field" }, el("label", {}, "Badge (optionnel)"), badgeInput),
    ),
    el("div", { class: "modal-actions" }, cancelBtn, saveBtn)
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function renderRessourceCard(r, onChange) {
  const admin = isAdmin();
  const card = el("a", { class: "ressource-card", href: r.url, target: "_blank", rel: "noopener noreferrer" },
    el("div", { class: "ressource-icon" }, icon[CATEGORY_ICONS[r.categorie] || "list"]()),
    el("div", { class: "ressource-body" },
      el("h4", { class: "ressource-title" },
        r.titre,
        r.badge ? el("span", { class: "ressource-badge" }, r.badge) : null
      ),
      r.description ? el("p", { class: "ressource-desc" }, r.description) : null,
      el("span", { class: "ressource-host muted" }, new URL(r.url).host.replace(/^www\./, "")),
    ),
  );

  if (admin) {
    const actions = el("div", { class: "ressource-actions" });
    const editBtn = el("button", {
      class: "btn small ghost icon-only", "aria-label": "Modifier",
      onClick: (ev) => { ev.preventDefault(); openEditModal(r, onChange); }
    });
    editBtn.appendChild(icon.settings());
    const delBtn = el("button", {
      class: "btn small danger icon-only", "aria-label": "Supprimer",
      onClick: async (ev) => {
        ev.preventDefault();
        if (!confirm(`Supprimer « ${r.titre} » ?`)) return;
        await deleteRessource(r.id);
        toast("Supprimée", "success");
        onChange();
      }
    });
    delBtn.appendChild(icon.trash());
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
  }

  return card;
}

function rerender(container) {
  clear(container);

  const admin = isAdmin();
  const addBtn = el("button", { class: "btn primary", onClick: () => openEditModal(null, () => reload(container)) },
    icon.plus(), "Ajouter une ressource");

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, ressources.length + " liens curés"),
      el("h2", {}, "Ressources"),
      el("p", { class: "subtitle" }, "Textes officiels, référentiels, sites pédagogiques. Curés à la main."),
    ),
    admin ? addBtn : null,
  ));

  const grouped = {};
  ressources.forEach((r) => {
    const cat = r.categorie || "Autre";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });

  const cats = CATEGORIES_ORDER.filter((c) => grouped[c]);
  Object.keys(grouped).forEach((c) => { if (!cats.includes(c)) cats.push(c); });

  cats.forEach((cat) => {
    const section = el("section", { class: "ressource-section" },
      el("h3", { class: "ressource-section-title" }, cat),
      el("div", { class: "ressource-grid" }, ...grouped[cat].map((r) => renderRessourceCard(r, () => reload(container))))
    );
    container.appendChild(section);
  });
}

async function reload(container) {
  ressources = await listRessources();
  rerender(container);
}

export async function renderRessources(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  ressources = await listRessources();
  rerender(container);
}
