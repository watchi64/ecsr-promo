# Signaler un problème depuis l'app (conception)

Date : 28/10/2026. Statut : **questions tranchées par Timy le 28/10/2026** (les quatre choix
recommandés), spec à valider. Chantier prévu par la refonte de la navigation
(`2026-10-27-refonte-navigation-roles-design.md`, § 4.2, et `2026-10-27-refonte-navigation-lots.md`,
lot 6 et suivants).

## 1. Intention

Stagiaires et formateurs signalent un bug ou une gêne **en deux gestes** (ouvrir « Signaler un
problème », envoyer), depuis n'importe quelle page. Timy, l'éditeur de l'app, reçoit chaque
signalement **avec le contexte utile** (page, appareil, navigateur, heure, version), sans avoir à le
demander à la personne, et peut lui répondre ; la personne voit la suite au même endroit.

Pourquoi maintenant : la nouvelle navigation va être allumée promo par promo. Pendant la bascule, les
remontées arriveront par le groupe WhatsApp ou de vive voix, sans la page ni l'appareil, et souvent
perdues. Le signalement sert dès sa mise en ligne (ancienne navigation, celle des promos aujourd'hui)
et pendant l'allumage.

## 2. Décisions

**Tranchées par Timy (28/10)**

1. **Destinataire : Timy seul**, comme éditeur (`user_profiles.is_founder`). Les formateurs ne lisent
   pas les signalements des autres : moins de personnes lisent des messages libres, ce qui protège mieux
   les données. Le lot 4 (rôles et portées) pourra ouvrir une portée plus tard, en une règle.
2. **Alerte : une pastille dans l'app**, pas de courriel (rien à configurer, aucun nouveau prestataire).
3. **Suivi : un statut et une réponse courte**, visibles par la personne qui a signalé, dans la même
   fenêtre, avec un repère tant qu'elle n'a pas lu la réponse.
4. **Capture : une image facultative**, choisie par la personne dans ses photos, réduite avant l'envoi,
   visible de Timy et d'elle seule, effacée avec le signalement. Pas de capture automatique de l'écran.

**Choix par défaut annoncés à Timy avant ses réponses, non contestés**

- Entrées : celles de la spec de la refonte (§ 4.2), plus l'ancienne navigation (§ 5.1).
- Un seul champ libre, aucune catégorie à choisir.
- Contexte joint d'office (§ 6), nom et adresse posés par la base et non par le navigateur.
- 10 signalements par jour et par personne au plus, 2 000 caractères au plus.
- Conservation 12 mois, effacement avec la personne ; registre des traitements mis à jour ; une ligne
  dans les conditions d'utilisation, sans nouvelle acceptation (§ 8).

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Signaler en deux gestes, hors saisie du texte, à toute taille d'écran et dans les deux navigations.
- Un signalement qui arrive avec tout ce qu'il faut pour reproduire le problème.
- Une boucle fermée : la personne sait que c'est reçu, puis réglé ou non, et lit la réponse.
- Timy voit d'un coup d'œil ce qui reste à traiter.

**Non-objectifs**
- Courriel, notification sur le téléphone (l'app n'a pas de service worker).
- Capture automatique de l'écran (bibliothèque lourde, rendu imparfait, et elle montrerait les notes des
  autres).
