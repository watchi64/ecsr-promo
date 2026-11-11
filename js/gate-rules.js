/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
// Logique pure de la carte d'authentification : validation, traduction des
// erreurs Supabase, lecture du jeton de récupération, description des modes.
// Aucun DOM ici, aucun appel réseau : c'est ce qui rend ce fichier testable.
// Formule neutre partout (ni « tu » ni « vous ») : personne n'est encore identifié sur cet écran.

export const MDP_MIN = 8;

export function validerEmail(email) {
  const v = (email || "").trim();
  return /^\S+@\S+\.\S+$/.test(v) ? null : "Adresse e-mail invalide";
}

// `confirmation` vaut undefined quand l'écran ne demande pas de confirmation :
// dans ce cas on ne compare rien.
export function validerMotDePasse(mdp, confirmation) {
  if (!mdp) return "Mot de passe requis";
  if (mdp.length < MDP_MIN) return "Mot de passe : " + MDP_MIN + " caractères minimum";
  if (confirmation !== undefined && mdp !== confirmation) {
    return "Les deux mots de passe ne correspondent pas";
  }
  return null;
}

export function messageErreurAuth(brut) {
  const msg = brut ? String(brut) : "";
  if (!msg) return "Une erreur est survenue.";
  if (/Invalid login credentials/i.test(msg)) return "E-mail ou mot de passe incorrect.";
  if (/User already registered/i.test(msg)) return "Cette adresse e-mail a déjà un compte : passer par l'onglet « Connexion ».";
  if (/non autorisé/i.test(msg) || /Database error/i.test(msg)) {
    return "Cette adresse e-mail n'a pas été invitée. L'inscription demande d'abord une invitation de l'équipe de formation.";
  }
  if (/For security purposes/i.test(msg) || /rate limit/i.test(msg)) {
    return "Trop de demandes. Merci de patienter quelques minutes avant de réessayer.";
  }
  return msg;
}

// Le lien du mail arrive en query string (jamais dans le fragment) : le routeur
// de l'app lit `location.hash` sous la forme `#/route` et ne doit pas etre touche.
export function lireJetonRecuperation(search) {
  const params = new URLSearchParams(search || "");
  const jeton = params.get("token_hash");
  if (!jeton) return null;
  if (params.get("type") !== "recovery") return null;
  return jeton;
}

const MODES = {
  "signin": {
    sousTitre: "Saisir l'adresse e-mail et le mot de passe du compte.",
    bouton: "Se connecter",
    boutonEnCours: "Connexion…",
    hint: "Pas encore de compte ? Passer par l'onglet « Créer un compte » (l'adresse e-mail doit avoir reçu une invitation).",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "current-password",
    onglets: true,
    lienOubli: true,
    retour: false,
  },
  "signup": {
    sousTitre: "Créer le compte : l'adresse e-mail invitée par l'équipe de formation, puis un mot de passe au choix.",
    bouton: "Créer mon compte",
    boutonEnCours: "Création…",
    hint: "Une invitation préalable est nécessaire : sans elle, l'inscription est refusée.",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "new-password",
    onglets: true,
    lienOubli: false,
    retour: false,
  },
  "reset-request": {
    sousTitre: "Saisir l'adresse e-mail du compte : un lien pour choisir un nouveau mot de passe y sera envoyé.",
    bouton: "Envoyer le lien",
    boutonEnCours: "Envoi…",
    hint: "Le lien est valable une heure.",
    champs: { email: true, password: false, confirmation: false },
    autocomplete: null,
    onglets: false,
    lienOubli: false,
    retour: true,
  },
  "reset-set": {
    sousTitre: "Choisir un nouveau mot de passe (" + MDP_MIN + " caractères minimum).",
    bouton: "Enregistrer",
    boutonEnCours: "Enregistrement…",
    hint: "",
    champs: { email: false, password: true, confirmation: true },
    autocomplete: "new-password",
    onglets: false,
    lienOubli: false,
    retour: false,
  },
  "reset-error": {
    sousTitre: "Ce lien n'est plus valable : il a expiré ou il a déjà servi.",
    bouton: "Demander un nouveau lien",
    boutonEnCours: "…",
    hint: "",
    champs: { email: false, password: false, confirmation: false },
    autocomplete: null,
    onglets: false,
    lienOubli: false,
    retour: true,
  },
};

export function configMode(mode) {
  return MODES[mode] || MODES["signin"];
}
