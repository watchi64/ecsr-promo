# PROJECT_NOTES.md — TP ECSR App

> **Fichier de reprise pour future session Claude.** Maintenu manuellement, à mettre à jour quand une décision structurante change. Daté : **2026-05-21**, backend mis à jour le 03/07/2026.

## TL;DR

Web app de suivi de promotion **TP ECSR Nîmes 2026** (15 stagiaires + 3 formateurs Hocine/Raphaël/Romain + 1 admin watchi64). Stack : HTML/CSS/JS vanilla + Supabase + GitHub Pages.

- URL : **https://watchi64.github.io/ecsr-promo/**
- Repo : `github.com/watchi64/ecsr-promo` (public)
- Local : `C:\Users\watch\Dev\ECSR\TP_ECSR_App`
- Dossier formation (cours/QCM) : `C:\Users\watch\Dev\ECSR\` (séparé du repo app)

**Focus actuel** : que ça fonctionne parfaitement pour la promo CCP1+CCP2 2026. Long terme envisagé : vendre à d'autres centres TP ECSR (pas activé).

## Stack & infra

| | |
|---|---|
| Frontend | HTML/CSS/JS vanilla, modules ES, **pas de framework** (refus assumé) |
| Backend | Supabase Postgres, project `crpduennbqaemhfaywrz` (eu-west-3 Paris, org Timy Studio — migré le 17/06/2026 depuis dacqponglpeuscbgwfqn) |
| Edge Function | `invite-user` (deploy via MCP `mcp__800314df__deploy_edge_function`) |
| Hébergement | GitHub Pages, branche `main` |
| Typo | Canela (display, self-hosted .otf) + Outfit (Google Fonts body) + Geist Mono (numéros) |
| Logo | `assets/logo/tpecsr-logo.svg` (capsule TP) — SVG seul, le PNG a été supprimé |
| Palette | Mint éditorial unique (`:root`), accent vert `#6B7F4E`. Plus de switcher thème/accent |
| Cache-bust | **Automatique** : hook `pre-commit` → `scripts/cache-bust.js` pose un token `?v=AAAAMMJJx` uniforme sur `index.html` + tous les imports JS |
| Bootstrap admin | `misterwatchi@gmail.com` (compte admin + lié au stagiaire Timy id=15) |

## Auth & permissions — refonte du 18 mai

**Modèle actuel** : **email + mot de passe** pour tout le monde, whitelist côté serveur.

- **Plus de mot de passe partagé**, plus de magic link, plus de Google OAuth (essayés, retirés).
- Login : email + password classique (Supabase Auth `signInWithPassword`).
- Signup : email + password ; **trigger SQL `enforce_whitelist_signup`** sur `auth.users` bloque tout email absent de `user_profiles` et auto-confirme l'email pour bypass le mail de confirmation Supabase.
- Workflow d'invitation : admin va dans Paramètres → Accès & invitations → ajoute prénom + rôle + email → **aucun mail envoyé**, juste un ajout à la whitelist. Admin partage l'URL par ses propres moyens. La personne crée son compte elle-même.

### Table `user_profiles`

