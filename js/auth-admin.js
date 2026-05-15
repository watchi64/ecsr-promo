/**
 * Couche d'authentification admin (au-dessus du gate mot de passe partagé).
 *
 * Modèle :
 *  - Tier 1 — gate mot de passe : tout le monde (lecture)
 *  - Tier 2 — Supabase Auth (magic link) : profs/admins (édition des notes & ressources)
 *
 * Le module garde une référence à l'utilisateur courant et expose
 * isAdmin() + getAdminEmail() utilisés par les vues.
 */

import { getCurrentUser, signInWithMagicLink, signOut, onAuthChange } from "./db.js";
import { el, toast } from "./utils.js";
import { icon } from "./icons.js";

let currentUser = null;
const listeners = new Set();

export function isAdmin() { return !!currentUser; }
export function getAdminEmail() { return currentUser?.email || null; }

export async function initAuth() {
  currentUser = await getCurrentUser();
  onAuthChange((user) => {
    currentUser = user;
    listeners.forEach((cb) => cb(user));
    updateAdminBadge();
  });
  updateAdminBadge();
}

export function onAdminChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// === UI : badge dans la topbar + modal de connexion ===

function updateAdminBadge() {
  const slot = document.getElementById("admin-slot");
  if (!slot) return;
  slot.innerHTML = "";

  if (currentUser) {
    const badge = el("button", { class: "admin-badge", onClick: openAdminMenu },
      el("span", { class: "admin-dot" }),
      el("span", { class: "admin-email" }, currentUser.email),
    );
    slot.appendChild(badge);
  } else {
    const btn = el("button", { class: "admin-login-btn", onClick: openLoginModal });
    btn.appendChild(icon.settings());
    btn.appendChild(document.createTextNode("Mode admin"));
    slot.appendChild(btn);
  }
}

function openLoginModal() {
  const backdrop = el("div", { class: "modal-backdrop" });

  const emailInput = el("input", { type: "email", placeholder: "votre.email@exemple.fr", required: true });
  const info = el("p", { class: "muted", style: "font-size:0.88rem;margin:0 0 1rem" },
    "Recevez un lien magique pour vous connecter. Sans mot de passe à retenir."
  );

  const status = el("p", { style: "min-height:1.2em;font-size:0.88rem;margin:0.5rem 0 0" });

  async function sendLink() {
    const v = emailInput.value.trim();
    if (!v) return;
    status.textContent = "Envoi en cours…";
    status.className = "muted";
    try {
      await signInWithMagicLink(v);
      status.innerHTML = "Lien envoyé à <strong>" + v + "</strong>. Vérifiez votre boîte (et les spams).";
      status.className = "";
      status.style.color = "var(--accent)";
    } catch (e) {
      console.error(e);
      status.textContent = "Erreur : " + e.message;
      status.style.color = "var(--c-stop)";
    }
  }

  const cancelBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer");
  const sendBtn = el("button", { class: "btn primary", onClick: sendLink }, icon.check(), "Envoyer le lien");
  emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendBtn.click(); });

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Connexion admin"),
    info,
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Adresse email"), emailInput),
    ),
    status,
    el("div", { class: "modal-actions" }, cancelBtn, sendBtn)
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  setTimeout(() => emailInput.focus(), 100);
}

function openAdminMenu() {
  const backdrop = el("div", { class: "modal-backdrop" });

  const logoutBtn = el("button", { class: "btn danger full", onClick: async () => {
    await signOut();
    backdrop.remove();
    toast("Déconnecté", "success");
  }}, "Se déconnecter");

  const closeBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer");

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Mode admin"),
    el("p", { class: "muted", style: "margin:0 0 1rem;font-size:0.9rem" }, "Connecté en tant que ", el("strong", {}, currentUser.email)),
    el("p", { class: "muted", style: "margin:0 0 1.2rem;font-size:0.85rem" },
      "Vous pouvez ajouter, modifier et supprimer les notes & ressources. Toutes les modifications sont tracées dans l'historique."
    ),
    logoutBtn,
    el("div", { class: "modal-actions" }, closeBtn)
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}
