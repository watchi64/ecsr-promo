# Lot C (notes et examens) : plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**But :** sur téléphone, saisir une note thème par thème sans risque d'erreur de ligne, remplacer les états vides
bruts par une phrase et une action, et ouvrir ou fermer l'examen d'un QCM depuis la liste des thèmes.

**Architecture :** les règles pures (choix des cibles, avancement, libellés, état vide, libellé d'ouverture d'un
examen) vivent dans deux modules testables sous Node (`js/notes-saisie-rules.js`, `js/qcm-exam-rules.js`).
L'écran « Saisir » est un module de vue à part (`js/views/notes-saisie.js`), qui reçoit de `notes.js` un contexte
(données et fonction d'enregistrement commune). `themes.js` sort l'ouverture et la fermeture d'un examen de la
fiche du QCM, pour les appeler aussi depuis la liste.

**Technique :** JavaScript sans cadriciel (modules ES, imports suffixés `?v=<jeton>`), tests `node --test`
(scripts `assert` sans `describe`), robot des parcours Python + Playwright, banc à faux client Supabase.

**Conception :** `docs/superpowers/specs/2026-11-09-lot-c-notes-examens-design.md`. L'exécutant lit les deux.

## Contraintes globales

- Le tiret cadratin (U+2014) est interdit partout : code, textes, commits.
- On écrit « Formateur », jamais « Prof ».
- L'app tutoie tout le monde (« Tu peux aussi les saisir toi-même »).
- Aucun vrai nom ni aucune clé dans le dépôt. Les noms du banc (`_harness_supabase.js`) ne sont pas versionnés.
- Aucune écriture en base, aucune migration, aucune fonction déployée.
- **Téléphone :** cibles de 44 px, aucun défilement de côté hors de la matrice. **Ordinateur :** cibles de 24 px.
- **Couleurs et lisibilité :** contraste AA. Les couleurs passent par les variables du `:root` (garde
  `tests/habillage-jetons.test.mjs`). Aucune note en rouge.
- **Typographie :** Outfit (`var(--font)`), `font-variant-numeric: tabular-nums` pour les chiffres, ni Canela ni
  `--font-mono`.
- **Notifications :** `toast()` pour ce qui suit une action de la personne, `annoncer()` pour le reste.
- **Jeton d'import :** un nouvel import reprend le jeton `?v=` en cours dans le fichier qui importe. Le crochet de
  commit change le jeton : ne jamais piper la sortie d'un `git commit`, écrire `git commit -F msg > journal.txt 2>&1`.
- **Ce dossier :** tout se fait dans le worktree `C:/Users/watch/Dev/ecsr-promo-lot-c`, branche `lot-c`. Ne jamais
  toucher `C:/Users/watch/Dev/ECSR/TP_ECSR_App`, qui reste figé sur main.

## Points de vigilance

Ce que la conception implique sans qu'une tâche le teste de lui-même. Chaque ligne a son contrôle dans la tâche
qui porte le code.

1. **Note au mauvais stagiaire après un nouveau rendu** : si la liste se redessine pendant la saisie (statistiques
   rafraîchies), un champ ne doit jamais changer de stagiaire. Chaque champ porte `data-stagiaire-id`, et
   l'enregistrement lit cet identifiant, jamais un indice de ligne (Tâche 4, contrôle au banc).
2. **Virgule décimale et espaces** : « 14,5 », « 14 , 5 » et « 7 / 10 » sont acceptés comme dans la matrice
   (Tâche 1, tests de `parseNoteInput`).
3. **Quitter « Saisir » avec un champ en cours** : changer de sous-onglet ou revenir à la liste déclenche la perte
   de focus, donc l'enregistrement, avant le changement d'écran. Rien n'est perdu en silence (Tâche 4, contrôle au
   banc).
4. **Échéance d'examen à minuit ou sur un autre fuseau** : « Ouvert jusqu'à » se calcule en heure locale du
   navigateur, et une échéance le lendemain à 0 h 15 s'écrit « jusqu'au 10 nov., 0 h 15 » (Tâche 2, test).
5. **Panne au moment d'enregistrer** : la ligne d'état dit « Pas enregistrée : … Réessaie. », la valeur reste, et
   le compteur « n sur N » ne bouge pas (Tâche 4, panne simulée au banc avec `v.panne()`).

