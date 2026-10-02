// État des modules (chantier B) pour la promo courante.
//
// SEUL point de contact avec la base pour la clé « modules » de `settings`.
// Contrat avec le chantier multi-promo : getSetting et setSetting de db.js lisent
// et écrivent la valeur de la promo courante. Si ce rangement change, c'est ce
// fichier seul qu'on rebranche. Les règles vivent dans js/modules.js, le
// catalogue dans js/modules-data.js.
import { getSetting, setSetting } from "./db.js?v=20261001a";
import { isAdmin, isProf, isFounder, getAdminEmail } from "./auth-admin.js?v=20261001a";
import { icon } from "./icons.js?v=20261001a";
import {
  MODULES, MODULE_DE_ROUTE, MODULE_DE_SOUS_ONGLET, REGLAGE_OUVERT_AUX_FORMATEURS,
} from "./modules-data.js?v=20261001a";
import {
  ETAT_LIBRE, lireEtat, ecrireEtat, estReglee, estOuvert, basculer, ensembleDeDepart,
  avecAnnonces, nouveautesPour,
} from "./modules.js?v=20261001a";
import { NOUVEAUTES } from "./nouveautes-data.js?v=20261001a";

const CLE_REGLAGE = "modules";
const REF = { modules: MODULES, moduleDeRoute: MODULE_DE_ROUTE, moduleDeSousOnglet: MODULE_DE_SOUS_ONGLET };
// Relecture au retour au premier plan : au plus une fois par minute.
const DELAI_RELECTURE_MS = 60 * 1000;

let etat = ETAT_LIBRE;
let texteCourant;          // undefined tant que rien n'a été lu dans cette session
let derniereLecture = 0;
let ecrituresAbouties = 0; // écritures terminées dans cette session : voir chargerModules
const abonnes = new Set();

// Copie sur l'appareil, propre au compte : elle ne sert que si la lecture échoue.
function cleCopie() {
  return "ecsr_modules:" + String(getAdminEmail() || "").toLowerCase();
}
function lireCopie() {
  try { return localStorage.getItem(cleCopie()); } catch (e) { return null; }
}
function ecrireCopie(texte) {
  try {
    if (texte === null || texte === undefined) localStorage.removeItem(cleCopie());
    else localStorage.setItem(cleCopie(), texte);
  } catch (e) { /* navigation privée : pas de copie, on relira la base */ }
}

// Pose un nouvel état et prévient les abonnés, seulement s'il a changé.
function appliquer(texte) {
  const valeur = texte ?? null;
  if (valeur === texteCourant) return;
  texteCourant = valeur;
  etat = lireEtat(valeur);
  abonnes.forEach((cb) => {
    try { cb(etat); } catch (e) { console.error(e); }
  });
}

// Lit l'état en base. En cas d'échec : l'état déjà en mémoire, sinon la copie de
// l'appareil, sinon libre (tout ouvert). Ne lève jamais d'erreur.
export async function chargerModules() {
  derniereLecture = Date.now();
  const ecrituresAuDepart = ecrituresAbouties;
  try {
    const texte = await getSetting(CLE_REGLAGE);
    // Une écriture a abouti pendant que cette lecture voyageait : la réponse montre
    // l'état d'avant elle. L'appliquer rétablirait l'ancien texte, en mémoire, dans
    // la copie de l'appareil et chez les abonnés. On l'ignore.
    if (ecrituresAbouties !== ecrituresAuDepart) return etat;
    ecrireCopie(texte);
    appliquer(texte);
  } catch (e) {
    console.error("Modules : lecture impossible, dernier état connu conservé.", e);
    if (texteCourant === undefined) appliquer(lireCopie());
  }
  return etat;
}

export function etatModules() { return etat; }

export function formateurConnecte() { return isAdmin() || isProf(); }

// Faut-il montrer ce module à la personne connectée ? Toujours pour un formateur.
export function moduleVisible(cle) {
  return formateurConnecte() || estOuvert(cle, etat, MODULES);
}
// Ce module est-il fermé pour la promo ? Sert au repère chez un formateur.
export function moduleMasque(cle) {
  return !estOuvert(cle, etat, MODULES);
}
export function routeVisible(route) { return moduleVisible(MODULE_DE_ROUTE[route]); }
export function routeMasquee(route) { return moduleMasque(MODULE_DE_ROUTE[route]); }

// Qui voit la section de réglage (voir REGLAGE_OUVERT_AUX_FORMATEURS).
export function peutRegler() {
  return isAdmin() && (REGLAGE_OUVERT_AUX_FORMATEURS || isFounder());
}

