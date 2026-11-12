# Progression du stagiaire sur la liste des thèmes (12/11/2026)

## Pourquoi

Timy, le 12/11 : dans Cours et QCM > Thèmes, le stagiaire ne voit pas d'un coup d'œil où il en est sur chaque
thème. Il faut montrer les thèmes faits, ceux qui restent, et ceux qui lui posent problème.

Décisions de Timy pendant le brainstorming du 12/11 :
- Pas de suivi de lecture du cours en base : la lecture reste ce qu'elle est (« ouvert sur cet appareil », bouton
  Cours atténué). La progression repose sur les notes de QCM.
- Pas d'anneaux (maquette A3 abandonnée) : **toute la ligne prend la couleur de son état**, en version sobre
  (maquette B) : un liseré coloré de 4 px sur le bord gauche et un voile très pâle, plus un mot dans une pastille.
- Quand l'examen et l'entraînement se contredisent, **le résultat le plus récent décide** (« c'est ce qu'eux, ils
  savent »).
- En haut de chaque section, côté stagiaire, le compteur de la promo (« 57 faits · 0 à faire ») devient le sien.

## Qui voit quoi

- **Vue stagiaire** : la personne n'est pas formateur connecté et a une promo (`!formateurConnecte() && !sansPromo()`),
  avec le module QCM visible (`canSeeQcm()`). C'est la condition qui donne déjà le sous-onglet QCM du stagiaire. Le
  fondateur en aperçu « Stagiaire » voit donc la même chose qu'un stagiaire (avec ses propres notes, comme aujourd'hui).
- **Vue équipe** (formateur, direction, siège) : rien ne change. Statut « Fait / À faire », date, compteurs de la promo.
- Confidentialité : l'état se calcule dans le navigateur à partir des notes que la personne lit déjà (ses tentatives de
  QCM, ses évaluations, sous RLS). Aucune nouvelle lecture, aucune donnée d'un autre stagiaire.

## La règle (module pur `js/progression-rules.js`, testé)

Entrées pour un thème : le QCM du thème (avec son seuil `exam_pass_20`, 15 par défaut), la note d'examen et sa date,
la dernière note d'entraînement et sa date.

- **Note d'examen** : celle qu'affiche déjà la ligne (`myThemeNote`) : la matrice Notes pour un thème numéroté (si le
  module Notes est visible), sinon la tentative d'examen du QCM.
- **Date de l'examen** : `finished_at` de la tentative d'examen quand elle existe et que son jour n'est pas antérieur à
  `date_eval` de la note de la matrice ; sinon `date_eval`, prise en fin de journée (une note saisie à la main n'a pas
  d'heure : un entraînement du même jour est réputé antérieur).
- **Entraînement** : la dernière tentative en mode entraînement (`myTrainByQcm`), avec `finished_at`.

On regarde le résultat **le plus récent** des deux :

| Dernier résultat | État |
|---|---|
| Examen au seuil ou plus (15/20 par défaut) | **Acquis** |
| Examen sous le seuil | **À revoir** |
| Entraînement sous 12/20 | **À revoir** |
| Entraînement à 12/20 ou plus, et un examen réussi existe | **Acquis** |
| Entraînement à 12/20 ou plus, sans examen réussi | **En cours** |
| Ni examen ni entraînement | **À commencer** |

- Égalité de date exacte : l'examen l'emporte.
- Thème sans QCM (ou QCM sans question) : **aucun état**, ni couleur ni pastille. La ligne reste neutre.
- Module Notes masqué : la note d'examen n'est pas connue (comme aujourd'hui) ; seul l'entraînement compte.
- Les seuils (12 pour l'entraînement, seuil du QCM pour l'examen) sont des constantes nommées du module.

## L'affichage

Ligne de thème, vue stagiaire seulement (`js/views/themes.js`, `renderThemeRow` ; `css/themes-lignes.css`) :

- Classe d'état sur la ligne : `prog-acquis`, `prog-revoir`, `prog-encours`, `prog-commencer`.
- Liseré de 4 px à gauche et voile pâle : vert (`--c-go`), terre cuite (`--c-stop`), ocre (`--note-mid-texte`), gris
  neutre pour « À commencer » (liseré gris, pas de voile).
- Une pastille avec le mot (« Acquis », « À revoir », « En cours », « À commencer ») dans la ligne d'état, à la place
  du statut « Fait / À faire » et de sa date, qui disparaissent côté stagiaire. Le mot est indispensable : la couleur
  seule ne se lit pas pour un daltonien.
- Les notes « Examen 15,6/20 · Entraîn. 20/20 » et le repère « Examen ouvert » restent.
- Contraste AA : le texte gris de la ligne garde 4,5:1 sur chaque voile ; la pastille aussi. Vérifié au banc dans les
  deux habillages (couleurs de l'app et couleurs ECF : les teintes passent par les variables du thème).
- Téléphone (375 px) : la pastille tient dans la ligne d'état, sans défilement horizontal.

En-tête des sections, vue stagiaire :

- Les deux chiffres « Faits / À faire » deviennent **« Acquis »** et **« À revoir »** (thèmes de la section qui ont un
  QCM). La barre se remplit avec la part des thèmes acquis parmi ceux qui ont un QCM.
- La phrase de l'en-tête de Cours (« 57 / 57 thèmes officiels terminés ») devient, côté stagiaire :
  « Tu as acquis 12 thèmes officiels sur 57. » (au singulier si besoin). Sans aucune note : « Aucun thème acquis
  pour l'instant. »

Filtre de la barre de recherche, vue stagiaire : « Tous les statuts / Fait / À faire » devient « Tous les états /
Acquis / À revoir / En cours / À commencer ». Les thèmes sans QCM ne sortent que sous « Tous les états ».

## Hors périmètre

- Suivi de lecture des cours en base (écarté par Timy le 12/11).
- Mon suivi > Résultats (points forts, à retravailler) : inchangé. Il lit les notes officielles, la liste lit en plus
  l'entraînement ; les deux ne se contredisent pas sur un examen.
- Le sous-onglet QCM du stagiaire : inchangé.

## Livraison

- Tests node du module de règle (tous les cas du tableau, dates, égalité, seuil propre au QCM, sans QCM).
- Banc : stagiaire à 375 px et sur ordinateur, deux habillages ; robot des parcours, deux moteurs.
- Entrée Nouveautés dans le même commit.
- Assistant : son guide des stagiaires décrit la liste des thèmes ; une phrase à ajouter, redéploiement à grouper.
