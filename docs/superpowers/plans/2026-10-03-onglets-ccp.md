# Onglets CCP1 et CCP2 : plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé)
> ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases (`- [ ]`).

**But :** remplacer les onglets Thèmes et Notes par un onglet CCP1 à sous-onglets (Thèmes, Notes,
EPCF, Livret EPCF, Dossier pro) et ajouter un onglet CCP2 qui guide la promo en 8 étapes.

**Architecture :** deux vues nouvelles (`js/views/ccp1.js`, `js/views/ccp2.js`) branchées dans le
routeur de `js/main.js`. CCP1 rend les vues existantes « embarquées » dans `renderSubTabs` ; CCP2
lit son texte dans `js/ccp2-parcours-data.js` et ses dates dans le Calendrier. Les modules de B
gouvernent l'affichage : CCP1 est un onglet regroupé (visible si une de ses parties l'est), CCP2 un
module. Aucune table, aucune migration.

**Pile :** HTML, CSS et JavaScript sans framework (modules ES), tests `node` sans dépendance,
banc d'essai `_harness.html` (client Supabase factice par import map).

**Spec :** `docs/superpowers/specs/2026-10-03-onglets-ccp-design.md`.

## Contraintes globales

- Aucun tiret cadratin (U+2014) nulle part : code, commentaires, libellés, docs, commits. Contrôle :
  `grep -rn $'\xe2\x80\x94' <fichiers>` (la locale de Git Bash ne comprend pas `\u2014`).
- « Formateur », jamais « Prof », dans tout texte affiché.
- Textes destinés aux stagiaires : tutoiement, phrases courtes, sans jargon ni nom de fichier.
- Jeton de cache : sur la branche, tout import relatif garde `?v=20261002b` (le hook ne
  re-versionne que `main`) ; un module importé sous deux jetons serait chargé deux fois.
- Tout nouveau bloc CSS va **en fin** de `css/style.css`.
- Aucun nouveau contrôle d'édition (le parcours est en lecture seule) ; les vues embarquées
  gardent leurs gardes `isAdmin()`.
- Pas de `git checkout` dans `C:/Users/watch/Dev/ECSR/TP_ECSR_App` ; tout se fait dans le
  worktree `C:/Users/watch/Dev/ecsr-promo-onglets-ccp` (branche `onglets-ccp`).
- Pas de fusion dans `main` ni de push dans ce plan : la livraison attend la relecture de Timy.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `js/modules-data.js` | catalogue : module `ccp2`, groupes, `SOUS_ONGLETS_CCP1`, `ONGLETS_REGROUPES`, `NOTES_DE_GROUPE`, textes repointés vers CCP1 |
| `js/modules.js` | règles pures `modulesDeRoute`, `routeOuverte` |
| `js/modules-etat.js` | `routeVisible`, `routeMasquee` passent par `routeOuverte` |
| `js/nouveautes.js` | `STORAGE_SOUS_ONGLET.ccp1` remplace `notes` |
| `js/nouveautes-data.js` | liens « Où le trouver » repointés ; deux entrées nouvelles (tâche 5) |
| `js/views/modules-reglage.js` | phrase sous l'intitulé d'un groupe |
| `js/ccp-rules.js` (nouveau) | règles pures : anciennes adresses, dates CCP2 |
| `js/ccp2-parcours-data.js` (nouveau) | texte du parcours |
| `js/views/themes.js`, `js/views/notes.js` | rendu embarqué |
| `js/views/ccp1.js`, `js/views/ccp2.js` (nouveaux) | les deux onglets |
| `js/main.js`, `js/views/home.js`, `js/icons.js`, `css/style.css` | barre, routes, tuiles, icônes, styles |
| `supabase/functions/chatbot/aide.mjs`, `PROJECT_NOTES.md` | documentation |
| `tests/modules.test.mjs`, `tests/ccp-rules.test.mjs` (nouveau) | tests node |

---

### Tâche 1 : catalogue et règles des modules

**Fichiers :**
- Modifier : `js/modules-data.js` (fichier entier)
- Modifier : `js/modules.js` (ajout après `estOuvert`)
- Modifier : `js/modules-etat.js` (imports, `REF`, `routeVisible`, `routeMasquee`)
- Modifier : `js/nouveautes.js` (`STORAGE_SOUS_ONGLET`)
- Modifier : `js/nouveautes-data.js` (9 liens `ou`)
- Modifier : `js/views/modules-reglage.js` (phrase sous le groupe)
- Modifier : `docs/superpowers/specs/2026-10-03-onglets-ccp-design.md` (section 5.1, parent du livret)
- Test : `tests/modules.test.mjs`

**Interfaces :**
- Produit : `modulesDeRoute(route, ref) -> string[]`, `routeOuverte(route, etat, ref) -> boolean`
  (`js/modules.js`) ; `SOUS_ONGLETS_CCP1: {key, label, module}[]`,
  `ONGLETS_REGROUPES: { ccp1: string[] }`, `NOTES_DE_GROUPE: { [groupe]: string }`
  (`js/modules-data.js`) ; `STORAGE_SOUS_ONGLET.ccp1 === "ecsr_ccp1_subtab"` (`js/nouveautes.js`).
- `ref` accepte désormais un champ facultatif `ongletsRegroupes`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Dans `tests/modules.test.mjs`, compléter les imports :

```js
import {
  VERSION, PREFIXE_ANNONCE, ETAT_LIBRE, lireEtat, ecrireEtat, estReglee, estOuvert,
  ensembleDeDepart, basculer, jourParis, annonces, avecAnnonces, moduleDeNouveaute,
  nouveautesPour, accorder, modulesDeRoute, routeOuverte,
} from "../js/modules.js";
import { purger, STORAGE_SOUS_ONGLET } from "../js/nouveautes.js";
import {
  MODULES, GROUPES, ROUTES_SOCLE, MODULE_DE_ROUTE, MODULE_DE_SOUS_ONGLET,
  REGLAGE_OUVERT_AUX_FORMATEURS, SOUS_ONGLETS_CCP1, ONGLETS_REGROUPES, NOTES_DE_GROUPE,
} from "../js/modules-data.js";
```

Juste avant le commentaire `// 11. Catalogue réel`, insérer :

```js
// 10 bis. Onglets regroupés (CCP1) : visibles dès qu'une de leurs parties l'est.
const REF_R = { ...REF, ongletsRegroupes: { ccp1: ["themes", "notes"] } };
eq(modulesDeRoute("ccp1", REF_R), ["themes", "notes"], "onglet regroupé : ses modules");
eq(modulesDeRoute("planning", REF_R), ["planning"], "onglet simple : son module");
eq(modulesDeRoute("home", REF_R), [], "socle : aucun module");
eq(modulesDeRoute("planning", REF), ["planning"], "référentiel sans onglet regroupé");
eq(modulesDeRoute("constructor", REF_R), [], "propriété héritée ignorée");
ok(routeOuverte("home", regle({}), REF_R), "socle toujours ouvert");
ok(routeOuverte("ccp1", ETAT_LIBRE, REF_R), "promo libre : onglet regroupé ouvert");
ok(!routeOuverte("ccp1", regle({ planning: T0 }), REF_R), "aucune partie ouverte : onglet fermé");
ok(routeOuverte("ccp1", regle({ notes: T1 }), REF_R), "une partie ouverte suffit");
ok(routeOuverte("planning", regle({ planning: T0 }), REF_R), "onglet simple ouvert");
ok(!routeOuverte("planning", regle({ notes: T1 }), REF_R), "onglet simple fermé");
const REF_P = { ...REF, ongletsRegroupes: { ccp1: ["qcm"] } };
ok(!routeOuverte("ccp1", regle({ qcm: T1 }), REF_P), "partie cochée sous un parent fermé : onglet fermé");
```

Dans la section 11, remplacer la ligne du lien d'annonce :

```js
    ok(r in MODULE_DE_ROUTE || ROUTES_SOCLE.includes(r), m.cle + " : lien vers une route connue");
```

par :

```js
    ok(r in MODULE_DE_ROUTE || r in ONGLETS_REGROUPES || ROUTES_SOCLE.includes(r),
       m.cle + " : lien vers une route connue");
```

Puis, juste avant le commentaire `// 12. Nouveautés déjà écrites`, insérer :

```js
// 11 bis. Onglets CCP1 et CCP2 (chantier D)
for (const [route, parties] of Object.entries(ONGLETS_REGROUPES)) {
  ok(!(route in MODULE_DE_ROUTE), route + " : onglet regroupé hors MODULE_DE_ROUTE");
  ok(!ROUTES_SOCLE.includes(route), route + " : onglet regroupé hors socle");
  for (const p of parties) ok(cles.includes(p), route + " : partie connue " + p);
}
eq(ONGLETS_REGROUPES.ccp1, SOUS_ONGLETS_CCP1.map((s) => s.module), "CCP1 : ses parties = ses sous-onglets");
eq(Object.keys(MODULE_DE_SOUS_ONGLET.ccp1), SOUS_ONGLETS_CCP1.map((s) => s.key), "CCP1 : chaque sous-onglet joignable");
eq(STORAGE_SOUS_ONGLET.ccp1, "ecsr_ccp1_subtab", "CCP1 : mémoire du sous-onglet");
ok(!("notes" in MODULE_DE_SOUS_ONGLET), "Notes n'a plus de sous-onglets");
eq(MODULE_DE_ROUTE.ccp2, "ccp2", "CCP2 : route gouvernée par son module");
eq(MODULES.find((m) => m.cle === "livret").parent, undefined, "livret : plus rangé dans Notes");
for (const s of SOUS_ONGLETS_CCP1) {
  ok(typeof s.label === "string" && s.label.length > 0 && !s.label.includes(CADRATIN), s.key + " : libellé");
}
for (const [g, note] of Object.entries(NOTES_DE_GROUPE)) {
  ok(GROUPES.includes(g), g + " : note sur un groupe connu");
  ok(!note.includes(CADRATIN), g + " : note sans tiret cadratin");
}
```

- [ ] **Étape 2 : lancer les tests, constater l'échec**

Commande : `node tests/modules.test.mjs`
Attendu : échec à l'import (`modulesDeRoute` n'est pas exporté par `js/modules.js`).

- [ ] **Étape 3 : règles pures dans `js/modules.js`**

Juste après la fonction `estOuvert` (avant `ensembleDeDepart`), insérer :

```js
// Modules qui gouvernent une route. Un onglet regroupé (CCP1) en a plusieurs,
// un onglet simple un seul, une route du socle aucun.
export function modulesDeRoute(route, ref) {
  const regroupes = ref.ongletsRegroupes || {};
  if (contient(regroupes, route)) return regroupes[route];
  const cle = contient(ref.moduleDeRoute, route) ? ref.moduleDeRoute[route] : null;
  return cle ? [cle] : [];
}

// Une route du socle est toujours ouverte. Un onglet regroupé l'est dès qu'une de
// ses parties l'est : il n'a pas de module propre, donc pas de case à cocher.
export function routeOuverte(route, etat, ref) {
  const cles = modulesDeRoute(route, ref);
  return cles.length === 0 || cles.some((cle) => estOuvert(cle, etat, ref.modules));
}
```

- [ ] **Étape 4 : catalogue `js/modules-data.js`**

Remplacer le fichier entier par :

