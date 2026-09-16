# Mot de passe oublié : plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUIS : utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes sont des cases à cocher (`- [ ]`).

**Objectif :** un stagiaire qui a oublié son mot de passe se débloque seul, par un lien reçu par email, sans intervention d'un admin.

**Architecture :** la logique pure (validation, messages, modes de la carte, lecture du jeton) part dans `js/gate-rules.js`, testée comme les autres `*-rules.js`. Le DOM de la carte d'authentification quitte `main.js` pour `js/gate.js`. `db.js` garde le monopole de Supabase avec trois enveloppes de plus. Le retour depuis l'email passe par `?token_hash=...&type=recovery` en query string, lu au démarrage avant tout routage.

**Stack :** JavaScript ES modules natifs (pas de bundler), Supabase JS v2 chargé depuis esm.sh, tests en `node:assert/strict` exécutés par `node`, hébergement GitHub Pages.

**Spec :** `docs/superpowers/specs/2026-09-16-mot-de-passe-oublie-design.md`

## Contraintes globales

- **Worktree :** `C:\Users\watch\Dev\ECSR\ecsr-promo-mdp-oublie`, branche `mdp-oublie`. Ne jamais écrire dans `TP_ECSR_App` sauf là où une tâche le demande explicitement (fichiers de banc).
- **Jeton de cache figé :** sur une branche de feature, le hook `pre-commit` ne re-versionne PAS. Tout nouvel import JS s'écrit avec le jeton déjà en place dans le fichier qui importe, aujourd'hui `?v=20260916a`. Ne jamais inventer un jeton.
- **Zéro tiret cadratin** (U+2014) dans le code, les commentaires, les messages et les commits. Règle du projet, sans exception.
- **Français dans l'interface**, tutoiement (la gate tutoie déjà : « Entre ton email »).
- **Minimum de mot de passe : 8 caractères**, partout, y compris les textes d'aide.
- **Une entrée Nouveautés dans le commit qui met en prod** (`js/nouveautes-data.js`), sans vocabulaire technique ni nom de fichier.
- **Le pane de navigateur ne peint jamais cette app** : aucune capture d'écran, `elementFromPoint` inutilisable, défilement inobservable. Toute vérification d'interface se fait par assertions JavaScript sur le DOM (`textContent`, `classList`, `getComputedStyle`), jamais par lecture visuelle.
- **Le banc d'essai n'est pas versionné** (`_harness_supabase.js`, `_harness_build.mjs`, `_harness.html`, exclus via `.git/info/exclude`, partagé par tous les worktrees). Tout enrichissement du stub se fait **dans `TP_ECSR_App`** puis se recopie dans le worktree, sinon il meurt avec la branche.
- **Commits fréquents**, un par tâche au minimum.

---

## Tâche 0 : configuration Resend et Supabase (action utilisateur, hors code)

Cette tâche ne produit aucun code applicatif. Elle bloque la seule vérification bout-en-bout (tâche 9), pas le développement : les tâches 1 à 8 se font et se vérifient au banc sans elle.

**Fichiers :**
- Créer : `docs/config-email-supabase.md`

- [ ] **Étape 1 : créer le compte Resend et vérifier le domaine**

Sur resend.com, offre gratuite. Ajouter le domaine `timy-studio.fr`, puis poser chez le registrar les trois enregistrements DNS affichés par Resend (SPF, DKIM, DMARC). Attendre que Resend affiche le domaine « Verified ». Créer ensuite une clé API, qui sert de mot de passe SMTP.

- [ ] **Étape 2 : brancher le SMTP dans Supabase**

Tableau de bord du projet `crpduennbqaemhfaywrz`, Authentication, Emails, SMTP Settings, Enable Custom SMTP.

```
Host           : smtp.resend.com
Port           : 587
Username       : resend
Password       : <la cle API Resend>
Sender email   : no-reply@timy-studio.fr
Sender name    : Promo ECSR
```

- [ ] **Étape 3 : autoriser les URL de redirection**

Authentication, URL Configuration, Redirect URLs, ajouter les deux lignes :

```
https://watchi64.github.io/ecsr-promo/
http://localhost:8000/
```

- [ ] **Étape 4 : réécrire le template « Reset Password »**

Authentication, Emails, Templates, Reset Password. Objet : `Réinitialiser ton mot de passe (Promo ECSR)`. Corps :

```html
<h2>Nouveau mot de passe</h2>
<p>Tu as demandé à réinitialiser ton mot de passe sur l'app de la promo ECSR.</p>
<p><a href="https://watchi64.github.io/ecsr-promo/?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a></p>
<p>Ce lien est valable une heure et ne sert qu'une fois.</p>
<p>Si tu n'as rien demandé, ignore ce message : ton mot de passe reste inchangé.</p>
```

Le lien DOIT être construit sur `{{ .TokenHash }}` et non sur `{{ .ConfirmationURL }}` : c'est ce qui permet d'ouvrir le mail sur un autre appareil que celui de la demande.

- [ ] **Étape 5 : réduire la durée de validité**

Authentication, Emails, « Email OTP Expiration » : passer de 86400 à 3600 secondes.

- [ ] **Étape 6 : tracer la configuration dans le dépôt**

Créer `docs/config-email-supabase.md` reprenant les étapes 2 à 5 (hôte, port, expéditeur, URL autorisées, template, durée), **sans la clé API**. Raison : cette configuration vit dans un tableau de bord, elle disparaît de la mémoire du projet si rien ne la consigne.

- [ ] **Étape 7 : commit**

```bash
git add docs/config-email-supabase.md
git commit -m "Doc : configuration SMTP Resend et template de reinitialisation"
```