---

### Tâche 1 : règles pures de la saisie et des états vides

**Fichiers :**
- Créer : `js/notes-saisie-rules.js`
- Modifier : `js/views/notes.js`. Y retirer `parseNoteInput`, `MATRIX_SPECIAL_COLS`, `THEME_GROUPS`, puis les
  importer. `noteForStagiaireTheme` et `noteForStagiaireCompetence` deviennent des enveloppes de `derniereNote`.
- Test : `tests/notes-saisie-rules.test.mjs`

**Interfaces produites :**
- `parseNoteInput(raw) -> null | { error } | { note, note_max: 20, converted, original? }`. Déplacée telle quelle.
- `MATRIX_SPECIAL_COLS`, `THEME_GROUPS`. Déplacées telles quelles.
- `ciblesDeSaisie(themes) -> Cible[]`, où `Cible = { cle, type: "Compétence"|"Thème", competence_code?,
  theme_numero?, theme_titre?, numero: string, libelle: string }`.
  - Les 4 compétences viennent d'abord, puis les thèmes 1 à 57 par numéro. Le thème 47 est absorbé par la cible 46.
  - Libellés :
    - C1 : « Accueillir et sensibiliser à la sécurité routière » ;
    - C2 : « Concevoir et animer une action de formation » ;
    - REMC : « Référentiel pour l'éducation à une mobilité citoyenne » ;
    - MGDE (`numero` « GDE ») : « Matrice GDE : objectifs de la formation du conducteur » ;
    - thème : son titre ;
    - groupe : « <titre 46> et <titre 47> ».
- `filtrerCibles(cibles, recherche) -> Cible[]`. Cherche dans `numero` et `libelle`, sans tenir compte des accents
  ni des majuscules. Une recherche vide rend tout.
- `derniereNote(evaluations, stagiaireId, cible) -> evaluation | null`. Même règle que la matrice : la plus récente
  par `date_eval`.
- `avancement(evaluations, stagiaireIds, cible) -> { n, total }` et `libelleAvancement({ n, total }) -> string`.
- `origineNote(evaluation) -> string`. Donne « Examen QCM du 12 oct. » quand `qcm_attempt_id` est renseigné ou que
  `observation === "QCM examen"`, et « Saisie le 12 oct. » sinon.
- `etatVideNotes({ nbNotes, contexte }) -> null | { titre, phrase, actions: Array<"examen"|"saisir"|"entrainement"> }`.
  - `contexte` vaut `"equipe-matrice"`, `"equipe-saisir"`, `"classe-stagiaire"`, `"classe-formateur"` ou
    `"direction"`.
  - La fonction rend `null` dès que `nbNotes > 0`.

- [ ] **Étape 1 : écrire le test qui échoue**

Assertions (valeurs exactes de la conception) :

```js
assert.deepEqual(parseNoteInput("14,5"), { note: 14.5, note_max: 20, converted: false });
assert.deepEqual(parseNoteInput("7 / 10"), { note: 14, note_max: 20, converted: true, original: "7/10" });
assert.equal(parseNoteInput("  "), null);
assert.ok(parseNoteInput("21").error);
const c = ciblesDeSaisie([{ numero: 22, titre: "Feux du véhicule" }, { numero: 46, titre: "A" }, { numero: 47, titre: "B" }]);
assert.deepEqual(c.map((x) => x.cle), ["C1", "C2", "REMC", "MGDE", "T22", "T46"]);
assert.equal(c.find((x) => x.cle === "T46").libelle, "A et B");
assert.equal(c.find((x) => x.cle === "MGDE").numero, "GDE");
assert.deepEqual(filtrerCibles(c, "vehicule").map((x) => x.cle), ["T22"]);
assert.deepEqual(filtrerCibles(c, "22").map((x) => x.cle), ["T22"]);
// derniereNote : deux lignes, la plus récente gagne
const evs = [
  { id: 1, stagiaire_id: 3, type: "Thème", theme_numero: 22, note: 9, date_eval: "2026-10-01" },
  { id: 2, stagiaire_id: 3, type: "Thème", theme_numero: 22, note: 14, date_eval: "2026-10-12", qcm_attempt_id: 8 },
];
const t22 = c.find((x) => x.cle === "T22");
assert.equal(derniereNote(evs, 3, t22).id, 2);
assert.deepEqual(avancement(evs, [3, 4], t22), { n: 1, total: 2 });
assert.equal(libelleAvancement({ n: 0, total: 6 }), "aucune");
assert.equal(libelleAvancement({ n: 2, total: 6 }), "2 sur 6");
assert.equal(origineNote(evs[1]), "Examen QCM du 12 oct.");
assert.equal(origineNote(evs[0]), "Saisie le 1 oct.");
assert.equal(etatVideNotes({ nbNotes: 3, contexte: "equipe-matrice" }), null);
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "equipe-matrice" }).actions, ["examen", "saisir"]);
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "equipe-saisir" }).actions, ["examen"]);
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "classe-stagiaire" }), {
  titre: "Pas encore de notes",
  phrase: "Les notes de la classe apparaîtront après le premier examen.",
  actions: ["entrainement"] });
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "direction" }).actions, []);
assert.equal(etatVideNotes({ nbNotes: 0, contexte: "equipe-matrice" }).titre, "Aucune note pour l'instant");
assert.equal(etatVideNotes({ nbNotes: 0, contexte: "equipe-matrice" }).phrase,
  "Les notes arrivent ici toutes seules quand un stagiaire passe un examen QCM. Tu peux aussi les saisir toi-même.");
```

