/**
 * IdentitÃ© â€” auth-driven (post refonte invitation).
 * Plus de prÃ©nom anonyme en localStorage : l'identitÃ© vient du profil Supabase.
 */
import { getProfileWho, getAdminEmail } from "./auth-admin.js?v=20260703b";

/** Renvoie un identifiant lisible pour la personne courante. */
export function getCurrentWho() {
  return getProfileWho() || getAdminEmail() || "Anonyme";
}

/** Compat : ancien import dans config.js. Retourne le prÃ©nom courant ou null. */
export function getStoredWho() {
  return getProfileWho() || null;
}

/** No-op : conservÃ© pour compat avec d'anciens imports Ã©ventuels. */
export async function ensureIdentity() { return getCurrentWho(); }
