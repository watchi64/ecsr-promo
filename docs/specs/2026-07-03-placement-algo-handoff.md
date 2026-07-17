# Handoff — Refonte de l'algorithme de placement (salle & voiture)

> Document autoportant destiné à une session d'implémentation dédiée.
> Produit le 2026-07-03 après cartographie complète du code (`main`), vérification
> des données réelles en base, et deux conceptions indépendantes fusionnées.
> **Périmètre : uniquement l'algorithme de placement** (« Placer la semaine » + les 3 dés 🎲).

---

## 1. Mission

Refondre le moteur de placement du planning hebdomadaire de `TP_ECSR_App` pour qu'il
priorise **l'historique réel des passages** et applique des règles d'anti-surcharge,
tout en restant modulaire pour des promos plus petites.

**Bug fondateur (constaté sur données réelles, semaine du 2026-07-06)** : Emilie a
2 passages Salle (minimum de la promo), Valentin en a 6 (maximum). « Placer la
semaine » a mis Valentin au tableau et pas Emilie. Cause : les compteurs d'équité
d'`autoPlaceWeek` ne comptent que les placements de la semaine courante — l'historique
validé (table `passages`) n'est jamais consulté, le départage est un tirage pur.

### Les 5 règles du formateur (source de vérité produit)

- **R1** — Favoriser ceux qui sont LE MOINS PASSÉS, sur l'historique réel.
- **R2** — Anti-surcharge intra-jour : qui passe (ex. voiture) le matin ne devrait pas
  repasser (ex. pédagogie salle) l'après-midi du même jour.
- **R3** — Salle double : au tableau G1 ⇒ pas élève G2 ; élève G1 ⇒ pas au tableau G2
  (celui qui passe au tableau doit pouvoir PRÉPARER son passage).
- **R4** — Ne pas surcharger, laisser du temps libre → compter aussi le rôle
  « élève de pédagogie salle » dans la charge (rôle sans trace dans `passages`).
- **R5** — Modularité : défauts calibrés pour 14 stagiaires, mais adaptable à des
  groupes bien plus petits (paramètres, règles relâchables).

---

## 2. Contexte technique

- Repo : `C:\Users\watch\Dev\ECSR\TP_ECSR_App` — app **JS vanilla ES modules, sans
  build**, servie statiquement. Backend Supabase (project `crpduennbqaemhfaywrz`).
- Fichier principal : `js/views/planning.js` (~2200 lignes). Aussi : `js/db.js`,
  `js/config.js`, `js/views/dashboard.js` (référence produit du « retard »).
- Live élèves = GitHub Pages, branche `main`. Preview locale : `.\dev.ps1`
  (localhost:8000) — ⚠️ tape la **base de PROD** : toute écriture de test est réelle.
- Code et commentaires **en français**, style existant à respecter.

### État module disponible dans planning.js
`entries` (semaine courante, mutées EN PLACE, id local `_lid` non persisté),
`stagiaires` (**actifs uniquement** — `listStagiaires` filtre `actif=true`),
`profs`, `themes`, `benevoles`, `semaineLundi` (ISO lundi), `halfMetas`.

### Structure d'une entry (`planning_entries`)
Clé d'unicité DB : `(semaine_lundi, day_index, half_day, slot, lane)` — la position
identifie la ligne, on ne la modifie JAMAIS (drag&drop = permutation de contenu).
Champs de placement : `pedagogue_id`, `eleves_ids[]` (groupe 1), `pedagogue_id_2`,
`eleves_ids_2[]` (groupe 2, actifs seulement si `salle_double=true`),
`benevoles_ids[]` (voiture uniquement, table `benevoles` ≠ table `stagiaires`).
Rôles à lire via `entryShape`/`effPedagogueId`/`effElevesIds`/`effBenevolesIds`
(les données d'une activité re-basculée restent stockées mais ne comptent pas).

---

## 3. Comportement actuel (à remplacer)

- `autoPlaceWeek` (planning.js ~592-682, bouton admin « 🎲 Placer la semaine ») :
  compteurs `tab`/`salleEl`/`voit` **intra-semaine uniquement**, amorcés sur l'existant
  (mode remplissage) ou remis à zéro (reroll confirmé). Parcours chronologique
  (jour → matin/aprem → slot → lane). Sélection `pickLeast` = `shuffle` puis tri stable
  par compteur croissant. Salle : 1 tableau + 4 élèves par groupe ; voiture : 2 élèves.
- Les 3 dés individuels — `randomFillPedagogue` (~520), `randomFillEleves` (~495, salle),
  `randomFillVoitureEleves` (~541) — même logique via `roleCounts` (~404, intra-semaine).
- Anti-doublon : `slotOccupants(entry, field)` (~467-490) — même triplet
  `(day_index, half_day, slot)` toutes lanes confondues ; sur la carte courante seul
  l'autre rôle du même groupe bloque (`SAME_GROUP_BLOCK` : les 2 groupes d'une salle
  double sont séquentiels, le croisé G1/G2 est aujourd'hui PERMIS — c'est ce que R3
  interdit désormais) ; sur les autres cartes du slot, blocage entier via rôles effectifs.
