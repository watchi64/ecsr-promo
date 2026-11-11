# Refonte de la navigation, lot 2B : les nouvelles pages - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire, derrière l'interrupteur de la nouvelle navigation, les pages de la maquette validée : Accueil du stagiaire, « Aujourd'hui » du formateur, planning en grille, sous-onglets « QCM » et « Propositions IA », Mon suivi aux libellés clairs, page CCP2 ouverte sur le parcours ; corriger pour tous les défilements de côté du lecteur de cours.

**Architecture:** Une lecture de la journée et de la semaine, unique et pure (`js/journee-rules.js`), nourrit l'Accueil, Aujourd'hui et la grille. Les pages neuves sont des modules de vue séparés, choisis par `navigationV2Active()` ; le code des pages actuelles ne change pas de comportement avec l'interrupteur éteint. Chaque carte se charge à part : une lecture en échec ne touche que sa carte.

**Tech Stack:** JavaScript en modules ES sans framework, CSS, Supabase (lectures par `js/db.js`, aucune migration), tests `node --test`, banc `_harness.html`, Playwright (Python) pour `outils/verifier_navigation.py`.

**Spec:** `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md` ; maquette `docs/maquettes/refonte-navigation.src.html` (dossier retiré le 10/11, à lire dans l'historique git) (`stAccueil` l. 929, `weekGrid` et `vueToggle` l. 997-1010, `qcmList` l. 1048, `resultats` et `stSuivi` l. 1064-1091, `fAujourdhui` l. 1101, `fCours` l. 1190) ; constats `docs/superpowers/plans/2026-10-28-refonte-navigation-constats.md` ; annexe et rulings R37 à R57 de `docs/superpowers/plans/2026-10-28-refonte-navigation-lot-2a-allumage.md`.

## Global Constraints

- Garder la DA de Timy : vert mint et gris sauge (jetons de `css/style.css`), Canela pour les titres, Outfit, Geist Mono, pastille de date au grand chiffre vert, nom en vert dans la salutation, échelle douce des notes ; aucune couleur écrite en dur.
- Interrupteur éteint = main, à une exception près annoncée par une Nouveauté pour tous : le lecteur de cours (Task 1).
- Aucun défilement de côté, à aucune largeur ; seule exception : `.matrice-wrap`.
- Téléphone : moins de 700 px ; zones à toucher de 44 px au moins ; contraste 4,5:1 (3:1 pour le grand texte et les contrôles) ; jamais une note en rouge.
- « Formateur », jamais « Prof » ; tutoiement ; un seul nom par destination, celui du menu ; jamais de tiret cadratin (U+2014), ni dans le code ni dans les commentaires.
- Aucune dépendance, aucune migration, aucune table. Chaque nouvelle ligne `import` porte le même jeton `?v=` que ses voisines.
- Ne pas toucher : `js/chatbot.js`, `supabase/functions/chatbot/` (conversation de l'assistant), `js/auth-admin.js` et les migrations (lot 4), la page Qualiopi.
- Worktree `C:/Users/watch/Dev/ecsr-promo-lot2b`, branche `lot2b-pages`, serveur du banc : entrée `banc-lot2b`. Commits locaux, jamais de `git push` ni de fusion.
- Tests : `node --test "tests/*.test.mjs"` (1 134 au départ, glob obligatoire), tous verts à chaque commit ; `python outils/verifier_navigation.py <adresse du banc>` sans échec à la fin de chaque tâche qui touche l'affichage (`--help` pour un passage réduit à une page pendant le travail).
- Commentaires dans le ton du code voisin : en français, ils disent le pourquoi.

## Review Focus

1. Jours sans séance : samedi, dimanche, jour férié, jour off, semaine sans planning, demi-journée vide. Attendu : une phrase simple, jamais une carte vide ni une erreur ; une feuille d'émargement ouverte reste signable. Tests dans la Task 2 (règles) et la Task 3 (page).
2. Une lecture en échec ou lente (`window.__HARNESS_FAIL`, `?lenteur=`) : seule sa carte le dit, les autres s'affichent, et le bouton de signature reste joignable si le planning échoue. Tests dans les Tasks 3 et 4.
3. Comptes particuliers : stagiaire sans fiche (`monStagiaireId()` nul), formateur avec une fiche (fondateur), « Voir en tant que » stagiaire. Attendu : l'espace choisi par `formateurConnecte()`, aucune étiquette « Toi », aucun bouton de signature sans fiche. Tests dans les Tasks 2 et 4.
4. Modules fermés pour la promo (`?modules=depart`) : calendrier, QCM, dossier, livret, EPCF, planning. Attendu : la carte, la ligne ou le sous-onglet disparaît chez le stagiaire, aucun lien vers une page fermée. Tests dans les Tasks 3, 6 et 7.
5. Rendu tardif : changer de page ou de promo pendant un chargement. Attendu : la réponse tardive n'écrit pas dans la page affichée (conteneur détaché, garde `isActive`), et la promo de la vue reste celle de l'en-tête. Tests dans les Tasks 3 et 4.

---

### Task 1: Lecteur de cours sans défilement de côté (pour tous, ruling R52)

**Files:**
- Modify: `css/style.css` (`.cours-sommaire` l. 7070, `.cours-somm-item`, `.cours-table-wrap` l. 7267, tableaux légaux l. 8358), `js/views/cours-reader.js` (l. 240-251), `js/legal.js` si besoin, `outils/verifier_navigation.py` (`DETTE_LECTEUR_DE_COURS` l. 445, racines l. 707), `_harness_supabase.js`
- Test: `tests/cours-reader.test.mjs` si la logique d'étiquette est pure, sinon le script

**Interfaces:**
- Produces : classe de tableau inchangée ; chaque `td` porte `data-label` (texte de son en-tête).

- [ ] **Step 1:** Script : retirer `DETTE_LECTEUR_DE_COURS`, ajouter `.cours-overlay` aux racines mesurées (l. 707) et une vérification `verifier_lecteur(page, res, sc)` : ouvrir un cours et les Informations légales à 375 et 320 px, dans les deux navigations, puis mesurer. Banc : donner au cours du thème 22 un `corps_md` avec des sections et un tableau de 5 colonnes sans `?qcmia=1`.
- [ ] **Step 2:** Lancer le script. Expected : échecs sur `.cours-sommaire` et `.cours-table-wrap`, et seulement eux.
- [ ] **Step 3:** Sommaire : `flex-wrap: wrap`, plus d'`overflow-x` ; sous 700 px, il cesse d'être collant (`position: static`) pour ne pas couvrir le texte. Vaut aussi pour `.legal-onglets`.
- [ ] **Step 4:** Tableaux : sous 700 px, chaque ligne devient une carte (`display: block` sur `table`, `thead` masqué visuellement, `tr`, `td`), `td::before { content: attr(data-label) }`, `overflow-wrap: anywhere` ; au-dessus, tableau normal sans `overflow-x`, mots coupés si besoin. Les tableaux de 2 colonnes restent des tableaux à toute largeur (règle dans `classeTableau`).
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` et le script. Expected : `fail 0`, 0 échec.
- [ ] **Step 6:** Commit `Lot 2B : lecteur de cours sans défilement de côté (sommaire à la ligne, tableaux en listes sur téléphone)`.

### Task 2: La journée et la semaine, lues d'un seul endroit

**Files:**
- Create: `js/planning-roles.js` (pur), `js/journee-rules.js` (pur), `js/planning-lecture.js` (lecture)
- Modify: `js/views/planning.js` (déplacer `entryShape`, `effPedagogueId`, `effElevesIds`, `effBenevolesIds`, `effSujets`, `entryHasContent`, l. 567-590 et 3066, sans changer leur corps ; `parseSujet` reste, il en reçoit un équivalent pur prenant les titres), `_harness_supabase.js`
- Test: `tests/journee-rules.test.mjs`

**Interfaces:**
- Produces, `js/planning-roles.js` : les six fonctions déplacées, exportées ; `sujetsDe(val, titresConnus): string[]`.
- Produces, `js/journee-rules.js` :
  - `journeeDuJour({ entries, metas, joursOff, jour, moi, noms }): { repos: string | null, demis: Demi[] }` ; `jour` « AAAA-MM-JJ » ; `moi` id de fiche ou null ; `noms` : `{ stagiaires: Map, formateurs: Map, benevoles: Map, autres: string[] }`. `repos` : « Samedi », « Dimanche », le nom du férié ou le libellé du jour off (`demis` vide alors).
  - `Demi = { demi: "matin" | "aprem", titre: "Matin" | "Après-midi", horaire: "9 h à 12 h 30", cartes: CarteJour[] }`, les deux demi-journées toujours présentes, `cartes` vide si rien n'est prévu ; horaires de `metas`, sinon les défauts de `DEFAULT_HALF_META` (déplacés ici).
  - `CarteJour = { id, genre: "salle" | "voiture" | "cours" | "controle" | "autonomie" | "autre", titre, sujets: string[], formateurs: string[], tableau: [{ id, nom, groupe }], eleves: [{ id, nom }], conducteurs: [{ id, nom }], benevoles: string[], moi: null | { role: "tableau" | "voiture" | "eleve", texte } }`. `moi.texte` : « Tu passes au tableau », « Tu conduis », « En salle » ; côté semaine « Toi au tableau », « Toi en voiture » via `etiquetteSemaine(moi)`. Rôles par `rolesPourEntry` (`js/creneaux-rules.js`). Les `absences` s'appliquent : un absent remplacé cède sa place à `rid` ; un stagiaire noté absent n'a pas d'étiquette. Cartes triées par `slot` puis `lane`, celles sans contenu retirées (`entryHasContent`). Ni heure ni lieu par carte : la base n'en a pas.
  - `semaineEnGrille({ entries, metas, joursOff, lundi, moi, noms, aujourdhui }): JourGrille[]` : cinq jours, `{ index, iso, court: "Lun", long: "Lundi 26 octobre", numero, aujourdhui: boolean, repos, demis }`.
  - `jourParDefaut(jours, aujourdhui): number` : l'index du jour affiché sur téléphone : aujourd'hui s'il est dans la semaine, sinon 0.
- Produces, `js/planning-lecture.js` : `chargerSemaine(lundiIso): Promise<{ entries, metas, joursOff, noms }>` (`getPlanning`, `getHalfMetaForWeek`, `getJoursOff`, `listStagiaires({ includeInactive: true })`, formateurs comme `loadPlanning`, `listBenevolesNoms` : un nom illisible n'empêche rien, `benevoles` vide alors) ; `lundiEnCours(aujourdhui): string` : le lundi de la semaine, le lundi suivant un samedi ou un dimanche (rulings R58, R59).

- [ ] **Step 1:** Banc (fichier non versionné du worktree, à recopier dans `TP_ECSR_App` à la Task 8 après `diff`) : `half_day` par défaut à `"aprem"`, `benevoles_noms` rend les noms, `benevoles_ids` sur une carte voiture du jour avec `?benevoles=1`, cartes du banc couvrant matin et après-midi de `date`.
- [ ] **Step 2:** Tests : `journeeDuJour` un mardi avec salle double et voiture (tableau des deux groupes, conducteurs, bénévoles nommés, `horaire` par défaut et lu dans `metas`) ; `moi` au tableau, élève, conducteur, absent remplacé, absent, nul (aucune étiquette) ; `salle_double` faux avec `pedagogue_id_2` resté en base (ignoré) ; activité changée avec des rôles restés en base (ignorés) ; samedi, dimanche, 11 novembre, jour off, semaine vide ; carte sans contenu retirée ; `autonomie: true` → genre `autonomie` ; sujet « Stationnement, arrêt, immobilisation » reste un seul sujet quand le titre est connu. `semaineEnGrille` : cinq jours, un seul `aujourdhui`, jeudi 5 novembre 2026 → « Jeudi 5 novembre », passage à décembre. `lundiEnCours` : mardi, samedi, dimanche, changement d'heure. `jourParDefaut`.
- [ ] **Step 3:** `node --test "tests/*.test.mjs"`. Expected : échec sur les nouveaux tests seulement.
- [ ] **Step 4:** Écrire les trois modules, déplacer les fonctions, importer depuis `planning.js`.
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` (Expected : `fail 0`) ; `python outils/verifier_navigation.py <banc>` (Expected : 0 échec, le planning ne bouge pas).
- [ ] **Step 6:** Commit `Lot 2B : la journée et la semaine lues d'un seul endroit`.

### Task 3: Accueil du stagiaire

**Files:**
- Create: `js/views/accueil-stagiaire.js`, `css/pages.css` (lien dans `index.html`)
- Modify: `js/views/home.js` (aiguillage en tête de `renderHome`), `js/accueil-rules.js`, `js/emargement-bandeau.js`, `js/views/config.js` (« À retenir » dans Mes préférences), `js/main.js` (l. 541 : ouverture à froid), `js/dp-rules.js`, `js/db.js`, `outils/verifier_navigation.py`
- Test: `tests/accueil-rules.test.mjs`, `tests/dp-rules.test.mjs`

**Interfaces:**
- Consumes : `chargerSemaine`, `journeeDuJour`, `lundiEnCours` (Task 2) ; `etatEvenement`, `libelleDecompte`, `lignePromo` ; `nouveautesAffichables`, `carteNouveaute`, `marquerLues` ; `prenomDe` ; `ouvrirSignalement` ; `getDpDossier` (le `data` du dossier, pour `exemplesRemplis`).
- Produces :
  - `renderHome` : sous la nouvelle navigation, `renderAccueilStagiaire(container)` pour l'espace stagiaire, `renderAujourdhui(container)` pour l'équipe (Task 4 ; jusque-là, page actuelle) ; sinon, rien ne change.
  - `prochainRendezVous(evenements, aujourdhui): { titre, date, libelle } | null` (`js/accueil-rules.js`) : le premier examen ou stage qui n'est pas passé, sinon le premier événement qui n'est pas passé, hors `ferie` ; `date` : « jeudi 5 novembre » ; `libelle` : `libelleDecompte`.
  - `aFaireStagiaire({ qcm, themes, tentatives, sujetsDeLaSemaine, exemplesDossier, livretCommence, modules, now }): [{ cle, titre, detail, route, sousOnglet }]` (`js/accueil-rules.js`) ; au plus 4 lignes, dans cet ordre : examen ouvert et pas encore passé (« Examen ouvert : <thème> », `examenDemarrable`) ; QCM d'un thème vu cette semaine au planning, jamais tenté (« QCM du thème : <titre> », détail « Pas encore fait · N questions ») ; dossier (« Dossier professionnel », détail « 2 exemples sur 6 », absent à 6 sur 6) ; livret pas commencé (« Livret », détail « Pas encore commencé »). `modules` : `{ qcm, dp, livret }`, un module fermé retire sa ligne.
  - `exemplesRemplis(data): number` (`js/dp-rules.js`) : de 0 à 6, par `exempleRempli`.
  - `signerSeance(seance, moi): Promise<boolean>` et `seancesDuJour(): Promise<Seance[]>` (exports de `js/emargement-bandeau.js`, sans changement du geste actuel) ; événement `emargement-signe` sur `window` après une signature.
  - Sous la nouvelle navigation, sur la route `home`, le bandeau d'émargement ne montre ni « Signer » ni le rappel formateur (la page les porte, ruling R61) ; le message « Tu es noté absent » reste.
  - Ouverture à froid sans dernière page mémorisée, nouvelle navigation : `#/home` (ruling R60).

**Page (ordre de la maquette `stAccueil`) :** pastille de date (jour, numéro, mois, sans l'année), salutation par `prenomDe` (repli sur le nom), ligne `lignePromo`. Carte « Aujourd'hui » : une rangée par demi-journée (titre, horaire, et chaque carte du jour : titre, formateurs, étiquette `moi.texte`, bénévoles de la voiture) ; le bouton « Signer pour ce matin » ou « Signer pour cet après-midi » sous la rangée de la séance ouverte, qu'il y ait ou non un planning ; après signature, « Signé à 8 h 52 ». Sans séance prévue : « Pas de formation aujourd'hui. » ou `repos`. Lien « Ouvrir le planning ». Puis « À faire » (sur téléphone juste sous la journée), « Prochain rendez-vous », une seule Nouveauté (la plus récente, marquée lue, lien « Tout voir »), pied de liens : « Contacts du centre » (`#/ressources`, si le module Ressources est ouvert), « Mes préférences » (`#/preferences`), « Signaler un problème » (`ouvrirSignalement`), puis le pied actuel (`TP ECSR App · Promo...`, code source). Les tuiles, « Prochains événements » (la page Dates clés le fait) et la carte du compte à rebours disparaissent ; « À retenir » passe dans Mes préférences, section Informations : une information ne se perd pas.

- [ ] **Step 1:** Tests : `prochainRendezVous` (stage en cours avant un examen futur, tout passé → null, férié ignoré, seul un « autre » à venir) ; `aFaireStagiaire` (ordre, plafond 4, chaque module fermé, QCM déjà tenté absent, sujet sans thème correspondant ignoré, examen déjà passé absent, 6 sur 6 absent, rien → liste vide) ; `exemplesRemplis`.
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur les nouveaux tests seulement.
- [ ] **Step 3:** Écrire les règles, les exports de l'émargement, la page, ses styles (classes reprises de la maquette et jetons de l'app), l'aiguillage, le déplacement d'« À retenir », l'ouverture à froid.
- [ ] **Step 4:** Script, passe « allumé », stagiaire à 1280, 375 et 320 px : l'Accueil montre la pastille, « Aujourd'hui », « À faire », « Prochain rendez-vous » ; ni tuile ni « Prochains événements » ; avec `?emargement=1`, le bouton « Signer pour ce matin » est dans la rangée Matin et le bandeau ne dit pas « Signer » sur l'Accueil mais le dit sur Planning ; signature au banc, puis « Signé à » ; `?date=` un samedi ; `__HARNESS_FAIL` posé après le démarrage ; `?modules=depart` ; `?lenteur=` et départ vers une autre page pendant le chargement. Adapter les vérifications existantes de l'Accueil (lignes 3246, 3267, 3500, 3871) à la nouvelle page, sans en perdre le sens.
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` et le script. Expected : `fail 0`, 0 échec.
- [ ] **Step 6:** Commit `Lot 2B : Accueil du stagiaire (la journée, signer, à faire, prochain rendez-vous)`.

### Task 4: « Aujourd'hui » du formateur

**Files:**
- Create: `js/views/aujourdhui.js`, `js/aujourdhui-rules.js` (pur)
- Modify: `js/nav-rules.js` (`ENTREES_EQUIPE`), `js/nouveautes-data.js` (guide de `2026-10-28-nouvelle-navigation-formateurs`, l. 57), `css/pages.css`, `outils/verifier_navigation.py` (l. 147, 2620 : Aujourd'hui entre dans `TITRES_DES_PAGES`), `tests/nav-rules.test.mjs`
- Test: `tests/aujourdhui-rules.test.mjs`

**Interfaces:**
- Consumes : `chargerSemaine`, `journeeDuJour` (Task 2) ; `chargerATraiter`, `lireDonneesCentre`, `lireReferentielCentre`, `indicateursPromo(...).aSuivre` ; `listEmargementSeances`, `stagiairesDeFeuille`, `resumeSeance`, `etatLigne`, `absentsDuPlanning`.
- Produces :
  - Entrée de l'équipe : `entree("home", "Aujourd'hui", "home")` ; même route, même mémoire. Stagiaire : « Accueil » inchangé.
  - `titreSelonDemis(base, demis): string` : « Au tableau ce matin », « Au tableau cet après-midi », « Au tableau aujourd'hui » selon les demi-journées concernées ; même règle pour « En voiture ».
  - `auTableauDuJour(journee): [{ id, nom, demi, sujet }]`, `enVoitureDuJour(journee): { stagiaires: [{ id, nom }], benevoles: string[], demis }`.
  - `feuilleDuJour({ seances, stagiaires, entries, heure }): null | { seance, statut: "ouverte" | "close", signes, total, enAttente: string[], titre }` : la séance ouverte, sinon la dernière close du jour ; `titre` « Émargement du matin » ou « de l'après-midi ». Noms en attente par `etatLigne`, les absents notés n'y sont pas.
  - `lignesATraiter({ signalements, propositionsIA }): [{ cle, titre, nombre, sousOnglet }]` : « 3 signalements sur des QCM » (`signalements`), « 2 questions proposées par l'IA » (`ia`) ; nulle ou illisible : ligne absente.

**Page (maquette `fAujourdhui`) :** en-tête aux signatures de Timy : pastille de date, titre « Aujourd'hui », ligne `lignePromo` suivie de « · N stagiaires en formation ». Cartes, dans l'ordre : sur téléphone émargement, à traiter, au tableau, en voiture, à suivre ; sur ordinateur, émargement, au tableau, en voiture (3 colonnes), puis à traiter et à suivre (2 colonnes). Émargement : « 2 sur 6 », jauge, « En attente : ... », bouton « Voir la feuille » (`adresseSeance`), repère « Ouverte » ; sans feuille : « Pas encore ouverte » et le lien vers Émargement ; carte absente si `emargementActif()` est faux. En voiture : lignes menant au Planning et à Stagiaires, sous-onglet Élèves bénévoles. À traiter : lignes menant à Cours et QCM, sous-onglets `signalements` et `ia` (mémoire `CLES_SOUS_ONGLETS.themes`) ; rien : « Rien à traiter. » À suivre de près : les cinq premiers de `aSuivre`, lien vers la fiche, « Tout voir » vers Indicateurs ; repère par jeton d'avertissement, jamais rouge. Les Nouveautés ne sont pas sur cette page, le compte les porte. Pied identique à l'actuel. Ruling R62 : pas de ligne « dossier à relire », la base ne sait pas qu'un dossier attend une relecture.

- [ ] **Step 1:** Tests : les trois formes de `titreSelonDemis` ; `auTableauDuJour` (deux groupes, remplaçant, personne) ; `enVoitureDuJour` (deux cartes sans doublon, bénévoles) ; `feuilleDuJour` (ouverte, close, aucune, absent noté, abandon signé qui reste compté comme sur le bandeau, matin et après-midi ouvertes ensemble : matin) ; `lignesATraiter` (nuls, un seul, singulier et pluriel) ; `tests/nav-rules.test.mjs` aligné sur « Aujourd'hui ».
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur ces tests seulement.
- [ ] **Step 3:** Écrire les règles, la page, l'aiguillage de `renderHome`, l'entrée, le guide de la Nouveauté.
- [ ] **Step 4:** Script, formateur à 1280, 900, 375 et 320 px : le `h2` vaut « Aujourd'hui », la barre du bas tient sur une ligne, chaque carte présente avec `?emargement=1&signalements=1&benevoles=1` ; `__HARNESS_FAIL` : la page reste, sans erreur à l'écran hors des cartes ; `?lenteur=` et changement de promo pendant le chargement ; fondateur en « Voir en tant que » stagiaire : Accueil du stagiaire, sans étiquette ni signature si pas de fiche.
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` et le script. Expected : `fail 0`, 0 échec.
- [ ] **Step 6:** Commit `Lot 2B : Aujourd'hui du formateur (émargement, tableau, voiture, à traiter, à suivre)`.

### Task 5: Planning en grille

**Files:**
- Create: `js/views/planning-grille.js`
- Modify: `js/views/planning.js` (`renderInto` l. 2809-2990, `requestPlanningToday` l. 2719, l. 3446), `css/pages.css`, `outils/verifier_navigation.py`
- Test: `tests/journee-rules.test.mjs` (`vuePlanningInitiale`)

**Interfaces:**
- Consumes : `semaineEnGrille`, `jourParDefaut`, `etiquetteSemaine`, `lundiEnCours` (Task 2).
- Produces :
  - `vuePlanningInitiale(valeurMemorisee): "grille" | "liste"` (`js/journee-rules.js`) : « grille » sauf `"liste"` mémorisée. Mémoire de l'appareil : `planning.vue`.
  - `grilleSemaine({ jours, equipe, jourChoisi, onChoisirJour }): HTMLElement` (`js/views/planning-grille.js`), `bascule({ vue, onChange }): HTMLElement` : groupe « Affichage du planning », boutons « Grille » et « Liste » (`aria-pressed`) ; sous 700 px, le premier s'appelle « Jour ».

**Comportement :** nouvelle navigation, hors mode Modifier, vue « grille » : `renderInto` rend la grille à la place de `.p-days` et de la barre des jours ; la vue « liste », le mode Modifier et l'ancienne navigation gardent le rendu actuel, `.p-day-card` compris. La bascule se place à droite des sous-onglets ou, à défaut, sous eux ; elle disparaît en mode Modifier ; quitter Modifier rend la vue mémorisée. Ordinateur et tablette (700 px et plus) : jours en colonnes, Matin et Après-midi en lignes, `grid-template-columns: auto repeat(5, minmax(0, 1fr))`, aujourd'hui repéré, chaque carte d'une cellule avec son étiquette (Salle, Voiture, Cours, Contrôle, Autonomie, Autre) ; sous l'étiquette : stagiaire, formateurs et `etiquetteSemaine(moi)` ; équipe, formateurs et « 3 au tableau », « 4 en voiture · 2 élèves ». Téléphone : bande de cinq jours (44 px, `role="tablist"`), puis le jour choisi en carte. Les deux formes sont dans le DOM, une seule affichée par CSS, pour suivre une rotation d'écran. Jour de repos : son libellé dans la colonne. Bouton « Aujourd'hui » : semaine en cours, puis jour repéré (téléphone : jour choisi) ; avec la vue « liste », `scrollToDay` actuel. Nouvelle navigation : le Planning ouvre sur `lundiEnCours` et non sur `current_week_lundi` (ruling R59) ; les flèches gardent leur effet.

- [ ] **Step 1:** Tests de `vuePlanningInitiale` (absente, `"liste"`, `"grille"`, valeur inconnue).
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur ces tests seulement.
- [ ] **Step 3:** Écrire la grille, la bascule et le branchement.
- [ ] **Step 4:** Script : à 1280, 1100, 900 px, grille de 5 colonnes sans débordement ; à 375 et 320 px, bande de 5 jours aux cibles de 44 px, jour d'aujourd'hui choisi ; toucher un jour change la carte ; « Liste » montre 5 `.p-day-card` et reste au rechargement ; formateur : « Modifier » montre l'éditeur et aucune grille, « Terminer » rend la grille ; stagiaire : étiquette « Toi au tableau » ; semaine vide ; semaine verrouillée ; impression inchangée (`#print-container` présent) ; `hashchange` vers Dates clés puis retour ; interrupteur éteint : aucun `.vue-toggle`.
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` et le script. Expected : `fail 0`, 0 échec.
- [ ] **Step 6:** Commit `Lot 2B : planning en grille de semaine, bascule Grille ou Liste`.

### Task 6: Cours et QCM : sous-onglets « QCM » et « Propositions IA »

**Files:**
- Create: `js/views/qcm-stagiaire.js`, `js/views/propositions-ia.js`, `js/qcm-rules.js`
- Modify: `js/views/themes.js` (l. 1856-1933, 1938), `js/db.js`, `js/qcm-ia-rules.js`, `js/a-traiter-rules.js` (l. 83), `js/a-traiter.js` (commentaire d'en-tête), `js/modules-data.js` (l. 47), `outils/verifier_navigation.py` (`A_TRAITER_DU_BANC` l. 378-390, plancher `themes`), `_harness_supabase.js`, `tests/a-traiter-rules.test.mjs`
- Test: `tests/qcm-ia-rules.test.mjs`, `tests/qcm-stagiaire-rules.test.mjs`

**Interfaces:**
- Produces :
  - `listBrouillonsIaARelire(): Promise<Brouillon[]>` (`js/db.js`) : statut `a_relire`, du plus ancien au plus récent, avec `qcm:qcm_id(id, theme_id, titre)`.
  - `groupesDeBrouillons(brouillons, themes): [{ theme, qcmId, titre, nombre, plusAncien }]` (`js/qcm-ia-rules.js`), trié par ancienneté ; un brouillon sans thème retrouvé reste listé sous le titre du QCM.
  - `lignesQcmStagiaire({ qcm, themes, tentatives, now }): [{ theme, qcm, titre, etat, note, examenOuvert, action }]` (`js/qcm-rules.js`, pur, nouveau) : QCM ayant au moins une question ; `etat` « Pas encore fait » ou « Dernière note 14/20 » (dernière tentative d'entraînement, par `finished_at`) ; `examenOuvert` par `examenDemarrable` ; `action` « S'entraîner » ; tri : examens ouverts, puis jamais faits, puis faits, à l'intérieur par numéro de thème ; famille « Transversaux » gardée en étiquette.
  - `renderQcmStagiaire(panel, { themes, onOuvrir, isActive })`, `renderPropositionsIa(panel, { themes, onOuvrirEditeur, isActive })` : même modèle que `renderConsoleSignalements` (garde `isActive`, compteur de génération, boîte d'erreur avec « Réessayer »).
- Sous-onglets, nouvelle navigation : stagiaire Thèmes, Compétences, QCM (`key: "qcm"`, `module: "qcm"`), Documents ; équipe Thèmes, Compétences, Signalements, Propositions IA (`key: "ia"`, `isAdmin()` seulement : la lecture de la table est réservée aux administrateurs), Documents. `MODULE_DE_SOUS_ONGLET.themes.qcm = "qcm"`. Le bouton d'une ligne QCM ouvre `openQcmSheet(theme, qcm)` ; « Relire » d'une proposition ouvre `openQcmEditor(theme, qcmId, null, recharger)`, puis `loadQcmIndex` et la pastille se relisent. L'acceptation et le rejet restent dans l'éditeur, inchangés (ruling R63).
- `COMPTER_LES_PROPOSITIONS_IA = true`. Liste « Propositions IA » vide : « Aucune question à relire. »

- [ ] **Step 1:** Tests : `lignesQcmStagiaire` (ordre, dernière note et non la meilleure, QCM vide retiré, examen fermé, thème introuvable) ; `groupesDeBrouillons` (deux QCM, ordre, thème introuvable) ; `tests/a-traiter-rules.test.mjs` aligné sur `true` (le lecteur des propositions est lu).
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur ces tests seulement.
- [ ] **Step 3:** Écrire les règles, la lecture, les deux vues et les sous-onglets. Banc : fixture de brouillons `a_relire` avec `?signalements=1`.
- [ ] **Step 4:** Script : stagiaire, sous-onglet QCM (lignes, « S'entraîner » ouvre la fenêtre, module `qcm` fermé : sous-onglet absent) ; formateur, Propositions IA (lignes, pastille et tiroir disent le total, « 5 à traiter : 3 signalements, 2 propositions de l'IA » selon les données semées) ; `__HARNESS_FAIL` : boîte d'erreur et « Réessayer » ; ligne d'Aujourd'hui vers `ia`.
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` et le script. Expected : `fail 0`, 0 échec.
- [ ] **Step 6:** Commit `Lot 2B : sous-onglets QCM et Propositions IA, propositions comptées dans « à traiter »`.

### Task 7: Mon suivi aux libellés clairs

**Files:**
- Modify: `js/route-rules.js`, `js/views/mon-suivi.js` (l. 511-520, 540-560, 592-610, 651-735), `js/fiche-rules.js`, `js/nav-rules.js` (`#/mon-suivi/classe`), `js/ou-trouver.js`, `js/views/dp.js` (événement `EVT_DOCUMENT`), `outils/verifier_navigation.py`
- Test: `tests/fiche-rules.test.mjs`, `tests/route-rules.test.mjs`, `tests/ou-trouver.test.mjs`

**Interfaces:**
- Produces :
  - `PARTIES` gagne `resultats`. Pour `opts.soi` sous la nouvelle navigation, les parties sont, dans l'ordre : `resultats` (Résultats), `passages`, `epcf`, `livret`, `dp`. `evolution` et `classe` n'y sont plus des parties : `#/mon-suivi/evolution` et `#/mon-suivi/classe` ouvrent Résultats sur « Moi » et « La classe ». La fiche d'un stagiaire chez l'équipe et l'ancienne navigation gardent leurs parties.
  - Résultats : sélecteur « Moi » / « La classe » (mémoire `ecsr_resultats_vue`) ; « Moi » rend la partie Évolution actuelle, « La classe » la zone actuelle (`renderNotes` imbriqué, moyennes EPCF). Module : `notes` (fermé, partie absente).
  - `etatsClairs({ aVenir, evals, livret, exemplesDossier, resultats }): { resultats, passages, epcf, livret, dp }` (`js/fiche-rules.js`), sous la forme `{ texte, afaire }` : `passages` « Passages : 2 à venir » ou « Passages : aucun à venir » ; `epcf` « EPCF : 0 sur 2 » ; `livret` « Livret : commencé » ou « Livret : pas encore commencé » ; `dp` « Dossier pro : 2 exemples sur 6 » ou « Dossier pro : pas encore commencé » ; `resultats` « Résultats : moi et la classe ».
  - `chargerFiche` lit le `data` du dossier pour `soi`, et `EVT_DOCUMENT` porte `exemples` : le compte suit un enregistrement.
  - `ouSelonNavigation` : « Mon suivi, partie Résultats » pour `evolution` et `classe`.
- Disposition (ruling R64) : ordinateur et tablette, sous-onglets ; téléphone, le sommaire actuel, dont les lignes affichent le texte de `etatsClairs` entier. L'annexe disait « 2 parties sur 10 » ; le vrai compte du dossier est de 6 exemples (ruling R65).

- [ ] **Step 1:** Tests : `etatsClairs` (chaque texte, singulier compris) ; `lireAdresse` et `adresseFiche` avec `resultats` ; redirection de `#/notes` du stagiaire vers `#/mon-suivi/resultats` avec la vue « La classe » ; `ouSelonNavigation` ; ancienne navigation inchangée.
- [ ] **Step 2:** `node --test "tests/*.test.mjs"`. Expected : échec sur ces tests seulement.
- [ ] **Step 3:** Écrire les parties, le sélecteur, les libellés et les adresses.
- [ ] **Step 4:** Script : parties dans l'ordre à 1280 et 375 px, plancher `mon-suivi` ramené à 5 ; `#/mon-suivi/classe` et `#/notes` montrent La classe ; aucune ligne « 02/10 » ; la dernière ligne du sommaire n'est pas sous la barre du bas ; fiche d'un stagiaire chez l'équipe inchangée ; `?modules=depart`.
- [ ] **Step 5:** `node --test "tests/*.test.mjs"` et le script. Expected : `fail 0`, 0 échec.
- [ ] **Step 6:** Commit `Lot 2B : Mon suivi aux libellés clairs, Résultats moi et la classe`.

### Task 8: Page CCP2, Nouveautés, vérification complète, revue finale

**Files:**
- Modify: `js/views/ccp2.js` (l. 57-63, 111-132), `css/pages.css` si besoin, `js/nouveautes-data.js`, banc recopié dans `TP_ECSR_App` après `diff`
- Test: `outils/verifier_navigation.py`

**Interfaces:**
- Page CCP2, nouvelle navigation (onglet conservé, décision de Timy) : titre, « Tes dates », « Les 8 étapes », puis « L'épreuve en bref » dans un `<details>` replié, en bas de page ; l'étape ouverte la dernière fois se rouvre comme aujourd'hui. Aucun « avancement » calculé : la base ne le connaît pas (ruling R66). Ancienne navigation : ordre actuel.
- Nouveautés (date du jour de la fusion, ids `2026-11-XX-...`) : pour tous, `navigation: "nouvelle"`, « Ta journée sur l'Accueil » (journée, signature, À faire, grille du planning, QCM, Mon suivi) ; formateurs, `navigation: "nouvelle"`, « Aujourd'hui remplace l'Accueil » (émargement, tableau, voiture, à traiter, à suivre, Propositions IA) ; pour tous, sans champ `navigation`, « Les cours se lisent mieux sur téléphone » (sommaire à la ligne, tableaux en listes). Chaque entrée porte « Où le trouver » et « Comment faire ».

- [ ] **Step 1:** Écrire la page CCP2 et les Nouveautés ; script : ordre de la page, `<details>` fermé ; parité éteinte intacte.
- [ ] **Step 2:** `grep` du tiret cadratin et de « Prof » affiché dans les fichiers modifiés : aucun.
- [ ] **Step 3:** `node --test "tests/*.test.mjs"` et `python outils/verifier_navigation.py <banc>` (allumé et éteint, Chromium et WebKit). Expected : `fail 0`, 0 échec.
- [ ] **Step 4:** Commit `Lot 2B : page CCP2 ouverte sur le parcours, Nouveautés`.
- [ ] **Step 5:** Test du premier clic : captures reprises, tâches S1, S3, S10, S13 et F2, F6, F7, F16 des constats, agents frais ne voyant que les images ; corriger ce qui reste sous 3.
- [ ] **Step 6:** Relecture finale de toute la branche sur le modèle le plus capable, une vague de corrections, captures avant et après pour Timy. Ne pas fusionner sans son accord.

---

## Annexe : décisions prises pendant l'écriture du plan (06/11/2026)

Chaque décision dit ce qui change si elle est fausse.

- CCP2 : l'onglet reste, décision de Timy (« Garder l'onglet », relayée le 06/11) ; test d'arborescence du 29/10 : onglet 4,0, Mon suivi 4,0, Cours et QCM 3,5.
- R58 : une seule lecture de la journée (`js/journee-rules.js`) pour l'Accueil, Aujourd'hui et la grille, en déplaçant les règles de rôle hors de `planning.js` sans en changer le corps (si faux : trois lectures à garder alignées).
- R59 : sous la nouvelle navigation, le Planning ouvre sur la semaine en cours (le lundi suivant, un week-end), pour tous ; `current_week_lundi` ne décide plus de l'ouverture. Les trois testeurs du 28/10 l'ont lu comme une erreur ; décision laissée à Timy par R40, **à confirmer** (si faux : une ligne dans `renderPlanning`).
- R60 : l'ouverture à froid sans mémoire va à l'Accueil ou à Aujourd'hui ; la mémoire de la dernière page reste, comme le veut la spec au § 4.5 (si faux : une ligne dans `bootApp`).
- R61 : sur l'Accueil et Aujourd'hui, le bandeau ne double pas le bouton de signature ni la carte d'émargement ; il reste sur les autres pages (si faux : une condition à retirer).
- R62 : pas de ligne « dossier à relire » dans « À traiter » : aucune colonne ne dit qu'un dossier attend une relecture. Une évolution de la base serait un autre chantier (si faux : une tâche de plus, avec migration).
- R63 : « Propositions IA » liste et renvoie à l'éditeur existant, où se font l'acceptation et le rejet ; pas de second flux (si faux : deux boutons à ajouter).
- R64 : sur téléphone, Mon suivi garde son sommaire (choix du 03/10, seule forme qui montre l'état de chaque partie) ; les sous-onglets valent à partir de 700 px. **À confirmer** : la maquette montrait des sous-onglets partout (si faux : `dispositionFiche` à changer, et les états à reloger).
- R65 : « 2 exemples sur 6 » et non « 2 parties sur 10 » : le dossier compte 6 fiches d'exemple, et « 02/10 » était une date (si faux : un texte).
- R66 : la page CCP2 ouvre sur le parcours, sans avancement calculé : aucune donnée de progression n'existe, et l'ajouter demanderait une table (si faux : un chantier à part).
- R67 : hors du lot : repère « Ouverte » sur l'entrée Émargement, rang personnel des Priorités, « QCM et examens » de l'équipe, « Voir comme un stagiaire » (lot 4), consignes de l'assistant (conversation à part, prévenue que l'entrée de l'équipe devient « Aujourd'hui »).
