# Refonte de la navigation, lot 1 : la coquille - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la barre unique de 8 onglets par une navigation par espace (barre d'onglets du stagiaire, barre latérale repliable de l'équipe), derrière un interrupteur par promo, sans toucher au contenu des pages.

**Architecture:** Un module de règles pur (`js/nav-rules.js`, testé en node) décide des entrées, de l'entrée allumée, de la barre du téléphone et des redirections. Un module de rendu (`js/nav-shell.js`) monte la coquille dans `#app` quand l'interrupteur est allumé ; sinon l'app garde exactement sa barre actuelle. Le défilement reste celui de la fenêtre (le planning en dépend) : la barre latérale est fixe et la hauteur de l'en-tête passe par une variable CSS.

**Tech Stack:** JavaScript en modules ES sans framework, CSS, Supabase (table `settings`), tests `node --test`, banc d'essai `_harness.html` et Playwright (Python) pour la vérification.

**Spec:** `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md` ; maquette `docs/maquettes/refonte-navigation.src.html` ; découpage `docs/superpowers/plans/2026-10-27-refonte-navigation-lots.md`.

## Global Constraints

- Garder la DA de Timy : vert mint et gris sauge (jetons de `css/style.css`), Canela pour les titres, Outfit, Geist Mono, barre sombre espresso au texte crème ; aucun style neuf hors des jetons existants.
- Aucun défilement de côté, à aucune taille ; seule exception admise : la matrice des notes.
- Téléphone (moins de 700 px de large) : 5 entrées au plus dans la barre du bas, toujours nommées ; zones à toucher de 44 px au moins.
- Contraste du texte : 4,5:1 au moins (3:1 pour le grand texte) ; jamais de note en rouge.
- Libellés : « Formateur », jamais « Prof » ; textes pour les stagiaires au tutoiement, comme le reste de l'app ; jamais de tiret cadratin (U+2014), ni dans le code ni dans les commentaires.
- Aucune dépendance ajoutée ; modules ES ; chaque nouvelle ligne `import` porte le même jeton `?v=` que ses voisines (le hook du cache le réécrit à la fusion dans `main`).
- Travail dans le worktree `C:/Users/watch/Dev/ecsr-promo-refonte-nav` (branche `refonte-navigation`) ; commits locaux ; jamais de `git push` (geste de Timy).
- Interrupteur éteint par défaut : pour toute promo dont l'interrupteur est éteint, l'app reste identique à `main` (barre actuelle, mêmes pages, mêmes adresses).
- Tests : `node --test "tests/*.test.mjs"` (le glob est obligatoire) ; tous verts à chaque commit.

## Review Focus

1. Un module fermé pour la promo (planning, ccp2, ressources, calendrier, priorités) : l'entrée ou le sous-onglet disparaît chez le stagiaire, reste repéré (œil barré) chez le formateur, et la barre du téléphone ne garde jamais de case vide.
2. Un ancien favori ou raccourci d'écran d'accueil (`#/calendrier`, `#/dashboard`, `#/ressources`, `#/notes`) ouvre le bon sous-onglet avec la nouvelle navigation, et reste inchangé avec l'ancienne.
3. Le fondateur bascule « Voir en tant que » entre Stagiaire et Formateur : la coquille change d'espace sans rechargement et l'entrée allumée suit la page affichée.
4. Une saisie en cours (grille EPCF, garde `peutQuitter`) : cliquer une entrée de la nouvelle barre ou suivre une redirection demande toujours confirmation.
5. Le planning sous la nouvelle coquille : la barre des jours reste collée juste sous l'en-tête et « Aujourd'hui » amène la carte du jour sous cette barre, sur ordinateur et sur téléphone, dans les deux espaces.

---

### Task 0: Remettre la branche à jour

**Files:** aucun fichier modifié à la main.

