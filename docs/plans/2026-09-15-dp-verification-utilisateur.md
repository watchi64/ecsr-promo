# Dossier Professionnel, mise en page officielle : ce qui reste à vérifier en session connectée

Tout ce qui pouvait l'être sans authentification a été vérifié : bancs d'essai, tests logiques,
simulation du rendu papier, non-régression du livret EPCF. Les points ci-dessous demandent une
session réelle sur la base de production, avec un vrai compte.

Lancer l'aperçu local depuis le worktree :

```bash
cd C:\Users\watch\Dev\ECSR\TP_ECSR_App; .\dev.ps1
```

## À vérifier

| # | Vérification | Attendu |
|---|---|---|
| 1 | Ouvrir le dossier d'un stagiaire qui a déjà beaucoup écrit, par exemple celui de 11 669 caractères | Tout son texte est là, champ par champ |
| 2 | Compter les feuilles de ce dossier | Plus que 8, chaque feuille porte son en-tête et son pied, la numérotation est continue |
| 3 | Vérifier le sommaire de ce dossier | Les numéros annoncés correspondent aux pieds de page réels |
| 4 | Saisir du texte, attendre une seconde | Statut « Modifié » puis « Enregistré », et un trait de coupe apparaît si la feuille est pleine |
| 5 | Recharger la page | La saisie est toujours là |
| 6 | Imprimer en PDF depuis un ordinateur | A4 portrait, une feuille par page, aucune page blanche, aucun repère « Cliquez ici », bord droit des fiches non rogné |
| 7 | En tant que formateur, consulter le dossier d'un stagiaire | Document composé en feuilles, aucun champ modifiable, mention « Lecture seule » |
| 8 | Aller sur Planning puis imprimer | Toujours A4 paysage, une seule page. C'est la non-régression la plus importante |
| 9 | Notes, Livret EPCF, ouvrir un livret et imprimer | Rendu identique au document officiel, 10 pages portrait |
| 10 | Sur iPhone, en navigation privée, ouvrir le DP et imprimer | Rendu portrait correct |

## Ce qui a déjà été vérifié, sans authentification

| Vérification | Résultat |
|---|---|
| Règles de composition | `node tests/dp-rules.test.mjs` au vert |
| Couverture des clés d'enregistrement | `node tests/dp-gabarit-cles.test.mjs` : 93 clés du schéma, dont les 56 vues en production. Éprouvé par sabotage : retirer une clé fait échouer le test en la nommant |
| Tous les tests du projet | 16 fichiers de test au vert |
| Moteur de composition | `_preview_dp_moteur.html` : 21 contrôles au vert, dont deux scénarios éprouvés par sabotage du moteur en mémoire, qui passent bien au rouge quand la protection visée disparaît |
| Document complet | `_preview_dp.html` : dossier vierge, dossier témoin et dossier à texte long, tous sans échec. 8 feuilles à vide, 9 avec un texte long, sommaire concordant |
| Aucune donnée dans le document composé | Zéro `data-k` dans les documents composés, 48 préservés dans le flux d'édition |
| Vue réelle, rôle stagiaire | Flux continu éditable, traits de coupe, trois frappes donnent exactement trois enregistrements |
| Vue réelle, rôle formateur | Document paginé, zéro champ éditable, mention « Lecture seule » |
| Chemin d'impression | Clone enfant direct de `body`, classe `dp-printable` posée, règle `@page A4 portrait` injectée, clone masqué à l'écran, zéro champ éditable et zéro clé dans le clone |
| Rendu papier simulé | 9 feuilles toutes en 210 x 297 mm, zéro débordement, zéro repère de saisie imprimé, rien de visible hors du clone |
| Marges d'impression | Marge la plus étroite du document : 8 mm, au-dessus de la zone non imprimable des imprimantes de bureau |
| Non-régression du livret EPCF | 10 pages en 794 x 1121 px, police Arial inchangée, 59 champs, zéro erreur de console |
| Absence de fuite de style | Aucune règle `@page` dans `css/dp.css`, aucune règle visant `.lv-f`, `.lv-cb` ou `.lv-date` sans le préfixe `.dp-doc` |

## Écarts assumés par rapport au fichier Word

| Écart | Raison |
|---|---|
| La fiche d'exemple fait 179,6 mm au lieu de 182,6 | À la largeur du modèle il ne restait que 5 mm de blanc à droite, sous la zone non imprimable de beaucoup d'imprimantes : le liseré droit des cadres se serait fait rogner |
| Les repères de saisie ne s'impriment pas | Le modèle vierge imprime « Cliquez ici pour taper du texte » dans ses champs vides. Un dossier remis au jury ne doit pas porter cette mention |
| Le titre visé garde sa forme correcte | Le modèle source écrit « ENSEIGNANT DE CONDUITE ET DE LA SECURITE ROUTIERE », sans le mot « la » et sans accents. C'est une saisie, pas une donnée du formulaire |
| Deux activités-types au lieu d'une | Le modèle ne porte qu'une activité-type avec ses trois fiches. Le titre ECSR en a deux : le document en compte six, dont seules les n°1 s'impriment d'office |
| Les cases carrées du sommaire sont décoratives | Le modèle les dessine sans documenter leur usage. Leur donner un champ reviendrait à inventer une donnée |
