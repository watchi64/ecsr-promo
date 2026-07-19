# Pédagogie salle : élèves par demi-journée + sujet par groupe

Date : 2026-07-19 · Statut : validé par l'utilisateur (maquette + design approuvés en chat)

## Besoin

En mode 2 groupes, les 4 stagiaires « élèves » sont désormais placés une fois pour la
carte (en pratique : la demi-journée) et assistent aux DEUX passages d'affilée
(tableau du groupe 1 puis tableau du groupe 2). Chaque groupe garde son « au tableau »
propre (2 personnes différentes) et gagne son propre sujet/thème.

Modularité conservée : en effectif réduit, le tableau du groupe 1 peut être ajouté à la
main comme élève du groupe 2 (zone « + élève » par groupe).

## Modèle de données

- AUCUNE nouvelle colonne pour les élèves : `eleves_ids` (G1) et `eleves_ids_2` (G2)
  restent la source de vérité par groupe. La liste « partagée » affichée = l'INTERSECTION
  des deux colonnes ; les « extras » d'un groupe = sa liste moins l'intersection.
  Le champ partagé écrit la même liste dans les deux colonnes (plus les extras existants
  de chaque groupe). Impression, équité, blocages et anciennes semaines restent lisibles
  sans migration ni bascule de format.
- NOUVELLE colonne `planning_entries.sujet_2 TEXT` (nullable) : sujet du groupe 2.
  `sujet` reste le sujet du groupe 1 (et l'unique sujet en mode 1 groupe / autres
  activités). Comme les rôles, `sujet_2` est conservé si on bascule 2 → 1 groupe.

## Comportements

- **Carte (2 groupes)** [révisé sur retour utilisateur 19/07 : pas de bloc partagé] :
  chaque groupe affiche, dans l'ordre : Sujet propre → Au tableau → Stagiaires (liste
  complète du groupe, chips modulables). La logique « demi-journée » passe uniquement
  par le dé et « Placer la semaine ». En mode 1 groupe : inchangé.
- **Dé élèves (2 groupes)** : quel que soit le groupe cliqué, tire LES 4 stagiaires de
  la demi-journée, éligibles pour les deux vagues (union des blocages G1+G2), et remplit
  les deux listes à l'identique.
- **Placer la semaine, carte double** : 2 listes vides → un tirage écrit dans les deux ;
  1 seule liste remplie à la main → l'autre est complétée par copie (moins les conflits
  du groupe cible) ; 2 listes remplies → intouchées.
- **Équité** : un stagiaire élève sur une carte double compte 1 placement (union unique
  des deux listes), pas 2.
- **Placer la semaine** : remplit les élèves une fois par carte double (deux colonnes
  identiques) si les deux listes sont vides ; rééquilibrage échange dans les deux listes
  en même temps. Tableaux inchangés (1 par groupe, personnes différentes).
- **Règles de conflit inchangées** (slotOccupants) : tableau G1 ≠ tableau G2 ; un élève
  G1 ne peut pas animer le G2 ; tableau G1 autorisé comme élève G2 (extras G2).
- **Impression** : sujets par groupe (préfixe G1/G2 quand les deux existent) ; élèves
  imprimés UNE fois si les deux listes sont identiques, sinon par groupe (cas modulaire).
- **Validation semaine / thèmes** : la suggestion de thèmes « abordés » lit aussi
  `sujet_2` des cartes double. Les passages (tableau) ne changent pas.
- **Mon suivi** : le passage Salle du tableau G2 affiche `sujet_2`.

## Points d'implémentation

| Zone | Fichier | Changement |
|---|---|---|
| Payload upsert + SWAP_FIELDS | js/views/planning.js | + `sujet_2` |
| Helper `effSujets(e)` | js/views/planning.js | [sujet] + [sujet_2 si double], filtres vides |
| UI carte | js/views/planning.js | bloc partagé + extras par groupe + sujet par groupe |
| Dés / placement auto / équité | js/views/planning.js | union des blocages, comptage unique, double écriture |
| Impression | js/views/planning.js | sujets G1/G2, élèves dédoublonnés si identiques |
| Thèmes abordés (validation) | js/views/planning.js | parseSujet sur effSujets |
| Mon suivi | js/views/mon-suivi.js | sujet du bon groupe |
| CSS | css/style.css | styles bloc partagé + extras (réutilise l'existant au max) |
| Migration | Supabase MCP | `ALTER TABLE planning_entries ADD COLUMN sujet_2 TEXT` |

Contrôles nouveaux = classes existantes (`p-dice-btn`, chips, `sujet-ac`) pour rester
masqués en lecture seule (`.read-only`).

## Vérification

- `node --check` sur les fichiers touchés + test logique node (intersection/extras).
- Migration vérifiée par select.
- Preview navigateur : carte 2 groupes (partagé + extras + 2 sujets), dé, placement
  semaine, impression, bascule 2→1→2 groupes, mode lecture seule.
