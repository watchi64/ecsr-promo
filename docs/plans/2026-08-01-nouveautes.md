# Rubrique « Nouveautés » : plan d'implémentation

> **Pour un agent d'exécution** : utiliser `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes sont en
> cases à cocher (`- [ ]`).

**But** : donner à la promo un endroit où retrouver toutes les mises à jour de l'app, avec un
résumé et un guide court par nouveauté, signalé par une pastille sur l'onglet Accueil.

**Architecture** : contenu versionné dans un fichier JavaScript, règles pures dans un module
testable par node, rendu partagé entre une section d'Accueil (3 dernières) et une page
`#/nouveautes` (toutes). Le non-lu vit dans `localStorage`. Aucune base de données.

**Pile** : JavaScript vanilla en modules ES, aucune dépendance, tests `node:assert/strict`.

**Spec** : `docs/specs/2026-08-01-nouveautes-design.md`.

## Contraintes globales

Elles s'appliquent à **toutes** les tâches.

- **Worktree** : `C:\Users\watch\Dev\ECSR\TP_ECSR_App-wt-nouveautes`, branche `nouveautes`.
  Ne jamais travailler dans `TP_ECSR_App`, figé sur `main` en lecture seule.
- **Token de cache-bust** : `?v=20260731r` sur **tous** les imports relatifs des nouveaux
  fichiers. C'est le token courant de la branche, écrit à la main.
- **Ne jamais lancer `node scripts/cache-bust.js`** sur cette branche. Le re-versionnage ne se
  fait que sur `main`, sinon les merges partent en conflit. Le hook `pre-commit` ne bouge pas non
  plus tant qu'on n'est pas sur `main`.
- **Français partout.** Noms de fonctions, commentaires, libellés.
- **Aucun em-dash (`—`)** dans les libellés d'interface. Régression connue à éviter.
- **« Formateur »**, jamais « Prof », dans tout texte visible.
- **Pas de framework**, pas de dépendance nouvelle, modules ES uniquement.
- **Palette mint existante** : utiliser les variables `var(--bg-elev)`, `var(--line)`,
  `var(--accent)`, `var(--accent-soft)`, `var(--text)`, `var(--text-muted)`, `var(--r)`.
  Ne pas introduire de couleur en dur.
- **Pas de gamification** : la puce « Nouveau » signale, elle ne récompense pas. Ni série, ni
  compteur de lecture, ni badge de progression.
- **Commits en français**, terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Ne pas pousser** sans accord explicite de l'utilisateur.

---

### Tâche 1 : Règles pures et leur test

Le module de règles ne connaît ni le DOM, ni le contenu réel. Il reçoit ses entrées en argument,
donc le test ne casse pas quand on ajoutera une nouveauté au fichier de contenu.

**Fichiers**
- Créer : `js/nouveautes.js`
- Test : `tests/nouveautes.test.mjs`

**Interfaces**
- Consomme : rien.
- Produit :
  - `CLE_VUES: string`
  - `STORAGE_SOUS_ONGLET: Record<string, string>`
  - `triees(entrees: Entree[]) => Entree[]`
  - `visibles(entrees: Entree[], formateur: boolean) => Entree[]`
  - `nonLues(entrees: Entree[], vues: string[] | null) => Entree[]`
  - `libellePastille(n: number) => string`
  - `purger(vues: string[] | null, entrees: Entree[]) => string[]`
  - `ajouterVues(vues: string[] | null, ids: string[], entrees: Entree[]) => string[]`
  - `lireVues() => string[]`
  - `marquerVues(ids: string[], entrees: Entree[]) => void`
- Type `Entree` (défini par le contenu en tâche 2) :
  `{ id: string, date: string, pour: "tous"|"formateurs", titre: string, resume: string,
     ou?: { label: string, route: string, sousOnglet?: string }, guide?: string[] }`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/nouveautes.test.mjs` :

```js
import assert from "node:assert/strict";
import {
  triees, visibles, nonLues, libellePastille, purger, ajouterVues,
} from "../js/nouveautes.js";

const E = [
  { id: "a", date: "2026-07-02", pour: "formateurs" },
  { id: "b", date: "2026-07-31", pour: "tous" },
  { id: "c", date: "2026-07-31", pour: "tous" },
  { id: "d", date: "2026-07-19", pour: "tous" },
];

// Tri antéchronologique. À date égale (b et c), l'ordre du fichier de contenu
// est conservé : Array.prototype.sort est stable depuis ES2019.
assert.deepEqual(triees(E).map((e) => e.id), ["b", "c", "d", "a"]);
// Le tri ne modifie pas le tableau reçu.
assert.deepEqual(E.map((e) => e.id), ["a", "b", "c", "d"]);

