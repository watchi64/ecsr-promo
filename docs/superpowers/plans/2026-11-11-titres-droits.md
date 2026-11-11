# Titres et droits à la carte (plan de mise en œuvre)

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`).

**But :** donner à chaque membre du personnel un titre (nom + cases par page : Non, Voir, Modifier) que la base vérifie à
chaque demande, sans qu'aucun compte existant ne gagne ni ne perde un droit.

**Architecture :** l'étape 1 (en ligne depuis le 11/11, migrations 1 à 3 ; la 4 attend les conditions) pose la base invisible : la table `titres` et ses trois titres fixes,
`affectations.titre_id` rempli d'office, un vocabulaire de « gestes » (`geste_promo`, `geste_centre`, `geste_reseau`) qui
lit les cases du titre, la réécriture de chaque règle RLS et de chaque fonction `security definer` qui décide d'un droit
avec le vocabulaire du lot 4, et le journal des droits écrit par déclencheurs. Avec les seuls titres fixes, chaque geste
vaut exactement le prédicat qu'il remplace : la preuve du lot 4 et celles du lot 5 restent vertes à l'identique. L'étape 2
(fonctions de gestion, section 4) est détaillée en deux mises en ligne, 2a (sécurité) puis 2b (gestion) ; les étapes 3
(écrans) et 4 (catalogue, conditions d'utilisation) sont esquissées en fin de plan.

**Technique :** PostgreSQL 17 (Supabase), règles RLS, fonctions `security definer` (`search_path` public puis pg_temp),
preuves SQL rejouables assemblées par `outils/assembler_repetition_roles.mjs`, base locale jetable
(`outils/base_locale/reconstruire.sh`), `node --test "tests/*.test.mjs"`. Aucun fichier `js/` touché à l'étape 1.

**Spec :** `docs/superpowers/specs/2026-11-09-titres-droits-design.md` (validée par Timy le 09/11). Références : plan du
lot 4 `docs/superpowers/plans/2026-10-28-refonte-navigation-lot-4-roles.md` (modèle, matrice), plan du lot 5
`docs/superpowers/plans/2026-11-08-refonte-navigation-lot-5-direction-siege.md`.

## 0. Ce que la spec suppose, relu sur main (5f9291fa, 11/11)

| Supposition (spec § 3) | État réel sur main | Conséquence pour le plan |
|---|---|---|
| Vocabulaire du lot 4 : `est_formateur(p)`, `est_direction(l)`, `est_siege()`, `formateur_courant()`, `direction_courante()`, `equipe_courante()`, `redacteur_contenus()`, `lieu_de_promo(p)`, `roles_reels(p)` | tous dans `20261028_roles_1_fondations.sql`, inchangés depuis ; sens : « une affectation de ce rôle sur cette portée, ou le fondateur ; en aperçu, le seul rôle simulé sur la promo affichée » | ils gardent ce sens (« a un titre de ce niveau ») ; plus aucune règle ni fonction ne s'en sert pour un droit après l'étape 1 (tâches 4 et 5) |
| `inviter_compte` (lot 4) | redéfinie deux fois par fragments : `20261108_espaces_2_equipe.sql` (appel `_profil_formateur`, refus d'une adresse de compte stagiaire) puis `20261111_espaces_4_donnees.sql` (`_orphelin_en_personnel`, clé `transforme`) | la tâche 4 la retouche par fragments à son tour (méthode des deux migrations : `pg_get_functiondef`, chaque fragment trouvé exactement une fois, retours chariot suivis) |
| « `inviter_compte` refuse l'adresse d'un compte stagiaire pour un formateur seulement » | **faux depuis le 08/11** : refus dans les trois branches (formateur, direction, siège) et dans `regler_affectations_formateur` ; depuis le 11/11, l'ancien stagiaire sans fiche (« orphelin ») est transformé en compte du personnel | la faille citée au § 7 est déjà fermée pour les trois titres fixes ; l'étape 2 réutilise le même prédicat et `_orphelin_en_personnel`, rien à faire à l'étape 1 |
| « Personnes avec accès » montre le vrai rôle « pas encore fait » | **fait** (lot G) : `roles_du_personnel()` (`20261108_espaces_2_equipe.sql`), lu par `js/db.js` (l. 1772) et `js/roles-rules.js` (l. 126) | inchangée à l'étape 1 (étiquette, pas un droit) ; l'étape 3 la remplace par le titre |
| Une direction voit les notes d'un stagiaire qui les masque | vrai : `notes_stagiaires_visibles()` et `evaluations_lecture` passent par `equipe_courante()` | conservé : le geste `notes.lire` ouvre la même lecture |
| Partie E (habillage du centre et du réseau) « pas encore construite » | **construite** : `20261108_espaces_3_habillage.sql` (`regler_habillage_centre`, `regler_habillage_reseau`), `js/views/reglages-habillage.js`, entrées « Réglages du centre » et « Réglages du réseau » de `js/nav-rules.js` | les pages Réglages du centre et du réseau existent : leurs cases sont réelles dès l'étape 1, la règle « page ajoutée plus tard » ne s'applique pas à elles |
| (non cité) Données personnelles de la direction (suite du 11/11) | `etat_anonymisation_promo(p)`, `anonymiser_promo(p)`, `benevoles_a_purger(l)`, `purger_benevoles(ids, l)` : la direction anonymise une promo de son centre et **purge les élèves bénévoles** depuis Réglages du centre (`js/views/reglages-donnees.js`) | deux gestes définitifs nouveaux : la purge des bénévoles par la direction n'est pas au § 5.5 ; gardés au seul titre fixe Direction de centre (décision T1, § 9) |
| `js/nav-rules.js` : `ENTREES_EQUIPE`, `ENTREES_DIRECTION`, `ENTREES_SIEGE`, barres du téléphone | vrais, mêmes pages que le § 5 ; Émargement de la direction attend `emargementDansLeCentre`, Réglages de la direction et du siège `reglagesEspace` | aucune entrée nouvelle ; l'étape 3 ajoute un filtre par cases à `entreesNavigation` |
| Écritures directes sur `affectations` (`retirerAffectation`, page Directions de centre) | `js/db.js` l. 322 : `delete` direct ; règles `affectations_ajout` et `affectations_retrait` (lot 4) | **gardées à l'étape 1** (le droit de colonne n'ouvre pas `titre_id` : un ajout direct ne peut porter qu'un titre fixe) ; fermées à l'étape 2 avec leur remplacement par fonction, seul changement d'app de ce chantier qui touche un appel existant |
| `_questionnaire_ayant_droit` « revu en ce sens » (§ 14) | passe par `roles_reels(p)`, donc par toute affectation `formateur` | déjà « toute personne qui a un titre de promo » : aucune réécriture |
| « Les quatre titres fixes » | Stagiaire est un libellé sans ligne (§ 6.1) | trois lignes fixes en base : Formateur (promo), Direction de centre (centre), Siège (réseau) |

## Global Constraints

- Aucun tiret cadratin (U+2014) nulle part (SQL, commentaires, commits, textes) ; contrôle en Python (`chr(0x2014)`).
- « Formateur », jamais « prof » dans un texte ; textes d'équipe au vouvoiement (décision de Timy du 10/11) ; textes des
  stagiaires au tutoiement ; jamais `confirm()` ni `prompt()` (`js/confirmer.js`).
- Fichiers SQL en LF ; `PGCLIENTENCODING=UTF8` pour tout `psql` ; trier avec `collate "C"` dans une preuve.
- `pg_read_file` est interdit sur Supabase : une preuve qui lit ses migrations se joue en production avec le texte des
  fichiers injecté (assembleur) ; `pg_get_functiondef` peut contenir des retours chariot sur la base locale, pas en
  production : chaque remplacement de fragment les suit (code de `20261111_espaces_4_donnees.sql`, l. 157 à 161).
- `session_replication_role` se pose par `SET LOCAL`, jamais par `set_config` (supautils).
- Migrations `supabase/migrations/20261112_titres_<n>_<nom>.sql`, chacune avec son `_retour.sql`,
  `set local lock_timeout = '3s'` en tête ; jamais appliquées sans l'accord explicite de Timy ; jamais
  `outils/psql_prod.sh` par un agent (Timy le lance, ou donne son accord explicite à la session principale).
- Une règle se réécrit par `alter policy` (nom, commande et rôles inchangés), jamais `drop` + `create`.
- Une fonction existante se réécrit par fragments (texte d'origine trouvé exactement une fois, sinon la migration s'arrête
  sans rien changer) : mêmes paramètres, même retour, mêmes phrases de refus, mêmes droits d'exécution.
- Un droit manquant lève l'état `42501` avec une phrase que l'app affiche telle quelle.
- Aucun nom ni e-mail réel dans le dépôt : personnages `@exemple.invalid`, comptes réels choisis par requête.
- Étape 1 invisible : aucun fichier `js/`, aucune entrée Nouveautés, `node --test "tests/*.test.mjs"` vert.

## Review Focus

1. **L'aperçu du fondateur** (stagiaire, formateur, direction, siège) : chaque geste vaut l'ancien prédicat dans chaque
   contexte d'aperçu ; un compte qui envoie un en-tête d'aperçu qui n'est pas pour lui ne gagne rien (tâche 3, groupe
   « équivalence », contextes d'aperçu compris).
2. **Le cumul** : une personne qui a une fiche dans une promo et un titre ailleurs (`cumul`), une direction qui forme
   (`dir_form`) : la lecture « membre stagiaire de la promo » et la lecture par case ne se masquent pas l'une l'autre
   (tâche 3, équivalence ; tâche 5, lectures de promo).
3. **Les plafonds du centre** : la direction (titre fixe) n'ouvre pas une feuille, ne signe pas comme formateur, ne saisit
   aucune note, ne supprime aucune fiche (centre : Émargement et Notes plafonnés à Voir) (tâche 3, groupe « gestes »).
4. **Sans promo affichée** (siège, direction d'un centre vide, en-tête d'une promo inaccessible) : chaque geste rend faux,
   jamais nul ni une erreur (tâche 3, cas `P` nul).
5. **Un titre non fixe posé en base avant l'étape 4** (par la preuve, en propriétaire) : il n'ouvre jamais un geste
   définitif ni un droit sans page, et « Non » lui ferme la lecture des données de la page (tâche 5, groupe « cases »).

---

## 1. Table des gestes (relevé du 11/11)

Notation : `cp(page)` = case du titre de promo de l'appelant sur la promo p (0 Non, 1 Voir, 2 Modifier) ; `cc(page)` = case
de son titre de centre sur `l = lieu_de_promo(p)` ; `cr(page)` = case de son titre du réseau ; `ff` = titre fixe Formateur
sur p, `df` = titre fixe Direction de centre sur l, `sf` = titre fixe Siège ; `M` = clause « la ligne de la personne »
inchangée ; `membre` = `membre_stagiaire(p)`. Fondateur hors aperçu : tout vrai. Référence de « aujourd'hui » : la
matrice de `tests/sql/roles-preuve.sql` (F, D, E, R, S, Fo).

### 1.1 Gestes sur une promo : `geste_promo(p, code)`

| Code | Vrai si | Aujourd'hui | Page, niveau | Règles (alter policy) | Fonctions |
|---|---|---|---|---|---|
| `planning.lire` | `cp(planning)>=1 or df` | P | Planning (promo) ; direction : droit sans page | `agenda_select_authenticated`, `planning_entries_select_all`, `planning_half_meta_select_all`, `planning_jours_off_select_all` (avec `or membre`) | |
| `planning.modifier` | `cp(planning)=2` | F | Planning (promo) | `agenda_events_ecriture`, `planning_entries_ecriture`, `planning_half_meta_ecriture`, `planning_jours_off_ecriture`, `passages_ajout`, `passages_modification`, `passages_suppression` | |
| `emargement.lire` | `cp(emargement)>=1 or cc(emargement)>=1` | P / E | Émargement (promo, centre) | `emargement_seances_select` (avec `or membre`), `emargement_lignes_lecture`, `emargement_formateurs_lecture` | |
| `emargement.tenir` | `cp(emargement)=2` | F | Émargement (promo) | | `emargement_feuille`, `emargement_ouvrir`, `emargement_signer` (et par `emargement_feuille(p, true)` : `_signer_formateur`, `_annoter`, `_clore`, `_rouvrir`) |
| `stagiaires.lire` | `cp(stagiaires)>=1 or cc(stagiaires)>=1` | P / E | Stagiaires (promo, centre) | `stagiaires_select_all`, `passages_select_all`, `passages_audit_select` (avec `or membre`), `stagiaires_prive_lecture`, `user_profiles_lecture` (clause des stagiaires de P), `conditions_acceptations_lecture`, `effacements_journal_lecture` | |
| `stagiaires.gerer` | `cp(stagiaires)=2 or cc(stagiaires)=2` | E | Stagiaires (promo, centre) | `stagiaires_ajout`, `stagiaires_modification`, `user_profiles_suppression` | `set_date_naissance`, `inviter_compte` (branche stagiaire, sur la promo de la fiche), `a_une_affectation` (garde) |
| `stagiaires.supprimer` | `ff` | F | définitif (§ 5.5) | `stagiaires_suppression` | |
| `anonymiser` | `ff or df` | E | définitif (§ 5.5) | | `anonymiser_stagiaire`, `anonymiser_promo()`, `etat_anonymisation_promo()`, `anonymiser_promo(p)`, `etat_anonymisation_promo(p)` |
| `benevoles.lire` | `cp(stagiaires)>=1 or df` | E | Stagiaires (promo) ; direction : droit sans page | `auto_ecoles_lecture`, `benevoles_lecture`, `benevole_suivi_lecture` | `venues_benevoles` |
| `benevoles.gerer` | `cp(stagiaires)=2` | F | Stagiaires (promo) | `auto_ecoles_ajout`, `_modification`, `_suppression`, `benevoles_ajout`, `_modification`, `benevole_suivi_ajout`, `_modification`, `_suppression` | |
| `benevoles.purger` | `ff` | F | définitif (§ 5.5 ; décision T1) | `benevoles_suppression` | `benevoles_a_purger()`, `purger_benevoles(ids)` |
| `notes.lire` | `cp(notes)>=1 or cc(notes)>=1` | E (P pour examens et progression) | Notes et examens (promo, centre) | `evaluations_lecture`, `evaluations_audit_lecture`, `epcf_evaluations_lecture`, `epcf_livrets_lecture`, `dp_dossiers_lecture`, `fiches_suivi_lecture`, `qcm_attempts_lecture`, `qcm_examens_select` et `themes_progression_select` (avec `or membre`) | `notes_stagiaires_visibles`, `epcf_moyennes`, `notes_stats_groupe` (garde nouvelle : `membre or notes.lire`, sinon nul ; décision T4) |
| `notes.saisir` | `cp(notes)=2` | F | Notes et examens (promo) | `evaluations_ecriture`, `epcf_evaluations_ajout/_modification/_suppression`, `epcf_livrets_*` (3), `dp_dossiers_ajout/_modification/_suppression`, `fiches_suivi_*` (3), `qcm_attempts_ajout/_modification/_suppression`, `qcm_examens_ajout/_modification/_suppression`, `themes_progression_ajout/_modification/_suppression` | |
| `contenus.lire_internes` | `cp(cours)>=1 or df or cr(cours)>=1` | F, D ou S | Cours et QCM (promo, réseau) ; direction : droit sans page (§ 5.6) | `cours_lecture`, `cours_versions_lecture` | |
| `contenus.rediger` | `cp(cours)=2 or cr(cours)=2` | R (F ou S) | Cours et QCM (promo, réseau) | `cours_modification`, `cours_versions_ajout`, `qcm_questions_ecriture`, `qcm_options_ecriture`, `cours_images_ecriture`, `qcm_images_admin_insert/_update/_delete` | |
| `referentiel.modifier` | `cp(cours)=2` | F | Cours et QCM (promo) | `qcm_ecriture`, `themes_ecriture`, `competences_ecriture`, `ressources_ecriture` | |
| `contenus.traiter` | `cp(cours)=2` | F | Cours et QCM (promo), « Modifier » (décision T5) | `qcm_signalements_lecture/_modification/_suppression` (partie F), `qcm_signalement_instruction_lecture`, `qcm_ia_brouillons_lecture` | `accepter_brouillon_ia`, `rejeter_brouillon_ia`, `is_admin()` et `is_prof()` (décision T6) |
| `reglages.modifier` | `cp(reglages)=2` | F | Réglages de la promo | `settings_ecriture` (clés autres que `modules`, `navigation_v2`, `emargement_actif`) | |
| `modules.modifier` | `cp(reglages)=2 or cc(promos)=2` | E | Réglages de la promo, Promos (centre) | `settings_ecriture` (clé `modules`) | |
| `promo.renommer` | `cp(reglages)=2 or cc(promos)=2`, p = la ligne | `est_formateur(id) or est_direction(lieu_id)` | Réglages de la promo, Promos (centre) | `promos_modification` | |
| `fiches_internes.ecrire` | `ff or df` | E | droit sans page (§ 5.6) | `contacts_ecriture`, `profs_ecriture` | |

### 1.2 Gestes sur un centre et sur le réseau

| Code | Vrai si | Aujourd'hui | Page | Règles | Fonctions |
|---|---|---|---|---|---|
| `geste_centre(l, 'promos.gerer')` | `cc(promos)=2` | `est_direction(l)` | Promos | | `creer_promo`, `modifier_dates_promo` |
| `geste_centre(l, 'reglages.modifier')` | `cc(reglages)=2` | `est_direction(l)` | Réglages du centre | | `regler_habillage_centre` |
| `geste_centre(l, 'donnees.purger')` | `df` | `est_direction(l)` | définitif (décision T1) | | `benevoles_a_purger(l)`, `purger_benevoles(ids, l)` |
| `geste_centre(l, 'formateurs.nommer')` | `df` (reste `df` : à l'étape 2, le don d'un titre de promo non fixe passe par `_refus_titre`, Équipe sur Modifier) | `est_direction(l)` | Équipe | `affectations_ajout`, `affectations_retrait` (ligne formateur) | `regler_affectations_formateur`, `inviter_compte` (branche formateur) |
| `geste_centre(l, 'equipe.lire')` | `cc(equipe)>=1` | aucun | Équipe | | (étape 2 : lecture du journal du centre) |
| `geste_reseau('centres.creer')` | `cr(directions)=2` | `est_siege()` | Directions de centre | | `creer_centre` |
| `geste_reseau('directions.nommer')` | `sf` | `est_siege()` | Directions de centre | `affectations_ajout`, `affectations_retrait` (ligne direction) | `inviter_compte` (branche direction) |
| `geste_reseau('directions.lire')` | `cr(directions)>=1` | aucun | Directions de centre | | (étape 2 : lecture du journal du réseau) |
| `geste_reseau('reglages.modifier')` | `cr(reglages)=2` | `est_siege()` | Réglages du réseau | | `regler_habillage_reseau` |

### 1.3 Ce qui ne change pas (relevé, avec la raison)

- Navigation et étiquettes : `peut_acceder_promo`, `promo_courante`, `promo_par_defaut`, `mes_promos` (colonne `roles`),
  `roles_reels`, `roles_du_personnel`, `habillage_par_defaut`, règles `promos_select`, `lieux_lecture`,
  `settings_select_all`, `affectations_lecture`, clauses « son profil » et « le personnel » de `user_profiles_lecture`.
- Fondateur seul : `peut_gerer_qualite`, `registre_qualite_*`, `effacer_registre_qualite`, `questionnaire_ouvertures_select`,
  `ouvrir_questionnaire`, `resultats_questionnaire`, `commentaires_questionnaire`, `signalements_app_*`,
  `traiter_signalement_app`, `compter_signalements_app`, clé `navigation_v2` et `emargement_actif`, suppression d'un profil
  du personnel, `affectations` de rôle siège.
- Agrégats sans nom : `comptes_reseau()` reste à `est_siege()` (l'accueil du siège n'a pas de case, § 5).
- Tous les connectés : lectures `qcm_*_select_connectes`, `themes`, `competences`, `ressources`, `contacts`, `profs`,
  stockage public, `qcm_signalements_insert`, compteurs de l'assistant et de l'IA.
- `_questionnaire_ayant_droit` (voir § 0), `_anonymiser_stagiaire` (garde-fou interne : un compte affecté n'est jamais
  anonymisé).

Totaux : 93 règles réécrites par `alter policy` (81 du lot 4, 10 lectures « P » restées d'avant le lot 4, `affectations_ajout`
et `affectations_retrait`), 29 fonctions réécrites par fragments, 0 règle supprimée.

### 1.4 Gestes définitifs et droits sans page que la spec ne cite pas

- **Définitifs nouveaux** : la purge des élèves bénévoles par la direction (`purger_benevoles(ids, l)`, 11/11) ; la
  suppression directe d'un bénévole (`benevoles_suppression`), qui efface la personne et son suivi comme la purge.
  Proposition : les deux restent aux titres fixes qui les ont (décision T1).
- **À trancher** : la suppression du profil d'un compte stagiaire (`user_profiles_suppression`, par l'équipe) retire un
  accès sans effacer de donnée ; classée « Stagiaires : Modifier » (décision T3).
- **Droits sans page de la Direction de centre en plus du § 5.6** : lecture du planning (`agenda_events`, `planning_*`) et
  des élèves bénévoles, auto-écoles et suivis (`venues_benevoles` compris). Gardés au seul titre fixe (décision T2).
- **Lecture de `notes_stats_groupe`** : aujourd'hui sans garde (tout membre de la promo) ; la spec (§ 5.4) suppose que la
  base ne rend pas ces chiffres sans « Notes et examens ». Garde ajoutée, invisible pour les comptes actuels (décision T4).

---

## 2. Fichiers de l'étape 1

| Fichier | Rôle |
|---|---|
| `outils/base_locale/rejouer_suite.sh` (créé), `outils/base_locale/LISEZMOI.md` (modifié) | applique sur la base locale, dans l'ordre de la production, les migrations postérieures au lot 4 |
| `supabase/migrations/20261112_titres_1_tables.sql` et `_retour.sql` | table `titres`, trois titres fixes, `affectations.titre_id`, déclencheur de défaut et de cohérence |
| `supabase/migrations/20261112_titres_2_gestes.sql` et `_retour.sql` | vocabulaire des cases et des gestes ; 29 fonctions réécrites par fragments |
| `supabase/migrations/20261112_titres_3_regles.sql` et `_retour.sql` | 93 règles réécrites par `alter policy` |
| `supabase/migrations/20261112_titres_4_journal.sql` et `_retour.sql` | table `journal_droits`, déclencheurs, purge, effacement d'une adresse |
| `tests/sql/titres-preuve.sql` (créé) | gabarit de la preuve de l'étape 1 (groupes titres, équivalence, gestes, fonctions, cases, journal, retour) |
| `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs` (modifiés) | modes `titres`, `titres-contre-epreuve`, `titres-en-ligne` |
| `tests/sql/roles-preuve.sql` (modifié) | deux lignes de matrice pour les tables nouvelles, ajoutées seulement si elles existent (précédent de `registre_qualite`) |

Ordre d'application : 1, 2, 3, 4 ; retours 4, 3, 2, 1. Entre 2 et 3, les anciennes règles et les gestes disent la même
chose (seuls des titres fixes existent) : aucune fenêtre de droit.

---

## 3. Étape 1 : la base invisible

### Task 1 : Base locale au niveau de la production et verdicts de départ

**Files:**
- Create: `outils/base_locale/rejouer_suite.sh`
- Modify: `outils/base_locale/LISEZMOI.md` (section « Rejouer la suite »)

**Interfaces:**
- Produces: `bash outils/base_locale/rejouer_suite.sh [--port 55435] [--avec-titres]` : applique avec `psql -1 -v
  ON_ERROR_STOP=1`, dans cet ordre, `20261108_espaces_1_siege`, `20261108_espaces_2_equipe`, `20261108_espaces_3_habillage`,
  `20261108_questionnaires`, `20261109_epcf_moyennes_anonymat`, `20261109_habillage`, `20261109_registre_qualite`,
  `20261110_epcf_moyennes_seuil_3`, `20261110_profils_email_stagiaires`, `20261111_espaces_4_donnees` ; avec
  `--avec-titres`, puis `20261112_titres_1` à `_4`. Code de sortie 0 si tout passe, sinon le nom du fichier en échec.
  (`20261028_signalements_app` n'y est pas : ses tables sont dans `clone_3_tables.sql`.)

- [ ] **Step 1 : écrire le script** (même forme que `reconstruire.sh` : `set -u`, `PGCLIENTENCODING=UTF8`, `PGOPTIONS="-c
  check_function_bodies=off"`, une boucle, message clair à l'échec).
