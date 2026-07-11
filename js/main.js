/*
 * Promo ECSR — Application propriétaire.
 * © 2026 watchi64 — Tous droits réservés. Voir LICENSE.
 */
import { signInWithPassword, signUpWithPassword, getCurrentUser, invalidateCache } from "./db.js?v=20260712c";
import { toast } from "./utils.js?v=20260712c";
import { icon } from "./icons.js?v=20260712c";
import { initAuth, onAdminChange, isAuth } from "./auth-admin.js?v=20260712c";
import { loadAccent } from "./accent-switcher.js?v=20260712c";
import { loadTheme } from "./theme-switcher.js?v=20260712c";
import { renderHome } from "./views/home.js?v=20260712c";
import { renderDashboard } from "./views/dashboard.js?v=20260712c";
import { renderPlanning, teardownPrintTarget } from "./views/planning.js?v=20260712c";
import { renderNotes } from "./views/notes.js?v=20260712c";
import { renderRessources } from "./views/ressources.js?v=20260712c";
import { renderThemes } from "./views/themes.js?v=20260712c";
import { renderConfig } from "./views/config.js?v=20260712c";
import { renderCalendrier } from "./views/calendrier.js?v=20260712c";
import { initUndoKeyboard } from "./undo.js?v=20260712c";

// ===== Gate : email magic link =====

function showGate() {
  const gate = document.getElementById("gate");
  const tabSignin = document.getElementById("gate-tab-signin");
  const tabSignup = document.getElementById("gate-tab-signup");
  const subtitle = document.getElementById("gate-subtitle");
  const emailInput = document.getElementById("gate-email");
  const passwordInput = document.getElementById("gate-password");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");
  const hint = document.getElementById("gate-hint");

  let mode = "signin";  // "signin" | "signup"

  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");

  function setMode(next) {
    mode = next;
    tabSignin.classList.toggle("active", mode === "signin");
    tabSignup.classList.toggle("active", mode === "signup");
    if (mode === "signin") {
      subtitle.textContent = "Entre ton email et ton mot de passe.";
      submit.textContent = "Se connecter";
      passwordInput.autocomplete = "current-password";
      hint.textContent = "Pas encore inscrit ? Bascule sur « Créer un compte » (ton email doit être whitelisté).";
    } else {
      subtitle.textContent = "Crée ton compte : email (whitelisté par un admin) + choisis un mot de passe.";
      submit.textContent = "Créer mon compte";
      passwordInput.autocomplete = "new-password";
      hint.textContent = "Tu dois avoir été invité au préalable. Sinon l'inscription sera refusée.";
    }
    error.classList.add("hidden");
    submit.disabled = false;
  }

  tabSignin.onclick = () => setMode("signin");
  tabSignup.onclick = () => setMode("signup");
  setMode("signin");
  emailInput.focus();

  const handler = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      error.textContent = "Email invalide";
      error.classList.remove("hidden");
      return;
    }
    if (!password) {
      error.textContent = "Mot de passe requis";
      error.classList.remove("hidden");
      return;
    }
    // Longueur minimale exigée seulement à la création (la connexion valide
    // le vrai mot de passe côté serveur).
    if (mode === "signup" && password.length < 8) {
      error.textContent = "Mot de passe : 8 caractères minimum";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = mode === "signup" ? "Création…" : "Connexion…";
    try {
      if (mode === "signup") {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      // initAuth() est déjà câblé via onAuthChange ; le polling watch bootera l'app.
    } catch (e) {
      console.error("Gate auth error:", e);
      let msg = e?.message || String(e);
      // Messages Supabase plus parlants
      if (/Invalid login credentials/i.test(msg)) msg = "Email ou mot de passe incorrect.";
      else if (/User already registered/i.test(msg)) msg = "Cet email a déjà un compte. Bascule sur « Connexion ».";
      else if (/non autorisé/i.test(msg) || /Database error/i.test(msg)) msg = "Email non whitelisté. Demande à un admin de t'inviter d'abord.";
      error.textContent = msg;
      error.classList.remove("hidden");
      submit.disabled = false;
      submit.textContent = original;
    }
  };
  submit.onclick = handler;
  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); handler(); } };
  emailInput.onkeydown = onEnter;
  passwordInput.onkeydown = onEnter;
}

function hideGate() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

// ===== Tabs =====

