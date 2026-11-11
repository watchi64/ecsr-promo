// Habillage (refonte, lot 3) : appliquer, choisir, et s'accorder avec le compte au démarrage.
// Les règles de choix vivent dans habillage-regles.js (pures) ; ici le DOM, le stockage de
// l'appareil et l'enregistrement sur le compte, chacun injectable pour les tests.
// Le script d'avant-peinture (habillage-avant-peinture.js) a déjà posé l'habillage de l'appareil
// avant l'affichage ; ce module ne fait que le confirmer ou le corriger.

import {
  CLE_APPAREIL, habillageValide, lireAppareil, ecrireAppareil, habillageRetenu,
} from "./habillage-regles.js?v=20261111m";

// Les dépendances par défaut sont lues au moment de l'appel (rien à l'import) : les tests en node
// n'ont ni document ni localStorage, et db.js / auth-admin.js ne se chargent que si on en a besoin.
function stockageDe(deps) {
  return deps.stockage ?? globalThis.localStorage;
}
function documentDe(deps) {
  return deps.document ?? globalThis.document;
}
async function enregistrerDe(deps) {
  if (deps.enregistrer) return deps.enregistrer;
  return (await import("./db.js?v=20261111m")).setMonHabillage;
}
async function emailDe(deps) {
  if ("email" in deps) return deps.email;
  return (await import("./auth-admin.js?v=20261111m")).getAdminEmail();
}

function lireStockage(deps) {
  try { return lireAppareil(stockageDe(deps).getItem(CLE_APPAREIL)); } catch { return null; }
}
// Un stockage bloqué (navigation privée, quota) ne doit jamais casser le changement d'habillage.
function ecrireStockage(deps, appareil) {
  try { stockageDe(deps).setItem(CLE_APPAREIL, ecrireAppareil(appareil)); } catch { /* sans mémoire d'appareil */ }
}
// L'appareil dit-il encore exactement `ecrit` ? Comparé tel qu'il se relit (lireAppareil normalise l'e-mail vide et
// « à envoyer ») : un autre écrit entre-temps (un choix plus récent) le laisse tel quel.
function appareilDitEncore(deps, ecrit) {
  const maintenant = lireStockage(deps);
  const relu = lireAppareil(ecrireAppareil(ecrit));
  return !!maintenant && !!relu && ecrireAppareil(maintenant) === ecrireAppareil(relu);
}

// Les envois au compte (démarrage et choix) partent un par un, dans l'ordre où ils sont demandés : deux pastilles touchées
// dans le temps d'un aller-retour arrivent au compte dans l'ordre des touchers, jamais l'ancien après le récent. Chaque envoi
// porte un numéro ; seul le plus récent, une fois arrivé, retire « à envoyer » de l'appareil : un envoi plus ancien qui
// réussit ne dit rien du choix qui le suit, encore en route ou en échec (il doit alors repartir au prochain démarrage).
let file = Promise.resolve();
let dernierEnvoi = 0;
function envoyer(nom, deps) {
  const numero = ++dernierEnvoi;
  const envoi = file.then(async () => (await enregistrerDe(deps))(nom));
  file = envoi.catch(() => { /* un échec n'arrête pas les envois suivants */ });
  return { numero, envoi };
}
const estLePlusRecent = (numero) => numero === dernierEnvoi;

export function appliquerHabillage(nom, deps = {}) {
  const doc = documentDe(deps);
  doc.documentElement.dataset.skin = nom;
  // Barre d'état du téléphone : la couleur du jeton de l'habillage, pas une valeur écrite ici.
  try {
    const calcule = deps.styleCalcule ?? globalThis.getComputedStyle;
    const couleur = String(calcule(doc.documentElement).getPropertyValue("--barre-etat") || "").trim();
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (couleur && meta) meta.setAttribute("content", couleur);
  } catch { /* la barre d'état garde sa couleur */ }
  const fenetre = deps.fenetre ?? globalThis.window;
  fenetre?.dispatchEvent(new CustomEvent("ecsr:habillage", { detail: { nom } }));
}

export function habillageCourant(deps = {}) {
  return documentDe(deps).documentElement.dataset.skin || "ecsr";
}

export async function choisirHabillage(nom, deps = {}) {
  if (!habillageValide(nom)) return null;
  appliquerHabillage(nom, deps);
  // Mis en file tout de suite, avant toute attente : l'ordre des envois est celui des touchers.
  const { numero, envoi } = envoyer(nom, deps);
  const email = await emailDe(deps);
  // D'abord sur l'appareil, « à envoyer » : si le réseau tombe, le choix survit et part au prochain démarrage. Un toucher
  // plus récent a pu l'écrire pendant l'attente de l'e-mail : c'est lui qui compte, il n'est pas réécrit.
  const ecrit = { nom, email, aEnvoyer: true, choisi: true };
  if (estLePlusRecent(numero)) ecrireStockage(deps, ecrit);
  try {
    await envoi;
    if (estLePlusRecent(numero) && appareilDitEncore(deps, ecrit)) ecrireStockage(deps, { ...ecrit, aEnvoyer: false });
    return { nom, enregistre: true };
  } catch (e) {
    console.warn("Habillage : enregistrement sur le compte impossible, il sera retenté au prochain démarrage", e);
    return { nom, enregistre: false };
  }
}

// `compte` vient du profil réel, jamais de « Voir en tant que ». Le lot 5 rappelle cette fonction
// après la porte avec `centre`, `reseau` et `libre` lus en base.
export async function habillageAuDemarrage({ email, compte, centre, reseau, libre } = {}, deps = {}) {
  const appareil = lireStockage(deps);
  const retenu = habillageRetenu({ appareil, compte, email, centre, reseau, libre });
  appliquerHabillage(retenu.nom, deps);
  // L'appareil garde toujours le dernier habillage appliqué (l'avant-peinture l'affiche sans éclair),
  // mais n'en fait un choix personnel que si la personne l'a fait (appareil) ou le compte le dit.
  // Écrit avant l'envoi, « à envoyer » tant qu'il n'est pas parti : un choix fait pendant un envoi lent
  // (menu du compte) écrit l'appareil après lui, et ce démarrage ne le réécrit jamais avec son nom d'avant.
  const ecrit = {
    nom: retenu.nom,
    email: email ?? null,
    choisi: retenu.source === "appareil" || retenu.source === "compte",
    aEnvoyer: retenu.source === "appareil" && retenu.envoi !== null,
  };
  ecrireStockage(deps, ecrit);
  if (retenu.envoi !== null) {
    const { numero, envoi } = envoyer(retenu.envoi, deps);
    try {
      await envoi;
      // Arrivé : plus rien à envoyer, à condition qu'aucun envoi ne l'ait suivi et que l'appareil dise encore ce que
      // ce démarrage y a écrit. Sinon un choix a été fait entre-temps, avec son propre envoi : il reste tel quel.
      if (ecrit.aEnvoyer && estLePlusRecent(numero) && appareilDitEncore(deps, ecrit)) {
        ecrireStockage(deps, { ...ecrit, aEnvoyer: false });
      }
    } catch (e) {
      // L'appareil dit déjà « à envoyer » : le choix repartira au prochain démarrage.
      console.warn("Habillage : enregistrement sur le compte impossible, il sera retenté au prochain démarrage", e);
    }
  }
  return retenu.nom;
}
