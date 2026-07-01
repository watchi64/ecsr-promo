# Passation — Éditeur de QCM (formateur) + player multi-réponses

Date : 2026-07-01
Projet : TP ECSR App (ecsr-promo)
But de ce document : permettre de **reprendre dans une nouvelle conversation / un nouveau contexte** la construction de l'éditeur de QCM. Tout ce qui est nécessaire est ici (état, conventions, schéma, fonctions dispo, décisions validées, tâches restantes avec détail d'implémentation).

## 0. Où en est-on

- Le **sous-système QCM** (entraînement + **examen**) est fait et fortement raffiné. Voir specs : `docs/specs/2026-06-29-qcm-par-theme-design.md`, `docs/specs/2026-07-01-qcm-examen-lot2-design.md`, `docs/plans/2026-07-01-qcm-examen-lot2-plan.md`.
- La **fondation de l'éditeur** est posée (migration storage + fonctions db). Il reste **l'UI de l'éditeur**, le **player multi-réponses** et le **CSS**.
- Tout est sur la branche git **`lot2-qcm-examen`** (dossier `C:\Users\watch\Dev\ECSR\TP_ECSR_App`), **NON mergée sur `main`**. Dernier commit au moment de la passation : `63c16b3`.

## 1. Conventions projet (IMPORTANT, à respecter)

