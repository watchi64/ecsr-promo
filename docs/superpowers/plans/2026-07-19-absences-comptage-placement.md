# Absences, comptage & placement par type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une absence de dernière minute consomme le passage (résultat `Absence` compté), le remplaçant fait un passage `Bonus` non compté, le tout saisi sur la carte planning ; le placement auto vise 1 passage Salle ET 1 Voiture par stagiaire et par semaine (cascade).

**Architecture:** App vanilla JS sans build (ES modules servis statiquement, imports avec jeton cache-bust `?v=20260719p`). Un nouveau module pur `js/passage-rules.js` porte les règles de comptage (testable node). La colonne JSONB `planning_entries.absences` porte le marquage `[{sid, rid}]` ; la personne prévue **reste** dans son champ de rôle. Spec : `docs/specs/2026-07-19-absences-comptage-placement-design.md`.

**Tech Stack:** Vanilla JS ES modules, Supabase (PostgREST + supabase-js v2 via esm.sh), GitHub Pages, tests node natifs (`assert`), banc navigateur fetch-stub.

## Global Constraints

- Travailler UNIQUEMENT dans le worktree `C:\Users\watch\Dev\ECSR\TP_ECSR_App_absences` (branche `absences-comptage`). Ne jamais éditer `C:\Users\watch\Dev\ECSR\TP_ECSR_App` (main, réservé au déploiement, Task 8).
- Tout nouvel import JS reprend EXACTEMENT le jeton de version des imports existants du fichier éditeur : `?v=20260719p`.
- Textes UI en français. Vocabulaire salle : toujours « stagiaire », jamais « élève ».
- `node --check` sur chaque fichier JS modifié avant commit. ⚠️ `node --check` est aveugle aux doublons de déclaration → vérification navigateur obligatoire au banc avant tout commit UI.
- Ne JAMAIS piper/tronquer la sortie de `node scripts/cache-bust.js` (incident EPIPE 2026-07-19 : fichier vidé). Ce script ne se lance de toute façon que sur main (Task 8).
- Banc d'essai : jamais contre la PROD. Toujours charger `_harness.html?fresh=<aléatoire>` (cache navigateur agressif). Bandeau orange « BANC D'ESSAI · DONNÉES FICTIVES » obligatoire. Les captures d'écran time-out sur cette app → vérifier via `read_page` / `javascript_tool`.
- Projet Supabase : `crpduennbqaemhfaywrz`. La migration PROD ne s'applique qu'en Task 8 (via MCP `apply_migration`).
- `git push` : uniquement sur demande explicite de l'utilisateur (Task 8, checkpoint).
- Messages de commit multilignes : `git commit -F <fichier>` (here-string PowerShell peu fiable).

---

### Task 1: Lot 1 — module `passage-rules.js` + inversion du comptage (db.js)

**Files:**
- Create: `js/passage-rules.js`
- Create: `tests/passage-rules.test.mjs`
- Modify: `js/db.js:1041-1076` (les deux agrégats) + bloc d'imports en tête (`js/db.js:1-2`)

**Interfaces:**
- Consumes: rien (module pur, zéro dépendance).
- Produces: `compteDansEquite(resultat: string): boolean` ; `RESULTAT_RANG: {[resultat]: number}` ; `meilleurResultat(a: string, b: string): string`. Utilisés par db.js (cette task) et planning.js (Task 5).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/passage-rules.test.mjs` :

```js
import assert from "node:assert/strict";
import { compteDansEquite, meilleurResultat, RESULTAT_RANG } from "../js/passage-rules.js";

// Comptage d'équité : Effectué + Absence consomment le tour, Bonus + Report non.
assert.equal(compteDansEquite("Effectué"), true);
assert.equal(compteDansEquite("Absence"), true);
assert.equal(compteDansEquite("Bonus"), false);
assert.equal(compteDansEquite("Report"), false);
assert.equal(compteDansEquite(undefined), false);
assert.equal(compteDansEquite(null), false);

// Fusion à la validation : Effectué > Absence > Bonus > Report.
assert.equal(meilleurResultat("Absence", "Effectué"), "Effectué");
assert.equal(meilleurResultat("Effectué", "Absence"), "Effectué");
assert.equal(meilleurResultat("Bonus", "Absence"), "Absence");
assert.equal(meilleurResultat("Report", "Bonus"), "Bonus");
assert.equal(meilleurResultat("Effectué", "Effectué"), "Effectué");
assert.ok(RESULTAT_RANG["Effectué"] < RESULTAT_RANG["Absence"]);
assert.ok(RESULTAT_RANG["Absence"] < RESULTAT_RANG["Bonus"]);

console.log("passage-rules : 13 assertions OK");
```

- [ ] **Step 2: Vérifier que le test échoue**

Run : `node tests/passage-rules.test.mjs` (cwd = worktree)
Attendu : `ERR_MODULE_NOT_FOUND` (js/passage-rules.js n'existe pas).

- [ ] **Step 3: Créer le module**

Créer `js/passage-rules.js` :

```js
// Règles PURES de comptage des passages — spec docs/specs/2026-07-19-absences-comptage-placement-design.md.
// Module sans dépendance : importé par db.js et planning.js, testable directement en node
// (tests/passage-rules.test.mjs).

// Résultats qui consomment le tour dans les compteurs d'équité du placement.
// « Absence » COMPTE (tour consommé, règle du 2026-07-19 : une absence de dernière
// minute ne redonne pas la priorité) ; « Bonus » (dépannage au pied levé) et
// « Report » (cas manuel, onglet Passages) ne comptent pas.
export function compteDansEquite(resultat) {
  return resultat === "Effectué" || resultat === "Absence";
}

// Fusion de deux candidats du même (stagiaire, type, jour) à « Valider la semaine » :
// un vrai passage n'est jamais écrasé par une absence ni par un bonus.
export const RESULTAT_RANG = { "Effectué": 0, "Absence": 1, "Bonus": 2, "Report": 3 };

