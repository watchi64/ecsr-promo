# Design — Passages enrichis, fiches de suivi & placement v2

**Date** : 2026-07-10
**Statut** : validé (approche A), en attente de revue finale
**Périmètre** : app TP_ECSR_App (vanilla JS + Supabase `crpduennbqaemhfaywrz`)

## Contexte

Le suivi des passages « pédagogie voiture » de la promo a été reconstitué et validé hors app
(`ECSR/suivi/pedagogie_voiture_2026-07.md`, chiffres validés le 10/07/2026). Objectifs :
1. Injecter cet historique validé dans l'app (source de vérité unique : table `passages`).
2. Ajouter un bouton admin « Vider les placements » sur le planning.
3. Créer un onglet « Mon suivi » : fiche par stagiaire (souhaits de compétences + besoins).
4. Améliorer « Placer la semaine » : équité historique d'exposition aux élèves bénévoles,
   match souhaits × niveau du bénévole, variété des formateurs.

**Dates de référence** : début de formation **30/03/2026** · retour de stage **09/06/2026** ·
la semaine du 06/07 n'est PAS importée (elle sera validée via le planning, test du circuit).

**Vocabulaire** : le référentiel C1→C4 (avec sous-compétences) utilisé partout ici est celui des
**4 compétences du permis B** (livret d'apprentissage) — ne pas l'appeler « REMC » dans l'UI.
C'est le référentiel déjà utilisé pour le `niveau` des bénévoles (`js/views/benevoles.js`,
constante `COMPETENCES_REMC` — libellé interne existant, conservé tel quel dans le code).

---

## Chantier 1 — Migration schéma + import de l'historique

### 1.1 Migration SQL

```sql
ALTER TABLE passages
  ADD COLUMN prof_id    bigint REFERENCES profs(id),
  ADD COLUMN avec_eleve boolean;   -- null = inconnu (historique antérieur)
```

- Les deux colonnes sont nullables : les lignes existantes restent valides, `null` signifie
  « information non connue ».
- Pas de changement RLS sur `passages` (règles existantes conservées).

### 1.2 Import des chiffres validés

Un script SQL dans `ECSR/migration_supabase/` (convention des imports précédents),
avec `origine = 'Import formulaire 07/2026'` sur toutes les lignes créées.

**Idempotence** : le script commence par
`DELETE FROM passages WHERE origine = 'Import formulaire 07/2026';` puis réinsère.
Rejouable sans doublon.

**Par stagiaire actif (13)** :

- **3 passages « forfait avant stage »** : type Voiture, résultat Effectué,
  `prof_id = null`, `avec_eleve = null`, commentaire « Forfait avant stage »,
  dates 30/03, 31/03 et 01/04/2026.
- **N passages post-stage** : type Voiture, résultat Effectué, `prof_id` selon la
  répartition validée, `avec_eleve = true` sur exactement le nombre validé de séances
  avec élève (attribution aux lignes indifférente entre formateurs), `false` sur le reste.
  Dates réparties uniformément sur les jours ouvrés du 09/06 au 04/07/2026,
  au plus un passage voiture par stagiaire et par jour (grain de la table).

**Données à importer** (validées 10/07/2026) :

| Stagiaire | Romain | Raphaël | Hocine | Avec élève | Sans élève |
|-----------|:------:|:-------:|:------:|:----------:|:----------:|
| KESSAL Lorie | 4 | 0 | 1 | 2 | 3 |
| VALDIVIA Timy | 3 | 0 | 1 | 3 | 1 |
| ANKPRA Gaëlle | 3 | 1 | 0 | 2 | 2 |
| ALEXER Audrick-allan | 5 | 0 | 0 | 4 | 1 |
| BLANC Julie | 4 | 1 | 0 | 3 | 2 |
| CHOULET Émilie | 2 | 1 | 0 | 2 | 1 |
| BRUN Gael | 3 | 0 | 0 | 2 | 1 |
| MEDJANI Cassandre | 3 | 2 | 0 | 3 | 2 |
| BLANQUINQUE Valentin | 3 | 0 | 0 | 2 | 1 |
| BAILLY Mickaël | 2 | 1 | 0 | 2 | 1 |
| OULD ABDELKADER Anissa | 3 | 1 | 0 | 1 | 3 |
| RITA (correspondance table `stagiaires` à établir) | 2 | 1 | 0 | 1 | 2 |
| AQUILA Céline | 3 | 1 | 0 | 2 | 2 |