```js
// Catalogue des modules (chantier B) : les parties de l'app qu'un formateur
// ouvre ou ferme pour une promo. Contenu seulement : les règles vivent dans
// js/modules.js, la lecture et l'écriture de l'état dans js/modules-etat.js.
//
// Ajouter un module = ajouter une entrée ici, dans l'ordre de la progression
// (c'est l'ordre de la section de réglage), puis déclarer `module: "<clé>"` sur
// le sous-onglet qu'il gouverne, ou sa route dans MODULE_DE_ROUTE.
//
// Champs : cle (stable, jamais renommée : elle est stockée en base), nom,
// accord du participe (ms, fs, mp, fp : « Notes ouvertes »), groupe (un des
// GROUPES), parent (facultatif : module dans lequel celui-ci est rangé ; un
// seul niveau), depart (ouvert dans l'ensemble de départ), explication (ligne du
// réglage, lue par les formateurs), annonce { titre, resume, ou } (nouveauté
// générée à l'ouverture, lue par les stagiaires : tutoiement, sans jargon).
// Aucun import : le fichier est lu tel quel par les tests node.

export const GROUPES = ["Démarrage", "Suivi de la formation", "CCP1", "CCP2", "Outils"];

// Phrase affichée sous l'intitulé d'un groupe, dans la section de réglage.
export const NOTES_DE_GROUPE = {
  CCP1: "L'onglet CCP1 apparaît aux stagiaires dès qu'une de ces parties est ouverte.",
};

// Routes jamais fermées. Elles n'ont pas de module.
export const ROUTES_SOCLE = ["home", "mon-suivi", "config", "nouveautes"];

// Route d'un onglet vers le module qui la gouverne. `themes` et `notes` ne sont
// plus des onglets (ce sont des sous-onglets de CCP1) mais restent des adresses :
// js/main.js les mène à CCP1 après la garde de leur module.
export const MODULE_DE_ROUTE = {
  planning: "planning",
  calendrier: "calendrier",
  ressources: "ressources",
  dashboard: "priorites",
  notes: "notes",
  themes: "themes",
  ccp2: "ccp2",
};

// Sous-onglets de l'onglet CCP1, dans l'ordre d'affichage (js/views/ccp1.js les
// rend). L'onglet regroupé et les liens « Où le trouver » s'en déduisent.
export const SOUS_ONGLETS_CCP1 = [
  { key: "themes", label: "Thèmes", module: "themes" },
  { key: "notes", label: "Notes", module: "notes" },
  { key: "epcf", label: "EPCF", module: "epcf" },
  { key: "livret", label: "Livret EPCF", module: "livret" },
  { key: "dp", label: "Dossier pro", module: "dp" },
];

// Onglets qui regroupent plusieurs modules : visibles dès qu'un de leurs modules
// l'est (routeOuverte, js/modules.js). Ils n'ont pas de module propre.
export const ONGLETS_REGROUPES = {
  ccp1: SOUS_ONGLETS_CCP1.map((s) => s.module),
};

// Sous-onglets rattachés à un module, par route. Sert aux liens « Où le
// trouver » des nouveautés ; les vues, elles, déclarent `module` sur leurs
// sous-onglets (js/views/ccp1.js le tire de SOUS_ONGLETS_CCP1,
// js/views/mon-suivi.js l'écrit). Garder Mon espace d'accord avec sa vue.
export const MODULE_DE_SOUS_ONGLET = {
  ccp1: Object.fromEntries(SOUS_ONGLETS_CCP1.map((s) => [s.key, s.module])),
  "mon-suivi": { evolution: "notes", epcf: "epcf", dp: "dp" },
};

// Tant que le multi-promo (chantier A) n'est pas en ligne, il n'existe qu'une
// promo : un formateur qui croirait préparer la nouvelle fermerait des modules
// à la promo actuelle. Le réglage reste alors réservé au fondateur. Passer à
// true quand l'app multi-promo est en ligne (étape 3 de A).
export const REGLAGE_OUVERT_AUX_FORMATEURS = false;

export const MODULES = [
  {
    cle: "planning", nom: "Planning", accord: "ms", groupe: "Démarrage", depart: true,
    explication: "Planning de la semaine et bouton « Aujourd'hui ».",
    annonce: {
      titre: "Le planning est ouvert",
      resume: "Retrouve chaque semaine qui passe au tableau et en voiture, et avec quel "
            + "formateur. Le bouton en haut de l'écran t'amène directement à la journée du jour.",
      ou: { label: "Planning", route: "planning" },
    },
  },
  {
    cle: "calendrier", nom: "Calendrier", accord: "ms", groupe: "Démarrage", depart: true,
    explication: "Dates clés : périodes en centre, stages, examens.",
    annonce: {
      titre: "Le calendrier est ouvert",
      resume: "Les grandes dates de ta formation : périodes en centre, stages, examens. "
            + "L'Accueil affiche aussi le compte à rebours jusqu'au prochain rendez-vous important.",
      ou: { label: "Calendrier", route: "calendrier" },
    },
  },
  {
    cle: "ressources", nom: "Ressources", accord: "fp", groupe: "Démarrage", depart: true,
    explication: "Contacts du centre et liens utiles.",
    annonce: {
      titre: "Les ressources sont ouvertes",
      resume: "Les contacts utiles du centre et une sélection de liens et de documents pour réviser.",
      ou: { label: "Ressources", route: "ressources" },
    },
  },
  {
    cle: "priorites", nom: "Priorités", accord: "fp", groupe: "Suivi de la formation",
    explication: "Qui doit passer en priorité, en salle et en voiture.",
    annonce: {
      titre: "L'onglet Priorités est ouvert",
      resume: "Il montre qui doit passer en priorité, au tableau comme en voiture, pour que "
            + "chacun ait autant de passages que les autres.",
      ou: { label: "Priorités", route: "dashboard" },
    },
  },
  {
    cle: "themes", nom: "Thèmes", accord: "mp", groupe: "CCP1",
    explication: "Liste des thèmes et progression de la classe, dans CCP1.",
    annonce: {
      titre: "Les thèmes sont ouverts",
      resume: "La liste des thèmes de la formation, avec ceux déjà traités en classe et leur "
            + "date. Tu la trouves dans l'onglet CCP1.",
      ou: { label: "CCP1, sous-onglet Thèmes", route: "ccp1", sousOnglet: "themes" },
    },
  },
  {
    cle: "cours", nom: "Cours", accord: "mp", groupe: "CCP1", parent: "themes",
    explication: "Lecture du cours de chaque thème.",
    annonce: {
      titre: "Les cours sont ouverts",
      resume: "Chaque thème a son cours à lire : l'essentiel en quelques lignes, les règles, "
            + "les sanctions et les chiffres clés. Dans l'onglet CCP1, clique sur le titre d'un "
            + "thème ou sur son bouton Cours.",
      ou: { label: "CCP1, Thèmes, bouton Cours", route: "ccp1", sousOnglet: "themes" },
    },
  },
  {
    cle: "qcm", nom: "QCM", accord: "mp", groupe: "CCP1", parent: "themes",
    explication: "QCM d'entraînement et d'examen.",
    annonce: {
      titre: "Les QCM sont ouverts",
      resume: "Entraîne-toi sur chaque thème avec un QCM : les questions ratées reviennent en "
            + "premier jusqu'à ce que tu les maîtrises.",
      ou: { label: "CCP1, Thèmes, colonne QCM", route: "ccp1", sousOnglet: "themes" },
    },
  },
  {
    cle: "notes", nom: "Notes", accord: "fp", groupe: "CCP1",
    explication: "Matrice des notes dans CCP1, Évolution dans Mon espace, anonymat.",
    annonce: {
      titre: "Les notes sont ouvertes",
      resume: "Tes notes de thèmes s'affichent dans l'onglet CCP1, sous-onglet Notes, avec la "
            + "synthèse de la classe. Dans ton espace personnel, l'onglet Évolution trace ta "
            + "progression. Si tu préfères, tu peux masquer ton prénom et tes notes aux autres "
            + "dans Paramètres.",
      ou: { label: "CCP1, sous-onglet Notes", route: "ccp1", sousOnglet: "notes" },
    },
  },
  {
    cle: "epcf", nom: "EPCF", accord: "ms", groupe: "CCP1",
    explication: "Évaluations EPCF, dans CCP1 et Mon espace.",
    annonce: {
      titre: "L'EPCF est ouvert",
      resume: "Tes évaluations EPCF du CCP1, en salle et en véhicule, s'affichent dans ton "
            + "espace personnel. La vue de la classe est dans l'onglet CCP1.",
      ou: { label: "Mon espace personnel, sous-onglet EPCF", route: "mon-suivi", sousOnglet: "epcf" },
    },
  },
  {
    cle: "livret", nom: "Livret EPCF", accord: "ms", groupe: "CCP1",
    explication: "Livret officiel EPCF, dans CCP1.",
    annonce: {
      titre: "Le livret EPCF est ouvert",
      resume: "Ton livret d'évaluation officiel du CCP1 se consulte dans l'onglet CCP1. Pense à "
            + "indiquer ta date de naissance dans ton espace personnel : elle y est reportée "
            + "automatiquement.",
      ou: { label: "CCP1, sous-onglet Livret EPCF", route: "ccp1", sousOnglet: "livret" },
    },
  },
  {
    cle: "dp", nom: "Dossier pro", accord: "ms", groupe: "CCP1",
    explication: "Dossier professionnel, dans CCP1 et Mon espace.",
    annonce: {
      titre: "Le dossier professionnel est ouvert",
      resume: "Remplis ton dossier professionnel directement dans l'app, puis imprime-le ou "
            + "enregistre-le en PDF au format officiel. Tes formateurs peuvent le relire et "
            + "t'aider.",
      ou: { label: "Mon espace personnel, sous-onglet Dossier pro", route: "mon-suivi", sousOnglet: "dp" },
    },
  },
  {
    cle: "ccp2", nom: "CCP2", accord: "ms", groupe: "CCP2",
    explication: "Parcours guidé en 8 étapes, du commanditaire à l'épreuve.",
    annonce: {
      titre: "L'onglet CCP2 est ouvert",
      resume: "Ton parcours CCP2 en 8 étapes, du choix du commanditaire au jour de l'épreuve : "
            + "pour chacune, ce que le jury regarde, comment t'y prendre et les documents utiles.",
      ou: { label: "CCP2", route: "ccp2" },
    },
  },
  {
    cle: "assistant", nom: "Assistant", accord: "ms", groupe: "Outils",
    explication: "Bulle d'aide sur les cours et le Code de la route.",
    annonce: {
      titre: "L'assistant est ouvert",
      resume: "Une bulle en bas de l'écran répond à tes questions sur les cours et le Code de "
            + "la route. C'est une version d'essai : vérifie les points importants dans les cours.",
    },
  },
];
```

- [ ] **Étape 5 : `js/modules-etat.js`**

Remplacer l'import du catalogue et des règles :

```js
import {
  MODULES, MODULE_DE_ROUTE, MODULE_DE_SOUS_ONGLET, ONGLETS_REGROUPES, REGLAGE_OUVERT_AUX_FORMATEURS,
} from "./modules-data.js?v=20261002b";
import {
  ETAT_LIBRE, lireEtat, ecrireEtat, estReglee, estOuvert, basculer, ensembleDeDepart,
  avecAnnonces, nouveautesPour, routeOuverte,
} from "./modules.js?v=20261002b";
```

Remplacer la constante `REF` :

```js
const REF = {
  modules: MODULES, moduleDeRoute: MODULE_DE_ROUTE, moduleDeSousOnglet: MODULE_DE_SOUS_ONGLET,
  ongletsRegroupes: ONGLETS_REGROUPES,
};
```

Remplacer les deux fonctions de route :

```js
// Une route est-elle à montrer à la personne connectée ? Toujours pour un
// formateur ; un onglet regroupé (CCP1) l'est dès qu'une de ses parties l'est.
export function routeVisible(route) { return formateurConnecte() || routeOuverte(route, etat, REF); }
// Route fermée pour la promo : repère chez un formateur.
export function routeMasquee(route) { return !routeOuverte(route, etat, REF); }
```

- [ ] **Étape 6 : `js/nouveautes.js`**

Remplacer :

```js
export const STORAGE_SOUS_ONGLET = {
  "mon-suivi": "ecsr_monsuivi_subtab",
  notes: "ecsr_notes_subtab",
};
```

par :

```js
export const STORAGE_SOUS_ONGLET = {
  "mon-suivi": "ecsr_monsuivi_subtab",
  ccp1: "ecsr_ccp1_subtab",
};
```

- [ ] **Étape 7 : liens « Où le trouver » de `js/nouveautes-data.js`**

Neuf remplacements, un par entrée (les textes `resume` historiques ne changent pas) :

