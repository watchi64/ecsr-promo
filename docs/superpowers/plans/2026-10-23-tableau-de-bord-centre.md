# Tableau de bord du centre : plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:executing-plans (exécution native choisie :
> Timy a dit « pars sur tes choix »). Étapes en cases à cocher.

**But :** une page `#/centre` réservée au personnel, qui chiffre par promo l'effectif, les
abandons, l'assiduité, les passages et les résultats, avec méthode, comparaison des promos, export
PDF A4 et CSV de la matrice des notes.

**Architecture :** calculs dans deux modules purs testés en node (`js/centre-stats.js`,
`js/centre-csv.js`) ; lecture des données par promo dans `js/db.js`, via un en-tête interne
`x-promo-lecture` que `fetchWithTimeout` traduit (règle pure `promoDeLaRequete` de
`js/promo-rules.js`) ; vue `js/views/centre.js`. Aucune migration.

**Technique :** JavaScript sans framework (modules ES), Supabase (PostgREST), tests `node:assert`.

**Spec :** `docs/superpowers/specs/2026-10-23-tableau-de-bord-centre-design.md`

## Contraintes globales

- Aucune écriture en base de production ; vérification sur le banc (`_harness.html`).
- Jamais de tiret cadratin (U+2014), ni dans le code, ni dans les libellés.
- Porte de la page : `isAdmin() || isProf()` ; un stagiaire est renvoyé sur `#/mon-suivi`.
- Chaque indicateur porte `nature` : `"mesuré"`, `"estimé"` ou `"non mesuré"`, et une `methode` (phrase).
- Constante `COUT_ABANDON_ESTIME = [3500, 5000]` (euros, hypothèse affichée).
- Seuils : 20 réponses QCM minimum par thème, 3 notes minimum par thème, 5 thèmes par liste,
  14 jours d'inactivité QCM, 2 absences, moyenne sous 10 avec au moins 3 notes, retard de 2 tours,
  2 signaux pour « À suivre de près ».
- Largeur 375 px sans défilement horizontal de la page (les tableaux larges défilent dans leur cadre).

## Points de vigilance (Review Focus)

1. Promo sans aucune donnée (Montpellier : 0 passage, 0 QCM) : chaque carte dit « aucune donnée », jamais `NaN` ni `0 %` trompeur. Test : `indicateursPromo` sur des tableaux vides (Tâche 2).
2. Lecture d'une promo non accessible ou en écriture avec `x-promo-lecture` : refus, jamais repli sur la promo courante. Test : `promoDeLaRequete` (Tâche 1).
3. Évaluation sans barème (`note_max` nul) ou non notée : ignorée partout, comme dans `notes-stats.js`. Test : CSV et stats (Tâches 2 et 3).
4. Nom commençant par `=`, `+`, `-`, `@` ou contenant `;`, `"` ou un retour à la ligne : cellule CSV neutralisée et citée. Test (Tâche 3).
5. Promo dont toute l'activité QCM date de plus de 14 jours (démo vue la semaine du 26/10) : personne n'est signalé « inactif ». Test (Tâche 2).

---

### Tâche 1 : lire une promo choisie

**Fichiers :** modifier `js/promo-rules.js`, `js/db.js` ; tests `tests/promo-rules.test.mjs`.

**Interfaces produites :**
- `ENTETE_LECTURE_PROMO = "x-promo-lecture"` (promo-rules).
- `promoDeLaRequete({ methode, demandee, courante, accessibles }) → { promo: number|null, erreur: string|null }`
  (`demandee` : chaîne de l'en-tête ou null ; `accessibles` : tableau d'ids).
- `lireDonneesCentre(promoId) → Promise<{ stagiaires, passages, evaluations, tentatives, epcf }>` (db).
- `lireReferentielCentre() → Promise<{ qcm: [{id, theme_id, titre, exam_pass_20}], themes: [{id, numero, titre, type}] }>` (db).

