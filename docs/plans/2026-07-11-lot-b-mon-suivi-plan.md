# Lot B — Espace « Mon suivi » · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet personnel « Mon suivi » montrant les passages à venir d'un stagiaire (déduits du planning, avec grisage) et un graphique SVG d'évolution de sa moyenne et de ses notes.

**Architecture:** Une nouvelle vue `js/views/mon-suivi.js` (JS vanilla ES module) câblée dans le routeur/onglets de `main.js`, une icône ajoutée à `js/icons.js`, et des styles ajoutés à `css/style.css`. Lecture seule des données existantes (`planning_entries`, `planning_half_meta`, `evaluations`) — **aucune migration**. Vérification navigateur (pas de test-runner).

**Tech Stack:** JavaScript vanilla (ES modules), SVG inline (pas de lib graphique), Supabase (lecture seule).

**Spec source:** `docs/specs/2026-07-11-mon-suivi-et-dashboard-design.md` (Chantier B).

**⚠️ Dépôt partagé :** implémenter dans un **worktree dédié** (skill `superpowers:using-git-worktrees`), branche propre (ex. `lot-b-mon-suivi`).

**Rappels d'API (vérifiés dans le code) :**
- `db.js` : `listStagiaires()`, `listEvaluations({ stagiaire_id })`, `getPlanning(semaine_lundi)`, `getHalfMetaForWeek(semaine_lundi)`, `getSetting("current_week_lundi")`.
- `utils.js` : `el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, compareByNom`.
- `config.js` : `HALF_DAYS = [{key:"matin",label:"9h00 à 12h30"},{key:"aprem",label:"13h30 à 17h00"}]`.
- `auth-admin.js` : `isAdmin()`, `getProfile()` (→ `.stagiaire_id`, `null` si prof/admin sans fiche).
- `planning_entries` : `activite`, `pedagogue_id`, `pedagogue_id_2`, `salle_double`, `eleves_ids[]`, `day_index`, `half_day` (`"matin"|"aprem"`), `slot`, `sujet`.
- `evaluations` : `note`, `note_max`, `date_eval`, `type`, `competence:{libelle}`.
- Cache-bust : tous les imports portent `?v=20260710b`. Utiliser ce **même token** sur les nouveaux imports.

---

## File Structure

- **Create:** `js/views/mon-suivi.js` — la vue complète (identité + sélecteur, section passages, section graphique). Responsabilité unique : afficher le suivi personnel d'un stagiaire.
- **Modify:** `js/main.js` — enregistrer la route `mon-suivi`, l'onglet, et l'import.
- **Modify:** `js/icons.js` — ajouter l'icône `progress` (trending-up).
- **Modify:** `css/style.css` — styles `.ms-*`.

---

### Task 1: Câblage (icône, route, onglet) + squelette de vue

**Files:**
- Modify: `js/icons.js` (objet `icon`, ~l.27+)
- Create: `js/views/mon-suivi.js`
- Modify: `js/main.js` (imports ~l.11-19, `TABS` ~l.120-129, `routes` ~l.149-158)

- [ ] **Step 1: Ajouter l'icône `progress`**

Dans `js/icons.js`, ajouter une entrée à l'objet `icon` (après `dashboard` par exemple) :

```js
  progress:   () => svg('<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>'),
```

- [ ] **Step 2: Créer le squelette de la vue**

Créer `js/views/mon-suivi.js` :

```js
import { el, clear } from "../utils.js?v=20260710b";

export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Espace personnel"),
      el("h2", {}, "Mon suivi"),
      el("p", { class: "subtitle" }, "Mes passages à venir et l'évolution de mes résultats."),
    ),
  ));
  container.appendChild(el("p", { class: "muted" }, "En construction."));
}
```

- [ ] **Step 3: Câbler la route et l'onglet dans `main.js`**

1. Ajouter l'import (près des autres `renderX`) :

```js
import { renderMonSuivi } from "./views/mon-suivi.js?v=20260710b";
```

2. Dans `TABS`, insérer juste après l'entrée `dashboard` :

```js
  { route: "mon-suivi",  label: "Mon suivi",       icon: "progress"  },
```

3. Dans `routes`, ajouter :

```js
  "mon-suivi": renderMonSuivi,
```

- [ ] **Step 4: Vérifier dans le navigateur**

Démarrer le preview (voir « Vérification »), se connecter. Attendu : un onglet « Mon suivi »
(icône trending-up) apparaît après « Tableau de bord ». Cliquer dessus affiche l'en-tête
+ « En construction. ». URL `#/mon-suivi`. **0 erreur console.**

