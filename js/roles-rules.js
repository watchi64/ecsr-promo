/*
 * Rôles côté app (lot 4) : règles pures, sans réseau ni DOM, testées par
 * `node --test tests/roles-rules.test.mjs`. L'autorité reste la base (affectations, fonctions
 * formateur_courant et consorts, en-tête x-apercu-role) : ces fonctions décident seulement de ce que
 * l'app affiche et de ce qu'elle envoie.
 *
 * Les rôles réels sur la promo affichée viennent de mes_promos() (colonne `roles`). Tant que la base n'est
 * pas migrée (ou si les promos n'ont pas pu être chargées), la colonne manque : l'app se replie alors sur
 * `is_admin` et `role` du profil, comme avant le lot 4.
 */

// Les aperçus : un fondateur les a tous, un membre de l'équipe a celui du stagiaire. Un aperçu ne fait que
// RETIRER des droits : une valeur hors de la liste permise est ignorée.
export const APERCUS = ["formateur", "direction", "siege", "stagiaire"];
export const LIBELLES_APERCU = { formateur: "Formateur", direction: "Direction", siege: "Siège", stagiaire: "Stagiaire" };
export const ENTETE_APERCU = "x-apercu-role";

// Valeur mémorisée ou saisie vers un aperçu connu. L'ancienne valeur « prof » se lit « formateur » ;
// « admin » (le fondateur sans aperçu) et tout inconnu donnent null.
export function normaliserApercu(v) {
  if (v === "prof") return "formateur";
  return APERCUS.includes(v) ? v : null;
}

function rolesDe(promo) {
  return promo && Array.isArray(promo.roles) ? promo.roles : null;
}

// Droits réels, hors aperçu. `equipe` : formateur ou direction (ou siège) sur la promo affichée.
function droitsReels(profil, promo) {
  if (!profil) return { admin: false, prof: false, stagiaire: false, equipe: false, direction: false };
  const roles = rolesDe(promo);
  if (roles) {
    const formateur = roles.includes("formateur");
    const direction = roles.includes("direction");
    const siege = roles.includes("siege");
    return {
      admin: !!profil.is_founder || formateur,
      prof: formateur || direction || siege,
      stagiaire: roles.includes("stagiaire"),
      equipe: formateur || direction,
      direction,
    };
  }
  // État dégradé : l'ancien modèle.
  const prof = profil.role === "prof";
  return {
    admin: !!profil.is_admin,
    prof,
    stagiaire: profil.role === "stagiaire",
    equipe: !!profil.is_admin || prof,
    direction: false,
  };
}

// Les aperçus ouverts à cette personne sur cette promo : le fondateur, les quatre ; l'équipe de la promo
// affichée, « stagiaire » ; les autres, aucun.
export function apercusPermis({ profil, promo } = {}) {
  if (!profil) return [];
  if (profil.is_founder) return [...APERCUS];
  return droitsReels(profil, promo).equipe ? ["stagiaire"] : [];
}

function apercuRetenu({ profil, promo, apercu }) {
  const a = normaliserApercu(apercu);
  return a && apercusPermis({ profil, promo }).includes(a) ? a : null;
}

const DROITS_APERCU = {
  formateur: { admin: true, prof: true, stagiaire: false },
  direction: { admin: false, prof: true, stagiaire: false },
  siege: { admin: false, prof: true, stagiaire: false },
  stagiaire: { admin: false, prof: false, stagiaire: true },
};

// Ce que l'app montre : les drapeaux isAdmin / isProf / isStagiaire et l'espace de la coquille.
export function droitsAffiches({ profil, promo, apercu } = {}) {
  const a = apercuRetenu({ profil, promo, apercu });
  const d = a ? DROITS_APERCU[a] : droitsReels(profil, promo);
  return {
    admin: !!d.admin,
    prof: !!d.prof,
    stagiaire: !!d.stagiaire,
    espace: d.admin || d.prof ? "equipe" : "stagiaire",
  };
}

// Inviter un formateur : la direction du centre de la promo, le fondateur (hors aperçu, ou en aperçu direction).
export function peutInviterFormateur({ profil, promo, apercu } = {}) {
  if (!profil) return false;
  const a = apercuRetenu({ profil, promo, apercu });
  if (a) return a === "direction";
  return !!profil.is_founder || droitsReels(profil, promo).direction;
}

// Retirer l'accès d'un compte de la liste : jamais le fondateur ; un compte du personnel (formateur, direction,
// administrateur) seulement par le fondateur ; un stagiaire, oui (la base décide en dernier).
export function peutRetirerCompte({ cible, fondateur } = {}) {
  if (!cible || cible.is_founder) return false;
  const personnel = cible.role !== "stagiaire" || !!cible.is_admin;
  return personnel ? !!fondateur : true;
}

// Phrase d'un refus d'invitation : la base préfixe ses messages par « invitation: », que l'on retire.
export function messageInvitation(message) {
  const texte = String(message ?? "").replace(/^\s*invitation:\s*/i, "").trim();
  return texte || "Erreur d'invitation";
}