- Signaler sans être connecté (l'écran de connexion) : l'adresse de contact des mentions légales reste le
  recours.
- Catégories, priorités, attribution, fil de discussion : une réponse, que Timy peut réécrire.
- Les signalements de QCM : ils restent à part (drapeau ⚑, « Signalements » dans Cours et QCM, skill
  `instruire-signalements-qcm`).
- L'accès de l'assistant (IA) aux signalements.

**Anti-objectifs (échec même si « ça marche »)**
- Plus de deux gestes pour signaler, ou un formulaire qui fait peur (champs obligatoires multiples).
- Une donnée jointe que la personne ne peut pas voir : ce qui part avec son message lui est montré en
  clair avant l'envoi.
- Un signalement perdu en silence : un envoi raté garde le texte et le dit.
- Une confusion avec les signalements de QCM : icône propre, jamais le drapeau ⚑.
- Du rouge pour un statut ou une erreur, un défilement de côté, une cible de moins de 44 px sur
  téléphone, un texte sous le contraste AA, un tiret cadratin.
- Une coquille de navigation alourdie : l'entrée s'ajoute là où la refonte l'a prévue, rien de plus.

## 4. Parcours

### 4.1 Signaler (toute personne connectée)

1. La personne ouvre « Signaler un problème » (§ 5). Une fenêtre s'ouvre : au centre sur ordinateur et
   tablette, montant du bas sur téléphone.
2. Contenu de la fenêtre, de haut en bas :
   - le titre « Signaler un problème » et un bouton « Fermer » ;
   - un champ « Que s'est-il passé ? » (exemple en gris : « Par exemple : sur la page Notes, le bouton
     Enregistrer ne réagit pas. ») ;
   - un bouton « Joindre une capture », facultatif ; une fois l'image choisie, sa miniature et « Retirer » ;
   - la ligne « Joint d'office : page Planning, iPhone, Safari 18, à 10 h 42 », et « Voir le détail »,
     qui déplie la liste complète en mots simples ;
   - le bouton « Envoyer ».
3. « Envoyer » : la fenêtre se ferme et un message confirme « Merci, c'est transmis. La réponse
   s'affichera dans « Signaler un problème ». ».
4. Champ vide ou presque (moins de 3 caractères) : un message sous le champ (« Écris quelques mots sur ce
   qui se passe. »), rien ne part. Le bouton n'est jamais grisé.
5. Envoi raté (réseau, limite du jour) : la fenêtre reste ouverte, le texte et l'image sont gardés, la
   raison est dite (« L'envoi n'a pas abouti : ... Ton texte est gardé, réessaie. »).
6. Fermer sans envoyer garde le brouillon (texte et image) jusqu'à la fermeture de l'app.

Le texte est au tutoiement pour tous, comme le reste de l'app (stagiaires et formateurs).

### 4.2 Suivre ses signalements

Sous le formulaire, dans la même fenêtre, « Mes signalements » liste les dix plus récents de la
personne, un signalement qui vient d'avancer remontant en tête : date et heure, début du message
(dépliable), statut, et la réponse de Timy s'il en a écrit une.

| Statut en base | Vu par la personne | Vu par Timy |
|---|---|---|
| `nouveau` | Reçu | Nouveau |
| `en_cours` | En cours | En cours |
| `regle` | Réglé | Réglé |
| `non_retenu` | Pas retenu | Pas retenu |

Repère « suite à voir » : un signalement **avance** quand Timy change son statut (En cours, Réglé, Pas
retenu) ou écrit ou modifie sa réponse ; un simple clic sur « Réglé » suffit donc à prévenir la
personne (choix de Claude : l'objectif est qu'elle sache si c'est réglé ou non, même sans réponse
écrite). Tant qu'elle n'a pas vu la suite, la personne a
- un message au démarrage de l'app (« Ton signalement a avancé : ouvre « Signaler un problème » pour
  voir la suite. »), une fois par ouverture de l'app ;
- une pastille avec le nombre sur les entrées « Signaler un problème » qui en portent une (§ 5).

Ouvrir la fenêtre marque la suite comme vue ; pendant cette ouverture, les signalements concernés
gardent l'étiquette « Nouveau ».

### 4.3 Traiter (Timy)

Une page **« Problèmes signalés »** (adresse `#/problemes`), réservée au fondateur hors aperçu « Voir en
tant que » (dans l'aperçu, l'app montre ce que voit le rôle simulé, donc ni la page ni ses liens).

- Accès : depuis la fenêtre « Signaler un problème », qui commence chez lui par « Problèmes signalés :
  2 nouveaux » et un lien « Ouvrir » ; depuis la fenêtre « Mon compte » de l'ancienne navigation ; par
  son adresse. Une autre personne qui ouvre l'adresse est ramenée sur sa page d'accueil habituelle.
