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
 *  - Lot 5 : l'espace de la session (getEspace : stagiaire, equipe, direction, siege), fixé à la porte d'après les
 *    affectations du compte et les rôles de la promo affichée ; les droits affichés sont bridés par lui.
 *
 * Conservé : nom du module + signatures pour limiter la casse.
 */

import {
  getCurrentUser, signOut, onAuthChange,
  getMyProfile, listStagiaires, listProfs,
  chargerMesPromos, mesAffectations, oublierPromo, getPromoCourante, getMesPromos, rechargerApresEnregistrements,
  bloquerRequetesJusquAuRechargement, poserApercu, invalidateCache, choisirPromo, ouvrirDansUnePromo,
} from "./db.js?v=20261111a";
import {
  LIBELLES_APERCU, normaliserApercu, apercusPermis, droitsAffiches, messageSansPromo, etiquetteBadge,
} from "./roles-rules.js?v=20261111a";
import {
  LIBELLES_ESPACE, ACCUEIL_ESPACE, espacesPermis, espacesDuCompte, espaceChoisi, brider, peutRedigerContenus, porteSansPromo, decisionPorteSansPromo,
  centreAffiche, promoPourLaDirection, promoPourLEspace, affectationsDeSecours, espaceDePilotage, routeDansLEspace, texteBandeauApercu,
} from "./espaces-rules.js?v=20261111a";
import { peutQuitter } from "./navigation.js?v=20261111a";
import { el, toast, displayStagiaire, isoDate } from "./utils.js?v=20261111a";
import { icon } from "./icons.js?v=20261111a";
import { construirePastille } from "./promo-pastille.js?v=20261111a";
import { pagePersonnelle, lireAdresse } from "./route-rules.js?v=20261111a";
import { etatSignalements } from "./signalement-etat.js?v=20261111a";
import { pastilleSignalement } from "./signalement-rules.js?v=20261111a";
import { libellePastille } from "./nouveautes.js?v=20261111a";

let currentUser = null;     // Supabase auth user
let currentProfile = null;  // row user_profiles
let stagiaires = null;
let profs = null;
const listeners = new Set();

// Aperçu « Voir en tant que » : le fondateur simule formateur, direction, siège ou stagiaire ; l'équipe d'une
// promo (formateur, direction) simule le stagiaire. Un aperçu ne fait que RETIRER des droits (js/roles-rules.js) :
// la session reste celle de la personne, et l'en-tête x-apercu-role (js/db.js, poserApercu) fait répondre la
// base comme pour le rôle simulé.
const VIEW_AS_KEY = "ecsr_view_as";
let viewAs = null;  // null = rôle réel ; sinon l'un de APERCUS

// Lot 5 : les affectations du compte (`{ role, promo_id, lieu_id, lieu_nom }` : siège, direction d'un centre, formateur d'une
// promo), relues à chaque ouverture de session. Le siège et la direction en tirent leur espace (D2).
let affectations = [];
// L'espace de la session (D2) : fixé à la porte, avant la décision de navigation (D4, js/nav-etat.js). Il ne change en cours de
// session que sur place, entre formateur et stagiaire (« Voir comme un stagiaire », comme au lot 4) ; entrer dans la direction ou
// le siège, ou en sortir, recharge l'app. Le choix fait dans le menu « Espace » est mémorisé sur l'appareil, par compte.
let espace = null;
const CLE_ESPACE = "ecsr_espace:";

// === Getters publics ===

export function isAuth()        { return !!currentUser && !!currentProfile; }
export function isFounder()     { return !!currentProfile?.is_founder; }
export function getViewAs()     { return viewAs; }
// Le fondateur tel qu'il est, hors aperçu « Voir en tant que » : ce que l'éditeur seul voit (signalements de
// problème reçus) disparaît dans l'aperçu, qui montre ce que voit le rôle simulé.
export function fondateurHorsApercu() { return isFounder() && !getViewAs(); }
export function getAdminEmail() { return currentUser?.email || null; }
export function getProfile()    { return currentProfile; }

