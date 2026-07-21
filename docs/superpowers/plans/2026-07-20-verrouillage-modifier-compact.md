# Verrouillage + bouton Modifier + vue compactée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verrouiller les semaines validées (lecture seule totale + vue compactée pour tous), et rendre le planning en lecture seule par défaut pour les admins avec un bouton « Modifier » explicite.

**Architecture:** Tout se joue dans `js/views/planning.js` (vue monolithique existante, on suit le pattern) + `css/style.css`. Un Set `lockedWeeks` chargé depuis la clé KV `semaines_verrouillees` (table `settings`), un booléen `editMode` en mémoire, et un prédicat central `canEditWeek()` qui remplace les gardes `isAdmin()` d'édition. La vue compacte est du filtrage au rendu (lanes/créneaux vides) + une classe CSS `p-compact`.

**Tech Stack:** Vanilla JS (modules ES, imports versionnés `?v=`), Supabase (REST via supabase-js), pas de framework, pas de test runner — la vérification se fait au banc fetch-stub (serveur python port 8123, pilotage `javascript_tool` + `dispatchEvent`).

**Spec:** `docs/specs/2026-07-20-verrouillage-modifier-compact-design.md` (fait foi en cas de doute).

## Global Constraints

- Worktree `C:\Users\watch\Dev\ECSR\TP_ECSR_App_verrou`, branche `verrou-semaine`. **Jamais** de commit sur main ; merge + cache-bust en fin de sujet seulement (jamais piper `cache-bust.js`).
- Aucune migration DB, aucune modification de `js/db.js` (on consomme `getSetting`/`setSetting` existants).
- Clé KV : `semaines_verrouillees`, valeur = JSON `["2026-07-13", ...]` (lundis ISO).
- Les imports gardent le jeton `?v=20260720b` actuel — le cache-bust se fait au merge sur main.
- Libellés exacts : « ✏️ Modifier », « ✓ Terminer », « ✓ Semaine validée », « Déverrouiller », « 🔒 Verrouiller la semaine après enregistrement ».
- `isAdmin()` reste tel quel pour la **visibilité des données** : `loadBenevoles()` (l.2022), persistance `current_week_lundi` (l.2124), bouton « Élèves bénévoles », bouton « Déverrouiller ».
- Fichiers banc (`_harness.html`, `_harness_stub.js`, `_harness_server.py`) : déjà dans `.git/info/exclude` du repo principal (partagé par le worktree) — ne jamais les committer.
- Les numéros de ligne cités sont ceux de `planning.js` @ b14d2a8 ; ils glissent au fil des tâches — se repérer aux ancres de code citées.

---

### Task 1: Recréer le banc fetch-stub dans le worktree

**Files:**
- Create: `_harness_server.py` (racine du worktree)
- Create: `_harness.html` (racine du worktree)
- Create: `_harness_stub.js` (racine du worktree)
- Modify: `.claude/launch.json` du projet parent (entrée port 8123) — via l'outil preview_start

**Interfaces:**
- Produces: banc navigable sur `http://localhost:8123/_harness.html`, app montée avec un utilisateur admin simulé, bascule stagiaire via `window.__HARNESS.setAdmin(false)`, données en mémoire dans `window.__HARNESS.db`.

- [ ] **Step 1: Écrire le serveur python no-store**

```python
# _harness_server.py — serveur statique SANS cache (le pane navigateur cache les
# modules JS malgré tout ; Cache-Control: no-store est OBLIGATOIRE).
import http.server

class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 8123), NoStoreHandler).serve_forever()
```

- [ ] **Step 2: Créer `_harness.html`**

Copier `index.html` en `_harness.html`, puis insérer `<script src="_harness_stub.js"></script>` **avant** la première balise `<script type="module">` (le stub doit remplacer `window.fetch` avant que supabase-js ne charge).

- [ ] **Step 3: Écrire `_harness_stub.js`**

