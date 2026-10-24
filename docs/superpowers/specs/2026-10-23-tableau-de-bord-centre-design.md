# Tableau de bord du centre : spec

Date : 23/10/2026. Branche `tableau-centre`. Timy a dit « pars sur tes choix » : tout ce qui suit
est un choix de Claude, à relire, sauf les contraintes données par la session de départ.

## Pourquoi

Timy présente l'app la semaine du 26/10/2026 à des responsables du réseau ECF. Une direction de
centre regarde trois choses : l'assiduité, les abandons (un abandon évité vaut 3 500 à 5 000 € de
formation) et les résultats. Les documents commerciaux annoncent « à venir » : taux de réussite et
d'abandon calculés par promo (Qualiopi, critère 1), tableaux de bord de centre, statistiques par
thème, export de la matrice des notes. Cette page les rend réels.

## Objectifs

- Une page **Tableau de bord du centre** (`#/centre`), réservée au personnel (`isAdmin() || isProf()`,
  même porte que la page Stagiaires), ouverte depuis une tuile de l'Accueil.
- Pour la promo courante : effectif, abandons, assiduité, passages, QCM, examens QCM, notes, EPCF,
  thèmes à retravailler, stagiaires à suivre.
- Comparaison des promos accessibles au compte (au moins deux), sur les mêmes indicateurs.
- Export PDF A4 de la page (impression du navigateur) et export CSV de la matrice des notes.
- Chaque chiffre dit sa **méthode** (formule, source, effectif) et sa **nature** : *mesuré* (compté
  dans la base) ou *estimé* (hypothèse ou signal).
- Parlant sur la promo de démonstration (id 7, données fictives).

## Non-objectifs

- Pas de rôle « direction » : la direction regarde avec un compte formateur. Un rôle dédié demande
  une migration et une invitation : suite possible.
- Pas de taux de réussite au titre professionnel : les résultats de jury ne sont pas saisis dans
  l'app. La page le dit (carte « non mesuré ») ; leur saisie est une suite possible.
- Pas d'assiduité en formation : tant que l'émargement (chantier parallèle) n'est pas en ligne,
  l'app ne connaît que les absences de dernière minute aux passages prévus. La page le dit.
- Aucune migration, aucune fonction SQL nouvelle : tout se calcule dans le navigateur à partir des
  tables que le personnel lit déjà.

## Anti-objectifs

- Un chiffre sans méthode, ou un estimé présenté comme mesuré.
- Une donnée d'une promo affichée sous le nom d'une autre (lecture silencieuse de la mauvaise promo).
- Un nom de stagiaire visible par quelqu'un qui ne le voit pas déjà ailleurs.
- Un ton qui juge (« mauvais élèves ») : on décrit des signaux, on ne classe pas les personnes.

## Contraintes

- Base de production, même en local : aucune écriture de test. Vérification sur le banc d'essai
  (faux client Supabase par import map).
- Multi-promo : chaque lecture est filtrée par la base selon l'en-tête `x-promo-id` ; la base
  vérifie le droit (`promo_courante()` → `peut_acceder_promo()`). Une promo interdite ne rend rien.
- Entrée Nouveautés dans le commit de mise en ligne ; jamais de tiret cadratin ; largeur 375 px.

## Données et lecture par promo

Une fonction `lireDonneesCentre(promoId)` de `js/db.js` lit, pour une promo :

| Table | Colonnes | Remarque |
|---|---|---|
| `stagiaires` | id, prenom, nom, actif, ordre, anonymise_le | abandons compris |
| `passages` | stagiaire_id, type, resultat, date | |
| `evaluations` | stagiaire_id, type, theme_numero, competence_code, controle_libelle, note, note_max, date_eval | |
| `qcm_attempts` | qcm_id, stagiaire_id, mode, score, total, note_20, finished_at | jamais `answers` (lourd) |
| `epcf_evaluations` | id, stagiaire_id, trame, contexte, auto_eval, date_eval, scores | |

Plus le référentiel commun (une fois) : `qcm` (id, theme_id, titre, exam_pass_20) et `themes`
(id, numero, titre). Lecture par pages de 1 000 lignes (limite de PostgREST).

**Lire une autre promo que la courante.** La requête porte un en-tête interne
`x-promo-lecture: <id>` (posé par `setHeader` du constructeur de requêtes). `fetchWithTimeout`
le retire toujours avant l'envoi et applique la règle pure `promoDeLaRequete` de
`js/promo-rules.js` :

- pas d'en-tête de lecture : promo courante, comme aujourd'hui ;
- en-tête de lecture sur une lecture (GET ou HEAD) d'une promo de `mes_promos()` : cette promo ;
- en-tête de lecture sur une écriture, ou vers une promo absente de la liste : la requête est
  **refusée** (erreur), jamais repliée sur la promo courante.

La base reste juge du droit : la règle côté navigateur ne fait qu'éviter de mal étiqueter.

## Indicateurs (module pur `js/centre-stats.js`, testé par `node tests/centre-stats.test.mjs`)

Population : les **inscrits** sont toutes les fiches de la promo ; les **en formation** sont les
fiches actives. Les résultats (QCM, notes, EPCF) portent sur les stagiaires en formation.

