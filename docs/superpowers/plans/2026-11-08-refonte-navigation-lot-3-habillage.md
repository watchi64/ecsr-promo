# Refonte de la navigation, lot 3 : l'habillage « Couleurs ECF » - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chacun de passer l'app aux couleurs d'ECF en un toucher, depuis le menu du compte, avec un habillage aussi soigné que le thème par défaut, sans que le thème par défaut change d'un pixel.

**Architecture:** Toute couleur de l'interface devient une variable CSS du `:root` de `css/style.css`, à sa valeur actuelle (thème par défaut identique au pixel, prouvé par comparaison de captures). L'habillage ECF est un seul bloc `:root[data-skin="ecf"]` qui ne contient que des variables (`css/habillage-ecf.css`). Un script bloquant en tête de page pose `data-skin` sur `<html>` depuis la mémoire de l'appareil avant la première peinture ; le choix est ensuite rapproché de celui du compte (colonne `user_profiles.habillage`, fonction `set_my_habillage`).

**Tech Stack:** JavaScript en modules ES sans framework, un script classique pour l'avant-peinture, CSS (variables), Supabase (une colonne, une fonction, une preuve SQL), tests `node --test`, banc `_harness.html`, Playwright (Python) et Pillow pour `outils/verifier_navigation.py` et `outils/captures_habillages.py`.

**Spec:** `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md`, § 3 (anti-objectifs) et § 4.4 (habillage ECF) ; découpage `docs/superpowers/plans/2026-10-27-refonte-navigation-lots.md` (lot 3) ; maquette `docs/maquettes/refonte-navigation.src.html` (jetons ECF l. 127-139, repère rouge l. 238, salutation l. 303, pastilles d'habillage l. 553-558 et 1427-1429, menu du compte l. 1524-1525, liseré l. 284) ; règle de Timy du 08/11 (expérience et robustesse avant la DA, habillage aussi beau que le défaut, un thème = un jeu de variables, AA dans les deux thèmes).

## Global Constraints

- Couleurs d'ECF relevées sur ecf.asso.fr : bleu `#124483`, bleu nuit `#0D2546`, rouge `#DB1418`. Titres en Outfit, graisse 600. Logo d'ECF interdit (pas d'accord écrit d'ECF).
- Le rouge ne sert qu'aux repères (trait de l'entrée active de la barre sombre, pastilles chiffrées) ; jamais une note en rouge : les notes gardent leur échelle douce dans les deux habillages.
- L'habillage est une option ; le thème par défaut reste celui de l'app (« ECSR Promo ») et **ne change pas d'un pixel** (seules exceptions : celles que la Task 13 liste, chacune justifiée).
- Un thème = un jeu de variables : aucune règle CSS propre à une page sous `[data-skin]`. Un défaut de l'habillage ECF se corrige par un jeton (ajouté au `:root` à la valeur actuelle, redéfini dans le bloc ECF), jamais par une retouche de page.
- Contraste AA dans les deux thèmes : 4,5:1 pour le texte, 3:1 pour le grand texte et les repères non textuels.
- **Deux sortes de jetons de couleur, listées une seule fois** dans `js/habillage-familles.js` (Task 2), lues par le test node et par le vérificateur (importé dans la page) :
  - `PREFIXES_HABILLAGE` : la couleur de l'interface (fonds, textes, traits, accent, barre sombre, repères, halos, lueurs, ombres, graphes, titres). Le bloc ECF redéfinit **chacun** de ces jetons.
  - `FAMILLES_FIXES` : une couleur qui porte un sens et le garde dans les deux habillages (`--note`, `--act`, `--c-`, `--doc`, `--apercu` au départ). ECF n'en redéfinit **aucune**. Une famille fixe nouvelle, née de la chasse (par exemple un avertissement qui n'est ni une note ni un statut), s'ajoute à cette liste dans le même commit.
  - Règle de tri d'un littéral : il dit quelque chose (note, activité, statut, alerte) → famille fixe ; il habille (surface, texte, trait, gris pur, axe de graphe, décor) → famille d'habillage. Tout jeton de couleur de `:root` appartient à l'une des deux.
