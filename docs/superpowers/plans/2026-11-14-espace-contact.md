# Espace contact et demandes (plan de mise en œuvre)

> **Pour les agents :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`).

**But :** un annuaire du centre (fiches de l'équipe avec ou sans compte), des demandes avec un sujet, un type et un état,
qui partent au bon destinataire et préviennent par e-mail, et l'absence annoncée qui s'inscrit d'elle-même au planning et
à l'émargement ; actif pour toutes les promos dès la mise en ligne.

**Architecture :** la base décide de tout (fonctions `security definer`, tables nouvelles sans aucun droit direct) :
routage, envois annexes, états, lectures, liens signés. Chaque événement écrit, dans la même transaction, ses lignes
d'envoi ; une fonction serveur Supabase (`contact-envois`, Deno, service role) les traite et appelle Resend. L'app est un
client : règles pures testées sous node (`js/contact-*.js`), écrans, et une page statique (`demande.html`) pour les liens
des e-mails. Trois parties, chacune finit par un état testable sur la base locale et au banc ; une seule mise en ligne.

**Technique :** JavaScript en modules sans build, `node` (tests `tests/*.test.mjs`), PostgreSQL 17 (Supabase), règles
RLS, fonctions `security definer` (`search_path` public puis pg_temp), fonction serveur Deno avec dépendances injectées,
base locale jetable (`outils/base_locale/`, port 55460), assembleur de preuves `outils/assembler_repetition_roles.mjs`,
banc (`_harness_supabase.js`, hors git), robot des parcours (`outils/robot_parcours.py`).

**Spec :** `docs/superpowers/specs/2026-11-09-espace-contact-design.md` (validée par Timy le 09/11), corrigée par la
décision de Timy du 14/11 : **aucun interrupteur**, l'espace contact est actif pour toutes les promos dès sa mise en
ligne. Plan sœur (vocabulaire des gestes) : `docs/superpowers/plans/2026-11-11-titres-droits.md`.

## 0. Ce que la spec suppose, relu sur la branche (283ca245, 14/11)

| Supposition | État réel | Conséquence |
|---|---|---|
| § 2 : `contacts` sans centre, écrite par toute l'équipe | faux depuis le 11/11 : `lieu_id` + règle restrictive `contacts_meme_centre` (`20261113_contacts_centre`), écriture par le geste `fiches_internes.ecrire` (`contacts_ecriture`, titres 3) ; lecture `contacts_select_authenticated` ouverte à tout compte du centre | on étend la table (C3) ; la lecture directe se réserve à ceux qui écrivent, tout le monde lit par fonction |
| « Un numéro modifié dans les deux centres » | cause : `20261113_contacts_centre_2_montpellier` a **copié** les lignes de Nîmes au lieu 2 (même secrétariat) ; deux lignes indépendantes, un numéro se corrige deux fois | une fiche sans compte a un centre d'attache et peut être **partagée** avec d'autres centres (`lieux_partages`) ; la migration 1 fusionne les copies restées identiques (choix C-1, C-2) |
| § 2 et C3 : « un stagiaire lit l'e-mail des autres stagiaires dans `user_profiles` » | **déjà fermé** le 10/11 (`20261110_profils_email_stagiaires`, preuve `profils-email-preuve.sql` VERTE 32/0 en production) : la clause des stagiaires de la promo exige `stagiaires.lire` (titres 3) | ce qui reste ouvert, c'est la clause « personnel » : tout compte qui a une promo (stagiaires compris) lit **tous les profils du personnel du réseau, adresse comprise** (`promo_par_defaut() is not null`, reste du lot 4 noté dans la roadmap). La migration 1 la ferme aux comptes sans affectation ; la preuve des profils doit rester VERTE |
| Usages applicatifs de ces lectures | relevé : `listUserProfiles` (`js/views/config.js`, `js/views/stagiaires-gestion.js` : équipe seulement), `nomsFormateursParEmail` (direction), `getMyProfile` (son profil), repli mort de `listFichesNotesMasquees` ; aucun écran stagiaire ne lit un profil du personnel ; les fonctions serveur `chatbot` et `qcm-ia` ne lisent pas `user_profiles` | fermeture sans changement d'app |
| `stagiaires_prive` convient-elle au téléphone et au financement ? | oui : lecture `stagiaires_prive_lecture` = sa fiche ou `geste_promo(promo_courante(), 'stagiaires.lire')`, aucune écriture directe (fonction), ligne supprimée par l'étape 1 de la conservation (`_effacer_etape1`) | colonnes ajoutées ; écriture par une fonction nouvelle ; « suivent son compte » sans rien ajouter à la conservation |
| Délégué « visible des stagiaires de la promo » | une colonne privée ne convient pas | colonne `stagiaires.delegue`, écrite par `stagiaires_modification` (`stagiaires.gerer`), lue par `stagiaires_select_all` |
| Interrupteur `contact_actif` (C7) | **supprimé par Timy le 14/11** | aucune clé, aucune règle restrictive ; la base n'a pas d'état « éteint » ; voir « Ce que la décision du 14/11 change » |
| « La direction lit toutes les demandes » = titre fixe Direction de centre | `direction_fixe(l)` existe (titres 2) mais rend vrai au **fondateur** et en **aperçu** direction | aide interne `_contact_direction_reelle(l)` : une affectation `direction` réelle de titre fixe sur l, hors aperçu (§ 7.4 : ni le fondateur ni le siège) |
| Gestes à réutiliser | `geste_promo` (`fiches_internes.ecrire`, `stagiaires.lire`, `stagiaires.gerer`, `planning.lire`, `planning.modifier`), `geste_centre` (`reglages.modifier`), `formateur_fixe`, `membre_stagiaire`, `my_stagiaire_id`, `lieu_de_promo`, `lieu_courant` ; `personnes_et_titres` et `mes_titres` (titres 6) exigent `equipe.lire` ou rendent les titres de l'appelant | **aucun geste nouveau** ; l'annuaire joint lui-même `affectations` et `titres` pour le libellé du titre (un stagiaire n'a pas `equipe.lire`) |
| Pré-marquage à l'émargement | `emargement_ouvrir` et `emargement_clore` ont été réécrites par titres 2 et par la conservation (Q5) ; `emargement_rouvrir` ne retire que `planning` et `non_signe` | pas de réécriture de ces fonctions : des **déclencheurs** posent l'origine `annoncee` ; la contrainte de `absence_origine` s'élargit |
| Base locale : `rejouer_suite.sh --titres 5,6` | sait jouer 5 et 6 (motif `20261112_titres_<n>_*`) ; **ne joue pas** `20261114_autonomie_1_traces` (en production) ni `_2_version` | tâche 1 d'outillage |
| Page des liens « statique » | `scripts/cache-bust.js` ne tamponne que `index.html` et `js/` | la tâche 11 l'étend à `demande.html` |

## Ce que la décision du 14/11 change (points de la spec qui reposaient sur l'interrupteur)

| Endroit de la spec | Ce qu'il disait | Ce que fait le plan |
|---|---|---|
| § 14 « Mise en service par promo » | module de la promo, éteint par défaut, démo d'abord | supprimé : tout part à la fusion ; aucune clé `contact_actif` |
| § 16, point 17 | demandes et absences = module de la promo | sans objet |
| § 14 « Module éteint : Prévenir, Écrire, Messages n'apparaissent pas » | | les trois apparaissent toujours ; la base ne refuse une demande que pour ses vraies raisons (droit, garde-fou, aucun destinataire) |
| § 15 « Un vrai e-mail reçu et ses liens inspectés avant la mise en ligne » | sur la promo de démonstration allumée | recette sur des **adresses de test, avant la fusion** (dossier pour la coordination, étape 4) : la fusion envoie aussitôt de vrais e-mails à de vraies personnes |
| § 6.1 « Tant que rien n'est réglé » | cas de départ d'une promo allumée à la main | c'est le réglage **en vigueur à Nîmes et Montpellier dès la fusion** : les formateurs de la promo reçoivent tout ; prouvé par le test de parité et la preuve SQL (tâche 8), dit par l'écran des règles (tâche 12) |
| § 12 et § 14 (conditions, « À faire par Timy ») | publication avant d'allumer une vraie promo | la nouvelle version des conditions doit être publiée **au plus tard à la fusion** (dossier, étape 1) ; « Qui reçoit quoi » de Nîmes se règle avant ou s'en remet au défaut sûr |
| § 9 « Volume et coût » | une promo de démonstration d'abord | Nîmes et Montpellier ensemble dès le premier jour : 100 e-mails par jour (offre gratuite) peuvent ne pas suffire un jour chargé ; le dépassement se voit (« e-mail non parti ») ; à trancher par Timy (question Q7) |
| Nouveautés (brief initial : pas d'entrée tant qu'aucune vraie promo n'est allumée) | | entrées à la mise en ligne pour l'annuaire **et** pour les demandes et absences (tâches 7 et 17) |
| `20261115_contact_demo.sql` | allumer la promo 7 et poser ses fiches | ne pose que les **fiches fictives** du centre de démonstration (adresses `demo.test`, jamais envoyées : C5) |

## Choix de Claude (au-delà du brief, à relire par Timy)

| # | Choix | Ce qu'il coûte s'il est faux |
|---|---|---|
| C-1 | **Une fiche par personne**, pas une par centre : une fiche avec compte s'affiche dans chaque centre où la personne a une affectation ; une fiche sans compte a un centre d'attache (`lieu_id`) et des centres de partage (`lieux_partages`) ; congé, relais, téléphone, « pour quoi », « quand » et ordre sont ceux de la personne, partout | un centre ne peut pas dire « pour quoi me joindre » autrement qu'un autre ; il faudrait une table d'affichage par centre (une tâche, une migration) |
| C-2 | La migration 1 **fusionne** chaque fiche copiée restée identique (prénom, rôle, téléphone, e-mail, note, catégorie, ordre) dans la plus ancienne, qui gagne le centre de la copie dans `lieux_partages` ; une copie qui a divergé reste à part (un avis de la migration en donne le nombre, sans nom) | si Timy voulait deux fiches distinctes, le retour les sépare de nouveau |
| C-3 | Une fiche avec compte a `lieu_id` **nul** : la règle restrictive existante la cache à toute lecture et écriture directes ; elle ne se lit que par les fonctions | aucun écran ne peut la lister par une requête simple ; tout passe par `annuaire_centre()` |
| C-4 | Le premier enregistrement de « Ma fiche de contact » **vaut vérification** ; l'e-mail professionnel n'est écrit en base qu'à ce moment (proposé à partir de celui du compte) : avant, il n'y a rien à masquer | une personne qui enregistre sans relire expose l'adresse proposée (le champ est pré-rempli mais visible et modifiable) |
| C-5 | La fiche d'office naît avec la première affectation (déclencheur) et **disparaît avec la dernière** | les demandes gardent le nom de la personne (copie au moment de l'envoi) ; rien d'autre ne se perd |
| C-6 | Nom affiché : la ligne `profs` rattachée si elle existe, sinon prénom et nom de la fiche, sinon le titre seul | un formateur dont le nom de planning est un surnom l'affiche aussi dans l'annuaire |
| C-7 | Le **routage vit dans la base** (une seule source, `_contact_destinataires`) ; `js/contact-rules.js` en porte le miroir pur, servi par l'aperçu de « Qui reçoit quoi », et une table de cas commune (`tests/fixtures/contact-routage.json`) est jouée par le test node **et** par la preuve SQL (parité) | un écart de parité fait rougir les deux, jamais l'un sans l'autre ; coût : deux implémentations à tenir |
| C-8 | Chaîne de repli du routage, pour qu'aucune demande ne se perde : règle (type, financement), règle (type), personne par défaut, formateurs (titre fixe) de la promo, direction réelle du centre ; personne : refus clair et rien n'est créé | une demande peut arriver à la direction si une promo n'a aucun formateur |
| C-9 | Tables nouvelles : RLS active, **aucune règle, aucun droit** pour anon et authenticated ; lectures et écritures par fonctions seulement (comme `titres`) | aucune lecture « au fil de l'eau » par l'API ; chaque écran a sa fonction |
| C-10 | Sans pg_cron ni pg_net : l'app déclenche le traitement des envois après chaque événement, à l'ouverture de Messages, et par « Relancer l'envoi » ; un envoi resté « en cours » plus de 10 minutes est repris comme un échec | un e-mail peut attendre la prochaine action de quelqu'un ; la question Q-C1 propose un balayage planifié |
| C-11 | Un jeton par envoi et par action, créé par la fonction au moment d'envoyer (seul le haché `sha256` est en base), porté dans le **fragment** de l'adresse (`demande.html#j=...`) pour ne jamais partir dans un en-tête Referer ni un journal de serveur | un e-mail perdu puis retrouvé reste actionnable 14 jours (choix de la spec) |
| C-12 | Les e-mails envoyés à un **stagiaire** n'ont aucun bouton d'action, seulement « Ouvrir dans l'app » | aucun |
| C-13 | Démarrage d'une demi-journée (annulation, « commencée ») : `planning_half_meta.start_time` du jour, sinon 09:00 et 13:30 (`DEFAULT_HALF_META`, `js/journee-rules.js`) ; « de telle heure » : l'heure de début saisie | une promo aux horaires inhabituels non saisis au planning annule jusqu'à 09:00 |
| C-14 | La ligne « Contacts » du menu du compte est donnée au stagiaire, à l'équipe et à la direction ; pas au siège | la direction gagne une ligne dans son menu |
| C-15 | « Non lue » = activité depuis la dernière ouverture : une nouvelle réponse d'un autre remet la demande « non lue » pour chaque destinataire | le compteur bouge plus souvent qu'à la seule création |
| C-16 | Fiches sans compte : supprimées à la main au départ de la personne (aucune minuterie de 12 mois) ; les demandes gardent le nom copié | le texte des conditions le dit ainsi (tâche 18) |
| C-17 | Demandes entre membres de l'équipe : purgées **à l'écriture** 12 mois après le dernier échange ; envois et jetons : à l'écriture, 3 mois après ; aucune tâche planifiée (modèle du journal des droits, T7) | une base sans aucune écriture garde ses vieilles lignes jusqu'à la suivante |
| C-18 | « Envoyer mon justificatif » sans adresse affichable (fiche non vérifiée) : le bouton cède la place à « Remets ton justificatif au centre » | un geste de moins pour le stagiaire dans ce cas |
| C-19 | Préfixe des refus : `contact:` ; ajouté à `PREFIXES_DE_REFUS` (`js/espaces-rules.js`) | aucun |
| C-20 | Une seule fusion pour les trois parties (rien ne s'éteint) ; les parties sont des états testables, pas des mises en ligne | la partie A ne peut pas partir seule sans que B et C la suivent dans le même dossier |

## Global Constraints

- Aucun tiret cadratin (U+2014) nulle part (SQL, JS, Python, Markdown, commits) ; contrôle : `python -c "import sys;[sys.exit(f) for f in sys.argv[1:] if chr(0x2014) in open(f,encoding='utf-8').read()]" <fichiers>`.
- Écritures : seulement dans le worktree `C:/Users/watch/Dev/ecsr-promo-contact` (branche `espace-contact`). Jamais
  `C:/Users/watch/Dev/ECSR/TP_ECSR_App`, jamais `outils/psql_prod.sh`, jamais l'outil MCP Supabase, aucun navigateur
  hors du robot.
- Base locale : port **55460**, `bash outils/base_locale/reconstruire.sh --port 55460` puis
  `bash outils/base_locale/rejouer_suite.sh --port 55460 --titres 1,2,3,5,6 --autonomie` (état de la production).
  `PGCLIENTENCODING=UTF8` pour tout `psql`. Fichiers SQL en LF.
- Migrations `supabase/migrations/20261115_contact_1_annuaire.sql`, `_2_demandes.sql`, `_3_absences.sql`,
  `20261115_contact_demo.sql`, chacune avec son `_retour.sql`, `set local lock_timeout = '3s'` en tête, une garde
  d'entrée (`do $garde$`) qui arrête sans rien changer, et une garde d'ordre dans chaque retour (retour 1 refusé si la 2
  est là, etc.). Une règle existante se réécrit par `alter policy` (texte en vigueur relu dans le fichier qui l'a posée,
  garde : présent exactement une fois), jamais `drop` + `create`.
- Fonctions nouvelles : `security definer`, `search_path` public puis pg_temp, adresse du jeton en minuscules
  (`lower(auth.jwt() ->> 'email')`), `revoke all ... from public, anon, service_role`, `grant execute ... to
  authenticated` ; aides internes `_contact_*` : aucun droit ; fonctions de la fonction serveur `_contact_srv_*` :
  `service_role` seul.
- Refus : état `42501` (droit) ou `P0001` (règle), phrase `contact: <phrase>` que l'app affiche telle quelle. Équipe
  vouvoyée, stagiaires tutoyés (`selonPublic`). « Formateur », jamais « prof ».
- Preuves : `tests/sql/contact-annuaire-preuve.sql`, `contact-demandes-preuve.sql`, `contact-absences-preuve.sql`, aides
  `tests/sql/contact-aides.sql` (inclut `roles-aides.sql` et `titres-aides.sql`) ; bloc `do` qui finit TOUJOURS par une
  levée `VERT n/0` ou `ROUGE ok/ko : ...` ; personnages fictifs `@exemple.invalid` (ceux de `pg_temp.poser_perso()`), comptes
  réels lus en nombre seulement. Chaque migration a sa contre-épreuve ROUGE et son mode « en ligne ».
- Aucun nom, numéro ni adresse réels dans le dépôt (public) : les prénoms du secrétariat de Nîmes restent en base.
- Écrans : téléphone d'abord, cibles de 44 px, aucun défilement horizontal à 375 px, contraste AA, police Outfit,
  couleurs par jetons de l'habillage, **jamais `color-mix`** dans les styles de l'habillage ECF (`css/habillage-ecf.css`
  et tout sélecteur `[data-habillage="ecf"]`) ; jamais `confirm()`, `alert()` ni `prompt()` : `js/confirmer.js`
  (`confirmer`, `demander`).
- Ne pas toucher `js/legal-data.js` ni `VERSION_CONDITIONS` (textes : tâche 18).
- Vérifications : `for f in tests/*.test.mjs; do node "$f"; done` ; `python outils/robot_parcours.py --habillages ecsr,ecf`
  (un seul robot à la fois sur la machine) ; `python outils/verifier_navigation.py` ; preuves sur la base locale.
- Banc : ajouts dans `_harness_supabase.js` et `_harness_build.mjs` (hors git) **dans des blocs marqués
  `// === Espace contact ===` ... `// === fin espace contact ===`**, à reporter dans la copie de `TP_ECSR_App` à la fusion.
- E-mails : expéditeur `Promo ECSR <no-reply@timy-studio.fr>` ; secret `RESEND_API_KEY` (posé par Timy, jamais écrit dans
  un fichier ni affiché) ; ni motif ni texte libre dans un e-mail ; aucun envoi vers `.test`, `.invalid`, `.example`,
  `example.com`, `example.org`, `example.net`, `localhost` (envoi « ignoré »).

## Review Focus

1. **Le stagiaire sans financement, dans un centre où rien n'est réglé** (Nîmes le jour de la fusion) : l'absence va aux
   formateurs de la promo, l'écran « Sera envoyé à » le dit, rien ne se perd (tâche 8, cas `rien_regle` de la table de
   parité ; tâche 15, test de l'encadré).
2. **La titulaire en congé dont le relais est lui-même en congé** : la demande va à la personne par défaut, puis aux
   formateurs de la promo (tâche 8, cas `relais_en_conge`).
3. **Le même lien d'e-mail ouvert deux fois, ou par un filtre de messagerie** : l'ouverture ne fait rien ; le second
   toucher dit « Déjà fait » sans rien écrire deux fois (tâche 10, preuve `jetons` ; tâche 11, test `etatDeLaPage`).
4. **L'absence annoncée pour une demi-journée dont la feuille est déjà ouverte, puis annulée par l'équipe** : la ligne
   est pré-marquée à l'instant, puis démarquée sans toucher une signature (tâche 14, preuve `emargement`).
5. **Un stagiaire qui change de promo ou qui est effacé sur demande** : ses demandes et ses absences suivent la fiche ; la
   preuve de la conservation reste VERTE (tâche 9 et tâche 14, groupe `conservation` ; tâche 19).

---

## Fichiers

| Fichier | Rôle | Tâches |
|---|---|---|
| `outils/base_locale/rejouer_suite.sh`, `LISEZMOI.md` | option `--autonomie` | 1 |
| `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs` | modes `contact-1`, `-2`, `-3`, `-n-contre-epreuve`, `-n-en-ligne` | 1 |
| `tests/sql/contact-aides.sql`, `contact-annuaire-preuve.sql`, `contact-demandes-preuve.sql`, `contact-absences-preuve.sql` | preuves | 1 à 3, 8 à 10, 14 |
| `tests/fixtures/contact-routage.json` | table de cas commune JS et SQL | 8 |
| `tests/sql/roles-preuve.sql` | lignes de matrice des tables nouvelles, lignes `contacts` et `user_profiles` selon l'état | 2, 3, 8, 14 |
| `supabase/migrations/20261115_contact_1_annuaire.sql` (+ `_retour`) | partie A | 2, 3 |
| `supabase/migrations/20261115_contact_2_demandes.sql` (+ `_retour`) | partie B | 8 à 10 |
| `supabase/migrations/20261115_contact_3_absences.sql` (+ `_retour`) | partie C | 14 |
| `supabase/migrations/20261115_contact_demo.sql` (+ `_retour`) | fiches fictives du centre de démonstration | 13 |
| `supabase/functions/contact-envois/index.ts`, `courriels.mjs`, `jetons.mjs` | fonction serveur | 10 |
| `js/contact-annuaire-rules.js`, `js/contact-rules.js`, `js/contact-absences-rules.js`, `js/lien-demande-rules.js` | règles pures | 4, 11, 15 |
| `js/db.js` | lectures et appels | 4, 11, 15 |
| `js/views/contacts.js` (créé), `js/views/ma-fiche-contact.js` (créé), `js/views/fiche-coordonnees.js` (créé), `js/views/messages.js` (créé), `js/views/demande.js` (créé), `js/views/prevenir-absence.js` (créé), `js/views/reglages-contact.js` (créé), `js/lien-demande.js` (créé), `demande.html` (créé), `css/contact.css` (créé) | écrans | 5, 6, 11, 12, 15 |
| `js/main.js`, `js/nav-rules.js`, `js/menu-compte.js`, `js/views/ressources.js`, `js/views/accueil-stagiaire.js`, `js/accueil-rules.js`, `js/views/config.js`, `js/views/mon-suivi.js`, `js/views/reglages-habillage.js`, `js/modules-data.js`, `js/espaces-rules.js`, `index.html`, `scripts/cache-bust.js` | branchements | 5, 6, 11, 12, 15 |
| `js/views/planning.js`, `js/views/planning-grille.js`, `js/emargement-rules.js`, `js/attestations-rules.js`, `js/emargement-feuilles.js` | absences annoncées | 16 |
| `js/nouveautes-data.js`, `supabase/functions/chatbot/aide.mjs` | Nouveautés, guide de l'assistant | 7, 17 |
| `outils/parcours/contact.py` (créé), `outils/parcours/navigation.py`, `outils/verifier_navigation.py` | robot et vérificateur | 7, 13, 17 |
| `docs/superpowers/plans/2026-11-14-espace-contact-textes-donnees.md` (créé), `docs/superpowers/plans/2026-11-14-espace-contact-dossier.md` (créé) | textes des données, dossier | 18, 19 |

### Fichiers à risque de recouvrement avec les titres (étapes 3 et 4, construites en même temps)

| Fichier | Ce que fait l'autre session | Ce que fait ce plan | Règle de cohabitation |
|---|---|---|---|
| `js/nav-rules.js`, `tests/nav-rules.test.mjs` | filtre de `entreesNavigation` par les cases (étape 3, Task C) | entrée `messages` (équipe, direction), route `contacts` dans `PAGES_DU_MENU_DU_COMPTE` | `messages` et `contacts` ne sont **pas** des cases de titre (spec § 10) : le filtre doit les laisser passer ; le dire à la coordination à la fusion |
| `js/menu-compte.js` | lignes « Mon titre », « Ce que je peux faire » | ligne « Contacts » à la place de « Contacts du centre » | lignes voisines, conflit de texte probable : fusion à la main |
| `js/views/config.js` | Réglages du fondateur (étape 3, Task B) | une section de plus dans `renderPreferences` (un élément du tableau) | une ligne |
| `js/views/reglages-habillage.js` | possible (cases de Réglages du centre) | deux sections de plus dans `renderReglagesCentre` | sections ajoutées en fin |
| `js/db.js` | lectures des titres | bloc « Espace contact » | blocs séparés, en fin de fichier |
| `js/espaces-rules.js` | préfixe `titres` (déjà là) | préfixe `contact` | une alternative de plus dans l'expression |
| `user_profiles_lecture` (règle) | T12 a déjà réécrit la clause du personnel (titres 5) ; l'aperçu par titre (étape 3, Task D) peut la toucher | la migration 1 la réécrit encore (clause du personnel) | garde de la migration 1 : texte en vigueur égal à celui de `20261112_titres_5_fermetures.sql`, sinon arrêt ; la coordination applique dans l'ordre et rejoue l'autre preuve |
| `case_promo`, `case_centre`, `direction_fixe` (étape 3, Task D : en-tête `x-apercu-titre`) | réécriture des fonctions de cases | lues seulement (par les gestes) | aucune réécriture ici |
| `tests/sql/roles-preuve.sql` | lignes de matrice des titres | lignes des tables nouvelles et lignes d'état pour `contacts` et `user_profiles` | lignes ajoutées après celles de l'autonomie |
| `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs` | modes des étapes 3 et 4 | modes `contact-*` | modes distincts, en fin de liste |
| `outils/base_locale/rejouer_suite.sh`, `LISEZMOI.md` | `--titres 4,7...` | `--autonomie` | options distinctes |
| `js/nouveautes-data.js`, `supabase/functions/chatbot/aide.mjs`, `tests/chatbot-aide.test.mjs` | Nouveautés et guide des titres | idem pour l'espace contact | entrées ajoutées, redéploiement de l'assistant groupé |
| `outils/verifier_navigation.py`, `outils/parcours/navigation.py`, `outils/parcours/connus.py` | profils Secrétariat et Intervenant | Contacts, Messages | attendus listés à la tâche 7 et 13 |
| `_harness_supabase.js`, `_harness_build.mjs` (hors git) | banc des titres | blocs « Espace contact » | blocs marqués, recopie à la main à la fusion |
| `js/legal-data.js` | version des conditions (étape 4) | rien (tâche 18 écrit seulement les textes) | une seule version, posée par la coordination |

---

## Partie 0 : outils

### Task 1 : Base locale au niveau de la production, assembleur, gabarits de preuve

Modèle conseillé : sonnet.

**Files:**
- Modify: `outils/base_locale/rejouer_suite.sh`, `outils/base_locale/LISEZMOI.md`, `outils/assembler_repetition_roles.mjs`, `tests/assembler-roles.test.mjs`
- Create: `tests/sql/contact-aides.sql`, `tests/sql/contact-annuaire-preuve.sql`, `tests/sql/contact-demandes-preuve.sql`, `tests/sql/contact-absences-preuve.sql` (gabarits)

**Interfaces:**
- Produces :
  - `rejouer_suite.sh [--port N] [--titres ...] [--autonomie] [--autonomie-version AAAA-MM-JJ]` : `--autonomie` joue
    `20261114_autonomie_1_traces` après les contacts ; `--autonomie-version` joue aussi `_2_version` avec `-v version=...`.
    Sortie : `OK : suite rejouée (22 migrations)` pour `--titres 1,2,3,5,6 --autonomie`.
  - Modes de l'assembleur : `contact-1`, `contact-2`, `contact-3` (injecte les migrations 1 à n dans l'ordre, joue la
    preuve de la partie n, puis les retours n à 1 ; groupe `retour` : empreinte d'après les retours égale à celle d'avant) ;
    `contact-n-contre-epreuve` (migrations 1 à n-1 injectées, la n neutralisée) ; `contact-n-en-ligne` (rien d'injecté).
    Un fichier manquant d'une étape demandée arrête l'assemblage (code 1, son nom).
  - `tests/sql/contact-aides.sql` : `-- @@INCLURE tests/sql/roles-aides.sql@@` et `titres-aides.sql` au niveau de
    l'assemblage, plus `pg_temp.poser_contact()` (personnages de `poser_perso()` et `poser_titres_gestes()`, plus
    `sec_n` : fiche sans compte « Preuve Secrétariat » de Nîmes avec e-mail `preuve.sec@exemple.invalid`) et
    `pg_temp.demi(p_jour date, p_demi text)` qui rend `(lundi, day_index)`.
  - Gabarits : empreinte avant, `-- @@INJECTER ...@@`, groupe `structure` seul, retours, verdict par
    `pg_temp.verdict_titres(<mode>, <début>)`.

- [ ] **Step 1 : tests de l'assembleur qui échouent** (`tests/assembler-roles.test.mjs`) : `contact-2` contient les
  marqueurs des migrations 1 et 2 dans cet ordre puis les retours 2 et 1 ; `contact-2-contre-epreuve` injecte la 1 et
  neutralise la 2 (`'select 1'`) ; `contact-3-en-ligne` n'injecte rien ; une migration 3 absente arrête `contact-3`.
  Run : `node tests/assembler-roles.test.mjs`. Expected : FAIL (mode inconnu).
- [ ] **Step 2 : modes et gabarits.** Run : `node tests/assembler-roles.test.mjs`. Expected : PASS.
- [ ] **Step 3 : base locale.** Run : `bash outils/base_locale/reconstruire.sh --port 55460 && bash
  outils/base_locale/rejouer_suite.sh --port 55460 --titres 1,2,3,5,6 --autonomie`. Expected : `OK : base locale prête`,
  puis `OK : suite rejouée (22 migrations)`.
- [ ] **Step 4 : verdicts de départ** rangés dans `.base-locale/verdicts/avant-contact/` (dossier ignoré) : rôles
  `en-ligne`, `titres-en-ligne`, `gestion-en-ligne`, `espaces-en-ligne`, `donnees-en-ligne`, profils `en-ligne`
  (`outils/assembler_preuve_profils.mjs`), contacts `en-ligne` (`outils/assembler_preuve_contacts.mjs`),
  `tests/sql/emargement-preuve.sql`, `tests/sql/conservation-preuve.sql` (avec `-v migration=... -v retour=...`),
  `tests/sql/autonomie-preuve.sql`. Expected : chaque verdict `VERT` ; comptes notés dans le rapport (référence de toute
  comparaison). Le gabarit `contact-1-contre-epreuve` : `VERT` sur `structure` (prérequis : `geste_promo`,
  `retirer_titre`, `donner_titre`, `contacts.lieu_id`).
- [ ] **Step 5 : commit** `Espace contact : outils (base locale --autonomie, modes contact de l'assembleur, gabarits de preuve)`.

---

## Partie A : l'annuaire

État testable en fin de partie : base locale avec la migration 1 ; page Contacts au banc (stagiaire, équipe, direction),
« Ma fiche de contact », coordonnées et délégué sur la fiche d'un stagiaire ; parcours de l'annuaire verts.

### Task 2 : Les fiches de l'équipe (migration 1, partie A)

Modèle conseillé : opus (sécurité).

**Files:**
- Create: `supabase/migrations/20261115_contact_1_annuaire.sql`, `_retour.sql`
- Modify: `tests/sql/contact-annuaire-preuve.sql`, `tests/sql/roles-preuve.sql`

**Interfaces:**
- Consumes : `geste_promo`, `lieu_courant`, `lieu_de_promo`, `affectations`, `titres`, `profs`, `user_profiles.prof_id`.
- Produces :
  - `contacts` : colonnes `compte_email text` (index unique sur `lower(compte_email)` non nul), `nom text`, `pour_quoi
    text` et `quand text` (80 caractères au plus), `verifiee_le timestamptz`, `relais_id bigint references contacts on
    delete set null` (`relais_id <> id`), `conge_du date`, `conge_au date` (les deux nuls ou `conge_du <= conge_au`),
    `prof_id integer references profs on delete set null` (unique non nul), `lieux_partages integer[] not null default
    '{}'` ; `prenom` et `lieu_id` deviennent nullables avec les contraintes `(compte_email is null) = (lieu_id is not
    null)` et `compte_email is not null or prenom is not null`. Les colonnes existantes (`prenom`, `role` = libellé libre,
    `phone` = téléphone professionnel, `email`, `note`, `category`, `sort_order` = ordre) ne changent ni de nom ni de
    contenu.
  - Fusion des copies (C-2), puis fiches d'office : une ligne `contacts (compte_email)` par adresse distincte de
    `affectations` de rôle `formateur` ou `direction`. Déclencheurs `affectations_fiche_contact` (after insert :
    `_contact_fiche_d_office()`, `on conflict do nothing`) et `affectations_fiche_orpheline` (after delete :
    `_contact_fiche_orpheline()`, supprime la fiche quand l'adresse n'a plus aucune affectation `formateur` ou `direction`).
  - `public._contact_fiche_dans(c public.contacts, l integer) returns boolean` : sans compte, `l = lieu_id or l =
    any(lieux_partages)` ; avec compte, une affectation `formateur` sur une promo de l ou `direction` sur l.
  - `public.annuaire_centre() returns table(id bigint, avec_compte boolean, nom_affiche text, titres jsonb, libelle text,
    pour_quoi text, quand text, telephone text, email text, verifiee boolean, conge_du date, conge_au date, relais_id
    bigint, prof_id integer, ordre integer, moi boolean, ecrivable boolean)` : fiches de `lieu_courant()` (nul : aucune
    ligne). `titres` : `[{nom, niveau, promos}]` des titres de la personne dans ce centre ; `libelle` : `role` d'une fiche
    sans compte ; fiche avec compte non vérifiée : `pour_quoi`, `quand`, `telephone`, `email` nuls ; fiche sans compte :
    `pour_quoi = coalesce(pour_quoi, note)` ; `ecrivable` : fiche sans compte de ce centre et
    `geste_promo(promo_courante(), 'fiches_internes.ecrire')`. Tri : `ordre`, puis `nom_affiche collate "C"`.
  - `alter policy contacts_select_authenticated` : `using ((select public.geste_promo((select public.promo_courante()),
    'fiches_internes.ecrire')))` ; `alter policy contacts_ecriture` : le texte de `20261112_titres_3_regles.sql` avec
    `compte_email is null and` devant, en `using` et en `with check`. `contacts_meme_centre` inchangée.
  - Droits de colonnes : `revoke insert, update on public.contacts from authenticated` puis `grant insert (prenom, nom,
    role, phone, email, note, category, sort_order, pour_quoi, quand, relais_id, conge_du, conge_au, prof_id,
    lieux_partages, lieu_id)` et le même `update` sans `lieu_id`.
  - Déclencheur `contacts_avant_ecriture` (before insert or update, `_contact_avant_ecriture()`) : refus `contact: Vous ne
    pouvez partager une fiche qu'avec un centre où vous écrivez les fiches.` (42501) pour tout centre ajouté ou retiré de
    `lieux_partages` où l'appelant n'a pas `fiches_internes.ecrire` sur une promo de ce centre (fondateur hors aperçu :
    permis ; propriétaire sans jeton : permis) ; `contact: Le relais doit être une fiche de ce centre.` si `relais_id`
    désigne une fiche absente des centres de la fiche.
- Retour : déclencheurs, fonctions, droits de colonnes d'origine (`grant insert, update on public.contacts to
  authenticated`), règles remises au texte de `20261112_titres_3_regles.sql` et de `20261028_roles_3_regles.sql` relus
  dans les fichiers, fiches d'office supprimées, copies refaites (une ligne par centre de `lieux_partages`, dates
  copiées), colonnes retirées. Garde d'ordre : refus si `public.ecrire_au_centre` existe (retour 2 d'abord).
  - Rattachement à `profs` : une fiche d'office reprend `user_profiles.prof_id` du compte quand cette ligne `profs`
    n'est rattachée à aucune autre fiche ; une fiche sans compte se rattache à la main (`prof_id`, tâche 5). C'est par ce
    rattachement que la partie C trouve les formateurs du jour.

- [ ] **Step 1 : preuve, groupe `fiches`** (attendus en dur) : après `poser_contact()`, `form_n`, `dir_n`, `form_s`,
  `dir_deux`, `t_interv` ont chacun **une** fiche (`count(*) filter (where compte_email = ...)` = 1, `dir_deux` aussi) ;
  `siege` et `stag_n` aucune ; une affectation nouvelle (`inviter_compte` par `dir_n`) crée la fiche ; `retirer_titre` de
  la dernière l'efface ; les fiches sans compte d'avant gardent leurs valeurs (empreinte md5 de `prenom, role, phone,
  email, note, category` des lignes sans compte avant et après, centres des copies fusionnées compris) ; deux lignes
  identiques posées en propriétaire à Nîmes et à Montpellier avant la migration (mode injecté) : une seule après,
  `lieux_partages = '{2}'` ; une copie modifiée reste à part.
- [ ] **Step 2 : preuve, groupe `annuaire`** (nombre de lignes de `annuaire_centre()`, en-tête promo 1 sauf mention) :
  `stag_n` voit les fiches de Nîmes et les fiches partagées avec Nîmes, aucune du centre de démonstration ; `stag_s`
  (promo 7) voit les deux fiches fictives et `form_s`, `dir_s`, aucune de Nîmes ; `stag_m` (promo 2) voit une fiche
  fusionnée de Nîmes partagée avec Montpellier ; `siege` sans promo : 0 ligne, et sous l'en-tête 1 : 0 ligne ; la fiche de
  `form_n` non vérifiée rend `email`, `telephone`, `pour_quoi` nuls à `stag_n` ; `select count(*) from public.contacts`
  par `stag_n` : 0 (lecture directe fermée), par `form_n` : les fiches sans compte de Nîmes.
- [ ] **Step 3 : preuve, groupe `ecritures`** : `form_n` ajoute une fiche sans compte (centre posé d'office) : `OK` ;
  `form_n` met à jour la fiche avec compte de `dir_n` par l'API : `OK 0` ; écrit `compte_email` : `ERREUR 42501` ;
  partage une fiche de Nîmes avec le centre de démonstration : `ERREUR 42501` et la phrase ; `dir_deux` partage avec
  Montpellier : `OK` ; `t_interv` (Intervenant, titre non fixe) ajoute : `ERREUR 42501` ou `OK 0` ; `stag_n` n'écrit
  rien ; `form_m` (Montpellier) modifie une fiche de Nîmes partagée avec Montpellier : `OK 0`.
- [ ] **Step 4 : contre-épreuve.** Run : `node outils/assembler_repetition_roles.mjs contact-1-contre-epreuve
  .base-locale/c.sql && PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p 55460 -U postgres -d postgres -X -q -f
  .base-locale/c.sql`. Expected : `ROUGE` sur `fiches`, `annuaire`, `ecritures`.
- [ ] **Step 5 : écrire la partie A et son retour.** Garde d'entrée : `contacts.lieu_id` existe, `contacts.compte_email`
  n'existe pas, `donner_titre(text, bigint, integer, integer[], integer)` existe, `contacts_ecriture` a exactement le
  texte de `20261112_titres_3_regles.sql`.
- [ ] **Step 6 : vert.** Run : `contact-1` assemblé puis joué. Expected : `VERT n/0`, groupe `retour` égal.
- [ ] **Step 7 : matrice du lot 4.** Dans `tests/sql/roles-preuve.sql`, la ligne `public.contacts` prend, quand
  `to_regprocedure('public.annuaire_centre()') is not null`, la lecture `fiches_internes.ecrire` du centre au lieu de
  « tout connecté du centre » (lecture inchangée sinon). Run : `en-ligne` (rôles) sur la base avec la migration 1
  appliquée (`psql -1 -f`) et sans. Expected : VERT dans les deux cas.
- [ ] **Step 8 : commit** `Espace contact, migration 1 (A) : une fiche par personne, fiches d'office, copies fusionnées, annuaire par fonction`.

### Task 3 : Ma fiche, coordonnées des stagiaires, financements, délégué, profils du personnel (migration 1, partie B)

Modèle conseillé : opus (sécurité).

**Files:**
- Modify: `supabase/migrations/20261115_contact_1_annuaire.sql`, `_retour.sql`, `tests/sql/contact-annuaire-preuve.sql`, `tests/sql/roles-preuve.sql`

**Interfaces:**
- Consumes : Task 2.
- Produces :
  - `public.ma_fiche_contact() returns jsonb` : `{fiche: {...} | null, email_compte, centres: [{id, nom}]}` ; `fiche` nul
    sans affectation (stagiaire, siège seul).
  - `public.regler_ma_fiche(p_champs jsonb) returns jsonb` : clés permises `prenom`, `nom` (écrites seulement sans ligne
    `profs` rattachée), `email`, `telephone`, `pour_quoi`, `quand`, `relais_id`, `conge_du`, `conge_au` ; une clé absente
    ne change rien, une clé à `null` efface ; tout enregistrement pose `verifiee_le = now()` (C-4). Refus : `contact: Vous
    n'avez pas de fiche de contact.` (42501), `contact: Ce texte est trop long (80 caractères au plus).`, `contact: Adresse
    e-mail invalide.`, `contact: Le relais doit être une personne de l'équipe de votre centre.`, `contact: Les dates du
    congé ne se suivent pas.`, `contact: Champ inconnu « % ».`
  - `public.ordonner_fiches(p_ids bigint[]) returns integer` : `fiches_internes.ecrire` sur la promo affichée (sinon
    42501) ; chaque identifiant doit être une fiche de `lieu_courant()` ; `sort_order = 10 * rang`.
  - `public.contact_financements(id bigint identité, lieu_id integer not null references lieux on delete cascade, libelle
    text not null check (char_length between 1 and 40), ordre integer not null default 0, retire boolean not null default
    false)`, index unique `(lieu_id, lower(libelle))` ; remplie pour chaque lieu existant, et par le déclencheur
    `lieux_financements_defaut` (after insert on `lieux`), de : `CPF`, `Région`, `France Travail`, `Contrat de
    professionnalisation`, `Entreprise`, `Personnel`, `Autre` (ordre 10 à 70). RLS active, aucune règle, aucun droit.
  - `public.financements_du_centre() returns table(id bigint, libelle text, ordre integer, retire boolean)` : ceux de
    `lieu_courant()`, pour tout compte qui y accède.
  - `public.regler_financements(p_lieu_id integer, p_liste jsonb) returns integer` : `geste_centre(p_lieu_id,
    'reglages.modifier')` (sinon 42501, `contact: Réservé aux réglages du centre.`) ; `[{id|null, libelle, ordre,
    retire}]` ; un financement porté par une fiche ne se supprime pas, il se `retire`.
  - `stagiaires_prive` : `telephone text check (telephone is null or telephone ~ '^[0-9 +().-]{6,20}$')`, `financement_id
    bigint references contact_financements on delete set null`.
  - `public.regler_coordonnees_stagiaire(p_stagiaire_id integer, p_champs jsonb) returns void` : fiche de la promo
    affichée (sinon `contact: Stagiaire introuvable dans cette promo.`) ; `telephone` : la personne
    (`p_stagiaire_id = my_stagiaire_id()`) ou `stagiaires.gerer` ; `financement_id` : `stagiaires.gerer` seul, financement
    du centre de la promo et non retiré ; refus 42501 `contact: Réservé à l'équipe.`
  - `public.coordonnees_promo() returns table(stagiaire_id integer, telephone text, email text, financement_id bigint,
    financement text)` : promo affichée ; toutes les fiches si `stagiaires.lire`, sinon la sienne seule.
  - `stagiaires.delegue text check (delegue in ('titulaire', 'suppleant'))`, index unique `(promo_id, delegue) where
    delegue is not null` ; écrit par la règle `stagiaires_modification` existante (`stagiaires.gerer`), lu par
    `stagiaires_select_all`.
  - `alter policy user_profiles_lecture` : dans la clause du personnel (texte de `20261112_titres_5_fermetures.sql`),
    `(select public.promo_par_defaut()) is not null` devient `(select public._contact_compte_equipe())` ;
    `public._contact_compte_equipe() returns boolean` (stable, security definer, aucun droit d'exécution autre que celui
    nécessaire à la règle : `grant execute ... to authenticated`) : hors aperçu `stagiaire`, une affectation quelconque de
    l'adresse du jeton ou `fondateur_reel()`. Garde : le texte en vigueur contient `promo_par_defaut()` exactement une fois.

- [ ] **Step 1 : preuve, groupe `ma_fiche`** : `form_n` lit sa fiche (`verifiee` faux, `email_compte` = son adresse) ;
  enregistre `{email, telephone, pour_quoi}` : `verifiee` vrai, et `stag_n` voit alors l'e-mail ; `pour_quoi` de 81
  caractères : refus ; relais vers la fiche de `form_s` (centre de démonstration) : refus ; congé `au` avant `du` : refus ;
  `stag_n` appelle `regler_ma_fiche` : `ERREUR 42501` ; `form_n` appelle `ordonner_fiches` avec une fiche de Montpellier :
  refus ; avec les fiches de Nîmes : `OK n`.
- [ ] **Step 2 : preuve, groupe `coordonnees`** : `stag_n` règle son téléphone : `OK` ; son financement : `ERREUR 42501` ;
  le téléphone de `stag_m` (autre promo) : refus ; `coordonnees_promo()` rend 1 ligne à `stag_n`, toutes les fiches de la
  promo à `form_n` et à `t_secr` (Stagiaires : Modifier), 0 à `t_rh` (Stagiaires : Non) ; `t_secr` règle un financement
  de Nîmes : `OK` ; un financement de Montpellier : refus ; `select telephone from stagiaires_prive` par `stag_n` : sa
  ligne seule ; deux titulaires dans la promo 1 : `ERREUR 23505` ; `stag_n` écrit `delegue` : `OK 0`.
- [ ] **Step 3 : preuve, groupe `financements`** : 7 financements par lieu ; `creer_centre('Preuve centre')` par
  `siege` : 7 lignes pour le nouveau lieu ; `regler_financements` par `form_n` : `ERREUR 42501`, par `dir_n` : `OK` ;
  supprimer un financement porté : refus, le retirer : `OK`.
- [ ] **Step 4 : preuve, groupe `profils`** : `stag_n` lit 0 profil du personnel et le sien ; `fond` en aperçu
  `stagiaire` lit 0 profil du personnel ; `form_n`, `dir_n`, `siege` lisent le même nombre de profils du personnel
  qu'avant la migration (valeur relevée avant dans le même bloc).
- [ ] **Step 5 : contre-épreuve** (`contact-1` avec la seule partie A) : ROUGE sur `ma_fiche`, `coordonnees`,
  `financements`, `profils`.
- [ ] **Step 6 : écrire la partie B et son retour ; vert.** `contact-1` : `VERT n/0`. Puis, migration 1 appliquée sur la
  base locale : profils `en-ligne` VERT (32 contrôles ou plus), titres `gestion-en-ligne` et `titres-en-ligne` égaux à
  `avant-contact`, rôles `en-ligne` VERT (lignes de matrice `contact_financements` : tout `false` ; `user_profiles` : la
  lecture des profils du personnel par S passe à `false` quand `_contact_compte_equipe` existe), conservation VERTE.
  Contacts `en-ligne` : ses contrôles L (lecture directe des stagiaires) et D (Montpellier a exactement les copies)
  deviennent ROUGES, c'est attendu : cette preuve est remplacée par `contact-annuaire-preuve.sql` (le dire au dossier).
- [ ] **Step 7 : commit** `Espace contact, migration 1 (B) : ma fiche, coordonnées privées, financements du centre, délégué, profils du personnel fermés aux stagiaires`.

### Task 4 : Règles pures et lectures de l'annuaire

Modèle conseillé : sonnet.

**Files:**
- Create: `js/contact-annuaire-rules.js`, `tests/contact-annuaire-rules.test.mjs`
- Modify: `js/db.js` (bloc « Espace contact », fin de fichier ; `updateContact`, `deleteContact`), `js/espaces-rules.js` (`PREFIXES_DE_REFUS`), `tests/espaces-rules.test.mjs`

**Interfaces:**
- Consumes : fonctions de la migration 1.
- Produces :
  - `libelleTitres(titres) -> string` : `[{nom:"Formateur",niveau:"promo",promos:2}]` donne `"Formateur · 2 promos"` ; une
    promo : `"Formateur"` ; plusieurs titres joints par `", "` ; vide : `""`.
  - `enConge(fiche, jour) -> boolean` (`conge_du <= jour <= conge_au`, dates `AAAA-MM-JJ`).
  - `ligneDeFiche(fiche, { jour, parId }) -> { nom, titre, pourQuoi, quand, appeler, ecrire, conge }` : `appeler` est
    `"tel:"` suivi des chiffres et du `+` seulement, nul sans téléphone ; `conge` : `"Absente jusqu'au 15, relais : Claire"`
    (`parId` donne le nom du relais) ou nul.
  - `trierFiches(fiches) -> fiches` (ordre, puis nom en `localeCompare("fr")`).
  - `validerMaFiche(champs) -> { ok, erreurs: { champ: phrase } }` : mêmes limites que la base (80 caractères, e-mail,
    dates du congé).
  - `js/db.js` : `lireAnnuaire()`, `lireMaFiche()`, `reglerMaFiche(champs)`, `ordonnerFiches(ids)`,
    `lireFinancements()`, `reglerFinancements(lieuId, liste)`, `lireCoordonnees()`, `reglerCoordonnees(stagiaireId,
    champs)`, `reglerDelegue(stagiaireId, valeur)` (update de `stagiaires`, `.select("id")`, 0 ligne : erreur). Chaque
    refus part par `erreurDeBase`.
  - `updateContact(id, patch)` et `deleteContact(id)` : `.select("id")` ; 0 ligne : `throw new Error("Cette fiche ne peut
    pas être modifiée d'ici.")` (resp. « supprimée »).
  - `PREFIXES_DE_REFUS` gagne `contact`.

- [ ] **Step 1 : tests qui échouent** :
  ```js
  test("titres : une promo, plusieurs promos, plusieurs titres", () => {
    assert.equal(libelleTitres([{ nom: "Formateur", niveau: "promo", promos: 1 }]), "Formateur");
    assert.equal(libelleTitres([{ nom: "Formateur", niveau: "promo", promos: 2 }]), "Formateur · 2 promos");
    assert.equal(libelleTitres([{ nom: "Secrétariat", niveau: "centre" }, { nom: "Formateur", niveau: "promo", promos: 1 }]),
      "Secrétariat, Formateur");
  });
  test("le numéro devient un lien d'appel sans espaces", () => {
    assert.equal(ligneDeFiche({ telephone: "04 12 34 56 78" }, { jour: "2026-11-14" }).appeler, "tel:0412345678");
  });
  test("congé : relais nommé, borne incluse", () => {
    const f = { conge_du: "2026-11-10", conge_au: "2026-11-15", relais_id: 9 };
    assert.equal(ligneDeFiche(f, { jour: "2026-11-15", parId: new Map([[9, "Claire"]]) }).conge, "Absente jusqu'au 15, relais : Claire");
    assert.equal(ligneDeFiche(f, { jour: "2026-11-16", parId: new Map() }).conge, null);
  });
  test("ma fiche : 81 caractères refusés", () => {
    assert.equal(validerMaFiche({ pour_quoi: "x".repeat(81) }).erreurs.pour_quoi, "80 caractères au plus.");
  });
  ```
  et, dans `tests/espaces-rules.test.mjs`, `phraseDeRefus("contact: Réservé à l'équipe.", "42501")` vaut `"Réservé à
  l'équipe."`. Run : `node tests/contact-annuaire-rules.test.mjs`. Expected : FAIL.
- [ ] **Step 2 : implémenter** ; `updateContact` et `deleteContact` lèvent sur 0 ligne (test node avec un faux client
  passé par `globalThis` comme les tests existants de `js/db.js`, ou à défaut couverture par le parcours de la tâche 7).
- [ ] **Step 3 : tests verts.** Run : `for f in tests/*.test.mjs; do node "$f"; done`. Expected : tout PASS.
- [ ] **Step 4 : commit** `Espace contact : règles de l'annuaire, lectures, écritures qui comptent leurs lignes`.

### Task 5 : La page Contacts et la navigation

Modèle conseillé : sonnet.

**Files:**
- Create: `js/views/contacts.js`, `css/contact.css`
- Modify: `js/main.js` (route `contacts`), `js/nav-rules.js` (`PAGES_DU_MENU_DU_COMPTE`, `ALIAS_ENTREE_ACTIVE`), `tests/nav-rules.test.mjs`, `js/menu-compte.js`, `js/views/accueil-stagiaire.js`, `js/views/ressources.js`, `js/modules-data.js`, `index.html` (lien `css/contact.css`), `js/icons.js` si une icône manque

**Interfaces:**
- Consumes : Task 4.
- Produces : `renderContacts(container)` ; route `#/contacts` ouverte au stagiaire, à l'équipe et à la direction
  (`routeDansLEspace`), pas au siège ; `contacts` dans `PAGES_DU_MENU_DU_COMPTE` et alias vers `home`.

- [ ] **Step 1 : tests de navigation qui échouent** (`tests/nav-rules.test.mjs`) : `entreeActive("contacts", entrees,
  "stagiaire")` vaut `"home"` ; en direction : `null` ; `routeApresRedirection("ressources", "stagiaire")` reste
  `"themes"`. Run : `node tests/nav-rules.test.mjs`. Expected : FAIL.
- [ ] **Step 2 : la page.** Sections, dans cet ordre (stagiaire) : en-tête « Contacts » (surtitre : le centre),
  « L'équipe du centre » (une carte par fiche : nom, titre, « Pour quoi me joindre », « Quand », boutons « Appeler »
  et, tâche 12, « Écrire »), « Ta promo » (prénom, nom, mention « délégué » ou « suppléant », jamais de numéro ni
  d'adresse). Équipe et direction : la même page au vouvoiement ; « Stagiaires de la promo » avec téléphone, e-mail et
  financement quand `coordonnees_promo()` les rend, sinon les noms ; « Ajouter une fiche » et modification des fiches
  `ecrivable` (fenêtre de `js/nav-fenetre.js` : prénom, nom, libellé avec les titres du centre en suggestion, e-mail et
  téléphone professionnels, pour quoi, quand, congé, relais, « Formateur du planning » (`prof_id`), centres de partage ;
  suppression par `confirmer`), réordonner par « Monter » et « Descendre »
  (`ordonnerFiches`). Fiche avec compte non vérifiée : nom et titre seulement. Aucune fiche : « Aucun contact pour ce
  centre. » Erreur de lecture : phrase et « Réessayer ».
- [ ] **Step 3 : menu, accueil, Documents.** `js/menu-compte.js` : la ligne « Contacts du centre » (vers
  `#/ressources`) devient « Contacts » vers `#/contacts`, même place (entre « Nouveautés » et « Mes préférences »), dans
  les espaces stagiaire, équipe et direction (C-14), sans dépendre du module Ressources. Accueil du stagiaire : le lien de
  pied « Contacts du centre » devient « Contacts » vers `#/contacts`. `js/views/ressources.js` : la section des contacts
  et ses fonctions (`openContactModal`, `renderContactCard`) partent ; le sous-titre devient « Textes officiels et sites
  pédagogiques. » et le compte ne cite plus les contacts. `js/modules-data.js` : l'explication du module Ressources
  devient « Liens utiles. »
- [ ] **Step 4 : tests verts.** Run : `for f in tests/*.test.mjs; do node "$f"; done`. Expected : PASS.
- [ ] **Step 5 : commit** `Espace contact : page Contacts (stagiaire, équipe, direction), ligne du menu, Documents sans contacts`.

### Task 6 : Ma fiche de contact, coordonnées sur la fiche d'un stagiaire, financements du centre

Modèle conseillé : sonnet.

**Files:**
- Create: `js/views/ma-fiche-contact.js`, `js/views/fiche-coordonnees.js`
- Modify: `js/views/config.js` (`renderPreferences` : une section de plus), `js/views/mon-suivi.js` (`renderFiche` : le bloc des coordonnées), `js/views/reglages-habillage.js` (`renderReglagesCentre` : section « Financements »), `js/views/accueil-stagiaire.js` ou la page Aujourd'hui de l'équipe (`js/views/aujourdhui.js`) pour « Vérifiez votre fiche de contact », `css/contact.css`

**Interfaces:**
- Consumes : Task 4.
- Produces : `sectionMaFiche()` (équipe : « Ma fiche de contact » ; stagiaire : « Mon téléphone »), `blocCoordonnees(d,
  { soi })`, `sectionFinancements(centre)`.

- [ ] **Step 1 : Mes préférences.** Équipe : prénom et nom (si aucune fiche formateur n'est rattachée), « E-mail
  professionnel » pré-rempli avec l'adresse du compte, « Téléphone professionnel », « Pour quoi me joindre », « Quand me
  joindre », « Absente du ... au ... » et « Relais » (fiches du ou des centres), un bouton « Enregistrer » ; tant que la
  fiche n'est pas vérifiée, un encadré « Vérifiez votre fiche de contact : les stagiaires ne voient que votre nom tant
  qu'elle n'est pas enregistrée. ». Stagiaire : « Mon téléphone » (facultatif, visible de l'équipe seulement, phrase qui
  le dit).
- [ ] **Step 2 : rappel.** La page d'accueil de l'équipe (Aujourd'hui) montre une fois par visite « Vérifiez votre fiche
  de contact » avec un lien vers Mes préférences tant que `verifiee` est faux.
- [ ] **Step 3 : fiche d'un stagiaire.** `blocCoordonnees` sous l'en-tête de la fiche : téléphone, e-mail, financement,
  délégué ; « Modifier » (téléphone, financement dans la liste du centre, « délégué », « suppléant », « aucun ») quand le
  geste `stagiaires.gerer` est lisible côté app (`isAdmin()` pour les titres fixes ; la base reste juge et son refus
  s'affiche) ; le stagiaire voit les siens en lecture (son financement compris). Un second titulaire : la phrase de la
  base (« Il y a déjà un délégué titulaire dans cette promo. », traduite de l'état 23505 par `js/contact-annuaire-rules.js`,
  `phraseDelegue(code)`, testée).
- [ ] **Step 4 : Réglages du centre**, section « Financements » : la liste, « Ajouter », « Retirer », ordre.
- [ ] **Step 5 : vérification.** Run : `for f in tests/*.test.mjs; do node "$f"; done` ; contrôle du tiret cadratin sur
  les fichiers touchés. Expected : PASS, rien trouvé.
- [ ] **Step 6 : commit** `Espace contact : ma fiche de contact, coordonnées et délégué sur la fiche, financements du centre`.

### Task 7 : Banc, robot et vérificateur de l'annuaire, Nouveautés, guide de l'assistant

Modèle conseillé : sonnet.

**Files:**
- Modify: `_harness_supabase.js`, `_harness_build.mjs` (hors git, blocs marqués), `outils/parcours/navigation.py`, `outils/verifier_navigation.py`, `js/nouveautes-data.js`, `supabase/functions/chatbot/aide.mjs`, `tests/chatbot-aide.test.mjs`, `tests/nouveautes.test.mjs` si un attendu nomme « Contacts du centre »
- Create: `outils/parcours/contact.py`

**Interfaces:**
- Produces : RPC du banc `annuaire_centre`, `ma_fiche_contact`, `regler_ma_fiche`, `ordonner_fiches`,
  `financements_du_centre`, `regler_financements`, `coordonnees_promo`, `regler_coordonnees_stagiaire` dans
  `rpcContactBanc(name, p)` ; fiches du banc : deux sans compte à Nîmes (dont une partagée avec Montpellier), la fiche du
  formateur du banc (vérifiée), celle de la direction (non vérifiée), deux fictives au centre de démonstration ; levier
  `?fiche_contact=a_verifier`.

- [ ] **Step 1 : banc** (blocs « Espace contact »). `node _harness_build.mjs`. Contrôle : `grep -o "v=2026[0-9a-z]*"
  _harness.html | sort -u` donne le seul jeton d'`index.html`.
- [ ] **Step 2 : parcours** (`outils/parcours/contact.py`, compétence `robot-des-parcours`) : `annuaire-stagiaire`
  (menu du compte, « Contacts », l'équipe du centre et « Ta promo » sans numéro ; budget 2 et 3) ;
  `annuaire-equipe-ajoute` (ajoute une fiche sans compte, la voit, `banc={"ecritures":"1"}`) ;
  `ma-fiche-verifiee` (Mes préférences, enregistre, l'encadré disparaît) ; `coordonnees-stagiaire` (fiche d'un
  stagiaire, financement choisi) ; `annuaire-direction` ; `annuaire-autre-centre` (stagiaire de la promo 7 : aucune fiche
  de Nîmes). Mise au point : `python outils/robot_parcours.py --parcours annuaire-stagiaire --moteurs chromium --formats
  ordinateur`.
- [ ] **Step 3 : vérificateur** (`outils/verifier_navigation.py`), attendus à mettre à jour : ligne du menu « Contacts »
  (au lieu de « Contacts du centre », `href` `#/contacts`, entre « Nouveautés » et « Mes préférences », présente même
  module Ressources fermé : le scénario `ressources_fermees` attend désormais la ligne) ; page Documents sans section
  « Contacts du centre » (contrôle de la l. 3266 inversé) ; contrôle de la l. 3899 à 3920 réécrit pour `#/contacts`
  (titre « Contacts », entrée allumée `home` chez le stagiaire, aucune en direction) ; `ENTREES_REPLI` inchangé ;
  chemins des Nouveautés qui citaient `#/ressources` pour les contacts. Run : `python outils/verifier_navigation.py`.
  Expected : code 0.
- [ ] **Step 4 : Nouveautés** (`js/nouveautes-data.js`), à la date de la mise en ligne (`AAAA-MM-JJ` posé par la
  coordination) :
  - `pour: "stagiaires"`, titre « Les contacts du centre, au même endroit » ; résumé : « Dans le menu de ton compte,
    Contacts réunit l'équipe de ton centre : qui est qui, pour quoi la joindre et quand, avec son numéro professionnel. Tu
    y retrouves aussi les noms de ta promo et ses délégués. Ton numéro de téléphone, si tu le donnes dans Mes préférences,
    n'est visible que de l'équipe. » ; `ou: { label: "Contacts", route: "contacts" }`.
  - `pour: "formateurs"`, titre « Votre fiche de contact » ; résumé : « Contacts (menu du compte) remplace les contacts de
    Documents : chaque membre de l'équipe y a sa fiche, créée d'office. Vérifiez la vôtre dans Mes préférences (e-mail et
    téléphone professionnels, pour quoi et quand vous joindre, absence et relais) : tant qu'elle n'est pas enregistrée,
    les stagiaires ne voient que votre nom. Une fiche partagée entre deux centres se corrige une seule fois. » ;
    `ou: { label: "Mes préférences", route: "preferences" }`.
  L'entrée du 11/11 « Chaque centre a ses propres contacts » reste (récit daté).
- [ ] **Step 5 : guide de l'assistant** (`aide.mjs`) : « Contacts du centre » devient « Contacts » dans la ligne COMPTE et
  l'accueil du stagiaire ; Documents ne parle plus des contacts ; une phrase sur la page Contacts et la fiche de contact.
  Run : `node tests/chatbot-aide.test.mjs`. Expected : PASS.
- [ ] **Step 6 : commit** `Espace contact : annuaire au banc, au robot et au vérificateur ; Nouveautés et guide`.

---

## Partie B : les demandes et les e-mails

État testable en fin de partie : base locale avec les migrations 1 et 2 ; écrire au centre, à une fiche, à un stagiaire ;
Messages de l'équipe et de la direction ; réponses toutes faites ; liens signés par la page `demande.html` ; fonction
d'envoi testée sans réseau ; parcours verts.

### Task 8 : Demandes, routage, création (migration 2, partie A)

Modèle conseillé : opus (sécurité).

**Files:**
- Create: `supabase/migrations/20261115_contact_2_demandes.sql`, `_retour.sql`, `tests/fixtures/contact-routage.json`, `js/contact-rules.js`, `tests/contact-rules.test.mjs`
- Modify: `tests/sql/contact-demandes-preuve.sql`, `outils/assembler_repetition_roles.mjs` (marqueur `-- @@CAS_ROUTAGE@@`), `tests/assembler-roles.test.mjs`, `tests/sql/roles-preuve.sql`

**Interfaces:**
- Consumes : migration 1 ; `formateur_fixe` ; `planning_entries` (`prof_id`, `prof_ids`, `prof_autre`).
- Produces :
  - Tables (RLS active, aucune règle, aucun droit pour anon et authenticated ; C-9) :
    - `demandes(id bigint identité, lieu_id integer not null references lieux, promo_id integer references promos,
      auteur_stagiaire_id integer references stagiaires on delete cascade, auteur_fiche_id bigint references contacts on
      delete set null, auteur_nom text not null, type text check (type in ('absence','retard','administratif','document',
      'autre')), sujet text check (char_length(sujet) between 1 and 80), texte text check (char_length(texte) <= 1000),
      etat text not null default 'envoyee' check (etat in ('envoyee','prise','annulee')), cree_le timestamptz not null
      default now(), prise_le timestamptz, prise_par text, annulee_le timestamptz, annulee_par text, dernier_echange_le
      timestamptz not null default now())`, une seule origine (`auteur_stagiaire_id` ou `auteur_fiche_id`, check) ;
      index `(lieu_id, dernier_echange_le)`, `(auteur_stagiaire_id, cree_le)`.
    - `demande_destinataires(id bigint identité, demande_id bigint not null references demandes on delete cascade,
      fiche_id bigint references contacts on delete set null, stagiaire_id integer references stagiaires on delete cascade,
      nom text not null, principal boolean not null, annexe text check (annexe in ('formateur_du_jour','delegue')),
      relais_de text, non_prevenu text, lue_le timestamptz, lue_par text)` ; `principal = (annexe is null)`.
    - `demande_messages(id bigint identité, demande_id ... on delete cascade, auteur_email text, auteur_nom text not
      null, texte text check (char_length(texte) between 1 and 1000), reponse_id bigint, par_lien boolean not null default
      false, cree_le timestamptz not null default now())`, texte ou réponse toute faite (check).
    - `contact_regles(id bigint identité, lieu_id ... on delete cascade, type text not null check (type in ('absence',
      'retard','administratif','document','autre','defaut')), financement_id bigint references contact_financements on
      delete cascade, cible text not null check (cible in ('fiche','formateurs_du_jour','formateurs_promo')), fiche_id
      bigint references contacts on delete cascade)`, unique `(lieu_id, type, financement_id) nulls not distinct`,
      `cible = 'fiche'` exige `fiche_id`.
    - `contact_reponses(id bigint identité, lieu_id ... on delete cascade, libelle text check (char_length between 1 and
      80), vaut_prise boolean not null default true, demande_justificatif boolean not null default false, ordre integer,
      retire boolean not null default false)`, remplie pour chaque lieu et par le déclencheur `lieux_reponses_defaut` :
      « Bien reçu » ; « Absence enregistrée » ; « Absence enregistrée, pense à remettre ton justificatif »
      (`demande_justificatif`) ; « Merci de passer au secrétariat ».
    - `contact_envois(id bigint identité, demande_id ... on delete cascade, vers_fiche_id bigint, vers_stagiaire_id
      integer, evenement text not null check (evenement in ('nouvelle','reponse','prise','annulation','avis_absence',
      'annulation_absence','justificatif_recu')), etat text not null default 'a_envoyer' check (etat in ('a_envoyer',
      'en_cours','envoye','a_retenter','echec','ignore')), raison text, tentatives integer not null default 0,
      prochain_essai_le timestamptz, envoye_le timestamptz, cree_le timestamptz not null default now())`.
    - `contact_jetons(hash bytea primary key, envoi_id bigint references contact_envois on delete cascade, demande_id ...
      on delete cascade, fiche_id bigint not null, action text not null check (action in ('voir','prise','reponse',
      'justificatif')), reponse_id bigint, expire_le timestamptz not null, utilise_le timestamptz)`.
  - `public._contact_destinataires(p_lieu integer, p_promo integer, p_type text, p_financement bigint, p_jours jsonb)
    returns table(fiche_id bigint, nom text, relais_de text, source text)` : la chaîne C-8 ; `source` parmi `regle_type_financement`,
    `regle_type`, `defaut`, `formateurs_du_jour`, `formateurs_promo`, `direction` ; une fiche en congé ce jour passe à son
    relais (s'il est de ce centre et pas en congé), sinon au défaut, sinon aux formateurs de la promo ; retard sans règle :
    formateurs du jour (planning de `p_jours`), puis la chaîne ; aucun : zéro ligne.
  - `public.apercu_envoi(p_type text, p_jours jsonb default null) returns jsonb` : pour le stagiaire de la promo affichée,
    `{principaux: [{fiche_id, nom, relais_de}], rien_regle: boolean}` (sans rien écrire).
  - `public.ecrire_au_centre(p_type text, p_sujet text, p_texte text) returns bigint` (stagiaire ; type parmi
    `retard`, `administratif`, `document`, `autre` ; l'absence a sa fonction, partie C) ;
    `public.ecrire_a(p_fiche_id bigint, p_type text, p_sujet text, p_texte text) returns bigint` (stagiaire ou équipe :
    fiche du centre affiché ; type obligatoire pour un stagiaire, nul pour l'équipe) ;
    `public.ecrire_au_stagiaire(p_stagiaire_id integer, p_sujet text, p_texte text) returns bigint` (équipe dont la fiche
    est dans le centre de la promo du stagiaire). Chacune : destinataires, message initial, lignes d'envoi (`nouvelle`)
    dans la même transaction, `dernier_echange_le`, purge C-17.
  - Garde-fous : stagiaire = `_contact_stagiaire()` (fiche dans la promo affichée et compte sans affectation, ni
    `is_admin`, ni `is_founder` ; sinon `contact: Réservé aux stagiaires.` 42501) ; au plus 10 demandes créées par fiche et
    par jour de Paris (`contact: Tu as déjà envoyé 10 demandes aujourd'hui. Appelle le centre si c'est urgent.`) ; aucun
    destinataire : `contact: Personne ne peut recevoir ta demande dans ce centre : préviens ton formateur directement.`
    et rien n'est écrit ; un stagiaire vers un autre stagiaire : impossible par construction (aucune fonction ne le
    permet), prouvé.
  - `js/contact-rules.js` : `routerDemande({ type, financementId, jour, regles, fiches, formateursDuJour,
    formateursPromo, direction }) -> { principaux: [{ ficheId, relaisDe }], source }`, miroir exact de
    `_contact_destinataires`.

- [ ] **Step 1 : table de parité.** `tests/fixtures/contact-routage.json` : au moins `rien_regle`, `absence_cpf`,
  `absence_sans_financement`, `retard_formateurs_du_jour`, `retard_planning_vide`, `type_sans_regle_defaut`,
  `titulaire_en_conge_relais`, `relais_en_conge`, `relais_autre_centre`, `defaut_en_conge`, `promo_sans_formateur`
  (direction), `personne` (aucun). Chaque cas : entrées et `attendu: { principaux, source }`.
- [ ] **Step 2 : test node qui échoue** : chaque cas du fichier passé à `routerDemande` donne `attendu`. Run : `node
  tests/contact-rules.test.mjs`. Expected : FAIL.
- [ ] **Step 3 : `routerDemande`.** Run : même commande. Expected : PASS.
- [ ] **Step 4 : preuve, groupe `parite`** : l'assembleur remplace `-- @@CAS_ROUTAGE@@` par les cas du fichier
  (littéral jsonb) ; la preuve pose chaque cas en propriétaire (règles, congés, planning) et compare
  `_contact_destinataires` à `attendu`. Test de l'assembleur : le marqueur est remplacé par un littéral qui contient
  chaque nom de cas.
- [ ] **Step 5 : preuve, groupes `creer` et `garde_fous`** : `stag_n` écrit au centre sans aucune règle : destinataires
  = les fiches de `form_n` (formateur de la promo 1) ; `apercu_envoi('retard')` rend `rien_regle` vrai ; `stag_n` écrit à
  la fiche de `dir_n` : `OK`, une ligne d'envoi `nouvelle` ; à la fiche de `form_s` (autre centre) : refus ; `form_n`
  écrit à `stag_n` : `OK` ; `form_n` écrit à `stag_m` (Montpellier, où il n'a pas de fiche) : refus ; `fond` en aperçu
  stagiaire de la promo 1 : `contact: Réservé aux stagiaires.` ; onzième demande du jour : refus ; centre sans formateur,
  sans direction ni règle : refus et 0 ligne écrite dans les quatre tables ; `siege` : chaque fonction refuse.
- [ ] **Step 6 : contre-épreuve** (`contact-2-contre-epreuve`) : ROUGE sur `parite`, `creer`, `garde_fous`.
- [ ] **Step 7 : écrire la partie A et son retour ; vert.** `contact-2` : `VERT n/0`. Matrice du lot 4
  (`roles-preuve.sql`) : une ligne tout `false` par table nouvelle, `where to_regclass(...) is not null`.
- [ ] **Step 8 : commit** `Espace contact, migration 2 (A) : demandes, routage avec repli sûr, parité JS et SQL`.

### Task 9 : Lire, répondre, prendre en compte, annuler, régler le centre ; conservation (migration 2, partie B)

Modèle conseillé : opus (sécurité).

**Files:**
- Modify: `supabase/migrations/20261115_contact_2_demandes.sql`, `_retour.sql`, `tests/sql/contact-demandes-preuve.sql`

**Interfaces:**
- Consumes : partie A.
- Produces :
  - `public._contact_direction_reelle(l integer) returns boolean` (hors aperçu ; affectation `direction` de titre fixe sur
    l pour l'adresse du jeton ; ni fondateur ni siège).
  - `public._contact_lecteur(p_demande bigint) returns text` : `auteur`, `principal`, `annexe_formateur`, `delegue`,
    `direction` ou nul (l'ordre décide : un délégué qui est aussi auteur est `auteur`).
  - `public.liste_demandes(p_lieu_id integer default null) returns table(id bigint, type text, sujet text, etat text,
    auteur_nom text, cree_le timestamptz, dernier_echange_le timestamptz, non_lue boolean, mon_role text, a_traiter
    boolean, envoi_en_echec boolean)` : celles où l'appelant a un rôle ; avec `p_lieu_id` et
    `_contact_direction_reelle(p_lieu_id)` : toutes celles du centre ; un délégué ne voit que `type`, `auteur_nom` et les
    dates (les autres colonnes nulles).
  - `public.demande_detail(p_id bigint) returns jsonb` : `{demande, destinataires, messages, reponses_toutes_faites,
    envois: [{vers, etat}], peut: {repondre, prendre, annuler, justificatif}}` ; refus 42501 `contact: Demande
    introuvable.` sans rôle ; délégué : refus (sa version passe par `liste_demandes`). `envois` : à l'équipe seulement.
  - `public.marquer_lue(p_id bigint) returns void` (destinataire principal ou formateur annexe avec compte : `lue_le`,
    `lue_par` ; rien pour les autres) ; une réponse d'un autre remet `lue_le` à nul (C-15).
  - `public.repondre_demande(p_id bigint, p_texte text, p_reponse_id bigint default null) returns bigint` : auteur et
    principaux (et la direction réelle) ; texte ou réponse toute faite du centre ; une réponse `vaut_prise` passe la
    demande à `prise` ; `demande_justificatif` : effet en partie C ; envois `reponse` (et `prise`) aux autres
    participants, jamais aux annexes.
  - `public.prendre_en_compte(p_id bigint) returns void` ; `public.annuler_demande(p_id bigint) returns void` (auteur,
    demande non absence encore `envoyee` ; l'absence : partie C) ; `public.relancer_envoi(p_envoi_id bigint) returns void`
    (équipe qui lit la demande ; `echec` repasse à `a_envoyer`).
  - `user_profiles.alertes_email boolean not null default true` ; `public.regler_mes_alertes(p_actives boolean) returns
    boolean`.
  - `public.reglages_contact(p_lieu_id integer) returns jsonb` (`{regles, reponses, financements, fiches, rien_regle}`) et
    `public.regler_qui_recoit_quoi(p_lieu_id integer, p_regles jsonb) returns integer`,
    `public.regler_reponses(p_lieu_id integer, p_reponses jsonb) returns integer` : `geste_centre(p_lieu_id,
    'reglages.modifier')`, sinon 42501 `contact: Réservé aux réglages du centre.` ; une règle ne vise qu'une fiche de ce
    centre.
  - Conservation : déclencheur `stagiaires_contact_effacer` (after update of `efface_le`, de nul à une date) : supprime
    les demandes non absence dont la fiche est auteur ou destinataire, vide `texte` et supprime les messages des demandes
    d'absence (l'absence reste, partie C), supprime envois et jetons de ces demandes. Purge à l'écriture (C-17) dans
    chaque fonction qui crée : demandes sans stagiaire dont `dernier_echange_le` a plus de 12 mois ; envois de plus de 3
    mois ; jetons expirés. Aucune fonction `effacer_*` modifiée.

- [ ] **Step 1 : preuve, groupe `lire`** : la demande de `stag_n` à la fiche de `dir_n` : `liste_demandes()` la rend à
  `stag_n` et à `dir_n`, pas à `form_n` ; `liste_demandes(<Nîmes>)` par `dir_n` (direction réelle) la rend, et aussi une
  demande entre `form_n` et un collègue ; par `fond` (fondateur) : seulement celles où il a un rôle ; en aperçu direction :
  rien de plus ; par `t_secr` (titre de centre non fixe) : seulement les siennes ; `siege` : aucune ; `dir_s` (autre
  centre) : aucune ; `demande_detail` par `form_s` : `ERREUR 42501`.
- [ ] **Step 2 : preuve, groupe `etats`** : `marquer_lue` par `dir_n` pose `lue_par` ; par `stag_n` (auteur) : rien ;
  réponse « Absence enregistrée » : `etat = 'prise'`, une ligne d'envoi `prise` vers `stag_n` ; réponse libre de `stag_n` :
  `lue_le` de `dir_n` remis à nul, envoi `reponse` vers la fiche de `dir_n` ; `annuler_demande` par `dir_n` : refus ; par
  `stag_n` après prise : refus ; réponse toute faite d'un autre centre : refus ; texte de 1 001 caractères : refus.
- [ ] **Step 3 : preuve, groupe `reglages`** : `dir_n` règle « absence, CPF : fiche `sec_n` » : `OK` ; une fiche de
  Montpellier : refus ; `form_n` : `ERREUR 42501` ; `reglages_contact` dit `rien_regle` faux ensuite ; `regler_mes_alertes(false)`
  par `form_n` : les envois suivants vers lui naissent `ignore` avec `raison = 'alertes coupees'`.
- [ ] **Step 4 : preuve, groupe `conservation`** : `effacer_sur_demande(<fiche de stag_n>)` (fondateur) : ses demandes
  non absence disparaissent, leurs envois aussi ; une demande d'équipe de 13 mois (date posée en propriétaire) disparaît
  à la création suivante, une de 11 mois reste ; `stag_n` passé dans la promo 2 (en propriétaire) garde ses demandes,
  toujours lues par leurs destinataires de Nîmes (le centre d'une demande est celui de sa création) et par lui.
- [ ] **Step 5 : contre-épreuve** (`contact-2` avec la seule partie A) : ROUGE sur `lire`, `etats`, `reglages`,
  `conservation`.
- [ ] **Step 6 : écrire la partie B et son retour ; vert.** `contact-2` : `VERT n/0`. Sur la base avec 1 et 2 appliquées :
  `conservation-preuve.sql` VERTE au compte d'`avant-contact`, rôles `en-ligne` VERT.
- [ ] **Step 7 : commit** `Espace contact, migration 2 (B) : lectures par rôle, états, réponses toutes faites, réglages du centre, conservation`.

### Task 10 : Les envois : file, jetons, fonction serveur (migration 2, partie C)

Modèle conseillé : opus (fonction d'envoi).

**Files:**
- Modify: `supabase/migrations/20261115_contact_2_demandes.sql`, `_retour.sql`, `tests/sql/contact-demandes-preuve.sql`
- Create: `supabase/functions/contact-envois/index.ts`, `courriels.mjs`, `jetons.mjs`, `tests/contact-courriels.test.mjs`, `tests/contact-jetons.test.mjs`

**Interfaces:**
- Produces (base, exécution `service_role` seul) :
  - `public._contact_srv_prendre(p_limite integer default 20) returns jsonb` : passe à `en_cours` (verrou `for update skip
    locked`) les envois `a_envoyer`, les `a_retenter` échus et les `en_cours` de plus de 10 minutes (comptés comme une
    tentative) ; rend pour chacun `{envoi_id, evenement, demande: {id, type, auteur_nom, jours, quand, cree_le},
    destinataire: {email, nom, avec_compte, stagiaire}, reponses: [{id, libelle}]}` ; adresse : `compte_email` pour une
    fiche avec compte, `email` pour une sans compte, l'adresse du profil pour un stagiaire ; ni motif, ni sujet, ni texte.
    Adresse absente : `ignore`, `raison = 'sans adresse'` ; alertes coupées : `ignore` dès la création (Task 9).
  - `public._contact_srv_jetons(p_envoi_id bigint, p_jetons jsonb) returns void` : `[{hash (hex), action,
    reponse_id}]`, `expire_le = now() + interval '14 days'`.
  - `public._contact_srv_resultat(p_envoi_id bigint, p_issue text, p_raison text) returns void` : `p_issue` parmi
    `envoye`, `echec`, `ignore` ; `echec` : `a_retenter` (`prochain_essai_le = now() + interval '5 minutes'`) à la
    première tentative, `echec` ensuite ; `p_raison` tronquée à 200 caractères, jamais la clé.
  - `public._contact_srv_lien(p_hash bytea) returns jsonb` : jeton valide (non expiré) : la demande entière (motif et mot
    compris, messages compris), l'action du jeton, `deja` si l'action est faite ; sinon `{invalide: true}`.
  - `public._contact_srv_agir(p_hash bytea) returns jsonb` : fait l'action du jeton au nom de la fiche (`prise`, réponse
    toute faite, justificatif reçu en partie C) comme `repondre_demande` et `prendre_en_compte`, `par_lien` vrai ; une
    seconde fois : `{deja: true}`, rien d'écrit ; `voir` : refus.
- Produces (fonction serveur `contact-envois`, `POST` JSON, CORS comme `qcm-ia`) :
  - `{op: "traiter"}` (jeton d'un compte connecté) : `_contact_srv_prendre`, puis pour chaque envoi : adresse fictive
    (C5) : `_contact_srv_resultat(id, 'ignore', 'adresse fictive')` ; sinon jetons, e-mail, `fetch` Resend
    (`https://api.resend.com/emails`, `Authorization: Bearer <RESEND_API_KEY>`), résultat. Rend `{traites, envoyes,
    echecs, ignores}`.
  - `{op: "lien", jeton}` et `{op: "agir", jeton}` (clé publique seule, sans compte) : hache le jeton, appelle
    `_contact_srv_lien` ou `_contact_srv_agir`, puis traite les envois nés de l'action.
  - `{op: "etat"}` (fondateur hors aperçu : `est_fondateur()` par le jeton de l'appelant) : `{cle_presente: boolean,
    expediteur, app_url}` ; jamais la valeur de la clé.
  - Variables : `RESEND_API_KEY` (secret), `CONTACT_APP_URL` (défaut `https://watchi64.github.io/ecsr-promo/`),
    `CONTACT_EXPEDITEUR` (défaut `Promo ECSR <no-reply@timy-studio.fr>`).
  - `courriels.mjs` (pur) : `adresseFictive(email) -> boolean` ; `construireCourriel({ evenement, demande, destinataire,
    liens, appUrl }) -> { to, subject, html, text }` ; `liens` : `{ voir, prise, reponses: [{libelle, url}],
    justificatif }`, URL `${appUrl}demande.html#j=<jeton>` ; « Ouvrir dans l'app » : `${appUrl}#/messages/<id>` (équipe)
    ou `${appUrl}#/contacts/<id>` (stagiaire, seul bouton : C-12). Pied : « Les réponses passent par ces boutons ou par
    l'app, pour garder la trace. »
  - `jetons.mjs` (pur, crypto injectée) : `nouveauJeton(aleatoire) -> string` (32 octets, base64url) ;
    `hacherJeton(subtle, jeton) -> Promise<string>` (sha256, hex) ; `actionsDe(evenement, avecCompte) -> string[]`.

- [ ] **Step 1 : tests node qui échouent** :
  ```js
  test("aucune adresse fictive n'est tentée", () => {
    for (const a of ["a@demo.test", "b@exemple.invalid", "c@x.example", "d@example.com", "e@example.org", "f@example.net", "g@localhost"])
      assert.equal(adresseFictive(a), true, a);
    assert.equal(adresseFictive("secretariat@ecf-centre.fr"), false);
  });
  test("ni motif ni texte libre dans l'e-mail", () => {
    const c = construireCourriel({ evenement: "nouvelle", appUrl: "https://app.test/",
      demande: { id: 7, type: "absence", auteur_nom: "Lina B.", jours: [{ jour: "2026-11-19", demi: "matin" }], motif: "sante", texte: "rdv" },
      destinataire: { email: "x@ecf.fr", nom: "Sophie", avec_compte: false }, liens: { voir: "J1", prise: "J2", reponses: [] } });
    assert.match(c.subject, /Absence/); assert.match(c.text, /Lina B\./); assert.match(c.text, /jeudi 19 novembre, matin/);
    assert.doesNotMatch(c.html + c.text, /sante|Santé|rdv/);
    assert.match(c.html, /https:\/\/app\.test\/demande\.html#j=J2/);
  });
  test("un stagiaire n'a que « Ouvrir dans l'app »", () => { /* liens d'action absents, lien #/contacts/7 présent */ });
  test("le jeton fait 43 caractères base64url et son haché 64 hex", async () => { /* aleatoire et subtle injectés */ });
  ```
  Run : `node tests/contact-courriels.test.mjs && node tests/contact-jetons.test.mjs`. Expected : FAIL.
- [ ] **Step 2 : modules purs.** Expected : PASS.
- [ ] **Step 3 : preuve, groupes `envois` et `jetons`** (en `service_role` : `set local role service_role`) : une
  demande crée ses lignes `a_envoyer` ; `_contact_srv_prendre` les passe à `en_cours`, ne rend aucun motif (la clé `motif`
  absente du jsonb) ; deux échecs : `a_retenter` puis `echec`, et `liste_demandes` rend `envoi_en_echec` vrai à l'équipe ;
  `relancer_envoi` par `dir_n` : `a_envoyer` ; un `en_cours` de 11 minutes est repris ; un jeton `prise` posé :
  `_contact_srv_lien` rend la demande avec le motif ; `_contact_srv_agir` : `prise`, message `par_lien` ; second appel :
  `deja` ; jeton expiré (date posée) : `invalide` ; jeton `voir` : l'action refusée ; un jeton d'une autre demande ne
  touche pas celle-ci ; `authenticated` et `anon` n'exécutent aucune `_contact_srv_*` (`ERREUR 42501`).
- [ ] **Step 4 : contre-épreuve** (parties A et B seules) : ROUGE sur `envois`, `jetons`.
- [ ] **Step 5 : `index.ts`** : le seul code non testé par node (lecture des variables, client service, appel des
  modules purs, `fetch` Resend) ; relu ligne à ligne ; `deno check supabase/functions/contact-envois/index.ts` si Deno est
  installé, sinon le dire au rapport.
- [ ] **Step 6 : vert.** `contact-2` : `VERT n/0` ; `for f in tests/*.test.mjs; do node "$f"; done` : PASS.
- [ ] **Step 7 : commit** `Espace contact : file des envois, jetons hachés, fonction contact-envois (Resend), testée sans réseau`.

### Task 11 : Règles des demandes, lectures, page des liens

Modèle conseillé : sonnet.

**Files:**
- Modify: `js/contact-rules.js`, `tests/contact-rules.test.mjs`, `js/db.js` (bloc « Espace contact »), `scripts/cache-bust.js`, `tests/` (test du tampon de `demande.html`)
- Create: `js/lien-demande-rules.js`, `tests/lien-demande-rules.test.mjs`, `js/lien-demande.js`, `demande.html`

**Interfaces:**
- Produces :
  - `etapesDemande(detail) -> [{ cle: "envoyee"|"lue"|"prise"|"annulee", quand, par }]` ; « Lue » seulement si un
    principal a ouvert dans l'app.
  - `rangerDemandes(lignes, maintenant) -> { aTraiter, ouvertes, terminees }` : terminée = annulée, ou prise sans échange
    depuis 7 jours.
  - `libelleDestinataire(d) -> string` : « Claire, relais de Sophie », « Karim n'a pas pu être prévenu ».
  - `phraseRienRegle(espace)` : stagiaire « Ta demande ira aux formateurs de ta promo. » ; équipe « Rien n'est réglé :
    les demandes vont aux formateurs de la promo. »
  - `js/db.js` : `apercuEnvoi(type, jours)`, `ecrireAuCentre(...)`, `ecrireA(...)`, `ecrireAuStagiaire(...)`,
    `listeDemandes(lieuId)`, `detailDemande(id)`, `marquerLue(id)`, `repondre(id, texte, reponseId)`,
    `prendreEnCompte(id)`, `annulerDemande(id)`, `relancerEnvoi(id)`, `reglerMesAlertes(v)`, `reglagesContact(lieuId)`,
    `reglerQuiRecoitQuoi(lieuId, regles)`, `reglerReponses(lieuId, liste)`, `declencherEnvois()` (POST
    `${SUPABASE_URL}/functions/v1/contact-envois` `{op:"traiter"}` avec le jeton de session, sans attendre, erreur
    seulement journalisée ; appelé après chaque écriture ci-dessus).
  - `js/lien-demande-rules.js` : `jetonDeLAdresse(hash) -> string|null` (`#j=` et 43 caractères base64url) ;
    `etatDeLaPage(reponse) -> "invalide"|"a_confirmer"|"deja"|"fait"|"voir"` ; `libelleAction(action, reponse)`.
  - `demande.html` : même en-tête de sécurité qu'`index.html` (`connect-src` vers Supabase), `css/fonts.css`,
    `css/style.css`, `css/contact.css`, `js/lien-demande.js` ; aucun champ de texte. La page lit le jeton, appelle `lien`,
    montre la demande entière et un seul bouton « Confirmer : <action> » (44 px) ; après le toucher, `agir`, puis « C'est
    fait » ; jeton invalide ou expiré : « Ce lien n'est plus valable. Ouvrez la demande dans l'app ou demandez un nouvel
    envoi. »
  - `scripts/cache-bust.js` : `demande.html` tamponné comme `index.html`.

- [ ] **Step 1 : tests qui échouent** (`contact-rules`, `lien-demande-rules`) : « Lue » absente pour une personne sans
  compte ; une demande prise il y a 8 jours sans échange est terminée, il y a 6 jours ouverte ; `jetonDeLAdresse("#j=abc")`
  nul ; l'ouverture de la page avec un jeton valide rend `a_confirmer` (jamais `fait` sans toucher) ; `deja` après une
  action faite ; `phraseRienRegle("stagiaire")` vaut « Ta demande ira aux formateurs de ta promo. » et l'encadré
  « Sera envoyé à » la montre quand `apercuEnvoi` rend `rien_regle` vrai (Review Focus 1). Run : les deux tests.
  Expected : FAIL.
- [ ] **Step 2 : implémenter**, puis le test du tampon : `node scripts/cache-bust.js 20991231a` sur une copie dans un
  dossier temporaire tamponne `demande.html`. Expected : PASS.
- [ ] **Step 3 : commit** `Espace contact : règles des demandes, appels de la base, page statique des liens d'e-mail`.

### Task 12 : Écrans des demandes (Messages, suivi, écrire, Qui reçoit quoi)

Modèle conseillé : sonnet.

**Files:**
- Create: `js/views/messages.js`, `js/views/demande.js`, `js/views/reglages-contact.js`
- Modify: `js/views/contacts.js` (« Écrire au centre », « Écrire », « Mes demandes »), `js/main.js` (routes `messages`, `messages/<id>`, `contacts/<id>`), `js/nav-rules.js`, `tests/nav-rules.test.mjs`, `js/views/reglages-habillage.js` (sections « Qui reçoit quoi » et « Réponses toutes faites »), `js/views/ma-fiche-contact.js` (« Alertes par e-mail »), `css/contact.css`

**Interfaces:**
- Produces :
  - `ENTREES_EQUIPE` : `entree("messages", "Messages", "inbox")` juste après `home` ; `ENTREES_DIRECTION` : même entrée
    juste après `centre` ; `BARRE_TELEPHONE_EQUIPE` et `BARRE_TELEPHONE_DIRECTION` **inchangées** (Messages passe dans
    « Plus » sur téléphone, avec le compteur repris sur « Plus ») ; aucune condition (pas de module). **Place proposée, à
    montrer à Timy** (captures téléphone et ordinateur, question Q1) avant la fusion.
  - Compteur : `compterNonLues(lignes) -> number` (`js/contact-rules.js`, testé), affiché sur l'entrée.

- [ ] **Step 1 : tests de navigation qui échouent** : `entreesNavigation("equipe", ...)` a `messages` en deuxième ;
  `barreTelephone("equipe", ...)` met `messages` dans `plus` ; `entreeActive("messages", ...)` vaut `"messages"`.
  Expected : FAIL, puis PASS après l'ajout.
- [ ] **Step 2 : Contacts (stagiaire).** En tête : « Écrire au centre » (et, tâche 15, « Prévenir d'une absence » en
  bouton principal) ; « Mes demandes » (les ouvertes, puis « Terminées » repliées) ; « Écrire » sur chaque fiche. Le
  formulaire : type (Retard, Question administrative, Document, Autre), sujet, texte ; encadré « Sera envoyé à » rempli
  par `apercuEnvoi` (avec `phraseRienRegle` quand la base le dit) ; « Envoyer », puis le suivi.
- [ ] **Step 3 : suivi d'une demande** (`js/views/demande.js`, route `#/contacts/<id>` et `#/messages/<id>`) : étapes
  avec nom et heure, destinataires (`libelleDestinataire`), réponses, réponses toutes faites en boutons, « Répondre »,
  « Pris en compte », « Annuler » (par `confirmer`), « e-mail non parti » et « Relancer l'envoi » pour l'équipe. Ouvrir la
  demande appelle `marquerLue`.
- [ ] **Step 4 : Messages** (équipe et direction) : « À traiter », « Ouvertes », « Terminées » ; « Écrire à un
  stagiaire » et « Écrire à un collègue » ; à l'ouverture, `declencherEnvois()`.
- [ ] **Step 5 : Réglages du centre** : « Qui reçoit quoi » (une ligne par type, une colonne par financement pour les
  types qui en dépendent, la personne par défaut) ; tant que rien n'est réglé, la phrase de `phraseRienRegle("equipe")`
  en tête ; sous la grille, l'aperçu calculé par `routerDemande` (« Absence, CPF : Sophie ») ; « Réponses toutes faites »
  (libellé, « vaut prise en compte », « demande le justificatif », retirer). Mes préférences : « Recevoir les alertes par
  e-mail » (case, `reglerMesAlertes`).
- [ ] **Step 6 : vérification** : `for f in tests/*.test.mjs; do node "$f"; done` ; aucun `confirm(` ni `color-mix` ajouté
  (`git diff main -- js css | grep -n "confirm(\|color-mix"` ne rend que des lignes retirées). Expected : PASS.
- [ ] **Step 7 : commit** `Espace contact : Messages, suivi d'une demande, écrire au centre et à une fiche, Qui reçoit quoi`.

### Task 13 : Fiches fictives de démonstration, banc, robot et vérificateur des demandes

Modèle conseillé : sonnet.

**Files:**
- Create: `supabase/migrations/20261115_contact_demo.sql`, `_retour.sql`
- Modify: `_harness_supabase.js`, `_harness_build.mjs` (hors git), `outils/parcours/contact.py`, `outils/parcours/navigation.py`, `outils/verifier_navigation.py`

**Interfaces:**
- Produces :
  - Migration `_demo` : complète les deux fiches fictives du centre de démonstration (`pour_quoi`, `quand`) et ajoute
    « Responsable pédagogique (fictif) », `responsable@demo.test`, `01 99 00 00 03`, relais de « Accueil du centre ». Rien
    d'autre (ni règle, ni réglage). Garde : migration 1 appliquée, un lieu `demonstration`, ses deux fiches fictives
    présentes, la troisième absente. Retour : la troisième supprimée, les deux autres remises à `pour_quoi` et `quand`
    nuls.
  - Banc : `rpcContactBanc` étendu aux fonctions de la partie B ; faux `/functions/v1/contact-envois` (`traiter` rend des
    comptes, `lien` et `agir` répondent selon le jeton `banc-valide`, `banc-deja`, `banc-expire`) ; `_harness_build.mjs`
    produit aussi `_harness_demande.html` depuis `demande.html` (faux client chargé avant `js/lien-demande.js`).

- [ ] **Step 1 : migration `_demo`** jouée sur la base locale après la 1 et la 2, puis son retour : rien ne reste
  (empreinte des fiches du centre de démonstration égale à l'avant).
- [ ] **Step 2 : banc**, reconstruit (`node _harness_build.mjs`, contrôle du jeton).
- [ ] **Step 3 : parcours** : `ecrire-au-centre` (stagiaire : « Sera envoyé à », envoi, suivi « Envoyée ») ;
  `destinataire-avec-compte` (formateur : Messages, ouvre, « Absence enregistrée », l'état passe à « Prise en compte ») ;
  `page-du-lien` (`_harness_demande.html#j=banc-valide` : la demande avec motif, un seul bouton, « C'est fait » ;
  `banc-deja` : « Déjà fait » ; `banc-expire` : la phrase) ; `messages-direction` ; `autre-centre` (formateur de la promo
  7 : aucune demande de Nîmes) ; `rien-regle` (Réglages du centre : la phrase en tête). Chaque parcours au robot puis
  au vérificateur.
- [ ] **Step 4 : vérificateur**, attendus à ajouter : entrée « Messages » de l'équipe et de la direction (place, dans
  « Plus » sur téléphone), page Messages sans défilement horizontal à 375 px, `#/messages/<id>` allume Messages. Run :
  `python outils/verifier_navigation.py`. Expected : code 0.
- [ ] **Step 5 : commit** `Espace contact : fiches fictives de démonstration, demandes au banc, au robot et au vérificateur`.

---

## Partie C : les absences

État testable en fin de partie : base locale avec les migrations 1 à 3 ; un stagiaire prévient d'une absence en moins
d'une minute ; formateurs du jour et délégué prévenus ; planning et émargement à jour ; justificatif jusqu'à « reçu ».

### Task 14 : L'absence annoncée (migration 3)

Modèle conseillé : opus (sécurité).

**Files:**
- Create: `supabase/migrations/20261115_contact_3_absences.sql`, `_retour.sql`
- Modify: `tests/sql/contact-absences-preuve.sql`, `tests/sql/roles-preuve.sql`

**Interfaces:**
- Consumes : migrations 1 et 2 ; `emargement_seances`, `emargement_lignes`, `planning_entries`, `planning_half_meta`,
  `stagiaires.delegue`.
- Produces :
  - `absences_annoncees(demande_id bigint primary key references demandes on delete cascade, stagiaire_id integer not
    null references stagiaires on delete cascade, promo_id integer not null, du date not null, au date not null, quand
    text not null check (quand in ('journee','matin','aprem','heures')), heure_debut text, heure_fin text, motif text check
    (motif in ('sante','transport','demarche','famille','autre')), justificatif text check (justificatif in
    ('a_remettre','recu')), justificatif_le timestamptz, annexes_decochees text[] not null default '{}')` ; `heures` exige
    `du = au` et `heure_debut < heure_fin` (`HH:MM`) ; `au - du <= 30` ; RLS active, aucun droit.
  - `public.prevenir_absence(p_du date, p_au date, p_quand text, p_debut text, p_fin text, p_motif text, p_mot text,
    p_sans text[] default '{}') returns bigint` : `_contact_stagiaire()` ; `p_du` au plus tôt aujourd'hui (Paris :
    `contact: Une absence passée se règle avec l'équipe.`) ; mot de 200 caractères au plus ; garde des 10 par jour ;
    principaux par `_contact_destinataires(..., 'absence', financement, jours)` ; annexes : formateurs du jour des
    demi-journées couvertes (fiches rattachées à `profs` ; `prof_autre` ou ligne `profs` sans fiche : `non_prevenu` avec le
    nom) et délégués de la promo avec compte (titulaire, suppléant, jamais l'auteur), moins `p_sans` (`'formateurs'`,
    `'delegue'`) ; envois `nouvelle` aux principaux, `avis_absence` aux annexes ; rend l'identifiant.
  - `public.apercu_envoi` étendu : pour `absence`, `{principaux, annexes: {formateurs: [...], non_prevenus: [...],
    delegues: [...]}, rien_regle}`.
  - Annulation : `annuler_demande` étendue à l'absence : l'auteur tant que la première demi-journée n'a pas commencé
    (C-13 ; `contact: L'absence a commencé : demande à l'équipe de la corriger.`) ; après : principaux, direction réelle,
    `geste_promo(promo, 'planning.modifier')` ; envois `annulation` et `annulation_absence`.
  - `public.regler_justificatif(p_id bigint, p_etat text) returns void` (`a_remettre`, `recu`, nul) : principaux,
    direction réelle, formateurs de la promo ; envoi `justificatif_recu` au stagiaire ; une réponse toute faite
    `demande_justificatif` pose `a_remettre` ; l'action `justificatif` d'un jeton pose `recu`.
  - `public.mes_justificatifs_a_remettre() returns table(demande_id bigint, du date, au date, quand text)`.
  - `public.absences_annoncees_semaine(p_lundi date) returns table(stagiaire_id integer, day_index integer, half_day
    text, entiere boolean, debut text, fin text)` : promo affichée, `membre_stagiaire` ou `planning.lire` ; jamais le
    motif ; absences annulées exclues.
  - `liste_demandes` pour un délégué : nom du stagiaire, jours et demi-journées, rien d'autre (prouvé).
  - Émargement : la contrainte `emargement_lignes_absence_origine_check` devient `absence_origine in ('formateur',
    'planning', 'non_signe', 'annoncee')` (garde : le nom existe et le texte est celui du 23/10). Déclencheurs :
    `emargement_seances_annoncees` (after insert on `emargement_seances`) et `absences_annoncees_emargement` (after insert
    or update on `absences_annoncees`, et after update of `etat` on `demandes`) appellent `_contact_premarquer(p_seance
    bigint)` : pour chaque absence non annulée qui couvre la demi-journée entière (journée, matin, après-midi), une ligne
    sans signature passe absente, origine `annoncee`, observation « Absence prévenue » ou « Absence justifiée » (si
    `recu`) ; une absence de quelques heures : seulement l'observation « Absent de 10 h à 11 h, prévenu » (aucune
    absence posée) ; une absence annulée : les lignes `annoncee` sans signature redeviennent présentes (observation
    retirée si c'est la nôtre). Une ligne signée n'est jamais touchée ; une observation écrite par un formateur n'est jamais
    remplacée. `emargement_ouvrir`, `_clore`, `_rouvrir` et `_annoter` ne changent pas.
  - Conservation : `stagiaires_contact_effacer` (Task 9) garde la ligne d'absence ; nouveau déclencheur
    `stagiaires_contact_anonymiser` (after update of `anonymise_le`, de nul à une date) : `motif` nul.

- [ ] **Step 1 : preuve, groupe `prevenir`** (jour de Paris lu comme la conservation, réglage `preuve.jour` remplacé dans
  une sous-transaction si besoin) : `stag_n` prévient pour demain matin : `OK`, principaux = formateurs de la promo (rien
  réglé), annexes = fiche de `form_n` si le planning de demain le porte, délégué titulaire avec compte ; `p_sans
  '{delegue}'` : pas d'envoi au délégué, l'absence existe quand même ; hier : refus ; « heures » sur deux jours : refus ;
  motif inconnu : refus ; `prof_autre = 'Karim (fictif)'` au planning : `non_prevenu` porte ce nom.
- [ ] **Step 2 : preuve, groupe `delegue`** : le délégué lit, par `liste_demandes`, le nom, le jour, la demi-journée ;
  `demande_detail` : `ERREUR 42501` ; aucune colonne de ses lignes ne contient `sante` (balayage du jsonb rendu).
- [ ] **Step 3 : preuve, groupe `annuler`** : avant 09:00 le jour même (jour et heure posés) : `stag_n` annule ; après
  09:00 : refus ; `form_n` annule après : `OK` ; envois `annulation_absence` aux annexes.
- [ ] **Step 4 : preuve, groupe `emargement`** : feuille ouverte par `form_n` (`emargement_ouvrir`, émargement allumé en
  propriétaire) : `stag_n` absent, origine `annoncee`, « Absence prévenue » ; `stag_n` tente de signer : refus d'origine
  (« Noté absent ») ; justificatif `recu` : « Absence justifiée » ; absence de 10:00 à 11:00 : ligne non absente,
  observation « Absent de 10 h à 11 h, prévenu », `stag_n` signe ; une absence annoncée **après** l'ouverture : ligne
  marquée à l'instant ; annulée par `form_n` : ligne remise, sans toucher une signature ; `emargement_clore` puis
  `emargement_rouvrir` : la ligne `annoncee` reste ; observation écrite par le formateur avant : gardée.
- [ ] **Step 5 : preuve, groupe `planning`** : `absences_annoncees_semaine(<lundi>)` par `stag_m` sous l'en-tête 2 : rien
  de la promo 1 ; par un stagiaire de la promo 1 : la ligne, sans motif ; par `t_rh` : 0 ligne.
- [ ] **Step 6 : contre-épreuve** (`contact-3-contre-epreuve`) : ROUGE sur chaque groupe.
- [ ] **Step 7 : écrire la migration et son retour ; vert.** `contact-3` : `VERT n/0`. Sur la base avec 1, 2, 3
  appliquées : `tests/sql/emargement-preuve.sql` VERTE au compte d'`avant-contact`, conservation VERTE, rôles `en-ligne`
  VERT (ligne `absences_annoncees` tout `false`), autonomie VERTE.
- [ ] **Step 8 : commit** `Espace contact, migration 3 : absence annoncée, envois annexes, annulation, justificatif, planning et émargement`.

### Task 15 : Prévenir d'une absence (règles, formulaire, accueil, suivi)

Modèle conseillé : sonnet.

**Files:**
- Create: `js/contact-absences-rules.js`, `tests/contact-absences-rules.test.mjs`, `js/views/prevenir-absence.js`
- Modify: `js/db.js`, `js/views/contacts.js`, `js/views/demande.js`, `js/views/accueil-stagiaire.js`, `js/accueil-rules.js` (`aFaireStagiaire` : `justificatifs`), `tests/accueil-rules.test.mjs`, `js/main.js` (route `absence`), `css/contact.css`

**Interfaces:**
- Produces :
  - `demiJourneesDe({ du, au, quand, debut, fin }) -> [{ jour, demi, entiere, debut, fin }]` (jours ouvrés seulement,
    `heures` : la demi-journée de l'heure de début, `entiere` faux).
  - `premarquage(absence) -> "absent"|"observation"` (journée, matin, après-midi : `absent` ; heures : `observation`).
  - `annulablePar({ absence, maintenant, metas, espace }) -> boolean` (C-13 ; même règle que la base, testée sur les
    mêmes bornes que la preuve : 08:59 vrai, 09:00 faux).
  - `phraseCasesDecochees(sans) -> string|null` : « Ils ne seront pas prévenus, mais l'absence apparaîtra au planning. »
  - `mailtoJustificatif({ email, du, au, quand }) -> string|null` : objet « Justificatif : absence du jeudi 14 novembre,
    matin », deux lignes de corps ; nul sans adresse (C-18).
  - `libelleAbsence({ du, au, quand, debut, fin }) -> string` : « jeudi 14 novembre, matin », « du 14 au 16 novembre »,
    « jeudi 14 novembre, de 10 h à 11 h ».
  - `js/db.js` : `apercuAbsence(champs)`, `prevenirAbsence(champs)`, `reglerJustificatif(id, etat)`,
    `mesJustificatifsARemettre()`, `absencesAnnonceesSemaine(lundi)`.

- [ ] **Step 1 : tests qui échouent** : « Journée » du jeudi au lundi donne 6 demi-journées (week-end exclu) ; `heures`
  10:00 à 11:00 donne 1 demi-journée `matin`, `entiere` faux, `premarquage` = `observation` ; `annulablePar` à 08:59 et
  09:00 ; `mailtoJustificatif` encode l'objet (`%20`, `%C3%A9`) ; `aFaireStagiaire({ justificatifs: [...] })` ajoute
  « Remets ton justificatif (absence du jeudi 14 novembre, matin) ». Run : les deux tests. Expected : FAIL, puis PASS.
- [ ] **Step 2 : le formulaire** (maquette 2) : « Quel jour » (Aujourd'hui, Demain, Choisir ; « jusqu'au » facultatif),
  « Quand » (Journée, Matin, Après-midi, De ... à ...), « Motif » (Santé, Transport, Démarche, Famille, Autre ; aucune
  précision médicale demandée), « Un mot » (facultatif, 200 caractères), encadré « Sera envoyé à » (principal sans case,
  formateurs du jour et délégué avec case cochée d'office, phrase quand une case est décochée, noms non prévenus),
  « Envoyer », puis le suivi. Bouton principal « Prévenir d'une absence » sur l'Accueil (au-dessus des cartes) et en tête
  de Contacts.
- [ ] **Step 3 : suivi d'une absence** : l'état du justificatif, « Envoyer mon justificatif » (`mailto`, ou la phrase
  C-18), « Annuler » tant que `annulablePar` ; équipe : « Justificatif à remettre », « Justificatif reçu ».
- [ ] **Step 4 : vérification** : `for f in tests/*.test.mjs; do node "$f"; done`. Expected : PASS.
- [ ] **Step 5 : commit** `Espace contact : prévenir d'une absence, rappel du justificatif sur l'Accueil, suivi`.

### Task 16 : L'absence annoncée au planning, à l'émargement et dans les attestations

Modèle conseillé : sonnet.

**Files:**
- Modify: `js/views/planning.js` (chargement de la semaine, `personSelect`, `chipsSelect`, cartes), `js/views/planning-grille.js`, `js/emargement-rules.js` (`LIBELLE_ABSENCE`), `js/emargement-feuilles.js`, `js/attestations-rules.js` (`LIBELLE_ORIGINE`), `tests/emargement-rules.test.mjs`, `tests/attestations-rules.test.mjs`, `tests/qualiopi-presence.test.mjs` si un attendu énumère les origines, `js/contact-absences-rules.js`, `tests/contact-absences-rules.test.mjs`

**Interfaces:**
- Consumes : `absencesAnnonceesSemaine(lundi)` (Task 15).
- Produces :
  - `marqueAbsence(absences, { day_index, half_day }, sid, espace) -> string|null` : équipe « absent, prévenu » ou
    « absent de 10 h à 11 h » ; stagiaire « absent » ; rien d'autre (jamais le motif).
  - `LIBELLE_ABSENCE.annoncee = "Absent (prévenu)"` ; `LIBELLE_ORIGINE.annoncee = "absence prévenue"`.

- [ ] **Step 1 : tests qui échouent** : `etatLigne({ ligne: { absent: true, absence_origine: "annoncee" } }).libelle`
  vaut « Absent (prévenu) » ; l'attestation d'une demi-journée `annoncee` la compte absente et l'étiquette « absence
  prévenue » ; `marqueAbsence` partielle chez l'équipe. Run : les tests concernés. Expected : FAIL.
- [ ] **Step 2 : implémenter.** Planning : la semaine lit `absencesAnnonceesSemaine` avec ses entrées ; le stagiaire
  porte sa marque dans les listes de placement et sur sa carte ; **aucun passage ni placement ne change** ; une lecture
  ratée laisse le planning comme aujourd'hui (la marque manque, rien ne casse).
- [ ] **Step 3 : vérification** : `for f in tests/*.test.mjs; do node "$f"; done` ; preuves `emargement` et
  `conservation` rejouées sur la base avec 1 à 3 : VERTES (comptes d'`avant-contact`). Expected : PASS, VERT.
- [ ] **Step 4 : commit** `Espace contact : absence annoncée au planning, à l'émargement et dans les attestations`.

### Task 17 : Parcours des absences, vérificateur, Nouveautés et guide

Modèle conseillé : sonnet.

**Files:**
- Modify: `_harness_supabase.js` (hors git), `outils/parcours/contact.py`, `outils/verifier_navigation.py`, `js/nouveautes-data.js`, `supabase/functions/chatbot/aide.mjs`, `tests/chatbot-aide.test.mjs`

- [ ] **Step 1 : banc** : fonctions de la partie C dans `rpcContactBanc` ; levier `?absence=annoncee` (une absence de
  Camille au planning et à la feuille du jour du banc).
- [ ] **Step 2 : parcours** (spec § 15) : `absence-complete` (stagiaire : Accueil, « Prévenir d'une absence », demain
  matin, Santé, envoi, suivi, puis, jeu de données du banc, « Justificatif reçu » vu dans le suivi et rappel retiré de
  l'Accueil ; budget 6 au téléphone) ; `absence-cases-decochees` (la phrase s'affiche) ; `formateur-du-jour` (Messages :
  l'avis avec le motif) ; `delegue` (Contacts : l'avis sans motif) ; `absence-planning` (équipe : « absent, prévenu »
  sur la carte ; stagiaire : « absent ») ; `absence-emargement` (feuille : « Absent (prévenu) ») ; `absence-annulee`.
  Chacun en ordinateur et téléphone, Chromium et WebKit.
- [ ] **Step 3 : vérificateur** : bouton « Prévenir d'une absence » de l'Accueil du stagiaire (44 px, visible sans
  défiler à 375 px). Run : `python outils/verifier_navigation.py`. Expected : code 0.
- [ ] **Step 4 : Nouveautés** (à la date de mise en ligne, la décision du 14/11 les rend nécessaires) :
  - `pour: "stagiaires"`, titre « Préviens d'une absence en une minute » ; résumé : « Sur l'Accueil, “Prévenir d'une
    absence” : choisis le jour, le moment et le motif, l'app l'envoie à la bonne personne du centre et te dit à qui. Tu
    vois quand c'est lu, puis pris en compte. Tes formateurs du jour et ton délégué sont prévenus, sauf si tu décoches ;
    l'absence apparaît d'elle-même au planning et sur la feuille d'émargement. Ton justificatif ne passe pas par l'app :
    le bouton “Envoyer mon justificatif” prépare l'e-mail. Pour une autre question, “Écrire au centre” dans Contacts. » ;
    `ou: { label: "Contacts", route: "contacts" }`.
  - `pour: "formateurs"`, titre « Messages : les demandes des stagiaires, avec un état » ; résumé : « La nouvelle entrée
    Messages réunit les demandes qui vous sont adressées (absences, retards, questions), “À traiter” d'abord. Vous
    répondez en un geste avec les réponses toutes faites, depuis l'app ou depuis l'e-mail reçu. Une absence annoncée est
    marquée “absent, prévenu” au planning et pré-remplie sur la feuille d'émargement ; vous décidez comme avant du passage
    et de la feuille. Tant que “Qui reçoit quoi” n'est pas réglé, les demandes vont aux formateurs de la promo. » ;
    `ou: { label: "Messages", route: "messages" }`.
  - `pour: "direction"`, même titre ; résumé : celui des formateurs, plus « Vous lisez toutes les demandes de votre
    centre, et vous réglez “Qui reçoit quoi” et les réponses toutes faites dans Réglages du centre. » ; `ou: { label:
    "Réglages du centre", route: "config" }`.
- [ ] **Step 5 : guide** (`aide.mjs`) : Contacts (Mes demandes, Écrire au centre), Prévenir d'une absence (Accueil),
  Messages (équipe et direction, place dans la barre et dans « Plus »), page d'un lien d'e-mail, justificatif hors de
  l'app, réglages du centre. Run : `node tests/chatbot-aide.test.mjs`. Expected : PASS. Le redéploiement de l'assistant
  reste à la coordination (dossier).
- [ ] **Step 6 : commit** `Espace contact : absences au banc, au robot et au vérificateur ; Nouveautés et guide`.

---

## Fin

### Task 18 : Textes des données personnelles (conditions et registre), sans toucher `js/legal-data.js`

Modèle conseillé : sonnet.

**Files:**
- Create: `docs/superpowers/plans/2026-11-14-espace-contact-textes-donnees.md`

- [ ] **Step 1 : écrire le document** sur le modèle de `docs/superpowers/specs/2026-11-12-e-learning-textes-donnees.md`,
  chaque passage avec l'endroit exact où il s'insère dans `CONDITIONS_MD` (citer la ligne voisine mot à mot) :
  - L'essentiel : la ligne 2 cite « téléphone (facultatif), financement, demandes et absences annoncées » ; la ligne
    des prestataires (ligne 5) ne change pas ; ligne 7 : « les demandes et leurs messages » parmi les textes libres.
  - § 3 : la ligne « Profil » gagne « téléphone (facultatif), financement de la formation, délégué de la promo » ; ligne
    nouvelle après « Suivi » : « Demandes et messages | Les demandes que vous adressez au centre ou qu'il vous adresse
    (type, sujet, messages, état : envoyée, lue, prise en compte), et pour une absence annoncée : les jours, le moment, le
    motif choisi dans une liste (santé, transport, démarche, famille, autre), un mot facultatif et l'état du justificatif.
    Aucun document ni certificat ne passe par l'application. »
  - § 4 : lignes nouvelles « Téléphone, e-mail et financement d'un stagiaire | Oui | Non | Oui | Oui | Non », « Demandes
    et messages | Oui, les vôtres | Non | Oui, celles qui leur sont adressées | Oui, toutes celles du centre | Non »,
    « Absence annoncée (sans motif) | Oui | Votre délégué : nom, jour et moment seulement ; les autres : “absent” au
    planning | Oui, avec le motif pour les destinataires | Oui | Non » ; paragraphe « Demandes et absences annoncées »
    (le routage, le délégué sans motif, la lecture « Lue » dans l'app seulement, aucun pixel espion) ; le paragraphe
    « Absences » existant : « L'application ne prévoit aucun champ pour le motif d'une absence » devient vrai seulement
    pour les passages et l'émargement : réécriture proposée mot à mot.
  - § 5 : « Organiser la formation et joindre les personnes : annuaire de l'équipe, demandes, absences annoncées, alertes
    par e-mail | Intérêt légitime de l'organisme de formation à organiser la formation et à joindre les personnes » ; la
    ligne « Envoyer les e-mails du compte » gagne « et les alertes des demandes ».
  - § 7 : titre « Les personnes sans compte : élèves bénévoles, auto-écoles partenaires, personnes de l'équipe sans
    compte » et un paragraphe sur les fiches de l'équipe sans compte (nom, titre, e-mail et téléphone professionnels,
    pour quoi et quand la joindre ; visibles des stagiaires et de l'équipe du centre ; supprimées au départ de la personne
    ou sur demande, C-16).
  - § 8 : Resend « Envoi des e-mails du compte et des alertes des demandes | L'adresse e-mail du destinataire et le
    contenu de l'e-mail : type de demande, nom du stagiaire, jour et moment, jamais le motif ni un message » ; Supabase :
    « la fonction d'envoi des alertes » ajoutée.
  - § 10 : lignes « Demandes et messages | Toute la formation, puis douze mois ; entre membres de l'équipe : douze mois
    après le dernier échange », « Absence annoncée (jours, moment, motif, justificatif) | comme les preuves de la
    formation (trois ans, puis rendue anonyme : le motif est effacé) », « Liens des e-mails et journal des envois |
    quatorze jours pour un lien, trois mois pour le journal », « Fiches de l'équipe sans compte | jusqu'au départ de la
    personne ou sur demande », « Téléphone et financement d'un stagiaire | comme le compte ».
  - § 15 : « pour les formateurs : n'écrire dans les réponses aucune information de santé ».
  - Registre des traitements : section « Demandes et absences » (finalité, base légale, données, destinataires dont
    Resend, durées, sécurité : fonctions de la base seulement, preuves `contact-*-preuve.sql`) ; actions de mise en
    conformité : information des équipes avant la fusion (fiches d'office), clé Resend « envoi seul ».
  - En tête : « Version regroupée avec l'étape 4 des titres (une seule acceptation) ; la mise en ligne de l'espace
    contact ne précède pas la publication de cette version » (décision du 14/11).
- [ ] **Step 2 : contrôle** : aucun tiret cadratin ; chaque phrase correspond à une règle d'une tâche (table de
  correspondance en fin de document).
- [ ] **Step 3 : commit** `Espace contact : textes des données personnelles, prêts pour la version regroupée`.

### Task 19 : Répétition complète et dossier pour la coordination

Modèle conseillé : sonnet.

**Files:**
- Create: `docs/superpowers/plans/2026-11-14-espace-contact-dossier.md`

- [ ] **Step 1 : répétition locale.** `reconstruire.sh --port 55460`, `rejouer_suite.sh --port 55460 --titres 1,2,3,5,6
  --autonomie` ; `contact-1`, `contact-2`, `contact-3` assemblés et joués : `VERT n/0` (md5 notés) ; application réelle
  (`psql -1 -v ON_ERROR_STOP=1 -f`) de 1, 2, 3, `_demo` ; `contact-1-en-ligne`, `-2-en-ligne`, `-3-en-ligne` : VERT ;
  rôles, titres, gestion, espaces, données, profils, émargement, conservation, autonomie en ligne : VERTS, comptes égaux à
  `avant-contact` sauf les lignes annoncées (matrice) ; retours `_demo`, 3, 2, 1 réels : verdicts égaux à `avant-contact`.
- [ ] **Step 2 : app.** `for f in tests/*.test.mjs; do node "$f"; done` ; `python outils/robot_parcours.py --habillages
  ecsr,ecf` ; `python outils/verifier_navigation.py`. Expected : PASS, code 0, code 0.
- [ ] **Step 3 : le dossier** (`2026-11-14-espace-contact-dossier.md`), à exécuter par la coordination, rien par l'agent :
  1. **Préalables** : version regroupée des conditions prête (tâche 18 et étape 4 des titres) et publiée au plus tard dans
     la même fusion ; captures de « Messages » montrées à Timy (Q1) ; « Qui reçoit quoi » de Nîmes réglé ou laissé au
     défaut sûr (le dire à Timy) ; équipes informées que leur fiche est créée d'office.
  2. **Fonction** : `supabase functions deploy contact-envois` ; variables `CONTACT_APP_URL` (adresse de l'hébergement du
     jour : Pages, ou Scaleway après la bascule) et `CONTACT_EXPEDITEUR` ; `RESEND_API_KEY` déjà posée par Timy : contrôle
     par `{op:"etat"}` appelé par le fondateur (`cle_presente: true`, valeur jamais affichée).
  3. **Essai à blanc en production** (accord de Timy) : `contact-1`, `-2`, `-3` assemblés en `--compact`, joués par
     `outils/psql_prod.sh` : `VERT n/0`, md5 égaux aux locaux.
  4. **Recette par un vrai e-mail, AVANT la fusion** (spec § 15, décision du 14/11) : sur une base de recette ou, à
     défaut, en production juste après l'application des migrations et avant la fusion de l'app (aucun écran ne permet
     alors d'écrire), une demande créée en propriétaire vers une fiche de test sans compte à l'adresse de test choisie
     par Timy (Q6), puis `{op:"traiter"}` : e-mail reçu, expéditeur, objet sans motif, liens inspectés (fragment `#j=`,
     page `demande.html` servie, toucher de confirmation, « Déjà fait » au second), puis la demande et la fiche de test
     supprimées. L'adresse de test n'entre jamais dans le dépôt.
  5. **Application** (accord de Timy), dans l'ordre : `20261115_contact_1_annuaire`, `_2_demandes`, `_3_absences`,
     `20261115_contact_demo`, chacune `psql -1 -v ON_ERROR_STOP=1 -f` ; aussitôt, fusion de la branche dans main et
     poussée (entre les deux, l'ancienne app ne montre plus de contacts aux stagiaires : quelques minutes) ; jeton de
     cache changé ; `demande.html` tamponné.
  6. **Preuves en ligne en production** : `contact-1-en-ligne`, `-2-en-ligne`, `-3-en-ligne`, rôles `en-ligne`,
     `titres-en-ligne`, `gestion-en-ligne`, profils `en-ligne`, `emargement-preuve.sql`, `conservation-preuve.sql`,
     autonomie. La preuve `contacts-centre-preuve.sql` n'est plus rejouée (remplacée). Un ROUGE : retours `_demo`, 3, 2, 1
     aussitôt, puis diagnostic.
  7. **Après** : redéploiement de l'assistant (guide), Nouveautés en ligne avec la fusion, `ROADMAP.md` et
     `POINT-DE-REPRISE.md` ; premier jour : surveiller les envois en `echec` (Messages, ou `select etat, count(*) from
     contact_envois group by 1` par Timy).
- [ ] **Step 4 : commit** `Espace contact : répétition complète et dossier pour la coordination`.

---

## Questions pour Timy

- **Q1** Place de « Messages » : deuxième entrée de la barre de l'équipe et de la direction sur ordinateur, dans « Plus »
  sur téléphone avec le compteur repris sur « Plus » (aucun onglet ne déménage). Captures à montrer avant la fusion.
- **Q2** Une fiche par personne, partagée entre centres (C-1) : le secrétariat commun de Nîmes et Montpellier se corrige une
  seule fois. D'accord, ou une fiche par centre ?
- **Q3** Les copies identiques de Nîmes et Montpellier sont fusionnées par la migration (C-2) : d'accord ?
- **Q4** Une demande que personne ne peut recevoir (promo sans formateur, centre sans direction ni règle) est refusée avec
  « préviens ton formateur directement » (C-8) : d'accord ?
- **Q5** Le premier enregistrement de sa fiche vaut vérification (C-4) : d'accord ?
- **Q6** Quelle adresse de test pour la recette par un vrai e-mail avant la fusion ?
- **Q7** Le jour de la fusion, Nîmes et Montpellier ensemble : l'offre gratuite de Resend (100 e-mails par jour) peut ne pas
  suffire un jour chargé. Passer à l'offre payante (environ 20 $ par mois) dès la mise en ligne, ou attendre le premier
  « e-mail non parti » ?
- **Q8** Les formateurs reçoivent les absences de leur promo tant que « Qui reçoit quoi » n'est pas réglé : le régler pour
  Nîmes avant la fusion (avec quels noms), ou partir ainsi ?

## Questions pour la coordination

- **Q-C1** Sans pg_cron ni pg_net, un e-mail en attente part à la prochaine action de quelqu'un (C-10). Voulez-vous un
  balayage planifié (pg_cron qui appelle `contact-envois`, ou une tâche planifiée de la machine) ? Le plan ne le suppose pas.
- **Q-C2** Ordre avec l'étape 3 des titres : la migration 1 réécrit `user_profiles_lecture` (clause du personnel) ; si
  l'aperçu par titre la touche aussi, laquelle part d'abord ? La garde de la migration 1 arrête sans rien changer si le
  texte n'est plus celui de `20261112_titres_5_fermetures.sql`.
- **Q-C3** `20261114_autonomie_2_version` est-elle appliquée en production ? La base locale la joue seulement avec
  `--autonomie-version`.
