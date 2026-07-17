# Auto-écoles partenaires + suivi bénévoles : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Banque d'auto-écoles partenaires (contacts), affiliation des bénévoles par clé étrangère, et fiche de suivi des venues déduite du planning avec commentaires par venue.

**Architecture :** Table `auto_ecoles` + FK `benevoles.auto_ecole_id` (le texte libre est migré puis supprimé) + table `benevole_suivi` (commentaires, clé = bénévole × demi-journée). Les venues ne sont pas stockées : lues depuis `planning_entries.benevoles_ids`. UI entièrement dans le panneau existant (`js/views/benevoles.js`), qui passe à 2 onglets.

**Tech stack :** Vanilla JS, Supabase (MCP `apply_migration`), CSS maison. Spec : `docs/specs/2026-07-05-auto-ecoles-partenaires-design.md`.

**Vérification :** pas de framework de test. Syntaxe via `node --check` (copie .mjs dans le scratchpad), RLS par simulation SQL (`set local role authenticated` + `request.jwt.claims`), UI par injection DOM mesurée dans la preview (`preview_eval`), l'app étant derrière un gate de connexion. `node scripts/cache-bust.js` à la main avant tout test local de code non commité.

---

## Tâche 1 : migrations (3)

**Fichiers :** aucun (MCP `apply_migration`, projet `crpduennbqaemhfaywrz`).

- [ ] **Étape 1.1 : migration `add_auto_ecoles`**

```sql
-- Banque d'auto-écoles partenaires (contacts pour recruter des élèves bénévoles).
-- Réservée aux admins (formateurs) : coordonnées de tiers, aucune surface stagiaire.
create table public.auto_ecoles (
  id          serial primary key,
  nom         text not null,
  referent    text,             -- la personne à appeler
  telephone   text,
  email       text,
  adresse     text,
  notes       text,
  actif       boolean not null default true,   -- retrait doux
  created_at  timestamptz not null default now()
);

alter table public.auto_ecoles enable row level security;
create policy auto_ecoles_select_admin on public.auto_ecoles for select to authenticated using (is_admin());
create policy auto_ecoles_insert_admin on public.auto_ecoles for insert to authenticated with check (is_admin());
create policy auto_ecoles_update_admin on public.auto_ecoles for update to authenticated using (is_admin()) with check (is_admin());
create policy auto_ecoles_delete_admin on public.auto_ecoles for delete to authenticated using (is_admin());

revoke all on table public.auto_ecoles from anon;
grant select, insert, update, delete on table public.auto_ecoles to authenticated;
grant usage on sequence public.auto_ecoles_id_seq to authenticated;
```

- [ ] **Étape 1.2 : migration `benevoles_affiliation_auto_ecole`**

```sql
-- Affiliation par clé étrangère : le texte libre benevoles.auto_ecole est repris
-- en fiches auto_ecoles puis supprimé. « Sophie » récupère le référent + téléphone
-- des notes de seed du 2026-07-02, notes vidées (le numéro vit sur la fiche).
alter table public.benevoles
  add column auto_ecole_id integer references public.auto_ecoles(id);

insert into public.auto_ecoles (nom)
select distinct trim(auto_ecole) from public.benevoles
where auto_ecole is not null and trim(auto_ecole) <> '';

update public.benevoles b set auto_ecole_id = a.id
from public.auto_ecoles a
where b.auto_ecole is not null and trim(b.auto_ecole) = a.nom;

update public.auto_ecoles set referent = 'Sophie', telephone = '06 16 14 75 14'
where nom = 'Sophie' and referent is null;

update public.benevoles set notes = null
where notes = 'Contact via Sophie : 06 16 14 75 14';

alter table public.benevoles drop column auto_ecole;
```

- [ ] **Étape 1.3 : migration `add_benevole_suivi`**

