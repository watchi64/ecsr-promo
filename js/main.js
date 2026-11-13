/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
// En premier : le journal des erreurs (signalement de problème) capte celles des modules qui suivent.
import "./journal-erreurs.js?v=20261113b";
import {
  getCurrentUser, invalidateCache, verifyRecoveryToken, rechargerApresEnregistrements, basculeLancee, getPromoCourante, getMesPromos,
  habillageParDefaut,
} from "./db.js?v=20261113b";
import { toast, annoncer, el } from "./utils.js?v=20261113b";
import {
  initAuth, ouvertureInterrompueParLaConnexion, onAdminChange, isAuth, isAdmin, monStagiaireId, getAdminEmail,
  getProfile, getProfileWho, fondateurHorsApercu, getProfileNom, selonPublic,
} from "./auth-admin.js?v=20261113b";
import { getEspace, getCentre, seDeconnecter } from "./auth-admin.js?v=20261113b";
import {
  ACCUEIL_ESPACE, routeDansLEspace, phraseHorsEspace, cleDerniereRoute, espaceDePilotage, promosDuCentre, defautsHabillage,
} from "./espaces-rules.js?v=20261113b";
import { chargerEtatSignalements } from "./signalement-etat.js?v=20261113b";
import { messageDemarrage } from "./signalement-rules.js?v=20261113b";
import { showGate, hideGate } from "./gate.js?v=20261113b";
import { exigerAcceptation } from "./legal.js?v=20261113b";
import { lireJetonRecuperation } from "./gate-rules.js?v=20261113b";
import { habillageAuDemarrage } from "./habillage.js?v=20261113b";
import { renderHome } from "./views/home.js?v=20261113b";
import { renderDashboard } from "./views/dashboard.js?v=20261113b";
import { renderMonSuivi } from "./views/mon-suivi.js?v=20261113b";
import { teardownPrintTarget, resetPlanningEditMode, requestPlanningToday } from "./views/planning.js?v=20261113b";
import { renderPlanningEspace } from "./views/planning-espace.js?v=20261113b";
import { teardownDocPrint } from "./doc-officiel.js?v=20261113b";
import { renderNotes } from "./views/notes.js?v=20261113b";
import { renderVueCentre, renderEmargementCentre, renderNotesCentre } from "./views/direction-centre.js?v=20261113b";
import { renderPromosCentre } from "./views/direction-promos.js?v=20261113b";
import { renderStagiairesCentre } from "./views/direction-stagiaires.js?v=20261113b";
import { renderEquipeCentre } from "./views/direction-equipe.js?v=20261113b";
import { renderReseau } from "./views/siege-reseau.js?v=20261113b";
import { renderDirections } from "./views/siege-directions.js?v=20261113b";
import { renderRessources } from "./views/ressources.js?v=20261113b";
import { renderThemes } from "./views/themes.js?v=20261113b";
import { renderConfig, renderPreferences } from "./views/config.js?v=20261113b";
import { renderReglagesCentre, renderReglagesReseau } from "./views/reglages-habillage.js?v=20261113b";
import { renderCalendrier } from "./views/calendrier.js?v=20261113b";
import { initUndoKeyboard } from "./undo.js?v=20261113b";
import { renderNouveautes } from "./views/nouveautes.js?v=20261113b";
import { libellePastille } from "./nouveautes.js?v=20261113b";
import { renderCcp2 } from "./views/ccp2.js?v=20261113b";
import { renderStagiaires } from "./views/stagiaires.js?v=20261113b";
import { renderCentre, teardownCentrePrint } from "./views/centre.js?v=20261113b";
import { teardownQualiopiPrint } from "./qualiopi-impression.js?v=20261113b";
import { renderEmargement } from "./views/emargement.js?v=20261113b";
import { renderProblemes } from "./views/problemes.js?v=20261113b";
import { initBandeauEmargement, rafraichirBandeauEmargement } from "./emargement-bandeau.js?v=20261113b";
import { chargerEmargementActif, emargementActif, chargerEmargementCentre, emargementDansLeCentre } from "./emargement-etat.js?v=20261113b";
import { routeVisibleV2, entreesNavigation, initialesDe, redirectionV2, routeApresRedirection } from "./nav-rules.js?v=20261113b";
import { monterCoquille, majEntreeActive, coquilleMontee, majNouveautesCompte } from "./nav-shell.js?v=20261113b";
import { lireAdresse, pagePersonnelle, cleQuestionnaire } from "./route-rules.js?v=20261113b";
import { ouvrirQuestionnaireDuLien } from "./questionnaire.js?v=20261113b";
import {
  peutQuitter, leverGardeSortie, majSurPlacePour, oublierMajSurPlace,
  noterAdresse, adresseCourante, remplacerAdresse, installerGardeNavigateur,
} from "./navigation.js?v=20261113b";
import { initChatbot, appliquerModuleAssistant } from "./chatbot.js?v=20261113b";
import {
  chargerModules, chargerModulesAuDemarrage, onModulesChange, surveillerPremierPlan,
  routeVisible, nouveautesAffichables, formateurConnecte,
} from "./modules-etat.js?v=20261113b";

