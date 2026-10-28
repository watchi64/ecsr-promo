/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
import { getCurrentUser, invalidateCache, verifyRecoveryToken } from "./db.js?v=20261027a";
import { toast } from "./utils.js?v=20261027a";
import { icon } from "./icons.js?v=20261027a";
import { initAuth, onAdminChange, isAuth, monStagiaireId, getAdminEmail, getProfile, getProfileWho } from "./auth-admin.js?v=20261027a";
import { showGate, hideGate } from "./gate.js?v=20261027a";
import { exigerAcceptation } from "./legal.js?v=20261027a";
import { lireJetonRecuperation } from "./gate-rules.js?v=20261027a";
import { loadAccent } from "./accent-switcher.js?v=20261027a";
import { loadTheme } from "./theme-switcher.js?v=20261027a";
import { renderHome } from "./views/home.js?v=20261027a";
import { renderDashboard } from "./views/dashboard.js?v=20261027a";
import { renderMonSuivi } from "./views/mon-suivi.js?v=20261027a";
import { renderPlanning, teardownPrintTarget, resetPlanningEditMode, requestPlanningToday } from "./views/planning.js?v=20261027a";
import { renderPlanningEspace } from "./views/planning-espace.js?v=20261027a";
import { teardownDocPrint } from "./doc-officiel.js?v=20261027a";
import { renderNotes } from "./views/notes.js?v=20261027a";
import { renderRessources } from "./views/ressources.js?v=20261027a";
import { renderThemes } from "./views/themes.js?v=20261027a";
import { renderConfig } from "./views/config.js?v=20261027a";
import { renderCalendrier } from "./views/calendrier.js?v=20261027a";
import { initUndoKeyboard } from "./undo.js?v=20261027a";
import { renderNouveautes } from "./views/nouveautes.js?v=20261027a";
import { libellePastille } from "./nouveautes.js?v=20261027a";
import { renderCcp2 } from "./views/ccp2.js?v=20261027a";
import { renderStagiaires } from "./views/stagiaires.js?v=20261027a";
import { renderCentre, teardownCentrePrint } from "./views/centre.js?v=20261027a";
import { renderEmargement } from "./views/emargement.js?v=20261027a";
import { initBandeauEmargement, rafraichirBandeauEmargement } from "./emargement-bandeau.js?v=20261027a";
import { chargerEmargementActif, emargementActif } from "./emargement-etat.js?v=20261027a";
import { chargerNavigationV2, navigationV2Active, navigationV2Attendue, renoncerNavigationV2 } from "./nav-etat.js?v=20261027a";
import { routeVisibleV2, espaceDe, entreesNavigation, initialesDe, redirectionV2 } from "./nav-rules.js?v=20261027a";
import { monterCoquille, majEntreeActive, coquilleMontee, retirerCoquille, majNouveautesCompte } from "./nav-shell.js?v=20261027a";
import { lireAdresse, pagePersonnelle } from "./route-rules.js?v=20261027a";
import {
  peutQuitter, leverGardeSortie, majSurPlacePour, oublierMajSurPlace,
  noterAdresse, adresseCourante, remplacerAdresse, installerGardeNavigateur,
} from "./navigation.js?v=20261027a";
import { initChatbot, appliquerModuleAssistant } from "./chatbot.js?v=20261027a";
import {
  chargerModules, chargerModulesAuDemarrage, onModulesChange, surveillerPremierPlan,
  routeVisible, routeMasquee, repereMasque, nouveautesAffichables, formateurConnecte,
} from "./modules-etat.js?v=20261027a";

// ===== Tabs =====

const TABS = [
  { route: "home",       label: "Accueil",         icon: "info"      },
  // L'espace perso n'a pas d'onglet : on y accède par l'ouverture de l'app, le logo et
  // la pastille à son nom ; la route mon-suivi reste dans `routes` ci-dessous. Sur
  // #/mon-suivi, aucun onglet n'est actif : assumé. Priorités n'a plus d'onglet non
  // plus (chantier D) : bouton en haut du Planning, dont l'onglet reste allumé sur
  // #/dashboard (voir ONGLET_POUR_ROUTE).
  { route: "planning",   label: "Planning",        icon: "calendar"  },
  { route: "calendrier", label: "Calendrier",      icon: "clock"     },
  // « Cours » garde la route themes : favoris et liens existants restent valides.
  { route: "themes",     label: "Cours",           icon: "book"      },
  { route: "notes",      label: "Notes",           icon: "edu"       },
  // CCP2 apparaît quand un formateur ouvre le module pour la promo (module ccp2).
  { route: "ccp2",       label: "CCP2",            icon: "ccp2"      },
  { route: "ressources", label: "Ressources",      icon: "signpost"  },
  { route: "config",     label: "Paramètres",      icon: "settings"  },
];

