# Plan d'implémentation — Outil EPCF, lot 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saisie des grilles EPCF (salle/véhicule) par les formateurs + restitution radar stagiaire vs moyenne groupe dans Mon suivi, avec RLS stricte. Livré avant le 20/07/2026.

**Architecture:** App vanilla JS sans build (vues = fonctions `render*` routées par hash dans `main.js`, données via `js/db.js` → Supabase). Nouvelle table `epcf_evaluations` (scores jsonb par code critère) + 2 helpers SQL de rôle + RPC d'agrégation. Trames en config JS versionnée. Radar SVG maison. Spec de référence : `docs/superpowers/specs/2026-07-13-epcf-design.md` (**lire en entier avant de commencer**).

**Tech Stack:** Vanilla JS ES modules, Supabase (PostgREST + RLS), SVG, CSS maison (variables `--line`, `--bg-elev`, `--accent`, `--c-go`, `--c-stop`, PAS `--border`/`--bg-card` qui n'existent pas).

**Contraintes d'environnement :**
- Exécution dans un **worktree dédié** (branche `lot1-epcf`) créé via superpowers:using-git-worktrees — le dossier principal `TP_ECSR_App` est partagé entre sessions.
- Le hook pre-commit `scripts/cache-bust.js` re-versionne le token `?v=` de TOUT le projet à chaque commit touchant js/css : le bruit dans les diffs est normal. Les imports dans les fichiers NOUVEAUX doivent porter le token courant lisible en tête de n'importe quel fichier existant (ex. `?v=20260713b`) — le hook le maintiendra ensuite.
- Pas de framework de test : chaque tâche se vérifie par `node --check` + inspection ciblée ; la vérification navigateur se fait en tâche finale.
- La migration SQL s'applique via le MCP Supabase (`apply_migration`, project_id `crpduennbqaemhfaywrz`) — si indisponible, la donner à l'utilisateur pour le SQL editor.

---

## Structure de fichiers

| Fichier | Rôle |
|---|---|
| `migration_supabase/2026-07-14_epcf_evaluations.sql` (ECSR root, HORS repo) | table + helpers + RLS + RPC |
| `js/epcf-trames.js` (créer) | définition versionnée des 2 trames (données pures) |
| `js/epcf-restitution.js` (créer) | scoring, radar SVG, section restitution réutilisable |
| `js/views/epcf.js` (créer) | vue formateur : liste, formulaire de saisie, vue classe |
| `js/db.js` (modifier) | `listEpcf`, `upsertEpcf`, `getEpcfMoyennes` |
| `js/main.js` (modifier) | onglet + route `epcf` (visibilité prof/admin) |
| `js/icons.js` (modifier) | icône `clipboard` |
| `js/views/mon-suivi.js` (modifier) | retrait section fiche, ajout section « Mes EPCF » |
| `css/style.css` (modifier) | styles `.epcf-*`, retrait styles fiche morts |

---

### Task 1 : Migration SQL — table, helpers de rôle, RLS, RPC

**Files:**
- Create: `C:\Users\watch\Dev\ECSR\migration_supabase\2026-07-14_epcf_evaluations.sql`

- [ ] **Step 1 : Écrire le fichier SQL** (contenu complet) :

```sql
-- 2026-07-14 — Outil EPCF (évaluations en cours de formation), lot 1.
-- Table + helpers de rôle + RLS stricte + RPC moyennes groupe.
-- Réf : TP_ECSR_App/docs/superpowers/specs/2026-07-13-epcf-design.md

create table if not exists public.epcf_evaluations (
  id bigint generated always as identity primary key,
  stagiaire_id integer not null references public.stagiaires(id) on delete cascade,
  trame text not null check (trame in ('salle','vehicule')),
  trame_version integer not null default 1,
  date_eval date not null default current_date,
  evaluateur_prof_id integer references public.profs(id),
  auto_eval boolean not null default false,
  contexte text not null default 'EPCF',
  meta jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  competences_acquises jsonb not null default '[]'::jsonb,
  commentaire text,
  created_by uuid default auth.uid(),
  updated_by_who text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists epcf_evaluations_stagiaire_idx
  on public.epcf_evaluations (stagiaire_id, trame, date_eval desc);

-- Helpers de rôle — MÊME pattern que is_admin() existant (match par email du JWT).
create or replace function public.is_prof()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from user_profiles
    where lower(email) = lower((select auth.jwt() ->> 'email'))
      and role = 'prof'
  );
$$;

create or replace function public.my_stagiaire_id()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select stagiaire_id from user_profiles
  where lower(email) = lower((select auth.jwt() ->> 'email'))
  limit 1;
$$;

alter table public.epcf_evaluations enable row level security;

create policy epcf_select on public.epcf_evaluations for select to authenticated
  using (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id());
create policy epcf_insert on public.epcf_evaluations for insert to authenticated
  with check (is_admin() or is_prof());
create policy epcf_update on public.epcf_evaluations for update to authenticated
  using (is_admin() or is_prof()) with check (is_admin() or is_prof());
create policy epcf_delete on public.epcf_evaluations for delete to authenticated
  using (is_admin() or is_prof());

-- Moyennes du groupe par critère : dernière éval FORMATEUR (auto_eval=false) de
-- chaque stagiaire, contexte EPCF. SECURITY DEFINER : n'expose que des agrégats.
create or replace function public.epcf_moyennes(p_trame text)
returns table(critere text, moyenne numeric, effectif integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with dernieres as (
    select distinct on (stagiaire_id) scores
    from epcf_evaluations
    where trame = p_trame and contexte = 'EPCF' and auto_eval = false
    order by stagiaire_id, date_eval desc, id desc
  ),
  notes as (
    select k.key as critere,
           case k.value when 'A' then 2 when 'R' then 1 when 'NA' then 0 end as val
    from dernieres d, jsonb_each_text(d.scores) k
    where k.value in ('A','R','NA')
  )
  select critere, round(avg(val)::numeric, 3) as moyenne, count(*)::integer as effectif
  from notes
  group by critere;
$$;
```

- [ ] **Step 2 : Appliquer** via MCP Supabase `apply_migration` (name `epcf_evaluations`, project `crpduennbqaemhfaywrz`).

- [ ] **Step 3 : Vérifier** par `execute_sql` :
  - `select count(*) from epcf_evaluations;` → 0, pas d'erreur.
  - `select polname from pg_policies where tablename='epcf_evaluations';` → 4 policies.
  - `select * from epcf_moyennes('salle');` → 0 lignes, pas d'erreur.
  - `insert into epcf_evaluations (stagiaire_id, trame, scores) values (15, 'salle', '{"PREP1":"A","ANIM1":"R"}'::jsonb); select * from epcf_moyennes('salle'); delete from epcf_evaluations;` → 2 lignes (PREP1 moyenne 2, ANIM1 moyenne 1, effectif 1) puis nettoyage.

- [ ] **Step 4 : Pas de commit** (fichier hors repo). Noter dans le rapport de tâche que la migration est appliquée.

---

### Task 2 : Config des trames — `js/epcf-trames.js`

**Files:**
- Create: `js/epcf-trames.js`

- [ ] **Step 1 : Créer le fichier** (contenu complet — libellés = transcription exacte de la spec §2) :

```js
// Trames EPCF (grilles d'évaluation officielles d'Hocine, CCP1 — 09/07/2026).
// NE PAS modifier une version publiée : toute évolution de la grille = version++
// (les évals stockées portent trame_version et se réaffichent avec leur définition).

export const NOTE_VALUES = { A: 2, R: 1, NA: 0 };
export const NOTE_LABELS = { A: "Acquis", R: "À renforcer", NA: "Non acquis" };

export const EPCF_TRAMES = {
  salle: {
    version: 1,
    label: "Salle",
    competences: ["C1", "C2", "C4", "C6"],
    metaFields: [
      { key: "theme", label: "Thème" },
      { key: "duree", label: "Durée" },
    ],
    sections: [
      {
        code: "PREP", court: "Préparation",
        titre: "Préparation (de X minutes)",
        competenceTP: "1 — Construire et préparer le scénario d'une séance collective de formation",
        criteres: [
          { code: "PREP1", libelle: "Les objectifs sont ciblés pour des élèves conducteurs." },
          { code: "PREP2", libelle: "Une hiérarchie des objectifs est établie suivant le parcours des élèves." },
          { code: "PREP3", libelle: "Les contenus sont adaptés aux objectifs définis." },
          { code: "PREP4", libelle: "Les animations prévues sont cohérentes avec les différents objectifs." },
          { code: "PREP5", libelle: "Les différents temps de la séance sont organisés." },
        ],
      },
      {
        code: "ANIM", court: "Animation",
        titre: "Cours, explication, application",
        competenceTP: "2 — Animer une séance collective de formation à la sécurité routière",
        criteres: [
          { code: "ANIM1", libelle: "Le plan est en lien avec l'objectif." },
          { code: "ANIM2", libelle: "Utilise-t-il les connaissances des élèves ?" },
          { code: "ANIM3", libelle: "Méthodes et outils pédagogiques sont utilisés." },
          { code: "ANIM4", libelle: "Les contenus sont maîtrisés." },
          { code: "ANIM5", libelle: "Donne-t-il du sens à la règle ?" },
          { code: "ANIM6", libelle: "Communication positive (facilitant / confiance)." },
          { code: "ANIM7", libelle: "La durée de la séance est respectée." },
        ],
      },
      {
        code: "EVAL", court: "Évaluations",
        titre: "Évaluation générale statique · Évaluation spécifique statique · Évaluation finale",
        competenceTP: "4 — Évaluer le degré d'acquisition des compétences des apprenants",
        criteres: [
          { code: "EVAL1", libelle: "Explique-t-il l'intérêt de l'évaluation ?" },
          { code: "EVAL2", libelle: "Cherche-t-il à connaître les élèves ?" },
          { code: "EVAL3", libelle: "L'évaluation est-elle en lien avec le thème / REMC ?" },
          { code: "EVAL4", libelle: "La restitution des résultats permet l'auto-évaluation et l'auto-réflexion ?" },
          { code: "EVAL5", libelle: "L'explication des résultats est claire pour les élèves." },
          { code: "EVAL6", libelle: "Les critères de l'évaluation finale sont déterminés." },
          { code: "EVAL7", libelle: "L'évaluation finale est réalisable." },
        ],
      },
      {
        code: "BILEV", court: "Bilan & objectif",
        titre: "Bilan des évaluations · Détermination de l'objectif",
        competenceTP: "6 — Repérer les difficultés d'apprentissage et essayer d'y remédier",
        criteres: [
          { code: "BILEV1", libelle: "Repérer les difficultés d'apprentissage particulières des élèves." },
          { code: "BILEV2", libelle: "Identifier les difficultés d'apprentissage particulières des élèves." },
          { code: "BILEV3", libelle: "L'objectif déterminé correspond aux difficultés d'apprentissage." },
          { code: "BILEV4", libelle: "L'intérêt de l'objectif choisi est expliqué aux élèves." },
        ],
      },
      {
        code: "BILAN", court: "Bilan final",
        titre: "Bilan final",
        competenceTP: null,
        criteres: [
          { code: "BILAN1", libelle: "Une restitution du message de sécurité routière est évoquée." },
          { code: "BILAN2", libelle: "Une projection pour une prochaine séance est proposée (livret)." },
        ],
      },
    ],
  },

  vehicule: {
    version: 1,
    label: "Véhicule",
    competences: ["C3", "C4", "C6", "C7"],
    metaFields: [
      { key: "niveau_eleve", label: "Niveau de l'élève cobaye" },
      { key: "duree", label: "Durée" },
    ],
    sections: [
      {
        code: "COND", court: "Animation conduite",
        titre: "Explication, démonstration, guidage, autonomie, répétition",
        competenceTP: "3 — Animer une séance individuelle de formation à la conduite d'un véhicule léger",
        criteres: [
          { code: "COND1", libelle: "L'objectif est-il respecté ? Les modifications sont-elles justifiées ?" },
          { code: "COND2", libelle: "Les choix d'itinéraire sont réalisables en fonction des impératifs." },
          { code: "COND3", libelle: "Les techniques pédagogiques sont adaptées à la conduite (démo…)." },
          { code: "COND4", libelle: "Les interventions sont pertinentes et motivées." },
          { code: "COND5", libelle: "Les contenus et procédures sont maîtrisés." },
          { code: "COND6", libelle: "Communication positive (facilitant / confiance / rassurant)." },
          { code: "COND7", libelle: "La durée de la séance est respectée." },
          { code: "COND8", libelle: "La sécurité pour tous est assurée." },
        ],
      },
      {
        code: "EVAL", court: "Évaluations",
        titre: "Évaluation générale statique · Évaluation spécifique statique · Évaluation finale",
        competenceTP: "4 — Évaluer le degré d'acquisition des compétences des apprenants",
        criteres: [
          { code: "EVAL1", libelle: "Explique-t-il l'intérêt de l'évaluation ?" },
          { code: "EVAL2", libelle: "Cherche-t-il à connaître l'apprenant ?" },
          { code: "EVAL3", libelle: "L'évaluation est-elle en lien avec l'objectif / livret ?" },
          { code: "EVAL4", libelle: "Le contexte d'évaluation est-il propice aux capacités de l'apprenant ?" },
          { code: "EVAL5", libelle: "La restitution des résultats permet l'auto-évaluation et l'auto-réflexion ?" },
          { code: "EVAL6", libelle: "Les critères de l'évaluation finale sont déterminés." },
          { code: "EVAL7", libelle: "L'évaluation finale est réalisable." },
        ],
      },
      {
        code: "BILEV", court: "Bilan & objectif",
        titre: "Bilan des évaluations · Détermination de l'objectif",
        competenceTP: "6 — Repérer les difficultés d'apprentissage et essayer d'y remédier",
        criteres: [
          { code: "BILEV1", libelle: "Repérer les difficultés d'apprentissage particulières de l'élève." },
          { code: "BILEV2", libelle: "Identifier les difficultés d'apprentissage particulières de l'élève." },
          { code: "BILEV3", libelle: "L'objectif déterminé correspond aux difficultés d'apprentissage." },
          { code: "BILEV4", libelle: "L'intérêt de l'objectif choisi est expliqué à l'élève." },
          { code: "BILEV5", libelle: "Communication positive (empathie / écoute / posture professionnelle)." },
        ],
      },
      {
        code: "BILAN", court: "Bilan final",
        titre: "Bilan final",
        competenceTP: null,
        criteres: [
          { code: "BILAN1", libelle: "Une restitution du message de sécurité routière est évoquée." },
          { code: "BILAN2", libelle: "Une projection pour une prochaine séance est proposée (livret)." },
        ],
      },
      {
        code: "PERC", court: "Perception (C7)",
        titre: "Conduite commentée, guidage, démonstration",
        competenceTP: "7 — Apprécier la dynamique de l'environnement routier et identifier les risques potentiels",
        criteres: [
          { code: "PERC1", libelle: "La prise d'information est riche et variée (CAHLLM)." },
          { code: "PERC2", libelle: "Les indices sont triés." },
          { code: "PERC3", libelle: "Les indices sont hiérarchisés." },
          { code: "PERC4", libelle: "Les prévisions sont pertinentes (risques)." },
          { code: "PERC5", libelle: "Les indices sont pris en compte pour anticiper le comportement de l'apprenant." },
          { code: "PERC6", libelle: "Les indices sont partagés et analysés avec l'apprenant." },
        ],
      },
    ],
  },
};
```

- [ ] **Step 2 : Vérifier** : `node --check js/epcf-trames.js` → OK. Compter les critères : salle 25, véhicule 28 (`node -e "import('./js/epcf-trames.js').then(m => { for (const [k,t] of Object.entries(m.EPCF_TRAMES)) console.log(k, t.sections.reduce((s,x)=>s+x.criteres.length,0)); })"` — lancer depuis la racine du worktree ; si l'import échoue à cause du token `?v=`, ce fichier n'importe rien donc ça passe).

- [ ] **Step 3 : Commit** : `git add js/epcf-trames.js && git commit -m "epcf: trames officielles salle/véhicule (config versionnée)"`

---

### Task 3 : Accès données — `js/db.js`

**Files:**
- Modify: `js/db.js` (ajouter en fin de section données, avant les fonctions d'invitation)

- [ ] **Step 1 : Ajouter les 3 fonctions** :

```js
// === EPCF (évaluations en cours de formation) ===

export async function listEpcf(filters = {}) {
  let q = supabase
    .from("epcf_evaluations")
    .select("*, evaluateur:profs!evaluateur_prof_id(nom), stagiaire:stagiaires!stagiaire_id(prenom, nom)")
    .order("date_eval", { ascending: false })
    .order("id", { ascending: false });
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  if (filters.trame) q = q.eq("trame", filters.trame);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Insert (pas d'id) ou update (id fourni). Renvoie la ligne écrite.
export async function upsertEpcf(evalRow) {
  const payload = { ...evalRow, updated_at: new Date().toISOString() };
  delete payload.evaluateur;   // colonnes jointes de listEpcf, pas des colonnes de la table
  delete payload.stagiaire;
  let q;
  if (payload.id) {
    const id = payload.id;
    delete payload.id;
    q = supabase.from("epcf_evaluations").update(payload).eq("id", id).select().single();
  } else {
    q = supabase.from("epcf_evaluations").insert(payload).select().single();
  }
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function deleteEpcf(id) {
  const { error } = await supabase.from("epcf_evaluations").delete().eq("id", id);
  if (error) throw error;
}

// Moyennes du groupe par critère (RPC SECURITY DEFINER — agrégats seuls).
export async function getEpcfMoyennes(trame) {
  const { data, error } = await supabase.rpc("epcf_moyennes", { p_trame: trame });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2 : Vérifier** : `node --check js/db.js` → OK.

- [ ] **Step 3 : Commit** : `git add js/db.js && git commit -m "epcf: fonctions db listEpcf/upsertEpcf/deleteEpcf/getEpcfMoyennes"`

---

### Task 4 : Scoring + radar + restitution — `js/epcf-restitution.js`

**Files:**
- Create: `js/epcf-restitution.js`

- [ ] **Step 1 : Créer le fichier** (le token `?v=` des imports : reprendre celui visible dans `js/views/mon-suivi.js`) :

```js
// Restitution EPCF : scoring des phases, radar SVG, section réutilisable
// (affichée dans Mon suivi ; réutilisable ailleurs).

import { el, clear, formatDate } from "./utils.js?v=20260713b";
import { EPCF_TRAMES, NOTE_VALUES, NOTE_LABELS } from "./epcf-trames.js?v=20260713b";

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

// Score 0..1 d'une phase pour UNE éval ({code:'A'|'R'|'NA'}). null si rien de renseigné.
export function phaseScore(section, scores) {
  const vals = section.criteres
    .map((c) => NOTE_VALUES[scores?.[c.code]])
    .filter((v) => v !== undefined);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / (vals.length * 2);
}

// Score 0..1 d'une phase depuis les moyennes RPC ([{critere, moyenne, effectif}]).
export function phaseScoreFromMoyennes(section, moyennes) {
  const byCode = Object.fromEntries((moyennes || []).map((m) => [m.critere, Number(m.moyenne)]));
  const vals = section.criteres.map((c) => byCode[c.code]).filter((v) => v !== undefined);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / (vals.length * 2);
}

// Radar SVG. axes = [libellés courts] ; series = [{ values: [0..1|null], className }].
// Une phase non renseignée est tracée à 0 (le détail dessous fait foi).
export function buildRadar(axes, series, size = 340) {
  const cx = size / 2, cy = size / 2 + 4, R = size * 0.32;
  const n = axes.length;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const px = (i, f) => cx + Math.cos(ang(i)) * R * f;
  const py = (i, f) => cy + Math.sin(ang(i)) * R * f;
  const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, class: "epcf-radar", role: "img" });
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    const pts = Array.from({ length: n }, (_, i) => `${px(i, f)},${py(i, f)}`).join(" ");
    svg.appendChild(svgEl("polygon", { points: pts, class: "epcf-radar-ring" }));
  });
  axes.forEach((a, i) => {
    svg.appendChild(svgEl("line", { x1: cx, y1: cy, x2: px(i, 1), y2: py(i, 1), class: "epcf-radar-spoke" }));
    const c = Math.cos(ang(i));
    const t = svgEl("text", {
      x: px(i, 1.14), y: py(i, 1.14), class: "epcf-radar-label",
      "text-anchor": Math.abs(c) < 0.3 ? "middle" : (c > 0 ? "start" : "end"),
    });
    t.textContent = a;
    svg.appendChild(t);
  });
  series.forEach((s) => {
    const pts = s.values.map((v, i) => `${px(i, v ?? 0)},${py(i, v ?? 0)}`).join(" ");
    svg.appendChild(svgEl("polygon", { points: pts, class: "epcf-radar-serie " + s.className }));
  });
  return svg;
}