- **Stack** : HTML/CSS/JS **vanilla, modules ES**, pas de build. Backend **Supabase** (projet `crpduennbqaemhfaywrz`), migrations via MCP `apply_migration`.
- **Pas de framework de test.** Vérification = `node --check <fichier>` (syntaxe), requêtes SQL (MCP `execute_sql`), et **E2E manuel par le fondateur dans SON navigateur** (le navigateur du preview MCP n'est PAS authentifié sur la prod, donc il ne peut pas exercer les vues derrière l'auth).
- **Cache-bust** : hook `.githooks/pre-commit` (via `core.hooksPath`). Dès qu'un fichier `js/*.js` ou `css/*.css` est stagé au commit, il réécrit uniformément tous les tokens `?v=...` (16 fichiers) et les re-stage. **NE JAMAIS éditer un token `?v=` à la main.** Les nouveaux imports gardent le token courant, le hook normalise.
- **Servir en local** : `python -m http.server 8000` (config `.claude/launch.json`, nom `ecsr-app`), puis ouvrir `http://localhost:8000` dans le navigateur du fondateur (connecté).
- **Style DOM** : helper `el(tag, attrs, ...children)` (dans `js/utils.js`), `clear(node)`, `toast(msg, type)`. Modale = `el("div", { class: "modal-backdrop" }, el("div", { class: "modal" }, ...))` + clic sur le fond ferme. Icônes via `import { icon } from "../icons.js"` (vérifier les noms dispo dans `js/icons.js` : `quiz`, `play`, `close`, `trash`… ; s'il manque `plus`/`chevron`, en ajouter un ou réutiliser du texte).
- **Couleurs** : palette mint, pas de rouge vif. Variables CSS : `--accent`, `--accent-strong`, `--accent-soft`, `--accent-soft-2`, `--c-go`/`--c-go-soft`, `--c-stop`/`--c-stop-soft`, `--bg-elev`, `--bg-subtle`, `--line`, `--line-faint`, `--text-muted`, `--r`. Paliers de note pêche→vert : 8 / 12 / 16 (helper `noteClass()` dans `themes.js`).
- **Vocabulaire** : « Formateur » (jamais « Prof »), pas d'em-dash.

## 2. Verrou d'accès (phase dev)

- Le QCM n'est visible **que du fondateur** : `canSeeQcm()` dans `themes.js` = `isFounder() && !getViewAs()`. RLS `qcm`/`qcm_questions`/`qcm_options` en SELECT = `is_founder`.
- **`is_admin()`** = « formateur ou admin » côté serveur (les 2 formateurs + le fondateur ont `is_admin=true`). Les écritures qcm/questions/options + upload images sont gardées par `is_admin()`.
- Le fondateur **`misterwatchi`** est `is_admin=true` ET `stagiaire_id=15` → il teste tout seul (éditer, publier, passer).
- Helpers rôle (dans `js/auth-admin.js`) : `isFounder()`, `isAdmin()`, `isProf()`, `isStagiaire()`, `getViewAs()`, `getAdminEmail()`. Dans `themes.js` : `canManageExam()` = `isAdmin() || isProf()`.

## 3. Schéma & storage (déjà en place)

- `qcm_questions` : `id`, `qcm_id`, `section` (nullable), `enonce` (NOT NULL), `explication` (nullable), `ordre` (default 0), `created_at`, **`image_url`** (nullable).
- `qcm_options` : `id`, `question_id`, `texte` (NOT NULL), **`is_correct`** (bool, default false), `ordre` (default 0). Cascade delete via `question_id`.
- `qcm` : `id`, `theme_id` (unique), `titre`, `published`, `exam_question_ids` (jsonb), `exam_draw_mode`, `exam_seconds_per_question`, `exam_nb_questions`, `created_by_email`…
- Bucket Storage **`qcm-images`** (public en lecture). **Écriture (insert/update/delete) autorisée pour `is_admin()`** via la migration `qcm_images_admin_write` (2026-07-01, `docs/specs/2026-07-01-qcm-images-admin-write.sql`). La CSP d'`index.html` autorise déjà `https://*.supabase.co` en `img-src`.

## 4. Fonctions db déjà disponibles (dans `js/db.js`)

Pour l'éditeur (commit `63c16b3`) :
- `getOrCreateQcm(themeId, titre, email)` → renvoie l'`id` du qcm du thème, le crée s'il n'existe pas.
- `saveQcmQuestion(qcmId, q)` → crée/màj une question ET **remplace toutes ses options**. `q = { id?, section, enonce, explication, ordre, image_url, options: [{ texte, is_correct }] }`. Les options vides sont ignorées, `ordre` recalculé par position. Renvoie l'`id` de la question.
- `deleteQcmQuestion(questionId)` → supprime (cascade options).
- `reorderQcmQuestions(pairs)` → `pairs = [{ id, ordre }]`.
- `uploadQcmImage(file, qcmId, questionId)` → upload vers `qcm-images` (chemin `qcm<id>/q<qid>-<horodatage>.<ext>`), renvoie l'URL publique.

Déjà là avant : `getQcmFull(qcmId)` (renvoie le qcm + `questions` triées par ordre, chaque question a `options` triées), `listQcmIndex()`, `listMyQcmAttempts()`, `insertQcmAttempt()`, `publishQcm`/`unpublishQcm`/`updateExamConfig`/`listExamAttempts`/`resetExamAttempt`, `getMyProfile`, `listEvaluations`.

## 5. Décisions validées pour l'éditeur (avec le user)

1. **Multi-réponses** : une question peut avoir **une OU plusieurs** bonnes réponses (`is_correct` sur plusieurs options). Éditeur = **cases à cocher** par option. Score (player) = **toutes les bonnes cochées ET aucune fausse**.
2. **Création depuis zéro** : un thème sans QCM montre une entrée **« Créer un QCM »** (formateur) ; le 1er ajout de question crée la ligne `qcm` via `getOrCreateQcm`. Objectif : couvrir les 57 thèmes petit à petit.
3. **Placement** : l'éditeur s'ouvre en **plein écran** depuis un bouton **« Éditer les questions »** dans la zone formateur de la fiche QCM (`openQcmSheet`), et depuis l'entrée « Créer un QCM » de la liste.
4. **Une image par question** (colonne `image_url`).
5. **Réordonnancement par flèches ↑/↓** (proposé ; à confirmer, mais on part là-dessus).
6. Réservé fondateur en phase dev (comme le reste du QCM).

## 6. Tâches restantes (dans cet ordre)

### Tâche A — UI de l'éditeur (`js/views/themes.js` + imports)

**Imports à ajouter** (depuis `../db.js`) : `getOrCreateQcm, saveQcmQuestion, deleteQcmQuestion, reorderQcmQuestions, uploadQcmImage`.

**`openQcmEditor(theme, qcmId|null)`** (overlay plein écran, réutiliser la structure `.qcm-overlay`/`.qcm-player` du player, ou une classe dédiée `.qcm-editor`) :
- Résout `qcmId` : si null → `await getOrCreateQcm(theme.id, theme.titre, getAdminEmail())`.
- Charge `full = await getQcmFull(qcmId)`.
- En-tête : « Éditer · {N° · }{titre} » + bouton fermer.
- Liste des questions (triées par `ordre`) ; chaque carte affiche : section (badge), énoncé, miniature image si `image_url`, options (chaque avec ✓ si `is_correct`). Boutons par carte : **Éditer**, **Supprimer** (confirm), **↑**, **↓**.
  - ↑/↓ : échanger `ordre` avec le voisin puis `reorderQcmQuestions([...])` et re-render.
  - Supprimer : `deleteQcmQuestion(id)` puis re-render.
- Bouton **« Ajouter une question »** → `openQuestionForm(qcmId, null, reload)`.
- Après toute modif : re-`getQcmFull` + re-render la liste de l'éditeur. **À la fermeture de l'éditeur**, rafraîchir la vue Thèmes (appeler `reload(lastContainer)` ou re-render) pour que la puce/notes/nb_questions se mettent à jour.

**`openQuestionForm(qcmId, question|null, onSaved)`** (modale) :
- Champs : `section` (input), `enonce` (textarea, requis), `explication` (textarea, optionnel).
- **Image** : aperçu de `image_url` courant + `<input type="file" accept="image/*">`. À la sélection : `url = await uploadQcmImage(file, qcmId, question?.id)` → stocker dans une var locale `pendingImageUrl` + afficher l'aperçu. Bouton **« Retirer l'image »** → `pendingImageUrl = null`.
- **Options** : liste dynamique ; chaque ligne = `input texte` + `checkbox "bonne réponse"` (`is_correct`) + bouton retirer. Bouton **« Ajouter une option »**. Pré-remplir depuis `question.options` en édition.
- **Validation avant save** : énoncé non vide ; au moins 2 options non vides ; au moins 1 option cochée « bonne réponse ».
- **Save** : construire `q = { id: question?.id, section, enonce, explication, image_url: pendingImageUrl, ordre: question?.ordre ?? (nbQuestions), options: [{texte, is_correct}] }` puis `await saveQcmQuestion(qcmId, q)` → fermer + `onSaved()`.
- Convention : garder la possibilité d'une option « Je ne sais pas. » (jamais cochée) comme dans la banque existante (optionnel).

**Entrées** :
- Dans **`openQcmSheet`** (zone `if (canManageExam())`, à côté / au-dessus de `themeExamPanel`) : bouton **« Éditer les questions »** → `openQcmEditor(theme, qcm.id)`.
- Dans **`renderThemeRow`**, la cellule QCM : aujourd'hui `qcm ? qcmCellEl(theme, qcm) : null`. La passer à `qcm ? qcmCellEl(theme, qcm) : (canManageExam() ? createQcmCellEl(theme) : null)`.
  - `createQcmCellEl(theme)` : petit bouton **« ＋ Créer QCM »** (réutiliser `.theme-qcm-hint`) → `openQcmEditor(theme, null)`.
  - ⚠️ `loadQcmIndex()` ne met dans `qcmByTheme` que les qcm avec `nb_questions > 0`. Donc un qcm créé mais vide (0 question) réaffichera « Créer QCM » (getOrCreateQcm renverra l'existant, pas de doublon). Acceptable ; sinon, inclure les qcm à 0 question dans l'index et distinguer « Éditer » / « Créer ».

### Tâche B — Player multi-réponses (`js/views/qcm.js`)

Aujourd'hui le player est **QCU** (une seule réponse). Le rendre multi :
- **Entraînement** (`runEntrainement`) : remplacer le clic-unique-correction-immédiate par des **cases à cocher** + un bouton **« Valider »**. `answers[q.id]` devient un **tableau d'ids** d'options cochées. À la validation : marquer visuellement bonnes/fausses ; **incrémenter le score si l'ensemble coché === l'ensemble des bonnes** (mêmes ids, ni plus ni moins). Puis « Question suivante ».
- **Examen** (`runExam`) : les options deviennent des **toggles** (coché/décoché), `answers[q.id]` = **tableau d'ids**. Pas de correction avant la fin. Dans `finish()`, scoring : `correctSet = q.options.filter(o=>o.is_correct).map(o=>o.id)` ; `chosen = answers[q.id]||[]` ; question juste si `chosen.length === correctSet.length && correctSet.every(id => chosen.includes(id))`.
- **Recap résultats** : afficher **toutes** les bonnes réponses (join), et l'état juste/faux par la comparaison d'ensembles.
- **Compat** : une question à 1 seule bonne réponse fonctionne comme un cas particulier du multi. Le snapshot `answers` (jsonb) passe de `{qid: option_id}` à `{qid: [option_id,...]}` — sans souci côté DB.
- Indiquer à l'écran quand c'est multi (« Plusieurs réponses possibles ») si la question a >1 bonne réponse — optionnel mais utile.

### Tâche C — CSS (`css/style.css`, à la fin)

Classes à styler (mint, cohérent avec l'existant `.qcm-*` et `.theme-exam-*`) :
- Overlay éditeur (`.qcm-editor` ou réutiliser `.qcm-overlay`/`.qcm-player`).
- Carte question dans la liste éditeur (section badge, énoncé, miniature, options, boutons ↑/↓/éditer/suppr).
- Formulaire question (champs, zone options avec case à cocher, aperçu image + bouton retirer).
- Player multi : cases à cocher (`.qcm-choice` avec état coché distinct du survol — cf. `.qcm-choice.selected` déjà présent), bouton Valider.
- Vérifier l'équilibre des accolades : `node -e "const c=require('fs').readFileSync('css/style.css','utf8');const o=(c.match(/{/g)||[]).length,f=(c.match(/}/g)||[]).length;console.log(o,f,o===f?'OK':'MISMATCH')"`.

## 7. Rappels de vérification / commit

- Après chaque fichier : `node --check js/views/qcm.js` (etc.), CSS = check accolades.
- Commit avec le trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Le hook bumpe les tokens (normal, 16 fichiers).
- Smoke test possible : recharger `http://localhost:8000` (preview) et vérifier **0 erreur console** (le player/éditeur sont derrière l'auth, mais une erreur de module casserait le boot).
- E2E réel = fondateur dans son navigateur.

## 8. Points en attente (hors éditeur, à ne pas perdre)

- **Contenu REMC C1** : la question « Quelle est la différence entre tirer et pousser le volant ? » a été signalée comme pédagogiquement douteuse par le user (« on tire toujours le volant »). En attente de la bonne réponse pour corriger la banque (ne rien inventer — règle projet).
- **« Ma note d'examen »** dans la fiche/liste = dernière note de la **matrice Notes** (`evaluations`) pour un thème numéroté, sinon la tentative examen QCM. Décision validée ; garder ce comportement.
- **Seuil de réussite retiré** partout (plus de « Réussi / À retravailler »). La colonne `qcm.exam_pass_20` existe encore mais n'est plus utilisée.
- **Mettre à jour la spec Lot 2** (`2026-07-01-qcm-examen-lot2-design.md`) pour acter : pas de seuil, fiche QCM dédiée, panneau formateur Modifier/Publier. (Pas encore fait.)
- **Merge** `lot2-qcm-examen` → `main` (+ push GitHub Pages) quand l'ensemble est validé en E2E.
- Rappel : **le QCM reste réservé au fondateur** tant que ce n'est pas prêt pour la promo (RLS `is_founder` + `canSeeQcm()`). Pour ouvrir : remettre les SELECT `qcm*` en `to authenticated using(true)` ET élargir `canSeeQcm()`.

## 9. Historique des commits de la branche (repères)

`448d1db` docs Lot 2 · `b689535` db exam · `6cd4d85` player examen · `6e2e767` panneau formateur · `4f5c554` css examen · `9fbd177` sans seuil + ergonomie · `44eaeea` sélection manuelle tout cocher/décocher · `79563ed` fiche QCM dédiée + notes liste · `833c741` notes officielles + refresh + Modifier/Publier · `711ce1f`/`6aafa28`/`0f0a646` polish cellule liste · `63c16b3` **db éditeur + policy upload images** (dernier).
