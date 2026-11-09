# Lot C de l'audit du 09/11 : notes et examens

Conception validée avec Timy le 09/11/2026, maquette par maquette (saisie sur téléphone, états vides, bouton
d'examen). Audit d'origine : `docs/qualite/audit-2026-11-09.md` (lot C, critères G, K, F du référentiel
`docs/qualite/referentiel.md`).

Repère : **(Timy)** marque ce que Timy a décidé, **(choix de Claude)** ce que j'ai proposé sans qu'il le
tranche. Le reste découle de l'audit ou de l'existant.

## 1. Intention

La saisie des notes est l'usage n°1 de l'app (211 notes en 30 jours), et les testeurs du 09/11 l'ont jugée
bloquante sur téléphone. Les cases de la matrice font environ 24 px, les colonnes sont coupées et les en-têtes
sont des sigles verticaux : on risque de mettre une note au mauvais stagiaire. Les pages de notes vides
affichent des tirets, six barres « Aucune note » et une phrase de développeur. Enfin, une formatrice n'a pas
trouvé comment ouvrir l'examen d'un QCM : le bouton n'existe que dans la fiche du QCM.

**Fait posé par Timy le 09/11 :** la plupart des notes seront saisies automatiquement par l'examen des QCM.
Le déclencheur `mirror_exam_to_evaluations` (`docs/specs/2026-07-01-qcm-examen-lot2-migration.sql`) écrit la
note de chaque examen dans `evaluations` : une ligne par passage, avec `observation = 'QCM examen'` et
`qcm_attempt_id` renseigné. Conséquences :

- **ouvrir un examen devient le geste principal** de la formatrice ;
- **la saisie à la main** sert surtout aux 4 compétences (C1, C2, REMC, GDE, qui n'ont pas de QCM), aux thèmes
  évalués autrement et aux corrections ;
- **les états vides** expliquent que les notes arrivent avec les examens.

## 2. Objectifs, hors champ, anti-objectifs

**Objectifs**

- **C1.** Saisir une note sur téléphone sans risque d'erreur de ligne.
- **C2.** Remplacer chaque état vide brut par une phrase et une action.
- **C3.** Ouvrir et fermer l'examen d'un QCM depuis la liste des thèmes.
- Ajouter au robot le parcours « saisir une note ».

**Hors champ**

- **Aucun changement en base** : ni migration, ni fonction, ni règle d'accès. Tout passe par les fonctions
  existantes (`addEvaluation`, `updateEvaluation`, `deleteEvaluation`, `publishQcm`, `unpublishQcm`).
- **Aucune refonte de la matrice.** Elle reste la seule page autorisée à défiler de côté.
- **Le réglage de l'examen** (nombre de questions, temps, tirage) reste dans la fiche du QCM.
- **Pas de compteur de passages dans la liste** (« 4 sur 6 ont passé l'examen ») : il faudrait une requête de
  plus. C'est une piste pour plus tard.
- **Le code mort `renderAveragesChart`** reste en place : ce ménage relève d'un autre lot.

**Anti-objectifs.** Le travail échoue, même s'il « marche », s'il produit l'un de ces résultats :

- une note enregistrée au mauvais stagiaire ;
- un enregistrement ou un échec que personne ne voit (critère E) ;
- un défilement de côté hors de la matrice ;
- une note écrite en rouge ;
- un bouton d'examen visible par qui ne peut pas s'en servir.

## 3. C1 : le sous-onglet « Saisir »

**Saisie thème par thème pour toute la classe (Timy)**, d'après la maquette validée le 09/11.

**Place et accès**

- La page « Notes et examens » gagne un sous-onglet **« Saisir »**. Les sous-onglets se lisent alors
  « Saisir · Matrice · EPCF ».
- Il n'existe que pour qui peut écrire des notes : `admin` dans `rerender`, qui vaut `isAdmin()`.
  `canManageExam()` (§ 5) vaut aussi `isAdmin()` : c'est le même ensemble de personnes. Le rôle de rédacteur
  du lot 5 concerne la création des QCM, pas les notes. Sans « Saisir », un écran tactile s'ouvre sur
  « Matrice ».
- Il n'existe ni dans La classe de Mon suivi (vue imbriquée), ni dans la vue en lecture de la direction ou du
  siège (lot 5 : `dansLeCentre`).
- **Les stagiaires ne le voient jamais (Timy).**
- **Page d'ouverture (choix de Claude).** Sans sous-onglet en mémoire (`ecsr_notes_subtab`), un écran tactile
  (`pointer: coarse`) s'ouvre sur « Saisir », un ordinateur sur « Matrice ». Une fois qu'on a choisi un
  sous-onglet, la mémoire l'emporte, comme aujourd'hui.

**Étape 1 : choisir ce qu'on note**

- **Une liste en deux parties.**
  - « Compétences » : les 4 compétences, écrites en toutes lettres à partir des libellés de
    `MATRIX_SPECIAL_COLS`.
  - « Thèmes » : les 57 thèmes, numéro et titre. Les thèmes 46 et 47 forment une seule ligne, comme dans la
    matrice (`THEME_GROUPS`), et la note s'enregistre sur le thème 46, comme la cellule fusionnée.
- **Un champ de recherche** filtre sur le numéro ou le titre, sans tenir compte des accents ni des majuscules.
- **Chaque ligne affiche son avancement** : « 6 sur 6 », « 2 sur 6 » ou « aucune ». On compte les stagiaires
  qui ont une note, parmi ceux qui forment les lignes de la matrice.
- **Chaque ligne est une cible de 44 px** au moins.

**Étape 2 : une ligne par stagiaire**

- **En-tête.**
  - Un bouton « Retour » ramène à la liste (Échap fait de même sur ordinateur).
  - Le titre reprend la ligne choisie : « 22 · Feux du véhicule ».
  - Le compteur « 2 sur 6 enregistrées » se met à jour à chaque enregistrement.
- **La date.** On lit « Date des notes : 9 nov. » et un lien « Changer » qui ouvre un sélecteur de date. C'est
  la même date que la barre d'outils de la matrice (`currentEvalDate`) : changer l'une change l'autre.
- **Les lignes**
  - Une ligne par stagiaire, **dans l'ordre alphabétique (choix de Claude)**, celui de l'option alphabétique du
    tri de la matrice. Les mêmes stagiaires que les lignes de la matrice.
  - Le nom est écrit en grand, le champ à droite.
- **Le champ**
  - Il mesure environ 48 px de haut, avec un texte de 20 px et `inputmode="decimal"`.
  - Son nom accessible est « Note de <nom> sur 20 ».
  - Il accepte « 14 », « 14,5 » ou « 7/10 » (`parseNoteInput`).
  - Une note déjà en base apparaît dans son champ.
  - Entrée passe au champ suivant.
- **L'enregistrement** se fait quand on quitte le champ, comme dans la matrice. Un champ inchangé n'écrit rien.
- **Sous le nom, une ligne d'état** :
  - « Enregistrée » juste après l'enregistrement ;
  - « 7/10 converti en 14/20 » quand une conversion a eu lieu ;
  - pour une note déjà là, son origine *(choix de Claude)* : « Examen QCM du 12 oct. » si elle vient d'un
    examen (`qcm_attempt_id` renseigné ou `observation = 'QCM examen'`), sinon « Saisie le 12 oct. ».
- **Modifier une note d'examen** la remplace, comme dans la matrice aujourd'hui *(règle existante gardée)*.
- **Plusieurs lignes pour un même stagiaire et une même cible** (plusieurs dates, une note corrigée, un
  examen puis une saisie) : on garde exactement la règle de la matrice. La note affichée est la plus récente
  par `date_eval` (`noteForStagiaireTheme`, `noteForStagiaireCompetence`).
  - **Écrire modifie cette ligne-là**, en lui donnant la date `currentEvalDate`.
  - **Le « n sur N » de l'étape 1** compte un stagiaire dès qu'il a au moins une ligne.
  - Le code commun extrait de `inlineCellEdit` porte cette règle à l'identique.
- **Note invalide.** Le message de `parseNoteInput` s'affiche **sous le champ**, dans la ligne d'état, et pas
  seulement dans une notification. La valeur tapée reste dans le champ, pour être corrigée.
- **Champ vidé sur une note existante.** Une confirmation nommée demande « Effacer la note de <nom> ? ». Si
  on refuse, la note revient dans le champ.
- **Échec d'écriture.** La ligne d'état affiche « Pas enregistrée : <raison>. Réessaie. » et la valeur reste
  dans le champ.
- **Annuler.** Ctrl+Z annule le dernier enregistrement, comme dans la matrice (`recordUndo`).

**Code commun (recommandé).** La logique d'enregistrement de `inlineCellEdit` (lecture, conversion,
création, modification, effacement, retour en arrière, mise à jour de `evaluations` et des statistiques) est
sortie dans une seule fonction. La matrice, la fiche d'un stagiaire et « Saisir » l'appellent toutes les trois,
pour qu'une même règle ne vive qu'à un endroit.

**Légende de la matrice (choix de Claude).** Sous le tableau, une ligne explique les sigles : « C1 : … ·
C2 : … · REMC : … · GDE : … ». Les libellés viennent de `MATRIX_SPECIAL_COLS`. Tous ceux qui voient la
matrice voient aussi la légende.

## 4. C2 : les états vides

Une règle unique : **une phrase et une action**. L'action ne mène jamais à la page où l'on est déjà.

| Où | Quand | À la place de l'actuel |
|---|---|---|
| Notes et examens, onglet Matrice | aucune note chez les stagiaires en formation | Une carte remplace la synthèse et les graphiques. Titre « Aucune note pour l'instant ». Phrase : « Les notes arrivent ici toutes seules quand un stagiaire passe un examen QCM. Tu peux aussi les saisir toi-même. » Boutons : « Ouvrir un examen » et « Saisir des notes » (bascule sur l'onglet Saisir). La matrice reste affichée sous la carte, car c'est l'outil de saisie sur ordinateur. |
| Notes et examens, onglet Saisir | même cas | La même carte au-dessus de la liste, avec le seul bouton « Ouvrir un examen ». |
| La classe (Mon suivi), stagiaire | aucune note dans la classe | Ni matrice, ni synthèse, ni graphiques. Une carte « Pas encore de notes », la phrase « Les notes de la classe apparaîtront après le premier examen. » et le bouton « M'entraîner sur un QCM ». |
| La classe, formateur | même cas | La même carte, avec le bouton « Ouvrir un examen ». |
| Vue en lecture de la direction (lot 5) | même cas | La carte avec sa phrase, sans bouton : la direction ne peut ni ouvrir ni saisir. |

**Où mènent les boutons.** « Ouvrir un examen » mène à `#/themes`, sur le sous-onglet de la liste des thèmes.
« M'entraîner sur un QCM » mène à `#/themes`, sur le sous-onglet QCM. Dans les deux cas, on mémorise le
sous-onglet avant de naviguer, avec la clé `CLES_SOUS_ONGLETS.themes`, comme le fait `renvoiNotesQcm` dans
`js/views/mon-suivi.js`.

**Quand il n'y a que quelques notes :**

- **Le graphique « Par stagiaire »** ne dessine plus de barre pour un stagiaire sans note. Une ligne en dessous
  les compte : « 2 stagiaires sans note pour l'instant. » C'est un nombre, sans nom, donc sans question
  d'anonymat. Même traitement partout où une barre affichait « Aucune note » (`notes.js`, les deux
  `val.textContent = "Aucune note"`).
