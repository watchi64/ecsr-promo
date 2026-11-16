# Espace contact : dossier de mise en ligne pour la coordination

Date : 16/11/2026. Branche `espace-contact` (dépôt `C:/Users/watch/Dev/ecsr-promo-contact`). Ce dossier se lit et s'exécute par
la coordination, étape par étape. **Son rédacteur n'a rien exécuté** : aucune écriture en production, aucune fusion, aucune
poussée, aucun e-mail. Chaque chiffre vient d'un rapport nommé entre crochets ; les rapports sont dans
`.superpowers/sdd/2026-11-14-espace-contact/` (non versionné) et leur nom est donné sans chemin : `task-19a-report`,
`task-4C-report`, `progress`, etc. Quand deux sources se contredisent, les deux sont écrites (section G).

Règles qui valent pour toutes les étapes : jamais le tiret cadratin U+2014 ; aucune adresse e-mail réelle dans un fichier,
une migration, un test ou un rapport ; la clé `RESEND_API_KEY` n'est écrite ni affichée nulle part (posée par Timy,
dans son terminal ou dans les secrets de la fonction) ; équipe vouvoyée ; un seul robot lourd à la fois sur la machine.

## A. État réel au 16/11

- **Production** : `20261115_contact_1_annuaire` (registre `20261115090000`), `_2_demandes` (`…090001`), `_3_absences`
  (`…090002`) appliquées ; preuves en ligne vertes au 16/11 : `contact-1-en-ligne` 123/0, `contact-2-en-ligne` 165/0,
  `contact-3-en-ligne` 89/0, rôles `en-ligne` 13528/0, émargement 73/0, conservation 227/0 [progress, ligne du 16/11 ;
  brief 19b]. Titres 7, 8, 9 appliqués [brief 19b ; task-19a-report § 2].
