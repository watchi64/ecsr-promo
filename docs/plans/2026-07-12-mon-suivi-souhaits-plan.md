# Mon suivi — Souhaits de compétences + historique voiture · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter dans l'onglet « Mon suivi » live la fiche « souhaits de compétences (permis B) » (éditable) et un « historique voiture » en lecture seule, en réutilisant le backend déjà en prod.

**Architecture:** Extension de `js/views/mon-suivi.js` (vanilla JS ES module), 3 fonctions portées dans `js/db.js`, un `export` ajouté dans `js/views/benevoles.js`, styles dans `css/style.css`. **Aucune migration** (table `fiches_suivi`, colonnes `passages.prof_id/avec_eleve` déjà en prod). Vérification navigateur (pas de test-runner).

**Tech Stack:** JavaScript vanilla (ES modules), Supabase (lecture + upsert `fiches_suivi`).

**Spec source:** `docs/specs/2026-07-12-mon-suivi-souhaits-competences-design.md`.

**⚠️ Dépôt partagé :** implémenter dans un **worktree dédié** (skill `superpowers:using-git-worktrees`), branche propre (ex. `mon-suivi-souhaits`), depuis `main`.

**⚠️ Contrainte données :** `fiches_suivi` contient **13 lignes** en prod. Ne jamais écraser la colonne `besoins` (voir Task 1, `upsertFiche`).

**Cache-bust :** tous les imports de `mon-suivi.js` utilisent `?v=20260712f`. Utiliser **ce même token** pour tout nouvel import.

---

## File Structure

- **Modify:** `js/db.js` — ajouter `listFiches`, `getVoitureAggregats`, `upsertFiche` (souhaits uniquement).
- **Modify:** `js/views/benevoles.js` — `export` de `COMPETENCES_REMC`.
- **Modify:** `js/views/mon-suivi.js` — imports + état + 2 sections + câblage `renderFor`.
- **Modify:** `css/style.css` — styles `.suivi-*`.

---

### Task 1: Backend — fonctions db + export de la constante

**Files:**
- Modify: `js/db.js`
- Modify: `js/views/benevoles.js` (ligne `const COMPETENCES_REMC = [`)

- [ ] **Step 1: Ajouter les 3 fonctions dans `js/db.js`**

Ajouter ces fonctions (par ex. juste après `getStats`) :

