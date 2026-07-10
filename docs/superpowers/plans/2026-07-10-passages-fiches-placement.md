# Passages enrichis, fiches de suivi & placement v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Injecter l'historique voiture validé dans la table `passages` (avec formateur + présence d'élève), ajouter un bouton admin « Vider les placements », créer l'onglet « Mon suivi » (fiche souhaits/besoins par stagiaire) et brancher « Placer la semaine » sur l'équité historique.

**Architecture:** App vanilla JS (modules ES, pas de bundler) + Supabase. Deux fichiers SQL appliqués à la main dans le SQL Editor Supabase (le projet n'est pas accessible via MCP). Côté JS : helpers dans `js/db.js`, nouvelle vue `js/views/suivi.js`, modifications ciblées de `js/views/planning.js` et `js/main.js`.

**Tech Stack:** Vanilla JS, Supabase (Postgres + RLS), CSS maison.

**Spec:** `docs/superpowers/specs/2026-07-10-passages-fiches-suivi-placement-design.md`

**Contraintes d'exécution :**
- Travailler dans un **worktree** sur la branche `lot3-suivi-placement` (le dossier `TP_ECSR_App` est partagé entre sessions — ne jamais faire de checkout dedans). Skill : superpowers:using-git-worktrees.
- Commits fréquents sur la branche. **Jamais de push, jamais de merge dans main** sans accord explicite de l'utilisateur.
- Pas de framework de test dans ce repo (pas de package.json) : la vérification est manuelle (serveur `dev.ps1` + Browser) + requêtes SQL de contrôle. Chaque tâche liste ses vérifications exactes.
- Cache-bust : les imports portent `?v=YYYYMMDDx`. Le hook pre-commit re-versionne automatiquement — utiliser le suffixe courant des fichiers modifiés, ne pas s'en préoccuper davantage.
- Les tables/fonctions Supabase référencées (`is_admin()`, `user_profiles.email/stagiaire_id`, `profs.nom`, `stagiaires.prenom/nom`) existent déjà ; si un nom ne résout pas à l'application du SQL, STOP et remonter à l'utilisateur.

---

### Task 1: Fichier SQL de migration (DDL passages + fiches_suivi)

**Files:**
- Create: `C:\Users\watch\Dev\ECSR\migration_supabase\2026-07-10_passages_prof_fiches.sql`

- [ ] **Step 1: Écrire le fichier SQL**

```sql
-- Migration 2026-07-10 — chantier « suivi voiture »
-- 1) passages : formateur + présence d'élève bénévole
-- 2) fiches_suivi : souhaits de compétences (permis B) + besoins par stagiaire
-- À appliquer dans le SQL Editor Supabase (projet crpduennbqaemhfaywrz).

BEGIN;

-- ---------- 1. passages ----------
ALTER TABLE passages
  ADD COLUMN IF NOT EXISTS prof_id    bigint REFERENCES profs(id),
  ADD COLUMN IF NOT EXISTS avec_eleve boolean;   -- null = information inconnue

COMMENT ON COLUMN passages.prof_id    IS 'Formateur du créneau (null = inconnu / historique)';
COMMENT ON COLUMN passages.avec_eleve IS 'true = séance avec élève bénévole ; null = inconnu';

-- ---------- 2. fiches_suivi ----------
CREATE TABLE IF NOT EXISTS fiches_suivi (
  stagiaire_id   bigint PRIMARY KEY REFERENCES stagiaires(id) ON DELETE CASCADE,
  souhaits       jsonb  NOT NULL DEFAULT '[]',   -- codes compétences permis B : ["C2","C1.5",...]
  besoins        text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by_who text
);

ALTER TABLE fiches_suivi ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié (cohérent avec le reste de l'app)
CREATE POLICY fiches_suivi_select ON fiches_suivi
  FOR SELECT TO authenticated USING (true);

-- Écriture : admin, ou le stagiaire lié au compte (user_profiles est keyé par email)
CREATE POLICY fiches_suivi_insert ON fiches_suivi
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() OR stagiaire_id = (
      SELECT up.stagiaire_id FROM user_profiles up
      WHERE up.email = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY fiches_suivi_update ON fiches_suivi
  FOR UPDATE TO authenticated
  USING (
    is_admin() OR stagiaire_id = (
      SELECT up.stagiaire_id FROM user_profiles up
      WHERE up.email = lower(auth.jwt()->>'email')
    )
  )
  WITH CHECK (
    is_admin() OR stagiaire_id = (
      SELECT up.stagiaire_id FROM user_profiles up
      WHERE up.email = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY fiches_suivi_delete ON fiches_suivi
  FOR DELETE TO authenticated USING (is_admin());

COMMIT;
```

- [ ] **Step 2: Demander à l'utilisateur d'appliquer le SQL** (checkpoint bloquant — pas d'accès MCP à ce projet Supabase). Lui donner la requête de vérification :

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'passages' AND column_name IN ('prof_id','avec_eleve');
-- attendu : 2 lignes
SELECT count(*) FROM fiches_suivi;  -- attendu : 0
```

- [ ] **Step 3: Commit**

```bash
git add ../migration_supabase/2026-07-10_passages_prof_fiches.sql
git commit -m "sql: migration passages (prof_id, avec_eleve) + table fiches_suivi"
```
(Si le repo ECSR racine et l'app sont deux repos distincts, committer chacun chez soi — vérifier avec `git -C .. rev-parse --git-dir` avant.)

---

### Task 2: Fichier SQL d'import de l'historique validé

**Files:**
- Create: `C:\Users\watch\Dev\ECSR\migration_supabase\2026-07-10_import_passages_voiture.sql`

Données : chiffres validés du 10/07/2026 (spec §1.2). Forfait avant stage = 3 passages
datés 30/03, 31/03, 01/04/2026. Post-stage réparti sur les jours ouvrés du 09/06 au 03/07.
`avec_eleve = true` sur les DERNIÈRES lignes de chaque stagiaire (ordre chronologique).

- [ ] **Step 1: Écrire le fichier SQL**

```sql
-- Import « formulaire pédagogie voiture 07/2026 » — chiffres validés le 10/07/2026.
-- Idempotent : supprime puis réinsère tout ce qui porte cette origine.
-- Source : ECSR/suivi/pedagogie_voiture_2026-07.md
BEGIN;

-- Garde-fou : lister les passages Voiture PRÉEXISTANTS sur la période (hors import).
-- Si cette requête renvoie des lignes inattendues : ROLLBACK et décision utilisateur.
SELECT p.id, p.date, s.prenom, p.origine, p.resultat
FROM passages p JOIN stagiaires s ON s.id = p.stagiaire_id
WHERE p.type = 'Voiture'
  AND p.date BETWEEN '2026-03-30' AND '2026-07-05'
  AND p.origine IS DISTINCT FROM 'Import formulaire 07/2026'
ORDER BY p.date;

-- Vérification des correspondances : chaque prénom et chaque formateur doit résoudre
-- à EXACTEMENT une ligne, sinon on avorte tout.
DO $$
DECLARE
  pn text; n int;
BEGIN
  FOREACH pn IN ARRAY ARRAY['lorie','timy','gaëlle','audrick-allan','julie','emilie','gael','cassandre','valentin','mickael','anissa','rita','celine'] LOOP
    SELECT count(*) INTO n FROM stagiaires WHERE lower(unaccent(prenom)) = lower(unaccent(pn));
    IF n <> 1 THEN RAISE EXCEPTION 'Stagiaire « % » : % correspondance(s) au lieu de 1', pn, n; END IF;
  END LOOP;
  FOREACH pn IN ARRAY ARRAY['romain','raphael','hocine'] LOOP
    SELECT count(*) INTO n FROM profs WHERE lower(unaccent(nom)) LIKE lower(unaccent(pn)) || '%';
    IF n <> 1 THEN RAISE EXCEPTION 'Prof « % » : % correspondance(s) au lieu de 1', pn, n; END IF;
  END LOOP;
END $$;
-- NOTE : si l'extension unaccent n'est pas active : CREATE EXTENSION IF NOT EXISTS unaccent;
-- NOTE : adapter les prénoms ci-dessus s'ils diffèrent dans la table stagiaires
-- (contrôler avec SELECT id, prenom, nom FROM stagiaires ORDER BY prenom;)

DELETE FROM passages WHERE origine = 'Import formulaire 07/2026';

WITH prof_ids AS (
  SELECT
    (SELECT id FROM profs WHERE lower(unaccent(nom)) LIKE 'romain%')  AS romain,
    (SELECT id FROM profs WHERE lower(unaccent(nom)) LIKE 'raphael%') AS raphael,
    (SELECT id FROM profs WHERE lower(unaccent(nom)) LIKE 'hocine%')  AS hocine
),
-- Une ligne par stagiaire : dates post-stage (étalées), profs alignés (R=Romain,
-- A=Raphaël, H=Hocine), avec_eleve aligné. Longueurs identiques par ligne.
donnees(prenom_key, dates, profs, avec) AS (VALUES
  ('lorie',         ARRAY['2026-06-09','2026-06-15','2026-06-22','2026-06-29','2026-07-03'], ARRAY['R','R','R','R','H'], ARRAY[false,false,false,true,true]),
  ('timy',          ARRAY['2026-06-09','2026-06-17','2026-06-25','2026-07-03'],              ARRAY['R','R','R','H'],     ARRAY[false,true,true,true]),
  ('gaëlle',        ARRAY['2026-06-09','2026-06-17','2026-06-25','2026-07-03'],              ARRAY['R','R','R','A'],     ARRAY[false,false,true,true]),
  ('audrick-allan', ARRAY['2026-06-09','2026-06-15','2026-06-22','2026-06-29','2026-07-03'], ARRAY['R','R','R','R','R'], ARRAY[false,true,true,true,true]),
  ('julie',         ARRAY['2026-06-09','2026-06-15','2026-06-22','2026-06-29','2026-07-03'], ARRAY['R','R','R','R','A'], ARRAY[false,false,true,true,true]),
  ('emilie',        ARRAY['2026-06-09','2026-06-22','2026-07-03'],                           ARRAY['R','R','A'],         ARRAY[false,true,true]),
  ('gael',          ARRAY['2026-06-09','2026-06-22','2026-07-03'],                           ARRAY['R','R','R'],         ARRAY[false,true,true]),
  ('cassandre',     ARRAY['2026-06-09','2026-06-15','2026-06-22','2026-06-29','2026-07-03'], ARRAY['R','R','R','A','A'], ARRAY[false,false,true,true,true]),
  ('valentin',      ARRAY['2026-06-09','2026-06-22','2026-07-03'],                           ARRAY['R','R','R'],         ARRAY[false,true,true]),
  ('mickael',       ARRAY['2026-06-09','2026-06-22','2026-07-03'],                           ARRAY['R','R','A'],         ARRAY[false,true,true]),
  ('anissa',        ARRAY['2026-06-09','2026-06-17','2026-06-25','2026-07-03'],              ARRAY['R','R','R','A'],     ARRAY[false,false,false,true]),
  ('rita',          ARRAY['2026-06-09','2026-06-22','2026-07-03'],                           ARRAY['R','R','A'],         ARRAY[false,false,true]),
  ('celine',        ARRAY['2026-06-09','2026-06-17','2026-06-25','2026-07-03'],              ARRAY['R','R','R','A'],     ARRAY[false,false,true,true])
),
poststage AS (
  SELECT s.id AS stagiaire_id,
         u.date_txt::date AS date,
         CASE u.prof WHEN 'R' THEN (SELECT romain FROM prof_ids)
                     WHEN 'A' THEN (SELECT raphael FROM prof_ids)
                     WHEN 'H' THEN (SELECT hocine FROM prof_ids) END AS prof_id,
         u.avec AS avec_eleve
  FROM donnees d
  JOIN stagiaires s ON lower(unaccent(s.prenom)) = lower(unaccent(d.prenom_key))
  CROSS JOIN LATERAL unnest(d.dates, d.profs, d.avec) AS u(date_txt, prof, avec)
),
forfait AS (
  SELECT s.id AS stagiaire_id, f.date::date AS date, NULL::bigint AS prof_id, NULL::boolean AS avec_eleve
  FROM donnees d
  JOIN stagiaires s ON lower(unaccent(s.prenom)) = lower(unaccent(d.prenom_key))
  CROSS JOIN (VALUES ('2026-03-30'),('2026-03-31'),('2026-04-01')) AS f(date)
)
INSERT INTO passages (date, stagiaire_id, type, resultat, prof_id, avec_eleve, origine, commentaire, created_by_who, updated_by_who)
SELECT date, stagiaire_id, 'Voiture', 'Effectué', prof_id, avec_eleve,
       'Import formulaire 07/2026',
       CASE WHEN prof_id IS NULL THEN 'Forfait avant stage' ELSE NULL END,
       'Import doc suivi', 'Import doc suivi'
FROM (SELECT * FROM forfait UNION ALL SELECT * FROM poststage) x;

-- Seed des besoins dans fiches_suivi (texte du formulaire, souhaits laissés vides)
INSERT INTO fiches_suivi (stagiaire_id, besoins, updated_by_who)
SELECT s.id, b.besoins, 'Import doc suivi'
FROM (VALUES
  ('lorie',         'Auto-évaluation · démonstration · prendre plus d''assurance'),
  ('timy',          'Évaluation spécifique statique + dynamique (choix parcours, jalonnage) · organisation · questions d''auto-éval moins vagues · gestion du temps'),
  ('gaëlle',        'Conduite de droite avec des démonstrations — n''a pas réussi à faire les démos'),
  ('audrick-allan', 'Approfondir l''auto-évaluation'),
  ('julie',         'Cibler son cours pour l''adapter parfaitement au besoin précis de l''élève'),
  ('emilie',        'Difficultés sur les auto-évaluations et pour animer les cours'),
  ('gael',          'Faire et refaire (volume, répétition)'),
  ('cassandre',     'Travailler l''auto-évaluation'),
  ('valentin',      'Trouver un bon objectif de leçon sans trop en faire · connaissances des compétences et sous-compétences'),
  ('mickael',       'Être plus à l''aise · savoir animer'),
  ('anissa',        'Difficulté à jalonner'),
  ('rita',          'Organiser et creuser les questions de l''évaluation spécifique selon le niveau réel de l''élève'),
  ('celine',        'Organisation · formuler correctement l''objectif · bien noter ses cours')
) AS b(prenom_key, besoins)
JOIN stagiaires s ON lower(unaccent(s.prenom)) = lower(unaccent(b.prenom_key))
ON CONFLICT (stagiaire_id) DO UPDATE SET besoins = EXCLUDED.besoins;

-- ---------- Vérification (comparer au tableau de la spec §1.2) ----------
SELECT s.prenom,
       count(*)                                        AS total,       -- attendu : N + 3
       count(*) FILTER (WHERE p.avec_eleve)            AS avec_eleve,  -- attendu : colonne « Avec élève »
       count(*) FILTER (WHERE p.avec_eleve = false)    AS sans_eleve,
       count(*) FILTER (WHERE p.prof_id IS NULL)       AS forfait      -- attendu : 3 partout
FROM passages p JOIN stagiaires s ON s.id = p.stagiaire_id
WHERE p.origine = 'Import formulaire 07/2026'
GROUP BY s.prenom ORDER BY s.prenom;
-- Totaux globaux attendus : 90 lignes (39 forfait + 51 post-stage), avec_eleve = 29.

COMMIT;
```

- [ ] **Step 2: Checkpoint utilisateur** — lui demander de :
  1. Contrôler `SELECT id, prenom, nom FROM stagiaires ORDER BY prenom;` et ajuster les `prenom_key` si besoin (Rita et Audrick-allan sont les plus susceptibles de différer).
  2. Exécuter le script, examiner le résultat du garde-fou et de la vérification finale.
  3. Confirmer les totaux (90 lignes, 29 avec élève) avant de continuer.

- [ ] **Step 3: Vérifier dans l'app** — lancer le serveur (`preview_start` name depuis `.claude/launch.json`, ou `dev.ps1`), onglet Passages : les entrées « Import formulaire 07/2026 » apparaissent ; Dashboard : compteurs voiture cohérents (Lorie 8, Audrick 8, Anissa 7…).

- [ ] **Step 4: Commit**

```bash
git add ../migration_supabase/2026-07-10_import_passages_voiture.sql
git commit -m "sql: import historique voiture valide 10/07 + seed besoins fiches"
```

---

### Task 3: Helpers db.js (fiches + agrégats voiture)

**Files:**
- Modify: `js/db.js` (ajouter en fin de fichier, avant les exports éventuels de bas de page)

- [ ] **Step 1: Ajouter les fonctions**

```js
// === Fiches de suivi (souhaits compétences permis B + besoins) ===

export async function listFiches() {
  const { data, error } = await supabase.from("fiches_suivi").select("*");
  if (error) throw error;
  return data;
}

export async function upsertFiche({ stagiaire_id, souhaits, besoins, updated_by_who }) {
  const { error } = await supabase
    .from("fiches_suivi")
    .upsert(
      { stagiaire_id, souhaits, besoins, updated_by_who, updated_at: new Date().toISOString() },
      { onConflict: "stagiaire_id" }
    );
  if (error) throw error;
}

// Agrégats voiture par stagiaire pour le placement : nb de séances avec élève,
// répartition par formateur. Les absences/reports ne comptent pas comme exposition.
// avec_eleve NULL (historique inconnu) ne compte PAS comme « avec élève ».
export async function getVoitureAggregats() {
  const { data, error } = await supabase
    .from("passages")
    .select("stagiaire_id, prof_id, avec_eleve, resultat")
    .eq("type", "Voiture");
  if (error) throw error;
  const map = {};
  data.forEach((p) => {
    if (p.resultat === "Absence" || p.resultat === "Report") return;
    const m = map[p.stagiaire_id] || (map[p.stagiaire_id] = { total: 0, avecEleve: 0, byProf: {} });
    m.total++;
    if (p.avec_eleve === true) m.avecEleve++;
    if (p.prof_id != null) m.byProf[p.prof_id] = (m.byProf[p.prof_id] || 0) + 1;
  });
  return map;
}
```

- [ ] **Step 2: Vérifier** — recharger l'app (serveur lancé), console navigateur :
`(await import("./js/db.js?v=" + Date.now())).getVoitureAggregats()` doit renvoyer un objet
avec 13 clés et des `avecEleve` conformes au tableau (Lorie 2, Audrick 4, Anissa 1…).

- [ ] **Step 3: Commit**

```bash
git add js/db.js
git commit -m "db: fiches_suivi (list/upsert) + agregats voiture pour le placement"
```

---

### Task 4: Exporter le référentiel compétences depuis benevoles.js

**Files:**
- Modify: `js/views/benevoles.js:24` (const `COMPETENCES_REMC`) et `:72` (fonction `nivLabel`)

- [ ] **Step 1: Exporter les deux symboles existants** (aucun autre changement)

```js
export const COMPETENCES_REMC = [ /* … inchangé … */ ];
…
export function nivLabel(code) { /* … inchangé … */ }
```

Ne PAS renommer la constante (elle est utilisée en interne) ; dans l'UI de la nouvelle vue,
le libellé affiché sera « Compétences du permis B (C1–C4) » — jamais « REMC » (demande
explicite utilisateur : ne pas confondre avec les compétences REMC de l'enseignant).

- [ ] **Step 2: Vérifier** — recharger l'app, la vue Bénévoles fonctionne comme avant (niveaux affichés).

- [ ] **Step 3: Commit**

```bash
git add js/views/benevoles.js
git commit -m "benevoles: exporte le referentiel competences permis B + nivLabel"
```

---

### Task 5: Bouton « Vider les placements » (planning)

**Files:**
- Modify: `js/views/planning.js` — nouvelle fonction après `autoPlaceWeek()` (~ligne 777), bouton dans le bloc admin de la week bar (~ligne 2021).

- [ ] **Step 1: Ajouter la fonction**

```js
// === Vider les placements de la semaine (admin) ===
// Retire tableaux + élèves salle + élèves voiture de TOUTES les cartes de la semaine.
// Conserve : activités, profs, sujets, notes, bénévoles, horaires, jours off. Undo Ctrl+Z.
async function clearWeekPlacements() {
  await flushPendingInputs();
  const targets = entries.filter((e) =>
    e.pedagogue_id != null || e.pedagogue_id_2 != null ||
    (e.eleves_ids && e.eleves_ids.length) || (e.eleves_ids_2 && e.eleves_ids_2.length));
  if (targets.length === 0) {
    toast("Aucun stagiaire placé cette semaine", "info", 3000);
    return;
  }
  if (!confirm("⚠️ Retirer TOUS les stagiaires placés cette semaine (tableaux, salle, voiture) ?\n\nLes bénévoles, profs, sujets et notes sont conservés.")) return;

  const before = targets.map((e) => ({ e, snap: snapshotPlacement(e) }));
  targets.forEach((e) => { e.pedagogue_id = null; e.pedagogue_id_2 = null; e.eleves_ids = []; e.eleves_ids_2 = []; });
  try {
    await Promise.all(targets.map((e) => upsertPlanningEntry(entryUpsertPayload(e))));
    renderInto(currentContainer);
    toast("Placements vidés · Ctrl+Z pour annuler", "success", 3000);
    recordUndo("vidage des placements", async () => {
      before.forEach(({ e, snap }) => Object.assign(e, snap));
      await Promise.all(targets.map((e) => upsertPlanningEntry(entryUpsertPayload(e))));
      renderInto(currentContainer);
    });
  } catch (err) {
    console.error(err);
    before.forEach(({ e, snap }) => Object.assign(e, snap));
    renderInto(currentContainer);
    toast("Erreur lors du vidage", "error");
  }
}
```

- [ ] **Step 2: Ajouter le bouton** dans le bloc `if (admin)` qui contient « Placer la semaine » (juste après) :

```js
  if (admin) {
    const clearBtn = el("button", { class: "btn small danger",
      title: "Retirer tous les stagiaires placés cette semaine (bénévoles, profs, sujets et notes conservés)",
      onClick: () => clearWeekPlacements() });
    clearBtn.appendChild(document.createTextNode("🧹 Vider les placements"));
    weekBar.appendChild(clearBtn);
  }
```

- [ ] **Step 3: Vérifier au navigateur** — semaine de test : placer manuellement 2 stagiaires (salle + voiture) + 1 bénévole → cliquer Vider → confirmation → seuls les stagiaires disparaissent, bénévole/prof/sujet intacts → Ctrl+Z restaure. Vérifier aussi que le bouton n'apparaît pas hors admin (« Voir en tant que » stagiaire).

- [ ] **Step 4: Commit**

```bash
git add js/views/planning.js
git commit -m "planning: bouton admin Vider les placements (garde benevoles, undo Ctrl+Z)"
```

---

### Task 6: Validation hebdo enrichie (prof_id + avec_eleve)

**Files:**
- Modify: `js/views/planning.js` — construction des candidats (~ligne 1690), dédoublonnage (~ligne 1713), `addRow` de la modale (~ligne 1876).

- [ ] **Step 1: Enrichir les candidats** — dans la boucle qui pousse dans `raw` :

```js
    const profOf = (e) => (e.prof_ids && e.prof_ids.length ? e.prof_ids[0] : (e.prof_id ?? null));
    if (e.activite === "Pédagogie salle") {
      if (e.pedagogue_id && activeIds.has(e.pedagogue_id)) {
        raw.push({ stagiaire_id: e.pedagogue_id, type: "Salle", date: dateIso, day_index: e.day_index,
                   prof_id: profOf(e), avec_eleve: null });
      }
      if (e.salle_double && e.pedagogue_id_2 && activeIds.has(e.pedagogue_id_2)) {
        raw.push({ stagiaire_id: e.pedagogue_id_2, type: "Salle", date: dateIso, day_index: e.day_index,
                   prof_id: profOf(e), avec_eleve: null });
      }
    } else if (e.activite === "Voiture (conduite)") {
      const avecEleve = (e.benevoles_ids || []).length > 0;
      (e.eleves_ids || []).forEach((id) => {
        if (activeIds.has(id)) raw.push({ stagiaire_id: id, type: "Voiture", date: dateIso, day_index: e.day_index,
                                          prof_id: profOf(e), avec_eleve: avecEleve });
      });
    }
```

- [ ] **Step 2: Fusionner au dédoublonnage** (2 sessions le même jour = 1 passage, mais
`avec_eleve` en OR et premier `prof_id` non nul) — remplacer le bloc `seen` :

```js
  const seenMap = new Map();
  const candidates = [];
  raw.forEach((c) => {
    const k = c.stagiaire_id + "|" + c.type + "|" + c.date;
    const prev = seenMap.get(k);
    if (prev) {
      if (c.avec_eleve === true) prev.avec_eleve = true;
      if (prev.prof_id == null) prev.prof_id = c.prof_id;
      return;
    }
    seenMap.set(k, c);
    candidates.push(c);
  });
```

- [ ] **Step 3: Propager dans `addRow`** (modale de validation) — signature et row :

```js
    const addRow = (stagiaire_id, type, date, resultat, remplacant_id, prof_id = null, avec_eleve = null) => {
      const key = stagiaire_id + "|" + type + "|" + date;
      if (existKey.has(key) || batchKeys.has(key)) return;
      batchKeys.add(key);
      rows.push({
        date, stagiaire_id, type, resultat,
        remplacant_id: remplacant_id || null,
        prof_id, avec_eleve,
        origine: "Planning",
        semaine_lundi: semaineLundi,
        created_by_who: who,
        updated_by_who: who,
      });
    };

    toCreate.forEach((c, i) => {
      const st = rowState[i];
      if (!st.include) return;
      const rempl = st.resultat === "Absence" ? st.remplacant_id : null;
      addRow(c.stagiaire_id, c.type, c.date, st.resultat, rempl, c.prof_id, c.avec_eleve);
      if (rempl) addRow(rempl, c.type, c.date, "Effectué", null, c.prof_id, c.avec_eleve);
    });
```

- [ ] **Step 4: Vérifier** — semaine de test avec 1 créneau Voiture (prof + bénévole + 2 stagiaires) et 1 Pédagogie salle → « Valider la semaine » → en SQL :
`SELECT stagiaire_id, type, prof_id, avec_eleve FROM passages WHERE origine='Planning' ORDER BY id DESC LIMIT 5;`
→ Voiture : `prof_id` renseigné, `avec_eleve = true` ; Salle : `avec_eleve = null`. Puis Ctrl+Z (les lignes disparaissent) et supprimer la semaine de test.

- [ ] **Step 5: Commit**

```bash
git add js/views/planning.js
git commit -m "planning: la validation hebdo enregistre prof_id et avec_eleve"
```

---

### Task 7: Vue « Mon suivi » (fiches)

**Files:**
- Create: `js/views/suivi.js`
- Modify: `js/main.js` (TABS ~ligne 120, imports en tête, `routes` ~ligne 149)
- Modify: `css/style.css` (styles minimes en fin de fichier)

- [ ] **Step 1: Créer `js/views/suivi.js`** (adapter le suffixe `?v=` à celui des autres vues) :

```js
import { listStagiaires, listFiches, upsertFiche, getVoitureAggregats, listProfs } from "../db.js?v=20260710a";
import { el, clear, toast, displayStagiaire } from "../utils.js?v=20260710a";
import { isAdmin, getProfile } from "../auth-admin.js?v=20260710a";
import { getCurrentWho } from "../identity.js?v=20260710a";
import { COMPETENCES_REMC } from "./benevoles.js?v=20260710a";

let stagiaires = [];
let fiches = [];       // rows fiches_suivi
let aggregats = {};    // getVoitureAggregats()
let profs = [];

const ficheOf = (sid) => fiches.find((f) => f.stagiaire_id === sid) || { stagiaire_id: sid, souhaits: [], besoins: "" };

// --- Historique lecture seule (calculé depuis passages) ---
function renderHistorique(sid) {
  const a = aggregats[sid] || { total: 0, avecEleve: 0, byProf: {} };
  const profLine = Object.entries(a.byProf)
    .map(([pid, n]) => `${profs.find((p) => p.id === Number(pid))?.nom || "?"} ×${n}`)
    .join(" · ") || "—";
  return el("div", { class: "suivi-histo" },
    el("h4", {}, "Historique voiture"),
    el("p", {}, `${a.total} passage(s) · dont ${a.avecEleve} avec élève`),
    el("p", { class: "muted" }, "Formateurs : " + profLine),
  );
}

// --- Éditeur d'une fiche (souhaits + besoins) ---
function renderFicheEditor(sid, onSaved) {
  const fiche = ficheOf(sid);
  const selected = new Set(fiche.souhaits || []);

  const comps = el("div", { class: "suivi-comps" });
  COMPETENCES_REMC.forEach((c) => {
    const det = el("details", { class: "suivi-comp" });
    const mainCb = el("input", { type: "checkbox" });
    mainCb.checked = selected.has(c.code);
    mainCb.addEventListener("change", () => { mainCb.checked ? selected.add(c.code) : selected.delete(c.code); });
    const summary = el("summary", {}, el("label", { class: "suivi-comp-main" }, mainCb, ` ${c.code} · ${c.titre}`));
    // le clic sur la checkbox ne doit pas replier l'accordéon
    mainCb.addEventListener("click", (ev) => ev.stopPropagation());
    det.appendChild(summary);
    c.sous.forEach(([code, libelle]) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = selected.has(code);
      cb.addEventListener("change", () => { cb.checked ? selected.add(code) : selected.delete(code); });
      det.appendChild(el("label", { class: "suivi-souscomp" }, cb, ` ${code} · ${libelle}`));
    });
    comps.appendChild(det);
  });

  const besoinsTa = el("textarea", { rows: "4", placeholder: "Mes besoins du moment (texte libre)…" });
  besoinsTa.value = fiche.besoins || "";

  const saveBtn = el("button", { class: "btn primary", onClick: async () => {
    try {
      await upsertFiche({
        stagiaire_id: sid,
        souhaits: [...selected].sort(),
        besoins: besoinsTa.value.trim() || null,
        updated_by_who: getCurrentWho(),
      });
      toast("Fiche enregistrée", "success", 2000);
      fiches = await listFiches();
      if (onSaved) onSaved();
    } catch (e) { console.error(e); toast(e.message, "error"); }
  } }, "Enregistrer ma fiche");

  return el("div", { class: "suivi-editor" },
    el("h4", {}, "Compétences du permis B (C1–C4) que je veux travailler"),
    comps,
    el("h4", {}, "Mes besoins"),
    besoinsTa,
    el("div", { style: "margin-top:0.75rem" }, saveBtn),
  );
}

// --- Vue admin : liste des fiches ---
function renderAdminList(container) {
  const wrap = el("div", { class: "suivi-admin-list" });
  stagiaires.forEach((s) => {
    const fiche = ficheOf(s.id);
    const a = aggregats[s.id] || { total: 0, avecEleve: 0, byProf: {} };
    const tags = (fiche.souhaits || []).map((code) => el("span", { class: "tag" }, code));
    const card = el("div", { class: "suivi-card" },
      el("div", { class: "suivi-card-head" },
        el("strong", {}, displayStagiaire(s)),
        el("span", { class: "muted" }, `${a.total} passages · ${a.avecEleve} avec élève`),
      ),
      el("div", { class: "suivi-card-tags" }, ...(tags.length ? tags : [el("span", { class: "faint" }, "aucun souhait coché")])),
      el("p", { class: "suivi-card-besoins" }, fiche.besoins || "—"),
    );
    card.addEventListener("click", () => openAdminEdit(container, s));
    wrap.appendChild(card);
  });
  return wrap;
}

function openAdminEdit(container, s) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const modal = el("div", { class: "modal", style: "max-width:640px" },
    el("h3", {}, "Fiche de " + displayStagiaire(s)),
    renderHistorique(s.id),
    renderFicheEditor(s.id, () => { backdrop.remove(); rerender(container); }),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer")),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function rerender(container) {
  clear(container);
  const admin = isAdmin();
  const myStagiaireId = getProfile()?.stagiaire_id ?? null;

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Pédagogie voiture"),
      el("h2", {}, admin && myStagiaireId == null ? "Fiches de suivi" : "Mon suivi"),
      el("p", { class: "subtitle" }, "Souhaits de compétences (permis B) et besoins — utilisés pour l'attribution des places voiture."),
    ),
  ));

  if (myStagiaireId != null) {
    container.appendChild(renderHistorique(myStagiaireId));
    container.appendChild(renderFicheEditor(myStagiaireId, () => rerender(container)));
    return;
  }
  if (admin) { container.appendChild(renderAdminList(container)); return; }
  container.appendChild(el("p", { class: "muted" },
    "Ton compte n'est pas relié à une fiche stagiaire. Demande à un admin de faire le lien."));
}