- Badge `prioBadge` (~778) + menus triés par `roleCounts` : affichent le compteur
  intra-semaine (tooltip explicite « ≠ passage validé »).

---

## 4. Données & sémantique des compteurs (⚠️ section critique)

### 4.1 Partition STRICTE des sources (anti double comptage)

| Compteur | Source | Interdit |
|---|---|---|
| `hist.tableau` | table `passages`, `type='Salle'` | compter les entries pour ce rôle |
| `hist.eleveVoiture` | table `passages`, `type='Voiture'` | compter les entries pour ce rôle |
| `sem.*` (tableau, éléve salle, élève voiture) | `entries` en mémoire de la semaine affichée, rôles effectifs | — |
| élève salle historique | **rien en v1** (voir 4.3) | — |

**Agrégat historique** : aligné sur le dashboard (`statForType`, dashboard.js ~43-48) :
`prio = Effectué + Bonus + Absence` (« tours utilisés » ; `Report` exclu, comme partout).
Réutiliser/décliner `getStats()` (db.js ~197-210) qui fait déjà ce comptage
par stagiaire/type — un fetch au chargement, cache module invalidé sur `changeWeek`,
après « Valider la semaine » et après toute écriture dans `passages`.

### 4.2 Dédoublonnage passages ↔ semaine affichée
La validation hebdo transforme les jours écoulés en passages (`origine='Planning'`,
`semaine_lundi` renseigné). Cas réel : la semaine 2026-06-29 existe à la fois en
entries ET en passages (20 lignes). Règle unique :

> **Historique = `passages` MOINS les lignes `origine='Planning' AND
> semaine_lundi = semaine affichée`. La semaine affichée = `entries` (rôles effectifs).**

Les 107 passages `origine='Manuel'` ont `semaine_lundi` NULL et des dates
conventionnelles de saisie en masse (80× au 2026-05-15) : jamais en collision avec la
semaine affichée, comptés tels quels ; **aucun croisement par date contre eux** (dates
non fiables).

