# Page Stagiaires et fiche en sommaire : plan de réalisation (lot 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** donner aux formateurs une page « Stagiaires » (la promo, une fiche par personne, avec leurs outils) et présenter toute fiche en sommaire sur iPhone, d'après `docs/superpowers/specs/2026-10-03-espace-stagiaires-design.md`.

**Architecture:** deux modules purs testés en node (`route-rules.js` pour les adresses à segments, `fiche-rules.js` pour les états) ; un petit module `navigation.js` (garde de saisie, mise à jour d'une page sur place) branché sur le routeur de `main.js` ; la fiche d'une personne exportée par `mon-suivi.js` (`renderFiche`, onglets ou sommaire) et réutilisée par la nouvelle page `stagiaires.js` ; la saisie EPCF passe de Notes à la fiche (`epcf.js`).

**Tech Stack:** HTML, CSS, JavaScript en modules ES sans framework ; Supabase (client `supabase-js`) ; tests `node` (assert) ; banc d'essai `_harness.html` (faux Supabase par import map).

## Global Constraints

- Aucun tiret cadratin (U+2014) nulle part : code, commentaires, textes, commits. Remplacer par deux-points, virgule ou parenthèses.
- Français partout ; dans les textes visibles, « formateur », jamais « prof ».
- Imports internes avec le jeton du dépôt : `?v=20261003b` (le hook de `main` le renouvelle à la fusion).
- Travail sur la branche `espace-stagiaires` du worktree `C:/Users/watch/Dev/ecsr-promo-espace-stagiaires` ; jamais de commit sur `main`, jamais de push.
- `git add` et `git commit` en commandes séparées (un `grep -c` à zéro casse une chaîne `&&`).
- CSS du lot : un seul bloc en fin de `css/style.css`, titré `/* ===== Chantier D, lot 2 : fiche en sommaire et page Stagiaires ===== */`.
- Point de rupture iPhone : `max-width: 760px` (celui de l'app).
- Contrôles d'édition nouveaux visibles des seuls formateurs et admins (`isAdmin() || isProf()`).
- Aucune table, aucune migration, aucune règle d'accès nouvelle.
- Tests : `node tests/<fichier>.test.mjs` ; tous les fichiers de `tests/` restent verts.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/route-rules.js` (nouveau) | adresses `#/<route>/<id>/<partie>`, liens « Où le trouver », page « à soi » |
| `js/fiche-rules.js` (nouveau) | états des parties et de la liste, événement d'enregistrement |
| `js/navigation.js` (nouveau) | garde de saisie, mise à jour sur place, adresse courante |
| `js/views/stagiaires.js` (nouveau) | page Stagiaires |
| `js/views/mon-suivi.js` | fiche partagée (`renderFiche`), Mon espace |
| `js/views/epcf.js` | Notes : moyennes ; fiche : résultats et saisie |
| `js/main.js` | routeur : segments, garde, sur place, redirections, route `stagiaires` |
| `js/subtabs.js` | options `onChange` et `avantChangement` |
| `js/views/notes.js`, `js/views/home.js`, `js/auth-admin.js`, `js/db.js` | Notes de la classe, tuile, menu du compte, lectures légères |
| `js/views/epcf-livret.js`, `js/views/dp.js` | événement après enregistrement |
| `js/views/nouveautes.js`, `js/views/ccp2.js`, `js/nouveautes-data.js`, `js/modules-data.js` | liens et textes |
| `js/chatbot-rules.js`, `supabase/functions/chatbot/aide.mjs`, `PROJECT_NOTES.md` | assistant, notes |
| `tests/route-rules.test.mjs`, `tests/fiche-rules.test.mjs`, `tests/navigation.test.mjs` (nouveaux), `tests/chatbot-rules.test.mjs`, `tests/modules.test.mjs` | tests |

---

### Task 1: Règles pures (adresses et états)

**Files:**
- Create: `js/route-rules.js`, `js/fiche-rules.js`
- Test: `tests/route-rules.test.mjs`, `tests/fiche-rules.test.mjs`

**Interfaces:**
- Produces: `PARTIES` (`["passages","epcf","evolution","livret","dp"]`), `lireAdresse(hash) → { route, id, partie }`, `adresseFiche(route, id, partie) → string`, `hrefLien({ route, sousOnglet }) → string`, `pagePersonnelle({ formateur, stagiaireId }) → "stagiaires"|"mon-suivi"` ; `EPREUVES_EPCF`, `EVT_DOCUMENT` (`"document-enregistre"`), `epreuvesEvaluees(evals) → number`, `jourMois(valeur) → "jj/mm"|null`, `passagesAVenir(items, aujourdhuiIso) → number`, `ligneListe({ evals, livret, dossier }) → [{ texte, afaire }]×3`, `etatsSommaire({ aVenir, evals, livret, dossier, soi }) → { passages, epcf, evolution:null, livret, dp }` (chaque état `{ texte, afaire }`).

- [ ] **Step 1: Write the failing tests**

`tests/route-rules.test.mjs` :

```js
// Adresses à segments (chantier D, lot 2) : lecture, construction, liens « Où le
// trouver » et page « à soi ».
import assert from "node:assert/strict";
import { PARTIES, lireAdresse, adresseFiche, hrefLien, pagePersonnelle } from "../js/route-rules.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Lecture
eq(lireAdresse("#/stagiaires/12/epcf"), { route: "stagiaires", id: 12, partie: "epcf" }, "fiche et partie");
eq(lireAdresse("#/stagiaires/12"), { route: "stagiaires", id: 12, partie: null }, "fiche seule");
eq(lireAdresse("#/stagiaires"), { route: "stagiaires", id: null, partie: null }, "liste");
eq(lireAdresse("#/stagiaires/abc/epcf"), { route: "stagiaires", id: null, partie: null }, "id invalide : la liste");
eq(lireAdresse("#/stagiaires/0"), { route: "stagiaires", id: null, partie: null }, "id nul refusé");
eq(lireAdresse("#/stagiaires/12/xyz"), { route: "stagiaires", id: 12, partie: null }, "partie inconnue ignorée");
eq(lireAdresse("#/stagiaires/12/"), { route: "stagiaires", id: 12, partie: null }, "barre finale tolérée");
eq(lireAdresse("#/mon-suivi/dp"), { route: "mon-suivi", id: null, partie: "dp" }, "Mon espace, partie");
eq(lireAdresse("#/mon-suivi"), { route: "mon-suivi", id: null, partie: null }, "Mon espace");
eq(lireAdresse("#/mon-suivi/12"), { route: "mon-suivi", id: null, partie: null }, "Mon espace n'a pas d'id");
eq(lireAdresse("#/notes"), { route: "notes", id: null, partie: null }, "autre page");
eq(lireAdresse("#/notes/livret"), { route: "notes", id: null, partie: null }, "autre page : la suite est ignorée");
eq(lireAdresse(""), { route: "", id: null, partie: null }, "adresse vide");
eq(lireAdresse(undefined), { route: "", id: null, partie: null }, "adresse absente");

// 2. Construction
eq(adresseFiche("stagiaires", 12, "epcf"), "#/stagiaires/12/epcf", "fiche et partie");
eq(adresseFiche("stagiaires", 12, null), "#/stagiaires/12", "fiche");
eq(adresseFiche("stagiaires", null, "epcf"), "#/stagiaires", "pas de partie sans fiche");
eq(adresseFiche("mon-suivi", null, "livret"), "#/mon-suivi/livret", "Mon espace, partie");
eq(adresseFiche("mon-suivi", null, null), "#/mon-suivi", "Mon espace");
for (const p of PARTIES) eq(lireAdresse(adresseFiche("stagiaires", 7, p)).partie, p, "aller-retour : " + p);

// 3. Liens « Où le trouver »
eq(hrefLien({ route: "mon-suivi", sousOnglet: "dp" }), "#/mon-suivi/dp", "partie de Mon espace par l'adresse");
eq(hrefLien({ route: "mon-suivi", sousOnglet: "inconnu" }), "#/mon-suivi", "partie inconnue : la page");
eq(hrefLien({ route: "mon-suivi" }), "#/mon-suivi", "Mon espace sans partie");
eq(hrefLien({ route: "notes", sousOnglet: "epcf" }), "#/notes", "Notes : la mémoire des sous-onglets s'en charge");
eq(hrefLien({ route: "stagiaires" }), "#/stagiaires", "page Stagiaires");

// 4. Page « à soi »
eq(pagePersonnelle({ formateur: true, stagiaireId: null }), "stagiaires", "formateur sans profil stagiaire");
eq(pagePersonnelle({ formateur: true, stagiaireId: 3 }), "mon-suivi", "stagiaire et admin");
eq(pagePersonnelle({ formateur: false, stagiaireId: 3 }), "mon-suivi", "stagiaire");
eq(pagePersonnelle({ formateur: false, stagiaireId: null }), "mon-suivi", "compte sans profil : Mon espace l'explique");

eq(PARTIES, ["passages", "epcf", "evolution", "livret", "dp"], "parties dans l'ordre de la fiche");

console.log(`route-rules : ${n} assertions OK`);
```

`tests/fiche-rules.test.mjs` :

```js
// États de la fiche et de la page Stagiaires (chantier D, lot 2).
import assert from "node:assert/strict";
import {
  EPREUVES_EPCF, EVT_DOCUMENT, epreuvesEvaluees, jourMois, passagesAVenir, ligneListe, etatsSommaire,
} from "../js/fiche-rules.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Épreuves EPCF
eq(EPREUVES_EPCF, ["salle", "vehicule"], "deux épreuves");
eq(epreuvesEvaluees([]), 0, "aucune évaluation");
eq(epreuvesEvaluees(undefined), 0, "liste absente");
eq(epreuvesEvaluees([{ trame: "salle" }, { trame: "salle" }]), 1, "deux évaluations salle : une épreuve");
eq(epreuvesEvaluees([{ trame: "salle" }, { trame: "vehicule" }]), 2, "les deux épreuves");
eq(epreuvesEvaluees([{ trame: "autre" }]), 0, "épreuve inconnue ignorée");

// 2. Dates
eq(jourMois("2026-09-29"), "29/09", "date seule");
eq(jourMois("2026-09-29T10:00:00"), "29/09", "horodatage");
eq(jourMois(null), null, "absente");
eq(jourMois("pas une date"), null, "illisible");

// 3. Passages à venir : aujourd'hui compris, vrais passages seulement
const items = [
  { iso: "2026-10-02", role: "passage" },
  { iso: "2026-10-03", role: "passage" },
  { iso: "2026-10-03", role: "eleve" },
  { iso: "2026-10-06", role: "passage" },
];
eq(passagesAVenir(items, "2026-10-03"), 2, "passé exclu, élève en salle exclu");
eq(passagesAVenir(undefined, "2026-10-03"), 0, "rien de planifié");

// 4. Ligne de la liste (vue formateur)
eq(ligneListe({ evals: [{ trame: "salle" }], livret: { updated_at: "2026-09-20T08:00:00" },
  dossier: { updated_at: "2026-09-29T08:00:00" } }),
  [{ texte: "EPCF 1/2", afaire: true }, { texte: "Livret", afaire: false }, { texte: "Dossier 29/09", afaire: false }],
  "en cours");
eq(ligneListe({ evals: [], livret: null, dossier: null }),
  [{ texte: "EPCF 0/2", afaire: true }, { texte: "Livret vierge", afaire: true }, { texte: "Dossier vierge", afaire: true }],
  "rien de commencé");
eq(ligneListe({ evals: [{ trame: "salle" }, { trame: "vehicule" }], livret: {}, dossier: { updated_at: "bidon" } }),
  [{ texte: "EPCF 2/2", afaire: false }, { texte: "Livret", afaire: false }, { texte: "Dossier", afaire: false }],
  "tout fait, date illisible");

// 5. Sommaire : orange pour le formateur, seulement le dossier pour soi
const vu = { aVenir: 2, evals: [{ trame: "salle" }], livret: null, dossier: null };
const f = etatsSommaire({ ...vu, soi: false });
eq(f.passages, { texte: "2 à venir", afaire: false }, "passages");
eq(f.epcf, { texte: "1/2", afaire: true }, "EPCF en orange chez le formateur");
eq(f.evolution, null, "évolution sans état");
eq(f.livret, { texte: "vierge", afaire: true }, "livret vierge en orange chez le formateur");
eq(f.dp, { texte: "vierge", afaire: true }, "dossier vierge");
const s = etatsSommaire({ ...vu, soi: true });
eq(s.epcf, { texte: "1/2", afaire: false }, "EPCF en gris chez le stagiaire");
eq(s.livret, { texte: "pas encore créé", afaire: false }, "livret pas encore créé, en gris");
eq(s.dp, { texte: "vierge", afaire: true }, "son dossier vierge reste en orange");
const fait = etatsSommaire({ aVenir: 0, evals: [], livret: { updated_at: "x" }, dossier: { updated_at: "2026-10-01" }, soi: true });
eq(fait.passages, { texte: "aucun à venir", afaire: false }, "aucun à venir");
eq(fait.livret, { texte: "commencé", afaire: false }, "livret commencé");
eq(fait.dp, { texte: "01/10", afaire: false }, "dossier daté");

eq(EVT_DOCUMENT, "document-enregistre", "nom de l'événement");

console.log(`fiche-rules : ${n} assertions OK`);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node tests/route-rules.test.mjs ; node tests/fiche-rules.test.mjs`
Expected: FAIL, `Cannot find module` pour les deux.

- [ ] **Step 3: Write the implementation**

`js/route-rules.js` :

```js
// Adresses de l'app à segments (chantier D, lot 2) : #/<route>/<id>/<partie>.
// Le premier segment choisit la page ; Mon espace lit une partie, la page
// Stagiaires une fiche puis une partie. Module pur, sans DOM : testé en node.

// Parties d'une fiche, dans l'ordre d'affichage (Mon espace et page Stagiaires).
export const PARTIES = ["passages", "epcf", "evolution", "livret", "dp"];

function partieValide(p) { return PARTIES.includes(p) ? p : null; }
function idValide(s) { return /^[1-9]\d*$/.test(String(s ?? "")) ? Number(s) : null; }

// "#/stagiaires/12/epcf" → { route: "stagiaires", id: 12, partie: "epcf" } ;
// "#/mon-suivi/dp" → { route: "mon-suivi", id: null, partie: "dp" } ; toute
// autre page garde seulement sa route. Une partie ou un id illisible vaut null.
export function lireAdresse(hash) {
  const segments = String(hash ?? "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const route = segments[0] || "";
  if (route === "stagiaires") {
    const id = idValide(segments[1]);
    return { route, id, partie: id ? partieValide(segments[2]) : null };
  }
  if (route === "mon-suivi") return { route, id: null, partie: partieValide(segments[1]) };
  return { route, id: null, partie: null };
}

// Adresse d'une fiche, d'une partie, ou de la page elle-même.
export function adresseFiche(route, id, partie) {
  let h = "#/" + route;
  if (route === "stagiaires" && id) h += "/" + id;
  if (partie && (route === "mon-suivi" || (route === "stagiaires" && id))) h += "/" + partie;
  return h;
}

// Lien « Où le trouver » : une partie de Mon espace se vise par l'adresse ; les
// sous-onglets de Notes et de Cours passent par la mémoire de renderSubTabs.
export function hrefLien(lien) {
  if (lien.route === "mon-suivi" && partieValide(lien.sousOnglet)) return "#/mon-suivi/" + lien.sousOnglet;
  return "#/" + lien.route;
}

// Page « à soi » : la page Stagiaires pour un formateur ou un admin sans profil
// stagiaire, Mon espace pour toute personne qui a un profil stagiaire.
export function pagePersonnelle({ formateur, stagiaireId }) {
  return formateur && stagiaireId == null ? "stagiaires" : "mon-suivi";
}
```

`js/fiche-rules.js` :

```js
// États affichés par la fiche d'une personne (sommaire sur iPhone) et par la
// liste de la page Stagiaires (chantier D, lot 2). Module pur : testé en node.

export const EPREUVES_EPCF = ["salle", "vehicule"];

// Émis par le livret et le dossier pro après un enregistrement, avec
// { genre: "livret" | "dossier", stagiaireId, updatedAt } : les états suivent
// sans relire la base.
export const EVT_DOCUMENT = "document-enregistre";

// Épreuves ayant au moins une évaluation (plusieurs évaluations d'une même
// épreuve comptent une fois).
export function epreuvesEvaluees(evals) {
  return new Set((evals || []).map((e) => e.trame).filter((t) => EPREUVES_EPCF.includes(t))).size;
}

// « 29/09 » : jour et mois d'une date (AAAA-MM-JJ, lue telle quelle) ou d'un
// horodatage (heure de l'appareil). null si illisible.
export function jourMois(valeur) {
  if (!valeur) return null;
  const s = String(valeur);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return m[3] + "/" + m[2];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}

// Passages à venir, aujourd'hui compris : les vrais passages, pas les
// demi-journées où la personne est seulement élève dans la salle.
export function passagesAVenir(items, aujourdhuiIso) {
  return (items || []).filter((it) => it.role === "passage" && it.iso >= aujourdhuiIso).length;
}

function texteDossier(dossier, prefixe) {
  if (!dossier) return prefixe ? prefixe + " vierge" : "vierge";
  const date = jourMois(dossier.updated_at);
  if (prefixe) return date ? prefixe + " " + date : prefixe;
  return date || "commencé";
}

// Ligne d'état de la page Stagiaires (vue formateur) : `afaire` pour ce qui
// reste à faire, affiché en orange.
export function ligneListe({ evals, livret, dossier }) {
  const n = epreuvesEvaluees(evals);
  return [
    { texte: `EPCF ${n}/2`, afaire: n < 2 },
    { texte: livret ? "Livret" : "Livret vierge", afaire: !livret },
    { texte: texteDossier(dossier, "Dossier"), afaire: !dossier },
  ];
}

// États du sommaire, par partie. `soi` : la personne regarde sa propre fiche ;
// elle ne voit en orange que ce qui dépend d'elle, son dossier.
export function etatsSommaire({ aVenir, evals, livret, dossier, soi }) {
  const n = epreuvesEvaluees(evals);
  return {
    passages: { texte: aVenir > 0 ? `${aVenir} à venir` : "aucun à venir", afaire: false },
    epcf: { texte: `${n}/2`, afaire: !soi && n < 2 },
    evolution: null,
    livret: livret ? { texte: "commencé", afaire: false }
      : soi ? { texte: "pas encore créé", afaire: false }
      : { texte: "vierge", afaire: true },
    dp: { texte: texteDossier(dossier, null), afaire: !dossier },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node tests/route-rules.test.mjs ; node tests/fiche-rules.test.mjs`
Expected: `route-rules : 34 assertions OK` et `fiche-rules : 27 assertions OK`.

- [ ] **Step 5: Commit**

```bash
git add js/route-rules.js js/fiche-rules.js tests/route-rules.test.mjs tests/fiche-rules.test.mjs
git commit -m "Lot 2 : regles pures des adresses a segments et des etats de fiche"
```

---

### Task 2: Navigation (garde de saisie, mise à jour sur place, adresses à segments)

**Files:**
- Create: `js/navigation.js`, `tests/navigation.test.mjs`
- Modify: `js/main.js` (imports, `navigate`, boutons Actualiser et Aujourd'hui, `bootApp`), `js/subtabs.js` (options), `js/chatbot-rules.js:8-11`, `tests/chatbot-rules.test.mjs`

**Interfaces:**
- Consumes: `lireAdresse` (Task 1).
- Produces: `poserGardeSortie({ estSale, message })`, `leverGardeSortie(garde?)`, `gardeActive()`, `peutQuitter(confirmer?) → boolean`, `surChangementAdresse(route, fn(adresse))`, `majSurPlacePour(route)`, `oublierMajSurPlace()`, `noterAdresse(hash)`, `adresseCourante()`, `remplacerAdresse(hash)`, `installerGardeNavigateur()` ; `navigate({ force })` dans `main.js` ; `renderSubTabs(onglets, { activeKey, storageKey, onChange(key), avantChangement() })`.

- [ ] **Step 1: Write the failing tests**

`tests/navigation.test.mjs` :

```js
// Navigation interne (chantier D, lot 2) : garde de saisie et mise à jour sur place.
import assert from "node:assert/strict";
import {
  poserGardeSortie, leverGardeSortie, gardeActive, peutQuitter,
  surChangementAdresse, majSurPlacePour, oublierMajSurPlace, noterAdresse, adresseCourante,
} from "../js/navigation.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const sansQuestion = () => { throw new Error("aucune question attendue"); };

// 1. Garde de saisie
ok(peutQuitter(sansQuestion), "sans garde : on part sans question");
let sale = false;
const g = { estSale: () => sale, message: "Abandonner la saisie en cours ?" };
poserGardeSortie(g);
ok(!gardeActive(), "rien de saisi : garde inactive");
ok(peutQuitter(sansQuestion), "rien de saisi : pas de question");
sale = true;
ok(gardeActive(), "saisie en cours : garde active");
let question = null;
ok(!peutQuitter((m) => { question = m; return false; }), "refus : on reste");
eq(question, "Abandonner la saisie en cours ?", "le message de la garde est posé");
ok(gardeActive(), "refus : la garde reste");
ok(peutQuitter(() => true), "accord : on part");
ok(!gardeActive(), "accord : la garde tombe, pas de seconde question");
poserGardeSortie(g);
leverGardeSortie({ estSale: () => true, message: "autre" });
ok(gardeActive(), "lever la garde d'un autre ne lève pas celle-ci");
leverGardeSortie(g);
ok(!gardeActive(), "lever sa propre garde");
poserGardeSortie(g);
leverGardeSortie();
ok(!gardeActive(), "lever sans argument : plus de garde");

// 2. Mise à jour sur place
const f = () => {};
surChangementAdresse("stagiaires", f);
eq(majSurPlacePour("stagiaires"), f, "même page : la mise à jour est rendue");
eq(majSurPlacePour("notes"), null, "autre page : rien");
oublierMajSurPlace();
eq(majSurPlacePour("stagiaires"), null, "oubliée");

// 3. Adresse courante
noterAdresse("#/stagiaires/3");
eq(adresseCourante(), "#/stagiaires/3", "adresse notée");

console.log(`navigation : ${n} assertions OK`);
```

Dans `tests/chatbot-rules.test.mjs`, ajouter après le test `pageDepuisHash extrait la route, defaut mon-suivi` :

```js
test("pageDepuisHash ne garde que la page, sans fiche ni partie", () => {
  assert.equal(pageDepuisHash("#/stagiaires/12/epcf"), "stagiaires");
  assert.equal(pageDepuisHash("#/mon-suivi/dp"), "mon-suivi");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node tests/navigation.test.mjs ; node tests/chatbot-rules.test.mjs`
Expected: `Cannot find module .../js/navigation.js` ; le test chatbot échoue (`'stagiaires/12/epcf' !== 'stagiaires'`).

- [ ] **Step 3: Write `js/navigation.js`**

```js
// Navigation interne (chantier D, lot 2).
// - Garde de saisie : une vue qui a une saisie en cours (grille EPCF) pose une
//   garde ; quitter (autre adresse, onglet, Actualiser) demande confirmation.
// - Mise à jour sur place : quand seule la fin de l'adresse change
//   (#/stagiaires/12 → /14, #/mon-suivi → /epcf), la page se met à jour
//   elle-même au lieu d'être reconstruite (liste gardée, défilement gardé).
// Rien n'est touché au chargement du module : testable en node.

let garde = null;          // { estSale: () => boolean, message: string }
let majSurPlace = null;    // { route, fn(adresse) }
let adresse = "";          // dernière adresse affichée, remise si la garde refuse

export function poserGardeSortie(g) { garde = g; }
// Sans argument : lève toute garde. Avec : seulement si c'est encore la sienne.
export function leverGardeSortie(g) { if (!g || garde === g) garde = null; }
export function gardeActive() { return !!garde && !!garde.estSale(); }

// Peut-on quitter ce qui est affiché ? Question seulement si une saisie est en
// cours ; en cas d'accord, la garde tombe (pas de seconde question).
export function peutQuitter(confirmer = (m) => window.confirm(m)) {
  if (!gardeActive()) return true;
  if (!confirmer(garde.message)) return false;
  garde = null;
  return true;
}

export function surChangementAdresse(route, fn) { majSurPlace = { route, fn }; }
export function majSurPlacePour(route) { return majSurPlace && majSurPlace.route === route ? majSurPlace.fn : null; }
export function oublierMajSurPlace() { majSurPlace = null; }

export function noterAdresse(h) { adresse = h; }
export function adresseCourante() { return adresse; }

// Met l'adresse à jour sans étape d'historique ni nouveau rendu (onglet choisi,
// adresse remise après un refus de la garde).
export function remplacerAdresse(h) {
  adresse = h;
  try { history.replaceState(null, "", h || location.pathname + location.search); } catch (e) { /* hors navigateur */ }
}

// Fermer ou recharger la page avec une saisie en cours : alerte du navigateur.
export function installerGardeNavigateur() {
  window.addEventListener("beforeunload", (e) => {
    if (!gardeActive()) return;
    e.preventDefault();
    e.returnValue = "";
  });
}
```

- [ ] **Step 4: `js/chatbot-rules.js`, la page seule**

Remplacer :

```js
export function pageDepuisHash(hash) {
  const route = String(hash ?? "").replace(/^#\//, "");
  return route || "mon-suivi";
}
```

par :

```js
// Le premier segment seulement (#/stagiaires/12/epcf → stagiaires) : la fonction
// serveur n'accepte qu'un mot simple comme nom de page.
export function pageDepuisHash(hash) {
  const route = String(hash ?? "").replace(/^#\//, "").split("/")[0];
  return route || "mon-suivi";
}
```

- [ ] **Step 5: `js/subtabs.js`, deux options**

Dans l'en-tête de commentaire, après la ligne `// opts.activeKey : onglet initial ; opts.storageKey : mémorise le dernier onglet choisi.`, ajouter :

```js
// opts.onChange(key) : appelé quand l'utilisateur choisit un onglet (pas au rendu
// initial). opts.avantChangement() : renvoie false pour garder l'onglet affiché
// (saisie en cours qu'on ne veut pas perdre).
```

Remplacer `const { activeKey, storageKey } = opts;` par `const { activeKey, storageKey, onChange, avantChangement } = opts;`.

Remplacer la fonction `activate` et le `onClick` des boutons :

```js
  function activate(key, parUtilisateur = false) {
    if (parUtilisateur && avantChangement && !avantChangement()) return;
    current = key;
    const myGen = ++gen;
    if (storageKey) { try { localStorage.setItem(storageKey, key); } catch (e) { /* ignore */ } }
    Object.entries(buttons).forEach(([k, b]) => {
      const on = k === key;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    clear(panel);
    const tab = tabs.find((t) => t.key === key);
    if (tab) tab.render(panel, { isActive: () => current === key && gen === myGen });
    if (parUtilisateur && onChange) onChange(key);
  }

  tabs.forEach((t) => {
    const b = el("button", { class: "subtab", type: "button", role: "tab",
      onClick: () => activate(t.key, true) }, t.label);
```

(le reste de la boucle et de la fonction est inchangé).

- [ ] **Step 6: `js/main.js`, routeur**

Ajouter aux imports (après celui de `./views/ccp2.js`) :

```js
import { lireAdresse } from "./route-rules.js?v=20261003b";
import {
  peutQuitter, leverGardeSortie, majSurPlacePour, oublierMajSurPlace,
  noterAdresse, adresseCourante, remplacerAdresse, installerGardeNavigateur,
} from "./navigation.js?v=20261003b";
```

Remplacer le début de `navigate()` jusqu'à `marquerOngletActif();` inclus :

```js
async function navigate({ force = false } = {}) {
  // Garde de saisie (chantier D, lot 2) : une grille EPCF commencée n'est pas
  // abandonnée sans accord. Refus : l'adresse affichée est remise, sans rendu.
  if (!peutQuitter()) { remplacerAdresse(adresseCourante()); return; }
  leverGardeSortie();
  // Adresses à segments (#/stagiaires/12/epcf) : le premier choisit la page, la
  // page lit le reste. Page de repli : « Mon suivi », où chacun retrouve ce qui
  // l'attend, son planning à venir et ses résultats.
  let route = lireAdresse(location.hash).route;
  if (!routes[route]) route = "mon-suivi";
  // Module fermé pour la promo (lien, adresse saisie, nouveauté ancienne) : un
  // stagiaire est ramené sur Mon suivi, avec un mot d'explication.
  if (!routeVisible(route)) {
    toast("Cette partie n'est pas encore ouverte pour ta promo.", "info", 3500);
    try { history.replaceState(null, "", "#/mon-suivi"); } catch (e) { /* ignore */ }
    route = "mon-suivi";
  }
  memoriserRoute(route);
  noterAdresse(location.hash);
  // Même page, autre fiche ou autre partie : la page se met à jour elle-même.
  // force : Actualiser, changement de rôle, Réessayer veulent un vrai rendu.
  const surPlace = !force && route === lastRoute ? majSurPlacePour(route) : null;
  if (surPlace) {
    try { await surPlace(lireAdresse(location.hash)); return; }
    catch (e) { console.error(e); }   // repli : rendu complet ci-dessous
  }
  oublierMajSurPlace();
  // En QUITTANT le planning (pas sur un simple remount : undo, refresh d'auth…),
  // le mode édition retombe : la vue se rouvrira toujours en lecture seule.
  if (lastRoute === "planning" && route !== "planning") resetPlanningEditMode();
  lastRoute = route;
  marquerOngletActif();
```

Dans la suite de `navigate`, remplacer `retry.addEventListener("click", () => navigate());` par `retry.addEventListener("click", () => navigate({ force: true }));`.

Remplacer `window.addEventListener("hashchange", navigate);` par `window.addEventListener("hashchange", () => navigate());`.

Dans `setupRefreshBtn`, remplacer le corps du clic :

```js
  btn.addEventListener("click", async () => {
    // Saisie en cours : pas de rechargement sans accord.
    if (!peutQuitter()) return;
    // Force le rechargement réel : vide le cache des données de référence
    invalidateCache();
    afficherChargement();
    // Un formateur a pu ouvrir un module depuis le dernier chargement.
    await chargerModules();
    navigate({ force: true });
  });
```

Dans `setupTodayBtn`, première ligne du clic : `if (!peutQuitter()) return;`, puis remplacer `await navigate();` par `await navigate({ force: true });`.

Dans `bootApp` : remplacer `onAdminChange(() => { renderTabs(); majBadgeNouveautes(); majPresenceModules(); navigate(); });` par la même ligne avec `navigate({ force: true })` ; dans `onModulesChange`, remplacer `if (lastRoute && !routeVisible(lastRoute)) navigate();` par `if (lastRoute && !routeVisible(lastRoute)) navigate({ force: true });` ; ajouter `installerGardeNavigateur();` juste après `initUndoKeyboard();`.

- [ ] **Step 7: Run the tests**

Run: `node tests/navigation.test.mjs ; node tests/chatbot-rules.test.mjs ; for f in tests/*.test.mjs; do node "$f" > /dev/null || echo "ECHEC $f"; done`
Expected: `navigation : 16 assertions OK`, les tests chatbot passent, aucune ligne `ECHEC`.

- [ ] **Step 8: Bench check of the router**

Préparer le banc une fois pour tout le lot : copier `_harness_build.mjs` et `_harness_supabase.js` depuis `C:/Users/watch/Dev/ECSR/TP_ECSR_App` dans le worktree, lancer `node _harness_build.mjs`, ajouter une entrée temporaire `banc-espace-stagiaires` (port 8032, dossier `C:/Users/watch/Dev/ecsr-promo-espace-stagiaires`) au `.claude/launch.json` du worktree de session, `preview_start`, puis `git checkout -- .claude/launch.json` dans le worktree de session. Ouvrir `_harness.html?cb=<neuf>#/planning`, vérifier le jeton de l'import map, la console sans erreur, puis naviguer Planning, Notes, Cours, Mon espace : chaque page s'affiche comme avant.

- [ ] **Step 9: Commit**

```bash
git add js/navigation.js js/main.js js/subtabs.js js/chatbot-rules.js tests/navigation.test.mjs tests/chatbot-rules.test.mjs
git commit -m "Lot 2 : garde de saisie, mise a jour sur place et adresses a segments"
```

---

### Task 3: La fiche partagée et Mon espace (onglets ou sommaire)

**Files:**
- Modify: `js/views/mon-suivi.js` (imports, titres des sections, fiche, `renderMonSuivi`), `js/db.js` (trois lectures légères, commentaire du dossier pro), `js/auth-admin.js` (`monStagiaireId`), `js/views/epcf-livret.js:459`, `js/views/dp.js:394` (événement), `css/style.css` (fin de fichier)

**Interfaces:**
- Consumes: Task 1 (`PARTIES`, `lireAdresse`, `adresseFiche`, `etatsSommaire`, `passagesAVenir`, `EVT_DOCUMENT`), Task 2 (`surChangementAdresse`, `remplacerAdresse`, `peutQuitter`, options de `renderSubTabs`).
- Produces (exports de `mon-suivi.js`): `dispositionFiche() → "onglets"|"sommaire"`, `chargerContexteFiche() → Promise<stagiaires[]>`, `chargerFiche(id) → Promise<donnees>` (`{ id, items, evaluations, epcfEvals, stagiaireRow, passRows, livret, dossier }`), `renderFiche(container, donnees, opts)` avec `opts = { soi, partie, disposition, titre, retour: {label, href}|null, adresse(p) → hash, storageKey, onEpcfEnregistre?(evals) }`, `noterDocument(donnees, detail) → boolean`, `ecouterDocuments(fn(detail))`, `afficherErreur(zone, erreur, reessayer)`. `db.js` : `listEpcfEtats(filters)`, `listLivretsIndex(filters)`, `listDossiersIndex(filters)`. `auth-admin.js` : `monStagiaireId() → number|null`.

- [ ] **Step 1: `js/db.js`**

Remplacer le commentaire d'en-tête de la section Dossier Professionnel :

```js
// === Dossier Professionnel (document ministère, 1 dossier / stagiaire) ===
// Le DP appartient au candidat. La base l'ouvre en lecture et en écriture à son
// propriétaire, aux formateurs et aux admins de la promo (droits révisés le
// 16/09, vérifiés en production le 03/10/2026).
```

Ajouter juste avant `// === Audit passages` :

```js
// === Index légers des états (chantier D, lot 2) ===
// Juste ce que demandent les états de la page Stagiaires et du sommaire, sans le
// contenu des documents. La base filtre : un formateur lit sa promo, un stagiaire
// ses propres lignes.

export async function listEpcfEtats(filters = {}) {
  let q = supabase.from("epcf_evaluations").select("stagiaire_id, trame, date_eval");
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listLivretsIndex(filters = {}) {
  let q = supabase.from("epcf_livrets").select("stagiaire_id, updated_at");
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listDossiersIndex(filters = {}) {
  let q = supabase.from("dp_dossiers").select("stagiaire_id, updated_at");
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: `js/auth-admin.js`**

Après `export function isStagiaire() {…}` :

```js
// Profil stagiaire de la personne connectée, tel que l'app le traite : en aperçu
// « Formateur », le fondateur n'en a pas, comme un vrai formateur (chantier D).
export function monStagiaireId() {
  if (getViewAs() === "prof") return null;
  return currentProfile?.stagiaire_id ?? null;
}
```

- [ ] **Step 3: événement après enregistrement (livret, dossier)**

`js/views/epcf-livret.js` : ajouter l'import `import { EVT_DOCUMENT } from "../fiche-rules.js?v=20261003b";` ; dans `saveNow`, remplacer `await upsertEpcfLivret({` … `});` par :

```js
      const row = await upsertEpcfLivret({
        stagiaire_id: stagiaireId,
        data: collectData(doc),
        updated_by_who: getCurrentWho(),
      });
      // La fiche et la page Stagiaires mettent leur état « Livret » à jour.
      document.dispatchEvent(new CustomEvent(EVT_DOCUMENT, { detail: {
        genre: "livret", stagiaireId, updatedAt: row?.updated_at || new Date().toISOString() } }));
```

`js/views/dp.js` : même import ; remplacer l'appel `await upsertDpDossier({` … `});` par :

```js
      const row = await upsertDpDossier({
        stagiaire_id: stagiaireId,
        data: collectData(fluxEdition),
        updated_by_who: getCurrentWho(),
      });
      // La fiche et la page Stagiaires mettent leur état « Dossier » à jour.
      document.dispatchEvent(new CustomEvent(EVT_DOCUMENT, { detail: {
        genre: "dossier", stagiaireId, updatedAt: row?.updated_at || new Date().toISOString() } }));
```

- [ ] **Step 4: `js/views/mon-suivi.js`, imports**

Remplacer les lignes d'import 1 à 13 par :

```js
import { listStagiaires, listEvaluations, getPlanning, getHalfMetaForWeek, getJoursOff, getSetting,
         listProfs, listEpcf, getEpcfMoyennes, listThemes,
         getStagiaire, setDateNaissance, listPassages,
         listLivretsIndex, listDossiersIndex } from "../db.js?v=20261003b";
import { el, clear, isoDate, getMonday, addDays, formatDate, displayStagiaire, toast } from "../utils.js?v=20261003b";
import { HALF_DAYS, RESULTATS } from "../config.js?v=20261003b";
import { isAdmin, isProf, monStagiaireId } from "../auth-admin.js?v=20261003b";
import { renderEpcfTrameSection } from "../epcf-restitution.js?v=20261003b";
import { renderSubTabs } from "../subtabs.js?v=20261003b";
import { renderDp } from "./dp.js?v=20261003b";
import { renderEpcfLivret } from "./epcf-livret.js?v=20261003b";
import { rolesPourEntry, ROLE_ORDER } from "../creneaux-rules.js?v=20261003b";
import { statsPassages } from "../passages-stats.js?v=20261003b";
import { moduleVisible, moduleMasque, repereMasque } from "../modules-etat.js?v=20261003b";
import { icon } from "../icons.js?v=20261003b";
import { PARTIES, lireAdresse, adresseFiche } from "../route-rules.js?v=20261003b";
import { etatsSommaire, passagesAVenir, EVT_DOCUMENT } from "../fiche-rules.js?v=20261003b";
import { surChangementAdresse, remplacerAdresse, peutQuitter } from "../navigation.js?v=20261003b";
```

- [ ] **Step 5: titres neutres quand ce n'est pas sa fiche**

`function renderPassagesSection(items)` devient `function renderPassagesSection(items, soi = true)` avec le titre `soi ? "Mon planning à venir" : "Planning à venir"` ; `function renderChartSection(evaluations)` devient `function renderChartSection(evaluations, soi = true)` avec `soi ? "Mon évolution" : "Évolution"` ; `function renderEffectuesSection(rows)` devient `function renderEffectuesSection(rows, soi = true)` avec `soi ? "Mes passages effectués" : "Passages effectués"`.

- [ ] **Step 6: la fiche et Mon espace**

Remplacer toute la fonction `export async function renderMonSuivi(container) {…}` (jusqu'à la fin du fichier) par :

```js
// === La fiche d'une personne (chantier D, lot 2) ===
// Partagée par Mon espace (sa propre fiche) et la page Stagiaires (la fiche d'un
// stagiaire, vue par un formateur). Deux dispositions, choisies à l'affichage :
// onglets sur ordinateur ; sur iPhone, un sommaire puis la partie en plein écran.

const LIBELLE_PARTIE = { passages: "Passages", epcf: "EPCF", evolution: "Évolution", livret: "Livret", dp: "Dossier pro" };
// Module de chaque partie (js/modules-data.js) : fermé pour la promo, la partie
// disparaît chez un stagiaire et porte le repère chez un formateur.
const MODULE_DE_PARTIE = { passages: null, epcf: "epcf", evolution: "notes", livret: "livret", dp: "dp" };

export function dispositionFiche() {
  return window.matchMedia("(max-width: 760px)").matches ? "sommaire" : "onglets";
}

// Contexte commun à toutes les fiches (formateurs, moyennes EPCF de la classe,
// thèmes, noms) : une lecture par ouverture de page. Renvoie les stagiaires actifs.
export async function chargerContexteFiche() {
  const [profsData, moySalleData, moyVehiculeData, themesData, stagiairesData] = await Promise.all([
    listProfs(), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule"), listThemes(), listStagiaires(),
  ]);
  profs = profsData; moySalle = moySalleData; moyVehicule = moyVehiculeData;
  themeNumByTitre = {};
  (themesData || []).forEach((t) => {
    if (t.type === "theme" && t.numero != null && t.titre) themeNumByTitre[normTitre(t.titre)] = t.numero;
  });
  stagiaireNoms = {};
  (stagiairesData || []).forEach((s) => { stagiaireNoms[s.id] = displayStagiaire(s); });
  return stagiairesData || [];
}

// Données d'une personne, pour toutes les parties de sa fiche.
export async function chargerFiche(id) {
  const [items, evaluations, epcfEvals, stagiaireRow, passRows, livrets, dossiers] = await Promise.all([
    loadUpcoming(id),
    listEvaluations({ stagiaire_id: id }),
    listEpcf({ stagiaire_id: id }),
    getStagiaire(id),
    listPassages({ stagiaire_id: id }),
    listLivretsIndex({ stagiaire_id: id }),
    listDossiersIndex({ stagiaire_id: id }),
  ]);
  return { id, items, evaluations, epcfEvals, stagiaireRow, passRows,
    livret: (livrets || [])[0] || null, dossier: (dossiers || [])[0] || null };
}

// Livret ou dossier enregistré (événement EVT_DOCUMENT) : l'état de la fiche suit.
export function noterDocument(d, detail) {
  if (!d || !detail || detail.stagiaireId !== d.id) return false;
  const ligne = { stagiaire_id: d.id, updated_at: detail.updatedAt };
  if (detail.genre === "livret") d.livret = ligne;
  else if (detail.genre === "dossier") d.dossier = ligne;
  else return false;
  return true;
}

// Une seule écoute pour toute l'app : la page affichée y branche son traitement.
let surDocument = null;
let ecouteDocumentsPosee = false;
export function ecouterDocuments(fn) {
  surDocument = fn;
  if (ecouteDocumentsPosee) return;
  document.addEventListener(EVT_DOCUMENT, (e) => { if (surDocument) surDocument(e.detail); });
  ecouteDocumentsPosee = true;
}

// Boîte d'erreur de chargement, dans la zone donnée (l'en-tête reste utilisable).
export function afficherErreur(zone, e, reessayer) {
  console.error(e);
  clear(zone);
  const isTimeout = /abort|timeout|network|fetch/i.test(e?.message || String(e));
  const retry = el("button", { class: "btn primary" }, "Réessayer");
  retry.addEventListener("click", () => reessayer());
  zone.appendChild(el("div", { class: "view-error-box" },
    el("p", { class: "view-error-title" }, isTimeout ? "Connexion trop lente" : "Une erreur est survenue"),
    el("p", { class: "view-error-sub" }, isTimeout
      ? "Le serveur n'a pas répondu à temps. Vérifie ta connexion et réessaie."
      : "Détail : " + (e?.message || e)),
    retry));
  toast(isTimeout ? "Connexion trop lente, réessaie" : (e?.message || String(e)), "error");
}

function partiesVisibles() {
  return PARTIES.filter((p) => !MODULE_DE_PARTIE[p] || moduleVisible(MODULE_DE_PARTIE[p]));
}

function lienRetour(label, href) {
  return el("a", { class: "fiche-retour", href }, icon.chevronLeft(), el("span", {}, label));
}

export function renderFiche(container, d, opts) {
  clear(container);
  const parties = partiesVisibles();
  const partie = parties.includes(opts.partie) ? opts.partie : null;
  if (opts.disposition === "onglets") {
    if (opts.titre) container.appendChild(el("h2", { class: "fiche-titre" }, opts.titre));
    container.appendChild(renderSubTabs(parties.map((p) => ({
      key: p, label: LIBELLE_PARTIE[p], module: MODULE_DE_PARTIE[p] || undefined,
      render: (panel, ctx) => rendrePartie(panel, p, d, opts, ctx),
    })), {
      activeKey: partie || undefined,
      storageKey: opts.storageKey,
      // L'onglet choisi s'inscrit dans l'adresse, sans étape d'historique.
      onChange: (p) => remplacerAdresse(opts.adresse(p)),
      avantChangement: () => peutQuitter(),
    }));
    return;
  }
  if (partie) {
    // iPhone, une partie en plein écran : le retour mène au sommaire.
    container.appendChild(lienRetour(opts.titre || "Mon espace", opts.adresse(null)));
    container.appendChild(el("h2", { class: "fiche-titre" }, LIBELLE_PARTIE[partie]));
    const panel = el("div", { class: "fiche-partie" });
    container.appendChild(panel);
    rendrePartie(panel, partie, d, opts, { isActive: () => panel.isConnected });
    return;
  }
  // iPhone : le sommaire.
  if (opts.retour) container.appendChild(lienRetour(opts.retour.label, opts.retour.href));
  if (opts.titre) container.appendChild(el("h2", { class: "fiche-titre" }, opts.titre));
  container.appendChild(rendreSommaire(d, parties, opts));
}

function rendreSommaire(d, parties, opts) {
  const etats = etatsSommaire({
    aVenir: passagesAVenir(d.items, isoDate(new Date())),
    evals: d.epcfEvals, livret: d.livret, dossier: d.dossier, soi: !!opts.soi,
  });
  const liste = el("nav", { class: "fiche-sommaire", "aria-label": "Parties de la fiche" });
  parties.forEach((p) => {
    const etat = etats[p];
    const nom = el("span", { class: "fiche-ligne-nom" }, LIBELLE_PARTIE[p]);
    const ligne = el("a", { class: "fiche-ligne", href: opts.adresse(p) },
      nom,
      etat ? el("span", { class: "fiche-ligne-etat" + (etat.afaire ? " afaire" : "") }, etat.texte) : null,
      icon.chevronRight());
    if (MODULE_DE_PARTIE[p]) repereMasque(ligne, moduleMasque(MODULE_DE_PARTIE[p]), nom);
    liste.appendChild(ligne);
  });
  return liste;
}

// Date de naissance du profil, reportée sur le livret : la personne elle-même,
// un formateur ou un admin la saisit. Rangée dans la partie Livret, seule à s'en servir.
function champNaissance(d, soi) {
  if (!(soi || isAdmin() || isProf())) return null;
  const dob = el("input", { type: "date", value: d.stagiaireRow?.date_naissance || "" });
  dob.addEventListener("change", async () => {
    try {
      await setDateNaissance(d.id, dob.value || null);
      if (d.stagiaireRow) d.stagiaireRow.date_naissance = dob.value || null;
      toast("Date de naissance enregistrée", "success", 2000);
    } catch (e) { console.error(e); toast(e?.message || String(e), "error"); }
  });
  return el("div", { class: "ms-naissance" },
    el("label", {}, "Date de naissance"), dob,
    el("span", { class: "muted ms-naissance-hint" }, "Reportée automatiquement sur le livret EPCF."));
}

function erreurPartie(zone, isActive, texte) {
  return (e) => {
    console.error(e);
    if (!isActive || isActive()) {
      clear(zone);
      zone.appendChild(el("p", { class: "muted" }, texte));
    }
  };
}

// Contenu d'une partie. ctx.isActive : faux si l'on est passé à autre chose
// pendant un chargement (la partie ne doit plus écrire).
function rendrePartie(panel, partie, d, opts, ctx) {
  const isActive = ctx && ctx.isActive;
  const soi = !!opts.soi;
  if (partie === "passages") {
    panel.appendChild(renderPassagesSection(d.items, soi));
    panel.appendChild(renderEffectuesSection(d.passRows, soi));
  } else if (partie === "epcf") {
    panel.appendChild(renderEpcfTrameSection("salle", d.epcfEvals.filter((e) => e.trame === "salle"), moySalle));
    panel.appendChild(renderEpcfTrameSection("vehicule", d.epcfEvals.filter((e) => e.trame === "vehicule"), moyVehicule));
  } else if (partie === "evolution") {
    panel.appendChild(renderChartSection(d.evaluations, soi));
  } else if (partie === "livret") {
    const naissance = champNaissance(d, soi);
    if (naissance) panel.appendChild(naissance);
    const zone = el("div");
    panel.appendChild(zone);
    renderEpcfLivret(zone, { stagiaireId: d.id, embedded: true, isActive })
      .catch(erreurPartie(zone, isActive, "Erreur de chargement du livret EPCF. Rouvre la partie pour réessayer."));
  } else if (partie === "dp") {
    // Le DP appartient au candidat : éditable dans son espace ; un formateur
    // peut aussi y écrire pour l'accompagner (droits révisés le 16/09).
    renderDp(panel, { stagiaireId: d.id, embedded: true, isActive })
      .catch(erreurPartie(panel, isActive, "Erreur de chargement du dossier professionnel. Rouvre la partie pour réessayer."));
  }
}

// === Mon espace : la fiche de la personne connectée ===
export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const monId = monStagiaireId();
  await chargerContexteFiche();
  clear(container);

  const header = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Espace personnel"),
      el("h2", {}, "Mon espace"),
      el("p", { class: "subtitle" }, moduleVisible("notes")
        ? "Mon planning à venir et l'évolution de mes résultats."
        : "Mon planning à venir."),
    ),
  );
  const corps = el("div", { class: "ms-body" });
  container.appendChild(header);
  container.appendChild(corps);
  if (monId == null) {
    corps.appendChild(el("p", { class: "muted" }, "Aucun profil stagiaire n'est relié à ce compte."));
    return;
  }

  let d = null;
  const dessiner = (adr) => {
    const disposition = dispositionFiche();
    // iPhone, dans une partie : le retour « ‹ Mon espace » remplace l'en-tête.
    header.hidden = disposition === "sommaire" && !!adr.partie;
    renderFiche(corps, d, {
      soi: true, partie: adr.partie, disposition, titre: null, retour: null,
      adresse: (p) => adresseFiche("mon-suivi", null, p),
      storageKey: "ecsr_monsuivi_subtab",
    });
    if (disposition === "sommaire") window.scrollTo(0, 0);
  };
  const charger = async () => {
    clear(corps);
    corps.appendChild(el("div", { class: "loading" }, "Chargement"));
    try { d = await chargerFiche(monId); }
    catch (e) { afficherErreur(corps, e, charger); return; }
    dessiner(lireAdresse(location.hash));
  };
  surChangementAdresse("mon-suivi", async (adr) => { if (d) dessiner(adr); });
  ecouterDocuments((detail) => { noterDocument(d, detail); });
  await charger();
}
```

Les variables de module en tête de fichier (`profs`, `moySalle`, `moyVehicule`, `stagiaireNoms`, `themeNumByTitre`) restent utilisées : `chargerContexteFiche` les remplit.

- [ ] **Step 7: CSS de la fiche**

Ajouter en fin de `css/style.css` :

```css
/* ===== Chantier D, lot 2 : fiche en sommaire et page Stagiaires ===== */