« classe-formateur » a les actions `["examen"]`. « direction » a la phrase « Les notes arrivent ici avec les
examens QCM. ».

- [ ] **Étape 2 : lancer le test.** `node --test tests/notes-saisie-rules.test.mjs`. Attendu : échec (module absent).
- [ ] **Étape 3 : écrire `js/notes-saisie-rules.js`**, puis brancher `notes.js` sur les éléments déplacés.
- [ ] **Étape 4 : lancer `node --test "tests/*.test.mjs"`.** Attendu : tout passe.
- [ ] **Étape 5 : commit** « Notes (lot C) : règles de la saisie et des états vides, testées ».

### Tâche 2 : libellés de l'examen (ouverture, résumé)

**Fichiers :** modifier `js/qcm-exam-rules.js`. Test : ajouter à `tests/qcm-exam-rules.test.mjs`.

**Interfaces produites :**
- `libelleOuverture(qcm, now = Date.now()) -> string`. Rend l'une de ces formes : « Examen fermé », « Ouvert
  jusqu'à 16 h 30 », « Ouvert jusqu'au 10 nov., 23 h 59 », « Ouvert sans limite ». Un examen est fermé quand
  `!examenDemarrable(qcm, now)`. Les minutes s'écrivent sur deux chiffres (« 9 h 05 »).
- `resumeExamen(qcm) -> string`, au format « 20 questions · 30 s par question · tirage au hasard ».
  - Le nombre vient de `nbQuestionsExamen`.
  - Sans valeur, le temps vaut 30 s.
  - Avec `exam_draw_mode === "manual"`, le résumé finit par « sélection manuelle ».

- [ ] **Étape 1 : test qui échoue** (dates locales `new Date(2026, 10, 9, h, m)`) :

```js
const now = new Date(2026, 10, 9, 14, 0).getTime();
const a = (d) => ({ published: true, exam_ferme_a: d ? d.toISOString() : null });
assert.equal(libelleOuverture({ published: false }, now), "Examen fermé");
assert.equal(libelleOuverture(a(new Date(2026, 10, 9, 13, 0)), now), "Examen fermé");
assert.equal(libelleOuverture(a(new Date(2026, 10, 9, 16, 30)), now), "Ouvert jusqu'à 16 h 30");
assert.equal(libelleOuverture(a(new Date(2026, 10, 10, 0, 15)), now), "Ouvert jusqu'au 10 nov., 0 h 15");
assert.equal(libelleOuverture(a(null), now), "Ouvert sans limite");
assert.equal(resumeExamen({ nb_questions: 20 }), "20 questions · 30 s par question · tirage au hasard");
assert.equal(resumeExamen({ exam_question_ids: [1, 2], exam_seconds_per_question: 45, exam_draw_mode: "manual" }),
  "2 questions · 45 s par question · sélection manuelle");
```