// Détail par critère d'une éval : sections dépliées, chips A / À renforcer / Non acquis.
export function renderEpcfDetail(trameKey, evalRow) {
  const trame = EPCF_TRAMES[trameKey];
  const wrap = el("div", { class: "epcf-detail" });
  trame.sections.forEach((sec) => {
    const box = el("div", { class: "epcf-detail-section" },
      el("h5", { class: "epcf-detail-title" }, sec.titre,
        sec.competenceTP ? el("span", { class: "muted epcf-detail-tp" }, " — " + sec.competenceTP) : null));
    sec.criteres.forEach((c) => {
      const note = evalRow.scores?.[c.code];
      box.appendChild(el("div", { class: "epcf-detail-row" },
        el("span", { class: "epcf-chip " + (note || "vide") }, note ? NOTE_LABELS[note] : "—"),
        el("span", {}, c.libelle),
      ));
    });
    wrap.appendChild(box);
  });
  const comps = evalRow.competences_acquises || [];
  if (comps.length) {
    wrap.appendChild(el("p", { class: "epcf-comps" }, "Compétences acquises : ",
      el("strong", {}, comps.join(", "))));
  }
  if (evalRow.commentaire) {
    wrap.appendChild(el("p", { class: "epcf-commentaire" },
      el("strong", {}, "Commentaire : "), evalRow.commentaire));
  }
  return wrap;
}