- LOPEZ Tatiana : **rien** (sortie d'effectif).
- Le mapping noms → `stagiaires.id` et Romain/Raphaël/Hocine → `profs.id` est résolu par
  requête au moment de l'écriture du script (pas d'id codé en dur sans vérification).
- Contrôle post-import : requête de vérification qui recalcule les totaux par stagiaire
  et les compare au tableau ci-dessus.

### 1.3 Interaction avec l'existant

Risque : des passages Voiture peuvent déjà exister dans la table sur la période
(validations hebdo passées, saisies manuelles). Avant l'import, le script liste les
passages Voiture existants entre le 30/03 et le 05/07 ; s'il y en a, ils sont présentés
à l'utilisateur pour décision (les supprimer ou ajuster l'import) — pas de suppression
silencieuse de données non issues de l'import.

---

## Chantier 2 — Bouton « Vider les placements » (planning)

- **Emplacement** : barre d'outils du planning, à côté de « Placer la semaine ».
- **Visibilité** : admin uniquement (`isAdmin()`).
- **Action** (semaine affichée uniquement) : pour chaque `planning_entries` de la semaine :
  `pedagogue_id = null`, `pedagogue_id_2 = null`, `eleves_ids = []`, `eleves_ids_2 = []`.
- **Conservé** : `activite`, `prof_ids`/`prof_id`/`prof_autre`, `sujet`, `notes`,
  `benevoles_ids`, `salle_double`, horaires (`planning_half_meta`), jours off.
- **Confirmation** : `confirm()` avec message d'avertissement explicite
  (« Retirer tous les stagiaires placés cette semaine ? Les bénévoles, profs, sujets et
  notes sont conservés. ») — cohérent avec le pattern du re-mélange existant.
- **Undo** : snapshots avant modification + `recordUndo` (même mécanique que
  `autoPlaceWeek`). N'upserte que les cartes réellement modifiées.
- **Feedback** : toast « Placements vidés · Ctrl+Z pour annuler ».

---

## Chantier 3 — Onglet « Mon suivi » (fiches de suivi)

### 3.1 Table `fiches_suivi`

```sql
CREATE TABLE fiches_suivi (
  stagiaire_id   bigint PRIMARY KEY REFERENCES stagiaires(id) ON DELETE CASCADE,
  souhaits       jsonb  NOT NULL DEFAULT '[]',   -- codes ["C2", "C1.5", ...]
  besoins        text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by_who text
);
```

