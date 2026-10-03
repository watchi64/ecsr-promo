# Page Stagiaires des formateurs et fiche en sommaire sur iPhone : design (lot 2)

> Chantier D, lot 2, suite de `2026-10-03-onglets-ccp-design.md` (lot 1, en production le 03/10,
> `99b6af4`). Branche `espace-stagiaires`, worktree `C:/Users/watch/Dev/ecsr-promo-espace-stagiaires`
> (hors du dossier ECSR). Décisions prises avec Timy le 03/10 sur maquettes, section 2.

## 1. Objectif

Donner aux formateurs un accès central à l'espace de chaque stagiaire, avec leurs outils (saisie
EPCF, livret, dossier pro), et rendre la fiche d'une personne confortable sur iPhone. Notes
devient la vue de la classe, pour tout le monde. Principes de Timy (03/10) : le plus simple et le
plus instinctif possible, à la manière d'Apple ; une chose, un endroit, selon le rôle ; Mon espace,
c'est ce qui est à moi, Notes, c'est la classe.

## 2. Décisions (Timy, 03/10)

| Question | Décision |
|---|---|
| Où vivent les outils du formateur (saisie EPCF, livret, dossier pro) ? | Dans la **fiche du stagiaire**. Notes ne garde que la vue de la classe, pour tout le monde |
| Nom de la page et accès, pour un formateur | Page **« Stagiaires »**, ouverte par la pastille à son nom et par une **tuile « Stagiaires »** sur l'Accueil. La barre ne change pas (8 onglets) |
| Compte à la fois stagiaire et admin (Timy) | La pastille ouvre **son Mon espace** ; la tuile Stagiaires ouvre la promo |
| La fiche sur iPhone | **Sommaire** à la manière des Réglages de l'iPhone, **pour tout le monde** (Mon espace des stagiaires compris). Onglets sur ordinateur |
| Libellé du livret | **« Livret »** partout où l'on désigne la partie de Mon espace (liens « Où le trouver », guide de l'assistant) |

## 3. Ce que voit chacun

### 3.1 Formateur : la page Stagiaires

Concerne un formateur ou un admin. Entrées : le bouton du menu du compte (la pastille à son nom)
s'intitule **« Stagiaires »** chez un formateur sans profil stagiaire, et la tuile **« Stagiaires »**
de l'Accueil (icône `users`, « La promo, une fiche par personne »), placée en tête des tuiles chez
les formateurs et les admins. Le logo, qui mène à `#/mon-suivi`, y mène aussi (section 3.2).

**La liste.** Les stagiaires actifs de la promo (`listStagiaires()`, que la base filtre déjà par
promo), par ordre alphabétique (`compareByNom`). Chaque ligne : le nom, puis une ligne grise
d'état, l'orange étant réservé à ce qui reste à faire :

| État | Règle | Orange quand |
|---|---|---|
| `EPCF n/2` | nombre d'épreuves (salle, véhicule) ayant au moins une évaluation | n < 2 |
| `Livret` ou `Livret vierge` | le livret existe-t-il en base ? | vierge |
| `Dossier jj/mm` ou `Dossier vierge` | date de dernière mise à jour du dossier pro | vierge |

Ces trois états sont affichés quels que soient les modules ouverts pour la promo : les modules
décident de ce que voient les stagiaires, pas des outils du formateur.