```sql
-- Commentaires de suivi par venue (une venue = une demi-journée où le bénévole
-- est placé au planning ; les venues elles-mêmes sont déduites de planning_entries).
create table public.benevole_suivi (
  id            serial primary key,
  benevole_id   integer not null references public.benevoles(id) on delete cascade,
  semaine_lundi date not null,
  day_index     integer not null,
  half_day      text not null,
  commentaire   text,
  updated_at    timestamptz not null default now(),
  unique (benevole_id, semaine_lundi, day_index, half_day)
);

alter table public.benevole_suivi enable row level security;
create policy benevole_suivi_select_admin on public.benevole_suivi for select to authenticated using (is_admin());
create policy benevole_suivi_insert_admin on public.benevole_suivi for insert to authenticated with check (is_admin());
create policy benevole_suivi_update_admin on public.benevole_suivi for update to authenticated using (is_admin()) with check (is_admin());
create policy benevole_suivi_delete_admin on public.benevole_suivi for delete to authenticated using (is_admin());

revoke all on table public.benevole_suivi from anon;
grant select, insert, update, delete on table public.benevole_suivi to authenticated;
grant usage on sequence public.benevole_suivi_id_seq to authenticated;
```

- [ ] **Étape 1.4 : vérifier**

`execute_sql` (lecture) :
- `select nom, referent, telephone from auto_ecoles;` → 1 ligne « Sophie · Sophie · 06 16 14 75 14 ».
- `select prenom, auto_ecole_id from benevoles order by id;` → les 7 « de Sophie » pointent l'id de la fiche, Assiya/Chahinez à null.
- `select count(*) from benevoles where notes = 'Contact via Sophie : 06 16 14 75 14';` → 0.
- Simulation RLS stagiaire (`set local role authenticated` + claims email non admin) : `select count(*) from auto_ecoles` → 0 ligne ; idem `benevole_suivi`.
- `get_advisors` security : pas de nouveau finding autre que le pattern SECURITY DEFINER déjà documenté.

---

## Tâche 2 : fonctions db.js

**Fichiers :**
- Modifier : `js/db.js` (après le bloc Élèves bénévoles)

- [ ] **Étape 2.1 : ajouter après `setBenevoleActif`**

```js
// === Auto-écoles partenaires (banque de contacts, RLS admin-only) ===

export async function listAutoEcoles() {
  return cachedQuery("auto_ecoles", async () => {
    const { data, error } = await supabase
      .from("auto_ecoles").select("*").order("nom");
    if (error) throw error;
    return data;
  });
}

export async function addAutoEcole(payload) {
  const { data, error } = await supabase.from("auto_ecoles").insert(payload).select().single();
  if (error) throw error;
  invalidateCache("auto_ecoles");
  return data;
}

export async function updateAutoEcole(id, patch) {
  const { error } = await supabase.from("auto_ecoles").update(patch).eq("id", id);
  if (error) throw error;
  invalidateCache("auto_ecoles");
}

export async function setAutoEcoleActif(id, actif) {
  const { error } = await supabase.from("auto_ecoles").update({ actif }).eq("id", id);
  if (error) throw error;
  invalidateCache("auto_ecoles");
}

// === Suivi des venues des bénévoles ===
// Les venues sont DÉDUITES du planning (cartes Voiture où le bénévole est placé),
// jamais stockées. Seuls les commentaires vivent dans benevole_suivi.

// Toutes les cartes portant au moins un bénévole (pour compter les venues et
// construire la fiche de suivi). Pas de cache : le planning bouge tout le temps.
export async function listVenuesBenevoles() {
  const { data, error } = await supabase
    .from("planning_entries")
    .select("semaine_lundi, day_index, half_day, sujet, eleves_ids, benevoles_ids")
    .neq("benevoles_ids", "{}")
    .order("semaine_lundi", { ascending: false })
    .order("day_index", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listSuiviBenevole(benevole_id) {
  const { data, error } = await supabase
    .from("benevole_suivi").select("*").eq("benevole_id", benevole_id);
  if (error) throw error;
  return data;
}

export async function upsertSuiviBenevole(payload) {
  const { error } = await supabase
    .from("benevole_suivi")
    .upsert({ ...payload, updated_at: new Date().toISOString() },
            { onConflict: "benevole_id,semaine_lundi,day_index,half_day" });
  if (error) throw error;
}
```