| Entrée | Ancien `ou` | Nouveau `ou` |
|---|---|---|
| `2026-08-26-cours-pour-tous` | `{ label: "Thèmes", route: "themes" }` | `{ label: "CCP1, sous-onglet Thèmes", route: "ccp1", sousOnglet: "themes" }` |
| `2026-08-19-themes-mobile` | `{ label: "Thèmes", route: "themes" }` | `{ label: "CCP1, sous-onglet Thèmes", route: "ccp1", sousOnglet: "themes" }` |
| `2026-08-10-barre-entrainement` | `{ label: "Thèmes, colonne QCM", route: "themes" }` | `{ label: "CCP1, Thèmes, colonne QCM", route: "ccp1", sousOnglet: "themes" }` |
| `2026-08-09-cours-en-relecture` | `{ label: "Thèmes, badge Cours", route: "themes" }` | `{ label: "CCP1, Thèmes, badge Cours", route: "ccp1", sousOnglet: "themes" }` |
| `2026-08-08-signalement-reponse-visee` | `{ label: "Thèmes, colonne QCM", route: "themes" }` | `{ label: "CCP1, Thèmes, colonne QCM", route: "ccp1", sousOnglet: "themes" }` |
| `2026-08-08-console-signalements` | `{ label: "Thèmes, sous-onglet Signalements", route: "themes" }` | `{ label: "CCP1, Thèmes, sous-onglet Signalements", route: "ccp1", sousOnglet: "themes" }` |
| `2026-07-31-qcm-entrainement` | `{ label: "Thèmes, colonne QCM", route: "themes" }` | `{ label: "CCP1, Thèmes, colonne QCM", route: "ccp1", sousOnglet: "themes" }` |
| `2026-07-31-qcm-signalement` | `{ label: "Thèmes, colonne QCM", route: "themes" }` | `{ label: "CCP1, Thèmes, colonne QCM", route: "ccp1", sousOnglet: "themes" }` |
| `2026-07-19-livret-epcf` | `{ label: "Notes, sous-onglet Livret EPCF", route: "notes", sousOnglet: "livret" }` | `{ label: "CCP1, sous-onglet Livret EPCF", route: "ccp1", sousOnglet: "livret" }` |

Contrôle : `grep -n 'route: "themes"\|route: "notes"' js/nouveautes-data.js` ne renvoie plus rien.

- [ ] **Étape 8 : phrase sous le groupe, `js/views/modules-reglage.js`**

Import :

```js
import { MODULES, GROUPES, NOTES_DE_GROUPE } from "../modules-data.js?v=20261002b";
```

Dans la boucle des groupes, remplacer :

```js
    section.appendChild(el("div", { class: "param-block modules-groupe" },
      el("h4", {}, groupe),
      ...membres.map((m) => ligneModule(m, etat)),
    ));
```

par :

```js
    section.appendChild(el("div", { class: "param-block modules-groupe" },
      el("h4", {}, groupe),
      NOTES_DE_GROUPE[groupe]
        ? el("p", { class: "modules-groupe-note muted" }, NOTES_DE_GROUPE[groupe]) : null,
      ...membres.map((m) => ligneModule(m, etat)),
    ));
```

Et en fin de `css/style.css` :

```css
/* ===== Onglets CCP1 et CCP2 (chantier D) ===== */
.modules-groupe-note { margin: -0.2rem 0 0.4rem; font-size: 0.82rem; }
```

- [ ] **Étape 9 : spec, parent du livret**

Dans la section 5.1 de la spec, à la suite de la puce « Ordre », ajouter la puce :

```markdown
- **Livret EPCF** perd son parent `notes` : il n'est plus rangé dans Notes mais à côté, dans CCP1.
  Un formateur peut donc l'ouvrir sans ouvrir la matrice des notes.
```

- [ ] **Étape 10 : lancer les tests**

