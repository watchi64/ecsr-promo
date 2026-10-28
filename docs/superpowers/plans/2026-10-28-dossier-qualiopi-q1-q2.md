# Dossier Qualiopi, lots Q1 et Q2 : plan de mise en œuvre

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans, tâche par tâche. Les étapes se cochent (`- [ ]`).

**But :** une page « Qualiopi » (fondateur seul) qui range les preuves de l'app indicateur par indicateur, imprime
le dossier de la formation, le dossier du centre (avec ou sans noms) et la fiche « résultats », et exporte un CSV.

**Architecture :** trois modules purs testés en node (référentiel, inventaire, documents et fiche) que lit une vue
sans état propre ; une lecture en base qui reprend le motif de `lireDonneesCentre` (en-tête interne
`x-promo-lecture`) ; impression A4 portrait par le motif de `imprimer()` de `js/views/centre.js`. Aucune migration.

**Technique :** modules ES sans build, `el()` de `js/utils.js`, Supabase par `js/db.js`, tests `node:assert/strict`.

**Spec :** `docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md` (validée par Timy le 28/10/2026).

## Contraintes communes

- Aucun tiret cadratin (U+2014) nulle part : code, textes, commits.
- « Formateur », jamais « prof » dans ce qui s'affiche ; tutoiement comme le reste de l'app.
- Aucun défilement de côté, cibles de 44 px sur téléphone, contraste AA, jamais une note en rouge, DA de Timy.
- Page `#/qualiopi` au seul fondateur (`isFounder()`) ; aucune entrée dans la barre (ni l'ancienne ni la nouvelle).
- Lecture seule : aucune écriture en base, aucune migration ; lecture d'une autre promo par l'en-tête interne
  `x-promo-lecture` uniquement (jamais de repli sur la promo courante).
- Toute lecture de table passe par `toutesLesLignes` (PostgREST rend 1 000 lignes au plus).
- CSV : point-virgule, virgule décimale, UTF-8 avec BOM, fins de ligne CRLF (`js/centre-csv.js`).
- Version sans noms (spec § 6.8) : agrégats seulement, aucune ligne par personne, aucun texte libre ; bénévoles et
  auto-écoles en nombres seulement dans toutes les versions.
- Textes officiels des indicateurs recopiés tels quels du décret n° 2026-728 (annexe du code du travail,
  LEGIARTI000054612711).
- Commit local à chaque tâche (le crochet pose le jeton `?v=`) ; jamais de poussée, jamais de fusion dans `main`
  sans l'accord de Timy ; pas d'entrée Nouveautés (page du seul fondateur, spec § 9).

## Points de vigilance

1. **Texte libre qui porte un nom** : un sujet de séance (« révision avec Kevin ») ne doit jamais entrer dans la
   version sans noms. Test en tâche 4.
2. **Promo vide ou sans date de fin** : page, dossiers et fiche s'affichent avec des raisons d'absence, jamais
   `NaN`, `undefined` ni « Invalid Date ». Tests en tâches 2, 4 et 6.
3. **Mauvaise promo lue** : choisir la promo 7 quand la promo courante est Nîmes doit donner les chiffres de la 7
   pour chaque table. Contrôle au banc en tâche 8.
4. **Impression qui reste accrochée** : quitter la page ou imprimer deux fois ne laisse ni feuille de style
   `@page` ni conteneur d'impression. Contrôle au banc en tâche 8 (`teardownQualiopiPrint` dans `navigate`).
5. **Promo longue** : Nîmes a plus de 1 000 entrées de planning ; une lecture tronquée fausserait le déroulé.
   `toutesLesLignes` partout (tâche 3), compte vérifié par une requête de lecture en tâche 8.

---

### Tâche 1 : référentiel en données

**Fichiers :** créer `js/qualiopi-referentiel.js` ; test `tests/qualiopi-referentiel.test.mjs`.

**Interfaces :**
- Produit : `SOURCE` (`{ decret, nor, enVigueur: "2026-11-01", annexe: "LEGIARTI000054612711", arreteAudit }`),
  `CRITERES` (7 × `{ numero, titre }`, titres de l'article R6316-1), `INDICATEURS` (33 ×
  `{ numero, critere, court, texte, categories: { formation, bilan, vae, apprentissage }, conditionnel,
  majeureSeulement, surveillance, nouvelEntrant, changement2026 }`), `indicateursApplicables({ alternance = false } = {})`
  → indicateurs de la catégorie formation, sans le 13 sauf alternance, triés par numéro.

- [ ] **Étape 1 : tests qui échouent.** `INDICATEURS.length === 33`, numéros 1 à 33 sans trou ; critères :
  1→[1,2,3], 2→[4..8], 3→[9..16], 4→[17..20], 5→[21,22], 6→[23..29], 7→[30..33] ;
  `indicateursApplicables().length === 27` et `({ alternance: true }).length === 28` ; aucun de 14, 15, 20, 29,
  33 dans les deux ; `majeureSeulement` vrai exactement pour [4,5,6,7,10,11,14,15,16,20,21,22,26,27,29,31,32] ;
  `surveillance` pour [1,3,17,19] ; `nouvelEntrant` pour [2,3,11,13,14,19,22,24,25,26,32] ; `changement2026`
  non nul exactement pour [1,2,3,7,12,14,15,19,20,27,30,31,32,33] ; le texte du 33 commence par « Le prestataire
  met en place un dispositif d'évaluation des contenus et des enseignements par les apprenants » ; celui du 32 finit
  par « analyse des risques sur la qualité des formations délivrées. » ; aucun U+2014 dans le source du module.
- [ ] **Étape 2 :** `node tests/qualiopi-referentiel.test.mjs` échoue (module absent).
- [ ] **Étape 3 : écrire le module.** Textes et catégories extraits par un script jetable (hors dépôt) de l'annexe
  en vigueur au 01/11/2026 (API Légifrance, `getArticle` sur LEGIARTI000054612711 : une ligne `<tr>` par
  indicateur, quatre cellules « x » puis le texte) ; `court` et `changement2026` écrits à la main d'après le tableau
  de l'annexe A et le § 2 de la spec ; `conditionnel` = la proposition « Lorsque... » ou « Pour les formations en
  alternance » quand le texte en porte une, sinon `null`.
- [ ] **Étape 4 :** le test passe.
- [ ] **Étape 5 : commit** « Qualiopi : référentiel du 1er novembre 2026 en données ».

### Tâche 2 : inventaire des preuves

**Fichiers :** créer `js/qualiopi-preuves.js` ; test `tests/qualiopi-preuves.test.mjs`.

**Interfaces :**
- Consomme : `INDICATEURS`, `indicateursApplicables` (tâche 1) ; `indicateursPromo` de `js/centre-stats.js`.
- Produit :
  - `NIVEAUX` : numéro → `{ niveau: "prouve" | "partiel" | "hors", apporte, ajout, aFournir: string[] }` pour les 28
    indicateurs de l'annexe A (textes de l'annexe, colonne par colonne) ;
  - `PIECES` : 13 × `{ cle, libelle, indicateurs: number[] }`, clés `effectif`, `deroule`, `datesCles`,
    `assiduite`, `passages`, `evaluations`, `dossierPro`, `ressources`, `misesAJour`, `innovations`, `intervenants`,
    `resultats`, `suivi` (sources et indicateurs du tableau du § 6.2) ;
  - `inventairePromo(donnees, referentiel, { promo, aujourdhui, alternance = false, nouveautes = [] })` →
    `{ promo, indicateurs: [{ numero, critere, court, niveau, apporte, pieces: [{ cle, libelle, presente, detail,
    raison }], aFournir }], nonApplicables: [{ numero, court, raison }] }`. `donnees` = sortie de
    `lireDonneesQualiopi` (tâche 3) ; `referentiel` = `lireReferentielCentre()`.
