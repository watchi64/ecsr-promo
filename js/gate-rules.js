/*
 * Jalonya : application propriétaire.
 * © 2026 Timy Studio. Tous droits réservés. Voir LICENSE.
 */
// Logique pure de la carte d'authentification : validation, traduction des
// erreurs Supabase, lecture du jeton de récupération, description des modes.
// Aucun DOM ici, aucun appel réseau : c'est ce qui rend ce fichier testable.
// Vouvoiement, comme toute l'app depuis le 10/11 et la charte Jalonya (textes repris le 27/11/2026).

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
  if (/User already registered/i.test(msg)) return "Cette adresse e-mail a déjà un compte : utilisez l'onglet « Connexion ».";
  if (/non autorisé/i.test(msg) || /Database error/i.test(msg)) {
    return "Cette adresse e-mail n'a pas été invitée. Le compte se crée après une invitation de votre centre de formation.";
  }
  if (/For security purposes/i.test(msg) || /rate limit/i.test(msg)) {
    return "Trop de demandes. Patientez quelques minutes avant de réessayer.";
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
    titre: "Bienvenue",
    sousTitre: "Connectez-vous avec l'adresse e-mail de votre compte.",
    bouton: "Se connecter",
    boutonEnCours: "Connexion…",
    hint: "Pas encore de compte ? Il se crée sur invitation de votre centre de formation.",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "current-password",
    onglets: true,
    lienOubli: true,
    retour: false,
  },
  "signup": {
    titre: "Créer votre compte",
    sousTitre: "Avec l'adresse e-mail qui a reçu l'invitation de votre centre de formation, puis un mot de passe de votre choix.",
    bouton: "Créer mon compte",
    boutonEnCours: "Création…",
    hint: "Sans invitation de votre centre, la création du compte est refusée.",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "new-password",
    onglets: true,
    lienOubli: false,
    retour: false,
  },
  "reset-request": {
    titre: "Mot de passe oublié",
    sousTitre: "Indiquez l'adresse e-mail de votre compte : un lien pour choisir un nouveau mot de passe y sera envoyé.",
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
    titre: "Nouveau mot de passe",
    sousTitre: "Choisissez un nouveau mot de passe (" + MDP_MIN + " caractères au moins).",
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
    titre: "Lien expiré",
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
