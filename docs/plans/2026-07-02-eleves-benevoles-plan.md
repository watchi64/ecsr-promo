# Banque d'élèves bénévoles : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Banque d'élèves bénévoles (volontaires conduite) réservée formateur/admin, rattachable aux cartes « Voiture (conduite) » du planning, avec dispos hebdo et téléphone protégé côté base.

**Architecture :** Nouvelle table Supabase `benevoles` (RLS `is_admin()` sur tout) + RPC SECURITY DEFINER `benevoles_noms()` (id + nom d'affichage seulement) pour l'affichage côté stagiaire. Colonne `planning_entries.benevoles_ids INTEGER[]`. UI : champ chips « Bénévoles » sur les cartes Voiture + panneau de gestion ouvert par un bouton admin dans la barre semaine du Planning (nouveau module `js/views/benevoles.js`).

**Tech stack :** Vanilla JS modules ES, Supabase (MCP `apply_migration`), CSS maison. Pas de framework, pas de build. Spec : `docs/specs/2026-07-02-eleves-benevoles-design.md`.

**Vérification :** pas de framework de test dans ce repo. Chaque tâche se vérifie par un chargement en preview locale (`python -m http.server 8000` + `node scripts/cache-bust.js` à la main pour rafraîchir les tokens `?v=` AVANT de tester du code non commité) et par requêtes SQL en lecture via MCP. Contrôles read-only : simuler un stagiaire via « Voir en tant que » (UI) et vérifier la RLS par requête avec un JWT non admin si possible, sinon revue des policies.

---

## Tâche 1 : Migration Supabase

**Fichiers :** aucun (migration via MCP `apply_migration` sur le projet `crpduennbqaemhfaywrz`).

- [ ] **Étape 1.1 : vérifier l'existant avant DDL**

Via MCP `list_tables` : confirmer que `benevoles` n'existe pas, et repérer le générateur d'identité de `planning_entries`. Via `execute_sql` (lecture) : `select proname from pg_proc where proname = 'is_admin';` doit renvoyer 1 ligne.

- [ ] **Étape 1.2 : appliquer la migration `add_benevoles`**

```sql
-- Banque d'élèves bénévoles (volontaires conduite). Table entière réservée aux
-- admins (formateurs) : le téléphone ne doit jamais transiter vers un stagiaire.
create table public.benevoles (
  id          serial primary key,
  prenom      text not null,
  nom         text not null,
  telephone   text,
  niveau      text,             -- compétence REMC : C1 / C2 / C3 / C4
  boite       text,             -- Manuelle / Automatique
  heures      numeric,          -- heures de conduite déjà effectuées (saisie manuelle)
  auto_ecole  text,             -- auto-école de provenance
  dispos      jsonb not null default '{}'::jsonb,  -- {"LUNDI": ["matin","aprem"], ...}
  dispo_note  text,
  notes       text,
  actif       boolean not null default true,       -- retrait doux
  created_at  timestamptz not null default now()
);

alter table public.benevoles enable row level security;
create policy benevoles_select_admin on public.benevoles for select to authenticated using (is_admin());
create policy benevoles_insert_admin on public.benevoles for insert to authenticated with check (is_admin());
create policy benevoles_update_admin on public.benevoles for update to authenticated using (is_admin()) with check (is_admin());
create policy benevoles_delete_admin on public.benevoles for delete to authenticated using (is_admin());

revoke all on table public.benevoles from anon;
grant select, insert, update, delete on table public.benevoles to authenticated;
grant usage on sequence public.benevoles_id_seq to authenticated;

-- Noms d'affichage des bénévoles pour TOUT authentifié (affichage des cartes planning
-- côté stagiaire). SECURITY DEFINER : ne expose QUE id + « N. Prénom », y compris les
-- inactifs (une vieille semaine doit rester lisible).
create or replace function public.benevoles_noms()
returns table(id integer, display text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         case when coalesce(trim(b.nom), '') <> ''
              then upper(left(trim(b.nom), 1)) || '. ' || b.prenom
              else b.prenom
         end
  from public.benevoles b;
$$;
revoke all on function public.benevoles_noms() from public;
revoke all on function public.benevoles_noms() from anon;
grant execute on function public.benevoles_noms() to authenticated;

-- Rattachement aux cartes du planning (rempli uniquement pour Voiture (conduite))
alter table public.planning_entries
  add column benevoles_ids integer[] not null default '{}';
```

- [ ] **Étape 1.3 : vérifier**

`execute_sql` (lecture) :
- `select * from pg_policies where tablename = 'benevoles';` → 4 policies avec `is_admin()`.
- `select column_name from information_schema.columns where table_name = 'planning_entries' and column_name = 'benevoles_ids';` → 1 ligne.
- `select * from public.benevoles_noms();` → 0 ligne, pas d'erreur.
- MCP `get_advisors` (security) : pas de nouveau finding bloquant sur `benevoles` (la RPC SECURITY DEFINER est voulue et documentée).

---

## Tâche 2 : fonctions db.js

**Fichiers :**
- Modifier : `js/db.js` (après le bloc Contacts, vers la ligne 465)

- [ ] **Étape 2.1 : ajouter les fonctions**

```js
// === Élèves bénévoles (banque voiture conduite) ===
// Table RLS admin-only (le téléphone ne doit jamais transiter vers un stagiaire).
// Les non-admins passent par la RPC benevoles_noms() (SECURITY DEFINER) qui
// n'expose que id + nom d'affichage, inactifs compris (vieilles semaines lisibles).

export async function listBenevoles() {
  return cachedQuery("benevoles", async () => {
    const { data, error } = await supabase
      .from("benevoles").select("*").order("nom").order("prenom");
    if (error) throw error;
    return data;
  });
}

export async function listBenevolesNoms() {
  return cachedQuery("benevoles_noms", async () => {
    const { data, error } = await supabase.rpc("benevoles_noms");
    if (error) throw error;
    return data;
  });
}

export async function addBenevole(payload) {
  const { data, error } = await supabase.from("benevoles").insert(payload).select().single();
  if (error) throw error;
  invalidateCache("benevoles");
  invalidateCache("benevoles_noms");
  return data;
}

export async function updateBenevole(id, patch) {
  const { error } = await supabase.from("benevoles").update(patch).eq("id", id);
  if (error) throw error;
  invalidateCache("benevoles");
  invalidateCache("benevoles_noms");
}

// Retrait doux : la ligne reste en base (les vieilles semaines gardent leurs noms),
// le bénévole disparaît des sélecteurs et de la liste active.
export async function setBenevoleActif(id, actif) {
  const { error } = await supabase.from("benevoles").update({ actif }).eq("id", id);
  if (error) throw error;
  invalidateCache("benevoles");
  invalidateCache("benevoles_noms");
}
```

- [ ] **Étape 2.2 : commit**

```bash
git add js/db.js
git commit -m "feat(benevoles): table benevoles + RPC noms + fonctions db"
```

(La migration de la tâche 1 est déjà en prod côté Supabase ; ce commit documente son pendant client.)

---

## Tâche 3 : plomberie données planning (config.js + planning.js)

**Fichiers :**
- Modifier : `js/config.js:27` (ACTIVITY_SHAPES)
- Modifier : `js/views/planning.js` (imports l.1-13, SWAP_FIELDS l.198, entryUpsertPayload l.78, helpers eff l.423-433, renderPlanning l.2096)

- [ ] **Étape 3.1 : forme de l'activité Voiture**

Dans `js/config.js`, ligne 27 :

```js
  "Voiture (conduite)": ["activite", "prof", "sujet", "eleves", "benevoles", "notes"],
```

- [ ] **Étape 3.2 : imports planning.js**

Ajouter à l'import db.js : `listBenevoles, listBenevolesNoms`. Ajouter `compareByNom` à l'import utils.js.

- [ ] **Étape 3.3 : état + chargement**

Sous `let themes = [];` (l.17) ajouter :

```js
let benevoles = [];  // admin : lignes complètes + display ; sinon : {id, display} via RPC
```

Nouvelle fonction près de `loadPlanning` :

```js
// Banque des bénévoles pour les sélecteurs et l'affichage des cartes voiture.
// Admin : table complète (dispos, actif...). Stagiaire : RPC noms seulement
// (la table est RLS admin-only, téléphone jamais transmis).
async function loadBenevoles() {
  if (isAdmin()) {
    const list = await listBenevoles();
    return list.map((b) => ({ ...b, display: displayStagiaire(b) }));
  }
  return await listBenevolesNoms();
}
```

Dans `renderPlanning` (l.2100), charger en parallèle :

```js
  [stagiaires, profs, themes, benevoles] = await Promise.all([
    listStagiaires(), listProfs(), listThemes(), loadBenevoles(),
  ]);
```

- [ ] **Étape 3.4 : persistance**

`SWAP_FIELDS` (l.198) : ajouter `"benevoles_ids"` (le drag & drop permute le contenu, les bénévoles doivent suivre la carte).

`entryUpsertPayload` (l.78) : ajouter `benevoles_ids: entry.benevoles_ids ?? [],` après `salle_double`.

- [ ] **Étape 3.5 : rôles effectifs + occupation créneau**

Après `effElevesIds` (l.433) :

```js
function effBenevolesIds(e) {
  if (!entryShape(e).includes("benevoles")) return [];
  return e.benevoles_ids || [];
}

// Bénévoles déjà placés sur une AUTRE carte du même créneau (cartes parallèles =
// simultanées : pas deux voitures à la fois). Les slots successifs restent permis :
// un bénévole reste souvent toute la demi-journée et change d'élève moniteur.
function benevoleSlotOccupants(entry) {
  const ids = new Set();
  entries.forEach((e) => {
    if (e.day_index !== entry.day_index || e.half_day !== entry.half_day || e.slot !== entry.slot) return;
    if (e._lid === entry._lid) return;
    effBenevolesIds(e).forEach((id) => ids.add(id));
  });
  return ids;
}

// Dispo récurrente du bénévole sur le jour + demi-journée d'une carte.
function isBenevoleDispo(b, entry) {
  return (b.dispos?.[JOURS[entry.day_index]] || []).includes(entry.half_day);
}
```

- [ ] **Étape 3.6 : vérification rapide**

`node scripts/cache-bust.js` puis charger la preview : le planning s'affiche à l'identique (aucune UI encore), pas d'erreur console.

- [ ] **Étape 3.7 : commit**

```bash
git add js/config.js js/views/planning.js
git commit -m "feat(benevoles): plomberie donnees planning (shape, payload, swap, eff)"
```

---

## Tâche 4 : champ « Bénévoles » sur la carte Voiture

**Fichiers :**
- Modifier : `js/views/planning.js` (chipsSelect l.804, renderLaneCell branche voiture l.1139-1182)
- Modifier : `css/style.css` (badge dispo + read-only)

- [ ] **Étape 4.1 : options de chipsSelect**

Généraliser `chipsSelect` avec un 5e paramètre optionnel (les 3 appels existants ne changent pas) :

```js
function chipsSelect(allStagiaires, currentIds, onChange, counts, opts = {}) {
  const { labelFn = displayStagiaire, placeholder = "Élèves…", itemBadge = null } = opts;
```

Dans `render()` : remplacer `"Élèves…"` par `placeholder`, les deux `displayStagiaire(s)` par `labelFn(s)`, et après le `if (counts) item.appendChild(prioBadge(...))` ajouter :

```js
      if (itemBadge) { const badge = itemBadge(s); if (badge) item.appendChild(badge); }
```

- [ ] **Étape 4.2 : bloc Bénévoles dans renderLaneCell**

Dans la branche `else if (shape.includes("eleves"))` (l.1139), après `participants.appendChild(eleveRole);` et avant `body.appendChild(participants);` :

```js
    if (shape.includes("benevoles")) {
      const bnvRole = el("div", { class: "p-lane-role benevoles" });
      bnvRole.appendChild(el("span", { class: "p-lane-role-label" }, "Bénévoles"));
      const currentBnv = entry.benevoles_ids || [];
      const taken = benevoleSlotOccupants(entry);
      // Actifs non pris sur le créneau (+ ceux déjà sélectionnés, même retirés depuis),
      // dispos du jour en tête puis alphabétique.
      const bnvOptions = benevoles
        .filter((b) => (b.actif !== false && !taken.has(b.id)) || currentBnv.includes(b.id))
        .sort((a, b) =>
          (isBenevoleDispo(a, entry) ? 0 : 1) - (isBenevoleDispo(b, entry) ? 0 : 1)
          || compareByNom(a, b));
      bnvRole.appendChild(chipsSelect(bnvOptions, currentBnv,
        (ids) => saveEntry(lid, { benevoles_ids: ids }), null, {
          labelFn: (b) => b.display,
          placeholder: "Bénévoles…",
          itemBadge: (b) => isBenevoleDispo(b, entry)
            ? el("span", { class: "bnv-dispo-badge" }, "dispo") : null,
        }));
      participants.appendChild(bnvRole);
    }
```

NB : côté stagiaire, `benevoles` vient de la RPC ({id, display}) : pas de `dispos` ni `actif` → tri stable, pas de badge, chips en lecture seule comme les élèves (le dropdown est inoffensif : `saveEntry` sort sur `!isAdmin()` et la RLS bloque).

- [ ] **Étape 4.3 : CSS**

Dans `css/style.css`, près des styles chips planning :

```css
/* Bénévoles (voiture) : badge dispo dans le menu déroulant */
.bnv-dispo-badge {
  margin-left: auto;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 999px;
  padding: 0 0.45rem;
  flex: none;
}
.chips-dropdown-item .bnv-dispo-badge { margin-left: 0.5rem; }
```

(Le label « Bénévoles » réutilise `.p-lane-role-label`, les chips réutilisent `.chips-select` : rien d'autre à styler. Le `.read-only` existant masque déjà le `x` des chips.)

- [ ] **Étape 4.4 : vérifier en preview**

`node scripts/cache-bust.js`, recharger : sur une carte Voiture (conduite), le champ Bénévoles apparaît sous Élèves ; la banque étant vide, le menu est vide : ajouter une ligne de test en SQL (`insert into benevoles (prenom, nom, telephone, niveau, boite, heures, auto_ecole, dispos) values ('Test', 'Benevole', '0600000000', 'C2', 'Manuelle', 12, 'ECF Test', '{"MARDI": ["matin"]}'::jsonb);` via `execute_sql`, ligne de test supprimée en tâche 7), vérifier : sélection → chip « B. Test », reload → persiste, badge « dispo » sur une carte du mardi matin, absent ailleurs. Drag & drop d'une carte voiture : les bénévoles suivent.

- [ ] **Étape 4.5 : commit**

```bash
git add js/views/planning.js css/style.css
git commit -m "feat(benevoles): champ Benevoles sur les cartes Voiture (chips + dispo)"
```

---

## Tâche 5 : impression

**Fichiers :**
- Modifier : `js/views/planning.js` (lookup l.1766, entryHasContent l.1792, printEntryCell l.1800)
- Modifier : `css/style.css` (règles `.pp-*`, HORS `@media print` : elles s'appliquent au conteneur caché mesurable)

- [ ] **Étape 5.1 : lookup + contenu**

Après `lookupStagiaire` (l.1767) :

```js
function lookupBenevole(id) { return benevoles.find((b) => b.id === id)?.display || ""; }
```

Dans `entryHasContent` (l.1792), ajouter la condition :

```js
      || hasPed || hasEl || effBenevolesIds(e).length > 0;
```

- [ ] **Étape 5.2 : bloc bénévoles dans printEntryCell**

Après le bloc `addTableau`/`addEleves` (l.1848-1856), avant les notes :

```js
  // Bénévoles (voiture) : sous les élèves moniteurs, en italique. Format « N. Prénom »
  // (banque séparée : pas de dédoublonnage avec les prénoms des stagiaires).
  const bnvNames = effBenevolesIds(e).map(lookupBenevole).filter(Boolean);
  if (bnvNames.length) {
    cell.appendChild(el("div", { class: "pp-line" }, el("span", { class: "pp-key" }, "Bénévoles :")));
    bnvNames.forEach((n) => cell.appendChild(el("div", { class: "pp-line pp-eleve pp-benevole" }, n)));
  }
```

- [ ] **Étape 5.3 : CSS impression**

À côté des autres règles `.pp-` (hors `@media print`) :

```css
.pp-benevole { font-style: italic; }
```

- [ ] **Étape 5.4 : vérifier**

Preview : Ctrl+P sur le planning avec une carte voiture garnie (élèves + bénévole de test) → l'aperçu liste « Bénévoles : » + noms en italique, 1 page, pas de débordement.

- [ ] **Étape 5.5 : commit**

```bash
git add js/views/planning.js css/style.css
git commit -m "feat(benevoles): benevoles a l'impression du planning"
```

---

## Tâche 6 : panneau de gestion + bouton barre semaine

**Fichiers :**
- Créer : `js/views/benevoles.js`
- Modifier : `js/views/planning.js` (import + bouton dans renderInto l.1728-1743)
- Modifier : `css/style.css` (styles `.bnv-*` du panneau)

- [ ] **Étape 6.1 : module benevoles.js**

Créer `js/views/benevoles.js` (les `?v=` seront posés par le hook de commit) :

```js
// Panneau « Élèves bénévoles » : banque des volontaires conduite, réservé
// formateur/admin (le bouton d'ouverture n'est rendu que pour eux, la table est
// RLS admin-only). Ouvert depuis la barre semaine du Planning.
import { listBenevoles, addBenevole, updateBenevole, setBenevoleActif } from "../db.js";
import { el, clear, toast, displayStagiaire, compareByNom } from "../utils.js";
import { JOURS } from "../config.js";

const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const DEMI = [{ key: "matin", label: "matin", court: "m" }, { key: "aprem", label: "après-midi", court: "am" }];
const NIVEAUX = ["C1", "C2", "C3", "C4"];
const BOITES = ["Manuelle", "Automatique"];

function dispoBadges(b) {
  const wrap = el("span", { class: "bnv-badges" });
  JOURS.forEach((j, i) => {
    const halves = (b.dispos?.[j] || []).map((h) => DEMI.find((d) => d.key === h)?.court).filter(Boolean);
    if (halves.length) wrap.appendChild(el("span", { class: "bnv-badge" }, `${JOURS_COURTS[i]} ${halves.join("+")}`));
  });
  if (!wrap.children.length) wrap.appendChild(el("span", { class: "bnv-badge empty" }, "dispos non renseignées"));
  return wrap;
}

function metaLine(b) {
  const parts = [b.niveau, b.boite, (b.heures != null && b.heures !== "") ? `${b.heures}h` : null, b.auto_ecole]
    .filter((v) => v != null && String(v).trim() !== "");
  return parts.join(" · ");
}

function telLink(tel) {
  if (!tel || !String(tel).trim()) return null;
  return el("a", { class: "bnv-tel", href: "tel:" + String(tel).replace(/[^+\d]/g, "") }, tel);
}

export function openBenevolesPanel({ onClose } = {}) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const modal = el("div", { class: "modal bnv-modal" });
  backdrop.appendChild(modal);

  let list = [];
  let filtre = { jour: "", demi: "" };
  let dirty = false;  // au moins une écriture → le planning recharge sa banque à la fermeture

  const close = () => { backdrop.remove(); if (dirty && onClose) onClose(); };
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });

  function matchesFiltre(b) {
    const d = b.dispos || {};
    if (filtre.jour && filtre.demi) return (d[filtre.jour] || []).includes(filtre.demi);
    if (filtre.jour) return (d[filtre.jour] || []).length > 0;
    if (filtre.demi) return JOURS.some((j) => (d[j] || []).includes(filtre.demi));
    return true;
  }

  function renderList() {
    clear(modal);
    modal.appendChild(el("h3", {}, "Élèves bénévoles"));
    modal.appendChild(el("p", { class: "muted bnv-intro" },
      "Volontaires qui viennent conduire avec les élèves moniteurs. Visible uniquement par les formateurs/admins."));

    // Filtre dispo + ajout
    const jourSel = el("select");
    jourSel.appendChild(el("option", { value: "" }, "Tous les jours"));
    JOURS.forEach((j, i) => jourSel.appendChild(el("option", { value: j }, JOURS_COURTS[i] + (j === filtre.jour ? "" : ""))));
    jourSel.value = filtre.jour;
    jourSel.addEventListener("change", () => { filtre.jour = jourSel.value; renderList(); });

    const demiSel = el("select");
    demiSel.appendChild(el("option", { value: "" }, "Matin + après-midi"));
    DEMI.forEach((d) => demiSel.appendChild(el("option", { value: d.key }, d.label)));
    demiSel.value = filtre.demi;
    demiSel.addEventListener("change", () => { filtre.demi = demiSel.value; renderList(); });

    const addBtn = el("button", { class: "btn small primary", onClick: () => renderForm(null) }, "+ Ajouter");
    modal.appendChild(el("div", { class: "bnv-toolbar" },
      el("span", { class: "bnv-filter-label" }, "Dispo :"), jourSel, demiSel,
      el("span", { style: "flex:1" }), addBtn));

    const actifs = list.filter((b) => b.actif !== false).filter(matchesFiltre).sort(compareByNom);
    const retires = list.filter((b) => b.actif === false).sort(compareByNom);

    if (!actifs.length) {
      modal.appendChild(el("p", { class: "muted bnv-empty" },
        list.length ? "Personne ne correspond à ce filtre." : "Banque vide. Ajoute un premier bénévole."));
    }
    actifs.forEach((b) => {
      const row = el("div", { class: "bnv-row" });
      const info = el("div", { class: "bnv-info" });
      info.appendChild(el("div", { class: "bnv-name" }, displayStagiaire(b)));
      const meta = metaLine(b);
      if (meta) info.appendChild(el("div", { class: "bnv-meta" }, meta));
      info.appendChild(dispoBadges(b));
      if (b.dispo_note) info.appendChild(el("div", { class: "bnv-note" }, b.dispo_note));
      row.appendChild(info);
      const side = el("div", { class: "bnv-side" });
      const tel = telLink(b.telephone);
      if (tel) side.appendChild(tel);
      side.appendChild(el("button", { class: "btn small ghost", onClick: () => renderForm(b) }, "Modifier"));
      row.appendChild(side);
      modal.appendChild(row);
    });

    if (retires.length) {
      const det = el("details", { class: "bnv-retires" });
      det.appendChild(el("summary", {}, `Retirés de la banque (${retires.length})`));
      retires.forEach((b) => {
        det.appendChild(el("div", { class: "bnv-row inactive" },
          el("div", { class: "bnv-info" }, el("div", { class: "bnv-name" }, displayStagiaire(b))),
          el("div", { class: "bnv-side" },
            el("button", { class: "btn small ghost", onClick: async () => {
              await setBenevoleActif(b.id, true); dirty = true; await reload(); renderList();
            }}, "Réactiver"))));
      });
      modal.appendChild(det);
    }

    modal.appendChild(el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  }

  function renderForm(b) {
    clear(modal);
    modal.appendChild(el("h3", {}, b ? "Modifier " + displayStagiaire(b) : "Nouveau bénévole"));

    const prenomIn = el("input", { type: "text", value: b?.prenom || "", autocomplete: "off" });
    const nomIn = el("input", { type: "text", value: b?.nom || "", autocomplete: "off" });
    const telIn = el("input", { type: "tel", value: b?.telephone || "", autocomplete: "off", placeholder: "06 12 34 56 78" });
    const heuresIn = el("input", { type: "number", min: "0", step: "0.5", value: b?.heures ?? "" });
    const autoEcoleIn = el("input", { type: "text", value: b?.auto_ecole || "", autocomplete: "off", placeholder: "ECF Nîmes…" });
    const dispoNoteIn = el("input", { type: "text", value: b?.dispo_note || "", autocomplete: "off", placeholder: "à partir de 17h, pas pendant ses exams…" });
    const notesIn = el("input", { type: "text", value: b?.notes || "", autocomplete: "off" });

    const niveauSel = el("select");
    niveauSel.appendChild(el("option", { value: "" }, "Niveau…"));
    NIVEAUX.forEach((n) => niveauSel.appendChild(el("option", { value: n }, n)));
    niveauSel.value = b?.niveau || "";

    const boiteSel = el("select");
    boiteSel.appendChild(el("option", { value: "" }, "Boîte…"));
    BOITES.forEach((x) => boiteSel.appendChild(el("option", { value: x }, x)));
    boiteSel.value = b?.boite || "";

    // Grille de dispos : 5 jours x 2 demi-journées
    const dispoState = {};
    JOURS.forEach((j) => { dispoState[j] = new Set(b?.dispos?.[j] || []); });
    const grid = el("div", { class: "bnv-dispo-grid" });
    grid.appendChild(el("span", {}, ""));
    DEMI.forEach((d) => grid.appendChild(el("span", { class: "bnv-dispo-head" }, d.label)));
    JOURS.forEach((j, i) => {
      grid.appendChild(el("span", { class: "bnv-dispo-jour" }, JOURS_COURTS[i]));
      DEMI.forEach((d) => {
        const cb = el("input", { type: "checkbox" });
        cb.checked = dispoState[j].has(d.key);
        cb.addEventListener("change", () => { cb.checked ? dispoState[j].add(d.key) : dispoState[j].delete(d.key); });
        grid.appendChild(el("label", { class: "bnv-dispo-cell" }, cb));
      });
    });

    async function save() {
      const prenom = prenomIn.value.trim();
      const nom = nomIn.value.trim();
      if (!prenom || !nom) { toast("Prénom et nom obligatoires", "error"); return; }
      const dispos = {};
      JOURS.forEach((j) => { if (dispoState[j].size) dispos[j] = [...dispoState[j]]; });
      const payload = {
        prenom, nom,
        telephone: telIn.value.trim() || null,
        niveau: niveauSel.value || null,
        boite: boiteSel.value || null,
        heures: heuresIn.value === "" ? null : Number(heuresIn.value),
        auto_ecole: autoEcoleIn.value.trim() || null,
        dispos,
        dispo_note: dispoNoteIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      try {
        if (b) await updateBenevole(b.id, payload);
        else await addBenevole(payload);
        dirty = true;
        await reload();
        renderList();
      } catch (e) {
        console.error(e);
        toast("Erreur d'enregistrement", "error");
      }
    }

    const form = el("div", { class: "modal-form" },
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Prénom *"), prenomIn),
        el("div", { class: "field" }, el("label", {}, "Nom *"), nomIn)),
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Téléphone (visible formateurs)"), telIn),
        el("div", { class: "field" }, el("label", {}, "Auto-école d'origine"), autoEcoleIn)),
      el("div", { class: "bnv-form-3col" },
        el("div", { class: "field" }, el("label", {}, "Niveau"), niveauSel),
        el("div", { class: "field" }, el("label", {}, "Boîte"), boiteSel),
        el("div", { class: "field" }, el("label", {}, "Heures faites"), heuresIn)),
      el("div", { class: "field" }, el("label", {}, "Disponibilités récurrentes"), grid),
      el("div", { class: "field" }, el("label", {}, "Précision dispos"), dispoNoteIn),
      el("div", { class: "field" }, el("label", {}, "Notes"), notesIn),
    );
    modal.appendChild(form);

    const actions = el("div", { class: "modal-actions" });
    if (b && b.actif !== false) {
      actions.appendChild(el("button", { class: "btn ghost bnv-remove", onClick: async () => {
        if (!confirm(`Retirer ${displayStagiaire(b)} de la banque ? (réactivable ensuite)`)) return;
        await setBenevoleActif(b.id, false); dirty = true; await reload(); renderList();
      }}, "Retirer de la banque"));
    }
    actions.appendChild(el("span", { style: "flex:1" }));
    actions.appendChild(el("button", { class: "btn ghost", onClick: renderList }, "Annuler"));
    actions.appendChild(el("button", { class: "btn primary", onClick: save }, "Enregistrer"));
    modal.appendChild(actions);
  }

  async function reload() { list = await listBenevoles(); }

  modal.appendChild(el("div", { class: "loading" }, "Chargement"));
  document.body.appendChild(backdrop);
  reload().then(renderList).catch((e) => {
    console.error(e);
    clear(modal);
    modal.appendChild(el("p", { class: "muted" }, "Erreur de chargement de la banque."));
    modal.appendChild(el("div", { class: "modal-actions" }, el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  });
}
```

- [ ] **Étape 6.2 : bouton dans la barre semaine (planning.js)**

Import : `import { openBenevolesPanel } from "./benevoles.js";`

Dans `renderInto`, dans le bloc `if (admin)` du bouton « Placer la semaine » (l.1729), AVANT `placeBtn` :

```js
    const bnvBtn = el("button", { class: "btn small",
      title: "Banque d'élèves bénévoles (voiture) : fiches, dispos, téléphones",
      onClick: () => openBenevolesPanel({ onClose: async () => {
        benevoles = await loadBenevoles();
        renderInto(currentContainer);
      }}) }, "Bénévoles");
    weekBar.appendChild(bnvBtn);
```

- [ ] **Étape 6.3 : CSS du panneau**

```css
/* === Panneau Élèves bénévoles (banque voiture, admin) === */
.bnv-modal { width: min(680px, calc(100vw - 2rem)); max-height: 88vh; overflow-y: auto; }
.bnv-intro { margin: 0.1rem 0 0.8rem; font-size: 0.85rem; }
.bnv-toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.bnv-filter-label { font-size: 0.82rem; color: var(--muted); }
.bnv-toolbar select { max-width: 11rem; }
.bnv-empty { margin: 1rem 0; }
.bnv-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;
  padding: 0.65rem 0.2rem; border-top: 1px solid var(--line); }
.bnv-row.inactive { opacity: 0.65; }
.bnv-name { font-weight: 600; }
.bnv-meta { font-size: 0.82rem; color: var(--muted); margin-top: 0.1rem; }
.bnv-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; }
.bnv-badge { font-size: 0.7rem; border: 1px solid var(--accent); color: var(--accent);
  border-radius: 999px; padding: 0.05rem 0.5rem; }
.bnv-badge.empty { border-color: var(--line); color: var(--muted); font-style: italic; }
.bnv-note { font-size: 0.78rem; color: var(--muted); font-style: italic; margin-top: 0.25rem; }
.bnv-side { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; flex: none; }
.bnv-tel { font-family: var(--mono, monospace); font-size: 0.85rem; color: var(--accent);
  text-decoration: none; white-space: nowrap; }
.bnv-tel:hover { text-decoration: underline; }
.bnv-retires { margin-top: 1rem; }
.bnv-retires summary { cursor: pointer; font-size: 0.85rem; color: var(--muted); }
.bnv-form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.bnv-form-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem; }
.bnv-dispo-grid { display: grid; grid-template-columns: 3rem 1fr 1fr; gap: 0.25rem 0.5rem;
  align-items: center; }
.bnv-dispo-head { font-size: 0.75rem; color: var(--muted); text-align: center; }
.bnv-dispo-jour { font-size: 0.8rem; font-weight: 600; }
.bnv-dispo-cell { display: flex; justify-content: center; padding: 0.15rem 0; cursor: pointer; }
.bnv-remove { color: var(--danger, #a04a3a); }
@media (max-width: 560px) {
  .bnv-form-2col, .bnv-form-3col { grid-template-columns: 1fr; }
  .bnv-row { flex-direction: column; }
  .bnv-side { flex-direction: row; align-items: center; }
}
```

(Vérifier à l'implémentation les vraies variables CSS du projet : `--muted`, `--line`, `--accent`, `--danger` ; adapter aux noms existants.)

- [ ] **Étape 6.4 : vérifier en preview**

`node scripts/cache-bust.js`, recharger : bouton « Bénévoles » visible en admin dans la barre semaine ; panneau : ajout d'une fiche complète, dispos cochées, badge dans la liste, lien téléphone `tel:`, filtre « mardi matin » qui réduit la liste, retrait + réactivation. Fermer le panneau après une modif → les sélecteurs des cartes voiture reflètent la banque à jour. En « Voir en tant que stagiaire » : pas de bouton, chips voiture visibles en lecture seule.

- [ ] **Étape 6.5 : commit**

```bash
git add js/views/benevoles.js js/views/planning.js css/style.css
git commit -m "feat(benevoles): panneau banque (fiches, dispos, filtre, tel) + bouton planning"
```

---

## Tâche 7 : vérifications finales + documentation

**Fichiers :**
- Modifier : `docs/specs/2026-07-02-eleves-benevoles-design.md` (aligner : exclusion au créneau, italique sans suffixe)
- Modifier : `PROJECT_NOTES.md` (section bénévoles)

- [ ] **Étape 7.1 : supprimer la donnée de test**

`execute_sql` : `delete from benevoles where prenom = 'Test' and nom = 'Benevole';` (donnée de test de la tâche 4, pas une donnée versionnée).

- [ ] **Étape 7.2 : passe de vérification complète en preview**

- Admin : ajout bénévole réel fictif → placement sur carte voiture → impression 1 page avec « Bénévoles : » en italique → drag & drop → reload.
- « Voir en tant que stagiaire » : pas de bouton Bénévoles, prénoms visibles sur les cartes, aucun téléphone nulle part dans le DOM (`document.body.innerHTML.includes("06")` sur la vue planning).
- RLS : vérifier via `get_advisors` + relire les 4 policies. La preuve forte (session stagiaire réelle) sera le test utilisateur avant push.
- Console : aucune erreur sur navigation planning ↔ autres onglets (le `#print-container` se démonte).

- [ ] **Étape 7.3 : documenter + commit final**

Mettre à jour la spec (2 points d'alignement) et PROJECT_NOTES.md (résumé : table benevoles RLS admin-only, RPC benevoles_noms, colonne benevoles_ids, panneau via bouton Planning, gotchas : RPC = seule surface stagiaire, retrait doux).

```bash
git add docs/specs/2026-07-02-eleves-benevoles-design.md PROJECT_NOTES.md
git commit -m "docs(benevoles): alignement spec + PROJECT_NOTES"
```

Ne PAS pousser : l'utilisateur valide en preview locale puis pousse lui-même (`git push origin main` après merge de la branche `benevoles`).
