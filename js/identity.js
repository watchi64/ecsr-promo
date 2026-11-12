/**
 * Identité : auth-driven (post refonte invitation).
 * Plus de prénom anonyme en localStorage : l'identité vient du profil Supabase.
 */
import { getProfileWho, getAdminEmail } from "./auth-admin.js?v=20261112d";

/** Renvoie un identifiant lisible pour la personne courante. */
export function getCurrentWho() {
  return getProfileWho() || getAdminEmail() || "Anonyme";
}