```js
// === Fiches de suivi (souhaits de compétences permis B) ===
export async function listFiches() {
  const { data, error } = await supabase.from("fiches_suivi").select("*");
  if (error) throw error;
  return data;
}

// N'écrit QUE souhaits : on n'inclut pas `besoins` dans le payload, donc l'upsert
// PostgREST (ON CONFLICT) ne met à jour que souhaits/updated_* et préserve les
// `besoins` des 13 fiches existantes.
export async function upsertFiche({ stagiaire_id, souhaits, updated_by_who }) {
  const { error } = await supabase
    .from("fiches_suivi")
    .upsert(
      { stagiaire_id, souhaits, updated_by_who, updated_at: new Date().toISOString() },
      { onConflict: "stagiaire_id" }
    );
  if (error) throw error;
}

// Agrégats voiture par stagiaire (historique lecture seule). Ignore Absence/Report.
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

- [ ] **Step 2: Exporter `COMPETENCES_REMC` dans `js/views/benevoles.js`**

Trouver la ligne `const COMPETENCES_REMC = [` et la préfixer par `export` :

```js
export const COMPETENCES_REMC = [
```

(seul changement dans ce fichier ; le reste de `benevoles.js` continue de l'utiliser localement.)

- [ ] **Step 3: Vérifier (chargement)**

Démarrer le preview (voir « Vérification »), se connecter. Ouvrir la console, naviguer sur
n'importe quel onglet : **0 erreur** (pas d'erreur d'import/export). Rien de visible ne change encore.

- [ ] **Step 4: Commit**

```bash
git add js/db.js js/views/benevoles.js
git commit -m "db: fonctions fiches_suivi (souhaits only) + export COMPETENCES_REMC"
```

---

### Task 2: mon-suivi.js — sections souhaits + historique

**Files:**
- Modify: `js/views/mon-suivi.js` (imports l.1-4, ajout de fonctions, `renderMonSuivi`/`renderFor`)

- [ ] **Step 1: Compléter les imports (haut du fichier)**

Remplacer les lignes d'import 1–4 par (ajouts en gras : db, `toast`, identity, benevoles) :

```js
import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getJoursOff, getSetting,
         listFiches, upsertFiche, getVoitureAggregats, listProfs } from "../db.js?v=20260712f";
import { el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, compareByNom, toast } from "../utils.js?v=20260712f";
import { HALF_DAYS } from "../config.js?v=20260712f";
import { isAdmin, getProfile } from "../auth-admin.js?v=20260712f";
import { getCurrentWho } from "../identity.js?v=20260712f";
import { COMPETENCES_REMC } from "./benevoles.js?v=20260712f";
```

- [ ] **Step 2: Ajouter l'état partagé + les 2 fonctions de section**

Juste après la ligne `const HALF_ORDER = { matin: 0, aprem: 1 };`, ajouter l'état module :

```js
// Fiches/agrégats/profs : chargés une fois par rendu (indépendants de l'élève sélectionné).
let fiches = [];
let aggregats = {};
let profs = [];
const ficheOf = (sid) => fiches.find((f) => f.stagiaire_id === sid) || { stagiaire_id: sid, souhaits: [] };
```

Puis, avant `export async function renderMonSuivi`, ajouter les deux sections :

```js
function renderFicheSection(id, onSaved) {
  const fiche = ficheOf(id);
  const selected = new Set(fiche.souhaits || []);

  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Mes souhaits de compétences (permis B)"));

  const comps = el("div", { class: "suivi-comps" });
  COMPETENCES_REMC.forEach((c) => {
    const det = el("details", { class: "suivi-comp" });
    const mainCb = el("input", { type: "checkbox" });
    mainCb.checked = selected.has(c.code);
    mainCb.addEventListener("change", () => { mainCb.checked ? selected.add(c.code) : selected.delete(c.code); });
    mainCb.addEventListener("click", (ev) => ev.stopPropagation());  // ne pas replier l'accordéon
    det.appendChild(el("summary", {}, el("label", { class: "suivi-comp-main" }, mainCb, ` ${c.code} · ${c.titre}`)));
    c.sous.forEach(([code, libelle]) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = selected.has(code);
      cb.addEventListener("change", () => { cb.checked ? selected.add(code) : selected.delete(code); });
      det.appendChild(el("label", { class: "suivi-souscomp" }, cb, ` ${code} · ${libelle}`));
    });
    comps.appendChild(det);
  });
  section.appendChild(comps);

  const saveBtn = el("button", { class: "btn primary", onClick: async () => {
    try {
      await upsertFiche({ stagiaire_id: id, souhaits: [...selected].sort(), updated_by_who: getCurrentWho() });
      toast("Souhaits enregistrés", "success", 2000);
      fiches = await listFiches();
      if (onSaved) onSaved();
    } catch (e) { console.error(e); toast(e.message, "error"); }
  } }, "Enregistrer mes souhaits");
  section.appendChild(el("div", { style: "margin-top:0.75rem" }, saveBtn));

  return section;
}

function renderHistoriqueSection(id) {
  const a = aggregats[id] || { total: 0, avecEleve: 0, byProf: {} };
  const profLine = Object.entries(a.byProf)
    .map(([pid, n]) => `${profs.find((p) => p.id === Number(pid))?.nom || "?"} ×${n}`)
    .join(" · ") || "—";
  return el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Historique voiture"),
    el("div", { class: "suivi-histo" },
      el("p", {}, `${a.total} passage(s) · dont ${a.avecEleve} avec élève`),
      el("p", { class: "muted" }, "Formateurs : " + profLine),
    ),
  );
}
```

- [ ] **Step 3: Charger fiches/agrégats/profs dans `renderMonSuivi`**

Dans `renderMonSuivi`, remplacer le bloc :

```js
  let stagiaires = [];
  if (needSelector) stagiaires = (await listStagiaires()).slice().sort(compareByNom);
```

par :

```js
  let stagiaires = [];
  const [fichesData, aggregatsData, profsData] = await Promise.all([
    listFiches(), getVoitureAggregats(), listProfs(),
  ]);
  fiches = fichesData; aggregats = aggregatsData; profs = profsData;
  if (needSelector) stagiaires = (await listStagiaires()).slice().sort(compareByNom);
```

- [ ] **Step 4: Insérer les 2 sections dans `renderFor` (bon ordre)**

Dans `renderFor`, remplacer les deux dernières lignes d'`append` :

```js
    body.appendChild(renderPassagesSection(items));
    body.appendChild(renderChartSection(evaluations));
```

par (ordre : passages → fiche → historique → graphique) :

```js
    body.appendChild(renderPassagesSection(items));
    body.appendChild(renderFicheSection(id, () => renderFor(id)));
    body.appendChild(renderHistoriqueSection(id));
    body.appendChild(renderChartSection(evaluations));
```

- [ ] **Step 5: Vérifier dans le navigateur**

Ouvrir `#/mon-suivi`.
- Section « Mes souhaits de compétences (permis B) » : accordéon C1–C4, cases préremplies
  depuis la fiche de l'élève. Cocher/décocher, cliquer **Enregistrer mes souhaits** → `toast`
  « Souhaits enregistrés ». Recharger l'onglet (ou changer d'élève et revenir) → les cases
  cochées sont **persistées**.
