# Refonte de la navigation : constats du 28/10/2026 (vraie app, nouvelle navigation allumée)

Ce document rassemble ce qu'ont montré les essais du 28/10 sur la vraie app (lot 1 fusionné dans main, 41472e4), au banc d'essai (données fictives), interrupteur de la promo allumé comme le fera le vrai allumage. Il nourrit le plan du lot 2A (`2026-10-28-refonte-navigation-lot-2a-allumage.md`).

## 1. Tests du premier clic

Méthode : 28 captures de la vraie app (stagiaire et formateur, 1 280 et 375 px), montrées à trois agents frais qui ne voient que les images, dans la peau d'une personne de la promo ; pour chaque tâche, le premier clic depuis l'écran de départ, puis le second sur l'écran suivant quand il y en a un ; confiance de 1 (je devine) à 5 (évident). Réponses attendues tenues hors de leur vue.

Synthèse :

| Persona | Trouvé du premier coup (4 ou 5) | Hésitations ou échecs (1 à 3) |
|---|---|---|
| Stagiaire sur téléphone | émargement, planning, cours, CCP2, assistant, nouveautés, déconnexion | note du dernier QCM, dates d'examen, documents, dossier pro, recharger, passages au tableau |
| Formatrice sur ordinateur | émargement, notes, stagiaires, planning, indicateurs, changer de promo, replier la barre, assistant | élèves bénévoles (1), propositions de l'IA (2), ouvrir un module (2), voir comme un stagiaire (1), signalements (3), dates clés (3) |
| Formateur sur téléphone | émargement, planning, changer de promo | assistant (1), signalements par « Plus » (2), indicateurs par « Plus » (2) |

Constats communs aux trois : le « 9+ » du compte lu comme des tâches à traiter (ce sont les Nouveautés) ; « -2 jours » pour un stage commencé, lu comme une erreur ; le planning ouvert sur une semaine ancienne (réglage commun `current_week_lundi`, semaine ancienne dans les données du banc) ; « Aujourd'hui » et « Cette semaine » confondus.

Les réponses complètes suivent, telles que rendues (le prénom porté par le profil stagiaire du banc est remplacé par « le stagiaire du banc »).


---

### Test premier clic : Léa, stagiaire sur iPhone (écrans de 375 px)

Léa, 26 ans, en reconversion, stagiaire ECSR à Nîmes, surtout sur iPhone. Elle connaît l'ancienne version (8 icônes en haut) et découvre celle-ci. Sept captures vues : accueil, planning, cours, mon-suivi, ccp2, accueil-compte (le volet qui s'ouvre avec le rond « TV ») et accueil-assistant.

Méthode : le premier toucher est décidé avec l'écran de départ seul (accueil.png). Le second toucher est décidé ensuite, sur l'écran fourni. Quand ce que je vois après coup change mon avis, je le note dans la remarque sans modifier le premier toucher. Barre du bas, de gauche à droite : Accueil, Planning, Cours et QCM, Mon suivi, CCP2. Confiance : 1 = je devine, 5 = évident ; « 3 puis 4 » = confiance au premier toucher puis au second.

#### Résultats par tâche