- **L'indicateur « Notes < 10/20 »** devient « Notes sous 10/20 ». À 0, il est neutre, sans fond vert
  *(choix de Claude)*. Au-dessus de 0, il garde son style actuel, à condition que ce style ne soit pas rouge.
- **La phrase « Pas encore assez de notes par thème pour ranker. »** disparaît : `themeStats()` n'est vide que
  s'il n'existe aucune note de thème. S'il existe des notes de compétence mais aucune de thème, elle devient :
  « Le classement des thèmes apparaîtra avec les premières notes de thème. »
- **« Moyenne classe » et « Médiane »** ne peuvent plus afficher « - » quand il n'y a aucune note, puisque la
  carte les remplace dans ce cas.

**Cas limite.** Des notes peuvent exister seulement pour des stagiaires en abandon, que les statistiques
excluent. Dans ce cas :

- la synthèse et les graphiques suivent la règle des statistiques : la carte s'affiche ;
- la matrice suit ce qu'elle affiche déjà.

À trancher en construisant, sans changer de règle de calcul.

## 5. C3 : ouvrir et fermer l'examen depuis la liste des thèmes

Décidé à partir de la maquette validée le 09/11 et de la demande de la testeuse formatrice : un bouton dans
chaque ligne, avec la date de fermeture.