// Espace de la personne connectée : « equipe » (formateur, admin) ou « stagiaire ». La coquille et la
// redirection des anciennes adresses le lisent ici ; il vient du prédicat formateurConnecte()
// (js/modules-etat.js), que lisent aussi les pages réservées de navigate() et le menu du compte :
// aucun ne peut s'écarter des autres.
function espaceCourant() {
  return espaceDe({ formateur: formateurConnecte() });
}

// Barre de navigation. Nouvelle navigation : la coquille de l'espace (js/nav-shell.js), remontée à
// chaque appel (rôle changé par « Voir en tant que », modules ouverts ou fermés) ; l'ancienne barre,
// masquée, est vidée pour ne garder aucun onglet d'un rôle précédent. Interrupteur éteint : la barre
// actuelle.
// Repli (relecture finale, mineur 8) : si la coquille lève une exception, elle est retirée, la session
// repasse à l'ancienne navigation (barre et pages) et l'erreur part en console ; rien ne remonte à
// l'appelant, donc le démarrage continue (assistant, écouteurs, premier navigate(), qui rend l'ancienne
// page). En cours de session, la page affichée garde sa forme jusqu'au rendu suivant.
function renderTabs() {
  if (navigationV2Active()) {
    try {
      document.getElementById("tabs").replaceChildren();
      const espace = espaceCourant();
      const nom = getProfileWho();
      monterCoquille({
        espace,
        entrees: entreesNavigation(espace, { routeVisible, emargementActif: emargementActif() }),
        nom,
        initiales: initialesDe(nom),
        actualiser,
      });
      marquerOngletActif();
      return;
    } catch (e) {
      console.error("Navigation : la nouvelle barre n'a pas pu se monter, retour à la barre actuelle pour la session.", e);
      retirerCoquille();
      renoncerNavigationV2();
    }
  }
  renderBarreActuelle();
}

// Barre actuelle (interrupteur éteint).
function renderBarreActuelle() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  TABS.filter((t) => (!t.visible || t.visible()) && routeVisible(t.route)).forEach((t) => {
    const a = document.createElement("a");
    a.href = "#/" + t.route;
    a.className = "tab";
    a.dataset.route = t.route;
    a.appendChild(icon[t.icon]());
    const span = document.createElement("span");
    span.textContent = t.label;
    a.appendChild(span);
    // Module fermé pour la promo : seul un formateur voit encore l'onglet, repéré.
    repereMasque(a, routeMasquee(t.route));
    nav.appendChild(a);
  });
  // La barre vient d'être reconstruite : sans ça, un redessin dû aux modules la
  // laisserait sans onglet allumé.
  marquerOngletActif();
}

// Allume l'entrée de la page affichée : dans la coquille quand elle est montée, sinon dans la
// barre actuelle.
function marquerOngletActif() {
  if (coquilleMontee()) {
    majEntreeActive(lastRoute);
    return;
  }
  marquerOngletActuel();
}

// Allume l'onglet de la route affichée (ou celui qui l'héberge, voir ONGLET_POUR_ROUTE).
function marquerOngletActuel() {
  const ongletActif = ONGLET_POUR_ROUTE[lastRoute] || lastRoute;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.route === ongletActif;
    t.classList.toggle("active", active);
    if (active) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
}

// Pastille de nouveautés sur l'onglet Accueil. Elle se modifie sur place, sur
// l'onglet existant : renderTabs() reconstruit la barre sans elle, donc cette
// fonction se rappelle après chaque renderTabs().
// Nouvelle navigation : la même pastille, sur les boutons du compte de la coquille (js/nav-shell.js).
function majBadgeNouveautes() {
  if (coquilleMontee()) {
    majNouveautesCompte(libellePastille(nouveautesAffichables().neuves.size));
    return;
  }
  const tab = document.querySelector('.tab[data-route="home"]');
  if (!tab) return;
  // Nouveautés écrites et annonces d'ouverture de module, pas encore lues.
  const texte = libellePastille(nouveautesAffichables().neuves.size);
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
  // Nouvelle navigation : Planning regroupe Semaine, Dates clés et Priorités en sous-onglets, et
  // la Semaine porte le bouton « Aujourd'hui » de l'ancienne barre (ruling R29), au même geste.
  // Décidé au rendu (la décision est connue au démarrage, après la construction de la table).
  planning:   (view) => (navigationV2Active()
    ? renderPlanningEspace(view, { aujourdhui: allerAujourdhui })
    : renderPlanning(view)),
  calendrier: renderCalendrier,
  themes:     renderThemes,
  notes:      renderNotes,
  ccp2:       renderCcp2,
  stagiaires: renderStagiaires,
  centre:     renderCentre,
  emargement: renderEmargement,
  ressources: renderRessources,
  config:     renderConfig,
  nouveautes: renderNouveautes,
};