// Audience : une entrée « formateurs » disparaît pour un stagiaire.
assert.deepEqual(visibles(E, true).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(visibles(E, false).map((e) => e.id), ["b", "c", "d"]);

// Non-lu : une entrée est neuve tant que son id n'a pas été vu.
assert.deepEqual(nonLues(E, ["b", "d"]).map((e) => e.id), ["a", "c"]);
assert.deepEqual(nonLues(E, []).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(nonLues(E, null).map((e) => e.id), ["a", "b", "c", "d"]);

// Pastille : rien à zéro, le compte jusqu'à 9, « 9+ » au-delà.
assert.equal(libellePastille(0), "");
assert.equal(libellePastille(3), "3");
assert.equal(libellePastille(9), "9");
assert.equal(libellePastille(10), "9+");

// Purge : un id mémorisé qui ne correspond plus à aucune entrée disparaît.
assert.deepEqual(purger(["a", "obsolete"], E), ["a"]);
// Ajout sans doublon, purgé au passage.
assert.deepEqual(ajouterVues(["a"], ["a", "b", "obsolete"], E), ["a", "b"]);

console.log("nouveautes : 13 assertions OK");
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

```bash
node tests/nouveautes.test.mjs
```

Attendu : `ERR_MODULE_NOT_FOUND` sur `../js/nouveautes.js`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `js/nouveautes.js` :

```js
// Règles de la rubrique Nouveautés : tri, audience, non-lu.
//
// Aucune dépendance, aucun accès au DOM. Les fonctions de décision reçoivent
// leurs entrées en argument : elles sont donc testables par node, et le test
// ne dépend pas du contenu réel (qui bouge à chaque nouveauté).
//
// Seules les deux dernières fonctions touchent localStorage. Elles sont
// enveloppées dans des try/catch (navigation privée, quota) sur le modèle de
// subtabs.js : en cas d'échec tout paraît neuf à chaque visite, ce qui est une
// dégradation acceptable, mais rien n'explose.

export const CLE_VUES = "ecsr_nouveautes_vues";

// Correspondance route -> clé localStorage du sous-onglet, telle que
// renderSubTabs la mémorise. Permet à un lien « Où le trouver » d'ouvrir la vue
// directement sur le bon sous-onglet. Une route absente d'ici ignore simplement
// le champ sousOnglet : le lien navigue, sans atterrissage précis.
export const STORAGE_SOUS_ONGLET = {
  "mon-suivi": "ecsr_monsuivi_subtab",
  notes: "ecsr_notes_subtab",
};

// Antéchronologique, de la plus récente à la plus ancienne.
export function triees(entrees) {
  return [...entrees].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// Une entrée « formateurs » n'est visible que d'un formateur ou d'un admin.
export function visibles(entrees, formateur) {
  return entrees.filter((e) => e.pour !== "formateurs" || !!formateur);
}

// Entrées dont l'id n'a pas encore été vu.
export function nonLues(entrees, vues) {
  const dejaVues = new Set(vues || []);
  return entrees.filter((e) => !dejaVues.has(e.id));
}

// Texte de la pastille. Vide à zéro : l'appelant retire alors l'élément.
export function libellePastille(n) {
  if (!n || n <= 0) return "";
  return n > 9 ? "9+" : String(n);
}

// Retire les ids qui ne correspondent plus à aucune entrée, pour que la liste
// mémorisée ne gonfle pas indéfiniment.
export function purger(vues, entrees) {
  const connus = new Set(entrees.map((e) => e.id));
  return (vues || []).filter((id) => connus.has(id));
}

// Fusionne des ids dans la liste des vues, purgée. Renvoie la nouvelle liste.
export function ajouterVues(vues, ids, entrees) {
  return purger([...new Set([...(vues || []), ...ids])], entrees);
}

// === localStorage ===

export function lireVues() {
  try {
    const brut = localStorage.getItem(CLE_VUES);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) {
    return [];
  }
}

export function marquerVues(ids, entrees) {
  try {
    localStorage.setItem(CLE_VUES, JSON.stringify(ajouterVues(lireVues(), ids, entrees)));
  } catch (e) {
    /* ignore : tout paraîtra neuf à la prochaine visite */
  }
}
```

- [ ] **Étape 4 : lancer le test pour vérifier qu'il passe**

```bash
node tests/nouveautes.test.mjs
```

Attendu : `nouveautes : 13 assertions OK`

- [ ] **Étape 5 : commiter**

```bash
git add js/nouveautes.js tests/nouveautes.test.mjs
git commit -m "Nouveautes : regles de tri, d'audience et de non-lu"
```

---

### Tâche 2 : Contenu, les 9 entrées de reprise

Dates réelles de mise en production. Ton : deuxième personne, comme le reste de l'app. Aucun
détail technique, aucun nom de fichier ni de table.

**Fichiers**
- Créer : `js/nouveautes-data.js`

**Interfaces**
- Consomme : rien.
- Produit : `NOUVEAUTES: Entree[]` (type décrit en tâche 1).

- [ ] **Étape 1 : créer le fichier de contenu**

Créer `js/nouveautes-data.js` :

```js
// Contenu de la rubrique Nouveautés, et rien d'autre.
//
// Écrire une nouveauté = ajouter un objet ici, dans le même commit que le code
// qu'elle annonce. L'ordre du tableau n'a pas d'importance : le tri se fait sur
// le champ `date` (cf. js/nouveautes.js).
//
// Champs : id (unique, date en préfixe), date (AAAA-MM-JJ), pour
// ("tous" | "formateurs"), titre, resume. Facultatifs : ou (le chemin dans
// l'app, rendu cliquable) et guide (étapes numérotées).
//
// Public : la promo, des adultes en reconversion. Pas de vocabulaire technique,
// pas de numéro de version, pas de nom de fichier.

export const NOUVEAUTES = [
  {
    id: "2026-07-31-qcm-entrainement",
    date: "2026-07-31",
    pour: "tous",
    titre: "Les QCM d'entraînement sont ouverts à toute la promo",
    resume: "Les 57 thèmes ont désormais leur QCM. Tu t'entraînes autant de fois que tu veux, "
          + "ça ne compte jamais dans tes notes. Tes anciennes erreurs repassent en premier, "
          + "pour que tu travailles ce qui te manque plutôt que ce que tu sais déjà.",
    ou: { label: "Thèmes, colonne QCM", route: "themes" },
    guide: [
      "Ouvre l'onglet Thèmes.",
      "Clique sur le bouton QCM à droite du thème qui t'intéresse.",
      "Choisis « S'entraîner », ou « Revoir mes erreurs » pour ne rejouer que les questions ratées.",
    ],
  },
  {
    id: "2026-07-31-qcm-signalement",
    date: "2026-07-31",
    pour: "tous",
    titre: "Signale une erreur dans un QCM en un clic",
    resume: "Si une question te paraît fausse, ambiguë ou mal formulée, tu peux le signaler "
          + "depuis la question elle-même. Le signalement arrive aux formateurs, qui corrigent "
          + "pour toute la promo.",
    ou: { label: "Thèmes, colonne QCM", route: "themes" },
    guide: [
      "Pendant un entraînement, ouvre la question qui te pose problème.",
      "Utilise le lien de signalement sous la question et explique en une phrase ce qui cloche.",
    ],
  },
  {
    id: "2026-07-31-dossier-professionnel",
    date: "2026-07-31",
    pour: "tous",
    titre: "Ton Dossier Professionnel se remplit dans l'app",
    resume: "Le dossier que tu présentes au jury se saisit directement ici et s'imprime au "
          + "format officiel. Tes réponses sont enregistrées au fur et à mesure, tu peux y "
          + "revenir autant de fois que tu veux.",
    ou: { label: "Mon espace personnel, sous-onglet Dossier pro",
          route: "mon-suivi", sousOnglet: "dp" },
    guide: [
      "Ouvre ton espace personnel avec le logo en haut à gauche.",
      "Va sur le sous-onglet « Dossier pro ».",
      "Remplis tes exemples, puis imprime ou enregistre en PDF quand tu es prêt.",
    ],
  },
  {
    id: "2026-07-23-espace-personnel",
    date: "2026-07-23",
    pour: "tous",
    titre: "L'app s'ouvre sur ton espace personnel",
    resume: "En arrivant, tu vois d'abord ce qui te concerne : tes prochains créneaux, tes "
          + "passages déjà effectués et tes résultats. L'ancien tableau de bord s'appelle "
          + "maintenant « Priorités » et sert à voir qui doit passer dans la promo.",
    ou: { label: "Le logo en haut à gauche", route: "mon-suivi" },
    guide: [
      "Clique sur le logo en haut à gauche pour revenir à ton espace à tout moment.",
      "Le sous-onglet « Passages » compte ce que tu as déjà fait, en salle et en voiture.",
      "Le bouton « Aujourd'hui au planning » t'emmène directement à la journée en cours.",
    ],
  },
  {
    id: "2026-07-21-planning-verrou",
    date: "2026-07-21",
    pour: "formateurs",
    titre: "Verrou de semaine et mode Modifier sur le planning",
    resume: "Le planning s'ouvre en lecture seule : il faut passer en mode Modifier pour changer "
          + "quoi que ce soit, ce qui évite les modifications involontaires. Une fois la semaine "
          + "validée, elle se verrouille et s'affiche en vue compacte, plus lisible.",
    ou: { label: "Planning", route: "planning" },
    guide: [
      "Ouvre le planning, il est en lecture seule par défaut.",
      "Clique sur « Modifier » pour éditer, « Terminer » pour en sortir.",
      "Coche le verrou dans « Valider la semaine » quand la semaine est figée. Ctrl + Z la déverrouille.",
    ],
  },
  {
    id: "2026-07-20-absences-comptage",
    date: "2026-07-20",
    pour: "tous",
    titre: "Comment une absence compte dans ton tour de passage",
    resume: "Une absence consomme ton tour : la place t'était réservée, elle n'a pas servi. "
          + "Un passage bonus, lui, ne consomme rien. Les priorités en tiennent compte, pour que "
          + "les tours restent équitables entre tout le monde.",
    ou: { label: "Priorités", route: "dashboard" },
  },
  {
    id: "2026-07-19-livret-epcf",
    date: "2026-07-19",
    pour: "tous",
    titre: "Ton livret officiel TP-01303 se remplit dans l'app",
    resume: "Le livret que tu présentes au jury se saisit ici et s'imprime au format officiel. "
          + "Ta date de naissance est reprise automatiquement depuis ton profil, tu n'as pas à "
          + "la ressaisir.",
    ou: { label: "Notes, sous-onglet Livret EPCF", route: "notes", sousOnglet: "livret" },
    guide: [
      "Renseigne ta date de naissance dans ton espace personnel si ce n'est pas déjà fait.",
      "Ouvre l'onglet Notes, sous-onglet « Livret EPCF ».",
      "Remplis le livret, puis imprime ou enregistre en PDF.",
    ],
  },
  {
    id: "2026-07-05-auto-ecoles",
    date: "2026-07-05",
    pour: "formateurs",
    titre: "Auto-écoles partenaires et suivi des venues",
    resume: "Les élèves bénévoles peuvent être rattachés à une auto-école partenaire. Chaque "
          + "fiche récapitule ses bénévoles, et le suivi compte les venues déduites du planning "
          + "avec un commentaire par venue.",
    ou: { label: "Planning, bouton Bénévoles", route: "planning" },
    guide: [
      "Ouvre le planning et clique sur « Bénévoles » dans la barre de semaine.",
      "Bascule sur l'onglet « Auto-écoles » du panneau.",
      "Ouvre une fiche pour voir ses bénévoles, en affilier d'autres ou en créer un directement rattaché.",
    ],
  },
  {
    id: "2026-07-02-benevoles",
    date: "2026-07-02",
    pour: "formateurs",
    titre: "Banque d'élèves bénévoles avec leurs disponibilités",
    resume: "Les élèves bénévoles pour la conduite sont regroupés dans une banque, avec leurs "
          + "disponibilités par demi-journée. Sur une carte Voiture, ceux qui sont disponibles ce "
          + "jour-là remontent en tête de liste.",
    ou: { label: "Planning, bouton Bénévoles", route: "planning" },
    guide: [
      "Ouvre le planning et clique sur « Bénévoles » dans la barre de semaine.",
      "Ajoute une fiche : seul le prénom est obligatoire, le reste se complète plus tard.",
      "Renseigne la grille de disponibilités pour que le filtre « qui est dispo jeudi matin » fonctionne.",
    ],
  },
];
```

- [ ] **Étape 2 : vérifier que le fichier se charge et que les identifiants sont uniques**

```bash
node -e "import('./js/nouveautes-data.js').then(({NOUVEAUTES:N})=>{const ids=N.map(e=>e.id);console.log('entrees',N.length,'| ids uniques',new Set(ids).size,'| formateurs',N.filter(e=>e.pour==='formateurs').length);})"
```

Attendu : `entrees 9 | ids uniques 9 | formateurs 3`

- [ ] **Étape 3 : commiter**

```bash
git add js/nouveautes-data.js
git commit -m "Nouveautes : les neuf entrees de reprise de juillet"
```

---

### Tâche 3 : Carte, page `#/nouveautes` et banc d'essai

La carte est écrite une seule fois et sert aux deux affichages. La page complète est livrée
avant la section d'Accueil pour qu'elle soit vérifiable seule, au banc.

**Fichiers**
- Créer : `js/views/nouveautes.js`
- Créer : `_preview_nouveautes.html`
- Modifier : `css/style.css` (bloc ajouté **en fin de fichier**)

**Interfaces**
- Consomme : tout ce que produisent les tâches 1 et 2.
- Produit :
  - `carteNouveaute(entree: Entree, opts?: { neuve?: boolean, guideDeplie?: boolean }) => HTMLElement`
  - `renderNouveautes(container: HTMLElement) => Promise<void>` (signature des vues du routeur)

- [ ] **Étape 1 : créer la vue**

Créer `js/views/nouveautes.js` :

```js
// Rubrique Nouveautés : la carte (partagée avec la section d'Accueil) et la
// page complète #/nouveautes.
//
// La page n'est PAS dans la barre d'onglets : on y arrive par le lien
// « Tout voir » d'Accueil, comme #/mon-suivi n'a pas d'onglet non plus.

import { el, clear, formatDate } from "../utils.js?v=20260731r";
import { isAdmin, isProf } from "../auth-admin.js?v=20260731r";
import { NOUVEAUTES } from "../nouveautes-data.js?v=20260731r";
import {
  triees, visibles, nonLues, lireVues, marquerVues, STORAGE_SOUS_ONGLET,
} from "../nouveautes.js?v=20260731r";

// Lien « Où le trouver ». Si l'entrée vise un sous-onglet, on écrit la clé que
// renderSubTabs relit à l'ouverture de la vue : sans ça, un lien « Notes,
// sous-onglet Livret EPCF » atterrirait sur la Matrice, et le lecteur devrait
// chercher lui-même ce qu'on venait de lui indiquer.
function lienOu(ou) {
  if (!ou) return null;
  return el("a", {
    class: "nv-ou",
    href: "#/" + ou.route,
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[ou.route];
      if (!cle || !ou.sousOnglet) return;
      try { localStorage.setItem(cle, ou.sousOnglet); } catch (e) { /* ignore */ }
    },
  }, "Où le trouver : ", el("strong", {}, ou.label));
}

// Guide facultatif, replié par défaut dans Accueil et déplié sur la page.
// <details> natif : pas de JavaScript d'ouverture, et le clavier fonctionne.
function blocGuide(guide, deplie) {
  if (!Array.isArray(guide) || guide.length === 0) return null;
  return el("details", { class: "nv-guide", open: deplie ? "" : null },
    el("summary", {}, "Comment faire"),
    el("ol", {}, ...guide.map((etape) => el("li", {}, etape))),
  );
}

export function carteNouveaute(entree, opts = {}) {
  const { neuve = false, guideDeplie = false } = opts;
  return el("article", { class: "nv-carte" },
    el("div", { class: "nv-head" },
      el("span", { class: "nv-date" }, formatDate(entree.date)),
      neuve ? el("span", { class: "nv-puce-neuf" }, "Nouveau") : null,
      entree.pour === "formateurs" ? el("span", { class: "nv-puce-role" }, "Formateurs") : null,
    ),
    el("h3", { class: "nv-titre" }, entree.titre),
    el("p", { class: "nv-resume" }, entree.resume),
    lienOu(entree.ou),
    blocGuide(entree.guide, guideDeplie),
  );
}

export async function renderNouveautes(container) {
  clear(container);

  const formateur = isAdmin() || isProf();
  const mesEntrees = triees(visibles(NOUVEAUTES, formateur));
  const neuves = new Set(nonLues(mesEntrees, lireVues()).map((e) => e.id));

  container.appendChild(el("div", { class: "view-header" },
    el("h1", {}, "Nouveautés"),
    el("p", { class: "muted" },
      "Toutes les mises à jour de l'app, de la plus récente à la plus ancienne."),
  ));

  if (mesEntrees.length === 0) {
    container.appendChild(el("p", { class: "muted" }, "Aucune nouveauté pour le moment."));
    return;
  }

  container.appendChild(el("div", { class: "nv-liste" },
    ...mesEntrees.map((e) => carteNouveaute(e, {
      neuve: neuves.has(e.id), guideDeplie: true,
    })),
  ));

  // La page complète marque TOUT comme lu, la section d'Accueil ne marque que
  // les entrées qu'elle affiche. La pastille se met à jour par l'événement, ce
  // qui évite un import circulaire avec main.js.
  marquerVues(mesEntrees.map((e) => e.id), NOUVEAUTES);
  window.dispatchEvent(new CustomEvent("nouveautes-vues"));
}
```

- [ ] **Étape 2 : ajouter le bloc CSS en fin de `css/style.css`**

Coller **à la toute fin** du fichier (l'ordre garantit que la règle mobile de la pastille passe
après le `@media` existant qui masque les libellés d'onglets) :

```css
/* ============================================================
   Nouveautés : cartes, puces, pastille d'onglet
   ============================================================ */

.nv-liste { display: flex; flex-direction: column; gap: 0.6rem; }

.nv-carte {
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 0.85rem 1rem;
}

.nv-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.3rem;
}

.nv-date { color: var(--text-muted); font-size: 0.78rem; }

.nv-puce-neuf,
.nv-puce-role {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  line-height: 1.5;
}

.nv-puce-neuf { background: var(--accent); color: #FFF; }
.nv-puce-role { background: var(--accent-soft); color: var(--accent-strong); }

.nv-titre { margin: 0 0 0.25rem; font-size: 1rem; }
.nv-resume { margin: 0; color: var(--text-soft); font-size: 0.9rem; line-height: 1.5; }

.nv-ou {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.84rem;
  color: var(--accent-strong);
  text-decoration: none;
}
.nv-ou:hover { text-decoration: underline; }

.nv-guide { margin-top: 0.5rem; }
.nv-guide summary {
  cursor: pointer;
  font-size: 0.84rem;
  color: var(--text-muted);
}
.nv-guide ol {
  margin: 0.45rem 0 0;
  padding-left: 1.2rem;
  font-size: 0.86rem;
  color: var(--text-soft);
  line-height: 1.55;
}
.nv-guide li { margin-bottom: 0.25rem; }

/* Pastille sur l'onglet Accueil.
   ATTENTION : le @media mobile plus haut dans ce fichier pose
   « .tab span { display: none } » (specificite 0,0,1,1). Le selecteur
   ci-dessous est en 0,0,2,0, donc il gagne, quel que soit l'ordre. Sans ca la
   pastille serait invisible sur telephone, la ou elle sert le plus. */
.tab .tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 0.15rem;
  border-radius: 999px;
  background: var(--accent);
  color: #FFF;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
}

@media (max-width: 760px) {
  /* Les onglets sont en icone seule : un chiffre serait illisible, on garde un
     simple point. */
  .tab .tab-badge {
    width: 8px;
    min-width: 8px;
    height: 8px;
    padding: 0;
    margin-left: -4px;
    align-self: flex-start;
    font-size: 0;
  }
}
```

- [ ] **Étape 3 : créer le banc d'essai**

Créer `_preview_nouveautes.html`. Le stub d'auth existant (`_preview_stubs/auth-admin.js`) sert
déjà le levier `?role=`, on le réutilise tel quel.

```html
<!DOCTYPE html>
<!-- Banc d'essai de la rubrique Nouveautés (non déployé, jamais lié depuis l'app).
     Fait tourner le vrai js/views/nouveautes.js dans les deux rôles, sans
     authentification et sans toucher la base : l'import map substitue le stub
     d'auth. La vue ne fait aucune requête réseau, db.js n'a pas besoin d'être
     remplacé.

     Rôles : ?role=stagiaire (défaut) ou ?role=formateur -->
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Banc d'essai · Nouveautés</title>
  <!-- Feuilles injectées avec un cache-buster : sur une branche de feature les
       tokens ?v= ne bougent pas et le navigateur resservirait un style périmé. -->
  <script>
    ["css/fonts.css", "css/style.css"].forEach((f) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = `${f}?cb=${Date.now()}`;
      document.head.appendChild(l);
    });
  </script>
  <!-- Les clés sont les URL RÉSOLUES des imports de views/nouveautes.js. -->
  <script type="importmap">
  {
    "imports": {
      "/js/auth-admin.js?v=20260731r": "/_preview_stubs/auth-admin.js"
    }
  }
  </script>
  <style>
    body { margin: 20px; background: var(--bg, #F1F4F0); }
    .bench-bar { margin-bottom: 14px; display: flex; gap: 10px; align-items: center;
                 flex-wrap: wrap; font-family: sans-serif; font-size: 14px; }
    #view { max-width: 720px; }
  </style>
</head>
<body>
  <div class="bench-bar">
    <strong>Banc Nouveautés</strong>
    <a href="?role=stagiaire">rôle stagiaire</a>
    <a href="?role=formateur">rôle formateur</a>
    <button id="oublier" type="button">Oublier ce qui est lu</button>
    <span id="compte"></span>
  </div>
  <main id="view"></main>
  <script type="module">
    import { renderNouveautes } from "./js/views/nouveautes.js?cb=1";
    import { NOUVEAUTES } from "./js/nouveautes-data.js?v=20260731r";
    import { visibles, nonLues, lireVues, CLE_VUES } from "./js/nouveautes.js?v=20260731r";
    import { isAdmin, isProf } from "./_preview_stubs/auth-admin.js";

    const vue = document.getElementById("view");
    const compte = document.getElementById("compte");

    function majCompte() {
      const n = nonLues(visibles(NOUVEAUTES, isAdmin() || isProf()), lireVues()).length;
      compte.textContent = `non lues : ${n}`;
    }

    document.getElementById("oublier").addEventListener("click", () => {
      localStorage.removeItem(CLE_VUES);
      location.reload();
    });

    // Le compte est lu AVANT le rendu, qui marque tout comme lu.
    majCompte();
    await renderNouveautes(vue);
    window.addEventListener("nouveautes-vues", majCompte);
  </script>
</body>
</html>
```

- [ ] **Étape 4 : vérifier au banc**

Lancer un serveur statique à la racine du worktree, puis ouvrir
`http://localhost:8000/_preview_nouveautes.html`.

Vérifier, dans l'ordre :

1. `?role=formateur` : **9 cartes**, dont **trois** portant la puce « Formateurs » (verrou du
   planning, auto-écoles, bénévoles).
2. `?role=stagiaire` : **6 cartes**, aucune puce « Formateurs ».
3. Au premier chargement après « Oublier ce qui est lu », toutes les cartes portent « Nouveau »,
   et l'indicateur du banc affiche le compte avant rendu (9 ou 6).
4. Après rechargement, plus aucune puce « Nouveau » et l'indicateur affiche `non lues : 0`.
5. L'entrée « Comment une absence compte » n'a **pas** de bloc « Comment faire » (guide absent),
   les huit autres en ont un, déplié sur cette page.
6. Cliquer sur « Où le trouver » de l'entrée du livret EPCF, puis vérifier en console
   `localStorage.getItem("ecsr_notes_subtab")` : doit valoir `"livret"`.

- [ ] **Étape 5 : commiter**

```bash
git add js/views/nouveautes.js _preview_nouveautes.html css/style.css
git commit -m "Nouveautes : carte, page dediee et banc d'essai"
```

---

### Tâche 4 : Route et pastille sur l'onglet Accueil

**Fichiers**
- Modifier : `js/main.js`

**Interfaces**
- Consomme : `renderNouveautes` (tâche 3), `NOUVEAUTES` (tâche 2), `visibles` / `nonLues` /
  `lireVues` / `libellePastille` (tâche 1).
- Produit : la route `#/nouveautes`, et un écouteur de l'événement `nouveautes-vues`.

- [ ] **Étape 1 : ajouter les imports**

Dans `js/main.js`, à la suite des imports de vues existants :

```js
import { renderNouveautes } from "./views/nouveautes.js?v=20260731r";
import { NOUVEAUTES } from "./nouveautes-data.js?v=20260731r";
import { visibles, nonLues, lireVues, libellePastille } from "./nouveautes.js?v=20260731r";
```

Et compléter l'import d'auth existant, qui devient :

```js
import { initAuth, onAdminChange, isAuth, isAdmin, isProf } from "./auth-admin.js?v=20260731r";
```

- [ ] **Étape 2 : déclarer la route**

Dans l'objet `routes`, ajouter la ligne (la vue n'entre **pas** dans `TABS`, comme `mon-suivi`) :

```js
  nouveautes: renderNouveautes,
```

- [ ] **Étape 3 : garder l'onglet Accueil allumé sur `#/nouveautes`**

Juste au-dessus de `let lastRoute = null;`, ajouter :

```js
// Routes sans onglet propre qui doivent quand même allumer un onglet. On arrive
// sur #/nouveautes depuis Accueil : laisser la barre sans onglet actif
// donnerait l'impression d'être sorti de l'app.
const ONGLET_POUR_ROUTE = { nouveautes: "home" };
```

Puis, dans `navigate()`, remplacer la boucle d'activation :

```js
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.route === route;
```

par :

```js
  const ongletActif = ONGLET_POUR_ROUTE[route] || route;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.route === ongletActif;
```

- [ ] **Étape 4 : écrire la mise à jour de la pastille**

Juste après la fonction `renderTabs()`, ajouter :

```js
// Pastille de nouveautés sur l'onglet Accueil. Modifie l'élément SUR PLACE :
// surtout pas de renderTabs() complet, qui reconstruirait la barre et perdrait
// la classe « active » posée par navigate().
function majBadgeNouveautes() {
  const tab = document.querySelector('.tab[data-route="home"]');
  if (!tab) return;
  const mesEntrees = visibles(NOUVEAUTES, isAdmin() || isProf());
  const texte = libellePastille(nonLues(mesEntrees, lireVues()).length);
  let badge = tab.querySelector(".tab-badge");
  if (!texte) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "tab-badge";
    badge.setAttribute("aria-label", "nouveautés non lues");
    tab.appendChild(badge);
  }
  badge.textContent = texte;
}
```

- [ ] **Étape 5 : câbler**

Dans `bootApp()`, remplacer :

```js
  renderTabs();
  setupRefreshBtn();
  setupTodayBtn();
  onAdminChange(() => { renderTabs(); navigate(); });
```

par :

```js
  renderTabs();
  majBadgeNouveautes();
  setupRefreshBtn();
  setupTodayBtn();
  // Le changement de rôle change l'audience, donc le compte.
  onAdminChange(() => { renderTabs(); majBadgeNouveautes(); navigate(); });
  // Émis par la page et par la section d'Accueil après marquage.
  window.addEventListener("nouveautes-vues", majBadgeNouveautes);
```

- [ ] **Étape 6 : vérifier dans l'app**

```bash
node --check js/main.js
```

Attendu : aucune sortie.

Puis, **en navigation privée** (sur une branche de feature le token `?v=` n'est pas re-versionné,
le navigateur resert l'ancien JS et l'ancien CSS), ouvrir l'app et vérifier :

1. Une pastille apparaît sur l'onglet Accueil : **9** avec un compte formateur, **6** avec un
   compte stagiaire.
2. Aller sur `#/nouveautes` à la main dans la barre d'adresse : la page s'affiche et **l'onglet
   Accueil reste allumé**.
3. Après cette visite, la pastille disparaît.
4. Réduire la fenêtre sous 760 px : les libellés d'onglets disparaissent, **la pastille reste
   visible** sous forme de point sur l'icône Accueil.

- [ ] **Étape 7 : commiter**

```bash
git add js/main.js
git commit -m "Nouveautes : route dediee et pastille sur l'onglet Accueil"
```

---

### Tâche 5 : Section dans Accueil

**Fichiers**
- Modifier : `js/views/home.js`

**Interfaces**
- Consomme : `carteNouveaute` (tâche 3), `NOUVEAUTES` (tâche 2), les règles (tâche 1).
- Produit : la section `.home-nouveautes`, qui sert aussi d'ancre au compteur J−N.

- [ ] **Étape 1 : ajouter les imports**

Dans `js/views/home.js`, compléter l'import d'auth existant :

```js
import { isAdmin, isProf, getProfile, getProfileWho } from "../auth-admin.js?v=20260731r";
```

et ajouter :

```js
import { NOUVEAUTES } from "../nouveautes-data.js?v=20260731r";
import { triees, visibles, nonLues, lireVues, marquerVues } from "../nouveautes.js?v=20260731r";
import { carteNouveaute } from "./nouveautes.js?v=20260731r";
```

- [ ] **Étape 2 : écrire la section**

Au-dessus de `export async function renderHome(container)`, ajouter :

```js
// Nombre de nouveautés montrées dans Accueil. Au-delà, « Tout voir » renvoie
// vers #/nouveautes : sans ce plafond, la page finirait par pousser les
// raccourcis sous la ligne de flottaison.
const ACCUEIL_MAX = 3;

function sectionNouveautes() {
  const mesEntrees = triees(visibles(NOUVEAUTES, isAdmin() || isProf()));
  if (mesEntrees.length === 0) return null;

  // Le calcul du neuf se fait AVANT le marquage, sinon plus rien n'aurait sa puce.
  const neuves = new Set(nonLues(mesEntrees, lireVues()).map((e) => e.id));
  const affichees = mesEntrees.slice(0, ACCUEIL_MAX);

  const section = el("section", { class: "home-nouveautes" },
    el("div", { class: "home-section-head" },
      el("h2", {}, "✨ Nouveautés"),
      el("a", { class: "home-link", href: "#/nouveautes" }, "Tout voir →"),
    ),
    el("div", { class: "nv-liste" },
      ...affichees.map((e) => carteNouveaute(e, { neuve: neuves.has(e.id) })),
    ),
  );

  // Accueil ne marque que ce qu'il montre. La pastille tombe donc de 3, ce qui
  // invite à ouvrir la liste complète quand il reste des entrées plus anciennes.
  marquerVues(affichees.map((e) => e.id), NOUVEAUTES);
  window.dispatchEvent(new CustomEvent("nouveautes-vues"));
  return section;
}
```

- [ ] **Étape 3 : insérer la section entre le hero et les tuiles**

Dans `renderHome`, juste après `container.appendChild(el("section", { class: "home-hero-v2" }, ...))`
et **avant** le commentaire `// === Raccourcis principaux (tuiles) ===`, ajouter :

```js
  // Placée avant les tuiles : quelqu'un qui arrive en cliquant sur la pastille
  // doit tomber dessus sans défiler.
  const nouveautes = sectionNouveautes();
  if (nouveautes) container.appendChild(nouveautes);
```

- [ ] **Étape 4 : corriger l'ancre du compteur J−N**

Sans cette correction, le compteur s'insérerait **sous** la section Nouveautés, puisqu'il vise
`.home-tiles` qui est désormais plus bas. Dans le bloc `if (nextMajor) { ... }`, remplacer :

```js
      // Insère le compteur juste avant les tuiles
      const tiles = container.querySelector(".home-tiles");
      if (tiles) container.insertBefore(countdownEl, tiles);
```

par :

```js
      // Insère le compteur au-dessus des Nouveautés si elles sont là, sinon
      // juste avant les tuiles. L'ordre voulu est : hero, compteur, nouveautés,
      // raccourcis.
      const ancre = container.querySelector(".home-nouveautes")
                 || container.querySelector(".home-tiles");
      if (ancre) container.insertBefore(countdownEl, ancre);
```

- [ ] **Étape 5 : vérifier dans l'app**

```bash
node --check js/views/home.js
```

Attendu : aucune sortie.

Puis **en navigation privée**, ouvrir l'app et vérifier :

1. Ordre vertical de la page Accueil : salutation, compteur J−N, **Nouveautés**, tuiles de
   raccourcis, prochains événements, À retenir.
2. Trois cartes, les plus récentes, toutes avec la puce « Nouveau » au premier passage.
3. Le guide est **replié** dans Accueil (contrairement à la page complète).
4. La pastille de l'onglet Accueil tombe de 3 (9 → 6 pour un formateur, 6 → 3 pour un stagiaire)
   **sans rechargement**.
5. Cliquer « Tout voir → » : la page complète s'ouvre, la pastille tombe à 0.
6. Compte stagiaire : aucune des trois cartes ne porte la puce « Formateurs ».

- [ ] **Étape 6 : commiter**

```bash
git add js/views/home.js
git commit -m "Nouveautes : section dans Accueil et ancre du compteur"
```

---

### Tâche 6 : Notes de projet et vérification d'ensemble

**Fichiers**
- Modifier : `PROJECT_NOTES.md`

- [ ] **Étape 1 : relancer toute la suite de tests**

```bash
node tests/nouveautes.test.mjs && node tests/passage-rules.test.mjs && node tests/passages-stats.test.mjs && node tests/dp-rules.test.mjs && node tests/creneaux-rules.test.mjs
```

Attendu : cinq lignes `... assertions OK`, aucune erreur.

- [ ] **Étape 2 : documenter dans `PROJECT_NOTES.md`**

Ajouter une section avant `## Décisions UX importantes (à respecter)` :

```markdown
## Rubrique Nouveautés (01/08/2026, branche `nouveautes`)

Spec : `docs/specs/2026-08-01-nouveautes-design.md` · plan : `docs/plans/2026-08-01-nouveautes.md`

Où la promo retrouve les mises à jour de l'app, en complément du message WhatsApp qui reste le
canal de notification.

- **Contenu versionné**, pas de table Supabase : `js/nouveautes-data.js`. Écrire une nouveauté
  = ajouter un objet dans ce fichier, **dans le même commit que le code qu'elle annonce**.
- **Règles pures** dans `js/nouveautes.js` (`node tests/nouveautes.test.mjs`). Le test n'importe
  PAS le contenu réel : ajouter une entrée ne doit jamais casser une assertion.
- **Deux affichages, une seule carte** : 3 dernières dans Accueil (guide replié), toutes sur
  `#/nouveautes` (guide déplié). `carteNouveaute()` est exportée par `js/views/nouveautes.js`.
- **Route sans onglet**, comme `mon-suivi`. `ONGLET_POUR_ROUTE` dans `main.js` garde l'onglet
  Accueil allumé sur `#/nouveautes`.
- **Audience** : champ `pour` (`tous` ou `formateurs`), filtré à l'affichage ET dans le compte
  de la pastille.
- **Non-lu** : `localStorage["ecsr_nouveautes_vues"]`, liste d'ids. Accueil ne marque que les
  entrées qu'il affiche, la page complète marque tout. La pastille se rafraîchit par l'événement
  `nouveautes-vues` (window), ce qui évite un import circulaire home.js ↔ main.js.
- **⚠️ Piège CSS** : le `@media (max-width: 760px)` masque les libellés d'onglets par
  `.tab span { display: none }`. La pastille doit être ciblée en `.tab .tab-badge` (spécificité
  supérieure), sinon elle est invisible sur téléphone, là où elle sert le plus.
- **⚠️ Ordre dans Accueil** : le compteur J−N vise `.home-nouveautes` en priorité, sinon il
  s'insérerait sous les nouveautés.
- **Banc d'essai** : `_preview_nouveautes.html` (`?role=stagiaire|formateur`), réutilise le stub
  `_preview_stubs/auth-admin.js` du Dossier Professionnel.
```

- [ ] **Étape 3 : contrôle des conventions**

```bash
grep -n "—" js/nouveautes-data.js js/nouveautes.js js/views/nouveautes.js; echo "exit=$? (1 = aucun em-dash)"
grep -rn "Prof\b" js/nouveautes-data.js; echo "exit=$? (1 = aucun « Prof »)"
```

Attendu : `exit=1` sur les deux.

- [ ] **Étape 4 : commiter**

```bash
git add PROJECT_NOTES.md
git commit -m "Nouveautes : notes de projet et pieges identifies"
```

---

## Reste à décider avec l'utilisateur

Deux points laissés ouverts par la spec, sans effet bloquant sur l'implémentation :

1. **Les 9 entrées de reprise porteront toutes la puce « Nouveau »** au premier affichage, y
   compris celles que la promo connaît déjà. L'alternative serait de pré-remplir
   `ecsr_nouveautes_vues` avec les entrées antérieures à la mise en ligne, ce qui se fait en une
   ligne au premier chargement si l'utilisateur le préfère.
2. **La formulation de l'entrée « Comment une absence compte »** touche à une règle d'équité qui a
   des conséquences directes pour les stagiaires. À relire avant publication.
