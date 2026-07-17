# Spec : Auto-écoles partenaires + fiche de suivi des bénévoles (2026-07-05)

## Contexte et objectif

La banque d'élèves bénévoles (spec 2026-07-02, en prod) référence leur provenance par un champ texte libre `auto_ecole`. Objectif : en faire un vrai carnet de partenaires.

1. **Banque d'auto-écoles partenaires** : fiches contact (référent, téléphone, email) pour reprendre facilement contact et « commander » des élèves.
2. **Affiliation** : chaque bénévole est rattaché à une auto-école de la banque (clé étrangère, plus de texte libre).
3. **Fiche de suivi** : historique des venues du bénévole, déduit automatiquement du planning, avec un commentaire de formateur possible par venue.

## Décisions validées (utilisateur, 2026-07-05)

1. Suivi = séances déduites du planning (date, demi-journée, élèves moniteurs, sujet) + commentaire par venue. Zéro double saisie.
2. Les auto-écoles vivent dans le panneau Bénévoles existant, qui passe à 2 onglets : « Bénévoles » / « Auto-écoles ».
3. Compteur de venues automatique depuis le planning ; le champ « heures faites » reste manuel (expérience de conduite globale du bénévole).

## Données (migrations Supabase)

### Table `auto_ecoles`

| Colonne | Type | Rôle |
|---|---|---|
| `id` | serial PK | |
| `nom` | text NOT NULL | Seul champ obligatoire |
| `referent` | text | La personne à appeler (ex. Sophie) |
| `telephone` | text | Lien `tel:` |
| `email` | text | Lien `mailto:` |
| `adresse` | text | |
| `notes` | text | |
| `actif` | boolean NOT NULL DEFAULT true | Retrait doux |
| `created_at` | timestamptz DEFAULT now() | |

RLS : SELECT/INSERT/UPDATE/DELETE réservés `is_admin()` (mêmes policies que `benevoles`). Aucune surface stagiaire : les auto-écoles n'apparaissent nulle part côté stagiaire.

### Affiliation

- `benevoles.auto_ecole_id INTEGER REFERENCES auto_ecoles(id)` (nullable : un bénévole peut ne pas avoir d'auto-école).
- Migration de l'existant : chaque valeur texte distincte de `benevoles.auto_ecole` devient une fiche `auto_ecoles` et les bénévoles y sont rattachés. Cas concret : « Sophie » → fiche nom « Sophie », référent « Sophie », téléphone « 06 16 14 75 14 » (repris des notes seedées « Contact via Sophie : 06 16 14 75 14 »), et ces notes de seed, devenues redondantes, sont vidées (données produites par la migration du 2026-07-02, le numéro vit désormais sur la fiche partenaire).
- La colonne texte `benevoles.auto_ecole` est supprimée après reprise (le client est mis à jour dans le même déploiement).

### Table `benevole_suivi` (commentaires par venue)

| Colonne | Type | Rôle |
|---|---|---|
| `id` | serial PK | |
| `benevole_id` | integer NOT NULL REFERENCES benevoles(id) ON DELETE CASCADE | |
| `semaine_lundi` | date NOT NULL | Clé de la venue (= créneau planning) |
| `day_index` | integer NOT NULL | 0 à 4 |
| `half_day` | text NOT NULL | `matin` / `aprem` |
| `commentaire` | text | |
| `updated_at` | timestamptz DEFAULT now() | |

- Contrainte UNIQUE `(benevole_id, semaine_lundi, day_index, half_day)` : une venue = une demi-journée (même si plusieurs créneaux successifs dans la demi-journée).
- RLS : tout réservé `is_admin()`.
- Les venues elles-mêmes ne sont PAS stockées : elles sont déduites en lisant `planning_entries` où `benevoles_ids` contient l'id (SELECT déjà ouvert, panneau admin de toute façon). Un commentaire peut exister pour une venue disparue du planning (créneau supprimé) : il est alors affiché avec la mention « créneau retiré du planning ».

## UI (module `js/views/benevoles.js`, CSS `.bnv-*`)

### Onglets du panneau

Le panneau ouvert par le bouton « Bénévoles » gagne 2 onglets en tête (pills, comme les tabs de Notes) : **Bénévoles** (vue actuelle inchangée par ailleurs) et **Auto-écoles**. Le titre du panneau devient « Élèves bénévoles et partenaires ».

### Onglet Auto-écoles

- Liste triée par nom : nom en gras, référent, téléphone (`tel:`) et email (`mailto:`) cliquables, compteur de bénévoles affiliés.
- Fiche ajout/édition : nom (obligatoire), référent, téléphone, email, adresse, notes ; bouton « Retirer » (actif = false) + bloc « Retirées » repliable pour réactiver (même patron que les bénévoles).
- Sur la fiche d'une auto-école : **liste de ses bénévoles affiliés** (nom, téléphone cliquable, niveau) : c'est l'outil « reprendre contact avec ses élèves ».

### Fiche bénévole

- Le champ « Auto-école d'origine » (texte) devient un **select** listant les auto-écoles actives + option « + Nouvelle auto-école » qui ouvre la fiche auto-école vierge puis revient au formulaire bénévole avec la nouvelle fiche sélectionnée.
- Nouvelle section **« Suivi »** (visible en édition d'un bénévole existant) :
  - Venues déduites du planning, triées de la plus récente à la plus ancienne, format : « Lun 6 juil. matin · avec V. Timy, G. Ankpra · C1.4 Démarrer et s'arrêter » (élèves moniteurs de la carte, sujet si renseigné). Les venues futures sont marquées « à venir ».
  - Sous chaque venue passée : champ commentaire (sauvegarde sur blur, upsert dans `benevole_suivi`).
  - Compteur : « N venues » aussi affiché dans la ligne de liste de l'onglet Bénévoles.

### db.js

Nouvelles fonctions : `listAutoEcoles()` (cache), `addAutoEcole`, `updateAutoEcole`, `setAutoEcoleActif` ; `listSeancesBenevole(benevoleId)` (lit planning_entries, pas de cache) ; `listSuiviBenevole(benevoleId)`, `upsertSuiviBenevole(entry)`. Invalidation de cache sur écritures.

## Hors périmètre (assumé)

- Pas d'accès app pour les auto-écoles, pas d'emails automatiques, pas de statistiques.
- Les venues = créneaux planifiés ; une absence se note en commentaire de venue.
- Pas de multi-affiliation (un bénévole = une auto-école au plus).
- L'affichage planning côté stagiaire ne change pas (RPC noms uniquement).

## Contraintes projet

Identiques à la spec bénévoles : vanilla JS, « Formateur » jamais « Prof », pas d'em-dash dans l'UI, mint `#6B7F4E`, migrations via MCP `apply_migration`, écritures gardées `is_admin()` + RLS, commit local par étape, push en fin de course après vérification.