- Trois sous-onglets : « À traiter » (Nouveau et En cours, ouvert par défaut), « Réglés » (Réglé et Pas
  retenu), « Tous », chacun avec son nombre.
- Une carte par signalement, la plus récente en haut :
  - qui (nom, rôle, promo) et quand ;
  - le message, en entier ;
  - une ligne de contexte (page, appareil, navigateur, système, version, navigation) et « Voir le
    détail » (tout le contexte, dont les erreurs techniques, en Geist Mono) ;
  - « Voir la capture » s'il y en a une (chargée seulement à la demande) ;
  - « Ouvrir la page » : un simple lien vers l'adresse où la personne était. La page s'ouvre avec la
    promo et le rôle de Timy, pas ceux de la personne (affichés sur la carte) : pour reproduire chez
    elle, Timy change de promo ou passe en aperçu « Voir en tant que » lui-même (choix de Claude : le
    faire d'office toucherait au changement de promo et à l'aperçu, que le lot 4 refait) ;
  - le statut, en quatre boutons (Nouveau, En cours, Réglé, Pas retenu) ;
  - la réponse : un champ prérempli avec la réponse actuelle et « Enregistrer la réponse » ;
  - « Supprimer », avec confirmation.
- Alerte : au démarrage de l'app, s'il y a des signalements nouveaux, un message « 2 nouveaux problèmes
  signalés. » ; et une pastille avec leur nombre sur les entrées « Signaler un problème » qui en portent
  une (§ 5).

Une page vide dit : « Rien à traiter. Les signalements des stagiaires et des formateurs arriveront ici. »

## 5. Où sont les entrées

### 5.1 Entrées

| Navigation | Stagiaire | Équipe (formateur, fondateur) |
|---|---|---|
| Ancienne (interrupteur éteint : les promos aujourd'hui) | Fenêtre « Mon compte » (bouton du nom, en haut) ; panneau de l'Assistant | Fenêtre « Mon compte » ; panneau de l'Assistant |
| Nouvelle, ordinateur et tablette | Menu du compte ; panneau de l'Assistant | Pied de la barre latérale, entre « Assistant » et le compte (icône seule en colonne d'icônes) ; panneau de l'Assistant |
| Nouvelle, téléphone | Menu du compte ; panneau de l'Assistant | Tiroir « Plus », section « Outils » ; panneau de l'Assistant |

- Dans la nouvelle navigation, l'équipe n'a pas la ligne dans son menu du compte : le pied de barre la
  porte déjà (« une chose, un endroit »).
- Le panneau de l'Assistant, commun aux deux navigations, porte sous son avertissement la ligne « Un
  souci avec l'app ? Signaler un problème ». Il reste ouvert derrière la fenêtre.
- Chez le fondateur (hors aperçu), la fenêtre « Mon compte » de l'ancienne navigation ajoute « Problèmes
  signalés », avec le nombre de nouveaux.
- L'entrée ne dépend d'aucun module : c'est un canal d'aide, toujours ouvert.

### 5.2 Icône et pastilles

- Icône propre : une bulle carrée marquée d'un point d'exclamation (Lucide `message-square-warning`),
  différente de la bulle ronde de l'Assistant et du drapeau ⚑ des QCM.
- Pastille (même dessin que celle des nouveautés) : chez le fondateur hors aperçu, le nombre de
  signalements nouveaux ; chez les autres, le nombre de signalements dont la suite n'est pas vue. Elle se pose sur le bouton
  du pied de barre, sur la ligne du tiroir « Plus », sur la ligne du menu du compte et sur le bouton de
  « Mon compte » (ancienne navigation), et se dit dans leur nom accessible. Le lien du panneau de
  l'Assistant n'en porte pas.
- Le bouton du compte et le bouton « Plus » ne reçoivent pas de pastille nouvelle : le message au
  démarrage tient ce rôle, et la refonte garde la main sur ces deux boutons.

### 5.3 Mécanique de la fenêtre