// Droits affichés : selon les rôles de la promo affichée (mes_promos), ou à défaut selon l'ancien profil, retraités par
// l'aperçu en cours, puis bridés par l'espace (lot 5 : la direction n'écrit pas comme un formateur, le siège ne gère ni promo ni
// stagiaire ; js/espaces-rules.js, brider).
function droitsNonBrides(apercu = viewAs) {
  return droitsAffiches({ profil: currentProfile, promo: getPromoCourante(), apercu });
}
function droits() {
  return brider(droitsNonBrides(), getEspace());
}
export function isAdmin()     { return droits().admin; }
export function isProf()      { return droits().prof; }
export function isStagiaire() { return droits().stagiaire; }
// Gérer la promo (stagiaires, modules, équipe, données personnelles) : formateur, direction, administrateur. Écrire dans le
// planning, les notes, les évaluations ou les examens reste isAdmin() : la direction lit sans y écrire.
export function isEquipe()    { return droits().equipe; }
// Rédiger les contenus communs (cours de thème, questions de QCM) : le siège, un formateur administrateur ; jamais la direction
// (D13, ruling R1). Lu sur les droits avant la bride, que peutRedigerContenus applique elle-même.
export function isRedacteur() { return peutRedigerContenus({ droits: droitsNonBrides(), espace: getEspace() }); }

// ----- Espaces (lot 5) -----

// L'espace de la session ; avant la porte (ou sans profil), celui que donnent les droits (équipe ou stagiaire), comme au lot 4.
export function getEspace() { return espace || droitsNonBrides().espace; }
// Les espaces que le menu « Espace » propose (une ligne chacun quand il y en a deux ou plus) : js/espaces-rules.js, espacesDuCompte.
export function espacesOuverts() {
  if (!currentProfile) return [];
  return espacesDuCompte({ profil: currentProfile, promo: getPromoCourante(), promos: getMesPromos(), affectations, apercu: viewAs });
}
export function getAffectations() { return affectations.map((a) => ({ ...a })); }
// Le centre affiché (D6) : le lieu de la promo affichée s'il est dirigé par le compte (ou en aperçu direction), sinon le premier
// lieu dirigé ; null quand le compte ne dirige aucun centre.
export function getCentre() { return centreAffiche({ promo: getPromoCourante(), affectations, apercu: viewAs }); }

function cleEspace() {
  const email = currentUser?.email;
  return email ? CLE_ESPACE + String(email).toLowerCase() : null;
}
function lireEspaceMemorise() {
  try { const cle = cleEspace(); return cle ? localStorage.getItem(cle) : null; } catch (e) { return null; }
}
// Mémorise l'espace choisi ; `null` efface le choix (retour à l'état d'avant un changement refusé).
function memoriserEspace(e) {
  try {
    const cle = cleEspace();
    if (!cle) return;
    if (e == null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, e);
  } catch (x) { /* navigation privée : le choix vaut pour la session */ }
}

// L'espace qu'aurait la session avec cet aperçu : le choix mémorisé s'il est permis sur la promo affichée, sinon le premier permis
// (siège, direction, formateur, stagiaire) ; sans espace permis (rôles absents, base pas migrée), celui du lot 4.
function espaceAvec(apercu) {
  if (!currentProfile) return null;
  const permis = espacesPermis({ profil: currentProfile, promo: getPromoCourante(), affectations, apercu });
  return espaceChoisi(permis, lireEspaceMemorise()) || droitsNonBrides(apercu).espace;
}
function fixerEspace() {
  espace = espaceAvec(viewAs);
  return espace;
}

// Affectations de la session, lues en deux essais (le second 1,5 s après le premier, comme mes_promos). Une lecture ratée :
//   - session déjà ouverte (profil en place : renouvellement du jeton, retour au premier plan) : les affectations en mémoire
//     restent, l'espace aussi, sans message ;
//   - à l'ouverture : repli sur les rôles des promos (affectationsDeSecours), pour qu'une direction ne soit pas renvoyée dans
//     l'espace de l'équipe sur une panne passagère. Pour un compte sans promo ce repli est vide : la porte décide (voir plus bas).
// Rend vrai quand la lecture a abouti (même vide).
async function lireAffectations() {
  for (let essai = 1; essai <= 2; essai++) {
    try {
      affectations = await mesAffectations();
      return true;
    } catch (e) {
      console.error("Affectations illisibles (essai " + essai + "/2)", e);
      if (essai === 1) await new Promise((resolve) => setTimeout(resolve, PAUSE_AVANT_SECOND_ESSAI_MS));
    }
  }
  if (!currentProfile) affectations = affectationsDeSecours(getMesPromos());
  return false;
}

