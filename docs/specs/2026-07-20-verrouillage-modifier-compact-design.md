# Spec — Verrouillage des semaines validées, bouton « Modifier », vue compactée

**Date** : 2026-07-20 · **Branche** : `verrou-semaine` (worktree `TP_ECSR_App_verrou`)
**Fichiers principaux** : `js/views/planning.js`, `js/db.js` (lecture seule), `css/style.css`
**Base de données** : aucune migration — clé KV dans la table `settings` existante.

Design validé par l'utilisateur le 20/07/2026 (brainstorm en 3 volets ; le volet 1 avait été
validé lors de la session précédente).

---

## Contexte et objectif

Le planning (`js/views/planning.js`) est éditable en continu par les admins/formateurs, ce qui
expose à deux problèmes : des modifications accidentelles (clic ou drag involontaire), et des
semaines passées « figées dans les faits » (validées en passages) qui restent pourtant
modifiables et encombrées d'emplacements vides.

Trois volets, livrés ensemble :

1. **Verrouillage** : une semaine validée peut être verrouillée — lecture seule totale pour tous.
2. **Bouton « Modifier »** : même hors verrou, le planning s'ouvre en lecture seule pour tout le
   monde ; l'édition est un mode explicite, par semaine.
3. **Vue compactée** : une semaine verrouillée s'affiche débarrassée de tout le vide, pour tous.

---

## Volet 1 — Verrouillage des semaines validées

### Stockage

- Clé `semaines_verrouillees` dans la table `settings` (KV existante, via `getSetting` /
  `setSetting` de `db.js`). Valeur : tableau JSON de lundis ISO (`["2026-07-13", ...]`).
- Pas de migration. Pas de nouvelle RPC.
- Chargée avec les autres données de la semaine (au `load` de la vue et à chaque changement de
  semaine) ; état local `lockedWeeks` (Set).

### Modale « Valider la semaine »

- Nouvelle case à cocher : « 🔒 Verrouiller la semaine après enregistrement ».
  - **Cochée d'office** si le vendredi de la semaine affichée est écoulé (date du jour > vendredi).
  - **Décochée** sinon (validation en milieu de semaine : seuls les jours écoulés sont validés,
    la semaine reste modifiable).
- À l'enregistrement avec la case cochée : le lundi ISO est ajouté à `semaines_verrouillees`.
- **Ctrl+Z de la validation** : retire aussi le lundi de `semaines_verrouillees` (le verrou suit
  la validation qu'il accompagne). Après l'annulation, la semaine revient en **mode édition**
  (l'utilisateur était en train d'éditer).

### Semaine verrouillée — vue admin

- Lecture seule **totale**, identique au rendu stagiaire actuel : classe `read-only` sur le
  conteneur + aucun handler d'édition branché (chips, dés, ⊘, drag&drop, notes, sujets,
  horaires, toggles jour désactivé…).
- Barre d'outils : les 4 boutons (Élèves bénévoles / 🎲 Placer la semaine / 🧹 Vider les
  placements / Valider la semaine) sont **remplacés** par :
  - un badge « **✓ Semaine validée** » (non cliquable) ;
  - un bouton discret « **Déverrouiller** » (admin uniquement) — retire le lundi de
    `semaines_verrouillees` **et passe directement en mode édition** (un seul geste, voir volet 2).
- « Imprimer / PDF » reste disponible.

### Semaine verrouillée — vue stagiaire

- Rendu identique à aujourd'hui (déjà lecture seule) + badge « ✓ Semaine validée » (information,
  aucun bouton) + vue compactée (volet 3).

### Backstop d'écriture

- `saveEntry` **refuse** d'écrire si la semaine cible est verrouillée (retour silencieux +
  `console.warn`, pas de toast agressif — le cas ne doit pas se produire via l'UI).