Commandes : `node tests/modules.test.mjs` puis `node tests/nouveautes.test.mjs`
Attendu : `modules : N assertions OK` (N supérieur au compte d'avant) et le test des nouveautés vert.

- [ ] **Étape 11 : commit**

```bash
git add js/modules-data.js js/modules.js js/modules-etat.js js/nouveautes.js js/nouveautes-data.js js/views/modules-reglage.js css/style.css tests/modules.test.mjs docs/superpowers/specs/2026-10-03-onglets-ccp-design.md
git commit -m "Modules : onglet regroupe CCP1, module CCP2, liens repointes vers CCP1"
```

---

### Tâche 2 : règles CCP et texte du parcours

**Fichiers :**
- Créer : `js/ccp-rules.js`
- Créer : `js/ccp2-parcours-data.js`
- Test : `tests/ccp-rules.test.mjs`

**Interfaces :**
- Consomme : `MODULES`, `MODULE_DE_ROUTE`, `ONGLETS_REGROUPES`, `ROUTES_SOCLE`,
  `MODULE_DE_SOUS_ONGLET` (tâche 1), `STORAGE_SOUS_ONGLET` (tâche 1).
- Produit : `ANCIENNES_ROUTES`, `ancienneRoute(route) -> {route, sousOnglet} | null`,
  `TYPES_DATES_CCP2`, `datesCcp2(evenements, aujourdhui) -> evenement & {passe}[]`
  (`js/ccp-rules.js`) ; `EPREUVE {titre, points[], liens[]}`, `ETAPES[]`
  (`js/ccp2-parcours-data.js`, champs en section 4.1 de la spec).

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/ccp-rules.test.mjs` :

```js
// Onglets CCP1 et CCP2 (chantier D) : anciennes adresses, dates du parcours CCP2
// et intégrité du texte du parcours. Lancer depuis la racine du dépôt :
// node tests/ccp-rules.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ANCIENNES_ROUTES, ancienneRoute, TYPES_DATES_CCP2, datesCcp2 } from "../js/ccp-rules.js";
import { EPREUVE, ETAPES } from "../js/ccp2-parcours-data.js";
import {
  MODULES, MODULE_DE_ROUTE, ONGLETS_REGROUPES, ROUTES_SOCLE, MODULE_DE_SOUS_ONGLET,
} from "../js/modules-data.js";
import { STORAGE_SOUS_ONGLET } from "../js/nouveautes.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Anciennes adresses
eq(ancienneRoute("themes"), { route: "ccp1", sousOnglet: "themes" }, "#/themes mène à CCP1, Thèmes");
eq(ancienneRoute("notes"), { route: "ccp1", sousOnglet: "notes" }, "#/notes mène à CCP1, Notes");
eq(ancienneRoute("planning"), null, "une route actuelle n'est pas une ancienne adresse");
eq(ancienneRoute("constructor"), null, "propriété héritée ignorée");
eq(ancienneRoute(undefined), null, "adresse absente");
for (const [ancienne, cible] of Object.entries(ANCIENNES_ROUTES)) {
  ok(ancienne in MODULE_DE_ROUTE, ancienne + " : gardée par son module");
  ok(cible.route in ONGLETS_REGROUPES, ancienne + " : mène à un onglet regroupé");
  eq(MODULE_DE_SOUS_ONGLET[cible.route][cible.sousOnglet], MODULE_DE_ROUTE[ancienne],
     ancienne + " : le sous-onglet visé relève du même module");
  ok(cible.route in STORAGE_SOUS_ONGLET, ancienne + " : sous-onglet mémorisable");
}

// 2. Dates du parcours CCP2
eq(TYPES_DATES_CCP2, ["formation", "stage", "examen"], "types repris du Calendrier");
const EV = [
  { id: 1, type: "formation", title: "Formation CCP1", date_start: "2026-03-30", date_end: "2026-09-21" },
  { id: 6, type: "stage", title: "Stage entreprise CCP2 01", date_start: "2026-10-12", date_end: "2026-10-16" },
  { id: 9, type: "examen", title: "Examens CCP2", date_start: "2026-12-08", date_end: "2026-12-11" },
  { id: 5, type: "formation", title: "Formation ccp 2", date_start: "2026-09-28", date_end: "2026-12-07" },
  { id: 11, type: "autre", title: "Réunion CCP2", date_start: "2026-10-01" },
  { id: 12, type: "stage", title: "Stage CCP20", date_start: "2026-10-01" },
  { id: 13, type: "examen", title: "Examen", date_start: "2026-12-01" },
  { id: 14, type: "stage", title: "Stage CCP2 sans date" },
];
const d = datesCcp2(EV, "2026-10-14");
eq(d.map((e) => e.id), [5, 6, 9], "CCP2 seulement, types retenus, triés par date de début");
eq(d.map((e) => e.passe), [false, false, false], "rien n'est passé le 14/10");
eq(datesCcp2(EV, "2026-10-17").find((e) => e.id === 6).passe, true, "stage fini la veille : passé");
eq(datesCcp2(EV, "2026-10-16").find((e) => e.id === 6).passe, false, "dernier jour du stage : pas encore passé");
eq(datesCcp2([{ id: 2, type: "examen", title: "Examens CCP2", date_start: "2026-12-08" }], "2026-12-09")[0].passe,
   true, "sans date de fin, la date de début fait foi");
eq(datesCcp2(null, "2026-10-14"), [], "liste absente");
ok(!("passe" in EV[1]), "les événements d'origine ne sont pas modifiés");

// 3. Texte du parcours
eq(ETAPES.length, 8, "8 étapes");
eq(ETAPES.map((e) => e.num), [1, 2, 3, 4, 5, 6, 7, 8], "numérotées de 1 à 8, dans l'ordre");
eq(ETAPES.map((e) => e.cle),
   ["commanditaire", "demande", "construire", "animer", "analyser", "dossier", "oral", "epreuve"],
   "clés stables");
const CADRATIN = "\u2014";
const textes = [];
function verifierLien(l, ou) {
  ok(typeof l.label === "string" && l.label.length > 0, ou + " : libellé");
  textes.push(l.label);
  if (l.href) {
    ok(/^(https:\/\/|assets\/)/.test(l.href), ou + " : site sécurisé ou fichier de l'app");
    if (l.href.startsWith("assets/")) {
      ok(existsSync(fileURLToPath(new URL("../" + l.href, import.meta.url))), ou + " : fichier présent");
    }
    return;
  }
  ok(l.route in MODULE_DE_ROUTE || l.route in ONGLETS_REGROUPES || ROUTES_SOCLE.includes(l.route),
     ou + " : route connue");
  if (l.sousOnglet) ok(l.route in STORAGE_SOUS_ONGLET, ou + " : sous-onglet joignable");
  if (l.module) ok(MODULES.some((m) => m.cle === l.module), ou + " : module connu");
}
const liste = (v, min) => Array.isArray(v) && v.length >= min && v.every((t) => typeof t === "string" && t.length > 0);
for (const e of ETAPES) {
  ok(typeof e.titre === "string" && e.titre.length > 0, e.cle + " : titre");
  ok(typeof e.enBref === "string" && e.enBref.length > 0, e.cle + " : en bref");
  ok(e.titreAttendus === undefined || (typeof e.titreAttendus === "string" && e.titreAttendus.length > 0),
     e.cle + " : titre des attendus");
  ok(liste(e.attendus, 3), e.cle + " : au moins 3 attendus");
  ok(liste(e.conseils, 3), e.cle + " : au moins 3 conseils");
  ok(e.aGarder === undefined || liste(e.aGarder, 1), e.cle + " : à garder");
  ok(typeof e.source === "string" && e.source.length > 0, e.cle + " : source");
  (e.liens || []).forEach((l, i) => verifierLien(l, e.cle + ", lien " + (i + 1)));
  textes.push(e.titre, e.enBref, e.source, e.titreAttendus || "", ...e.attendus, ...e.conseils, ...(e.aGarder || []));
}
ok(typeof EPREUVE.titre === "string" && EPREUVE.titre.length > 0, "épreuve : titre");
ok(liste(EPREUVE.points, 3), "épreuve : au moins 3 points");
EPREUVE.liens.forEach((l, i) => verifierLien(l, "épreuve, lien " + (i + 1)));
textes.push(EPREUVE.titre, ...EPREUVE.points);
for (const t of textes) {
  ok(!t.includes(CADRATIN), "sans tiret cadratin : " + t.slice(0, 50));
  ok(!/\bprofs?\b/i.test(t), "« formateur », jamais « prof » : " + t.slice(0, 50));
}

console.log(`ccp-rules : ${n} assertions OK`);
```

- [ ] **Étape 2 : lancer le test, constater l'échec**

Commande : `node tests/ccp-rules.test.mjs`
Attendu : échec à l'import (`js/ccp-rules.js` introuvable).

- [ ] **Étape 3 : créer `js/ccp-rules.js`**

```js
// Règles pures des onglets CCP1 et CCP2 (chantier D). Aucune dépendance, aucun
// accès à la base ni au DOM : testées par node (tests/ccp-rules.test.mjs).

const contient = (objet, cle) => Object.prototype.hasOwnProperty.call(objet, cle);

// Anciennes adresses. Thèmes et Notes étaient des onglets ; ce sont désormais des
// sous-onglets de CCP1. Des favoris, des raccourcis d'écran d'accueil et la
// dernière page mémorisée les portent encore.
export const ANCIENNES_ROUTES = {
  themes: { route: "ccp1", sousOnglet: "themes" },
  notes: { route: "ccp1", sousOnglet: "notes" },
};

// Destination d'une ancienne adresse, ou null si la route n'en est pas une.
export function ancienneRoute(route) {
  return typeof route === "string" && contient(ANCIENNES_ROUTES, route) ? ANCIENNES_ROUTES[route] : null;
}

// Types d'événements du Calendrier repris dans le parcours CCP2.
export const TYPES_DATES_CCP2 = ["formation", "stage", "examen"];
const MOTIF_CCP2 = /\bccp\s*2\b/i;

// Événements CCP2 du Calendrier : formation, stages et examen dont le titre
// contient « CCP2 » (casse et espace ignorés), triés par date de début. Chacun
// reçoit `passe`, vrai s'il est terminé à la date `aujourdhui` (AAAA-MM-JJ). Les
// dates de la base sont des textes AAAA-MM-JJ : l'ordre du texte est celui du temps.
export function datesCcp2(evenements, aujourdhui) {
  return (Array.isArray(evenements) ? evenements : [])
    .filter((e) => e && TYPES_DATES_CCP2.includes(e.type) && typeof e.date_start === "string"
      && MOTIF_CCP2.test(e.title || ""))
    .map((e) => ({ ...e, passe: (e.date_end || e.date_start) < aujourdhui }))
    .sort((a, b) => (a.date_start < b.date_start ? -1 : a.date_start > b.date_start ? 1 : 0));
}
```

- [ ] **Étape 4 : créer `js/ccp2-parcours-data.js`**

```js
// Parcours guidé du CCP2 (chantier D) : le texte affiché par l'onglet CCP2
// (js/views/ccp2.js), et rien d'autre.
//
// Sources : REAC TP-01303 du 05/02/2021 (fiches compétences 8 à 11) et
// référentiel d'évaluation du 31/01/2021 (CCP « Sensibiliser l'ensemble des
// usagers de la route » et obligations réglementaires), servis par l'app dans
// assets/referentiels/. Les attendus des étapes 2 à 5 reprennent mot pour mot
// les critères de performance du REAC : ne pas les reformuler.
//
// Public : les stagiaires. Tutoiement, phrases courtes, sans jargon ; un terme
// métier est défini à sa première apparition. Aucun tiret cadratin.
// tests/ccp-rules.test.mjs contrôle la forme de chaque étape.
//
// Champs d'une étape : num, cle (stable), titre, enBref, titreAttendus
// (facultatif, « Ce que le jury regarde » par défaut), attendus, conseils,
// aGarder (facultatif), liens (facultatif : { label, href } pour un fichier ou
// un site, { label, route, sousOnglet, module } pour une page de l'app), source.
// Aucun import : le fichier est lu tel quel par les tests node.

const RE = "assets/referentiels/RE_TP_ECSR_2021.pdf";
const REAC = "assets/referentiels/REAC_TP_ECSR_2021.pdf";
const BOITE_A_OUTILS = "assets/guides/boite-a-outils-ccp2.html";

export const EPREUVE = {
  titre: "L'épreuve en bref",
  points: [
    "1 h 30 devant le jury, en trois temps qui s'enchaînent : la présentation de ton action "
      + "(30 minutes, sans interruption), un entretien technique sur cette présentation "
      + "(30 minutes), puis des questions sur ton dossier écrit (30 minutes).",
    "Deux productions à préparer avant la session : ton dossier écrit, de 40 000 à 45 000 "
      + "caractères, et ton support de présentation projetable.",
    "Pas de questionnaire professionnel au CCP2.",
    "Au moins 140 heures de période en entreprise, attestées par ton centre de formation.",
  ],
  liens: [
    { label: "Référentiel d'évaluation (PDF)", href: RE },
    { label: "Référentiel emploi, activités, compétences (PDF)", href: REAC },
    { label: "Boîte à outils numérique CCP2", href: BOITE_A_OUTILS },
  ],
};

export const ETAPES = [
  {
    num: 1,
    cle: "commanditaire",
    titre: "Trouver un commanditaire",
    enBref: "Une structure qui te confie une action de sensibilisation à la sécurité routière : "
          + "école, collège, association, entreprise, résidence pour seniors.",
    titreAttendus: "Ce qu'exige le référentiel",
    attendus: [
      "Ton épreuve repose sur une action réelle, que tu as menée en autonomie pendant une "
        + "période en entreprise.",
      "Le CCP2 demande au moins 140 heures de période en entreprise : le jury vérifie que ton "
        + "dossier contient l'attestation.",
      "Ton dossier doit permettre d'identifier le commanditaire, son activité et la date de sa "
        + "demande.",
    ],
    conseils: [
      "Le commanditaire est la structure qui te demande l'action, pas forcément le public qui "
        + "y assiste : par exemple la directrice d'une école, pour une classe de CM2.",
      "Choisis un public que tu as envie de sensibiliser et une structure que tu peux joindre "
        + "vite : les périodes de stage sont courtes.",
      "Présente-toi au nom de ton établissement de stage et explique ce qu'il propose : c'est "
        + "lui qui répond à la demande, avec toi.",
      "Parles-en à ton tuteur avant de t'engager : l'action se fait dans le cadre de "
        + "l'établissement.",
      "Dès le premier contact, note le nom de la structure, son activité, ton interlocuteur "
        + "et la date.",
    ],
    aGarder: [
      "Les coordonnées et l'activité du commanditaire, et la date du premier contact.",
      "Les échanges écrits (courriels, messages) : ils serviront à transcrire sa demande.",
    ],
    liens: [
      { label: "Boîte à outils numérique CCP2 (Canva pour une affiche, Drive pour ranger tes documents)",
        href: BOITE_A_OUTILS },
    ],
    source: "Référentiel d'évaluation : CCP2 et obligations réglementaires",
  },
  {
    num: 2,
    cle: "demande",
    titre: "Analyser la demande",
    enBref: "Comprendre ce que veut vraiment le commanditaire, puis vous mettre d'accord sur un "
          + "cahier des charges.",
    attendus: [
      "Les attentes spécifiques du commanditaire sont identifiées.",
      "Le conseil est pertinent au regard de la demande.",
      "La prestation envisagée correspond au besoin du commanditaire.",
      "Les impératifs économiques, logistiques et organisationnels de l'établissement sont pris "
        + "en compte.",
      "Les prestations et l'expertise de l'établissement sont valorisées auprès du client.",
    ],
    conseils: [
      "Mène un entretien, en face à face ou à distance : pose des questions ouvertes, écoute, "
        + "puis reformule pour vérifier que tu as bien compris.",
      "Fais préciser le public (âge, nombre, ce qu'il sait déjà), le lieu, la date, le temps "
        + "disponible et ce que le commanditaire espère voir changer.",
      "Estime la durée nécessaire selon l'objectif, et dis-le si le temps prévu ne suffit pas : "
        + "conseiller fait partie de ton rôle.",
      "Formalisez ensemble le cahier des charges, le document qui fixe ce que l'action doit "
        + "respecter : public, objectifs, durée, lieu, moyens, contraintes.",
      "Convenez des critères qui diront si l'action a atteint son objectif.",
      "Confirme par un courriel professionnel ce qui a été convenu, et rends compte à ton "
        + "tuteur.",
    ],
    aGarder: [
      "La demande telle que le commanditaire l'a formulée, avec ses mots : ton dossier commence "
        + "par sa transcription.",
      "Le cahier des charges validé et les critères d'évaluation convenus.",
    ],
    source: "REAC, compétence 8 : analyser une demande relative à une prestation de sensibilisation",
  },
  {
    num: 3,
    cle: "construire",
    titre: "Construire l'action",
    enBref: "Écrire le scénario de la séance et préparer tout ce qu'il faut pour l'animer.",
    attendus: [
      "Le scénario de l'action intègre les exigences du cahier des charges.",
      "Le rôle du co-animateur et les modalités de son intervention sont définis.",
      "Le contenu et les ressources sont adaptés à l'objectif et au public.",
      "Les activités d'apprentissage et les espaces de formation prévus sont en cohérence avec "
        + "l'objectif.",
      "Le scénario tient compte de la durée et des moyens matériels.",
    ],
    conseils: [
      "Écris ton scénario pédagogique, c'est-à-dire le déroulé de la séance phase par phase : "
        + "objectif, durée, activité, support et rôle de chacun.",
      "Appuie-toi sur le REMC (référentiel pour l'éducation à une mobilité citoyenne) pour "
        + "situer ton action dans le continuum éducatif, l'éducation routière qui va de l'école "
        + "à l'après-permis.",
      "Prends tes informations à des sources fiables : chiffres de l'accidentalité, "
        + "réglementation, publications de la Sécurité routière.",
      "Choisis des méthodes qui font participer et qui conviennent à l'âge et aux "
        + "connaissances du public.",
      "Prépare l'outil d'évaluation de l'action (questionnaire, quiz, tour de table), en lien "
        + "avec l'objectif.",
      "Si vous animez à deux, répartissez les rôles par écrit.",
      "Prépare le matériel et les documents en nombre suffisant, et prévois l'aménagement de la "
        + "salle.",
      "En cas de difficulté, préviens ton tuteur sans attendre.",
    ],
    aGarder: [
      "Le scénario daté, tes supports et l'outil d'évaluation : ils iront en annexe de ton "
        + "dossier.",
    ],
    liens: [
      { label: "Les cours des 57 thèmes, pour vérifier une règle ou un chiffre",
        route: "ccp1", sousOnglet: "themes", module: "cours" },
      { label: "Boîte à outils numérique CCP2 (Forms pour un questionnaire, Canva pour un support)",
        href: BOITE_A_OUTILS },
    ],
    source: "REAC, compétence 9 : construire et préparer une action de sensibilisation",
  },
  {
    num: 4,
    cle: "animer",
    titre: "Animer la séance",
    enBref: "Conduire la séance devant le public, en restant fidèle au cahier des charges.",
    attendus: [
      "Les clauses du cahier des charges sont respectées.",
      "Les techniques et supports pédagogiques sont adaptés.",
      "Le langage et la communication sont adaptés au public.",
      "Les contenus sont pertinents.",
      "La durée de la séance est respectée.",
      "La méthode favorise la participation du public.",
    ],
    conseils: [
      "Fais d'abord émerger les représentations du public, ce qu'il pense déjà du risque "
        + "routier, et pars de là.",
      "Amène les participants à analyser leurs propres pratiques d'usagers de la route, plutôt "
        + "que de leur réciter des règles.",
      "Adapte ton scénario si le public réagit autrement que prévu, sans perdre ton objectif.",
      "Garde un œil sur l'heure : la durée convenue fait partie du cahier des charges.",
      "En co-animation, respecte le rôle de chacun tel que vous l'avez prévu.",
      "Termine par l'outil d'évaluation prévu.",
    ],
    aGarder: [
      "Les résultats de l'évaluation et tes notes prises à chaud, juste après la séance.",
      "Des photos pour ton support, seulement avec l'accord des personnes, et celui des "
        + "parents pour des mineurs.",
    ],
    source: "REAC, compétence 10 : animer une séance de sensibilisation à la sécurité routière, "
          + "au respect des usagers et de l'environnement",
  },
  {
    num: 5,
    cle: "analyser",
    titre: "Analyser ta pratique",
    enBref: "Prendre du recul sur ta séance : ce qui a marché, ce qui n'a pas marché, et comment "
          + "progresser.",
    attendus: [
      "La situation de formation est décrite et analysée de façon pertinente.",
      "Les propositions d'ajustement des pratiques sont pertinentes.",
      "Les facteurs d'efficacité et d'inefficacité des pratiques sont identifiés.",
      "Les pratiques professionnelles sont décrites et analysées de façon pertinente.",
      "Les sources d'information relatives à la sécurité routière sont connues et exploitées à "
        + "bon escient.",
      "Le bilan des interventions est pertinent.",
      "Les axes d'amélioration sont réalistes.",
    ],
    conseils: [
      "Décris d'abord ce qui s'est passé, en séparant les faits de tes opinions et de tes "
        + "émotions.",
      "Pars des résultats de l'évaluation et des retours du commanditaire.",
      "Cherche pourquoi un moment a fonctionné ou non : la méthode, le support, le temps, le "
        + "public.",
      "Échange avec ton tuteur, tes formateurs ou d'autres stagiaires : le regard des pairs "
        + "nourrit l'analyse.",
      "Retiens deux ou trois axes d'amélioration réalistes, applicables dès ta prochaine séance.",
      "Organise ta veille : quelles sources tu suis (Sécurité routière, ONISR pour les chiffres, "
        + "Légifrance pour les textes) et à quel rythme.",
    ],
    aGarder: [
      "Ton bilan écrit, avec tes points forts, tes points faibles et tes axes d'amélioration : "
        + "c'est une partie exigée du dossier.",
      "La liste de tes sources de veille et la façon dont tu les suis.",
    ],
    source: "REAC, compétence 11 : analyser ses pratiques professionnelles afin de les faire évoluer",
  },
  {
    num: 6,
    cle: "dossier",
    titre: "Rédiger le dossier",
    enBref: "Le document écrit sur lequel le jury te questionne pendant 30 minutes.",
    titreAttendus: "Ce qu'exige le référentiel",
    attendus: [
      "Entre 40 000 et 45 000 caractères, espaces compris, sans compter les annexes.",
      "La transcription de la demande formulée, avec ce qui identifie le commanditaire, son "
        + "activité et la date de la demande.",
      "Les enjeux, le contexte et la finalité de l'action, ta méthode d'analyse de la demande, "
        + "la construction de ta réponse, les outils et techniques pédagogiques utilisés et ta "
        + "posture d'enseignant.",
      "La démonstration que ta réponse correspond à la demande du commanditaire et au public "
        + "visé.",
      "Ton analyse de pratique : les points forts et les points faibles de ta démarche, et tes "
        + "axes d'amélioration.",
      "La façon dont tu assures ta veille sur le secteur professionnel et la réglementation.",
    ],
    conseils: [
      "Écris au fil des étapes, à partir de tes notes, plutôt que tout à la fin.",
      "Suis l'ordre des contenus exigés : le jury retrouvera plus vite ce qu'il cherche.",
      "Surveille le compte : dans Google Docs, le menu Outils, Nombre de mots (Ctrl + Maj + C) "
        + "affiche les caractères, espaces compris.",
      "Mets le cahier des charges, le scénario, les supports et l'outil d'évaluation en annexe : "
        + "ils ne comptent pas dans les caractères.",
      "Fais relire par quelqu'un qui ne connaît pas ton action : s'il comprend, le jury "
        + "comprendra.",
      "Remets-le dans les délais fixés par ton centre : il est produit avant la session.",
    ],
    liens: [
      { label: "Boîte à outils numérique CCP2 (Google Docs et Drive)", href: BOITE_A_OUTILS },
    ],
    source: "Référentiel d'évaluation, CCP2 : analyse d'une demande d'action de sensibilisation "
          + "et réponse à cette demande",
  },
  {
    num: 7,
    cle: "oral",
    titre: "Préparer l'oral",
    enBref: "Un support projetable et 30 minutes pour présenter ton action, sans être "
          + "interrompu.",
    titreAttendus: "Ce qu'exige le référentiel",
    attendus: [
      "Un support numérique projetable, préparé avant la session.",
      "Six points à présenter : le commanditaire ; le contexte de l'action ; l'analyse de la "
        + "demande et la structuration de ta réponse ; le contenu de ta réponse ; l'analyse de "
        + "ta prestation ; la façon dont tu fais ta veille sur le secteur professionnel et la "
        + "réglementation.",
      "30 minutes de présentation : le jury n'intervient pas pendant ce temps.",
      "Une démarche de pédagogue : tu te places en posture d'enseignant face au jury.",
    ],
    conseils: [
      "Construis ton support dans l'ordre des six points.",
      "Une idée par diapositive et peu de texte : le support appuie ta parole, il ne la "
        + "remplace pas.",
      "Répète à voix haute, chronomètre en main, jusqu'à tenir les 30 minutes sans courir.",
      "Prépare les questions qu'on pourrait te poser sur tes choix pédagogiques : l'entretien "
        + "technique suit immédiatement.",
      "Garde une copie de ton support sur une clé USB et une autre en ligne.",
    ],
    liens: [
      { label: "Boîte à outils numérique CCP2 (Canva pour le support)", href: BOITE_A_OUTILS },
    ],
    source: "Référentiel d'évaluation, CCP2 : présentation d'un projet réalisé en amont de la "
          + "session",
  },
  {
    num: 8,
    cle: "epreuve",
    titre: "Le jour de l'épreuve",
    enBref: "1 h 30 face au jury, en trois temps qui s'enchaînent.",
    titreAttendus: "Comment se déroule l'épreuve",
    attendus: [
      "Présentation de ton action : 30 minutes, à partir de ton support, sans interruption du "
        + "jury.",
      "Entretien technique : 30 minutes, juste après, sur ta présentation.",
      "Questions sur ton dossier écrit : 30 minutes, juste après l'entretien.",
      "Le jury vérifie que ton dossier contient l'attestation de période en entreprise. Il "
        + "dispose aussi de ton dossier professionnel et des résultats de tes évaluations en "
        + "cours de formation.",
      "Pour obtenir le titre par les CCP, un entretien avec le jury, au vu de ton livret de "
        + "certification, a lieu en fin de session du dernier CCP.",
    ],
    conseils: [
      "À l'ouverture de la session, présente ton permis B avec l'attestation sur l'honneur "
        + "signée, et l'attestation de ton centre de formation.",
      "Vérifie avant le jour J que ton dossier professionnel est à jour pour le CCP2.",
      "Apporte ton support sur une clé USB, avec une copie en ligne.",
    ],
    liens: [
      { label: "Ton dossier professionnel (Mon espace, sous-onglet Dossier pro)",
        route: "mon-suivi", sousOnglet: "dp", module: "dp" },
      { label: "Référentiel d'évaluation (PDF)", href: RE },
    ],
    source: "Référentiel d'évaluation : modalités du CCP2, obligations réglementaires et accès "
          + "au titre par capitalisation des CCP",
  },
];
```

- [ ] **Étape 5 : lancer le test**

Commande : `node tests/ccp-rules.test.mjs`
Attendu : `ccp-rules : N assertions OK`.

- [ ] **Étape 6 : commit**

```bash
git add js/ccp-rules.js js/ccp2-parcours-data.js tests/ccp-rules.test.mjs
git commit -m "CCP : anciennes adresses, dates du parcours et texte des 8 etapes du CCP2"
```

---

### Tâche 3 : onglet CCP1

**Fichiers :**
- Créer : `js/views/ccp1.js`
- Modifier : `js/views/themes.js` (variable `embarque`, en-tête de `rerender`, `renderThemes`)
- Modifier : `js/views/notes.js` (imports, variable `embarque`, en-tête et fin de `rerender`, `renderNotes`)
- Modifier : `js/main.js` (imports, `TABS`, `routes`, `derniereRoute`, début de `navigate`)
- Modifier : `js/views/home.js` (tuiles)
- Modifier : `js/icons.js` (icône `ccp1`)
- Modifier : `css/style.css` (fin de fichier)
- Banc : `_harness_build.mjs`, `_harness_supabase.js` copiés depuis `TP_ECSR_App` (exclus de git),
  `.claude/launch.json` (exclu de git)

**Interfaces :**
- Consomme : `SOUS_ONGLETS_CCP1`, `STORAGE_SOUS_ONGLET.ccp1` (tâche 1) ; `ancienneRoute` (tâche 2).
- Produit : `renderCcp1(container)` ; `renderThemes(container, { embedded, isActive })` et
  `renderNotes(container, { embedded, isActive })`, options facultatives.

- [ ] **Étape 1 : vue Thèmes embarquable (`js/views/themes.js`)**

Après `let themesActif = () => true;`, ajouter :

```js
// Rendu dans le sous-onglet Thèmes de CCP1 : pas de grand titre (l'onglet a le sien).
let embarque = false;
```

Dans `rerender`, remplacer le début de l'en-tête :

```js
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, totalProgress.fait + " / " + totalProgress.total + " thèmes officiels terminés"),
      el("h2", {}, "Thèmes & progression"),
      el("p", { class: "subtitle" }, "Référentiel officiel ECF (57 thèmes) + compétences TP ECSR (formateur) + compétences REMC (conduite) + notions pédagogiques."),
    ),