// Vrai quand l'ouverture de la session s'est arrêtée sur une lecture ratée des affectations (compte sans promo) : la personne
// reste connectée, la page de démarrage lui dit que la connexion a échoué et propose de réessayer (js/main.js).
let ouvertureInterrompue = false;
export function ouvertureInterrompueParLaConnexion() { return ouvertureInterrompue; }
// La porte s'est arrêtée sur une lecture ratée : ni refus ni déconnexion. « ecsr:connexion-echouee » (gate.js) écrit la phrase de
// connexion de l'app dans la carte et propose « Réessayer » ; au démarrage l'événement part avant showGate(), le motif attend.
function interrompreOuverture() {
  ouvertureInterrompue = true;
  document.dispatchEvent(new CustomEvent("ecsr:connexion-echouee"));
}

// La porte d'un compte sans promo (D5) : le siège et la direction entrent (leur espace), les autres sont refusés (lot 4).
// Rend la décision de decisionPorteSansPromo : "entrer", "refuser", ou "reessayer" (lecture ratée à l'ouverture).
async function porteOuverteSansPromo() {
  const lue = await lireAffectations();
  return decisionPorteSansPromo({ lecture: lue ? "lue" : "ratee", affectations, sessionOuverte: !!currentProfile });
}

// D6 : entrer dans l'espace de la direction quand la promo affichée est d'un centre que le compte ne dirige pas fait basculer vers
// la première promo en cours (sinon la plus récente) du centre dirigé ; s'il n'en a aucune, la promo reste. Rend vrai quand la
// bascule est lancée : la page va se recharger, rien d'autre ne démarre (js/main.js, basculeLancee).
async function basculerVersLeCentreDirige() {
  if (espace !== "direction") return false;
  const cible = promoPourLaDirection({ promo: getPromoCourante(), promos: getMesPromos(), affectations, aujourdhui: isoDate(new Date()) });
  if (cible == null) return false;
  // Une adresse hors de l'espace (un favori de l'espace formateur) n'attend pas le rechargement : l'accueil, sans phrase (D16).
  if (!routeDansLEspace("direction", lireAdresse(location.hash).route)) {
    try { history.replaceState(null, "", "#/" + ACCUEIL_ESPACE.direction); } catch (e) { /* hors navigateur */ }
  }
  await choisirPromo(cible);
  return true;
}

// Recharge l'app sur l'accueil d'un espace, après les enregistrements en cours (D4 : la navigation ne change jamais en cours de
// session).
function rechargerSurLAccueil(e) {
  try { history.replaceState(null, "", "#/" + (ACCUEIL_ESPACE[e] || "home")); } catch (x) { /* hors navigateur */ }
  rechargerApresEnregistrements();
}

// Changer d'espace depuis le menu du compte (ancien et nouveau) : le choix est mémorisé sur l'appareil (D2), puis l'app se recharge
// sur l'accueil du nouvel espace. Quand la promo affichée ne donne pas cet espace (la direction d'un autre centre, la promo où l'on
// forme), l'app s'ouvre sur une promo qui le donne (ouvrirDansUnePromo). Une saisie en cours demande d'abord confirmation ; un espace
// déjà affiché, ou qui n'est pas ouvert au compte, ne change rien.
export async function setEspace(nouvel) {
  if (nouvel === getEspace() || !espacesOuverts().includes(nouvel) || !peutQuitter(() => setEspace(nouvel))) return;
  // Mémorisé avant la bascule (le rechargement ne laisse aucune garantie après elle), rendu tel qu'il était si la bascule est refusée.
  const memorise = lireEspaceMemorise();
  memoriserEspace(nouvel);
  const aujourdhui = isoDate(new Date());
  const promo = getPromoCourante();
  const promos = getMesPromos();
  const cible = nouvel === "direction"
    ? promoPourLaDirection({ promo, promos, affectations, aujourdhui })
    : promoPourLEspace({ espace: nouvel, promo, promos, aujourdhui });
  if (cible != null) {
    const phrase = await ouvrirDansUnePromo(cible, "#/" + (ACCUEIL_ESPACE[nouvel] || "home"));
    if (phrase) {
      memoriserEspace(memorise);
      toast(phrase, "error", 4000);
    }
    return;
  }
  rechargerSurLAccueil(nouvel);
}

