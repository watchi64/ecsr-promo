/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
import { getCurrentUser, invalidateCache, verifyRecoveryToken } from "./db.js?v=20260916b";
import { toast } from "./utils.js?v=20260916b";
import { icon } from "./icons.js?v=20260916b";
import { initAuth, onAdminChange, isAuth, isAdmin, isProf } from "./auth-admin.js?v=20260916b";
import { showGate, hideGate } from "./gate.js?v=20260916b";
import { lireJetonRecuperation } from "./gate-rules.js?v=20260916b";
import { loadAccent } from "./accent-switcher.js?v=20260916b";
import { loadTheme } from "./theme-switcher.js?v=20260916b";
import { renderHome } from "./views/home.js?v=20260916b";
import { renderDashboard } from "./views/dashboard.js?v=20260916b";
import { renderMonSuivi } from "./views/mon-suivi.js?v=20260916b";
import { renderPlanning, teardownPrintTarget, resetPlanningEditMode, requestPlanningToday } from "./views/planning.js?v=20260916b";
import { teardownDocPrint } from "./doc-officiel.js?v=20260916b";
import { renderNotes } from "./views/notes.js?v=20260916b";
import { renderRessources } from "./views/ressources.js?v=20260916b";
import { renderThemes } from "./views/themes.js?v=20260916b";
import { renderConfig } from "./views/config.js?v=20260916b";
import { renderCalendrier } from "./views/calendrier.js?v=20260916b";
import { initUndoKeyboard } from "./undo.js?v=20260916b";
import { renderNouveautes } from "./views/nouveautes.js?v=20260916b";
import { NOUVEAUTES } from "./nouveautes-data.js?v=20260916b";
import { visibles, nonLues, vuesEffectives, libellePastille } from "./nouveautes.js?v=20260916b";
import { initChatbot } from "./chatbot.js?v=20260916b";

// ===== Tabs =====

