# Mot de passe oublié : réinitialisation en libre-service par email

Date : 2026-09-16 · Validé par l'utilisateur (brainstorm, section par section).

## Problème

La gate ne connaît que deux gestes : se connecter, créer un compte
(`js/main.js`, `showGate`). Un stagiaire qui oublie son mot de passe n'a
aucune sortie : il est dehors jusqu'à ce qu'un admin intervienne à la main dans
Supabase. Il n'existe aujourd'hui aucun flux de récupération, ni côté app, ni
côté tableau de bord.

## Décisions (validées une à une)

1. **Libre-service par email**, pas de réinitialisation par le formateur : le
   stagiaire se débloque seul.
2. **Périmètre resserré à l'oubli.** Pas de bloc « changer mon mot de passe »
   dans les Paramètres, pas de bouton de secours dans l'admin. Ces deux ajouts
   restent possibles plus tard, sur le même socle.
3. **Jeton en query string + `verifyOtp`** pour le retour depuis le mail.
4. **SMTP Resend** sur `timy-studio.fr`, prérequis du chantier.

## A. Prérequis : l'envoi d'email (hors code)

Le service d'email intégré de Supabase est plafonné à quelques messages par
heure et ne livre, sur les projets récents, qu'aux adresses de l'équipe. Sans
SMTP personnalisé, le flux ne fonctionne pour personne dans la promo.