/* Fiche : nom de la personne ou de la partie, lien de retour (iPhone). */
.fiche-titre { margin: 0 0 0.9rem; font-size: 1.3rem; }
.fiche-retour {
  display: inline-flex; align-items: center; gap: 0.15rem;
  margin: 0 0 0.6rem; color: var(--accent-strong); text-decoration: none; font-size: 1rem;
}
.fiche-retour svg { width: 18px; height: 18px; }

/* Sommaire (iPhone) : une grande ligne par partie, à la manière des Réglages. */
.fiche-sommaire {
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg-elev); border: 1px solid var(--line); border-radius: 12px;
}
.fiche-ligne {
  display: flex; align-items: center; gap: 0.6rem; min-height: 50px; padding: 0.7rem 0.9rem;
  color: var(--text); text-decoration: none; border-top: 1px solid var(--line-faint);
}
.fiche-ligne:first-child { border-top: none; }
.fiche-ligne:active { background: var(--bg-subtle); }
.fiche-ligne-nom { flex: 1; font-size: 1rem; }
.fiche-ligne-etat { color: var(--text-muted); font-size: 0.92rem; }
.fiche-ligne > svg { width: 18px; height: 18px; color: var(--text-faint); flex: none; }
.fiche-ligne-etat.afaire, .stg-etat.afaire { color: var(--c-wait); }
```

- [ ] **Step 8: Run all tests**

Run: `for f in tests/*.test.mjs; do node "$f" > /dev/null || echo "ECHEC $f"; done`
Expected: aucune ligne `ECHEC`.

- [ ] **Step 9: Bench check**

`node _harness_build.mjs`, puis `_harness.html?cb=<neuf>&role=stagiaire#/mon-suivi` :
- ordinateur (1280 px) : titre « Mon espace », cinq onglets, plus de menu « Élève » ; onglet Livret : champ « Date de naissance » en tête ; cliquer un onglet met l'adresse à jour (`#/mon-suivi/livret`) sans nouvelle entrée d'historique (`history.length` inchangé) ;
- iPhone (375 px, recharger) : sommaire de cinq lignes avec leurs états ; toucher EPCF ouvre `#/mon-suivi/epcf` avec « ‹ Mon espace » et sans l'en-tête ; `history.back()` ramène au sommaire ;
- sans `role` (admin et stagiaire) : sa propre fiche, sans menu ;
- console sans erreur.

- [ ] **Step 10: Commit**

```bash
git add js/views/mon-suivi.js js/db.js js/auth-admin.js js/views/epcf-livret.js js/views/dp.js css/style.css
git commit -m "Lot 2 : fiche partagee (onglets ou sommaire) et Mon espace"
```

---

### Task 4: La page Stagiaires

**Files:**
- Create: `js/views/stagiaires.js`
- Modify: `js/main.js` (route, redirections), `js/views/home.js` (tuile), `js/auth-admin.js` (menu du compte), `js/modules-data.js:20` (`ROUTES_SOCLE`), `css/style.css` (fin), `_harness_supabase.js` du worktree (données de test, hors git)

**Interfaces:**
- Consumes: Task 1 (`lireAdresse`, `adresseFiche`, `ligneListe`, `pagePersonnelle`), Task 2 (`surChangementAdresse`), Task 3 (`chargerContexteFiche`, `chargerFiche`, `renderFiche`, `dispositionFiche`, `noterDocument`, `ecouterDocuments`, `afficherErreur`, `listEpcfEtats`, `listLivretsIndex`, `listDossiersIndex`, `monStagiaireId`).
- Produces: `renderStagiaires(container)` ; route `stagiaires`.

- [ ] **Step 1: `js/views/stagiaires.js`**

```js
// Page Stagiaires (chantier D, lot 2) : la promo, une fiche par personne, pour les
// formateurs et les admins. Ordinateur : la liste à gauche, la fiche à droite
// (onglets). iPhone : la liste, puis la fiche en sommaire, puis une partie en
// plein écran. Adresses : #/stagiaires, #/stagiaires/<id>, #/stagiaires/<id>/<partie>.

import { listEpcfEtats, listLivretsIndex, listDossiersIndex } from "../db.js?v=20261003b";
import { el, clear, displayStagiaire, compareByNom } from "../utils.js?v=20261003b";
import { icon } from "../icons.js?v=20261003b";
import { adresseFiche, lireAdresse } from "../route-rules.js?v=20261003b";
import { ligneListe } from "../fiche-rules.js?v=20261003b";
import { surChangementAdresse } from "../navigation.js?v=20261003b";
import {
  chargerContexteFiche, chargerFiche, renderFiche, dispositionFiche,
  noterDocument, ecouterDocuments, afficherErreur,
} from "./mon-suivi.js?v=20261003b";

const CLE_DERNIERE = "ecsr_stagiaires_derniere";
const CLE_ONGLET = "ecsr_stagiaires_subtab";

function lireDerniere() {
  try {
    const v = Number(localStorage.getItem(CLE_DERNIERE));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch (e) { return null; }
}
function noterDerniere(id) {
  try { localStorage.setItem(CLE_DERNIERE, String(id)); } catch (e) { /* navigation privée */ }
}

