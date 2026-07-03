/**
 * Auth profile-aware (post-refonte invitation).
 *
 * ModÃ¨le :
 *  - Tout le monde se connecte via email + mot de passe Supabase
 *    (whitelist user_profiles, cf. refonte du 18 mai â€” plus de magic link).
 *  - Ã€ la connexion, on lit user_profiles pour rÃ©cupÃ©rer le rÃ´le
 *    (stagiaire / prof / admin) et la personne liÃ©e (stagiaire_id ou prof_id).
 *  - isAdmin() / isProf() / isStagiaire() : checks de rÃ´le.
 *  - getProfile() : la row complÃ¨te user_profiles.
 *
 * ConservÃ© : nom du module + signatures pour limiter la casse.
 */

import {
  getCurrentUser, signOut, onAuthChange,
  getMyProfile, listStagiaires, listProfs,
} from "./db.js?v=20260703b";
import { el, toast, displayStagiaire } from "./utils.js?v=20260703b";
import { icon } from "./icons.js?v=20260703b";

let currentUser = null;     // Supabase auth user
let currentProfile = null;  // row user_profiles
let stagiaires = null;
let profs = null;
const listeners = new Set();

// AperÃ§u fondateur Â« Voir en tant que Â» : un fondateur (is_founder) peut simuler
// le rendu d'un autre rÃ´le (prof / stagiaire) SANS perdre ses droits rÃ©els.
// C'est purement UI : la session reste celle du fondateur (RLS inchangÃ©e).
const VIEW_AS_KEY = "ecsr_view_as";
let viewAs = null;  // null = rÃ´le rÃ©el ; "prof" | "stagiaire" = aperÃ§u

// === Getters publics ===

export function isAuth()        { return !!currentUser && !!currentProfile; }
export function isFounder()     { return !!currentProfile?.is_founder; }
export function getViewAs()     { return isFounder() ? viewAs : null; }
export function getAdminEmail() { return currentUser?.email || null; }
export function getProfile()    { return currentProfile; }

// En aperÃ§u (fondateur uniquement), les checks de rÃ´le renvoient le rÃ´le SIMULÃ‰.
export function isAdmin() {
  if (getViewAs()) return false;            // aperÃ§u prof/stagiaire => jamais admin
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

// Charge l'aperÃ§u mÃ©morisÃ© (ignorÃ© si l'utilisateur n'est pas fondateur).
function loadViewAs() {
  try {
    const v = localStorage.getItem(VIEW_AS_KEY);
    viewAs = (isFounder() && (v === "prof" || v === "stagiaire")) ? v : null;
  } catch (e) { viewAs = null; }
}

// Pose l'aperÃ§u et re-render l'app. role : "admin" (rÃ©el/fondateur) | "prof" | "stagiaire".
export function setViewAs(role) {
  if (!isFounder()) return;
  viewAs = (role === "prof" || role === "stagiaire") ? role : null;
  try {
    if (viewAs) localStorage.setItem(VIEW_AS_KEY, viewAs);
    else localStorage.removeItem(VIEW_AS_KEY);
  } catch (e) { /* ignore */ }
  listeners.forEach((cb) => cb(currentUser, currentProfile));  // dÃ©clenche navigate()
  updateBadge();
}

/** Renvoie le prÃ©nom liÃ© au profil (stagiaire ou prof), ou l'email pour admin pur. */
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
    // Les annuaires ne sont lisibles qu'authentifiÃ© (RLS) â†’ charger aprÃ¨s l'auth.
    await loadDirectories();
    await refreshProfile();
    if (!currentProfile) {
      // ConnectÃ© mais pas dans user_profiles â†’ kick out
      await signOut();
      currentUser = null;
      toast("Ton compte n'est plus autorisÃ©. Demande une invitation.", "error", 5000);
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
        toast("Email non invitÃ©. Demande Ã  un admin de te whitelister.", "error", 5000);
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
export async function refreshAllowedEmails() { /* no-op, gÃ©rÃ© via user_profiles + RLS */ }

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

// Bandeau permanent quand un fondateur est en aperÃ§u d'un autre rÃ´le.
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
  banner.appendChild(el("span", { class: "imp-eye", "aria-hidden": "true" }, "ðŸ‘"));
  banner.appendChild(el("span", { class: "imp-text" }, "AperÃ§u : ", el("strong", {}, label)));
  banner.appendChild(el("button", { class: "imp-back", type: "button",
    onClick: () => setViewAs("admin") }, "Revenir fondateur"));
}

// SÃ©lecteur Â« Voir en tant que Â» (fondateur uniquement) ; null sinon.
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
    el("p", { class: "muted", style: "margin:0 0 0.4rem;font-size:0.82rem" }, "Voir en tant que (aperÃ§u)"),
    seg,
  );
}

function openProfileMenu() {
  const backdrop = el("div", { class: "modal-backdrop" });
  const logoutBtn = el("button", { class: "btn danger full", onClick: async () => {
    await signOut();
    backdrop.remove();
    toast("DÃ©connectÃ©", "success");
    // Le hashchange + onAuthChange rechargeront le gate
    location.reload();
  }}, "Se dÃ©connecter");

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Mon compte"),
    el("p", { class: "muted", style: "margin:0 0 0.4rem;font-size:0.9rem" },
      "ConnectÃ© en tant que ", el("strong", {}, currentUser.email)),
    el("p", { class: "muted", style: "margin:0 0 1.2rem;font-size:0.85rem" },
      "RÃ´le : ", el("strong", {}, currentProfile?.role || "?"),
      currentProfile && (currentProfile.stagiaire_id || currentProfile.prof_id)
        ? el("span", {}, " Â· profil : ", el("strong", {}, getProfileWho() || "?"))
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
