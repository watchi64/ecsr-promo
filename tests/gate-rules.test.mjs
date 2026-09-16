import assert from "node:assert/strict";
import {
  MDP_MIN, validerEmail, validerMotDePasse, messageErreurAuth,
  lireJetonRecuperation, configMode,
} from "../js/gate-rules.js";

// Minimum aligne sur ce que le code exigeait deja a la creation de compte.
assert.equal(MDP_MIN, 8);

// Email : on refuse le vide et les formes evidentes, on tolere les espaces autour.
assert.equal(validerEmail("jean@exemple.fr"), null);
assert.equal(validerEmail("  jean@exemple.fr  "), null);
assert.equal(validerEmail(""), "Email invalide");
assert.equal(validerEmail("jean"), "Email invalide");
assert.equal(validerEmail("jean@exemple"), "Email invalide");
assert.equal(validerEmail(undefined), "Email invalide");

// Mot de passe : requis, longueur, puis correspondance quand une confirmation est demandee.
assert.equal(validerMotDePasse("motdepasse8"), null);
assert.equal(validerMotDePasse(""), "Mot de passe requis");
assert.equal(validerMotDePasse("court"), "Mot de passe : 8 caractères minimum");
assert.equal(validerMotDePasse("motdepasse8", "motdepasse8"), null);
assert.equal(validerMotDePasse("motdepasse8", "motdepasse9"), "Les deux mots de passe ne correspondent pas");
// Sans confirmation attendue, on ne compare rien.
assert.equal(validerMotDePasse("motdepasse8", undefined), null);

// Messages Supabase traduits (repris de l'ancien showGate).
assert.equal(messageErreurAuth("Invalid login credentials"), "Email ou mot de passe incorrect.");
assert.equal(messageErreurAuth("User already registered"), "Cet email a déjà un compte. Bascule sur la connexion.");
assert.equal(messageErreurAuth("Database error saving new user"), "Email non whitelisté. Demande à un admin de t'inviter d'abord.");
assert.equal(messageErreurAuth("For security purposes, you can only request this after 47 seconds"),
  "Trop de demandes. Patiente quelques minutes avant de réessayer.");
assert.equal(messageErreurAuth("Email rate limit exceeded"),
  "Trop de demandes. Patiente quelques minutes avant de réessayer.");
// Message inconnu : on le laisse passer tel quel plutot que de mentir.
assert.equal(messageErreurAuth("Boom"), "Boom");
assert.equal(messageErreurAuth(""), "Une erreur est survenue.");

// Jeton de recuperation : present, du bon type, sinon rien.
assert.equal(lireJetonRecuperation("?token_hash=abc123&type=recovery"), "abc123");
assert.equal(lireJetonRecuperation("?type=recovery&token_hash=abc123"), "abc123");
assert.equal(lireJetonRecuperation("?token_hash=abc123&type=signup"), null);
assert.equal(lireJetonRecuperation("?token_hash=abc123"), null);
assert.equal(lireJetonRecuperation("?type=recovery"), null);
assert.equal(lireJetonRecuperation(""), null);
assert.equal(lireJetonRecuperation(undefined), null);

// Descripteurs de mode : cinq modes, chacun complet.
for (const mode of ["signin", "signup", "reset-request", "reset-set", "reset-error"]) {
  const c = configMode(mode);
  assert.equal(typeof c.sousTitre, "string", mode + " : sousTitre");
  assert.equal(typeof c.bouton, "string", mode + " : bouton");
  assert.equal(typeof c.boutonEnCours, "string", mode + " : boutonEnCours");
  assert.equal(typeof c.champs.email, "boolean", mode + " : champs.email");
  assert.equal(typeof c.champs.password, "boolean", mode + " : champs.password");
  assert.equal(typeof c.champs.confirmation, "boolean", mode + " : champs.confirmation");
  assert.equal(typeof c.onglets, "boolean", mode + " : onglets");
}
// Un mode inconnu retombe sur la connexion plutot que de casser la carte.
assert.deepEqual(configMode("nimporte"), configMode("signin"));

// Les onglets Connexion / Creation n'existent que dans les deux modes d'entree.
assert.equal(configMode("signin").onglets, true);
assert.equal(configMode("signup").onglets, true);
assert.equal(configMode("reset-request").onglets, false);
assert.equal(configMode("reset-set").onglets, false);
assert.equal(configMode("reset-error").onglets, false);

// Le lien « Mot de passe oublie ? » ne s'affiche qu'en connexion.
assert.equal(configMode("signin").lienOubli, true);
assert.equal(configMode("signup").lienOubli, false);
assert.equal(configMode("reset-request").lienOubli, false);

// Champs attendus par mode.
assert.deepEqual(configMode("signin").champs, { email: true, password: true, confirmation: false });
assert.deepEqual(configMode("signup").champs, { email: true, password: true, confirmation: false });
assert.deepEqual(configMode("reset-request").champs, { email: true, password: false, confirmation: false });
assert.deepEqual(configMode("reset-set").champs, { email: false, password: true, confirmation: true });
assert.deepEqual(configMode("reset-error").champs, { email: false, password: false, confirmation: false });

// Retour vers la connexion propose sur deux des trois ecrans de recuperation.
assert.equal(configMode("reset-request").retour, true);
assert.equal(configMode("reset-set").retour, false);
assert.equal(configMode("reset-error").retour, true);

// Le mot de passe se saisit en « nouveau » partout sauf a la connexion.
assert.equal(configMode("signin").autocomplete, "current-password");
assert.equal(configMode("signup").autocomplete, "new-password");
assert.equal(configMode("reset-set").autocomplete, "new-password");

console.log("gate-rules : OK");
