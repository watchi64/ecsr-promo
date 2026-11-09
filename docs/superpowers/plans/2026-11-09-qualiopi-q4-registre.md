# Dossier Qualiopi, lot Q4 : registre qualité, plan de mise en œuvre

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans, tâche par tâche. Les étapes se cochent (`- [ ]`).

**But :** le fondateur tient dans l'app un registre daté des réclamations, difficultés, aléas, améliorations et risques
(indicateurs 31 et 32), le remplit en une minute, y verse un signalement « Signaler un problème » sans recopier la
personne, l'exporte en CSV, et les dossiers Qualiopi en donnent les décomptes et le délai médian de réponse.

**Ordre :** Q4 se construit **après la mise en ligne de Q3** (migration `20261108_questionnaires.sql` appliquée, branche
`qualiopi-q3` fusionnée dans `main`, simulation Q3 reportée dans le banc du dépôt principal) : il réutilise
`peut_gerer_qualite()` et la page Qualiopi de Q3. Branche neuve tirée de `main` à ce moment-là ; si Q3 n'est pas en ligne,
on ne commence pas.

**Architecture :** règles pures testées en node (`js/registre-rules.js`, `js/registre-erreurs.js`) ; base : une table
`registre_qualite` en lecture et écriture directes, gardées par des règles RLS sur `peut_gerer_qualite()` et un déclencheur
qui pose les dates, plus une fonction manuelle d'effacement à 3 ans (migration prouvée en SQL, NON appliquée sans l'accord de
Timy) ; un sous-onglet « Registre qualité » sur la page Qualiopi, une fenêtre de saisie partagée avec la page « Problèmes
signalés » ; une pièce `registre` dans l'inventaire et les dossiers.

**Technique :** modules ES sans build, `el()` de `js/utils.js`, Supabase par `js/db.js`, `renderSubTabs` (`js/subtabs.js`),
`ouvrirFenetre` (`js/nav-fenetre.js`), `cellule` (`js/centre-csv.js`), tests `node:assert/strict`, PostgreSQL et RLS, banc à faux
client (`_harness_supabase.js`).

**Spec :** `docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md` (validée par Timy le 08/11/2026), § 3 (décision 4),
§ 5, § 7, § 8, § 10 (droit, registre et données personnelles). Q5 (conservation) a son plan.

## Contraintes communes

- Aucun tiret cadratin (U+2014) nulle part, ce plan compris ; dans un test, `String.fromCharCode(0x2014)`, et pour un fichier
  `python -c "import sys; t=open(sys.argv[1],encoding='utf-8').read(); sys.exit(chr(0x2014) in t)" <fichier>`.
  « Formateur », jamais « prof » à l'écran. Tutoiement à l'écran, documents (dossiers, CSV) impersonnels.
- Contraste AA, cibles de 44 px, aucun défilement de côté : le registre est une liste de cartes, jamais un tableau, sur
  téléphone comme sur ordinateur.
- Droit unique `peut_gerer_qualite()` (créée par Q3, vaut `est_fondateur()` : le fondateur réel, hors aperçu) : Q4 la lit,
  ne la recrée pas, ne la retire pas dans son retour.
- Aucun nom de personne recopié d'un signalement : l'origine seulement (stagiaire, formateur, équipe).
- Une seule échéance d'effacement partout (fonction, déclencheur, `aEffacer`) : `clos_le + interval '3 years' < now()`.
- Base de production : lecture seule pendant la construction ; migration répétée et prouvée en local (méthode de la mémoire
  « Répétition de migration dans la preuve SQL »), appliquée seulement avec l'accord de Timy, fichier de retour fourni.
  `PGCLIENTENCODING=UTF8` obligatoire avec psql sous Windows.
- Jeton `?v=` aligné sur celui de `main` au moment de la tâche (`20261109d` le 09/11) sur tout import ; commit local par tâche.
- **Pas d'entrée Nouveautés** : fonctionnalité réservée au fondateur (spec § 7).
- Parcours prouvés au banc : fondateur (ajout, modification, export, conversion), refus pour formateur et stagiaire ;
  téléphone (375 px) et ordinateur ; Chromium et WebKit ; robot de parcours vert avant toute fusion.

