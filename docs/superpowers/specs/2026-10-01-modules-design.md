# Modules débloqués par les formateurs : design

> Chantier B du dispatch du 01/10/2026. Branche `modules`, worktree
> `C:/Users/watch/Dev/ecsr-promo-modules` (hors du dossier ECSR, comme celui de A : une
> conversation lancée depuis un worktree du dépôt ECSR ne peut pas écrire sous
> `C:/Users/watch/Dev/ECSR/`).
> Spec validée section par section avec Timy le 01/10/2026. Contrat avec A relu sur sa spec
> `docs/superpowers/specs/2026-10-01-multi-promo-design.md` (branche `multi-promo`, commit d46bd14).

## 1. Objectif

Permettre aux formateurs de faire apparaître les parties de l'app au fil de la progression
d'une promo. Une nouvelle promo démarre avec l'essentiel (Accueil, Planning, Calendrier,
Ressources, Paramètres), puis les formateurs ouvrent les Notes, les Thèmes, ce qui touche au
CCP1, et plus tard l'onglet CCP2.

Le masquage est une **progression pédagogique, pas une protection** : le cloisonnement des
données entre promos relève du chantier A (règles d'accès par promo). Un stagiaire curieux
pourrait lire par l'API des données d'un module fermé de sa propre promo ; ce n'est pas un défaut
de ce chantier.

## 2. Décisions de cadrage

| Question | Décision |
|---|---|
| Granularité | Onglets **et** fonctions : un module peut apparaître à plusieurs endroits (le Dossier pro est dans Notes et dans Mon espace) |
| Ce que voient les formateurs | Tout, y compris les modules fermés, avec le repère « Masqué aux stagiaires » |
| Annonce aux stagiaires | Une nouveauté automatique à chaque ouverture, comptée dans la pastille de l'Accueil |
| Approche | Une clé dans `settings` (contrat avec A) + un catalogue des modules + un masquage déclaratif |
| Portée de l'état | Propre à chaque promo (assuré par A) |
| Rien de réglé | Tout est ouvert : la promo actuelle (15 stagiaires, en CCP2) ne perd rien |
| Qui règle | Les formateurs et le fondateur (`isAdmin()`), déjà seuls autorisés à écrire dans `settings` |

## 3. Le catalogue

### 3.1 Le socle, jamais fermé

Accueil (`home`), Paramètres (`config`), Nouveautés (`nouveautes`), Mon espace (`mon-suivi`) et,
dans Mon espace, le sous-onglet Passages. Le socle n'est pas dans le catalogue : il n'a pas de
case dans le réglage.

### 3.2 Les modules

L'ordre du tableau est l'ordre du catalogue, donc celui de la section de réglage.

| Clé | Nom | Groupe | Parent | Départ | Endroits où il apparaît |
|---|---|---|---|---|---|
| `planning` | Planning | Démarrage | | oui | onglet Planning, tuile d'Accueil, bouton « Aujourd'hui » de la barre du haut |
| `calendrier` | Calendrier | Démarrage | | oui | onglet Calendrier, tuile d'Accueil |
| `ressources` | Ressources | Démarrage | | oui | onglet Ressources, tuile d'Accueil |
| `priorites` | Priorités | Suivi de la formation | | non | onglet Priorités (route `dashboard`), tuile d'Accueil |
| `notes` | Notes | Suivi de la formation | | non | onglet Notes (sous-onglet Matrice), tuile d'Accueil, Mon espace › Évolution, la note de matrice affichée dans la colonne QCM de Thèmes, le bloc « Anonymat dans le tableau de notes » de Paramètres |
| `themes` | Thèmes | Suivi de la formation | | non | onglet Thèmes (liste et progression), tuile d'Accueil |
| `cours` | Cours | Suivi de la formation | `themes` | non | colonne et bouton Cours de Thèmes, ouverture du cours au clic sur le titre d'un thème |
| `qcm` | QCM | Suivi de la formation | `themes` | non | colonne QCM de Thèmes |
| `epcf` | EPCF | CCP1 | | non | Notes › EPCF, Mon espace › EPCF |
| `livret` | Livret EPCF | CCP1 | `notes` | non | Notes › Livret EPCF, champ « Date de naissance » de Mon espace |
| `dp` | Dossier pro | Dossier professionnel | | non | Notes › Dossier pro, Mon espace › Dossier pro |
| `assistant` | Assistant | Outils | | non | la bulle de l'assistant |

Plus tard, la conversation D ajoute ses onglets CCP1 et CCP2 au catalogue (voir 11.2).

### 3.3 Correspondances utilisées par le masquage

| Route | Module |
|---|---|
| `home`, `mon-suivi`, `config`, `nouveautes` | socle |
| `planning`, `calendrier`, `ressources`, `themes`, `notes` | module du même nom |
| `dashboard` | `priorites` |

| Vue | Sous-onglet | Module |
|---|---|---|
| Notes | `matrice` | `notes` (porté par l'onglet lui-même) |
| Notes | `epcf`, `livret`, `dp` | `epcf`, `livret`, `dp` |
| Mon espace | `passages` | socle |
| Mon espace | `evolution` | `notes` |
| Mon espace | `epcf`, `dp` | `epcf`, `dp` |
| Thèmes | `themes`, `signalements` | aucun (barre réservée aux formateurs) |

## 4. Les règles

### 4.1 Les trois états d'une promo

| État | Quand | Effet |
|---|---|---|
| **libre** | La clé `modules` est absente pour la promo | Tout est ouvert, rien n'est annoncé |
| **réglée** | La clé contient un réglage lisible | Seuls les modules cochés sont ouverts |
| **illisible** | La clé existe mais son contenu est invalide (JSON cassé, version inconnue) | Traité comme libre ; la section de réglage le signale et propose l'ensemble de départ |

### 4.2 Ouvert ou fermé

Dans une promo réglée, un module est **ouvert** si et seulement si :
1. il figure dans la liste des modules ouverts, **et**
2. son parent, s'il en a un, est lui-même ouvert.

Un module que le réglage ne mentionne pas est **fermé**. C'est le cas d'un module ajouté au
catalogue après le réglage de la promo (les onglets CCP1 et CCP2 de D) : il arrive fermé chez
les promos réglées, ouvert chez les promos libres. Conséquence assumée : si un formateur règle
un jour la promo actuelle, les futurs modules y arriveront fermés et il faudra les ouvrir d'un
clic.

### 4.3 Visible ou non, selon le rôle

- Un **formateur** (`isAdmin() || isProf()`, aperçu « Formateur » compris) voit tous les
  modules. Ceux qui sont fermés pour la promo portent le repère (voir 6.2). Le fondateur placé
  dans une promo où il n'a pas de fiche stagiaire y est traité en admin (spec A, C.3) : il voit
  donc tout.
- Un **stagiaire** (aperçu « Stagiaire » compris) ne voit que les modules ouverts.

### 4.4 L'ensemble de départ

Planning, Calendrier, Ressources (plus le socle). Appliquer l'ensemble de départ fait passer une
promo de libre à réglée, avec ces trois modules ouverts.

### 4.5 La bascule

- **Ouvrir** un module déjà ouvert ne change rien (son heure d'ouverture est conservée, il n'est
  donc pas réannoncé).
- **Ouvrir** un module fermé lui donne l'heure courante comme heure d'ouverture.
- **Fermer** un module le retire de la liste. Le rouvrir plus tard lui donne une nouvelle heure,
  donc une nouvelle annonce.
- **Basculer depuis l'état libre** matérialise d'abord le réglage : tous les modules du catalogue
  sont inscrits ouverts à l'heure courante, qui devient aussi l'heure de mise en place. La
  bascule demandée s'applique ensuite. Aucune annonce n'en résulte.

## 5. Ce qui est stocké

Une ligne de la table `settings`, clé `modules`, valeur texte JSON, lue et écrite **uniquement**
par `getSetting("modules")` et `setSetting("modules", …)` de `db.js` :

```json
{
  "v": 1,
  "depuis": "2026-10-05T08:00:00.000Z",
  "ouverts": {
    "planning":   "2026-10-05T08:00:00.000Z",
    "calendrier": "2026-10-05T08:00:00.000Z",
    "ressources": "2026-10-05T08:00:00.000Z",
    "notes":      "2026-10-12T13:30:00.000Z"
  }
}
```

- `v` : version du format. Toute autre valeur rend le réglage illisible.
- `depuis` : heure de la mise en place. Les modules dont l'heure d'ouverture est égale à
  `depuis` ne sont pas annoncés (ensemble de départ, matérialisation depuis l'état libre).
- `ouverts` : clé de module vers son heure d'ouverture (ISO 8601, UTC). Une clé inconnue du
  catalogue est ignorée sans erreur (module retiré du code, ou réglage écrit par une version
  plus récente).

## 6. Ce que voit chacun

### 6.1 Points d'accroche

| Endroit | Stagiaire, module fermé | Formateur, module fermé |
|---|---|---|
| Barre d'onglets | onglet absent | onglet présent, avec repère |
| Tuiles d'Accueil | tuile absente | tuile présente, avec repère |
| Sous-onglets (Notes, Mon espace) | sous-onglet absent ; s'il n'en reste qu'un, **la barre disparaît** et le contenu s'affiche directement | sous-onglet présent, avec repère |
| Thèmes, colonne Cours | colonne et bouton absents ; le titre d'un thème ouvre sa fiche, comme pour un thème sans cours. La fiche ne montre ni « Lire le cours » ni « en cours de rédaction », mais « Le cours de ce thème n'est pas encore ouvert pour ta promo. » | colonne présente, repère sur l'en-tête |
| Thèmes, colonne QCM | colonne absente, ainsi que le bouton QCM proposé en fin de cours et la phrase de la fiche du thème qui renvoie à la colonne QCM | colonne présente, repère sur l'en-tête |
| Thèmes, note de matrice dans la cellule QCM (module `notes`) | note de matrice absente ; la note d'entraînement reste | présente, sans repère |
| Mon espace, « Date de naissance » (module `livret`) | champ absent | présent, sans repère |
| Paramètres, anonymat des notes (module `notes`) | bloc absent ; si la section « Mes préférences » n'a plus rien, elle disparaît | présent, sans repère |
| Bouton « Aujourd'hui » (module `planning`) | absent | présent, sans repère |
| Bulle de l'assistant | absente | présente, avec repère |
| Nouveautés | voir 9 | voir 9 |

Le repère se pose sur les éléments de navigation (onglets, tuiles, sous-onglets, en-têtes de
colonnes, bulle). Les petits éléments secondaires (champ, bloc, note, bouton du haut) n'en
portent pas : ce serait du bruit.

### 6.2 Le repère « Masqué aux stagiaires »

Élément atténué et petite icône d'œil barré (nouvelle icône `eyeOff` dans `icons.js`), avec
`title` et `aria-label` « Masqué aux stagiaires ». Sur téléphone, où les onglets sont en icône
seule, l'atténuation et l'œil suffisent à le distinguer. Une seule classe CSS
(`module-masque`) le porte partout.

### 6.3 La garde des routes

- **Navigation vers une route fermée** (lien, saisie d'adresse, nouveauté ancienne) pour un
  stagiaire : repli sur Mon espace et message neutre « Cette partie n'est pas encore ouverte pour
  ta promo. »
- **Démarrage à froid sur une dernière page mémorisée qui est fermée** : repli silencieux sur Mon
  espace (la dernière page n'est qu'une commodité, pas une demande explicite).
- **Sous-onglet mémorisé fermé** : ouverture sur le premier sous-onglet ouvert. C'est déjà le
  comportement de `renderSubTabs` quand la clé mémorisée n'est pas dans la liste.

### 6.4 Aperçu fondateur

« Voir en tant que Stagiaire » montre exactement la vue stagiaire de la promo ; « Voir en tant
que Formateur » montre tout avec les repères. Comme aujourd'hui, l'aperçu est purement
d'interface.

## 7. Fraîcheur et erreurs

**Lecture de l'état** à trois moments :
1. au démarrage, après l'authentification et avant de dessiner la barre d'onglets ;
2. au bouton Actualiser ;
3. quand l'app revient au premier plan (`visibilitychange`), au plus une fois par minute.

Le changement de promo d'un formateur recharge la page (spec A, C.1) : l'état de la nouvelle
promo est donc relu au démarrage, sans mécanisme supplémentaire.

**Quand l'état change** : la barre d'onglets est redessinée (l'onglet actif conservé), la pastille
des nouveautés recalculée. Si la route affichée vient d'être fermée pour un stagiaire, repli sur
Mon espace. La vue en cours n'est pas re-rendue autrement, pour ne pas détruire une saisie : un
sous-onglet ou une colonne qui vient de s'ouvrir apparaît à la navigation suivante. Côté
formateur, une bascule s'applique sur-le-champ.

**Lecture impossible** (réseau) : on garde le dernier état connu, mémorisé sur l'appareil
(`localStorage`, clé propre au compte : `ecsr_modules:` + email en minuscules, sur le modèle de
la mémorisation de promo de A ; l'identifiant de promo y est ajouté une fois A en ligne). Sans
dernier état connu : libre, donc tout ouvert.

**Écriture** : la section relit la valeur en base juste avant d'écrire, applique la bascule et
écrit. Cela réduit à quelques millisecondes la fenêtre où deux formateurs qui cliquent en même
temps pourraient s'écraser. Échec (réseau, droits) : message d'erreur, la case revient à son
état précédent.

## 8. Le réglage dans Paramètres

Nouvelle section **« Modules de la promo »**, rendue par `js/views/modules-reglage.js` et
montée dans Paramètres après « Mes préférences ».

**Qui la voit** : `isAdmin()`. Tant que le multi-promo n'est pas en ligne, réservée au
fondateur (voir 11.1).

**Contenu** :
- En-tête : titre « Modules de la promo », sous-titre « Ouvre les parties de l'app au fil de la
  formation. Une partie fermée est invisible pour les stagiaires ; tu la vois toujours, avec le
  repère "Masqué aux stagiaires". »
- Ligne d'information du socle : « Toujours ouverts : Accueil, Mon espace (Passages),
  Paramètres, Nouveautés. »
- **Promo libre** : bandeau « Aucun réglage : tout est ouvert pour cette promo. » et bouton
  **« Partir de l'ensemble de départ »**, avec confirmation (« Seuls Planning, Calendrier et
  Ressources resteront visibles pour les stagiaires. Continuer ? »). Les cases restent
  utilisables : une bascule depuis l'état libre matérialise le réglage (4.5).
- **Promo illisible** : bandeau « Réglage illisible : tout est ouvert pour cette promo. » et le
  même bouton.
- La liste, groupée sous les intitulés Démarrage, Suivi de la formation, CCP1, Dossier
  professionnel, Outils. Chaque ligne : une case à cocher (style des cases existantes de
  Paramètres), le nom, une ligne d'explication (annexe A), et « ouvert le 12/10 » (jour
  d'ouverture en heure de Paris) quand le module est ouvert dans une promo réglée.
- Un module qui a un parent est décalé et porte la mention « dans Notes » ou « dans Thèmes ».
  Tant que son parent est fermé, sa case est grisée et la mention devient « s'ouvre avec Notes ».
  Fermer un parent ne touche pas l'état de ses enfants.

**Comportement** : effet immédiat au clic, pas de bouton Enregistrer. La case est désactivée
pendant l'écriture. Message de confirmation : « Notes ouvertes aux stagiaires » ou « Notes
masquées aux stagiaires ». Après écriture, l'état local est mis à jour et les écouteurs prévenus
(barre, pastille).

**Téléphone** : une colonne, lignes à cible tactile d'au moins 44 px, aucune barre de défilement
horizontale.

## 9. L'annonce automatique

### 9.1 Les entrées générées

Pour une promo réglée, chaque module **ouvert** (4.2, parent compris) dont l'heure d'ouverture
est postérieure à `depuis` produit une entrée de nouveauté :

| Champ | Valeur |
|---|---|
| `id` | `module-<clé>-<heure d'ouverture ISO>` (une réouverture produit un nouvel id) |
| `date` | jour d'ouverture, en heure de Paris (`AAAA-MM-JJ`) |
| `pour` | `tous` |
| `titre`, `resume`, `ou` | texte d'annonce du catalogue (annexe A) |

Ces entrées s'ajoutent aux nouveautés écrites dans `js/nouveautes-data.js`, partout où celles-ci
sont lues : la pastille de l'onglet Accueil (`main.js`), la section d'Accueil (`home.js`) et la
page complète (`views/nouveautes.js`). Elles se marquent lues comme les autres.

### 9.2 Le filtre des nouveautés écrites

Pour un stagiaire, une nouveauté écrite est masquée si elle concerne un module fermé. Le module
concerné est :
1. le champ facultatif `module` de l'entrée, s'il existe (nouveau champ, documenté en tête de
   `nouveautes-data.js`) ;
2. sinon, celui que désigne son lien « Où le trouver » (`ou.route`, et `ou.sousOnglet` s'il est
   présent), d'après les correspondances de 3.3 ;
3. sinon, aucun : l'entrée reste visible.

Les formateurs voient toutes les nouveautés. Ce filtre complète celui de A (sa spec, C.6), qui
compte comme déjà lues les nouveautés antérieures au début de la promo.

### 9.3 Garde-fou sur la mémoire des nouveautés lues

`purger()` (`js/nouveautes.js`) retire de la liste des nouveautés lues les ids qui ne
correspondent plus à aucune entrée. Les ids qui commencent par `module-` en sont exemptés : sans
cela, un démarrage où l'état des modules n'a pas pu être lu les effacerait, et les annonces
déjà lues reviendraient comme neuves.

## 10. Architecture

| Fichier | Rôle | Dépend de |
|---|---|---|
| `js/modules-data.js` (nouveau) | Le catalogue (annexe A), l'ordre des groupes, les routes du socle, le drapeau `REGLAGE_OUVERT_AUX_FORMATEURS` | rien |
| `js/modules.js` (nouveau) | Règles pures : lecture du JSON, ouvert ou non, ensemble de départ, bascule, écriture du JSON, annonces, module d'une nouveauté, filtre. Aucun accès à la base ni au DOM, testé par node | rien (le catalogue est passé en argument) |
| `js/modules-etat.js` (nouveau) | **Seul point de contact avec la base** : `chargerModules()`, état courant synchrone, `moduleVisible(cle)`, `moduleMasque(cle)`, `basculerModule(cle, ouvrir)`, `appliquerEnsembleDeDepart()`, `onModulesChange(cb)`, surveillance du premier plan, copie sur l'appareil, `nouveautesDeLaPromo()` | `db.js` (`getSetting`, `setSetting`), `auth-admin.js`, `modules.js`, `modules-data.js`, `nouveautes-data.js` |
| `js/views/modules-reglage.js` (nouveau) | La section de Paramètres | `modules-etat.js`, `modules-data.js` |
| `js/main.js` | `module` sur les entrées de `TABS` ; filtre et repère dans `renderTabs` ; garde dans `navigate()` et `derniereRoute()` ; chargement au démarrage ; bouton Actualiser ; bouton « Aujourd'hui » ; pastille via `nouveautesDeLaPromo()` | |
| `js/subtabs.js` | Champ `module` sur les sous-onglets : filtre, repère, barre masquée s'il n'en reste qu'un | `modules-etat.js` |
| `js/views/home.js` | `module` sur les tuiles ; nouveautés via `nouveautesDeLaPromo()` | |
| `js/views/nouveautes.js` | nouveautés via `nouveautesDeLaPromo()` | |
| `js/nouveautes.js` | exemption `module-` dans `purger()` | |
| `js/views/notes.js`, `js/views/mon-suivi.js` | `module` sur les sous-onglets ; champ date de naissance | |
| `js/views/themes.js` | colonnes Cours et QCM, note de matrice, clic sur le titre | |
| `js/chatbot.js` | bulle absente ou repérée | |
| `js/views/config.js` | montage de la section ; bloc anonymat | |
| `js/icons.js`, `css/style.css` | icône `eyeOff`, classe `module-masque`, styles de la section (bloc CSS en fin de fichier) | |
| `js/nouveautes-data.js` | champ `module` documenté ; entrée « formateurs » à la livraison | |

Le masquage est **déclaratif** : un onglet, une tuile ou un sous-onglet déclare
`module: "notes"`, et le filtre est appliqué en un seul endroit par famille (barre d'onglets,
`renderSubTabs`, routeur). Les quelques points d'accroche qui ne sont ni des onglets ni des
sous-onglets (colonnes de Thèmes, bulle, champ, bloc, bouton du haut) appellent
`moduleVisible()` explicitement.

Les deux questions que pose une vue :
- `moduleVisible(cle)` : faut-il montrer ce module à la personne connectée ? Toujours vrai pour un
  formateur ; pour un stagiaire, vrai si le module est ouvert (4.2).
- `moduleMasque(cle)` : ce module est-il fermé pour la promo ? Sert uniquement à poser le repère
  chez un formateur. Toujours faux dans une promo libre.

**Pièges repérés dans le code actuel** :
- `views/themes.js` : `loadQcmIndex()` s'arrête tôt quand `canSeeQcm()` est faux, **avant** de
  charger l'index des cours. Brancher `canSeeQcm()` sur `moduleVisible("qcm")` sans découpler ce
  chargement ferait disparaître les cours avec les QCM.
- `views/themes.js` : `canSeeQcm()` commande déjà la colonne QCM et le bouton QCM de fin de
  cours (`optionsCoursPour`) ; `hasCours(theme)` commande la colonne Cours, le clic sur le titre
  et le bouton de la fiche. Ce sont les deux seuls branchements de Thèmes, plus la note de
  matrice (`myThemeNote`) et le texte de la fiche.
- `main.js` : `renderTabs()` reconstruit la barre et perd la classe `active` ; tout redessin
  déclenché par un changement d'état doit la reposer.

## 11. Coordination

### 11.1 Avec A (multi-promo)

**Contrat, confirmé par la spec de A (section F)** : l'état des modules est la clé `modules`, lue
et écrite uniquement par `getSetting` et `setSetting` de `db.js`, qui deviennent propres à la promo
courante sans changer de signature. Clé absente = tout ouvert, donc la promo de mars ne perd rien.
Aucun accès direct à la table `settings`. Si A changeait ce rangement, seul `js/modules-etat.js`
serait rebranché.

**Régler la promo de septembre avant d'inviter ses 8 stagiaires.** A ne crée aucune ligne de
réglage par migration (une migration n'a pas de promo courante). Le réglage se fait donc dans
l'app, à l'étape 4 de A (« Ouverture aux 8 »), **avant** les invitations : un formateur ou le
fondateur se place sur « Nîmes, septembre 2026 » par la pastille de promo, ouvre Paramètres ›
Modules de la promo et clique « Partir de l'ensemble de départ ». Sans ce geste, la promo de
septembre serait libre, donc verrait tout. Cette étape est à inscrire dans la procédure
d'ouverture de A.

**Ordre des fusions** :
- **B après l'étape 3 de A** (application multi-promo en ligne) : la section est ouverte aux
  formateurs dès la livraison (`REGLAGE_OUVERT_AUX_FORMATEURS = true`), avec son entrée
  Nouveautés « formateurs ».
- **B avant l'étape 3 de A** : livraison avec `REGLAGE_OUVERT_AUX_FORMATEURS = false`, section
  réservée au fondateur. Avant le multi-promo il n'existe qu'une promo, et un formateur qui
  croirait préparer la nouvelle fermerait des modules à la promo actuelle. Rien ne change pour
  personne d'autre (aucune clé `modules` en base, donc état libre). Le drapeau passe à `true`,
  avec l'entrée Nouveautés, quand l'étape 3 de A est en ligne.
- Dans les deux cas, B est livré avant l'étape 4 de A, qui l'attend.

**Fichiers touchés des deux côtés** : `main.js`, `views/home.js`, `views/nouveautes.js`,
`nouveautes.js` (A y ajoute une date d'amorce à `vuesEffectives`, B une exemption dans
`purger()` et la liste `nouveautesDeLaPromo()` aux trois appelants) et `views/config.js`. Le
second à fusionner reprend `main` et résout.

### 11.2 Avec D (onglets CCP1 et CCP2)

Ajouter un module = une entrée dans `MODULES` (`js/modules-data.js`) et un `module: "ccp1"` sur
l'onglet. Si l'EPCF, le Livret ou le Dossier pro déménagent dans ces onglets, D met à jour leur
`parent`. Les promos réglées verront les nouveaux onglets fermés (4.2) : prévoir leur ouverture
pour une promo qui doit les voir tout de suite.

## 12. Sécurité

- Aucune politique nouvelle. Aujourd'hui `settings` est en lecture pour tout `authenticated` et
  en écriture pour `is_admin()` seul ; après A, lecture et écriture sont en plus limitées à la
  promo courante (spec A, B.3). Les stagiaires peuvent lire l'état des modules de leur promo,
  c'est sans conséquence.
- Preuve exigée avant fusion, par simulation SQL dans une transaction annulée
  (`set local role authenticated` et `request.jwt.claims`) : un stagiaire ne peut ni insérer ni
  modifier la clé `modules` ; un formateur le peut. À rejouer après la fusion de A avec l'en-tête
  de promo (`request.headers` portant `x-promo-id`) : un formateur écrit la clé de la promo
  qu'il a choisie et n'atteint pas celle de l'autre.
- Toute écriture passe par `modules-etat.js`, appelé seulement depuis la section de réglage,
  elle-même gardée par `isAdmin()`.

## 13. Tests et preuves

**Règles pures**, `node tests/modules.test.mjs`, sans dépendre du contenu réel du catalogue
(catalogue de test passé en argument) :
- état libre, réglé, illisible (JSON cassé, `v` inconnu, `ouverts` absent) ;
- socle toujours ouvert ; module non mentionné fermé ; clé inconnue ignorée ;
- règle du parent (enfant ouvert, parent fermé) ;
- ensemble de départ ;
- bascule : ouvrir un module ouvert ne change pas son heure, fermer puis rouvrir change l'heure,
  bascule depuis l'état libre ;
- annonces : seulement après `depuis`, seulement pour les modules ouverts parent compris, id et
  date en heure de Paris (cas d'une ouverture à 00 h 30) ;
- module d'une nouveauté (champ `module`, `ou` avec et sans sous-onglet, sans `ou`) et filtre ;
- `purger()` garde les ids `module-` (dans `tests/nouveautes.test.mjs`).

**Banc complet** (`_harness.html`, client Supabase factice, copié depuis `TP_ECSR_App` ;
fixture `settings.modules` pilotée par un levier d'URL) :
- stagiaire, ensemble de départ : barre = Accueil, Planning, Calendrier, Ressources, Paramètres ;
- audit « aucun lien vers un module fermé » : sur chaque route ouverte, aucun `a[href^="#/"]`,
  sous-onglet ou bouton visible ne mène à un module fermé ; pas de bulle ;
- garde : `#/notes` saisi à la main mène à Mon espace avec le message ; dernière page mémorisée
  fermée mène à Mon espace sans message ;
- Mon espace sans barre de sous-onglets ; Notes ouvert avec seulement la Matrice ;
- Thèmes ouvert sans Cours ni QCM ;
- formateur : tout présent, un repère par module fermé ;
- section de réglage : bascules, écritures relevées dans le journal du client factice, mise à
  jour de la barre et de la pastille ;
- annonces : nombre de la pastille après ouverture de Notes.

**Banc autonome versionné** `_preview_modules.html` (peint par le pane, contrairement à l'app
complète) : la section de réglage et les repères, à 375 px et en largeur bureau, en formateur
et en fondateur.

**Simulation SQL** : voir 12.

Les leviers ajoutés au client factice sont reportés dans `TP_ECSR_App` à la fin du chantier
(sinon ils meurent avec le worktree).

## 14. Livraison

- Travail dans le worktree `C:/Users/watch/Dev/ecsr-promo-modules`, branche `modules`. Aucune
  migration prévue.
- Fusion dans `main` : `git merge --no-commit`, puis commit normal (le hook re-tokenise le
  cache-bust). L'entrée Nouveautés part dans le même commit.
- Nouveautés : entrée `pour: "formateurs"` quand la section s'ouvre aux formateurs (11.1).
  Aucune entrée « tous » : la promo actuelle ne voit rien changer, et la nouvelle découvrira les
  modules par les annonces automatiques.
- Le push reste le geste de Timy.
- Fin de chantier : worktree et branche fermés, `PROJECT_NOTES.md` et mémoire à jour, message
  WhatsApp prêt à copier.

## 15. Hors périmètre

- Ouverture thème par thème des 57 thèmes (écartée au cadrage).
- Ouverture par stagiaire (l'état est celui de la promo).
- Bouton « Tout rouvrir » ramenant une promo à l'état libre.
- Ctrl+Z sur une bascule : la case elle-même sert d'annulation.
- Adaptation des textes génériques d'Accueil (« planning, passages, notes… ») à l'état des
  modules.

## Annexe A : textes du catalogue

Ligne d'explication (section de réglage, public formateur) et annonce (public stagiaire,
tutoiement, sans jargon).

| Clé | Ligne d'explication | Titre de l'annonce | Résumé de l'annonce | Où le trouver |
|---|---|---|---|---|
| `planning` | Planning de la semaine et bouton « Aujourd'hui ». | Le planning est ouvert | Retrouve chaque semaine qui passe au tableau et en voiture, et avec quel formateur. Le bouton en haut de l'écran t'amène directement à la journée du jour. | Planning |
| `calendrier` | Dates clés : périodes en centre, stages, examens. | Le calendrier est ouvert | Les grandes dates de ta formation : périodes en centre, stages, examens. L'Accueil affiche aussi le compte à rebours jusqu'au prochain rendez-vous important. | Calendrier |
| `ressources` | Contacts du centre et liens utiles. | Les ressources sont ouvertes | Les contacts utiles du centre et une sélection de liens et de documents pour réviser. | Ressources |
| `priorites` | Qui doit passer en priorité, en salle et en voiture. | L'onglet Priorités est ouvert | Il montre qui doit passer en priorité, au tableau comme en voiture, pour que chacun ait autant de passages que les autres. | Priorités |
| `notes` | Matrice des notes, Évolution dans Mon espace, anonymat. | Les notes sont ouvertes | Tes notes de thèmes s'affichent dans l'onglet Notes, avec la synthèse de la classe. Dans ton espace personnel, l'onglet Évolution trace ta progression. Si tu préfères, tu peux masquer ton prénom et tes notes aux autres dans Paramètres. | Notes |
| `themes` | Liste des thèmes et progression de la classe. | Les thèmes sont ouverts | La liste des thèmes de la formation, avec ceux déjà traités en classe et leur date. | Thèmes |
| `cours` | Lecture du cours de chaque thème. | Les cours sont ouverts | Chaque thème a son cours à lire : l'essentiel en quelques lignes, les règles, les sanctions et les chiffres clés. Clique sur le titre d'un thème ou sur son bouton Cours. | Thèmes, bouton Cours |
| `qcm` | QCM d'entraînement et d'examen. | Les QCM sont ouverts | Entraîne-toi sur chaque thème avec un QCM : les questions ratées reviennent en premier jusqu'à ce que tu les maîtrises. | Thèmes, colonne QCM |
| `epcf` | Évaluations EPCF, dans Notes et Mon espace. | L'EPCF est ouvert | Tes évaluations EPCF du CCP1, en salle et en véhicule, s'affichent dans ton espace personnel. La vue de la classe est dans Notes. | Mon espace, sous-onglet EPCF |
| `livret` | Livret officiel EPCF, dans Notes. | Le livret EPCF est ouvert | Ton livret d'évaluation officiel du CCP1 se consulte dans Notes. Pense à indiquer ta date de naissance dans ton espace personnel : elle y est reportée automatiquement. | Notes, sous-onglet Livret EPCF |
| `dp` | Dossier professionnel, dans Notes et Mon espace. | Le dossier professionnel est ouvert | Remplis ton dossier professionnel directement dans l'app, puis imprime-le ou enregistre-le en PDF au format officiel. Tes formateurs peuvent le relire et t'aider. | Mon espace, sous-onglet Dossier pro |
| `assistant` | Bulle d'aide sur les cours et le Code de la route. | L'assistant est ouvert | Une bulle en bas de l'écran répond à tes questions sur les cours et le Code de la route. C'est une version d'essai : vérifie les points importants dans les cours. | aucun lien (la bulle est sur toutes les pages) |