export async function renderStagiaires(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const [stagiairesData, epcf, livrets, dossiers] = await Promise.all([
    chargerContexteFiche(), listEpcfEtats(), listLivretsIndex(), listDossiersIndex(),
  ]);
  const stagiaires = stagiairesData.slice().sort(compareByNom);
  const etats = { epcf: epcf || [], livrets: livrets || [], dossiers: dossiers || [] };
  const fiches = new Map();   // id → données : une lecture par personne et par visite
  let generation = 0;         // une fiche lente ne s'affiche pas à la place d'une autre
  let choisi = null;          // fiche affichée (ligne surlignée)
  let defilementListe = 0;    // position de la liste sur iPhone, rendue au retour

  const entete = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Formateurs"),
      el("h2", {}, "Stagiaires"),
      el("p", { class: "subtitle" }, "La promo, une fiche par personne."),
    ),
  );
  const liste = el("nav", { class: "stg-liste", "aria-label": "Stagiaires de la promo" });
  const zoneFiche = el("div", { class: "stg-fiche" });

  function etatsDe(id) {
    return ligneListe({
      evals: etats.epcf.filter((r) => r.stagiaire_id === id),
      livret: etats.livrets.find((r) => r.stagiaire_id === id) || null,
      dossier: etats.dossiers.find((r) => r.stagiaire_id === id) || null,
    });
  }

  function dessinerListe() {
    clear(liste);
    if (!stagiaires.length) {
      liste.appendChild(el("p", { class: "muted" }, "Aucun stagiaire actif dans la promo."));
      return;
    }
    stagiaires.forEach((s) => {
      const ligneEtats = el("span", { class: "stg-etats" });
      etatsDe(s.id).forEach((e, i) => {
        if (i) ligneEtats.appendChild(document.createTextNode(" · "));
        ligneEtats.appendChild(el("span", { class: "stg-etat" + (e.afaire ? " afaire" : "") }, e.texte));
      });
      liste.appendChild(el("a", {
        class: "stg-ligne" + (s.id === choisi ? " active" : ""),
        href: adresseFiche("stagiaires", s.id, null),
        "aria-current": s.id === choisi ? "true" : null,
      },
        el("span", { class: "stg-ligne-texte" }, el("span", { class: "stg-nom" }, displayStagiaire(s)), ligneEtats),
        icon.chevronRight()));
    });
  }

  async function afficherFiche(id, partie, disposition) {
    const jeton = ++generation;
    const s = stagiaires.find((x) => x.id === id);
    noterDerniere(id);
    let d = fiches.get(id);
    if (!d) {
      clear(zoneFiche);
      zoneFiche.appendChild(el("div", { class: "loading" }, "Chargement"));
      try { d = await chargerFiche(id); }
      catch (e) {
        if (jeton === generation) afficherErreur(zoneFiche, e, () => afficherFiche(id, partie, disposition));
        return;
      }
      if (jeton !== generation) return;
      fiches.set(id, d);
    }
    renderFiche(zoneFiche, d, {
      soi: false, partie, disposition,
      titre: displayStagiaire(s),
      retour: disposition === "sommaire" ? { label: "Stagiaires", href: "#/stagiaires" } : null,
      adresse: (p) => adresseFiche("stagiaires", id, p),
      storageKey: CLE_ONGLET,
      // Évaluation EPCF enregistrée : la ligne de la liste suit, sans relecture.
      onEpcfEnregistre: (evals) => {
        etats.epcf = etats.epcf.filter((r) => r.stagiaire_id !== id)
          .concat(evals.map((e) => ({ stagiaire_id: id, trame: e.trame, date_eval: e.date_eval })));
        dessinerListe();
      },
    });
  }

  async function afficher(adr) {
    const disposition = dispositionFiche();
    const connu = adr.id != null && stagiaires.some((s) => s.id === adr.id);
    if (disposition === "onglets") {
      // Ordinateur : toujours une fiche à côté de la liste, la dernière consultée.
      const derniere = lireDerniere();
      const id = connu ? adr.id
        : (stagiaires.some((s) => s.id === derniere) ? derniere : (stagiaires[0]?.id ?? null));
      choisi = id;
      clear(container);
      container.appendChild(entete);
      container.appendChild(el("div", { class: "stg-colonnes" }, liste, zoneFiche));
      dessinerListe();
      if (id == null) { clear(zoneFiche); return; }
      await afficherFiche(id, connu ? adr.partie : null, disposition);
      return;
    }
    // iPhone : un seul écran à la fois.
    if (!connu) {
      choisi = null;
      clear(container);
      container.appendChild(entete);
      container.appendChild(liste);
      dessinerListe();
      window.scrollTo(0, defilementListe);
      return;
    }
    if (liste.isConnected) defilementListe = window.scrollY;
    choisi = adr.id;
    clear(container);
    container.appendChild(zoneFiche);
    window.scrollTo(0, 0);
    await afficherFiche(adr.id, adr.partie, disposition);
  }

  // Livret ou dossier enregistré : la fiche en mémoire et la ligne suivent.
  ecouterDocuments((detail) => {
    for (const d of fiches.values()) noterDocument(d, detail);
    const cle = detail.genre === "livret" ? "livrets" : detail.genre === "dossier" ? "dossiers" : null;
    if (!cle) return;
    etats[cle] = etats[cle].filter((r) => r.stagiaire_id !== detail.stagiaireId)
      .concat([{ stagiaire_id: detail.stagiaireId, updated_at: detail.updatedAt }]);
    if (liste.isConnected) dessinerListe();
  });
  surChangementAdresse("stagiaires", afficher);
  await afficher(lireAdresse(location.hash));
}
```

- [ ] **Step 2: `js/main.js`, route et redirections**

Imports : ajouter `import { renderStagiaires } from "./views/stagiaires.js?v=20261003b";` après celui de `./views/ccp2.js` ; remplacer `import { lireAdresse } from "./route-rules.js?v=20261003b";` par `import { lireAdresse, pagePersonnelle } from "./route-rules.js?v=20261003b";` ; remplacer `import { initAuth, onAdminChange, isAuth } from "./auth-admin.js?v=20261003b";` par `import { initAuth, onAdminChange, isAuth, isAdmin, isProf, monStagiaireId } from "./auth-admin.js?v=20261003b";`.

Dans `routes`, après `ccp2: renderCcp2,` : `stagiaires: renderStagiaires,`.

Dans `navigate`, juste avant `memoriserRoute(route);` :

```js
  // Page « à soi » (chantier D, lot 2) : un formateur sans profil stagiaire n'a pas
  // de Mon espace, il a la page Stagiaires ; un stagiaire n'a pas la page Stagiaires.
  const formateur = isAdmin() || isProf();
  if (route === "mon-suivi" && pagePersonnelle({ formateur, stagiaireId: monStagiaireId() }) === "stagiaires") {
    try { history.replaceState(null, "", "#/stagiaires"); } catch (e) { /* ignore */ }
    route = "stagiaires";
  } else if (route === "stagiaires" && !formateur) {
    try { history.replaceState(null, "", "#/mon-suivi"); } catch (e) { /* ignore */ }
    route = "mon-suivi";
  }
