/**
 * Identité — auth-driven (post refonte invitation).
 * Plus de prénom anonyme en localStorage : l'identité vient du profil Supabase.
 */
import { getProfileWho, getAdminEmail } from "./auth-admin.js?v=20260629b";

/** Renvoie un identifiant lisible pour la personne courante. */
export function getCurrentWho() {
  return getProfileWho() || getAdminEmail() || "Anonyme";
}

/** Compat : ancien import dans config.js. Retourne le prénom courant ou null. */
export function getStoredWho() {
  return getProfileWho() || null;
}

/** No-op : conservé pour compat avec d'anciens imports éventuels. */
export async function ensureIdentity() { return getCurrentWho(); }