export async function renderSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  [stagiaires, fiches, aggregats, profs] = await Promise.all([
    listStagiaires(), listFiches(), getVoitureAggregats(), listProfs(),
  ]);
  rerender(container);
}
```

- [ ] **Step 2: Enregistrer la route** dans `js/main.js` :

```js
import { renderSuivi } from "./views/suivi.js?v=20260710a";   // avec les autres imports de vues
…
  { route: "suivi",      label: "Mon suivi",       icon: "edu"       },   // dans TABS, après "notes"
…
  suivi:      renderSuivi,    // dans l'objet routes
```

- [ ] **Step 3: Styles** en fin de `css/style.css` (réutilise les patterns existants) :

```css
/* === Vue Mon suivi === */
.suivi-histo { background: var(--surface-2, rgba(127,127,127,0.08)); border-radius: 10px; padding: 0.9rem 1.1rem; margin-bottom: 1.1rem; }
.suivi-histo h4, .suivi-editor h4 { margin: 0 0 0.4rem; }
.suivi-comp { border: 1px solid var(--border, rgba(127,127,127,0.25)); border-radius: 8px; padding: 0.45rem 0.7rem; margin-bottom: 0.5rem; }
.suivi-comp summary { cursor: pointer; }
.suivi-souscomp { display: block; padding: 0.25rem 0 0.25rem 1.6rem; }
.suivi-editor textarea { width: 100%; box-sizing: border-box; }
.suivi-admin-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.8rem; }
.suivi-card { border: 1px solid var(--border, rgba(127,127,127,0.25)); border-radius: 10px; padding: 0.8rem 1rem; cursor: pointer; }
.suivi-card:hover { border-color: var(--accent, #4a9); }
.suivi-card-head { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem; }
.suivi-card-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.4rem; }
.suivi-card-besoins { margin: 0; font-size: 0.88rem; color: var(--text-muted, #888); }
```
(Vérifier les noms de variables CSS réellement utilisés dans `style.css` — `grep -n "^:root" -A 30 css/style.css` — et ajuster.)

- [ ] **Step 4: Vérifier au navigateur** —
  - Compte admin : onglet « Mon suivi » → liste des 13 cartes, besoins seedés visibles (Gaëlle : démos) ; clic → édition, cocher C2 → Enregistrer → tag visible.
  - « Voir en tant que » un compte stagiaire (ou compte réel) : sa fiche seule, historique correct, sauvegarde OK.
  - Console : aucune erreur RLS.

- [ ] **Step 5: Commit**

```bash
git add js/views/suivi.js js/main.js css/style.css
git commit -m "suivi: onglet Mon suivi (souhaits competences permis B + besoins + historique)"
```

---

### Task 8: « Placer la semaine » v2 (scoring voiture)

**Files:**
- Modify: `js/views/planning.js` — imports (tête de fichier), chargement (`renderPlanning`/loader), `randomFillVoitureEleves` (~ligne 635), `autoPlaceWeek` (~ligne 686).

- [ ] **Step 1: Charger les nouvelles données** — ajouter aux imports db :
`getVoitureAggregats, listFiches` ; deux variables module `let voitureStats = {}; let fichesSuivi = [];`
et dans le chargement initial de la vue planning (là où stagiaires/profs/benevoles sont chargés),
ajouter (résilient si migration absente, pattern `getJoursOff`) :

```js
  try {
    [voitureStats, fichesSuivi] = await Promise.all([getVoitureAggregats(), listFiches()]);
  } catch (e) {
    console.warn("stats voiture / fiches indisponibles (migration manquante ?)", e?.message || e);
    voitureStats = {}; fichesSuivi = [];
  }
```

- [ ] **Step 2: Fonction de score** (après `slotOccupants`) :

```js
// === Score de priorité voiture (v2) ===
// Ordre lexicographique croissant :
//  [0] séances avec élève (historique passages avec_eleve=true + placements de la semaine
//      sur des créneaux avec bénévoles) — le critère principal (équité d'exposition) ;
//  [1] match souhaits × niveau des bénévoles du créneau (0 = matche, 1 = neutre) ;
//  [2] passages déjà faits avec le prof du créneau (variété formateur) ;
//  [3] total placements voiture de la semaine (équilibre intra-semaine).
// Le shuffle préalable conserve l'aléa entre ex æquo.
function matchesSouhait(souhait, niveau) {
  return niveau === souhait || niveau.startsWith(souhait + ".") || souhait.startsWith(niveau + ".");
}
function voitureScore(stagiaireId, entry, weekAvecEleve, weekVoit) {
  const agg = voitureStats[stagiaireId] || { avecEleve: 0, byProf: {} };
  const avecEleve = agg.avecEleve + (weekAvecEleve[stagiaireId] || 0);

  let match = 1;
  const niveaux = (entry.benevoles_ids || [])
    .map((id) => benevoles.find((b) => b.id === id)?.niveau)
    .filter(Boolean);
  if (niveaux.length) {
    const souhaits = fichesSuivi.find((f) => f.stagiaire_id === stagiaireId)?.souhaits || [];
    if (souhaits.some((w) => niveaux.some((n) => matchesSouhait(w, n)))) match = 0;
  }

  const profId = entry.prof_ids && entry.prof_ids.length ? entry.prof_ids[0] : (entry.prof_id ?? null);
  const profCount = profId != null ? (agg.byProf[profId] || 0) : 0;

  return [avecEleve, match, profCount, weekVoit[stagiaireId] || 0];
}
function cmpScores(a, b) {
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] - b[i]; }
  return 0;
}
```

- [ ] **Step 3: Brancher `autoPlaceWeek`** — dans la branche Voiture, remplacer le
`pickLeast(voit, …)` par le score. Le compteur `voit` existant est conservé (critère [3]) ;
ajouter un compteur `voitAvecEleve` alimenté seulement quand le créneau a des bénévoles :

```js
  const tab = {}, salleEl = {}, voit = {}, voitAvecEleve = {};
  …
  // amorçage non-reroll : dans la branche else des targets voiture existants :
      } else {
        (e.eleves_ids || []).forEach((id) => {
          bump(voit, id);
          if ((e.benevoles_ids || []).length) bump(voitAvecEleve, id);
        });
      }
  …
  // et dans la boucle de placement, branche Voiture :
    } else if (!(e.eleves_ids && e.eleves_ids.length)) {  // Voiture, élèves vides => 2
      const blocked = slotOccupants(e, "eleves");
      const pick = shuffle(stagiaires.filter((s) => !blocked.has(s.id)))
        .map((s) => ({ id: s.id, score: voitureScore(s.id, e, voitAvecEleve, voit) }))
        .sort((a, b) => cmpScores(a.score, b.score))
        .slice(0, 2).map((x) => x.id);
      e.eleves_ids = pick;
      pick.forEach((id) => {
        bump(voit, id);
        if ((e.benevoles_ids || []).length) bump(voitAvecEleve, id);
      });
      unfilled += 2 - pick.length;
    }