```

- [ ] **Step 3: tuile de l'Accueil**

`js/views/home.js` : `import { isAdmin, isProf, getProfile, getProfileWho } from "../auth-admin.js?v=20261003b";` ; remplacer le début du tableau `tiles` :

```js
  const tiles = [
    // La page Stagiaires (chantier D, lot 2) en tête, chez un formateur ou un admin.
    // Les autres tuiles suivent la barre d'onglets (Priorités se rejoint depuis le Planning).
    ...((isAdmin() || isProf())
      ? [{ route: "stagiaires", icon: "users", title: "Stagiaires", desc: "La promo, une fiche par personne" }]
      : []),
    { route: "planning",   icon: "calendar",     title: "Planning",         desc: "Cette semaine, créneaux & tirages" },
```

(les lignes suivantes du tableau sont inchangées).

- [ ] **Step 4: menu du compte**

`js/auth-admin.js` : ajouter l'import `import { pagePersonnelle } from "./route-rules.js?v=20261003b";` ; dans `openProfileMenu`, remplacer le bloc `persoBtn` et son commentaire :

```js
  // Accès direct à sa page depuis le badge : « cliquer sur mon nom » mène chez soi.
  // Un formateur sans profil stagiaire n'a pas de Mon espace : sa page est la page
  // Stagiaires (chantier D, lot 2). On change juste le hash, le routeur fait le rendu.
  const versStagiaires = pagePersonnelle({ formateur: isAdmin() || isProf(), stagiaireId: monStagiaireId() }) === "stagiaires";
  const persoBtn = el("button", { class: "btn full", onClick: () => {
    backdrop.remove();
    location.hash = versStagiaires ? "#/stagiaires" : "#/mon-suivi";
  }}, versStagiaires ? icon.users() : icon.user(), versStagiaires ? "Stagiaires" : "Mon espace personnel");
```

- [ ] **Step 5: `ROUTES_SOCLE`**

`js/modules-data.js` ligne 20 : `export const ROUTES_SOCLE = ["home", "mon-suivi", "config", "nouveautes", "stagiaires"];` et, juste au-dessus, compléter le commentaire existant par : `// stagiaires : page des formateurs, hors modules (chantier D, lot 2).`

- [ ] **Step 6: CSS de la liste**

Ajouter à la fin du bloc du lot 2 dans `css/style.css` :

```css
/* Page Stagiaires : ordinateur, la liste à gauche et la fiche à droite. */
.stg-colonnes {
  display: grid; grid-template-columns: minmax(0, 270px) minmax(0, 1fr);
  gap: 1.75rem; align-items: start; margin-top: 1.25rem;
}
.stg-liste { display: flex; flex-direction: column; gap: 0.2rem; }
.stg-ligne {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.75rem;
  border-radius: 10px; color: var(--text); text-decoration: none;
}
.stg-ligne:hover { background: var(--bg-subtle); }
.stg-ligne.active { background: var(--accent-soft); }
.stg-ligne.active .stg-nom { color: var(--accent-strong); }
.stg-ligne-texte { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.stg-nom { font-weight: 600; }
.stg-etats { font-size: 0.84rem; color: var(--text-muted); }
.stg-ligne > svg { display: none; width: 18px; height: 18px; color: var(--text-faint); flex: none; }
.stg-fiche { min-width: 0; }
@media (max-width: 760px) {
  /* iPhone : la liste devient un groupe de grandes lignes, avec la flèche. */
  .stg-liste {
    gap: 0; margin-top: 1rem; overflow: hidden;
    background: var(--bg-elev); border: 1px solid var(--line); border-radius: 12px;
  }
  .stg-ligne { min-height: 56px; padding: 0.7rem 0.9rem; border-radius: 0; border-top: 1px solid var(--line-faint); }
  .stg-ligne:first-child { border-top: none; }
  .stg-ligne.active { background: transparent; }
  .stg-ligne > svg { display: block; }
}
```

- [ ] **Step 7: données de test du banc (hors git)**

Dans le `_harness_supabase.js` du worktree, objet `FIXTURES` : remplacer `epcf_evaluations: []` par trois évaluations (stagiaire 1 : salle ; stagiaire 2 : salle et véhicule ; champs `id, stagiaire_id, trame, trame_version: 1, date_eval, evaluateur_prof_id: 1, meta: {}, scores: {}, competences_acquises: [], commentaire: null`) et ajouter `epcf_livrets: [{ id: 1, stagiaire_id: 2, data: {}, updated_at: "2026-09-20T09:00:00Z" }]` et `dp_dossiers: [{ id: 1, stagiaire_id: 1, data: {}, updated_at: "2026-09-29T09:00:00Z" }]`.

- [ ] **Step 8: Run all tests**

Run: `for f in tests/*.test.mjs; do node "$f" > /dev/null || echo "ECHEC $f"; done`
Expected: aucune ligne `ECHEC`.

- [ ] **Step 9: Bench check**

`node _harness_build.mjs` ; `_harness.html?cb=<neuf>&role=prof` :
- `#/mon-suivi` redirige vers `#/stagiaires` ; Accueil : tuile Stagiaires en tête ; menu du compte : bouton « Stagiaires » ;
- ordinateur : deux colonnes, états de chaque ligne (EPCF 1/2, Livret vierge en orange…), la dernière fiche rouverte ; cliquer un autre nom change la fiche sans redessiner l'en-tête et ajoute une entrée d'historique ; `history.back()` revient à la fiche d'avant ;
- iPhone (375 px) : liste avec flèches ; une ligne ouvre la fiche (« ‹ Stagiaires », nom, sommaire) ; une partie ouvre « ‹ <nom> » ; `history.back()` remonte d'un niveau ; retour à la liste : position de défilement rendue ;
- `role=stagiaire` sur `#/stagiaires` : redirigé vers `#/mon-suivi` ; sans `role` (admin et stagiaire) : la tuile mène à la promo, la pastille à son espace ;
- aucun débordement horizontal, console sans erreur.

- [ ] **Step 10: Commit**

```bash
git add js/views/stagiaires.js js/main.js js/views/home.js js/auth-admin.js js/modules-data.js css/style.css
git commit -m "Lot 2 : page Stagiaires (liste, fiche, tuile de l'Accueil, menu du compte)"
```

---

### Task 5: La saisie EPCF dans la fiche, Notes vue de la classe

**Files:**
- Modify: `js/views/epcf.js` (réécriture), `js/views/mon-suivi.js` (partie EPCF), `js/views/notes.js` (imports, sous-onglets), `js/modules-data.js:37-40`, `css/style.css` (fin)

**Interfaces:**
- Consumes: Task 2 (`poserGardeSortie`, `leverGardeSortie`), Task 3 (`renderFiche` opts `onEpcfEnregistre`), Task 4 (la page Stagiaires transmet `onEpcfEnregistre`).
- Produces: `renderEpcf(container, { embedded, isActive })` (moyennes de la classe pour tous) ; `renderEpcfPersonne(container, { stagiaire, evals, moyennes: { salle, vehicule }, outils, onEnregistre(evals), isActive })`.

- [ ] **Step 1: `js/views/epcf.js` (fichier entier)**

```js
// Vue EPCF (chantier D, lot 2).
//  - Notes, sous-onglet EPCF : les moyennes de la classe, pour tout le monde
//    (agrégats k-anonymisés, RPC autorisée à tout connecté).
//  - Fiche d'une personne (Mon espace, page Stagiaires) : ses résultats salle et
//    véhicule ; chez un formateur, la saisie (Évaluer, Modifier, Nouvelle évaluation).
// L'écriture reste réservée par la base aux formateurs et aux admins.

import { listProfs, listEpcf, upsertEpcf, getEpcfMoyennes } from "../db.js?v=20261003b";
import { el, clear, isoDate, formatDate, displayStagiaire, toast } from "../utils.js?v=20261003b";
import { getProfile } from "../auth-admin.js?v=20261003b";
import { getCurrentWho } from "../identity.js?v=20261003b";
import { EPCF_TRAMES, NOTE_LABELS } from "../epcf-trames.js?v=20261003b";
import { renderEpcfTrameSection, renderEpcfClasse } from "../epcf-restitution.js?v=20261003b";
import { poserGardeSortie, leverGardeSortie } from "../navigation.js?v=20261003b";

const TRAME_KEYS = ["salle", "vehicule"];

// opts.embedded : rendu dans le sous-onglet EPCF de Notes (le parent a son en-tête).
export async function renderEpcf(container, opts = {}) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const [mSalle, mVehicule] = await Promise.all([getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule")]);
  if (opts.isActive && !opts.isActive()) return;
  clear(container);
  if (!opts.embedded) {
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" }, el("h2", {}, "EPCF"))));
  }
  const body = el("div", { class: "epcf-body" });
  container.appendChild(body);
  body.appendChild(el("h3", { class: "epcf-resti-title" }, "Moyennes de la classe"));
  renderEpcfClasse(body, { salle: mSalle, vehicule: mVehicule });
}

// Partie EPCF de la fiche d'une personne. opts.outils : boutons de saisie (formateur).
export function renderEpcfPersonne(container, opts) {
  const etat = { evals: opts.evals || [], moyennes: opts.moyennes };

  function dessiner() {
    clear(container);
    if (opts.outils) {
      const actions = el("div", { class: "epcf-fiche-actions" });
      TRAME_KEYS.forEach((k) => {
        // listEpcf trie par date décroissante : la première est la dernière évaluation.
        const derniere = etat.evals.find((e) => e.trame === k) || null;
        actions.appendChild(el("div", { class: "epcf-fiche-ligne" },
          el("span", { class: "epcf-fiche-epreuve" }, EPCF_TRAMES[k].label),
          el("span", { class: "epcf-statut" + (derniere ? " ok" : " muted") },
            derniere ? "évaluée le " + formatDate(derniere.date_eval) : "à évaluer"),
          derniere ? el("button", { class: "btn small ghost", type: "button",
            onClick: () => ouvrir(k, derniere) }, "Modifier") : null,
          el("button", { class: "btn small primary", type: "button", onClick: () => ouvrir(k, null) },
            derniere ? "Nouvelle évaluation" : "Évaluer"),
        ));
      });
      container.appendChild(actions);
    }
    TRAME_KEYS.forEach((k) => {
      container.appendChild(renderEpcfTrameSection(k, etat.evals.filter((e) => e.trame === k), etat.moyennes[k]));
    });
  }

  async function ouvrir(trameKey, existing) {
    let profs = [];
    try { profs = await listProfs(); } catch (e) { console.error(e); }
    if (opts.isActive && !opts.isActive()) return;
    showForm(container, opts.stagiaire, trameKey, existing, {
      profs,
      retour: dessiner,
      apresEnregistrement: async () => {
        try {
          const [ev, mS, mV] = await Promise.all([
            listEpcf({ stagiaire_id: opts.stagiaire.id }), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule"),
          ]);
          etat.evals = ev;
          etat.moyennes = { salle: mS, vehicule: mV };
        } catch (e) { console.error(e); }   // données peut-être périmées : la prochaine ouverture relira
        if (opts.onEnregistre) opts.onEnregistre(etat.evals);
        if (!opts.isActive || opts.isActive()) dessiner();
      },
    });
  }

  dessiner();
}

// --- Formulaire de saisie d'une grille ---
// Une garde de sortie protège la saisie : quitter avec des changements demande confirmation.
function showForm(body, stagiaire, trameKey, existing, { profs, retour, apresEnregistrement }) {
  clear(body);
  const trame = EPCF_TRAMES[trameKey];
  const scores = { ...(existing?.scores || {}) };
  const compSel = new Set(existing?.competences_acquises || []);
  let dirty = false;
  const garde = { estSale: () => dirty, message: "Abandonner la saisie en cours ?" };
  poserGardeSortie(garde);

  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn small ghost", type: "button", onClick: () => {
      if (dirty && !confirm("Abandonner la saisie en cours ?")) return;
      leverGardeSortie(garde);
      retour();
    } }, "← Retour"),
    el("h3", {}, `${trame.label} : ${displayStagiaire(stagiaire)}`),
  ));

  const dateInput = el("input", { type: "date", value: existing?.date_eval || isoDate(new Date()) });
  const metaInputs = {};
  const metaWrap = el("div", { class: "epcf-form-meta" },
    el("div", { class: "field" }, el("label", {}, "Date"), dateInput));
  trame.metaFields.forEach((f) => {
    const inp = el("input", { type: "text", value: existing?.meta?.[f.key] || "" });
    metaInputs[f.key] = inp;
    metaWrap.appendChild(el("div", { class: "field" }, el("label", {}, f.label), inp));
  });
  // Évaluateur facultatif. En édition, on respecte la valeur stockée (y compris null) ;
  // en création, pré-rempli avec le formateur connecté s'il en est un (le fondateur
  // admin n'a pas de prof_id : option vide, pas d'attribution silencieuse).
  const preset = existing ? existing.evaluateur_prof_id : (getProfile()?.prof_id ?? null);
  const evalSel = el("select");
  const optVide = el("option", { value: "" }, "-");
  if (preset == null) optVide.selected = true;
  evalSel.appendChild(optVide);
  profs.forEach((p) => {
    const o = el("option", { value: String(p.id) }, p.nom);
    if (p.id === preset) o.selected = true;
    evalSel.appendChild(o);
  });
  metaWrap.appendChild(el("div", { class: "field" }, el("label", {}, "Évaluateur"), evalSel));
  body.appendChild(metaWrap);

  // Sections + boutons A/R/NA (re-cliquer la note active la dé-sélectionne)
  trame.sections.forEach((sec) => {
    const box = el("div", { class: "epcf-form-section" },
      el("h4", {}, sec.titre,
        sec.competenceTP ? el("span", { class: "muted epcf-detail-tp" }, " (" + sec.competenceTP + ")") : null));
    sec.criteres.forEach((c) => {
      const seg = el("div", { class: "epcf-seg" });
      const btns = {};
      const sync = () => {
        Object.entries(btns).forEach(([note, b]) => b.classList.toggle("active", scores[c.code] === note));
      };
      ["A", "R", "NA"].forEach((note) => {
        const b = el("button", { type: "button", class: "epcf-seg-btn " + note }, NOTE_LABELS[note]);
        b.addEventListener("click", () => {
          if (scores[c.code] === note) delete scores[c.code];
          else scores[c.code] = note;
          dirty = true;
          sync();
        });
        btns[note] = b;
        seg.appendChild(b);
      });
      sync();
      box.appendChild(el("div", { class: "epcf-form-row" }, el("span", { class: "epcf-form-lib" }, c.libelle), seg));
    });
    body.appendChild(box);
  });

  const compWrap = el("div", { class: "epcf-form-comps" }, el("h4", {}, "Compétences acquises"));
  trame.competences.forEach((code) => {
    const cb = el("input", { type: "checkbox" });
    cb.checked = compSel.has(code);
    cb.addEventListener("change", () => { cb.checked ? compSel.add(code) : compSel.delete(code); dirty = true; });
    compWrap.appendChild(el("label", { class: "epcf-comp-cb" }, cb, " " + code));
  });
  body.appendChild(compWrap);

  const commentTa = el("textarea", { rows: "4", class: "epcf-commentaire-ta", placeholder: "Commentaire global…" });
  commentTa.value = existing?.commentaire || "";
  body.appendChild(el("div", { class: "epcf-form-comment" }, el("h4", {}, "Commentaire global"), commentTa));
  [dateInput, ...Object.values(metaInputs), commentTa].forEach((n) => n.addEventListener("input", () => { dirty = true; }));
  evalSel.addEventListener("change", () => { dirty = true; });

  const saveBtn = el("button", { class: "btn primary", type: "button", onClick: async () => {
    if (Object.keys(scores).length === 0) { toast("Renseigne au moins un critère", "error"); return; }
    if (!dateInput.value) { toast("Renseigne la date", "error"); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = "Enregistrement…";
    try {
      const meta = {};
      trame.metaFields.forEach((f) => { const v = metaInputs[f.key].value.trim(); if (v) meta[f.key] = v; });
      await upsertEpcf({
        id: existing?.id,
        stagiaire_id: stagiaire.id,
        trame: trameKey,
        trame_version: trame.version,
        date_eval: dateInput.value,
        evaluateur_prof_id: Number(evalSel.value) || null,
        meta,
        scores,
        competences_acquises: [...compSel].sort(),
        commentaire: commentTa.value.trim() || null,
        updated_by_who: getCurrentWho(),
      });
    } catch (e) {
      console.error(e);
      toast(e?.message || String(e), "error");
      saveBtn.disabled = false;
      saveBtn.textContent = prev;
      return;
    }
    toast("Évaluation enregistrée", "success", 2000);
    dirty = false;
    leverGardeSortie(garde);
    await apresEnregistrement();
  } }, "Enregistrer l'évaluation");
  body.appendChild(el("div", { class: "epcf-actions" }, saveBtn));
}
```

- [ ] **Step 2: `js/views/mon-suivi.js`, partie EPCF**

Remplacer l'import `import { renderEpcfTrameSection } from "../epcf-restitution.js?v=20261003b";` par `import { renderEpcfPersonne } from "./epcf.js?v=20261003b";` et, dans `rendrePartie`, la branche `epcf` par :

```js
  } else if (partie === "epcf") {
    renderEpcfPersonne(panel, {
      stagiaire: d.stagiaireRow || { id: d.id },
      evals: d.epcfEvals,
      moyennes: { salle: moySalle, vehicule: moyVehicule },
      // Les outils du formateur sur la fiche d'un autre ; jamais sur sa propre fiche.
      outils: !soi && (isAdmin() || isProf()),
      onEnregistre: (evals) => {
        d.epcfEvals = evals;
        if (opts.onEpcfEnregistre) opts.onEpcfEnregistre(evals);
      },
      isActive,
    });
```

- [ ] **Step 3: `js/views/notes.js`, la classe pour tous**

Supprimer les imports de `renderEpcfLivret` et de `renderDp` ; retirer `isProf` de l'import d'`auth-admin.js` s'il n'a plus d'usage (`grep -n isProf js/views/notes.js`). Remplacer le bloc qui va du commentaire `// Notes, c'est la classe (chantier D)` jusqu'à `], { storageKey: "ecsr_notes_subtab" }));` par :

```js
  // Notes, c'est la classe (chantier D) : Matrice et moyennes EPCF, pour tout le
  // monde. Ce qui est propre à une personne (sa saisie EPCF, son livret, son
  // dossier) vit dans sa fiche : Mon espace, ou la page Stagiaires des formateurs.
  // La matrice reste en lecture seule pour les stagiaires. Chaque sous-onglet suit
  // son module (js/modules-data.js) ; la Matrice suit l'onglet lui-même.
  container.appendChild(renderSubTabs([
    { key: "matrice", label: "Matrice", render: buildMatricePanel },
    { key: "epcf", label: "EPCF", module: "epcf", render: (p, ctx) => {
        renderEpcf(p, { embedded: true, isActive: ctx && ctx.isActive })
          .catch((e) => {
            console.error(e);
            if (!ctx || ctx.isActive()) {
              clear(p);
              p.appendChild(el("p", { class: "muted" }, "Erreur de chargement de l'espace EPCF. Reviens sur l'onglet pour réessayer."));
            }
          });
      } },
  ], { storageKey: "ecsr_notes_subtab" }));
