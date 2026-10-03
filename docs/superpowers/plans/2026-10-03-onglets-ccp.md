# Barre simple, onglet CCP2 et espaces personnels : plan d'implémentation (lot 1)

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé)
> ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases (`- [ ]`).
> Ce plan remplace celui de la nuit du 02 au 03/10 (onglet CCP1), resté dans l'historique git.

**But :** une barre simple (Accueil, Planning, Calendrier, Cours, Notes, CCP2 quand il s'ouvre,
Ressources, Paramètres), Priorités rangé dans le Planning, Thèmes renommé Cours avec deux
sous-onglets, livret et dossier du stagiaire rangés dans Mon espace, parcours CCP2 conservé.

**Architecture :** on repart des fichiers de `main` (chantier B) pour tout ce que la nuit avait
modifié autour de l'onglet CCP1, et on garde les fichiers du parcours CCP2 (`js/views/ccp2.js`,
`js/ccp2-parcours-data.js`, `js/ccp-rules.js`). Aucune table, aucune migration.

**Pile :** HTML, CSS et JavaScript sans framework (modules ES), tests `node`, banc d'essai
`_harness.html` (client Supabase factice par import map).

**Spec :** `docs/superpowers/specs/2026-10-03-onglets-ccp-design.md` (version 2).

## Contraintes globales

- Aucun tiret cadratin (U+2014) : contrôle `grep -c $'\xe2\x80\x94' <fichiers>` ; dans un test,
  `String.fromCharCode(0x2014)` (les outils d'écriture transforment l'échappement en caractère).
- « Formateur », jamais « Prof » ; textes pour stagiaires au tutoiement, sans jargon.
- Imports relatifs en `?v=20261002b` sur la branche (jeton uniforme).
- Nouveau CSS en fin de `css/style.css`.
- Banc : après `node _harness_build.mjs`, ouvrir `_harness.html?cb=<neuf>` et vérifier le jeton.
- Pas de fusion ni de push dans ce plan.

---

### Tâche 1 : retour à la base de B et catalogue des modules

**Fichiers :** remis à leur version de `main` puis modifiés : `js/modules-data.js`,
`js/nouveautes.js`, `tests/modules.test.mjs`. Remis à leur version de `main` sans modification
ici (repris aux tâches suivantes) : `js/modules.js`, `js/modules-etat.js`,
`js/views/modules-reglage.js`, `js/views/notes.js`, `js/views/themes.js`, `js/main.js`,
`js/views/home.js`, `js/icons.js`, `css/style.css`, `js/nouveautes-data.js`,
`supabase/functions/chatbot/aide.mjs`, `_preview_modules.html`. Supprimé : `js/views/ccp1.js`.

- [ ] **Étape 1 : retour à la base**

```bash
cd C:/Users/watch/Dev/ecsr-promo-onglets-ccp
git checkout main -- js/modules-data.js js/modules.js js/modules-etat.js js/views/modules-reglage.js \
  js/views/notes.js js/views/themes.js js/main.js js/views/home.js js/icons.js css/style.css \
  js/nouveautes.js js/nouveautes-data.js tests/modules.test.mjs supabase/functions/chatbot/aide.mjs \
  _preview_modules.html
git rm -q js/views/ccp1.js
```

- [ ] **Étape 2 : tests qui échouent** (`tests/modules.test.mjs`)

Juste avant le commentaire `// 12. Nouveautés déjà écrites`, insérer :

```js
// 11 bis. Chantier D : barre simple et onglet CCP2
eq(MODULE_DE_ROUTE.ccp2, "ccp2", "CCP2 : route gouvernée par son module");
eq(MODULES.find((m) => m.cle === "ccp2")?.groupe, "CCP2", "CCP2 : son groupe dans le réglage");
eq(MODULES.find((m) => m.cle === "livret").parent, undefined, "livret : plus rangé dans Notes");
eq(MODULE_DE_SOUS_ONGLET["mon-suivi"].livret, "livret", "livret : sous-onglet de Mon espace");
eq(STORAGE_SOUS_ONGLET.themes, "themes.subtab", "Cours : sous-onglet mémorisé joignable");
eq(MODULES.find((m) => m.cle === "themes").nom, "Cours", "Thèmes s'affiche Cours");
const nomsAffiches = MODULES.map((m) => m.nom);
eq(new Set(nomsAffiches).size, nomsAffiches.length, "noms affichés uniques dans le réglage");
```

