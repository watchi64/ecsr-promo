/**
 * Auth profile-aware (post-refonte invitation).
 *
 * Modèle :
 *  - Tout le monde se connecte via email + mot de passe Supabase
 *    (whitelist user_profiles, cf. refonte du 18 mai — plus de magic link).
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
} from "./db.js?v=20260713d";
import { el, toast, displayStagiaire } from "./utils.js?v=20260713d";
import { icon } from "./icons.js?v=20260713d";

let currentUser = null;     // Supabase auth user
let currentProfile = null;  // row user_profiles
let stagiaires = null;
let profs = null;
const listeners = new Set();

// Aperçu fondateur « Voir en tant que » : un fondateur (is_founder) peut simuler
// le rendu d'un autre rôle (prof / stagiaire) SANS perdre ses droits réels.
// C'est purement UI : la session reste celle du fondateur (RLS inchangée).
const VIEW_AS_KEY = "ecsr_view_as";
let viewAs = null;  // null = rôle réel ; "prof" | "stagiaire" = aperçu

// === Getters publics ===

export function isAuth()        { return !!currentUser && !!currentProfile; }
export function isFounder()     { return !!currentProfile?.is_founder; }
export function getViewAs()     { return isFounder() ? viewAs : null; }
export function getAdminEmail() { return currentUser?.email || null; }
export function getProfile()    { return currentProfile; }

// En aperçu (fondateur uniquement), les checks de rôle renvoient le rôle SIMULÉ.
export function isAdmin() {
  const v = getViewAs();
  // Dans ce modèle, un formateur EST admin (invité avec la coche admin) : l'aperçu
  // « Formateur » doit donc montrer l'UI d'édition (boutons Bénévoles / Placer /
  // Valider, planning éditable), comme pour un vrai formateur. Seul l'aperçu
  // « Stagiaire » est non-admin. (Bug remonté le 2026-07-06 : l'aperçu Formateur
  // affichait le planning en lecture seule sans les boutons.)
  if (v) return v === "prof";
  return !!currentProfile?.is_admin;
}
export function isProf() {
  const v = getViewAs();
  if (v) return v === "prof";
  return currentProfile?.role === "prof";
}
export function isStagiaire() {
  const v = getViewAs();
  if (v) return v === "stagiaire";
  return currentProfile?.role === "stagiaire";
}

// Charge l'aperçu mémorisé (ignoré si l'utilisateur n'est pas fondateur).
function loadViewAs() {
  try {
    const v = localStorage.getItem(VIEW_AS_KEY);
    viewAs = (isFounder() && (v === "prof" || v === "stagiaire")) ? v : null;
  } catch (e) { viewAs = null; }
}

// Pose l'aperçu et re-render l'app. role : "admin" (réel/fondateur) | "prof" | "stagiaire".
export function setViewAs(role) {
  if (!isFounder()) return;
  viewAs = (role === "prof" || role === "stagiaire") ? role : null;
  try {
    if (viewAs) localStorage.setItem(VIEW_AS_KEY, viewAs);
    else localStorage.removeItem(VIEW_AS_KEY);
  } catch (e) { /* ignore */ }
  listeners.forEach((cb) => cb(currentUser, currentProfile));  // déclenche navigate()
  updateBadge();
}

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
  loadViewAs();
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
  if (!currentUser) { updateImpersonationBanner(); return; }

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
  updateImpersonationBanner();
}

// Bandeau permanent quand un fondateur est en aperçu d'un autre rôle.
function updateImpersonationBanner() {
  const v = getViewAs();
  let banner = document.getElementById("impersonation-banner");
  if (!v) { if (banner) banner.remove(); return; }
  const label = v === "prof" ? "Formateur" : "Stagiaire";
  if (!banner) {
    banner = el("div", { id: "impersonation-banner", class: "impersonation-banner" });
    document.body.appendChild(banner);
  }
  banner.innerHTML = "";
  banner.appendChild(el("span", { class: "imp-eye", "aria-hidden": "true" }, "👁"));
  banner.appendChild(el("span", { class: "imp-text" }, "Aperçu : ", el("strong", {}, label)));
  banner.appendChild(el("button", { class: "imp-back", type: "button",
    onClick: () => setViewAs("admin") }, "Revenir fondateur"));
}

// Sélecteur « Voir en tant que » (fondateur uniquement) ; null sinon.
function buildViewAsBlock(onPick) {
  if (!isFounder()) return null;
  const current = getViewAs() || "admin";
  const seg = el("div", { class: "view-as-seg" });
  [["admin", "Fondateur"], ["prof", "Formateur"], ["stagiaire", "Stagiaire"]].forEach(([val, lab]) => {
    seg.appendChild(el("button", {
      class: "view-as-btn" + (current === val ? " active" : ""),
      type: "button",
      onClick: () => { setViewAs(val); if (onPick) onPick(); },
    }, lab));
  });
  return el("div", { class: "view-as-block" },
    el("p", { class: "muted", style: "margin:0 0 0.4rem;font-size:0.82rem" }, "Voir en tant que (aperçu)"),
    seg,
  );
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
    buildViewAsBlock(() => backdrop.remove()),
    logoutBtn,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}