La fenêtre reprend la mécanique des fenêtres de la coquille (`js/nav-fenetre.js`) : une seule ouverte à
la fois (le menu du compte ou le tiroir se ferment en l'ouvrant), Tab reste dans la fenêtre, Échap, un
clic sur le voile ou « Fermer » la ferment et rendent le focus au bouton qui l'a ouverte (ou à un bouton
équivalent affiché), une adresse qui change sous elle la ferme. Ses styles sont à elle
(`css/signalement.css`) et valent pour les deux navigations ; elle passe au-dessus des bandeaux du bas
et du panneau de l'Assistant, sous les messages.

## 6. Ce qui est joint d'office

Montré à la personne avant l'envoi (« Voir le détail »), enregistré avec le signalement.

| Donnée | Exemple | D'où |
|---|---|---|
| Adresse et titre de la page | `#/stagiaires/12/epcf`, « Stagiaires » | l'adresse, le premier titre de la page |
| Heure | 28/10/2026 10:42 | horodatage de la base, et heure de l'appareil |
| Version de l'app | 20261028a | le jeton de version des fichiers |
| Navigation | ancienne, ou nouvelle (espace stagiaire ou équipe) | l'app |
| Aperçu « Voir en tant que » | Stagiaire | l'app (fondateur seulement) |
| Appareil | téléphone, tablette ou ordinateur ; tactile ou non | la largeur de la fenêtre (seuils de la navigation : 700 et 1 080 px) |
| Écran | 390 × 844, densité 3, portrait | le navigateur |
| Navigateur et système | Safari 18.1, iOS 18.1 | l'identifiant du navigateur, lu en clair ; l'identifiant brut est gardé aussi |
| App installée sur l'écran d'accueil | oui | le mode d'affichage |
| Langue, connexion | fr-FR, en ligne | le navigateur |
| Erreurs techniques récentes | les 5 dernières : heure, message (300 caractères au plus), fichier et ligne | un journal tenu par l'app depuis son ouverture |
| Nom, adresse, rôle, promo | V. Timy, fondateur, Nîmes mars 2026 | **posés par la base** à partir du compte connecté et de la promo affichée |

Le journal des erreurs capte les erreurs non rattrapées, les promesses rejetées et les messages
d'erreur que l'app écrit dans la console (elle y écrit ses échecs de chargement). Il vit en mémoire,
n'est envoyé qu'avec un signalement et repart à zéro à chaque ouverture de l'app.

Rien d'autre : ni position, ni contenu de la page, ni historique de navigation, ni adresse IP.

## 7. Données et droits

### 7.1 Tables

`signalements_app` : un signalement.

| Colonne | Rôle |
|---|---|
| `id`, `created_at` | identifiant, horodatage de la base |
| `user_id` | le compte (clé vers `auth.users`, **suppression en cascade** : fermer un compte efface ses signalements) |
| `email`, `nom`, `role`, `promo_id` | posés par la fonction d'envoi ; `role` vaut `stagiaire`, `formateur` ou `fondateur` |
| `message` | 3 à 2 000 caractères |
| `contexte` | le contexte du § 6 (objet JSON, 16 Ko au plus) |
| `avec_capture` | une image est jointe |
| `statut` | `nouveau`, `en_cours`, `regle`, `non_retenu` |
| `reponse`, `repondu_le` | la réponse de Timy et sa date |
| `suivi_le`, `suivi_lu_le` | dernière avancée visible de la personne (statut ou réponse), et quand elle l'a vue |
| `traite_le`, `traite_par_email` | dernière action de Timy |

`signalements_app_captures` : l'image, à part pour qu'aucune liste ne la charge sans le vouloir
(`signalement_id` clé primaire et clé vers le signalement, en cascade ; `image` en JPEG encodé, 700 000
caractères au plus, préfixe `data:image/jpeg;base64,` exigé). Garder l'image dans la base plutôt que dans
un espace de fichiers : elle suit les droits et l'effacement du signalement sans mécanique à part, et le
volume reste faible (quelques centaines de Ko par image, quelques signalements par semaine).

