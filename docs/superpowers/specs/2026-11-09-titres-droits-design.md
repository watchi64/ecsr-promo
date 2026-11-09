# Titres et droits à la carte (conception)

Date : 09/11/2026. Statut : **validée par Timy le 09/11/2026** (« Je valide »). Maquette cliquable de la page Équipe montrée le 09/11
(widget de la conversation « Cadrer titres et droits »), jugée « super » par Timy. Relue par un agent indépendant dans
la peau du bâtisseur (09/11) : ses questions sont réglées ici (choix de Claude, § 16) ou posées à Timy (§ 12). La
construction vient **après la fusion du lot 5** de la refonte, qui touche les mêmes tables (voir § 3).

Vocabulaire de ce document :

| Mot | Sens |
|---|---|
| Base | la base de données Supabase de l'app ; ses **règles RLS** (Row Level Security, règles de sécurité par ligne) décident de ce que chaque compte peut lire ou écrire |
| Espace | la forme de l'app selon le rôle (lot 1 et lot 5) : stagiaire (barre d'onglets), Formateur, Direction, Siège (barre latérale), chacun avec ses entrées |
| Portée | le terrain sur lequel s'exercent des droits : une ou plusieurs promos, un centre, le réseau |
| Affectation | une ligne de la table `affectations` (lot 4) : un compte, un rôle, une portée |
| Geste | une action précise permise par la base (saisir une note, ouvrir une feuille, inviter un stagiaire...) |
| Fondateur | Timy (`is_founder`), accès technique complet |

## 1. Intention

Demande de Timy (09/11, vers 18 h), en voyant l'étiquette « formateur » affichée à tort pour un compte de direction :
la gestion des droits et des titres est « primordiale » ; la direction ou le siège doivent pouvoir inviter des
personnes et leur donner certains droits, « de manière modulaire », selon leur titre et leur niveau d'accès ; le tout
« modulable, clair d'utilisation et surtout sécurisé ».

Deux précisions de Timy pendant le cadrage :
- **ne pas empiéter sur l'affichage par rôle** (les espaces de la refonte), trouver un juste équilibre ; **le plus
  important reste que ce soit simple à utiliser** ;
- des **rôles de base**, puis quelque chose de plus modulaire pour des rôles plus spécifiques (secrétariat, ressources
  humaines, responsable pédagogique...). C'est aux centres de voir ce qui leur convient, mais l'app doit **pré-mâcher
  le travail** pour que ce soit logique et limpide.

Pourquoi maintenant : le lot 5 ouvre les espaces direction et siège, donc les invitations de personnel. Les centres ont
d'autres métiers que formateur et direction, et l'app ne sait aujourd'hui en nommer aucun.

## 2. Le principe

**Le rôle décide de l'espace, le titre décide de ce qu'on y fait.**

```
Niveau (espace + portée)  →  Titre (nom + cases)  →  Personne
```

| Notion | Ce que c'est | Exemple |
|---|---|---|
| **Niveau** | les rôles du lot 4 : il fixe l'espace (la barre) et la portée | « pour certaines promos » (espace Formateur), « pour tout le centre » (espace Direction), « pour tout le réseau » (espace Siège) |
| **Titre** | le nom affiché partout (Équipe, Personnes avec accès, menu du compte), choisi dans une liste | Secrétariat, Responsable pédagogique |
| **Cases** | ce que le titre permet, page par page de son espace : **Non**, **Voir** ou **Modifier** | Secrétariat : Stagiaires Modifier, Notes et examens Non |

- Un titre appartient à **un seul niveau** et ne coche que des pages de **son** espace.
- **Les espaces ne changent pas** : un titre allume ou éteint des entrées à l'intérieur de l'espace que son niveau
  fixe, comme un module fermé masque aujourd'hui une entrée chez les stagiaires. Aucune entrée nouvelle, aucun espace
  nouveau.
- Une personne qui a besoin de deux espaces reçoit **deux titres** (un par niveau) et passe de l'un à l'autre par son
  menu, comme une directrice qui forme (spec de la refonte, § 4.3).
- **Pas de réglage personne par personne** : pour changer ce que fait quelqu'un, on change son titre. Ce que fait une
  personne se lit donc dans son titre.
- **C'est la base qui vérifie chaque case à chaque demande.** L'écran ne fait que refléter ses règles.

## 3. Ce que cette spec suppose (lots 4 et 5)