- [ ] **Step 2 : reconstruire puis rejouer.** Run : `bash outils/base_locale/reconstruire.sh && bash
  outils/base_locale/rejouer_suite.sh`. Expected : `OK : base locale prête` puis `OK : suite rejouée (10 migrations)`.
- [ ] **Step 3 : verdicts de départ.** Jouer, sur cette base, chaque preuve dans son mode « en ligne » et ranger chaque
  message de levée dans `.base-locale/verdicts/avant/<preuve>.txt` (dossier ignoré par git) :
  `node outils/assembler_repetition_roles.mjs en-ligne`, `espaces-en-ligne`, `donnees-en-ligne` ;
  `node outils/assembler_preuve_epcf.mjs en-ligne` ; `node outils/assembler_preuve_profils.mjs en-ligne` ;
  `tests/sql/questionnaires-preuve.sql` et `tests/sql/registre-qualite-preuve.sql` (tables présentes : la preuve ne
  rejoue pas la migration ; variables `-v migration=... -v retour=...` passées quand même, comme leur en-tête le dit) ;
  `tests/sql/habillage-preuve.sql`. Expected : chaque verdict commence par `VERT`. Une preuve qui ne se joue pas sur la
  base complète (schéma minimal requis) est notée avec la raison exacte dans le rapport de la tâche, et jouée sur son
  schéma minimal : elle ne compte alors pas comme preuve de non-régression des titres (dire lesquelles à Timy).
- [ ] **Step 4 : commit** `Titres, étape 1 : base locale rejouée jusqu'au 11/11 (rejouer_suite.sh)`.

### Task 2 : Les titres et leur remplissage (migration 1)

**Files:**
- Create: `supabase/migrations/20261112_titres_1_tables.sql`, `20261112_titres_1_tables_retour.sql`, `tests/sql/titres-preuve.sql`
- Modify: `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs`

