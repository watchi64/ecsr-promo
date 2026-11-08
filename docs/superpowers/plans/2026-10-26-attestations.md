# Certificat de réalisation et attestation d'assiduité : plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** depuis la page Émargement, un formateur tire pour chaque stagiaire le certificat de
réalisation (modèle du ministère) et l'attestation d'assiduité, calculés sur les feuilles closes.

**Architecture :** un module pur de calcul (`js/attestations-rules.js`, testé en node), un module
qui construit les deux pièces A4 en DOM (`js/attestations-documents.js`), une vue
(`js/views/attestations.js`) appelée par `renderEmargement` quand l'adresse est
`#/emargement/attestations`. Lecture légère des feuilles sans tracés (`db.js`). Impression par
`imprimer()` de `emargement-feuilles.js`. Aucune migration.

**Tech Stack :** JS modules sans build, Supabase (lecture), `node --test`.

**Spec :** `docs/superpowers/specs/2026-10-24-attestations-design.md`

## Global Constraints

- Aucun tiret cadratin (U+2014), nulle part.
- Texte du certificat : celui du § 4.1 de la spec, mot pour mot (consignes en italique sous les
  pointillés d'un champ vide seulement).
- Seules les feuilles `statut = 'close'` comptent ; signé = `signe_le` non nul.
- Une demi-journée signée compte pour `dureeMinutes(debut, fin)` entière.
- Page réservée aux formateurs, interrupteur `emargement_actif` allumé (portes existantes de
  `renderEmargement`).
- Imports avec le jeton `?v=` en cours dans les sources (le hook de `main` le re-tamponne).
- Vérification au banc, 375 px compris, avant toute annonce.

## Review Focus

1. Période qui ne contient aucune feuille close : page lisible (« Aucune feuille close »), aucun bouton cassé.
2. Stagiaire passé inactif après quelques feuilles : listé, ses heures justes, pas de feuille « prévue » après son départ.
3. Feuille ouverte dans la période : signalée, jamais additionnée (test dédié).
4. Réglage d'en-tête vide (signataire, qualité, adresse) : pointillés et consignes, aucun « undefined ».
5. Formation longue : la lecture ne charge aucun tracé (requête sans `trace`).

---

### Task 1 : calcul (module pur)

**Files :** Create `js/attestations-rules.js`, `tests/attestations-rules.test.mjs`.

**Interfaces (Produces) :**
- `bilanStagiaire(seances, stagiaireId)` → `{ prevuesMin, realiseesMin, absencesMin, taux, demiPrevues, demiSignees, premierPrevu, dernierPrevu, premierSigne, dernierSigne, semaines: [{ lundi, demiPrevues, demiSignees, prevuesMin, realiseesMin }], evenements: [{ jour, demi, debut, fin, minutes, absent, origine, observation }] }`. `seances` : `[{ id, jour, demi_journee, debut, fin, statut, lignes: [{ stagiaire_id, signe_le, absent, absence_origine, observation }] }]`. Ignore les feuilles non closes. `taux` : entier arrondi, `null` si rien de prévu. `evenements` : lignes absentes et lignes signées avec observation, triées par jour puis matin avant après-midi.
- `stagiairesDeLaPeriode(seances, stagiairesTous)` → stagiaires ayant une ligne sur une feuille close, triés par `compareByNom` (ordre de `utils.js` : nom puis prénom, `localeCompare` fr).
- `feuillesOuvertes(seances)` → nombre de feuilles non closes.
- `demiJourneesSansFeuille(seances, du, au)` → nombre de demi-journées lundi à vendredi de [du, au], hors `jourFerie`, sans aucune feuille (ouverte ou close).
- `periodeParDefaut(promo, aujourdhui)` → `{ du, au }` : `du = promo.date_debut` (sinon lundi de la semaine), `au = min(aujourdhui, promo.date_fin)` si `date_fin`.
- `moisDeLaPeriode(seances)` → `[{ cle: "2026-10", du: "2026-10-01", au: "2026-10-31", libelle: "Octobre 2026" }]` des mois ayant une feuille close.
- `dureeEnToutesLettres(min)` → « 66 heures », « 66 heures 30 minutes », « 1 heure », « 0 heure ».
- `dateFr(iso)` → « 12/10/2026 ».
- `LIBELLE_ORIGINE` : `{ non_signe: "Non signé", planning: "Noté absent au planning", formateur: "Marqué absent par le formateur" }`.
- `estAdresseAttestations(hash)` → vrai pour `#/emargement/attestations`.

- [ ] **Step 1 : tests** (`node --test tests/attestations-rules.test.mjs`) : deux feuilles closes de 3 h 30 (une signée, une absente non signée) + une ouverte signée → prévues 420, réalisées 210, absences 210, taux 50, ouverte comptée à part ; observation sur ligne signée dans `evenements` ; semaines séparées par lundi ; premierSigne/dernierSigne ; stagiaire sans ligne exclu de `stagiairesDeLaPeriode` ; `demiJourneesSansFeuille` d'une semaine avec 1 jour férié (2026-11-11) et 2 feuilles → 6 ; `periodeParDefaut` bornée par `date_fin` ; `dureeEnToutesLettres(3990)` → « 66 heures 30 minutes » ; `estAdresseAttestations`.
- [ ] **Step 2 : constater l'échec, écrire le module, constater le succès.**
- [ ] **Step 3 : commit.**

### Task 2 : lecture et réglage d'en-tête

**Files :** Modify `js/db.js` (bloc émargement).

- `listEmargementPresences(jourDebut, jourFin)` : `emargement_seances` sélection `id, jour, demi_journee, debut, fin, statut, lignes:emargement_lignes(stagiaire_id, signe_le, absent, absence_origine, observation, sur_appareil_formateur)`, bornes incluses, `order("jour")`.
- `getEnteteEmargement()` rend en plus `adresse1, adresse2, signataire, qualite, lieu` (chaînes, `""` par défaut) ; `setEnteteEmargement(e)` écrit les sept champs (tronqués, `trim`).
- Dialogue « En-tête » de `js/views/emargement.js` : quatre champs de plus (adresse en deux lignes, signataire, qualité, lieu « Fait à » avec en indication le lieu de la promo).

- [ ] Modifier, `node --check js/db.js js/views/emargement.js`, commit.

### Task 3 : les deux pièces

**Files :** Create `js/attestations-documents.js`. Modify `css/emargement.css` (bloc en fin de fichier, avant `@media print`).

- `certificatRealisation({ entete, lieuDefaut, stagiaire, bilan, faitLe })` → élément `.at-doc.at-certificat` (A4 portrait 210 mm). Texte du § 4.1, cases ☒/☐ en caractères, notes ¹ ².
- `attestationAssiduite({ entete, lieuDefaut, promo, stagiaire, bilan, nbFeuilles, faitLe })` → `.at-doc.at-attestation` (§ 4.4).
- `champ(valeur, consigne)` interne : valeur, ou pointillés suivis de la consigne en italique.
- En-tête commun : raison sociale en gras, lignes d'adresse ; pas de logo.
- CSS : `.at-doc + .at-doc { break-before: page; }`, tableaux à bordures fines, cadre de signature 85 x 40 mm.

- [ ] Écrire, `node --check`, commit.

### Task 4 : la page

**Files :** Create `js/views/attestations.js`. Modify `js/views/emargement.js` (branche d'adresse + bouton « Attestations » dans `em-barre-actions`), `css/emargement.css`.

- `renderAttestations(container, { promo, stagiairesTous, entete })` : période (deux `input[type=date]`, « Toute la formation », un bouton par mois), alerte feuilles ouvertes et demi-journées sans feuille, liste (nom, « 63 h sur 70 h », absences, taux) avec « Certificat » (désactivé si 0 signée) et « Attestation » ; « Tous les certificats », « Toutes les attestations » ; lien retour vers la semaine. Lecture par `listEmargementPresences(du, au)` ; jeton de rendu contre les lectures périmées.
- Sur téléphone (< 760 px), lignes en cartes.

- [ ] Écrire, `node --check`, commit.

### Task 5 : banc et preuve

**Files :** `_harness_supabase.js` (non versionné, recopié dans `TP_ECSR_App` à la fin), `_banc_emargement_demo.js` (non versionné : les 20 feuilles de la promo 7, lues en SQL sans tracés).

- Levier `?centre=1&demo=1&emargement=7` : feuilles de la promo 7 chargées, tracés refaits par `signatureFictive`, interrupteur allumé pour la promo 7.
- Preuves : un stagiaire recompté à la main (feuille par feuille) et par SQL de lecture ; pointillés avec en-tête vide ; en-tête rempli ; « Tous les certificats » (10 documents, sauts de page) ; feuille ouverte au banc signalée ; 375 px sans débordement horizontal.
- [ ] Faire, puis `node --test tests/` vert, commit.

### Task 6 : relecture et mise en ligne

- `PROJECT_NOTES.md` : section Attestations. Texte Nouveautés préparé dans la spec (§ 8), pas d'entrée (décision de Timy du 26/10).
- Relecture indépendante du diff ; mise à jour avec `main` ; montrer à Timy ; sur accord : `git merge --no-ff --no-commit attestations` dans `main`, `git commit`, push, vérification de la page servie.
