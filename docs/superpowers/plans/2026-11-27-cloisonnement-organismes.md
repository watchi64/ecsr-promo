# Cloisonnement par organisme : plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** qu'un compte d'un organisme (siège, direction, formateur, stagiaire, fondateur hors support) ne voie, ne compte et
ne modifie rien d'un autre organisme, sans aucune différence visible pour ECF, preuve SQL rejouable à l'appui.

**Architecture :** une table `organismes` ; chaque centre, siège, titre réseau, fiche `profs`, carte Ressources et signalement
de QCM y est rattaché. Les prédicats centraux (`est_formateur`, `est_direction`, `est_siege`, `peut_acceder_promo`, cases et
gestes) passent par l'organisme de la ligne jugée, le fondateur par `fondateur_sur(o)` et son journal `acces_fondateur`.
Quatre migrations (1 fondations, 2a noyau, 2b siège et titres, 2c données), chacune avec retour et garde md5, prouvées sur la
base locale par une preuve unique `tests/sql/cloisonnement-preuve.sql`, puis l'app (étape 3).

**Tech Stack :** PostgreSQL 17 (Supabase, RLS, fonctions `security definer`), base locale jetable
(`outils/base_locale/`), assembleur `outils/assembler_repetition_roles.mjs`, JavaScript vanilla en modules ES, tests
`node --test`, robot des parcours (Python, Playwright).

**Spec :** `docs/superpowers/specs/2026-11-27-cloisonnement-organismes-design.md` (commit 88b5003f). L'inventaire
fonction par fonction est dans les notes partagées de la session :
`C:\Users\watch\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_500b349f-fece-4800-a653-6944c32d188a\cloisonnement-inventaire.md`.

## Global Constraints

- **Rien en production** sans l'accord explicite de Timy ; `outils/psql_prod.sh` n'est jamais lancé dans ce plan. La fusion
  dans `main` revient à la session de coordination (local_ef2fa5b2-7428-4bd7-a3e4-5d2676c41680).
