import { getSetting, setSetting } from "./db.js";
import { sha256, toast } from "./utils.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderPlanning } from "./views/planning.js";
import { renderPassages } from "./views/passages.js";
import { renderConfig } from "./views/config.js";

const STORAGE_KEY = "ecsr_auth";

// ===== Auth gate =====

async function checkAuth() {
  const storedHash = await getSetting("password_hash");
  const localHash = localStorage.getItem(STORAGE_KEY);

  if (!storedHash) {
    // Pas de mot de passe défini → premier accès : on demande de le définir
    showInitialPasswordSetup();
    return false;
  }

  if (localHash === storedHash) {
    return true;
  }

  showGate(storedHash);
  return false;
}

function showInitialPasswordSetup() {
  const gate = document.getElementById("gate");
  const subtitle = document.getElementById("gate-subtitle");
  const input = document.getElementById("gate-input");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");

  subtitle.textContent = "Premier accès — Définir le mot de passe de la promo";
  input.placeholder = "Minimum 4 caractères";
  submit.textContent = "Définir et entrer";
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
    const hash = await sha256(v);
    await setSetting("password_hash", hash);
    localStorage.setItem(STORAGE_KEY, hash);
    gate.classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    init();
  };

  submit.onclick = handler;
  input.onkeydown = (e) => { if (e.key === "Enter") handler(); };
}

function showGate(storedHash) {
  const gate = document.getElementById("gate");
  const subtitle = document.getElementById("gate-subtitle");
  const input = document.getElementById("gate-input");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");

  subtitle.textContent = "Mot de passe de la promo";
  input.placeholder = "••••••••";
  submit.textContent = "Entrer";
  error.classList.add("hidden");

  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  input.focus();

  const handler = async () => {
    const v = input.value;
    const hash = await sha256(v);
    if (hash === storedHash) {
      localStorage.setItem(STORAGE_KEY, hash);
      gate.classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      init();
    } else {
      error.classList.remove("hidden");
      input.value = "";
      input.focus();
    }
  };

  submit.onclick = handler;
  input.onkeydown = (e) => { if (e.key === "Enter") handler(); };
}

// ===== Router =====

const routes = {
  dashboard: renderDashboard,
  planning: renderPlanning,
  passages: renderPassages,
  config: renderConfig,
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

document.getElementById("refresh-btn").addEventListener("click", () => navigate());

// ===== Init =====

async function init() {
  if (!location.hash) location.hash = "#/dashboard";
  await navigate();
}

(async () => {
  const ok = await checkAuth();
  if (ok) {
    document.getElementById("app").classList.remove("hidden");
    await init();
  }
})();