- Section « Historique voiture » : « N passage(s) · dont M avec élève » + ligne Formateurs.
- Admin : changer d'élève via le sélecteur met à jour souhaits + historique + graphique.
- **0 erreur console.**

- [ ] **Step 6: Vérifier la non-régression `besoins`**

Pour un stagiaire dont la fiche a un `besoins` non vide (parmi les 13), enregistrer ses souhaits,
puis contrôler que `besoins` est intact (via l'outil Supabase, requête lecture seule) :

```sql
select stagiaire_id, souhaits, besoins from public.fiches_suivi where stagiaire_id = <ID>;
```

Attendu : `souhaits` mis à jour, `besoins` **inchangé**.

- [ ] **Step 7: Commit**

```bash
git add js/views/mon-suivi.js
git commit -m "mon-suivi: sections souhaits de competences + historique voiture"
```

---

### Task 3: Styles `.suivi-*` + vérification finale

**Files:**
- Modify: `css/style.css` (append en fin de fichier)

- [ ] **Step 1: Ajouter les styles**

Ajouter à la fin de `css/style.css` :

```css
/* ===== Mon suivi — fiche souhaits + historique ===== */
.suivi-histo { background: var(--bg-subtle); border-radius: var(--r); padding: 0.9rem 1.1rem; }
.suivi-comps { margin-top: 0.25rem; }
.suivi-comp { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0.45rem 0.7rem; margin-bottom: 0.5rem; }
.suivi-comp summary { cursor: pointer; }
.suivi-comp-main { font-weight: 600; }
.suivi-souscomp { display: block; padding: 0.25rem 0 0.25rem 1.6rem; }
```

> Variables `--bg-subtle`, `--r`, `--r-sm`, `--line` : ce sont celles utilisées ailleurs dans
> `style.css` (thème « mint » unique). Si l'une n'existe pas, remplacer par l'équivalent présent
> (`--line`/`--bg-elev`/`--accent`).

- [ ] **Step 2: Vérifier le rendu**

Recharger `#/mon-suivi` : l'accordéon des compétences est encadré/lisible, l'historique a un
fond léger, rien ne déborde horizontalement. La section fiche s'intègre entre passages et historique.

- [ ] **Step 3: Vérifier les critères d'acceptation (spec)**

- Souhaits préremplis, éditables, persistés ; `toast` de confirmation.
- Historique voiture affiché (total, avec élève, formateurs).
- Admin : le sélecteur pilote souhaits + historique + graphique.
- `besoins` des fiches existantes préservé (Task 2 step 6).
- Libellés « permis B (C1–C4) », jamais « REMC ». 0 erreur console.

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "mon-suivi: styles fiche souhaits + historique"
```

---

## Vérification (navigateur)

Pas de test-runner. Via le serveur de preview :

1. `.claude/launch.json` : serveur statique servant la racine du repo (ex. `python -m http.server 8000`), puis `preview_start` — ou `preview_start` avec l'URL locale. **Ctrl+Shift+R** après changement (index.html non cache-busté).
2. Se connecter. Tester idéalement un compte **admin** (sélecteur → n'importe quel élève) ; un compte **stagiaire** verrait directement sa propre fiche.
3. Pré-requis données : les 13 fiches existent déjà ; choisir un élève avec passages voiture pour voir l'historique peuplé.
4. Console : **0 erreur** sur `#/mon-suivi`.

> **Cache-bust déploiement :** live = GitHub Pages (`main`). Nouveaux imports au token `?v=20260712f`.
> Au déploiement, suivre la convention du projet (bump du token) pour forcer le rechargement clients.

---

## Self-review (fait à l'écriture)

- **Couverture spec :** db (listFiches/upsertFiche souhaits-only/getVoitureAggregats) → Task 1 ;
  export constante → Task 1 ; sections souhaits + historique + câblage ordre → Task 2 ;
  styles → Task 3 ; non-régression `besoins` → Task 2 step 6. ✔
- **Placeholders :** aucun — code complet à chaque étape. ✔
- **Cohérence des noms :** `fiches`/`aggregats`/`profs`/`ficheOf`, `renderFicheSection(id,onSaved)`,
  `renderHistoriqueSection(id)` définis et appelés dans `renderFor` ; `upsertFiche` sans `besoins`
  cohérent entre db.js (Task 1) et l'appel (Task 2). ✔
- **APIs :** `COMPETENCES_REMC` (c.code/c.titre/c.sous [[code,libelle]]), `profs[].nom`,
  `getCurrentWho`, `toast` — conformes aux usages existants (`suivi.js` de lot3, `benevoles.js`). ✔
- **Aucune migration / aucun changement RLS.** ✔