**Interfaces:**
- Produces :
  - table `public.titres(id bigint identité, nom text not null, niveau text not null check in ('promo','centre','reseau'),
    lieu_id integer references lieux on delete cascade, fixe boolean not null default false, origine_id bigint references
    titres on delete set null, cases jsonb not null default '{}', cree_le timestamptz default now(), cree_par text,
    modifie_le timestamptz, modifie_par text)` ; contraintes : `not fixe or lieu_id is null`, `niveau <> 'reseau' or lieu_id
    is null`, `origine_id is null or lieu_id is not null`, `_cases_valides(niveau, cases)` ; index uniques `(lieu_id,
    lower(nom)) nulls not distinct` et `(niveau) where fixe`. RLS active, **aucune règle, aucun droit** pour anon et
    authenticated (lecture par fonctions à l'étape 2).
  - `public._pages_du_niveau(p_niveau text) returns table(page text, plafond integer)` immutable, la seule table des
    plafonds : promo `planning 2, emargement 2, stagiaires 2, notes 2, cours 2, ccp2 1, indicateurs 1, reglages 2` ; centre
    `promos 2, stagiaires 2, emargement 1, notes 1, equipe 2, reglages 2` ; reseau `cours 2, directions 2, reglages 2`.
  - `public._cases_valides(p_niveau text, p_cases jsonb) returns boolean` immutable : objet ; clés parmi les pages du niveau
    ; valeurs `non`, `voir`, `modifier` ; `voir` interdit pour `reglages`, `modifier` interdit quand le plafond est 1 ;
    § 5.4 : au niveau promo, `planning`, `emargement`, `notes` ou `indicateurs` au moins `voir` exige `stagiaires` au moins
    `voir` ; au niveau centre, de même pour `emargement` et `notes`.
  - `public.titre_fixe(p_niveau text) returns bigint` stable : l'identifiant du titre fixe du niveau.
  - trois lignes : `('Formateur','promo')`, `('Direction de centre','centre')`, `('Siège','reseau')`, `fixe` vrai,
    `cases '{}'`, `cree_par 'migration 20261112_titres_1'`.
  - `affectations.titre_id bigint not null references titres(id) on delete restrict` ; déclencheur `affectations_titre`
    (before insert or update of `titre_id, role, promo_id, lieu_id`) qui appelle `public._affectations_titre()` :
    `titre_id` nul devient `titre_fixe` du niveau du rôle (`formateur` promo, `direction` centre, `siege` reseau) ; refus
    (`23514`, phrase `titres: ...`) si le niveau du titre n'est pas celui du rôle, si un titre de centre appartient à un
    autre centre que celui de la ligne (lieu de la promo pour un formateur), ou si la même adresse a déjà, dans le même
    centre, une ligne `formateur` d'un autre titre (§ 6.3, « un titre par niveau et par centre »).
  - Le droit de colonne `insert (email, role, promo_id, lieu_id)` ne change pas : un client ne choisit jamais `titre_id`.
- Consumes : rien des autres tâches.

- [ ] **Step 1 : gabarit de la preuve.** `tests/sql/titres-preuve.sql` sur le modèle de `tests/sql/espaces-donnees-preuve.sql`
  (aides `-- @@INCLURE tests/sql/roles-aides.sql@@`, empreinte, migrations et retours en `-- @@INJECTER ...@@`, bloc `do`
  qui finit toujours par une levée, verdict `VERT n/0` ou `ROUGE ...`). Groupe `titres` :
  ```sql
  perform pg_temp.attendre('titres', 'trois titres fixes, un par niveau',
    (select string_agg(niveau || ':' || nom, ',' order by niveau collate "C") from public.titres where fixe),
    'centre:Direction de centre,promo:Formateur,reseau:Siège');
  perform pg_temp.attendre('titres', 'chaque affectation porte le titre fixe de son niveau',
    (select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id
      where not t.fixe or t.niveau <> case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end), '0');
  ```
  plus : un ajout en propriétaire sans `titre_id` reçoit le titre fixe ; titre de niveau centre sur une ligne formateur :
  `ERREUR 23514` ; titre de centre d'un autre centre : `ERREUR 23514` ; deux titres de promo différents dans un même centre
  pour une adresse : `ERREUR 23514` ; `_cases_valides('promo', '{"notes":"voir"}')` faux (§ 5.4),
  `'{"notes":"voir","stagiaires":"voir"}'` vrai, `'{"ccp2":"modifier"}'` faux, `'{"reglages":"voir"}'` faux,
  `'{"inconnue":"voir"}'` faux ; deux titres du réseau « Qualité » et « qualité » : `ERREUR 23505` ; un titre de centre
  du même nom qu'un titre du réseau : permis ; anon et authenticated ne lisent ni n'écrivent `titres` (`42501`) ;
  `has_column_privilege('authenticated', 'public.affectations', 'titre_id', 'insert')` faux.
- [ ] **Step 2 : modes de l'assembleur.** `titres` (injecte les migrations `20261112_titres_1` à `_4` et leurs retours
  4, 3, 2, 1 ; une étape dont le fichier manque est neutralisée en `select 1` tant que sa tâche n'est pas faite, option
  `--etapes 1` à `1,2,3,4`, comme `repetition --etapes`), `titres-contre-epreuve` (tout neutralisé), `titres-en-ligne`
  (rien d'injecté). Tests ajoutés à `tests/assembler-roles.test.mjs` : chaque mode produit les bons marqueurs, un fichier
  manquant d'une étape demandée arrête l'assemblage. Run : `node --test tests/assembler-roles.test.mjs`. Expected : PASS.
- [ ] **Step 3 : contre-épreuve.** Run : `node outils/assembler_repetition_roles.mjs titres-contre-epreuve
  .base-locale/t.sql && psql -h 127.0.0.1 -p 55435 -U postgres -d postgres -X -q -f .base-locale/t.sql`. Expected :
  `ROUGE` sur chaque contrôle du groupe `titres`.
- [ ] **Step 4 : écrire la migration 1 et son retour.** Ordre : fonctions de plafond, table, lignes fixes, colonne
  nullable, remplissage (`update affectations set titre_id = titre_fixe(...)`), `set not null`, déclencheur. Le retour
  supprime déclencheur, colonne, table et fonctions.
- [ ] **Step 5 : vert.** Run : `node outils/assembler_repetition_roles.mjs titres --etapes 1 .base-locale/t.sql` puis psql.
  Expected : `VERT n/0`, et au groupe `retour` l'empreinte d'après les retours égale celle d'avant.
- [ ] **Step 6 : commit** `Titres, étape 1, migration 1 : table titres, titres fixes, titre_id rempli d'office`.

### Task 3 : Le vocabulaire des cases et des gestes (migration 2, partie A)

**Files:**
- Create: `supabase/migrations/20261112_titres_2_gestes.sql`, `20261112_titres_2_gestes_retour.sql`
- Modify: `tests/sql/titres-preuve.sql`

**Interfaces:**
- Consumes : `titres`, `affectations.titre_id`, `_pages_du_niveau` (Task 2) ; `apercu_role`, `fondateur_reel`,
  `promo_courante`, `lieu_courant`, `lieu_de_promo` (lot 4).
- Produces (toutes `stable security definer`, `search_path` public puis pg_temp, adresse du jeton comparée en minuscules ;
  exécution accordée à anon et authenticated comme les fonctions du lot 4, `revoke ... from public`) :
  - `case_promo(p integer, p_page text) returns integer` : en aperçu, `formateur` et `p = promo_courante()` donnent le
    plafond, tout autre aperçu 0 ; sinon fondateur : plafond ; sinon la case du titre de la ligne `formateur` de
    l'appelant sur p (fixe : plafond ; non fixe : `voir` 1, `modifier` 2, absente 0, bornée par le plafond) ; 0 si rien ;
    jamais nul (`coalesce`).
  - `case_centre(l integer, p_page text) returns integer` : même forme, aperçu `direction` et `l = lieu_courant()`, ligne
    `direction` sur l.
  - `case_reseau(p_page text) returns integer` : aperçu `siege`, ligne `siege`.
  - `formateur_fixe(p integer)`, `direction_fixe(l integer)`, `siege_fixe()` `returns boolean` : même forme, titre fixe seul.
  - `membre_stagiaire(p integer) returns boolean` : `(apercu_role() = 'stagiaire' and p = promo_courante())` ou (sans
    aperçu) une fiche de l'appelant dans p. Ce que lit aujourd'hui un stagiaire par les lectures « P ».
  - `geste_promo(p integer, p_geste text)`, `geste_centre(l integer, p_geste text)`, `geste_reseau(p_geste text)` `returns
    boolean` : les tables 1.1 et 1.2, un `case` par code ; p ou l nul : faux ; code inconnu : exception
    `titres: geste inconnu « % »` (état `22023`), pour qu'une faute de frappe dans une règle échoue au lieu de fermer en
    silence.

- [ ] **Step 1 : preuve, groupe `equivalence`.** Pour chaque personnage du lot 4 repris dans la preuve (stagiaires,
  `form_n`, `form_m`, `dir_n`, `siege`, `fond`, `cumul`, `dir_form`, `sans_role`, `ancien_form`), chaque contexte (en-tête
  promo 1, 2, 7, sans en-tête) et chaque contexte d'aperçu de la preuve du lot 4 (`fond/formateur`, `fond/direction`,
  `fond/siege`, `fond/stagiaire`, `form_n/stagiaire`, `form_n/formateur` refusé), comparer, dans la même incarnation
  (`pg_temp.valeur`), chaque geste à son ancien prédicat :
  ```sql
  -- une ligne par paire ; tout écart nomme personnage, contexte et code
  ('planning.modifier', 'formateur_courant()'), ('emargement.lire', 'equipe_courante()'),
  ('stagiaires.gerer', 'equipe_courante()'), ('stagiaires.supprimer', 'formateur_courant()'),
  ('notes.lire', 'equipe_courante()'), ('notes.saisir', 'formateur_courant()'),
  ('contenus.lire_internes', 'formateur_courant() or direction_courante() or est_siege()'),
  ('contenus.rediger', 'redacteur_contenus()'), ('referentiel.modifier', 'formateur_courant()'),
  ('contenus.traiter', 'formateur_courant()'), ('modules.modifier', 'equipe_courante()'),
  ('fiches_internes.ecrire', 'equipe_courante()'), ('benevoles.lire', 'equipe_courante()'), ...
  ```
  appelés comme `public.geste_promo(public.promo_courante(), code)` ; plus `geste_centre(l, code)` contre
  `est_direction(l)` pour chaque lieu, `geste_reseau(code)` contre `est_siege()`, `planning.lire` contre `promo_courante()
  is not null` pour les comptes du personnel. Attendu : 0 écart.