- Chaque migration : `set local lock_timeout = '3s';`, un bloc `do $garde$` qui vérifie le md5 (retours chariot retirés) de
  **chaque** corps de fonction qu'elle remplace et s'arrête sinon (« rien n'est changé »), un `_retour.sql` qui rend
  exactement l'empreinte d'avant (`tests/sql/roles-empreinte.sql`), un en-tête qui dit ce qu'elle change, sa garde, sa preuve.
- Les md5 des gardes se lisent sur la base locale rejouée à l'état de la production (tâche 1), jamais recopiés d'un fichier.
- Toute fonction nouvelle : `security definer`, `set search_path to 'public', 'pg_temp'`, droits explicites
  (`revoke all ... from public, anon` puis `grant execute ... to authenticated` si l'app l'appelle, sinon rien).
- Compatibilité des iPhone en cache : aux étapes 1 et 2, aucune colonne ni fonction lue par l'app actuelle ne disparaît ni ne
  change de signature ou de type ; une insertion de l'ancienne app sans `organisme_id` doit réussir (tâche 2, remplissage).
- Organisme n° 1 : `nom = 'ECF BOUSCAREN'`, `redacteur = true`, `habillage` = valeur actuelle de `settings.habillage_reseau`.
- Accès support : durée maximale **2 heures**, motif obligatoire, un seul organisme actif à la fois pour le fondateur.
- Message de refus d'invitation hors organisme, mot pour mot : `Cette adresse ne peut pas être invitée ici.`
- Exemple du calendrier, mot pour mot : `Ex. Centre de formation de Pau (facultatif)`.
- Restent globaux : `signalements_app`, le verrou `titres_ouverts`, l'écriture des contenus communs par le fondateur,
  `effacer_adresse_journal`, les titres fixes (Formateur, Direction de centre, Siège).
- Charte : textes en français, **jamais de tiret cadratin** (U+2014) dans le code, les commentaires, les messages de commit ;
  vouvoiement dans l'app ; aucune boîte `confirm()` native (utiliser `js/confirmer.js`).
- Entrée Nouveautés dans le même commit que le changement visible (étape 3), pas avant.
- Un seul robot des parcours à la fois sur la machine ; lire la ligne de commande entière avant d'en arrêter un.

## Review Focus

1. **Ancienne app qui insère sans organisme** (iPhone en cache : création de centre, fiche `profs`, signalement de QCM,
   carte Ressources) : la ligne prend l'organisme du contexte de l'appelant, jamais nul, jamais celui d'un autre. Test :
   tâche 2, groupe `remplissage`.
2. **Support échu en pleine session** : l'en-tête `x-promo-id` désigne encore une promo de B ; `promo_courante()` retombe sur
   la promo par défaut d'ECF, sans erreur ni boucle. Test : tâche 3, groupe `support`.
3. **Aperçu du fondateur** (`x-apercu-role`) pendant un support : l'aperçu reste dans l'organisme actif, n'ouvre jamais A et
   B à la fois. Test : tâche 3, groupe `apercu`.
4. **Mêmes noms des deux côtés** : B crée un centre « Nîmes » et un titre réseau au nom d'un titre d'ECF : accepté ; un
   doublon dans le même organisme (casse ignorée) : refusé. Test : tâche 4, groupe `noms`.
5. **Adresse déjà connue ailleurs** : inviter dans B un formateur d'ECF est refusé avec le message exact ; inviter dans B un
   ancien stagiaire d'ECF comme formateur réussit, et ce compte ne lit rien des données d'ECF par son nouveau rôle. Test :
   tâche 5, groupe `personnel`.

---

### Task 1 : Base locale à l'état de la production du 27/11, verdicts de départ

La suite `rejouer_suite.sh --production` s'arrête au 16/11. Depuis, la production a reçu les migrations des contacts, du
journal des titres, des conditions et des EPCF du CCP2.

**Files :**
- Modify : `outils/base_locale/rejouer_suite.sh` (option `--production-2711`)
- Modify : `outils/base_locale/LISEZMOI.md` (option et verdicts de départ)
- Create : `tests/sql/cloisonnement-empreinte-corps.sql` (md5 des corps à remplacer)

**Interfaces :**
- Produces : `bash outils/base_locale/rejouer_suite.sh --production-2711` = `--production` puis, dans cet ordre,
  `20261115_contact_1_annuaire`, `20261115_contact_1b_fermeture`, `20261115_contact_2_demandes`, `20261115_contact_3_absences`,
  `20261115_contact_demo`, `20261116_contact_4_correctifs`, `20261118_contact_5_donnees_sensibles`, `20261112_titres_4_journal`,
  `20261121_conditions_version`, `20261123_epcf_ccp2`, `20261124_epcf_ccp2_reseau`. Sortie `OK : suite rejouée (41 migrations)`.
- Produces : `cloisonnement-empreinte-corps.sql`, une requête qui rend `nom(signature)|md5` pour chaque fonction de
  l'inventaire (§ 5.2 et § 5.3 de la spec) ; les gardes des tâches 3 à 5 y copient leurs md5.

- [ ] **Step 1 :** vérifier l'ordre réel d'application dans l'historique (`git log --first-parent main` sur ces fichiers, en-têtes
  de `tests/sql/contact-donnees-preuve.sql`, mémoire `[[espace-contact-demandes]]`, `[[titres-droits-carte]]`) ; corriger la liste
  ci-dessus si un écart apparaît et l'écrire dans le commentaire de l'option. `20261121_conditions_version` lit-elle une variable
  psql ? Si oui, passer la valeur de la production (en-tête de la migration).
- [ ] **Step 2 :** ajouter l'option ; `reconstruire.sh` puis `rejouer_suite.sh --production-2711` : attendu `OK : suite rejouée (41 migrations)`.
- [ ] **Step 3 :** jouer en mode « en ligne » chaque preuve existante : rôles, espaces, données, titres, gestion, suite, les cinq
  contacts, EPCF, comptes EPCF CCP2, profils, questionnaires, registre, conservation, conditions, émargement, jury. Noter chaque
  verdict dans `LISEZMOI.md` (« verdicts de départ, état du 27/11 »). Un ROUGE ici n'est pas à corriger dans ce chantier :
  il devient la référence, avec sa raison en une ligne.