// Routes sans onglet propre qui doivent quand même allumer un onglet. On arrive
// sur #/nouveautes depuis Accueil, et sur #/dashboard (Priorités) depuis le
// Planning : laisser la barre sans onglet actif donnerait l'impression d'être
// sorti de l'app.
const ONGLET_POUR_ROUTE = { nouveautes: "home", dashboard: "planning", centre: "home", emargement: "planning" };

let lastRoute = null;

// Une page est-elle une destination pour la personne connectée ? Sous la nouvelle navigation,
// une page à sous-onglets l'est dès que l'un d'eux l'est (Cours avec ses seuls Documents tant
// que les cours sont fermés, voir routeVisibleV2) ; avec l'ancienne, la règle de toujours.
function routeOuverte(route) {
  return navigationV2Active() ? routeVisibleV2(route, routeVisible) : routeVisible(route);
}

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
    // Une page dont le module est fermé pour la promo n'est pas une destination :
    // repli silencieux, la dernière page n'est qu'une commodité.
    return r && routes[r] && routeOuverte(r) ? r : null;
  } catch (e) {
    return null;
  }
}

// Nouvelle navigation : une ancienne adresse cède la place à sa nouvelle adresse avant que
// navigate() n'en lise la route. Y arrive toute adresse que navigate() lit : la navigation dans
// l'app (liens, lien d'une nouveauté) ; une adresse saisie, ou un favori ouvert, dans l'onglet où
// l'app est déjà ouverte (`hashchange`) ; un rechargement et « Précédent » ou « Suivant », qui
// gardent l'adresse (voir isColdStart) ; à l'ouverture à froid, la dernière page mémorisée
// (`derniere-route`), car l'app ignore alors l'adresse demandée (favori, raccourci d'écran
// d'accueil : voir bootApp). Appelée APRÈS la garde de saisie : un refus n'écrit rien. Le
// sous-onglet visé s'écrit d'abord dans la mémoire de renderSubTabs, que la page lit à son rendu ;
// un sous-onglet fermé pour la promo n'y change rien, renderSubTabs ouvre alors le premier
// sous-onglet visible de la page.
// replaceState ne déclenche aucun `hashchange` et n'ajoute aucune étape d'historique : un seul
// rendu, et « Précédent » quitte la page redirigée. Une seule redirection par appel : aucune cible
// n'est elle-même une ancienne adresse (tests/nav-rules.test.mjs).
function suivreRedirectionV2() {
  if (!navigationV2Active()) return;
  const cible = redirectionV2(lireAdresse(location.hash), espaceCourant());
  if (!cible) return;
  if (cible.sousOnglet) {
    try { localStorage.setItem(cible.sousOnglet.cle, cible.sousOnglet.valeur); } catch (e) { /* mode privé */ }
  }
  try { history.replaceState(null, "", cible.hash); } catch (e) { /* ignore */ }
}

