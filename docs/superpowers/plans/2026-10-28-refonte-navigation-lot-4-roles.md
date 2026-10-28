# Lot 4 de la refonte : rôles et portées en base (plan de mise en œuvre)

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (mode choisi, comme au
> lot 1 : un agent par tâche, une relecture avant la suivante, relecture finale de toute la branche par le modèle
> le plus capable). Étapes en cases à cocher (`- [ ]`).

**But :** que les droits de chacun (stagiaire, formateur, direction, siège, fondateur) soient décidés par la base,
sur sa portée (promo, centre, réseau), sans rien changer pour les comptes actuels.

**Architecture :** une table `affectations` porte les rôles de l'équipe ; la fiche du stagiaire porte déjà le sien.
Un petit vocabulaire de fonctions SQL (`est_formateur`, `equipe_courante`, ...) remplace `is_admin()` dans toutes
les règles RLS (règles de sécurité vérifiées ligne par ligne par la base). L'aperçu « Voir en tant que » du
fondateur passe par un en-tête de requête que la base honore pour lui seul : il devient fidèle.

**Technique :** PostgreSQL 17 (Supabase `crpduennbqaemhfaywrz`), règles RLS, fonctions `security definer`,
modules ES sans framework, `node --test`, preuves SQL rejouables (`tests/sql/`).

**Spec :** `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md` (§ 4.3 et § 7) ; découpage
`docs/superpowers/plans/2026-10-27-refonte-navigation-lots.md` ; décision R32 (annexe du plan du lot 1).

## Global Constraints

- Aucun tiret cadratin (U+2014) nulle part : code, SQL, commits, Nouveautés, réponses.
- « Formateur », jamais « Prof » à l'écran ; tutoiement dans les textes destinés aux stagiaires.
- Aucun email réel dans le dépôt (il est public) : les personnages des preuves sont fictifs (`@exemple.invalid`)
  ou choisis par requête.
- Jamais de `git push`, jamais de migration appliquée en production sans l'accord explicite de Timy, jamais de
  cours publié.
- Migrations : `supabase/migrations/20261028_roles_<n>_<nom>.sql`, chacune avec son `_retour.sql`. Une
  migration ne supprime une règle que par son nom exact (sans `if exists`) : un écart avec la production la fait
  échouer au lieu de passer en silence.
- Toute écriture atteignable par l'interface d'un rôle qui ne l'a pas en base est masquée côté app (règle d'or
  de `ecsr_app_auth_rls_deploy`).
- Interface : cibles de 44 px sur téléphone, aucun défilement de côté, contraste AA, DA de Timy intacte.
- Toute mise en ligne visible porte son entrée dans `js/nouveautes-data.js`, dans le même commit.
- Répétitions sur la vraie base : toujours dans un bloc `do` qui finit par une levée (tout est annulé), avec
  `set local lock_timeout = '3s'`, hors des heures de cours (les règles posent des verrous le temps du bloc).

## Review Focus

1. Un compte réel qui gagne ou perd une seule ligne après la migration (Nîmes en CCP2 jusqu'au 11/12,
   Montpellier) : photo avant et après de chaque compte réel, dans chaque promo, sur chaque table (Task 3).
2. Un ancien client resté en cache sur un iPhone : il lit `is_admin` et `role`, appelle `invite-user` ; ces
   colonnes restent identiques pour tous les comptes réels (Task 3) et l'app retombe sur elles quand la base ne
   donne pas encore `roles` (Task 7).
3. L'en-tête d'aperçu envoyé par un autre compte que le fondateur, ou resté posé après « Revenir fondateur » ou
   une déconnexion : la base l'ignore (Task 3), l'app le retire (Task 7).
4. Les écritures « insérer ou mettre à jour » de l'app (`settings`, `qcm_examens`) sous les nouvelles règles :
   la preuve les joue sous la forme exacte de l'app (Task 3).
5. Une table ajoutée à `main` par une conversation parallèle (signalement, Qualiopi, veille) avant la fusion :
   le contrôle de couverture de la preuve la signale (Task 3), on la traite avant de finaliser (Task 9).

## 0. Le modèle de données

| Rôle | Portée | Où il est écrit | Migration des rôles actuels |
|---|---|---|---|
| Stagiaire | sa promo | sa fiche (`user_profiles.stagiaire_id`, puis `stagiaires.promo_id`), comme aujourd'hui | rien à faire : la fiche le dit déjà |
| Formateur | une promo | `affectations` (role `formateur`, `promo_id`) | les 3 formateurs actuels sur les promos 1, 2 et 7 (9 lignes), car ils voient aujourd'hui les trois |
| Direction | un centre (table `lieux`) | `affectations` (role `direction`, `lieu_id`) | aucun compte aujourd'hui |
| Siège | le réseau | `affectations` (role `siege`) | aucun compte aujourd'hui |
| Fondateur | tout | `user_profiles.is_founder`, inchangé | inchangé |