export function meilleurResultat(a, b) {
  return (RESULTAT_RANG[a] ?? 9) <= (RESULTAT_RANG[b] ?? 9) ? a : b;
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run : `node tests/passage-rules.test.mjs`
Attendu : `passage-rules : 13 assertions OK`

- [ ] **Step 5: Brancher db.js sur le module**

Dans `js/db.js`, ajouter l'import après la ligne 2 (`import { SUPABASE_URL, ... }`) :

```js
import { compteDansEquite } from "./passage-rules.js?v=20260719p";
```

Puis dans `getVoitureAggregats()` (~ligne 1041), remplacer le commentaire d'en-tête et le filtre. AVANT :

```js
// Agrégats voiture par stagiaire pour le placement : nb de séances avec élève,
// répartition par formateur. Les absences/reports ne comptent pas comme exposition.
// avec_eleve NULL (historique inconnu) ne compte PAS comme « avec élève ».
```
```js
    if (p.resultat === "Absence" || p.resultat === "Report") return;
```

APRÈS :

```js
// Agrégats voiture par stagiaire pour le placement : nb de séances avec élève,
// répartition par formateur. Règle 2026-07-19 : une ABSENCE COMPTE (tour consommé,
// y compris avec_eleve si le créneau avait un bénévole) ; Bonus/Report ne comptent pas.
// avec_eleve NULL (historique inconnu) ne compte PAS comme « avec élève ».
```
```js
    if (!compteDansEquite(p.resultat)) return;
```

Même changement dans `getSalleAggregats()` (~ligne 1062). AVANT :

```js
// Agrégats Salle (passages au tableau) par stagiaire, pour le tirage des tableaux.
// Absences/reports exclus, comme pour la voiture.
```
```js
    if (p.resultat === "Absence" || p.resultat === "Report") return;
```

APRÈS :

```js
// Agrégats Salle (passages au tableau) par stagiaire, pour le tirage des tableaux.
// Règle 2026-07-19 : une Absence COMPTE (tour consommé) ; Bonus/Report non.
```
```js
    if (!compteDansEquite(p.resultat)) return;
```

- [ ] **Step 6: Vérifier la syntaxe**

Run : `node --check js/db.js; node --check js/passage-rules.js`
Attendu : aucune sortie (OK) pour les deux.

- [ ] **Step 7: Commit**

```bash
git add js/passage-rules.js tests/passage-rules.test.mjs js/db.js
git commit -m "feat(comptage): une Absence consomme le tour, Bonus/Report exclus (lot 1)"
```

---

### Task 2: Banc d'essai fetch-stub (non versionné)

**Files:**
- Create: `_harness.html` (worktree, non versionné)
- Create: `_harness_stub.js` (worktree, non versionné)
- Modify: `C:\Users\watch\Dev\ECSR\TP_ECSR_App\.git\info\exclude` (exclusion partagée par tous les worktrees)
- Modify: `C:\Users\watch\Dev\ECSR\.claude\launch.json` (entrée port 8123)

**Interfaces:**
- Consumes: `index.html` (structure copiée), `js/config.js` (SUPABASE_URL à intercepter).
- Produces: `window.STUB = { tables, upserts, patches }` inspectable via `javascript_tool` ; serveur `ecsr-banc-absences` sur `http://localhost:8123/_harness.html`. Utilisé par les Tasks 3-7 pour toute vérification navigateur.

- [ ] **Step 1: Exclusions git + entrée launch.json**

Ajouter à `C:\Users\watch\Dev\ECSR\TP_ECSR_App\.git\info\exclude` (fichier partagé worktrees ; créer les lignes si absentes) :

```
_harness.html
_harness_stub.js
```

Dans `C:\Users\watch\Dev\ECSR\.claude\launch.json`, ajouter à `configurations` :

```json
{
  "name": "ecsr-banc-absences",
  "runtimeExecutable": "python",
  "runtimeArgs": ["-m", "http.server", "8123", "--directory", "TP_ECSR_App_absences"],
  "port": 8123
}
```

- [ ] **Step 2: Créer `_harness_stub.js`**

Stub générique PostgREST : session admin factice + fixtures + interception fetch. Contenu complet :

```js
// BANC D'ESSAI — stub Supabase. JAMAIS versionné, JAMAIS déployé (.git/info/exclude).
// Intercepte fetch vers SUPABASE_URL : fixtures en mémoire, filtres PostgREST de base
// (eq/gte/lte/in/order/single), inserts/upserts/patch/delete mémorisés dans window.STUB.
(() => {
  const SUPA = "https://crpduennbqaemhfaywrz.supabase.co";

  // --- Session admin factice AVANT le chargement de l'app (storageKey de db.js) ---
  const nowS = Math.floor(Date.now() / 1000);
  localStorage.setItem("ecsr_supabase_session", JSON.stringify({
    access_token: "stub-token", token_type: "bearer", expires_in: 86400,
    expires_at: nowS + 86400, refresh_token: "stub-refresh",
    user: { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated",
      email: "banc@test.local", role: "authenticated", app_metadata: {},
      user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  }));
  localStorage.removeItem("ecsr_view_as");

  // --- Semaine courante (le planning s'ouvre dessus) ---
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const iso = (d) => d.toISOString().slice(0, 10);
  const MONDAY = iso(monday);
  const addD = (n) => { const d = new Date(monday); d.setDate(d.getDate() + n); return iso(d); };

  // --- Fixtures : promo fictive (6 stagiaires, 1 prof, 1 bénévole) ---
  // Historique passages : Anna 2 Salle Effectué ; Bruno 1 Salle Absence (doit compter) ;
  // Chloé 1 Salle Bonus (ne doit PAS compter) ; David 1 Voiture Absence avec_eleve=true.
  const T = {
    user_profiles: [{ id: 1, user_id: "00000000-0000-0000-0000-000000000001",
      email: "banc@test.local", role: "prof", is_admin: true, is_founder: false,
      stagiaire_id: null, prof_id: 1 }],
    stagiaires: [
      { id: 1, nom: "ALPHA", prenom: "Anna", actif: true },
      { id: 2, nom: "BRAVO", prenom: "Bruno", actif: true },
      { id: 3, nom: "CHARLIE", prenom: "Chloé", actif: true },
      { id: 4, nom: "DELTA", prenom: "David", actif: true },
      { id: 5, nom: "ECHO", prenom: "Emma", actif: true },
      { id: 6, nom: "FOX", prenom: "Farid", actif: true },
    ],
    profs: [{ id: 1, nom: "FORMATEUR", prenom: "Fabien", actif: true }],
    benevoles: [{ id: 1, nom: "BENEVOLE", prenom: "Bea", actif: true, niveau: "1", dispos: {} }],
    passages: [
      { id: 101, date: addD(-7), stagiaire_id: 1, type: "Salle", resultat: "Effectué", remplacant_id: null, prof_id: 1, avec_eleve: null, semaine_lundi: addD(-7), origine: "Planning" },
      { id: 102, date: addD(-6), stagiaire_id: 1, type: "Salle", resultat: "Effectué", remplacant_id: null, prof_id: 1, avec_eleve: null, semaine_lundi: addD(-7), origine: "Planning" },
      { id: 103, date: addD(-7), stagiaire_id: 2, type: "Salle", resultat: "Absence", remplacant_id: 3, prof_id: 1, avec_eleve: null, semaine_lundi: addD(-7), origine: "Planning" },
      { id: 104, date: addD(-7), stagiaire_id: 3, type: "Salle", resultat: "Bonus", remplacant_id: null, prof_id: 1, avec_eleve: null, semaine_lundi: addD(-7), origine: "Planning" },
      { id: 105, date: addD(-6), stagiaire_id: 4, type: "Voiture", resultat: "Absence", remplacant_id: null, prof_id: 1, avec_eleve: true, semaine_lundi: addD(-7), origine: "Planning" },
    ],
    planning_entries: [
      // Jeudi : salle 2 groupes — tableau G1 Anna, G2 Bruno, stagiaires Chloé/David/Emma/Farid.
      { semaine_lundi: MONDAY, day_index: 3, half_day: "aprem", slot: 0, lane: 0,
        activite: "Pédagogie salle", prof_id: 1, prof_ids: [1], prof_autre: null, autonomie: false,
        sujet: "Sujet G1", sujet_2: "Sujet G2", salle_double: true,
        pedagogue_id: 1, pedagogue_id_2: 2,
        eleves_ids: [3, 4, 5, 6], eleves_ids_2: [3, 4, 5, 6],
        benevoles_ids: [], notes: null, absences: [] },
      // Vendredi matin : voiture — élèves Emma/Farid + bénévole (avec élève).
      { semaine_lundi: MONDAY, day_index: 4, half_day: "matin", slot: 0, lane: 0,
        activite: "Voiture (conduite)", prof_id: 1, prof_ids: [1], prof_autre: null, autonomie: false,
        sujet: null, sujet_2: null, salle_double: false,
        pedagogue_id: null, pedagogue_id_2: null,
        eleves_ids: [5, 6], eleves_ids_2: [], benevoles_ids: [1], notes: null, absences: [] },
    ],
    fiches_suivi: [], themes: [], jours_off: [],
  };
  window.STUB = { tables: T, upserts: [], patches: [], deletes: [] };
  let nextId = 1000;

  // --- Mini-parseur PostgREST ---
  const matchFilter = (row, col, expr) => {
    const val = row[col];
    if (expr.startsWith("eq.")) return String(val) === expr.slice(3);
    if (expr.startsWith("gte.")) return String(val) >= expr.slice(4);
    if (expr.startsWith("lte.")) return String(val) <= expr.slice(4);
    if (expr.startsWith("in.")) {
      const list = expr.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, ""));
      return list.includes(String(val));
    }
    if (expr.startsWith("is.")) return expr.slice(3) === "null" ? val == null : !!val === (expr.slice(3) === "true");
    return true; // filtre non géré : laisse passer (fixtures petites)
  };
  const applyFilters = (rows, params) => {
    let out = rows;
    for (const [k, v] of params.entries()) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      out = out.filter((r) => matchFilter(r, k, v));
    }
    const order = params.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
    }
    return out;
  };
  const jsonResp = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" } }));

  // --- Interception fetch ---
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith(SUPA)) return realFetch(input, init);
    const u = new URL(url);
    const method = (init.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : {}));

    // Auth : refresh / user → session factice stable.
    if (u.pathname.startsWith("/auth/v1/token")) {
      return jsonResp(JSON.parse(localStorage.getItem("ecsr_supabase_session")));
    }
    if (u.pathname.startsWith("/auth/v1/user")) {
      return jsonResp(JSON.parse(localStorage.getItem("ecsr_supabase_session")).user);
    }
    if (u.pathname.startsWith("/auth/v1/")) return jsonResp({});

    // REST : /rest/v1/<table>
    const m = u.pathname.match(/^\/rest\/v1\/([a-z_]+)/);
    if (!m) return jsonResp([]);
    const table = m[1];
    const rows = T[table] || (T[table] = []);
    const single = (headers.get("Accept") || "").includes("pgrst.object");

    if (method === "GET" || method === "HEAD") {
      const out = applyFilters(rows, u.searchParams);
      if (single) return out.length ? jsonResp(out[0]) : jsonResp({ message: "0 rows" }, 406);
      return jsonResp(out);
    }
    if (method === "POST") {
      const body = JSON.parse(init.body || "[]");
      const list = Array.isArray(body) ? body : [body];
      const conflict = (u.searchParams.get("on_conflict") || "").split(",").filter(Boolean);
      const inserted = list.map((r) => {
        let row = { ...r };
        if (conflict.length) {
          const idx = rows.findIndex((x) => conflict.every((c) => String(x[c]) === String(r[c])));
          if (idx >= 0) { rows[idx] = { ...rows[idx], ...r }; window.STUB.upserts.push({ table, row: rows[idx] }); return rows[idx]; }
        }
        if (row.id == null) row.id = nextId++;
        rows.push(row);
        window.STUB.upserts.push({ table, row });
        return row;
      });
      return jsonResp(single ? inserted[0] : inserted, 201);
    }
    if (method === "PATCH") {
      const body = JSON.parse(init.body || "{}");
      const targets = applyFilters(rows, u.searchParams);
      targets.forEach((r) => { Object.assign(r, body); window.STUB.patches.push({ table, row: r }); });
      return jsonResp(targets);
    }
    if (method === "DELETE") {
      const targets = applyFilters(rows, u.searchParams);
      targets.forEach((r) => { const i = rows.indexOf(r); if (i >= 0) rows.splice(i, 1); window.STUB.deletes.push({ table, row: r }); });
      return jsonResp(targets);
    }
    return jsonResp([]);
  };

  // --- Bandeau banc d'essai (obligatoire : confusion banc/vraie app le 19/07) ---
  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("div");
    b.textContent = "BANC D'ESSAI · DONNÉES FICTIVES · la vraie app locale est sur localhost:8000";
    b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#e67e22;color:#fff;" +
      "font:700 13px/1.6 sans-serif;text-align:center;padding:2px 0;";
    document.body.appendChild(b);
  });
})();
```

NB : si au chargement l'app réclame une table absente des fixtures (visible en console « table inconnue » ou rendu vide inattendu), ajouter la table vide dans `T` — le stub renvoie déjà `[]` par défaut, donc seul un `.single()` peut casser : dans ce cas ajouter la row fixture qui va bien (procédé : lire l'appel dans `js/db.js`).