Stub générique : intercepte tout fetch vers Supabase (`/auth/v1/` et `/rest/v1/`), sert des données en mémoire. Table inconnue → `[]` en GET, echo en POST (l'app tolère les listes vides, cf. `renderPlanning` qui catch les stats). Grandes lignes obligatoires :

```js
// _harness_stub.js — stub fetch Supabase pour le banc (jamais committé)
(() => {
  const MONDAY = "2026-07-13";   // semaine de test (écoulée → case verrou cochée d'office)
  const db = {
    user_profiles: [{ id: "u1", email: "prof@test", role: "prof", is_admin: true, is_founder: false }],
    stagiaires: [
      { id: 1, prenom: "Rita", nom: "A", actif: true },
      { id: 2, prenom: "Mickael", nom: "B", actif: true },
      { id: 3, prenom: "Valentin", nom: "C", actif: true },
      { id: 4, prenom: "Emilie", nom: "D", actif: true },
    ],
    profs: [{ id: 10, nom: "Hocine", actif: true }],
    themes: [],
    benevoles: [],
    passages: [],
    fiches_suivi: [],
    planning_half_meta: [],
    planning_jours_off: [],
    settings: [
      { key: "current_week_lundi", value: MONDAY },
      // PAS de semaines_verrouillees au départ : le code doit tolérer null.
    ],
    planning_entries: [
      // Lundi matin : salle remplie (slot 0 lane 0) + lane parallèle VIDE (slot 0 lane 1)
      { id: 100, semaine_lundi: MONDAY, day_index: 0, half_day: "matin", slot: 0, lane: 0,
        activite: "Pédagogie salle", prof_ids: [10], sujet: "Le freinage",
        pedagogue_id: 1, eleves_ids: [2, 3], salle_double: false, absences: [] },
      { id: 101, semaine_lundi: MONDAY, day_index: 0, half_day: "matin", slot: 0, lane: 1,
        activite: null, prof_ids: [], eleves_ids: [], absences: [] },
      // Lundi matin : créneau 1 entièrement vide (slot 1 lane 0)
      { id: 102, semaine_lundi: MONDAY, day_index: 0, half_day: "matin", slot: 1, lane: 0,
        activite: null, prof_ids: [], eleves_ids: [], absences: [] },
      // Lundi aprem : rien du tout (demi-journée vide pour le test compact)
      // Mardi matin : voiture remplie, notes vides (test champs vides)
      { id: 103, semaine_lundi: MONDAY, day_index: 1, half_day: "matin", slot: 0, lane: 0,
        activite: "Voiture", prof_ids: [10], eleves_ids: [4], benevoles_ids: [], absences: [] },
    ],
  };

  const json = (body, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" } }));

  // Filtres PostgREST minimaux : ?col=eq.val et ?col=in.(a,b)
  function applyFilters(rows, params) {
    let out = rows;
    for (const [k, v] of params.entries()) {
      if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
      if (v.startsWith("eq.")) { const val = v.slice(3); out = out.filter((r) => String(r[k]) === val); }
      else if (v.startsWith("gte.")) { const val = v.slice(4); out = out.filter((r) => String(r[k]) >= val); }
      else if (v.startsWith("lte.")) { const val = v.slice(4); out = out.filter((r) => String(r[k]) <= val); }
      else if (v.startsWith("in.")) { const vals = v.slice(4, -1).split(","); out = out.filter((r) => vals.includes(String(r[k]))); }
    }
    return out;
  }

  let nextId = 1000;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!/supabase|\/auth\/v1\/|\/rest\/v1\//.test(url)) return realFetch(input, init);
    const u = new URL(url, location.origin);
    const method = (init.method || "GET").toUpperCase();

    if (u.pathname.includes("/auth/v1/")) {
      // Session factice : token + user. supabase-js accepte un objet user minimal.
      return json({ access_token: "fake", token_type: "bearer", expires_in: 3600,
        refresh_token: "fake", user: { id: "u1", email: "prof@test" } });
    }
    if (u.pathname.includes("/rest/v1/rpc/")) return json([]);  // benevoles_noms & co

    const table = u.pathname.split("/rest/v1/")[1]?.split("?")[0];
    const rows = db[table] || [];
    if (method === "GET" || method === "HEAD") {
      const out = applyFilters(rows, u.searchParams);
      // maybeSingle() envoie Accept: application/vnd.pgrst.object+json
      const accept = (init.headers?.["Accept"] || init.headers?.["accept"] || "");
      if (accept.includes("object")) return out.length ? json(out[0]) : json(null, 200);
      return json(out);
    }
    if (method === "POST") {  // insert / upsert
      const body = JSON.parse(init.body || "[]");
      const list = Array.isArray(body) ? body : [body];
      const saved = list.map((r) => {
        // upsert : remplace si même id (planning_entries) ou même key (settings)
        const keyCol = table === "settings" ? "key" : "id";
        const existing = r[keyCol] != null && rows.find((x) => x[keyCol] === r[keyCol]);
        if (existing) { Object.assign(existing, r); return existing; }
        const row = { id: nextId++, ...r };
        rows.push(row);
        if (!db[table]) db[table] = rows;
        return row;
      });
      return json(saved, 201);
    }
    if (method === "PATCH") {
      const body = JSON.parse(init.body || "{}");
      applyFilters(rows, u.searchParams).forEach((r) => Object.assign(r, body));
      return json([]);
    }
    if (method === "DELETE") {
      const gone = applyFilters(rows, u.searchParams);
      db[table] = rows.filter((r) => !gone.includes(r));
      return json([]);
    }
    return json([]);
  };

  window.confirm = () => true;   // Vider / remélanger passent sans dialogue
  window.__HARNESS = {
    db,
    setAdmin(v) { db.user_profiles[0].is_admin = v; db.user_profiles[0].role = v ? "prof" : "stagiaire"; },
  };
})();
```

- [ ] **Step 4: Lancer et vérifier**

`preview_start` sur une entrée launch.json `{ "name": "ecsr-banc-verrou", "runtimeExecutable": "python", "runtimeArgs": ["_harness_server.py"], "port": 8123 }` (cwd = worktree), puis naviguer sur `http://localhost:8123/_harness.html`.
⚠️ Gotchas connus (fiche mémoire) : screenshots et clics par coordonnées inutilisables sur cette app (viewport 1009×32) → **tout** piloter en `javascript_tool` + `dispatchEvent` ; erreurs console « loadDirectories failed » ×4 au boot = bruit bénin du stub ; le faux-positif « [object Object] » lié à l'origine localhost est connu — ignorer.

Vérif : `document.querySelector(".p-day-card") !== null` et la carte « Pédagogie salle » visible dans le DOM. Adapter le stub (auth, colonnes manquantes) jusqu'à ce que la vue planning se monte — c'est le seul objectif de cette tâche.

- [ ] **Step 5: Vérifier que git ignore bien les 3 fichiers**

Run: `git status --short` → aucun fichier `_harness*` listé.

- [ ] **Step 6: Commit (rien à committer normalement — sinon STOP, un fichier banc a fui)**

---

### Task 2: État verrou + mode édition + prédicats

**Files:**
- Modify: `js/views/planning.js` (état module l.20-32, `loadPlanning` l.2029, `changeWeek` l.2116, `renderPlanning` l.2986)

**Interfaces:**
- Produces: `isLocked(lundi) → bool`, `canEditWeek() → bool`, `setWeekLock(lundi, locked) → Promise` (persiste la clé KV + met à jour le Set), variables module `editMode` (bool) et `lockedWeeks` (Set). Les tâches 3-6 consomment exclusivement ces quatre noms.

- [ ] **Step 1: Ajouter l'état et les prédicats**

Après `let currentContainer = null;` (l.32) :

```js
// === Verrouillage des semaines validées + mode édition explicite (spec 2026-07-20) ===
let lockedWeeks = new Set();  // lundis ISO verrouillés (clé settings `semaines_verrouillees`)
let editMode = false;         // édition explicite (bouton Modifier), par semaine affichée

function isLocked(lundi) { return lockedWeeks.has(lundi); }

// Prédicat central d'édition : admin + mode édition actif + semaine non verrouillée.
// Remplace les gardes isAdmin() partout où il s'agit d'ÉDITER la semaine affichée.
function canEditWeek() { return isAdmin() && editMode && !isLocked(semaineLundi); }

async function setWeekLock(lundi, locked) {
  if (locked) lockedWeeks.add(lundi); else lockedWeeks.delete(lundi);
  await setSetting("semaines_verrouillees", JSON.stringify([...lockedWeeks].sort()));
}
```

- [ ] **Step 2: Charger la clé au chargement de la semaine**

Dans `loadPlanning()` (l.2029), ajouter la lecture à la `Promise.all` existante :

```js
async function loadPlanning() {
  const [data, metas, offs, lockedRaw] = await Promise.all([
    getPlanning(semaineLundi),
    getHalfMetaForWeek(semaineLundi),
    getJoursOff(semaineLundi),
    getSetting("semaines_verrouillees").catch(() => null),  // clé absente → null
  ]);
  try { lockedWeeks = new Set(JSON.parse(lockedRaw || "[]")); }
  catch { lockedWeeks = new Set(); }
  ...reste inchangé...
}
```

- [ ] **Step 3: Réarmer la lecture seule à chaque navigation**

Dans `changeWeek` (l.2116), première ligne du corps : `editMode = false;`.
Dans `renderPlanning` (l.2986), avant `await loadPlanning()` : `editMode = false;`.

- [ ] **Step 4: Vérifier au banc**

Recharger `_harness.html`, puis en `javascript_tool` :

```js
// La clé n'existe pas encore → Set vide, pas d'erreur console au chargement.
JSON.stringify([window.__HARNESS.db.settings.map(s => s.key)])
```
Expected: pas de `semaines_verrouillees`, vue montée sans erreur.

- [ ] **Step 5: Commit**

```bash
git add js/views/planning.js
git commit -m "feat(planning): état verrou semaines + mode édition (prédicats canEditWeek/isLocked)"
```

---

### Task 3: Basculer les gardes d'édition sur canEditWeek()

**Files:**
- Modify: `js/views/planning.js` — sites listés ci-dessous

**Interfaces:**
- Consumes: `canEditWeek()` (Task 2).
- Produces: vue admin en lecture seule par défaut (classe `read-only` posée) ; toutes les écritures refusées hors mode édition.

- [ ] **Step 1: Remplacer les gardes d'ÉDITION**

| Site (@ b14d2a8) | Avant | Après |
|---|---|---|
| `saveEntry` l.199 | `if (!isAdmin()) return;` | `if (!canEditWeek()) { console.warn("saveEntry refusé : semaine verrouillée ou lecture seule"); return; }` |
| `beginCardDrag` l.359 | `if (!isAdmin()) return;` | `if (!canEditWeek()) return;` |
| `clearWeekPlacements` l.1114 | (pas de garde) | `if (!canEditWeek()) return;` en première ligne |
| `autoPlaceWeek` (chercher `async function autoPlaceWeek`) | (pas de garde) | `if (!canEditWeek()) return;` en première ligne |
| `deleteCell` l.1145 | `if (!isAdmin()) return;` | `if (!canEditWeek()) return;` |
| `saveHalfMeta` l.2046 | (pas de garde) | `if (!canEditWeek()) return;` en première ligne |
| `disableDay` l.2132 / `enableDay` l.2148 | `if (!isAdmin()) return;` | `if (!canEditWeek()) return;` |
| `renderDayCard` l.1934 | `const admin = isAdmin();` | `const admin = canEditWeek();` (gouverne les toggles jour on/off) |
| `p-half-head` l.1977 | `const headBtn = isAdmin() ? bouton : div` | `canEditWeek() ? bouton : div` |
| `renderInto` l.2511-2512 | `const admin = isAdmin(); container.classList.toggle("read-only", !admin);` | `const admin = isAdmin(); const editing = canEditWeek(); container.classList.toggle("read-only", !editing);` |
| eyebrow l.2519 | `(admin ? "Édition" : "Consultation")` | `(editing ? "Édition" : "Consultation")` |
| subtitle l.2521-2525 | ternaire sur `admin` | ternaire sur `editing` ; en lecture seule admin, texte : `"Lecture seule. Clique « Modifier » pour éditer la semaine."` si `admin`, sinon texte stagiaire actuel |

**Ne PAS toucher** : `loadBenevoles` l.2022, `changeWeek` l.2124 (`setSetting current_week_lundi`), et les usages `isAdmin()` de la toolbar (traités en Task 4).

- [ ] **Step 2: Vérifier au banc (lecture seule par défaut)**

```js
document.querySelector(".view-container, main")  // repérer le conteneur de vue
document.querySelector(".read-only") !== null    // → true : admin ouvre en lecture seule
document.querySelectorAll(".p-add-suite").length // boutons rendus mais masqués par CSS
```
Expected: classe `read-only` présente, eyebrow « Consultation · … ».

- [ ] **Step 3: Vérifier le backstop**

Les modules ne sont pas accessibles depuis la console (pas d'export global) — le backstop se teste par l'UI : forcer `editMode` impossible sans bouton (Task 4), donc vérifier simplement qu'aucune écriture ne part : interagir avec un select de carte via `dispatchEvent` → `window.__HARNESS.db.planning_entries` inchangé (pointer-events none + garde).

- [ ] **Step 4: Commit**

```bash
git add js/views/planning.js
git commit -m "feat(planning): lecture seule par défaut — gardes d'édition sur canEditWeek()"
```

---

### Task 4: Toolbar à 3 états (Modifier / Terminer / badge + Déverrouiller)

**Files:**
- Modify: `js/views/planning.js` — `renderInto`, bloc toolbar l.2552-2591
- Modify: `css/style.css` — styles badge + bouton discret

**Interfaces:**
- Consumes: `canEditWeek()`, `isLocked()`, `setWeekLock()`, `editMode`.
- Produces: fonctions locales `enterEditMode()` / `exitEditMode()` (re-render), bouton « Déverrouiller » → `unlockWeek()`.

- [ ] **Step 1: Réécrire le bloc toolbar**

Remplacer les quatre `if (admin) {...}` (l.2557-2589) par une logique à 3 états. `admin = isAdmin()`, `locked = isLocked(semaineLundi)`, `editing = canEditWeek()` :

```js
if (admin && locked) {
  // — Semaine verrouillée : badge + Déverrouiller (l'édition passe par le déverrouillage)
  weekBar.appendChild(el("span", { class: "p-locked-badge", title: "Semaine validée et verrouillée" },
    "✓ Semaine validée"));
  weekBar.appendChild(el("button", { class: "btn small ghost p-unlock-btn",
    title: "Retirer le verrou et passer en édition",
    onClick: async () => {
      await setWeekLock(semaineLundi, false);
      editMode = true;             // déverrouiller = on vient corriger → édition directe
      renderInto(currentContainer);
    } }, "Déverrouiller"));
} else if (admin && !editing) {
  // — Lecture seule (défaut) : Modifier + banque bénévoles
  const editBtn = el("button", { class: "btn small primary",
    onClick: () => { editMode = true; renderInto(currentContainer); } });
  editBtn.appendChild(document.createTextNode("✏️ Modifier"));
  weekBar.appendChild(editBtn);
  weekBar.appendChild(bnvBtn());   // « Élèves bénévoles » (extraire l'actuel en helper)
} else if (admin && editing) {
  // — Mode édition : Terminer + les 4 boutons actuels
  const doneBtn = el("button", { class: "btn small",
    onClick: () => { editMode = false; renderInto(currentContainer); } }, "✓ Terminer");
  weekBar.appendChild(doneBtn);
  weekBar.appendChild(bnvBtn());
  ...boutons Placer / Vider / Valider inchangés (mêmes conditions internes,
     y compris `semaineLundi <= isoDate(new Date())` pour Valider)...
}
// Stagiaire sur semaine verrouillée : badge informatif seul
if (!admin && locked) {
  weekBar.appendChild(el("span", { class: "p-locked-badge" }, "✓ Semaine validée"));
}
weekBar.appendChild(printBtn);   // Imprimer/PDF : toujours, comme aujourd'hui
```

`bnvBtn()` = extraction du bouton « Élèves bénévoles » actuel (l.2559-2565) en petite fonction locale pour ne pas dupliquer le onClick.

- [ ] **Step 2: CSS badge + bouton discret**

À la fin de la section planning de `css/style.css` (près des styles `.week-bar`) :

```css
/* Verrouillage semaine : badge + déverrouillage discret */
.p-locked-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.82rem; font-weight: 600; padding: 0.25rem 0.6rem;
  border-radius: 999px; background: var(--success-bg, #e7f6ec);
  color: var(--success-fg, #1d7a3f); white-space: nowrap;
}
.p-unlock-btn { opacity: 0.75; }
.p-unlock-btn:hover { opacity: 1; }
```

(vérifier si des variables `--success-*` existent déjà dans le fichier ; sinon garder les fallbacks littéraux ci-dessus, cohérents avec la palette mint de l'app).

- [ ] **Step 3: Vérifier au banc — cycle complet**

```js
// 1. lecture seule : bouton Modifier présent, pas les 4 boutons
[...document.querySelectorAll(".week-bar button")].map(b => b.textContent.trim())
// Expected: contient "✏️ Modifier", pas "🎲 Placer la semaine"
// 2. clic Modifier
document.evaluate('//button[contains(., "Modifier")]', document).iterateNext()
  .dispatchEvent(new MouseEvent("click", { bubbles: true }));
// 3. re-lister : "✓ Terminer", "🎲 Placer la semaine", "Valider la semaine" présents,
//    classe read-only absente
// 4. clic Terminer → retour lecture seule
// 5. navigation semaine suivante en mode édition → la nouvelle semaine est en lecture seule
```

- [ ] **Step 4: Vérifier le verrou à la main**

```js
// Simuler un verrou posé (le flux modale arrive en Task 5) :
window.__HARNESS.db.settings.push({ key: "semaines_verrouillees", value: '["2026-07-13"]' });
// naviguer semaine suivante puis revenir (recharge loadPlanning) → badge + Déverrouiller,
// classe read-only présente, PAS de bouton Modifier.
// Clic Déverrouiller → mode édition direct (Terminer visible), badge disparu.
```

- [ ] **Step 5: Commit**

```bash
git add js/views/planning.js css/style.css
git commit -m "feat(planning): toolbar 3 états — Modifier/Terminer, badge Semaine validée + Déverrouiller"
```

---

### Task 5: Case verrou dans la modale « Valider la semaine » + Ctrl+Z

**Files:**
- Modify: `js/views/planning.js` — `renderValiderModal` (l.2262-2434)

**Interfaces:**
- Consumes: `setWeekLock()`, `editMode`, `recordUndo` (existant, l.15).
- Produces: verrouillage effectif à l'enregistrement ; l'undo de validation délocke et repasse en édition.

- [ ] **Step 1: Ajouter la case à cocher**

Dans `renderValiderModal`, avant `const cancelBtn` (l.2343) :

```js
// Verrou : coché d'office si le vendredi de la semaine est écoulé (semaine finie),
// décoché si validation en milieu de semaine (jours restants encore à planifier).
const fridayIso = isoDate(addDays(new Date(semaineLundi + "T00:00:00"), 4));
const lockCb = el("input", { type: "checkbox", id: "valider-lock-cb" });
lockCb.checked = isoDate(new Date()) > fridayIso;
const lockRow = el("label", { class: "valider-lock-row", for: "valider-lock-cb" },
  lockCb, " 🔒 Verrouiller la semaine après enregistrement");
```

et ajouter `lockRow` dans le modal entre `list` et `modal-actions` (l.2427).

- [ ] **Step 2: Verrouiller à l'enregistrement + étendre l'undo**

Dans `save()` (l.2346), après le `recordUndo(...)` existant — remplacer le bloc :

```js
      const wantLock = lockCb.checked;
      if (wantLock) {
        await setWeekLock(semaineLundi, true);
        editMode = false;
      }

      recordUndo("validation de la semaine", async () => {
        if (insertedIds.length) await deletePassagesBatch(insertedIds);
        for (const u of themeUndo) {
          await updateTheme(u.theme.id, { statut: u.prev.statut, date_fait: u.prev.date_fait });
          u.theme.statut = u.prev.statut;
          u.theme.date_fait = u.prev.date_fait;
        }
        // Le verrou suit la validation qu'il accompagne (spec) ; retour en édition.
        if (wantLock) {
          await setWeekLock(semaineLundi, false);
          editMode = true;
        }
        renderInto(currentContainer);
      });
      backdrop.remove();
      if (wantLock) renderInto(currentContainer);   // bascule badge + read-only + compact
```

(l'ordre : poser le verrou AVANT recordUndo pour que `wantLock` soit capturé ; le `recordUndo` existant ne re-rendait pas — l'ajout du `renderInto` dans l'undo est nécessaire pour faire disparaître badge/verrou à l'écran).

- [ ] **Step 3: CSS de la ligne**

```css
.valider-lock-row { display: flex; align-items: center; gap: 0.45rem;
  margin: 0.6rem 0 0; font-size: 0.88rem; cursor: pointer; user-select: none; }
```

- [ ] **Step 4: Vérifier au banc**

```js
// Semaine de test = 2026-07-13, vendredi 17 écoulé → case cochée d'office.
// 1. Mode édition → clic "Valider la semaine" → la modale liste le passage salle
//    (pedagogue Rita) ; la case 🔒 est cochée.
// 2. Clic Enregistrer → db.settings contient semaines_verrouillees=["2026-07-13"],
//    la vue re-render : badge + Déverrouiller, read-only.
window.__HARNESS.db.settings.find(s => s.key === "semaines_verrouillees")
// 3. Ctrl+Z :
document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
// → passages supprimés du stub, semaines_verrouillees redevient [], mode édition actif.
```

- [ ] **Step 5: Commit**

```bash
git add js/views/planning.js css/style.css
git commit -m "feat(planning): case verrou dans Valider la semaine, Ctrl+Z délocke"
```

---

### Task 6: Vue compactée des semaines verrouillées

**Files:**
- Modify: `js/views/planning.js` — `renderInto`, `renderDayCard` (l.1931), `renderSlotRow` (chercher `function renderSlotRow`), `renderLaneCell` (l.1690)
- Modify: `css/style.css` — section `.p-compact`

**Interfaces:**
- Consumes: `isLocked()`, `entryHasContent(e)` (existant l.2641, écrit pour le print — les déclarations de fonction sont hoistées, utilisable partout dans le module).
- Produces: classe `p-compact` sur le conteneur ; créneaux/lanes/demi-journées vides absents du DOM ; classe `is-empty` sur les blocs de carte sans valeur.

- [ ] **Step 1: Poser la classe et filtrer les lanes/créneaux**

Dans `renderInto`, à côté du toggle `read-only` : `container.classList.toggle("p-compact", isLocked(semaineLundi));`.

Dans `renderDayCard` (l.1994-1999), quand `isLocked(semaineLundi)` :

```js
    let rows = rowsFor(d, half.key);
    const compact = isLocked(semaineLundi);
    if (compact) {
      // Vue compacte : on ne garde que les lanes avec contenu, puis les créneaux non vides.
      rows = rows
        .map((r) => ({ ...r, lanes: r.lanes.filter(entryHasContent) }))
        .filter((r) => r.lanes.length > 0);
    }
    const allLanes = rows.flatMap((r) => r.lanes.map((e) => e.lane ?? 0));
    ...
```

et en compact, re-numéroter les lanes restantes pour que la grille se resserre
(la carte pleine reprend la largeur) :

```js
    if (compact) rows.forEach((r) => r.lanes.forEach((e, i) => { e._laneRender = i; }));
```

Dans `renderSlotRow`, utiliser `entry._laneRender ?? entry.lane ?? 0` pour `gridColumn`, et dans `renderDayCard` calculer `maxLanes` sur les lanes retenues. **Ne jamais muter `entry.lane`** (champ persisté) — d'où le champ de rendu `_laneRender`.

Demi-journée vide en compact : si `rows.length === 0`, n'ajouter QUE le `headBtn` (bandeau), pas `slotsWrap` :

```js
    section.appendChild(headBtn);
    if (!compact || rows.length > 0) section.appendChild(slotsWrap);
```

- [ ] **Step 2: Marquer les champs vides des cartes**

À la fin de `renderLaneCell` (l.1690+), juste avant le `return`, quand `isLocked(semaineLundi)` — inspection DOM générique (robuste pour toutes les formes d'activité, salle double comprise) :

```js
  if (isLocked(semaineLundi)) {
    // Vue compacte : masque les blocs sans valeur (spec 2026-07-20, mêmes règles que le print)
    cell.querySelectorAll(".p-lane-sujet").forEach((elx) => {
      if (!elx.querySelector(".sujet-chip") && !elx.textContent.trim()) elx.classList.add("is-empty");
    });
    cell.querySelectorAll(".p-lane-role").forEach((elx) => {
      const disp = elx.querySelector(".person-display, .chips-display");
      const hasVal = disp && disp.textContent.trim() && !disp.textContent.includes("+ ");
      if (!hasVal) elx.classList.add("is-empty");
    });
    cell.querySelectorAll(".p-lane-notes").forEach((elx) => {
      const input = elx.querySelector("input");
      if (!input || !input.value.trim()) elx.classList.add("is-empty");
    });
    cell.querySelectorAll(".p-lane-prof-wrap").forEach((elx) => {
      const sel = elx.querySelector("select");
      const chips = elx.querySelector(".chips-display");
      const hasVal = (sel && sel.value) || (chips && chips.textContent.trim() && !chips.textContent.includes("+ "));
      if (!hasVal) elx.classList.add("is-empty");
    });
  }
```

⚠️ Les placeholders des displays vides commencent par « + » (« + stagiaires », « + note ») — c'est le marqueur utilisé ci-dessus ; vérifier au banc le texte exact des displays vides et ajuster le test `includes("+ ")` si besoin.

- [ ] **Step 3: CSS compact**

Nouvelle section en fin de la partie planning de `css/style.css` :

```css
/* ============================================================
   Vue compacte (semaine verrouillée) : le vide disparaît,
   les espacements se resserrent — spec 2026-07-20.
   ============================================================ */
.p-compact .is-empty { display: none !important; }
.p-compact .p-lane-cell { padding: 0.4rem 0.55rem; }
.p-compact .p-slots-wrap { gap: 0.35rem; }
.p-compact .p-day-content { gap: 0.4rem; }
.p-compact .p-half { padding-bottom: 0.3rem; }
.p-compact .p-lane-body { gap: 0.25rem; }
```

(ajuster les valeurs au banc : l'objectif visuel est « nettement plus dense sans rien perdre » ; comparer avec les paddings actuels de ces classes avant de choisir).

- [ ] **Step 4: Vérifier au banc**

Avec `semaines_verrouillees=["2026-07-13"]` (posé via la modale ou le stub) :

```js
// Lundi matin : le créneau vide (slot 1) et la lane parallèle vide ont disparu
document.querySelectorAll(".p-day-card")[0].querySelectorAll(".p-lane-cell").length  // → 1
// La carte pleine occupe la 1re colonne d'une grille à 1 lane
getComputedStyle(document.querySelectorAll(".p-day-card")[0].querySelector(".p-lanes")).gridTemplateColumns
// Lundi aprem : bandeau APRÈS-MIDI présent, aucune zone de créneaux
// Mardi : carte Voiture sans ligne notes ni blocs vides (classes is-empty posées)
document.querySelectorAll(".p-compact .is-empty").length > 0  // → true
// Vue stagiaire : window.__HARNESS.setAdmin(false) + re-naviguer → compact + badge, 0 bouton admin
```

- [ ] **Step 5: Commit**

```bash
git add js/views/planning.js css/style.css
git commit -m "feat(planning): vue compacte des semaines verrouillées (vide masqué, espaces resserrés)"
```

---

### Task 7: Passe de vérification complète au banc

**Files:** aucun nouveau — corrections éventuelles dans `js/views/planning.js` / `css/style.css`.

**Interfaces:** consume tout ; produit le GO pour la démo utilisateur.

- [ ] **Step 1: Dérouler les 8 scénarios de la spec** (section « Tests (banc fetch-stub) » de `docs/specs/2026-07-20-verrouillage-modifier-compact-design.md`), dans l'ordre, en notant PASS/FAIL pour chacun :

1. Ouverture lecture seule + cycle Modifier/Terminer (barre conforme au tableau des 3 états).
2. Changement de semaine en mode édition → nouvelle semaine en lecture seule.
3. Valider avec case cochée → badge + Déverrouiller + `read-only` + `p-compact` + clé KV à jour.
4. Ctrl+Z → verrou retiré + mode édition.
5. Backstop `saveEntry` sur semaine verrouillée (aucune écriture dans le stub).
6. Compact : créneau vide masqué, lane vide masquée + pleine largeur, demi-journée vide = bandeau seul, champs vides masqués, jour FERMÉ intact (poser un `planning_jours_off` dans le stub pour ce point).
7. Vue stagiaire (`setAdmin(false)`) : compact + badge, aucun bouton.
8. Case de la modale : cochée pour une semaine écoulée ; décochée pour la semaine courante (changer `MONDAY` du stub ou naviguer sur la semaine en cours et créer une carte).

- [ ] **Step 2: Corriger ce qui casse, re-dérouler le scénario concerné, committer les correctifs** (`fix(planning): ...`).

- [ ] **Step 3: Nettoyage repérages** — vérifier qu'aucun `console.log` de debug ni fichier parasite ne traîne : `git status --short` propre, `git diff main --stat` ne liste que `js/views/planning.js`, `css/style.css`, `docs/`.

- [ ] **Step 4: STOP — démo utilisateur.** Présenter le résultat (captures du banc via lecture DOM, description des états) et attendre le **GO explicite** avant tout merge sur main. La procédure de merge (cache-bust sur main uniquement, jamais piper `cache-bust.js`, vérif navigateur post-merge, push sur GO, vérif Pages/live, ménage worktree) est documentée dans les fiches mémoire `ecsr-cache-bust-merge-conflicts` et `salle-demi-journee` — la suivre telle quelle.

---

### Task 8: Ergonomie du mode édition (volet 4, ajout validé le 20/07)

**Files:**
- Modify: `js/views/planning.js` — `renderInto` (pill, liseré, hint), niveau module (Échap)
- Modify: `css/style.css` — `.p-edit-pill`, `.p-editing .p-days`
- Modify: `_harness_stub.js` — carte salle 2 groupes (preuve note vide masquée en compact)

**Interfaces:** consume `canEditWeek()`, `isLocked()`, `editMode`, `toast` (utils, déjà importé).

- [ ] **Step 1: Pill flottante + liseré + hint dans `renderInto`** — après le toggle `p-compact` :
  `container.classList.toggle("p-editing", editing)` ; si `editing`, appendre au conteneur
  `div.p-edit-pill` (« ✏️ Édition en cours » + bouton « ✓ Terminer » → `editMode = false; renderInto`).
  Sur la zone `wrap` (`.p-days`) : si `admin && !editing`, listener click → toast throttlé
  (module `let lastHintAt = 0`, 5000 ms) avec message selon `isLocked(semaineLundi)`.
- [ ] **Step 2: Échap** — listener `keydown` module unique (drapeau `escListenerSet`) :
  `key === "Escape" && editMode && currentContainer?.isConnected && !document.querySelector(".modal-backdrop")`
  et cible hors input/textarea/select → `editMode = false; renderInto(currentContainer)`.
- [ ] **Step 3: CSS** — pill fixed bottom-center (fond accent, texte clair, ombre douce,
  `@media print { display: none }`), liseré `.p-editing .p-days { outline: 2px dashed …accent
  translucide…; outline-offset: 6px; border-radius }`.
- [ ] **Step 4: Banc** — pill présente en édition seulement ; liseré idem ; toast au clic en
  lecture seule (2 messages selon verrou, throttle vérifié) ; Échap sort du mode mais pas
  modale ouverte ; stagiaire : ni pill ni toast ; carte salle double verrouillée : « + note »
  vide absente.
- [ ] **Step 5: Commit** `feat(planning): ergonomie du mode édition (pill flottante, liseré, hint, Échap)`

### Task 9: Épuration hors mode édition + fix ⊘ (volet 5, validé le 20/07 après déploiement)

**Files:**
- Modify: `js/views/planning.js` — `renderInto` (toggle `p-compact`), `renderDayCard` (`compact`),
  `renderSlotRow` (`laneIdx`), `renderLaneCell` (marquage `is-empty`)
- Modify: `css/style.css` — groupe `.read-only` (ajout `.p-abs-btn`)

**Interfaces:** consume `canEditWeek()`. Le prédicat `isLocked()` reste utilisé pour le badge,
la toolbar et les messages, mais **plus** pour décider du compactage.

- [ ] **Step 1: Basculer les 4 sites de compactage sur `!canEditWeek()`**

Dans `renderInto` : `container.classList.toggle("p-compact", !canEditWeek())`.
Dans `renderDayCard` : `const compact = !canEditWeek();`.
Dans `renderSlotRow` : `const laneIdx = (canEditWeek() ? entry.lane : (entry._laneRender ?? entry.lane)) ?? 0;`
Dans `renderLaneCell` : la garde du marquage `is-empty` devient `if (!canEditWeek()) { … }`.

- [ ] **Step 2: Ajouter `.p-abs-btn` au groupe masqué en lecture seule**

```css
.read-only .p-dice-btn,
.read-only .p-abs-btn,
```
(inséré dans la liste existante qui se termine par `.read-only .p-dice-picker { display: none !important; }`)

- [ ] **Step 3: Vérifier au banc**

Admin lecture seule semaine normale : créneau vide absent, lane vide absente, demi-journée vide
réduite au bandeau, champs vides masqués, `.p-abs-btn` absent du rendu visible.
Clic « Modifier » : tout revient (cartes vides, ⊘, champs). Semaine verrouillée : inchangée.
Stagiaire : compact sur semaine remplie ET sur semaine vierge (jours + bandeaux seuls), zéro ⊘.

- [ ] **Step 4: Commit**

```bash
git add js/views/planning.js css/style.css
git commit -m "feat(planning): épuration hors mode édition + fix bouton absence visible en lecture seule"
```

## Self-review (fait à l'écriture du plan)

- **Couverture spec** : volet 1 → Tasks 2, 4 (badge/Déverrouiller), 5 (modale + Ctrl+Z), 3 (backstop) ; volet 2 → Tasks 2, 3, 4 ; volet 3 → Task 6 ; les 8 scénarios de test → Task 7. Cas limites : double onglet = comportement assumé par la spec (pas de code) ; semaine future = condition existante du bouton Valider conservée (Task 4).
- **Placeholders** : aucun TBD ; les deux points signalés « vérifier au banc » (texte des placeholders « + », valeurs CSS) sont des calibrages explicites, pas des trous de conception.
- **Cohérence des noms** : `isLocked` / `canEditWeek` / `setWeekLock` / `editMode` / `lockedWeeks` / `_laneRender` / `p-compact` / `is-empty` / `p-locked-badge` — utilisés à l'identique dans toutes les tâches.