| Tâche | Premier toucher | Second toucher | Confiance | Remarque |
|---|---|---|---|---|
| S1. Voir ma note au dernier QCM | « Mon suivi », dans la barre du bas (4e entrée, icône courbe qui monte) | sans objet (pas de second écran) | 3 | « Ma note » = mes résultats, et la courbe me parle de progression. J'hésite avec « Cours et QCM » à cause du mot QCM. Après coup : sur Mon suivi je ne vois aucune ligne QCM (Passages, EPCF, Évolution, Livret, Dossier pro), donc je ne sais pas si ma note y est. |
| S2. Savoir ce qui est prévu demain matin | « Planning », dans la barre du bas (2e entrée, icône calendrier) | sans objet | 5 | Mot et icône calendrier, aucun doute. Après coup : Planning s'ouvre sur la semaine du 12 octobre alors qu'on est le 28 ; il faut toucher « Aujourd'hui » (sous le titre, à gauche) puis défiler jusqu'à demain. |
| S3. Trouver la date de mon prochain examen blanc (EPCF) | « Planning », dans la barre du bas | onglet « Dates clés » (en haut, sous le bandeau vert, à droite de « Semaine ») | 3 puis 4 | La carte « Prochain événement majeur » de l'accueil parle d'un stage, pas d'un examen, donc je cherche côté calendrier. « Dates clés » me semble être la liste des échéances (l'onglet Semaine ne montre que des horaires). Après coup : « Mon suivi » a une ligne « EPCF 0/2 » qui pourrait aussi donner la date, donc deux endroits possibles. |
| S4. Relire le cours sur la vitesse | « Cours et QCM », dans la barre du bas (3e entrée, livre ouvert) | sans objet | 5 | Mot « Cours » et livre ouvert, évident. Ensuite je taperais « vitesse » dans le champ « Rechercher... » de l'écran Cours. |
| S5. M'entraîner sur un QCM | « Cours et QCM », dans la barre du bas | sans objet | 4 | Le mot QCM est dans l'entrée de la barre. Après coup : l'écran s'appelle seulement « Cours » et aucun onglet ni bouton ne dit « QCM » ; je ne sais pas si on lance un QCM depuis un thème. |
| S6. Trouver le PDF du référentiel donné par le centre | « Cours et QCM », dans la barre du bas (au hasard : le PDF est un document de cours) | sous-onglet « Documents » (en haut, à droite de « Compétences ») | 2 puis 4 | Rien sur l'accueil ne dit « ressources » ou « documents ». Sur l'écran Cours, « Documents » est le mot qui correspond à un PDF. Après coup : l'écran CCP2 contient aussi « Référentiel d'évaluation (PDF) » (tout en bas de la carte, à moitié coupé) ; je ne saurais pas lequel est celui du centre. |
| S7. Poser une question sur le code de la route à l'assistant | Bouton « Assistant » (en haut, pilule avec une bulle de discussion, au centre-droit) | sans objet | 5 | Mot et icône disent la même chose. Après coup (accueil-assistant) : le champ « Pose ta question... » puis « Envoyer » sont évidents, et le message d'accueil cite Légifrance. Seule la croix de fermeture « × » est petite et grise. |
| S8. Lire ce qui a changé dans l'app | « Tout voir » avec sa flèche, à droite du titre « Nouveautés » dans la carte de l'accueil | ligne « Nouveautés » (1re ligne du volet, cloche et pastille 9+) | 5 puis 5 | La carte Nouveautés est déjà sur l'accueil : je lis la première entrée puis « Tout voir ». Mon premier toucher ne mène donc pas à l'écran fourni ; mais le même mot est dans le volet du compte, et c'est là que je comprends le « 9+ » (nouveautés non lues, je suppose). |
| S9. Me déconnecter | Le rond « TV » avec petite flèche vers le bas, tout en haut à droite | ligne « Se déconnecter » (dernière ligne du volet, icône porte avec flèche) | 4 puis 5 | Initiales et flèche = menu du compte, endroit habituel pour se déconnecter. Dans le volet, la ligne est claire et séparée des autres. |
| S10. Compléter mon dossier professionnel | « Mon suivi », dans la barre du bas | ligne « Dossier pro 02/10 » (en bas de la liste, avec une flèche à droite) | 2 puis 4 | Aucun mot « dossier » sur l'accueil ; « Mon suivi » = mon espace perso, je devine. J'hésite avec « CCP2 » à cause du mot dossier. Sur Mon suivi, « Dossier pro » est la bonne ligne, mais « 02/10 » ressemble à une date (2 octobre), pas à « 2 sur 10 », et la ligne est à moitié cachée par la barre du bas. |
| S11. Avancer mon dossier CCP2 | « CCP2 », dans la barre du bas (5e entrée, icône cible) | sans objet | 5 | Le mot est exactement celui de la barre. Après coup (ccp2) : la page s'ouvre sur « L'épreuve en bref », un long texte ; je ne vois pas où j'avance (les 8 étapes annoncées sont sous l'écran), je défilerais. |
| S12. Recharger l'app parce qu'une page s'affiche mal | D'abord je tirerais l'écran vers le bas (rien à toucher) ; à défaut, le rond « TV » en haut à droite, au hasard | ligne « Actualiser » (3e ligne du volet, flèche circulaire) | 2 puis 4 | Rien sur l'accueil ne dit « recharger ». Dans le volet, « Actualiser » avec l'icône de rafraîchissement est le bon réflexe, même si je cherchais le mot « Recharger ». |
| S13. Savoir si je passe au tableau cette semaine | « Planning », dans la barre du bas | sans objet (pas de second écran) | 2 | « Passages » est cité dans le texte de l'accueil mais n'a pas d'entrée dans la barre ; « cette semaine » me fait penser au planning, je devine. Après coup : « Mon suivi » contient « Passages : aucun à venir », donc la réponse est probablement là, mais je ne l'aurais pas cherchée en premier. |
| S14. Signer la feuille de présence de ce matin | Bouton « Signer » (bandeau vert en haut, à droite de « Émargement du matin ouvert (9h00 à 12h30) ») | sans objet | 5 | « Émargement » est un mot que je connais de la formation, et le bouton est évident. Le bandeau est présent sur tous les écrans. |

#### Remarques générales

##### En un coup d'oeil

- Premier toucher évident (5) : S2, S4, S7, S8, S11, S14.
- Plutôt sûr (4) : S5, S9.
- Je devine ou j'hésite (2 ou 3) : S1, S3, S6, S10, S12, S13. Ce sont toutes des tâches sur mes résultats, mes dossiers, mes documents ou le dépannage.

##### Ce qui m'a paru clair

- La barre du bas : cinq entrées avec une icône et un mot, l'onglet actif dans une pastille verte, à portée de pouce. Planning, Cours et QCM et CCP2 disent ce qu'ils contiennent.
- Le bandeau « Émargement du matin ouvert » et son bouton « Signer » : action visible sur tous les écrans, aucune hésitation.
- Le bouton « Assistant » en haut, et le panneau qui s'ouvre : mention bêta, champ « Pose ta question... », bouton « Envoyer ».
- Le rond « TV » avec la flèche : le volet est rangé et lisible (Nouveautés, Réglages, Actualiser, Informations légales, Se déconnecter), chaque ligne avec une icône et un mot, avec une poignée et un bouton « Fermer ».
- La carte « Nouveautés » de l'accueil avec son lien « Tout voir ».
- Les sous-onglets de Planning (Semaine, Dates clés, Priorités) et de Cours (Thèmes, Compétences, Documents). « Dates clés » et « Documents » sont des mots que je comprends tout de suite.
- Le tutoiement et le ton chaleureux.