- [ ] **Step 5: Commit**

```bash
git add js/icons.js js/views/mon-suivi.js js/main.js
git commit -m "mon-suivi: cable l'onglet, la route et l'icone (squelette)"
```

---

### Task 2: Identité, sélecteur admin et section « Mes passages à venir »

**Files:**
- Modify: `js/views/mon-suivi.js` (réécriture complète)

- [ ] **Step 1: Réécrire `mon-suivi.js` avec l'identité, le sélecteur et les passages**

Remplacer tout le contenu de `js/views/mon-suivi.js` par :

```js
import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getSetting } from "../db.js?v=20260710b";
import { el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, compareByNom } from "../utils.js?v=20260710b";
import { HALF_DAYS } from "../config.js?v=20260710b";
import { isAdmin, getProfile } from "../auth-admin.js?v=20260710b";

const HALF_ORDER = { matin: 0, aprem: 1 };

function halfLabel(half) { return half === "matin" ? "Matin" : "Après-midi"; }
function fmtTime(t) { return t ? String(t).slice(0, 5) : null; }        // "09:00:00" -> "09:00"
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function horaireFor(metas, day_index, half) {
  const m = metas.find((x) => x.day_index === day_index && x.half_day === half);
  if (m && m.start_time && m.end_time) return `${fmtTime(m.start_time)}–${fmtTime(m.end_time)}`;
  const def = HALF_DAYS.find((h) => h.key === half);
  return def ? def.label : null;
}

function dayDateLabel(date) {
  return capitalize(date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
}

// Applique la MÊME règle métier que « Valider la semaine » :
// Pédagogie salle -> pédagogue au tableau = Salle ; Voiture (conduite) -> chaque élève = Voiture.
function extractMyPassages(entries, metas, monday, id) {
  const out = [];
  (entries || []).forEach((e) => {
    let type = null;
    if (e.activite === "Pédagogie salle" &&
        (e.pedagogue_id === id || (e.salle_double && e.pedagogue_id_2 === id))) {
      type = "Salle";
    } else if (e.activite === "Voiture (conduite)" && (e.eleves_ids || []).includes(id)) {
      type = "Voiture";
    }
    if (!type) return;
    const date = addDays(monday, e.day_index);
    out.push({
      iso: isoDate(date), date, day_index: e.day_index, half_day: e.half_day,
      slot: e.slot ?? 0, type, sujet: e.sujet || null,
      horaire: horaireFor(metas, e.day_index, e.half_day),
    });
  });
  return out;
}

// Semaine active (settings) + semaine suivante si un planning y existe.
async function loadUpcoming(id) {
  const mondayIso = (await getSetting("current_week_lundi")) || isoDate(getMonday(new Date()));
  const monday1 = new Date(mondayIso + "T00:00:00");
  const nextIso = isoDate(addDays(monday1, 7));
  const monday2 = new Date(nextIso + "T00:00:00");
  const [e1, m1, e2, m2] = await Promise.all([
    getPlanning(mondayIso), getHalfMetaForWeek(mondayIso),
    getPlanning(nextIso),   getHalfMetaForWeek(nextIso),
  ]);
  let items = extractMyPassages(e1, m1, monday1, id);
  if (e2 && e2.length) items = items.concat(extractMyPassages(e2, m2, monday2, id));
  items.sort((a, b) =>
    a.iso.localeCompare(b.iso) ||
    (HALF_ORDER[a.half_day] - HALF_ORDER[b.half_day]) ||
    (a.slot - b.slot));
  return items;
}

function renderPassagesSection(items) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Mes passages à venir"));
  if (items.length === 0) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Aucun passage planifié pour l'instant."));
    return section;
  }
  const todayIso = isoDate(new Date());
  let nextMarked = false;
  const list = el("div", { class: "ms-passage-list" });
  items.forEach((it) => {
    const past = it.iso < todayIso;
    const today = it.iso === todayIso;
    const isNext = !past && !today && !nextMarked;
    if (isNext) nextMarked = true;
    const cls = "ms-passage" + (past ? " past" : "") + (today ? " today" : "") + (isNext ? " next" : "");
    const badge = past ? el("span", { class: "ms-passage-badge muted" }, "passé")
      : today ? el("span", { class: "ms-passage-badge today" }, "aujourd'hui")
      : isNext ? el("span", { class: "ms-passage-badge next" }, "prochain") : null;
    list.appendChild(el("div", { class: cls },
      el("div", { class: "ms-passage-when" },
        el("span", { class: "ms-passage-day" }, dayDateLabel(it.date)),
        el("span", { class: "ms-passage-half muted" },
          halfLabel(it.half_day) + (it.horaire ? " · " + it.horaire : "")),
      ),
      el("div", { class: "ms-passage-meta" },
        el("span", { class: "tag " + (it.type === "Salle" ? "salle" : "voiture") }, it.type),
        it.sujet ? el("span", { class: "ms-passage-sujet muted" }, it.sujet) : null,
        badge,
      ),
    ));
  });
  section.appendChild(list);
  return section;
}

export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));

  const myId = getProfile()?.stagiaire_id ?? null;
  const needSelector = isAdmin() || myId == null;

  let stagiaires = [];
  if (needSelector) stagiaires = (await listStagiaires()).slice().sort(compareByNom);
  const selectedId = myId ?? (stagiaires[0]?.id ?? null);

  clear(container);

  const header = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Espace personnel"),
      el("h2", {}, "Mon suivi"),
      el("p", { class: "subtitle" }, "Mes passages à venir et l'évolution de mes résultats."),
    ),
  );
  container.appendChild(header);

  const body = el("div", { class: "ms-body" });
  container.appendChild(body);

  async function renderFor(id) {
    clear(body);
    if (id == null) {
      body.appendChild(el("p", { class: "muted" }, "Aucun stagiaire sélectionné."));
      return;
    }
    body.appendChild(el("div", { class: "loading" }, "Chargement"));
    const items = await loadUpcoming(id);
    clear(body);
    body.appendChild(renderPassagesSection(items));
  }

  if (needSelector) {
    const sel = el("select", { class: "ms-selector" });
    stagiaires.forEach((s) => {
      const o = el("option", { value: s.id }, displayStagiaire(s));
      if (String(s.id) === String(selectedId)) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => renderFor(Number(sel.value)));
    header.appendChild(el("div", { class: "ms-selector-wrap" },
      el("label", { class: "muted" }, "Élève"), sel));
  }

  await renderFor(selectedId);
}
```

