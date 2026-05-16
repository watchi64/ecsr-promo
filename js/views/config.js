/*
 * Vue Paramètres (anciennement Config).
 * 4 sections : Sécurité (mot de passe + admins) · Apparence · Promo · Infos.
 */
import {
  listStagiaires, listProfs,
  addStagiaire, updateStagiaire, deleteStagiaire,
  addProf, updateProf, deleteProf,
  getSetting, setSetting,
} from "../db.js";
import { el, clear, toast, sha256 } from "../utils.js";
import { icon } from "../icons.js";
import { isAdmin, getAdminEmail, refreshAllowedEmails, getAllowedEmails } from "../auth-admin.js";
import { setAccent, getAccent } from "../accent-switcher.js";
import { setTheme, getTheme, THEMES } from "../theme-switcher.js";
import { getStoredWho } from "../identity.js";

const ACCENTS = [
  { key: "brique",     label: "Brique",     hex: "#B91C1C", note: "racing vintage" },
  { key: "ferrari",    label: "Ferrari",    hex: "#DC2626", note: "vif" },
  { key: "oxblood",    label: "Oxblood",    hex: "#7F1D1D", note: "luxe, cuir" },
  { key: "terracotta", label: "Terracotta", hex: "#C2410C", note: "argile chaude" },
];

// ====== SECTION Sécurité ======

async function renderSecuritySection(rerender) {
  const admin = isAdmin();
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.shield()),
    el("div", {},
      el("h3", {}, "Sécurité"),
      el("p", { class: "muted" }, "Mot de passe partagé et liste des admins autorisés."),
    ),
  ));

  // Mot de passe partagé — admin only
  if (admin) {
    const oldInput = el("input", { type: "password", placeholder: "Actuel" });
    const newInput = el("input", { type: "password", placeholder: "Nouveau (min. 4 caractères)" });
    const confirmInput = el("input", { type: "password", placeholder: "Confirmer" });

    const passBtn = el("button", { class: "btn primary", onClick: async () => {
      const currentHash = await getSetting("password_hash");
      if (currentHash) {
        const oldHash = await sha256(oldInput.value);
        if (oldHash !== currentHash) { toast("Mot de passe actuel incorrect", "error"); return; }
      }
      if (!newInput.value || newInput.value.length < 4) { toast("Min. 4 caractères", "error"); return; }
      if (newInput.value !== confirmInput.value) { toast("Les mots de passe ne correspondent pas", "error"); return; }
      const newHash = await sha256(newInput.value);
      await setSetting("password_hash", newHash);
      localStorage.setItem("ecsr_auth", newHash);
      toast("Mot de passe mis à jour", "success");
      oldInput.value = newInput.value = confirmInput.value = "";
    }}, icon.check(), "Mettre à jour");

    section.appendChild(el("div", { class: "param-block" },
      el("h4", {}, "Mot de passe partagé"),
      el("p", { class: "muted" }, "Permet à toute la promo d'entrer dans l'app."),
      el("div", { class: "modal-form" },
        el("div", { class: "field" }, el("label", {}, "Mot de passe actuel"), oldInput),
        el("div", { class: "field" }, el("label", {}, "Nouveau"), newInput),
        el("div", { class: "field" }, el("label", {}, "Confirmer"), confirmInput),
        el("div", { style: "margin-top:0.3rem" }, passBtn),
      ),
    ));
  } else {
    section.appendChild(el("div", { class: "param-block param-locked" },
      el("h4", {}, "Mot de passe partagé"),
      el("p", { class: "muted" }, "🔒 Seul un admin peut le modifier."),
    ));
  }

  // Identité (mon prénom) — affichage seul, pas modifiable
  const who = getStoredWho();
  const identitySection = el("div", { class: "param-block" },
    el("h4", {}, "Mon identité"),
    el("p", { class: "muted" }, "Le nom utilisé pour signer tes ajouts de passages. Choisi lors du premier accès, il ne peut pas être modifié ensuite."),
    el("div", { style: "display:flex;align-items:center;gap:0.7rem;" },
      el("span", { class: "param-identity-chip" }, who || "Anonyme"),
    ),
  );
  section.appendChild(identitySection);

  // === Admins autorisés ===
  const admins = await getAllowedEmails();
  const currentEmail = getAdminEmail();
  const adminBlock = el("div", { class: "param-block" });
  adminBlock.appendChild(el("h4", {}, "Admins autorisés"));
  adminBlock.appendChild(el("p", { class: "muted" },
    admins.length === 0
      ? "⚠️ Liste vide → mode ouvert. N'importe qui peut se connecter en admin. Ajoute des emails pour restreindre."
      : "Seuls ces emails peuvent se connecter en admin (magic link)."
  ));

  if (admins.length === 0 && isAdmin()) {
    const lockBtn = el("button", { class: "btn primary", onClick: async () => {
      await setSetting("admin_emails", JSON.stringify([currentEmail]));
      await refreshAllowedEmails();
      toast("Liste fermée à ton email seul", "success");
      rerender();
    }}, icon.lock(), "Fermer aux admins listés (commencer avec mon email)");
    adminBlock.appendChild(lockBtn);
  }

  const list = el("ul", { class: "admin-list" });
  admins.forEach((email) => {
    const item = el("li", { class: "admin-item" },
      icon.mail(),
      el("span", { class: "admin-email-text" }, email),
      email === currentEmail ? el("span", { class: "admin-you" }, "vous") : null,
      isAdmin() ? el("button", {
        class: "btn small danger icon-only",
        "aria-label": "Retirer",
        onClick: async () => {
          if (admins.length === 1 && email === currentEmail) {
            if (!confirm("Tu es le dernier admin. Te retirer = mode ouvert (n'importe qui pourra se connecter). Continuer ?")) return;
          } else if (!confirm(`Retirer ${email} de la liste des admins ?`)) return;
          const next = admins.filter((e) => e !== email);
          await setSetting("admin_emails", JSON.stringify(next));
          await refreshAllowedEmails();
          toast("Email retiré", "success");
          rerender();
        }
      }, icon.trash()) : null,
    );
    list.appendChild(item);
  });
  adminBlock.appendChild(list);

  if (isAdmin()) {
    const newEmailInput = el("input", { type: "email", placeholder: "email@exemple.fr" });
    const addBtn = el("button", { class: "btn accent", onClick: async () => {
      const v = newEmailInput.value.trim().toLowerCase();
      if (!v || !v.includes("@")) { toast("Email invalide", "error"); return; }
      if (admins.map((e) => e.toLowerCase()).includes(v)) { toast("Email déjà dans la liste", "error"); return; }
      await setSetting("admin_emails", JSON.stringify([...admins, v]));
      await refreshAllowedEmails();
      newEmailInput.value = "";
      toast("Email ajouté", "success");
      rerender();
    }}, icon.plus(), "Autoriser");
    newEmailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
    adminBlock.appendChild(el("div", { class: "config-add" }, newEmailInput, addBtn));
  } else {
    adminBlock.appendChild(el("p", { class: "muted", style: "font-style:italic;margin-top:0.5rem;font-size:0.85rem" },
      "Connecte-toi en mode admin pour modifier cette liste."
    ));
  }

  section.appendChild(adminBlock);
  return section;
}