##### Ce qui m'a paru confus

Mots :

- « 9+ » sur le rond « TV » : sur l'accueil, je ne sais pas ce qu'il compte (messages, notifications ?). Je ne le comprends que dans le volet, où il est repris sur « Nouveautés ».
- « -2 jours » dans « Prochain événement majeur » : un nombre négatif, pour un stage qui a commencé le 26/10. Est-ce « commencé depuis 2 jours » ou « en retard » ? Et ce n'est plus vraiment le « prochain ».
- « Mon suivi » est un nom vague. Dedans : « Livret : pas encore créé » (quel livret ?), « Évolution » (de quoi ?), « EPCF 0/2 » (0 sur 2 quoi ?), « Dossier pro 02/10 » (une date, ou 2 sur 10 ?).
- Planning : « Consultation » et « Lecture seule. Connexion admin requise pour modifier. » ne me concernent pas (je ne suis pas admin), « Priorités » (priorités de quoi ?), « PDF » (que fait ce bouton ?).
- Cours : « Transversaux » et « Sans catégorie » ne me disent rien.
- « Actualiser » : je cherchais « Recharger ».

Icônes :

- La courbe de « Mon suivi » et la cible de « CCP2 » ne disent rien sans le mot en dessous.
- La cloche de « Nouveautés » fait penser à des notifications plutôt qu'à des nouveautés de l'app.
- La croix « × » qui ferme l'assistant est petite et grise.

Emplacements :

