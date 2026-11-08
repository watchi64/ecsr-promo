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
des comptes agrégés calculés par la base, sans aucun nom. Une même fixture fige les définitions des deux calculs, pour que
direction et siège donnent les mêmes chiffres.

**Technique :** modules ES sans framework, `node --test`, PostgreSQL 17 (Supabase `crpduennbqaemhfaywrz`), fonctions
`security definer`, preuves SQL rejouables (`tests/sql/`, assembleur du lot 4), banc d'essai (`_harness.html`), robot des
parcours du filet qualité (`docs/qualite/`) et `outils/verifier_navigation.py` (Chromium et WebKit).

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
| Lot 4 fusionné dans `main` ET appliqué en base | table `affectations` ; `est_formateur`, `est_direction`, `est_siege`, `est_fondateur`, `lieu_de_promo`, `redacteur_contenus`, `apercu_role` ; `inviter_compte`, `creer_promo`, `modifier_dates_promo` ; `mes_promos().roles` ; en-tête `x-apercu-role` ; `js/roles-rules.js` (`droitsAffiches`, `apercusPermis`, `DROITS_APERCU`, `messageSansPromo`) ; `js/db.js` (`mesRolesAffectes`, `poserApercu`, `inviteUser`) ; `tests/sql/roles-aides.sql` (`incarner(email, promo, apercu)`) ; `outils/assembler_repetition_roles.mjs` (repères `-- @@INJECTER <chemin>@@` et `-- @@INCLURE <chemin>@@`, option `--compact`) ; banc `?compte=direction|siege|sansrole|ancien|cumul` (Task 8b du lot 4) | relire `git log main` et le registre du lot 4, puis corriger les noms de ce plan avant la Task 1 (ruling à noter) |
| Lot 3 (habillage) fusionné | aucune couleur à retoucher ici ; la Partie E branche les défauts du centre et du réseau sur la fonction de résolution du lot 3 | Partie E réécrite sur l'interface réelle, ou reportée (question à Timy, annexe) |
| Lot 2B (nouvelles pages) fusionné, s'il passe avant | identifiants des entrées et des sous-onglets de Cours et QCM, guide de l'assistant `AIDE_APP_V2` | aligner les identifiants cités dans les Tasks 2, 13 et 15 |
| Filet qualité (« 05 - Poser le filet qualité ») fusionné | robot des parcours (`docs/qualite/`, lire son mode d'emploi) | Task 16 jouée par `outils/verifier_navigation.py` seul, parcours identiques |

La branche part de `main` après ces fusions : worktree `C:/Users/watch/Dev/ecsr-promo-lot5`, branche `lot5-espaces`.

## Global Constraints

- Aucun tiret cadratin (U+2014) nulle part : code, SQL, commits, Nouveautés, réponses. Contrôle en Python
  (`chr(0x2014)`), pas par `git grep` dans le bash de ce poste.
- « Formateur », jamais « Prof » à l'écran ; tutoiement dans tous les textes de l'app, comme aujourd'hui.
- Aucun nom ni e-mail réel dans le dépôt (il est public) : personnages fictifs `@exemple.invalid`, comptes réels choisis
  par requête.
- Aucune couleur écrite en dur dans les fichiers de ce lot (le lot 3 les a chassées) : classes et jetons existants
  seulement. Contrôlé par `tests/espaces-sans-couleur.test.mjs` (Task 1).
- Aucun défilement de côté, à aucune largeur ; tableaux en listes hors ordinateur ; cibles de 44 px sur téléphone ;
  contraste AA ; jamais une note en rouge.
- Toute écriture qu'un rôle n'a pas en base est masquée côté app ; tout refus de la base s'affiche par sa phrase
  (`phraseDeRefus`), toute écriture qui ne touche aucune ligne le dit. Aucun bouton ne mène à un refus silencieux, aucune
  page à une impasse (une page vide dit pourquoi et propose le geste suivant).
- Le siège ne reçoit de la base aucun nom, aucun e-mail de stagiaire, aucun identifiant de stagiaire, aucune ligne de
  donnée individuelle : seulement des comptes par promo, masqués sous 5 stagiaires en formation.
- Migrations : `supabase/migrations/20261108_espaces_<n>_<nom>.sql`, chacune avec son `_retour.sql` ; jamais appliquées
  sans l'accord explicite de Timy ; répétitions dans un bloc `do` qui finit par une levée, `set local lock_timeout =
  '3s'`, hors des heures de cours, par psql comme au lot 4 (chaîne `SUPABASE_DB_URL` du `.env`, mot de passe passé à
  part, jamais affiché), base locale jetable d'abord, deux passages en production au plus par tâche.
- Jamais de cours publié par un agent ; jamais de déploiement de fonction sans l'accord de Timy.
- Toute mise en ligne visible porte son entrée dans `js/nouveautes-data.js`, dans le même commit.
- Tests de départ : `node --test "tests/*.test.mjs"` vert ; chaque tâche le garde vert.

## Review Focus

1. **Un autre centre** : une direction de Nîmes qui tape l'adresse d'une fiche de Montpellier, ou le fondateur en aperçu
   direction sur la promo 7 (centre Démonstration) : rien d'un autre centre ne s'affiche, une phrase dit pourquoi
   (Tasks 3, 9, preuve Task 6, parcours P9).
2. **Les petites promos au siège** : une promo de moins de 5 stagiaires en formation n'envoie que ses effectifs, et aucun
   total du réseau ne permet de retrouver ses chiffres par soustraction (preuve Task 5, test Task 4, Task 11).
3. **Le siège sans promo** : tout ce qui suppose une promo (pastille, bandeau d'émargement, « à traiter », modules,
   bandeau « Promos non chargées », Mon suivi, Nouveautés propres à une promo) ne s'affiche pas et ne lève rien
   (Task 2, parcours P4).
4. **La bascule vers une autre promo** : ouvrir une fiche, une feuille ou des modules d'une autre promo du centre recharge
   l'app sur la bonne page, sans perdre un enregistrement en cours (Tasks 2 et 9, parcours P1).
5. **Un refus qui se tait** : 42501, fonction absente avant la migration (PGRST202), retrait qui touche 0 ligne : chaque
   page montre une phrase (test `phraseDeRefus`, Tasks 8, 10, 12 ; parcours P10).

## 0. Décisions de conception

| N° | Décision | Raison |
|---|---|---|
| D1 | Quatre espaces : `stagiaire`, `equipe` (le formateur, nom technique gardé du lot 1, libellé « Formateur »), `direction`, `siege`. Les trois derniers ont la barre latérale. | Le lot 1 et le lot 4 nomment déjà `equipe` ; ne pas renommer partout. |
| D2 | Espaces permis d'un compte, dans cet ordre : siège, direction, formateur, stagiaire (stagiaire seulement s'il n'en a aucun autre). Le choix est mémorisé sur l'appareil (`ecsr_espace:<email>`) ; un choix devenu impossible retombe sur le premier permis. | Spec § 4.3 : rôles cumulables, passage depuis le menu. |
| D3 | Le fondateur hors aperçu reste dans l'espace formateur. Direction et siège se regardent par l'aperçu, qui est fidèle (la base répond comme pour une direction du centre de la promo affichée, ou comme le siège). Les modifications faites en aperçu sont réelles : le bandeau le dit. | Demande du 30/10 (« regarder chaque espace séparément ») ; un espace « direction avec les droits du fondateur » ne montrerait pas ce que voit une direction. |
| D4 | La direction et le siège ont toujours la nouvelle navigation (l'interrupteur `navigation_v2` ne vaut que pour les promos). | Ils n'ont pas d'ancienne interface ; le siège n'a pas de promo où lire l'interrupteur. |
| D5 | La porte laisse entrer un compte sans promo s'il a une affectation siège (espace siège) ou direction (espace direction, « Créer la première promo »). Les autres gardent le refus du lot 4. | Lot 4, « Laissé aux lots suivants ». |
| D6 | Le centre affiché est le lieu de la promo affichée ; sans promo, le premier lieu des affectations direction. Changer de centre, c'est choisir une promo de ce centre (rechargement, comme la pastille). | Pas de second contexte à synchroniser avec `x-promo-id`. |
| D7 | Chaque page de la direction montre toutes les promos du centre en résumé, puis le détail de la promo affichée (modules, feuilles, matrice, fiche). « Voir le détail » d'une autre promo la rend affichée : `ouvrirDansUnePromo(promoId, adresse)` mémorise l'adresse visée, bascule, et l'app rouvre cette adresse. | Les écritures et les fiches existantes lisent la promo affichée ; l'en-tête de lecture interdit l'écriture (règle du tableau de bord du 23/10). |
| D8 | Lectures de la direction : données brutes de chaque promo du centre par l'en-tête de lecture (`lireDonneesCentre`), calculs de `js/centre-stats.js`. Le centre = la concaténation des promos en cours, donnée telle quelle à `indicateursPromo`. | Zéro calcul nouveau ; « À suivre de près » et « Thèmes à retravailler » marchent au centre sans autre code. |
| D9 | Lectures du siège : `comptes_reseau()`, des comptes additifs par promo calculés par la base, sans nom. Promo de moins de 5 stagiaires en formation : effectifs seulement (`masque`). Le total d'un centre et du réseau additionne les seules promos en cours non masquées. Le centre de démonstration (`lieux.demonstration`) est montré à part, hors totaux. | Décision du 27/10 (pas de données nominatives au siège) ; seuil de 5, comme les avis des stagiaires (Qualiopi, décision 4). |
| D10 | Mêmes définitions des deux côtés : une fixture (`tests/fixtures/comptes-promo.json`, données fictives et comptes attendus) est jouée par le test node (`indicateursPromo` puis `comptesDepuisIndicateurs`) ET par la preuve SQL (`comptes_reseau`). Recoupement final sur les vraies promos (Task 16). | Le test du premier clic de la maquette avait trouvé des chiffres d'un même centre différents entre direction et siège. |
| D11 | Écrire sur une autre promo du centre passe par des fonctions qui prennent la promo ou le centre en paramètre (`creer_promo`, `modifier_dates_promo`, `regler_affectations_formateur`), jamais par l'en-tête de lecture. | Garde du 23/10 : l'en-tête de lecture refuse toute écriture. |
| D12 | Hors de ce lot : Qualiopi pour la direction et le siège (attend le lot Q5 : conditions et conservation, « avant qu'une direction ait la page ») ; Veille réglementaire (pas encore dans l'app) ; Partenaires et Modules de départ du centre (la direction n'écrit pas les bénévoles, matrice du lot 4) ; interrupteurs de l'émargement et de la navigation (fondateur seul, R32). Aucune entrée de barre pour eux : pas d'écran « Bientôt ». | Pas d'impasse (règle de Timy du 08/11) ; le test du premier clic a puni les écrans « Bientôt ». |
| D13 | Le siège rédige les contenus communs (cours de thème, questions de QCM : `redacteur_contenus()` du lot 4) depuis Cours et QCM ; ni examens, ni progression, ni propositions IA, ni signalements. | Matrice du lot 4 ; décision 4 du 27/10. |
| D14 | Le siège crée un centre (`creer_centre`) et invite sa direction (`inviter_compte(…, 'direction', …, p_lieu_id)` du lot 4). Le fondateur hors aperçu invite un compte siège depuis ses Réglages. | Sans cela, ouvrir un centre demande du SQL à la main. |

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
| `themes` | inchangé | hors espace | contenus communs |
| `config` | Réglages de la promo | Réglages du centre (Partie E) | Réglages du réseau (Partie E) |
| `home` | inchangé | mène à `centre` | mène à `reseau` |
| `nouveautes`, `preferences`, `problemes` | inchangé | permises | permises |

## 2. La base

| Migration | Contenu | Qui |
|---|---|---|
| `20261108_espaces_1_siege.sql` | colonne `lieux.demonstration boolean not null default false`, posée à vrai pour le lieu 4 « Démonstration » (garde : exactement une ligne, sinon levée) ; `comptes_reseau()` ; `creer_centre(p_nom text) returns integer` | Task 5 |
| `20261108_espaces_2_equipe.sql` | `regler_affectations_formateur(p_email text, p_lieu_id integer, p_promo_ids integer[], p_prof_id integer default null) returns jsonb` | Task 6 |
| `20261108_espaces_3_habillage.sql` (Partie E) | `lieux.habillage text` (`ecsr`, `ecf` ou nul), `lieux.habillage_libre boolean not null default true` ; clé globale `habillage_reseau` admise par `settings_globaux_prevus` ; `habillage_par_defaut()`, `regler_habillage_centre(p_lieu_id integer, p_habillage text, p_libre boolean)`, `regler_habillage_reseau(p_habillage text)` | Task 14 |

Aucune table nouvelle, aucune règle RLS modifiée : la matrice et la preuve du lot 4 restent justes (rejouées en mode
`en-ligne` à la Task 17). Fonctions : `language plpgsql` ou `sql`, `security definer set search_path = public, pg_temp`,
`revoke all … from public, anon, service_role`, `grant execute … to authenticated`. Refus : `raise exception
'<prefixe>: <phrase>'` (`reseau`, `centre`, `equipe`, `habillage`), code `42501` pour un droit manquant.

**`comptes_reseau()`** `returns table(lieu_id integer, lieu_nom text, demonstration boolean, promo_id integer, promo_nom
text, date_debut date, date_fin date, masque boolean, inscrits integer, en_formation integer, abandons integer, absences
integer, prevus integer, qcm_bonnes integer, qcm_questions integer, examens_passes integer, examens_reussis integer,
notes_n integer, notes_somme numeric, notes_sous10 integer, epcf_acquis integer, epcf_renseignes integer)`. Réservée à
`est_siege()` (siège, fondateur hors aperçu, aperçu siège), sinon `reseau: Réservé au siège.` (42501). Une ligne par
promo, plus une ligne sans promo (`promo_id` nul, comptes nuls) pour un centre qui n'en a aucune. `masque` vrai quand
`en_formation < 5` : toutes les colonnes après `abandons` sont nulles. Définitions (celles de `METHODES`, `js/centre-stats.js`),
toutes sur les stagiaires actifs de la promo :

| Colonne | Définition |
|---|---|
| `inscrits`, `en_formation`, `abandons` | fiches de la promo ; fiches `actif` ; différence |
| `absences`, `prevus` | passages de type `Salle` ou `Voiture` : `resultat = 'Absence'` ; `resultat in ('Effectué', 'Absence')` |
| `qcm_bonnes`, `qcm_questions` | tentatives `mode = 'entrainement'` : somme de `score`, somme de `total` (nul compté 0) |
| `examens_passes`, `examens_reussis` | tentatives `mode = 'examen'` ; celles dont `note_20 >= coalesce(qcm.exam_pass_20, 15)` |
| `notes_n`, `notes_somme`, `notes_sous10` | évaluations notées (`note` non nulle, `note_max` non nul et non nul en valeur) : nombre, somme de `note / note_max * 20`, nombre sous 10 |
| `epcf_acquis`, `epcf_renseignes` | par stagiaire et par trame (`salle`, `vehicule`), la dernière évaluation `contexte = 'EPCF'` non auto-évaluée (plus grande `date_eval`, puis plus grand `id`) ; valeurs `A` ; valeurs `A`, `R` ou `NA` de `scores` |

**`creer_centre(p_nom)`** : `est_siege()`, sinon `centre: Réservé au siège.` (42501) ; nom nettoyé non vide (`centre: Le
nom est requis.`) ; pas de centre du même nom, casse ignorée (`centre: Ce centre existe déjà.`) ; rend l'`id`.

**`regler_affectations_formateur`** : donne au compte exactement les promos `p_promo_ids` du centre `p_lieu_id` comme
formateur. `est_direction(p_lieu_id)` (direction du centre, fondateur, aperçu direction sur ce centre), sinon `equipe:
Réservé à la direction du centre.` (42501) ; e-mail valide ; toute promo de la liste est du centre (`equipe: Une promo
choisie n'est pas dans ce centre.`) ; un compte qui a une fiche de stagiaire n'est jamais affecté (`equipe: Cette adresse
est celle d'un compte stagiaire.`) ; compte absent et liste vide : `equipe: Choisis au moins une promo.` ; compte absent :
profil créé comme `inviter_compte` crée un formateur (`role 'prof'`, `is_admin true`, `prof_id` si la fiche est libre,
`invited_by_email`) ; retire les lignes `formateur` de ce compte sur les promos du centre hors liste, ajoute les
manquantes, ne touche à rien d'autre (autres centres, lignes `direction` et `siege`). Rend `{ email, cree, ajoutees,
retirees }` (tableaux d'identifiants de promo).

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/espaces-rules.js`, `tests/espaces-rules.test.mjs` | règles pures des espaces (permis, choix, bride des droits, routes, porte, centre, phrases) |
| `js/direction-rules.js`, `tests/direction-rules.test.mjs` | règles pures des pages de la direction (promos, stagiaires du centre, équipe) |
| `js/siege-rules.js`, `tests/siege-rules.test.mjs` | règles pures des pages du siège (directions par centre) |
| `js/nav-rules.js`, `tests/nav-rules.test.mjs` | entrées de la direction et du siège, barre du téléphone |
| `js/auth-admin.js`, `js/db.js`, `js/main.js`, `js/nav-shell.js`, `js/menu-compte.js`, `js/icons.js` | branchements : porte, espace courant, coquille, menu « Espace », aperçu, bascule |
| `js/comptes-reseau.js`, `tests/comptes-reseau.test.mjs`, `tests/fixtures/comptes-promo.json` | comptes additifs, sommes, ratios, promos en cours |
| `js/centre-stats.js` | `notes.detail.somme` en plus (rien d'autre ne change) |
| `js/views/direction-centre.js` | Vue d'ensemble du centre, Émargement et Notes et examens de la direction |
| `js/views/direction-promos.js`, `js/views/direction-stagiaires.js`, `js/views/direction-equipe.js` | pages de la direction |
| `js/views/siege-reseau.js`, `js/views/siege-directions.js` | pages du siège |
| `js/views/reglages-habillage.js` | Réglages du centre et du réseau (Partie E) |
| `supabase/migrations/20261108_espaces_*.sql` (+ `_retour`) | section 2 |
| `tests/sql/espaces-preuve.sql` | preuve rôle par rôle et portée par portée des fonctions du lot |
| `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs` | modes `espaces`, `espaces-contre-epreuve`, `espaces-en-ligne` |
| `outils/recouper_comptes.mjs`, `tests/recouper-comptes.test.mjs` | recoupement direction et siège (outil Task 16, joué sur les vraies promos Task 17) |
| `_harness_supabase.js` | banc : comptes et RPC du lot (copie reportée dans `TP_ECSR_App` en fin de lot, après `diff`) |
| `supabase/functions/chatbot/aide.mjs`, `tests/chatbot-aide.test.mjs` | guide de l'assistant : barres de la direction et du siège |
| `js/nouveautes-data.js`, `js/nouveautes.js` | audiences `direction` et `siege` |

---

## Partie A : le socle des espaces (aucune migration)

### Task 1 : règles des espaces

**Files :** Create `js/espaces-rules.js`, `tests/espaces-rules.test.mjs`, `tests/espaces-sans-couleur.test.mjs` ; Modify
`js/nav-rules.js`, `tests/nav-rules.test.mjs`, `js/route-rules.js` (`lireAdresse`, `adresseFiche` : `reseau/<id>`).

**Interfaces :**
- Consumes : `droitsAffiches`, `normaliserApercu` (`js/roles-rules.js`, lot 4).
- Produces (`js/espaces-rules.js`) : `ESPACES = ["stagiaire", "equipe", "direction", "siege"]` ; `LIBELLES_ESPACE =
  { stagiaire: "Stagiaire", equipe: "Formateur", direction: "Direction", siege: "Siège" }` ; `ACCUEIL_ESPACE =
  { stagiaire: "home", equipe: "home", direction: "centre", siege: "reseau" }` ; `barreLaterale(espace) -> boolean` ;
  `espacesPermis({ profil, promo, affectations, apercu }) -> string[]` ; `espaceChoisi(permis, memorise) -> string|null` ;
  `brider(droits, espace) -> droits` ; `peutRedigerContenus({ droits, espace }) -> boolean` ; `porteSansPromo(affectations)
  -> "siege"|"direction"|null` ; `centreAffiche({ promo, affectations }) -> { id, nom }|null` ; `promosDuCentre(promos,
  lieuId) -> promos[]` ; `routeDansLEspace(espace, route) -> boolean` ; `phraseHorsEspace(espace) -> string` ;
  `phraseDeRefus(message, code) -> string` ; `adresseApresBascule(valeur) -> string|null`.
- Produces (`js/nav-rules.js`) : `entreesNavigation(espace, { routeVisible, emargementActif, emargementDansLeCentre =
  false, reglagesEspace = false })` accepte `direction` et `siege` ; `barreTelephone` aussi.
- `affectations` : `[{ role, promo_id, lieu_id, lieu_nom }]` (Task 2).

- [ ] **Step 1 : tests `tests/espaces-rules.test.mjs`**
  - `espacesPermis` : formateur réel (`roles ['formateur']`) `["equipe"]` ; stagiaire `["stagiaire"]` ; direction seule
    (`roles ['direction']`, affectation direction) `["direction"]` ; direction et formateur `["direction", "equipe"]` ;
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
  - `centreAffiche` : lieu de la promo (`{ id: promo.lieu_id, nom: promo.lieu_nom }`) ; sans promo, premier lieu des
    affectations direction ; sinon `null`.
  - `routeDansLEspace` : chaque case du tableau de la section 1 (route permise ou hors espace) ; `phraseHorsEspace("direction")
    === "Cette page n'est pas dans l'espace Direction."`.
  - `phraseDeRefus` : `("equipe: Réservé à la direction du centre.", "42501") === "Réservé à la direction du centre."`,
    même chose pour `promo:`, `centre:`, `reseau:`, `invitation:`, `habillage:` ; `(_, "PGRST202")` et un message
    « Could not find the function » : « Cette action n'est pas encore disponible. » ; `("permission denied for …",
    "42501")` : « Tu n'as pas le droit de faire cela ici. » ; vide : « L'opération n'a pas abouti. ».
  - `adresseApresBascule("#/stagiaires/12/notes") === "#/stagiaires/12/notes"` ; `"javascript:…"`, `"#/inconnue"`, `null`
    donnent `null`.
- [ ] **Step 2 : tests `tests/nav-rules.test.mjs`** : entrées de la direction dans l'ordre de la section 1, Émargement
  seulement avec `emargementDansLeCentre`, Réglages du centre seulement avec `reglagesEspace` ; siège idem ; barre du
  téléphone (direction : `centre, promos, stagiaires, equipe` + reste dans `plus` ; siège : `reseau, themes, directions`) ;
  `entreeActive("reseau", entreesSiege) === "reseau"` ; espaces du lot 1 inchangés.
- [ ] **Step 3 : test `tests/espaces-sans-couleur.test.mjs`** : aucun `#[0-9a-f]{3,8}\b`, `rgb(`, `hsl(` dans les
  fichiers `js/espaces-rules.js`, `js/direction-rules.js`, `js/siege-rules.js`, `js/comptes-reseau.js`,
  `js/views/direction-*.js`, `js/views/siege-*.js`, `js/views/reglages-habillage.js` (fichiers absents ignorés).