- [ ] **Étape 2 :** `node --test tests/qcm-exam-rules.test.mjs`. Attendu : échec.
- [ ] **Étape 3 : écrire les deux fonctions.**
- [ ] **Étape 4 :** `node --test "tests/*.test.mjs"`. Attendu : tout passe.
- [ ] **Étape 5 : commit** « Examens (lot C) : libellé d'ouverture et résumé, testés ».

### Tâche 3 : banc dans le worktree, et enregistrement commun

**Fichiers :**
- Copier depuis `C:/Users/watch/Dev/ECSR/TP_ECSR_App` : `_harness.html`, `_harness_supabase.js`,
  `_harness_build.mjs`, `_banc_centre_demo.js`, `_banc_emargement_demo.js`, `_banc_qualiopi_demo.js`. Ces fichiers
  sont ignorés par git : ne pas les ajouter.
- Ajouter une configuration `lot-c` dans le `.claude/launch.json` du worktree, sur un port libre, pour
  `preview_start`.
- Modifier : `js/views/notes.js`.

**Interfaces produites :** `enregistrerNote({ stagiaireId, cible, saisie, nom }) -> Promise<Resultat>` dans
`notes.js`. `Resultat` prend l'une de ces formes :

| Forme | Cas |
|---|---|
| `{ etat: "inchangee" }` | rien n'a changé |
| `{ etat: "enregistree", note, converti? }` | `converti` = « 7/10 » en cas de conversion |
| `{ etat: "effacee" }` | la note a été effacée |
| `{ etat: "gardee" }` | effacement refusé |
| `{ etat: "invalide", message }` | saisie refusée |
| `{ etat: "erreur", message }` | échec d'écriture |

Elle porte toute la logique de `save()` dans `inlineCellEdit` :
- la lecture par `derniereNote` ;
- la confirmation « Effacer la note de <nom> ? » (`confirm()`) ;
- `addEvaluation`, `updateEvaluation` (date `currentEvalDate`) et `deleteEvaluation` ;
- `recordUndo` ;
- la mise à jour du tableau `evaluations`.

Elle ne touche pas au DOM. Elle n'appelle pas `refreshAnalyticsInPlace` : c'est l'appelant qui le fait.

- [ ] **Étape 1 :** copier le banc, `node _harness_build.mjs`, ouvrir le banc avec
  `?date=2026-10-28&nav2=1&role=formateur&fondateur=0&cb=<neuf>`. Vérifier que le jeton chargé est celui du
  worktree.
- [ ] **Étape 2 :** écrire `enregistrerNote`. Réécrire `save()` de `inlineCellEdit` et l'enregistrement de
  `startInlineEditInModal` pour qu'ils l'appellent. Leur partie visuelle (cellule, popover, notifications) reste
  telle quelle.
- [ ] **Étape 3 : contrôle au banc** (ordinateur) : dans la matrice, saisir 14, modifier en 12, vider puis
  confirmer, et Ctrl+Z. La cellule et la synthèse suivent à chaque geste, sans erreur dans la console. Même chose
  dans la fiche d'un stagiaire.
- [ ] **Étape 4 :** `node --test "tests/*.test.mjs"`. Attendu : tout passe.
- [ ] **Étape 5 : commit** « Notes (lot C) : un seul enregistrement pour la matrice et la fiche ».

### Tâche 4 : sous-onglet « Saisir » et légende de la matrice (C1)

**Fichiers :**
- Créer : `js/views/notes-saisie.js`, et la section `/* Saisie des notes (lot C) */` de `css/style.css`.
- Modifier : `js/views/notes.js` (`rerender`), `js/subtabs.js`.
- Robot : `outils/parcours/equipe.py`, `docs/qualite/referentiel.md`.

**Interfaces :**
- Utilise la Tâche 1 (`ciblesDeSaisie`, `filtrerCibles`, `derniereNote`, `avancement`, `libelleAvancement`,
  `origineNote`, `etatVideNotes`) et la Tâche 3 (`enregistrerNote`).
- Produit :
  - `renderSaisie(panel, ctx)` dans `notes-saisie.js`. `ctx` vaut `{ stagiaires(): Stagiaire[]` (visibles, tri
    `"alpha"`) `, evaluations(): Evaluation[], themes: Theme[], nom(s): string, dateEval(): string,
    changerDate(iso): void, enregistrer: enregistrerNote, apresEnregistrement(): void }`. La Tâche 5 y ajoute
    `carteVide(contexte): Element|null`.
  - Dans `subtabs.js`, l'option `defautKey`. L'ordre devient `activeKey || stocké || defautKey || premier`. La
    fonction `wrap.activer(key)` est exposée.
