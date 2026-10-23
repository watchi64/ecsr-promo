# Émargement numérique signé : plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une demi-journée de formation s'émarge dans l'app (ouverture, signatures au doigt,
clôture) et s'imprime en feuille A4 par demi-journée et par semaine.

**Architecture:** trois tables Supabase propres à une promo, écrites seulement par des
fonctions serveur `security definer` ; règles pures dans `js/emargement-rules.js` ; une page
formateur `#/emargement`, un bandeau global pour signer, une zone de signature canvas, deux
gabarits d'impression branchés sur `doc-officiel.js`.

**Tech Stack:** JavaScript vanilla en modules ES, Supabase Postgres 17 (RLS), tests `node --test`,
Postgres 18 local pour la preuve SQL, banc `_harness.html`.

**Spec:** `docs/superpowers/specs/2026-10-23-emargement-design.md`

## Global Constraints

- Aucun tiret cadratin (U+2014) dans le code, les textes, les commits.
- Aucune écriture d'essai dans la base de prod ; migration appliquée seulement avec l'accord de Timy.
- Toute table : `promo_id integer not null references promos(id)` et lecture bornée à `promo_id = (select promo_courante())`.
- « Formateur » = `is_admin() or is_prof()` ; stagiaire = `my_stagiaire_id()`.
- Jour de référence serveur : `(now() at time zone 'Europe/Paris')::date`.
- Repère du tracé : 400 x 160, entiers ; motif `^(M\d{1,3} \d{1,3}(L\d{1,3} \d{1,3})*)+$`, 20 000 caractères au plus.
- Demi-journées : `matin` et `aprem` (clés de `HALF_DAYS`, `js/config.js`).
- Horaires par défaut : matin 09:00 à 12:30, après-midi 13:30 à 17:00 (comme `DEFAULT_HALF_META` du planning).
- En-tête par défaut : organisme « ECF BOUSCAREN », intitulé « Titre professionnel Enseignant de la conduite et de la sécurité routière (ECSR) ».
- Migrations : commencent par `set local lock_timeout = '3s';`, fichier retour `_retour.sql` à côté.
- Affichage d'un stagiaire : `displayStagiaire(s)` (`js/utils.js`).

## Review Focus

1. Une signature envoyée deux fois (double appui, réseau lent) : la seconde est refusée proprement (« Déjà signé »), sans erreur brute.
2. Un stagiaire qui ouvre l'app le lendemain avec une séance restée ouverte : pas de bandeau, la fonction serveur refuse.
3. La clôture pendant qu'un stagiaire signe : la signature arrivée après la clôture est refusée, la feuille close ne change plus.
4. Un tracé fait au doigt sur 375 px ne fait pas défiler la page et reste lisible à l'impression.
5. La feuille de la semaine avec une demi-journée sans séance, un jour férié et un stagiaire entré en cours de semaine : cases vides lisibles, pas de décalage de colonnes.

---

### Task 1: Règles pures

**Files:**
- Create: `js/emargement-rules.js`
- Test: `tests/emargement-rules.test.mjs`