Commande : `node tests/modules.test.mjs` ; attendu : échec sur « CCP2 : route gouvernée ».

- [ ] **Étape 3 : catalogue** (`js/modules-data.js`)

1. `GROUPES` devient
   `["Démarrage", "Suivi de la formation", "CCP1", "Dossier professionnel", "CCP2", "Outils"]`.
2. `MODULE_DE_ROUTE` gagne la ligne `ccp2: "ccp2",`.
3. `MODULE_DE_SOUS_ONGLET["mon-suivi"]` devient `{ evolution: "notes", epcf: "epcf", livret: "livret", dp: "dp" }`.
4. Entrée `priorites` : `explication: "Qui doit passer en priorité, en salle et en voiture : bouton en haut du Planning."`,
   `resume` : « Un bouton en haut du Planning montre qui doit passer en priorité, au tableau comme
   en voiture, pour que chacun ait autant de passages que les autres. »,
   `ou: { label: "Planning, bouton Priorités", route: "dashboard" }`.
5. Entrée `themes` : `nom: "Cours"`, `explication: "Onglet Cours : thèmes, compétences et progression de la classe."`,
   annonce `titre: "L'onglet Cours est ouvert"`, `resume: "Les thèmes et les compétences de la formation, avec ceux déjà traités en classe et leur date."`,
   `ou: { label: "Cours", route: "themes" }`.
6. Entrée `cours` : `nom: "Lecture des cours"`, `accord: "fs"`, `resume` se termine par
   « Dans l'onglet Cours, clique sur le titre d'un thème ou sur son bouton Cours. »,
   `ou: { label: "Cours, colonne Cours", route: "themes" }`.
7. Entrée `qcm` : `ou: { label: "Cours, colonne QCM", route: "themes" }`.
8. Entrée `livret` : supprimer `parent: "notes"` ;
   `explication: "Livret officiel EPCF : celui du stagiaire dans Mon espace, la saisie des formateurs dans Notes."` ;
   `resume: "Ton livret d'évaluation officiel se consulte dans ton espace personnel. Pense à y indiquer ta date de naissance : elle est reportée automatiquement sur le livret."` ;
   `ou: { label: "Mon espace personnel, sous-onglet Livret EPCF", route: "mon-suivi", sousOnglet: "livret" }`.
9. Entrée `dp` : `explication: "Dossier professionnel : celui du stagiaire dans Mon espace, la relecture des formateurs dans Notes."`.
10. Avant l'entrée `assistant`, ajouter :

```js
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
```

- [ ] **Étape 4 : sous-onglets joignables** (`js/nouveautes.js`)

`STORAGE_SOUS_ONGLET` gagne la ligne `themes: "themes.subtab",`.

- [ ] **Étape 5 : tests verts, commit**

`node tests/modules.test.mjs && node tests/nouveautes.test.mjs` ; attendu : « assertions OK ».

```bash
git add -A js tests css supabase _preview_modules.html
git commit -m "Lot 1 : retour a la base de B, catalogue (Cours, CCP2, livret dans Mon espace)"
```

---

### Tâche 2 : règles CCP sans anciennes adresses

**Fichiers :** `js/ccp-rules.js`, `js/ccp2-parcours-data.js`, `tests/ccp-rules.test.mjs`.

- [ ] **Étape 1 : test** (`tests/ccp-rules.test.mjs`)

Supprimer la section « 1. Anciennes adresses » et l'import de `ANCIENNES_ROUTES`,
`ancienneRoute`, `ONGLETS_REGROUPES`, `MODULE_DE_SOUS_ONGLET`. Dans `verifierLien`, la route
d'un lien interne se vérifie par
`ok(l.route in MODULE_DE_ROUTE || ROUTES_SOCLE.includes(l.route), ou + " : route connue");`.

- [ ] **Étape 2 : règles** (`js/ccp-rules.js`)

Supprimer `contient`, `ANCIENNES_ROUTES` et `ancienneRoute` (et leur commentaire). Restent
`insecables`, `TYPES_DATES_CCP2`, `datesCcp2`.

- [ ] **Étape 3 : lien de l'étape 3 du parcours** (`js/ccp2-parcours-data.js`)

`{ label: "Les cours des 57 thèmes, pour vérifier une règle ou un chiffre", route: "themes", sousOnglet: "themes", module: "cours" }`.

- [ ] **Étape 4 : tests verts, commit**

`node tests/ccp-rules.test.mjs` ; attendu : « assertions OK ».

