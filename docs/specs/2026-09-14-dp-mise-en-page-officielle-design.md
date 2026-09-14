# Dossier Professionnel : mise en page fidèle au modèle officiel · design

Date : 2026-09-14
Statut : validé par l'utilisateur, prêt pour le plan d'implémentation
Source : `Dossier professionnel Vierge 3cas.docx`, modèle ECF, version officielle du 11/09/2017
du ministère chargé de l'emploi. Copie de travail analysée : `docs/specs/2026-07-30-dp-modele-source.docx`.

Remplace, pour tout ce qui touche à l'apparence et à la pagination, la partie « Le document »
de `docs/specs/2026-07-30-dossier-professionnel-design.md`. Les décisions de rôles, de droits
et de stockage de cette spec restent en vigueur et ne sont pas rouvertes ici.

## Besoin

Le DP produit par l'app doit être visuellement indiscernable du modèle officiel. C'est un
document que le candidat présente au jury : un rendu approximatif le dessert.

Deux écarts motivent le chantier.

1. **L'habillage.** Le modèle officiel est une charte magenta avec bandeaux pleins, filets,
   cartouches et en-têtes. L'app rend un document noir et blanc qui en reprend la structure
   mais pas l'apparence.
2. **La pagination.** Les dossiers réellement remplis sont longs. Relevé en base le
   2026-09-14 sur les 11 dossiers commencés : une seule rubrique atteint 3 449 caractères,
   soit davantage qu'une page A4 pleine, et un dossier pèse 11 669 caractères. Word
   repagine tout seul dans ce cas. L'app, elle, étire la feuille : le pied de page et sa
   numérotation glissent, et le sommaire annonce des pages fausses.

Contrainte absolue : **aucune donnée déjà saisie ne doit se perdre**.

## Relevé du modèle officiel

Toutes les valeurs ci-dessous sont extraites du XML du `.docx`, pas estimées à l'œil.

### Page et marges

| Élément | Valeur |
|---|---|
| Format | A4 portrait, 210 × 297 mm |
| Marges de la couverture | 25 mm sur les quatre côtés |
| Marges des autres pages | 25 mm haut et bas, 23 mm à gauche, 20 mm à droite |
| En-tête | à 10 mm du bord sur la couverture, 13 mm ensuite |
| Pied de page | à 9 mm du bord |

La marge gauche de 23 mm vient d'une marge de 20 mm augmentée d'une gouttière de 3 mm.
Plusieurs tableaux portent un retrait négatif et débordent volontairement dans les marges :
la fiche d'exemple fait 182,6 mm de large pour une zone de texte de 167 mm. Ce débordement
est reproduit, c'est lui qui donne au document sa largeur caractéristique.

### Couleurs et typographie

| Rôle | Valeur |
|---|---|
| Accent | magenta `#D60093` |
| Texte courant | gris `#404040` |
| Titre d'en-tête | gris `#595959` |
| Pied de page | gris `#7F7F7F` |
| Filets fins | `#D9D9D9`, cadres de zone de saisie `#BFBFBF` |
| Aplats clairs | `#F2F2F2`, bande d'en-tête `#F7F7F7` |
| Police | Calibri, corps 11 pt |

La police du modèle est Calibri, absente d'iOS. La pile appliquée est
`Calibri, Carlito, "Segoe UI", system-ui, sans-serif`. Carlito est le clone libre de Calibri,
métriquement compatible. S'il peut être embarqué proprement en woff2 dans `assets/dp/`, il
l'est, et le rendu devient identique sur tous les supports, impression iPhone comprise.
Sinon la pile système suffit, avec un écart de largeur faible.

### Les 9 pages du modèle

Le document officiel fait 9 pages. Le fichier contient des sauts de page placés dans des
cellules de tableau, que Word ignore : ils ne créent pas de page. Le compte de pages
enregistré par Word dans le fichier, 9, confirme la lecture.

| Page | Rubrique |
|---|---|
| 1 | Couverture |
| 2 | Présentation du dossier |
| 3 | Sommaire |
| 4 | Intercalaire « Exemples de pratique professionnelle » |
| 5 à 7 | Trois fiches d'exemple de pratique professionnelle, une par page |
| 8 | Titres, diplômes, CQP, attestations de formation |
| 9 | Déclaration sur l'honneur |