- Repères pour le robot :
  - chaque cible porte `button.saisie-cible[data-cle]` ;
  - chaque champ porte `input.saisie-champ[data-stagiaire-id]` ;
  - chaque ligne d'état porte `.saisie-etat`.

- [ ] **Étape 1 : parcours robot qui échoue.** Dans `equipe.py` :
  `@parcours("saisir-une-note", "Saisir une note (thème par thème)", role="formateur", budget=3)`, en nouvelle
  navigation (même réglage que les parcours de fin de fichier). Déroulé :
  - `v.aller("Notes et examens")` ;
  - si « Saisir » n'est pas déjà affiché, toucher le sous-onglet « Saisir » ;
  - toucher `button.saisie-cible[data-cle="T22"]` ;
  - remplir le premier `input.saisie-champ` d'un stagiaire **sans note** sur le thème 22 dans le banc, avec `14` ;
  - `Tab` ;
  - `v.attendre(".saisie-etat:has-text('Enregistrée')", …)` ;
  - `v.but("note enregistrée")`.

  Lancer `python outils/robot_parcours.py --parcours saisir-une-note`. Attendu : échec (sous-onglet absent).
- [ ] **Étape 2 : écrire `renderSaisie`**, d'après le § 3 de la conception :
  - liste en deux parties, avec recherche ;
  - écran d'un thème : « Retour », titre, compteur, date et « Changer » ;
  - une ligne par stagiaire : champ de 48 px, texte de 20 px, `inputmode="decimal"`, `enterkeyhint="next"`,
    `aria-label` « Note de <nom> sur 20 » ;
  - Entrée passe au champ suivant ;
  - textes de la ligne d'état selon `Resultat` : « Enregistrée », « 7/10 converti en 14/20 », message d'erreur
    sous le champ, « Pas enregistrée : <raison>. Réessaie. » ;
  - Échap ramène à la liste.

  Le champ lit `data-stagiaire-id`, jamais un indice (point de vigilance 1).
- [ ] **Étape 3 : dans `rerender`**, ajouter l'onglet `{ key: "saisir", label: "Saisir" }` en tête, seulement si
  `admin && !laClasse`. Passer `defautKey: tactile ? "saisir" : "matrice"`. `apresEnregistrement` appelle
  `refreshAnalyticsInPlace(container)`.
- [ ] **Étape 4 : légende sous la matrice.** Un `<p class="matrice-legende">` : « C1 : … · C2 : … · REMC : … · GDE : … »,
  avec les libellés de la Tâche 1.
- [ ] **Étape 5 : contrôles au banc**, à 375 px et 1 280 px :
  - aucun défilement de côté hors de la matrice ;
  - « 2 sur 6 » se met à jour ;
  - une note d'examen affiche son origine ;
  - **point de vigilance 3** : taper une note, puis toucher « Retour » ou « Matrice » sans quitter le champ. La note
    est enregistrée ;
  - **point de vigilance 5** : `window.__HARNESS_FAIL = "network error"`, puis saisir. On lit « Pas enregistrée… »,
    la valeur reste et le compteur ne bouge pas.
- [ ] **Étape 6 :** relancer le parcours. Attendu : vert sur Chromium et WebKit, aux deux formats. Dans
  `referentiel.md`, la ligne « Saisir une note, voir les passages d'un stagiaire » passe à « oui (saisie) ».
- [ ] **Étape 7 : commit** « Notes (lot C, C1) : saisie thème par thème, sous-onglet Saisir ».

### Tâche 5 : états vides (C2)

**Fichiers :** modifier `js/views/notes.js` et `css/style.css`.

**Interfaces :**
- Utilise `etatVideNotes` (Tâche 1) et `renderSaisie` (Tâche 4), dont le contexte reçoit `carteVide`. Dans
  « Saisir », la carte `"equipe-saisir"` s'affiche en tête de la liste des cibles.