- [ ] **Step 4 :** écrire `cloisonnement-empreinte-corps.sql`, le jouer, garder la sortie dans le commentaire d'en-tête.
- [ ] **Step 5 :** commit `Base locale : état de la production du 27/11 et verdicts de départ`.

---

### Task 2 : Étape 1, fondations invisibles

**Files :**
- Create : `supabase/migrations/20261128_cloisonnement_1_fondations.sql` et `_retour.sql`
- Create : `tests/sql/cloisonnement-preuve.sql` (gabarit, groupes `structure`, `fondations`, `remplissage`, `retour`)
- Create : `tests/sql/cloisonnement-aides.sql` (organisme B fictif et ses personnages, réutilisés par toutes les tâches)
- Modify : `outils/assembler_repetition_roles.mjs` (modes `cloisonnement [--etapes 1|1,2a|1,2a,2b|1,2a,2b,2c]`,
  `cloisonnement-contre-epreuve`, `cloisonnement-en-ligne`, `cloisonnement-sabotage`)
- Test : `tests/assembler-roles.test.mjs` (les nouveaux modes)

**Interfaces :**
- Produces (tables) :
  - `organismes(id integer generated always as identity primary key, nom text not null unique, redacteur boolean not null default false, habillage text not null check (habillage in ('ecsr','ecf')), cree_le timestamptz not null default now())` ; RLS active, aucune règle d'écriture.
  - `lieux.organisme_id integer not null references organismes`, index unique `(organisme_id, lower(nom))` ; l'ancienne unicité
    de `lieux.nom` est **gardée** à cette étape (retirée en 2b).
  - `affectations.organisme_id integer references organismes`, rempli pour `siege` (organisme 1).
  - `titres.organisme_id integer references organismes`, rempli (organisme 1) pour les titres `reseau` non fixes.
  - `journal_droits.organisme_id integer`, rempli d'après la ligne (centre, promo ou titre) ; organisme 1 sinon.
  - `profs.organisme_id`, `ressources.organisme_id` (nul = commune), `qcm_signalements.organisme_id` : tout l'existant sur 1.
  - `acces_fondateur(id bigint identity, email text not null, organisme_id integer not null references organismes, ouvert_le timestamptz not null default now(), ferme_le timestamptz, motif text, ouvert_par text not null default lower(auth.jwt() ->> 'email'))`,
    une ligne de rattachement (`ferme_le` nul, motif nul) sur l'organisme 1 pour chaque compte `is_founder`.
- Produces (fonctions, non appelées par les règles à cette étape) :
  `organisme_de_lieu(p_lieu integer) returns integer`, `organisme_de_promo(p_promo integer) returns integer`,
  `organisme_actif_fondateur() returns integer`, `fondateur_sur(p_organisme integer) returns boolean`,
  `organisme_courant() returns integer`, `est_siege_de(p_organisme integer) returns boolean`,
  `organisme_redacteur_courant() returns boolean`,
  `mon_organisme() returns table(id integer, nom text, redacteur boolean, habillage text, support_jusqua timestamptz)`,
  `organismes_pour_support() returns table(id integer, nom text)` (fondateur réel seulement, sinon 42501),
  `ouvrir_acces_support(p_organisme integer, p_motif text, p_duree interval default '2 hours') returns acces_fondateur`,
  `fermer_acces_support() returns void`.
  `mon_organisme`, `organismes_pour_support`, `ouvrir_acces_support`, `fermer_acces_support` : `grant execute to authenticated`.
