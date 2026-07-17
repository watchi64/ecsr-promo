# Spec — Fiche « souhaits de compétences » + historique voiture dans Mon suivi

**Date** : 2026-07-12
**Statut** : validé (brainstorming), prêt pour plan
**Périmètre** : app `TP_ECSR_App` (vanilla JS + Supabase `crpduennbqaemhfaywrz`)

## Contexte

Une fiche « souhaits de compétences (permis B) + besoins + historique voiture » avait été
développée sur la branche **`lot3-suivi-placement`** (`js/views/suivi.js`, commit `6b68627`),
**jamais mergée**. Entre-temps, un autre « Mon suivi » (passages à venir + graphique
d'évolution, `js/views/mon-suivi.js`) a été construit et **déployé** sur `main`. On a donc
deux onglets « Mon suivi » concurrents, dont un seul est en ligne.

Objectif : **rapatrier la fiche « souhaits de compétences » et l'« historique voiture »**
dans le « Mon suivi » **live** (`mon-suivi.js`), pour n'avoir qu'un seul espace personnel.

## Décisions actées (brainstorming)

| Question | Décision |
|----------|----------|
| Où vit la fiche ? | **Fusion dans le `mon-suivi.js` live** (un seul onglet) |
| Besoins | **Aucun** (YAGNI) — on ne garde que les **souhaits** (cases à cocher) + historique |
| Périmètre lot3 | Fiche (souhaits) **+ historique voiture** ; **pas** le reste (migration passages déjà en prod, placement v2, « vider placements », liste admin séparée) |
| Admin | Réutilise le **sélecteur d'élève déjà présent** dans `mon-suivi.js` (pas de liste admin dédiée) |
| Migration | **Aucune** (le backend existe déjà en prod) |
| Vocabulaire UI | « compétences du permis B (C1–C4) », **pas** « REMC » |

## État du backend (vérifié en prod le 2026-07-12)

- Table `fiches_suivi` : `stagiaire_id bigint`, `souhaits jsonb NOT NULL default '[]'`,
  `besoins text` (nullable), `updated_at timestamptz`, `updated_by_who text`.
  **RLS activée**, policies CRUD pour `authenticated`. **⚠️ 13 lignes déjà présentes.**
- `passages.prof_id` et `passages.avec_eleve` existent (historique voiture alimenté).
- Table `competences` existe. `COMPETENCES_REMC` (C1–C4 + sous-compétences) est défini
  dans `js/views/benevoles.js` sur `main` (constante `const`, **non exportée**).

**Conséquence :** aucune DDL. La seule contrainte est de **préserver les 13 fiches**
existantes → l'écriture ne doit jamais écraser la colonne `besoins`.

## Conception

### 1. `js/db.js` — porter 3 fonctions (absentes de `main`)

Copiées de `6b68627`, avec le token de cache-bust courant de `main` :

- `listFiches()` → `select *` de `fiches_suivi`.
- `getVoitureAggregats()` → agrège les passages Voiture par stagiaire :
  `{ [stagiaire_id]: { total, avecEleve, byProf: { [prof_id]: n } } }`
  (ignore résultats `Absence`/`Report`).
- `upsertFiche({ stagiaire_id, souhaits, updated_by_who })` → upsert `onConflict:"stagiaire_id"`
  **n'écrivant que `souhaits` (+ `updated_by_who`, `updated_at`)**. On **n'inclut pas** `besoins`
  dans le payload : l'upsert PostgREST ne met à jour que les colonnes fournies → les `besoins`
  des 13 fiches existantes sont préservés. (Variante volontairement différente de lot3, qui
  écrivait `besoins`.)

`listProfs()` existe déjà sur `main` (réutilisé pour les noms de formateurs).

### 2. `js/views/benevoles.js` — exporter la constante

`const COMPETENCES_REMC` → `export const COMPETENCES_REMC` (seul changement). `mon-suivi.js`
l'importe (même approche que `suivi.js` de lot3).

### 3. `js/views/mon-suivi.js` — ajouter 2 sections

Nouveaux imports : `listFiches, upsertFiche, getVoitureAggregats, listProfs` (db),
`toast` (utils), `getCurrentWho` (identity), `COMPETENCES_REMC` (benevoles).

État chargé une fois au rendu (indépendant de l'élève, donc partagé) : `fiches`,
`aggregats`, `profs`.

Deux sections ajoutées, rendues **par élève sélectionné** :

- **Mes souhaits de compétences (permis B, C1–C4)** — accordéon `<details>` : une compétence
  par bloc, case principale (C1…C4) + cases des sous-compétences (C1.1…). Coché = présent dans
  `souhaits`. Bouton **« Enregistrer mes souhaits »** → `upsertFiche` + `toast` + refetch + re-render.
- **Historique voiture** (lecture seule) — `aggregats[id]` : « N passage(s) · dont M avec élève »
  + ligne « Formateurs : Nom ×k · … » (noms via `profs`). Si pas de données : compteurs à 0.

**Ordre final des sections** dans l'onglet : Passages à venir → **Ma fiche (souhaits)** →
Historique voiture → Graphique d'évolution.

Le **sélecteur d'élève** existant sert aussi à l'admin pour éditer la fiche d'un élève :
au changement de sélection, `renderFor(id)` re-rend les 4 sections pour ce stagiaire.

### 4. `css/style.css` — porter les styles `.suivi-*`

`.suivi-histo`, `.suivi-comp`, `.suivi-comp summary`, `.suivi-souscomp` (depuis `6b68627`).
Pas besoin des styles `.suivi-editor textarea` (pas de besoins) ni `.suivi-admin-list`/
`.suivi-card*` (pas de liste admin).

## Critères d'acceptation

- Un stagiaire ouvre « Mon suivi » : sous ses passages, il voit **ses souhaits** (préremplis
  depuis sa fiche), peut cocher/décocher et **enregistrer** ; un `toast` confirme ; au rechargement
  les souhaits sont persistés.
- La section **Historique voiture** affiche ses compteurs (total, avec élève, formateurs).
- Un **admin** change d'élève via le sélecteur → les souhaits + l'historique + le graphique
  se mettent à jour pour cet élève ; il peut éditer et enregistrer la fiche de l'élève choisi.
- **Les 13 fiches existantes ne perdent pas leur `besoins`** après un enregistrement de souhaits.
- 0 erreur console ; libellés « permis B (C1–C4) », jamais « REMC ».

## Hors périmètre (YAGNI)

- Champ **besoins** sous toute forme (global ou par compétence).
- Reste du lot3 : placement v2, bouton « vider les placements », migration `passages`
  (déjà en prod), liste/cartes admin de `suivi.js`.

## Risques / points d'attention

- **Ne pas écraser `besoins`** : `upsertFiche` n'envoie que `souhaits` (voir §1).
- **Collision lot3** : `suivi.js` de `lot3-suivi-placement` devient redondant. Quand lot3 sera
  traité, son onglet « Mon suivi » (fichier `suivi.js` + sa route/onglet) devra être abandonné
  au profit du `mon-suivi.js` unifié, sinon deux onglets « Mon suivi ». **Suite non bloquante.**
- **Cache-bust** : tous les imports de `mon-suivi.js` utilisent `?v=20260712f`. Utiliser ce
  **même token** pour les nouveaux imports ; au déploiement, suivre la convention du projet.
- `getVoitureAggregats` s'appuie sur `avec_eleve`/`prof_id` : `null` pour d'anciens passages
  → « avec élève » peut sous-compter (dégradation acceptable, pas d'erreur).
- **Dépôt partagé** : implémenter dans un **worktree dédié** sur `main`.