| Colonne | Type | Détail |
|---|---|---|
| `email` | TEXT PRIMARY KEY | identifiant principal |
| `role` | TEXT | `'stagiaire'` ou `'prof'` (l'option `'admin'` pur a été retirée du form) |
| `stagiaire_id` | INTEGER → stagiaires.id | si role=stagiaire |
| `prof_id` | INTEGER → profs.id | si role=prof |
| `is_admin` | BOOLEAN | **orthogonal au rôle** — un stagiaire peut être aussi admin |
| `anonymous_notes` | BOOLEAN | si TRUE, affiché « Anonyme » dans la matrice Notes pour les non-admins |
| `first_login_at`, `invited_at`, `invited_by_email` | TIMESTAMPTZ | audit |

**Permissions** dérivées :
- `isAuth()` = a une row user_profiles
- `isAdmin()` = `is_admin = true`
- `isProf()` / `isStagiaire()` = via `role`
- RLS : SELECT public, WRITE via `is_admin()` SECURITY DEFINER (lit `is_admin` colonne)
- Tous les `*_audit` : aucune écriture directe, uniquement via triggers
- RPC `set_my_anonymous_notes(val)` SECURITY DEFINER : permet à chacun de toggle son propre flag

## Pages (9 onglets) — état actuel

```
Accueil · Tableau de bord · Planning · Calendrier · Thèmes · Passages · Notes · Ressources & contacts · Paramètres
```

### Spécificités à connaître

- **Accueil** : refonte 19 mai. Salutation perso « Bonjour, V. Timy », pill date du jour, **bloc compteur J−N du prochain événement majeur** (examen/stage), 3 prochains événements (depuis agenda), 7 tuiles raccourcis, infos courtes (« Ctrl+Z annule », « ajout passage limité à 2 jours »…). Plus de mention mdp partagé / identité au 1er accès (obsolète).
- **Dashboard** : cards stagiaires compactes (215px), pill moyenne /20, badges priorité « À prioriser » / « Opportunité ratée » / « À jour » (PAS « Peut attendre »). Tri : priorité (défaut), alpha, note ↑/↓, passages ↓.
- **Planning** : jours empilés vertical, **jour en colonne gauche sticky** (78px), demi-journées avec horaires modulables. Lanes parallèles **alignées en colonnes** (lane index = grid-column). Cellule = strip header (activité bold + **multi-formateurs en chips** + delete) → sujet en **chips multi-thèmes** (autocomplete) → participants (Au tableau / Élèves) → notes discrètes. **Boutons 🎲** pour tirages aléatoires : 4 élèves auto en Pédagogie salle, 1-3 élèves en Voiture (popover 1/2/3), 1 pédagogue au tableau. Tous excluent les doublons dans la semaine. Print PDF 1 page. **Élèves bénévoles** (02/07/2026) : bouton « Bénévoles » (admin) dans la barre semaine → panneau banque (fiches, dispos hebdo, filtre « qui est dispo jeudi matin », tel cliquable, retrait doux) ; champ chips « Bénévoles » sur les cartes Voiture (dispos du jour en tête + badge « dispo », exclusion des cartes parallèles du même créneau) ; impression sous « Bénévoles : » en italique. Côté stagiaire : noms via RPC `benevoles_noms()` uniquement, banque et téléphones invisibles (RLS). **Auto-écoles partenaires + suivi** (05/07/2026) : le panneau a 2 onglets (Bénévoles / Auto-écoles), affiliation par select (+ création d'auto-école à la volée), fiche de suivi = venues déduites du planning avec commentaire par venue (table `benevole_suivi`), compteur de venues dans la liste. Fiche auto-école = gestion complète : bénévoles affiliés cliquables (ouvre leur fiche, retour à l'école), × pour désaffilier, select pour affilier un existant ou créer un bénévole déjà rattaché, « Retirer » (réversible) ET « Supprimer » (définitif, désaffilie ses bénévoles via `deleteAutoEcole`).
- **Calendrier** : 9 événements 2026 déjà insérés (Formation CCP1 30/03→21/09, stages 26/05, 03/08, Examens CCP1 22-25/09, Formation CCP2 28/09→07/12, stages 12/10, 26/10, 16/11, Examens CCP2 08-11/12). Types : examen/stage/formation/férié/autre, chacun couleur dédiée. Filtres « À venir » / « Tout ». Vue par mois.
- **Thèmes** : 4 sections en pills (Tout / Thèmes 57 / TP ECSR 12 / REMC 35 / Notions 2). Statut **binaire** (À faire ↔ Fait), pas « En cours ». Clic prénom titre = modal « Contenu à venir ». Date éditable côté admin via modale (force statut à Fait). Mobile : 2 lignes + corbeille (sur notions) en 4e col pour éviter chevauchement.
- **Passages** : table avec colonne « Ajouté par », filter, modal audit. Anti-backdating date ≥ J−2 pour non-admin (RLS + JS).
- **Notes** : vue matrice unique (stagiaires × Moy + C1 + C2 + REMC + GDE + 57 thèmes). Headers thèmes verticaux rotatés. Édition inline cellule (click → input, Enter sauve, Esc annule). Date globale en toolbar. **Save en place** (pas de re-render complet, n'écrase plus les autres inputs ouverts). Tri : défaut / alpha / moyenne ↑/↓ / nb notes ↓. **Synthèse classe** (KPI moyenne/médiane/saisies/notes<10 + Top 3 thèmes faibles/solides). **Graphiques tabs** : par stagiaire / par thème / distribution. **Mode anonyme** (toggle perso) : nom remplacé par « Anonyme » sauf pour admins. Couleurs notes pêche→vert (F1DBC8 / FBE5C1 / DBE9C4 / BFE0A6, pas de rouge vif — ressenti rabaissant). Tap sur prénom = modal détail vertical (utile mobile). Lignes alternées gris léger.
- **Ressources & contacts** : section **Contacts** (Myriam/Séverine/Fanny pré-remplis depuis procédure absences ECF + bouton « Ajouter un contact »), section **Ressources externes** (liens curés Légifrance/REMC/SRRR…). Tap-to-call (`tel:`) et tap-to-mail (`mailto:`).
- **Paramètres** : sections **Accès & invitations** (form invitation + liste avec pills rôle/admin), **Mes préférences** (toggle anonymat notes), **Promo** (stagiaires/profs CRUD admin), **Infos**. **Plus de section Apparence** (mint unique).

## Affichage stagiaires : nouveau format

Depuis 19 mai, table `stagiaires` a une colonne `nom` (nom de famille). Format d'affichage **partout dans l'app** : `<initiale du nom>. <prénom>` — ex : « V. Timy ». Helper `displayStagiaire(s)` dans `utils.js`. Tri alpha = par `nom` via `compareByNom(a, b)`.

Liste : ALEXER Audrick, ANKPRA Gaëlle, AQUILA Céline, BAILLY Mickael, BLANC Julie, BLANQUINQUE Valentin, BRUN Gaël, CHOULET Emilie, ERRAJI CHAHID Rita, KESSAL Lorie, LOPEZ Tatiana, MEDJANI Cassandre, MURRIGUIAN Aurélie, OULD ABDELKADER Anissa, VALDIVIA Timy.

## Base de données — état actuel

### Tables principales

| Table | Détail |
|---|---|
| `stagiaires` | 15 entries, `prenom` + **`nom`** + ordre |
| `profs` | 3 entries (Hocine, Raphaël, Romain) |
| `user_profiles` | whitelist email-based, multi-rôle (cf. § Auth) |
| `themes` | 57 officiels (type=theme, numero 1-57) + 12 compétences TP ECSR + 35 REMC + 2 notions (type=notion) |
| `competences` | C1-C4 (TP ECSR) + REMC + MGDE |
| `passages`, `passages_audit` | passages salle/voiture avec who tracking |
| `evaluations`, `evaluations_audit` | notes (type Thème/Compétence/Contrôle) |
| `planning_entries` | + nouvelle colonne **`prof_ids INTEGER[]`** (multi-formateurs). `prof_id` legacy conservé synchronisé au 1er. + **`benevoles_ids INTEGER[]`** (élèves bénévoles voiture, 02/07/2026) |
| `benevoles` | banque d'élèves bénévoles (voiture conduite) : prénom (seul champ obligatoire), nom optionnel, **téléphone**, `niveau` = code compétence/sous-compétence REMC (« C1 », « C1.4 »... libellés résolus par `nivLabel()` dans benevoles.js), boîte, heures faites, **`auto_ecole_id` FK → auto_ecoles** (05/07/2026, le texte libre a été migré puis supprimé), `dispos jsonb` (grille hebdo LUNDI..VENDREDI x matin/aprem), `actif` (retrait doux). **RLS entièrement `is_admin()`** : invisible pour les stagiaires, téléphone jamais transmis. Seed 02/07/2026 : 9 bénévoles de la semaine du 6 juillet (Assiya, Chahinez + 7 via contact « Sophie ») liés aux cartes Voiture |
| `auto_ecoles` | partenaires (05/07/2026) : nom (obligatoire), référent, téléphone, email, adresse, notes, `actif`. RLS entièrement `is_admin()`. « Sophie » (06 16 14 75 14) = première fiche, migrée depuis le texte libre |
| `benevole_suivi` | commentaires de suivi par venue (05/07/2026) : `(benevole_id, semaine_lundi, day_index, half_day)` UNIQUE + commentaire. RLS `is_admin()`. ⚠️ Les venues ne sont PAS stockées : déduites de `planning_entries.benevoles_ids` (une demi-journée = une venue), seuls les commentaires vivent ici |
| `planning_half_meta` | horaires + pause par demi-journée par semaine |
| `ressources` | liens curés |
| `contacts` | admin/urgence/autre — pré-rempli Myriam/Séverine/Fanny |
| `agenda_events` | dates clés (examens, stages, formations) avec date_start + date_end optionnel |
| `settings` | KV générique (utilisé pour current_week_lundi) |
| `admins` | LEGACY conservée mais plus utilisée — la whitelist vit dans user_profiles |

### Fonctions / triggers Postgres notables

- `is_admin()` SECURITY DEFINER : lit `user_profiles.is_admin` via JWT email
- `enforce_whitelist_signup()` BEFORE INSERT ON auth.users : bloque si email pas dans user_profiles + auto-confirme email
- `set_my_anonymous_notes(val)` SECURITY DEFINER : RPC perso
- `benevoles_noms()` SECURITY DEFINER : seule surface bénévoles côté stagiaire — retourne uniquement `id` + `display` (« N. Prénom », inactifs compris pour que les vieilles semaines restent lisibles). Le planning l'utilise quand `isAdmin()` est faux
- Triggers `audit_passages`, `audit_evaluations` : INSERT/UPDATE/DELETE → row dans `*_audit`, identité depuis `auth.jwt()->>email`
- Trigger `agenda_touch_updated`, `contacts_touch_updated` : updated_at auto

### Edge Function `invite-user`

Vérifie le JWT de l'appelant, check `is_admin = true` en lecture service_role, upsert dans user_profiles. **Plus d'envoi de mail** (depuis v3 du 18 mai — l'app fait du signup classique côté navigateur).

## Décisions UX importantes (à respecter)

- ❌ **Pas d'em-dashes (—)** dans les libellés UI. Régression à éviter.
- ✅ Format affichage stagiaires : **« V. Timy »** (initiale + prénom)
- ✅ Layout planning : jour à gauche (sticky), demi-journées empilées avec lanes alignées en colonnes
- ✅ Édition inline matrice Notes (pas de modal pour les saisies simples, mais modal détail au tap du prénom)
- ✅ Headers tableau matrice : titres rotatés vertical (-90°)
- ✅ Couleurs notes/cellules : pêche → vert (4 paliers, pas de rouge vif — ressenti rabaissant pour les stagiaires)
- ✅ Activité « Autre » : minimal (activité + formateur + note seulement)
- ✅ Vert mint **partout** (un seul thème, un seul accent)
- ✅ Cache-bust **automatique** (hook `pre-commit`) : token `?v=AAAAMMJJx` uniforme sur `index.html` + tous les imports JS
- ❌ Pas de gamification (badges, XP) — public adulte
- ❌ Pas de framework — vanilla suffit
- ❌ Pas de Google OAuth (testé, retiré, jugé non nécessaire)
- ❌ Pas de magic link mail (testé, retiré : friction + rate-limit Supabase)

## Patterns techniques importants

### Save sans casser les autres inputs ouverts (Notes et Planning)

**Bug récurrent corrigé** : un `loadPlanning()` ou `reload()` après save détruit les inputs en cours d'édition dans d'autres cellules. Solutions appliquées :

- **Notes (matrice)** : save met à jour la cellule + l'array `evaluations` en local, `refreshAnalyticsInPlace()` re-rend uniquement Synthèse + Graphiques (`.replaceWith(...)`).
- **Planning** : `saveEntry()` retourne sa promesse, stockée dans `pendingSaves` (Set global). Avant `addSlotEnd()` / `addLaneInSlot()`, appel à `flushPendingInputs()` qui : (1) blur le champ actif → déclenche les saves restants → (2) `await Promise.all([...pendingSaves])`. Garantit que la DB est à jour avant le full reload.
- **Sujet** : auto-commit on blur si texte non commité (`input.value.trim()` non vide).
- **Notes input** : save immédiat on blur (en plus du debounce 500ms).

### Système d'undo Ctrl+Z

`js/undo.js` : stack 30 actions max, en mémoire. Couverture :
- Notes : add/update/delete eval
- Passages : add/delete
- Thèmes : statut + date_fait
- Calendrier : add/update/delete event
- Contacts : add/update/delete

Câblé via `recordUndo(label, undoFn)` après chaque écriture. Sur Ctrl+Z, déclenche `hashchange` pour rafraîchir la vue. Inputs natifs (sauf number) gardent leur undo Browser.

### Cache-bust des modules ES (automatisé le 21 mai)

**Problème résolu** : `index.html` ne versionnait que `main.js`. Les ~19 modules importés (`import ... from "./db.js"`…) n'avaient pas de `?v=`, donc restaient en cache jusqu'à ~10 min après un deploy (max-age GitHub Pages). Import map écartée : inline → bloquée par le CSP `script-src` (pas de `'unsafe-inline'`) ; externe → pas fiable sur iOS Safari.

**Solution** : `scripts/cache-bust.js` (Node, zéro dépendance) pose un token `?v=AAAAMMJJx` **uniforme** sur `index.html` + tous les imports relatifs de `js/`. Token unique par passage : indispensable, sinon un module importé sous deux `?v=` différents serait chargé deux fois (état dupliqué).

**Déclenchement automatique** : le hook `.githooks/pre-commit` (activé via `git config core.hooksPath .githooks`) lance le script dès qu'un fichier `js/` ou `css/` entre dans un commit, puis re-stage les fichiers. Plus rien à bumper à la main.

- Lancement manuel : `node scripts/cache-bust.js` (token imposé possible : `node scripts/cache-bust.js 20260521b`).
- Après un `git clone` neuf : refaire `git config core.hooksPath .githooks` (le hook est versionné, pas la config git locale).
- Court-circuiter ponctuellement : `git commit --no-verify`.

## Comment travailler sur ce projet (workflow)

1. **Toujours commit + push après chaque feature significative** (le user n'aime pas les pauses « tu veux que je commit ? »)
2. **Migrations Supabase via MCP `mcp__800314df__apply_migration`** (project_id `crpduennbqaemhfaywrz`), JAMAIS de SQL en local
3. **Edge Functions via MCP `deploy_edge_function`** — nécessite confirmation user explicite
4. **Communication FR**, récap court après chaque livraison, tableaux markdown, gras sur l'essentiel
5. **AskUserQuestion** uniquement pour les décisions structurantes (nouvelle table, refonte vue, choix d'archi). Sinon **trancher seul** et avancer
6. **Cache-bust automatique** : le hook `pre-commit` pose le token `?v=` sur index.html + tous les modules JS, rien à bumper manuellement
7. **Vérifier `git log`** pour les derniers commits avant d'attaquer
8. **Pour les bugs « ça marche pas »**, vérifier d'abord avec `curl` ce qui est servi en prod avant d'accuser le code

## Roadmap (non décidé)

- Émargement signature canvas + PDF (Qualiopi indicateur 11)
- Attestations + certificat réalisation format réglementaire
- Export BPF annuel
- Questionnaires satisfaction auto J+1 / J+180
- PWA installable (manifest + SW)
- Export CSV/PDF complet matrice Notes
- Multi-tenant (promo_id partout) — si un jour vente à d'autres centres
- Génération QCM auto via API Claude depuis les 57 thèmes (différenciant pitch ECF)
- Connexion possible des stagiaires côté formation-ecsr (cours/QCM unifiés ?)
