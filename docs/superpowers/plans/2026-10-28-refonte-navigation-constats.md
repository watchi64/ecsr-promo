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

Rapport d'un agent indépendant, rendu tel quel : il a lu la spec, la maquette, le code et observé le banc, interrupteur allumé.

## Nouvelle navigation : écarts entre la conception validée et l'app réelle

Date : 28/10/2026. Base : `main` à 41472e4 (copie `C:/Users/watch/Dev/ecsr-promo-lot2`, branche `lot2-accueils`).
Périmètre : espaces stagiaire et formateur, interrupteur allumé. Direction, siège (lot 5) et habillage ECF (lot 3)
ne figurent que s'ils laissent un trou visible.

### Méthode

- Référence : spec `docs/superpowers/specs/2026-10-27-refonte-navigation-roles-design.md` (§ 3, 4.1, 4.2, 4.5, 5),
  découpage `docs/superpowers/plans/2026-10-27-refonte-navigation-lots.md`, annexes du plan du lot 1 (R1 à R36),
  maquette `docs/maquettes/refonte-navigation.src.html` (fonctions `stAccueil`, `stPlanning`, `stCours`, `stSuivi`,
  `fAujourdhui`, `fCours`, `ROLES`, `accountMenu`, `moreSheet`, `assistantSheet`).
- Banc `http://127.0.0.1:8050/_harness.html`, Chromium (Playwright), allumage simulé comme un vrai : ligne
  `navigation_v2 = true` de la promo 1 semée dans le faux Supabase (servi depuis la mémoire, fichier non modifié),
  stagiaire sans drapeau de fondateur, formateur non fondateur, `date=2026-10-28`, `emargement=1`.
  Largeurs 1280 et 375. Scripts et relevés JSON :
  `C:/Users/watch/AppData/Local/Temp/claude/C--Users-watch-Dev-ECSR/39263caa-6d80-49e7-8a33-c56eb87ce63f/scratchpad/lot2/ecarts_outils/`
  (`banc_ecarts.py`, `banc_details.py`, `banc_deux_promos.py`, `releves/*.json`). Captures de
  `scratchpad/lot2/premier-clic/` relues (stagiaire 375 et 1280, formateur 375 et 1280).
- Repères : **[observé]** = vu au banc ou sur une capture ; **[code]** = lu dans le code ; **[supposé]** = non vérifié.
- Gravité pour l'allumage :
  - **bloquant** : une personne de la promo allumée serait trompée sur un geste ou un emplacement actuel, ou perdrait
    le moyen de trouver une fonction utile, ou une règle du projet serait enfreinte (Nouveautés) ;
  - **gênant** : incohérence visible (nom, doublon) sans perte de fonction ;
  - **plus tard** : écart à la maquette sans effet sur l'usage d'aujourd'hui.

### 1. Tableau des écarts

#### Transversal

