# Multi-promo : plusieurs promotions dans la même base, puis ouverture de « Nîmes, septembre 2026 »

Date : 2026-10-01 · Validé par l'utilisateur (brainstorm, section par section).
Branche `multi-promo`, worktree `C:/Users/watch/Dev/ecsr-promo-multi-promo` (hors du dossier ECSR :
les conversations lancées depuis un worktree du dépôt ECSR ne peuvent pas écrire sous
`C:/Users/watch/Dev/ECSR/`).

## Problème

Une nouvelle session du titre pro ECSR a démarré le mercredi 30/09/2026 à Nîmes : 8 stagiaires,
les mêmes trois formateurs (Hocine, Raphaël, Romain). Timy veut qu'elle ait l'app dès le départ,
avec des outils ouverts au fil de l'eau par le formateur (chantier B, modules).

L'app ne connaît qu'une promo. Toute la base y est implicitement rattachée, et les règles d'accès
laissent tout utilisateur connecté lire presque tout : notes, passages, planning, emails. Un compte
de la nouvelle promo verrait aujourd'hui les notes et les emails de la promo actuelle (15
stagiaires, en CCP2 jusqu'aux examens du 08 au 11/12, usage quotidien sur iPhone). Plusieurs tables
communes portent en plus des données propres à la promo (progression des thèmes, état des examens
QCM, réglages), et plusieurs contraintes d'unicité ignorent la notion de promo.

Objectif : une seule base, une seule app, des contenus partagés, et un cloisonnement par promo
garanti par la base elle-même. Contrainte absolue : **aucune régression pour la promo actuelle**.

## Décisions (validées une à une)

1. **Même base Supabase, en multi-promo** (cadrage du 01/10), plutôt qu'un second projet.
2. **Formateurs communs** : les trois formateurs encadrent les deux promos. Ils gardent leur compte
   et choisissent la promo sur laquelle ils travaillent.
3. **Bénévoles et auto-écoles : une banque par lieu** du centre de formation (Nîmes, Montpellier,
   puis chaque autre lieu avec sa première promo). Chaque promo est rattachée à un lieu et voit la
   banque de son lieu ; le compteur de venues d'un bénévole additionne les plannings des promos de
   son lieu. Précisé à la relecture de la spec (01/10) : la première version prévoyait une banque
   commune au centre.
4. **Publication des cours commune.** L'ouverture progressive pour la nouvelle promo passe par les
   modules du chantier B. L'ouverture d'un examen QCM, elle, est propre à chaque promo.
5. **Noms affichés** : « Nîmes, mars 2026 » (promo actuelle, formation débutée le 30/03/2026) et
   « Nîmes, septembre 2026 ». Modifiables depuis l'app.
6. **Pastille dédiée** dans la barre du haut pour voir et changer la promo courante (formateurs et
   fondateur seulement).
7. **Ouverture** : les formateurs accèdent à la nouvelle promo dès que le cloisonnement est prouvé ;
   les 8 stagiaires après la livraison des modules (chantier B).
8. **Architecture : la promo voyage avec chaque requête et la base la vérifie** (retenue aussi pour
   la grande échelle, voir B.1).
9. **Chaque table propre à une promo porte sa colonne `promo_id`**, même quand on pourrait la
   déduire du stagiaire : filtre direct, indexable, standard à grande échelle. De même, chaque table
   propre à un lieu porte sa colonne `lieu_id`.

Décidé sans question, parce que la réponse découle des choix ci-dessus :

- **Signalements QCM communs** : la banque de questions est partagée et les formateurs sont
  communs ; un stagiaire ne voit que ses propres signalements (règle actuelle).
- **Quota de l'assistant global** : par personne et par jour, inchangé.
- **Un formateur accède à toutes les promos, tous lieux confondus** (aujourd'hui les trois sont
  communs et les deux promos à Nîmes). Le jour où un lieu aura ses propres formateurs, on les
  rattachera à leurs lieux (voir G).
- **Pas d'écran de création de promo** : une promo se crée par migration, une ou deux fois par an.

## Faits vérifiés le 01/10 (base `crpduennbqaemhfaywrz`, PostgreSQL 17.6)