- Le texte de l'accueil (« planning, passages, notes, calendrier, contacts ») ressemble à un menu mais n'est pas cliquable, et cite des mots qui ne sont pas dans la barre. Je cherche où sont passés le calendrier et les contacts de l'ancienne version. Dans ce que je vois des Nouveautés, rien n'explique le changement de navigation.
- Mes résultats sont éclatés : Mon suivi (Passages, EPCF, Évolution), Planning puis Dates clés (examens ?), Cours et QCM. Je ne sais pas où chercher en premier.
- Planning s'ouvre sur la semaine du 12 octobre alors qu'on est le 28, avec cinq commandes (« Aujourd'hui », sélecteur de date, deux flèches, « Cette semaine », « PDF ») avant le premier horaire : il faut défiler pour voir demain. « Aujourd'hui » et « Cette semaine » semblent faire la même chose.
- La carte d'enquête de Mon suivi occupe le haut de la page et repousse les vraies lignes ; « Dossier pro » est coupé par la barre du bas.
- Un « Référentiel d'évaluation (PDF) » apparaît dans CCP2 et un onglet « Documents » existe dans Cours : deux endroits possibles pour un PDF.
- L'écran CCP2 s'ouvre sur un long texte (« L'épreuve en bref ») et pas sur mes étapes ou mon dossier : pour « avancer », je ne vois pas par où commencer.
- Cours et QCM : l'écran s'appelle « Cours », sans entrée « QCM » visible ; je ne sais pas où lancer un QCM.
- Le bandeau d'émargement reste sur tous les écrans et prend près d'un cinquième de la hauteur utile.
- L'accueil a beaucoup de vide et deux logos (en haut à gauche et à côté de la date), mais pas mon programme du jour.

##### Ce qui me manque

- Ma dernière note de QCM, ou un accès direct à mes résultats, visible sans chercher (accueil ou Cours).
- Sur l'accueil : mon programme d'aujourd'hui et de demain, mon prochain passage, mon prochain EPCF (l'accueil montre un stage et une phrase de présentation).
- Un moyen clair de retrouver le calendrier, les contacts et les ressources de l'ancienne version, ou un message qui dit où ils sont passés.
- Un « Recharger » visible hors du menu, ou l'indication qu'on peut tirer l'écran vers le bas.
- Un bouton « S'entraîner » ou un onglet QCM dans l'écran Cours.
- Les 8 étapes du CCP2 visibles dès l'ouverture de l'écran.

##### Impression générale

Plus claire et plus facile au pouce que l'ancienne rangée de 8 icônes : signer, voir le planning, ouvrir les cours, le CCP2, l'assistant ou se déconnecter se trouvent du premier coup. Mais tout ce qui touche à mes résultats et à mes dossiers (note de QCM, passages, EPCF, dossier pro, PDF) est dispersé derrière des mots vagues (« Mon suivi », « Livret », « 9+ », « -2 jours », « 02/10 »), et je ne sais pas où sont passés le calendrier et les contacts.

---

### Test « premier clic » : formatrice sur l'ordinateur de la salle (captures 1280 px)

Je joue Sandrine, 52 ans, formatrice ECSR à Nîmes. Les coordonnées entre parenthèses sont approximatives (captures de 1280 px de large). Confiance de 1 (je devine) à 5 (évident), donnée pour le premier clic puis, quand il y a un second écran, pour le second clic ("4 puis 3" = 4 au premier clic, 3 au second).

#### Résultats par tâche

| Tâche | Premier clic | Second clic | Confiance | Remarque |
|---|---|---|---|---|
| F1. Feuille d'émargement de ce matin | Bandeau du haut « Émargement du matin ouvert : 2 sur 6 ont signé », bouton « Voir » à son extrémité droite (1228, 37). À défaut, « Émargement » dans le menu de gauche. | Sans objet (pas de second écran). | 4 | Le mot « matin » du bandeau est celui de la consigne, et le bandeau est tout en haut. Je ne sais pas si « Voir » ouvre la feuille elle-même ou seulement un résumé, d'où 4 et pas 5. |
| F2. Saisir les notes du dernier QCM | Menu de gauche « Notes et examens », icône de bonnet universitaire (107, 272). | Sur « Notes & évaluations », onglet « Matrice » déjà ouvert : je vérifie la date des notes (28/10/2026), puis je clique la case de la première ligne (le stagiaire du banc) dans la colonne du thème concerné. | 4 puis 3 | C'est le mot « notes » qui m'a guidée, pas « QCM ». Sur le second écran, je ne vois pas lequel de ces « Thème 1 à 21 » (la suite est coupée à droite) correspond à mon dernier QCM, et le mot QCM n'apparaît nulle part : je ne suis pas sûre que ce soit ici qu'on saisit un QCM. |
| F3. Passages au tableau d'un stagiaire | Menu « Stagiaires » (84, 228). | Le nom du stagiaire dans la liste de gauche (ici A. Céline est déjà ouverte), puis l'onglet « Passages » (624, 279), déjà actif : « Passages effectués » est juste dessous. | 4 puis 5 | « D'un stagiaire » me fait penser à sa fiche. J'hésitais avec « Planning », où les passages sont programmés. Sur la fiche, le mot « Passages » est devant moi. « Passages au tableau » est devenu « Passages » tout court : je ne vois pas de distinction salle ou voiture. |
| F4. Modifier le planning de la semaine prochaine | Menu « Planning » (79, 140). | « Cette semaine » (568, 301) pour me recaler, puis la flèche « > » (494, 301), puis le bouton vert « Modifier » (331, 352). | 5 puis 4 | La phrase « Lecture seule. Clique « Modifier » pour éditer la semaine » dit exactement quoi faire. Mais l'écran affiche la semaine du 12 octobre alors qu'on est le 28 : en cliquant « > » une fois, je serais tombée sur la semaine du 19 et non sur la semaine prochaine. Je ne sais pas non plus si « Modifier » garde la semaine affichée. |
| F5. Ajouter un élève bénévole | Menu « Stagiaires » (84, 228), faute de mieux : c'est la seule entrée qui parle de personnes. | Rien ne mène à la tâche : ni bouton « Ajouter », ni le mot « bénévole », seulement les onglets Passages, EPCF, Évolution, Livret, Dossier pro. Je reviendrais en arrière et j'essaierais Planning. | 2 puis 1 | Un élève bénévole n'est pas un stagiaire, mais rien dans le menu ne parle de bénévoles. En regardant les autres écrans, je vois un bouton « Élèves bénévoles » dans Planning, à côté de « Modifier » (440, 352) : c'est probablement là, mais je n'y serais pas allée en premier, et je ne sais pas si ce bouton liste ou ajoute. |
| F6. Traiter les signalements d'erreur sur les QCM | Menu « Cours et QCM » (96, 316). | Onglet « Signalements » avec son petit drapeau (542, 245), à côté de Thèmes et Compétences. | 3 puis 5 | Le mot QCM m'y envoie, aucune entrée du menu ne s'appelle « Signalements ». Sur le second écran, le drapeau de l'onglet est le même que celui des pastilles rouges (3 et 2) sur les lignes de QCM : le lien se fait tout de suite. J'ai aussi regardé la pastille « 9+ » près de mon prénom, puis je l'ai écartée. |
| F7. Relire les questions de QCM proposées par l'IA | Menu « Cours et QCM » (96, 316). | Rien d'évident : aucun onglet ni bouton ne parle de l'IA, de propositions ou de questions à relire. En dernier recours, je cliquerais le bouton « QCM » d'une ligne de thème (Feux du véhicule, 1023, 613) en espérant que les propositions soient dedans. | 3 puis 2 | « IA » me faisait hésiter avec « Assistant » en bas du menu, mais celui-ci sert à poser des questions, pas à relire. « Signalements » concerne les erreurs signalées par les stagiaires, pas des questions proposées. Je ne peux pas dire que quelque chose me mène à la tâche sur cet écran. |
| F8. Indicateurs de la promo (moyennes, présence) | Menu « Indicateurs », rubrique PROMO (88, 441). | Sans objet (pas de second écran). | 5 | Le mot est dans le menu. En voyant la page après coup, je ne trouve en haut ni « moyenne » ni « présence » : « Assiduité et abandons » parle d'abandons, d'euros et de passages ; les notes sont plus bas et affichent « Aucune donnée ». |
| F9. Ouvrir le module CCP2 aux stagiaires | Menu « Réglages », rubrique PROMO (81, 485) : ouvrir quelque chose aux stagiaires me semble être un réglage de la promo. L'autre candidat que j'écarte à regret est « CCP2 » dans le menu. | Rien de visible ne mène à la tâche sur « Paramètres » : « Accès & invitations » parle d'inviter des personnes (« whitelist »), « Mes préférences » est personnel. Je ferais défiler vers le bas pour chercher une rubrique « modules » ou « promo ». | 3 puis 2 | Le sous-titre « gestion de la promo » me laisse espérer que c'est plus bas, mais le mot « module » n'apparaît pas sur la partie visible, ni le mot CCP2. Il y a un risque de croire que c'est « Rôle : Stagiaire » qu'il faut régler, ce qui serait un contresens. |
| F10. Voir l'app comme la voit un stagiaire | Le bloc « Romain / Formateur » en bas à gauche (90, 765), parce que mon rôle y est écrit. | Rien ne mène à la tâche dans le menu qui s'ouvre (Nouveautés, Réglages, Actualiser, Informations légales, Se déconnecter). Je tenterais « Réglages » (353, 601) sans y croire. | 3 puis 1 | Aucune mention de « Voir comme », « Changer de rôle » ou « Vue stagiaire ». Je penserais qu'il faut se déconnecter puis se reconnecter avec un compte stagiaire, ce que je ne ferais pas sur l'ordinateur de la salle. |
| F11. Passer à la promo de Montpellier | Le sélecteur « PROMO mars 2026 » avec sa petite flèche, tout en haut à gauche (110, 38). | Sans objet. | 5 | Le mot PROMO, le badge et la flèche disent que c'est une liste déroulante. |
| F12. Replier la barre de gauche | La petite icône carrée avec un chevron « < » juste à droite du sélecteur de promo, en haut du menu (234, 38). | Sans objet. | 4 | Icône sans texte et discrète (gris sur vert foncé), mais c'est le symbole habituel pour replier un panneau et il est au bon endroit, en haut du menu. |
| F13. Barre repliée : liste des stagiaires | L'icône des deux personnes, la quatrième en dessous de la maison (37, 275). | Sans objet. | 4 | Aucun libellé : je me fie à l'ordre vu quand la barre était ouverte (maison, calendrier, feuille cochée, deux personnes, bonnet, livre, cible). Quelqu'un qui ne retient pas l'ordre pourrait hésiter avec le bonnet universitaire (les « élèves »). Je ne vois pas si une info-bulle apparaît au survol. |
| F14. Poser une question à l'assistant | « Assistant » avec sa bulle, en bas du menu (81, 718). | Sans objet. | 5 | Libellé identique à la consigne, emplacement à part, bien séparé du reste. |
| F15. Dates clés de la promo (examens, stages) | Menu « Planning » (79, 140). J'ai regardé la carte « Prochain événement majeur » de l'accueil, mais elle ne montre qu'un seul événement. | Onglet « Dates clés » en haut du Planning (416, 111). | 3 puis 5 | Au premier clic j'hésitais avec « Notes et examens » (pour les examens) et « CCP2 » (pour les stages). Sur le second écran, « Dates clés » reprend les mots de la consigne. |

#### Remarques générales

##### Ce qui m'a paru clair

- Le menu de gauche : des mots simples, des icônes qui aident, un ordre qui suit ma journée (Planning, Émargement, Stagiaires, Notes, Cours). L'entrée où je suis se voit bien (fond plus clair et trait vert).
- Le bandeau « Émargement du matin ouvert : 2 sur 6 ont signé » avec « Voir » : c'est ce dont j'ai besoin chaque matin, et il reste présent sur les autres pages.
- La page Émargement : la phrase d'explication (chaque stagiaire signe sur son téléphone, puis je signe et je clos), la semaine en cartes, la mention « AUJOURD'HUI », l'orange pour la feuille ouverte, et les états lisibles (Pas de feuille, À ouvrir, À venir).
- Le Planning : les onglets Semaine, Dates clés, Priorités, et la phrase « Lecture seule. Clique « Modifier »... » qui dit comment faire.
- Cours et QCM : l'onglet « Signalements » avec le même drapeau que les pastilles rouges des lignes.
- Stagiaires : une fiche par personne avec des onglets dans mon vocabulaire (Passages, EPCF, Livret, Dossier pro). L'orange sur « Livret vierge » et « Dossier vierge » me montre d'un coup d'oeil qui est en retard.
- En haut à gauche : le choix de promo et, juste à côté, le bouton pour replier le menu. « Assistant » en bas du menu.
- Les Notes : la ligne d'aide « clique une cellule, tape une note (0-20), Entrée valide, Esc annule ».

##### Ce qui m'a paru confus

- « -2 jours » dans « Prochain événement majeur » : le stage a commencé le 26/10 et finit le 06/11, donc ce n'est ni « prochain » ni « -2 jours ». J'ai cru à une erreur d'affichage. J'attendrais « en cours, fin dans 9 jours ».
- La pastille « 9+ » sur mon prénom : elle ressemble à des alertes à traiter. Dans le menu du compte, on voit que ce sont les « Nouveautés » (icône de cloche), c'est-à-dire de l'information sur l'application, pas du travail à faire. Un chiffre qui reste à 9+ finit par ne plus rien dire.
- Le menu du compte ne propose pas de « voir comme un stagiaire », et « Réglages » y fait doublon avec le menu de gauche.
- Planning : la page s'ouvre sur la semaine du 12 octobre alors qu'on est le 28 ; « Aujourd'hui » (en haut à droite) et « Cette semaine » (près de la date) se ressemblent ; l'onglet « Priorités » ne m'évoque rien ; « Élèves bénévoles » est un bouton caché dans le Planning et je ne sais pas ce qu'il ouvre.
- Les élèves bénévoles n'ont aucune entrée dans le menu et ne sont pas dans « Stagiaires » : rien ne dit où ils se trouvent.
- Réglages : « whitelist », « admin », « mdp », « Connecte-toi en admin pour inviter ou modifier » sont des mots d'informaticien. L'adresse « banc@example.test » m'a surprise. Je ne vois aucune rubrique « modules » ni « CCP2 » dans la partie visible.
- Les noms changent entre le menu et la page : « Notes et examens » devient « Notes & évaluations », « Réglages » devient « Paramètres », « Cours et QCM » devient « Cours », « Indicateurs » devient « Tableau de bord du centre / Nîmes, mars 2026 ». Les petits titres au-dessus (« FORMATEURS » au-dessus de Stagiaires, « SYSTÈME » au-dessus de Paramètres, « 0 NOTE ENREGISTRÉE » au-dessus de Notes) ne veulent pas dire la même chose d'une page à l'autre.
- « PROMO » apparaît deux fois : le sélecteur en haut et la rubrique du menu qui ne contient que Indicateurs et Réglages, alors que Stagiaires et Planning concernent aussi la promo.
- Cours : le gros bouton vert « Ajouter une notion » : je ne sais pas ce qu'est une « notion » (un thème, une compétence ?). Les lignes de QCM empilent plusieurs étiquettes (QCM, Examen ouvert, drapeau 3, « Examen - », « Entraîn. 10/20 ») que je n'arrive pas à lire d'un coup.
- Notes : les colonnes sont « Thème 1 à 21 » avec seulement des numéros et continuent hors de l'écran (57 thèmes) ; « C1, C2, REMC, GDE » ne sont pas expliqués (GDE surtout) ; l'ordre des stagiaires n'est pas le même que dans la page Stagiaires ; rien sur les QCM.
- Indicateurs : je cherche « moyenne » et « présence » et je trouve « Assiduité et abandons », avec des euros (« Valeur des parcours interrompus », hypothèse 3 500 à 5 000 € par parcours) : on dirait une vue de directeur de centre. Les étiquettes « MESURÉ / ESTIMÉ » et les « Méthode » sont trop techniques pour moi.
- Stagiaires : dans « EPCF 2/2 · Livret · Dossier 01/10 », je ne sais pas si « 01/10 » est une date (1er octobre) ou une fraction (1 sur 10).
- Barre repliée : plus aucun mot, et l'icône pour la rouvrir (sous le badge NM) n'est pas au même endroit que l'icône pour la replier.
- Accueil : le haut de la page est occupé par la date, un grand « Bonjour, Romain » et une phrase de bienvenue qui cite « calendrier, contacts » alors que je ne vois ni « Calendrier » ni « Contacts » dans le menu. Les « Nouveautés » parlent surtout du téléphone, donc des stagiaires, pas de mon travail sur l'ordinateur de la salle. Il me salue sous le nom de Romain alors que je suis Sandrine : je suppose que le compte de la salle est le sien, mais ce n'est pas dit.
- Beaucoup de petits textes (sous-titres de la liste des stagiaires, pauses du planning, étiquettes, titre de rubrique « PROMO ») : à mon âge et sur l'écran de la salle, je les lis difficilement.

##### Ce qui me manque pour mon travail de formatrice

- Sur l'accueil, un bloc « Aujourd'hui » : le programme de la journée, qui est absent, les prochains passages. Et un bloc « À traiter » : signalements en attente, questions de l'IA à relire, avec des chiffres et des raccourcis (ouvrir l'émargement, saisir des notes).
- Une pastille de compteur dans le menu sur « Cours et QCM » pour les signalements et les propositions de l'IA.
- Un vrai « Voir comme un stagiaire », facile à trouver (et à quitter).
- Pour les notes, saisir une évaluation à la fois (je choisis le QCM, puis je remplis une colonne de 6 noms) plutôt que chercher une colonne dans une matrice de 57 thèmes qui ne portent que des numéros.
- Un taux de présence et une moyenne de la promo, par stagiaire et pour le groupe, lisibles tout de suite.
- Un endroit clair pour les élèves bénévoles (liste et ajout), avec un chemin depuis Stagiaires comme depuis Planning.
- Les coordonnées des stagiaires (téléphone, mail) : la page Stagiaires n'en montre pas, alors que l'accueil parle de « contacts ».
- Une recherche rapide d'un stagiaire ou d'un thème, et, dans la barre repliée, des noms au survol.