- **Restent à appliquer** : `20261115_contact_demo`, `20261116_contact_4_correctifs` (après la relecture finale de la
  branche), `20261115_contact_1b_fermeture` (après la recette et la fusion de l'app).
- **Branche** : HEAD au commit de ce dossier (le commit qui le précède est `6f837e7d`). La fusion de main (titres étapes 3 et
  4, origin/main `738e5968`) est le commit `42999029` ; ajustements `6f837e7d` [task-19a-report]. Répétition complète verte
  (section C).
- **Fonction `contact-envois`** : jamais déployée. **Assistant (`chatbot`)** : à redéployer avec la fusion (le guide
  `supabase/functions/chatbot/aide.mjs` a changé : tâches 12 et 19a).
- `VERSION_CONDITIONS` vaut encore `2026-11-14` dans `js/legal-data.js` sur main et sur la branche (non touché) [task-19a-report § 4].

## B. md5 des migrations (relevés par `md5sum` au commit de ce dossier)

| Fichier | md5 |
|---|---|
| `20261115_contact_1_annuaire.sql` | `950b168ec6e95cb1d37c932fc8b82e57` (appliquée) |
| `20261115_contact_1_annuaire_retour.sql` | `40e4f384d35c849142b7b106b707684a` |
| `20261115_contact_1b_fermeture.sql` | `f04dff0ffdf31e18236bacf990387162` |
| `20261115_contact_1b_fermeture_retour.sql` | `db26c30f91689d3a7db21eeef4aff5ee` |
| `20261115_contact_2_demandes.sql` | `58ced48c545758ef005f14d662cf434c` (appliquée) |
| `20261115_contact_2_demandes_retour.sql` | `6cbcf95f5efb3f07d42aa9da0de344ef` |
| `20261115_contact_3_absences.sql` | `20ed89f52ff9c2c8b05404694650eb99` (appliquée) |
| `20261115_contact_3_absences_retour.sql` | `b5e4ef68d77c2b1bab451dff017ba889` |
| `20261115_contact_demo.sql` | `58bcb2eb5a6f3bcef96e858264f452fe` |
| `20261115_contact_demo_retour.sql` | `e16237b51ea2bbcd61d5e1a614761164` |
| `20261116_contact_4_correctifs.sql` | `c85b8f926ea73ac5d25d1db20b744f2e` |
| `20261116_contact_4_correctifs_retour.sql` | `4d7188179fea276cc1cb7e13c9d53bcf` |

Les valeurs sont celles de `task-19a-report` (« inchangés ») et relues par `md5sum` au commit du dossier : elles
concordent. **Avant chaque application, relancer `md5sum` sur le fichier réellement joué et comparer** (les fichiers 1, 2, 3
appliqués sont gelés : ne jamais les modifier).

## C. Chiffres attendus en production (répétition du 16/11, base locale au niveau de la production)

Source : `task-19a-report` § 3, base locale reconstruite par `rejouer_suite.sh --production` (30 migrations, titres 7, 8, 9
compris), migrations 1, 2, 3, `_demo`, 4 appliquées pour de bon par `psql -1 -v ON_ERROR_STOP=1 -f` (code 0 chacune). Les
comptes sont mesurés sur l'**état combiné** (1, 2, 3, demo, 4) : la répétition n'a pas relevé chaque preuve après la seule
`_demo`, ni après la seule 4. Une preuve en ligne d'une étape intermédiaire doit donc être VERT sans le moindre ROUGE ; le
compte exact se compare à l'état combiné à la fin de l'étape 4 (et à celui de l'étape 8 pour la 1b).

### Preuves injectées (rien d'appliqué), base d'avant contact [task-19a-report § 3]

| Mode | Verdict attendu |
|---|---|
| `contact-1` | VERT 139/0 |
| `contact-2` | VERT 174/0 |
| `contact-3` | VERT 107/0 |
| `contact-4` | VERT 59/0 |
| `contact-3-contre-epreuve` | ROUGE 28/76 |
| `contact-4-contre-epreuve` | ROUGE 32/24 |

Ces modes injectent leurs migrations : ils ne se rejouent plus sur la production (la garde d'entrée de la migration 1
arrêterait). Ils servent à la répétition locale seulement ; en production on joue les modes `-en-ligne`.

### Preuves en ligne après 1, 2, 3, `_demo`, 4 (sans la 1b), puis avec la 1b [task-19a-report § 3]

| Preuve | Avant contact (titres 9) | Après 1, 2, 3, demo, 4 | Avec la 1b en plus |
|---|---|---|---|
| rôles `en-ligne` | 12214/0 | 13528/0 | 13528/0 |
| `titres-en-ligne` | 375/0 | 375/0 | |
| `gestion-en-ligne` | 335/0 | 335/0 | |
| `suite-en-ligne` | 155/0 | 155/0 | |
| `espaces-en-ligne` | 240/0 | 240/0 | |
| `donnees-en-ligne` | 59/0 | 59/0 | |
| profils `en-ligne` | 32/0 | 32/0 | |
| émargement | 71/0 (local) | 71/0 (local) | |
| conservation | 227/0 | 227/0 | |
| autonomie | 146/0 | 146/0 | |
| truncate | 7/0 | 7/0 | |
| jury `en-ligne` | 53/0 | 53/0 | |
| `contact-1-en-ligne` | | 128/0 (dont `entre` 5/5, apporté par la demo) | 127/0 (`entre` 5/5 remplacé par `fermeture` 4/4) |
| `contact-2-en-ligne` | | 165/0 | 165/0 |
| `contact-3-en-ligne` | | 89/0 | 89/0 |
| `contact-4-en-ligne` | | 37/0 | 37/0 |

- Comptes de la production au 16/11, avant la demo et la 4 : `contact-1-en-ligne` 123/0 (sans demo, sans 1b), `contact-2-en-ligne`
  165/0, `contact-3-en-ligne` 89/0, rôles 13528/0, **émargement 73/0** [progress, 16/11]. L'écart 71 (local) / 73 (production)
  sur l'émargement est signalé en G. Pour l'émargement, le terme de comparaison à retenir est le dernier compte relevé en
  production avant l'étape (73), pas le 71 local.
- `contacts-centre-preuve.sql` (contacts du centre `en-ligne`) : **ne plus la rejouer**. Avec 1 et la demo elle est ROUGE 38/5
  (« colonne lieu_id absente ou facultative », « contacts d'avant hors de Nîmes : 3 sur 6 », « Montpellier n'a pas exactement
  les contacts de Nîmes », et deux contrôles du centre de démonstration, qui a désormais trois fiches) ; ce ROUGE est attendu et
  documenté (task-2, R-T3b ; task-19a-report § 3, écart 2). Elle est remplacée par les preuves contact.
- Après les retours (section K) les comptes reviennent à la colonne « Avant contact » (12214/0 pour les rôles, etc.)
  [task-19a-report, « Retours réels »].
- Empreintes (règles | fonctions | droits, `tests/sql/roles-empreinte.sql`) : avant contact (titres 9)
  `2dd2f9aacb38b950fd2e5adc4e13badc | 4dc1292b494ec6589e856dffee6d21fe | c79e70a2173d4247f768a16c1c48f1aa`, 162 fonctions
  publiques ; avec 1, 2, 3, demo, 4 : `0e0c3e82… | 22b903b3… | 60ae98f2…`, 252 fonctions ; avec la 1b, règles `e4b0f6e6…`
  [task-19a-report § 3]. Les empreintes de production se comparent à ces valeurs seulement si les données de règles sont les
  mêmes ; un écart d'empreinte seul, sans ROUGE, se signale sans bloquer.

### Contrôles app de la branche (répétition locale, déjà faits) [task-19a-report § 4]

`for f in tests/*.test.mjs; do node "$f"; done` : 147 fichiers, 0 échec (2129 tests). Robot (`--habillages ecsr,ecf`) : 928
passages, 927 aboutis, 1 rouge (`absence-planning`, WebKit téléphone, Couleurs ECF, « impossible de toucher le jour lun »),
rejoué seul 8/8 VERT. Vérificateur : 6608 vues, 0 échec, code 0 (second passage ; le premier avait 16 échecs, tous réglés).

## D. Étapes

Convention : **Accord** dit qui donne le feu avant l'étape (Timy ou coordination). `psql_prod.sh` ne se lance jamais sans
l'accord de Timy [en-tête de `outils/psql_prod.sh`]. Hors des heures de cours et des heures de feuille d'émargement (les modes
`-en-ligne` écrivent des données de preuve dans une transaction annulée, mais ils verrouillent brièvement ; 4C, mineur 4).

### Étape 0. Contrôle de l'état de départ (lecture seule)

- Commande : dans le worktree, `git rev-parse HEAD` et `git status` (arbre propre sauf `_harness_demande.html`, généré) ;
  `md5sum supabase/migrations/20261115_contact_*.sql supabase/migrations/20261116_contact_4*.sql` à comparer à la section B ;
  en production (accord de Timy) : `bash outils/psql_prod.sh -c "select version, name from supabase_migrations.schema_migrations where name like 'contact%' order by 1"`.
- Accord : coordination (la lecture en production : Timy).
- Attendu : trois lignes (`20261115090000` `contact_1_annuaire`, `…01` `contact_2_demandes`, `…02` `contact_3_absences`) ; md5 égaux.
- Écart : une ligne en plus ou en moins, ou un md5 différent : arrêter, ne rien appliquer, diagnostiquer.

### Étape 1. Préalables (rien en production)

1. **Version regroupée des conditions** : textes de `docs/superpowers/plans/2026-11-14-espace-contact-textes-donnees.md`
   (brouillons, à valider par Timy) regroupés avec l'étape 4 des titres dans une seule version `<V>`, publiée **au plus tard
   dans la même fusion** que l'espace contact (décision du 14/11 : la mise en ligne ne précède pas la publication de cette
   version). `VERSION_CONDITIONS` est encore `2026-11-14` sur main au 16/11. La coordination pose `VERSION_CONDITIONS = "<V>"`
   et le texte ; changer la version demande aussi la migration qui remplace `conditions_version_publiee()` (commentaire de
   `js/legal-data.js`, ligne 43) et, pour l'e-learning, le rejeu de `20261114_autonomie_2_version.sql` : procédure et marche
   arrière exactes au point 3.5 de la section 6.O de `docs/superpowers/plans/2026-11-11-titres-droits.md`. Ce dossier ne les
   réécrit pas.
2. **Équipes informées** : leur fiche de contact est créée d'office ; tant que « Qui reçoit quoi » n'est pas réglé pour un
   centre, les stagiaires choisissent eux-mêmes qui prévenir (mode choix, Q8).
3. **Accords de Timy sur les questions ouvertes** (section H) : au moins Q9, Q10, le fondateur cumulé et le motif « santé » ;
   les autres peuvent suivre la mise en ligne.
4. Aucun interrupteur : l'espace contact est actif pour toutes les promos dès la fusion (décision du 14/11).
- Accord : Timy (textes, versions, questions).
- Attendu : version `<V>` prête, équipes prévenues.
- Écart : si la version regroupée n'est pas prête, **ne pas fusionner** (les étapes 2 à 6 peuvent avancer).

### Étape 2. Recette locale par un vrai e-mail (avant toute écriture en production)

- Prouve : Resend, le domaine d'envoi, la forme de l'e-mail. Ne prouve pas la fonction contre la base.
- Commande : banc servi (`.\dev.ps1`, `node _harness_build.mjs`, qui régénère `_harness_demande.html`) ; **Timy pose
  `RESEND_API_KEY` dans son terminal** (jamais dans un fichier) puis
  `node outils/recette_courriel.mjs --a <adresse posée à la main>` ; `--a-blanc` écrit l'e-mail sur la sortie sans l'envoyer.
  Codes de sortie : 0 fait, 1 refus Resend, 2 arguments ou adresse fictive, 3 clé absente [en-tête de `recette_courriel.mjs`].
  L'adresse n'entre dans aucun fichier.
- Accord : Timy.
- Attendu (Timy contrôle dans l'e-mail reçu) : e-mail reçu ; expéditeur « Promo ECSR » (`Promo ECSR <no-reply@timy-studio.fr>`) ;
  objet et corps sans motif (« santé ») ni texte libre (« rdv médical ») ; trois liens en fragment `#j=` de 43 caractères ;
  chaque lien ouvre `_harness_demande.html` ; un seul bouton ; « C'est fait » puis « Déjà fait » [task-19-brief, Step 3 point 2].
- Écart : un motif ou un texte libre visible dans l'e-mail : arrêt, rien ne part en production ; code 1 : vérifier la clé et le
  domaine d'envoi chez Resend.

### Étape 3. Essai à blanc en production (transaction annulée)

Pour chacune de `_demo` puis `4_correctifs`, dans cet ordre, sans rien laisser appliqué.

- Méthode : une session `psql -1` qui joue la migration puis la preuve en ligne du bon mode ; la preuve se termine toujours par
  une levée (`VERT n/0` ou `ROUGE ok/ko`), ce qui annule la transaction entière, donc l'essai ne laisse rien. Le code de sortie
  est non nul **par construction** ; ce qui compte est le verdict lu dans le message. Cette méthode est tirée de la
  convention du chantier (preuve en bloc `do` qui lève toujours) ; **elle n'a pas été jouée telle quelle par le rédacteur**
  (voir section M) : la coordination la vérifie d'abord sur la base locale 55460.
  1. Fabriquer le fichier de preuve : `node outils/assembler_repetition_roles.mjs contact-1-en-ligne <chemin>/c1.sql --compact`
     (pour `_demo`), `... contact-4-en-ligne <chemin>/c4.sql --compact` (pour la 4).
  2. `md5sum` de la migration et du fichier de preuve ; noter.
  3. `bash outils/psql_prod.sh -1 -f supabase/migrations/20261115_contact_demo.sql -f <chemin>/c1.sql`
     puis `bash outils/psql_prod.sh -1 -f supabase/migrations/20261116_contact_4_correctifs.sql -f <chemin>/c4.sql`.
- Accord : Timy.
- Attendu : la migration passe sans erreur de garde ; le verdict de la preuve est VERT sans ROUGE ; comptes : `contact-1-en-ligne`
  128/0 après la demo (dont `entre` 5/5), `contact-4-en-ligne` 37/0 après la 4 (section C) ; base inchangée après l'essai
  (relancer l'étape 0).
- Écart : une garde de la migration refuse (« rien n'est changé ») : lire le message, c'est le contrôle prévu. Garde de la
  demo : exactement un lieu de démonstration, ses deux fiches fictives telles que posées par `20261113_contacts_centre`, la
  fiche « Responsable pédagogique (fictif) » absente. Garde de la 4 : migrations 1, 2, 3 appliquées, 4 absente (marqueur
  `_contact_quota_equipe(bigint)`), quinze fonctions présentes avec leur signature, index `demandes_auteur_fiche_cree` absent.
  Un ROUGE ou un compte différent : ne rien appliquer, diagnostiquer avec le rapport de la tâche concernée.

### Étape 4. Application en production : `_demo`, puis `4_correctifs`

**Ordre imposé : la 4 AVANT le déploiement de la fonction `contact-envois`** (la nouvelle fonction envoie l'issue `limite`,
que la base refuse sans la 4 ; l'envoi resterait en cours, serait repris avec une tentative de plus et finirait « interrompu »)
[en-têtes de la migration 4 et du retour 4 ; task-4C-report, tour de correction 1].

Pour chaque migration, dans l'ordre :
1. `md5sum` du fichier, comparé à la section B.
2. Application : `bash outils/psql_prod.sh -1 -v ON_ERROR_STOP=1 -f supabase/migrations/<fichier>.sql`
   (la demo d'abord, la 4 ensuite ; `set local lock_timeout = '3s'` est en tête de chacune).
3. Ligne dans `supabase_migrations.schema_migrations`, **dans la même transaction que l'application**, sur la forme des trois
   lignes déjà posées (`version`, `name`, `statements` = le texte du fichier ; voir la Task 10 Step 2 de
   `docs/superpowers/plans/2026-10-28-refonte-navigation-lot-4-roles.md`). Versions : la suite de `20261115090002`, au choix
   de la coordination, en respectant l'ordre d'application. **Aucune version n'est fixée par les sources** : la coordination
   les écrit.
4. Preuves en ligne (étape 9, liste réduite) : `contact-1-en-ligne` après la demo, puis `contact-4-en-ligne` et les autres
   après la 4.
- Accord : Timy.
- Attendu : code 0 ; après la demo, `contact-1-en-ligne` VERT 128/0 ; après la 4, section C (états combinés) : `contact-4-en-ligne`
  37/0, `contact-3-en-ligne` 89/0, `contact-2-en-ligne` 165/0, `contact-1-en-ligne` 128/0, rôles 13528/0.
- Écart : une garde ou une erreur : `-1` annule tout, rien n'est changé ; ne pas contourner. Un ROUGE après application :
  retour aussitôt (section K, dans l'ordre), puis diagnostic.
- Effet à connaître : l'app en ligne est encore l'ancienne ; aucun écran ne crée de demande. La 1b n'est pas appliquée :
  la lecture directe de `contacts` reste ouverte jusqu'à l'étape 8.

### Étape 5. Déploiement de la fonction `contact-envois`

- Après l'étape 4 (jamais avant). Fonction : `supabase/functions/contact-envois/` (`index.ts`, `courriels.mjs`, `jetons.mjs`),
  version du commit de ce dossier.
- Commande : déploiement par la voie habituelle des fonctions du projet. Deux voies sont écrites dans le dépôt : l'outil MCP
  `deploy_edge_function` (`PROJECT_NOTES.md`, ligne 22) ou `supabase functions deploy contact-envois` (task-19-brief). Choisir
  la voie en usage. Variables : `CONTACT_APP_URL` (adresse de l'hébergement du jour : Pages, ou Scaleway après la bascule ;
  défaut dans le code : l'adresse Pages historique) et `CONTACT_EXPEDITEUR` (facultative, défaut
  `Promo ECSR <no-reply@timy-studio.fr>`). `RESEND_API_KEY` : posée par Timy dans les secrets de la fonction, jamais écrite ni
  affichée.
- **Réserve JWT** : `lien` et `agir` sont appelés sans compte, avec la clé publique ; si cette clé n'est pas un JWT anon,
  la vérification JWT du déploiement les refuserait. À contrôler au déploiement [progress, relecture de la tâche 10].
- Contrôle : `{op:"etat"}` appelé par le fondateur hors aperçu (jugé par la base avec le jeton de l'appelant).
- Accord : Timy (déploiement et secret).
- Attendu : `cle_presente: true`, `expediteur` et `app_url` justes ; la valeur de la clé n'apparaît jamais.
- Écart : `cle_presente: false` : la clé n'est pas posée sur cette fonction ; erreur de vérification JWT : voir la réserve.
  Ne pas déployer avant la 4 ; sinon retour immédiat de la fonction à la version `5e8acc38`.

### Étape 6. Recette de la fonction contre la production, avant la fusion de l'app

C'est la seule étape qui parle à la production par la fonction, et elle le fait **après** l'application des migrations (la
fonction a besoin de l'API Supabase, que la base locale n'a pas) [task-19-brief, Step 3 point 6 ; Q-C4].

1. En propriétaire (`psql_prod.sh`, accord de Timy), au **centre de démonstration** : une fiche de contact sans compte, avec
   l'adresse de recette posée à la main (jamais écrite dans un fichier) ; une demande d'équipe vers elle.
2. `{op:"traiter"}` appelé par un compte connecté du centre : bilan `traites/envoyes/echecs/ignores/limites`.
3. E-mail reçu à l'adresse de recette. Timy contrôle : expéditeur, boutons, **aucun motif et aucun texte libre**, et que le lien
   demande une confirmation (un seul bouton).
4. Le jeton lu dans le lien reçu : `{op:"lien", jeton}` (rien n'est écrit), puis `{op:"agir", jeton}` appelés à la main (la page
   `demande.html` n'est pas encore en ligne) : `{fait: true}`, puis un second `agir` : `{deja: true}`.
5. Nettoyage : la demande, ses envois, ses jetons et la fiche de test supprimés ; `select count(*)` de chacun à **0**.
- Accord : Timy.
- Attendu : comme ci-dessus ; les quatre comptes finaux à 0 ; aucun envoi `echec` (`select etat, count(*) from contact_envois group by 1`).
- Écart : `echec` ou `limite` : lire la raison (sans motif ni texte libre dans la table) ; 429 Resend : le quota gratuit ; arrêter
  la recette, ne pas fusionner, nettoyer quand même. Une fiche ou une demande qui reste : la supprimer avant de continuer.
- Réserve : le SQL exact de l'étape 1 n'est pas écrit dans les sources (un appel de fonction de l'app demande un jeton de
  session ; en propriétaire il faut soit poser les claims de la session en transaction, soit insérer directement). La
  coordination l'écrit et le relit avec Timy avant de jouer.

### Étape 7. Fusion de la branche dans main, poussée, jeton de cache

1. Fusion `espace-contact` dans main en suivant la méthode du chantier (`merge --no-ff --no-commit`, aucun écart hors jeton
   `?v=` ; poussée par Timy ou la coordination) ; la branche contient déjà `42999029` (main du 16/11). Si main a avancé :
   `git fetch`, refusion de main dans la branche d'abord (comme `task-19a-report` § 1) et nouveau passage des contrôles.
2. **Jeton de cache** : celui de main à la fusion (`20261116a` au 16/11) ; le hook limité à main et au pre-push le pose ;
   sinon `node scripts/cache-bust.js <jeton>` (sans `--staged`). Un seul jeton à la fin (le banc et le robot le contrôlent).
   `demande.html` est tamponné par ce même script.
3. **Nouveautés** : cinq entrées de direction portent la date provisoire `2026-11-14` dans `js/nouveautes-data.js`
   (`2026-11-14-contacts-du-centre-stagiaires`, `-fiche-de-contact-formateurs`, `-prevenir-absence-stagiaires`,
   `-messages-formateurs`, `-messages-direction`) : les dater du **jour de mise en ligne**, dans le même commit que la fusion ;
   `node tests/nouveautes.test.mjs` doit passer.
4. **Conditions** : la version regroupée `<V>` (étape 1) dans la même fusion.
5. **Report du banc dans `TP_ECSR_App`** (hors git ; une session à la fois dans ce dossier partagé) : les blocs
   `// === Espace contact ===` ... `// === fin espace contact ===` de `_harness_supabase.js` (tâches 13, 15, 16, 17, 4C) ; la
   **ligne non marquée** de l'aiguillage `CONTACT_RPC` / `DEM_RPC` vers `rpcContactBanc` ; le bloc de `_harness_build.mjs`
   (il cherche l'appel de `js/lien-demande.js` avec ou sans jeton, sans quoi la construction s'arrête) ; ajouter
   `_harness_demande.html` aux exclusions (`.git/info/exclude` du dépôt principal). Leviers à retrouver (section E).
   Conflit probable sur `outils/base_locale/rejouer_suite.sh` avec la session des titres (la version de la branche est celle de
   main plus `20261115_titres_9_catalogue` dans `--production`, 30 migrations).
6. Un lien de l'étape 6 rouvert sur la page en ligne dit « Ce lien n'est plus valable » (jeton supprimé).
- Accord : Timy (fusion et poussée).
- Attendu : build vert, `node tests/*.test.mjs` 0 échec, un seul jeton, page en ligne qui charge.
- Écart : refus d'un test de navigation ou du robot : ne pas pousser ; un ROUGE en ligne après la poussée : app ramenée au
  commit d'avant la fusion (section K).

### Étape 8. Migration `20261115_contact_1b_fermeture` (après la fusion)

Elle ferme la lecture directe de `contacts` à qui n'écrit pas les fiches (seule la règle `contacts_select_authenticated`
change, par `alter policy`) ; l'app fusionnée ne lit plus `contacts` en direct hors de la fenêtre de modification [en-tête
de la migration]. **Appliquée juste après la fusion, jamais avant.**
- Essai à blanc : `node outils/assembler_repetition_roles.mjs contact-1-en-ligne <chemin>/c1b.sql --compact` puis
  `bash outils/psql_prod.sh -1 -f supabase/migrations/20261115_contact_1b_fermeture.sql -f <chemin>/c1b.sql` : verdict VERT
  127/0 (section C).
- Application : `bash outils/psql_prod.sh -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_contact_1b_fermeture.sql`,
  ligne de registre dans la même transaction (comme l'étape 4).
- Accord : Timy.
- Attendu : code 0 ; `contact-1-en-ligne` VERT 127/0 (`fermeture` 4/4 remplace `entre` 5/5) ; rôles 13528/0 inchangé.
- Écart : garde refusée (« déjà fermée » ou texte différent) : lire le message, rien n'est changé. Si les stagiaires ne voient
  plus d'annuaire : vérifier d'abord que l'app fusionnée est bien celle qui sert.

### Étape 9. Preuves en ligne complètes, puis suite

Jouées par `bash outils/psql_prod.sh -f <fichier>` (accord de Timy), avec les fichiers fabriqués comme ci-dessous (inspirés de
`.superpowers/sdd/2026-11-14-espace-contact/verdicts_depart.sh`) ; les chemins `<chemin>` sont hors dépôt.

```
for m in contact-1-en-ligne contact-2-en-ligne contact-3-en-ligne contact-4-en-ligne en-ligne titres-en-ligne gestion-en-ligne \
         suite-en-ligne espaces-en-ligne donnees-en-ligne; do
  node outils/assembler_repetition_roles.mjs "$m" "<chemin>/$m.sql" && bash outils/psql_prod.sh -f "<chemin>/$m.sql"
done
node outils/assembler_preuve_profils.mjs en-ligne <chemin>/profils.sql && bash outils/psql_prod.sh -f <chemin>/profils.sql
node outils/assembler_preuve_jury.mjs en-ligne <chemin>/jury.sql && bash outils/psql_prod.sh -f <chemin>/jury.sql
bash outils/psql_prod.sh -f tests/sql/emargement-preuve.sql
bash outils/psql_prod.sh -f tests/sql/truncate-preuve.sql
bash outils/psql_prod.sh -1 -f tests/sql/conservation-preuve.sql -v migration=<chemin absolu de 20261110_conservation.sql> -v retour=<chemin absolu du retour>
bash outils/psql_prod.sh -f tests/sql/autonomie-preuve.sql -v migration=<chemin absolu de 20261114_autonomie_1_traces.sql> -v retour=<chemin absolu du retour>
```

Les commandes `conservation` et `autonomie` sont celles de `verdicts_depart.sh` (adaptées à `psql_prod.sh`) ; le script d'origine
joue `psql -X -q`. `contacts-centre-preuve.sql` n'est plus rejouée (section C).
- Accord : Timy.
- Attendu : les comptes de la section C, colonne « Avec la 1b en plus » pour `contact-1-en-ligne` (127/0) ; rôles 13528/0 ;
  émargement : au dernier compte relevé en production (73/0 au 16/11) ; conservation 227/0 ; tous VERT.
- Écart : un ROUGE ou une preuve qui passe de VERT à autre chose : retours aussitôt (section K), puis diagnostic ; un compte
  différent sans ROUGE : arrêter, relever les deux sorties, signaler à Timy.

### Étape 10. Après la mise en ligne

1. **Assistant `chatbot`** : redéploiement (guide `supabase/functions/chatbot/aide.mjs` : Contacts, Messages, Réglages du centre ;
   fusionné à la main en 19a) ; accord de Timy. Vérifier par `tests/chatbot-aide.test.mjs` avant.
2. `ROADMAP.md` et `POINT-DE-REPRISE.md` : par la coordination (en-tête : maj, etat, next, bloque).
3. **Premier jour** : surveiller les envois en `echec` (Messages, ou `select etat, count(*) from contact_envois group by 1`
   par Timy) ; un 429 Resend persistant fait repasser l'envoi toutes les 5 minutes sans consommer de tentative [task-4C-report,
   réserve 4] ; aucune tâche planifiée ne relance la file (Q-C1). Une action de n'importe quel utilisateur la relance.

## E. Leviers du banc à reporter dans `TP_ECSR_App` (fichiers hors git)

Les blocs sont marqués `// === Espace contact ===` ... `// === fin espace contact ===` (`_harness_supabase.js`, `_harness_build.mjs`).
Leviers par rapport [task-13, 15, 16, 17, 4C, 19a] :
- Tâche 13 : `?contact_regle=1` (règle par défaut vers une fiche en congé, donc son relais) ; `?ecritures=1` (écritures gardées) ;
  demandes `DEM` (absence 101 d'Agathe O., demande administrative 102 de Lison K.) ; faux `/functions/v1/contact-envois`
  (`traiter` ; `lien` et `agir` : jeton `V` x43 valide puis « déjà fait », `D` x43 déjà fait, `E` x43 et tout autre : invalide) ;
  `_harness_demande.html` généré par `_harness_build.mjs` (CSP retirée, un seul script module).
- Tâche 15 : `?justificatif=1`, `?absence_np=1` (nom sans fiche), `?absence_sans_adresse=1` (phrase C-18) ; `DEM_RPC` étendu
  (`prevenir_absence`, `regler_justificatif`, `mes_justificatifs_a_remettre`, `absences_annoncees_semaine`).
- Tâche 16 : `?absence_planning=1`, `?absence_ratee=1`.
- Tâche 17 : `?formateur_du_jour=1`, `?delegue=1`, `?absence=annoncee`, geste `window.__bancContact.justificatif(état)` ;
  `?absence_planning=1` ajusté (seconde ligne : Agathe O., lundi matin, de 10 h à 11 h).
- Tâche 4C : `peut_modifier` dans `reglages_contact`, levier `?reglages=lecture` (champs désactivés, notes « Vous consultez... »).
- Tâche 19a : le `_harness_supabase.js` de `TP_ECSR_App` (main, recopié par la session des titres le 16/11) a été fusionné à trois
  voies avec le nôtre ; le résultat moins nos blocs égale le banc de main plus la ligne non marquée de l'aiguillage.
  Faute de ces reports les parcours contact rougissent [task-17-report, réserve 1].

## F. Choix de fusion à confirmer par la coordination (task-19a-report, « Conflits et choix » et « Réserves »)

1. **Messages toujours dans « Plus » sur téléphone** (`TOUJOURS_DANS_PLUS` dans `js/nav-rules.js`), et sans case de titre : tout
   titre de l'équipe et de la direction a l'entrée (main l'avait prévu dans `selonLesCases`). Sinon Messages montait dans la
   barre d'un Intervenant à la place d'Émargement. `tests/nav-rules.test.mjs` et `outils/verifier_navigation.py` ajustés.
2. **Réglages du centre** : `suiteDuCentre(centre, avecDonnees)` montre toujours les sections contact (financements, « Qui reçoit
   quoi », « Réponses toutes faites », « Fiches à supprimer » ; la base garde par la case Réglages) et les données personnelles
   seulement pour la direction fixe ou le fondateur (règle de main).
3. **Coordonnées d'un stagiaire** : `js/views/fiche-coordonnees.js` décide par `ecritSelonLaCase("stagiaires")` (la base juge
   par `geste_promo(p, 'stagiaires.gerer')`) au lieu de `isAdmin()`.
4. **`outils/base_locale/rejouer_suite.sh`** : version de main (options `--autonomie 1|1,2` et `--production`), étendue pour que
   `--production` joue aussi `20261115_titres_9_catalogue` (30 migrations) ; les options `--autonomie-version`, `--restes`,
   `--jury` de la branche n'existent plus ; `suite --etapes 4,9` ne se joue plus sur cette base (`--etapes 4` reste).
5. Contacts, Ma fiche et Messages se décident encore par `isEquipe()` / `isStagiaire()` sans case de titre ; seul `isAdmin()` est
   inventorié par les tests de main (réserve 6 de 19a).
6. Le jeton de cache a été posé sur des imports de la branche qui n'en avaient pas (et sur `demande.html`).

## G. Contradictions entre rapports (les deux versions sont écrites ; la valeur retenue est dite)

1. **md5 de la migration 4** : `06a7c5a73a0588a222ee4c53eb4a843b` / retour `339f19b02906e23723ca4686c9d9b333` (premier jet,
   commit `12e9d18c`, task-4C-report) contre `c85b8f926ea73ac5d25d1db20b744f2e` / `4d7188179fea276cc1cb7e13c9d53bcf`
   (tour de correction 1, commit `400b8805`, aussi dans task-19a-report). **Retenu : les seconds**, relus par `md5sum`.
2. **Émargement en ligne** : 73/0 en production au 16/11 [progress] contre 71/0 sur la base locale [task-4C, task-19a].
   Non expliqué par les sources (les comptes réels de production ne sont lus qu'en nombre). Retenu : comparer la production à
   elle-même (73 avant) ; un écart de compte sans ROUGE se signale.
3. **`contact-2-en-ligne`** : 163/0 (15/11, avec 1 et 2) [progress] ; 165/0 (16/11, avec 3) [progress, task-19a] ; 164/1 avant le
   conditionnement de la phrase de `ecrire_au_stagiaire` à la migration 4 [task-4C-report]. Ce sont des états différents ;
   valeur à attendre : 165/0.
4. **`contact-3-en-ligne`** : 82/0 (premier jet de la tâche 14, `progress`) contre 89/0 (après le tour 1 et en production).
   Retenu : 89/0.
5. **`contact-1-en-ligne`** : 123/0 (production, sans demo ni 1b) ; 128/0 avec la demo ; 127/0 avec la 1b [task-19a-report] ;
   127/0 déjà cité à la tâche 13 [progress]. Cohérent par état ; chaque étape a son compte (section C).
6. **Rôles `en-ligne`** : 13382/0 (15/11, 1 et 2) contre 13528/0 (avec la 3, production du 16/11). Retenu : 13528/0.
7. **`contact-4-en-ligne`** : 35/0 (premier jet 4C) contre 37/0 (final) ; 4/0 en mode injecté « groupes sautés ». Retenu : 37/0.
8. **Nombre de fonctions refaites par la migration 4** : quatorze (task-4C-report, premier jet) contre quinze (en-tête du retour 4
   et tour de correction : `_contact_annexes` ajoutée). Retenu : quinze.
9. **Ordre des retours** : le brief de 19a écrivait « 1b en dernier appliquée, puis son retour » ; la garde du retour 1b refuse
   tant que la 2 est là, et celle du retour 1 refuse tant que la 1b est là [task-19a-report § 3, réserve 4]. Retenu : 4, demo, 3, 2,
   1b, 1 (avec la 1b appliquée) ; 4, demo, 3, 2, 1 (sans elle).
10. **Voie de déploiement des fonctions** : `supabase functions deploy` [task-19-brief] contre l'outil MCP `deploy_edge_function`
    [`PROJECT_NOTES.md`]. Voir étape 5 : la voie en usage.
11. **Q-C2** (ordre avec l'étape 3 des titres, texte de `user_profiles_lecture`) : question du brief 19 ; réglée de fait par la
    fusion `42999029` et les preuves vertes sur titres 7, 8, 9 [task-19a-report] : plus ouverte.
12. **Taille de la base de répétition** : `verdicts_depart.sh` parle d'une base à 26 migrations (état du 14/11) ; la base de 19a
    est à 30 migrations (état du 16/11, titres 9 comprise). Retenu : 30.

## H. Questions ouvertes

**Pour Timy** :
- **Q9** : la spec (§ 13) supprime une fiche de l'équipe sans compte « douze mois après le départ de la personne » ; le plan
  (C-16) la fait supprimer à la main au départ, sans minuterie, et les conditions le disent ainsi. D'accord ?
- **Q10** : en mode choix, la direction du centre figure toujours dans la liste, à côté des formateurs, même pour un retard.
  D'accord, ou la réserver aux absences et aux questions administratives ?
- **Fondateur cumulé** : un compte à la fois administrateur et stagiaire (ou équipe) ne lit ni n'écrit de demande
  (`_contact_stagiaire` exclut admin et fondateur) ; changement de base si voulu [progress, tâche 13].
- **Absence du jour annoncée après clôture de la feuille** : acceptée (demande et avis partent) sans toucher la feuille ; le
  formateur corrige à la main (R-T14b).
- **Motif effacé tout de suite sur effacement sur demande** : la durée normale le garde jusqu'à la fin de la troisième année ;
  `effacer_sur_demande` joue les deux étapes d'un coup [textes-donnees, point 1 ; progress, tâche 14].
- **Motif « santé » et article 9 du RGPD**, aggravé par le lien « Voir la demande » ouvert sans connexion 14 jours.
- **Un stagiaire voit « absent »** sur ses pairs au planning [progress, tâche 16].
- **Valeurs posées par la migration 4** : 30 conversations par jour pour l'équipe, absence au plus 120 jours à l'avance,
  échéance d'envoi 120 s [progress, R-4C].
- **Retour 3 avec lignes d'émargement `annoncee` réelles** : passer ces lignes à l'origine `formateur` (l'origine
  « annoncee » disparaît de l'historique) se décide avec Timy [en-tête du retour 4].
- **Textes des conditions** : brouillons à valider (`2026-11-14-espace-contact-textes-donnees.md`).

**Pour la coordination** :
- **Q-C1** : sans pg_cron ni pg_net, un e-mail en attente part à la prochaine action de quelqu'un ; voulez-vous un balayage
  planifié (pg_cron qui appelle `contact-envois`, ou une tâche planifiée de la machine) ? Le plan ne le suppose pas.
- **Q-C4** : la recette de la fonction (étape 6) touche la production après l'application des migrations, en propriétaire, avec
  une fiche de test supprimée ensuite : d'accord sur cet ordre, ou une base Supabase de recette existe-t-elle ?
- Les choix de la section F.

## K. Marche arrière

**Ordre imposé par les gardes** : avec la 1b appliquée : retours `4`, `_demo`, `3`, `2`, `1b`, `1`. Sans la 1b : `4`, `_demo`,
`3`, `2`, `1` [task-19a-report § 3, « Retours réels » ; en-têtes des retours]. Chaque retour : `bash outils/psql_prod.sh -1 -v
ON_ERROR_STOP=1 -f supabase/migrations/<fichier>_retour.sql`, et sa ligne retirée du registre dans la même transaction. Chaque
garde refuse sans rien changer si l'ordre n'est pas respecté (messages explicites).

1. **Avant le retour 4** : redéployer `contact-envois` à sa version d'avant la migration 4, **commit `5e8acc38`**
   (`supabase/functions/contact-envois`), parce que la version de la branche envoie l'issue `limite` que la base refuserait
   [en-tête du retour 4].
2. **Retour 4** : refuse si la 4 n'est pas appliquée ou si la 3 n'est plus là (alors : rejouer la 3, puis le retour 4, puis
   le retour 3). Il remet les quinze fonctions au texte de leur dernier fichier, retire `_contact_quota_equipe` et l'index
   `demandes_auteur_fiche_cree` ; les marques de délégué vidées à l'effacement et par le rattrapage ne sont pas rétablies.
3. **Retour `_demo`**, puis **retour 3**. Le retour 3 refuse tant qu'une ligne d'émargement porte `absence_origine = 'annoncee'`.
   Procédure (décision avec Timy ; jamais de suppression de ces lignes, ce sont des absences réelles) en une transaction :
   `select seance_id, count(*) from public.emargement_lignes where absence_origine = 'annoncee' group by 1 order by 1;`,
   puis `update public.emargement_lignes set absence_origine = 'formateur' where absence_origine = 'annoncee';` (l'absence et
   l'observation sont gardées, feuilles closes comprises), vérifier qu'il n'en reste aucune, jouer le retour 3 dans la même
   transaction [en-tête du retour 4]. Le retour 3 supprime `absences_annoncees` avec ses lignes (un avis en donne le nombre).
4. **Retours 2, 1b, 1** dans cet ordre.
5. Après les retours : relancer les preuves en ligne ; elles reviennent aux comptes de la colonne « Avant contact » de la
   section C (rôles 12214/0 ; `contacts-centre-preuve.sql` redevient VERT 43/0 [task-19a-report § 3]).
6. **Un ROUGE après la fusion de l'app** : l'app est ramenée au commit d'avant la fusion (revert de la fusion), **puis** les
   retours dans l'ordre ci-dessus. Retirer la 1b rouvre la lecture directe de `contacts` (texte `true` du retour 1b).
7. Fonction : après le retour 4, la version `5e8acc38` reste valable (elle ne connaît pas `limite`) ; après le retour 2, elle n'a
   plus rien à appeler : la retirer ou la laisser inerte (décision de la coordination).

## M. Réserves du rédacteur

- Aucune commande de ce dossier n'a été exécutée : ni base, ni production, ni e-mail, ni déploiement.
- L'essai à blanc en `psql -1` avec la preuve en ligne (étapes 3 et 8) est une méthode déduite (preuve qui lève toujours, donc
  transaction annulée) ; à valider d'abord sur la base locale 55460 (outils de `outils/base_locale/`).
- Les versions de registre de `_demo`, `4_correctifs` et `1b_fermeture` ne sont pas fixées par les sources.
- Le SQL de l'étape 6 (fiche de test, demande d'équipe, nettoyage) n'est pas écrit dans les sources.
- Comptes d'émargement : voir G.2.
- Nombre de fichiers et de tests (147 fichiers, 2129 tests) : état du commit `6f837e7d`, avant ce dossier ; ce dossier n'ajoute
  aucun test.