### 4.3 Rôle « élève de pédagogie salle » (R4)
Ce rôle n'existe NULLE PART dans `passages` (la validation ne crédite que le pédagogue).
**Décision v1 : compteur intra-semaine uniquement** (charge/anti-surcharge), PAS
d'historique multi-semaines — l'historique `planning_entries` est trop lacunaire pour
fonder une équité (4 semaines exploitables seulement, 171/246 lignes `activite` NULL,
10 clés `semaine_lundi` qui ne sont pas des lundis, aucune trace d'absence).
Prévoir le paramètre `histWindowWeeks` (défaut null) pour activer plus tard un comptage
multi-semaines via une nouvelle lecture `getPlanningRange(fromIso, toIso)` — avec
filtres obligatoires : vrais lundis uniquement, `activite='Pédagogie salle'`, rôles
effectifs, jours écoulés, semaine affichée exclue.
**Ne PAS rétro-injecter de passages « élève salle » dans `passages`** (ça polluerait le
dashboard et la validation).

---

## 5. Conception cible — moteur « contraintes dures + score pondéré »

Un seul moteur, primitives partagées par `autoPlaceWeek` ET les 3 dés (une seule
source de vérité pour blocage, comptage, sélection).

### 5.1 Contraintes DURES (jamais relâchées ; candidat filtré du pool)

- **D1 — Occupation simultanée** : `slotOccupants` (mis à jour 2026-07-10). Bloque au sein
  du même triplet `(day, half, slot)` (toutes lanes, rôles effectifs) **ET**, sur les autres
  slots de la même demi-journée, dès que l'une des deux cartes est une **Voiture (conduite)**
  — car la conduite tourne en continu sur toute la demi-journée (un élève voiture ne peut
  pas être aussi en salle sur un créneau suivant). Symétrique. Les slots successifs
  salle↔salle (aucune voiture) ne se bloquent toujours pas.
- **D2 — Exclusion croisée carte salle double (R3, NOUVEAU)** : sur une carte
  `salle_double`, interdits : tableau G1 ↔ élève G2, élève G1 ↔ tableau G2, et
  tableau G1 = tableau G2. (Élève G1 + élève G2 même carte = pénalité souple, pas dur.)
  Nouvelle fonction `cardOccupants(entry, exceptField)` unie à `slotOccupants` dans un
  helper `hardBlocked(entry, field)`. Flag config `crossGroupExclusive: true`
  (désactivable en très petit groupe où la salle double deviendrait imremplissable).
- **D3 — Même TYPE déjà placé le MÊME JOUR (NOUVEAU)** : candidat tableau exclu s'il a
  déjà un rôle « passant » Salle ce jour-là ; candidat élève voiture exclu s'il a déjà
  une voiture ce jour-là. Justification forte : la validation dédoublonne au grain
  `stagiaire|type|JOUR` → placer 2× le même type le même jour = 1 seul passage crédité
  (doublement injuste). Rôles « passants » = tableau (Salle) et élève voiture (Voiture) ;
  élève salle est un rôle passif, il ne déclenche pas D3.
- **D4 — Stagiaires actifs seulement** (module `stagiaires`, abandons déjà filtrés).
- **D5 — Ne remplir que les vides** hors reroll confirmé (invariant existant ;
  « vide » = champ null / liste vide ; une liste partielle 2/4 n'est jamais complétée).
- **D6 — Ne toucher QUE** `pedagogue_id(_2)` / `eleves_ids(_2)`. Profs, sujets, notes,
  activité, `salle_double`, `benevoles_ids` : intouchés.

### 5.2 Score pondéré (préférences ; on choisit le score MINIMAL)

```
score(c, place) =
    W.hist       × hist[place.role][c]        // R1 — retard réel du rôle (tableau|eleveVoiture ; 0 pour eleveSalle en v1)
  + W.hist       × sem[place.role][c]         // équité intra-semaine du même rôle (continuité comportement actuel)
  + W.histGlobal × histTotal[c]               // R1/R4 — charge historique toutes catégories
  + W.sameDay    × dayActive[place.day][c]    // R2 — rôles « passants » déjà tenus CE JOUR (autre type / autre demi-journée)
  + W.sameDay/2  × dayPassive[place.day][c]   // R2 affaibli — élève salle le même jour (demi-poids)
  + W.sameHalf   × halfLoad[place.dayHalf][c] // enchaînement de slots dans la même demi-journée
  + W.week       × weekLoad[c]                // R4 — charge totale semaine, tous rôles (élève salle compris)
```

Sélection : `shuffle(pool)` puis **tri stable** par score croissant, `slice(0, n)` —
l'aléa ne départage que les ex æquo (généralise le `pickLeast` actuel, à extraire de sa
closure). Compteurs mis à jour en mémoire au fil de la boucle (`bumpContext`).

### 5.3 Poids par défaut (justifiés) et modularité R5

| Poids | Groupe ≥ 8 (ex. 14) | Groupe < 8 (ex. 6) | Logique |
|---|---|---|---|
| `hist` | **10** | **10** | Unité de base. L'écart Emilie/Valentin (2 vs 6) vaut 40 pts : R1 domine toujours. |
| `histGlobal` | 2 | 2 | Départage léger en faveur du moins sollicité globalement. |
| `sameDay` | **25** | **8** | Seuil d'échange : à 14, repasser le même jour ne se justifie qu'avec ≥ 3 passages de retard ; à 6, la répétition intra-jour est inévitable → seuil ~1. |
| `sameHalf` | 8 | 3 | Enchaîner 2 slots d'une même demi-journée < grave qu'un matin+aprem. |
| `week` | 3 | 1 | Lissage intra-semaine (R4), faible car redondant avec `hist` incrémenté. |

Le moteur choisit le jeu de poids selon `stagiaires.length` vs `smallGroupThreshold`.
R2/R4 sont des **pénalités, jamais des contraintes dures** : en petit groupe elles se
relâchent d'elles-mêmes (mieux vaut un placement « moins bon » qu'une place vide).