// Aperçus ouverts à la personne connectée sur la promo affichée.
export function apercusOuverts() {
  return apercusPermis({ profil: currentProfile, promo: getPromoCourante() });
}

// Profil stagiaire de la personne connectée, tel que l'app le traite : en aperçu autre que « Stagiaire », elle n'en a
// pas, comme un vrai formateur (chantier D).
export function monStagiaireId() {
  if (viewAs && viewAs !== "stagiaire") return null;
  return currentProfile?.stagiaire_id ?? null;
}

// Retient l'aperçu et l'envoie à la base. Les données lues sous l'ancien aperçu sont oubliées.
function appliquerApercu(role) {
  const change = role !== viewAs;
  viewAs = role;
  poserApercu(role);
  if (change) invalidateCache();
}

// Charge l'aperçu mémorisé (ignoré s'il n'est pas ouvert à cette personne sur cette promo).
function loadViewAs() {
  let role = null;
  try { role = normaliserApercu(localStorage.getItem(VIEW_AS_KEY)); } catch (e) { role = null; }
  const permis = !!role && apercusOuverts().includes(role);
  appliquerApercu(permis ? role : null);
  // Un aperçu mémorisé mais non permis sur la promo affichée est effacé : il ne reviendrait pas en changeant de promo.
  if (!permis) { try { localStorage.removeItem(VIEW_AS_KEY); } catch (e) { /* ignore */ } }
}

// Déconnexion ou refus de session : l'aperçu est retiré (mémoire, appareil et en-tête).
function oublierApercu() {
  appliquerApercu(null);
  try { localStorage.removeItem(VIEW_AS_KEY); } catch (e) { /* ignore */ }
}

