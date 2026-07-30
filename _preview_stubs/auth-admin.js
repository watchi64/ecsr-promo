// Stub d'auth pour le banc d'essai du Dossier Professionnel (_preview_dp_vue.html).
// Injecté à la place de js/auth-admin.js par l'import map du banc : permet de
// jouer les deux rôles sans authentification et sans toucher la base de prod.
//
// Le rôle vient du paramètre ?role= de l'URL : « stagiaire » (défaut) ou
// « formateur ». Exporte aussi getProfileWho / getAdminEmail, dont dépend le
// vrai js/identity.js, laissé réel.

const params = new URLSearchParams(location.search);
const ROLE = params.get("role") === "formateur" ? "formateur" : "stagiaire";
// Stagiaire simulé : id 15, celui du profil de démonstration du banc.
const MON_ID = Number(params.get("stagiaire") || 15);

export function isAdmin() { return ROLE === "formateur"; }
export function isProf() { return ROLE === "formateur"; }
export function isStagiaire() { return ROLE === "stagiaire"; }
export function isFounder() { return false; }
export function getViewAs() { return null; }
export function isAuth() { return true; }

export function getProfile() {
  return ROLE === "formateur"
    ? { email: "formateur@test.local", role: "prof", prof_id: 1, stagiaire_id: null, is_admin: true }
    : { email: "stagiaire@test.local", role: "stagiaire", stagiaire_id: MON_ID, is_admin: false };
}

export function getProfileWho() { return ROLE === "formateur" ? "Formateur test" : "Stagiaire test"; }
export function getAdminEmail() { return getProfile().email; }
export function onAdminChange() { /* no-op */ }
