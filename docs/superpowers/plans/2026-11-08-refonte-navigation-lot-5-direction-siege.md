# Lot 5 de la refonte : espaces direction et siège (plan de mise en œuvre)

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (mode choisi : un agent par
> tâche, une relecture avant la suivante, relecture finale de toute la branche par le modèle le plus capable). Étapes en
> cases à cocher (`- [ ]`).

**But :** ouvrir l'espace de la direction (un centre) et celui du siège (le réseau), chacun avec sa barre, ses pages et
ses droits vérifiés par la base, et permettre au fondateur de regarder chacun d'eux séparément depuis « Voir en tant
que », comme il le fait déjà pour formateur et stagiaire (demande de Timy du 30/10).

**Architecture :** l'app connaît désormais quatre espaces (stagiaire, formateur, direction, siège) ; un compte peut en
avoir plusieurs et passe de l'un à l'autre par son menu, le fondateur y entre par l'aperçu. La direction lit les données
brutes des promos de son centre (comme le tableau de bord du centre aujourd'hui) et l'app calcule ; le siège ne lit que
des comptes agrégés par centre calculés par la base, sans aucun nom. Une même fixture fige les définitions des deux
calculs, pour que direction et siège donnent les mêmes chiffres d'un même centre.

**Technique :** modules ES sans framework, `node --test`, PostgreSQL 17 (Supabase `crpduennbqaemhfaywrz`), fonctions
`security definer`, preuves SQL rejouables (`tests/sql/`, assembleur du lot 4), banc d'essai (`_harness.html`), robot des
parcours (`python outils/robot_parcours.py`, parcours dans `outils/parcours/`, règles dans `docs/qualite/referentiel.md`)
et `outils/verifier_navigation.py` (Chromium et WebKit).

**Spec :** `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md` (§ 4.2 Direction et Siège, § 4.3,
§ 4.4, § 6 : décisions du 27/10, dont « pas de données nominatives au siège ») ; découpage
`docs/superpowers/plans/2026-10-27-refonte-navigation-lots.md` (lot 5) ; maquette
`docs/maquettes/refonte-navigation.src.html` (fonctions `dPromos` à `sReglages`, objet `ROLES`) ; lot 4
`docs/superpowers/plans/2026-10-28-refonte-navigation-lot-4-roles.md` (modèle, vocabulaire, matrice) ; tableau de bord du
centre `docs/superpowers/specs/2026-10-23-tableau-de-bord-centre-design.md` ; dossier Qualiopi
`docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md` (§ 6.9).

## Ce que ce lot suppose (à vérifier avant la Task 1)

| Prérequis | Ce que le plan en utilise | Si la forme finale diffère |
|---|---|---|
| Lot 4 fusionné dans `main` ET appliqué en base | table `affectations` ; `est_formateur`, `est_direction`, `est_siege`, `est_fondateur`, `lieu_de_promo`, `redacteur_contenus`, `apercu_role` ; `inviter_compte`, `creer_promo`, `modifier_dates_promo` ; `mes_promos().roles` ; en-tête `x-apercu-role` ; `js/roles-rules.js` (`droitsAffiches`, `apercusPermis`, `normaliserApercu`, `messageInvitation`, `messageSansPromo`) ; `js/db.js` (`mesRolesAffectes`, `poserApercu`, `inviteUser`, `renommerPromo(id, nom)`) ; `js/auth-admin.js` (`setViewAs`, `buildViewAsBlock`) ; `tests/sql/roles-aides.sql` (`incarner(email, promo, apercu)`, `verifier`) ; `outils/assembler_repetition_roles.mjs` (repères `-- @@INJECTER <chemin>@@` et `-- @@INCLURE <chemin>@@`, option `--compact`) ; banc `?compte=direction|siege|sansrole|ancien|cumul` (Task 8b du lot 4). Le lot 4 ouvre déjà à la direction, dans Réglages, l'ajout, l'abandon, l'invitation et l'anonymisation des stagiaires (d424c82) : la Task 9 les déplace | relire `git log main`, le registre du lot 4 et son « Reste pour le lot 5 » (`task-8b-report.md`), puis corriger les noms de ce plan avant la Task 1 (ruling à noter) |
| Lot 3 (habillage) fusionné | aucune couleur à retoucher ici ; garde des couleurs en dur `tests/habillage-jetons.test.mjs` (tout `js/**` et les CSS) ; la Partie E branche les défauts du centre et du réseau sur la résolution du lot 3. Signalé au lot 3 le 08/11 et repris dans son plan (be8eaa1) : l'appareil marque `choisi`, un défaut appliqué n'est jamais retenu ni envoyé au compte | Partie E réécrite sur l'interface réelle ; si l'appareil ne fait pas la distinction, la Task 14 commence par elle (dans les modules du lot 3, tests compris) |
| Lot 2B (nouvelles pages) fusionné, s'il passe avant | identifiants des entrées et des sous-onglets de Cours et QCM, guide de l'assistant `AIDE_APP_V2` | aligner les identifiants cités dans les Tasks 2, 13 et 15 |
| Robot des parcours (fusionné dans `main` le 08/11, e638f27) | `python outils/robot_parcours.py` (code 0 vert, 1 rouge, 2 non jugé) ; un parcours = une fonction `@parcours` dans `outils/parcours/` ; pages connues de `outils/parcours/navigation.py` ; défauts déjà présents dans `outils/parcours/connus.py` | sans objet |
| Outillage SQL du lot 4 : base locale jetable (PostgreSQL, script de reconstruction) et lanceur psql de production | restés dans le scratchpad de la session du lot 4, hors dépôt (`progress.md` du lot 4, R35) | la Task 5 commence par les verser dans `outils/` |

La branche part de `main` après ces fusions : worktree `C:/Users/watch/Dev/ecsr-promo-lot5`, branche `lot5-espaces`.

## Global Constraints

- Aucun tiret cadratin (U+2014) nulle part : code, SQL, commits, Nouveautés, réponses. Contrôle en Python
  (`chr(0x2014)`), pas par `git grep` dans le bash de ce poste.
- « Formateur », jamais « Prof » à l'écran ; tutoiement dans tous les textes de l'app, comme aujourd'hui.
- Aucun nom ni e-mail réel dans le dépôt (il est public) : personnages fictifs `@exemple.invalid`, comptes réels choisis
  par requête.
- Aucune couleur écrite en dur dans les fichiers de ce lot (le lot 3 les a chassées) : classes et jetons existants
  seulement. Contrôlé par la garde du lot 3 (`tests/habillage-jetons.test.mjs`), qui couvre déjà tout `js/**`.
- Aucun défilement de côté, à aucune largeur ; tableaux en listes hors ordinateur ; cibles de 44 px sur téléphone ;
  contraste AA ; jamais une note en rouge.
- Toute écriture qu'un rôle n'a pas en base est masquée côté app ; tout refus de la base s'affiche par sa phrase
  (`phraseDeRefus`), toute écriture qui ne touche aucune ligne le dit. Aucun bouton ne mène à un refus silencieux, aucune
  page à une impasse (une page vide dit pourquoi et propose le geste suivant).
- Le siège ne reçoit de la base aucun nom, aucun e-mail de stagiaire, aucun identifiant de stagiaire, aucune ligne de
  donnée individuelle, aucun chiffre par promo : seulement des comptes par centre, sur ses promos en cours, masqués
  quand le centre a moins de 5 stagiaires en formation (maquette `sEnsemble` : chiffres par centre).
- Migrations : `supabase/migrations/20261108_espaces_<n>_<nom>.sql`, chacune avec son `_retour.sql` ; jamais appliquées
  sans l'accord explicite de Timy ; répétitions dans un bloc `do` qui finit par une levée, `set local lock_timeout =
  '3s'`, hors des heures de cours, par la voie de production retenue au lot 4 (R35 : psql, chaîne `SUPABASE_DB_URL` de
  `C:/Users/watch/Dev/ECSR/.env`, mot de passe passé à part, jamais affiché), base locale jetable d'abord, deux passages
  en production au plus par tâche.
- Avant toute fusion dans `main` : `python outils/robot_parcours.py` vert (code 0) sur la branche, puis sur `main` avant
  la poussée ; un défaut nouveau bloque, un défaut de `connus.py` non.
- Jamais de cours publié par un agent ; jamais de déploiement de fonction sans l'accord de Timy.
- Toute mise en ligne visible porte son entrée dans `js/nouveautes-data.js`, dans le même commit.
- Tests de départ : `node --test "tests/*.test.mjs"` vert ; chaque tâche le garde vert.

## Review Focus

1. **Un autre centre** : une direction de Nîmes qui tape l'adresse d'une fiche de Montpellier, une personne direction à
   Nîmes et formatrice à Montpellier qui passe en espace direction, ou le fondateur en aperçu direction sur la promo 7
   (centre Démonstration) : rien d'un autre centre ne s'affiche, une phrase dit pourquoi (Tasks 1, 3, 9, preuve Task 6,
   parcours P9). En aperçu, la base n'est fidèle que pour la promo de chaque requête : le filtrage des promos du centre
   se fait en un seul point de l'app (Task 3).
2. **Les petits centres au siège** : un centre de moins de 5 stagiaires en formation n'envoie aucun chiffre, n'entre
   dans aucun total, et aucune promo n'a de chiffre propre au siège (preuve Task 5, test Task 4, Task 11).
3. **Le siège sans promo** : tout ce qui suppose une promo (pastille, bandeau d'émargement, « à traiter », modules,
   bandeau « Promos non chargées », Mon suivi, Nouveautés propres à une promo) ne s'affiche pas et ne lève rien
   (Task 2, parcours P4).
4. **La bascule vers une autre promo** : ouvrir une fiche, une feuille ou des modules d'une autre promo du centre recharge
   l'app sur la bonne page, sans perdre un enregistrement en cours ; une bascule impossible le dit et ne laisse aucune
   adresse en attente (Tasks 2 et 9, parcours P1).
5. **Un refus qui se tait** : 42501, fonction absente avant la migration (PGRST202), retrait qui touche 0 ligne : chaque
   page montre une phrase (test `phraseDeRefus`, Tasks 8, 10, 12 ; parcours P10).

## 0. Décisions de conception

| N° | Décision | Raison |
|---|---|---|
| D1 | Quatre espaces : `stagiaire`, `equipe` (le formateur, nom technique gardé du lot 1, libellé « Formateur »), `direction`, `siege`. Les trois derniers ont la barre latérale. | Le lot 1 et le lot 4 nomment déjà `equipe` ; ne pas renommer partout. |
| D2 | Espaces permis d'un compte, dans cet ordre : siège, direction, formateur, stagiaire. Sources : siège et direction d'après les affectations du compte ; formateur et stagiaire d'après les rôles de la promo affichée (`promo.roles`, comme au lot 4 : le compte stagiaire de la promo 1 et formateur de la promo 2 change d'espace avec la promo). Le choix est mémorisé sur l'appareil (`ecsr_espace:<email>`) ; un choix devenu impossible retombe sur le premier permis. | Spec § 4.3 : rôles cumulables, passage depuis le menu ; ne pas défaire le cumul du lot 4. |
| D3 | Le fondateur hors aperçu reste dans l'espace formateur. Direction et siège se regardent par l'aperçu. La base est fidèle pour la promo de chaque requête (elle répond comme à une direction du centre de cette promo, ou comme au siège) ; ce qui garde l'aperçu direction dans un seul centre est l'app, en un seul point : en aperçu direction, la liste des promos chargée par `js/db.js` (pastille, en-têtes de lecture permis) ne garde que les promos du centre de la promo affichée. Les modifications faites en aperçu sont réelles : le bandeau le dit. | Demande du 30/10 (« regarder chaque espace séparément ») ; un espace « direction avec les droits du fondateur » ne montrerait pas ce que voit une direction. Le fondateur peut tout lire : la limite est d'affichage, pas de sécurité. |
| D4 | La direction et le siège ont toujours la nouvelle navigation : la décision de session (`decideNavigationV2`, `js/nav-etat-regles.js`) reçoit l'espace et rend vrai en `direction` et `siege`, quel que soit l'interrupteur de la promo. L'espace est donc connu avant `chargerNavigationV2()`. Changer d'espace ou d'aperçu recharge l'app (la navigation ne bascule jamais en cours de session). | Ils n'ont pas d'ancienne interface ; le siège n'a pas de promo où lire l'interrupteur ; 21 modules lisent `navigationV2Active()`, qui doit donner la même réponse que la coquille. |
| D5 | La porte laisse entrer un compte sans promo s'il a une affectation siège (espace siège) ou direction (espace direction, « Créer la première promo »). Les autres gardent le refus du lot 4. | Lot 4, « Laissé aux lots suivants ». |
| D6 | Le centre affiché est le lieu de la promo affichée s'il est dirigé par le compte (ou en aperçu direction) ; sinon le premier lieu dirigé. Entrer dans l'espace direction quand la promo affichée est d'un centre non dirigé bascule vers la première promo en cours (sinon la plus récente) du centre dirigé ; s'il n'en a aucune, la promo reste et les pages n'en montrent rien (« Ce centre n'a pas encore de promo »). Changer de centre, c'est choisir une promo de ce centre (rechargement, comme la pastille). | Pas de second contexte à synchroniser avec `x-promo-id` ; jamais les pages d'un centre que la personne ne dirige pas. |
| D7 | Chaque page de la direction montre toutes les promos du centre en résumé, puis le détail de la promo affichée (modules, feuilles, matrice, fiche). « Voir le détail » d'une autre promo la rend affichée : `ouvrirDansUnePromo(promoId, adresse)` pose l'adresse visée dans l'historique (`history.replaceState`) puis appelle `choisirPromo`, dont le rechargement garde l'adresse ; une promo absente de la liste ou une bascule déjà en cours : phrase, rien ne change. | Les écritures et les fiches existantes lisent la promo affichée ; l'en-tête de lecture interdit l'écriture (règle du tableau de bord du 23/10). Au rechargement, l'adresse présente est rendue telle quelle (`isColdStart()` faux) : aucune clé à mémoriser. |
| D8 | Lectures de la direction : données brutes de chaque promo du centre par l'en-tête de lecture (`lireDonneesCentre`), calculs de `js/centre-stats.js`. Les cartes et « Thèmes à retravailler » du centre = la concaténation des promos en cours, donnée à `indicateursPromo`. « À suivre de près » se calcule promo par promo (objectif de passages et activité aux QCM propres à chaque promo), listes fusionnées et étiquetées de leur promo. | Les cartes sont additives ; les signaux de « À suivre » comparent un stagiaire à sa promo, pas à un mélange de promos à des stades différents. |
| D9 | Lectures du siège : `comptes_reseau()`, une ligne par centre, comptes additifs sur ses promos en cours, calculés par la base, sans nom et sans détail par promo. Centre de moins de 5 stagiaires en formation : `masque`, aucun chiffre, hors de tout total. Le total du réseau additionne les centres non masqués, hors centre de démonstration (`lieux.demonstration`), montré à part. Risque résiduel accepté : un départ dans un centre se voit dans ses chiffres d'un jour à l'autre, comme dans toute statistique agrégée ; le seuil de 5 et le grain du centre le rendent flou. | Décision du 27/10 (pas de données nominatives au siège) ; maquette `sEnsemble` (chiffres par centre) ; seuil de 5, comme les avis des stagiaires (Qualiopi, décision 4). |
| D10 | Mêmes définitions des deux côtés : une fixture (`tests/fixtures/comptes-promo.json`, données fictives et comptes attendus) est jouée par le test node (`indicateursPromo` puis `comptesDepuisIndicateurs`) ET par la preuve SQL (`comptes_reseau` sur un centre fictif qui n'a que cette promo). Les chiffres d'un centre non masqué sont les mêmes chez la direction et au siège ; la direction voit en plus les centres de moins de 5, ce que l'écran du siège dit. Recoupement final sur les vrais centres (Task 17). | Le test du premier clic de la maquette avait trouvé des chiffres d'un même centre différents entre direction et siège. |
| D11 | Écrire sur une autre promo du centre passe par des fonctions qui prennent la promo ou le centre en paramètre (`creer_promo`, `modifier_dates_promo`, `regler_affectations_formateur`), jamais par l'en-tête de lecture. `regler_affectations_formateur` plutôt que des écritures directes sur `affectations` (que la RLS du lot 4 permet à la direction) : la liste des promos d'une personne change en une seule transaction, le profil est créé s'il manque, et l'adresse d'un compte stagiaire est refusée. La création du profil formateur devient une fonction interne commune avec `inviter_compte`. | Garde du 23/10 : l'en-tête de lecture refuse toute écriture ; une seule règle pour créer un formateur, quel que soit le chemin. |
| D12 | Hors de ce lot : Qualiopi pour la direction et le siège (attend le lot Q5 : conditions et conservation, « avant qu'une direction ait la page ») ; Veille réglementaire (pas encore dans l'app) ; Partenaires (élèves bénévoles, que la base laisse lire à la direction) et Modules de départ du centre ; interrupteurs de l'émargement et de la navigation (fondateur seul, R32). Aucune entrée de barre pour eux : pas d'écran « Bientôt ». | Pas d'impasse (règle de Timy du 08/11) ; le test du premier clic a puni les écrans « Bientôt ». |
| D13 | Le siège rédige les contenus communs (cours de thème, questions de QCM : `redacteur_contenus()` du lot 4) depuis Cours et QCM ; ni examens, ni progression, ni propositions IA, ni signalements. | Matrice du lot 4 ; décision 4 du 27/10. |
| D14 | Le siège crée un centre (`creer_centre`) et invite sa direction (`inviter_compte(…, 'direction', …, p_lieu_id)` du lot 4). Le fondateur hors aperçu invite un compte siège depuis ses Réglages. | Sans cela, ouvrir un centre demande du SQL à la main. |
| D15 | La direction n'a ni Planning ni Cours et QCM dans sa barre (maquette `ROLES.direction`) ; la spec § 4.3 lui donne le droit de les voir, qu'une direction qui forme exerce depuis son espace Formateur. Les routes `planning` et `themes` sont hors de l'espace direction. | Maquette validée au test du premier clic ; un droit n'est pas une entrée. |
| D16 | Les pages du menu du compte (`nouveautes`, `preferences`, `problemes`) n'allument aucune entrée en direction et en siège ; l'entrée « Accueil » de ces espaces ouvre une page titrée « Vue d'ensemble » (maquette), alias déclaré au robot (critère C). La dernière page est mémorisée par espace (`derniere-route:<espace>`) ; au démarrage, une page mémorisée hors de l'espace mène à son accueil sans phrase. | Une seule maison par fonction ; pas de phrase « pas dans l'espace » à chaque ouverture. |

## 1. Les espaces

| Espace | Contexte en tête de barre | Entrées (ordinateur) | Barre du téléphone (puis « Plus ») | Accueil |
|---|---|---|---|---|
| Direction | « Centre » + nom du lieu ; choix du centre si plusieurs | Accueil, Promos, Stagiaires, Émargement (si une promo du centre l'a), Notes et examens, Équipe ; groupe « Centre » : Réglages du centre (Partie E) | Accueil, Promos, Stagiaires, Équipe | `#/centre` |
| Siège | « Réseau » + « N centres » | Accueil, Cours et QCM ; groupe « Gestion » : Directions de centre, Réglages du réseau (Partie E) | Accueil, Cours et QCM, Directions | `#/reseau` |

Routes par espace (une route hors de son espace ramène à l'accueil de l'espace avec la phrase « Cette page n'est pas
dans l'espace Direction. », jamais en silence) :

| Route | Formateur (`equipe`) | Direction | Siège |
|---|---|---|---|
| `centre` | Indicateurs de la promo (inchangé) | Vue d'ensemble du centre | hors espace |
| `promos` | hors espace | Promos du centre | hors espace |
| `stagiaires` (`/id` : fiche) | inchangé | liste du centre ; fiche d'une autre promo par bascule | hors espace |
| `emargement` | inchangé | résumé par promo + feuilles de la promo affichée | hors espace |
| `notes` | inchangé | synthèse par promo + Notes de la promo affichée en lecture | hors espace |
| `equipe` | hors espace | Équipe du centre | hors espace |
| `reseau` (`/id` : fiche du centre) | hors espace | hors espace | Vue d'ensemble du réseau |
| `directions` | hors espace | hors espace | Directions de centre |
| `themes` | inchangé | hors espace (D15) | contenus communs |
| `planning` | inchangé | hors espace (D15) | hors espace |
| `config` | Réglages de la promo | Réglages du centre (Partie E) | Réglages du réseau (Partie E) |
| `home` | inchangé | mène à `centre` | mène à `reseau` |
| `nouveautes`, `preferences`, `problemes` | inchangé | permises, aucune entrée allumée (D16) | permises, aucune entrée allumée (D16) |
| toute autre route (`mon-suivi`, `calendrier`, `ccp2`, `qualiopi`, `ressources`…) | inchangé | hors espace | hors espace |

`redirectionV2` (`js/nav-rules.js`) ne redirige `notes` et `config` que dans l'espace stagiaire (aujourd'hui : tout
espace autre que `equipe`), sinon les pages Notes et Réglages de la direction et du siège ne s'ouvriraient pas. Les autres
tests binaires « équipe ou pas » sont repris de même (Task 1 et 2) : `libelleRole`, `js/ou-trouver.js`,
`js/signalement-rules.js` (contexte d'un signalement), `css/navigation.css` (`[data-espace="equipe"]` devient la forme de
la barre latérale, partagée par les trois espaces de l'équipe).

## 2. La base

| Migration | Contenu | Qui |
|---|---|---|
| `20261108_espaces_1_siege.sql` | colonne `lieux.demonstration boolean not null default false`, posée à vrai pour le lieu 4 « Démonstration » (garde : exactement une ligne, sinon levée) ; séquence de `lieux.id` recalée sur le plus grand id (`setval(pg_get_serial_sequence('lieux', 'id'), max(id))` : les lieux 3 et 4 ont été posés hors migration) ; `comptes_reseau()` ; `creer_centre(p_nom text) returns integer` | Task 5 |
| `20261108_espaces_2_equipe.sql` | fonction interne `_profil_formateur(p_email text, p_prof_id integer, p_par text) returns boolean` (création du profil formateur, reprise de `inviter_compte`) ; `inviter_compte` redéfinie pour l'appeler et refuser l'adresse d'un compte stagiaire (sauf si le lot 4 l'a déjà fait) ; `regler_affectations_formateur(p_email text, p_lieu_id integer, p_promo_ids integer[], p_prof_id integer default null) returns jsonb` | Task 6 |
| `20261108_espaces_3_habillage.sql` (Partie E) | `lieux.habillage text` (`ecsr`, `ecf` ou nul), `lieux.habillage_libre boolean not null default true` ; clé globale `habillage_reseau` admise par `settings_globaux_prevus` ; `habillage_par_defaut()`, `regler_habillage_centre(p_lieu_id integer, p_habillage text, p_libre boolean)`, `regler_habillage_reseau(p_habillage text)` | Task 14 |

Aucune table nouvelle, aucune règle RLS modifiée : la matrice et la preuve du lot 4 restent justes (rejouées en mode
`en-ligne` à la Task 17). Fonctions : `language plpgsql` ou `sql`, `security definer set search_path = public, pg_temp`,
`revoke all … from public, anon, service_role`, `grant execute … to authenticated`. Refus : `raise exception
'<prefixe>: <phrase>'` (`reseau`, `centre`, `equipe`, `habillage`), code `42501` pour un droit manquant.

**`comptes_reseau()`** `returns table(lieu_id integer, lieu_nom text, demonstration boolean, promos_en_cours integer,
masque boolean, inscrits integer, en_formation integer, abandons integer, absences integer, prevus integer, qcm_bonnes
integer, qcm_questions integer, examens_passes integer, examens_reussis integer, notes_n integer, notes_somme numeric,
notes_sous10 integer, epcf_acquis integer, epcf_renseignes integer)`. Réservée à `est_siege()` (siège, fondateur hors
aperçu, aperçu siège), sinon `reseau: Réservé au siège.` (42501). Une ligne par centre, tout centre compris (celui qui
n'a aucune promo en cours a `promos_en_cours = 0`). Promo en cours : `date_debut <= current_date` et (`date_fin` nulle ou
`>= current_date`), la même règle que `promosEnCours` (Task 4). `masque` vrai quand le centre a moins de 5 stagiaires en
formation sur ses promos en cours : toutes les colonnes après `masque` sont nulles. Définitions (celles de `METHODES`,
`js/centre-stats.js`), sommées sur les promos en cours du centre ; pour chaque promo, une ligne de donnée compte si son
`promo_id` est cette promo ET si son stagiaire est une fiche active de cette promo (les deux filtres de l'app : l'en-tête
de la promo, `js/db.js`, puis les stagiaires actifs, `centre-stats.js`) :

| Colonne | Définition |
|---|---|
| `inscrits`, `en_formation`, `abandons` | fiches de la promo ; fiches `actif` ; différence |
| `absences`, `prevus` | passages de type `Salle` ou `Voiture` : `resultat = 'Absence'` ; `resultat in ('Effectué', 'Absence')` |
| `qcm_bonnes`, `qcm_questions` | tentatives `mode = 'entrainement'` : somme de `score`, somme de `total` (nul compté 0) |
| `examens_passes`, `examens_reussis` | tentatives `mode = 'examen'` ; celles dont `note_20 >= coalesce(qcm.exam_pass_20, 15)` |
| `notes_n`, `notes_somme`, `notes_sous10` | évaluations notées (`note` non nulle, `note_max` non nul et non nul en valeur) : nombre, somme de `note / note_max * 20`, nombre sous 10 |
| `epcf_acquis`, `epcf_renseignes` | par stagiaire et par trame (`salle`, `vehicule`), la dernière évaluation `contexte = 'EPCF'` dont `auto_eval is not true` (l'app écarte `auto_eval` vrai seulement) et `date_eval` non nulle (filtre ajouté aussi dans `epcfTrame` de `centre-stats.js`, Task 4 : l'app départage aujourd'hui une date nulle selon l'ordre de lecture), ordre `date_eval desc, id desc` ; valeurs `A` ; valeurs `A`, `R` ou `NA` de `scores` |

**`creer_centre(p_nom)`** : `est_siege()`, sinon `centre: Réservé au siège.` (42501) ; nom nettoyé non vide (`centre: Le
nom est requis.`) ; pas de centre du même nom, casse ignorée (`centre: Ce centre existe déjà.`), y compris en course :
une violation d'unicité (23505) lève la même phrase ; rend l'`id`.

**`regler_affectations_formateur`** : donne au compte exactement les promos `p_promo_ids` du centre `p_lieu_id` comme
formateur. `est_direction(p_lieu_id)` (direction du centre, fondateur, aperçu direction sur ce centre), sinon `equipe:
Réservé à la direction du centre.` (42501) ; e-mail valide ; toute promo de la liste est du centre (`equipe: Une promo
choisie n'est pas dans ce centre.`) ; un compte qui a une fiche de stagiaire n'est jamais affecté (`equipe: Cette adresse
est celle d'un compte stagiaire.`) ; compte absent et liste vide : `equipe: Choisis au moins une promo.` ; compte absent :
profil créé par `_profil_formateur` (`role 'prof'`, `is_admin true`, `prof_id` si la fiche est libre,
`invited_by_email`), la même fonction qu'`inviter_compte` ; retire les lignes `formateur` de ce compte sur les promos du centre hors liste, ajoute les
manquantes, ne touche à rien d'autre (autres centres, lignes `direction` et `siege`). Rend `{ email, cree, ajoutees,
retirees }` (tableaux d'identifiants de promo).

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/espaces-rules.js`, `tests/espaces-rules.test.mjs` | règles pures des espaces (permis, choix, bride des droits, routes, porte, centre, phrases) |
| `js/direction-rules.js`, `tests/direction-rules.test.mjs` | règles pures des pages de la direction (promos, stagiaires du centre, équipe) |
| `js/siege-rules.js`, `tests/siege-rules.test.mjs` | règles pures des pages du siège (directions par centre) |
| `js/nav-rules.js`, `tests/nav-rules.test.mjs` | entrées de la direction et du siège, barre du téléphone, `redirectionV2` et `libelleRole` par espace |
| `js/nav-etat-regles.js`, `js/nav-etat.js` | décision de navigation qui reçoit l'espace (D4) |
| `js/auth-admin.js`, `js/db.js`, `js/main.js`, `js/nav-shell.js`, `js/menu-compte.js`, `js/icons.js`, `js/ou-trouver.js`, `js/signalement-rules.js`, `css/navigation.css` | branchements : porte, espace courant, coquille, menu « Espace » (ancien et nouveau menu du compte), aperçu, bascule |
| `js/comptes-reseau.js`, `tests/comptes-reseau.test.mjs`, `tests/fixtures/comptes-promo.json` | comptes additifs, sommes, ratios, promos en cours, concaténation |
| `js/centre-stats.js` | `notes.detail.somme` en plus ; EPCF sans date écartée ; « À suivre » par promo (fonction exportée) |
| `js/views/centre.js` | sections réutilisées par la direction (`sectionASuivre` reçoit le lien et la promo de chaque personne) |
| `js/views/stagiaires-gestion.js` | gestion des stagiaires sortie de `config.js` (ajout, abandon, réactivation, anonymisation, invitation du compte), montée dans Réglages (formateur) et dans Stagiaires du centre (direction) |
| `js/views/emargement.js`, `js/emargement-rules.js` | mode lecture de la direction (feuilles, impression des feuilles closes, attestations) ; résumé par promo |
| `js/views/notes.js` | option de page imbriquée de la direction |
| `js/centre-csv.js`, `tests/centre-csv.test.mjs` | tableaux CSV du centre (direction) et du réseau (siège) |
| `js/views/direction-centre.js` | Vue d'ensemble du centre, Émargement et Notes et examens de la direction |
| `js/views/direction-promos.js`, `js/views/direction-stagiaires.js`, `js/views/direction-equipe.js` | pages de la direction |
| `js/views/siege-reseau.js`, `js/views/siege-directions.js` | pages du siège |
| `js/views/reglages-habillage.js` | Réglages du centre et du réseau (Partie E) |
| `supabase/migrations/20261108_espaces_*.sql` (+ `_retour`) | section 2 |
| `tests/sql/espaces-preuve.sql` | preuve rôle par rôle et portée par portée des fonctions du lot |
| `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs` | modes `espaces`, `espaces-contre-epreuve`, `espaces-en-ligne` |
| `outils/base_locale/` (`LISEZMOI.md`, `reconstruire.sh`), `outils/psql_prod.sh` | outillage SQL du lot 4 versé au dépôt, sans aucun secret (Task 5) |
| `outils/recouper_comptes.mjs`, `tests/recouper-comptes.test.mjs` | recoupement direction et siège (outil Task 16, joué sur les vrais centres Task 17) |
| `outils/parcours/visite.py`, `outils/parcours/navigation.py`, `outils/parcours/direction.py`, `outils/parcours/siege.py` | robot : espaces direction et siège, page de départ et pages connues, parcours P1 à P10 |
| `_harness_supabase.js` | banc : comptes et RPC du lot, levier de panne par fonction (copie reportée dans `TP_ECSR_App` en fin de lot, après `diff`) |
| `supabase/functions/chatbot/aide.mjs`, `tests/chatbot-aide.test.mjs` | guide de l'assistant : barres de la direction et du siège |
| `js/nouveautes-data.js`, `js/nouveautes.js` | audiences `direction` et `siege` |

