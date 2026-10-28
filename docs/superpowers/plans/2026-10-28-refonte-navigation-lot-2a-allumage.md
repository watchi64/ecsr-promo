# Refonte de la navigation, lot 2A : prête à allumer - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger ce que les tests du 28/10 ont montré sur la vraie app, interrupteur allumé, pour qu'une vraie promo puisse passer à la nouvelle navigation sans attendre les nouvelles pages (lot 2B) : Nouveautés et textes propres à chaque navigation, compte et réglages séparés, élèves bénévoles sous Stagiaires, assistant visible sur le téléphone de l'équipe, titres alignés sur le menu, défauts du planning et de l'accueil, défilements de côté, restes du lot 1, pastilles « à traiter ».

**Architecture:** Chaque changement visible de ce lot passe par `navigationV2Active()` (`js/nav-etat.js`) et ne touche donc que les promos allumées (et l'aperçu du fondateur). Deux corrections valent pour tous, parce que ce sont des défauts de main au sens des règles de Timy : le décompte d'un événement déjà commencé (« -2 jours ») et les défilements de côté ; elles sont annoncées par une Nouveauté « pour tous ». Les règles nouvelles vivent dans des modules purs testés en node ; le reste est du rendu dans les vues existantes.

**Tech Stack:** JavaScript en modules ES sans framework, CSS, Supabase (lectures par `js/db.js`), tests `node --test`, banc d'essai `_harness.html` et Playwright (Python) pour `outils/verifier_navigation.py`.

**Spec:** `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md` ; maquette `docs/maquettes/refonte-navigation.src.html` ; découpage `docs/superpowers/plans/2026-10-27-refonte-navigation-lots.md` ; annexes du lot 1 (`docs/superpowers/plans/2026-10-27-refonte-navigation-lot-1-coquille.md`, décisions R1 à R36) ; constats du 28/10 `docs/superpowers/plans/2026-10-28-refonte-navigation-constats.md` (tests du premier clic et inventaire des écarts, écrit en Task 0).

## Global Constraints

- Garder la DA de Timy : vert mint et gris sauge (jetons de `css/style.css`), Canela pour les titres, Outfit, Geist Mono, barre sombre espresso, pastille de date au grand chiffre vert, salutation avec le nom en vert, échelle douce des notes ; aucun style neuf hors des jetons existants.
- Interrupteur éteint = main : pour une promo dont l'interrupteur est éteint, rien ne change, sauf les deux corrections pour tous des Tasks 4 et 5.
- Aucun défilement de côté, à aucune largeur ; seule exception admise : la matrice des notes (`.matrice-wrap`).
- Téléphone : moins de 700 px de large ; zones à toucher de 44 px au moins ; contraste du texte 4,5:1 (3:1 pour le grand texte et les contrôles) ; jamais une note en rouge.
- Libellés : « Formateur », jamais « Prof » ; tutoiement pour les stagiaires ; un seul nom par destination, celui du menu ; jamais de tiret cadratin (U+2014), ni dans le code ni dans les commentaires.
- Aucune dépendance ajoutée ; chaque nouvelle ligne `import` porte le même jeton `?v=` que ses voisines.
- Worktree `C:/Users/watch/Dev/ecsr-promo-lot2`, branche `lot2-accueils` ; commits locaux ; jamais de `git push` ni de fusion sans l'accord de Timy.
- Tests : `node --test "tests/*.test.mjs"` (1 067 au départ, glob obligatoire), tous verts à chaque commit ; `python outils/verifier_navigation.py` sans échec à la fin de chaque tâche qui touche l'affichage (serveur du banc : entrée `banc-lot2` de `C:/Users/watch/Dev/ECSR/.claude/launch.json`, port 8050).

## Review Focus

1. Une promo éteinte (la plupart, au début) : aucune Nouveauté marquée « nouvelle navigation », aucun texte « Mon suivi », `#/config` inchangé, pas de point sur le compte.
2. Le fondateur en aperçu sur son appareil, promo éteinte : il voit les textes et Nouveautés de la nouvelle navigation, ses stagiaires non (la décision suit `navigationV2Active()`, jamais un réglage lu ailleurs).
3. Événements autour d'aujourd'hui : un événement d'un jour aujourd'hui, un stage commencé avant-hier, un événement terminé hier, un autre qui commence demain ; jamais de nombre négatif, l'événement terminé n'est plus « prochain ».
4. Le téléphone de l'équipe à 320 px : en-tête avec la promo, l'Assistant et le compte sans débordement, cibles de 44 px.
5. Les comptes « à traiter » illisibles (lecture en échec ou lente) : aucun point ni pastille, aucune erreur visible, la barre s'affiche sans attendre.

---

### Task 0: Constats et banc

**Files:**
- Create: `docs/superpowers/plans/2026-10-28-refonte-navigation-constats.md`

- [ ] **Step 1:** Écrire les constats : résultats des trois tests du premier clic (stagiaire sur téléphone, formatrice sur ordinateur, formateur sur téléphone ; tâche, premier clic, confiance, remarque) et inventaire des écarts (tableau, textes à aligner avec `fichier:ligne`). Sans nom réel ni donnée de la base : le banc ne contient que des données fictives.
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`.
- [ ] **Step 3:** Commit `Lot 2A : constats des tests du premier clic et des écarts (28/10)`.

### Task 1: Nouveautés et textes propres à chaque navigation

**Files:**
- Modify: `js/nouveautes.js` (`visibles`), ses appelants (`js/views/nouveautes.js` dont `lienOu` l. 17-29, `js/views/home.js` `sectionNouveautes` et le lien du pied l. 290, le compte des non-lues de la coquille), `js/nouveautes-data.js`, `js/modules-data.js`, `js/views/modules-reglage.js` (`SOCLE`), `js/ccp2-parcours-data.js:313` et `js/views/ccp2.js:27-43`, `js/menu-compte.js` (ligne « Contacts du centre »), et les textes listés au § 2 des constats (82 textes « avant »)
- Create: `js/ou-trouver.js` (module pur)
- Test: `tests/nouveautes.test.mjs`, `tests/ou-trouver.test.mjs`

**Interfaces:**
- Produces :
  - `visibles(entrees, formateur, navigationV2 = false)` : une entrée portant `navigation: "nouvelle"` n'est visible que si `navigationV2` ; `navigation: "ancienne"` seulement sinon ; sans ce champ, comme aujourd'hui.
  - `ouSelonNavigation(ou, { navigationV2, espace }): { label, route, sousOnglet }` (dans `js/ou-trouver.js`) : avec l'ancienne navigation, `ou` inchangé ; avec la nouvelle, le libellé suit la barre : route `calendrier` → « Planning, Dates clés » ; `ressources` → « Cours et QCM, Documents » ; `dashboard` → « Planning, Priorités » ; `themes` → « Cours et QCM » suivi du reste de l'ancien libellé (« Cours, colonne QCM » → « Cours et QCM, colonne QCM ») ; `mon-suivi` → « Mon suivi, partie X » à la place de « Mon espace personnel, partie X » ; `notes` chez un stagiaire → « Mon suivi, La classe » ; `config` → « Mes préférences » pour un stagiaire, « Réglages » pour l'équipe ; route, `sousOnglet` et adresse inchangés (les redirections du lot 1 font le reste).
  - Champ facultatif `guideNouvelle` d'une Nouveauté : ses étapes « Comment faire » sous la nouvelle navigation, montrées à la place de `guide` quand elle est allumée.
  - Champ `navigation: "ancienne"` posé sur les Nouveautés qui ne décrivent que l'ancienne barre (« Une barre d'onglets plus simple », « L'app s'ouvre sur ton espace personnel » et les autres que liste le § 2.3 des constats).
  - Menu du compte, nouvelle navigation : ligne « Contacts du centre » (lien `#/ressources`, que les redirections du lot 1 mènent à Cours et QCM, Documents, où vivent les contacts), entre « Nouveautés » et « Mes préférences ».
  - Catalogue des modules (`js/modules-data.js`) : annonces d'ouverture et explications réécrites en texte neutre, juste dans les deux navigations (§ 2.2 des constats : ni « bouton en haut de l'écran », ni « onglet Notes », ni « bulle en bas de l'écran », ni « Paramètres ») ; ce catalogue génère les annonces, anciennes comprises.

- [ ] **Step 1:** Tests de `visibles` (4 assertions : entrée « nouvelle » visible allumé, cachée éteint ; entrée « ancienne » l'inverse ; entrée sans champ visible dans les deux) et de `ouSelonNavigation` (une assertion par route ci-dessus, plus « ancienne navigation : `ou` rendu tel quel »).
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur les nouveaux tests seulement.
- [ ] **Step 3:** Écrire `ouSelonNavigation` et le filtre de `visibles` ; passer `navigationV2Active()` partout où `visibles` est appelée ; afficher chaque « Où le trouver » par `ouSelonNavigation`.
- [ ] **Step 4:** Ajouter à `js/nouveautes-data.js` les deux entrées de l'annexe du lot 1 (« Une navigation plus simple », pour tous ; « Côté formateurs, la barre passe à gauche », pour les formateurs), avec `navigation: "nouvelle"`, ids `2026-10-28-nouvelle-navigation` et `2026-10-28-nouvelle-navigation-formateurs`, date `2026-10-28` (la Task 7 la recale sur le jour de la fusion). Retoucher leur guide pour qu'il décrive l'app après ce lot (compte sans chiffre, « Mes préférences », bouton Assistant de l'équipe sur téléphone) et corriger ce que relève le § 1 (T1) des constats : sur ordinateur, le compte et l'assistant de l'équipe sont en pied de barre latérale ; dire où sont les notes de la classe (Mon suivi, La classe) et les contacts du centre (menu du compte).
- [ ] **Step 5:** Aligner les textes libres du § 2 des constats : un texte affiché dans les deux navigations prend deux variantes choisies par `navigationV2Active()` ; un texte propre à la nouvelle navigation est simplement corrigé ; les anciennes Nouveautés (historique) ne sont pas réécrites, seul leur « Où le trouver » suit `ouSelonNavigation`.
- [ ] **Step 6:** `node --test "tests/*.test.mjs"` (Expected : `fail 0`) ; au banc, promo allumée, la rubrique Nouveautés montre les deux entrées (la seconde pour un formateur seulement) ; interrupteur éteint, aucune des deux ; fondateur en aperçu sur une promo éteinte, les deux, et un stagiaire sans drapeau de fondateur de la même promo, aucune.
- [ ] **Step 7:** Commit `Lot 2A : Nouveautés et « Où le trouver » propres à chaque navigation`.

### Task 1b: L'assistant connaît la barre que voit la personne

**Files:**
- Modify: `supabase/functions/chatbot/aide.mjs` (consignes de l'app), `supabase/functions/chatbot/index.ts` (l. 107, choix des consignes), `js/chatbot.js` (l. 126-129, corps de la requête)
- Test: le test des consignes de l'assistant (`tests/chatbot-rules.test.mjs` ou un nouveau `tests/chatbot-aide.test.mjs`)

**Interfaces:**
- Produces :
  - `consignesApp(navigation: "nouvelle" | "ancienne"): string` (dans `aide.mjs`) : le texte actuel pour `"ancienne"`, inchangé à l'octet près ; pour `"nouvelle"`, la description de la nouvelle navigation : barre du stagiaire (Accueil, Planning avec Semaine, Dates clés et Priorités ; Cours et QCM avec Thèmes, Compétences et Documents ; Mon suivi avec ses parties, dont La classe ; CCP2), bouton « Assistant » en haut, initiales en haut à droite pour le compte (Nouveautés, Contacts du centre, Mes préférences, Actualiser, déconnexion) ; barre latérale de l'équipe (Accueil, Planning, Émargement, Stagiaires avec Élèves bénévoles, Notes et examens, Cours et QCM avec Signalements, CCP2, Indicateurs, Réglages), « Plus » sur téléphone ; où trouver les contacts du centre ; les anciens noms (Calendrier, Ressources, Notes, Paramètres, Mon espace) et où ils sont passés. Corriger dans les deux textes ce que relève la fin des constats : le calendrier n'est pas une « vue mensuelle », les contacts sont oubliés.
  - Requête de l'app : champ `navigation` (`"nouvelle"` si `navigationV2Active()`, sinon `"ancienne"`) ; la fonction prend `"ancienne"` quand le champ manque ou vaut autre chose (une app plus ancienne, encore en cache sur un téléphone, garde des consignes justes).

- [ ] **Step 1:** Tests : `consignesApp("ancienne")` égale le texte actuel (empreinte ou comparaison directe) ; `consignesApp("nouvelle")` contient « Mon suivi », « Cours et QCM », « Contacts du centre », « Dates clés » et ne présente ni « Mon espace » ni « Paramètres » comme une destination de la barre ; valeur inconnue ou absente → texte de l'ancienne.
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur les nouveaux tests seulement.
- [ ] **Step 3:** Écrire `consignesApp`, le choix dans `index.ts` et l'envoi du champ dans `js/chatbot.js`.
- [ ] **Step 4:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`.
- [ ] **Step 5:** Commit `Assistant : consignes de la nouvelle navigation, choisies selon la barre que voit la personne`. Ne pas déployer la fonction : le déploiement est une mise en production, faite à la fusion avec l'accord de Timy, la fonction avant l'app (Task 7).

### Task 2: Compte et réglages : la promo d'un côté, mes préférences de l'autre

**Files:**
- Modify: `js/menu-compte.js` (l. 53-56), `js/nav-rules.js` (`libelleCompte`, alias), `js/nav-shell.js` (pastille du compte), `js/views/config.js` (`rerender`, l. 701-760), `js/main.js` (table des routes)
- Test: `tests/nav-rules.test.mjs`

**Interfaces:**
- Produces :
  - Route `preferences` (nouvelle navigation seulement ; avec l'ancienne, `#/preferences` mène à `#/config`) rendue par `renderPreferences(container)` (export de `js/views/config.js`) : sections « Mes préférences » (`renderMyPreferencesSection`) et « Informations » (`renderInfoSection`), titre « Mes préférences ».
  - Sous la nouvelle navigation, `#/config` (entrée « Réglages » de l'équipe) ne garde que la promo, dans cet ordre : « Ce que voient les stagiaires » (le réglage des modules, aujourd'hui plus bas dans la page), « Promo », « Accès et invitations », Émargement et Nouvelle navigation (fondateur), « Données personnelles » ; titre « Réglages », surtitre = nom de la promo affichée (`getPromoCourante().nom`). Un stagiaire qui ouvre `#/config` sous la nouvelle navigation va à `#/preferences`.
  - Menu du compte, nouvelle navigation : la ligne « Réglages » devient « Mes préférences » (`#/preferences`), pour tous les rôles.
  - Pastille du bouton du compte, nouvelle navigation : un point sans chiffre quand des Nouveautés ne sont pas lues ; le nombre reste sur la ligne « Nouveautés » du menu ; nom accessible du bouton : « Mon compte, 9 nouveautés non lues » (forme de `libelleCompte`).

- [ ] **Step 1:** Tests de `libelleCompte` (nom accessible avec et sans non-lues) et de l'alias de route `preferences` (aucune entrée allumée chez l'équipe ; chez le stagiaire non plus).
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur les nouveaux tests seulement.
- [ ] **Step 3:** Écrire `renderPreferences`, le partage de `rerender` selon `navigationV2Active()`, la ligne du menu, la route et le point.
- [ ] **Step 4:** Textes de la page « Réglages », nouvelle navigation seulement : « whitelist » devient « liste des invitations » (« Ajouter à la liste des invitations »), le sous-titre « Accès, gestion de la promo, infos. Connecte-toi en admin pour inviter ou modifier. » devient « Ce que voient les stagiaires, la promo et les accès. » ; aucun texte ne dit « admin » ni « mdp ».
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` (Expected : `fail 0`) ; `python outils/verifier_navigation.py` (Expected : 0 échec ; ajouter à sa passe « allumé » : la page Réglages commence par « Ce que voient les stagiaires » ; `#/preferences` ne montre aucune section de promo ; le bouton du compte ne montre aucun chiffre).
- [ ] **Step 6:** Commit `Lot 2A : réglages de la promo et préférences séparés, point des nouveautés sur le compte`.

### Task 3: Bénévoles sous Stagiaires, assistant de l'équipe sur téléphone, titres alignés sur le menu

**Files:**
- Modify: `js/views/stagiaires.js` (en-tête l. 45, rendu de la page), `js/views/benevoles.js` (export du rendu du panneau), `js/views/planning.js` (bouton « Élèves bénévoles », l. 2915), `js/nav-shell.js` (en-tête du téléphone de l'équipe, titre de section du tiroir l. 321), `js/views/notes.js` (l. 1082-1085), `js/views/themes.js` (titre de la page, l. 1884), `js/views/centre.js` (l. 290), `js/views/calendrier.js` (l. 269-270), `js/views/ressources.js` (l. 250), `js/views/mon-suivi.js` (surtitre, l. 715), `css/navigation.css`
- Test: `tests/nav-rules.test.mjs` (clé de sous-onglet)

**Interfaces:**
- Consumes : `renderSubTabs(onglets, { storageKey })` (`js/subtabs.js`), `CLES_SOUS_ONGLETS` (`js/nav-rules.js`).
- Produces :
  - `CLES_SOUS_ONGLETS.stagiaires = "stagiaires.subtab"` ; sous la nouvelle navigation, la page Stagiaires a deux sous-onglets : « Stagiaires » (`stagiaires`, la page actuelle) et « Élèves bénévoles » (`benevoles`, le panneau de `js/views/benevoles.js`, ouvert dans la page au lieu d'une fenêtre). Le bouton « Élèves bénévoles » du planning mène à ce sous-onglet sous la nouvelle navigation, et reste inchangé avec l'ancienne.
  - Téléphone de l'équipe : un bouton « Assistant » (icône bulle, nom accessible « Assistant », 44 px) dans l'en-tête, entre la promo et le compte, `data-nav-action="assistant"` ; il ouvre l'assistant comme celui du stagiaire. La ligne « Assistant » reste aussi dans « Plus ».
  - Titre de section du tiroir « Plus » : « Autres pages » au lieu de « Tout l'espace formateur ».
  - Sous la nouvelle navigation, le titre de chaque page de l'équipe est le libellé de son entrée et son surtitre le nom de la promo : Stagiaires (surtitre aujourd'hui « Formateurs »), « Notes et examens » (aujourd'hui « Notes & évaluations »), « Cours et QCM » (aujourd'hui « Cours »), « Indicateurs » (aujourd'hui surtitre « Tableau de bord du centre » et titre = nom de la promo). Sous-pages, même règle : Planning, Dates clés (aujourd'hui « Calendrier », surtitre « N événements au calendrier ») ; Cours et QCM, Documents (aujourd'hui « Ressources & contacts » ; la section des contacts garde son titre « Contacts du centre ») ; Mon suivi garde son titre et perd le surtitre « Espace personnel » au profit du nom de la promo.
  - Notes, sur un écran tactile (`matchMedia("(pointer: coarse)")`) et sous la nouvelle navigation : sous-titre « Touche une case pour saisir la note. » ; la phrase sur Entrée et Échap n'est montrée qu'avec un clavier.

- [ ] **Step 1:** Test : `CLES_SOUS_ONGLETS.stagiaires === "stagiaires.subtab"`.
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur ce test seulement.
- [ ] **Step 3:** Écrire les sous-onglets de Stagiaires, le bouton Assistant, le titre du tiroir, les titres et la phrase des Notes.
- [ ] **Step 4:** `node --test "tests/*.test.mjs"` (Expected : `fail 0`) ; `python outils/verifier_navigation.py` (Expected : 0 échec ; ajouter à la passe « allumé » : sous-onglet « Élèves bénévoles » présent chez l'équipe ; bouton Assistant visible dans l'en-tête de l'équipe à 375 et 320 px, sans débordement ; le `h2` de chaque page de l'équipe égale le libellé de son entrée).
- [ ] **Step 5:** Commit `Lot 2A : bénévoles sous Stagiaires, assistant dans l'en-tête de l'équipe sur téléphone, titres alignés sur le menu`.

### Task 4: Planning et accueil, côté stagiaire, et décompte des événements

**Files:**
- Create: `js/accueil-rules.js` (module pur)
- Modify: `js/views/home.js` (`daysUntil`, `countdownLabel`, choix du prochain événement, l. 41-60 et 180-230 ; logo et phrase d'accueil), `js/views/planning.js` (l. 2844, 2890), `js/views/notes.js` (l. 1085), `js/emargement-bandeau.js`, `css/style.css` ou `css/navigation.css`
- Test: `tests/accueil-rules.test.mjs`

**Interfaces:**
- Produces : `etatEvenement({ debut, fin }, aujourdhui): { etat: "a-venir" | "en-cours" | "passe", jours: number }` (dates ISO `AAAA-MM-JJ` ; `fin` absente = `debut`) et `libelleDecompte({ etat, jours }): string` (le résultat de `etatEvenement`) : « Aujourd'hui », « Demain », « Dans N jours » ; en cours : « En cours, fin dans N jours », « En cours, fin aujourd'hui » ; `passe` n'est jamais montré (le prochain événement est le premier qui n'est pas passé). Ces deux fonctions servent aussi au lot 2B.
- Correction pour tous (les deux navigations) : la carte « Prochain événement majeur » utilise ces règles ; plus jamais de nombre négatif.
- Nouvelle navigation seulement :
  - Planning et Notes d'un stagiaire : plus de phrase « Lecture seule. Connexion admin requise pour modifier. » ; le bouton « Cette semaine » est retiré pour un stagiaire (le bouton « Aujourd'hui » le remplace) et reste pour l'équipe.
  - Accueil : le second logo (à côté de la pastille de date) est retiré, la coquille porte déjà le logo ; la phrase « Tout le suivi de la promo TP ECSR : planning, passages, notes, calendrier, contacts... » est remplacée par la ligne « Promo <nom> · semaine <n> » de la maquette (`stAccueil`, l. 959).
  - Bandeau d'émargement sur téléphone : une seule ligne (« Émargement du matin ouvert » et son bouton), les horaires cachés sous 700 px.
  - Accueil, les deux espaces : les tuiles qui doublent la barre (`js/views/home.js:129-161` : Planning, Calendrier, Cours, Notes, CCP2, Ressources chez le stagiaire ; Stagiaires, Tableau de bord, Émargement et les autres chez l'équipe) sont masquées, la barre porte ces destinations.
  - Mon suivi, La classe (la page Notes imbriquée, `js/views/mon-suivi.js:694-702`) : ni second titre « Notes & évaluations », ni phrase « Lecture seule... » ; la seconde rangée Matrice / EPCF n'est plus montrée au stagiaire, qui garde la vue de la classe (deux « EPCF » à l'écran en même temps sinon).

- [ ] **Step 1:** Tests de `etatEvenement` et `libelleDecompte` : événement d'un jour aujourd'hui → « Aujourd'hui » ; demain → « Demain » ; dans 9 jours → « Dans 9 jours » ; stage du 26/10 au 06/11 vu le 28/10 → « En cours, fin dans 9 jours » ; fin le jour même → « En cours, fin aujourd'hui » ; terminé hier → `passe`.
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur ces tests seulement.
- [ ] **Step 3:** Écrire `js/accueil-rules.js` ; brancher la carte de l'accueil ; retouches du planning, des notes, de l'accueil et du bandeau.
- [ ] **Step 4:** `node --test "tests/*.test.mjs"` (Expected : `fail 0`) ; `python outils/verifier_navigation.py` (Expected : 0 échec ; ajouter : aucune page d'un stagiaire allumé ne contient « admin » ; bandeau d'émargement d'une ligne à 375 px).
- [ ] **Step 5:** Commit `Lot 2A : décompte des événements en cours, planning et accueil du stagiaire sans textes d'administration`.

### Task 5: Défauts d'affichage communs : défilements de côté (dettes R10 et R11) et notes en rouge

**Files:**
- Modify: `css/style.css` et les vues des quatre conteneurs : `.notes-chart-svg-wrap` (graphe de Mon suivi et de Notes, `js/views/mon-suivi.js` `buildChart`), `.centre-defile` (`js/views/centre.js`), `.passages-table-wrap` (`js/views/passages.js` ou `js/views/dashboard.js`), `.qcm-signal-instr-ligne` (`js/views/signalements.js`) ; `outils/verifier_navigation.py`

- [ ] **Step 1:** Dans `outils/verifier_navigation.py`, retirer les deux listes d'exception des rulings R10 et R11 : un défilement de côté dans ces conteneurs devient un échec. `python outils/verifier_navigation.py`. Expected : échecs sur ces quatre conteneurs, et seulement eux.
- [ ] **Step 2:** Corriger pour les deux navigations (défaut de main) : le graphe se dessine à la largeur de son conteneur (`viewBox`, largeur 100 %) ; les tableaux du centre et des passages deviennent des listes sous 1 080 px, comme le veut la spec (§ 4.1, tableaux en listes hors ordinateur) ; le lien Légifrance passe à la ligne (`overflow-wrap: anywhere`).
- [ ] **Step 2b:** Notes en rouge (règle de Timy, pour les deux navigations) : les rouges écrits en dur des graphes de `js/views/notes.js` (#DC2626, #991B1B, l. 1338-1342, et `avgColor` de `renderAveragesChart`), que le stagiaire voit dans Mon suivi, La classe, prennent l'échelle douce des notes de l'app (pêche, abricot, verts : les jetons ou classes déjà employés pour les notes ailleurs, à retrouver dans `css/style.css`). Ajouter au script une garde : aucun remplissage rouge (teinte entre 345° et 15°, saturation au-dessus de 50 %) dans les graphes de notes.
- [ ] **Step 3:** `python outils/verifier_navigation.py`. Expected : 0 échec, plus aucun avertissement de défilement.
- [ ] **Step 4:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`.
- [ ] **Step 5:** Commit `Plus aucun défilement de côté dans les pages, et plus aucune note en rouge dans les graphes`.

### Task 6: Restes du lot 1 et pastilles « à traiter »

**Files:**
- Create: `js/a-traiter-rules.js` (module pur), `js/a-traiter.js` (lecture)
- Modify: `js/nav-fenetre.js` (gestionnaire `hashchange`, l. 56-58), `js/nav-etat.js` (case du fondateur après une lecture ratée), `js/nav-shell.js` (point sur « Plus », pastille sur « Cours et QCM »), `js/db.js` (deux comptes, si absents)
- Test: `tests/a-traiter-rules.test.mjs`, `tests/nav-etat.test.mjs`

**Interfaces:**
- Produces :
  - `resumeATraiter({ signalements, propositionsIA }): { total: number, texte: string }` (pur) : total = somme des nombres valides ; texte « 3 signalements, 2 propositions de l'IA » (singulier et pluriel, une partie nulle omise, total nul = texte vide).
  - `chargerATraiter(): Promise<{ signalements: number | null, propositionsIA: number | null }>` (équipe seulement ; chaque compte vaut `null` si sa lecture échoue ; jamais d'exception) : signalements de QCM non traités et brouillons de l'IA en attente de la promo affichée, par les fonctions de `js/db.js` qui les listent déjà (en ajouter une de comptage si besoin, sans nouvelle table).
  - Coquille de l'équipe : pastille chiffrée sur l'entrée « Cours et QCM » (barre latérale et tiroir) quand `total > 0` ; point sur « Plus » (téléphone) quand l'une des entrées du tiroir en porte une, avec le texte de `resumeATraiter` en tête du tiroir (ruling R20) ; rien quand les comptes sont `null` ou nuls ; la barre ne les attend jamais.
  - `nav-fenetre.js` : le gestionnaire `hashchange` vérifie, comme celui du clavier, que la fenêtre est encore dans la page avant de la fermer.
  - Case du fondateur (Réglages, Nouvelle navigation) : après une lecture ratée du réglage, elle affiche l'état réellement appliqué (`navigationV2Active()`), au lieu de paraître décochée.

- [ ] **Step 1:** Tests de `resumeATraiter` (3 et 2 → total 5, texte complet ; 1 et 0 → « 1 signalement » ; 0 et 0 → total 0, texte vide ; `null` et 2 → total 2) et de la case du fondateur dans `tests/nav-etat.test.mjs` si sa décision est pure.
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur les nouveaux tests seulement.
- [ ] **Step 3:** Écrire les deux modules, brancher la coquille, corriger `nav-fenetre.js` et la case.
- [ ] **Step 4:** `node --test "tests/*.test.mjs"` (Expected : `fail 0`) ; `python outils/verifier_navigation.py` (Expected : 0 échec ; ajouter : avec les signalements du banc, pastille sur « Cours et QCM » et point sur « Plus » ; avec `window.__HARNESS_FAIL`, ni pastille ni erreur visible).
- [ ] **Step 5:** Commit `Lot 2A : pastilles « à traiter » de l'équipe, restes du lot 1 (fenêtres, case du fondateur)`.

### Task 7: Vérification complète, second tour de tests, Nouveauté, revue finale

**Files:**
- Modify: `js/nouveautes-data.js` (dates, Nouveauté pour tous), le plan (annexe des décisions)

- [ ] **Step 1:** `node --test "tests/*.test.mjs"` et `python outils/verifier_navigation.py` (passes « allumé » et « éteint », Chromium et WebKit). Expected : 0 échec ; parité « éteint = main » intacte hors des corrections des Tasks 4 et 5.
- [ ] **Step 2:** Captures du premier clic reprises (même script, mêmes écrans) et second tour des trois testeurs sur les mêmes tâches ; comparer les confiances au premier tour (constats, Task 0) et corriger ce qui reste sous 3.
- [ ] **Step 3:** Ajouter la Nouveauté pour tous des corrections communes : `2026-10-28-affichage-telephone`, « Des pages mieux tenues sur le téléphone », résumé : les graphes, les tableaux des indicateurs et des passages tiennent dans la largeur de l'écran ; un stage déjà commencé affiche « En cours » au lieu d'un nombre de jours négatif ; les moyennes basses des graphes ne sont plus en rouge.
- [ ] **Step 4:** `grep` du tiret cadratin et de « Prof » affiché dans les fichiers modifiés : aucun.
- [ ] **Step 5:** Revue finale de toute la branche (modèle le plus capable), une vague de corrections, puis captures avant et après pour Timy. Ne pas fusionner : montrer à Timy ce qui part et attendre son accord. À la fusion, avec son accord : déployer d'abord la fonction de l'assistant (Task 1b, compatible avec l'app actuelle), puis fusionner l'app.

---

## Annexe : suite prévue, lot 2B (plan à écrire après la fusion du lot 2A)

Les nouvelles pages de la maquette validée, chacune avec un module de règles pur et derrière la nouvelle navigation :
- Accueil du stagiaire (`stAccueil`, maquette l. 929-964) : la journée (séance, passage au tableau, « Signer pour ce matin » sous le bon créneau, voiture), « À faire », prochain rendez-vous (par `etatEvenement`), nouveauté, pied de page.
- « Aujourd'hui » du formateur (`fAujourdhui`, l. 1101-1116) : émargement du matin, au tableau ce matin, voiture de l'après-midi, à traiter (`chargerATraiter`), à suivre de près ; l'entrée « Accueil » de l'équipe devient « Aujourd'hui ».
- Planning en grille (`weekGrid`, l. 997-1010) : jours en colonnes et demi-journées en lignes sur ordinateur, bande de jours puis le jour choisi sur téléphone, bascule Grille ou Liste ; la grille est une vue de consultation, « Modifier » garde l'éditeur actuel.
- Cours et QCM : sous-onglet « QCM » pour le stagiaire (ses QCM, sa dernière note, « S'entraîner ») et « Propositions IA » pour l'équipe (brouillons en attente de toute la promo).
- Mon suivi en sous-onglets (Résultats, moi et la classe ; Passages ; EPCF ; Livret ; Dossier pro), libellés sans ambiguïté (« EPCF : 0 sur 2 », « Dossier pro : 2 parties sur 10 »).
- « Contacts du centre » (pied de l'Accueil, menu du compte) : seulement si les coordonnées existent déjà en base ; sinon, question à Timy.
- Hors du lot 2 : « Apparence » du menu du compte (lot 3, habillage ECF) et « Signaler un problème » (conversation « 02 - Signaler un problème »).

## Annexe : décisions prises pendant l'écriture du plan (28/10/2026)

- R37 : le lot 2 est coupé en 2A (prête à allumer, ce plan) et 2B (nouvelles pages) ; Timy peut allumer une vraie promo après 2A ou attendre 2B (si faux : un allumage en deux temps pour les promos).
- R38 : les changements de 2A ne valent que sous la nouvelle navigation, sauf deux défauts de main corrigés pour tous (décompte négatif, défilements de côté), annoncés par une Nouveauté pour tous (si faux : deux corrections à rendre conditionnelles).
- R39 : « Voir comme un stagiaire » pour les formateurs relève du lot 4 (conversation « 01 - Rôles et droits en base », prévenue le 28/10) : 2A ne touche ni `js/auth-admin.js` ni l'aperçu (si faux : une entrée de menu à ajouter au lot 2B).
- R40 : le planning garde la semaine choisie par les formateurs (réglage `current_week_lundi`, commun à la promo) ; seul le bouton « Cette semaine » disparaît chez le stagiaire. Que le planning s'ouvre toujours sur la semaine en cours est une décision de Timy, posée à part (si faux : une ligne à changer au chargement du planning).
- R41 : la pastille des Nouveautés devient un point sans chiffre sur le compte (les trois testeurs l'ont prise pour des tâches à traiter) ; les vraies tâches ont leurs pastilles sur « Cours et QCM » et « Plus » (si faux : un chiffre à remettre).
- R42 : ordre d'exécution 0, 2, 3, 4, 5, 6, 1b, 1, 7 : la tâche des textes passe en avant-dernier, pour décrire l'interface finie (si faux : aucun coût de reprise).
- R45 : plan amendé d'après l'inventaire des écarts du 28/10 (5 écarts bloquants, 82 textes) : Task 1b ajoutée (consignes de l'assistant selon la navigation), contacts du centre au menu du compte, annonces de modules en texte neutre, titres des sous-pages, tuiles de l'Accueil, La classe sans doublons, notes en rouge (si faux : des retouches de plan, rien de construit).
- R46 : au seuil d'usage de 70 % (28/10, 12 h 15), l'implémenteur de la Task 2, en pleine vérification finale, a conclu sans corriger au lieu d'être coupé (si faux : un ou deux points d'usage au-delà du seuil).
- R47 : le plan nommait `libelleCompte` ; la fonction réelle est `nomDuBoutonCompte` (si faux : rien).