- Même garde sur les écritures de masse : placement auto (`autoPlaceWeek`), vider les placements
  (`clearWeekPlacements`), sauvegarde des horaires (`saveHalfMeta`), jours off, upsert des
  demi-journées. En pratique : toutes passent par le prédicat central `canEditWeek()` (volet 2).

---

## Volet 2 — Bouton « Modifier » (lecture seule par défaut)

### Principe

Le planning s'ouvre **toujours en lecture seule**, y compris pour les admins. L'édition est un
mode explicite, activé par un bouton « ✏️ Modifier ».

### Cycle de vie du mode édition

- État `editMode`, **en mémoire seulement** (variable de module) — aucune persistance
  (ni localStorage, ni sessionStorage).
- Portée : **la semaine affichée**. Retombe à `false` :
  - à chaque changement de semaine (`changeWeek`, y compris flèches, date picker, « Cette semaine ») ;
  - à chaque montage de la vue Planning (navigation depuis un autre onglet).
- Sortie explicite : bouton « **✓ Terminer** » en mode édition.

### Barre d'outils selon l'état (vue admin)

| État de la semaine | Boutons affichés |
|---|---|
| Verrouillée | badge « ✓ Semaine validée » · Déverrouiller · Imprimer / PDF |
| Lecture seule (défaut) | ✏️ Modifier · Élèves bénévoles · Imprimer / PDF |
| Mode édition | ✓ Terminer · Élèves bénévoles · 🎲 Placer la semaine · 🧹 Vider les placements · Valider la semaine · Imprimer / PDF |

- « Élèves bénévoles » reste accessible en lecture seule : la banque (fiches, dispos,
  téléphones) est indépendante de la semaine — consulter un numéro ne doit pas obliger à passer
  en édition.
- Vue stagiaire : inchangée (jamais de bouton Modifier).

### Articulation avec le verrou

- Sur une semaine **verrouillée**, il n'y a **pas** de bouton « Modifier » : le seul chemin vers
  l'édition est « Déverrouiller » (admin), qui retire le verrou **et** active `editMode` dans le
  même geste. Le verrou est donc un cran au-dessus du mode lecture seule ordinaire.

### Implémentation

- Prédicat central :
  ```js
  function isLocked(lundi)  { return lockedWeeks.has(lundi); }
  function canEditWeek()    { return isAdmin() && editMode && !isLocked(semaineLundi); }
  ```
- Dans `planning.js`, les usages de `isAdmin()` qui conditionnent **l'édition** (rendu des
  contrôles éditables, handlers, gardes des fonctions d'écriture) basculent sur `canEditWeek()`.
  `isAdmin()` seul reste pour ce qui relève de la **visibilité des données** ou de fonctions
  hors semaine : chargement de la banque bénévoles complète (`loadBenevoles`), bouton
  « Élèves bénévoles », bouton « Déverrouiller », mémorisation `current_week_lundi`.
- La classe CSS `read-only` (déjà exhaustive : masque dés, ajouts, suppressions, drag,
  pointer-events des chips…) est posée quand `!canEditWeek()` au lieu de `!admin`.
- L'en-tête de vue (« Édition · / Consultation · ») suit `canEditWeek()`.

---

## Volet 3 — Vue compactée des semaines verrouillées

### Déclenchement

- **Automatique** sur toute semaine **verrouillée**, pour **tous** (admin en lecture seule ET
  vue stagiaire). Pas de réglage, pas de bouton.
- Déverrouiller → retour immédiat à la vue d'édition normale (pleine, avec emplacements vides).
- Les semaines non verrouillées (même en lecture seule via le volet 2) gardent l'affichage
  actuel : une semaine en construction doit montrer ses trous.

### Rendu (variante A validée sur mockup — cartes compactées)

Le look actuel (cartes jour, bandeaux MATIN/APRÈS-MIDI, chips) est conservé ; on retire le vide :

1. **Créneaux vides** : un créneau horaire dont aucune lane n'a de contenu est masqué.
   Réutiliser `entryHasContent(e)` (déjà écrit pour le rendu print).