```

par :

```js
  // Embarquée dans CCP1, la vue garde sa ligne de progression (refreshStatsInPlace la
  // retrouve par .view-header .eyebrow) et son bouton, mais pas son grand titre.
  container.appendChild(el("div", { class: "view-header" + (embarque ? " view-header-embarque" : "") },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, totalProgress.fait + " / " + totalProgress.total + " thèmes officiels terminés"),
      embarque ? null : el("h2", {}, "Thèmes & progression"),
      embarque ? null : el("p", { class: "subtitle" }, "Référentiel officiel ECF (57 thèmes) + compétences TP ECSR (formateur) + compétences REMC (conduite) + notions pédagogiques."),
    ),
```

Remplacer la fonction `renderThemes` entière par :

```js
export async function renderThemes(container, opts = {}) {
  clear(container);
  // Dans un sous-onglet de CCP1, `isActive` dit si ce sous-onglet est encore celui qui
  // est affiché ; ailleurs, il vaut toujours vrai.
  const ongletActif = opts.isActive || (() => true);
  embarque = !!opts.embedded;
  // Un montage précédent a pu laisser ces deux références derrière lui : le panneau
  // qu'elles désignent est mort, et le jeton d'activation qu'elles portent est figé sur
  // l'onglet d'alors. Les repartir de zéro à chaque montage évite qu'un rendu tardif
  // n'écrive dans un écran disparu, ou refuse d'écrire dans celui qui vient de naître.
  lastContainer = null;
  themesActif = ongletActif;
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  themes = await listThemes();
  await loadQcmIndex();
  // Sous-onglet de CCP1 quitté pendant le chargement : le panneau ne nous appartient plus.
  if (!ongletActif()) return;
  clear(container);

  // Un élève ne voit ni la barre de sous-onglets, ni la console : la RLS ne suffit pas,
  // sa politique de lecture lui rend SES propres signalements.
  if (!canManageExam()) { lastContainer = container; rerender(container); return; }

  container.appendChild(renderSubTabs([
    { key: "themes", label: "Thèmes",
      // lastContainer devient le PANNEAU : c'est lui que reload() doit repeindre. Le
      // repeint attend que ce sous-onglet ET celui de CCP1 soient encore affichés.
      render: (p, ctx) => {
        lastContainer = p;
        const interne = ctx?.isActive || (() => true);
        themesActif = () => ongletActif() && interne();
        rerender(p);
      } },
    { key: "signalements", label: "⚑ Signalements",
      render: (p, ctx) => { renderConsoleSignalements(p, { themes, onOuvrirEditeur: ouvrirDepuisConsole, isActive: ctx?.isActive }); } },
  ], { storageKey: "themes.subtab" }));
}
```

- [ ] **Étape 2 : vue Notes embarquable (`js/views/notes.js`)**

Supprimer ces quatre imports (ils passent dans `ccp1.js`) :

```js
import { renderSubTabs } from "../subtabs.js?v=20261002b";
import { renderEpcf } from "./epcf.js?v=20261002b";
import { renderEpcfLivret } from "./epcf-livret.js?v=20261002b";
import { renderDp } from "./dp.js?v=20261002b";
```

Après `let currentEvalDate = null;  // Date appliquée aux nouvelles notes saisies dans la matrice`,
ajouter :

```js
// Rendu dans le sous-onglet Notes de CCP1 : pas de grand titre (l'onglet a le sien).
let embarque = false;
```

Dans `rerender`, remplacer :