---

## Tâche 1 : `js/gate-rules.js`, la logique pure de la carte

**Fichiers :**
- Créer : `js/gate-rules.js`
- Créer : `tests/gate-rules.test.mjs`

**Interfaces :**
- Consomme : rien.
- Produit : `MDP_MIN` (number, 8), `validerEmail(email) -> string|null`, `validerMotDePasse(mdp, confirmation) -> string|null`, `messageErreurAuth(brut) -> string`, `lireJetonRecuperation(search) -> string|null`, `configMode(mode) -> objet descripteur`. Le descripteur a exactement les clés `sousTitre`, `bouton`, `boutonEnCours`, `hint`, `champs` (`{ email, password, confirmation }`, booléens), `autocomplete` (string ou null), `onglets` (booléen), `lienOubli` (booléen), `retour` (booléen).

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/gate-rules.test.mjs` :

```javascript
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
assert.equal(validerMotDePasse("court"), "Mot de passe : 8 caracteres minimum");
assert.equal(validerMotDePasse("motdepasse8", "motdepasse8"), null);
assert.equal(validerMotDePasse("motdepasse8", "motdepasse9"), "Les deux mots de passe ne correspondent pas");
// Sans confirmation attendue, on ne compare rien.
assert.equal(validerMotDePasse("motdepasse8", undefined), null);

// Messages Supabase traduits (repris de l'ancien showGate).
assert.equal(messageErreurAuth("Invalid login credentials"), "Email ou mot de passe incorrect.");
assert.equal(messageErreurAuth("User already registered"), "Cet email a deja un compte. Bascule sur la connexion.");
assert.equal(messageErreurAuth("Database error saving new user"), "Email non whitelist\u00e9. Demande a un admin de t'inviter d'abord.");
assert.equal(messageErreurAuth("For security purposes, you can only request this after 47 seconds"),
  "Trop de demandes. Patiente quelques minutes avant de reessayer.");
assert.equal(messageErreurAuth("Email rate limit exceeded"),
  "Trop de demandes. Patiente quelques minutes avant de reessayer.");
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
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
node tests/gate-rules.test.mjs
```

Attendu : échec `ERR_MODULE_NOT_FOUND` sur `../js/gate-rules.js`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `js/gate-rules.js` :

```javascript
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
  if (/non autoris\u00e9/i.test(msg) || /Database error/i.test(msg)) {
    return "Email non whitelist\u00e9. Demande a un admin de t'inviter d'abord.";
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
    boutonEnCours: "Connexion\u2026",
    hint: "Pas encore inscrit ? Bascule sur \u00ab Cr\u00e9er un compte \u00bb (ton email doit \u00eatre whitelist\u00e9).",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "current-password",
    onglets: true,
    lienOubli: true,
    retour: false,
  },
  "signup": {
    sousTitre: "Cr\u00e9e ton compte : email (whitelist\u00e9 par un admin) + choisis un mot de passe.",
    bouton: "Cr\u00e9er mon compte",
    boutonEnCours: "Cr\u00e9ation\u2026",
    hint: "Tu dois avoir \u00e9t\u00e9 invit\u00e9 au pr\u00e9alable. Sinon l'inscription sera refus\u00e9e.",
    champs: { email: true, password: true, confirmation: false },
    autocomplete: "new-password",
    onglets: true,
    lienOubli: false,
    retour: false,
  },
  "reset-request": {
    sousTitre: "Entre ton email : on t'envoie un lien pour choisir un nouveau mot de passe.",
    bouton: "Envoyer le lien",
    boutonEnCours: "Envoi\u2026",
    hint: "Le lien est valable une heure.",
    champs: { email: true, password: false, confirmation: false },
    autocomplete: null,
    onglets: false,
    lienOubli: false,
    retour: true,
  },
  "reset-set": {
    sousTitre: "Choisis ton nouveau mot de passe (" + MDP_MIN + " caract\u00e8res minimum).",
    bouton: "Enregistrer",
    boutonEnCours: "Enregistrement\u2026",
    hint: "",
    champs: { email: false, password: true, confirmation: true },
    autocomplete: "new-password",
    onglets: false,
    lienOubli: false,
    retour: false,
  },
  "reset-error": {
    sousTitre: "Ce lien n'est plus valable : il a expir\u00e9 ou il a d\u00e9j\u00e0 servi.",
    bouton: "Demander un nouveau lien",
    boutonEnCours: "\u2026",
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
```

- [ ] **Étape 4 : relancer le test et vérifier qu'il passe**

```bash
node tests/gate-rules.test.mjs
```

Attendu : `gate-rules : OK`, code de sortie 0.

- [ ] **Étape 5 : vérifier l'absence de tiret cadratin**

```bash
node -e "const s=require('fs').readFileSync('js/gate-rules.js','utf8');console.log('em-dash:',(s.match(/\u2014/g)||[]).length)"
```

Attendu : `em-dash: 0`.

- [ ] **Étape 6 : commit**

```bash
git add js/gate-rules.js tests/gate-rules.test.mjs
git commit -m "Gate : logique pure extraite et testee (validation, messages, modes)"
```

---

## Tâche 2 : les trois enveloppes Supabase dans `db.js`, et le banc qui va avec

**Fichiers :**
- Modifier : `js/db.js` (section « Auth », après `signUpWithPassword`, ligne 1160 environ)
- Modifier : `C:\Users\watch\Dev\ECSR\TP_ECSR_App\_harness_supabase.js` (hors versionnage, dépôt principal)
- Copier : les fichiers de banc depuis `TP_ECSR_App` vers le worktree

**Interfaces :**
- Consomme : `supabase` (client déjà exporté par `db.js`).
- Produit : `requestPasswordReset(email) -> Promise<void>`, `verifyRecoveryToken(tokenHash) -> Promise<{ user, session }>`, `updatePassword(password) -> Promise<void>`. Les trois lèvent l'erreur Supabase telle quelle ; la traduction est le travail de `messageErreurAuth`.

- [ ] **Étape 1 : ajouter les trois fonctions dans `js/db.js`**

Les insérer juste après `signUpWithPassword`, avant `signOut` :

```javascript
// URL de retour du mail de réinitialisation. Doit figurer dans les Redirect URLs
// du tableau de bord Supabase, sinon le lien est refusé.
const URL_RETOUR = location.hostname === "localhost"
  ? location.origin + "/"
  : "https://watchi64.github.io/ecsr-promo/";

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: URL_RETOUR },
  );
  if (error) throw error;
}