Du lot 4 (en ligne depuis le 08/11, fbd1541) : la table `affectations` (compte, rôle `formateur`, `direction` ou
`siege`, promo ou centre), le vocabulaire SQL (`est_formateur(p)`, `est_direction(l)`, `est_siege()`,
`formateur_courant()`, `direction_courante()`, `equipe_courante()`, `redacteur_contenus()`, `lieu_de_promo(p)`,
`roles_reels(p)`), l'aperçu par l'en-tête `x-apercu-role`, la fonction `inviter_compte`, la preuve SQL de la matrice
des droits (`tests/sql/roles-preuve.sql`) et son empreinte.

Du lot 5 (branche `lot5-espaces`, plan `docs/superpowers/plans/2026-11-08-refonte-navigation-lot-5-direction-siege.md`),
**fusionné dans main et appliqué en base avant le début de la construction** :
- les quatre espaces et leurs entrées (`js/nav-rules.js` : `ENTREES_EQUIPE`, `ENTREES_DIRECTION`, `ENTREES_SIEGE`,
  listes fixes de la barre du téléphone) ; l'ordre des espaces permis d'un compte (décision D2) ;
- la page **Équipe** de la direction (`js/views/direction-equipe.js`, fonction `regler_affectations_formateur`), la page
  **Directions de centre** du siège (`js/views/siege-directions.js`, `creer_centre`, `retirerAffectation`),
  l'invitation d'un compte siège depuis les Réglages du fondateur ; leur preuve (`tests/sql/espaces-preuve.sql`) ;
- `inviter_compte` qui refuse l'adresse d'un compte stagiaire, **pour un formateur seulement** : les invitations de
  direction et de siège l'acceptent encore (faille notée dans la roadmap). Cette spec la ferme pour tout titre du
  personnel (§ 7) ;
- l'affichage du vrai rôle des comptes direction et siège dans « Personnes avec accès », **décidé le 09/11 et pas
  encore fait** sur la branche : cette spec le remplace par le titre ;
- la décision du 09/11 : une direction voit le nom et les notes d'un stagiaire **qui a masqué ses notes**, comme un
  formateur (inchangée) ;
- la Partie E (habillage par défaut du centre et du réseau, tâche 14), **pas encore construite** au 09/11. Si elle ne
  part pas avec le lot 5, les pages Réglages du centre et Réglages du réseau n'existent pas encore : leurs cases suivent
  alors la règle d'une page ajoutée plus tard (§ 6.1).

Si le lot 5 change l'un de ces points avant sa fusion, le plan de cette spec part de l'état fusionné.

## 4. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Chaque membre du personnel a un titre lisible, affiché partout où l'app montre une personne de l'équipe.
- La direction et le siège invitent une personne en deux gestes : une adresse, un titre (plus ses promos pour un titre
  de formateur).
- Un catalogue de titres prêts à l'emploi couvre les métiers courants d'un centre ; chacun peut l'ajuster.
- Chaque case est vraie en base : « Non » ferme la lecture des données de la page, « Voir » ferme l'écriture.
- Chaque changement de droits du personnel laisse une trace que personne ne peut modifier.
- **Zéro changement pour les comptes existants** : ils reçoivent les titres fixes, qui donnent exactement leurs droits
  d'aujourd'hui, geste par geste, y compris qui peut nommer qui (§ 6.1).