```js
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, evaluations.length + " note" + (evaluations.length > 1 ? "s" : "") + " enregistrée" + (evaluations.length > 1 ? "s" : "")),
      el("h2", {}, "Notes & évaluations"),
      el("p", { class: "subtitle" }, "Tableau matrice : stagiaires × thèmes/compétences. Clique une cellule pour saisir la note."),
    ),
```

par :

```js
  container.appendChild(el("div", { class: "view-header" + (embarque ? " view-header-embarque" : "") },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, evaluations.length + " note" + (evaluations.length > 1 ? "s" : "") + " enregistrée" + (evaluations.length > 1 ? "s" : "")),
      embarque ? null : el("h2", {}, "Notes & évaluations"),
      embarque ? null : el("p", { class: "subtitle" }, "Tableau matrice : stagiaires × thèmes/compétences. Clique une cellule pour saisir la note."),
    ),
```

Remplacer toute la fin de `rerender`, depuis le commentaire `// Panneau « Matrice » = barre d'outils + tableau + synthèse + graphiques.` jusqu'à la ligne
`  ], { storageKey: "ecsr_notes_subtab" }));` incluse, par :

```js
  // Matrice = barre d'outils + tableau + synthèse + graphiques. Les éditions de cellule
  // appellent refreshAnalyticsInPlace(container), qui retrouve .notes-synthese et
  // .notes-chart par querySelector dans ce même conteneur. EPCF, Livret EPCF et
  // Dossier pro, autrefois sous-onglets de Notes, sont ceux de CCP1 (js/views/ccp1.js).
  // La matrice reste en lecture seule pour les stagiaires.
  container.appendChild(toolbar);
  container.appendChild(renderMatrice(container));
  container.appendChild(renderSynthese());
  container.appendChild(renderChartsSection());
```

(l'accolade fermante `}` de `rerender` reste en place.)

Remplacer la fonction `renderNotes` entière par :

```js
export async function renderNotes(container, opts = {}) {
  embarque = !!opts.embedded;
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  let allThemes;
  [stagiaires, competences, evaluations, allThemes, userProfiles] = await Promise.all([
    listStagiaires(), listCompetences(), listEvaluations(), listThemes(), listUserProfiles(),
  ]);
  themesOfficiels = allThemes.filter((t) => t.type === "theme" && t.numero != null);
  // Sous-onglet de CCP1 quitté pendant le chargement : le panneau ne nous appartient plus.
  if (opts.isActive && !opts.isActive()) return;
  rerender(container);
}
```

Contrôle : `grep -n "renderSubTabs\|renderEpcf\|renderDp\|ecsr_notes_subtab" js/views/notes.js` ne renvoie rien.

- [ ] **Étape 3 : créer `js/views/ccp1.js`**

```js
// Onglet CCP1 (chantier D) : réunit ce qui sert au premier certificat du titre,
// « Former des apprenants conducteurs ». Chaque sous-onglet rend une vue
// existante, embarquée : sans son grand titre, l'onglet a le sien.
// Les sous-onglets et leurs modules sont déclarés dans js/modules-data.js
// (SOUS_ONGLETS_CCP1) ; ce fichier n'y ajoute que la façon de rendre chacun.
import { el, clear } from "../utils.js?v=20261002b";
import { renderSubTabs } from "../subtabs.js?v=20261002b";
import { SOUS_ONGLETS_CCP1 } from "../modules-data.js?v=20261002b";
import { STORAGE_SOUS_ONGLET } from "../nouveautes.js?v=20261002b";
import { renderThemes } from "./themes.js?v=20261002b";
import { renderNotes } from "./notes.js?v=20261002b";
import { renderEpcf } from "./epcf.js?v=20261002b";
import { renderEpcfLivret } from "./epcf-livret.js?v=20261002b";
import { renderDp } from "./dp.js?v=20261002b";

const RENDUS = {
  themes: { rendu: renderThemes, erreur: "Erreur de chargement des thèmes." },
  notes: { rendu: renderNotes, erreur: "Erreur de chargement des notes." },
  epcf: { rendu: renderEpcf, erreur: "Erreur de chargement de l'espace EPCF." },
  livret: { rendu: renderEpcfLivret, erreur: "Erreur de chargement du livret EPCF." },
  dp: { rendu: renderDp, erreur: "Erreur de chargement du dossier professionnel." },
};

// Rend une vue dans le panneau d'un sous-onglet. En cas d'échec, un message remplace
// le chargement, seulement si le panneau est encore celui de ce sous-onglet.
function embarquer({ rendu, erreur }) {
  return (panneau, ctx) => {
    const isActive = ctx && ctx.isActive;
    Promise.resolve()
      .then(() => rendu(panneau, { embedded: true, isActive }))
      .catch((e) => {
        console.error(e);
        if (isActive && !isActive()) return;
        clear(panneau);
        panneau.appendChild(el("p", { class: "muted" }, erreur + " Reviens sur l'onglet pour réessayer."));
      });
  };
}

export async function renderCcp1(container) {
  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Titre professionnel ECSR"),
      el("h2", {}, "CCP1"),
      el("p", { class: "subtitle" },
        "Former des apprenants conducteurs : thèmes et cours, notes, examens blancs, "
        + "livret et dossier professionnel."),
    ),
  ));
  const onglets = renderSubTabs(
    SOUS_ONGLETS_CCP1.map((s) => ({ ...s, render: embarquer(RENDUS[s.key]) })),
    { storageKey: STORAGE_SOUS_ONGLET.ccp1 },
  );
  onglets.classList.add("ccp1-onglets");
  container.appendChild(onglets);
}
```

- [ ] **Étape 4 : icône `ccp1` (`js/icons.js`)**

Après la ligne de l'icône `edu`, ajouter :

```js
  // Onglets CCP1 et CCP2 : carré arrondi portant le numéro du certificat. Sur
  // téléphone, la barre n'affiche que les icônes : c'est le chiffre qui les distingue.
  ccp1:       () => svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M10 9.5 12.75 7.5v9"/><path d="M10 16.5h5.5"/>'),
```

- [ ] **Étape 5 : routeur `js/main.js`**

Imports : supprimer les lignes `import { renderNotes } …` et `import { renderThemes } …` ; remplacer
`import { libellePastille } from "./nouveautes.js?v=20261002b";` par :

```js
import { libellePastille, STORAGE_SOUS_ONGLET } from "./nouveautes.js?v=20261002b";
import { ancienneRoute } from "./ccp-rules.js?v=20261002b";
import { renderCcp1 } from "./views/ccp1.js?v=20261002b";
```

Dans `TABS`, remplacer les deux lignes `themes` et `notes` par :

```js
  // CCP1 réunit Thèmes, Notes, EPCF, Livret EPCF et Dossier pro en sous-onglets. Il
  // n'a pas de module propre : il s'affiche dès qu'une de ces parties est ouverte
  // (ONGLETS_REGROUPES, js/modules-data.js).
  { route: "ccp1",       label: "CCP1",            icon: "ccp1"      },
```

Dans `routes`, remplacer `  themes:     renderThemes,` et `  notes:      renderNotes,` par :

```js
  ccp1:       renderCcp1,
```

Dans `derniereRoute`, remplacer :

```js
    return r && routes[r] && routeVisible(r) ? r : null;
```

par :

```js
    // Une ancienne adresse (themes, notes) est encore une destination : navigate()
    // la mène au bon sous-onglet de CCP1.
    return r && (routes[r] || ancienneRoute(r)) && routeVisible(r) ? r : null;
```

Au début de `navigate`, remplacer :

```js
  const hash = location.hash.replace(/^#\//, "") || "mon-suivi";
  let route = routes[hash] ? hash : "mon-suivi";
  // Module fermé pour la promo (lien, adresse saisie, nouveauté ancienne) : un
  // stagiaire est ramené sur Mon suivi, avec un mot d'explication.
  if (!routeVisible(route)) {
    toast("Cette partie n'est pas encore ouverte pour ta promo.", "info", 3500);
    try { history.replaceState(null, "", "#/mon-suivi"); } catch (e) { /* ignore */ }
    route = "mon-suivi";
  }
```

par :

```js
  const hash = location.hash.replace(/^#\//, "") || "mon-suivi";
  // Ancienne adresse (#/themes, #/notes : favoris, raccourcis d'écran d'accueil) :
  // Thèmes et Notes sont devenus des sous-onglets de CCP1. Elle passe d'abord la
  // garde de son module, puis mène au bon sous-onglet.
  const ancienne = ancienneRoute(hash);
  let route = (ancienne || routes[hash]) ? hash : "mon-suivi";
  // Module fermé pour la promo (lien, adresse saisie, nouveauté ancienne) : un
  // stagiaire est ramené sur Mon suivi, avec un mot d'explication.
  if (!routeVisible(route)) {
    toast("Cette partie n'est pas encore ouverte pour ta promo.", "info", 3500);
    try { history.replaceState(null, "", "#/mon-suivi"); } catch (e) { /* ignore */ }
    route = "mon-suivi";
  } else if (ancienne) {
    // Le sous-onglet visé est écrit là où renderSubTabs le relit, puis l'adresse est
    // remplacée sans entrée d'historique (replaceState ne déclenche pas hashchange).
    try { localStorage.setItem(STORAGE_SOUS_ONGLET[ancienne.route], ancienne.sousOnglet); } catch (e) { /* mode privé */ }
    try { history.replaceState(null, "", "#/" + ancienne.route); } catch (e) { /* ignore */ }
    route = ancienne.route;
  }
```

- [ ] **Étape 6 : tuile d'Accueil (`js/views/home.js`)**

Remplacer les deux tuiles `themes` et `notes` par :

```js
    { route: "ccp1",       icon: "ccp1",         title: "CCP1",             desc: "Thèmes, notes, EPCF, dossier pro" },
```

- [ ] **Étape 7 : styles (fin de `css/style.css`, sous le bloc de la tâche 1)**

```css
/* Vue embarquée dans un sous-onglet de CCP1 (Thèmes, Notes) : sans grand titre, la
   ligne de compteur ne garde qu'un petit écart avec la suite. */
.view-header.view-header-embarque { margin-bottom: 0.9rem; }
.view-header.view-header-embarque .eyebrow { margin-bottom: 0; }
@media (max-width: 760px) {
  /* Cinq sous-onglets sur la largeur d'un iPhone : écarts serrés. */
  .ccp1-onglets > .subtabs-bar { gap: 0.1rem; }
  .ccp1-onglets > .subtabs-bar > .subtab { padding: 0.5rem 0.5rem; font-size: 0.86rem; }
}
```

- [ ] **Étape 8 : banc d'essai**

```bash
cp C:/Users/watch/Dev/ECSR/TP_ECSR_App/_harness_build.mjs C:/Users/watch/Dev/ECSR/TP_ECSR_App/_harness_supabase.js C:/Users/watch/Dev/ecsr-promo-onglets-ccp/
cd C:/Users/watch/Dev/ecsr-promo-onglets-ccp && node _harness_build.mjs && git status --short
```

Attendu : `_harness.html généré…` ; `git status` ne montre ni les fichiers du banc ni
`.claude/launch.json` (exclus par `.git/info/exclude`).

Créer `.claude/launch.json` dans le worktree :

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "banc-onglets-ccp",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8031"],
      "port": 8031
    }
  ]
}
```

Ouvrir `http://localhost:8031/_harness.html#/ccp1` (preview_start `banc-onglets-ccp`), fenêtre
imposée à 1280 x 800. Contrôles, par `javascript_tool` et `read_page` :
1. Console : aucune erreur.
2. `document.querySelectorAll("#tabs .tab").length` vaut 7 et aucun onglet Thèmes ni Notes ;
   l'onglet CCP1 est actif.
3. Sous-onglets de CCP1 : Thèmes, Notes, EPCF, Livret EPCF, Dossier pro ; Thèmes affiché, sans
   `h2` dans le panneau, avec la ligne « … thèmes officiels terminés » et la barre interne
   « Thèmes, ⚑ Signalements » (fondateur).
4. Clic sur Notes : matrice, synthèse et graphiques, pas de seconde barre de sous-onglets.
5. Clics sur EPCF, Livret EPCF, Dossier pro : chaque panneau se remplit sans erreur.
6. `location.hash = "#/notes"` : l'adresse devient `#/ccp1`, sous-onglet Notes actif.
   `location.hash = "#/themes"` : `#/ccp1`, sous-onglet Thèmes actif.