- Règles de présence (une phrase chiffrée en `detail`, sinon `raison`) : `deroule` présente s'il y a au moins une
  entrée de planning (« N demi-journées de formation du JJ/MM au JJ/MM ») ; `assiduite` présente seulement si
  `donnees.emargement` existe et porte au moins une feuille close (tâche 7), sinon raison « émargement non utilisé
  pour cette promo » ou « calcul des heures pas encore branché » si `donnees.emargement` est absent ; `evaluations`
  détaille notes, examens QCM, évaluations EPCF, livrets EPCF ; le jury est toujours absent (« aucun résultat de jury
  saisi ») ; `misesAJour` compte les cours publiés modifiés et les signalements traités (`traite_at`) entre le début et
  la fin (ou aujourd'hui) de la promo ; `innovations` compte les entrées de `nouveautes` datées dans la même période ;
  `intervenants` donne des nombres (formateurs distincts de `prof_ids`, intervenants « Autre » distincts, bénévoles
  distincts, auto-écoles actives du lieu). Non applicables : 14, 15, 20, 29, 33 (« apprentissage seulement ») et 13
  sans alternance (« pas d'alternance déclarée »).

- [ ] **Étape 1 : tests qui échouent** sur un jeu fait à la main (3 stagiaires dont 1 en abandon, planning de deux
  semaines, 4 notes, 1 examen QCM, 1 EPCF, 1 livret, 1 signalement traité, 1 cours mis à jour) : l'indicateur 11 est
  `prouve` avec la pièce `evaluations` présente et un `detail` qui contient « 4 notes » ; l'indicateur 1 est `hors`
  avec un `aFournir` non vide ; `nonApplicables` contient 14, 15, 20, 29, 33 et 13, et plus le 13 avec
  `alternance: true` ; `assiduite` absente avec la raison « calcul des heures pas encore branché » ; une entrée de
  planning d'une autre `promo_id` n'est pas comptée ; une promo vide (aucune donnée, `date_fin` nulle) donne 27
  indicateurs, aucune pièce présente, et aucun `detail` ni `raison` ne contient « NaN », « undefined » ni
  « Invalid ».
- [ ] **Étape 2 :** le test échoue.
- [ ] **Étape 3 : écrire le module** (`NIVEAUX`, `PIECES`, `inventairePromo`).
- [ ] **Étape 4 :** le test passe ; `node tests/centre-stats.test.mjs` passe toujours.
- [ ] **Étape 5 : commit** « Qualiopi : inventaire des preuves d'une promo ».

### Tâche 3 : lecture des données d'une promo

**Fichiers :** modifier `js/db.js` (à la suite de `lireReferentielCentre`).

**Interfaces :**
- Produit : `lireDonneesQualiopi(promoId)` → `{ ...await lireDonneesCentre(promoId), planning, agenda, livrets,
  dossiers, signalements, cours, autoEcoles }` avec, par le même `lire` à en-tête de lecture que
  `lireDonneesCentre` : `planning_entries` (id, semaine_lundi, day_index, half_day, activite, sujet, sujet_2,
  prof_ids, prof_autre, autonomie, benevoles_ids, promo_id), `agenda_events` (id, type, title, date_start,
  date_end), `epcf_livrets` (stagiaire_id, updated_at), `dp_dossiers` (stagiaire_id, updated_at) ; sans en-tête
  (tables communes) : `qcm_signalements` (id, stagiaire_id, statut, created_at, traite_at, filtrés ensuite sur les
  stagiaires de la promo, la table n'a pas de `promo_id`), `cours` (id, published, updated_at),
  `auto_ecoles` (id, actif, lieu_id).
- Toutes les lectures par `toutesLesLignes`. Pas de test node (réseau) : contrôlé au banc en tâche 8.

- [ ] **Étape 1 : écrire `lireDonneesQualiopi`.**
- [ ] **Étape 2 :** `node --check js/db.js`, puis `node --test "tests/*.test.mjs"` tout vert.
- [ ] **Étape 3 : commit** « Qualiopi : lecture des données d'une promo ».

### Tâche 4 : modèles des dossiers et CSV

**Fichiers :** créer `js/qualiopi-documents.js` ; test `tests/qualiopi-documents.test.mjs`.

**Interfaces :**
- Consomme : `inventairePromo` (tâche 2), `indicateursPromo`, `ligneComparaison` (`js/centre-stats.js`).
- Produit (modèles de données, sans DOM, rendus par la vue) :
  - `modeleDossierFormation({ inv, donnees, ind, promo, lieu, intitule, aujourdhui })` → `{ titre, sousTitre, garde:
    string[], sommaire: [{ numero, court, section }], sections: [{ id, titre, indicateurs: number[], paragraphes:
    string[], tableaux: [{ entetes: string[], lignes: string[][] }] }], aFournir: [{ numero, court, items }] }`.
    Sections du § 6.4 dans cet ordre : `effectif`, `deroule`, `assiduite`, `passages`, `evaluations`, `ressources`,
    `signalements`, `examen`, `appreciations`. Phrase de garde : « Pièces issues de l'application ECSR Promo, à
    joindre au dossier qualité du centre. Le centre reste seul audité et certifié. »
  - `modeleDossierCentre({ promos: [{ promo, inv, ind }], lieu, periode: { du, au }, aujourdhui, sansNoms })` → même
    forme ; sections `resultats` (une ligne par promo, « provisoire » si en cours), `ressources`, `innovations`,
    `intervenants`, `amelioration`, puis l'inventaire. `sansNoms` : aucun tableau par personne, listes remplacées par
    des nombres, aucun sujet de séance ni autre texte libre, aucun nom de formateur.
  - `inventaireCsv(inv)` → texte CSV, une ligne par indicateur applicable : numéro, critère, libellé court, niveau,
    pièces présentes, pièces absentes avec raison, pièces à fournir.
  - `nomFichierQualiopi(nature, nomPromo, dateIso)` → par exemple `qualiopi-formation-montpellier-2026-10-28.csv`.

- [ ] **Étape 1 : tests qui échouent.** Sur le jeu de la tâche 2 enrichi d'un sujet de séance « révision avec
  Kevin » où Kevin est un prénom de stagiaire : `JSON.stringify(modeleDossierCentre({ ..., sansNoms: true }))` ne
  contient aucun prénom ni nom de stagiaire, aucun nom de formateur, aucun nom de bénévole ni d'auto-école, ni
  « Kevin » ; la version nominative du dossier de la formation contient le nom de chaque stagiaire ; le sommaire
  couvre les 27 indicateurs applicables ; le dossier d'une promo vide ne contient ni « NaN », ni « undefined », ni
  « Invalid » ; `inventaireCsv` commence par le BOM, sépare par « ; », finit ses lignes par CRLF et compte 1 + 27
  lignes.
- [ ] **Étape 2 :** le test échoue.
- [ ] **Étape 3 : écrire le module.**
- [ ] **Étape 4 :** le test passe.
- [ ] **Étape 5 : commit** « Qualiopi : modèles des dossiers et export CSV ».

### Tâche 5 : page Qualiopi

**Fichiers :** créer `js/views/qualiopi.js`, `css/qualiopi.css` (lien dans `index.html`, comme les autres feuilles) ;
modifier `js/main.js` (route, `ONGLET_POUR_ROUTE.qualiopi = "home"`, garde, `teardownQualiopiPrint()` dans
`navigate` à côté de `teardownCentrePrint()`), `js/views/centre.js` (bouton « Qualiopi » si `isFounder()`).

**Interfaces :**
- Consomme : tâches 1 à 4 ; `getMesPromos`, `getPromoCourante`, `lireReferentielCentre`, `lireDonneesQualiopi` ;
  `NOUVEAUTES` de `js/nouveautes-data.js` (pour `nouveautes`).
- Produit : `renderQualiopi(container)`, `teardownQualiopiPrint()`.
- Garde : route `qualiopi` sans `isFounder()` → `#/home` sans message.
- Page (§ 6.3) : en-tête « Qualité » / « Qualiopi » / centre · promo · « référentiel du 1er novembre 2026 » ;
  sélecteur de promo parmi `getMesPromos()` (la courante par défaut) ; case « Formation en alternance » ; 7 critères
  en `<details>` ; carte par indicateur (numéro, libellé court, niveau en pastille de texte, pièces présentes ou
  absentes avec leur raison, pièces à fournir) ; indicateurs non applicables groupés en fin ; actions « Dossier de la
  formation », « Dossier du centre » + case « Sans aucun nom », « Tableau (CSV) ». Chargement avec jeton de rendu
  comme `renderCentre` (une réponse tardive n'écrit pas dans une page quittée).
- Dossier du centre : promos de `getMesPromos()` du même lieu dont les dates chevauchent les 12 derniers mois, lues
  l'une après l'autre.
- Impression : le modèle est rendu dans `#qualiopi-print` (caché à l'écran), `@page { size: A4 portrait; margin:
  12mm; }` injectée, classe `qualiopi-printable` sur `body`, `window.print()`, retrait à `afterprint` et par
  `teardownQualiopiPrint`.

- [ ] **Étape 1 : écrire la vue, la feuille de style, les branchements.**
- [ ] **Étape 2 :** `node --test "tests/*.test.mjs"` vert ; `python outils/verifier_navigation.py` sans échec (la
  table des routes a changé).
- [ ] **Étape 3 : banc** (méthode de la tâche 8) : la page s'ouvre pour le fondateur, renvoie un formateur à
  l'accueil ; les trois documents s'impriment ; aucun débordement à 375 px.
- [ ] **Étape 4 : commit** « Qualiopi : page du fondateur, dossiers imprimables et CSV ».

### Tâche 6 (lot Q2) : fiche « résultats »

**Fichiers :** créer `js/qualiopi-resultats.js` ; test `tests/qualiopi-resultats.test.mjs` ; modifier
`js/centre-stats.js` (objet `METHODES_PUBLIQUES`) et `js/views/qualiopi.js` (bouton « Fiche résultats »).

**Interfaces :**
- Produit : `METHODES_PUBLIQUES` (clés `effectif`, `abandon`, `presence`, `obtention`, `satisfaction` ; phrases pour
  le public, sans « fiche », « app » ni jargon), `promoTerminee(promo, aujourdhui)` (vrai si `date_fin` non nulle et
  passée), `ficheResultats({ promo, ind, aujourdhui, presence = null, obtention = null, satisfaction = null })` →
  `{ terminee, publiable, avertissement, lignes: [{ cle, libelle, valeur, effectif, periode, methode }] }`,
  `ficheResultatsTexte(fiche)` → texte brut à coller sur un site.
- Valeurs absentes : présence « non mesuré », obtention du titre « non saisi », satisfaction « non mesurée ». Promo en
  cours : `publiable` faux, avertissement « Résultats provisoires : la formation n'est pas terminée. Ne pas publier. »
- Fiche d'un centre : les fiches de ses promos (même lieu, même période que le dossier du centre), l'une après
  l'autre, jamais de total (spec § 6.8) ; c'est ce qu'imprime le bouton quand « Dossier du centre » est le contexte
  choisi, sinon la fiche de la promo choisie.

- [ ] **Étape 1 : tests qui échouent** : promo sans `date_fin` → `terminee` et `publiable` faux, avertissement
  présent ; promo finie la veille → `publiable` vrai ; taux d'abandon d'une promo de 10 inscrits dont 1 abandon →
  « 10 % » avec l'effectif 10 ; les trois valeurs absentes ont leurs libellés exacts ; chaque ligne porte la méthode
  de `METHODES_PUBLIQUES` ; `ficheResultatsTexte` ne contient ni « NaN » ni « undefined » et aucun U+2014.
- [ ] **Étape 2 :** le test échoue.
- [ ] **Étape 3 : écrire le module, `METHODES_PUBLIQUES`, le bouton** (impression A4 par le même mécanisme et bouton
  « Copier le texte » par `navigator.clipboard.writeText`, avec message si le presse-papiers est refusé).
- [ ] **Étape 4 :** les tests passent, `tests/centre-stats.test.mjs` compris.
- [ ] **Étape 5 : commit** « Qualiopi : fiche des résultats à publier ».

### Tâche 7 : assiduité (seulement si `attestations` est dans `main`)

**Condition :** `git merge-base --is-ancestor attestations main` réussit (Timy a fusionné la branche). Sinon la tâche
est sautée, l'assiduité reste « calcul des heures pas encore branché » et la présence « non mesuré ».

**Fichiers :** modifier `js/db.js` (`lireDonneesQualiopi` lit les feuilles closes de la promo par l'en-tête de
lecture, sans les tracés), `js/qualiopi-preuves.js`, `js/qualiopi-documents.js`, `js/views/qualiopi.js` et leurs tests.

**Interfaces :** consomme `seancesDeLaPromo`, `feuillesOuvertes`, `bilanStagiaire`, `stagiairesDeLaPeriode` de
`js/attestations-rules.js` ; produit `donnees.emargement = { seances }` et le taux de présence de la fiche (méthode
`presence` du § 6.8 : heures réalisées sur heures prévues, feuilles closes, toutes lignes).

- [ ] **Étape 1 : tests qui échouent** : avec deux feuilles closes et une ouverte, la pièce `assiduite` est présente
  (« 2 feuilles closes ») et la feuille ouverte n'est pas comptée ; le taux de présence égale celui que
  `bilanStagiaire` donne en somme.
- [ ] **Étape 2 :** échec ; **Étape 3 :** code ; **Étape 4 :** vert ; **Étape 5 : commit** « Qualiopi : assiduité
  d'après les feuilles d'émargement ».

### Tâche 8 : vérification et notes

- [ ] **Étape 1 : banc.** Copier `_harness_build.mjs`, `_harness_supabase.js`, `_banc_centre_demo.js` de
  `TP_ECSR_App` ; ajouter à l'export de démonstration les tables de la tâche 3 pour la promo 7 (requêtes de lecture
  seule) ; `node _harness_build.mjs` ; entrée temporaire dans `C:/Users/watch/Dev/ECSR/.claude/launch.json`.
- [ ] **Étape 2 : contrôles au banc** (fondateur, `?centre=1&demo=1`) : promo 7 choisie alors que la courante est
  une autre, chiffres de la 7 ; trois documents imprimés en A4 dans Chromium et WebKit ; deux impressions de suite puis
  changement de page : plus de `#qualiopi-print` ni de style `@page` ; 375 px sans débordement ; cibles de 44 px.
- [ ] **Étape 3 : chiffres.** Recompter par requêtes de lecture sur la base, pour la promo 7, les nombres du dossier
  de la formation (demi-journées de planning, notes, examens, EPCF, livrets, signalements).
- [ ] **Étape 4 :** `node --test "tests/*.test.mjs"` et `python outils/verifier_navigation.py` sans échec.
- [ ] **Étape 5 : notes.** Section « Dossier Qualiopi » de `PROJECT_NOTES.md` (modules, garde, banc, limites) ;
  commit « Qualiopi : notes de projet ».
- [ ] **Étape 6 : montrer à Timy** (captures, dossiers en PDF) avant toute fusion.