---

## Partie A : le socle des espaces (aucune migration)

### Task 1 : règles des espaces

**Files :** Create `js/espaces-rules.js`, `tests/espaces-rules.test.mjs` ; Modify `js/nav-rules.js`,
`tests/nav-rules.test.mjs`, `js/roles-rules.js` (`messageInvitation` délègue à `phraseDeRefus`), `js/route-rules.js`
(`lireAdresse`, `adresseFiche` : `reseau/<id>`).

**Interfaces :**
- Consumes : `droitsAffiches`, `normaliserApercu`, `messageInvitation` (`js/roles-rules.js`, lot 4).
- Produces (`js/espaces-rules.js`) : `ESPACES = ["stagiaire", "equipe", "direction", "siege"]` ; `LIBELLES_ESPACE =
  { stagiaire: "Stagiaire", equipe: "Formateur", direction: "Direction", siege: "Siège" }` ; `ACCUEIL_ESPACE =
  { stagiaire: "home", equipe: "home", direction: "centre", siege: "reseau" }` ; `barreLaterale(espace) -> boolean` ;
  `espacesPermis({ profil, promo, affectations, apercu }) -> string[]` ; `espaceChoisi(permis, memorise) -> string|null` ;
  `brider(droits, espace) -> droits` ; `peutRedigerContenus({ droits, espace }) -> boolean` ; `porteSansPromo(affectations)
  -> "siege"|"direction"|null` ; `centreAffiche({ promo, affectations, apercu }) -> { id, nom }|null` ;
  `promoPourLaDirection({ promo, promos, affectations, aujourdhui }) -> number|null` (D6 : id de la promo vers laquelle
  basculer en entrant dans l'espace direction, `null` s'il ne faut pas basculer) ; `promosDuCentre(promos, lieuId) ->
  promos[]` ; `routeDansLEspace(espace, route) -> boolean` ; `phraseHorsEspace(espace) -> string` ;
  `phraseDeRefus(message, code) -> string` ; `adresseApresBascule(valeur) -> string|null` (validation de l'adresse visée
  par `ouvrirDansUnePromo`).