7. `?role=stagiaire&modules=depart` : pas d'onglet CCP1 ; `location.hash = "#/themes"` affiche
   le message « Cette partie n'est pas encore ouverte pour ta promo. » et ramène sur Mon espace.
8. `?role=stagiaire&modules=notes` : onglet CCP1 présent, pas de barre de sous-onglets, la
   matrice s'affiche directement.
9. Accueil : tuile CCP1, plus de tuiles Thèmes ni Notes.

- [ ] **Étape 9 : tests et commit**

Commandes : `node tests/modules.test.mjs && node tests/ccp-rules.test.mjs && node tests/nouveautes.test.mjs`
Attendu : trois sorties « assertions OK ».

```bash
git add js/views/ccp1.js js/views/themes.js js/views/notes.js js/main.js js/views/home.js js/icons.js css/style.css
git commit -m "CCP1 : onglet a sous-onglets (Themes, Notes, EPCF, Livret, Dossier pro), anciennes adresses redirigees"
```

---

### Tâche 4 : onglet CCP2

**Fichiers :**
- Créer : `js/views/ccp2.js`
- Modifier : `js/main.js` (import, `TABS`, `routes`)
- Modifier : `js/views/home.js` (tuile)
- Modifier : `js/icons.js` (icône `ccp2`)
- Modifier : `css/style.css` (fin de fichier)
- Banc : `_harness_supabase.js` du worktree (événements CCP2, scénario `ccp2`)

**Interfaces :**
- Consomme : `EPREUVE`, `ETAPES` (tâche 2), `datesCcp2` (tâche 2), `routeVisible`, `moduleVisible`
  (`js/modules-etat.js`), `STORAGE_SOUS_ONGLET` (tâche 1), `listAgendaEvents()` (`js/db.js`).
- Produit : `renderCcp2(container)`.

- [ ] **Étape 1 : créer `js/views/ccp2.js`**

```js
// Onglet CCP2 (chantier D) : parcours guidé du certificat « Sensibiliser
// l'ensemble des usagers de la route ». Texte dans js/ccp2-parcours-data.js,
// dates tirées du Calendrier de la promo. Lecture seule : aucun contrôle d'édition.
import { el, clear, formatDate, isoDate } from "../utils.js?v=20261002b";
import { listAgendaEvents } from "../db.js?v=20261002b";
import { routeVisible, moduleVisible } from "../modules-etat.js?v=20261002b";
import { STORAGE_SOUS_ONGLET } from "../nouveautes.js?v=20261002b";
import { datesCcp2 } from "../ccp-rules.js?v=20261002b";
import { EPREUVE, ETAPES } from "../ccp2-parcours-data.js?v=20261002b";

// Dernière étape ouverte, rouverte au retour sur l'onglet.
const CLE_ETAPE = "ecsr_ccp2_etape";

function lireEtape() {
  try { return localStorage.getItem(CLE_ETAPE); } catch (e) { return null; }
}
function ecrireEtape(cle) {
  try {
    if (cle) localStorage.setItem(CLE_ETAPE, cle);
    else localStorage.removeItem(CLE_ETAPE);
  } catch (e) { /* navigation privée : pas de mémoire, toutes les étapes restent repliées */ }
}

// Lien d'une rubrique : fichier ou site (nouvel onglet), ou page de l'app. Une page
// dont le module est fermé pour la promo n'est pas proposée.
function lien(l) {
  if (l.href) return el("a", { href: l.href, target: "_blank", rel: "noopener" }, l.label);
  if (l.module && !moduleVisible(l.module)) return null;
  if (!routeVisible(l.route)) return null;
  return el("a", {
    href: "#/" + l.route,
    // Comme les liens « Où le trouver » des nouveautés : le sous-onglet visé est écrit
    // là où renderSubTabs le relit à l'ouverture de la page.
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[l.route];
      if (!cle || !l.sousOnglet) return;
      try { localStorage.setItem(cle, l.sousOnglet); } catch (e) { /* ignore */ }
    },
  }, l.label);
}

function listeLiens(liens) {
  const items = (liens || []).map(lien).filter(Boolean);
  return items.length ? el("ul", { class: "ccp2-liens" }, ...items.map((a) => el("li", {}, a))) : null;
}

function rubrique(titre, points) {
  if (!points || points.length === 0) return null;
  return el("section", { class: "ccp2-rubrique" },
    el("h4", {}, titre),
    el("ul", {}, ...points.map((p) => el("li", {}, p))),
  );
}

function carteEpreuve() {
  return el("section", { class: "ccp2-epreuve" },
    el("h3", {}, EPREUVE.titre),
    el("ul", { class: "ccp2-epreuve-points" }, ...EPREUVE.points.map((p) => el("li", {}, p))),
    listeLiens(EPREUVE.liens),
  );
}

function periode(e) {
  if (!e.date_end || e.date_end === e.date_start) return formatDate(e.date_start);
  return `${formatDate(e.date_start)} → ${formatDate(e.date_end)}`;
}

// Dates CCP2 de la promo, lues dans le Calendrier. Un bonus : en cas d'échec ou sans
// événement CCP2, la section reste masquée.
async function remplirDates(section) {
  let evenements;
  try { evenements = await listAgendaEvents(); }
  catch (e) { console.error("Parcours CCP2 : dates indisponibles.", e); return; }
  const dates = datesCcp2(evenements, isoDate(new Date()));
  if (dates.length === 0) return;
  section.appendChild(el("h3", {}, "Tes dates"));
  section.appendChild(el("ul", { class: "ccp2-dates-liste" },
    ...dates.map((d) => el("li", { class: "ccp2-date" + (d.passe ? " passe" : "") },
      el("span", { class: "ccp2-date-titre" }, d.title),
      el("span", { class: "ccp2-date-periode" }, periode(d) + (d.passe ? " · passé" : "")),
    )),
  ));
  section.hidden = false;
}

function carteEtape(etape, ouverte) {
  const liens = listeLiens(etape.liens);
  const details = el("details", { class: "ccp2-etape", open: ouverte ? "" : null },
    el("summary", {},
      el("span", { class: "ccp2-etape-num" }, String(etape.num)),
      el("span", { class: "ccp2-etape-titre" }, etape.titre),
      el("span", { class: "ccp2-etape-bref" }, etape.enBref),
    ),
    el("div", { class: "ccp2-etape-corps" },
      rubrique(etape.titreAttendus || "Ce que le jury regarde", etape.attendus),
      rubrique("Comment t'y prendre", etape.conseils),
      rubrique("À garder pour ton dossier", etape.aGarder),
      liens ? el("section", { class: "ccp2-rubrique" }, el("h4", {}, "Utile"), liens) : null,
      el("p", { class: "ccp2-source" }, "Source : " + etape.source),
    ),
  );
  details.addEventListener("toggle", () => {
    if (details.open) ecrireEtape(etape.cle);
    else if (lireEtape() === etape.cle) ecrireEtape(null);
  });
  return details;
}

export async function renderCcp2(container) {
  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Titre professionnel ECSR"),
      el("h2", {}, "CCP2"),
      el("p", { class: "subtitle" },
        `Sensibiliser les usagers de la route : ton parcours en ${ETAPES.length} étapes, `
        + "du commanditaire au jour de l'épreuve."),
    ),
  ));
  container.appendChild(carteEpreuve());
  const dates = el("section", { class: "ccp2-dates", hidden: "" });
  container.appendChild(dates);
  const ouverte = lireEtape();
  container.appendChild(el("h3", { class: "ccp2-etapes-titre" }, `Les ${ETAPES.length} étapes`));
  container.appendChild(el("div", { class: "ccp2-etapes" },
    ...ETAPES.map((e) => carteEtape(e, e.cle === ouverte))));
  // Les dates suivent le module Calendrier, comme l'agenda d'Accueil. Pas d'attente :
  // le parcours s'affiche tout de suite, les dates arrivent quand elles sont lues.
  if (routeVisible("calendrier")) remplirDates(dates);
}
```

- [ ] **Étape 2 : icône, routeur, tuile**

`js/icons.js`, sous l'icône `ccp1` :

```js
  ccp2:       () => svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9.25 9.75a2.75 2.75 0 0 1 5.5 0c0 1.6-1.4 2.6-2.75 3.8L9.25 16.5h5.5"/>'),
```

`js/main.js` : sous `import { renderCcp1 } …`, ajouter
`import { renderCcp2 } from "./views/ccp2.js?v=20261002b";` ; dans `TABS`, sous la ligne `ccp1` :

```js
  { route: "ccp2",       label: "CCP2",            icon: "ccp2"      },
```

et dans `routes`, sous `ccp1` :

```js
  ccp2:       renderCcp2,
```

`js/views/home.js`, sous la tuile `ccp1` :

```js
    { route: "ccp2",       icon: "ccp2",         title: "CCP2",             desc: "Ton parcours en 8 étapes" },
```

- [ ] **Étape 3 : styles (fin de `css/style.css`)**

```css
/* Parcours CCP2 */
.ccp2-epreuve,
.ccp2-dates {
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 1rem 1.2rem;
  margin-bottom: 1rem;
}
.ccp2-epreuve h3,
.ccp2-dates h3 { margin: 0 0 0.6rem; font-size: 1.1rem; }
.ccp2-epreuve-points { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.4rem; }
.ccp2-liens {
  list-style: none;
  margin: 0.8rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  font-size: 0.9rem;
}
.ccp2-liens a { color: var(--accent-strong); text-decoration: underline; text-underline-offset: 2px; }
.ccp2-dates-liste { list-style: none; margin: 0; padding: 0; }
.ccp2-date {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.2rem 1rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--line-faint);
}
.ccp2-date:last-child { border-bottom: none; }
.ccp2-date-periode { font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-soft); }
.ccp2-date.passe { color: var(--text-muted); }
.ccp2-date.passe .ccp2-date-periode { color: var(--text-faint); }
.ccp2-etapes-titre { margin: 1.4rem 0 0.7rem; font-size: 1.15rem; }
.ccp2-etapes { display: grid; gap: 0.6rem; }
.ccp2-etape {
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
}
.ccp2-etape[open] { border-color: var(--line-strong); }
.ccp2-etape > summary {
  display: grid;
  grid-template-columns: 2.1rem 1fr;
  column-gap: 0.8rem;
  row-gap: 0.15rem;
  align-items: center;
  min-height: 44px;
  padding: 0.8rem 1rem;
  cursor: pointer;
  list-style: none;
}
.ccp2-etape > summary::-webkit-details-marker { display: none; }
.ccp2-etape-num {
  grid-row: 1 / span 2;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-family: var(--font-mono);
  font-weight: 600;
}
.ccp2-etape[open] .ccp2-etape-num { background: var(--accent); color: #fff; }
.ccp2-etape-titre { font-weight: 600; color: var(--text); }
.ccp2-etape-bref { font-size: 0.9rem; color: var(--text-muted); }
.ccp2-etape-corps { padding: 0 1rem 1rem calc(1rem + 2.1rem + 0.8rem); }
.ccp2-rubrique h4 { margin: 0.9rem 0 0.35rem; font-size: 0.95rem; color: var(--accent-strong); }
.ccp2-rubrique ul { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.3rem; }
.ccp2-rubrique .ccp2-liens { margin-top: 0; }
.ccp2-source { margin: 1rem 0 0; font-size: 0.8rem; color: var(--text-muted); }
@media (max-width: 760px) {
  .ccp2-etape-corps { padding: 0 1rem 1rem; }
  .ccp2-epreuve, .ccp2-dates { padding: 0.9rem 1rem; }
}
```

- [ ] **Étape 4 : événements CCP2 dans le banc**

Dans `_harness_supabase.js` du worktree, juste avant la ligne
`  fiches_suivi: [], epcf_evaluations: [], evaluations: [],`, insérer :

