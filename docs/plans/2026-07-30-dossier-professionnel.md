# Dossier Professionnel dans l'app · plan d'implémentation

> **Pour les agents :** utiliser `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes sont en
> cases à cocher (`- [ ]`).

**Objectif :** permettre à chaque stagiaire de remplir son Dossier Professionnel dans
l'app, puis de l'imprimer ou l'enregistrer en PDF au format officiel du ministère.

**Architecture :** la mécanique du livret officiel EPCF (champs `contenteditable`, autosave
`jsonb`, clone d'impression) est extraite dans un module partagé `js/doc-officiel.js`. Une
nouvelle vue `js/views/dp.js` porte le gabarit du DP et la logique de rôle, avec une table
`dp_dossiers` dont la RLS donne l'écriture au seul stagiaire propriétaire.

**Stack :** HTML/CSS/JS vanilla en modules ES, Supabase Postgres avec RLS, GitHub Pages.
Aucune dépendance nouvelle.

**Spec :** `docs/specs/2026-07-30-dossier-professionnel-design.md`
**Modèle source :** `docs/specs/2026-07-30-dp-modele-source.docx`

## Contraintes globales

Elles s'appliquent à **toutes** les tâches.

- **Worktree :** tout le travail se fait dans `C:\Users\watch\Dev\ECSR\TP_ECSR_App-wt-dp`,
  branche `dp-dossier-professionnel`. Ne jamais faire de `checkout` dans `TP_ECSR_App`
  (dossier partagé entre sessions, figé sur `main`).
- **Langue :** tout le texte visible est en français.
- **Jamais d'em-dash (`—`)** nulle part : ni dans l'interface, ni dans les commentaires, ni
  dans les commits. Utiliser `:`, `.`, `,` ou `·`.
- **« Formateur »**, jamais « Prof », dans les libellés visibles.
- **Affichage des stagiaires :** toujours via `displayStagiaire(s)` (« V. Timy »), tri par
  nom de famille via `compareByNom`.
- **Pas de framework**, pas de dépendance npm, pas de gamification.
- **Migrations Supabase** uniquement via l'outil MCP `apply_migration` sur le projet
  `crpduennbqaemhfaywrz`. Jamais d'INSERT/UPDATE de structure via `execute_sql`.
- **Cache-bust :** le hook `pre-commit` pose les tokens `?v=` automatiquement. Ne jamais
  éditer un token à la main. Ne jamais rediriger la sortie de `cache-bust.js` vers un
  fichier du projet.
- **Imports :** tout nouvel import de module doit être écrit **sans** `?v=` ; le hook
  s'en charge. Copier la forme des imports existants du fichier voisin.
- **Push :** ne jamais pousser. Commits locaux uniquement, l'utilisateur pousse lui-même.
- **Vérification :** `node --check <fichier>` après chaque édition JS, et `node
  tests/<x>.test.mjs` pour les modules de règles.
- **Déjà en place :** `assets/dp/ministere-emploi.jpg` (logo officiel extrait du modèle) et
  `docs/specs/2026-07-30-dp-modele-source.docx` sont déjà commités. Rien à créer.
- **Échappement :** le gabarit se construit par `innerHTML`. La seule donnée saisie par
  l'utilisateur qui y est injectée est le titre d'un exemple, repris au sommaire : il passe
  obligatoirement par `escapeHtml`. Toutes les autres valeurs entrent par `fillData`, qui
  écrit en `textContent`. Ne jamais injecter une valeur de `data` dans du HTML sans
  `escapeHtml`.

---

### Tâche 1 : règles de composition du DP (`js/dp-rules.js`)

Logique pure et testable : quels blocs composent le document, lesquels sont imprimés, avec
quel numéro de page, et ce que contient le sommaire. Aucun DOM, aucun accès réseau. C'est le
pendant de `js/creneaux-rules.js` et `js/passage-rules.js`.

**Fichiers :**
- Créer : `js/dp-rules.js`
- Créer : `tests/dp-rules.test.mjs`

**Interfaces produites** (utilisées par les tâches 4, 5 et 6) :
- `CHAMPS_EXEMPLE: string[]`
- `cleExemple(at: number, n: number, champ: string): string`
- `exempleRempli(data: object, at: number, n: number): boolean`
- `exempleImprime(data: object, at: number, n: number): boolean`
- `blocsImprimes(data: object): Array<{type: string, at?: number, n?: number, page: number}>`
- `sommaire(data: object): Array<{at: number, n: number, page: number, titre: string}>`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/dp-rules.test.mjs` :

```js
import assert from "node:assert/strict";
import { CHAMPS_EXEMPLE, cleExemple, exempleRempli, exempleImprime,
         blocsImprimes, sommaire } from "../js/dp-rules.js";

// --- Clés de sérialisation ---
assert.equal(cleExemple(1, 2, "taches"), "at1_ex2_taches");
assert.ok(CHAMPS_EXEMPLE.includes("titre"));
assert.ok(CHAMPS_EXEMPLE.includes("complement"));

// --- Un exemple est rempli dès qu'un seul de ses champs porte du texte ---
assert.equal(exempleRempli({}, 1, 1), false);
assert.equal(exempleRempli({ at1_ex1_titre: "   " }, 1, 1), false, "espaces seuls = vide");
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 1), true);
assert.equal(exempleRempli({ at1_ex1_complement: "RAS" }, 1, 1), true);
// Une clé d'un autre exemple ne doit pas déteindre.
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 2), false);
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 2, 1), false);

// --- L'exemple n°1 s'imprime toujours, même vide (DP vierge imprimable) ---
assert.equal(exempleImprime({}, 1, 1), true);
assert.equal(exempleImprime({}, 2, 1), true);
assert.equal(exempleImprime({}, 1, 2), false);
assert.equal(exempleImprime({ at1_ex2_moyens: "Fiches" }, 1, 2), true);

// --- Composition d'un DP vierge : 4 blocs d'ouverture, 2 exemples, 4 de fin ---
const vierge = blocsImprimes({});
assert.equal(vierge.length, 10);
assert.deepEqual(vierge.map((b) => b.type),
  ["couverture", "presentation", "sommaire", "intercalaire",
   "exemple", "exemple", "titres", "declaration", "documents", "annexes"]);
assert.deepEqual(vierge.map((b) => b.page), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
// Les deux exemples imprimés sont bien le n°1 de chaque activité-type.
assert.deepEqual(vierge.filter((b) => b.type === "exemple").map((b) => [b.at, b.n]),
  [[1, 1], [2, 1]]);

// --- DP complet : 6 exemples, 14 blocs ---
const plein = {};
for (const at of [1, 2]) for (const n of [1, 2, 3]) plein[cleExemple(at, n, "titre")] = `T${at}${n}`;
const tout = blocsImprimes(plein);
assert.equal(tout.length, 14);
assert.equal(tout.find((b) => b.type === "declaration").page, 12);
assert.equal(tout.find((b) => b.type === "annexes").page, 14);

// --- Cas intermédiaire : AT1 a 3 exemples, AT2 seulement le premier ---
const mixte = { at1_ex2_titre: "B", at1_ex3_titre: "C" };
const blocs = blocsImprimes(mixte);
assert.deepEqual(blocs.filter((b) => b.type === "exemple").map((b) => [b.at, b.n, b.page]),
  [[1, 1, 5], [1, 2, 6], [1, 3, 7], [2, 1, 8]]);
assert.equal(blocs.find((b) => b.type === "titres").page, 9);

// --- Sommaire : titres saisis et pages, exemples non imprimés absents ---
assert.deepEqual(sommaire(mixte),
  [{ at: 1, n: 1, page: 5, titre: "" },
   { at: 1, n: 2, page: 6, titre: "B" },
   { at: 1, n: 3, page: 7, titre: "C" },
   { at: 2, n: 1, page: 8, titre: "" }]);
// Le titre est nettoyé de ses espaces de bord.
assert.deepEqual(sommaire({ at1_ex1_titre: "  Première leçon  " })[0].titre, "Première leçon");

// --- Robustesse : data absent ne doit pas jeter ---
assert.equal(exempleRempli(null, 1, 1), false);
assert.equal(blocsImprimes(null).length, 10);

console.log("dp-rules : OK");
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
node tests/dp-rules.test.mjs
```

Attendu : échec `Cannot find module '../js/dp-rules.js'`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `js/dp-rules.js` :

