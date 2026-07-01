# QCM Mode Examen (Lot 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le mode examen au sous-système QCM d'ecsr-promo : tirage figé partagé, une seule passe chronométrée, note /20 avec miroir automatique dans la matrice Notes, et contrôles formateur (publier / dépublier / régénérer / réinitialiser).

**Architecture:** Le tirage est gelé à la publication dans `qcm.exam_question_ids` (aléatoire N ou sélection manuelle, même stockage). La note du stagiaire est écrite par lui dans `qcm_attempts`, puis répercutée dans `evaluations` par un trigger `security definer` (la RLS interdit à un stagiaire d'écrire une note). Réinitialiser = supprimer la tentative (cascade efface le miroir). Le player examen (vanilla JS ESM) réutilise le player d'entraînement du Lot 1, sans correction avant la fin, avec un chrono global.

**Tech Stack:** JavaScript ES modules (sans build ni framework de test), Supabase (Postgres + RLS), migrations via Supabase MCP, cache-bust automatique via hook `.githooks/pre-commit`.

**Spec de référence:** `docs/specs/2026-07-01-qcm-examen-lot2-design.md`

**Contexte d'environnement (vérifié le 2026-07-01):**
- Repo git : `C:/Users/watch/Dev/ECSR/TP_ECSR_App`, branche `main`. **Toutes les commandes de ce plan sont lancées depuis ce dossier.**
- Node 24 disponible ; `node --check <fichier>` valide la syntaxe des modules ES.
- Projet Supabase : `crpduennbqaemhfaywrz`. Migrations appliquées via l'outil MCP `apply_migration` (aucun fichier SQL versionné à ce jour ; ce plan en ajoute une copie de traçabilité dans `docs/`).
- Hook `pre-commit` (via `core.hooksPath=.githooks`) : dès qu'un fichier `js/*.js` ou `css/*.css` est stagé, il relance `node scripts/cache-bust.js --staged` qui réécrit uniformément les tokens `?v=` de tout le projet et re-`git add`. **Ne jamais bumper les `?v=` à la main.** Les nouveaux imports gardent le token courant (`?v=20260630i`), le hook les normalise.
- QCM encore verrouillé fondateur (RLS `qcm*` SELECT = `is_founder`, UI `canSeeQcm()`). Le fondateur `misterwatchi` est `is_admin=true` ET `stagiaire_id=15`, les deux formateurs sont `is_admin=true`. Donc `is_admin()` = « formateur ou admin », et le fondateur teste les deux côtés seul.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| Migration Supabase `qcm_examen_lot2` | Colonnes tirage/chrono, lien miroir, index unicité, fonction + trigger miroir | Appliquée via MCP |
| `docs/specs/2026-07-01-qcm-examen-lot2-migration.sql` | Copie versionnée de la migration (traçabilité) | Créer |
| `js/db.js` | Accès données examen (publier, tirage, ma tentative, réinit, liste tentatives) | Modifier |
| `js/views/qcm.js` | Player examen plein écran (pré-écran, chrono, navigation libre, résultat) | Modifier |
| `js/views/themes.js` | Bloc QCM enrichi : panneau formateur + entrée « Passer l'examen » | Modifier |
| `css/style.css` | Styles examen (badge, chrono, navigation, grille, panneau formateur) | Modifier |

Décisions de découpage : la logique data (db.js) est isolée du rendu (qcm.js, themes.js) ; le player examen reste dans `qcm.js` à côté du player entraînement (mêmes helpers `el/shuffle/letter`, même overlay) ; le panneau formateur vit dans `themes.js` car il s'ouvre depuis la modale thème et manipule l'état de la ligne.

---

## Task 1: Migration — schéma + trigger miroir

**Files:**
- Apply migration (MCP `apply_migration`, name: `qcm_examen_lot2`)
- Create: `docs/specs/2026-07-01-qcm-examen-lot2-migration.sql`

- [ ] **Step 1: Appliquer la migration**

Utiliser l'outil MCP `apply_migration` avec `project_id = crpduennbqaemhfaywrz`, `name = qcm_examen_lot2`, et ce SQL :

```sql
-- Le tirage figé partagé : liste ordonnée d'ids de questions, gelée au publish.
alter table qcm add column if not exists exam_question_ids jsonb;
alter table qcm add column if not exists exam_draw_mode text
  check (exam_draw_mode in ('random','manual'));
alter table qcm add column if not exists exam_seconds_per_question integer not null default 30;

-- Lien miroir attempt -> evaluations (null pour les notes manuelles).
alter table evaluations add column if not exists qcm_attempt_id bigint
  references qcm_attempts(id) on delete cascade;

-- Un seul examen officiel par stagiaire (la réinit supprime la ligne).
create unique index if not exists qcm_attempts_one_exam
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

drop trigger if exists trg_mirror_exam on qcm_attempts;
create trigger trg_mirror_exam
  after insert on qcm_attempts
  for each row execute function mirror_exam_to_evaluations();
```

- [ ] **Step 2: Vérifier que le schéma est en place**

Exécuter (MCP `execute_sql`, même `project_id`) :

```sql
select
  (select count(*) from information_schema.columns
     where table_name='qcm' and column_name in ('exam_question_ids','exam_draw_mode','exam_seconds_per_question')) as qcm_cols,
  (select count(*) from information_schema.columns
     where table_name='evaluations' and column_name='qcm_attempt_id') as eval_col,
  (select count(*) from pg_indexes where indexname='qcm_attempts_one_exam') as idx,
  (select count(*) from pg_trigger where tgname='trg_mirror_exam') as trg;
```

Expected : `qcm_cols=3, eval_col=1, idx=1, trg=1`.

- [ ] **Step 3: Smoke test du miroir + cascade (thème numéroté #48, stagiaire 15)**

```sql
-- Insère une tentative examen factice sur le QCM du thème #48.
with q as (select id from qcm where theme_id = 48 limit 1)
insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20, answers, started_at)
select q.id, 15, 'examen', 8, 10, 16.0, '{}'::jsonb, now() from q
returning id as attempt_id;
-- Note l'attempt_id renvoyé, puis vérifie le miroir :
select e.id, e.type, e.theme_numero, e.note, e.note_max, e.observation, e.qcm_attempt_id
from evaluations e
where e.observation = 'QCM examen' and e.theme_numero = 48 and e.stagiaire_id = 15;
```

Expected : une ligne `type='Thème', theme_numero=48, note=16.0, note_max=20, qcm_attempt_id` non nul.

- [ ] **Step 4: Vérifier le cascade + l'unicité, puis nettoyer**

```sql
-- L'unicité doit refuser une 2e tentative examen (doit lever une erreur duplicate key) :
with q as (select id from qcm where theme_id = 48 limit 1)
insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20, started_at)
select q.id, 15, 'examen', 5, 10, 10.0, now() from q;
-- => attendu : ERROR duplicate key value violates unique constraint "qcm_attempts_one_exam"

-- Réinitialisation = suppression de la tentative ; le miroir doit disparaître (cascade) :
delete from qcm_attempts where stagiaire_id = 15 and mode = 'examen'
  and qcm_id in (select id from qcm where theme_id = 48);
select count(*) as miroirs_restants from evaluations
where observation = 'QCM examen' and stagiaire_id = 15 and theme_numero = 48;
```

Expected : la 2e insertion échoue (unicité OK) ; après le delete, `miroirs_restants = 0` (cascade OK).

- [ ] **Step 5: Sauver une copie versionnée de la migration + commit**

Écrire le SQL du Step 1 dans `docs/specs/2026-07-01-qcm-examen-lot2-migration.sql`, puis :

```bash
git add docs/specs/2026-07-01-qcm-examen-lot2-migration.sql docs/specs/2026-07-01-qcm-examen-lot2-design.md docs/plans/2026-07-01-qcm-examen-lot2-plan.md
git commit -m "docs(qcm): spec, plan et SQL de la migration examen (Lot 2)"
```

(Commit docs-only : aucun `js/css` stagé, le hook cache-bust ne se déclenche pas.)

---

## Task 2: db.js — fonctions d'accès examen

**Files:**
- Modify: `js/db.js` (bloc `// === QCM (par thème) ===`, autour de `js/db.js:306-345`)

- [ ] **Step 1: Étendre `listQcmIndex` pour remonter la config d'examen**

Dans `js/db.js`, remplacer le `.select(...)` de `listQcmIndex` par la version enrichie :

```js
export async function listQcmIndex() {
  return cachedQuery("qcm_index", async () => {
    const { data, error } = await supabase
      .from("qcm")
      .select("id, theme_id, titre, published, published_by_email, published_at, exam_nb_questions, exam_pass_20, exam_seconds_per_question, exam_draw_mode, exam_question_ids, qcm_questions(count)");
    if (error) throw error;
    return (data || []).map((q) => ({
      ...q,
      nb_questions: q.qcm_questions?.[0]?.count ?? 0,
    }));
  });
}
```

- [ ] **Step 2: Ajouter les fonctions examen après `insertQcmAttempt`**

Insérer dans `js/db.js`, juste après la fonction `insertQcmAttempt` (vers `js/db.js:345`) :

```js
// Publie l'examen d'un QCM et gèle le tirage (formateur/admin). email = auteur.
export async function publishQcm(qcmId, { examQuestionIds, drawMode, nbQuestions, pass20, secondsPerQuestion, email }) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("qcm")
    .update({
      published: true,
      published_by_email: email ?? null,
      published_at: now,
      exam_question_ids: examQuestionIds,
      exam_draw_mode: drawMode,
      exam_nb_questions: nbQuestions ?? null,
      exam_pass_20: pass20,
      exam_seconds_per_question: secondsPerQuestion ?? 30,
      updated_at: now,
    })
    .eq("id", qcmId);
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Dépublie l'examen (conserve le tirage gelé).
export async function unpublishQcm(qcmId) {
  const { error } = await supabase
    .from("qcm")
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq("id", qcmId);
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Régénère le tirage gelé sans toucher à l'état de publication.
export async function setExamDraw(qcmId, { examQuestionIds, drawMode, nbQuestions }) {
  const { error } = await supabase
    .from("qcm")
    .update({
      exam_question_ids: examQuestionIds,
      exam_draw_mode: drawMode,
      exam_nb_questions: nbQuestions ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", qcmId);
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Ma tentative examen pour ce QCM (RLS : mes lignes uniquement). null si aucune.
export async function getMyExamAttempt(qcmId) {
  const { data, error } = await supabase
    .from("qcm_attempts")
    .select("*")
    .eq("qcm_id", qcmId)
    .eq("mode", "examen")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Tentatives examen de ce QCM (admin/formateur) : sélecteur de réinit + garde régénération.
export async function listExamAttempts(qcmId) {
  const { data, error } = await supabase
    .from("qcm_attempts")
    .select("id, stagiaire_id, note_20, finished_at, stagiaire:stagiaires!stagiaire_id(prenom)")
    .eq("qcm_id", qcmId)
    .eq("mode", "examen")
    .order("finished_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Réinitialise l'examen d'un stagiaire (admin) : supprime sa tentative (cascade -> miroir evaluations).
export async function resetExamAttempt(qcmId, stagiaireId) {
  const { error } = await supabase
    .from("qcm_attempts")
    .delete()
    .eq("qcm_id", qcmId)
    .eq("stagiaire_id", stagiaireId)
    .eq("mode", "examen");
  if (error) throw error;
}
```

- [ ] **Step 3: Vérifier la syntaxe**

Run: `node --check js/db.js`
Expected: exit 0, aucune sortie d'erreur.

- [ ] **Step 4: Commit**

```bash
git add js/db.js
git commit -m "feat(qcm): fonctions db examen (publier, tirage, ma tentative, reset)"
```

(Le hook cache-bust re-versionne les assets automatiquement.)

---

## Task 3: qcm.js — player examen

**Files:**
- Modify: `js/views/qcm.js` (imports en tête + nouvelles fonctions en fin de fichier)

- [ ] **Step 1: Étendre les imports**

Dans `js/views/qcm.js`, remplacer les deux lignes d'import concernées :

```js
import { el, clear, toast, formatDate } from "../utils.js?v=20260630i";
import { getQcmFull, insertQcmAttempt, getMyProfile, getMyExamAttempt } from "../db.js?v=20260630i";
```

(La ligne `import { icon } ...` reste inchangée. `shuffle` et `letter` déjà définis dans le fichier sont réutilisés.)

- [ ] **Step 2: Ajouter les helpers et le point d'entrée examen (fin de fichier)**

Ajouter à la fin de `js/views/qcm.js` :

```js
// === Examen (Lot 2) ===

function fmtTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

// Overlay plein écran dédié à l'examen. dismissible=false pendant la passe.
function examOverlay(dismissible = true) {
  const overlay = el("div", { class: "qcm-overlay" });
  const player = el("div", { class: "qcm-player qcm-exam" });
  overlay.appendChild(player);
  document.body.appendChild(overlay);
  document.body.classList.add("qcm-open");
  const close = () => { overlay.remove(); document.body.classList.remove("qcm-open"); };
  if (dismissible) overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  return { overlay, player, close };
}

function examHeader(theme, close, timerEl) {
  const numPrefix = theme.numero ? String(theme.numero).padStart(2, "0") + " · " : "";
  return el("div", { class: "qcm-head" },
    el("div", { class: "qcm-head-text" },
      el("span", { class: "qcm-badge exam" }, "Examen"),
      el("p", { class: "qcm-head-title" }, numPrefix + theme.titre),
    ),
    timerEl || null,
    el("button", { class: "qcm-close", type: "button", "aria-label": "Fermer", onClick: close }, icon.close()),
  );
}

// Point d'entrée : ouvre l'examen d'un thème (garde + pré-écran).
export async function openQcmExamen(theme, qcmMeta) {
  let full;
  try {
    full = await getQcmFull(qcmMeta.id);
  } catch (e) {
    toast("Impossible de charger l'examen : " + (e?.message || e), "error");
    return;
  }
  if (!full.published) {
    toast("L'examen de ce thème n'est pas encore publié.", "error");
    return;
  }

  // Résout le set gelé ; à défaut, toutes les questions avec options.
  const byId = new Map((full.questions || []).map((q) => [q.id, q]));
  const frozen = Array.isArray(full.exam_question_ids) ? full.exam_question_ids : [];
  let questions = frozen.length
    ? frozen.map((id) => byId.get(id)).filter(Boolean)
    : (full.questions || []);
  questions = questions.filter((q) => (q.options || []).length > 0);
  if (questions.length === 0) {
    toast("Cet examen n'a pas de questions exploitables.", "error");
    return;
  }

  let profile = null;
  try { profile = await getMyProfile(); } catch (e) { /* ignore */ }
  if (!profile?.stagiaire_id) {
    toast("Seul un stagiaire peut passer l'examen (compte non lié).", "error");
    return;
  }

  let existing = null;
  try { existing = await getMyExamAttempt(full.id); } catch (e) { /* ignore */ }
  if (existing) { showExamBlocked(theme, full, existing); return; }

  runExamPrescreen(theme, full, questions, profile);
}

// Écran « déjà passé » (blocage sauf réinitialisation formateur).
function showExamBlocked(theme, full, attempt) {
  const { player, close } = examOverlay();
  const passed = Number(attempt.note_20) >= Number(full.exam_pass_20 ?? 12);
  player.appendChild(examHeader(theme, close));
  player.appendChild(el("div", { class: "qcm-results" },
    el("div", { class: "qcm-score-circle" },
      el("span", { class: "qcm-score-big" }, `${attempt.note_20}/20`),
      el("small", {}, passed ? "Réussi" : "À retravailler"),
    ),
    el("p", { class: "qcm-results-sub" }, "Tu as déjà passé cet examen."),
    el("p", { class: "qcm-head-sub", style: "text-align:center" },
      "Passé le " + formatDate((attempt.finished_at || "").slice(0, 10))),
    el("p", { class: "qcm-results-sub", style: "font-size:0.82rem" },
      "Un formateur peut réinitialiser ta tentative si besoin."),
  ));
  player.appendChild(el("div", { class: "qcm-actions" },
    el("button", { class: "btn primary", type: "button", onClick: close }, "Fermer"),
  ));
}

// Pré-écran : rappel des règles avant de lancer le chrono.
function runExamPrescreen(theme, full, questions, profile) {
  const { player, close } = examOverlay();
  const total = questions.length;
  const secondsPer = full.exam_seconds_per_question || 30;
  const budget = secondsPer * total;
  player.appendChild(examHeader(theme, close));
  player.appendChild(el("div", { class: "qcm-prescreen" },
    el("p", { class: "qcm-prescreen-title" }, "Prêt pour l'examen ?"),
    el("ul", { class: "qcm-prescreen-list" },
      el("li", {}, `${total} questions`),
      el("li", {}, `Durée : ${fmtTime(budget)} (${secondsPer} s par question)`),
      el("li", {}, `Seuil de réussite : ${full.exam_pass_20}/20`),
      el("li", {}, "Une seule passe. Aucune correction avant la fin."),
    ),
    el("p", { class: "qcm-results-sub", style: "font-size:0.82rem" },
      "Le minuteur démarre dès que tu cliques sur Commencer."),
  ));
  player.appendChild(el("div", { class: "qcm-actions" },
    el("button", { class: "btn ghost", type: "button", onClick: close }, "Annuler"),
    el("button", { class: "btn primary", type: "button", onClick: () => {
      close();
      runExam(theme, full, questions, profile);
    } }, "Commencer l'examen"),
  ));
}
```

- [ ] **Step 3: Ajouter le moteur d'examen `runExam` (fin de fichier)**

Ajouter à la suite dans `js/views/qcm.js` :

```js
// Moteur d'examen : navigation libre, chrono global, aucune correction, submit à la fin.
function runExam(theme, full, questions, profile) {
  const startedAt = new Date().toISOString();
  const total = questions.length;
  const secondsPer = full.exam_seconds_per_question || 30;
  let remaining = secondsPer * total;
  let idx = 0;
  let submitted = false;
  const answers = {}; // question_id -> option_id choisi
  // Ordre des options mélangé une fois par question, stable pendant la passe.
  const optOrder = new Map(questions.map((q) => [q.id, shuffle(q.options || [])]));

  const { overlay, player, close: rawClose } = examOverlay(false);
  let timerId = null;
  function cleanup() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function close() { cleanup(); rawClose(); }
  function requestClose() {
    if (!submitted && !window.confirm("Quitter l'examen ? Ta progression sera perdue et rien ne sera enregistré.")) return;
    close();
  }

  const timerEl = el("span", { class: "qcm-timer" }, fmtTime(remaining));
  timerId = setInterval(() => {
    remaining -= 1;
    timerEl.textContent = fmtTime(remaining);
    if (remaining <= secondsPer) timerEl.classList.add("low");
    if (remaining <= 0) finish(true);
  }, 1000);

  function renderQuestion() {
    clear(player);
    player.appendChild(examHeader(theme, requestClose, timerEl));

    const answeredCount = Object.keys(answers).length;
    player.appendChild(el("div", { class: "qcm-progress-wrap" },
      el("div", { class: "qcm-progress-info" },
        el("span", {}, `Question ${idx + 1} / ${total}`),
        el("span", {}, `${answeredCount} / ${total} répondues`),
      ),
      el("div", { class: "qcm-progress" },
        el("div", { class: "qcm-progress-fill", style: `width:${Math.round((answeredCount / total) * 100)}%` })),
    ));

    const q = questions[idx];
    const card = el("div", { class: "qcm-card" });
    if (q.section) card.appendChild(el("p", { class: "qcm-head-sub" }, q.section));
    card.appendChild(el("p", { class: "qcm-question" }, q.enonce));
    if (q.image_url) {
      card.appendChild(el("img", { class: "qcm-question-img", src: q.image_url, alt: "Illustration de la question", loading: "lazy" }));
    }

    const choices = el("div", { class: "qcm-choices" });
    (optOrder.get(q.id) || []).forEach((opt, i) => {
      const selected = answers[q.id] === opt.id;
      const choice = el("button", { class: "qcm-choice" + (selected ? " selected" : ""), type: "button" },
        el("span", { class: "qcm-choice-letter" }, letter(i)),
        el("span", { class: "qcm-choice-text" }, opt.texte),
      );
      choice.addEventListener("click", () => {
        answers[q.id] = opt.id; // pas de correction : on mémorise et on rafraîchit
        renderQuestion();
      });
      choices.appendChild(choice);
    });
    card.appendChild(choices);
    player.appendChild(card);

    const prev = el("button", { class: "btn ghost", type: "button",
      onClick: () => { if (idx > 0) { idx -= 1; renderQuestion(); } } }, "Précédent");
    prev.disabled = idx === 0;
    const next = el("button", { class: "btn ghost", type: "button",
      onClick: () => { if (idx + 1 < total) { idx += 1; renderQuestion(); } } }, "Suivant");
    next.disabled = idx + 1 >= total;
    player.appendChild(el("div", { class: "qcm-exam-nav" }, prev, next));

    const grid = el("div", { class: "qcm-exam-grid" });
    questions.forEach((qq, i) => {
      const dot = el("button", {
        class: "qcm-grid-dot" + (i === idx ? " current" : "") + (answers[qq.id] != null ? " done" : ""),
        type: "button", onClick: () => { idx = i; renderQuestion(); },
      }, String(i + 1));
      grid.appendChild(dot);
    });
    player.appendChild(grid);

    player.appendChild(el("div", { class: "qcm-actions" },
      el("button", { class: "btn primary", type: "button", onClick: confirmFinish }, "Terminer l'examen"),
    ));
    overlay.scrollTop = 0;
  }

  function confirmFinish() {
    const answeredCount = Object.keys(answers).length;
    const msg = answeredCount < total
      ? `Il te reste ${total - answeredCount} question(s) sans réponse. Terminer quand même ?`
      : "Terminer et enregistrer ta note ?";
    if (window.confirm(msg)) finish(false);
  }

  async function finish(timedOut) {
    if (submitted) return;
    submitted = true;
    cleanup();

    let score = 0;
    questions.forEach((q) => {
      const chosen = answers[q.id];
      const correct = (q.options || []).find((o) => o.is_correct);
      if (correct && chosen === correct.id) score += 1;
    });
    const note20 = Math.round((score / total) * 20 * 10) / 10;

    // Insert de la tentative examen ; le trigger écrit le miroir evaluations.
    let saveError = null;
    try {
      await insertQcmAttempt({
        qcm_id: full.id,
        stagiaire_id: profile.stagiaire_id,
        mode: "examen",
        score,
        total,
        note_20: note20,
        answers,
        started_at: startedAt,
      });
    } catch (e) {
      saveError = e?.message || String(e);
    }
    renderResults(score, note20, timedOut, saveError);
  }

  function renderResults(score, note20, timedOut, saveError) {
    clear(player);
    player.appendChild(examHeader(theme, close));
    const passed = note20 >= Number(full.exam_pass_20 ?? 12);
    player.appendChild(el("div", { class: "qcm-results" },
      el("div", { class: "qcm-score-circle" },
        el("span", { class: "qcm-score-big" }, `${score}/${total}`),
        el("small", {}, `${note20}/20`),
      ),
      el("p", { class: "qcm-results-sub" }, passed ? "Réussi" : "À retravailler"),
      timedOut ? el("p", { class: "qcm-head-sub", style: "text-align:center" },
        "Temps écoulé : l'examen a été remis automatiquement.") : null,
      saveError ? el("p", { class: "qcm-explain ko" }, "Note non enregistrée : " + saveError) : null,
    ));

    const recap = el("div", { class: "qcm-recap" });
    questions.forEach((q, i) => {
      const correctOpt = (q.options || []).find((o) => o.is_correct);
      const ok = correctOpt && answers[q.id] === correctOpt.id;
      recap.appendChild(el("div", { class: "qcm-recap-item " + (ok ? "ok" : "ko") },
        el("span", { class: "qcm-recap-mark" }, ok ? "✓" : "✗"),
        el("div", { class: "qcm-recap-body" },
          el("p", { class: "qcm-recap-q" }, `${i + 1}. ${q.enonce}`),
          q.image_url ? el("img", { class: "qcm-recap-img", src: q.image_url, alt: "", loading: "lazy" }) : null,
          ok ? null : el("p", { class: "qcm-recap-a" }, "Bonne réponse : " + (correctOpt ? correctOpt.texte : "")),
        ),
      ));
    });
    player.appendChild(recap);
    player.appendChild(el("div", { class: "qcm-actions" },
      el("button", { class: "btn primary", type: "button", onClick: close }, "Fermer"),
    ));
    overlay.scrollTop = 0;
  }

  renderQuestion();
}
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `node --check js/views/qcm.js`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add js/views/qcm.js
git commit -m "feat(qcm): player examen (pré-écran, chrono global, navigation libre, résultat)"
```

---

## Task 4: themes.js — panneau formateur + entrée examen

**Files:**
- Modify: `js/views/themes.js` (imports en tête + fonction `themeQcmBlock` vers `js/views/themes.js:38-61`)

- [ ] **Step 1: Étendre les imports**

Dans `js/views/themes.js`, remplacer les lignes d'import 1, 4 et 6 par :

```js
import { listThemes, updateTheme, addTheme, deleteTheme, listQcmIndex, getQcmFull, publishQcm, unpublishQcm, setExamDraw, listExamAttempts, resetExamAttempt } from "../db.js?v=20260630i";
import { isAdmin, getAdminEmail, isFounder, getViewAs, isProf, isStagiaire } from "../auth-admin.js?v=20260630i";
import { openQcmEntrainement, openQcmExamen } from "./qcm.js?v=20260630i";
```

(Les autres imports — `el, clear, ...` et `icon` — restent inchangés.)

- [ ] **Step 2: Ajouter le helper de tirage aléatoire local**

Dans `js/views/themes.js`, juste avant la fonction `themeQcmBlock` (vers `js/views/themes.js:37`), ajouter :

```js
// Tire n éléments au hasard (ordre aléatoire). n falsy ou >= longueur => tout.
function sampleN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return (n && n < a.length) ? a.slice(0, n) : a;
}

function canManageExam() { return isAdmin() || isProf(); }
```

- [ ] **Step 3: Remplacer `themeQcmBlock` par la version avec examen**

Remplacer entièrement la fonction `themeQcmBlock` (de `function themeQcmBlock(theme) {` jusqu'à son `}` fermant, `js/views/themes.js:38-61`) par :

```js
// Bloc QCM dans la modale thème (remplace le placeholder quand un QCM existe).
function themeQcmBlock(theme) {
  const qcm = qcmByTheme.get(theme.id);
  if (!qcm) {
    return el("div", { class: "theme-modal-placeholder" },
      el("p", {}, "Contenu pédagogique à venir : cours, QCM, exercices, supports."),
      el("p", { class: "muted", style: "font-size:0.82rem" }, "Cette zone affichera les ressources liées au thème dès qu'elles seront disponibles."),
    );
  }
  const block = el("div", { class: "theme-qcm-block" },
    el("div", { class: "theme-qcm-block-head" },
      el("span", { class: "theme-qcm-block-icon" }, icon.quiz()),
      el("div", { style: "min-width:0" },
        el("p", { class: "theme-qcm-block-title" }, "QCM disponible"),
        el("p", { class: "muted", style: "font-size:0.82rem;margin:0" },
          `${qcm.nb_questions} questions` + (qcm.published ? " · examen en ligne" : " · examen non publié")),
      ),
    ),
    el("button", { class: "btn primary", type: "button",
      onClick: (ev) => { ev.preventDefault(); openQcmEntrainement(theme, qcm); },
    }, icon.play(), "Lancer l'entraînement"),
    el("p", { class: "muted", style: "font-size:0.78rem;text-align:center;margin:0.5rem 0 0" },
      "L'entraînement est libre et ne compte pas dans les notes."),
  );

  // Entrée examen (stagiaire) : visible si publié.
  if (isStagiaire() && qcm.published) {
    block.appendChild(el("div", { class: "theme-exam-entry" },
      el("button", { class: "btn accent", type: "button",
        onClick: (ev) => { ev.preventDefault(); openQcmExamen(theme, qcm); },
      }, "Passer l'examen"),
      el("p", { class: "muted", style: "font-size:0.78rem;text-align:center;margin:0.4rem 0 0" },
        "Une seule passe, chronométrée, notée sur 20."),
    ));
  }

  // Panneau formateur : publier / dépublier / régénérer / réinitialiser.
  if (canManageExam()) {
    block.appendChild(themeExamPanel(theme, qcm));
  }
  return block;
}
```

- [ ] **Step 4: Ajouter le panneau formateur `themeExamPanel`**

Ajouter dans `js/views/themes.js`, juste après `themeQcmBlock` :

```js
// Panneau formateur pour piloter l'examen d'un QCM (dans la modale thème).
function themeExamPanel(theme, qcm) {
  const panel = el("div", { class: "theme-exam-panel" });

  const status = el("p", { class: "theme-exam-status" });
  function refreshStatus() {
    clear(status);
    const on = !!qcm.published;
    const frozenN = Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids.length : null;
    status.appendChild(el("span", { class: "exam-badge " + (on ? "on" : "off") }, on ? "En ligne" : "Brouillon"));
    if (on) {
      status.appendChild(el("span", { class: "muted", style: "font-size:0.8rem" },
        ` ${frozenN ?? qcm.nb_questions} questions · seuil ${qcm.exam_pass_20}/20 · ${qcm.exam_seconds_per_question || 30}s/q`
        + (qcm.exam_draw_mode === "manual" ? " · sélection manuelle" : " · tirage aléatoire")));
    }
  }

  // Réglages (pré-remplis depuis la config courante).
  const nbInput = el("input", { type: "number", min: 1, max: qcm.nb_questions, placeholder: "toutes",
    value: qcm.exam_nb_questions ?? "" });
  const passInput = el("input", { type: "number", min: 0, max: 20, step: "0.5", value: qcm.exam_pass_20 ?? 12 });
  const secInput = el("input", { type: "number", min: 5, max: 300, step: 5, value: qcm.exam_seconds_per_question ?? 30 });
  const settings = el("div", { class: "theme-exam-settings" },
    el("label", {}, "Questions (N)", nbInput),
    el("label", {}, "Seuil /20", passInput),
    el("label", {}, "Secondes/question", secInput),
  );

  // Applique une publication (ou régénération) avec un set d'ids donné.
  async function doPublish(examQuestionIds, drawMode) {
    const pass = Number(passInput.value) || 12;
    const secs = Number(secInput.value) || 30;
    const nb = nbInput.value ? Number(nbInput.value) : null;
    try {
      await publishQcm(qcm.id, {
        examQuestionIds, drawMode, nbQuestions: nb, pass20: pass,
        secondsPerQuestion: secs, email: getAdminEmail(),
      });
      Object.assign(qcm, {
        published: true, exam_question_ids: examQuestionIds, exam_draw_mode: drawMode,
        exam_nb_questions: nb, exam_pass_20: pass, exam_seconds_per_question: secs,
      });
      toast(`Examen publié (${examQuestionIds.length} questions).`, "success");
      refreshStatus();
    } catch (e) {
      toast("Publication impossible : " + (e?.message || e), "error");
    }
  }

  // Tirage aléatoire : charge la banque, échantillonne N, publie.
  async function publishRandom() {
    try {
      const full = await getQcmFull(qcm.id);
      const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
      const nb = nbInput.value ? Number(nbInput.value) : null;
      const ids = sampleN(qs, nb).map((q) => q.id);
      if (ids.length === 0) { toast("Aucune question exploitable.", "error"); return; }
      await doPublish(ids, "random");
    } catch (e) {
      toast("Tirage impossible : " + (e?.message || e), "error");
    }
  }

  // Sélection manuelle : modale de cases à cocher, ordre = ordre des questions.
  async function chooseManual() {
    let full;
    try { full = await getQcmFull(qcm.id); }
    catch (e) { toast("Chargement impossible : " + (e?.message || e), "error"); return; }
    const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
    const preset = new Set(Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids : []);
    const backdrop = el("div", { class: "modal-backdrop" });
    const list = el("div", { class: "exam-pick-list" });
    qs.forEach((q, i) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = preset.has(q.id);
      cb.dataset.qid = String(q.id);
      list.appendChild(el("label", { class: "exam-pick-item" }, cb,
        el("span", {}, `${i + 1}. ${q.enonce}`)));
    });
    const modal = el("div", { class: "modal" },
      el("h3", {}, "Choisir les questions de l'examen"),
      el("p", { class: "muted", style: "font-size:0.85rem" }, "Coche les questions à inclure. L'ordre suivra l'ordre des questions."),
      list,
      el("div", { class: "modal-actions" },
        el("button", { class: "btn ghost", type: "button", onClick: () => backdrop.remove() }, "Annuler"),
        el("button", { class: "btn primary", type: "button", onClick: async () => {
          const ids = qs.filter((q) => list.querySelector(`input[data-qid="${q.id}"]`).checked).map((q) => q.id);
          if (ids.length === 0) { toast("Sélectionne au moins une question.", "error"); return; }
          backdrop.remove();
          await doPublish(ids, "manual");
        } }, "Publier cette sélection"),
      ),
    );
    backdrop.appendChild(modal);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  // Régénère le tirage (aléatoire) après contrôle « 0 tentative ».
  async function regenerate() {
    try {
      const attempts = await listExamAttempts(qcm.id);
      if (attempts.length > 0) {
        toast(`${attempts.length} stagiaire(s) ont déjà passé l'examen. Réinitialise-les avant de régénérer.`, "error");
        return;
      }
      const full = await getQcmFull(qcm.id);
      const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
      const nb = qcm.exam_nb_questions ?? (nbInput.value ? Number(nbInput.value) : null);
      const ids = sampleN(qs, nb).map((q) => q.id);
      await setExamDraw(qcm.id, { examQuestionIds: ids, drawMode: "random", nbQuestions: nb });
      Object.assign(qcm, { exam_question_ids: ids, exam_draw_mode: "random", exam_nb_questions: nb });
      toast(`Nouveau tirage de ${ids.length} questions.`, "success");
      refreshStatus();
    } catch (e) {
      toast("Régénération impossible : " + (e?.message || e), "error");
    }
  }

  async function doUnpublish() {
    try {
      await unpublishQcm(qcm.id);
      qcm.published = false;
      toast("Examen dépublié.", "success");
      refreshStatus();
    } catch (e) {
      toast("Dépublication impossible : " + (e?.message || e), "error");
    }
  }

  // Modale de gestion des tentatives (réinitialisation par stagiaire).
  async function manageAttempts() {
    let attempts;
    try { attempts = await listExamAttempts(qcm.id); }
    catch (e) { toast("Chargement impossible : " + (e?.message || e), "error"); return; }
    const backdrop = el("div", { class: "modal-backdrop" });
    const body = el("div", { class: "exam-attempts-list" });
    function fill() {
      clear(body);
      if (attempts.length === 0) {
        body.appendChild(el("p", { class: "muted" }, "Aucune tentative pour l'instant."));
        return;
      }
      attempts.forEach((a) => {
        const row = el("div", { class: "exam-attempt-row" },
          el("span", {}, (a.stagiaire?.prenom || `Stagiaire ${a.stagiaire_id}`) + ` — ${a.note_20}/20`),
          el("button", { class: "btn danger", type: "button", onClick: async () => {
            if (!window.confirm("Réinitialiser cette tentative ? La note sera supprimée.")) return;
            try {
              await resetExamAttempt(qcm.id, a.stagiaire_id);
              attempts = attempts.filter((x) => x.id !== a.id);
              toast("Tentative réinitialisée.", "success");
              fill();
            } catch (e) {
              toast("Réinitialisation impossible : " + (e?.message || e), "error");
            }
          } }, "Réinitialiser"),
        );
        body.appendChild(row);
      });
    }
    fill();
    const modal = el("div", { class: "modal" },
      el("h3", {}, "Tentatives d'examen"),
      body,
      el("div", { class: "modal-actions" },
        el("button", { class: "btn ghost", type: "button", onClick: () => backdrop.remove() }, "Fermer"),
      ),
    );
    backdrop.appendChild(modal);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  const actions = el("div", { class: "theme-exam-actions" },
    el("button", { class: "btn primary", type: "button", onClick: publishRandom }, "Tirer au hasard et publier"),
    el("button", { class: "btn ghost", type: "button", onClick: chooseManual }, "Choisir les questions"),
    el("button", { class: "btn ghost", type: "button", onClick: regenerate }, "Régénérer le tirage"),
    el("button", { class: "btn ghost", type: "button", onClick: manageAttempts }, "Gérer les tentatives"),
    el("button", { class: "btn ghost", type: "button", onClick: doUnpublish }, "Dépublier"),
  );

  panel.appendChild(el("p", { class: "theme-exam-panel-title" }, "Examen (formateur)"));
  panel.appendChild(status);
  panel.appendChild(settings);
  panel.appendChild(actions);
  refreshStatus();
  return panel;
}
```

- [ ] **Step 5: Vérifier la syntaxe**

Run: `node --check js/views/themes.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add js/views/themes.js
git commit -m "feat(qcm): panneau formateur examen + entrée stagiaire dans la modale thème"
```

---

## Task 5: CSS — styles examen

**Files:**
- Modify: `css/style.css` (append après le bloc QCM existant, après `css/style.css:5551`)

- [ ] **Step 1: Ajouter les styles examen à la fin du fichier**

Ajouter à la fin de `css/style.css` :

```css
/* === Examen (Lot 2) === */
.qcm-badge.exam { background: var(--c-stop-soft); color: var(--c-stop); }