### 7.2 Droits (RLS, la base les applique elle-même)

Écrits avec les fonctions actuelles (`is_founder()`), dans une migration à part avec son retour ; la
conversation « 01 - Rôles et droits en base » les reprendra dans son modèle de rôles.

| Action | Qui | Comment |
|---|---|---|
| Lire un signalement et sa capture | la personne qui l'a envoyé ; le fondateur | règle de lecture |
| Créer | toute personne connectée | fonction `signaler_probleme` uniquement (aucune écriture directe) |
| Changer le statut, répondre | le fondateur | fonction `traiter_signalement_app` |
| Marquer la suite comme vue | la personne, pour les siens | fonction `marquer_suivis_vus` |
| Supprimer | le fondateur | règle de suppression |

Fonctions (définies en `security definer`, chemin de recherche fixé) :
- `signaler_probleme(message, contexte, capture)` : exige une session ; pose le compte, l'adresse, le nom
  affiché (« V. Timy » pour un stagiaire, le nom du formateur, sinon l'adresse), le rôle et la promo
  affichée (`promo_courante()`) ; contrôle la longueur, le contexte et l'image ; refuse au-delà de 10
  signalements sur 24 heures, fondateur compris ; supprime au passage les signalements de plus de 12
  mois ; renvoie l'identifiant. Ses refus commencent par « signalement: », suivi de la phrase à montrer.
- `traiter_signalement_app(id, statut, reponse)` : fondateur seulement ; un statut changé vers En cours,
  Réglé ou Pas retenu, ou une réponse écrite ou modifiée, posent `suivi_le` et remettent `suivi_lu_le` à
  vide (repasser à Nouveau ne prévient pas).
- `marquer_suivis_vus()` : ceux de la personne connectée seulement.
- `mes_signalements_app()` : les dix plus récents de la personne connectée, triés sur la dernière
  avancée ou, à défaut, la création (la règle de lecture laisserait le fondateur tout voir : la fonction
  filtre sur le compte).
- `compter_signalements_app()` : `{ nouveaux, suivis }`, où `nouveaux` vaut 0 pour qui n'est pas
  fondateur et `suivis` compte les signalements de la personne dont la suite n'est pas vue.

### 7.3 Effacement

- Fermeture d'un compte (dont l'anonymisation d'un stagiaire et celle d'une promo, qui suppriment le
  compte) : signalements et captures partent en cascade.
- 12 mois après sa création, un signalement est supprimé (au prochain signalement envoyé, par la fonction
  d'envoi).
- Le fondateur peut supprimer un signalement à tout moment.

## 8. Données personnelles

- Registre des traitements (`docs/legal/registre_traitements.md` du dépôt ECSR) : nouveau traitement
  « Signalements de problème sur l'application » (finalité : corriger l'app et répondre ; base légale :
  intérêt légitime ; données : message, capture facultative, contexte du § 6, identité du compte ;
  destinataire : l'éditeur seul ; sous-traitant : Supabase, UE ; durée : 12 mois au plus, fermeture du
  compte ; sécurité : droits appliqués par la base, écriture par fonction seulement).
- Conditions d'utilisation (`js/legal-data.js`) : la ligne « Contributions » du § 3 cite les
  signalements de problème ; le tableau « Qui voit quoi » gagne la ligne « Signalements de problème :
  vous, l'éditeur » ; le tableau des durées, la leur. **La version ne change pas** (choix de Claude) :
  même finalité (faire fonctionner l'application), ni nouveau destinataire (l'éditeur), ni nouveau
  prestataire, ni durée allongée ; la règle du fichier réserve le changement de version à ces cas.
  Timy peut décider l'inverse : tout le monde devra alors accepter de nouveau.
- Un champ libre peut recevoir des données sensibles : l'exemple du champ et le texte des conditions
  invitent à décrire le problème de l'app, pas sa situation personnelle.

## 9. Mise en ligne