// Espace de la session : « stagiaire », « equipe » (formateur), « direction » ou « siege » (lot 5). Fixé à la porte
// (js/auth-admin.js, getEspace) ; la coquille, la redirection des anciennes adresses, les routes permises et la mémoire de la
// dernière page le lisent ici.
function espaceCourant() {
  return getEspace();
}

// Vrai quand la coquille n'a pas pu se monter : il n'y a pas d'autre barre, les pages laissent la place à un écran de
// repli (ecranSansNavigation) jusqu'à ce qu'un montage réussisse.
let navigationEnPanne = false;

// Barre de navigation : la coquille de l'espace (js/nav-shell.js), remontée à chaque appel (rôle changé par
// « Voir en tant que », modules ouverts ou fermés).
// Repli : si la coquille lève une exception, ce qu'elle a pu poser est retiré, l'erreur part en console et la page
// laisse la place à un écran minimal (Recharger, Se déconnecter) ; rien ne remonte à l'appelant, donc le démarrage
// continue. Rend vrai quand un montage réussit après une panne : l'appelant rejoue alors la page (navigate), que l'écran
// de repli remplaçait.
function renderTabs() {
  try {
    const espace = espaceCourant();
    const nom = getProfileNom();
    monterCoquille({
      espace,
      // Lot 5 : Émargement du centre s'allume quand une promo du centre a l'interrupteur (emargementDansLeCentre, lu au
      // démarrage) ; Réglages du centre et Réglages du réseau ont leur page (js/views/reglages-habillage.js) : leur entrée est là.
      entrees: entreesNavigation(espace, {
        routeVisible, emargementActif: emargementActif(), formateur: isAdmin(), emargementDansLeCentre: emargementDansLeCentre(),
        reglagesEspace: espaceDePilotage(espace),
      }),
      nom,
      initiales: initialesDe(nom),
      actualiser,
    });
    const reprise = navigationEnPanne;
    navigationEnPanne = false;
    marquerOngletActif();
    return reprise;
  } catch (e) {
    console.error("Navigation : la barre n'a pas pu se monter.", e);
    document.querySelectorAll("[data-nav-coquille]").forEach((r) => r.remove());
    // Plus de coquille : ses marques sur le corps de page partent aussi (sinon le repli garderait la marge de la barre).
    for (const cle of ["nav", "barre", "espace"]) delete document.body.dataset[cle];
    navigationEnPanne = true;
    ecranSansNavigation();
    return false;
  }
}

// Écran de repli, quand la barre n'a pas pu se monter : une phrase et deux gestes (css/navigation.css, .nav-repli),
// au lieu d'une page sans navigation.
function ecranSansNavigation() {
  const view = document.getElementById("view");
  if (!view) return;
  view.replaceChildren(el("div", { class: "nav-repli", role: "alert" },
    el("h1", { class: "nav-repli-titre" }, "L'app n'a pas pu s'afficher"),
    el("p", {}, "Recharger la page ; si le problème revient, se déconnecter puis se reconnecter."),
    el("div", { class: "nav-repli-gestes" },
      el("button", { class: "btn primary", type: "button", onClick: () => rechargerApresEnregistrements() }, "Recharger"),
      el("button", { class: "btn", type: "button", onClick: () => seDeconnecter() }, "Se déconnecter"))));
}

// Allume l'entrée de la page affichée dans la coquille (sans coquille montée, rien).
function marquerOngletActif() {
  majEntreeActive(lastRoute);
}

