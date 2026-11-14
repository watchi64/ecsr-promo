# E-learning, lot 1 (lecture et temps actif) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** quand l'interrupteur « Travail en autonomie » est allumé pour une promo, la base enregistre pour chaque
stagiaire les cours ouverts et lus et son temps actif (lecteur de cours, QCM en entraînement) ; le stagiaire et son
formateur voient la même fiche « Travail en autonomie ».

**Architecture:** des règles pures (`js/autonomie-rules.js`, testées sous node) comptent le temps actif et décident ce
qui s'affiche ; un compteur de page (`js/autonomie-suivi.js`) se branche sur le lecteur de cours et sur le QCM en
entraînement et écrit par deux fonctions de la base, qui refusent elles-mêmes toute écriture hors des conditions (compte
stagiaire, interrupteur allumé, conditions acceptées) ; la base décide seule qu'un cours est « lu ».

**Tech Stack:** JavaScript ES modules sans build, `node --test`, Supabase (PostgreSQL, règles RLS, fonctions
`security definer`), base locale jetable (`outils/base_locale/`), banc d'essai (import map), robot des parcours.

**Spec:** `docs/superpowers/specs/2026-11-12-e-learning-design.md` (§ 6, et les trois questions de tête). Textes des
données personnelles : `docs/superpowers/specs/2026-11-12-e-learning-textes-donnees.md`.

## Avant de commencer (portes)

Rien de ce plan ne se construit avant que ces trois portes soient ouvertes :

1. **Timy a répondu aux trois questions de tête de la spec** (lecture tracée, allumage par promo, « À relancer »). Si sa
   réponse à la première est « non », ce plan est abandonné.