- Produces (`js/nav-rules.js`) : `entreesNavigation(espace, { routeVisible, emargementActif, emargementDansLeCentre =
  false, reglagesEspace = false })` accepte `direction` et `siege` ; `barreTelephone` aussi ; `redirectionV2` ne
  redirige `notes` et `config` qu'en espace `stagiaire` ; `libelleRole(profil, espace)` : « Fondateur » pour le
  fondateur, sinon `LIBELLES_ESPACE[espace]`.
- `affectations` : `[{ role, promo_id, lieu_id, lieu_nom }]` (Task 2) ; `promo.roles` : rôles du compte dans la promo
  affichée (`mes_promos()`, lot 4).

- [ ] **Step 1 : tests `tests/espaces-rules.test.mjs`**
  - `espacesPermis` (D2 : direction et siège d'après les affectations, formateur et stagiaire d'après `promo.roles`) :
    formateur réel (`roles ['formateur']`) `["equipe"]` ; stagiaire `["stagiaire"]` ; direction seule (affectation
    direction du lieu de la promo) `["direction"]` ; direction et formateur de la même promo `["direction", "equipe"]` ;
    direction du lieu 1 sur une promo du lieu 2 dont elle est formatrice `["direction", "equipe"]` ; cumul du lot 4,
    stagiaire de la promo 1 et formateur de la promo 2 : `["stagiaire"]` sur la promo 1, `["equipe"]` sur la promo 2 ;
    siège sans promo (`promo` nul, affectation siège) `["siege"]` ; fondateur `["equipe"]` ; fondateur en aperçu
    `direction` `["direction"]`, `siege` `["siege"]`, `formateur` `["equipe"]`, `stagiaire` `["stagiaire"]` ; formateur
    réel qui garde `siege` en mémoire d'aperçu : `["equipe"]` (aperçu non permis ignoré) ; aucun rôle `[]`.
  - `espaceChoisi(["direction", "equipe"], "equipe") === "equipe"` ; `(["direction"], "equipe") === "direction"` ;
    `([], "equipe") === null`.
  - `brider` : en `direction`, `admin` faux, `equipe` gardé ; en `siege`, `admin`, `equipe`, `stagiaire` faux, `prof`
    vrai ; en `equipe` et `stagiaire`, droits inchangés.
  - `peutRedigerContenus` : vrai pour `{ admin: true }` en `equipe` et pour tout droit en `siege` ; faux en `direction`.
  - `porteSansPromo([{ role: "siege" }, { role: "direction", lieu_id: 1 }]) === "siege"` ; direction seule `"direction"` ;
    formateur sans promo `null` ; `[]` et `null` `null`.
  - `centreAffiche` : lieu de la promo s'il est dans les affectations direction (`{ id: promo.lieu_id, nom:
    promo.lieu_nom }`) ; promo d'un lieu non dirigé : premier lieu dirigé ; aperçu `direction` : lieu de la promo ; sans
    promo : premier lieu dirigé ; aucune affectation direction : `null`.
  - `promoPourLaDirection` : promo d'un lieu dirigé `null` ; promo du lieu 2, direction du lieu 1 qui a une promo en
    cours et une terminée : l'id de celle en cours ; seulement des promos terminées : la plus récente ; aucune promo du
    lieu 1 : `null`.
  - `routeDansLEspace` : chaque case du tableau de la section 1 (route permise ou hors espace) ; `phraseHorsEspace("direction")
    === "Cette page n'est pas dans l'espace Direction."`.
  - `phraseDeRefus` : `("equipe: Réservé à la direction du centre.", "42501") === "Réservé à la direction du centre."`,
    même chose pour `promo:`, `centre:`, `reseau:`, `invitation:`, `habillage:` ; `(_, "PGRST202")` et un message
    « Could not find the function » : « Cette action n'est pas encore disponible. » ; `("permission denied for …",
    "42501")` : « Tu n'as pas le droit de faire cela ici. » ; vide : « L'opération n'a pas abouti. ». Les tests
    existants de `messageInvitation` restent verts.
  - `adresseApresBascule("#/stagiaires/12/notes") === "#/stagiaires/12/notes"` ; `"javascript:…"`, `"#/inconnue"`, `null`
    donnent `null`.
- [ ] **Step 2 : tests `tests/nav-rules.test.mjs`** : entrées de la direction dans l'ordre de la section 1, Émargement
  seulement avec `emargementDansLeCentre`, Réglages du centre seulement avec `reglagesEspace` ; siège idem ; barre du
  téléphone (direction : `centre, promos, stagiaires, equipe` + reste dans `plus` ; siège : `reseau, themes, directions`) ;
  `entreeActive("reseau", entreesSiege) === "reseau"`, `entreeActive("nouveautes", entreesSiege) === null` ;
  `redirectionV2({ route: "notes" }, "direction") === null`, de même `config` en `direction` et `siege`, et toujours
  `#/mon-suivi/classe` en `stagiaire` ; `libelleRole` : « Direction », « Siège », « Formateur », « Fondateur » ; espaces
  du lot 1 inchangés.