- [ ] **Étape 2.2 : commit**

```bash
git add js/db.js
git commit -m "feat(auto-ecoles): tables auto_ecoles + benevole_suivi + fonctions db"
```

---

## Tâche 3 : onglets du panneau + onglet Auto-écoles

**Fichiers :**
- Modifier : `js/views/benevoles.js`
- Modifier : `css/style.css` (bloc `.bnv-*`)

- [ ] **Étape 3.1 : imports et état**

Imports db : ajouter `listAutoEcoles, addAutoEcole, updateAutoEcole, setAutoEcoleActif, listVenuesBenevoles, listSuiviBenevole, upsertSuiviBenevole`. Imports utils : ajouter `isoDate, addDays, formatDayShort` (déjà exportés par utils.js).

Dans `openBenevolesPanel`, à côté de `let list = []` :

```js
  let ecoles = [];
  let venues = [];        // cartes planning portant des bénévoles (venues déduites)
  let tab = "benevoles";  // "benevoles" | "ecoles"
```

`reload()` devient :

```js
  async function reload() {
    [list, ecoles, venues] = await Promise.all([
      listBenevoles(), listAutoEcoles(), listVenuesBenevoles(),
    ]);
  }
```

- [ ] **Étape 3.2 : en-tête à onglets**

Nouvelle fonction avant `renderList` :

```js
  function renderTabs() {
    const tabs = el("div", { class: "bnv-tabs" });
    [["benevoles", "Bénévoles"], ["ecoles", "Auto-écoles"]].forEach(([key, label]) => {
      tabs.appendChild(el("button", {
        class: "bnv-tab" + (tab === key ? " active" : ""), type: "button",
        onClick: () => { if (tab !== key) { tab = key; render(); } },
      }, label));
    });
    return tabs;
  }

  function render() { tab === "ecoles" ? renderEcoles() : renderList(); }
```

Dans `renderList()` : le `h3` devient « Élèves bénévoles et partenaires », insérer `modal.appendChild(renderTabs());` juste après le `h3`, et remplacer tous les appels `renderList()` de fin d'écriture (Réactiver, save, Retirer, Annuler) par `render()` : inchangé pour l'onglet courant, mais uniforme.

- [ ] **Étape 3.3 : onglet Auto-écoles (liste)**

