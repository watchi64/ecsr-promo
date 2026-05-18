/*
 * Vue Paramètres.
 * 3 sections : Accès & invitations · Promo · Infos.
 */
import {
  listStagiaires, listProfs,
  addStagiaire, updateStagiaire, deleteStagiaire,
  addProf, updateProf, deleteProf,
  listUserProfiles, deleteUserProfile, inviteUser,
} from "../db.js";
import { el, clear, toast } from "../utils.js";
import { icon } from "../icons.js";
import { isAdmin, getAdminEmail } from "../auth-admin.js";

// ====== SECTION Accès & invitations ======

async function renderAccessSection(rerender) {
  const admin = isAdmin();
  const currentEmail = getAdminEmail();
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.shield()),
    el("div", {},
      el("h3", {}, "Accès & invitations"),
      el("p", { class: "muted" }, "Personnes invitées à utiliser l'app (stagiaires, profs, admins)."),
    ),
  ));

  const [profiles, stagiaires, profs] = await Promise.all([
    listUserProfiles(), listStagiaires(), listProfs(),
  ]);

  // === Form d'invitation (admin only) ===
  if (admin) {
    const inviteBlock = el("div", { class: "param-block" });
    inviteBlock.appendChild(el("h4", {}, "Inviter une personne"));
    inviteBlock.appendChild(el("p", { class: "muted" },
      "Choisis le rôle et la personne, puis entre son email. Elle recevra un lien magique pour se connecter."));

    const roleSel = el("select", { class: "invite-role" });
    [
      { v: "stagiaire", l: "Stagiaire" },
      { v: "prof",      l: "Formateur (prof)" },
      { v: "admin",     l: "Admin" },
    ].forEach((o) => roleSel.appendChild(el("option", { value: o.v }, o.l)));

    const personSel = el("select", { class: "invite-person" });
    function refreshPersonOptions() {
      clear(personSel);
      const role = roleSel.value;
      if (role === "admin") {
        personSel.appendChild(el("option", { value: "" }, "— (pas de personne liée)"));
        personSel.disabled = true;
        return;
      }
      personSel.disabled = false;
      personSel.appendChild(el("option", { value: "" }, "— Choisir —"));
      const list = role === "stagiaire" ? stagiaires : profs;
      const taken = new Set(profiles
        .filter((p) => role === "stagiaire" ? p.stagiaire_id : p.prof_id)
        .map((p) => role === "stagiaire" ? p.stagiaire_id : p.prof_id));
      list.forEach((it) => {
        const isTaken = taken.has(it.id);
        const label = (it.prenom || it.nom) + (isTaken ? " (déjà invité)" : "");
        const opt = el("option", { value: String(it.id) }, label);
        if (isTaken) opt.disabled = true;
        personSel.appendChild(opt);
      });
    }
    roleSel.addEventListener("change", refreshPersonOptions);
    refreshPersonOptions();

    const emailInput = el("input", { type: "email", placeholder: "email@exemple.fr", class: "invite-email" });

    const adminCheck = el("input", { type: "checkbox", id: "invite-also-admin" });
    const adminLabel = el("label", {
      for: "invite-also-admin", class: "invite-admin-toggle",
    }, adminCheck, " Aussi administrateur");
    function updateAdminToggleVisibility() {
      adminLabel.style.display = roleSel.value === "admin" ? "none" : "";
      if (roleSel.value === "admin") adminCheck.checked = false;
    }
    roleSel.addEventListener("change", updateAdminToggleVisibility);
    updateAdminToggleVisibility();

    const sendBtn = el("button", { class: "btn accent" }, icon.mail(), "Envoyer l'invitation");
    sendBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim().toLowerCase();
      const role = roleSel.value;
      const personId = personSel.value ? Number(personSel.value) : null;
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) { toast("Email invalide", "error"); return; }
      if (role !== "admin" && !personId) { toast("Choisis la personne à lier", "error"); return; }

      const restoreBtn = () => {
        sendBtn.disabled = false;
        sendBtn.textContent = "";
        sendBtn.appendChild(icon.mail());
        sendBtn.appendChild(document.createTextNode("Envoyer l'invitation"));
      };

      sendBtn.disabled = true;
      sendBtn.textContent = "Envoi…";
      try {
        const invitePromise = inviteUser({
          email, role,
          stagiaire_id: role === "stagiaire" ? personId : null,
          prof_id:      role === "prof"      ? personId : null,
          is_admin:     role === "admin" ? true : adminCheck.checked,
        });
        // Timeout de 15s pour éviter le hang infini
        await Promise.race([
          invitePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Délai dépassé (15s). Réseau lent ou rate-limit Supabase atteint (4 mails/h sur le SMTP par défaut).")), 15000)),
        ]);
        toast("Invitation envoyée à " + email, "success", 3500);
        emailInput.value = "";
        adminCheck.checked = false;
        rerender();
      } catch (e) {
        toast("Erreur : " + e.message, "error", 6000);
      } finally {
        restoreBtn();
      }
    });
    emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendBtn.click(); });

    inviteBlock.appendChild(el("div", { class: "invite-form" },
      el("div", { class: "invite-row" },
        el("label", {}, "Rôle"), roleSel,
        el("label", {}, "Personne"), personSel,
      ),
      el("div", { class: "invite-row" },
        el("label", {}, "Email"), emailInput,
        sendBtn,
      ),
      adminLabel,
    ));
    section.appendChild(inviteBlock);
  }

  // === Liste des invités ===
  const listBlock = el("div", { class: "param-block" });
  listBlock.appendChild(el("h4", {}, `Personnes avec accès (${profiles.length})`));
  if (profiles.length === 0) {
    listBlock.appendChild(el("p", { class: "muted" }, "Personne pour l'instant. Invite quelqu'un ci-dessus."));
  } else {
    const list = el("ul", { class: "admin-list" });
    profiles
      .slice()
      .sort((a, b) => (a.role || "").localeCompare(b.role) || a.email.localeCompare(b.email))
      .forEach((p) => {
        let who = "";
        if (p.stagiaire_id) {
          const s = stagiaires.find((x) => x.id === p.stagiaire_id);
          if (s) who = s.prenom;
        } else if (p.prof_id) {
          const pr = profs.find((x) => x.id === p.prof_id);
          if (pr) who = pr.nom;
        }
        const pills = el("div", { class: "role-pills" },
          el("span", { class: "role-pill role-" + p.role }, p.role),
          (p.is_admin && p.role !== "admin") ? el("span", { class: "role-pill role-admin" }, "admin") : null,
        );
        const item = el("li", { class: "admin-item" },
          pills,
          el("span", { class: "admin-email-text" }, p.email),
          who ? el("span", { class: "admin-you" }, who) : null,
          p.email === currentEmail ? el("span", { class: "admin-you" }, "vous") : null,
          (admin && p.email !== currentEmail) ? el("button", {
            class: "btn small danger icon-only", "aria-label": "Retirer l'accès",
            onClick: async () => {
              if (!confirm(`Retirer l'accès de ${p.email} ?`)) return;
              try {
                await deleteUserProfile(p.email);
                toast("Accès retiré", "success");
                rerender();
              } catch (e) { toast(e.message, "error"); }
            }
          }, icon.trash()) : null,
        );
        list.appendChild(item);
      });
    listBlock.appendChild(list);
  }
  section.appendChild(listBlock);

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

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout : ${label} (${ms / 1000}s)`)), ms)),
  ]);
}

async function rerender(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  try {
    const sections = await withTimeout(Promise.all([
      renderAccessSection(() => rerender(container)),
      renderPromoSection(() => rerender(container)),
      Promise.resolve(renderInfoSection()),
    ]), 12000, "Paramètres");

    clear(container);
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        el("p", { class: "eyebrow" }, "Système"),
        el("h2", {}, "Paramètres"),
        el("p", { class: "subtitle" }, "Accès, gestion de la promo, infos. Connecte-toi en admin pour inviter ou modifier."),
      ),
    ));

    const grid = el("div", { class: "param-grid" });
    sections.forEach((s) => grid.appendChild(s));
    container.appendChild(grid);
  } catch (e) {
    console.error("Paramètres : erreur de chargement", e);
    clear(container);
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        el("h2", {}, "Paramètres"),
      ),
    ));
    container.appendChild(el("div", { class: "param-error" },
      el("p", {}, "Le chargement a échoué. " + (e.message || "")),
      el("button", {
        class: "btn primary",
        onClick: () => rerender(container),
      }, "Réessayer"),
    ));
  }
}

export async function renderConfig(container) {
  await rerender(container);
}