// Section complète pour UNE trame : radar (éval choisie vs moyenne groupe) + détail.
// evals : évals du stagiaire pour cette trame, triées desc (listEpcf). moyennes : RPC.
export function renderEpcfTrameSection(trameKey, evals, moyennes) {
  const trame = EPCF_TRAMES[trameKey];
  const section = el("div", { class: "epcf-resti" },
    el("h4", { class: "epcf-resti-title" }, "EPCF " + trame.label));
  if (!evals.length) {
    section.appendChild(el("p", { class: "muted" }, "Pas encore d'évaluation " + trame.label.toLowerCase() + "."));
    return section;
  }
  const body = el("div");
  section.appendChild(body);

  const show = (evalRow) => {
    clear(body);
    const axes = trame.sections.map((s) => s.court);
    const serieMoi = { values: trame.sections.map((s) => phaseScore(s, evalRow.scores)), className: "moi" };
    const series = [serieMoi];
    const maxEffectif = Math.max(0, ...(moyennes || []).map((m) => m.effectif));
    if (maxEffectif >= 2) {
      series.unshift({ values: trame.sections.map((s) => phaseScoreFromMoyennes(s, moyennes)), className: "groupe" });
    }
    body.appendChild(el("div", { class: "epcf-radar-wrap" }, buildRadar(axes, series)));
    body.appendChild(el("p", { class: "epcf-legende muted" },
      el("span", { class: "epcf-leg moi" }), " Moi",
      maxEffectif >= 2 ? el("span", {}, "  ·  ") : null,
      maxEffectif >= 2 ? el("span", { class: "epcf-leg groupe" }) : null,
      maxEffectif >= 2 ? " Moyenne du groupe" : null,
    ));
    body.appendChild(el("p", { class: "muted epcf-eval-meta" },
      `Évaluation du ${formatDate(evalRow.date_eval)}` +
      (evalRow.evaluateur?.nom ? ` · par ${evalRow.evaluateur.nom}` : "")));
    body.appendChild(renderEpcfDetail(trameKey, evalRow));
  };

  if (evals.length > 1) {
    const sel = el("select", { class: "epcf-eval-select" });
    evals.forEach((ev, i) => {
      const o = el("option", { value: String(i) }, formatDate(ev.date_eval) + (ev.evaluateur?.nom ? " — " + ev.evaluateur.nom : ""));
      if (i === 0) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => show(evals[Number(sel.value)]));
    section.insertBefore(el("div", { class: "epcf-eval-select-wrap" }, sel), body);
  }
  show(evals[0]);
  return section;
}
```

- [ ] **Step 2 : Vérifier** : `node --check js/epcf-restitution.js` → OK.

- [ ] **Step 3 : Commit** : `git add js/epcf-restitution.js && git commit -m "epcf: scoring phases + radar SVG + section restitution"`

---

### Task 5 : Vue formateur — `js/views/epcf.js` (liste + formulaire)

**Files:**
- Create: `js/views/epcf.js`

- [ ] **Step 1 : Créer la vue** avec garde de rôle, liste des stagiaires et formulaire :

```js
// Vue EPCF (formateurs/admin) : liste des stagiaires × trames, saisie de grille,
// vue classe. Les stagiaires n'y ont pas accès (garde + onglet masqué + RLS).

import { listStagiaires, listProfs, listEpcf, upsertEpcf } from "../db.js?v=20260713b";
import { el, clear, isoDate, formatDate, displayStagiaire, compareByNom, toast } from "../utils.js?v=20260713b";
import { isAdmin, isProf, getProfile } from "../auth-admin.js?v=20260713b";
import { getCurrentWho } from "../identity.js?v=20260713b";
import { EPCF_TRAMES, NOTE_LABELS } from "../epcf-trames.js?v=20260713b";
import { phaseScoreFromMoyennes } from "../epcf-restitution.js?v=20260713b";

let stagiaires = [];
let profs = [];
let evals = [];   // toutes les évals (les profs lisent tout via RLS)

const TRAME_KEYS = ["salle", "vehicule"];

function evalsFor(sid, trameKey) {
  return evals.filter((e) => e.stagiaire_id === sid && e.trame === trameKey);
}

export async function renderEpcf(container) {
  clear(container);
  if (!isAdmin() && !isProf()) {
    container.appendChild(el("div", { class: "view-header" },
      el("h2", {}, "EPCF")));
    container.appendChild(el("p", { class: "muted" },
      "Espace réservé aux formateurs. Tes résultats EPCF sont dans l'onglet Mon suivi."));
    return;
  }
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  [stagiaires, profs, evals] = await Promise.all([
    listStagiaires(), listProfs(), listEpcf(),
  ]);
  stagiaires = stagiaires.slice().sort(compareByNom);
  clear(container);

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Formateurs"),
      el("h2", {}, "EPCF"),
      el("p", { class: "subtitle" }, "Évaluations en cours de formation — grilles CCP1 salle et véhicule."),
    ),
  ));

  const body = el("div", { class: "epcf-body" });
  container.appendChild(body);
  showListe(body);
}

