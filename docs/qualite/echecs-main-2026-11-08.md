# Ce que le robot trouve sur main (08/11/2026)

Premier passage du robot des parcours (`python outils/robot_parcours.py`) sur main à jour (38179d3, avec les
attestations), au banc d'essai (données fictives) : 16 parcours, 128 passages (Chromium et WebKit, iPhone 375 px
et ordinateur 1 280 px, ancienne et nouvelle navigation), 2,1 minutes. Ce document liste, sans rien corriger,
ce qui échoue au regard du référentiel (`docs/qualite/referentiel.md`). Les captures (données fictives du banc)
restent hors du dépôt, dans le dossier de notes de la conversation de coordination
(`qualite-robot-2026-11-08/`), avec le rapport brut du robot.

## Bilan

- Les **16 parcours aboutissent** dans les 128 passages : lire un cours, passer un QCM jusqu'à la note, Mon suivi
  et ses parties, notes de la classe, CCP2, documents et contacts, signaler un problème (et son envoi en panne),
  préférences, signer l'émargement, émargement du jour, indicateurs du centre, réglages de la promo, problèmes
  signalés. Aucune erreur dans la console, aucun écart entre Chromium et WebKit, aucun affichage lent.
- La **nouvelle navigation tient tous les budgets de clics** ; l'ancienne en dépasse trois (ci-dessous).
- **4 défauts bloquants** au sens du référentiel (une fusion qui les introduirait serait arrêtée) : ils existent
  déjà sur main, ils forment le premier lot de corrections.

## Défauts bloquants

| # | Défaut | Où | Critère | Piste |
|---|---|---|---|---|
| 1 | La fenêtre du QCM ne se ferme pas avec Échap (il faut viser la croix) | QCM, ordinateur, deux navigations, deux moteurs | D, aucune impasse | `js/views/qcm.js` n'écoute pas Échap ; brancher la mécanique de fenêtre commune |
| 2 | Sans connexion, Cours et QCM affiche la liste des thèmes gardée en mémoire mais ses colonnes Cours et QCM restent vides, sans message ni « Réessayer » : un stagiaire croit qu'il n'y a pas de QCM | Cours et QCM, partout | E, aucun refus silencieux | dire « QCM et cours non chargés » avec « Réessayer » quand leur lecture échoue |
| 3 | Sur téléphone, le sommaire du lecteur de cours défile de côté (743 à 794 px pour 375) | lecteur de cours, iPhone, deux navigations | G, aucun défilement de côté | dette connue (R52), annoncée pour le lot 2B : sommaire qui passe à la ligne |
| 4 | Ancienne barre à 1 280 px, avec un nom de promo long (« Démonstration · sept. 2026 ») : « Aujourd'hui » et « Actualiser » sortent de l'écran (bord droit à 1 344 px), la page les coupe | ancienne navigation, ordinateur | G, rien de coupé hors de l'écran | dette de l'ancienne barre (déjà vue à 900 px) ; disparaît avec elle, ou nom de promo raccourci |

## À corriger par lot (non bloquant)

**Accessibilité et lisibilité (critère G)**
- Contraste sous 4,5:1 : numéros de jour de la barre des jours du Planning (texte à 75 % d'opacité, 4,07:1, sur
  toutes les pages qui l'affichent) ; « Lecture seule » et la consigne du livret (4,36:1) ; « Saut de feuille » du
  dossier pro (3,68:1). L'audit de contraste du 27/10 ne comptait pas l'opacité.
- Cibles sous 44 px sur téléphone : onglets de l'ancienne barre (36 px), « Signer » du bandeau d'émargement
  (29 px de haut), pastilles de filtre de Cours (32 px), boutons « Cours » et « QCM » d'un thème (27 à 29 px),
  « Valider » et « Question suivante » du QCM (38 px), croix du QCM (34 px) et du lecteur de cours (31 px), lien de
  retour des parties de Mon suivi (22 px), boutons de l'enquête d'avis (27 à 32 px), boutons du Planning (29 à
  35 px), sous-onglets de l'ancienne navigation (36 px).
- Cibles sous 24 px sur ordinateur : titres des thèmes (18 px), liens PDF du CCP2 (18 px), « Méthode » des
  indicateurs (18 px), prénoms des notes de la classe (18 px).

**Libellés (critère F)**
- Ancienne barre sur téléphone : sept onglets en icônes sans nom lisible par un lecteur d'écran.
- Champs sans étiquette : date du Planning, champ texte du Planning, filtre des statuts de Cours, tri des notes
  de la classe, les deux listes d'invitation des Paramètres.
- Mots d'informaticien, ancienne navigation : « Connexion admin requise pour modifier » (Planning, La classe,
  montré aux stagiaires), « Connecte-toi en admin », « mdp », « whitelist » (Paramètres). La nouvelle navigation
  ne les montre plus.

**Budget de clics, ancienne navigation (critère B)** : Indicateurs en 2 clics (tuile de l'Accueil, budget 1),
émargement du jour en 3 (budget 2), « Signaler un problème » du formateur en 2 (budget 1). La nouvelle
navigation les tient.

**Une page, un nom (critère C)** : dans l'ancienne navigation, la tuile « Tableau de bord » ouvre une page
titrée du nom de la promo.

**Robustesse (critère J)** : la page en panne (n° 2) ne propose pas « Réessayer ».

**Finition (critère K)** : nom de la promo de démonstration et adresse du compte coupés par des points de
suspension dans les barres.

**Vu au passage** : le lecteur affiche « undefined » quand un cours n'a pas de texte (cas limite, vu au banc :
tous les cours en ligne en ont un).

## Pour la suite

- Lot de corrections 1 (bloquants) : n° 1 et 2 tout de suite ; n° 3 avec le lot 2B ; n° 4 avec le retrait de
  l'ancienne barre, ou un correctif si elle doit vivre longtemps (Montpellier).
- Lot 2 : contraste (opacité) et étiquettes des champs ; lot 3 : cibles de 44 px sur téléphone.
- Après la fusion des lots 2B et 4 : parcours d'Accueil, d'Aujourd'hui, du planning en grille et des
  sous-onglets QCM dans le robot, puis audit par testeurs (étape 3).
