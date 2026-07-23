# Mon suivi : afficher aussi les créneaux « élève en salle »

Date : 2026-07-23 · Statut : validé par l'utilisateur (design approuvé en chat)

## Besoin

Dans « Mon suivi » → onglet Passages, un stagiaire ne voit que les créneaux où il
*passe* : au tableau en Pédagogie salle, ou au volant en Voiture (conduite). Les
demi-journées où il est placé comme **élève dans la salle** pendant le passage d'un
autre stagiaire n'apparaissent nulle part, alors qu'elles occupent son planning.

Objectif : rendre la demi-journée lisible d'un coup, sans pour autant transformer une
présence en passage.

## Modèle de données

Aucune nouvelle colonne, aucune migration. Les données existent déjà :
`planning_entries.eleves_ids` (groupe 1) et `eleves_ids_2` (groupe 2, lu uniquement
si `salle_double`), déjà source de vérité pour le placement en salle
(cf. `docs/specs/2026-07-19-salle-eleves-demi-journee.md`).

## Comportements

### Extraction

`extractMyPassages` devient `extractMyCreneaux` et gagne un troisième cas. Chaque item
porte un champ `role` :

| Cas | Condition | `role` | `type` affiché |
|---|---|---|---|
| existant | `Pédagogie salle` et `pedagogue_id` (ou `pedagogue_id_2` si `salle_double`) = moi | `passage` | Salle |
| existant | `Voiture (conduite)` et `eleves_ids` contient moi | `passage` | Voiture |
| nouveau | `Pédagogie salle` et `eleves_ids` (ou `eleves_ids_2` si `salle_double`) contient moi | `eleve` | Élève salle |

- Le cas `eleve` produit **un seul item par carte**, quel que soit le nombre de groupes
  où je suis élève. Il porte un tableau `waves` : une entrée par groupe concerné,
  `{ tableau, sujet }` — `tableau` = nom court du stagiaire au tableau de ce groupe
  (`displayStagiaire`), `sujet` = `sujet` pour le G1, `sujet_2` pour le G2.
- `eleves_ids_2` n'est lu que si `salle_double` est vrai — même garde que
  `effElevesIds()` dans `js/views/planning.js`, pour ne pas ressusciter des rôles
  laissés en base par un changement d'activité.
- Cas limite conservé : au tableau du G1 **et** élève du G2 (autorisé par les règles de
  conflit) produit deux lignes distinctes sur la même demi-journée — un `passage` et un
  `eleve`. Ce sont deux vagues successives, c'est le comportement voulu.
- Les jours off / fériés filtrent les lignes `eleve` comme les autres (`dayIsOff`).

### Tri

Inchangé (`iso` → `half_day` → `slot`), plus un départage final : à égalité, `passage`
avant `eleve`. Le passage du stagiaire se lit en premier.

### Rendu (`renderPassagesSection`)

- Titre de section : « Mes passages à venir » → **« Mon planning à venir »**.
  Sous-titre de la vue : « Mon planning à venir et l'évolution de mes résultats. »
  État vide : « Aucun créneau planifié pour l'instant. »
- Ligne `eleve` : tag gris neutre **« Élève salle »** (`.tag.eleve`, à base de
  `--bg-subtle` / `--text-soft` / `--line`), volontairement en retrait des tags ambre
  *Salle* et vert *Voiture*.
- Mention du tableau, en texte atténué : `au tableau : M. Marie · Sujet A`, et en
  2 groupes `au tableau : M. Marie · Sujet A, puis P. Paul · Sujet B`. Le segment
  « puis … » n'apparaît que s'il y a une seconde vague. Un sujet vide est omis (nom
  du tableau seul) ; un tableau non renseigné est omis (sujet seul) ; si les deux
  manquent pour une vague, la vague n'est pas affichée.
- La mention `avec <formateurs>` existante reste sur toutes les lignes.
- Badge **« prochain » réservé aux lignes `role === "passage"`** : une simple présence
  en salle ne doit pas voler le repère du prochain vrai passage. Les badges
  « aujourd'hui » et « passé » s'appliquent à toutes les lignes.

### Ce qui ne change pas

Aucun décompte n'est touché. `getVoitureAggregats`, l'équité du placement dans le
planning, l'onglet EPCF et le graphe d'évolution ignorent totalement les lignes `eleve`.
La définition métier de « passage » (`passageIds()` dans `js/views/planning.js` :
tableaux salle + élèves voiture) reste intacte.

## Points d'implémentation

| Zone | Fichier | Changement |
|---|---|---|
| Extraction | js/views/mon-suivi.js | `extractMyPassages` → `extractMyCreneaux`, champ `role`, cas élève salle, `waves` |
| Tri | js/views/mon-suivi.js | départage `passage` avant `eleve` |
| Rendu liste | js/views/mon-suivi.js | titre, état vide, tag `Élève salle`, mention « au tableau », badge « prochain » restreint |
| Données | js/views/mon-suivi.js | `listStagiaires()` chargé systématiquement (plus seulement si `needSelector`) + map `nomParStagiaireId` au niveau module, sur le modèle de `profs` |
| Sous-titre vue | js/views/mon-suivi.js | « Mon planning à venir et l'évolution de mes résultats. » |
| CSS | css/style.css | `.tag.eleve` (gris neutre), à côté de `.tag.salle` / `.tag.voiture` |
| Tests | tests/mon-suivi-creneaux.test.mjs | nouveau, sur le modèle de `tests/passage-rules.test.mjs` |

Pas de migration Supabase : les colonnes existent déjà.

## Vérification

- `node --check js/views/mon-suivi.js`.
- Test logique node sur `extractMyCreneaux`, cas couverts : carte salle simple (élève),
  carte 2 groupes (une seule ligne, deux vagues), tableau G1 + élève G2 (deux lignes),
  `eleves_ids_2` présent alors que `salle_double` est faux (ignoré), activité changée
  avec `eleves_ids` résiduel (ignoré), jour off (filtré), tri passage-avant-élève.
- Preview locale (`.\dev.ps1`) : vue stagiaire (`myId` défini), vue formateur/admin avec
  le sélecteur d'élève, semaine courante + semaine suivante, thème clair et sombre.
