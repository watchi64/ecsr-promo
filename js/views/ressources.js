import {
  listRessources, addRessource, updateRessource, deleteRessource,
  getPromoCourante,
} from "../db.js?v=20261128a";
import { el, clear, toast } from "../utils.js?v=20261128a";
import { confirmer } from "../confirmer.js?v=20261128a";
import { icon } from "../icons.js?v=20261128a";
import { ecritSelonLaCase } from "../auth-admin.js?v=20261128a";
import { ouvrirModale } from "../nav-fenetre.js?v=20261128a";

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
  let modale = null;   // la fenêtre, une fois ouverte (ouvrirModale, js/nav-fenetre.js)

  const titreInput = el("input", { type: "text", placeholder: "Titre", value: existing?.titre || "" });
  const urlInput = el("input", { type: "url", placeholder: "https://…", value: existing?.url || "" });
  const descInput = el("input", { type: "text", placeholder: "Description courte", value: existing?.description || "" });

  const catSel = el("select");
  CATEGORIES_ORDER.forEach((c) => {
    const opt = el("option", { value: c }, c);
    if ((existing?.categorie || "Autre") === c) opt.selected = true;
    catSel.appendChild(opt);
  });

  const badgeInput = el("input", { type: "text", placeholder: "Étiquette (Officiel, PDF…)", value: existing?.badge || "" });

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
      modale.fermer();
      onSaved();
    } catch (e) {
      console.error(e);
      toast(e.message, "error");
    }
  }

  const cancelBtn = el("button", { class: "btn ghost", onClick: () => modale.fermer() }, "Annuler");
  const saveBtn = el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer");

  const modal = el("div", { class: "modal" },
    el("h3", {}, isNew ? "Ajouter une ressource" : "Modifier la ressource"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Titre"), titreInput),
      el("div", { class: "field" }, el("label", {}, "URL"), urlInput),
      el("div", { class: "field" }, el("label", {}, "Description"), descInput),
      el("div", { class: "field" }, el("label", {}, "Catégorie"), catSel),
      el("div", { class: "field" }, el("label", {}, "Étiquette (facultatif)"), badgeInput),
    ),
    el("div", { class: "modal-actions" }, cancelBtn, saveBtn)
  );
  modale = ouvrirModale(modal);
}

function renderRessourceCard(r, onChange) {
  const admin = ecritSelonLaCase("cours");
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
        if (!(await confirmer({ titre: `Supprimer « ${r.titre} » ?`, oui: "Supprimer" }))) return;
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

  const admin = ecritSelonLaCase("cours");

  // La page est Cours et QCM, Documents ; elle porte ce nom, avec la promo en surtitre. Le nombre de liens termine le sous-titre
  // (les contacts du centre ont leur page, js/views/contacts.js).
  const surtitre = getPromoCourante()?.nom;
  const compte = `${ressources.length} lien${ressources.length > 1 ? "s" : ""}`;
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      surtitre ? el("p", { class: "eyebrow" }, surtitre) : null,
      el("h2", {}, "Documents"),
      el("p", { class: "subtitle" }, `Textes officiels et sites pédagogiques. ${compte}.`),
    ),
  ));

  const grouped = {};
  ressources.forEach((r) => {
    const cat = r.categorie || "Autre";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });

  const cats = CATEGORIES_ORDER.filter((c) => grouped[c]);
  Object.keys(grouped).forEach((c) => { if (!cats.includes(c)) cats.push(c); });

  // En-tête de la zone ressources (avec bouton "Ajouter" à droite, admin only)
  container.appendChild(el("div", { class: "contacts-section-head" },
    el("h3", { class: "ressource-section-title", style: "margin:0" }, "Ressources externes"),
    admin ? el("button", {
      class: "btn small accent",
      onClick: () => openEditModal(null, () => reload(container)),
    }, icon.plus(), "Ajouter une ressource") : null,
  ));
  container.appendChild(el("p", { class: "muted contacts-section-sub", style: "margin-bottom:1rem" },
    "Liens vers les textes officiels, référentiels, sites pédagogiques."));

  if (cats.length === 0) {
    container.appendChild(el("p", { class: "muted", style: "padding:1rem;text-align:center" }, "Aucune ressource pour l'instant."));
  } else {
    cats.forEach((cat) => {
      const section = el("section", { class: "ressource-section" },
        el("h4", { class: "ressource-section-title", style: "font-size:0.85rem;margin-top:1.4rem" }, cat),
        el("div", { class: "ressource-grid" }, ...grouped[cat].map((r) => renderRessourceCard(r, () => reload(container))))
      );
      container.appendChild(section);
    });
  }
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