```bash
git add js/ccp-rules.js js/ccp2-parcours-data.js tests/ccp-rules.test.mjs
git commit -m "CCP : regles sans anciennes adresses, lien du parcours vers Cours"
```

---

### Tâche 3 : barre, tuiles, icônes, parcours CCP2 branché

**Fichiers :** `js/main.js`, `js/views/home.js`, `js/icons.js`, `css/style.css`,
`_preview_modules.html`. Banc : `_harness_supabase.js` du worktree (déjà enrichi la nuit :
événements CCP2, scénario `ccp2`).

- [ ] **Étape 1 : icônes** (`js/icons.js`, sous l'icône `edu`)

```js
  // Cours : livre ouvert.
  book:       () => svg('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  // CCP2 : carré marqué 2 ; sur téléphone la barre n'affiche que les icônes.
  ccp2:       () => svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9.25 9.75a2.75 2.75 0 0 1 5.5 0c0 1.6-1.4 2.6-2.75 3.8L9.25 16.5h5.5"/>'),
```

- [ ] **Étape 2 : barre et routes** (`js/main.js`)

Import : `import { renderCcp2 } from "./views/ccp2.js?v=20261002b";`. `TABS` devient :

```js
const TABS = [
  { route: "home",       label: "Accueil",         icon: "info"      },
  // L'espace perso n'a pas d'onglet : on y accède par l'ouverture de l'app, le logo et
  // la pastille à son nom. Priorités non plus : bouton en haut du Planning (la route
  // dashboard reste, et l'onglet Planning reste allumé dessus, voir ONGLET_POUR_ROUTE).
  { route: "planning",   label: "Planning",        icon: "calendar"  },
  { route: "calendrier", label: "Calendrier",      icon: "clock"     },
  // « Cours » garde la route themes : favoris et liens existants restent valides.
  { route: "themes",     label: "Cours",           icon: "book"      },
  { route: "notes",      label: "Notes",           icon: "edu"       },
  // CCP2 apparaît quand un formateur ouvre le module pour la promo (module ccp2).
  { route: "ccp2",       label: "CCP2",            icon: "ccp2"      },
  { route: "ressources", label: "Ressources",      icon: "signpost"  },
  { route: "config",     label: "Paramètres",      icon: "settings"  },
];
```

`routes` gagne `ccp2: renderCcp2,` ; `ONGLET_POUR_ROUTE` devient
`{ nouveautes: "home", dashboard: "planning" }` (commentaire : Priorités se consulte depuis le
Planning, dont l'onglet reste allumé).

- [ ] **Étape 3 : tuiles d'Accueil** (`js/views/home.js`)

```js
  const tiles = [
    { route: "planning",   icon: "calendar",     title: "Planning",         desc: "Cette semaine, créneaux & tirages" },
    { route: "calendrier", icon: "clock",        title: "Calendrier",       desc: "Examens, stages, dates clés" },
    { route: "themes",     icon: "book",         title: "Cours",            desc: "Thèmes, compétences & QCM" },
    { route: "notes",      icon: "edu",          title: "Notes",            desc: "Matrice & synthèse classe" },
    { route: "ccp2",       icon: "ccp2",         title: "CCP2",             desc: "Ton parcours en 8 étapes" },
    { route: "ressources", icon: "signpost",     title: "Ressources",       desc: "Contacts & liens utiles" },
  ];
```

- [ ] **Étape 4 : styles** (fin de `css/style.css`)

Ajouter le titre `/* ===== Chantier D : barre simple et parcours CCP2 ===== */`, la règle
`.dash-retour { margin: 0 0 0.6rem; }`, puis le bloc « Parcours CCP2 » de la nuit, repris tel quel
de `git show 40189de:css/style.css` (de `/* Parcours CCP2 */` à la fin du fichier, dates empilées
sur téléphone comprises).

- [ ] **Étape 5 : banc versionné de B** (`_preview_modules.html`)

La liste `ONGLETS` recopiée de `TABS` devient : home/Accueil/info, planning/Planning/calendar,
calendrier/Calendrier/clock, themes/Cours/book, notes/Notes/edu, ccp2/CCP2/ccp2,
ressources/Ressources/signpost, config/Paramètres/settings.

- [ ] **Étape 6 : banc**

`node _harness_build.mjs`, puis `_harness.html?cb=<neuf>` en 1280 x 800 : 8 onglets dans l'ordre
ci-dessus, aucun onglet Priorités ; `#/ccp2` affiche le parcours (épreuve, 5 dates, 8 étapes) ;
avec `?role=stagiaire&modules=themes`, 7 onglets sans CCP2 ; tuiles conformes ; console sans erreur.

- [ ] **Étape 7 : commit**

```bash
git add js/main.js js/views/home.js js/icons.js css/style.css _preview_modules.html
git commit -m "Barre simple : Cours, onglet CCP2 qui apparait, plus d'onglet Priorites"
```

---

### Tâche 4 : Priorités dans le Planning

**Fichiers :** `js/views/planning.js`, `js/views/dashboard.js`.

- [ ] **Étape 1 : bouton** (`js/views/planning.js`)

Import : `import { routeVisible, routeMasquee, repereMasque } from "../modules-etat.js?v=20261002b";`.
Dans l'en-tête (`view-header`), après le bloc `view-header-text`, ajouter en second enfant :

```js
    // Priorités de passage : rangées dans le Planning, plus d'onglet. Visibles des
    // formateurs, et des stagiaires si le module est ouvert pour leur promo ; repère
    // « Masqué aux stagiaires » chez un formateur quand il est fermé.
    routeVisible("dashboard")
      ? repereMasque(el("button", { class: "btn small", type: "button",
          title: "Qui doit passer en priorité, au tableau et en voiture",
          onClick: () => { location.hash = "#/dashboard"; } },
          icon.target(), "Priorités"), routeMasquee("dashboard"))
      : null,
```

- [ ] **Étape 2 : retour** (`js/views/dashboard.js`)

Juste avant l'ajout du `view-header` :

```js
  // Priorités se consulte depuis le Planning : retour en un geste.
  container.appendChild(el("button", { class: "btn small ghost dash-retour", type: "button",
    onClick: () => { location.hash = "#/planning"; } }, icon.chevronLeft(), "Planning"));
```

- [ ] **Étape 3 : banc** : bouton présent (fondateur), clic : `#/dashboard`, onglet Planning
  allumé ; « Planning » ramène ; `?role=stagiaire&modules=depart` : pas de bouton ;
  `?role=prof&modules=depart` : bouton avec le repère.

- [ ] **Étape 4 : commit**

```bash
git add js/views/planning.js js/views/dashboard.js
git commit -m "Priorites : bouton en haut du Planning, retour au Planning"
```

---

### Tâche 5 : Cours, sous-onglets Thèmes et Compétences

**Fichiers :** `js/views/themes.js`. Banc : notions de test dans `_harness_supabase.js`.

- [ ] **Étape 1 : ensembles** : remplacer `let activeFamille = "all";  // "all" ou clé de famille` par :

```js
// Sous-onglets de Cours : chacun montre une partie des familles. Thèmes = les
// connaissances (57 thèmes officiels, QCM transversaux) ; Compétences = le métier
// (compétences de l'enseignant, de conduite, notions pédagogiques, famille filet).
const ENSEMBLES = {
  themes: ["themes-officiels", "qcm-transversaux"],
  competences: ["competences-formateur", "competences-conduite", "notions-pedagogiques", "autres"],
};
let ensembleActif = "themes";
// Pastille active, propre à chaque sous-onglet : "all" ou clé de famille.
const familleActive = { themes: "all", competences: "all" };
// Ligne de progression de l'en-tête de Cours, au-dessus des sous-onglets.
let ligneProgression = null;

function texteProgression() {
  const tp = familleStats(themes.filter((t) => t.type === "theme"));
  return tp.fait + " / " + tp.total + " thèmes officiels terminés";
}
function majProgression() {
  if (ligneProgression) ligneProgression.textContent = texteProgression();
}
```

(`familleStats` est une déclaration de fonction : utilisable avant sa ligne.)

- [ ] **Étape 2 : `refreshStatsInPlace`** : ses trois dernières lignes (calcul `tp`, recherche de
  `.view-header .eyebrow`, écriture) deviennent `majProgression();`.

- [ ] **Étape 3 : `rerender`** :
  1. `famillesData` part des familles du sous-onglet :
     `const cles = ENSEMBLES[ensembleActif] || ENSEMBLES.themes;` puis
     `FAMILLES.filter((f) => cles.includes(f.key)).map(...)` (même corps qu'aujourd'hui) ;
  2. si `familleActive[ensembleActif]` n'est ni `"all"` ni une clé de `famillesData`, la remettre
     à `"all"` ;
  3. supprimer le calcul `themesOfficiels` / `totalProgress` et le bloc `view-header` (l'en-tête
     passe dans `renderThemes`) ; appeler `majProgression()` ;
  4. partout, `activeFamille` devient `familleActive[ensembleActif]` ;
  5. la pastille « Tout » compte `famillesData.reduce((n, f) => n + f.items.length, 0)` ;
  6. la barre de pastilles n'est ajoutée que si `famillesData.length > 1` ;
  7. message vide : « Rien ne correspond aux filtres. ».

- [ ] **Étape 4 : `renderThemes`** : après le chargement et `clear(container)`, remplacer la suite par :

```js
  // En-tête de Cours, au-dessus des sous-onglets. La ligne de progression est tenue à
  // jour par refreshStatsInPlace (statut basculé, date corrigée).
  ligneProgression = el("p", { class: "eyebrow" }, texteProgression());
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      ligneProgression,
      el("h2", {}, "Cours"),
      el("p", { class: "subtitle" }, "Les thèmes et les compétences de la formation, avec leurs cours et leurs QCM."),
    ),
    isAdmin() ? el("button", { class: "btn primary", onClick: () => openAddNotionModal(() => reload(lastContainer)) },
      icon.plus(), "Ajouter une notion") : null,
  ));

  // Thèmes et Compétences pour tous ; la console des signalements pour les formateurs
  // seulement (la RLS ne suffit pas : elle rend à un élève SES propres signalements).
  // lastContainer devient le PANNEAU : c'est lui que reload() doit repeindre.
  const liste = (cle) => (p, ctx) => {
    lastContainer = p;
    ensembleActif = cle;
    themesActif = ctx?.isActive || (() => true);
    rerender(p);
  };
  const onglets = [
    { key: "themes", label: "Thèmes", render: liste("themes") },
    { key: "competences", label: "Compétences", render: liste("competences") },
  ];
  if (canManageExam()) {
    onglets.push({ key: "signalements", label: "⚑ Signalements",
      render: (p, ctx) => { renderConsoleSignalements(p, { themes, onOuvrirEditeur: ouvrirDepuisConsole, isActive: ctx?.isActive }); } });
  }
  container.appendChild(renderSubTabs(onglets, { storageKey: "themes.subtab" }));
```

Si `rerender` n'utilise plus `admin`, supprimer `const admin = isAdmin();` de `rerender`.

- [ ] **Étape 5 : banc** : ajouter aux `themes` du `_harness_supabase.js` du worktree quatre
  notions (une par catégorie : « QCM transversal », « Compétence formateur (TP ECSR) »,
  « Compétence conduite (REMC) », « Notion pédagogique »). Contrôles : sous-onglets Thèmes,
  Compétences (et Signalements pour le fondateur) ; Thèmes : pastilles Tout, Thèmes,
  Transversaux ; Compétences : pastilles des trois familles ; recherche et statut ; bascule de
  statut qui met à jour la ligne de progression ; retour d'un QCM (`qcm-attempt-saved`) sans
  écrire dans un autre sous-onglet.

- [ ] **Étape 6 : commit**

```bash
git add js/views/themes.js
git commit -m "Cours : sous-onglets Themes et Competences, en-tete commun"
```

---

### Tâche 6 : Notes pour la classe, livret dans Mon espace

**Fichiers :** `js/views/notes.js`, `js/views/mon-suivi.js`, `js/views/epcf-livret.js`.

- [ ] **Étape 1 : livret d'un stagiaire précis** (`js/views/epcf-livret.js`)

Dans `renderEpcfLivret`, juste après le bloc `if (!formateur) { … }`, insérer :

```js
  // Mon espace : le livret du stagiaire affiché, ouvert directement en saisie. Un
  // stagiaire ne passe jamais ici (bloc ci-dessus) : il ne voit que son propre espace.
  if (opts.stagiaireId != null) {
    const id = Number(opts.stagiaireId);
    const [stagiairesData, profsData] = await Promise.all([listStagiaires(), listProfs()]);
    let full = null;
    try { full = await getEpcfLivret(id); } catch (e) { console.error(e); }
    if (opts.isActive && !opts.isActive()) return;
    profNames = (profsData || []).map((p) => p.nom).filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "fr"));
    const s = stagiairesData.find((x) => x.id === id);
    clear(container);
    if (!s) { container.appendChild(el("p", { class: "muted" }, "Stagiaire introuvable.")); return; }
    showDoc(container, s, full, { readOnly: false });
    return;
  }
```

- [ ] **Étape 2 : Mon espace** (`js/views/mon-suivi.js`)

Import : `import { renderEpcfLivret } from "./epcf-livret.js?v=20261002b";`. Dans les
sous-onglets, entre `evolution` et `dp` :

```js
      // Le livret du stagiaire affiché : le sien en lecture pour un stagiaire, en saisie
      // pour un formateur qui regarde l'espace d'un stagiaire.
      { key: "livret", label: "Livret EPCF", module: "livret", render: (p, ctx) => {
          renderEpcfLivret(p, { stagiaireId: id, embedded: true, isActive: ctx && ctx.isActive })
            .catch((e) => {
              console.error(e);
              if (!ctx || ctx.isActive()) {
                clear(p);
                p.appendChild(el("p", { class: "muted" }, "Erreur de chargement du livret EPCF. Reviens sur l'onglet pour réessayer."));
              }
            });
        } },
```

- [ ] **Étape 3 : Notes** (`js/views/notes.js`)

Import `isProf` depuis `auth-admin.js`. Les sous-onglets `livret` et `dp` ne sont donnés qu'aux
formateurs : `...(formateur ? [ <entrée livret>, <entrée dp> ] : [])`, avec
`const formateur = isAdmin() || isProf();`. Commentaire : « Livret EPCF et Dossier pro sont les
outils des formateurs ; le stagiaire retrouve les siens dans Mon espace. »

- [ ] **Étape 4 : banc** : stagiaire : Notes = Matrice, EPCF ; Mon espace = cinq sous-onglets,
  livret en lecture (ou message « pas encore créé »). Fondateur : Notes = quatre sous-onglets ;
  Mon espace d'un autre élève : livret en saisie à son nom.

- [ ] **Étape 5 : commit**

```bash
git add js/views/notes.js js/views/mon-suivi.js js/views/epcf-livret.js
git commit -m "Notes pour la classe ; livret EPCF du stagiaire dans Mon espace"
```

---

### Tâche 7 : nouveautés, assistant, notes de projet

**Fichiers :** `js/nouveautes-data.js`, `supabase/functions/chatbot/aide.mjs`, `PROJECT_NOTES.md`.

- [ ] **Étape 1 : nouveautés** : en tête de `NOUVEAUTES`, trois entrées datées du 2026-10-03 :
  `2026-10-03-barre-simple` (tous, module `themes`, « Une barre d'onglets plus simple »),
  `2026-10-03-livret-espace-stagiaire` (formateurs, module `livret`),
  `2026-10-03-parcours-ccp2` (tous, module `ccp2`, texte de la nuit). Liens « Où le trouver »
  des anciennes entrées : « Thèmes » devient « Cours », « Thèmes, colonne QCM » devient
  « Cours, colonne QCM », « Thèmes, badge Cours » devient « Cours, colonne Cours », la console
  devient `{ label: "Cours, sous-onglet Signalements", route: "themes", sousOnglet: "signalements" }`,
  le livret devient `{ label: "Mon espace personnel, sous-onglet Livret EPCF", route: "mon-suivi", sousOnglet: "livret" }`,
  « Priorités, Historique des passages » devient « Planning, bouton Priorités ».
- [ ] **Étape 2 : assistant** : lignes `dashboard`, `themes`, `notes`, `mon-suivi` à jour, ligne
  `ccp2` ajoutée, « cible = Priorités » retiré des boutons globaux. `node --test tests/chatbot-outils.test.mjs`.
- [ ] **Étape 3 : notes de projet** : liste des pages et section du chantier D réécrites.
- [ ] **Étape 4 : tests, commit**

```bash
node tests/modules.test.mjs && node tests/nouveautes.test.mjs
git add js/nouveautes-data.js supabase/functions/chatbot/aide.mjs PROJECT_NOTES.md
git commit -m "Lot 1 : nouveautes, guide de l'assistant et notes de projet"
```

---

### Tâche 8 : vérification finale

- [ ] Tous les tests node verts ; aucun tiret cadratin ajouté (`git diff main...HEAD | grep '^+' | grep -c $'\xe2\x80\x94'` vaut 0).
- [ ] Banc 1280 x 800 et iPhone 375 x 812 : barre sans défilement (8 onglets), sous-onglets de
  Cours et de Notes sur une ligne, CCP2 sans débordement, captures.
- [ ] Rôles et modules : formateur (repères), stagiaire promo libre (tout), promo réglée
  (`?modules=depart`, `themes`, `ccp2`).
- [ ] `git merge-tree --write-tree main onglets-ccp` sans conflit ; bilan pour Timy.
