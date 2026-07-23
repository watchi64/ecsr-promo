# Refonte navigation : « Priorités » + espace perso avec passages effectués

Date : 2026-07-23 · Validé par l'utilisateur (brainstorm du soir).

## Problème

Après les renommages du jour, deux onglets se marchaient dessus : « Passages »
(tableau de bord promo) et « Mon suivi » (espace perso) parlent tous deux de
passages, sans que la portée (promo vs moi) soit dite. Par ailleurs l'espace
perso ne montre que les passages **à venir** : les passages effectués (salle
notamment) n'apparaissent nulle part côté stagiaire.

## Décisions (validées une à une)

1. Le tableau de bord promo devient **« Priorités »** (onglet) / **« Priorités
   de passage »** (titre). Nommer la fonction, pas le contenu.
2. L'onglet « Mon suivi » **sort de la barre** (8 onglets). L'espace perso
   reste joignable par : ouverture de l'app (route par défaut), logo, badge du
   compte (« Mon espace personnel »).
3. L'espace perso affiche aussi les **passages effectués** : compteurs +
   historique détaillé, dans le sous-onglet « Passages ».

## A. Onglet promo « Priorités »

- `main.js` TABS : `dashboard` → label « Priorités », **icône cible** (nouvelle
  entrée `target` dans icons.js — cercle + point central, style Lucide).
- `dashboard.js` : h2 « Priorités de passage ». Sous-titre inchangé.
- `home.js` : tuile « Priorités » avec la même description.
- Route interne `dashboard` inchangée.

## B. Barre sans « Mon suivi »

- `main.js` : l'entrée `mon-suivi` est retirée de TABS. La route reste dans
  `routes` (ouverture par défaut, logo, badge, liens directs).
- Sur `#/mon-suivi`, aucun onglet n'est actif : comportement assumé (la boucle
  d'activation ne matche simplement rien, aucun code à ajouter). Vérifier
  visuellement qu'aucun style ne dépend d'un `.active` présent.
- L'icône `user` (personne) reste utilisée par le bouton « Mon espace
  personnel » du badge.

## C. Espace perso — sous-onglet « Passages » enrichi

Structure du sous-onglet (mon-suivi.js) :

1. **À venir** : section actuelle inchangée (`renderPassagesSection`).
2. **Effectués** (nouveau, en dessous) :
   - **Compteurs** : total Salle, total Voiture, « avec élève » (voiture),
     répartition par formateur. Les tuiles voiture et la répartition par
     formateur **déménagent** de « Évolution » vers ici
     (`renderHistoriqueSection` déplacée/refondue) pour éviter le doublon.
   - **Historique** : liste chronologique (plus récent en premier) des rows
     `passages` du stagiaire : date · tag Salle/Voiture · tag résultat
     (couleurs RESULTATS existantes) · commentaire si présent.
3. **Évolution** : ne garde que le graphe des notes.

### Données

- Source unique : `listPassages({ stagiaire_id })` (db.js, existant). Les
  compteurs sont **calculés côté client** depuis cette même liste → compteurs
  et historique toujours cohérents, une seule requête.
- Comptage des compteurs : même règle que les agrégats existants
  (`compteDansEquite` : Effectué + Absence comptent, Bonus/Report non). Les
  lignes non comptées apparaissent quand même dans l'historique avec leur tag.
- `getVoitureAggregats()` reste utilisé ailleurs (planning) ; dans l'espace
  perso, les compteurs voiture viennent désormais de la liste locale.
  Vérifier la cohérence des chiffres entre les deux sources au banc.

### RLS

`passages` est déjà lisible par tout authentifié (RLS SELECT ouverte) : un
stagiaire peut lire ses propres rows. Aucune migration.

## D. Hors périmètre

Aucune écriture, aucun changement de comptage ni de règle métier. EPCF
intact. Impression intacte.

## Vérification

Banc import map (`_harness_build.mjs`) : fixtures `passages` à ajouter au stub
(quelques rows Salle/Voiture, résultats variés dont Bonus). Vérifier :
onglets (« Priorités » présent, « Mon suivi » absent), titre dashboard,
badge → espace perso, sous-onglet Passages (à venir + compteurs + historique,
Bonus non compté mais listé), « Évolution » sans l'historique voiture,
compte admin et stagiaire, zéro erreur console. Puis prod : Pages built,
curl des fichiers servis.