- 33 tables dans `public` (la table legacy `admins` n'existe plus). Tout l'accès aux données de
  l'app passe par `js/db.js` : aucun appel Supabase direct dans les vues ; l'assistant appelle sa
  fonction Edge par un `fetch` à part.
- Lecture `USING (true)` pour `authenticated` sur : stagiaires, evaluations, evaluations_audit,
  passages, passages_audit, planning_entries, planning_half_meta, planning_jours_off,
  agenda_events, settings, themes, profs, competences, contacts, ressources, fiches_suivi,
  user_profiles, qcm, qcm_questions, qcm_options.
- `settings` : clé primaire `key`, 6 lignes. `current_week_lundi`, `semaines_verrouillees`,
  `profs_autres` sont propres à la promo (lues et écrites par l'app) ; `chatbot_quota_jour` est
  globale (lue seulement par la fonction Edge `chatbot`) ; `cohort_name` et `password_hash` sont
  inutilisées.
- `themes` : 57 thèmes (tous « Fait » pour la promo actuelle) et 54 notions (37 « Fait »). La
  progression est portée par `statut`, `date_fait`, `date_qcm`, `notes`, `updated_by_email`.
- `qcm` : 66 QCM. L'état d'examen (`published` = examen ouvert, `published_by_email`,
  `published_at`, `exam_nb_questions`, `exam_question_ids`, `exam_draw_mode`,
  `exam_seconds_per_question`, `exam_ferme_a`) est sur la ligne du QCM. Au 01/10 : 1 examen ouvert
  avec échéance, 6 tirages gelés, 8 tentatives d'examen.
- Contraintes d'unicité sans promo : `planning_entries (semaine_lundi, day_index, half_day, slot,
  lane)`, `planning_half_meta (semaine_lundi, day_index, half_day)`, `planning_jours_off
  (semaine_lundi, day_index)`, `stagiaires (prenom)`.
- Passerelle Supabase : un en-tête personnalisé `x-promo-id` est accepté en CORS par `/rest/v1/`,
  `/storage/v1/` et `/auth/v1/`. Il est **refusé par les fonctions Edge** : `chatbot` et
  `invite-user` déclarent leur propre liste d'en-têtes autorisés.

## A. Modèle de données

### A.1 Tables `lieux` et `promos`

**`lieux`** : les sites du centre de formation.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | integer, identité | 1 = « Nîmes », 2 = « Montpellier » (ids posés explicitement par la migration) |
| `nom` | text, non nul, unique | Nom affiché |
| `created_at` | timestamptz | |

Les autres lieux s'ajoutent par migration avec leur première promo, comme les promos elles-mêmes.

**`promos`** :

| Colonne | Type | Rôle |
|---|---|---|
| `id` | integer, identité | 1 = « Nîmes, mars 2026 », 2 = « Nîmes, septembre 2026 » (ids posés explicitement par la migration) |
| `lieu_id` | integer, non nul, `references lieux` | Nîmes pour les deux promos |
| `nom` | text, non nul | Nom affiché |
| `date_debut` | date, non nul | 30/03/2026 et 30/09/2026 |
| `date_fin` | date, nullable | 11/12/2026 pour mars ; nulle pour septembre tant qu'elle n'est pas connue |
| `created_at` | timestamptz | |

Hiérarchie : centre (implicite, unique aujourd'hui), lieux, promos. Préparé, pas construit : une
colonne `centre_id` s'ajoutera sur `lieux` le jour où l'app servira plusieurs centres ; les tables
« communes au centre » ci-dessous deviendront alors propres à chaque centre.

### A.2 Qui accède à quelle promo

- **Stagiaire** : la promo de sa fiche stagiaire, et elle seule.
- **Formateur** (rôle `prof`), **admin pur** (rôle `admin`) et **fondateur** : toutes les promos.
- **Promo par défaut** : pour un compte lié à une fiche stagiaire, la promo de cette fiche (c'est le
  cas de Timy, stagiaire de mars et fondateur) ; pour les autres, la plus ancienne promo encore en
  cours (`date_fin` nulle ou pas encore passée), donc mars 2026 jusqu'au 11/12, puis septembre 2026
  d'elle-même.
- Dans une promo où il n'a pas de fiche, un compte de rôle stagiaire qui y accède (cas unique :
  Timy, par son statut de fondateur) y est traité en admin pur.
- **Lieu courant** : celui de la promo courante. Le lieu n'ouvre aucun droit par lui-même.

### A.3 Classement des tables

**Propres à une promo : colonne `promo_id integer not null references promos`, indexée.** Valeur
par défaut `promo_courante()`, sauf mention contraire.

| Table | Particularités |
|---|---|
| `stagiaires` | Unicité du prénom ramenée à `(promo_id, prenom)` |
| `evaluations`, `passages`, `qcm_attempts`, `epcf_evaluations`, `epcf_livrets`, `dp_dossiers`, `fiches_suivi` | `promo_id` **imposée par un trigger** (avant insertion et modification) depuis la fiche du stagiaire de la ligne ; la règle d'accès vérifie ensuite qu'elle est la promo courante. Pas de clé étrangère composite : elle rendrait ambigus les embarquements PostgREST existants (`stagiaires!stagiaire_id`) |
| `evaluations_audit`, `passages_audit` | `promo_id` recopiée par les triggers d'audit depuis la ligne auditée |
| `planning_entries` | Unicité `(promo_id, semaine_lundi, day_index, half_day, slot, lane)` |
| `planning_half_meta` | Unicité `(promo_id, semaine_lundi, day_index, half_day)` |
| `planning_jours_off` | Unicité `(promo_id, semaine_lundi, day_index)` |
| `agenda_events` | Le calendrier de chaque session (formation, stages, examens) |
| `settings` | `promo_id` **nullable** : nulle = réglage global (`chatbot_quota_jour`, et les deux clés inutilisées). Clé primaire de substitution `id`, unicité `(promo_id, key)` en `NULLS NOT DISTINCT` |
| **`themes_progression`** (nouvelle) | Clé `(promo_id, theme_id)`. Colonnes `statut` (mêmes valeurs permises qu'aujourd'hui, défaut « À faire »), `date_fait`, `date_qcm`, `notes`, `updated_by_email`, `updated_at`. `theme_id → themes on delete cascade` |
| **`qcm_examens`** (nouvelle) | Clé `(promo_id, qcm_id)`. Colonnes `published` (défaut faux), `published_by_email`, `published_at`, `exam_nb_questions`, `exam_question_ids`, `exam_draw_mode` (mêmes valeurs permises), `exam_seconds_per_question` (défaut 30), `exam_ferme_a`, `updated_at`. `qcm_id → qcm on delete cascade` |

**Propres à un lieu : colonne `lieu_id integer not null references lieux`, indexée.**

| Table | Particularités |
|---|---|
| `benevoles`, `auto_ecoles` | Valeur par défaut `lieu_courant()` : un bénévole ou une auto-école créé depuis une promo rejoint la banque de son lieu. Un bénévole ne peut être affilié qu'à une auto-école de son lieu (contrôle par trigger) |
| `benevole_suivi` | `lieu_id` imposée par un trigger depuis le bénévole |

**Communes au centre (règles actuelles conservées)** : `themes` (référentiel : numéros, titres,
catégories, types, ordre, notions), `competences`, `cours`, `cours_versions`, `cours_chunks`, `qcm`
(banque), `qcm_questions`, `qcm_options`, `qcm_signalements`, `qcm_signalement_instruction`,
`ressources`, `contacts`, `profs`.

**Par personne** : `chatbot_usage` (inchangée) et `user_profiles` (une ligne par personne, règles
resserrées en B.4).

Accepté, non contraint par la base : les identifiants rangés dans des tableaux ou des colonnes
libres du planning (`eleves_ids`, `eleves_ids_2`, `pedagogue_id_2`, `absences`, `benevoles_ids`)
ne sont pas vérifiés contre la promo ou le lieu de la ligne. L'interface ne propose que les
stagiaires de la promo courante et les bénévoles de son lieu.

### A.4 Données existantes

- Lieux : Nîmes (1) et Montpellier (2). Les deux promos sont à Nîmes. Les 29 bénévoles, les 3
  auto-écoles et le suivi des venues (vide aujourd'hui) sont rattachés à Nîmes ; la banque de
  Montpellier démarre vide.
- Toutes les lignes des tables propres à une promo sont rattachées à la promo 1 (mars 2026).
  Réglages : `current_week_lundi`, `semaines_verrouillees`, `profs_autres` vont à la promo 1 ;
  `chatbot_quota_jour`, `cohort_name`, `password_hash` deviennent globaux.
- `themes_progression` reçoit, pour la promo 1, la progression des 111 lignes de `themes` ;
  `qcm_examens` reçoit, pour la promo 1, l'état d'examen des 66 QCM.
- Les anciennes colonnes de progression (`themes`) et d'examen (`qcm`) restent en place pendant la
  bascule, synchronisées avec la promo 1 (voir D.2), puis sont supprimées à l'étape 5.
- La promo 2 démarre vide : aucun stagiaire, aucune progression (tout « À faire »), aucun examen
  ouvert, aucun réglage (« clé absente = tout ouvert » pour les modules de B).

## B. Règles d'accès

### B.1 Pourquoi la promo voyage avec la requête

Trois options étudiées : promo envoyée avec chaque requête et vérifiée par la base (retenue), promo
active enregistrée dans le profil, filtre explicite dans chaque fonction de l'app.

- **Promo enregistrée dans le profil** : casse dès qu'une personne a deux appareils. Basculer sur le
  PC bascule le téléphone sans le dire, et une modification du planning faite sur le téléphone part
  dans la mauvaise promo.
- **Filtre explicite** : exige zéro oubli dans les ~60 fonctions de `db.js`, et l'ancienne version
  en cache n'enverrait aucun filtre : un formateur verrait les deux promos mélangées.
- **Promo par requête** : le schéma standard des applications multi-clients sur Postgres.
  L'isolation est garantie par la base, chaque appareil et chaque onglet a son contexte, un client
  ancien ou buggé ne lit jamais hors de ses droits. Deux renforts viendront plus tard sans rien
  refaire : le niveau centre au-dessus des lieux, et les droits inscrits dans le jeton de
  connexion (pour éviter une lecture du profil par requête à grande échelle).

### B.2 Fonctions de contexte

SQL, `security definer`, `stable`, `search_path` fixé, email du jeton comparé en minuscules.

- **`peut_acceder_promo(p integer) → boolean`** : la promo existe, et l'utilisateur est fondateur,
  ou de rôle `prof` ou `admin`, ou a une fiche stagiaire dans la promo `p`.
- **`promo_par_defaut() → integer`** : règle de A.2 ; nulle sans utilisateur.
- **`promo_courante() → integer`** : lit l'en-tête `x-promo-id` dans
  `current_setting('request.headers', true)`, avec une lecture tolérante (réglage absent ou vide :
  pas d'en-tête).
  - En-tête absent ou vide : `promo_par_defaut()`.
  - En-tête fait uniquement de chiffres (`^[0-9]{1,9}$`) et promo accessible : cette promo.
  - Tout autre cas (promo interdite, valeur fantaisiste, visiteur non connecté) : nulle. Aucune
    ligne ne correspond alors, et toute insertion échoue sur la contrainte de non-nullité.
- **`mes_promos() → table (id, nom, lieu_id, lieu_nom, date_debut, date_fin, par_defaut
  boolean, stagiaire_id integer)`** : les promos accessibles avec leur lieu, celle par défaut
  marquée, et l'identité stagiaire de l'utilisateur dans chacune (nulle s'il n'y a pas de fiche).
- **`lieu_courant() → integer`** : le lieu de `promo_courante()`, nul s'il n'y a pas de promo
  courante.
- **`my_stagiaire_id()`** (existante) : ne renvoie plus l'identité stagiaire que si cette fiche
  appartient à `promo_courante()`.
- `is_admin()` et `is_prof()` restent globales (rôle de la personne) : la restriction à la promo
  vient de la condition `promo_id` de chaque règle.
- Droits d'exécution : `authenticated` **et** `anon` sur `promo_courante`, `lieu_courant`,
  `peut_acceder_promo`, `promo_par_defaut`. Les règles ouvertes à `public` les appellent ; sans
  ce droit, une requête sans jeton échoue en « permission denied » au lieu d'un refus propre
  (leçon du 18/07). `mes_promos` : `authenticated` seul.

### B.3 Forme des règles, table par table

Partout, la condition promo s'écrit `promo_id = (select promo_courante())` et la condition lieu
`lieu_id = (select lieu_courant())`, évaluées une fois par requête. Elles s'ajoutent aux conditions
de rôle actuelles, qui restent identiques.

| Table | Lecture | Écriture |
|---|---|---|
| `stagiaires`, `evaluations`, `planning_entries`, `planning_half_meta`, `planning_jours_off`, `agenda_events` | promo | `is_admin()` + promo |
| `evaluations_audit`, `passages_audit` | promo | aucune (triggers seulement) |
| `passages` | promo | `is_admin()` + promo ; ajout de ses propres passages + promo ; modification des siens + promo (règles actuelles) |
| `qcm_attempts` | les siennes + promo ; `is_admin()` + promo | ajout des siennes + promo, en entraînement, ou en examen tant que `qcm_exam_remise_toleree` l'accepte pour la promo (condition actuelle) ; `is_admin()` + promo |
| `epcf_evaluations`, `epcf_livrets` | `is_admin()`, `is_prof()` ou soi, + promo | `is_admin()` ou `is_prof()`, + promo |
| `dp_dossiers` | `is_admin()`, `is_prof()` ou soi, + promo | ajout et modification : `is_admin()`, `is_prof()` ou soi, + promo ; suppression : `is_admin()` + promo |
| `fiches_suivi` | promo (aujourd'hui ouverte à tous les connectés) | `is_admin()` ou soi, + promo ; suppression : `is_admin()` + promo |
| `settings` | promo : les réglages globaux ne sont plus lisibles depuis l'app, qui ne les lit pas | `is_admin()` + promo : les réglages globaux ne s'écrivent plus depuis l'app |
| `themes_progression` | promo | `is_admin()` + promo |
| `qcm_examens` | promo | ajout et modification : `is_admin()` ou `is_prof()`, + promo ; suppression : `is_admin()` + promo |
| `benevoles`, `auto_ecoles`, `benevole_suivi` | `is_admin()` + lieu | `is_admin()` + lieu |
| `lieux` | lieux des promos accessibles | aucune depuis l'app |
| `promos` | `peut_acceder_promo(id)` | modification du seul `nom` (droit de colonne) par `is_admin()` + `peut_acceder_promo(id)` ; ni création ni suppression depuis l'app |

### B.4 Comptes (`user_profiles`)

- Lecture : sa propre ligne ; les lignes du personnel (`stagiaire_id` nul) ; les lignes dont la
  fiche stagiaire est dans la promo courante. Un stagiaire de septembre ne voit donc ni les emails
  ni l'anonymat des stagiaires de mars, et inversement.
- Écriture (ajout, modification, suppression) : `is_admin()` et (ligne du personnel, ou fiche
  stagiaire dans la promo courante).
- Inchangés : la fonction `set_my_anonymous_notes`, le trigger d'inscription
  `enforce_whitelist_signup`, la fonction Edge `invite-user` (elle écrit en clé de service ; une
  invitation de stagiaire se fait depuis la promo courante, dont la liste ne propose que ses
  stagiaires).

### B.5 Fonctions serveur à adapter

| Fonction | Changement |
|---|---|
| `qcm_exam_demarrable(qcm)`, `qcm_exam_remise_toleree(qcm)` | Lisent l'état d'examen dans `qcm_examens` pour `promo_courante()` ; restent le miroir exact de `js/qcm-exam-rules.js` |
| `audit_evaluations`, `audit_passages` | Recopient `promo_id` dans l'historique |
| `epcf_moyennes(trame)` | Moyennes de la promo courante seulement (aujourd'hui sur toute la base) |
| `set_date_naissance` | La fiche visée doit appartenir à la promo courante |
| `benevoles_noms()` | Ne renvoie plus que les bénévoles du lieu courant (inactifs compris, pour que les vieilles semaines restent lisibles) |
| **`venues_benevoles()`** (nouvelle) | Réservée à `is_admin()` : les cartes du planning portant des bénévoles, **toutes promos du lieu courant**, avec le nom de la promo. Remplace la lecture directe de `planning_entries` pour le suivi des bénévoles |

`mirror_exam_to_evaluations` n'a rien à changer : la note qu'il recopie dans `evaluations` reçoit
sa promo du trigger de cette table. Inchangées : `chatbot_consommer`,
`chercher_cours`, `decoupe_markdown`, `rechunk_cours`, `set_my_anonymous_notes`,
`enforce_whitelist_signup`. Fonctions Edge `chatbot` et `invite-user` : aucun changement, et
l'en-tête de promo ne leur est jamais envoyé.

## C. Application

### C.1 Contexte de promo

- **État** : un seul endroit (dans `db.js` ou un petit module qu'il importe) tient la liste
  `mes_promos()` et la promo courante.
- **Démarrage**, à la connexion comme au retour sur l'app : utilisateur connu, puis `mes_promos()`,
  puis promo mémorisée sur l'appareil si elle figure dans la liste (sinon celle marquée par défaut),
  puis pose du contexte, et **seulement ensuite** les premières lectures (annuaires, profil). Liste
  vide : déconnexion avec message, comme un compte non autorisé.
- **Mémorisation** : `localStorage`, clé propre au compte (`ecsr_promo:` + email en minuscules),
  pour qu'un appareil partagé ne mélange pas deux personnes. Lecture et écriture protégées par
  `try/catch` (navigation privée).
- **Transport** : le `fetch` personnalisé de `db.js` ajoute `x-promo-id` aux seules URL
  `SUPABASE_URL + "/rest/v1/"` (tables et RPC). Jamais vers `/functions/v1/` (CORS refusé),
  `/auth/v1/` ni `/storage/v1/`.
- **Bascule** : attendre la fin des enregistrements en cours du planning (mécanisme `pendingSaves`
  et `flushPendingInputs` existant), mémoriser le choix, puis recharger la page. Le rechargement
  vide aussi les caches de données et la pile Ctrl+Z, qui ne doit jamais rejouer une action de mars
  dans septembre.
- **Déconnexion** : le contexte est oublié en mémoire ; le choix mémorisé reste, il est propre au
  compte.

### C.2 Pastille

- Dans la barre du haut, avant le badge du nom ; affichée seulement si `mes_promos()` compte au
  moins deux promos. Les stagiaires ne voient rien de nouveau.
- Libellé court tiré de `date_debut` : « mars 2026 », « sept. 2026 », précédé du lieu
  (« Montpellier · sept. 2026 ») dès que les promos accessibles couvrent plusieurs lieux. Un appui
  ouvre la liste des noms complets, promo courante cochée ; choisir une autre promo déclenche la
  bascule de C.1.
- Doit tenir sur iPhone à côté des onglets en icônes. Ce n'est pas un contrôle d'édition : elle
  n'entre pas dans le groupe `.read-only`.

### C.3 Rôle effectif

`getMyProfile()` renvoie le profil **effectif dans la promo courante** : `stagiaire_id` vaut celui
que `mes_promos()` donne pour cette promo, et un rôle `stagiaire` sans fiche dans cette promo
devient `admin`. Tous les appelants (`auth-admin.js`, `views/themes.js`, `views/qcm.js`) en
profitent sans changement. Pour Timy dans septembre : pas d'espace stagiaire, pas de tentative
d'examen, interface d'admin.

### C.4 `db.js` (seul fichier d'accès aux données touché)

| Fonctions | Changement |
|---|---|
| `fetchWithTimeout` | Ajout de l'en-tête de promo (C.1) |
| Nouvelles | `chargerMesPromos()`, `getMesPromos()`, `getPromoCourante()`, `choisirPromo(id)`, `renommerPromo(id, nom)` |
| `listThemes`, `addTheme`, `updateTheme` | Lecture : progression de la promo courante fusionnée dans chaque thème (« À faire » et dates nulles par défaut). Écriture : champs de progression vers `themes_progression` (upsert sur `promo_id,theme_id`), le reste vers `themes` |
| `listQcmIndex`, `getQcmFull` | État d'examen de la promo courante fusionné (fermé, 30 s par question par défaut) |
| `publishQcm`, `unpublishQcm`, `setExamDraw`, `updateExamConfig` | Écrivent dans `qcm_examens` (upsert sur `promo_id,qcm_id`) |
| `upsertPlanningEntry`, `upsertHalfMeta`, `setJourOff`, `setSetting` | Cible d'unicité préfixée par `promo_id` |
| `getSetting`, `setSetting` | Même signature, désormais propres à la promo courante : **porte d'entrée de B** |
| `listBenevoles`, `listAutoEcoles`, `listBenevolesNoms`, ajouts de bénévoles et d'auto-écoles | Code inchangé : la base ne renvoie que la banque du lieu courant, et un ajout y est rattaché d'office |
| `listVenuesBenevoles` | Passe par `venues_benevoles()` ; une venue d'une autre promo du même lieu s'affiche avec le nom de sa promo, sans les noms d'élèves |
| `getMyProfile` | Profil effectif (C.3) |

**Règle de fusion** : elle ne lit **jamais** les anciennes colonnes de `themes` et de `qcm`, même
pendant la bascule où elles portent encore les valeurs de mars. Dans septembre, un thème sans ligne
de progression est « À faire », un QCM sans ligne d'examen est fermé.

### C.5 Paramètres

- Section « Promo » : nom de la promo courante, modifiable par les admins (remplace `cohort_name`,
  inutilisé), et son lieu, affiché. Les stagiaires listés et ajoutés sont ceux de la promo
  courante. La liste des formateurs est présentée comme commune à toutes les promos.
- Panneau Bénévoles : son titre indique le lieu de la banque affichée (« Bénévoles · Nîmes »).
- « Accès & invitations » : code inchangé ; la base ne renvoie que le personnel et les stagiaires
  de la promo courante.

### C.6 Nouveautés

`vuesEffectives` reçoit une date d'amorce : la plus tardive entre `MISE_EN_LIGNE` (2026-08-01) et
la `date_debut` de la promo courante. Au premier passage sur un appareil, les entrées antérieures
comptent comme déjà lues ; elles restent lisibles dans la page Nouveautés comme historique de
l'app. Appelants : `main.js` (pastille de l'onglet Accueil), `views/home.js`,
`views/nouveautes.js`. Test `node` mis à jour.

### C.7 Ancienne version en cache

Une version sans contexte de promo n'envoie pas d'en-tête : la base répond sur la promo par défaut,
mars 2026 pour tous les comptes existants. Lectures et écritures des stagiaires de mars restent
correctes : aucune ne vise une contrainte modifiée, et la synchronisation de D.2 garde à jour ce
qu'elle lit des thèmes et des examens. Seuls les enregistrements du planning et des réglages d'une
vieille version échouent après la migration de bascule (étape 3), avec un message d'erreur visible,
jamais une écriture au mauvais endroit : on demande aux formateurs de rafraîchir.

## D. Déploiement

### D.1 Étapes

| Étape | Contenu | Visible pour | Marche arrière |
|---|---|---|---|
| **1. Fondations** (migration) | `lieux` (Nîmes, Montpellier) et `promos` (2 lignes, à Nîmes) ; colonnes `lieu_id` des banques remplies avec Nîmes ; colonnes `promo_id` remplies avec 1, puis rendues non nulles avec leur défaut ou leur trigger ; index ; `themes_progression` et `qcm_examens` remplies pour la promo 1 ; fonctions de B.2 ; triggers de D.2. Nouvelles unicités **ajoutées à côté** des anciennes. Règles d'accès inchangées | Personne | Migration retour : suppression de tout l'ajouté, rien d'existant n'a été modifié |
| **2. Cloisonnement** (migration) | Photo « avant » (E.2) ; répétition des nouvelles règles dans une transaction annulée, avec le script de preuve ; puis application réelle de B.3, B.4 et B.5. Script de preuve vert, photo « après » identique | Personne : l'app actuelle n'envoie pas d'en-tête, elle reste sur la promo 1 | Migration retour écrite d'avance, qui recrée les règles et fonctions relevées le 01/10 à l'identique |
| **3. App et formateurs** | Fusion dans `main` (contexte, pastille, `db.js`, Paramètres, Nouveautés et entrée « formateurs »), poussée par Timy, contrôle en ligne. **Ensuite seulement**, migration de bascule : suppression des anciennes unicités et de la clé primaire `key` de `settings`. Les formateurs préparent septembre : stagiaires, calendrier, planning | Formateurs et Timy | Revenir au commit précédent ; recréer les anciennes unicités tant que septembre n'a pas de données, ensuite corriger en avant |
| **4. Ouverture aux 8** | Après la livraison des modules (B) : saisie des 8 dans Paramètres, invitations, preuve rejouée avec un vrai compte de septembre, message WhatsApp | Les 8 | Retirer les invitations |
| **5. Ménage** | Quand plus aucun appareil ne tourne sur l'ancienne version : suppression des triggers de D.2, des anciennes colonnes de `themes` et `qcm`, et des réglages `cohort_name` et `password_hash` | Personne | Inutile : tout vit dans les nouvelles tables |

L'ordre de l'étape 3 compte : la nouvelle version fonctionne avec les anciennes et les nouvelles
unicités ; la suppression des anciennes ne vient qu'une fois la nouvelle version en ligne. Les
migrations sont versionnées en fichiers SQL dans le dépôt, à côté de leur migration retour.

### D.2 Synchronisation pendant la bascule (étapes 1 à 5)

Entre les étapes 1 et 5, les anciennes colonnes de `themes` et `qcm` et les lignes de la
**promo 1** des nouvelles tables restent identiques, dans les deux sens :

- une écriture dans les anciennes colonnes (ancienne version, chez un formateur) est recopiée dans
  `themes_progression` ou `qcm_examens` pour la promo 1 ;
- une écriture de la promo 1 dans les nouvelles tables (nouvelle version) est recopiée dans les
  anciennes colonnes ;
- une garde `pg_trigger_depth()` empêche les allers-retours ; la promo 2 ne touche jamais les
  anciennes colonnes.

Un iPhone de mars resté sur l'ancienne version voit ainsi toujours un examen ouvert quand il l'est,
et une modification faite par une vieille version n'est pas perdue.

### D.3 Données personnelles

Le dépôt est public. Les migrations versionnées ne contiennent que de la structure et les deux noms
de promos. Les noms et emails des 8 se saisissent dans l'app (Paramètres). Le script de preuve
choisit ses personnages par requête (« un formateur », « le fondateur », « un stagiaire actif de la
promo 1 »), sans aucun email écrit en dur.

## E. Preuve et vérifications

### E.1 Script de preuve (SQL, versionné, rejouable)

- Exécuté dans une transaction **annulée** : rien n'est écrit, même quand il crée un stagiaire
  fictif de septembre et son profil pour les tester.
- Personnages : stagiaire de mars, formateur, fondateur en promo 1 puis en promo 2, stagiaire
  fictif de septembre, visiteur non connecté. Simulation par `set local role`,
  `request.jwt.claims` et `request.headers`.
- Lieux : les deux promos réelles étant à Nîmes, le script crée aussi, dans la même transaction
  annulée, une promo fictive à Montpellier avec un bénévole et une auto-école. Un formateur dans
  une promo de Nîmes ne doit voir que la banque de Nîmes, et inversement.
- Pour chaque table : lire, ajouter, modifier, supprimer, dans chaque contexte (sans en-tête,
  en-tête 1, en-tête 2, en-tête interdit, en-tête fantaisiste). Comparaison à une matrice attendue,
  sortie lisible et **verdict unique**.
- Rejoué en répétition avant l'étape 2, après l'étape 2, après la migration de bascule de l'étape
  3, et à l'étape 4 avec un vrai compte de septembre.
- Contrôle des alertes de sécurité Supabase après chaque migration.

### E.2 Non-régression de mars 2026

Avant l'étape 2, pour chaque personnage de mars : nombre de lignes visibles, table par table.
Après : identique sans en-tête et avec l'en-tête 1. Seul écart attendu et documenté : les réglages
globaux (`chatbot_quota_jour`, `cohort_name`, `password_hash`) ne sont plus lisibles depuis l'app,
qui ne les lit pas.

### E.3 Tests `node`

Règles pures, sans réseau : choix de la promo (mémorisée valide, mémorisée devenue inaccessible,
absente), libellé court, profil effectif, ajout de l'en-tête selon l'URL (`rest` oui ; `functions`,
`auth`, `storage` non), amorce des Nouveautés avec la date de promo, fusion de la progression et de
l'état d'examen (défauts, anciennes colonnes ignorées).

### E.4 Banc d'essai navigateur

Banc à import map (`_harness_supabase.js` recopié depuis `TP_ECSR_App`, stub enrichi de
`mes_promos`) : pastille visible pour un formateur et pour le fondateur, absente pour un
stagiaire ; bascule (mémorisation puis rechargement) ; fondateur traité en admin dans septembre ;
thèmes « À faire » et examens fermés dans septembre ; Nouveautés sans arriéré ; titre du
panneau Bénévoles avec le lieu ; libellé de la pastille précédé du lieu quand les promos couvrent
plusieurs lieux. Les embarquements
existants (`stagiaires!stagiaire_id` dans notes, passages, EPCF, examens) sont aussi contrôlés sur
la vraie base après l'étape 1. Vérification dans le navigateur avant toute annonce.

### E.5 En ligne

Après la poussée : jeton de cache servi par Pages ; pastille et bascule constatées sur un compte de
formateur ou du fondateur ; septembre vide, mars intacte.

## F. Coordination

- **B (modules, branche `modules`)** : l'état des modules est une clé lue et écrite **uniquement**
  par `getSetting` / `setSetting` de `db.js`, désormais propres à la promo courante. « Clé absente =
  tout ouvert », donc mars ne perd rien. Pas d'accès direct à la table `settings`, pas de ligne
  créée par migration (une migration n'a pas de promo courante). Une vérification côté serveur, si
  B en a besoin, s'appuie sur `promo_courante()`. Le filtre des Nouveautés par date de promo est
  pris par A. B lit cette spec par
  `git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App show multi-promo:docs/superpowers/specs/2026-10-01-multi-promo-design.md`.
- **C (cours REMC, branche `cours-remc`)** : `cours` reste commune ; aucun conflit attendu ; se
  prévenir avant de fusionner.
- Fusions : A touche surtout `db.js` (transport, thèmes, QCM, réglages, upserts), `auth-admin.js`,
  `main.js`, `nouveautes.js`, `views/config.js` et `views/benevoles.js`. Le second à fusionner
  reprend `main` et résout.

## G. Hors périmètre, limites connues

- Niveau centre, écran de création de promo, transfert d'un stagiaire d'une promo à l'autre.
- Un bénévole placé au même créneau dans deux promos du même lieu n'est pas signalé.
- Rattachement des formateurs à des lieux : aujourd'hui un formateur accède à toutes les promos,
  tous lieux confondus. À faire le jour où un lieu aura ses propres formateurs.
- Déplacer un bénévole ou une auto-école d'un lieu à l'autre : pas d'interface.
- Contacts (secrétariats) propres à chaque lieu : même logique possible plus tard, non demandée.
- Fin de vie de la promo de mars (archivage, conservation de 12 mois prévue par les conditions
  d'utilisation) : chantier ultérieur.
- Droits inscrits dans le jeton de connexion (performance à grande échelle) : plus tard, sans
  changer le principe.
- Le guide de l'assistant (fonction Edge `chatbot`) ne mentionne pas la pastille ; à compléter au
  prochain déploiement de la fonction.

## H. Fin de chantier

PROJECT_NOTES.md (modèle multi-promo, fonctions de contexte, pièges), mémoire projet, worktree et
branche fermés, message WhatsApp prêt à copier, puis proposition d'archivage.