Pourquoi le stagiaire reste sur sa fiche : quarante règles et fonctions lisent déjà `stagiaire_id`, et une ligne
d'affectation en double serait une seconde vérité à synchroniser. Les rôles se cumulent : une directrice qui forme
a une ligne `direction` et une ligne `formateur`.

**Table `public.affectations`** : `id bigint generated always as identity primary key` ; `email text not null
references user_profiles(email) on update cascade on delete cascade` ; `role text not null` (`formateur`,
`direction`, `siege`) ; `promo_id integer references promos(id) on delete cascade` ; `lieu_id integer references
lieux(id) on delete cascade` ; `cree_le timestamptz not null default now()` ; `cree_par text default
lower(auth.jwt() ->> 'email')`. Contrainte `affectations_portee` : formateur = promo seule, direction = lieu seul,
siège = ni l'un ni l'autre. Unicité `nulls not distinct (email, role, promo_id, lieu_id)`. Index sur `email`,
`promo_id`, `lieu_id`. RLS active ; `select, insert, delete` à `authenticated`, rien à `anon`, aucune
modification (on retire puis on ajoute).

**Anciennes colonnes** `role`, `is_admin`, `prof_id` : gardées pour les anciens clients et la fonction
`invite-user`, elles ne décident plus d'aucun droit. Une invitation de formateur pose encore `role = 'prof'` et
`is_admin = true` pour que les anciens clients affichent le bon écran.

