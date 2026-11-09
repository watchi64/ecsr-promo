# Référentiel de qualité de l'app

Version 1 du 08/11/2026, **validée par Timy le même jour** : budget de 3 clics par tâche courante, seuls
les défauts graves bloquent une fusion, l'attrait visuel est noté par des agents testeurs puis tranché
par Timy, le robot joue l'iPhone (375 px) et l'ordinateur (1 280 px). Ce document dit ce qu'est une app « niveau grand groupe »
en critères **mesurables** : chacun a un seuil, une façon de le mesurer et une conséquence (bloque une
fusion ou se corrige par lot). Il sert à trois choses : le robot des parcours (`outils/robot_parcours.py`),
l'audit par testeurs, et la relecture de chaque chantier.

Principe posé par Timy le 08/11 : l'utilisateur au centre, une app claire **et** belle, une structure
testée et éprouvée. La DA (vert, Canela, pastille de date) reste le point de départ, plus une contrainte.

## 1. Les parcours à tenir, par rôle

Un parcours est une tâche réelle, du premier écran jusqu'au résultat visible. Le **budget** est le nombre
maximum de clics (ou de touchers sur téléphone) pour y arriver depuis n'importe quelle page de l'app.
Règle générale : **toute page en 1 clic (2 sur téléphone, en passant par « Plus »), toute tâche courante
en 3 clics au plus**. Un clic de plus que le budget est un échec. Sur téléphone, une tâche qui passe par
« Plus » compte ce clic en plus (« 2 (3 sur téléphone) »).