- [ ] **Step 4 : les voir échouer**, puis écrire `js/espaces-rules.js` et les entrées de `js/nav-rules.js` (icônes
  `layers`, `briefcase`, `building`, `globe` ajoutées à `js/icons.js`, trait comme les autres, sans couleur).
- [ ] **Step 5 : `node --test "tests/*.test.mjs"`** : vert.
- [ ] **Step 6 : commit** « Lot 5 : règles des espaces direction et siège ».

### Task 2 : porte, espace courant et coquille

**Files :** Modify `js/auth-admin.js`, `js/db.js`, `js/main.js`, `js/nav-shell.js`, `js/menu-compte.js`,
`js/promo-pastille.js`, `css/navigation.css`, `_harness_supabase.js`.

**Interfaces :**
- Consumes : Task 1.
- Produces : `js/db.js` : `mesAffectations() -> Promise<Array<{ role, promo_id, lieu_id, lieu_nom }>>` (remplace
  `mesRolesAffectes`, que la porte du lot 4 lit) ; `ouvrirDansUnePromo(promoId, adresse) -> Promise<void>` (adresse
  mémorisée sous `ecsr_apres_bascule`, puis `choisirPromo` ; promo déjà affichée : simple changement d'adresse).
  `js/auth-admin.js` : `getEspace() -> string`, `espacesOuverts() -> string[]`, `setEspace(espace)`, `getAffectations()`,
  `getCentre() -> { id, nom }|null`, `isRedacteur() -> boolean` ; `isAdmin`, `isProf`, `isStagiaire`, `isEquipe` rendent
  les droits bridés par l'espace.

- [ ] **Step 1 : tests** (`tests/espaces-rules.test.mjs`) de `normaliserAffectations(lignes, lieux) -> [{ role,
  promo_id, lieu_id, lieu_nom }]` (ajoutée à `js/espaces-rules.js`) : nom du lieu joint ; lieu illisible ou absent :
  `lieu_nom` nul, ligne gardée ; lignes `null` ou vides : `[]` ; rôle inconnu : ligne écartée.
- [ ] **Step 2 : porte** (`initAuth`, `onAuthChange`) : sans promo, `porteSansPromo(await mesAffectations())` ; `siege` ou
  `direction` : entrée sans promo, sans bandeau « Promos non chargées », espace correspondant ; sinon le refus du lot 4
  (`messageSansPromo`, dont les phrases « arrive bientôt » du siège et de la direction disparaissent).
- [ ] **Step 3 : espace courant** : `espaceCourant()` de `js/main.js` lit `getEspace()` ; `renderTabs` monte la coquille de
  l'espace (D4 : direction et siège sans interrupteur) ; `navigate()` : `home` mène à l'accueil de l'espace,
  `routeDansLEspace` faux ramène à l'accueil avec `phraseHorsEspace`, route inconnue retombe sur l'accueil de l'espace (et
  non sur Mon suivi) en direction et en siège ; au démarrage, `adresseApresBascule(localStorage ecsr_apres_bascule)` passe
  avant `derniereRoute()`, puis la clé est effacée.