```

- [ ] **Step 4: `js/modules-data.js`**

`MODULE_DE_SOUS_ONGLET.notes` devient `{ matrice: "notes", epcf: "epcf" }`.

- [ ] **Step 5: CSS de la partie EPCF**

Ajouter à la fin du bloc du lot 2 :

```css
/* Partie EPCF de la fiche, chez un formateur : une ligne par épreuve. */
.epcf-fiche-actions { display: flex; flex-direction: column; gap: 0.5rem; margin: 0 0 1.25rem; }
.epcf-fiche-ligne {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding: 0.6rem 0.8rem;
  border: 1px solid var(--line); border-radius: 10px; background: var(--bg-elev);
}
.epcf-fiche-epreuve { font-weight: 600; min-width: 5.5rem; }
.epcf-fiche-ligne .epcf-statut { flex: 1; }
```

- [ ] **Step 6: Run all tests**

Run: `for f in tests/*.test.mjs; do node "$f" > /dev/null || echo "ECHEC $f"; done`
Expected: aucune ligne `ECHEC`.

- [ ] **Step 7: Bench check**

`node _harness_build.mjs` ; `role=prof`, fiche d'un stagiaire, partie EPCF :
- ligne par épreuve (« évaluée le … » et Modifier, ou « à évaluer » et Évaluer) puis les résultats ;
- Évaluer, cocher un critère, puis : Retour (question, Annuler garde la saisie), onglet Passages (question), autre nom de la liste (question, l'adresse ne change pas après Annuler), `history.back()` (question, adresse remise), Actualiser (question) ;
- enregistrer : retour à la partie à jour, ligne de la liste à « EPCF 2/2 » sans rechargement ;
- `role=stagiaire` : sa partie EPCF sans boutons ; Notes : Matrice et EPCF (moyennes) pour les deux rôles, plus de Livret EPCF ni de Dossier pro ;
- console sans erreur.

- [ ] **Step 8: Commit**

```bash
git add js/views/epcf.js js/views/mon-suivi.js js/views/notes.js js/modules-data.js css/style.css
git commit -m "Lot 2 : saisie EPCF dans la fiche, Notes vue de la classe pour tous"
```

---

### Task 6: Liens, nouveautés, catalogue, assistant, notes de projet

**Files:**
- Modify: `js/views/nouveautes.js` (`lienOu`), `js/views/ccp2.js` (`lien`), `js/nouveautes-data.js`, `js/modules-data.js` (annonces et explications), `supabase/functions/chatbot/aide.mjs`, `PROJECT_NOTES.md`
- Test: `tests/modules.test.mjs`

**Interfaces:**
- Consumes: `hrefLien`, `PARTIES` (Task 1).

- [ ] **Step 1: Write the failing tests**

Dans `tests/modules.test.mjs`, ajouter l'import `import { hrefLien, PARTIES } from "../js/route-rules.js";` puis, avant la ligne `console.log(...)` finale, une section :

```js
// 11 ter. Lot 2 du chantier D : liens vers les parties de Mon espace, page Stagiaires.
for (const m of MODULES) {
  const ou = m.annonce && m.annonce.ou;
  if (!ou || ou.route !== "mon-suivi" || !ou.sousOnglet) continue;
  ok(PARTIES.includes(ou.sousOnglet), m.cle + " : partie de Mon espace connue");
  eq(hrefLien(ou), "#/mon-suivi/" + ou.sousOnglet, m.cle + " : le lien vise la partie par l'adresse");
}
ok(ROUTES_SOCLE.includes("stagiaires"), "page Stagiaires : route du socle");
eq(Object.keys(MODULE_DE_SOUS_ONGLET.notes).sort(), ["epcf", "matrice"], "Notes : Matrice et EPCF seulement");
ok(!NOUVEAUTES.some((e) => e.id === "2026-10-03-livret-espace-stagiaire"), "entrée caduque du 03/10 retirée");
const libelles = [...NOUVEAUTES.map((e) => e.ou), ...MODULES.map((m) => m.annonce && m.annonce.ou)]
  .filter(Boolean).map((o) => o.label);
ok(!libelles.some((l) => /sous-onglet Livret EPCF/.test(l)), "plus de « sous-onglet Livret EPCF »");
const pageStagiaires = NOUVEAUTES.find((e) => e.id === "2026-10-03-page-stagiaires");
ok(pageStagiaires && pageStagiaires.pour === "formateurs" && pageStagiaires.ou.route === "stagiaires",
   "nouveauté formateurs : la page Stagiaires");
ok(NOUVEAUTES.some((e) => e.id === "2026-10-03-sommaire-iphone" && e.pour === "tous"),
   "nouveauté pour tous : le sommaire sur iPhone");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/modules.test.mjs`
Expected: FAIL (`entrée caduque du 03/10 retirée` ou `plus de « sous-onglet Livret EPCF »`).

- [ ] **Step 3: liens « Où le trouver »**

`js/views/nouveautes.js` : importer `import { hrefLien } from "../route-rules.js?v=20261003b";` et remplacer `lienOu` :

```js
// Lien « Où le trouver ». Une partie de Mon espace se vise par l'adresse
// (#/mon-suivi/dp) ; un sous-onglet de Notes ou de Cours, par la clé que
// renderSubTabs relit à l'ouverture de la vue : sans ça, un lien « Notes,
// sous-onglet EPCF » atterrirait sur la Matrice.
function lienOu(ou) {
  if (!ou) return null;
  const href = hrefLien(ou);
  return el("a", {
    class: "nv-ou",
    href,
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[ou.route];
      if (!cle || !ou.sousOnglet || href !== "#/" + ou.route) return;
      try { localStorage.setItem(cle, ou.sousOnglet); } catch (e) { /* ignore */ }
    },
  }, "Où le trouver : ", el("strong", {}, ou.label));
}
```

`js/views/ccp2.js` : même import ; dans `lien(l)`, remplacer le `return el("a", {…}, l.label);` final par :

```js
  const href = hrefLien(l);
  return el("a", {
    href,
    // Comme les liens « Où le trouver » des nouveautés : une partie de Mon espace
    // par l'adresse, un sous-onglet de Notes ou de Cours par la mémoire de renderSubTabs.
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[l.route];
      if (!cle || !l.sousOnglet || href !== "#/" + l.route) return;
      try { localStorage.setItem(cle, l.sousOnglet); } catch (e) { /* ignore */ }
    },
  }, l.label);
