# Spec — Espace « Mon suivi » + Tableau de bord épuré

**Date** : 2026-07-11
**Statut** : validé (brainstorming), prêt pour plan d'implémentation
**Auteur** : brainstorming watchi64 × Claude

## Contexte & objectif

Aujourd'hui le Tableau de bord mélange deux logiques : les **priorités de passage**
(qui doit passer en Salle / Voiture par rapport à la moyenne de la classe) et les
**notes** (pastille moyenne `/20` sur chaque carte). On veut :

1. **Recentrer le Tableau de bord** sur la centralisation des passages (priorités +
   historique), en **retirant toute trace de notes**.
2. Créer un nouvel espace personnel **« Mon suivi »** qui regroupe, pour un stagiaire :
   - ses **passages à venir** (déduits du planning), avec grisage au fil de la semaine ;
   - un **graphique d'évolution** personnel de sa moyenne et de ses notes.

Les deux chantiers sont **indépendants** et exécutables séparément (2 lots / 2 sessions).

## Décisions actées (brainstorming)

| Question | Décision |
|----------|----------|
| Horaire des passages à venir | **Demi-journée + plage horaire** du créneau (aucun changement de modèle) |
| Portée de « Mon suivi » | **Perso** pour le stagiaire ; **sélecteur d'élève** pour prof/admin |
| Tris « par note » du dashboard | **Retirés** (cohérence : plus aucune note sur le dashboard) |
| Contenu du graphique | **Moyenne (courbe) + notes individuelles (points)** |
| Librairie de graphique | **SVG maison**, pas de dépendance externe (cohérence + contrainte CSP) |

## Modèle de données (existant, aucune migration)

- `passages` : `stagiaire_id`, `type` ("Salle"|"Voiture"), `resultat`, `date`, `remplacant_id`, `origine`, `created_by_who`. Grain **jour**.
- `evaluations` : `stagiaire_id`, `note`, `note_max`, `date_eval` (+ libellé/thème). Moyenne = `moyenne( note/note_max * 20 )`.
- `planning_entries` : `semaine_lundi`, `day_index`, `half_day` ("matin"|"après-midi"), `slot`, `lane`, `activite`, `pedagogue_id`, `pedagogue_id_2`, `salle_double`, `eleves_ids[]`, `eleves_ids_2[]`, `sujet`, `notes`.
- `planning_half_meta` : `semaine_lundi`, `day_index`, `half_day`, `start_time`, `end_time`, `pause_start`, `pause_minutes`.
- `settings.current_week_lundi` : lundi de la semaine active.
- `profile.stagiaire_id` : lie le compte connecté à une fiche stagiaire (`null` pour un prof/admin sans fiche).

### Mapping planning → passage (règle métier existante, à réutiliser telle quelle)

- `activite === "Pédagogie salle"` → le **pédagogue au tableau** (`pedagogue_id`, et
  `pedagogue_id_2` si `salle_double`) fait **1 passage Salle**. Les `eleves_ids`
  (assis en salle) **ne comptent pas** comme passage.
- `activite === "Voiture (conduite)"` → **chaque** élève de `eleves_ids` fait **1 passage Voiture**.

C'est exactement la logique de « Valider la semaine » (`planning.js`, `openValiderSemaineModal`).
« Mes passages à venir » applique le **même filtre** mais sur les jours **à venir**.

---

## Chantier A — Tableau de bord épuré

**Fichier** : `js/views/dashboard.js` (+ nettoyage CSS mort `.avg-pill`).

Modifications :

1. Supprimer l'import et le chargement de `listEvaluations` (le `Promise.all`).
2. Supprimer `computeAverage()` et `avgColor()`.
3. Dans `renderCard`, retirer le bloc `avg-pill` → l'en-tête de carte ne contient plus que le nom.
4. Retirer de `SORT_OPTIONS` les entrées `note-desc` et `note-asc` ; nettoyer les
   `case` correspondants dans `sortEnriched`. Si le tri persistant sauvegardé
   (`localStorage ecsr_dash_sort`) vaut une valeur retirée, retomber sur `"priorite"`.
5. Retirer `avg`/`nbEvals` de l'objet `enriched`.
6. Ajuster le sous-titre s'il mentionne les notes (garder « Qui doit passer en priorité… »).
7. **Conserver** : priorités Salle/Voiture, `explainPanel`, sommaire (`dashboard-meta`),
   légende, et la section historique des passages (`renderPassages`) en bas.

**Critères d'acceptation A**
- Aucune note/pastille `/20` visible sur le Tableau de bord.
- Le sélecteur de tri ne propose plus d'option « Note ».
- Un `ecsr_dash_sort` valant `note-desc`/`note-asc` en localStorage ne casse pas la vue.
- Priorités et historique des passages inchangés et fonctionnels.

---

## Chantier B — Espace « Mon suivi »

**Nouveau fichier** : `js/views/mon-suivi.js`
**Câblage** : ajouter la route `mon-suivi` (`main.js` `routes` + `TABS`, inséré après
« Tableau de bord ») et l'import de `renderMonSuivi`.

### Identité / portée