**Qui le voit.** Le bloc d'examen n'apparaît que si `canManageExam()` est vrai et, après le lot 5, si
`!sansPromo()` l'est aussi. Pour les stagiaires, rien ne change : ils gardent la pastille « Examen ouvert ».
Pour le formateur, le bloc remplace cette pastille, pour ne pas afficher deux fois l'information.

**Contenu du bloc, dans la cellule QCM de chaque thème qui a un QCM :**

- **Examen fermé** (`!examenDemarrable(qcm)`, y compris quand l'échéance est passée) : la ligne
  « Examen fermé » et le bouton **« Ouvrir l'examen »**.
- **Examen ouvert** : la ligne affiche l'heure de fin plutôt qu'un compte à rebours *(choix de Claude)*. Une
  heure fixe se lit d'un coup d'œil et reste juste si la page reste affichée.
  - « Ouvert jusqu'à 16 h 30 » quand l'échéance tombe aujourd'hui ;
  - « Ouvert jusqu'au 10 nov., 23 h 59 » quand elle tombe un autre jour ;
  - « Ouvert sans limite » quand il n'y a pas d'échéance.

  Puis le bouton **« Fermer l'examen »**.
- **Sur téléphone**, le bouton QCM et le bouton d'examen se partagent la largeur de la ligne et font 44 px de
  haut.
- **Sur ordinateur**, la place exacte dépend de la grille actuelle de la liste : une colonne à droite de la
  cellule QCM, comme sur la maquette, ou la même cellule en dessous. Ni l'une ni l'autre ne doit faire défiler
  de côté à 1 280 px.

**Ouvrir.** Le bouton ouvre la fenêtre de durée qui existe déjà (« Ouvrir l'examen pour combien de temps ? »,
`DUREES_OUVERTURE`).

- La fenêtre nomme désormais le thème sous son titre : « Thème 22 · Feux du véhicule ».
- **(choix de Claude)** Sous le titre, la fenêtre résume l'examen qui va partir, avec les mêmes
  informations que la ligne d'état de la fiche : « 20 questions · 30 s par question · tirage au hasard ». La
  formatrice voit ce qu'elle ouvre sans passer par la fiche. Le comportement de l'ouverture reste celui de la
  fiche aujourd'hui : si aucun tirage n'est figé, toutes les questions qui ont des réponses sont figées.
- La liste ne montre que les QCM qui ont des questions (`qcmByTheme` filtre `nb_questions > 0`). Un QCM vide
  n'a donc pas de bouton d'examen : son thème garde « Créer QCM ».
- `demanderDuree` et `doPublishNow` sortent de `themeExamPanel` pour devenir une fonction commune. La fiche et
  la liste l'appellent toutes les deux.
- Après la réussite, la notification actuelle (`toast`) s'affiche : l'action vient de la personne. Puis la ligne
  ou la liste se redessine.
- En cas d'échec, la notification d'erreur actuelle s'affiche.

**Fermer (choix de Claude : avec confirmation).** Le bouton demande d'abord : « Fermer l'examen du thème 22 ?
Les stagiaires ne pourront plus le démarrer. »

- Avant d'écrire la suite de la phrase sur les passages en cours, le constructeur vérifie ce que devient un
  passage commencé quand `unpublishQcm` ferme l'examen.
- Le bouton « Fermer maintenant » de la fiche passe par la même fonction, donc par la même confirmation.

## 6. Robot des parcours

- **Nouveau parcours « Saisir une note »**, dans `outils/parcours/equipe.py` : un formateur, en nouvelle
  navigation, joué sur les deux moteurs et les deux formats.
  - Le chemin : depuis l'accueil, « Notes et examens », puis « Saisir » (sur téléphone, la page s'ouvre déjà
    dessus), puis le thème 22.
  - Il tape 14 dans le champ du premier stagiaire, puis Tab.
  - Le parcours réussit si « Enregistrée » s'affiche.
  - **Budget : 3 clics**, plus la frappe. Sur téléphone, le passage par « Plus » compte, selon la règle du
    référentiel.
  - L'écriture se touche avec `ecriture=True`.