- [ ] **Step 1:** Dans le worktree, `git merge main` (main est à `7ee4dec`, correctif de contraste). Expected : fusion sans conflit (la branche ne touche que `docs/`).
- [ ] **Step 2:** Copier depuis `C:/Users/watch/Dev/ECSR/TP_ECSR_App` les fichiers du banc non versionnés (`_harness_build.mjs`, `_harness_supabase.js`, `_banc_centre_demo.js`, `_banc_emargement_demo.js`) s'ils manquent, puis `node _harness_build.mjs`. Expected : « _harness.html généré ».
- [ ] **Step 3:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`.

### Task 1: Règles de navigation (module pur)

**Files:**
- Create: `js/nav-rules.js` (aucun import, aucun DOM)
- Test: `tests/nav-rules.test.mjs` (style de `tests/route-rules.test.mjs` : `node:assert/strict`, compteur, `console.log` final)

**Interfaces:**
- Produces :
  - `espaceDe({ formateur: boolean }): "stagiaire" | "equipe"`
  - `entreesNavigation(espace, { routeVisible: (route) => boolean, emargementActif: boolean }): Entree[]` où `Entree = { id: string, route: string, libelle: string, court: string, icone: string, groupe: string | null }` (`id` vaut la route ; `court` = libellé de la barre du téléphone)
  - `barreTelephone(espace, entrees): { barre: Entree[], plus: Entree[] }`
  - `entreeActive(route, entrees): string | null`
  - `redirectionV2(adresse: { route, id, partie }, espace): null | { hash: string, sousOnglet: null | { cle: string, valeur: string } }`
  - `CLES_SOUS_ONGLETS = { planning: "planning.subtab", themes: "themes.subtab" }`

Valeurs fixées par la spec :
- Stagiaire, dans l'ordre : `home` « Accueil » (icône `home`), `planning` « Planning » (`calendar`), `themes` « Cours et QCM » (`book`), `mon-suivi` « Mon suivi » (`trend`), `ccp2` « CCP2 » (`target`). Filtre : `routeVisible(route)` (`home` et `mon-suivi` sont toujours visibles).
- Équipe, dans l'ordre : `home` « Accueil » (`home` ; devient « Aujourd'hui » au lot 2, avec la nouvelle page), `planning` « Planning », `emargement` « Émargement » (`clipboard`, seulement si `emargementActif`), `stagiaires` « Stagiaires » (`users`), `notes` « Notes et examens », court « Notes » (`edu`), `themes` « Cours et QCM », `ccp2` « CCP2 » ; puis groupe « Promo » : `centre` « Indicateurs » (`chart`), `config` « Réglages » (`settings`). Une entrée de l'équipe n'est jamais retirée par un module fermé : elle est repérée par l'appelant (Task 4).
- Téléphone : stagiaire = toutes ses entrées (5 au plus), `plus` vide ; équipe = `home`, `planning`, `stagiaires`, `notes` dans la barre (si présentes), tout le reste dans `plus`.
- Entrée allumée, alias : `calendrier` et `dashboard` vers `planning` ; `ressources` vers `themes` ; `nouveautes` vers `home` ; `notes` vers `mon-suivi` dans l'espace stagiaire ; une route sans entrée (ex. `mon-suivi` dans l'espace équipe) donne `null`.
- Redirections (nouvelle navigation seulement), dans les deux espaces : `calendrier` vers `#/planning` + sous-onglet `planning.subtab` = `dates` ; `dashboard` vers `#/planning` + `priorites` ; `ressources` vers `#/themes` + `themes.subtab` = `documents`. Espace stagiaire en plus : `notes` vers `#/mon-suivi/classe` (sans sous-onglet). Toute autre adresse : `null`.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import { espaceDe, entreesNavigation, barreTelephone, entreeActive, redirectionV2 } from "../js/nav-rules.js";
let n = 0; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const tout = () => true;
const ids = (l) => l.map((e) => e.id);
eq(espaceDe({ formateur: false }), "stagiaire", "stagiaire");
eq(espaceDe({ formateur: true }), "equipe", "formateur ou admin");
eq(ids(entreesNavigation("stagiaire", { routeVisible: tout, emargementActif: false })), ["home", "planning", "themes", "mon-suivi", "ccp2"], "5 onglets stagiaire");
eq(ids(entreesNavigation("stagiaire", { routeVisible: (r) => r !== "ccp2", emargementActif: false })), ["home", "planning", "themes", "mon-suivi"], "CCP2 fermé : pas de case vide");
const eqp = entreesNavigation("equipe", { routeVisible: () => false, emargementActif: true });
eq(ids(eqp), ["home", "planning", "emargement", "stagiaires", "notes", "themes", "ccp2", "centre", "config"], "équipe : rien retiré par les modules");
eq(eqp.find((e) => e.id === "centre").groupe, "Promo", "groupe Promo");
eq(ids(entreesNavigation("equipe", { routeVisible: tout, emargementActif: false })).includes("emargement"), false, "émargement éteint");
eq(ids(barreTelephone("equipe", eqp).barre), ["home", "planning", "stagiaires", "notes"], "barre équipe");
eq(ids(barreTelephone("equipe", eqp).plus), ["emargement", "themes", "ccp2", "centre", "config"], "Plus");
eq(barreTelephone("stagiaire", entreesNavigation("stagiaire", { routeVisible: tout, emargementActif: false })).plus, [], "stagiaire sans Plus");
eq(entreeActive("calendrier", eqp), "planning", "alias calendrier");
eq(entreeActive("ressources", eqp), "themes", "alias ressources");
eq(entreeActive("mon-suivi", eqp), null, "équipe : Mon espace sans entrée");
eq(redirectionV2({ route: "calendrier", id: null, partie: null }, "stagiaire"), { hash: "#/planning", sousOnglet: { cle: "planning.subtab", valeur: "dates" } }, "calendrier");
eq(redirectionV2({ route: "notes", id: null, partie: null }, "stagiaire"), { hash: "#/mon-suivi/classe", sousOnglet: null }, "notes du stagiaire");
eq(redirectionV2({ route: "notes", id: null, partie: null }, "equipe"), null, "notes de l'équipe inchangées");
eq(redirectionV2({ route: "planning", id: null, partie: null }, "stagiaire"), null, "pas de boucle");
console.log(`nav-rules : ${n} assertions OK`);
```

- [ ] **Step 2:** `node tests/nav-rules.test.mjs`. Expected : échec à l'import (`nav-rules.js` absent).
- [ ] **Step 3:** Écrire `js/nav-rules.js` avec les signatures et valeurs ci-dessus (tables de constantes, aucune lecture du DOM ni de `localStorage`).
- [ ] **Step 4:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`, dont « nav-rules : 17 assertions OK ».
- [ ] **Step 5:** Commit `Navigation : règles des espaces, de la barre du téléphone et des redirections (module pur)`.

