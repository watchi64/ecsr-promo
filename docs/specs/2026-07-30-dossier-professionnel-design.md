# Dossier Professionnel (DP) dans l'app · design

Date : 2026-07-30
Statut : validé par l'utilisateur, prêt pour le plan d'implémentation
Source : `Dossier professionnel Vierge 3cas.docx` (modèle ECF, version officielle du 11/09/2017)

## Besoin

Chaque stagiaire doit pouvoir remplir **son** Dossier Professionnel dans l'app, puis le
télécharger et l'imprimer au format officiel pour le présenter au jury.

Le DP est un document du ministère chargé de l'emploi. Il appartient au candidat : lui
seul le rédige, il le conserve et l'actualise pendant son parcours, et il le présente
obligatoirement à chaque session d'examen.

## Décisions validées

| Sujet | Décision |
|---|---|
| Sortie | PDF fidèle via l'impression navigateur. Le document affiché à l'écran EST le document imprimé. Pas de génération `.docx` |
| Périmètre | Activité-type 1 ET activité-type 2, 3 exemples chacune |
| Droits | Le stagiaire écrit son DP. Formateurs et admins le consultent en lecture seule |
| Emplacement | Sous-onglet « Dossier pro » dans Notes, après « Livret EPCF » |
| Pièces jointes | Hors périmètre v1. Pas de stockage de fichiers |

## Architecture

### Noyau commun extrait

Le livret officiel EPCF (`js/views/epcf-livret.js`, document TP-01303) résout déjà le même
problème technique : document officiel A4, champs `contenteditable`, autosave `jsonb`,
impression fidèle validée sur iPhone. Sa mécanique est extraite dans un module partagé
plutôt que recopiée.

Nouveau module **`js/doc-officiel.js`**, sans connaissance d'aucun document particulier :

| Export | Rôle |
|---|---|
| `collectData(doc)` | Lit les `[data-k]` du document et rend un objet plat |
| `applyData(doc, data)` | Réinjecte les valeurs dans les `[data-k]` |
| `makeEditable(doc, opts)` | Champs `contenteditable` en texte brut, cases à cocher, sélecteurs de date |
| `mountPrintClone(doc, id, bodyClass)` | Clone d'impression enfant direct de `<body>`, sans `contenteditable` |
| `teardownPrintClone(id, bodyClass)` | Démontage au changement de route |
| `ensurePrintListeners(getDoc)` | `beforeprint` + `matchMedia("print")`, le seul signal émis par iOS Safari |
| `makeAutosave(saveFn, delay)` | Autosave débouncé avec ré-enfilement si une sauvegarde est déjà en vol |

`epcf-livret.js` est refactorisé pour consommer ce module. Son gabarit HTML ne bouge pas.
Le livret étant validé en conditions réelles (smoke test et impression du 19/07), son
impression doit être re-testée avant de pousser.