const TABS = [
  { route: "home",       label: "Accueil",         icon: "info"      },
  // « Priorités » : la vue promo dit QUI doit passer, pas « les passages » (ce mot
  // appartient à l'espace perso). L'espace perso n'a PLUS d'onglet : on y accède par
  // l'ouverture de l'app, le logo et le badge (« Mon espace personnel ») ; la route
  // mon-suivi reste dans `routes` ci-dessous. Sur #/mon-suivi, aucun onglet n'est
  // actif : assumé (la boucle d'activation ne matche rien).
  { route: "dashboard",  label: "Priorités",       icon: "target"    },
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
  TABS.filter((t) => !t.visible || t.visible()).forEach((t) => {
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

// Pastille de nouveautés sur l'onglet Accueil. Modifie l'élément SUR PLACE :
// surtout pas de renderTabs() complet, qui reconstruirait la barre et perdrait
// la classe « active » posée par navigate().
function majBadgeNouveautes() {
  const tab = document.querySelector('.tab[data-route="home"]');
  if (!tab) return;
  const mesEntrees = visibles(NOUVEAUTES, isAdmin() || isProf());
  const texte = libellePastille(nonLues(mesEntrees, vuesEffectives(NOUVEAUTES)).length);
  let badge = tab.querySelector(".tab-badge");
  if (!texte) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "tab-badge";
    badge.setAttribute("aria-label", "nouveautés non lues");
    tab.appendChild(badge);
  }
  badge.textContent = texte;
}

// ===== Router =====

const routes = {
  home:       renderHome,
  dashboard:  renderDashboard,
  "mon-suivi": renderMonSuivi,
  planning:   renderPlanning,
  calendrier: renderCalendrier,
  themes:     renderThemes,
  notes:      renderNotes,
  ressources: renderRessources,
  config:     renderConfig,
  nouveautes: renderNouveautes,
};

// Routes sans onglet propre qui doivent quand même allumer un onglet. On arrive
// sur #/nouveautes depuis Accueil : laisser la barre sans onglet actif
// donnerait l'impression d'être sorti de l'app.
const ONGLET_POUR_ROUTE = { nouveautes: "home" };

let lastRoute = null;

// Derniere page visitee, pour y revenir au prochain demarrage. Le sous-onglet,
// lui, se souvient deja tout seul (voir storageKey dans js/subtabs.js) : rendre
// la route suffit a retomber exactement la ou on etait.
const CLE_DERNIERE_ROUTE = "derniere-route";

function memoriserRoute(route) {
  try { localStorage.setItem(CLE_DERNIERE_ROUTE, route); } catch (e) { /* mode prive */ }
}

// Renvoie la derniere route connue, ou null si elle est absente ou n'existe plus
// (onglet supprime depuis, stockage vide, navigation privee).
function derniereRoute() {
  try {
    const r = localStorage.getItem(CLE_DERNIERE_ROUTE);
    return r && routes[r] ? r : null;
  } catch (e) {
    return null;
  }
}

async function navigate() {
  // Page de repli quand rien n'est memorise : « Mon suivi », ou chacun retrouve
  // ce qui l'attend, son planning a venir et ses resultats.
  const hash = location.hash.replace(/^#\//, "") || "mon-suivi";
  const route = routes[hash] ? hash : "mon-suivi";
  memoriserRoute(route);
  // En QUITTANT le planning (pas sur un simple remount : undo, refresh d'auth…),
  // le mode édition retombe : la vue se rouvrira toujours en lecture seule.
  if (lastRoute === "planning" && route !== "planning") resetPlanningEditMode();
  lastRoute = route;
  const ongletActif = ONGLET_POUR_ROUTE[route] || route;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.route === ongletActif;
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
  view.classList.remove("p-compact");
  // En quittant le planning, on retire sa cible d'impression (re-montée par renderPlanning).
  teardownPrintTarget();
  // Idem pour les documents officiels, livret EPCF et Dossier Professionnel
  // (re-montés à l'ouverture d'un document).
  teardownDocPrint();
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

// Raccourci « Aujourd'hui » : ouvre le planning sur la journée du jour, depuis n'importe
// quelle vue. Déjà sur le planning, le hash ne change pas → aucun `hashchange` : on
// re-rend à la main, sinon le bouton serait inerte pile là où on s'en sert le plus.
function setupTodayBtn() {
  const btn = document.getElementById("today-btn");
  btn.innerHTML = "";
  btn.appendChild(icon.today());
  btn.addEventListener("click", async () => {
    requestPlanningToday();
    if (location.hash === "#/planning") await navigate();
    else location.hash = "#/planning";
  });
}

// « Ouvrir l'app » = démarrage à froid. Un raccourci d'écran d'accueil, un favori ou un
// onglet restauré garde une vue figée dans l'URL (#/dashboard…), celle du jour où le
// raccourci a été créé : sans ce test, ce hash gagnerait toujours et on ne reviendrait
// jamais sur la page réellement quittée. On ne force PAS sur un rechargement ni sur
// précédent/suivant : tirer pour rafraîchir doit rester sur la page qu'on regarde.
function isColdStart() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    return !nav || (nav.type !== "reload" && nav.type !== "back_forward");
  } catch (e) {
    return true;
  }
}

async function bootApp() {
  hideGate();
  renderTabs();
  majBadgeNouveautes();
  setupRefreshBtn();
  setupTodayBtn();
  initChatbot();
  // Le changement de rôle change l'audience, donc le compte.
  onAdminChange(() => { renderTabs(); majBadgeNouveautes(); navigate(); });
  // Émis par la page et par la section d'Accueil après marquage.
  window.addEventListener("nouveautes-vues", majBadgeNouveautes);
  initUndoKeyboard();
  // À l'ouverture, on revient sur la page quittée la dernière fois, et à défaut
  // sur « Mon suivi ». replaceState plutôt que location.hash : pas de
  // `hashchange` (donc pas de double rendu avec le navigate() ci-dessous) et pas
  // d'entrée d'historique parasite.
  if (!location.hash || isColdStart()) {
    const cible = "#/" + (derniereRoute() || "mon-suivi");
    try { history.replaceState(null, "", cible); }
    catch (e) { location.hash = cible; }
  }
  await navigate();
}

(async () => {
  loadTheme();
  loadAccent();

  // Retour depuis le mail de reinitialisation. Ce test passe AVANT initAuth :
  // la session de recuperation rendrait isAuth() vrai et ferait demarrer l'app
  // par-dessus l'ecran de saisie. L'URL est nettoyee tout de suite pour que le
  // jeton ne traine ni dans la barre d'adresse ni dans l'historique.
  const jeton = lireJetonRecuperation(location.search);
  // Mode initial de la carte pour le demarreur normal ci-dessous : "reset-error"
  // si le jeton s'est revele invalide, sinon la valeur par defaut de showGate().
  let modeGateInitial;
  if (jeton) {
    try {
      await verifyRecoveryToken(jeton);
      history.replaceState(null, "", location.pathname);
      showGate("reset-set");
      return;   // ni initAuth ni polling : on attend la saisie.
    } catch (e) {
      console.error("Recovery token error:", e);
      history.replaceState(null, "", location.pathname);
      // Jeton invalide : l'utilisateur n'est pas authentifie du tout. On
      // rejoint le demarrage normal d'un visiteur non connecte (initAuth puis
      // la boucle de surveillance ci-dessous), sinon la connexion reussirait
      // cote serveur sans que personne n'ecoute (aucun onAuthStateChange, aucun
      // polling), et l'app ne s'ouvrirait jamais. showGate() n'est appele
      // qu'une fois, dans la branche non authentifiee, avec ce mode.
      modeGateInitial = "reset-error";
    }
  }

  await initAuth();
  if (isAuth()) {
    await bootApp();
  } else {
    // Pas connecté → gate.
    // Si l'URL contient ?code=... (callback magic link), Supabase a déjà handle ;
    // un onAuthChange va déclencher le boot automatiquement.
    showGate(modeGateInitial);
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