- [ ] **Step 2: Vérifier dans le navigateur**

Ouvrir `#/mon-suivi`.
- Avec un compte **admin** : un sélecteur « Élève » apparaît. Choisir un élève qui a des
  créneaux Salle/Voiture dans le planning de la semaine active → ses passages s'affichent,
  triés par date ; les jours passés sont grisés (`.past`), le prochain marqué « prochain ».
- Un élève **sans** créneau → « Aucun passage planifié pour l'instant. »
- **0 erreur console.** L'horaire s'affiche (plage half_meta ou défaut HALF_DAYS).

- [ ] **Step 3: Commit**

```bash
git add js/views/mon-suivi.js
git commit -m "mon-suivi: identite, selecteur admin et passages a venir"
```

---

### Task 3: Section « Mon évolution » (graphique SVG)

**Files:**
- Modify: `js/views/mon-suivi.js` (ajout de fonctions + appel dans `renderFor`)

- [ ] **Step 1: Ajouter les fonctions du graphique**

Dans `js/views/mon-suivi.js`, ajouter ces fonctions (avant `renderMonSuivi`) :

```js
function avgTier(v) {
  if (v < 8) return "bad";
  if (v < 12) return "warn";
  if (v < 16) return "ok";
  return "great";
}

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

// evals : triés par date croissante, chacun a { norm, note, note_max, date_eval, competence?, type? }
function buildChart(evals) {
  const W = 640, H = 280, padL = 40, padR = 16, padT = 16, padB = 48;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = evals.length;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v) => padT + innerH * (1 - v / 20);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "ms-chart", role: "img" });

  [0, 5, 10, 15, 20].forEach((v) => {
    const gy = y(v);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: gy, y2: gy, class: "ms-grid" }));
    const lbl = svgEl("text", { x: padL - 6, y: gy + 4, "text-anchor": "end", class: "ms-axis-label" });
    lbl.textContent = String(v);
    svg.appendChild(lbl);
  });

  // Courbe = moyenne cumulée
  let sum = 0;
  const avgPts = evals.map((e, i) => { sum += e.norm; return `${x(i)},${y(sum / (i + 1))}`; });
  svg.appendChild(svgEl("polyline", { points: avgPts.join(" "), class: "ms-avg-line" }));

  // Points = notes individuelles + libellés de date
  evals.forEach((e, i) => {
    const c = svgEl("circle", { cx: x(i), cy: y(e.norm), r: 5, class: "ms-pt " + avgTier(e.norm) });
    const title = svgEl("title");
    const lib = e.competence?.libelle || e.type || "Évaluation";
    title.textContent = `${lib} · ${e.note}/${e.note_max} (${e.norm.toFixed(1)}/20) · ${formatDate(e.date_eval)}`;
    c.appendChild(title);
    svg.appendChild(c);

    const dl = svgEl("text", { x: x(i), y: H - padB + 18, "text-anchor": "middle", class: "ms-axis-label small" });
    dl.textContent = formatDate(e.date_eval);
    svg.appendChild(dl);
  });

  return svg;
}

function renderChartSection(evaluations) {
  const section = el("section", { class: "ms-section" },
    el("h3", { class: "ms-section-title" }, "Mon évolution"));
  const noted = (evaluations || [])
    .filter((e) => e.note != null && e.note_max)
    .map((e) => ({ ...e, norm: (Number(e.note) / Number(e.note_max)) * 20 }))
    .sort((a, b) => String(a.date_eval).localeCompare(String(b.date_eval)) || (a.id - b.id));
  if (noted.length === 0) {
    section.appendChild(el("p", { class: "muted ms-empty" }, "Pas encore d'évaluation notée."));
    return section;
  }
  const wrap = el("div", { class: "ms-chart-wrap" });
  wrap.appendChild(buildChart(noted));
  section.appendChild(wrap);
  const avg = Math.round((noted.reduce((s, e) => s + e.norm, 0) / noted.length) * 10) / 10;
  section.appendChild(el("p", { class: "ms-chart-legend muted" },
    `Moyenne actuelle : ${avg}/20 · ${noted.length} évaluation(s)`));
  return section;
}
```