```js
  function ecoleNom(id) { return ecoles.find((a) => a.id === id)?.nom || ""; }

  function mailLink(email) {
    if (!email || !String(email).trim()) return null;
    return el("a", { class: "bnv-tel", href: "mailto:" + String(email).trim() }, email);
  }

  function renderEcoles() {
    clear(modal);
    modal.appendChild(el("h3", {}, "Élèves bénévoles et partenaires"));
    modal.appendChild(renderTabs());
    modal.appendChild(el("p", { class: "muted bnv-intro" },
      "Auto-écoles partenaires : les contacts à appeler pour trouver des élèves bénévoles."));

    const addBtn = el("button", { class: "btn small primary", onClick: () => renderEcoleForm(null) }, "+ Ajouter");
    modal.appendChild(el("div", { class: "bnv-toolbar" }, el("span", { style: "flex:1" }), addBtn));

    const tri = (a, b) => (a.nom || "").localeCompare(b.nom || "", "fr");
    const actives = ecoles.filter((a) => a.actif !== false).sort(tri);
    const retirees = ecoles.filter((a) => a.actif === false).sort(tri);

    if (!actives.length) {
      modal.appendChild(el("p", { class: "muted bnv-empty" }, "Aucune auto-école partenaire pour l'instant."));
    }
    actives.forEach((a) => {
      const affilies = list.filter((b) => b.auto_ecole_id === a.id && b.actif !== false);
      const row = el("div", { class: "bnv-row" });
      const info = el("div", { class: "bnv-info" });
      info.appendChild(el("div", { class: "bnv-name" }, a.nom));
      const metaParts = [a.referent, affilies.length ? `${affilies.length} bénévole(s)` : null]
        .filter(Boolean).join(" · ");
      if (metaParts) info.appendChild(el("div", { class: "bnv-meta" }, metaParts));
      if (a.notes) info.appendChild(el("div", { class: "bnv-note" }, a.notes));
      row.appendChild(info);
      const side = el("div", { class: "bnv-side" });
      const tel = telLink(a.telephone); if (tel) side.appendChild(tel);
      const mail = mailLink(a.email); if (mail) side.appendChild(mail);
      side.appendChild(el("button", { class: "btn small ghost", onClick: () => renderEcoleForm(a) }, "Modifier"));
      row.appendChild(side);
      modal.appendChild(row);
    });

    if (retirees.length) {
      const det = el("details", { class: "bnv-retires" });
      det.appendChild(el("summary", {}, `Retirées (${retirees.length})`));
      retirees.forEach((a) => {
        det.appendChild(el("div", { class: "bnv-row inactive" },
          el("div", { class: "bnv-info" }, el("div", { class: "bnv-name" }, a.nom)),
          el("div", { class: "bnv-side" },
            el("button", { class: "btn small ghost", onClick: async () => {
              try { await setAutoEcoleActif(a.id, true); dirty = true; await reload(); render(); }
              catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
            }}, "Réactiver"))));
      });
      modal.appendChild(det);
    }

    modal.appendChild(el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  }
```

- [ ] **Étape 3.4 : fiche auto-école (avec bénévoles affiliés)**

`onSaved` sert au flux « + Nouvelle auto-école » depuis la fiche bénévole (tâche 4) : appelé avec la fiche créée au lieu de revenir à la liste.

```js
  function renderEcoleForm(a, onSaved) {
    clear(modal);
    modal.appendChild(el("h3", {}, a ? "Modifier " + a.nom : "Nouvelle auto-école"));

    const nomIn = el("input", { type: "text", value: a?.nom || "", autocomplete: "off" });
    const referentIn = el("input", { type: "text", value: a?.referent || "", autocomplete: "off", placeholder: "Sophie…" });
    const telIn = el("input", { type: "tel", value: a?.telephone || "", autocomplete: "off", placeholder: "06 12 34 56 78" });
    const emailIn = el("input", { type: "email", value: a?.email || "", autocomplete: "off" });
    const adresseIn = el("input", { type: "text", value: a?.adresse || "", autocomplete: "off" });
    const notesIn = el("input", { type: "text", value: a?.notes || "", autocomplete: "off" });

    async function save() {
      const nom = nomIn.value.trim();
      if (!nom) { toast("Nom obligatoire", "error"); return; }
      const payload = {
        nom,
        referent: referentIn.value.trim() || null,
        telephone: telIn.value.trim() || null,
        email: emailIn.value.trim() || null,
        adresse: adresseIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      try {
        let saved = a;
        if (a) await updateAutoEcole(a.id, payload);
        else saved = await addAutoEcole(payload);
        dirty = true;
        await reload();
        if (onSaved) onSaved(saved); else render();
      } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
    }

    modal.appendChild(el("div", { class: "modal-form" },
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Nom *"), nomIn),
        el("div", { class: "field" }, el("label", {}, "Référent (qui appeler)"), referentIn)),
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Téléphone"), telIn),
        el("div", { class: "field" }, el("label", {}, "Email"), emailIn)),
      el("div", { class: "field" }, el("label", {}, "Adresse"), adresseIn),
      el("div", { class: "field" }, el("label", {}, "Notes"), notesIn),
    ));

    // Ses bénévoles : l'outil « reprendre contact avec ses élèves »
    if (a) {
      const affilies = list.filter((b) => b.auto_ecole_id === a.id && b.actif !== false).sort(compareByNom);
      const bloc = el("div", { class: "bnv-affilies" });
      bloc.appendChild(el("div", { class: "bnv-affilies-titre" }, `Ses bénévoles (${affilies.length})`));
      if (!affilies.length) bloc.appendChild(el("p", { class: "muted bnv-empty" }, "Aucun bénévole affilié."));
      affilies.forEach((b) => {
        const line = el("div", { class: "bnv-affilie" },
          el("span", { class: "bnv-affilie-nom" }, displayStagiaire(b)));
        if (b.niveau) line.appendChild(el("span", { class: "bnv-affilie-niv" }, b.niveau));
        const tel = telLink(b.telephone); if (tel) line.appendChild(tel);
        bloc.appendChild(line);
      });
      modal.appendChild(bloc);
    }

    const actions = el("div", { class: "modal-actions" });
    if (a && a.actif !== false) {
      actions.appendChild(el("button", { class: "btn ghost bnv-remove", onClick: async () => {
        if (!confirm(`Retirer ${a.nom} des partenaires ? (réactivable ensuite)`)) return;
        try { await setAutoEcoleActif(a.id, false); dirty = true; await reload(); render(); }
        catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
      }}, "Retirer"));
    }
    actions.appendChild(el("span", { style: "flex:1" }));
    actions.appendChild(el("button", { class: "btn ghost", onClick: () => (onSaved ? onSaved(null) : render()) }, "Annuler"));
    actions.appendChild(el("button", { class: "btn primary", onClick: save }, "Enregistrer"));
    modal.appendChild(actions);
  }
```