async function navigate({ force = false } = {}) {
  // Garde de saisie (chantier D, lot 2) : une grille EPCF commencée n'est pas
  // abandonnée sans accord. Refus : l'adresse affichée est remise, sans rendu.
  if (!peutQuitter()) { remplacerAdresse(adresseCourante()); return; }
  leverGardeSortie();
  // Nouvelle navigation : les quatre anciennes adresses mènent à leur nouvel emplacement. Après
  // la garde, donc suivre une redirection demande la même confirmation que n'importe quel départ.
  suivreRedirectionV2();
  // Adresses à segments (#/stagiaires/12/epcf) : le premier choisit la page, la
  // page lit le reste. Page de repli : « Mon suivi », où chacun retrouve ce qui
  // l'attend, son planning à venir et ses résultats.
  let route = lireAdresse(location.hash).route;
  if (!routes[route]) route = "mon-suivi";
  // Module fermé pour la promo (lien, adresse saisie, nouveauté ancienne) : un
  // stagiaire est ramené sur Mon suivi, avec un mot d'explication.
  if (!routeOuverte(route)) {
    toast("Cette partie n'est pas encore ouverte pour ta promo.", "info", 3500);
    try { history.replaceState(null, "", "#/mon-suivi"); } catch (e) { /* ignore */ }
    route = "mon-suivi";
  }
  // Page « à soi » (chantier D, lot 2) : un formateur sans profil stagiaire n'a pas
  // de Mon espace, il a la page Stagiaires ; un stagiaire n'a pas la page Stagiaires.
  const formateur = formateurConnecte();
  if (route === "mon-suivi" && pagePersonnelle({ formateur, stagiaireId: monStagiaireId() }) === "stagiaires") {
    try { history.replaceState(null, "", "#/stagiaires"); } catch (e) { /* ignore */ }
    route = "stagiaires";
  } else if ((route === "stagiaires" || route === "centre" || route === "emargement") && !formateur) {
    // Page Émargement (spec 2026-10-23) : formateurs seulement ; un stagiaire signe par
    // le bandeau, sur n'importe quelle page.
    try { history.replaceState(null, "", "#/mon-suivi"); } catch (e) { /* ignore */ }
    route = "mon-suivi";
  } else if (route === "emargement" && !emargementActif()) {
    // Interrupteur éteint pour la promo (réglage du fondateur dans Paramètres).
    toast("L'émargement n'est pas activé pour cette promo.", "info", 3500);
    try { history.replaceState(null, "", "#/home"); } catch (e) { /* ignore */ }
    route = "home";
  }
  memoriserRoute(route);
  noterAdresse(location.hash);
  // Même page, autre fiche ou autre partie : la page se met à jour elle-même.
  // force : Actualiser, changement de rôle, Réessayer veulent un vrai rendu.
  const surPlace = !force && route === lastRoute ? majSurPlacePour(route) : null;
  if (surPlace) {
    try { await surPlace(lireAdresse(location.hash)); return; }
    catch (e) { console.error(e); }   // repli : rendu complet ci-dessous
  }
  oublierMajSurPlace();
  // En QUITTANT le planning (pas sur un simple remount : undo, refresh d'auth…),
  // le mode édition retombe : la vue se rouvrira toujours en lecture seule.
  if (lastRoute === "planning" && route !== "planning") resetPlanningEditMode();
  lastRoute = route;
  marquerOngletActif();
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
  // Et pour le tableau de bord du centre (format A4 portrait injecté le temps d'imprimer).
  teardownCentrePrint();
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
    retry.addEventListener("click", () => navigate({ force: true }));
    box.appendChild(h);
    box.appendChild(sub);
    box.appendChild(retry);
    view.appendChild(box);
    toast(isTimeout ? "Connexion trop lente, réessaie" : (e?.message || String(e)), "error");
  }
}

window.addEventListener("hashchange", () => navigate());

// Pose « Chargement » dans la vue, le temps d'une attente (lecture des modules) : sans cela,
// l'écran resterait vide au démarrage, ou figé sur l'ancienne page après « Actualiser ».
// La vue suivante, rendue par navigate(), le remplace.
function afficherChargement() {
  const chargement = document.createElement("div");
  chargement.className = "loading";
  chargement.textContent = "Chargement";
  document.getElementById("view").replaceChildren(chargement);
}

// « Actualiser » : relit les données et rejoue la page. Bouton de l'ancienne barre, et ligne du menu
// du compte sous la nouvelle navigation (le seul moyen de relire les données dans l'app installée
// sur iPhone, qui n'a pas de bouton de rechargement).
async function actualiser() {
  // Saisie en cours : pas de rechargement sans accord.
  if (!peutQuitter()) return;
  // Force le rechargement réel : vide le cache des données de référence
  invalidateCache();
  afficherChargement();
  // Un formateur a pu ouvrir un module depuis le dernier chargement.
  await chargerModules();
  navigate({ force: true });
}

function setupRefreshBtn() {
  const btn = document.getElementById("refresh-btn");
  btn.innerHTML = "";
  btn.appendChild(icon.refresh());
  btn.addEventListener("click", actualiser);
}