**Interfaces:**
- Produces:
  - `REPERE = { largeur: 400, hauteur: 160 }`, `TRACE_MAX = 20000`, `MOTIF_TRACE` (RegExp ci-dessus)
  - `cheminDepuisTraits(traits: {x,y}[][], taille: {largeur, hauteur}): string` (mise à l'échelle dans le repère, arrondi, points à moins de 2 unités du précédent retirés ; un trait d'un seul point devient `Mx yLx y`)
  - `cheminValide(d: string): boolean`
  - `traitsSuffisants(traits, taille): boolean` (au moins 8 points en tout et une largeur d'au moins 60 unités du repère)
  - `absentsDuPlanning(entries, dayIndex: number, demi: string): Set<number>` (sid des `absences` des cartes de la demi-journée)
  - `etatLigne({ ligne, absentPlanning: boolean, close: boolean }): { code: "signe"|"absent"|"attente", libelle: string, origine: string|null }`
  - `resumeSeance(lignes, stagiaireIds: number[], absents: Set<number>, close: boolean): { signes, absents, attente, total }`
  - `libelleHeure("09:00"): "9h00"`, `libelleCreneau({debut, fin}): "9h00 à 12h30"`, `dureeMinutes(debut, fin): number`
  - `heureLocale(iso: string): "9h04"` (heure de Paris), `jourDe(lundiIso, dayIndex): string`, `lundiDe(jourIso): string`, `dayIndexDe(jourIso): number`
  - `lireAdresseEmargement(hash): { jour: string|null, demi: string|null }` (`#/emargement/2026-10-26/matin`)
  - `nomsFormateursProposes({ entries, profs, monNom }): string[]` (mon nom d'abord, puis formateurs des cartes : `prof_ids` résolus et `prof_autre`, sans doublon, ordre alphabétique)
  - `minutesPresence(seances, lignes, stagiaireId): number` (somme des durées des séances où il a signé)

- [ ] **Step 1:** tests : chemin d'un trait de 3 points sur un canvas 200 x 80 → `"M0 0L200 80L400 160"` mis à l'échelle ; point isolé ; points rapprochés retirés ; `cheminValide` refuse `"M1 1<script>"`, `""`, une chaîne de 20 001 caractères, accepte `"M10 10L20 20M5 5L6 6"` ; `traitsSuffisants` refuse un point, accepte un trait de 10 points sur toute la largeur ; `absentsDuPlanning` ne lit que la demi-journée demandée ; `etatLigne` : tracé → signe (libellé avec l'heure), absent formateur, absent au planning mais ouverte → attente avec origine `planning`, close sans ligne → absent ; `lireAdresseEmargement` refuse une date ou une demi-journée invalide ; `dureeMinutes("09:00","12:30") === 210` ; `nomsFormateursProposes` dédoublonne.
- [ ] **Step 2:** `node --test tests/emargement-rules.test.mjs` : FAIL (module absent).
- [ ] **Step 3:** écrire le module (aucun import de DOM ni de db.js : lu par node).
- [ ] **Step 4:** `node --test tests/emargement-rules.test.mjs` : PASS.
- [ ] **Step 5:** commit « Émargement : règles pures et tests ».

### Task 2: Base : migration, base locale, preuve

**Files:**
- Create: `supabase/migrations/20261023_emargement.sql`, `supabase/migrations/20261023_emargement_retour.sql`
- Create: `tests/sql/emargement-preuve.sql` (personnages choisis par requête, aucun email réel)
- Create (hors dépôt, scratchpad) : base locale `pg_ctl` + `socle_local.sql` qui recrée `auth.jwt()`, les rôles `anon`/`authenticated`, les tables `lieux`, `promos`, `stagiaires`, `profs`, `user_profiles`, `planning_entries`, `settings` (colonnes de prod) et les fonctions `is_admin`, `is_prof`, `is_founder`, `my_stagiaire_id`, `peut_acceder_promo`, `promo_courante`, `promo_par_defaut` (définitions relevées en prod le 23/10).

**Interfaces:**
- Produces (fonctions RPC, toutes `security definer`, `search_path = public, pg_temp`, exécutables par `authenticated` seulement) :
  - `emargement_ouvrir(p_demi text, p_debut text, p_fin text) returns bigint` (jour = aujourd'hui ; existe et ouverte : rend son id ; close : refus « déjà close, rouvrir »)
  - `emargement_signer(p_seance bigint, p_stagiaire integer, p_trace text) returns timestamptz` (soi-même : `sur_appareil_formateur = false` ; formateur pour un autre : `true`)
  - `emargement_signer_formateur(p_seance bigint, p_nom text, p_trace text) returns timestamptz`
  - `emargement_annoter(p_seance bigint, p_stagiaire integer, p_absent boolean, p_observation text) returns void` (`p_absent` nul : inchangé ; absence modifiable seulement séance ouverte et ligne non signée ; observation modifiable toujours, 200 caractères au plus, vide = nulle)
  - `emargement_clore(p_seance bigint) returns integer` (nombre d'absents posés)
  - `emargement_rouvrir(p_seance bigint) returns void`
  - Messages d'erreur en français, préfixés `emargement:` pour que l'app les reconnaisse (ex. `emargement: deja signe`).

- [ ] **Step 1:** monter la base locale (initdb dans le scratchpad, port 54329), charger `socle_local.sql` et des données fictives : promos 1 et 2, stagiaires dans chacune, un formateur, un admin, deux stagiaires avec compte, une carte de planning avec une absence.
- [ ] **Step 2:** écrire la preuve : lecture (stagiaire voit sa ligne seulement, pas celles des autres ni les signatures de formateurs ; formateur voit tout de sa promo courante, rien de l'autre promo ; visiteur rien), écritures directes refusées (insert, update, delete sur les trois tables pour `authenticated`), ouverture par stagiaire refusée, signature d'un autre par un stagiaire refusée, double signature refusée, signature séance close refusée, signature d'une séance d'un autre jour refusée, tracé invalide refusé, clôture sans formateur refusée, clôture pose les absents avec l'origine `planning` ou `non_signe`, rouvrir les retire, inaltérabilité (update du tracé en propriétaire refusé par le déclencheur). Verdict dans l'exception finale, comme `tests/sql/multi-promo-preuve.sql`.
- [ ] **Step 3:** lancer la preuve sur la base locale sans la migration : ROUGE (tables absentes).
- [ ] **Step 4:** écrire la migration et son retour.
- [ ] **Step 5:** appliquer, rejouer la preuve : VERT ; appliquer le retour puis la migration une seconde fois (rejouable proprement).
- [ ] **Step 6:** commit « Émargement : tables, fonctions serveur et preuve ».

### Task 3: Accès aux données et banc

**Files:**
- Modify: `js/db.js` (section `// === Émargement ===` en fin de fichier)
- Modify (hors dépôt) : `_harness_supabase.js` du worktree (copie de celui de `TP_ECSR_App`) : tables `emargement_*` en mémoire, les six fonctions jouées avec les mêmes règles, levier `?emargement=1` (une séance close la semaine précédente, une séance ouverte ce matin)

**Interfaces:**
- Consumes: fonctions de la Task 2.
- Produces (`js/db.js`) :
  - `listEmargementSeances(jourDebut, jourFin): Promise<Seance[]>` (avec `lignes:emargement_lignes(*)` et `formateurs:emargement_formateurs(*)` pour un formateur ; un stagiaire ne reçoit que sa ligne par la règle de lecture)
  - `getEmargementOuvertDuJour(jourIso): Promise<Seance[]>`
  - `ouvrirEmargement(demi, debut, fin)`, `signerEmargement(seanceId, stagiaireId, trace)`, `signerEmargementFormateur(seanceId, nom, trace)`, `annoterEmargement(seanceId, stagiaireId, { absent, observation })`, `cloreEmargement(seanceId)`, `rouvrirEmargement(seanceId)` : rendent la valeur de la fonction ou lèvent une `Error` dont le message est la phrase française (préfixe `emargement:` retiré)
  - `getEnteteEmargement(): Promise<{ organisme, intitule }>` (réglage `emargement_entete`, JSON, défauts des Global Constraints), `setEnteteEmargement(entete)`

- [ ] **Step 1:** écrire les fonctions de `db.js`.
- [ ] **Step 2:** étendre le banc ; `node _harness_build.mjs` ; dans le pane, `await import()` de `db.js` par son URL de banc : ouvrir, signer, double signature refusée, clore, relire.
- [ ] **Step 3:** commit « Émargement : accès aux données ».

### Task 4: Zone de signature

**Files:**
- Create: `js/signature-pad.js`, `css/emargement.css` (lien dans `index.html` après `cours-blocs.css`)

**Interfaces:**
- Consumes: `cheminDepuisTraits`, `traitsSuffisants`, `REPERE` (Task 1).
- Produces: `ouvrirSignature({ titre: string, attestation: string, valider: (trace) => Promise<void> }): Promise<boolean>` : fenêtre plein écran (modale `modal-backdrop`), canvas au rapport 400/160 sur toute la largeur utile, `touch-action: none`, défilement du corps bloqué pendant l'ouverture, boutons « Effacer », « Annuler », « Valider ma signature » ; rend `true` si `valider` a réussi, `false` si annulé ; une erreur de `valider` s'affiche dans la fenêtre sans la fermer ; bouton Valider désactivé pendant l'envoi (anti double appui). `rendreSignature(trace, { classe }): SVGElement` (viewBox 0 0 400 160, trait noir, sans remplissage, `setAttribute("d", …)`).

- [ ] **Step 1:** écrire le module et le CSS (zone tracée bordée, ligne de base discrète).
- [ ] **Step 2:** banc à 375 px : tracé par évènements de pointeur simulés (`PointerEvent` sur le canvas), le chemin produit est valide ; capture d'écran.
- [ ] **Step 3:** commit « Émargement : zone de signature ».

### Task 5: Page Émargement

**Files:**
- Create: `js/views/emargement.js`
- Modify: `js/main.js` (route `emargement`, garde : un non-formateur va sur `#/mon-suivi`), `js/modules-data.js` (`emargement` dans `ROUTES_SOCLE`), `js/views/home.js` (tuile « Émargement » après « Stagiaires » pour les formateurs), `js/views/planning.js` (bouton « Émargement » à côté de Priorités, formateurs)

**Interfaces:**
- Consumes: Tasks 1, 3, 4 ; `listStagiaires`, `listProfs`, `getPlanning`, `getHalfMetaForWeek`, `getJoursOff`, `getPromoCourante`.
- Produces: `renderEmargement(container)` ; impression appelée par `imprimerFeuille(seance)` et `imprimerSemaine(lundi)` de la Task 7.

- [ ] **Step 1:** vue semaine (navigation de semaine, dix cases, état de chacune, aujourd'hui en évidence, fériés et jours désactivés grisés par le même calcul que le planning) et vue séance (liste, actions par ligne dans un menu, bloc formateur avec choix du nom, Clore avec confirmation qui donne le nombre d'absents, Rouvrir le jour même, relecture toutes les 10 s arrêtée dès qu'on quitte la séance ou qu'une fenêtre de signature est ouverte).
- [ ] **Step 2:** `node --test "tests/*.test.mjs"` : PASS (dont `modules.test.mjs` et `chargement.test.mjs`).
- [ ] **Step 3:** banc `?role=prof&emargement=1` : ouvrir la séance du jour, faire signer deux stagiaires ici, marquer un absent, noter un retard, signer en formateur, clore, rouvrir ; à 1280 et à 375 px ; captures.
- [ ] **Step 4:** commit « Émargement : page formateur ».

### Task 6: Bandeau de signature

**Files:**
- Create: `js/emargement-bandeau.js`
- Modify: `js/main.js` (appel `initBandeauEmargement()` après l'ouverture de l'app, une seule fois)

**Interfaces:**
- Consumes: `getEmargementOuvertDuJour`, `signerEmargement`, `ouvrirSignature`, `monStagiaireId`, `isAdmin`, `isProf`.
- Produces: `initBandeauEmargement(): void`, `rafraichirBandeauEmargement(): Promise<void>` (appelée aussi par la page après une ouverture ou une clôture).

- [ ] **Step 1:** bandeau inséré avant `#view` ; relu au démarrage, sur `hashchange`, sur `visibilitychange` (visible) et toutes les 60 s quand la page est visible ; stagiaire : « Émargement du matin ouvert » + « Signer » ; après réussite : « Signé à 9h04 » 4 s puis disparition ; formateur : « Émargement du matin ouvert : 6 sur 10 ont signé » + « Voir », masqué sur la page Émargement elle-même.
- [ ] **Step 2:** banc `?role=stagiaire&emargement=1` : bandeau présent, signature, bandeau disparu, relecture sans bandeau ; `?date=` du lendemain : pas de bandeau ; 375 px.
- [ ] **Step 3:** commit « Émargement : bandeau de signature ».

### Task 7: Feuilles imprimables

**Files:**
- Create: `js/emargement-feuilles.js`
- Modify: `js/doc-officiel.js` (`bindDocPrint(..., { page = "A4 portrait" })` écrit `@page { size: <page>; margin: 0; }` ; `teardownDocPrint` retire aussi `#emargement-print` et `emargement-printable`), `css/emargement.css`

**Interfaces:**
- Consumes: Tasks 1, 3, 4 ; `getEnteteEmargement`, `getPromoCourante`.
- Produces: `feuilleSeance({ entete, promo, seance, stagiaires, absentsPlanning }): HTMLElement`, `feuilleSemaine({ entete, promo, lundi, seances, stagiaires, joursOff }): HTMLElement`, `imprimer(element, { page }): void` (monte le clone dans `#emargement-print`, `window.print()`).

- [ ] **Step 1:** feuille demi-journée A4 portrait (en-tête, tableau N°, nom, signature, observations avec heure, bloc formateurs, pied d'horodatage et de clôture ; hauteur de ligne adaptée au nombre de stagiaires pour tenir sur une page jusqu'à 20) ; feuille semaine A4 paysage (dix colonnes toujours présentes, « sans émargement » ou le libellé du férié dans une colonne vide, ligne Formateurs, colonne Heures en `h` et minutes).
- [ ] **Step 2:** `@media print` : seul `#emargement-print` s'imprime ; aperçu au banc en émulation impression (`matchMedia` ou page autonome qui charge `css/emargement.css`) ; mesure : la feuille demi-journée de 20 stagiaires tient dans 297 mm, la semaine de 15 dans 210 mm.
- [ ] **Step 3:** commit « Émargement : feuilles imprimables ».

### Task 8: Données de démonstration

**Files:**
- Create: `scripts/emargement-demo.mjs` (`signatureFictive(graine: string, variation: number): string` produisant un chemin valide ; exécuté seul, écrit la migration), `supabase/migrations/20261023_emargement_demo.sql`, `..._demo_retour.sql`

- [ ] **Step 1:** générateur déterministe (même stagiaire, même allure ; variation légère par séance) ; test : chaque chemin passe `cheminValide`.
- [ ] **Step 2:** migration gardée par `exists (select 1 from promos where id = 7)` : semaines du 12/10 et du 19/10, dix séances closes chacune, horaires du planning de la promo 7, lignes des 10 stagiaires actifs (Kevin absent trois fois, une absence reprise du planning si la promo 7 en porte, un retard noté), signatures de Claire ou Marc selon les formateurs du planning de la demi-journée, horodatages plausibles (5 à 25 minutes après le début).
- [ ] **Step 3:** rejouer sur la base locale (avec une promo 7 fictive) : comptes attendus ; commit.

### Task 9: Finitions, relecture, mise en ligne

**Files:**
- Modify: `js/nouveautes-data.js` (entrée `2026-10-26-emargement`, pour « formateurs », lien `ou: { label: "Émargement", route: "emargement" }`, guide en 4 étapes), `PROJECT_NOTES.md` (section Émargement), `docs/superpowers/specs/...` si un choix a changé

- [ ] **Step 1:** `node --test "tests/*.test.mjs"` : PASS ; recherche du cadratin dans le diff : 0.
- [ ] **Step 2:** relecture complète de la branche par un agent indépendant ; corrections.
- [ ] **Step 3:** montrer à Timy ce qui part (fichiers, migrations, entrée Nouveautés) et attendre son accord ; mise à jour avec `main`, fusion, poussée, migration et preuve en prod, migration de démonstration, vérification de la page servie.