- `getProfile().stagiaire_id != null` (stagiaire) → suivi de ce stagiaire, pas de sélecteur.
- `isAdmin()` ou `stagiaire_id == null` (prof/admin) → afficher un **sélecteur d'élève**
  (liste `listStagiaires`, triée `compareByNom`). Sélection par défaut : sa propre fiche
  si `stagiaire_id` existe, sinon le premier. La sélection re-render les 2 sections.
- L'onglet est **toujours visible** (le stagiaire y voit son suivi, l'admin celui d'un élève).

### Section 1 — Mes passages à venir

**Données** : semaine active `current_week_lundi` **+ semaine suivante** (`+7 j`).
Pour chaque semaine : `getPlanning(lundi)` + `getHalfMetaForWeek(lundi)`. La semaine
suivante est incluse seulement si elle renvoie des entrées (sinon on l'ignore silencieusement).

**Sélection des entrées « me concernant »** (id = stagiaire affiché) :
- Salle : `activite === "Pédagogie salle"` et (`pedagogue_id === id` **ou**
  (`salle_double` et `pedagogue_id_2 === id`)) → type **Salle** (« au tableau »).
- Voiture : `activite === "Voiture (conduite)"` et `eleves_ids` contient `id` → type **Voiture**.

**Rendu** : liste chronologique (par date puis matin avant après-midi puis `slot`).
Chaque item affiche :
- **Jour + date** (ex. « Mercredi 16 juillet »),
- **Demi-journée** (Matin / Après-midi),
- **Plage horaire** du créneau depuis half_meta (`start_time`–`end_time`) si présente,
  sinon rien (pas d'horaire inventé),
- **Badge type** Salle / Voiture (mêmes couleurs que l'onglet Passages),
- **Sujet** du créneau (`sujet`) si renseigné, en libellé secondaire.

**Grisage / états** (par rapport à `aujourd'hui`) :
- date `< aujourd'hui` → **grisé** (« passé / effectué »).
- date `== aujourd'hui` → mis en avant « Aujourd'hui ».
- première date `> aujourd'hui` → **prochain passage** mis en avant.
- Aucune entrée à venir → message d'état vide encourageant (« Aucun passage planifié
  pour l'instant. »).

> Note : « effectué » ici = *jour passé dans le planning prévisionnel*, pas la validation
> hebdo. C'est volontaire et suffisant pour l'usage (voir sa semaine d'un coup d'œil).

### Section 2 — Mon évolution (graphique SVG maison)

**Données** : `listEvaluations()` filtrées sur le stagiaire, `note != null && note_max`,
triées par `date_eval` croissant. Chaque note ramenée sur /20 : `note/note_max * 20`.

**Tracé** (SVG inline, responsive `viewBox`, thème light/dark via variables CSS) :
- **Points** : une pastille par évaluation (x = **rang chronologique**, points équidistants,
  libellés de date sous l'axe ; y = note /20),
  couleur selon le barème (`< 8` rouge, `< 12` orange, `< 16` vert, `≥ 16` excellent) —
  réutiliser la logique de seuils du dashboard (`avgColor`, à recopier localement).
- **Courbe** : moyenne **cumulée** dans le temps (à l'index i, moyenne des notes 0..i) —
  cohérent avec la moyenne globale affichée ailleurs.
- **Axes** : Y de 0 à 20 avec repères (0/5/10/15/20) ; X = les évaluations dans l'ordre.
- **Interaction** : tooltip au survol d'un point (thème/libellé + note brute + note /20 + date).
- **État vide** : si 0 évaluation notée → encart « Pas encore d'évaluation notée. »

**Contraintes** : pas de librairie externe (SVG construit avec `el`/DOM ou balises SVG) ;
palette via variables CSS existantes (`--c-stop`, `--c-go`, accents) pour rester theme-aware.

### Critères d'acceptation B

- Un stagiaire connecté ouvre « Mon suivi » et voit **ses** passages à venir + **son** graphique, sans sélecteur.
- Un admin voit un sélecteur d'élève ; changer d'élève met à jour les deux sections.
- Les passages à venir n'affichent que les créneaux **où l'élève est réellement acteur**
  (au tableau en Salle, ou élève en Voiture), pas les créneaux où il est simple assistant salle.
- Les jours passés sont grisés ; le prochain passage est mis en avant ; horaires affichés seulement s'ils existent.
- Le graphique trace points + courbe de moyenne, gère l'état vide, et reste lisible en thème clair et sombre.

---

## Hors périmètre (YAGNI)

- Pas d'horaire exact par passage (pas de nouveau champ dans `planning_entries`).
- Pas de notifications / rappels.
- Pas de modification du modèle de données ni de RLS.
- Pas de déplacement de l'onglet Notes existant (il reste pour la vue classe/matrice).

## Risques / points d'attention

- **Dépôt partagé** : `TP_ECSR_App` est partagé entre plusieurs chats (un checkout écrase
  le voisin). Chaque lot doit être implémenté dans un **worktree** dédié, branche propre.
- Cohérence des seuils de couleur : recopier la logique `avgColor` dans `mon-suivi.js`
  plutôt que d'importer depuis `dashboard.js` (qui la supprime au chantier A).
- `half_meta` peut être absent pour un demi-journée → afficher sans plage horaire, sans erreur.
- `getPlanning` de la semaine suivante peut être vide → dégrader silencieusement.