```

- [ ] **Step 4: `js/nouveautes-data.js`**

1. Supprimer l'entrée `id: "2026-10-03-livret-espace-stagiaire"` (objet entier).
2. Dans `2026-10-03-barre-simple`, le troisième pas du guide devient : `"Ton espace personnel (le logo en haut à gauche) : parties Livret et Dossier pro.",`
3. Ajouter en tête du tableau :

```js
  {
    id: "2026-10-03-page-stagiaires",
    date: "2026-10-03",
    pour: "formateurs",
    titre: "Une page Stagiaires : toute la promo, une fiche par personne",
    resume: "La tuile Stagiaires de l'Accueil (ou le bouton de ton compte) ouvre la liste de la "
          + "promo, avec où en est chacun : épreuves EPCF évaluées, livret, dossier pro. La fiche "
          + "d'un stagiaire réunit tes outils : la saisie de l'EPCF, son livret et son dossier. "
          + "Notes garde la vue de la classe.",
    ou: { label: "Accueil, tuile Stagiaires", route: "stagiaires" },
    guide: [
      "Ouvre la tuile Stagiaires de l'Accueil.",
      "Choisis un stagiaire : sa fiche s'ouvre à côté de la liste, ou en plein écran sur téléphone.",
      "Partie EPCF : Évaluer ou Modifier chaque épreuve. Parties Livret et Dossier pro : remplis-les ou relis-les.",
    ],
  },
  {
    id: "2026-10-03-sommaire-iphone",
    date: "2026-10-03",
    pour: "tous",
    titre: "Ton espace personnel sur téléphone : un sommaire",
    resume: "Sur téléphone, ton espace s'ouvre sur un sommaire : Passages, EPCF, Évolution, Livret "
          + "et Dossier pro, chacun avec son état. Touche une ligne pour l'ouvrir ; la flèche en "
          + "haut à gauche, ou le geste retour, te ramène au sommaire. Ta date de naissance se "
          + "règle maintenant dans la partie Livret.",
    ou: { label: "Le logo en haut à gauche", route: "mon-suivi" },
  },