- Produces (déclencheur) `_organisme_par_defaut()` sur `lieux`, `profs`, `ressources`, `qcm_signalements`, `affectations`
  (rôle siège), `titres` (réseau non fixe) : si `organisme_id` est nul, prendre `organisme_courant()` ; s'il reste nul et que
  l'appelant est `postgres` ou `service_role` et qu'un seul organisme existe, prendre celui-là ; sinon lever
  `Organisme introuvable pour cette ligne.` (22023). Exception : `ressources` (nul = commune, laissé nul seulement si l'appelant
  écrit les contenus communs ; décidé en 2c, à cette étape tout nul devient 1).

Règles du journal du fondateur (déclencheur sur `acces_fondateur`) : `delete` refusé ; `update` refusé sauf avancer `ferme_le`
d'un support vers `now()` ; insertion seulement par `ouvrir_acces_support` (aucun `grant insert`). `ouvrir_acces_support` refuse
(42501) un non-fondateur, (22023) un motif de moins de 10 caractères après `trim`, une durée nulle ou supérieure à 2 heures,
l'organisme du rattachement ; il ferme d'abord tout support encore ouvert. Lecture : le fondateur ; le siège de l'organisme
de la ligne (`est_siege_de`). `organisme_actif_fondateur()` : le support non fermé et non échu le plus récent, sinon le
rattachement, sinon nul.

- [ ] **Step 1 : écrire les aides et les groupes de la preuve.** `cloisonnement-aides.sql` crée dans la transaction
  l'organisme B (« Organisme B fictif », non rédacteur), un centre B au **même nom** qu'un centre d'ECF, une promo B, deux
  stagiaires, un siège, une direction, un formateur, un titre réseau au nom d'un titre réseau d'ECF, une fiche d'annuaire,
  une fiche `profs` au nom d'une fiche d'ECF, un signalement de QCM, une carte Ressources ; et les personnages d'ECF (siège,
  direction, formateur, stagiaire, fondateur). Elle s'appuie sur `roles-aides.sql` et `titres-aides.sql` (fonctions
  `pg_temp` pour jouer un personnage : jwt, en-têtes). Groupes de cette tâche :
  - `fondations` : tout l'existant sur l'organisme 1 (`count(*) where organisme_id is null` = 0 sur chaque table, hors
    `ressources` communes) ; organisme 1 = `ECF BOUSCAREN`, rédacteur, habillage égal à l'ancien réglage ; un rattachement par
    fondateur ; `mon_organisme()` rend ECF pour chaque personnage d'ECF et B pour ceux de B ; `organismes_pour_support()`
    refusée (42501) à tous sauf au fondateur.
  - `support-journal` : motif court, durée 3 h, organisme du rattachement : refusés avec leur code ; `update` du motif,
    `delete`, `update` de `ferme_le` vers le futur : refusés ; fermeture anticipée : acceptée.
  - `remplissage` (Review Focus 1) : insertion sans `organisme_id` dans `lieux`, `profs`, `qcm_signalements`, `ressources`
    par un personnage d'ECF, puis par un de B : chaque ligne porte l'organisme de son auteur ; par `postgres` quand B existe :
    refus `Organisme introuvable pour cette ligne.`
  - `retour` : après le retour, l'empreinte égale celle d'avant (`roles-empreinte.sql`), tables et colonnes disparues.
- [ ] **Step 2 :** assembler `cloisonnement-contre-epreuve` et jouer : ROUGE attendu sur `fondations`, `support-journal`,
  `remplissage`.
