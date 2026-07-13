# Spec — Outil EPCF (évaluations en cours de formation) — Lot 1

**Date** : 2026-07-13 · **Deadline lot 1 : livré avant le 20/07/2026** (EPCF du 20 au 23 juillet)
**Source** : mail Hocine du 09/07/2026 « Critères d'évaluation CCP1 » + pièce jointe
`Criteres d'évaluation salle et voiture EPCF CCP 1.xlsx` (2 feuilles : Evaluation Salle, Evaluation Véhicule).

## 1. Contexte et objectif

Les EPCF sont des examens blancs passés en cours de formation. Ceux du 20-23 juillet (CCP1)
**font foi devant le jury le jour de l'examen** : en cas de difficulté d'un candidat sur une
compétence, le jury peut consulter ses EPCF pour vérifier si l'erreur était récurrente.

L'outil doit :
- permettre aux **formateurs** de remplir la grille directement dans l'app ;
- restituer au **stagiaire concerné** (et à lui seul) ses résultats sous forme de
  **radar** comparant sa note à la **moyenne du groupe** — 2 radars distincts (salle / véhicule) ;
- donner aux formateurs une **vue classe** (moyennes par phase/critère) comme outil d'aide à la décision ;
- être **générique** : le même outil resservira pour l'auto-évaluation des stagiaires et
  pour des passages ultérieurs (salle/voiture), afin de constituer un historique de progression.

Décisions actées avec l'utilisateur (13/07) :
- Architecture **générique réutilisable** (table unique + trames en config JS versionnées).
- Axes des radars = **les phases de la grille** (pas les 25-28 critères — illisible ; le
  détail par critère est affiché sous le radar).