- Produit `carteVide(contexte) -> Element|null` dans `notes.js`, et `allerAuxThemes(sousOnglet: "themes"|"qcm")`.
  Cette dernière écrit `localStorage[CLES_SOUS_ONGLETS.themes] = sousOnglet` dans un `try`, puis
  `location.hash = "#/themes"`. Correspondance des actions :
  - « examen » mène à `allerAuxThemes("themes")` ;
  - « entrainement » mène à `allerAuxThemes("qcm")` ;
  - « saisir » mène à `wrap.activer("saisir")`.

  Les libellés des boutons sont « Ouvrir un examen », « M'entraîner sur un QCM » et « Saisir des notes ».

- [ ] **Étape 1 : la condition « aucune note »** est `statsGroupe().n === 0`.
  - **Matrice (équipe)** : la carte s'affiche au-dessus de la matrice, et ni `renderSynthese()` ni
    `renderChartsSection()` ne sont affichés.
  - **La classe** : la carte seule (contexte `classe-stagiaire`, ou `classe-formateur` si `admin`), sans matrice,
    synthèse ni graphiques. La section des moyennes EPCF reste.
  - **Retour d'une note** : `refreshAnalyticsInPlace` gère la sortie de l'état vide. Après le premier
    enregistrement, la carte disparaît et la synthèse revient.
- [ ] **Étape 2 : graphiques et synthèse.**
  - `horizontalBarChart` ignore les entrées `avg == null`.
  - `buildAveragesChartSvg` rend un conteneur avec le SVG et, s'il y a des stagiaires sans note, la ligne « 1
    stagiaire sans note pour l'instant. » ou « N stagiaires sans note pour l'instant. ».
  - Le graphique de l'anonyme sans note donne « Tu n'as pas encore de note. ».
  - L'indicateur « Notes < 10/20 » devient « Notes sous 10/20 », sans classe `ok` à 0.
  - La phrase « Pas encore assez de notes par thème pour ranker. » devient « Le classement des thèmes apparaîtra
    avec les premières notes de thème. ».
- [ ] **Étape 3 : contrôles au banc.**
  - **Banc vide** (`evaluations: []`) : la carte s'affiche, côté équipe et côté stagiaire (`role=stagiaire`).
  - **Banc avec la démo** (`?centre=1&demo=1`) : les barres sans « Aucune note », et la ligne des stagiaires sans
    note.
  - **Partout** : Outfit, aucun défilement de côté, contraste AA (habillages ecsr et ecf).
- [ ] **Étape 4 :** `node --test "tests/*.test.mjs"`. Attendu : tout passe.
- [ ] **Étape 5 : commit** « Notes (lot C, C2) : une phrase et une action à la place des états vides ».

### Tâche 6 : examen depuis la liste des thèmes (C3)

**Fichiers :** modifier `js/views/themes.js` et `css/style.css`. Robot : `outils/parcours/equipe.py`,
`docs/qualite/referentiel.md`.

**Interfaces :**
- Utilise `libelleOuverture` et `resumeExamen` (Tâche 2).
- Produit, dans `themes.js` :
  - `ouvrirExamen(theme, qcm, apres: () => void)` : la fenêtre de durée, avec le sous-titre
    « Thème <numéro> · <titre> » puis `resumeExamen(qcm)`. Ensuite la publication (corps actuel de
    `doPublishNow`), la notification actuelle, puis `apres()`.
  - `fermerExamen(theme, qcm, apres)` : `confirm("Fermer l'examen du thème <numéro> ? Les stagiaires ne pourront
    plus le démarrer.")`, puis `unpublishQcm`, « Examen fermé. », puis `apres()`.
  - `blocExamenListe(theme, qcm) -> Element`, qui porte `.theme-qcm-examen`.
  - `themeExamPanel` appelle `ouvrirExamen` et `fermerExamen`.

- [ ] **Étape 1 : vérifier ce que devient un passage commencé** quand `unpublishQcm` ferme l'examen. Lire
  `js/db.js` et les règles de remise dans `qcm-exam-rules.js`. Si le passage peut se terminer, ajouter à la
  confirmation « Ceux qui l'ont commencé peuvent finir. ». Sinon, garder la phrase seule.