```

- [ ] **Step 4: Brancher le tirage manuel** `randomFillVoitureEleves` — même mécanique :

```js
async function randomFillVoitureEleves(lid, count) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;

  // Compteurs de la semaine en cours (mêmes définitions que autoPlaceWeek)
  const voit = {}, voitAvecEleve = {};
  entries.forEach((e) => {
    if (e.activite !== "Voiture (conduite)" || e._lid === lid) return;
    (e.eleves_ids || []).forEach((id) => {
      voit[id] = (voit[id] || 0) + 1;
      if ((e.benevoles_ids || []).length) voitAvecEleve[id] = (voitAvecEleve[id] || 0) + 1;
    });
  });

  const blocked = slotOccupants(entry, "eleves");
  const eligible = stagiaires.filter((s) => !blocked.has(s.id));
  if (eligible.length === 0) {
    toast("Aucun stagiaire disponible sur ce créneau", "info", 3000);
    return;
  }
  const picked = shuffle(eligible)
    .map((s) => ({ id: s.id, score: voitureScore(s.id, entry, voitAvecEleve, voit) }))
    .sort((a, b) => cmpScores(a.score, b.score))
    .slice(0, count).map((x) => x.id);

  toast(`${picked.length} élève(s) en voiture tiré(s) · priorité aux moins exposés`, "success", 1600);
  await saveEntry(lid, { eleves_ids: picked });
  renderInto(currentContainer);
}
```

- [ ] **Step 5: Vérifier au navigateur** — semaine de test :
  1. Créneau Voiture avec bénévole niveau C2 + prof Romain → « Placer la semaine » →
     les stagiaires tirés doivent être parmi les moins exposés (Anissa 1, Rita 1 attendus
     en tête après import) ; si une fiche coche C2, ce stagiaire passe devant à exposition égale.
  2. Créneau sans bénévole → placement fonctionne (critère match neutre).
  3. Simuler migration absente (renommer temporairement l'appel getVoitureAggregats →
     inutile : vérifier plutôt que le catch loggue et que le placement fonctionne avec stats vides).
  4. Ctrl+Z restaure.
  Nettoyer la semaine de test (bouton « Vider les placements » 😉).

- [ ] **Step 6: Commit**

```bash
git add js/views/planning.js
git commit -m "planning: placement v2 (equite exposition eleves, match souhaits, variete formateur)"
```

---

### Task 9: Passage en revue final

- [ ] **Step 1: Relecture du diff complet** — `git diff main...lot3-suivi-placement --stat` puis lecture du diff ; vérifier qu'aucun fichier hors périmètre n'est touché.
- [ ] **Step 2: Scénario bout-en-bout au navigateur** (compte admin) :
  planning semaine du 06/07 réel → « Valider la semaine » (test utilisateur du circuit
  prof_id/avec_eleve) → onglet Passages (lignes enrichies) → « Mon suivi » (compteurs à jour)
  → « Placer la semaine » sur la semaine suivante → cohérence des tirages avec le doc de suivi.
- [ ] **Step 3: Screenshot des 3 nouveautés** (bouton vider, onglet suivi, tirage) pour l'utilisateur.
- [ ] **Step 4: Demander à l'utilisateur** : merge dans main + push (le déploiement = GitHub Pages sur main), ou itérations d'abord. **Ne pas pousser sans son accord.**