| Rôle | Tâche courante | Budget | Robot |
|---|---|---|---|
| Stagiaire | Signer l'émargement du matin | 1 (bandeau) + signature | oui |
| Stagiaire | Lire le cours d'un thème | 2 | oui |
| Stagiaire | S'entraîner sur un QCM jusqu'à sa note | 3 jusqu'à la 1re question | oui |
| Stagiaire | Voir mes résultats et mes passages (Mon suivi) | 2 | oui |
| Stagiaire | Avancer mon CCP2 | 1 | oui |
| Stagiaire | Trouver un document ou les contacts du centre | 2 | oui |
| Stagiaire | Signaler un problème | 2 pour ouvrir, puis envoyer | oui |
| Stagiaire | Changer mes préférences (anonymat des notes) | 2 | oui |
| Stagiaire | Voir mon planning de demain | 2 | oui (nouvelle navigation) |
| Stagiaire | Voir ma journée (Accueil) | 1 | oui (nouvelle navigation) |
| Stagiaire | Signer l'émargement depuis l'Accueil | 1 + signature | oui (nouvelle navigation) |
| Stagiaire | Passer l'examen ouvert, depuis « À faire » de l'Accueil | 3 depuis l'Accueil | oui (nouvelle navigation) |
| Stagiaire | Retrouver mes QCM et ma dernière note (sous-onglet QCM) | 2 | oui (nouvelle navigation) |
| Stagiaire | Ouvrir mon livret EPCF | 2 | oui (nouvelle navigation) |
| Formateur | Ouvrir et suivre l'émargement du jour | 2 (3 sur téléphone) | oui |
| Formateur | Voir les indicateurs de la promo | 1 (2 sur téléphone) | oui |
| Formateur | Ouvrir les réglages de la promo | 1 (2 sur téléphone) | oui |
| Formateur | Saisir une note, voir les passages d'un stagiaire | 3 | plus tard |
| Formateur | Modifier le planning de la semaine | 3 | oui (nouvelle navigation) |
| Formateur | Traiter un signalement de QCM | 3 (par « Aujourd'hui ») | oui (nouvelle navigation) |
| Formateur | Voir la journée de la promo (Aujourd'hui) | 1 | oui (nouvelle navigation) |
| Fondateur | Lire les problèmes signalés | 2 (3 sur téléphone) | oui |
| Fondateur | Relire les questions proposées par l'IA | 2 (3 sur téléphone) | oui (nouvelle navigation) |
| Direction, siège | Vue d'ensemble du centre ou du réseau | 1 | au lot 5 |

**Priorité** (relevé du 08/11 en base, lecture seule, sans nom) : la table des problèmes signalés ne
contient qu'un essai de Timy, aucun vrai signalement ; les 57 signalements de QCM portent sur le contenu
des questions, aucun sur l'app. L'usage réel des 30 derniers jours ordonne donc les parcours : saisie des
notes (211), émargement (195 signatures), passages (62), QCM (37 entraînements), assistant (7 jours
d'usage), livret et dossier pro (1 mise à jour chacun).

## 2. Les critères

| # | Critère | Seuil | Mesure | Conséquence |
|---|---|---|---|---|
| A | **Le parcours aboutit** | 100 % des parcours, sur les deux moteurs et les deux formats | robot | bloque la fusion |
| B | **Budget de clics** | tableau du § 1 | robot (compte chaque clic) | bloque la fusion |
| C | **Une fonction, un seul endroit** | chaque fonction a une seule maison ; un raccourci (bandeau d'émargement) est permis s'il porte le même nom et mène au même endroit | robot : la page atteinte porte le nom de l'entrée cliquée ; testeurs : inventaire | listé, corrigé par lot |
| D | **Aucune impasse** | chaque écran montre un moyen de revenir (barre, « Fermer » ou « Retour ») ; Échap ferme une fenêtre ; « Précédent » du navigateur ramène à la page d'avant | robot | bloque la fusion |
| E | **Aucun refus silencieux** | toute action refusée ou en échec affiche, en moins de 2 s, un message en français qui dit quoi faire ; un bouton grisé dit pourquoi ; aucun bouton qui ne fait rien | robot (pannes simulées au banc) et testeurs | bloque la fusion |
| F | **Libellés sans ambiguïté** | chaque bouton a un nom ; aucun mot d'informaticien (admin, whitelist, mdp, null, undefined, NaN, Invalid Date) ; aucun compte à rebours négatif ; une fraction s'écrit « 2 sur 10 », pas « 02/10 » ; « Formateur », jamais « Prof » | robot (mots interdits sur l'écran) ; testeurs « premier clic » : 80 % des tâches trouvées avec une assurance de 4 sur 5 ou plus | listé, corrigé par lot |
| G | **Téléphone et ordinateur** | 375 px (iPhone) et 1 280 px ; aucun défilement de côté (seule exception : la matrice des notes) ; cibles de 44 px sur téléphone, 24 px sur ordinateur ; contraste du texte 4,5:1 (3:1 pour le grand texte) | robot | défilement de côté : bloque ; le reste : listé |
| H | **Chromium et WebKit** | mêmes résultats dans les deux (WebKit = Safari, donc l'iPhone) | robot | bloque la fusion |
| I | **Temps d'affichage** | au banc (sans réseau) : app ouverte en moins de 3 s, page affichée en moins de 1 s après un clic ; en ligne (à mesurer plus tard) : moins de 2 s en 4G | robot (banc) | listé, corrigé par lot |
| J | **Robustesse** | aucune erreur dans la console ; réseau lent : un « Chargement » visible, jamais une page blanche ; lecture en panne (une page qui ne charge pas ses données) : un message et « Réessayer » | robot | erreur console : bloque ; le reste : listé |
| K | **Attrait visuel** | soin, harmonie, finition notés de 1 à 5, chacun 4 au moins : alignements et marges réguliers, une seule hiérarchie de titres, couleurs et icônes cohérentes d'une page à l'autre, rien de coupé ni de chevauché, états vides soignés (une phrase et une action, pas un écran blanc) | robot : texte coupé, éléments qui se chevauchent ; captures de fin de parcours en planche pour les testeurs et Timy | listé, corrigé par lot ; Timy a le dernier mot |

## 3. Quand on mesure

- **Avant chaque fusion dans main** : `python outils/robot_parcours.py` (une commande, environ 2 minutes,
  Chromium et WebKit, téléphone et ordinateur, ancienne et nouvelle navigation). Code de sortie 0 = vert,
  1 = rouge, 2 = le robot n'a pas pu juger (option mal tapée, passage non joué, moteur absent) : ni vert ni rouge.
  Un échec qui bloque (colonne « Conséquence ») arrête la fusion ; les autres vont dans la liste du lot
  de corrections suivant. Les défauts bloquants déjà présents sur main (voir `echecs-main-2026-11-08.md`)
  sont listés dans `outils/parcours/connus.py` : le rapport les montre à part et ils ne bloquent pas la fusion
  d'un autre chantier ; un défaut **nouveau** la bloque. Qui corrige un défaut connu retire sa ligne.
  Le rapport (`outils/robot_rapports/<date-heure>/rapport.md`), la planche des écrans de fin et les captures
  restent sur la machine (données fictives du banc, jamais versionnées). Un parcours neuf s'écrit dans
  `outils/parcours/` (une fonction décorée par `@parcours`), une page neuve dans `outils/parcours/navigation.py`.
- **Après une refonte** (lots 2B et 4, puis 5) : audit par testeurs, des agents frais qui jouent un
  stagiaire sur iPhone, une formatrice sur l'ordinateur de la salle, un formateur sur téléphone, une
  direction de centre ; ils ne voient que les captures et notent le premier clic, l'assurance et l'attrait
  visuel. Puis Timy tranche, et quand c'est possible de vrais stagiaires confirment.
- **Les vrais signalements** (« Signaler un problème ») deviennent des parcours du robot dès qu'ils
  révèlent un défaut de parcours.

## 4. Ce que le robot ne sait pas juger

**Pas encore mesuré** (version 1) : les éléments qui se chevauchent (K), le réseau lent (J), les fractions
« 02/10 » (F, que l'on ne distingue pas d'une date) ; « Précédent » du navigateur n'est joué que sur CCP2 (D) ;
la taille des cibles, leur nom et le contraste ne se contrôlent que dans la partie de l'écran affichée, quand le
défilement de côté, le débordement et le texte coupé se contrôlent sur toute la page. Les testeurs couvrent le
reste en attendant.

La beauté, la clarté d'un mot, la pertinence d'une page : ce sont les testeurs et Timy. Le robot garantit
que rien ne casse ; l'audit dit si c'est agréable et évident.