## Points de vigilance (Review Focus)

1. **Lien vers le signalement qui disparaît** : `signaler_probleme()` purge les signalements de plus de 12 mois, et la
   fermeture d'un compte les efface en cascade. Le lien est donc `on delete set null`, et une marque `issu_signalement`
   garde la trace. Le déclencheur doit laisser passer cette mise à nul, appelée par n'importe quel compte (la purge tourne
   chez le stagiaire qui signale) et même sur une entrée effacée. Preuve SQL en tâche 2.
2. **Effacement à 3 ans (choix : construit en Q4)** : fonction manuelle `effacer_registre_qualite()`, comme les autres
   effacements, parce que la règle ne touche que cette table, se prouve avec la même migration et ne dépend pas de la
   scission d'`anonymiser_promo()` de Q5 ; le renvoyer à Q5 laisserait une table sans effacement si Q5 glissait. Le
   déclencheur refuse aussi un effacement avant l'échéance par écriture directe. L'effacement dû se rappelle en tête de la
   page Qualiopi, pas seulement dans le sous-onglet (tâche 4).
3. **Rappel violences** : le formulaire dit que violences, harcèlement et discriminations passent par le référent et la
   procédure du centre, jamais par le registre (indicateur 12, anti-objectif du § 2).
4. **CSV** : une cellule qui commence par `=`, `+`, `-` ou `@` ne devient jamais une formule (`cellule()` la neutralise) ; le
   fichier contient des textes libres, il n'est montré qu'au fondateur.
