# Absences, comptage des passages & placement par type — Design

**Date** : 2026-07-19 · **Branche** : `absences-comptage` · **Statut** : implémenté (lots 1-3, vérifiés au banc fetch-stub) — en attente merge/déploiement

## 1. Contexte et problème

Les absences répétées cassent le système d'équité du planning. Aujourd'hui, un passage
enregistré « Absence » est **exclu** des compteurs d'équité (`getVoitureAggregats` /
`getSalleAggregats`, `js/db.js`) : l'absent reste « en retard », le placement auto le
re-priorise la semaine suivante, il est de nouveau absent, et l'admin corrige tout à la
main (notes texte sur les cartes, remplacements impossibles à saisir car le sélecteur
exclut en dur quiconque est déjà sur le créneau — `slotOccupants()`, `js/views/planning.js`).

Cas déclencheur : semaine du 13/07 — Rita prévue au tableau vendredi 17 après-midi,
partie au dernier moment sans prévenir ; Céline a repris le tableau d'Emilie mais ne
pouvait pas être saisie (élève sur la même carte → exclue du sélecteur).

## 2. Décisions validées (brainstorm 2026-07-19)

| Question | Décision |
|---|---|
| Absence prévenue à l'avance | **Selon le préavis** : prévenu assez tôt → simple replanification (remplaçant = passage normal compté, l'absent ne consomme rien et garde sa priorité). Dernière minute / non prévenu → Absence comptée + remplaçant en Bonus non compté. |
| Où saisir l'absence de dernière minute | **Sur la carte planning** : chip marquée absente + remplaçant désigné à côté ; « Valider la semaine » génère les passages tout seul. |
| Arbitrage quand les places manquent | **Cascade** : 1) rien eu cette semaine → 2) type manquant cette semaine → 3) retard historique sur ce type → 4) critères existants. |
| Rétroactivité du nouveau comptage | **Assumée.** 6 lignes Absence (Rita ×2, Audrick, Aurélie, Céline, Emilie) se mettent à compter ; 1 ligne Bonus (Mickael, Salle) cesse de compter. |
| Bugs placement semaine 13/07 | Aucun bug d'algorithme constaté : le problème était le sélecteur trop strict pour saisir les remplacements. |

## 3. Données

- **Migration** (une seule) : `ALTER TABLE planning_entries ADD COLUMN absences jsonb NOT NULL DEFAULT '[]'::jsonb;`
  - Format : `[{ "sid": <id_stagiaire_absent>, "rid": <id_remplaçant | null> }, …]`
  - Le rôle (tableau G1/G2, élève voiture) se déduit de la position de `sid` dans les
    champs de rôle de la carte. **La personne prévue reste dans son champ de rôle** ;
    la carte fait foi de ce qui était planifié.
- **`passages`** : aucun changement de schéma — `resultat` (`Effectué` / `Absence` /
  `Bonus` / `Report`) et `remplacant_id` existent déjà.
- RLS : `absences` hérite des règles de `planning_entries` (édition déjà réservée admin).

## 4. Comptage d'équité (cœur de la réforme)

Dans `getVoitureAggregats()` et `getSalleAggregats()` (`js/db.js`) :