| Indicateur | Méthode | Nature |
|---|---|---|
| Effectif | inscrits, en formation, abandons (fiche passée en abandon) | mesuré |
| Taux d'abandon | abandons / inscrits. La date d'abandon n'est pas enregistrée | mesuré |
| Valeur des parcours interrompus | abandons × 3 500 à 5 000 € (hypothèse du réseau, constante modifiable) | estimé |
| Absences aux passages prévus | absences de dernière minute / (passages faits + absences), passages prévus seulement | mesuré, partiel |
| Passages réalisés | salle et voiture : faits + bonus (remplacements) ; moyenne par stagiaire en formation, plus bas et plus haut | mesuré |
| Activité QCM | stagiaires en formation ayant fait au moins un entraînement / en formation ; questions répondues | mesuré |
| Réussite aux QCM d'entraînement | bonnes réponses / questions répondues | mesuré |
| Examens QCM | examens passés ; réussis = note ≥ seuil du QCM (15/20 par défaut) ; moyenne /20 | mesuré |
| Notes | moyenne de toutes les notes ramenées sur 20, médiane, part sous 10 (règles de `js/notes-stats.js`) | mesuré |
| EPCF | par grille (salle, véhicule) : dernière évaluation EPCF non auto-évaluée de chaque stagiaire (règle de la fonction `epcf_moyennes`) ; évalués / en formation ; part des critères acquis, à renforcer, non acquis ; score moyen (A = 2, R = 1, NA = 0, ramené à 100 %) | mesuré |
| Réussite au titre | non saisie dans l'app | non mesuré |
| Stagiaires à suivre | au moins deux signaux parmi quatre (ci-dessous) | estimé |

**Thèmes à retravailler** : deux listes courtes côte à côte, chacune avec son effectif.
D'après les QCM : les 5 thèmes au plus faible taux de bonnes réponses, parmi ceux qui ont au moins
20 réponses. D'après les notes : les 5 thèmes à la plus faible moyenne, parmi ceux qui ont au moins
3 notes. Un tableau complet par thème (QCM et notes) se déplie dessous.

**Signaux de décrochage** (par stagiaire en formation) :
1. au moins deux absences de dernière minute aux passages ;
2. moyenne des notes sous 10 (au moins 3 notes) ;
3. aucun entraînement QCM depuis 14 jours alors que la promo en a fait dans ces 14 jours ;
4. retard de passages : au moins 2 tours sous la moyenne de la promo, en salle ou en voiture (même
   compteur que la page Priorités : faits + bonus + absences).

Deux signaux ou plus : la personne apparaît dans « À suivre de près », avec ses signaux en clair.
C'est un repère pour le formateur, pas une prédiction : la page le dit.

## Comparaison des promos

Si le compte voit au moins deux promos (`getMesPromos()`), un tableau « Comparer les promos »
place les indicateurs principaux (effectif, taux d'abandon, absences aux passages, passages par
stagiaire, réussite QCM, examens QCM, moyenne des notes, EPCF acquis) en colonnes par promo. La
promo courante s'affiche d'abord ; les autres se chargent ensuite. Une promo illisible affiche
« non chargée », sans bloquer la page. Aucune donnée nominative dans ce tableau.

## Confidentialité

- La page n'est ouverte qu'au personnel, qui voit déjà toutes les notes et tous les noms
  (Notes, Stagiaires) : elle n'ouvre aucun droit nouveau.
- Les seuls noms affichés sont ceux de « À suivre de près ». Le choix d'anonymat d'un stagiaire
  vise les autres stagiaires ; il n'est pas opposable au personnel (règle actuelle de la page Notes).
- Export CSV : noms par défaut ; une case « Remplacer les noms par des numéros » produit une
  version à transmettre hors de l'équipe pédagogique. La fenêtre d'export rappelle que le fichier
  contient des notes nominatives.

## Exports

- **PDF A4** : bouton « Exporter en PDF » → impression du navigateur, `@page A4 portrait` injectée
  le temps de l'impression, barre de l'app et boutons masqués, cartes non coupées, méthodes de
  calcul dépliées, en-tête : promo, période, date d'édition.
- **CSV de la matrice des notes** (stagiaires en formation, mêmes cellules que la matrice Notes :
  dernière note de chaque compétence spéciale et de chaque thème, thèmes 46 et 47 en une colonne,
  moyenne de toutes les notes) : séparateur `;`, virgule décimale, notes ramenées sur 20 et
  arrondies au dixième, encodage UTF-8 avec BOM (Excel), protection contre l'injection de formules
  (`= + - @` en tête de cellule). Nom : `matrice-notes_<promo>_<AAAA-MM-JJ>.csv`.

## Démonstration

La promo 7 a 10 stagiaires fictifs, 62 passages, 100 notes, 140 entraînements QCM, 15 EPCF, mais
**aucun abandon ni examen QCM**. Proposition à Timy (écriture en production sur des données
fictives, avec son accord) : passer une fiche fictive en abandon pour que la carte abandons parle.

## Laissé au constructeur

Mise en forme des cartes (dans la charte mint existante), libellés exacts, ordre des sections.

## Constats en passant (hors périmètre)

- La synthèse de la page Notes comptait les notes des stagiaires en abandon dans la moyenne générale
  (99 notes de 3 abandons pour la promo de Nîmes) ; le tableau de bord, lui, ne compte que les
  stagiaires en formation. **Tranché par Timy le 23/10/2026** : la page Notes ne compte plus que les
  stagiaires en formation (`statsLocales` et migration `20261023_notes_stats_en_formation`), règle
  écrite sous « Synthèse classe ». Les deux pages donnent les mêmes chiffres.
