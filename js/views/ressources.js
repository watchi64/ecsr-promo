import {
  listRessources, addRessource, updateRessource, deleteRessource,
  listContacts, addContact, updateContact, deleteContact,
} from "../db.js?v=20260709e";
import { el, clear, toast } from "../utils.js?v=20260709e";
import { icon } from "../icons.js?v=20260709e";
import { isAdmin } from "../auth-admin.js?v=20260709e";
import { recordUndo } from "../undo.js?v=20260709e";

let ressources = [];
let contacts = [];

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

// === Contacts (admin, urgences, etc.) ===

function openContactModal(existing, onSaved) {
  const isNew = !existing;
  const backdrop = el("div", { class: "modal-backdrop" });

  const prenomInput = el("input", { type: "text", placeholder: "Prénom (ou nom)", value: existing?.prenom || "" });
  const roleInput = el("input", { type: "text", placeholder: "Rôle / fonction (ex. Service entreprise — CP)", value: existing?.role || "" });
  const phoneInput = el("input", { type: "tel", placeholder: "04 12 34 56 78", value: existing?.phone || "" });
  const emailInput = el("input", { type: "email", placeholder: "email@ecf-sps.fr", value: existing?.email || "" });
  const noteInput = el("input", { type: "text", placeholder: "Note (ex. si X et Y indisponibles)", value: existing?.note || "" });

  async function save() {
    if (!prenomInput.value.trim()) { toast("Prénom requis", "error"); return; }
    const payload = {
      prenom: prenomInput.value.trim(),
      role: roleInput.value.trim() || null,
      phone: phoneInput.value.trim() || null,
      email: emailInput.value.trim() || null,
      note: noteInput.value.trim() || null,
      category: existing?.category || "admin",
    };
    try {
      if (isNew) {
        const inserted = await addContact(payload);
        toast("Contact ajouté · Ctrl+Z pour annuler", "success", 2400);
        if (inserted?.id) recordUndo("contact ajouté", async () => { await deleteContact(inserted.id); });
      } else {
        const prev = { ...existing };
        await updateContact(existing.id, payload);
        recordUndo("contact modifié", async () => {
          await updateContact(existing.id, {
            prenom: prev.prenom, role: prev.role, phone: prev.phone,
            email: prev.email, note: prev.note, category: prev.category,
          });
        });
        toast("Contact mis à jour", "success", 1800);
      }
      backdrop.remove();
      onSaved();
    } catch (e) { toast(e.message, "error"); }
  }

  const modal = el("div", { class: "modal" },
    el("h3", {}, isNew ? "Nouveau contact" : "Modifier le contact"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Prénom"), prenomInput),
      el("div", { class: "field" }, el("label", {}, "Rôle"), roleInput),
      el("div", { class: "field-pair" },
        el("div", { class: "field" }, el("label", {}, "Téléphone"), phoneInput),
        el("div", { class: "field" }, el("label", {}, "Email"), emailInput),
      ),
      el("div", { class: "field" }, el("label", {}, "Note"), noteInput),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler"),
      el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  setTimeout(() => prenomInput.focus(), 80);
}

function renderContactCard(c, onChanged) {
  const admin = isAdmin();
  const card = el("article", { class: "contact-card contact-cat-" + (c.category || "admin") });

  const head = el("div", { class: "contact-head" },
    el("h4", { class: "contact-name" }, c.prenom),
    c.role ? el("p", { class: "contact-role muted" }, c.role) : null,
  );
  card.appendChild(head);

  const links = el("div", { class: "contact-links" });
  if (c.phone) {
    const tel = c.phone.replace(/\s+/g, "");
    links.appendChild(el("a", { class: "contact-link phone", href: "tel:" + tel },
      el("span", { class: "contact-link-icon" }, "📞"),
      el("span", {}, c.phone),
    ));
  }
  if (c.email) {
    links.appendChild(el("a", { class: "contact-link email", href: "mailto:" + c.email },
      el("span", { class: "contact-link-icon" }, "✉️"),
      el("span", {}, c.email),
    ));
  }
  if (links.childElementCount) card.appendChild(links);

  if (c.note) card.appendChild(el("p", { class: "contact-note" }, c.note));

  if (admin) {
    const actions = el("div", { class: "contact-actions" });
    const editBtn = el("button", {
      class: "btn small ghost icon-only", "aria-label": "Modifier",
      onClick: () => openContactModal(c, onChanged),
    });
    editBtn.appendChild(icon.settings());
    const delBtn = el("button", {
      class: "btn small danger icon-only", "aria-label": "Supprimer",
      onClick: async () => {
        if (!confirm(`Supprimer le contact ${c.prenom} ?`)) return;
        const snapshot = { ...c };
        delete snapshot.id; delete snapshot.created_at; delete snapshot.updated_at;
        await deleteContact(c.id);
        toast("Supprimé · Ctrl+Z pour annuler", "success", 2400);
        recordUndo("contact supprimé", async () => { await addContact(snapshot); });
        onChanged();
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

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, ressources.length + " liens curés · " + contacts.length + " contacts"),
      el("h2", {}, "Ressources & contacts"),
      el("p", { class: "subtitle" }, "Contacts administration (absences, justificatifs) + textes officiels & sites pédagogiques."),
    ),
  ));

  // === Section Contacts ===
  const contactsSection = el("section", { class: "contacts-section" });
  contactsSection.appendChild(el("div", { class: "contacts-section-head" },
    el("h3", { class: "ressource-section-title" }, "📞 Contacts administration"),
    admin ? el("button", {
      class: "btn small accent",
      onClick: () => openContactModal(null, () => reload(container)),
    }, icon.plus(), "Ajouter un contact") : null,
  ));
  contactsSection.appendChild(el("p", { class: "muted contacts-section-sub" },
    "Numéros à appeler en cas d'absence ou de question administrative. Tape sur un numéro pour appeler directement."));

  if (contacts.length === 0) {
    contactsSection.appendChild(el("p", { class: "muted", style: "padding:1rem;text-align:center" }, "Aucun contact enregistré."));
  } else {
    const grid = el("div", { class: "contacts-grid" });
    contacts.forEach((c) => grid.appendChild(renderContactCard(c, () => reload(container))));
    contactsSection.appendChild(grid);
  }
  container.appendChild(contactsSection);

  const grouped = {};
  ressources.forEach((r) => {
    const cat = r.categorie || "Autre";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });

  const cats = CATEGORIES_ORDER.filter((c) => grouped[c]);
  Object.keys(grouped).forEach((c) => { if (!cats.includes(c)) cats.push(c); });

  // En-tête de la zone ressources (avec bouton "Ajouter" à droite, admin only)
  container.appendChild(el("div", { class: "contacts-section-head", style: "margin-top:1.5rem" },
    el("h3", { class: "ressource-section-title", style: "margin:0" }, "📚 Ressources externes"),
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
  [ressources, contacts] = await Promise.all([listRessources(), listContacts()]);
  rerender(container);
}

export async function renderRessources(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  [ressources, contacts] = await Promise.all([listRessources(), listContacts()]);
  rerender(container);
}
