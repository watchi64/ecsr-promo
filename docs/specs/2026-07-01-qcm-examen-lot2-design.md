# Design · Lot 2 — Mode examen (QCM par thème)

Date : 2026-07-01
Projet : TP ECSR App (ecsr-promo)
Statut : design validé, prêt pour plan d'implémentation
Parent : `docs/specs/2026-06-29-qcm-par-theme-design.md` (spec globale du sous-système QCM)

## 1. Objectif du lot

Ajouter le **mode examen**, distinct de l'entraînement (Lot 1 fait) :

- Une **seule passe officielle** par stagiaire, **aucune correction avant la fin**.
- Note enregistrée **sur 20** dans `qcm_attempts` (source de vérité), avec **miroir** dans la matrice Notes (`evaluations`) pour les thèmes numérotés.
- Le **formateur** publie / dépublie l'examen d'un thème, peut **régénérer** le tirage et **réinitialiser** la tentative d'un stagiaire. Tant que ce n'est pas publié, l'examen est bloqué.
- À l'examen, tous les élèves ont **exactement les mêmes questions** : un **tirage figé et partagé**, pas un tirage aléatoire par élève.

Hors périmètre (reste au Lot 3) : vue Thèmes enrichie (ma note / date / moyenne classe via RPC agrégée sans fuite), filtre « mes points faibles », éditeur complet de questions.

## 2. Décisions validées (2026-07-01)