```js
// Règles de composition du Dossier Professionnel : quels blocs composent le
// document imprimé, dans quel ordre, avec quel numéro de page, et ce que
// contient le sommaire. Logique pure (aucun DOM, aucun réseau) pour rester
// testable en node, comme creneaux-rules.js et passage-rules.js.

// Les 5 rubriques officielles d'un exemple de pratique professionnelle, à plat.
export const CHAMPS_EXEMPLE = [
  "titre", "taches", "moyens", "avec_qui",
  "entreprise", "service", "du", "au", "complement",
];

// Blocs fixes encadrant les exemples, dans l'ordre du document officiel.
const BLOCS_AVANT = ["couverture", "presentation", "sommaire", "intercalaire"];
const BLOCS_APRES = ["titres", "declaration", "documents", "annexes"];

export function cleExemple(at, n, champ) {
  return `at${at}_ex${n}_${champ}`;
}

function txt(data, cle) {
  return String((data && data[cle]) || "").trim();
}

// Un exemple est « rempli » dès qu'une seule de ses rubriques porte du texte.
export function exempleRempli(data, at, n) {
  return CHAMPS_EXEMPLE.some((c) => txt(data, cleExemple(at, n, c)) !== "");
}

// L'exemple n°1 de chaque activité-type s'imprime toujours, même vide : un DP
// vierge doit rester imprimable pour être rempli à la main. Le DP officiel
// demande « un à trois exemples » par activité-type.
export function exempleImprime(data, at, n) {
  return n === 1 || exempleRempli(data, at, n);
}

// Blocs réellement imprimés, numérotés de 1 à N. Le numéro de page suit les
// rubriques du dossier, ce qui garde le sommaire cohérent avec le document.
export function blocsImprimes(data) {
  const blocs = BLOCS_AVANT.map((type) => ({ type }));
  for (const at of [1, 2]) {
    for (const n of [1, 2, 3]) {
      if (exempleImprime(data, at, n)) blocs.push({ type: "exemple", at, n });
    }
  }
  BLOCS_APRES.forEach((type) => blocs.push({ type }));
  return blocs.map((b, i) => ({ ...b, page: i + 1 }));
}

// Entrées du sommaire : un exemple imprimé par ligne, avec le titre saisi par
// le candidat et le numéro de page calculé.
export function sommaire(data) {
  return blocsImprimes(data)
    .filter((b) => b.type === "exemple")
    .map((b) => ({ at: b.at, n: b.n, page: b.page,
                   titre: txt(data, cleExemple(b.at, b.n, "titre")) }));
}
```

- [ ] **Étape 4 : lancer le test pour le voir passer**

```bash
node tests/dp-rules.test.mjs
```

Attendu : `dp-rules : OK`, sortie sans erreur.

- [ ] **Étape 5 : commit**

```bash
git add js/dp-rules.js tests/dp-rules.test.mjs
git commit -m "DP : regles de composition du dossier (blocs, pagination, sommaire)"
```

---

### Tâche 2 : table `dp_dossiers`, RLS et accès base

Le stockage, calqué sur `epcf_livrets`, avec la RLS inversée : le stagiaire écrit son
dossier, les formateurs le lisent seulement.

**Fichiers :**
- Modifier : `js/db.js` (ajouter une section après celle du livret EPCF, qui commence
  ligne 683 par `// === Livret officiel EPCF`)
- Créer : `docs/specs/2026-07-30-dp-migration.sql` (copie de référence de la migration)

**Interfaces produites** (utilisées par la tâche 5) :
- `listDpDossiers(): Promise<Array<{id, stagiaire_id, data, updated_at}>>`
- `getDpDossier(stagiaireId: number): Promise<object|null>`
- `upsertDpDossier({stagiaire_id, data, updated_by_who}): Promise<object>`

- [ ] **Étape 1 : relever les GRANT du livret pour les reproduire à l'identique**

Via l'outil MCP `execute_sql` sur le projet `crpduennbqaemhfaywrz` :

```sql
select grantee, privilege_type from information_schema.role_table_grants
where table_name = 'epcf_livrets' order by grantee, privilege_type;
```