- Fournisseur : **Resend**, offre gratuite (3 000 mails/mois, 100/jour).
- Domaine : `timy-studio.fr` (déjà possédé, cf. les conditions d'utilisation).
- DNS chez le registrar : SPF, DKIM, DMARC fournis par Resend.
- Supabase → Authentication → SMTP Settings : hôte, port, identifiants Resend.
- Expéditeur `no-reply@timy-studio.fr`, nom affiché « Promo ECSR ».

Étape bloquante : tant qu'un mail de test n'arrive pas en boîte de réception
(pas en indésirables), le reste ne se vérifie pas.

## B. Transport du jeton : le choix et ses concurrents

**Retenu : `token_hash` en query string.** Le template d'email pointe vers
`https://watchi64.github.io/ecsr-promo/?token_hash={{ .TokenHash }}&type=recovery`.
L'app lit le paramètre au démarrage, l'échange contre une session de
récupération, nettoie l'URL, affiche l'écran de saisie.

Écartés, et pourquoi :

- **Flux implicite** (fragment `#access_token=…`) : collision frontale avec le
  routeur, qui lit `location.hash` sous la forme `#/route` (`main.js`). Il
  faudrait intercepter le fragment avant lui, et le jeton resterait affiché
  dans la barre d'adresse.
- **PKCE** (`?code=`) : impose d'ouvrir le lien dans le **même navigateur** que
  la demande, le vérificateur vivant en `localStorage`. Le cas « je demande sur
  le téléphone, j'ouvre le mail sur l'ordinateur » casserait. Éliminatoire pour
  cette promo.

## C. Parcours utilisateur

**Demande.** Sous « Se connecter », un lien discret « Mot de passe oublié ? »,
affiché seulement en mode Connexion. Le clic bascule la même carte en mode
demande : champ email pré-rempli avec ce qui était déjà saisi, bouton « Envoyer
le lien », retour vers la connexion.

**Confirmation.** Message unique, quel que soit le résultat : « Si un compte
existe pour cette adresse, un lien vient de partir. Pense à regarder les
indésirables. » Le bouton se verrouille 60 secondes après un envoi.

**Nouveau mot de passe.** Le lien rouvre l'app sur un écran dédié : nouveau mot
de passe, confirmation, 8 caractères minimum. Au succès, la session est déjà
ouverte : l'app démarre directement, sans repasser par la connexion.

**Lien mort.** Expiré (une heure) ou déjà consommé : écran d'erreur explicite
avec un bouton « Demander un nouveau lien » qui ramène à l'étape 1.

**Correctif au passage.** Le champ de la gate annonce « min. 6 caractères »
(`index.html`) alors que le code en exige 8 (`main.js`). Les trois écrans
diront 8.

## D. Architecture et découpage

**`js/db.js`** gagne trois enveloppes minces, dans le style des voisines
(`signInWithPassword`, `signUpWithPassword`) :

- `requestPasswordReset(email)` : `auth.resetPasswordForEmail`, email normalisé
  en minuscules et trimé comme les autres, `redirectTo` sur l'URL de production.
- `verifyRecoveryToken(tokenHash)` : `auth.verifyOtp({ type: "recovery" })`.
- `updatePassword(password)` : `auth.updateUser`.

Toute la connaissance de Supabase reste dans ce fichier.

**`js/gate.js`, nouveau fichier.** `showGate()` fait déjà 85 lignes pour deux
modes, au milieu du fichier de démarrage. À quatre modes (connexion, création,
demande de lien, nouveau mot de passe), la fonction devient illisible. La carte
d'authentification part dans son propre module :

- expose `showGate(mode = "signin")` et `hideGate()` ;
- possède le DOM de `.gate-card`, ses quatre modes et ses messages ;
- dépend de `db.js` (les cinq fonctions d'auth) et de `utils.js` (toast) ;
- `main.js` n'en garde que les appels et redevient le fichier du démarrage et
  des routes.

**`index.html`** : lien « Mot de passe oublié ? », champ de confirmation, zones
de message, tous dans la carte existante. Aucun style nouveau, seulement
l'affichage conditionnel par mode.

**Point d'entrée.** Au démarrage, avant tout routage, `main.js` inspecte
`location.search` pour `token_hash` + `type=recovery`. S'il le trouve :
`verifyRecoveryToken`, nettoyage de l'URL par `history.replaceState`, puis
`showGate("reset-set")`. Sinon, démarrage normal. Le routeur en `#/` n'est
jamais touché.

**Tableau de bord Supabase** (hors dépôt, à tracer dans le suivi) :

- allow-list des URL de redirection : production et `localhost` pour le banc ;
- template « Reset Password » réécrit en français, lien construit sur
  `{{ .TokenHash }}` ;
- validité du lien ramenée de 24 heures à 1 heure.

## E. Sécurité et cas limites

- **Pas d'énumération de comptes** : message de confirmation identique quoi
  qu'il arrive. Un email hors whitelist n'a pas de compte auth, aucun mail ne
  part, et l'écran ne le dit pas. Rien à ajouter côté whitelist.
- **Jeton à usage unique**, consommé à la vérification, valide une heure.
- **Cadence** : verrou de 60 secondes sur le bouton, par-dessus le plafond
  horaire appliqué par Supabase.
- **L'écran de saisie n'existe pas sans session de récupération valide** : il
  n'est atteignable que par le chemin `token_hash`.
- **Session ouverte ailleurs** : hors périmètre. Changer son mot de passe ne
  déconnecte pas les autres appareils, comportement par défaut de Supabase,
  assumé pour cette promo.

## F. Vérification

1. Banc local : les quatre modes de la carte, le verrou de 60 secondes, les
   états d'erreur.
2. Jeton volontairement invalide : l'écran d'erreur et son bouton de relance.
3. Bout-en-bout réel en production : demande sur l'adresse de l'utilisateur,
   mail reçu en boîte de réception, mot de passe changé, reconnexion avec le
   nouveau mot de passe.
4. Vérification navigateur sur l'URL live après déploiement (règle du projet :
   un `node --check` ne prouve rien).
5. Entrée « Nouveautés » dans le même commit que la mise en prod.

## Exécution

Worktree frère `ecsr-promo-mdp-oublie`, branche `mdp-oublie`, partie de
`origin/main`. Le dossier `TP_ECSR_App` reste figé sur main en lecture seule.