// Le lien du mail porte un `token_hash` : on l'échange contre une session de
// récupération. Ce chemin marche d'un appareil à l'autre, contrairement au PKCE
// qui exigerait le même navigateur que la demande.
export async function verifyRecoveryToken(tokenHash) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
```

- [ ] **Étape 2 : vérifier la syntaxe**

```bash
node --check js/db.js
```

Attendu : aucune sortie, code 0. Rappel : `node --check` ne prouve que la syntaxe, jamais le comportement.

- [ ] **Étape 3 : enrichir le stub du banc dans le dépôt principal**

Ouvrir `C:\Users\watch\Dev\ECSR\TP_ECSR_App\_harness_supabase.js` et compléter l'objet `auth` du client factice avec les trois méthodes ci-dessous. La méthode voisine `auth.getUser` donne le style exact à suivre.

```javascript
    // Réinitialisation de mot de passe : le banc journalise et n'envoie rien.
    // `window.__HARNESS_RESET_FAIL` permet de jouer la branche d'erreur.
    resetPasswordForEmail: async (email, options) => {
      console.log("[banc] resetPasswordForEmail", email, options);
      if (window.__HARNESS_RESET_FAIL) {
        return { data: null, error: { message: window.__HARNESS_RESET_FAIL } };
      }
      return { data: {}, error: null };
    },
    // Un jeton factice est valide s'il vaut "bon-jeton". Tout le reste simule
    // un lien expiré ou déjà consommé.
    verifyOtp: async ({ token_hash, type }) => {
      console.log("[banc] verifyOtp", token_hash, type);
      if (token_hash === "bon-jeton" && type === "recovery") {
        return { data: { user: { id: "banc-user", email: "banc@exemple.fr" }, session: {} }, error: null };
      }
      return { data: null, error: { message: "Token has expired or is invalid" } };
    },
    updateUser: async (attrs) => {
      console.log("[banc] updateUser", Object.keys(attrs));
      if (window.__HARNESS_UPDATE_FAIL) {
        return { data: null, error: { message: window.__HARNESS_UPDATE_FAIL } };
      }
      return { data: { user: { id: "banc-user" } }, error: null };
    },
```

Raison du détour par le dépôt principal : ces fichiers ne sont pas versionnés, un enrichissement fait uniquement dans le worktree disparaîtrait avec la branche. Leçon payée le 2026-08-08.

- [ ] **Étape 4 : recopier le banc dans le worktree**

```bash
cp "C:/Users/watch/Dev/ECSR/TP_ECSR_App/_harness_supabase.js" "C:/Users/watch/Dev/ECSR/ecsr-promo-mdp-oublie/_harness_supabase.js"
cp "C:/Users/watch/Dev/ECSR/TP_ECSR_App/_harness_build.mjs" "C:/Users/watch/Dev/ECSR/ecsr-promo-mdp-oublie/_harness_build.mjs"
git -C "C:/Users/watch/Dev/ECSR/ecsr-promo-mdp-oublie" status --short
```

Attendu : `js/db.js` modifié, et **aucune** trace des fichiers `_harness_*` (exclus via `.git/info/exclude`, partagé par tous les worktrees). Si le banc apparaît dans `git status`, arrêter et vérifier l'exclusion avant tout commit.

- [ ] **Étape 5 : commit**

```bash
git add js/db.js
git commit -m "Auth : enveloppes Supabase pour la reinitialisation de mot de passe"
```

---

## Tâche 3 : extraire la carte d'authentification dans `js/gate.js`, sans rien changer au comportement

Tâche de déplacement pur. Aucun mode nouveau ici : à la fin, connexion et création marchent exactement comme avant. C'est ce qui rend la tâche 4 relisible.

**Fichiers :**
- Créer : `js/gate.js`
- Modifier : `js/main.js` (suppression de `showGate`/`hideGate`, lignes 27 à 118 environ, plus les imports devenus inutiles)

**Interfaces :**
- Consomme : `signInWithPassword`, `signUpWithPassword` (de `db.js`) ; `validerEmail`, `validerMotDePasse`, `messageErreurAuth`, `configMode` (de `gate-rules.js`).
- Produit : `showGate(mode = "signin") -> void` et `hideGate() -> void`, importés par `main.js`.

- [ ] **Étape 1 : créer `js/gate.js` avec le code déplacé**

Le contenu reprend `showGate`/`hideGate` de `main.js` en remplaçant les validations et les textes en dur par `gate-rules.js`. Noter le jeton `?v=20260916a` sur les imports : il est figé sur cette branche.

```javascript
/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
// La carte d'authentification et ses modes. Sortie de main.js, qui redevient le
// fichier du démarrage et des routes.
import { signInWithPassword, signUpWithPassword } from "./db.js?v=20260916a";
import { validerEmail, validerMotDePasse, messageErreurAuth, configMode } from "./gate-rules.js?v=20260916a";