- [ ] Tests : sans en-tête → `{ promo: courante, erreur: null }` ; GET vers une promo accessible → cette promo ; `"get"` en minuscules accepté ; POST, PATCH, DELETE avec en-tête → erreur ; promo hors liste ou `"abc"` → erreur ; `courante` nulle sans en-tête → `{ promo: null }`.
- [ ] Lancer `node tests/promo-rules.test.mjs` : échec attendu (fonction absente).
- [ ] Écrire `promoDeLaRequete` et la constante.
- [ ] `fetchWithTimeout` : lit puis **supprime toujours** `x-promo-lecture` des en-têtes ; si `erreur`, rejette `new Error(erreur)` avant tout réseau ; sinon pose `x-promo-id` = `promo` (si non nulle). Méthode : `init.method || "GET"`.
- [ ] `lireDonneesCentre` : cinq lectures en parallèle, colonnes de la spec, `.setHeader(ENTETE_LECTURE_PROMO, String(promoId))`, pagination par `.range(debut, debut + 999)` jusqu'à une page incomplète (aide locale `toutesLesLignes(fabrique)`).
- [ ] Tests verts (`node tests/promo-rules.test.mjs`), commit.

### Tâche 2 : calculs du tableau de bord

**Fichiers :** créer `js/centre-stats.js`, `tests/centre-stats.test.mjs`.