- **Second parcours (choix de Claude) : « Ouvrir un examen depuis la liste »**. Depuis l'accueil, on va dans
  Cours et QCM, puis « Ouvrir l'examen » sur un thème, puis « 1 heure ». Le parcours réussit si « Ouvert
  jusqu'à … » s'affiche. Budget : 3 clics.
- **Données du banc.** Le faux client du banc repart de zéro à chaque chargement de page, mais les deux
  parcours ne doivent pas dépendre de valeurs précises.
  - « Saisir une note » vise un stagiaire et un thème **sans note** dans la démo, ou tape une valeur différente
    de celle qui est en place, pour qu'un enregistrement ait bien lieu.
  - « Ouvrir un examen » vise un thème dont le QCM est fermé dans la démo, et referme l'examen en fin de
    parcours (« Fermer l'examen », puis confirmer). Cela joue aussi la fermeture.
- **Référentiel.** Dans `docs/qualite/referentiel.md`, la ligne « Saisir une note, voir les passages d'un
  stagiaire » passe de « plus tard » à « oui (saisie) ». La ligne de l'examen s'ajoute.
- **Défauts connus.** Toute ligne de `outils/parcours/connus.py` corrigée par ce lot est retirée.

## 7. Contraintes

- Le tiret cadratin est interdit, partout.
- On écrit « Formateur », jamais « Prof ».
- L'app tutoie : les stagiaires, et aussi les formateurs, comme le reste de l'app (« Touche une case… »).
- Aucun vrai nom ni aucune clé dans le dépôt, qui est public.
- **Téléphone.** Cibles de 44 px, aucun défilement de côté hors de la matrice.
- **Lisibilité.** Contraste AA, jamais une note en rouge.
- **Typographie.** Outfit à l'écran, `tabular-nums` pour les chiffres, ni Canela ni `--font-mono`.
- **Couleurs.** Elles passent par les variables du `:root` (garde : `tests/habillage-jetons.test.mjs`). Les deux
  habillages (ecsr, ecf) se vérifient.
- **Messages.** Un message que la personne n'a pas provoqué passe par `annoncer()`. Les notifications de ce lot
  suivent toutes une action de la personne : `toast()`.
- **Nouveautés.** Une entrée dans `js/nouveautes-data.js`, dans le commit de fusion. Si l'entrée est classée
  comme une correction, elle s'ajoute aussi à `tests/nouveautes.test.mjs`.
- **Ordre de fusion.** Le lot 5 (`lot5-espaces`, non fusionné) modifie `notes.js` et `themes.js`
  (`dansLeCentre`, `sansPromo`, `isRedacteur`). Au 09/11, il n'est pas fusionné.
  - La branche `lot-c` part de main, et le plan se fait en deux temps : d'abord tout ce qui ne dépend pas du
    lot 5.
  - Une fois le lot 5 fusionné, `lot-c` se met à jour avec main. Une tâche dédiée ajoute alors les deux cas
    qui en dépendent : la carte sans bouton de la direction (`dansLeCentre`) et `!sansPromo()` sur le bloc
    d'examen.
  - Les contrôles se repassent ensuite.

## 8. Laissé au constructeur

- La structure du code de « Saisir » : un module à part (par exemple `js/views/notes-saisie.js`) ou des
  fonctions dans `notes.js`.
- La place exacte du bloc d'examen dans la grille de la liste sur ordinateur, dans le respect du § 5.
- La forme de la confirmation : `confirm()` du navigateur, comme la matrice, ou la fenêtre de l'app si elle
  existe.
- Le libellé du nom des stagiaires : le même que dans la matrice.
- Les tests unitaires :
  - au minimum, le comptage « n sur N » de l'étape 1 ;
  - le format « Ouvert jusqu'à … » (aujourd'hui, un autre jour, sans limite) ;
  - le choix de la carte vide selon le rôle.
