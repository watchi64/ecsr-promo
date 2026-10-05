# Effacement et anonymisation des données personnelles

Date : 2026-10-05. Origine : point 6 du repérage légal (les conditions d'utilisation promettent
la suppression à la demande et l'anonymisation 12 mois après la formation ; rien ne le faisait).

## Ce qui existait

La corbeille du bloc « Abandons » (Paramètres) supprimait la fiche : notes, QCM, passages et
EPCF partaient en cascade (statistiques faussées), mais le compte de connexion et l'e-mail
restaient en base (droit à l'effacement non respecté). Elle est remplacée.

## Principe : anonymiser, pas supprimer

| Effacé | Conservé, sans nom |
|--------|--------------------|
| Compte de connexion (sessions, compteur de l'assistant en cascade), profil, e-mail partout où il signe (notes, historiques, signalements, agenda, thèmes, invitations), acceptations des conditions | Notes, tentatives de QCM, passages, scores EPCF |
| Date de naissance, livret, dossier professionnel, fiche de suivi | La fiche devient « Anonyme <id> », inactive, `anonymise_le` daté |
| Textes libres : observation des notes, commentaire des passages, commentaire EPCF, y compris dans les instantanés des historiques | |
| Nom affiché (« V. Timy ») dans les champs « qui a fait la modification » et les instantanés | |

`epcf_evaluations.contexte` n'est pas un texte libre (code « EPCF ») : conservé.

## Garde-fous (serveur)

- `anonymiser_stagiaire(id)` : admin, promo affichée, stagiaire déjà en abandon. Refuse un
  compte admin ou fondateur. Idempotent.
- `anonymiser_promo()` : seulement 12 mois après `promos.date_fin` ; ignore (et compte) les
  comptes admin. Confirmation par saisie de « ANONYMISER ».
- `purger_benevoles(ids)` : ne supprime que les élèves réellement éligibles (aucune venue au
  planning depuis 12 mois, ou jamais venus et enregistrés depuis plus d'un an), dans le lieu
  affiché ; leurs identifiants sont retirés des anciens créneaux.
- `_anonymiser_stagiaire` : cœur interne, aucun droit d'appel depuis l'app.
- `effacements_journal` : qui, quand, combien (lisible des admins), jamais de nom.

## Interface

- Paramètres > Promo > Abandons : « Effacer les données » (prénom à retaper).
- Paramètres > Données personnelles (admins) : état de la fin de promo (date à partir de laquelle
  l'anonymisation est possible, bouton seulement quand elle l'est) et liste des élèves bénévoles
  à supprimer.

## Limites connues

- Les textes libres écrits par les formateurs ailleurs (notes de planning, commentaires de
  séance des bénévoles) peuvent citer un prénom : non analysés.
- Les auto-écoles partenaires ne sont pas purgées automatiquement (suppression manuelle).

## Preuves

- `tests/effacement-rules.test.mjs` : confirmation, textes d'état (19 vérifications).
- `tests/sql/effacement-preuve.sql` : promo fictive, 15 contrôles (refus, effacement complet,
  aucune trace du nom ni de l'e-mail dans les historiques, voisine intacte, idempotence, délai de
  promo, comptes admin ignorés, bénévoles, visiteur). Répétition VERT 15/0 puis VERT 15/0 sur la
  version appliquée le 05/10. Une première version de la preuve, trop indulgente sur
  l'historique des passages, a été durcie après qu'elle a laissé passer un commentaire.