Le chargement initial du panneau appelle `render()` au lieu de `renderList()`.

- [ ] **Étape 3.5 : CSS onglets + affiliés** (dans le bloc bénévoles de `css/style.css`)

```css
/* Onglets du panneau (Bénévoles / Auto-écoles) */
.bnv-tabs { display: flex; gap: 0.4rem; margin: 0.2rem 0 0.9rem; }
.bnv-tab { border: 1px solid var(--line); border-radius: 999px; padding: 0.3rem 0.95rem;
  background: transparent; cursor: pointer; font-size: 0.85rem; color: var(--text-muted); }
.bnv-tab.active { background: var(--accent-soft); border-color: var(--accent);
  color: var(--accent-strong); font-weight: 600; }
/* Bénévoles affiliés sur la fiche auto-école */
.bnv-affilies { margin-top: 1rem; border-top: 1px solid var(--line); padding-top: 0.7rem; }
.bnv-affilies-titre { font-size: 0.8rem; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.4rem; }
.bnv-affilie { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0; }
.bnv-affilie-nom { font-weight: 500; }
.bnv-affilie-niv { font-size: 0.72rem; color: var(--accent-strong); border: 1px solid var(--accent-soft-2);
  border-radius: 999px; padding: 0 0.4rem; }
.bnv-affilie .bnv-tel { margin-left: auto; }
```

- [ ] **Étape 3.6 : vérifier + commit**

`node scripts/cache-bust.js`, preview : injection DOM d'un `.bnv-modal` avec `.bnv-tabs` + lignes école, mesure sans débordement (même technique que le fix précédent). Syntaxe `node --check`.

```bash
git add js/views/benevoles.js css/style.css
git commit -m "feat(auto-ecoles): onglet Auto-ecoles (liste, fiche, retrait, affilies)"
```

---

## Tâche 4 : affiliation depuis la fiche bénévole

**Fichiers :**
- Modifier : `js/views/benevoles.js` (renderForm, metaLine)

- [ ] **Étape 4.1 : metaLine passe par la banque**