Nouvelle vue **`js/views/dp.js`** : gabarit du DP, logique de rôle, pré-remplissage.
Nouvelle feuille **`css/dp.css`**, calquée sur `css/livret.css` (page A4 portrait 210 mm,
bascule d'impression par `body.dp-printable`).

### Données

Table **`dp_dossiers`**, calquée sur `epcf_livrets` :

| Colonne | Type | Note |
|---|---|---|
| `id` | bigint | PK |
| `stagiaire_id` | integer | UNIQUE, FK `stagiaires` |
| `data` | jsonb | défaut `'{}'`, clés plates |
| `updated_by_who` | text | traçabilité |
| `created_at` / `updated_at` | timestamptz | défaut `now()` |

Accès dans `js/db.js` : `getDpDossier(stagiaireId)`, `listDpDossiers()`, `upsertDpDossier({...})`,
sur le modèle exact des fonctions `epcf_livrets` existantes.

Clés de `data`, plates comme celles du livret :

| Groupe | Clés |
|---|---|
| Identité | `nom_naissance`, `nom_usage`, `prenom`, `adresse`, `modalite` (`formation` ou `vae`) |
| Exemples | `at{1,2}_ex{1,2,3}_` + `titre`, `taches`, `moyens`, `avec_qui`, `entreprise`, `service`, `du`, `au`, `complement` |
| Titres et diplômes | `titre{1..10}_intitule`, `titre{1..10}_organisme`, `titre{1..10}_date` |
| Déclaration | `dh_nom`, `dh_fait_a`, `dh_le` |

### Politiques RLS

Miroir inversé de `epcf_livrets` : sur le livret le formateur écrit et le stagiaire lit,
sur le DP c'est le contraire.

| Opération | Politique |
|---|---|
| SELECT | `is_admin() OR is_prof() OR stagiaire_id = my_stagiaire_id()` |
| INSERT | `is_admin() OR stagiaire_id = my_stagiaire_id()` |
| UPDATE | `is_admin() OR stagiaire_id = my_stagiaire_id()` (aussi en `WITH CHECK`) |
| DELETE | `is_admin()` |

Un formateur ne peut donc pas écrire dans le DP d'un stagiaire, même si l'interface était
contournée. L'admin garde la main pour dépannage.

Rappel connu du projet : l'aperçu « Voir en tant que » du fondateur est purement visuel,
la RLS n'est pas simulée. L'interface suivra le rôle simulé, pas les données.

## Le document

14 blocs A4 portrait, dans l'ordre :

| Bloc | Contenu |
|---|---|
| 1 | Couverture : logo Ministère, nom de naissance, nom d'usage, prénom, adresse, titre visé ECSR, modalité d'accès (Parcours de formation coché par défaut) |
| 2 | Présentation du dossier (texte officiel fixe, arrêté du 22 décembre 2015) |
| 3 | Sommaire |
| 4 | Intercalaire « Exemples de pratique professionnelle » |
| 5 à 7 | Activité-type 1 « Former des apprenants conducteurs… », exemples 1 à 3 |
| 8 à 10 | Activité-type 2 « Sensibiliser l'ensemble des usagers… », exemples 1 à 3 |
| 11 | Titres, diplômes, CQP, attestations de formation (10 lignes) |
| 12 | Déclaration sur l'honneur, signature manuscrite après impression |
| 13 | Documents illustrant la pratique professionnelle (page de séparation) |
| 14 | Annexes (page de séparation) |

Chaque bloc d'exemple reprend les 5 rubriques officielles : tâches et conditions, moyens
utilisés, avec qui, contexte (entreprise, service, période du/au), informations
complémentaires.

Pied de page officiel sur chaque bloc : « DOSSIER PROFESSIONNEL · Version du 11/09/2017 »
et le numéro de page. En-tête : « Dossier Professionnel (DP) ».

### Écarts assumés par rapport au fichier Word

| Écart | Raison |
|---|---|
| **AT2 reconstitué** | Le modèle fourni annonce l'AT2 au sommaire mais ne contient aucun bloc d'exemple pour elle. On reproduit la structure de l'AT1 à l'identique. Le libellé de l'AT2 est repris de `epcf-livret.js`, déjà conforme au référentiel |
| **Sommaire vivant** | Le titre saisi dans un exemple remonte automatiquement au sommaire avec son numéro de page, au lieu d'être recopié à la main |
| **Exemples vides non imprimés** | Le DP officiel demande « un à trois exemples ». Un exemple dont tous les champs sont vides sort de l'impression et du sommaire, au lieu d'imprimer une page blanche |

### Débordement de texte

Les zones de rédaction ont une hauteur généreuse mais **ne coupent jamais le texte** :
un texte long pousse la page et peut faire glisser d'une feuille à l'impression. Un liseré
discret apparaît sur le champ qui dépasse sa hauteur nominale, pour inviter à resserrer.

Choix explicite : perdre du texte à l'impression serait pire qu'une numérotation qui
glisse d'une feuille. La numérotation du pied de page suit les rubriques du dossier, ce qui
reste cohérent avec le sommaire.

### Asset

Le DP porte le logo « Ministère chargé de l'emploi » version 2017, différent du logo
« Ministère du Travail, de l'Emploi et de l'Insertion » 2021 déjà présent en
`assets/livret/ministere-travail.png`. Nouveau fichier `assets/dp/ministere-emploi.jpg`,
extrait du docx source.

## Interface

Sous-onglet « Dossier pro » ajouté dans Notes, après « Livret EPCF », visible par tous.
Le rendu s'adapte au rôle, exactement comme le livret.

| Rôle | Vue |
|---|---|
| Stagiaire | Son DP directement, éditable, autosave débouncé, mention « Enregistré » |
| Formateur / admin | Liste des stagiaires triée par nom, ouverture en lecture seule avec bandeau « Le DP appartient au candidat, il en est le seul rédacteur » |

Barre d'outils : « ← Retour » (depuis la liste formateur seulement) et « Imprimer / PDF ».

Pré-remplissage à la première ouverture, depuis la fiche stagiaire : `prenom`, `nom_usage`
et `dh_nom`. Tous restent modifiables, le DP distinguant nom de naissance et nom d'usage.
`modalite` est initialisée à `formation`.

## Hors périmètre v1

Pièces jointes réelles (Supabase Storage), export `.docx`, signature électronique,
accompagnement du formateur par commentaires.

## Vérifications attendues

| Vérification | Comment |
|---|---|
| Impression du DP | Rendu A4 portrait, pied de page officiel, aucun champ tronqué |
| Non-régression du livret EPCF | Ouvrir un livret, saisir, imprimer, comparer au rendu validé le 19/07 |
| RLS écriture | Un compte formateur ne doit pas pouvoir écrire dans un DP (test SQL par simulation de rôle, technique déjà employée sur `benevoles`) |
| Rôle stagiaire | Le sous-onglet ouvre bien son propre DP et aucun autre |