- [ ] **Step 3: Créer `_harness.html`**

Copier `index.html` tel quel vers `_harness.html`, puis insérer **avant le premier `<script`** du fichier :

```html
<script src="_harness_stub.js?fresh=1"></script>
```

(Le stub doit s'exécuter avant tout module de l'app : c'est un script classique bloquant, les modules de l'app sont différés → ordre garanti.)

- [ ] **Step 4: Vérifier le banc au navigateur**

1. `preview_start` avec `{name: "ecsr-banc-absences"}`.
2. `navigate` vers `http://localhost:8123/_harness.html?fresh=<nombre aléatoire>`.
3. `read_page` : bandeau orange présent, app connectée en admin (pas d'écran de login), onglet Planning affichant la semaine courante avec la carte salle (tableaux A. Anna / B. Bruno) et la carte voiture (E. Emma, F. Farid).
4. `read_console_messages` : aucune erreur bloquante (warnings tolérés).

Attendu : planning rendu complet avec les fixtures. Pas de commit (fichiers non versionnés) — Task terminée quand le banc rend l'app.

---

### Task 3: Lot 2a — migration SQL + plomberie `absences`

**Files:**
- Create: `docs/specs/2026-07-19-absences-migration.sql`
- Modify: `js/views/planning.js:168-191` (`entryUpsertPayload`), `js/views/planning.js:544` env. (helpers après `effSujets`), `js/views/planning.js:580-627` (`slotOccupants`)

**Interfaces:**
- Consumes: `saveEntry(lid, patch)`, `recordUndo(label, fn)`, `entries`, `renderInto(currentContainer)` (état module existant de planning.js).
- Produces: `entryAbsences(e): {sid,rid}[]` ; `absenceOf(e, sid): {sid,rid}|null` ; `passageRoleIds(e): number[]` ; `setAbsence(lid, sid, action: "mark"|"unmark"|"replace", rid?): Promise` ; colonne `absences` dans le payload d'upsert. Utilisés par les Tasks 4 et 5.

- [ ] **Step 1: Fichier migration**

Créer `docs/specs/2026-07-19-absences-migration.sql` :

```sql
-- Marquage des absences de dernière minute sur les cartes planning
-- (spec 2026-07-19-absences-comptage-placement-design.md, §3).
-- Format : [{ "sid": <id stagiaire absent>, "rid": <id remplaçant | null> }, ...]
-- La personne prévue RESTE dans son champ de rôle ; sid s'y réfère.
-- Application PROD : Task 8 uniquement (MCP apply_migration, nom add_absences_planning_entries).
ALTER TABLE planning_entries
  ADD COLUMN IF NOT EXISTS absences jsonb NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 2: Payload d'upsert**

Dans `entryUpsertPayload` (`js/views/planning.js:168`), après la ligne `notes: entry.notes ?? null,` ajouter :

```js
    absences: entry.absences ?? [],   // [{sid, rid}] absences de dernière minute (spec 2026-07-19)
```

- [ ] **Step 3: Helpers absences**

Dans `js/views/planning.js`, insérer après la fonction `effSujets` (~ligne 544) :

```js
// === Absences de dernière minute (spec 2026-07-19) ===
// entry.absences = [{ sid, rid }] : sid = prévu absent (il RESTE dans son champ de rôle,
// la carte fait foi du planifié), rid = remplaçant (null si personne n'a repris).
// Le rôle se déduit de la position de sid sur la carte.
function entryAbsences(e) { return Array.isArray(e.absences) ? e.absences : []; }
function absenceOf(e, sid) { return entryAbsences(e).find((a) => a.sid === sid) || null; }

// Ids générateurs de passage d'une carte (tableaux salle / élèves voiture) — les seuls
// rôles marquables absents. Sert aussi à purger les absences orphelines (chip retirée,
// activité changée).
function passageRoleIds(e) {
  if (e.activite === "Pédagogie salle") {
    const ids = [];
    if (e.pedagogue_id != null) ids.push(e.pedagogue_id);
    if (e.salle_double && e.pedagogue_id_2 != null) ids.push(e.pedagogue_id_2);
    return ids;
  }
  if (e.activite === ACT_VOITURE) return [...(e.eleves_ids || [])];
  return [];
}

// Marque / démarque / affecte un remplaçant. Purge les orphelines au passage,
// enregistre via saveEntry et pose un undo Ctrl+Z.
async function setAbsence(lid, sid, action, rid = null) {
  const entry = entries.find((e) => e._lid === lid);
  if (!entry) return;
  const beforeAbs = entryAbsences(entry).map((a) => ({ ...a }));
  const valid = new Set(passageRoleIds(entry));
  let next = entryAbsences(entry).filter((a) => valid.has(a.sid));
  if (action === "mark" && !next.some((a) => a.sid === sid)) next = [...next, { sid, rid: null }];
  if (action === "unmark") next = next.filter((a) => a.sid !== sid);
  if (action === "replace") next = next.map((a) => (a.sid === sid ? { ...a, rid } : a));
  await saveEntry(lid, { absences: next });
  renderInto(currentContainer);
  recordUndo("marquage d'absence", async () => {
    await saveEntry(lid, { absences: beforeAbs });
    renderInto(currentContainer);
  });
}
```

NB : `ACT_VOITURE` est déclaré ligne 578, APRÈS `effSujets`. Si l'insertion se fait avant sa déclaration, pas de souci : `passageRoleIds` ne s'exécute qu'au runtime (hoisting des `const` de module : déclarés avant tout appel). Vérifier quand même l'ordre au `node --check` + banc.

- [ ] **Step 4: Les remplaçants occupent le créneau**

Dans `slotOccupants` (`js/views/planning.js:580`), juste avant le `return ids;` final (~ligne 626), ajouter :

```js
  // Les remplaçants désignés occupent le créneau au même titre que l'absent qu'ils
  // couvrent (si l'absent a été compté occupant, son remplaçant l'est aussi).
  entries.forEach((e) => {
    if (e.day_index !== entry.day_index || e.half_day !== entry.half_day) return;
    entryAbsences(e).forEach((a) => { if (a.rid != null && ids.has(a.sid)) ids.add(a.rid); });
  });
```

- [ ] **Step 5: Vérifier syntaxe + banc**

Run : `node --check js/views/planning.js` → OK.
Banc : recharger `_harness.html?fresh=<aléatoire>`, vérifier que le planning rend toujours (aucune régression au chargement), et via `javascript_tool` que l'upsert d'une édition anodine (ex. taper un sujet) inclut bien `absences: []` dans `window.STUB.upserts`.

- [ ] **Step 6: Commit**

```bash
git add docs/specs/2026-07-19-absences-migration.sql js/views/planning.js
git commit -m "feat(absences): colonne absences + helpers + remplaçants occupants (lot 2a)"
```

---

### Task 4: Lot 2b — UI de marquage (chips) + sélecteur de remplaçant souple

**Files:**
- Modify: `js/views/planning.js:1246-1284` (`personSelect` : opts), `js/views/planning.js:1290-1355` (`chipsSelect` : opts chips), `js/views/planning.js:1516-1560` env. (rendu tableau salle), `js/views/planning.js:1671-1680` env. (chips élèves voiture), + helper `renderAbsenceRows` (nouveau)
- Modify: `css/style.css` (fin de fichier)

**Interfaces:**
- Consumes: `entryAbsences`, `absenceOf`, `passageRoleIds`, `setAbsence` (Task 3) ; `personSelect`, `chipsSelect`, `slotOccupants`, `roleCounts`, `displayStagiaire`, `el`.
- Produces: `personSelect(all, cur, onChange, counts, placeholder, opts?)` avec `opts.itemBadge(s): Node|null` ; `chipsSelect(..., opts)` avec `opts.chipClassFn(id): string` et `opts.onChipClick(id): void` ; `renderAbsenceRows(entry, lid): Node`. Utilisé tel quel par Task 7 (banc complet).

- [ ] **Step 1: `personSelect` accepte un badge d'item**

Signature (`js/views/planning.js:1246`) : `function personSelect(allStagiaires, currentId, onChange, counts, placeholder = "—", opts = {})`.
Dans la boucle `ordered.forEach((s) => {` (~ligne 1268), après `if (counts) item.appendChild(prioBadge(counts[s.id] || 0));` ajouter :

```js
      if (opts.itemBadge) { const badge = opts.itemBadge(s); if (badge) item.appendChild(badge); }
```

- [ ] **Step 2: `chipsSelect` : classe et clic par chip**

Dans `chipsSelect` (~ligne 1290), destructurer deux opts de plus :

```js
  const { labelFn = displayStagiaire, placeholder = "Stagiaires…", itemBadge = null,
          chipTitleFn = null, chipClassFn = null, onChipClick = null } = opts;
```

Dans le rendu des chips (~ligne 1305), remplacer `const chip = el("span", { class: "chip" },` par :

```js
        const chip = el("span", { class: "chip" + (chipClassFn ? (chipClassFn(id) || "") : "") },
```

Et après `if (chipTitleFn) chip.setAttribute("title", chipTitleFn(id));` ajouter :

```js
        if (onChipClick) {
          chip.classList.add("chip-clickable");
          chip.addEventListener("click", (ev) => {
            if (ev.target.classList.contains("x")) return;  // la croix garde son rôle
            ev.stopPropagation();                            // ne pas ouvrir le dropdown
            onChipClick(id);
          });
        }
```

- [ ] **Step 3: Helper `renderAbsenceRows`**

Insérer après `chipsSelect` (~ligne 1356) :

```js
// Lignes « ⊘ X absent(e) → remplacé(e) par … » d'une carte (spec §5). Sélecteur SOUPLE :
// tous les stagiaires (moins l'absent), tri par priorité, badge « occupé » à titre
// d'avertissement AU LIEU d'une exclusion dure — c'est le remplacement de dernière
// minute, la personne est souvent déjà dans la salle (cas Céline, 17/07).
function renderAbsenceRows(entry, lid) {
  const wrap = el("div", { class: "abs-rows" });
  const roleIds = passageRoleIds(entry);
  const absList = entryAbsences(entry).filter((a) => roleIds.includes(a.sid));
  if (!absList.length) return wrap;
  const isSalle = entry.activite === "Pédagogie salle";
  const counts = isSalle ? roleCounts("Pédagogie salle", "pedagogue", entry._lid)
                         : roleCounts(ACT_VOITURE, "eleve", entry._lid);
  absList.forEach((a) => {
    const s = stagiaires.find((x) => x.id === a.sid);
    const exceptField = isSalle
      ? (entry.salle_double && entry.pedagogue_id_2 === a.sid ? "pedagogue_2" : "pedagogue")
      : "eleves";
    const occupied = slotOccupants(entry, exceptField);
    const options = stagiaires.filter((x) => x.id !== a.sid);
    wrap.appendChild(el("div", { class: "abs-row" },
      el("span", { class: "abs-row-name" }, "⊘ " + (s ? displayStagiaire(s) : "?") + " absent(e) → remplacé(e) par"),
      personSelect(options, a.rid, (id) => setAbsence(lid, a.sid, "replace", id), counts, "personne", {
        itemBadge: (x) => occupied.has(x.id)
          ? el("span", { class: "prio-badge abs-occupied", title: "Déjà pris sur ce créneau — à toi de juger" }, "occupé")
          : null,
      }),
    ));
  });
  return wrap;
}
```

- [ ] **Step 4: Tableau salle — bouton ⊘ + rendu barré**

Dans le rendu du rôle « au tableau » (~ligne 1516-1540, zone du `personSelect` + bouton dé `p-dice-btn`) : `currentVal` est l'id du tableau du groupe, `field` vaut `pedagogue_id` ou `pedagogue_id_2`, `lid` la carte. Après l'ajout du bouton dé, ajouter :

```js
  const absPeda = currentVal != null ? absenceOf(entry, currentVal) : null;
  if (absPeda) pedaRole.classList.add("role-absent");
  if (currentVal != null) {
    pedaRole.appendChild(el("button", {
      class: "p-abs-btn" + (absPeda ? " active" : ""), type: "button",
      title: absPeda ? "Annuler l'absence" : "Marquer absent(e) — dernière minute (le passage comptera « Absence »)",
      onClick: () => setAbsence(lid, currentVal, absPeda ? "unmark" : "mark"),
    }, "⊘"));
  }
  pedaRole.appendChild(renderAbsenceRows(entry, lid));
```

⚠️ Adapter les noms exacts (`pedaRole`, `currentVal`, `field`) à ceux du bloc réel — les anchors ci-dessus datent de la lecture du 19/07 ; si le code local diffère, garder la sémantique : bouton après le dé, classe sur le conteneur du rôle, lignes de remplacement à la suite. Pour une carte 2 groupes, chaque groupe rend son propre bouton ; `renderAbsenceRows` peut être appelé deux fois → ne l'appeler que pour le groupe 1 (il liste TOUTES les absences de la carte) ou le déplacer en pied de carte : choisir le pied de carte si le rendu par groupe duplique les lignes.

- [ ] **Step 5: Chips élèves voiture — clic = marquer absent**

Au call-site voiture (~ligne 1675), remplacer :

```js
    eleveCol.appendChild(chipsSelect(eleveOptions, entry.eleves_ids || [], (ids) => {
      saveEntry(lid, { eleves_ids: ids });
    }, voitCounts, {
      chipTitleFn: (id) => `${voitureStats[id]?.avecEleve || 0} séance(s) avec élève bénévole au compteur`,
    }));
```

par :

```js
    eleveCol.appendChild(chipsSelect(eleveOptions, entry.eleves_ids || [], (ids) => {
      saveEntry(lid, { eleves_ids: ids });
    }, voitCounts, {
      chipTitleFn: (id) => `${voitureStats[id]?.avecEleve || 0} séance(s) avec élève bénévole au compteur`
        + (absenceOf(entry, id) ? " · ABSENT(E) — cliquer pour annuler" : " · Cliquer : marquer absent(e)"),
      chipClassFn: (id) => (absenceOf(entry, id) ? " chip-absent" : ""),
      onChipClick: (id) => setAbsence(lid, id, absenceOf(entry, id) ? "unmark" : "mark"),
    }));
    eleveCol.appendChild(renderAbsenceRows(entry, lid));
```

- [ ] **Step 6: CSS**

En fin de `css/style.css` (vérifier d'abord par grep si des variables `--danger`/`--warn` existent et les réutiliser ; sinon garder les valeurs littérales) :

```css
/* === Absences de dernière minute (spec 2026-07-19) === */
.chip.chip-absent { text-decoration: line-through; background: #fde8e8; color: #b42318; }
.chip.chip-clickable { cursor: pointer; }
.role-absent .person-value { text-decoration: line-through; color: #b42318; }
.p-abs-btn { background: none; border: 1px solid transparent; border-radius: 6px;
  cursor: pointer; font-size: 0.95rem; line-height: 1; padding: 2px 5px; opacity: 0.55; }
.p-abs-btn:hover { opacity: 1; }
.p-abs-btn.active { color: #b42318; opacity: 1; }
.abs-rows { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; width: 100%; }
.abs-row { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; flex-wrap: wrap; }
.abs-row-name { color: #b42318; font-weight: 600; }
.abs-occupied { background: #f5e0c0; color: #8a5a00; }
```

- [ ] **Step 7: Vérification banc**

`node --check js/views/planning.js` → OK. Puis au banc (`_harness.html?fresh=<aléatoire>`) :
1. Carte voiture : cliquer la chip « E. Emma » → chip barrée rouge + ligne « ⊘ E. Emma absent(e) → remplacé(e) par [personne] » (`read_page` pour vérifier, clic via `computer` avec ref).
2. Ouvrir le sélecteur de remplaçant : **tous** les stagiaires proposés, ceux de la carte salle du jeudi SANS badge (autre jour), Farid (même carte voiture) AVEC badge « occupé ». Choisir Chloé → `window.STUB.upserts` contient l'entrée planning avec `absences: [{sid:5, rid:3}]`.
3. Carte salle jeudi : bouton ⊘ à côté du tableau G1 (Anna) → clic → rôle barré + ligne de remplacement. Re-clic ⊘ → absence annulée.
4. Ctrl+Z (via `computer` key) après un marquage → marquage annulé.

- [ ] **Step 8: Commit**

```bash
git add js/views/planning.js css/style.css
git commit -m "feat(absences): marquage sur les chips + sélecteur remplaçant souple (lot 2b)"
```

---

### Task 5: Lot 2c — « Valider la semaine » génère Absence + Bonus

**Files:**
- Modify: `js/views/planning.js:2036-2074` (génération des candidats + fusion), `js/views/planning.js:2130-2160` (récapitulatif modale), `js/views/planning.js:2213-2215` (`addRow`), `js/views/planning.js:2274` et `2332` (textes), + import `meilleurResultat` en tête de fichier

**Interfaces:**
- Consumes: `absenceOf` (Task 3) ; `meilleurResultat` de `js/passage-rules.js` (Task 1) ; structure candidat existante `{stagiaire_id, type, date, day_index, prof_id, avec_eleve}`.
- Produces: candidats enrichis `{..., resultat: "Effectué"|"Absence"|"Bonus", remplacant_id: number|null}` consommés par `renderValiderModal`/`addRow` ; rows `passages` avec `resultat` et `remplacant_id` corrects.

- [ ] **Step 1: Import**

En tête de `js/views/planning.js` (bloc d'imports existant, ~lignes 1-20), ajouter :

```js
import { meilleurResultat } from "../passage-rules.js?v=20260719p";
```

- [ ] **Step 2: Génération des candidats**

Dans `openValiderSemaineModal` (~ligne 2034), remplacer le bloc `entries.forEach((e) => { ... })` de collecte `raw` (lignes 2036-2054) par :

```js
  // Un prévu marqué absent → candidat « Absence » (remplacant_id renseigné) + candidat
  // « Bonus » pour le remplaçant s'il y en a un. Prévu non marqué → « Effectué ».
  const pushCand = (stagiaire_id, type, dateIso, day_index, prof_id, avec_eleve, e) => {
    if (!activeIds.has(stagiaire_id)) return;
    const abs = absenceOf(e, stagiaire_id);
    if (abs) {
      raw.push({ stagiaire_id, type, date: dateIso, day_index, prof_id, avec_eleve,
                 resultat: "Absence", remplacant_id: abs.rid ?? null });
      if (abs.rid != null && activeIds.has(abs.rid)) {
        raw.push({ stagiaire_id: abs.rid, type, date: dateIso, day_index, prof_id, avec_eleve,
                   resultat: "Bonus", remplacant_id: null });
      }
    } else {
      raw.push({ stagiaire_id, type, date: dateIso, day_index, prof_id, avec_eleve,
                 resultat: "Effectué", remplacant_id: null });
    }
  };
  entries.forEach((e) => {
    const dateIso = isoDate(addDays(monday, e.day_index));
    if (dateIso > todayIso) return;
    if (dayIsOff(e.day_index)) return;   // jour désactivé/férié : aucun passage validé
    const prof = profOf(e);
    if (e.activite === "Pédagogie salle") {
      if (e.pedagogue_id) pushCand(e.pedagogue_id, "Salle", dateIso, e.day_index, prof, null, e);
      // 2e tableau (si la carte a 2 groupes) = un 2e passage Salle
      if (e.salle_double && e.pedagogue_id_2) pushCand(e.pedagogue_id_2, "Salle", dateIso, e.day_index, prof, null, e);
    } else if (e.activite === "Voiture (conduite)") {
      const avecEleve = (e.benevoles_ids || []).length > 0;
      (e.eleves_ids || []).forEach((id) => pushCand(id, "Voiture", dateIso, e.day_index, prof, avecEleve, e));
    }
  });
```

- [ ] **Step 3: Fusion des doublons par résultat**

Dans le bloc de fusion (~lignes 2062-2074), à l'intérieur du `if (prev) { ... }`, après `if (prev.prof_id == null) prev.prof_id = c.prof_id;` ajouter :

```js
      // Fusion des résultats (grain jour) : Effectué > Absence > Bonus — un vrai
      // passage n'est jamais écrasé par une absence ni un bonus du même jour.
      const best = meilleurResultat(prev.resultat, c.resultat);
      if (best !== prev.resultat) { prev.resultat = best; prev.remplacant_id = c.remplacant_id ?? null; }
```

- [ ] **Step 4: Enregistrement avec le bon résultat**

Remplacer (~ligne 2213) :

```js
    toCreate.forEach((c) => {
      addRow(c.stagiaire_id, c.type, c.date, "Effectué", null, c.prof_id, c.avec_eleve);
    });
```

par :

```js
    toCreate.forEach((c) => {
      addRow(c.stagiaire_id, c.type, c.date, c.resultat || "Effectué", c.remplacant_id || null, c.prof_id, c.avec_eleve);
    });
```

- [ ] **Step 5: Récapitulatif modale avec pastilles**

Remplacer l'en-tête (~ligne 2130) :

```js
  const headText = [el("strong", {}, toCreate.length + " passage(s)"), " seront enregistrés (résultat : Effectué)."];
```

par :

```js
  const nbAbs = toCreate.filter((c) => c.resultat === "Absence").length;
  const nbBonus = toCreate.filter((c) => c.resultat === "Bonus").length;
  const headText = [el("strong", {}, toCreate.length + " passage(s)"), " seront enregistrés."];
  if (nbAbs || nbBonus) headText.push(` Dont ${nbAbs} ❌ absence(s) (comptées) et ${nbBonus} ⭐ bonus (non comptés).`);
```

Et dans la construction `byDay` (~ligne 2141), remplacer `byDay.get(c.day_index).push(nameOf(c.stagiaire_id));` par :

```js
      byDay.get(c.day_index).push(nameOf(c.stagiaire_id)
        + (c.resultat === "Absence" ? " ❌" : c.resultat === "Bonus" ? " ⭐" : ""));
```

Enfin les deux textes d'aide : ligne ~2274 remplacer « Une absence ou un cas particulier ? Corrige ensuite dans l'onglet Passages. » par « Une absence de dernière minute ? Marque-la sur la carte (⊘) AVANT de valider — elle sera enregistrée « Absence » et son remplaçant en « Bonus ». » ; même idée pour la ligne mémo ~2332 (le mémo complet est réécrit en Task 6).

- [ ] **Step 6: Vérification banc**

`node --check js/views/planning.js`. Au banc (`?fresh=` neuf) :
1. Marquer Emma absente sur la voiture du vendredi, remplaçante Chloé (Task 4 UI). Marquer Anna absente au tableau du jeudi, sans remplaçant.
2. Cliquer « Valider la semaine » (si le vendredi est dans le futur par rapport au jour réel, adapter les fixtures du stub : déplacer la carte voiture sur un `day_index` déjà écoulé, recharger).
3. `read_page` de la modale : en-tête « Dont 2 ❌ absence(s)… 1 ⭐ bonus », lignes « E. Emma ❌ », « C. Chloé ⭐ », « A. Anna ❌ ».
4. Enregistrer → `javascript_tool` : `window.STUB.upserts` contient 4+ rows passages dont `{stagiaire_id:5, resultat:"Absence", remplacant_id:3}`, `{stagiaire_id:3, resultat:"Bonus"}`, `{stagiaire_id:1, resultat:"Absence", remplacant_id:null}`, et Bruno/Farid en « Effectué ».
5. Cas fusion : ajouter au stub une 2e carte voiture le même jour avec Emma non marquée → revalider → une seule row Emma ce jour-là, résultat « Effectué » (le vrai passage gagne).

- [ ] **Step 7: Commit**

```bash
git add js/views/planning.js
git commit -m "feat(absences): Valider la semaine genere Absence comptee + Bonus remplacant (lot 2c)"
```

---

### Task 6: Lot 3 — cascade de placement par type + mémo

**Files:**
- Modify: `js/views/planning.js:679-693` (`weekPassageCounts` → par type), `js/views/planning.js:749-770` (`randomFillPedagogue`), `js/views/planning.js:775-806` (`randomFillVoitureEleves`), `js/views/planning.js:904-918` et `948-962` (`autoPlaceWeek` : `couvert` → cascade), `js/views/planning.js:2284-2340` (mémo ℹ️)

**Interfaces:**
- Consumes: `voitureScore(id, entry, weekAvecEleve, weekVoit, voitDays)` (inchangé), `salleStats`, `cmpScores`, `dayIsOff`, `ACT_VOITURE`.
- Produces: `weekPassageCountsByType(excludeLid): { salle: {[id]: n}, voiture: {[id]: n} }` (REMPLACE `weekPassageCounts` — supprimer l'ancienne, 2 call-sites internes). Scores : tableau = `[couvertGlobal, couvertSalle, retard, intraSemaine]`, voiture = `[couvertGlobal, couvertVoiture, ...voitureScore]`.

- [ ] **Step 1: Compteurs hebdo par type**

Remplacer `weekPassageCounts` (lignes 679-693) par :

```js
// Placements générateurs de passage de la semaine, PAR TYPE (salle-tableau / voiture-
// élève), par stagiaire. Exclut jours off et la carte cible. Un marqué absent COMPTE
// (tour consommé — il reste dans son champ de rôle) ; son remplaçant ne compte pas
// (passage bonus — il n'apparaît que dans entry.absences). Sert à la cascade :
// 1) rien eu cette semaine → 2) type manquant → 3) retard historique sur le type.
function weekPassageCountsByType(excludeLid) {
  const salle = {}, voiture = {};
  const bump = (m, id) => { if (id != null) m[id] = (m[id] || 0) + 1; };
  entries.forEach((e) => {
    if (e._lid === excludeLid || dayIsOff(e.day_index)) return;
    if (e.activite === ACT_VOITURE) (e.eleves_ids || []).forEach((id) => bump(voiture, id));
    else if (e.activite === "Pédagogie salle") {
      bump(salle, e.pedagogue_id);
      if (e.salle_double) bump(salle, e.pedagogue_id_2);
    }
  });
  return { salle, voiture };
}
```

- [ ] **Step 2: `randomFillPedagogue` (dé tableau)**

Remplacer (lignes 755-756) :

```js
  const passCounts = weekPassageCounts(lid);
  const couvert = (id) => (passCounts[id] || 0) > 0 ? 1 : 0;
```

par :

```js
  const { salle: weekSalle, voiture: weekVoitP } = weekPassageCountsByType(lid);
  const couvertGlobal = (id) => ((weekSalle[id] || 0) + (weekVoitP[id] || 0)) > 0 ? 1 : 0;
  const couvertSalle = (id) => (weekSalle[id] || 0) > 0 ? 1 : 0;
```

et le score (ligne 764) :

```js
    .map((s) => ({ s, score: [couvertGlobal(s.id), couvertSalle(s.id), (salleStats[s.id] || 0) + (pedaCount[s.id] || 0), pedaCount[s.id] || 0] }))
```

Mettre à jour le commentaire de tête de fonction (lignes 745-748) : « priorité à qui n'a encore AUCUN passage cette semaine, puis à qui n'a pas encore eu de tableau cette semaine, puis le moins passé au tableau (historique Salle inclus — Absences comptées), départagé par le compteur intra-semaine. »

- [ ] **Step 3: `randomFillVoitureEleves` (dé voiture)**

Remplacer (lignes 796-799) :

```js
  const passCounts = weekPassageCounts(lid);
  const couvert = (id) => (passCounts[id] || 0) > 0 ? 1 : 0;
  const picked = shuffle(eligible)
    .map((s) => ({ id: s.id, score: [couvert(s.id), ...voitureScore(s.id, entry, voitAvecEleve, voit, voitDays)] }))
```

par :

```js
  const { salle: weekSalle, voiture: weekVoitAll } = weekPassageCountsByType(lid);
  const couvertGlobal = (id) => ((weekSalle[id] || 0) + (weekVoitAll[id] || 0)) > 0 ? 1 : 0;
  const couvertVoiture = (id) => (weekVoitAll[id] || 0) > 0 ? 1 : 0;
  const picked = shuffle(eligible)
    .map((s) => ({ id: s.id, score: [couvertGlobal(s.id), couvertVoiture(s.id), ...voitureScore(s.id, entry, voitAvecEleve, voit, voitDays)] }))
```

- [ ] **Step 4: `autoPlaceWeek` : cascade dans les deux remplisseurs**

Remplacer (lignes 904-906) :

```js
  // Couverture : 0 = pas encore de passage (voiture élève ou tableau) cette semaine → prioritaire.
  // Favorise « au moins 1 passage chacun » avant de resservir qui que ce soit.
  const couvert = (id) => ((voit[id] || 0) + (tab[id] || 0)) > 0 ? 1 : 0;
```

par :

```js
  // Cascade de couverture (spec 2026-07-19) : 1) rien eu cette semaine → prioritaire ;
  // 2) pas encore eu CE type cette semaine ; 3) retard historique sur le type (critères
  // suivants du score). Objectif : 1 salle ET 1 voiture chacun, dans la mesure du possible.
  const couvertGlobal = (id) => ((voit[id] || 0) + (tab[id] || 0)) > 0 ? 1 : 0;
  const couvertTab = (id) => (tab[id] || 0) > 0 ? 1 : 0;
  const couvertVoit = (id) => (voit[id] || 0) > 0 ? 1 : 0;
```

Dans `fillTableau` (ligne 916), remplacer le score :

```js
      .map((s) => ({ id: s.id, score: [couvertGlobal(s.id), couvertTab(s.id), (salleStats[s.id] || 0) + (tab[s.id] || 0), tab[s.id] || 0] }))
```

Dans `fillVoiture` (ligne 952), remplacer le score :

```js
      .map((s) => ({ id: s.id, score: [couvertGlobal(s.id), couvertVoit(s.id), ...voitureScore(s.id, e, voitAvecEleve, voit, voitDays)] }))
```

Mettre à jour le commentaire du bloc score voiture (lignes 629-642) : le tuple est désormais préfixé par DEUX critères de couverture (globale puis par type).

- [ ] **Step 5: Mémo ℹ️**

Dans `renderPlacementMemo` (~lignes 2284-2340), intégrer les nouvelles règles en langage simple :
- Dans la liste des priorités voiture ET salle, insérer en tête : `li("D'abord ceux qui n'ont ", b("rien eu du tout"), " cette semaine, puis ceux à qui il manque ", b("ce type"), " de passage (objectif : 1 salle ET 1 voiture chacun), puis les plus en retard."),`
- Ajouter une section absences après les priorités :

```js
  body.appendChild(el("p", {}, b("Absences :")));
  body.appendChild(el("ul", {},
    li(b("Dernière minute / pas prévenu"), " : marque la chip absente (⊘) sur la carte. Le passage compte quand même pour l'absent (son tour est consommé) ; le remplaçant fait un passage ", b("bonus"), " qui ne lui sera pas décompté."),
    li(b("Prévenu à l'avance"), " : remplace simplement le nom sur la carte — le remplaçant fait un passage normal, l'absent garde sa priorité."),
  ));
```

(Adapter aux helpers locaux réels `li`/`b` du mémo — ils existent déjà dans cette fonction.)

- [ ] **Step 6: Vérification banc (scénario cascade)**

`node --check js/views/planning.js`. Au banc, fixtures spéciales (modifier le stub puis recharger `?fresh=` neuf) : semaine avec — Anna tableau jeudi (salle couverte), Bruno rien, Chloé tableau mercredi + voiture mardi (tout couvert) ; carte voiture vendredi VIDE (`eleves_ids: []`).
1. Cliquer le dé de la carte voiture vendredi.
2. Attendu : les 2 places vont à Bruno (rien eu → rang 1) et Anna (salle mais pas voiture → rang 2). Chloé (tout couvert) n'est PAS prise. Vérifier via `window.STUB.upserts` (dernier upsert planning_entries : `eleves_ids` = ids de Bruno et Anna, ordre libre).
3. « Placer la semaine » sur une semaine vidée : vérifier qu'aucune erreur console et que chaque stagiaire obtient au plus 1 tableau tant que d'autres n'en ont pas (lecture `read_page`).

- [ ] **Step 7: Commit**

```bash
git add js/views/planning.js
git commit -m "feat(placement): cascade par type (1 salle ET 1 voiture chacun) + memo (lot 3)"
```

---

### Task 7: Vérification finale + documentation

**Files:**
- Modify: `PROJECT_NOTES.md` (nouvelle section), `docs/specs/2026-07-19-absences-comptage-placement-design.md` (statut)

**Interfaces:**
- Consumes: banc Task 2, l'ensemble des lots.
- Produces: branche prête à merger.

- [ ] **Step 1: Passe de vérification complète**

1. `node tests/passage-rules.test.mjs` → OK.
2. `node --check` sur : `js/db.js`, `js/passage-rules.js`, `js/views/planning.js` → OK.
3. Banc complet — les 4 scénarios de la spec §10 (stub d'origine, `?fresh=` neuf) :
   - **Compteurs** : `javascript_tool` → `const m = await import("./js/db.js?v=20260719p"); return await m.getSalleAggregats();` → attendu `{1: 2, 2: 1}` (Anna 2 Effectué ; Bruno 1 Absence comptée ; Chloé Bonus absente de la map). Puis `getVoitureAggregats()` → David présent avec `total: 1, avecEleve: 1` (Absence avec_eleve=true comptée).
   - **Marquage + validation** : scénario Task 5 Step 6 rejoué de bout en bout.
   - **Cascade** : scénario Task 6 Step 6 rejoué.
   - **Sélecteur souple** : scénario Task 4 Step 7 (badge « occupé », élève de la même carte proposé).
4. `git status` : arbre propre hormis `_harness*` (non versionnés).

- [ ] **Step 2: Documentation**

- `PROJECT_NOTES.md` : section courte « Absences & comptage (2026-07-19) » — nouvelles règles (Absence compte, Bonus non, marquage ⊘ sur carte, cascade par type), pointeur vers la spec.
- Spec : ligne **Statut** → `implémenté (branche absences-comptage) — en attente merge/deploy`.

- [ ] **Step 3: Commit**

```bash
git add PROJECT_NOTES.md docs/specs/2026-07-19-absences-comptage-placement-design.md
git commit -m "docs: notes projet + statut spec absences/comptage"
```

---

### Task 8: Déploiement + rattrapage semaine du 13/07 (checkpoints utilisateur)

**Files:**
- Modify: dépôt principal `C:\Users\watch\Dev\ECSR\TP_ECSR_App` (merge sur main uniquement)
- PROD Supabase `crpduennbqaemhfaywrz` (migration)

**Interfaces:**
- Consumes: branche `absences-comptage` finie (Tasks 1-7), méthode merge/cache-bust documentée (fiche mémoire « Cache-bust = cause racine des merges cassés »).
- Produces: app live à jour, semaine du 13/07 validée avec les nouvelles règles.

- [ ] **Step 1: CHECKPOINT UTILISATEUR — présenter les résultats du banc et demander le feu vert pour merger/déployer.** Ne rien pousser sans accord explicite.

- [ ] **Step 2: Migration PROD (avant le merge — colonne additive, inoffensive pour le code actuellement en prod)**

Via MCP Supabase `apply_migration`, projet `crpduennbqaemhfaywrz`, nom `add_absences_planning_entries`, SQL du fichier `docs/specs/2026-07-19-absences-migration.sql`. Vérifier ensuite par `execute_sql` : `SELECT absences FROM planning_entries LIMIT 1;` → `[]`.

- [ ] **Step 3: Merge sur main + cache-bust (méthode documentée)**

```bash
git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App pull
git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App merge absences-comptage
```

Puis sur main : run cache-bust SANS pipe (`node scripts/cache-bust.js` en sortie pleine), vérifier la symétrie du diffstat du commit cache-bust, `node --check` des fichiers touchés, vérification navigateur sur la VRAIE app locale `http://localhost:8000` (serveur `ecsr-app`) : planning rend, marquage ⊘ visible, aucune erreur console.

- [ ] **Step 4: CHECKPOINT UTILISATEUR — demander l'accord de push.** Puis `git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App push`, attendre le build Pages (statut `built` sur le bon commit), vérifier le live (jeton `?v=` servi = nouveau).

- [ ] **Step 5: Rattrapage semaine du 13/07 (avec l'utilisateur, sur le live)**

Naviguer sur la semaine du 13/07 : marquer Rita absente (tableau G2 vendredi, sans remplaçant sauf indication contraire de l'utilisateur), traiter Emilie/Céline et les cas du jeudi 16 selon le préavis réel (l'utilisateur tranche : swap simple ou marquage ⊘), puis « Valider la semaine » et vérifier les rows en base (`execute_sql` sur `passages`, dates 2026-07-13 → 2026-07-17).

- [ ] **Step 6: Ménage**

Supprimer le worktree et la branche une fois mergé (`git worktree remove`, `git branch -d absences-comptage`), retirer l'entrée `ecsr-banc-absences` de `.claude/launch.json`, mettre à jour la fiche mémoire `refonte_absences_comptage`.