// Nouveautés non lues : un point sans chiffre, sur les boutons du compte de la coquille (js/nav-shell.js) ; le nombre est
// sur la ligne « Nouveautés » du menu du compte (js/menu-compte.js).
function majBadgeNouveautes() {
  if (coquilleMontee()) majNouveautesCompte(libellePastille(nouveautesAffichables().neuves.size));
}

// ===== Router =====

// Accueil de la direction : la Vue d'ensemble du centre (js/views/direction-centre.js, qui dit aussi un centre sans promo, D6) ;
// formateur : les Indicateurs de la promo affichée.
function rendreCentre(view) {
  if (espaceCourant() === "direction") return renderVueCentre(view);
  return renderCentre(view);
}

// Page Qualiopi, chargée à la demande. Le fondateur seul l'ouvre (garde de navigate) : ni la page ni ses modules de calcul (plus
// de 100 Ko) ne partent avec l'app, et une erreur dans l'un d'eux ne peut pas casser le démarrage de tous les comptes. Seul
// js/qualiopi-impression.js, tout petit, est chargé d'avance : navigate() en appelle le nettoyage à chaque page.
// Un import() qui échoue reste en échec pour la même adresse tant que la page n'est pas rechargée (js/cours-blocs.js), et c'est
// vrai de chacun des modules de la page, qu'une reprise sous une autre adresse ne redemande pas : « Réessayer » n'y changerait
// rien. La boîte d'erreur propose donc de recharger, ce qui suffit pour une page du fondateur.
function boiteErreurQualiopi() {
  return el("div", { class: "centre-erreur qualiopi-erreur", role: "alert" },
    el("p", {}, "La page Qualiopi n'a pas pu se charger. Vérifiez votre connexion, puis rechargez la page."),
    el("button", { class: "btn small", type: "button", onClick: () => rechargerApresEnregistrements() }, "Recharger la page"));
}

async function rendreQualiopi(view) {
  afficherChargement();
  let page;
  try {
    page = await import("./views/qualiopi.js?v=20261113b");
  } catch (e) {
    console.error(e);
    if (lastRoute === "qualiopi") view.replaceChildren(boiteErreurQualiopi());
    return;
  }
  // La page a pu être quittée pendant le chargement du module : elle n'écrit pas par-dessus celle qui est affichée.
  if (lastRoute === "qualiopi") await page.renderQualiopi(view);
}

const routes = {
  home:       renderHome,
  dashboard:  renderDashboard,
  "mon-suivi": renderMonSuivi,
  // Planning regroupe Semaine, Dates clés et Priorités en sous-onglets, et la Semaine porte le retour au jour
  // (ruling R29, allerAujourdhui).
  planning:   (view) => renderPlanningEspace(view, { aujourdhui: allerAujourdhui }),
  calendrier: renderCalendrier,
  themes:     renderThemes,
  notes:      (view) => (espaceCourant() === "direction" ? renderNotesCentre(view) : renderNotes(view)),
  ccp2:       renderCcp2,
  stagiaires: (view) => (espaceCourant() === "direction" ? renderStagiairesCentre(view) : renderStagiaires(view)),
  centre:     rendreCentre,
  qualiopi:   rendreQualiopi,   // chargée à la demande, voir plus haut
  emargement: (view) => (espaceCourant() === "direction" ? renderEmargementCentre(view) : renderEmargement(view)),
  ressources: renderRessources,
  // Lot 5 : « Réglages » est la page de l'équipe ; la direction y trouve les Réglages du centre, le siège ceux du réseau.
  config:     (view) => (espaceCourant() === "direction" ? renderReglagesCentre(view)
    : espaceCourant() === "siege" ? renderReglagesReseau(view) : renderConfig(view)),
  // « Mes préférences », ouverte par le menu du compte.
  preferences: renderPreferences,
  nouveautes: renderNouveautes,
  problemes:  renderProblemes,
  // Lot 5 : direction (promos, equipe) et siège (reseau, directions). Hors de ces espaces, navigate() les refuse (routeDansLEspace).
  promos:     renderPromosCentre,
  equipe:     renderEquipeCentre,
  reseau:     renderReseau,
  directions: renderDirections,
};

let lastRoute = null;

