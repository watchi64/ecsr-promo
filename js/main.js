/*
 * Promo ECSR — Application propriétaire.
 * © 2026 watchi64 — Tous droits réservés. Voir LICENSE.
 */
import { getSetting, setSetting } from "./db.js";
import { sha256, toast } from "./utils.js";
import { icon } from "./icons.js";
import { initAuth, onAdminChange } from "./auth-admin.js";
import { loadAccent, renderAccentSwitcher } from "./accent-switcher.js";
import { loadTheme } from "./theme-switcher.js";
import { ensureIdentity } from "./identity.js";
import { renderHome } from "./views/home.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderPlanning } from "./views/planning.js";
import { renderPassages } from "./views/passages.js";
import { renderNotes } from "./views/notes.js";
import { renderRessources } from "./views/ressources.js";
import { renderThemes } from "./views/themes.js";
import { renderConfig } from "./views/config.js";

const STORAGE_KEY = "ecsr_auth";

// ===== Auth gate (mot de passe partagé) =====

async function checkAuth() {
  let storedHash = null;
  try {
    storedHash = await getSetting("password_hash");
  } catch (e) {
    console.error("checkAuth: getSetting failed", e);
  }
  const localHash = localStorage.getItem(STORAGE_KEY);

  // storedHash null OU chaîne vide = aucun mot de passe défini → premier accès
  if (!storedHash || storedHash.length === 0) {
    showInitialPasswordSetup();
    return false;
  }
  if (localHash === storedHash) return true;
  showGate(storedHash);
  return false;
}

function showInitialPasswordSetup() {
  const gate = document.getElementById("gate");
  const subtitle = document.getElementById("gate-subtitle");
  const input = document.getElementById("gate-input");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");

  subtitle.textContent = "Premier accès : définissez le mot de passe partagé";
  input.placeholder = "Minimum 4 caractères";
  submit.textContent = "Définir et entrer";
  submit.type = "button";
  error.classList.add("hidden");

  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  input.focus();

  const handler = async () => {
    const v = input.value;
    if (!v || v.length < 4) {
      error.textContent = "Minimum 4 caractères";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = "Enregistrement…";
    try {
      const hash = await sha256(v);
      await setSetting("password_hash", hash);
      localStorage.setItem(STORAGE_KEY, hash);
      gate.classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      await init();
    } catch (e) {
      console.error("Gate setup error:", e);
      error.textContent = "Erreur : " + (e?.message || e);
      error.classList.remove("hidden");
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  };
  submit.onclick = handler;
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); handler(); } };
}

function showGate(storedHash) {
  const gate = document.getElementById("gate");
  const subtitle = document.getElementById("gate-subtitle");
  const input = document.getElementById("gate-input");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");

  subtitle.textContent = "Mot de passe partagé de la promo";
  input.placeholder = "••••••••";
  submit.textContent = "Entrer";
  submit.type = "button";
  error.classList.add("hidden");

  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  input.focus();

  const handler = async () => {
    const v = input.value;
    if (!v) return;
    error.classList.add("hidden");
    submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = "Vérification…";
    try {
      const hash = await sha256(v);
      if (hash === storedHash) {
        localStorage.setItem(STORAGE_KEY, hash);
        gate.classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");
        await init();
      } else {
        error.textContent = "Mot de passe incorrect";
        error.classList.remove("hidden");
        input.value = "";
        input.focus();
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    } catch (e) {
      console.error("Gate login error:", e);
      error.textContent = "Erreur : " + (e?.message || e);
      error.classList.remove("hidden");
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  };
  submit.onclick = handler;
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); handler(); } };
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
    t.classList.toggle("active", t.dataset.route === route);
  });
  const view = document.getElementById("view");
  try {
    await routes[route](view);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<p class="error">Erreur : ${e.message}</p>`;
    toast(e.message, "error");
  }
}

window.addEventListener("hashchange", navigate);

function setupRefreshBtn() {
  const btn = document.getElementById("refresh-btn");
  btn.innerHTML = "";
  btn.appendChild(icon.refresh());
  btn.addEventListener("click", () => navigate());
}

function setupAccentSwitcher() {
  const slot = document.getElementById("accent-slot");
  if (!slot) {
    const adminSlot = document.getElementById("admin-slot");
    const wrap = document.createElement("div");
    wrap.id = "accent-slot";
    adminSlot.parentElement.insertBefore(wrap, adminSlot);
  }
  const target = document.getElementById("accent-slot");
  target.innerHTML = "";
  target.appendChild(renderAccentSwitcher());
}

async function init() {
  loadTheme();
  loadAccent();
  await initAuth();
  // Identifier le visiteur AVANT d'afficher l'app (sauf si déjà admin)
  await ensureIdentity();
  renderTabs();
  setupRefreshBtn();
  setupAccentSwitcher();
  onAdminChange(() => navigate());
  if (!location.hash) location.hash = "#/dashboard";
  await navigate();
}

(async () => {
  // Applique le thème avant tout pour éviter le flash crème par défaut
  loadTheme();
  loadAccent();
  const ok = await checkAuth();
  if (ok) {
    document.getElementById("app").classList.remove("hidden");
    await init();
  }
})();