// Pose l'aperçu et re-render l'app. role : un aperçu ouvert à la personne ; « admin », null ou une valeur
// inconnue = rôle réel. Lot 5 (D4) : un aperçu qui fait entrer dans la direction ou le siège, ou en sortir, recharge l'app
// sur l'accueil du nouvel espace (après accord si une saisie est en cours) ; entre formateur et stagiaire, l'espace change sur
// place, comme au lot 4.
export function setViewAs(role) {
  const voulu = normaliserApercu(role);
  const nouveau = voulu && apercusOuverts().includes(voulu) ? voulu : null;
  const espaceApres = espaceAvec(nouveau);
  const recharger = espaceApres !== espace && (espaceDePilotage(espaceApres) || espaceDePilotage(espace));
  if (recharger && !peutQuitter(() => setViewAs(role))) return;
  appliquerApercu(nouveau);
  try {
    if (viewAs) localStorage.setItem(VIEW_AS_KEY, viewAs);
    else localStorage.removeItem(VIEW_AS_KEY);
  } catch (e) { /* ignore */ }
  espace = espaceApres;
  if (recharger) {
    rechargerSurLAccueil(espaceApres);
    return;
  }
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
  oublierApercu();
  currentUser = null;
  currentProfile = null;
  affectations = [];
  espace = null;
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
  let porte;
  currentUser = await getCurrentUser();
  if (currentUser) {
    const contexte = await chargerContextePromo(currentUser);
    if (contexte === null) {
      // Déconnexion pendant le chargement : rien n'a été posé, rien à refuser ni à dire.
    } else if (!contexte && (porte = await porteOuverteSansPromo()) !== "entrer") {
      if (porte === "reessayer") {
        // Lecture des affectations ratée après deux essais : on ne sait pas si le compte a une porte. Ni refus ni déconnexion.
        interrompreOuverture();
      } else {
        // Aucune promo, ni siège ni direction (D5). Le rappel onAuthChange n'est pas encore branché : la déconnexion ne lui
        // dira pas d'oublier le contexte, refuserSession s'en charge (comme pour le profil absent).
        await refuserSession(messageSansPromo());
      }
    } else {
      // Les annuaires ne sont lisibles qu'authentifié (RLS) → charger après l'auth. Les affectations (déjà lues par la
      // porte d'un compte sans promo) en même temps.
      await Promise.all([loadDirectories(), contexte ? lireAffectations() : null]);
      await refreshProfile();
      if (!currentProfile) {
        // Connecté mais pas dans user_profiles → kick out
        await refuserSession("Ton compte n'est plus autorisé. Demande une invitation.");
      } else {
        // L'espace est fixé ici, avant la décision de navigation (D4) ; la direction entre dans son centre (D6).
        fixerEspace();
        await basculerVersLeCentreDirige();
      }
    }
  }

  onAuthChange(async (user) => {
    currentUser = user;
    if (user) {
      const avant = getPromoCourante()?.id ?? null;
      const espaceAvant = espace;
      const etaitDegrade = promosIndisponibles;
      const contexte = await chargerContextePromo(user);
      // Déconnexion pendant le chargement : le rappel de la déconnexion a déjà vidé le profil, la barre
      // et prévenu les écouteurs. Rien à refuser, à dire ni à relire (et surtout pas de second signOut,
      // qui frapperait une session ouverte entre-temps).
      if (contexte === null) return;
      const porte = contexte ? "entrer" : await porteOuverteSansPromo();
      if (porte === "refuser") {
        await refuserSession(messageSansPromo());
      } else if (porte === "reessayer") {
        // Connexion depuis la carte, puis lecture des affectations ratée : ni refus ni déconnexion, la carte dit « Réessayer ».
        interrompreOuverture();
        return;
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
        await Promise.all([loadDirectories(), contexte ? lireAffectations() : null]);
        await refreshProfile();
        if (!currentProfile) {
          await refuserSession("Email non invité. Demande à un admin de te whitelister.");
        } else {
          fixerEspace();
          // L'espace a changé sous une session ouverte (affectation ajoutée ou retirée entre deux renouvellements du jeton) :
          // on repart de zéro, la navigation ne change jamais en cours de session (D4).
          if (espaceAvant !== null && espace !== espaceAvant) {
            rechargerSansDelai();
            return;
          }
          if (await basculerVersLeCentreDirige()) return;
        }
      }
    } else {
      currentProfile = null;
      affectations = [];
      espace = null;
      oublierApercu();
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
  if (!currentUser) { updateImpersonationBanner(); updatePromosBanner(); suivreBandeauxBas(); return; }

  // Pastille de promo devant le badge (formateurs et fondateur, au moins deux promos). Pas dans
  // l'aperçu « Stagiaire » : un stagiaire n'en a pas, l'aperçu doit rester fidèle.
  const pastille = getViewAs() === "stagiaire" ? null : construirePastille();
  if (pastille) slot.appendChild(pastille);
  slot.classList.toggle("avec-pastille", !!pastille);

  const who = getProfileWho() || currentUser.email;
  // Le rôle réel sur la promo affichée (mes_promos), pas l'ancien `role` du profil : une direction n'est pas « formateur »,
  // un compte cumulé est formateur sur sa promo de formateur (roles-rules.js, etiquetteBadge).
  const { libelle: roleLabel, classe: roleClasse } = etiquetteBadge({ profil: currentProfile, promo: getPromoCourante() });

  const badge = el("button", { class: "admin-badge", "aria-haspopup": "dialog", onClick: openProfileMenu },
    el("span", { class: "admin-dot " + roleClasse }),
    el("span", { class: "admin-email" }, who),
    roleLabel ? el("span", { class: "admin-role" }, roleLabel) : null,
  );
  slot.appendChild(badge);
  updateImpersonationBanner();
  updatePromosBanner();
  suivreBandeauxBas();
}

// Bandeaux du bas de l'écran (aperçu, promos non chargées) : tant qu'il y en a un d'affiché, le corps de la
// page porte data-bandeaux-bas et --haut-bandeaux-bas, la hauteur de leur pile, mesurée puis suivie (un
// texte qui passe à la ligne, l'app qui s'affiche). Ce qui s'ouvre au même endroit s'en écarte : la bulle
// et le panneau de l'assistant (css/style.css avec l'ancienne barre, css/navigation.css avec la nouvelle).
const SEL_BANDEAUX_BAS = "#impersonation-banner, #promos-banner";
let suiviBandeaux = null;

function mesurerBandeauxBas() {
  const corps = document.body;
  const boites = [...document.querySelectorAll(SEL_BANDEAUX_BAS)]
    .filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
  if (!boites.length) {
    delete corps.dataset.bandeauxBas;
    corps.style.removeProperty("--haut-bandeaux-bas");
    return;
  }
  const pile = Math.max(...boites.map((r) => r.bottom)) - Math.min(...boites.map((r) => r.top));
  corps.dataset.bandeauxBas = "";
  corps.style.setProperty("--haut-bandeaux-bas", Math.ceil(pile) + "px");
}

function suivreBandeauxBas() {
  if (!suiviBandeaux && typeof ResizeObserver === "function") suiviBandeaux = new ResizeObserver(() => mesurerBandeauxBas());
  if (suiviBandeaux) {
    suiviBandeaux.disconnect();
    document.querySelectorAll(SEL_BANDEAUX_BAS).forEach((b) => suiviBandeaux.observe(b));
  }
  mesurerBandeauxBas();
}

// Bandeau d'état dégradé : les promos n'ont pas pu être chargées (deux essais), l'app affiche la
// promo par défaut du compte. Persistant, retiré dès qu'un chargement réussit. Sur le modèle du
// bandeau d'aperçu, mais dans #app : il est caché avec lui pendant la porte. « Réessayer »
// recharge la page, qui repart d'un contexte propre, après les enregistrements en cours du
// planning (même attente qu'une bascule de promo).
function updatePromosBanner() {
  let banner = document.getElementById("promos-banner");
  // Le siège n'a pas de promo : une panne de mes_promos ne lui fait rien manquer (lot 5, Review Focus 3).
  if (!(promosIndisponibles && currentUser && currentProfile && getEspace() !== "siege")) { if (banner) banner.remove(); return; }
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
  const { libelle, suite } = texteBandeauApercu(v, getCentre());
  if (!banner) {
    banner = el("div", { id: "impersonation-banner", class: "impersonation-banner" });
    document.body.appendChild(banner);
  }
  banner.innerHTML = "";
  banner.appendChild(el("span", { class: "imp-eye", "aria-hidden": "true" }, icon.eye()));
  // Direction et siège : la phrase est longue (elle dit que les modifications sont réelles), le bandeau passe à la ligne.
  banner.classList.toggle("imp-long", !!suite);
  banner.appendChild(el("span", { class: "imp-text" }, "Aperçu : ", el("strong", {}, libelle), suite ? ". " + suite : ""));
  banner.appendChild(el("button", { class: "imp-back", type: "button",
    onClick: () => setViewAs(null) }, isFounder() ? "Revenir fondateur" : "Quitter l'aperçu"));
}

// Sélecteur « Voir en tant que », aussi dans le menu du compte de la nouvelle navigation (js/menu-compte.js).
// Fondateur : cinq boutons (Fondateur, Formateur, Direction, Siège, Stagiaire) qui passent à la ligne. Équipe d'une
// promo (formateur, direction) : une ligne « Voir comme un stagiaire », ou « Quitter l'aperçu » une fois dedans.
// Autres : rien.
export function buildViewAsBlock(onPick) {
  const choisir = (val) => { setViewAs(val); if (onPick) onPick(); };
  if (isFounder()) {
    const current = getViewAs() || "admin";
    const seg = el("div", { class: "view-as-seg" });
    [["admin", "Fondateur"], ...Object.entries(LIBELLES_APERCU)].forEach(([val, lab]) => {
      seg.appendChild(el("button", {
        class: "view-as-btn" + (current === val ? " active" : ""),
        type: "button",
        "aria-pressed": current === val ? "true" : "false",
        onClick: () => choisir(val),
      }, lab));
    });
    return el("div", { class: "view-as-block" },
      el("p", { class: "muted", style: "margin:0 0 0.4rem;font-size:0.82rem" }, "Voir en tant que (aperçu)"),
      seg,
    );
  }
  if (!apercusOuverts().includes("stagiaire")) return null;
  const dedans = getViewAs() === "stagiaire";
  return el("div", { class: "view-as-block" },
    el("button", { class: "view-as-ligne", type: "button", "data-view-as": dedans ? "quitter" : "stagiaire",
      onClick: () => choisir(dedans ? null : "stagiaire") },
    dedans ? "Quitter l'aperçu" : "Voir comme un stagiaire"),
  );
}

// Section « Espace » du menu « Mon compte » de l'ancienne barre (lot 5) : une direction qui forme dans une promo dont
// l'interrupteur est éteint y retrouve sa direction. Un bouton par espace ouvert au compte, l'actuel coché (aria-pressed) ; rien
// quand il n'y en a qu'un. Le menu de la nouvelle barre a la sienne, en lignes (js/menu-compte.js).
function blocEspace(fermer) {
  const ouverts = espacesOuverts();
  if (ouverts.length < 2) return null;
  const actuel = getEspace();
  const titre = el("p", { class: "muted", id: "compte-espace-titre", style: "margin:0 0 0.4rem;font-size:0.82rem" }, "Espace");
  const seg = el("div", { class: "view-as-seg", role: "group", "aria-labelledby": "compte-espace-titre" },
    ouverts.map((e) => el("button", {
      class: "view-as-btn" + (e === actuel ? " active" : ""), type: "button", "data-espace-choix": e,
      "aria-pressed": e === actuel ? "true" : "false",
      onClick: () => {
        if (e === actuel) return;
        fermer();
        setEspace(e);
      },
    }, LIBELLES_ESPACE[e])));
  return el("div", { class: "view-as-block" }, titre, seg);
}

// Déconnexion, pour le menu « Mon compte » (ancien et nouveau) : la session se ferme, puis la page
// se recharge. `apresDeconnexion` : ce qui se retire de l'écran entre les deux (la fenêtre du menu).
export async function seDeconnecter(apresDeconnexion) {
  await signOut();
  if (apresDeconnexion) apresDeconnexion();
  toast("Déconnecté", "success");
  // Le hashchange + onAuthChange rechargeront le gate
  location.reload();
}

// « Signaler un problème » dans la fenêtre « Mon compte » de l'ancienne barre (spec 2026-10-28, § 5.1) :
// la fenêtre de signalement la remplace, et le focus reviendra au badge du nom. Sa pastille : les
// signalements de la personne qui ont avancé. Chez le fondateur hors aperçu, en plus, la page des
// problèmes reçus, avec le nombre de nouveaux. Import différé de js/signalement.js (qui importe ce module).
function boutonsSignalement(fermer) {
  const etat = etatSignalements();
  const { texte, nom } = pastilleSignalement({ fondateur: false, ...etat });
  const signaler = el("button", { class: "btn full sg-entree-compte", type: "button", "data-sg-entree": "compte", "aria-label": nom,
    onClick: () => {
      fermer();
      import("./signalement.js?v=20261111a").then((m) => m.ouvrirSignalement({ ancre: document.querySelector(".admin-badge") }));
    } }, icon.signaler(), "Signaler un problème", texte ? el("span", { class: "sg-pastille", "aria-hidden": "true" }, texte) : null);
  if (!fondateurHorsApercu()) return [signaler];
  const nouveaux = libellePastille(etat.nouveaux);
  const problemes = el("button", { class: "btn full sg-entree-compte", type: "button", "data-sg-entree": "problemes",
    "aria-label": nouveaux ? `Problèmes signalés, ${etat.nouveaux} nouveaux` : "Problèmes signalés",
    onClick: () => { fermer(); location.hash = "#/problemes"; } },
  icon.list(), "Problèmes signalés", nouveaux ? el("span", { class: "sg-pastille", "aria-hidden": "true" }, nouveaux) : null);
  return [signaler, problemes];
}

function openProfileMenu() {
  const backdrop = el("div", { class: "modal-backdrop" });
  const logoutBtn = el("button", { class: "btn danger full", onClick: () => seDeconnecter(() => backdrop.remove()) },
    "Se déconnecter");

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
    ...boutonsSignalement(() => backdrop.remove()),
    blocEspace(() => backdrop.remove()),
    buildViewAsBlock(() => backdrop.remove()),
    logoutBtn,
    el("button", { class: "gate-link compte-legal", type: "button", onClick: () => {
      backdrop.remove();
      import("./legal.js?v=20261111a").then((m) => m.ouvrirInformationsLegales());
    } }, "Informations légales et données personnelles"),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}
