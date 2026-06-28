/**
 * Auth profile-aware (post-refonte invitation).
 *
 * Modèle :
 *  - Tout le monde se connecte via magic link Supabase.
 *  - À la connexion, on lit user_profiles pour récupérer le rôle
 *    (stagiaire / prof / admin) et la personne liée (stagiaire_id ou prof_id).
 *  - isAdmin() / isProf() / isStagiaire() : checks de rôle.
 *  - getProfile() : la row complète user_profiles.
 *
 * Conservé : nom du module + signatures pour limiter la casse.
 */

import {
  getCurrentUser, signOut, onAuthChange,
  getMyProfile, listStagiaires, listProfs,
} from "./db.js?v=20260628e";
import { el, toast, displayStagiaire } from "./utils.js?v=20260628e";
import { icon } from "./icons.js?v=20260628e";

let currentUser = null;     // Supabase auth user
let currentProfile = null;  // row user_profiles
let stagiaires = null;
let profs = null;
const listeners = new Set();

// === Getters publics ===

export function isAuth()        { return !!currentUser && !!currentProfile; }
export function isAdmin()       { return !!currentProfile?.is_admin; }
export function isProf()        { return currentProfile?.role === "prof"; }
export function isStagiaire()   { return currentProfile?.role === "stagiaire"; }
export function getAdminEmail() { return currentUser?.email || null; }
export function getProfile()    { return currentProfile; }

/** Renvoie le prénom lié au profil (stagiaire ou prof), ou l'email pour admin pur. */
export function getProfileWho() {
  if (!currentProfile) return null;
  if (currentProfile.stagiaire_id && stagiaires) {
    const s = stagiaires.find((x) => x.id === currentProfile.stagiaire_id);
    if (s) return displayStagiaire(s);
  }
  if (currentProfile.prof_id && profs) {
    const p = profs.find((x) => x.id === currentProfile.prof_id);
    if (p) return p.nom;
  }
  return currentUser?.email || null;
}

// === Lifecycle ===

async function loadDirectories() {
  try {
    [stagiaires, profs] = await Promise.all([listStagiaires(), listProfs()]);
  } catch (e) {
    console.error("loadDirectories failed", e);
    stagiaires = stagiaires || [];
    profs = profs || [];
  }
}

async function refreshProfile() {
  try {
    currentProfile = await getMyProfile();
  } catch (e) {
    console.error("refreshProfile failed", e);
    currentProfile = null;
  }
}

export async function initAuth() {
  currentUser = await getCurrentUser();
  if (currentUser) {
    // Les annuaires ne sont lisibles qu'authentifié (RLS) → charger après l'auth.
    await loadDirectories();
    await refreshProfile();
    if (!currentProfile) {
      // Connecté mais pas dans user_profiles → kick out
      await signOut();
      currentUser = null;
      toast("Ton compte n'est plus autorisé. Demande une invitation.", "error", 5000);
    }
  }

  onAuthChange(async (user) => {
    currentUser = user;
    if (user) {
      await loadDirectories();
      await refreshProfile();
      if (!currentProfile) {
        await signOut();
        currentUser = null;
        toast("Email non invité. Demande à un admin de te whitelister.", "error", 5000);
      }
    } else {
      currentProfile = null;
    }
    listeners.forEach((cb) => cb(currentUser, currentProfile));
    updateBadge();
  });
  updateBadge();
}

export function onAdminChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Compat avec ancien code qui importait ces fonctions.
export async function refreshAllowedEmails() { /* no-op, géré via user_profiles + RLS */ }

// === UI : badge dans la topbar ===

function updateBadge() {
  const slot = document.getElementById("admin-slot");
  if (!slot) return;
  slot.innerHTML = "";
  if (!currentUser) return;

  const who = getProfileWho() || currentUser.email;
  const roleLabel =
    currentProfile?.role === "admin"     ? "admin" :
    currentProfile?.role === "prof"      ? "prof" :
    currentProfile?.role === "stagiaire" ? "stagiaire" : "";

  const badge = el("button", { class: "admin-badge", onClick: openProfileMenu },
    el("span", { class: "admin-dot " + (currentProfile?.role || "") }),
    el("span", { class: "admin-email" }, who),
    roleLabel ? el("span", { class: "admin-role" }, roleLabel) : null,
  );
  slot.appendChild(badge);
}

function openProfileMenu() {
  const backdrop = el("div", { class: "modal-backdrop" });
  const logoutBtn = el("button", { class: "btn danger full", onClick: async () => {
    await signOut();
    backdrop.remove();
    toast("Déconnecté", "success");
    // Le hashchange + onAuthChange rechargeront le gate
    location.reload();
  }}, "Se déconnecter");

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Mon compte"),
    el("p", { class: "muted", style: "margin:0 0 0.4rem;font-size:0.9rem" },
      "Connecté en tant que ", el("strong", {}, currentUser.email)),
    el("p", { class: "muted", style: "margin:0 0 1.2rem;font-size:0.85rem" },
      "Rôle : ", el("strong", {}, currentProfile?.role || "?"),
      currentProfile && (currentProfile.stagiaire_id || currentProfile.prof_id)
        ? el("span", {}, " · profil : ", el("strong", {}, getProfileWho() || "?"))
        : null,
    ),
    logoutBtn,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}