**Non-objectifs**
- Des droits réglés personne par personne.
- Un titre pour les stagiaires (leur titre est fixe, ce qu'ils voient reste réglé par les modules de leur promo).
- Un titre pour une personne sans compte (voir § 13).
- Une nouvelle entrée de barre ou un nouvel espace ; la barre de la direction reste sans Planning ni Cours et QCM
  (décision D15 du lot 5).
- Une portée plus fine que la promo (par exemple un tuteur qui ne verrait qu'un stagiaire).
- Des droits à durée limitée, des groupes de personnes, une connexion par un annuaire d'entreprise.

**Anti-objectifs (échec même si « ça marche »)**
- Un droit qui n'existe que dans l'interface.
- Une personne qui peut augmenter ses propres droits, directement ou en passant par un titre qu'elle porte.
- Une page blanche de quarante cases pour créer un titre.
- Un espace qui change de forme selon le titre au-delà d'entrées masquées.
- Un compte existant qui perd ou gagne un droit au passage.
- Le mot « prof » à l'écran (on écrit « formateur »).

## 5. Les pages et leurs cases

**Ce que vaut une case.** Le maximum d'une page à un niveau, ce sont **les gestes que le titre fixe de ce niveau a
aujourd'hui** sur cette page, geste par geste. « Modifier » ouvre ces gestes-là, jamais plus : la page Stagiaires sur
« Modifier » au niveau du centre ouvre les gestes de la direction (inviter, modifier une fiche, déclarer un abandon),
pas ceux que la base réserve au formateur (supprimer une fiche, écrire les bénévoles et les auto-écoles). « Voir » ouvre
les lectures de la page, « Non » les ferme.

L'**accueil** de chaque espace (Aujourd'hui, Vue d'ensemble) n'a pas de case : il est toujours là, mais **chacun de ses
blocs suit la case de sa donnée** (sans « Notes et examens », ni moyenne ni « À suivre de près »). L'accueil du siège ne
montre que des chiffres agrégés, sans nom.

Une page n'offre que les choix qui ont un sens : une page sans geste d'écriture plafonne à « Voir », une page de
réglages n'a que « Non » et « Modifier ».

### 5.1 Pour certaines promos (espace Formateur)

| Page | Choix | « Voir » permet | « Modifier » permet en plus |
|---|---|---|---|
| Planning | Non, Voir, Modifier | Semaine, Dates clés, Priorités | modifier le planning, les passages, les jours sans cours |
| Émargement | Non, Voir, Modifier | les feuilles de la promo | ouvrir et clore une feuille, signer comme formateur |
| Stagiaires | Non, Voir, Modifier | liste, fiches, élèves bénévoles | inviter un stagiaire, modifier une fiche, déclarer un abandon, gérer les bénévoles et les auto-écoles |
| Notes et examens | Non, Voir, Modifier | matrice, EPCF, synthèse ; notes, livret et dossier pro dans la fiche | saisir les notes et l'EPCF, évaluer livret et dossier pro, ouvrir les examens de QCM |
| Cours et QCM | Non, Voir, Modifier | thèmes, compétences, QCM, documents | modifier et publier, traiter les signalements et les propositions de l'IA |
| CCP2 | Non, Voir | le parcours en 8 étapes | (page sans écriture) |
| Indicateurs | Non, Voir | les indicateurs de la promo | (page sans écriture) |
| Réglages de la promo | Non, Modifier | | nom de la promo, modules ouverts aux stagiaires, autres réglages, liste « Personnes avec accès » |

Les cours et les questions de QCM sont **communs à tout le réseau** : « Cours et QCM : Modifier » permet de les
modifier pour tous, comme le formateur aujourd'hui (décision 4 du 27/10). L'éditeur de titre le dit à côté de la case.

### 5.2 Pour tout le centre (espace Direction)

| Page | Choix | « Voir » permet | « Modifier » permet en plus |
|---|---|---|---|
| Promos | Non, Voir, Modifier | les promos du centre, leurs dates, leurs modules | créer une promo, changer son nom et ses dates, ouvrir ou fermer ses modules |
| Stagiaires | Non, Voir, Modifier | liste du centre, fiches (identité, coordonnées, passages) | inviter un stagiaire, modifier une fiche, déclarer un abandon |
| Émargement | Non, Voir | feuilles signées, présence, export | (la direction n'ouvre pas les feuilles) |
| Notes et examens | Non, Voir | synthèse et notes de chaque promo ; notes, livret et dossier pro dans la fiche | (la direction ne saisit pas) |
| Équipe | Non, Voir, Modifier | les personnes, leurs titres, le journal du centre | inviter, donner ou retirer un titre, créer et ajuster les titres du centre |
| Réglages du centre | Non, Modifier | | habillage par défaut du centre |

### 5.3 Pour tout le réseau (espace Siège)

| Page | Choix | « Voir » permet | « Modifier » permet en plus |
|---|---|---|---|
| Cours et QCM | Non, Voir, Modifier | les contenus communs | rédiger et publier les contenus communs |
| Directions de centre | Non, Voir, Modifier | centres, leurs directions, le journal du réseau | créer un centre, inviter une direction, donner ou retirer un titre de centre, gérer les titres du réseau |
| Réglages du réseau | Non, Modifier | | habillage par défaut du réseau |

Le siège ne lit aucune donnée nominative (décision du 27/10) : aucune case du réseau n'y donne accès.

### 5.4 Une page qui s'appuie sur les données d'une autre

- **Noms des stagiaires.** Émargement, Notes et examens, Planning (passages) et Indicateurs (« À suivre de près »)
  montrent des noms de stagiaires. Un titre qui ouvre l'une d'elles (au moins « Voir ») a donc au moins « Voir » sur
  Stagiaires, au même niveau : l'éditeur relève Stagiaires de lui-même et le dit en une phrase.
- **Chiffres tirés d'une autre page.** Un bloc calculé avec les données d'une autre page suit la case de cette page,
  comme sur l'accueil : sans « Notes et examens », les Indicateurs ne montrent ni moyenne ni réussite aux QCM. La base
  le garantit déjà (elle ne rend pas ces données), l'écran masque le bloc au lieu d'afficher un zéro trompeur.
- Les cartes de la page Promos montrent des effectifs (des nombres) et les noms des formateurs : rien de plus à régler.

### 5.5 Les gestes définitifs

Les gestes qui effacent pour de bon restent **à ceux qui les ont aujourd'hui**, quelles que soient les cases d'un autre
titre : l'anonymisation d'un stagiaire ou d'une promo (titres fixes Formateur et Direction de centre), la suppression
d'une fiche de stagiaire et la purge des élèves bénévoles (titre fixe Formateur). Le plan vérifie qu'il n'en existe pas
d'autres.

### 5.6 Les droits sans page des titres fixes

Quelques droits d'aujourd'hui n'ont pas de page dans l'espace de leur titre. Ils restent aux **seuls titres fixes**, pour
tenir le zéro changement, et sont listés ici pour que ce qu'ils permettent reste lisible :
- Direction de centre : lire les cours de thème non publiés et leurs versions ;
- Formateur et Direction de centre : écrire les fiches des formateurs (`profs`) et les contacts du centre (`contacts`,
  en attendant l'espace contact, § 13).

Les autres titres n'ont que ce que disent leurs cases.

## 6. Les titres

### 6.1 Les titres fixes

| Titre | Niveau | Cases | Qui le donne (comme aujourd'hui) |
|---|---|---|---|
| **Stagiaire** | (sa promo, sur sa fiche) | aucune : ce qu'il voit dépend des modules de sa promo | un titre de promo ou de centre avec Stagiaires sur Modifier |
| **Formateur** | certaines promos | toutes au maximum (Planning, Émargement, Stagiaires, Notes et examens, Cours et QCM, Réglages : Modifier ; CCP2, Indicateurs : Voir) | la direction du centre, le fondateur |
| **Direction de centre** | tout le centre | toutes au maximum (Promos, Stagiaires, Équipe, Réglages : Modifier ; Émargement, Notes et examens : Voir) | le siège, le fondateur |
| **Siège** | tout le réseau | toutes au maximum (Modifier partout) | le fondateur |

- Ils ne se modifient pas et ne se suppriment pas (cadenas à l'écran).
- **Ils se donnent et se retirent exactement comme aujourd'hui** : une direction ne nomme pas une autre direction, un
  siège ne nomme pas un autre siège (la preuve du lot 4 le vérifie et reste verte). Une direction peut se donner le titre
  Formateur sur les promos de son centre (la directrice qui forme, prouvé au lot 5) : c'est la seule exception à la règle
  « jamais sur soi-même » du § 7.
- Les comptes existants les reçoivent : chaque affectation `formateur`, `direction`, `siege` du lot 4 prend le titre fixe
  de son niveau. Le stagiaire garde sa fiche (lot 4) ; « Stagiaire » est un libellé, sans ligne de titre en base.

Une **page ajoutée plus tard** à un espace (Qualiopi au lot 5Q, Veille réglementaire, Réglages si la Partie E du lot 5
tarde) est au maximum pour le titre fixe de ce niveau et sur « Non » pour tous les autres titres. Le lot qui ajoute la
page peut proposer d'ouvrir une case du catalogue (par exemple Qualiopi en « Voir » pour le titre Qualité) ; les titres
créés par les centres restent sur « Non » jusqu'à ce qu'on les ajuste.

### 6.2 Le catalogue livré d'office

Titres du réseau créés par la migration, utilisables tels quels dans tous les centres :

| Titre | Niveau | Cases |
|---|---|---|
| Responsable pédagogique | tout le centre | Promos Modifier, Stagiaires Modifier, Émargement Voir, Notes et examens Voir, Équipe Voir, Réglages Non |
| Secrétariat | tout le centre | Promos Voir, Stagiaires Modifier, Émargement Voir, Notes et examens Non, Équipe Voir, Réglages Non |
| Ressources humaines | tout le centre | Promos Voir, Équipe Voir, tout le reste Non |
| Intervenant | certaines promos | Planning Voir, Émargement Modifier, Stagiaires Voir, Cours et QCM Voir, tout le reste Non |
| Contenus pédagogiques | tout le réseau | Cours et QCM Modifier, Directions de centre Non, Réglages Non |
| Qualité | tout le réseau | Cours et QCM Voir, Directions de centre Voir, Réglages Non |

Un responsable pédagogique qui donne aussi des cours reçoit en plus le titre Formateur sur ses promos.

### 6.3 Créer, ajuster, supprimer

- **Créer** un titre part toujours d'un titre existant (« Créer un titre à partir de celui ouvert »), jamais d'une page
  blanche. Le nouveau titre a le même niveau.
- **Titres du centre** : créés et ajustés par une personne du centre qui a Équipe sur Modifier. **Titres du réseau** :
  par le siège (Directions de centre sur Modifier) et le fondateur.
- **Ajuster un titre du réseau depuis un centre** crée la version de ce centre (même nom) et y fait passer les
  personnes de ce centre qui portaient le titre du réseau, après confirmation (« 1 personne passera à la version du
  centre »). Les autres centres ne voient rien changer.
- **Ajuster les cases d'un titre** touche tous ceux qui le portent : l'écran le dit avant d'enregistrer (« 3 personnes
  ont ce titre : leurs droits changeront dès l'enregistrement »).
- **Supprimer** un titre n'est possible que s'il n'est plus porté par personne.
- Deux titres de même portée ne portent pas le même nom (casse ignorée).
- **Un titre par niveau et par centre** pour une personne : au plus un titre de promo dans un centre (appliqué aux
  promos cochées) et au plus un titre de centre. Formateur sur une promo et Intervenant sur une autre du même centre
  n'est pas possible : on choisit le titre qui convient aux deux, ou on en crée un.

## 7. Qui donne quoi

Quatre règles, toutes vérifiées par la base :

1. **Personne ne touche à ses propres droits** : ni ses titres, ni les cases d'un titre qu'il porte. Seule exception :
   la direction qui se donne le titre Formateur (§ 6.1). Cela règle la question laissée par le lot 4 : un siège ne peut
   pas se nommer direction d'un centre.
2. **On ne donne que sur son terrain** : la direction dans son centre, le siège dans le réseau.
3. **Entre collègues du même niveau, jamais plus que ce qu'on a** : un titre de centre (non fixe) donné, créé, ajusté
   ou retiré par une personne de niveau centre a, page par page, des cases au plus égales aux siennes ; de même au niveau
   du réseau. Les titres fixes suivent le § 6.1.
4. **Gérer les personnes et les titres est une case** : Équipe (centre) ou Directions de centre (réseau), sur Modifier.

**Retirer obéit aux mêmes règles que donner** : on ne retire que ce qu'on pourrait donner. Une personne qui a Équipe sur
Modifier mais un titre plus faible que la direction ne peut donc pas retirer son titre à une directrice.

| Qui | Peut donner, créer, ajuster, retirer |
|---|---|
| Fondateur | tout |
| Siège (titre fixe) | Direction de centre et les autres titres de centre, dans tous les centres ; les titres du réseau non fixes |
| Autre titre du réseau (Directions de centre : Modifier) | les titres de centre non fixes, dans tous les centres ; les titres du réseau non fixes au plus égaux au sien |
| Direction de centre (titre fixe) | Formateur et les autres titres de promo, sur les promos de son centre (Formateur aussi pour elle-même) ; les titres de centre non fixes |
| Autre titre de centre (Équipe : Modifier) | les titres de promo non fixes, sur les promos de son centre ; les titres de centre non fixes au plus égaux au sien |
| Titre de promo ou de centre avec Stagiaires sur Modifier | l'accès stagiaire aux promos de sa portée, comme aujourd'hui |

Une adresse qui a une fiche de stagiaire ne reçoit **aucun** titre du personnel, quel que soit le niveau (la faille
ouverte du lot 4 pour la direction et le siège se ferme ici).

**Risque assumé, dit à l'écran** : la règle 3 ne joue qu'au même niveau. Donner « Équipe : Modifier », c'est confier le
droit de nommer des intervenants, donc de faire faire par d'autres ce qu'on ne fait pas soi-même ; de même, le siège
nomme des directions qui voient des noms qu'il ne voit pas (décision D14 du lot 5). L'éditeur l'écrit à côté de la case
(bandeau de la maquette) et le journal garde la trace de chaque nomination.

## 8. Retrait

- La base lit les titres à chaque demande : un titre retiré ou une case décochée prend effet **dès la demande
  suivante**. L'écran se met à jour à la prochaine ouverture de l'app ; d'ici là, un bouton encore visible reçoit le
  refus de la base, montré en une phrase.
- Retirer le dernier titre de quelqu'un lui ferme l'app (la porte du lot 4 refuse un compte sans portée) ; son compte
  reste, seul le fondateur supprime un compte (lot 4).
- Une direction ne se retire pas elle-même (règle 1) : un centre ne peut pas perdre sa dernière direction de son propre
  fait.

## 9. Journal des droits du personnel

- La base note chaque titre du personnel **donné ou retiré** (invitation comprise) et chaque titre **créé, ajusté ou
  supprimé** : quand, par qui, pour qui (ou quel titre), sur quelle portée, l'avant et l'après. Elle l'écrit elle-même
  (déclencheurs), aucun écran ne peut le modifier. Les invitations de stagiaires n'y figurent pas : aucune adresse de
  stagiaire dans le journal, donc rien de nominatif pour le siège.
- Lecture : une personne du centre qui a Équipe au moins sur Voir lit celui de son centre ; le siège (Directions de
  centre au moins sur Voir) celui du réseau ; le fondateur tout.
- Conservation **3 ans**, comme les preuves de la formation, puis effacement automatique. Une demande d'effacement d'un
  membre du personnel remplace son adresse par « compte effacé » dans le journal (la trace du geste reste). Ces deux
  points entrent dans les conditions d'utilisation (§ 12).
- À l'écran : une section « Journal » repliée en bas de la page Équipe et de la page Directions de centre, phrases
  simples (« 09/11, Camille R. a donné le titre Secrétariat à alex@... »).

## 10. Ce que voit chacun

- **La personne invitée** arrive sur l'accueil de son espace. Le menu de son compte montre « Mon titre » (avec sa
  portée : « Secrétariat · Centre de ... ») et « Ce que je peux faire », la liste lisible de ses cases.
- **Sa barre** : une case sur « Non » masque l'entrée. Sur téléphone, la barre du bas garde la liste fixe de son espace
  (lot 5) moins les entrées masquées, complétée par les entrées visibles suivantes dans l'ordre de la barre, puis
  « Plus ». Un titre fixe a donc exactement la barre d'aujourd'hui.
- **« Voir »** montre la page sans ses gestes d'écriture (boutons, cases, formulaires).
- **Personnes avec accès** (Réglages de la promo) et **Équipe** montrent le titre de chacun ; une personne qui en a deux
  les montre tous les deux (« Responsable pédagogique », « Formateur · 2 promos »).
- **L'aperçu du fondateur** (« Voir en tant que ») gagne les titres : le fondateur voit l'app exactement comme un
  Secrétariat ou un Intervenant (nécessaire pour vérifier un titre). L'éditeur de titre montre aussi « Sa barre » en
  direct, pour la direction et le siège.

## 11. Les écrans (maquette du 09/11)

**Page Équipe de la direction** (lot 5, enrichie), dans cet ordre :
1. **Personnes avec accès** : nom, titres en pastilles.
2. **Inviter une personne** : adresse e-mail, titre (liste groupée « Pour tout le centre », « Pour certaines promos ») ;
   pour un titre de promo, les promos du centre à cocher ; dessous, « Ce qu'elle pourra faire » (cases ouvertes) et
   « Masqué dans sa barre » ; bouton « Inviter ». Seuls les titres que la personne connectée a le droit de donner
   (§ 7) figurent dans la liste.
3. **Titres du centre** : chaque titre avec son niveau, son origine (réseau ou centre) et son nombre de porteurs ;
   cadenas et « Fixe » pour les titres fixes, « Ajuster » pour les autres ; « Créer un titre à partir de celui ouvert ».
4. **Ajuster un titre** : nom, niveau (rappel), une ligne par page avec ses choix (Non, Voir, Modifier), bandeaux
   d'avertissement (Équipe sur Modifier ; Cours et QCM sur Modifier, contenus communs au réseau), Stagiaires relevé de
   lui-même (§ 5.4), « Sa barre » en direct, nombre de porteurs, « Enregistrer ».
5. **Journal** (replié).

**Page Directions de centre du siège** : même organisation, centre par centre, avec les titres de centre et les titres
du réseau. **Réglages du fondateur** : invitation d'un compte siège avec un titre du réseau.

Règles de la refonte qui s'appliquent : aucun défilement de côté (tableaux en listes sur téléphone), cibles de 44 px
sur téléphone, contraste AA, « Formateur » et jamais « prof », phrases de refus de la base montrées telles quelles.

## 12. Conditions d'utilisation

Les conditions d'utilisation (`js/legal-data.js`, § 4 « Qui voit quoi ») nomment aujourd'hui deux catégories de lecteurs
des données des stagiaires : les **formateurs** et **ECF**. Avec les titres, de nouvelles personnes lisent ces données
(un secrétariat voit les fiches et les dates de naissance, un intervenant les feuilles d'émargement) : c'est un nouveau
destinataire, donc une nouvelle version des conditions, que chaque compte accepte de nouveau à sa prochaine ouverture
(règle de `VERSION_CONDITIONS`). Le journal du § 9 et sa durée y entrent aussi.

Constat fait en relisant : le tableau dit déjà « ECF : Non » pour le planning, les passages et la date de naissance,
alors que le lot 4 laisse une direction les lire. Aucun compte de direction n'existe encore ; ce point est remonté à la
coordination, pour qu'il soit réglé avant la première invitation d'une direction (lot 5).

**Décision de Timy (09/11) : une version regroupée.** La nouvelle version des conditions qui ajoute les titres et le
journal sort **en même temps que la prochaine retouche des textes Qualiopi** (lots Q4 et Q5), pour que chaque compte
n'accepte qu'une fois. Conséquences pour le plan (choix de Claude) :
- les titres fixes ne changent aucun lecteur : ils peuvent passer en ligne avant cette version ;
- les titres non fixes (catalogue et titres créés par les centres) ne peuvent être donnés qu'une fois la nouvelle
  version en ligne ;
- si les textes de Q4 et Q5 sont déjà en ligne quand les titres sont prêts, la version des titres sort seule, et le plan
  le signale à Timy avant.

## 13. Personnes sans compte

Un titre donne des droits ; une personne sans compte (par exemple une secrétaire inscrite seulement dans les contacts du
centre) n'en a pas. Sa fiche contact garde un **libellé libre**, avec les titres du centre proposés en suggestion. Ce
point appartient à la conversation « Cadrer l'espace contact et la messagerie », prévenue le 09/11. Constat de cette
conversation, à traiter par elle : la table `contacts` n'a ni centre ni promo, et le lot 4 laisse toute équipe de tout
centre l'écrire ; d'ici là, son écriture reste aux titres fixes (§ 5.6).

## 14. Sécurité : la base reste seule juge

**Données** (proposition, le plan tranche les noms) :
- table `titres` : nom, niveau (`promo`, `centre`, `reseau`), centre (nul pour un titre du réseau), titre fixe ou non,
  version du réseau dont il est issu (pour une version de centre), cases (une valeur `non`, `voir` ou `modifier` par page
  du niveau), auteur et dates ;
- colonne `titre_id` (non nulle) sur `affectations`, dont le niveau correspond au rôle de la ligne (`formateur` = promo,
  `direction` = centre, `siege` = réseau) ;
- table du journal (§ 9), écrite par déclencheurs sur `titres` et `affectations`.

**Vocabulaire SQL** : les fonctions du lot 4 `est_formateur(p)`, `est_direction(l)`, `est_siege()` et `roles_reels(p)`
gardent un seul sens, « a un titre de ce niveau sur cette portée » : elles décident de l'espace et de l'accès à une
promo, pas des droits. Les droits passent par de nouvelles fonctions du type « tel geste est-il ouvert sur telle
promo ? » : le geste est ouvert si le titre de promo sur `p` l'ouvre, ou si le titre de centre sur le centre de `p`
l'ouvre (la page Stagiaires existe aux deux niveaux), chaque niveau dans la limite des gestes de son titre fixe (§ 5).
Chaque règle de la matrice du lot 4 qui cite `formateur_courant()`, `direction_courante()`, `equipe_courante()`,
`redacteur_contenus()` ou `est_siege()` pour un **droit** est réécrite avec le geste de la page à laquelle appartient la
table :

| Page | Tables et fonctions (à confirmer par le plan) |
|---|---|
| Planning | `agenda_events`, `planning_entries`, `planning_half_meta`, `planning_jours_off`, `passages` (écriture) |
| Émargement | `emargement_seances`, `emargement_lignes`, `emargement_formateurs` et leurs fonctions |
| Stagiaires | `stagiaires`, `stagiaires_prive`, profils des stagiaires (invitations), `conditions_acceptations`, `effacements_journal` (lecture), `benevoles`, `benevole_suivi`, `auto_ecoles`, `passages` (lecture) |
| Notes et examens | `evaluations`, `evaluations_audit`, `epcf_evaluations`, `epcf_livrets`, `dp_dossiers`, `fiches_suivi`, `qcm_attempts`, `qcm_examens`, `themes_progression` |
| Cours et QCM | `cours`, `cours_versions`, `qcm_questions`, `qcm_options`, `qcm`, `themes`, `competences`, `ressources`, `qcm_signalements`, `qcm_signalement_instruction`, `qcm_ia_brouillons`, stockage des images |
| Promos (centre) et Réglages de la promo (promo) | `promos` (nom), clé `modules` de `settings` (aux deux niveaux, comme aujourd'hui `equipe_courante()`) ; `creer_promo`, `modifier_dates_promo` (centre) ; autres clés de `settings` (promo) |
| Équipe, Directions de centre | `affectations`, `titres`, journal, profils du personnel, `creer_centre` |
| Réglages du centre, du réseau | `lieux.habillage`, `habillage_libre`, clé `habillage_reseau` (Partie E du lot 5) |
| Droits sans page (§ 5.6) | `cours` et `cours_versions` non publiés (lecture, Direction de centre), `profs`, `contacts` |

Ce que tous les connectés lisent déjà (cours publiés, questions de QCM) reste lisible : « Non » masque alors l'entrée
sans rien fermer de plus. Tout ce qui est nominatif ou interne, en revanche, est fermé en lecture par « Non ».

**Questionnaires Qualiopi (Q3)** : le questionnaire des formateurs va à toute personne qui a un titre de promo
(l'équipe pédagogique au sens de Qualiopi, intervenants compris) ; `_questionnaire_ayant_droit`, qui passe aujourd'hui
par `roles_reels`, est revu en ce sens. `peut_gerer_qualite()` reste au fondateur.

**Écritures sur les titres** : uniquement par des fonctions serveur (donner, retirer, créer, ajuster, supprimer un
titre ; `inviter_compte` et `regler_affectations_formateur` gagnent le titre), qui appliquent les règles du § 7 et
lèvent une phrase claire en cas de refus (code 42501 pour un droit manquant, comme au lot 4). Les écritures directes sur
`affectations` que le lot 4 permet et que le lot 5 utilise (`retirerAffectation` de la page Directions de centre) sont
fermées et remplacées par ces fonctions ; leurs cas de preuve deviennent des cas de fonction.

**Preuve de non-régression** : avec les seuls titres fixes, la preuve de la matrice du lot 4 et celle du lot 5 restent
vertes **à l'identique** (mêmes réponses pour chaque compte, chaque table, chaque geste, y compris « une direction
n'affecte personne à la direction », « le siège n'ajoute pas un siège », « une direction se donne Formateur sur une
promo de son centre »), à la seule différence près des écritures directes sur `affectations`, passées par les fonctions.
S'y ajoutent des cas pour chaque titre du catalogue, chaque règle du § 7 (dont « jamais sur soi-même », « jamais plus
que soi au même niveau », « on ne retire que ce qu'on pourrait donner », « aucun titre à un compte stagiaire »), les
gestes définitifs du § 5.5, le retrait immédiat et le journal. Le robot des parcours et `verifier_navigation.py` gagnent
des profils par titre (au moins Secrétariat et Intervenant).

**Aperçu** : l'en-tête d'aperçu du lot 4 s'étend aux titres pour le fondateur seul ; un aperçu ne fait que retirer des
droits.

## 15. Laissé au plan

- Les noms des tables, colonnes et fonctions ; la forme des cases en base (colonnes ou objet) ; la table exacte des
  gestes de chaque page, relevée dans la matrice du lot 4.
- Le découpage. Proposition : (1) base invisible (titres fixes, réécriture des règles, preuve de non-régression, journal)
  ; (2) fonctions de gestion des titres ; (3) écrans, menu du compte, barre filtrée, aperçu par titre ; (4) catalogue,
  conditions d'utilisation, Nouveautés pour la direction et le siège, guide de l'assistant (fonction `chatbot`,
  déploiement avec l'accord de Timy).
- La vérification qu'aucun autre geste définitif n'existe (§ 5.5) ni aucun autre droit sans page (§ 5.6).
- L'effacement automatique du journal après 3 ans (tâche planifiée ou purge à la lecture).
- Les phrases exactes des refus, des confirmations et des bandeaux.

Chaque lot passe au banc d'essai (direction, siège, Secrétariat, Intervenant, iPhone), porte son entrée Nouveautés, et
l'application en base attend l'accord explicite de Timy.

## 16. Choix de Claude, à vérifier en lisant

1. Pas de réglage personne par personne : on change de titre.
2. Titres fixes non modifiables, donnés et retirés comme aujourd'hui ; une page ajoutée plus tard est au maximum pour
   eux, sur « Non » pour les autres.
3. Ajuster un titre du réseau depuis un centre crée la version du centre et y fait passer ses porteurs, après
   confirmation.
4. Un titre ne se supprime que s'il n'est plus porté.
5. Un titre par niveau et par centre pour une personne.
6. On ne retire que ce qu'on pourrait donner.
7. Journal : personnel seulement, conservé 3 ans, adresse remplacée à l'effacement.
8. Gestes définitifs et droits sans page gardés aux seuls titres fixes.
9. « Stagiaire » est un libellé fixe, sans ligne de titre en base.
10. Personnes sans compte : pas de titre, libellé libre avec suggestions (espace contact).
11. Aperçu du fondateur par titre.
12. Accueil toujours présent, blocs selon les cases ; un bloc tiré d'une autre page suit la case de cette page.
13. CCP2 et Indicateurs plafonnent à « Voir » (pages sans écriture) ; Émargement et Notes de la direction aussi.
14. Une page qui montre des noms de stagiaires relève Stagiaires à « Voir ».
15. Cours et QCM sur Modifier touche les contenus communs du réseau, comme aujourd'hui, et l'écran le dit.
16. Questionnaire Qualiopi des formateurs : à toute personne qui a un titre de promo.