- [ ] **Step 2 : preuve, groupe `gestes`** (personnages fictifs nouveaux, titres non fixes posés en propriétaire sur la
  promo 1 et son lieu) : `t_secr` (centre, `{"promos":"voir","stagiaires":"modifier","emargement":"voir","equipe":"voir"}`),
  `t_interv` (promo, `{"planning":"voir","emargement":"modifier","stagiaires":"voir","cours":"voir"}`), `t_rh` (centre,
  `{"promos":"voir","equipe":"voir"}`), `t_contenus` (réseau, `{"cours":"modifier"}`). Attendus écrits en dur, par exemple :
  `dir_n` : `emargement.tenir` faux, `notes.saisir` faux, `stagiaires.supprimer` faux ; `t_interv` : `emargement.tenir`
  vrai, `planning.modifier` faux, `stagiaires.gerer` faux, `contenus.lire_internes` vrai, `contenus.rediger` faux,
  `stagiaires.supprimer` faux, `anonymiser` faux, `fiches_internes.ecrire` faux ; `t_secr` : `stagiaires.gerer` vrai,
  `notes.lire` faux, `anonymiser` faux, `planning.lire` faux, `benevoles.lire` faux ; `t_rh` : `stagiaires.lire` faux ;
  `t_contenus` : `contenus.rediger` vrai, `referentiel.modifier` faux, `centres.creer` faux ; `siege` sans promo, une
  direction d'un centre sans promo (`dir_vide`, comme `c_dir_vide` de `espaces-preuve.sql`) et `form_n` sous l'en-tête
  d'une promo inaccessible : chaque geste de promo rend `false` (jamais nul), aucune erreur, et `geste_centre(<son
  lieu>, 'promos.gerer')` reste vrai pour `dir_vide` ; `geste_promo(1, 'inexistant')` : `ERREUR 22023`.
- [ ] **Step 3 : contre-épreuve.** `titres --etapes 1` : ROUGE sur les groupes `equivalence` et `gestes` (fonctions absentes).
- [ ] **Step 4 : écrire la partie A de la migration 2** et, dans le retour, la suppression de ces fonctions (en dernier).
- [ ] **Step 5 : vert.** `titres --etapes 1,2`. Expected : `VERT n/0`.
- [ ] **Step 6 : contre-épreuve de sensibilité.** Sur la base locale, remplacer à la main `geste_promo` par une version où
  `notes.lire` oublie `cc(notes)`, rejouer : `ROUGE` sur `equivalence` pour `dir_n` et `fond/direction`. Reconstruire ensuite.
- [ ] **Step 7 : commit** `Titres, étape 1, migration 2 (A) : cases et gestes, équivalents aux droits d'aujourd'hui`.

### Task 4 : Les fonctions qui décident d'un droit (migration 2, partie B)

**Files:**
- Modify: `supabase/migrations/20261112_titres_2_gestes.sql`, `20261112_titres_2_gestes_retour.sql`, `tests/sql/titres-preuve.sql`

**Interfaces:**
- Consumes : `geste_promo`, `geste_centre`, `geste_reseau` (Task 3).
- Produces : les 29 fonctions de la table 1, mêmes signatures, mêmes retours, mêmes phrases, mêmes droits d'exécution.
  Fragments (un par garde) : `formateur_courant()` devient `geste_promo(promo_courante(), '<code>')`,
  `equipe_courante()` de même, `est_formateur(x) or est_direction(lieu_de_promo(x))` devient `geste_promo(x, '<code>')`,
  `est_direction(l)` devient `geste_centre(l, '<code>')`, `est_siege()` devient `geste_reseau('<code>')`. Cas
  particuliers : `inviter_compte` (trois gardes : stagiaire, formateur, direction ; la branche siège garde
  `est_fondateur()`), `notes_stats_groupe` (garde ajoutée : `case when membre_stagiaire(promo_courante()) or
  geste_promo(promo_courante(), 'notes.lire') then ... end`, nul sinon), `is_admin()` et `is_prof()` (corps entier
  remplacé : `select geste_promo(promo_courante(), 'contenus.traiter')`), `a_une_affectation` (`equipe_courante()` devient
  `geste_promo(promo_courante(), 'stagiaires.gerer')`). Un seul bloc `do` pour toutes (atomique), avec un tableau
  `(fonction, ancien, nouveau)` comme `20261111_espaces_4_donnees.sql` ; le retour rejoue les fragments en sens inverse.

- [ ] **Step 1 : preuve, groupe `fonctions`.** Pour chaque fonction, un cas avec un titre non fixe qui la refusait par
  sa case et un cas qui l'ouvre, attendus écrits en dur, par exemple : `t_interv` appelle `emargement_ouvrir('matin',
  '08:30','12:00')` sur la promo 1 (émargement allumé en propriétaire) : `OK` ; `t_interv` appelle
  `anonymiser_stagiaire(<fiche>)` : `ERREUR 42501` ou la phrase d'origine `Réservé aux administrateurs` (la phrase ne
  change pas) ; `t_secr` appelle `set_date_naissance` : `OK` ; `t_secr` appelle `purger_benevoles('{...}', <lieu>)` :
  refus ; `t_rh` appelle `creer_promo` : refus `promo: Réservé à la direction du centre.` ; `t_contenus` appelle
  `creer_centre('X')` : refus `centre: Réservé au siège.` ; `t_interv` sous `is_admin()` : faux. Et pour chaque fonction
  réécrite : `md5(pg_get_functiondef(...))` après le retour égale celui d'avant la migration.
- [ ] **Step 2 : contre-épreuve.** `titres --etapes 1,2` avec la seule partie A (partie B absente) : ROUGE sur `fonctions`.
- [ ] **Step 3 : écrire la partie B** (fragments repris du texte exact des définitions en vigueur : lot 4 pour la plupart,
  `20261108_espaces_*` et `20261111_espaces_4_donnees` pour celles qu'ils ont redéfinies, `20261110_epcf_moyennes_seuil_3`,
  `20261023_notes_stats_en_formation`).
- [ ] **Step 4 : vert.** `titres --etapes 1,2` : `VERT n/0`. Puis, sur la base locale avec les migrations 1 et 2 appliquées
  (`psql -1 -f`), `espaces-en-ligne` et `donnees-en-ligne` : mêmes verdicts que `.base-locale/verdicts/avant/`.
- [ ] **Step 5 : commit** `Titres, étape 1, migration 2 (B) : 29 fonctions passent par les gestes`.

### Task 5 : Les règles (migration 3)

**Files:**
- Create: `supabase/migrations/20261112_titres_3_regles.sql`, `20261112_titres_3_regles_retour.sql`
- Modify: `tests/sql/titres-preuve.sql`, `tests/sql/roles-preuve.sql`

**Interfaces:**
- Consumes : gestes (Task 3), `membre_stagiaire`.
- Produces : les 93 règles de la table 1 réécrites par `alter policy <nom> on <table> using (...) with check (...)`, appels
  sans argument de colonne sous la forme `(select public.geste_promo((select public.promo_courante()), '<code>'))`.
  Lectures « P » : `promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select
  public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), '<code>.lire')))`. Clauses
  `M` (sa fiche, son adresse) inchangées. `promos_modification` : `public.geste_promo(id, 'promo.renommer')`.
  `affectations_ajout` et `affectations_retrait` : `(role = 'formateur' and public.geste_centre(public.lieu_de_promo(promo_id),
  'formateurs.nommer')) or (role = 'direction' and (select public.geste_reseau('directions.nommer'))) or (role = 'siege'
  and (select public.est_fondateur()))`. Le retour remet chaque expression du lot 4 (et celle de
  `20261110_profils_email_stagiaires.sql` pour `user_profiles_lecture`), relue dans les fichiers, jamais réécrite de mémoire.
- Matrice du lot 4 : deux lignes ajoutées après celle de `registre_qualite`, chacune `where to_regclass(...) is not null` :
  `('public.titres', 'false', 'false', 'false', 'false', $mx$nom = 'PreuveMaj'$mx$, null)` et
  `('public.journal_droits', 'false', 'false', 'false', 'false', $mx$action = 'PreuveMaj'$mx$, null)`. Aucune autre ligne
  de `roles-preuve.sql` ne change.

- [ ] **Step 1 : preuve, groupe `cases`** (titres fictifs de la Task 3, lectures en nombre de lignes, attendus en dur) :
  `t_rh` ne lit aucune ligne de `stagiaires`, `stagiaires_prive`, `passages`, `evaluations`, `emargement_lignes` de la promo
  1 (« Non » ferme la lecture) ; `t_secr` lit `stagiaires` et `passages`, aucune `evaluations`, aucune `planning_entries`,
  aucune `benevoles` ; `t_interv` lit `planning_entries` mais n'en ajoute pas (« Voir » ferme l'écriture : `0 ligne` ou
  `42501`), lit `emargement_lignes`, n'ajoute aucune `evaluations`, ne supprime aucune `stagiaires`, n'écrit ni `profs` ni
  `contacts`, lit les cours de thème non publiés mais ne les modifie pas ; un stagiaire de la promo 1 lit toujours le
  planning, les séances, la liste, les examens ; `t_contenus` modifie une `qcm_questions`, n'écrit ni `qcm` ni `themes`.
- [ ] **Step 2 : contre-épreuve.** `titres --etapes 1,2` : ROUGE sur `cases` (les règles du lot 4 ouvrent tout titre).
- [ ] **Step 3 : écrire la migration 3 et son retour.** Garde en tête : chaque règle nommée existe (`pg_policies`), sinon
  la migration s'arrête avec son nom.
- [ ] **Step 4 : vert.** `titres --etapes 1,2,3` : `VERT n/0`.
- [ ] **Step 5 : non-régression sur la base locale.** Appliquer les migrations 1, 2, 3 (`psql -1 -f`), jouer
  `en-ligne` (roles), `espaces-en-ligne`, `donnees-en-ligne`, epcf `en-ligne`, profils `en-ligne`, questionnaires,
  registre qualité, habillage. Expected : chaque verdict `VERT` ; pour chaque groupe, autant de contrôles réussis
  qu'avant (fichiers de `.base-locale/verdicts/avant/`), sauf `matrice` et `couverture` de la preuve du lot 4 qui en
  gagnent exactement ceux des deux lignes nouvelles. Les empreintes md5 rendues en information par epcf et profils
  changent (règles réécrites) : le dire, ce n'est pas un échec.
- [ ] **Step 6 : contre-épreuve de la matrice.** Sur la base locale, remplacer à la main `stagiaires_suppression` par
  `geste_promo(..., 'stagiaires.gerer')` et rejouer `en-ligne` : ROUGE sur la case S de `dir_n` (M3). Reconstruire.
- [ ] **Step 7 : commit** `Titres, étape 1, migration 3 : 93 règles passent par les gestes`.

### Task 6 : Le journal des droits (migration 4)

**Files:**
- Create: `supabase/migrations/20261112_titres_4_journal.sql`, `20261112_titres_4_journal_retour.sql`
- Modify: `tests/sql/titres-preuve.sql`

**Interfaces:**
- Produces :
  - table `public.journal_droits(id bigint identité, quand timestamptz not null default now(), par text not null,
    action text not null check in ('donne','retire','change','cree','ajuste','supprime'), pour text, titre_id bigint,
    titre_nom text not null, niveau text not null, lieu_id integer, promo_id integer, avant jsonb, apres jsonb)`, sans clé
    étrangère (la trace survit au titre, à la promo, au centre) ; index sur `quand` et `(lieu_id, quand)`. RLS active,
    aucune règle, aucun droit pour anon et authenticated (lecture par fonctions à l'étape 2 : `equipe.lire`,
    `directions.lire`). `avant` et `apres` ne portent que titre, nom, cases, portée : jamais une adresse.
  - `public._journal_affectations()` (after insert, delete, et update quand `titre_id` change) et `public._journal_titres()`
    (after insert, update, delete), `security definer`, sans droit d'exécution public. `par` : adresse du jeton en
    minuscules, sinon `système` (migration, cascade). `lieu_id` d'une ligne formateur : `lieu_de_promo(promo_id)` (nul si la
    promo part en cascade). Chaque écriture purge d'abord les lignes de plus de 3 ans (§ 9, choix : purge à l'écriture,
    aucune tâche planifiée ; décision T7).
  - `public.effacer_adresse_journal(p_email text) returns integer` : fondateur hors aperçu seul (sinon `42501`,
    `journal: Réservé au fondateur.`), remplace `par` et `pour` égaux à l'adresse (casse ignorée) par `compte effacé`, rend
    le nombre de lignes touchées. Exécution : authenticated.
  - Les déclencheurs sont posés après le remplissage de la migration 1 : rien n'est journalisé pour les lignes existantes.

- [ ] **Step 1 : preuve, groupe `journal`.** `dir_n` ajoute puis retire un formateur par écriture directe : deux lignes
  `donne` et `retire`, `par` = son adresse, `niveau` promo, `lieu_id` du lieu de la promo 1 ; un titre créé, ajusté
  (cases), supprimé en propriétaire : `cree`, `ajuste` (avant et après différents), `supprime` ; un changement de `titre_id`
  d'une ligne : `change` ; la mise en minuscules d'une adresse (cascade) n'écrit rien ; une invitation de stagiaire
  n'écrit rien ; aucune ligne du journal ne contient l'adresse d'un compte qui a une fiche ; anon et authenticated ne
  lisent ni n'écrivent la table (`42501`) ; une ligne datée d'il y a 3 ans et 1 jour (posée sous `SET LOCAL
  session_replication_role = replica`) disparaît à l'écriture suivante, une de 2 ans et 364 jours reste ;
  `effacer_adresse_journal` : refusée à `dir_n` (`42501`), le fondateur remplace 2 lignes.
- [ ] **Step 2 : contre-épreuve.** `titres --etapes 1,2,3` : ROUGE sur `journal`.
- [ ] **Step 3 : écrire la migration 4 et son retour.**
- [ ] **Step 4 : vert.** `titres` (les quatre étapes) : `VERT n/0`, groupe `retour` : empreinte d'après les retours 4, 3,
  2, 1 égale à celle d'avant.
- [ ] **Step 5 : commit** `Titres, étape 1, migration 4 : journal des droits du personnel`.

### Task 7 : Répétition complète et essai à blanc

**Files:** aucun nouveau (verdicts dans `.base-locale/verdicts/apres/`).

- [ ] **Step 1 : base locale complète.** `reconstruire.sh`, `rejouer_suite.sh --avec-titres`. Expected : OK, 14 migrations.
- [ ] **Step 2 : toutes les preuves en ligne** (liste de la Task 5, Step 5, plus `titres-en-ligne`) : `VERT`, comptes par
  groupe identiques à `avant/` hors les ajouts annoncés ; `node --test "tests/*.test.mjs"` vert ; `git diff main --stat --
  js` vide.
- [ ] **Step 3 : essai à blanc en production, avec l'accord explicite de Timy.** Lui montrer : les quatre migrations, la
  liste des 93 règles et 29 fonctions, les verdicts locaux. Assembler `titres --compact` (migrations injectées, retours
  joués, levée finale : rien ne reste) et le lui remettre ; il le joue par `outils/psql_prod.sh` (ou donne son accord
  explicite pour que la session principale le fasse), hors des heures de cours. Expected : `VERT n/0`, md5 rendu égal à
  celui de l'assembleur. Deux passages au plus.
- [ ] **Step 4 : commit** des seuls fichiers éventuellement corrigés après l'essai (message qui dit pourquoi).

### Task 8 : Application en production

- [ ] **Step 1 : accord explicite de Timy** pour appliquer (même message : ce qui part, l'ordre, le retour prêt).
- [ ] **Step 2 : application** des quatre migrations dans l'ordre, chacune `psql -1 -v ON_ERROR_STOP=1 -f`, par la voie
  qu'il a choisie à la Task 7.
- [ ] **Step 3 : preuves en ligne en production** (même accord) : `titres-en-ligne`, `en-ligne` (roles),
  `espaces-en-ligne`, `donnees-en-ligne`, epcf et profils `en-ligne` ; questionnaires et registre qualité avec le texte des
  fichiers à la place de `pg_read_file`. Expected : `VERT` partout. Un ROUGE : retours 4, 3, 2, 1 aussitôt (accord déjà
  donné dans le message du Step 1), puis diagnostic.
- [ ] **Step 4 : traces.** `ROADMAP.md` et l'en-tête de `POINT-DE-REPRISE.md` du projet ECSR (compétence `roadmap`) :
  étape 1 en ligne, décisions T1 à T8 en attente. Aucune entrée Nouveautés (rien de visible ; décision T8).
- [ ] **Step 5 : commit** `Titres, étape 1 en ligne : base invisible appliquée le <date>`.

---

## 4. Étape 2 : fonctions de gestion des titres

État de départ (11/11) : migrations `20261112_titres_1_tables`, `_2_gestes`, `_3_regles` appliquées en production ;
`_4_journal` dans main, **non appliquée** (elle attend la version des conditions, étape 4). Verdicts de production après
l'étape 1, référence de toute comparaison : titres-en-ligne 375/0, rôles 11518/0, espaces 240/0, données 59/0, EPCF 17/0,
profils 32/0, questionnaires 207/0, registre 128/0, conservation 227/0 (la base locale peut différer : la Task 9 relève les siens).

Deux mises en ligne, chacune avec sa migration, son retour, sa répétition, son essai à blanc et l'accord de Timy :
- **2a, sécurité** (migration `20261112_titres_5_fermetures`) : plus aucune écriture directe sur `affectations`, aucun compte
  ne se nomme lui-même, et les lectures qu'une case « Non » doit fermer le sont. Seul changement d'app : le retrait d'une
  direction (page Directions de centre) passe par `retirer_titre`. Rien ne change pour les titres fixes, rien ne se voit.
- **2b, gestion** (migration `20261112_titres_6_gestion`) : le verrou des titres non fixes, donner, retirer, créer, ajuster,
  supprimer, et les lectures dont l'étape 3 a besoin. Aucun fichier `js/`, rien ne se voit, aucun titre non fixe donnable
  en production (verrou fermé jusqu'à l'étape 4). Le journal reste non appliqué : ses lectures rendent une liste vide.

### 4.0 Décisions de découpage (à relire par Timy, § 7 : T9 à T17)

- **`retirer_titre` dès 2a, mais pour les seuls titres fixes (T10).** Sa signature est définitive (`p_email, p_titre_id,
  p_lieu_id`), donc `js/db.js` ne change qu'une fois ; la branche des titres non fixes (règles 3 et 4 du § 7, comparaison des
  cases) n'a d'objet que lorsqu'un titre non fixe peut être porté, donc en 2b, où un fragment remplace la ligne de refus de 2a.
  Une fonction minimale « retirer une ligne d'affectation » aurait demandé une seconde retouche de l'app en 2b.
- **`inviter_compte` et `regler_affectations_formateur` gardent leur signature (T9, écart à la spec § 14).** Leur ajouter
  `p_titre_id` changerait leur signature : PostgREST refuserait deux surcharges, et les preuves des lots 4 et 5 citent
  `inviter_compte(text, text, integer, integer, integer)`. L'invitation avec un titre est `donner_titre`, qui crée le profil
  s'il manque. `inviter_compte` reste le chemin des stagiaires et des titres fixes ; l'étape 3 bascule les écrans sur
  `donner_titre`.
- **Les écritures directes se ferment par les droits ET par les règles** : `revoke insert, delete` pour authenticated, et
  `affectations_ajout` / `affectations_retrait` réécrites à `false` (alter policy : leurs noms restent, le retour 3 de l'étape
  1 les retrouve). Ni `drop policy` ni `drop` + `create`.
- **Une preuve à part, `tests/sql/titres-gestion-preuve.sql`**, jouée sur une base où 1, 2, 3 sont appliquées (l'état de la
  production) : la preuve de l'étape 1 injecte 1 à 4 et ne peut plus se jouer en mode injecté en production. Les aides et
  les personnages communs passent dans `tests/sql/titres-aides.sql`, inclus par les deux.

### 4.1 Fichiers de l'étape 2

| Fichier | Rôle |
|---|---|
| `outils/base_locale/rejouer_suite.sh`, `LISEZMOI.md` | option `--titres 1,2,3[,4][,5][,6]` (les titres dans l'ordre donné) ; `--avec-titres` vaut `--titres 1,2,3,4` |
| `tests/sql/titres-aides.sql` (créé), `tests/sql/titres-preuve.sql` | aides et personnages communs sortis de la preuve de l'étape 1 ; contrôles de l'étape 1 que la migration 5 invalide rendus dépendants de l'état |
| `tests/sql/titres-gestion-preuve.sql` (créé) | preuve de l'étape 2 (groupes `structure`, `retrait`, `soi`, `ecritures`, `lectures`, `verrou`, `donner`, `retirer`, `gerer`, `lire`, `immediat`, `journal`, `retour`) |
| `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs` | modes `gestion [--etapes 5\|5,6\|4,5,6]`, `gestion-contre-epreuve`, `gestion-en-ligne` |
| `supabase/migrations/20261112_titres_5_fermetures.sql` et `_retour.sql` | 2a |
| `supabase/migrations/20261112_titres_6_gestion.sql` et `_retour.sql` | 2b |
| `outils/generer_fragments_titres_5.py`, `outils/generer_fragments_titres_6.py` | blocs de fragments, aller et retour d'une seule source (comme `generer_fragments_titres_2.py`) |
| `tests/sql/roles-preuve.sql` | ligne de matrice des affectations et groupe h, selon l'état (avant ou après la migration 5) |
| `js/db.js`, `js/views/siege-directions.js`, `js/espaces-rules.js`, `tests/espaces-rules.test.mjs` | 2a seulement : `retirerTitre`, préfixe de refus `titres:` |
| `_harness_supabase.js` (banc, hors git) | 2a : la RPC `retirer_titre` à la place du `delete` direct |

Ordre d'application en production : 5, puis 6 (4 plus tard, avec les conditions). Retours : 6 puis 5. Gardes d'ordre, comme
celle du retour 1 : le retour 5 refuse de se jouer si `donner_titre` existe (retour 6 d'abord) ; le retour 3 de l'étape 1
gagne en tête un refus si `retirer_titre` existe (retour 5 d'abord).

### Global Constraints (étape 2, en plus de celles du haut)

- Les phrases de refus commencent par `titres:` (nouvelles fonctions) ou gardent leur préfixe d'origine (`invitation:`,
  `equipe:`) ; droit manquant : `42501`. Textes au vouvoiement (équipe). L'app retire le préfixe (`PREFIXES_DE_REFUS`).
- Toute fonction nouvelle : `security definer`, `search_path` public puis pg_temp, adresse du jeton en minuscules,
  `revoke all ... from public, anon, service_role`, `grant execute ... to authenticated` ; les aides internes (`_...`) :
  aucun droit d'exécution.
- Pour les titres fixes, chaque fonction et chaque règle touchée donne exactement les réponses d'aujourd'hui : la matrice
  du lot 4 reste verte au même compte, à la seule différence des écritures directes sur `affectations` (spec § 14).
- Une fonction qui lit `journal_droits` se joue sans la table : `to_regclass('public.journal_droits')` nul, liste vide,
  aucune erreur (corps en `plpgsql`, requête par `execute`).
- Les gardes de dérive de l'étape 1 s'appliquent : fragment trouvé exactement une fois (retours chariot suivis), règle
  nommée présente, sinon la migration s'arrête sans rien changer.

### Review Focus (étape 2)

1. **Se nommer soi-même par un autre chemin** : un siège qui passe par `inviter_compte`, `donner_titre`, une écriture directe,
   ou l'aperçu du fondateur ; une personne qui ajuste le titre qu'elle porte (groupes `soi`, `donner`, `gerer`).
2. **Le remplacement d'un titre au même niveau** (T13) : il retire l'ancien, donc obéit aux règles du retrait ; un Équipe :
   Modifier ne remplace pas le Formateur d'une directrice (groupe `donner`).
3. **Le titre du réseau ajusté depuis un centre** : les porteurs des autres centres ne bougent pas, la version du centre garde
   le nom, un second ajustement modifie la version au lieu d'en créer une autre (groupe `gerer`).
4. **Le retrait immédiat** : la demande suivante de la personne est refusée, sans reconnexion (groupe `immediat`).
5. **Le journal absent** : `journal_des_droits` rend une liste vide et ne lève pas ; présent, il ne rend au siège aucune ligne
   de niveau promo (groupes `lire`, `journal`).

---

### 2a : sécurité

### Task 9 : Outils de l'étape 2 (base locale, aides, gabarit, assembleur)

**Files:**
- Modify: `outils/base_locale/rejouer_suite.sh`, `outils/base_locale/LISEZMOI.md`, `tests/sql/titres-preuve.sql`,
  `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs`
- Create: `tests/sql/titres-aides.sql`, `tests/sql/titres-gestion-preuve.sql`

**Interfaces:**
- Produces :
  - `bash outils/base_locale/rejouer_suite.sh [--port N] [--titres 1,2,3]` : après la suite, applique
    `20261112_titres_<n>_*` dans l'ordre de la liste ; fichier manquant : code 3 et son nom. Sortie `OK : suite rejouée
    (14 + k migrations)`.
  - `tests/sql/titres-aides.sql` : les fonctions `pg_temp` de `titres-preuve.sql` qui ne sont pas des groupes (`jouer`,
    `etape`, `essai`, `nouveau_titre`, `affecter`, `cases`, `verdict_titres`, `poser_perso`, `poser_titres_gestes`,
    `appeler`, `cas_apercu`, `cas`, `poser_titres_fonctions`, `cas_lecture`, `cas_refus`), sans changement de corps.
    `titres-preuve.sql` l'inclut par `-- @@INCLURE tests/sql/titres-aides.sql@@` après `roles-aides.sql`.
  - `tests/sql/titres-gestion-preuve.sql` : même forme que `titres-preuve.sql` (empreinte avant, migrations 4, 5, 6 en
    `-- @@INJECTER ...@@`, groupes, retours 6, 5, 4, groupe `retour`, verdict par `verdict_titres`). Prérequis contrôlé au
    groupe `structure` : `titre_fixe`, `geste_promo`, et la règle `affectations_ajout` réécrite par la migration 3 existent.
    Un groupe dont la fonction n'existe pas (2b avant la migration 6) est sauté avec une ligne d'information en mode
    `gestion-en-ligne`, et compte comme échec dans les modes injectés.
  - Personnages de l'étape 2, posés en propriétaire par `pg_temp.poser_titres_gestion()` (dans la preuve de gestion), en plus
    de ceux de `titres-aides.sql` : une promo « Preuve8 promo A » dans le centre de la promo 1 ; `t_chef` (centre 1,
    `{"promos":"voir","stagiaires":"voir","equipe":"modifier"}`), `t_vide` (centre 1, `{}`), `t_qualite` (réseau,
    `{"cours":"voir","directions":"voir"}`), `t_dirs` (réseau, `{"cours":"voir","directions":"modifier"}`) ; des adresses
    libres `x`, `y`, `z`, `u`, `v` (`preuve8.*@exemple.invalid`) et un orphelin (profil stagiaire sans fiche).
  - Modes : `gestion [--etapes 5|5,6|4,5,6]` (défaut `5,6` ; étape demandée absente : arrêt avec message),
    `gestion-contre-epreuve` (rien d'injecté), `gestion-en-ligne` (rien d'injecté, après application réelle).

- [ ] **Step 1 : base locale au niveau de la production.** `reconstruire.sh` puis `rejouer_suite.sh --titres 1,2,3`.
  Expected : `OK : suite rejouée (17 migrations)`.
- [ ] **Step 2 : aides partagées.** Déplacer les fonctions listées dans `titres-aides.sql`. Run : `titres-en-ligne` sur cette
  base, puis `titres --etapes 1,2,3,4` sur une base reconstruite et rejouée sans titres. Expected : mêmes comptes par groupe
  qu'avant le déplacement (375/0 en ligne ; 433/0 injecté sur la suite), md5 du texte assemblé différent (attendu).
- [ ] **Step 3 : assembleur.** Modes et tests (`node --test tests/assembler-roles.test.mjs`) : chaque mode a ses marqueurs ;
  `gestion --etapes 6` sans 5 refusé ; `gestion` ne lit pas un fichier d'une étape non demandée. Expected : PASS.
- [ ] **Step 4 : gabarit vide et contre-épreuve.** Le gabarit ne porte que `structure` et `retour`. Run :
  `gestion-contre-epreuve` sur la base de l'étape 1. Expected : `VERT` sur `structure` (prérequis présents), et
  `gestion --etapes 5` refusé tant que la migration 5 manque.
- [ ] **Step 5 : verdicts de départ** dans `.base-locale/verdicts/avant-2/` : `titres-en-ligne`, `en-ligne` (rôles),
  `espaces-en-ligne`, `donnees-en-ligne`, EPCF et profils `en-ligne`, questionnaires, registre, conservation, habillage.
  Expected : `VERT` partout ; comptes notés dans le rapport.
- [ ] **Step 6 : commit** `Titres, étape 2 : outils (base locale --titres, aides partagées, preuve de gestion)`.

### Task 10 : `retirer_titre` (titres fixes) et « jamais sur soi » dans `inviter_compte` (migration 5, partie A)

**Files:**
- Create: `supabase/migrations/20261112_titres_5_fermetures.sql`, `20261112_titres_5_fermetures_retour.sql`,
  `outils/generer_fragments_titres_5.py`
- Modify: `tests/sql/titres-gestion-preuve.sql`

**Interfaces:**
- Consumes : `geste_centre`, `geste_reseau`, `est_fondateur`, `titre_fixe` (étape 1).
- Produces :
  - `public.retirer_titre(p_email text, p_titre_id bigint, p_lieu_id integer) returns jsonb` :
    `{email, titre_id, lieu_id, retirees}` (`retirees` : nombre de lignes). Ordre des contrôles et phrases :
    1. jeton sans adresse : `titres: Connexion requise.` (42501) ;
    2. titre absent : `titres: Titre introuvable.` ; titre non fixe : `titres: Ce titre ne se retire pas encore ici.`
       (ligne seule, remplacée en 2b) ;
    3. niveau promo ou centre sans centre existant : `titres: Le centre est requis.` ; niveau réseau : `p_lieu_id` ignoré ;
    4. droit (42501) : Formateur, `geste_centre(p_lieu_id, 'formateurs.nommer')`, sinon `titres: Réservé à la direction du
       centre.` ; Direction de centre, `geste_reseau('directions.nommer')`, sinon `titres: Réservé au siège.` ; Siège,
       `est_fondateur()`, sinon `titres: Réservé au fondateur.` ;
    5. soi (42501) : cible = appelant, sauf Formateur (la directrice qui forme) et sauf `est_fondateur()` :
       `titres: Vous ne pouvez pas retirer votre propre titre.` ;
    6. effet : supprime les lignes de l'adresse (casse ignorée) qui portent ce titre, sur les promos du centre (promo), sur
       le centre (centre) ou sans portée (réseau) ; aucune : `titres: Cette personne n'a pas ce titre ici.`
  - `inviter_compte`, un fragment (branche direction), inséré avant la ligne
    `    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.` :
    refus `invitation: Vous ne pouvez pas vous nommer vous-même à la direction.` (42501) si `v_email = v_moi and not
    est_fondateur()`. Même signature, mêmes droits ; retour : fragment inverse.