- Saisie dans un **onglet « EPCF »** réservé profs/admin ; restitution stagiaire dans **Mon suivi**.
- Lot 1 = base seule. Auto-éval, superposition historique et export PDF jury = lot 2.
- Dans Mon suivi : la section « Mes souhaits de compétences (permis B) » est **retirée**
  (l'EPCF la remplace comme outil de suivi personnalisé) ; le champ « Mes besoins du
  moment » est **conservé** (parole de l'élève, complémentaire du regard formateur).

## 2. Les trames (contenu officiel de la grille d'Hocine)

Notation par critère : **A = Acquis · R = À renforcer · NA = Non acquis**.
Numérisation pour les agrégats : A=2, R=1, NA=0 (score de phase = moyenne des critères
renseignés, exprimée en %).

### Trame SALLE — compétences TP : C1, C2, C4, C6 — 25 critères, 5 phases

**Phase PREP — Préparation (de X minutes)** — TP 1 « Construire et préparer le scénario d'une séance collective de formation »
- PREP1 · Les objectifs sont ciblés pour des élèves conducteurs.
- PREP2 · Une hiérarchie des objectifs est établie suivant le parcours des élèves.
- PREP3 · Les contenus sont adaptés aux objectifs définis.
- PREP4 · Les animations prévues sont cohérentes avec les différents objectifs.
- PREP5 · Les différents temps de la séance sont organisés.

**Phase ANIM — Cours, explication, application** — TP 2 « Animer une séance collective de formation à la sécurité routière »
- ANIM1 · Le plan est en lien avec l'objectif.
- ANIM2 · Utilise-t-il les connaissances des élèves ?
- ANIM3 · Méthodes et outils pédagogiques sont utilisés.
- ANIM4 · Les contenus sont maîtrisés.
- ANIM5 · Donne-t-il du sens à la règle ?
- ANIM6 · Communication positive (facilitant / confiance).
- ANIM7 · La durée de la séance est respectée.

**Phase EVAL — Évaluation générale statique · Évaluation spécifique statique · Évaluation finale** — TP 4 « Évaluer le degré d'acquisition des compétences des apprenants »
- EVAL1 · Explique-t-il l'intérêt de l'évaluation ?
- EVAL2 · Cherche-t-il à connaître les élèves ?
- EVAL3 · L'évaluation est-elle en lien avec le thème / REMC ?
- EVAL4 · La restitution des résultats permet l'auto-évaluation et l'auto-réflexion ?
- EVAL5 · L'explication des résultats est claire pour les élèves.
- EVAL6 · Les critères de l'évaluation finale sont déterminés.
- EVAL7 · L'évaluation finale est réalisable.

**Phase BILEV — Bilan des évaluations · Détermination de l'objectif** — TP 6 « Repérer les difficultés d'apprentissage et essayer d'y remédier »
- BILEV1 · Repérer les difficultés d'apprentissage particulières des élèves.
- BILEV2 · Identifier les difficultés d'apprentissage particulières des élèves.
- BILEV3 · L'objectif déterminé correspond aux difficultés d'apprentissage.
- BILEV4 · L'intérêt de l'objectif choisi est expliqué aux élèves.

**Phase BILAN — Bilan final**
- BILAN1 · Une restitution du message de sécurité routière est évoquée.
- BILAN2 · Une projection pour une prochaine séance est proposée (livret).

Méta salle : date, **thème**, durée, commentaire global, **compétences acquises** (cases C1, C2, C4, C6).

### Trame VÉHICULE — compétences TP : C3, C4, C6, C7 — 28 critères, 5 phases

**Phase COND — Explication, démonstration, guidage, autonomie, répétition** — TP 3 « Animer une séance individuelle de formation à la conduite d'un véhicule léger »
- COND1 · L'objectif est-il respecté ? Les modifications sont-elles justifiées ?
- COND2 · Les choix d'itinéraire sont réalisables en fonction des impératifs.
- COND3 · Les techniques pédagogiques sont adaptées à la conduite (démo…).
- COND4 · Les interventions sont pertinentes et motivées.
- COND5 · Les contenus et procédures sont maîtrisés.
- COND6 · Communication positive (facilitant / confiance / rassurant).
- COND7 · La durée de la séance est respectée.
- COND8 · La sécurité pour tous est assurée.

**Phase EVAL — Évaluations statiques · Évaluation finale** — TP 4 (idem salle)
- EVAL1 · Explique-t-il l'intérêt de l'évaluation ?
- EVAL2 · Cherche-t-il à connaître l'apprenant ?
- EVAL3 · L'évaluation est-elle en lien avec l'objectif / livret ?
- EVAL4 · Le contexte d'évaluation est-il propice aux capacités de l'apprenant ?
- EVAL5 · La restitution des résultats permet l'auto-évaluation et l'auto-réflexion ?
- EVAL6 · Les critères de l'évaluation finale sont déterminés.
- EVAL7 · L'évaluation finale est réalisable.

**Phase BILEV — Bilan des évaluations · Détermination de l'objectif** — TP 6
- BILEV1 · Repérer les difficultés d'apprentissage particulières de l'élève.
- BILEV2 · Identifier les difficultés d'apprentissage particulières de l'élève.
- BILEV3 · L'objectif déterminé correspond aux difficultés d'apprentissage.
- BILEV4 · L'intérêt de l'objectif choisi est expliqué à l'élève.
- BILEV5 · Communication positive (empathie / écoute / posture professionnelle).

**Phase BILAN — Bilan final**
- BILAN1 · Une restitution du message de sécurité routière est évoquée.
- BILAN2 · Une projection pour une prochaine séance est proposée (livret).

**Phase PERC — Conduite commentée, guidage, démonstration** — TP 7 « Apprécier la dynamique de l'environnement routier et identifier les risques potentiels »
- PERC1 · La prise d'information est riche et variée (CAHLLM).
- PERC2 · Les indices sont triés.
- PERC3 · Les indices sont hiérarchisés.
- PERC4 · Les prévisions sont pertinentes (risques).
- PERC5 · Les indices sont pris en compte pour anticiper le comportement de l'apprenant.
- PERC6 · Les indices sont partagés et analysés avec l'apprenant.

Méta véhicule : date, **niveau de l'élève cobaye**, durée, commentaire global,
**compétences acquises** (cases C3, C4, C6, C7).

Notes de fidélité : BILEV1/BILEV2 (« Repérer » / « Identifier ») sont quasi identiques
dans le document source — conservés tels quels (fidélité à la grille officielle).
La « date de naissance » du document papier n'est pas stockée (identité gérée par l'app) ;
elle sera ajoutée à l'export PDF jury (lot 2) si nécessaire.

## 3. Modèle de données

### Config JS — `js/epcf-trames.js` (nouveau)

`EPCF_TRAMES = { salle: {...}, vehicule: {...} }`. Chaque trame : `version` (int, =1),
`label`, `competences` (cases « compétences acquises »), `metaFields` (déclaration des
champs méta spécifiques), `sections[]` avec `{ code, titre, competenceTP, criteres: [{ code, libelle }] }`.
Les codes critères sont **stables et uniques par trame** (clé des `scores`).
Évolution de la grille → nouvelle version dans le fichier ; le rendu retrouve la
définition par `(trame, trame_version)` ; les anciennes évals restent affichables.

### Table `epcf_evaluations` (migration Supabase)

```sql
create table epcf_evaluations (
  id bigint generated always as identity primary key,
  stagiaire_id bigint not null references stagiaires(id) on delete cascade,
  trame text not null check (trame in ('salle','vehicule')),
  trame_version int not null default 1,
  date_eval date not null default current_date,
  evaluateur_prof_id bigint references profs(id),
  auto_eval boolean not null default false,
  contexte text not null default 'EPCF',
  meta jsonb not null default '{}',                 -- {theme|niveau_eleve, duree}
  scores jsonb not null default '{}',               -- {"PREP1":"A"|"R"|"NA", ...}
  competences_acquises jsonb not null default '[]', -- ["C1","C4"]
  commentaire text,
  created_by uuid default auth.uid(),
  updated_by_who text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Pas de contrainte d'unicité (stagiaire, trame) : plusieurs évals par stagiaire et par
trame sont **voulues** (historique). Pas de table d'audit au lot 1.

## 4. Sécurité / RLS (stricte — une première dans l'app)

Helpers SQL (SECURITY DEFINER, même façon que `is_admin()` existant) :
- `my_stagiaire_id()` → `user_profiles.stagiaire_id` de `auth.uid()` (null sinon).
- `is_prof()` → `user_profiles.role = 'prof'` pour `auth.uid()`.

Policies sur `epcf_evaluations` :
- **SELECT** : `is_admin() OR is_prof() OR stagiaire_id = my_stagiaire_id()`.
- **INSERT / UPDATE / DELETE** : `is_admin() OR is_prof()`.
  (Lot 2 : INSERT/UPDATE stagiaire autorisés uniquement si `auto_eval = true`
  et `stagiaire_id = my_stagiaire_id()`.)

**Moyenne du groupe** — RPC `epcf_moyennes(p_trame text)` SECURITY DEFINER :
renvoie, par code critère, la moyenne numérique (A=2/R=1/NA=0) et l'effectif, calculée
sur la **dernière éval** (`date_eval` max puis `id` max) **de chaque stagiaire** pour la
trame et le contexte 'EPCF'. Aucune donnée individuelle n'est exposée ; accessible à
tout utilisateur authentifié. Les moyennes par phase sont recomposées côté client à
partir des moyennes par critère.

État des lieux assumé : le reste de l'app garde ses policies ouvertes (backlog RGPD) ;
cette table introduit le pattern strict qui servira de référence.

## 5. UI

### Onglet « EPCF » — visible profs/admin uniquement (`isProf() || isAdmin()`)

1. **Liste** : tableau des stagiaires actifs × 2 trames, statut (« évalué le JJ/MM » /
   « à évaluer »), boutons Évaluer / Modifier (modifier = rouvrir la dernière éval ;
   « Nouvelle évaluation » possible même si une existe déjà).
2. **Formulaire de saisie** : méta (date, thème ou niveau élève cobaye, durée),
   sections dépliées avec 3 boutons segmentés **A / R / NA** par critère (état
   « non renseigné » par défaut, re-cliquer désélectionne), cases compétences acquises,
   commentaire global, évaluateur pré-rempli avec le prof connecté (`prof_id` du profil),
   modifiable. Sauvegarde en une fois ; bouton désactivé pendant l'enregistrement
   (pattern anti-race de mon-suivi). Éval sans aucun critère renseigné → refusée.
3. **Vue classe** : pour une trame donnée, moyennes de classe par phase et par critère
   (tableau, avec code couleur A/R/NA) — basée sur la même logique « dernière éval par
   stagiaire ». Outil d'aide à la décision pour ajuster les contenus de formation.

### Mon suivi — restitution stagiaire (+ sélecteur admin existant)

Nouvelle section « **Mes EPCF** » (entre les passages à venir et l'historique voiture) :
- **2 radars SVG maison** (pattern du graphe existant, pas de lib externe) : salle et
  véhicule. Axes = les 5 phases de la trame. 2 séries : stagiaire (trait plein, aplat
  léger) vs moyenne groupe (pointillé). Échelle 0-100 %.
- Sous chaque radar : **détail par critère** (chips colorées Acquis / À renforcer /
  Non acquis — palette c-go / ambre C98A2B / c-stop déjà utilisée), compétences acquises,
  commentaire du formateur, date et évaluateur.
- **Historique** : si plusieurs évals pour une trame, sélecteur de date (le radar et le
  détail affichent l'éval choisie ; par défaut la plus récente). La superposition de
  plusieurs évals sur un même radar = lot 2.
- Si aucune éval : message neutre (« Pas encore d'évaluation EPCF »).
- Si moins de 2 stagiaires dans la moyenne groupe : série groupe masquée.

### Modifications de Mon suivi (même lot)

- **Retrait** de la section « Mes souhaits de compétences (permis B) » (les checkboxes
  REMC). Le champ « **Mes besoins du moment** » (textarea) est **conservé**, avec son
  bouton d'enregistrement (libellé ajusté : « Enregistrer mes besoins »).
- Avant retrait, vérifier qu'aucune autre vue ne consomme `fiches_suivi.souhaits`
  (la vue Bénévoles / placement auto notamment). La colonne DB et les données restent
  en place — retrait purement UI.

## 6. Accès aux données (db.js)

Nouvelles fonctions : `listEpcf(filters)` (RLS filtre naturellement pour un stagiaire),
`upsertEpcf(evaluation)` (insert ou update par `id`), `getEpcfMoyennes(trame)` (RPC).

## 7. Cas limites

- Critères non renseignés : exclus des moyennes (pas comptés comme 0).
- Éval vide (0 critère renseigné) : refusée à la sauvegarde avec message.
- Stagiaire hors effectif (Tatiana) : apparaît dans la liste formateur tant qu'elle est
  dans `stagiaires` — pas de traitement spécial au lot 1.
- Le « Voir en tant que » fondateur ne simule PAS la RLS (UI seulement) : la
  confidentialité doit être testée avec un vrai compte stagiaire.

## 8. Vérification (lot 1)

- `node --check` sur tous les fichiers JS modifiés + graphe d'imports navigateur.
- Vérif SQL read-only : policies posées, RPC exécutable, agrégat témoin cohérent.
- Test RLS réel : avec un compte stagiaire, vérifier qu'il ne lit que ses évals et que
  la RPC ne renvoie que des agrégats.
- Smoke test navigateur (harnais local mock db) : rendu radar + formulaire + vue classe.

## 9. Hors périmètre (lot 2 et plus)

- Auto-évaluation stagiaire (même grille, flag `auto_eval`, comparaison formateur vs auto).
- Superposition historique sur un même radar (progression dans le temps).
- Export PDF A4 fidèle au document papier (pour le jury) — le modèle de données du
  lot 1 capture déjà tout le nécessaire.
- Usages hors EPCF via `contexte` (passages salle/voiture ultérieurs).
- Éditeur de trames en base.