Une fiche d'exemple tient donc sur une seule page tant qu'elle est vide, ce que l'app fait
déjà. Le modèle ne contient ni page « Documents illustrant la pratique professionnelle » ni
page « Annexes », alors que son sommaire les annonce.

### En-tête et pied de page

L'en-tête est un bloc à trois étages : une bande `#F7F7F7` surmontant un filet fin, le titre
« Dossier Professionnel (DP) » en petites capitales grises centré, puis un filet magenta de
2,25 pt.

La couverture porte en plus le logo du ministère à gauche, 31,8 × 35,7 mm, et son titre est
en 36 pt. Les autres pages n'ont pas de logo et leur titre est en 24 pt. Le « (DP) » suit le
titre en plus petit, 22 pt sur la couverture et 14 pt ailleurs.

Le pied de page alterne selon la parité de la feuille, comme dans le modèle.

| Feuille | Gauche | Droite |
|---|---|---|
| Impaire | DOSSIER PROFESSIONNEL - Version Traitement de texte - Version du 11/09/2017 | Page N |
| Paire | Page N | DOSSIER PROFESSIONNEL - Version du 11/09/2017 |

Le modèle numérote « Page N », sans total. L'app abandonne donc son « Page N / total ».

Le modèle place aussi une accolade décorative vide en bas de page. Elle n'est pas reproduite :
elle ne porte aucun texte.

### Motifs graphiques

**Bandeau de rubrique.** Barre magenta pleine sur toute la largeur, titre blanc gras 20 pt
centré. Dessous, un mince interligne puis un filet magenta de 2,25 pt, et le contenu de la
rubrique dans un cadre `#D9D9D9` de 0,5 pt. Utilisé par « Titre professionnel visé »,
« Présentation du dossier », « Titres, diplômes, CQP, attestations de formation » et
« Déclaration sur l'honneur ».

**Puce et flèche.** Le modèle utilise le caractère Wingdings 3 `U+F075`, un petit triangle
magenta de 6 pt, comme puce de liste et comme repère devant un champ à remplir. Wingdings 3
n'étant pas une police disponible, le repère est dessiné en CSS, pas appelé par son
caractère.

**Bloc d'identité de la couverture.** Retrait de 29,4 mm, largeur 137,5 mm. Chaque ligne
porte son libellé en italique magenta 12 pt, adossé à une barre magenta de 3 pt à gauche,
puis le repère triangulaire, puis le champ. Les champs n'ont pas de trait de saisie.

**Fiche d'exemple.** Cartouche de tête : « Activité-type » suivi de son numéro, en magenta
gras 18 pt aligné à droite, puis l'intitulé de l'activité en gras 12 pt. En dessous,
la ligne « Exemple n°N » en gras italique aligné à droite et l'intitulé saisi, soulignés
d'un double filet magenta fin puis épais, de 3 pt au total. Chaque question est en gras,
adossée à une barre magenta de 3 pt à gauche et suivie d'un filet magenta de 1 pt. La zone
de réponse est un cadre `#BFBFBF` de 1 pt.

**Tableau des titres et diplômes.** Trois colonnes de 40,0 / 85,1 / 47,5 mm, en-tête
`#F2F2F2` gras 14 pt centré, 10 lignes de 9 mm, filets 0,5 pt.

**Sommaire.** Titre « Sommaire » en magenta gras 24 pt souligné d'un filet magenta de 3 pt.
Les deux activités-types apparaissent sur un bandeau `#F2F2F2` à barre gauche, leurs exemples
en dessous avec le repère triangulaire, le numéro en gras italique, l'intitulé, et le numéro
de page. Le modèle place à droite de chaque ligne une petite case carrée. Elle est
reproduite, dessinée vide et non cliquable : sa fonction n'est pas documentée, et lui
attribuer un champ reviendrait à inventer de la donnée.

## Décisions validées