export function showGate(mode = "signin") {
  const gate = document.getElementById("gate");
  const tabs = document.querySelector(".gate-tabs");
  const tabSignin = document.getElementById("gate-tab-signin");
  const tabSignup = document.getElementById("gate-tab-signup");
  const subtitle = document.getElementById("gate-subtitle");
  const emailInput = document.getElementById("gate-email");
  const passwordInput = document.getElementById("gate-password");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");
  const hint = document.getElementById("gate-hint");

  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");

  let courant = mode;

  function setMode(next) {
    courant = next;
    const c = configMode(next);
    tabs.classList.toggle("hidden", !c.onglets);
    tabSignin.classList.toggle("active", next === "signin");
    tabSignup.classList.toggle("active", next === "signup");
    subtitle.textContent = c.sousTitre;
    submit.textContent = c.bouton;
    emailInput.classList.toggle("hidden", !c.champs.email);
    passwordInput.classList.toggle("hidden", !c.champs.password);
    if (c.autocomplete) passwordInput.autocomplete = c.autocomplete;
    hint.textContent = c.hint;
    error.classList.add("hidden");
    submit.disabled = false;
  }

  tabSignin.onclick = () => setMode("signin");
  tabSignup.onclick = () => setMode("signup");
  setMode(courant);
  emailInput.focus();

  const echec = (msg) => {
    error.textContent = msg;
    error.classList.remove("hidden");
  };

  const handler = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const erreurEmail = validerEmail(email);
    if (erreurEmail) return echec(erreurEmail);
    // À la connexion, seule la présence compte : le vrai mot de passe est
    // validé par le serveur, et un ancien compte peut être plus court.
    const erreurMdp = courant === "signup"
      ? validerMotDePasse(password)
      : (password ? null : "Mot de passe requis");
    if (erreurMdp) return echec(erreurMdp);

    error.classList.add("hidden");
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = configMode(courant).boutonEnCours;
    try {
      if (courant === "signup") await signUpWithPassword(email, password);
      else await signInWithPassword(email, password);
      // initAuth() est déjà câblé via onAuthChange ; le polling watch bootera l'app.
    } catch (e) {
      console.error("Gate auth error:", e);
      echec(messageErreurAuth(e?.message || String(e)));
      submit.disabled = false;
      submit.textContent = original;
    }
  };

  submit.onclick = handler;
  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); handler(); } };
  emailInput.onkeydown = onEnter;
  passwordInput.onkeydown = onEnter;
}

export function hideGate() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}
```

- [ ] **Étape 2 : alléger `js/main.js`**

Supprimer le bloc `// ===== Gate : email magic link =====` avec `showGate()` et `hideGate()` (de la ligne 27 jusqu'à la fin de `hideGate`). À la place, ajouter l'import auprès des autres :

```javascript
import { showGate, hideGate } from "./gate.js?v=20260916a";
```

Puis nettoyer la ligne d'import de `db.js` : `signInWithPassword` et `signUpWithPassword` ne servent plus dans `main.js`. Elle devient :

```javascript
import { getCurrentUser, invalidateCache } from "./db.js?v=20260916a";
```

Ne pas toucher aux imports de `icon` et `toast` : ils restent utilisés ailleurs dans `main.js`.

- [ ] **Étape 3 : vérifier la syntaxe et l'absence d'import mort**

```bash
node --check js/gate.js && node --check js/main.js
grep -n "signInWithPassword\|signUpWithPassword" js/main.js
```

Attendu : les deux `--check` silencieux, et le `grep` sans aucun résultat.

- [ ] **Étape 4 : vérifier au banc que la connexion marche comme avant**

```bash
node _harness_build.mjs
python -m http.server 8001
```

Ouvrir `http://localhost:8001/_harness.html` dans le pane, et mesurer par JavaScript (le pane ne peint pas cette app, donc aucune capture ne servira) :

```javascript
JSON.stringify({
  gateVisible: !document.getElementById("gate").classList.contains("hidden"),
  bouton: document.getElementById("gate-submit").textContent,
  sousTitre: document.getElementById("gate-subtitle").textContent,
  ongletsVisibles: !document.querySelector(".gate-tabs").classList.contains("hidden"),
})
```

Attendu : `bouton` vaut `Se connecter`, `ongletsVisibles` vaut `true`. Puis basculer sur la création :

```javascript
document.getElementById("gate-tab-signup").click();
document.getElementById("gate-submit").textContent
```

Attendu : `Créer mon compte`.

- [ ] **Étape 5 : commit**

```bash
git add js/gate.js js/main.js
git commit -m "Gate : la carte d'authentification sort de main.js"
```

---

## Tâche 4 : le balisage et le style des nouveaux écrans

**Fichiers :**
- Modifier : `index.html` (bloc `<!-- Password gate -->`, lignes 35 à 55)
- Modifier : `css/style.css` (règles ajoutées après `.gate-hint`, ligne 2756 environ)

**Interfaces :**
- Produit : les identifiants `gate-confirmation`, `gate-oubli`, `gate-retour`, `gate-info`, et les classes `.gate-link` et `.gate-info`, tous consommés par `js/gate.js` aux tâches 5 et 6.

- [ ] **Étape 1 : compléter la carte dans `index.html`**