Noter le résultat : la migration doit accorder **les mêmes rôles** (un GRANT manquant fait
échouer la requête même quand la RLS l'autorise, incident déjà rencontré sur les QCM).

- [ ] **Étape 2 : appliquer la migration**

Via l'outil MCP `apply_migration`, nom `create_dp_dossiers` :

```sql
create table public.dp_dossiers (
  id bigint generated always as identity primary key,
  stagiaire_id integer not null unique references public.stagiaires(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_by_who text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dp_dossiers enable row level security;

-- Lecture : formateurs et admins voient tous les dossiers, un stagiaire ne voit que le sien.
create policy dp_dossiers_select on public.dp_dossiers
  for select using (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id());

-- Écriture réservée au candidat propriétaire (le DP lui appartient), admin pour dépannage.
create policy dp_dossiers_insert on public.dp_dossiers
  for insert with check (is_admin() or stagiaire_id = my_stagiaire_id());

create policy dp_dossiers_update on public.dp_dossiers
  for update using (is_admin() or stagiaire_id = my_stagiaire_id())
          with check (is_admin() or stagiaire_id = my_stagiaire_id());

create policy dp_dossiers_delete on public.dp_dossiers
  for delete using (is_admin());

grant select, insert, update, delete on public.dp_dossiers to authenticated;
```

Si l'étape 1 a montré des GRANT sur d'autres rôles que `authenticated`, ajouter les mêmes
lignes `grant` avant d'appliquer.

- [ ] **Étape 3 : vérifier la RLS par simulation de rôle**

Technique déjà employée sur `benevoles` et `epcf_livrets`. Via `execute_sql`, relever
d'abord un `stagiaire_id` et l'`user_id` d'un compte formateur :

```sql
select polname, cmd, qual, with_check from pg_policies p
join pg_policy pol on pol.polname = p.policyname
where p.tablename = 'dp_dossiers' order by polname;
```

Attendu, exactement :

| polname | cmd | qual | with_check |
|---|---|---|---|
| dp_dossiers_delete | DELETE | `is_admin()` | null |
| dp_dossiers_insert | INSERT | null | `(is_admin() OR (stagiaire_id = my_stagiaire_id()))` |
| dp_dossiers_select | SELECT | `(is_admin() OR is_prof() OR (stagiaire_id = my_stagiaire_id()))` | null |
| dp_dossiers_update | UPDATE | `(is_admin() OR (stagiaire_id = my_stagiaire_id()))` | idem |

Le point critique à confirmer : **aucune politique d'écriture ne mentionne `is_prof()`**.

- [ ] **Étape 4 : conserver la migration dans le dépôt**

Écrire le SQL exact appliqué à l'étape 2 dans `docs/specs/2026-07-30-dp-migration.sql`
(le dépôt garde une trace lisible des migrations, comme
`docs/specs/2026-07-19-absences-migration.sql`).

- [ ] **Étape 5 : ajouter les accès dans `js/db.js`**

Insérer juste après la section du livret EPCF (après `getEpcfMoyennes`), en copiant
strictement la forme des fonctions voisines :

```js
// === Dossier Professionnel (document ministère, 1 dossier / stagiaire) ===
// Le DP appartient au candidat : la RLS n'autorise l'écriture qu'à son
// propriétaire (et à un admin). Les formateurs y ont un accès en lecture.

export async function listDpDossiers() {
  const { data, error } = await supabase
    .from("dp_dossiers")
    .select("id, stagiaire_id, data, updated_at");
  if (error) throw error;
  return data;
}

export async function getDpDossier(stagiaireId) {
  const { data, error } = await supabase
    .from("dp_dossiers")
    .select("*")
    .eq("stagiaire_id", stagiaireId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Upsert par stagiaire (contrainte UNIQUE stagiaire_id côté base).
export async function upsertDpDossier({ stagiaire_id, data, updated_by_who }) {
  const { data: row, error } = await supabase
    .from("dp_dossiers")
    .upsert(
      { stagiaire_id, data, updated_by_who, updated_at: new Date().toISOString() },
      { onConflict: "stagiaire_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return row;
}
```

- [ ] **Étape 6 : vérifier la syntaxe**

```bash
node --check js/db.js
```

Attendu : aucune sortie.

- [ ] **Étape 7 : commit**

```bash
git add js/db.js docs/specs/2026-07-30-dp-migration.sql
git commit -m "DP : table dp_dossiers, RLS proprietaire et acces base"
```

---

### Tâche 3 : extraire le noyau de document officiel (`js/doc-officiel.js`)

La mécanique du livret (sérialisation, édition, clone d'impression, autosave) devient un
module partagé. Le gabarit HTML du livret ne change pas, et ses classes `.lv-f` / `.lv-cb`
sont conservées telles quelles : elles deviennent les classes techniques communes aux
documents officiels, le DP les réutilisera. C'est le choix qui touche le moins de lignes du
fichier validé en production.

**Fichiers :**
- Créer : `js/doc-officiel.js`
- Modifier : `js/views/epcf-livret.js` (retirer les blocs déplacés, importer le module)
- Modifier : `js/main.js:15` et `js/main.js:196` si le nom exporté change
- Vérifier : `_preview_livret.html` (le banc importe des fonctions du livret)

**Interfaces produites** (utilisées par la tâche 5) :
- `collectData(doc: Element): object`
- `fillData(doc: Element, data: object): void`
- `applyEditable(doc: Element): void`
- `wireDocEditing(doc: Element, onChange: () => void, opts?: {names?: string[]}): void`
- `bindDocPrint(doc: Element, {printId: string, bodyClass: string}): void`
- `refreshDocPrint(): void`
- `teardownDocPrint(): void`

- [ ] **Étape 1 : relever ce qui importe le livret**

```bash
grep -rn "epcf-livret" js/ _preview_livret.html
```

Noter chaque symbole importé. Tout symbole encore utilisé ailleurs doit rester exporté par
`epcf-livret.js`, au besoin par ré-export.

- [ ] **Étape 2 : créer le module**

Créer `js/doc-officiel.js` en **déplaçant** (couper, ne pas réécrire) depuis
`js/views/epcf-livret.js` : `collectData` (l. 275-283), `fillData` (l. 285-293),
`wireDocEditing` (l. 298-404), `refreshPrintClone` (l. 414-438), `teardownLivretPrint`
(l. 440-444), `ensurePrintListeners` (l. 448-462) et l'état `currentDocNode` / `printListenersReady`.

L'état d'impression devient explicite : un seul document officiel est ouvert à la fois (le
livret et le DP sont deux sous-onglets de Notes, jamais affichés ensemble).

```js
// Noyau commun aux documents officiels de l'app (livret EPCF TP-01303, Dossier
// Professionnel). Principe WYSIWYG : le document affiché à l'écran EST le
// document imprimé. Ce module ne connaît aucun document en particulier, il
// porte la mécanique : sérialisation des champs, édition, clone d'impression.
//
// Les classes techniques .lv-f (champ) et .lv-cb (case à cocher) sont communes
// à tous les documents : le préfixe est celui du livret, premier document
// implémenté, et n'a pas été renommé pour ne pas toucher un gabarit validé.

import { el, clear } from "./utils.js";

// ... collectData, fillData déplacés ici sans modification ...

// Rend les champs saisissables. Séparé de wireDocEditing parce que le DP
// reconstruit son document quand sa pagination change : les écouteurs posés sur
// `doc` (délégation) survivent au remplacement de innerHTML, mais l'attribut
// contentEditable des champs, lui, doit être ré-appliqué sur les nouveaux nœuds.
export function applyEditable(doc) {
  doc.querySelectorAll(".lv-f[data-k]").forEach((n) => {
    n.contentEditable = "plaintext-only";
    if (n.contentEditable !== "plaintext-only") n.contentEditable = "true";
  });
}

// ... wireDocEditing déplacé ici, en remplaçant sa première boucle (celle qui
// posait contentEditable, l. 300-303 de l'ancien fichier) par un simple appel
// à applyEditable(doc). Le reste du corps ne change pas ...

// --- Impression : clone du document, enfant direct de <body> ---
// Même architecture éprouvée que l'impression du planning : pas de setTimeout,
// clone rafraîchi avant chaque impression.

let courant = null;              // { doc, printId, bodyClass }
let listenersPrets = false;

export function bindDocPrint(doc, { printId, bodyClass }) {
  courant = { doc, printId, bodyClass };
  ensurePrintListeners();
  refreshDocPrint();
}

export function refreshDocPrint() {
  if (!courant) return;
  const { doc, printId, bodyClass } = courant;
  // Format de page injecté seulement tant qu'un document est ouvert : une règle
  // @page en dur écraserait le « A4 landscape » de l'impression du planning.
  if (!document.getElementById("doc-officiel-page-style")) {
    const st = document.createElement("style");
    st.id = "doc-officiel-page-style";
    st.textContent = "@page { size: A4 portrait; margin: 0; }";
    document.head.appendChild(st);
  }
  let c = document.getElementById(printId);
  if (!c) {
    c = document.createElement("div");
    c.id = printId;
    document.body.appendChild(c);
  }
  clear(c);
  const clone = doc.cloneNode(true);
  clone.classList.remove("lv-screen", "lv-edit");
  clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  clone.querySelectorAll("[tabindex]").forEach((n) => n.removeAttribute("tabindex"));
  clone.querySelectorAll(".lv-datepick, .lv-namepick").forEach((n) => n.remove());
  c.appendChild(clone);
  document.body.classList.add(bodyClass);
}

export function teardownDocPrint() {
  if (courant) {
    document.getElementById(courant.printId)?.remove();
    document.body.classList.remove(courant.bodyClass);
  }
  // Ceinture et bretelles : les deux conteneurs connus, au cas où la route
  // change alors qu'un autre document était monté.
  document.getElementById("livret-print")?.remove();
  document.getElementById("dp-print")?.remove();
  document.body.classList.remove("livret-printable", "dp-printable");
  document.getElementById("doc-officiel-page-style")?.remove();
  courant = null;
}

// Si le document n'est plus à l'écran (sous-onglet changé), on ne doit surtout
// pas intercepter l'impression d'autre chose.
function ensurePrintListeners() {
  if (listenersPrets) return;
  listenersPrets = true;
  const beforePrint = () => {
    if (courant && document.contains(courant.doc)) refreshDocPrint();
    else teardownDocPrint();
  };
  window.addEventListener("beforeprint", beforePrint);
  // iOS Safari n'émet pas beforeprint : matchMedia est son seul signal.
  const mm = window.matchMedia("print");
  const onMm = (e) => { if (e.matches) beforePrint(); };
  if (mm.addEventListener) mm.addEventListener("change", onMm);
  else if (mm.addListener) mm.addListener(onMm);
}
```

Attention en déplaçant `wireDocEditing` : il utilise `el` de `utils.js`, déjà importé
ci-dessus. Ne pas modifier son corps.

- [ ] **Étape 3 : adapter `epcf-livret.js`**

Retirer les blocs déplacés, ajouter l'import, et garder les anciens noms exportés pour ne
rien casser ailleurs :

```js
import { collectData, fillData, wireDocEditing,
         bindDocPrint, refreshDocPrint, teardownDocPrint } from "../doc-officiel.js";

// Noms historiques conservés : main.js et le banc d'essai les importent d'ici.
export { collectData, fillData, wireDocEditing };
export const teardownLivretPrint = teardownDocPrint;
```

Dans `showDoc`, remplacer les trois appels :

| Avant | Après |
|---|---|
| `refreshPrintClone(doc)` (bouton Imprimer) | `refreshDocPrint()` |
| `currentDocNode = doc; ensurePrintListeners(); refreshPrintClone(doc);` | `bindDocPrint(doc, { printId: "livret-print", bodyClass: "livret-printable" });` |
| `refreshPrintCloneSoon()` : `refreshPrintClone(doc)` | `refreshDocPrint()` |

Et dans `showListe`, `teardownLivretPrint()` reste valide grâce à l'alias.

- [ ] **Étape 4 : vérifier la syntaxe des trois fichiers**

```bash
node --check js/doc-officiel.js && node --check js/views/epcf-livret.js && node --check js/main.js
```

Attendu : aucune sortie. `node --check` ne voit pas les imports cassés : l'étape suivante
est celle qui compte.

- [ ] **Étape 5 : non-régression du livret dans le navigateur**

Le livret est un document validé en conditions réelles (impression testée le 19/07) : il
doit ressortir identique.

1. Rafraîchir les tokens en local avant de servir, sinon le navigateur sert l'ancien JS :

```bash
node scripts/cache-bust.js
```

2. Démarrer l'aperçu (outil `preview_start` avec la configuration du dépôt, jamais un
   serveur lancé via Bash) et ouvrir `_preview_livret.html`.
3. Cliquer « Remplir données témoin » : toutes les valeurs doivent apparaître dans les
   champs, les cases cochées doivent l'être.
4. Vérifier la console : zéro erreur (`read_console_messages`).
5. Cliquer dans un champ, taper du texte, vérifier qu'il s'affiche.
6. Cliquer un champ date : le sélecteur « Aujourd'hui / Effacer » doit s'ouvrir.
7. Déclencher l'aperçu d'impression et confirmer 10 pages A4 portrait, cartouches et
   bandeaux magenta présents.

- [ ] **Étape 6 : commit**

```bash
git add js/doc-officiel.js js/views/epcf-livret.js js/main.js
git commit -m "Documents officiels : noyau commun extrait du livret EPCF"
```

---

### Tâche 4 : gabarit du DP et feuille de style

Le document lui-même : 14 blocs A4 portrait reproduisant le modèle officiel, plus un banc
d'essai pour le voir sans authentification.

**Fichiers :**
- Créer : `js/views/dp-gabarit.js`
- Créer : `css/dp.css`
- Créer : `_preview_dp.html`
- Modifier : `index.html:24` (ajouter la feuille, sans token `?v=`, le hook s'en charge)

**Interfaces consommées :** `blocsImprimes`, `sommaire`, `cleExemple` de `js/dp-rules.js`
(tâche 1).
**Interfaces produites** (utilisées par la tâche 5) :
- `buildDpHTML(data: object): string` : le document complet, blocs non imprimés exclus.
- `AT1_TITRE: string`, `AT2_TITRE: string`

- [ ] **Étape 1 : créer la feuille de style**

Créer `css/dp.css`. Elle ne re-déclare **pas** les styles de champ (`.lv-f`, `.lv-cb`,
`.lv-datepick`, les utilitaires `.lv-s10`, `.lv-b`…) : `css/livret.css` est chargé
globalement par `index.html` et les porte déjà.

```css
/* ============================================================================
   Dossier Professionnel (DP) : vue + impression.

   Même principe WYSIWYG que le livret EPCF : le document affiché à l'écran EST
   le document imprimé. Les champs réutilisent les classes .lv-f / .lv-cb de
   css/livret.css, communes à tous les documents officiels.

   Différence volontaire avec le livret : la page a une hauteur MINIMALE et non
   fixe, et ne masque pas son débordement. Un texte long pousse la page au lieu
   d'être coupé. Perdre du texte à l'impression serait pire qu'une numérotation
   qui glisse d'une feuille.
   ========================================================================= */

.dp-doc {
  font-family: Arial, Helvetica, sans-serif;
  color: #000;
  width: 210mm;
  font-size: 11pt;
  /* Impose l'impression des aplats (cartouches gris, bordures) même quand
     l'option « Graphiques d'arrière-plan » du navigateur est décochée. */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.dp-page {
  position: relative;
  width: 210mm;
  min-height: 296.5mm;      /* minimum, pas une hauteur fixe : le texte long pousse */
  box-sizing: border-box;
  background: #fff;
  padding: 18mm 18mm 22mm;
  display: flex;
  flex-direction: column;
}
.dp-screen .dp-page { box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18); margin: 0 0 8mm; }

.dp-doc p { margin: 0; }
.dp-doc table { border-collapse: collapse; table-layout: fixed; width: 100%; }
.dp-doc td, .dp-doc th { vertical-align: top; padding: 1.5mm 2mm; word-wrap: break-word; }

/* En-tête et pied de page officiels, sur chaque bloc. */
.dp-head {
  font-size: 9pt; color: #444;
  border-bottom: 0.5pt solid #999;
  padding-bottom: 1.5mm; margin-bottom: 6mm;
}
.dp-foot {
  margin-top: auto;          /* colle en bas de page grâce au flex du conteneur */
  padding-top: 3mm;
  border-top: 0.5pt solid #999;
  font-size: 8pt; color: #444;
  display: flex; justify-content: space-between; gap: 6mm;
}

/* Titres de rubrique du document */
.dp-h1 { font-size: 20pt; font-weight: 700; text-align: center; margin: 0 0 8mm; }
.dp-h2 { font-size: 14pt; font-weight: 700; margin: 0 0 4mm; }
.dp-question { font-weight: 700; font-size: 11pt; margin: 5mm 0 2mm; }

/* Cartouche d'activité-type en tête de chaque exemple */
.dp-at {
  display: flex; gap: 4mm; align-items: stretch;
  border: 1pt solid #000; margin-bottom: 6mm;
}
.dp-at-num {
  background: #eee; font-weight: 700; font-size: 16pt;
  padding: 3mm 4mm; display: flex; align-items: center;
  border-right: 1pt solid #000; white-space: nowrap;
}
.dp-at-titre { padding: 3mm; font-size: 10pt; align-self: center; }
.dp-ex-num { font-weight: 700; font-size: 12pt; margin: 0 0 4mm; }

/* Zone de rédaction : hauteur nominale généreuse, jamais de coupe. */
.dp-zone { min-height: 32mm; border: 0.5pt solid #bbb; padding: 2mm; }
.dp-zone.dp-zone-petite { min-height: 18mm; }
/* Signalé quand le contenu dépasse la hauteur nominale (classe posée en JS). */
.dp-edit .dp-zone.dp-deborde { border-color: #b45309; box-shadow: inset 0 0 0 1pt #fde68a; }
.dp-deborde-note { font-size: 8pt; color: #b45309; margin-top: 1mm; }
.dp-screen:not(.dp-edit) .dp-deborde-note { display: none; }

/* Couverture */
.dp-cover-logo { width: 42mm; margin: 0 0 10mm; }
.dp-cover-logo img { width: 100%; height: auto; display: block; }
.dp-cover-table td { border: 0.5pt solid #000; }
.dp-cover-label { width: 55mm; background: #f4f4f4; font-weight: 600; }

/* Tableau bordé (titres, diplômes et contexte des exemples) */
.dp-tbl-borde { border: 0.5pt solid #000; }
.dp-tbl-borde td, .dp-tbl-borde th { border: 0.5pt solid #000; }
.dp-tbl-borde th { background: #f4f4f4; text-align: left; }
.dp-col-date { width: 40mm; }

/* Sommaire */
.dp-somm-ligne {
  display: flex; align-items: baseline; gap: 2mm;
  padding: 1.5mm 0; border-bottom: 0.25pt dotted #999;
}
.dp-somm-titre { flex: 1; min-width: 0; }
.dp-somm-vide { color: #999; font-style: italic; }
.dp-somm-page { white-space: nowrap; }

/* Intercalaire et pages de séparation */
.dp-separateur {
  flex: 1; display: flex; align-items: center; justify-content: center;
  text-align: center; font-size: 24pt; font-weight: 700;
}

/* Mise à l'échelle écran, identique au livret. */
.dp-scale-outer { overflow: hidden; }
.dp-scale { transform-origin: top left; }

/* --- Impression --- */
@media print {
  body.dp-printable > *:not(#dp-print) { display: none !important; }
  body.dp-printable #dp-print { display: block !important; }
  #dp-print .dp-page { page-break-after: always; box-shadow: none; margin: 0; }
  #dp-print .dp-page:last-child { page-break-after: auto; }
  /* Le liseré d'alerte est une aide de saisie, il ne s'imprime pas. */
  #dp-print .dp-zone { border-color: #bbb !important; box-shadow: none !important; }
  #dp-print .dp-deborde-note { display: none !important; }
}
/* NB : la règle « @page { size: A4 portrait; margin: 0 } » est injectée en JS
   par doc-officiel.js seulement tant qu'un document est ouvert. En dur ici,
   elle écraserait le « A4 landscape » de l'impression du planning. */
```

- [ ] **Étape 2 : déclarer la feuille dans `index.html`**

Après la ligne `<link rel="stylesheet" href="css/livret.css?v=..." />`, ajouter sans token :

```html
  <link rel="stylesheet" href="css/dp.css" />
```

- [ ] **Étape 3 : écrire le gabarit**

Créer `js/views/dp-gabarit.js`. Le texte officiel est repris du modèle
`docs/specs/2026-07-30-dp-modele-source.docx`, à la lettre.

```js
// Gabarit du Dossier Professionnel : le HTML des blocs A4, reproduisant le
// modèle officiel du ministère chargé de l'emploi (version du 11/09/2017).
// Aucun comportement ici : la vue dp.js s'occupe des rôles, de l'édition et de
// l'enregistrement. Les champs portent les classes .lv-f / .lv-cb communes aux
// documents officiels (voir js/doc-officiel.js).

import { blocsImprimes, sommaire, cleExemple } from "../dp-rules.js";

export const AT1_TITRE = "Former des apprenants conducteurs par des actions individuelles et collectives, dans le respect des cadres réglementaires en vigueur";
export const AT2_TITRE = "Sensibiliser l’ensemble des usagers de la route à l’adoption de comportements sûrs et respectueux de l’environnement";

const PH_TEXTE = "Cliquez ici pour taper du texte.";
const PH_DATE = "Cliquez ici pour choisir une date.";

// Champ d'une ligne / zone de rédaction / case à cocher.
// data-k = clé de sérialisation, data-x = groupe exclusif.
function f(k, ph, extra = "") {
  const date = ph === PH_DATE ? " lv-date" : "";
  return `<span class="lv-f ${extra}${date}" data-k="${k}" data-ph="${ph || PH_TEXTE}"></span>`;
}
function zone(k, petite) {
  return `<div class="lv-f dp-zone${petite ? " dp-zone-petite" : ""}" data-k="${k}" data-ph="${PH_TEXTE}"></div>`
       + `<p class="dp-deborde-note">Ce texte dépasse la place prévue : il ne sera pas coupé, mais il décalera la mise en page.</p>`;
}
function cb(k, group) {
  return `<span class="lv-cb" data-k="${k}"${group ? ` data-x="${group}"` : ""} role="checkbox" tabindex="0"></span>`;
}

function head() {
  return `<div class="dp-head">Dossier Professionnel (DP)</div>`;
}
function foot(page, total) {
  return `<div class="dp-foot">
    <span>DOSSIER PROFESSIONNEL · Version du 11/09/2017</span>
    <span>Page ${page} / ${total}</span>
  </div>`;
}
function page(inner, n, total, cls = "") {
  return `<section class="dp-page ${cls}">${head()}${inner}${foot(n, total)}</section>`;
}

// --- Blocs ---

function blocCouverture(n, total) {
  return page(`
    <div class="dp-cover-logo"><img src="assets/dp/ministere-emploi.jpg" alt="Ministère chargé de l'emploi"></div>
    <p class="dp-h1">Dossier Professionnel</p>
    <table class="dp-cover-table">
      <tr><td class="dp-cover-label">Nom de naissance</td><td>${f("nom_naissance")}</td></tr>
      <tr><td class="dp-cover-label">Nom d’usage</td><td>${f("nom_usage")}</td></tr>
      <tr><td class="dp-cover-label">Prénom</td><td>${f("prenom")}</td></tr>
      <tr><td class="dp-cover-label">Adresse</td><td>${f("adresse")}</td></tr>
    </table>
    <p class="dp-h2" style="margin-top:10mm">Titre professionnel visé</p>
    <p class="lv-b">ENSEIGNANT DE LA CONDUITE ET DE LA SÉCURITÉ ROUTIÈRE</p>
    <p class="dp-h2" style="margin-top:10mm">Modalité d’accès</p>
    <p>${cb("modalite_formation", "modalite")} Parcours de formation</p>
    <p style="margin-top:2mm">${cb("modalite_vae", "modalite")} Validation des Acquis de l’Expérience (VAE)</p>
  `, n, total, "dp-p1");
}

function blocPresentation(n, total) {
  return page(`
    <p class="dp-h1">Présentation du dossier</p>
    <p class="lv-just">Le dossier professionnel (DP) constitue un élément du système de validation du titre professionnel. Ce titre est délivré par le Ministère chargé de l’emploi.</p>
    <p class="lv-just" style="margin-top:3mm">Le DP appartient au candidat. Il le conserve, l’actualise durant son parcours et le présente obligatoirement à chaque session d’examen.</p>
    <p class="lv-just" style="margin-top:3mm">Pour rédiger le DP, le candidat peut être aidé par un formateur ou par un accompagnateur VAE. Il est consulté par le jury au moment de la session d’examen.</p>
    <p style="margin-top:5mm">Pour prendre sa décision, le jury dispose :</p>
    <ul>
      <li>des résultats de la mise en situation professionnelle complétés, éventuellement, du questionnaire professionnel ou de l’entretien professionnel ou de l’entretien technique ou du questionnement à partir de productions ;</li>
      <li>du Dossier Professionnel (DP) dans lequel le candidat a consigné les preuves de sa pratique professionnelle ;</li>
      <li>des résultats des évaluations passées en cours de formation lorsque le candidat évalué est issu d’un parcours de formation ;</li>
      <li>de l’entretien final (dans le cadre de la session titre).</li>
    </ul>
    <p class="lv-i lv-s9" style="margin-top:3mm">[Arrêté du 22 décembre 2015, relatif aux conditions de délivrance des titres professionnels du ministère chargé de l’Emploi]</p>
    <p style="margin-top:5mm">Ce dossier comporte :</p>
    <ul>
      <li>pour chaque activité-type du titre visé, un à trois exemples de pratique professionnelle ;</li>
      <li>un tableau à renseigner si le candidat souhaite porter à la connaissance du jury la détention d’un titre, d’un diplôme, d’un certificat de qualification professionnelle (CQP) ou des attestations de formation ;</li>
      <li>une déclaration sur l’honneur à compléter et à signer ;</li>
      <li>des documents illustrant la pratique professionnelle du candidat (facultatif) ;</li>
      <li>des annexes, si nécessaire.</li>
    </ul>
  `, n, total);
}

function blocSommaire(data, n, total) {
  const lignes = (at) => sommaire(data).filter((e) => e.at === at).map((e) => `
    <div class="dp-somm-ligne">
      <span class="dp-somm-titre">Exemple n°${e.n} ${e.titre
        ? `: ${escapeHtml(e.titre)}`
        : `<span class="dp-somm-vide">titre à renseigner</span>`}</span>
      <span class="dp-somm-page">p. ${e.page}</span>
    </div>`).join("");
  const fixe = (label, type) => {
    const b = blocsImprimes(data).find((x) => x.type === type);
    return `<div class="dp-somm-ligne"><span class="dp-somm-titre">${label}</span><span class="dp-somm-page">p. ${b.page}</span></div>`;
  };
  return page(`
    <p class="dp-h1">Sommaire</p>
    <p class="dp-h2">Exemples de pratique professionnelle</p>
    <p class="lv-b lv-s10" style="margin-top:4mm">${AT1_TITRE}</p>
    ${lignes(1)}
    <p class="lv-b lv-s10" style="margin-top:6mm">${AT2_TITRE}</p>
    ${lignes(2)}
    <div style="margin-top:8mm">
      ${fixe("Titres, diplômes, CQP, attestations de formation (facultatif)", "titres")}
      ${fixe("Déclaration sur l’honneur", "declaration")}
      ${fixe("Documents illustrant la pratique professionnelle (facultatif)", "documents")}
      ${fixe("Annexes", "annexes")}
    </div>
  `, n, total);
}

function blocSeparateur(titre, n, total) {
  return page(`<div class="dp-separateur">${titre}</div>`, n, total);
}

function blocExemple(at, num, n, total) {
  const k = (champ) => cleExemple(at, num, champ);
  return page(`
    <div class="dp-at">
      <div class="dp-at-num">Activité-type ${at}</div>
      <div class="dp-at-titre">${at === 1 ? AT1_TITRE : AT2_TITRE}</div>
    </div>
    <p class="dp-ex-num">Exemple n°${num}</p>
    <p>Intitulé : ${f(k("titre"))}</p>

    <p class="dp-question">1. Décrivez les tâches ou opérations que vous avez effectuées, et dans quelles conditions :</p>
    ${zone(k("taches"))}

    <p class="dp-question">2. Précisez les moyens utilisés :</p>
    ${zone(k("moyens"))}

    <p class="dp-question">3. Avec qui avez-vous travaillé ?</p>
    ${zone(k("avec_qui"), true)}

    <p class="dp-question">4. Contexte</p>
    <table class="dp-tbl-borde">
      <tr><td class="dp-cover-label">Nom de l’entreprise, organisme ou association</td><td>${f(k("entreprise"))}</td></tr>
      <tr><td class="dp-cover-label">Chantier, atelier, service</td><td>${f(k("service"))}</td></tr>
      <tr><td class="dp-cover-label">Période d’exercice</td><td>Du : ${f(k("du"), PH_DATE)} au : ${f(k("au"), PH_DATE)}</td></tr>
    </table>

    <p class="dp-question">5. Informations complémentaires (facultatif)</p>
    ${zone(k("complement"), true)}
  `, n, total);
}

function blocTitres(n, total) {
  const lignes = Array.from({ length: 10 }, (_, i) => `
    <tr>
      <td>${f(`titre${i + 1}_intitule`)}</td>
      <td>${f(`titre${i + 1}_organisme`)}</td>
      <td>${f(`titre${i + 1}_date`, PH_DATE)}</td>
    </tr>`).join("");
  return page(`
    <p class="dp-h1">Titres, diplômes, CQP, attestations de formation</p>
    <p class="lv-center lv-i" style="margin-bottom:6mm">(facultatif)</p>
    <table class="dp-tbl-borde">
      <tr><th>Intitulé</th><th>Autorité ou organisme</th><th class="dp-col-date">Date</th></tr>
      ${lignes}
    </table>
  `, n, total);
}

function blocDeclaration(n, total) {
  return page(`
    <p class="dp-h1">Déclaration sur l’honneur</p>
    <p style="margin-top:10mm">Je soussigné(e) ${f("dh_nom")},</p>
    <p class="lv-just" style="margin-top:4mm">déclare sur l’honneur que les renseignements fournis dans ce dossier sont exacts et que je suis l’auteur(e) des réalisations jointes.</p>
    <p style="margin-top:10mm">Fait à ${f("dh_fait_a")} le ${f("dh_le", PH_DATE)}</p>
    <p style="margin-top:2mm">pour faire valoir ce que de droit.</p>
    <p style="margin-top:14mm">Signature :</p>
  `, n, total);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Document complet. Les exemples non imprimés (vides, hors n°1) sont absents du
// document ET du sommaire : voir js/dp-rules.js.
export function buildDpHTML(data) {
  const blocs = blocsImprimes(data);
  const total = blocs.length;
  return blocs.map((b) => {
    switch (b.type) {
      case "couverture":   return blocCouverture(b.page, total);
      case "presentation": return blocPresentation(b.page, total);
      case "sommaire":     return blocSommaire(data, b.page, total);
      case "intercalaire": return blocSeparateur("Exemples de pratique professionnelle", b.page, total);
      case "exemple":      return blocExemple(b.at, b.n, b.page, total);
      case "titres":       return blocTitres(b.page, total);
      case "declaration":  return blocDeclaration(b.page, total);
      case "documents":    return blocSeparateur("Documents illustrant la pratique professionnelle", b.page, total);
      case "annexes":      return blocSeparateur("Annexes", b.page, total);
      default:             return "";
    }
  }).join("");
}
```

- [ ] **Étape 4 : vérifier la syntaxe**

```bash
node --check js/views/dp-gabarit.js
```

Attendu : aucune sortie.

- [ ] **Étape 5 : créer le banc d'essai**

Créer `_preview_dp.html`. Comme `_preview_livret.html`, il n'est jamais lié depuis l'app et
ne demande aucune authentification. Il expose `window.__bench` pour permettre une
vérification chiffrée depuis le navigateur.

```html
<!DOCTYPE html>
<!-- Banc d'essai visuel du Dossier Professionnel (non déployé, jamais lié depuis l'app).
     Rend le document seul, sans authentification, pour tester la pagination,
     le sommaire vivant, le débordement et l'aperçu d'impression. -->
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Banc d'essai · Dossier Professionnel</title>
  <link rel="stylesheet" href="css/livret.css" />
  <link rel="stylesheet" href="css/dp.css" />
  <style>
    body { margin: 20px; background: #e8e8e4; font-family: sans-serif; }
    .bench-bar { margin-bottom: 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { margin: 0; background: #fff; }
      .bench-bar { display: none; }
      .dp-page { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
      .dp-page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="bench-bar">
    <strong>Banc d'essai Dossier Professionnel</strong>
    <button id="fill">Remplir données témoin</button>
    <button id="long">Texte très long</button>
    <button id="empty">Vider</button>
    <button id="print">Imprimer</button>
    <span id="report" style="font-size:13px;color:#555"></span>
  </div>
  <div id="host"></div>
  <script type="module">
    import { buildDpHTML } from "./js/views/dp-gabarit.js";
    import { fillData, collectData, applyEditable, wireDocEditing } from "./js/doc-officiel.js";
    import { blocsImprimes, sommaire } from "./js/dp-rules.js";

    const host = document.getElementById("host");
    const doc = document.createElement("div");
    doc.className = "dp-doc dp-screen dp-edit";
    host.appendChild(doc);

    // Exemple AT1 n°1 complet, AT1 n°2 laissé vide (il ne doit PAS apparaître),
    // AT1 n°3 rempli (il doit apparaître, et décaler la pagination).
    const SAMPLE = {
      nom_naissance: "VALDIVIA", nom_usage: "VALDIVIA", prenom: "Timy",
      adresse: "12 rue des Oliviers, 30000 Nîmes",
      modalite_formation: true,
      at1_ex1_titre: "Animation d'une séance collective sur les feux du véhicule",
      at1_ex1_taches: "Préparation et animation d'une séance collective de sécurité routière pour un groupe de 6 apprenants, sur le thème 22 (feux du véhicule).",
      at1_ex1_moyens: "Support de projection, véhicule école, fiches thème REMC.",
      at1_ex1_avec_qui: "Sous la supervision du formateur référent.",
      at1_ex1_entreprise: "ECF Pro by SPS", at1_ex1_service: "Salle de formation",
      at1_ex1_du: "21/07/2026", at1_ex1_au: "21/07/2026",
      at1_ex3_titre: "Séance individuelle en circulation urbaine",
      at1_ex3_taches: "Conduite accompagnée en boulevard urbain et giratoires.",
      at2_ex1_titre: "Sensibilisation au risque routier en entreprise",
      at2_ex1_taches: "Animation d'une action de sensibilisation auprès de salariés.",
      dh_nom: "Timy VALDIVIA", dh_fait_a: "Nîmes", dh_le: "30/07/2026",
    };

    let data = {};
    let cable = false;
    function render() {
      doc.innerHTML = buildDpHTML(data);
      fillData(doc, data);
      if (!cable) { wireDocEditing(doc, onEdit); cable = true; } else applyEditable(doc);
      marquerDebordements();
      report();
    }
    function onEdit() {
      const avant = blocsImprimes(data).length;
      data = collectData(doc);
      if (blocsImprimes(data).length !== avant) render();
      else { marquerDebordements(); report(); }
    }
    function marquerDebordements() {
      doc.querySelectorAll(".dp-zone").forEach((z) => {
        const nominal = parseFloat(getComputedStyle(z).minHeight) || 0;
        z.classList.toggle("dp-deborde", z.offsetHeight > nominal + 2);
      });
    }

    document.getElementById("fill").onclick = () => { data = { ...SAMPLE }; render(); };
    document.getElementById("empty").onclick = () => { data = {}; render(); };
    document.getElementById("long").onclick = () => {
      data = { ...SAMPLE, at1_ex1_taches: "Phrase de test répétée pour provoquer un débordement. ".repeat(60) };
      render();
    };
    document.getElementById("print").onclick = () => window.print();

    function report() {
      const pages = doc.querySelectorAll(".dp-page");
      const hautes = [...pages].filter((p) => p.offsetHeight > 1130).length;   // 296.5mm ≈ 1121px @96dpi
      const debordes = doc.querySelectorAll(".dp-zone.dp-deborde").length;
      document.getElementById("report").textContent =
        `${pages.length} pages · ${pages[0]?.offsetWidth}px de large · pages agrandies: ${hautes}`
        + ` · zones en débordement: ${debordes} · champs remplis: ${Object.keys(collectData(doc)).length}`;
      window.__bench = { pages: pages.length, hautes, debordes, sommaire: sommaire(data) };
    }
    render();
  </script>
</body>
</html>
```

- [ ] **Étape 6 : vérifier dans le navigateur**

1. `node scripts/cache-bust.js`
2. Ouvrir `_preview_dp.html` via l'outil d'aperçu.
3. À l'ouverture (dossier vierge), la barre doit indiquer **10 pages** : les 4 blocs
   d'ouverture, l'exemple n°1 de chaque activité-type, les 4 blocs de fin.
4. Cliquer « Remplir données témoin » : **11 pages**, car l'exemple AT1 n°3 est rempli alors
   que le n°2 reste vide. Vérifier au sommaire que l'AT1 liste bien les exemples n°1 et n°3
   avec leurs titres, sans ligne pour le n°2, et que les pages annoncées correspondent aux
   pieds de page réels.
5. Cliquer « Texte très long » : la zone concernée prend un liseré ambre, le texte n'est
   **pas** coupé, et `zones en débordement: 1` s'affiche dans la barre.
6. Vérifier le logo sur la couverture et le pied de page
   « DOSSIER PROFESSIONNEL · Version du 11/09/2017 ».
7. Taper dans un champ vide de l'exemple AT1 n°2 : le document doit passer à 12 pages et le
   sommaire s'actualiser.
8. Console sans erreur (`read_console_messages`).
9. Aperçu d'impression : A4 portrait, une page par bloc, rien de tronqué, aucun liseré.

- [ ] **Étape 7 : commit**

```bash
git add js/views/dp-gabarit.js css/dp.css _preview_dp.html index.html
git commit -m "DP : gabarit du document officiel, styles et banc d'essai"
```

---

### Tâche 5 : vue `Dossier pro` et branchement dans Notes

La vue applicative : rôles, liste formateur, pré-remplissage, autosave, impression.

**Fichiers :**
- Créer : `js/views/dp.js`
- Modifier : `js/views/notes.js:1047-1073` (ajouter le sous-onglet)
- Modifier : `js/main.js` (démontage de l'impression au changement de route)

**Interfaces consommées :** `buildDpHTML`, `AT1_TITRE` (tâche 4) ; `listDpDossiers`,
`getDpDossier`, `upsertDpDossier` (tâche 2) ; `collectData`, `fillData`, `wireDocEditing`,
`bindDocPrint`, `refreshDocPrint`, `teardownDocPrint` (tâche 3).
**Interfaces produites :** `renderDp(container, opts?: {embedded?: boolean, isActive?: () => boolean}): Promise<void>`

- [ ] **Étape 1 : écrire la vue**

Créer `js/views/dp.js`, calqué sur la structure de `js/views/epcf-livret.js` (lire ses
lignes 470-660 d'abord). Différences à respecter :

| Point | Livret EPCF | Dossier Professionnel |
|---|---|---|
| Qui édite | Formateur et admin | Le stagiaire propriétaire, et l'admin |
| Vue par défaut du stagiaire | Son livret en lecture seule | **Son dossier en édition** |
| Vue formateur | Liste + saisie | Liste + **lecture seule** |
| Dossier absent | Message « pas encore créé » | Le stagiaire ouvre un dossier vierge, créé au premier enregistrement |
| Re-rendu | Statique | Le document est **reconstruit** quand un exemple passe de vide à rempli (le sommaire et la pagination changent) |

```js
// Dossier Professionnel : un dossier par stagiaire, rempli par le candidat
// lui-même (le DP lui appartient), consulté en lecture seule par les
// formateurs. Le document affiché est le document imprimé.

import { listStagiaires, listDpDossiers, getDpDossier, upsertDpDossier } from "../db.js";
import { el, clear, displayStagiaire, compareByNom, formatDate, toast } from "../utils.js";
import { isAdmin, isProf, getProfile } from "../auth-admin.js";
import { getCurrentWho } from "../identity.js";
import { collectData, fillData, applyEditable, wireDocEditing,
         bindDocPrint, refreshDocPrint, teardownDocPrint } from "../doc-officiel.js";
import { buildDpHTML } from "./dp-gabarit.js";
import { blocsImprimes } from "../dp-rules.js";

let stagiaires = [];
let dossiersIndex = [];

export async function renderDp(container, opts = {}) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const formateur = isAdmin() || isProf();
  const monId = getProfile()?.stagiaire_id ?? null;

  // Un stagiaire (ou un fondateur en aperçu « stagiaire ») ouvre directement son
  // dossier. La RLS ne lui renvoie que le sien de toute façon.
  if (!formateur) {
    if (monId == null) {
      clear(container);
      container.appendChild(el("p", { class: "muted" },
        "Ton compte n'est pas encore relié à une fiche stagiaire : le dossier professionnel n'est pas disponible."));
      return;
    }
    let row = null;
    try { row = await getDpDossier(monId); } catch (e) { console.error(e); toast(e?.message || String(e), "error"); }
    if (opts.isActive && !opts.isActive()) return;
    let moi = null;
    try { moi = (await listStagiaires()).find((s) => s.id === monId) || null; } catch (e) { console.error(e); }
    clear(container);
    showDoc(container, moi, row, { readOnly: false, stagiaireId: monId });
    return;
  }

  const [stagiairesData, dossiersData] = await Promise.all([listStagiaires(), listDpDossiers()]);
  if (opts.isActive && !opts.isActive()) return;
  stagiaires = stagiairesData.slice().sort(compareByNom);
  dossiersIndex = dossiersData;
  clear(container);
  showListe(container);
}

function showListe(container) {
  clear(container);
  teardownDocPrint();
  container.appendChild(el("p", { class: "lv-hint" },
    "Dossier professionnel (DP) du ministère chargé de l'emploi. ",
    "Le DP appartient au candidat : chaque stagiaire remplit le sien, les formateurs le consultent."));
  const table = el("table", { class: "lv-liste-table" });
  table.appendChild(el("thead", {}, el("tr", {},
    el("th", {}, "Stagiaire"), el("th", {}, "Dossier"))));
  const tbody = el("tbody");
  stagiaires.forEach((s) => {
    const row = dossiersIndex.find((d) => d.stagiaire_id === s.id);
    const cell = el("td", {});
    cell.appendChild(el("span", { class: "lv-statut" + (row ? " ok" : "") },
      row ? "commencé · màj " + formatDate(new Date(row.updated_at)) : "vierge"));
    if (row) {
      cell.appendChild(el("button", {
        class: "btn small ghost", style: "margin-left:10px",
        onClick: async () => {
          let full = null;
          try { full = await getDpDossier(s.id); }
          catch (e) { console.error(e); toast(e?.message || String(e), "error"); return; }
          showDoc(container, s, full, { readOnly: true, stagiaireId: s.id, back: () => renderReload(container) });
        },
      }, "Consulter"));
    }
    tbody.appendChild(el("tr", {},
      el("td", {}, el("div", { class: "lv-name-cell" }, el("span", {}, displayStagiaire(s)))),
      cell));
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function renderReload(container) {
  try { dossiersIndex = await listDpDossiers(); } catch (e) { console.error(e); }
  showListe(container);
}

function showDoc(container, stagiaire, row, { readOnly, stagiaireId, back } = {}) {
  clear(container);
  let data = { ...(row?.data || {}) };

  // Pré-remplissage à la première ouverture, depuis la fiche stagiaire. Les
  // champs restent modifiables : le DP distingue nom de naissance et nom d'usage.
  if (stagiaire) {
    if (!data.nom_usage) data.nom_usage = (stagiaire.nom || "").toUpperCase();
    if (!data.prenom) data.prenom = stagiaire.prenom || "";
    if (!data.dh_nom) data.dh_nom = [stagiaire.prenom, (stagiaire.nom || "").toUpperCase()].filter(Boolean).join(" ");
  }
  if (data.modalite_vae !== true && data.modalite_formation === undefined) data.modalite_formation = true;

  const status = el("span", { class: "lv-status" }, readOnly ? "Lecture seule" : "");
  const toolbar = el("div", { class: "lv-toolbar" });
  if (back) toolbar.appendChild(el("button", { class: "btn small ghost",
    onClick: () => { teardownDocPrint(); back(); } }, "← Retour"));
  toolbar.appendChild(el("h3", {}, "Dossier professionnel" + (readOnly && stagiaire ? " : " + displayStagiaire(stagiaire) : "")));
  toolbar.appendChild(status);
  toolbar.appendChild(el("button", { class: "btn small primary", onClick: async () => {
    if (!readOnly) await saveNow();
    refreshDocPrint();
    window.print();
  } }, "Imprimer / PDF"));
  container.appendChild(toolbar);
  container.appendChild(el("p", { class: "lv-hint" }, readOnly
    ? "Le DP appartient au candidat, il en est le seul rédacteur. Consultation seule."
    : "Clique dans les zones encadrées pour remplir. Enregistrement automatique. Un exemple laissé vide ne sera pas imprimé."));

  const doc = el("div", { class: "dp-doc dp-screen" + (readOnly ? "" : " dp-edit") });
  const scaleInner = el("div", { class: "dp-scale" }, doc);
  const scaleOuter = el("div", { class: "dp-scale-outer" }, scaleInner);
  container.appendChild(scaleOuter);

  const rescale = () => {
    if (!document.contains(scaleOuter)) return;
    const w = scaleOuter.clientWidth;
    if (!w) return;
    const docW = doc.offsetWidth || 794;
    const scale = Math.min(1, w / docW);
    scaleInner.style.transform = `scale(${scale})`;
    scaleOuter.style.height = doc.offsetHeight * scale + "px";
  };

  // Nombre de blocs au dernier rendu : sert à détecter qu'un exemple vient de
  // passer de vide à rempli (ou l'inverse), ce qui change sommaire et pagination.
  let nbBlocs = 0;
  // Les écouteurs de wireDocEditing sont posés en délégation sur `doc` : ils
  // survivent au remplacement de innerHTML et ne doivent donc être posés
  // QU'UNE FOIS, sinon chaque reconstruction les empilerait (une frappe
  // déclencherait N enregistrements). Seul contentEditable est ré-appliqué.
  let editionCablee = false;

  function render() {
    doc.innerHTML = buildDpHTML(data);
    nbBlocs = blocsImprimes(data).length;
    fillData(doc, data);
    if (!readOnly) {
      if (!editionCablee) { wireDocEditing(doc, onEdit); editionCablee = true; }
      else applyEditable(doc);
    }
    marquerDebordements(doc);
    bindDocPrint(doc, { printId: "dp-print", bodyClass: "dp-printable" });
    requestAnimationFrame(rescale);
  }

  function onEdit() {
    // collectData est la source de vérité : il omet les champs vides, donc
    // vider un champ le retire bien de data. Aucune clé ne peut se perdre, un
    // exemple qui porte du texte est toujours rendu (voir dp-rules.js).
    data = collectData(doc);
    if (blocsImprimes(data).length !== nbBlocs) {
      // La pagination change : on reconstruit, en gardant le champ actif.
      const actif = document.activeElement?.dataset?.k || null;
      render();
      if (actif) {
        const cible = doc.querySelector(`[data-k="${CSS.escape(actif)}"]`);
        if (cible) placerCurseurEnFin(cible);
      }
    } else {
      marquerDebordements(doc);
    }
    scheduleSave();
  }

  render();
  window.addEventListener("resize", rescale);

  // --- Autosave débouncé, même mécanique que le livret ---
  let saveTimer = null;
  let saving = false;
  let pendingAgain = false;
  async function saveNow() {
    if (readOnly) return;
    if (saving) { pendingAgain = true; return; }
    saving = true;
    clearTimeout(saveTimer);
    status.textContent = "Enregistrement…";
    status.className = "lv-status saving";
    try {
      await upsertDpDossier({ stagiaire_id: stagiaireId, data: collectData(doc), updated_by_who: getCurrentWho() });
      status.textContent = "Enregistré ✓";
      status.className = "lv-status";
    } catch (e) {
      console.error(e);
      status.textContent = "Non enregistré !";
      status.className = "lv-status error";
      toast("Enregistrement du dossier impossible : " + (e?.message || e), "error");
    } finally {
      saving = false;
      if (pendingAgain) { pendingAgain = false; saveNow(); }
    }
  }
  function scheduleSave() {
    status.textContent = "Modifié…";
    status.className = "lv-status saving";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
    clearTimeout(cloneTimer);
    cloneTimer = setTimeout(() => { if (document.contains(doc)) refreshDocPrint(); }, 1200);
  }
  let cloneTimer = null;
}

// Signale les zones dont le contenu dépasse la hauteur nominale. On ne coupe
// jamais le texte : le liseré invite seulement à resserrer la rédaction.
//
// La zone n'a qu'un min-height et ne masque pas son débordement : elle GRANDIT
// au lieu de déborder, donc scrollHeight vaut toujours clientHeight ici. Le
// dépassement se mesure en comparant la hauteur réelle à la hauteur nominale.
// offsetHeight et non getBoundingClientRect : le document est sous un
// transform: scale, qui fausserait le rectangle mais pas le layout.
function marquerDebordements(doc) {
  doc.querySelectorAll(".dp-zone").forEach((z) => {
    const nominal = parseFloat(getComputedStyle(z).minHeight) || 0;
    z.classList.toggle("dp-deborde", z.offsetHeight > nominal + 2);
  });
}

function placerCurseurEnFin(node) {
  node.focus({ preventScroll: true });
  const r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
```

- [ ] **Étape 2 : vérifier la syntaxe**

```bash
node --check js/views/dp.js
```

Attendu : aucune sortie.

- [ ] **Étape 3 : brancher le sous-onglet dans Notes**

Dans `js/views/notes.js`, ajouter l'import à côté de celui du livret (ligne 12) :

```js
import { renderDp } from "./dp.js";
```

Puis, dans la liste des sous-onglets (autour de la ligne 1063), ajouter une entrée **après**
celle du livret, en copiant sa forme exacte :

```js
    { key: "dp", label: "Dossier pro", render: (p, ctx) => {
        renderDp(p, { embedded: true, isActive: ctx && ctx.isActive })
      } },
```

Mettre à jour le commentaire des lignes 1047-1049 pour mentionner le nouveau sous-onglet.

- [ ] **Étape 4 : démonter l'impression au changement de route**

Dans `js/main.js`, la ligne 15 importe `teardownLivretPrint` et la ligne 196 l'appelle.
Remplacer par le démontage générique, qui couvre les deux documents :

```js
import { teardownDocPrint } from "./doc-officiel.js";
```

et ligne 196 :

```js
  teardownDocPrint();
```

- [ ] **Étape 5 : vérifier la syntaxe des fichiers touchés**

```bash
node --check js/views/notes.js && node --check js/main.js && node --check js/views/dp.js
```

Attendu : aucune sortie.

- [ ] **Étape 6 : commit**

```bash
git add js/views/dp.js js/views/notes.js js/main.js
git commit -m "DP : vue Dossier pro, sous-onglet Notes et roles"
```

---

### Tâche 6 : vérification complète dans le navigateur

Rien n'est terminé tant que ce n'est pas constaté à l'écran. Le projet a déjà été mordu par
des vérifications faites au banc d'essai seulement, ou sur un JS servi depuis le cache.

**Fichiers :** aucun a priori. Les correctifs trouvés ici sont commités au fil de l'eau.

- [ ] **Étape 1 : rafraîchir les tokens de cache avant de servir**

```bash
node scripts/cache-bust.js
```

Indispensable : en local le hook ne pose les tokens qu'au commit, donc le navigateur
servirait l'ancien JS. Ne jamais rediriger la sortie de ce script vers un fichier du projet.

- [ ] **Étape 2 : lancer l'aperçu et se connecter**

Utiliser l'outil `preview_start` avec la configuration du dépôt (jamais un serveur lancé via
Bash). L'aperçu local attaque la base de **production** : rester en lecture sauf sur son
propre dossier.

- [ ] **Étape 3 : parcours stagiaire**

Aller dans Notes, sous-onglet « Dossier pro ». Vérifier :

1. Le dossier s'ouvre directement en édition, sans passer par une liste.
2. Saisir un titre et un texte dans l'exemple AT1 n°1 ; le statut passe « Modifié… » puis
   « Enregistré ✓ ».
3. Le sommaire affiche le titre saisi.
4. Remplir un champ de l'exemple AT1 n°2 : le document se reconstruit, une page apparaît, le
   sommaire et la pagination se décalent, et **le curseur reste dans le champ en cours**.
5. Vider ce champ : la page disparaît, la pagination revient en arrière.
6. Coller un texte très long dans une zone : le liseré ambre apparaît, le texte n'est pas
   coupé.
7. Recharger la page : tout ce qui a été saisi est toujours là.
8. `read_console_messages` : aucune erreur.

- [ ] **Étape 4 : parcours formateur**

Basculer en aperçu « Voir en tant que formateur » depuis le menu profil, puis :

1. Le sous-onglet affiche la liste des stagiaires, triée par nom de famille.
2. Un dossier commencé montre « commencé · màj … » et un bouton « Consulter ».
3. À l'ouverture : bandeau de lecture seule, aucun champ modifiable, pas d'autosave.
4. « ← Retour » ramène à la liste.

Rappel : l'aperçu « Voir en tant que » est purement visuel, la RLS n'est pas simulée. Le
test d'écriture réel a été fait en SQL à la tâche 2.

- [ ] **Étape 5 : impression du DP**

1. Cliquer « Imprimer / PDF » et contrôler dans l'aperçu : A4 portrait, une page par bloc,
   en-tête « Dossier Professionnel (DP) », pied de page « DOSSIER PROFESSIONNEL · Version du
   11/09/2017 » avec la bonne numérotation, logo présent sur la couverture.
2. Aucun liseré d'alerte ni note de débordement à l'impression.
3. Vérifier qu'aucun exemple vide (hors n°1) n'apparaît.
4. Fermer l'aperçu, changer de sous-onglet, puis lancer une impression : elle ne doit
   **pas** sortir le DP (le démontage a bien eu lieu).

- [ ] **Étape 6 : non-régression du planning et du livret**

Ces deux impressions partagent le mécanisme `@page`.

1. Aller sur Planning, « Imprimer / PDF » : toujours **A4 paysage, une seule page**.
2. Revenir dans Notes, sous-onglet « Livret EPCF », ouvrir un livret, imprimer : rendu
   identique au document officiel, 10 pages portrait.

- [ ] **Étape 7 : capture et commit final**

Prendre une capture de l'écran d'édition du DP pour la joindre au récapitulatif, puis :

```bash
node tests/dp-rules.test.mjs && node --check js/views/dp.js
git add -A
git commit -m "DP : verifications navigateur et correctifs"
```

Ne pas pousser : l'utilisateur valide en aperçu local puis pousse lui-même.

---

## Points de vigilance connus du projet

| Piège | Conséquence |
|---|---|
| Ne jamais piper la sortie de `cache-bust.js` vers un fichier du projet | A déjà vidé `identity.js` |
| `node --check` ne détecte pas un import cassé ni une fonction dupliquée | Toujours confirmer dans le navigateur |
| iOS Safari sert longtemps l'ancien JS | Tester en navigation privée quand « ça ne change pas » |
| Une règle `@page` en dur casserait l'impression du planning | Le format de page reste injecté en JS, seulement quand un document est ouvert |
| Les builds GitHub Pages restent parfois en « building » | Sans objet ici : rien n'est poussé |
