/*
 * Promo ECSR — Application propriétaire.
 * © 2026 watchi64 — Tous droits réservés. Voir LICENSE.
 */
import { signInWithMagicLink, getCurrentUser } from "./db.js";
import { toast } from "./utils.js";
import { icon } from "./icons.js";
import { initAuth, onAdminChange, isAuth } from "./auth-admin.js";
import { loadAccent } from "./accent-switcher.js";
import { loadTheme } from "./theme-switcher.js";
import { renderHome } from "./views/home.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderPlanning } from "./views/planning.js";
import { renderPassages } from "./views/passages.js";
import { renderNotes } from "./views/notes.js";
import { renderRessources } from "./views/ressources.js";
import { renderThemes } from "./views/themes.js";
import { renderConfig } from "./views/config.js";

// ===== Gate : email magic link =====

function showGate() {
  const gate = document.getElementById("gate");
  const subtitle = document.getElementById("gate-subtitle");
  const input = document.getElementById("gate-input");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");

  // Reconfigure le gate pour email
  input.type = "email";
  input.placeholder = "ton.email@exemple.fr";
  input.value = "";
  input.autocomplete = "email";
  subtitle.textContent = "Connecte-toi avec ton email (un lien magique te sera envoyé)";
  submit.textContent = "Recevoir le lien";
  submit.type = "button";
  submit.disabled = false;
  error.classList.add("hidden");

  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  input.focus();

  const handler = async () => {
    const email = input.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      error.textContent = "Email invalide";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = "Envoi…";
    try {
      await signInWithMagicLink(email);
      subtitle.textContent = "Mail envoyé à " + email;
      input.style.display = "none";
      submit.style.display = "none";
      const ok = document.createElement("p");
      ok.className = "muted";
      ok.style.cssText = "margin-top:1rem;font-size:0.9rem";
      ok.textContent = "Ouvre le mail (et vérifie les spams). Tu peux fermer cet onglet, le lien marche partout.";
      error.parentElement.insertBefore(ok, error);
    } catch (e) {
      console.error("Gate login error:", e);
      error.textContent = "Erreur : " + (e?.message || e);
      error.classList.remove("hidden");
      submit.disabled = false;
      submit.textContent = original;
    }
  };
  submit.onclick = handler;
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); handler(); } };
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
  { route: "themes",     label: "Thèmes",          icon: "list"      },
  { route: "passages",   label: "Passages",        icon: "history"   },
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
  try {
    await routes[route](view);
  } catch (e) {
    console.error(e);
    view.innerHTML = "";
    const errP = document.createElement("p");
    errP.className = "error";
    errP.textContent = "Erreur : " + (e?.message || e);
    view.appendChild(errP);
    toast(e?.message || String(e), "error");
  }
}

window.addEventListener("hashchange", navigate);

function setupRefreshBtn() {
  const btn = document.getElementById("refresh-btn");
  btn.innerHTML = "";
  btn.appendChild(icon.refresh());
  btn.addEventListener("click", () => navigate());
}

async function bootApp() {
  hideGate();
  renderTabs();
  setupRefreshBtn();
  onAdminChange(() => navigate());
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