- Aucun défilement de côté (seule exception : `.matrice-wrap`) ; zones à toucher de 44 px sous 700 px ; « Formateur », jamais « Prof » ; tutoiement ; jamais de tiret cadratin (U+2014), ni dans le code ni dans les commentaires ni dans les messages de commit.
- Une migration (Task 12) : écrite et prouvée à blanc, appliquée en production **seulement avec l'accord explicite de Timy**. L'app part en ligne sans elle (le choix reste alors sur l'appareil). Redéploiement de la fonction `chatbot` : avec son accord aussi.
- Worktree `C:/Users/watch/Dev/ecsr-promo-plan-lot3`, branche `plan-lot3`, banc servi par l'entrée `banc-lot3` (port 8060) de `C:/Users/watch/Dev/ECSR/.claude/launch.json`. Ne pas toucher aux branches `lot4-roles` et des autres chantiers.
- Tests : `node --test "tests/*.test.mjs"` (glob obligatoire), tous verts à chaque commit ; `python outils/verifier_navigation.py http://127.0.0.1:8060/_harness.html` sans échec à la fin de chaque tâche qui touche l'affichage ; captures du thème par défaut comparées au pixel après chaque tâche des Tasks 3 à 9.
- Chaque nouvelle ligne `import` et chaque `<script>`/`<link>` ajouté porte, dès son commit, le jeton `?v=` courant de ses voisins (`tests/qualiopi-page.test.mjs` compare chaque jeton d'`index.html` au premier ; le crochet ne le repose que sur main).
- Les numéros de ligne cités sont ceux de main au 08/11, avant la fusion du lot 2B : se fier aux noms de fonctions, de sélecteurs et aux bandeaux de commentaire, et relocaliser.
- Commentaires en français, dans le ton du code voisin : ils disent le pourquoi.
- Pause à 70 % de la fenêtre de 5 h (outil `get_usage`), reprise après sa remise à zéro ; rien ne tourne après 6 h du matin.

## Review Focus

1. **Appareil partagé** (tablette de salle) : une personne se connecte après une autre qui avait choisi ECF. Attendu : l'écran de connexion et le tout début du démarrage gardent l'habillage de l'appareil (le script d'avant-peinture ne sait pas encore qui se connecte) ; dès que le profil est lu, la page prend le choix de la personne, ou le défaut, sans rechargement, et jamais celui de l'autre ensuite. Tests : Task 8 (règles), Task 9 (démarrage), Task 10 (scénario du banc avec un appareil estampillé `autre@example.test`).
2. **Enregistrement sur le compte impossible** (hors ligne, fonction absente avant la migration, erreur du serveur) : attendu : le choix tient sur l'appareil, aucun message d'erreur, il est renvoyé à l'ouverture suivante. Tests : Task 8 et Task 9 (levier du banc `?habillage_panne=1`).
3. **Changement en direct** pendant qu'une page est ouverte (graphe des notes, grille du planning, menu du compte ouvert) : attendu : tout se repeint sans recharger, le menu reste ouvert, le focus reste sur la pastille pressée. Tests : Task 4 (graphes en classes CSS) et Task 11 (vérification du menu).
4. **Navigation éteinte** (Nîmes, Montpellier) : attendu : rien ne change par rapport à main tant que la personne n'a rien choisi ; si l'appareil ou le compte porte ECF, la personne peut toujours revenir à ECSR Promo (jamais piégée sans interrupteur). Tests : Task 10 (passe éteinte, appareil en ECF) et Task 11.
5. **Stockage indisponible ou abîmé** (navigation privée de Safari, `localStorage` qui lève, JSON tronqué, valeur inconnue comme `"sombre"`) : attendu : ECSR Promo, aucune erreur, l'app s'ouvre. Tests : Task 8 (`lireAppareil`) et Task 9 (script d'avant-peinture joué dans `vm`).

---

## Avant de commencer (au signal de la fusion du lot 2B)

Le lot 2B repeint les mêmes pages ; ce lot démarre quand la conversation de coordination annonce sa fusion dans main.

- [ ] `git -C C:/Users/watch/Dev/ecsr-promo-plan-lot3 merge main` ; conflits de jeton `?v=` seulement : prendre celui de main partout (sinon node charge deux fois le même module).
- [ ] Banc : copier `_harness_build.mjs` et `_harness_supabase.js` depuis `C:/Users/watch/Dev/ECSR/TP_ECSR_App` (le lot 2B y a recopié le sien), puis `node _harness_build.mjs`. Ajouter l'entrée `banc-lot3` (port 8060, racine du worktree) au `launch.json` de `Dev/ECSR`.
- [ ] Relever le point de départ : nombre de tests (`node --test "tests/*.test.mjs"`, `fail 0`), `verifier_navigation.py` à 0 échec, et, si le lot 4 ou un autre chantier a été fusionné entre-temps, les fichiers CSS ou JS qu'il a ajoutés (ils entrent dans la dette de la Task 2).
- [ ] Si `docs/qualite/` (robot des parcours de la conversation « 05 - Poser le filet qualité ») est dans main, lire son mode d'emploi : il sera joué dans les deux habillages à la Task 13.

### Task 1: Captures des deux habillages et comparaison au pixel

**Files:**
- Create: `outils/captures_habillages.py`

**Interfaces:**
- Consumes : de `outils/verifier_navigation.py` (importé comme module, son `main` est gardé par `if __name__`), ce qui ouvre le banc et lit la coquille : `nouveau_contexte`, `charger`, `attendre`, `regles_de_la_page`, `ouvrir_entree`, les constantes `DATE_DU_BANC`, `HAUTEUR`, `CLE_APERCU`. Aucun chemin vers une page n'est réécrit à la main.
- Produces : `python outils/captures_habillages.py [BANC] --sortie DOSSIER [--habillages ecsr,ecf] [--moteurs chromium,webkit] [--largeurs 1280,375] [--roles stagiaire,prof,fondateur] [--forcer] [--comparer DOSSIER_AVANT]`.
  - Levier d'habillage (le même pour tout robot) : avant le chargement, `localStorage.ecsr_habillage = JSON.stringify({ nom })`. `--forcer` pose en plus `data-skin` sur `<html>` par un script d'initialisation (Task 7 seulement, avant que le mécanisme existe).
  - Vues, par rôle, nouvelle navigation allumée comme dans le vérificateur : chaque entrée de la coquille et chaque sous-onglet, le menu du compte ouvert, le tiroir « Plus » (téléphone, équipe), Mes préférences, Nouveautés, l'écran de connexion (`?role=anon`), l'aperçu d'une feuille d'émargement, la page Qualiopi (fondateur).
  - Sortie : `DOSSIER/<moteur>/<habillage>/<role>-<largeur>-<vue>.png` (page entière, `animations="disabled"`, `caret="hide"`, `reduced_motion="reduce"`, après `document.fonts.ready`) et `DOSSIER/planche.html` : pour chaque vue, ECSR Promo et Couleurs ECF côte à côte, téléphone et ordinateur, nommés en clair.
  - `--comparer AVANT` : pour chaque image présente des deux côtés, `ImageChops.difference(...).getbbox()` ; affiche « N vues identiques, M différentes » puis la liste ; code de sortie 1 si une vue diffère ou manque d'un côté.

- [ ] **Step 1:** Écrire le script.
- [ ] **Step 2:** Le lancer deux fois sur le code inchangé (`--habillages ecsr`) dans deux dossiers de `C:/Users/watch/Dev/ecsr-promo-lot3-captures/` (hors dépôt), puis `--comparer`. Expected : `0 différentes`. Sinon, trouver la source d'instabilité (heure affichée, animation, image chargée tard) et la neutraliser dans le script, jamais dans l'app.
- [ ] **Step 3:** Garder le premier jeu comme référence : `C:/Users/watch/Dev/ecsr-promo-lot3-captures/avant`.
- [ ] **Step 4:** Commit `Lot 3 : captures des deux habillages et comparaison au pixel`.

### Task 2: La garde des couleurs (test à cliquet)

**Files:**
- Create: `js/habillage-familles.js` (constantes pures), `tests/aides-css.mjs`, `tests/habillage-jetons.test.mjs`

**Interfaces:**
- Produces, `js/habillage-familles.js` : `PREFIXES_HABILLAGE` (`--bg`, `--line`, `--text`, `--accent`, `--sur-sombre`, `--sombre`, `--repere`, `--sur-repere`, `--pastille`, `--sur-pastille`, `--halo`, `--lueur`, `--shadow`, `--ombre`, `--graphe`, `--font-display`, `--poids-titre`, `--lisere-habillage`, `--barre-etat`) et `FAMILLES_FIXES` (`--note`, `--act`, `--c-`, `--doc`, `--apercu`), gelés ; `familleDe(nom): "habillage" | "fixe" | null`. Liste ouverte : les Tasks 3 à 5 y ajoutent une famille quand la règle de tri des Global Constraints le demande.
- Produces, `tests/aides-css.mjs` : `lireRegles(texteCss): Array<{ selecteur: string, contexte: string[], declarations: Array<{ propriete: string, valeur: string, ligne: number }> }>` (commentaires retirés, `contexte` = les at-rules englobantes) ; `couleursLitterales(texte): string[]` (hex de 3, 4, 6 ou 8 chiffres, `rgb()`, `rgba()`, `hsl()`, `hsla()`, noms de couleur CSS) ; `estNeutre(litteral): boolean`, vrai pour `#fff`, `#ffffff`, `#000`, `#000000`, `white`, `black`, `transparent`, `currentColor`, `rgba(255, 255, 255, a)`, `rgba(0, 0, 0, a)` (espaces et casse indifférents).
- Produces, `tests/habillage-jetons.test.mjs`, quatre règles :
  1. CSS (`css/*.css` sauf `fonts.css` et `livret.css`, document officiel TP-01303 relevé du .docx, dont la petite barre d'outils écran garde ses gris et ses statuts) : une couleur non neutre n'apparaît que comme valeur d'une variable (`--nom: …`) ou sous `@media print`.
  2. Une variable dont la valeur contient une couleur ne se déclare que dans `:root` (`css/style.css`), dans le bloc ECF (Task 7) ou sur une racine de document listée dans `RACINES_DOCUMENTS` (au départ `.dp-doc`).
  3. JS (`js/**/*.js` hors `EXEMPTS_JS`) : aucune couleur hex, `rgb`, `hsl` non neutre. `EXEMPTS_JS`, chacun avec sa raison en commentaire : dessins des cours (panneaux, véhicules, marquage : couleurs réglementaires) `js/dessins-*.js`, `js/dessin-svg.js`, `js/scene-*.js`, `js/scenes.js`, `js/signaux.js`, `js/signaux-catalogue.js`, `js/marquage.js`, `js/piece-cycliste.js` ; encre de signature `js/signature-pad.js` ; documents officiels `js/views/epcf-livret.js`, `js/doc-officiel.js` ; palette des trames EPCF `js/epcf-trames.js`. Compléter la liste par le relevé, sans y mettre une vue de l'interface.
  4. Tout jeton de couleur de `:root` (valeur avec une couleur, ou un `var()` vers un tel jeton) a une famille (`familleDe` non nul) ; aucun nom n'appartient aux deux listes.
  5. Cliquet : `DETTE = { "<fichier>": n }`, le nombre d'écarts aux règles 1 à 4 par fichier. Un fichier au-dessus de sa dette échoue ; un fichier en dessous échoue aussi, avec « baisser la dette de <fichier> à <n> ». À la fin de la Task 5, `DETTE` est vide.

- [ ] **Step 1:** Tests de `aides-css.mjs` : un bloc avec commentaire contenant `#123456` (ignoré), `@media print` imbriqué (contexte rendu), `rgba( 255,255,255, .5 )` neutre, `#F5E8D0` non neutre, `var(--x, #6B7F4E)` (repli compté comme littéral).
- [ ] **Step 2:** Écrire les règles avec `DETTE = {}`. Run : `node --test "tests/*.test.mjs"`. Expected : échec qui liste chaque écart, fichier et ligne.
- [ ] **Step 3:** Recopier les comptes relevés dans `DETTE`. Expected : `fail 0`.
- [ ] **Step 4:** Commit `Lot 3 : garde des couleurs écrites en dur (test à cliquet), familles de jetons`.

### Task 3: Jetons du socle, barre sombre et première moitié de `style.css`

**Files:**
- Modify: `css/style.css` (`:root` l. 30-97, puis du début jusqu'à la section des notes, à repérer par son bandeau de commentaire), `css/navigation.css` (l. 39-44 et chaque emploi de `--nav-creme*`), `css/signalement.css` et `css/pages.css` s'ils emploient `--nav-creme*`, `tests/habillage-jetons.test.mjs` (dette)

**Interfaces:**
- Consumes : `js/habillage-familles.js` (Task 2) ; chaque jeton créé a un préfixe de l'une des deux listes, ou la liste reçoit une nouvelle famille fixe.
- Produces, dans `:root`, à la valeur exacte du littéral remplacé (réemployer un jeton existant seulement si sa valeur est identique) ; noms en français, par rôle. Un gris pur ou un gris teinté de décor (`#ccc`, `#555`, `#F0F0EC`…) devient un jeton d'habillage à sa valeur (`--line-*`, `--text-*`, `--bg-*`, `--graphe-*`), qu'ECF redéfinit dans sa gamme bleutée :
  - Barre sombre (ex `--nav-creme*`, déplacés de `body[data-nav="v2"]` vers `:root`, sinon le bloc ECF ne les atteindrait pas) : `--sur-sombre`, `--sur-sombre-doux`, `--sombre-survol`, `--sombre-allume`, `--sombre-filet`, `--sombre-bord`, `--sombre-2` (`#2A211C`) ; variantes d'opacité seulement si un littéral l'exige.
  - Repères : `--repere-sombre: var(--accent-on-dark)` (trait de l'entrée active, `navigation.css` l. 462 ; pastilles de la barre sombre, l. 878), `--sur-repere-sombre: var(--bg-deep)`, `--pastille: var(--accent)` et `--sur-pastille: var(--bg-elev)` (`.nav-pastille`, l. 857).
  - Halos et lueurs : `--halo-*` (anneaux de focus en `rgba(4, 120, 87, a)`), `--lueur-1`, `--lueur-2` (fond de l'écran de connexion, l. 189-190).
  - Ombres : `--ombre-*` pour les ombres teintées hors `--shadow-1..3`.
  - Familles fixes, jamais redéfinies par ECF : `--note-*` (échelle des notes : fonds et textes bas, moyen, haut), `--act-*-texte` (texte des étiquettes d'activité, ex. `#92400E` sur `--act-peda`), `--c-*` (statuts), `--apercu-*` (Task 11).
  - `--lisere-habillage: none` et `--barre-etat: #1A1612` (valeur actuelle de `<meta name="theme-color">`).

- [ ] **Step 1:** Remplacer chaque littéral non neutre de la zone par son jeton ; renommer `--nav-creme*` partout.
- [ ] **Step 2:** Baisser la dette ; `node --test "tests/*.test.mjs"`. Expected : `fail 0`.
- [ ] **Step 3:** `python outils/captures_habillages.py <banc> --habillages ecsr --sortie <captures>/t3 --comparer <captures>/avant`. Expected : `0 différentes`.
- [ ] **Step 4:** `python outils/verifier_navigation.py <banc> --moteurs chromium`. Expected : 0 échec.
- [ ] **Step 5:** Commit `Lot 3 : jetons du socle, barre sombre et repères (thème par défaut identique)`.

### Task 4: Seconde moitié de `style.css` et graphes des notes

**Files:**
- Modify: `css/style.css` (de la section des notes à la fin, blocs `@media print` exceptés), `js/views/notes.js` (styles en ligne l. 573-595 et 842 ; couleurs des graphes SVG l. 1410-1649), `tests/habillage-jetons.test.mjs` (dette)

**Interfaces:**
- Consumes : familles `--note-*`, `--act-*-texte`, `--c-*` de la Task 3 ; `js/habillage-familles.js`. Les ambres et verts d'avertissement de la matrice, des indicateurs et des cartes de thème (`.matrice-table .warn`, `.notes-kpi.warn`, `.theme-stat-card.*`) disent un niveau de note : famille `--note-*`.
- Produces : les graphes des notes posent des classes (`notes-axe`, `notes-axe-zero`, `notes-graduation`, `notes-valeur`, `notes-libelle`, `notes-libelle-anonyme`, `notes-piste`, `notes-valeur-faible`, à ajuster à l'usage) dont la couleur vient d'un jeton `--graphe-*` (famille d'habillage) dans `style.css` ; plus aucun `setAttribute("fill"|"stroke", "#…")`. Raison : une couleur posée par CSS suit le changement d'habillage en direct, un attribut ne bouge pas.
- Exception assumée au pixel identique : les petites valeurs des graphes, écrites aujourd'hui en `#9DA89A` (2,2:1, sous le seuil AA dans les deux thèmes), passent sur un jeton de texte à 4,5:1 au moins (`--graphe-texte-faible`, ou `--text-muted`). Seules les vues des graphes de notes diffèrent alors de `avant` ; la Task 13 le liste.

- [ ] **Step 1:** Remplacer les littéraux ; boutons et menus en ligne de `notes.js` en classes ; retirer les replis `var(--accent,#6B7F4E)`.
- [ ] **Step 2:** Baisser la dette (`css/style.css` à 0, `js/views/notes.js` à 0) ; tests. Expected : `fail 0`.
- [ ] **Step 3:** Captures comparées à `avant`. Expected : seules les vues des graphes de notes diffèrent (petites valeurs devenues lisibles). Le vérificateur (contrôle « notes en rouge » compris). Expected : 0 échec.
- [ ] **Step 4:** Commit `Lot 3 : notes, QCM et EPCF en jetons, graphes des notes en classes, petites valeurs lisibles`.

### Task 5: Autres feuilles, documents imprimés et dernières vues

**Files:**
- Modify: `css/emargement.css`, `css/qualiopi.css`, `css/cours-blocs.css`, `css/signalement.css`, `css/dp.css` si la règle 2 le demande, tout fichier restant dans `DETTE`, `tests/habillage-jetons.test.mjs`

**Interfaces:**
- Produces : `--doc-*` dans `:root` pour la feuille d'émargement (`.emf-*`) et le dossier Qualiopi (`.qdoc`), valeurs actuelles, police des titres comprise (`--doc-police-titre`, la pile de Canela) : ces documents n'emploient plus `--font-display` ni aucun jeton d'habillage. Décision H5 (à confirmer par Timy, question 1) : un document imprimé a le même aspect quelle que soit la personne qui l'imprime. Si Timy répond l'inverse, les `--doc-*` d'habillage passent dans les préfixes de la Task 7.
- Le bandeau écran de la feuille d'émargement (hors document) suit les jetons de l'app.

- [ ] **Step 1:** Remplacer les littéraux restants ; `DETTE` vide.
- [ ] **Step 2:** Tests. Expected : `fail 0`, `DETTE = {}`.
- [ ] **Step 3:** Captures comparées à `avant` (aperçu de la feuille d'émargement et Qualiopi compris) : `0 différentes`. Vérificateur : 0 échec.
- [ ] **Step 4:** Commit `Lot 3 : feuilles restantes et documents imprimés en jetons, plus aucune couleur en dur`.

### Task 6: Titres en jetons

**Files:**
- Modify: `css/style.css` (règle `h1, h2, h3` l. 129 et les 14 règles en `var(--font-display)`), `css/qualiopi.css`, `css/signalement.css`, `css/pages.css` si besoin, `tests/habillage-jetons.test.mjs`

**Interfaces:**
- Produces : `--poids-titre: 700`, `--poids-titre-leger: 300`, `--poids-titre-normal: 400`, `--poids-titre-moyen: 500` dans `:root`.
- Règles ajoutées au test : (a) toute règle qui déclare `font-family` avec `var(--font-display)` déclare aussi `font-weight`, et sa valeur est un `var(--poids-titre…)`, jamais un nombre ; (b) toute déclaration `font-weight` numérique dans une règle dont un sélecteur vise `h1`, `h2`, `h3` ou `.display` (ils héritent la police des titres de la règle `h1, h2, h3`, ex. `.cours-head-titre`, `.cours-h2`, `.legal-titre`, `.sd-head h3`) passe aussi par un jeton. Les titres qui héritent la police par une classe sans balise de titre sont rattrapés par le contrôle du vérificateur de la Task 10.

- [ ] **Step 1:** Ajouter la règle au test. Expected : échec sur les règles concernées.
- [ ] **Step 2:** Passer chaque poids de titre en jeton. Tests. Expected : `fail 0`.
- [ ] **Step 3:** Captures comparées à `avant`. Expected : `0 différentes`.
- [ ] **Step 4:** Commit `Lot 3 : poids des titres en jetons`.

### Task 7: Le thème « Couleurs ECF »

**Files:**
- Create: `css/habillage-ecf.css`
- Modify: `index.html` (lien juste après `css/style.css`), `css/navigation.css` (une règle : le liseré sous l'en-tête sombre de l'équipe sur téléphone, maquette l. 284 : un `::after` en `position: absolute`, collé au bas de l'en-tête, 3 px de haut, `background: var(--lisere-habillage)`, hors du flux ; avec `none` en ECSR Promo, il ne prend aucune place et rien ne bouge au pixel), `tests/habillage-jetons.test.mjs`

**Interfaces:**
- Produces, `css/habillage-ecf.css` : un seul bloc `:root[data-skin="ecf"] { … }`, rien que des variables. Valeurs fixées (maquette validée, jetons ramenés aux noms de l'app) :
  - Fonds et traits : `--bg #F3F5F9`, `--bg-elev #FFFFFF`, `--bg-soft #E8EDF5`, `--bg-subtle #EBEFF6`, `--bg-deep #0D2546`, `--line #D6DDE8`, `--line-strong #B2BED0`, `--line-faint #E3E8F0`.
  - Textes : `--text #13213A`, `--text-soft #33465F`, `--text-muted #52637B`, `--text-faint #9AA8BC` (décor seulement, hors des `PAIRES` : la Task 4 lui a retiré ses derniers emplois en texte).
  - Accent : `--accent #124483`, `--accent-strong #0D2546`, `--accent-soft #E3EBF6`, `--accent-soft-2 #C8D7EC`, `--accent-on-dark #FFFFFF`.
  - Barre sombre : `--sur-sombre #E3EAF6`, `--sur-sombre-doux #A5B6CF`, `--sombre-2 #14335E`, survol, allumé, filet et bord en `rgba(255, 255, 255, a)` aux opacités de la maquette (0,07 ; 0,11 ; 0,09 ; 0,22).
  - Repères : `--repere-sombre #DB1418`, `--sur-repere-sombre #FFFFFF`, `--pastille #DB1418`, `--sur-pastille #FFFFFF`.
  - Halos et lueurs en bleu `rgba(18, 68, 131, a)` (mêmes opacités) ; seconde lueur `rgba(219, 20, 24, 0.08)` ; ombres en `rgba(13, 37, 70, a)` (mêmes opacités que le défaut).
  - Titres : `--font-display: var(--font)`, `--poids-titre: 600`, `--poids-titre-leger: 400`, `--poids-titre-normal: 500`, `--poids-titre-moyen: 600`.
  - `--lisere-habillage: linear-gradient(90deg, #124483 0 46%, #FFFFFF 46% 54%, #DB1418 54% 100%)`, `--barre-etat: #0D2546`.
  - Tout jeton d'habillage créé aux Tasks 3 à 6 et absent de cette liste reçoit une valeur de la même logique (neutres bleutés, blanc translucide sur le bleu nuit).
- Règles ajoutées au test :
  - le fichier n'a qu'un bloc, de sélecteur exactement `:root[data-skin="ecf"]`, et rien que des variables ;
  - chaque nom existe dans `:root` et est de famille « habillage » (`familleDe`, Task 2) ; réciproquement, tout jeton de `:root` de famille « habillage » est redéfini (rien n'oublie de passer au bleu) ; aucun jeton de `FAMILLES_FIXES` ne l'est ;
  - `data-skin` n'apparaît dans aucun autre fichier CSS, et en JavaScript seulement dans `js/habillage.js` et `js/habillage-avant-peinture.js` ;
  - contrastes calculés pour les deux thèmes, var() résolues et transparences composées sur leur fond : `PAIRES = [[texte, fond, seuil]]` avec au moins `--text`, `--text-soft`, `--text-muted` sur `--bg`, `--bg-elev`, `--bg-soft`, `--bg-subtle` (4,5) ; `--accent` sur `--bg`, `--bg-elev`, `--accent-soft` (4,5) ; `--accent-strong` sur `--accent-soft-2` (4,5) ; blanc sur `--accent` (4,5) ; `--sur-sombre` et `--sur-sombre-doux` sur `--bg-deep` (4,5) ; `--accent-on-dark` sur `--bg-deep` (4,5) ; `--sur-repere-sombre` sur `--repere-sombre` et `--sur-pastille` sur `--pastille` (4,5) ; `--repere-sombre` contre `--bg-deep` et `--pastille` contre `--bg-elev` (3). Le rouge contre le bleu nuit tient 3,01:1 : ne pas l'arrondir à la baisse, et ne changer ni l'un ni l'autre (couleurs d'ECF). Le trait de l'entrée active est posé à 10 px hors de l'entrée (`left: -10px`), donc sur le fond de la barre et non sur l'entrée allumée (2,17:1 contre elle) : la Task 10 le mesure contre le fond réel sous lui ; s'il tombe un jour sur l'entrée allumée, il s'en écarte, on ne touche pas au rouge.

- [ ] **Step 1:** Ajouter les règles au test. Expected : échec, fichier absent.
- [ ] **Step 2:** Écrire `css/habillage-ecf.css`, le lien et le liseré. Tests. Expected : `fail 0`.
- [ ] **Step 3:** `captures_habillages.py --habillages ecsr,ecf --forcer --sortie <captures>/t7` ; regarder la planche page par page. Dans le banc en ECF forcé, lister par script les textes de 20 px et plus en Outfit sous la graisse 400 : chacun passe par un jeton de poids.
- [ ] **Step 4:** Captures du défaut comparées à `avant`. Expected : `0 différentes`.
- [ ] **Step 5:** Commit `Lot 3 : habillage Couleurs ECF (un bloc de variables)`.

### Task 8: Règles de l'habillage

**Files:**
- Create: `js/habillage-regles.js` (pur), `tests/habillage-regles.test.mjs`

**Interfaces:**
- Produces :
  - `HABILLAGES = ["ecsr", "ecf"]` (gelé), `HABILLAGE_PAR_DEFAUT = "ecsr"`, `CLE_APPAREIL = "ecsr_habillage"`.
  - `habillageValide(nom): boolean`.
  - `lireAppareil(texte: string | null): { nom, email: string | null, aEnvoyer: boolean } | null` : null pour tout texte illisible ou de nom inconnu.
  - `ecrireAppareil({ nom, email, aEnvoyer }): string` (JSON).
  - `habillageRetenu({ appareil, compte, email, centre = null, reseau = null, libre = true }): { nom, aEnvoyer: boolean, source: "appareil" | "compte" | "centre" | "reseau" | "defaut" }`, dans cet ordre : si `libre` est faux et `centre` valide, le centre l'emporte (le choix personnel reste sur l'appareil et le compte, sans être appliqué) ; appareil d'une autre personne (`appareil.email` posé et différent de `email`) ignoré ; appareil `aEnvoyer` → lui, à envoyer ; compte valide → lui ; appareil sans compte (même personne, ou choix pas encore attribué) → lui, à envoyer ; puis centre, réseau, défaut (ordre de la spec, § 4.4). Le lot 5 fournira `centre`, `reseau` et `libre` (« Laisser chacun choisir le sien », maquette l. 1292), lus en base par lui.

- [ ] **Step 1:** Tests : (1) rien → `ecsr`, `defaut` ; (2) appareil `{ecf, A, aEnvoyer}`, compte `ecsr`, `A` → `ecf`, à envoyer ; (3) appareil `{ecf, A}` envoyé, compte `ecsr` → `ecsr`, `compte` (changé ailleurs) ; (4) appareil `{ecf, B, aEnvoyer}`, compte nul, `A` → `ecsr`, `defaut` ; (5) appareil `{ecf}` sans email, compte nul → `ecf`, à envoyer ; (6) compte `"violet"` → ignoré ; (7) centre `ecf` → `centre`, réseau `ecf` seul → `reseau`, centre avant réseau, choix personnel avant les deux, mais centre `ecf` avec `libre: false` l'emporte sur un compte `ecsr` (source `centre`, `aEnvoyer` faux) ; (8) `lireAppareil` sur `null`, `""`, `"{"`, `'"ecf"'`, `'{"nom":"sombre"}'` → `null`, et `'{"nom":"ecf"}'` → `{ nom: "ecf", email: null, aEnvoyer: false }`.
- [ ] **Step 2:** Run. Expected : échec, module absent.
- [ ] **Step 3:** Écrire le module. Run. Expected : `fail 0`.
- [ ] **Step 4:** Commit `Lot 3 : règles de l'habillage (appareil, compte, centre, réseau)`.

### Task 9: Appliquer et retenir l'habillage

**Files:**
- Create: `js/habillage-avant-peinture.js` (script classique, sans import), `js/habillage.js`, `tests/habillage.test.mjs`
- Modify: `index.html` (balise `<script src="js/habillage-avant-peinture.js?v=…">` dans `<head>`, après les feuilles de style ; retirer `data-accent="brique"` de `<html>`), `js/main.js` (retirer les imports et les appels de `loadTheme` et `loadAccent` ; au début de `bootApp`, `habillageAuDemarrage({ email: getAdminEmail(), compte: getProfile()?.habillage ?? null })` sans l'attendre : le profil réel, jamais celui de « Voir en tant que »), `js/db.js` (`setMonHabillage`), `css/style.css` (règles mortes `.accent-switcher`, `[data-theme="charcoal"]`), `_harness_supabase.js` (gestionnaire explicite de la fonction `set_my_habillage`, qui rend sa valeur ; avec `?habillage_panne=1`, il rend `{ data: null, error: { message } }` : sans gestionnaire, le faux client répond un succès vide à toute fonction inconnue et un oubli passerait pour une réussite), `outils/captures_habillages.py` (`--forcer` n'est plus employé)
- Delete: `js/theme-switcher.js`, `js/accent-switcher.js`

**Interfaces:**
- Consumes : `js/habillage-regles.js` (Task 8).
- Produces :
  - Avant-peinture : lit `localStorage.ecsr_habillage`, applique la même lecture que `lireAppareil` (dupliquée, quelques lignes : un script classique ne peut rien importer), pose `document.documentElement.dataset.skin` (`"ecsr"` ou `"ecf"`), puis met dans `<meta name="theme-color">` la valeur calculée de `--barre-etat`. Tout dans un `try` : rien ne doit l'empêcher de laisser l'app s'ouvrir. Il est placé après les feuilles de style pour que `getComputedStyle` les voie.
  - `js/db.js` : `setMonHabillage(nom: string | null): Promise<string | null>` → `supabase.rpc("set_my_habillage", { val: nom })`, lève sur `error`, comme `setMyAnonymousNotes`.
  - `js/habillage.js`, dépendances injectables (défauts : `localStorage`, `getAdminEmail()`, `setMonHabillage`, `document`) :
    - `appliquerHabillage(nom, deps?): void` : attribut, `theme-color`, puis `window.dispatchEvent(new CustomEvent("ecsr:habillage", { detail: { nom } }))`.
    - `choisirHabillage(nom, deps?): Promise<{ nom, enregistre: boolean } | null>` : null pour un nom invalide ; sinon applique, écrit l'appareil `{ nom, email, aEnvoyer: true }`, enregistre sur le compte puis réécrit `aEnvoyer: false` ; un échec laisse `aEnvoyer: true`, sans message (`console.warn` seulement).
    - `habillageAuDemarrage({ email, compte, centre, reseau, libre }, deps?): Promise<string>` : `habillageRetenu`, applique, réécrit l'appareil (estampillé de `email`), envoie si `aEnvoyer`.
    - `habillageCourant(): string` (lu sur `<html>`).
  - Décision H6 : l'habillage s'applique dans les deux navigations ; seul le choix est réservé à la nouvelle (Task 11).

- [ ] **Step 1:** `tests/habillage.test.mjs` : le script d'avant-peinture joué par `vm.runInNewContext` avec un faux `localStorage` (les entrées du test 8 de la Task 8, plus un `getItem` qui lève) et un faux document : attribut attendu, jamais d'exception, `theme-color` rempli ; `choisirHabillage("ecf")` avec un enregistrement qui réussit puis qui échoue (Review Focus 2) ; `choisirHabillage("violet")` → null, rien ne change ; `habillageAuDemarrage` : appareil d'une autre personne ignoré (Review Focus 1), envoi unique quand `aEnvoyer`.
- [ ] **Step 2:** Run. Expected : échec, modules absents.
- [ ] **Step 3:** Écrire les deux scripts, l'appel dans `main.js`, `setMonHabillage`, le banc ; retirer les sélecteurs de thème morts. `node _harness_build.mjs`.
- [ ] **Step 4:** Tests : `fail 0`. Captures du défaut comparées à `avant` : `0 différentes`. Captures ECF sans `--forcer` comparées à celles de la Task 7 : `0 différentes` (le vrai mécanisme donne le même rendu que l'attribut forcé). Vérificateur : 0 échec.
- [ ] **Step 5:** Commit `Lot 3 : habillage posé avant la première peinture, gardé sur l'appareil puis sur le compte`.

### Task 10: Vérification dans les deux habillages

**Files:**
- Modify: `outils/verifier_navigation.py` (classe `Scenario`, `construire_scenarios`, la fonction de page `mesurerContrastes` et ses appels, `main` et ses options, docstring ; le fichier du lot 2B fait environ 5 550 lignes, se repérer aux noms)

**Interfaces:**
- Consumes : `js/habillage-familles.js` (importé dans la page, comme le vérificateur lit déjà `js/nav-rules.js`).
- Produces : option `--habillages` (défaut `ecsr,ecf`) ; champ `habillage` du `Scenario` ; la passe « allumé » est jouée dans les deux habillages (levier de la Task 1), la passe « éteint » dans le défaut, plus deux scénarios : « éteint, appareil en ECF » (Review Focus 4) et « appareil d'une autre personne » (`ecsr_habillage = {"nom":"ecf","email":"autre@example.test"}` posé avant le chargement ; attendu `data-skin="ecsr"` une fois le démarrage fini, et la pastille « ECSR Promo » pressée ; Review Focus 1). Contrôles ajoutés à chaque vue :
  - `html[data-skin]` vaut l'habillage du scénario ;
  - contraste mesuré sur toute la page (`#view` en plus de la coquille et des menus), dans les deux habillages ; les `<text>` SVG sont mesurés sur leur `fill` (aujourd'hui seul `color` est lu) ;
  - repères non textuels (trait de l'entrée active, pastilles) : 3:1 contre le fond réel sous eux, calculé à leur position ;
  - le contrôle « notes en rouge » joue aussi en ECF ;
  - en ECF, rien ne garde une teinte de l'ancien habillage : toute couleur calculée (`color`, `background-color`, `border-color`, `fill`, `stroke`) de teinte chaude ou verte (de 20° à 160°, saturation au-dessus de 15 %) est un échec nommé « teinte restée », sauf si elle est égale à la valeur d'un jeton de `FAMILLES_FIXES` (noms lus dans la règle `:root` des feuilles de la page, valeurs par `getComputedStyle(document.documentElement)`) ou si l'élément est hors de l'app habillée : bandeau du banc, dessins des cours (SVG de panneaux, de véhicules et de marquage), livret EPCF (`.lv-*`), dossier professionnel (`.dp-doc`), canevas ;
  - poids des titres : dans les scénarios ECSR Promo, chaque texte visible en Canela est relevé avec son poids, puis `data-skin` passe à `ecf` dans la même page (changement en direct, Review Focus 3) : le même élément doit porter le poids ECF correspondant (700 → 600, 500 → 600, 400 → 500, 300 → 400) ; puis retour à `ecsr`.

- [ ] **Step 1:** Écrire les scénarios et les contrôles ; lancer. Expected : la liste des échecs réels (contrastes de page jamais mesurés jusqu'ici, verts restés).
- [ ] **Step 2:** Corriger chaque échec par un jeton (règle des Global Constraints : une couleur qui dit quelque chose rejoint une famille fixe, ajoutée à `js/habillage-familles.js` ; une couleur qui habille reçoit sa valeur ECF). Un contraste en défaut dans le thème par défaut se corrige aussi : c'est une exception au « pixel identique », à noter pour la Task 13.
- [ ] **Step 3:** Vérificateur complet, Chromium et WebKit. Expected : 0 échec. Tests : `fail 0`.
- [ ] **Step 4:** Commit `Lot 3 : vérification de la navigation dans les deux habillages, contraste de toute la page`.

### Task 11: Le choix dans l'app, Nouveauté et guide de l'assistant

**Files:**
- Create: `js/habillage-choix.js`
- Modify: `js/menu-compte.js` (bloc juste après `tete`), `js/views/config.js` (dans `renderPreferences`, une section « Apparence » à part, **toujours rendue**, comme `renderInfoSection`, et non dans `renderMyPreferencesSection`, qui rend `null` pour qui n'a pas de fiche de stagiaire ou quand le module Notes est fermé ; reprendre le sous-titre de la page, qui dit alors « Les informations sur l'application » ; dans les Paramètres de l'ancienne barre, voir H6), `css/navigation.css` (pastilles), `css/style.css` (`--apercu-*`), `js/nouveautes-data.js`, `supabase/functions/chatbot/aide.mjs` (une phrase : le menu du compte porte Apparence), `outils/verifier_navigation.py`

**Interfaces:**
- Consumes : `choisirHabillage`, `habillageCourant`, événement `ecsr:habillage` (Task 9) ; `toast` (`js/utils.js` l. 153).
- Produces : `blocHabillage(): HTMLElement`, un groupe (`role="group"`, nommé par son titre « Apparence ») de deux `button[type="button"].habillage-pastille[data-habillage][aria-pressed]`, libellés « ECSR Promo » et « Couleurs ECF », chacun avec une pastille de couleur (dégradé conique en `--apercu-ecsr-*` et `--apercu-ecf-*`, valeurs de la maquette l. 557-558, famille fixe). Un toucher : `choisirHabillage`, puis `aria-pressed` mis à jour sur toutes les pastilles du document (menu et page) par l'événement, et `toast("Couleurs ECF appliquées")` ou `toast("Habillage ECSR Promo appliqué")`. Le menu reste ouvert, le focus reste sur la pastille. Deux colonnes, 52 px de haut (44 px au moins sur téléphone), pastille pressée bordée de `--accent` avec un anneau `--accent-soft`.
- Nouveauté (date de la fusion, id `2026-11-XX-couleurs-ecf`) : `pour: "tous"`, `navigation: "nouvelle"`, titre « L'app aux couleurs d'ECF », `ou` vers `#/preferences` ; guide : ouvrir le menu du compte (le rond à tes initiales), Apparence, « Couleurs ECF » ; « ECSR Promo » pour revenir. Sans vocabulaire technique.
- Vérificateur : dans le menu du compte et dans Mes préférences, pour chaque rôle (formateur sans fiche compris), le groupe Apparence existe, une seule pastille pressée, celle de `html[data-skin]` ; un clic sur « Couleurs ECF » pose `data-skin="ecf"` sans recharger, laisse le menu ouvert et le focus sur la pastille ; après rechargement, ECF tient ; retour à « ECSR Promo ». Avec `?habillage_panne=1` : même résultat, aucune erreur visible. Scénario « éteint, appareil en ECF » : la section Apparence est dans Paramètres et ramène à ECSR Promo.

- [ ] **Step 1:** Ajouter les contrôles au vérificateur. Expected : échec, groupe absent.
- [ ] **Step 2:** Écrire `blocHabillage`, le brancher dans le menu du compte et dans Mes préférences (et dans Paramètres de l'ancienne barre selon H6), styles, Nouveauté, phrase du guide (et `tests/chatbot-aide.test.mjs` s'il compare ce passage).
- [ ] **Step 3:** Tests : `fail 0`. Vérificateur complet, deux moteurs, deux habillages : 0 échec.
- [ ] **Step 4:** `grep` du tiret cadratin et de « Prof » affiché dans les fichiers modifiés : aucun.
- [ ] **Step 5:** Commit `Lot 3 : choisir l'habillage dans le menu du compte et dans Mes préférences, Nouveauté`. Le redéploiement de la fonction `chatbot` attend l'accord de Timy (avant la fusion).

### Task 12: Mémoire sur le compte (migration)

**Files:**
- Create: `supabase/migrations/2026MMJJ_habillage.sql`, `supabase/migrations/2026MMJJ_habillage_retour.sql`, `tests/sql/habillage-preuve.sql`

**Interfaces:**
- Produces, migration : `alter table public.user_profiles add column if not exists habillage text check (habillage is null or habillage in ('ecsr', 'ecf'))` ; `public.set_my_habillage(val text) returns text`, `security definer`, `set search_path to 'public', 'pg_temp'`, sur le modèle de `set_my_anonymous_notes` (`C:/Users/watch/Dev/ECSR/migration_supabase/2026-08-21_anonymat_notes_verrou.sql`) : courriel lu dans `auth.jwt()`, « Not authenticated » sans lui, « Profil introuvable » sans ligne, met à jour la seule ligne de l'appelant, rend la valeur ; `grant execute … to authenticated`, `revoke … from public, anon`. Retour : suppression de la fonction puis de la colonne. Avec le lot 4, chacun lit sa propre ligne (`user_profiles_lecture`) et `update` est retiré à `authenticated` : le `security definer` est indispensable, aucune politique d'écriture n'est à ajouter. Si le lot 4 est fusionné avant, rejouer la preuve sur ses règles.
- Preuve, au format de `tests/sql/emargement-preuve.sql` (transaction annulée à la fin par une exception « VERT n/0 » ou « ROUGE »), la migration jouée par `EXECUTE` en tête du bloc (méthode de la mémoire « Répétition de migration dans la preuve SQL ») : A choisit `ecf` (sa ligne seule change, B intacte) ; `null` remet à zéro ; `'violet'` refusé ; anon refusé ; sans courriel refusé ; un stagiaire relit sa colonne par la lecture de son profil.

- [ ] **Step 1:** Écrire les trois fichiers.
- [ ] **Step 2:** Essai à blanc sur la base de production (`execute_sql`, la preuve qui annule tout). Expected : `VERT n/0`. Contre-épreuve sans la migration : `ROUGE` (attendu et trivial : la fonction n'existe pas encore ; elle prouve seulement que la preuve dépend de la migration).
- [ ] **Step 3:** Commit `Lot 3 : colonne habillage et fonction set_my_habillage (non appliquées)`.
- [ ] **Step 4:** Demander à Timy l'accord d'appliquer. Avec son accord seulement : `apply_migration`, puis la preuve contre la base. Expected : `VERT n/0`.

### Task 13: Preuve complète, beauté, relecture finale

**Files:**
- Modify : ce que les relectures demandent ; banc recopié dans `TP_ECSR_App` après `diff` (au moment de la fusion)

- [ ] **Step 1:** `node --test "tests/*.test.mjs"` : `fail 0`. Vérificateur complet (passes allumée et éteinte, deux habillages, Chromium et WebKit) : 0 échec.
- [ ] **Step 2:** Captures complètes (stagiaire, formateur, fondateur ; 1280 et 375 px ; Chromium et WebKit ; deux habillages). Le défaut comparé à `avant` : seules diffèrent les vues listées et justifiées (groupe Apparence du menu et de Mes préférences, page Nouveautés, petites valeurs des graphes de notes de la Task 4, contrastes corrigés à la Task 10).
- [ ] **Step 3:** Si le robot des parcours (`docs/qualite/`) est dans main : le jouer dans les deux habillages (levier `ecsr_habillage`). Sinon, le dire dans le compte rendu.
- [ ] **Step 4:** Relecture de beauté : deux agents frais sur le modèle le plus capable, qui ne voient que la planche. Grille notée sur 5 : harmonie des couleurs, hiérarchie, finition, lisibilité, fidélité à ECF (bleu, bleu nuit, rouge en repère seulement), à égalité de soin avec ECSR Promo. Toute note sous 4 ou tout défaut nommé se corrige par un jeton, puis nouvelle planche.
- [ ] **Step 5:** Test du premier clic : deux agents frais (stagiaire sur iPhone, formatrice sur ordinateur) ne voyant que les captures, tâche « Mets l'app aux couleurs d'ECF », puis « Reviens aux couleurs d'origine ». Attendu : réussite, assurance de 4 sur 5 au moins.
- [ ] **Step 6:** Relecture de toute la branche sur le modèle le plus capable, une vague de corrections.
- [ ] **Step 7:** Montrer la planche à Timy (c'est l'image d'ECF qui part en ligne) ; demander l'accord pour la fonction `chatbot` et, si pas encore donné, pour la migration ; puis l'étape de clôture du chantier.

---

## Annexe : décisions prises pendant l'écriture du plan (08/11/2026)

Chaque décision dit ce qui change si elle est fausse.

- **H1** Un attribut `data-skin` sur `<html>`, valeurs `ecsr` et `ecf` (spec § 4.4). Sur `<html>` et non `<body>` pour qu'il existe avant le corps de la page (si faux : un sélecteur).
- **H2** Blanc, noir et leurs transparences restent admis hors jetons : l'app n'a pas de mode sombre (anti-objectif de la spec), ils valent la même chose dans les deux habillages. Une soixantaine de jetons sans effet évitée (si faux : la règle 1 de la Task 2 se durcit, une tâche de remplacement de plus).
- **H3** Le thème par défaut est identique au pixel : chaque couleur chassée devient un jeton de même valeur, prouvé par comparaison de captures après chaque tâche. Les approximations (fusionner deux verts voisins) sont exclues ; le ménage des teintes héritées d'anciens thèmes (verts et ambres de Tailwind) est un autre chantier (si faux : des écarts à justifier un par un). Seules exceptions : des textes aujourd'hui sous le seuil AA (petites valeurs des graphes de notes, et ce que la Task 10 trouvera), corrigés dans les deux thèmes.
- **H4** Familles fixes, jamais redéfinies par ECF, garanties par le test : notes, activités du planning, statuts, documents, aperçus des pastilles. Une même couleur veut dire la même chose dans les deux habillages, et « jamais une note en rouge » tient par construction (si faux : leurs préfixes passent dans `PREFIXES_HABILLAGE`).
- **H5** Documents imprimés (feuille d'émargement, dossier Qualiopi) figés dans l'aspect actuel quel que soit l'habillage ; le livret EPCF et le dossier professionnel sont des modèles officiels de toute façon. **Question 1 à Timy.**
- **H6** L'habillage s'applique dans les deux navigations (pas de flash au démarrage, personne de piégé), le choix ne se fait que dans la nouvelle (menu du compte, Mes préférences). Dans les Paramètres de l'ancienne barre, la section Apparence n'apparaît que pour qui est en ECF, pour pouvoir revenir. **Question 2 à Timy** : s'il veut l'habillage pour tous dès la mise en ligne, la section s'affiche pour tous et la Nouveauté perd `navigation: "nouvelle"`.
- **H7** Mémoire : l'appareil d'abord (script bloquant avant la première peinture, seule façon d'éviter un éclair vert), le compte ensuite ; un choix non envoyé repart à l'ouverture suivante ; sur un appareil partagé, le choix d'une autre personne est ignoré. À la déconnexion, l'appareil garde l'habillage pour l'écran de connexion (si faux : une ligne dans `seDeconnecter`). Limites acceptées : tant que la migration n'est pas appliquée, un appareil partagé ne garde que le choix de la dernière personne ; et un choix resté « à envoyer » sur un appareil hors ligne l'emporte, à son retour, sur un choix fait entre-temps ailleurs (le plus récent ne gagne pas toujours, pour une préférence de couleur).
- **H8** L'app peut partir en ligne avant la migration : sans la fonction en base, le choix reste sur l'appareil, sans message (si faux : la Task 12 passe avant la Task 9).
- **H9** Palette ECF : celle de la maquette validée le 27/10 (fonds bleutés), et non le gris `#F8F8F8` du site d'ECF, trop neutre à côté du bleu nuit. Le rouge contre le bleu nuit tient 3,01:1, juste au-dessus du seuil des repères (si faux : une ligne de `css/habillage-ecf.css`).
- **H10** Le liseré bleu, blanc, rouge de la maquette sous l'en-tête sombre de l'équipe sur téléphone, par le jeton `--lisere-habillage` (aucun en ECSR Promo) : une signature d'ECF sans logo (si faux : le jeton reste à `none`).
- **H11** La couleur de la barre d'état du téléphone vient du jeton `--barre-etat`, lue par le script : aucune couleur dans le JavaScript (si faux : une table dans `js/habillage-regles.js`). Elle suit l'habillage sur Android et dans Safari ; l'app installée sur iPhone garde sa barre noire (`apple-mobile-web-app-status-bar-style`), et le manifeste comme les icônes restent espresso : un seul jeu d'icônes pour tous.
- **H15** Interlettrage des titres inchangé (la maquette serrait Outfit à -0,02 em) : écart minime, sans jeton de plus (si faux : un jeton `--interlettre-titre`).
- **H12** `habillageRetenu` prend déjà le centre, le réseau et `libre` dans l'ordre de la spec ; le lot 5 fournira leurs valeurs, leur place en base et les écrans de réglage (partage convenu le 08/11 avec la conversation du plan du lot 5). Aucun réglage de centre dans ce lot.
- **H13** Un seul système de thème : `js/theme-switcher.js`, `js/accent-switcher.js`, `data-accent` et `[data-theme="charcoal"]`, morts depuis l'abandon des thèmes multiples, sont retirés.
- **H14** Libellés de la maquette : « ECSR Promo » et « Couleurs ECF » ; messages « Couleurs ECF appliquées » et « Habillage ECSR Promo appliqué ».