**Sur ordinateur** (largeur supérieure à 760 px) : deux colonnes, la liste à gauche, la fiche à
droite avec ses onglets (section 3.3). La ligne choisie est surlignée. `#/stagiaires` sans
précision rouvre la dernière fiche consultée (mémorisée sur l'appareil), à défaut la première de
la liste. Choisir une autre personne change la fiche sans recharger la liste ni perdre sa position
de défilement ; c'est une étape d'historique (le bouton Précédent revient à la fiche d'avant).

**Sur iPhone** (760 px et moins) : trois niveaux, chacun en plein écran, chacun avec son adresse.

| Niveau | Adresse | En haut à gauche |
|---|---|---|
| La liste | `#/stagiaires` | aucun retour |
| La fiche en sommaire | `#/stagiaires/<id>` | « ‹ Stagiaires » |
| Une partie | `#/stagiaires/<id>/<partie>` | « ‹ » suivi du nom de la personne |

Le geste de retour de l'iPhone (et le bouton Précédent du navigateur) remonte d'un niveau, comme
le lien en haut à gauche.

### 3.2 Stagiaire : Mon espace

Mon espace est la fiche de la personne connectée, sans liste ni menu de choix : le menu déroulant
« Élève » disparaît (les formateurs ont la page Stagiaires, Timy la tuile). Le titre de la page
devient « Mon espace » (il disait encore « Mon suivi »).

- Sur ordinateur : les onglets, comme aujourd'hui. Adresse `#/mon-suivi`, et `#/mon-suivi/<partie>`
  pour arriver sur un onglet donné.
- Sur iPhone : le sommaire (`#/mon-suivi`), puis la partie en plein écran (`#/mon-suivi/<partie>`)
  avec « ‹ Mon espace » en haut à gauche.

Redirections, sans message :

- un formateur ou un admin **sans profil stagiaire** qui arrive sur `#/mon-suivi` (logo, ancien
  lien, démarrage à froid) est conduit sur `#/stagiaires` ;
- un stagiaire qui arrive sur `#/stagiaires` (adresse saisie, lien partagé) est conduit sur
  `#/mon-suivi`. Un compte stagiaire **et** admin y a accès, par la tuile.

### 3.3 La fiche, commune aux deux pages

Cinq parties, dans l'ordre d'aujourd'hui. Chacune suit son module comme aujourd'hui : fermée pour
la promo, elle disparaît chez un stagiaire et porte le repère chez un formateur.

| Partie (`<partie>`) | État dans le sommaire | Contenu | En plus pour un formateur |
|---|---|---|---|
| Passages (`passages`) | « 2 à venir », ou « aucun à venir » | passages à venir et effectués | rien |
| EPCF (`epcf`) | « 1/2 » (orange sous 2/2 chez un formateur) | résultats salle et véhicule, avec les moyennes de la classe | la saisie, section 3.4 |
| Évolution (`evolution`) | rien | graphe des notes | rien |
| Livret (`livret`) | « commencé » ; sinon « vierge » en orange chez un formateur, « pas encore créé » en gris chez le stagiaire | champ « Date de naissance », puis le livret, en lecture pour le stagiaire | livret en saisie |
| Dossier pro (`dp`) | « jj/mm », ou « vierge » en orange | le dossier, en écriture pour son propriétaire | le dossier, en écriture |

- **Sur ordinateur**, les parties sont des onglets ; choisir un onglet met l'adresse à jour sans
  créer d'étape dans l'historique (le bouton Précédent ne fait pas défiler les onglets).
- **Sur iPhone**, le sommaire liste les parties sur de grandes lignes : le nom à gauche, l'état et
  « › » à droite. Toute la ligne est cliquable et ouvre la partie (étape d'historique).
- L'orange signale ce qui reste à faire. Dans son propre Mon espace, un stagiaire ne voit en orange
  que ce qui dépend de lui, son dossier vierge : l'EPCF et le livret dépendent des formateurs et
  restent en gris (« 1/2 », « pas encore créé »).
- La fiche affiche le nom de la personne en tête quand c'est un formateur qui la regarde.
- Le champ **« Date de naissance »** quitte le haut de Mon espace pour le haut de la partie Livret,
  la seule à laquelle il sert (même règle d'affichage : la personne elle-même, un formateur ou un
  admin, module Livret visible).
- Une partie inconnue dans l'adresse (`#/mon-suivi/xyz`) ou fermée pour un stagiaire ramène au
  sommaire (iPhone) ou au premier onglet (ordinateur).

### 3.4 La saisie EPCF dans la fiche

Pour un formateur, la partie EPCF montre, pour chaque épreuve, l'état (« évaluée le jj/mm » ou
« à évaluer ») et les boutons d'aujourd'hui : **Modifier** la dernière évaluation, **Évaluer** (ou
**Nouvelle évaluation** s'il y en a déjà une). Le formulaire (grille A, R, NA, date, champs de
l'épreuve, évaluateur, compétences acquises, commentaire) est celui de Notes aujourd'hui, ouvert à
l'intérieur de la partie, avec « ← Retour ». Après l'enregistrement, on revient à la partie EPCF,
à jour, et l'état de la liste suit.

**Garde de saisie.** Une grille en cours n'est jamais perdue en silence : si quelque chose a été
saisi, quitter le formulaire par n'importe quel chemin (« ← Retour », geste de retour de l'iPhone,
onglet de la fiche, onglet de la barre, autre fiche, boutons « Actualiser » et « Aujourd'hui »)
demande confirmation, et « Annuler » laisse sur le formulaire, saisie intacte. Fermer ou recharger
la page déclenche l'alerte du navigateur. Le livret et le dossier s'enregistrent déjà seuls et n'en
ont pas besoin.

### 3.5 Notes

Pour tout le monde : **Matrice · EPCF**. Le sous-onglet EPCF affiche les **moyennes de la classe**,
formateurs compris. Le tableau stagiaires × épreuves, la consultation par élève et le formulaire de
saisie quittent Notes (ils sont dans la fiche). Les sous-onglets Livret EPCF et Dossier pro des
formateurs quittent Notes. Un formateur qui les avait mémorisés retombe sur la Matrice.

### 3.6 Accueil et menu du compte

- Tuile « Stagiaires », section 3.1, pour les formateurs et les admins seulement.
- Menu du compte : « Mon espace personnel » (`#/mon-suivi`) pour toute personne qui a un profil
  stagiaire ; « Stagiaires » (`#/stagiaires`) pour un formateur ou un admin sans profil stagiaire.

## 4. Adresses et navigation

- Le routeur lit l'adresse par segments : `#/<route>/<id>/<partie>`. Le premier segment choisit la
  page ; la page lit le reste. La « dernière page » mémorisée pour le démarrage reste le premier
  segment.
- Quand l'adresse change sans changer de page (autre fiche, autre partie), la page se met à jour
  elle-même au lieu d'être reconstruite : la liste n'est pas relue, le défilement est gardé.
- La disposition (ordinateur ou iPhone) est choisie quand la page s'affiche. Si la largeur franchit
  ensuite 760 px (téléphone tourné à l'horizontale, fenêtre redimensionnée), elle change au prochain
  changement d'adresse, jamais en cours de lecture ou de saisie : un redessin immédiat pourrait
  effacer une grille EPCF ou les dernières lettres tapées dans le livret.
- Les liens « Où le trouver » (nouveautés, annonces d'ouverture de module, parcours CCP2) qui visent
  une partie de Mon espace ouvrent `#/mon-suivi/<partie>` ; le mécanisme de mémoire des sous-onglets
  (`STORAGE_SOUS_ONGLET`) reste en service pour Notes et Cours.
- L'assistant ne reçoit que le premier segment comme nom de page (`stagiaires`, `mon-suivi`) : la
  fonction serveur n'accepte qu'un mot simple.
- `#/stagiaires` n'allume aucun onglet de la barre, comme `#/mon-suivi`.

## 5. Données et sécurité

- **Aucune table, aucune migration, aucune règle d'accès nouvelle.** Vérifié en production le
  03/10 (`pg_policies`) : les formateurs et les admins lisent et écrivent `epcf_evaluations`,
  `epcf_livrets` et `dp_dossiers` de la promo en cours ; un stagiaire lit les siens ; le dossier pro
  est aussi modifiable par son propriétaire. Le commentaire de `db.js` qui réserve l'écriture du
  dossier à son propriétaire est périmé : il est corrigé.
- Trois lectures légères dans `db.js` pour les états, sans le contenu des documents : épreuves EPCF
  évaluées (`stagiaire_id`, `trame`, `date_eval`), index des livrets et index des dossiers
  (`stagiaire_id`, `updated_at`). Pour la liste, elles sont faites à l'ouverture de la page et
  après un enregistrement EPCF, jamais au simple changement de fiche. Pour un stagiaire, la base ne
  renvoie que ses propres lignes.
- Aucun nouveau contrôle d'édition visible d'un stagiaire : les boutons de saisie EPCF et le livret
  en saisie n'apparaissent qu'aux formateurs et aux admins (`isAdmin() || isProf()`), et la base
  refuse de toute façon l'écriture à un stagiaire.
- « Voir en tant que » reste une simulation d'affichage (la base n'est pas simulée), comme avant.

## 6. Architecture

| Fichier | Changement |
|---|---|
| `js/route-rules.js` (nouveau, pur) | lecture d'une adresse en route, id et partie ; liste des parties connues |
| `js/fiche-rules.js` (nouveau, pur) | états des parties (EPCF n/2, vierge, dates, « à venir ») et ligne d'état de la liste |
| `js/views/stagiaires.js` (nouveau) | page Stagiaires : liste, fiche, disposition ordinateur ou iPhone |
| `js/views/mon-suivi.js` | exporte la fiche (`renderFiche`), onglets ou sommaire ; Mon espace en devient un usage ; plus de menu « Élève » ; date de naissance dans la partie Livret |
| `js/views/epcf.js` | Notes : moyennes de la classe pour tous ; nouvelle fonction pour la partie EPCF de la fiche (résultats, boutons, formulaire, garde) |
| `js/views/notes.js` | sous-onglets Matrice et EPCF pour tous |
| `js/main.js` | route `stagiaires`, adresses à segments, mise à jour sur place, garde de saisie, redirections |
| `js/subtabs.js` | option `onChange` (l'onglet choisi met l'adresse à jour) |
| `js/views/home.js` | tuile Stagiaires |
| `js/auth-admin.js` | bouton du menu du compte |
| `js/db.js` | trois lectures légères, commentaire du dossier pro corrigé |
| `js/nouveautes.js`, `js/views/nouveautes.js`, `js/views/ccp2.js` | liens « Où le trouver » vers `#/mon-suivi/<partie>` |
| `js/nouveautes-data.js`, `js/modules-data.js` | libellés « Livret », entrées du lot 2 (section 7) |
| `js/chatbot-rules.js` | `pageDepuisHash` renvoie le premier segment |
| `css/style.css` | bloc en fin de fichier : liste, sommaire, liens de retour, deux colonnes |
| `supabase/functions/chatbot/aide.mjs`, `PROJECT_NOTES.md` | guide de l'assistant, notes de projet |

La fiche reste dans `mon-suivi.js`, exportée, plutôt que déplacée dans un nouveau fichier : le
changement reste lisible et le risque de conflit avec les autres chantiers reste bas.

## 7. Nouveautés et assistant

- Entrée **formateurs** : « Une page Stagiaires : toute la promo, une fiche par personne » (tuile de
  l'Accueil, états de la liste, saisie EPCF, livret et dossier dans la fiche, Notes devenu la vue de
  la classe), avec un guide de trois étapes.
- Entrée **pour tous** : « Mon espace sur iPhone : un sommaire » (chaque partie avec son état, un
  geste pour l'ouvrir, la date de naissance rangée avec le livret).
- L'entrée formateurs `2026-10-03-livret-espace-stagiaire` devient fausse (menu « Élève », livrets
  et dossiers dans Notes) : elle est retirée, l'entrée formateurs du lot 2 la remplace.
- Libellés « Où le trouver » : « Mon espace personnel, partie Livret » (et non « sous-onglet Livret
  EPCF ») ; ceux des formateurs mènent à « Stagiaires, puis la fiche d'un stagiaire ».
- Guide de l'assistant (`aide.mjs`) : pages `mon-suivi` (sommaire sur iPhone, parties), `stagiaires`
  (nouvelle), `notes` (Matrice et moyennes EPCF pour tous). Redéploiement de la fonction `chatbot`
  après la mise en production, sur accord de Timy.

## 8. Tests et preuves

- `node tests/route-rules.test.mjs` (nouveau) : `#/stagiaires/12/epcf`, id absent ou invalide,
  partie inconnue, adresse vide, adresses de Mon espace.
- `node tests/fiche-rules.test.mjs` (nouveau) : EPCF 0/2, 1/2, 2/2 (plusieurs évaluations sur une
  même épreuve comptent une fois), livret vierge ou commencé, dossier daté ou vierge, ligne d'état
  et repères orange, « aucun à venir ».
- `tests/chatbot-rules.test.mjs` : `pageDepuisHash` avec segments.
- `tests/modules.test.mjs`, `tests/nouveautes.test.mjs` : liens « Où le trouver » joignables
  (route `stagiaires` connue, parties valides), libellés « Livret », entrée retirée absente.
- Tous les tests existants restent verts.
- Banc d'essai, ordinateur (1280 px) et iPhone (375 px) :
  - formateur : tuile et menu du compte, liste et états, fiche, onglets et adresse, saisie EPCF
    (enregistrement, état de la liste mis à jour, garde : Retour, geste de retour simulé par
    `history.back()`, autre onglet), livret en saisie, dossier pro ;
  - stagiaire : Mon espace sur ordinateur (onglets) et sur iPhone (sommaire, parties, retour),
    date de naissance dans Livret, redirection depuis `#/stagiaires` ;
  - compte stagiaire et admin : la pastille ouvre son espace, la tuile la promo ;
  - formateur sans profil stagiaire sur `#/mon-suivi` : redirigé ;
  - modules fermés (`?modules=depart`) : parties cachées chez le stagiaire, repérées chez le
    formateur ;
  - Notes : deux sous-onglets pour les deux rôles ; liens « Où le trouver » ;
  - réseau lent (`?lenteur=`) : aucune fiche ne s'écrit à la place d'une autre ;
  - aucun débordement horizontal, aucune erreur en console.

## 9. Coordination

A (multi-promo) modifie aussi `js/auth-admin.js`, `js/db.js`, `js/modules-data.js`,
`js/nouveautes.js`, `js/nouveautes-data.js`, `css/style.css` et `PROJECT_NOTES.md` (relevé le
03/10, `git diff main...multi-promo`) : surtout des ajouts aux mêmes endroits ; le second à
fusionner reprend `main` et résout, A est prévenu à la fusion. Le cloisonnement par promo est déjà
en base : la liste montre la promo en cours sans travail de plus.

## 10. Livraison

Relecture de la spec par Timy, plan, réalisation et vérification au banc ; fusion dans `main`
(`merge --no-ff --no-commit` puis commit, hook du cache), nouveautés dans le même commit,
vérification navigateur du `main` fusionné, push par Timy, redéploiement de l'assistant sur son
accord, puis ménage (worktree, branche, notes de projet, mémoire) et message WhatsApp.

## 11. Hors périmètre

- Un lien direct depuis un nom de la Matrice vers la fiche.
- Une recherche dans la liste.
- Le suivi des étapes du CCP2 par stagiaire.
- Une disposition propre à la tablette (un iPad suit la disposition ordinateur au-delà de 760 px).