- **Comptent** : `Effectué` + `Absence` (le tour est consommé, absent ou pas).
- **Ne comptent pas** : `Bonus` (dépannage non pénalisé) + `Report` (cas manuel, conservé
  pour l'onglet Passages).
- Voiture : une `Absence` sur un créneau avec élève bénévole incrémente aussi `avecEleve`
  (sinon l'absent garderait la priorité sur le critère principal → cercle vicieux).
  `avec_eleve` est renseigné sur la ligne Absence comme il l'aurait été sur un Effectué.
- Rétroactif : s'applique aux lignes existantes (voir §2). Aucun script de reprise —
  c'est le même SELECT, seule la règle de filtrage JS change.
- Dashboard / Mon suivi : inchangés (ils détaillent déjà par résultat via `getStats()`).

## 5. UI carte — marquage d'absence

Rôles concernés (v1) : **générateurs de passage uniquement** — tableau G1/G2 (salle),
élèves (voiture). Les élèves salle ne génèrent pas de passage : pas de marquage v1.

- Clic sur la chip → menu : « Marquer absent(e) » / « Annuler l'absence ».
- Chip absente : barrée + teinte rouge, tooltip explicite. À côté, sélecteur
  « → remplacé par… » :
  - propose **tous les stagiaires actifs** (moins l'absent lui-même), triés par priorité
    avec compteur, comme les sélecteurs existants ;
  - badge « occupé » (avertissement) pour ceux déjà pris sur le créneau, **au lieu de
    l'exclusion dure** — fix du cas Céline ;
  - remplaçant **optionnel** (`rid: null` = personne n'a repris le créneau).
- Le remplaçant compte comme occupant du créneau (`slotOccupants()` ajoute les `rid`)
  pour les placements suivants de la même demi-journée.
- Les sélecteurs normaux de construction du planning **gardent** leur exclusion stricte.
- Undo Ctrl+Z : le champ `absences` est porté par le même upsert que le reste de la
  carte → couvert par `recordUndo` comme les autres éditions.
- Nettoyage : si `sid` n'est plus dans un champ de rôle de la carte (chip retirée,
  activité changée), l'entrée `absences` correspondante est ignorée à la validation et
  purgée au prochain enregistrement de la carte.

**Absence prévenue tôt** : pas de marquage — on remplace la chip normalement (geste
actuel). Le remplaçant fait un passage normal compté ; l'absent ne consomme rien.
La frontière « prévenu tôt » / « dernière minute » est laissée au jugement de l'admin :
l'app n'impose aucun seuil, c'est le geste choisi (swap ou marquage) qui décide.

## 6. Valider la semaine

Dans la génération des candidats (`openValiderSemaineModal`, `js/views/planning.js`) :

- Prévu **non marqué** → passage `Effectué` (comme aujourd'hui).
- Prévu **marqué absent** → passage `Absence` pour lui (avec `remplacant_id = rid`),
  et si `rid` non nul → passage `Bonus` pour le remplaçant. Même date, même type,
  même `prof_id` ; `avec_eleve` selon le créneau (voiture).
- Déduplication (grain stagiaire + type + jour) : en cas de doublon le même jour,
  priorité de fusion **Effectué > Absence > Bonus** (un vrai passage n'est jamais
  écrasé par une absence ou un bonus du même jour).
- Modale : pastilles ❌ Absence / ⭐ Bonus dans le récapitulatif pour voir ce qui part
  en base. Le reste (déjà enregistrés, thèmes) inchangé.

## 7. Placement auto — cascade par type

Pour un créneau de type T (Salle-tableau ou Voiture-élève), ordre lexicographique :

1. **Couverture globale** : rien eu cette semaine (aucun passage des deux types) → prioritaire.
2. **Couverture du type** : pas encore eu T cette semaine.
3. **Retard historique sur T** (compteurs §4).
4. Critères existants inchangés : plafond souple 2 voitures, anti-jours-consécutifs,
   séances avec élève (voiture), variété formateur, équilibre intra-semaine,
   passe de rééquilibrage.

Compteurs intra-semaine (`weekPassageCounts`, `roleCounts`) : passent au grain **par
type** ; un marqué absent **compte** comme servi, un remplaçant (`rid`) **ne compte
pas**. Conséquence auto-régulée : l'absent du mardi n'est pas re-priorisé le jeudi.

Le mémo ℹ️ « Comment marche le placement automatique ? » est mis à jour en langage
simple (nouvelles règles d'absence, cascade par type).

## 8. Rattrapage semaine du 13/07

Après déploiement, avec l'admin : marquage des absences réelles sur les cartes
(Rita vendredi → Absence ; Emilie/Céline et les cas du jeudi 16 selon le préavis réel),
puis « Valider la semaine ». Constat en base au 19/07 : **aucun passage enregistré**
sur 2026-07-13 → 2026-07-17, la semaine peut être validée proprement avec les
nouvelles règles. Les notes texte restent comme documentation.

## 9. Lots

| Lot | Contenu | Déployable seul |
|---|---|---|
| **1 — Comptage** | Inversion des règles d'agrégats (§4) | Oui — effet immédiat sur les priorités |
| **2 — Absences sur carte** | Migration + UI chips + sélecteur remplaçant + Valider la semaine (§3, §5, §6) | Oui |
| **3 — Cascade par type** | Placement auto (§7) + mémo | Oui |

Puis rattrapage 13/07 (§8, avec l'admin). La migration n'est appliquée qu'au
déploiement du lot 2 (colonne additive, sans risque pour l'existant).

## 10. Vérification et environnements de test

- **Banc fetch-stub** (méthode documentée, cf. sujet « salle demi-journée ») : page
  locale avec `fetch` stubbé simulant Supabase. Scénarios minimum :
  1. compteurs : Absence compte, Bonus/Report non, `avecEleve` incrémenté sur Absence
     avec bénévole ;
  2. marquage absent + remplaçant → validation → lignes `Absence`/`Bonus` générées,
     fusion Effectué > Absence > Bonus ;
  3. cascade : semaine synthétique où un stagiaire a salle-sans-voiture, un autre rien,
     un autre les deux → ordre de service conforme §7 ;
  4. sélecteur remplaçant : élève de la même carte proposé avec badge « occupé ».
- `node --check` sur les fichiers modifiés (⚠️ aveugle aux doublons de déclaration —
  la vérification navigateur reste obligatoire).
- Vérification navigateur sur serveur local avant merge, un lot à la fois.
- Workflow : worktree `TP_ECSR_App_absences` (main figé), merge → main → déploiement
  Pages, vérification live après build (gotchas cache-bust : hook limité à main,
  pre-push anti-cache-périmé ; ne jamais piper `cache-bust.js`).

## 11. Hors périmètre (v1)

- Marquage d'absence des élèves salle (non générateurs de passage).
- Chaîne de remplacement (remplaçant lui-même absent) : on modifie simplement le `rid`.
- Détection automatique d'absence par swap de chip (approche B écartée).
- Statistiques d'absentéisme par stagiaire (possible plus tard à partir des lignes Absence).