// --- Liste : stagiaires × trames, statut + boutons ---
function showListe(body) {
  clear(body);
  const table = el("table", { class: "epcf-table" });
  table.appendChild(el("thead", {}, el("tr", {},
    el("th", {}, "Stagiaire"),
    ...TRAME_KEYS.map((k) => el("th", {}, EPCF_TRAMES[k].label)),
  )));
  const tbody = el("tbody");
  stagiaires.forEach((s) => {
    const tr = el("tr", {}, el("td", {}, displayStagiaire(s)));
    TRAME_KEYS.forEach((k) => {
      const list = evalsFor(s.id, k);
      const cell = el("td", { class: "epcf-cell" });
      if (list.length) {
        cell.appendChild(el("span", { class: "epcf-statut ok" }, "évalué le " + formatDate(list[0].date_eval)));
        cell.appendChild(el("button", { class: "btn ghost sm", onClick: () => showForm(body, s, k, list[0]) }, "Modifier"));
      } else {
        cell.appendChild(el("span", { class: "epcf-statut muted" }, "à évaluer"));
      }
      cell.appendChild(el("button", { class: "btn primary sm", onClick: () => showForm(body, s, k, null) },
        list.length ? "Nouvelle éval" : "Évaluer"));
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(table);
  body.appendChild(el("div", { style: "margin-top:1rem" },
    el("button", { class: "btn ghost", onClick: () => showClasse(body) }, "Vue classe (moyennes)")));
}

// --- Formulaire de saisie d'une grille ---
function showForm(body, stagiaire, trameKey, existing) {
  clear(body);
  const trame = EPCF_TRAMES[trameKey];
  const scores = { ...(existing?.scores || {}) };
  const compSel = new Set(existing?.competences_acquises || []);

  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn ghost sm", onClick: () => showListe(body) }, "← Retour"),
    el("h3", {}, `${trame.label} — ${displayStagiaire(stagiaire)}`),
  ));

  const dateInput = el("input", { type: "date", value: existing?.date_eval || isoDate(new Date()) });
  const metaInputs = {};
  const metaWrap = el("div", { class: "epcf-form-meta" },
    el("label", { class: "field" }, "Date", dateInput));
  trame.metaFields.forEach((f) => {
    const inp = el("input", { type: "text", value: existing?.meta?.[f.key] || "" });
    metaInputs[f.key] = inp;
    metaWrap.appendChild(el("label", { class: "field" }, f.label, inp));
  });
  const evalSel = el("select");
  profs.forEach((p) => {
    const o = el("option", { value: String(p.id) }, p.nom);
    const preset = existing?.evaluateur_prof_id ?? getProfile()?.prof_id;
    if (p.id === preset) o.selected = true;
    evalSel.appendChild(o);
  });
  metaWrap.appendChild(el("label", { class: "field" }, "Évaluateur", evalSel));
  body.appendChild(metaWrap);

  // Sections + chips A/R/NA (re-cliquer la note active la dé-sélectionne)
  trame.sections.forEach((sec) => {
    const box = el("div", { class: "epcf-form-section" },
      el("h4", {}, sec.titre,
        sec.competenceTP ? el("span", { class: "muted epcf-detail-tp" }, " — " + sec.competenceTP) : null));
    sec.criteres.forEach((c) => {
      const seg = el("div", { class: "epcf-seg" });
      ["A", "R", "NA"].forEach((note) => {
        const b = el("button", { type: "button", class: "epcf-seg-btn " + note }, NOTE_LABELS[note]);
        if (scores[c.code] === note) b.classList.add("active");
        b.addEventListener("click", () => {
          if (scores[c.code] === note) delete scores[c.code];
          else scores[c.code] = note;
          seg.querySelectorAll(".epcf-seg-btn").forEach((x) =>
            x.classList.toggle("active", x.textContent === NOTE_LABELS[scores[c.code]]));
        });
        seg.appendChild(b);
      });
      box.appendChild(el("div", { class: "epcf-form-row" }, el("span", { class: "epcf-form-lib" }, c.libelle), seg));
    });
    body.appendChild(box);
  });

  const compWrap = el("div", { class: "epcf-form-comps" }, el("h4", {}, "Compétences acquises"));
  trame.competences.forEach((code) => {
    const cb = el("input", { type: "checkbox" });
    cb.checked = compSel.has(code);
    cb.addEventListener("change", () => { cb.checked ? compSel.add(code) : compSel.delete(code); });
    compWrap.appendChild(el("label", { class: "epcf-comp-cb" }, cb, " " + code));
  });
  body.appendChild(compWrap);

  const commentTa = el("textarea", { rows: "4", class: "epcf-commentaire-ta", placeholder: "Commentaire global…" });
  commentTa.value = existing?.commentaire || "";
  body.appendChild(el("div", { class: "epcf-form-comment" }, el("h4", {}, "Commentaire global"), commentTa));

  const saveBtn = el("button", { class: "btn primary", onClick: async () => {
    if (Object.keys(scores).length === 0) { toast("Renseigne au moins un critère", "error"); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = "Enregistrement…";
    try {
      const meta = {};
      trame.metaFields.forEach((f) => { const v = metaInputs[f.key].value.trim(); if (v) meta[f.key] = v; });
      await upsertEpcf({
        id: existing?.id,
        stagiaire_id: stagiaire.id,
        trame: trameKey,
        trame_version: trame.version,
        date_eval: dateInput.value,
        evaluateur_prof_id: Number(evalSel.value) || null,
        meta,
        scores,
        competences_acquises: [...compSel].sort(),
        commentaire: commentTa.value.trim() || null,
        updated_by_who: getCurrentWho(),
      });
      toast("Évaluation enregistrée", "success", 2000);
      evals = await listEpcf();
      showListe(body);
    } catch (e) {
      console.error(e);
      toast(e.message, "error");
      saveBtn.disabled = false;
      saveBtn.textContent = prev;
    }
  } }, "Enregistrer l'évaluation");
  body.appendChild(el("div", { style: "margin:1rem 0 2rem" }, saveBtn));
}
```

(La fonction `showClasse` est ajoutée en Task 6 — pour que ce commit passe `node --check`, ajouter en bas du fichier un stub temporaire : `function showClasse(body) { showListe(body); }` qui sera remplacé.)

- [ ] **Step 2 : Vérifier** : `node --check js/views/epcf.js` → OK.

- [ ] **Step 3 : Commit** : `git add js/views/epcf.js && git commit -m "epcf: vue formateur — liste des stagiaires + formulaire de saisie"`

---

### Task 6 : Vue classe (moyennes) — dans `js/views/epcf.js`

**Files:**
- Modify: `js/views/epcf.js` (remplacer le stub `showClasse`)

- [ ] **Step 1 : Remplacer le stub** par l'implémentation (agrégation client — les profs lisent toutes les lignes, pas besoin du RPC ici) :

```js
// --- Vue classe : moyennes par critère et par phase (dernière éval formateur
// de chaque stagiaire, contexte EPCF) ---
function showClasse(body) {
  clear(body);
  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn ghost sm", onClick: () => showListe(body) }, "← Retour"),
    el("h3", {}, "Vue classe — moyennes"),
  ));

  TRAME_KEYS.forEach((trameKey) => {
    const trame = EPCF_TRAMES[trameKey];
    // dernière éval formateur par stagiaire (evals est déjà triée desc par listEpcf)
    const seen = new Set();
    const dernieres = evals.filter((e) => {
      if (e.trame !== trameKey || e.contexte !== "EPCF" || e.auto_eval) return false;
      if (seen.has(e.stagiaire_id)) return false;
      seen.add(e.stagiaire_id);
      return true;
    });
    const box = el("div", { class: "epcf-classe-trame" },
      el("h4", {}, `${trame.label} — ${dernieres.length} stagiaire(s) évalué(s)`));
    if (!dernieres.length) {
      box.appendChild(el("p", { class: "muted" }, "Aucune évaluation."));
      body.appendChild(box);
      return;
    }
    // moyennes par critère (même sémantique que le RPC epcf_moyennes)
    const NOTE_NUM = { A: 2, R: 1, NA: 0 };
    const moyennes = [];
    trame.sections.forEach((sec) => sec.criteres.forEach((c) => {
      const vals = dernieres.map((e) => NOTE_NUM[e.scores?.[c.code]]).filter((v) => v !== undefined);
      if (vals.length) moyennes.push({ critere: c.code, moyenne: vals.reduce((s, v) => s + v, 0) / vals.length, effectif: vals.length });
    }));
    const byCode = Object.fromEntries(moyennes.map((m) => [m.critere, m]));

    const table = el("table", { class: "epcf-table classe" });
    table.appendChild(el("thead", {}, el("tr", {},
      el("th", {}, "Critère"), el("th", {}, "Moyenne /2"), el("th", {}, "Évalués"))));
    const tbody = el("tbody");
    trame.sections.forEach((sec) => {
      const ps = phaseScoreFromMoyennes(sec, moyennes);
      tbody.appendChild(el("tr", { class: "epcf-classe-phase" },
        el("td", {}, el("strong", {}, sec.court)),
        el("td", {}, el("strong", {}, ps == null ? "—" : (ps * 2).toFixed(2))),
        el("td", {}, "")));
      sec.criteres.forEach((c) => {
        const m = byCode[c.code];
        const tier = !m ? "" : m.moyenne >= 1.5 ? "A" : m.moyenne >= 0.8 ? "R" : "NA";
        tbody.appendChild(el("tr", {},
          el("td", { class: "epcf-classe-lib" }, c.libelle),
          el("td", {}, el("span", { class: "epcf-chip " + (tier || "vide") }, m ? m.moyenne.toFixed(2) : "—")),
          el("td", { class: "muted" }, m ? String(m.effectif) : "")));
      });
    });
    table.appendChild(tbody);
    box.appendChild(table);
    body.appendChild(box);
  });
}
```

- [ ] **Step 2 : Vérifier** : `node --check js/views/epcf.js` → OK. Vérifier qu'il ne reste qu'UNE définition de `showClasse` (le stub est remplacé) : `grep -c "function showClasse" js/views/epcf.js` → 1.

- [ ] **Step 3 : Commit** : `git add js/views/epcf.js && git commit -m "epcf: vue classe — moyennes par phase et critère"`

---

### Task 7 : Câblage onglet + route — `js/main.js`, `js/icons.js`

**Files:**
- Modify: `js/icons.js` (objet `icon`)
- Modify: `js/main.js` (imports, `TABS`, `renderTabs`, `routes`, `bootApp`)

- [ ] **Step 1 : Ajouter l'icône** dans `js/icons.js` (dans l'objet `icon`, style Lucide clipboard-check) :

```js
  clipboard:  () => svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 13 2 2 4-4"/>'),
```

- [ ] **Step 2 : Câbler dans `js/main.js`** :
  - Ajouter à l'import existant de `./auth-admin.js` : `isAdmin, isProf` (garder ce qui y est déjà).
  - Ajouter l'import de la vue : `import { renderEpcf } from "./views/epcf.js?v=20260713b";` (token courant).
  - Dans `TABS`, insérer après l'entrée `mon-suivi` :
    ```js
    { route: "epcf", label: "EPCF", icon: "clipboard", visible: () => isAdmin() || isProf() },
    ```
  - Dans `renderTabs()`, remplacer `TABS.forEach((t) => {` par :
    ```js
    TABS.filter((t) => !t.visible || t.visible()).forEach((t) => {
    ```
  - Dans `routes`, ajouter : `epcf: renderEpcf,`.
  - Dans `bootApp()`, remplacer `onAdminChange(() => navigate());` par :
    ```js
    onAdminChange(() => { renderTabs(); navigate(); });
    ```
    (l'onglet EPCF apparaît/disparaît quand le rôle change — connexion, « Voir en tant que »).

- [ ] **Step 3 : Vérifier** : `node --check js/main.js && node --check js/icons.js` → OK.

- [ ] **Step 4 : Commit** : `git add js/main.js js/icons.js && git commit -m "epcf: onglet + route (visibles formateurs/admin uniquement)"`

---

### Task 8 : Mon suivi — retrait fiche souhaits, ajout « Mes EPCF »

**Files:**
- Modify: `js/views/mon-suivi.js`

- [ ] **Step 1 : Vérifier les consommateurs de `souhaits`** avant retrait :
  `grep -rn "souhaits\|listFiches\|upsertFiche" js/ --include=*.js`
  Attendu : uniquement `db.js` (définitions) et `mon-suivi.js`. Si une autre vue consomme, STOP et remonter au rapport.

- [ ] **Step 2 : Retirer la section fiche** dans `js/views/mon-suivi.js` :
  - Supprimer la fonction `renderFicheSection` en entier.
  - Supprimer la ligne `body.appendChild(renderFicheSection(id, () => renderFor(currentId)));` dans `renderFor`.
  - Supprimer `fiches`, `ficheOf` (variables/fonctions module) et `listFiches` du `Promise.all` de `renderMonSuivi` (garder `getVoitureAggregats` et `listProfs`).
  - Nettoyer les imports devenus inutiles : `listFiches`, `upsertFiche` (depuis db.js), `COMPETENCES_REMC` (depuis benevoles.js), `getCurrentWho` (depuis identity.js) et `toast` **si** plus utilisés — vérifier avec `grep -n "toast\|getCurrentWho" js/views/mon-suivi.js` avant de retirer.

- [ ] **Step 3 : Ajouter la section « Mes EPCF »** :
  - Imports : `listEpcf, getEpcfMoyennes` (ajout à l'import db.js existant) et
    `import { renderEpcfTrameSection } from "../epcf-restitution.js?v=20260713b";`
  - Charger les moyennes UNE fois par rendu de vue (elles ne dépendent pas de l'élève) — dans `renderMonSuivi`, ajouter au `Promise.all` existant :
    ```js
    const [aggregatsData, profsData, moySalle, moyVehicule] = await Promise.all([
      getVoitureAggregats(), listProfs(), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule"),
    ]);
    ```
    (stocker `moySalle`/`moyVehicule` dans des variables module comme `aggregats`/`profs`.)
  - Dans `renderFor`, ajouter `listEpcf({ stagiaire_id: id })` au `Promise.all` des données par élève :
    ```js
    const [items, evaluations, epcfEvals] = await Promise.all([
      loadUpcoming(id),
      listEvaluations({ stagiaire_id: id }),
      listEpcf({ stagiaire_id: id }),
    ]);
    ```
  - Après `renderPassagesSection`, insérer la section :
    ```js
    const epcfSection = el("section", { class: "ms-section" },
      el("h3", { class: "ms-section-title" }, "Mes EPCF"));
    epcfSection.appendChild(renderEpcfTrameSection("salle",
      epcfEvals.filter((e) => e.trame === "salle"), moySalle));
    epcfSection.appendChild(renderEpcfTrameSection("vehicule",
      epcfEvals.filter((e) => e.trame === "vehicule"), moyVehicule));
    body.appendChild(epcfSection);
    ```
    Ordre final des sections : passages → **Mes EPCF** → historique voiture → graphe d'évolution.

- [ ] **Step 4 : Vérifier** : `node --check js/views/mon-suivi.js` → OK. `grep -n "renderFicheSection\|listFiches\|COMPETENCES_REMC" js/views/mon-suivi.js` → aucune occurrence.

- [ ] **Step 5 : Commit** : `git add js/views/mon-suivi.js && git commit -m "mon-suivi: section Mes EPCF (radars + détail), retrait de la fiche souhaits"`

---

### Task 9 : Styles — `css/style.css`

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1 : Retirer les styles morts** de la fiche souhaits — supprimer les règles `.suivi-comps`, `.suivi-comp`, `.suivi-comp summary`, `.suivi-comp-main`, `.suivi-souscomp` **après** avoir vérifié qu'aucune autre vue ne les utilise : `grep -rn "suivi-comp\|suivi-souscomp" js/ index.html` → seul mon-suivi.js (déjà nettoyé) devait les utiliser. Garder `.suivi-histo` (historique voiture).

- [ ] **Step 2 : Ajouter les styles EPCF** (à la suite du bloc Mon suivi existant) :

```css
/* ===== EPCF ===== */
.epcf-table { width: 100%; border-collapse: collapse; }
.epcf-table th, .epcf-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--line); text-align: left; }
.epcf-cell { white-space: nowrap; }
.epcf-cell .btn { margin-left: 0.5rem; }
.epcf-statut { font-size: 0.82rem; margin-right: 0.4rem; }
.epcf-statut.ok { color: var(--c-go); }

.epcf-form-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.epcf-form-head h3 { margin: 0; }
.epcf-form-meta { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
.epcf-form-meta .field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
.epcf-form-meta input, .epcf-form-meta select { padding: 0.4rem 0.6rem; border: 1px solid var(--line); border-radius: var(--r-sm); font: inherit; background: var(--bg-elev); color: var(--text); }
.epcf-form-section { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0.7rem 0.9rem; margin-bottom: 0.8rem; }
.epcf-form-section h4 { margin: 0 0 0.6rem; font-size: 0.95rem; }
.epcf-form-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.3rem 0; border-top: 1px dashed var(--line); }
.epcf-form-row:first-of-type { border-top: none; }
.epcf-form-lib { flex: 1; font-size: 0.9rem; }
.epcf-seg { display: flex; gap: 0.25rem; flex-shrink: 0; }
.epcf-seg-btn { padding: 0.25rem 0.55rem; font-size: 0.78rem; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-elev); color: var(--text-muted); cursor: pointer; }
.epcf-seg-btn.active.A  { background: var(--c-go);  border-color: var(--c-go);  color: #fff; }
.epcf-seg-btn.active.R  { background: #C98A2B;      border-color: #C98A2B;      color: #fff; }
.epcf-seg-btn.active.NA { background: var(--c-stop); border-color: var(--c-stop); color: #fff; }
.epcf-form-comps { margin: 0.8rem 0; }
.epcf-comp-cb { margin-right: 1.2rem; }
.epcf-commentaire-ta { width: 100%; box-sizing: border-box; resize: vertical; padding: 0.5rem 0.7rem; border: 1px solid var(--line); border-radius: var(--r-sm); font: inherit; background: var(--bg-elev); color: var(--text); }

.epcf-radar-wrap { max-width: 420px; margin: 0 auto; }
.epcf-radar { width: 100%; height: auto; display: block; }
.epcf-radar-ring { fill: none; stroke: var(--line); }
.epcf-radar-spoke { stroke: var(--line); }
.epcf-radar-label { fill: var(--text-muted); font-size: 11px; }
.epcf-radar-serie.moi { fill: color-mix(in srgb, var(--accent) 25%, transparent); stroke: var(--accent); stroke-width: 2; }
.epcf-radar-serie.groupe { fill: none; stroke: var(--text-muted); stroke-width: 1.5; stroke-dasharray: 4 3; }
.epcf-legende { text-align: center; font-size: 0.82rem; }
.epcf-leg { display: inline-block; width: 14px; height: 3px; vertical-align: middle; margin-right: 4px; }
.epcf-leg.moi { background: var(--accent); }
.epcf-leg.groupe { background: var(--text-muted); }

.epcf-chip { display: inline-block; min-width: 5.5rem; text-align: center; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.epcf-chip.A  { background: color-mix(in srgb, var(--c-go) 18%, transparent);  color: var(--c-go); }
.epcf-chip.R  { background: color-mix(in srgb, #C98A2B 18%, transparent);      color: #C98A2B; }
.epcf-chip.NA { background: color-mix(in srgb, var(--c-stop) 18%, transparent); color: var(--c-stop); }
.epcf-chip.vide { background: var(--bg-subtle); color: var(--text-muted); }

.epcf-detail-section { margin-top: 0.9rem; }
.epcf-detail-title { margin: 0 0 0.4rem; font-size: 0.9rem; }
.epcf-detail-tp { font-weight: 400; font-size: 0.8rem; }
.epcf-detail-row { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.2rem 0; font-size: 0.88rem; }
.epcf-comps, .epcf-commentaire { margin-top: 0.8rem; font-size: 0.9rem; }
.epcf-resti { margin-bottom: 1.6rem; }
.epcf-resti-title { margin: 0 0 0.5rem; }
.epcf-eval-select-wrap { margin-bottom: 0.6rem; }
.epcf-eval-meta { font-size: 0.82rem; }
.epcf-classe-trame { margin-bottom: 2rem; }
.epcf-classe-lib { font-size: 0.85rem; }
.epcf-classe-phase td { background: var(--bg-subtle); }
```

Note : si `--bg-subtle` n'existe pas dans `:root` (vérifier avec `grep -n "\-\-bg-subtle" css/style.css`), remplacer par la variable de fond atténué réellement définie (`.suivi-histo` en utilise une — reprendre la même). `color-mix` est supporté par les navigateurs cibles (app déjà moderne) ; à défaut remplacer par des couleurs fixes claires.

- [ ] **Step 3 : Commit** : `git add css/style.css && git commit -m "epcf: styles (table, formulaire, chips, radar, vue classe)"`

---

### Task 10 : Vérification finale + préparation merge

**Files:** aucun nouveau — vérification transversale.

- [ ] **Step 1 : Syntaxe globale** : `node --check` sur tous les js modifiés/créés (`epcf-trames.js`, `epcf-restitution.js`, `views/epcf.js`, `db.js`, `main.js`, `icons.js`, `views/mon-suivi.js`) → tous OK.

- [ ] **Step 2 : Graphe d'imports navigateur** : servir le worktree (`python -m http.server 8030` depuis la racine du worktree, ou entrée launch.json dédiée), puis dans la console du navigateur :
  ```js
  ["/js/main.js","/js/views/epcf.js","/js/epcf-restitution.js","/js/epcf-trames.js","/js/views/mon-suivi.js"]
    .forEach(p => import(p + "?v=verif").then(() => console.log("OK", p), e => console.error("FAIL", p, e)));
  ```
  Attendu : 5 × OK, 0 erreur.

- [ ] **Step 3 : Vérification SQL** (via MCP, read-only) : insérer une éval de test sur le stagiaire 15 (fondateur), appeler `epcf_moyennes('salle')`, vérifier le calcul à la main, puis supprimer la ligne de test.

- [ ] **Step 4 : Smoke test visuel** : sur le serveur local, se connecter (compte fondateur), ouvrir l'onglet EPCF, créer une éval de test complète (salle), vérifier : liste → statut « évalué », Mon suivi (sélecteur sur le stagiaire évalué) → radar affiché avec les bonnes proportions, détail cohérent, vue classe → moyennes. Supprimer l'éval de test ensuite (SQL) ou la conserver si l'utilisateur préfère amorcer.

- [ ] **Step 5 : Test RLS (à déléguer à l'utilisateur si pas de compte stagiaire dispo)** : avec un compte stagiaire réel, vérifier que l'onglet EPCF est absent, que `#/epcf` affiche le message réservé, que Mon suivi ne montre que ses propres évals. **Rappel : « Voir en tant que » ne teste PAS la RLS.**

- [ ] **Step 6 : Merge** : depuis le dossier principal, `git merge lot1-epcf` dans `main` (fast-forward attendu si main n'a pas bougé ; sinon résoudre les conflits token-only en re-stampant : `node scripts/cache-bust.js`). NE PAS pousser sans accord de l'utilisateur (main = déploiement live GitHub Pages).

---

## Self-review (fait à l'écriture du plan)

- **Couverture spec** : §2 trames → Task 2 ; §3 modèle → Task 1/3 ; §4 RLS+RPC → Task 1 ; §5 onglet EPCF (liste/formulaire/classe) → Tasks 5-7 ; §5 Mon suivi (Mes EPCF + retrait fiche) → Task 8 ; §6 db.js → Task 3 ; §7 cas limites (éval vide refusée Task 5, groupe < 2 masqué Task 4, phase vide → 0 documenté Task 4) ; §8 vérification → Task 10.
- **Types cohérents** : `stagiaire_id`/`prof_id` = integer (vérifié en base) ; `scores` clés = codes critères des trames ; `phaseScoreFromMoyennes` consomme le format du RPC ET de l'agrégation client (Task 6 produit le même shape `{critere, moyenne, effectif}`).
- **Écart signalé** : `deleteEpcf` ajouté en Task 3 (utile aux tests/corrections formateur) mais aucun bouton de suppression en UI au lot 1 — assumé.
