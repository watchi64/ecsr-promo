# Spec : Banque d'élèves bénévoles (2026-07-02)

## Contexte et objectif

Les créneaux « Voiture (conduite) » du planning font conduire des élèves bénévoles : des volontaires (souvent venus d'autres auto-écoles) qui reçoivent gratuitement des cours de conduite donnés par les élèves moniteurs. Gagnant-gagnant.

Objectif : une banque d'élèves bénévoles alimentée par les formateurs/admins, avec identité, téléphone, niveau, heures faites, auto-école de provenance et disponibilités hebdomadaires. Quand on a besoin d'élèves pour un créneau voiture, on filtre par dispo et on appelle. Les bénévoles retenus sont rattachés aux cartes « Voiture (conduite) » du planning.

Vocabulaire UI : « Élèves bénévoles » (libellé court « Bénévoles »). Le mot « cobayes » est banni de l'UI.

## Décisions validées (utilisateur, 2026-07-02)

1. Pas d'onglet dédié : la banque s'ouvre via un bouton dans l'en-tête du Planning, visible formateur/admin uniquement.
2. Visibilité : la banque entière (téléphone compris) est réservée formateur/admin. Les stagiaires voient uniquement le prénom des bénévoles placés sur les cartes du planning.
3. Disponibilités : grille hebdomadaire récurrente (Lundi à Vendredi, matin/après-midi) + note libre.
4. Écriture : formateurs/admins seulement.
5. Nom retenu : « Élèves bénévoles ».

## Données (migration Supabase)

### Table `benevoles`

| Colonne | Type | Contraintes / rôle |
|---|---|---|
| `id` | serial PK | |
| `prenom` | text NOT NULL | |
| `nom` | text NOT NULL | |
| `telephone` | text | Affiché en lien `tel:` |
| `niveau` | text | Compétence REMC : `C1`, `C2`, `C3`, `C4` (select) |
| `boite` | text | `Manuelle` ou `Automatique` (select) |
| `heures` | numeric | Heures de conduite déjà effectuées, saisie manuelle |
| `auto_ecole` | text | Auto-école de provenance |
| `dispos` | jsonb NOT NULL DEFAULT '{}' | `{"LUNDI": ["matin"], "MARDI": ["matin","aprem"], ...}` (clés = constantes `JOURS`) |
| `dispo_note` | text | Précisions libres |
| `notes` | text | Notes libres |
| `actif` | boolean NOT NULL DEFAULT true | Retrait doux, données conservées |
| `created_at` | timestamptz DEFAULT now() | |

### RLS

- SELECT, INSERT, UPDATE, DELETE : `is_admin()` uniquement (fonction SECURITY DEFINER existante). La banque est invisible pour un stagiaire, même via la console : c'est la RLS qui protège le téléphone, pas l'UI.

### RPC `benevoles_noms()`

Fonction SECURITY DEFINER accessible à tout `authenticated`, retournant uniquement `TABLE(id int, display text)` pour les bénévoles actifs, `display` au format « V. Timy » (initiale du nom + prénom). Sert à l'affichage des cartes planning côté stagiaire. Aucune autre colonne ne transite.

### Liaison planning

- Colonne `planning_entries.benevoles_ids INTEGER[] NOT NULL DEFAULT '{}'`.
- Renseignée uniquement pour l'activité « Voiture (conduite) » (via `ACTIVITY_SHAPES`, même mécanique de donnée conservée/masquée que `effElevesIds`).

## UI

### Carte « Voiture (conduite) » (planning.js)

- `ACTIVITY_SHAPES["Voiture (conduite)"]` gagne un champ `benevoles`, affiché après `eleves` : chips de sélection piochant dans la banque.
- Sélecteur : bénévoles actifs, ceux dispos sur le jour + demi-journée du créneau remontent en tête avec un marqueur de dispo ; un bénévole déjà placé sur une autre carte du même créneau (cartes parallèles = simultanées) est exclu, comme les élèves moniteurs. Les slots successifs restent permis : un bénévole reste souvent la demi-journée entière et change d'élève moniteur.
- Admin : édition complète. Stagiaire : lecture seule, prénoms visibles (résolus via la RPC `benevoles_noms()`), contrôles masqués par le mécanisme `.read-only` existant + garde `isAdmin()` dans `saveEntry`.
- Impression (`printEntryCell`) : les bénévoles apparaissent sous les élèves moniteurs, groupés sous une ligne « Bénévoles : », un par ligne en italique (le groupement rend un suffixe inutile et préserve la largeur de colonne ~56mm).
- Le dé « Placer la semaine » (`autoPlaceWeek`) ne place jamais de bénévoles.
- « Valider la semaine » et la table `passages` ignorent totalement les bénévoles.

### Panneau « Bénévoles » (nouveau module)

Bouton « Bénévoles » dans l'en-tête du Planning, masqué pour les stagiaires (groupe `.read-only`), ouvrant un panneau plein écran sur mobile :

- **Liste** : « V. Timy · C2 · Manuelle · 12h · ECF Nîmes », téléphone cliquable (`tel:`), badges des dispos (L m, M am, ...). Tri alphabétique par nom (`compareByNom`).
- **Filtre dispo** : sélecteur jour + demi-journée pour répondre à « qui est dispo jeudi matin ? ».
- **Fiche ajout/édition** : tous les champs, grille de dispos en cases à cocher (5 jours x 2 demi-journées), champs note.
- **Retrait doux** : bouton « Retirer de la banque » (`actif = false`), bloc « Retirés » repliable pour réactiver (même patron que les abandons stagiaires).

## Hors périmètre (assumé)

- Pas de compte ni d'accès app pour les bénévoles (dispos saisies par l'équipe).
- Pas de placement automatique des bénévoles.
- Pas d'incrément automatique des heures depuis le planning (évolution possible plus tard).
- Pas d'undo (le planning n'en a pas non plus).

## Contraintes projet à respecter

- Vanilla JS, modules ES, pas de framework.
- Libellés : « Formateur » jamais « Prof » ; aucun em-dash dans l'UI.
- Palette mint, accent `#6B7F4E`.
- Pattern « save sans casser les autres inputs » (`pendingSaves` + `flushPendingInputs`).
- Migration via MCP `apply_migration`, jamais de DDL en `execute_sql`.
- Tout nouveau contrôle d'édition du planning doit être couvert par `.read-only` + garde JS + RLS.
- Commit local sans push (l'utilisateur valide en preview puis pousse lui-même).
