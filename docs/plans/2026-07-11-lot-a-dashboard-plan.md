# Lot A — Tableau de bord épuré · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer toute trace de notes du Tableau de bord pour en faire un pur lieu de centralisation des passages (priorités + historique).

**Architecture:** Édition d'un seul fichier de vue (`js/views/dashboard.js`), en JS vanilla ES modules. Aucune donnée ni RLS modifiée. Vérification dans le navigateur via le serveur de preview (pas de test-runner dans ce projet).

**Tech Stack:** JavaScript vanilla (ES modules), Supabase (lecture seule), pas de build.

**Spec source:** `docs/specs/2026-07-11-mon-suivi-et-dashboard-design.md` (Chantier A).

**⚠️ Dépôt partagé :** `TP_ECSR_App` est partagé entre plusieurs chats. Implémenter ce lot
dans un **worktree dédié** (skill `superpowers:using-git-worktrees`), sur une branche propre
(ex. `lot-a-dashboard-notes`).

---

## File Structure

- **Modify:** `js/views/dashboard.js` — retirer notes (import, calcul, pastille, tris).
- **Modify (optionnel):** le CSS contenant `.avg-pill` (nettoyage de style mort) — à localiser par recherche.

Un seul fichier de logique change. Découpage en tâches par nature de suppression, pour des commits atomiques et vérifiables.

---

### Task 1: Retirer les tris « par note »

**Files:**
- Modify: `js/views/dashboard.js` (SORT_OPTIONS ~l.6-12, `sortEnriched` ~l.16-38, garde `currentSort` ~l.14)

- [ ] **Step 1: Retirer les 2 options de tri par note**

Dans `SORT_OPTIONS`, supprimer les deux lignes `note-desc` et `note-asc`. Résultat attendu :

```js
const SORT_OPTIONS = [
  { key: "priorite",   label: "Priorité de passage" },
  { key: "alpha",      label: "Alphabétique" },
  { key: "passages",   label: "Plus de passages d'abord" },
];
```

- [ ] **Step 2: Retirer les `case` correspondants dans `sortEnriched`**

Supprimer les blocs `case "note-desc":` et `case "note-asc":` (lignes ~22-27). Le reste
(`alpha`, `passages`, `priorite`/`default`) reste inchangé.

- [ ] **Step 3: Blinder le tri persistant**

`currentSort` est lu depuis `localStorage`. Si une valeur retirée y traîne (`note-desc`/`note-asc`),
retomber sur `"priorite"`. Remplacer la ligne d'init :

```js
const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.key));
let currentSort = localStorage.getItem("ecsr_dash_sort");
if (!VALID_SORTS.has(currentSort)) currentSort = "priorite";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Démarrer le preview (voir « Vérification » en fin de plan), ouvrir `#/dashboard`.
Attendu : le menu « Trier par » ne propose plus que Priorité / Alphabétique / Plus de passages.
Aucune erreur console. Changer de tri fonctionne.

- [ ] **Step 5: Commit**

```bash
git add js/views/dashboard.js
git commit -m "dashboard: retire les tris par note"
```

---

### Task 2: Retirer la pastille moyenne des cartes

**Files:**
- Modify: `js/views/dashboard.js` (`renderCard` ~l.100-123, `computeAverage`/`avgColor` ~l.65-81, `enriched` ~l.168-179, import l.1, `Promise.all` l.149-154)

- [ ] **Step 1: Retirer la pastille dans `renderCard`**

Dans `renderCard`, l'en-tête de carte ne garde que le nom. Remplacer le `card-head` :

```js
el("div", { class: "card-head" },
  el("h3", { class: "name" }, displayStagiaire(s)),
),
```

Retirer aussi `avg, nbEvals` de la déstructuration en tête de `renderCard`
(`const { s, sa, vo, prioSalle, prioVoiture, retardSalle, retardVoiture } = x;`).

- [ ] **Step 2: Retirer le calcul de moyenne de `enriched`**

