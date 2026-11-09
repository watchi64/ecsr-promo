// Habillage (refonte, lot 3) : appliquer, choisir, et s'accorder avec le compte au démarrage.
// Les règles de choix vivent dans habillage-regles.js (pures) ; ici le DOM, le stockage de
// l'appareil et l'enregistrement sur le compte, chacun injectable pour les tests.
// Le script d'avant-peinture (habillage-avant-peinture.js) a déjà posé l'habillage de l'appareil
// avant l'affichage ; ce module ne fait que le confirmer ou le corriger.

import {
  CLE_APPAREIL, habillageValide, lireAppareil, ecrireAppareil, habillageRetenu,
} from "./habillage-regles.js?v=20261109a";

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
  return (await import("./db.js?v=20261109a")).setMonHabillage;
}
async function emailDe(deps) {
  if ("email" in deps) return deps.email;
  return (await import("./auth-admin.js?v=20261109a")).getAdminEmail();
}

function lireStockage(deps) {
  try { return lireAppareil(stockageDe(deps).getItem(CLE_APPAREIL)); } catch { return null; }
}
// Un stockage bloqué (navigation privée, quota) ne doit jamais casser le changement d'habillage.
function ecrireStockage(deps, appareil) {
  try { stockageDe(deps).setItem(CLE_APPAREIL, ecrireAppareil(appareil)); } catch { /* sans mémoire d'appareil */ }
}

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
  const email = await emailDe(deps);
  // D'abord sur l'appareil, « à envoyer » : si le réseau tombe, le choix survit et part au prochain démarrage.
  ecrireStockage(deps, { nom, email, aEnvoyer: true, choisi: true });
  try {
    await (await enregistrerDe(deps))(nom);
    ecrireStockage(deps, { nom, email, aEnvoyer: false, choisi: true });
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
  let envoiEchoue = false;
  if (retenu.envoi !== null) {
    try { await (await enregistrerDe(deps))(retenu.envoi); }
    catch (e) {
      envoiEchoue = true;
      console.warn("Habillage : enregistrement sur le compte impossible, il sera retenté au prochain démarrage", e);
    }
  }
  // L'appareil garde toujours le dernier habillage appliqué (l'avant-peinture l'affiche sans éclair),
  // mais n'en fait un choix personnel que si la personne l'a fait (appareil) ou le compte le dit.
  ecrireStockage(deps, {
    nom: retenu.nom,
    email: email ?? null,
    choisi: retenu.source === "appareil" || retenu.source === "compte",
    aEnvoyer: retenu.source === "appareil" && envoiEchoue,
  });
  return retenu.nom;
}
