# Dossier Qualiopi, lot Q3 : questionnaires anonymes, plan de mise en œuvre

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans, tâche par tâche. Les étapes se cochent (`- [ ]`).

**But :** les stagiaires (fin de formation, puis 6 mois après) et les formateurs (par centre et par année) répondent dans
l'app à un questionnaire anonyme par construction ; la satisfaction remplit la fiche résultats et les dossiers Qualiopi.

**Architecture :** règles pures testées en node (`js/questionnaires-data.js`, `js/questionnaires-rules.js`) ; base : trois
tables sans lecture directe des réponses, écriture et lecture par fonctions `security definer` (migration prouvée en SQL, NON
appliquée sans l'accord de Timy) ; un bandeau et une fenêtre de questionnaire côté stagiaire et formateur ; état, ouverture
manuelle et résultats sur la page Qualiopi ; branchements Q3b dans les modules Qualiopi existants.

**Technique :** modules ES sans build, `el()` de `js/utils.js`, Supabase par `js/db.js`, tests `node:assert/strict`,
PostgreSQL et RLS, banc à faux client (`_harness_supabase.js`).

**Spec :** `docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md` (validée par Timy le 08/11/2026), § 3, 4, 7, 8, 10, 11.
Q4 (registre) et Q5 (conservation) ont chacun leur plan, plus tard.

## Contraintes communes

- Aucun tiret cadratin (U+2014) nulle part ; dans un test, `String.fromCharCode(0x2014)` (les outils changent une séquence
  d'échappement en vrai caractère). « Formateur », jamais « prof » à l'écran. Tutoiement à l'écran, documents impersonnels.
- Contraste AA, cibles de 44 px, aucun défilement de côté, jamais une note en rouge ; l'utilisateur au centre, clair et beau.
- Anonymat par construction (spec § 4.3 et § 10) : aucune colonne utilisateur, date ou numéro séquentiel dans les réponses ;
  aucune politique de lecture sur les réponses ; participations sans date ; rien sous le seuil (5 pour les stagiaires, 3 pour
  les formateurs) ; commentaires au seul fondateur, ordre aléatoire, à partir du seuil, jamais dans la version sans noms.
- Droit unique `peut_gerer_qualite()` (vaut `is_founder()` aujourd'hui) pour tout ce qui est réservé à la gestion.
- Base de production : lecture seule pendant la construction ; la migration est écrite, répétée et prouvée en local, puis
  appliquée seulement avec l'accord de Timy, après sa validation du texte des questions et des conditions.
- Jeton `?v=20261108a` (ou celui de `main` au moment de la tâche) sur tout import ; commit local par tâche ; une entrée
  Nouveautés dans le commit qui rend le questionnaire visible (tâche 5).
- Parcours prouvés au banc pour stagiaire, formateur et fondateur, téléphone et ordinateur, Chromium et WebKit.

## Points de vigilance

1. **Recoupement** : une réponse ne doit jamais pouvoir être reliée à une participation (ni par l'ordre, ni par l'heure, ni
   par une jointure). Preuve SQL en tâche 3.
2. **Double réponse et non-ayants droit** : un deuxième envoi, un stagiaire d'une autre promo, un compte hors fenêtre sont
   refusés par la base, pas seulement par l'interface. Preuve SQL en tâche 3.
3. **Nîmes** : `date_fin` le 11/12/2026, fenêtre ouverte dès le 04/12 ; tout doit être en ligne avant. Le formulaire Google
   reste le secours.
4. **Conditions d'utilisation** : nouvelle version, une seule nouvelle acceptation, texte validé par Timy.
5. **Seuil** : un taux, un compte ou un commentaire n'apparaît jamais sous le seuil, ni à l'écran, ni dans un document, ni
   dans le CSV.

---

### Tâche 1 : contenu des questionnaires et des conditions

**Fichiers :** créer `js/questionnaires-data.js`, `tests/questionnaires-data.test.mjs` ; modifier `js/legal-data.js` ;
créer `docs/superpowers/specs/2026-11-08-qualiopi-q3-textes.md` (les textes à faire valider par Timy, lisibles d'un trait).

**Interfaces :**
- Produit : `QUESTIONNAIRES` : `{ fin_stagiaire, six_mois_stagiaire, fin_formateur }`, chacun `{ cle, public: "stagiaire" |
  "formateur", version: 1, titre, intro, questions: [{ id, texte, type: "echelle" | "choix" | "commentaire", options?,
  facultative, globale? }] }` ; exactement une question `globale: true` par questionnaire (la question « globalement » du
  taux) ; `ECHELLE` : 1 à 4 plus « sans avis » ; `seuilDe(publicCible)` → 5 ou 3.
- Contenu : spec § 4.2 (la formation, pas l'app ; 8 à 10 questions en fin de formation, 4 à 5 à six mois, 6 à 8 pour les
  formateurs ; commentaire facultatif avec la consigne « ne cite personne » ; une question facultative sur l'app en fin de
  formation). Phrases courtes, tutoiement, sans jargon.
- `js/legal-data.js` : nouvelle `VERSION_CONDITIONS` (date du jour de la tâche) et texte qui dit, aux bons endroits : les
  documents de l'app servent au centre devant son certificateur Qualiopi et ses financeurs ; les questionnaires sont anonymes
  (réponse sans nom, sans date, seule la participation est notée) ; la conservation des preuves 3 ans (spec § 6 et § 10, y
  compris les entrées du registre et l'effacement sur demande, § 11.2). La mise en œuvre de Q4 et Q5 viendra ensuite ; le
  texte ne promet rien de plus long que 3 ans.

- [ ] **Étape 1 : tests qui échouent** : trois questionnaires, clés exactes, une seule question globale chacun, nombres de
  questions dans les fourchettes, ids uniques, aucun U+2014, aucun « prof » ; `seuilDe("stagiaire") === 5`,
  `seuilDe("formateur") === 3` ; `tests/legal-rules.test.mjs` reste vert.
- [ ] **Étape 2 :** échec constaté. **Étape 3 :** données, texte des conditions, document des textes. **Étape 4 :** tests verts.
- [ ] **Étape 5 : commit** « Questionnaires : contenu et conditions d'utilisation (à valider par Timy) ».

### Tâche 2 : règles pures

**Fichiers :** créer `js/questionnaires-rules.js`, `tests/questionnaires-rules.test.mjs`.

**Interfaces :**
- Consomme : `QUESTIONNAIRES`, `seuilDe` (tâche 1).
- Produit :
  - `fenetreQuestionnaire(cle, promo)` → `{ du, au }` ou `null` (promo sans `date_fin`) : fin de formation et formateurs, de
    `date_fin` − 7 jours à `date_fin` + 30 jours ; six mois, de `date_fin` + 6 mois à + 7 mois.
  - `estOuvert({ cle, promo, ouverture, aujourdhui })` : `ouverture` = `{ ouvert: boolean } | null` (manuelle, prime dans les
    deux sens), sinon la fenêtre.
  - `porteeFormateur(lieuId, aujourdhui)` → `{ lieu_id, annee }` (année civile).
  - `resultatsAffichables(comptes, publicCible)` → par question `{ id, n, repartition }` ou `{ id, sousSeuil: true }` ;
    `tauxSatisfaction(comptesQuestionGlobale, inscrits)` → `{ taux, repondants, inscrits }` (part des 3 et 4 sur les
    répondants qui ont donné une note ; « sans avis » exclu) ou `null` sous le seuil ;
  - `texteSousSeuil(publicCible)` → « moins de 5 réponses » / « moins de 3 réponses ».
- [ ] **Étapes** : tests (bornes de fenêtre, 31 décembre et changement d'année, promo sans fin, ouverture manuelle dans les deux
  sens, seuil exact 4/5 et 2/3, « sans avis » exclu, aucun NaN), échec, code, vert, commit « Questionnaires : règles ».

### Tâche 3 : migration, retour et preuve SQL

**Fichiers :** créer `supabase/migrations/<date>_questionnaires.sql`, `..._questionnaires_retour.sql`,
`tests/sql/questionnaires-preuve.sql` (et un schéma minimal si la répétition locale en a besoin, sur le modèle de
`tests/sql/signalements-app-schema-minimal.sql`).

**Interfaces (noms laissés au constructeur s'ils restent dans ce rôle) :**
- `peut_gerer_qualite()` ; tables : ouvertures manuelles (`cle`, portée, `ouvert`, qui, quand), participations (`cle`, portée,
  `user_id`, unique, SANS date), réponses (`id uuid` tiré au hasard, `cle`, `version`, portée, `reponses jsonb`,
  `commentaire`, SANS utilisateur ni date) ; portée = `promo_id` pour les stagiaires, `lieu_id` + `annee` pour les formateurs.
- Fonctions : `questionnaires_a_remplir()` (pour la personne connectée : clés, portées, version ; fenêtre et ouverture
  manuelle appliquées comme en tâche 2) ; `repondre_questionnaire(cle, portee, version, reponses, commentaire)` (vérifie
  l'ayant droit, la fenêtre, l'absence de participation, la forme des réponses, puis écrit les deux lignes dans la même
  transaction) ; `resultats_questionnaire(cle, portee)` (comptes par question, rien sous le seuil, droit de gestion) ;
  `commentaires_questionnaire(cle, portee)` (fondateur, ordre aléatoire, à partir du seuil) ; `ouvrir_questionnaire(cle, portee,
  ouvert)` (droit de gestion).
- Ayants droit : stagiaire de la promo (fiche liée au compte, non anonymisée) ; formateur = compte de l'équipe (rôle formateur
  ou admin, non stagiaire) qui a accès à au moins une promo du lieu (décision du contrôleur : la liste `profs` du planning n'est
  pas reliée aux comptes ; à écrire comme écart à la spec § 10).
- [ ] **Étape 1 : preuve qui échoue** sur une base locale (méthode de la mémoire « Répétition de migration dans la preuve SQL » :
  `EXECUTE` de la migration dans le `DO` de preuve, empreintes md5 avant et après, contre-épreuve) : réponse acceptée puis
  deuxième refusée ; autre promo, hors fenêtre, compte sans fiche refusés ; aucune lecture directe des réponses pour aucun
  rôle ; aucune colonne de date ou d'utilisateur dans les réponses ; jointure réponse-participation impossible (aucune clé
  commune hors portée) ; résultats vides sous le seuil, présents au seuil ; commentaires refusés à un formateur ; ouverture
  manuelle refusée à un stagiaire ; retour qui remet la base à l'identique.
- [ ] **Étape 2 :** écrire la migration et le retour ; **Étape 3 :** preuve VERTE en local, sortie dans le rapport.
- [ ] **Étape 4 : commit** « Questionnaires : migration, retour et preuve (non appliquée) ». Ne rien appliquer en production.

### Tâche 4 : accès depuis l'app et banc

**Fichiers :** modifier `js/db.js` ; modifier `_harness_supabase.js` hors dépôt (non versionné, à décrire dans le rapport) pour
simuler les fonctions de la tâche 3.

**Interfaces :** `lireQuestionnairesARemplir()`, `envoyerQuestionnaire({ cle, portee, version, reponses, commentaire })`,
`lireResultatsQuestionnaire(cle, portee)`, `lireCommentairesQuestionnaire(cle, portee)`, `ouvrirQuestionnaire(cle, portee,
ouvert)`. Erreurs de la base rendues en messages lisibles (déjà répondu, fermé, hors délai).
- [ ] **Étapes** : écrire, `node --check`, suite verte, commit « Questionnaires : lecture et envoi ».

### Tâche 5 : bandeau, fenêtre et lien (stagiaires et formateurs)

**Fichiers :** créer `js/questionnaire.js` (fenêtre), `css/questionnaire.css` (lien dans `index.html`) ; modifier la vue d'accueil
et l'accueil de la nouvelle navigation (bandeau visible dans les deux), `js/route-rules.js` et `js/main.js`
(`#/questionnaire/<clé>` ouvre la fenêtre si la personne y a droit, sinon l'accueil avec un message), `js/nouveautes-data.js`
(une entrée « tous »).

**Comportement (spec § 4.4) :** bandeau « Ton avis sur la formation » quand un questionnaire est à remplir ; « Répondre » ouvre la
fenêtre (une question par écran sur téléphone, barre de progression, retour, envoi à la fin) ; « Plus tard » le remet au
lendemain (mémoire locale par compte, comme `js/avis-rules.js`) ; après l'envoi : « Merci, ta réponse est enregistrée sans ton
nom. » ; la fenêtre suit la mécanique de `js/nav-fenetre.js` (focus, Échap, lecteurs d'écran). Le bandeau de l'enquête d'avis du
15/10 n'est pas touché (il s'éteint seul le 30/11).
- [ ] **Étapes** : tests node des règles d'affichage du bandeau, vue, branchements, `node --test`, `verifier_navigation.py` au
  banc, commit « Questionnaires : bandeau, fenêtre et lien » avec l'entrée Nouveautés. Message WhatsApp prêt à coller dans le
  rapport.

### Tâche 6 : page Qualiopi, côté gestion

**Fichiers :** modifier `js/views/qualiopi.js`, `css/qualiopi.css`.
**Comportement :** pour la promo choisie, l'état de chaque questionnaire (ouvert ou fermé, fenêtre, nombre de réponses ou « moins
de N »), bouton « Ouvrir » ou « Fermer » (ouverture manuelle), résultats question par question au-dessus du seuil, commentaires
(fondateur) ; questionnaire des formateurs pour le lieu et l'année. Rien dans la version sans noms qui ne soit agrégé.
- [ ] **Étapes** : tests de câblage, vue, suite verte, commit « Qualiopi : questionnaires côté gestion ».

### Tâche 7 (Q3b) : branchements Qualiopi

**Fichiers :** modifier `js/qualiopi-preuves.js`, `js/qualiopi-documents.js`, `js/qualiopi-resultats.js`, `js/centre-stats.js`
(méthodes de la satisfaction), `js/views/qualiopi.js` et leurs tests.
**Comportement :** nouvelle pièce `appreciations` (indicateurs 30 et 32 ; présente au-dessus du seuil, sinon une raison fixe) ;
`ficheResultats` reçoit la satisfaction `{ taux, repondants, inscrits }` (fin de formation) et l'affiche avec sa méthode
publique ; section « Appréciations » du dossier de la formation et taux par promo dans le dossier du centre ; sous le seuil,
« moins de 5 réponses ». Le niveau fixe de l'indicateur 30 reste celui de l'annexe A (la légende « Apport de l'application »
s'applique).
- [ ] **Étapes** : tests (sous le seuil, au seuil, « sans avis », aucune fuite dans la version sans noms), code, vert, commit
  « Qualiopi : satisfaction et appréciations ».

### Tâche 8 : banc, preuves et notes

- [ ] **Étape 1 :** banc (méthode de la mémoire du banc ; `&questionnaires=1` dans le faux client) : stagiaire de la promo 7 qui
  répond sur téléphone et ordinateur, deuxième réponse refusée, formateur, fondateur qui ouvre, ferme et lit les résultats ;
  375 px, 44 px ; Chromium et WebKit ; `verifier_navigation.py` sans échec propre à la branche.
- [ ] **Étape 2 :** suite node complète ; preuve SQL rejouée.
- [ ] **Étape 3 :** `PROJECT_NOTES.md`, section « Questionnaires » (anonymat, seuils, banc, ce qui attend l'accord de Timy) ;
  commit « Questionnaires : notes de projet ».
- [ ] **Étape 4 : à Timy** : textes des questions et des conditions (document de la tâche 1), migration et preuve. Avec son
  accord seulement : application de la migration, contrôle sur la base réelle, fusion et poussée (fusion et poussée sont
  autorisées pour ce qui est fini et relu, la migration ne l'est pas).
