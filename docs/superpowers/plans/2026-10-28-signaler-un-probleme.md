# Signaler un problème : plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** permettre à toute personne connectée de signaler un problème en deux gestes, contexte joint
d'office, et à Timy (fondateur) de le traiter et d'y répondre.

**Architecture :** une table `signalements_app` (+ `signalements_app_captures`) écrite seulement par des
fonctions `security definer` ; côté app, des règles pures testées en node (`js/signalement-rules.js`), un
journal des erreurs, un petit état des pastilles, une fenêtre commune aux deux navigations (mécanique de
`js/nav-fenetre.js`, styles à elle), les entrées dans la coquille, l'ancienne barre et l'Assistant, et une
page `#/problemes` réservée au fondateur.

**Tech Stack :** modules ES sans framework, Supabase (Postgres, RLS, rpc), `node --test`, Postgres local
(scoop) pour la preuve SQL, Playwright Python (Chromium et WebKit) pour la vérification au banc.

**Spec :** `docs/superpowers/specs/2026-10-28-signaler-un-probleme-design.md`

## Global Constraints

- Aucun tiret cadratin (U+2014) nulle part : code, CSS, SQL, textes, commits.
- « Formateur », jamais « Prof » ; tutoiement dans tous les textes.
- Contraste AA (4,5:1) de tout texte ajouté ; jamais de rouge pour un statut ou une erreur
  (`--c-stop` exclu) ; statuts : Nouveau ou Reçu `--accent-soft`/`--accent-strong`, En cours
  `--c-wait-soft`/`--c-wait`, Réglé `--c-go-soft`/`--c-go`, Pas retenu `--bg-soft`/`--text-soft`.
- Aucun défilement de côté, à toute largeur ; cibles de 44 px sur téléphone (moins de 700 px) ; champ de
  texte en 16 px sur téléphone (pas de zoom iOS).
- DA de Timy intacte : Canela pour le titre de page, Outfit, Geist Mono pour le technique, pastille au
  dessin de `.nav-pastille`.
- Valeurs : message 3 à 2 000 caractères (comptés en points de code, comme `char_length`), contexte 16 Ko
  au plus, image JPEG en `data:image/jpeg;base64,` de 700 000 caractères au plus, côté long 1 600 px,
  10 signalements par 24 h et par compte, purge à 12 mois, dix signalements dans « Mes signalements »,
  cinq erreurs de 300 caractères au plus dans le journal.
- Ne jamais pousser, ne rien appliquer en base réelle, ne pas fusionner dans `main` sans l'accord de Timy.
- Pas de changement à la page d'Accueil ni au Planning (lot 2) ; coquille touchée au plus petit.
- Chaque `import` ajouté porte `?v=20261028a` : le crochet de commit pose le jeton du jour.

## Review Focus

1. **Grosse photo au lieu d'une capture** (12 Mpx, 4 000 × 3 000) : réduite sous 700 000 caractères ou
   refusée avec une phrase claire, jamais une page figée. Test : tâche 8 (image de 4 000 × 3 000 générée
   dans la page).
2. **Texte collé avec émojis et retours à la ligne** : la limite de 2 000 se compte pareil des deux côtés.
   Test : tâche 1 (`verifierMessage` sur 2 000 et 2 001 émojis) et tâche 3 (même cas en SQL).
3. **Envoi raté** (session expirée, réseau, limite du jour) : texte et image gardés, raison dite. Test :
   tâche 8 (levier `__HARNESS_SIGNALER_FAIL`).
4. **Fondateur en aperçu « Voir en tant que »** : ni bloc « Problèmes signalés » ni page, pastille du rôle
   simulé. Test : tâche 8 (aperçu Stagiaire).
5. **Double toucher sur « Envoyer »** : un seul signalement. Test : tâche 8 (double clic, un seul appel).

---

### Task 1 : règles pures

**Files :**
- Create : `js/signalement-rules.js`
- Test : `tests/signalement-rules.test.mjs`

