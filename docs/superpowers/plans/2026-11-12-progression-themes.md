# Progression du stagiaire sur la liste des thèmes : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chaque ligne de thème, côté stagiaire, prend la couleur de son état (Acquis, À revoir, En cours, À commencer),
et les compteurs, la phrase d'en-tête et le filtre parlent de sa progression.

**Architecture:** une règle pure (`js/progression-rules.js`, testée sous node) décide de l'état à partir des notes que la
vue lit déjà ; `js/views/themes.js` l'applique quand la vue est celle d'un stagiaire ; `css/themes-lignes.css` dessine le
liseré, le voile et la pastille.

**Tech Stack:** JavaScript ES modules sans build, `node --test`, banc d'essai (import map), robot des parcours (Playwright).

**Spec:** `docs/superpowers/specs/2026-11-12-progression-themes-design.md`

## Global Constraints

- Vue stagiaire = `!formateurConnecte() && !sansPromo() && canSeeQcm()` ; la vue équipe ne change pas.
- Seuil d'entraînement : 12/20 ; seuil d'examen : `qcm.exam_pass_20`, 15 si absent.
- Libellés exacts : « Acquis », « À revoir », « En cours », « À commencer » ; filtre « Tous les états ».
- Phrase d'en-tête : « Tu as acquis N thème(s) officiel(s) sur T. » ; sans acquis : « Aucun thème acquis pour l'instant. »
- Aucun tiret cadratin ; texte AA (4,5:1) sur les voiles ; aucun défilement horizontal à 375 px.
- Entrée Nouveautés (`pour: "stagiaires"`, tutoiement) dans le même commit que le code.

## Review Focus

- Thème numéroté avec module Notes masqué mais tentative d'examen existante : l'examen est ignoré (comme la note affichée).
- Note de matrice saisie à la main, sans tentative : date = fin de journée de `date_eval`.
- Entraînement et examen à la même milliseconde : l'examen l'emporte.
- QCM au seuil personnalisé (ex. 12) : un examen à 13 est Acquis.
- Filtre sur un état puis bascule vers Compétences : les lignes sans QCM n'apparaissent pas sous un état.

---

### Task 1 : la règle d'état

**Files:**
- Create: `js/progression-rules.js`
- Test: `tests/progression-rules.test.mjs`

**Interfaces:**
- Produces :
  - `SEUIL_ENTRAINEMENT = 12`, `SEUIL_EXAMEN_DEFAUT = 15`
  - `ETATS_PROGRESSION` : `[{ cle: "acquis", libelle: "Acquis" }, { cle: "revoir", libelle: "À revoir" }, { cle: "encours", libelle: "En cours" }, { cle: "commencer", libelle: "À commencer" }]`
  - `dateExamen(tentative: {finished_at}|null, evaluation: {date_eval}|null) -> number|null` (ms)
  - `etatProgression({ seuil: number|null, examen: {note, date}|null, entrainement: {note, date}|null }) -> "acquis"|"revoir"|"encours"|"commencer"`
  - `bilanProgression(etats: (string|null)[]) -> { acquis, revoir, total }` (total = états non nuls)
  - `phraseBilan(acquis: number, total: number) -> string`

- [ ] Écrire les tests : chaque ligne du tableau de la spec ; égalité de date (examen gagne) ; seuil 12 personnalisé ;
  `dateExamen` (tentative le même jour que `date_eval` → tentative ; tentative antérieure → fin de journée de
  `date_eval` ; pas de tentative → fin de journée ; rien → null) ; `bilanProgression` ignore `null` ; `phraseBilan(0, 57)`,
  `(1, 57)` (« 1 thème officiel »), `(12, 57)`.
- [ ] Lancer `node --test tests/progression-rules.test.mjs` : échec (module absent).
- [ ] Écrire le module. Fin de journée = `Date.parse(date_eval + "T23:59:59")` (heure locale, comme l'app).
- [ ] Relancer : vert. Commit.

### Task 2 : la liste des thèmes côté stagiaire

**Files:**
- Modify: `js/views/themes.js` (`loadQcmIndex`, `renderThemeRow`, `familleStats`, `texteProgression`, filtre, en-têtes de section)
- Modify: `css/themes-lignes.css`

**Interfaces:**
- Consumes : Task 1.
- Produces : `vueProgression() -> boolean`, `etatTheme(theme) -> string|null` (module-local).

- [ ] `etatTheme` : QCM du thème (`qcmByTheme`, `nb_questions > 0`), note d'examen (`myThemeNote`), sa date
  (`dateExamen(myExamByQcm.get(qcm.id), myNoteByThemeNum.get(theme.numero))`, l'évaluation seulement si le module Notes
  est visible et le thème numéroté), entraînement (`myTrainByQcm`).
- [ ] Ligne : classe `prog-<cle>` et pastille `.theme-prog` dans `.theme-meta` à la place du statut et de la date quand
  `vueProgression()`.
- [ ] Sections : « Acquis / À revoir » et barre = acquis / total (thèmes avec état), via `bilanProgression`, aussi dans
  `refreshStatsInPlace`. Phrase d'en-tête : `phraseBilan` sur les thèmes officiels.
- [ ] Filtre : options des états et « Tous les états » ; `filterStatut` filtre sur `etatTheme` en vue stagiaire.
  Un filtre mémorisé d'une autre vue (« Fait ») est remis à vide.
- [ ] CSS : liseré `box-shadow: inset 4px 0 0 <couleur>` (pas de bordure : la grille ne bouge pas) ; voile en
  `color-mix(in srgb, <couleur> 7%, var(--bg-elev))` ; « À commencer » : liseré `var(--line)`, sans voile ; pastille
  `.theme-prog` au texte de la couleur, fond `color-mix` 14 %.
- [ ] Banc : stagiaire, 375 px et 1280 px, habillages app et ECF ; contraste mesuré sur chaque voile. Commit.

### Task 3 : Nouveauté, assistant, robot

**Files:**
- Modify: `js/nouveautes-data.js` (entrée `2026-11-12-progression-themes`, `pour: "stagiaires"`, `ou` vers Cours et QCM)
- Modify: le guide stagiaire de l'assistant s'il décrit la liste des thèmes (redéploiement groupé, noté pour Timy)

- [ ] Nouveauté rédigée au tutoiement, sans vocabulaire technique.
- [ ] `node --test tests/` complet : vert.
- [ ] Robot des parcours (skill `robot-des-parcours`), deux moteurs, deux habillages : VERT.
- [ ] Commit, revue indépendante de la branche, puis demande du tour de fusion à la coordination.
