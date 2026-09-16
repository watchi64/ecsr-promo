/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
// Logique pure de la carte d'authentification : validation, traduction des
// erreurs Supabase, lecture du jeton de récupération, description des modes.
// Aucun DOM ici, aucun appel réseau : c'est ce qui rend ce fichier testable.

export const MDP_MIN = 8;

export function validerEmail(email) {
  const v = (email || "").trim();
  return /^\S+@\S+\.\S+$/.test(v) ? null : "Email invalide";
}

// `confirmation` vaut undefined quand l'écran ne demande pas de confirmation :
// dans ce cas on ne compare rien.
export function validerMotDePasse(mdp, confirmation) {
  if (!mdp) return "Mot de passe requis";
  if (mdp.length < MDP_MIN) return "Mot de passe : " + MDP_MIN + " caracteres minimum";
  if (confirmation !== undefined && mdp !== confirmation) {
    return "Les deux mots de passe ne correspondent pas";
  }
  return null;
}

export function messageErreurAuth(brut) {
  const msg = brut ? String(brut) : "";
  if (!msg) return "Une erreur est survenue.";
  if (/Invalid login credentials/i.test(msg)) return "Email ou mot de passe incorrect.";
  if (/User already registered/i.test(msg)) return "Cet email a deja un compte. Bascule sur la connexion.";
  if (/non autorisé/i.test(msg) || /Database error/i.test(msg)) {
    return "Email non whitelisté. Demande a un admin de t'inviter d'abord.";
  }
  if (/For security purposes/i.test(msg) || /rate limit/i.test(msg)) {
    return "Trop de demandes. Patiente quelques minutes avant de reessayer.";
  }
  return msg;
}

// Le lien du mail arrive en query string (jamais dans le fragment) : le routeur
// de l'app lit `location.hash` sous la forme `#/route` et ne doit pas etre touche.
export function lireJetonRecuperation(search) {
  let params;
  try {
    params = new URLSearchParams(search || "");
  } catch (e) {
    return null;
  }
  const jeton = params.get("token_hash");
  if (!jeton) return null;
  if (params.get("type") !== "recovery") return null;
  return jeton;
}

const MODES = {
  "signin": {
    sousTitre: "Entre ton email et ton mot de passe.",
    bouton: "Se connecter",
    boutonEnCours: "Connexion…",
    hint: "Pas encore inscrit ? Bascule sur « Créer un compte » (ton email doit être whitelisté).",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "current-password",
    onglets: true,
    lienOubli: true,
    retour: false,
  },
  "signup": {
    sousTitre: "Crée ton compte : email (whitelisté par un admin) + choisis un mot de passe.",
    bouton: "Créer mon compte",
    boutonEnCours: "Création…",
    hint: "Tu dois avoir été invité au préalable. Sinon l'inscription sera refusée.",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "new-password",
    onglets: true,
    lienOubli: false,
    retour: false,
  },
  "reset-request": {
    sousTitre: "Entre ton email : on t'envoie un lien pour choisir un nouveau mot de passe.",
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
    sousTitre: "Choisis ton nouveau mot de passe (" + MDP_MIN + " caractères minimum).",
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