| Sujet | Décision |
|---|---|
| Texte plus long qu'une page | Le document se repagine, comme Word |
| Fiches d'exemple vides | La règle actuelle est conservée : la fiche n°1 de chaque activité-type s'imprime toujours, les fiches 2 et 3 seulement si elles portent du texte |
| Pages « Documents illustrant » et « Annexes » | Retirées du document. Leurs deux lignes restent au sommaire, avec une case de page vide à remplir à la main |
| Intitulé du titre visé | L'app garde sa forme correcte, « Enseignant de la conduite et de la sécurité routière ». Le modèle source a perdu un mot et ses accents, ce n'est pas une donnée du formulaire mais une saisie |
| Clés d'enregistrement | Aucune ne bouge |

## Architecture

### Le document devient un flux

Aujourd'hui `buildDpHTML` produit directement des `<section class="dp-page">` de hauteur
figée. Une rubrique vaut une page, et une rubrique trop longue étire sa page.

Désormais le gabarit ne décide plus des pages. Il produit, rubrique par rubrique, une suite
de **blocs**, et un moteur les répartit sur des feuilles A4.

| Module | Rôle |
|---|---|
| `js/dp-rules.js` | Composition logique : quelles rubriques, quelles fiches d'exemple, dans quel ordre. Ne calcule plus de numéro de page |
| `js/views/dp-gabarit.js` | Rend chaque rubrique en blocs HTML, sans se préoccuper des feuilles |
| `js/dp-pagination.js` | Nouveau. Mesure les blocs et les répartit en feuilles, en-tête et pied compris |
| `js/views/dp.js` | Orchestration, rôles, enregistrement. Inchangé dans ses principes |

Le numéro de page ne vient plus d'un compteur de rubriques mais de la pagination réelle.

### Les trois natures de bloc

| Nature | Comportement | Exemples |
|---|---|---|
| Atomique | Ne se coupe jamais. S'il ne tient pas, il passe entier sur la feuille suivante | Cartouche d'activité-type, ligne « Exemple n°N », bandeau de rubrique, en-tête d'un tableau, intitulé d'une question |
| Sécable | Se coupe entre deux lignes visuelles | Zone de rédaction, paragraphe du texte officiel, corps d'un tableau ligne à ligne |
| Ouvrant | Force une feuille neuve avant lui | Le premier bloc de chaque rubrique du dossier : couverture, présentation, sommaire, intercalaire, chaque fiche d'exemple, titres et diplômes, déclaration |

Un intitulé de question ne se sépare jamais du début de sa zone de réponse : les deux
forment un groupe dont au moins la première ligne suit le titre.

### La coupe d'une zone de rédaction

Une zone trop longue est coupée entre deux lignes visuelles. La position de coupe est
trouvée sur le DOM rendu, par recherche dichotomique sur l'offset caractère : on cherche le
plus grand offset dont le rectangle de fin tient encore dans la hauteur restante. Le reste
du texte ouvre une nouvelle zone sur la feuille suivante, sans bordure haute, pour que le
cadre se lise comme continu, exactement comme un tableau Word coupé par une page.

La mesure a lieu dans un conteneur de mesure hors écran, à la largeur utile exacte de la
feuille, rendu mais non visible. Un conteneur en `display: none` ne se mesure pas.

### Deux modes d'affichage, un seul document imprimé

Un champ `contenteditable` réparti sur deux feuilles n'est plus éditable. La saisie et la
pagination ne peuvent donc pas coexister sur le même DOM.

| Mode | Affichage | Pagination |
|---|---|---|
| Édition, le candidat sur son dossier | Flux continu, champs entiers, saisie confortable | Le moteur tourne mais ne coupe rien : il matérialise les coupures par un trait discret, non numéroté. Le ruban d'édition contient aussi les fiches vides, qui ne s'impriment pas, donc sa numérotation ne serait pas celle du document remis au jury. Les vrais numéros vivent au sommaire |
| Consultation, un formateur | Document réellement paginé | Complète |
| Impression, depuis les deux modes | Document réellement paginé | Complète |

Le document remis au jury est donc toujours le document paginé. Le mode édition n'est pas un
rendu différent, c'est le même document avec ses coupures montrées au lieu d'être appliquées,
ce qui garde le candidat maître de sa mise en page pendant qu'il écrit.

En édition, la pagination est recalculée après une pause de frappe, sur le même déclencheur
que l'enregistrement automatique, et jamais pendant une frappe. Le sommaire y affiche les
mêmes numéros de page que le document imprimé, puisqu'ils viennent de la même pagination.

