# Dossier Professionnel · ce qui reste à vérifier en session connectée

Tout ce qui pouvait être vérifié sans authentification l'a été (voir plus bas). Les points
ci-dessous demandent une session réelle sur la base de production, impossible depuis
l'aperçu automatisé.

Lancer l'aperçu local depuis le worktree :

```bash
cd C:\Users\watch\Dev\ECSR\TP_ECSR_App-wt-dp; .\dev.ps1
```

## À vérifier

| # | Vérification | Attendu |
|---|---|---|
| 1 | Notes → le sous-onglet **« Dossier pro »** apparaît après « Livret EPCF » | Présent pour tout le monde |
| 2 | En tant que **stagiaire**, ouvrir « Dossier pro » | Le dossier s'ouvre directement en édition, sans liste. Nom et prénom pré-remplis |
| 3 | Saisir un titre et un texte, attendre une seconde | Le statut passe « Modifié… » puis **« Enregistré ✓ »** |
| 4 | Recharger la page, revenir sur l'onglet | La saisie est toujours là (écriture réellement passée en base) |
| 5 | Remplir un champ de l'**exemple n°2** | La page perd sa mention « ne sera pas imprimée », prend un numéro, et le sommaire l'ajoute |
| 6 | Cliquer **« Imprimer / PDF »** | A4 portrait, une page par bloc, pied « DOSSIER PROFESSIONNEL · Version du 11/09/2017 », logo sur la couverture, **aucun exemple vide imprimé** |
| 7 | En tant que **formateur** (ou aperçu « Voir en tant que ») | Liste des stagiaires triée par nom, « Consulter » sur les dossiers commencés, ouverture en lecture seule sans champ modifiable |
| 8 | Aller sur **Planning** puis « Imprimer / PDF » | Toujours **A4 paysage, une seule page**. C'est le point de non-régression le plus important |
| 9 | Notes → « Livret EPCF », ouvrir un livret et imprimer | Rendu identique au document officiel, 10 pages portrait |
| 10 | Sur **iPhone**, ouvrir le DP et imprimer | Rendu portrait correct. Tester en navigation privée : iOS sert longtemps l'ancien JS |

Si un affichage semble figé sur une ancienne version, c'est du cache : rechargement forcé,
et sur iOS navigation privée. Ne pas lancer `scripts/cache-bust.js` sur la branche, le
re-versionnage ne se fait que sur `main`.

## Déjà vérifié, sans authentification

| Vérification | Résultat |
|---|---|
| Règles de composition | `node tests/dp-rules.test.mjs` au vert (pagination, sommaire, exemples vides, mode édition) |
| Document vierge | 10 pages imprimables, 14 affichées en édition dont 4 marquées non imprimées |
| Sommaire vivant | Titres et numéros de page concordants avec les pieds de page réels (5/6/7) |
| Exemple ajouté ou retiré | Pagination et sommaire recalculés, curseur conservé dans le champ actif |
| Texte long | La page grandit, le texte n'est jamais coupé, liseré ambre affiché |
| Chemin d'impression de l'app | `#dp-print` monté, `body.dp-printable` posée, `@page portrait` injectée, `contenteditable` retiré du clone, pages exclues masquées |
| Démontage | Conteneur, classe et règle `@page` retirés, ce qui protège l'impression paysage du planning |
| Rôle stagiaire (banc à modules factices) | Document en édition, pré-remplissage, autosave, `stagiaire_id` et auteur corrects |
| Empilement d'écouteurs | 3 éditions successives avec reconstruction : exactement 3 enregistrements |
| Rôle formateur (banc) | Liste triée, statuts, lecture seule, zéro champ éditable, aucune écriture malgré une tentative de saisie |
| Non-régression du livret EPCF | 10 pages en 794×1121 px, bandeau magenta, logo, saisie, sélecteur de date, zéro erreur console |
| Chargement des modules | Un seul token `?v=` sur les 34 modules, aucun module chargé en double |
| RLS `dp_dossiers` | Politiques relevées en base : aucune écriture ne mentionne `is_prof()`, `anon` sans aucun privilège |