```

4. Libellés : `"Mon espace personnel, sous-onglet Livret EPCF"` devient `"Mon espace personnel, partie Livret"` ; `"Mon espace personnel, sous-onglet Dossier pro"` devient `"Mon espace personnel, partie Dossier pro"` ; les deux `ou: { label: "Mon suivi, Dossier pro", route: "mon-suivi" }` deviennent `ou: { label: "Mon espace personnel, partie Dossier pro", route: "mon-suivi", sousOnglet: "dp" }`.

Si la date de mise en production n'est pas le 03/10, mettre ce jour-là dans les deux nouvelles entrées (`id` et `date`) au moment de la fusion.

- [ ] **Step 5: `js/modules-data.js`, annonces et explications**

- `epcf` : `explication: "Évaluations EPCF : les siennes dans Mon espace, les moyennes de la classe dans Notes, la saisie des formateurs dans la page Stagiaires."` ; `ou: { label: "Mon espace personnel, partie EPCF", route: "mon-suivi", sousOnglet: "epcf" }`.
- `livret` : remplacer le commentaire au-dessus par `// Plus de parent : le livret vit dans la fiche (Mon espace, page Stagiaires).` ; `explication: "Livret officiel EPCF : celui du stagiaire dans Mon espace, la saisie des formateurs dans la page Stagiaires."` ; `ou: { label: "Mon espace personnel, partie Livret", route: "mon-suivi", sousOnglet: "livret" }`.
- `dp` : `explication: "Dossier professionnel : celui du stagiaire dans Mon espace, la relecture des formateurs dans la page Stagiaires."` ; `ou: { label: "Mon espace personnel, partie Dossier pro", route: "mon-suivi", sousOnglet: "dp" }`.