##### Impression générale

Le menu de gauche est clair et rangé comme je travaille : quand le mot est écrit dans le menu (Planning, Indicateurs, Assistant, la promo en haut), je trouve du premier coup. Je me perds dès que la fonction est cachée dans une page (élèves bénévoles, questions de l'IA, ouvrir le CCP2, voir comme un stagiaire), et quelques détails (« -2 jours », « 9+ », la semaine du 12 octobre) me font croire à une erreur de l'application.

##### Réserve de méthode (hors du rôle de Sandrine)

Dans la consigne, les noms des seconds écrans (cours.png, reglages.png, accueil-compte.png, etc.) indiquent à l'avance la rubrique attendue. J'ai fixé tous les premiers clics d'après l'accueil seul avant d'ouvrir les autres captures, mais la confiance du premier clic pour F2 à F10 et F15 est peut-être légèrement gonflée par ce soupçon.

---

### Test premier clic - formateur (Romain) sur téléphone, 375 px

Je joue Romain, formateur à Nîmes, qui découvre la nouvelle présentation entre deux leçons de conduite. Les coordonnées sont approximatives, dans le repère des captures (750 px de large). Confiance : 1 = je devine, 5 = évident. Quand la tâche a deux écrans, je donne la confiance du premier toucher, puis celle du second.

#### Résultats par tâche

| Tâche | Premier toucher (écran de départ : accueil) | Second toucher | Confiance | Remarque |
|---|---|---|---|---|
| F1. Ouvrir la feuille d'émargement de ce matin | Bouton « Voir » à droite du bandeau « Émargement du matin ouvert : 2 sur 6 ont signé », juste sous l'en-tête sombre (≈ x 653, y 188) | Sans objet (pas de second écran) | 5 | Le bandeau reprend les mots de la tâche et son bouton est collé au texte ; « Voir » seul serait vague, le contexte suffit. |
| F2. Saisir les notes du dernier QCM pour la promo | « Notes » dans la barre du bas, 4e entrée sur 5, icône chapeau de diplômé (≈ x 521, y 1450) | Je fais défiler vers le bas pour faire apparaître les lignes, puis je touche la cellule du premier stagiaire sous la colonne du thème de ce QCM. Sur la capture je ne vois aucune cellule, seulement l'en-tête du tableau (« Thème 1, 2, 3 », ≈ y 1300) | 1er : 4, 2e : 3 | « Clique une cellule pour saisir la note » me confirme le lieu, mais le tableau est coupé par la barre du bas et rien ne dit quelle colonne est « le dernier QCM » (le mot QCM n'apparaît pas sur la page). |
| F3. Voir les passages au tableau d'un stagiaire | « Stagiaires » dans la barre du bas, 3e entrée sur 5, icône deux silhouettes (≈ x 372, y 1450) | La ligne d'un stagiaire, par exemple « A. Céline », première de la liste, n'importe où sur la ligne (≈ x 360, y 596) | 1er : 3, 2e : 3 | « Passages » n'a aucune entrée à son nom, je pars sur « une fiche par personne » ; le résumé des lignes (EPCF, Livret, Dossier) ne parle pas de passages, donc je doute de les y trouver. |
| F6. Traiter les signalements d'erreur faits par les stagiaires sur les QCM | « Plus » dans la barre du bas, 5e entrée sur 5, icône grille de quatre carrés (≈ x 668, y 1450), par élimination | « Cours et QCM » dans la fenêtre Plus, section « Tout l'espace formateur », 2e ligne, icône livre ouvert (≈ x 210, y 842) | 1er : 2, 2e : 3 | Aucun mot « signalements » sur l'accueil ni dans Plus : « Cours et QCM » est une déduction, et le « 9+ » sur mon « R » m'a intrigué sans que je sache ce qu'il compte. |
| F8. Voir les indicateurs de la promo (moyennes, présence) | « Plus » (5e entrée de la barre du bas), par élimination ; « Notes » m'a tenté pour les moyennes | « Indicateurs » dans la fenêtre Plus, section « Promo », 1re ligne, icône histogramme (≈ x 192, y 1092) | 1er : 2, 2e : 5 | L'accueil n'affiche aucun chiffre de la promo, donc je cherche dans le fourre-tout ; ensuite « Indicateurs » colle au mot de la tâche et l'icône histogramme confirme. |
| F11. Passer à la promo de Montpellier | Pastille « PROMO / mars 2026 » avec sa petite flèche vers le bas, tout en haut à gauche dans l'en-tête sombre (≈ x 330, y 55) | Sans objet (pas de second écran) | 4 | Le mot PROMO, le contour de bouton et la flèche disent « sélecteur » ; seule la flèche est petite et grise, et la ville n'est pas écrite en toutes lettres (juste « NM »). |
| F14. Poser une question à l'assistant | « Plus » (5e entrée de la barre du bas), en dernier recours, faute de bouton « Assistant » visible | Sans objet (pas de second écran fourni) | 1 | Rien sur l'accueil ne mène à l'assistant (ni bulle, ni icône de discussion) alors que la carte « Nouveautés » en parle ; après coup, « Assistant » est bien dans la fenêtre Plus, section « Outils », mais je ne l'aurais pas deviné. |
| F16. Voir le planning de demain | « Planning » dans la barre du bas, 2e entrée sur 5, icône calendrier (≈ x 226, y 1450) | « Cette semaine », bouton à droite des deux flèches précédent et suivant, sous le titre (≈ x 605, y 851), puis « JEU » dans la rangée des jours ; « Aujourd'hui », en haut à gauche, m'aurait tenté aussi | 1er : 5, 2e : 3 | L'onglet est évident, mais l'écran s'ouvre sur la semaine du 12 octobre alors qu'on est le 28 : toucher « JEU » directement m'afficherait le 15, pas demain. |