| Sujet | Décision |
|---|---|
| Où figer le tirage | **À la publication.** Publier gèle le set de questions. Stocké dans `qcm.exam_question_ids` (tableau JSON ordonné d'ids). Tous les élèves lisent ce même set. |
| Comment produire le tirage | **Deux modes au choix du formateur**, même stockage : (a) **aléatoire** — le système tire N (`exam_nb_questions`) au hasard ; (b) **manuel** — le formateur coche ses questions. `exam_draw_mode` mémorise la méthode. |
| Ordre des réponses | **Mélangé par élève.** Mêmes questions et même ordre de questions pour tous (l'ordre du set gelé), mais l'ordre des options A/B/C/D est mélangé côté client par élève. Réduit la recopie. |
| Navigation | **Libre avant/arrière** tant que « Terminer l'examen » n'est pas cliqué ; l'élève peut changer ses réponses. Aucune correction avant la fin dans tous les cas. |
| Minuteur | **Chrono global** = `exam_seconds_per_question` × N (défaut **30 s** par question, réglable par le formateur). Un seul compte à rebours pour tout l'examen, compatible avec la navigation libre. À zéro → **remise automatique** (questions non répondues comptées fausses). |
| Écriture de la note | **Miroir via trigger `security definer`** sur `qcm_attempts` (car RLS `evaluations` = écriture `is_admin()` seulement, un stagiaire ne peut pas écrire sa note). Lien `evaluations.qcm_attempt_id` avec `on delete cascade`. |
| Réinitialisation | = **supprimer la tentative examen** du stagiaire (droit admin déjà en place). Le cascade efface le miroir. Aucune logique de nettoyage séparée. |
| Unicité | Index unique partiel `(qcm_id, stagiaire_id) where mode = 'examen'`. |
| Enregistrement | La tentative examen est créée **uniquement à la validation** (pas de ligne « démarrée »). Fermer avant = rien enregistré. |

### Faits d'environnement qui cadrent la conception

- `qcm` possède déjà `published`, `published_by_email`, `published_at`, `exam_nb_questions`, `exam_pass_20`. Manque seulement de quoi figer le tirage.
- RLS `evaluations` : `select` pour tout authentifié, **écriture `is_admin()` seulement**. Un stagiaire ne peut donc pas écrire dans la matrice Notes → le miroir passe obligatoirement par un trigger `security definer`.
- RLS `qcm_attempts` : insert/select **de ses propres lignes** pour un stagiaire ; `is_admin()` a tous les droits (donc réinitialisation = delete admin). Pas de policy delete stagiaire (bien : un élève ne peut pas effacer sa tentative).
- Rôles : les deux formateurs et le fondateur ont `is_admin = true`. Donc `is_admin()` = « formateur ou admin » côté serveur (gate correcte pour publier / réinitialiser).
- Le fondateur (`misterwatchi`) est `is_admin = true` **et** lié au **stagiaire 15 (Timy)** → il peut **tester l'examen de bout en bout seul** (publier en admin, passer en tant que stagiaire 15). Toujours derrière le verrou dev `canSeeQcm()` = fondateur.

## 3. Modifications de schéma (migration)

```sql
-- Le tirage figé partagé : liste ordonnée d'ids de questions, gelée au publish.
alter table qcm add column exam_question_ids jsonb;          -- null = pas encore gelé
alter table qcm add column exam_draw_mode text
  check (exam_draw_mode in ('random','manual'));             -- méthode de production du set
alter table qcm add column exam_seconds_per_question integer not null default 30;  -- base du chrono global

-- Lien miroir attempt -> evaluations, pour réinitialiser via cascade.
alter table evaluations add column qcm_attempt_id bigint
  references qcm_attempts(id) on delete cascade;             -- null pour les notes manuelles

-- Un seul examen officiel par stagiaire (la réinit supprime la ligne).
create unique index qcm_attempts_one_exam
  on qcm_attempts (qcm_id, stagiaire_id) where mode = 'examen';

-- Miroir automatique de l'examen vers la matrice Notes (thèmes numérotés).
create or replace function mirror_exam_to_evaluations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero    integer;
  v_titre     text;
  v_qcm_titre text;
begin
  if NEW.mode <> 'examen' then
    return NEW;
  end if;
  select t.numero, t.titre, q.titre
    into v_numero, v_titre, v_qcm_titre
  from qcm q
  join themes t on t.id = q.theme_id
  where q.id = NEW.qcm_id;

  if v_numero is not null then
    insert into evaluations
      (stagiaire_id, type, theme_numero, theme_titre,
       note, note_max, observation, date_eval, controle_libelle, qcm_attempt_id)
    values
      (NEW.stagiaire_id, 'Thème', v_numero, v_titre,
       NEW.note_20, 20, 'QCM examen', current_date, v_qcm_titre, NEW.id);
  end if;
  return NEW;
end;
$$;

create trigger trg_mirror_exam
  after insert on qcm_attempts
  for each row execute function mirror_exam_to_evaluations();
```

Notes migration :
- Le trigger est `security definer` (owner postgres) → bypass RLS `evaluations`, donc l'insert du miroir passe même dans la session d'un stagiaire.
- Vérifier au moment de la migration que le trigger d'audit `evaluations_audit` ne casse pas sur ce chemin (colonne `changed_by` alimentée par `auth.email()` = email du stagiaire, acceptable).
- Thème **non numéroté** (REMC, notion) : pas de miroir, la note reste dans `qcm_attempts` (visible dans la vue Thèmes au Lot 3). Conforme au gotcha Notes.

## 4. Flux fonctionnels

### 4.1 Publication et tirage (formateur)

Depuis la modale thème, bloc QCM, panneau formateur (visible si `isAdmin()` ou `isProf()`) :

1. Réglages : `exam_nb_questions` (N, vide = toutes), `exam_pass_20` (seuil informatif) et `exam_seconds_per_question` (base du chrono, défaut 30 s).
2. Choix du mode de tirage :
   - **Aléatoire** : le client tire N ids au hasard dans la banque, ordonnés, → `exam_question_ids`, `exam_draw_mode = 'random'`.
   - **Manuel** : le formateur coche les questions ; la sélection ordonnée → `exam_question_ids`, `exam_draw_mode = 'manual'` (N est alors déduit du nombre coché).
3. **Publier** : `published = true`, `published_by_email`, `published_at`, `updated_at = now()`, set gelé écrit.
4. **Dépublier** : `published = false`. On **conserve** `exam_question_ids` (ne pas changer l'examen de ceux qui l'ont déjà passé).
5. **Régénérer le tirage** : re-tire (mode aléatoire) ou ré-ouvre la sélection (mode manuel). **Autorisé seulement si 0 tentative examen** ; sinon avertissement invitant à réinitialiser d'abord.
6. **Réinitialiser un stagiaire** : sélecteur listant qui a passé l'examen ; delete de sa ligne examen (cascade → miroir), ce qui rouvre un passage.

### 4.2 Passer l'examen (stagiaire)

1. Entrée « Passer l'examen » dans le bloc QCM, visible si `published = true`.
2. Pré-écran : rappel « 1 seule passe, N questions, seuil X/20 ». Bloqué si `getMyExamAttempt` renvoie déjà une tentative (message « Examen déjà passé : note/20 le JJ/MM », sauf réinitialisation formateur).
3. Chargement du set gelé : `getQcmFull` (banque complète) filtré et ordonné selon `exam_question_ids` (ids disparus ignorés). Options **mélangées par élève** (question par question, ordre des questions = celui du set gelé).
4. Déroulé **sans correction**, navigation **libre avant/arrière**, barre de progression, indicateur de questions répondues. **Chrono global** affiché (mm:ss), initialisé à `exam_seconds_per_question` × N ; à zéro → **remise automatique** de l'examen (questions non répondues comptées fausses). Bouton **« Terminer l'examen »** (confirmation) disponible à tout moment.
5. À la validation :
   - `note_20 = round(score / total * 20, 1)`.
   - Insert `qcm_attempts` (`mode = 'examen'`, `score`, `total`, `note_20`, `answers` = snapshot `{question_id: option_id}`, `started_at`, `finished_at`).
   - Le trigger écrit le miroir `evaluations` si thème numéroté.
6. Écran résultat : note /20, label **« Réussi »** si `note_20 >= exam_pass_20` sinon **« À retravailler »**, recap des questions avec bonnes réponses. Pas de bouton « Recommencer » (examen à passe unique).

## 5. Intégration au code

### `db.js` (nouvelles fonctions, respect du cache mémoire + invalidation)

- `publishQcm(qcmId, { examQuestionIds, drawMode, nbQuestions, pass20 })` : update champs publication + set gelé, invalide `qcm_index`.
- `unpublishQcm(qcmId)` : `published = false`, invalide `qcm_index`.
- `regenerateExamDraw(qcmId, examQuestionIds, drawMode)` : réécrit le set gelé (appelé côté formateur après contrôle « 0 tentative »).
- `getMyExamAttempt(qcmId)` : `select` de ma tentative examen (RLS `select_own`), renvoie la ligne ou null.
- `resetExamAttempt(qcmId, stagiaireId)` : delete admin de la ligne examen (cascade miroir).
- `listExamAttempts(qcmId)` : liste des tentatives examen (admin) pour le sélecteur de réinitialisation.
- `insertQcmAttempt` (existant) : réutilisé pour `mode = 'examen'`.

### `js/views/qcm.js`

- `openQcmExamen(theme, qcmMeta)` : pré-écran, garde (publié + pas de tentative), moteur d'examen (set gelé, options mélangées, navigation libre, **chrono global + auto-remise à zéro**, terminer, résultat). Réutilise le look et les helpers du player entraînement (`el`, `shuffle`, `letter`, overlay plein écran, couleurs `--c-go` / `--c-stop`, pas de rouge vif). Le chrono utilise `setInterval` nettoyé à la fermeture et à la remise.

### `js/views/themes.js`

- Bloc QCM enrichi : panneau formateur (publier / dépublier / régénérer / réinitialiser, réglages N et seuil, choix aléatoire/manuel) et entrée élève « Passer l'examen ».
- Gates : contrôles formateur si `isAdmin() || isProf()` ; entrée examen si `isStagiaire()`. Le fondateur (admin + stagiaire 15) voit les deux → test complet. Tout reste sous `canSeeQcm()` (fondateur, hors aperçu) pendant la phase dev.

### `js/views/notes.js`

- **Aucune refonte.** Le miroir réutilise le format type « Thème » déjà géré (`theme_numero`, `theme_titre`, `note`, `note_max`).

### Cache-bust

- Automatique via le hook pre-commit. Ne rien bumper à la main.

## 6. Permissions (récap Lot 2)

| Action | Stagiaire | Formateur / Admin (`is_admin()`) |
|---|---|---|
| Passer l'examen (si publié) | oui, 1 fois | oui (si lié à un stagiaire) |
| Publier / dépublier | non | oui |
| Régénérer le tirage | non | oui (si 0 tentative) |
| Réinitialiser la tentative d'un stagiaire | non | oui |
| Voir sa note d'examen | oui (la sienne) | oui (toutes) |
| Voir les notes des autres | non | oui |

## 7. Tests et validation

- **Fondateur seul** : publier l'examen d'un thème, puis le passer en tant que stagiaire 15, vérifier note /20 + label seuil + recap. Vérifier le blocage au 2e essai, puis réinitialiser et re-passer.
- **Miroir** : tester d'abord sur un thème **numéroté** (ex. #48) pour vérifier l'apparition dans la matrice Notes ; nettoyer la note de test ensuite (réinitialisation → cascade). Tester un thème **non numéroté** (REMC C1, id 80) pour vérifier l'absence de miroir.
- **Unicité** : vérifier que l'index partiel empêche une 2e tentative examen sans réinitialisation.
- **Régénération** : bloquée si une tentative existe, autorisée après réinitialisation.
- **Chrono** : régler un temps court (ex. 1 question, 5 s) pour vérifier la remise automatique à zéro et le nettoyage du `setInterval` (pas de fuite après fermeture).
- Harness local si besoin (comme au Lot 1), le preview MCP n'étant pas authentifié sur la prod.

## 8. Points ouverts / risques

- **Édition de la banque après gel** : `exam_question_ids` référence des ids ; une question supprimée après publication est ignorée à l'affichage (total recalculé). L'éditeur complet arrive au Lot 3 ; en attendant, régénérer après édition.
- **Audit `evaluations`** : confirmer que le trigger d'audit tolère l'insert via `security definer` (pas de NOT NULL bloquant sur `changed_by`).
- **Abandon en cours d'examen** : rien n'est enregistré tant que « Terminer » n'est pas cliqué **et** que le chrono n'a pas atteint zéro. Fermer l'overlay avant la fin = abandon sans note. Le chrono ne persiste pas : recharger la page redémarre l'examen à plein temps (acceptable en v1, à durcir plus tard si besoin d'un anti-triche par rechargement).
- **Moyenne de classe** : hors Lot 2 (Lot 3, via vue/RPC agrégée pour ne pas exposer les notes individuelles).