const TABS = [
  { route: "home",       label: "Accueil",         icon: "info"      },
  { route: "dashboard",  label: "Tableau de bord", icon: "dashboard" },
  { route: "planning",   label: "Planning",        icon: "calendar"  },
  { route: "calendrier", label: "Calendrier",      icon: "clock"     },
  { route: "themes",     label: "Thèmes",          icon: "list"      },
  { route: "notes",      label: "Notes",           icon: "edu"       },
  { route: "ressources", label: "Ressources",      icon: "signpost"  },
  { route: "config",     label: "Paramètres",      icon: "settings"  },
];

function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  TABS.forEach((t) => {
    const a = document.createElement("a");
    a.href = "#/" + t.route;
    a.className = "tab";
    a.dataset.route = t.route;
    a.appendChild(icon[t.icon]());
    const span = document.createElement("span");
    span.textContent = t.label;
    a.appendChild(span);
    nav.appendChild(a);
  });
}

// ===== Router =====

const routes = {
  home:       renderHome,
  dashboard:  renderDashboard,
  planning:   renderPlanning,
  calendrier: renderCalendrier,
  themes:     renderThemes,
  notes:      renderNotes,
  ressources: renderRessources,
  config:     renderConfig,
};

async function navigate() {
  const hash = location.hash.replace(/^#\//, "") || "dashboard";
  const route = routes[hash] ? hash : "dashboard";
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.route === route;
    t.classList.toggle("active", active);
    if (active) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  const view = document.getElementById("view");
  // Le conteneur #view est partagé entre toutes les vues. On réinitialise l'état
  // qu'une vue précédente a pu y laisser, sinon il contamine la suivante.
  // Cas concret : le planning pose « read-only » sur #view (non-admin) et ne le
  // retirait jamais → « .read-only select { pointer-events: none } » gelait ensuite
  // le tri des Notes, les filtres, etc. Le planning re-pose la classe à son rendu.
  view.classList.remove("read-only");
  // En quittant le planning, on retire sa cible d'impression (re-montée par renderPlanning).
  teardownPrintTarget();
  try {
    await routes[route](view);
  } catch (e) {
    console.error(e);
    view.innerHTML = "";
    const isTimeout = /abort|timeout|network|fetch/i.test(e?.message || String(e));
    const box = document.createElement("div");
    box.className = "view-error-box";
    const h = document.createElement("p");
    h.className = "view-error-title";
    h.textContent = isTimeout ? "Connexion trop lente" : "Une erreur est survenue";
    const sub = document.createElement("p");
    sub.className = "view-error-sub";
    sub.textContent = isTimeout
      ? "Le serveur n'a pas répondu à temps. Vérifie ta connexion et réessaie."
      : "Détail : " + (e?.message || e);
    const retry = document.createElement("button");
    retry.className = "btn primary";
    retry.textContent = "Réessayer";
    retry.addEventListener("click", () => navigate());
    box.appendChild(h);
    box.appendChild(sub);
    box.appendChild(retry);
    view.appendChild(box);
    toast(isTimeout ? "Connexion trop lente, réessaie" : (e?.message || String(e)), "error");
  }
}

window.addEventListener("hashchange", navigate);

function setupRefreshBtn() {
  const btn = document.getElementById("refresh-btn");
  btn.innerHTML = "";
  btn.appendChild(icon.refresh());
  btn.addEventListener("click", () => {
    // Force le rechargement réel : vide le cache des données de référence
    invalidateCache();
    navigate();
  });
}

async function bootApp() {
  hideGate();
  renderTabs();
  setupRefreshBtn();
  onAdminChange(() => navigate());
  initUndoKeyboard();
  if (!location.hash) location.hash = "#/dashboard";
  await navigate();
}

(async () => {
  loadTheme();
  loadAccent();
  await initAuth();
  if (isAuth()) {
    await bootApp();
  } else {
    // Pas connecté → gate.
    // Si l'URL contient ?code=... (callback magic link), Supabase a déjà handle ;
    // un onAuthChange va déclencher le boot automatiquement.
    showGate();
    // Surveille le moment où l'auth devient valide pour basculer.
    const watch = setInterval(async () => {
      if (isAuth()) {
        clearInterval(watch);
        await bootApp();
      } else {
        const u = await getCurrentUser();
        if (u) {
          // user connecté mais profile pas encore prêt → on attend
        }
      }
    }, 800);
  }
})();