```js
  // Calendrier (chantier D) : copie des titres réels, pour le parcours CCP2.
  agenda_events: [
    { id: 1, type: "formation", title: "Formation CCP1", date_start: "2026-03-30", date_end: "2026-09-21" },
    { id: 4, type: "examen", title: "Examens CCP1", date_start: "2026-09-22", date_end: "2026-09-25" },
    { id: 5, type: "formation", title: "Formation CCP2", date_start: "2026-09-28", date_end: "2026-12-07" },
    { id: 6, type: "stage", title: "Stage entreprise CCP2 01", date_start: "2026-10-12", date_end: "2026-10-16" },
    { id: 7, type: "stage", title: "Stage entreprise CCP2 02", date_start: "2026-10-26", date_end: "2026-11-06" },
    { id: 8, type: "stage", title: "Stage entreprise CCP2 03", date_start: "2026-11-16", date_end: "2026-11-20" },
    { id: 9, type: "examen", title: "Examens CCP2", date_start: "2026-12-08", date_end: "2026-12-11" },
  ],
```

et dans `SCENARIOS_MODULES`, après la ligne `enfant: …` :

```js
  // CCP2 seul ouvert (avec l'ensemble de départ) : onglet CCP2 sans CCP1.
  ccp2: { v: 1, depuis: T0_MODULES, ouverts: { ...DEPART_MODULES, ccp2: T1_MODULES } },
```

Puis `node _harness_build.mjs`.

- [ ] **Étape 5 : contrôles au banc**

`http://localhost:8031/_harness.html#/ccp2`, 1280 x 800, par `javascript_tool` et `read_page` :
1. Console sans erreur ; 8 onglets dans `#tabs`, dans l'ordre Accueil, Priorités, Planning,
   Calendrier, CCP1, CCP2, Ressources, Paramètres.
2. Carte « L'épreuve en bref » : 4 points et 3 liens.
3. « Tes dates » : 5 lignes (Formation CCP2, trois stages, Examens CCP2) ; avec `?date=2026-10-20`,
   la ligne du premier stage porte « passé ».
4. 8 cartes `details.ccp2-etape`, toutes repliées au premier passage. Ouvrir l'étape 3, recharger :
   l'étape 3 est rouverte. La refermer, recharger : tout est replié.
5. Étape 3 : le lien « Les cours des 57 thèmes » existe (fondateur) ; avec
   `?role=stagiaire&modules=ccp2`, il disparaît (Cours fermé) et l'onglet CCP1 aussi.
6. Étape 8, clic sur « Ton dossier professionnel » : Mon espace s'ouvre sur le sous-onglet
   Dossier pro.
7. `?role=stagiaire&modules=depart` : pas d'onglet CCP2 ; `location.hash = "#/ccp2"` affiche le
   message et ramène sur Mon espace.

- [ ] **Étape 6 : tests et commit**

Commandes : `node tests/modules.test.mjs && node tests/ccp-rules.test.mjs`

```bash
git add js/views/ccp2.js js/main.js js/views/home.js js/icons.js css/style.css
git commit -m "CCP2 : onglet du parcours guide en 8 etapes, dates du Calendrier"
```

---

### Tâche 5 : nouveautés, assistant, notes de projet

**Fichiers :**
- Modifier : `js/nouveautes-data.js` (deux entrées en tête du tableau)
- Modifier : `supabase/functions/chatbot/aide.mjs`
- Modifier : `PROJECT_NOTES.md`

- [ ] **Étape 1 : deux nouveautés**

En tête du tableau `NOUVEAUTES` :

```js
  {
    id: "2026-10-03-onglet-ccp1",
    date: "2026-10-03",
    pour: "tous",
    module: "themes",
    titre: "Thèmes, Notes et EPCF réunis dans l'onglet CCP1",
    resume: "Les thèmes avec leurs cours et leurs QCM, le tableau des notes, l'EPCF, le livret "
          + "EPCF et le dossier professionnel sont maintenant rangés dans un seul onglet, CCP1. "
          + "Sur téléphone, c'est l'icône marquée 1. Ton espace personnel ne change pas.",
    ou: { label: "CCP1", route: "ccp1" },
    guide: [
      "Touche l'onglet CCP1 (l'icône marquée 1 sur téléphone).",
      "Choisis Thèmes, Notes, EPCF, Livret EPCF ou Dossier pro dans la barre juste en dessous.",
    ],
  },
  {
    id: "2026-10-03-parcours-ccp2",
    date: "2026-10-03",
    pour: "tous",
    module: "ccp2",
    titre: "Nouvel onglet CCP2 : ton parcours en 8 étapes",
    resume: "Du choix du commanditaire au jour de l'épreuve, chaque étape dit ce que le jury "
          + "regarde, comment t'y prendre et ce qu'il faut garder pour ton dossier. Tes dates "
          + "de stage et d'examen sont rappelées en haut de la page.",
    ou: { label: "CCP2", route: "ccp2" },
  },
```

- [ ] **Étape 2 : guide de l'assistant (`supabase/functions/chatbot/aide.mjs`)**

Remplacer les deux lignes qui commencent par `- themes :` et `- notes :` par :

```
- ccp1 (CCP1, « Former des apprenants conducteurs ») : onglet à sous-onglets. Thèmes : les 57 thèmes officiels, chacun avec son cours complet (bouton de lecture, temps de lecture estimé) et ses QCM : entraînement (questions ratées reproposées en premier) et examen blanc (tirage aléatoire, seuil de réussite) ; les formateurs y gèrent aussi l'éditeur de cours, l'éditeur de QCM et les signalements de questions. Notes : évaluations sur 20 par thème, moyennes et synthèse de la classe. EPCF : examens blancs du CCP1 (consultation des grilles, vue classe). Livret EPCF et Dossier pro : documents officiels remplissables. Les anciennes adresses « themes » et « notes » mènent ici.
- ccp2 (CCP2, « Sensibiliser les usagers de la route ») : parcours guidé en 8 étapes (trouver un commanditaire, analyser la demande, construire l'action, animer la séance, analyser sa pratique, rédiger le dossier de 40 000 à 45 000 caractères, préparer l'oral, le jour de l'épreuve). Chaque étape donne ce que le jury regarde, des conseils, ce qu'il faut garder pour le dossier et des liens utiles ; les dates de stage et d'examen CCP2 viennent du calendrier de la promo.
```

Contrôle : `node --test tests/chatbot-outils.test.mjs` (le corpus reste long et sans cadratin).

- [ ] **Étape 3 : `PROJECT_NOTES.md`**

Remplacer le titre `## Pages (9 onglets)` (suivi d'un tiret long et des mots « état actuel »,
qui partent avec lui) et le bloc de code qui liste ensuite les neuf pages (« Accueil · Tableau
de bord · … · Paramètres ») par :

```
## Pages (8 onglets) : état au 03/10/2026

```
Accueil · Priorités · Planning · Calendrier · CCP1 · CCP2 · Ressources · Paramètres
```

Mon espace (`mon-suivi`) et Nouveautés sont des pages sans onglet. CCP1 porte en sous-onglets
Thèmes, Notes, EPCF, Livret EPCF et Dossier pro (voir « Onglets CCP1 et CCP2 »). Les descriptions
ci-dessous datent de mai et juin : Thèmes et Notes y sont décrits comme des onglets.
```

Puis, juste avant `## Décisions UX importantes (à respecter)`, ajouter :

```markdown
## Onglets CCP1 et CCP2 (chantier D, octobre 2026)

Spec : `docs/superpowers/specs/2026-10-03-onglets-ccp-design.md` · plan :
`docs/superpowers/plans/2026-10-03-onglets-ccp.md`

- **Barre** : Thèmes et Notes quittent la barre, CCP1 et CCP2 y entrent (8 onglets, la barre tient
  sur un iPhone). Icônes chiffrées `ccp1`, `ccp2` (`js/icons.js`) : sur téléphone, seul le chiffre
  les distingue.
- **CCP1** (`js/views/ccp1.js`) : sous-onglets déclarés dans `SOUS_ONGLETS_CCP1`
  (`js/modules-data.js`), mémorisés sous `ecsr_ccp1_subtab`. Thèmes et Notes y sont rendus
  **embarqués** (`renderThemes` / `renderNotes` avec `{ embedded, isActive }`) : sans grand titre,
  et sans écrire dans un panneau qui n'est plus le leur. Notes n'a plus de sous-onglets.
- **CCP1 et les modules** : pas de module propre. `ONGLETS_REGROUPES.ccp1` liste ses parties ;
  `routeOuverte` (`js/modules.js`) l'ouvre dès qu'une l'est, un formateur voit le repère quand
  toutes sont fermées. Livret EPCF n'a plus Notes pour parent.
- **CCP2** (`js/views/ccp2.js`) : module `ccp2`. Texte versionné dans `js/ccp2-parcours-data.js`
  (critères du REAC mot pour mot, exigences du référentiel d'évaluation), dates tirées de
  `listAgendaEvents()` : événements dont le titre contient « CCP2 » (formation, stage, examen),
  seulement si le Calendrier est ouvert. Dernière étape ouverte : `ecsr_ccp2_etape`.
- **Anciennes adresses** : `#/themes` et `#/notes` passent la garde de leur module puis mènent au
  sous-onglet de CCP1 (`ANCIENNES_ROUTES`, `js/ccp-rules.js`) ; la dernière page mémorisée suit
  le même chemin.
- **Tests** : `node tests/modules.test.mjs`, `node tests/ccp-rules.test.mjs` (texte du parcours
  compris : forme, liens, aucun cadratin, jamais « prof »).
- **Convention pour les formateurs** : le titre d'un stage ou d'un examen du CCP2 contient
  « CCP2 », sinon il n'apparaît pas dans le parcours.
- **Assistant** : `aide.mjs` décrit CCP1 et CCP2 ; il faut redéployer la fonction `chatbot` pour
  que la bulle le sache.
```

- [ ] **Étape 4 : tests et commit**

Commandes : `node tests/modules.test.mjs && node tests/nouveautes.test.mjs && node --test tests/chatbot-outils.test.mjs`

```bash
git add js/nouveautes-data.js supabase/functions/chatbot/aide.mjs PROJECT_NOTES.md
git commit -m "CCP : nouveautes, guide de l'assistant et notes de projet"
```

---

### Tâche 6 : vérification finale

**Fichiers :** aucun nouveau ; corrections éventuelles dans les fichiers des tâches 1 à 5.

- [ ] **Étape 1 : tous les tests node**

```bash
cd C:/Users/watch/Dev/ecsr-promo-onglets-ccp && for t in tests/*.test.mjs; do node "$t" > /dev/null 2>&1 || node --test "$t" > /dev/null 2>&1 || echo "ECHEC $t"; done; echo fin
```

Attendu : seulement `fin`.

- [ ] **Étape 2 : aucun tiret cadratin dans ce que la branche a touché**

```bash
git diff --name-only main...HEAD | xargs grep -n $'\xe2\x80\x94' | grep -v "^PROJECT_NOTES.md"
```

Attendu : aucune ligne (PROJECT_NOTES.md en portait déjà avant la branche : vérifier à part que
`git diff main...HEAD -- PROJECT_NOTES.md | grep '^+' | grep $'\xe2\x80\x94'` est vide).

- [ ] **Étape 3 : iPhone (375 px) au banc**

`resize_window` 375 x 812, puis par `javascript_tool` :
1. `#tabs` : `scrollWidth <= clientWidth` (la barre ne défile pas) ; 8 onglets visibles.
2. `#/ccp1` : les cinq sous-onglets tiennent ; noter le nombre de lignes de la barre
   (positions `offsetTop` distinctes) : une ligne visée, deux acceptables.
3. `#/ccp2` : étape 6 ouverte, `document.documentElement.scrollWidth <= 375` (rien ne déborde).
4. Accueil : tuiles CCP1 et CCP2 présentes.
Revenir ensuite au préréglage `desktop`.

- [ ] **Étape 4 : formateur et stagiaire**

`?role=prof` : CCP1 et CCP2 présents quel que soit le scénario de modules, repère « Masqué aux
stagiaires » sur CCP1 avec `?modules=depart` (toutes ses parties fermées), et sur CCP2 avec
`?modules=themes`. `?role=stagiaire` sans scénario (promo libre, comme mars) : tout est visible.

- [ ] **Étape 5 : bilan pour Timy**

Lister ce qui est fait, ce qui reste (relecture des points « à valider », fusion, push,
redéploiement de l'assistant, rapatriement des événements du banc dans `TP_ECSR_App`) et les
preuves. Pas de fusion ni de push.
