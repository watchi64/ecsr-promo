/*
 * Vue ParamÃ¨tres.
 * 3 sections : AccÃ¨s & invitations Â· Promo Â· Infos.
 */
import {
  listStagiaires, listProfs,
  addStagiaire, updateStagiaire, deleteStagiaire, setStagiaireActif,
  addProf, updateProf, deleteProf,
  listUserProfiles, deleteUserProfile, inviteUser,
  setMyAnonymousNotes,
} from "../db.js?v=20260703b";
import { el, clear, toast, displayStagiaire } from "../utils.js?v=20260703b";
import { icon } from "../icons.js?v=20260703b";
import { isAdmin, getAdminEmail, getProfile } from "../auth-admin.js?v=20260703b";

// ====== SECTION AccÃ¨s & invitations ======

async function renderAccessSection(rerender) {
  const admin = isAdmin();
  const currentEmail = getAdminEmail();
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.shield()),
    el("div", {},
      el("h3", {}, "AccÃ¨s & invitations"),
      el("p", { class: "muted" }, "Personnes invitÃ©es Ã  utiliser l'app (stagiaires, profs, admins)."),
    ),
  ));

  const [profiles, stagiaires, profs] = await Promise.all([
    listUserProfiles(), listStagiaires(), listProfs(),
  ]);

  // === Form d'invitation (admin only) ===
  if (admin) {
    const inviteBlock = el("div", { class: "param-block" });
    inviteBlock.appendChild(el("h4", {}, "Autoriser une personne"));
    inviteBlock.appendChild(el("p", { class: "muted" },
      "Choisis le rÃ´le et la personne, entre son email. Aucun mail n'est envoyÃ© : tu lui partages l'URL toi-mÃªme, puis elle crÃ©e son compte avec son email + un mdp."));

    const roleSel = el("select", { class: "invite-role" });
    [
      { v: "stagiaire", l: "Stagiaire" },
      { v: "prof",      l: "Formateur" },
    ].forEach((o) => roleSel.appendChild(el("option", { value: o.v }, o.l)));

    const personSel = el("select", { class: "invite-person" });
    function refreshPersonOptions() {
      clear(personSel);
      const role = roleSel.value;
      personSel.appendChild(el("option", { value: "" }, "â€” Choisir â€”"));
      const list = role === "stagiaire" ? stagiaires : profs;
      const taken = new Set(profiles
        .filter((p) => role === "stagiaire" ? p.stagiaire_id : p.prof_id)
        .map((p) => role === "stagiaire" ? p.stagiaire_id : p.prof_id));
      list.forEach((it) => {
        const isTaken = taken.has(it.id);
        const baseLabel = it.prenom ? (it.nom ? `${it.nom} ${it.prenom}` : it.prenom) : it.nom;
        const label = baseLabel + (isTaken ? " (dÃ©jÃ  invitÃ©)" : "");
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

    const sendBtn = el("button", { class: "btn accent" }, icon.plus(), "Ajouter Ã  la whitelist");
    sendBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim().toLowerCase();
      const role = roleSel.value;
      const personId = personSel.value ? Number(personSel.value) : null;
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) { toast("Email invalide", "error"); return; }
      if (!personId) { toast("Choisis la personne Ã  lier", "error"); return; }

      const restoreBtn = () => {
        sendBtn.disabled = false;
        sendBtn.textContent = "";
        sendBtn.appendChild(icon.plus());
        sendBtn.appendChild(document.createTextNode("Ajouter Ã  la whitelist"));
      };

      sendBtn.disabled = true;
      sendBtn.textContent = "Envoiâ€¦";
      try {
        const invitePromise = inviteUser({
          email, role,
          stagiaire_id: role === "stagiaire" ? personId : null,
          prof_id:      role === "prof"      ? personId : null,
          is_admin:     adminCheck.checked,
        });
        // Timeout de 15s pour Ã©viter le hang infini
        await Promise.race([
          invitePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("DÃ©lai dÃ©passÃ© (15s). RÃ©seau lent ou rate-limit Supabase atteint (4 mails/h sur le SMTP par dÃ©faut).")), 15000)),
        ]);
        toast("AjoutÃ© Ã  la whitelist : " + email + ". Partage-lui l'URL.", "success", 4500);
        emailInput.value = "";
        adminCheck.checked = false;
        rerender();
      } catch (e) {
        toast("Erreur : " + e.message, "error", 6000);
      } finally {
        restoreBtn();
      }
    });

    function restoreBtnInitial() {
      sendBtn.disabled = false;
      sendBtn.textContent = "";
      sendBtn.appendChild(icon.plus());
      sendBtn.appendChild(document.createTextNode("Ajouter Ã  la whitelist"));
    }
    // SÃ©curise l'Ã©tat initial du label
    setTimeout(restoreBtnInitial, 0);
    emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendBtn.click(); });

    inviteBlock.appendChild(el("div", { class: "invite-form" },
      el("div", { class: "invite-row" },
        el("label", {}, "RÃ´le"), roleSel,
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

  // === Liste des invitÃ©s ===
  const listBlock = el("div", { class: "param-block" });
  listBlock.appendChild(el("h4", {}, `Personnes avec accÃ¨s (${profiles.length})`));
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
          if (s) who = displayStagiaire(s);
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
            class: "btn small danger icon-only", "aria-label": "Retirer l'accÃ¨s",
            onClick: async () => {
              if (!confirm(`Retirer l'accÃ¨s de ${p.email} ?`)) return;
              try {
                await deleteUserProfile(p.email);
                toast("AccÃ¨s retirÃ©", "success");
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

// ====== SECTION Mes prÃ©fÃ©rences ======

function renderMyPreferencesSection(rerender) {
  const profile = getProfile();
  if (!profile) return null;  // pas affichÃ©e si pas de profil

  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.user ? icon.user() : icon.users()),
    el("div", {},
      el("h3", {}, "Mes prÃ©fÃ©rences"),
      el("p", { class: "muted" }, "RÃ©glages personnels visibles uniquement par toi."),
    ),
  ));

  const block = el("div", { class: "param-block" });
  block.appendChild(el("h4", {}, "Anonymat dans le tableau de notes"));
  block.appendChild(el("p", { class: "muted" },
    "Si activÃ©, ton prÃ©nom est remplacÃ© par Â« Anonyme Â» dans le tableau et les graphiques de la page Notes, et tu es placÃ©(e) en fin de liste. Les admins continuent de voir ton vrai prÃ©nom (besoin d'Ã©valuation)."));

  const checkbox = el("input", { type: "checkbox", id: "pref-anon" });
  if (profile.anonymous_notes) checkbox.checked = true;

  const label = el("label", { for: "pref-anon", class: "invite-admin-toggle" },
    checkbox,
    " Masquer mon prÃ©nom dans les notes",
  );

  checkbox.addEventListener("change", async () => {
    const wanted = checkbox.checked;
    checkbox.disabled = true;
    try {
      await setMyAnonymousNotes(wanted);
      profile.anonymous_notes = wanted;
      toast(wanted ? "Tu apparais maintenant en Anonyme." : "Ton prÃ©nom est Ã  nouveau visible.", "success");
    } catch (e) {
      toast("Erreur : " + e.message, "error");
      checkbox.checked = !wanted;
    } finally {
      checkbox.disabled = false;
    }
  });

  block.appendChild(label);
  section.appendChild(block);
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
      el("p", { class: "muted" }, admin ? "GÃ©rer la liste des stagiaires et formateurs." : "Liste des stagiaires et formateurs. Ã‰dition admin only."),
    ),
  ));

  const [allStagiaires, profs] = await Promise.all([
    listStagiaires({ includeInactive: true }), listProfs(),
  ]);
  const stagiairesActifs = allStagiaires.filter((s) => s.actif !== false);
  const stagiairesAbandon = allStagiaires.filter((s) => s.actif === false);

  function renderList(items, type) {
    const wrap = el("div", { class: "param-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, type === "stagiaire" ? "Stagiaires" : "Formateurs"),
      el("span", { class: "count" }, items.length + " entrÃ©e" + (items.length > 1 ? "s" : "")),
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
            toast("Mis Ã  jour", "success");
          } catch (e) { toast(e.message, "error"); }
        });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      }

      // Stagiaire : Â« Abandon Â» (dÃ©sactivation douce, donnÃ©es conservÃ©es).
      // Prof : suppression directe (pas de notion d'abandon).
      let actionBtn = null;
      if (admin && type === "stagiaire") {
        actionBtn = el("button", {
          class: "btn small ghost abandon-btn",
          title: "Marquer en abandon : masquÃ© partout (planning, dÃ©s, notes), donnÃ©es conservÃ©es",
          onClick: async () => {
            if (!confirm(`Marquer ${it.prenom} en abandon ?\n\nIl/elle disparaÃ®t du planning, des dÃ©s et des notes. Les donnÃ©es restent conservÃ©es et rÃ©activables.`)) return;
            try {
              await setStagiaireActif(it.id, false);
              toast(`${it.prenom} marquÃ©(e) en abandon`, "success");
              rerender();
            } catch (e) { toast(e.message, "error"); }
          }
        }, "Abandon");
      } else if (admin) {
        actionBtn = el("button", {
          class: "btn small danger icon-only", "aria-label": "Supprimer",
          onClick: async () => {
            if (!confirm(`Supprimer ${it.nom} ?`)) return;
            try {
              await deleteProf(it.id);
              toast("SupprimÃ©", "success");
              rerender();
            } catch (e) { toast(e.message, "error"); }
          }
        }, icon.trash());
      }

      list.appendChild(el("li", {}, input, actionBtn));
    });
    wrap.appendChild(list);

    if (admin) {
      const addInput = el("input", { type: "text", placeholder: type === "stagiaire" ? "PrÃ©nom" : "Nom" });
      const addBtn = el("button", { class: "btn accent", onClick: async () => {
        const v = addInput.value.trim();
        if (!v) return;
        try {
          if (type === "stagiaire") await addStagiaire(v);
          else await addProf(v);
          addInput.value = "";
          toast("AjoutÃ©", "success");
          rerender();
        } catch (e) { toast(e.message, "error"); }
      }}, icon.plus(), "Ajouter");
      addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
      wrap.appendChild(el("div", { class: "config-add" }, addInput, addBtn));
    }
    return wrap;
  }

  // Bloc des abandons : rÃ©activation, ou suppression dÃ©finitive (rÃ©servÃ©e ici pour
  // Ã©viter toute perte de donnÃ©es accidentelle depuis la liste active).
  function renderAbandons(items) {
    const wrap = el("div", { class: "param-block abandons-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, "Abandons"),
      el("span", { class: "count" }, items.length + " stagiaire" + (items.length > 1 ? "s" : "")),
    ));
    wrap.appendChild(el("p", { class: "muted abandons-hint" },
      "MasquÃ©s du planning, des dÃ©s et des notes. DonnÃ©es conservÃ©es pour d'Ã©ventuelles statistiques."));
    const list = el("ul", { class: "config-list" });
    items.forEach((it) => {
      const reactiverBtn = el("button", {
        class: "btn small accent",
        onClick: async () => {
          try {
            await setStagiaireActif(it.id, true);
            toast(`${it.prenom} rÃ©activÃ©(e)`, "success");
            rerender();
          } catch (e) { toast(e.message, "error"); }
        }
      }, "RÃ©activer");
      const delBtn = el("button", {
        class: "btn small danger icon-only",
        "aria-label": "Supprimer dÃ©finitivement",
        title: "Supprimer dÃ©finitivement (irrÃ©versible, efface les donnÃ©es)",
        onClick: async () => {
          if (!confirm(`Supprimer DÃ‰FINITIVEMENT ${it.prenom} ?\n\nIrrÃ©versible : efface ses donnÃ©es. Pour seulement le masquer, garde-le en abandon.`)) return;
          try {
            await deleteStagiaire(it.id);
            toast("SupprimÃ© dÃ©finitivement", "success");
            rerender();
          } catch (e) { toast(e.message, "error"); }
        }
      }, icon.trash());
      list.appendChild(el("li", { class: "abandon-row" },
        el("span", { class: "abandon-name" }, it.prenom),
        reactiverBtn, delBtn,
      ));
    });
    wrap.appendChild(list);
    return wrap;
  }

  section.appendChild(renderList(stagiairesActifs, "stagiaire"));
  if (admin && stagiairesAbandon.length) section.appendChild(renderAbandons(stagiairesAbandon));
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
      el("p", { class: "muted" }, "Ã€ propos de TP ECSR App."),
    ),
  ));

  section.appendChild(el("div", { class: "param-block" },
    el("dl", { class: "info-list" },
      el("dt", {}, "Application"),
      el("dd", {}, "TP ECSR App"),
      el("dt", {}, "Auteur"),
      el("dd", {}, "watchi64 Â· misterwatchi@gmail.com"),
      el("dt", {}, "Licence"),
      el("dd", {}, "PropriÃ©taire. Voir LICENSE dans le repo."),
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
      Promise.resolve(renderMyPreferencesSection(() => rerender(container))),
      renderPromoSection(() => rerender(container)),
      Promise.resolve(renderInfoSection()),
    ]), 12000, "ParamÃ¨tres");

    clear(container);
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        el("p", { class: "eyebrow" }, "SystÃ¨me"),
        el("h2", {}, "ParamÃ¨tres"),
        el("p", { class: "subtitle" }, "AccÃ¨s, gestion de la promo, infos. Connecte-toi en admin pour inviter ou modifier."),
      ),
    ));

    const grid = el("div", { class: "param-grid" });
    sections.filter(Boolean).forEach((s) => grid.appendChild(s));
    container.appendChild(grid);
  } catch (e) {
    console.error("ParamÃ¨tres : erreur de chargement", e);
    clear(container);
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        el("h2", {}, "ParamÃ¨tres"),
      ),
    ));
    container.appendChild(el("div", { class: "param-error" },
      el("p", {}, "Le chargement a Ã©chouÃ©. " + (e.message || "")),
      el("button", {
        class: "btn primary",
        onClick: () => rerender(container),
      }, "RÃ©essayer"),
    ));
  }
}

export async function renderConfig(container) {
  await rerender(container);
}