| # | Élément de la spec ou de la maquette | État réel, interrupteur allumé | Lot | Gravité | Fichiers |
|---|---|---|---|---|---|
| T1 | Changement annoncé par une entrée Nouveautés (spec § 4.5, annexe du plan, règle « Nouveautés systématiques ») | Aucune entrée. Aucun filtre des Nouveautés par navigation : une entrée ajoutée s'affiche dans toutes les promos, allumées ou non (`visibles` ne filtre que « formateurs », `nouveautesPour` que les modules) [code]. Les deux textes prévus en annexe disent « Tes initiales, en haut à droite » et « bouton Assistant, en haut de l'écran » dans l'entrée « tous » : faux pour un formateur sur ordinateur (pied de la barre latérale). Ils ne disent ni où sont passées les notes de la classe (Mon suivi, La classe) ni où sont les contacts du centre | allumage | **bloquant** | `js/nouveautes-data.js`, `js/nouveautes.js:40-42`, `js/modules.js:137-141`, `js/modules-etat.js:191-197` |
| T2 | Assistant qui guide dans l'app (spec § 4.2 ; son rôle 1 dans le prompt) | Le panneau s'ouvre bien depuis la coquille [observé]. Ses consignes décrivent l'ancienne barre : onglets en haut, logo vers « Mon espace », bouton rond en bas à droite, tuile Tableau de bord, Calendrier, Ressources, Paramètres, pastille sur l'onglet Accueil [code]. Le client n'envoie que la route : la fonction ne sait pas quelle navigation voit la personne. Le jour de l'allumage, « où est passé le calendrier ? » est justement la question qu'on lui posera | allumage | **bloquant** | `supabase/functions/chatbot/aide.mjs`, `supabase/functions/chatbot/index.ts:107`, `js/chatbot.js:126-129` |
| T3 | Textes « Où le trouver » et consignes alignés sur « Mon suivi » (annexe du plan, R34) | Inchangés : « Mon espace personnel, partie… », « Le logo en haut à gauche » (le logo mène maintenant à l'Accueil), « Ressources », « Notes », « Paramètres », « Accueil, tuile… », « Planning, bouton Priorités », « Pastille en haut, à côté de ton nom » ; consignes « Ouvre ton espace personnel avec le logo », « Le bouton Aujourd'hui au planning » [observé sur la page Nouveautés, 32 cartes stagiaire, 48 formateur]. Lien du parcours CCP2 « Mon espace, sous-onglet Dossier pro » [observé] alors que Nîmes est en CCP2. Les liens mènent quand même au bon endroit grâce aux redirections [observé] | allumage | **bloquant** | `js/nouveautes-data.js`, `js/modules-data.js`, `js/ccp2-parcours-data.js:313`, `js/views/nouveautes.js:17-29`, `js/views/ccp2.js:27-43` |
| T4 | Annonces d'ouverture de module (Nouveauté générée quand un formateur ouvre un module) et explications des modules (Réglages, lues par les formateurs) | Faux sous la v2 [code] : « Le bouton en haut de l'écran t'amène à la journée du jour » (Planning), « Un bouton en haut du Planning » (Priorités), « l'onglet Notes », « l'onglet Évolution » de « ton espace personnel », « dans Paramètres », « La vue de la classe est dans Notes » (EPCF), « Une bulle en bas de l'écran » (Assistant). Les annonces étant générées à partir du catalogue, corriger le catalogue corrige aussi les anciennes | allumage | **bloquant** pour une promo dont des modules restent à ouvrir (Montpellier) ; gênant si Nîmes a déjà tout ouvert [supposé, base non lue] | `js/modules-data.js:59-60, 85-101, 139-167, 182-186` |
| T5 | Contacts du centre dans le menu du compte, le panneau de l'assistant et le pied de l'Accueil (spec § 4.2, maquette) | Aucun des trois [observé]. Les contacts (numéros pour prévenir d'une absence) ne sont plus que sous Cours et QCM, sous-onglet Documents, page titrée « Ressources & contacts » [observé]. Ni le nom de l'entrée, ni la Nouveauté prévue, ni l'assistant ne le disent | allumage | **bloquant** | `js/menu-compte.js`, `js/views/ressources.js:250`, `js/views/home.js` |
| T6 | Une page, un nom (R30 ; spec § 4.2 « une même liste porte un seul nom partout ») | Titres restés anciens [observé] : Cours et QCM affiche « Cours » ; Dates clés affiche « Calendrier » (surtitre « 7 événements au calendrier ») ; Documents affiche « Ressources & contacts » ; Notes et examens affiche « Notes & évaluations » ; Indicateurs affiche le surtitre « Tableau de bord du centre » ; Réglages ouvre « Paramètres » ; Mon suivi garde le surtitre « Espace personnel » | allumage | gênant | `js/views/themes.js:1884`, `js/views/calendrier.js:269-270`, `js/views/ressources.js:250`, `js/views/notes.js:1082`, `js/views/centre.js:290`, `js/views/config.js:728`, `js/views/mon-suivi.js:715` |
| T7 | Interrupteur par promo (lot 1) | Un formateur qui a deux promos change de navigation en changeant de promo : sidebar sur la promo allumée, ancienne barre après le choix de la promo éteinte (rechargement) [observé, banc deux promos]. Les 3 formateurs voient toutes les promos (spec § 2) | allumage (décision) | gênant | `js/nav-etat.js:34-45`, `js/db.js:157-164` |
| T8 | L'app s'ouvre « sur ce qui concerne la personne aujourd'hui » ; `#/home` mène à l'accueil de l'espace (spec § 3, § 4.5) | Démarrage à froid sans mémoire : stagiaire sur Mon suivi, formateur sur Stagiaires avec la fiche du premier stagiaire ouverte (`#/stagiaires/6` au banc), fondateur sur Mon suivi sans entrée allumée dans la barre de l'équipe [observé]. Ensuite, la dernière page quittée, comme `main` | 2 | plus tard (gênant pour le fondateur seul) | `js/main.js:274, 510`, `js/route-rules.js:44-46` |
| T9 | Aucun défilement de côté, sauf la matrice des notes (spec § 3) | Dettes d'avant le lot 1, retrouvées à 375 px [observé] : `.notes-chart-svg-wrap` 540/301 px (Mon suivi > La classe, et Notes et examens) ; `.passages-table-wrap` 519 à 556/343 px (Planning > Priorités, historique des passages) ; `.centre-defile` 380 et 410/345 px (Indicateurs) ; lien de `.qcm-signal-instr-ligne` qui finit à 441 px dans une fenêtre de 375 (Signalements). Rien de neuf dû à la coquille | 2 (R10, R11) | plus tard | `js/views/notes.js:1280, 1609`, `js/views/passages.js:135`, `js/views/centre.js:135, 186`, `js/views/signalements.js:59` |
| T10 | Point sur « Plus » et compteur « 5 à traiter » (spec § 4.2) | Absents, comme décidé (R20) [observé] | 2 | plus tard | `js/nav-shell.js`, `js/nav-rules.js` |
| T11 | « Signaler un problème » (menu du compte, panneau de l'assistant, pied de la barre latérale, tiroir « Plus ») | Absent partout [observé] | chantier suivant (hors lots 1 à 5) | plus tard | `js/menu-compte.js`, `js/nav-shell.js` |
| T12 | Aucune note en rouge (anti-objectif, spec § 3) | Les graphiques de `notes.js` gardent des rouges écrits en dur (#DC2626, #991B1B : moyennes basses, distribution), montrés au stagiaire dans Mon suivi > La classe (ils l'étaient déjà dans l'onglet Notes) [code]. Seul trou du lot 3 visible chez le stagiaire | 3 | plus tard | `js/views/notes.js:1338-1342` et `avgColor` de `renderAveragesChart` |
| T13 | R35 : case « Nouvelle navigation » du fondateur après une lecture ratée | Décochée alors que la promo est allumée par la mémoire de l'appareil (`casePromo.checked = reglage === true`) [code]. Les « deux cas latents de fenêtres » ne sont pas détaillés dans le dépôt (registre supprimé, R36) | 2 | plus tard | `js/nav-etat.js:138` |
| T14 | R32 : interrupteur réservé au fondateur | Tenu par l'interface seulement ; la base laisse un formateur de la promo l'écrire | 4 | plus tard | `js/nav-etat.js`, règles RLS de `settings` |
| T15 | Anciennes adresses (spec § 4.5) | Conformes [observé] : `#/calendrier` vers Planning > Dates clés, `#/ressources` vers Cours et QCM > Documents, `#/dashboard` vers Planning > Priorités, `#/notes` du stagiaire vers Mon suivi > La classe, `#/notes` du formateur reste Notes et examens, `#/mon-suivi` d'un formateur sans profil vers Stagiaires | aucun | conforme | `js/nav-rules.js`, `js/main.js:252-260` |
| T16 | Interrupteur éteint : app identique à `main` | Conforme [observé] : ancienne barre de 8 onglets, ouverture sur « Mon espace » | aucun | conforme | |

#### Stagiaire

| # | Élément de la spec ou de la maquette | État réel, interrupteur allumé | Lot | Gravité | Fichiers |
|---|---|---|---|---|---|
| S1 | Accueil : la journée (séance, passage au tableau, voiture) avec « Signer pour ce matin » | Absente : l'Accueil est l'ancien (salutation, compte à rebours, Nouveautés, tuiles, prochains événements, « À retenir ») [observé]. La signature passe par le bandeau « Émargement du matin ouvert · Signer », en haut de chaque page [observé] | 2 | plus tard | `js/views/home.js`, `js/emargement-bandeau.js` |
| S2 | Accueil : À faire (QCM, dossier, livret) ; contacts et « Apparence et réglages » en pied | Absents [observé] ; le pied garde « code source · paramètres » | 2 (contacts : voir T5) | plus tard | `js/views/home.js:281-292` |
| S3 | Accueil : pastille de date et salutation (DA de Timy) | Présentes : « Mercredi 28 octobre 2026 », « Bonjour, le stagiaire du banc » [observé]. Écarts : la maquette donne le jour sans l'année et une ligne « Promo de Nîmes, mars 2026 · semaine 31 » ; le nom « initiale du nom + prénom » se lit « Monsieur » quand l'initiale est M. (point faible du § 5) ; le logo apparaît deux fois (en-tête et haut de page) | 2 | plus tard | `js/views/home.js:104-121` |
| S4 | Accueil sans tuiles (la barre porte les destinations) | Six tuiles aux anciens noms, en double de la barre : Planning, Calendrier, Cours, Notes, CCP2, Ressources [observé]. Elles mènent au bon endroit par redirection [observé] | allumage (masquer ou renommer sous la v2), puis 2 | gênant | `js/views/home.js:129-161` |
| S5 | Accueil : prochain rendez-vous | Le compte à rebours « Prochain événement majeur » existe ; il affiche « -2 jours » pour un stage en cours (défaut déjà présent sur `main`, vu au banc) | 2 | plus tard | `js/views/home.js:185-202` |
| S6 | Planning > Semaine en grille (jours en colonnes, demi-journées en lignes) ou en liste ; sur iPhone, bande de cinq jours puis le jour choisi ; repère « Toi au tableau, 10 h 15 » | Liste de cartes jour par jour ; la barre des jours fait défiler, elle ne choisit pas un jour ; ni bascule Grille / Liste, ni repère « Toi » [observé, code] | 2 | plus tard | `js/views/planning.js`, `js/views/planning-espace.js` |
| S7 | Bouton « Aujourd'hui » en haut du Planning (R29) | Présent en tête de Semaine [observé]. Absent quand le Planning rouvre sur Dates clés ou Priorités, ce que fait la mémoire du sous-onglet [observé] | 2 | gênant | `js/views/planning.js:2850-2856` |
| S8 | Planning > Priorités : « Ton ordre de passage, 5e sur 14 » | Les priorités de toute la classe, sans rang personnel [observé] | à attribuer | plus tard | `js/views/dashboard.js` |
| S9 | Cours et QCM : Thèmes, Compétences, QCM, Documents, avec recherche | Thèmes, Compétences, Documents ; pas de sous-onglet QCM (les QCM sont dans la liste des thèmes) ; recherche dans Thèmes seulement ; titre « Cours » (T6) [observé] | à attribuer (titre : allumage) | plus tard | `js/views/themes.js:1898-1931` |
| S10 | Mon suivi : Résultats (moi / la classe, ex-Notes), Passages, EPCF, Livret, Dossier pro ; la maquette ouvre sur « Notes » avec Moi / La classe | Passages, EPCF, Évolution, Livret, Dossier pro, La classe (en dernier) [observé] ; sous-titre « Mon planning à venir et l'évolution de mes résultats » | à attribuer | plus tard | `js/views/mon-suivi.js:473-478, 713-720` |
| S11 | Mon suivi > La classe | Toute la page Notes imbriquée : second titre « Notes & évaluations », phrase « Lecture seule. Connexion admin requise pour modifier. », seconde rangée Matrice / EPCF, donc deux « EPCF » visibles en même temps sur ordinateur [observé] | allumage (titre et phrase), puis à attribuer | gênant | `js/views/mon-suivi.js:694-702`, `js/views/notes.js:1079-1160` |
| S12 | En-tête : logo et promo, onglets, Assistant nommé, compte avec flèche (spec § 4.2, R16) ; barre du bas de 5 cases nommées sur téléphone | Conforme à 1280 et 375 px [observé] | aucun | conforme | |
| S13 | Menu du compte : Apparence, Nouveautés, Contacts du centre, Signaler un problème, Préférences et données, Se déconnecter | Nouveautés (avec pastille), Réglages, Actualiser, Informations légales, Se déconnecter [observé]. Manquent Contacts (T5), Signaler (T11), Apparence (lot 3, sans trou visible) | allumage (Contacts) ; 3 ; chantier suivant | voir T5 | `js/menu-compte.js` |
| S14 | Panneau de l'assistant : suggestions, Signaler un problème, Contacts du centre | Conversation seule [observé] | allumage (Contacts) ; chantier suivant ; à attribuer | gênant | `js/chatbot.js` |

#### Formateur

| # | Élément de la spec ou de la maquette | État réel, interrupteur allumé | Lot | Gravité | Fichiers |
|---|---|---|---|---|---|
| F1 | Aujourd'hui : émargement du matin, au tableau ce matin, en voiture cet après-midi, À traiter, À suivre de près | Absent : l'entrée « Accueil » ouvre l'ancien Accueil avec neuf tuiles (Stagiaires, Tableau de bord, Émargement, Planning, Calendrier, Cours, Notes, CCP2, Ressources) [observé] | 2 (tuiles : allumage, voir S4) | plus tard | `js/views/home.js`, `js/nav-rules.js:33` |
| F2 | Émargement avec repère « Ouverte » | Entrée présente quand l'émargement est activé [observé] ; aucun repère dans la barre, le bandeau du haut de page le dit (« 2 sur 6 ont signé · Voir ») [observé] | 2 | plus tard | `js/nav-shell.js` |
| F3 | Cours et QCM : compteur ; Thèmes, Compétences, QCM et examens, Signalements, Propositions IA, Documents ; « Voir comme un stagiaire » | Thèmes, Compétences, « ⚑ Signalements », Documents ; pas de compteur ; QCM et propositions de l'IA dans l'éditeur de chaque thème ; pas de « Voir comme un stagiaire » ; titre « Cours » [observé] | 2 (compteur), 4 (voir comme), à attribuer (sous-onglets) | plus tard | `js/views/themes.js` |
| F4 | Stagiaires : sous-onglets Stagiaires / Élèves bénévoles ; recherche, filtres (En formation, À suivre, Abandons), Inviter ; fiche Passages, Notes, EPCF, Livret, Dossier pro | Liste et fiche (Passages, EPCF, Évolution, Livret, Dossier pro) [observé] ; bénévoles toujours dans le Planning (bouton « Élèves bénévoles ») ; ni recherche, ni filtres, ni Inviter | 2 si Aujourd'hui renvoie aux bénévoles, 4 (Inviter), sinon à attribuer | plus tard | `js/views/stagiaires.js`, `js/views/benevoles.js` |
| F5 | Notes et examens : Matrice, EPCF, Synthèse | Matrice (synthèse en dessous), EPCF ; titre « Notes & évaluations » [observé] | allumage (titre) ; à attribuer | gênant (titre) | `js/views/notes.js:1082, 1147-1159` |
| F6 | Indicateurs, limités à ses promos | Le tableau de bord du centre, surtitre « Tableau de bord du centre », titre = nom de la promo [observé] ; défilement de côté à 375 px (T9) | allumage (titre) | gênant | `js/views/centre.js:290` |
| F7 | Réglages de la promo (Ce que voient les stagiaires, Accès) ; « Préférences et données » au menu du compte | « Réglages » (groupe Promo) ouvre toute la page « Paramètres » : Accès & invitations, Mes préférences, Modules de la promo, Promo, Données personnelles, Informations ; la même page par le menu du compte [observé] | à attribuer (5 au plus tôt) ; titre : allumage | gênant (titre) | `js/views/config.js`, `js/nav-rules.js:41` |
| F8 | CCP2 : où en est chaque stagiaire dans le parcours | Le parcours du stagiaire, au tutoiement (« ton parcours en 8 étapes ») [observé] | à attribuer | plus tard | `js/views/ccp2.js` |
| F9 | Barre latérale : promo en tête, bouton Replier, groupes, pied Assistant / Signaler / compte ; « Voir cette promo comme un stagiaire » dans le sélecteur | Conforme sauf Signaler (T11) [observé] ; pas de « Voir comme un stagiaire » hors fondateur | 4 | plus tard | `js/nav-shell.js`, `js/promo-pastille.js` |
| F10 | Téléphone : 4 entrées + « Plus » ; tiroir avec l'Assistant | Conforme : Accueil, Planning, Stagiaires, Notes, Plus ; tiroir « Tout l'espace formateur » (Émargement, Cours et QCM, CCP2, Indicateurs, Réglages) puis Outils (Assistant, Mon compte) [observé] | aucun | conforme | |
| F11 | Planning en grille, avec qui est au tableau et combien en voiture | Liste de cartes, mode Modifier, boutons Aujourd'hui, Émargement, Élèves bénévoles [observé] | 2 | plus tard | `js/views/planning.js` |
| F12 | Menu du compte : Apparence, Nouveautés, Voir comme un stagiaire, Signaler, Préférences et données, Se déconnecter | Nouveautés, Réglages, Actualiser, Informations légales, Se déconnecter (et « Voir en tant que » pour le fondateur) [observé] | 3, 4, chantier suivant | plus tard | `js/menu-compte.js` |

Bilan : **5 écarts bloquants** (T1 à T5), 9 gênants (T6, T7, S4, S7, S11, S14, F5, F6, F7), le reste plus tard ou conforme.

### 2. Textes visibles à aligner

L'interrupteur reste éteint pour les autres promos : chaque texte commun doit rester juste avec l'ancienne barre.
Colonne « Deux navigations » : **neutre** = un seul texte, juste dans les deux ; **interrupteur** = texte choisi par
`navigationV2Active()` (comme `nomDeMonSuivi`, `js/views/mon-suivi.js:565`) ; **v1 seulement** = invisible sous la v2.
Colonne « Quand » : **avant** = avant l'allumage (destination ou geste qui n'existe plus sous la v2, dans un texte qui
décrit l'app actuelle) ; **après** = peut suivre (nom raccourci mais reconnaissable, ou récit daté).

Mécanismes proposés, pour ne pas écrire quarante textes à la main :

- **Libellés « Où le trouver »** (Nouveautés, annonces de modules) : sous la v2, un libellé tiré d'une table unique
  de `js/nav-rules.js` (route + sous-onglet + espace : « Mon suivi, partie Livret », « Planning, Dates clés »,
  « Cours et QCM, Documents »), plus un détail facultatif porté par l'entrée (« colonne QCM », « Mes préférences »).
  L'ancien `label` reste pour l'ancienne barre. Branché dans `lienOu` (`js/views/nouveautes.js:17-29`). Si le lot 2
  renomme une partie (« Résultats »), une seule ligne change.
- **Consignes « Comment faire »** : un `guideV2` facultatif sur l'entrée.
- **Nouveautés propres à une navigation** : un champ `navigation: "v2"` (les deux entrées de lancement) ou `"v1"`
  (option : masquer sous la v2 les entrées qui ne décrivent que l'ancienne barre, comme « Une barre d'onglets plus
  simple » ou « L'app s'ouvre sur ton espace personnel »), filtré avec `visibles`.
- **Assistant** : une variante `AIDE_APP_V2`, un champ `navigation` dans le corps de la requête
  (`js/chatbot.js:126-129`), le choix dans `index.ts:107`, puis un déploiement de la fonction.

#### 2.1 Pages de l'app

| Fichier:ligne | Texte actuel | Proposition | Deux navigations | Quand |
|---|---|---|---|---|
| `js/views/mon-suivi.js:715` | surtitre « Espace personnel » au-dessus de « Mon suivi » | aucun surtitre (ou le nom de la promo) | interrupteur | avant |
| `js/views/themes.js:1884` | titre « Cours » | « Cours et QCM » | interrupteur | avant |
| `js/views/calendrier.js:269` | « 7 événements au calendrier » | « 7 dates clés » | interrupteur | avant |
| `js/views/calendrier.js:270` | titre « Calendrier » | « Dates clés » | interrupteur | avant |
| `js/views/ressources.js:250` | titre « Ressources & contacts » | « Documents et contacts » | interrupteur | avant |
| `js/views/notes.js:1082` | titre « Notes & évaluations » | formateur : « Notes et examens » ; stagiaire (dans La classe) : pas de second titre | interrupteur et espace | avant |
| `js/views/centre.js:290` | surtitre « Tableau de bord du centre » | « Indicateurs » | interrupteur | avant |
| `js/views/config.js:728` (et 741, 712) | titre « Paramètres » | « Réglages » | interrupteur | avant |
| `js/views/config.js:231` | « … ni ton prénom ni tes notes sur la page Notes » | « … ni ton prénom ni tes notes dans les notes de la classe » | neutre | avant |
| `js/views/home.js:134` | tuile « Tableau de bord » | sous la v2, pas de tuiles (la barre les porte) ; à défaut « Indicateurs » | interrupteur | avant |
| `js/views/home.js:141` | tuile « Calendrier · Examens, stages, dates clés » | idem ; à défaut « Dates clés » | interrupteur | avant |
| `js/views/home.js:142` | tuile « Cours » | idem ; à défaut « Cours et QCM » | interrupteur | avant |
| `js/views/home.js:143` | tuile « Notes · Matrice & synthèse classe » | idem ; à défaut « La classe » (stagiaire), « Notes et examens » (formateur) | interrupteur et espace | avant |
| `js/views/home.js:145` | tuile « Ressources · Contacts & liens utiles » | idem ; à défaut « Documents et contacts » | interrupteur | avant |
| `js/views/home.js:219` | « Ajoute-en depuis l'onglet Calendrier. » (formateur) | « Ajoute-en depuis Planning, Dates clés. » | interrupteur | avant |
| `js/views/home.js:276` | « Sur Notes, Passages, Thèmes et Calendrier. » | « Sur les notes, les passages, les thèmes et les dates clés. » | neutre | avant |
| `js/views/home.js:290` | lien « paramètres » (pied de l'Accueil) | « réglages » | interrupteur | avant |
| `js/views/modules-reglage.js:27` | « Toujours ouverts : Accueil, Mon espace personnel (Passages), Paramètres, Nouveautés. » | « Toujours ouverts : Accueil, Mon suivi (Passages), Réglages, Nouveautés. » | interrupteur | avant |
| `js/ccp2-parcours-data.js:313` | lien « Ton dossier professionnel (Mon espace, sous-onglet Dossier pro) » | « Ton dossier professionnel, à remplir dans l'app » (le lien y mène) | neutre | avant |
| `js/views/home.js:118` | « … planning, passages, notes, calendrier, contacts. » | « … planning, dates clés, passages, notes, contacts. » | neutre | après |
| `js/views/themes.js:1885` | « Les thèmes et les compétences de la formation, avec leurs cours et leurs QCM. » | ajouter « et les documents » | interrupteur | après |
| `js/centre-stats.js:36` | « Même règle que la synthèse de la page Notes. » | « Même règle que la synthèse de la classe, sous la matrice des notes. » | neutre | après |
| `js/centre-stats.js:40` | « (compteur de la page Priorités) » | « (compteur des priorités de passage) » | neutre | après |
| `js/emargement-etat.js:39` | « (tuile d'Accueil, bouton du Planning) » (fondateur) | « (page Émargement, bouton du Planning) » | neutre | après |
| `js/auth-admin.js:402` | « Mon espace personnel » (ancien menu « Mon compte ») | rien | v1 seulement | rien |
| `js/main.js:51-65` | onglets « Calendrier », « Cours », « Notes », « Ressources », « Paramètres » | rien | v1 seulement | rien |

#### 2.2 Catalogue des modules (`js/modules-data.js`)

Les `explication` se lisent dans Réglages > Modules de la promo (formateurs) ; les `annonce` deviennent des
Nouveautés à l'ouverture d'un module (stagiaires).

| Ligne | Texte actuel | Proposition | Deux navigations | Quand |
|---|---|---|---|---|
| 59-60 | annonce Planning : « Le bouton en haut de l'écran t'amène directement à la journée du jour. » | « Le bouton Aujourd'hui t'amène directement à la journée du jour. » | neutre | avant |
| 71 | annonce Calendrier, « Où le trouver » : « Calendrier » | « Planning, Dates clés » | interrupteur | avant |
| 80 | annonce Ressources, « Où le trouver » : « Ressources » | « Cours et QCM, Documents » | interrupteur | avant |
| 85 | explication Priorités : « … : bouton en haut du Planning. » | « …, dans le Planning. » | neutre | avant |
| 88-89 | annonce Priorités : « Un bouton en haut du Planning montre qui doit passer en priorité… » | « Dans le Planning, Priorités montre qui doit passer en priorité… » | neutre | avant |
| 90 | « Où le trouver » : « Planning, bouton Priorités » | « Planning, Priorités » | interrupteur | avant |
| 95 | explication Notes : « Matrice des notes, Évolution dans Mon espace, anonymat. » | « Matrice des notes, courbe d'évolution de chaque stagiaire, anonymat. » | neutre | avant |
| 98-100 | annonce Notes : « … dans l'onglet Notes … Dans ton espace personnel, l'onglet Évolution … dans Paramètres. » | « Tes notes de thèmes s'affichent avec la synthèse de la classe, et une courbe trace ta progression. Si tu préfères, tu peux masquer ton prénom et tes notes aux autres dans tes réglages. » | neutre | avant |
| 101 | « Où le trouver » : « Notes » | « Mon suivi, partie La classe » | interrupteur | avant |
| 139 | explication EPCF : « les siennes dans Mon espace, les moyennes de la classe dans Notes, … » | « les siennes dans son suivi, les moyennes de la classe avec les notes, la saisie des formateurs dans la page Stagiaires. » | neutre | avant |
| 142-143 | annonce EPCF : « … s'affichent dans ton espace personnel. La vue de la classe est dans Notes. » | « Tes évaluations EPCF du CCP1, en salle et en véhicule, s'affichent dans l'app, avec les moyennes de la classe. » | neutre | avant |
| 144 | « Où le trouver » : « Mon espace personnel, partie EPCF » | « Mon suivi, partie EPCF » | interrupteur | avant |
| 150 | explication Livret : « celui du stagiaire dans Mon espace, … » | « celui du stagiaire dans son suivi, … » | neutre | avant |
| 153 | annonce Livret : « … se consulte dans ton espace personnel. » | « … se consulte dans l'app. » | neutre | avant |
| 156 | « Où le trouver » : « Mon espace personnel, partie Livret » | « Mon suivi, partie Livret » | interrupteur | avant |
| 161 | explication Dossier pro : « celui du stagiaire dans Mon espace, … » | « celui du stagiaire dans son suivi, … » | neutre | avant |
| 167 | « Où le trouver » : « Mon espace personnel, partie Dossier pro » | « Mon suivi, partie Dossier pro » | interrupteur | avant |
| 182 | explication Assistant : « Bulle d'aide sur les cours et le Code de la route. » | « Assistant qui répond sur les cours et le Code de la route. » | neutre | avant |
| 185-186 | annonce Assistant : « Une bulle en bas de l'écran répond à tes questions… » | « L'assistant répond à tes questions sur les cours et le Code de la route. » | neutre | avant |
| 65, 75 | noms de modules « Calendrier », « Ressources » | garder (les explications disent « Dates clés » et « Contacts du centre et liens utiles ») ; ou « Calendrier (dates clés) », « Ressources (documents) » | neutre | après |
| 68 | titre « Le calendrier est ouvert » | « Les dates clés sont ouvertes » | neutre | après |
| 78 | titre « Les ressources sont ouvertes » | « Les documents et les contacts sont ouverts » | neutre | après |
| 108 | explication : « Onglet Cours : thèmes, compétences et progression de la classe. » | « Thèmes, compétences et progression de la classe. » | neutre | après |
| 110 | titre « L'onglet Cours est ouvert » | « Les thèmes et les compétences sont ouverts » | neutre | après |
| 113 | « Où le trouver » : « Cours » | « Cours et QCM » | interrupteur | après |
| 121-123 | annonce Lecture des cours : « Dans l'onglet Cours, clique sur le titre d'un thème… » | « Clique sur le titre d'un thème ou sur son bouton Cours. » | neutre | après |
| 124 | « Où le trouver » : « Cours, colonne Cours » | « Cours et QCM, colonne Cours » | interrupteur | après |
| 134 | « Où le trouver » : « Cours, colonne QCM » | « Cours et QCM, colonne QCM » | interrupteur | après |

#### 2.3 Nouveautés (`js/nouveautes-data.js`)

Toutes ces entrées s'affichent (page Nouveautés, et les trois plus récentes sur l'Accueil) : 32 au stagiaire,
48 au formateur au banc [observé].

**a. Libellés « Où le trouver »** (affichés « Où le trouver : … », liens vivants) : tous **interrupteur**.

| Ligne | Nouveauté (date, public) | Libellé actuel | Sous la v2 | Quand |
|---|---|---|---|---|
| 90 | 23/10, tous, moyennes en formation | Notes, Synthèse classe | stagiaire : Mon suivi, partie La classe ; formateur : Notes et examens, Synthèse classe | avant |
| 102 | 23/10, formateurs, tableau de bord | Accueil, tuile Tableau de bord | Indicateurs | avant |
| 149 | 05/10, formateurs, effacement | Paramètres | Réglages | avant |
| 215 | 04/10, tous, confidentialité | Notes | stagiaire : Mon suivi, partie La classe ; formateur : Notes et examens | avant |
| 244 | 03/10, formateurs, page Stagiaires | Accueil, tuile Stagiaires | Stagiaires | avant |
| 260 | 03/10, tous, sommaire iPhone | Le logo en haut à gauche | Mon suivi | avant |
| 275 | 03/10, formateurs, deux promos | Pastille en haut, à côté de ton nom | La promo, en tête de la barre de gauche | avant |
| 322 | 01/10, tous, vidéos CCP2 | Ressources, Examens | Cours et QCM, Documents | avant |
| 332 | 02/10, tous, passage oublié | Planning, bouton Priorités | Planning, Priorités | avant |
| 344 | 30/09, tous, boîte à outils | Ressources | Cours et QCM, Documents | avant |
| 375 | 16/09, tous, DP et formateurs | Mon espace personnel, partie Dossier pro | Mon suivi, partie Dossier pro | avant |
| 390 | 15/09, tous, DP mise en page | Mon espace personnel, partie Dossier pro | Mon suivi, partie Dossier pro | avant |
| 417 | 21/08, tous, anonymat | Paramètres, Mes préférences | Réglages, Mes préférences | avant |
| 565 | 31/07, tous, DP | Mon espace personnel, partie Dossier pro | Mon suivi, partie Dossier pro | avant |
| 581 | 23/07, tous, espace personnel | Le logo en haut à gauche | Mon suivi | avant |
| 611 | 19/07, tous, livret | Mon espace personnel, partie Livret | Mon suivi, partie Livret | avant |
| 73 | 23/10, formateurs, questions IA | Cours | Cours et QCM | après |
| 118 | 23/10, tous, marquage T4 | Cours | Cours et QCM | après |
| 165 | 04/10, tous, compétences | Cours, sous-onglet Compétences | Cours et QCM, sous-onglet Compétences | après |
| 175 | 04/10, formateurs, blocs | Cours, sous-onglet Compétences | Cours et QCM, sous-onglet Compétences | après |
| 295 | 03/10, tous, barre simple | Cours | Cours et QCM | après |
| 403 | 26/08, tous, cours pour tous | Cours | Cours et QCM | après |
| 447 | 19/08, tous, Thèmes sur téléphone | Cours | Cours et QCM | après |
| 469 | 10/08, tous, barre d'entraînement | Cours, colonne QCM | Cours et QCM, colonne QCM | après |
| 481 | 09/08, formateurs, cours en relecture | Cours, colonne Cours | Cours et QCM, colonne Cours | après |
| 501 | 08/08, tous, signalement | Cours, colonne QCM | Cours et QCM, colonne QCM | après |
| 519 | 08/08, formateurs, console | Cours, sous-onglet Signalements | Cours et QCM, sous-onglet Signalements | après |
| 535 | 31/07, tous, QCM | Cours, colonne QCM | Cours et QCM, colonne QCM | après |
| 551 | 31/07, tous, signaler | Cours, colonne QCM | Cours et QCM, colonne QCM | après |

**b. Consignes « Comment faire »** (`guide`) : **interrupteur** (`guideV2`).

| Ligne | Nouveauté | Texte actuel | Sous la v2 | Quand |
|---|---|---|---|---|
| 104 | 23/10, formateurs | « Ouvre l'Accueil, puis la tuile « Tableau de bord ». » | « Ouvre Indicateurs, dans la barre de gauche (groupe Promo). » | avant |
| 151 | 05/10, formateurs | « Paramètres, partie Promo : « Abandon » sur le stagiaire concerné. » | « Réglages, partie Promo : … » | avant |
| 246 | 03/10, formateurs | « Ouvre la tuile Stagiaires de l'Accueil. » | « Ouvre Stagiaires, dans la barre de gauche. » | avant |
| 277 | 03/10, formateurs | « Touche la pastille de la promo en haut de l'écran (« Nîmes · mars 2026 »). » | « Touche la promo en tête de la barre de gauche (sur téléphone, en haut de l'écran). » | avant |
| 279 | 03/10, formateurs | « Dans Paramètres, ajoute les stagiaires de la promo… » | « Dans Réglages, … » | avant |
| 281 | 03/10, formateurs | « … : Paramètres, « Modules de la promo », … » | « … : Réglages, … » | avant |
| 298 | 03/10, tous | « Planning : le bouton Priorités est en haut de la page. » | « Planning : Priorités est un sous-onglet, à côté de Semaine et Dates clés. » | avant |
| 299 | 03/10, tous | « Ton espace personnel (le logo en haut à gauche) : parties Livret et Dossier pro. » | « Mon suivi, dans la barre : parties Livret et Dossier pro. » | avant |
| 568 | 31/07, tous | « Ouvre ton espace personnel avec le logo en haut à gauche. » | « Ouvre Mon suivi, dans la barre. » | avant |
| 583 | 23/07, tous | « Clique sur le logo en haut à gauche pour revenir à ton espace à tout moment. » | « Touche Mon suivi, dans la barre, pour y revenir à tout moment. » | avant |
| 585 | 23/07, tous | « Le bouton « Aujourd'hui au planning » t'emmène directement à la journée en cours. » | « Dans le Planning, le bouton Aujourd'hui t'emmène à la journée en cours. » | avant |
| 613 | 19/07, tous | « Renseigne ta date de naissance dans ton espace personnel… » | « … dans Mon suivi, partie Livret… » | avant |
| 614 | 19/07, tous | « Ouvre l'onglet Notes, sous-onglet « Livret EPCF ». » | « Ouvre Mon suivi, partie Livret. » (déjà faux avec l'ancienne barre : le livret est dans Mon espace depuis le 03/10) | avant |
| 76 | 23/10, formateurs | « Cours, sous-onglet Thèmes : ouvre le QCM d'un thème… » | « Cours et QCM, sous-onglet Thèmes : … » | après |
| 177 | 04/10, formateurs | « Ouvre Cours, puis le sous-onglet Compétences. » | « Ouvre Cours et QCM, puis … » | après |
| 297 | 03/10, tous | « Cours : choisis Thèmes ou Compétences juste sous le titre. » | « Cours et QCM : … » | après |
| 483 | 09/08, formateurs | « Ouvre l'onglet Thèmes : chaque thème a sa colonne Cours… » | « Ouvre Cours et QCM : … » (« onglet Thèmes » est déjà périmé avec l'ancienne barre) | après |
| 521 | 08/08, formateurs | « Ouvre l'onglet Thèmes, puis le sous-onglet Signalements. » | « Ouvre Cours et QCM, puis le sous-onglet Signalements. » | après |
| 537 | 31/07, tous | « Ouvre l'onglet Thèmes. » | « Ouvre Cours et QCM. » | après |

**c. Résumés et titres** (récit daté d'un changement passé).

| Ligne | Nouveauté | Texte actuel | Proposition | Deux navigations | Quand |
|---|---|---|---|---|---|
| 24-26 | 28/10, tous : la plus récente, sur l'Accueil le jour de l'allumage | « … la bulle et la zone où tu écris passent au-dessus de lui… » | « … le bouton de l'assistant et la zone où tu écris passent au-dessus de lui… » | neutre | avant |
| 455 | 15/08, tous | « Le bouton rond en bas à droite ouvre un assistant… » | « L'assistant connaît les 57 cours… » (geste faux sous la v2) | neutre | après |
| 125 | 15/10, formateurs (bandeau actif jusqu'au 30/11) | « … voient en haut de « Mon espace » une invitation… » | « … voient en haut de leur page de suivi une invitation… » | neutre | après |
| 86 | 23/10, tous | « Dans Notes, la synthèse de la classe… » | récit daté ; sinon « Dans les notes de la classe, la synthèse… » | neutre | après |
| 145 | 05/10, formateurs | « … « Effacer les données » dans Paramètres… » | récit daté (la consigne l. 151 suffit) | | après |
| 161 | 04/10, tous | « Dans Cours, sous-onglet Compétences, … » | récit daté | | après |
| 240 | 03/10, formateurs | « La tuile Stagiaires de l'Accueil (ou le bouton de ton compte) ouvre la liste… » | récit daté | | après |
| 255-256 | 03/10, tous | « Ton espace personnel sur téléphone : un sommaire » ; « ton espace s'ouvre sur un sommaire » | récit daté ; ou `navigation: "v1"` | | après |
| 267-268, 273 | 03/10, formateurs | « En haut de l'écran, une pastille indique la promo affichée » ; « … des Paramètres » | récit daté | | après |
| 291-294 | 03/10, tous | « L'onglet Thèmes s'appelle maintenant Cours … en haut du Planning … dans ton espace personnel… » | récit daté ; ou `navigation: "v1"` | | après |
| 398-399 | 26/08, tous | « Dans la page Thèmes, le bouton « Lire le cours »… » | récit daté | | après |
| 442 | 19/08, tous | titre « La page Thèmes, enfin lisible sur ton téléphone » | récit daté | | après |
| 577 | 23/07, tous | titre « L'app s'ouvre sur ton espace personnel » | récit daté ; ou `navigation: "v1"` | | après |

#### 2.4 Consignes de l'assistant (`supabase/functions/chatbot/aide.mjs`)

Toutes **interrupteur** : `AIDE_APP` reste pour l'ancienne barre, `AIDE_APP_V2` pour la nouvelle.

| Ligne | Texte actuel (extrait) | Sous la v2 | Quand |
|---|---|---|---|
| 5 | « navigation par onglets en haut ; le logo ramène à l'espace perso « Mon espace », ou à la page Stagiaires… » | « Stagiaire : barre d'onglets en haut sur ordinateur, en bas sur téléphone (Accueil, Planning, Cours et QCM, Mon suivi, CCP2). Formateur : barre latérale à gauche (Accueil, Planning, Émargement, Stagiaires, Notes et examens, Cours et QCM, CCP2, puis Indicateurs et Réglages) ; sur téléphone, Accueil, Planning, Stagiaires, Notes en bas, le reste dans Plus. Le logo ramène à l'Accueil. » | avant |
| 7 | « mon-suivi (Mon espace personnel) : … Parties Passages, EPCF, Évolution, Livret … et Dossier pro. » | « mon-suivi (Mon suivi, onglet du stagiaire) : … parties Passages, EPCF, Évolution, Livret, Dossier pro et La classe (les notes de la classe). » | avant |
| 8 | « dashboard (Priorités) : … Plus d'onglet : bouton « Priorités » en haut du Planning. » | « Priorités : sous-onglet du Planning. » | avant |
| 9 | « stagiaires … On l'ouvre par la tuile Stagiaires de l'Accueil ; … par le bouton de son compte. » | « … entrée Stagiaires de la barre latérale. » | avant |
| 10 | « planning : … Bouton « Aujourd'hui » dans la barre du haut… » | « planning : sous-onglets Semaine, Dates clés, Priorités ; bouton Aujourd'hui en haut de la Semaine. » | avant |
| 11 | « calendrier : vue mensuelle des événements de la formation… » | « Dates clés (sous-onglet du Planning, ex-Calendrier) : liste des examens, stages et périodes en centre, à venir ou tous. » (« vue mensuelle » est déjà inexact : la page est une liste) | avant |
| 12 | « themes (onglet Cours) : sous-onglets Thèmes … et, dans un troisième sous-onglet, les signalements… » | « themes (Cours et QCM) : sous-onglets Thèmes, Compétences, Signalements (formateurs) et Documents… » | avant |
| 13 | « notes : la classe, pour tout le monde… » | « notes (Notes et examens, formateurs) … ; chez le stagiaire, la même vue est la partie La classe de Mon suivi. » | avant |
| 15 | « centre (Tableau de bord, formateurs) : tuile « Tableau de bord » de l'Accueil. » | « centre (Indicateurs, formateurs) : entrée Indicateurs de la barre latérale, groupe Promo. » | avant |
| 16 | « ressources : cartes de liens officiels (REMC, référentiels, ONISR, PDF hébergés par l'app). » | « Documents (sous-onglet de Cours et QCM, ex-Ressources) : contacts du centre (absences, justificatifs) et liens officiels… » (les contacts manquent aussi dans la version actuelle) | avant |
| 17 | « config (Paramètres) : … » | « config (Réglages) : menu du compte (initiales en haut à droite ; formateurs : aussi la barre latérale)… » | avant |
| 18 | « nouveautes : … (pastille sur l'onglet Accueil quand il y a du nouveau). » | « … depuis l'Accueil et le menu du compte (pastille sur les initiales). » | avant |
| 20 | « BOUTONS GLOBAUX (barre du haut) : logo = espace perso ; calendrier pointé = aujourd'hui au planning ; flèche circulaire = actualiser les données. » | « Logo = Accueil ; Aujourd'hui = bouton en haut de Planning > Semaine ; Actualiser = menu du compte. » | avant |
| 26 | « ASSISTANT (toi) : bouton rond en bas à droite, disponible partout. » | « ASSISTANT (toi) : bouton Assistant en haut à droite (stagiaire), en bas de la barre latérale (formateur), dans Plus sur le téléphone du formateur. » | avant |
| 14 | « … les dates de stage et d'examen CCP2 viennent du calendrier de la promo. » | « … des dates clés de la promo. » | après |

**Total : 82 textes à aligner avant l'allumage** (19 pages de l'app, 19 catalogue des modules, 30 Nouveautés,
14 assistant), et 46 qui peuvent suivre.

### 3. Ce qui change ou se perd pour un habitué de l'ancienne barre

| Habitude | Sous la nouvelle navigation | Page | Effet | Parade |
|---|---|---|---|---|
| « Aujourd'hui » en un geste depuis n'importe quelle page (icône de la barre) | Bouton en haut de Planning > Semaine seulement ; le Planning rouvre sur le dernier sous-onglet, où le bouton n'est pas [observé] | Planning | 2 gestes, 3 si le Planning rouvre sur Dates clés ou Priorités | lot 2 (la journée sur l'Accueil) ; à défaut, ouvrir le Planning sur la Semaine |
| Le Planning s'ouvre sur la semaine | Il rouvre sur Dates clés ou Priorités si on y était [observé] | Planning | on cherche la semaine | même parade |
| « Actualiser » en un geste (bouton de la barre), seul moyen de relire les données dans l'app installée sur iPhone | Ligne du menu du compte [observé] | toutes | 2 gestes | annoncé par la Nouveauté de lancement |
| Onglet Calendrier | Planning > Dates clés, titre encore « Calendrier » [observé] | Planning | 2 gestes | titre (2.1) |
| Onglet Ressources, avec les contacts du centre | Cours et QCM > Documents [observé] ; rien n'y renvoie | Cours et QCM | numéros d'absence difficiles à trouver | T5 |
| Onglet Notes (la classe) | Mon suivi > La classe, en dernière partie ; sur téléphone, dernière ligne du sommaire, puis Matrice / EPCF [observé] | Mon suivi | 2 à 3 gestes ; deux « EPCF » sur la même page à l'ordinateur | S11, Nouveauté de lancement |
| Onglet Paramètres (anonymat des notes, préférences) | Initiales > Réglages, page titrée « Paramètres » [observé] | Réglages | 2 gestes | titre (2.1), Nouveauté |
| Logo = mon espace (annoncé par deux Nouveautés) | Logo = Accueil [code] | toutes | on arrive sur l'Accueil | Mon suivi est un onglet ; textes 2.3 |
| Bulle ronde de l'assistant, en bas à droite | Bouton « Assistant » en haut à droite (stagiaire) ; pied de la barre (formateur) ; dans « Plus » sur téléphone (formateur) [observé] | toutes | formateur sur téléphone : 2 gestes | annoncé par les Nouveautés |
| Pastille des nouveautés sur l'onglet Accueil | Sur les initiales [observé] | toutes | à découvrir | Nouveauté |
| Bouton Priorités en haut du Planning | Sous-onglet Priorités [observé] | Planning | équivalent | |
| Formateur sur téléphone : 8 icônes en un geste (Stagiaires, Tableau de bord, Émargement en tuiles d'Accueil) | Barre du bas : Accueil, Planning, Stagiaires, Notes ; Cours et QCM (signalements), CCP2, Indicateurs, Réglages, Émargement dans « Plus » ; pas de point qui signale des signalements (R20) [observé] | toutes | Cours et QCM, CCP2 et Réglages passent de 1 à 2 gestes ; Stagiaires passe de 2 à 1 | lot 2 (point, Aujourd'hui) |
| Formateur : pastille de promo à côté du nom | En tête de la barre latérale ; en-tête sur téléphone [observé] | toutes | à retrouver | Nouveauté formateurs |
| Formateur : Stagiaires, Tableau de bord, Émargement en tuiles d'Accueil | Entrées de la barre (Tableau de bord renommé Indicateurs) ; les tuiles restent, aux anciens noms [observé] | Accueil | doublons | S4 |
| Formateur avec deux promos | La navigation change selon la promo choisie [observé] | toutes | deux barres à connaître | allumer ensemble les promos d'un même formateur |
| Fondateur (profil stagiaire et formateur) | Mon suivi sans entrée dans la barre de l'équipe (menu du compte) ; ouverture sur Mon suivi sans entrée allumée [observé] | Mon suivi | repère perdu | lot 2 (ouverture sur Aujourd'hui) |

Ce qui ne change pas [observé] : ouverture sur la dernière page quittée, mémoire des sous-onglets, bandeau de
signature d'émargement, anciennes adresses, planning en lecture seule par défaut, « Voir en tant que » du fondateur.

### 4. Pour conclure

**À faire avant d'allumer**

1. Filtrer les Nouveautés par navigation, puis écrire les deux entrées de lancement : corriger « Tes initiales, en
   haut à droite » et « Assistant, en haut de l'écran » pour les formateurs, ajouter où sont les notes de la classe
   (Mon suivi, La classe) et les contacts du centre (T1).
2. Donner à l'assistant ses consignes de la nouvelle navigation, envoyer la navigation avec chaque question,
   déployer la fonction (T2).
3. Aligner les 82 textes « avant » de la section 2 : libellés « Où le trouver » calculés sous la v2, consignes,
   annonces et explications de modules réécrites en neutre, lien du parcours CCP2, titres de pages (T3, T4, T6).
4. Rendre les contacts du centre trouvables : ligne « Contacts du centre » dans le menu du compte, vers Cours et QCM
   > Documents (T5).
5. Accueil sous la v2, en attendant le lot 2 : retirer les tuiles qui doublent la barre ; La classe sans second titre
   ni « Connexion admin requise » (S4, S11).
6. Décider du périmètre : un formateur qui a deux promos change de barre en changeant de promo (T7) ; la spec veut
   zéro régression pour Nîmes, qui finit le 11/12 en plein CCP2, et la section 3 liste les reculs.
7. Rejouer `outils/verifier_navigation.py` et la parité « interrupteur éteint = main » après ces retouches.

**Lot 2**

1. Accueil du stagiaire : la journée (séance, passage au tableau, voiture), « Signer pour ce matin », À faire,
   prochain rendez-vous (corriger le « -2 jours »), Nouveautés, contacts et « Apparence et réglages » en pied ;
   pastille de date et salutation au prénom ; plus de tuiles ; l'app s'ouvre sur l'Accueil.
2. Aujourd'hui du formateur : émargement du matin, au tableau ce matin, en voiture, À traiter, À suivre de près ;
   entrée renommée ; page d'ouverture de l'équipe ; point sur « Plus » et compteur sur Cours et QCM (R20) ;
   repère « Ouverte » sur Émargement.
3. Planning en grille de semaine, bascule Grille / Liste, bande de cinq jours puis le jour choisi sur téléphone,
   repère « Toi » chez le stagiaire, qui est au tableau et combien en voiture chez le formateur ; « Aujourd'hui »
   joignable sans passer par Semaine.
4. Dettes de défilement R10 et R11 (T9) ; case du fondateur après une lecture ratée (T13).
5. À trancher dans le plan : Mon suivi « Résultats » (moi / la classe) ou Évolution + La classe (S10) ; bénévoles
   sous Stagiaires si Aujourd'hui y renvoie (F4).

Vu au passage, hors navigation : le compte à rebours de l'Accueil affiche « -2 jours » pendant un stage en cours
(S5) ; « Lecture seule. Connexion admin requise pour modifier. » s'affiche aux stagiaires (Planning, La classe) ;
deux consignes de Nouveautés étaient déjà fausses avec l'ancienne barre (`nouveautes-data.js:614` et « onglet
Thèmes ») ; l'aide de l'assistant décrit le calendrier comme une « vue mensuelle » et oublie les contacts.