.qcm-timer {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--accent-strong);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 4px 12px;
  align-self: center;
}
.qcm-timer.low { color: var(--c-stop); background: var(--c-stop-soft); }

.qcm-prescreen { text-align: center; padding: 0.6rem 0; }
.qcm-prescreen-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.9rem; }
.qcm-prescreen-list {
  list-style: none; padding: 0; margin: 0 auto 0.9rem; max-width: 320px;
  text-align: left; display: flex; flex-direction: column; gap: 0.5rem;
}
.qcm-prescreen-list li {
  background: var(--bg-elev); border: 1px solid var(--line);
  border-radius: 10px; padding: 0.6rem 0.8rem; font-size: 0.92rem;
}

.qcm-choice.selected { border-color: var(--accent); background: var(--accent-soft); }
.qcm-choice.selected .qcm-choice-letter { background: var(--accent); border-color: var(--accent); color: #fff; }

.qcm-exam-nav { display: flex; gap: 0.6rem; margin-top: 1rem; }
.qcm-exam-nav .btn { flex: 1; }
.qcm-exam-nav .btn:disabled { opacity: 0.45; cursor: default; }

.qcm-exam-grid {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.9rem;
  justify-content: center;
}
.qcm-grid-dot {
  width: 30px; height: 30px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--bg-elev);
  font-size: 0.8rem; font-weight: 600; cursor: pointer; color: var(--text-muted);
}
.qcm-grid-dot.done { border-color: var(--accent); color: var(--accent-strong); background: var(--accent-soft); }
.qcm-grid-dot.current { outline: 2px solid var(--accent); outline-offset: 1px; }

