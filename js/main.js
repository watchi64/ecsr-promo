/*
 * Promo ECSR â€” Application propriÃ©taire.
 * Â© 2026 watchi64 â€” Tous droits rÃ©servÃ©s. Voir LICENSE.
 */
import { signInWithPassword, signUpWithPassword, getCurrentUser, invalidateCache } from "./db.js?v=20260703b";
import { toast } from "./utils.js?v=20260703b";
import { icon } from "./icons.js?v=20260703b";
import { initAuth, onAdminChange, isAuth } from "./auth-admin.js?v=20260703b";
import { loadAccent } from "./accent-switcher.js?v=20260703b";
import { loadTheme } from "./theme-switcher.js?v=20260703b";
import { renderHome } from "./views/home.js?v=20260703b";
import { renderDashboard } from "./views/dashboard.js?v=20260703b";
import { renderPlanning, teardownPrintTarget } from "./views/planning.js?v=20260703b";
import { renderPassages } from "./views/passages.js?v=20260703b";
import { renderNotes } from "./views/notes.js?v=20260703b";
import { renderRessources } from "./views/ressources.js?v=20260703b";
import { renderThemes } from "./views/themes.js?v=20260703b";
import { renderConfig } from "./views/config.js?v=20260703b";
import { renderCalendrier } from "./views/calendrier.js?v=20260703b";
import { initUndoKeyboard } from "./undo.js?v=20260703b";

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
      hint.textContent = "Pas encore inscrit ? Bascule sur Â« CrÃ©er un compte Â» (ton email doit Ãªtre whitelistÃ©).";
    } else {
      subtitle.textContent = "CrÃ©e ton compte : email (whitelistÃ© par un admin) + choisis un mot de passe.";
      submit.textContent = "CrÃ©er mon compte";
      passwordInput.autocomplete = "new-password";
      hint.textContent = "Tu dois avoir Ã©tÃ© invitÃ© au prÃ©alable. Sinon l'inscription sera refusÃ©e.";
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
    // Longueur minimale exigÃ©e seulement Ã  la crÃ©ation (la connexion valide
    // le vrai mot de passe cÃ´tÃ© serveur).
    if (mode === "signup" && password.length < 8) {
      error.textContent = "Mot de passe : 8 caractÃ¨res minimum";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = mode === "signup" ? "CrÃ©ationâ€¦" : "Connexionâ€¦";
    try {
      if (mode === "signup") {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      // initAuth() est dÃ©jÃ  cÃ¢blÃ© via onAuthChange ; le polling watch bootera l'app.
    } catch (e) {
      console.error("Gate auth error:", e);
      let msg = e?.message || String(e);
      // Messages Supabase plus parlants
      if (/Invalid login credentials/i.test(msg)) msg = "Email ou mot de passe incorrect.";
      else if (/User already registered/i.test(msg)) msg = "Cet email a dÃ©jÃ  un compte. Bascule sur Â« Connexion Â».";
      else if (/non autorisÃ©/i.test(msg) || /Database error/i.test(msg)) msg = "Email non whitelistÃ©. Demande Ã  un admin de t'inviter d'abord.";
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
  { route: "themes",     label: "ThÃ¨mes",          icon: "list"      },
  { route: "passages",   label: "Passages",        icon: "history"   },
  { route: "notes",      label: "Notes",           icon: "edu"       },
  { route: "ressources", label: "Ressources",      icon: "signpost"  },
  { route: "config",     label: "ParamÃ¨tres",      icon: "settings"  },
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
  passages:   renderPassages,
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
  // Le conteneur #view est partagÃ© entre toutes les vues. On rÃ©initialise l'Ã©tat
  // qu'une vue prÃ©cÃ©dente a pu y laisser, sinon il contamine la suivante.
  // Cas concret : le planning pose Â« read-only Â» sur #view (non-admin) et ne le
  // retirait jamais â†’ Â« .read-only select { pointer-events: none } Â» gelait ensuite
  // le tri des Notes, les filtres, etc. Le planning re-pose la classe Ã  son rendu.
  view.classList.remove("read-only");
  // En quittant le planning, on retire sa cible d'impression (re-montÃ©e par renderPlanning).
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
      ? "Le serveur n'a pas rÃ©pondu Ã  temps. VÃ©rifie ta connexion et rÃ©essaie."
      : "DÃ©tail : " + (e?.message || e);
    const retry = document.createElement("button");
    retry.className = "btn primary";
    retry.textContent = "RÃ©essayer";
    retry.addEventListener("click", () => navigate());
    box.appendChild(h);
    box.appendChild(sub);
    box.appendChild(retry);
    view.appendChild(box);
    toast(isTimeout ? "Connexion trop lente, rÃ©essaie" : (e?.message || String(e)), "error");
  }
}

window.addEventListener("hashchange", navigate);

function setupRefreshBtn() {
  const btn = document.getElementById("refresh-btn");
  btn.innerHTML = "";
  btn.appendChild(icon.refresh());
  btn.addEventListener("click", () => {
    // Force le rechargement rÃ©el : vide le cache des donnÃ©es de rÃ©fÃ©rence
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
    // Pas connectÃ© â†’ gate.
    // Si l'URL contient ?code=... (callback magic link), Supabase a dÃ©jÃ  handle ;
    // un onAuthChange va dÃ©clencher le boot automatiquement.
    showGate();
    // Surveille le moment oÃ¹ l'auth devient valide pour basculer.
    const watch = setInterval(async () => {
      if (isAuth()) {
        clearInterval(watch);
        await bootApp();
      } else {
        const u = await getCurrentUser();
        if (u) {
          // user connectÃ© mais profile pas encore prÃªt â†’ on attend
        }
      }
    }, 800);
  }
})();