// ====== SECTION Apparence ======

function renderAppearanceSection() {
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.palette()),
    el("div", {},
      el("h3", {}, "Apparence"),
      el("p", { class: "muted" }, "Thème global + couleur d'accent. Mémorisé sur ton navigateur."),
    ),
  ));

  // === THÈMES (palettes complètes) ===
  section.appendChild(el("div", { class: "param-block" },
    el("h4", {}, "Thème"),
    el("p", { class: "muted" }, "Palette complète : fond, surfaces, texte, accent. Aperçu en direct."),
  ));

  const currentTheme = getTheme();
  const themeGrid = el("div", { class: "theme-grid" });
  THEMES.forEach((t) => {
    const card = el("button", {
      class: "theme-card" + (t.key === currentTheme ? " selected" : ""),
      dataset: { key: t.key },
      onClick: () => {
        setTheme(t.key);
        themeGrid.querySelectorAll(".theme-card").forEach((n) =>
          n.classList.toggle("selected", n.dataset.key === t.key)
        );
        toast("Thème : " + t.label, "success", 1200);
      },
    },
      // Mockup de prévisualisation : 4 bandes de couleur
      el("div", { class: "theme-card-preview", style: `background: ${t.preview.bg}` },
        el("span", { class: "tp-bar tp-surface", style: `background: ${t.preview.surface}` }),
        el("span", { class: "tp-bar tp-text",    style: `background: ${t.preview.text}` }),
        el("span", { class: "tp-bar tp-accent",  style: `background: ${t.preview.accent}` }),
      ),
      el("span", { class: "theme-card-label" }, t.label),
      el("span", { class: "theme-card-note muted" }, t.note),
    );
    themeGrid.appendChild(card);
  });
  section.appendChild(themeGrid);

  // === ACCENT (couleur du rouge) ===
  section.appendChild(el("div", { class: "param-block" },
    el("h4", { style: "margin-top:1.5rem" }, "Accent"),
    el("p", { class: "muted" }, "La couleur qui s'utilise pour les CTA, statuts urgents, eyebrows."),
  ));

  const current = getAccent();
  const grid = el("div", { class: "accent-grid" });
  ACCENTS.forEach((p) => {
    const card = el("button", {
      class: "accent-card" + (p.key === current ? " selected" : ""),
      dataset: { key: p.key },
      onClick: () => {
        setAccent(p.key);
        grid.querySelectorAll(".accent-card").forEach((n) => n.classList.toggle("selected", n.dataset.key === p.key));
        toast("Accent : " + p.label, "success", 1200);
        const topSwatch = document.querySelector(".accent-trigger .accent-swatch");
        if (topSwatch) topSwatch.style.background = p.hex;
      },
    },
      el("span", { class: "accent-card-swatch", style: `background: ${p.hex}` }),
      el("span", { class: "accent-card-label" }, p.label),
      el("span", { class: "accent-card-note muted" }, p.note),
    );
    grid.appendChild(card);
  });
  section.appendChild(grid);
  return section;
}