/* Panneau formateur dans la modale thème */
.theme-exam-entry { margin-top: 0.9rem; padding-top: 0.9rem; border-top: 1px solid var(--line-faint); }
.theme-exam-entry .btn { width: 100%; }

.theme-exam-panel { margin-top: 1rem; padding-top: 0.9rem; border-top: 1px dashed var(--line); }
.theme-exam-panel-title {
  margin: 0 0 0.5rem; font-size: 0.74rem; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--text-muted); font-weight: 700;
}
.theme-exam-status { margin: 0 0 0.6rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.exam-badge {
  font-size: 0.72rem; font-weight: 700; border-radius: 999px; padding: 2px 9px;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.exam-badge.on  { background: var(--c-go-soft); color: var(--c-go); }
.exam-badge.off { background: var(--bg-subtle); color: var(--text-muted); }

.theme-exam-settings { display: flex; gap: 0.5rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
.theme-exam-settings label {
  display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 90px;
  font-size: 0.72rem; color: var(--text-muted); font-weight: 600;
}
.theme-exam-settings input { width: 100%; }

.theme-exam-actions { display: flex; flex-direction: column; gap: 0.45rem; }
.theme-exam-actions .btn { width: 100%; }

.exam-pick-list { max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem; margin: 0.5rem 0; }
.exam-pick-item { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.88rem; padding: 0.35rem; }
.exam-pick-item input { margin-top: 3px; flex-shrink: 0; }

.exam-attempts-list { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.5rem 0; }
.exam-attempt-row {
  display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
  font-size: 0.9rem; padding: 0.4rem 0; border-bottom: 1px solid var(--line-faint);
}
```

- [ ] **Step 2: Vérifier l'équilibre des accolades**

Run: `node -e "const c=require('fs').readFileSync('css/style.css','utf8');const o=(c.match(/{/g)||[]).length,f=(c.match(/}/g)||[]).length;console.log('open',o,'close',f, o===f?'OK':'MISMATCH')"`
Expected: `open N close N OK` (nombres égaux).

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "style(qcm): styles du mode examen (chrono, navigation, panneau formateur)"
```

---

## Task 6: Vérification E2E manuelle (fondateur) + mémoire

Le preview MCP n'étant pas authentifié sur la prod, la vérification se fait dans l'app réelle connecté en fondateur (`misterwatchi`, `is_admin` + `stagiaire_id=15`). Recharger la page pour charger les nouveaux modules (tokens `?v=` bumpés par le hook).

- [ ] **Step 1: Publier un examen (thème non numéroté d'abord, pour éviter de polluer les Notes)**

Ouvrir la modale du thème **REMC C1** (id 80, non numéroté, 20 questions). Dans « Examen (formateur) » : régler N=5, seuil=12, 30 s/q, cliquer « Tirer au hasard et publier ».
Attendu : badge passe à « En ligne · 5 questions · seuil 12/20 · 30s/q · tirage aléatoire ». Vérifier en base :

```sql
select published, exam_draw_mode, exam_seconds_per_question, jsonb_array_length(exam_question_ids) as n
from qcm where theme_id = 80;
```
Attendu : `published=true, exam_draw_mode=random, exam_seconds_per_question=30, n=5`.

- [ ] **Step 2: Passer l'examen en tant que stagiaire**

Toujours en vue réelle (fondateur = stagiaire 15), cliquer « Passer l'examen », puis « Commencer ». Vérifier : chrono affiché (2:30 pour 5×30 s), navigation Précédent/Suivant + grille, aucune couleur de correction avant la fin. Répondre, « Terminer l'examen », confirmer.
Attendu : écran résultat note/20 + label + recap avec bonnes réponses. Vérifier :

```sql
select mode, score, total, note_20 from qcm_attempts
where stagiaire_id = 15 and mode = 'examen' and qcm_id in (select id from qcm where theme_id = 80);
```
Attendu : une ligne examen. **Comme le thème n'est pas numéroté, aucun miroir** :
```sql
select count(*) from evaluations where stagiaire_id = 15 and observation = 'QCM examen';
```
Attendu : `0`.

- [ ] **Step 3: Blocage 2e passage + réinitialisation**

Rouvrir « Passer l'examen » : l'écran « Tu as déjà passé cet examen » doit s'afficher (pas de nouvelle passe). Dans le panneau formateur, « Gérer les tentatives » → « Réinitialiser » la ligne du stagiaire. Rouvrir « Passer l'examen » : le pré-écran doit réapparaître (nouveau passage autorisé).

- [ ] **Step 4: Vérifier le miroir sur un thème numéroté, puis nettoyer**

Publier et passer l'examen du thème **#48** (numéroté). Après validation :
```sql
select e.theme_numero, e.note, e.observation, e.qcm_attempt_id
from evaluations e where e.stagiaire_id = 15 and e.observation = 'QCM examen' and e.theme_numero = 48;
```
Attendu : une ligne miroir. Vérifier qu'elle apparaît aussi dans la vue **Notes** de l'app.
Puis nettoyer les données de test (réinitialiser via l'UI, ou SQL) :
```sql
delete from qcm_attempts where stagiaire_id = 15 and mode = 'examen';
update qcm set published = false where theme_id in (48, 80);
select count(*) as miroirs from evaluations where stagiaire_id = 15 and observation = 'QCM examen';
```
Attendu : `miroirs = 0` (cascade), examens repassés en brouillon.

- [ ] **Step 5: Vérifier le chrono (auto-remise à zéro)**

Republier REMC C1 avec `secondes/question = 5` et N=1, passer l'examen sans répondre et laisser le chrono descendre à 0.
Attendu : à 0:00, remise automatique, écran résultat avec « Temps écoulé », note 0/20. Nettoyer la tentative ensuite (Step 4).

- [ ] **Step 6: Mettre à jour la mémoire projet**

Éditer `C:\Users\watch\.claude\projects\C--Users-watch-Dev-ECSR\memory\qcm_system.md` : passer « Lot 2 DESIGN VALIDÉ » à « **Lot 2 FAIT** » avec le hash du dernier commit, et noter tout écart constaté pendant l'E2E.

---

## Self-Review

**Couverture de la spec** (chaque décision du design → tâche) :
- Tirage figé partagé + 2 modes (aléatoire/manuel) → Task 1 (colonne), Task 2 (`publishQcm`/`setExamDraw`), Task 4 (`publishRandom`/`chooseManual`). ✓
- Miroir par trigger `security definer` + cascade → Task 1. ✓
- Unicité examen → Task 1 (index partiel), vérifiée Task 1 Step 4. ✓
- Options mélangées par élève → Task 3 (`optOrder = shuffle`). ✓
- Navigation libre + Terminer → Task 3 (`renderQuestion` prev/next/grid + `confirmFinish`). ✓
- Chrono global + auto-remise → Task 3 (`setInterval`, `finish(true)`). ✓
- Publier/dépublier/régénérer/réinitialiser (formateur) → Task 4 (`themeExamPanel`). ✓
- Entrée examen stagiaire + blocage déjà-passé → Task 3 (`openQcmExamen`/`showExamBlocked`), Task 4 (bouton). ✓
- `notes.js` intact, miroir via evaluations format « Thème » → Task 1 (trigger), aucun changement notes.js. ✓
- Verrou fondateur conservé (`canSeeQcm`) → inchangé ; gates rôle ajoutées (`canManageExam`, `isStagiaire`). ✓

**Placeholders** : aucun TODO/TBD ; tout le code est fourni. ✓

**Cohérence des types/signatures** : `publishQcm({examQuestionIds, drawMode, nbQuestions, pass20, secondsPerQuestion, email})` défini en Task 2, appelé en Task 4 avec les mêmes clés. `setExamDraw({examQuestionIds, drawMode, nbQuestions})`, `getMyExamAttempt(qcmId)`, `listExamAttempts(qcmId)`, `resetExamAttempt(qcmId, stagiaireId)` cohérents entre Task 2 et Task 4. `openQcmExamen(theme, qcmMeta)` exporté en Task 3, importé/appelé en Task 4. `shuffle`/`letter` réutilisés depuis le Lot 1. ✓

**Note d'exécution** : `window.confirm` est utilisé pour les actions finales/destructives (simple, sans dépendance) ; remplaçable par une modale maison plus tard si besoin de cohérence visuelle.