```js
  function metaLine(b, nbVenues) {
    const parts = [b.boite, (b.heures != null && b.heures !== "") ? `${b.heures}h` : null,
      ecoleNom(b.auto_ecole_id) || null, nbVenues ? `${nbVenues} venue${nbVenues > 1 ? "s" : ""}` : null]
      .filter((v) => v != null && String(v).trim() !== "");
    return parts.join(" · ");
  }
```

(`nbVenues` vient de la tâche 5 ; à cette étape, appeler `metaLine(b)` et brancher le compteur en tâche 5.)

- [ ] **Étape 4.2 : select d'affiliation avec « + Nouvelle auto-école »**

Dans `renderForm(b, draft)` (nouveau 2e paramètre : brouillon de valeurs pour le retour du flux quick-add), remplacer `autoEcoleIn` par :

```js
    const v = (champ, defaut) => (draft ? draft[champ] : defaut);
    // ... chaque input existant lit v("prenom", b?.prenom || ""), etc.

    const ecoleSel = el("select");
    ecoleSel.appendChild(el("option", { value: "" }, "Auto-école…"));
    ecoles.filter((x) => x.actif !== false)
      .sort((x, y) => (x.nom || "").localeCompare(y.nom || "", "fr"))
      .forEach((x) => ecoleSel.appendChild(el("option", { value: String(x.id) }, x.nom)));
    ecoleSel.appendChild(el("option", { value: "__new" }, "+ Nouvelle auto-école"));
    ecoleSel.value = v("auto_ecole_id", b?.auto_ecole_id) ? String(v("auto_ecole_id", b?.auto_ecole_id)) : "";

    function collectDraft() {
      const dispos = {};
      JOURS.forEach((j) => { if (dispoState[j].size) dispos[j] = [...dispoState[j]]; });
      return {
        prenom: prenomIn.value, nom: nomIn.value, telephone: telIn.value,
        niveau: niveauSel.value, boite: boiteSel.value, heures: heuresIn.value,
        auto_ecole_id: ecoleSel.value && ecoleSel.value !== "__new" ? Number(ecoleSel.value) : null,
        dispos, dispo_note: dispoNoteIn.value, notes: notesIn.value,
      };
    }

    ecoleSel.addEventListener("change", () => {
      if (ecoleSel.value !== "__new") return;
      const d = collectDraft();
      renderEcoleForm(null, (saved) => {
        if (saved) d.auto_ecole_id = saved.id;
        renderForm(b, d);
      });
    });
```

La grille de dispos s'initialise depuis `v("dispos", b?.dispos)`. Le payload de `save()` remplace `auto_ecole: ...` par :

```js
        auto_ecole_id: ecoleSel.value && ecoleSel.value !== "__new" ? Number(ecoleSel.value) : null,
```

Le label du champ : « Auto-école d'origine » (inchangé), champ pleine largeur sous Téléphone (le 2col Téléphone/Auto-école devient Téléphone seul + le select en dessous, ou garder le 2col avec le select : garder le 2col, le select a `min-width:0` déjà posé par `.bnv-modal .field select`).

- [ ] **Étape 4.3 : vérifier + commit**

Preview : injection DOM du formulaire avec select école, pas de débordement. Syntaxe OK.

```bash
git add js/views/benevoles.js
git commit -m "feat(auto-ecoles): affiliation par select + creation a la volee"
```

---

## Tâche 5 : section Suivi + compteur de venues

**Fichiers :**
- Modifier : `js/views/benevoles.js`
- Modifier : `css/style.css`

- [ ] **Étape 5.1 : venues par bénévole (helpers)**