2. **Lanes parallèles vides** : dans un créneau partiellement rempli, les lanes sans contenu
   sont masquées et la grille se recalcule sur les lanes restantes (la carte pleine reprend la
   largeur).
3. **Demi-journées vides** : aucune lane avec contenu dans la demi-journée → seul le bandeau
   MATIN/APRÈS-MIDI (horaires compris) est affiché, pas de zone de créneaux.
4. **Champs vides des cartes** : lignes sans valeur (sujet absent, « Au tableau » non renseigné,
   notes vides, sélecteurs à vide, bénévoles absents) masquées — mêmes règles que
   `printEntryCell`.
5. **Espacements resserrés** : paddings/gaps réduits sur cartes et créneaux.

### Implémentation

- Classe `p-compact` posée sur le conteneur de la vue quand `isLocked(semaineLundi)`.
- Le rendu (JS) marque les éléments vides d'une classe (`is-empty`) au moment du rendu — la CSS
  `.p-compact .is-empty { display: none }` + règles d'espacement font le reste. Le recalcul de
  `maxLanes` ignore les lanes vides quand la semaine est verrouillée.
- Jours FÉRIÉ / FERMÉ : bandeau actuel conservé tel quel.
- Jour entièrement vide (rare) : la carte jour se réduit à son entête + les deux bandeaux de
  demi-journées.
- Le rendu print (« Imprimer / PDF ») est inchangé (il a déjà sa propre logique compacte).

---

## Volet 4 — Ergonomie du mode édition (ajout validé le 20/07, après implémentation des volets 1-3)

1. **Pill flottante** : en mode édition uniquement, pastille `position: fixed` centrée en bas
   d'écran — « ✏️ Édition en cours » + bouton « ✓ Terminer ». Masquée à l'impression,
   z-index sous les modales. Absente en lecture seule et sur semaine verrouillée.
2. **Liseré du mode** : classe `p-editing` sur le conteneur quand `canEditWeek()` ; contour
   pointillé accent discret autour de `.p-days`. Lecture seule : aucun changement visuel.
3. **Hint au clic en lecture seule** (admin uniquement) : clic sur la zone des jours → toast
   throttlé (max 1 / 5 s) — semaine normale : « Semaine en lecture seule — clique ✏️ Modifier
   pour éditer » ; semaine verrouillée : « Semaine validée — clique Déverrouiller pour
   corriger ». Rien côté stagiaire.
4. **Échap** : en mode édition, Échap revient en lecture seule — sauf modale ouverte
   (`.modal-backdrop` présent) ou focus dans un champ de saisie. Listener module unique,
   inactif si la vue Planning n'est pas montée (`currentContainer.isConnected`).

Précision utilisateur (20/07) : une note vide (« + note ») ne doit pas apparaître sur une
semaine validée — déjà couvert par le masquage des champs vides du volet 3 (`.p-lane-notes`
vide → `is-empty`), y compris sur les cartes salle 2 groupes ; reste disponible en mode
édition.

## Volet 5 — Épuration complète hors mode édition (ajout validé le 20/07, après déploiement)

Retour utilisateur après mise en prod : « lorsqu'on n'est pas en mode Modifier, tous les espaces
non remplis et les boutons doivent disparaître pour épurer un maximum ».