- [ ] **Step 3 :** écrire la migration et son retour (gabarit : `20261124_epcf_ccp2_reseau.sql` pour l'en-tête et la garde).
- [ ] **Step 4 :** `cloisonnement --etapes 1` : VERT sur les groupes de cette tâche ; puis appliquer la migration à la main
  (`psql -1 -f`) et rejouer toutes les preuves de la tâche 1 : verdicts identiques aux verdicts de départ.
- [ ] **Step 5 :** `node --test tests/assembler-roles.test.mjs` : PASS. Commit
  `Cloisonnement, étape 1 : organismes, rattachements et journal du fondateur (invisible)`.

---

### Task 3 : Étape 2a, le noyau (fondateur borné, organisme courant)

**Files :**
- Create : `supabase/migrations/20261128_cloisonnement_2a_noyau.sql` et `_retour.sql`
- Modify : `tests/sql/cloisonnement-preuve.sql` (groupes `noyau`, `support`, `apercu`, `matrice` partie 1)

**Interfaces :**
- Consumes : tâche 2 (vocabulaire, `acces_fondateur`).
- Produces (mêmes signatures, nouveau sens) : `est_formateur(p)`, `est_direction(l)` vrais pour le fondateur seulement si
  `fondateur_sur(organisme de p ou l)` ; `est_siege()` = `est_siege_de(organisme_courant())` ; `peut_acceder_promo(p)`,
  `mes_promos()`, `promo_par_defaut()` bornés à l'organisme actif pour le fondateur ; `case_promo`, `case_centre`,
  `case_reseau`, `siege_fixe`, `geste_promo`, `geste_centre`, `geste_reseau` jugés sur l'organisme de la promo, du centre ou
  `organisme_courant()`. Aperçu : `apercu_role()` inchangé, mais toute vérité « fondateur » sous aperçu passe aussi par
  `fondateur_sur`.

- [ ] **Step 1 : écrire les groupes.**
  - `noyau` : pour chaque personnage d'ECF et de B, `est_formateur`, `est_direction`, `est_siege`, `peut_acceder_promo` sur une
    promo et un centre de chaque organisme : vrai seulement chez soi ; `mes_promos()` du fondateur hors support = promos d'ECF
    seulement ; `geste_reseau('centres.creer')` du siège de B vrai, appliqué à ECF faux.
  - `support` (Review Focus 2) : le fondateur ouvre un support sur B : `mes_promos()` = promos de B seulement, `est_siege()`
    vrai pour B, faux pour ECF ; on avance l'horloge de la transaction au-delà de l'échéance (fonction `pg_temp.maintenant`
    des aides, ou ligne de support antidatée) : `mes_promos()` = ECF ; avec `x-promo-id` d'une promo de B,
    `promo_courante()` = `promo_par_defaut()` d'ECF, sans erreur.
  - `apercu` (Review Focus 3) : fondateur en support sur B, aperçu `formateur` puis `siege` : seulement B ; hors support :
    seulement ECF.
  - `equivalence-ecf` : sur l'organisme 1 seul (B non créé), chaque prédicat et geste du noyau égale l'ancien pour chaque
    personnage de `titres-preuve.sql` (reprendre sa requête d'équivalence) : 0 écart.
- [ ] **Step 2 :** `cloisonnement --etapes 1` : ROUGE attendu sur `noyau`, `support`, `apercu` ; VERT sur `equivalence-ecf`.
- [ ] **Step 3 :** écrire la migration (gardes md5 de chaque corps remplacé, tâche 1) et son retour.
- [ ] **Step 4 :** `cloisonnement --etapes 1,2a` : VERT sur tous les groupes écrits jusqu'ici. Appliquer 1 et 2a à la main
  et rejouer les preuves de la tâche 1 : verdicts identiques aux verdicts de départ.
- [ ] **Step 5 :** commit `Cloisonnement, étape 2a : prédicats du fondateur et du siège bornés à l'organisme`.

---

### Task 4 : Étape 2b, siège et titres

**Files :**
- Create : `supabase/migrations/20261128_cloisonnement_2b_siege_titres.sql` et `_retour.sql`
- Modify : `tests/sql/cloisonnement-preuve.sql` (groupes `siege`, `titres`, `noms`)

**Interfaces :**
- Consumes : tâches 2 et 3.
- Produces : `comptes_reseau()` (mêmes 19 colonnes) limité aux centres de `organisme_courant()` ; `creer_centre(p_nom)` pose
  l'organisme courant, verrou consultatif `2026110801` + organisme, doublon jugé dans l'organisme ; unicité globale de
  `lieux.nom` retirée ; `regler_habillage_reseau(text)` écrit `organismes.habillage` de l'organisme courant (et toujours la clé
  `settings.habillage_reseau` quand l'organisme est 1, pour les iPhone en cache) ; `habillage_par_defaut()` lit
  `organismes.habillage` ; `roles_du_personnel()`, `lieux_lecture`, `affectations_lecture`, `inviter_compte` (branche direction :
  centre de l'organisme ; branche siège : paramètre d'organisme borné à l'organisme actif du fondateur) ; toutes les fonctions
  de titres de la ligne « Titres » du § 5.3 : titres réseau de l'organisme, unicité `titres_portee_nom` remplacée par
  `(organisme_id, lieu_id, lower(nom)) nulls not distinct`, un titre réseau donné crée une affectation siège sur l'organisme du
  titre ; `journal_des_droits` filtré par `journal_droits.organisme_id`.

- [ ] **Step 1 : écrire les groupes.**
  - `siege` : siège de B : `comptes_reseau()` ne rend que le centre B, `creer_centre` crée dans B, `roles_du_personnel()` ne
    nomme personne d'ECF, `lieux` et `affectations` lus : B seulement ; même chose en miroir pour le siège d'ECF ; l'habillage
    réglé par B ne change pas celui d'ECF.
  - `titres` : le siège de B ne voit, ne donne, n'ajuste, ne supprime aucun titre réseau d'ECF (refus sans `RETURNING`) ;
    `personnes_et_titres` et `journal_des_droits` : rien d'ECF ; donner un titre réseau de B crée une affectation siège sur B.
  - `noms` (Review Focus 4) : centre « Nîmes » (nom d'un centre d'ECF) créé par B : accepté ; « nîmes » recréé par ECF : refusé ;
    titre réseau au nom d'un titre d'ECF créé par B : accepté ; doublon dans B : refusé.
- [ ] **Step 2 :** `cloisonnement --etapes 1,2a` : ROUGE attendu sur ces trois groupes.
- [ ] **Step 3 :** écrire la migration (gardes md5) et son retour.
- [ ] **Step 4 :** `cloisonnement --etapes 1,2a,2b` : VERT sur tous les groupes ; non-régression comme en tâche 3, avec
  attention à `espaces-preuve.sql` (doublon de `creer_centre`) et `titres-gestion-preuve.sql`.
- [ ] **Step 5 :** commit `Cloisonnement, étape 2b : siège et titres bornés à l'organisme`.

---

### Task 5 : Étape 2c, données (personnel, annuaire, planning, contenus, qualité)

**Files :**
- Create : `supabase/migrations/20261128_cloisonnement_2c_donnees.sql` et `_retour.sql`
- Modify : `tests/sql/cloisonnement-preuve.sql` (groupes `personnel`, `annuaire`, `planning`, `contenus`, `signalements`,
  `qualite`, `matrice` complète, `sabotage`)

**Interfaces :**
- Consumes : tâches 2 à 4.
- Produces :
  - Personnel : déclencheur sur `affectations` qui refuse une affectation dans un autre organisme que celui des affectations
    existantes de la même adresse (`Cette adresse ne peut pas être invitée ici.`, 23514) ; `inviter_compte` rend le même refus
    avant d'écrire ; `user_profiles_lecture`, `_contact_compte_equipe`, `user_profiles_suppression`,
    `conditions_acceptations_lecture`, `effacements_journal_lecture` jugés sur l'organisme du profil lu. Organisme d'un profil :
    `organisme_de_compte(p_email text) returns integer` = organisme de ses affectations, sinon de la promo de sa fiche
    stagiaire la plus récente, sinon de son invitation en cours (à lire dans la table qu'utilise `inviter_compte`).
  - Annuaire : `_contact_avant_ecriture` refuse un centre de partage hors organisme ; `_contact_fiche_dans`, `annuaire_centre`,
    `_contact_relais_possibles`, `ma_fiche_contact` limités aux centres de l'organisme.
  - Planning : `profs` lecture et écriture bornées à l'organisme ; unicité `profs.nom` par organisme.
  - Contenus communs : `geste_promo` pour `contenus.rediger`, `contenus.lire_internes`, `contenus.traiter`,
    `referentiel.modifier` et `case_reseau('cours')` exigent `organisme_redacteur_courant()` ; lecture des contenus publiés
    inchangée ; `ressources` : nul = commune (lue par tous, écrite par le rédacteur), sinon lue et écrite par l'organisme.
  - Signalements de QCM : lus et traités par l'équipe de l'organisme de la ligne ; `qcm_signalement_instruction` et
    `qcm_ia_brouillons` réservés au rédacteur ; le rédacteur ne lit pas `stagiaire_id` d'un signalement de B.
  - Qualité et conservation : `peut_gerer_qualite()` et ses appelants jugés par `fondateur_sur` sur l'organisme de la promo, du
    lieu ou de la ligne ; `registre_qualite.organisme_id` (rempli d'après l'auteur, existant sur 1) si une ligne n'a ni promo
    ni lieu.

- [ ] **Step 1 : écrire les groupes.**
  - `personnel` (Review Focus 5) : inviter dans B un formateur d'ECF : refus, message exact ; inviter dans B un ancien stagiaire
    d'ECF comme formateur : accepté, et ce compte, joué en formateur de B, lit 0 ligne d'ECF dans la matrice ; aucun
    personnage de B ne lit un profil du personnel d'ECF, et inversement.
  - `annuaire`, `planning`, `contenus` (B lit cours et QCM publiés, n'écrit ni cours, ni question, ni option, ni image, ni
    thème, ni compétence ; ECF écrit), `signalements`, `qualite` (fondateur hors support : registre, questionnaires,
    `etat_conservation`, `effacer_*` de B refusés ; en support sur B : ouverts, et ceux d'ECF refusés).
  - `matrice` : pour chaque personnage des deux organismes, chaque table de données de l'inventaire et chaque fonction de
    lecture : 0 ligne de l'autre organisme ; chaque écriture vers l'autre organisme refusée (sans `RETURNING`). La liste des
    tables est lue dans `pg_tables` (schéma `public`) moins une liste d'exceptions écrite en dur et justifiée ligne par ligne
    (`signalements_app`, tables de contenus communs, tables sans donnée d'organisme) : une table nouvelle non classée fait
    rougir la preuve.
  - `sabotage` : le mode `cloisonnement-sabotage` injecte après 2c une règle relâchée (`profs` lisible par tous) : ROUGE attendu
    sur `planning` et `matrice` seulement.
- [ ] **Step 2 :** `cloisonnement --etapes 1,2a,2b` : ROUGE attendu sur ces groupes.
- [ ] **Step 3 :** écrire la migration (gardes md5) et son retour.
- [ ] **Step 4 :** `cloisonnement` (toutes étapes) : VERT ; `cloisonnement-sabotage` : ROUGE attendu ; appliquer 1 à 2c à la
  main, `cloisonnement-en-ligne` : VERT ; rejouer toutes les preuves de la tâche 1 : verdicts identiques aux verdicts de départ.
- [ ] **Step 5 :** commit `Cloisonnement, étape 2c : personnel, annuaire, planning, contenus et qualité bornés`.

---

### Task 6 : Étape 3, l'app

**Files :**
- Create : `js/organisme-rules.js`, `tests/organisme-rules.test.mjs`
- Create : `js/views/acces-support.js` (écran du fondateur)
- Modify : `js/db.js` (`ENTETE_EMARGEMENT_DEFAUT` l. 2501, nouvelles fonctions de lecture), `js/views/epcf-livret.js:435`,
  `js/views/calendrier.js:109`, `_apercu_attestations.html:34`, `js/nav-shell.js` (bandeau), `js/views/config.js`
  (entrée des réglages du fondateur), `js/nouveautes-data.js`, `chatbot/aide.mjs` et `tests/chatbot-aide.test.mjs`

**Interfaces :**
- Consumes : `mon_organisme()`, `organismes_pour_support()`, `ouvrir_acces_support(p_organisme, p_motif, p_duree)`,
  `fermer_acces_support()` (tâche 2).
- Produces : dans `js/db.js`, `lireMonOrganisme() -> Promise<{id, nom, redacteur, habillage, supportJusqua: Date|null}>`
  (mémorisée pour la session, `nom` repli `""` en cas d'erreur réseau, jamais « ECF BOUSCAREN »), `lireOrganismesSupport()`,
  `ouvrirAccesSupport(id, motif)`, `fermerAccesSupport()` ; dans `js/organisme-rules.js`,
  `texteBandeauSupport(nom: string, jusqua: Date) -> string` et `motifSupportValide(motif: string) -> boolean`.

- [ ] **Step 1 : tests node.** `texteBandeauSupport("Organisme B", new Date("2026-11-28T15:05:00+01:00"))` =
  `Accès support : Organisme B, jusqu'à 15 h 05` (heure de Paris) ; `motifSupportValide("  court ")` = false,
  `motifSupportValide("Aide au réglage des titres")` = true (10 caractères au moins après `trim`, comme la base).
- [ ] **Step 2 :** `node --test tests/organisme-rules.test.mjs` : FAIL (module absent). Écrire le module ; PASS.
- [ ] **Step 3 :** remplacer les valeurs d'ECF en dur par `lireMonOrganisme().nom` (émargement, livret, attestations) et
  l'exemple du calendrier par la valeur des Global Constraints ; écran « Accès support » (liste des organismes, motif, bouton
  « Ouvrir un accès support », confirmation par `js/confirmer.js`) visible du seul fondateur hors aperçu ; bandeau permanent
  avec « Fermer » dans `nav-shell.js` ; à l'ouverture et à la fermeture, rechargement de la promo courante.
- [ ] **Step 4 :** entrée Nouveautés (le nom de l'organisme sur les documents ; rien sur le support, réservé au fondateur) ;
  relire dans `chatbot/aide.mjs` les passages qui supposent un seul réseau, adapter et mettre à jour son test.
- [ ] **Step 4 bis : fonctions serveur.** `supabase/functions/qcm-ia` : son droit `is_admin()` doit valoir « peut traiter les
  contenus » (rédacteur) ; le remplacer par l'appel d'un geste borné si `is_admin()` ne passe pas déjà par le noyau.
  `supabase/functions/contact-envois` : vérifier que rien n'y lit une donnée hors de la ligne envoyée. Ni l'une ni l'autre
  n'est déployée dans ce plan : le déploiement va au dossier d'accord (tâche 7).
- [ ] **Step 5 :** `node --test "tests/*.test.mjs"` : PASS, dont `modules.test.mjs` et `chargement.test.mjs`. Commit
  `Cloisonnement, étape 3 : accès support du fondateur et nom de l'organisme sur les documents`.

---

### Task 7 : Robot des parcours et dossier d'accord

**Files :**
- Modify : `outils/parcours/` (parcours de l'accès support, selon le skill)
- Create (notes partagées, hors dépôt) : `cloisonnement-dossier-accord.md`

- [ ] **Step 1 :** invoquer le skill `robot-des-parcours` et suivre sa procédure : banc reconstruit avec les migrations 1 à
  2c, parcours existants, plus un parcours « fondateur : ouvrir un support sur B, voir le bandeau, fermer, retrouver ECF ».
  Attendu : VERT.
- [ ] **Step 2 :** écrire `cloisonnement-dossier-accord.md` : ce qui change pour qui, ordre d'application en production
  (1, 2a, 2b, 2c, puis fusion de l'app et redéploiement de l'assistant), preuves et verdicts, retours, ce que Timy doit faire.
  L'étape 4 de la spec (ménage : clé `settings.habillage_reseau`, `redacteur_contenus()`) n'est pas dans ce plan : elle y
  figure comme suite, une fois les iPhone à jour.
- [ ] **Step 3 :** demander à Timy son accord pour la mise en ligne, sans rien lancer avant ; prévenir la session
  « Document neutre sur la confidentialité » (local_8bcc92ee-7586-49d2-8007-38bebddaaf95) que l'accès support existe (motif,
  2 heures, journal lisible par le siège), pour le texte des conditions.
