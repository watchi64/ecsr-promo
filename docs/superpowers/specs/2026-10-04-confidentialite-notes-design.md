# Confidentialité des notes, des fiches de suivi et des dates de naissance

Date : 2026-10-04. Origine : repérage légal du 03/10 (point 1 de l'ordre proposé).

## Le problème

Les règles de lecture de la base laissaient tout connecté d'une promo lire :

| Table | Fuite |
|-------|-------|
| `evaluations` | toutes les notes, y compris celles des profils qui ont masqué les leurs |
| `evaluations_audit` | l'historique de chaque note (avant/après, auteur) |
| `fiches_suivi` | souhaits et besoins de chaque stagiaire |
| `stagiaires.date_naissance` | la date de naissance de chacun |

L'anonymat des notes n'était qu'un masquage d'écran : une requête directe à la base
contournait la promesse faite aux stagiaires (et écrite dans les conditions d'utilisation).

La page Notes lisait toutes les notes parce qu'elle calculait elle-même les moyennes du
groupe, anonymes comprises.

## La règle

| Qui | Notes et historique | Fiche de suivi | Date de naissance |
|-----|---------------------|----------------|-------------------|
| Admin, formateur | tout | tout | tout |
| Stagiaire non masqué | les siennes + celles des non masqués | la sienne | la sienne |
| Stagiaire masqué | les siennes seulement (réciprocité) | la sienne | la sienne |

L'historique d'une note suit la note ; celui d'une note supprimée reste au personnel.
Les écritures ne changent pas.

## La solution

- `notes_stagiaires_visibles()` (SECURITY DEFINER) : les stagiaires dont le connecté peut
  lire les notes. Règle `evaluations_select` = personnel OU stagiaire dans cette liste.
- `notes_stats_groupe()` (SECURITY DEFINER) : les agrégats du groupe, sans rien de
  nominatif (moyenne, médiane, nombre de notes, sous 10, répartition en 5 tranches, par
  thème, par compétence, meilleure et plus faible moyenne individuelle des actifs). La page
  Notes les utilise pour les stagiaires ; le personnel calcule en local (ses saisies se
  reflètent aussitôt). Même forme et mêmes définitions des deux côtés : `js/notes-stats.js`.
- `stagiaires_prive (stagiaire_id, date_naissance)` : lisible du stagiaire et du personnel,
  écrite seulement par `set_date_naissance`. L'ancienne colonne est vidée et verrouillée
  par une contrainte (à supprimer au ménage).

Limite connue et assumée (déjà vraie avant) : avec un seul profil masqué et peu de notes
sur un thème, la moyenne du groupe et les notes visibles permettent de déduire sa note.
Un seuil d'affichage (pas de moyenne sous 3 notes) le corrigerait ; non retenu à ce stade.

## Déploiement en deux temps (téléphones en cache)

1. `20261004_confidentialite_1_preparation` : table, fonctions, écriture double de la date.
   Sans effet sur l'app en ligne. **Appliquée le 2026-10-04.**
2. Mise en ligne de l'app (poussée de `main`).
3. `20261004_confidentialite_2_fermeture` : règles de lecture fermées, ancienne colonne vidée.
   Un téléphone resté sur l'ancienne version voit alors des moyennes calculées sur les seules
   notes visibles, jusqu'à son rechargement : sans gravité.

Marches arrière : `_retour.sql` de chaque étape.

## Preuves

- `tests/notes-stats.test.mjs` : calcul local sur un jeu de référence (22 vérifications).
- `tests/sql/confidentialite-preuve.sql` : même jeu en base, promo fictive, 5 personnages.
  Sans l'étape 2 : ROUGE 15/8 (la fuite) ; avec l'étape 2 répétée : VERT 23/0.
- `tests/sql/confidentialite-comptes-reels.sql` : tous les vrais comptes dans chaque promo.
  Avec l'étape 2 répétée : VERT 107/0 (21 couples) ; sans : 26 écarts.
- `tests/sql/multi-promo-preuve.sql` : modèle des lectures attendues mis à jour pour les
  trois tables (à rejouer en entier après l'étape 2).