### Le sommaire et ses numéros

Le sommaire est page 3 et cite les numéros des pages qui le suivent. La composition se fait
donc en deux passes : une première pagination donne les numéros, le sommaire est rempli, une
seconde pagination fige le document. La seconde passe converge toujours, un numéro de page
n'ayant pas d'influence sur la hauteur de la ligne qui le porte.

### L'impression

Le chemin d'impression existant ne change pas dans son principe : clone monté en enfant
direct de `<body>`, bascule par `body.dp-printable`, règle `@page` injectée seulement tant
qu'un dossier est ouvert, démontage au changement de route. Ces quatre points protègent
l'impression paysage du planning et sont acquis.

Ce qui change : en mode édition, le clone n'est plus une copie du document affiché mais la
version paginée, construite dans le conteneur de mesure au moment d'imprimer.

La règle `#dp-print { display: none }` hors `@media print` reste obligatoire, sans quoi le
clone s'affiche une seconde fois sous la vue.

## Préservation des données

Les clés relevées en base le 2026-09-14 sont exactement celles du gabarit actuel :
`nom_naissance`, `nom_usage`, `prenom`, `adresse`, `modalite_formation`, `modalite_vae`,
`at{1,2}_ex{1,2,3}_{titre,taches,moyens,avec_qui,entreprise,service,du,au,complement}`,
`titre{1..10}_{intitule,organisme,date}`, `dh_nom`, `dh_fait_a`, `dh_le`.

Aucune ne change. Les attributs `data-k` du nouveau gabarit portent les mêmes noms.

Deux garde-fous.

1. Un test de couverture compare l'ensemble des `data-k` produits par le gabarit à la liste
   des clés observées en production, stockée dans le test. Aucune clé observée ne doit
   manquer. La liste ne contient que des noms de clés, jamais de contenu de dossier.
2. Une vérification en session connectée sur un dossier réellement rempli, avant mise en
   production, listée dans le plan.

Le découpage d'une zone en deux morceaux ne touche que l'affichage. La sérialisation
continue de lire le champ entier depuis le document en flux, jamais depuis le document
paginé, ce qui exclut qu'une coupe d'affichage ampute un enregistrement.

## Non-régressions à tenir

| Point | Raison |
|---|---|
| Livret EPCF | Il partage `js/doc-officiel.js` et les classes `.lv-f` et `.lv-cb` de `css/livret.css`. Le nouvel habillage du DP passe uniquement par des sélecteurs préfixés `.dp-doc`, jamais par ces classes |
| Impression du planning | Elle est en A4 paysage et se casse si une règle `@page` du DP fuit hors de la vue |
| Écouteurs d'édition | Ils sont posés en délégation et survivent au remplacement du contenu. Une reconstruction ne doit jamais les reposer, sous peine d'enregistrements multipliés |
| Cache sur branche | Le re-versionnage `?v=` ne se fait que sur `main`. En local, les bancs chargent modules et feuilles avec un paramètre horodaté |
| Entrée « Nouveautés » | Toute mise en production porte son entrée dans le même commit |

## Vérifications

Sans authentification, sur banc :

- dossier vierge : 8 feuilles, une par rubrique, dans l'ordre du modèle. Le modèle Word en
  compte 9 parce qu'il ne porte qu'une activité-type avec ses trois fiches ; le titre ECSR en
  a deux, et seule la fiche n°1 de chacune s'imprime d'office ;
- dossier long : les feuilles se multiplient, chaque feuille porte son en-tête et son pied,
  la numérotation est continue, aucun texte n'est perdu ni tronqué ;
- sommaire : les numéros annoncés correspondent aux pieds de page réels, dossier long compris ;
- fiche d'exemple vide ajoutée ou retirée : pagination et sommaire recalculés ;
- édition : traits de coupe affichés, curseur conservé après repagination, un enregistrement
  par frappe et non N ;
- impression : clone paginé, exemples vides absents, aucune feuille blanche ;
- livret EPCF et impression paysage du planning : inchangés.

En session connectée, listées dans le plan : ouverture d'un dossier réel rempli, contrôle
champ par champ, impression PDF, et rendu sur iPhone en navigation privée.