### 5.4 Configuration

```js
// config.js — défauts versionnés
export const PLACEMENT_DEFAULTS = {
  salle:   { tableau: 1, eleves: 4 },
  voiture: { eleves: 2 },              // le dé manuel garde son picker 1/2/3
  crossGroupExclusive: true,           // D2 (R3)
  smallGroupThreshold: 8,
  weights:      { hist: 10, histGlobal: 2, sameDay: 25, sameHalf: 8, week: 3 },
  weightsSmall: { hist: 10, histGlobal: 2, sameDay: 8,  sameHalf: 3, week: 1 },
  histWindowWeeks: null,               // réservé v2 (historique élève-salle)
};
```

Override optionnel : clé unique `placement_config` (JSON) dans la table `settings`
existante, lue via `getSetting`, fusion superficielle sur les défauts. **Pas de
nouvelle table, pas d'écran de réglages en v1** (un UPDATE SQL suffit pour une promo
de 6).

### 5.5 Ordre de parcours — 2 passes

**Passe 1 : tous les TABLEAUX d'abord** (chronologique) — le rôle le plus rare ; le
glouton chronologique actuel grillait les meilleurs candidats tableau en les plaçant
élèves dès le lundi. **Passe 2 : élèves salle puis voiture**, chronologique.
À l'intérieur d'un slot, les placements amont bloquent l'aval (comportement actuel).

### 5.6 Enveloppe à CONSERVER telle quelle

```
await flushPendingInputs()
→ targets, mode remplissage/reroll (confirm), snapshots (undo)
→ ctx = await buildPlacementContext()   // fetch passages agrégés + compteurs semaine
→ calcul pur, mutation en place des seuls champs de placement
→ changed = diff snapshots → Promise.all(upsertPlanningEntry(entryUpsertPayload(e)))
→ renderInto ; toast (unfilled + Ctrl+Z) ; recordUndo(restore + ré-upsert)
→ catch : rollback mémoire + renderInto + toast erreur
```

Les 3 dés : mêmes primitives (`ctx` depuis le cache, `hardBlocked`, `pickBest`),
deviennent async (fetch au premier clic puis cache). Sinon le dé unitaire recréerait
le bug Emilie.

---

## 6. UI à ajuster (sans refonte visuelle)

- **Badge `prioBadge`** : afficher le total pris en compte par le tri (hist + semaine).
  Tooltip : « 2 passages validés + 1 placement cette semaine = 3 · le moins élevé est
  prioritaire ». Classe `zero` conservée pour total 0.
