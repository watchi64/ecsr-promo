# Ordre de passage et Résultats : refonte (11/11/2026)

## Pourquoi

Timy, le 11/11 : l'Ordre de passage est « vieux et complètement dépassé », les Résultats « un peu légers, on a
simplement une courbe ». Principes : le plus simple et le plus instinctif possible (à la Apple), une chose un
endroit, utilisateur au centre, clair et beau. Maquettes téléphone montrées le 11/11 : Timy a retenu **C**
(« Chacun sa vue ») pour l'Ordre de passage et **1** (« Tableau de bord ») pour les Résultats.

## Écran 1 : Planning > Ordre de passage (`js/views/dashboard.js`)

Question à laquelle l'écran répond en 3 secondes : **qui faire passer, et moi, où j'en suis.**

### Règle de comptage (unique)

- Un passage compte s'il est « Effectué » ou « Absence » : `compteDansEquite` (`js/passage-rules.js`), la règle
  du placement et de Mon suivi. Le « Bonus » (remplaçant au pied levé) et le « Report » ne comptent plus ici.
  *Décision prise par défaut et annoncée à Timy le 11/11 (pas d'objection) : jusqu'ici l'écran comptait le Bonus
  et contredisait le placement.*
- Compté depuis le début de la formation, sur les passages enregistrés (table `passages`), comme avant.
- Objectif par type (salle, voiture) = moyenne de la classe arrondie à l'entier, sur les stagiaires actifs.
- Retard = objectif moins compteur, jamais négatif. À jour = retard nul.
- Le calcul vit dans un module pur et testé (`js/ordre-passage-rules.js`, tests node).

### Vue stagiaire (compte relié à un profil stagiaire, sans droits d'équipe)

- Une seule carte « Mes passages » (fond lin) : Salle et Voiture, chacun « À jour » ou « N de retard ».
- Une phrase au tutoiement : « Tu es à jour partout. », « Tu passes en priorité en voiture. », « … en salle et en
  voiture. ».
- Son prochain créneau de passage s'il y en a un dans le planning de la semaine en cours ou de la suivante
  (« Prochain passage : jeudi 12 novembre, matin, voiture »). Sinon, rien.
- **Aucune donnée sur les autres stagiaires dans le haut de l'écran** (ni noms, ni retards).
- Sous la carte : l'historique des passages, inchangé (le stagiaire y ajoute ses passages, la promo y est
  lisible comme le planning l'est déjà).

### Vue équipe (formateur, fondateur ; direction et siège en lecture)

- Surtitre « Semaine du 9 novembre », titre « Ordre de passage », une ligne de sous-titre au vouvoiement.
- Trois chiffres : **À placer cette semaine** (en retard et pas encore placé dans le planning de la semaine sur le
  type en retard), **Déjà placés** (en retard et placé), **À jour partout**.
- Deux files, **Salle** puis **Voiture** : seuls les stagiaires en retard sur ce type, du plus grand retard au plus
  petit (à égalité : `ordre`, puis nom). Chaque ligne : rang, nom, « N de retard », et « placé jeudi » quand il
  a déjà un passage de ce type dans le planning de la semaine. Ligne de 44 px.
- Une ligne repliable « N stagiaires à jour partout » qui déplie leurs noms.
- File vide : « Tout le monde est à jour en salle. »
- Un bouton « Placer la semaine » qui mène au Planning (sous-onglet Semaine). Les comptes en lecture ne l'ont pas.
- L'encart « Comment la priorité est calculée ? » reste, raccourci à trois phrases, avec l'objectif chiffré.
- Disparaissent : la grille de cartes, les pastilles, le menu « Trier par » (et sa clé `ecsr_dash_sort`),
  les quatre tuiles et la légende.
- L'historique des passages reste en bas, inchangé.

## Écran 2 : Mon suivi > Résultats, vue « Moi » (`js/views/mon-suivi.js`, `rendreResultats`)

Questions : **où j'en suis, est-ce que je progresse, sur quoi je travaille.** La vue « La classe » ne change pas.

Ordre, de haut en bas :

1. **Carte chiffre (fond lin)** : moyenne générale /20 (une décimale, virgule) et nombre de notes ; dessous,
   la tendance « +0,6 en un mois » (moyenne de toutes les notes aujourd'hui moins moyenne des notes datées d'il
   y a plus de 30 jours ; masquée s'il n'y a pas de note de plus de 30 jours ou si l'écart arrondi est nul :
   « stable sur un mois ») et « groupe : 15,2 » (moyenne du groupe, `notes_stats_groupe` : somme / n).
   **La moyenne du groupe ne s'affiche que si la promo compte au moins 3 stagiaires actifs** (même seuil que
   l'EPCF), sinon elle laisserait deviner la note d'un camarade.
2. **Le graphe « Mon évolution »** existant, inchangé (interactif, infobulles, bandes de mois).
3. **Points forts** et **À retravailler** : les notes regroupées par sujet (même libellé que l'infobulle :
   thème, compétence ou contrôle), moyenne par sujet ramenée sur 20. Trois meilleurs, trois plus bas, sans
   doublon ; avec moins de 6 sujets, la moitié haute et la moitié basse (un seul sujet : pas de cartes). Une
   ligne par sujet : « 41 · Alcool » et la note. Aucune note en rouge ; « À retravailler » ne juge pas, il trie.
4. **EPCF** : une ligne « N épreuves évaluées » qui ouvre la partie Évaluations EPCF ; rien si aucune épreuve ou
   si le module est fermé.
5. Le renvoi vers les notes des QCM (existant).

Zéro note : « Pas encore d'évaluation notée. », comme aujourd'hui, sans carte chiffre.

Sur la fiche d'un stagiaire ouverte par l'équipe (`soi` faux) : mêmes blocs, libellés neutres (« Évolution »).

## Confidentialité

- Aucune nouvelle requête nominative pour un stagiaire. Les chiffres du groupe viennent de la RPC agrégée
  existante. Masquage, réciprocité et verrou de 24 h inchangés.
- Ordre de passage : le stagiaire ne voit plus les retards des autres dans le haut de l'écran.

## Contraintes

DA « Lin » (`docs/direction-artistique.md`) : fond de l'app, lin et beige en accent seulement (deux ou trois
surfaces par écran), olive, Outfit. Téléphone d'abord. Cibles de 44 px, aucun défilement de côté, contraste
AA, aucun tiret cadratin, vouvoiement de l'équipe et tutoiement des stagiaires, aucune migration de base.