Lecture rapide : F1, F16 et F11 se trouvent du premier coup (confiance 5, 5, 4) ; F2 et F3 demandent un peu de déduction (4 et 3) ; F6, F8 et F14 (2, 2, 1) ne sont annoncées par rien sur l'accueil, je passe par « Plus » par élimination. Seule F8 se confirme nettement une fois « Plus » ouvert.

#### Remarques générales

##### Ce qui m'a paru clair

- La barre du bas : cinq entrées avec une icône et un mot (Accueil, Planning, Stagiaires, Notes, Plus), l'entrée active en pastille verte et en gras. Je sais toujours où je suis, et les mots correspondent à ce que je cherche (Planning, Stagiaires, Notes). Par rapport à l'ancienne rangée d'icônes en haut, les mots sous les icônes me rassurent.
- Le bandeau d'émargement du matin, présent en haut de tous les écrans : le décompte « 2 sur 6 ont signé » et le bouton « Voir » se comprennent tout de suite.
- La pastille « PROMO mars 2026 » en haut à gauche : elle dit où je suis et laisse penser qu'on peut en changer.
- La fenêtre « Plus » : trois sections nommées (« Tout l'espace formateur », « Promo », « Outils »), des libellés en clair, une icône par ligne. « Indicateurs » et « Assistant » s'y repèrent à la première lecture.
- Les écrans eux-mêmes : un petit mot au-dessus du titre, un titre, une phrase d'aide (« Clique une cellule pour saisir la note »). La liste des stagiaires se lit bien au pouce, avec en orange ce qui manque (EPCF 0/2, Livret vierge).

##### Ce qui m'a paru confus

- Le « 9+ » sur mon « R » : rien n'indique ce qu'il compte. Je l'ai pris pour des choses à traiter ; en ouvrant le menu du compte, c'est le nombre de « Nouveautés ». Un compteur sur un avatar se lit comme « des choses m'attendent » et détourne l'œil de ce qui est vraiment à traiter.
- « Plus » et son icône grille : un fourre-tout sans indice. Des fonctions importantes (assistant, indicateurs, QCM, émargement) y sont rangées et rien sur l'accueil ne les annonce. Les icônes que je connaissais en haut ont disparu, je suppose qu'elles sont là.
- Le mot « signalements » n'existe dans aucun menu : je ne sais pas qu'il faut passer par « Cours et QCM ».
- L'accroche de l'accueil promet « planning, passages, notes, calendrier, contacts », mais seuls Planning et Notes existent comme entrées : pour « passages », « calendrier » et « contacts », je ne sais pas où aller.
- Planning : l'écran s'ouvre sur la semaine du 12 octobre alors qu'on est le 28, et plusieurs commandes voisines se ressemblent (« Aujourd'hui », « Cette semaine », le sélecteur de date, les flèches) : on ne sait pas laquelle donne « demain ».
- Notes : une colonne étroite par thème (« Thème 1, 2, 3 », ça continue hors écran) sur 375 px, un tableau coupé par la barre du bas, des sigles non expliqués (MOY., C1, C2, REMC, GDE), un onglet « EPCF » que je ne sais pas relier à ma tâche, et « 0 NOTE ENREGISTRÉE » qui m'inquiète une seconde. L'aide « Entrée valide, Esc annule » parle à un clavier, pas à un pouce, et « Clique » aussi (sur un téléphone, on touche).
- « Prochain événement majeur : Stage entreprise CCP2 02 ... -2 jours » : un décompte négatif pour un événement déjà commencé se lit comme une erreur ; j'attendrais « en cours » ou « depuis 2 jours ».
- Deux « Réglages » (ceux de la promo dans Plus, ceux du compte dans le menu de « R ») et deux portes vers le compte (le « R » et « Mon compte »), sans que je sache ce que contient chacun.
- Stagiaires : le petit mot « FORMATEURS » au-dessus du titre m'a fait croire une seconde à une liste de formateurs ; les noms « A. Céline » se lisent à l'envers (j'attends « Céline A. »).
- Le titre « Tout l'espace formateur » annonce tout mais ne regroupe que trois entrées (Émargement, Cours et QCM, CCP2).
- L'en-tête, le bandeau d'émargement et la barre du bas mangent ensemble près d'un quart de la hauteur : sur Notes, il reste très peu de place pour le tableau. Sur l'accueil, le « Bonjour » et l'accroche occupent plus d'un tiers de l'écran avant la première information utile.

##### Ce qui me manque sur le téléphone

- Un accès à l'assistant visible depuis toutes les pages (bulle ou icône dans l'en-tête).
- Mon planning du jour et de demain directement sur l'accueil, et un planning qui s'ouvre sur aujourd'hui avec « jour précédent » et « jour suivant ».
- Des pastilles « à traiter » qui comptent de vraies tâches (signalements de QCM en attente, notes à saisir, signatures manquantes).
- Une saisie de notes pensée pour le pouce : choisir un QCM, puis une liste de stagiaires avec un champ de note par ligne, au lieu du tableau.
- Un accès direct aux passages au tableau (par stagiaire et par date) et aux contacts (appeler un stagiaire en un toucher).
- Une recherche (stagiaire, cours, QCM).
- Le nom de la ville dans le sélecteur de promo, pas seulement « NM ».

##### Impression générale

La barre du bas avec un mot sous chaque icône est nette, et je retrouve vite l'émargement, le planning, les stagiaires, les notes et le changement de promo. Mais plusieurs fonctions importantes (assistant, signalements, indicateurs) sont rangées derrière « Plus » sans le moindre indice sur l'accueil, et les écrans Notes et Planning se comportent encore comme sur un grand écran.

## 2. Inventaire des écarts (agent du 28/10)

À compléter à l'arrivée du rapport (textes à aligner avec `fichier:ligne`, écarts par lot).