- **Menus déroulants** (`personSelect`/`chipsSelect`) : triés par le même score que le
  moteur (aujourd'hui déjà triés par compteur — changer le compteur suffit).
  Légende `prioLegend` : « chiffre = passages validés + placements de la semaine ».
- **Toasts** : « Semaine placée · priorité aux moins passés (historique inclus) ·
  N place(s) non remplie(s) · Ctrl+Z ».
- Le dashboard reste la référence des STATS (doctrine « seuls les passages enregistrés
  comptent ») ; le planning anticipe (hist + placements en cours) — une ligne
  d'explication dans le panneau d'aide du planning pour lever l'ambiguïté.

---

## 6bis. Jours désactivés / fériés (ajouté 2026-07-09)

Depuis le 2026-07-09, un jour de la semaine peut être **désactivé** (férié français
calculé côté client, ou désactivation manuelle via la table `planning_jours_off`).
Le helper `dayIsOff(dayIndex)` (planning.js) renvoie `true` pour ces jours.

**Le moteur DOIT ignorer ces jours** : `autoPlaceWeek` filtre déjà ses `targets` avec
`&& !dayIsOff(e.day_index)`, et la validation hebdo saute ces jours (`if (dayIsOff(e.day_index)) return`).
Tout nouveau moteur/dé doit conserver ce filtre — ne jamais placer ni compter un rôle
sur un jour désactivé. `joursOff` est chargé dans `loadPlanning` (state module), les
fériés via `frenchHolidays(year)` (dates fixes + Pâques). Nouvelles colonnes
`planning_entries.prof_autre` / `autonomie` : neutres pour le placement (jamais mutées),
juste à préserver via `entryUpsertPayload` (déjà le cas).

## 7. Invariants à préserver (issus du code, vérifiés)

0. **Ne jamais placer sur un jour désactivé/férié** (`dayIsOff`) — cf. §6bis.
1. Ne remplir que les vides hors reroll confirmé ; liste partielle jamais complétée.
2. Seuls `pedagogue_id(_2)`/`eleves_ids(_2)` mutés — jamais profs/sujets/notes/activité/`salle_double`/`benevoles_ids`.
3. Abandons ignorés (toujours tirer dans le module `stagiaires`).
4. Anti-doublon par créneau exclusivement via `slotOccupants` (+ `cardOccupants` D2).
5. Équité par rôle ET par activité : compteurs séparés tableau / élève salle / élève voiture.
6. Positions `(slot, lane)` intouchables (identité DB, `onConflict`).
7. Groupe 2 conditionné à `salle_double` PARTOUT.
8. Undo systématique (snapshots + ré-upsert), rollback mémoire en cas d'échec.
9. `flushPendingInputs()` avant toute opération batch.
10. N'upserter que les cartes réellement modifiées (diff snapshots).
11. Mutation EN PLACE des objets `entries` (préserver `_lid` et les références).
12. Tailles par défaut : salle 1+4/groupe, voiture 2 (dé manuel 1-3).
13. Gating admin : bouton rendu si `isAdmin()` seulement (pas de garde interne dans
    `autoPlaceWeek` — re-gater tout nouveau point d'entrée), RLS en filet serveur.
14. Ordre de parcours déterministe.
15. `renderInto(currentContainer)` après mutation (rafraîchit aussi le DOM d'impression).

## 8. Pièges spécifiques (vérifiés sur le code)

- **Bénévoles** : ids de la table `benevoles` (serial indépendant de `stagiaires`) —
  ne JAMAIS fusionner les deux dans un même Set de blocage (collision numérique).
  Ignorés du tirage, hors capacité (toujours 2 élèves moniteurs), préservés au reroll
  (le reroll actuel ne réinitialise pas `benevoles_ids` — comportement voulu) et à
  l'upsert (automatique via `entryUpsertPayload`). Leur anti-doublon reste
  `benevoleSlotOccupants`, hors moteur.
- **`roleCounts(exceptLid)`** exclut TOUTE la carte (les 2 groupes) — le blocage
  intra-carte est le travail de `slotOccupants`/`cardOccupants`, pas du compteur.
- **`slotOccupants`** lit les champs BRUTS sur la carte courante mais les rôles
  EFFECTIFS sur les autres cartes — asymétrie voulue (données dormantes d'un
  changement d'activité).
- **Cache historique** : invalider sur `changeWeek`, après « Valider la semaine »,
  après toute écriture `passages` — sinon dés et placement tirent sur des compteurs
  périmés.
- **10 clés `semaine_lundi` non-lundi** en base (artefacts) : le moteur v1 ne lit que
  la semaine affichée (toujours un vrai lundi) → non impacté ; mais tout futur
  `getPlanningRange` DOIT filtrer les vrais lundis. Le nettoyage data est hors périmètre.
- Poids calibrés sur raisonnement, pas sur données : **valider par dry-run** (voir §11).

## 9. Décisions par défaut (questions tranchées — le formateur peut les inverser)

1. Élève G1 + élève G2 même carte salle double : **souple** (pénalité), pas dur —
   l'interdire viderait l'éligibilité en petit groupe.
2. Historique multi-semaines « élève salle » : **non en v1** (données lacunaires),
   paramètre réservé.
3. Résultat « Absence » compte comme tour utilisé : **oui** (aligné dashboard) —
   un absent chronique ne doit pas monopoliser les placements. « Report » non compté.
4. Champ « indisponibilité stagiaire » : **pas en v1** (le mode remplissage respecte
   les retraits manuels ; l'Absence corrige a posteriori).
5. Validation rétroactive des semaines passées / nettoyage des clés artefacts :
   **hors périmètre moteur** (tâche data séparée ; ne PAS valider rétroactivement
   2026-06-22 — la saisie manuelle du 25-26/06 couvre déjà ces passages avec des
   dates conventionnelles, le dédoublonnage créerait des doublons).

## 10. Critères d'acceptation

- **CA1 (le bug)** : Emilie (2 passages Salle, min) et Valentin (6, max) — sur semaine
  vierge, « Placer la semaine » met Emilie (ou ex æquo à 2) au tableau en premier ;
  Valentin seulement si tous les éligibles du créneau ont ≥ 6. Idem au dé 🎲 tableau.
- **CA2** : respect du manuel — tableau choisi à la main conservé et compté dans
  l'équilibre ; liste 2/4 non complétée.
- **CA3** : reroll — `confirm` ; bénévoles/profs/sujets/notes/`salle_double` identiques
  avant/après ; l'historique influence toujours le tirage après reroll.
- **CA4** : aucun stagiaire deux fois dans le même `(jour, demi-journée, slot)` toutes
  lanes et rôles effectifs confondus.
- **CA5 (R3)** : sur toute carte `salle_double` : `pedagogue_id ∉ eleves_ids_2`,
  `pedagogue_id_2 ∉ eleves_ids`, `pedagogue_id ≠ pedagogue_id_2` — y compris via dés.
- **CA6 (R2)** : jamais 2 rôles « passants » du même type le même jour ; matin+aprem
  inter-types seulement si le pool l'exige (à 14 stagiaires sur semaine normale :
  zéro occurrence).
- **CA7** : un stagiaire `actif=false` n'apparaît dans aucun tirage/menu/compteur.
- **CA8** : sur la semaine 2026-06-29 (validée), aucun badge ne compte les passages
  `origine='Planning'` de cette semaine EN PLUS des entries.
- **CA9** : pénurie — placement termine sans erreur, places vides signalées (toast),
  jamais de doublon forcé.
- **CA10** : Ctrl+Z restaure exactement (mémoire + DB), bénévoles compris.
- **CA11** : ordre des menus = ordre de préférence du moteur ; tooltip détaille
  historique + semaine.
- **CA12** : équité ex æquo — sur compteurs identiques, 20 exécutions ne choisissent
  pas toujours la même personne.

## 11. Plan de recette

1. **Dry-run d'abord** : mode log console (placement proposé + scores par candidat,
   SANS upsert) sur la semaine courante, comparé à l'ancien algo — vérifier CA1 sur
   les données réelles avant de brancher la persistance.
2. Puis le plan de test manuel : préparer une semaine future vierge (2 cartes salle
   dont 1 double, 2 voitures, 1 bénévole), dérouler CA1→CA12 dans l'ordre
   (placer → vérifier → Ctrl+Z → manuel → replacer → reroll → pénurie → abandon →
   semaine validée → F5 et vérif DB).

## 12. Hors périmètre (ne PAS faire)

- Pas de solveur (CSP/backtracking) : glouton 2 passes + pénalités suffit (~30 places).
- Pas de nouvelle table SQL, pas de vue, pas de compteurs matérialisés.
- Pas de passages « élève salle » rétro-injectés dans `passages`.
- Pas de plafond dur « max N placements/semaine » par défaut.
- Pas de normalisation des clés non-lundi par le moteur.
- Pas d'UI de réglage des poids ; pas de Web Worker ; pas de framework.
- Ne pas toucher au placement des bénévoles (spec bénévoles : jamais placés auto).
- Ne pas toucher à la branche `lot2-qcm-examen` (WIP QCM d'une autre session).

## 13. Workflow repo (⚠️ spécificités locales)

- Partir de `main` à jour ; travailler sur une branche `algo-placement` ;
  merge → push `main` = déploiement GitHub Pages immédiat (élèves).
- **Hook pre-commit** : re-versionne les tokens `?v=` de TOUS les js/css à chaque
  commit (diffs élargis = normal) et **refuse tout fichier au texte double-encodé**
  (mojibake). Écrire les fichiers en **UTF-8 strict** — attention à PowerShell 5.1
  (`Set-Content` sans `-Encoding utf8` corrompt ; un merge a déjà été corrompu ainsi).
- Tests locaux via `.\dev.ps1` → localhost:8000 — la base est la PROD : privilégier
  le dry-run, et Ctrl+Z/undo après tout test d'écriture.
- Vérifier le rendu non-admin avec « Voir en tant que » (fondateur) : fidèle pour le
  gating UI ; PAS pour la RLS (session DB inchangée) — mais le moteur est admin-only,
  donc non concerné.