- [ ] **Step 3 : les voir échouer**, puis écrire `js/espaces-rules.js`, les entrées de `js/nav-rules.js` (icônes
  `layers`, `briefcase`, `building`, `globe` ajoutées à `js/icons.js`, trait comme les autres, sans couleur) et la
  délégation de `messageInvitation`.
- [ ] **Step 4 : `node --test "tests/*.test.mjs"`** : vert (garde des couleurs du lot 3 comprise).
- [ ] **Step 5 : commit** « Lot 5 : règles des espaces direction et siège ».

### Task 2 : porte, espace courant et coquille

**Files :** Modify `js/auth-admin.js` (porte, ancien menu du compte), `js/db.js`, `js/main.js`, `js/nav-etat-regles.js`,
`js/nav-etat.js`, `tests/nav-etat.test.mjs`, `js/nav-shell.js`, `js/menu-compte.js`, `js/promo-pastille.js`,
`js/ou-trouver.js`, `js/signalement-rules.js`, `css/navigation.css`, `_harness_supabase.js`.

**Interfaces :**
- Consumes : Task 1.
- Produces : `js/db.js` : `mesAffectations() -> Promise<Array<{ role, promo_id, lieu_id, lieu_nom }>>` (remplace
  `mesRolesAffectes`, que la porte du lot 4 lit) ; `ouvrirDansUnePromo(promoId, adresse) -> Promise<string|null>` :
  adresse refusée par `adresseApresBascule`, promo absente de la liste ou bascule en cours : rend la phrase à montrer
  (« Cette promo n'est plus accessible. », « Un changement de promo est déjà en cours. ») et ne change rien ; promo déjà
  affichée : simple changement d'adresse ; sinon `history.replaceState(null, "", adresse)` puis `choisirPromo` (rend
  `null`). `js/auth-admin.js` : `getEspace() -> string`, `espacesOuverts() -> string[]`, `setEspace(espace)` (mémorise
  puis recharge sur l'accueil du nouvel espace), `getAffectations()`, `getCentre() -> { id, nom }|null`,
  `isRedacteur() -> boolean` ; `isAdmin`, `isProf`, `isStagiaire`, `isEquipe` rendent les droits bridés par l'espace.
  `js/nav-etat-regles.js` : `decideNavigationV2({ reglagePromo, apercu, fondateur, espace })` rend vrai pour `espace`
  `direction` ou `siege`.

- [ ] **Step 1 : tests** de `normaliserAffectations(lignes, lieux) -> [{ role, promo_id, lieu_id, lieu_nom }]` (ajoutée
  à `js/espaces-rules.js`, tests dans `tests/espaces-rules.test.mjs`) : nom du lieu joint ; lieu illisible ou absent :
  `lieu_nom` nul, ligne gardée ; lignes `null` ou vides : `[]` ; rôle inconnu : ligne écartée. Tests de
  `decideNavigationV2` (`tests/nav-etat.test.mjs`) : `espace: "direction"` et `"siege"` vrai avec un réglage de
  promo éteint ou illisible ; `equipe` et `stagiaire` inchangés.
- [ ] **Step 2 : porte** (`initAuth`, `onAuthChange`) : sans promo, `porteSansPromo(await mesAffectations())` ; `siege` ou
  `direction` : entrée sans promo, sans bandeau « Promos non chargées » (une panne de `mes_promos` chez un compte siège
  ne l'affiche pas non plus), espace correspondant ; sinon le refus du lot 4 (`messageSansPromo`, dont les phrases
  « arrive bientôt » du siège et de la direction disparaissent).
- [ ] **Step 3 : espace courant et navigation** : l'espace est fixé après la porte et avant `chargerNavigationV2()`,
  qui le passe à `decideNavigationV2` (D4) ; en entrant dans l'espace direction, `promoPourLaDirection(...)` non nul
  déclenche `choisirPromo` (D6) ; `espaceCourant()` de `js/main.js` lit `getEspace()` ; `navigate()` : `home` mène à
  l'accueil de l'espace, `routeDansLEspace` faux ramène à l'accueil avec `phraseHorsEspace`, route inconnue retombe sur
  l'accueil de l'espace (et non sur Mon suivi) en direction et en siège ; mémoire de la dernière page par espace
  (`derniere-route:<espace>`), hors espace au démarrage : accueil sans phrase (D16) ; `libelleRole(profil, espace)`,
  `js/ou-trouver.js` et `js/signalement-rules.js` reçoivent l'espace au lieu de « équipe ou pas ».
- [ ] **Step 4 : coquille et menus** : `barreLaterale(espace)` remplace les tests `espace === "equipe"` qui décident de la
  forme, dans `js/nav-shell.js` et `css/navigation.css` (les comptes « à traiter » restent au seul formateur) ; en-tête
  de contexte « Centre » + nom du lieu (choix du centre par la pastille quand le compte en dirige plusieurs) ou
  « Réseau » + nombre de centres ; section « Espace » (une ligne par espace permis, coche sur l'actuel) quand il y en a
  deux ou plus, dans le menu du compte de la nouvelle barre (`js/menu-compte.js`) ET dans celui de l'ancienne
  (`js/auth-admin.js`), pour qu'une direction qui forme dans une promo à l'interrupteur éteint rejoigne sa direction.
  Sous 700 px : barre du bas de la section 1, « Plus » avec le reste et l'Assistant.
- [ ] **Step 5 : banc** (`_harness_supabase.js`) : `affectations` et `lieux` lisibles pour `?compte=direction`
  (lieu 1, promos du lieu 1 seulement quand `?lieux=2`), `?compte=dirform` (direction du lieu 1 et formateur de la
  promo 1, interrupteur de la promo éteint), `?compte=direction-vide` (lieu 3 sans promo), `?compte=dirailleurs`
  (direction du lieu 1, formatrice d'une promo du lieu 2, promo affichée au lieu 2), `?compte=siege` (aucune promo) ;
  vérifier à 1280 et 375 px, Chromium et WebKit : chaque compte arrive sur son accueil, barre et barre du bas nommées,
  menu « Espace » pour `dirform` et `dirailleurs` (dans l'ancienne barre pour `dirform`), `dirailleurs` en direction
  voit le lieu 1, aucune erreur en console. Captures dans le registre.
- [ ] **Step 6 : `node --test "tests/*.test.mjs"`**, `python outils/verifier_navigation.py` et `python
  outils/robot_parcours.py` : 0 échec nouveau, parité « interrupteur éteint = main » intacte.
- [ ] **Step 7 : commit** « Lot 5 : porte, espace courant et barre de la direction et du siège ».

### Task 3 : « Voir en tant que » Direction et Siège

**Files :** Modify `js/auth-admin.js` (`setViewAs`, `buildViewAsBlock`), `js/menu-compte.js`, `js/db.js` (chargement
de la liste des promos), `js/promo-pastille.js`, `css/navigation.css`.

**Interfaces :** Consumes : `apercusPermis`, `setViewAs`, `buildViewAsBlock` (lot 4), Task 2. Produces :
`promosVisiblesEnApercu({ promos, promo, apercu }) -> promos[]` dans `js/espaces-rules.js` ; `setViewAs("direction")`
et `setViewAs("siege")` changent d'espace en rechargeant l'app (D4).

- [ ] **Step 1 : tests** de `promosVisiblesEnApercu` : en aperçu `direction`, seules les promos du centre de la promo
  affichée ; en aperçu `siege`, aucune ; sinon toutes.
- [ ] **Step 2 : brancher** : `setViewAs` mémorise l'aperçu et l'espace correspondant, puis recharge sur l'accueil de
  cet espace ; « Revenir fondateur » ramène l'espace formateur et la page d'accueil ; D3 : `promosVisiblesEnApercu` est
  appliquée en un seul point, là où `js/db.js` charge la liste des promos (`getMesPromos()` et la liste des promos dont
  l'en-tête de lecture est permis), si bien que la pastille, les pages et les lectures n'ont rien à filtrer ; le bandeau
  d'aperçu dit, en direction et en siège : « Aperçu : Direction du centre <nom>. Ce que tu modifies ici est vraiment
  enregistré. » (« Aperçu : Siège du réseau. » de même) ; sur téléphone, le sélecteur du fondateur garde ses cinq
  boutons à la ligne, 44 px.
- [ ] **Step 3 : banc** : fondateur, promo 1 puis promo 7 (`?demo=1`) : Direction (centre Nîmes, puis Démonstration :
  aucune promo d'un autre centre dans la pastille ni les pages), Siège (aucune pastille, aucune donnée de promo),
  Formateur, Stagiaire, retour ; dans les deux navigations (promo 1 éteinte, promo 7 allumée) ; à 1280 et 375 px, deux
  moteurs. Captures.
- [ ] **Step 4 : `node --test "tests/*.test.mjs"`**, `python outils/verifier_navigation.py`, `python
  outils/robot_parcours.py` : 0 échec nouveau.
- [ ] **Step 5 : commit** « Lot 5 : le fondateur regarde l'espace de la direction et celui du siège ».

## Partie B : les chiffres et la base

### Task 4 : comptes additifs et fixture commune

**Files :** Create `js/comptes-reseau.js`, `tests/comptes-reseau.test.mjs`, `tests/fixtures/comptes-promo.json` ;
Modify `js/centre-stats.js` (ajouter `somme` au `detail` de `notes` ; écarter les évaluations EPCF sans `date_eval`),
`tests/centre-stats.test.mjs`.

**Interfaces :** Produces : `CHAMPS_COMPTES = ["inscrits", "enFormation", "abandons", "absences", "prevus", "qcmBonnes",
"qcmQuestions", "examensPasses", "examensReussis", "notesN", "notesSomme", "notesSous10", "epcfAcquis",
"epcfRenseignes"]` ; `SEUIL_SECRET = 5` ; `comptesDepuisIndicateurs(ind) -> Comptes` ; `versComptes(ligneSql) -> Comptes &
{ lieuId, lieuNom, demonstration, promosEnCours, masque }` (une ligne de `comptes_reseau`, un centre) ;
`sommeComptes(liste) -> Comptes` (les lignes `masque` n'apportent rien) ; `ratiosDeComptes(c) -> { abandon, absences,
reussiteQcm, examensQcm, notes, epcf }` (nombre ou `null`) ; `promosEnCours(promos, aujourdhui) -> promos[]` (début au
plus tard aujourd'hui, fin nulle ou à partir d'aujourd'hui) ; `concatenerDonnees(listeDeDonnees) -> donnees` ;
`vueDuReseau(lignes) -> { centres, demonstration, total: Comptes, masques: number }` (`centres` hors démonstration, triés
par nom ; `total` sur les centres non masqués).

La fixture : `{ "donnees": { stagiaires, passages, evaluations, tentatives, epcf }, "referentiel": { qcm, themes },
"attendu": { <CHAMPS_COMPTES> } }`, identifiants à partir de 990001, 7 stagiaires dont 1 abandon, chaque cas des
définitions de la section 2 présent au moins une fois (bonus et absence, passage d'un abandon ignoré, passage d'un
stagiaire qui n'est pas de la promo ignoré, note sans barème, examen au seuil d'un QCM à 12 et au seuil par défaut, deux
évaluations EPCF du même jour d'id différents, une auto-évaluation ignorée, une évaluation à `auto_eval` nul comptée,
une évaluation EPCF sans date ignorée). Valeurs attendues calculées à la main dans le message du commit.

- [ ] **Step 1 : tests** : `comptesDepuisIndicateurs(indicateursPromo(fixture.donnees, fixture.referentiel, { aujourdhui:
  "2026-11-08" }))` égale `fixture.attendu` ; pour chaque ratio, `ratiosDeComptes(c)` égale la `valeur` de l'indicateur
  correspondant de `indicateursPromo` (`notes` à 1e-9 près) ; `indicateursPromo(concatenerDonnees([a, b]))` donne les
  mêmes ratios que `sommeComptes` des comptes de `a` et de `b` ; une ligne `masque` dans `sommeComptes` n'ajoute rien
  (Review Focus 2) ; `promosEnCours` (à venir, en cours, finie, sans fin) ; `vueDuReseau` : centre sans promo en cours
  à part des masqués, centre de démonstration hors total, `masques` compté ; dans `tests/centre-stats.test.mjs`, une
  évaluation EPCF sans date ne change ni l'ordre ni le résultat, quelle que soit sa place dans la liste.
- [ ] **Step 2 : les voir échouer**, écrire `js/comptes-reseau.js`, ajouter `somme` à `notes.detail`, filtrer les EPCF
  sans date.
- [ ] **Step 3 : `node --test "tests/*.test.mjs"`** : vert.
- [ ] **Step 4 : commit** « Lot 5 : comptes additifs du centre et du réseau, fixture commune ».

### Task 5 : preuve et migration du siège (`comptes_reseau`, `creer_centre`)

**Files :** Create `tests/sql/espaces-preuve.sql`, `supabase/migrations/20261108_espaces_1_siege.sql` et `_retour.sql`,
`outils/base_locale/LISEZMOI.md`, `outils/base_locale/reconstruire.sh`, `outils/psql_prod.sh` ; Modify
`outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs`.

**Interfaces :** Consumes : `tests/sql/roles-aides.sql` (`incarner`, `verifier`, verdict, lot 4), fixture (Task 4).
Produces : `node outils/assembler_repetition_roles.mjs espaces|espaces-contre-epreuve|espaces-en-ligne <sortie.sql>
[--compact]` (`espaces` : migrations du lot 5 injectées, contrôles, retours, empreinte avant et après ;
`espaces-contre-epreuve` : sans les migrations ; `espaces-en-ligne` : rien d'injecté) ; la fixture injectée telle
quelle par `-- @@INJECTER tests/fixtures/comptes-promo.json@@`.

Personnages créés dans le bloc : `siege` (affectation siège), `dir_n` (direction du lieu 1), `dir_m` (lieu 2),
`form_n` (formateur de la promo 1), `form_m` (formateur de la promo 2), `stag_n` (fiche de la promo 1), `sans_role`
(profil sans fiche ni affectation) ; le fondateur choisi par requête. Centres fictifs créés dans le bloc : « Centre
fixture » (une seule promo, en cours, qui porte les données de la fixture avec leurs ids d'origine ; les QCM et thèmes
qu'elle cite sont créés dans le bloc avec les ids de la fixture), « Centre petit » (une promo en cours de 3 stagiaires
actifs), « Centre fini » (une promo terminée). Lignes parasites ajoutées dans le bloc : un passage d'un stagiaire de la
fixture dont le `promo_id` est la promo 1, une évaluation d'un stagiaire de la promo 1 dont le `promo_id` est la promo
fixture (ni l'une ni l'autre ne compte).

- [ ] **Step 0 : outillage** : verser dans `outils/base_locale/` la recette de la base locale jetable du lot 4
  (reconstruction du schéma, port, démarrage, arrêt ; la reprendre du scratchpad de la session du lot 4, ou la demander à
  la conversation de coordination si elle a disparu) et dans `outils/psql_prod.sh` le lanceur de production (lit
  `SUPABASE_DB_URL` dans `C:/Users/watch/Dev/ECSR/.env` sans l'afficher, mot de passe passé à part) ; aucun secret dans le
  dépôt (contrôle : aucun `postgres://`, aucun mot de passe dans le diff).
- [ ] **Step 1 : écrire les contrôles**, chacun nommé dans le verdict (échecs d'abord, R28 du lot 4) :
  - `comptes_reseau` : permis à `siege`, au fondateur, au fondateur en aperçu `siege` ; refusé (42501, aucune ligne) à
    `dir_n`, `form_n`, `stag_n`, `sans_role`, au fondateur en aperçu `direction` et `formateur` ; non exécutable par
    `anon` ;
  - forme : aucune colonne dont le nom contient `nom` hors `lieu_nom`, ni `email`, ni `stagiaire`, ni `promo_id` ;
  - ligne « Centre fixture » = `attendu` de la fixture, champ par champ (`notes_somme` à 1e-9 près) : les parasites
    n'ont rien changé ;
  - ligne « Centre petit » : `masque` vrai, `promos_en_cours` 1, toutes les colonnes après `masque` nulles ;
  - ligne « Centre fini » : `promos_en_cours` 0, `masque` vrai ;
  - une ligne par centre, tout centre compris ; `demonstration` vrai pour le lieu 4 seulement ;
  - `creer_centre` : `siege` et le fondateur créent (id rendu, plus grand que tous les ids existants, ligne lue en
    propriétaire) ; `dir_n`, `form_n`, `stag_n` : refus 42501 ; nom vide, nom en double (casse différente) : refus avec
    la phrase ;
  - `lieux` : aucune écriture directe de `demonstration` par `siege` ni `dir_n` (0 ligne ou refus) ;
  - retour : après le retour, les trois empreintes (`tests/sql/roles-empreinte.sql`) égalent celles du début du bloc.
- [ ] **Step 2 : assembleur et son test** : chaque fichier injecté s'y trouve à l'octet près (md5), le mode
  `espaces-en-ligne` n'en contient aucun, la fixture est injectée telle quelle.
- [ ] **Step 3 : contre-épreuve sur la base locale jetable** (`outils/base_locale/`) : ROUGE sur les lignes
  `comptes_reseau`, `creer_centre`, `demonstration` ; rien d'autre.
- [ ] **Step 4 : écrire la migration et son retour** (section 2).
- [ ] **Step 5 : répétition** (mode `espaces`) en local, puis sur la vraie base hors des heures de cours : VERT n/0, rien
  de resté (pas de colonne `demonstration`, pas de fonction du lot), durée notée.
- [ ] **Step 6 : commit** « Lot 5, étape 1 : comptes du réseau sans nom et création d'un centre (preuve verte en
  répétition) ».

### Task 6 : migration de l'équipe (`regler_affectations_formateur`)

**Files :** Create `supabase/migrations/20261108_espaces_2_equipe.sql` et `_retour.sql` ; Modify
`tests/sql/espaces-preuve.sql`, `outils/assembler_repetition_roles.mjs` (deuxième migration injectée).

- [ ] **Step 1 : contrôles ajoutés à la preuve** : `dir_n` affecte `form_m` (personnage formateur de la promo 2) aux
  promos 1 et fixture (OK : deux lignes, ligne de la promo 2 intacte) puis à la seule promo 1 (la ligne fixture part) ;
  `dir_n` avec une promo du lieu 2 dans la liste : refus, aucune ligne changée ; `dir_n` sur le lieu 2 : refus 42501 ;
  `dir_m` sur le lieu 1 : refus ; `form_n`, `siege`, `stag_n` : refus 42501 ; fondateur : OK ; fondateur en aperçu
  `direction` sur la promo 1 : OK sur le lieu 1, refus sur le lieu 2 ; fondateur en aperçu `direction` sur la promo 1,
  lecture de `affectations` sous l'en-tête d'une promo du lieu 2 : résultat noté comme limite documentée (D3), pas comme
  échec ; e-mail de `stag_n` : refus « compte stagiaire », par `regler_affectations_formateur` ET par
  `inviter_compte(…, 'formateur', …)` ; `inviter_compte` d'un nouveau formateur : même profil qu'avant la migration
  (comparé champ par champ à celui que crée la version du lot 4 dans la contre-épreuve) ;
  nouvel e-mail : profil créé (`role 'prof'`, `is_admin` vrai, `invited_by_email` = appelant), `cree` vrai ; liste vide
  pour un compte absent : refus ; liste vide pour `form_m` : ses lignes du lieu 1 partent, celle du lieu 2 reste ; aucune
  ligne `direction` ni `siege` touchée dans tout le bloc (compte avant et après) ; `dir_n` se donne à lui-même la promo 1
  (cumul) : OK.
- [ ] **Step 2 : contre-épreuve locale** : ROUGE sur ces seules lignes.
- [ ] **Step 3 : migration et retour** : `_profil_formateur` reprend à l'identique la création de profil
  d'`inviter_compte` ; `inviter_compte` est redéfinie à partir de sa définition en base au moment de l'exécution
  (`pg_get_functiondef`, pas d'une copie du plan), seules différences : l'appel à `_profil_formateur` et le refus d'une
  adresse de stagiaire (sauté si le lot 4 l'a déjà) ; le retour remet la définition d'origine, gardée dans le retour.
  Après la répétition, la preuve du lot 4 rejouée en mode `en-ligne` sur la base locale migrée : VERT.
- [ ] **Step 4 : répétition** (mode `espaces`, deux migrations) en local puis sur la vraie base : VERT n/0, rien de resté.
- [ ] **Step 5 : commit** « Lot 5, étape 2 : la direction règle les promos de ses formateurs (preuve verte en
  répétition) ».

## Partie C : l'espace de la direction

### Task 7 : Vue d'ensemble, Émargement, Notes et examens du centre

**Files :** Create `js/views/direction-centre.js` ; Modify `js/main.js` (routes `centre`, `emargement`, `notes` selon
l'espace ; `emargementDansLeCentre` lu au démarrage), `js/centre-stats.js` (exporter `aSuivrePromo(donnees, referentiel,
{ aujourdhui })`, la liste « À suivre » d'une seule promo, que `indicateursPromo` appelle déjà), `js/views/centre.js`
(exporter `carte`, `sectionComparaison`, `sectionASuivre`, `sectionThemes` ; `sectionASuivre(liste, { lien, promoDe })`
reçoit le lien de chaque personne et l'étiquette de sa promo, la page de la promo garde son rendu actuel),
`js/views/emargement.js` (mode lecture de la direction), `js/emargement-rules.js`, `js/views/notes.js` (option de page
imbriquée de la direction), `js/centre-csv.js` (`tableauCentreCsv(lignesParPromo) -> string`), `js/db.js`
(`lireEmargementPromo(promoId) -> { seances, lignes }` par l'en-tête de lecture, sans la colonne `trace` des
signatures ; `lireReglagePromo(promoId, cle)`), `css/style.css`, `_harness_supabase.js`.

**Interfaces :** Consumes : Tasks 1, 2, 4 ; `lireDonneesCentre`, `lireReferentielCentre`, `indicateursPromo`. Produces :
`renderVueCentre(container)`, `renderEmargementCentre(container)`, `renderNotesCentre(container)` ;
`renderNotes(container, { dansLeCentre: true })` (sans titre de page, phrases de l'équipe, aucun geste d'écriture).

- [ ] **Step 1 : tests purs** : `resumeEmargement({ seances, lignes }) -> { feuillesCloses, feuilleOuverte, derniere,
  absences, nonSignees }` (`js/emargement-rules.js` ; cas : aucune feuille, une ouverte, absences notées, lignes non
  signées d'une feuille close) ; `aSuivrePromo` sur deux promos à des stades différents (une récente sans passage, une
  avancée) : aucun signal croisé, la liste fusionnée garde la promo de chaque personne ; `tableauCentreCsv` (en-têtes,
  une ligne par promo, nombres et séparateur comme `matriceNotesCsv`).
- [ ] **Step 2 : Vue d'ensemble** (`#/centre` en direction) : surtitre « Centre de <lieu> », titre « Vue d'ensemble »,
  sous-titre « N promos en cours · édité le … » ; cartes de `indicateursPromo(concatenerDonnees(promos en cours))` avec
  leur méthode ; comparaison de toutes les promos du centre ; « À suivre de près » : `aSuivrePromo` de chaque promo en
  cours, fusionnées, la promo de chaque personne affichée, clic = `ouvrirDansUnePromo` vers sa fiche ; « Thèmes à
  retravailler » ; « Exporter le tableau (CSV) » sur ordinateur (maquette). Aucune promo : « Ce centre n'a pas encore de
  promo » et un bouton « Créer une promo » (vers `#/promos`). Échec de lecture : phrase et « Réessayer ».
- [ ] **Step 3 : Émargement** (`#/emargement` en direction) : une ligne par promo du centre (liste sur téléphone) :
  activé ou non, `resumeEmargement`, bouton « Voir les feuilles » (`ouvrirDansUnePromo(id, "#/emargement")`) ; sous le
  résumé, la page Émargement de la promo affichée en mode lecture : `js/views/emargement.js` ne s'arrête plus sur
  `!isAdmin()` quand `isEquipe()` est vrai, mais masque ouvrir, clore, signer et régler l'en-tête ; l'impression des
  feuilles closes et les attestations (l'export de la spec § 4.2 et § 4.3, « sur ordinateur ») restent offertes ;
  l'entrée Émargement s'allume quand une promo du centre a `emargement_actif` (`lireReglagePromo`, lu une fois au
  démarrage et gardé, `renderTabs` restant synchrone).
- [ ] **Step 4 : Notes et examens** (`#/notes` en direction) : par promo, moyenne des notes, critères EPCF acquis, examens
  QCM réussis (de `indicateursPromo`), bouton « Voir la matrice » ; dessous, `renderNotes(container, { dansLeCentre:
  true })` de la promo affichée, en lecture (droits bridés, Task 2).
- [ ] **Step 5 : banc** (`?compte=direction&centre=1&demo=1`) : les trois pages à 1280, 900 et 375 px, deux moteurs ;
  « Voir les feuilles » d'une autre promo revient sur `#/emargement` après rechargement ; feuille close imprimable ; aucun
  bouton d'écriture de formateur ; CSV téléchargé. Captures.
- [ ] **Step 6 : `node --test "tests/*.test.mjs"`**, vérification de navigation : 0 échec.
- [ ] **Step 7 : commit** « Lot 5 : vue d'ensemble, émargement et notes du centre pour la direction ».

### Task 8 : Promos

**Files :** Create `js/views/direction-promos.js` ; Modify `js/db.js` (`creerPromo({ lieuId, nom, debut, fin }) ->
Promise<number>`, `modifierDatesPromo({ promoId, debut, fin })` ; le renommage réutilise `renommerPromo(id, nom)`
existant, qui lève déjà quand aucune ligne ne change), `js/main.js` (route `promos`), `_harness_supabase.js`.

- [ ] **Step 1 : tests purs** (`js/direction-rules.js`) : `validerPromo({ nom, debut, fin }) -> string|null` (nom requis, début requis, fin pas avant
  le début : mêmes phrases que la base) et `etatPromo(promo, aujourdhui) -> "à venir"|"en cours"|"terminée"`.
- [ ] **Step 2 : page** : carte par promo (nom, dates, état, effectif, formateurs, part de la formation écoulée) ; gestes
  « Modifier » (nom, dates) et « Modules » ; pour la promo affichée, « Modules » déplie `renderModulesSection()` ; pour une
  autre, `ouvrirDansUnePromo(id, "#/promos")`. « Créer une promo » : fenêtre nom, début, fin (facultative), centre (choix
  si la direction en a plusieurs) ; après création, `chargerMesPromos` ; première promo du centre (ou compte sans
  aucune promo) : `choisirPromo(id)`, dont le rechargement relit modules, émargement et pastille. Refus : `phraseDeRefus`
  dans la fenêtre, saisie gardée.
- [ ] **Step 3 : banc** : création réussie, création refusée (fin avant début), modification, modules d'une autre promo
  (bascule) ; `?compte=direction-vide` : création de la première promo puis arrivée dans le centre. Deux largeurs, deux
  moteurs.
- [ ] **Step 4 : tests et vérification** : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : la direction crée ses promos et règle leurs dates et modules ».

### Task 9 : Stagiaires du centre

**Files :** Create `js/views/direction-stagiaires.js`, `js/views/stagiaires-gestion.js` ; Modify `js/views/config.js`
(le bloc Stagiaires de `renderPromoSection` et l'invitation d'un compte stagiaire de `renderAccessSection` passent dans
`stagiaires-gestion.js`, `config.js` les monte au même endroit), `js/db.js` (`lireStagiairesPromo(promoId)` par l'en-tête
de lecture, sans passer par le cache unique « stagiaires » de `listStagiaires`), `js/main.js` (route `stagiaires` selon
l'espace et la présence d'une fiche), `_harness_supabase.js`.

**Interfaces :** Produces : `renderGestionStagiaires(container, { rerender })` (ajout, abandon, réactivation,
anonymisation d'un stagiaire de la promo affichée, avec les phrases d'erreur actuelles de `messageErreurStagiaire`) et
`renderInvitationStagiaire(container, { rerender })` (invitation du compte d'une fiche de la promo affichée par
`inviteUser`), dans `js/views/stagiaires-gestion.js`.

- [ ] **Step 1 : déplacer sans rien changer** : les deux blocs sortent de `config.js` vers `stagiaires-gestion.js` ;
  Réglages du formateur identiques avant et après (mêmes textes, mêmes gestes ; `python outils/verifier_navigation.py`
  et `python outils/robot_parcours.py` : 0 échec nouveau). Commit séparé « Lot 5 : gestion des stagiaires sortie des
  Réglages, sans changement visible ».
- [ ] **Step 2 : tests purs** (`js/direction-rules.js`) : `ouTrouverFiche(id, listesParPromo) -> { promoId }|null` ;
  `listeDuCentre(listesParPromo, filtre) -> groupes` (en formation d'abord, abandons repliés, tri par nom comme la page
  actuelle).
- [ ] **Step 3 : page** : stagiaires du centre groupés par promo (`lireStagiairesPromo` pour chaque promo), recherche par
  nom, filtre de promo ; un nom ouvre sa fiche (promo affichée : `#/stagiaires/<id>` ; autre : `ouvrirDansUnePromo`) ;
  le groupe de la promo affichée porte la gestion (`renderGestionStagiaires`, `renderInvitationStagiaire`) ; les autres
  groupes portent « Gérer cette promo » (`ouvrirDansUnePromo(id, "#/stagiaires")`). Les élèves bénévoles n'y sont pas
  (D12). Adresse `#/stagiaires/<id>` d'une fiche hors du centre : « Cette fiche n'est pas dans ton centre. », retour à la
  liste.
- [ ] **Step 4 : banc** : ajout, abandon, réactivation, invitation et anonymisation par la direction dans la promo
  affichée ; fiche et gestion d'une autre promo par bascule ; refus de la base affiché par `phraseDeRefus` ; `?lieux=2` :
  adresse d'une fiche de Montpellier tapée par la direction de Nîmes : phrase, aucun nom de Montpellier dans la page
  (Review Focus 1). Deux largeurs, deux moteurs.
- [ ] **Step 5 : tests et vérification** : 0 échec.
- [ ] **Step 6 : commit** « Lot 5 : la direction voit et gère tous les stagiaires de son centre ».

### Task 10 : Équipe

**Files :** Create `js/views/direction-equipe.js` ; Modify `js/db.js` (`lireEquipeDuCentre(lieuId) -> [{ email, nom,
direction: boolean, promos: integer[] }]` depuis `affectations`, `user_profiles` et `profs` ;
`reglerAffectationsFormateur({ email, lieuId, promoIds, profId })`), `js/main.js` (route `equipe`), `_harness_supabase.js`.

- [ ] **Step 1 : tests purs** (`js/direction-rules.js`) : `equipeAffichee(lignes, promosDuCentre) -> [{ nom, role: "Direction"|"Direction et
  formateur"|"Formateur", promos: string }]` (nom de la fiche formateur, sinon l'adresse ; tri : directions puis
  formateurs par nom).
- [ ] **Step 2 : page** : liste (tableau sur ordinateur, liste sur téléphone) ; « Inviter un formateur » : adresse,
  promos du centre à cocher, fiche formateur libre facultative ; « Modifier » : mêmes cases ; « Retirer du centre »
  (confirmation, liste vide) ; phrase de la base en cas de refus ; une direction ne se retire pas elle-même d'ici. Après
  une invitation : « Compte créé. La personne crée son mot de passe avec cette adresse, onglet Créer mon compte. » (ou
  « Promos mises à jour. » si le compte existait).
- [ ] **Step 3 : banc** : invitation réussie, adresse invalide, compte stagiaire refusé, modification, retrait. Deux
  largeurs, deux moteurs.
- [ ] **Step 4 : tests et vérification** : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : la direction invite ses formateurs et les affecte aux promos ».

## Partie D : l'espace du siège

### Task 11 : Vue d'ensemble du réseau et fiche d'un centre

**Files :** Create `js/views/siege-reseau.js` ; Modify `js/db.js` (`comptesReseau() -> Promise<lignes>` par
`versComptes`), `js/main.js` (route `reseau`), `js/centre-csv.js` (`tableauReseauCsv(vue) -> string`, `vue` rendue par
`vueDuReseau`), `tests/centre-csv.test.mjs`, `_harness_supabase.js` (faux `comptes_reseau` tiré de la fixture et des
centres du banc, dont un petit).

- [ ] **Step 1 : tests** : `tableauReseauCsv` (en-têtes, une ligne par centre, centre masqué « moins de 5 stagiaires en
  formation » sans chiffre, centre sans promo en cours « aucune promo en cours », démonstration à part, séparateur et
  nombres comme `matriceNotesCsv`).
- [ ] **Step 2 : Vue d'ensemble** (`#/reseau`) : surtitre « Réseau · N centres », titre « Vue d'ensemble », sous-titre
  « Chiffres agrégés par centre, sans données nominatives » ; cartes du réseau (stagiaires en formation, taux d'abandon,
  absences aux passages prévus, réussite aux QCM, moyenne des notes, critères EPCF acquis) avec la méthode de chaque
  chiffre et une seule mention pour toutes : « promos en cours, hors centres de moins de 5 stagiaires en formation (N
  centres) » ; tableau par centre (liste sur téléphone), chaque ligne ouvre la fiche ; « Centre de démonstration
  (données fictives, hors totaux) » à part ; « Exporter le tableau (CSV) » sur ordinateur ; « Ajouter un centre »
  (Task 12). Échec : phrase et « Réessayer ».
- [ ] **Step 3 : fiche** (`#/reseau/<id>`) : retour « Vue d'ensemble », cartes du centre et nombre de promos en cours,
  aucun détail par promo (maquette `sEnsemble`) ; centre masqué : « Moins de 5 stagiaires en formation : chiffres non
  affichés. » ; lecture seule ; identifiant inconnu : « Ce centre n'existe pas. » et retour.
- [ ] **Step 4 : banc** (`?compte=siege`, puis fondateur en aperçu siège) : aucun nom de stagiaire du banc dans le DOM
  (recherche des noms des fixtures, le nom du compte connecté excepté), petit centre masqué et hors total, CSV
  téléchargé. Deux largeurs, deux moteurs.
- [ ] **Step 5 : tests et vérification** : 0 échec.
- [ ] **Step 6 : commit** « Lot 5 : vue d'ensemble du réseau, sans aucun nom ».

### Task 12 : Directions de centre, ajouter un centre, inviter un siège

**Files :** Create `js/views/siege-directions.js` ; Modify `js/db.js` (`lireDirectionsDuReseau() -> [{ id, email, nom,
lieu_id }]`, `retirerAffectation(id)` qui relit et lève « Ce retrait n'a pas été accepté. » si rien n'est parti,
`creerCentre(nom) -> Promise<number>`), `js/views/siege-reseau.js` (bouton « Ajouter un centre »), `js/views/config.js`
(option « Siège » de l'invitation, fondateur hors aperçu), `js/main.js` (route `directions`), `_harness_supabase.js`.

- [ ] **Step 1 : tests purs** (`js/siege-rules.js`) : `directionsParCentre(lieux, directions) -> [{ centre, directions }]` (centre sans
  direction compris, démonstration à part).
- [ ] **Step 2 : page** : par centre, ses directions (adresse, ou nom de la fiche formateur liée) ; « Inviter une
  direction » (adresse, centre) par `inviteUser({ email, role: "direction", lieu_id })` ; « Retirer » (confirmation) ;
  « Ajouter un centre » : nom, puis proposition d'inviter sa direction ; refus par `phraseDeRefus`.
- [ ] **Step 3 : banc** : invitation, centre requis, retrait, centre en double refusé ; fondateur : option « Siège » dans
  ses Réglages, absente en aperçu. Deux largeurs, deux moteurs.
- [ ] **Step 4 : tests et vérification** : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : le siège gère les centres et leurs directions ».

### Task 13 : Cours et QCM du siège

**Files :** Modify `js/views/themes.js`, `js/views/cours-reader.js`, `js/views/qcm.js` (et les sous-onglets de Cours et
QCM issus du lot 2B), `js/auth-admin.js` (`isRedacteur()` = `peutRedigerContenus`), `_harness_supabase.js`.

- [ ] **Step 1 : tests purs** (`js/espaces-rules.js`) : `sousOngletsCours(espace) -> string[]` (siège : Thèmes, Compétences, QCM, Documents ;
  formateur : inchangé).
- [ ] **Step 2 : brancher** : les gestes de rédaction (modifier un cours, le publier, modifier une question) lisent
  `isRedacteur()` ; examens, progression, ajout de notion, propositions IA et signalements gardent `isAdmin()` ; en siège,
  aucune mention de promo (progression, examen ouvert) ; la page tient sans promo.
- [ ] **Step 3 : banc** (`?compte=siege`, fondateur en aperçu siège, formateur) : le siège ouvre l'éditeur d'un cours et
  d'une question (écritures notées par le faux client, jamais publiées en vrai) ; aucun bouton d'examen ; formateur
  inchangé. Deux largeurs, deux moteurs.
- [ ] **Step 4 : tests et vérification** : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : le siège rédige les contenus communs ».

## Partie E : habillage par défaut du centre et du réseau (selon la réponse de Timy)

### Task 14 : Réglages du centre et du réseau

**Files :** Create `supabase/migrations/20261108_espaces_3_habillage.sql` et `_retour.sql`, `js/views/reglages-habillage.js` ;
Modify `tests/sql/espaces-preuve.sql`, l'assembleur, `js/db.js` (`habillageParDefaut()`, `reglerHabillageCentre`,
`reglerHabillageReseau`), `js/main.js` (`bootApp` : défauts passés au lot 3 ; route `config` selon l'espace),
`js/nav-rules.js` (`reglagesEspace` vrai), `js/espaces-rules.js` (`defautsHabillage`), `tests/habillage.test.mjs` ;
au Step 0 seulement : `js/habillage.js`, `js/habillage-regles.js`, `js/habillage-avant-peinture.js` et leurs tests.

**Interfaces :** Consumes (lot 3, partage convenu le 08/11 avec la conversation du plan du lot 3, note
`lot3-habillage-levier.md` du dossier partagé) : `habillageAuDemarrage({ email, compte, centre, reseau, libre })`
(`js/habillage.js`, appelée au début de `bootApp`), qui s'appuie sur `habillageRetenu({ appareil, compte, email, centre =
null, reseau = null, libre = true }) -> { nom, source, envoi }` (`js/habillage-regles.js` ; `envoi` : nom à enregistrer
sur le compte, ou `null` ; `libre` faux et centre valide : le centre l'emporte) ; `blocHabillage()` (`js/habillage-choix.js`, les deux pastilles) ; valeurs `"ecsr"`,
`"ecf"` ou `null` ; appareil `{ nom, email, aEnvoyer, choisi }` (`choisi` absent vaut vrai). Le lot 3 ne lit rien du
centre ni du réseau : c'est ce lot. Condition (signalée au lot 3 le 08/11, reprise dans son plan, be8eaa1) : l'appareil
distingue un choix de la personne du dernier habillage appliqué, et un habillage appliqué qui n'est pas un
choix (source `centre`, `reseau` ou `defaut`) n'est jamais envoyé au compte ni retenu comme choix au démarrage suivant ;
s'il n'en est rien à l'exécution, le Step 0 le fait. Produces : `habillage_par_defaut() returns table(centre text, libre
boolean, reseau text)` (centre de la promo affichée, ou premier lieu des affectations ; lisible de tout compte
connecté) ; `defautsHabillage(ligne) -> { centre, reseau, libre }` (valeur hors `ecsr`, `ecf` ramenée à `null`, `libre`
vrai par défaut) ; refus `habillage: …`.

- [ ] **Step 0 (seulement si la condition manque)** : dans les modules du lot 3, marquer sur l'appareil si le nom est un
  choix ; `habillageRetenu` ignore un appareil qui n'est pas un choix pour la résolution, l'avant-peinture l'applique
  toujours (aucun éclair) ; tests du lot 3 complétés, verts.

- [ ] **Step 1 : preuve** : `regler_habillage_centre` par `dir_n` sur le lieu 1 (OK), sur le lieu 2 (42501), par
  `form_n`, `siege` (42501) ; valeur hors `ecsr`, `ecf`, nul : refus ; `regler_habillage_reseau` par `siege` et le
  fondateur (OK), par `dir_n` (42501) ; `habillage_par_defaut` lu par `stag_n` : valeurs du lieu 1 et du réseau ;
  contre-épreuve locale ROUGE sur ces lignes, migration, répétition VERTE en local puis en production, rien de resté.
- [ ] **Step 2 : tests** : `defautsHabillage` (ligne nulle, valeurs inconnues, `libre` absent) ; l'ordre de résolution
  lui-même est testé par le lot 3 ; test d'intégration (`tests/habillage.test.mjs`, dépendances injectées) sur trois
  démarrages d'un même compte sans choix : centre `ecf` appliqué ; centre repassé à `ecsr` suivi au démarrage suivant ;
  rien envoyé au compte ; puis un choix de la personne (`choisirHabillage("ecf")`) l'emporte sur le centre `ecsr` tant
  que `libre` est vrai.
- [ ] **Step 3 : pages** : Réglages du centre (« Habillage par défaut du centre » par `blocHabillage()`, « Laisser chacun
  choisir le sien ») ; Réglages du réseau (habillage par défaut du réseau, même bloc) ; au démarrage, une fois la porte
  passée, l'app lit `habillage_par_defaut()` et appelle `habillageAuDemarrage` avec `defautsHabillage(ligne)` (échec de
  lecture : défauts nuls, sans message ; le choix de l'appareil reste appliqué entre-temps, sans éclair).
- [ ] **Step 4 : banc et vérification**, deux largeurs, deux moteurs : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : habillage par défaut du centre et du réseau ».

## Partie F : preuve, mise en ligne

### Task 15 : assistant et Nouveautés

**Files :** Modify `supabase/functions/chatbot/aide.mjs` (`AIDE_APP_V2` : barre de la direction et barre du siège, gestes
de chaque page, section ANCIENS NOMS inchangée ; le guide est choisi par l'espace reçu, et plus seulement par la
navigation), `tests/chatbot-aide.test.mjs` (comparaison aux entrées de la direction et du siège), `js/chatbot-rules.js`
(`corpsRequete(histo, hash, navigationV2, espace)` ajoute `espace` ; en direction et siège `navigationV2` est vrai, D4),
`tests/chatbot-rules.test.mjs`, `js/chatbot.js` (passe `getEspace()`), `js/nouveautes.js`
(audiences `direction` et `siege` : montrées à qui a cet espace, ou au fondateur en aperçu de cet espace ; les
Nouveautés `formateurs` ne sont montrées qu'en espace formateur, leurs liens menant à des pages de cet espace),
`tests/nouveautes.test.mjs`, `js/nouveautes-data.js`.

- [ ] **Step 1 : tests** : le guide nomme chaque entrée des deux barres ; un appel avec `espace: "direction"` reçoit le
  guide de la direction, `espace: "equipe"` celui du formateur ; une Nouveauté `pour: "direction"` n'apparaît ni au
  formateur ni au stagiaire ; une Nouveauté `pour: "formateurs"` n'apparaît pas en espace direction ni siège.
- [ ] **Step 2 : guide et Nouveautés** (date posée à la fusion) : pour la direction, « Ton espace de direction » (vue
  d'ensemble du centre, promos, stagiaires, émargement, notes, équipe ; un geste par page, dans les mots de l'écran) ;
  pour le siège, « L'espace du siège » (chiffres du réseau sans aucun nom, centres et directions, contenus communs) ;
  pour les formateurs qui dirigent aussi : « Espace » dans le menu du compte ; l'entrée « Changer de promo » laissée par
  le lot 4 (son « Reste pour le lot 5 »), si elle n'existe pas encore.
- [ ] **Step 3 : `node --test "tests/*.test.mjs"`** : vert.
- [ ] **Step 4 : commit** « Lot 5 : l'assistant connaît les espaces direction et siège ; Nouveautés ».

### Task 16 : parcours rôle par rôle et recoupement des chiffres

**Files :** Create `outils/parcours/direction.py`, `outils/parcours/siege.py` (parcours `@parcours`, rôle et compte du
banc par `banc={"compte": …}`, `depart` dans l'espace : `#/promos` pour la direction, `#/directions` pour le siège) ;
Modify `outils/parcours/__init__.py` (le champ `role` admet `direction` et `siege`), `outils/parcours/visite.py`
(l'espace de la visite suit le rôle : `stagiaire`, `equipe`, `direction`, `siege`), `outils/parcours/navigation.py`
(`chemin` connaît les entrées des deux nouvelles barres et le « Plus » du téléphone ; alias « Accueil » → « Vue
d'ensemble », D16), `_harness_supabase.js` (levier de panne par fonction `?panne=<nom de la fonction>` : cette fonction
seule rend une erreur, les autres répondent ; le levier global `window.__HARNESS_FAIL` reste) ; Create
`outils/recouper_comptes.mjs`, `tests/recouper-comptes.test.mjs`.

Chaque parcours se joue par `python outils/robot_parcours.py` (Chromium et WebKit, iPhone et ordinateur, nouvelle
navigation pour la direction et le siège, les deux pour P3, P5, P6 et P7), au banc ; budgets du référentiel : vue
d'ensemble du centre et du réseau en 1 clic depuis la page de départ ; à chaque vue, les contrôles du robot (titre de
page, console, défilement de côté, cibles, entrée allumée, Échap, mots interdits).

| N° | Qui (banc) | Parcours | Attendu |
|---|---|---|---|
| P1 | direction (`?compte=direction&centre=1&demo=1`) | chaque entrée de la barre puis de « Plus » ; créer une promo ; fiche d'une autre promo ; « Voir les feuilles » ; inviter un formateur | chaque geste aboutit ou dit pourquoi ; retour sur la page visée après chaque bascule |
| P2 | direction sans promo (`direction-vide`) | arrivée, créer la première promo | accueil « pas encore de promo » puis centre avec sa promo |
| P3 | direction et formateur (`dirform`, promo à l'interrupteur éteint) ; `dirailleurs` | menu, Espace : Formateur (ancienne barre) puis Direction (nouvelle) ; rechargement | barre qui change, choix gardé ; `dirailleurs` arrive sur son centre dirigé |
| P4 | siège (`?compte=siege`) | Vue d'ensemble, fiche d'un centre, CSV, Directions (inviter, retirer), Ajouter un centre, Cours et QCM | aucun nom de stagiaire du banc dans le DOM (nom du compte connecté excepté) ; petit centre masqué et hors total |
| P5 | fondateur | Voir en tant que : Direction, Siège, Formateur, Stagiaire, Revenir, sur promo 1 (éteinte) et promo 7 (allumée) | espace, barre et bandeau justes ; aucune promo d'un autre centre en aperçu direction |
| P6 | formateur (`?role=prof`) | adresses `#/promos`, `#/equipe`, `#/reseau`, `#/directions` | accueil de son espace et phrase « Cette page n'est pas dans l'espace Formateur. » ; pas de section Espace |
| P7 | stagiaire | mêmes adresses | idem, espace Stagiaire |
| P8 | sans rôle (`sansrole`) | connexion | refus de la porte avec la phrase du lot 4 |
| P9 | direction de Nîmes (`?lieux=2`) | adresse d'une fiche de Montpellier | « Cette fiche n'est pas dans ton centre. », aucun nom de Montpellier |
| P10 | direction et siège, base en panne (`?panne=comptes_reseau`, `?panne=regler_affectations_formateur`, `?panne=creer_promo`) | gestes de P1 et P4 | une phrase et « Réessayer » ou la saisie gardée, jamais rien |

- [ ] **Step 1 : étendre le robot** (rôles, espaces, chemins, alias, levier de panne) ; `python outils/robot_parcours.py`
  sur `main` sans les nouveaux parcours : même verdict qu'avant (rien de cassé).
- [ ] **Step 2 : déclarer les parcours** P1 à P10 et les jouer : code 0, aucun défaut nouveau ; passe « interrupteur
  éteint = main » de `outils/verifier_navigation.py` intacte.
- [ ] **Step 3 : outil de recoupement** (`node outils/recouper_comptes.mjs <brut.json> <comptes.json>`, test
  `tests/recouper-comptes.test.mjs`) : pour chaque centre, il calcule `comptesDepuisIndicateurs(indicateursPromo(
  concatenerDonnees(promos en cours du centre)))` et le compare à la ligne de `comptes_reseau()` de même `lieu_id`
  (notes à 1e-9) ; centre masqué : il vérifie seulement que le calcul de l'app donne moins de 5 en formation ; il écrit
  « identiques » ou chaque écart, et sort en code 1 au moindre écart ; testé sur la fixture (brut = `donnees`, comptes =
  `attendu` en colonnes de la base) et sur une copie sabotée. Joué sur les vrais centres à la Task 17.
- [ ] **Step 4 : registre** : verdicts, nombre de vues, captures (sans aucun nom ni e-mail).
- [ ] **Step 5 : commit** « Lot 5 : parcours rôle par rôle et outil de recoupement des chiffres ».

### Task 17 : relecture finale, application, fusion

- [ ] **Step 1 :** relire `supabase/migrations/` et `js/` de `main` (ce qui est arrivé depuis le début du lot) ; rejouer la
  répétition `espaces` et la preuve du lot 4 en mode `en-ligne` (aucune règle ne change : VERT).
- [ ] **Step 2 :** relecture de toute la branche par le modèle le plus capable (base, app, preuve, plan, Review Focus),
  corrections, rejeu des tests, des parcours et de la répétition.
- [ ] **Step 3 : audit par testeurs** (référentiel § 3, « après une refonte ») : des agents frais qui ne voient que les
  captures de fin de parcours jouent une direction de centre sur l'ordinateur, une direction sur iPhone et le siège sur
  l'ordinateur ; ils notent le premier clic, l'assurance et l'attrait visuel (critères F et K) ; ce qui passe sous les
  seuils est corrigé ou listé pour Timy.
- [ ] **Step 4 :** compte rendu à Timy (bilan, tableau d'état, schéma, étapes suivantes) ; attendre son accord pour :
  appliquer les migrations, redéployer la fonction `chatbot`, fusionner et pousser.
- [ ] **Step 5 (après accord) :** appliquer les migrations 1, 2 (et 3) une à une ; preuve en mode `espaces-en-ligne` :
  VERT ; recoupement : extraire en lecture seule, dans une transaction annulée où `incarner` (lot 4) pose le fondateur,
  les données brutes des promos en cours de chaque centre (colonnes de `lireDonneesCentre` sans `prenom` ni `nom`) et
  `comptes_reseau()`, dans le scratchpad, jamais dans le dépôt ; `outils/recouper_comptes.mjs` : « identiques » ;
  fichiers effacés ; redéployer `chatbot` ; `python outils/robot_parcours.py` vert sur la branche ; fusion dans `main`
  (`merge --no-ff --no-commit` puis `commit -F`, le crochet pose le jeton), tests, `python outils/robot_parcours.py` et
  vérification sur `main`, poussée ; ordre : base, fonction, app.
- [ ] **Step 6 : clôture** : banc enrichi recopié dans `TP_ECSR_App` après `diff` ; branche (locale et distante),
  worktree et entrée du banc dans `Dev/ECSR/.claude/launch.json` retirés ; à la conversation de coordination, ce qui
  change dans la roadmap et le point de reprise ; récap WhatsApp prêt à coller ; proposer l'archivage.

## Annexe A : questions posées à Timy avec ce plan

1. **Qualiopi dans le lot 5 ?** Recommandé : non. La spec Qualiopi demande que le lot Q5 (conditions d'utilisation,
   conservation à 3 ans) passe avant qu'une direction ait la page, et le dossier « sans aucun nom » du siège se calcule
   aujourd'hui dans le navigateur à partir des données nominatives, que le siège ne peut pas lire : il faudra un calcul
   côté base. D'où un lot à part, « 5Q », après Q5 : page Qualiopi de la direction (avec l'annotation), téléchargement du
   siège. Si oui : ajouter ce lot ici (deux à trois tâches de plus, une migration).
2. **Habillage par défaut du centre et du réseau dans le lot 5 ?** Recommandé : oui, en dernière partie (Partie E), si le
   lot 3 a livré le choix personnel ; sinon il part dans un lot suivant et les Réglages du centre et du réseau n'ont pas
   d'entrée de barre.

## Annexe B : laissé aux lots suivants

- Lot 5Q (selon la réponse 1) : Qualiopi de la direction et du siège.
- Veille réglementaire dans l'app (entrée du siège quand elle existera).
- Modules de départ et partenaires du centre, interrupteurs de l'émargement et de la navigation confiés à la direction :
  demandent une évolution de la matrice du lot 4.
- Détail par promo au siège : jamais (maquette : chiffres par centre ; secret statistique).