- [ ] **Step 6: guide de l'assistant (`supabase/functions/chatbot/aide.mjs`)**

Remplacer la ligne `- mon-suivi (...)` par :

```
- mon-suivi (Mon espace personnel) : page d'ouverture de l'app, la fiche de la personne connectée. Parties Passages (planning personnel à venir, passages effectués), EPCF, Évolution (graphe des notes), Livret (son livret officiel, en lecture ; la date de naissance s'y règle, reportée sur le livret) et Dossier pro. Sur ordinateur, des onglets ; sur téléphone, un sommaire avec l'état de chaque partie, puis la partie en plein écran (retour en haut à gauche ou geste retour).
```

Ajouter après la ligne `- dashboard (...)` :

```
- stagiaires (page Stagiaires, formateurs et admins) : la liste de la promo avec l'état de chacun (épreuves EPCF évaluées sur 2, livret, dossier pro), et la fiche d'un stagiaire avec les outils du formateur : saisie des grilles EPCF (Évaluer, Modifier, Nouvelle évaluation), livret EPCF en saisie, dossier pro. On l'ouvre par la tuile Stagiaires de l'Accueil ; un formateur sans profil stagiaire y arrive aussi par le bouton de son compte.
```

Remplacer la ligne `- notes : …` par :

```
- notes : la classe, pour tout le monde. Matrice des évaluations sur 20 par thème, moyennes, synthèse, et sous-onglet EPCF (moyennes de la classe). La saisie EPCF, le livret et le dossier de chacun sont dans sa fiche (page Stagiaires pour les formateurs).
```

- [ ] **Step 7: `PROJECT_NOTES.md`**

Dans la liste des pages (section « Pages (8 onglets) »), ajouter une ligne pour `#/stagiaires` (page des formateurs, sans onglet : tuile de l'Accueil et bouton du compte). Ajouter, après la section « Barre simple et onglet CCP2 (chantier D, octobre 2026) », une section :

```markdown
## Page Stagiaires et fiche en sommaire (chantier D, lot 2, octobre 2026)

Spec `docs/superpowers/specs/2026-10-03-espace-stagiaires-design.md`, plan `docs/superpowers/plans/2026-10-03-espace-stagiaires.md`.

- **Adresses à segments** : `#/<route>/<id>/<partie>` (`js/route-rules.js`, pur). Le routeur choisit la page sur le premier segment ; la page lit le reste. Parties d'une fiche : `passages`, `epcf`, `evolution`, `livret`, `dp`.
- **Mise à jour sur place** (`js/navigation.js`) : une page s'inscrit avec `surChangementAdresse(route, fn)` ; quand seule la fin de l'adresse change, `navigate()` l'appelle au lieu de reconstruire la vue. `navigate({ force: true })` (Actualiser, changement de rôle, Réessayer) reconstruit toujours.
- **Garde de saisie** (`js/navigation.js`) : `poserGardeSortie({ estSale, message })` ; `navigate`, Actualiser, Aujourd'hui, les sous-onglets et la fermeture de la page la consultent. La grille EPCF est la seule vue à en poser une (le livret et le dossier s'enregistrent seuls).
- **La fiche** (`renderFiche`, exportée par `js/views/mon-suivi.js`) : onglets sur ordinateur, sommaire puis partie en plein écran sur iPhone (760 px et moins, disposition choisie à l'affichage). États calculés par `js/fiche-rules.js` (pur). Mon espace = sa propre fiche ; la page Stagiaires (`js/views/stagiaires.js`) = liste + fiche d'un stagiaire.
- **États sans relecture** : le livret et le dossier émettent `document-enregistre` après un enregistrement ; une évaluation EPCF enregistrée remonte par `onEpcfEnregistre`.
- **Accès** : `pagePersonnelle()` ; un formateur sans profil stagiaire est conduit de `#/mon-suivi` à `#/stagiaires`, un stagiaire de `#/stagiaires` à `#/mon-suivi`. `monStagiaireId()` traite l'aperçu « Formateur » du fondateur comme un vrai formateur.
- **Notes** : Matrice et moyennes EPCF pour tous ; la saisie EPCF, le livret et le dossier sont dans la fiche.
- **Aucune règle d'accès nouvelle** : vérifié en production le 03/10 (`pg_policies`), les formateurs lisent et écrivent EPCF, livrets et dossiers de leur promo.
```

- [ ] **Step 8: Run all tests**

Run: `for f in tests/*.test.mjs; do node "$f" > /dev/null || echo "ECHEC $f"; done ; node tests/modules.test.mjs`
Expected: aucune ligne `ECHEC` ; `modules : … assertions OK`.

- [ ] **Step 9: Commit**

```bash
git add js/views/nouveautes.js js/views/ccp2.js js/nouveautes-data.js js/modules-data.js supabase/functions/chatbot/aide.mjs PROJECT_NOTES.md tests/modules.test.mjs
git commit -m "Lot 2 : liens vers les parties, nouveautes, guide de l'assistant et notes de projet"
```

---

### Task 7: Vérification complète

**Files:** aucun fichier versionné (sauf correctifs trouvés) ; `_harness_supabase.js` du worktree.

- [ ] **Step 1: tests et typographie**

Run: `for f in tests/*.test.mjs; do node "$f" > /dev/null || echo "ECHEC $f"; done ; git diff main --stat ; git diff main | grep '^+' | grep -c $'\xe2\x80\x94'`
Expected: aucune ligne `ECHEC` ; `0` cadratin ajouté.

- [ ] **Step 2: banc complet**

`node _harness_build.mjs`, `_harness.html?cb=<neuf>`, jeton de l'import map vérifié, puis chaque scénario de la section 8 de la spec, à 1280 px et à 375 px (`resize_window`), en relevant pour chacun ce qu'on voit (`read_page`, `javascript_tool`), la console et l'absence de débordement horizontal :
- formateur (`role=prof`) : tuile et bouton du compte, liste et états, fiche, onglets et adresse, saisie EPCF et garde (Retour, autre onglet, autre fiche, `history.back()`, Actualiser), livret en saisie (l'état de la liste passe à « Livret » après un enregistrement), dossier pro ;
- stagiaire (`role=stagiaire`) : Mon espace ordinateur et iPhone, date de naissance dans Livret, redirection depuis `#/stagiaires`, Notes à deux sous-onglets ;
- admin et stagiaire (sans `role`) : pastille vers son espace, tuile vers la promo ;
- modules fermés (`?modules=depart` avec `role=stagiaire` puis `role=prof`) : parties cachées, puis repérées ;
- réseau lent (`?lenteur=2500&lenteur_tables=epcf_evaluations,epcf_livrets`) : changer vite de fiche n'affiche jamais une fiche à la place d'une autre ;
- liens « Où le trouver » d'une nouveauté vers `#/mon-suivi/dp`.

- [ ] **Step 3: correctifs**

Pour tout écart : corriger, relancer les tests et le scénario, commit `Lot 2 : <correctif>`.

- [ ] **Step 4: rapport**

Restaurer le `.claude/launch.json` du worktree de session, arrêter le banc, puis rendre compte à Timy (ce qui est vérifié, ce qui ne l'est pas, captures iPhone) et attendre son feu vert pour fusionner.