1. **Le compactage n'est plus lié au verrou mais au mode édition** : le prédicat passe de
   `isLocked(semaineLundi)` à `!canEditWeek()`. Cela couvre les trois cas d'un coup : admin en
   lecture seule sur semaine normale (nouveau), admin sur semaine verrouillée (inchangé),
   stagiaires sur toutes les semaines (nouveau, validé explicitement par l'utilisateur).
   Remplace donc la décision du volet 3 « compact uniquement sur semaine verrouillée ».
2. **Correctifs de contrôles qui fuyaient en lecture seule.** Deux contrôles n'avaient jamais
   rejoint le groupe CSS `.read-only`, donc restaient visibles et cliquables, y compris côté
   stagiaire. L'écriture était bloquée dans les deux cas (backstop `canEditWeek()` + RLS
   `is_admin()`) : aucune donnée corrompue, mais l'interface laissait croire à une action
   possible.
   - `.p-abs-btn` : le ⊘ de marquage d'absence (ajouté par la refonte absences du 20/07).
   - `.p-prof-display` / `.p-prof-x` / `.p-prof-dropdown` : le sélecteur de formateur. Il
     échappait aussi aux règles génériques `select`/`input` du groupe, car c'est une `div`
     `tabindex="0"` maison qui ouvre son propre menu au clic.
   **Audit systématique fait au banc** plutôt qu'au cas par cas : énumération de tous les
   `button/select/input/textarea/[tabindex]/[role=button]` visibles et non neutralisés dans
   `.p-days` en lecture seule. Après correctifs, l'inventaire renvoie **zéro** contrôle
   interactif restant. Ce test est à rejouer à chaque ajout de contrôle sur les cartes.
3. **Conséquence assumée** : une semaine future encore vierge apparaît quasi vide en lecture
   seule (jours + bandeaux d'horaires seulement). Le toast du volet 4 (« clique ✏️ Modifier
   pour éditer ») lève le doute côté formateur ; « Modifier » restaure la vue complète.

## Volet 6 — Densification lecture seule + navigation par jour (validé le 20/07)

Motivation : plaintes d'ergonomie sur téléphone, « scroller de jour en jour ». Mesures au banc
sur une semaine réaliste (5 jours pleins, salle 2 groupes + voiture + lane parallèle), viewport
iPhone 375×812 : **édition 7885 px (9,7 écrans)**, **lecture seule après volet 5 : 3794 px
(4,7 écrans)**, soit ~752 px par jour. Objectif : **~2,5 écrans**.

1. **Cartes densifiées** (CSS pur, sous `.p-compact`, mode édition inchangé) :
   - Sujet : la puce perd son fond et son arrondi, devient un libellé texte accentué, numéro de
     thème conservé (« 12 · Le freinage »). L'input `+` (`.sujet-chip-input`) est masqué : c'est
     lui qui donnait l'impression d'un champ modifiable (retour utilisateur).
   - Rôles : label raccourci et discret, valeurs en texte courant ; les chips stagiaires perdent
     leur fond de pastille et sont séparées par des virgules.
   - Interlignes, hauteurs minimales et marges resserrés.
2. **Barre de jours colante** : `LUN 06 … VEN 10` en `position: sticky` sous l'en-tête de l'app.
   Appui = défilement jusqu'au jour (`scroll-margin-top` pour compenser en-tête + barre). Le jour
   visible est surligné via un `IntersectionObserver` (déconnecté à chaque re-render pour éviter
   les fuites). Jours fériés/fermés grisés mais cliquables. **Affichée dans les deux modes**
   (lecture seule et édition) : c'est de la navigation, pas de l'édition.
3. **Portée** : mobile ET ordinateur, même rendu (choix utilisateur : un seul rendu à maintenir).
4. **Vérification** : mesure de hauteur re-jouée après implémentation et rapportée telle quelle,
   y compris si l'objectif n'est pas atteint.

### Résultat mesuré (banc, iPhone 375×812, même semaine réaliste)

| Étape | Hauteur | Écrans |
|---|---|---|
| Avant volet 6 (lecture seule) | 3794 px | 4,7 |
| Densification CSS seule (1er jet) | 3401 px | 4,2 |
| + neutralisation des hauteurs tactiles | 3022 px | 3,7 |
| + étiquette de groupe sur la ligne du sujet, espacements | **2842 px** | **3,5** |