// ====== SECTION Promo (stagiaires + profs) ======

async function renderPromoSection(rerender) {
  const admin = isAdmin();
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.users()),
    el("div", {},
      el("h3", {}, "Promo"),
      el("p", { class: "muted" }, admin ? "Gérer la liste des stagiaires et formateurs." : "Liste des stagiaires et formateurs. Édition admin only."),
    ),
  ));

  const [stagiaires, profs] = await Promise.all([listStagiaires(), listProfs()]);

  function renderList(items, type) {
    const wrap = el("div", { class: "param-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, type === "stagiaire" ? "Stagiaires" : "Formateurs"),
      el("span", { class: "count" }, items.length + " entrée" + (items.length > 1 ? "s" : "")),
    ));

    const list = el("ul", { class: "config-list" });
    items.forEach((it) => {
      const input = el("input", { type: "text", value: it.prenom || it.nom, readonly: admin ? undefined : true });
      if (admin) {
        input.addEventListener("blur", async () => {
          const v = input.value.trim();
          if (!v || v === (it.prenom || it.nom)) return;
          try {
            if (type === "stagiaire") await updateStagiaire(it.id, v);
            else await updateProf(it.id, v);
            toast("Mis à jour", "success");
          } catch (e) { toast(e.message, "error"); }
        });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      }

      const delBtn = admin ? el("button", {
        class: "btn small danger icon-only", "aria-label": "Supprimer",
        onClick: async () => {
          if (!confirm(`Supprimer ${it.prenom || it.nom} ?`)) return;
          try {
            if (type === "stagiaire") await deleteStagiaire(it.id);
            else await deleteProf(it.id);
            toast("Supprimé", "success");
            rerender();
          } catch (e) { toast(e.message, "error"); }
        }
      }, icon.trash()) : null;

      list.appendChild(el("li", {}, input, delBtn));
    });
    wrap.appendChild(list);

    if (admin) {
      const addInput = el("input", { type: "text", placeholder: type === "stagiaire" ? "Prénom" : "Nom" });
      const addBtn = el("button", { class: "btn accent", onClick: async () => {
        const v = addInput.value.trim();
        if (!v) return;
        try {
          if (type === "stagiaire") await addStagiaire(v);
          else await addProf(v);
          addInput.value = "";
          toast("Ajouté", "success");
          rerender();
        } catch (e) { toast(e.message, "error"); }
      }}, icon.plus(), "Ajouter");
      addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
      wrap.appendChild(el("div", { class: "config-add" }, addInput, addBtn));
    }
    return wrap;
  }

  section.appendChild(renderList(stagiaires, "stagiaire"));
  section.appendChild(renderList(profs, "prof"));
  return section;
}

// ====== SECTION Infos ======

function renderInfoSection() {
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.info()),
    el("div", {},
      el("h3", {}, "Informations"),
      el("p", { class: "muted" }, "À propos de l'app TP ECSR."),
    ),
  ));

  section.appendChild(el("div", { class: "param-block" },
    el("dl", { class: "info-list" },
      el("dt", {}, "Application"),
      el("dd", {}, "TP ECSR : Promo & suivi des passages"),
      el("dt", {}, "Auteur"),
      el("dd", {}, "watchi64 · misterwatchi@gmail.com"),
      el("dt", {}, "Licence"),
      el("dd", {}, "Propriétaire. Voir LICENSE dans le repo."),
      el("dt", {}, "Repo"),
      el("dd", {}, el("a", { href: "https://github.com/watchi64/ecsr-promo", target: "_blank" }, "github.com/watchi64/ecsr-promo")),
    )
  ));
  return section;
}

// ====== Render principal ======

async function rerender(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const sections = await Promise.all([
    renderSecuritySection(() => rerender(container)),
    Promise.resolve(renderAppearanceSection()),
    renderPromoSection(() => rerender(container)),
    Promise.resolve(renderInfoSection()),
  ]);

  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Système"),
      el("h2", {}, "Paramètres"),
      el("p", { class: "subtitle" }, "Sécurité, apparence, gestion de la promo, infos. Connecte-toi en mode admin pour modifier la liste."),
    ),
  ));

  const grid = el("div", { class: "param-grid" });
  sections.forEach((s) => grid.appendChild(s));
  container.appendChild(grid);
}

export async function renderConfig(container) {
  await rerender(container);
}