- [ ] **Step 2: Appeler le graphique dans `renderFor`**

Dans `renderMonSuivi`, remplacer le corps de `renderFor` pour charger aussi les évaluations
et rendre les deux sections :

```js
  async function renderFor(id) {
    clear(body);
    if (id == null) {
      body.appendChild(el("p", { class: "muted" }, "Aucun stagiaire sélectionné."));
      return;
    }
    body.appendChild(el("div", { class: "loading" }, "Chargement"));
    const [items, evaluations] = await Promise.all([
      loadUpcoming(id),
      listEvaluations({ stagiaire_id: id }),
    ]);
    clear(body);
    body.appendChild(renderPassagesSection(items));
    body.appendChild(renderChartSection(evaluations));
  }
```

- [ ] **Step 3: Vérifier dans le navigateur**

Ouvrir `#/mon-suivi` pour un élève **ayant des évaluations notées**. Attendu :
- sous les passages, une section « Mon évolution » avec un graphique SVG : gridlines 0/5/10/15/20,
  une courbe (moyenne cumulée), un point par note coloré selon le barème, un libellé de date sous chaque point ;
- survol d'un point → tooltip natif « compétence · note/max (x/20) · date » ;
- ligne « Moyenne actuelle : … /20 · N évaluation(s) » ;
- élève sans note → « Pas encore d'évaluation notée. »
- **0 erreur console.**

- [ ] **Step 4: Commit**

```bash
git add js/views/mon-suivi.js
git commit -m "mon-suivi: graphique SVG d'evolution (moyenne + notes)"
```

---

### Task 4: Styles `.ms-*` + vérification finale (clair/sombre)

**Files:**
- Modify: `css/style.css` (append en fin de fichier)

- [ ] **Step 1: Ajouter les styles**

Ajouter à la fin de `css/style.css` :

```css
/* ===== Mon suivi ===== */
.ms-selector-wrap { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; }
.ms-selector { padding: 0.4rem 0.6rem; }
.ms-body { display: flex; flex-direction: column; gap: 2rem; margin-top: 1.5rem; }
.ms-section-title { margin: 0 0 0.9rem; font-size: 1.05rem; }
.ms-empty { padding: 1.5rem 0; }

.ms-passage-list { display: flex; flex-direction: column; gap: 0.6rem; }
.ms-passage {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  padding: 0.75rem 1rem; border: 1px solid var(--border, #E3E7DC); border-radius: 12px;
  background: var(--bg-card, #FFF);
}
.ms-passage.past { opacity: 0.5; }
.ms-passage.today { border-color: var(--accent); }
.ms-passage.next { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.ms-passage-when { display: flex; flex-direction: column; gap: 0.15rem; }
.ms-passage-day { font-weight: 600; }
.ms-passage-half { font-size: 0.85rem; }
.ms-passage-meta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.ms-passage-sujet { font-size: 0.85rem; }
.ms-passage-badge { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
.ms-passage-badge.today, .ms-passage-badge.next { color: var(--accent-strong); font-weight: 600; }

.ms-chart-wrap { width: 100%; overflow-x: auto; }
.ms-chart { width: 100%; max-width: 640px; height: auto; display: block; }
.ms-grid { stroke: var(--border, #E3E7DC); stroke-width: 1; }
.ms-axis-label { fill: var(--text-muted); font-size: 12px; }
.ms-axis-label.small { font-size: 10px; }
.ms-avg-line { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.ms-pt { stroke: var(--bg-card, #FFF); stroke-width: 1.5; }
.ms-pt.bad   { fill: var(--c-stop); }
.ms-pt.warn  { fill: #C98A2B; }
.ms-pt.ok    { fill: #7BA23C; }
.ms-pt.great { fill: var(--c-go); }
.ms-chart-legend { margin: 0.5rem 0 0; font-size: 0.85rem; }
```

