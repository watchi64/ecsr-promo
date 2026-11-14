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
(fonctions de gestion, section 4) est détaillée en deux mises en ligne, 2a (sécurité) puis 2b (gestion), toutes deux en ligne.
L'étape 3 (section 5) commence par les correctifs de base décidés par Timy le 12/11 (migration 7 : D1, D4, D5, et M4, M5, M7),
puis livre les écrans (migration 8 : aperçu par titre ; page Équipe, Directions de centre, barre selon les cases, menu du compte),
verrou fermé ; l'étape 4 (section 6) pose le catalogue, les conditions d'utilisation et le journal, dans un ordre de mise en ligne fixé.

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

## 5. Étape 3 : correctifs de base, puis écrans

État de départ (main 283ca245, 14/11) : migrations `20261112_titres_1`, `_2`, `_3`, `_5`, `_6` appliquées en production ; `_4_journal`
dans main, **non appliquée** ; verrou `titres_ouverts` fermé (aucune ligne dans `settings`) ; aucun titre non fixe en base. Les
fonctions de 2b existent et ne servent encore à rien dans l'app (`git grep -n "donner_titre\|titres_visibles\|mes_titres" js` : rien).
E-learning (lot 1) en ligne : `20261114_autonomie_1_traces` et `_2_version` appliquées avec `2026-11-14`, `VERSION_CONDITIONS =
"2026-11-14"`. Q4 et Q5 du dossier Qualiopi en ligne : la version des conditions des titres sort donc seule (spec § 12).

### 5.R Relevé sur main 283ca245 (14/11)

| Ce que la grande ligne supposait | État réel | Conséquence pour le plan |
|---|---|---|
| Page Équipe : on y ajoute titres, invitation, éditeur, journal | `js/views/direction-equipe.js` (300 lignes) : une table « Direction et formateurs » (`lireEquipeDuCentre`, l. 444 de `js/db.js`, qui lit `affectations` en direct), « Inviter un formateur », « Modifier » et « Retirer du centre », tous par `regler_affectations_formateur` ; `ouvrirFormulaire` y est exporté et sert aussi au siège | la page est réécrite par sections (Task 31) ; `ouvrirFormulaire` reste exporté, inchangé ; `regler_affectations_formateur` n'est plus appelé par l'app (M3) |
| Page Directions de centre : même organisation | `js/views/siege-directions.js` (198 lignes) : une section par centre, « Inviter une direction » par `inviteUser` (`inviter_compte`), « Retirer » par `retirerTitre` (2a), « Ajouter un centre » | invitation par `donner_titre`, titres du réseau, journal (Task 32) |
| Réglages du fondateur : invitation siège avec un titre du réseau | `js/views/config.js` l. 64 à 87 : rôle « Siège » offert au fondateur hors aperçu dans « Accès et invitations », par `inviteUser` ; aucun réglage du verrou | choix d'un titre du réseau par `donner_titre`, bouton du verrou (Task 32) |
| « Personnes avec accès » par titre | `config.js` l. 53 et 147 : `lireRolesDuPersonnel` (`roles_du_personnel`, `js/db.js` l. 1775), `listeAcces` et `pastillesDuProfil` (`js/roles-rules.js` l. 132 à 156) | `personnes_et_titres(null, promo)` remplace `roles_du_personnel` à l'écran ; la fonction reste en base (Task 32) |
| `entreesNavigation` reçoit les cases | `js/nav-rules.js` l. 132 : filtres `emargementActif`, `formateur`, `emargementDansLeCentre`, `reglagesEspace` ; `barreTelephone` (l. 153) garde une liste fixe sans compléter | nouveau paramètre `cases` ; la barre du téléphone se complète (spec § 10) ; titres fixes : sorties identiques (Task 29) |
| `js/roles-rules.js` | `droitsReels` (l. 32) : `admin = (fondateur et is_admin) ou roles.includes("formateur")` ; la colonne `roles` de `mes_promos` ne distingue pas un titre fixe d'un titre non fixe | M5 : `admin` exige le titre fixe Formateur sur la promo (Task 27) |
| Accueil : blocs selon les cases | `js/views/aujourdhui.js` l. 274 à 283 : Émargement et À traiter sous `isAdmin()`, « À suivre de près » sans condition ; `js/views/direction-centre.js` (Vue d'ensemble) : « Assiduité et abandons », « Résultats », comparaison, « À suivre », thèmes, sans condition ; `js/views/siege-reseau.js` : chiffres agrégés | Task 30 : chaque bloc suit sa case ; l'accueil du siège ne change pas (spec § 5) |
| Écriture d'une page selon « Voir » / « Modifier » | 60 appels `isAdmin()` dans 21 fichiers (`a-traiter.js`, `emargement-bandeau.js`, `planning.js`, `notes.js`, `themes.js`, `dp.js`, `epcf-livret.js`...) ; les vues de la direction n'ont aucune condition d'écriture | Task 30 : `peutModifier(page)` remplace `isAdmin()` là où il garde une écriture de page ; vues de la direction gardées par les cases du centre |
| Menu du compte : « Mon titre », « Ce que je peux faire » | `js/menu-compte.js` (140 lignes) : section Espace, aperçu (`buildViewAsBlock`, `js/auth-admin.js` l. 612), aucun titre | Task 29 |
| Aperçu du fondateur par titre | en-tête `x-apercu-role` seul (`apercu_role()`, `20261028_roles_1_fondations.sql` l. 57) ; `case_promo`, `case_centre`, `case_reseau` donnent le plafond en aperçu ; `mes_titres()` rend en aperçu les vrais titres du fondateur (M10) | migration 8 (Task 25) |
| Banc | `_harness_supabase.js` (2 635 lignes, hors git, dans `C:/Users/watch/Dev/ECSR/TP_ECSR_App`) : comptes `direction`, `dirform`, `direction-vide`, `dirailleurs`, `siege`, `cumul` ; RPC `retirer_titre` (titres fixes), `roles_du_personnel`, `regler_affectations_formateur` ; aucune des fonctions de 2b | Task 28 : copie dans le worktree, onze RPC, comptes `secretariat` et `intervenant` ; la coordination rapporte le banc dans le dossier partagé (le fusionner, ne pas le recopier) |
| Robot et vérificateur | `outils/parcours/` : `direction.py`, `siege.py`, `equipe.py`... ; `outils/verifier_navigation.py` (6 417 lignes) : scénarios par `compte=` (l. 1894, 1983), aucun profil par titre | Task 33 : parcours `titres.py`, scénarios `secretariat` et `intervenant` |
| Base locale au niveau de la production | `outils/base_locale/rejouer_suite.sh` : `--titres` cherche `20261112_titres_<n>_*` seulement ; la suite s'arrête aux contacts du 13/11 ; **les migrations de l'e-learning n'y sont pas** ; les preuves de l'e-learning appliquent la leur à la main | Task 20 : option `--production` (titres 1, 2, 3, 5, 6 ; contacts ; e-learning 1 et 2 avec `2026-11-14`), `--titres` jusqu'à 9 |
| Guide de l'assistant | `supabase/functions/chatbot/aide.mjs` : `AIDE_APP`, `AIDE_APP_DIRECTION` (l. 70, ligne `equipe` l. 83 : « Inviter un formateur »), `AIDE_APP_SIEGE` (l. 99) | Task 38 |
| Nouveautés | `js/nouveautes-data.js` : `pour` admet `direction` et `siege` ; ton : formateurs, direction, siège au vouvoiement | une entrée à l'étape 3 (règle du projet : chaque mise en ligne visible porte la sienne), deux à l'étape 4 |
| Conditions : nouveaux lecteurs au tutoiement pour les stagiaires | `js/legal-data.js` vouvoie partout, stagiaires compris (« Vos notes », « vous ») | le texte de l'étape 4 suit le fichier : vouvoiement (écart au cahier des charges, signalé à Timy) |

### 5.D Décisions et propositions de l'étape 3

**Décisions de Timy du 12/11 (base, avant toute ouverture du verrou), migration `20261115_titres_7_correctifs` :**

- **D1, règle exacte.** `_refus_gestion` (créer, ajuster, supprimer) devient :
  1. fondateur hors aperçu : permis ;
  2. titre d'un centre de niveau promo (`p_lieu_id` donné) : `case_centre(l, 'equipe') = 2`, sinon `titres: Réservé à l'équipe du centre.` (inchangé) ;
  3. titre d'un centre de niveau centre : `case_centre(l, 'equipe') = 2 or siege_fixe()` (au lieu de `case_reseau('directions') = 2`),
     sinon la même phrase ; « jamais plus que soi » sauf `direction_fixe(l) or siege_fixe()` (au lieu de `case_reseau(...) = 2`) ;
  4. titre du réseau de niveau promo ou centre (`p_lieu_id` nul) : `siege_fixe()`, sinon `titres: Réservé au siège.` ;
  5. titre du réseau de niveau réseau : inchangé (`case_reseau('directions') = 2`, « jamais plus que soi » sauf `siege_fixe()`).
  `_refus_titre` (donner, retirer) ne change pas : un titre non fixe « Directions de centre : Modifier » garde le don et le retrait des
  titres de centre existants, dans tous les centres. **Écarts à signaler** : le tableau du § 7 de la spec (« Autre titre du réseau :
  ... créer, ajuster ») est restreint par D1 ; la règle 4 couvre aussi la **création** d'un titre du réseau de niveau promo (D1 ne cite
  que son ajustement) : proposé par cohérence, à confirmer par Timy (Task 21 le prouve dans les deux sens, une ligne à retirer s'il dit non).
- **D4, choix : index unique partiel ET verrou de ligne.** `create unique index titres_version_unique on public.titres (origine_id,
  lieu_id) where origine_id is not null` garantit, pour tout chemin présent ou futur (fonction, écriture du propriétaire), qu'un
  centre n'a qu'une version d'un titre du réseau : c'est la garantie. Le verrou (`perform 1 from titres where id = p_titre_id for
  update` avant la recherche de la version) n'en est pas une (un chemin qui l'oublie y échappe), mais il rend le second ajustement
  simultané juste au lieu de le refuser : il attend, voit la version et la modifie (« un second ajustement modifie la version », groupe
  `gerer` de 2b). Si l'index se déclenche quand même, la phrase est `titres: Ce titre vient d'être ajusté pour ce centre par une
  autre personne : rouvrez-le, puis réessayez.` (nom de contrainte lu par `get stacked diagnostics`).
- **D5.** Chaque retour de 6, 7, 8 et 9 commence par une garde : s'il existe une affectation dont le titre n'est pas fixe, il
  s'arrête sans rien changer avec `<migration>_retour : % affectation(s) portent un titre non fixe ; les retirer d'abord (page Équipe
  ou Directions de centre) ; rien n'est changé`.
- **D2, D3, D6** : rien à coder (verrou sur le seul don ; seconde adresse acceptée ; T1 à T17 gardées).

**Restes du rapport de 2b (propositions de Claude) :**

