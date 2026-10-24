# Plan : questions QCM proposées par l'IA

Spec : `docs/superpowers/specs/2026-10-23-questions-ia-design.md`. Branche `questions-ia`,
worktree `C:\Users\watch\Dev\ecsr-promo-questions-ia`.

Schéma : éditeur QCM (navigateur) → Edge Function `qcm-ia` (JWT vérifié, service role) →
lit `cours` + énoncés du QCM → Mistral (JSON) → contrôle des brouillons → `qcm_ia_brouillons`.
Accepter : navigateur → rpc `accepter_brouillon_ia` → `qcm_questions` + `qcm_options` + trace.

## Tâche 1 : module pur des brouillons (TDD)

`supabase/functions/qcm-ia/brouillons.mjs`, testé par `tests/qcm-ia-brouillons.test.mjs` :
- `articlesCites(texte)` : numéros d'article normalisés (`R413-1`, `L234-1`, `221-6`).
- `titresDuCours(md)` et `extrairePartie(md, titre)` : titres `##` / `###`, texte d'une partie.
- `construireMessages({ titreTheme, coursMd, partie, nombre, existants, sections })`.
- `analyserReponse(brut, { articlesCours, titres })` → `{ brouillons, ecartes }` : structure
  (énoncé, 3 à 6 options, au moins une bonne et au moins une fausse), tirets cadratins remplacés,
  **article absent du cours ⇒ écarté avec motif**, renvoi au cours vérifié contre les titres.
- Test clé : un brouillon qui cite `R413-99` absent du cours sort dans `ecartes`.

## Tâche 2 : Edge Function `qcm-ia`

`supabase/functions/qcm-ia/index.ts` : OPTIONS/POST, JWT, formateur (`user_profiles.is_admin`),
corps `{ qcm_id, nombre, partie }`, cours du thème (`themes.numero` → `cours.numero`, `code`
nul), énoncés existants, quota `qcm_ia_consommer`, appel Mistral non streamé
(`response_format: json_object`), `analyserReponse`, insertion des brouillons (acceptables
`a_relire`, écartés `ecartee` + motif), réponse `{ brouillons, ecartes, articles_cours }`.

## Tâche 3 : migration et preuve SQL

`supabase/migrations/20261023_qcm_ia.sql` (+ `_retour.sql`) : table `qcm_ia_brouillons` + RLS
formateur, colonnes de trace sur `qcm_questions`, `qcm_ia_usage` + `qcm_ia_consommer`,
`accepter_brouillon_ia`, réglage `qcm_ia_quota_jour`. Preuve `tests/sql/qcm-ia-preuve.sql`
jouée sur une base Postgres **locale** jetable (schéma minimal recréé), jamais en prod.

## Tâche 4 : interface

- `js/qcm-ia-rules.js` (pur, testé) : mêmes motifs d'article que le serveur (test d'accord
  entre les deux modules), libellé de trace, titres du cours.
- `js/db.js` : `proposerQuestionsIa`, `listBrouillonsIa`, `accepterBrouillonIa`,
  `rejeterBrouillonIa`.
- `js/views/themes.js` : bouton « Proposer avec l'IA » (thème avec cours), fenêtre de demande,
  panneau « Brouillons de l'IA » en tête de l'éditeur, formulaire de question en mode brouillon
  (bouton « Accepter dans le QCM », alerte si article hors cours), mention de trace sur la carte.
- `css/style.css` : styles du panneau et des cartes de brouillon.
- `js/nouveautes-data.js` : entrée « formateurs ».

## Tâche 5 : preuves

- Tests node : `node --test tests/qcm-ia-*.test.mjs` + suite complète.
- Essai réel (si la clé Mistral est disponible en local) : `scripts/qcm-ia-essai.mjs` lit un vrai
  cours (lecture seule), appelle Mistral, passe la réponse dans `analyserReponse`, écrit le JSON
  dans le dossier de travail. Aucune écriture en base.
- Banc : `functions.invoke("qcm-ia")` renvoie ces brouillons réels ; parcours formateur complet
  (demande, relecture, acceptation, question visible avec sa trace, rejet, brouillon écarté).

## Tâche 6 : mise en ligne (accord de Timy)

Migration en prod, déploiement de `qcm-ia` (outil MCP), secret inchangé (clé Mistral déjà
posée), fusion dans `main` après mise à jour, push, vérification en ligne.