**Aperçu fidèle** : l'app du fondateur en aperçu envoie l'en-tête `x-apercu-role` (`stagiaire`, `formateur`,
`direction`, `siege`) sur chaque requête de données, comme `x-promo-id`. La base l'honore pour le seul fondateur
(colonne `is_founder` lue par l'email du jeton) et seulement pour retirer des droits : elle répond alors comme
pour une personne de ce rôle sur la promo affichée (formateur de cette promo, direction de son centre, siège,
stagiaire avec la fiche du fondateur s'il en a une dans cette promo). La navigation entre promos reste celle du
fondateur. Vérifié le 28/10 : la passerelle de Supabase accepte cet en-tête depuis le navigateur. Limites
assumées : le stockage des images et les fonctions Edge ne reçoivent pas l'en-tête (l'aperçu y garde les droits
du fondateur).

```
Navigateur (app)  --x-promo-id, x-apercu-role-->  PostgREST  -->  règles RLS
                                                                   |
                       vocabulaire : est_formateur(p), equipe_courante(), est_siege() ...
                                                                   |
                         affectations (équipe)  +  fiche du stagiaire  +  is_founder
```

### Vocabulaire SQL (étape 1)

Toutes en `language sql` (ou `plpgsql` pour lire l'en-tête), `stable security definer set search_path = public,
pg_temp`, email comparé en minuscules à `auth.jwt() ->> 'email'`.

| Fonction | Rend | En aperçu (fondateur seulement) |
|---|---|---|
| `fondateur_reel()` | le fondateur, aperçu ou non (interne, pas de droit d'exécution public) | vrai |
| `apercu_role()` | le rôle simulé, ou null (en-tête invalide, absent, ou appelant non fondateur) | le rôle |
| `est_fondateur()` | fondateur hors aperçu | faux |
| `est_formateur(p integer)` | affectation formateur sur `p`, ou fondateur | `formateur` : `p` est la promo affichée ; sinon faux |
| `est_direction(l integer)` | affectation direction sur le lieu `l`, ou fondateur | `direction` : `l` est le lieu affiché ; sinon faux |
| `est_siege()` | affectation siège, ou fondateur | vrai en `siege`, faux sinon |
| `lieu_de_promo(p integer)` | le lieu de la promo | identique |
| `formateur_courant()` | `est_formateur(promo_courante())` | suit |
| `direction_courante()` | `est_direction(lieu_courant())` | suit |
| `equipe_courante()` | formateur ou direction de la promo affichée | suit |
| `redacteur_contenus()` | `formateur_courant()` ou `est_siege()` (cours et questions de QCM, communs au réseau) | suit |
| `roles_reels(p integer)` | `text[]` des rôles réels sur `p` (`stagiaire`, `formateur`, `direction`), sans aperçu | ignore l'aperçu |

Droits d'exécution : `anon, authenticated` pour celles qu'une règle appelle directement ; rien de public pour
`fondateur_reel`, `apercu_role`, `roles_reels`.

### Fonctions modifiées (étape 2)

- `peut_acceder_promo(p)` : la promo existe et (fondateur réel, fiche dans `p`, formateur de `p`, direction du
  lieu de `p`). Le siège n'accède à aucune promo : aucune donnée nominative.
- `promo_par_defaut()` : la promo de la fiche, sinon la première promo accessible non finie (par `date_debut`,
  `id`), sinon la dernière accessible. Même résultat qu'aujourd'hui pour tous les comptes réels.
- `promo_courante()` : renvoie null en aperçu `siege` ; sinon inchangée.
- `my_stagiaire_id()` : null en aperçu autre que `stagiaire`.
- `mes_promos()` : gagne la colonne `roles text[]` (`roles_reels`), supprimée puis recréée avec les mêmes droits
  (`authenticated, service_role`, pas `anon`).
- `notes_stagiaires_visibles()` : `equipe_courante()` à la place de `is_admin() or is_prof()`.
- Compatibilité le temps de la bascule (à ne plus utiliser dans du code neuf) : `is_admin()` et `is_prof()` =
  `formateur_courant()` ; `is_founder()` = `est_fondateur()`. La fonction Edge `qcm-ia` (appel `rpc is_admin`)
  continue donc de marcher.
- Fonctions serveur : `emargement_feuille`, `emargement_ouvrir`, `emargement_signer` (formateur :
  `formateur_courant()`) ; `anonymiser_promo`, `anonymiser_stagiaire`, `etat_anonymisation_promo`,
  `set_date_naissance`, `venues_benevoles` (`equipe_courante()`) ; `benevoles_a_purger`, `purger_benevoles`,
  `accepter_brouillon_ia`, `rejeter_brouillon_ia` (`formateur_courant()`).
- Nouvelles : `inviter_compte(p_email text, p_role text, p_stagiaire_id integer default null, p_prof_id integer
  default null, p_lieu_id integer default null) returns jsonb` ; `creer_promo(p_lieu_id integer, p_nom text,
  p_debut date, p_fin date) returns integer` ; `modifier_dates_promo(p_promo_id integer, p_debut date, p_fin date)
  returns void`. Refus en `raise exception 'invitation: …'` / `'promo: …'` (code 42501 pour un droit manquant),
  phrase montrée telle quelle par l'app.

`inviter_compte`, qui remplace l'appel à la fonction Edge `invite-user` :

| Rôle invité | Qui peut | Effet |
|---|---|---|
| `stagiaire` (fiche donnée) | formateur ou direction de la promo de la fiche | crée le profil (`role 'stagiaire'`, `is_admin false`) ; un profil existant n'est jamais rétrogradé ni relié à une seconde fiche |
| `formateur` (ou `prof`) | direction du centre de la promo affichée, ou fondateur | crée le profil s'il manque (`role 'prof'`, `is_admin true`, `prof_id`) puis l'affectation sur la promo affichée |
| `direction` | siège ou fondateur, `p_lieu_id` requis | profil s'il manque (`role 'prof'`, `is_admin false`) puis l'affectation |
| `siege` | fondateur | profil s'il manque puis l'affectation |

## 1. Matrice des droits (étape 3)

Notation : **P** la ligne est de la promo affichée (`promo_id = (select promo_courante())`) ; **L** du lieu
affiché ; **F** `formateur_courant()` ; **D** `direction_courante()` ; **E** `equipe_courante()` ; **R**
`redacteur_contenus()` ; **Fo** `est_fondateur()` ; **M** la ligne de la personne (sa fiche ou son email). Les
appels sans argument s'écrivent `(select f())` pour n'être calculés qu'une fois par requête.

| Table | Lecture | Écriture |
|---|---|---|
| agenda_events, planning_entries, planning_half_meta, planning_jours_off | P (inchangé) | P et F |
| stagiaires | P (inchangé) | P et E (inviter, abandon : « tout le centre ») |
| stagiaires_prive | fiche de P, et (E ou M) | par `set_date_naissance` |
| settings | P (inchangé) | P et, selon la clé : `navigation_v2`, `emargement_actif` : Fo ; `modules` : E ; autres : F |
| evaluations | P et (E ou fiche dans `notes_stagiaires_visibles()`) | P et F |
| evaluations_audit | P et (E ou évaluation visible) | déclencheur seulement |
| epcf_evaluations, epcf_livrets | P et (E ou M) | P et F |
| dp_dossiers, fiches_suivi | P et (E ou M) | ajout et modification : P et (F ou M) ; suppression : P et F |
| passages | P (inchangé) | P et F ; ajout et modification de la sienne (inchangé) |
| qcm_attempts | P et (E ou M) | P et F ; ajout de la sienne (inchangé) |
| qcm_examens, themes_progression | P (inchangé) | P et F |
| emargement_seances | P (inchangé) | fonctions serveur |
| emargement_lignes | P et (E ou M) | fonctions serveur |
| emargement_formateurs | P et E | fonctions serveur |
| auto_ecoles, benevoles, benevole_suivi | L et E | L et F |
| promos | `peut_acceder_promo(id)` (inchangé) | nom : `est_formateur(id)` ou `est_direction(lieu_id)` ; création et dates : `creer_promo`, `modifier_dates_promo` (direction du lieu ou fondateur) |
| lieux | lieu d'une promo accessible, ou `est_direction(id)`, ou `est_siege()` | aucune |
| affectations | M ; Fo ; formateurs d'une promo où je suis E ; directions de mon lieu ; S : directions et siège | formateur : direction du lieu de la promo ; direction : siège ; siège : Fo |
| user_profiles | M ; personnel (sans fiche, `role <> 'stagiaire'`) ; orphelins si E ; stagiaires de P | ajout et modification retirés à `anon` et `authenticated` (fonctions serveur seulement) ; suppression : jamais le fondateur ni un compte qui a une affectation ; stagiaire de P ou orphelin : E ; personnel : Fo |
| cours | publié, ou Fo, ou (thème : `code is null`) et (F ou D ou S) | modification : Fo, ou (F ou S) et (thème ou publié) |
| cours_versions | Fo, ou (F ou D ou S) et cours de thème ou publié | ajout : Fo, ou (F ou S) et cours de thème ou publié |
| qcm_questions, qcm_options | tous les connectés (inchangé) | R |
| qcm, themes, competences, ressources | tous les connectés (inchangé) | F |
| contacts, profs | tous les connectés (inchangé) | E |
| qcm_signalements | F ou M | ajout du sien (inchangé) ; traitement et suppression : F |
| qcm_signalement_instruction, qcm_ia_brouillons | F | fonctions serveur |
| conditions_acceptations | M ou E | fonction serveur |
| effacements_journal | E | fonctions serveur |
| chatbot_usage, qcm_ia_usage, cours_chunks | inchangé | inchangé |
| stockage `cours-images`, `qcm-images` | inchangé (public) | R |

Le siège n'écrit ni dans `qcm` ni dans `themes` : ces tables portent encore les anciennes colonnes de Nîmes,
recopiées par déclencheur dans `qcm_examens` et `themes_progression` de la promo 1 (ménage du multi-promo, étape 5,
pas encore fait). Il modifie et publie les cours et les questions ; créer un QCM ou un thème viendra après ce ménage.

Ce que voit chaque rôle, en résumé : le stagiaire, inchangé ; le formateur, ses promos et rien d'autre ; la
direction, tout son centre en lecture, et elle gère stagiaires, promos, modules et équipe ; le siège, aucune
donnée nominative (ses chiffres agrégés viendront au lot 5) ; le fondateur, tout.

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261028_roles_1_fondations.sql` (+ `_retour`) | table, vocabulaire, 9 affectations ; invisible |
| `supabase/migrations/20261028_roles_2_fonctions.sql` (+ `_retour`) | fonctions modifiées et nouvelles |
| `supabase/migrations/20261028_roles_3_regles.sql` (+ `_retour`) | règles de la matrice, `user_profiles`, stockage |
| `tests/sql/roles-empreinte.sql` | empreintes md5 des règles, des fonctions et des droits |
| `tests/sql/roles-preuve.sql` | preuve rôle par rôle, non-régression, couverture |
| `outils/assembler_repetition_roles.mjs` | assemble répétition, contre-épreuve et preuve en ligne |
| `js/roles-rules.js`, `tests/roles-rules.test.mjs` | règles pures : droits affichés, aperçu, invitations |
| `js/auth-admin.js`, `js/db.js`, `js/views/config.js`, `css/style.css`, `js/nouveautes-data.js` | branchements minimaux |

---

### Task 1 : empreintes et marches arrière des étapes 2 et 3

**Files :** Create `tests/sql/roles-empreinte.sql`, `supabase/migrations/20261028_roles_2_fonctions_retour.sql`,
`supabase/migrations/20261028_roles_3_regles_retour.sql`.

**Interfaces :** Produces : la requête d'empreinte (colonnes `regles`, `fonctions`, `droits`, chacune un md5) et
les deux fichiers de retour, que la Task 6 éprouve par un aller-retour.

- [ ] **Step 1 : écrire `roles-empreinte.sql`** : md5 ordonné de `pg_policies` (schémas `public` et `storage` :
  table, nom, permissive, rôles, commande, `qual`, `with_check`), de `pg_get_functiondef` de toutes les fonctions
  de `public`, et des droits `anon` / `authenticated` (tables, colonnes, fonctions de `public`).
- [ ] **Step 2 : la lancer sur la vraie base** (lecture seule, MCP) et noter les trois valeurs dans le registre
  `.superpowers/sdd/progress.md` du worktree.
- [ ] **Step 3 : générer `20261028_roles_3_regles_retour.sql` depuis la base** : pour chaque table de la matrice et
  `storage.objects`, supprimer toutes ses règles puis recréer à l'identique celles relevées (texte de
  `pg_policies`) ; remettre `insert, update` sur `user_profiles` à `anon, authenticated`.
- [ ] **Step 4 : générer `20261028_roles_2_fonctions_retour.sql`** : définitions relevées (`create or replace`) des
  fonctions modifiées, suppression des trois nouvelles, `mes_promos` recréée à l'ancienne avec ses droits.
- [ ] **Step 5 : commit** « Lot 4 : empreintes de la base et marches arrière relevées sur la production ».

### Task 2 : étape 1, fondations (invisible)

**Files :** Create `supabase/migrations/20261028_roles_1_fondations.sql` et `_retour.sql`,
`tests/sql/roles-1-preuve.sql`.

**Interfaces :** Produces : la table `affectations` et le vocabulaire de la section 0 (noms et signatures exacts).

- [ ] **Step 1 : écrire la preuve** (bloc `do`, levée finale, personnages fictifs créés dans le bloc) avec ces
  contrôles : `est_formateur(1)`, `(2)`, `(7)` vrais pour chaque formateur réel après l'amorce ; faux pour un
  stagiaire réel ; `est_fondateur()` vrai pour le fondateur, faux avec `x-apercu-role: stagiaire` ;
  `apercu_role()` null pour un stagiaire qui envoie `formateur` ; `est_direction(1)` vrai pour une direction
  fictive du lieu 1, faux pour le lieu 2 ; `est_siege()` vrai en aperçu `siege` ; contrainte de portée qui refuse
  un formateur sans promo ; empreinte `regles` hors table `affectations` inchangée ; retour joué ensuite :
  empreintes identiques à celles de la Task 1.
- [ ] **Step 2 : la jouer sur la vraie base sans la migration** : ROUGE (fonctions absentes).
- [ ] **Step 3 : écrire la migration** (section 0 : table, droits, règles d'`affectations`, vocabulaire, amorce
  des formateurs `role = 'prof' and is_admin` sur toutes les promos) et son retour.
- [ ] **Step 4 : rejouer la preuve avec la migration injectée par `execute`** (répétition annulée) : VERT.
- [ ] **Step 5 : commit** « Lot 4, étape 1 : table des affectations et vocabulaire des rôles (invisible) ».

### Task 3 : la preuve des étapes 2 et 3, écrite d'abord

**Files :** Create `tests/sql/roles-preuve.sql`, `outils/assembler_repetition_roles.mjs`,
`tests/assembler-roles.test.mjs`.

**Interfaces :** Consumes : le vocabulaire (Task 2), la matrice (section 1). Produces : `node
outils/assembler_repetition_roles.mjs <mode> <sortie.sql>` avec `mode` = `repetition` (migrations 1, 2, 3
injectées par `execute`, contrôles, retours 3, 2, 1, empreinte), `contre-epreuve` (étape 1 seule) ou `en-ligne`
(rien d'injecté, après application).

Reprendre les aides de `tests/sql/multi-promo-preuve.sql` (`incarner`, `compter`, `ecrire`, `verifier`), avec un
troisième argument d'`incarner` pour `x-apercu-role`. Personnages fictifs créés dans le bloc : `stag_n` (fiche de
la promo 1), `stag_m` (fiche de la promo 2), `form_n` (formateur de 1), `form_m` (formateur de 2), `dir_n`
(direction du lieu 1), `siege` ; le fondateur et tous les comptes réels sont choisis par requête.

- [ ] **Step 1 : écrire les contrôles**, chacun nommé dans le verdict :
  - non-régression : pour chaque compte réel et chaque promo (1, 2, 7), même nombre de lignes visibles avant et
    après sur chaque table sous RLS ; mêmes `role`, `is_admin`, `is_founder`, `stagiaire_id` ; mêmes
    `mes_promos()` (colonne `roles` mise à part) ;
  - matrice : pour chaque personnage, chaque contexte (1, 2, 7, sans en-tête) et chaque table, lignes visibles =
    lignes attendues selon la section 1 (calculées en propriétaire), et ajout, modification, suppression
    acceptés ou refusés selon elle (refus tentés sans `returning`, constat en propriétaire) ;
  - siège : 0 ligne de toute table d'une promo ou d'un lieu, 0 profil de stagiaire, dans chaque contexte ;
  - aperçu : le fondateur en aperçu `formateur`, `direction`, `siege` sur la promo 1 voit exactement ce que voient
    `form_n`, `dir_n`, `siege` ; en `stagiaire`, ce qu'attend le modèle pour sa fiche ; `stag_n` qui envoie
    `x-apercu-role: formateur` ne voit rien de plus ;
  - R32 : `navigation_v2` et `emargement_actif` écrits (forme de l'app : insérer ou mettre à jour) par le
    fondateur : OK ; par `form_n`, `dir_n`, `stag_n`, le fondateur en aperçu `formateur` : refus ; `modules` par
    `form_n` et `dir_n` en promo 1 : OK, par `dir_n` en promo 2 et par `stag_n` : refus ;
  - comptes : `form_n` ne peut se donner `is_founder` ni `is_admin` (refus 42501) ; ne supprime ni le compte du
    fondateur ni celui de `form_m` (0 ligne) ; supprime un compte de stagiaire de sa promo ;
  - `inviter_compte` : selon le tableau de la section 0, cas permis et refusés, et un profil existant jamais
    rétrogradé ; `affectations` : `dir_n` affecte `form_m` à la promo 1 (OK) et à la promo 2 (refus), `form_n`
    n'affecte personne, le siège ajoute une direction mais pas un siège ;
  - promos : `creer_promo` et `modifier_dates_promo` par `dir_n` sur le lieu 1 (OK), sur le lieu 2 et par
    `form_n` (refus) ; renommage par `form_n` en promo 1 (OK), en promo 2 (refus) ;
  - fonctions serveur : `emargement_ouvrir` par `dir_n` (refus) et `form_n` (OK, émargement activé dans le bloc) ;
    `anonymiser_stagiaire` et `etat_anonymisation_promo` refusés à `stag_n`, permis à `dir_n` ; `purger_benevoles`
    refusé à `dir_n` ; `venues_benevoles` de `dir_n` limité à Nîmes ;
  - contenus : le siège modifie et publie un cours de thème et modifie une question (OK), écrit `qcm_examens` et
    `qcm` (refus) ; `dir_n` modifie un cours (refus) ;
  - compatibilité : `is_admin()` = `formateur_courant()` pour chaque personnage et contexte ; `is_founder()` faux
    en aperçu ; `mes_promos()` donne `{formateur}` aux formateurs réels sur 1, 2, 7 et `{stagiaire}` au fondateur
    sur 1 ;
  - couverture : toute table de `public` sous RLS figure dans la matrice ; plus aucune règle ne cite `is_admin(`,
    `is_prof(` ou `is_founder(` ;
  - retour : après les retours 3, 2, 1, les trois empreintes égalent celles d'avant.
- [ ] **Step 2 : écrire l'assembleur et son test** : le test vérifie que la sortie contient chaque fichier de
  migration et de retour à l'octet près (md5) et que le mode `en-ligne` n'en contient aucun.
- [ ] **Step 3 : contre-épreuve sur la vraie base** (mode `contre-epreuve`, MCP) : ROUGE exactement sur les lignes
  qui décrivent un changement voulu (formateur limité à ses promos, direction, siège, aperçu, R32, comptes,
  invitations, promos, contenus, couverture) ; VERT sur la non-régression. Noter la liste dans le registre.
- [ ] **Step 4 : commit** « Lot 4 : preuve rôle par rôle et son assembleur (contre-épreuve ROUGE où attendu) ».

### Task 4 : étape 2, fonctions

**Files :** Create `supabase/migrations/20261028_roles_2_fonctions.sql`.

**Interfaces :** Consumes : vocabulaire (Task 2). Produces : les fonctions de la section 0, « Fonctions modifiées »,
signatures exactes ; `mes_promos()` avec `roles text[]` en dernière colonne.

- [ ] **Step 1 : écrire la migration** (une fonction par bloc, commentaire d'une ligne qui dit ce qui change).
- [ ] **Step 2 : répétition, migrations 1 et 2 seulement** : VERT sur la non-régression, la compatibilité,
  `mes_promos`, les invitations, les promos et les fonctions serveur ; les lignes de règles restent rouges.
- [ ] **Step 3 : commit** « Lot 4, étape 2 : fonctions par rôle et par portée, invitation par la base ».

### Task 5 : étape 3, règles

**Files :** Create `supabase/migrations/20261028_roles_3_regles.sql`.

**Interfaces :** Consumes : Tasks 2 et 4. Produces : les règles de la matrice, nommées `<table>_lecture`,
`<table>_ajout`, `<table>_modification`, `<table>_suppression` (ou `<table>_ecriture` pour une règle `for all`).

- [ ] **Step 1 : écrire la migration** : par table, suppression des anciennes règles par leur nom exact, création
  des nouvelles ; `revoke insert, update on user_profiles from anon, authenticated` ; règles du stockage.
- [ ] **Step 2 : répétition complète** (mode `repetition`) : VERT n/0, empreinte « après » notée dans le registre.
- [ ] **Step 3 : sabotage** : retirer, dans le bloc seulement, la condition de promo d'une règle de lecture : la
  preuve rougit sur cette table. Noter le résultat.
- [ ] **Step 4 : commit** « Lot 4, étape 3 : règles de la matrice des droits, interrupteurs au fondateur ».

### Task 6 : aller-retour et rejeu complet sur la vraie base (orchestrateur)

- [ ] **Step 1 :** mode `repetition` complet (migrations, contrôles, retours) : VERT n/0, empreintes après retour =
  avant (Task 1), durée du bloc notée (verrous).
- [ ] **Step 2 :** mode `contre-epreuve` rejoué : même liste rouge qu'à la Task 3.
- [ ] **Step 3 :** consigner les verdicts dans le registre, sans aucun email.

### Task 7 : app, droits affichés, aperçu à quatre rôles, invitations

**Files :** Create `js/roles-rules.js`, `tests/roles-rules.test.mjs` ; Modify `js/auth-admin.js`, `js/db.js`,
`js/views/config.js`, `css/style.css` (`.view-as-seg`), `js/nouveautes-data.js`.

**Interfaces :** Produces dans `js/roles-rules.js` : `APERCUS = ["formateur", "direction", "siege", "stagiaire"]` ;
`LIBELLES_APERCU` (Formateur, Direction, Siège, Stagiaire) ; `ENTETE_APERCU = "x-apercu-role"` ;
`normaliserApercu(v) -> string|null` ; `droitsAffiches({ profil, promo, apercu }) -> { admin, prof, stagiaire,
espace }` ; `peutInviterFormateur({ profil, promo, apercu }) -> boolean` ; `peutRetirerCompte({ cible, fondateur })
-> boolean`. Dans `js/db.js` : `poserApercu(role|null)`.

- [ ] **Step 1 : tests** `tests/roles-rules.test.mjs` :
  - formateur réel (`role 'prof'`, `is_admin`, `promo.roles ['formateur']`) : `{ admin: true, prof: true,
    stagiaire: false, espace: "equipe" }` ;
  - fondateur (`role 'stagiaire'`, `is_admin`, `is_founder`, `roles ['stagiaire']`) : `{ true, false, true,
    "equipe" }`, comme aujourd'hui ;
  - stagiaire : `{ false, false, true, "stagiaire" }` ; direction (`roles ['direction']`, `is_admin false`) :
    `{ false, true, false, "equipe" }` ;
  - `promo` nulle ou sans `roles` (base pas encore migrée, état dégradé) : repli sur `is_admin` et `role` ;
  - aperçus : `formateur` `{ true, true, false, "equipe" }` ; `direction` et `siege` `{ false, true, false,
    "equipe" }` ; `stagiaire` `{ false, false, true, "stagiaire" }` ;
  - `normaliserApercu("prof") === "formateur"`, `("admin") === null`, `("siege") === "siege"` ;
  - `peutInviterFormateur` : fondateur hors aperçu vrai ; formateur faux ; direction vrai ; fondateur en aperçu
    `formateur` faux ; `peutRetirerCompte` : jamais le fondateur ; un compte du personnel seulement par le
    fondateur ; un stagiaire, oui.
- [ ] **Step 2 : les voir échouer** : `node --test tests/roles-rules.test.mjs` (module absent).
- [ ] **Step 3 : écrire `js/roles-rules.js`.**
- [ ] **Step 4 : brancher** : `isAdmin`, `isProf`, `isStagiaire` lisent `droitsAffiches` (profil, promo courante,
  aperçu) ; l'aperçu accepte les quatre rôles (ancienne valeur « prof » lue comme `formateur`) ; bandeau
  « Aperçu : <libellé> » ; sélecteur à cinq boutons (Fondateur, Formateur, Direction, Siège, Stagiaire) qui
  passent à la ligne, 44 px sur téléphone ; `monStagiaireId()` nul en aperçu autre que stagiaire ; à chaque
  changement d'aperçu, `poserApercu` et `invalidateCache()` ; en-tête retiré à « Revenir fondateur », à la
  déconnexion et au refus de session ; `fetchWithTimeout` pose `x-apercu-role` à côté de `x-promo-id` ;
  `inviteUser` appelle la fonction `inviter_compte` (« prof » envoyé comme `formateur`) ; `deleteUserProfile` relit
  la ligne supprimée et lève « Ce compte ne peut pas être retiré d'ici » si rien n'est parti.
- [ ] **Step 5 : Réglages** : l'option « Formateur » de l'invitation n'apparaît que si `peutInviterFormateur` ; la
  case « Aussi administrateur » disparaît ; le bouton de retrait suit `peutRetirerCompte`.
- [ ] **Step 6 : Nouveautés** (pour « formateurs », date du jour de mise en ligne, posée à la fusion) : chacun ne
  voit que les promos où il intervient, la base le vérifie elle-même ; rien ne change pour toi ; un nouveau
  formateur s'ajoute désormais par la direction du centre (en attendant, par Timy) ; tu invites toujours les
  stagiaires de tes promos.
- [ ] **Step 7 : `node --test "tests/*.test.mjs"`** : tout vert (1 067 + les nouveaux).
- [ ] **Step 8 : commit** « Lot 4 : droits affichés selon la base, aperçu à quatre rôles, invitation par la base ».

### Task 8 : banc d'essai et navigation

**Files :** Modify `_harness_supabase.js` (copie du worktree, reportée dans `TP_ECSR_App` à la fin).

- [ ] **Step 1 :** le faux client rend `roles` dans `mes_promos` (`?role=prof` : `formateur` ; stagiaire et
  fondateur : `stagiaire`) et accepte `inviter_compte` (écriture notée, pas faite).
- [ ] **Step 2 :** au banc (`?cb=<unique>`, jeton vérifié), pour chaque aperçu : bandeau, espace (équipe ou
  stagiaire), sélecteur sur téléphone (cinq boutons visibles, 44 px, rien qui défile de côté) ; Réglages d'un
  formateur sans l'option « Formateur ». Captures.
- [ ] **Step 3 :** `python outils/verifier_navigation.py` (Chromium et WebKit) : 0 échec, parité « interrupteur
  éteint = main » intacte.

### Task 9 : relecture finale de toute la branche

- [ ] **Step 1 :** relire `supabase/migrations/` de `main` (tables ajoutées par les conversations parallèles) :
  chaque nouvelle table entre dans la matrice, la preuve et le retour ; répétition rejouée.
- [ ] **Step 2 :** relecture par le modèle le plus capable (base, app, preuve, plan), corrections, rejeu.

### Task 10 : compte rendu, puis application avec l'accord de Timy

- [ ] **Step 1 :** compte rendu à Timy (bilan, tableau d'état, schéma, étapes suivantes) ; attendre son accord.
- [ ] **Step 2 (après accord) :** appliquer les étapes 1, 2, 3 (MCP, une à une), empreinte en ligne = celle de la
  répétition, preuve en mode `en-ligne` : VERT.
- [ ] **Step 3 :** fusion dans `main` (`merge --no-ff --no-commit` puis `commit -F`), aucun écart hors jeton `?v=`,
  Timy pousse ; ordre : base d'abord, app ensuite.
- [ ] **Step 4 (si Timy l'accepte) :** retirer l'ancienne fonction Edge `invite-user` (déploiement d'une version
  qui répond « mets l'app à jour »), avant d'affecter un formateur à une seule promo.

## Laissé aux lots suivants

- Lot 5 : pages de la direction (Promos, Équipe) et du siège (vue d'ensemble agrégée, directions) ; un compte du
  seul siège n'a aucune promo et la porte de l'app le refuse aujourd'hui (« Aucune promo… ») : à ouvrir au lot 5.
- « Voir cette promo comme un stagiaire » pour les formateurs (spec, § 4.2) : la base sait déjà le servir si on
  l'ouvre plus tard à tous (un aperçu ne fait que retirer des droits).
- Ménage du multi-promo (étape 5) : il libérera `qcm` et `themes` pour le siège.