- Entrée Nouveautés pour tous, dans le même commit que la fonction : « Signaler un problème en deux
  gestes » (où le trouver dans l'ancienne navigation : son nom en haut, ou l'Assistant).
- Le jour de l'allumage de la nouvelle navigation, l'entrée Nouveautés de la refonte dira où se trouve
  désormais « Signaler un problème » (menu du compte, pied de barre) : à signaler à la conversation de
  la refonte.
- Migration appliquée par Timy, ou sur son accord, après la répétition à blanc (§ 10) ; puis fusion dans
  `main`, que Timy pousse lui-même.

## 10. Tests et vérification

- Règles pures (`tests/signalement-rules.test.mjs`, `node --test`) : lecture de l'identifiant du navigateur
  (iPhone, iPad qui se dit Mac, Android, Chrome, Firefox, Edge, Samsung Internet), classe d'appareil selon
  la largeur, contexte assemblé et sa ligne résumée, validation du message, libellés des statuts, journal
  des erreurs (troncature, cinq au plus), réduction de l'image, texte et nom des pastilles.
- Preuve SQL rejouable (`tests/sql/signalements-app-preuve.sql`), avec répétition de la migration dans
  le bloc qui s'annule toujours (méthode du 23/10) : création par la fonction seulement, nom et rôle posés
  par la base, lecture limitée à soi, fondateur qui lit tout, statut et réponse réservés au fondateur,
  avancée qui prévient (statut seul ou réponse), suite vue limitée à soi, limite de 10 par jour, purge
  à 12 mois, image refusée hors format, cascade à la suppression du compte ; contre-épreuve sur les cas
  visés. Jouée sur une base Postgres locale jetable (comme `qcm-ia-preuve.sql`), puis, après l'accord
  de Timy et l'application, rejouée sur la base réelle dans son bloc qui s'annule.
- Banc d'essai (`_harness.html`, faux Supabase, jamais la base réelle) et script
  `outils/verifier_signalement.py` (Chromium et WebKit ; stagiaire, formateur, fondateur ; les deux
  navigations ; 1 280, 900 et 375 px) : chaque entrée du § 5 visible et à 44 px sur téléphone, fenêtre
  ouverte puis fermée par Échap avec le focus rendu, envoi avec le bon contexte, image réduite sous la
  limite, échec d'envoi qui garde le texte, page du fondateur (sous-onglets, statut, réponse, suppression),
  aucun défilement de côté, contraste AA des nouveaux textes, aucun tiret cadratin.
- Non-régression : `node --test "tests/*.test.mjs"` et `python outils/verifier_navigation.py`
  (interrupteur éteint = main, sauf les nouvelles entrées).
- Captures pour Timy : stagiaire et formateur, ordinateur et téléphone, ancienne et nouvelle navigation,
  plus la page du fondateur.

## 11. Laissé au plan

- Découpage en tâches, ordre, et noms exacts des fichiers et des fonctions.
- Le détail du faux Supabase du banc pour les nouvelles fonctions (avec, à la fin, la copie de ces ajouts
  dans le banc de `TP_ECSR_App`, qui n'est pas versionné).
- La forme des erreurs et des états vides des cartes, dans le respect du § 3.

## 12. Choix faits par Claude (à vérifier en lisant)

- La version des conditions d'utilisation ne change pas (§ 8).
- L'image vit dans la base, dans une table à part, plutôt que dans un espace de fichiers (§ 7.1).
- Toute avancée prévient la personne, un changement de statut sans réponse compris (§ 4.2).
- « Ouvrir la page » est un simple lien, avec la promo et le rôle de Timy (§ 4.3).
- La limite de 10 signalements par jour vaut aussi pour le fondateur (§ 7.2).
- Ni le bouton du compte ni « Plus » ne reçoivent de pastille nouvelle ; un message au démarrage
  prévient (§ 5.2).
- Coordination : le lot 4 (branche `lot4-roles`) fait passer l'aperçu « Voir en tant que » par un
  en-tête ; ce chantier ne touche ni à l'aperçu ni au changement de promo.