// Raccourci « Aujourd'hui » : ouvre le planning sur la journée du jour, depuis n'importe
// quelle vue. Déjà sur le planning, le hash ne change pas → aucun `hashchange` : on
// re-rend à la main, sinon le bouton serait inerte pile là où on s'en sert le plus.
// Bouton de l'ancienne barre ; sous la nouvelle navigation, bouton du haut de Planning > Semaine
// (ruling R29, js/views/planning.js), toujours ce geste-ci.
async function allerAujourdhui() {
  if (!peutQuitter()) return;
  requestPlanningToday();
  if (location.hash === "#/planning") await navigate({ force: true });
  else location.hash = "#/planning";
}

function setupTodayBtn() {
  const btn = document.getElementById("today-btn");
  btn.innerHTML = "";
  btn.appendChild(icon.today());
  btn.addEventListener("click", allerAujourdhui);
}

// Le raccourci « Aujourd'hui » mène au planning : il suit donc le module Planning.
// style.display plutôt que l'attribut hidden, que la règle .ghost-btn écraserait.
function majBoutonAujourdhui() {
  const btn = document.getElementById("today-btn");
  if (btn) btn.style.display = routeVisible("planning") ? "" : "none";
}

// Ce qui, hors de la barre d'onglets, dépend des modules : bouton du haut et bulle.
function majPresenceModules() {
  majBoutonAujourdhui();
  appliquerModuleAssistant();
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
  // Ruling R17 : quand la coquille est attendue (la promo l'avait la dernière fois sur cet appareil, ou
  // l'aperçu du fondateur), l'ancienne barre attend la décision sans se peindre (css/navigation.css) ;
  // posé avant que l'app ne s'affiche, levé dès la première barre dessinée, quelle qu'elle soit.
  if (navigationV2Attendue()) document.body.dataset.navAttente = "";
  try {
    hideGate();
    // L'état des modules décide des onglets visibles : il est lu avant de dessiner la barre.
    // La lecture est bornée (chargerModulesAuDemarrage : copie de l'appareil au-delà de
    // 3,5 s, la vraie réponse redessine la barre à son arrivée) et la vue dit « Chargement ».
    afficherChargement();
    // Conditions d'utilisation : rien ne s'ouvre tant que la version en vigueur n'est pas
    // acceptée (fenêtre bloquante ; laisse passer si la lecture échoue). Pas pour les
    // formateurs (décision du 13/10) : le texte s'adresse aux stagiaires, et un formateur
    // salarié du centre n'a pas à accepter en son nom les conditions de l'éditeur ; ce sera
    // couvert par le contrat avec le centre. Vrai rôle, pas l'aperçu « Voir en tant que ».
    if (getProfile()?.role !== "prof") await exigerAcceptation(getAdminEmail());
    // Interrupteurs de l'émargement et de la nouvelle navigation (propres à la promo) lus en même
    // temps que les modules. La navigation est décidée ici, une fois pour la session, avant le
    // premier rendu (aperçu du fondateur compris).
    await Promise.all([chargerModulesAuDemarrage(), chargerEmargementActif(), chargerNavigationV2()]);
    renderTabs();
  } finally {
    // La barre de la session est posée (coquille, ou ancienne barre si la décision est « éteint ») : plus
    // rien n'attend. Si quoi que ce soit échoue en chemin, l'ancienne barre revient aussi : jamais une
    // page sans barre.
    delete document.body.dataset.navAttente;
  }
  majBadgeNouveautes();
  setupRefreshBtn();
  setupTodayBtn();
  initChatbot();
  majPresenceModules();
  // Le changement de rôle change l'audience, donc le compte, et ce qu'on voit des modules.
  onAdminChange(() => { renderTabs(); majBadgeNouveautes(); majPresenceModules(); navigate({ force: true }); rafraichirBandeauEmargement(); });
  // Un module ouvert ou fermé (réglage d'un formateur, relecture au premier plan) :
  // barre, pastille et raccourcis suivent. La vue n'est rejouée que si elle vient
  // d'être fermée, pour ne pas détruire une saisie en cours.
  onModulesChange(() => {
    renderTabs();
    majBadgeNouveautes();
    majPresenceModules();
    if (lastRoute && !routeOuverte(lastRoute)) navigate({ force: true });
  });
  surveillerPremierPlan();
  // Émis par la page et par la section d'Accueil après marquage.
  window.addEventListener("nouveautes-vues", majBadgeNouveautes);
  initUndoKeyboard();
  installerGardeNavigateur();
  // Bandeau d'émargement (signer, ou rappel d'une feuille ouverte) : relu seul ensuite.
  initBandeauEmargement();
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