**Interfaces :**
- Consomme : `estNotee`, `score20`, `mediane`, `statsLocales` de `js/notes-stats.js` ; `NOTE_VALUES` de `js/epcf-trames.js` (A 2, R 1, NA 0) ; `EPCF_TRAMES` (critères par grille).
- Produit : `indicateursPromo(donnees, referentiel, { aujourdhui }) → Indicateurs` où chaque indicateur vaut
  `{ valeur, detail, nature, methode, n }` (`valeur` null quand il n'y a rien à compter), regroupés en
  `effectif, abandon, valeurAbandons, absences, passages, activiteQcm, reussiteQcm, examensQcm, notes, epcf, titre` ;
  plus `themes: { qcm: [{num, titre, taux, n}], notes: [{num, titre, moyenne, n}], complet: [...] }`
  et `aSuivre: [{ stagiaire, signaux: [string] }]`.
- `ligneComparaison(ind) → { [cle]: texte }` pour le tableau de comparaison (clés : `effectif`, `abandon`, `absences`, `passages`, `reussiteQcm`, `examensQcm`, `notes`, `epcf`).

- [ ] Écrire le test sur un jeu à la main (5 inscrits dont 1 abandon ; passages Effectué, Bonus, Absence ; 3 thèmes de QCM ; 2 examens dont un sous le seuil ; 2 EPCF dont une auto-évaluation ignorée ; notes avec une sans barème) et les attendus calculés à la main dans un commentaire du test : taux d'abandon 1/5, absences 2/(n faits + 2), réussite QCM Σscore/Σtotal, thèmes filtrés par les minimums, signaux.
- [ ] Cas vides : aucune donnée → valeurs nulles, `aSuivre` vide, aucune exception.
- [ ] Cas « promo endormie » : toute l'activité QCM a plus de 14 jours → pas de signal d'inactivité.
- [ ] Les résultats ignorent les fiches en abandon (une tentative QCM d'une fiche inactive ne compte pas).
- [ ] Échec attendu, puis écrire le module, puis `node tests/centre-stats.test.mjs` vert, commit.

### Tâche 3 : CSV de la matrice des notes

**Fichiers :** créer `js/centre-csv.js`, `tests/centre-csv.test.mjs`.

**Interfaces :**
- `matriceNotesCsv({ stagiaires, evaluations, anonymiser }) → string` (stagiaires en formation, triés par `compareByNom` de `js/utils.js`, importable en node ; colonne « Stagiaire » = nom de famille puis prénom).
- `nomFichierCsv(nomPromo, dateIso) → string` (`matrice-notes_nimes-mars-2026_2026-10-23.csv` : minuscules, sans accents, tirets).

- [ ] Test : en-tête `Stagiaire;Moyenne;C1;C2;REMC;GDE;Thème 01;…;Thèmes 46-47;Thème 48;…;Thème 57` ; BOM en tête ; fins de ligne CRLF ; dernière note par cellule (date la plus récente) ; note 15/20 → `15` ; 8/10 → `16` ; 13,25 → `13,3` ; note sans barème ignorée ; `anonymiser: true` → `Stagiaire 1`, `Stagiaire 2` dans l'ordre ; nom `=CMD` → `'=CMD` ; nom avec `;` cité entre guillemets.
- [ ] Échec attendu, écrire le module, test vert, commit.

### Tâche 4 : la page, la tuile, l'impression

**Fichiers :** créer `js/views/centre.js` ; modifier `js/main.js` (route `centre`, `ONGLET_POUR_ROUTE.centre = "home"`, porte personnel, `teardownCentrePrint()` dans `navigate`), `js/views/home.js` (tuile `progress`, « Tableau de bord », « Assiduité, abandons, résultats par promo », personnel seulement, après Stagiaires), `css/style.css` (bloc `.centre-*` en fin de fichier, `@media print` pour `body.centre-printable`).

**Interfaces :** consomme `lireDonneesCentre`, `lireReferentielCentre`, `getMesPromos`, `getPromoCourante`, `indicateursPromo`, `ligneComparaison`, `matriceNotesCsv`, `nomFichierCsv`. Produit `renderCentre(container)` et `teardownCentrePrint()`.

- [ ] En-tête : promo, période (début, fin), date du jour ; boutons « Exporter en PDF » et « Matrice des notes (CSV) ».
- [ ] Sections dans l'ordre : chiffres clés (effectif, abandons, absences, passages), résultats (QCM, examens QCM, notes, EPCF, titre « non mesuré »), thèmes à retravailler, à suivre de près, comparaison des promos, méthodes de calcul. Chaque carte : valeur, détail, étiquette de nature, méthode repliée (`details`).
- [ ] Comparaison : promo courante d'abord, autres promos chargées après le premier rendu ; une promo en échec affiche « non chargée ».
- [ ] PDF : `@page { size: A4 portrait; margin: 12mm }` injectée et `body.centre-printable` posée au clic, `details` ouverts, retirés à `afterprint` et à la sortie de page.
- [ ] CSV : fenêtre avec la case « Remplacer les noms par des numéros » et le rappel « fichier nominatif » ; téléchargement par `Blob` + lien `download`.
- [ ] `node --check` sur les fichiers modifiés, `node --test "tests/*.test.mjs"` vert, commit.

### Tâche 5 : banc d'essai et contrôle des chiffres

**Fichiers :** copies locales non versionnées `_harness_supabase.js`, `_harness_build.mjs` (depuis `TP_ECSR_App`) ; fixture `_banc_centre_demo.json` (non versionnée) ; entrée temporaire dans `C:\Users\watch\Dev\ECSR\.claude\launch.json`.

- [ ] Exporter en lecture seule les lignes de la promo 7 (données fictives) vers la fixture ; levier `?centre=1` du faux client : promo 7 ajoutée aux promos du banc et ses lignes chargées ; le faux client honore `setHeader("x-promo-lecture")` (promo hors liste : rien) et `.range()`.
- [ ] Calcul indépendant en SQL (lecture seule) des indicateurs de la promo 7 ; comparer un à un aux chiffres affichés par le banc ; consigner le tableau de contrôle dans les notes partagées de la session.
- [ ] Vérifier au banc : rôle formateur (page complète, comparaison, PDF par aperçu d'impression mesuré, CSV généré), rôle stagiaire (renvoyé), 375 px (aucun débordement de la page).
- [ ] Rapatrier dans `TP_ECSR_App` les leviers ajoutés au faux client (ajouts seulement, derrière `?centre=1`).

### Tâche 6 : Nouveautés et notes de projet

**Fichiers :** `js/nouveautes-data.js` (entrée `2026-10-23-tableau-de-bord-centre`, `pour: "formateurs"`, `ou` vers `#/centre`), `PROJECT_NOTES.md` (section courte : route, modules, lecture par promo, banc).

- [ ] `node tests/nouveautes.test.mjs` vert ; recherche du tiret cadratin sur le diff : zéro ; commit.
