# Barre simple, onglet CCP2 et espaces personnels : design (lot 1)

> Chantier D du dispatch du 01/10/2026 (« grands onglets CCP1 et CCP2 »). Branche `onglets-ccp`,
> worktree `C:/Users/watch/Dev/ecsr-promo-onglets-ccp` (hors du dossier ECSR, comme A et B).
> Cette version remplace celle de la nuit du 02 au 03/10 (onglet CCP1 regroupant Thèmes, Notes,
> EPCF, Livret et Dossier pro), écartée par Timy à sa relecture du 03/10 ; elle reste dans
> l'historique git. Décisions prises avec Timy le 03/10, section 2.
> Dépendance : chantier B (modules), en production depuis le 02/10 (`7d2ab74`).

## 1. Objectif

Une navigation **la plus simple et la plus instinctive possible**, sur le modèle des applis
Apple :
- **un onglet ne déménage jamais** : il peut apparaître (un module qui s'ouvre), pas changer de
  place ni disparaître dans un autre ;
- **une chose, un endroit, selon qu'on est stagiaire ou formateur** ;
- **Mon espace, c'est ce qui est à moi ; Notes, c'est la classe.**

Le lot 1 simplifie la barre et ajoute le parcours CCP2. Le lot 2 (section 11) donnera aux
formateurs un accès centralisé à l'espace de chaque stagiaire.

## 2. Décisions (Timy, 03/10)

| Question | Décision |
|---|---|
| Onglet CCP1 regroupant Thèmes, Notes, EPCF… | **Abandonné** : ce qui sert au CCP1 est le quotidien de la formation, et le dossier pro comme le livret EPCF couvrent les deux CCP |
| Interrupteur CCP1 / CCP2 | **Abandonné** après examen : presque tout est commun aux deux CCP, il n'aurait basculé qu'un onglet |
| CCP2 | Un onglet **CCP2** qui apparaît le jour où un formateur l'ouvre (module `ccp2`) ; il porte le parcours guidé en 8 étapes (décidé le 02/10) |
| Priorités | Quitte la barre : **bouton « Priorités » en haut du Planning** |
| Thèmes | Devient **Cours**, avec deux sous-onglets **Thèmes** et **Compétences** |
| Dossier pro et livret EPCF | Côté stagiaire : **seulement dans Mon espace**. Côté formateur : dans Notes, comme aujourd'hui (puis lot 2) |
| Découpage | Lot 1 : la barre (cette spec). Lot 2 : l'espace stagiaires des formateurs |

## 3. Navigation

### 3.1 La barre

| Moment | Onglets |
|---|---|
| Avant | Accueil · Priorités · Planning · Calendrier · Thèmes · Notes · Ressources · Paramètres |
| Début de formation | Accueil · Planning · Calendrier · **Cours** · Notes · Ressources · Paramètres |
| Période CCP2 | Accueil · Planning · Calendrier · Cours · Notes · **CCP2** · Ressources · Paramètres |

Les modules de B continuent de décider de ce qu'un stagiaire voit (Cours et Notes n'apparaissent
qu'une fois ouverts pour une promo réglée). Huit onglets tiennent sur un iPhone de 375 px sans
défiler (mesuré au banc le 03/10). Les adresses ne changent pas : Cours garde l'adresse
`#/themes`, Priorités garde `#/dashboard`.

Icônes : Cours prend une icône de livre ouvert (`book`, nouvelle), CCP2 un carré marqué « 2 »
(`ccp2`).

### 3.2 Priorités, dans le Planning

- Un bouton **« Priorités »** (icône cible) dans l'en-tête du Planning, à droite du titre comme
  « Ajouter une notion » dans Cours. Il n'encombre pas la barre de semaine, déjà pleine sur iPhone.
- Visible des formateurs, et des stagiaires si le module `priorites` est ouvert pour leur promo
  (règle de B, inchangée).
- La page Priorités garde son adresse ; l'onglet **Planning reste allumé** pendant qu'on la
  consulte ; un lien « ‹ Planning » en tête de page ramène en un geste.

### 3.3 Cours (ex-Thèmes)

En-tête : titre « Cours », ligne de progression « 31 / 57 thèmes officiels terminés », bouton
« Ajouter une notion » pour les formateurs. Puis les sous-onglets, mémorisés :

| Sous-onglet | Familles affichées |
|---|---|
| **Thèmes** | les 57 thèmes officiels et les QCM transversaux (sanctions, dates clés, statistiques) |
| **Compétences** | compétences de l'enseignant (TP ECSR), compétences de conduite (REMC, puis les cours C1 à C4 du chantier C), notions pédagogiques, autres |
| ⚑ Signalements | formateurs seulement, inchangé |

Chaque sous-onglet garde la mécanique actuelle : recherche, filtre de statut, sections par
famille, colonnes Cours et QCM. Les pastilles de famille n'apparaissent que s'il y a plus d'une
famille à choisir. Un sous-onglet mémorise sa propre pastille active.

Les QCM transversaux sont rangés avec les thèmes (ce sont des connaissances, pas des compétences) :
s'ils doivent passer côté Compétences, c'est une ligne à changer.

### 3.4 Notes : la classe

| Qui | Sous-onglets |
|---|---|
| Stagiaire | Matrice · EPCF (moyennes de la classe) |
| Formateur | Matrice · EPCF · Livret EPCF · Dossier pro (ses outils de saisie et de relecture, jusqu'au lot 2) |

S'il ne reste qu'un sous-onglet visible, la barre disparaît (comportement de `renderSubTabs`).

### 3.5 Mon espace : ce qui est à moi

Sous-onglets : Passages · EPCF · Évolution · **Livret EPCF** · Dossier pro.

- Le **livret EPCF** y arrive : le stagiaire y consulte le sien (lecture seule, comme aujourd'hui
  dans Notes), juste sous le champ « Date de naissance » qui le remplit.
- Un formateur qui regarde l'espace d'un stagiaire (sélecteur « Élève ») y voit le livret de ce
  stagiaire, **en saisie**. `renderEpcfLivret` gagne pour cela l'option `stagiaireId`, comme
  `renderDp` l'a déjà. Elle resservira au lot 2.

### 3.6 CCP2 : le parcours

Inchangé par rapport à la version de la nuit, déjà vérifié au banc :
- carte « L'épreuve en bref » (1 h 30 en trois temps, deux productions, 140 heures de période en
  entreprise, liens vers les référentiels et la boîte à outils) ;
- « Tes dates » : événements du Calendrier dont le titre contient « CCP2 » (formation, stages,
  examen), si le Calendrier est ouvert ;
- les 8 étapes repliables (trouver un commanditaire, analyser la demande, construire l'action,
  animer la séance, analyser sa pratique, rédiger le dossier, préparer l'oral, le jour de
  l'épreuve), chacune avec ce que le jury regarde, comment s'y prendre, quoi garder pour le
  dossier, des liens utiles et sa source ;
- dernière étape ouverte mémorisée ; nombres et durées insécables (« 45 000 », « 1 h 30 »).

Texte : `js/ccp2-parcours-data.js` (critères du REAC mot pour mot, exigences du référentiel
d'évaluation). Les liens internes du parcours suivent les modules (pas de lien vers les cours ou
le dossier pro s'ils sont fermés pour la promo).

### 3.7 Accueil

Les tuiles suivent la barre : Planning, Calendrier, Cours, Notes, CCP2, Ressources. La tuile
Priorités disparaît (le bouton du Planning la remplace).

## 4. Modules (branchement sur B)

- **Catalogue** : les groupes de B, plus un groupe « CCP2 » ; nouveau module `ccp2` (nom « CCP2 »,
  annonce « L'onglet CCP2 est ouvert »).
- **Noms affichés** (les clés stockées ne changent pas) : le module `themes` s'affiche « Cours » ;
  le module `cours` (lecture d'un cours) s'affiche « Lecture des cours », pour ne pas avoir deux
  « Cours » dans le réglage.
- **Livret EPCF** perd son parent `notes` : il n'est plus rangé dans Notes côté stagiaire.
- **Textes** : les explications et annonces disent « Cours » au lieu de « Thèmes », « en haut du
  Planning » pour Priorités, « dans ton espace personnel » pour le livret.
- `MODULE_DE_SOUS_ONGLET["mon-suivi"]` gagne `livret` ; `STORAGE_SOUS_ONGLET` gagne `themes`
  (pour qu'un lien « Où le trouver » puisse viser un sous-onglet de Cours).
- La mécanique d'« onglet regroupé » de la nuit (`ONGLETS_REGROUPES`, `routeOuverte`) est retirée :
  sans onglet CCP1, elle n'a plus d'usage.

## 5. Nouveautés et assistant

- Deux entrées « tous » : « Une barre plus simple » (Cours, Priorités dans le Planning, livret et
  dossier dans Mon espace) et « Nouvel onglet CCP2 : ton parcours en 8 étapes » (module `ccp2`).
- Les liens « Où le trouver » des anciennes nouveautés disent « Cours » au lieu de « Thèmes » ;
  celle du livret mène à Mon espace.
- `supabase/functions/chatbot/aide.mjs` décrit la nouvelle barre (redéploiement par Timy).

## 6. Architecture

| Fichier | Changement |
|---|---|
| `js/main.js` | barre (`TABS`), route `ccp2`, Planning allumé sur Priorités |
| `js/views/themes.js` | en-tête « Cours », sous-onglets Thèmes, Compétences, Signalements |
| `js/views/notes.js` | Livret EPCF et Dossier pro réservés aux formateurs |
| `js/views/mon-suivi.js` | sous-onglet Livret EPCF |
| `js/views/epcf-livret.js` | option `stagiaireId` |
| `js/views/planning.js` | bouton Priorités dans l'en-tête |
| `js/views/dashboard.js` | lien « ‹ Planning » |
| `js/views/home.js` | tuiles |
| `js/views/ccp2.js`, `js/ccp2-parcours-data.js`, `js/ccp-rules.js` | parcours CCP2 (déjà écrits) |
| `js/modules-data.js`, `js/nouveautes.js`, `js/nouveautes-data.js` | section 4 et 5 |
| `js/modules.js`, `js/modules-etat.js` | retour à leur version de B |
| `js/icons.js` | icônes `book` et `ccp2` |
| `css/style.css` | parcours CCP2 (bloc en fin de fichier) |
| `supabase/functions/chatbot/aide.mjs`, `PROJECT_NOTES.md`, `_preview_modules.html` | documentation, banc |

Aucune table, aucune migration, aucune règle d'accès nouvelle.

## 7. Sécurité

Rien de nouveau côté données : le livret et le dossier gardent leurs règles d'accès (un stagiaire
ne lit que les siens, le formateur écrit). Le sous-onglet Livret de Mon espace ouvre le livret
du stagiaire affiché ; un stagiaire ne peut afficher que son propre espace. Aucun nouveau
contrôle d'édition visible d'un stagiaire.

## 8. Tests et preuves

- `node tests/modules.test.mjs` : catalogue (module `ccp2`, livret sans parent, sous-onglet livret
  de Mon espace, noms affichés, liens des annonces joignables) et nouveautés rattachées au bon
  module.
- `node tests/ccp-rules.test.mjs` : dates CCP2, espaces insécables, intégrité du texte du parcours.
- Tous les tests existants restent verts.
- Banc d'essai, ordinateur et iPhone (375 px) : barre (7 puis 8 onglets, sans défilement),
  bouton et page Priorités (Planning allumé, retour), Cours (deux sous-onglets, pastilles,
  recherche, retour d'un QCM), Notes stagiaire (Matrice, EPCF) et formateur (quatre
  sous-onglets), Mon espace (livret en lecture pour le stagiaire, en saisie pour un formateur),
  CCP2 (parcours, dates, mémoire de l'étape), promo réglée ou libre.

## 9. Coordination

A (multi-promo) modifie aussi `main.js`, `views/home.js`, `nouveautes.js` et `views/config.js` ;
le second à fusionner reprend `main` et résout. C (cours de conduite C1 à C4) alimente le
sous-onglet Compétences sans rien changer à cette spec.

## 10. Livraison

Relecture de la spec par Timy, plan, réalisation et vérification au banc ; fusion dans `main`
(`merge --no-ff --no-commit` puis commit, hook du cache), nouveautés dans le même commit,
vérification navigateur du `main` fusionné, push par Timy, redéploiement de l'assistant par
Timy, puis ménage (worktree, branche, notes de projet, mémoire) et message WhatsApp.

## 11. Lot 2 : l'espace stagiaires des formateurs

Spécifié le 03/10 dans `2026-10-03-espace-stagiaires-design.md` (page Stagiaires, fiche en
sommaire sur iPhone), qui précise et ajuste le principe de départ ci-dessous.

Principe validé le 03/10 : pour un formateur, Mon espace s'ouvre sur **la liste de la promo**,
avec pour chacun des pastilles d'avancement (EPCF, livret, dossier) ; un geste ouvre l'espace
complet de la personne, avec les outils du formateur (saisir l'EPCF, remplir le livret, relire le
dossier). Sur iPhone : la liste, puis la fiche en plein écran, comme dans Contacts. Notes
redeviendra alors la seule vue de la classe, pour tout le monde.

## 12. Hors périmètre du lot 1

- L'espace stagiaires des formateurs (lot 2).
- Le suivi des étapes du CCP2 par stagiaire (cases « fait »).
- L'édition du parcours CCP2 dans l'app.
- La fusion d'Accueil et de Mon espace.