> Note : `--border` et `--bg-card` sont fournis avec un fallback au cas où le nom exact
> diffère. Si le thème sombre définit d'autres noms, ajuster ; les couleurs de points
> (`bad/warn/ok/great`) sont sémantiques et lisibles sur fond clair comme sombre.

- [ ] **Step 2: Vérifier — thème clair**

Recharger `#/mon-suivi`. Attendu : cartes de passages propres, badges lisibles, graphique
aligné, points colorés, courbe à l'accent. Rien ne déborde horizontalement (le graphe scrolle
dans son conteneur si l'écran est étroit).

- [ ] **Step 3: Vérifier — thème sombre**

Basculer le thème (bouton thème de l'app, ou `resize_window` avec `colorScheme: "dark"`).
Attendu : textes/gridlines/points restent lisibles, pas de carte blanche sur fond sombre
(vérifier `--bg-card`/`--border` s'appliquent). Ajuster si un contraste casse.

- [ ] **Step 4: Vérifier les critères d'acceptation (spec Chantier B)**

- Stagiaire connecté : voit **ses** passages + **son** graphique, sans sélecteur.
- Admin : sélecteur, changement d'élève met à jour les deux sections.
- Passages : uniquement les créneaux où l'élève est **acteur** (au tableau / élève voiture),
  pas simple assistant salle ; jours passés grisés ; prochain mis en avant ; horaire seulement s'il existe.
- Graphique : points + courbe, état vide géré, lisible clair et sombre.

- [ ] **Step 5: Commit**

```bash
git add css/style.css
git commit -m "mon-suivi: styles (passages + graphique, clair/sombre)"
```

---

## Vérification (navigateur)

Pas de test-runner. Vérification via le serveur de preview :

1. `.claude/launch.json` : un serveur statique servant la racine du repo (ex. `python -m http.server 8000`), puis `preview_start` — ou `preview_start` avec l'URL locale.
2. Se connecter (gate). Idéalement tester **deux comptes** : un **admin** (voit le sélecteur) et un **stagiaire** lié à une fiche (voit son propre suivi).
3. Pré-requis données : le stagiaire testé doit avoir des créneaux Salle/Voiture dans le planning
   de la semaine active (`current_week_lundi`) et quelques évaluations notées, sinon les sections
   afficheront leurs états vides (ce qui est aussi à vérifier).
4. Dérouler la console : **0 erreur** sur `#/mon-suivi`.

> **Cache-bust déploiement :** live = GitHub Pages (`main`). Un **nouveau fichier**
> (`mon-suivi.js`) et de **nouveaux imports** sont ajoutés avec le token `?v=20260710b`.
> Au déploiement, suivre la convention du projet pour le cache-bust (bump du token `?v=`
> sur les fichiers touchés / globalement) afin que les clients rechargent bien le JS/CSS.

---

## Self-review (fait à l'écriture)

- **Couverture spec Chantier B :**
  - Onglet/route/identité + sélecteur admin → Task 1 (câblage) + Task 2 (identité/sélecteur). ✔
  - Passages à venir (semaine active + suivante, filtre acteur, grisage, horaire, sujet) → Task 2. ✔
  - Graphique moyenne + notes, seuils couleur, tooltip, état vide → Task 3. ✔
  - Styles + thème clair/sombre → Task 4. ✔
- **Placeholders :** aucun — code complet à chaque étape. ✔
- **Cohérence des noms :** `loadUpcoming`, `extractMyPassages`, `renderPassagesSection`,
  `renderChartSection`, `buildChart`, `avgTier`, `svgEl` définis et appelés de façon cohérente ;
  `renderFor` mis à jour en Task 3 pour appeler `renderChartSection`. ✔
- **APIs :** toutes vérifiées dans le code source (exports db/utils/config/auth). `half_day`
  ∈ {`matin`,`aprem`} conforme à `HALF_DAYS`. ✔
- **Pas de migration / pas de changement RLS.** ✔