### Task 2: Interrupteur « Nouvelle navigation » par promo

**Files:**
- Create: `js/nav-etat.js`
- Modify: `js/views/config.js` (insérer la section après celle de l'émargement, ordre l. 731)
- Test: `tests/nav-etat.test.mjs` (partie pure seulement)

**Interfaces:**
- Consumes : la mécanique de `js/emargement-etat.js` (lecture et écriture du réglage propre à la promo, réservé au fondateur) : la reproduire à l'identique, avec la clé de réglage `navigation_v2`.
- Produces :
  - `chargerNavigationV2(): Promise<boolean>` (lit le réglage de la promo affichée ; en cas d'échec de lecture : `false`)
  - `navigationV2Active(): boolean`
  - `renderNavigationReglage(): HTMLElement | null` (fondateur seulement, `null` sinon ; titre « Nouvelle navigation » ; un interrupteur pour la promo affichée et une case « Aperçu sur cet appareil »)
  - pure : `decideNavigationV2({ reglagePromo: boolean | null, apercu: "1" | "0" | null, fondateur: boolean }): boolean` (l'aperçu de l'appareil, clé `localStorage` `ecsr_nav_v2`, ne compte que pour le fondateur et prime sur le réglage ; sinon le réglage ; `null` vaut `false`)

- [ ] **Step 1:** Test pur de `decideNavigationV2`, 6 assertions : `{ reglagePromo: true, apercu: null, fondateur: false }` vrai ; `{ false, null, false }` faux ; `{ null, null, false }` faux ; `{ false, "1", true }` vrai ; `{ true, "0", true }` faux ; `{ false, "1", false }` faux (aperçu d'un non-fondateur ignoré).
- [ ] **Step 2:** `node tests/nav-etat.test.mjs`. Expected : échec à l'import.
- [ ] **Step 3:** Écrire `js/nav-etat.js` ; brancher `renderNavigationReglage()` dans `rerender` de `config.js` à côté de `renderEmargementReglage()`.
- [ ] **Step 4:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`.
- [ ] **Step 5:** Banc `?role=fondateur` : Paramètres montre « Nouvelle navigation » ; `?role=prof` et `?role=stagiaire` ne la montrent pas (dans le banc, `?role=stagiaire` est fondateur : vérifier avec `getProfile().is_founder = false` comme indiqué dans la mémoire du banc).
- [ ] **Step 6:** Commit `Navigation : interrupteur « Nouvelle navigation » par promo (fondateur), éteint par défaut`.

### Task 3: Pages regroupées (sous-onglets) sous la nouvelle navigation

**Files:**
- Create: `js/views/planning-espace.js`
- Modify: `js/main.js` (table `routes` : `planning` pointe vers `renderPlanningEspace` quand `navigationV2Active()`), `js/views/themes.js:1888-1896` (onglet `documents`), `js/route-rules.js` (`PARTIES` gagne `classe`), `js/views/mon-suivi.js` (partie `classe`), `js/views/planning.js:2752`
- Test: `tests/route-rules.test.mjs` (ajouts)

**Interfaces:**
- Consumes : `renderSubTabs(onglets, { storageKey })` (`js/subtabs.js`), `renderPlanning`, `renderCalendrier`, `renderDashboard`, `renderRessources`, `renderNotes(container)`, `navigationV2Active()` (Task 2), `CLES_SOUS_ONGLETS` (Task 1).
- Produces :
  - `renderPlanningEspace(view): Promise<void>` : sous-onglets `semaine` « Semaine » (`renderPlanning`), `dates` « Dates clés » (module `calendrier`, `renderCalendrier`), `priorites` « Priorités » (module `priorites`, `renderDashboard`), `storageKey: "planning.subtab"`.
  - Cours (`themes.js`) : onglet `documents` « Documents » (module `ressources`, `renderRessources`) ajouté seulement si `navigationV2Active()`.
  - Mon espace : partie `classe` « La classe », seulement pour la personne connectée qui a un profil stagiaire et si `navigationV2Active()` ; elle rend la vue Notes actuelle dans le panneau (`renderNotes(panneau)`).
  - CSS : variable `--haut-entete` (Task 6 en fixe les valeurs, R2) lue par `planning.js` à la place de la constante `104` : décalage = `--haut-entete` + 52 px.

- [ ] **Step 1:** Tests ajoutés à `tests/route-rules.test.mjs` : `lireAdresse("#/mon-suivi/classe")` donne `{ route: "mon-suivi", id: null, partie: "classe" }` ; `PARTIES` se termine par `"classe"`.
- [ ] **Step 2:** `node tests/route-rules.test.mjs`. Expected : échec sur `classe`.
- [ ] **Step 3:** Implémenter les trois regroupements ; `requestPlanningToday()` force `planning.subtab` = `semaine` avant de rendre.
- [ ] **Step 4:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`.
- [ ] **Step 5:** Banc, interrupteur allumé (aperçu de l'appareil) : Planning montre ses 3 sous-onglets ; les modules `calendrier` et `priorites` fermés (`?modules=depart`) les retirent chez le stagiaire et les repèrent chez le formateur ; « Aujourd'hui » du planning fonctionne ; interrupteur éteint : Planning, Cours et Mon espace identiques à `main` (même DOM des sous-onglets, mêmes clés `localStorage`).
- [ ] **Step 6:** Commit `Navigation : Planning, Cours et Mon espace regroupés en sous-onglets (nouvelle navigation)`.

### Task 4: Coquille du stagiaire

**Files:**
- Create: `js/nav-shell.js`, `css/navigation.css` (toutes les règles sous `body[data-nav="v2"]`)
- Modify: `index.html` (lien vers `css/navigation.css`), `js/icons.js` (icônes `home`, `sun`, `trend`, `chart`, `grid`, `panel` en traits Lucide 1.6 comme les autres), `js/main.js` (`bootApp`, `renderTabs`, `marquerOngletActif`)

**Interfaces:**
- Consumes : Task 1 (toutes), `navigationV2Active()`, `routeVisible`, `routeMasquee`, `repereMasque`, `emargementActif()`, `icon`, `el`.
- Produces :
  - `monterCoquille({ espace, entrees, nom, initiales }): void` : pose `document.body.dataset.nav = "v2"` et `dataset.espace`, monte dans `#app` la barre de l'espace, masque `header.topbar` (CSS) ; idempotent (remonter remplace).
  - `majEntreeActive(route): void` : `aria-current="page"` sur l'entrée renvoyée par `entreeActive` (ou sur « Plus » quand l'entrée est dans `plus`).
  - ~~`demonterCoquille(): void`~~ (R22) : retirée. Rien ne démonte la coquille : la décision est figée pour la session (R8), sauf le repli de la relecture finale (mineur 8) : un montage qui lève une exception est retiré (`retirerCoquille`) et la session repasse à l'ancienne navigation.
- Stagiaire, ordinateur et tablette : en-tête collant de 66 px, logo à gauche, capsule d'onglets centrée (icône + libellé), à droite le bouton « Assistant » nommé (Task 6) et le bouton du compte (initiales + flèche, Task 5). Téléphone : en-tête de 56 px (logo, Assistant, compte) et barre du bas fixe (icône + libellé court, pastille de l'onglet actif, `env(safe-area-inset-bottom)` en marge), `body` gagne une marge basse égale à sa hauteur.
- `main.js` : quand `navigationV2Active()`, `renderTabs()` appelle `monterCoquille` au lieu de remplir `#tabs`, et `marquerOngletActif()` appelle `majEntreeActive(lastRoute)`. Les clics passent par les liens `#/route` (donc par `navigate()` et sa garde).

- [ ] **Step 1:** Banc `?role=stagiaire` avec l'aperçu allumé, ordinateur 1280 px : les 5 onglets, l'onglet de la page affichée allumé, l'ancienne barre absente ; iPhone 375 px : barre du bas de 5 cases nommées, aucune case vide avec `?modules=depart`.
- [ ] **Step 2:** Implémenter `nav-shell.js` (partie stagiaire), `navigation.css`, icônes et branchement dans `main.js`.
- [ ] **Step 3:** Script de vérification (Task 8) en mode stagiaire : 0 échec ; interrupteur éteint : DOM de la barre identique à `main`.
- [ ] **Step 4:** Commit `Navigation : coquille du stagiaire (onglets en haut, barre du bas sur téléphone)`.

### Task 5: Coquille de l'équipe et menu du compte

**Files:**
- Modify: `js/nav-shell.js`, `css/navigation.css`, `js/auth-admin.js` (exporter `buildViewAsBlock` et une fonction `seDeconnecter(): Promise<void>` reprise du bouton actuel)
- Create: `js/menu-compte.js`

**Interfaces:**
- Consumes : Task 1, Task 4, `construirePastille()` (`js/promo-pastille.js`, renvoie `null` sous deux promos), `pagePersonnelle`, `getProfileWho`, `getProfile`, `isFounder`.
- Produces :
  - Équipe, ordinateur (1080 px et plus) : barre latérale fixe de 264 px, fond `--bg-deep`, contexte en tête (le bouton de `construirePastille()`, ou le nom de la promo quand il n'y en a qu'une) avec le bouton « Replier la barre » à côté ; entrées groupées (titre de groupe « Promo ») ; pied : Assistant, compte. Repliée (choix mémorisé, clé `localStorage` `ecsr_nav_repliee`) et tablette (700 à 1079 px) : colonne d'icônes de 74 px avec infobulles (`title`, `aria-label`). Le contenu garde le défilement de la fenêtre, décalé par `margin-left`.
  - Équipe, téléphone : en-tête de 56 px (contexte, compte), barre du bas (4 entrées + « Plus ») ; « Plus » ouvre un tiroir avec les entrées restantes, l'Assistant et le compte. Le point sur « Plus » n'est pas construit au lot 1 (R20) : il ne signalera que les entrées « à traiter » (signalements, propositions de l'IA), jamais une page masquée aux stagiaires, et viendra avec le lot qui apporte ces compteurs.
  - Module fermé : l'entrée de l'équipe porte le repère `repereMasque(noeud, routeMasquee(route))`.
  - `ouvrirMenuCompte(ancre: HTMLElement): void` : fenêtre `role="dialog"` (popover sur ordinateur, tiroir sur téléphone), focus sur la fenêtre, Échap et clic dehors la ferment et rendent le focus à l'ancre ; contenu : nom et rôle, « Mon espace » ou « Stagiaires » selon `pagePersonnelle`, « Nouveautés » (`#/nouveautes`, avec la pastille de non-lus de `nouveautesAffichables`), « Réglages » (`#/config`), le bloc « Voir en tant que » (fondateur), « Informations légales », « Se déconnecter ».
  - `onAdminChange` : la coquille est remontée (changement d'espace sans rechargement).

- [ ] **Step 1:** Banc `?role=prof` avec l'aperçu : 1280 px barre dépliée, 1100 px dépliée, 900 px colonne d'icônes, 375 px barre du bas + « Plus » ; `?role=fondateur` : bascule « Voir en tant que » Stagiaire puis Formateur, la coquille change d'espace sans rechargement.
- [ ] **Step 2:** Implémenter.
- [ ] **Step 3:** Script de vérification (Task 8) en mode équipe : 0 échec.
- [ ] **Step 4:** Commit `Navigation : barre latérale de l'équipe, « Plus » sur téléphone, menu du compte`.

### Task 6: Assistant nommé, bandeaux, collants et impression

**Files:**
- Modify: `js/chatbot.js` (exporter `basculerAssistant(): void`, utilisé par les boutons « Assistant » de la coquille), `css/navigation.css`, `css/style.css` (`:root` : `--haut-entete: 52px`, et `95.5px` sous 760 px pour l'ancienne barre)

**Interfaces:**
- Produces : sous la nouvelle navigation, plus de bulle flottante (`#chatbot-fab` masqué) ; le panneau de l'assistant s'ouvre au-dessus de la barre du bas sur téléphone ; `--haut-entete` vaut 66 px (stagiaire, ordinateur), 0 px (équipe, ordinateur, sans en-tête), 56 px (téléphone, les deux espaces) ; `.p-daynav` (`top`) et `.p-day-card` (`scroll-margin-top`) s'en servent ; le bandeau d'émargement et les bandeaux de `auth-admin.js` restent visibles au-dessus de la barre du bas ; `@media print` masque toute la coquille.

- [ ] **Step 1:** Banc `?role=stagiaire&emargement=1` puis `?role=prof`, ordinateur et téléphone, aperçu allumé : le bandeau de signature est visible et utilisable ; « Aujourd'hui » au planning amène la carte du jour juste sous la barre des jours (mesure : `getBoundingClientRect().top` de la carte égal à `--haut-entete` + 52 px, à 2 px près) ; l'assistant s'ouvre depuis la coquille et Échap le ferme.
- [ ] **Step 2:** Implémenter.
- [ ] **Step 3:** Interrupteur éteint : mêmes mesures qu'avant (52 px et 95.5 px), bulle de l'assistant présente.
- [ ] **Step 4:** Commit `Navigation : assistant dans la coquille, bandeaux, barre des jours et impression`.

### Task 7: Redirections et garde de saisie

**Files:**
- Modify: `js/main.js` (`navigate()`)

**Interfaces:**
- Consumes : `redirectionV2` et `CLES_SOUS_ONGLETS` (Task 1), `espaceDe`, `navigationV2Active`, `peutQuitter`.
- Produces : en tête de `navigate()`, après la garde de saisie et seulement sous la nouvelle navigation, une adresse redirigée écrit d'abord la clé du sous-onglet (`localStorage`, dans un `try`), puis `history.replaceState` vers le nouveau `hash` et poursuit avec la route cible (pas d'étape d'historique parasite, pas de second rendu).

- [ ] **Step 1:** Banc, aperçu allumé : `#/calendrier`, `#/dashboard`, `#/ressources` ouvrent Planning (Dates clés, Priorités) et Cours (Documents) ; `#/notes` en stagiaire ouvre Mon espace, partie « La classe » ; en formateur `#/notes` reste la page Notes ; grille EPCF commencée puis clic sur « Planning » : la confirmation apparaît et un refus garde la page ; interrupteur éteint : les quatre adresses ouvrent les pages actuelles.
- [ ] **Step 2:** Implémenter.
- [ ] **Step 3:** `node --test "tests/*.test.mjs"`. Expected : `fail 0`.
- [ ] **Step 4:** Commit `Navigation : anciennes adresses redirigées vers leur nouvel emplacement`.

### Task 8: Script de vérification au banc

**Files:**
- Create: `outils/verifier_navigation.py` (Playwright, Chromium et WebKit ; WebKit par `executable_path` vers `ms-playwright/webkit-*/Playwright.exe` si le moteur attendu manque)

**Interfaces:**
- Produces : `python outils/verifier_navigation.py <url_du_banc>` affiche « N vues, 0 échec » ou la liste des échecs, et sort en code 1 s'il y en a.
- Vues : rôles `stagiaire`, `prof`, `fondateur` ; largeurs 1280, 1100, 900, 375 ; chaque entrée de la coquille et chaque sous-onglet de Planning, Cours et Mon espace ; aperçu allumé (`localStorage ecsr_nav_v2 = "1"`, fondateur) ; plus une passe interrupteur éteint.
- Contrôles par vue (repris de `docs/maquettes/tests_maquette.js`) : aucun élément ne déborde de la fenêtre et aucune zone ne défile de côté hors `.matrice-wrap` ; une seule entrée allumée dans la coquille visible ; zones à toucher de 44 px à 375 px ; contraste du texte de la coquille 4,5:1 ; barre du bas de 5 entrées au plus ; menus dans l'écran et fermés par Échap ; aucune erreur dans la console.

- [ ] **Step 1:** Écrire le script ; le lancer sur la branche avant les Tasks 4 et 5 pour voir ses échecs attendus (coquille absente), puis après.
- [ ] **Step 2:** Lancer sur la branche complète. Expected : 0 échec dans les deux moteurs.
- [ ] **Step 3:** Commit `Navigation : script de vérification au banc (Chromium et WebKit)`.

### Task 9: Revue finale et préparation de la fusion

- [ ] **Step 1:** `node --test "tests/*.test.mjs"` (0 échec) et `python outils/verifier_navigation.py` (0 échec) sur la branche.
- [ ] **Step 2:** `grep` du tiret cadratin (`$'\xe2\x80\x94'`) et de « Prof » affiché dans les fichiers modifiés : aucun.
- [ ] **Step 3:** Captures avant et après (stagiaire et formateur, 1280 et 375 px) pour Timy ; texte de la Nouveauté prêt (pour « tous », à ajouter le jour où il allume l'interrupteur pour une vraie promo, règle des Nouveautés).
- [ ] **Step 4:** Ne pas fusionner : montrer à Timy ce qui part, attendre son accord, puis fusion dans `main` par `merge --no-ff --no-commit` suivi d'un commit (le hook pose le jeton) ; il pousse lui-même.
