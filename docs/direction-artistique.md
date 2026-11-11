# Direction artistique ECSR Promo : « Lin »

Décision de Timy du 11/11/2026, parmi trois pistes rendues sur les mêmes supports (planches :
https://claude.ai/artifact/1KvA9ZLZJxyWrXNDk1w2GH). Ce document est la référence unique pour **l'app, la vidéo de
démonstration et les diapos**. Une couleur, une écriture ou un composant absent d'ici ne s'invente pas : il se demande à
Timy, puis s'ajoute ici.

Les illustrations (dessins des cours, schémas, images générées) gardent leurs règles propres dans le skill
`charte-illustrations` ; elles s'appuient sur la même palette.

## 1. L'idée en une phrase

L'app telle qu'on la connaît (vert olive, encre, vert profond, Outfit), posée sur un **blanc cassé lin** et des
**surfaces beige**, au lieu du gris-vert froid. Calme, chaleureux, lisible ; l'identité tient à peu de signes, toujours
les mêmes.

## 2. Les principes retenus

Tirés des pratiques des systèmes de marque reconnus (jetons à deux niveaux, nommage par rôle, retenue sur l'accent) :

1. **Peu de signes, répétés partout.** Une marque se reconnaît à deux ou trois éléments constants : ici le fond lin,
   le vert olive et la pastille de date sombre. On n'en ajoute pas d'autres au gré des supports.
2. **60-30-10.** 60 % de fond lin et de cartes, 30 % d'encre et de surfaces beige, 10 % d'olive au plus. L'olive
   signale ce qui compte (action, mot clé, donnée principale), jamais la décoration.
3. **Jetons nommés par leur rôle.** On écrit `--bg`, `--accent`, `--text-muted`, jamais `#F5F1E8` ni « beige » dans
   une règle. Changer une valeur ne renomme rien ; l'app, la vidéo et les diapos tirent des mêmes valeurs.
4. **Une seule écriture, une hiérarchie franche.** Outfit partout à l'écran. La hiérarchie vient de la taille et de la
   graisse, avec des écarts nets (titre très gros, texte calme, petites capitales espacées pour situer).
5. **Contraste AA sans exception.** 4,5:1 pour le texte, 3:1 pour le texte de 24 px et plus ou de 19 px en gras.

## 3. Palette

### 3.1 Les teintes de marque

| Nom | Valeur | Rôle |
|---|---|---|
| Lin | `#F5F1E8` | fond de page, fond des cartons et des diapos |
| Carte | `#FCFAF6` | cartes, panneaux, fenêtres |
| Beige | `#EDE5D4` | surfaces secondaires : zones de chiffres clés, panneau du carton vidéo, survol doux |
| Beige pâle | `#F0EADD` | fond subtil (bandeaux, en-têtes de tableau) |
| Filet | `#E2DACB` | traits de séparation, contour des cartes |
| Filet discret | `#EAE3D6` | séparations très légères |
| Filet fort | `#C9BFAA` | contour des champs de saisie, séparations appuyées |
| Encre | `#1F2924` | texte principal, titres |
| Encre douce | `#46554A` | texte secondaire, sous-titres |
| Discret | `#5D695E` | légendes, métadonnées (seul texte « gris » admis) |
| Olive | `#5B6C42` | accent : boutons pleins, liens, mot clé, barres de progression |
| Olive fort | `#495838` | survol d'un bouton, chiffre clé sur beige |
| Olive doux | `#EAEFD9` | fond des pastilles et des icônes, sélection |
| Olive doux 2 | `#D8E1C0` | fond olive plus marqué (état actif) |
| Vert profond | `#14201C` | barre latérale, pastille de date, bouton sombre ; jamais une grande surface ailleurs |
| Crème sur profond | `#F5E8D0` | texte sur le vert profond |
| Olive clair | `#A9BC86` | repères sur le vert profond (chiffre de la date, entrée active) |
| Texte sur olive | `#FAF1DC` | texte d'un bouton plein olive |

Restent **inchangées** et gardent leur sens partout : les teintes d'activité du planning (cours lilas `#E8E1F0`,
pédagogie sable `#F4DDB0`, voiture sauge `#DDE4C2`, contrôle pêche `#F4C7A4`), les statuts (`--c-go` `#47730E`,
`--c-wait` `#A54C08`, `--c-stop` `#964F33` et leurs fonds), l'échelle des notes (jamais de rouge), les couleurs réelles
de la signalisation.

### 3.2 Contrastes vérifiés

| Texte | Fond | Rapport | Usage permis |
|---|---|---|---|
| Encre `#1F2924` | Lin `#F5F1E8` | 13,3:1 | tout texte |
| Encre douce `#46554A` | Lin | 7,0:1 | tout texte |
| Discret `#5D695E` | Lin | 5,1:1 | tout texte |
| Discret | Carte `#FCFAF6` | 5,5:1 | tout texte |
| Discret | Beige pâle `#F0EADD` | 4,8:1 | tout texte |
| Discret | Beige `#EDE5D4` | 4,6:1 | tout texte (limite : ne pas éclaircir) |
| Encre | Beige | 12,0:1 | tout texte |
| Olive `#5B6C42` | Lin | 5,1:1 | tout texte |
| Olive | Carte | 5,5:1 | tout texte |
| Olive | Olive doux `#EAEFD9` | 4,9:1 | tout texte |
| Olive fort `#495838` | Beige | 6,1:1 | tout texte |
| Texte sur olive `#FAF1DC` | Olive | 5,1:1 | texte de bouton |
| Crème sur profond `#F5E8D0` | Vert profond `#14201C` | 13,8:1 | tout texte |
| Olive clair `#A9BC86` | Vert profond | 8,2:1 | repères, chiffre de la date |
| Étiquette `#556157` | Sable `#F4DDB0` | 4,9:1 | étiquettes du planning |

À éviter : **l'olive sur le beige** (4,6:1 sur `#EDE5D4`, juste au seuil) : on y prend l'olive fort. Interdit : tout
texte sur le sable `#F4DDB0` autre que l'encre ou l'étiquette.

## 4. Typographie

**Outfit seule** pour l'app, la vidéo (cartons et sous-titres) et les diapos. Canela reste aux titres des documents
imprimés (livret, attestations, dossier) ; la chasse fixe au code et aux traces techniques. Les chiffres qui se
comparent (dates, heures, compteurs, notes) prennent `font-variant-numeric: tabular-nums`.

| Graisse | Emploi |
|---|---|
| 300 | grand chiffre décoratif du carton vidéo (« 02 ») |
| 400 | texte courant |
| 500 | sous-titres de vidéo |
| 600 | tous les titres, boutons, petites capitales |
| 700 | chiffres clés (« 10 sur 14 », « 105 h ») |

Titres : interlignage 1,05 à 1,1, approche `-0.015em`. Petites capitales de situation (« CHAPITRE 2 », « CE QU'UNE
PROMO Y GAGNE ») : 600, capitales, espacement `0.16em`, en olive.

### Échelles

| Rôle | App (ordinateur) | App (téléphone) | Diapo et vidéo (1920 × 1080) |
|---|---|---|---|
| Titre de page / de diapo de titre | 35 px (2,2 rem) | 22 px (1,4 rem) | 128 px |
| Titre de diapo de contenu, de carton | | | 76 px (contenu), 132 px (carton) |
| Titre de carte | 18 px | 17 px | 27 px |
| Chiffre clé | 32 px | 28 px | 50 à 64 px |
| Texte courant | 16 px | 16 px | 32 px (chapeau), 24 à 26 px (corps) |
| Légende, métadonnée | 13 à 14 px | 13 px | 22 à 24 px |
| Petites capitales | 12 px | 12 px | 24 px |
| Sous-titre de vidéo | | | 46 px, graisse 500 |

Jamais de texte sous 11 px dans l'app, ni sous 22 px sur une diapo ou un plan de vidéo en 1920 × 1080.

## 5. Composants signatures

1. **La pastille de date.** Pilule vert profond, « Mardi **13** octobre », le chiffre en olive clair, gras, chiffres
   de même largeur. C'est le premier signe de l'app : elle ouvre la page Aujourd'hui et peut ouvrir un carton de vidéo.
2. **La carte.** Fond carte `#FCFAF6`, contour filet 1 px (2 px à l'échelle 1920), rayon 14 px dans l'app (22 px en
   1920), aucune ombre marquée. En-tête : icône sur un carré olive doux, titre 600.
3. **Le panneau beige.** Surface beige `#EDE5D4`, rayon 20 px, sans contour : il porte les chiffres clés (diapos) et le
   grand numéro de chapitre (vidéo). Le beige ne sert qu'à mettre en avant, jamais de fond de page.
4. **Les pastilles de statut.** Pilule, fond doux et texte foncé du même statut (« Ouverte » : `#ECF6D5` et `#47730E`).
5. **La barre de progression.** Piste beige, remplissage olive, bouts arrondis.
6. **Le logo.** Barre oblique en olive, lettres en encre ; sur le vert profond, barre en olive clair et lettres en crème.
   Il ne se déforme pas, ne se recolore pas autrement, ne se pose pas sur une image chargée.

## 6. Règles par support

### App

- Fond `--bg` lin, cartes `--bg-elev`, barre latérale vert profond. Les règles existantes restent : jetons seuls (garde
  `tests/habillage-jetons.test.mjs`), cibles de 44 px, aucun défilement de côté sauf la matrice des notes, jamais une
  note en rouge.
- L'habillage « Couleurs ECF » reste une option ; il ne reprend pas le lin.

### Vidéo

- **Carton de chapitre** : fond lin, marges de 128 px ; à gauche les petites capitales (« Chapitre 2 · Le planning »),
  le titre en 132 px sur deux lignes au plus, un chapeau en encre douce ; à droite le panneau beige portant le numéro
  « 02 » en Outfit 300 olive fort ; en bas à gauche le logo et « ECSR Promo ».
- **Plan de l'app** : la capture posée sur le lin, rayon 26 px, contour filet.
- **Sous-titres** : bandeau vert profond à 90 %, texte `#FBF6EC` Outfit 500 46 px, centré, rayon 14 px, deux lignes au
  plus, à 70 px du bas.

### Diapos

- Fond lin, marges de 128 px, logo en haut à gauche (110 px de haut sur la diapo de titre).
- **Titre** : petites capitales de situation, titre 128 px, sous-titre encre douce, puis une rangée de deux ou trois
  panneaux beige pour les chiffres clés.
- **Contenu** : petites capitales, titre 76 px (une idée, deux lignes au plus), puis la preuve (panneaux beige, barres
  olive aux longueurs exactes), pied de page discret (source à gauche, numéro de diapo à droite).
- Un seul mot clé du titre peut passer en olive, et seulement s'il porte le message.
- L'illustration de route est admise en couverture seule, sur fond lin, selon la charte des illustrations.

## 7. Ce qui est interdit

- Toute couleur hors de ce document ; le bleu en surface ; le jaune saturé ; un dégradé ; une ombre marquée.
- L'ambre comme couleur de marque : il signale « à surveiller » dans l'app et ne sert qu'à cela.
- Le vert profond en grande surface, hors barre latérale de l'app.
- Une deuxième écriture à l'écran (Canela, chasse fixe hors code).
- Plus d'un accent sur un même écran, plus d'un mot clé coloré dans un titre.
- Un texte sous le seuil AA ; un texte sur une image sans fond.
- Les émojis comme repères ; le tiret cadratin.

## 8. Jetons prêts à coller

### 8.1 `css/style.css` (bloc `:root`, seules les valeurs qui changent)

```css
  /* --- Neutres « Lin » (DA du 11/11/2026, docs/direction-artistique.md) --- */
  --bg:        #F5F1E8;   /* lin */
  --bg-elev:   #FCFAF6;   /* carte */
  --bg-soft:   #EDE5D4;   /* beige */
  --bg-subtle: #F0EADD;   /* beige pâle */
  --bg-survol: #EDE5D4;

  --line:        #E2DACB;
  --line-strong: #C9BFAA;
  --line-faint:  #EAE3D6;
```

Inchangés : `--bg-deep`, `--text*`, `--accent*`, `--sur-sombre*`, statuts, activités, notes, signalisation. À vérifier
lors de la mise en place : la garde des contrastes (`node --test "tests/*.test.mjs"`), les captures des deux habillages
et le robot des parcours, comme pour toute fusion.

### 8.2 Studio vidéo (`tools/tournage-demo/studio/studio.html`, bloc `body.da-app`)

```css
body.da-app { --creme: #F5F1E8; --peche: #EDE5D4; --ambre: #5B6C42; --vert: #5B6C42; --vert-fonce: #495838;
  --vert-pale: #EAEFD9; --encre: #1F2924; --doux: #46554A; --filet: #E2DACB;
  --carte: #FCFAF6; --profond: #14201C; --sur-profond: #F5E8D0; --repere: #A9BC86; --discret: #5D695E;
  --titre: "Outfit", system-ui, sans-serif; --mono: "Outfit", system-ui, sans-serif; }
```

### 8.3 Diapos (valeurs à reprendre dans chaque diapo)

| Rôle dans la diapo | Valeur |
|---|---|
| Fond de diapo | `#F5F1E8` |
| Panneau de chiffres clés | `#EDE5D4`, rayon 20 px |
| Carte | `#FCFAF6`, contour `#E2DACB` 2 px, rayon 22 px |
| Titre, texte | `#1F2924` |
| Chapeau, sous-titre | `#46554A` |
| Pied de page, source | `#5D695E` |
| Petites capitales, mot clé, barres | `#5B6C42` |
| Chiffre clé sur panneau beige | `#495838` |
| Écriture | Outfit (Google Fonts, graisses 300 à 700) |