## Laissé au constructeur

Noms des classes CSS, découpage des fonctions, libellés exacts des phrases secondaires dans l'esprit ci-dessus,
emplacement des tests, entrée Nouveautés.

## Hors champ

Lien direct vers le cours ou le QCM d'un thème (l'app n'a pas d'adresse par thème) ; comparaison au groupe
thème par thème ; refonte de l'onglet Passages de Mon suivi.

## Choix du constructeur (après relecture indépendante, 11/11)

1. Les trois chiffres comptent des **stagiaires**, et leur somme fait l'effectif : « À placer » = en retard sur
   au moins un type sans y être placé ; « Déjà placés » = en retard, et placé sur chaque type en retard ;
   « À jour partout » = le reste.
2. « Placé » se lit avec `rolesPourEntry` (`js/creneaux-rules.js`), rôle `passage` seulement (au tableau, au
   volant) ; être assis comme élève ne compte pas. Les jours désactivés et fériés sont ignorés, comme dans Mon suivi.
3. La semaine est celle de `lundiEnCours` (la suivante le week-end), comme le planning et son bouton « Placer la
   semaine ». Le prochain passage du stagiaire se cherche sur cette semaine et la suivante.
4. Vue stagiaire si `isStagiaire()` ; sans profil relié : « Aucun profil stagiaire n'est relié à ce compte. »
   Sinon vue équipe (le fondateur voit la vue stagiaire par l'aperçu « Stagiaire »). « Placer la semaine » si `isAdmin()`.
5. Seuil de la moyenne du groupe : au moins 3 stagiaires actifs (`listStagiaires`, déjà chargé par la fiche).
6. Moyenne générale = moyenne des notes ramenées sur 20 (celle d'aujourd'hui sous le graphe). Tendance : notes
   datées (`date_eval`) de plus de 30 jours ; une note sans date ne compte que dans la moyenne actuelle.
7. EPCF : nombre de lignes `epcf_evaluations` du stagiaire ; module `epcf` (`moduleVisible`) ; la ligne ouvre la
   partie `epcf` de la fiche (`adresseFiche`).
8. Une note sans sujet identifiable (libellé « Évaluation ») n'entre pas dans les cartes.