5. **Entrées sans promo** : la spec ne donne pas de lieu au registre, or le dossier du centre est par lieu. Une colonne
   `lieu_id` facultative (posée d'après la promo quand il y en a une) range l'entrée ; ni promo ni lieu : l'organisme entier,
   l'entrée compte dans le dossier de chaque centre.
6. **Cas d'usage, chacun testé dans sa tâche** : fenêtre fermée (Échap, voile, « Fermer ») sur une saisie modifiée :
   confirmation (tâche 4) ; « Au registre » qui ne redevient pas « Ajouter » d'un sous-onglet de « Problèmes signalés » à
   l'autre (tâche 5) ; nom recopié dans la description préremplie : rappel près du champ (tâches 4 et 5) ; entrée effacée :
   carte en lecture seule (tâche 4) ; cinq boutons de type à 375 px : passage à la ligne (tâche 4) ; réponse tapée sans date :
   date du jour proposée (tâche 4) ; plus de 1 000 entrées : lecture par pages `toutesLesLignes` (tâche 3).

## Points à valider par Timy avant construction

1. **Rappel du formulaire** (proposition) : « Violences, harcèlement, discriminations : ne les écris pas ici. Ils passent par
   le référent du centre et sa procédure, qui protègent la personne. Ne nomme personne : l'origine suffit. »
2. **Effacement** : construit en Q4 (vigilance 2) ; vidés : description, réponse, action décidée, mesure de prévention (tous
   les textes libres) ; restent : type, origine, promo, lieu, dates, état (les conditions de Q3 disent « description et
   réponse », plus large ici).
3. **Entrées jamais closes** : elles ne s'effacent jamais. Proposition : une entrée ouverte ou en cours dont la date a plus de
   3 ans est signalée « à clore » en tête de page ; pas d'effacement sans clôture.
4. **CSV** : complet, textes compris (c'est le registre que l'auditeur demande), avec l'aide « Le fichier contient les
   descriptions : ne le transmets qu'à l'auditeur ». Variante : une case « sans les textes ».
5. **Dossiers** : décomptes, délai médian et une ligne par entrée (date, type, origine, état, délai), sans aucun texte libre ;
   la garde du dossier du centre (« en nombres seulement ») reste donc vraie. Sa version « sans aucun nom » ne garde que les
   décomptes et le délai médian (le dossier de la formation, nominatif, n'a pas de version sans noms).
6. **Pas de suppression** d'une entrée dans l'app (le registre est une preuve) ; une erreur se clôt avec une réponse qui le dit.

---

### Tâche 1 : règles pures du registre

**Fichiers :** créer `js/registre-rules.js`, `js/registre-erreurs.js`, `tests/registre-rules.test.mjs`,
`tests/registre-erreurs.test.mjs`.

**Interfaces :**
- `js/registre-rules.js` produit :
  - `TYPES` `{ reclamation: "Réclamation", difficulte: "Difficulté", alea: "Aléa", amelioration: "Amélioration", risque:
    "Risque" }` ; `ORIGINES` `{ stagiaire, formateur, entreprise, financeur, equipe: "Équipe", autre }` ; `ETATS` `{ ouvert:
    "Ouvert", en_cours: "En cours", clos: "Clos" }` ; `RAPPEL_VIOLENCES` (texte du point 1 ci-dessus) ; `LIMITE_TEXTE = 2000`.
  - `validerEntree(champs, aujourdhui)` → `{ ok, erreurs: { champ: phrase } }` : type, origine et date requis ; date pas dans
    le futur (écran seulement) ; description de 3 à 2 000 caractères ; date de réponse seulement avec une réponse, ni avant
    la date ni dans le futur ; mesure de prévention seulement pour un risque, et requise pour clore un risque (aussi tenu
    par la base, tâche 2).
  - `filtrerRegistre(entrees, { etat, type })` (`"tous"` accepté), du plus récent au plus ancien (date, puis id).
  - `entreeDepuisSignalement(s)` → `{ type: "difficulte", origine, promo_id, description, date_constat, signalement_id }` ;
    origine : `stagiaire` → stagiaire, `formateur` → formateur, `fondateur` → equipe ; date du jour du signalement à l'heure de
    Paris ; description = message tronqué à 2 000. Ni `nom`, ni `email`, ni `contexte`.
  - `entreesPourPromo(entrees, promo, aujourdhui)` : celles de la promo, plus celles sans promo de son lieu ou sans lieu,
    datées dans sa période (début à fin, ou à aujourd'hui) ; `entreesPourCentre(entrees, { lieuId, promoIds, du, au })` :
    chaque entrée une fois.
  - `decompteRegistre(entrees)` → `{ total, parType, parEtat }` (toutes les clés, zéros compris) ; `delaiMedianJours(entrees)`
    → nombre ou `null` (entrées avec date de réponse seulement ; médiane paire = moyenne des deux du milieu).
  - `echeanceEffacement(closLe)` → instant `clos_le + 3 ans` (29/02 → 28/02, comme `interval '3 years'` de Postgres) ;
    `aEffacer(entrees, maintenant)` (closes, non effacées, échéance passée) ; `aClore(entrees, aujourdhui)` (point 3).
  - `registreCsv(entrees, nomsPromos, nomsLieux)` et `nomFichierRegistre(dateIso)` (« registre-qualite-AAAA-MM-JJ.csv ») :
    colonnes `N° ; Date ; Type ; Origine ; Promo ; Centre ; Description ; Réponse ; Date de réponse ; Délai (jours) ; Action
    décidée ; Mesure de prévention ; État ; Clos le ; Issu d'un signalement`, format de `inventaireCsv` (BOM, point-virgule,
    CRLF, `cellule()`) ; centre : nom du lieu ou « Tout l'organisme » ; entrée effacée : « texte effacé (3 ans après la
    clôture) » dans les colonnes de texte.
- `js/registre-erreurs.js` produit `messageErreurRegistre(error)` (modèle de `js/questionnaires-erreurs.js`) et
  `tableAbsente(error)` (`PGRST205`, `42P01`, ou message « could not find the table » / « relation … does not exist »).
- [ ] **Étape 1 : tests qui échouent** :
  - `Object.keys(TYPES)`, `ORIGINES`, `ETATS` exacts ; aucun libellé ni `RAPPEL_VIOLENCES` avec U+2014 ou « prof ».
  - `validerEntree` : risque clos sans mesure refusé, mesure sur une difficulté refusée, réponse datée la veille du constat
    refusée, date de réponse sans réponse refusée, description de 2 caractères refusée, 2 001 refusée, entrée complète acceptée.
  - `entreeDepuisSignalement({ id: 7, role: "fondateur", nom: "V. Timy", email: "t@example.invalid", message: "Le planning
    ne s'affiche pas", promo_id: 3, contexte: { page: "#/planning" }, created_at: "2026-11-01T23:30:00Z" })` :
    `deepEqual` à `{ type: "difficulte", origine: "equipe", promo_id: 3, description: "Le planning ne s'affiche pas",
    date_constat: "2026-11-02", signalement_id: 7 }` ; le JSON ne contient ni « Timy » ni « example.invalid ».
  - `delaiMedianJours` : [2, 5, 9] → 5 ; [2, 5] → 3,5 ; sans réponse datée → `null`.
  - `echeanceEffacement("2028-02-29T10:00:00Z")` tombe le 2031-02-28 ; `aEffacer` vrai une heure après l'échéance, faux une
    heure avant, faux pour une entrée ouverte ou déjà effacée.
  - `registreCsv` : commence par U+FEFF, en-tête exact ; la description `=HYPERLINK("http://x")` sort en cellule qui commence
    par `"'=HYPERLINK(` ; `+33 6`, `-2`, `@SUM(A1)` commencent par une apostrophe ; point-virgule et retour à la ligne cités ;
    entrée sans promo ni lieu : « Tout l'organisme ».
  - `entreesPourPromo` : entrée d'une autre promo exclue, sans promo du lieu dans la période incluse, hors période exclue, de
    l'organisme incluse ; `entreesPourCentre` sans doublon.
  - `messageErreurRegistre` : `23505` → « Ce signalement est déjà au registre. » ; `42501` → « Réservé à la gestion de la
    qualité : ce compte n'a pas ce droit. » (phrase de `js/db.js`, `lireOuverturesQuestionnaires`) ; « registre: phrase » →
    « phrase » ; autre → « Le registre n'a pas pu être enregistré : vérifie ta connexion, puis réessaie. »
- [ ] **Étape 2 :** échec constaté (`node --test tests/registre-rules.test.mjs tests/registre-erreurs.test.mjs`). **Étape 3 :**
  code. **Étape 4 :** vert.
- [ ] **Étape 5 : commit** « Registre qualité : règles ».

### Tâche 2 : migration, retour et preuve SQL

**Fichiers :** créer `supabase/migrations/<date>_registre_qualite.sql`, `..._registre_qualite_retour.sql`,
`tests/sql/registre-qualite-schema-minimal.sql`, `tests/sql/registre-qualite-preuve.sql` (forme de
`questionnaires-preuve.sql` : `DO` qui lève toujours « VERT n/0 » ou « ROUGE ok/ko : cas », migration et retour joués par
`EXECUTE` entre deux empreintes md5).

**Schéma minimal :** charge `questionnaires-schema-minimal.sql` par `\ir` (il exige `-v lot4_fonctions=<chemin absolu de
supabase/migrations/20261028_roles_2_fonctions.sql>`, à passer aussi ici), ajoute `user_profiles.prof_id` et `profs (id, nom)`
(lus par `signaler_probleme`, `20261028_signalements_app.sql` ligne 122), puis rejoue tels quels `20261028_signalements_app.sql`
et `20261108_questionnaires.sql`.

**Interfaces :**
- Table `registre_qualite` : `id bigint identity`, `type`, `date_constat date not null`, `origine`, `promo_id` (promos, `on
  delete restrict`, nul permis), `lieu_id` (lieux, idem), `description` (3 à 2 000, nulle seulement si effacée), `reponse`,
  `date_reponse` (`date_reponse is null or reponse is not null or efface_le is not null`, et `>= date_constat`), `action`,
  `etat` (`ouvert` par défaut, `en_cours`, `clos`), `mesure_prevention` (nulle hors risque ; `type <> 'risque' or etat <>
  'clos' or mesure_prevention is not null or efface_le is not null`), `signalement_id` (signalements_app, `on delete set null`,
  unique), `issu_signalement boolean not null default false`, `cree_le`, `modifie_le`, `clos_le`, `efface_le` (timestamptz).
  Textes de 2 000 au plus.
- Déclencheur `_registre_qualite_avant()` (avant insertion et mise à jour) : pose `cree_le` (jamais fourni par l'app),
  `modifie_le`, `issu_signalement` (vrai si `signalement_id` à la création, figé ensuite), `clos_le` (posé au passage à `clos`,
  remis à nul à la réouverture), `lieu_id` d'après la promo (un lieu contraire est refusé) ; refuse tout changement de
  `signalement_id` sauf sa mise à nul ; sur une entrée effacée, refuse tout sauf cette mise à nul ; n'accepte `efface_le`
  que si `clos_le + interval '3 years' < now()` et que les quatre textes passent à nul. Refus en « registre: <phrase> ».
- Droits : `revoke all` sur la table pour `public, anon, authenticated`, puis `grant select, insert, update` à `authenticated` ;
  RLS lecture, insertion, mise à jour sous `(select peut_gerer_qualite())` ; aucune règle de suppression.
- `effacer_registre_qualite()` → `integer` (`security definer`, `peut_gerer_qualite()` requis, `revoke execute from public,
  anon`, `grant` à `authenticated`) : vide les entrées dont l'échéance est passée, pose `efface_le`, rend le nombre.
- Retour : la fonction, la table, le déclencheur ; `peut_gerer_qualite()` reste.
- [ ] **Étape 1 : preuve qui échoue** (fichiers vides) avec les cas : fondateur lit, ajoute, modifie ; formateur, stagiaire,
  direction et fondateur en aperçu ne lisent rien, n'ajoutent rien, et leur modification touche 0 ligne ; suppression refusée
  à tous ; droits de table et de fonction exactement ceux ci-dessus (aucun pour `anon`) ; type, origine, mesure hors risque,
  risque clos sans mesure, date de réponse avant le constat ou sans réponse refusés ; `cree_le` fourni ignoré ; `clos_le` posé
  puis remis à nul ; lieu posé d'après la promo, lieu contraire refusé ; même signalement deux fois refusé (`23505`) ;
  signalement de 13 mois purgé par un stagiaire qui signale (`signaler_probleme`) : lien nul, `issu_signalement` vrai, entrée
  intacte ; compte supprimé : idem ; effacement avant l'échéance : 0 entrée, écriture directe refusée ; après : textes nuls,
  type, origine, dates (dont `date_reponse`) et état gardés, y compris pour une entrée **avec réponse datée** ; entrée effacée
  non modifiable ; effacement refusé hors gestion ; retour qui rend l'empreinte d'avant.
  Les entrées closes il y a plus de 3 ans se préparent avec `set local session_replication_role = replica` (déclencheur
  muet le temps de l'insertion, en superutilisateur local), puis `origin` avant les cas.
- [ ] **Étape 2 :** migration et retour. **Étape 3 :** VERT en local trois fois, puis base où la migration est appliquée.
- [ ] **Étape 4 : contre-épreuves**, chacune ROUGE sur ses seuls cas : règle de lecture `using (true)` ; droit `delete` accordé ;
  garde de la mise à nul du lien retirée ; condition de l'échéance retirée ; corps de `peut_gerer_qualite()` remplacé par
  `select fondateur_reel()` (comme la contre-épreuve 8 de Q3 : l'aperçu ne retire plus le droit). Résultats et empreintes
  notés en tête de la preuve, comme Q3.
- [ ] **Étape 5 : commit** « Registre qualité : migration, retour et preuve (non appliquée) ». Rien en production.

### Tâche 3 : accès depuis l'app et banc

**Fichiers :** modifier `js/db.js` ; `_harness_supabase.js` hors dépôt (recopié par `outils/parcours/banc.py` depuis
`C:\Users\watch\Dev\ECSR\TP_ECSR_App`, qui doit porter la simulation Q3 reportée à la fusion de Q3 ; si elle manque, la
reporter d'abord depuis `C:\Users\watch\Dev\ecsr-promo-qualiopi-q3`, sans écraser le reste ; modification décrite dans le rapport).

**Interfaces :** `lireRegistreQualite()` → entrées (colonnes nommées, lues par `toutesLesLignes`, triées sur `id`) ou `null` si
`tableAbsente` ; `ajouterEntreeRegistre(champs)` → entrée ; `modifierEntreeRegistre(id, champs)` → entrée, `.select()` demandé et
échec « Cette entrée n'a pas pu être enregistrée. Actualise la page et réessaie. » si aucune ligne ne revient (la RLS refuse une
modification sans erreur, comme `supprimerSignalementApp`) ; `effacerRegistreQualite()` → nombre ; `liensRegistre()` → `Set`
des `signalement_id`, ou `null` si la table manque. Erreurs par `messageErreurRegistre`. Banc : `FIXTURES.registre_qualite`,
`?registre=1` sème six entrées (chaque type, une close il y a plus de 3 ans, une issue du signalement 101) ; hors fondateur
hors aperçu : lecture vide, insertion en erreur `42501`, modification à 0 ligne sans erreur ; doublon de signalement en
`23505` ; fonction `effacer_registre_qualite` simulée.
- [ ] **Étapes** : `node --check js/db.js`, suite verte, commit « Registre qualité : lecture et écriture ».

### Tâche 4 : sous-onglet « Registre qualité » et fenêtre de saisie

**Fichiers :** créer `js/registre-fenetre.js` (fenêtre), `js/views/registre-qualite.js` (panneau) ; modifier
`js/nav-fenetre.js` (option `avantFermeture`), `js/views/qualiopi.js` (sous-onglets, rappel d'effacement, lecture du registre),
`css/qualiopi.css` (chargé partout : la fenêtre sert aussi en tâche 5) ; tests `tests/registre-page.test.mjs` (câblage, modèle de
`tests/qualiopi-questionnaires-page.test.mjs`) ; ajuster `tests/qualiopi-questionnaires-page.test.mjs` (ligne 27,
`corps.append(...)`), `tests/qualiopi-page.test.mjs` et `tests/qualiopi-satisfaction.test.mjs` (ligne 235) si leurs motifs
changent.

**Interfaces :**
- `ouvrirFenetre({ ..., avantFermeture })` : fonction facultative, appelée par « Fermer », le voile et Échap seulement ;
  `false` garde la fenêtre. Au changement d'adresse (`hashchange`, `js/nav-fenetre.js:61-68`, la page a déjà changé) et à
  une fermeture par le programme (la barre qui se remonte, `js/nav-shell.js:169` et `:566`), la fenêtre se ferme sans
  demander : limite connue, écrite dans `PROJECT_NOTES.md`. Sans l'option, rien ne change pour les fenêtres existantes.
- `ouvrirFenetreRegistre({ entree?, prerempli?, promos, ancre, surEnregistre(entree) })` : une fenêtre courte ; type en cinq
  boutons qui passent à la ligne à 375 px, date (aujourd'hui par défaut), origine, promo (« Aucune ») et, sans promo, centre
  (« Tout l'organisme » ou un lieu, d'après `getMesPromos()`), description avec « Ne nomme personne » juste dessous, puis
  repliés « Réponse et suite » : réponse (la date du jour se pose quand une réponse est tapée sans date), date de réponse,
  action décidée, mesure de prévention (risque seulement), état. `RAPPEL_VIOLENCES` en tête. Erreurs de `validerEntree` sous
  chaque champ. Saisie modifiée puis fermeture : `confirm("Fermer sans enregistrer ?")`.
- `renderRegistreQualite(panneau, { lire, surChangement })` : tout l'organisme (le choix de promo de la page ne le filtre pas,
  et le panneau le dit) ; filtres état (Tous, Ouverts, En cours, Clos) et type ; « Ajouter » ; une carte par entrée (type, date,
  origine, promo ou centre, état, description en trois lignes, délai de réponse) ; toucher une carte ouvre la fenêtre en
  modification, sauf entrée effacée (carte en lecture seule, « Textes effacés le … ») ; « Exporter (CSV) » de la liste filtrée ;
  quand `aEffacer` n'est pas vide, « Effacer les textes » (confirmation). Table absente : « Le registre sera disponible après
  la mise à jour de la base. »
- Page Qualiopi : sous l'en-tête et le choix de promo, `renderSubTabs([{ key: "inventaire", label: "Inventaire et documents" },
  { key: "registre", label: "Registre qualité" }], { storageKey: "qualiopi.subtab" })`. `renderSubTabs` vide le panneau à chaque
  bascule : l'onglet Inventaire y remet **le même nœud `corps`** (créé une fois, rempli par `charger()` en asynchrone), sans
  relancer `charger()`. Le registre est lu une fois par rendu de page (`etat.registre` : `{ etat: "lue", entrees } | { etat:
  "absente" } | { etat: "non_lue" }`, même forme que la satisfaction), relu après chaque `surEnregistre` et chaque effacement,
  puis `recalculerInventaire()`. En tête de page, quel que soit l'onglet : « N entrées du registre à effacer » et « N entrées à
  clore » (point 3) quand il y en a.
- [ ] **Étapes** : tests de câblage (deux sous-onglets, `corps` remis sans `charger()`, rappel présent, « Ne nomme personne »,
  export appelle `registreCsv`, carte effacée sans ouverture, `avantFermeture` branché sur Échap et le voile, aucun U+2014),
  code, suite verte, contrôle au banc 375 px et 1 280 px (aucun défilement de côté, cibles de 44 px, boutons de type sur deux
  lignes, focus et Échap), commit « Registre qualité : page et fenêtre ».

### Tâche 5 : « Ajouter au registre » depuis un signalement

**Fichiers :** modifier `js/views/problemes.js` ; test de câblage dans `tests/registre-page.test.mjs`.
**Comportement :** `liensRegistre()` est lu une fois au rendu de la page, en même temps que `listSignalementsApp()`, dans un
`Set` partagé par les trois sous-onglets (À traiter, Réglés, Tous redessinent les cartes depuis la même liste). Sur chaque carte,
« Ajouter au registre » ouvre `ouvrirFenetreRegistre` (import à la demande) avec `entreeDepuisSignalement(s)` ; la promo du
signalement est présélectionnée, rien du nom ni de l'adresse, et le rappel « Ne nomme personne » reste sous la description
préremplie. Après l'enregistrement, l'id entre dans le `Set` et le bouton devient « Au registre » inactif, dans tous les
sous-onglets. `liensRegistre()` nul (table absente) : pas de bouton.
- [ ] **Étapes** : test (préremplissage sans `nom` ni `email`, bouton absent quand `liensRegistre()` est nul, un seul `Set` pour
  les trois sous-onglets), code, vert, commit « Registre qualité : depuis un signalement ».

### Tâche 6 : branchements inventaire et dossiers (indicateurs 31 et 32)

**Fichiers :** modifier `js/qualiopi-preuves.js`, `js/qualiopi-documents.js`, `js/views/qualiopi.js` et leurs tests
(`tests/qualiopi-preuves.test.mjs`, `tests/qualiopi-documents.test.mjs`, `tests/qualiopi-satisfaction.test.mjs`).
**Comportement :**
- `donnees.registre` (forme de la tâche 4) : injecté par la page au calcul, `{ ...donnees, registre: etat.registre }`, pour la
  promo affichée comme pour les promos du centre (`lirePromosDuCentre`) ; les lectures gardées par promo ne le contiennent pas,
  si bien qu'une relecture du registre suffit à refaire l'inventaire.
- Nouvelle pièce `{ cle: "registre", libelle: "Registre qualité", indicateurs: [31, 32] }` (15 pièces ; le commentaire « 13
  pièces » et le test « 14 pièces » se corrigent). Présente si `entreesPourPromo` n'est pas vide : « N entrées (décompte par
  type), dont M closes ; délai médian de réponse : X jours ». Absente : « aucune entrée au registre qualité pendant la
  formation », « registre qualité pas encore en service » (`absente`), « registre qualité non lu (erreur de lecture) »
  (`non_lue`).
- `NIVEAUX` 31 et 32 : `apporte` gagne « registre qualité », `ajout` nul ; niveau `partiel` gardé.
- `modeleDossierCentre({ promos, lieu, lieuId, periode, aujourdhui, sansNoms, nouveautes = [], registre = { etat: "non_lue" } })` :
  `lieuId` (identifiant du centre, `lieu` restant le nom affiché) sert à `entreesPourCentre`, pour garder les entrées du lieu
  et de tout l'organisme même sans promo dans la période ; section « Amélioration continue » (`SERVICE_CENTRE` : 31 y
  entre), lue **uniquement** depuis ce paramètre `registre` (jamais depuis `donnees.registre` des promos, qui ne sert qu'à
  l'inventaire et au dossier de la formation) ;
  `modeleDossierFormation` lit `donnees.registre` dans « Difficultés et signalements traités ». Les deux : décompte par type et
  par état, délai médian, puis une ligne par entrée sans texte libre (point 5) ; dossier du centre « sans aucun nom » : les
  nombres seulement.
- [ ] **Étapes** : tests (pièce présente, `absente`, `non_lue` ; aucune description ni action dans l'inventaire et les deux
  dossiers ; sans noms sans ligne par entrée ; entrée effacée comptée), code, vert, commit « Qualiopi : registre dans
  l'inventaire et les dossiers ».

### Tâche 7 : banc, robot, preuves et notes

- [ ] **Étape 1 : robot** : `outils/parcours/navigation.py` gagne la destination « Qualiopi » (Indicateurs, puis « Qualiopi ») ;
  `outils/parcours/equipe.py` gagne `registre-qualite` (fondateur, `banc={"registre": "1"}` : sous-onglet, filtre « Clos »,
  ajout d'une amélioration ; pour l'export, le robot ne gère pas les téléchargements : il vérifie seulement que « Exporter
  (CSV) » est présent et actif, le contenu étant prouvé par les tests de `registreCsv`) et `ajouter-au-registre` (fondateur,
  `banc={"signalements": "1", "registre": "1"}`) ; un parcours formateur vérifie l'absence du bouton « Qualiopi ».
  `python outils/robot_parcours.py` : code 0, Chromium et WebKit.
- [ ] **Étape 2 : refus** : au banc, `?role=formateur` et `?role=stagiaire` sur `#/qualiopi` reviennent à l'accueil, sans
  `.registre` ni bouton « Ajouter au registre » ; `python outils/verifier_navigation.py` sans échec propre à la branche.
- [ ] **Étape 3 :** suite node complète (`node --test tests/`) ; preuve SQL rejouée ; contrôle U+2014 sur tous les fichiers
  touchés (Python, `chr(0x2014)`).
- [ ] **Étape 4 :** `PROJECT_NOTES.md`, section « Registre qualité (Qualiopi Q4) » (droits, lien qui tombe à nul, effacement
  manuel à 3 ans, banc `?registre=1`, ce qui attend Timy) ; commit « Registre qualité : notes de projet ».
- [ ] **Étape 5 : à Timy** : points à valider, migration, preuve et retour. Avec son accord seulement : application, contrôle sur
  la base réelle (table vide, règles présentes, `peut_gerer_qualite()` inchangée), fusion et poussée.
- [ ] **Étape 6 : banc du dépôt principal**, au moment de la fusion : reporter la section « Registre qualité » et le levier
  `?registre=1` dans `C:\Users\watch\Dev\ECSR\TP_ECSR_App\_harness_supabase.js` par ajout (jamais en écrasant le fichier), puis
  rejouer le robot depuis `main`.