```js
  // Venues d'un bénévole : regroupe les cartes planning par demi-journée
  // (plusieurs créneaux successifs la même demi-journée = une seule venue).
  function venuesFor(benevoleId) {
    const map = new Map();  // clé "semaine|jour|demi" -> venue
    venues.forEach((e) => {
      if (!(e.benevoles_ids || []).includes(benevoleId)) return;
      const key = `${e.semaine_lundi}|${e.day_index}|${e.half_day}`;
      if (!map.has(key)) {
        map.set(key, { semaine_lundi: e.semaine_lundi, day_index: e.day_index,
          half_day: e.half_day, eleves: new Set(), sujets: new Set() });
      }
      const vn = map.get(key);
      (e.eleves_ids || []).forEach((id) => vn.eleves.add(id));
      if (e.sujet && String(e.sujet).trim()) vn.sujets.add(e.sujet.trim());
    });
    return [...map.values()].sort((a, b) =>
      b.semaine_lundi.localeCompare(a.semaine_lundi) || b.day_index - a.day_index
      || (b.half_day === "aprem" ? 1 : 0) - (a.half_day === "aprem" ? 1 : 0));
  }

  function venueCount(benevoleId) { return venuesFor(benevoleId).length; }

  function venueDate(vn) {
    const monday = new Date(vn.semaine_lundi + "T00:00:00");
    return addDays(monday, vn.day_index);
  }
```

`renderList()` : la ligne meta devient `metaLine(b, venueCount(b.id))`.

- [ ] **Étape 5.2 : section Suivi dans renderForm (bénévole existant seulement)**

Les élèves moniteurs se résolvent avec la liste des stagiaires : `openBenevolesPanel` charge aussi `stagiaires` (`listStagiaires()` ajouté au `Promise.all` de `reload()`, import depuis db.js) et `stagiaireNom(id)` renvoie `displayStagiaire` ou "".

Après le bloc formulaire (avant les actions) :

```js
    if (b) {
      const suiviBloc = el("div", { class: "bnv-suivi" });
      suiviBloc.appendChild(el("div", { class: "bnv-affilies-titre" }, "Suivi des venues"));
      suiviBloc.appendChild(el("p", { class: "muted bnv-empty" }, "Chargement du suivi…"));
      modal.appendChild(suiviBloc);

      listSuiviBenevole(b.id).then((rows) => {
        clear(suiviBloc);
        suiviBloc.appendChild(el("div", { class: "bnv-affilies-titre" }, "Suivi des venues"));
        const comByKey = new Map(rows.map((r) => [`${r.semaine_lundi}|${r.day_index}|${r.half_day}`, r]));
        const vns = venuesFor(b.id);
        const todayIso = isoDate(new Date());

        if (!vns.length && !rows.length) {
          suiviBloc.appendChild(el("p", { class: "muted bnv-empty" }, "Aucune venue planifiée pour l'instant."));
        }

        vns.forEach((vn) => {
          const key = `${vn.semaine_lundi}|${vn.day_index}|${vn.half_day}`;
          const date = venueDate(vn);
          const futur = isoDate(date) > todayIso;
          const head = el("div", { class: "bnv-venue-head" },
            el("span", { class: "bnv-venue-date" },
              `${formatDayShort(date)} ${vn.half_day === "matin" ? "matin" : "après-midi"}`));
          const noms = [...vn.eleves].map(stagiaireNom).filter(Boolean).join(", ");
          if (noms) head.appendChild(el("span", { class: "bnv-venue-avec" }, "avec " + noms));
          if (futur) head.appendChild(el("span", { class: "bnv-venue-futur" }, "à venir"));
          const venueEl = el("div", { class: "bnv-venue" }, head);
          if (vn.sujets.size) venueEl.appendChild(el("div", { class: "bnv-venue-sujet" }, [...vn.sujets].join(", ")));
          if (!futur) {
            const com = comByKey.get(key);
            const input = el("input", { type: "text", class: "bnv-venue-com",
              placeholder: "+ commentaire de séance", value: com?.commentaire || "", autocomplete: "off" });
            input.addEventListener("blur", async () => {
              const val = input.value.trim();
              if (val === (com?.commentaire || "")) return;
              try {
                await upsertSuiviBenevole({ benevole_id: b.id, semaine_lundi: vn.semaine_lundi,
                  day_index: vn.day_index, half_day: vn.half_day, commentaire: val || null });
                if (com) com.commentaire = val; else comByKey.set(key, { commentaire: val });
              } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
            });
            venueEl.appendChild(input);
          }
          suiviBloc.appendChild(venueEl);
        });

        // Commentaires dont le créneau a disparu du planning
        rows.filter((r) => r.commentaire && !vns.some((vn) =>
          `${vn.semaine_lundi}|${vn.day_index}|${vn.half_day}` === `${r.semaine_lundi}|${r.day_index}|${r.half_day}`))
          .forEach((r) => {
            const monday = new Date(r.semaine_lundi + "T00:00:00");
            suiviBloc.appendChild(el("div", { class: "bnv-venue orpheline" },
              el("div", { class: "bnv-venue-head" },
                el("span", { class: "bnv-venue-date" },
                  `${formatDayShort(addDays(monday, r.day_index))} ${r.half_day === "matin" ? "matin" : "après-midi"}`),
                el("span", { class: "bnv-venue-futur" }, "créneau retiré du planning")),
              el("div", { class: "bnv-venue-sujet" }, r.commentaire)));
          });
      }).catch((e) => { console.error(e); });
    }
```