Remplacer le contenu de `.gate-card` (du `<div class="gate-form">` jusqu'au `<p class="muted gate-hint">` inclus) par :

```html
      <div class="gate-form">
        <input type="email" id="gate-email" placeholder="ton.email@exemple.fr" autocomplete="email" />
        <input type="password" id="gate-password" placeholder="Mot de passe (min. 8 caractères)" autocomplete="current-password" />
        <input type="password" id="gate-confirmation" class="hidden" placeholder="Confirme le mot de passe" autocomplete="new-password" />
        <button id="gate-submit" class="btn primary">Se connecter</button>
      </div>
      <p class="error hidden" id="gate-error"></p>
      <p class="gate-info hidden" id="gate-info"></p>
      <button type="button" class="gate-link" id="gate-oubli">Mot de passe oublié ?</button>
      <button type="button" class="gate-link hidden" id="gate-retour">Retour à la connexion</button>
      <p class="muted gate-hint" id="gate-hint">Pas encore inscrit ? Demande à un admin d'ajouter ton email à la liste, puis clique « Créer un compte ».</p>
```

Trois changements à ne pas manquer : le placeholder passe de 6 à 8 caractères (l'ancien mentait, le code exigeait déjà 8), le champ de confirmation naît caché, et `#gate-info` porte le message neutre de confirmation d'envoi, distinct de `#gate-error`.

- [ ] **Étape 2 : ajouter les règles de style**

Dans `css/style.css`, juste après le bloc `.gate-hint` :

```css
/* Lien discret sous le bouton de la gate (oubli, retour). Bouton plutôt que
   lien : aucune navigation, on change de mode dans la même carte. */
.gate-link {
  background: none;
  border: none;
  padding: 0;
  margin-top: 0.7rem;
  font: inherit;
  font-size: 0.82rem;
  color: var(--muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.gate-link:hover { color: var(--accent); }

.gate-info {
  margin-top: 0.9rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--text);
}
```

- [ ] **Étape 3 : vérifier que les identifiants existent et que le style s'applique**

```bash
node _harness_build.mjs
```

Dans le pane, sur `_harness.html` :

```javascript
JSON.stringify({
  confirmation: !!document.getElementById("gate-confirmation"),
  oubli: document.getElementById("gate-oubli")?.textContent,
  retour: !!document.getElementById("gate-retour"),
  info: !!document.getElementById("gate-info"),
  souligne: getComputedStyle(document.getElementById("gate-oubli")).textDecorationLine,
  placeholder: document.getElementById("gate-password").placeholder,
})
```

Attendu : `confirmation`, `retour` et `info` à `true`, `oubli` à `Mot de passe oublié ?`, `souligne` à `underline`, `placeholder` contenant `8 caractères`. La valeur calculée du style est fiable même sans peinture : c'est la méthode retenue sur cette app.

- [ ] **Étape 4 : commit**

```bash
git add index.html css/style.css
git commit -m "Gate : balisage et style des ecrans de reinitialisation"
```

---

## Tâche 5 : la demande de lien

**Fichiers :**
- Modifier : `js/gate.js`

**Interfaces :**
- Consomme : `requestPasswordReset` (tâche 2), `configMode`, `validerEmail` (tâche 1), les identifiants du balisage (tâche 4).
- Produit : le mode `reset-request` opérationnel, atteignable par `showGate("reset-request")` et par le lien « Mot de passe oublié ? ».

- [ ] **Étape 1 : compléter l'import de `db.js` dans `js/gate.js`**

```javascript
import { signInWithPassword, signUpWithPassword, requestPasswordReset } from "./db.js?v=20260916a";
```

- [ ] **Étape 2 : câbler les nouveaux éléments dans `showGate`**

Ajouter les références aux éléments, juste après `const hint = ...` :

```javascript
  const confirmation = document.getElementById("gate-confirmation");
  const oubli = document.getElementById("gate-oubli");
  const retour = document.getElementById("gate-retour");
  const info = document.getElementById("gate-info");
```

Puis compléter `setMode`, à la suite des lignes existantes et avant `submit.disabled = false;` :

```javascript
    confirmation.classList.toggle("hidden", !c.champs.confirmation);
    oubli.classList.toggle("hidden", !c.lienOubli);
    retour.classList.toggle("hidden", !c.retour);
    info.classList.add("hidden");
    passwordInput.placeholder = next === "signin"
      ? "Mot de passe"
      : "Nouveau mot de passe (min. 8 caract\u00e8res)";
```

Et les deux gestionnaires, à côté de `tabSignin.onclick` :

```javascript
  oubli.onclick = () => setMode("reset-request");
  retour.onclick = () => setMode("signin");
```

- [ ] **Étape 3 : ajouter le verrou de 60 secondes et l'envoi**

Au-dessus de `const handler = ...` :

```javascript
  // Verrou d'envoi : au-delà du plafond horaire appliqué par Supabase, on
  // empêche le matraquage du bouton, qui n'apporte rien à l'utilisateur.
  let verrouJusqua = 0;

  async function envoyerLien() {
    const email = emailInput.value.trim();
    const erreurEmail = validerEmail(email);
    if (erreurEmail) return echec(erreurEmail);
    const reste = Math.ceil((verrouJusqua - Date.now()) / 1000);
    if (reste > 0) return echec("Patiente " + reste + " secondes avant un nouvel envoi.");

    error.classList.add("hidden");
    submit.disabled = true;
    submit.textContent = configMode("reset-request").boutonEnCours;
    try {
      await requestPasswordReset(email);
    } catch (e) {
      // On journalise, mais on n'en dit rien à l'écran : révéler l'échec
      // reviendrait à dire si l'adresse a un compte.
      console.error("Reset request error:", e);
    }
    // Message identique quoi qu'il arrive : aucune énumération de comptes.
    info.textContent = "Si un compte existe pour cette adresse, un lien vient de partir. "
                     + "Pense \u00e0 regarder les ind\u00e9sirables.";
    info.classList.remove("hidden");
    verrouJusqua = Date.now() + 60000;
    submit.textContent = configMode("reset-request").bouton;
    submit.disabled = false;
  }
```

- [ ] **Étape 4 : router le clic du bouton principal selon le mode**

Dans `handler`, insérer tout en haut :

```javascript
    if (courant === "reset-request") return envoyerLien();
    if (courant === "reset-error") return setMode("reset-request");
```

- [ ] **Étape 5 : vérifier au banc la bascule vers la demande**

```bash
node _harness_build.mjs
```

Sur `_harness.html` :

```javascript
document.getElementById("gate-oubli").click();
JSON.stringify({
  bouton: document.getElementById("gate-submit").textContent,
  emailVisible: !document.getElementById("gate-email").classList.contains("hidden"),
  mdpCache: document.getElementById("gate-password").classList.contains("hidden"),
  ongletsCaches: document.querySelector(".gate-tabs").classList.contains("hidden"),
  retourVisible: !document.getElementById("gate-retour").classList.contains("hidden"),
})
```

Attendu : `bouton` à `Envoyer le lien`, `mdpCache` et `ongletsCaches` à `true`, `retourVisible` à `true`.

- [ ] **Étape 6 : vérifier l'envoi et le verrou**

```javascript
document.getElementById("gate-email").value = "test@exemple.fr";
document.getElementById("gate-submit").click();
await new Promise(r => setTimeout(r, 300));
JSON.stringify({
  info: document.getElementById("gate-info").textContent,
  infoVisible: !document.getElementById("gate-info").classList.contains("hidden"),
})
```

Attendu : le message neutre, visible. La console du banc doit afficher `[banc] resetPasswordForEmail test@exemple.fr`.

Puis recliquer immédiatement :

```javascript
document.getElementById("gate-submit").click();
await new Promise(r => setTimeout(r, 100));
document.getElementById("gate-error").textContent
```

Attendu : `Patiente NN secondes avant un nouvel envoi.`

- [ ] **Étape 7 : prouver que l'échec réseau ne fuit rien**

Recharger `_harness.html` (le verrou vit dans la fermeture, un rechargement le remet à zéro), puis :

```javascript
window.__HARNESS_RESET_FAIL = "Boom";
document.getElementById("gate-oubli").click();
document.getElementById("gate-email").value = "inconnu@exemple.fr";
document.getElementById("gate-submit").click();
await new Promise(r => setTimeout(r, 300));
JSON.stringify({
  info: document.getElementById("gate-info").textContent,
  erreurCachee: document.getElementById("gate-error").classList.contains("hidden"),
})
```

Attendu : **le même message neutre** qu'à l'étape 6, et `erreurCachee` à `true`. C'est le test qui prouve l'absence d'énumération de comptes.

- [ ] **Étape 8 : commit**

```bash
git add js/gate.js
git commit -m "Gate : demande de lien de reinitialisation (message neutre, verrou 60 s)"
```

---

## Tâche 6 : le retour depuis l'email et la saisie du nouveau mot de passe

**Fichiers :**
- Modifier : `js/gate.js` (mode `reset-set`)
- Modifier : `js/main.js` (bloc de démarrage, fin de fichier)

**Interfaces :**
- Consomme : `lireJetonRecuperation` (tâche 1), `verifyRecoveryToken` et `updatePassword` (tâche 2), le mode `reset-set` (tâche 4).
- Produit : le parcours complet, de l'URL `?token_hash=...&type=recovery` jusqu'à l'app ouverte avec le nouveau mot de passe.

- [ ] **Étape 1 : compléter les imports de `js/gate.js`**

```javascript
import { signInWithPassword, signUpWithPassword, requestPasswordReset, updatePassword } from "./db.js?v=20260916a";
import { validerEmail, validerMotDePasse, messageErreurAuth, configMode } from "./gate-rules.js?v=20260916a";
import { toast } from "./utils.js?v=20260916a";
```

- [ ] **Étape 2 : ajouter l'enregistrement du nouveau mot de passe**

Sous `envoyerLien` :

```javascript
  async function enregistrerMotDePasse() {
    const mdp = passwordInput.value;
    const erreur = validerMotDePasse(mdp, confirmation.value);
    if (erreur) return echec(erreur);

    error.classList.add("hidden");
    submit.disabled = true;
    submit.textContent = configMode("reset-set").boutonEnCours;
    try {
      await updatePassword(mdp);
    } catch (e) {
      console.error("Update password error:", e);
      echec(messageErreurAuth(e?.message || String(e)));
      submit.disabled = false;
      submit.textContent = configMode("reset-set").bouton;
      return;
    }
    toast("Mot de passe modifi\u00e9.", "success", 3000);
    // Rechargement sur l'URL propre : la session de récupération est déjà
    // valide, le démarrage normal ouvre l'app. Plus sûr que de rejouer le boot
    // à la main depuis un état intermédiaire.
    location.replace(location.pathname);
  }
```

- [ ] **Étape 3 : router ce mode dans `handler`**

Ajouter, à côté des deux lignes de la tâche 5 :

```javascript
    if (courant === "reset-set") return enregistrerMotDePasse();
```

Et rendre la touche Entrée active sur la confirmation, sous les deux `onkeydown` existants :

```javascript
  confirmation.onkeydown = onEnter;
```

- [ ] **Étape 4 : brancher le point d'entrée dans `js/main.js`**

Ajouter les imports auprès des autres :

```javascript
import { lireJetonRecuperation } from "./gate-rules.js?v=20260916a";
import { verifyRecoveryToken } from "./db.js?v=20260916a";
```

Puis remplacer le début du bloc de démarrage (la fonction anonyme en fin de fichier) par :

```javascript
(async () => {
  loadTheme();
  loadAccent();

  // Retour depuis le mail de réinitialisation. Ce test passe AVANT initAuth :
  // la session de récupération rendrait isAuth() vrai et ferait démarrer l'app
  // par-dessus l'écran de saisie. L'URL est nettoyée tout de suite pour que le
  // jeton ne traîne ni dans la barre d'adresse ni dans l'historique.
  const jeton = lireJetonRecuperation(location.search);
  if (jeton) {
    try {
      await verifyRecoveryToken(jeton);
      history.replaceState(null, "", location.pathname);
      showGate("reset-set");
    } catch (e) {
      console.error("Recovery token error:", e);
      history.replaceState(null, "", location.pathname);
      showGate("reset-error");
    }
    return;   // ni initAuth ni polling : on attend la saisie.
  }

  await initAuth();
  if (isAuth()) {
```

Le reste du bloc (le `else` avec `showGate()` et le `setInterval`) ne change pas.

- [ ] **Étape 5 : vérifier la syntaxe**

```bash
node --check js/gate.js && node --check js/main.js
```

Attendu : silencieux, code 0.

- [ ] **Étape 6 : vérifier au banc le jeton valide**

```bash
node _harness_build.mjs
```

Ouvrir `http://localhost:8001/_harness.html?token_hash=bon-jeton&type=recovery`, puis :

```javascript
JSON.stringify({
  urlNettoyee: location.search,
  bouton: document.getElementById("gate-submit").textContent,
  sousTitre: document.getElementById("gate-subtitle").textContent,
  emailCache: document.getElementById("gate-email").classList.contains("hidden"),
  confirmationVisible: !document.getElementById("gate-confirmation").classList.contains("hidden"),
  appCachee: document.getElementById("app").classList.contains("hidden"),
})
```

Attendu : `urlNettoyee` vide (le jeton a disparu de l'URL), `bouton` à `Enregistrer`, `emailCache` à `true`, `confirmationVisible` à `true`, `appCachee` à `true`. Ce dernier point est le vrai enjeu : il prouve que l'app ne démarre pas par-dessus l'écran de saisie.

- [ ] **Étape 7 : vérifier la non-correspondance puis l'enregistrement**

```javascript
document.getElementById("gate-password").value = "motdepasse8";
document.getElementById("gate-confirmation").value = "motdepasse9";
document.getElementById("gate-submit").click();
await new Promise(r => setTimeout(r, 200));
document.getElementById("gate-error").textContent
```

Attendu : `Les deux mots de passe ne correspondent pas`.

Puis le cas nominal :

```javascript
document.getElementById("gate-confirmation").value = "motdepasse8";
document.getElementById("gate-submit").click();
```

Attendu dans la console du banc : `[banc] updateUser [ 'password' ]`, suivi du rechargement de la page.

- [ ] **Étape 8 : vérifier le lien mort**

Ouvrir `http://localhost:8001/_harness.html?token_hash=jeton-pourri&type=recovery`, puis :

```javascript
JSON.stringify({
  sousTitre: document.getElementById("gate-subtitle").textContent,
  bouton: document.getElementById("gate-submit").textContent,
  urlNettoyee: location.search,
})
```

Attendu : le sous-titre du lien expiré, `bouton` à `Demander un nouveau lien`, URL nettoyée. Cliquer ensuite le bouton doit ramener au mode demande :

```javascript
document.getElementById("gate-submit").click();
document.getElementById("gate-submit").textContent
```

Attendu : `Envoyer le lien`.

- [ ] **Étape 9 : commit**

```bash
git add js/gate.js js/main.js
git commit -m "Gate : retour depuis le mail et saisie du nouveau mot de passe"
```

---

## Tâche 7 : non-régression de la connexion et de la création de compte

Le parcours d'entrée a été déplacé (tâche 3) puis modifié trois fois. Cette tâche prouve qu'il marche encore, avant de parler de mise en prod.

**Fichiers :** aucun en principe. Si un écart apparaît, le corriger dans `js/gate.js` et committer à l'étape 4.

- [ ] **Étape 1 : rejouer les tests unitaires**

```bash
node tests/gate-rules.test.mjs
```

Attendu : `gate-rules : OK`.

- [ ] **Étape 2 : connexion au banc**

Sur `_harness.html` sans paramètre :

```javascript
document.getElementById("gate-email").value = "banc@exemple.fr";
document.getElementById("gate-password").value = "motdepasse8";
document.getElementById("gate-submit").click();
await new Promise(r => setTimeout(r, 1200));
JSON.stringify({
  appVisible: !document.getElementById("app").classList.contains("hidden"),
  gateCachee: document.getElementById("gate").classList.contains("hidden"),
})
```

Attendu : `appVisible` à `true`, `gateCachee` à `true`. La gate franchie, l'app démarre comme avant.

- [ ] **Étape 3 : aller-retour entre les modes sans état résiduel**

Recharger le banc, puis :

```javascript
const etat = () => [
  document.getElementById("gate-submit").textContent,
  document.getElementById("gate-password").classList.contains("hidden"),
  document.getElementById("gate-confirmation").classList.contains("hidden"),
  !document.querySelector(".gate-tabs").classList.contains("hidden"),
].join(" | ");
const trace = [];
trace.push("signin  : " + etat());
document.getElementById("gate-tab-signup").click(); trace.push("signup  : " + etat());
document.getElementById("gate-tab-signin").click(); trace.push("signin  : " + etat());
document.getElementById("gate-oubli").click();      trace.push("request : " + etat());
document.getElementById("gate-retour").click();     trace.push("signin  : " + etat());
trace.join("\n")
```

Attendu : les deux lignes `signin` finales sont identiques à la première (bouton `Se connecter`, mot de passe visible, confirmation cachée, onglets visibles). Un champ resté caché après un retour serait le bug typique de ce découpage.

- [ ] **Étape 4 : commit si correction**

Uniquement si l'étape 2 ou 3 a révélé un écart :

```bash
git add js/gate.js
git commit -m "Gate : correction de la bascule entre modes"
```

---

## Tâche 8 : entrée Nouveautés et mise en prod

**Fichiers :**
- Modifier : `js/nouveautes-data.js`

- [ ] **Étape 1 : ajouter la nouveauté**

En tête du tableau `NOUVEAUTES` :

```javascript
  {
    id: "2026-09-16-mot-de-passe-oublie",
    date: "2026-09-16",
    pour: "tous",
    titre: "Tu peux réinitialiser ton mot de passe toi-même",
    resume: "Si tu as oublié ton mot de passe, clique « Mot de passe oublié ? » sur l'écran "
          + "de connexion. Tu reçois un lien par email, valable une heure, qui te permet d'en "
          + "choisir un nouveau. Plus besoin de demander à un formateur de te débloquer.",
  },
```

Contrainte du fichier : pas de vocabulaire technique, pas de nom de fichier, pas de numéro de version. Le public est la promo.

- [ ] **Étape 2 : vérifier que la page Nouveautés reste cohérente**

```bash
node tests/nouveautes.test.mjs
node --check js/nouveautes-data.js
```

Attendu : test au vert, `--check` silencieux.

- [ ] **Étape 3 : commit**

```bash
git add js/nouveautes-data.js
git commit -m "Nouveautes : reinitialisation du mot de passe en libre-service"
```

- [ ] **Étape 4 : fusionner dans main et re-versionner le cache**

```bash
git checkout main
git merge --no-commit --no-ff mdp-oublie
```

Le `--no-commit` est délibéré : il laisse le hook `pre-commit` re-poser les jetons `?v=` sur main, ce que la branche de feature ne fait jamais. Puis :

```bash
git commit -m "Merge : mot de passe oublie (reinitialisation en libre-service)"
git push origin main
```

- [ ] **Étape 5 : attendre le déploiement Pages et vérifier le jeton servi**

```bash
gh api repos/watchi64/ecsr-promo/pages/builds/latest --jq .status
```

Attendu : `built`. Si la valeur reste `building` plus de trois minutes, relancer par `gh api -X POST repos/watchi64/ecsr-promo/pages/builds`.

```bash
curl -s "https://watchi64.github.io/ecsr-promo/index.html?nc=$RANDOM" | grep -oE 'main.js\?v=[0-9a-z]+'
```

Puis, avec le jeton obtenu :

```bash
curl -s "https://watchi64.github.io/ecsr-promo/js/gate.js?v=<jeton>" | grep -c "reset-set"
```

Attendu : un compte non nul. Rappel : `index.html` n'est pas cache-busté, un rechargement forcé est nécessaire côté navigateur.

---

## Tâche 9 : vérification bout-en-bout en production

Dépend de la tâche 0 (SMTP configuré) et de la tâche 8 (code déployé). C'est la seule preuve qui compte : le banc ne prouve rien sur la livraison d'un email.

- [ ] **Étape 1 : demander un lien sur une vraie adresse**

Sur `https://watchi64.github.io/ecsr-promo/`, cliquer « Mot de passe oublié ? », saisir l'adresse du compte de test, envoyer. Vérifier que le message neutre s'affiche.

- [ ] **Étape 2 : vérifier la réception**

Le mail doit arriver **en boîte de réception**, pas en indésirables, expédié par `no-reply@timy-studio.fr`. S'il tombe en indésirables, le DMARC est en cause : reprendre la tâche 0, étape 1.

- [ ] **Étape 3 : prouver le cas multi-appareils**

Ouvrir le lien sur un **autre appareil** que celui de la demande (demander depuis le téléphone, ouvrir sur l'ordinateur). C'est précisément ce que le choix du `token_hash` rend possible et ce qu'un flux PKCE aurait cassé : si cela échoue, le template utilise probablement `{{ .ConfirmationURL }}` au lieu de `{{ .TokenHash }}`.

- [ ] **Étape 4 : changer le mot de passe et se reconnecter**

Saisir un nouveau mot de passe et sa confirmation. Attendu : l'app s'ouvre directement, sans écran de connexion. Puis se déconnecter et se reconnecter avec le **nouveau** mot de passe.

- [ ] **Étape 5 : prouver que le lien ne sert qu'une fois**

Recliquer le lien du mail déjà utilisé. Attendu : l'écran « Ce lien n'est plus valable », avec son bouton de relance fonctionnel.

- [ ] **Étape 6 : fermer le chantier**

Message WhatsApp prêt à copier-coller pour la promo, puis fermeture du worktree et de la branche dans la foulée :

```bash
git -C "C:/Users/watch/Dev/ECSR/TP_ECSR_App" worktree remove "C:/Users/watch/Dev/ECSR/ecsr-promo-mdp-oublie"
git -C "C:/Users/watch/Dev/ECSR/TP_ECSR_App" branch -d mdp-oublie
git -C "C:/Users/watch/Dev/ECSR/TP_ECSR_App" pull
```