Dans le `.map` qui construit `enriched`, supprimer les lignes :

```js
const avg = computeAverage(evaluations, s.id);
const nbEvals = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null).length;
```

et retirer `avg, nbEvals` de l'objet retourné.

- [ ] **Step 3: Retirer les helpers et le chargement des évaluations**

- Supprimer les fonctions `computeAverage` et `avgColor` (plus référencées).
- Dans le `Promise.all`, retirer `listEvaluations()` et la variable `evaluations` :

```js
const [stagiaires, stats, semaineLundi] = await Promise.all([
  listStagiaires(),
  getStats(),
  getSetting("current_week_lundi"),
]);
```

- Dans l'import en tête de fichier (l.1), retirer `listEvaluations` :

```js
import { listStagiaires, getStats, getSetting } from "../db.js?v=20260710b";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Recharger `#/dashboard`. Attendu : plus aucune pastille `/20` ni `—` sur les cartes ;
seul le nom + les badges de priorité Salle/Voiture restent. **Zéro erreur console**
(vérifier qu'aucune référence à `computeAverage`/`avgColor`/`evaluations` ne subsiste).
L'historique des passages en bas reste présent et fonctionnel.

- [ ] **Step 5: Commit**

```bash
git add js/views/dashboard.js
git commit -m "dashboard: retire la pastille moyenne des cartes"
```

---

### Task 3: Nettoyer le CSS mort (optionnel mais recommandé)

**Files:**
- Modify: fichier CSS contenant `.avg-pill` (à localiser)

- [ ] **Step 1: Localiser les règles**

Rechercher `avg-pill` dans `css/` :

```bash
grep -rn "avg-pill\|avg-num\|avg-max" css/
```

- [ ] **Step 2: Retirer les règles `.avg-pill`, `.avg-num`, `.avg-max`**

Supprimer uniquement ces sélecteurs (et leurs variantes `.avg-pill.muted/.bad/.warn/.ok/.great`).
Ne pas toucher aux autres styles de carte.

- [ ] **Step 3: Vérifier**

Recharger `#/dashboard` : l'apparence des cartes est inchangée (les pastilles étaient déjà retirées au DOM). Aucune régression visuelle sur le reste.

- [ ] **Step 4: Commit**

```bash
git add css/
git commit -m "dashboard: nettoie le CSS mort des pastilles de note"
```

---

## Vérification (navigateur)

Pas de test-runner dans ce projet. Vérification manuelle via le serveur de preview :

1. Créer `.claude/launch.json` si absent, avec un serveur statique servant la racine du repo
   (ex. `python -m http.server 8000`), puis `preview_start` sur ce serveur — ou `preview_start`
   avec l'URL locale.
2. Se connecter (gate email/mot de passe) avec un compte admin de test.
3. Ouvrir `#/dashboard`, dérouler la console : **0 erreur**.
4. Contrôler les critères d'acceptation (spec Chantier A) :
   - aucune note/pastille visible ;
   - menu de tri sans option « Note » ;
   - priorités + historique des passages intacts.

> **Cache-bust déploiement :** le live est GitHub Pages (branche `main`). Les imports portent
> un token `?v=YYYYMMDDx`. Comme on ne modifie que le **contenu** de `dashboard.js` (pas son
> chemin), penser, au moment du déploiement, à bumper le token `?v=` selon la convention du
> projet pour forcer le rechargement côté clients. (Hors périmètre des tâches ci-dessus.)

---

## Self-review (fait à l'écriture)

- **Couverture spec Chantier A :** tris note retirés (T1), pastille + calcul + import retirés (T2), CSS mort (T3). ✔
- **Placeholders :** aucun — chaque étape montre le code exact. ✔
- **Cohérence :** `computeAverage`/`avgColor` supprimés ET plus référencés (T2 step 1-3). `evaluations` retiré partout (import, Promise.all, enriched). ✔