- [ ] **Step 4 : coquille et menu** : `barreLaterale(espace)` remplace les tests `espace === "equipe"` qui décident de la
  forme (les comptes « à traiter » restent au seul formateur) ; en-tête de contexte « Centre » + nom du lieu (choix du
  centre par la pastille quand le compte en dirige plusieurs) ou « Réseau » + nombre de centres ; menu du compte : section
  « Espace » (une ligne par espace permis, coche sur l'actuel) quand il y en a deux ou plus ; `setEspace` remonte la
  coquille et ouvre l'accueil du nouvel espace. Sous 700 px : barre du bas de la section 1, « Plus » avec le reste et
  l'Assistant.
- [ ] **Step 5 : banc** (`_harness_supabase.js`) : `affectations` et `lieux` lisibles pour `?compte=direction`
  (lieu 1, promos du lieu 1 seulement quand `?lieux=2`), `?compte=dirform` (direction du lieu 1 et formateur de la
  promo 1), `?compte=direction-vide` (lieu 3 sans promo), `?compte=siege` (aucune promo) ; vérifier à 1280 et 375 px,
  Chromium et WebKit : chaque compte arrive sur son accueil, barre et barre du bas nommées, menu « Espace » pour
  `dirform` seulement, aucune erreur en console. Captures dans le registre.
- [ ] **Step 6 : `node --test "tests/*.test.mjs"`** et `python outils/verifier_navigation.py` : 0 échec, parité
  « interrupteur éteint = main » intacte.
- [ ] **Step 7 : commit** « Lot 5 : porte, espace courant et barre de la direction et du siège ».

### Task 3 : « Voir en tant que » Direction et Siège

**Files :** Modify `js/auth-admin.js`, `js/views/config.js` (sélecteur du fondateur), `js/menu-compte.js`,
`js/promo-pastille.js`, `css/navigation.css`.

**Interfaces :** Consumes : `apercusPermis`, `setViewAs` (lot 4), Task 2. Produces : `promosVisiblesEnApercu({ promos,
promo, apercu }) -> promos[]` dans `js/espaces-rules.js` ; `setViewAs("direction")` et `setViewAs("siege")` changent
d'espace.

- [ ] **Step 1 : tests** de `promosVisiblesEnApercu` : en aperçu `direction`, seules les promos du centre de la promo
  affichée ; en aperçu `siege`, aucune ; sinon toutes.
- [ ] **Step 2 : brancher** : `setViewAs` choisit l'espace de l'aperçu et ouvre son accueil ; « Revenir fondateur » ramène
  l'espace formateur et la page d'accueil ; la pastille et toutes les listes de promos de la direction passent par
  `promosVisiblesEnApercu` ; le bandeau d'aperçu dit, en direction et en siège : « Aperçu : Direction du centre
  <nom>. Ce que tu modifies ici est vraiment enregistré. » (« Aperçu : Siège du réseau. » de même) ; sur téléphone, le
  sélecteur du fondateur garde ses cinq boutons à la ligne, 44 px.
- [ ] **Step 3 : banc** : fondateur, promo 1 puis promo 7 (`?demo=1`) : Direction (centre Nîmes, puis Démonstration :
  aucune promo d'un autre centre dans la pastille ni les pages), Siège (aucune pastille, aucune donnée de promo),
  Formateur, Stagiaire, retour ; à 1280 et 375 px, deux moteurs. Captures.
- [ ] **Step 4 : `node --test "tests/*.test.mjs"`**, `python outils/verifier_navigation.py` : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : le fondateur regarde l'espace de la direction et celui du siège ».

## Partie B : les chiffres et la base

### Task 4 : comptes additifs et fixture commune

**Files :** Create `js/comptes-reseau.js`, `tests/comptes-reseau.test.mjs`, `tests/fixtures/comptes-promo.json` ;
Modify `js/centre-stats.js` (ajouter `somme` au `detail` de `notes`), `tests/centre-stats.test.mjs`.

**Interfaces :** Produces : `CHAMPS_COMPTES = ["inscrits", "enFormation", "abandons", "absences", "prevus", "qcmBonnes",
"qcmQuestions", "examensPasses", "examensReussis", "notesN", "notesSomme", "notesSous10", "epcfAcquis",
"epcfRenseignes"]` ; `SEUIL_SECRET = 5` ; `comptesDepuisIndicateurs(ind) -> Comptes` ; `versComptes(ligneSql) -> Comptes &
{ lieuId, lieuNom, demonstration, promoId, promoNom, dateDebut, dateFin, masque }` ; `sommeComptes(liste) -> Comptes`
(les lignes `masque` n'apportent que leurs effectifs) ; `ratiosDeComptes(c) -> { abandon, absences, reussiteQcm,
examensQcm, notes, epcf }` (nombre ou `null`) ; `promosEnCours(promos, aujourdhui) -> promos[]` (début au plus tard
aujourd'hui, fin nulle ou à partir d'aujourd'hui) ; `regrouperParCentre(lignes, aujourdhui) -> [{ lieuId, lieuNom,
demonstration, promos, enCours: Comptes, masquees }]`.

La fixture : `{ "donnees": { stagiaires, passages, evaluations, tentatives, epcf }, "referentiel": { qcm, themes },
"attendu": { <CHAMPS_COMPTES> } }`, identifiants à partir de 990001, 7 stagiaires dont 1 abandon, chaque cas des
définitions de la section 2 présent au moins une fois (bonus et absence, passage d'un abandon ignoré, note sans barème,
examen au seuil d'un QCM à 12 et au seuil par défaut, deux évaluations EPCF du même jour d'id différents, une
auto-évaluation ignorée). Valeurs attendues calculées à la main dans le message du commit.

- [ ] **Step 1 : tests** : `comptesDepuisIndicateurs(indicateursPromo(fixture.donnees, fixture.referentiel, { aujourdhui:
  "2026-11-08" }))` égale `fixture.attendu` ; pour chaque ratio, `ratiosDeComptes(c)` égale la `valeur` de l'indicateur
  correspondant de `indicateursPromo` (`notes` à 1e-9 près) ; concaténer deux promos puis calculer donne les mêmes ratios
  que `sommeComptes` des deux (Review Focus 2) ; une ligne `masque` dans `sommeComptes` n'ajoute que ses effectifs ;
  `promosEnCours` (à venir, en cours, finie, sans fin) ; `regrouperParCentre` met un centre sans promo à zéro et le centre
  de démonstration à part.
- [ ] **Step 2 : les voir échouer**, écrire `js/comptes-reseau.js`, ajouter `somme` à `notes.detail`.
- [ ] **Step 3 : `node --test "tests/*.test.mjs"`** : vert.
- [ ] **Step 4 : commit** « Lot 5 : comptes additifs du centre et du réseau, fixture commune ».

### Task 5 : preuve et migration du siège (`comptes_reseau`, `creer_centre`)

**Files :** Create `tests/sql/espaces-preuve.sql`, `supabase/migrations/20261108_espaces_1_siege.sql` et `_retour.sql` ;
Modify `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs`.

**Interfaces :** Consumes : `tests/sql/roles-aides.sql` (`incarner`, `verifier`, verdict, lot 4), fixture (Task 4).
Produces : `node outils/assembler_repetition_roles.mjs espaces|espaces-contre-epreuve|espaces-en-ligne <sortie.sql>
[--compact]` (`espaces` : migrations du lot 5 injectées, contrôles, retours, empreinte avant et après ;
`espaces-contre-epreuve` : sans les migrations ; `espaces-en-ligne` : rien d'injecté) ; la fixture injectée par `--
@@INJECTER tests/fixtures/comptes-promo.json@@`.

Personnages créés dans le bloc : `siege` (affectation siège), `dir_n` (direction du lieu 1), `dir_m` (lieu 2),
`form_n` (formateur de la promo 1), `form_m` (formateur de la promo 2), `stag_n` (fiche de la promo 1), `sans_role`
(profil sans fiche ni affectation) ; le fondateur choisi par requête ; une promo fictive « fixture » (lieu 1, données de
la fixture, ids d'origine ; les lignes de référentiel qu'elle cite sont créées dans le bloc, ou empruntées à de vrais QCM
par requête si une contrainte l'impose, la fixture étant alors réécrite à l'injection) et une promo fictive « petite »
(lieu 1, 3 stagiaires actifs).

- [ ] **Step 1 : écrire les contrôles**, chacun nommé dans le verdict (échecs d'abord, R28 du lot 4) :
  - `comptes_reseau` : permis à `siege`, au fondateur, au fondateur en aperçu `siege` ; refusé (42501, aucune ligne) à
    `dir_n`, `form_n`, `stag_n`, `sans_role`, au fondateur en aperçu `direction` et `formateur` ; non exécutable par
    `anon` ;
  - forme : aucune colonne dont le nom contient `nom` hors `lieu_nom` et `promo_nom`, ni `email`, ni `stagiaire` ;
  - ligne « fixture » = `attendu` de la fixture, champ par champ (`notes_somme` à 1e-9 près) ;
  - ligne « petite » : `masque` vrai, effectifs justes, toutes les autres colonnes nulles ;
  - une ligne par promo existante, une ligne `promo_id` nul pour un centre sans promo ; `demonstration` vrai pour le
    lieu 4 seulement ;
  - `creer_centre` : `siege` et le fondateur créent (id rendu, ligne lue en propriétaire) ; `dir_n`, `form_n`,
    `stag_n` : refus 42501 ; nom vide, nom en double (casse différente) : refus avec la phrase ;
  - `lieux` : aucune écriture directe de `demonstration` par `siege` ni `dir_n` (0 ligne ou refus) ;
  - retour : après le retour, les trois empreintes (`tests/sql/roles-empreinte.sql`) égalent celles du début du bloc.
- [ ] **Step 2 : assembleur et son test** : chaque fichier injecté s'y trouve à l'octet près (md5), le mode
  `espaces-en-ligne` n'en contient aucun, la fixture est injectée telle quelle.
- [ ] **Step 3 : contre-épreuve sur une base locale jetable** (recette de la Task 2 du lot 4) : ROUGE sur les lignes
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
  `direction` sur la promo 1 : OK sur le lieu 1, refus sur le lieu 2 ; e-mail de `stag_n` : refus « compte stagiaire » ;
  nouvel e-mail : profil créé (`role 'prof'`, `is_admin` vrai, `invited_by_email` = appelant), `cree` vrai ; liste vide
  pour un compte absent : refus ; liste vide pour `form_m` : ses lignes du lieu 1 partent, celle du lieu 2 reste ; aucune
  ligne `direction` ni `siege` touchée dans tout le bloc (compte avant et après) ; `dir_n` se donne à lui-même la promo 1
  (cumul) : OK.
- [ ] **Step 2 : contre-épreuve locale** : ROUGE sur ces seules lignes.
- [ ] **Step 3 : migration et retour.**
- [ ] **Step 4 : répétition** (mode `espaces`, deux migrations) en local puis sur la vraie base : VERT n/0, rien de resté.
- [ ] **Step 5 : commit** « Lot 5, étape 2 : la direction règle les promos de ses formateurs (preuve verte en
  répétition) ».

## Partie C : l'espace de la direction

### Task 7 : Vue d'ensemble, Émargement, Notes et examens du centre

**Files :** Create `js/views/direction-centre.js` ; Modify `js/main.js` (routes `centre`, `emargement`, `notes` selon
l'espace), `js/views/centre.js` (exporter `carte`, `sectionComparaison`, `sectionASuivre`, `sectionThemes` pour les
réutiliser ; rien d'autre ne change), `js/db.js` (`lireEmargementPromo(promoId) -> { seances, lignes }` par l'en-tête de
lecture), `css/pages.css`, `_harness_supabase.js`.

**Interfaces :** Consumes : Tasks 1, 2, 4 ; `lireDonneesCentre`, `lireReferentielCentre`, `indicateursPromo`. Produces :
`renderVueCentre(container)`, `renderEmargementCentre(container)`, `renderNotesCentre(container)`.

- [ ] **Step 1 : tests purs** : `concatenerDonnees(listeDeDonnees) -> donnees` (`js/comptes-reseau.js`) ;
  `resumeEmargement({ seances, lignes }) -> { feuillesCloses, feuilleOuverte, derniere, absences, nonSignees }`
  (`js/emargement-rules.js` ; cas : aucune feuille, une ouverte, absences notées, lignes non signées d'une feuille
  close). L'entrée Émargement de la direction s'allume quand une promo du centre a l'émargement : `renderTabs` reçoit
  `emargementDansLeCentre` (réglage `emargement_actif` de chaque promo du centre, lu par l'en-tête de lecture).
- [ ] **Step 2 : Vue d'ensemble** (`#/centre` en direction) : surtitre « Centre de <lieu> », titre « Vue d'ensemble »,
  sous-titre « N promos en cours · édité le … » ; cartes de `indicateursPromo(concatenerDonnees(promos en cours))` avec
  leur méthode ; comparaison de toutes les promos du centre ; « À suivre de près » avec la promo de chaque personne, clic
  = `ouvrirDansUnePromo` vers sa fiche ; « Thèmes à retravailler ». Aucune promo : « Ce centre n'a pas encore de promo »
  et un bouton « Créer une promo » (vers `#/promos`). Échec de lecture : phrase et « Réessayer ».
- [ ] **Step 3 : Émargement** (`#/emargement` en direction) : une ligne par promo du centre (liste sur téléphone) :
  activé ou non, `resumeEmargement`, bouton « Voir les feuilles » (`ouvrirDansUnePromo(id, "#/emargement")`) ; sous le
  résumé, la page Émargement existante de la promo affichée, sans geste d'ouverture ni de clôture.
- [ ] **Step 4 : Notes et examens** (`#/notes` en direction) : par promo, moyenne des notes, critères EPCF acquis, examens
  QCM réussis (de `indicateursPromo`), bouton « Voir la matrice » ; dessous, `renderNotes(container, { imbrique: true })`
  de la promo affichée, en lecture (droits bridés, Task 2).
- [ ] **Step 5 : banc** (`?compte=direction&centre=1&demo=1`) : les trois pages à 1280, 900 et 375 px, deux moteurs ;
  « Voir les feuilles » d'une autre promo revient sur `#/emargement` après rechargement ; aucun bouton d'écriture de
  formateur. Captures.
- [ ] **Step 6 : `node --test "tests/*.test.mjs"`**, vérification de navigation : 0 échec.
- [ ] **Step 7 : commit** « Lot 5 : vue d'ensemble, émargement et notes du centre pour la direction ».

### Task 8 : Promos

**Files :** Create `js/views/direction-promos.js` ; Modify `js/db.js` (`creerPromo({ lieuId, nom, debut, fin }) ->
Promise<number>`, `modifierDatesPromo({ promoId, debut, fin })`, `renommerPromo({ promoId, nom })` qui relit la ligne et
lève « Ce changement n'a pas été accepté. » si rien n'a changé), `js/main.js` (route `promos`), `_harness_supabase.js`.

- [ ] **Step 1 : tests purs** (`js/direction-rules.js`) : `validerPromo({ nom, debut, fin }) -> string|null` (nom requis, début requis, fin pas avant
  le début : mêmes phrases que la base) et `etatPromo(promo, aujourdhui) -> "à venir"|"en cours"|"terminée"`.
- [ ] **Step 2 : page** : carte par promo (nom, dates, état, effectif, formateurs, part de la formation écoulée) ; gestes
  « Modifier » (nom, dates) et « Modules » ; pour la promo affichée, « Modules » déplie `renderModulesSection()` ; pour une
  autre, `ouvrirDansUnePromo(id, "#/promos")`. « Créer une promo » : fenêtre nom, début, fin (facultative), centre (choix
  si la direction en a plusieurs) ; après création, `chargerMesPromos` ; première promo du centre : elle devient la
  promo affichée. Refus : `phraseDeRefus` dans la fenêtre, saisie gardée.
- [ ] **Step 3 : banc** : création réussie, création refusée (fin avant début), modification, modules d'une autre promo
  (bascule) ; `?compte=direction-vide` : création de la première promo puis arrivée dans le centre. Deux largeurs, deux
  moteurs.
- [ ] **Step 4 : tests et vérification** : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : la direction crée ses promos et règle leurs dates et modules ».

### Task 9 : Stagiaires du centre

**Files :** Create `js/views/direction-stagiaires.js` ; Modify `js/main.js` (route `stagiaires` selon l'espace et la
présence d'une fiche), `_harness_supabase.js`.

- [ ] **Step 1 : tests purs** (`js/direction-rules.js`) : `ouTrouverFiche(id, listesParPromo) -> { promoId }|null` ;
  `listeDuCentre(listesParPromo, filtre) -> groupes` (en formation d'abord, abandons repliés, tri par nom comme la page
  actuelle).
- [ ] **Step 2 : page** : stagiaires du centre groupés par promo (lecture par l'en-tête de lecture), recherche par nom,
  filtre de promo ; un nom ouvre sa fiche (promo affichée : `#/stagiaires/<id>` ; autre : `ouvrirDansUnePromo`) ;
  chaque groupe porte « Ajouter un stagiaire », qui ouvre la fenêtre d'ajout existante de `js/views/stagiaires.js`
  (exportée pour l'occasion) pour la promo affichée et bascule d'abord pour une autre ; l'invitation reste dans la fiche
  (droits `isEquipe`). Les élèves bénévoles n'y sont pas (D12). Adresse `#/stagiaires/<id>` d'une fiche hors du centre :
  « Cette fiche n'est pas dans ton centre. », retour à la liste.
- [ ] **Step 3 : banc** : fiche d'une autre promo par bascule ; `?lieux=2` : adresse d'une fiche de Montpellier tapée par
  la direction de Nîmes : phrase, aucun nom de Montpellier dans la page (Review Focus 1). Deux largeurs, deux moteurs.
- [ ] **Step 4 : tests et vérification** : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : la direction voit tous les stagiaires de son centre ».

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
`versComptes`), `js/main.js` (route `reseau`), `js/centre-csv.js` (`tableauReseauCsv(groupes) -> string`),
`tests/centre-csv.test.mjs`, `_harness_supabase.js` (faux `comptes_reseau` tiré de la fixture et des promos du banc,
dont une petite).

- [ ] **Step 1 : tests** : `tableauReseauCsv` (en-têtes, centre masqué « moins de 5 stagiaires », démonstration à part,
  séparateur et nombres comme `matriceNotesCsv`).
- [ ] **Step 2 : Vue d'ensemble** (`#/reseau`) : surtitre « Réseau · N centres », titre « Vue d'ensemble », sous-titre
  « Chiffres agrégés par centre, sans données nominatives » ; cartes du réseau (stagiaires en formation, taux d'abandon,
  absences aux passages prévus, réussite aux QCM, moyenne des notes, critères EPCF acquis) avec la méthode de chaque
  chiffre et la mention « promos en cours, hors promos de moins de 5 stagiaires » ; tableau par centre (liste sur
  téléphone), chaque ligne ouvre la fiche ; « Centre de démonstration (données fictives, hors totaux) » à part ;
  « Exporter le tableau (CSV) » sur ordinateur ; « Ajouter un centre » (Task 12). Échec : phrase et « Réessayer ».
- [ ] **Step 3 : fiche** (`#/reseau/<id>`) : retour « Vue d'ensemble », cartes du centre, liste de ses promos (nom,
  dates, état, effectif, chiffres ou « moins de 5 stagiaires : chiffres non affichés »), lecture seule ; identifiant
  inconnu : « Ce centre n'existe pas. » et retour.
- [ ] **Step 4 : banc** (`?compte=siege`, puis fondateur en aperçu siège) : aucun nom de stagiaire du banc dans le DOM
  (recherche des noms des fixtures), petite promo masquée, CSV téléchargé. Deux largeurs, deux moteurs.
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
`js/nav-rules.js` (`reglagesEspace` vrai), `js/espaces-rules.js` (`defautsHabillage`).

**Interfaces :** Consumes (lot 3, partage convenu le 08/11 avec la conversation du plan du lot 3, note
`lot3-habillage-levier.md` du dossier partagé) : `habillageAuDemarrage({ email, compte, centre, reseau, libre })`
(`js/habillage.js`, appelée au début de `bootApp`), qui s'appuie sur `habillageRetenu({ appareil, compte, email, centre =
null, reseau = null, libre = true }) -> { nom, aEnvoyer, source }` (`js/habillage-regles.js` ; `libre` faux et centre
valide : le centre l'emporte) ; `blocHabillage()` (`js/habillage-choix.js`, les deux pastilles) ; valeurs `"ecsr"`,
`"ecf"` ou `null`. Le lot 3 ne lit rien du centre ni du réseau : c'est ce lot. Produces : `habillage_par_defaut()
returns table(centre text, libre boolean, reseau text)` (centre de la promo affichée, ou premier lieu des affectations ;
lisible de tout compte connecté) ; `defautsHabillage(ligne) -> { centre, reseau, libre }` (valeur hors `ecsr`, `ecf`
ramenée à `null`, `libre` vrai par défaut) ; refus `habillage: …`.

- [ ] **Step 1 : preuve** : `regler_habillage_centre` par `dir_n` sur le lieu 1 (OK), sur le lieu 2 (42501), par
  `form_n`, `siege` (42501) ; valeur hors `ecsr`, `ecf`, nul : refus ; `regler_habillage_reseau` par `siege` et le
  fondateur (OK), par `dir_n` (42501) ; `habillage_par_defaut` lu par `stag_n` : valeurs du lieu 1 et du réseau ;
  contre-épreuve locale ROUGE sur ces lignes, migration, répétition VERTE en local puis en production, rien de resté.
- [ ] **Step 2 : tests purs** : `defautsHabillage` (ligne nulle, valeurs inconnues, `libre` absent) ; l'ordre de
  résolution lui-même est testé par le lot 3, pas ici.
- [ ] **Step 3 : pages** : Réglages du centre (« Habillage par défaut du centre » par `blocHabillage()`, « Laisser chacun
  choisir le sien ») ; Réglages du réseau (habillage par défaut du réseau, même bloc) ; au démarrage, une fois la porte
  passée, l'app lit `habillage_par_defaut()` et appelle `habillageAuDemarrage` avec `defautsHabillage(ligne)` (échec de
  lecture : défauts nuls, sans message ; le choix de l'appareil reste appliqué entre-temps, sans éclair).
- [ ] **Step 4 : banc et vérification**, deux largeurs, deux moteurs : 0 échec.
- [ ] **Step 5 : commit** « Lot 5 : habillage par défaut du centre et du réseau ».

## Partie F : preuve, mise en ligne

### Task 15 : assistant et Nouveautés

**Files :** Modify `supabase/functions/chatbot/aide.mjs` (`AIDE_APP_V2` : barre de la direction et barre du siège, gestes
de chaque page, section ANCIENS NOMS inchangée), `tests/chatbot-aide.test.mjs` (comparaison aux entrées de la direction
et du siège), `js/nouveautes.js` (audiences `direction` et `siege` : montrées à qui a cet espace, ou au fondateur en
aperçu de cet espace), `tests/nouveautes.test.mjs`, `js/nouveautes-data.js`.

- [ ] **Step 1 : tests** : le guide nomme chaque entrée des deux barres ; une Nouveauté `pour: "direction"` n'apparaît ni
  au formateur ni au stagiaire.
- [ ] **Step 2 : guide et Nouveautés** (date posée à la fusion) : pour la direction, « Ton espace de direction » (vue
  d'ensemble du centre, promos, stagiaires, émargement, notes, équipe ; un geste par page, dans les mots de l'écran) ;
  pour le siège, « L'espace du siège » (chiffres du réseau sans aucun nom, centres et directions, contenus communs) ;
  pour les formateurs qui dirigent aussi : « Espace » dans le menu du compte.
- [ ] **Step 3 : `node --test "tests/*.test.mjs"`** : vert.
- [ ] **Step 4 : commit** « Lot 5 : l'assistant connaît les espaces direction et siège ; Nouveautés ».

### Task 16 : parcours rôle par rôle et recoupement des chiffres

**Files :** parcours dans le robot du filet qualité (`docs/qualite/`, format de son mode d'emploi) ; à défaut, scénarios
`--roles direction,siege,dirform,sansrole` de `outils/verifier_navigation.py` ; Create `outils/recouper_comptes.mjs`.

Chaque parcours se joue à 1280 et 375 px (plus 900 px pour P1 et P4), dans Chromium et WebKit, au banc ; à chaque vue :
titre de page présent, aucune erreur en console, aucun défilement de côté, cibles de 44 px sur téléphone, une seule
entrée allumée, Échap ferme les fenêtres.

| N° | Qui (banc) | Parcours | Attendu |
|---|---|---|---|
| P1 | direction (`?compte=direction&centre=1&demo=1`) | chaque entrée de la barre puis de « Plus » ; créer une promo ; fiche d'une autre promo ; « Voir les feuilles » ; inviter un formateur | chaque geste aboutit ou dit pourquoi ; retour sur la page visée après chaque bascule |
| P2 | direction sans promo (`direction-vide`) | arrivée, créer la première promo | accueil « pas encore de promo » puis centre avec sa promo |
| P3 | direction et formateur (`dirform`) | menu, Espace : Formateur puis Direction ; rechargement | barre qui change, choix gardé |
| P4 | siège (`?compte=siege`) | Vue d'ensemble, fiche d'un centre, CSV, Directions (inviter, retirer), Ajouter un centre, Cours et QCM | aucun nom de stagiaire du banc dans le DOM ; petite promo masquée |
| P5 | fondateur | Voir en tant que : Direction, Siège, Formateur, Stagiaire, Revenir, sur promo 1 et promo 7 | espace et bandeau justes ; aucune promo d'un autre centre en aperçu direction |
| P6 | formateur (`?role=prof`) | adresses `#/promos`, `#/equipe`, `#/reseau`, `#/directions` | accueil de son espace et phrase « Cette page n'est pas dans l'espace Formateur. » ; pas de section Espace |
| P7 | stagiaire | mêmes adresses | idem, espace Stagiaire |
| P8 | sans rôle (`sansrole`) | connexion | refus de la porte avec la phrase du lot 4 |
| P9 | direction de Nîmes (`?lieux=2`) | adresse d'une fiche de Montpellier | « Cette fiche n'est pas dans ton centre. », aucun nom de Montpellier |
| P10 | direction et siège, base en panne (leviers de panne du banc sur `comptes_reseau`, `regler_affectations_formateur`, `creer_promo`) | gestes de P1 et P4 | une phrase et « Réessayer » ou la saisie gardée, jamais rien |

- [ ] **Step 1 : déclarer les parcours** et les jouer : 0 échec ; passe « interrupteur éteint = main » intacte.
- [ ] **Step 2 : outil de recoupement** (`node outils/recouper_comptes.mjs <brut.json> <comptes.json>`, test
  `tests/recouper-comptes.test.mjs`) : il compare `comptesDepuisIndicateurs(indicateursPromo(brut))` de chaque promo à
  la ligne de `comptes_reseau()` de même `promo_id` (notes à 1e-9), écrit « identiques » ou chaque écart, et sort en
  code 1 au moindre écart ; testé sur la fixture (brut = `donnees`, comptes = `attendu` en colonnes de la base) et sur
  une copie sabotée. Joué sur les vraies promos à la Task 17.
- [ ] **Step 3 : registre** : verdicts, nombre de vues, captures (sans aucun nom ni e-mail).
- [ ] **Step 4 : commit** « Lot 5 : parcours rôle par rôle et outil de recoupement des chiffres ».

### Task 17 : relecture finale, application, fusion

- [ ] **Step 1 :** relire `supabase/migrations/` et `js/` de `main` (ce qui est arrivé depuis le début du lot) ; rejouer la
  répétition `espaces` et la preuve du lot 4 en mode `en-ligne` (aucune règle ne change : VERT).
- [ ] **Step 2 :** relecture de toute la branche par le modèle le plus capable (base, app, preuve, plan, Review Focus),
  corrections, rejeu des tests, des parcours et de la répétition.
- [ ] **Step 3 :** compte rendu à Timy (bilan, tableau d'état, schéma, étapes suivantes) ; attendre son accord pour :
  appliquer les migrations, redéployer la fonction `chatbot`, fusionner et pousser.
- [ ] **Step 4 (après accord) :** appliquer les migrations 1, 2 (et 3) une à une ; preuve en mode `espaces-en-ligne` :
  VERT ; recoupement : extraire en lecture seule, en fondateur, les données brutes des promos 1, 2 et 7 (colonnes de
  `lireDonneesCentre` sans `prenom` ni `nom`) et `comptes_reseau()`, dans le scratchpad, jamais dans le dépôt ;
  `outils/recouper_comptes.mjs` : « identiques » ; fichiers effacés ; redéployer `chatbot` ; fusion dans `main`
  (`merge --no-ff --no-commit` puis `commit -F`, le crochet pose le jeton), tests et vérification sur `main`, poussée ;
  ordre : base, fonction, app.
- [ ] **Step 5 : clôture** : banc enrichi recopié dans `TP_ECSR_App` après `diff` ; branche (locale et distante),
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
- Détail par promo d'une petite promo au siège : jamais (secret statistique).