- [ ] **Étape 5.3 : CSS suivi**

```css
/* Suivi des venues (fiche bénévole) */
.bnv-suivi { margin-top: 1rem; border-top: 1px solid var(--line); padding-top: 0.7rem; }
.bnv-venue { padding: 0.45rem 0; border-bottom: 1px dashed var(--line-faint); }
.bnv-venue-head { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.bnv-venue-date { font-weight: 600; font-size: 0.85rem; }
.bnv-venue-avec { font-size: 0.8rem; color: var(--text-muted); }
.bnv-venue-futur { font-size: 0.7rem; border: 1px solid var(--line-strong); color: var(--text-muted);
  border-radius: 999px; padding: 0 0.45rem; }
.bnv-venue-sujet { font-size: 0.8rem; color: var(--accent-strong); margin-top: 0.15rem; }
.bnv-venue-com { width: 100%; margin-top: 0.3rem; font-size: 0.82rem; }
.bnv-venue.orpheline { opacity: 0.75; }
```

- [ ] **Étape 5.4 : vérifier + commit**

Syntaxe `node --check`. Preview : injection DOM d'une fiche avec 2 venues (une passée avec commentaire, une « à venir »), pas de débordement, styles corrects.

```bash
git add js/views/benevoles.js css/style.css
git commit -m "feat(auto-ecoles): fiche de suivi des venues + compteur"
```

---

## Tâche 6 : vérifications finales, docs, mise en ligne

- [ ] **Étape 6.1 : passe complète**

- Syntaxe sur tous les fichiers modifiés ; preview : chargement gate sans erreur console (tout le graphe de modules s'exécute).
- Simulation RLS stagiaire sur `auto_ecoles` et `benevole_suivi` (0 ligne, écriture rejetée).
- `get_advisors` security.

- [ ] **Étape 6.2 : PROJECT_NOTES.md**

Ajouter `auto_ecoles` et `benevole_suivi` au tableau des tables (affiliation FK, suivi = venues déduites du planning + commentaires) et compléter la ligne Planning (onglets du panneau).

```bash
git add PROJECT_NOTES.md
git commit -m "docs(auto-ecoles): PROJECT_NOTES a jour"
```

- [ ] **Étape 6.3 : merge + push + déploiement**

```bash
git checkout main
git pull origin main   # d'autres sessions poussent sur ce repo
git merge auto-ecoles  # en cas de conflits de tokens ?v= : résoudre hunk par hunk, jamais de checkout de fichier entier
git push origin main
```

Puis surveiller le build Pages (`gh api repos/watchi64/ecsr-promo/pages/builds/latest`), relancer via POST s'il reste coincé en « building », et confirmer le token servi sur https://watchi64.github.io/ecsr-promo/.