- [ ] **Step 1 : preuve, groupe `retrait`** (personnages de `titres-aides.sql` ; attendus en dur, « OK n » = lignes retirées) :
  `dir_n` retire Formateur de `form_n` (centre de la promo 1) : `OK 1`, puis `form_n` n'a plus de ligne ; `dir_n` retire
  Formateur de `form_m` sur le centre de la promo 2 : `ERREUR 42501` ; `form_n` se retire Formateur : `ERREUR 42501`
  (droit), sa ligne reste ; `dir_n` se donne Formateur sur la promo 1 (`regler_affectations_formateur`) puis se le retire :
  `OK 1` (la directrice qui forme) ; `siege` retire
  Direction de centre de `dir_n` : `OK 1` ; `dir_n` se retire Direction de centre : `ERREUR 42501` ; `dir_n` retire la
  direction de `dir_deux` : `ERREUR 42501` ; `siege` retire Siège de `siege_form` : `ERREUR 42501` ; le fondateur le fait :
  `OK 1` ; titre absent, centre absent, personne sans ce titre : phrases exactes ci-dessus ; un titre non fixe
  (`t_interv`, posé en propriétaire) : `Ce titre ne se retire pas encore ici.` ; fondateur en aperçu direction sur la promo
  1 : retire Formateur de `form_n` (`OK 1`) ; en aperçu siège, retire Siège : `ERREUR 42501`.
- [ ] **Step 2 : preuve, groupe `soi`** : `siege` appelle `inviter_compte(<son adresse>, 'direction', null, null, <lieu
  1>)` : `ERREUR 42501` avec la phrase, aucune ligne écrite ; `siege` invite `c_personnel` à la direction : `OK`, une ligne ;
  le fondateur s'invite à la direction : permis ; le fondateur en aperçu siège s'invite : `ERREUR 42501`.
- [ ] **Step 3 : contre-épreuve.** `gestion-contre-epreuve` : ROUGE sur `retrait` et `soi`.
- [ ] **Step 4 : écrire la partie A** (fonction nouvelle ; un bloc `do` de fragments comme `20261111_espaces_4_donnees.sql`,
  tableau produit par `generer_fragments_titres_5.py aller|retour`) et son retour (fragment inverse, `drop function
  retirer_titre`).
