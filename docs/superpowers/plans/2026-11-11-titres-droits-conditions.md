# Conditions d'utilisation : passages des « titres et droits à la carte »

Texte remis à la coordination, qui le regroupe avec ceux de l'espace contact et du jury en **une seule nouvelle version** des
conditions. `js/legal-data.js` n'est pas modifié par ce chantier. Timy lit et accepte ce texte avant la mise en ligne.

Chaque passage dit où il se pose dans le texte en vigueur (version `2026-11-14`, `js/legal-data.js`), avec sa phrase d'ancrage
citée telle quelle, puis le texte à poser, mot pour mot. Le texte reste au vouvoiement, comme le reste des conditions.

## 1. L'essentiel, ligne 4

Ancrage : « La direction de votre centre voit, comme vos formateurs, votre suivi nominatif (notes, planning, passages, absences,
date de naissance) ; »

Devient :

> La direction de votre centre, et les membres de son équipe à qui elle en donne le droit selon leur fonction, voient, comme vos
> formateurs, votre suivi nominatif (notes, planning, passages, absences, date de naissance) ;

La suite de la phrase (« le siège d'ECF ne voit que des chiffres par centre, sans aucun nom. ») ne change pas.

## 2. Section 2 « Le compte et l'accès »

Ancrage : « (formateurs, ECF) »

Devient : « (formateurs, intervenants, personnel des centres et du siège d'ECF) »

## 3. Section 3 « Les données enregistrées », tableau

Ligne ajoutée juste après la ligne qui commence par `| Historique | Qui a créé ou modifié une note ou un passage, et quand |` :

```
| Droits du personnel | Pour les formateurs et le personnel d'ECF : leur titre, les promos ou le centre où il s'exerce, et le journal des droits (qui a donné, retiré, créé ou modifié quel titre, quand) |
```

## 4. Section 4 « Qui voit quoi »

Deux paragraphes ajoutés juste après celui qui commence par « « Direction de votre centre » : les personnes d'ECF affectées à la
direction du centre où se déroule votre promo ; » (et finit par « ses chiffres ne sont pas montrés. ») :

> **L'équipe de votre centre.** La direction de votre centre peut confier une partie de ces accès à d'autres membres de son
> équipe, selon leur fonction : par exemple un secrétariat, qui gère les fiches des stagiaires (identité, coordonnées, date de
> naissance, passages) sans voir les notes, ou un intervenant, qui tient les feuilles d'émargement des promos où il intervient.
> Chaque fonction porte un titre, affiché dans l'application, qui dit page par page ce que la personne peut voir ou modifier.
> Personne ne reçoit plus que ce que voient vos formateurs et la direction de votre centre, et la base de données vérifie ces
> droits à chaque demande. Au siège d'ECF, une personne chargée des contenus ou de la qualité ne lit, elle non plus, aucun nom de
> stagiaire.

> **Journal des droits du personnel.** Chaque fois qu'un titre est donné, retiré, créé, modifié ou supprimé, l'application le
> note : quand, par qui, pour qui, sur quelle promo ou quel centre, et ce que le titre permettait avant et après. Ce journal ne
> concerne que le personnel : aucune invitation de stagiaire n'y figure. Personne ne peut le modifier. Il est lu par les
> personnes qui gèrent l'équipe d'un centre, pour ce centre, par le siège d'ECF, sans les titres donnés sur une promo, et par
> l'éditeur.

## 5. Section 10 « Combien de temps », tableau

Ligne ajoutée juste avant `| Statistiques anonymes | Sans limite (elles n'identifient personne) |` :

```
| Journal des droits du personnel | Trois ans, puis effacement automatique |
```

## 6. Section 12 « Vos droits »

Phrase ajoutée à la fin du paragraphe qui commence par « **Effacement sur demande.** » (après « c'est la contrepartie de cet
enregistrement sans nom. ») :

> Pour un membre du personnel, l'effacement remplace son adresse par « compte effacé » dans le journal des droits : la trace du
> geste reste, sans son nom.

## 7. Mise en œuvre de la promesse de la section 12 (pour l'éditeur, pas pour le texte)

Aucun écran. À toute demande d'effacement d'un membre du personnel, l'éditeur (le fondateur) exécute
`select public.effacer_adresse_journal('<adresse>');` par `outils/psql_prod.sh`, dans le délai d'un mois de la section 12, puis
note la demande et le nombre de lignes rendu au registre qualité. Décision de Timy du 12/11 : « Procédure par vous ». Un bouton
dans Réglages du fondateur reste possible plus tard.

## 8. Pour la coordination

- **Commentaire d'en-tête de `js/legal-data.js`** : citer les passages neufs (l'essentiel ligne 4 ; section 2 ; la ligne « Droits
  du personnel » de la section 3 ; les paragraphes « L'équipe de votre centre » et « Journal des droits du personnel » de la
  section 4 ; la ligne du journal en section 10 ; la phrase « compte effacé » de la section 12).
- **Règle de date** : une seule valeur `<V>`, postérieure à `2026-11-14`, fixée le jour de la mise en ligne.
  `<V>` = `VERSION_CONDITIONS` = la valeur de la migration neuve qui remplace `conditions_version_publiee()` = la valeur passée à
  `20261114_autonomie_2_version.sql` (`-v version=<V>`). Ordre : la base d'abord (nouvelle `conditions_version_publiee()`, puis
  `autonomie_2_version`, qui refuse une date au-delà de la version publiée), la poussée de `js/legal-data.js` juste après.
- **Migration `20261112_titres_4_journal`** : elle sort le même jour que cette version (le journal n'est promis qu'à partir d'elle).