- [ ] **Étape 2 : parcours robot qui échoue.**
  `@parcours("ouvrir-un-examen", "Ouvrir un examen depuis la liste des thèmes", role="formateur", budget=3)`.
  Déroulé :
  - `v.aller("Cours et QCM")` ;
  - dans la ligne d'un thème dont le QCM est fermé au banc (`qcm` 51), toucher « Ouvrir l'examen » ;
  - toucher « 1 heure » (`ecriture=True`) ;
  - attendre « Ouvert jusqu'à » ;
  - `v.but(...)` ;
  - puis, sans compter : « Fermer l'examen », accepter la confirmation (`page.once("dialog", …)`), attendre
    « Examen fermé ».

  Attendu : échec.
- [ ] **Étape 3 : écrire `ouvrirExamen`, `fermerExamen` et `blocExamenListe`.**
  - Dans `qcmCellEl`, si `canManageExam()`, ajouter le bloc à la place de la pastille « Examen ouvert ». Sinon,
    garder la pastille.
  - CSS : sur ordinateur, les boutons dans la cellule (colonne de 170 px au moins). Sous 720 px, les boutons QCM et
    examen côte à côte sur toute la largeur, `min-height: 44px`.
- [ ] **Étape 4 : contrôles au banc**, à 375 px et 1 280 px :
  - ouvrir 30 minutes, puis lire « Ouvert jusqu'à … » ;
  - fermer, puis lire « Examen fermé » ;
  - ouvrir depuis la fiche du QCM : la fenêtre a le même sous-titre ;
  - en `role=stagiaire`, la pastille reste et il n'y a aucun bouton ;
  - aucun défilement de côté.
- [ ] **Étape 5 :** relancer le parcours. Attendu : vert partout. Ajouter la ligne « Formateur | Ouvrir un
  examen depuis la liste des thèmes | 3 | oui (nouvelle navigation) » à `referentiel.md`.
- [ ] **Étape 6 : commit** « Examens (lot C, C3) : ouvrir et fermer depuis la liste des thèmes ».

### Tâche 7 : après la fusion du lot 5 dans main

**Fichiers :** `js/views/notes.js`, `js/views/themes.js`.

Interdit de commencer avant que la coordination ait confirmé la fusion du lot 5. Ensuite :

- [ ] **Étape 1 :** mettre `lot-c` à jour avec main : `git merge main`, résoudre `notes.js` et `themes.js` en
  gardant les deux intentions. `node --test "tests/*.test.mjs"`.
- [ ] **Étape 2 :**
  - « Saisir » est absent si `dansLeCentre` ;
  - la carte vide prend le contexte `"direction"` dans la vue en lecture de la direction ;
  - `blocExamenListe` exige `canManageExam() && !sansPromo()`.
- [ ] **Étape 3 :** contrôle au banc de la vue direction (levier du lot 5) : pas de « Saisir », carte sans bouton,
  aucun bouton d'examen.
- [ ] **Étape 4 : commit** « Lot C : accord avec le lot 5 (direction, sans promo) ».

### Tâche 8 : contrôles et fusion

- [ ] `node --test "tests/*.test.mjs"` : tout vert.
- [ ] `MSYS_NO_PATHCONV=1 python outils/robot_parcours.py --habillages ecsr,ecf --sortie <dossier>` : aucun défaut
  nouveau. Retirer de `outils/parcours/connus.py` toute ligne corrigée par ce lot.
- [ ] Lancer en arrière-plan, pour environ 18 min :
  `python "C:/Users/watch/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_ef2fa5b2-7428-4bd7-a3e4-5d2676c41680/outils-qualite/lancer_verif_nav.py" C:/Users/watch/Dev/ecsr-promo-lot-c --habillages ecsr,ecf`.
- [ ] Relecture par un agent neuf (modèle sonnet), qui reçoit `git diff main...lot-c` et la conception, pas mes
  conclusions.
- [ ] Captures de fin à 375 px et 1 280 px : Saisir, état vide (équipe et stagiaire), liste des thèmes avec examen.
- [ ] **Fusion :**
  - entrée Nouveautés dans `js/nouveautes-data.js` ; si elle est classée comme une correction, l'ajouter à
    `tests/nouveautes.test.mjs` ;
  - `git merge --no-ff --no-commit lot-c` depuis `TP_ECSR_App` ;
  - `git commit -F msg > journal.txt 2>&1` ;
  - tests et robot (Chromium) sur main, puis pousser ;
  - vérifier le jeton servi par Pages : `gh api repos/watchi64/ecsr-promo/pages/builds/latest` et un curl de la
    page.
