/**
 * Auth profile-aware (post-refonte invitation).
 *
 * Modèle :
 *  - Tout le monde se connecte via email + mot de passe Supabase
 *    (whitelist user_profiles, cf. refonte du 18 mai, plus de magic link).
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
  chargerMesPromos, oublierPromo, getPromoCourante, rechargerApresEnregistrements,
  bloquerRequetesJusquAuRechargement,
} from "./db.js?v=20261004a";
import { el, toast, displayStagiaire } from "./utils.js?v=20261004a";
import { icon } from "./icons.js?v=20261004a";
import { construirePastille } from "./promo-pastille.js?v=20261004a";
import { pagePersonnelle } from "./route-rules.js?v=20261004a";

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

// Profil stagiaire de la personne connectée, tel que l'app le traite : en aperçu
// « Formateur », le fondateur n'en a pas, comme un vrai formateur (chantier D).
export function monStagiaireId() {
  if (getViewAs() === "prof") return null;
  return currentProfile?.stagiaire_id ?? null;
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

const MESSAGE_SANS_PROMO = "Aucune promo n'est associée à ton compte. Demande à un formateur.";
const MESSAGE_PROMOS_NON_CHARGEES = "Promos non chargées : la promo par défaut est affichée.";
// Un stagiaire n'a qu'une promo : « promo par défaut » ne lui dit rien.
const MESSAGE_PROMOS_NON_CHARGEES_STAGIAIRE = "Connexion instable : certaines informations peuvent manquer.";
const PAUSE_AVANT_SECOND_ESSAI_MS = 1500;

// État dégradé : mes_promos a échoué deux fois et aucune promo n'est en place. Sans en-tête, la
// base répond sur la promo par défaut de la personne ; un bandeau le dit (updatePromosBanner)
// jusqu'à ce qu'un chargement ultérieur réussisse. Il est recalculé à chaque chargement. Au
// retour (rappel onAuthChange), la page se recharge si la promo posée n'est pas celle par défaut.
let promosIndisponibles = false;

// Contexte de promo AVANT toute lecture (spec multi-promo C.1). Faux si le compte n'a accès à
// aucune promo ; nul si une déconnexion a croisé le chargement (rien n'a été posé : à ignorer,
// ni refus ni message, la déconnexion a déjà tout remis à plat). Deux essais, le second 1,5 s
// après le premier : une panne passagère ne doit pas faire perdre la promo choisie. Si les deux
// échouent, on entre quand même (un stagiaire n'a qu'une promo, le bloquer serait une
// régression) en état dégradé : liste vide, donc sans pastille, et bandeau. Un échec au
// renouvellement d'un jeton, alors que les promos du compte sont déjà en mémoire, ne change
// rien : la promo affichée reste la bonne, rien à signaler.
async function chargerContextePromo(user) {
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const promos = await chargerMesPromos(user.email);
      if (promos === null) return null;
      promosIndisponibles = false;
      return promos.length > 0;
    } catch (e) {
      console.error("mes_promos indisponible (essai " + essai + "/2)", e);
      if (essai === 1) await new Promise((resolve) => setTimeout(resolve, PAUSE_AVANT_SECOND_ESSAI_MS));
    }
  }
  promosIndisponibles = !getPromoCourante();
  return true;
}

// Refus de la session (aucune promo, profil absent) : contexte oublié, motif envoyé à la porte,
// déconnexion, puis message dans l'app. Le toast seul ne suffit pas : pendant la porte il est
// caché avec #app, et la carte de connexion resterait sur « Connexion… ». gate.js écoute donc
// « ecsr:refus-porte » (detail = le motif). Pas d'import de gate.js ici : un événement suffit.
async function refuserSession(message) {
  oublierPromo();
  document.dispatchEvent(new CustomEvent("ecsr:refus-porte", { detail: message }));
  await signOut();
  currentUser = null;
  currentProfile = null;
  toast(message, "error", 5000);
}

// Rechargement décidé ici (promo devenue inaccessible, retour d'un état dégradé), sans attendre les
// enregistrements en cours, contrairement à la bascule et au bandeau « Réessayer » : ils partiraient
// sous l'en-tête de la nouvelle promo alors que l'écran montre l'ancienne. Les requêtes de données
// sont donc coupées d'abord, jusqu'au rechargement.
function rechargerSansDelai() {
  bloquerRequetesJusquAuRechargement();
  location.reload();
}

export async function initAuth() {
  currentUser = await getCurrentUser();
  if (currentUser) {
    const contexte = await chargerContextePromo(currentUser);
    if (contexte === null) {
      // Déconnexion pendant le chargement : rien n'a été posé, rien à refuser ni à dire.
    } else if (!contexte) {
      // Le rappel onAuthChange n'est pas encore branché : la déconnexion ne lui dira pas
      // d'oublier le contexte, refuserSession s'en charge (comme pour le profil absent).
      await refuserSession(MESSAGE_SANS_PROMO);
    } else {
      // Les annuaires ne sont lisibles qu'authentifié (RLS) → charger après l'auth.
      await loadDirectories();
      await refreshProfile();
      if (!currentProfile) {
        // Connecté mais pas dans user_profiles → kick out
        await refuserSession("Ton compte n'est plus autorisé. Demande une invitation.");
      }
    }
  }

  onAuthChange(async (user) => {
    currentUser = user;
    if (user) {
      const avant = getPromoCourante()?.id ?? null;
      const etaitDegrade = promosIndisponibles;
      const contexte = await chargerContextePromo(user);
      // Déconnexion pendant le chargement : le rappel de la déconnexion a déjà vidé le profil, la barre
      // et prévenu les écouteurs. Rien à refuser, à dire ni à relire (et surtout pas de second signOut,
      // qui frapperait une session ouverte entre-temps).
      if (contexte === null) return;
      if (!contexte) {
        await refuserSession(MESSAGE_SANS_PROMO);
      } else if (avant !== null && getPromoCourante()?.id !== avant) {
        // La promo affichée n'est plus accessible (ou le compte a changé) : les vues déjà
        // dessinées sont celles de l'autre promo. On repart de zéro plutôt que de les mélanger.
        rechargerSansDelai();
        return;
      } else if (etaitDegrade && getPromoCourante() && !getPromoCourante().par_defaut) {
        // Retour d'un état dégradé : sans en-tête, la base a servi la promo par défaut, et c'est elle
        // que les vues affichent (les annulations Ctrl+Z déjà enregistrées en rejoueraient le contenu
        // sous l'en-tête de la promo mémorisée, posée à l'instant). On repart de zéro. Si la promo
        // posée EST celle par défaut, les vues correspondent déjà : rien à recharger, le bandeau
        // disparaît.
        rechargerSansDelai();
        return;
      } else {
        await loadDirectories();
        await refreshProfile();
        if (!currentProfile) {
          await refuserSession("Email non invité. Demande à un admin de te whitelister.");
        }
      }
    } else {
      currentProfile = null;
      oublierPromo();
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
  if (!currentUser) { updateImpersonationBanner(); updatePromosBanner(); return; }

  // Pastille de promo devant le badge (formateurs et fondateur, au moins deux promos). Pas dans
  // l'aperçu « Stagiaire » : un stagiaire n'en a pas, l'aperçu doit rester fidèle.
  const pastille = getViewAs() === "stagiaire" ? null : construirePastille();
  if (pastille) slot.appendChild(pastille);
  slot.classList.toggle("avec-pastille", !!pastille);

  const who = getProfileWho() || currentUser.email;
  const roleLabel =
    currentProfile?.role === "admin"     ? "admin" :
    currentProfile?.role === "prof"      ? "formateur" :
    currentProfile?.role === "stagiaire" ? "stagiaire" : "";

  const badge = el("button", { class: "admin-badge", onClick: openProfileMenu },
    el("span", { class: "admin-dot " + (currentProfile?.role || "") }),
    el("span", { class: "admin-email" }, who),
    roleLabel ? el("span", { class: "admin-role" }, roleLabel) : null,
  );
  slot.appendChild(badge);
  updateImpersonationBanner();
  updatePromosBanner();
}

// Bandeau d'état dégradé : les promos n'ont pas pu être chargées (deux essais), l'app affiche la
// promo par défaut du compte. Persistant, retiré dès qu'un chargement réussit. Sur le modèle du
// bandeau d'aperçu, mais dans #app : il est caché avec lui pendant la porte. « Réessayer »
// recharge la page, qui repart d'un contexte propre, après les enregistrements en cours du
// planning (même attente qu'une bascule de promo).
function updatePromosBanner() {
  let banner = document.getElementById("promos-banner");
  if (!(promosIndisponibles && currentUser && currentProfile)) { if (banner) banner.remove(); return; }
  if (!banner) {
    banner = el("div", { id: "promos-banner", class: "promos-banner", role: "status" },
      el("span", { class: "promos-banner-texte" },
        currentProfile.role === "stagiaire" ? MESSAGE_PROMOS_NON_CHARGEES_STAGIAIRE : MESSAGE_PROMOS_NON_CHARGEES),
      el("button", { class: "promos-banner-btn", type: "button", onClick: (e) => {
        e.currentTarget.disabled = true;
        rechargerApresEnregistrements();
      } }, "Réessayer"),
    );
    (document.getElementById("app") || document.body).appendChild(banner);
  }
  // Même place, en bas de l'écran : au-dessus du bandeau d'aperçu quand les deux sont là.
  banner.classList.toggle("au-dessus-apercu", !!document.getElementById("impersonation-banner"));
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

  // Accès direct à sa page depuis le badge : « cliquer sur mon nom » mène chez soi.
  // Un formateur sans profil stagiaire n'a pas de Mon espace : sa page est la page
  // Stagiaires (chantier D, lot 2). On change juste le hash, le routeur fait le rendu.
  const versStagiaires = pagePersonnelle({ formateur: isAdmin() || isProf(), stagiaireId: monStagiaireId() }) === "stagiaires";
  const persoBtn = el("button", { class: "btn full", onClick: () => {
    backdrop.remove();
    location.hash = versStagiaires ? "#/stagiaires" : "#/mon-suivi";
  }}, versStagiaires ? icon.users() : icon.user(), versStagiaires ? "Stagiaires" : "Mon espace personnel");

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Mon compte"),
    el("p", { class: "muted", style: "margin:0 0 0.4rem;font-size:0.9rem" },
      "Connecté en tant que ", el("strong", {}, currentUser.email)),
    el("p", { class: "muted", style: "margin:0 0 1.2rem;font-size:0.85rem" },
      "Rôle : ", el("strong", {}, currentProfile?.role === "prof" ? "formateur" : (currentProfile?.role || "?")),
      currentProfile && (currentProfile.stagiaire_id || currentProfile.prof_id)
        ? el("span", {}, " · profil : ", el("strong", {}, getProfileWho() || "?"))
        : null,
    ),
    persoBtn,
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