RLS :
- SELECT : tout utilisateur authentifié (cohérent avec le reste de l'app).
- INSERT/UPDATE : admin (`is_admin()`) OU utilisateur dont
  `user_profiles.stagiaire_id = fiches_suivi.stagiaire_id`.
- DELETE : admin uniquement.

### 3.2 UI — route `suivi`, onglet « Mon suivi »

Nouvelle vue `js/views/suivi.js`, enregistrée dans les routes et la nav de `js/main.js`.

**Stagiaire connecté** (profil lié à un stagiaire) :
- Sa fiche en édition directe :
  - *Compétences à travailler* : les 4 compétences du permis B en accordéon, sous-compétences
    cochables ; cocher une compétence entière est possible (code « C2 » sans sous-code).
  - *Mes besoins* : textarea libre, sauvegarde explicite (bouton), toast de confirmation.
- Bloc « Mon historique » en lecture seule, calculé depuis `passages` :
  total voiture, dont avec élève, répartition par formateur, date du dernier passage.

**Admin** :
- Liste des 13 fiches (nom, souhaits en tags, besoins tronqués, compteurs) ;
  clic → édition de la fiche du stagiaire (même formulaire).
- Les stagiaires sans fiche apparaissent avec une fiche vide (créée au premier enregistrement).

**Utilisateur non lié à un stagiaire et non admin** : message explicatif (pas de fiche).

### 3.3 Seed initial

L'import (chantier 1) insère aussi les `besoins` initiaux depuis le formulaire, par ex. :
- Gaëlle → « Conduite de droite avec des démos — n'a pas réussi à faire les démos »
- Timy → « Évaluation spécifique statique + dynamique (parcours, jalonnage), organisation, gestion du temps »
- (texte complet repris du document de suivi pour les 13 stagiaires)

Les souhaits (codes) restent vides au seed : c'est aux stagiaires de les cocher.

---

## Chantier 4 — « Placer la semaine » v2 (créneaux Voiture uniquement)

La logique salle (tableaux, élèves salle) ne change pas. Pour chaque créneau Voiture,
le tri des candidats (`pickLeast` actuel) est remplacé par un score composite,
ordre lexicographique :

1. **Équité d'exposition** (critère principal) : nombre de séances avec élève =
   `passages` où `type='Voiture'` et `avec_eleve = true` (historique) **+** placements
   voiture de la semaine en cours sur des créneaux ayant des bénévoles. Le plus petit passe.
   Les lignes `avec_eleve = null` ne comptent pas (inconnu ≠ avec élève).
2. **Match souhaits × bénévole** : si le créneau a ≥1 bénévole avec `niveau` renseigné,
   bonus (rang amélioré) aux stagiaires dont un souhait matche par préfixe
   (souhait « C2 » ⟷ bénévole « C2.3 » ; souhait « C2.3 » ⟷ bénévole « C2.3 »).
   Créneau sans bénévole ou bénévole sans niveau : critère neutre (« tant pis »).
3. **Variété formateur** : nombre de passages déjà faits avec le prof du créneau
   (`passages.prof_id`) — le plus petit passe. Créneau sans prof identifié : neutre.
4. **Aléatoire** : shuffle existant conservé pour départager.

Le tirage manuel par créneau (`randomFillVoitureEleves`) utilise le même score.

**Chargement des données** : le planning charge une fois par rendu les agrégats
nécessaires (une requête `passages` filtrée type Voiture, agrégée côté client par
stagiaire : nb avec élève, nb par prof). Pas de requête par créneau.

**Validation hebdo enrichie** : chaque passage créé par la validation porte désormais :
- `prof_id` : prof du créneau (premier de `prof_ids` si plusieurs ; null si « Autre »/vide) ;
- `avec_eleve` : pour un passage Voiture, `true` si le créneau a ≥1 bénévole, sinon `false` ;
  pour un passage Salle : `null` (non pertinent).
- Le dédoublonnage jour/stagiaire/type existant est conservé ; si les deux demi-journées
  divergent (matin avec bénévole, aprem sans), `avec_eleve = true` si l'une des deux l'est.

**Transparence** : le toast du placement auto reste inchangé ; en revanche le titre au survol
des élèves placés en voiture affiche le compteur « n séances avec élève » (aide à la relecture
manuelle du tirage). — détail UI ajustable à l'implémentation.

---

## Erreurs & cas limites

- Import : stagiaire introuvable par nom → le script s'arrête AVANT toute écriture et liste
  les noms non résolus (Rita attendue ici).
- Fiche : sauvegarde en conflit (deux éditions simultanées) → dernière écriture gagne,
  `updated_by_who` trace l'auteur (pattern existant de l'app).
- Placement v2 : si `fiches_suivi` est vide ou la migration absente, l'algo doit
  fonctionner (critères 2 dégradé neutre) — chargements résilients comme `getJoursOff`.
- Abandons (Tatiana) : déjà exclus par `activeIds` dans le planning et la validation.

## Tests (manuels, sur le déploiement local `dev.ps1`)

1. Rejouer l'import deux fois → mêmes totaux (idempotence) ; vérifier le tableau §1.2
   contre l'onglet Passages et le Dashboard.
2. Créer une semaine test : placements manuels + bénévoles → « Vider les placements » →
   seuls les stagiaires disparaissent ; Ctrl+Z restaure tout.
3. Fiche : cocher des souhaits côté compte stagiaire, vérifier RLS (un stagiaire ne peut
   pas éditer la fiche d'un autre), vérifier la vue admin.
4. Placement v2 : semaine avec bénévole C2 placé → vérifier que les stagiaires
   « souhait C2 » et peu exposés sortent en premier ; vérifier la variété formateur.
5. Validation de la semaine du 06/07 par l'utilisateur → vérifier `prof_id`/`avec_eleve`
   sur les passages créés (test réel du circuit).

## Livraison

Ordre : ① migration+import → ② bouton vider → ③ onglet Mon suivi → ④ placement v2.
Travail sur branche dédiée en **worktree** (dossier partagé entre sessions).
**Aucun commit/push sans validation explicite de l'utilisateur.**