// Une page est-elle une destination pour la personne connectée ? Une page à sous-onglets l'est dès
// que l'un d'eux l'est (Cours avec ses seuls Documents tant que les cours sont fermés, voir
// routeVisibleV2).
function routeOuverte(route) {
  return routeVisibleV2(route, routeVisible);
}

// Derniere page visitee, pour y revenir au prochain demarrage. Le sous-onglet,
// lui, se souvient deja tout seul (voir storageKey dans js/subtabs.js) : rendre
// la route suffit a retomber exactement la ou on etait. Une memoire par espace
// (lot 5, D16 : cleDerniereRoute), celle de main pour le stagiaire et le formateur.
function memoriserRoute(route) {
  try { localStorage.setItem(cleDerniereRoute(espaceCourant()), route); } catch (e) { /* mode prive */ }
}

// Renvoie la derniere route connue, ou null si elle est absente ou n'existe plus
// (onglet supprime depuis, stockage vide, navigation privee).
// Une mémoire d'avant le 10/11 peut nommer une ancienne adresse (calendrier, dashboard, ressources ; config chez un
// stagiaire) : elle se juge sur la page où sa redirection mène (routeApresRedirection), et c'est elle qui est rendue,
// pour que navigate() suive la redirection et ouvre le bon sous-onglet.
function derniereRoute() {
  try {
    const espace = espaceCourant();
    const r = localStorage.getItem(cleDerniereRoute(espace));
    if (!r || !routes[r]) return null;
    const cible = routeApresRedirection(r, espace);
    // Une page dont le module est fermé pour la promo n'est pas une destination :
    // repli silencieux, la dernière page n'est qu'une commodité. Une page hors de l'espace non plus (D16 : l'accueil, sans phrase).
    return routes[cible] && routeOuverte(cible) && routeDansLEspace(espace, cible) ? r : null;
  } catch (e) {
    return null;
  }
}

// Une ancienne adresse cède la place à sa nouvelle adresse avant que navigate() n'en lise la route.
// Y arrive toute adresse que navigate() lit : la navigation dans l'app (liens, lien d'une nouveauté) ; une adresse saisie, ou un favori ouvert, dans l'onglet où
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
// Un stagiaire qui ouvre Réglages (#/config) arrive sur Mes préférences (#/preferences, lot 2A).
function suivreRedirection() {
  const adresse = lireAdresse(location.hash);
  const cible = redirectionV2(adresse, espaceCourant());
  if (!cible) return;
  if (cible.sousOnglet) {
    try { localStorage.setItem(cible.sousOnglet.cle, cible.sousOnglet.valeur); } catch (e) { /* mode privé */ }
  }
  try { history.replaceState(null, "", cible.hash); } catch (e) { /* ignore */ }
}