**Objectif 2,5 écrans NON atteint : on s'arrête à 3,5** (soit −25 % contre −47 % visés). Le reste
de la hauteur est structurel (en-têtes de jour, bandeaux de demi-journée, en-tête de carte,
deux blocs de rôles par groupe) et ne se réduit plus par CSS : il faudrait un rendu texte dédié
en lecture seule, réutilisant la logique du rendu print. Non fait, à décider séparément.
La navigation par jour, elle, répond directement à la plainte d'origine.

### Découvertes de plateforme (documentées pour ne pas les re-payer)

- **`overflow-x: hidden` sur `<body>` casse tout `position: sticky` descendant** : `body` devient
  un conteneur de défilement qui ne défile pas, donc l'élément collant part avec la page. La barre
  sortait de l'écran. Corrigé par `overflow-x: clip` (même effet visuel, pas de conteneur créé),
  précédé de `hidden` comme repli pour les navigateurs anciens.
- **Le banc s'exécute en page « cachée »** (`document.visibilityState === "hidden"`) : le navigateur
  y gèle `requestAnimationFrame`, n'émet aucun événement `scroll` et ne délivre aucun callback
  d'`IntersectionObserver`. Conséquence : toute logique dépendant de ces mécanismes est
  invérifiable au banc. Le surlignage a donc été écrit avec un throttle temporel et testé en
  émettant l'événement `scroll` à la main.
- **Le défilement fluide est inopérant dans ce contexte** (ni `scrollIntoView`, ni `scrollTo`, ni
  `scroll-behavior`), le saut direct fonctionne : `scrollToDay` tente le fluide puis bascule sur
  le saut direct si rien n'a bougé après 250 ms.

## Hors périmètre

- Aucune modification du schéma de base, des RLS, ni des autres vues (`passages.js`, `notes.js`…).
- Pas de verrouillage automatique des vieilles semaines (le verrou se pose uniquement via la
  modale de validation).
- Pas de vue « grille synthétique » à l'écran (variante B écartée ; « A + option B » notée comme
  extension possible ultérieure si besoin).

## Cas limites

| Cas | Comportement |
|---|---|
| Ctrl+Z d'une validation avec verrou | Verrou retiré + retour en mode édition |
| Déverrouiller puis re-valider | La modale re-propose la case (état recalculé sur le vendredi) |
| Deux onglets admin ouverts | Le backstop `canEditWeek()` relit `lockedWeeks` chargé au dernier changement de semaine ; pas de temps réel (assumé, mono-utilisateur admin en pratique) |
| Semaine future | Pas de bouton « Valider la semaine » (règle existante conservée) ; « Modifier » disponible |
| Stagiaire sur semaine verrouillée | Vue compacte + badge, comportement lecture seule inchangé |

## Tests (banc fetch-stub)

Banc habituel dans le worktree : `_harness.html` + `_harness_stub.js` + `_harness_server.py`
(`Cache-Control: no-store`, port 8123, entrée launch.json à recréer), pilotage exclusivement en
`javascript_tool` + `dispatchEvent`. Scénarios :

1. Admin, semaine non verrouillée : la vue s'ouvre en lecture seule, barre = Modifier / Élèves
   bénévoles / Imprimer ; « Modifier » fait apparaître les 4 boutons + Terminer ; « Terminer »
   revient en lecture seule.
2. Changement de semaine en mode édition → la nouvelle semaine s'ouvre en lecture seule.
3. Valider la semaine avec case verrou cochée → badge + Déverrouiller, `read-only` + `p-compact`
   posés, `semaines_verrouillees` mise à jour (stub).
4. Ctrl+Z → verrou retiré, mode édition actif.
5. Backstop : appel direct de `saveEntry` (console) sur semaine verrouillée → refus.
6. Vue compacte : créneau vide masqué, lane vide masquée (carte pleine en pleine largeur),
   demi-journée vide réduite au bandeau, champs vides masqués, jour FERMÉ intact.
7. Vue stagiaire (stub `is_prof=false`) : semaine verrouillée compacte + badge, pas de boutons.
8. Case de la modale : cochée d'office si vendredi écoulé, décochée sinon.