- [ ] **Step 5 : vert.** `gestion --etapes 5` : `VERT n/0`, `retour` : empreinte d'après le retour 5 égale à celle d'avant.
- [ ] **Step 6 : commit** `Titres, étape 2a, migration 5 (A) : retirer_titre (titres fixes), personne ne se nomme à la direction`.

### Task 11 : Fermer les écritures directes sur `affectations` (migration 5, partie B)

**Files:**
- Modify: `supabase/migrations/20261112_titres_5_fermetures.sql`, `_retour.sql`, `tests/sql/titres-gestion-preuve.sql`,
  `tests/sql/roles-preuve.sql`, `tests/sql/titres-preuve.sql`, `supabase/migrations/20261112_titres_3_regles_retour.sql`
  (garde d'ordre en tête)

**Interfaces:**
- Consumes : `retirer_titre` (Task 10), `inviter_compte`, `regler_affectations_formateur`.
- Produces :
  - `revoke insert, delete on public.affectations from authenticated` (le droit `select` reste) ;
    `alter policy affectations_ajout on public.affectations with check (false)` ; `alter policy affectations_retrait on
    public.affectations using (false)`. Garde : les deux règles existent et citent `geste_centre` (texte de la migration 3).
  - Retour : `grant delete` et `grant insert (email, role, promo_id, lieu_id)` à authenticated, les deux expressions de
    `20261112_titres_3_regles.sql` relues dans le fichier (jamais de mémoire).
  - `roles-preuve.sql` : l'état se lit une fois, `v_ferme := to_regprocedure('public.retirer_titre(text, bigint, integer)')
    is not null`. La ligne de matrice `public.affectations` prend, pour l'ajout et le retrait, `'false'` si `v_ferme`, les
    prédicats d'aujourd'hui sinon (lecture inchangée). Le groupe h garde ses 13 cas tant que `v_ferme` est faux ; sinon
    il joue les 13 cas de fonction ci-dessous, aux mêmes attendus, plus « écriture directe refusée à tous ».

- [ ] **Step 1 : preuve, groupe `ecritures`** (titres-gestion) : pour `dir_n`, `siege`, `form_n`, `stag_n` et le fondateur
  (hors aperçu), `insert into public.affectations (...)` et `delete from public.affectations where email = ...` :
  `ERREUR 42501` ou `OK 0`, jamais une ligne écrite ou retirée ; `has_table_privilege('authenticated', 'public.affectations',
  'insert')` et `'delete'` faux, `'select'` vrai ; le scénario de la relecture finale (I4) : `siege` insère une ligne
  `direction` à son adresse sur le centre de la promo 1, puis lit `stagiaires` sous l'en-tête 1 : `ERREUR 42501` puis `0`
  ligne.
- [ ] **Step 2 : `roles-preuve.sql`, groupe h en cas de fonction** (si `v_ferme`), attendus d'aujourd'hui :
  ```text
  dir_n   inviter_compte(form_m, 'formateur') en-tête 1              OK, 1 ligne promo 1
  dir_n   regler_affectations_formateur(form_m, <lieu 2>, '{2}')      REFUS 42501
  form_n  inviter_compte(personnel, 'formateur') en-tête 1           REFUS 42501
  form_n  inviter_compte(personnel, 'direction', null, null, <l1>)   REFUS 42501
  form_n  inviter_compte(personnel, 'siege')                         REFUS 42501
  dir_n   inviter_compte(personnel, 'direction', null, null, <l1>)   REFUS 42501
  stag_n  inviter_compte(personnel, 'formateur') en-tête 1           REFUS 42501
  siege   inviter_compte(personnel, 'direction', null, null, <l1>)   OK, 1 ligne
  siege   inviter_compte(personnel, 'siege')                         REFUS 42501
  fond    inviter_compte(personnel, 'siege')                         OK, 1 ligne
  dir_n   retirer_titre(form_n, <Formateur>, <l1>)                   OK, 0 ligne restante
  form_n  retirer_titre(form_n, <Formateur>, <l1>)                   REFUS 42501, 1 ligne restante
  dir_n   update public.affectations set promo_id = 2 ...            REFUS 42501 (inchangé)
  ```
  plus un cas « écriture directe refusée » par acteur de la liste (`REFUS 42501`).
- [ ] **Step 3 : `titres-preuve.sql` dépendant de l'état** (même `v_ferme`) : groupe `journal`, `dir_n` donne et retire par
  `inviter_compte` et `retirer_titre` au lieu de l'écriture directe (mêmes lignes de journal attendues) ; groupe `droits`,
  « le droit d'insertion par colonne garde ses quatre colonnes » devient « aucune colonne ». Garde d'ordre du retour 3 :
  essayée à la main sur la base locale (migration 5 appliquée, retour 3 joué seul : refus clair, rien ne change).
- [ ] **Step 4 : contre-épreuve.** `gestion --etapes 5` avec la seule partie A : ROUGE sur `ecritures`.
- [ ] **Step 5 : écrire la partie B et son retour ; vert.** `gestion --etapes 5` : `VERT n/0` ; puis, base `--titres
  1,2,3,5` : `en-ligne` (rôles) VERT, matrice et groupe h jugés à l'état fermé ; base `--titres 1,2,3` : `en-ligne` égal à
  `avant-2` (même compte).
- [ ] **Step 6 : commit** `Titres, étape 2a, migration 5 (B) : écritures directes sur affectations fermées`.

### Task 12 : Les lectures qu'une case « Non » ferme (migration 5, partie C)

**Files:**
- Modify: `supabase/migrations/20261112_titres_5_fermetures.sql`, `_retour.sql`, `outils/generer_fragments_titres_5.py`,
  `tests/sql/titres-gestion-preuve.sql`, `tests/sql/titres-preuve.sql` (groupe `cases` : si la migration 5 est là, la seule
  règle qui cite encore `est_*` est `public.lieux_lecture`)

**Interfaces:**
- Consumes : `geste_promo`, `geste_centre`, `geste_reseau`, `formateur_fixe`, `siege_fixe`, `membre_stagiaire` (étape 1).
- Produces :
  - `geste_centre`, un fragment : `when 'promos.lire' then return coalesce(case_centre(l, 'promos') >= 1, false);` inséré
    avant `    when 'equipe.lire' then` (les cartes Promos montrent les noms des formateurs, spec § 5.4 ; T11).
  - `alter policy affectations_lecture` :
    `lower(email) = <jeton> or (select est_fondateur())`
    `or (role = 'formateur' and (formateur_fixe(promo_id) or geste_centre(lieu_de_promo(promo_id), 'equipe.lire')`
    `    or geste_centre(lieu_de_promo(promo_id), 'promos.lire')))`
    `or (role = 'direction' and (geste_centre(lieu_id, 'equipe.lire') or (select geste_reseau('directions.lire'))))`
    `or (role = 'siege' and (select siege_fixe()))`.
  - `notes_stagiaires_visibles()`, un fragment : après `   where s.promo_id = promo_courante()`, la ligne
    `     and (membre_stagiaire(promo_courante()) or geste_promo(promo_courante(), 'notes.lire'))`.
  - `roles_du_personnel()`, un fragment : `(equipe_courante() or est_siege() or est_fondateur())` devient
    `(geste_promo(promo_courante(), 'reglages.modifier') or geste_centre(lieu_de_promo(promo_courante()), 'equipe.lire') or
    geste_reseau('directions.lire') or est_fondateur())` (« Personnes avec accès » est dans Réglages de la promo ; T12).
  - `alter policy user_profiles_lecture` : dans la clause du personnel, `(select public.est_siege())` devient
    `(select public.geste_reseau('directions.lire'))` ; le reste de l'expression de la migration 3, relu dans le fichier.
    Garde : l'expression en vigueur contient `est_siege()` exactement une fois.
  - Retour : les quatre textes de la migration 3 et des fragments d'origine.
  - Pour les titres fixes, chaque remplacement vaut l'ancien prédicat (équivalences prouvées à l'étape 1 : `equipe.lire`
    contre `est_direction`, `directions.lire` contre `est_siege`, `*_fixe` contre `est_*`).

- [ ] **Step 1 : preuve, groupe `lectures`** (en nombre de lignes, attendus en dur ; titres non fixes posés en propriétaire)
  : `t_contenus` (réseau, Directions : Non) ne lit aucune affectation de direction ni aucun profil du personnel, et
  `roles_du_personnel()` lui rend 0 ligne ; un titre du réseau « Directions : Voir » (`t_qualite`, posé ici) lit les
  affectations de direction, aucune de siège ; `t_interv` (Réglages : Non) : `roles_du_personnel()` 0 ligne, aucune
  affectation d'un autre formateur ; `t_rh` (Promos : Voir) lit les lignes formateur des promos de son centre, aucune
  d'un autre centre ; un titre de centre Promos : Non, Équipe : Non (`t_vide`) n'en lit aucune ; `t_secr`, `t_interv`,
  `t_rh` sous l'en-tête 1 : `notes_stagiaires_visibles()` rend 0 identifiant ; `stag_n` en rend autant qu'avant la
  migration (valeur relevée avant, comparée après) ; `form_n`, `dir_n`, `siege`, le fondateur : mêmes nombres qu'avant pour
  chaque lecture du groupe.
- [ ] **Step 2 : contre-épreuve.** `gestion --etapes 5` sans la partie C : ROUGE sur `lectures`.
- [ ] **Step 3 : écrire la partie C et son retour ; vert.** `gestion --etapes 5` : `VERT n/0`.
- [ ] **Step 4 : non-régression locale.** Base `--titres 1,2,3,5` : les dix preuves de `avant-2` ; Expected : `VERT`,
  comptes égaux à `avant-2` groupe par groupe, sauf rôles (groupe h, cas de fonction : nombre annoncé dans le rapport) et
  titres-en-ligne (contrôles dépendants de l'état). Les empreintes rendues en information par EPCF et profils changent.
- [ ] **Step 5 : commit** `Titres, étape 2a, migration 5 (C) : affectations, notes visibles, personnel, lus selon les cases`.

### Task 13 : L'app retire une direction par `retirer_titre`

**Files:**
- Modify: `js/db.js` (l. 305 à 327), `js/views/siege-directions.js` (import l. 8, `ouvrirRetrait` l. 113 à 125),
  `js/espaces-rules.js` (`PREFIXES_DE_REFUS`, l. 281), `tests/espaces-rules.test.mjs`, `_harness_supabase.js` (banc)

**Interfaces:**
- Consumes : `retirer_titre(p_email, p_titre_id, p_lieu_id)` (Task 10).
- Produces : `retirerTitre({ email, titreId, lieuId })` dans `js/db.js` (rend le jsonb de la base ; une erreur part par
  `erreurDeBase`) ; `retirerAffectation` supprimée (seul appelant : `siege-directions.js`) ; `lireDirectionsDuReseau()` lit
  aussi `titre_id` et rend `{ id, email, nom, lieu_id, titre_id }`.

- [ ] **Step 1 : test rouge.** `tests/espaces-rules.test.mjs` : `phraseDeRefus("titres: Réservé au siège.", "42501")` vaut
  `"Réservé au siège."`. Run : `node --test tests/espaces-rules.test.mjs`. Expected : FAIL.
- [ ] **Step 2 : `titres` dans `PREFIXES_DE_REFUS`**, `retirerTitre`, `lireDirectionsDuReseau`, et `ouvrirRetrait` qui
  appelle `retirerTitre({ email: direction.email, titreId: direction.titre_id, lieuId: centre.id })` (le refus s'affiche
  dans la fenêtre par la voie actuelle). Run : `node --test "tests/*.test.mjs"`. Expected : PASS.
- [ ] **Step 3 : banc.** Dans `_harness_supabase.js`, la RPC `retirer_titre` remplace la branche `affectations` +
  `delete` (siège seul, ligne `direction` de l'adresse et du centre ; mêmes leviers `__HARNESS_RETRAIT_FAIL` et
  `__HARNESS_RETRAIT_VIDE`, ce dernier rendant `titres: Cette personne n'a pas ce titre ici.`) ; les lignes d'affectation
  du banc gagnent `titre_id`.
- [ ] **Step 4 : robot.** Compétence `robot-des-parcours` : parcours du siège (`tour_du_reseau`, « retirer une direction »)
  et `outils/verifier_navigation.py`. Expected : VERT.
- [ ] **Step 5 : commit** `Titres, étape 2a : le retrait d'une direction passe par retirer_titre`. Aucune entrée Nouveautés :
  la page fait la même chose qu'avant (le dire à Timy).

### Task 14 : Répétition, essai à blanc et mise en ligne de 2a

- [ ] **Step 1 : répétition locale complète.** `reconstruire.sh`, `rejouer_suite.sh --titres 1,2,3` ; verdicts `avant-2` ;
  `gestion --etapes 5 --compact` (VERT, md5 noté) ; application `psql -1 -f` de la migration 5 ; `gestion-en-ligne` et les
  dix preuves (`apres-2a/`) ; retour 5 réel puis les dix preuves : égales à `avant-2`. `git diff main --stat -- js` : les
  seuls fichiers de la Task 13.
- [ ] **Step 2 : essai à blanc en production, accord explicite de Timy.** Lui montrer : la migration 5 (ce qu'elle ferme), les
  verdicts locaux, ce qui part dans l'app. Contrôles en lecture seule d'abord : aucune affectation de siège réelle, nombre
  de lignes par rôle, texte en vigueur de `affectations_lecture` et `user_profiles_lecture` (égal à la migration 3).
  `gestion --etapes 5 --compact`, joué par Timy (`outils/psql_prod.sh`) ou par la session principale avec son accord.
  Expected : `VERT n/0`, md5 égal. Deux passages au plus.
- [ ] **Step 3 : application** (même accord) : migration 5, `psql -1 -v ON_ERROR_STOP=1 -f` ; aussitôt, fusion de la branche
  dans main et poussée (l'app suit la base de quelques minutes : aucun compte siège réel ne retire de direction entre les
  deux, contrôle du Step 2). Jeton de cache : posé par le crochet de main, vérifier qu'il a changé.
- [ ] **Step 4 : preuves après, en production** : `gestion-en-ligne`, `titres-en-ligne`, `en-ligne` (rôles),
  `espaces-en-ligne`, `donnees-en-ligne`, EPCF, profils, questionnaires, registre, conservation (habillage : local
  seulement, comme à l'étape 1). Expected : `VERT`, comptes de la Task 12, Step 4. Un ROUGE : retour 5 aussitôt (accord donné au Step 2), puis diagnostic.
- [ ] **Step 5 : traces.** `ROADMAP.md` et en-tête de `POINT-DE-REPRISE.md` (compétence `roadmap`) : 2a en ligne, faille
  « un siège se nomme direction » fermée, T9 à T17 en attente ; rapport : pas d'entrée Nouveautés (rien de visible).
- [ ] **Step 6 : commit** `Titres, étape 2a en ligne : écritures fermées, lectures resserrées (<date>)`.

### 2b : gestion

### Task 15 : Le verrou des titres non fixes et les aides de décision (migration 6, partie A)

**Files:**
- Create: `supabase/migrations/20261112_titres_6_gestion.sql`, `_retour.sql`
- Modify: `tests/sql/titres-gestion-preuve.sql`

**Interfaces:**
- Produces :
  - contrainte `settings_globaux_prevus` : la liste d'aujourd'hui plus `'titres_ouverts'` (garde : la définition en vigueur
    est celle de `20261108_espaces_3_habillage.sql`, sinon arrêt ; le retour la remet après avoir supprimé une ligne
    `titres_ouverts`).
  - `public.titres_ouverts() returns boolean` (stable ; vrai si la ligne globale `titres_ouverts` vaut `oui`).
  - `public.regler_titres_ouverts(p_ouvert boolean) returns boolean` : `est_fondateur()` seul, sinon
    `titres: Réservé au fondateur.` (42501) ; écrit ou supprime la ligne ; rend l'état.
  - `public._cases_effectives(p_titre_id bigint) returns jsonb` : titre fixe, chaque page de son niveau à son plafond ;
    sinon ses cases, pages absentes à `non`. Valeurs `non`, `voir`, `modifier`.
  - `public._depasse(p_cases jsonb, p_limite jsonb) returns text` : la première page (ordre de `_pages_du_niveau`) où
    `p_cases` ouvre plus que `p_limite`, nul sinon.
  - `public._refus_titre(p_titre_id bigint, p_lieu_id integer, p_cible text, p_action text, out etat text, out phrase text)`
    (`p_action` : `donner` ou `retirer`) : `etat` et `phrase` nuls si permis ; sinon l'état à lever (`42501` ou `P0001`) et la
    phrase. `p_cible` nul (liste des titres donnables) : les règles 5 et 6 ne jouent pas. Règles, dans cet ordre :
    1. titre introuvable ; centre requis (niveaux promo et centre) ; titre d'un autre centre (`lieu_id` du titre non nul
       et différent) : `titres: Ce titre appartient à un autre centre.` ;
    2. `donner` et titre non fixe et `not titres_ouverts()` : `titres: Ce titre ne peut pas encore être donné.` ;
    3. droit (42501) : Formateur fixe, `geste_centre(l, 'formateurs.nommer')` ; Direction de centre fixe,
       `geste_reseau('directions.nommer')` ; Siège fixe, `est_fondateur()` ; titre de promo non fixe, `case_centre(l,
       'equipe') = 2` ; titre de centre non fixe, `case_centre(l, 'equipe') = 2 or case_reseau('directions') = 2` ; titre
       du réseau non fixe, `case_reseau('directions') = 2` ; `est_fondateur()` passe toujours. Phrases :
       `titres: Réservé à la direction du centre.`, `titres: Réservé au siège.`, `titres: Réservé au fondateur.`,
       `titres: Réservé à l'équipe du centre.` (Équipe sur Modifier), `titres: Réservé au réseau.` (Directions sur Modifier) ;
    4. jamais plus que soi (42501), titres non fixes, même niveau seulement : titre de centre donné par un appelant dont le
       droit vient de son titre de centre (ni `direction_fixe(l)`, ni `case_reseau('directions') = 2`),
       `_depasse(cases du titre, cases de son titre de centre sur l)` ; titre du réseau donné par un appelant sans
       `siege_fixe()`, de même avec son titre du réseau : `titres: Ce titre ouvre plus que le vôtre (<page>).` ;
    5. soi (42501) : cible = appelant, sauf Formateur fixe donné ou retiré par `direction_fixe(l)`, sauf `est_fondateur()` :
       `titres: Vous ne pouvez pas changer vos propres titres.` ;
    6. `donner` seulement : adresse d'un compte qui a une fiche de stagiaire : `titres: Cette adresse est celle d'un compte
       stagiaire.`
  - Aides internes : aucun droit d'exécution ; `titres_ouverts` et `regler_titres_ouverts` : authenticated.

- [ ] **Step 1 : preuve, groupe `verrou`** : `titres_ouverts()` faux au départ ; `dir_n` puis `siege` appellent
  `regler_titres_ouverts(true)` : `ERREUR 42501` ; le fondateur : `true`, puis `false` ; en aperçu siège : `ERREUR 42501` ;
  une ligne `titres_ouverts` sans promo est admise par la contrainte, une clé globale inconnue reste refusée (`23514`).
- [ ] **Step 2 : contre-épreuve** (`gestion --etapes 5`) : ROUGE sur `verrou`.
- [ ] **Step 3 : écrire la partie A et son retour ; vert.** `gestion --etapes 5,6` : `verrou` vert (les aides internes sont
  jugées par les groupes des Tasks 16 et 17).
- [ ] **Step 4 : commit** `Titres, étape 2b, migration 6 (A) : verrou des titres non fixes, règles du § 7 en une aide`.

### Task 16 : Donner et retirer (migration 6, partie B)

**Files:**
- Modify: `supabase/migrations/20261112_titres_6_gestion.sql`, `_retour.sql`, `outils/generer_fragments_titres_6.py`,
  `tests/sql/titres-gestion-preuve.sql`

**Interfaces:**
- Consumes : `_refus_titre`, `_orphelin_en_personnel`, `_profil_formateur`, `retirer_titre` (2a).
- Produces :
  - `public.donner_titre(p_email text, p_titre_id bigint, p_lieu_id integer, p_promo_ids integer[] default null, p_prof_id
    integer default null) returns jsonb` : `{email, titre_id, cree, transforme, remplace, ajoutees, retirees}`.
    - adresse invalide : `titres: Adresse e-mail invalide.` ; `_refus_titre(..., 'donner')` ;
    - promo : `p_promo_ids` non vide (`titres: Choisissez au moins une promo.`), toutes du centre (`titres: Une promo
      choisie n'est pas dans ce centre.`) ; pose exactement ces promos pour ce titre dans ce centre (comme
      `regler_affectations_formateur`) ; centre : une ligne `direction` sur `p_lieu_id` ; réseau : une ligne `siege` ;
    - profil absent : créé (`_profil_formateur` pour un titre de promo ; sinon rôle `prof`, `is_admin` faux, invité par
      l'appelant) ; orphelin : `_orphelin_en_personnel` (`is_admin` vrai pour un titre de promo) ;
    - la personne a déjà un autre titre au même niveau dans ce centre (ou au réseau) : remplacé (T13), après
      `_refus_titre(<ancien>, ..., 'retirer')` ; les lignes de l'ancien titre sont supprimées puis les nouvelles posées
      (le déclencheur refuse un changement de titre de groupe, rapport de la tâche 2) ; `remplace` : l'identifiant de
      l'ancien titre, sinon nul.
  - `retirer_titre`, un fragment : la ligne `titres: Ce titre ne se retire pas encore ici.` et les contrôles 3 à 5 de 2a
    remplacés par l'appel à `_refus_titre(p_titre_id, p_lieu_id, v_cible, 'retirer')` (mêmes phrases pour les titres fixes :
    les cas du groupe `retrait` restent verts à l'identique).

- [ ] **Step 1 : preuve, groupe `donner`** (verrou ouvert en propriétaire après le premier cas ; titres de la preuve :
  Intervenant de promo `t_interv`, `t_secr`, `t_rh` sur le centre de la promo 1, `t_contenus`, `t_qualite` au réseau ;
  appelants `t_chef` et `t_dirs`, Task 9), attendus en dur :
  ```text
  verrou fermé : dir_n donne Intervenant à x (promo 1)              titres: Ce titre ne peut pas encore être donné.
  dir_n se donne Formateur (promo 1)                                 OK
  dir_n donne Direction de centre à x                                ERREUR 42501 Réservé au siège.
  siege se donne Direction de centre (centre 1)                      ERREUR 42501 Vous ne pouvez pas changer vos propres titres.
  siege donne Direction de centre à x (centre 1)                     OK, profil créé (cree vrai)
  siege donne Siège à x                                              ERREUR 42501 Réservé au fondateur.
  t_chef donne Intervenant à y (promos 1 et A)                       OK, ajoutees [1, A]
  t_chef redonne Intervenant à y (promo A seule)                     OK, retirees [1]
  t_chef donne Intervenant à y sur la promo 2                        Une promo choisie n'est pas dans ce centre.
  t_chef donne Formateur à y                                         ERREUR 42501 Réservé à la direction du centre.
  t_chef donne le titre de t_secr (Stagiaires : Modifier) à y        ERREUR 42501 ... plus que le vôtre (stagiaires).
  t_chef donne le titre de t_rh à y                                  OK
  t_chef se donne le titre de t_rh                                   ERREUR 42501 ... vos propres titres.
  t_rh donne le titre de t_rh à z                                    ERREUR 42501 Réservé à l'équipe du centre.
  t_chef donne Intervenant à form_n (Formateur, promo 1)             ERREUR 42501 (remplacer = retirer Formateur)
  dir_n donne Intervenant à form_n (promo 1)                         OK, remplace = Formateur
  t_chef donne un titre à stag_n                                     Cette adresse est celle d'un compte stagiaire.
  t_chef donne un titre à un orphelin                                OK, transforme vrai, rôle prof
  t_dirs donne le titre de t_qualite à z                             OK
  t_dirs donne le titre de t_contenus à z                            ERREUR 42501 ... plus que le vôtre (cours).
  t_dirs donne le titre de t_secr dans le centre 2                   Ce titre appartient à un autre centre.
  t_dirs donne Direction de centre à z                               ERREUR 42501 Réservé au siège.
  fondateur en aperçu siège se donne Direction de centre             ERREUR 42501
  ```
- [ ] **Step 2 : preuve, groupe `retirer`** (titres non fixes) : `t_chef` retire Intervenant de `y` : `OK` ; retire Direction
  de centre de `dir_n` : `ERREUR 42501` ; retire le titre de `t_secr` à `t_secr` : `ERREUR 42501` (plus que le sien) ;
  `t_rh` retire : `ERREUR 42501` ; `t_chef` se retire le sien : `ERREUR 42501` ; groupe `retrait` de 2a : inchangé.
- [ ] **Step 3 : preuve, groupe `immediat`** : `y` (Intervenant, promo 1) lit des lignes de `planning_entries` et ouvre une
  feuille (`emargement_ouvrir`, émargement allumé en propriétaire) ; `t_chef` lui retire le titre ; la demande suivante de
  `y` : 0 ligne et `ERREUR 42501`.
- [ ] **Step 4 : contre-épreuve** (partie A seule) : ROUGE sur `donner`, `retirer`, `immediat`.
- [ ] **Step 5 : écrire la partie B et son retour ; vert.** `gestion --etapes 5,6` : `VERT n/0`.
- [ ] **Step 6 : commit** `Titres, étape 2b, migration 6 (B) : donner_titre, retirer_titre pour tous les titres`.

### Task 17 : Créer, ajuster, supprimer un titre (migration 6, partie C)

**Files:**
- Modify: `supabase/migrations/20261112_titres_6_gestion.sql`, `_retour.sql`, `tests/sql/titres-gestion-preuve.sql`

**Interfaces:**
- Consumes : `_cases_effectives`, `_depasse`, `_cases_valides`.
- Produces :
  - `alter table public.titres drop constraint titres_centre_requis` : un titre de promo ou de centre sans centre est un titre
    du réseau, utilisable dans tous les centres (catalogue § 6.2, T14). Retour : la contrainte remise, garde « aucun titre non
    fixe de promo ou de centre sans centre », sinon arrêt.
  - `public._refus_gestion(p_niveau text, p_lieu_id integer, p_cases jsonb) returns text` : titre de centre (`p_lieu_id` non
    nul, niveau promo ou centre) : `case_centre(p_lieu_id, 'equipe') = 2`, et pour le niveau centre sans `direction_fixe`,
    `_depasse(p_cases, <ses cases de centre>)` nul ; titre du réseau (`p_lieu_id` nul, tout niveau) : `case_reseau('directions')
    = 2`, et pour le niveau réseau sans `siege_fixe()`, `_depasse` nul ; `est_fondateur()` passe toujours. Mêmes phrases
    que `_refus_titre`.
  - `public.creer_titre(p_depuis bigint, p_nom text, p_lieu_id integer) returns bigint` : même niveau que `p_depuis`, cases
    `= _cases_effectives(p_depuis)`, `origine_id` nul, `cree_par` = appelant ; nom vide : `titres: Le nom est requis.` ;
    doublon de portée (casse ignorée, état 23505 rattrapé) : `titres: Un titre de ce nom existe déjà ici.` ;
    `_refus_gestion`.
  - `public.ajuster_titre(p_titre_id bigint, p_lieu_id integer, p_nom text, p_cases jsonb) returns jsonb` :
    `{titre_id, version_creee, porteurs_bascules}`. Titre fixe : `titres: Un titre fixe ne se modifie pas.` ; cases non
    valides : `titres: Ces cases ne sont pas valides.` ; l'appelant porte ce titre (ou sa version) : `titres: Vous ne pouvez
    pas modifier un titre que vous portez.` (42501) ; `_refus_gestion`. Titre du réseau de niveau promo ou centre ajusté avec
    `p_lieu_id` non nul : crée la version du centre (même nom, `origine_id`, `lieu_id`) si elle n'existe pas, y fait passer
    les porteurs de ce centre (suppression puis repose ligne par ligne, T17), rend son identifiant ; sinon modifie le titre
    (`modifie_le`, `modifie_par`).
  - `public.supprimer_titre(p_titre_id bigint) returns void` : fixe : `titres: Un titre fixe ne se supprime pas.` ; porté :
    `titres: Ce titre est encore porté : retirez-le d'abord.` ; `_refus_gestion`.

- [ ] **Step 1 : preuve, groupe `gerer`** (attendus en dur) : `t_chef` crée « Preuve accueil » depuis le titre de `t_rh` sur
  le centre 1 : niveau centre, cases égales, centre 1 ; crée depuis Formateur : niveau promo, huit cases au plafond ; crée
  depuis le titre de `t_secr` : `ERREUR 42501` (plus que le sien) ; même nom en majuscules : `Un titre de ce nom existe
  déjà ici.` ; nom vide : refus ; `t_rh` crée : `ERREUR 42501` ; `t_dirs` crée un titre du réseau depuis celui de
  `t_contenus` : `ERREUR 42501` ; `siege` crée un titre de centre du réseau (sans centre) depuis celui de `t_secr` : `OK`,
  `lieu_id` nul ; `t_chef` ajuste « Preuve accueil » en `{"promos":"voir","equipe":"voir","stagiaires":"voir"}` : `OK` ;
  avec `"stagiaires":"modifier"` : `ERREUR 42501` ; avec `{"notes":"voir"}` : `Ces cases ne sont pas valides.` ; ajuster
  Formateur : refus ; `t_chef` ajuste son propre titre : `ERREUR 42501` ; titre du réseau R (niveau centre, sans centre)
  porté par `u` au centre 1 et `v` au centre 2 : `t_chef` l'ajuste depuis le centre 1 : `version_creee` vrai,
  `porteurs_bascules` 1, `u` porte la version (même nom), `v` porte toujours R ; second ajustement : `version_creee` faux,
  même identifiant ; `supprimer_titre` d'un titre porté : refus ; non porté : `OK` ; d'un titre fixe : refus ; un titre de
  promo du centre 1 créé pour ce cas (Émargement : Modifier, Stagiaires : Voir), donné à `y` : `y` ouvre une feuille ;
  `t_chef` passe Émargement à « Voir » : la demande suivante de `y` (`emargement_ouvrir`) est refusée.
- [ ] **Step 2 : contre-épreuve** (parties A et B seules) : ROUGE sur `gerer`.
- [ ] **Step 3 : écrire la partie C et son retour ; vert.** `gestion --etapes 5,6` : `VERT n/0`.
- [ ] **Step 4 : commit** `Titres, étape 2b, migration 6 (C) : créer, ajuster, supprimer un titre`.

### Task 18 : Les lectures de l'étape 3 (migration 6, partie D)

**Files:**
- Modify: `supabase/migrations/20261112_titres_6_gestion.sql`, `_retour.sql`, `tests/sql/titres-gestion-preuve.sql`

**Interfaces:**
- Produces (lecture seule, `stable`, authenticated ; refus 42501 avec les phrases de `_refus_titre`) :
  - `public.titres_visibles(p_lieu_id integer) returns table(id bigint, nom text, niveau text, lieu_id integer, fixe boolean,
    origine_id bigint, cases jsonb, porteurs integer, donnable boolean)` : centre (`geste_centre(l, 'equipe.lire')`) : les
    titres fixes de promo et de centre, les titres du réseau de niveau promo et centre sans version dans ce centre, ceux du
    centre ; réseau (`p_lieu_id` nul, `geste_reseau('directions.lire')`) : tous les titres sans centre ; fondateur : selon le
    même paramètre. `cases` : `_cases_effectives` ; `porteurs` : adresses distinctes qui le portent dans ce centre (ou dans
    le réseau) ; `donnable` : `_refus_titre(id, p_lieu_id, null, 'donner')` sans refus (verrou compris).
  - `public.mes_titres() returns table(titre_id bigint, nom text, niveau text, lieu_id integer, lieu_nom text, promo_ids
    integer[], cases jsonb)` : une ligne par titre porté par l'appelant (titre de promo : ses promos du centre groupées).
  - `public.personnes_et_titres(p_lieu_id integer default null, p_promo_id integer default null) returns table(email text,
    titre_id bigint, titre_nom text, niveau text, lieu_id integer, promo_ids integer[])` : promo (`geste_promo(p,
    'reglages.modifier') or geste_centre(lieu_de_promo(p), 'equipe.lire')`) : titres de promo sur p et titres de centre de son
    centre ; centre (`geste_centre(l, 'equipe.lire')`) : titres de promo et de centre du centre ; réseau (les deux nuls, `geste_reseau('directions.lire')`) :
    titres de centre et du réseau, jamais de niveau promo.
  - `public.journal_des_droits(p_lieu_id integer default null) returns table(quand timestamptz, par text, action text, pour
    text, titre_nom text, niveau text, lieu_id integer, promo_id integer, avant jsonb, apres jsonb)` : centre,
    `geste_centre(l, 'equipe.lire')`, lignes de ce centre ; réseau, `geste_reseau('directions.lire')`, lignes de niveau centre
    et réseau ; fondateur : tout ; trois ans au plus ; table absente : aucune ligne, aucune erreur.

- [ ] **Step 1 : preuve, groupe `lire`** : `titres_visibles(<centre 1>)` par `t_rh` : Formateur, Direction de centre, les
  titres du centre 1, aucun du centre 2, `donnable` faux partout ; par `t_chef` : `donnable` vrai pour l'Intervenant et le
  titre de `t_rh` (verrou ouvert), faux pour Formateur et pour le titre de `t_secr` ; par `stag_n` et `t_interv` : `ERREUR 42501` ;
  `titres_visibles(null)` par `siege` : aucun titre d'un centre ; `mes_titres()` : `t_interv` une ligne (promos `[1]`,
  cases de son titre), `dir_form` deux lignes aux cases plafond, `stag_n` aucune ; `personnes_et_titres(<centre 1>)` par
  `dir_n` et `t_rh` : mêmes lignes ; par `t_interv` : refus ; `personnes_et_titres(null, 1)` par `form_n` : les titres de
  la promo 1 et du centre 1 ; `personnes_et_titres()` par `siege` : aucune ligne de niveau promo ; par `t_contenus` : refus ;
  `journal_des_droits(<centre 1>)` par `dir_n`, migration 4 absente : 0 ligne, pas d'erreur.
- [ ] **Step 2 : preuve, groupe `journal`** (mode `gestion --etapes 4,5,6` seulement ; sauté sinon, avec une information) :
  `donner_titre` puis `retirer_titre` par `t_chef` : lignes `donne` et `retire`, `par` = son adresse ; `creer_titre`,
  `ajuster_titre`, `supprimer_titre` : `cree`, `ajuste`, `supprime` ; `journal_des_droits(<centre 1>)` par `t_rh` les rend,
  par `t_interv` : refus ; `journal_des_droits()` par `siege` : aucune ligne de niveau promo.
- [ ] **Step 3 : contre-épreuve** (parties A à C) : ROUGE sur `lire`.
- [ ] **Step 4 : écrire la partie D et son retour ; vert.** `gestion --etapes 5,6` puis `--etapes 4,5,6` : `VERT n/0` ;
  `retour` : empreinte d'après les retours égale à celle d'avant.
- [ ] **Step 5 : commit** `Titres, étape 2b, migration 6 (D) : lectures des titres, des personnes et du journal`.

### Task 19 : Répétition, essai à blanc et mise en ligne de 2b

- [ ] **Step 1 : répétition locale.** Base `--titres 1,2,3,5` (production après 2a) ; verdicts `avant-2b/` ; `gestion
  --etapes 6 --compact` (VERT, md5) ; application de la migration 6 ; `gestion-en-ligne` et les dix preuves : égales à
  `avant-2b` (aucune règle touchée par la migration 6 ; seule la contrainte de `settings` et celle de `titres` changent) ;
  retour 6 réel puis les dix preuves : égales. `git diff main --stat -- js` vide. `node --test "tests/*.test.mjs"` vert.
- [ ] **Step 2 : essai à blanc en production, accord explicite de Timy** : la migration 6, ce qu'elle permet et ce qu'elle
  ne permet pas encore (verrou fermé, aucun écran), les verdicts locaux ; contrôle en lecture seule : aucun titre non fixe
  en base, aucune ligne `titres_ouverts`. Expected : `VERT n/0`, md5 égal.
- [ ] **Step 3 : application** (même accord) puis preuves après en production (même liste que la Task 14, Step 4).
  Un ROUGE : retour 6 aussitôt.
- [ ] **Step 4 : traces** : `ROADMAP.md`, en-tête de `POINT-DE-REPRISE.md` ; rapport : aucune entrée Nouveautés (rien de
  visible), robot non joué (aucun fichier de l'app touché).
- [ ] **Step 5 : commit** `Titres, étape 2b en ligne : fonctions de gestion, verrou fermé (<date>)`.

Taille estimée : 2a, migration 5 environ 350 lignes et retour 200, preuve 450, `roles-preuve.sql` 80, app 40 ; 2b, migration
6 environ 750 lignes et retour 150, preuve 900. Six tâches en 2a (9 à 14), cinq en 2b (15 à 19).

## 5. Étape 3 : écrans (grandes lignes)

- **Task A :** page Équipe (`js/views/direction-equipe.js`) : Personnes avec accès en pastilles, Inviter (liste des seuls
  titres donnables), Titres du centre, Ajuster (lignes Non, Voir, Modifier, bandeaux, Stagiaires relevé, « Sa barre »),
  Journal replié ; règles pures dans un module testé (`js/titres-rules.js`).
- **Task B :** page Directions de centre (`js/views/siege-directions.js`) et Réglages du fondateur (`js/views/config.js`).
- **Task C :** menu du compte (« Mon titre », « Ce que je peux faire ») ; barre filtrée par les cases
  (`entreesNavigation` de `js/nav-rules.js` reçoit les cases ; barre du téléphone complétée dans l'ordre, § 10) ; blocs de
  l'accueil selon leur case ; « Personnes avec accès » des Réglages de la promo par titre (remplace `roles_du_personnel`).
- **Task D :** aperçu du fondateur par titre (en-tête `x-apercu-titre`, fondateur seul, ne fait que retirer) : migration
  qui l'ajoute à `case_*` ; robot des parcours et `outils/verifier_navigation.py` avec les profils Secrétariat et
  Intervenant ; banc ; iPhone.

## 6. Étape 4 : catalogue et conditions (grandes lignes)

- **Task A :** migration du catalogue (§ 6.2, six titres du réseau, cases exactes de la spec) ; contrôle `_cases_valides`.
- **Task B :** conditions d'utilisation (`js/legal-data.js`, `VERSION_CONDITIONS`) : nouveaux lecteurs, journal et ses 3
  ans ; version regroupée avec Q4 et Q5 (§ 12). **Avant d'écrire, vérifier où en sont Q4 et Q5** : Q4 est en ligne depuis
  le 10/11 ; si Q5 l'est aussi quand les titres sont prêts, la version des titres sort seule, et le dire à Timy avant.
- **Task C :** pose de `titres_ouverts` (fondateur, après la mise en ligne des conditions) ; Nouveautés pour la direction
  et le siège ; guide de l'assistant (fonction `chatbot`, déploiement avec l'accord de Timy).

## 7. À trancher par Timy

- **T1** Gestes définitifs non cités au § 5.5 : purge des bénévoles par la direction (11/11) et suppression directe d'un
  bénévole. Proposition : titres fixes seuls (Direction de centre pour la purge du centre, Formateur pour la suppression).
- **T2** Droits sans page de la Direction de centre en plus du § 5.6 : lecture du planning et des élèves bénévoles,
  auto-écoles, suivis. Proposition : gardés au seul titre fixe, ajoutés à la liste du § 5.6.
- **T3** Suppression du profil d'un compte stagiaire : « Stagiaires : Modifier » (proposé) ou geste définitif.
- **T4** `notes_stats_groupe` gardée par « Notes et examens » (invisible aujourd'hui).
- **T5** Signalements de QCM et brouillons de l'IA lus sous « Cours et QCM : Modifier » seulement (ils portent l'adresse
  du stagiaire qui signale).
- **T6** `is_admin()` (appelée par la fonction `qcm-ia`) devient « Cours et QCM : Modifier » au lieu de « a un titre sur
  la promo ».
- **T7** Journal : purge à l'écriture des lignes de plus de 3 ans (pas de tâche planifiée).
- **T8** Étape 1 sans entrée Nouveautés (rien de visible).
- **Conditions d'utilisation** (§ 12) : rien avant l'étape 4 ; la date dépend de Q5.

Étape 2 (section 4), propositions retenues provisoirement comme T1 à T8 ; chacune laisse les titres fixes inchangés :
- **T9** `inviter_compte` et `regler_affectations_formateur` gardent leur signature ; l'invitation avec un titre est
  `donner_titre` (écart à la spec § 14 : signatures citées par les preuves des lots 4 et 5, surcharges refusées par PostgREST).
- **T10** `retirer_titre` part en 2a pour les seuls titres fixes ; les titres non fixes s'y ajoutent en 2b.
- **T11** Les lignes d'affectation des formateurs se lisent sous Promos : Voir ou Équipe : Voir (noms des formateurs sur les
  cartes Promos, spec § 5.4) ; entre formateurs d'une même promo, Formateur fixe seulement.
- **T12** `roles_du_personnel()` suit Réglages de la promo, Équipe ou Directions de centre ; les profils du personnel ne se
  lisent au réseau que sous Directions de centre : Voir.
- **T13** Donner un titre à qui en a déjà un autre au même niveau dans le même centre le remplace (avec les règles du retrait
  sur l'ancien), au lieu de refuser.
- **T14** La contrainte `titres_centre_requis` de l'étape 1 est levée : un titre de promo ou de centre sans centre est un
  titre du réseau (catalogue § 6.2).
- **T15** Le fondateur (hors aperçu) échappe à « jamais sur soi » (§ 7 : « Fondateur : tout »).
- **T16** Le verrou `titres_ouverts` bloque le don d'un titre non fixe, à tous, fondateur compris ; il ne bloque ni la
  création ni l'ajustement d'un titre (qui ne changent aucun lecteur tant que personne ne le porte).
- **T17** Le passage des porteurs d'un centre à la version du centre se fait par retrait puis repose des lignes : le journal,
  une fois appliqué, écrira « retire » et « donne » plutôt que « change ».