2. **La branche `progression-themes` est fusionnée dans main** : la tâche 6 pose la marque « Lu » sur sa ligne de thème.
3. **Timy a validé les deux textes** (conditions d'utilisation, registre) : la tâche 7 les met en ligne, la migration
   s'appuie sur la date de la nouvelle version.

Écrire en production (migration, allumage d'une promo) demande en plus l'accord de Timy au moment de le faire.

## Global Constraints

- Clé du réglage par promo : `autonomie_active` (table `settings`, valeur `'true'`), posée par le seul fondateur dans
  Paramètres, comme `emargement_actif`. Éteint par défaut partout. *Écart assumé avec la spec* : elle dit « module » ; le
  patron qui existe pour un allumage réservé au fondateur est l'interrupteur de l'émargement, pas `js/modules-data.js`.
- Éteint : aucune écriture, aucun affichage nouveau ; la clé `cours-ouverts` du navigateur et la classe `deja-lu`
  continuent de servir comme aujourd'hui.
- Seul un **compte stagiaire réel** écrit des traces : jamais un formateur, la direction, le fondateur, ni un aperçu
  « Voir en tant que ». La base le refuse elle-même (`my_stagiaire_id()` nul = refus).
- Écrans mesurés : lecteur de cours et QCM en **entraînement**. Jamais l'examen, jamais le reste de l'app.
- Temps actif : page visible et dernière action (défilement, clic, touche, toucher) datant de moins de 60 s.
- Écriture au plus toutes les 30 s, à la fermeture de l'écran et quand la page passe en arrière-plan.
- « Lu » : fin du cours atteinte **et** temps actif cumulé sur ce cours supérieur ou égal à 30 % du temps de lecture
  estimé (200 mots par minute, 1 minute au moins, comme `tempsLecture` de `js/cours-rules.js`). Décidé par la base.
  Un cours lu reste lu.
- Visibilité des traces : la même que les tentatives de QCM (`qcm_attempts_lecture`) : le stagiaire les siennes, l'équipe
  qui a le geste `notes.lire` sur la promo. Le siège ne lit rien (ses agrégats viennent au lot 4).
- Le stagiaire est tutoyé (`selonPublic`). Libellés exacts : « Lu », « Tu reprends où tu en étais », « Revenir au
  début », « Travail en autonomie », « N sur T l'ont lu ».
- Aucun tiret cadratin ; texte AA (4,5:1) ; aucun défilement horizontal à 375 px ; aucune boîte du navigateur
  (`js/confirmer.js`).
- Entrée Nouveautés dans le même commit que la mise en ligne ; guide de l'assistant mis à jour, redéploiement groupé.
- Une migration = son fichier `_retour.sql` et sa preuve rejouable dans `tests/sql/`, jouée sur la base locale avant la
  production (verdict `VERT n/0`).

## Review Focus

- Onglet laissé ouvert une heure sans toucher : le temps s'arrête 60 s après la dernière action, et reprend à l'action
  suivante (test en tâche 1).
- Téléphone verrouillé ou onglet masqué pendant la lecture : rien n'est compté pendant ce temps, et ce qui était en
  mémoire est écrit au passage en arrière-plan (tests en tâches 1 et 4).
- Réseau coupé au moment d'écrire : les secondes non écrites restent en mémoire et partent à l'écriture suivante ; le
  lecteur ne montre aucune erreur au stagiaire (test en tâche 4).
- Appel direct à la base avec des secondes aberrantes (10 000 d'un coup, ou négatives) : refusé ; plafond de 60 s par
  appel et de 8 h par jour et par stagiaire (preuve en tâche 2).
- Cours rallongé après une lecture : le cours reste lu ; cours dépublié : ses traces restent, il sort du total « cours
  publiés » (preuve en tâche 2, test en tâche 1).
- Stagiaire qui change de promo, ou effacé sur demande : ses traces suivent le sort de ses tentatives de QCM (preuve en
  tâche 2).

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/autonomie-rules.js` (créé) | règles pures : compteur de temps actif, plancher de lecture, résumé de la fiche, formats |
| `tests/autonomie-rules.test.mjs` (créé) | tests node des règles |
| `supabase/migrations/20261114_autonomie_1_traces.sql` et `_retour.sql` (créés) | tables, règles RLS, fonctions d'écriture, anonymisation |
| `tests/sql/autonomie-preuve.sql` (créé) | preuve rejouable |
| `js/db.js` (modifié) | lecture et écriture des traces |
| `js/autonomie-etat.js` (créé) | interrupteur par promo : lecture au démarrage, section de Paramètres |
| `js/autonomie-suivi.js` (créé) | compteur de page : écoute, cumul, écriture |
| `js/views/cours-reader.js`, `js/views/qcm.js` (modifiés) | branchement du compteur, reprise de lecture |
| `js/views/themes.js`, `css/themes-lignes.css` (modifiés) | marque « Lu », « N sur T l'ont lu » |
| `js/views/mon-suivi.js`, `js/fiche-rules.js` ou le module qui définit `partiesDeLaFiche` (modifiés) | partie « Travail en autonomie » |
| `js/legal-data.js`, `js/nouveautes-data.js`, guide de l'assistant, banc, robot | mise en ligne |

---

### Task 1 : règles pures

**Files:**
- Create: `js/autonomie-rules.js`
- Test: `tests/autonomie-rules.test.mjs`

**Interfaces:**
- Produces:
  - `CLE_ACTIVATION = "autonomie_active"` ; `estActif(valeur) -> boolean` (vrai pour `true` et `"true"`).
  - `SEUIL_INACTIVITE_MS = 60000`, `PERIODE_ECRITURE_MS = 30000`, `PART_PLANCHER = 0.3`.
  - `creerCompteur() -> { action(t), visible(t, estVisible), prelever(t) -> secondes }` : horloge passée en argument
    (millisecondes), aucun accès au DOM. `prelever` rend les secondes entières actives depuis le dernier prélèvement et
    garde le reste de la division pour le suivant.
  - `plancherLecture(texte) -> secondes` : `Math.round(tempsLecture(texte) * 60 * PART_PLANCHER)`.
  - `formatDuree(secondes) -> string` : « 0 min », « 12 min », « 1 h 05 ».
  - `resumeAutonomie({ lectures, temps, entrainements, coursPublies, aujourdhui }) -> { coursLus, coursTotal,
    secondesSemaine, secondesTotal, entrainements, derniereActivite }` ; la semaine va du lundi au dimanche de
    `aujourdhui` (`lundiDe` de `js/dates.js`) ; un cours non publié ne compte ni dans `coursLus` ni dans `coursTotal`.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
test("le temps s'arrête 60 s après la dernière action", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  assert.equal(c.prelever(3_600_000), 60);      // une heure sans toucher : 60 s
  c.action(3_600_000);
  assert.equal(c.prelever(3_610_000), 10);      // reprise à l'action suivante
});
test("rien n'est compté page masquée", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  c.visible(20_000, false); c.action(25_000);   // une action page masquée ne relance rien
  c.visible(50_000, true);                      // revenir sans agir ne compte pas
  assert.equal(c.prelever(55_000), 20);
});
test("des actions rapprochées ne se cumulent pas deux fois", () => {
  const c = creerCompteur();
  c.visible(0, true);
  for (let t = 0; t <= 30_000; t += 1_000) c.action(t);
  assert.equal(c.prelever(30_000), 30);
});
test("le reste sous la seconde est gardé", () => {
  const c = creerCompteur();
  c.visible(0, true); c.action(0);
  assert.equal(c.prelever(1_500), 1);
  c.action(1_500);
  assert.equal(c.prelever(2_000), 1);
});
test("plancher : 30 % du temps estimé, une minute estimée au moins", () => {
  assert.equal(plancherLecture("mot ".repeat(2000)), 180);   // 10 min estimées
  assert.equal(plancherLecture("court"), 18);                // 1 min estimée
});
test("formatDuree", () => {
  assert.equal(formatDuree(0), "0 min");
  assert.equal(formatDuree(59), "1 min");       // arrondi à la minute, une trace non nulle ne s'affiche pas 0
  assert.equal(formatDuree(720), "12 min");
  assert.equal(formatDuree(3900), "1 h 05");
});
test("résumé : un cours dépublié sort du total, la semaine va du lundi au dimanche", () => {
  const r = resumeAutonomie({
    coursPublies: ["a", "b", "c"],
    lectures: [{ cours_id: "a", lu_le: "2026-11-10T10:00:00Z", vu_le: "2026-11-10T10:00:00Z" },
               { cours_id: "z", lu_le: "2026-11-09T10:00:00Z", vu_le: "2026-11-09T10:00:00Z" },
               { cours_id: "b", lu_le: null, vu_le: "2026-11-12T08:00:00Z" }],
    temps: [{ jour: "2026-11-08", secondes: 600 }, { jour: "2026-11-09", secondes: 300 }, { jour: "2026-11-12", secondes: 120 }],
    entrainements: [{ finished_at: "2026-11-11T09:00:00Z" }],
    aujourdhui: "2026-11-12",
  });
  assert.deepEqual([r.coursLus, r.coursTotal], [1, 3]);
  assert.deepEqual([r.secondesSemaine, r.secondesTotal], [420, 1020]);   // le dimanche 08/11 est hors semaine
  assert.equal(r.entrainements, 1);
  assert.equal(r.derniereActivite, "2026-11-12T08:00:00Z");
});
```

- [ ] **Step 2 :** `node --test tests/autonomie-rules.test.mjs` : échec attendu (module absent).
- [ ] **Step 3 :** écrire `js/autonomie-rules.js` aux signatures ci-dessus. Le compteur tient un instant de dernière
  action, un état visible et un cumul en millisecondes ; un intervalle compte de la dernière borne jusqu'au plus petit
  de « maintenant » et « dernière action + 60 s », seulement quand la page est visible. Masquer la page clôt la
  fenêtre d'activité : au retour, rien ne compte avant une nouvelle action. `formatDuree` arrondit à la minute supérieure.
- [ ] **Step 4 :** relancer : tout passe ; `node --test tests/` reste vert.
- [ ] **Step 5 :** commit « Autonomie : règles du temps actif et de la fiche, avec leurs tests ».

### Task 2 : tables, règles et fonctions de la base

**Files:**
- Create: `supabase/migrations/20261114_autonomie_1_traces.sql`, `supabase/migrations/20261114_autonomie_1_traces_retour.sql`
- Test: `tests/sql/autonomie-preuve.sql`

**Interfaces:**
- Produces (schéma `public`) :
  - table `cours_lectures (stagiaire_id, promo_id, cours_id uuid, ouvert_le timestamptz, vu_le timestamptz,
    lu_le timestamptz null, fin_atteinte boolean, section text null)`, unique `(stagiaire_id, cours_id)` ;
  - table `autonomie_temps (stagiaire_id, promo_id, jour date, genre text check in ('cours','qcm'),
    ressource text, secondes integer)`, unique `(stagiaire_id, jour, genre, ressource)` ; `ressource` = identifiant du
    cours ou du QCM, en texte ; `jour` = date à Paris ;
  - table `autonomie_oppositions (stagiaire_id primary key, depuis timestamptz)` : droit d'opposition ; aucune
    lecture ni écriture accordée à `authenticated` ; remplie par `autonomie_opposer(p_stagiaire) returns void`,
    réservée au fondateur (`est_fondateur()`), qui inscrit le stagiaire et supprime ses lignes des deux tables ;
  - `autonomie_tracer_cours(p_cours uuid, p_secondes integer, p_fin boolean, p_section text) returns boolean` (rend
    vrai si le cours est lu après l'appel) ;
  - `autonomie_tracer_qcm(p_qcm bigint, p_secondes integer) returns void` (type de `p_qcm` : celui de `qcm.id`) ;
  - `autonomie_lectures_promo() returns table (cours_id uuid, lus integer)` pour la promo courante, réservée à qui a le
    geste `notes.lire` (sert « N sur T l'ont lu ») ;
  - constante de version des conditions : `VERSION_CONDITIONS_AUTONOMIE`, la date de la version mise en ligne en tâche 7
    (format `AAAA-MM-JJ`), écrite en dur dans les deux fonctions d'écriture.

Règles des fonctions d'écriture (`security definer`, `search_path` fixé, erreurs préfixées `autonomie:`), dans cet ordre :

1. `my_stagiaire_id()` nul : refus « autonomie: Réservé aux stagiaires. »
2. promo du stagiaire sans réglage `autonomie_active = 'true'` : refus silencieux (la fonction rend faux ou rien, sans
   erreur : l'app n'appelle pas quand c'est éteint, un appel direct ne doit rien écrire).
3. aucune ligne de `conditions_acceptations` pour l'adresse du jeton avec `version >= VERSION_CONDITIONS_AUTONOMIE` :
   refus silencieux.
3 bis. stagiaire inscrit dans `autonomie_oppositions` : refus silencieux.
4. `p_secondes` hors de 0 à 60 : refus « autonomie: Durée invalide. » ; au-delà de 28 800 s (8 h) cumulées dans le jour
   pour ce stagiaire, les secondes en trop sont ignorées.
5. cours non publié ou inconnu, QCM inconnu : refus « autonomie: Ressource introuvable. »
6. `p_section` : 80 caractères au plus, sinon tronquée.
7. cours : crée ou met à jour la ligne de `cours_lectures` (`ouvert_le` au premier appel, `vu_le` à chaque appel,
   `fin_atteinte` passe à vrai et n'en revient jamais), ajoute les secondes à `autonomie_temps` ; pose `lu_le = now()`
   s'il est nul, que `fin_atteinte` est vrai et que la somme des secondes du stagiaire sur ce cours atteint le
   plancher : `greatest(1, round(mots / 200.0)) * 60 * 0.3`, `mots` = nombre de mots de `corps_md` au moment de l'appel.

Règles RLS : lecture seule par `select`, sur le modèle exact de `qcm_attempts_lecture`
(`supabase/migrations/20261112_titres_3_regles.sql`) ; aucun `insert`, `update` ni `delete` accordé à `authenticated`
(tout passe par les fonctions). Les deux tables entrent dans ce que `_anonymiser_stagiaire` supprime (dernière
définition : `supabase/migrations/20261111_espaces_4_donnees.sql`) et dans l'effacement sur demande.

- [ ] **Step 1 : écrire la preuve qui échoue** (`tests/sql/autonomie-preuve.sql`, forme des preuves existantes : un bloc
  `DO` qui lève `VERT n/0` ou `ROUGE`, tout annulé). Contrôles, un par ligne de la liste « Règles » et du Review Focus :
  stagiaire sans interrupteur : 0 ligne ; sans acceptation : 0 ligne ; après `autonomie_opposer` : traces effacées et 0 ligne
  nouvelle, et un formateur ne peut pas appeler `autonomie_opposer` ; formateur : erreur ; 61 s : erreur ; -1 s :
  erreur ; 3 appels de 60 s sur un cours au plancher de 180 s avec `p_fin` au dernier : lu ; même chose sans `p_fin` :
  non lu ; `p_fin` puis secondes insuffisantes : non lu, puis lu quand le plancher est atteint ; cours rallongé après
  lecture : reste lu ; plafond de 8 h ; un autre stagiaire de la promo ne lit pas ces lignes ; le formateur de la promo
  les lit ; un formateur d'une autre promo non ; le siège non ; `autonomie_lectures_promo` compte 1 ; anonymisation :
  0 ligne restante ; `_retour.sql` joué : tables et fonctions absentes, `_anonymiser_stagiaire` revenue à sa définition
  précédente (comparaison par md5 de `pg_get_functiondef`, avant et après).
- [ ] **Step 2 :** `bash outils/base_locale/reconstruire.sh`, jouer la preuve : `ROUGE` attendu.
- [ ] **Step 3 :** écrire la migration et son retour (fins de ligne LF, pas de `$$` nu dans un bloc `DO` imbriqué : voir
  les pièges notés dans `outils/base_locale/LISEZMOI.md`).
- [ ] **Step 4 :** rejouer : `VERT n/0` ; rejouer la preuve des rôles (`tests/sql/roles-preuve.sql`) : toujours verte.
- [ ] **Step 5 :** commit « Autonomie : tables, fonctions d'écriture et preuve (non appliquée en production) ».

### Task 3 : couche base et interrupteur

**Files:**
- Modify: `js/db.js`
- Create: `js/autonomie-etat.js`
- Modify: `js/main.js` (chargement au démarrage, à côté de `chargerEmargementActif`), `js/views/config.js` (section)
- Modify: le faux client du banc (fichiers `_harness*` et `_preview_stubs/`) pour répondre aux nouvelles lectures
- Test: `tests/autonomie-etat.test.mjs` si une règle pure en sort ; sinon contrôle au banc

**Interfaces:**
- Consumes: `CLE_ACTIVATION`, `estActif` (tâche 1) ; fonctions de la base (tâche 2).
- Produces:
  - `db.tracerCours(coursId, { secondes, fin, section }) -> Promise<boolean>` ; `db.tracerQcm(qcmId, secondes) -> Promise<void>` ;
  - `db.listerMesLectures() -> Promise<[{ cours_id, ouvert_le, vu_le, lu_le, section }]>` ;
  - `db.listerAutonomie(stagiaireId) -> Promise<{ lectures, temps }>` (fiche, sous RLS) ;
  - `db.lecturesDeLaPromo() -> Promise<Map<cours_id, lus>>` ;
  - `chargerAutonomieActive() -> Promise<boolean>`, `autonomieActive() -> boolean`, `renderAutonomieReglage() -> Element|null`
    (fondateur hors aperçu seulement, même forme que `renderEmargementReglage`) ;
  - `peutTracer() -> boolean` : `autonomieActive()` et compte stagiaire réel (pas d'aperçu) et conditions acceptées.

- [ ] **Step 1 :** écrire les fonctions de `db.js` (appels `rpc` et `select`), `js/autonomie-etat.js` calqué sur
  `js/emargement-etat.js` (lecture bornée à 3,5 s, éteint en cas d'échec, évènement `autonomie-active`).
- [ ] **Step 2 :** texte de la section de Paramètres : titre « Travail en autonomie » ; explication « Allumé, l'app
  enregistre pour chaque stagiaire de la promo les cours lus et le temps passé sur les cours et les QCM d'entraînement.
  Le stagiaire voit ce que son formateur voit. Éteint, plus rien n'est enregistré ; ce qui l'a été reste en base. » ;
  case « Travail en autonomie activé pour « {promo} » ».
- [ ] **Step 3 :** banc : `?autonomie=1` allume l'interrupteur dans le faux client, qui garde les traces en mémoire.
- [ ] **Step 4 :** `node --test tests/` vert ; au banc, la section apparaît pour le fondateur et pas pour un formateur.
- [ ] **Step 5 :** commit.

### Task 4 : compteur de page et lecteur de cours

**Files:**
- Create: `js/autonomie-suivi.js`
- Modify: `js/views/cours-reader.js` (`openCoursSheet`)
- Test: `tests/autonomie-suivi.test.mjs` (avec `tests/aides-dom.mjs`)

**Interfaces:**
- Consumes: `creerCompteur`, `PERIODE_ECRITURE_MS` (tâche 1) ; `peutTracer`, `db.tracerCours` (tâche 3).
- Produces: `suivreEcran({ zone, ecrire }) -> { finAtteinte(), section(id), arreter() }` : écoute sur `zone`
  (défilement, clic, touche, toucher) et sur `document` (`visibilitychange`, `pagehide`) ; appelle
  `ecrire({ secondes, fin, section })` toutes les 30 s s'il y a des secondes ou un changement, à `arreter()` et au
  passage en arrière-plan ; si `ecrire` échoue, les secondes reviennent dans le cumul pour l'appel suivant ; aucune
  erreur ne remonte à l'écran.

- [ ] **Step 1 : tests qui échouent** : 45 s d'activité = un appel à 30 s (30 s) puis 15 s à `arreter()` ; écriture
  qui échoue puis réussit = total conservé ; `visibilitychange` vers masqué = écriture immédiate ; `finAtteinte()` et
  `section("s3")` portés par l'appel suivant ; `arreter()` retire tous les écouteurs (plus aucun appel ensuite).
- [ ] **Step 2 :** lancer : échec.
- [ ] **Step 3 :** écrire `js/autonomie-suivi.js`.
- [ ] **Step 4 :** brancher `openCoursSheet`, seulement si `peutTracer()` et que le cours a un texte : démarrer après le
  rendu ; `section(id)` quand un titre de niveau 2 passe en haut de la zone de défilement ; `finAtteinte()` quand un
  repère posé après le dernier bloc du cours (avant les boutons « suivante » et « QCM ») entre dans la zone
  (`IntersectionObserver`) ; `arreter()` dans `close()`. **Reprise** : à l'ouverture, si une lecture existe avec une
  `section` encore présente dans le cours et sans `lu_le`, défiler jusqu'à elle et afficher sous l'en-tête un bandeau
  « Tu reprends où tu en étais » avec le bouton « Revenir au début » ; le bandeau disparaît au premier défilement
  manuel de plus d'un écran.
- [ ] **Step 5 :** tests verts ; au banc (`?autonomie=1`, stagiaire, 375 px et ordinateur) : lire un cours, fermer,
  rouvrir : la reprise fonctionne ; en formateur : aucun appel d'écriture (journal du faux client vide).
- [ ] **Step 6 :** commit.

### Task 5 : QCM en entraînement

**Files:**
- Modify: `js/views/qcm.js` (`runEntrainement`)

**Interfaces:**
- Consumes: `suivreEcran` (tâche 4), `db.tracerQcm`, `peutTracer`.

- [ ] **Step 1 :** dans `runEntrainement`, si `peutTracer()` : `suivreEcran` sur la fenêtre de l'entraînement, avec
  `ecrire = ({ secondes }) => db.tracerQcm(full.id, secondes)` ; `arreter()` à la fermeture et à l'écran de résultat.
  Rien dans `runExam` ni `runExamPrescreen`.
- [ ] **Step 2 :** au banc : un entraînement de 2 minutes écrit environ 120 s sous le genre `qcm` ; un examen n'écrit rien.
- [ ] **Step 3 :** commit.

### Task 6 : marque « Lu » et compteur de la promo sur la ligne de thème

**Files:**
- Modify: `js/views/themes.js` (bouton Cours de `renderThemeRow`, vers la ligne 1438), `css/themes-lignes.css`

**Interfaces:**
- Consumes: `db.listerMesLectures`, `db.lecturesDeLaPromo`, `autonomieActive` ; la ligne de thème telle que la branche
  `progression-themes` l'a laissée (classes `prog-*` : ne pas y toucher).

- [ ] **Step 1 :** interrupteur allumé, vue stagiaire : le bouton Cours prend la classe `lu` et le libellé accessible
  « Relire le cours (lu) » quand `lu_le` existe, avec une coche et le mot « Lu » visibles (la couleur seule ne suffit
  pas) ; ouvert sans être lu : état actuel `deja-lu` inchangé. Interrupteur éteint : comportement actuel, à l'octet près.
- [ ] **Step 2 :** interrupteur allumé, vue équipe avec le geste `notes.lire` : sous le titre du thème, « N sur T l'ont
  lu », T = stagiaires en formation de la promo ; rien si le cours n'est pas publié.
- [ ] **Step 3 :** contraste AA dans les deux habillages (couleurs de l'app, couleurs ECF), 375 px sans défilement
  horizontal ; les états `prog-*` de la ligne sont identiques avant et après (capture comparée).
- [ ] **Step 4 :** commit.

### Task 7 : fiche « Travail en autonomie » et mise en ligne

**Files:**
- Modify: `js/views/mon-suivi.js` et le module de `partiesDeLaFiche` (nouvelle partie `autonomie`, libellé « Travail en
  autonomie », visible seulement interrupteur allumé, pour soi et pour l'équipe) ; `js/legal-data.js`
  (`VERSION_CONDITIONS` et texte validé par Timy) ; `js/nouveautes-data.js` ; guide de l'assistant
  (`supabase/functions/chatbot/`) ; `outils/parcours/` (deux parcours) ; `C:\Users\watch\Dev\ECSR\docs\legal\registre_traitements.md`
- Test: `tests/autonomie-rules.test.mjs` (déjà), parcours du robot

**Interfaces:**
- Consumes: `resumeAutonomie`, `formatDuree` (tâche 1) ; `db.listerAutonomie` (tâche 3).

- [ ] **Step 1 :** partie de la fiche, même rendu pour le stagiaire et pour l'équipe : quatre repères (« Cours lus : 12
  sur 57 », « Temps cette semaine : 1 h 05 », « Temps depuis le début : 14 h 20 », « Dernière activité : mardi 10
  novembre »), puis la liste des cours lus et commencés, du plus récent au plus ancien (titre, « Lu le … » ou
  « Commencé le … »), sans défilement horizontal. Sous le titre, côté stagiaire : « Ton formateur voit exactement cette
  page. » Sans aucune trace : « Rien pour l'instant. Les cours que tu lis et tes entraînements apparaîtront ici. »
- [ ] **Step 2 :** conditions d'utilisation : reprendre le texte validé de
  `docs/superpowers/specs/2026-11-12-e-learning-textes-donnees.md` ; `VERSION_CONDITIONS` = la date du jour de la mise
  en ligne ; reporter cette date dans `VERSION_CONDITIONS_AUTONOMIE` de la migration **avant** de l'appliquer ; registre
  des traitements mis à jour dans le même passage.
- [ ] **Step 3 :** Nouveauté (pour les stagiaires et l'équipe des promos allumées seulement : la rattacher à
  l'interrupteur comme celles de l'émargement, donc **aucune entrée tant qu'aucune vraie promo n'est allumée**) ; texte
  prêt : « Ton travail en autonomie, visible d'un coup d'œil : les cours que tu as lus et le temps que tu y passes
  s'affichent dans Mon suivi. Ton formateur voit la même page que toi. »
- [ ] **Step 4 :** robot : parcours « stagiaire lit un cours, le retrouve Lu, ouvre sa fiche » et « formateur ouvre la
  fiche d'un stagiaire » ; `python outils/robot_parcours.py` vert (un seul robot à la fois sur la machine).
- [ ] **Step 5 :** avec l'accord de Timy : appliquer la migration en production (une transaction, preuve rejouée en
  ligne, `VERT`), allumer la **promo de démonstration** seulement, y poser quelques traces fictives, fusionner et
  pousser. Nîmes et Montpellier restent éteintes jusqu'à sa décision.
- [ ] **Step 6 :** prévenir la coordination : dossier Qualiopi, l'indicateur 19 peut citer « lecture des cours et temps
  actif par stagiaire » pour une promo allumée.

## Ce que ce plan ne fait pas

- Exercices et scènes (lot 1b), travail de la semaine (lot 2), signaux et relances (lot 3), relevé PDF et chiffres du
  siège (lot 4).
- Aucune modification de `js/progression-rules.js` : l'état d'une ligne de thème reste décidé par les QCM.
- Aucun envoi de données à un service tiers : tout reste dans la base de l'app.
