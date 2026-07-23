# Priorités + espace perso avec passages effectués · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renommer le tableau de bord en « Priorités » (icône cible), retirer l'onglet « Mon suivi » de la barre, et afficher les passages effectués (compteurs + historique) dans l'espace perso.

**Architecture:** Spec : `docs/superpowers/specs/2026-07-23-priorites-espace-perso-passages-design.md`. Vanilla JS, modules ES, pas de framework. Les compteurs des passages effectués sont calculés par un module pur `js/passages-stats.js` (testable en node, comme `creneaux-rules.js`) à partir de `listPassages({stagiaire_id})` — une seule requête, compteurs et historique toujours cohérents.

**Tech Stack:** Vanilla JS + Supabase (lecture seule ici). Tests : `node --check` + tests node sur module pur + banc import map (`_harness_build.mjs`).

## Global Constraints

- Libellés UI : jamais « Prof » (toujours « Formateur »), jamais d'em-dash (—) dans les labels.
- Comptage : `compteDansEquite` (Effectué + Absence comptent, Bonus/Report non) — ne JAMAIS introduire une autre règle.
- Tout nouveau bloc CSS va en FIN de `css/style.css` (l'ordre de déclaration départage les spécificités égales).
- Ne jamais piper la sortie de `scripts/cache-bust.js` ; le hook pre-commit s'en charge seul.
- Les imports portent des jetons `?v=` réécrits par le hook : copier le jeton courant du fichier lors d'un ajout d'import.
- Routes internes `dashboard` et `mon-suivi` inchangées.

---

### Task 1: Module pur `passages-stats.js` + tests node

**Files:**
- Create: `js/passages-stats.js`
- Test: `tests/passages-stats.test.mjs`

**Interfaces:**
- Consumes: `compteDansEquite(resultat)` depuis `js/passage-rules.js` (existant).
- Produces: `statsPassages(rows)` → `{ salle, voiture, avecEleve, byProf }` où `rows` = lignes de la table `passages` (`{type, resultat, avec_eleve, prof_id}`). `byProf` = `{ [prof_id]: count }` (voiture comptée uniquement).

- [ ] **Step 1: Écrire le test qui échoue**

```js
// tests/passages-stats.test.mjs
// node tests/passages-stats.test.mjs
import { statsPassages } from "../js/passages-stats.js";

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log("  ok   " + label); }
  else { failures++; console.error("  FAIL " + label + "\n    attendu " + e + "\n    obtenu  " + a); }
}

// Base : salle + voiture comptées, avec élève, répartition formateur
check("cas nominal", statsPassages([
  { type: "Salle",   resultat: "Effectué", avec_eleve: null,  prof_id: null },
  { type: "Salle",   resultat: "Effectué", avec_eleve: null,  prof_id: null },
  { type: "Voiture", resultat: "Effectué", avec_eleve: true,  prof_id: 1 },
  { type: "Voiture", resultat: "Effectué", avec_eleve: false, prof_id: 2 },
]), { salle: 2, voiture: 2, avecEleve: 1, byProf: { 1: 1, 2: 1 } });

// Règle d'équité : Absence compte, Bonus et Report non (mais restent listables ailleurs)
check("bonus/report exclus, absence comptée", statsPassages([
  { type: "Salle",   resultat: "Absence",  avec_eleve: null, prof_id: null },
  { type: "Salle",   resultat: "Bonus",    avec_eleve: null, prof_id: null },
  { type: "Voiture", resultat: "Report",   avec_eleve: true, prof_id: 1 },
]), { salle: 1, voiture: 0, avecEleve: 0, byProf: {} });

// avec_eleve NULL (historique inconnu) ne compte pas comme « avec élève »
check("avec_eleve null ignoré", statsPassages([
  { type: "Voiture", resultat: "Effectué", avec_eleve: null, prof_id: 1 },
]), { salle: 0, voiture: 1, avecEleve: 0, byProf: { 1: 1 } });

// Robustesse : liste vide / prof_id absent
check("liste vide", statsPassages([]), { salle: 0, voiture: 0, avecEleve: 0, byProf: {} });
check("voiture sans formateur", statsPassages([
  { type: "Voiture", resultat: "Effectué", avec_eleve: true, prof_id: null },
]), { salle: 0, voiture: 1, avecEleve: 1, byProf: {} });

if (failures) { console.error(failures + " échec(s)"); process.exit(1); }
console.log("Tous les tests passent.");
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node tests/passages-stats.test.mjs`
Expected: FAIL — `Cannot find module ... passages-stats.js`

- [ ] **Step 3: Implémenter le module**

```js
// js/passages-stats.js
// Compteurs PURS des passages effectués d'un stagiaire, affichés dans l'espace perso.
// Même règle d'équité que partout ailleurs (compteDansEquite) : Effectué + Absence
// comptent, Bonus/Report non. Module sans DOM ni réseau, testé en node
// (tests/passages-stats.test.mjs), sur le modèle de creneaux-rules.js.
import { compteDansEquite } from "./passage-rules.js?v=20260723e";

// rows : lignes de la table passages ({type, resultat, avec_eleve, prof_id}).
// Retourne { salle, voiture, avecEleve, byProf } ; byProf ne concerne que la voiture.
export function statsPassages(rows) {
  const out = { salle: 0, voiture: 0, avecEleve: 0, byProf: {} };
  (rows || []).forEach((p) => {
    if (!compteDansEquite(p.resultat)) return;
    if (p.type === "Salle") { out.salle++; return; }
    if (p.type !== "Voiture") return;
    out.voiture++;
    if (p.avec_eleve === true) out.avecEleve++;
    if (p.prof_id != null) out.byProf[p.prof_id] = (out.byProf[p.prof_id] || 0) + 1;
  });
  return out;
}
```

Note : le jeton `?v=` de l'import sera réécrit par le hook au commit ; copier le jeton courant visible en tête de `js/db.js` s'il diffère de `20260723e`.

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node tests/passages-stats.test.mjs`
Expected: `Tous les tests passent.` — et `node --check js/passages-stats.js` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add js/passages-stats.js tests/passages-stats.test.mjs
git commit -m "feat(passages-stats): compteurs purs des passages effectues (regle equite)"
```

---

### Task 2: Renommages promo (« Priorités » + icône cible) et retrait de l'onglet « Mon suivi »

**Files:**
- Modify: `js/icons.js` (après l'entrée `today`, ~ligne 33)
- Modify: `js/main.js:122-132` (TABS)
- Modify: `js/views/dashboard.js:156` (h2)
- Modify: `js/views/home.js:89` (tuile)

**Interfaces:**
- Produces: `icon.target()` (icons.js) — utilisée par TABS.
- Consumes: rien de Task 1.

- [ ] **Step 1: Ajouter l'icône `target` dans icons.js**

Après la ligne `today:` (dans l'objet `icon`), ajouter :

```js
  // Cible (Lucide target) : onglet « Priorités » — qui doit passer en priorité.
  target:     () => svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
```

- [ ] **Step 2: TABS dans main.js — renommer dashboard, retirer mon-suivi**

Remplacer dans `TABS` :

```js
  { route: "dashboard",  label: "Passages",        icon: "dashboard" },
  { route: "mon-suivi",  label: "Mon suivi",       icon: "user"      },
```

par :

```js
  // « Priorités » : la vue promo dit QUI doit passer, pas « les passages » (ce mot
  // appartient à l'espace perso). L'espace perso n'a PLUS d'onglet : on y accède par
  // l'ouverture de l'app, le logo et le badge (« Mon espace personnel ») — la route
  // mon-suivi reste dans `routes` ci-dessous. Sur #/mon-suivi, aucun onglet n'est
  // actif : assumé (la boucle d'activation ne matche rien).
  { route: "dashboard",  label: "Priorités",       icon: "target"    },
```

Ne PAS toucher à l'objet `routes` (mon-suivi doit y rester), ni à la route par défaut `mon-suivi`, ni à `setupTodayBtn`.

- [ ] **Step 3: Titre du dashboard**

Dans `js/views/dashboard.js`, remplacer :

```js
      el("h2", {}, "Suivi des passages"),
```

par :

```js
      el("h2", {}, "Priorités de passage"),
```

- [ ] **Step 4: Tuile d'accueil**

Dans `js/views/home.js`, remplacer :

```js
    { route: "dashboard",  icon: "dashboard",    title: "Suivi des passages", desc: "Priorités & historique des passages" },
```

par :

```js
    { route: "dashboard",  icon: "target",       title: "Priorités",        desc: "Qui doit passer, vs moyenne de classe" },
```

- [ ] **Step 5: Vérifier la syntaxe**

Run: `node --check js/main.js; node --check js/icons.js; node --check js/views/dashboard.js; node --check js/views/home.js`
Expected: aucune sortie (succès).

- [ ] **Step 6: Commit**

```bash
git add js/icons.js js/main.js js/views/dashboard.js js/views/home.js
git commit -m "refactor(nav): dashboard devient Priorites (icone cible), l'onglet Mon suivi sort de la barre"
```

---

### Task 3: Section « Passages effectués » dans l'espace perso

**Files:**
- Modify: `js/views/mon-suivi.js` (imports l.1-9, `renderFor` l.484-531, suppression `renderHistoriqueSection` l.398-439, nouvelle `renderEffectuesSection`)
- Modify: `css/style.css` (bloc en FIN de fichier)

**Interfaces:**
- Consumes: `statsPassages(rows)` de `js/passages-stats.js` (Task 1) ; `listPassages(filters)` de `js/db.js` (existant, retourne les rows triées date desc) ; `RESULTATS` de `js/config.js` ; variables module `profs` et `aggregats` déjà présentes dans mon-suivi.js.
- Produces: `renderEffectuesSection(rows)` (interne au fichier).

- [ ] **Step 1: Imports dans mon-suivi.js**

Ligne 1-3, ajouter `listPassages` à l'import db.js :

```js
import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getJoursOff, getSetting,
         getVoitureAggregats, listProfs, listEpcf, getEpcfMoyennes, listThemes,
         getStagiaire, setDateNaissance, listPassages } from "../db.js?v=20260723e";
```

Après la ligne 5 (`import { HALF_DAYS } ...`), élargir pour récupérer RESULTATS :

```js
import { HALF_DAYS, RESULTATS } from "../config.js?v=20260723e";
```

Après l'import de `creneaux-rules.js` (l.9), ajouter :

```js
import { statsPassages } from "../passages-stats.js?v=20260723e";
```

(Jetons `?v=` : copier celui des imports voisins du fichier au moment de l'édition.)

- [ ] **Step 2: Charger les passages dans renderFor**

Dans `renderFor(id)` (l.492-497), ajouter `listPassages` au `Promise.all` :

```js
    const [items, evaluations, epcfEvals, stagiaireRow, passRows] = await Promise.all([
      loadUpcoming(id),
      listEvaluations({ stagiaire_id: id }),
      listEpcf({ stagiaire_id: id }),
      getStagiaire(id),
      listPassages({ stagiaire_id: id }),
    ]);
```

- [ ] **Step 3: Remplacer renderHistoriqueSection par renderEffectuesSection**

SUPPRIMER intégralement la fonction `renderHistoriqueSection(id)` (l.398-439) et la remplacer, au même endroit, par :

```js
// « Passages effectués » : compteurs (règle d'équité) + historique détaillé, depuis
// la MÊME liste listPassages — compteurs et lignes toujours cohérents entre eux.
// Remplace l'« Historique voiture » qui vivait dans l'onglet Évolution : les tuiles
// et la répartition par formateur déménagent ici, avec la salle en plus.
function renderEffectuesSection(rows) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Mes passages effectués"));
  if (!rows || !rows.length) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Aucun passage enregistré pour l'instant."));
    return section;
  }
  const s = statsPassages(rows);

  const tile = (v, l) => el("div", { class: "histo-stat" },
    el("div", { class: "histo-stat-value" }, String(v)),
    el("div", { class: "histo-stat-label" }, l));
  const card = el("div", { class: "suivi-histo" },
    el("div", { class: "histo-stats" },
      tile(s.salle, "salle"),
      tile(s.voiture, "voiture"),
      tile(s.avecEleve, "avec élève"),
    ));

  // Répartition par formateur (voiture) — mêmes classes CSS que l'ancien historique.
  const profRows = Object.entries(s.byProf)
    .map(([pid, k]) => ({ nom: profs.find((p) => p.id === Number(pid))?.nom || "?", n: k }))
    .sort((x, y) => y.n - x.n);
  if (profRows.length) {
    const maxN = Math.max(1, ...profRows.map((r) => r.n));
    card.appendChild(el("p", { class: "histo-profs-title" }, "Voiture · répartition par formateur"));
    const list = el("div", { class: "histo-profs" });
    profRows.forEach((r) => {
      list.appendChild(el("div", { class: "histo-prof-row" },
        el("span", { class: "histo-prof-nom" }, r.nom),
        el("span", { class: "histo-prof-bar" },
          el("span", { class: "histo-prof-bar-fill", style: `width:${Math.round((r.n / maxN) * 100)}%` })),
        el("span", { class: "histo-prof-n muted" }, "×" + r.n),
      ));
    });
    card.appendChild(list);
  }
  section.appendChild(card);

  // Historique détaillé : rows déjà triées date desc par listPassages. Les lignes
  // non comptées (Bonus/Report) sont listées quand même, leur tag dit leur statut.
  const list = el("div", { class: "ms-histo-list" });
  rows.forEach((p) => {
    const res = RESULTATS.find((r) => r.value === p.resultat);
    list.appendChild(el("div", { class: "ms-histo-item" },
      el("span", { class: "ms-histo-date" }, formatDate(p.date)),
      el("span", { class: "tag " + (p.type === "Salle" ? "salle" : "voiture") }, p.type),
      el("span", { class: "tag " + (res?.color || "") }, p.resultat),
      p.commentaire ? el("span", { class: "ms-histo-comment muted" }, p.commentaire) : null,
    ));
  });
  section.appendChild(list);
  return section;
}
```

- [ ] **Step 4: Brancher les sous-onglets**

Dans `renderFor`, remplacer le bloc `renderSubTabs([...])` par :

```js
    body.appendChild(renderSubTabs([
      { key: "passages", label: "Passages", render: (p) => {
          p.appendChild(renderPassagesSection(items));
          p.appendChild(renderEffectuesSection(passRows));
        } },
      { key: "epcf", label: "EPCF", render: (p) => {
          p.appendChild(renderEpcfTrameSection("salle",
            epcfEvals.filter((e) => e.trame === "salle"), moySalle));
          p.appendChild(renderEpcfTrameSection("vehicule",
            epcfEvals.filter((e) => e.trame === "vehicule"), moyVehicule));
        } },
      { key: "evolution", label: "Évolution", render: (p) => {
          p.appendChild(renderChartSection(evaluations));
        } },
    ], { storageKey: "ecsr_monsuivi_subtab" }));
```

(Seuls changements : `renderEffectuesSection(passRows)` ajouté sous « Passages », et `renderHistoriqueSection(id)` retiré d'« Évolution ».)

Vérifier ensuite s'il reste des usages de `aggregats`/`getVoitureAggregats` dans mon-suivi.js : `aggregats` n'était consommé QUE par `renderHistoriqueSection` → retirer `getVoitureAggregats()` du `Promise.all` initial (l.450-455), la variable module `aggregats` (l.14) et son affectation. NE PAS toucher à `db.js` (getVoitureAggregats sert au planning).

- [ ] **Step 5: CSS de l'historique (FIN de style.css)**

Ajouter tout en fin de `css/style.css` :

```css
/* ============================================================
   Mon suivi — historique des passages effectués (volet 2026-07-23)
   Bloc en FIN de fichier : l'ordre de déclaration départage les
   spécificités égales (piège documenté du 2026-07-20).
   ============================================================ */
.ms-histo-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.85rem;
}
.ms-histo-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  font-size: 0.88rem;
}
.ms-histo-date {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  min-width: 5.2rem;
}
.ms-histo-comment { font-size: 0.82rem; }
```

- [ ] **Step 6: Vérifier syntaxe + tests**

Run: `node --check js/views/mon-suivi.js; node tests/passages-stats.test.mjs; node tests/creneaux-rules.test.mjs; node tests/passage-rules.test.mjs`
Expected: tout passe.

- [ ] **Step 7: Commit**

```bash
git add js/views/mon-suivi.js css/style.css
git commit -m "feat(mon-suivi): passages effectues (compteurs + historique) dans l'onglet Passages"
```

---

### Task 4: Fixtures banc + vérification navigateur complète

**Files:**
- Modify: `_harness_supabase.js` (fichier git-exclu, à la racine du projet)

**Interfaces:**
- Consumes: le banc existant (`_harness_build.mjs` génère `_harness.html` ; leviers `?date=`, `?role=stagiaire`).

- [ ] **Step 1: Ajouter des fixtures passages au stub**

Dans `_harness_supabase.js`, objet `FIXTURES`, remplacer `passages: [],` par :

```js
  passages: [
    { id: 1, stagiaire_id: 1, type: "Salle",   resultat: "Effectué", date: "2026-07-16",
      prof_id: null, avec_eleve: null, remplacant_id: null, commentaire: null,
      origine: "Planning", created_by_who: "Auto", stagiaire: { prenom: "Timy" }, remplacant: null },
    { id: 2, stagiaire_id: 1, type: "Voiture", resultat: "Effectué", date: "2026-07-15",
      prof_id: 1, avec_eleve: true, remplacant_id: null, commentaire: "Créneau urbain",
      origine: "Planning", created_by_who: "Auto", stagiaire: { prenom: "Timy" }, remplacant: null },
    { id: 3, stagiaire_id: 1, type: "Voiture", resultat: "Bonus",    date: "2026-07-10",
      prof_id: 2, avec_eleve: false, remplacant_id: null, commentaire: null,
      origine: "Manuel", created_by_who: "Romain", stagiaire: { prenom: "Timy" }, remplacant: null },
    { id: 4, stagiaire_id: 2, type: "Salle",   resultat: "Effectué", date: "2026-07-14",
      prof_id: null, avec_eleve: null, remplacant_id: null, commentaire: null,
      origine: "Planning", created_by_who: "Auto", stagiaire: { prenom: "Anissa" }, remplacant: null },
  ],
```

Attendu avec ces fixtures pour le stagiaire 1 : compteurs salle 1 · voiture 1 · avec élève 1 (le Bonus est exclu des compteurs) ; historique 3 lignes (le Bonus listé avec son tag) ; le passage d'Anissa (id 4) invisible.

Note : le `select` du stub ignore les jointures PostgREST (`stagiaire:...`) — les champs `stagiaire`/`remplacant` sont fournis directement dans la fixture, et le tri date desc de `listPassages` est un `order()` no-op dans le stub, d'où des fixtures PRÉ-TRIÉES par date décroissante par stagiaire.

- [ ] **Step 2: Régénérer le banc et vérifier**

```bash
node _harness_build.mjs
```

Puis via le pane (preview `ecsr-app`, `_harness.html?fresh=<n>`), vérifier par `javascript_tool` :

1. Onglets de la barre : libellés = `["Accueil","Priorités","Planning","Calendrier","Thèmes","Notes","Ressources","Paramètres"]` (8, sans « Mon suivi », « Priorités » avec 3 `circle` dans son svg).
2. `#/dashboard` : h2 = « Priorités de passage » ; aucun onglet `.active` incohérent.
3. `#/mon-suivi` : h2 = « Mon suivi » ; AUCUN onglet `.active` (assumé) ; sous-onglet Passages contient « Mon planning à venir » ET « Mes passages effectués » ; tuiles = salle 1 / voiture 1 / avec élève 1 ; `.ms-histo-item` = 3 ; la ligne Bonus porte le tag `bonus` ; répartition formateur présente (Romain ×1).
4. Sous-onglet Évolution : « Historique voiture » ABSENT, graphe présent (ou message « Pas encore d'évaluation notée »).
5. Badge → « Mon espace personnel » → arrive sur `#/mon-suivi`.
6. `?role=stagiaire` : mêmes vérifications 3-4 (données du stagiaire 1), pas de sélecteur Élève.
7. Tuile d'accueil `#/home` : « Priorités » présente.
8. `read_console_messages onlyErrors` : zéro erreur.

Expected: tous les points verts.

- [ ] **Step 3: Commit (si le stub seul a bougé, rien à committer — il est git-exclu ; sinon committer les retouches)**

```bash
git status --short
```

Expected: arbre propre (les fichiers `_harness*` sont exclus).

---

### Task 5: Déploiement + vérification live

**Files:** aucun nouveau — push de l'existant.

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Attendre le build Pages**

Run: `gh api repos/watchi64/ecsr-promo/pages/builds/latest --jq '.status + " " + .commit'` (boucle 15 s)
Expected: `built <sha du dernier commit>`.

- [ ] **Step 3: Vérifier le live**

```bash
curl -s "https://watchi64.github.io/ecsr-promo/index.html?nc=$RANDOM" | grep -oE 'main.js\?v=[0-9a-z]+'
curl -s "https://watchi64.github.io/ecsr-promo/js/main.js?v=<jeton>" | grep -E 'label: "Priorités"|mon-suivi'
curl -s "https://watchi64.github.io/ecsr-promo/js/views/mon-suivi.js?v=<jeton>" | grep -oE 'Mes passages effectués'
curl -s "https://watchi64.github.io/ecsr-promo/js/views/dashboard.js?v=<jeton>" | grep -oE 'Priorités de passage'
```

Expected: jeton frais servi ; « Priorités » présent dans TABS et `mon-suivi` ABSENT de TABS (mais présent dans `routes`) ; les deux titres servis.

- [ ] **Step 4: Prévenir l'utilisateur**

Rappeler : rafraîchissement forcé sur iPhone (index.html en cache Safari).