- **M3** `regler_affectations_formateur` échoue en `23514` quand la personne porte un titre de promo non fixe dans le centre (le
  déclencheur refuse deux titres de promo). Proposition : l'app n'appelle plus cette fonction ; inviter, modifier les promos et
  retirer passent par `donner_titre` (qui remplace l'ancien titre, T13) et `retirer_titre`. La fonction reste en base, inchangée
  (les preuves des lots 4 et 5 la citent). Aucun changement de base.
- **M4** `p_prof_id` relie une fiche formateur pour tout titre de promo. Migration 7 : relié seulement pour le titre fixe Formateur ;
  `donner_titre` refuse `p_prof_id` non nul pour un autre titre : `titres: Une fiche formateur ne se relie qu'au titre Formateur.`
- **M5** `is_admin` vrai pour un titre de promo non fixe (par `_profil_formateur` et `_orphelin_en_personnel`). Migration 7 : `is_admin`
  vrai seulement pour le titre fixe Formateur (profil créé comme celui d'un titre de centre : rôle `prof`, `is_admin` faux) ; app
  (Task 27) : le drapeau `admin` exige le titre fixe Formateur sur la promo ; l'espace vient du niveau du titre (une affectation
  `formateur`, donc un titre de promo, ouvre l'espace Formateur, comme aujourd'hui).
- **M7** Nom d'un titre non fixe égal à celui d'un titre du réseau visible. Migration 7, dans `creer_titre` et `ajuster_titre` (le nom
  seulement ; la version d'un titre du réseau garde son nom) : un titre de centre ne prend pas le nom d'un titre du réseau non fixe
  (`titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.`) ; un titre du réseau ne prend pas le nom d'un titre créé
  par un centre (`titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.`). La table garde ses index (la preuve de
  l'étape 1, « un titre de centre du même nom qu'un titre du réseau : permis », reste verte : c'est une écriture du propriétaire).
- **M10** `mes_titres()` en aperçu rend les vrais titres du fondateur. Migration 8 : en aperçu, une seule ligne, le titre simulé
  (§ 5.D, aperçu par titre) ; en aperçu stagiaire, aucune.

**Aperçu par titre (spec § 10 et § 14), migration `20261115_titres_8_apercu` :** un second en-tête, `x-apercu-titre` (identifiant
du titre), lu par `apercu_titre()` seulement pour le fondateur, en aperçu `formateur`, `direction` ou `siege`, quand le titre existe,
que son niveau est celui de l'aperçu (formateur : promo, direction : centre, siège : réseau) et qu'il est du réseau ou du centre
affiché. Il ne fait que retirer : `case_*` donnent les cases du titre (bornées au plafond) au lieu du plafond, et `formateur_fixe`,
`direction_fixe`, `siege_fixe` deviennent faux pour un titre non fixe. Sans en-tête, l'aperçu d'aujourd'hui (titre fixe). La même
migration ajoute la lecture `titres_ajustables(p_lieu_id)` (les titres que l'appelant peut ajuster et supprimer : l'écran n'offre
« Ajuster » que là ; `_refus_gestion` et « jamais sur soi », mêmes règles qu'`ajuster_titre`).

### 5.F Fichiers de l'étape 3

| Fichier | Rôle |
|---|---|
| `outils/base_locale/rejouer_suite.sh`, `LISEZMOI.md` | `--production`, `--titres` 1 à 9 (date quelconque), `--autonomie 1[,2]` |
| `tests/sql/titres-gestion-aides.sql` (créé), `tests/sql/titres-gestion-preuve.sql` | personnages de l'étape 2 sortis de la preuve de gestion ; retrait des titres non fixes avant le retour 6 (D5) |
| `tests/sql/titres-suite-preuve.sql` (créé), `tests/sql/titres-concurrence.sh` (créé) | preuve des migrations 7, 8, 9 (groupes `structure`, `d1`, `d4`, `d5`, `m4m5`, `m7`, `apercu`, `ajustables`, `catalogue`, `journal_suite`, `retour`) ; deux sessions pour D4 |
| `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs` | modes `suite [--etapes ...]`, `suite-contre-epreuve`, `suite-en-ligne` |
| `outils/generer_fragments_titres_7.py`, `outils/generer_fragments_titres_8.py` | blocs de fragments, aller et retour d'une seule source ; les fonctions remplacées en entier sont relues dans le fichier de la migration 6 |
| `supabase/migrations/20261115_titres_7_correctifs.sql` et `_retour.sql` | D1, D4, M4, M5, M7, garde D5 |
| `supabase/migrations/20261112_titres_6_gestion_retour.sql` | garde D5 en tête |
| `supabase/migrations/20261115_titres_8_apercu.sql` et `_retour.sql` | aperçu par titre, `mes_titres` en aperçu, `titres_ajustables` |
| `js/titres-rules.js` (créé), `tests/titres-rules.test.mjs` (créé) | règles pures des écrans |
| `js/db.js`, `js/auth-admin.js`, `js/roles-rules.js`, `tests/roles-rules.test.mjs` | lectures et gestes des titres, cases de la session, `peutVoir`, `peutModifier`, M5, aperçu par titre |
| `js/nav-rules.js`, `tests/nav-rules.test.mjs`, `js/main.js`, `js/menu-compte.js` | barre filtrée, barre du téléphone complétée, Mon titre, Ce que je peux faire, choix du titre en aperçu |
| les vues de la Task 30 | écriture selon la case de la page, blocs de l'accueil |
| `js/views/direction-equipe.js`, `js/views/siege-directions.js`, `js/views/config.js`, `js/views/titres-editeur.js` (créé), `css/` (feuille des pages Équipe) | écrans du § 11 |
| `_harness_supabase.js` (banc, hors git) | RPC des titres, comptes `secretariat` et `intervenant` |
| `outils/parcours/titres.py` (créé), `outils/parcours/connus.py`, `outils/robot_parcours.py`, `outils/verifier_navigation.py` | parcours et profils par titre |
| `js/nouveautes-data.js` | une entrée (direction et siège) |

### Global Constraints (étape 3, en plus de celles du haut et de l'étape 2)

- Écrans : une chose à un endroit, sobre « à la Apple » ; jamais de défilement horizontal (tableaux en listes par `tableauEnListe`) ;
  cibles de 44 px sur téléphone ; icônes au trait de `js/icons.js` ; contraste AA ; jamais `confirm()`, `prompt()` ni `alert()` :
  `confirmer` et `demander` de `js/confirmer.js` ; refus de la base montrés par `phraseDeRefus` (préfixe `titres:` retiré), panne
  réseau par `PHRASE_CONNEXION` (`js/espaces-rules.js`).
- Textes de l'équipe au vouvoiement ; « Formateur », jamais « prof » à l'écran ; adresses fictives `@exemple.invalid` dans les tests
  et le banc.
- **Zéro changement pour un titre fixe** : avec `mes_titres()` qui ne rend que des titres fixes, chaque fonction pure nouvelle rend
  exactement ce que rendait l'ancienne (entrées, barre du téléphone, drapeaux, boutons) ; chaque test le pose explicitement.
- **Repli** : `mes_titres()` absente ou en panne laisse l'app d'aujourd'hui (cases nulles, tout au plafond) ; la base refuse de toute
  façon ce qui dépasse.
- Un fichier `js/` modifié prend le jeton de cache du crochet de main (ne pas le poser à la main).

### Review Focus (étape 3)

1. **L'aperçu par titre échappe au fondateur** : un compte non fondateur qui envoie `x-apercu-titre` ne change rien ; le fondateur en
   aperçu « Intervenant » ne gagne jamais un droit que l'aperçu Formateur n'a pas (Task 25, groupe `apercu`).
2. **La version de centre en double** sous deux ajustements simultanés, y compris avec deux noms différents (Task 22, script de
   concurrence, mutants).
3. **Un retour joué alors qu'un titre non fixe est porté** (Task 24, groupe `d5`) : rien ne change, la phrase le dit.
4. **Un Secrétariat qui garde un bouton d'écriture** sur une page en « Voir » après un ajustement : la base refuse, l'écran dit la
   phrase (Task 30, test `peutModifier` ; Task 33, parcours « Voir n'écrit pas »).
5. **La barre du téléphone d'un titre fixe** qui changerait d'une entrée (Task 29, tests d'égalité pour les quatre espaces).

---

### 5.0 Correctifs de base D1, D4, D5 (et M4, M5, M7)

### Task 20 : Outils de l'étape 3 (base locale de production, preuve de la suite, assembleur)

**Files:**
- Modify: `outils/base_locale/rejouer_suite.sh`, `outils/base_locale/LISEZMOI.md`, `tests/sql/titres-gestion-preuve.sql`,
  `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs`
- Create: `tests/sql/titres-gestion-aides.sql`, `tests/sql/titres-suite-preuve.sql`

**Interfaces:**
- Produces :
  - `rejouer_suite.sh [--port N] [--titres L] [--autonomie 1|1,2] [--production]` : `--titres` cherche
    `2026111?_titres_<n>_*` (n de 1 à 9) ; `--autonomie 1,2` joue `20261114_autonomie_1_traces` puis `20261114_autonomie_2_version`
    avec `-v version=2026-11-14`, après les contacts ; `--production` vaut `--titres 1,2,3,5,6 --autonomie 1,2`. Sans ces options, la
    sortie d'aujourd'hui (les en-têtes des preuves de l'e-learning restent justes).
  - `tests/sql/titres-gestion-aides.sql` : `poser_titres_gestion` et les aides qu'elle appelle, sorties telles quelles de
    `titres-gestion-preuve.sql`, qui l'inclut (`-- @@INCLURE tests/sql/titres-gestion-aides.sql@@`).
  - `pg_temp.retirer_titres_non_fixes()` (dans `titres-gestion-aides.sql`) : en propriétaire, supprime les affectations dont le titre
    n'est pas fixe ; `titres-gestion-preuve.sql` l'appelle juste avant d'injecter le retour 6.
  - `tests/sql/titres-suite-preuve.sql` : même forme que `titres-gestion-preuve.sql` (empreinte avant, migrations 7, 8, 9 en
    `-- @@INJECTER ...@@`, groupes, `retirer_titres_non_fixes()`, retours 9, 8, 7, groupe `retour`, verdict par `verdict_titres`).
    Personnages propres, posés en propriétaire par `pg_temp.poser_titres_suite()` après `poser_titres_gestion()` : `R` (titre du
    réseau de niveau centre, sans centre, `{"promos":"voir","equipe":"voir"}`, porté par `u` au centre 1 et `v` au centre 2) et
    `R_promo` (titre du réseau de niveau promo, sans centre, `{"planning":"voir","stagiaires":"voir"}`, non porté).
    Groupe `structure` : `donner_titre`, `_refus_gestion`, `titres_ouverts` existent (migration 6 appliquée). Un groupe dont la
    migration n'est pas là est sauté avec une information en mode `suite-en-ligne`, compté en échec dans les modes injectés ; les
    groupes qui demandent le journal (`journal_suite`) sont sautés avec une information si `journal_droits` n'existe pas.
  - Modes : `suite [--etapes 7|7,8|7,8,9|8|8,9|9]` (défaut `7,8,9` ; une étape absente du disque : arrêt avec message),
    `suite-contre-epreuve`, `suite-en-ligne` (rien d'injecté).

- [ ] **Step 1 : base de production.** `bash outils/base_locale/reconstruire.sh && bash outils/base_locale/rejouer_suite.sh
  --production`. Expected : `OK : suite rejouée (23 migrations)`.
- [ ] **Step 2 : verdicts de départ** dans `.base-locale/verdicts/avant-3/` : `titres-en-ligne`, `gestion-en-ligne`, `en-ligne`
  (rôles), `espaces-en-ligne`, `donnees-en-ligne`, EPCF et profils `en-ligne`, questionnaires, registre qualité, conservation,
  habillage, contacts (`node outils/assembler_preuve_contacts.mjs en-ligne`), e-learning (`tests/sql/autonomie-preuve.sql` en
  ligne). Expected : `VERT` partout, comptes notés dans le rapport de la tâche (la référence de toute comparaison de l'étape 3).
  `autonomie-version-preuve.sql` exige la migration 2 non appliquée : la jouer sur une base `--titres 1,2,3,5,6 --autonomie 1`.
- [ ] **Step 3 : aides partagées et garde du retour.** Déplacer `poser_titres_gestion` ; ajouter `retirer_titres_non_fixes()` avant
  l'injection du retour 6. Run : `gestion-en-ligne` sur la base du Step 1, et `gestion --etapes 6` sur une base `--titres 1,2,3,5`.
  Expected : mêmes comptes par groupe qu'avant le déplacement.
- [ ] **Step 4 : assembleur.** Tests ajoutés : chaque mode `suite*` a ses marqueurs ; `suite --etapes 7,9` refusé ; `suite` ne lit
  pas un fichier d'une étape non demandée. Run : `node --test tests/assembler-roles.test.mjs`. Expected : PASS.
- [ ] **Step 5 : gabarit et contre-épreuve.** Le gabarit ne porte que `structure` et `retour`. Run : `suite-contre-epreuve` sur la
  base du Step 1. Expected : `VERT` (prérequis présents) ; `suite --etapes 7` refusé tant que la migration 7 manque.
- [ ] **Step 6 : commit** `Titres, étape 3 : outils (base locale de production, preuve de la suite)`.

### Task 21 : D1, qui crée et ajuste les titres de centre (migration 7, partie A)

**Files:**
- Create: `supabase/migrations/20261115_titres_7_correctifs.sql`, `_retour.sql`, `outils/generer_fragments_titres_7.py`
- Modify: `tests/sql/titres-suite-preuve.sql`

**Interfaces:**
- Consumes : `case_centre`, `case_reseau`, `direction_fixe`, `siege_fixe`, `_depasse`, `_cases_appelant` (étapes 1 et 2).
- Produces : `public._refus_gestion(p_niveau text, p_lieu_id integer, p_cases jsonb) returns text`, même signature, remplacée en
  entier (`create or replace`) selon la règle D1 du § 5.D ; le retour remet le texte de `20261112_titres_6_gestion.sql`, extrait
  du fichier par `generer_fragments_titres_7.py retour` (jamais réécrit de mémoire). Aucun droit d'exécution (inchangé).

- [ ] **Step 1 : preuve, groupe `d1`** (personnages de `titres-gestion-aides.sql`, verrou ouvert en propriétaire ; attendus en dur) :
  ```text
  t_dirs (réseau, Directions : Modifier) crée un titre de centre au centre 1 depuis t_secr   ERREUR 42501 Réservé à l'équipe du centre.
  t_dirs ajuste le titre de t_rh (centre 1)                                                   ERREUR 42501 Réservé à l'équipe du centre.
  t_dirs crée un titre du réseau de niveau centre depuis t_secr                              ERREUR 42501 Réservé au siège.
  t_dirs ajuste un titre du réseau de niveau promo (R_promo, sans centre)                    ERREUR 42501 Réservé au siège.
  t_dirs crée un titre du réseau de niveau promo depuis t_interv                             ERREUR 42501 Réservé au siège.
  t_dirs supprime un titre du réseau de niveau centre non porté                              ERREUR 42501 Réservé au siège.
  t_dirs donne le titre de t_secr à z au centre 1 (inchangé, § 7)                            OK
  t_dirs retire ce titre à z (inchangé)                                                      OK
  t_dirs crée un titre de niveau réseau depuis t_qualite                                     OK
  siege crée un titre de centre au centre 1 depuis t_secr                                     OK
  siege crée puis ajuste un titre du réseau de niveau promo                                   OK, OK
  dir_n crée et ajuste un titre de centre au centre 1 (au-delà de ses cases : fixe)          OK, OK
  t_chef (Équipe : Modifier) crée depuis t_rh au centre 1                                    OK
  fondateur en aperçu siège crée un titre du réseau de niveau centre                         OK (aperçu siège = siège fixe)
  ```
  La ligne « t_dirs crée un titre du réseau de niveau promo » porte le commentaire `-- D1 étendu à la création : à retirer si Timy dit non`.
- [ ] **Step 2 : contre-épreuve.** `suite-contre-epreuve` : ROUGE sur `d1` (les six premiers cas passent aujourd'hui).
- [ ] **Step 3 : écrire la partie A et son retour** (la garde D5 du retour 7 vient à la Task 24).
- [ ] **Step 4 : vert.** `suite --etapes 7` : `d1` vert.
- [ ] **Step 5 : mutant.** Sur la base locale, la migration 7 appliquée, remettre à la main `case_reseau('directions') = 2` dans la
  règle 3 de `_refus_gestion` ; rejouer `suite-en-ligne` : ROUGE sur les deux premiers cas. Reconstruire.
- [ ] **Step 6 : commit** `Titres, correctifs (D1) : seuls le siège et le fondateur créent et ajustent les titres de centre du réseau`.

### Task 22 : D4, une seule version de centre (migration 7, partie B)

**Files:**
- Modify: `supabase/migrations/20261115_titres_7_correctifs.sql`, `_retour.sql`, `outils/generer_fragments_titres_7.py`,
  `tests/sql/titres-suite-preuve.sql`
- Create: `tests/sql/titres-concurrence.sh`

**Interfaces:**
- Produces :
  - garde : aucune paire `(origine_id, lieu_id)` en double (sinon arrêt, rien de changé) ; `create unique index
    titres_version_unique on public.titres (origine_id, lieu_id) where origine_id is not null` ; retour : `drop index`.
  - `ajuster_titre`, trois fragments (texte de la migration 6, chacun trouvé exactement une fois, retours chariot suivis) :
    déclaration `v_contrainte text;` après `  v_bascules integer := 0;` ; `perform 1 from titres where id = p_titre_id for update;`
    avant `  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then` suivi de
    `    select ti.id into v_version` ; le gestionnaire `exception when unique_violation` lit `constraint_name` et lève la phrase D4
    pour `titres_version_unique`, l'ancienne phrase sinon.
  - `tests/sql/titres-concurrence.sh --port N` : même garde de base locale que `tests/sql/autonomie-concurrence.sh` (127.0.0.1, comptes
    `@local.test` seuls, sinon code 3) ; pose en le validant un titre du réseau R (niveau centre) porté au centre 1, ouvre deux
    sessions `t_chef`, la première ajuste R depuis le centre 1 avec le nom « Preuve A » et attend (`pg_sleep(2)` avant `commit`), la
    seconde ajuste R avec « Preuve B » ; puis compte les versions de R au centre 1, retire ses données ; sortie `VERT` ou `ROUGE`.

- [ ] **Step 1 : preuve, groupe `d4`** (une session) : deux ajustements successifs de R depuis le centre 1 : `version_creee` vrai puis
  faux, même identifiant ; une seconde version posée en propriétaire pour (R, centre 1) : `ERREUR 23505` ; l'index existe et porte
  le prédicat `origine_id IS NOT NULL`.
- [ ] **Step 2 : concurrence.** Run : `bash tests/sql/titres-concurrence.sh --port 55435` sur la base `--production` sans la
  migration 7. Expected : `ROUGE` (deux versions). Avec la migration 7 : `VERT`, une version, la seconde session rend `version_creee`
  faux et la version porte le nom « Preuve B ».
- [ ] **Step 3 : écrire la partie B et son retour ; vert.** `suite --etapes 7` : `d4` vert.
- [ ] **Step 4 : mutants.** (a) migration 7 sans le verrou : le script rend `VERT` (une version) et la seconde session reçoit la phrase
  D4 ; (b) sans l'index ni le verrou : `ROUGE`. Reconstruire après chaque mutant.
- [ ] **Step 5 : commit** `Titres, correctifs (D4) : une seule version de centre par titre du réseau, même sous deux ajustements simultanés`.

### Task 23 : M4, M5, M7 (migration 7, partie C)

**Files:**
- Modify: `supabase/migrations/20261115_titres_7_correctifs.sql`, `_retour.sql`, `outils/generer_fragments_titres_7.py`,
  `tests/sql/titres-suite-preuve.sql`

**Interfaces:**
- Produces (fragments, mêmes signatures, mêmes droits) :
  - `donner_titre` : l'appel `_orphelin_en_personnel(v_email, t.niveau = 'promo', case when t.niveau = 'promo' then p_prof_id end,
    v_moi)` passe à `t.niveau = 'promo' and t.fixe` aux deux places ; `if t.niveau = 'promo' then` suivi de `v_cree :=
    _profil_formateur(` passe à `if t.niveau = 'promo' and t.fixe then` (un titre de promo non fixe crée le profil de la branche
    `else` : `prof`, `is_admin` faux) ; après la levée de `_refus_titre`, refus `titres: Une fiche formateur ne se relie qu'au titre
    Formateur.` si `p_prof_id` est donné et que le titre n'est pas le Formateur fixe.
  - `creer_titre`, avant `  v_cases := _cases_effectives(p_depuis);` : si `v_lieu` est donné, refus M7 réseau quand un titre non fixe
    sans centre porte `lower(v_nom)` ; si `v_lieu` est nul, refus M7 centre quand un titre d'un centre non issu d'un autre
    (`origine_id` nul) porte ce nom.
  - `ajuster_titre`, quand `v_nom` est donné, après le refus des noms fixes : mêmes deux refus, en écartant le titre lui-même, sa racine
    et ses versions (`coalesce(origine_id, id) <> t.racine`).

- [ ] **Step 1 : preuve, groupe `m4m5`** : `t_chef` donne Intervenant (`t_interv`) à `x` avec `p_prof_id` : refus M4, aucun profil
  créé ; sans fiche : `OK`, profil `prof`, `is_admin` faux ; à l'orphelin : `transforme` vrai, `is_admin` faux ; `dir_n` donne
  Formateur à `y` avec une fiche libre : `OK`, `is_admin` vrai, `prof_id` relié (inchangé) ; `regler_affectations_formateur` de `dir_n`
  sur `form_m` : réponses de 2b à l'identique.
- [ ] **Step 2 : preuve, groupe `m7`** : `t_chef` crée « Secrétariat » au centre 1 alors qu'un titre du réseau « secrétariat » non fixe
  existe : refus M7 réseau ; `siege` crée au réseau un titre du nom d'un titre créé par le centre 1 : refus M7 centre ; `t_chef` ajuste
  la version de centre de R (même nom que R) : `OK` ; renomme un titre de centre en « Qualité » (titre du réseau) : refus ; nom libre :
  `OK`.
- [ ] **Step 3 : contre-épreuve** (parties A et B seules) : ROUGE sur `m4m5` et `m7`.
- [ ] **Step 4 : écrire la partie C et son retour ; vert.** `suite --etapes 7` : `VERT n/0` ; `gestion-en-ligne` sur la base
  `--production` + migration 7 : comptes de `avant-3/`, sauf un cas de `gerer` dont D1 change la réponse : il devient dépendant de
  l'état de la base (`pg_get_functiondef('public._refus_gestion(text, integer, jsonb)'::regprocedure) like '%siege_fixe()%'`, la
  signature ne changeant pas) et le rapport le nomme.
- [ ] **Step 5 : commit** `Titres, correctifs (M4, M5, M7) : fiche et is_admin au seul Formateur, noms sans doublon visible`.

### Task 24 : D5, répétition et mise en ligne de la migration 7

**Files:**
- Modify: `supabase/migrations/20261112_titres_6_gestion_retour.sql`, `20261115_titres_7_correctifs_retour.sql`, `tests/sql/titres-suite-preuve.sql`,
  `tests/sql/titres-gestion-preuve.sql`

**Interfaces:**
- Produces : en tête des retours 6 et 7, un bloc `do $garde_d5$` qui compte `affectations a join titres t on t.id = a.titre_id
  where not t.fixe` et lève la phrase D5 s'il en trouve.

- [ ] **Step 1 : preuve, groupe `d5`** (suite et gestion) : un titre non fixe porté, le retour 7 joué dans une sous-transaction :
  refus avec la phrase, `md5` des définitions de `_refus_gestion` et `ajuster_titre` inchangé ; même chose pour le retour 6 dans la
  preuve de gestion ; `retirer_titres_non_fixes()` puis retour : passe.
- [ ] **Step 2 : contre-épreuve, garde et vert.** Groupe `d5` ROUGE sans la garde ; écrire les deux gardes ; `suite --etapes 7` et
  `gestion --etapes 6` (base `--titres 1,2,3,5`) : `VERT n/0`.
- [ ] **Step 3 : répétition locale.** Base `--production` ; `suite --etapes 7 --compact` (VERT, md5 noté) ; application `psql -1 -v
  ON_ERROR_STOP=1 -f` de la migration 7 ; `suite-en-ligne` et les preuves de `avant-3/` (`apres-7/`) : égales hors `gerer`
  (annoncé) ; retour 7 réel : égales à `avant-3/`. `git diff main --stat -- js` vide ; `node --test "tests/*.test.mjs"` vert.
- [ ] **Step 4 : commit** `Titres, correctifs (D5) : un retour s'arrête tant qu'un titre non fixe est porté`.
- [ ] **Step 5 : préparer et signaler.** Rapport à la coordination : la migration 7, ce qu'elle change (aucun écran, aucun compte
  existant : seul un titre non fixe, absent de la production, est concerné), les verdicts locaux, le texte `--compact` et son md5.
  L'essai à blanc (`outils/psql_prod.sh`, par Timy ou avec son accord explicite), l'application et les preuves après en production
  (`suite-en-ligne`, `gestion-en-ligne`, `titres-en-ligne`, rôles, espaces, données, EPCF, profils, questionnaires, registre,
  conservation, contacts, e-learning) sont faits par la coordination ; un ROUGE : retour 7 aussitôt.

### 5.1 Écrans

### Task 25 : Aperçu par titre, `mes_titres` en aperçu, `titres_ajustables` (migration 8)

**Files:**
- Create: `supabase/migrations/20261115_titres_8_apercu.sql`, `_retour.sql`, `outils/generer_fragments_titres_8.py`
- Modify: `tests/sql/titres-suite-preuve.sql`

**Interfaces:**
- Consumes : `apercu_role`, `fondateur_reel`, `promo_courante`, `lieu_courant`, `titre_fixe`, `_cases_effectives`, `_refus_gestion`.
- Produces :
  - `public.apercu_titre() returns bigint` (stable, security definer, exécution anon et authenticated comme `apercu_role`) : l'en-tête
    `x-apercu-titre` (chiffres seuls) quand `fondateur_reel()`, `apercu_role()` vaut `formateur`, `direction` ou `siege`, que le titre
    existe, que son niveau correspond (promo, centre, réseau) et que son `lieu_id` est nul ou égal à `lieu_courant()` ; nul sinon.
  - `public._case_apercu(p_page text, p_plafond integer) returns integer` (aucun droit) : `p_plafond` si `apercu_titre()` est nul,
    sinon la case de ce titre (`_cases_effectives`, `voir` 1, `modifier` 2, `non` 0) bornée par `p_plafond`.
  - `public._apercu_fixe() returns boolean` (aucun droit) : vrai si `apercu_titre()` est nul ou désigne un titre fixe.
  - Fragments : dans `case_promo`, `case_centre`, `case_reseau`, la branche d'aperçu `then pg.plafond else 0 end` devient `then
    _case_apercu(p_page, pg.plafond) else 0 end` ; dans `formateur_fixe`, `direction_fixe`, `siege_fixe`, la branche d'aperçu gagne
    `and _apercu_fixe()` (texte exact relevé dans `20261112_titres_2_gestes.sql` par le générateur).
  - `public.mes_titres()` remplacée en entier, même retour : en aperçu `stagiaire`, aucune ligne ; en aperçu `formateur`,
    `direction`, `siege`, une ligne : `coalesce(apercu_titre(), titre_fixe(<niveau>))`, `lieu_id` = `lieu_courant()` (nul au réseau),
    `promo_ids` = `{promo_courante()}` pour un titre de promo, cases `_cases_effectives` ; hors aperçu, le texte de la migration 6.
  - `public.titres_ajustables(p_lieu_id integer) returns table(id bigint)` : même garde de lecture que `titres_visibles` ; parmi les
    titres non fixes qu'elle rendrait, ceux pour lesquels `_refus_gestion(niveau, coalesce(lieu_id, p_lieu_id), _cases_effectives(
    coalesce(<version du centre>, id)))` est nul et que l'appelant ne porte pas (ni sa racine, ni une version). Authenticated.
  - Retour : fragments inverses, `mes_titres` de la migration 6 (relue dans le fichier), suppressions ; garde D5 en tête.

- [ ] **Step 1 : preuve, groupe `apercu`** : le fondateur, aperçu `formateur` sur la promo 1, en-tête du titre de `t_interv` :
  `case_promo(1,'emargement')` 2, `case_promo(1,'notes')` 0, `formateur_fixe(1)` faux, `geste_promo(1,'notes.lire')` faux,
  `geste_promo(1,'emargement.tenir')` vrai, `stagiaires.supprimer` faux ; sans en-tête de titre : réponses d'aujourd'hui (plafond,
  `formateur_fixe` vrai) ; en-tête d'un titre de centre en aperçu `formateur` : ignoré (plafond) ; en-tête d'un titre du centre 2 en
  aperçu direction sur le centre 1 : ignoré ; aperçu `direction` + titre de `t_secr` : `case_centre(l1,'notes')` 0,
  `direction_fixe(l1)` faux ; `form_n` (non fondateur) avec `x-apercu-role: formateur` et `x-apercu-titre` : ses propres réponses,
  inchangées ; `dir_n` avec l'en-tête : inchangé ; en-tête `12abc` : ignoré, aucune erreur.
- [ ] **Step 2 : preuve, groupe `ajustables`** : `mes_titres()` du fondateur en aperçu formateur + `t_interv` : une ligne Intervenant,
  `promo_ids {1}` ; en aperçu stagiaire : 0 ligne ; hors aperçu : ses vrais titres ; `titres_ajustables(<centre 1>)` par `t_chef` :
  le titre de `t_rh`, R (non porté par lui), pas Formateur, pas le titre de `t_secr` (plus que le sien), pas le sien ; par `dir_n` :
  tous les non fixes du centre 1 ; par `t_rh` : aucun ; par `t_interv` : `ERREUR 42501` ; `titres_ajustables(null)` par `siege` : les
  titres du réseau ; par `t_dirs` : ceux de niveau réseau au plus égaux aux siens (D1).
- [ ] **Step 3 : contre-épreuve** (`suite --etapes 7`) : ROUGE sur `apercu` et `ajustables`.
- [ ] **Step 4 : écrire la migration 8 et son retour ; vert.** `suite --etapes 7,8` : `VERT n/0` ; `titres-en-ligne` et `en-ligne`
  (rôles) sur la base `--production` + 7 + 8 : comptes de `apres-7/` (l'aperçu sans en-tête de titre ne change rien).
- [ ] **Step 5 : mutant.** Retirer à la main `fondateur_reel()` de `apercu_titre` : ROUGE sur la ligne `form_n`. Reconstruire.
- [ ] **Step 6 : commit** `Titres, étape 3, migration 8 : aperçu du fondateur par titre, mes_titres en aperçu, titres ajustables`.

### Task 26 : Règles pures des titres (`js/titres-rules.js`)

**Files:**
- Create: `js/titres-rules.js`, `tests/titres-rules.test.mjs`

**Interfaces:**
- Produces (module pur, sans DOM ni réseau) :
  - `PAGES_DU_NIVEAU` : `{ promo: [...], centre: [...], reseau: [...] }`, chaque page `{ page, libelle, route, plafond }`, dans l'ordre
    de `_pages_du_niveau` : promo `planning` (Planning, `planning`, 2), `emargement` (Émargement, `emargement`, 2), `stagiaires`
    (Stagiaires, `stagiaires`, 2), `notes` (Notes et examens, `notes`, 2), `cours` (Cours et QCM, `themes`, 2), `ccp2` (CCP2, `ccp2`,
    1), `indicateurs` (Indicateurs, `centre`, 1), `reglages` (Réglages de la promo, `config`, 2) ; centre `promos` (Promos, `promos`,
    2), `stagiaires` (2), `emargement` (1), `notes` (1), `equipe` (Équipe, `equipe`, 2), `reglages` (Réglages du centre, `config`, 2) ;
    réseau `cours` (`themes`, 2), `directions` (Directions de centre, `directions`, 2), `reglages` (Réglages du réseau, `config`, 2).
  - `NIVEAU_DE_L_ESPACE` : `{ equipe: "promo", direction: "centre", siege: "reseau" }`.
  - `casesDeLEspace({ espace, titres, promoId, lieuId }) -> { [page]: 0|1|2 } | null` : `titres` nul (lecture ratée) : nul ; stagiaire :
    nul ; sinon le titre du niveau de l'espace qui porte sur la promo (promo), le centre (centre) ou le réseau, valeurs bornées par le
    plafond ; aucun titre de ce niveau : toutes les pages à 0.
  - `caseDe(cases, page, niveau) -> 0|1|2` : `cases` nul : le plafond de la page.
  - `choixDeLaPage(niveau, page) -> string[]` : `["non","voir","modifier"]`, `["non","voir"]` (plafond 1), `["non","modifier"]` (réglages).
  - `releverStagiaires(niveau, cases) -> { cases, releve }` (§ 5.4) et `PHRASE_STAGIAIRES_RELEVE = "Stagiaires passe à « Voir » : cette
    page montre des noms de stagiaires."`.
  - `bandeaux(niveau, cases) -> string[]`, textes exacts :
    `BANDEAU_EQUIPE = "Équipe sur « Modifier » : la personne pourra inviter et donner des titres de promo, donc confier à d'autres ce
    qu'elle ne fait pas elle-même. Chaque nomination reste dans le journal."` ;
    `BANDEAU_COURS = "Cours et QCM sur « Modifier » : les cours et les questions sont communs à tout le réseau ; une modification vaut
    pour tous les centres."` ;
    `BANDEAU_DIRECTIONS = "Directions de centre sur « Modifier » : la personne pourra donner des titres de centre dans tous les centres,
    qui voient des noms de stagiaires qu'elle ne voit pas. Chaque nomination reste dans le journal."`
  - `phrasePorteurs(n)` : `null` (0), `"1 personne a ce titre : ses droits changeront dès l'enregistrement."`, `"3 personnes ont ce
    titre : leurs droits changeront dès l'enregistrement."` ; `phraseVersionCentre(n)` : `"Ce titre vient du réseau : l'ajuster crée
    la version de votre centre. 1 personne passera à la version du centre."` (pluriel : « 2 personnes passeront »).
  - `ceQueJePeuxFaire(titre) -> [{ libelle, valeur }]` : les pages non à « Non », dans l'ordre, valeur `Voir` ou `Modifier`.
  - `libelleTitre(titre, { lieuNom }) -> string` : `"Secrétariat · Centre de Nîmes"`, `"Formateur · 2 promos"`, `"Formateur · Promo
    mars 2026"` (une promo : son nom), `"Siège"` (réseau).
  - `pastillesDePersonne(lignes, email) -> string[]` (lignes de `personnes_et_titres`) : un libellé par titre, titre de centre d'abord.
  - `titresDonnablesGroupes(titres) -> [{ groupe, titres }]` : `"Pour tout le centre"` puis `"Pour certaines promos"` (centre) ;
    `"Pour tout le réseau"`, `"Pour tout le centre"`, `"Pour certaines promos"` (réseau) ; `donnable` faux écarté ; groupe vide écarté.
  - `phraseJournal(ligne, nomDe) -> string` : `"09/11, Camille R. a donné le titre Secrétariat à alex@exemple.invalid"` ; verbes
    `donne` « a donné le titre X à Y », `retire` « a retiré le titre X à Y », `change` « a changé le titre de Y en X », `cree` « a créé
    le titre X », `ajuste` « a ajusté le titre X », `supprime` « a supprimé le titre X » ; `par` vaut `système` : « L'application » ;
    `nomDe(email)` rend le nom connu ou l'adresse.
  - `formateurFixeSur(titres, promoId) -> boolean | null` : nul si `titres` est nul.

- [ ] **Step 1 : tests rouges** (`node --test tests/titres-rules.test.mjs`), dont : `casesDeLEspace` d'un Formateur fixe = plafond
  partout (égalité stricte avec `{planning:2, emargement:2, stagiaires:2, notes:2, cours:2, ccp2:1, indicateurs:1, reglages:2}`) ;
  Intervenant sur la promo 1 : `{planning:1, emargement:2, stagiaires:1, notes:0, cours:1, ccp2:0, indicateurs:0, reglages:0}`, et
  toutes à 0 sur la promo 2 ; `titres` nul : nul ; `releverStagiaires("promo", {notes:"voir"})` relève et `releve` vrai, sans
  relever si Stagiaires est déjà « Modifier » ; `choixDeLaPage("centre","emargement")` vaut `["non","voir"]` ; les trois bandeaux,
  mot pour mot ; `phrasePorteurs(1)` et `(3)` ; `phraseJournal` pour chaque action et pour `système` ; aucun texte ne contient « prof »
  ni le caractère U+2014.
- [ ] **Step 2 : écrire le module.** Run : `node --test tests/titres-rules.test.mjs`. Expected : PASS.
- [ ] **Step 3 : commit** `Titres, étape 3 : règles pures des écrans (cases, barre, phrases)`.

### Task 27 : Lectures, gestes et cases de la session (`js/db.js`, `js/auth-admin.js`, `js/roles-rules.js`)

**Files:**
- Modify: `js/db.js`, `js/auth-admin.js`, `js/roles-rules.js`, `tests/roles-rules.test.mjs` (`js/espaces-rules.js` ne change pas :
  `titres` est dans `PREFIXES_DE_REFUS` depuis 2a)

**Interfaces:**
- Consumes : fonctions de 2b et de la migration 8 ; `js/titres-rules.js` (Task 26).
- Produces :
  - `js/db.js` (chaque refus part par `erreurDeBase`, comme `retirerTitre`) : `lireMesTitres()`, `lireTitresVisibles(lieuId)`,
    `lireTitresAjustables(lieuId) -> Set<number>`, `lirePersonnesEtTitres({ lieuId = null, promoId = null })`,
    `lireJournalDesDroits(lieuId)`, `donnerTitre({ email, titreId, lieuId, promoIds = null, profId = null })`,
    `creerTitre({ depuis, nom, lieuId })`, `ajusterTitre({ titreId, lieuId, nom, cases })`, `supprimerTitre(titreId)`,
    `lireTitresOuverts()`, `reglerTitresOuverts(ouvert)` ; `poserApercu(role, { fondateur, titreId = null })` pose aussi
    `x-apercu-titre` (constante `ENTETE_APERCU_TITRE` de `js/roles-rules.js`), au fondateur seul et pour les aperçus `formateur`,
    `direction`, `siege` ; changer de titre vide le cache comme un changement d'aperçu.
  - `js/auth-admin.js` : `mesTitres` lu au démarrage avec les affectations (panne ou fonction absente : nul, sans message), relu à
    chaque changement d'aperçu ; `getMesTitres()`, `casesAffichees() -> {..}|null` (`casesDeLEspace` sur l'espace, la promo et le
    centre affichés), `peutVoir(page) -> boolean`, `peutModifier(page) -> boolean` (`caseDe(...) >= 1` et `=== 2`) ;
    `setViewAs(role, { titreId })`.
  - `js/roles-rules.js` : `droitsAffiches({ profil, promo, apercu, titres })` ; dans `droitsReels`, `admin` = `(fondateur et
    is_admin) ou (formateur et formateurFixeSur(titres, promo.id) !== false)` (M5) ; en aperçu `formateur` avec un titre non fixe,
    `admin` faux ; `ENTETE_APERCU_TITRE = "x-apercu-titre"`.

- [ ] **Step 1 : tests rouges** (`tests/roles-rules.test.mjs`) : `droitsAffiches` d'un formateur, `titres` nul : drapeaux d'aujourd'hui
  (égalité stricte) ; titres = Formateur fixe sur la promo : mêmes drapeaux ; titres = Intervenant sur la promo : `admin` faux,
  `prof` vrai, `espace` `equipe` ; `dirform` (direction + Formateur fixe) : inchangé ; fondateur hors aperçu : inchangé.
- [ ] **Step 2 : écrire** les trois fichiers. Run : `node --test "tests/*.test.mjs"`. Expected : PASS (aucun autre test touché).
- [ ] **Step 3 : commit** `Titres, étape 3 : lectures et gestes des titres, cases de la session, droit d'écriture au seul Formateur (M5)`.

### Task 28 : Le banc répond aux titres

**Files:**
- Modify: `_harness_supabase.js` (copié de `C:/Users/watch/Dev/ECSR/TP_ECSR_App` dans le worktree, puis `node _harness_build.mjs`)

**Interfaces:**
- Produces :
  - comptes `?compte=secretariat` (titre de centre « Secrétariat » sur le lieu 1, cases du catalogue § 6.2) et `?compte=intervenant`
    (titre de promo « Intervenant » sur la promo 1, cases du catalogue) ; les comptes existants portent leur titre fixe ; titres du
    banc : les trois fixes, les six du catalogue (sans centre), une version de centre de « Secrétariat » au lieu 1 sous `?version=1`.
  - RPC, comme la base, pour chaque compte (direction, dirform, direction-vide, dirailleurs, siège, fondateur, formateur, stagiaire,
    secretariat, intervenant) : `mes_titres` (aperçu compris : `x-apercu-titre` lu dans les en-têtes), `titres_visibles`,
    `titres_ajustables`, `personnes_et_titres`, `journal_des_droits` (lignes fictives, ou vide sous `?journal=absent`), `donner_titre`,
    `retirer_titre` (tous les titres), `creer_titre`, `ajuster_titre`, `supprimer_titre`, `titres_ouverts`, `regler_titres_ouverts` ;
    phrases et codes de `_refus_titre`, `_refus_gestion` (D1), M4, M7 ; verrou fermé par défaut, ouvert sous `?titres_ouverts=1` ;
    `?titres=panne` (erreur réseau) et `?titres=absent` (`PGRST202`) pour chaque lecture ; journal des appels dans
    `window.__HARNESS_TITRES`.

- [ ] **Step 1 : écrire les RPC et les comptes ; rebâtir.** Run : `node _harness_build.mjs`. Expected : sortie sans erreur.
- [ ] **Step 2 : contrôle.** Dans le Browser pane, `_harness.html?compte=secretariat` puis `?compte=intervenant` : console sans erreur ;
  `await (await import("./js/db.js")).lireMesTitres()` rend une ligne aux cases du catalogue.
- [ ] **Step 3 : pas de commit** (fichier hors git) : le rapport de la tâche donne le chemin du banc modifié pour la coordination.

### Task 29 : Barre filtrée, barre du téléphone, menu du compte, aperçu par titre

**Files:**
- Modify: `js/nav-rules.js`, `tests/nav-rules.test.mjs`, `js/main.js` (l. 95), `js/menu-compte.js`, `js/auth-admin.js`
  (`buildViewAsBlock`, l. 612)

**Interfaces:**
- Consumes : `casesAffichees`, `getMesTitres`, `setViewAs(role, { titreId })` (Task 27) ; `PAGES_DU_NIVEAU`, `caseDe`,
  `ceQueJePeuxFaire`, `libelleTitre` (Task 26).
- Produces :
  - `entreesNavigation(espace, { ..., cases = null })` : une entrée dont la page a la case 0 disparaît ; l'accueil de chaque espace
    reste ; `cases` nul : sortie d'aujourd'hui.
  - `barreTelephone(espace, entrees)` : la liste fixe de l'espace, moins les entrées absentes, complétée par les entrées suivantes dans
    l'ordre de la barre jusqu'au même nombre ; barre dans l'ordre des entrées ; le reste dans `plus`.
  - menu du compte, sous la tête : « Mon titre » (`libelleTitre`, une ligne par titre) et « Ce que je peux faire » (liste repliée,
    `ceQueJePeuxFaire`) ; rien pour un stagiaire ni hors lecture des titres.
  - aperçu : sous les aperçus Formateur, Direction, Siège, un choix « Titre » (titres du niveau, Formateur, Direction de centre ou Siège
    en premier), fondateur seul, lu par `lireTitresVisibles`.

- [ ] **Step 1 : tests rouges** (`tests/nav-rules.test.mjs`) : pour les quatre espaces, `cases` du titre fixe donne exactement la sortie
  de `cases = null` (entrées et barre du téléphone) ; Intervenant (émargement allumé) : entrées `home, planning, emargement,
  stagiaires, themes`, barre `home, planning, emargement, stagiaires`, plus `themes` ; Secrétariat (une promo du centre a
  l'émargement allumé) : entrées `centre, promos,
  stagiaires, emargement, equipe`, barre `centre, promos, stagiaires, equipe`, plus `emargement` ; titre du réseau Qualité : `reseau,
  themes, directions`, barre identique, plus vide.
- [ ] **Step 2 : écrire** ; Run : `node --test "tests/*.test.mjs"`. Expected : PASS.
- [ ] **Step 3 : banc.** `?compte=intervenant`, `?compte=secretariat`, fondateur en aperçu Formateur + Intervenant, sur ordinateur et
  en `mobile` (375 x 812) : barres attendues, menu « Mon titre », aucun défilement de côté (`document.documentElement.scrollWidth <=
  innerWidth`), cibles du menu et du choix de titre d'au moins 44 px.
- [ ] **Step 4 : commit** `Titres, étape 3 : barre selon les cases, Mon titre, aperçu par titre`.

### Task 30 : Chaque page écrit selon sa case, l'accueil suit les cases

**Files:**
- Modify: les fichiers où `isAdmin()` garde l'écriture d'une page de l'espace Formateur (`a-traiter.js`, `emargement-bandeau.js`,
  `views/emargement.js`, `views/planning.js`, `views/calendrier.js`, `views/dashboard.js`, `views/passages.js`, `views/stagiaires.js`,
  `views/notes.js`, `views/epcf-livret.js`, `views/dp.js`, `views/attestations.js`, `views/themes.js`, `views/ressources.js`,
  `views/config.js`, `views/aujourdhui.js`) ; `views/direction-promos.js`, `views/direction-stagiaires.js`,
  `views/direction-centre.js` ; un test par règle déplacée dans le fichier de test existant de la vue (ou `tests/lot-titres-vues.test.mjs`)

**Interfaces:**
- Consumes : `peutVoir(page)`, `peutModifier(page)` (Task 27).
- Produces :
  - table de remplacement, à suivre appel par appel (un appel qui ne garde pas une écriture de page, par exemple `main.js`,
    `modules-etat.js`, `auth-admin.js`, `mon-suivi.js`, `autonomie-etat.js`, reste `isAdmin()` et le rapport le dit) : Émargement
    (`emargement`), Planning, Dates clés, Priorités, passages (`planning`), Stagiaires, élèves bénévoles (`stagiaires`), Notes, EPCF,
    livret, dossier pro, attestations (`notes`), Cours et QCM, Documents, À traiter (`cours`), Réglages (`reglages`). Les gestes
    définitifs (anonymiser, supprimer une fiche, purger) gardent `isAdmin()` **et** le titre fixe (`formateurFixeSur(...) !== false`).
  - Aujourd'hui : Émargement `emargementActif() && peutModifier("emargement")` ; À traiter `peutModifier("cours")` ; Au tableau, En
    voiture `peutVoir("planning")` ; À suivre de près `peutVoir("notes")`. Vue d'ensemble de la direction : Assiduité et abandons
    `peutVoir("stagiaires")` ; Résultats, comparaison, À suivre, thèmes `peutVoir("notes")`. Vues de la direction : créer une promo,
    dates, modules `peutModifier("promos")` ; inviter, modifier une fiche, abandon `peutModifier("stagiaires")`.

- [ ] **Step 1 : tests rouges** (règles pures sorties des vues quand la vue n'en a pas) : pour chaque bloc de l'accueil, visible avec
  les cases du titre fixe, masqué avec celles de Secrétariat ou d'Intervenant comme le dit la liste ci-dessus.
- [ ] **Step 2 : remplacer** appel par appel ; `git grep -n "isAdmin()" js` dans le rapport, chaque appel restant justifié en une ligne.
- [ ] **Step 3 : banc.** Formateur fixe : chaque page identique à main (captures `outils/captures.mjs` avant et après, mêmes boutons) ;
  Intervenant : Planning sans bouton d'écriture, Émargement complet, Stagiaires en lecture ; Secrétariat : Stagiaires complet, Promos
  sans « Créer une promo », Vue d'ensemble sans « Résultats ». Run : `node --test "tests/*.test.mjs"`. Expected : PASS.
- [ ] **Step 4 : commit** `Titres, étape 3 : chaque page écrit selon sa case, l'accueil suit les cases`.

### Task 31 : Page Équipe de la direction (spec § 11)

**Files:**
- Modify: `js/views/direction-equipe.js`, `css/` (feuille des pages Équipe, classes `equipe-*`)
- Create: `js/views/titres-editeur.js` (fenêtre « Ajuster un titre », partagée avec le siège), `tests/titres-editeur.test.mjs`

**Interfaces:**
- Consumes : Tasks 26 et 27 ; `ouvrirFormulaire` (inchangé, exporté) ; `confirmer`, `demander` (`js/confirmer.js`).
- Produces :
  - `renderEquipeCentre(container)` : dans l'ordre, (1) **Personnes avec accès** : nom (fiche formateur, sinon adresse), titres en
    pastilles (`pastillesDePersonne`), « Vous » ; gestes « Changer de titre » et « Retirer » là où la base l'accepterait (sinon le
    refus s'affiche) ; (2) **Inviter une personne** : adresse, titre (`titresDonnablesGroupes` de `lireTitresVisibles`), promos du
    centre à cocher pour un titre de promo, « Fiche formateur » pour le seul Formateur, « Ce qu'elle pourra faire »
    (`ceQueJePeuxFaire`), « Masqué dans sa barre », bouton « Inviter » (`donnerTitre`) ; si la personne a déjà un autre titre au même
    niveau, `confirmer` : « Cette personne a déjà le titre X : il sera remplacé. » ; (3) **Titres du centre** : nom, niveau, origine
    (« Réseau » ou « Centre »), porteurs, cadenas et « Fixe » pour un titre fixe, « Ajuster » si l'identifiant est dans
    `lireTitresAjustables`, « Créer un titre à partir de celui-ci » (`demander` le nom, puis `creerTitre`), « Supprimer » si ajustable
    et sans porteur (`confirmer`) ; (4) **Journal**, replié (`<details>`), `phraseJournal`, « Aucune ligne pour le moment » si vide.
    Section 2 visible si au moins un titre est donnable ; section 3 si `peutVoir("equipe")`.
  - `ouvrirEditeurTitre({ titre, niveau, lieuId, porteurs, apres })` (`js/views/titres-editeur.js`) : nom ; rappel du niveau ; une
    ligne par page (`choixDeLaPage`, boutons radio de 44 px) ; Stagiaires relevé de lui-même avec `PHRASE_STAGIAIRES_RELEVE` ;
    bandeaux ; « Sa barre » en direct (`entreesNavigation` avec ces cases) pour un titre de centre et du réseau ; `phrasePorteurs` ou
    `phraseVersionCentre` (confirmée avant l'envoi) ; « Enregistrer » (`ajusterTitre`).
  - M3 : « Modifier les promos » d'une personne passe par `donnerTitre` avec son titre de promo et la nouvelle liste ; « Retirer du
    centre » par `retirerTitre` ; `reglerAffectationsFormateur` n'est plus importée.

- [ ] **Step 1 : tests rouges** (`tests/titres-editeur.test.mjs`, aides DOM de `tests/aides-dom.mjs`) : relever Notes à « Voir »
  coche Stagiaires « Voir » et montre la phrase ; Équipe « Modifier » montre `BANDEAU_EQUIPE` ; un titre du réseau ajusté depuis un
  centre demande la confirmation avec `phraseVersionCentre(1)` ; « Enregistrer » envoie exactement les cases affichées.
- [ ] **Step 2 : écrire** ; Run : `node --test "tests/*.test.mjs"`. Expected : PASS.
- [ ] **Step 3 : banc** (`?compte=direction&titres_ouverts=1`, `?compte=secretariat`, ordinateur et téléphone) : inviter un
  Intervenant sur deux promos, changer ses promos, le retirer ; ajuster un titre du réseau (version créée, confirmation) ; Secrétariat
  (Équipe : Voir) voit les sections 1, 3 et 4 sans aucun geste ; verrou fermé : la liste « Titre » n'offre que Formateur ; aucun
  défilement de côté ; refus du banc montré par sa phrase.
- [ ] **Step 4 : commit** `Titres, étape 3 : page Équipe (personnes, inviter, titres du centre, ajuster, journal)`.

### Task 32 : Directions de centre, Réglages du fondateur, Personnes avec accès

**Files:**
- Modify: `js/views/siege-directions.js`, `js/views/config.js`, `js/roles-rules.js` (`pastillesDuProfil`, `listeAcces`),
  `tests/roles-rules.test.mjs`

**Interfaces:**
- Consumes : Tasks 26, 27, 31 (`ouvrirEditeurTitre`).
- Produces :
  - `renderDirections` : par centre, ses personnes (`lirePersonnesEtTitres()`, niveau centre) avec pastilles et « Retirer » ;
    « Inviter » (adresse, centre, titre de centre donnable : Direction de centre, catalogue, titres du centre) par `donnerTitre` ;
    section **Titres du réseau** (`lireTitresVisibles(null)`, « Ajuster » selon `lireTitresAjustables(null)`, créer, supprimer) ;
    **Journal du réseau** replié ; « Ajouter un centre » inchangé.
  - Réglages du fondateur (`config.js`) : le choix « Siège » devient « Titre du réseau » (Siège et titres de niveau réseau) par
    `donnerTitre(email, titre, null)` ; section « Titres à la carte » : état du verrou (`lireTitresOuverts`) et bouton « Ouvrir les
    titres à la carte » / « Fermer », par `confirmer` (texte : « Les titres autres que Formateur, Direction de centre et Siège pourront
    être donnés. Les conditions d'utilisation qui les décrivent doivent être en ligne. »), `reglerTitresOuverts`. Le plan livre le
    bouton ; seul Timy l'appuie.
  - « Personnes avec accès » : `pastillesDuProfil({ profil, titres })` (`titres` : lignes de `lirePersonnesEtTitres({ promoId })`) ;
    un stagiaire garde « stagiaire » ; `titres` nul (panne, fonction absente) : sortie d'aujourd'hui par `roles` ; `config.js` lit
    `lirePersonnesEtTitres` à la place de `lireRolesDuPersonnel`.

- [ ] **Step 1 : tests rouges** (`tests/roles-rules.test.mjs`) : titres fixes (Formateur sur la promo, Direction de centre) : pastilles
  `formateur` et `direction` comme aujourd'hui ; Intervenant : `Intervenant` ; deux titres : deux pastilles ; `titres` nul : sortie
  d'aujourd'hui.
- [ ] **Step 2 : écrire** ; Run : `node --test "tests/*.test.mjs"`. Expected : PASS.
- [ ] **Step 3 : banc** (`?compte=siege&titres_ouverts=1`, fondateur, téléphone) : inviter une Qualité au réseau, un Secrétariat au
  centre 1, ajuster le titre du réseau Contenus pédagogiques, journal du réseau sans ligne de niveau promo ; le bouton du verrou passe
  par la fenêtre de confirmation, jamais une boîte du navigateur.
- [ ] **Step 4 : commit** `Titres, étape 3 : Directions de centre, titres du réseau, verrou du fondateur, Personnes avec accès par titre`.

### Task 33 : Robot des parcours et vérificateur de navigation, profils par titre

**Files:**
- Create: `outils/parcours/titres.py`
- Modify: `outils/parcours/connus.py` (seulement si un écart connu est justifié), `outils/robot_parcours.py` (liste des parcours),
  `outils/verifier_navigation.py`

**Interfaces:**
- Consumes : banc (Task 28) ; compétence `robot-des-parcours` (lire avant d'écrire un parcours ; `:text-is` plutôt que `:has-text`).
- Produces : parcours `inviter_un_intervenant` (direction, verrou ouvert), `ajuster_un_titre` (direction : Stagiaires relevé, version du
  centre), `voir_n_ecrit_pas` (Secrétariat sur Promos, Intervenant sur Planning : aucun bouton d'écriture), `mon_titre` (menu du
  compte des deux profils), `apercu_par_titre` (fondateur) ; dans `verifier_navigation.py`, scénarios `compte="secretariat"` et
  `compte="intervenant"` (barre, barre du téléphone, tiroir Plus, menu du compte), ordinateur et téléphone.

- [ ] **Step 1 : écrire les parcours et les scénarios.**
- [ ] **Step 2 : jouer.** Run : `python outils/robot_parcours.py --habillages ecsr,ecf` puis `python outils/verifier_navigation.py`.
  Expected : `VERT` (code 0) ; un ROUGE se diagnostique par la compétence avant toute retouche de `connus.py`.
- [ ] **Step 3 : commit** `Titres, étape 3 : parcours et navigation des profils Secrétariat et Intervenant`.

### Task 34 : Répétition de l'étape 3, Nouveautés, préparer et signaler

**Files:**
- Modify: `js/nouveautes-data.js`, `tests/nouveautes.test.mjs` (si un test compte les entrées)

**Interfaces:**
- Produces : une entrée Nouveautés, au vouvoiement :
  ```js
  { id: "<date>-titres-ecrans", date: "<date de mise en ligne>", pour: "direction",
    titre: "Chacun a son titre",
    resume: "Dans Équipe, chaque personne porte désormais son titre (Formateur, Direction de centre), dans des pastilles. "
          + "La page réunit les personnes, l'invitation, les titres du centre et le journal des droits. Le menu de votre compte "
          + "montre votre titre et ce qu'il vous permet.",
    ou: { route: "equipe", label: "Équipe" } }
  ```
  et la même pour `pour: "siege"` (« Dans Directions de centre... », `ou` vers `directions`).

- [ ] **Step 1 : Nouveautés** ; Run : `node --test tests/nouveautes.test.mjs`. Expected : PASS.
- [ ] **Step 2 : preuves.** Base `--production` + 7 + 8 (`psql -1 -f`) : `suite-en-ligne`, `gestion-en-ligne`, `titres-en-ligne`,
  `en-ligne` (rôles), `espaces-en-ligne`, `donnees-en-ligne`, EPCF, profils, questionnaires, registre qualité, conservation,
  habillage, contacts, e-learning (`autonomie-preuve.sql` en ligne). Expected : `VERT`, comptes de `apres-7/` plus ceux des groupes
  `apercu` et `ajustables`. `suite --etapes 8 --compact` sur la base `--production` + 7 : VERT, md5 noté.
- [ ] **Step 3 : filets.** `node --test "tests/*.test.mjs"` vert ; robot `--habillages ecsr,ecf` et `verifier_navigation.py` verts ;
  contrôle U+2014 en Python (`chr(0x2014)`) sur chaque fichier touché ; `git grep -n "prof\b" -- js/views/direction-equipe.js
  js/views/siege-directions.js js/views/titres-editeur.js js/titres-rules.js` : aucun texte affiché.
- [ ] **Step 4 : commit** `Titres, étape 3 : Nouveautés de la direction et du siège`.
- [ ] **Step 5 : préparer et signaler.** Rapport à la coordination : fichiers de l'app, migration 8, verdicts, chemin du banc modifié.
  Ordre de mise en ligne de l'étape 3 (par la coordination, accord explicite de Timy pour la base) : essai à blanc de la migration 8 ;
  application ; preuves après (Step 2, en production) ; fusion de la branche dans main et poussée (le crochet pose le jeton) ;
  contrôle de l'app en ligne avec le compte du fondateur (aperçu Formateur + Intervenant ; en-tête `x-apercu-titre` accepté par
  l'API : aucune erreur CORS en console). Verrou fermé : seuls les titres fixes se donnent ; les écrans montrent les titres. Un ROUGE
  après application : retour 8 aussitôt.

Taille estimée de l'étape 3 : migration 7 environ 300 lignes et retour 250, migration 8 environ 250 et retour 200, preuve de la suite
900, script de concurrence 120 ; app environ 1 400 lignes (règles 300, éditeur 250, Équipe 450, siège et réglages 250, vues 150) et
400 lignes de tests ; banc 500 ; robot et vérificateur 400. Quinze tâches (20 à 34).

---

## 6. Étape 4 : catalogue, conditions, journal

État de départ supposé : étape 3 en ligne (migrations 7 et 8 appliquées, écrans fusionnés), verrou fermé.

### 6.F Fichiers de l'étape 4

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261115_titres_9_catalogue.sql` et `_retour.sql` | les six titres du réseau du § 6.2 |
| `supabase/migrations/20261112_titres_4_journal.sql` | appliquée telle quelle (aucune retouche) |
| `supabase/migrations/20261114_autonomie_2_version.sql` | rejouée telle quelle avec la nouvelle date (`-v version=<date>`) |
| `tests/sql/titres-suite-preuve.sql` | groupes `catalogue` et `journal_suite` |
| `js/legal-data.js`, `tests/legal-rules.test.mjs` | texte et version des conditions |
| `js/nouveautes-data.js` | deux entrées (direction, siège) |
| `supabase/functions/chatbot/aide.mjs`, `tests/chatbot-aide.test.mjs` | guide de l'assistant |

### Task 35 : Le catalogue (migration 9)

**Files:**
- Create: `supabase/migrations/20261115_titres_9_catalogue.sql`, `_retour.sql`
- Modify: `tests/sql/titres-suite-preuve.sql`

**Interfaces:**
- Produces : six lignes de `titres`, `lieu_id` nul, `fixe` faux, `cree_par 'migration 20261115_titres_9_catalogue'`, cases écrites
  page par page (toutes les pages du niveau, valeurs de la spec § 6.2) :
  ```text
  Responsable pédagogique  centre  promos modifier, stagiaires modifier, emargement voir, notes voir, equipe voir, reglages non
  Secrétariat              centre  promos voir, stagiaires modifier, emargement voir, notes non, equipe voir, reglages non
  Ressources humaines      centre  promos voir, stagiaires non, emargement non, notes non, equipe voir, reglages non
  Intervenant              promo   planning voir, emargement modifier, stagiaires voir, notes non, cours voir, ccp2 non,
                                   indicateurs non, reglages non
  Contenus pédagogiques    reseau  cours modifier, directions non, reglages non
  Qualité                  reseau  cours voir, directions voir, reglages non
  ```
  Gardes : la migration 6 est là (`to_regprocedure('public.donner_titre(...)')`), aucun titre sans centre ne porte déjà l'un de ces
  noms (casse ignorée), chaque jeu de cases passe `_cases_valides` ; sinon arrêt. Retour : garde D5, garde « aucune version de centre
  de ces titres » (sinon arrêt avec la liste), puis suppression des six par nom et `cree_par`.

- [ ] **Step 1 : preuve, groupe `catalogue`** : six titres, niveaux et cases égaux mot pour mot au tableau ; `titres_visibles(<centre
  1>)` par `dir_n` les montre (Intervenant, Responsable pédagogique, Ressources humaines, Secrétariat), `donnable` faux verrou fermé,
  vrai verrou ouvert (en propriétaire) ; `dir_n` donne Secrétariat à `x` au centre 1, verrou ouvert : `x` lit `stagiaires`, aucune
  `evaluations`.
- [ ] **Step 2 : contre-épreuve** (`suite --etapes 7,8`) : ROUGE sur `catalogue`.
- [ ] **Step 3 : écrire la migration 9 et son retour ; vert.** `suite --etapes 7,8,9` : `VERT n/0`.
- [ ] **Step 4 : commit** `Titres, étape 4, migration 9 : le catalogue de six titres du réseau`.

### Task 36 : Les conditions d'utilisation

**Files:**
- Modify: `js/legal-data.js`, `tests/legal-rules.test.mjs` (un test qui retrouve les passages neufs)

**Interfaces:**
- Produces : `VERSION_CONDITIONS = "<date de mise en ligne>"` (posée le jour même, AAAA-MM-JJ, postérieure à `2026-11-14`, et
  EXACTEMENT la valeur passée à `autonomie_2_version`) ; commentaire d'en-tête « Version <date> (titres et droits à la carte) :
  nouveaux lecteurs (le personnel des centres selon son titre), journal des droits gardé trois ans ; passages neufs : ... ». Texte
  ajouté (au vouvoiement, comme tout le fichier), à faire lire par Timy avant la mise en ligne :
  - **L'essentiel, ligne 4**, la phrase « La direction de votre centre voit, comme vos formateurs, votre suivi nominatif (...) »
    devient : « La direction de votre centre, et les membres de son équipe à qui elle en donne le droit selon leur fonction, voient,
    comme vos formateurs, votre suivi nominatif (notes, planning, passages, absences, date de naissance) ; ».
  - **§ 2**, « (formateurs, ECF) » devient « (formateurs, intervenants, personnel des centres et du siège d'ECF) ».
  - **§ 3**, ligne ajoutée au tableau, après « Historique » : `| Droits du personnel | Pour les formateurs et le personnel d'ECF :
    leur titre, les promos ou le centre où il s'exerce, et le journal des droits (qui a donné, retiré, créé ou modifié quel titre,
    quand) |`
  - **§ 4**, deux paragraphes ajoutés après celui qui définit « Direction de votre centre » et « Siège d'ECF » :
    « **L'équipe de votre centre.** La direction de votre centre peut confier une partie de ces accès à d'autres membres de son
    équipe, selon leur fonction : par exemple un secrétariat, qui gère les fiches des stagiaires (identité, coordonnées, date de
    naissance, passages) sans voir les notes, ou un intervenant, qui tient les feuilles d'émargement des promos où il intervient.
    Chaque fonction porte un titre, affiché dans l'application, qui dit page par page ce que la personne peut voir ou modifier.
    Personne ne reçoit plus que ce que voient vos formateurs et la direction de votre centre, et la base de données vérifie ces droits
    à chaque demande. Au siège d'ECF, une personne chargée des contenus ou de la qualité ne lit, elle non plus, aucun nom de
    stagiaire. »
    « **Journal des droits du personnel.** Chaque fois qu'un titre est donné, retiré, créé, modifié ou supprimé, l'application le
    note : quand, par qui, pour qui, sur quelle promo ou quel centre, et ce que le titre permettait avant et après. Ce journal ne
    concerne que le personnel : aucune invitation de stagiaire n'y figure. Personne ne peut le modifier. Il est lu par les personnes
    qui gèrent l'équipe d'un centre, pour ce centre, par le siège d'ECF, sans les titres donnés sur une promo, et par l'éditeur. »
  - **§ 10**, ligne ajoutée au tableau, avant « Statistiques anonymes » : `| Journal des droits du personnel | Trois ans, puis
    effacement automatique |`
  - **§ 12**, phrase ajoutée à la fin du paragraphe « Effacement sur demande » : « Pour un membre du personnel, l'effacement remplace
    son adresse par « compte effacé » dans le journal des droits : la trace du geste reste, sans son nom. »

- [ ] **Step 1 : test rouge** (`tests/legal-rules.test.mjs`) : `CONDITIONS_MD` contient « Journal des droits du personnel » deux fois
  au moins, « L'équipe de votre centre », « compte effacé » ; `VERSION_CONDITIONS > "2026-11-14"` ; aucun U+2014.
- [ ] **Step 2 : écrire le texte**, version posée à une date de travail `2026-11-15`, à remplacer le jour de la mise en ligne. Run :
  `node --test "tests/*.test.mjs"`. Expected : PASS.
- [ ] **Step 3 : commit isolé** `Conditions d'utilisation : titres et journal des droits (texte à valider par Timy)` (il se retire seul
  par `git revert` si Timy réécrit le texte).

### Task 37 : Le journal sur la base complète

**Files:**
- Modify: `tests/sql/titres-suite-preuve.sql`

**Interfaces:**
- Consumes : `20261112_titres_4_journal.sql` (inchangée), migrations 5 à 9.

- [ ] **Step 1 : preuve, groupe `journal_suite`** (joué seulement si `journal_droits` existe) : la migration 9 jouée après la 4
  écrit six lignes `cree`, `par` `système` ; `t_chef` ajuste R depuis le centre 1 : `cree` (version), puis `retire` et `donne` par
  porteur basculé (T17) ; `donner_titre` d'Intervenant : `donne`, `par` son adresse, aucune adresse de stagiaire dans le journal ;
  `journal_des_droits(<centre 1>)` par `t_secr` (Équipe : Voir) : ces lignes ; par `t_interv` : `ERREUR 42501` ;
  `journal_des_droits()` par `siege` : aucune ligne de niveau promo ; `effacer_adresse_journal` par le fondateur : `par` et `pour`
  remplacés.
- [ ] **Step 2 : répétition.** Base `--production` + 7 + 8, application de la 4 (`psql -1 -f`) : `titres-en-ligne` (groupe `journal`
  joué), `gestion-en-ligne`, `suite --etapes 9` : `VERT n/0` ; retour 4 seul puis les mêmes : verts (journal sauté avec information).
- [ ] **Step 3 : commit** `Titres, étape 4 : le journal prouvé sur la base complète (migrations 4 à 9)`.

### Task 38 : Nouveautés et guide de l'assistant

**Files:**
- Modify: `js/nouveautes-data.js`, `supabase/functions/chatbot/aide.mjs`, `tests/chatbot-aide.test.mjs`

**Interfaces:**
- Produces :
  - Nouveautés, au vouvoiement, `date` = jour de mise en ligne : `pour: "direction"`, titre « Des titres pour toute votre équipe »,
    résumé « Secrétariat, responsable pédagogique, ressources humaines, intervenant : invitez chaque personne avec le titre qui
    convient à sa fonction, depuis Équipe. Chaque titre dit page par page ce qu'elle peut voir ou modifier ; vous pouvez l'ajuster pour
    votre centre ou en créer un à partir d'un autre. Chaque changement reste dans le journal. », `ou` vers `equipe` ; `pour: "siege"`,
    titre « Des titres pour le réseau », résumé « Contenus pédagogiques et Qualité rejoignent le siège ; les titres de centre se donnent
    depuis Directions de centre. Le siège crée et ajuste les titres de centre proposés à tout le réseau. », `ou` vers `directions`.
  - `aide.mjs` : ligne `equipe` de `AIDE_APP_DIRECTION` réécrite (personnes et titres, inviter avec un titre, titres du centre,
    ajuster, journal) ; ligne `directions` de `AIDE_APP_SIEGE` (titres du réseau, journal du réseau) ; `AIDE_APP` : « Mon titre » et
    « Ce que je peux faire » dans le menu du compte, et une page masquée par le titre n'existe pas pour la personne.

- [ ] **Step 1 : tests rouges** (`tests/chatbot-aide.test.mjs`) : `AIDE_APP_DIRECTION` cite « Inviter une personne », « Titres du
  centre » et « Journal » ; aucun guide ne contient « prof » ni U+2014 ; `tests/nouveautes.test.mjs` vert.
- [ ] **Step 2 : écrire** ; Run : `node --test "tests/*.test.mjs"`. Expected : PASS.
- [ ] **Step 3 : commit** `Titres, étape 4 : Nouveautés et guide de l'assistant`. Le déploiement de la fonction `chatbot` attend
  l'accord explicite de Timy (version suivante de l'assistant, au rapport).

### Task 39 : Répétition de l'étape 4, préparer et signaler

- [ ] **Step 1 : répétition locale complète.** `reconstruire.sh`, `rejouer_suite.sh --production --titres 1,2,3,5,6,7,8` ; application
  de la 4 puis de la 9 ; `autonomie_2_version` rejouée avec `-v version=2026-11-15` (refusée avec une date après aujourd'hui : le
  constater une fois avec la date de demain, puis la vraie) ; preuves de la Task 34, Step 2, plus `autonomie-version-preuve.sql`
  (version en place postérieure à `2026-11-14`) : `VERT`. `suite --etapes 9 --compact` sur la base sans la 9 : VERT, md5 noté.
- [ ] **Step 2 : filets.** `node --test "tests/*.test.mjs"`, robot `--habillages ecsr,ecf` (verrou ouvert au banc : parcours
  `inviter_un_intervenant` avec Secrétariat du catalogue), `verifier_navigation.py`, contrôle U+2014.
- [ ] **Step 3 : préparer et signaler** (la coordination fusionne et applique, avec l'accord explicite de Timy) : le texte des
  conditions, à faire lire par Timy ; les migrations 4 et 9 et leurs verdicts ; l'ordre de mise en ligne du § 6.O.

### 6.O Ordre de mise en ligne (étapes 3 et 4)

Chaque application en production : essai à blanc d'abord (texte `--compact` de l'assembleur, joué par Timy par
`outils/psql_prod.sh` ou par la session principale avec son accord explicite, hors des heures de cours), puis application
`psql -1 -v ON_ERROR_STOP=1 -f`, puis preuves après, en production. Un ROUGE après application : le retour de la migration aussitôt
(accord donné avec l'application), puis diagnostic.

1. **Correctifs de base** (Tasks 20 à 24) : migration 7. Rien ne change à l'écran. Aucune entrée Nouveautés (rien de visible).
2. **Écrans** (Tasks 25 à 34) : migration 8, puis fusion de l'app et poussée (jeton par le crochet). Verrou fermé : seuls les titres
   fixes se donnent, les écrans montrent les titres. Nouveautés de l'étape 3 dans le même commit que les écrans.
3. **Étape 4** (Tasks 35 à 39), le même jour, dans cet ordre :
   1. Timy a lu et accepté le texte des conditions (Task 36) ; la date du jour remplace `2026-11-15` dans `VERSION_CONDITIONS`.
   2. Essai à blanc puis application de `20261112_titres_4_journal.sql`, puis de `20261115_titres_9_catalogue.sql` (le catalogue
      entre ainsi dans le journal).
   3. Fusion de l'app (conditions, Nouveautés, guide) et poussée : chaque compte accepte la nouvelle version à sa prochaine
      ouverture (une seule acceptation pour tous).
   4. Le même jour, après la poussée : `psql -1 -v ON_ERROR_STOP=1 -v version=<date du jour> -f
      supabase/migrations/20261114_autonomie_2_version.sql` (sinon l'e-learning exigerait encore `2026-11-14` ; elle refuse une date
      future et un recul), puis `tests/sql/autonomie-preuve.sql` en ligne.
   5. Preuves après : celles de la Task 34, Step 2, en production.
   6. Déploiement de la fonction `chatbot` (accord explicite de Timy).
4. **Ouverture du verrou** : geste de Timy dans Réglages du fondateur (« Ouvrir les titres à la carte »), quand il le décide, après la
   mise en ligne des conditions. Aucune migration.

Taille estimée de l'étape 4 : migration 9 environ 80 lignes et retour 40 ; preuve 250 ; conditions 30 lignes de texte ; Nouveautés et
guide 60. Cinq tâches (35 à 39).

---

## 7. Décisions

**Tranchées par Timy le 12/11** (« Tes recommandations sont logiques ») : **T1 à T17** comme proposés (sections 3 et 4 ci-dessus,
textes inchangés) ; **D1** créer ou ajuster un titre de centre, et ajuster un titre du réseau de niveau promo, réservé au Siège fixe et
au fondateur (Task 21) ; **D2** le verrou porte sur le seul don ; **D3** seconde adresse acceptée ; **D4** jamais deux versions d'un
titre dans un centre (Task 22) ; **D5** un retour s'arrête tant qu'un titre non fixe est porté (Task 24) ; **D6** T1 à T17 gardées.

Rappel des propositions T1 à T17 :
- **T1** Gestes définitifs non cités au § 5.5 (purge des bénévoles par la direction, suppression directe d'un bénévole) : titres fixes
  seuls.
- **T2** Droits sans page de la Direction de centre en plus du § 5.6 (planning, élèves bénévoles, auto-écoles, suivis) : titre fixe seul.
- **T3** Suppression du profil d'un compte stagiaire : « Stagiaires : Modifier ».
- **T4** `notes_stats_groupe` gardée par « Notes et examens ».
- **T5** Signalements de QCM et brouillons de l'IA lus sous « Cours et QCM : Modifier » seulement.
- **T6** `is_admin()` devient « Cours et QCM : Modifier ».
- **T7** Journal : purge à l'écriture des lignes de plus de 3 ans.
- **T8** Étape 1 sans entrée Nouveautés.
- **T9** `inviter_compte` et `regler_affectations_formateur` gardent leur signature ; l'invitation avec un titre est `donner_titre`.
- **T10** `retirer_titre` en 2a pour les titres fixes, étendu en 2b.
- **T11** Lignes d'affectation des formateurs lues sous Promos : Voir ou Équipe : Voir.
- **T12** `roles_du_personnel()` suit Réglages de la promo, Équipe ou Directions de centre.
- **T13** Donner un titre à qui en a un autre au même niveau le remplace, avec les règles du retrait.
- **T14** Contrainte `titres_centre_requis` levée (titres du réseau de niveau promo ou centre).
- **T15** Le fondateur hors aperçu échappe à « jamais sur soi ».
- **T16** Le verrou bloque le don, pas la création ni l'ajustement.
- **T17** Passage des porteurs à la version du centre par retrait puis repose.

**Propositions de l'étape 3 (§ 5.D), retenues sauf avis contraire de Timy** : M3 (l'app passe par `donner_titre`), M4, M5, M7, M10,
aperçu par titre par l'en-tête `x-apercu-titre`, `titres_ajustables`.

**Ce qui reste à Timy**
- Lire et accepter le texte des conditions (Task 36) avant la mise en ligne de l'étape 4 ; il est au vouvoiement comme tout
  `js/legal-data.js` (le cahier des charges parlait de tutoiement pour les stagiaires : le fichier ne tutoie nulle part).
- Confirmer l'extension de D1 à la **création** d'un titre du réseau de niveau promo (Task 21 ; une ligne de preuve à retirer s'il
  dit non).
- Ouvrir le verrou (`regler_titres_ouverts(true)`) depuis Réglages du fondateur, quand il le décide.
- Donner son accord explicite à chaque essai à blanc et à chaque application (migrations 7, 8, 4, 9, `autonomie_2_version` rejouée)
  et au déploiement de l'assistant.

**Écarts à la spec, à relire** : § 7 (tableau) restreint par D1 ; § 14 (T9, signatures gardées) ; § 9 (phrase du journal : le nom
quand la page le connaît, sinon l'adresse) ; § 12 (version des titres seule, Q4 et Q5 étant en ligne) ; § 15 (Nouveautés aussi à
l'étape 3, règle du projet).