export function onModulesChange(cb) {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}

// Relit la valeur juste avant d'écrire : la fenêtre où deux formateurs qui
// cliquent en même temps s'écraseraient tombe à quelques millisecondes.
// Lève une erreur si la lecture ou l'écriture échoue (l'appelant l'affiche).
async function ecrireUne(transformer) {
  const frais = lireEtat(await getSetting(CLE_REGLAGE));
  const texte = ecrireEtat(transformer(frais));
  await setSetting(CLE_REGLAGE, texte);
  ecrituresAbouties++;
  ecrireCopie(texte);
  appliquer(texte);
  return etat;
}

// File d'écriture : deux cases cochées vite lanceraient deux écritures en
// parallèle, et la seconde, qui a relu avant que la première ait écrit, repartirait
// de l'état d'avant elle et l'écraserait. Chaque écriture attend donc la fin de la
// précédente. Celle qui échoue rejette sa propre promesse sans bloquer les suivantes.
let suiteEcritures = Promise.resolve();
function ecrire(transformer) {
  const tour = suiteEcritures.then(() => ecrireUne(transformer));
  suiteEcritures = tour.catch(() => {});
  // Promesse dérivée : `tour` est déjà marquée comme gérée par la ligne du dessus,
  // donc la renvoyer telle quelle cacherait le rejet à un appelant qui oublie son
  // .catch. Celle-ci reste non gérée tant que l'appelant ne la traite pas : le rejet
  // est alors signalé dans la console, comme n'importe quelle erreur non rattrapée.
  return tour.then((e) => e);
}

// La promesse rejette si la lecture ou l'écriture échoue ; l'appelant affiche l'erreur.
export function basculerModule(cle, ouvrir) {
  return ecrire((frais) => basculer(frais, cle, ouvrir, MODULES, new Date().toISOString()));
}

// La promesse rejette si la lecture ou l'écriture échoue ; l'appelant affiche l'erreur.
export function appliquerEnsembleDeDepart() {
  // `frais` est la valeur relue juste avant d'écrire, pas celle de la mémoire : la
  // mémoire peut croire la promo libre alors qu'un réglage existe (lecture de
  // démarrage ratée, ou onglet resté ouvert pendant qu'un autre formateur réglait la
  // promo). Un réglage lisible est donc conservé tel quel : l'ensemble de départ ne
  // s'applique que sur un état libre ou illisible.
  return ecrire((frais) => estReglee(frais)
    ? frais
    : ensembleDeDepart(MODULES, new Date().toISOString()));
}

// Pour la mémoire des nouveautés lues (amorce, purge) : tout, sans filtre.
export function toutesLesNouveautes() {
  return avecAnnonces(NOUVEAUTES, etat, MODULES);
}
// Pour l'affichage et le compte de la pastille : ce que la personne doit voir.
export function nouveautesDeLaPromo() {
  return nouveautesPour(NOUVEAUTES, etat, REF, formateurConnecte());
}

// Sur iPhone, on rouvre l'app sans la recharger : l'état est relu quand elle
// revient au premier plan, au plus une fois par minute.
let surveillance = false;
export function surveillerPremierPlan() {
  if (surveillance) return;
  surveillance = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - derniereLecture < DELAI_RELECTURE_MS) return;
    chargerModules();
  });
}

// Repère « Masqué aux stagiaires » : atténue `noeud` et pose un œil barré dans
// `cible` (le nœud lui-même par défaut). Idempotent : on peut le rappeler sur un
// nœud persistant (la bulle) pour le poser ou le retirer.
export function repereMasque(noeud, masque, cible = noeud) {
  const deja = noeud.classList.contains("module-masque");
  if (masque && !deja) {
    noeud.dataset.titreBase = noeud.getAttribute("title") || "";
    noeud.setAttribute("title", noeud.dataset.titreBase
      ? noeud.dataset.titreBase + " (masqué aux stagiaires)" : "Masqué aux stagiaires");
    noeud.classList.add("module-masque");
    const marque = document.createElement("span");
    marque.className = "marque-masque";
    marque.setAttribute("role", "img");
    marque.setAttribute("aria-label", "Masqué aux stagiaires");
    marque.appendChild(icon.eyeOff());
    cible.appendChild(marque);
  } else if (!masque && deja) {
    const base = noeud.dataset.titreBase || "";
    if (base) noeud.setAttribute("title", base);
    else noeud.removeAttribute("title");
    delete noeud.dataset.titreBase;
    noeud.classList.remove("module-masque");
    cible.querySelectorAll(":scope > .marque-masque").forEach((m) => m.remove());
  }
  return noeud;
}