async function navigate({ force = false } = {}) {
  // Garde de saisie (chantier D, lot 2) : une grille EPCF commencée n'est pas
  // abandonnée sans accord. La question se pose dans l'app : en attendant, l'adresse affichée est remise, sans rendu ;
  // un accord rejoue la navigation vers l'adresse voulue.
  const voulue = location.hash;
  const reprendre = () => { if (location.hash !== voulue) location.hash = voulue; else navigate({ force }); };
  if (!peutQuitter(reprendre)) { remplacerAdresse(adresseCourante()); return; }
  leverGardeSortie();
  // La barre n'a pas pu se monter : l'écran de repli reste, aucune page ne se rend sans navigation.
  if (navigationEnPanne) { ecranSansNavigation(); return; }
  // Les anciennes adresses mènent à leur nouvel emplacement, et Réglages du stagiaire à Mes préférences.
  // Après la garde, donc suivre une redirection demande la même confirmation que n'importe quel départ.
  suivreRedirection();
  // Espace de la session (lot 5) : la direction et le siège n'ont ni Mon suivi ni Accueil du formateur ; leur page de repli est
  // leur accueil (#/centre, #/reseau), où « home » mène aussi. Le stagiaire et le formateur gardent les replis de main.
  const espace = espaceCourant();
  const pilotage = espaceDePilotage(espace);
  const accueil = ACCUEIL_ESPACE[espace] || "home";
  const repli = pilotage ? accueil : "mon-suivi";
  const allerA = (r) => {
    try { history.replaceState(null, "", "#/" + r); } catch (e) { /* ignore */ }
    return r;
  };
  // Adresses à segments (#/stagiaires/12/epcf) : le premier choisit la page, la
  // page lit le reste. Page de repli : « Mon suivi », où chacun retrouve ce qui
  // l'attend, son planning à venir et ses résultats (direction et siège : leur accueil).
  let route = lireAdresse(location.hash).route;
  // Lien direct vers un questionnaire anonyme (#/questionnaire/<clé>, envoyé par WhatsApp) : l'Accueil s'affiche,
  // puis la fenêtre du questionnaire s'ouvre par-dessus si la personne l'a à remplir, sinon un mot doux. L'adresse
  // devient #/home : un rechargement ne rouvre pas la fenêtre.
  let lienQuestionnaire = null;
  if (route === "questionnaire") {
    lienQuestionnaire = cleQuestionnaire(location.hash) || "";
    try { history.replaceState(null, "", "#/home"); } catch (e) { /* ignore */ }
    route = "home";
  }
  if (pilotage && (route === "home" || !routes[route])) route = allerA(accueil);
  if (!routes[route]) route = "mon-suivi";
  // Page hors de l'espace (une adresse saisie, un favori, un lien d'un autre espace) : l'accueil de l'espace, avec la phrase qui le
  // dit (lot 5, jamais en silence).
  if (!routeDansLEspace(espace, route)) {
    toast(phraseHorsEspace(espace), "info", 3500);
    route = allerA(accueil);
  }
  // Module fermé pour la promo (lien, adresse saisie, nouveauté ancienne) : un
  // stagiaire est ramené sur Mon suivi, avec un mot d'explication.
  if (!routeOuverte(route)) {
    toast("Cette partie n'est pas encore ouverte pour ta promo.", "info", 3500);
    route = allerA(repli);
  }
  // Problèmes signalés (spec 2026-10-28) : le fondateur seulement, hors aperçu « Voir en tant que ».
  // Les autres retombent sur leur page habituelle (la garde de la page à soi suit).
  if (route === "problemes" && !fondateurHorsApercu()) {
    route = allerA(repli);
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
    route = allerA(repli);
  } else if (route === "emargement" && !(espace === "direction" ? emargementDansLeCentre() : emargementActif())) {
    // Interrupteur éteint pour la promo (réglage du fondateur dans Paramètres) ; en direction, pour toutes les promos du centre.
    toast(espace === "direction"
      ? "L'émargement n'est activé pour aucune promo du centre. Seul le fondateur peut l'allumer, promo par promo."
      : "L'émargement n'est pas activé pour cette promo. Seul le fondateur peut l'allumer.", "info", 8000);
    route = allerA(accueil);
  } else if (route === "qualiopi" && !fondateurHorsApercu()) {
    // Page Qualiopi (spec 2026-10-28, § 6.3) : le fondateur seul, avant la refonte du lot 5. Aucune entrée de barre ne la
    // montre aux autres ; une adresse saisie ou un favori les ramène à l'accueil, sans un mot. (Hors des espaces de la direction
    // et du siège, qui l'ont déjà refusée plus haut : routeDansLEspace.)
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
  // Et pour la page Qualiopi (dossier imprimable, format de page et titre du document, le temps d'imprimer).
  teardownQualiopiPrint();
  try {
    await routes[route](view);
    // Non attendu (l'Accueil est déjà là) ; une lecture qui lève ne laisse pas de rejet non géré.
    if (lienQuestionnaire !== null) ouvrirQuestionnaireDuLien(lienQuestionnaire).catch((e) => console.warn("[questionnaire]", e));
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
      ? selonPublic("Le serveur n'a pas répondu à temps. Vérifie ta connexion et réessaie.",
        "Le serveur n'a pas répondu à temps. Vérifiez votre connexion et réessayez.")
      : "Détail : " + (e?.message || e);
    const retry = document.createElement("button");
    retry.className = "btn primary";
    retry.textContent = "Réessayer";
    retry.addEventListener("click", () => navigate({ force: true }));
    box.appendChild(h);
    box.appendChild(sub);
    box.appendChild(retry);
    view.appendChild(box);
    toast(isTimeout ? selonPublic("Connexion trop lente, réessaie", "Connexion trop lente, réessayez") : (e?.message || String(e)), "error");
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

// « Actualiser » : relit les données et rejoue la page. Ligne du menu du compte (le seul moyen de relire
// les données dans l'app installée sur iPhone, qui n'a pas de bouton de rechargement).
async function actualiser() {
  // Saisie en cours : pas de rechargement sans accord (un accord relance « Actualiser »).
  if (!peutQuitter(actualiser)) return;
  // Force le rechargement réel : vide le cache des données de référence
  invalidateCache();
  afficherChargement();
  // Un formateur a pu ouvrir un module depuis le dernier chargement.
  await chargerModules();
  chargerEtatSignalements();
  navigate({ force: true });
}

// Retour au jour : ouvre le planning sur la journée du jour. Déjà sur le planning, le hash ne change
// pas, donc aucun `hashchange` : on re-rend à la main, sinon le bouton serait inerte pile là où on s'en
// sert le plus. Bouton de Planning > Semaine (ruling R29, js/views/planning.js).
async function allerAujourdhui() {
  if (!peutQuitter(allerAujourdhui)) return;
  requestPlanningToday();
  if (location.hash === "#/planning") await navigate({ force: true });
  else location.hash = "#/planning";
}

// Ce qui, hors de la barre, dépend des modules : le panneau de l'assistant.
function majPresenceModules() {
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

// Les défauts d'habillage du compte (centre de la promo affichée ou premier centre de ses affectations, réseau), puis l'accord de
// l'habillage avec le compte (js/habillage.js).
async function habillageDuDemarrage() {
  let defauts = defautsHabillage(null);
  try {
    defauts = defautsHabillage(await habillageParDefaut());
  } catch (e) {
    console.warn("Habillage : défauts du centre et du réseau illisibles, ils sont ignorés", e);
  }
  return habillageAuDemarrage({ email: getAdminEmail(), compte: getProfile()?.habillage ?? null, ...defauts });
}

async function bootApp() {
  // Habillage : l'avant-peinture a déjà posé celui de l'appareil ; on le met d'accord avec le compte.
  // Lu ici parce que le profil est connu (initAuth est passé) et pas plus tôt. `getProfile()` est le
  // vrai profil, jamais celui de « Voir en tant que ». Non attendu : l'app ne patiente pas pour une
  // couleur, et un échec d'enregistrement n'a pas à l'arrêter. Lot 5 : une fois la porte passée, l'habillage par défaut du centre
  // et du réseau est lu en base (habillage_par_defaut) et passé avec le compte ; une lecture qui échoue (base pas encore migrée,
  // réseau coupé) donne des défauts nuls, sans message, et l'habillage de l'appareil, déjà posé par l'avant-peinture, reste en place.
  habillageDuDemarrage()
    .catch((e) => console.warn("Habillage : démarrage impossible", e));
  hideGate();
  // L'état des modules décide des entrées visibles : il est lu avant de dessiner la barre.
  // La lecture est bornée (chargerModulesAuDemarrage : copie de l'appareil au-delà de
  // 3,5 s, la vraie réponse redessine la barre à son arrivée) et la vue dit « Chargement ».
  afficherChargement();
  // Conditions d'utilisation : rien ne s'ouvre tant que la version en vigueur n'est pas
  // acceptée (fenêtre bloquante ; laisse passer si la lecture échoue). Pas pour les
  // formateurs (décision du 13/10) : le texte s'adresse aux stagiaires, et un formateur
  // salarié du centre n'a pas à accepter en son nom les conditions de l'éditeur ; ce sera
  // couvert par le contrat avec le centre. Vrai rôle, pas l'aperçu « Voir en tant que ».
  // Une erreur avant la barre (conditions, lectures du démarrage) ne laisse jamais la page sur « Chargement » sans sortie :
  // l'écran de repli propose de recharger ou de se déconnecter (relecture du 11/11).
  try {
  if (getProfile()?.role !== "prof") await exigerAcceptation(getAdminEmail());
  // Interrupteur de l'émargement (propre à la promo) lu en même temps que les modules, avant le premier rendu.
  // Sans promo (le siège, une direction dont le centre n'en a pas encore), les modules et l'émargement n'ont rien à lire : les
  // modules gardent leur état par défaut, l'émargement reste éteint (aucune lecture ne part sans en-tête de promo).
  const unePromo = !!getPromoCourante();
  // Direction : l'interrupteur de chaque promo du centre se lit aussi, une fois, pour allumer l'entrée Émargement de la barre.
  const centre = getEspace() === "direction" ? getCentre() : null;
  await Promise.all([
    unePromo ? chargerModulesAuDemarrage() : null, unePromo ? chargerEmargementActif() : null,
    centre ? chargerEmargementCentre(promosDuCentre(getMesPromos(), centre.id)) : null,
  ]);
  } catch (e) {
    console.error("Démarrage : lecture impossible avant la barre.", e);
    ecranSansNavigation();
    return;
  }
  // La coquille, ou l'écran de repli si elle ne peut pas se monter : jamais une page sans barre.
  renderTabs();
  majBadgeNouveautes();
  initChatbot();
  majPresenceModules();
  // Signaler un problème : compteurs des pastilles, et un mot à l'ouverture quand un signalement a avancé
  // (ou, chez le fondateur, quand il y en a de nouveaux).
  chargerEtatSignalements().then((etat) => {
    const phrase = messageDemarrage({ fondateur: fondateurHorsApercu(), ...etat });
    // Une annonce : elle attend la place libre et les fenêtres fermées, sans jamais effacer une confirmation (A2).
    if (phrase) setTimeout(() => annoncer(phrase, "info", 6000), 1500);
  });
  // Le changement de rôle change l'audience, donc le compte, et ce qu'on voit des modules.
  onAdminChange(() => {
    renderTabs(); majBadgeNouveautes(); majPresenceModules(); navigate({ force: true }); rafraichirBandeauEmargement();
    chargerEtatSignalements();
  });
  // Un module ouvert ou fermé (réglage d'un formateur, relecture au premier plan) :
  // barre, pastille et raccourcis suivent. La vue n'est rejouée que si elle vient
  // d'être fermée, pour ne pas détruire une saisie en cours.
  onModulesChange(() => {
    const reprise = renderTabs();
    majBadgeNouveautes();
    majPresenceModules();
    if (reprise || (lastRoute && !routeOuverte(lastRoute))) navigate({ force: true });
  });
  surveillerPremierPlan();
  // Émis par la page et par la section d'Accueil après marquage.
  window.addEventListener("nouveautes-vues", majBadgeNouveautes);
  initUndoKeyboard();
  installerGardeNavigateur();
  // Bandeau d'émargement (signer, ou rappel d'une feuille ouverte) : relu seul ensuite.
  initBandeauEmargement();
  // À l'ouverture, on revient sur la page quittée la dernière fois, et à défaut sur l'accueil de
  // l'espace (ruling R60 : l'Accueil ; direction et siège, lot 5 : #/centre, #/reseau). replaceState
  // plutôt que location.hash : pas de `hashchange` (donc pas de double rendu avec le navigate()
  // ci-dessous) et pas d'entrée d'historique parasite. Une ancienne adresse mémorisée suit sa
  // redirection dans navigate().
  // Exception : un lien vers un questionnaire (#/questionnaire/<clé>, WhatsApp) s'ouvre aussi à froid.
  if (!location.hash || (isColdStart() && !cleQuestionnaire(location.hash))) {
    const accueil = ACCUEIL_ESPACE[espaceCourant()] || "home";
    const cible = "#/" + (derniereRoute() || accueil);
    try { history.replaceState(null, "", cible); }
    catch (e) { location.hash = cible; }
  }
  await navigate();
}

(async () => {
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
  // Une bascule de promo lancée par la porte (la direction entre dans son centre, D6) : la page se recharge, rien ne démarre.
  if (basculeLancee()) return;
  if (ouvertureInterrompueParLaConnexion()) {
    // Lecture des affectations ratée : la carte dit « La connexion a échoué » et propose « Réessayer » (rechargement).
    showGate();
    return;
  }
  if (isAuth()) {
    await bootApp();
  } else {
    // Pas connecté → gate.
    // Si l'URL contient ?code=... (callback magic link), Supabase a déjà handle ;
    // un onAuthChange va déclencher le boot automatiquement.
    showGate(modeGateInitial);
    // Surveille le moment où l'auth devient valide pour basculer.
    const watch = setInterval(async () => {
      if (basculeLancee()) {
        clearInterval(watch);
      } else if (isAuth()) {
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