**Interfaces :**
- Consumes : `libellePastille(n)` de `js/nouveautes.js` (« » à 0, « 9+ » au-delà de 9).
- Produces :
  - constantes `MIN_MESSAGE = 3`, `LIMITE_MESSAGE = 2000`, `LIMITE_CAPTURE = 700000`,
    `COTE_MAX_CAPTURE = 1600`, `MAX_ERREURS = 5`, `LIMITE_ERREUR = 300`, `MAX_MES_SIGNALEMENTS = 10` ;
  - `lireNavigateur(ua: string, { maxTouchPoints = 0 } = {}) -> { navigateur: string, systeme: string }` ;
  - `classeAppareil(largeur: number) -> "téléphone" | "tablette" | "ordinateur"` (seuils 700 et 1 080) ;
  - `assemblerContexte(releve) -> object` (clés du § 6 de la spec, voir l'étape 3) ;
  - `resumeContexte(contexte, maintenant: Date) -> string` ;
  - `detailContexte(contexte) -> Array<[string, string]>` ;
  - `verifierMessage(texte: string) -> { ok: true, message: string } | { ok: false, erreur: string }` ;
  - `libelleStatut(statut: string, pour: "personne" | "fondateur") -> string` ;
  - `pastilleSignalement({ fondateur: boolean, nouveaux: number, suivis: number }) -> { texte: string, nom: string }` ;
  - `messageDemarrage({ fondateur, nouveaux, suivis }) -> string | null` ;
  - `entreeErreur({ type, message, source, quand: Date }) -> { a, type, message, source }` et
    `ajouterErreur(journal: Array, entree) -> Array` (les `MAX_ERREURS` dernières) ;
  - `dimensionsReduites(largeur, hauteur, coteMax = COTE_MAX_CAPTURE) -> { largeur, hauteur }` ;
  - `phraseErreur(message: string) -> string | null` (texte après « signalement: », sinon null) ;
  - `adresseSure(adresse: string) -> string | null`.

- [ ] **Step 1 : écrire les tests** (`node:test`, `assert/strict`, comme `tests/emargement-rules.test.mjs`)

```js
test("iPhone, Safari", () => assert.deepEqual(
  lireNavigateur("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"),
  { navigateur: "Safari 18.1", systeme: "iOS 18.1" }));
test("iPad qui se dit Mac (écran tactile)", () => assert.deepEqual(
  lireNavigateur("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", { maxTouchPoints: 5 }),
  { navigateur: "Safari 18.0", systeme: "iPadOS" }));
test("Chrome sur iPhone", () => assert.equal(lireNavigateur("... iPhone OS 17_5 ... CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1").navigateur, "Chrome 129"));
test("Android, Chrome", () => assert.deepEqual(
  lireNavigateur("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"),
  { navigateur: "Chrome 130", systeme: "Android 14" }));
test("Samsung Internet", () => assert.equal(lireNavigateur("... Android 13; SM-S911B ... SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36").navigateur, "Samsung Internet 25.0"));
test("Windows, Edge puis Firefox", () => {
  assert.deepEqual(lireNavigateur("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.56"), { navigateur: "Edge 130", systeme: "Windows" });
  assert.equal(lireNavigateur("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0").navigateur, "Firefox 132");
});
test("Mac, Chrome", () => assert.deepEqual(lireNavigateur("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"), { navigateur: "Chrome 130", systeme: "macOS" }));
test("inconnu", () => assert.deepEqual(lireNavigateur(""), { navigateur: "inconnu", systeme: "inconnu" }));
test("classe d'appareil", () => {
  assert.equal(classeAppareil(375), "téléphone"); assert.equal(classeAppareil(699), "téléphone");
  assert.equal(classeAppareil(700), "tablette"); assert.equal(classeAppareil(1079), "tablette");
  assert.equal(classeAppareil(1080), "ordinateur");
});
test("message : bornes en points de code", () => {
  assert.deepEqual(verifierMessage("  a "), { ok: false, erreur: "Écris quelques mots sur ce qui se passe." });
  assert.deepEqual(verifierMessage("  Le bouton ne marche pas \n"), { ok: true, message: "Le bouton ne marche pas" });
  assert.equal(verifierMessage("😀".repeat(2000)).ok, true);
  assert.deepEqual(verifierMessage("😀".repeat(2001)), { ok: false, erreur: "2 000 caractères au plus (tu en as 2 001)." });
});
test("résumé du contexte", () => {
  const c = assemblerContexte(RELEVE_IPHONE);   // releve complet défini en tête du fichier de test
  assert.equal(resumeContexte(c, new Date(2026, 9, 28, 10, 42)), "page Planning, iPhone, Safari 18, à 10 h 42");
  assert.equal(resumeContexte({ ...c, titre: "", systeme: "Windows", appareil: "ordinateur", navigateur: "Edge 130" },
    new Date(2026, 9, 28, 9, 5)), "page #/planning, ordinateur Windows, Edge 130, à 9 h 05");
});
test("contexte assemblé", () => {
  const c = assemblerContexte(RELEVE_IPHONE);
  assert.equal(c.appareil, "téléphone"); assert.equal(c.ecran, "390 × 844"); assert.equal(c.orientation, "portrait");
  assert.equal(c.page, "planning"); assert.equal(c.navigation, "ancienne"); assert.equal(c.installee, true);
  assert.equal(c.erreurs.length, 2); assert.equal(c.agent, RELEVE_IPHONE.ua);
  assert.ok(JSON.stringify(c).length < 16384);
});
test("détail en mots simples", () => {
  const lignes = new Map(detailContexte(assemblerContexte(RELEVE_IPHONE)));
  assert.equal(lignes.get("Page"), "Planning (#/planning)");
  assert.equal(lignes.get("App installée"), "oui");
  assert.equal(lignes.get("Écran"), "390 × 844, densité 3, portrait");
  assert.equal(lignes.has("Aperçu"), false);   // seulement quand un aperçu est actif
});
test("statuts", () => {
  assert.equal(libelleStatut("nouveau", "personne"), "Reçu"); assert.equal(libelleStatut("nouveau", "fondateur"), "Nouveau");
  assert.equal(libelleStatut("non_retenu", "personne"), "Pas retenu"); assert.equal(libelleStatut("regle", "fondateur"), "Réglé");
});
test("pastille et message de démarrage", () => {
  assert.deepEqual(pastilleSignalement({ fondateur: true, nouveaux: 2, suivis: 1 }), { texte: "2", nom: "Signaler un problème, 2 nouveaux signalements" });
  assert.deepEqual(pastilleSignalement({ fondateur: false, nouveaux: 0, suivis: 1 }), { texte: "1", nom: "Signaler un problème, 1 signalement a avancé" });
  assert.deepEqual(pastilleSignalement({ fondateur: false, nouveaux: 3, suivis: 0 }), { texte: "", nom: "Signaler un problème" });
  assert.equal(messageDemarrage({ fondateur: true, nouveaux: 1, suivis: 0 }), "1 nouveau problème signalé.");
  assert.equal(messageDemarrage({ fondateur: true, nouveaux: 2, suivis: 0 }), "2 nouveaux problèmes signalés.");
  assert.equal(messageDemarrage({ fondateur: false, nouveaux: 0, suivis: 1 }), "Ton signalement a avancé : ouvre « Signaler un problème » pour voir la suite.");
  assert.equal(messageDemarrage({ fondateur: false, nouveaux: 0, suivis: 2 }), "Tes signalements ont avancé : ouvre « Signaler un problème » pour voir la suite.");
  assert.equal(messageDemarrage({ fondateur: false, nouveaux: 5, suivis: 0 }), null);
});
test("journal : troncature et cinq au plus", () => {
  let j = [];
  for (let i = 0; i < 7; i++) j = ajouterErreur(j, entreeErreur({ type: "erreur", message: "x".repeat(400) + i, source: "a.js:1", quand: new Date(2026, 9, 28, 10, 41, i) }));
  assert.equal(j.length, 5); assert.equal(j[0].a, "10:41:02"); assert.equal(j[4].message.length, 300);
});
test("image réduite, jamais agrandie", () => {
  assert.deepEqual(dimensionsReduites(1179, 2556), { largeur: 738, hauteur: 1600 });
  assert.deepEqual(dimensionsReduites(4000, 3000), { largeur: 1600, hauteur: 1200 });
  assert.deepEqual(dimensionsReduites(800, 600), { largeur: 800, hauteur: 600 });
});
test("refus du serveur et adresse sûre", () => {
  assert.equal(phraseErreur('signalement: Tu as déjà envoyé 10 signalements aujourd\'hui.'), "Tu as déjà envoyé 10 signalements aujourd'hui.");
  assert.equal(phraseErreur("Failed to fetch"), null);
  assert.equal(adresseSure("#/stagiaires/12/epcf"), "#/stagiaires/12/epcf");
  assert.equal(adresseSure("javascript:alert(1)"), null); assert.equal(adresseSure("#/x\"onclick"), null); assert.equal(adresseSure(""), null);
});
```

`RELEVE_IPHONE` : `{ adresse: "#/planning", titre: "Planning", version: "20261028a", navigation: "ancienne",
espace: null, apercu: null, largeur: 390, hauteur: 844, densite: 3, tactile: true, ua: <l'agent iPhone
ci-dessus>, maxTouchPoints: 5, installee: true, langue: "fr-FR", enLigne: true, heure:
"2026-10-28T10:42:05.000Z", fuseau: "Europe/Paris", erreurs: [deux entrées] }`.

- [ ] **Step 2 : lancer, constater l'échec** : `node --test tests/signalement-rules.test.mjs` : FAIL (module absent).
- [ ] **Step 3 : écrire `js/signalement-rules.js`** (module pur, sans DOM)
  - `assemblerContexte` rend : `adresse`, `page` (premier segment après `#/`), `titre`, `version`,
    `navigation`, `espace`, `apercu`, `appareil`, `tactile`, `ecran` (« L × H » avec espaces fines
    insécables ou espaces simples, au choix, mais le même partout), `densite`, `orientation`
    (« portrait » si hauteur ≥ largeur, sinon « paysage »), `navigateur`, `systeme`, `agent` (l'agent brut,
    500 caractères au plus), `installee`, `langue`, `en_ligne`, `heure_appareil`, `fuseau`, `erreurs`.
  - `resumeContexte` : « page » + titre (ou l'adresse si pas de titre), puis l'appareil lisible (« iPhone »
    pour iOS sur téléphone, « iPad » pour iPadOS ou iOS sur tablette, « Mac » pour macOS, sinon
    « <appareil> <premier mot du système> », ou l'appareil seul si système inconnu), le navigateur sans sa
    version mineure, « à H h MM » (heure locale de `maintenant`).
  - `detailContexte` : lignes « Page », « Version de l'app », « Navigation » (« ancienne » ou « nouvelle,
    espace stagiaire » / « nouvelle, espace équipe »), « Aperçu » (si actif : « Stagiaire » ou
    « Formateur »), « Appareil » (« téléphone, tactile »), « Écran », « Navigateur », « Système », « App
    installée » (oui / non), « Langue », « Connexion » (en ligne / hors ligne), « Erreurs récentes » (le
    nombre, « aucune » à zéro).
  - `verifierMessage` compte avec `[...texte].length` ; le nombre du message d'erreur est écrit à la
    française (`toLocaleString("fr-FR")`, espace insécable normalisée en espace simple).
- [ ] **Step 4 : relancer** : `node --test tests/signalement-rules.test.mjs` : PASS.
- [ ] **Step 5 : commit** `Signaler un problème : règles pures (contexte, navigateur, statuts, pastilles)`.

### Task 2 : journal des erreurs

**Files :**
- Create : `js/journal-erreurs.js`
- Modify : `js/main.js` (première ligne d'import)
- Test : `tests/journal-erreurs.test.mjs`

**Interfaces :**
- Consumes : `entreeErreur`, `ajouterErreur` (tâche 1).
- Produces : `dernieresErreurs() -> Array<{ a, type, message, source }>` (copie). Le module s'installe à
  l'import : écouteurs `error` et `unhandledrejection` sur `window`, et `console.error` enveloppé (appelle
  toujours l'original ; une erreur de l'enveloppe ne remonte jamais).

- [ ] **Step 1 : test** : poser `globalThis.window = new EventTarget()` avant `await import(...)`, puis
  - un `Event("error")` portant `message: "boum"`, `filename: "https://x/js/planning.js?v=1"`, `lineno: 12`
    → `dernieresErreurs()[0]` vaut `{ type: "erreur", message: "boum", source: "planning.js:12", a: <hh:mm:ss> }` ;
  - un `Event("unhandledrejection")` portant `reason: new Error("rejet")` → type « promesse », message « rejet » ;
  - `console.error("chatbot:", new Error("x"))` → type « console », message « chatbot: x » ;
  - huit erreurs → cinq gardées.
- [ ] **Step 2 :** `node --test tests/journal-erreurs.test.mjs` : FAIL.
- [ ] **Step 3 :** écrire le module ; dans `js/main.js`, `import "./journal-erreurs.js?v=20261028a";`
  devient la toute première ligne d'import (avant `db.js`), pour capter les erreurs des autres modules.
- [ ] **Step 4 :** test PASS, puis `node --test "tests/*.test.mjs"` : tout vert.
- [ ] **Step 5 : commit** `Signaler un problème : journal des dernières erreurs de la page`.

### Task 3 : migration, retour et preuve SQL

**Files :**
- Create : `supabase/migrations/20261028_signalements_app.sql`, `supabase/migrations/20261028_signalements_app_retour.sql`
- Create : `tests/sql/signalements-app-schema-minimal.sql`, `tests/sql/signalements-app-preuve.sql`

**Interfaces :**
- Produces (SQL, tout en `public`, `security definer`, `set search_path to 'public', 'pg_temp'`) :
  - `signaler_probleme(p_message text, p_contexte jsonb default '{}', p_capture text default null) returns bigint` ;
  - `traiter_signalement_app(p_id bigint, p_statut text, p_reponse text) returns void` ;
  - `marquer_suivis_vus() returns integer` ;
  - `mes_signalements_app() returns setof` (`id, created_at, message, statut, reponse, repondu_le, suivi_le, suivi_lu_le, avec_capture`) ;
  - `compter_signalements_app() returns jsonb` (`{"nouveaux": n, "suivis": m}`).
  - Refus : `raise exception 'signalement: <phrase>'` : « Reconnecte-toi pour signaler un problème. »,
    « Écris quelques mots sur ce qui se passe. », « 2 000 caractères au plus. », « Le détail joint est
    trop long. », « La capture n'est pas une image valable. », « La capture est trop lourde. », « Tu as
    déjà envoyé 10 signalements aujourd'hui. Réessaie demain. », « Réservé à l'éditeur. », « Statut
    inconnu. », « Signalement introuvable. ».

- [ ] **Step 1 : schéma minimal local** : sur le modèle de `tests/sql/qcm-ia-schema-minimal.sql` (rôles
  Supabase, `auth.users`, `auth.jwt()`, `auth.uid()` lu dans le `sub` des claims, privilèges par défaut),
  tables `lieux`, `promos`, `stagiaires`, `profs`, `user_profiles` avec les colonnes de la base réelle
  utiles ici, et les fonctions `is_founder()`, `peut_acceder_promo(int)`, `promo_par_defaut()`,
  `promo_courante()` **copiées de la base réelle** (`pg_get_functiondef`, lecture seule).
- [ ] **Step 2 : preuve** : bloc `do $preuve$` qui lève toujours « VERT n/0 » ou « ROUGE ... » (même
  forme que `qcm-ia-preuve.sql`), données en `example.invalid`, comptes : stagiaire A, stagiaire B,
  formateur F (non fondateur), fondateur T (rôle stagiaire, `is_founder`), chacun dans `auth.users` avec
  un `sub`. Cas, chacun compté :
  1. A envoie : id rendu ; ligne avec l'adresse de A, nom « P. Alpha » (initiale du nom, prénom), rôle
     `stagiaire`, promo de A ; F envoie : rôle `formateur`, nom du formateur ; T : rôle `fondateur`.
  2. Insertion directe (`insert into signalements_app ...` en rôle `authenticated`) refusée ; idem pour
     `signalements_app_captures` ; `update` direct sans effet.
  3. B ne voit aucun signalement de A (ni la ligne, ni la capture) ; A voit le sien et sa capture.
  4. T voit tout ; `mes_signalements_app()` de T ne rend que les siens.
  5. A ne peut ni traiter ni supprimer ; T peut traiter et supprimer.
  6. T passe le signalement de A à `regle` sans réponse : `suivi_le` posé, `suivi_lu_le` vide,
     `compter_signalements_app()` de A rend `suivis = 1`, celui de T `nouveaux` = le compte des `nouveau`.
  7. B appelle `marquer_suivis_vus()` : 0, rien ne change chez A ; A : 1, puis `suivis = 0`.
  8. T écrit une réponse : suivi reposé et non vu ; T repasse à `nouveau` sans toucher la réponse :
     aucun nouveau suivi.
  9. Message de 2 caractères refusé ; 2 001 émojis refusés ; 2 000 acceptés.
  10. Contexte tableau JSON refusé ; contexte de plus de 16 Ko refusé.
  11. Capture `data:image/png;base64,...` refusée ; JPEG de plus de 700 000 caractères refusé ; JPEG
      court accepté (`avec_capture` vrai, une ligne de capture).
  12. Dix envois de A acceptés sur 24 h (en comptant ceux déjà faits), le suivant refusé avec la phrase
      de la limite.
  13. Un signalement daté de 13 mois (inséré en superutilisateur) disparaît au prochain envoi.
  14. Sans claims (session absente) : envoi refusé.
  15. `delete from auth.users` de A : ses signalements et ses captures partent.
- [ ] **Step 3 : lancer sur une base locale jetable, constater l'échec** (dans le dossier de travail
  temporaire, port 55433) : `initdb -D <tmp>/pg -U postgres --auth=trust -E UTF8`,
  `pg_ctl -D <tmp>/pg -o "-p 55433" start`, `createdb -p 55433 -U postgres sg`, puis
  `psql -p 55433 -U postgres -d sg -f tests/sql/signalements-app-schema-minimal.sql` et
  `psql ... -1 -f tests/sql/signalements-app-preuve.sql` : erreur (tables absentes).
- [ ] **Step 4 : écrire la migration** (tables, contraintes du § 7.1 de la spec, `enable row level
  security`, politiques `signalements_app_select` (`user_id = auth.uid() or is_founder()`),
  `signalements_app_delete` (`is_founder()`), `signalements_app_captures_select` (par le signalement
  parent), `revoke insert, update on ... from anon, authenticated`, fonctions ci-dessus avec
  `revoke execute ... from public, anon` puis `grant execute ... to authenticated`, index
  `(user_id, created_at)` et `(statut)`), et le retour (`drop` dans l'ordre inverse). En-tête de la
  migration : spec, rôle de chaque objet, mention « droits à reprendre par le lot 4 (rôles et portées) ».
- [ ] **Step 5 : rejouer** : schéma, migration, preuve : « VERT 15/0 » (ou le nombre de cas réel, 0 échec).
- [ ] **Step 6 : contre-épreuve** : migration sabotée dans une copie temporaire (lecture `using (true)`,
  puis `traiter` sans contrôle du fondateur) : la preuve dit ROUGE sur les cas 3, 4 et 5. Puis le retour
  sur une base migrée : aucune erreur, plus aucun objet `signal%`.
- [ ] **Step 7 : arrêter la base locale** (`pg_ctl ... stop`), consigner le résultat en tête de la preuve
  (date, VERT n/0, ROUGE de la contre-épreuve), commit `Signaler un problème : migration, retour et preuve SQL (VERT n/0 en local)`.

### Task 4 : accès aux données, état des pastilles, banc

**Files :**
- Modify : `js/db.js` (nouvelle section « Signalements de problème », après celle des QCM)
- Create : `js/signalement-etat.js`
- Modify : `js/auth-admin.js` (une fonction exportée)
- Modify (hors git) : `_harness_supabase.js` du worktree, puis la même section recopiée dans celui de
  `C:\Users\watch\Dev\ECSR\TP_ECSR_App` en fin de chantier

**Interfaces :**
- Consumes : fonctions SQL de la tâche 3 ; `phraseErreur` (tâche 1).
- Produces :
  - dans `js/db.js` : `signalerProbleme({ message, contexte, capture }) -> Promise<number>`,
    `mesSignalementsApp() -> Promise<Array>`, `compterSignalementsApp() -> Promise<{ nouveaux, suivis }>`,
    `marquerSuivisVus() -> Promise<number>`, `listSignalementsApp() -> Promise<Array>` (colonnes nommées,
    jamais `*`, avec `promo:promos(nom)`, plus récent d'abord), `captureSignalementApp(id) -> Promise<string | null>`,
    `traiterSignalementApp(id, { statut, reponse }) -> Promise<void>`, `supprimerSignalementApp(id) -> Promise<void>`.
    Une erreur levée porte la phrase de `phraseErreur`, ou « L'envoi n'a pas abouti. Vérifie ta connexion
    et réessaie. » ;
  - dans `js/signalement-etat.js` (n'importe que `db.js`) : `chargerEtatSignalements() -> Promise<{ nouveaux, suivis }>`
    (garde l'état précédent si la lecture échoue), `etatSignalements()`, `poserEtatSignalements(etat)`,
    `onSignalementsChange(cb) -> () => void` ;
  - dans `js/auth-admin.js` : `fondateurHorsApercu() -> boolean` (`isFounder() && !getViewAs()`).
  - banc : `?signalements=1` sème trois signalements (un `nouveau` avec capture, un `en_cours`, un `regle`
    avec réponse non vue de l'utilisateur du banc) ; `?fondateur=0` retire `is_founder` du profil du
    banc ; `?nav2=1` pose la ligne `navigation_v2` de `settings` dans le format que lit `js/nav-etat.js` ;
    les fonctions de la tâche 3 répondent en mémoire ; `window.__HARNESS_SIGNALEMENTS_ENVOYES` reçoit
    chaque envoi ; `window.__HARNESS_SIGNALER_FAIL = "phrase"` fait échouer l'envoi avec
    `signalement: phrase`.

- [ ] **Step 1 :** écrire les huit fonctions de `db.js` (rpc pour les cinq fonctions SQL, `from(...)`
  pour la liste, la capture et la suppression), `signalement-etat.js` et `fondateurHorsApercu`.
- [ ] **Step 2 :** enrichir le banc, `node _harness_build.mjs`, ouvrir le banc et vérifier dans la page
  (outil JavaScript du navigateur) : `compterSignalementsApp()` rend `{ nouveaux: 1, suivis: 1 }` avec
  `?signalements=1` ; `signalerProbleme(...)` remplit `__HARNESS_SIGNALEMENTS_ENVOYES`.
- [ ] **Step 3 :** `node --test "tests/*.test.mjs"` vert ; commit `Signaler un problème : accès aux données et état des pastilles`.

### Task 5 : la fenêtre « Signaler un problème »

**Files :**
- Create : `js/signalement.js`, `css/signalement.css`
- Modify : `index.html` (lien vers `css/signalement.css?v=20261028a`, après `navigation.css`),
  `js/icons.js` (icône `signaler`)

**Interfaces :**
- Consumes : `ouvrirFenetre`, `fermerFenetre` (`js/nav-fenetre.js`) ; tâches 1, 2 et 4 ;
  `navigationV2Active()` (`js/nav-etat.js`) ; `getViewAs`, `fondateurHorsApercu` ; `toast`, `el`.
- Produces : `ouvrirSignalement({ ancre = null } = {}) -> void` (le seul export) ; `icon.signaler()` :
  Lucide `message-square-warning`, chemins `M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z`,
  `M12 7v2`, `M12 13h.01`.
- Crochets : calque `[data-nav-coquille="signaler"]` (posé par `ouvrirFenetre`, `nom: "signaler"`),
  fenêtre `.signalement-fenetre`, champ `#sg-message` (étiquette visible « Que s'est-il passé ? »),
  boutons `[data-sg="capture"]`, `[data-sg="retirer"]`, `[data-sg="envoyer"]`, `[data-sg="fermer"]`,
  ligne `.sg-joint` et son `details.sg-detail`, bloc `.sg-fondateur`, liste `.sg-mes`, message
  `.sg-erreur` (`role="alert"`).

- [ ] **Step 1 : écrire `js/signalement.js`**
  - Relevé du contexte au moment de l'ouverture : adresse (`location.hash`), titre (premier `h1` puis `h2`
    de `#view`, 120 caractères au plus), version (`new URL(import.meta.url).searchParams.get("v")`),
    navigation (`navigationV2Active()`), espace (`document.body.dataset.espace`), aperçu (`getViewAs()`),
    taille de fenêtre, `devicePixelRatio`, `matchMedia("(pointer: coarse)")`, `navigator.userAgent`,
    `navigator.maxTouchPoints`, installée (`matchMedia("(display-mode: standalone)")` ou
    `navigator.standalone`), langue, `navigator.onLine`, heure, fuseau (`Intl`), `dernieresErreurs()`.
  - Contenu, dans l'ordre du § 4.1 de la spec ; chez le fondateur hors aperçu, en tête, « Problèmes
    signalés : N nouveaux » (« aucun nouveau » à zéro) et le lien « Ouvrir » (`href="#/problemes"`).
  - Capture : `input type="file" accept="image/*"` caché ; `lireCapture(fichier)` (interne) décode
    (`createImageBitmap`, repli `Image`), réduit par `dimensionsReduites`, encode en JPEG 0,72, puis 0,6,
    puis côté long 1 200 à 0,6 ; au-delà de `LIMITE_CAPTURE` ou illisible : « Cette image ne passe pas :
    choisis une capture d'écran (PNG ou JPEG). » ; miniature et « Retirer ».
  - Envoi : `verifierMessage` ; pendant l'envoi, « Envoyer » devient « Envoi… » et ignore un second
    toucher ; succès : brouillon vidé, `fermerFenetre()`, `toast("Merci, c'est transmis. La réponse
    s'affichera dans « Signaler un problème ».", "success", 4500)`, `chargerEtatSignalements()` ; échec :
    fenêtre ouverte, texte et image gardés, `.sg-erreur` : « L'envoi n'a pas abouti : <raison> Ton texte
    est gardé, réessaie. ».
  - « Mes signalements » : chargé à l'ouverture (`mesSignalementsApp`), au plus dix, statut par
    `libelleStatut(…, "personne")`, réponse sous le message ; ceux dont `suivi_le` est posé et
    `suivi_lu_le` vide portent « Nouveau », puis `marquerSuivisVus()` et
    `poserEtatSignalements({ ...etatSignalements(), suivis: 0 })`. Liste vide : rien n'est affiché.
    Lecture ratée : « Tes signalements n'ont pas pu être chargés. » (le formulaire reste utilisable).
  - Brouillon (texte, image) gardé en mémoire du module jusqu'à l'envoi réussi.
- [ ] **Step 2 : écrire `css/signalement.css`** : calque `[data-nav-coquille="signaler"]` en
  `z-index: 1600` dans les deux navigations ; fenêtre centrée, largeur `min(520px, 100vw - 24px)`,
  hauteur bornée à l'écran, défilement vertical interne ; sous 700 px, collée en bas (marge de sécurité
  comprise) ; `.nav-fenetre-haut` masqué dans cette fenêtre (son propre en-tête porte « Fermer ») ;
  règles qui battent les règles `body[data-nav="v2"] .nav-fenetre` (largeur, marge interne) ; pastilles
  de statut aux couleurs des contraintes globales ; erreurs techniques en Geist Mono.
- [ ] **Step 3 : vérifier au banc** (aperçu du navigateur sur l'entrée `banc-signalement`, voir tâche 8) :
  `(await import("./js/signalement.js?v=<jeton du banc>")).ouvrirSignalement()` ouvre la fenêtre dans les
  deux navigations ; Échap la ferme ; un envoi remplit `__HARNESS_SIGNALEMENTS_ENVOYES` avec les clés du
  contexte ; capture d'écran à 1 280 et à 375 px.
- [ ] **Step 4 : commit** `Signaler un problème : la fenêtre (message, capture, contexte joint, mes signalements)`.

### Task 6 : les entrées et les pastilles

**Files :**
- Modify : `js/nav-shell.js`, `js/menu-compte.js`, `js/chatbot.js`, `js/auth-admin.js`, `js/main.js`,
  `css/signalement.css`

**Interfaces :**
- Consumes : `ouvrirSignalement` (tâche 5) ; `etatSignalements`, `onSignalementsChange`,
  `chargerEtatSignalements` (tâche 4) ; `pastilleSignalement`, `messageDemarrage` (tâche 1) ;
  `fondateurHorsApercu`.
- Produces : `ouvrirMenuCompte(ancre, { actualiser, entrees, espace })` (nouveau paramètre `espace`,
  passé par les deux appels de `nav-shell.js`).

- [ ] **Step 1 : coquille** (`js/nav-shell.js`) : `boutonSignaler(classe, geste, ...contenu)` sur le modèle
  de `boutonAssistant` (`data-nav-action="signaler"`, `title` et `aria-label` = `pastilleSignalement(...).nom`,
  pastille `.nav-pastille` dans le bouton quand `texte` n'est pas vide) ; pied de barre latérale entre
  Assistant et compte (classe `nav-entree nav-cote-signaler`, libellé « Signaler un problème » dans
  `.nav-entree-texte`, masqué en colonne d'icônes comme les autres) ; tiroir « Plus », section « Outils »,
  après Assistant (ferme le tiroir puis ouvre la fenêtre, ancre = bouton « Plus ») ; un abonnement
  `onSignalementsChange` qui renomme et repastille les boutons `[data-nav-coquille] [data-nav-action="signaler"]`.
  Sur téléphone, le pied de barre reste masqué comme aujourd'hui (le tiroir porte l'entrée).
- [ ] **Step 2 : menu du compte** (`js/menu-compte.js`) : espace stagiaire seulement, après « Actualiser »,
  ligne « Signaler un problème » (icône `signaler`, pastille comme les nouveautés), qui ouvre la fenêtre
  (ancre : le bouton du compte qui a ouvert le menu).
- [ ] **Step 3 : Assistant** (`js/chatbot.js`) : sous l'avertissement, `<p class="chatbot-signaler">Un souci
  avec l'app ? <button type="button" class="chatbot-signaler-btn" data-sg-entree="assistant">Signaler un
  problème</button></p>` ; au clic, import dynamique de `signalement.js`, `ouvrirSignalement({ ancre: bouton })` ;
  bouton de 44 px de haut sur téléphone.
- [ ] **Step 4 : ancienne navigation** (`js/auth-admin.js`, `openProfileMenu`) : après le bouton de la page
  à soi, bouton `btn full` « Signaler un problème » (`data-sg-entree="compte"`, icône, pastille) ; chez le
  fondateur hors aperçu, bouton « Problèmes signalés » (nombre de nouveaux) qui mène à `#/problemes` ; les
  deux ferment la fenêtre « Mon compte » ; la fenêtre de signalement prend pour ancre `.admin-badge` ;
  import dynamique de `signalement.js` (pas de cycle avec `auth-admin.js`).
- [ ] **Step 5 : démarrage** (`js/main.js`) : après `majPresenceModules()` au démarrage,
  `chargerEtatSignalements()` puis, si `messageDemarrage(...)` rend une phrase, `toast(phrase, "info", 6000)`
  1,5 s plus tard ; `actualiser()` et `onAdminChange` relisent l'état (sans message).
- [ ] **Step 6 : vérifier** : `node --test "tests/*.test.mjs"` vert ; `python outils/verifier_navigation.py`
  sans nouvel échec (les nouvelles entrées font 44 px, ne débordent pas, ne s'allument jamais comme page) ;
  au banc, chaque entrée ouvre la fenêtre et rend le focus à la fermeture.
- [ ] **Step 7 : commit** `Signaler un problème : entrées dans la coquille, l'ancienne barre et l'Assistant`.

### Task 7 : la page « Problèmes signalés »

**Files :**
- Create : `js/views/problemes.js`
- Modify : `js/main.js` (route, garde, onglet allumé), `js/nav-rules.js` (alias), `tests/nav-rules.test.mjs`,
  `css/signalement.css`

**Interfaces :**
- Consumes : `listSignalementsApp`, `captureSignalementApp`, `traiterSignalementApp`,
  `supprimerSignalementApp`, `chargerEtatSignalements` ; `libelleStatut`, `resumeContexte`,
  `detailContexte`, `adresseSure` ; `renderSubTabs` (`js/subtabs.js`) ; `fondateurHorsApercu`.
- Produces : `renderProblemes(container) -> Promise<void>`.

- [ ] **Step 1 : test** (dans `tests/nav-rules.test.mjs`) : `entreeActive("problemes", <entrées de l'équipe>)`
  vaut `"config"` ; lancer : FAIL.
- [ ] **Step 2 :** alias `["problemes", "config"]` dans `ALIAS_ENTREE_ACTIVE` ; test PASS.
- [ ] **Step 3 : la page** : en-tête `.view-header` (`h1` « Problèmes signalés », `p.muted` « Signalements
  envoyés depuis l'app par les stagiaires et les formateurs. Toi seul les vois. ») ; sous-onglets
  « À traiter (n) », « Réglés (n) », « Tous (n) » (`storageKey: "problemes.subtab"`) ; cartes du § 4.3 de
  la spec, crochets `[data-sg-id]`, boutons de statut `[data-sg-statut]` (`aria-pressed`), champ de réponse,
  `[data-sg="repondre"]`, `[data-sg="voir-capture"]`, `[data-sg="supprimer"]` (`confirm("Supprimer ce
  signalement ? Il disparaît aussi chez la personne.")`), lien « Ouvrir la page » seulement si
  `adresseSure` le permet ; une action met la carte à jour sur place (elle ne change pas de sous-onglet
  avant le prochain affichage) puis relit l'état des pastilles ; état vide du § 4.3 ; garde interne :
  hors fondateur, « Page réservée à l'éditeur. ».
- [ ] **Step 4 : routeur** (`js/main.js`) : `problemes: renderProblemes` ; avant la garde de la page à soi,
  `route === "problemes" && !fondateurHorsApercu()` ramène sur `#/mon-suivi` ; `ONGLET_POUR_ROUTE.problemes = "config"`.
- [ ] **Step 5 : vérifier** : tests verts ; au banc (`?role=fondateur&signalements=1#/problemes`) trois
  cartes, sous-onglets justes, statut et réponse journalisés par le banc ; `?role=prof` sur la même
  adresse ramène ailleurs.
- [ ] **Step 6 : commit** `Signaler un problème : la page Problèmes signalés (fondateur)`.

### Task 8 : script de vérification et captures

**Files :**
- Create : `outils/verifier_signalement.py`
- Modify (hors git) : `C:\Users\watch\Dev\ECSR\.claude\launch.json` (entrée `banc-signalement`, port 8060,
  `python -m http.server 8060 --bind 127.0.0.1 --directory C:/Users/watch/Dev/ecsr-promo-signalement`),
  retirée en fin de chantier

**Interfaces :**
- Consumes : leviers du banc (tâche 4), crochets des tâches 5 à 7 ; `lancer_navigateur` et
  `moteur_installe` importés de `outils/verifier_navigation.py` (garde `__main__` vérifiée).
- Produces : `python outils/verifier_signalement.py [URL] [--moteurs chromium,webkit] [--captures DOSSIER]` :
  dernière ligne « N vues, M échec(s) », code 1 en cas d'échec, 2 si le banc ne répond pas.

- [ ] **Step 1 : écrire le script.** Contextes : moteurs × {stagiaire (`?role=stagiaire&fondateur=0`),
  formateur (`?role=prof`), fondateur (`?role=fondateur&signalements=1`)} × {ancienne, nouvelle (`?nav2=1`)}
  × {1 280, 900, 375 px}. Dans chaque contexte :
  - chaque entrée du § 5.1 de la spec présente là où elle doit l'être, absente ailleurs (pas de ligne
    dans le menu du compte de l'équipe sous la nouvelle navigation) ; 44 px au moins sous 700 px ;
  - ouverture, focus dans la fenêtre, Échap, focus rendu (jamais `body`) ;
  - envoi : un appel, contexte avec `adresse`, `version`, `appareil`, `navigateur`, `erreurs` ; double
    clic : un seul appel ; `__HARNESS_SIGNALER_FAIL` : texte gardé, `.sg-erreur` lisible ;
  - image de 4 000 × 3 000 générée dans la page, posée sur le champ fichier par `DataTransfer` : la valeur
    envoyée commence par `data:image/jpeg;base64,` et fait 700 000 caractères au plus ;
  - fondateur : bloc « Problèmes signalés », page `#/problemes` (sous-onglets, statut, réponse,
    suppression), et, en aperçu Stagiaire, ni bloc ni page ;
  - aucun défilement de côté (`scrollWidth <= innerWidth`), contraste AA des textes `.sg-*` et
    `.chatbot-signaler`, aucune erreur de console ;
  - aucun tiret cadratin dans les fichiers créés ou modifiés par ce chantier.
- [ ] **Step 2 : lancer** (serveur `banc-signalement` démarré) : « N vues, 0 échec(s) » dans les deux moteurs.
- [ ] **Step 3 : captures** (`--captures captures/signalement`) : stagiaire et formateur, ordinateur et
  téléphone, ancienne et nouvelle navigation, fenêtre ouverte ; page du fondateur à 1 280 et 375 px.
- [ ] **Step 4 : commit** `Signaler un problème : script de vérification au banc`.

### Task 9 : textes légaux, registre, Nouveautés

**Files :**
- Modify : `js/legal-data.js`, `js/nouveautes-data.js`
- Modify (dépôt ECSR, non commité) : `C:\Users\watch\Dev\ECSR\docs\legal\registre_traitements.md`

- [ ] **Step 1 :** `js/legal-data.js` (version inchangée) : § 3, ligne « Contributions » : « Signalements
  d'erreur sur les QCM ; signalements de problème sur l'application (message, capture facultative, page,
  appareil et navigateur utilisés) » ; § 4, ligne « Signalements de problème | Oui | Non | Non | Non »
  et, sous le tableau, « Les signalements de problème ne sont lus que par l'éditeur. » ; § 10, ligne
  « Signalements de problème | Douze mois au plus, ou jusqu'à la fermeture du compte ».
- [ ] **Step 2 :** entrée Nouveautés : `id: "2026-10-28-signaler-un-probleme"`, `pour: "tous"`, titre
  « Signaler un problème en deux gestes », résumé au tutoiement (un bug, un bouton qui ne réagit pas,
  quelque chose de pas clair : tu l'écris, la page, l'appareil et l'heure partent avec, une capture est
  possible, la réponse s'affiche au même endroit), `guide` : « Touche ton nom en haut de l'écran, ou
  ouvre l'Assistant. », « Choisis « Signaler un problème ». », « Écris ce qui se passe, ajoute une capture
  si tu veux, puis « Envoyer ». ».
- [ ] **Step 3 :** registre : section « 7. Signalements de problème sur l'application » (contenu du § 8 de
  la spec), date de mise à jour, ligne dans « Actions de mise en conformité ».
- [ ] **Step 4 :** `node --test "tests/*.test.mjs"` (dont `legal-rules` et `nouveautes`) vert ; commit
  `Signaler un problème : conditions d'utilisation et Nouveautés`.

### Task 10 : relecture de la branche et présentation à Timy

- [ ] **Step 1 :** relecture de toute la branche par un relecteur frais (agent sur le modèle le plus
  capable), sur le diff `main...signaler-probleme` et la spec ; corriger ce qui est fondé, rejouer
  `node --test`, `verifier_navigation.py` et `verifier_signalement.py`.
- [ ] **Step 2 :** compte rendu structuré à Timy (bilan, tableau d'état, schéma, captures, migration et son
  retour, commits) ; attendre son accord avant toute application en base et toute fusion.
- [ ] **Step 3 (après accord) :** appliquer la migration (outil MCP `apply_migration`), rejouer la preuve
  sur la base réelle (bloc qui s'annule), conseillers de sécurité Supabase sans nouvel avertissement ;
  mettre la branche à jour avec `main`, fusionner (`git merge --no-ff --no-commit`, puis `git commit -F`),
  vérifier qu'aucune ligne ne diffère hors jeton `?v=` ; fin de chantier selon la consigne (worktree,
  branche, `launch.json`, `ROADMAP.md`, `POINT-DE-REPRISE.md`, récap WhatsApp, banc recopié dans
  `TP_ECSR_App`, note pour la conversation des rôles).
