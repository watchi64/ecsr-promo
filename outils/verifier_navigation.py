#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vérification de la nouvelle navigation au banc d'essai (refonte, lot 1 : la coquille).

Usage
-----
    python outils/verifier_navigation.py [URL_DU_BANC] [options]

    python outils/verifier_navigation.py                              # tout, deux moteurs (environ 3 minutes)
    python outils/verifier_navigation.py --roles stagiaire --sans-menus   # coquille du stagiaire seule (Task 4)
    python outils/verifier_navigation.py --habillages ecsr                # le défaut seul, comme avant le lot 3

Prérequis : le serveur du banc (configuration « maquette-nav », qui sert la racine du worktree) et un
`_harness.html` à jour (`node _harness_build.mjs` après toute modification d'index.html ; un banc
périmé est signalé par un échec « banc périmé »).

URL_DU_BANC : adresse de _harness.html (défaut http://127.0.0.1:8040/_harness.html). Une adresse en
`localhost` est réécrite en `127.0.0.1` quand elle répond : sur ce poste, `localhost` coûte ~0,2 s par
requête (essai de ::1 avant IPv4) et fait passer le démarrage de l'app de 0,3 s à 6 s ; `--garder-hote`
l'évite.

Sortie : les échecs groupés par type, les avertissements (sans échec), puis, en dernière
ligne, « N vues, M échec(s) ». Code de sortie 1 s'il y a un échec, 2 si le banc ne répond pas.

Ce que le script joue
---------------------
Pour chaque moteur (Chromium, puis WebKit, par `executable_path` quand celui que Playwright attend
manque) :
  * Passe « allumé », rôles stagiaire, prof et fondateur, largeurs 1280, 1100, 900 et 375 px. Le
    fondateur et le stagiaire du banc (fondateur lui aussi) passent par l'aperçu de l'appareil
    (localStorage `ecsr_nav_v2` = "1", posé avant le chargement). Le formateur prof, qui n'est pas
    fondateur et n'a donc aucun aperçu, passe par le réglage de la promo (ligne `navigation_v2` de
    `settings`, semée dans le faux Supabase par une interception de `_harness_supabase.js` : le
    fichier du banc n'est jamais modifié). S'y ajoutent un stagiaire qui n'est pas fondateur (réglage
    de la promo, `is_founder` retiré : le cas de la plupart des vrais comptes), le stagiaire et le prof
    avec `?modules=depart` (modules fermés : pas de case vide, repères), et le « Voir en tant que » du
    fondateur, à 1280, 900 et 375 px (Stagiaire, Formateur, Stagiaire, puis son rôle réel : la
    coquille change d'espace sans recharger la page, et l'entrée allumée suit la page affichée ; sur
    téléphone, il passe aussi par « Plus », « Mon compte », « Stagiaire », puis ouvre le tiroir et
    élargit l'écran à 900 px : le tiroir se ferme et le focus ne tombe jamais sur body ; à chaque rôle
    vu, le bandeau d'aperçu est en bas de l'écran et l'assistant, ouvert depuis la coquille, garde son
    champ et « Envoyer » à portée : rien ne couvre leur centre). S'y ajoute, une fois par moteur,
    l'ouverture d'un formateur dont l'appareil a vu la promo allumée (mémoire `ecsr_nav_v2_promo:1`,
    ruling R17), lectures des réglages ralenties : l'ancienne barre ne se peint à aucune image avant
    la coquille (échantillon à chaque image) et l'attente (`body[data-nav-attente]`) est levée. Et, le module Ressources
    fermé pour la promo (lot 2A, tâche 1), un stagiaire sans drapeau de fondateur puis un formateur : la ligne « Contacts du centre » du menu du compte.
  * Passe « éteint » : aucun aperçu, rien ne doit changer par rapport à main (aucune coquille,
    l'ancienne barre d'onglets, pas de sous-onglets regroupés, aucun défilement ni débordement de côté),
    sauf quatre défauts de main corrigés depuis : la barre des
    jours du planning se colle juste sous l'ancienne barre, quelle que soit sa hauteur, et, bandeaux du
    bas affichés (« Voir en tant que », promos non chargées), la bulle de l'assistant et le champ de son
    panneau restent à portée, sa croix se lit et ses boutons font 44 px sur téléphone ; la carte
    « Prochain événement majeur » de l'accueil, où un stage commencé n'est plus un nombre de jours négatif
    (lot 2A, tâche 4) mais « En cours » (vague finale, F9) ; et le graphe d'évolution de la fiche d'un stagiaire, dessiné à
    la largeur de son conteneur (vague finale, F1). Y sont gardés, avec leurs textes d'avant : l'accueil (logo à côté de la date,
    phrase sur le suivi de la promo, tuiles, pied de page « Promo 2026 » et « admin »), le Planning (« Cette semaine », « Lecture seule... »), la
    page Notes du stagiaire, les comptes en surtitre, les horaires du bandeau d'émargement sur téléphone, les Nouveautés d'avant (leurs « Où le trouver » et leurs « Comment faire »,
    sans les deux de lancement, mais avec la Nouveauté pour tous « Des pages mieux tenues sur le téléphone »). S'y ajoute un stagiaire sans drapeau de fondateur dont l'appareil porte l'aperçu d'un fondateur (lot 2A, tâche 1) : l'aperçu n'est pas pour lui.
Habillages (lot 3, tâche 10 ; option `--habillages`, défaut `ecsr,ecf`) : la passe allumée, tous ses scénarios, est jouée dans
chaque habillage demandé : « ecsr » (ECSR Promo, le défaut) sur un appareil vierge, « ecf » (Couleurs ECF) par le levier de
tout robot, `localStorage.ecsr_habillage = {"nom": "ecf"}` posé avant le premier chargement (l'app pose `data-skin` elle-même).
La passe éteinte est jouée dans le défaut. Avec « ecf » s'y ajoutent : la passe éteinte d'un appareil en ECF, chaque rôle à
1280 et 375 px (Review Focus 4, décision H6 : l'habillage s'applique dans les deux navigations ; le retour à ECSR Promo depuis
l'ancienne barre arrive à la Task 11), et, une fois par moteur, l'appareil d'une autre personne (Review Focus 1) : l'appareil
retient `{"nom": "ecf", "email": "autre@example.test"}` ; la page porte « ecf » avant la lecture du profil (avant-peinture),
puis « ecsr » une fois le démarrage fini, sans rechargement, n'y revient jamais, n'envoie pas ce choix au compte (aucun
`set_my_habillage("ecf")`), l'appareil le retient comme habillage appliqué non choisi, sans l'e-mail de l'autre ; rechargée, la
page s'ouvre directement dans le défaut. La pastille « ECSR Promo » pressée du menu du compte, qui n'existe pas encore, est
vérifiée par la Task 11.
Sur téléphone, le contexte de l'équipe joue en plus l'en-tête à 320 px (LARGEUR_ETROITE) : la fenêtre se resserre le temps de la vérification de l'Assistant.
À 1 100 px, le contexte de l'équipe joue en plus la fiche d'un stagiaire (partie Évolution) à 768 px (LARGEUR_TABLETTE, vague finale, F1), dans les deux passes : la fenêtre se resserre sur place.
Dans chaque contexte : l'arrivée à froid, chaque entrée de la coquille (cliquée dans la coquille, ou
via « Plus » sur téléphone quand elle y est rangée ; la liste vient des règles de js/nav-rules.js,
lues dans la page), chaque sous-onglet des pages qui en ont (Planning, Cours, Mon espace, Notes...), les
pages du menu du compte sans entrée à elles (Mon espace, Mes préférences, Nouveautés), le bouton
« Aujourd'hui » de Planning > Semaine (ruling R29), les quatre anciennes adresses (ruling R26,
ci-dessous), puis les menus (compte, « Plus », contexte, assistant) et « Précédent » sous une fenêtre
ouverte.

Contrôles par vue
-----------------
  * rien ne défile de côté ni ne déborde de la fenêtre, dans les deux passes, hors `.matrice-wrap`
    (exception admise, sans avertissement). Tout le reste échoue, interrupteur éteint compris (une règle
    du lot qui déborde de `body[data-nav="v2"]` y fait échouer la page), lecteur de cours compris (lot 2B,
    tâche 1 : le sommaire passe à la ligne et les tableaux deviennent des listes sur téléphone, plus aucune dette
    du ruling R52). Les conteneurs des rulings R10 et R11 qui défilaient déjà sur main (graphe de
    Notes, tableaux du centre et des passages, lien Légifrance de Cours > Signalements, graphe de Mon évolution,
    moyennes EPCF de la classe) ont été corrigés au lot 2A, tâche 5, et n'ont aucune exception ;
  * notes en rouge (lot 2A, tâche 5) : le remplissage d'une forme d'un graphe de notes (barres des graphes de Notes, points de
    Mon évolution) n'est jamais rouge (teinte de 345° à 15°, saturation au-dessus de 50 %), mesuré sur la couleur affichée. Les
    trois graphes de Notes sont les onglets d'une même section (Par stagiaire, Par thème, Distribution) : la page n'en montre
    qu'un, les autres sont ouverts un à un et mesurés comme toute vue (défilement de côté compris), puis le premier est rouvert.
    Le banc sert pour cela des notes (NOTES_DU_BANC) qui dessinent chaque teinte de l'échelle des notes. Joué dans les deux
    habillages (lot 3, tâche 10) ;
  * libellés de Mon évolution (lot 2A, tâche 5, tour de correction 1) : deux libellés d'axe (`.ms-axis-label`, les mois comme
    les graduations) d'un même graphe ne se recouvrent pas ni ne se touchent (2 px d'écart au moins), boîtes mesurées. À 375 px,
    le stagiaire du banc a vingt notes réparties sur sept mois : des bandes de 30 à 38 unités pour des libellés de 10 px qui en
    mesurent jusqu'à 37. De même, les cibles de tap (`.ms-pt-hit`) de deux points voisins ne se chevauchent pas : le rayon de 12
    unités se réduit à la moitié de l'écart entre deux points quand le graphe est serré ;
  * graphe d'évolution lisible (vague finale, F1) : dans toute vue qui montre un graphe de Mon évolution, chaque libellé d'axe (les mois comme les graduations) rend 8 px
    au moins, mesuré par l'échelle réelle du dessin (getScreenCTM) : dessiné pour la fenêtre moins 80 px, le graphe de la fiche d'un stagiaire, dans la page Stagiaires
    (liste de 270 px, plus la barre latérale de 264 px de la nouvelle navigation), était réduit par `width: 100 %` à l'échelle de 0,51 à 0,65, et ses libellés de 10 unités
    ne rendaient que 5 à 6 px. La fiche d'un stagiaire (partie Évolution, vue par l'équipe) est jouée à 1 100 px puis à 768 px, dans les deux navigations : la fenêtre est
    resserrée sur place (le graphe se redessine à la largeur de son conteneur, par un ResizeObserver), puis la page est rouverte à cette largeur ; à chaque étape, le graphe
    est là et dessiné à la largeur de son conteneur (échelle de 0,99 au moins). La page Mon suivi du stagiaire reste jugée par les contrôles de chaque vue, à 375 px ;
  * tableaux en listes (lot 2A, tâche 5, spec § 4.1) : un tableau marqué `tableau-liste` (les tableaux du centre et des passages) reste un
    tableau à partir de 1 080 px et devient une liste en dessous, chaque valeur portant le titre de sa colonne devant elle (le titre de la
    carte et la cellule des boutons n'en ont pas). Les sections repliées du tableau de bord du centre (« Tous les thèmes », les méthodes)
    sont ouvertes le temps d'une mesure ;
  * nouvelle navigation allumée : Planning, Cours et Mon espace (de qui a un profil stagiaire) montrent au
    moins 3, 3 et 6 sous-onglets (lignes du sommaire sur téléphone), 2, 0 et 0 pour un stagiaire au départ
    (`?modules=depart`) : une barre de sous-onglets perdue échoue ;
  * une seule entrée allumée dans la coquille visible, celle que donne `entreeActive` : le lien vers elle,
    ou « Plus » quand elle est rangée dans le tiroir du téléphone ;
  * zones à toucher : 44 px au moins sous 700 px (24 px au-delà) pour la coquille, les menus, les barres
    de sous-onglets et les cases des Paramètres ;
  * habillage (lot 3, tâche 10) : `html[data-skin]` vaut l'habillage du scénario ;
  * contraste du texte de toute la page (lot 3, tâche 10 ; la coquille et ses menus seuls avant), dans les deux habillages et les
    deux passes : la coquille, l'ancienne barre, `#view` défilée entière, les fenêtres et panneaux posés sur `body`, couleur et
    fond réels (fonds unis des ancêtres, transparences et opacités composées) : 4,5:1, 3:1 pour le grand texte. Un texte SVG est
    mesuré sur son remplissage (`fill`, `fill-opacity` ; son `color` ne se peint pas), contre la forme pleine peinte sous lui et
    à sa taille rendue. Hors mesure : le bandeau du banc, les dessins des cours (panneaux, véhicules, marquage, scènes : le texte
    d'un panneau fait partie de l'image), le texte des documents officiels reproduits à l'identique (livret EPCF TP-01303,
    dossier professionnel : les gris de leur modèle), hors les annotations d'écran que l'app y pose (coupure de feuille, fiche
    exclue), un texte rogné à rien (réservé aux lecteurs d'écran, panneau replié). Un repère (pastille, point) cerné d'un liseré
    plein qui tient 3:1 contre lui et contre le fond se détache, même si lui-même ne tient pas contre ce fond (WCAG 1.4.11 : sa
    couleur voisine est celle du liseré ; le liseré blanc des repères rouges de « Couleurs ECF » sur l'entrée allumée) ;
  * repères non textuels de la coquille (lot 3, tâche 10) : le trait de l'entrée allumée, les pastilles et les points, l'icône de
    l'entrée allumée et celle d'une entrée sans libellé visible tiennent 3:1 contre le fond réel sous eux, mesuré à leur position
    (ce qui est peint sous leur centre, eux exceptés : le trait est posé 10 px hors de son entrée, sur la barre et non sur l'entrée
    allumée) ;
  * teinte restée (lot 3, tâche 10), en « Couleurs ECF » : aucune couleur calculée (texte, fond, bord, remplissage, trait,
    pseudo-éléments compris) de teinte chaude ou verte (de 20° à 160°, saturation au-dessus de 15 %), sauf la valeur d'un jeton
    d'une famille fixe (noms lus dans la règle `:root` des feuilles de la page, familles de js/habillage-familles.js, valeurs
    calculées ; celle d'un jeton `--doc-*` dans un document seulement : plusieurs reprennent une valeur de l'habillage par défaut),
    une teinte de l'échelle continue des notes (js/echelle-notes.js) ou d'une rubrique EPCF (js/epcf-trames.js), ou
    ce qui est hors de l'app habillée : le bandeau du banc, les dessins des cours, le livret EPCF (`.lv-*`), le dossier
    professionnel (`.dp-doc`), les canevas ;
  * poids des titres (lot 3, tâche 10, changement en direct, Review Focus 3), en « ECSR Promo » : chaque texte visible en Canela est
    relevé avec son poids, `data-skin` passe à « ecf » dans la même page (transitions gelées) : le même élément porte le poids ECF
    correspondant (700 et 500 deviennent 600, 600 le reste, 400 devient 500, 300 devient 400) et n'est plus en Canela ; puis
    retour à « ecsr ». Les documents imprimés (feuille d'émargement, dossier Qualiopi, attestations, livret, dossier
    professionnel) gardent leur police et leur poids (décision H5) ;
  * barre du bas (téléphone) : 5 entrées au plus, toutes nommées, libellés sur une ligne ;
  * la coquille et le contenu ne se recouvrent pas, tout ce qui est fixe reste dans la fenêtre, l'ancienne
    barre d'onglets est masquée ;
  * menus et tiroirs : entièrement dans l'écran, fermés par Échap (le retour du focus sur le bouton qui les
    a ouverts n'est qu'un avertissement) ;
  * fenêtre ouverte (menu du compte, tiroir « Plus ») : fermée quand « Précédent » change l'adresse, le
    focus restant dans la coquille ; sur téléphone, fermée aussi par son « Fermer » ;
  * Planning > Semaine (ruling R29, puis audit du 09/11, lot B) : allumé, aucun bouton de retour sur la semaine du jour ; sur une autre,
    un bouton nommé « Revenir à aujourd'hui », de 44 px, qui affiche la semaine du jour et amène sa carte en haut de l'écran ;
    éteint, la page n'en a pas (celui de la barre du haut reste) ;
  * l'attente de la coquille (`body[data-nav-attente]`, ruling R17) n'est plus posée, dans les deux passes ;
  * Réglages et Mes préférences (lot 2A, allumé) : chez l'équipe, `#/config` s'appelle « Réglages », son surtitre est la promo
    affichée, il commence par « Ce que voient les stagiaires » et ne garde que la promo dans l'ordre : Ce que voient les stagiaires,
    Promo, Accès et invitations, Émargement et Nouvelle navigation (fondateur seulement), Données personnelles ; chez le stagiaire,
    `#/config` mène à `#/preferences`. `#/preferences`, pour tous, s'appelle « Mes préférences » et ne montre aucune section de la
    promo (seulement sa section de la personne et « Informations »). Aucune de ces pages ne dit « whitelist », « mdp » ni « admin ». Vague finale, F6 : « Mes préférences »
    n'y figure qu'une fois (le titre de la page ; la section de l'anonymat s'appelle « Dans les notes de la classe »), « Réglages personnels » n'y est plus écrit
    (« Réglages » est la page de l'équipe), et le réglage de l'anonymat n'est montré qu'à qui a une fiche de stagiaire (jamais à l'équipe sans fiche), le sous-titre le disant.
    Éteint, `#/preferences` mène à Paramètres (`#/config`) ;
  * bouton du compte (lot 2A) : aucun chiffre ; un point sans texte tant que des Nouveautés ne sont pas lues (joué à l'ouverture,
    où le banc en a, puis la rubrique ouverte : tout est lu, plus de point), dont le nom du bouton dit le nombre, et qui tient 3:1 contre
    son liseré et contre le fond derrière lui (tâche 6 : sur la barre sombre de l'équipe, son vert d'origine n'en tenait que 2,9) ; menu
    du compte : une ligne « Mes préférences » (`#/preferences`), plus de ligne « Réglages », le nombre sur la ligne « Nouveautés », joué
    une fois à l'ouverture, avant la rubrique Nouveautés, seul moment où le banc a des non lues (tâche 6 ; il n'était joué qu'après, donc
    sans nombre à contrôler), puis avec `verifier_menus` ;
  * à traiter (lot 2A, tâche 6) : l'équipe voit sur « Cours et QCM » la pastille chiffrée de ce qui l'attend (le banc sert 5 signalements ouverts ; les scénarios « à traiter »
    y sèment des brouillons de l'IA, qui ne comptent pas avant le sous-onglet « Propositions IA » du lot 2B, ruling R56 : « 5 » et non « 7 », et six signalements
    de plus pour « 9+ ») dans la barre latérale dès 700 px (une seule, dans son entrée, sans recouvrir l'œil d'un module
    fermé, en ligne comme en colonne d'icônes), dans le tiroir « Plus » sur téléphone, avec le point de « Plus » (nom « Plus, N à traiter ») et la phrase « N à
    traiter : 5 signalements » en tête du tiroir ouvert ; chaque repère tient 3:1 contre ce qui l'entoure et son chiffre 4,5:1 contre son
    fond ; sur la barre sombre, toute pastille (celle de « Signaler un problème », dont les scénarios avec brouillons sèment les compteurs, comme celle de « Cours et QCM »)
    tient 3:1 contre la barre et son chiffre 4,5:1. Les brouillons de l'IA et les signalements déjà traités ne comptent pas. Le point de « Plus » (vague finale, F10) s'allume aussi
    quand la pastille de « Signaler un problème », que le tiroir contient, est affichée : le scénario « signaler » fait échouer les lectures « à traiter » mais sème des
    signalements qui ont avancé, et le point, au téléphone, porte alors le nom « Plus, 2 signalements ont avancé » (ni pastille sur « Cours et QCM », ni phrase de tiroir). Lectures en échec (« panne » : le levier `__HARNESS_FAIL` du banc posé le temps des lectures des deux
    tables seulement) ou qui n'aboutissent pas (« lent », 20 s) : la barre se pose quand même, sans pastille, sans point, sans phrase, sans message ni boîte d'erreur ni
    erreur de console, et le menu du compte s'ouvre. Chez le stagiaire (« Voir en tant que » compris) et interrupteur éteint, aucun de ces repères ;
  * case du fondateur (lot 2A, tâche 6, ruling R54) : la lecture du réglage de la promo échoue ; la case « Nouvelle navigation activée » de Réglages ne dit que le réglage de la
    promo (la mémoire de l'appareil pour cette promo, ruling R17), jamais l'aperçu de l'appareil : cochée seulement quand la mémoire dit « allumée ». Les six combinaisons du
    fondateur (aperçu aucun, allumé ou éteint, croisé avec la mémoire de la promo présente ou absente), la barre appliquée comprise : elle suit l'aperçu, la case non ;
  * titres des pages (lot 2A, allumé) : le titre (h2) de chaque page du menu est le libellé de son entrée (équipe : Émargement, Stagiaires, Notes et
    examens, Cours et QCM, Indicateurs, Réglages, CCP2 ; stagiaire : Cours et QCM, Mon suivi, CCP2) et, sauf pour CCP2, son surtitre est le nom de la
    promo affichée. L'Accueil du stagiaire et Planning n'en font pas partie (TITRES_DES_PAGES) : l'accueil du stagiaire salue par son prénom, le Planning garde
    le titre de sa semaine ; la page de l'équipe s'appelle Aujourd'hui (lot 2B, tâche 4, titre de la page, h1) ; Émargement, lui, s'appelle « Émargement » (ruling R50). Les sous-pages reprennent le nom de leur sous-onglet : Planning > Dates clés (ex-Calendrier), Cours et
    QCM > Documents (ex-Ressources & contacts, dont la section des contacts s'appelle « Contacts du centre »), chacune avec la promo en surtitre ;
    Cours et QCM d'un stagiaire au départ, réduit à ses Documents, porte ce titre. Éteint, les titres de main restent : Notes & évaluations, Cours,
    Calendrier, Ressources & contacts, Mon espace, les surtitres « Formateurs », « Tableau de bord du centre » et « Espace personnel » ;
  * Stagiaires et ses bénévoles (lot 2A, équipe) : la page a deux sous-onglets, « Stagiaires » puis « Élèves bénévoles ». Le second montre le panneau
    de la banque dans la page (aucune fenêtre, aucun « Fermer », titre de page « Stagiaires », adresse `#/stagiaires`) ; « + Ajouter » y ouvre la
    fiche d'un nouveau bénévole, dans la page elle aussi, sans débordement de côté ; sur téléphone, les zones à toucher du panneau font 44 px. Le bouton
    « Élèves bénévoles » (« Bénévoles » sur téléphone) de Planning > Semaine mène à ce sous-onglet. Éteint, il ouvre la fenêtre de main, avec son
    « Fermer », sans quitter le Planning, et la page Stagiaires n'a pas de sous-onglets de page ;
  * formulaire des bénévoles (vague finale, F11) : dans la page, « Modifier » ramène le formulaire en haut de l'écran, sous l'en-tête collant du téléphone, et non là où la liste était défilée
    (trente bénévoles semés dans le faux Supabase de la page le temps du contrôle, la dernière ligne cliquée : WebKit garde la page défilée tout en bas, le titre du formulaire est alors
    au-dessus de l'écran ; Chromium la remet en haut et ne montre pas le défaut) ;
  * en-tête de l'équipe sur téléphone (lot 2A) : un seul bouton « Assistant » (data-nav-action=assistant, de 44 px) dans l'en-tête, entre la promo et
    le compte, rien ne débordant de la fenêtre, à 375 px puis à 320 px (la page Stagiaires y est mesurée comme toute vue, sans autre scénario) ; le
    tiroir « Plus » s'appelle « Autres pages », sans « Tout l'espace formateur », et garde sa ligne « Assistant » ;
  * Notes et examens (équipe, lot 2A, puis lot C de l'audit du 09/11) : sur un écran tactile (le téléphone du banc), le sous-titre est
    « Saisis les notes thème par thème, ou touche une case de la matrice. » et la phrase sur Entrée et Échap n'est pas montrée ; avec une
    souris, le sous-titre d'avant et la phrase de la barre d'outils ;
  * comptes en fin de sous-titre (lot 2A, tâche 4, ruling R49) : Notes et examens finit par « N notes enregistrées. », Planning > Dates clés par
    « N dates clés. » (le nombre d'événements que l'app lit, passés compris), Cours et QCM > Documents par « N liens · M contacts. » ; éteint, ils
    restent en surtitre (« N événements au calendrier », « N liens curés · M contacts », « N notes enregistrées ») ;
  * texte d'administration (lot 2A, tâche 4) : aucune page d'un stagiaire, quelle que soit la vue mesurée (entrées, sous-onglets, parties de Mon suivi),
    ni son bandeau d'émargement, ne dit « admin ». L'abréviation seule, comme dans Réglages et Mes préférences : « administrateur » et « administration »
    restent permis ;
  * Accueil (lot 2A, tâche 4, deux espaces) : le logo n'y est qu'une fois (celui de la coquille), la phrase sur le suivi de la promo est remplacée par
    « Promo <nom> · semaine <n> » (la semaine, recalculée par le script depuis la date de début de la promo), aucune tuile ne double la barre ;
  * carte « Prochain événement majeur » (les deux navigations, correction pour tous) : recalculée par le script depuis l'agenda tel que l'app le lit
    (le premier examen ou stage qui n'est pas passé) : jamais de nombre négatif ; un stage commencé dit « En cours, fin dans N jours » (« fin demain »,
    « fin aujourd'hui ») et sa pastille dit « En cours », sans nombre ni habillage de compte à rebours (vague finale, F9 : jamais « Aujourd'hui ! » pour un stage qui finit
    aujourd'hui) ; un événement à venir garde sa pastille d'avant (« 9 jours », « Aujourd'hui ! » le jour où il commence), sans ligne « en cours » ;
  * pied de l'Accueil (vague finale, F7, puis audit du 09/11, A8) : avec la nouvelle navigation, « TP ECSR App · Promo <nom de la promo affichée> · connecté en tant que
    <rôle> », le vrai rôle (aperçu, fondateur, rôle sur la promo ; jamais « admin ») ; avec l'ancienne, le texte de main (« Promo 2026 » écrit en dur, « admin ») ;
  * Planning > Semaine, sur la semaine du jour : ni « Lecture seule... », ni « Consultation », ni boutons « Cette semaine », « Aujourd'hui »,
    « Revenir à aujourd'hui » ou « Émargement », pour le stagiaire comme pour l'équipe (audit du 09/11, lots E et B) ; hors édition, pas de
    raccourci vers la banque des bénévoles, qui revient en mode Modifier ;
  * Mon suivi aux libellés clairs (lot 2B, tâche 7), pour toute personne qui a une fiche, à 1 280 et 375 px : les parties dans l'ordre (Résultats, Passages, EPCF,
    Livret EPCF, Dossier pro), en sous-onglets sur ordinateur, en sommaire sur téléphone dont chaque ligne dit son état en entier (« EPCF : 0 épreuve sur 2 », « Dossier pro :
    0 exemple sur 6 »), sans date « 02/10 », jamais coupée, la dernière au-dessus de la barre du bas (à l'ouverture, et page défilée au bout) ; Résultats et son
    groupe « Moi / La classe » (boutons de 44 px, « Moi » par défaut, le choix gardé sur l'appareil, même après un rechargement) ; #/mon-suivi/classe,
    #/mon-suivi/evolution et #/notes (stagiaire) ouvrent Résultats sur la bonne vue, l'adresse devenue #/mon-suivi/resultats, sans étape d'historique ; sur
    téléphone, le retour « ‹ Mon suivi » remplace l'en-tête de la page ; un exemple du dossier enregistré fait passer la ligne à « 1 exemple sur 6 » sans
    recharger. La fiche d'un stagiaire chez l'équipe garde ses parties de main (Passages, EPCF, Évolution, Livret, Dossier pro), allumé et éteint ; Mon espace
    éteint aussi ; module des notes fermé (`?modules=depart`), ni Résultats ni « Moi / La classe » ;
  * Mon suivi > La classe, pour toute personne qui a une fiche (le contexte décide, pas le rôle : le stagiaire, et le fondateur dans l'espace de l'équipe) : ni
    second titre, ni seconde rangée Matrice / EPCF (aucun libellé « EPCF » isolé), ni « Lecture seule... » ; le stagiaire, qui ne saisit rien, ne lit pas non plus
    la phrase sur la saisie et n'a que le nombre de notes. Sous la vue de la classe, la section « Moyennes EPCF de la classe » (ruling R51) : le rendu de l'onglet
    EPCF de la page de l'équipe, avec son k-anonymat (le banc sert des moyennes sur 3 et 2 stagiaires, et un critère sur un seul, jamais montré). Notes et examens,
    page de l'équipe : ses deux sous-onglets Matrice et EPCF, et le titre « Moyennes de la classe » du second ;
  * accueil, agenda vide (lot 2A, tour de correction 1) : un scénario à part par moteur et par passe, la date du banc reculée après le dernier événement
    (DATE_AGENDA_VIDE), formateur : avec l'ancienne navigation, la liste dit où ajouter des événements (« l'onglet Calendrier ») et la carte du prochain événement
    majeur n'y est pas ; avec la nouvelle, Aujourd'hui n'en montre aucun ;
  * Aujourd'hui du formateur (lot 2B, tâche 4) : le titre « Aujourd'hui » (h1, sous la pastille de date) et la ligne « Promo ... · N stagiaires en formation » ; les cinq cartes
    dans l'ordre du téléphone, puis trois sur une ligne et deux sur la suivante dès 1080 px ; l'émargement (« N sur M », jauge, « Voir la feuille », « Pas encore ouverte »,
    bouton « Signer » du seul fondateur qui a une fiche de stagiaire, carte absente promo éteinte) ; au tableau et en voiture selon le planning ; à traiter selon les comptes
    du banc ; à suivre de près ; ni Nouveauté ni bandeau d'émargement sur la page ; cas limites (samedi, sans feuille, lectures en échec, départ pendant le chargement, 320 px) ;
    le fondateur qui voit l'app en stagiaire arrive sur l'Accueil du stagiaire ;
  * bandeau d'émargement (stagiaire et équipe) : sur téléphone, une seule ligne (« Émargement du matin ouvert » et son bouton), ses horaires (stagiaire) ou
    ses signatures (équipe) cachés, son bouton de 44 px, sa hauteur au plus celle des deux lignes de main (61 px) ; au-delà de 700 px, et interrupteur
    éteint, ses détails sont montrés ;
  * les quatre anciennes adresses (`#/calendrier`, `#/dashboard`, `#/ressources`, `#/notes`, ruling R26) : allumé, la nouvelle
    page et son sous-onglet allumé (Planning : Dates clés, Priorités ; Cours : Documents ; Mon suivi : Résultats, vue La classe, chez
    le stagiaire, mais Notes reste la page de l'équipe ; module fermé au départ : le premier sous-onglet visible),
    et « Précédent » quitte la page redirigée ; éteint, l'adresse et la page restent celles d'aujourd'hui ;
  * Nouveautés et « Où le trouver » (lot 2A, tâche 1) : allumé, la rubrique (#/nouveautes) montre « Une navigation plus simple » à tous et « Côté formateurs, la barre passe à
    gauche » à l'équipe seule (le fondateur en aperçu, sur une promo éteinte, voit les deux ; un stagiaire sans drapeau de fondateur d'une promo allumée, la première seulement),
    et aucune des trois Nouveautés qui ne décrivent que l'ancienne barre. Le lien « Où le trouver » de dix Nouveautés d'avant (cinq de plus pour l'équipe) porte le nom de la
    nouvelle barre (Mon suivi, La classe ; Planning, Priorités ; Cours et QCM, Documents ; Mes préférences chez le stagiaire, Réglages chez l'équipe, jamais l'inverse), son
    adresse restant celle de main ; leur « Comment faire » est celui de la nouvelle barre ; le lien de la Nouveauté de l'équipe ouvre Stagiaires, sous-onglet « Élèves bénévoles ».
    L'accueil ouvre sa section de Nouveautés par celles du lancement. Vague finale : les trois entrées du jour de la mise en ligne portent la date du 29/10/2026 ; « Une navigation plus simple »
    dit que certaines parties s'ouvrent au fil de la formation (F5) et place le bouton « Aujourd'hui » en tête de Planning, Semaine (F4) ; la consigne de « Signaler un problème » est juste
    dans les deux espaces (ses initiales en haut à droite pour le stagiaire, le pied de la barre de gauche ou « Plus » pour l'équipe, F4) ; l'anonymat des notes mène à Mes préférences
    pour les deux espaces, jamais à Réglages (R55, adresse #/preferences) ; « La promo, en tête de la barre » (juste sur téléphone aussi) ; les deux Nouveautés des bénévoles mènent à
    Stagiaires, sous-onglet « Élèves bénévoles » (F8) ; la Nouveauté « Des pages mieux tenues sur le téléphone » est pour tous, dans les deux navigations, sans nommer les « Indicateurs »
    ni le « tableau de bord » (F3). Éteint, aucune des deux (même chez l'équipe, même chez un stagiaire sans drapeau de fondateur dont l'appareil
    porte l'aperçu d'un fondateur : l'aperçu n'est pas pour lui), les trois de l'ancienne barre sont là, et chaque lien et chaque première étape est celui de main ;
  * ligne « Contacts du centre » du menu du compte (lot 2A, tâche 1) : entre « Nouveautés » et « Mes préférences », vers #/ressources ; cliquée, elle ouvre Cours et QCM, Documents, avec sa
    section « Contacts du centre ». Quand le module Ressources est fermé pour la promo (scénario « ressources fermées »), la ligne disparaît chez un stagiaire (elle ne mènerait nulle
    part) et reste chez l'équipe, qui voit tout ;
  * mots de l'ancienne barre (lot 2A, tâche 1) : allumé, aucune vue (page, coquille, menus et tiroirs ouverts) ne dit « Mon espace » ni « Paramètres » ; éteint, aucune page ni l'ancienne barre
    ne dit « Mon suivi ». Seuls le titre et le récit des cartes de Nouveautés n'en font pas partie : un récit daté d'un changement passé n'est jamais réécrit (le « Où le trouver » et
    le « Comment faire » de ces mêmes cartes comptent). Éteint, la règle du Planning sur la « fiche « Mon suivi » » du stagiaire est un texte de main, admis ;
  * accueil, Réglages, Mes préférences et CCP2, dans les deux navigations (lot 2A, tâche 1) : la dernière ligne de « À retenir » (Ctrl + Z : « Sur les notes, les passages, les thèmes et
    les dates clés » allumé, « Sur Notes, Passages, Thèmes et Calendrier » éteint) ; le lien de réglage du pied (« mes préférences » chez le stagiaire, « réglages » chez l'équipe,
    « paramètres » éteint) ; la phrase des modules toujours ouverts de Réglages (« Mon suivi (Passages), Mes préférences » allumé, « Mon espace personnel (Passages), Paramètres »
    éteint) ; le texte de l'anonymat des notes (« dans les notes de la classe », jamais « sur la page Notes ») ; le lien du parcours CCP2 vers le dossier professionnel (« Ton dossier
    professionnel, à remplir dans l'app ») ;
  * aucune erreur de console ni de page.

Contrat de balisage de la coquille (Tasks 4 et 5)
-------------------------------------------------
Le script ne connaît la coquille que par ces crochets ; une coquille qui les respecte passe sans autre
réglage. Tant qu'elle n'existe pas, chaque contexte échoue avec « coquille absente » (une fois par
contexte) et les contrôles de la page sont joués quand même.
  * `body[data-nav="v2"]` et `body[data-espace="stagiaire" | "equipe"]`.
  * Tout élément racine de la coquille (barre du haut, barre latérale, barre du bas, tiroir, fenêtre du
    compte...) porte l'attribut `data-nav-coquille` ; « dans la coquille » veut dire « sous un élément
    `[data-nav-coquille]` ».
  * Une entrée est un lien `a[href="#/route"]` de la coquille ; `aria-current="page"` sur l'entrée de la
    page affichée (sur « Plus » quand cette entrée est rangée dans le tiroir).
  * Téléphone (moins de 700 px) : la barre du bas est un élément fixe collé au bas de la fenêtre, sur toute
    la largeur, dont les liens et boutons visibles sont les entrées (« Plus » compris), chacune avec un
    libellé visible.
  * Ouvreurs de menus, liste blanche : un bouton de la coquille est un ouvreur s'il porte `aria-haspopup`
    ou si son `data-nav-action` vaut `compte`, `plus` ou `assistant` (sans `data-nav-action`, un bouton
    nommé « Plus », « Compte », « Mon compte » ou « Menu » l'est aussi). Toute autre valeur (`replier`,
    `deconnexion`...) n'en est pas un et n'est pas cliquée. Leur fenêtre est un `role="dialog"` ou
    `role="menu"` (le panneau de l'assistant : `#chatbot-panel`).
  * Une entrée sans libellé visible (colonne d'icônes) porte `aria-label` et `title`. « Visible » se mesure
    sur la boîte affichée du texte : un libellé réservé aux lecteurs d'écran (1 px, `clip`) ne compte pas.

Options utiles pendant le développement : `--roles`, `--moteurs`, `--largeurs`, `--passes`, `--habillages`,
`--sans-menus` (boutons du compte et de « Plus » pas encore câblés, avant la Task 5), `--tout` (liste chaque
échec), `--captures DOSSIER` (une capture par vue en échec), `--jobs N` (processus en parallèle, deux par
moteur par défaut).

Défauts que les contrôles ont été éprouvés à attraper
-----------------------------------------------------
Chacun a été introduit seul dans une coquille factice qui respecte le contrat (hors dépôt), ou injecté
par `--script-init`, et le script a échoué avec le message attendu ; la coquille sans défaut ne fait
échouer aucun contrôle de la coquille.
  * coquille : contraste faible, zone à toucher trop petite, barre du bas de 6 entrées, marge basse
    manquante, défilement de côté, contenu sous la barre latérale, libellé de la barre du bas coupé,
    deux entrées allumées, « Plus » allumé quand l'entrée est dans la barre (et l'inverse), un libellé
    allumé à la place du lien, entrée sans `title`, libellé réservé aux lecteurs d'écran sans `title`
    (colonne d'icônes et barre du bas), lien d'évitement trop petit une fois affiché au focus ;
  * page : une page qui perd ses sous-onglets ;
  * anciennes adresses (ruling R26), défauts injectés dans la redirection de js/main.js : aucune redirection, redirection suivie
    interrupteur éteint, redirection par `location.hash` (étape d'historique en trop), mauvaise clé de sous-onglet,
    Notes de l'équipe redirigé ;
  * menus : Échap qui ne ferme pas, menu hors de l'écran, tiroir resté ouvert (avertissement) ; focus rendu
    à body quand le bouton d'une fenêtre a disparu (« Plus » > « Mon compte » > « Stagiaire ») ou ne
    s'affiche plus (écran élargi tiroir ouvert), tiroir resté ouvert quand l'écran passe à 900 px (sur la
    coquille de la Task 5 avant sa correction) ; fenêtre restée ouverte quand « Précédent » change
    l'adresse, « Fermer » sans effet (relecture finale, injectés par `--script-init`) ;
  * « Aujourd'hui » de Planning > Semaine (ruling R29, injectés par `--script-init`) : bouton absent,
    bouton sans effet, bouton montré interrupteur éteint ;
  * interrupteur éteint : un `h1` trop large (« élément de page qui déborde »), une coquille présente ;
  * ouverture (ruling R17) : ancienne barre laissée visible pendant l'attente (37 images avant la
    coquille), attente jamais levée ; « Voir en tant que » : panneau de l'assistant laissé sous le
    bandeau d'aperçu (champ et « Envoyer » couverts à 375 px dans les deux espaces, « Envoyer » à
    1280 px et à 900 px dans l'équipe) ;
  * Réglages, Mes préférences et compte (lot 2A, injectés dans les sources puis retirés) : ordre des sections de Réglages changé,
    « whitelist » de retour dans l'invitation, une section de la promo dans Mes préférences, `#/config` du stagiaire sans
    redirection, `#/preferences` sans redirection interrupteur éteint, un chiffre dans le point du compte, un point qui ne
    s'éteint pas quand tout est lu, la ligne « Réglages » gardée dans le menu du compte ;
  * titres, bénévoles et en-tête de l'équipe (lot 2A, tâche 3, injectés dans les sources puis retirés) : sous-onglet « Élèves bénévoles » retiré,
    « Fermer » dans le panneau de la page, bouton du Planning qui ouvre encore la fenêtre (allumé) ou qui quitte le Planning (éteint), titre de Notes,
    de Cours, de Dates clés ou de Documents non aligné, surtitre d'Indicateurs ou de Mon suivi non aligné, section des contacts non renommée, Assistant
    masqué dans l'en-tête du téléphone, de 40 px, qui déborde (partout, ou seulement à 320 px), titre du tiroir « Plus » inchangé, ligne « Assistant »
    du tiroir sans effet, phrase tactile des Notes absente, titres de la nouvelle navigation montrés interrupteur éteint, page Stagiaires regroupée interrupteur éteint, zones à toucher du
    panneau des bénévoles à 26 px sur téléphone ;
  * planning, accueil, décompte et bandeau (lot 2A, tâche 4, injectés dans les sources puis retirés) : phrase « Lecture seule... » et bouton « Cette semaine »
    rendus au stagiaire, La classe avec son second titre ou sa seconde rangée Matrice / EPCF, second logo, phrase d'accueil d'avant, tuiles rendues, ligne
    « en cours » de la carte absente, nombre de jours négatif sur la carte (allumé et éteint), « admins » de retour dans l'historique des passages, horaires
    du bandeau montrés sur téléphone ou cachés partout, bouton du bandeau de 29 px, bandeau d'une ligne de 64 px, détail du bandeau de l'équipe sans balise, titre ou surtitre d'Émargement
    non alignés, comptes de Notes, de Dates clés ou de Documents retirés du sous-titre, tuiles retirées, Planning ou La classe du stagiaire sans leurs textes
    interrupteur éteint ;
  * La classe et agenda vide (lot 2A, tour de correction 1, injectés dans les sources puis retirés) : section « Moyennes EPCF de la classe » absente, placée avant la
    matrice ou mal titrée, k-anonymat levé (un critère sur un seul stagiaire montré), titre du sous-onglet EPCF de l'équipe changé, La classe décidée par le rôle
    (le fondateur y retrouve son titre et ses deux onglets) ou sans l'option de Mon suivi, phrase de l'agenda vide de la nouvelle navigation reprise avec l'ancienne,
    ou de l'ancienne changée interrupteur éteint ;
  * défilements de côté et notes en rouge (lot 2A, tâche 5, injectés par `--script-init`) : tableaux du centre et des passages redevenus
    des tableaux de 700 px dans leur zone qui défile (sous 1 080 px), lien Légifrance de Cours > Signalements qui ne passe plus à la
    ligne, graphe de Notes de 540 px au moins dans une zone qui défile (onglet Distribution seul : l'onglet d'arrivée reste propre, seul
    le jeu des trois onglets le voit), barres « sous 8 » de Notes en rouge, points de Mon évolution en rouge, barres rouges dans le seul
    onglet Distribution, cellules des listes sans le titre de leur colonne, tableaux devenus des listes sur ordinateur, libellés de mois de
    Mon évolution qui se touchent à 375 px (l'ancien seuil de 30 unités), sommaire d'un cours qui défile (avertissement du lecteur de cours,
    sans échec), cibles de tap de Mon évolution à 12 unités de rayon avec vingt notes sur téléphone. Avant la tâche 5,
    une fois leurs listes d'exception retirées, les conteneurs des rulings R10 et R11 (graphe de Notes, tableaux du centre et des passages,
    lien Légifrance) donnaient 74 échecs et aucun autre ;
  * à traiter, point du compte, menu du compte et case du fondateur (lot 2A, tâche 6, injectés par `--script-init` ou dans les sources puis retirés) : point du compte de la barre
    sombre dans son vert d'origine (2,93:1 contre son liseré, 2,12:1 contre l'avatar : l'ancien script n'en voyait rien), ligne « Nouveautés » du menu du compte sans son nombre
    (l'ancien script n'en voyait rien non plus : il n'ouvrait le menu qu'après la rubrique Nouveautés), pastille « à traiter » claire sur la barre sombre (2,93:1), chiffre pâle
    (1,25:1), pastille qui sort de son entrée en colonne d'icônes, point de « Plus » retiré ou de 5 px, phrase du tiroir retirée, pastille dans la coquille du stagiaire ou dans
    l'ancienne barre (un échec par vue), brouillons de l'IA comptés (« 7 » au lieu de « 5 », vague finale, ruling R56), barre qui attend les comptes (coquille absente après 8 s), lecture en échec qui
    écrit une erreur en console, case de Réglages qui ne suit que le réglage lu ;
  * relecture de la tâche 6, tour de correction 1 (injectés par `--script-init` ou dans les sources puis retirés) : case de Réglages qui suit la navigation appliquée au lieu du réglage de
    la promo (2 des 6 combinaisons échouent : aperçu allumé sans mémoire, cochée à tort ; aperçu éteint avec mémoire, décochée à tort), pastille de « Signaler un problème » à son vert
    d'origine sur la barre sombre (2,93:1), levée dans la pose des comptes sans le try/catch (coquille absente, erreur de console « la nouvelle barre n'a pas pu se monter »)
    et avec lui (barre posée, sans erreur, seulement les repères manquants) ;
  * Nouveautés, Contacts du centre et textes des deux navigations (lot 2A, tâche 1, injectés dans les sources puis retirés) : Nouveautés de lancement absentes allumé ou montrées éteint
    (le filtre par navigation de `visibles` ignoré, ou toujours allumé), « Où le trouver » non réécrit allumé ou réécrit éteint, l'équipe lue comme un stagiaire (Mes préférences, Mon suivi,
    La classe) et le stagiaire comme l'équipe (Réglages), `guideNouvelle` ignoré, ligne « Contacts du centre » retirée, qui mène ailleurs, placée après « Mes préférences » ou montrée à un
    stagiaire quand le module Ressources est fermé, pied de l'Accueil en « paramètres » allumé ou en « réglages » chez le stagiaire, ligne Ctrl + Z de main allumé ou neuve éteint, phrase des
    modules toujours ouverts de main allumé, texte de l'anonymat sur « la page Notes », lien du parcours CCP2 dans sa forme d'avant, une Nouveauté de l'ancienne barre visible allumé, un mot de
    l'ancienne barre dans une page (« Paramètres ») ou de la nouvelle dans l'ancienne (« Mon suivi »), l'aperçu d'un fondateur appliqué à qui ne l'est pas, lien des bénévoles qui n'écrit pas la
    mémoire du sous-onglet de Stagiaires (le contrôle part du premier sous-onglet : l'exploration des sous-onglets laissait le dernier ouvert, et le défaut passait) ;
  * vague finale (injectés dans les sources puis retirés, chaque défaut vu par le contrôle qui lui est propre) : graphe d'évolution dessiné de nouveau pour la fenêtre (10 échecs : 5 libellés
    de 4,6 à 6,5 px et 5 dessins non faits à la largeur de leur conteneur, aux deux largeurs et dans les deux navigations, y compris la fenêtre resserrée sur place sans redessin), propositions de
    l'IA comptées (pastille « 7 » au lieu de « 5 », phrase du tiroir qui les dit), point de « Plus » qui ne suit plus la pastille de « Signaler un problème », pastille d'un stage commencé qui compte
    les jours (« 10 jours », habillage « later », dans les deux navigations), formulaire des bénévoles laissé au-dessus de l'écran (y -472 à -446 dans WebKit) ou derrière l'en-tête collant (marge de
    défilement retirée : y 0 à 26), pied de l'Accueil en « Promo 2026 » ou en « admin » sous la nouvelle navigation, « Mes préférences » répété comme titre de section, « Réglages personnels » de retour,
    sous-titre d'avant, réglage de l'anonymat montré à l'équipe sans fiche de stagiaire, Nouveautés d'avant la vague (date du 28/10, phrase des parties manquante, consignes d'avant, Nouveauté pour tous
    absente), liens d'avant la vague (« Réglages » et #/config pour l'anonymat chez l'équipe, « Planning, bouton Bénévoles » et #/planning, « barre de gauche » seul) ;
  * habillages (lot 3, tâche 10, injectés par `--script-init` ou dans les sources puis retirés) : texte de la barre resté au vert d'avant
    en « Couleurs ECF » (« teinte restée », 68 vues ; le vert #6B7F4E, valeur d'un jeton --doc-*, n'est plus couvert hors d'un document),
    habillage de l'appareil repassé au défaut (« habillage de la page », et 4 268 teintes restées : le défaut entier), graduations des
    graphes de notes en gris pâle (1,87:1, vu sur le remplissage du texte SVG), trait de l'entrée allumée presque de la couleur de la barre
    (1,56:1, mesuré au point du trait, hors de son entrée), titres de page à une graisse écrite en dur (700 en ECSR Promo comme en Couleurs
    ECF, « poids de titre »), appareil d'une autre personne pris pour celui de la personne connectée (habillage-regles.js : la page reste en
    ECF, le choix part sur son compte, l'appareil le lui attribue).
  * mise en place : erreur de console et de page, interrupteur qui n'allume pas, banc périmé.
Sans défaut, n'échouent pas : un bouton `data-nav-action="deconnexion"` (pas un ouvreur), un lien d'évitement
masqué (ni mesuré comme cible, ni sans nom), un nom pris par `aria-labelledby`, `<label for>` ou `<title>` SVG.
"""
import argparse
import concurrent.futures
import datetime
import itertools
import json
import os
import pathlib
import re
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, replace

from playwright.sync_api import Error as ErreurPlaywright
from playwright.sync_api import TimeoutError as DelaiDepasse
from playwright.sync_api import sync_playwright

# --------------------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------------------

BANC_PAR_DEFAUT = "http://127.0.0.1:8040/_harness.html"
MOTEURS = ("chromium", "webkit")
ROLES = ("stagiaire", "prof", "fondateur")
LARGEURS = (1280, 1100, 900, 375)
HAUTEUR = {1280: 800, 1100: 800, 900: 800, 375: 812}
LARGEUR_ETROITE = 320          # le plus petit téléphone : jamais un scénario, seulement l'en-tête de l'équipe (lot 2A)
HAUTEUR[LARGEUR_ETROITE] = 640
LARGEUR_TABLETTE = 768         # une tablette : jamais un scénario non plus, seulement la fiche d'un stagiaire (vague finale, F1)
HAUTEUR[LARGEUR_TABLETTE] = 1024
SEUIL_TELEPHONE = 700          # largeur de fenêtre sous laquelle la coquille passe en mode téléphone
DATE_DU_BANC = "2026-10-27"    # « aujourd'hui » figé (même date que les autres vérifications du lot)
CLE_APERCU = "ecsr_nav_v2"     # aperçu du fondateur, propre à l'appareil (js/nav-etat-regles.js)
# Habillages (lot 3) : « ecsr » (ECSR Promo, le défaut) et « ecf » (Couleurs ECF). Levier, le même que pour tout robot
# (outils/captures_habillages.py) : avant le chargement, l'appareil retient `{ nom }` sous CLE_HABILLAGE ; l'app pose data-skin
# elle-même (avant-peinture, puis accord avec le compte au démarrage). Le défaut est joué sur un appareil vierge.
HABILLAGES = ("ecsr", "ecf")
CLE_HABILLAGE = "ecsr_habillage"   # js/habillage-regles.js, CLE_APPAREIL
EMAIL_D_AUTRUI = "autre@example.test"   # l'autre personne de l'appareil partagé (Review Focus 1)
CLE_REGLAGE = "navigation_v2"  # réglage de la promo, ligne de `settings` (js/nav-etat-regles.js)
CLE_MEMOIRE_PROMO_1 = "ecsr_nav_v2_promo:1"   # mémoire de l'appareil pour la promo 1 du banc (cleMemoire, ruling R17)
CLE_SOUS_ONGLET_STAGIAIRES = "stagiaires.subtab"   # mémoire du sous-onglet de la page Stagiaires (CLES_SOUS_ONGLETS, js/nav-rules.js)
CLE_SOUS_ONGLET_COURS = "themes.subtab"          # celle de Cours et QCM
LENTEUR_DEMARRAGE_MS = 600     # lectures des réglages ralenties dans le scénario de l'ouverture (ruling R17)

# « À traiter » (lot 2A, tâche 6, puis lot 2B, tâche 6) : ce que la barre de l'équipe montre sur « Cours et QCM » (js/a-traiter.js). Le banc sert cinq signalements
# ouverts (un par groupe de la console) et aucun brouillon de l'IA ; les scénarios « à traiter » ajoutent des brouillons à relire (BROUILLONS_IA_DU_BANC, comptés depuis
# le sous-onglet « Propositions IA » du lot 2B), des signalements ouverts (SIGNALEMENTS_EN_PLUS_DU_BANC), des signalements et des brouillons déjà traités (ils
# ne comptent pas), ou font échouer ou traîner les lectures. Par scénario : la pastille attendue sur l'entrée et la phrase en tête du tiroir
# « Plus » (« 7 à traiter : 5 signalements, 2 propositions de l'IA »), None quand rien ne doit s'afficher.
A_TRAITER_DU_BANC = {
    "": ("5", "5 à traiter : 5 signalements"),
    # Deux brouillons de l'IA à relire de plus : 5 + 2.
    "ia": ("7", "7 à traiter : 5 signalements, 2 propositions de l'IA"),
    # Six signalements ouverts de plus (5 + 6 = 11) et six brouillons de l'IA : 17, « 9+ ».
    "beaucoup": ("9+", "17 à traiter : 11 signalements, 6 propositions de l'IA"),
    "panne": (None, None),    # lectures en échec : ni pastille, ni point, ni phrase, ni erreur
    "lent": (None, None),     # lectures qui n'aboutissent pas (20 s) : la barre est là, sans rien
    # Lectures en échec, mais une pastille sur « Signaler un problème » (que le tiroir « Plus » contient) : le seul repère est le point de « Plus ».
    "signaler": (None, None),
}
BROUILLONS_IA_DU_BANC = {"ia": 2, "beaucoup": 6}
SIGNALEMENTS_EN_PLUS_DU_BANC = {"beaucoup": 6}
LECTURES_A_TRAITER = ("qcm_signalements", "qcm_ia_brouillons")
LENTEUR_A_TRAITER_MS = 20000   # plus que n'en dure un scénario : la lecture n'aboutit pas
def levier_de_panne(condition):
    """Le levier de panne du banc (`window.__HARNESS_FAIL` : toute lecture suivante est rejetée) posé le temps des seules lectures que dit `condition` (une expression JS sur
    `this`, la requête du faux Supabase), puis remis à zéro : le reste de la page se lit. Posé partout, il casserait aussi les lectures de la page, et le contrôle « aucune
    erreur visible » verrait la boîte d'erreur de la page. Code ajouté à la fin du faux Supabase (le fichier du banc n'est jamais modifié sur le disque)."""
    return ("{ const executer = Query.prototype._executer; Query.prototype._executer = function () {"
            " if (this.mode === 'write' || !(%s)) return executer.call(this);"
            " window.__HARNESS_FAIL = 'panne du banc';"
            " try { return executer.call(this); } finally { window.__HARNESS_FAIL = null; } }; }" % condition)


# Les deux lectures « à traiter » en échec (scénario « panne »).
JS_PANNE_A_TRAITER = levier_de_panne("%s.includes(this.table)" % json.dumps(list(LECTURES_A_TRAITER)))
# La lecture du réglage de la promo (ligne `navigation_v2` de `settings`) en échec, les autres lectures de `settings` se lisant : la décision de la session revient à la mémoire
# de l'appareil (ruling R17) et le réglage reste null (lot 2A, tâche 6 : la case du fondateur dans Réglages).
JS_REGLAGE_ILLISIBLE = levier_de_panne("this.table === 'settings' && this.filters.some((f) => f.col === 'key' && f.val === 'navigation_v2')")
# La case « Nouvelle navigation activée » de Réglages après une lecture ratée du réglage de la promo (lot 2A, tâche 6, ruling R54) : elle ne dit que le réglage de la
# promo (la mémoire de l'appareil pour cette promo, ruling R17), jamais l'aperçu de l'appareil. Les six combinaisons du fondateur, l'aperçu (aucun, allumé, éteint)
# croisé avec la mémoire de la promo (vue allumée sur l'appareil ou non) : clé -> (aperçu posé sur l'appareil, mémoire posée, la barre appliquée est la nouvelle,
# la case est cochée). La barre suit l'aperçu dès qu'il y en a un, la case jamais.
CASES_DU_FONDATEUR = {
    "aucun-memoire": (None, True, True, True),
    "aucun-sans": (None, False, False, False),
    "allume-memoire": ("1", True, True, True),
    "allume-sans": ("1", False, True, False),    # aperçu allumé, promo éteinte : la barre est la nouvelle, la case reste décochée
    "eteint-memoire": ("0", True, False, True),   # aperçu éteint, promo allumée : la barre est l'ancienne, la case reste cochée
    "eteint-sans": ("0", False, False, False),
}
# « Signaler un problème » : le banc ne sert aucun compteur ; les scénarios « à traiter » avec brouillons en sèment (`compter_signalements_app`) pour que la pastille de ce
# bouton, sur la barre sombre, soit mesurée à côté de celle de « Cours et QCM ». Le formateur du banc n'est pas le fondateur : il voit ses signalements qui ont avancé.
COMPTEURS_SIGNALER_DU_BANC = {"nouveaux": 3, "suivis": 2}

def js_compteurs_signaler():
    """Sème les compteurs de « Signaler un problème ». Le banc de main (chantier du signalement, 28/10) répond
    lui-même à `compter_signalements_app` depuis ses propres signalements, avant de consulter `RPC` : la fonction
    du banc est alors doublée pour ce seul nom, sinon la pastille attendue n'aurait rien à montrer. Sans cette
    fonction (banc plus ancien), seul `RPC` compte."""
    return ("RPC.compter_signalements_app = %s;"
            " if (typeof rpcSignalementBanc === 'function') { const rpcSignalementDuBanc = rpcSignalementBanc;"
            " rpcSignalementBanc = (nom, params) => nom === 'compter_signalements_app'"
            " ? { data: RPC.compter_signalements_app, error: null } : rpcSignalementDuBanc(nom, params); }"
            % json.dumps(COMPTEURS_SIGNALER_DU_BANC))
SIGNALER_DU_BANC = "2"

# Aucun défilement de côté, à aucune largeur (règle de Timy du 27/10) : seule la matrice des notes (saisie case
# par case) est admise, sans avertissement. Les conteneurs des rulings R10 et R11 qui défilaient déjà sur main ont été
# corrigés au lot 2A, tâche 5 (graphe de Notes, tableaux du centre et des passages, lien Légifrance de Cours >
# Signalements, graphe de Mon évolution, moyennes EPCF de la classe), et ceux du lecteur de cours au lot 2B, tâche 1.
EXCEPTION_ADMISE = ".matrice-wrap"

# Entrées de repli si les règles de navigation de l'app ne se lisent pas dans la page.
ENTREES_REPLI = {
    "stagiaire": ("home", "planning", "themes", "mon-suivi", "ccp2"),
    "equipe": ("home", "planning", "emargement", "stagiaires", "notes", "themes", "ccp2", "centre", "config"),
}

# --------------------------------------------------------------------------------------
# Code injecté dans la page (une fois par page, sous window.__verifNav)
# --------------------------------------------------------------------------------------

JS_OUTILS = r"""
(() => {
if (window.__verifNav) return;

const SEL_INTERACTIF = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="link"], input:not([type="hidden"]), select, textarea, summary';
const SEL_POPUP = '[role="dialog"], [role="menu"], [aria-modal="true"], #chatbot-panel';
const SEL_CACHE = '[aria-hidden="true"], [hidden], [inert]';

const style = (e) => getComputedStyle(e);
const rect = (e) => e.getBoundingClientRect();
const largeur = () => document.documentElement.clientWidth;
const hauteur = () => window.innerHeight;
const dixieme = (x) => Math.round(x * 10) / 10;

const visible = (e) => {
  const r = rect(e);
  if (r.width <= 0 || r.height <= 0) return false;
  const s = style(e);
  return s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.01;
};
const nom = (e) => {
  if (!e || !e.tagName) return "?";
  let s = e.tagName.toLowerCase();
  if (e.id) s += "#" + e.id;
  const c = (e.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (c.length) s += "." + c.join(".");
  const href = e.getAttribute("href"), action = e.getAttribute("data-nav-action"), role = e.getAttribute("role");
  if (href && href.startsWith("#/")) s += '[href="' + href + '"]';
  else if (action) s += "[data-nav-action=" + action + "]";
  else if (role && !c.length) s += "[role=" + role + "]";
  return s;
};
const net = (s) => (s || "").replace(/\s+/g, " ").trim();
const texte = (e) => net(e.innerText);
const texteDe = (e) => net(e ? (e.innerText || e.textContent) : "");   // un <title> SVG n'a pas d'innerText
// Nom accessible, dans l'ordre du calcul : aria-labelledby, aria-label, <label> du champ, contenu (le texte
// réservé aux lecteurs d'écran en fait partie), alt d'une image, <title> d'un SVG, title.
const nomAcc = (e) => {
  const lie = net((e.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map((id) => texteDe(document.getElementById(id))).join(" "));
  if (lie) return lie;
  if (net(e.getAttribute("aria-label"))) return net(e.getAttribute("aria-label"));
  const etiquette = e.labels && e.labels.length ? net([...e.labels].map(texteDe).join(" ")) : "";
  if (etiquette) return etiquette;
  if (texte(e)) return texte(e);
  const img = e.querySelector ? e.querySelector("img[alt]") : null;
  if (img && net(img.getAttribute("alt"))) return net(img.getAttribute("alt"));
  const svg = e.querySelector ? e.querySelector("svg title") : null;
  if (svg && texteDe(svg)) return texteDe(svg);
  return net(e.getAttribute("title"));
};
// Texte réellement affiché par un élément : les nœuds de texte dont la boîte, rognée par les ancêtres qui
// coupent (overflow, clip, clip-path) de leur parent jusqu'à l'élément inclus, garde au moins 3 px dans les
// deux sens et n'est pas rejetée hors de la fenêtre (à gauche, à droite, au-dessus du haut de la page). Un
// libellé réservé aux lecteurs d'écran (1 px, clip, hors écran) n'en fait pas partie, alors que innerText le compte.
const rognageNul = (s) => /^rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)$/.test(s.clip) || /^inset\((50|100)%/.test(s.clipPath);
function texteAffiche(e) {
  const W = document.documentElement.clientWidth, morceaux = [];
  const marche = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const t = net(n.textContent);
    if (!t || !n.parentElement) continue;
    const zone = document.createRange();
    zone.selectNodeContents(n);
    const r = zone.getBoundingClientRect();
    let g = r.left, d = r.right, h = r.top, b = r.bottom, cache = false;
    for (let a = n.parentElement; a && !cache; a = a === e ? null : a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === "none" || s.visibility === "hidden" || rognageNul(s)) cache = true;
      else if (s.overflowX !== "visible" || s.overflowY !== "visible") {
        const ra = a.getBoundingClientRect();
        g = Math.max(g, ra.left); d = Math.min(d, ra.right); h = Math.max(h, ra.top); b = Math.min(b, ra.bottom);
      }
    }
    if (!cache && d - g >= 3 && b - h >= 3 && d > 0 && g < W && b + window.scrollY > 0) morceaux.push(t);
  }
  return morceaux.join(" ");
}
// Plage des diacritiques combinants (U+0300 à U+036F), construite par code pour ne pas dépendre d'une séquence d'échappement.
const DIACRITIQUES = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");
const sansAccent = (s) => (s || "").normalize("NFD").replace(DIACRITIQUES, "").toLowerCase();

const racines = () => [...document.querySelectorAll("[data-nav-coquille]")];
const actifs = (liste) => liste.filter((e) => !e.disabled && e.getAttribute("aria-disabled") !== "true");
function interactifsDe(racine) {
  const s = new Set();
  if (racine.matches(SEL_INTERACTIF)) s.add(racine);
  racine.querySelectorAll(SEL_INTERACTIF).forEach((e) => s.add(e));
  return actifs([...s]);
}
function interactifsCoquille() {
  const s = new Set();
  racines().forEach((r) => interactifsDe(r).forEach((e) => s.add(e)));
  return [...s];
}

// ---- Règles de navigation de l'app, lues dans la page (le script n'en recopie rien) ----
// Les modules de l'app par leur nom (« nav-rules »), tels que le banc les charge (son import map).
function modulesDeLApp(noms) {
  const cartes = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
  return Promise.all(noms.map((n) => {
    const cle = Object.keys(cartes).find((k) => k.startsWith("./js/" + n + ".js?v="));
    if (!cle) throw new Error("module introuvable : " + n);
    return import(new URL(cle, document.baseURI).href);
  }));
}
async function regles() {
  try {
    const [rules, mods, em, auth, etat] = await modulesDeLApp(
      ["nav-rules", "modules-etat", "emargement-etat", "auth-admin", "nav-etat"]);
    const espace = rules.espaceDe({ formateur: auth.isAdmin() || auth.isProf() });
    const entrees = rules.entreesNavigation(espace, { routeVisible: mods.routeVisible, emargementActif: em.emargementActif() });
    const tel = rules.barreTelephone(espace, entrees);
    return {
      espace, entrees, barre: tel.barre.map((e) => e.id), plus: tel.plus.map((e) => e.id),
      lit: (route) => rules.entreeActive(route, entrees),
      actif: etat.navigationV2Active(), fondateur: auth.isFounder(), profilStagiaire: auth.monStagiaireId() != null,
      setViewAs: auth.setViewAs,
    };
  } catch (e) { return { erreur: String((e && e.message) || e) }; }
}
async function reglesSimples() {
  const r = await regles();
  if (r.erreur) return { erreur: r.erreur };
  return { espace: r.espace, entrees: r.entrees.map((e) => ({ id: e.id, route: e.route, libelle: e.libelle, court: e.court })),
    barre: r.barre, plus: r.plus, actif: r.actif, fondateur: r.fondateur, profilStagiaire: r.profilStagiaire };
}
async function voirEnTantQue(role) {
  const r = await regles();
  if (r.erreur) return r.erreur;
  r.setViewAs(role);
  return null;
}

// ---- Couleurs et contraste ----
function analyser(c) {
  let m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : Number(x)));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  m = /^color\(srgb ([^)]+)\)$/.exec(c);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : Number(x)));
    return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
  }
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
  const d = cx.getImageData(0, 0, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
}
const sur = (haut, bas, a) => ({ r: haut.r * a + bas.r * (1 - a), g: haut.g * a + bas.g * (1 - a), b: haut.b * a + bas.b * (1 - a) });
const luminance = (c) => {
  const v = [c.r, c.g, c.b].map((x) => { const y = x / 255; return y <= 0.03928 ? y / 12.92 : Math.pow((y + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const rapport = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = (c) => "#" + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
// Fond réel d'un élément : les fonds unis des ancêtres, superposés jusqu'au premier opaque.
function fondDe(e) {
  const couches = [];
  for (let n = e; n; n = n.parentElement) {
    const s = style(n);
    if (s.backgroundImage && s.backgroundImage !== "none") return null;   // dégradé ou image : indéterminé
    const c = analyser(s.backgroundColor);
    if (c.a > 0) { couches.push(c); if (c.a >= 1) break; }
  }
  let base = { r: 255, g: 255, b: 255 };
  for (let i = couches.length - 1; i >= 0; i--) base = sur(couches[i], base, couches[i].a);
  return base;
}
// Hors des mesures de la page (lot 3, tâche 10) : le bandeau du banc, qui n'est pas de l'app, et les dessins des cours (panneaux,
// véhicules, marquage, scènes animées) : leurs couleurs sont celles du réel, et le texte d'un panneau fait partie de l'image.
const SEL_DESSINS = "svg.signal-svg, svg.marquage-svg, svg.dessin-svg, svg.scene-svg";
const SEL_HORS_MESURE = SEL_DESSINS + ", [data-vn-banc]";
// Les documents officiels reproduits à l'identique (livret EPCF TP-01303, dossier professionnel du ministère : « le document affiché à
// l'écran EST le document imprimé ») gardent les couleurs de leur modèle (le gris #7F7F7F du .docx, ses textes indicatifs gris) : leur
// texte n'est pas mesuré. Les annotations d'écran que l'app y pose (coupure de feuille, fiche exclue de l'impression) le sont, comme la
// barre d'outils et les aides autour du document.
const SEL_DOCUMENTS_OFFICIELS = ".lv-scale, .dp-doc";
const SEL_ANNOTATIONS_D_ECRAN = ".dp-coupure, .dp-mention-exclu";
// Le bandeau du banc (_harness_supabase.js) n'a ni classe ni identifiant : il est marqué à la première mesure.
function marquerBandeauDuBanc() {
  [...document.body.children].forEach((e) => {
    if (!e.hasAttribute("data-vn-banc") && /^BANC D'ESSAI/.test(e.textContent || "") && style(e).position === "fixed") e.setAttribute("data-vn-banc", "");
  });
}
const estSvg = (e) => e instanceof SVGElement;
// Couleur peinte d'un texte : son `color`, ou, pour un texte SVG, son remplissage (`fill` et `fill-opacity`) : le `color` d'un <text>
// n'est pas ce qui se peint (lot 3, tâche 10). null pour un remplissage qui n'est pas une couleur unie (dégradé, motif).
function couleurDuTexte(e, s) {
  if (!estSvg(e)) return analyser(s.color);
  if (!s.fill || !/^(rgba?|color)\(/.test(s.fill)) return null;
  const c = analyser(s.fill);
  c.a *= parseFloat(s.fillOpacity || "1");
  return c;
}
// Fond réel d'un texte SVG : le fond de la page sous le dessin, puis les formes pleines du même dessin peintes avant lui (ordre du
// document) dont la boîte contient son centre : une valeur posée sur une barre se lit sur la barre, pas sur la page.
function fondSvg(t) {
  const svg = t.ownerSVGElement || t.closest("svg");
  let fond = svg ? fondDe(svg) : null;
  if (!fond) return null;
  const r = rect(t), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
  for (const f of svg.querySelectorAll("rect, circle, ellipse, polygon, path")) {
    if (f.contains(t) || !(f.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    const s = style(f);
    if (s.display === "none" || s.visibility === "hidden" || !s.fill || s.fill === "none") continue;
    const rf = rect(f);
    if (x < rf.left || x > rf.right || y < rf.top || y > rf.bottom) continue;
    if (!/^(rgba?|color)\(/.test(s.fill)) return null;   // dégradé ou motif : indéterminé
    const c = analyser(s.fill), a = c.a * parseFloat(s.fillOpacity || "1") * parseFloat(s.opacity || "1");
    if (a > 0) fond = sur(c, fond, a);
  }
  return fond;
}
// Un nœud de texte direct de l'élément est-il affiché : sa boîte, rognée par les ancêtres qui coupent, garde 3 px dans les deux sens
// (un libellé réservé aux lecteurs d'écran, un panneau replié par max-height ne le sont pas). La règle de texteAffiche, limitée aux
// enfants directs : la mesure du contraste passe sur chaque élément qui porte du texte, une seule fois par nœud.
// Lot 3, tâche 11 : seul un ancêtre qui coupe (overflow hidden ou clip), sur l'axe où il coupe, rogne le texte. Un conteneur qui défile
// (auto, scroll : le bas d'un cours, une longue fenêtre, les messages de l'assistant, les colonnes de la matrice des notes) se lit en
// défilant : son texte est mesuré, même hors de la fenêtre sur le côté quand le conteneur défile de côté.
const coupe = (v) => v === "hidden" || v === "clip";
const defile = (v) => v === "auto" || v === "scroll";
function texteDirectAffiche(e) {
  const W = largeur();
  for (const n of e.childNodes) {
    if (n.nodeType !== 3 || !n.textContent.trim()) continue;
    const zone = document.createRange();
    zone.selectNodeContents(n);
    const r = zone.getBoundingClientRect();
    let g = r.left, d = r.right, h = r.top, b = r.bottom, cache = false, defileDeCote = false;
    for (let a = e; a && a !== document.documentElement && !cache; a = a.parentElement) {
      const s = style(a);
      if (rognageNul(s)) { cache = true; break; }
      const cx = coupe(s.overflowX), cy = coupe(s.overflowY);
      if (cx || cy) {
        const ra = rect(a);
        if (cx) { g = Math.max(g, ra.left); d = Math.min(d, ra.right); }
        if (cy) { h = Math.max(h, ra.top); b = Math.min(b, ra.bottom); }
      }
      if (defile(s.overflowX)) defileDeCote = true;
    }
    if (!cache && d - g >= 3 && b - h >= 3 && (defileDeCote || (d > 0 && g < W)) && b + window.scrollY > 0) return true;
  }
  return false;
}
// Contraste du texte : 4,5:1, 3:1 pour le grand texte. Lot 3, tâche 10 : toute la page (et non plus la seule coquille), dans les deux
// habillages, pages défilées comprises (un texte sous le bas de la fenêtre se lit en défilant) ; un texte SVG est mesuré sur son
// remplissage et sur la forme peinte sous lui, à sa taille rendue.
function mesurerContrastes(portees, echecs, avert) {
  const deja = new Set();
  let indetermines = 0;
  portees.forEach((racine) => {
    [racine, ...racine.querySelectorAll("*")].forEach((e) => {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      if (!visible(e) || e.closest(SEL_CACHE) || e.closest("button:disabled, [aria-disabled='true']") || e.closest(SEL_HORS_MESURE)) return;
      if (e.closest(SEL_DOCUMENTS_OFFICIELS) && !e.closest(SEL_ANNOTATIONS_D_ECRAN)) return;
      if (!texteDirectAffiche(e)) return;
      const s = style(e);
      let opacite = 1;
      for (let n = e; n && n !== document.body; n = n.parentElement) opacite *= parseFloat(style(n).opacity);
      const c = couleurDuTexte(e, s);
      const fond = estSvg(e) ? fondSvg(e) : fondDe(e);
      if (!fond || !c) { indetermines++; return; }
      if (c.a * opacite < 0.05) return;   // texte transparent : rien ne se lit (copie invisible, squelette)
      const texteCouleur = sur(c, fond, c.a * opacite);
      let taille = parseFloat(s.fontSize);
      if (estSvg(e)) { const m = e.getScreenCTM(); if (m) taille *= Math.hypot(m.a, m.b); }
      const gras = parseInt(s.fontWeight, 10) >= 700;
      const seuil = (taille >= 24 || (taille >= 18.66 && gras)) ? 3 : 4.5;
      const ratio = rapport(texteCouleur, fond);
      if (ratio >= seuil) return;
      const cle = nom(e) + "|" + hex(texteCouleur) + "|" + hex(fond);
      if (deja.has(cle)) return;
      deja.add(cle);
      echecs.push(["contraste", `${ratio.toFixed(2)}:1 (minimum ${seuil}) ${hex(texteCouleur)} sur ${hex(fond)} : ${nom(e)} « ${texteDe(e).slice(0, 24)} »`]);   // texteDe : un texte SVG n'a pas d'innerText
    });
  });
  if (indetermines) avert.push(["contraste indéterminé", `${indetermines} texte(s) de la page sur un fond en image ou en dégradé, non mesurés`]);
}

// ---- Repères non textuels (lot 3, tâche 10) ----
// Le trait de l'entrée allumée, les pastilles et les points de la coquille, l'icône d'une entrée allumée et celle d'une entrée sans
// libellé visible (colonne d'icônes) : 3:1 contre le fond réel sous eux (WCAG 1.4.11), c'est-à-dire ce qui est peint sous leur centre,
// eux exceptés. Le trait est posé 10 px hors de son entrée (left: -10px), sur le fond de la barre et non sur l'entrée allumée : le fond
// de l'élément parent ne le dit pas, seul le point le dit. Une couche sans pointeur (pointer-events: none) compte aussi : la règle est
// levée le temps de la mesure.
function fondEnUnPoint(x, y, sauf) {
  if (x < 0 || y < 0 || x >= largeur() || y >= hauteur()) return null;
  const couches = [], pile = document.elementsFromPoint(x, y);
  // Seul ce qui est peint sous le repère compte : un voile posé sur toute la page (fenêtre ouverte) couvre le repère et son fond pareillement.
  // Un repère sous une surface pleine (le lecteur de cours, une fenêtre) ne se voit pas : il n'est pas mesuré.
  const ici = pile.findIndex((n) => sauf && (n === sauf || sauf.contains(n)));
  if (sauf && ici < 0) return null;
  const plein = (n) => { const s = style(n); return (s.backgroundImage && s.backgroundImage !== "none") || analyser(s.backgroundColor).a >= 0.99; };
  if (pile.slice(0, Math.max(ici, 0)).some((n) => !n.closest("[data-vn-banc]") && !estSvg(n) && plein(n))) return "couvert";
  for (const n of ici >= 0 ? pile.slice(ici) : pile) {
    if (sauf && (n === sauf || sauf.contains(n))) continue;
    if (n.closest("[data-vn-banc]")) continue;
    const s = style(n);
    let c;
    if (estSvg(n) && !(n instanceof SVGSVGElement)) {
      if (!s.fill || s.fill === "none") continue;
      if (!/^(rgba?|color)\(/.test(s.fill)) return null;
      c = analyser(s.fill);
      c.a *= parseFloat(s.fillOpacity || "1");
    } else {
      if (s.backgroundImage && s.backgroundImage !== "none") return null;   // dégradé ou image : indéterminé
      c = analyser(s.backgroundColor);
    }
    c.a *= parseFloat(s.opacity || "1");
    if (c.a > 0) { couches.push(c); if (c.a >= 1) break; }
  }
  let base = { r: 255, g: 255, b: 255 };
  for (let i = couches.length - 1; i >= 0; i--) base = sur(couches[i], base, couches[i].a);
  return base;
}
const opaciteDe = (e) => { let o = 1; for (let n = e; n && n !== document.body; n = n.parentElement) o *= parseFloat(style(n).opacity); return o; };
// Couleur peinte d'une icône (trait, sinon remplissage, de sa première forme), avec son opacité.
function couleurDIcone(icone) {
  const forme = [icone, ...icone.querySelectorAll("path, line, circle, rect, polyline, polygon, ellipse")].find((f) => {
    const s = style(f); return (s.stroke && s.stroke !== "none" && parseFloat(s.strokeWidth) > 0) || (s.fill && s.fill !== "none");
  });
  if (!forme) return null;
  const s = style(forme), trait = s.stroke && s.stroke !== "none" && parseFloat(s.strokeWidth) > 0;
  const brut = trait ? s.stroke : s.fill;
  if (!/^(rgba?|color)\(/.test(brut)) return null;
  const c = analyser(brut);
  c.a *= parseFloat(trait ? s.strokeOpacity : s.fillOpacity) || 1;
  return c;
}
// Liseré plein d'un repère (box-shadow sans flou, d'une épaisseur d'au moins 1 px, opaque) : sa couleur, ou null.
function lisereDe(e) {
  const m = /^(rgba?\([^)]*\)|color\([^)]*\))\s+0px\s+0px\s+0px\s+([\d.]+)px/.exec(style(e).boxShadow || "");
  if (!m || parseFloat(m[2]) < 1) return null;
  const c = analyser(m[1]);
  return c.a >= 0.99 ? c : null;
}
// Un repère se détache s'il tient 3:1 contre le fond sous lui, ou s'il est cerné d'un liseré plein qui tient 3:1 contre lui et contre ce
// fond (WCAG 1.4.11 : la couleur voisine du repère est alors celle de son liseré). Rend null s'il se détache, sinon le texte de l'échec.
function repereDetache(peint, fond, lisere) {
  const r = rapport(peint, fond);
  if (r >= 3) return null;
  if (lisere) {
    const rl = rapport(peint, lisere), lf = rapport(lisere, fond);
    if (rl >= 3 && lf >= 3) return null;
    return `${r.toFixed(2)}:1 (minimum 3) ${hex(peint)} sur ${hex(fond)}, et son liseré ${hex(lisere)} ne le cerne pas (${rl.toFixed(2)}:1 contre lui, ${lf.toFixed(2)}:1 contre le fond)`;
  }
  return `${r.toFixed(2)}:1 (minimum 3) ${hex(peint)} sur ${hex(fond)}`;
}
function reperesNonTextuels(echecs, avert) {
  const reperes = [];
  const centre = (r) => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
  // Un repère est souvent caché aux lecteurs d'écran (aria-hidden : le nombre est dans le nom de l'entrée) mais bien peint : seul
  // ce qui est inerte ou masqué est écarté.
  const pris = (e) => e.closest("[hidden], [inert]");
  document.querySelectorAll("[data-nav-coquille] .nav-pastille, [data-nav-coquille] .nav-a-traiter, [data-nav-coquille] .nav-compte-point, [data-nav-coquille] .nav-plus-point").forEach((e) => {
    if (!visible(e) || pris(e)) return;
    reperes.push({ quoi: "pastille", e, sauf: e, point: centre(rect(e)), couleur: analyser(style(e).backgroundColor), lisere: lisereDe(e) });
  });
  document.querySelectorAll('[data-nav-coquille] [aria-current="page"]').forEach((e) => {
    if (!visible(e) || pris(e)) return;
    const r = rect(e), s = style(e);
    ["::before", "::after"].forEach((p) => {
      const sp = getComputedStyle(e, p);
      if (sp.content === "none" || sp.content === "normal" || sp.display === "none" || sp.position !== "absolute") return;
      const couleur = analyser(sp.backgroundColor);
      if (couleur.a === 0) return;
      // Pseudo-élément placé contre son entrée (position: relative) : boîte de remplissage de l'entrée, décalages et taille calculés.
      const bg = parseFloat(s.borderLeftWidth) || 0, bh = parseFloat(s.borderTopWidth) || 0, bd = parseFloat(s.borderRightWidth) || 0;
      const l = parseFloat(sp.width) || 0, h = parseFloat(sp.height);
      const x = sp.left !== "auto" ? r.left + bg + parseFloat(sp.left) + l / 2 : r.right - bd - parseFloat(sp.right) - l / 2;
      const y = sp.top !== "auto" && Number.isFinite(h) ? r.top + bh + parseFloat(sp.top) + h / 2 : (r.top + r.bottom) / 2;
      reperes.push({ quoi: "trait de l'entrée allumée (" + p + ")", e, sauf: e, point: [x, y], couleur });
    });
    // L'icône de l'entrée allumée.
    const icone = e.querySelector(":scope > .icon, :scope .nav-case-icone > .icon");
    if (icone && visible(icone)) reperes.push({ quoi: "icône de l'entrée allumée", e: icone, sauf: icone, point: centre(rect(icone)), couleur: couleurDIcone(icone) });
  });
  // Entrée sans libellé visible (colonne d'icônes) : l'icône seule la nomme.
  document.querySelectorAll('[data-nav-coquille] a[href^="#/"]').forEach((a) => {
    if (!visible(a) || pris(a) || a.getAttribute("aria-current") === "page" || texteAffiche(a)) return;
    const icone = a.querySelector(".icon");
    if (icone && visible(icone)) reperes.push({ quoi: "icône d'une entrée sans libellé", e: icone, sauf: icone, point: centre(rect(icone)), couleur: couleurDIcone(icone) });
  });
  if (!reperes.length) return;
  const pointeurs = document.createElement("style");
  pointeurs.textContent = "*, *::before, *::after { pointer-events: auto !important; }";
  document.head.appendChild(pointeurs);
  let indetermines = 0;
  try {
    reperes.forEach((p) => {
      const fond = fondEnUnPoint(p.point[0], p.point[1], p.sauf);
      if (fond === "couvert") return;
      if (!fond || !p.couleur) { indetermines++; return; }
      const a = p.couleur.a * opaciteDe(p.e);
      if (a < 0.05) return;
      const echec = repereDetache(sur(p.couleur, fond, a), fond, p.lisere || null);
      if (echec) echecs.push(["contraste d'un repère", `${echec} : ${p.quoi}, ${nom(p.e)}`]);
    });
  } finally {
    pointeurs.remove();
  }
  if (indetermines) avert.push(["contraste indéterminé", `${indetermines} repère(s) de la coquille sur un fond en image ou en dégradé, ou hors de la fenêtre, non mesurés`]);
}

// ---- Habillage (lot 3, tâche 10) ----
// Les couleurs fixes de la page : la valeur de chaque jeton de :root dont la famille est fixe (js/habillage-familles.js, la même liste
// que le test node ; noms lus dans la règle :root des feuilles de la page, valeurs calculées), et deux palettes calculées qui disent
// quelque chose sans être des jetons : l'échelle continue des notes de la matrice (js/echelle-notes.js, une teinte par dixième de
// point) et la couleur de chaque rubrique EPCF (js/epcf-trames.js, vive et assombrie pour un texte). Lues une fois par page.
const cleCouleur = (c) => [c.r, c.g, c.b].map(Math.round).join(",") + "," + Math.round(c.a * 100);
let fixesDeLaPage = null;
async function couleursFixes() {
  if (fixesDeLaPage) return fixesDeLaPage;
  const [familles, echelle, trames] = await modulesDeLApp(["habillage-familles", "echelle-notes", "epcf-trames"]);
  const noms = new Set();
  const lire = (regles) => {
    for (const r of regles) {
      if (r instanceof CSSStyleRule) {
        if (r.selectorText.trim() === ":root") for (const p of r.style) if (p.startsWith("--") && familles.familleDe(p) === "fixe") noms.add(p);
      } else if (r.cssRules) lire(r.cssRules);
    }
  };
  for (const f of document.styleSheets) { try { lire(f.cssRules); } catch (e) { /* feuille illisible */ } }
  // Les couleurs des documents imprimés (`--doc-*`) ne valent que dans un document : plusieurs reprennent une valeur de l'habillage par
  // défaut (#6B7F4E, #B7C0AA, #46554A...), qu'elles ne doivent pas couvrir dans l'interface.
  const valeurs = new Set(), valeursDoc = new Set(), racine = getComputedStyle(document.documentElement);
  const ajouter = (v, ou = valeurs) => { if (v && CSS.supports("color", v)) ou.add(cleCouleur(analyser(v))); };
  noms.forEach((n) => ajouter(racine.getPropertyValue(n).trim(), n.startsWith("--doc") ? valeursDoc : valeurs));
  for (let i = 0; i <= 200; i++) { const g = echelle.noteGradient(i / 10); ajouter(g.bg); ajouter(g.fg); }
  Object.values(trames.EPCF_PHASE_COLORS).forEach((v) => ajouter(v));
  Object.values(trames.EPCF_PHASE_TEXTE || {}).forEach((v) => ajouter(v));   // leurs teintes assombries pour un texte
  fixesDeLaPage = { valeurs, valeursDoc, jetons: noms.size };
  return fixesDeLaPage;
}
// Teinte (degrés) et saturation (HSL, 0 à 1) d'une couleur analysée.
function teinteDe(c) {
  const [r, g, b] = [c.r, c.g, c.b].map((x) => x / 255);
  const haut = Math.max(r, g, b), bas = Math.min(r, g, b), ecart = haut - bas, clair = (haut + bas) / 2;
  if (ecart === 0) return { teinte: 0, saturation: 0 };
  const saturation = ecart / (1 - Math.abs(2 * clair - 1));
  const sixieme = haut === r ? ((g - b) / ecart + 6) % 6 : haut === g ? (b - r) / ecart + 2 : (r - g) / ecart + 4;
  return { teinte: Math.round(sixieme * 60 * 10) / 10, saturation };
}
// En « Couleurs ECF », rien ne garde une teinte de l'habillage par défaut : toute couleur calculée (texte, fond, bord, remplissage, trait,
// pseudo-éléments compris) de teinte chaude ou verte (de 20° à 160°, saturation au-dessus de 15 %) est une teinte restée, sauf une couleur
// fixe (couleursFixes) ou ce qui est hors de l'app habillée : le bandeau du banc, les dessins des cours, le livret EPCF (`.lv-*`, document
// officiel TP-01303), le dossier professionnel (`.dp-doc`), les canevas.
const SEL_HORS_HABILLAGE = SEL_HORS_MESURE + ', .dp-doc, [class^="lv-"], [class*=" lv-"], canvas';
const COTES = ["Top", "Right", "Bottom", "Left"];
function teintesRestees(fixes) {
  const trouves = new Map(), W = largeur();
  const noter = (e, propriete, valeur, pseudo) => {
    if (!valeur || !/^(rgba?|color)\(/.test(valeur)) return;
    const c = analyser(valeur);
    if (c.a === 0) return;
    const t = teinteDe(c);
    if (t.saturation <= 0.15 || t.teinte < 20 || t.teinte > 160 || fixes.valeurs.has(cleCouleur(c))) return;
    if (fixes.valeursDoc.has(cleCouleur(c)) && e.closest(SEL_DOCUMENTS)) return;
    const cle = propriete + "|" + valeur + "|" + nom(e) + "|" + (pseudo || "");
    if (!trouves.has(cle)) trouves.set(cle, `${propriete}${pseudo ? " (" + pseudo + ")" : ""} ${valeur} (teinte ${t.teinte}°, saturation ${Math.round(t.saturation * 100)} %) : ${nom(e)}`);
  };
  const boite = (e, s, pseudo) => {
    noter(e, "background-color", s.backgroundColor, pseudo);
    COTES.forEach((c) => {
      const st = s["border" + c + "Style"];
      if (st !== "none" && st !== "hidden" && parseFloat(s["border" + c + "Width"]) > 0) noter(e, "border-color", s["border" + c + "Color"], pseudo);
    });
  };
  [document.documentElement, document.body, ...document.body.querySelectorAll("*")].forEach((e) => {
    if (e.closest(SEL_HORS_HABILLAGE)) return;
    const s = style(e);
    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) <= 0.01) return;
    const r = rect(e);
    if ((r.width <= 0 && r.height <= 0) || r.right <= 0 || r.left >= W) return;
    if (estSvg(e)) {
      if (["svg", "g", "defs", "symbol", "clipPath", "mask", "linearGradient", "radialGradient", "stop"].includes(e.tagName)) return;
      if (s.fill && s.fill !== "none") noter(e, "fill", s.fill);
      if (s.stroke && s.stroke !== "none" && parseFloat(s.strokeWidth) > 0) noter(e, "stroke", s.stroke);
      return;
    }
    if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) noter(e, "color", s.color);
    boite(e, s);
    ["::before", "::after"].forEach((p) => {
      const sp = getComputedStyle(e, p);
      if (sp.content === "none" || sp.content === "normal" || sp.display === "none") return;
      boite(e, sp, p);
      if (/^["'].+["']$/.test(sp.content)) noter(e, "color", sp.color, p);
    });
  });
  return [...trouves.values()];
}

// Poids des titres (lot 3, tâche 10 ; changement en direct, Review Focus 3) : en « ECSR Promo », chaque texte visible en Canela est
// relevé avec son poids ; `data-skin` passe à « ecf » dans la même page, et le même élément doit porter le poids ECF correspondant (700 et
// 500 deviennent 600, 600 le reste, ruling 10 ; 400 devient 500, 300 devient 400) et ne plus être en Canela ; puis retour à « ecsr ».
// Les transitions sont gelées le temps de l'aller-retour : sinon la bascule lancerait des transitions de couleur que la mesure suivante
// lirait à mi-course. Les documents imprimés (feuille d'émargement, dossier Qualiopi, attestations, livret EPCF, dossier professionnel)
// gardent leur police et leur poids fixes (décision H5) : hors champ.
const POIDS_ECF = { 700: 600, 600: 600, 500: 600, 400: 500, 300: 400 };
const SEL_DOCUMENTS = '.dp-doc, .qdoc, #emargement-print, [class^="emf-"], [class*=" emf-"], [class^="at-"], [class*=" at-"], [class^="lv-"], [class*=" lv-"]';
const enCanela = (s) => /^["']?canela\b/i.test((s.fontFamily || "").trim());
function poidsDesTitres(echecs) {
  const titres = [...document.body.querySelectorAll("*")]
    .filter((e) => !estSvg(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .filter((e) => enCanela(style(e)) && visible(e) && !e.closest(SEL_DOCUMENTS) && !e.closest(SEL_HORS_MESURE) && texteDirectAffiche(e))
    .map((e) => ({ e, avant: parseInt(style(e).fontWeight, 10) }));
  if (!titres.length) return;
  const racine = document.documentElement, habillage = racine.dataset.skin;
  const gel = document.createElement("style");
  gel.textContent = "*, *::before, *::after { transition: none !important; }";
  document.head.appendChild(gel);
  try {
    racine.dataset.skin = "ecf";
    titres.forEach((t) => { const s = style(t.e); t.apres = parseInt(s.fontWeight, 10); t.canela = enCanela(s); });
  } finally {
    if (habillage === undefined) delete racine.dataset.skin; else racine.dataset.skin = habillage;
    void document.body.offsetHeight;   // le style de retour est calculé transitions gelées
    gel.remove();
  }
  const deja = new Set();
  titres.forEach((t) => {
    const attendu = POIDS_ECF[t.avant], qui = `${nom(t.e)} « ${texte(t.e).slice(0, 24)} »`;
    if (deja.has(qui)) return;
    deja.add(qui);
    if (attendu === undefined) echecs.push(["poids de titre", `graisse ${t.avant} en Canela, sans correspondance en Couleurs ECF (300 à 700) : ${qui}`]);
    else if (t.apres !== attendu) echecs.push(["poids de titre", `graisse ${t.avant} en ECSR Promo, ${t.apres} en Couleurs ECF (attendu ${attendu}) : ${qui}`]);
    if (t.canela) echecs.push(["police de titre", `reste en Canela en Couleurs ECF (attendu la police du texte) : ${qui}`]);
  });
}

// ---- Zones à toucher ----
// Un élément visuellement caché mais focalisable (lien d'évitement : 1 px, clip, hors écran) n'est pas une
// zone à toucher, sauf s'il s'affiche quand il reçoit le focus : on le mesure alors tel qu'il s'affiche.
function cacheVisuellement(e) {
  // Hors de la fenêtre à gauche, à droite ou au-dessus du haut de la page : caché ; sous le bas de la fenêtre, non
  // (la page défile, ce que montre le bas d'une page n'est pas caché).
  const r = rect(e), s = style(e), W = largeur();
  return r.width <= 2 || r.height <= 2 || r.right <= 0 || r.bottom + window.scrollY <= 0 || r.left >= W || rognageNul(s);
}
function rectangleDeLaCible(e) {
  if (!cacheVisuellement(e)) return rect(e);
  const avant = document.activeElement;
  try { e.focus({ preventScroll: true }); } catch (x) { /* non focalisable */ }
  const reste = cacheVisuellement(e), r = rect(e);
  if (avant && avant !== e && avant.focus) avant.focus({ preventScroll: true });
  else if (document.activeElement === e) e.blur();
  return reste ? null : r;
}
function mesurerCibles(elements, min, echecs, type) {
  const champ = 'textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])';
  elements.filter((e) => !e.matches(champ)).filter(visible).forEach((e) => {
    const r = rectangleDeLaCible(e);
    if (r && (r.width < min - 0.5 || r.height < min - 0.5)) {
      echecs.push([type, `${Math.round(r.width)}x${Math.round(r.height)} px (minimum ${min}) : ${nom(e)} « ${nomAcc(e).slice(0, 30)} »`]);
    }
  });
}

// ---- Défilements et débordements de côté ----
// Une zone qui défile de côté, ou un élément qui dépasse de la fenêtre sans être rogné par un
// ancêtre. body et html rognent (overflow-x: clip) : ce rognage est justement le débordement.
function debordements(o) {
  const W = largeur();
  const trouves = [];
  const caches = new Map();
  const infos = (e) => {
    let v = caches.get(e);
    if (!v) { const s = style(e); v = { ox: s.overflowX, pos: s.position, vis: s.visibility, r: null }; caches.set(e, v); }
    return v;
  };
  const rc = (e) => { const v = infos(e); if (!v.r) v.r = rect(e); return v.r; };
  const categorie = (e) => {
    if (e.closest(o.exception)) return "ignore";
    if (e.closest("[data-nav-coquille]")) return "coquille";
    if (e.closest(".subtabs-bar")) return "sous-onglets";
    return "page";
  };
  const vus = new Set();
  // Le lecteur de cours et les Informations légales sont posés sur `body`, hors de `#view` : on les mesure à part (lot 2B, tâche 1).
  [document.getElementById("view"), ...racines(), ...document.querySelectorAll(".cours-overlay")].filter(Boolean).forEach((racine) => {
    [racine, ...racine.querySelectorAll("*")].forEach((e) => {
      if (vus.has(e)) return;
      vus.add(e);
      const v = infos(e);
      if ((v.ox === "auto" || v.ox === "scroll") && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1) {
        trouves.push({ genre: "zone", cat: categorie(e), nom: nom(e),
          detail: `défile de côté (${e.scrollWidth} px de contenu pour ${e.clientWidth} px) : ${nom(e)}` });
      }
      const r = rc(e);
      if (r.width <= 1 || r.height <= 1 || v.vis === "hidden" || e.closest(SEL_CACHE)) return;
      let g = r.left, d = r.right;
      if (v.pos !== "fixed") {
        for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
          const va = infos(a);
          if (va.ox !== "visible") { const ra = rc(a); g = Math.max(g, ra.left); d = Math.min(d, ra.right); }
          if (va.pos === "fixed") break;
        }
      }
      if (d > W + 1 || g < -1) {
        const de = d > W + 1 ? `dépasse de ${Math.round(d - W)} px à droite` : `dépasse de ${Math.round(-g)} px à gauche`;
        trouves.push({ genre: "hors", cat: categorie(e), nom: nom(e), detail: `${de} de la fenêtre : ${nom(e)}` });
      }
    });
  });
  return trouves;
}

// ---- Notes en rouge (règle de Timy du 27/10 : jamais une note en rouge) ----
// Le remplissage d'une forme d'un graphe de notes (barres des graphes de Notes, points de Mon évolution) n'est jamais
// rouge : teinte de 345° à 15° et saturation au-dessus de 50 % (HSL). Mesuré sur la couleur réellement affichée (la feuille
// de style comprise), formes sans hauteur comprises : une barre vide aurait la même couleur dès qu'elle se remplit.
function teinteEtSaturation(couleur) {
  const m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/.exec(couleur || "");
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
  if (alpha === 0) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseFloat(x) / 255);
  const haut = Math.max(r, g, b), bas = Math.min(r, g, b), ecart = haut - bas, clair = (haut + bas) / 2;
  if (ecart === 0) return { teinte: 0, saturation: 0 };
  const saturation = ecart / (1 - Math.abs(2 * clair - 1));
  const sixieme = haut === r ? ((g - b) / ecart + 6) % 6 : haut === g ? (b - r) / ecart + 2 : (r - g) / ecart + 4;
  return { teinte: Math.round(sixieme * 60 * 10) / 10, saturation };
}
function notesEnRouge() {
  const rouges = [];
  document.querySelectorAll("#view svg.notes-chart-svg, #view svg.ms-chart").forEach((svg) => {
    svg.querySelectorAll("rect, circle, path, polygon, polyline, ellipse, text").forEach((forme) => {
      const couleur = style(forme).fill, ts = teinteEtSaturation(couleur);
      if (ts && ts.saturation > 0.5 && (ts.teinte >= 345 || ts.teinte <= 15)) {
        rouges.push(`remplissage rouge ${couleur} (teinte ${ts.teinte}°, saturation ${Math.round(ts.saturation * 100)} %) : ${nom(forme)}`);
      }
    });
  });
  return rouges;
}

// ---- Libellés de Mon évolution (lot 2A, tâche 5, tour de correction 1) ----
// Deux libellés d'axe d'un même graphe (les mois comme les graduations) ne se recouvrent pas ni ne se touchent : 2 px d'écart au moins
// entre leurs boîtes mesurées. Sans le plancher de largeur d'avant, sept mois de notes serrent le graphe à 375 px, et un libellé de 10 px
// y mesure jusqu'à 37 px.
function libellesQuiSeTouchent() {
  const trouves = [];
  document.querySelectorAll("#view svg.ms-chart").forEach((svg) => {
    const libelles = [...svg.querySelectorAll(".ms-axis-label")].map((e) => ({ nom: net(e.textContent), r: rect(e) })).filter((l) => l.r.width > 0);
    for (let i = 0; i < libelles.length; i++) {
      for (let j = i + 1; j < libelles.length; j++) {
        const a = libelles[i].r, b = libelles[j].r;
        if (a.left < b.right + 2 && b.left < a.right + 2 && a.top < b.bottom && b.top < a.bottom) {
          trouves.push(`« ${libelles[i].nom} » et « ${libelles[j].nom} » se touchent à ${largeur()} px (${Math.round(Math.min(a.right, b.right) - Math.max(a.left, b.left))} px de recouvrement)`);
        }
      }
    }
  });
  return trouves;
}

// Les cibles de tap des points de Mon évolution (`.ms-pt-hit`, des cercles transparents) ne se chevauchent pas : sur téléphone, vingt notes
// serrent le graphe, et un rayon fixe de 12 unités en ferait se recouvrir dès onze. Cercles mesurés (distance des centres contre somme des rayons).
function ciblesQuiSeChevauchent() {
  const trouves = [];
  document.querySelectorAll("#view svg.ms-chart").forEach((svg) => {
    const cibles = [...svg.querySelectorAll(".ms-pt-hit")].map((c) => rect(c)).filter((r) => r.width > 0)
      .map((r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, rayon: r.width / 2 })).sort((a, b) => a.x - b.x);
    for (let i = 0; i < cibles.length; i++) {
      for (let j = i + 1; j < cibles.length && cibles[j].x - cibles[i].x < cibles[i].rayon + cibles[j].rayon; j++) {
        const ecart = Math.hypot(cibles[j].x - cibles[i].x, cibles[j].y - cibles[i].y), somme = cibles[i].rayon + cibles[j].rayon;
        if (ecart < somme - 0.5) trouves.push(`deux cibles de tap voisines se chevauchent à ${largeur()} px (${dixieme(ecart)} px entre les centres, ${dixieme(somme)} px de rayons cumulés)`);
      }
    }
  });
  return trouves;
}

// ---- Le graphe de Mon évolution n'est jamais réduit au point d'être illisible (vague finale, F1) ----
// Dans la fiche d'un stagiaire (liste de 270 px et barre latérale à côté), le conteneur du graphe est bien plus étroit que la fenêtre : un dessin fait
// pour la fenêtre (largeur de la fenêtre moins 80 px) y était réduit par `width: 100 %` (échelle de 0,51 à 0,65), et ses libellés de 10 unités n'y
// rendaient que 5 à 6 px. Chaque libellé d'axe (`.ms-axis-label`, les mois comme les graduations) rend au moins 8 px : sa taille de police par
// l'échelle réelle du dessin (getScreenCTM, qui tient compte du viewBox).
function grapheMesure(svg) {
  const libelles = [...svg.querySelectorAll(".ms-axis-label")].map((e) => {
    const m = e.getScreenCTM(), unites = parseFloat(style(e).fontSize);
    return m ? { texte: net(e.textContent), unites, rendu: unites * m.a } : null;
  }).filter(Boolean).sort((a, b) => a.rendu - b.rendu);
  const r = rect(svg), unitesDuDessin = svg.viewBox.baseVal.width;
  return { viewBox: unitesDuDessin, largeur: dixieme(r.width), echelle: Math.round((r.width / unitesDuDessin) * 1000) / 1000,
    conteneur: dixieme(svg.parentElement.getBoundingClientRect().width), pire: libelles[0] || null };
}
function graphesIllisibles() {
  const trouves = [];
  document.querySelectorAll("#view svg.ms-chart").forEach((svg) => {
    if (!visible(svg)) return;
    const g = grapheMesure(svg);
    if (g.pire && g.pire.rendu < 8) {
      trouves.push(`un libellé de ${g.pire.unites} unités (« ${g.pire.texte} ») ne rend que ${dixieme(g.pire.rendu)} px à ${largeur()} px de fenêtre `
        + `(dessin de ${g.viewBox} unités affiché sur ${g.largeur} px : échelle ${g.echelle}), 8 px au moins`);
    }
  });
  return trouves;
}
// Le graphe affiché (le premier de la page) : ce qui se mesure, ou null quand la page n'en montre pas.
function graphe() {
  const svg = document.querySelector("#view svg.ms-chart");
  return svg && visible(svg) ? grapheMesure(svg) : null;
}

// ---- Tableaux en listes hors ordinateur (lot 2A, tâche 5 ; spec § 4.1) ----
// Un tableau marqué par tableauEnListe (classe tableau-liste) est un tableau à partir de 1 080 px et une liste en dessous : chaque
// valeur d'une carte y porte le titre de sa colonne devant elle (le titre de la carte et la cellule des boutons n'en ont pas).
function tableauxEnListes() {
  const W = largeur(), liste = W < 1080, trouves = [];
  document.querySelectorAll("#view table.tableau-liste").forEach((t) => {
    if (!visible(t)) return;
    const d = style(t).display;
    if (liste && d === "table") trouves.push(`un tableau reste un tableau à ${W} px, sous 1 080 px : ${nom(t)}`);
    if (!liste && d !== "table") trouves.push(`un tableau est une liste à ${W} px, à partir de 1 080 px : ${nom(t)}`);
    if (!liste) return;
    const sans = [...t.querySelectorAll("tbody td")].filter((td) => visible(td) && !td.matches(".liste-titre, .liste-actions")
      && ["none", "normal", '""', ""].includes(getComputedStyle(td, "::before").content));
    if (sans.length) trouves.push(`${sans.length} valeur(s) sans titre de colonne dans la liste ${nom(t)} (ex. « ${texte(sans[0]).slice(0, 30)} »)`);
  });
  return trouves;
}

// ---- Éléments fixes de la coquille : barres, colonne, tiroirs ----
function fixesCoquille() {
  const fixes = [];
  racines().forEach((r) => [r, ...r.querySelectorAll("*")].forEach((e) => {
    const p = style(e).position;
    if ((p === "fixed" || p === "sticky") && visible(e)) fixes.push(e);
  }));
  return fixes.filter((e) => !fixes.some((f) => f !== e && f.contains(e)));
}
function genreDeBarre(e) {
  const r = rect(e), W = largeur(), H = hauteur();
  if (r.left <= 1 && r.width < W * 0.5 && r.height >= H * 0.8) return "gauche";
  if (r.width >= W * 0.9 && r.height <= 160 && r.height >= 36) {
    if (r.bottom >= H - 1) return "bas";
    if (r.top <= 1) return "haut";
  }
  return null;
}
// Étendue de ce que la page affiche (les enfants visibles de #view, hors éléments sortis du flux) :
// les marges et remplissages de #view, qui servent justement à faire de la place, n'en font pas partie.
function etenduDuContenu() {
  const vue = document.getElementById("view");
  const rs = [...vue.children].filter((c) => visible(c) && !["fixed", "absolute"].includes(style(c).position)).map(rect);
  if (!rs.length) return null;
  return { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)) };
}
// Lien visible d'une entrée, balisé pour que Playwright le clique (vrai clic, avec test de recouvrement).
function chercherLien(route, libelle, court) {
  document.querySelectorAll("[data-vn-cible]").forEach((e) => e.removeAttribute("data-vn-cible"));
  const liens = [...document.querySelectorAll('[data-nav-coquille] a[href="#/' + route + '"]')];
  const vis = liens.filter(visible);
  const bon = (a) => { const n = sansAccent(nomAcc(a)); return n.includes(sansAccent(libelle)) || n.includes(sansAccent(court)); };
  const choix = vis.find(bon) || vis[0] || null;
  if (choix) choix.setAttribute("data-vn-cible", "1");
  return { total: liens.length, visibles: vis.length };
}
// Le bouton « Plus » de la barre du téléphone : data-nav-action="plus", ou un bouton nommé « Plus ».
const estPlus = (e) => (e.tagName !== "A" || !(e.getAttribute("href") || "").startsWith("#/"))
  && (e.getAttribute("data-nav-action") === "plus" || /^plus$/i.test(nomAcc(e)));
function chercherPlus() {
  document.querySelectorAll("[data-vn-cible]").forEach((e) => e.removeAttribute("data-vn-cible"));
  const c = interactifsCoquille().filter(visible).find(estPlus);
  if (c) c.setAttribute("data-vn-cible", "1");
  return !!c;
}

// ---- Les mots de l'ancienne barre (lot 2A, tâche 1) ----
// Sous la nouvelle navigation, ni la page, ni la coquille (barres, menus et tiroirs ouverts compris) ne disent « Mon espace » (Mon suivi) ni
// « Paramètres » (Réglages, ou Mes préférences chez le stagiaire) : leur texte entier, étapes repliées des Nouveautés et liens « Où le trouver »
// compris. N'en font pas partie le titre et le récit des cartes de Nouveautés (`.nv-titre`, `.nv-resume`) : un récit daté d'un changement passé
// n'est jamais réécrit (« voient en haut de « Mon espace » une invitation », 15/10). Rend la phrase de l'échec, ou null.
function motsDAvant() {
  const clone = document.getElementById("view").cloneNode(true);
  clone.querySelectorAll(".nv-titre, .nv-resume").forEach((e) => e.remove());
  const coquille = [...document.querySelectorAll("[data-nav-coquille]")].map((e) => e.textContent).join(" ");
  const lu = net(clone.textContent + " " + coquille);
  const m = /\bMon espace\b|\bParamètres\b/i.exec(lu);
  return m ? `la page dit « ${m[0]} » : …${lu.slice(Math.max(0, m.index - 30), m.index + 30)}…` : null;
}
// La rubrique Nouveautés affichée : chaque carte dans l'ordre, avec son titre, la puce « Formateurs », son lien « Où le trouver » (le libellé et
// l'adresse) et ses étapes « Comment faire ». Sur l'Accueil, les cartes sont les trois plus récentes ; les étapes y sont repliées mais présentes.
function nouveautes() {
  return [...document.querySelectorAll("#view .nv-carte")].map((c) => {
    const ou = c.querySelector(".nv-ou");
    return { titre: net(c.querySelector(".nv-titre").textContent), date: net(c.querySelector(".nv-date").textContent), resume: net(c.querySelector(".nv-resume").textContent),
      formateurs: !!c.querySelector(".nv-puce-role"),
      ou: ou ? { texte: net(ou.querySelector("strong").textContent), href: ou.getAttribute("href") } : null,
      guide: [...c.querySelectorAll(".nv-guide li")].map((li) => net(li.textContent)) };
  });
}
// La page CCP2 : le lien vers le dossier professionnel du parcours (étape 8, dont les liens sont dans un panneau replié : le texte écrit, pas le texte affiché).
function lienDossierPro() {
  const a = document.querySelector('#view .ccp2-liens a[href="#/mon-suivi/dp"]');
  return a ? { texte: net(a.textContent), href: a.getAttribute("href") } : null;
}

// La page CCP2 (lot 2B, tâche 8) : ses blocs visibles dans l'ordre, ses dates, ses cartes repliables (titre, ouverte, hauteur du résumé, chevron visible, contenu
// visible, nombre de points et de liens) et l'écart entre l'en-tête et le titre des étapes (une page sans dates ne doit pas garder de trou).
function ccp2Page() {
  const vue = document.getElementById("view");
  const NOMS = [["view-header", "en-tête"], ["ccp2-dates", "dates"], ["ccp2-etapes-titre", "titre des étapes"], ["ccp2-etapes", "étapes"],
    ["ccp2-epreuve-repliee", "épreuve repliée"], ["ccp2-epreuve", "épreuve"]];
  const nom = (c) => (NOMS.find(([classe]) => c.classList.contains(classe)) || [null, c.className || c.tagName])[1];
  const carte = (d) => {
    const s = d.querySelector(":scope > summary"), ch = s.querySelector(".ccp2-chevron"), corps = d.querySelector(":scope > .ccp2-etape-corps");
    return { titre: net((s.querySelector(".ccp2-etape-titre") || s).textContent), ouverte: d.open, hauteur: Math.round(rect(s).height),
      chevron: !!ch && visible(ch), corpsVisible: !!corps && visible(corps) && rect(corps).height > 0,
      points: d.querySelectorAll(".ccp2-epreuve-points li").length, liens: d.querySelectorAll(".ccp2-liens a").length };
  };
  const dates = vue.querySelector(".ccp2-dates"), tete = vue.querySelector(".view-header"), titre = vue.querySelector(".ccp2-etapes-titre");
  const epreuve = vue.querySelector(".ccp2-epreuve-repliee");
  return { blocs: [...vue.children].filter((c) => !c.hidden && visible(c)).map(nom),
    dates: dates && !dates.hidden ? [...dates.querySelectorAll(".ccp2-date-titre")].map((e) => net(e.textContent)) : null,
    titreDates: dates && !dates.hidden && dates.querySelector("h3") ? net(dates.querySelector("h3").textContent) : null,
    etapes: [...vue.querySelectorAll(".ccp2-etapes > details")].map(carte), epreuve: epreuve ? carte(epreuve) : null,
    ecart: tete && titre ? Math.round(rect(titre).top - rect(tete).bottom) : null, margeEnTete: tete ? parseFloat(getComputedStyle(tete).marginBottom) : null,
    defile: document.documentElement.scrollWidth > document.documentElement.clientWidth };
}

// Un module ouvert pour la personne connectée (js/modules-etat.js, moduleVisible) : une Nouveauté liée à un module fermé lui est cachée.
async function moduleOuvert(cle) {
  const [mods] = await modulesDeLApp(["modules-etat"]);
  return mods.moduleVisible(cle);
}

// Le cache de lecture de l'app pour une clé (js/db.js, invalidateCache) : une donnée semée dans le faux Supabase après une première lecture ne se relit pas sans cela.
async function invaliderCache(cles) {
  const [db] = await modulesDeLApp(["db"]);
  cles.forEach((c) => db.invalidateCache(c));
}

// ---- Mesure d'une vue ----
async function mesurer(o) {
  const echecs = [], avert = [];
  const W = largeur(), H = hauteur();
  const tel = W < o.seuilTelephone;
  const allume = o.passe === "allume";
  const route = (location.hash || "").replace(/^#\//, "").split("/")[0];
  window.scrollTo(0, 0);
  const vue = document.getElementById("view");
  marquerBandeauDuBanc();
  // Lot 3, tâche 10 : la page porte l'habillage du scénario (posé par l'app d'après l'appareil et le compte, jamais par le script).
  if (o.habillage && document.documentElement.dataset.skin !== o.habillage) {
    echecs.push(["habillage de la page", `html[data-skin] vaut « ${document.documentElement.dataset.skin || "absent"} », attendu « ${o.habillage} »`]);
  }

  // Page : ni vide, ni en erreur.
  const boite = vue && vue.querySelector(".view-error-box");
  if (boite) echecs.push(["page en erreur", texte(boite).slice(0, 120)]);
  else if (!vue || !vue.children.length) echecs.push(["page vide", "#view n'a aucun contenu"]);
  // Ruling R17 : l'attente de la coquille est levée une fois l'app ouverte (sinon l'ancienne barre, si elle
  // reste, ne se peint plus).
  if (document.body.hasAttribute("data-nav-attente")) echecs.push(["attente de la coquille non levée", "body[data-nav-attente] est encore posé, l'app ouverte"]);
  // Lot 2A, tâche 4 : aucune page d'un stagiaire (nouvelle navigation) ne parle d'administration (« Connexion admin requise... »). Seule
  // l'abréviation « admin » est refusée, comme dans Réglages et Mes préférences : les mots « administrateur » et « administration » restent permis.
  if (allume && o.espace === "stagiaire" && vue) {
    const lu = net([vue, document.getElementById("emargement-bandeau")].filter(Boolean).map((e) => e.innerText).join(" "));
    const dit = /\badmins?\b/i.exec(lu);
    if (dit) echecs.push(["texte d'administration chez le stagiaire", `la page dit « ${dit[0]} » : …${lu.slice(Math.max(0, dit.index - 30), dit.index + 30)}…`]);
  }
  // Lot 2A, tâche 1 : sous la nouvelle navigation, rien de ce que la personne lit ne nomme une destination de l'ancienne barre.
  if (allume && o.coquille) {
    const mots = motsDAvant();
    if (mots) echecs.push(["mots de l'ancienne barre", mots]);
  }

  // Défilements et débordements de côté : la même classification interrupteur allumé ou éteint, car la
  // passe éteinte est le garde de « l'app reste identique à main » (une règle du lot qui déborde de
  // body[data-nav="v2"] se voit là). Aucun conteneur n'a d'exception, hors la matrice des notes.
  const trouves = debordements(o);
  trouves.forEach((t) => {
    if (t.cat === "ignore") return;
    if (t.cat === "coquille") echecs.push(["défilement de côté dans la coquille", t.detail]);
    else if (t.cat === "sous-onglets") echecs.push(["défilement de côté d'une barre de sous-onglets", t.detail]);
    else echecs.push([t.genre === "zone" ? "zone de page qui défile de côté" : "élément de page qui déborde de la fenêtre", t.detail]);
  });
  // Graphes de notes : jamais un remplissage rouge (lot 2A, tâche 5), dans les deux passes.
  notesEnRouge().forEach((detail) => echecs.push(["note en rouge dans un graphe", detail]));
  // Mon évolution : aucun libellé d'axe ne touche un autre (lot 2A, tâche 5, tour de correction 1).
  libellesQuiSeTouchent().forEach((detail) => echecs.push(["libellés de Mon évolution qui se touchent", detail]));
  // Mon évolution : les cibles de tap de deux points voisins ne se chevauchent pas (tour de correction 1).
  ciblesQuiSeChevauchent().forEach((detail) => echecs.push(["cibles de tap de Mon évolution qui se chevauchent", detail]));
  // Mon évolution : le graphe n'est jamais réduit au point que ses libellés rendent moins de 8 px (vague finale, F1), dans les deux passes.
  graphesIllisibles().forEach((detail) => echecs.push(["graphe d'évolution illisible", detail]));
  // Tableaux : une liste sous 1 080 px, un tableau au-delà (lot 2A, tâche 5), dans les deux passes.
  tableauxEnListes().forEach((detail) => echecs.push(["tableau en liste", detail]));

  // Barres de sous-onglets : une seule allumée ; zones à toucher sous la nouvelle navigation.
  const barres = [...document.querySelectorAll(".subtabs-bar")].filter(visible);
  barres.forEach((b) => {
    const n = b.querySelectorAll(".subtab.active").length;
    if (n !== 1) echecs.push(["sous-onglet allumé", `${n} sous-onglet(s) allumé(s) dans ${nom(b)}`]);
  });
  if (allume) {
    const min = tel ? 44 : 24;
    mesurerCibles([...document.querySelectorAll(".subtabs-bar .subtab")], min, echecs, "zone à toucher (sous-onglet)");
    mesurerCibles([...document.querySelectorAll(".invite-admin-toggle")], min, echecs, "zone à toucher (case de réglage)");
  }

  if (allume && o.coquille) mesurerCoquille(o, route, W, H, tel, echecs, avert, await regles());
  if (!allume) mesurerAncienne(route, echecs, barres);
  window.scrollTo(0, 0);

  // Lot 3, tâche 10 : contraste de toute la page (la coquille, l'ancienne barre, #view, les fenêtres et panneaux posés sur body), repères
  // non textuels de la coquille, dans les deux habillages ; en « Couleurs ECF », aucune teinte restée ; en « ECSR Promo », les poids des
  // titres basculés en direct (en dernier : la bascule ne doit rien laisser derrière elle).
  mesurerContrastes([document.body], echecs, avert);
  reperesNonTextuels(echecs, avert);
  if (o.habillage === "ecf") teintesRestees(await couleursFixes()).forEach((detail) => echecs.push(["teinte restée", detail]));
  if (o.habillage === "ecsr") poidsDesTitres(echecs);
  return { route, echecs, avert };
}

function mesurerAncienne(route, echecs, barres) {
  if (document.body.dataset.nav || document.body.dataset.espace) echecs.push(["coquille présente, interrupteur éteint", `body[data-nav] = ${document.body.dataset.nav}, body[data-espace] = ${document.body.dataset.espace}`]);
  if (racines().length) echecs.push(["coquille présente, interrupteur éteint", `${racines().length} élément(s) [data-nav-coquille]`]);
  // Les pastilles « à traiter » (lot 2A, tâche 6) sont celles de la coquille : l'ancienne barre n'en a aucune, ni point sur « Plus », ni phrase de tiroir.
  const aTraiterPose = document.querySelectorAll(".nav-a-traiter, .nav-plus-point, .nav-fenetre-atraiter, [data-nom-base]").length;
  if (aTraiterPose) echecs.push(["à traiter, interrupteur éteint", `${aTraiterPose} repère(s) « à traiter » dans la page de l'ancienne navigation`]);
  const onglets = [...document.querySelectorAll("#tabs .tab")].filter(visible);
  if (!onglets.length) echecs.push(["ancienne barre absente", "aucun onglet visible dans #tabs"]);
  const allumes = onglets.filter((t) => t.getAttribute("aria-current") === "page");
  if (allumes.length > 1) echecs.push(["entrée allumée", `${allumes.length} onglets allumés dans l'ancienne barre`]);
  // L'interrupteur éteint garde les pages de main : pas de regroupement en sous-onglets.
  const libelles = [...document.querySelectorAll("#view .subtab, #view .fiche-ligne")].map((e) => sansAccent(texte(e)));
  if (route === "planning" && barres.length) echecs.push(["page regroupée, interrupteur éteint", "le Planning montre des sous-onglets"]);
  if (route === "themes" && libelles.some((l) => l.startsWith("documents"))) echecs.push(["page regroupée, interrupteur éteint", "Cours montre un sous-onglet Documents"]);
  if (route === "mon-suivi" && libelles.some((l) => l.startsWith("la classe"))) echecs.push(["page regroupée, interrupteur éteint", "Mon espace montre la partie La classe"]);
  if (route === "mon-suivi" && libelles.some((l) => l.startsWith("resultats"))) echecs.push(["page regroupée, interrupteur éteint", "Mon espace montre la partie Résultats"]);
  if (route === "mon-suivi" && document.querySelector("#view .res-bar, #view .fiche-sommaire-clair")) echecs.push(["page regroupée, interrupteur éteint", "Mon espace montre « Moi / La classe » ou le sommaire aux libellés clairs"]);
  // Le bouton « Aujourd'hui » de la page (ruling R29) n'appartient qu'à la nouvelle navigation : éteint, il est dans la barre du haut.
  if (route === "planning" && document.querySelector("#view .p-aujourdhui")) echecs.push(["page regroupée, interrupteur éteint", "le Planning montre le bouton « Aujourd'hui » de la nouvelle navigation"]);
  // Lot 2A, tâche 1 : « Mon suivi » est le nom que la nouvelle navigation donne à Mon espace ; l'ancienne ne le dit nulle part (page et barre), hors deux textes de main : le
  // récit daté d'une ancienne Nouveauté (« ouvrir l'app te ramenait toujours sur Mon suivi », 16/09) et la règle du Planning sur la « fiche « Mon suivi » » du stagiaire (planning.js).
  const lu = document.getElementById("view").cloneNode(true);
  lu.querySelectorAll(".nv-titre, .nv-resume").forEach((e) => e.remove());
  const barre = document.getElementById("tabs");
  const nouveau = /\bMon suivi\b/.exec(net(lu.textContent + " " + (barre ? barre.textContent : "")).replace(/fiche « Mon suivi »/g, ""));
  if (nouveau) echecs.push(["texte de la nouvelle navigation, interrupteur éteint", `la page dit « ${nouveau[0]} », le nom que ne connaît que la nouvelle navigation`]);
}

function mesurerCoquille(o, route, W, H, tel, echecs, avert, R) {
  const vue = document.getElementById("view");
  if (document.body.dataset.nav !== "v2") echecs.push(["coquille disparue", `body[data-nav] = ${document.body.dataset.nav || "absent"}`]);
  if (document.body.dataset.espace !== o.espace) echecs.push(["espace de la coquille", `attendu ${o.espace}, body[data-espace] = ${document.body.dataset.espace || "absent"}`]);
  const visibles = racines().filter(visible);
  if (!visibles.length) echecs.push(["coquille invisible", `${racines().length} racine(s) [data-nav-coquille], aucune visible`]);

  // L'ancienne barre d'onglets ne reste pas affichée.
  const anciens = [...document.querySelectorAll("#tabs .tab")].filter(visible);
  if (anciens.length) echecs.push(["ancienne barre visible", `${anciens.length} onglet(s) de #tabs encore visible(s)`]);

  // Une seule entrée allumée, celle que donne entreeActive.
  const allumees = [...document.querySelectorAll('[data-nav-coquille] [aria-current="page"], [data-nav-coquille][aria-current="page"]')].filter(visible);
  const attendue = R.erreur ? undefined : R.lit(route);
  const attendu = attendue === undefined ? null : (attendue ? 1 : 0);
  if (attendu !== null ? allumees.length !== attendu : allumees.length > 1) {
    echecs.push(["entrée allumée", `${allumees.length} entrée(s) allumée(s) pour #/${route} (attendu ${attendu === null ? "1 au plus" : attendu + (attendue ? " : " + attendue : "")}) : ${allumees.map((a) => nom(a) + " « " + nomAcc(a).slice(0, 18) + " »").join(", ")}`]);
  } else if (attendue && allumees.length === 1) {
    // Le bon élément est allumé : le lien vers l'entrée attendue ; sur téléphone, « Plus » quand cette entrée
    // est rangée dans le tiroir. Un autre lien, « Plus » à tort, un li ou le bouton du compte : échec.
    const a = allumees[0];
    const lien = a.tagName === "A" ? (a.getAttribute("href") || "").replace(/^#\//, "") : null;
    const rangee = tel && !R.erreur && R.plus.includes(attendue);
    const qui = `${nom(a)} « ${nomAcc(a).slice(0, 18)} »`;
    if (rangee && !estPlus(a)) echecs.push(["entrée allumée", `#/${route} est rangée dans « Plus » : c'est « Plus » qui doit être allumé, pas ${qui}`]);
    else if (!rangee && lien !== attendue) echecs.push(["entrée allumée", `#/${route} doit allumer le lien vers « ${attendue} », c'est ${qui} qui l'est`]);
  }

  // Éléments fixes : dans la fenêtre, sans recouvrir le contenu.
  const fixes = fixesCoquille();
  const contenu = etenduDuContenu();
  fixes.forEach((f) => {
    const r = rect(f);
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) {
      echecs.push(["barre hors de l'écran", `${nom(f)} : x ${Math.round(r.left)} à ${Math.round(r.right)} (fenêtre ${W}), y ${Math.round(r.top)} à ${Math.round(r.bottom)} (fenêtre ${H})`]);
    }
    const genre = genreDeBarre(f);
    if (contenu && genre === "gauche" && contenu.left < r.right - 1) echecs.push(["contenu sous la coquille", `le contenu commence à x ${Math.round(contenu.left)}, la barre latérale va jusqu'à x ${Math.round(r.right)}`]);
    if (contenu && genre === "haut" && contenu.top < r.bottom - 1) echecs.push(["contenu sous la coquille", `le contenu commence à y ${Math.round(contenu.top)}, la barre du haut va jusqu'à y ${Math.round(r.bottom)}`]);
  });
  const basses = fixes.filter((f) => genreDeBarre(f) === "bas");
  if (basses.length) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const fin = etenduDuContenu();
    basses.forEach((f) => {
      const top = rect(f).top;
      if (fin && fin.bottom > top + 1) echecs.push(["contenu sous la coquille", `le bas de la page (y ${Math.round(fin.bottom)}) passe sous la barre du bas (y ${Math.round(top)}) : marge basse manquante`]);
    });
    window.scrollTo(0, 0);
  }

  // Téléphone : une barre du bas de 5 entrées au plus, toutes nommées. Au-delà : pas de barre du bas.
  const barre = basses.map((f) => ({ f, n: interactifsDe(f).filter(visible) })).sort((a, b) => b.n.length - a.n.length)[0];
  if (tel && !barre) echecs.push(["barre du bas absente", `aucun élément fixe de la coquille collé au bas de la fenêtre (${W} px de large)`]);
  if (!tel && barre) echecs.push(["barre du bas sur grand écran", `${nom(barre.f)} est affiché à ${W} px de large`]);
  if (tel && barre) {
    const items = barre.n;
    if (items.length > 5) echecs.push(["barre du bas", `${items.length} entrées (5 au plus)`]);
    if (!R.erreur) {
      const attenduN = R.barre.length + (R.plus.length ? 1 : 0);   // les entrées de la barre, et « Plus » s'il y a un tiroir
      if (items.length !== attenduN) echecs.push(["barre du bas", `${items.length} entrée(s) affichée(s), les règles en donnent ${attenduN}`]);
    }
    items.forEach((it) => {
      if (!texteAffiche(it)) echecs.push(["barre du bas", `entrée sans libellé visible : ${nom(it)} « ${nomAcc(it).slice(0, 20)} »`]);
      const rI = rect(it);
      [it, ...it.querySelectorAll("*")].filter((x) => [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).filter((x) => texteAffiche(x)).forEach((lib) => {
        const rl = rect(lib), lh = parseFloat(style(lib).lineHeight) || 16;
        if (lib.scrollWidth > lib.clientWidth + 1 || rl.height > lh * 1.5 || rl.left < rI.left - 1 || rl.right > rI.right + 1) {
          echecs.push(["libellé de la barre du bas coupé", `« ${texte(lib).slice(0, 20)} » : ${Math.round(rl.width)}x${Math.round(rl.height)} px dans une entrée de ${Math.round(rI.width)} px`]);
        }
      });
    });
  }

  // Zones à toucher, noms accessibles, infobulles des entrées sans libellé.
  const dedans = interactifsCoquille();
  mesurerCibles(dedans, tel ? 44 : 24, echecs, "zone à toucher (coquille)");
  dedans.filter(visible).forEach((e) => {
    if (!nomAcc(e)) echecs.push(["sans nom accessible", `${nom(e)} n'a pas de nom accessible (ni aria-labelledby, aria-label, étiquette, contenu, alt, <title> SVG, ni title)`]);
    else if (e.tagName === "A" && (e.getAttribute("href") || "").startsWith("#/") && !texteAffiche(e) && !e.getAttribute("title")) {
      echecs.push(["entrée sans infobulle", `${nom(e)} (${e.getAttribute("href")}) n'a pas de title : sans libellé visible, elle en a besoin`]);
    }
  });

  // Le contraste du texte de la coquille est mesuré avec toute la page (mesurer, lot 3, tâche 10).

  // Éléments fixes extérieurs qui recouvrent la coquille : avertissement seulement (l'assistant sous le bandeau
  // d'aperçu a son propre garde, verifier_assistant_sous_bandeau).
  const barresFixes = fixes.filter((f) => genreDeBarre(f));
  if (barresFixes.length) {
    const exterieurs = [...document.querySelectorAll("body *")].filter((e) => !e.closest("[data-nav-coquille]") && style(e).position === "fixed" && visible(e));
    exterieurs.filter((e) => !exterieurs.some((x) => x !== e && x.contains(e))).forEach((e) => {
      const r = rect(e);
      barresFixes.forEach((f) => {
        const b = rect(f);
        if (Math.min(r.right, b.right) - Math.max(r.left, b.left) > 4 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 4 && r.width < W * 0.95) {
          avert.push(["recouvrement de la coquille", `${nom(e)} recouvre ${nom(f)} (${genreDeBarre(f)})`]);
        }
      });
    });
  }
}

// ---- Menus et tiroirs ----
// Liste blanche : un bouton est un ouvreur s'il porte aria-haspopup, ou si son data-nav-action vaut compte,
// plus ou assistant ; ou, sans data-nav-action, s'il est nommé « Plus », « Compte », « Mon compte » ou « Menu ».
// Toute autre action (replier, deconnexion...) n'en est pas un : le script ne la clique pas.
const OUVREURS_CONNUS = ["compte", "plus", "assistant"];
function ouvreurs() {
  document.querySelectorAll("[data-vn-i]").forEach((e) => e.removeAttribute("data-vn-i"));
  const liste = [];
  interactifsCoquille().filter(visible).forEach((e) => {
    const action = e.getAttribute("data-nav-action") || "";
    const popup = e.getAttribute("aria-haspopup");
    const n = nomAcc(e);
    const avecFenetre = !!popup && popup !== "false";
    if (e.tagName === "A" && (e.getAttribute("href") || "").startsWith("#/") && !action && !avecFenetre) return;
    const estOuvreur = avecFenetre || OUVREURS_CONNUS.includes(action) || (!action && /^(plus|compte|mon compte|menu)$/i.test(n));
    if (!estOuvreur || (!OUVREURS_CONNUS.includes(action) && /repli|deplie|déplie|reduire|réduire|agrandir/i.test(n))) return;
    e.setAttribute("data-vn-i", String(liste.length));
    liste.push({ i: liste.length, action, nom: n });
  });
  return liste;
}
const popupsVisibles = () => [...document.querySelectorAll(SEL_POPUP)].filter(visible);
function marquerPopups(ouvreur) {
  document.querySelectorAll("[data-vn-avant]").forEach((e) => e.removeAttribute("data-vn-avant"));
  popupsVisibles().forEach((e) => e.setAttribute("data-vn-avant", "1"));
  document.querySelectorAll("[data-vn-ouvreur]").forEach((e) => e.removeAttribute("data-vn-ouvreur"));
  const o = document.querySelector('[data-vn-i="' + ouvreur + '"]');
  if (o) o.setAttribute("data-vn-ouvreur", "1");
}
function mesurerPopups(o) {
  const W = largeur(), H = hauteur(), tel = W < o.seuilTelephone;
  const nouveaux = popupsVisibles().filter((e) => !e.hasAttribute("data-vn-avant"));
  const echecs = [], avert = [];
  nouveaux.forEach((p) => {
    const r = rect(p);
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) {
      echecs.push(["menu hors de l'écran", `${nom(p)} : x ${Math.round(r.left)} à ${Math.round(r.right)} (fenêtre ${W}), y ${Math.round(r.top)} à ${Math.round(r.bottom)} (fenêtre ${H})`]);
    }
    mesurerCibles(interactifsDe(p), tel ? 44 : 24, echecs, "zone à toucher (menu)");
    mesurerContrastes([p], echecs, avert);
    reperesNonTextuels(echecs, avert);   // la pastille d'une ligne du menu, l'entrée allumée du tiroir
    const liens = [...p.querySelectorAll("a[href]")].filter(visible);
    liens.forEach((a) => { if (!nomAcc(a)) echecs.push(["sans nom accessible", `${nom(a)} dans ${nom(p)}`]); });
  });
  return { nouveaux: nouveaux.length, noms: nouveaux.map(nom), echecs, avert };
}
const popupsEncoreOuverts = () => popupsVisibles().filter((e) => !e.hasAttribute("data-vn-avant")).map(nom);
const focusSurOuvreur = () => !!(document.activeElement && document.activeElement.closest("[data-vn-ouvreur]"));
// Où est le focus clavier : null s'il est sur un élément affiché de la coquille, sinon ce qui l'a (body...).
const focusPerdu = () => {
  const a = document.activeElement;
  return a && a !== document.body && a.closest("[data-nav-coquille]") && visible(a) ? null : (a ? nom(a) : "aucun élément");
};

// Le champ et « Envoyer » du panneau de l'assistant, s'il est ouvert : ce qu'un toucher en leur centre atteint
// (null quand rien ne les couvre).
function controlesAssistant() {
  const p = document.getElementById("chatbot-panel");
  if (!p || !visible(p)) return null;
  return ["textarea", ".chatbot-form button"].map((s) => {
    const e = p.querySelector(s);
    if (!e || !visible(e)) return { nom: s, dessus: "absent" };
    const r = rect(e), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
    if (x < 0 || y < 0 || x > largeur() || y > hauteur()) return { nom: nom(e), dessus: "hors de l'écran" };
    const t = document.elementFromPoint(x, y);
    return { nom: nom(e), dessus: t && e.contains(t) ? null : (t ? nom(t.closest("[id]") || t) : "rien") };
  });
}

// ---- Réglages, Mes préférences, bouton et menu du compte (lot 2A) ----
// La page de réglages affichée : adresse, surtitre, titre et sous-titre de son en-tête, titres de ses sections
// dans l'ordre (le h3 de chaque `.param-section`) et tout son texte. `promo` : le nom que l'app donne à la promo
// affichée (getPromoCourante), celui que le surtitre de Réglages doit reprendre.
async function pageDeReglages() {
  const [db] = await modulesDeLApp(["db"]);
  const vue = document.getElementById("view");
  const de = (s) => { const e = vue.querySelector(s); return e ? net(e.textContent) : null; };   // le texte écrit : le surtitre s'affiche en capitales
  return { route: (location.hash || "").replace(/^#\//, "").split("/")[0], promo: (db.getPromoCourante() || {}).nom || null,
    surtitre: de(".view-header .eyebrow"), titre: de(".view-header h2"), sousTitre: de(".view-header .subtitle"),
    sections: [...vue.querySelectorAll(".param-section > .param-section-head h3")].map(texte), texte: texte(vue),
    // Lot 2A, tâche 1 : la phrase « Toujours ouverts : ... » du réglage des modules, et le texte de l'anonymat des notes (Mes préférences, ou Paramètres).
    socle: de(".modules-socle"), anonymat: [...vue.querySelectorAll(".param-block")].map((b) => net(b.textContent)).find((t) => /^Anonymat/.test(t)) || null };
}
// Le bouton du compte affiché, et ce que l'app compte de nouveautés non lues (`pastille` : le texte de libellePastille,
// "" à zéro, "1" à "9", "9+") : le texte que le bouton montre réellement, son point (visible, sa taille, son texte) et son nom.
async function boutonDuCompte() {
  const [mods, nouv] = await modulesDeLApp(["modules-etat", "nouveautes"]);
  const b = [...document.querySelectorAll('[data-nav-coquille] button[data-nav-action="compte"]')].find(visible);
  if (!b) return null;
  const p = b.querySelector(".nav-compte-point");
  const r = p ? rect(p) : null;
  return { pastille: nouv.libellePastille(mods.nouveautesAffichables().neuves.size), texte: texteAffiche(b), nom: nomAcc(b),
    point: !!p && visible(p), pointTexte: p ? net(p.textContent) : "", pointTaille: r ? [Math.round(r.width), Math.round(r.height)] : null,
    pointContraste: p ? contrasteDuPoint(p) : null };
}
// Un point sans texte (celui du compte, celui de « Plus ») : son fond contre son liseré (l'ombre pleine, de la couleur de la barre, qui le détache) et contre le
// fond réel derrière lui, 3:1 au moins (WCAG 1.4.11). Le liseré et le fond valent null quand ils ne se mesurent pas.
const arrondi = (x) => Math.round(x * 100) / 100;
const rapportOuNul = (a, b) => (a && b ? arrondi(rapport(a, b)) : null);
// `detache` : le point se détache (repereDetache) : contre le fond, ou cerné d'un liseré plein qui tient contre lui et contre ce fond (lot 3,
// tâche 10 : le liseré blanc des repères rouges de « Couleurs ECF »).
function contrasteDuPoint(e) {
  const s = style(e), couleur = analyser(s.backgroundColor), m = /rgba?\([^)]*\)/.exec(s.boxShadow || ""), fond = fondDe(e.parentElement);
  return { couleur: hex(couleur), lisere: rapportOuNul(couleur, m ? analyser(m[0]) : null), fond: rapportOuNul(couleur, fond),
    detache: fond ? !repereDetache(couleur, fond, lisereDe(e)) : true };
}
// « À traiter » (lot 2A, tâche 6) : ce que la coquille montre des comptes de Cours et QCM. Chaque pastille chiffrée (celle de la barre latérale, ou celle du
// tiroir ouvert) : où elle est (`dans` : la racine de la coquille), si elle est affichée, son texte, son entrée (adresse et nom accessible), sa taille, ses
// contrastes (son chiffre contre son fond, 4,5:1 ; son fond contre ce qui l'entoure, 3:1), si sa boîte reste dans celle de son entrée et si elle recouvre l'œil des
// modules fermés. Chaque point de « Plus » (affiché, taille, nom du bouton, contrastes) et la phrase du tiroir. `parlants` : les noms de la coquille qui disent
// « à traiter » ; `total` : tous les repères posés dans la page, affichés ou non (hors de l'équipe, il est nul).
function aTraiter() {
  const racine = (e) => { const r = e.closest("[data-nav-coquille]"); return r ? r.getAttribute("data-nav-coquille") : null; };
  const pastilles = [...document.querySelectorAll("[data-nav-coquille] .nav-a-traiter")].map((e) => {
    const lien = e.closest("a"), r = rect(e), rl = lien ? rect(lien) : null, s = style(e);
    const fond = analyser(s.backgroundColor), chiffre = analyser(s.color);
    const oeil = lien ? lien.querySelector(":scope > .marque-masque") : null, ro = oeil && visible(oeil) ? rect(oeil) : null;
    return { dans: racine(e), visible: visible(e), texte: net(e.textContent), href: lien ? lien.getAttribute("href") : null, nom: lien ? nomAcc(lien) : "",
      taille: [Math.round(r.width), Math.round(r.height)], chiffre: rapportOuNul(chiffre, fond), fond: rapportOuNul(fond, fondDe(e.parentElement)),
      detache: fondDe(e.parentElement) ? !repereDetache(fond, fondDe(e.parentElement), lisereDe(e)) : true,
      couleurs: hex(chiffre) + " sur " + hex(fond),
      dehors: !!rl && (r.left < rl.left - 1 || r.right > rl.right + 1 || r.top < rl.top - 1 || r.bottom > rl.bottom + 1),
      recouvreLOeil: !!ro && r.left < ro.right && ro.left < r.right && r.top < ro.bottom && ro.top < r.bottom };
  });
  const points = [...document.querySelectorAll("[data-nav-coquille] .nav-plus-point")].map((e) => {
    const r = rect(e), bouton = e.closest("button");
    return { visible: visible(e), taille: [Math.round(r.width), Math.round(r.height)], nom: bouton ? nomAcc(bouton) : "", ...contrasteDuPoint(e) };
  });
  // Toute pastille affichée de la barre sombre (la barre latérale de l'équipe), celle de « Signaler un problème » comme celle de « Cours et QCM » : `de` dit son bouton
  // (data-nav-action, ou l'adresse de l'entrée), avec le texte, le chiffre contre le fond (4,5:1) et le fond contre la barre (3:1).
  const barreSombre = [...document.querySelectorAll('[data-nav-coquille="cote"] .nav-pastille')].filter(visible).map((e) => {
    const s = style(e), fond = analyser(s.backgroundColor), chiffre = analyser(s.color), de = e.closest("a, button");
    return { texte: net(e.textContent), de: de ? (de.getAttribute("data-nav-action") || de.getAttribute("href") || "") : "", chiffre: rapportOuNul(chiffre, fond),
      fond: rapportOuNul(fond, fondDe(e.parentElement)), detache: fondDe(e.parentElement) ? !repereDetache(fond, fondDe(e.parentElement), lisereDe(e)) : true,
      couleurs: hex(chiffre) + " sur " + hex(fond) };
  });
  const phrase = document.querySelector('[data-nav-coquille="plus"] .nav-fenetre-atraiter');
  const parlants = [...document.querySelectorAll("[data-nav-coquille] a, [data-nav-coquille] button")].map(nomAcc).filter((n) => /à traiter/.test(n));
  // La pastille de « Signaler un problème » dans le tiroir « Plus » ouvert : son texte (rien quand elle n'y est pas, ou quand le tiroir est fermé).
  const signalerDuTiroir = (() => { const e = document.querySelector('[data-nav-coquille="plus"] [data-nav-action="signaler"] .nav-pastille'); return e && visible(e) ? net(e.textContent) : null; })();
  return { pastilles, points, barreSombre, signalerDuTiroir, phrase: phrase ? net(phrase.textContent) : null, phraseAffichee: !!phrase && visible(phrase), parlants,
    total: document.querySelectorAll(".nav-a-traiter, .nav-plus-point, .nav-fenetre-atraiter").length };
}
// Le menu du compte ouvert : chaque ligne (libellé, adresse, nombre posé sur elle) et ce que l'app compte de non lues.
async function menuDuCompte() {
  const [mods, nouv] = await modulesDeLApp(["modules-etat", "nouveautes"]);
  const f = document.querySelector('[data-nav-coquille="compte"] [role="dialog"]');
  if (!f) return null;
  const lignes = [...f.querySelectorAll(".nav-fenetre-lien")].filter(visible).map((e) => {
    const p = e.querySelector(".nav-pastille");
    return { libelle: net((e.querySelector(".nav-fenetre-texte") || e).textContent), href: e.getAttribute("href"),
      nombre: p && p.firstChild ? net(p.firstChild.textContent) : null };
  });
  return { pastille: nouv.libellePastille(mods.nouveautesAffichables().neuves.size), lignes };
}
// ---- Apparence (lot 3, tâche 11) ----
// Le choix de l'habillage dans `lieu` : « menu » (le menu du compte ouvert) ou « page » (la vue affichée : Mes préférences, Paramètres). Chaque groupe
// role=group nommé « Apparence », ses pastilles (habillage, libellé, type, aria-pressed, focus, taille), l'habillage de la page, la marque posée avant un
// clic (`window.__vnSansRechargement` : elle disparaît si la page se recharge) et le message du bas affiché.
function apparence(lieu) {
  const racine = lieu === "menu" ? document.querySelector('[data-nav-coquille="compte"] [role="dialog"]') : document.getElementById("view");
  const t = document.getElementById("toast");
  const base = { racine: !!racine, skin: document.documentElement.dataset.skin || null, sansRechargement: window.__vnSansRechargement === 1,
    toast: t && !t.classList.contains("hidden") ? { texte: net(t.textContent), erreur: t.classList.contains("error") } : null };
  if (!racine) return { ...base, groupes: [] };
  // Le nom est comparé sans la casse : dans le menu du compte, le titre est en capitales par la feuille de style, et innerText (nomAcc) les rend.
  const groupes = [...racine.querySelectorAll('[role="group"]')].filter((g) => visible(g) && nomAcc(g).toLowerCase() === "apparence").map((g) => ({
    apresTete: !!g.previousElementSibling && g.previousElementSibling.classList.contains("nav-fenetre-tete"),
    pastilles: [...g.querySelectorAll("button")].filter(visible).map((b) => {
      const r = rect(b);
      return { habillage: b.getAttribute("data-habillage"), classe: b.classList.contains("habillage-pastille"), libelle: texte(b.querySelector(".habillage-libelle") || b), legende: texte(b.querySelector(".habillage-legende") || b), type: b.getAttribute("type"),
        presse: b.getAttribute("aria-pressed"), focus: document.activeElement === b, l: dixieme(r.width), h: dixieme(r.height) };
    }) }));
  return { ...base, groupes };
}

// ---- Titres des pages, bénévoles sous Stagiaires, en-tête de l'équipe sur téléphone (lot 2A, tâche 3) ----
// L'en-tête des pages affichées : adresse, nom que l'app donne à la promo affichée, chaque `.view-header` de #view dans l'ordre (titre,
// surtitre et sous-titre : le texte écrit, le surtitre s'affiche en capitales) et les titres de section (h3). Une page à sous-onglets a
// plusieurs en-têtes : celui de la page, puis celui du sous-onglet ouvert.
async function enTeteDePage() {
  const [db] = await modulesDeLApp(["db"]);
  const vue = document.getElementById("view");
  const ecrit = (e, s) => { const x = e.querySelector(s); return x ? net(x.textContent) : null; };
  return { route: (location.hash || "").replace(/^#\//, "").split("/")[0], promo: (db.getPromoCourante() || {}).nom || null,
    entetes: [...vue.querySelectorAll(".view-header")].map((h) => ({ titre: ecrit(h, "h2"), surtitre: ecrit(h, ".eyebrow"), sousTitre: ecrit(h, ".subtitle") })),
    sections: [...vue.querySelectorAll("h3")].map((h) => net(h.textContent)) };
}
// Page Stagiaires, sous-onglet « Élèves bénévoles » : le panneau de la banque est dans la page, aucune fenêtre n'est ouverte et rien ne
// propose de la fermer. `petites` : les zones à toucher du panneau de moins de `min` px (rien si `min` est nul).
function panneauBenevoles(min) {
  const vue = document.getElementById("view"), page = vue.querySelector(".bnv-page"), petites = [];
  if (min) mesurerCibles([...vue.querySelectorAll(".bnv-page button, .bnv-page a[href], .bnv-page summary, .bnv-page .bnv-dispo-cell")], min, petites, "zone à toucher");
  const titre = page && page.querySelector("h3"), h2 = vue.querySelector(".view-header h2"), actif = vue.querySelector(".subtabs-bar > .subtab.active");
  return { present: !!page, titre: titre ? net(titre.textContent) : null, fenetre: document.querySelectorAll(".modal-backdrop").length,
    fermer: !!page && [...page.querySelectorAll("button")].some((b) => net(b.textContent) === "Fermer"),
    page: h2 ? net(h2.textContent) : null, actif: actif ? net(actif.textContent) : null, adresse: location.hash, petites: petites.map((e) => e[1]) };
}
// En-tête de l'équipe sur téléphone (la barre latérale devenue en-tête) : la promo, le bouton « Assistant » (même `data-nav-action` et même
// geste que celui du stagiaire) et le compte, leurs boîtes ; et ce qui dépasse de la fenêtre dans l'en-tête, ou dans la page.
function enTeteDeLEquipe() {
  const cote = document.querySelector('[data-nav-coquille="cote"]');
  if (!cote || !visible(cote)) return null;
  const W = largeur(), promo = cote.querySelector(".nav-contexte");
  const boite = (e) => { const r = rect(e); return { gauche: dixieme(r.left), droite: dixieme(r.right), haut: dixieme(r.top), bas: dixieme(r.bottom), l: dixieme(r.width), h: dixieme(r.height) }; };
  const montres = (s) => [...cote.querySelectorAll(s)].filter(visible);
  return { W, defile: document.documentElement.scrollWidth, cote: boite(cote), promo: promo && visible(promo) ? boite(promo) : null,
    assistants: montres('[data-nav-action="assistant"]').map((e) => ({ boite: boite(e), nom: nomAcc(e), action: e.getAttribute("data-nav-action") })),
    comptes: montres('[data-nav-action="compte"]').map(boite),
    dehors: [...cote.querySelectorAll("*")].filter(visible).filter((e) => rect(e).right > W + 0.5 || rect(e).left < -0.5).map(nom).slice(0, 5) };
}

// ---- Planning et accueil du stagiaire, décompte des événements, bandeau d'émargement (lot 2A, tâche 4) ----
// Accueil : ce que la page montre (logos à côté de la date, tuiles, ligne sous la salutation, carte du prochain événement majeur : titre,
// pastille, ligne « en cours »), avec de quoi recalculer la carte et la ligne sans reprendre le code de l'app : la promo affichée et l'agenda
// tel que l'app le lit. `agenda` : la section des prochains événements est construite (module fermé pour la promo : elle ne l'est pas).
async function accueil() {
  const [db, auth] = await modulesDeLApp(["db", "auth-admin"]);
  const vue = document.getElementById("view");
  const promo = db.getPromoCourante() || {};
  const carte = vue.querySelector(".home-countdown"), lead = vue.querySelector(".home-lead-v2");
  const de = (racine, s) => { const e = racine.querySelector(s); return e ? texte(e) : null; };
  return {
    route: (location.hash || "").replace(/^#\//, "").split("/")[0],
    promo: { nom: promo.nom || null, debut: promo.date_debut || null, fin: promo.date_fin || null },
    agenda: !!vue.querySelector(".home-agenda"),
    logos: vue.querySelectorAll(".home-hero-logo").length,
    tuiles: [...vue.querySelectorAll(".home-tile .home-tile-title")].map(texte),
    lead: lead ? net(lead.textContent) : null,
    // Lot 2A, tâche 1 : la dernière ligne de « À retenir » (Ctrl + Z) et le lien de réglage du pied de page (texte écrit et adresse).
    retenir: (() => { const li = vue.querySelector(".home-info-list li:last-child"); return li ? net(li.textContent) : null; })(),
    pied: (() => { const a = vue.querySelector(".home-footer-v2 a[href^='#/']"); return a ? { texte: net(a.textContent), href: a.getAttribute("href") } : null; })(),
    carte: carte ? { titre: de(carte, ".home-countdown-title"), pastille: de(carte, ".home-countdown-pill"),
      classe: (carte.querySelector(".home-countdown-pill") || {}).className || null,
      statut: de(carte, ".home-countdown-statut"), texte: texte(carte) } : null,
    // Vague finale, F7 : le pied de page (« TP ECSR App · Promo ... · connecté en tant que ... ») et qui est connecté (de quoi en déduire le rôle écrit).
    piedTexte: (() => { const e = vue.querySelector(".home-footer-v2 p"); return e ? net(e.textContent) : null; })(),
    qui: { admin: auth.isAdmin(), role: (auth.getProfile() || {}).role || null, fondateur: !!(auth.getProfile() || {}).is_founder,
      apercu: auth.getViewAs ? auth.getViewAs() : null, roles: (db.getPromoCourante() || {}).roles || null },
    evenements: (await db.listAgendaEvents()).map((e) => ({ type: e.type, titre: e.title, debut: e.date_start, fin: e.date_end })),
  };
}
// Accueil du stagiaire (lot 2B, tâche 3) : la pastille de date, les cartes (zone, titre, texte, position), les lignes de « À faire », les rangées de la
// journée (bouton « Signer », « Signé à »), les liens du pied, et de quoi mesurer les zones à toucher. Rien n'est recalculé ici : les attendus sont dans le script.
function accueilStagiaire() {
  const vue = document.getElementById("view");
  const haut = (e) => e.getBoundingClientRect().top + window.scrollY, bas = (e) => e.getBoundingClientRect().bottom + window.scrollY;
  const mesure = (sel) => [...vue.querySelectorAll(sel)].map((e) => ({ texte: net(e.textContent), l: dixieme(rect(e).width), h: dixieme(rect(e).height) }));
  const pastille = vue.querySelector(".home-today-pill");
  return {
    pastille: pastille ? { texte: net(pastille.textContent), parties: [...pastille.children].map((e) => net(e.textContent)) } : null,
    titre: (vue.querySelector(".home-title-v2") || {}).textContent || null,
    salut: (vue.querySelector(".home-salut-v2") || {}).textContent || null,
    cartes: [...vue.querySelectorAll(".acc-carte")].map((c) => { const r = c.getBoundingClientRect();
      return { zone: c.dataset.zone, titre: net(c.querySelector("h2").textContent), texte: net(c.querySelector(".acc-corps").textContent), haut: haut(c), bas: bas(c), gauche: r.left, droite: r.right }; }),
    tuiles: vue.querySelectorAll(".home-tile").length,
    agenda: !!vue.querySelector(".home-agenda, #home-agenda-list"),
    decompte: !!vue.querySelector(".home-countdown"),
    retenir: !!vue.querySelector(".home-info"),
    lignes: [...vue.querySelectorAll(".acc-ligne")].map((a) => ({ titre: net(a.querySelector("b").textContent), detail: net((a.querySelector(".acc-ligne-texte span") || { textContent: "" }).textContent),
      href: a.getAttribute("href"), h: dixieme(rect(a).height) })),
    creneaux: [...vue.querySelectorAll(".acc-creneau")].map((c) => ({ demi: c.dataset.demi, texte: net(c.textContent),
      boutons: [...c.querySelectorAll("button.btn")].map((b) => net(b.textContent)), signe: (c.querySelector(".acc-signe") || {}).textContent || null })),
    vide: (vue.querySelector(".acc-vide") || {}).textContent || null,
    erreurs: [...vue.querySelectorAll(".acc-erreur")].map((e) => net(e.textContent)),
    chargements: [...vue.querySelectorAll(".acc-corps")].filter((c) => /Chargement/.test(c.textContent)).length,
    liens: [...vue.querySelectorAll(".acc-liens > *")].map((e) => ({ texte: net(e.textContent), href: e.getAttribute("href"), balise: e.tagName, h: dixieme(rect(e).height) })),
    liensDuPied: [...vue.querySelectorAll(".home-footer-v2 a")].map((a) => ({ texte: net(a.textContent), href: a.getAttribute("href") })),
    boutons: mesure(".acc-actions .btn"),
    plus: mesure(".acc-plus"),
    debordement: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    pied: (() => { const e = vue.querySelector(".home-footer-v2 p"); return e ? net(e.textContent) : null; })(),
  };
}
// Aujourd'hui du formateur (lot 2B, tâche 4) : ce que montre la page de l'accueil de l'équipe, en plus de ce que lit l'Accueil du stagiaire (mêmes classes) : la ligne
// sous le titre, la promo et le nombre de stagiaires en formation tels que l'app les lit, et pour chaque carte ses liens, ses boutons et ses repères.
async function aujourdhuiEquipe() {
  const [db] = await modulesDeLApp(["db"]);
  const vue = document.getElementById("view");
  const promo = db.getPromoCourante() || {};
  const lead = vue.querySelector(".home-lead-v2");
  const dit = (c, s) => { const e = c.querySelector(s); return e ? net(e.textContent) : null; };
  return { ...accueilStagiaire(),
    lead: lead ? net(lead.textContent) : null,
    promo: { nom: promo.nom || null, debut: promo.date_debut || null, fin: promo.date_fin || null },
    enFormation: (await db.listStagiaires()).length,
    details: [...vue.querySelectorAll(".acc-carte")].map((c) => ({ zone: c.dataset.zone,
      liens: [...c.querySelectorAll(".acc-corps a[href]")].map((a) => ({ texte: net(a.textContent), href: a.getAttribute("href"), h: dixieme(rect(a).height) })),
      boutons: [...c.querySelectorAll(".acc-corps button")].map((b) => ({ texte: net(b.textContent), h: dixieme(rect(b).height) })),
      kpi: dit(c, ".acc-kpi"), repere: dit(c, ".acc-repere"), attente: dit(c, ".acc-attente"), signe: dit(c, ".acc-signe"),
      jauge: (() => { const j = c.querySelector(".acc-jauge"); return j ? { now: Number(j.getAttribute("aria-valuenow")), max: Number(j.getAttribute("aria-valuemax")) } : null; })() })),
    bandeau: (() => { const b = document.getElementById("emargement-bandeau"); return b && !b.hidden && visible(b) ? net(b.textContent) : null; })() };
}
// Ce que l'app lit : le nombre d'événements, de liens et de contacts, que les sous-titres de Dates clés et de Documents comptent.
async function comptesDesPages() {
  const [db] = await modulesDeLApp(["db"]);
  const [evenements, liens, contacts] = await Promise.all([db.listAgendaEvents(), db.listRessources(), db.listContacts()]);
  return { evenements: evenements.length, liens: liens.length, contacts: contacts.length };
}
// Planning > Semaine : la phrase de lecture seule, et les boutons « Cette semaine » et « Aujourd'hui » de la page.
function planningSemaine() {
  const vue = document.getElementById("view");
  const boutons = (n) => [...vue.querySelectorAll("button")].filter((b) => visible(b) && net(b.textContent) === n).length;
  return { lecture: /Lecture seule/.test(texte(vue)), cetteSemaine: boutons("Cette semaine"), aujourdhui: boutons("Aujourd'hui"),
           retour: boutons("Revenir à aujourd'hui"), emargement: boutons("Émargement"), consultation: /Consultation/.test(texte(vue)) };
}
// Notes de la classe, imbriquées dans la fiche de Mon suivi : leurs titres (h2), leurs en-têtes, leurs sous-onglets (Matrice / EPCF), le nombre
// de libellés « EPCF » isolés (titre, bouton ou sous-onglet qui ne dit que « EPCF »), leur texte, et la section des moyennes EPCF de la classe
// (titre, place sous la matrice, et pour chaque épreuve son titre, les lignes de son tableau et son message). null quand la matrice n'est pas à l'écran.
function laClasse() {
  const barre = document.querySelector("#view .matrice-toolbar"), sous = barre && barre.closest(".subtabs"), zone = sous && sous.parentElement;
  if (!zone) return null;
  const section = zone.querySelector(":scope > .notes-epcf-classe");
  const dit = (e, s) => { const x = e.querySelector(s); return x ? net(x.textContent) : ""; };
  return { titres: [...zone.querySelectorAll("h2")].map((h) => net(h.textContent)),
    entetes: [...zone.querySelectorAll(":scope > .view-header")].map((h) => net(h.textContent)),
    barres: sous.querySelectorAll(".subtabs-bar").length, sousOnglets: zone.querySelectorAll(".subtab").length,
    epcfIsoles: [...zone.querySelectorAll("h2, h3, h4, button, .subtab")].filter((e) => net(e.textContent) === "EPCF").length, texte: texte(zone),
    epcf: section ? { titre: dit(section, "h3"), sousLaMatrice: !!(sous.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING),
      epreuves: [...section.querySelectorAll(".epcf-classe-trame")].map((t) => ({ titre: dit(t, "h4"), message: dit(t, "p.muted"),
        lignes: [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => net(td.textContent))) })) } : null };
}
// Notes de l'équipe, sous-onglet EPCF : le titre de son rendu des moyennes de la classe et le nombre d'épreuves qu'il montre.
function epcfDeLEquipe() {
  const titre = document.querySelector("#view .epcf-body > h3");
  return { titre: titre ? net(titre.textContent) : null, epreuves: document.querySelectorAll("#view .epcf-classe-trame").length };
}
// Bandeau d'émargement (js/emargement-bandeau.js) : son texte, les lignes de ce texte (sans le remplissage du paragraphe), la hauteur du bandeau,
// ses détails (horaires du stagiaire, signatures du formateur) montrés ou non, et son bouton. null quand il n'est pas affiché.
function bandeauEmargement() {
  const b = document.getElementById("emargement-bandeau");
  if (!b || b.hidden || !visible(b)) return null;
  const p = b.querySelector("p"), bouton = b.querySelector(".btn"), sp = style(p);
  const hauteurLigne = parseFloat(sp.lineHeight) || parseFloat(sp.fontSize) * 1.5;
  const hauteurTexte = p.clientHeight - parseFloat(sp.paddingTop) - parseFloat(sp.paddingBottom);
  return { texte: texte(b), hauteur: dixieme(rect(b).height), lignes: Math.round(hauteurTexte / hauteurLigne),
    details: [...b.querySelectorAll(".em-bandeau-detail")].map((d) => ({ texte: net(d.textContent), visible: visible(d) })),
    bouton: bouton ? { nom: nomAcc(bouton), l: dixieme(rect(bouton).width), h: dixieme(rect(bouton).height) } : null };
}

window.__verifNav = { mesurer, regles: reglesSimples, voirEnTantQue, chercherLien, chercherPlus, ouvreurs, marquerPopups, mesurerPopups,
  popupsEncoreOuverts, focusSurOuvreur, focusPerdu, popupsVisibles: () => popupsVisibles().length, controlesAssistant,
  pageDeReglages, boutonDuCompte, menuDuCompte, apparence, enTeteDePage, panneauBenevoles, enTeteDeLEquipe,
  accueil, accueilStagiaire, aujourdhuiEquipe, comptesDesPages, planningSemaine, laClasse, epcfDeLEquipe, bandeauEmargement, aTraiter, nouveautes, lienDossierPro, ccp2Page, moduleOuvert, graphe, invaliderCache };
})();
"""

# Ouverture de l'app (scénario « demarrage », ruling R17), injecté avant le chargement : à chaque image jusqu'à la
# coquille, l'ancienne barre est-elle peinte (l'app affichée, la barre ni masquée ni invisible) ?
JS_IMAGES_OUVERTURE = r"""
(() => {
  const images = window.__vnImages = { eclair: 0, premiere: null, coquille: false };
  const t0 = performance.now();
  const tic = () => {
    const app = document.getElementById("app"), barre = document.querySelector("header.topbar");
    images.coquille = !!document.body && document.body.dataset.nav === "v2" && !!document.querySelector("[data-nav-coquille]");
    if (images.coquille) return;
    if (app && barre && !app.classList.contains("hidden")) {
      const s = getComputedStyle(barre);
      if (s.display !== "none" && s.visibility !== "hidden" && barre.getBoundingClientRect().height > 0) {
        images.eclair++;
        if (images.premiere === null) images.premiere = Math.round(performance.now() - t0);
      }
    }
    if (performance.now() - t0 < 15000) requestAnimationFrame(tic);
  };
  requestAnimationFrame(tic);
})();
"""

# Appareil d'une autre personne (lot 3, tâche 10, Review Focus 1), injecté avant le chargement : la suite des habillages que la page
# porte (html[data-skin]), dans l'ordre, du script d'avant-peinture à la fin du démarrage.
JS_SUITE_DES_HABILLAGES = r"""
(() => {
  const suite = window.__vnHabillages = [];
  const noter = () => {
    const v = document.documentElement && document.documentElement.dataset.skin;
    if (v && suite[suite.length - 1] !== v) suite.push(v);
  };
  new MutationObserver(noter).observe(document, { attributes: true, attributeFilter: ["data-skin"], subtree: true });
})();
"""

# Attente d'une page posée : vue présente et sans « Chargement », puis un moment de calme (aucune
# mutation du DOM), les animations en cours terminées et les polices chargées. Les mesures de
# largeur et de position en dépendent.
JS_ATTENTE = r"""async (o) => {
  const t0 = performance.now();
  const pret = () => { const v = document.getElementById("view"); return !!v && v.children.length > 0 && !v.querySelector(".loading"); };
  await new Promise((resolve) => {
    let dernier = performance.now();
    const obs = new MutationObserver(() => { dernier = performance.now(); });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    const tic = () => {
      const t = performance.now();
      if ((pret() && t - dernier >= o.calme) || t - t0 > o.max) { obs.disconnect(); resolve(); return; }
      setTimeout(tic, 20);
    };
    tic();
  });
  // Animations finies seulement : une animation sans fin (la pastille qui pulse) ne se termine jamais.
  const finies = document.getAnimations().filter((a) => { const t = a.effect && a.effect.getComputedTiming(); return t && Number.isFinite(t.endTime); });
  await Promise.race([Promise.all(finies.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 400))]);
  try { await document.fonts.ready; } catch (e) { /* polices indisponibles */ }
  return pret();
}"""

# --------------------------------------------------------------------------------------
# Scénarios et résultats
# --------------------------------------------------------------------------------------


@dataclass
class Scenario:
    moteur: str
    passe: str                  # "allume" ou "eteint"
    role: str                   # valeur de ?role= dans le banc
    largeur: int
    allumage: str = "aucun"     # "apercu" (localStorage), "reglage" (réglage de la promo) ou "aucun"
    espace: str = ""            # espace attendu de la coquille : "stagiaire" ou "equipe"
    sans_droits: bool = False   # le profil du banc perd is_founder (vrai compte de stagiaire)
    modules: str = ""           # ?modules= (scénario de modules fermés)
    voir_en_tant_que: bool = False
    demarrage: bool = False     # ouverture seule, mémoire de l'appareil allumée (ruling R17)
    promos_en_panne: bool = False   # ?mes_promos=erreur : le bandeau des promos non chargées s'ajoute à l'aperçu
    agenda_vide: bool = False   # la date du banc recule après le dernier événement : l'accueil n'a rien à venir (lot 2A, tour de correction 1)
    a_traiter: str = ""         # scénario « à traiter » (A_TRAITER_DU_BANC) : "ia", "beaucoup", "panne" ou "lent" ; vide pour tous les autres (lot 2A, tâche 6)
    reglage_illisible: str = ""       # la lecture du réglage de la promo échoue : la case du fondateur, une clé de CASES_DU_FONDATEUR (lot 2A, tâche 6, ruling R54)
    ressources_fermees: bool = False  # le module Ressources est fermé pour la promo : la ligne « Contacts du centre » du menu du compte (lot 2A, tâche 1)
    compte: str = ""            # ?compte= du banc : un compte réel du lot 4 ("direction" : lit sans écrire), joué par jouer_direction (relecture finale du lot 2B)
    habillage: str = "ecsr"     # habillage attendu de la page (lot 3, tâche 10) : "ecsr" (défaut, appareil vierge) ou "ecf" (levier de l'appareil posé avant le chargement)
    appareil_d_autrui: bool = False   # l'appareil porte l'habillage ECF d'une autre personne (Review Focus 1) : attendu « ecsr » une fois le démarrage fini

    @property
    def nom(self):
        variante = "-sans-droits" if self.sans_droits else ""
        variante += "-ecf" if self.habillage == "ecf" else ""
        variante += "-appareil-d-autrui" if self.appareil_d_autrui else ""
        # Passe éteinte avec un aperçu sur l'appareil : celui d'un fondateur, posé chez qui ne l'est pas (il n'est pas pour lui).
        variante += "-apercu-ignore" if self.passe == "eteint" and self.allumage == "apercu" else ""
        variante += "-ressources-fermees" if self.ressources_fermees else ""
        variante += ("-" + self.modules) if self.modules else ""
        variante += "-voir-en-tant-que" if self.voir_en_tant_que else ""
        variante += "-demarrage" if self.demarrage else ""
        variante += "-promos-en-panne" if self.promos_en_panne else ""
        variante += "-agenda-vide" if self.agenda_vide else ""
        variante += ("-a-traiter-" + self.a_traiter) if self.a_traiter else ""
        variante += ("-reglage-illisible-" + self.reglage_illisible) if self.reglage_illisible else ""
        variante += ("-compte-" + self.compte) if self.compte else ""
        return "%s/%s/%s%s@%d" % (self.moteur, self.passe, self.role, variante, self.largeur)


class Resultat:
    """Ce qu'un scénario a constaté : vues jouées, échecs, avertissements."""

    def __init__(self, scenario):
        self.scenario = scenario
        self.vues = 0
        self.echecs = []        # (type, vue, détail)
        self.avert = []         # (catégorie, clé, vue, détail)
        self.clics = {1: 0, 2: 0}
        self.coquille = False   # la coquille est montée : ses contrôles sont joués
        self.profil_stagiaire = False   # la personne connectée a un profil stagiaire (donc un Mon espace)
        self.derniere_vue = ""  # la dernière vue mesurée ou entamée : dite quand le scénario est interrompu (délai d'un clic...)
        self.console = []       # erreurs de console et de page, vidées à chaque vue
        self.deja_vues = set()  # erreurs de console déjà signalées dans ce scénario
        self.duree = 0.0

    def echec(self, type_, vue, detail):
        self.echecs.append((type_, vue, detail))

    def avertir(self, categorie, cle, vue, detail):
        self.avert.append((categorie, cle, vue, detail))

    def en_dict(self):
        return {"nom": self.scenario.nom, "vues": self.vues, "echecs": self.echecs, "avert": self.avert,
                "clics": self.clics, "duree": self.duree}


def construire_scenarios(moteurs, roles, largeurs, passes, habillages=HABILLAGES):
    """Les contextes à jouer, dans l'ordre : par moteur, la passe allumée dans chaque habillage, puis la passe éteinte (dans le
    défaut), puis, avec « Couleurs ECF », la passe éteinte d'un appareil en ECF et l'appareil d'une autre personne (lot 3, tâche 10)."""
    espace_de = {"stagiaire": "stagiaire", "prof": "equipe", "fondateur": "equipe"}
    # Le fondateur et le stagiaire du banc (fondateur lui aussi) ont l'aperçu de l'appareil ; le
    # formateur prof, qui n'est pas fondateur, n'en a pas : le réglage de la promo l'allume.
    allumage_de = {"stagiaire": "apercu", "prof": "reglage", "fondateur": "apercu"}
    etroit = [l for l in (1280, 375) if l in largeurs]
    # « Voir en tant que » joue aussi 900 px : la colonne d'icônes de l'équipe, où le panneau de l'assistant se pose
    # contre le bandeau d'aperçu, comme à 1280 px (barre dépliée) et à 375 px (barre du bas).
    voir = [l for l in (1280, 900, 375) if l in largeurs]
    resultat = []
    for moteur in moteurs:
        # Les scénarios du moteur dans le défaut, passe par passe : la passe allumée est rejouée telle quelle dans chaque habillage.
        scenarios = []
        if "allume" in passes:
            for role in roles:
                for l in largeurs:
                    scenarios.append(Scenario(moteur, "allume", role, l, allumage_de[role], espace_de[role]))
            if "stagiaire" in roles:
                for l in etroit:
                    scenarios.append(Scenario(moteur, "allume", "stagiaire", l, "reglage", "stagiaire", sans_droits=True))
                    scenarios.append(Scenario(moteur, "allume", "stagiaire", l, "apercu", "stagiaire", modules="depart"))
            if "prof" in roles:
                for l in etroit:
                    scenarios.append(Scenario(moteur, "allume", "prof", l, "reglage", "equipe", modules="depart"))
            if "fondateur" in roles:
                for l in voir:
                    scenarios.append(Scenario(moteur, "allume", "fondateur", l, "apercu", "equipe", voir_en_tant_que=True))
                # Le fondateur et un réglage de la promo qu'il ne lit pas : la case de Réglages ne dit que le réglage de la promo (la mémoire de l'appareil), jamais
                # l'aperçu, dans les six combinaisons d'aperçu et de mémoire.
                for cle in CASES_DU_FONDATEUR:
                    scenarios.append(Scenario(moteur, "allume", "fondateur", largeurs[0], "aucun", "equipe", reglage_illisible=cle))
            # Le module Ressources fermé (lot 2A, tâche 1) : la ligne « Contacts du centre » du menu du compte, absente chez un stagiaire (elle ne mènerait nulle
            # part), gardée par l'équipe qui voit tout.
            if "stagiaire" in roles:
                scenarios.append(Scenario(moteur, "allume", "stagiaire", largeurs[0], "reglage", "stagiaire", sans_droits=True, ressources_fermees=True))
            if "prof" in roles:
                scenarios.append(Scenario(moteur, "allume", "prof", largeurs[0], "reglage", "equipe", ressources_fermees=True))
            if "prof" in roles:
                # Un formateur sans aperçu, dont l'appareil a vu la promo allumée : son ouverture seule (ruling R17).
                scenarios.append(Scenario(moteur, "allume", "prof", largeurs[0], "reglage", "equipe", demarrage=True))
                # Son accueil quand plus aucun événement n'est à venir : où ajouter des événements, selon la navigation.
                scenarios.append(Scenario(moteur, "allume", "prof", largeurs[0], "reglage", "equipe", agenda_vide=True))
                # Ce qui attend l'équipe dans Cours et QCM (lot 2A, tâche 6) : des brouillons de l'IA qui ne comptent pas (ruling R56), onze signalements (la
                # pastille dit « 9+ » sur ordinateur, avec l'œil « masqué aux stagiaires » d'un module fermé, en ligne puis en colonne d'icônes), lectures en
                # échec, lectures qui n'aboutissent pas.
                # « signaler » : les lectures échouent, mais « Signaler un problème », dans le tiroir, porte une pastille : le point de « Plus » (F10).
                for a_traiter, largeur, modules in (("ia", 375, ""), ("ia", 1280, "ferme"), ("beaucoup", 1280, ""), ("beaucoup", 900, "ferme"),
                                                    ("panne", 1280, ""), ("panne", 375, ""), ("lent", 375, ""), ("signaler", 375, "")):
                    if largeur in largeurs:
                        scenarios.append(Scenario(moteur, "allume", "prof", largeur, "reglage", "equipe", modules=modules, a_traiter=a_traiter))
                # La direction du centre (relecture finale du lot 2B) : l'espace de l'équipe, en lecture seule ; ni Émargement, ni À traiter, ni QCM du stagiaire.
                for l in etroit:
                    scenarios.append(Scenario(moteur, "allume", "prof", l, "reglage", "equipe", compte="direction"))
        allumes, scenarios = scenarios, []
        for habillage in habillages:
            resultat += [replace(sc, habillage=habillage) for sc in allumes]
        if "eteint" in passes:
            for role in roles:
                for l in largeurs:
                    scenarios.append(Scenario(moteur, "eteint", role, l))
            if "prof" in roles:
                scenarios.append(Scenario(moteur, "eteint", "prof", largeurs[0], agenda_vide=True))
            if "stagiaire" in roles:
                # Un stagiaire sans drapeau de fondateur, sur une promo éteinte, dont l'appareil porte l'aperçu d'un fondateur (lot 2A, tâche 1) : l'aperçu
                # n'est pas pour lui, la navigation reste l'ancienne et aucune Nouveauté de la nouvelle ne s'affiche.
                scenarios.append(Scenario(moteur, "eteint", "stagiaire", largeurs[0], "apercu", sans_droits=True))
            if "fondateur" in roles:
                # Ancienne barre, les deux bandeaux du bas affichés : la bulle et le panneau de l'assistant
                # restent à portée (à 375 et 900 px, ils les couvraient sur main).
                for l in voir:
                    scenarios.append(Scenario(moteur, "eteint", "fondateur", l, voir_en_tant_que=True, promos_en_panne=True))
        if "ecsr" in habillages:
            resultat += scenarios
        if "ecf" in habillages:
            if "eteint" in passes:
                # Ancienne barre (Nîmes, Montpellier), appareil en « Couleurs ECF » (Review Focus 4, décision H6) : l'habillage s'applique
                # dans les deux navigations ; chaque rôle, sur ordinateur et sur téléphone, avec tous les contrôles de couleur.
                for role in roles:
                    for l in etroit:
                        resultat.append(Scenario(moteur, "eteint", role, l, habillage="ecf"))
            if "allume" in passes and "stagiaire" in roles:
                # Appareil partagé (Review Focus 1) : l'appareil garde le choix ECF d'une autre personne ; la page le montre avant que le
                # profil soit lu, puis prend celui de la personne connectée (ici le défaut), et ne l'envoie jamais à son compte.
                resultat.append(Scenario(moteur, "allume", "stagiaire", largeurs[0], "apercu", "stagiaire", appareil_d_autrui=True))
    return resultat


# --------------------------------------------------------------------------------------
# Navigateur, contexte, page
# --------------------------------------------------------------------------------------


def moteur_installe(moteur):
    """Le moteur déjà installé sur la machine quand celui qu'attend cette version de Playwright
    manque (cas de WebKit ici) : on le prend plutôt que d'en télécharger un."""
    racines = []
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH") not in (None, "", "0"):
        racines.append(pathlib.Path(os.environ["PLAYWRIGHT_BROWSERS_PATH"]))
    home = pathlib.Path.home()
    racines += [home / "AppData/Local/ms-playwright", home / ".cache/ms-playwright", home / "Library/Caches/ms-playwright"]
    # Chromium sans fenêtre est le « headless shell » de Playwright (chromium_headless_shell-*), puis le Chromium complet.
    motifs = {"webkit": ["webkit-*/Playwright.exe", "webkit-*/pw_run.sh"],
              "chromium": ["chromium_headless_shell-*/chrome-headless-shell-win*/chrome-headless-shell.exe",
                           "chromium_headless_shell-*/chrome-headless-shell-linux*/chrome-headless-shell",
                           "chromium_headless_shell-*/chrome-headless-shell-mac*/chrome-headless-shell",
                           "chromium-*/chrome-win*/chrome.exe", "chromium-*/chrome-linux*/chrome",
                           "chromium-*/chrome-mac*/Chromium.app/Contents/MacOS/Chromium"]}[moteur]
    for racine in racines:
        for motif in motifs:
            trouves = sorted(racine.glob(motif))
            if trouves:
                return str(trouves[-1])
    return None


def raison_courte(erreur):
    lignes = str(erreur).strip().splitlines()
    return (lignes[0] if lignes else "échec du lancement")[:160]


def lancer_navigateur(p, moteur):
    """(navigateur, None), ou (None, raison) quand ni le moteur attendu ni un moteur déjà installé ne démarre."""
    genre = getattr(p, moteur)
    try:
        return genre.launch(), None
    except ErreurPlaywright as e:
        premiere = raison_courte(e)
    chemin = moteur_installe(moteur)
    if not chemin:
        return None, "%s ; aucun autre %s dans ms-playwright" % (premiere, moteur)
    try:
        return genre.launch(executable_path=chemin), None
    except ErreurPlaywright as e:
        return None, "%s ; repli sur %s : %s" % (premiere, chemin, raison_courte(e))


STATIQUES = ("/js/", "/css/", "/assets/", "/vendor/", "/scripts/", "/_harness_supabase.js")
CACHE = {}   # url -> (statut, en-têtes, corps) : propre au processus, vide au démarrage


def servir_depuis_le_cache(route, lignes):
    """Les fichiers de l'app sont demandés une fois par processus, un à la fois, puis servis de la
    mémoire : le serveur du banc (ThreadingTCPServer, file d'attente de 5 connexions) refuse des
    connexions quand plusieurs navigateurs le chargent ensemble. Le document du banc passe tel quel.
    Pour ce contexte seulement, `lignes` s'ajoute à la fin du faux Supabase (le semis du réglage ou
    du profil) : le fichier du banc n'est jamais modifié sur le disque."""
    requete = route.request
    chemin = urllib.parse.urlparse(requete.url).path
    if requete.method != "GET" or not chemin.startswith(STATIQUES):
        route.continue_()
        return
    if requete.url not in CACHE:
        for essai in range(4):
            try:
                reponse = route.fetch()
                entetes = {k: v for k, v in reponse.headers.items() if k.lower() not in ("content-length", "content-encoding")}
                CACHE[requete.url] = (reponse.status, entetes, reponse.body())
                break
            except ErreurPlaywright:
                time.sleep(0.3 * (essai + 1))
        else:
            route.abort()
            return
    statut, entetes, corps = CACHE[requete.url]
    if lignes and chemin == "/_harness_supabase.js":
        corps += ("\ntry { " + " ".join(lignes) + " } catch (e) { console.error('[verifier_navigation] semis du banc impossible : ' + e); }\n").encode("utf-8")
    route.fulfill(status=statut, headers=entetes, body=corps)


def nouveau_contexte(navigateur, sc, options):
    mobile = sc.largeur < SEUIL_TELEPHONE
    reglages = {"viewport": {"width": sc.largeur, "height": HAUTEUR[sc.largeur]}, "locale": "fr-FR",
                "timezone_id": "Europe/Paris", "device_scale_factor": 2 if mobile else 1}
    if mobile:
        reglages.update(is_mobile=True, has_touch=True)
    contexte = navigateur.new_context(**reglages)
    contexte.set_default_timeout(8000)
    if sc.appareil_d_autrui or sc.habillage == "ecf":
        # Posé au premier chargement de l'onglet seulement : un rechargement doit retrouver ce que l'app a écrit depuis.
        appareil = {"nom": "ecf", "email": EMAIL_D_AUTRUI} if sc.appareil_d_autrui else {"nom": "ecf"}
        contexte.add_init_script("try { if (!sessionStorage.getItem('vn_habillage_pose')) { localStorage.setItem(%s, %s);"
                                 " sessionStorage.setItem('vn_habillage_pose', '1'); } } catch (e) { /* stockage bloqué */ }"
                                 % (json.dumps(CLE_HABILLAGE), json.dumps(json.dumps(appareil))))
    if sc.appareil_d_autrui:
        contexte.add_init_script(JS_SUITE_DES_HABILLAGES)
    if sc.allumage == "apercu":
        contexte.add_init_script("try { localStorage.setItem('%s', '1'); } catch (e) { /* stockage bloqué */ }" % CLE_APERCU)
    if sc.demarrage:
        contexte.add_init_script("try { localStorage.setItem('%s', '1'); } catch (e) { /* stockage bloqué */ }" % CLE_MEMOIRE_PROMO_1)
        contexte.add_init_script(JS_IMAGES_OUVERTURE)
    lignes = []
    if sc.allumage == "reglage":
        lignes.append("FIXTURES.settings.push({ key: '%s', value: 'true', promo_id: 1 });" % CLE_REGLAGE)
    if sc.sans_droits:
        lignes.append("FIXTURES.user_profiles[0].is_founder = false;")
    lignes.append("RPC.epcf_moyennes = %s;" % json.dumps([{"critere": c, "moyenne": m, "effectif": n}
                                                          for rangees in MOYENNES_EPCF_DU_BANC.values() for (c, m, n) in rangees]))
    # Des notes pour les graphes (lot 2A, tâche 5) : sans elles, aucune barre ne se dessine et la garde « aucune note en rouge » ne voit rien.
    lignes.append("FIXTURES.evaluations.push(...%s);" % json.dumps([
        {"id": 9100 + i, "stagiaire_id": sid, "type": "Thème", "theme_numero": theme, "theme_titre": None, "competence_code": None,
         "note": note, "note_max": 20, "observation": None, "date_eval": jour, "stagiaire": None, "competence": None}
        for i, (sid, theme, note, jour) in enumerate(NOTES_DU_BANC)]))
    lignes.append("RPC.notes_stats_groupe = %s;" % json.dumps(STATS_NOTES_DU_BANC))
    # Les données du faux Supabase, jointes à la fenêtre : la vérification du panneau des bénévoles y sème des bénévoles le temps d'un contrôle (le banc
    # n'en sert aucun, et `?benevoles=1` changerait aussi le Planning de toutes les vues).
    lignes.append("window.__FIXTURES_DU_BANC = FIXTURES;")
    if sc.a_traiter in BROUILLONS_IA_DU_BANC:
        # Des brouillons de l'IA à relire, qui ne comptent pas avant le lot 2B (ruling R56), et des lignes déjà traitées (un brouillon accepté ou rejeté, un
        # signalement traité ou rejeté) qui ne comptent pas non plus ; des signalements ouverts de plus quand le scénario en veut.
        modele = {"qcm_id": 50, "section": None, "options": [], "explication": None, "demande_par_email": "prof@example.test"}
        brouillons = [dict(modele, id=9000 + i, enonce="Brouillon du banc %d" % (i + 1), statut="a_relire", created_at="2026-10-26T09:%02d:00Z" % i)
                      for i in range(BROUILLONS_IA_DU_BANC[sc.a_traiter])]
        brouillons += [dict(modele, id=9100, enonce="Brouillon accepté", statut="acceptee", created_at="2026-10-25T09:00:00Z"),
                       dict(modele, id=9101, enonce="Brouillon rejeté", statut="rejetee", created_at="2026-10-25T09:05:00Z")]
        lignes.append("FIXTURES.qcm_ia_brouillons.push(...%s);" % json.dumps(brouillons))
        question = {"id": 102, "qcm_id": 50, "ordre": 2, "enonce": "Q-ECHOUEE, Les feux de route éclairent à environ ?",
                    "qcm": {"id": 50, "titre": "Feux du véhicule (banc)", "theme_id": 1}}
        signalements = [{"id": 790 + i, "question_id": 102, "email": "eleve@example.test", "stagiaire_id": 2, "motif": "autre", "commentaire": None,
                         "option_id": None, "option_texte": None, "statut": statut, "created_at": "2026-07-29T09:00:00Z", "traite_at": "2026-07-29T10:00:00Z",
                         "traite_par_email": "prof@example.test", "question": question, "instruction": None} for i, statut in enumerate(("traite", "rejete"))]
        signalements += [{"id": 800 + i, "question_id": 102, "email": "eleve@example.test", "stagiaire_id": 2, "motif": "autre", "commentaire": None,
                          "option_id": None, "option_texte": None, "statut": "ouvert", "created_at": "2026-07-30T09:%02d:00Z" % i, "traite_at": None,
                          "traite_par_email": None, "question": question, "instruction": None} for i in range(SIGNALEMENTS_EN_PLUS_DU_BANC.get(sc.a_traiter, 0))]
        lignes.append("FIXTURES.qcm_signalements.push(...%s);" % json.dumps(signalements))
        lignes.append(js_compteurs_signaler())
    if sc.a_traiter == "signaler":
        # Les lectures « à traiter » échouent (aucun compte), mais « Signaler un problème » a une pastille : la personne du banc a des signalements qui ont avancé.
        lignes.append(JS_PANNE_A_TRAITER)
        lignes.append(js_compteurs_signaler())
    if sc.a_traiter == "panne":
        lignes.append(JS_PANNE_A_TRAITER)
    if sc.reglage_illisible:
        apercu, memoire, _, _ = CASES_DU_FONDATEUR[sc.reglage_illisible]
        if apercu is not None:
            contexte.add_init_script("try { localStorage.setItem('%s', '%s'); } catch (e) { /* stockage bloqué */ }" % (CLE_APERCU, apercu))
        if memoire:
            contexte.add_init_script("try { localStorage.setItem('%s', '1'); } catch (e) { /* stockage bloqué */ }" % CLE_MEMOIRE_PROMO_1)
        lignes.append(JS_REGLAGE_ILLISIBLE)
    if sc.modules == "ferme":
        # Aucun module ouvert pour la promo : chaque entrée de l'équipe porte l'œil « masqué aux stagiaires » (le banc n'a pas de scénario qui ferme aussi les Documents,
        # et Cours et QCM n'est repéré que quand ses Documents le sont aussi).
        lignes.append("FIXTURES.settings.push({ key: 'modules', value: JSON.stringify({ v: 1, depuis: '2026-10-05T08:00:00.000Z', ouverts: {} }) });")
    if sc.ressources_fermees:
        # L'ensemble de départ (Planning, Calendrier, Ressources) sans Ressources : les contacts du centre ne sont plus pour les stagiaires (lot 2A, tâche 1).
        lignes.append("FIXTURES.settings.push({ key: 'modules', value: JSON.stringify({ v: 1, depuis: '2026-10-05T08:00:00.000Z', "
                      "ouverts: { planning: '2026-10-05T08:00:00.000Z', calendrier: '2026-10-05T08:00:00.000Z' } }) });")
    contexte.route("**/*", lambda route: servir_depuis_le_cache(route, lignes))
    if options.get("script_init"):
        contexte.add_init_script(path=options["script_init"])
    return contexte


def nouvelle_page(contexte, res):
    page = contexte.new_page()
    page.on("pageerror", lambda e: res.console.append("erreur de page : %s" % e))
    page.on("console", lambda m: res.console.append("console.error : %s" % m.text) if m.type == "error" else None)
    page.on("dialog", lambda d: (res.console.append("boîte de dialogue inattendue : %s" % d.message), d.accept()))
    return page


COMPTEUR = itertools.count(1)


def adresse_de_page(url, sc):
    """L'adresse du banc pour ce scénario : les paramètres que l'adresse donnée porte déjà sont gardés (un
    `?lenteur=...`), ceux du scénario les remplacent ; le fragment est retiré (l'app s'ouvre à froid)."""
    p = urllib.parse.urlparse(url)
    q = dict(urllib.parse.parse_qsl(p.query, keep_blank_values=True))
    q.update(cb="%d-%d-%d" % (int(time.time() * 1000), os.getpid(), next(COMPTEUR)), role=sc.role,
             date=DATE_AGENDA_VIDE if sc.agenda_vide else DATE_DU_BANC, emargement="1")
    q.pop("modules", None)
    if sc.modules:
        q["modules"] = sc.modules
    q.pop("compte", None)
    if sc.compte:
        q["compte"] = sc.compte
    q.pop("mes_promos", None)
    if sc.promos_en_panne:
        q["mes_promos"] = "erreur"
    if sc.demarrage:
        q.update(lenteur=str(LENTEUR_DEMARRAGE_MS), lenteur_tables="settings")
    if sc.a_traiter == "lent":
        q.update(lenteur=str(LENTEUR_A_TRAITER_MS), lenteur_tables=",".join(LECTURES_A_TRAITER))
    return urllib.parse.urlunparse(p._replace(query=urllib.parse.urlencode(q), fragment=""))


def charger(page, url, sc):
    adresse = adresse_de_page(url, sc)
    for essai in (1, 2):
        # Le document du banc n'est pas servi du cache : une lecture ratée sous charge se rejoue une fois.
        try:
            page.goto(adresse, wait_until="load", timeout=20000)
            break
        except (DelaiDepasse, ErreurPlaywright):
            if essai == 2:
                raise
            page.wait_for_timeout(500)
    page.evaluate(JS_OUTILS)
    attendre(page, calme=250, maximum=8000)


def attendre(page, calme=100, maximum=4000):
    """Attend la page posée ; une page pas prête (vide ou en « Chargement ») est attendue une fois de plus."""
    if not page.evaluate(JS_ATTENTE, {"calme": calme, "max": maximum}):
        page.evaluate(JS_ATTENTE, {"calme": 300, "max": 8000})


def aller_a(page, adresse):
    page.evaluate("(a) => { location.hash = a; }", adresse)
    page.wait_for_timeout(60)


def motif_du_clic(erreur):
    """Pourquoi un clic n'aboutit pas : l'élément qui recouvre la cible quand Playwright le nomme."""
    lignes = str(erreur).strip().splitlines()
    for ligne in lignes:
        if "intercepts pointer events" in ligne:
            return re.sub(r"\s+", " ", ligne).strip(" -")[:170]
    return lignes[0][:140] if lignes else "échec du clic"


def cliquer(page, res, vue, selecteur, quoi):
    """Vrai clic de souris (avec contrôle de recouvrement). Faux, et un échec, s'il n'aboutit pas."""
    try:
        page.locator(selecteur).first.click(timeout=4000)
        page.wait_for_timeout(60)
        return True
    except (DelaiDepasse, ErreurPlaywright) as e:
        res.echec("clic impossible", vue, "%s : %s" % (quoi, motif_du_clic(e)))
        return False


# --------------------------------------------------------------------------------------
# Une vue
# --------------------------------------------------------------------------------------


def verifier_vue(page, res, sc, titre, options):
    """Attend la page, la mesure, range échecs et avertissements."""
    attendre(page)
    res.vues += 1
    o = {"passe": sc.passe, "espace": sc.espace, "coquille": res.coquille, "seuilTelephone": SEUIL_TELEPHONE,
         "exception": EXCEPTION_ADMISE, "habillage": sc.habillage}
    avant = len(res.echecs)
    try:
        m = page.evaluate("(o) => window.__verifNav.mesurer(o)", o)
    except ErreurPlaywright as e:
        res.echec("mesure impossible", "%s/%s" % (sc.nom, titre), str(e).strip().splitlines()[0][:160])
        return
    vue = "%s/%s" % (sc.nom, titre)
    res.derniere_vue = vue
    for type_, detail in m["echecs"]:
        res.echec(type_, vue, detail)
    for type_, detail in m["avert"]:
        res.avertir(type_, detail, vue, detail)
    vider_console(res, vue)
    jouer_graphiques_de_notes(page, res, vue, o)
    jouer_sections_repliees(page, res, vue, o)
    if options.get("captures") and len(res.echecs) > avant:
        dossier = pathlib.Path(options["captures"])
        dossier.mkdir(parents=True, exist_ok=True)
        try:
            page.screenshot(path=str(dossier / (re.sub(r"[^A-Za-z0-9@._-]+", "_", vue) + ".png")))
        except ErreurPlaywright:
            pass


def jouer_graphiques_de_notes(page, res, vue, o):
    """Les graphes de Notes sont les trois onglets d'une même section (Par stagiaire, Par thème, Distribution) : la vue mesurée n'en montre
    qu'un. Les autres sont ouverts un à un et mesurés comme toute vue (défilement de côté, note en rouge), puis l'onglet d'avant est rouvert :
    la page reste comme on l'a trouvée."""
    onglets = page.evaluate("() => [...document.querySelectorAll('#view .chart-tab')].map((b) => [b.textContent.trim(), b.classList.contains('active')])")
    if len(onglets) < 2:
        return
    actif = next((nom for nom, allume in onglets if allume), onglets[0][0])
    for nom, allume in onglets:
        if allume:
            continue
        titre = "%s/graphique %s" % (vue, nom)
        try:
            page.locator("#view .chart-tab", has_text=nom).first.click(timeout=4000)
            page.wait_for_timeout(60)
            res.vues += 1
            m = page.evaluate("(o) => window.__verifNav.mesurer(o)", o)
        except (DelaiDepasse, ErreurPlaywright) as e:
            res.echec("clic impossible", titre, "onglet de graphique « %s » : %s" % (nom, motif_du_clic(e)))
            continue
        for type_, detail in m["echecs"]:
            res.echec(type_, titre, detail)
        vider_console(res, titre)
    try:
        page.locator("#view .chart-tab", has_text=actif).first.click(timeout=4000)
        page.wait_for_timeout(60)
    except (DelaiDepasse, ErreurPlaywright) as e:
        res.echec("clic impossible", vue, "onglet de graphique « %s » : %s" % (actif, motif_du_clic(e)))


def jouer_sections_repliees(page, res, vue, o):
    """Le tableau de bord du centre cache un tableau (« Tous les thèmes ») et des textes dans des sections repliées : elles sont ouvertes le
    temps d'une mesure (défilement de côté, tableaux en listes), puis refermées."""
    ouvertes = page.evaluate("""() => { const ds = [...document.querySelectorAll('#view .centre details:not([open])')];
        ds.forEach((d) => { d.open = true; d.setAttribute('data-vn-ouvert', '1'); }); return ds.length; }""")
    if not ouvertes:
        return
    titre = "%s/sections dépliées" % vue
    try:
        page.wait_for_timeout(120)
        res.vues += 1
        m = page.evaluate("(o) => window.__verifNav.mesurer(o)", o)
    finally:
        page.evaluate("() => document.querySelectorAll('#view .centre details[data-vn-ouvert]').forEach((d) => { d.open = false; d.removeAttribute('data-vn-ouvert'); })")
    for type_, detail in m["echecs"]:
        res.echec(type_, titre, detail)
    vider_console(res, titre)


def vider_console(res, vue):
    for message in res.console:
        cle = message[:200]
        if cle not in res.deja_vues:
            res.deja_vues.add(cle)
            res.echec("erreur de console", vue, cle)
    res.console.clear()


def route_courante(page):
    return page.evaluate("() => (location.hash || '').replace(/^#\\//, '').split('/')[0]")


def plancher_sous_onglets(route, sc, res):
    """Nombre de sous-onglets (ou de lignes du sommaire sur téléphone) que la page montre au moins, nouvelle
    navigation allumée (Task 3). 0 : rien n'est attendu. Au départ (`?modules=depart`), un stagiaire ne voit
    que les modules ouverts : Planning perd Priorités, Cours se réduit à Documents et Mon espace à Passages,
    deux pages sans barre ; un formateur voit tout, les modules fermés repérés."""
    depart = sc.modules == "depart" and sc.espace == "stagiaire"
    if route == "planning":
        return 2 if depart else 3      # Semaine, Dates clés, Priorités
    if route == "themes":
        # Stagiaire : Thèmes, Compétences, QCM, Documents ; équipe : Thèmes, Compétences, Signalements, Propositions IA, Documents (lot 2B, tâche 6).
        return 0 if depart else (4 if sc.espace == "stagiaire" else 5)
    if route == "mon-suivi" and res.profil_stagiaire:
        return 0 if depart else 5      # Résultats, Passages, EPCF, Livret EPCF, Dossier pro (lot 2B, tâche 7)
    if route == "stagiaires":
        return 2                       # Stagiaires, Élèves bénévoles (équipe seulement, lot 2A)
    return 0


def sous_vues(page, res, sc, route, options):
    """Chaque sous-onglet de la première barre de la page, ou chaque ligne du sommaire de Mon
    espace sur téléphone (la partie s'ouvre alors par son adresse). Nouvelle navigation allumée, une page
    qui devrait en montrer et n'en montre pas assez (barre perdue) échoue."""
    libelles = page.evaluate("""() => {
        const b = document.querySelector('#view .subtabs-bar');
        if (!b) return [];
        return [...b.querySelectorAll(':scope > .subtab')].map((x) => (x.childNodes[0] ? x.childNodes[0].textContent : x.textContent).trim());
    }""")
    if sc.passe == "allume":
        attendu = plancher_sous_onglets(route, sc, res)
        nb = len(libelles) or page.evaluate("() => document.querySelectorAll('#view nav.fiche-sommaire a.fiche-ligne').length")
        if nb < attendu:
            res.echec("sous-onglets manquants", "%s/%s" % (sc.nom, route), "#/%s montre %d sous-onglet(s) ou ligne(s) de sommaire, au moins %d attendu(s)" % (route, nb, attendu))
        if route == "stagiaires" and libelles[:2] != SOUS_ONGLETS_STAGIAIRES:
            res.echec("sous-onglets de Stagiaires", "%s/%s" % (sc.nom, route), "la page Stagiaires montre « %s », attendu « %s »" % (" », « ".join(libelles), " », « ".join(SOUS_ONGLETS_STAGIAIRES)))
        # « Saisir » (lot C de l'audit du 09/11) : la saisie thème par thème, pour qui écrit des notes ; la direction lit sans écrire.
        attendu_notes = ["Matrice", "EPCF"] if sc.compte == "direction" else ["Saisir", "Matrice", "EPCF"]
        if route == "notes" and sc.espace == "equipe" and libelles != attendu_notes:
            res.echec("sous-onglets de Notes", "%s/%s" % (sc.nom, route), "la page Notes de l'équipe montre « %s », attendu « %s »" % (" », « ".join(libelles), " », « ".join(attendu_notes)))
    for i, libelle in enumerate(libelles):
        titre = "%s/%s" % (route, libelle)
        try:
            page.locator("#view .subtabs-bar").first.locator(":scope > .subtab").nth(i).click(timeout=4000)
            page.wait_for_timeout(60)
        except (DelaiDepasse, ErreurPlaywright) as e:
            res.echec("clic impossible", "%s/%s" % (sc.nom, titre), "sous-onglet « %s » : %s" % (libelle, motif_du_clic(e)))
            continue
        if sc.passe == "allume" and res.coquille:
            verifier_sous_page(page, res, sc, route, libelle, options)
        verifier_vue(page, res, sc, titre, options)
    adresses = page.evaluate("() => [...document.querySelectorAll('#view nav.fiche-sommaire a.fiche-ligne')].map((a) => a.getAttribute('href'))")
    base = page.evaluate("() => location.hash")
    for adresse in adresses:
        aller_a(page, adresse)
        verifier_vue(page, res, sc, "%s/%s" % (route, adresse.rsplit("/", 1)[-1]), options)
    if adresses:
        aller_a(page, base)


# --------------------------------------------------------------------------------------
# Entrées de la coquille et menus
# --------------------------------------------------------------------------------------


def chercher_lien(page, entree):
    libelle = entree.get("libelle") or entree["route"]
    return page.evaluate("(a) => window.__verifNav.chercherLien(a[0], a[1], a[2])", [entree["route"], libelle, entree.get("court") or libelle])


def ouvrir_entree(page, res, sc, entree):
    """Ouvre une entrée comme la personne le ferait : un clic dans la coquille, deux par « Plus »
    sur téléphone quand l'entrée y est rangée. Sans coquille, par l'adresse."""
    route = entree["route"]
    vue = "%s/%s" % (sc.nom, route)
    if not res.coquille:
        aller_a(page, "#/" + route)
        return
    libelle = entree.get("libelle") or route
    infos = chercher_lien(page, entree)
    clics = 1
    if not infos["visibles"] and sc.largeur < SEUIL_TELEPHONE and page.evaluate("() => window.__verifNav.chercherPlus()"):
        if not cliquer(page, res, vue, '[data-vn-cible="1"]', "bouton « Plus »"):
            aller_a(page, "#/" + route)   # l'échec du clic sur « Plus » est déjà noté : pas de second échec pour la même cause
            return
        page.wait_for_timeout(250)
        infos = chercher_lien(page, entree)
        clics = 2
    if not infos["visibles"]:
        res.echec("entrée introuvable", vue, "« %s » (#/%s) n'est cliquable ni dans la coquille ni derrière « Plus » (%d lien(s) dans la coquille, aucun visible)"
                  % (libelle, route, infos["total"]))
        aller_a(page, "#/" + route)
        return
    if not cliquer(page, res, vue, '[data-vn-cible="1"]', "entrée « %s »" % libelle):
        aller_a(page, "#/" + route)
        return
    res.clics[clics] += 1
    if clics == 2:
        attendre(page, calme=150)
        if page.evaluate("() => window.__verifNav.popupsVisibles()"):
            # Le tiroir « Plus » doit se refermer quand on choisit une entrée.
            res.avertir("tiroir resté ouvert", "le tiroir reste ouvert après le choix d'une entrée", vue, "le tiroir reste ouvert après le choix de « %s »" % libelle)
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)


def verifier_menus(page, res, sc, options):
    """Chaque ouvreur de la coquille : sa fenêtre s'ouvre, tient dans l'écran, se ferme par Échap."""
    if options.get("sans_menus"):
        return
    ouvreurs = page.evaluate("() => window.__verifNav.ouvreurs()")
    vue = "%s/menus" % sc.nom
    if not ouvreurs:
        res.echec("aucun menu", vue, "aucun bouton de la coquille ne porte aria-haspopup ou data-nav-action : ni compte, ni « Plus »")
        return
    for ouvreur in ouvreurs:
        quoi = "« %s »%s" % (ouvreur["nom"], (" (" + ouvreur["action"] + ")") if ouvreur["action"] else "")
        page.evaluate("(i) => window.__verifNav.marquerPopups(i)", ouvreur["i"])
        if not cliquer(page, res, vue, '[data-vn-i="%d"]' % ouvreur["i"], "ouvreur " + quoi):
            continue
        page.wait_for_timeout(300)
        m = page.evaluate("(o) => window.__verifNav.mesurerPopups(o)", {"seuilTelephone": SEUIL_TELEPHONE})
        if not m["nouveaux"]:
            res.echec("le menu ne s'ouvre pas", vue, "%s n'ouvre aucune fenêtre (role=dialog ou role=menu)" % quoi)
            continue
        for type_, detail in m["echecs"]:
            res.echec(type_, vue, "%s : %s" % (quoi, detail))
        for type_, detail in m["avert"]:
            res.avertir(type_, detail, vue, detail)
        if ouvreur["action"] == "compte":
            verifier_menu_du_compte(page, res, sc)
        elif ouvreur["action"] == "plus":
            verifier_a_traiter(page, res, sc, tiroir=True)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        restes = page.evaluate("() => window.__verifNav.popupsEncoreOuverts()")
        if restes:
            res.echec("Échap ne ferme pas", vue, "%s : %s reste ouvert" % (quoi, ", ".join(restes)))
            cliquer(page, res, vue, '[data-vn-i="%d"]' % ouvreur["i"], "ouvreur " + quoi)   # on le referme
            page.wait_for_timeout(250)
        elif not page.evaluate("() => window.__verifNav.focusSurOuvreur()"):
            res.avertir("focus non rendu", "%s : le focus ne revient pas sur le bouton qui a ouvert la fenêtre" % quoi, vue, "")
        vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Jeu d'un contexte
# --------------------------------------------------------------------------------------


def regles_de_la_page(page, res, sc):
    r = page.evaluate("() => window.__verifNav.regles()")
    if "erreur" in r:
        res.echec("règles illisibles", sc.nom, "impossible de lire les règles de navigation de l'app dans la page (%s) : entrées de repli utilisées" % r["erreur"])
        entrees = [{"id": x, "route": x, "libelle": x, "court": x} for x in ENTREES_REPLI[sc.espace]]
        return {"entrees": entrees, "profilStagiaire": False, "espace": sc.espace, "actif": True, "plus": [], "barre": []}
    return r


def preparer_coquille(page, res, sc, regles):
    """Vérifie l'interrupteur et la présence de la coquille, une fois par contexte."""
    if not regles.get("actif"):
        res.echec("interrupteur", sc.nom, "la nouvelle navigation n'est pas allumée dans ce contexte (navigationV2Active() est faux) : l'allumage du banc a échoué")
    if regles.get("espace") != sc.espace:
        res.echec("espace du banc", sc.nom, "les règles donnent l'espace « %s », le scénario attendait « %s »" % (regles.get("espace"), sc.espace))
    if sc.sans_droits and regles.get("fondateur"):
        res.echec("profil du banc", sc.nom, "le profil « sans droits » est resté fondateur : le semis de is_founder dans le faux Supabase n'a pas pris")
    etat = page.evaluate("() => ({ nav: document.body.dataset.nav || null, espace: document.body.dataset.espace || null, coquilles: document.querySelectorAll('[data-nav-coquille]').length })")
    res.coquille = etat["nav"] == "v2" and etat["coquilles"] > 0
    if not res.coquille:
        res.echec("coquille absente", sc.nom, "body[data-nav] = %s, body[data-espace] = %s, %d élément(s) [data-nav-coquille] : les contrôles de la coquille sont ignorés"
                  % (etat["nav"], etat["espace"], etat["coquilles"]))


def parcourir_entrees(page, res, sc, entrees, options, avec_sous_vues=True):
    for entree in entrees:
        ouvrir_entree(page, res, sc, entree)
        verifier_vue(page, res, sc, entree["route"], options)
        if sc.passe == "allume" and res.coquille:
            if entree["route"] in TITRES_DES_PAGES[sc.espace]:
                verifier_titre_de_page(page, res, sc, entree["route"], entree["libelle"])
            if entree["route"] == "notes" and sc.espace == "equipe":
                verifier_notes_tactile(page, res, sc)
        if avec_sous_vues:
            sous_vues(page, res, sc, entree["route"], options)


# Ruling R26 : les quatre anciennes adresses (liens de l'app, favoris, raccourcis d'écran d'accueil) : la page et le
# sous-onglet que la nouvelle navigation ouvre.
ANCIENNES_ADRESSES = {"calendrier": ("#/planning", "Dates clés"), "dashboard": ("#/planning", "Priorités"),
                      "ressources": ("#/themes", "Documents"), "notes": ("#/mon-suivi/resultats", "Résultats")}
# Sous-onglet allumé de la page : la partie de Mon espace sur téléphone (son titre), sinon le premier sous-onglet actif.
JS_SOUS_ONGLET_ALLUME = """() => {
    const e = document.querySelector('#view h2.fiche-titre') || document.querySelector('#view .subtabs-bar > .subtab.active');
    return e ? (e.childNodes[0] ? e.childNodes[0].textContent : e.textContent).trim() : null;
}"""


def jouer_anciennes_adresses(page, res, sc):
    """Ruling R26 : chaque ancienne adresse est ouverte par son adresse : les deux premières depuis Accueil (« Précédent »
    y ramène après la première), les deux suivantes depuis la page où la précédente a atterri. Nouvelle navigation : elle
    mène à sa nouvelle page, le sous-onglet visé allumé (module fermé, stagiaire au départ : le premier visible, ou aucun
    s'il est seul) ; Notes garde sa page chez l'équipe. « Précédent » quitte la page redirigée sans étape d'historique de
    plus (même mécanisme pour les quatre adresses : vérifié sur la première seulement). Interrupteur éteint : l'adresse
    reste celle d'aujourd'hui."""
    depart = sc.modules == "depart" and sc.espace == "stagiaire"
    aller_a(page, "#/home")
    attendre(page)
    for ancienne, (nouvelle, sous_onglet) in ANCIENNES_ADRESSES.items():
        vue = "%s/ancienne-adresse/%s" % (sc.nom, ancienne)
        if sc.passe == "eteint" or (ancienne == "notes" and sc.espace == "equipe"):
            nouvelle, sous_onglet = "#/" + ancienne, None
        elif depart and ancienne != "calendrier":
            sous_onglet = "Semaine" if ancienne == "dashboard" else None
            if ancienne == "notes":
                nouvelle = "#/mon-suivi/classe"  # Résultats fermé (module des notes) : l'adresse de la redirection reste
        aller_a(page, "#/" + ancienne)
        attendre(page, calme=150)
        res.vues += 1
        adresse, allume = page.evaluate("() => location.hash"), page.evaluate(JS_SOUS_ONGLET_ALLUME)
        if adresse != nouvelle:
            res.echec("ancienne adresse", vue, "#/%s ouvre %s, attendu %s" % (ancienne, adresse, nouvelle))
        elif sous_onglet and allume != sous_onglet:
            res.echec("sous-onglet de l'ancienne adresse", vue, "#/%s allume « %s », attendu « %s »" % (ancienne, allume, sous_onglet))
        if ancienne == "calendrier":
            page.evaluate("() => history.back()")
            try:
                page.wait_for_function("() => location.hash === '#/home'", timeout=2000)
            except DelaiDepasse:
                res.echec("historique après redirection", vue, "« Précédent » depuis %s ne ramène pas à #/home : étape d'historique en trop" % adresse)
            attendre(page, calme=150)
        vider_console(res, vue)


def lundi_et_jour(date_iso):
    """Ce que vise « Aujourd'hui » (todayJumpTarget de js/views/planning.js) : le lundi de la semaine affichée
    et l'index de la carte du jour ; du lundi au vendredi, le jour même, le week-end, le lundi qui suit."""
    d = datetime.date.fromisoformat(date_iso)
    if d.weekday() <= 4:
        return (d - datetime.timedelta(days=d.weekday())).isoformat(), d.weekday()
    return (d + datetime.timedelta(days=7 - d.weekday())).isoformat(), 0


# La semaine affichée (le lundi du champ de date), le sous-onglet allumé et le haut de chaque carte de jour.
JS_SEMAINE_AFFICHEE = """() => {
    const d = document.querySelector('#view .week-bar-nav input[type=date]');
    const s = document.querySelector('#view .subtabs-bar > .subtab.active');
    return { lundi: d ? d.value : null, sousOnglet: s ? (s.childNodes[0] ? s.childNodes[0].textContent : s.textContent).trim() : null,
             cartes: [...document.querySelectorAll('#view .p-day-card')].map((c) => Math.round(c.getBoundingClientRect().top)),
             grille: document.querySelector('#view .wsem') ? Math.round(document.querySelector('#view .wsem').getBoundingClientRect().top) : null,
             repere: [...document.querySelectorAll('#view .wg-day')].findIndex((j) => j.classList.contains('auj')),
             choisi: [...document.querySelectorAll('#view .daystrip button')].findIndex((b) => b.getAttribute('aria-selected') === 'true'),
             grilleVisible: !!document.querySelector('#view .wgrid') && document.querySelector('#view .wgrid').getClientRects().length > 0,
             hauteur: innerHeight };
}"""


def verifier_aujourdhui(page, res, sc):
    """Ruling R29, puis audit du 09/11 (lot B) : sous la nouvelle navigation, le geste « Aujourd'hui » de l'ancienne barre du haut
    est le bouton « Revenir à aujourd'hui » de la barre de la semaine, de 44 px, absent de la semaine du jour. Cliqué sur une autre
    semaine, il affiche la semaine du jour et amène la carte du jour en haut de l'écran."""
    vue = "%s/planning/aujourdhui" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    semaine = page.locator("#view .subtabs-bar > .subtab", has_text="Semaine")
    if semaine.count():
        semaine.first.click()
        attendre(page)
    res.vues += 1
    # Audit du 09/11, lot B : le bouton s'appelle « Revenir à aujourd'hui » (« Aujourd'hui » est le nom de l'onglet d'accueil de l'équipe)
    # et ne se montre que hors de la semaine du jour, où la bande et la barre des jours repèrent déjà aujourd'hui.
    bouton = page.get_by_role("button", name="Revenir à aujourd'hui", exact=True)
    lundi, jour = lundi_et_jour(DATE_DU_BANC)
    if page.evaluate(JS_SEMAINE_AFFICHEE)["lundi"] == lundi:
        if bouton.count() != 0:
            res.echec("bouton « Revenir à aujourd'hui »", vue, "la semaine du jour montre %d bouton(s) « Revenir à aujourd'hui », 0 attendu" % bouton.count())
        page.get_by_role("button", name="Semaine précédente").click()
        attendre(page)
    if bouton.count() != 1:
        res.echec("bouton « Revenir à aujourd'hui »", vue, "une autre semaine montre %d bouton(s) « Revenir à aujourd'hui », 1 attendu" % bouton.count())
        return
    boite = bouton.bounding_box()
    if not boite or boite["width"] < 43.5 or boite["height"] < 43.5:
        res.echec("bouton « Revenir à aujourd'hui »", vue, "zone à toucher de %s px (44 px au moins)" % ("%dx%d" % (boite["width"], boite["height"]) if boite else "0x0"))
    bouton.click()
    page.wait_for_timeout(100)
    attendre(page)
    page.wait_for_timeout(400)   # le saut vers le jour : défilement fluide, puis direct après 250 ms (scrollToDay)
    m = page.evaluate(JS_SEMAINE_AFFICHEE)
    # En grille (nouvelle navigation, lot 2B, tâche 5), la grille tient la place des cartes : son haut est amené à l'écran et le jour du jour est repéré
    # (la colonne sur ordinateur, le jour choisi sur téléphone).
    if m["grille"] is not None:
        haut = m["grille"]
        repere = m["repere"] if m["grilleVisible"] else m["choisi"]
        if repere != jour:
            res.echec("bouton « Aujourd'hui »", vue, "le jour du jour n'est pas repéré dans la grille (repère %s, attendu %s)" % (repere, jour))
    else:
        haut = m["cartes"][jour] if len(m["cartes"]) > jour else None
    if route_courante(page) != "planning" or m["lundi"] != lundi or m["sousOnglet"] not in (None, "Semaine"):
        res.echec("bouton « Aujourd'hui »", vue, "après le clic : #/%s, semaine du %s, sous-onglet %s ; attendu Planning > Semaine, semaine du %s"
                  % (route_courante(page), m["lundi"], m["sousOnglet"], lundi))
    elif haut is None or not 0 <= haut <= m["hauteur"] / 2:
        res.echec("bouton « Aujourd'hui »", vue, "la carte du jour n'est pas amenée en haut de l'écran (son haut à y %s, écran de %d px)" % (haut, m["hauteur"]))
    vider_console(res, vue)


def verifier_retour_arriere(page, res, sc):
    """Relecture finale, mineur 3 : une fenêtre de la coquille ouverte (menu du compte ; tiroir « Plus » sur téléphone)
    se ferme quand « Précédent », le geste retour du téléphone, change l'adresse sous elle, le focus restant dans la
    coquille ; sur téléphone, son « Fermer » la ferme aussi."""
    vue = "%s/menus/retour-arriere" % sc.nom
    res.vues += 1
    for action in ("compte", "plus"):
        ouvreur = '[data-nav-coquille] [data-nav-action="%s"]:visible' % action
        if not page.locator(ouvreur).count():
            continue
        aller_a(page, "#/planning")
        aller_a(page, "#/home")
        attendre(page)
        if not cliquer(page, res, vue, ouvreur, "bouton « %s »" % action):
            continue
        page.wait_for_timeout(250)
        if not page.evaluate("() => window.__verifNav.popupsVisibles()"):
            res.echec("le menu ne s'ouvre pas", vue, "le bouton « %s » n'ouvre aucune fenêtre" % action)
            continue
        page.evaluate("() => history.back()")
        try:
            page.wait_for_function("() => location.hash === '#/planning'", timeout=2000)
        except DelaiDepasse:
            res.echec("historique", vue, "« Précédent » depuis #/home, fenêtre de « %s » ouverte, ne ramène pas à #/planning" % action)
        page.wait_for_timeout(250)
        if page.evaluate("() => window.__verifNav.popupsVisibles()"):
            res.echec("fenêtre ouverte après un retour arrière", vue, "la fenêtre de « %s » reste ouverte quand « Précédent » change l'adresse" % action)
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)
        else:
            focus_garde(page, res, vue, "fenêtre de « %s » fermée par « Précédent »" % action)
        if sc.largeur < SEUIL_TELEPHONE and cliquer(page, res, vue, ouvreur, "bouton « %s »" % action):
            page.wait_for_timeout(250)
            if cliquer(page, res, vue, '[data-nav-coquille] [role="dialog"] button:text-is("Fermer")', "« Fermer » de la fenêtre de « %s »" % action):
                page.wait_for_timeout(250)
                if page.evaluate("() => window.__verifNav.popupsVisibles()"):
                    res.echec("« Fermer » ne ferme pas", vue, "la fenêtre de « %s » reste ouverte après « Fermer »" % action)
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(250)
                else:
                    focus_garde(page, res, vue, "fenêtre de « %s » fermée par « Fermer »" % action)
            else:
                page.keyboard.press("Escape")
                page.wait_for_timeout(250)
    vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Réglages, Mes préférences, bouton et menu du compte (lot 2A)
# --------------------------------------------------------------------------------------

# Sections de Réglages (#/config) sous la nouvelle navigation, dans l'ordre : la promo seule. Émargement et Nouvelle
# navigation sont les interrupteurs du fondateur (js/emargement-etat.js, js/nav-etat.js). Mes préférences (#/preferences)
# n'en montre aucune : seulement « Mes préférences » (si un réglage est à montrer) et « Informations ».
SECTIONS_REGLAGES = ("Ce que voient les stagiaires", "Promo", "Accès et invitations", "Émargement", "Nouvelle navigation",
                     "Données personnelles")
SECTIONS_DU_FONDATEUR = ("Émargement", "Nouvelle navigation")
SECTIONS_PREFERENCES = ("Apparence", "Dans les notes de la classe", "Informations")
# Le sous-titre de Mes préférences : la page a toujours un réglage à soi depuis le lot 3 (Apparence, pour tous les rôles), l'anonymat en plus pour qui a une
# fiche de stagiaire ; il ne dit donc plus « Les informations sur l'application. » seules.
SOUS_TITRE_PREFERENCES = "Ce qui ne concerne que toi, et les informations sur l'application."
# Ce que ces pages ne disent plus : « whitelist », « mdp » et l'abréviation « admin » (le mot « administrateur » reste permis).
MOTS_BANNIS = re.compile(r"whitelist|mdp|\badmins?\b", re.IGNORECASE)


def verifier_bouton_du_compte(page, res, sc, moment):
    """Le bouton du compte ne montre aucun chiffre : tant que des Nouveautés ne sont pas lues, un point sans texte au coin
    de l'avatar (le nombre est sur la ligne « Nouveautés » du menu), et son nom dit toujours combien ; à zéro, ni point ni
    mention dans le nom. Joué deux fois : à l'ouverture (des non lues au banc), puis la rubrique Nouveautés ouverte (tout lu)."""
    vue = "%s/bouton-du-compte/%s" % (sc.nom, moment)
    res.vues += 1
    b = page.evaluate("() => window.__verifNav.boutonDuCompte()")
    if b is None:
        res.echec("bouton du compte", vue, "aucun bouton du compte affiché dans la coquille")
        return
    if re.search(r"\d", b["texte"]):
        res.echec("bouton du compte", vue, "le bouton montre un chiffre : « %s »" % b["texte"])
    if b["pointTexte"]:
        res.echec("bouton du compte", vue, "le point porte du texte (« %s ») : il reste sans chiffre" % b["pointTexte"])
    if b["pastille"]:
        if not b["point"]:
            res.echec("bouton du compte", vue, "des nouveautés ne sont pas lues (%s), le bouton n'a pas de point" % b["pastille"])
        elif min(b["pointTaille"]) < 8:
            res.echec("bouton du compte", vue, "le point mesure %dx%d px : trop petit pour se voir" % tuple(b["pointTaille"]))
        # Un repère sans texte tient 3:1 contre son liseré et contre le fond derrière lui (WCAG 1.4.11) : sur la barre sombre de l'équipe, son vert d'origine
        # (--accent) n'en tenait que 2,9 contre le liseré de la couleur de la barre.
        # Lot 3, tâche 10 : contre le fond, il suffit qu'un liseré plein le cerne (le blanc des repères rouges de « Couleurs ECF »).
        c = b["pointContraste"]
        for contre, valeur in (("son liseré", c and c["lisere"]), ("le fond derrière lui", c and (None if c.get("detache") else c["fond"]))):
            if valeur is not None and valeur < 3:
                res.echec("contraste du point du compte", vue, "le point (%s) ne tient que %.2f:1 contre %s, 3:1 au moins pour un repère" % (c["couleur"], valeur, contre))
        if "%s nouveauté" % b["pastille"] not in b["nom"]:
            res.echec("bouton du compte", vue, "le nom du bouton ne dit pas combien de nouveautés ne sont pas lues (%s) : « %s »" % (b["pastille"], b["nom"]))
    else:
        if b["point"]:
            res.echec("bouton du compte", vue, "le bouton a un point alors que toutes les nouveautés sont lues")
        if "non lue" in b["nom"]:
            res.echec("bouton du compte", vue, "le nom du bouton parle de nouveautés non lues alors que toutes sont lues : « %s »" % b["nom"])
    vider_console(res, vue)


def verifier_menu_du_compte(page, res, sc, moment=None):
    """Menu du compte ouvert : « Mes préférences » (#/preferences) pour tous les rôles, plus de ligne « Réglages » (celle de la
    promo est une entrée de la barre de l'équipe) ; le nombre des Nouveautés non lues, que le bouton ne montre plus, est sur la
    ligne « Nouveautés » ; sans non lue, la ligne n'en porte aucun. `moment` : « a-l-ouverture » quand le menu est ouvert avant la
    rubrique Nouveautés (verifier_menu_du_compte_a_l_ouverture) : le banc a alors des non lues, et le nombre est éprouvé pour de bon."""
    vue = "%s/menus/menu-du-compte%s" % (sc.nom, ("/" + moment) if moment else "")
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.menuDuCompte()")
    if m is None:
        res.echec("menu du compte", vue, "la fenêtre du menu du compte est introuvable")
        return
    if moment == "a-l-ouverture" and not m["pastille"]:
        res.echec("menu du compte", vue, "le banc n'a aucune nouveauté non lue à l'ouverture : le nombre de la ligne « Nouveautés » ne serait pas éprouvé")
    lignes = {l["libelle"]: l for l in m["lignes"]}
    if "Mes préférences" not in lignes:
        res.echec("menu du compte", vue, "la ligne « Mes préférences » manque (lignes : %s)" % ", ".join(lignes))
    elif lignes["Mes préférences"]["href"] != "#/preferences":
        res.echec("menu du compte", vue, "« Mes préférences » mène à %s, attendu #/preferences" % lignes["Mes préférences"]["href"])
    if "Réglages" in lignes:
        res.echec("menu du compte", vue, "le menu garde une ligne « Réglages » : elle n'est plus qu'une entrée de la barre de l'équipe")
    # Les contacts du centre (lot 2A, tâche 1) : une ligne qui mène à #/ressources (la redirection du lot 1 l'envoie à Cours et QCM > Documents), entre
    # « Nouveautés » et « Mes préférences ». Le banc ouvre le module Ressources dans tous les scénarios de ce menu (jouer_ressources_fermees joue l'autre cas).
    ordre = list(lignes)
    if "Contacts du centre" not in lignes:
        res.echec("menu du compte", vue, "la ligne « Contacts du centre » manque (lignes : %s)" % ", ".join(ordre))
    else:
        if lignes["Contacts du centre"]["href"] != "#/ressources":
            res.echec("menu du compte", vue, "« Contacts du centre » mène à %s, attendu #/ressources" % lignes["Contacts du centre"]["href"])
        voisines = [x for x in ordre if x in ("Nouveautés", "Contacts du centre", "Mes préférences")]
        if voisines != ["Nouveautés", "Contacts du centre", "Mes préférences"] or ordre.index("Contacts du centre") != ordre.index("Nouveautés") + 1 \
                or ordre.index("Mes préférences") != ordre.index("Contacts du centre") + 1:
            res.echec("menu du compte", vue, "« Contacts du centre » n'est pas entre « Nouveautés » et « Mes préférences » (lignes : %s)" % ", ".join(ordre))
    attendu = m["pastille"] or None
    if "Nouveautés" not in lignes:
        res.echec("menu du compte", vue, "la ligne « Nouveautés » manque (lignes : %s)" % ", ".join(lignes))
    elif lignes["Nouveautés"]["nombre"] != attendu:
        res.echec("menu du compte", vue, "la ligne « Nouveautés » porte %s, l'app compte %s non lue(s)" % (lignes["Nouveautés"]["nombre"], attendu))
    # Lot 3, tâche 11 : Apparence, juste sous la tête du menu, pour tous les rôles (formateur sans fiche compris).
    g = verifier_apparence(page, res, sc, vue, "menu")
    if g is not None and not g["apresTete"]:
        res.echec("apparence", vue, "menu du compte : le groupe « Apparence » n'est pas juste sous la tête du menu (nom, rôle, promo)")
    vider_console(res, vue)


def verifier_menu_du_compte_a_l_ouverture(page, res, sc):
    """Le menu du compte ouvert une fois à l'ouverture de l'app, avant la rubrique Nouveautés (lot 2A, tâche 6) : l'ouverture de cette rubrique marque tout
    comme lu, et `verifier_menus` ne joue le menu qu'après elle, donc sans aucune nouveauté non lue : le nombre de la ligne « Nouveautés » n'y était jamais
    éprouvé. Ici le banc a des non lues, et la ligne doit en porter le nombre ; le menu se referme par Échap."""
    vue = "%s/menus/menu-du-compte/a-l-ouverture" % sc.nom
    if not cliquer(page, res, vue, '[data-nav-coquille] button[data-nav-action="compte"]:visible', "bouton du compte"):
        return
    page.wait_for_timeout(300)
    verifier_menu_du_compte(page, res, sc, "a-l-ouverture")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Apparence : choisir l'habillage (lot 3, tâche 11)
# --------------------------------------------------------------------------------------

LIBELLES_HABILLAGES = {"ecsr": "ECSR Promo", "ecf": "Couleurs ECF"}
LEGENDES_HABILLAGES = {"ecsr": "d'origine", "ecf": "du réseau ECF"}   # seconde ligne de chaque pastille (lot 3, tâche 13b)
MESSAGES_HABILLAGES = {"ecsr": "Habillage ECSR Promo appliqué", "ecf": "Couleurs ECF appliquées"}
SEL_PASTILLE = {"menu": '[data-nav-coquille="compte"] .habillage-pastille[data-habillage="%s"]', "page": '#view .habillage-pastille[data-habillage="%s"]'}
QUOI_APPARENCE = {"menu": "menu du compte", "page": "page"}


def lire_apparence(page, lieu):
    return page.evaluate("(l) => window.__verifNav.apparence(l)", lieu)


def verifier_apparence(page, res, sc, vue, lieu, a=None):
    """Le choix de l'habillage dans `lieu` (« menu » : le menu du compte ouvert ; « page » : Mes préférences, Paramètres) : un seul groupe (role=group) nommé
    « Apparence » par son titre, deux pastilles, des boutons « ECSR Promo » puis « Couleurs ECF » (button[type=button].habillage-pastille[data-habillage]),
    chacune avec aria-pressed, une seule pressée : celle de html[data-skin]. 44 px de haut au moins sur téléphone. Rend le groupe, ou None s'il manque."""
    a = a or lire_apparence(page, lieu)
    quoi = QUOI_APPARENCE[lieu]
    if not a["groupes"]:
        res.echec("apparence", vue, "%s : aucun groupe « Apparence » (role=group nommé par son titre)%s" % (quoi, "" if a["racine"] else ", fenêtre introuvable"))
        return None
    if len(a["groupes"]) > 1:
        res.echec("apparence", vue, "%s : %d groupes « Apparence », un seul attendu" % (quoi, len(a["groupes"])))
    g = a["groupes"][0]
    vus = [(p["habillage"], p["libelle"]) for p in g["pastilles"]]
    if vus != [(n, LIBELLES_HABILLAGES[n]) for n in ("ecsr", "ecf")]:
        res.echec("apparence", vue, "%s : pastilles %s, attendu « ECSR Promo » (ecsr) puis « Couleurs ECF » (ecf)" % (quoi, vus))
    for p in g["pastilles"]:
        if p["legende"] != LEGENDES_HABILLAGES.get(p["habillage"]):
            res.echec("apparence", vue, "%s : la légende de « %s » est « %s », attendu « %s »" % (quoi, p["libelle"], p["legende"], LEGENDES_HABILLAGES.get(p["habillage"])))
        if p["type"] != "button" or not p["classe"]:
            res.echec("apparence", vue, "%s : « %s » n'est pas un button[type=button].habillage-pastille" % (quoi, p["libelle"]))
        if p["presse"] not in ("true", "false"):
            res.echec("apparence", vue, "%s : « %s » n'a pas d'aria-pressed (« %s »)" % (quoi, p["libelle"], p["presse"]))
        if sc.largeur < SEUIL_TELEPHONE and p["h"] < 44:
            res.echec("zone à toucher (apparence)", vue, "%s : « %s » mesure %.1f px de haut, 44 au moins sur téléphone" % (quoi, p["libelle"], p["h"]))
    pressees = [p["habillage"] for p in g["pastilles"] if p["presse"] == "true"]
    if pressees != [a["skin"]]:
        res.echec("apparence", vue, "%s : pastille(s) pressée(s) %s, attendu la seule de l'habillage de la page (« %s »)" % (quoi, pressees or "aucune", a["skin"]))
    return g


def choisir_habillage(page, res, vue, lieu, cible):
    """Touche la pastille `cible` dans `lieu`, après avoir marqué la page (la marque disparaît si elle se recharge). Rend ce que montre alors l'apparence."""
    page.evaluate("() => { window.__vnSansRechargement = 1; }")
    if not cliquer(page, res, vue, SEL_PASTILLE[lieu] % cible, "pastille « %s » (%s)" % (LIBELLES_HABILLAGES[cible], QUOI_APPARENCE[lieu])):
        return None
    page.wait_for_timeout(150)
    return lire_apparence(page, lieu)


def verifier_choix(page, res, sc, vue, lieu, cible, a, fenetre_ouverte=False):
    """Après un toucher sur la pastille `cible` : la page porte l'habillage sans s'être rechargée, la pastille est la seule pressée et garde le focus, le
    message du bas le dit, sans erreur ; dans le menu du compte, la fenêtre reste ouverte."""
    if a is None:
        return
    quoi = QUOI_APPARENCE[lieu]
    if a["skin"] != cible:
        res.echec("choix de l'habillage", vue, "%s : « %s » touché, html[data-skin] vaut « %s »" % (quoi, LIBELLES_HABILLAGES[cible], a["skin"]))
    if not a["sansRechargement"]:
        res.echec("choix de l'habillage", vue, "%s : « %s » touché, la page s'est rechargée" % (quoi, LIBELLES_HABILLAGES[cible]))
    if fenetre_ouverte and not a["racine"]:
        res.echec("choix de l'habillage", vue, "« %s » touché, le menu du compte s'est fermé : il reste ouvert" % LIBELLES_HABILLAGES[cible])
    g = verifier_apparence(page, res, sc, vue, lieu, a)
    if g is not None:
        touchee = next((p for p in g["pastilles"] if p["habillage"] == cible), None)
        if touchee is not None and not touchee["focus"]:
            res.echec("choix de l'habillage", vue, "%s : « %s » touché, le focus a quitté la pastille" % (quoi, LIBELLES_HABILLAGES[cible]))
    if a["toast"] is None or a["toast"]["texte"] != MESSAGES_HABILLAGES[cible]:
        res.echec("choix de l'habillage", vue, "%s : le message du bas dit %s, attendu « %s »" % (quoi, a["toast"] and "« %s »" % a["toast"]["texte"], MESSAGES_HABILLAGES[cible]))
    elif a["toast"]["erreur"]:
        res.echec("erreur visible", vue, "%s : le message « %s » s'affiche comme une erreur" % (quoi, a["toast"]["texte"]))
    verifier_aucune_erreur_visible(page, res, vue)


def recharger_la_page(page):
    page.reload(wait_until="load")
    page.evaluate(JS_OUTILS)
    attendre(page, calme=250, maximum=8000)


def attendre_habillage(page, nom, a_envoyer=None):
    """L'habillage `nom` posé et l'appareil qui le retient (le démarrage écrit l'appareil après l'avoir appliqué, puis retire « à envoyer » une fois
    l'envoi revenu) ; `a_envoyer` (vrai, faux) : attend aussi cet état. Sans délai fixe ; au bout de 4 s, le contrôle qui suit dit ce qui est là."""
    try:
        page.wait_for_function("""([n, cle, envoi]) => { if (document.documentElement.dataset.skin !== n) return false;
            try { const a = JSON.parse(localStorage.getItem(cle)); return !!a && a.nom === n && (envoi === null || a.aEnvoyer === envoi); }
            catch (e) { return false; } }""", arg=[nom, CLE_HABILLAGE, a_envoyer], timeout=4000)
    except (DelaiDepasse, ErreurPlaywright):
        pass


def jouer_choix_d_habillage(page, res, sc, panne=False):
    """Choisir l'habillage, nouvelle navigation (lot 3, tâche 11). Dans le menu du compte, la pastille de l'autre habillage (« Couleurs ECF » depuis le
    défaut, « ECSR Promo » depuis ECF) : l'habillage change sans recharger, le menu reste ouvert et le focus sur la pastille ; rechargée, la page le garde,
    l'appareil le retient comme un choix (« à envoyer » tant que le compte ne l'a pas) ; Mes préférences le montre pressé ; une pastille de Mes préférences
    ramène l'habillage de départ, qui tient lui aussi au rechargement. `panne` : l'enregistrement sur le compte échoue (`?habillage_panne=1`) : même
    résultat, aucune erreur visible. Le banc est rechargé : joué en dernier."""
    depart = sc.habillage
    cible = "ecsr" if depart == "ecf" else "ecf"
    vue = "%s/apparence/choix%s" % (sc.nom, "-en-panne" if panne else "")
    res.vues += 1
    if panne:
        recharger_au_banc(page, "#/home", habillage_panne="1")
    else:
        aller_a(page, "#/home")
        attendre(page, calme=150)
    attendre_habillage(page, depart)
    if not cliquer(page, res, vue, '[data-nav-coquille] button[data-nav-action="compte"]:visible', "bouton du compte"):
        return
    page.wait_for_timeout(300)
    verifier_choix(page, res, sc, vue, "menu", cible, choisir_habillage(page, res, vue, "menu", cible), fenetre_ouverte=True)
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)
    vider_console(res, vue)
    # Rechargée : le choix tient, il est retenu comme un choix de la personne, et Mes préférences le montre pressé.
    for etape, nom, lieu_retour in (("rechargement", cible, "page"), ("retour", depart, None)):
        vue_etape = "%s/%s" % (vue, etape)
        res.vues += 1
        recharger_la_page(page)
        attendre_habillage(page, nom, panne)
        a = page.evaluate("(cle) => { try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; } }", CLE_HABILLAGE) or {}
        if page.evaluate("() => document.documentElement.dataset.skin || null") != nom:
            res.echec("choix de l'habillage", vue_etape, "rechargée, la page porte « %s », attendu « %s » (le choix fait avant)"
                      % (page.evaluate("() => document.documentElement.dataset.skin || null"), nom))
        if a.get("nom") != nom or a.get("choisi") is not True or a.get("aEnvoyer") is not panne:
            res.echec("choix de l'habillage", vue_etape, "l'appareil retient %s : attendu « %s », choisi, %s" % (
                json.dumps(a), nom, "encore à envoyer (le compte a refusé)" if panne else "plus rien à envoyer"))
        aller_a(page, "#/preferences")
        attendre(page, calme=150)
        verifier_apparence(page, res, sc, vue_etape, "page")
        if lieu_retour:
            # Le retour par Mes préférences : la pastille de l'habillage de départ.
            verifier_choix(page, res, sc, vue_etape, "page", depart, choisir_habillage(page, res, vue_etape, "page", depart))
        vider_console(res, vue_etape)


def nombre_de_la_phrase(phrase):
    """Le total que dit la phrase du tiroir (« 7 à traiter : ... » donne 7)."""
    return int(phrase.split(" ")[0])


def lignes_a_traiter_attendues(phrase):
    """Les lignes de la carte « À traiter » d'Aujourd'hui que dit la phrase du tiroir (« 7 à traiter : 5 signalements, 2 propositions de l'IA »)."""
    lignes = []
    m = re.search(r": (\d+) signalements?", phrase)
    if m:
        lignes.append("%s signalement%s sur %s" % (m.group(1), "" if m.group(1) == "1" else "s", "un QCM" if m.group(1) == "1" else "des QCM"))
    m = re.search(r"(\d+) propositions? de l'IA", phrase)
    if m:
        lignes.append("1 question proposée par l'IA" if m.group(1) == "1" else "%s questions proposées par l'IA" % m.group(1))
    return lignes


def verifier_a_traiter(page, res, sc, tiroir=False):
    """Les comptes « à traiter » de la coquille de l'équipe (lot 2A, tâche 6). Ce que le banc sert (A_TRAITER_DU_BANC) se lit sur la pastille de « Cours et
    QCM » (barre latérale dès 700 px, ligne du tiroir sur téléphone), sur le point de « Plus » (téléphone) et, le tiroir ouvert (`tiroir`), sur la phrase en tête
    (la même qu'écrit la spec) ; une seule pastille affichée, dans son entrée, qui ne recouvre pas l'œil d'un module fermé. Chaque repère affiché tient ses
    contrastes (3:1 pour le repère contre ce qui l'entoure, 4,5:1 pour son chiffre contre son fond). Lectures en échec ou qui n'aboutissent pas : rien du tout,
    dans la page ni dans les noms. Chez le stagiaire, jamais rien."""
    vue = "%s/a-traiter%s" % (sc.nom, "/tiroir" if tiroir else "")
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.aTraiter()")
    if sc.espace != "equipe":
        if m["total"]:
            res.echec("à traiter chez le stagiaire", vue, "%d repère(s) « à traiter » (pastille, point ou phrase) dans la coquille du stagiaire" % m["total"])
        return
    if sc.a_traiter == "signaler":
        verifier_point_de_signaler(res, vue, sc, m, tiroir)
        return
    attendu, phrase = A_TRAITER_DU_BANC[sc.a_traiter]
    if attendu is None:
        if m["total"] or m["parlants"]:
            res.echec("à traiter sans compte", vue, "des repères « à traiter » (%d dans la page, noms : %s) alors que les lectures échouent ou n'aboutissent pas"
                      % (m["total"], " ; ".join(m["parlants"]) or "aucun"))
        return
    telephone = sc.largeur < SEUIL_TELEPHONE
    total = nombre_de_la_phrase(phrase)
    # La pastille de l'entrée : une seule affichée. Barre latérale dès 700 px, tiroir ouvert sur téléphone (la barre latérale n'y est que l'en-tête).
    visibles = [p for p in m["pastilles"] if p["visible"]]
    ou = "plus" if tiroir else "cote"
    if telephone != tiroir:
        if visibles:
            res.echec("pastille « à traiter »", vue, "%d pastille(s) affichée(s) %s" % (len(visibles), "dans la barre du téléphone : « Cours et QCM » est rangée dans « Plus »" if telephone else "à côté de l'entrée"))
    elif len(visibles) != 1:
        res.echec("pastille « à traiter »", vue, "%d pastille(s) affichée(s) (une attendue, sur « Cours et QCM » %s)" % (len(visibles), "du tiroir" if tiroir else "de la barre latérale"))
    for p in visibles:
        if p["dans"] != ou:
            res.echec("pastille « à traiter »", vue, "la pastille est dans « %s », attendue dans « %s »" % (p["dans"], ou))
        if p["texte"] != attendu:
            res.echec("pastille « à traiter »", vue, "la pastille dit « %s », attendu « %s » (le banc : %s)" % (p["texte"], attendu, phrase))
        if p["href"] != "#/themes":
            res.echec("pastille « à traiter »", vue, "la pastille est sur l'entrée %s, attendu #/themes (Cours et QCM)" % p["href"])
        if "%d à traiter" % total not in p["nom"]:
            res.echec("pastille « à traiter »", vue, "le nom de l'entrée ne dit pas ce qui est à traiter (« %d à traiter ») : « %s »" % (total, p["nom"]))
        if p["dehors"]:
            res.echec("pastille « à traiter »", vue, "la pastille (%dx%d px) sort de la boîte de son entrée" % tuple(p["taille"]))
        if p["recouvreLOeil"]:
            res.echec("pastille « à traiter »", vue, "la pastille recouvre l'œil « masqué aux stagiaires » de son entrée")
        if p["chiffre"] is not None and p["chiffre"] < 4.5:
            res.echec("contraste d'une pastille « à traiter »", vue, "le chiffre ne tient que %.2f:1 (%s), 4,5:1 au moins" % (p["chiffre"], p["couleurs"]))
        if p["fond"] is not None and p["fond"] < 3 and not p.get("detache"):   # un liseré plein qui la cerne suffit (lot 3, tâche 10)
            res.echec("contraste d'une pastille « à traiter »", vue, "la pastille ne tient que %.2f:1 contre ce qui l'entoure (%s), 3:1 au moins pour un repère" % (p["fond"], p["couleurs"]))
    # Toute pastille de la barre sombre, celle de « Signaler un problème » comme celle de « Cours et QCM » (relecture de la tâche 6, point 4) : le chiffre tient 4,5:1 contre
    # son fond, la pastille 3:1 contre la barre (le vert d'origine, --accent, n'en tenait que 2,9 contre elle). Les scénarios avec brouillons sèment les compteurs de « Signaler
    # un problème » : sa pastille y est, sinon le contrôle ne verrait que la première.
    for p in m["barreSombre"]:
        de = "de « Signaler un problème »" if p["de"] == "signaler" else "de l'entrée %s" % (p["de"] or "?")
        if p["chiffre"] is not None and p["chiffre"] < 4.5:
            res.echec("contraste d'une pastille de la barre sombre", vue, "le chiffre de la pastille %s ne tient que %.2f:1 (%s), 4,5:1 au moins" % (de, p["chiffre"], p["couleurs"]))
        if p["fond"] is not None and p["fond"] < 3 and not p.get("detache"):   # un liseré plein qui la cerne suffit (lot 3, tâche 10)
            res.echec("contraste d'une pastille de la barre sombre", vue, "la pastille %s ne tient que %.2f:1 contre la barre (%s), 3:1 au moins pour un repère" % (de, p["fond"], p["couleurs"]))
    if sc.a_traiter in BROUILLONS_IA_DU_BANC and not telephone and not tiroir:
        signaler = [p["texte"] for p in m["barreSombre"] if p["de"] == "signaler"]
        if signaler != [SIGNALER_DU_BANC]:
            res.echec("pastille de « Signaler un problème »", vue, "la barre sombre montre %s sur « Signaler un problème », attendu une pastille « %s » (compteurs semés : %s)"
                      % (signaler or "aucune pastille", SIGNALER_DU_BANC, COMPTEURS_SIGNALER_DU_BANC))
    # Le point de « Plus » : sur téléphone seulement, puisque « Cours et QCM » y est rangée dans le tiroir.
    points = [p for p in m["points"] if p["visible"]]
    if not telephone:
        if points:
            res.echec("point de « Plus »", vue, "un point de « Plus » est affiché à %d px, où la barre du bas n'existe pas" % sc.largeur)
    elif len(points) != 1:
        res.echec("point de « Plus »", vue, "%d point(s) affiché(s) sur « Plus » (un attendu : une entrée du tiroir a quelque chose à traiter)" % len(points))
    for p in points:
        if min(p["taille"]) < 8:
            res.echec("point de « Plus »", vue, "le point mesure %dx%d px : trop petit pour se voir" % tuple(p["taille"]))
        if "%d à traiter" % total not in p["nom"] or not p["nom"].startswith("Plus"):
            res.echec("point de « Plus »", vue, "le nom du bouton (« %s ») ne dit pas « Plus, %d à traiter »" % (p["nom"], total))
        for contre, valeur in (("son liseré", p["lisere"]), ("le fond derrière lui", None if p.get("detache") else p["fond"])):
            if valeur is not None and valeur < 3:
                res.echec("contraste du point de « Plus »", vue, "le point (%s) ne tient que %.2f:1 contre %s, 3:1 au moins pour un repère" % (p["couleur"], valeur, contre))
    # La phrase en tête du tiroir ouvert, et nulle part ailleurs.
    if tiroir:
        if m["phrase"] != phrase:
            res.echec("phrase du tiroir", vue, "la phrase en tête du tiroir est « %s », attendu « %s »" % (m["phrase"], phrase))
        elif not m["phraseAffichee"]:
            res.echec("phrase du tiroir", vue, "la phrase du tiroir n'est pas affichée")
    elif m["phrase"] is not None:
        res.echec("phrase du tiroir", vue, "la phrase du tiroir (« %s ») est posée alors que le tiroir est fermé" % m["phrase"])


def verifier_point_de_signaler(res, vue, sc, m, tiroir):
    """Scénario « signaler » (vague finale, F10) : les lectures « à traiter » échouent (aucun compte), mais la pastille de « Signaler un problème », que le
    tiroir « Plus » contient, est affichée (la personne du banc a des signalements qui ont avancé) : le point de « Plus » s'allume quand même, au téléphone, et
    son nom dit ce qu'il signale (« Plus, 2 signalements ont avancé »), sans parler d'« à traiter » ; ni pastille sur « Cours et QCM », ni phrase en tête du tiroir.
    Sur ordinateur, la barre du bas n'existe pas : aucun point."""
    telephone = sc.largeur < SEUIL_TELEPHONE
    if [p for p in m["pastilles"] if p["visible"]]:
        res.echec("pastille « à traiter »", vue, "une pastille « à traiter » est affichée alors que les comptes sont illisibles")
    if m["parlants"]:
        res.echec("à traiter sans compte", vue, "des noms disent « à traiter » alors que les comptes sont illisibles : %s" % " ; ".join(m["parlants"]))
    if m["phrase"] is not None:
        res.echec("phrase du tiroir", vue, "la phrase du tiroir (« %s ») est posée alors qu'il n'y a rien à traiter" % m["phrase"])
    if tiroir and m["signalerDuTiroir"] != SIGNALER_DU_BANC:
        res.echec("pastille de « Signaler un problème »", vue, "la ligne « Signaler un problème » du tiroir porte %s, attendu une pastille « %s » (compteurs semés : %s)"
                  % (m["signalerDuTiroir"] or "aucune pastille", SIGNALER_DU_BANC, COMPTEURS_SIGNALER_DU_BANC))
    points = [p for p in m["points"] if p["visible"]]
    if not telephone:
        if points:
            res.echec("point de « Plus »", vue, "un point de « Plus » est affiché à %d px, où la barre du bas n'existe pas" % sc.largeur)
        return
    if len(points) != 1:
        res.echec("point de « Plus »", vue, "%d point(s) affiché(s) sur « Plus », un attendu : la pastille de « Signaler un problème » est dans le tiroir" % len(points))
    for p in points:
        if min(p["taille"]) < 8:
            res.echec("point de « Plus »", vue, "le point mesure %dx%d px : trop petit pour se voir" % tuple(p["taille"]))
        if not p["nom"].startswith("Plus, ") or "signalement" not in p["nom"] or "à traiter" in p["nom"]:
            res.echec("point de « Plus »", vue, "le nom du bouton est « %s » : il devrait dire ce que le point signale (« Plus, 2 signalements ont avancé »), sans « à traiter »" % p["nom"])
        for contre, valeur in (("son liseré", p["lisere"]), ("le fond derrière lui", None if p.get("detache") else p["fond"])):
            if valeur is not None and valeur < 3:
                res.echec("contraste du point de « Plus »", vue, "le point (%s) ne tient que %.2f:1 contre %s, 3:1 au moins pour un repère" % (p["couleur"], valeur, contre))


def verifier_aucune_erreur_visible(page, res, vue):
    """Une lecture « à traiter » qui échoue ou qui traîne ne montre aucune erreur : ni message d'erreur à l'écran, ni boîte d'erreur dans la page."""
    visible = page.evaluate("""() => { const t = document.getElementById('toast');
        return { message: t && !t.classList.contains('hidden') && t.classList.contains('error') ? t.textContent.trim() : null,
                 boite: !!document.querySelector('#view .view-error-box') }; }""")
    if visible["message"]:
        res.echec("erreur visible", vue, "un message d'erreur s'affiche : « %s »" % visible["message"])
    if visible["boite"]:
        res.echec("erreur visible", vue, "la page montre une boîte d'erreur")


def jouer_a_traiter(page, res, sc, options):
    """Les scénarios « à traiter » (lot 2A, tâche 6) : la barre de l'équipe avec des brouillons de l'IA qui ne comptent pas (« ia », ruling R56) ou onze signalements (« beaucoup » :
    « 9+ », sur ordinateur puis en colonne d'icônes avec l'œil d'un module fermé), des lectures en échec (« panne ») ou qui n'aboutissent pas (« lent », 20 s), ou une pastille sur « Signaler un
    problème » sans aucun compte (« signaler », le point de « Plus »).
    Dans tous les cas la barre se pose sans attendre ces lectures (sinon « coquille absente » : l'ouverture dure au plus 8 s) ; la pastille, le point et la phrase du
    tiroir disent ce qu'attend A_TRAITER_DU_BANC, et sans compte lisible rien ne s'affiche, erreur comprise ; le menu du compte s'ouvre malgré la lecture qui traîne."""
    regles = regles_de_la_page(page, res, sc)
    preparer_coquille(page, res, sc, regles)
    vue = "%s/a-traiter" % sc.nom
    verifier_vue(page, res, sc, "ouverture/" + route_courante(page), options)
    if not res.coquille:
        return
    verifier_a_traiter(page, res, sc)
    if sc.largeur < SEUIL_TELEPHONE and cliquer(page, res, vue, '[data-nav-coquille] [data-nav-action="plus"]', "bouton « Plus »"):
        page.wait_for_timeout(300)
        verifier_a_traiter(page, res, sc, tiroir=True)
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
    if sc.a_traiter in ("panne", "lent"):
        verifier_aucune_erreur_visible(page, res, vue)
        verifier_menu_du_compte_a_l_ouverture(page, res, sc)
    vider_console(res, vue)


def verifier_reglages(page, res, sc, regles):
    """Réglages (#/config) sous la nouvelle navigation. Équipe : titre « Réglages », surtitre la promo affichée, la page commence par
    « Ce que voient les stagiaires » et ne garde que la promo, dans l'ordre (SECTIONS_REGLAGES : Émargement et Nouvelle navigation
    pour le fondateur seulement), sans « whitelist », « admin » ni « mdp ». Stagiaire : #/config le mène à Mes préférences."""
    vue = "%s/reglages" % sc.nom
    res.vues += 1
    aller_a(page, "#/config")
    attendre(page)
    p = page.evaluate("() => window.__verifNav.pageDeReglages()")
    if sc.espace != "equipe":
        if p["route"] != "preferences" or p["titre"] != "Mes préférences":
            res.echec("page Réglages", vue, "un stagiaire qui ouvre #/config arrive sur #/%s (« %s »), attendu #/preferences (« Mes préférences »)"
                      % (p["route"], p["titre"]))
        vider_console(res, vue)
        return
    if p["route"] != "config":
        res.echec("page Réglages", vue, "#/config ouvre #/%s chez l'équipe" % p["route"])
    if p["titre"] != "Réglages":
        res.echec("page Réglages", vue, "le titre de la page est « %s », attendu « Réglages »" % p["titre"])
    if p["surtitre"] != p["promo"]:
        res.echec("page Réglages", vue, "le surtitre est « %s », attendu le nom de la promo affichée (« %s »)" % (p["surtitre"], p["promo"]))
    if p["sousTitre"] != "Ce que voient les stagiaires, la promo et les accès.":
        res.echec("page Réglages", vue, "le sous-titre est « %s »" % p["sousTitre"])
    attendues = [s for s in SECTIONS_REGLAGES if s not in SECTIONS_DU_FONDATEUR or regles.get("fondateur")]
    if p["sections"][:1] != [SECTIONS_REGLAGES[0]]:
        res.echec("page Réglages", vue, "la page commence par « %s », attendu « %s »" % ((p["sections"] or ["rien"])[0], SECTIONS_REGLAGES[0]))
    elif p["sections"] != attendues:
        res.echec("page Réglages", vue, "sections : %s ; attendu, dans cet ordre : %s" % (", ".join(p["sections"]), ", ".join(attendues)))
    interdit = MOTS_BANNIS.search(p["texte"])
    if interdit:
        res.echec("page Réglages", vue, "la page dit encore « %s »" % interdit.group(0))
    # Lot 2A, tâche 1 : la phrase des modules toujours ouverts porte les noms de la nouvelle barre : Mon suivi, et Mes préférences (la page de la personne,
    # jamais Réglages, qui est celle de la promo).
    if p["socle"] != SOCLE["nouvelle"]:
        res.echec("page Réglages", vue, "la phrase des modules toujours ouverts est « %s », attendu « %s »" % (p["socle"], SOCLE["nouvelle"]))
    vider_console(res, vue)


def verifier_preferences(page, res, sc):
    """Mes préférences (#/preferences) sous la nouvelle navigation, pour tous les rôles : titre « Mes préférences », aucune section de
    la promo (SECTIONS_REGLAGES), seulement « Mes préférences » et « Informations », sans « whitelist », « admin » ni « mdp »."""
    vue = "%s/preferences" % sc.nom
    res.vues += 1
    aller_a(page, "#/preferences")
    attendre(page)
    p = page.evaluate("() => window.__verifNav.pageDeReglages()")
    if p["route"] != "preferences":
        res.echec("page Mes préférences", vue, "#/preferences ouvre #/%s" % p["route"])
    if p["titre"] != "Mes préférences":
        res.echec("page Mes préférences", vue, "le titre de la page est « %s », attendu « Mes préférences »" % p["titre"])
    de_la_promo = [s for s in p["sections"] if s in SECTIONS_REGLAGES]
    if de_la_promo:
        res.echec("page Mes préférences", vue, "la page montre des sections de la promo : %s" % ", ".join(de_la_promo))
    en_trop = [s for s in p["sections"] if s not in SECTIONS_PREFERENCES and s not in de_la_promo]
    if en_trop:
        res.echec("page Mes préférences", vue, "sections inattendues : %s" % ", ".join(en_trop))
    if "Informations" not in p["sections"]:
        res.echec("page Mes préférences", vue, "la section « Informations » manque (sections : %s)" % (", ".join(p["sections"]) or "aucune"))
    interdit = MOTS_BANNIS.search(p["texte"])
    if interdit:
        res.echec("page Mes préférences", vue, "la page dit « %s »" % interdit.group(0))
    # F6 : « Mes préférences » une seule fois (le titre de la page, pas aussi celui d'une section) ; « Réglages » est la page de l'équipe : ni « Réglages personnels » ni
    # « réglages » dans le sous-titre ; le réglage de l'anonymat dans les notes n'est montré qu'à qui a une fiche de stagiaire (module Notes ouvert).
    if "Mes préférences" in p["sections"]:
        res.echec("page Mes préférences", vue, "« Mes préférences » est aussi le titre d'une section : le titre de la page ne se répète pas")
    if "Réglages personnels" in p["texte"]:
        res.echec("page Mes préférences", vue, "la page écrit « Réglages personnels » : « Réglages » est la page de l'équipe")
    avec_reglage = res.profil_stagiaire and not (sc.modules == "depart" and sc.espace == "stagiaire")
    if p["sousTitre"] != SOUS_TITRE_PREFERENCES:
        res.echec("page Mes préférences", vue, "le sous-titre est « %s », attendu « %s »" % (p["sousTitre"], SOUS_TITRE_PREFERENCES))
    # Lot 3, tâche 11 : la section Apparence, toujours là (formateur sans fiche, module Notes fermé compris), la première de la page.
    if verifier_apparence(page, res, sc, vue, "page") is not None and p["sections"][:1] != ["Apparence"]:
        res.echec("page Mes préférences", vue, "la page commence par « %s », attendu « Apparence »" % ((p["sections"] or ["rien"])[0]))
    if avec_reglage and p["anonymat"] is None:
        res.echec("page Mes préférences", vue, "la personne a une fiche de stagiaire : le réglage de l'anonymat dans les notes manque")
    if not res.profil_stagiaire and p["anonymat"] is not None:
        res.echec("page Mes préférences", vue, "la personne n'a pas de fiche de stagiaire : le réglage de l'anonymat dans les notes est montré (« %s »)" % p["anonymat"][:60])
    verifier_texte_de_l_anonymat(res, vue, p, "page Mes préférences")
    # Lot 2B, tâche 3 : « À retenir » a quitté l'Accueil du stagiaire ; il vit dans la section Informations, pour tous les rôles, avec les noms de la nouvelle barre.
    retenir = page.evaluate("() => { const b = document.querySelector('#view [data-a-retenir]'); return b ? { titre: b.querySelector('h4').textContent.trim(), "
                            "lignes: [...b.querySelectorAll('li')].map((li) => li.textContent.replace(/\\s+/g, ' ').trim()) } : null; }")
    if not retenir or retenir["titre"] != "À retenir" or len(retenir["lignes"]) != 4 or retenir["lignes"][-1] != CTRL_Z["nouvelle"]:
        res.echec("page Mes préférences", vue, "« À retenir » manque d'Informations ou n'a pas ses 4 lignes (dernière : « %s »)" % (retenir and retenir["lignes"][-1:]))
    vider_console(res, vue)


def verifier_preferences_eteint(page, res, sc):
    """Interrupteur éteint : Mes préférences n'existe pas, #/preferences mène à Paramètres (#/config), la page de main."""
    vue = "%s/preferences" % sc.nom
    res.vues += 1
    aller_a(page, "#/preferences")
    attendre(page, calme=150)
    p = page.evaluate("() => window.__verifNav.pageDeReglages()")
    if p["route"] != "config" or p["titre"] != "Paramètres":
        res.echec("préférences, interrupteur éteint", vue, "#/preferences ouvre #/%s (« %s »), attendu #/config (« Paramètres »)" % (p["route"], p["titre"]))
    # Lot 2A, tâche 1 : le texte de l'anonymat est le même dans les deux navigations ; la phrase des modules toujours ouverts est celle de main.
    verifier_texte_de_l_anonymat(res, vue, p, "préférences, interrupteur éteint")
    if p["socle"] is not None and p["socle"] != SOCLE["ancienne"]:
        res.echec("préférences, interrupteur éteint", vue, "la phrase des modules toujours ouverts est « %s », celle de main « %s »" % (p["socle"], SOCLE["ancienne"]))
    # Lot 3, tâche 11, décision H6 : le choix ne se fait que dans la nouvelle navigation ; Paramètres ne montre Apparence qu'à qui est en « Couleurs ECF »,
    # pour pouvoir revenir. En « ECSR Promo », la page de main, sans rien de plus.
    a = lire_apparence(page, "page")
    if a["skin"] == "ecf":
        if verifier_apparence(page, res, sc, vue, "page", a) is not None and "Apparence" not in p["sections"]:
            res.echec("préférences, interrupteur éteint", vue, "le groupe « Apparence » n'est pas dans une section « Apparence » (sections : %s)" % ", ".join(p["sections"]))
    elif a["groupes"] or "Apparence" in p["sections"]:
        res.echec("préférences, interrupteur éteint", vue, "Paramètres montre Apparence à qui est en « ECSR Promo » : avec l'ancienne barre, rien ne change (décision H6)")
    vider_console(res, vue)


def jouer_retour_par_parametres(page, res, sc):
    """Ancienne barre, appareil en « Couleurs ECF » (décision H6) : Apparence, dans Paramètres, ramène à ECSR Promo sans recharger ; rechargée, la page
    reste en ECSR Promo, l'appareil le retient comme un choix, et Paramètres ne montre plus Apparence. Le banc est rechargé : joué en dernier."""
    vue = "%s/apparence/retour-par-parametres" % sc.nom
    res.vues += 1
    aller_a(page, "#/config")
    attendre(page, calme=150)
    attendre_habillage(page, "ecf")
    # Paramètres qui ne se charge pas (toute lecture rejetée le temps de l'ouvrir) : la boîte d'erreur s'affiche et Apparence reste là, pour ne pas piéger en ECF.
    page.evaluate("() => { window.__HARNESS_FAIL = 'panne du banc'; }")
    aller_a(page, "#/home")
    aller_a(page, "#/config")
    page.wait_for_selector(".param-error", timeout=20000)
    if not lire_apparence(page, "page")["groupes"]:
        res.echec("apparence, Paramètres en échec", vue, "la page ne se charge pas et Apparence manque : une personne en « Couleurs ECF » ne peut pas revenir")
    page.evaluate("() => { window.__HARNESS_FAIL = null; }")
    res.console.clear()   # l'erreur de chargement journalisée est celle que la panne provoque, attendue ici
    aller_a(page, "#/home")
    aller_a(page, "#/config")
    attendre(page, calme=150)
    verifier_choix(page, res, sc, vue, "page", "ecsr", choisir_habillage(page, res, vue, "page", "ecsr"))
    vider_console(res, vue)
    vue = "%s/rechargement" % vue
    res.vues += 1
    recharger_la_page(page)
    attendre_habillage(page, "ecsr", False)
    skin = page.evaluate("() => document.documentElement.dataset.skin || null")
    a = page.evaluate("(cle) => { try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; } }", CLE_HABILLAGE) or {}
    if skin != "ecsr" or a.get("nom") != "ecsr" or a.get("choisi") is not True:
        res.echec("retour à ECSR Promo", vue, "rechargée, la page porte « %s » et l'appareil retient %s : attendu « ecsr », choisi" % (skin, json.dumps(a)))
    aller_a(page, "#/config")
    attendre(page, calme=150)
    if lire_apparence(page, "page")["groupes"]:
        res.echec("retour à ECSR Promo", vue, "revenu en ECSR Promo, Paramètres montre encore Apparence (décision H6 : seulement pour qui est en « Couleurs ECF »)")
    vider_console(res, vue)


def verifier_texte_de_l_anonymat(res, vue, p, type_):
    """Le texte de l'anonymat des notes (Mes préférences, ou Paramètres), juste dans les deux navigations (lot 2A, tâche 1) : « ni ton prénom ni tes notes dans
    les notes de la classe », non plus « sur la page Notes », qui n'existe plus comme page du stagiaire. Absent quand le module Notes est fermé."""
    texte = p.get("anonymat")
    if texte is None:
        return
    if "dans les notes de la classe" not in texte or "page Notes" in texte:
        res.echec(type_, vue, "le texte de l'anonymat dit « %s » : attendu « ni ton prénom ni tes notes dans les notes de la classe », jamais « sur la page Notes »" % texte[:200])


# --------------------------------------------------------------------------------------
# Titres des pages, bénévoles sous Stagiaires, Assistant de l'équipe sur téléphone (lot 2A, tâche 3)
# --------------------------------------------------------------------------------------

# Pages dont le titre (h2) est le libellé de leur entrée, par espace (ruling R30, une page, un nom). Aujourd'hui en fait partie (lot 2B, tâche 4) : son titre
# est un h1, celui de la signature de l'app (pastille de date, titre), et son surtitre est la pastille. N'en font pas partie : l'Accueil du stagiaire, qui
# salue par son prénom, et Planning, dont la semaine garde son titre (« Planning de la semaine », le surtitre disant la
# semaine). Émargement en fait partie depuis la tâche 4 (ruling R50 : « Émargement », et non « Feuilles d'émargement »). Le titre de Mon
# suivi se lit aussi chez qui n'a pas cette entrée (fondateur).
TITRES_DES_PAGES = {
    "equipe": ("home", "emargement", "stagiaires", "notes", "themes", "centre", "config", "ccp2"),
    "stagiaire": ("home", "themes", "mon-suivi", "ccp2"),   # « home » : titré « Accueil » depuis le 10/11
}
# Parmi elles, celles dont le surtitre est le nom de la promo affichée (CCP2 garde « Titre professionnel ECSR »).
SURTITRE_PROMO = ("emargement", "stagiaires", "notes", "themes", "centre", "config", "mon-suivi")
SOUS_ONGLETS_STAGIAIRES = ["Stagiaires", "Élèves bénévoles"]
# Sous-pages qui ont repris le nom de leur sous-onglet : Planning > Dates clés (ex-Calendrier), Cours et QCM > Documents (ex-Ressources).
SOUS_PAGES = (("planning", "Dates clés"), ("themes", "Documents"))
PHRASE_TACTILE = "Saisis les notes thème par thème, ou touche une case de la matrice."   # lot C : la page s'ouvre sur « Saisir »


def verifier_titre_de_page(page, res, sc, route, libelle):
    """Le titre de la page est le libellé de son entrée et, sauf pour CCP2, son surtitre est le nom de la promo affichée (celui que
    l'app lit, getPromoCourante). Mon suivi est lu aussi chez qui n'a pas d'entrée à ce nom : le fondateur, par le menu du compte."""
    vue = "%s/titre/%s" % (sc.nom, route)
    res.vues += 1
    p = page.evaluate("() => window.__verifNav.enTeteDePage()")
    if p["route"] != route:
        return   # la page n'est pas celle qu'on attendait : le défaut est noté à l'ouverture
    if route == "home":
        # Aujourd'hui (l'équipe) et Accueil (le stagiaire) : un titre de la signature de l'app (h1, sous la pastille de date), pas un en-tête de page.
        titre = page.evaluate("() => (document.querySelector('#view .home-title-v2') || {}).textContent || null")
        if (titre or "").strip() != libelle:
            res.echec("titre de page", vue, "le titre de #/home est « %s », le libellé de son entrée « %s »" % (titre, libelle))
        vider_console(res, vue)
        return
    if route == "themes" and sc.modules == "depart" and sc.espace == "stagiaire":
        libelle = "Documents"   # cours fermés (départ) : la page se réduit à ses Documents, sans barre, et porte leur titre
    if not p["entetes"]:
        res.echec("titre de page", vue, "#/%s n'a pas d'en-tête de page (.view-header)" % route)
        return
    tete = p["entetes"][0]
    if tete["titre"] != libelle:
        res.echec("titre de page", vue, "le titre de #/%s est « %s », le libellé de son entrée « %s »" % (route, tete["titre"], libelle))
    if route in SURTITRE_PROMO and tete["surtitre"] != p["promo"]:
        res.echec("surtitre de page", vue, "le surtitre de #/%s est « %s », attendu le nom de la promo affichée (« %s »)" % (route, tete["surtitre"], p["promo"]))
    vider_console(res, vue)


def verifier_sous_page(page, res, sc, route, libelle, options):
    """Chaque sous-onglet des pages touchées, une fois ouvert : Dates clés et Documents portent le nom de leur sous-onglet, la promo en
    surtitre, et Documents appelle sa section des contacts « Contacts du centre » ; Élèves bénévoles montre le panneau de la banque."""
    if (route, libelle) in SOUS_PAGES:
        vue = "%s/titre/%s/%s" % (sc.nom, route, libelle)
        res.vues += 1
        attendre(page)
        p = page.evaluate("() => window.__verifNav.enTeteDePage()")
        tete = p["entetes"][-1] if p["entetes"] else None
        if tete is None:
            res.echec("titre de sous-page", vue, "« %s » n'a pas d'en-tête de page (.view-header)" % libelle)
        else:
            if tete["titre"] != libelle:
                res.echec("titre de sous-page", vue, "le titre du sous-onglet « %s » est « %s »" % (libelle, tete["titre"]))
            if tete["surtitre"] != p["promo"]:
                res.echec("surtitre de sous-page", vue, "le surtitre du sous-onglet « %s » est « %s », attendu le nom de la promo affichée (« %s »)" % (libelle, tete["surtitre"], p["promo"]))
        if libelle == "Documents" and not any("Contacts du centre" in s for s in p["sections"]):
            res.echec("titre de sous-page", vue, "Documents n'a pas de section « Contacts du centre » (sections : %s)" % (", ".join(p["sections"]) or "aucune"))
        if tete is not None:
            # Ruling R49 : les comptes des anciens surtitres terminent le sous-titre (« 7 dates clés. », « 12 liens · 4 contacts. »).
            c = page.evaluate("() => window.__verifNav.comptesDesPages()")
            if libelle == "Dates clés":
                attendu = "%d date%s clé%s." % (c["evenements"], pluriel(c["evenements"]), pluriel(c["evenements"]))
            else:
                attendu = "%d lien%s · %d contact%s." % (c["liens"], pluriel(c["liens"]), c["contacts"], pluriel(c["contacts"]))
            if not (tete["sousTitre"] or "").endswith(" " + attendu):
                res.echec("comptes en fin de sous-titre", vue, "le sous-titre de « %s » est « %s », il doit se terminer par « %s »" % (libelle, tete["sousTitre"], attendu))
        vider_console(res, vue)
    elif route == "stagiaires" and libelle == "Élèves bénévoles":
        verifier_panneau_benevoles(page, res, sc, options)
    elif route == "notes" and libelle == "EPCF":
        verifier_epcf_de_l_equipe(page, res, sc)


def verifier_panneau_benevoles(page, res, sc, options):
    """Stagiaires > Élèves bénévoles : le panneau de la banque est dans la page, sans fenêtre ni « Fermer », sous le titre « Stagiaires »
    et l'adresse de la page ; sur téléphone, ses zones à toucher font 44 px. Puis « + Ajouter » ouvre la fiche d'un nouveau bénévole,
    dans la page elle aussi : sans débordement de côté, ses zones à toucher à 44 px ; « Annuler » ramène à la liste."""
    vue = "%s/stagiaires/benevoles" % sc.nom
    res.vues += 1
    attendre(page)
    tel = sc.largeur < SEUIL_TELEPHONE
    m = page.evaluate("(min) => window.__verifNav.panneauBenevoles(min)", 44 if tel else 0)
    if not m["present"]:
        res.echec("élèves bénévoles", vue, "le sous-onglet « Élèves bénévoles » ne montre pas le panneau de la banque (.bnv-page)")
        return
    if m["actif"] != "Élèves bénévoles":
        res.echec("élèves bénévoles", vue, "le sous-onglet allumé est « %s », attendu « Élèves bénévoles »" % m["actif"])
    if not (m["titre"] or "").startswith("Élèves bénévoles et partenaires"):
        res.echec("élèves bénévoles", vue, "le panneau s'appelle « %s », attendu « Élèves bénévoles et partenaires »" % m["titre"])
    if m["fenetre"]:
        res.echec("élèves bénévoles", vue, "%d fenêtre(s) ouverte(s) (.modal-backdrop) : la banque doit être dans la page, pas dans une fenêtre" % m["fenetre"])
    if m["fermer"]:
        res.echec("élèves bénévoles", vue, "le panneau, dans la page, propose encore « Fermer »")
    if m["page"] != "Stagiaires":
        res.echec("élèves bénévoles", vue, "le titre de la page est « %s » sous le sous-onglet, attendu « Stagiaires »" % m["page"])
    if m["adresse"] != "#/stagiaires":
        res.echec("élèves bénévoles", vue, "l'adresse est %s, attendu #/stagiaires (celle d'une fiche ne doit pas rester sous les bénévoles)" % m["adresse"])
    for detail in m["petites"]:
        res.echec("zone à toucher (élèves bénévoles)", vue, detail)
    ajouter = page.locator("#view .bnv-page button", has_text="+ Ajouter")
    if not ajouter.count():
        res.echec("élèves bénévoles", vue, "le panneau n'a pas de bouton « + Ajouter »")
        return
    ajouter.first.click()
    attendre(page, calme=150)
    f = page.evaluate("(min) => window.__verifNav.panneauBenevoles(min)", 44 if tel else 0)
    if not f["present"] or f["fenetre"]:
        res.echec("élèves bénévoles", vue, "la fiche d'un nouveau bénévole ne s'ouvre pas dans la page (panneau %s, %d fenêtre(s))" % ("présent" if f["present"] else "absent", f["fenetre"]))
    for detail in f["petites"]:
        res.echec("zone à toucher (élèves bénévoles)", vue + "/fiche", detail)
    verifier_vue(page, res, sc, "stagiaires/benevoles/fiche", options)
    annuler = page.locator("#view .bnv-page button", has_text="Annuler")
    if annuler.count():
        annuler.first.click()
        attendre(page, calme=150)
    verifier_formulaire_ramene(page, res, sc, vue)
    vider_console(res, vue)


def verifier_formulaire_ramene(page, res, sc, vue):
    """Vague finale, F11 : dans la page, le formulaire que « Modifier » ouvre prend la place de la liste, souvent plus longue que l'écran : il est ramené en haut de
    l'écran (sous l'en-tête collant du téléphone), et non laissé là où la liste était défilée. Le banc n'a aucun bénévole : trente sont semés dans le faux Supabase de la
    page le temps du contrôle (une liste bien plus longue que l'écran), la liste est relue (on quitte la page et on y revient), la page est défilée jusqu'à la dernière
    ligne, « Modifier » est cliqué : le titre du formulaire doit être dans l'écran, pas derrière l'en-tête collant (sans le défilement, il restait au-dessus de l'écran :
    la liste raccourcie laisse la page défilée tout en bas)."""
    vue = vue + "/modifier"
    res.vues += 1
    res.derniere_vue = vue
    graine = page.evaluate("""() => { const f = window.__FIXTURES_DU_BANC; if (!f) return false;
        const base = { telephone: null, niveau: null, boite: "Manuelle", heures: null, auto_ecole_id: null, dispos: {}, dispo_note: null, notes: null, actif: true };
        for (let i = 1; i <= 30; i++) f.benevoles.push({ ...base, id: 9000 + i, prenom: "Banc", nom: "Nom" + String(i).padStart(2, "0") });
        return true; }""")
    if not graine:
        res.echec("élèves bénévoles", vue, "le faux Supabase du banc n'est pas joint à la fenêtre (window.__FIXTURES_DU_BANC) : le formulaire de modification ne peut pas être éprouvé")
        return
    try:
        # La liste est relue en quittant la page puis en y revenant (un sous-onglet déjà ouvert garde son panneau, qui ne relit rien), le cache de lecture vidé.
        page.evaluate("() => window.__verifNav.invaliderCache(['benevoles', 'benevoles_noms'])")
        aller_a(page, "#/home")
        attendre(page)
        aller_a(page, "#/stagiaires")
        attendre(page, calme=250)
        if not page.evaluate("() => !!document.querySelector('#view .subtabs-bar > .subtab.active') && document.querySelector('#view .subtabs-bar > .subtab.active').textContent.trim() === 'Élèves bénévoles'"):
            if not cliquer(page, res, vue, '#view .subtabs-bar > .subtab:has-text("Élèves bénévoles")', "sous-onglet « Élèves bénévoles »"):
                return
            attendre(page, calme=150)
        # Le dernier bouton « Modifier », amené au milieu de l'écran puis cliqué depuis la page : le geste de qui a défilé jusqu'à cette ligne, sans les attentes d'un clic de
        # Playwright (une barre fixe qui couvre le bouton les fait durer jusqu'au délai de 8 s, WebKit sous charge : le scénario était interrompu).
        lignes = "[...document.querySelectorAll('#view .bnv-page .bnv-row button')].filter((x) => x.textContent.trim() === 'Modifier')"
        nombre = page.evaluate("() => %s.length" % lignes)
        if nombre < 30:
            res.echec("élèves bénévoles", vue, "la banque ne montre que %d ligne(s) « Modifier » après le semis de trente bénévoles" % nombre)
            return
        defile = page.evaluate("() => { %s.pop().scrollIntoView({ block: 'center' }); return Math.round(window.scrollY); }" % lignes)
        page.wait_for_timeout(150)
        page.evaluate("() => %s.pop().click()" % lignes)
        attendre(page, calme=150)
        page.wait_for_timeout(150)
        f = page.evaluate("""() => { const h = document.querySelector('#view .bnv-page h3'); if (!h) return null; const r = h.getBoundingClientRect();
            return { titre: h.textContent.trim(), haut: Math.round(r.top), bas: Math.round(r.bottom), H: window.innerHeight,
                     entete: parseFloat(getComputedStyle(document.body).getPropertyValue('--haut-entete')) || 0 }; }""")
        if f is None or not f["titre"].startswith("Modifier"):
            res.echec("élèves bénévoles", vue, "« Modifier » n'ouvre pas le formulaire de la fiche dans la page (titre : %s)" % (f and f["titre"]))
        elif f["haut"] < f["entete"] - 1 or f["bas"] > f["H"]:
            res.echec("formulaire des bénévoles hors de l'écran", vue, "après « Modifier », le titre du formulaire (« %s ») est de y %d à %d, écran de %d px, en-tête collant de %d px (la page était défilée de %d px) : "
                      "le formulaire n'est pas ramené en haut de l'écran" % (f["titre"], f["haut"], f["bas"], f["H"], f["entete"], defile))
        page.evaluate("() => { const b = [...document.querySelectorAll('#view .bnv-page button')].find((x) => x.textContent.trim() === 'Annuler'); if (b) b.click(); }")
        attendre(page, calme=150)
    finally:
        # Rendu comme trouvé : plus de bénévole semé, et la liste (vide) relue.
        page.evaluate("() => { if (window.__FIXTURES_DU_BANC) window.__FIXTURES_DU_BANC.benevoles.length = 0; }")
        page.evaluate("() => window.__verifNav.invaliderCache(['benevoles', 'benevoles_noms'])")
    vider_console(res, vue)


# La fiche d'un stagiaire vue par l'équipe (vague finale, F1) : à 1 100 px puis à 768 px, dans les deux navigations. Le stagiaire des notes du banc a vingt notes
# sur sept mois (NOTES_DU_BANC) : de quoi tracer un graphe d'évolution.
LARGEUR_DE_LA_FICHE = 1100
ID_DU_STAGIAIRE_AUX_NOTES = 1
# L'échelle en deçà de laquelle un graphe est dit « réduit » : dessiné à la largeur de son conteneur, il s'affiche à l'échelle 1 (à la partie entière du conteneur près).
ECHELLE_MINIMALE_DU_GRAPHE = 0.99


def verifier_graphe_de_la_fiche(page, res, sc, options):
    """La partie Évolution de la fiche d'un stagiaire, vue par l'équipe (vague finale, F1), dans les deux navigations, à la largeur du scénario (1 100 px) puis à
    768 px : la fenêtre est resserrée sur place (le graphe se redessine à la largeur de son conteneur), puis la page rouverte à cette largeur. Dans la page Stagiaires
    (liste de 270 px, plus la barre latérale de 264 px de la nouvelle navigation), le conteneur du graphe est bien plus étroit que la fenêtre : un dessin fait pour
    la fenêtre était réduit de moitié (échelle de 0,51 à 0,65), ses libellés de 10 unités ne rendant que 5 à 6 px. À chaque étape, le graphe est là (sinon la garde ne
    verrait rien), dessiné à la largeur de son conteneur (échelle de 0,99 au moins) et ses libellés rendent 8 px au moins (garde de chaque vue, graphesIllisibles)."""
    adresse = "#/stagiaires/%d/evolution" % ID_DU_STAGIAIRE_AUX_NOTES

    def controler(largeur, etape):
        titre = "stagiaires/%d/evolution@%d/%s" % (ID_DU_STAGIAIRE_AUX_NOTES, largeur, etape)
        verifier_vue(page, res, sc, titre, options)
        g = page.evaluate("() => window.__verifNav.graphe()")
        vue = "%s/%s" % (sc.nom, titre)
        if g is None:
            res.echec("graphe de la fiche", vue, "la partie Évolution de la fiche n'affiche pas son graphe : la garde de lisibilité ne verrait rien")
        elif g["echelle"] < ECHELLE_MINIMALE_DU_GRAPHE:
            res.echec("graphe de la fiche", vue, "le graphe est dessiné sur %s unités mais affiché sur %s px (échelle %s, son conteneur mesure %s px) : il n'est pas dessiné à la largeur de "
                      "son conteneur" % (g["viewBox"], g["largeur"], g["echelle"], g["conteneur"]))

    aller_a(page, adresse)
    attendre(page, calme=250)
    controler(sc.largeur, "ouverte")
    page.set_viewport_size({"width": LARGEUR_TABLETTE, "height": HAUTEUR[LARGEUR_TABLETTE]})
    attendre(page, calme=250)
    controler(LARGEUR_TABLETTE, "redessinee-sur-place")
    aller_a(page, "#/home")
    attendre(page)
    aller_a(page, adresse)
    attendre(page, calme=250)
    controler(LARGEUR_TABLETTE, "rouverte")
    page.set_viewport_size({"width": sc.largeur, "height": HAUTEUR[sc.largeur]})
    attendre(page, calme=250)


def verifier_bouton_benevoles(page, res, sc):
    """Planning, nouvelle navigation : le bouton « Élèves bénévoles » (« Bénévoles » sur téléphone), absent hors édition et présent en mode
    Modifier (audit du 09/11, lot B), ne s'ouvre plus en fenêtre : il mène à la page Stagiaires, sous-onglet « Élèves bénévoles »."""
    vue = "%s/planning/benevoles" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    semaine = page.locator("#view .subtabs-bar > .subtab", has_text="Semaine")
    if semaine.count():
        semaine.first.click()
        attendre(page)
    res.vues += 1
    bouton = page.locator('#view button[title^="Banque d\'élèves bénévoles"]')
    # Audit du 09/11, lot B : hors édition, la banque n'a pas de raccourci dans le Planning (elle est dans Stagiaires) ;
    # le bouton revient en mode Modifier, où l'on place les bénévoles.
    if bouton.count() != 0:
        res.echec("bouton des bénévoles", vue, "Planning > Semaine, hors édition, montre %d bouton(s) de la banque des bénévoles, 0 attendu" % bouton.count())
    modifier = page.locator('#view .week-bar-actions button:has-text("Modifier")')
    if modifier.count() != 1:
        res.echec("bouton des bénévoles", vue, "Planning > Semaine montre %d bouton(s) « Modifier », 1 attendu" % modifier.count())
        return
    modifier.first.click()
    attendre(page)
    if bouton.count() != 1:
        res.echec("bouton des bénévoles", vue, "Planning > Semaine, en mode Modifier, montre %d bouton(s) de la banque des bénévoles, 1 attendu" % bouton.count())
        return
    bouton.click()
    attendre(page, calme=150)
    m = page.evaluate("(min) => window.__verifNav.panneauBenevoles(min)", 0)
    if m["adresse"] != "#/stagiaires" or m["actif"] != "Élèves bénévoles" or not m["present"]:
        res.echec("bouton des bénévoles", vue, "le bouton mène à %s, sous-onglet « %s », panneau %s ; attendu #/stagiaires, « Élèves bénévoles », panneau dans la page"
                  % (m["adresse"], m["actif"], "présent" if m["present"] else "absent"))
    if m["fenetre"]:
        res.echec("bouton des bénévoles", vue, "le bouton ouvre encore une fenêtre (%d .modal-backdrop)" % m["fenetre"])
        page.mouse.click(4, 4)   # un clic sur le voile la ferme : elle ne gêne pas les vues qui suivent
        page.wait_for_timeout(250)
    page.evaluate("() => { try { localStorage.removeItem('stagiaires.subtab'); } catch (e) { /* stockage bloqué */ } }")
    vider_console(res, vue)


def verifier_notes_tactile(page, res, sc):
    """Notes et examens, équipe : sur un écran tactile (le téléphone du banc), le sous-titre dit PHRASE_TACTILE (« Saisis les notes... ») et
    la phrase sur Entrée et Échap, qui suppose un clavier, n'est pas montrée ; avec un clavier, la phrase de la barre d'outils et le
    sous-titre d'avant."""
    vue = "%s/notes/tactile" % sc.nom
    res.vues += 1
    m = page.evaluate("""() => { const v = document.getElementById('view'), t = (s) => { const e = v.querySelector(s); return e ? e.textContent.trim() : null; };
        return { sous: t('.view-header .subtitle'), indice: t('.matrice-toolbar-hint') }; }""")
    sous = m["sous"] or ""
    if sc.largeur < SEUIL_TELEPHONE:
        if not sous.startswith(PHRASE_TACTILE):
            res.echec("notes sur écran tactile", vue, "le sous-titre est « %s », attendu « %s » puis le nombre de notes" % (sous, PHRASE_TACTILE))
        if m["indice"]:
            res.echec("notes sur écran tactile", vue, "la phrase sur Entrée et Échap est montrée sur un écran tactile : « %s »" % m["indice"])
    else:
        if sous.startswith(PHRASE_TACTILE):
            res.echec("notes avec un clavier", vue, "le sous-titre est celui de l'écran tactile (« %s ») alors que la page est affichée avec une souris" % sous)
        elif not sous.startswith("Tableau matrice"):
            res.echec("notes avec un clavier", vue, "le sous-titre est « %s », attendu celui d'avant (« Tableau matrice... ») puis le nombre de notes" % sous)
        if not m["indice"] or "Entrée" not in m["indice"]:
            res.echec("notes avec un clavier", vue, "la phrase sur Entrée et Échap manque avec un clavier (barre d'outils : %s)" % (m["indice"] or "vide"))
    # Ruling R49 : le nombre de notes, qui était le surtitre, termine le sous-titre.
    if not COMPTE_NOTES.search(sous):
        res.echec("comptes en fin de sous-titre", vue, "le sous-titre de Notes et examens ne se termine pas par « N notes enregistrées. » : « %s »" % sous)
    vider_console(res, vue)


def verifier_assistant_en_tete(page, res, sc, options):
    """Téléphone de l'équipe : le bouton « Assistant » est dans l'en-tête, entre la promo et le compte, nommé « Assistant », de 44 px, sans
    rien qui déborde de la fenêtre, à la largeur du scénario puis à 320 px ; le tiroir « Plus » s'appelle « Autres pages » et garde une ligne
    « Assistant ». Le bouton ouvre le panneau comme les autres (menus joués plus bas, par `verifier_menus`)."""
    for largeur in (sc.largeur, LARGEUR_ETROITE):
        if largeur != sc.largeur:
            page.set_viewport_size({"width": largeur, "height": HAUTEUR[largeur]})
            attendre(page, calme=250)
        vue = "%s/assistant-en-tete@%d" % (sc.nom, largeur)
        res.vues += 1
        e = page.evaluate("() => window.__verifNav.enTeteDeLEquipe()")
        if e is None:
            res.echec("assistant de l'équipe", vue, "l'en-tête de l'équipe est introuvable (data-nav-coquille=\"cote\" affiché)")
            continue
        if len(e["assistants"]) != 1:
            res.echec("assistant de l'équipe", vue, "%d bouton(s) « Assistant » affiché(s) dans l'en-tête de l'équipe, 1 attendu" % len(e["assistants"]))
        else:
            a = e["assistants"][0]
            b, c, cote = a["boite"], (e["comptes"] or [None])[0], e["cote"]
            # Module fermé pour la promo (départ), le repère « masqué aux stagiaires » s'ajoute au nom, comme à tout bouton de la coquille.
            if a["action"] != "assistant" or not a["nom"].startswith("Assistant"):
                res.echec("assistant de l'équipe", vue, "le bouton est nommé « %s » (data-nav-action=%s), attendu « Assistant » et data-nav-action=assistant" % (a["nom"], a["action"]))
            if b["l"] < 43.5 or b["h"] < 43.5:
                res.echec("assistant de l'équipe", vue, "zone à toucher de %sx%s px (44 px au moins)" % (b["l"], b["h"]))
            if b["haut"] < cote["haut"] - 0.5 or b["bas"] > cote["bas"] + 0.5 or b["gauche"] < -0.5 or b["droite"] > e["W"] + 0.5:
                res.echec("assistant de l'équipe", vue, "le bouton sort de l'en-tête ou de la fenêtre (x %s à %s, y %s à %s ; en-tête y %s à %s, fenêtre %d)"
                          % (b["gauche"], b["droite"], b["haut"], b["bas"], cote["haut"], cote["bas"], e["W"]))
            if e["promo"] is None or c is None:
                res.echec("assistant de l'équipe", vue, "l'en-tête n'affiche pas ensemble la promo et le compte (promo %s, compte %s)" % ("affichée" if e["promo"] else "absente", "affiché" if c else "absent"))
            elif not (e["promo"]["droite"] <= b["gauche"] + 0.5 and b["droite"] <= c["gauche"] + 0.5):
                res.echec("assistant de l'équipe", vue, "l'ordre de l'en-tête n'est pas promo, Assistant, compte (promo jusqu'à x %s, Assistant de %s à %s, compte dès x %s)"
                          % (e["promo"]["droite"], b["gauche"], b["droite"], c["gauche"]))
        if e["dehors"] or e["defile"] > e["W"]:
            res.echec("assistant de l'équipe", vue, "l'en-tête déborde de la fenêtre de %d px (page : %d px de contenu) : %s" % (e["W"], e["defile"], ", ".join(e["dehors"]) or "rien dans l'en-tête"))
        if largeur != sc.largeur:
            # La page ouverte à cette largeur : la même mesure que partout (débordements de côté, contrastes, zones à toucher).
            verifier_vue(page, res, sc, "assistant-en-tete@%d" % largeur, options)
    page.set_viewport_size({"width": sc.largeur, "height": HAUTEUR[sc.largeur]})
    attendre(page, calme=250)
    # Le tiroir « Plus » : son premier titre, et la ligne « Assistant » qu'il garde.
    vue = "%s/tiroir-plus" % sc.nom
    if cliquer(page, res, vue, '[data-nav-coquille] [data-nav-action="plus"]', "bouton « Plus »"):
        page.wait_for_timeout(250)
        t = page.evaluate("""() => ({ titres: [...document.querySelectorAll('[data-nav-coquille="plus"] .nav-fenetre-section')].map((e) => e.textContent.trim()),
            assistant: !!document.querySelector('[data-nav-coquille="plus"] [data-nav-action="assistant"]') })""")
        if "Autres pages" not in t["titres"] or "Tout l'espace formateur" in t["titres"]:
            res.echec("tiroir Plus", vue, "titres du tiroir : %s ; attendu « Autres pages » et plus « Tout l'espace formateur »" % (", ".join(t["titres"]) or "aucun"))
        if not t["assistant"]:
            res.echec("tiroir Plus", vue, "le tiroir n'a plus de ligne « Assistant »")
        elif cliquer(page, res, vue, '[data-nav-coquille="plus"] [data-nav-action="assistant"]', "ligne « Assistant » du tiroir"):
            page.wait_for_timeout(300)
            if page.evaluate("() => window.__verifNav.controlesAssistant()") is None:
                res.echec("tiroir Plus", vue, "la ligne « Assistant » du tiroir n'ouvre pas le panneau de l'assistant")
        page.keyboard.press("Escape")   # ferme le panneau de l'assistant ouvert par la ligne, ou le tiroir resté ouvert
        page.wait_for_timeout(250)
    vider_console(res, vue)


# Interrupteur éteint : les pages gardent leurs titres d'avant et la banque des bénévoles reste une fenêtre, comme sur main.
TITRES_AVANT = (
    # (route, équipe seulement, titre, surtitre, ce qui doit s'y lire en plus)
    ("stagiaires", True, "Stagiaires", "Formateurs", None),
    ("notes", False, "Notes & évaluations", None, None),
    ("themes", False, "Cours", None, None),
    ("calendrier", False, "Calendrier", None, None),
    ("ressources", False, "Ressources & contacts", None, "Contacts administration"),
    ("centre", True, None, "Tableau de bord du centre", None),
    ("mon-suivi", False, "Mon espace", "Espace personnel", None),
)


def verifier_titres_eteint(page, res, sc):
    """Interrupteur éteint : titres et surtitres de main (Calendrier, Ressources & contacts, Notes & évaluations, Cours, Tableau de bord du
    centre, Espace personnel...), page Stagiaires sans sous-onglets de page."""
    equipe = sc.role in ("prof", "fondateur")
    for route, equipe_seule, titre, surtitre, section in TITRES_AVANT:
        if equipe_seule and not equipe:
            continue
        vue = "%s/titre-avant/%s" % (sc.nom, route)
        res.vues += 1
        aller_a(page, "#/" + route)
        attendre(page)
        p = page.evaluate("() => window.__verifNav.enTeteDePage()")
        tete = p["entetes"][0] if p["entetes"] else {"titre": None, "surtitre": None}
        if p["route"] != route:
            continue   # une page que ce rôle n'ouvre pas (module fermé, rôle) : rien à comparer
        if titre and tete["titre"] != titre:
            res.echec("titre, interrupteur éteint", vue, "le titre de #/%s est « %s », celui de main « %s »" % (route, tete["titre"], titre))
        if route == "centre" and tete["titre"] != p["promo"]:
            res.echec("titre, interrupteur éteint", vue, "le titre de #/centre est « %s », celui de main est le nom de la promo (« %s »)" % (tete["titre"], p["promo"]))
        if surtitre and tete["surtitre"] != surtitre:
            res.echec("surtitre, interrupteur éteint", vue, "le surtitre de #/%s est « %s », celui de main « %s »" % (route, tete["surtitre"], surtitre))
        if route == "calendrier" and not (tete["surtitre"] or "").endswith("au calendrier"):
            res.echec("surtitre, interrupteur éteint", vue, "le surtitre de #/calendrier est « %s », celui de main compte les événements « N événement(s) au calendrier »" % tete["surtitre"])
        if route == "notes" and not COMPTE_NOTES.search((tete["surtitre"] or "") + "."):
            res.echec("surtitre, interrupteur éteint", vue, "le surtitre de #/notes est « %s », celui de main compte les notes « N note(s) enregistrée(s) »" % tete["surtitre"])
        if route == "ressources" and not re.fullmatch(r"\d+ liens curés · \d+ contacts", tete["surtitre"] or ""):
            res.echec("surtitre, interrupteur éteint", vue, "le surtitre de #/ressources est « %s », celui de main compte « N liens curés · M contacts »" % tete["surtitre"])
        if section and not any(section in s for s in p["sections"]):
            res.echec("titre, interrupteur éteint", vue, "#/%s n'a pas la section « %s » de main (sections : %s)" % (route, section, ", ".join(p["sections"]) or "aucune"))
        if route == "stagiaires" and page.evaluate("() => !!document.querySelector('#view .stg-page, #view .bnv-page')"):
            res.echec("page regroupée, interrupteur éteint", vue, "la page Stagiaires montre les sous-onglets de la nouvelle navigation")
        vider_console(res, vue)


def verifier_benevoles_eteint(page, res, sc):
    """Interrupteur éteint : le bouton « Élèves bénévoles » du Planning ouvre la fenêtre de main (avec son « Fermer »), sans quitter le
    Planning ; elle se ferme."""
    vue = "%s/planning/benevoles" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    bouton = page.locator('#view button[title^="Banque d\'élèves bénévoles"]')
    if not bouton.count():
        return   # pas de banque pour ce rôle (stagiaire)
    res.vues += 1
    bouton.first.click()
    page.wait_for_timeout(300)
    m = page.evaluate("() => ({ hash: location.hash, fenetre: !!document.querySelector('.modal-backdrop .bnv-modal'), "
                      "fermer: [...document.querySelectorAll('.bnv-modal button')].some((b) => b.textContent.trim() === 'Fermer') })")
    if m["hash"] != "#/planning" or not m["fenetre"]:
        res.echec("bénévoles, interrupteur éteint", vue, "le bouton mène à %s, fenêtre %s ; attendu la fenêtre de main sur #/planning" % (m["hash"], "ouverte" if m["fenetre"] else "absente"))
    elif not m["fermer"]:
        res.echec("bénévoles, interrupteur éteint", vue, "la fenêtre n'a plus son bouton « Fermer »")
    else:
        page.locator(".bnv-modal button", has_text="Fermer").first.click()
        page.wait_for_timeout(250)
        if page.locator(".modal-backdrop .bnv-modal").count():
            res.echec("bénévoles, interrupteur éteint", vue, "« Fermer » ne ferme pas la fenêtre")
    vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Nouveautés et textes propres à chaque navigation (lot 2A, tâche 1)
# --------------------------------------------------------------------------------------

# Les deux Nouveautés de lancement, propres à la nouvelle navigation : la première pour tous, la seconde pour les formateurs seulement.
TITRE_LANCEMENT = "Une navigation plus simple"
TITRE_LANCEMENT_EQUIPE = "Côté formateurs, la barre passe à gauche"
TITRE_ROLES = "Chacun ne voit que les promos où il intervient"   # lot 4 : Nouveauté pour les formateurs, plus récente que celles du lancement
# La Nouveauté pour tous des corrections communes aux deux navigations (vague finale, F3) : sans champ `navigation`, elle se lit avec les deux barres. Les
# trois entrées du jour de la mise en ligne portent la même date (29/10/2026) ; la première ajoute que certaines parties s'ouvrent au fil de la formation (F5).
TITRE_AFFICHAGE = "Des pages mieux tenues sur le téléphone"
DATE_DU_LANCEMENT = "29/10/2026"
PHRASE_DES_PARTIES = "Certaines parties s'ouvrent au fil de la formation."
# Les deux Nouveautés des bénévoles (pour les formateurs) : sous la nouvelle navigation, leur lien mène à Stagiaires, sous-onglet Élèves bénévoles (F8).
TITRES_DES_BENEVOLES = ("Banque d'élèves bénévoles avec leurs disponibilités", "Auto-écoles partenaires et suivi des venues")
# Celles qui ne décrivent que l'ancienne barre : cachées sous la nouvelle, lues avec l'ancienne.
TITRES_DE_L_ANCIENNE_BARRE = ("Une barre d'onglets plus simple", "L'app s'ouvre sur ton espace personnel", "Ton espace personnel sur téléphone : un sommaire")
# Le lien « Où le trouver » de Nouveautés d'avant, par titre : (libellé du stagiaire, libellé de l'équipe, libellé de main, adresse). L'adresse est la
# même partout : seul le libellé suit la navigation (js/ou-trouver.js), les redirections du lot 1 mènent l'ancienne adresse à sa nouvelle page.
# Un stagiaire est envoyé à Mes préférences, jamais à Réglages (la page de la promo, réservée à l'équipe) ; l'équipe, l'inverse.
OU_TROUVER = {
    "Les moyennes de la classe ne comptent que les stagiaires en formation":
        ("Mon suivi, partie Résultats", "Notes et examens, Synthèse classe", "Notes, Synthèse classe", "#/notes"),
    "Tes notes et ta fiche mieux protégées": ("Mon suivi, partie Résultats", "Notes et examens", "Notes", "#/notes"),
    "Ton Dossier Professionnel se remplit dans l'app":
        ("Mon suivi, partie Dossier pro", "Mon suivi, partie Dossier pro", "Mon espace personnel, partie Dossier pro", "#/mon-suivi/dp"),
    "Ton livret officiel TP-01303 se remplit dans l'app":
        ("Mon suivi, partie Livret EPCF", "Mon suivi, partie Livret EPCF", "Mon espace personnel, partie Livret", "#/mon-suivi/livret"),
    "Des vidéos conseillées dans la boîte à outils CCP2":
        ("Cours et QCM, Documents", "Cours et QCM, Documents", "Ressources, Examens", "#/ressources"),
    "Une boîte à outils numérique pour ton CCP2": ("Cours et QCM, Documents", "Cours et QCM, Documents", "Ressources", "#/ressources"),
    "Un passage oublié ? Ajoute-le toi-même, même ancien": ("Planning, Priorités", "Planning, Priorités", "Planning, bouton Priorités", "#/dashboard"),
    "Anonyme pour de vrai dans le tableau de notes": ("Mes préférences", "Mes préférences", "Paramètres, Mes préférences", "#/config"),
    "Les cours des 57 thèmes sont ouverts à toute la promo": ("Cours et QCM", "Cours et QCM", "Cours", "#/themes"),
    "Ta progression d'entraînement se voit d'un coup d'œil": ("Cours et QCM, colonne QCM", "Cours et QCM, colonne QCM", "Cours, colonne QCM", "#/themes"),
    # Lot 2B : l'Accueil de l'équipe s'appelle Aujourd'hui dans sa barre (même adresse) ; la journée n'existe pas avec l'ancienne barre (carte cachée).
    "Ta journée sur l'Accueil": ("Accueil", "Accueil", "(carte cachée avec l'ancienne barre)", "#/home"),
    "Les cours se lisent mieux sur téléphone": ("Cours et QCM", "Cours et QCM", "Cours", "#/themes"),
    # Lot 3 (tâche 11) : le choix de l'habillage, propre à la nouvelle navigation (décision H6) : Mes préférences, pour les deux espaces.
    "L'app aux couleurs d'ECF": ("Mes préférences", "Mes préférences", "(carte cachée avec l'ancienne barre)", "#/preferences"),
}
# Celles que seule l'équipe lit (puce « Formateurs ») : (libellé sous la nouvelle navigation, libellé de main, adresse).
OU_TROUVER_EQUIPE = {
    "Un tableau de bord du centre, promo par promo": ("Indicateurs", "Accueil, tuile Tableau de bord", "#/centre"),
    "Effacer les données d'un stagiaire, à sa demande": ("Réglages", "Paramètres", "#/config"),
    "Une page Stagiaires : toute la promo, une fiche par personne": ("Stagiaires", "Accueil, tuile Stagiaires", "#/stagiaires"),
    "Deux promos dans l'app, et des modules réglés promo par promo":
        ("La promo, en tête de la barre", "Pastille en haut, à côté de ton nom", "#/home"),
    "Les 57 cours sont dans l'app, à relire et à publier": ("Cours et QCM, colonne Cours", "Cours, colonne Cours", "#/themes"),
    "Banque d'élèves bénévoles avec leurs disponibilités": ("Stagiaires, Élèves bénévoles", "Planning, bouton Bénévoles", "#/planning"),
    "Auto-écoles partenaires et suivi des venues": ("Stagiaires, Élèves bénévoles", "Planning, bouton Bénévoles", "#/planning"),
    "Aujourd'hui remplace l'Accueil": ("Aujourd'hui", "(carte cachée avec l'ancienne barre)", "#/home"),
}
# Les liens dont l'adresse change sous la nouvelle navigation, parce que leur destination a vraiment changé de place : l'anonymat des notes est dans Mes
# préférences, pour les deux espaces (ruling R55, et non Réglages, qui ne garde que la promo), la banque des bénévoles sous Stagiaires (F8). Titre -> adresse.
ADRESSE_SOUS_LA_NOUVELLE = {"Anonyme pour de vrai dans le tableau de notes": "#/preferences",
                            "Banque d'élèves bénévoles avec leurs disponibilités": "#/stagiaires",
                            "Auto-écoles partenaires et suivi des venues": "#/stagiaires"}
# La première étape de « Comment faire », sous la nouvelle navigation puis avec celle de main. (Les étapes d'une Nouveauté qui nomme un geste de l'ancienne
# barre ont leur variante, `guideNouvelle` ; les deux Nouveautés qui ne décrivent que l'ancienne barre sont cachées.)
GUIDES = {
    # Consigne de « Signaler un problème » : juste dans les deux espaces sous la nouvelle barre (le stagiaire par ses initiales, l'équipe en pied de barre ou dans
    # « Plus »), celle de main avec l'ancienne (F4). Et le retour au jour de Planning, Semaine, « Revenir à aujourd'hui » depuis une autre semaine (audit du 09/11,
    # lot B ; la carte du lancement est cachée avec l'ancienne barre).
    "Signaler un problème en deux gestes":
        ("Ouvre ton compte avec tes initiales, en haut à droite, puis choisis « Signaler un problème ». Chez les formateurs, le bouton est en bas de la barre de "
         "gauche sur ordinateur, et dans « Plus » sur téléphone.", "Touche ton nom en haut de l'écran, ou ouvre l'Assistant."),
    TITRE_LANCEMENT:
        ("Dans Planning, Semaine, la journée du jour est repérée ; depuis une autre semaine, « Revenir à aujourd'hui » t'y ramène.", "(carte cachée avec l'ancienne barre)"),
    "Ton Dossier Professionnel se remplit dans l'app":
        ("Ouvre Mon suivi, dans la barre.", "Ouvre ton espace personnel avec le logo en haut à gauche."),
    "Ton livret officiel TP-01303 se remplit dans l'app":
        ("Ouvre Mon suivi, partie Livret EPCF.", "Renseigne ta date de naissance dans ton espace personnel si ce n'est pas déjà fait."),
    "Ta journée sur l'Accueil":
        ("Sur l'Accueil, la carte « Aujourd'hui » montre ton matin et ton après-midi. Quand la feuille d'émargement est ouverte, touche « Signer pour ce "
         "matin » (ou « Signer pour cet après-midi ») : la carte affiche ensuite l'heure de ta signature.", "(carte cachée avec l'ancienne barre)"),
    "Les cours se lisent mieux sur téléphone":
        ("Ouvre un cours : touche le titre d'un thème, ou son bouton « Cours ».", "Ouvre un cours : touche le titre d'un thème, ou son bouton « Cours »."),
    "L'app aux couleurs d'ECF":
        ("Ouvre le menu de ton compte : le rond à tes initiales, en haut à droite de l'écran (chez les formateurs, sur ordinateur, en bas de la barre de "
         "gauche).", "(carte cachée avec l'ancienne barre)"),
}
GUIDES_EQUIPE = {
    "Un tableau de bord du centre, promo par promo":
        ("Ouvre Indicateurs, dans la barre de gauche (groupe Promo) ; sur téléphone, dans « Plus ».", "Ouvre l'Accueil, puis la tuile « Tableau de bord »."),
    "Effacer les données d'un stagiaire, à sa demande":
        ("Réglages, partie Promo : « Abandon » sur le stagiaire concerné.", "Paramètres, partie Promo : « Abandon » sur le stagiaire concerné."),
    "Une page Stagiaires : toute la promo, une fiche par personne":
        ("Ouvre Stagiaires, dans la barre de gauche (sur téléphone, en bas de l'écran).", "Ouvre la tuile Stagiaires de l'Accueil."),
    "Deux promos dans l'app, et des modules réglés promo par promo":
        ("Touche la promo en tête de la barre de gauche (sur téléphone, en haut de l'écran).",
         "Touche la pastille de la promo en haut de l'écran (« Nîmes · mars 2026 »)."),
    "Aujourd'hui remplace l'Accueil":
        ("Ouvre Aujourd'hui, en haut de la barre de gauche sur ordinateur, en bas de l'écran sur téléphone.", "(carte cachée avec l'ancienne barre)"),
}
LIEN_DES_BENEVOLES = ("Stagiaires, Élèves bénévoles", "#/stagiaires")   # le lien de la Nouveauté de lancement de l'équipe
PIED_DE_L_ACCUEIL = {"ancienne": ("paramètres", "#/config"), "stagiaire": ("mes préférences", "#/preferences"), "equipe": ("réglages", "#/config")}
CTRL_Z = {"ancienne": "Ctrl + Z annule la dernière action. Sur Notes, Passages, Thèmes et Calendrier.",
          "nouvelle": "Ctrl + Z annule la dernière action. Sur les notes, les passages, les thèmes et les dates clés."}
SOCLE = {"ancienne": "Toujours ouverts : Accueil, Mon espace personnel (Passages), Paramètres, Nouveautés.",
         "nouvelle": "Toujours ouverts : Accueil, Mon suivi (Passages), Mes préférences, Nouveautés."}
LIEN_DOSSIER_PRO = "Ton dossier professionnel, à remplir dans l'app"
# Les trois Nouveautés du lot 2B (tâche 8), datées du jour de la fusion, lu dans js/nouveautes-data.js (rien à changer ici si elle se fait un autre jour). La
# journée et Aujourd'hui sont propres à la nouvelle navigation (la première pour les stagiaires, la seconde pour l'équipe) ; les cours se lisent dans les deux, masqués à un
# stagiaire dont la promo n'a pas ouvert la lecture des cours.
TITRE_JOURNEE = "Ta journée sur l'Accueil"
TITRE_AUJOURDHUI_EQUIPE = "Aujourd'hui remplace l'Accueil"
TITRE_QUESTIONNAIRES = "Ton avis sur la formation, sans ton nom"   # Qualiopi Q3, en ligne le jour même du lot 2B : hors de l'ordre du lot
TITRE_COURS_TELEPHONE = "Les cours se lisent mieux sur téléphone"
TITRE_COULEURS_ECF = "L'app aux couleurs d'ECF"   # lot 3, tâche 11 : pour tous, nouvelle navigation seulement (décision H6)
# La date vient de js/nouveautes-data.js, seule source : l'id de l'entrée de la journée porte AAAA-MM-JJ.
_ID_JOURNEE = re.search(r'id:\s*"(\d{4})-(\d{2})-(\d{2})-ta-journee-accueil"',
                        (pathlib.Path(__file__).resolve().parent.parent / "js" / "nouveautes-data.js").read_text(encoding="utf-8"))
DATE_DE_LA_FUSION = "%s/%s/%s" % (_ID_JOURNEE.group(3), _ID_JOURNEE.group(2), _ID_JOURNEE.group(1)) if _ID_JOURNEE else "?"


def verifier_liens_et_guides(res, vue, cartes, equipe, nouvelle, depart=False):
    """Le lien « Où le trouver » et la première étape de « Comment faire » de Nouveautés connues, selon la navigation : `nouvelle` (le libellé que la
    personne lit dans sa barre, celui de l'équipe ou du stagiaire) ou l'ancienne (celui de main, tel quel). L'adresse ne change jamais. Une carte absente
    (un module fermé pour ce stagiaire) n'est pas contrôlée, mais assez de cartes doivent l'avoir été pour que le contrôle ne passe pas à vide."""
    controlees = 0
    attendus = {titre: (v[1] if equipe else v[0], v[2], v[3]) for titre, v in OU_TROUVER.items()}
    if equipe:
        attendus.update({titre: (v[0], v[1], v[2]) for titre, v in OU_TROUVER_EQUIPE.items()})
    for titre, (libelle, libelle_de_main, adresse) in attendus.items():
        carte = cartes.get(titre)
        if carte is None:
            continue
        controlees += 1
        voulu = libelle if nouvelle else libelle_de_main
        if carte["ou"] is None:
            res.echec("Où le trouver", vue, "« %s » n'a pas de lien « Où le trouver »" % titre)
        else:
            if carte["ou"]["texte"] != voulu:
                res.echec("Où le trouver", vue, "« %s » : le lien dit « %s », attendu « %s » (%s)" % (
                    titre, carte["ou"]["texte"], voulu, "nouvelle navigation, " + ("équipe" if equipe else "stagiaire") if nouvelle else "ancienne navigation, texte de main"))
            voulue_href = ADRESSE_SOUS_LA_NOUVELLE.get(titre, adresse) if nouvelle else adresse
            if carte["ou"]["href"] != voulue_href:
                res.echec("Où le trouver", vue, "« %s » : le lien mène à %s, attendu %s" % (titre, carte["ou"]["href"], voulue_href))
    guides = dict(GUIDES)
    if equipe:
        guides.update(GUIDES_EQUIPE)
    for titre, (etape_nouvelle, etape_de_main) in guides.items():
        carte = cartes.get(titre)
        if carte is None:
            continue
        controlees += 1
        voulue = etape_nouvelle if nouvelle else etape_de_main
        if not carte["guide"] or carte["guide"][0] != voulue:
            res.echec("Comment faire", vue, "« %s » : la première étape est « %s », attendu « %s »" % (titre, (carte["guide"] or ["aucune"])[0], voulue))
    attendu_minimum = 2 if depart else 8
    if controlees < attendu_minimum:
        res.echec("Nouveautés", vue, "seulement %d Nouveauté(s) connue(s) contrôlée(s), au moins %d attendue(s) : le contrôle des liens ne serait pas éprouvé" % (controlees, attendu_minimum))


def verifier_nouveautes(page, res, sc):
    """La rubrique Nouveautés, nouvelle navigation allumée (lot 2A, tâche 1), jouée avant l'ouverture de la rubrique ailleurs : « Une navigation plus simple »
    pour tous, « Côté formateurs, la barre passe à gauche » pour l'équipe seulement (le fondateur en aperçu, sur une promo éteinte, voit les deux ; un
    stagiaire sans drapeau de fondateur d'une promo allumée ne voit que la première) ; aucune des Nouveautés qui ne décrivent que l'ancienne barre.
    Le « Où le trouver » de Nouveautés d'avant porte le nom que la personne lit dans sa barre, l'adresse restant celle de main, et leur « Comment faire » est
    celui de la nouvelle barre. Le lien de la Nouveauté de l'équipe ouvre le sous-onglet « Élèves bénévoles » de Stagiaires. Les mots de l'ancienne barre
    (« Mon espace », « Paramètres ») ne se lisent nulle part, hors du récit daté des anciennes Nouveautés : c'est le contrôle de chaque vue (motsDAvant)."""
    vue = "%s/nouveautes" % sc.nom
    res.vues += 1
    aller_a(page, "#/nouveautes")
    attendre(page)
    liste = page.evaluate("() => window.__verifNav.nouveautes()")
    cartes = {c["titre"]: c for c in liste}
    equipe = sc.espace == "equipe"
    if TITRE_LANCEMENT not in cartes:
        res.echec("Nouveauté de lancement", vue, "« %s » manque (nouvelle navigation allumée)" % TITRE_LANCEMENT)
    elif cartes[TITRE_LANCEMENT]["formateurs"]:
        res.echec("Nouveauté de lancement", vue, "« %s » porte la puce « Formateurs » : elle est pour tous" % TITRE_LANCEMENT)
    if equipe and TITRE_LANCEMENT_EQUIPE not in cartes:
        res.echec("Nouveauté de lancement", vue, "« %s » manque chez l'équipe" % TITRE_LANCEMENT_EQUIPE)
    # F5 : une promo de départ n'a pas encore tout ; F3 : les trois entrées du jour portent la date de la mise en ligne.
    if TITRE_LANCEMENT in cartes and PHRASE_DES_PARTIES not in cartes[TITRE_LANCEMENT]["resume"]:
        res.echec("Nouveauté de lancement", vue, "« %s » ne dit pas « %s »" % (TITRE_LANCEMENT, PHRASE_DES_PARTIES))
    for titre in (TITRE_LANCEMENT, TITRE_LANCEMENT_EQUIPE, TITRE_AFFICHAGE):
        if titre in cartes and cartes[titre]["date"] != DATE_DU_LANCEMENT:
            res.echec("Nouveauté de lancement", vue, "« %s » est datée du %s, attendu le %s (le jour de la mise en ligne)" % (titre, cartes[titre]["date"], DATE_DU_LANCEMENT))
    verifier_nouveaute_commune(res, vue, cartes)
    if TITRE_LANCEMENT_EQUIPE in cartes and not equipe:
        res.echec("Nouveauté de lancement", vue, "« %s » est montrée à un stagiaire : elle est pour les formateurs" % TITRE_LANCEMENT_EQUIPE)
    for titre in TITRES_DE_L_ANCIENNE_BARRE:
        if titre in cartes:
            res.echec("Nouveauté de l'ancienne barre", vue, "« %s » ne décrit que l'ancienne barre : elle n'est pas montrée sous la nouvelle" % titre)
    verifier_liens_et_guides(res, vue, cartes, equipe, True, depart=sc.modules == "depart" and not equipe)
    verifier_nouveautes_du_lot_2b(page, res, sc, vue, cartes, True)
    verifier_nouveaute_couleurs_ecf(res, vue, cartes, True)
    # Les liens vers la banque des bénévoles (la Nouveauté de lancement de l'équipe et, F8, les deux Nouveautés des bénévoles) : le libellé, l'adresse, puis le
    # geste (la mémoire du sous-onglet de Stagiaires, que la barre relit à son rendu).
    for titre in ((TITRE_LANCEMENT_EQUIPE,) + TITRES_DES_BENEVOLES) if equipe else ():
        if titre not in cartes:
            continue
        lien = cartes[titre]["ou"]
        if lien is None or (lien["texte"], lien["href"]) != LIEN_DES_BENEVOLES:
            res.echec("Nouveauté de lancement", vue, "le lien de « %s » est %s, attendu %s" % (titre, lien and (lien["texte"], lien["href"]), LIEN_DES_BENEVOLES))
            continue
        # La mémoire du sous-onglet de Stagiaires part du premier (l'exploration des sous-onglets, plus haut, a laissé le dernier ouvert : sans cela, le lien
        # passerait même sans écrire la mémoire) : c'est au lien de l'écrire.
        aller_a(page, "#/nouveautes")
        attendre(page)
        page.evaluate("(cle) => { try { localStorage.setItem(cle, 'stagiaires'); } catch (e) { /* stockage bloqué */ } }", CLE_SOUS_ONGLET_STAGIAIRES)
        if cliquer(page, res, vue, "#view .nv-carte:has-text(\"%s\") a.nv-ou" % titre, "lien « Où le trouver » de « %s »" % titre):
            attendre(page, calme=150)
            actif = page.evaluate("() => { const b = document.querySelector('#view .subtabs-bar > .subtab.active'); return b ? b.textContent.trim() : null; }")
            if route_courante(page) != "stagiaires" or actif != "Élèves bénévoles":
                res.echec("Nouveauté de lancement", vue, "le lien de « %s » ouvre #/%s, sous-onglet « %s » ; attendu Stagiaires, « Élèves bénévoles »" % (titre, route_courante(page), actif))
        # La mémoire de la barre de sous-onglets est rendue comme on l'a trouvée : les contrôles suivants partent du premier sous-onglet.
        page.evaluate("(cle) => { try { localStorage.removeItem(cle); } catch (e) { /* stockage bloqué */ } }", CLE_SOUS_ONGLET_STAGIAIRES)
    vider_console(res, vue)


def verifier_nouveautes_du_lot_2b(page, res, sc, vue, cartes, nouvelle):
    """Les trois Nouveautés du lot 2B (tâche 8). Nouvelle navigation : « Ta journée sur l'Accueil » pour les stagiaires seuls (sans puce « Formateurs »), « Aujourd'hui remplace
    l'Accueil » pour l'équipe seulement (avec la puce), « Les cours se lisent mieux sur téléphone » pour tous quand la lecture des cours est ouverte (toujours chez
    l'équipe) ; ancienne : les cours seuls. Toutes datées du jour de la fusion, avec un « Où le trouver » et un « Comment faire » d'au moins trois étapes (leurs
    textes sont contrôlés par verifier_liens_et_guides). Puis le geste : chaque lien « Où le trouver » ouvre sa page."""
    equipe = sc.espace == "equipe"
    cours_ouvert = equipe or page.evaluate("(cle) => window.__verifNav.moduleOuvert(cle)", "cours")
    attendues = {TITRE_JOURNEE: nouvelle and not equipe, TITRE_AUJOURDHUI_EQUIPE: nouvelle and equipe, TITRE_COURS_TELEPHONE: cours_ouvert}
    for titre, la in attendues.items():
        carte = cartes.get(titre)
        ou = "%s, %s" % ("équipe" if equipe else "stagiaire", "nouvelle navigation" if nouvelle else "ancienne navigation")
        if la and carte is None:
            res.echec("Nouveautés du lot 2B", vue, "« %s » manque (%s)" % (titre, ou))
            continue
        if not la:
            if carte is not None:
                res.echec("Nouveautés du lot 2B", vue, "« %s » est montrée (%s) : elle ne l'est pas ici" % (titre, ou))
            continue
        if carte["date"] != DATE_DE_LA_FUSION:
            res.echec("Nouveautés du lot 2B", vue, "« %s » est datée du %s, attendu le %s (le jour de la fusion)" % (titre, carte["date"], DATE_DE_LA_FUSION))
        if carte["formateurs"] != (titre == TITRE_AUJOURDHUI_EQUIPE):
            res.echec("Nouveautés du lot 2B", vue, "« %s » %s la puce « Formateurs »" % (titre, "porte" if carte["formateurs"] else "n'a pas"))
        if carte["ou"] is None or len(carte["guide"]) < 3:
            res.echec("Nouveautés du lot 2B", vue, "« %s » : « Où le trouver » %s, %d étape(s) de « Comment faire »" % (
                titre, "absent" if carte["ou"] is None else "présent", len(carte["guide"])))
    # Le geste : le lien « Où le trouver » ouvre la page qu'il nomme.
    for titre, route in ((TITRE_JOURNEE, "home"), (TITRE_AUJOURDHUI_EQUIPE, "home"), (TITRE_COURS_TELEPHONE, "themes")):
        if cartes.get(titre) is None or cartes[titre]["ou"] is None:
            continue
        aller_a(page, "#/nouveautes")
        attendre(page)
        if cliquer(page, res, vue, "#view .nv-carte:has-text(\"%s\") a.nv-ou" % titre, "lien « Où le trouver » de « %s »" % titre):
            attendre(page, calme=150)
            if route_courante(page) != route:
                res.echec("Nouveautés du lot 2B", vue, "le lien de « %s » ouvre #/%s, attendu #/%s" % (titre, route_courante(page), route))
    aller_a(page, "#/nouveautes")
    attendre(page)


def verifier_nouveaute_couleurs_ecf(res, vue, cartes, nouvelle):
    """La Nouveauté du choix de l'habillage (lot 3, tâche 11) : pour tous (sans puce « Formateurs »), nouvelle navigation seulement (le choix ne se fait que
    là, décision H6), avec un « Où le trouver » vers Mes préférences et un « Comment faire » d'au moins trois étapes, qui dit « Couleurs ECF » et « ECSR Promo »
    (le libellé et la première étape sont contrôlés par verifier_liens_et_guides)."""
    carte = cartes.get(TITRE_COULEURS_ECF)
    if not nouvelle:
        if carte is not None:
            res.echec("Nouveauté des couleurs d'ECF", vue, "« %s » est montrée avec l'ancienne barre : le choix ne se fait que sous la nouvelle (décision H6)" % TITRE_COULEURS_ECF)
        return
    if carte is None:
        res.echec("Nouveauté des couleurs d'ECF", vue, "« %s » manque (nouvelle navigation, pour tous)" % TITRE_COULEURS_ECF)
        return
    if carte["formateurs"]:
        res.echec("Nouveauté des couleurs d'ECF", vue, "« %s » porte la puce « Formateurs » : elle est pour tous" % TITRE_COULEURS_ECF)
    guide = " ".join(carte["guide"])
    if len(carte["guide"]) < 3 or "« Couleurs ECF »" not in guide or "« ECSR Promo »" not in guide or "Apparence" not in guide:
        res.echec("Nouveauté des couleurs d'ECF", vue, "« Comment faire » de « %s » : %d étape(s), attendu au moins 3 qui disent Apparence, « Couleurs ECF » et « ECSR Promo »"
                  % (TITRE_COULEURS_ECF, len(carte["guide"])))


def verifier_nouveaute_commune(res, vue, cartes):
    """La Nouveauté des corrections communes aux deux navigations (vague finale, F3) : pour tous (aucune puce « Formateurs »), qui parle des graphes des notes, de
    l'historique des passages, d'un stage « En cours » et des moyennes basses qui ne sont plus en rouge, sans nommer les « Indicateurs » ni le « tableau de bord »
    qu'un stagiaire ne voit pas."""
    carte = cartes.get(TITRE_AFFICHAGE)
    if carte is None:
        res.echec("Nouveauté pour tous", vue, "« %s » manque : elle est pour tous, dans les deux navigations" % TITRE_AFFICHAGE)
        return
    if carte["formateurs"]:
        res.echec("Nouveauté pour tous", vue, "« %s » porte la puce « Formateurs » : elle est pour tous" % TITRE_AFFICHAGE)
    for motif in ("graphes des notes", "historique des passages", "largeur de l'écran", "En cours", "moyennes basses", "rouge"):
        if motif not in carte["resume"]:
            res.echec("Nouveauté pour tous", vue, "« %s » ne dit pas « %s » : %s" % (TITRE_AFFICHAGE, motif, carte["resume"][:120]))
    dit = re.search(r"Indicateurs|tableau de bord", carte["resume"], re.IGNORECASE)
    if dit:
        res.echec("Nouveauté pour tous", vue, "« %s » nomme « %s », que les stagiaires ne voient pas" % (TITRE_AFFICHAGE, dit.group(0)))


def verifier_nouveautes_eteint(page, res, sc):
    """Interrupteur éteint : ni l'une ni l'autre des Nouveautés de lancement, même pour l'équipe ; les Nouveautés qui ne décrivent que l'ancienne barre sont
    là ; les « Où le trouver » et les « Comment faire » sont ceux de main, au caractère près. Joué aussi pour un stagiaire sans drapeau de fondateur
    dont l'appareil porte l'aperçu d'un fondateur (le réglage de la promo est éteint) : l'aperçu n'est pas pour lui, il reste sur l'ancienne navigation."""
    vue = "%s/nouveautes" % sc.nom
    res.vues += 1
    aller_a(page, "#/nouveautes")
    attendre(page)
    cartes = {c["titre"]: c for c in page.evaluate("() => window.__verifNav.nouveautes()")}
    for titre in (TITRE_LANCEMENT, TITRE_LANCEMENT_EQUIPE):
        if titre in cartes:
            res.echec("Nouveauté de lancement, interrupteur éteint", vue, "« %s » est montrée : elle est propre à la nouvelle navigation" % titre)
    for titre in TITRES_DE_L_ANCIENNE_BARRE:
        if titre not in cartes:
            res.echec("Nouveauté de l'ancienne barre", vue, "« %s » manque : avec l'ancienne navigation, elle se lit comme avant" % titre)
    # F3 : la Nouveauté des corrections communes vaut aussi avec l'ancienne barre.
    verifier_nouveaute_commune(res, vue, cartes)
    if TITRE_AFFICHAGE in cartes and cartes[TITRE_AFFICHAGE]["date"] != DATE_DU_LANCEMENT:
        res.echec("Nouveauté pour tous", vue, "« %s » est datée du %s, attendu le %s" % (TITRE_AFFICHAGE, cartes[TITRE_AFFICHAGE]["date"], DATE_DU_LANCEMENT))
    verifier_liens_et_guides(res, vue, cartes, sc.role in ("prof", "fondateur"), False)
    verifier_nouveautes_du_lot_2b(page, res, sc, vue, cartes, False)
    verifier_nouveaute_couleurs_ecf(res, vue, cartes, False)
    vider_console(res, vue)


def verifier_nouveautes_de_l_accueil(page, res, vue, equipe):
    """Accueil, nouvelle navigation : les Nouveautés de l'accueil commencent par la plus récente, « Ta journée sur l'Accueil » chez le stagiaire,
    « Aujourd'hui remplace l'Accueil » chez l'équipe (lot 2B) ; l'équipe voit aussi celle du lot 4 (rôles par promo). Appelé depuis l'accueil déjà ouvert.
    Une Nouveauté arrivée après le lot 2B passe devant : par sa date, ou à date égale par son rang dans le fichier (les questionnaires anonymes
    de Qualiopi Q3, mis en ligne le 09/11 comme le lot). La carte de l'accueil doit alors montrer celle que l'app classe en tête, et l'ordre
    du lot se vérifie parmi les Nouveautés datées jusqu'au jour du lot, celle des questionnaires mise à part, lues dans l'ordre que l'app
    calcule (js/modules-etat.js, le module même de la page)."""
    titres = [c["titre"] for c in page.evaluate("() => window.__verifNav.nouveautes()")]
    attendus = [TITRE_AUJOURDHUI_EQUIPE] if equipe else [TITRE_JOURNEE]
    if equipe and TITRE_ROLES not in titres:
        res.echec("Nouveautés de l'accueil", vue, "« %s » manque chez l'équipe" % TITRE_ROLES)
    ordre = page.evaluate("""async () => {
      const s = document.querySelector('script[type="module"][src*="js/main.js"]');
      const v = s ? new URL(s.src, location.href).search : "";
      const m = await import(new URL("js/modules-etat.js" + v, location.href).href);
      return m.nouveautesAffichables().entrees.map((e) => ({ titre: e.titre, date: e.date }));
    }""")
    if ordre and titres[:1] != [ordre[0]["titre"]]:
        res.echec("Nouveautés de l'accueil", vue, "les Nouveautés de l'accueil commencent par « %s », attendu la plus récente, « %s »" % (" », « ".join(titres[:1]), ordre[0]["titre"]))
    jour_du_lot = "-".join(reversed(DATE_DE_LA_FUSION.split("/")))
    titres = [o["titre"] for o in ordre if o["date"] <= jour_du_lot and o["titre"] != TITRE_QUESTIONNAIRES] if ordre else titres
    if titres[:len(attendus)] != attendus:
        res.echec("Nouveautés de l'accueil", vue, "les Nouveautés de l'accueil commencent par « %s », attendu « %s »" % (" », « ".join(titres[:len(attendus)]), " », « ".join(attendus)))


def verifier_pied_et_retenir(res, vue, m, navigation):
    """Les deux textes de l'accueil que les deux navigations ne disent pas pareil : la dernière ligne de « À retenir » (Ctrl + Z : « Sur Notes, Passages,
    Thèmes et Calendrier » avec l'ancienne, les noms de la nouvelle barre avec elle) et le lien de réglage du pied de page (« paramètres » avec l'ancienne ;
    avec la nouvelle, « mes préférences » chez un stagiaire, « réglages » chez l'équipe). `navigation` : « ancienne », « stagiaire » ou « equipe »."""
    attendu_retenir = CTRL_Z["ancienne" if navigation == "ancienne" else "nouvelle"]
    if m["retenir"] != attendu_retenir:
        res.echec("accueil, À retenir", vue, "la dernière ligne de « À retenir » est « %s », attendu « %s »" % (m["retenir"], attendu_retenir))
    texte, adresse = PIED_DE_L_ACCUEIL[navigation]
    if m["pied"] is None or (m["pied"]["texte"], m["pied"]["href"]) != (texte, adresse):
        res.echec("accueil, pied de page", vue, "le lien de réglage du pied est %s, attendu « %s » (%s)" % (m["pied"] and (m["pied"]["texte"], m["pied"]["href"]), texte, adresse))


def verifier_pied_de_l_accueil(res, vue, m, nouvelle):
    """Le pied de l'Accueil dit la promo et le rôle (vague finale, F7). Avec la nouvelle navigation : « TP ECSR App · Promo <nom de la promo affichée> · connecté en tant que
    <rôle> », le vrai rôle (audit du 09/11, A8) : l'aperçu « Voir en tant que » (« direction (aperçu) »), sinon « fondateur », sinon le rôle sur la promo
    (formateur, direction, siège, stagiaire), jamais « admin ». Avec l'ancienne : le texte de main, « Promo 2026 » écrit en dur, « admin » compris.
    Le rôle se déduit de la personne connectée, lue dans la page (aperçu, fondateur, rôles sur la promo, administrateur, rôle de profil)."""
    qui = m["qui"]
    if not nouvelle:
        role = "admin" if qui["admin"] else {"prof": "formateur", "stagiaire": "stagiaire"}.get(qui["role"], "")
    elif qui.get("apercu"):
        role = {"formateur": "formateur", "direction": "direction", "siege": "siège", "stagiaire": "stagiaire"}[qui["apercu"]] + " (aperçu)"
    elif qui.get("fondateur"):
        role = "fondateur"
    elif qui.get("roles") is not None:
        role = next((libelle for cle, libelle in (("formateur", "formateur"), ("direction", "direction"), ("siege", "siège"), ("stagiaire", "stagiaire"))
                     if cle in qui["roles"]), "")
    else:
        role = "formateur" if qui["admin"] else {"prof": "formateur", "stagiaire": "stagiaire"}.get(qui["role"], "")
    promo = ("Promo %s" % m["promo"]["nom"]) if nouvelle else "Promo 2026"
    attendu = "TP ECSR App · %s · connecté en tant que %s" % (promo, role) if role else "TP ECSR App · %s ·" % promo
    if m["piedTexte"] != attendu:
        res.echec("pied de l'accueil", vue, "le pied de page dit « %s », attendu « %s » (%s navigation)" % (m["piedTexte"], attendu, "nouvelle" if nouvelle else "ancienne"))


def verifier_contacts_du_centre(page, res, sc):
    """Menu du compte, nouvelle navigation (lot 2A, tâche 1) : la ligne « Contacts du centre » mène à #/ressources, que la redirection du lot 1 envoie à
    Cours et QCM, sous-onglet Documents, où sont les contacts : la page s'ouvre sur « Documents », avec sa section « Contacts du centre »."""
    vue = "%s/menus/contacts-du-centre" % sc.nom
    if not cliquer(page, res, vue, '[data-nav-coquille] button[data-nav-action="compte"]:visible', "bouton du compte"):
        return
    page.wait_for_timeout(300)
    if not cliquer(page, res, vue, '[data-nav-coquille="compte"] [role="dialog"] a.nav-fenetre-lien:has-text("Contacts du centre")', "ligne « Contacts du centre »"):
        page.keyboard.press("Escape")
        return
    attendre(page, calme=150)
    res.vues += 1
    p = page.evaluate("() => window.__verifNav.enTeteDePage()")
    tete = p["entetes"][-1] if p["entetes"] else None
    actif = page.evaluate("() => { const b = document.querySelector('#view .subtabs-bar > .subtab.active'); return b ? b.textContent.trim() : null; }")
    if p["route"] != "themes":
        res.echec("Contacts du centre", vue, "la ligne mène à #/%s, attendu Cours et QCM (#/themes)" % p["route"])
    elif tete is None or tete["titre"] != "Documents":
        res.echec("Contacts du centre", vue, "la page ouverte par la ligne a pour titre « %s », attendu « Documents »" % (tete and tete["titre"]))
    elif actif not in (None, "Documents"):
        res.echec("Contacts du centre", vue, "le sous-onglet allumé est « %s », attendu « Documents »" % actif)
    if p["route"] == "themes" and not any("Contacts du centre" in s for s in p["sections"]):
        res.echec("Contacts du centre", vue, "la page ouverte par la ligne n'a pas de section « Contacts du centre » (sections : %s)" % (", ".join(p["sections"]) or "aucune"))
    # La mémoire du sous-onglet de Cours (écrite par la redirection) est rendue comme on l'a trouvée.
    page.evaluate("(cle) => { try { localStorage.removeItem(cle); } catch (e) { /* stockage bloqué */ } }", CLE_SOUS_ONGLET_COURS)
    vider_console(res, vue)


def verifier_ccp2(page, res, sc):
    """Parcours CCP2, les deux navigations : le lien vers le dossier professionnel (étape 8) ne nomme plus ni Mon espace ni un sous-onglet, il dit « Ton
    dossier professionnel, à remplir dans l'app » et mène à la partie Dossier pro (#/mon-suivi/dp). Rien si CCP2 est fermé pour ce stagiaire. Et l'ordre de la
    page (lot 2B, tâche 8) : allumé, les dates, les étapes, puis l'épreuve repliée en bas ; éteint, l'ordre de main (verifier_page_ccp2)."""
    vue = "%s/ccp2/lien-dossier-pro" % sc.nom
    aller_a(page, "#/ccp2")
    attendre(page)
    if not page.evaluate("() => !!document.querySelector('#view .ccp2-etapes')"):
        return
    res.vues += 1
    lien = page.evaluate("() => window.__verifNav.lienDossierPro()")
    if lien is None:
        res.echec("parcours CCP2", vue, "le parcours n'a pas de lien vers le dossier professionnel (#/mon-suivi/dp)")
    elif lien["texte"] != LIEN_DOSSIER_PRO:
        res.echec("parcours CCP2", vue, "le lien vers le dossier professionnel dit « %s », attendu « %s »" % (lien["texte"], LIEN_DOSSIER_PRO))
    verifier_page_ccp2(page, res, "%s/ccp2/ordre" % sc.nom, sc.passe == "allume")
    vider_console(res, vue)


# L'ordre de la page CCP2 (lot 2B, tâche 8 ; ruling R66 : aucun avancement calculé). Allumé : l'en-tête, « Tes dates », « Les 8 étapes », puis « L'épreuve en bref »
# repliée en bas. Éteint : l'ordre de main, l'épreuve d'abord. « Tes dates » n'est là que si la promo a des dates CCP2 lisibles (Calendrier ouvert, lecture réussie).
ORDRE_CCP2 = {True: ["en-tête", "dates", "titre des étapes", "étapes", "épreuve repliée"], False: ["en-tête", "épreuve", "dates", "titre des étapes", "étapes"]}
TITRE_EPREUVE_CCP2 = "L'épreuve en bref"
CLE_ETAPE_CCP2 = "ecsr_ccp2_etape"


def verifier_page_ccp2(page, res, vue, allume, dates=None):
    """Mesure la page CCP2 ouverte : l'ordre de ses blocs, et, allumé, l'épreuve repliée à l'arrivée (résumé de 44 px au moins, chevron visible, titre) et un
    chevron sur chaque étape ; éteint, ni épreuve repliée ni chevron (main). `dates` : True (attendues), False (absentes : la page commence alors par les étapes,
    sans trou sous l'en-tête), None (selon la page). Rend la mesure."""
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.ccp2Page()")
    avec_dates = m["dates"] is not None if dates is None else dates
    attendu = [b for b in ORDRE_CCP2[allume] if avec_dates or b != "dates"]
    if m["blocs"] != attendu:
        res.echec("page CCP2", vue, "les blocs sont %s, attendu %s (%s navigation)" % (m["blocs"], attendu, "nouvelle" if allume else "ancienne"))
    if dates and (m["titreDates"] != "Tes dates" or not m["dates"]):
        res.echec("page CCP2", vue, "« Tes dates » manque ou est vide (titre %s, %s date(s))" % (m["titreDates"], len(m["dates"] or [])))
    if dates is False and m["ecart"] is not None and abs(m["ecart"] - m["margeEnTete"]) > 2:
        res.echec("page CCP2", vue, "sans dates, %d px séparent l'en-tête du titre des étapes, attendu %d (la marge de l'en-tête, sans trou)" % (m["ecart"], m["margeEnTete"]))
    if m["defile"]:
        res.echec("page CCP2", vue, "la page défile de côté")
    if len(m["etapes"]) != 8:
        res.echec("page CCP2", vue, "%d étape(s), attendu 8" % len(m["etapes"]))
    petites = [e["titre"] for e in m["etapes"] if e["hauteur"] < 44]
    if petites:
        res.echec("page CCP2", vue, "résumé d'étape sous 44 px : %s" % ", ".join(petites))
    if allume:
        e = m["epreuve"]
        if e is None:
            res.echec("page CCP2", vue, "« %s » n'est pas repliée en bas de page" % TITRE_EPREUVE_CCP2)
        else:
            if e["titre"] != TITRE_EPREUVE_CCP2:
                res.echec("page CCP2", vue, "la carte du bas s'appelle « %s », attendu « %s »" % (e["titre"], TITRE_EPREUVE_CCP2))
            if e["ouverte"]:
                res.echec("page CCP2", vue, "« %s » est ouverte à l'arrivée : elle doit être repliée" % TITRE_EPREUVE_CCP2)
            if e["hauteur"] < 44:
                res.echec("page CCP2", vue, "le résumé de « %s » fait %d px, 44 au moins" % (TITRE_EPREUVE_CCP2, e["hauteur"]))
            if not e["chevron"]:
                res.echec("page CCP2", vue, "« %s » n'a pas de repère d'ouverture (chevron) visible" % TITRE_EPREUVE_CCP2)
        sans = [x["titre"] for x in m["etapes"] if not x["chevron"]]
        if sans:
            res.echec("page CCP2", vue, "étape(s) sans repère d'ouverture (chevron) : %s" % ", ".join(sans))
    else:
        if m["epreuve"] is not None or any(x["chevron"] for x in m["etapes"]):
            res.echec("page CCP2, interrupteur éteint", vue, "l'épreuve repliée ou un chevron s'affiche avec l'ancienne navigation : main n'en a pas")
    return m


def jouer_ccp2(page, res, sc):
    """Page CCP2, nouvelle navigation (lot 2B, tâche 8), joué à 375 et 1 280 px pour chaque rôle : l'ordre avec « Tes dates » ; « L'épreuve en bref » repliée
    s'ouvre au clic et montre ses quatre points et ses trois liens, puis se referme ; une étape ouverte se rouvre au retour sur la page (et seule elle), l'épreuve
    restant repliée ; refermée, plus rien ne se rouvre. Puis la page sans dates, par une lecture du Calendrier en échec et, chez le stagiaire, par un Calendrier
    fermé : elle commence par les étapes, sans trou (l'équipe, qui voit les modules fermés, garde ses dates). Ces deux cas rechargent le banc : en dernier."""
    vue = "%s/ccp2/parcours" % sc.nom
    page.evaluate("(cle) => { try { localStorage.removeItem(cle); } catch (e) { /* stockage bloqué */ } }", CLE_ETAPE_CCP2)
    aller_a(page, "#/home")
    attendre(page)
    aller_a(page, "#/ccp2")
    attendre(page)
    if not page.evaluate("() => !!document.querySelector('#view .ccp2-etapes')"):
        res.echec("page CCP2", vue, "la page CCP2 ne s'ouvre pas")
        return
    try:
        page.wait_for_selector("#view .ccp2-dates:not([hidden])", timeout=4000)
    except ErreurPlaywright:
        pass   # l'échec est dit par la mesure
    m = verifier_page_ccp2(page, res, vue, True, dates=True)
    if any(e["ouverte"] for e in m["etapes"]):
        res.echec("page CCP2", vue, "une étape est ouverte à l'arrivée sans mémoire")
    # L'épreuve s'ouvre au clic, montre son contenu, et se referme.
    resume = "#view .ccp2-epreuve-repliee > summary"
    if cliquer(page, res, vue, resume, "résumé de « %s »" % TITRE_EPREUVE_CCP2):
        page.wait_for_timeout(250)
        e = page.evaluate("() => window.__verifNav.ccp2Page().epreuve")
        if not e or not e["ouverte"] or not e["corpsVisible"]:
            res.echec("page CCP2", vue, "« %s » ne s'ouvre pas au clic, ou son contenu ne se voit pas" % TITRE_EPREUVE_CCP2)
        elif (e["points"], e["liens"]) != (4, 3):
            res.echec("page CCP2", vue, "« %s » ouverte montre %d point(s) et %d lien(s), attendu 4 et 3" % (TITRE_EPREUVE_CCP2, e["points"], e["liens"]))
        if page.evaluate("() => window.__verifNav.ccp2Page().defile"):
            res.echec("page CCP2", vue, "l'épreuve ouverte fait défiler la page de côté")
        if cliquer(page, res, vue, resume, "résumé de « %s », pour la refermer" % TITRE_EPREUVE_CCP2):
            page.wait_for_timeout(250)
            if page.evaluate("() => window.__verifNav.ccp2Page().epreuve.ouverte"):
                res.echec("page CCP2", vue, "« %s » ne se referme pas au second clic" % TITRE_EPREUVE_CCP2)
    # L'étape ouverte la dernière fois se rouvre au retour, seule ; l'épreuve, elle, n'est jamais mémorisée.
    etape = "#view .ccp2-etapes > details:nth-child(3) > summary"
    if cliquer(page, res, vue, etape, "résumé de l'étape 3"):
        page.wait_for_timeout(250)
        titre = page.evaluate("() => window.__verifNav.ccp2Page().etapes[2].titre")
        cliquer(page, res, vue, resume, "résumé de « %s »" % TITRE_EPREUVE_CCP2)
        page.wait_for_timeout(150)
        aller_a(page, "#/planning")
        attendre(page)
        aller_a(page, "#/ccp2")
        attendre(page)
        m = page.evaluate("() => window.__verifNav.ccp2Page()")
        ouvertes = [x["titre"] for x in m["etapes"] if x["ouverte"]]
        if ouvertes != [titre]:
            res.echec("page CCP2", vue, "au retour, étape(s) ouverte(s) : %s ; attendu « %s », celle ouverte la dernière fois" % (ouvertes or "aucune", titre))
        if m["epreuve"] and m["epreuve"]["ouverte"]:
            res.echec("page CCP2", vue, "au retour, « %s » est ouverte : elle doit toujours arriver repliée" % TITRE_EPREUVE_CCP2)
        # Refermée, l'étape ne se rouvre plus.
        if cliquer(page, res, vue, etape, "résumé de l'étape 3, pour la refermer"):
            page.wait_for_timeout(250)
            aller_a(page, "#/home")
            attendre(page)
            aller_a(page, "#/ccp2")
            attendre(page)
            if any(x["ouverte"] for x in page.evaluate("() => window.__verifNav.ccp2Page()")["etapes"]):
                res.echec("page CCP2", vue, "une étape refermée se rouvre au retour")
    vider_console(res, vue)
    # Sans dates : la lecture du Calendrier échoue, puis le Calendrier est fermé pour la promo. La page commence par les étapes, sans trou.
    for cas, parametres in (("lecture-en-echec", {"panne": "agenda_events"}), ("calendrier-ferme", {"panne": "", "modules": "ccp2-sans-calendrier"})):
        vue_cas = "%s/ccp2/sans-dates/%s" % (sc.nom, cas)
        recharger_au_banc(page, "#/ccp2", **parametres)
        page.wait_for_timeout(300)
        if not page.evaluate("() => !!document.querySelector('#view .ccp2-etapes')"):
            res.echec("page CCP2", vue_cas, "la page CCP2 ne s'ouvre pas")
            continue
        # L'équipe voit les modules fermés pour la promo (les formateurs voient tout) : Calendrier fermé, ses dates restent.
        verifier_page_ccp2(page, res, vue_cas, True, dates=cas == "calendrier-ferme" and sc.espace == "equipe")
        res.console.clear()   # le « console.error » de la page est le but de l'essai : elle journalise la lecture qui échoue, la page reste entière
    # Le banc ordinaire, pour ce qui suit.
    recharger_au_banc(page, "#/ccp2", panne="", modules="")
    res.console.clear()


# --------------------------------------------------------------------------------------
# Lecteur de cours et Informations légales (lot 2B, tâche 1 ; ruling R52)
# --------------------------------------------------------------------------------------

# Ouverture des deux lecteurs : ils sont posés sur `body`, hors de `#view`, et rien dans la navigation ne les ouvre toujours au même
# endroit. On importe donc les modules par les mêmes adresses que l'app (même jeton `?v=`, donc la même instance), puis on les appelle.
OUVRIR_LECTEURS = {
    "cours": """async (jeton) => {
        const m = await import("./js/views/cours-reader.js?v=" + jeton);
        m.openCoursSheet({ numero: 22, titre: "Feux du véhicule" });
    }""",
    "legal": """async (jeton) => {
        const m = await import("./js/legal.js?v=" + jeton);
        m.ouvrirInformationsLegales();
    }""",
}

# Ce que le lecteur ouvert doit respecter, mesuré dans la page : rien ne se coupe sans se voir (le `overflow-x: clip` de
# `.cours-scroll` masque un débordement au lieu de le signaler), le sommaire passe à la ligne et ne défile pas, et les tableaux
# larges deviennent des listes sur téléphone (carte par ligne, titre de colonne devant chaque valeur), restent des tableaux au-delà.
JS_LECTEUR = r"""
(seuil) => {
  const pbs = [];
  const ov = document.querySelector(".cours-overlay");
  if (!ov) return ["aucun lecteur ouvert"];
  const zone = ov.querySelector(".cours-scroll");
  const W = document.documentElement.clientWidth;
  const tel = W < seuil;
  const nom = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "");
  const zr = zone.getBoundingClientRect();
  if (zone.scrollWidth > zone.clientWidth + 1) pbs.push(`la zone de lecture défile de côté (${zone.scrollWidth} px pour ${zone.clientWidth} px)`);
  let coupes = 0;
  for (const e of zone.querySelectorAll("*")) {
    if (e.closest("thead") || e instanceof SVGElement) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || getComputedStyle(e).visibility === "hidden") continue;
    const surplus = e.scrollWidth - e.clientWidth;
    if (e.clientWidth > 0 && surplus > 1 && coupes++ < 4) pbs.push(`${nom(e)} : ${e.scrollWidth} px de contenu pour ${e.clientWidth} px (coupé ou à défiler)`);
    if ((r.right > zr.right + 1 || r.left < zr.left - 1) && coupes++ < 4) pbs.push(`${nom(e)} sort de la zone de lecture (${Math.round(r.left)} à ${Math.round(r.right)} px pour ${Math.round(zr.left)} à ${Math.round(zr.right)})`);
  }
  const somm = ov.querySelector(".cours-sommaire");
  if (somm) {
    const s = getComputedStyle(somm);
    if (s.overflowX !== "visible") pbs.push(`le sommaire a overflow-x: ${s.overflowX}`);
    if (s.flexWrap !== "wrap") pbs.push(`le sommaire ne passe pas à la ligne (flex-wrap: ${s.flexWrap})`);
    if (tel && s.position !== "static") pbs.push(`le sommaire reste ${s.position} sur téléphone (il couvrirait le texte)`);
    if (tel) for (const b of somm.children) { const h = b.getBoundingClientRect().height; if (h < 43.5) pbs.push(`pastille du sommaire trop basse : ${Math.round(h)} px`); }
  }
  for (const t of ov.querySelectorAll(".cours-table")) {
    const largeur = t.querySelectorAll("thead th").length;
    const carte = tel && largeur > 2;
    const tr = t.querySelector("tbody tr");
    const td = t.querySelector("tbody td");
    if (!tr || !td) continue;
    const ent = [...t.querySelectorAll("thead th")].map((h) => h.textContent.trim());
    if (getComputedStyle(t).display !== (carte ? "block" : "table")) pbs.push(`tableau de ${largeur} colonnes en display ${getComputedStyle(t).display} (attendu ${carte ? "block" : "table"})`);
    t.querySelectorAll("tbody td").forEach((c, i) => {
      const attendu = ent[i % ent.length] || "";
      if ((c.dataset.label || "") !== attendu) pbs.push(`cellule ${i + 1} : data-label « ${c.dataset.label || ""} », attendu « ${attendu} »`);
    });
    if (carte) {
      const th = t.querySelector("thead").getBoundingClientRect();
      if (th.height > 1 && th.width > 1) pbs.push("l'en-tête du tableau reste visible sur téléphone");
      const av = getComputedStyle(td, "::before").content;
      if (!av || av === "none" || av === "normal") pbs.push("la cellule n'écrit pas le titre de sa colonne (::before vide)");
      if (getComputedStyle(td).display !== "block") pbs.push(`cellule en display ${getComputedStyle(td).display}`);
    } else if (largeur > 2 || !tel) {
      if (t.scrollWidth > t.parentElement.clientWidth + 1) pbs.push(`tableau plus large que la page (${t.scrollWidth} px pour ${t.parentElement.clientWidth} px)`);
    }
  }
  return pbs;
}
"""


def verifier_lecteur(page, res, sc, options):
    """Le lecteur de cours (un cours à sommaire de six sections, un tableau de cinq colonnes, un de deux) et les Informations légales : à 375 puis
    320 px (téléphone), à 1 280 px (ordinateur), sans rien qui défile de côté ni se coupe sans se voir. Joué dans les deux navigations."""
    largeurs = {375: (375, LARGEUR_ETROITE), 1280: (1280,)}.get(sc.largeur)
    if not largeurs:
        return
    # Le jeton des imports, tel que l'import map du banc les écrit (`./js/legal.js?v=<jeton>`) : l'adresse de l'app, donc sa propre instance du module.
    jeton = page.evaluate(r"""() => (document.querySelector('script[type="importmap"]')?.textContent.match(/legal\.js\?v=([^"]+)"/) || [])[1] || ''""")
    if not jeton:
        res.echec("lecteur de cours", sc.nom, "le jeton des imports (?v=) ne se lit pas dans l'import map du banc : lancer `node _harness_build.mjs`")
        return
    try:
        for lecteur, ouvrir in OUVRIR_LECTEURS.items():
            for largeur in largeurs:
                vue = "%s/lecteur/%s@%d" % (sc.nom, lecteur, largeur)
                page.set_viewport_size({"width": largeur, "height": HAUTEUR[largeur]})
                page.evaluate(ouvrir, jeton)
                page.wait_for_selector(".cours-overlay .cours-body .cours-table, .cours-overlay .cours-body .legal-titre", timeout=4000)
                page.wait_for_timeout(150)
                verifier_vue(page, res, sc, vue, options)
                for detail in page.evaluate(JS_LECTEUR, SEUIL_TELEPHONE):
                    res.echec("lecteur de cours", vue, detail)
                page.evaluate("() => { document.querySelectorAll('.cours-overlay').forEach((o) => o.remove()); document.body.classList.remove('cours-open'); }")
    finally:
        page.set_viewport_size({"width": sc.largeur, "height": HAUTEUR[sc.largeur]})
        page.evaluate("() => { document.querySelectorAll('.cours-overlay').forEach((o) => o.remove()); document.body.classList.remove('cours-open'); }")
        attendre(page, calme=150)


def jouer_ressources_fermees(page, res, sc, options):
    """Le module Ressources est fermé pour la promo (lot 2A, tâche 1) : les contacts du centre, qui sont dans Cours et QCM > Documents, ne sont plus pour les
    stagiaires, et la ligne « Contacts du centre » de leur menu du compte disparaît avec eux (elle ne mènerait nulle part). L'équipe, qui voit tout, la garde."""
    regles = regles_de_la_page(page, res, sc)
    preparer_coquille(page, res, sc, regles)
    if not res.coquille:
        return
    vue = "%s/menus/contacts-du-centre" % sc.nom
    res.vues += 1
    if not cliquer(page, res, vue, '[data-nav-coquille] button[data-nav-action="compte"]:visible', "bouton du compte"):
        return
    page.wait_for_timeout(300)
    m = page.evaluate("() => window.__verifNav.menuDuCompte()")
    libelles = [l["libelle"] for l in (m or {"lignes": []})["lignes"]]
    if "Mes préférences" not in libelles:
        res.echec("menu du compte", vue, "le menu du compte ne s'ouvre pas (lignes : %s)" % ", ".join(libelles))
    elif sc.espace == "equipe" and "Contacts du centre" not in libelles:
        res.echec("Contacts du centre", vue, "l'équipe voit tous les modules : la ligne « Contacts du centre » manque (lignes : %s)" % ", ".join(libelles))
    elif sc.espace != "equipe" and "Contacts du centre" in libelles:
        res.echec("Contacts du centre", vue, "Ressources est fermé pour la promo : la ligne « Contacts du centre » ne mène nulle part chez un stagiaire")
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)
    vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Planning et accueil du stagiaire, décompte des événements, bandeau d'émargement (lot 2A, tâche 4)
# --------------------------------------------------------------------------------------

# Moyennes EPCF de la classe que le faux Supabase rend (RPC epcf_moyennes ; le banc n'en sert aucune de lui-même, et rend la même liste aux deux
# épreuves) : (critère, moyenne, effectif). Deux critères de la grille salle sur 3 et 2 stagiaires, un troisième sur un seul (sous le k-anonymat de 2 :
# jamais montré), un de la grille véhicule sur 3. Posées dans tous les scénarios (nouveau_contexte).
MOYENNES_EPCF_DU_BANC = {"salle": [("PREP1", 1.5, 3), ("PREP2", 1, 2), ("ANIM1", 0.5, 1)], "vehicule": [("COND1", 1.8, 3)]}
# Les notes que le banc sert (lot 2A, tâche 5), pour que chaque teinte de l'échelle des notes soit dessinée : (stagiaire, thème, note, date).
# Moyennes par stagiaire : Cassandre 4 (sous 8), Anissa 8 et Timy 10,2 (sous 12), Valentin 13 (sous 16), Lorie 19 (au-dessus), Céline sans note ;
# par thème : le 22 à 7,3 (sous 8), le 23 à 12,8 ; les cinq tranches de la répartition ont au moins une note.
# Timy, le stagiaire du banc, a vingt notes réparties sur sept mois (d'avril à octobre, trois par mois, deux en octobre) : à 375 px, le graphe de
# Mon évolution y a des bandes de mois de 30 à 38 unités pour des libellés de 10 px qui en mesurent jusqu'à 37 (tour de correction 1) ; ses
# points dessinent les quatre teintes (4, 7 et 6 sous 8 ; 8 à 11 ; 12 à 14 ; 16).
NOTES_DU_BANC = [(1, 22, 4, "2026-04-08"), (1, 22, 7, "2026-04-15"), (1, 23, 10, "2026-04-29"),
                 (1, 23, 12, "2026-05-06"), (1, 22, 9, "2026-05-20"), (1, 23, 13, "2026-05-27"),
                 (1, 22, 8, "2026-06-03"), (1, 23, 11, "2026-06-17"), (1, 22, 6, "2026-06-24"),
                 (1, 23, 14, "2026-07-01"), (1, 23, 10, "2026-07-08"), (1, 23, 12, "2026-07-15"),
                 (1, 22, 9, "2026-08-19"), (1, 23, 16, "2026-08-26"), (1, 22, 8, "2026-08-28"),
                 (1, 23, 11, "2026-09-02"), (1, 23, 10, "2026-09-16"), (1, 23, 12, "2026-09-30"),
                 (1, 22, 9, "2026-10-07"), (1, 23, 13, "2026-10-21"),
                 (2, 22, 8, "2026-09-12"), (3, 23, 18, "2026-09-14"), (3, 23, 20, "2026-10-02"),
                 (4, 22, 9, "2026-09-16"), (4, 23, 17, "2026-10-05"), (5, 22, 3, "2026-09-18"), (5, 23, 5, "2026-10-06")]


def stats_notes_du_banc(notes):
    """Ce que le faux serveur rend aux stagiaires (RPC notes_stats_groupe) : la forme et les définitions de js/notes-stats.js (statsLocales)
    appliquées aux notes du banc, toutes sur 20 et toutes de stagiaires en formation. Calculé ici plutôt qu'écrit : changer les notes change
    les chiffres avec elles (statsLocales de js/notes-stats.js, joué sous node sur la même liste, a servi à les vérifier)."""
    notes_sur_20 = [note for (_, _, note, _) in notes]
    par_theme, par_stagiaire = {}, {}
    for sid, theme, note, _ in notes:
        par_theme.setdefault(theme, []).append(note)
        par_stagiaire.setdefault(sid, []).append(note)
    moyennes = [sum(l) / len(l) for l in par_stagiaire.values()]
    tranches = [(0, 4), (4, 8), (8, 12), (12, 16), (16, 20.01)]
    return {"n_lignes": len(notes_sur_20), "n": len(notes_sur_20), "somme": sum(notes_sur_20), "mediane": statistics.median(notes_sur_20),
            "sous_10": sum(1 for s in notes_sur_20 if s < 10),
            "repartition": [sum(1 for s in notes_sur_20 if bas <= s < haut) for bas, haut in tranches],
            "themes": [{"num": num, "n": len(l), "somme": sum(l), "mediane": statistics.median(l)} for num, l in sorted(par_theme.items())],
            "competences": [], "moy_stagiaire_max": max(moyennes), "moy_stagiaire_min": min(moyennes)}


STATS_NOTES_DU_BANC = stats_notes_du_banc(NOTES_DU_BANC)
K_ANONYMAT = 2    # une moyenne de la classe n'est montrée qu'à partir de 2 stagiaires évalués (SEUIL_MOYENNE_EPCF, js/epcf-classe-rules.js)
DATE_AGENDA_VIDE = "2027-01-15"   # après le dernier événement de l'agenda du banc (11/12/2026) : l'accueil n'a plus d'événement à venir

# Hauteur du bandeau d'émargement de main sur téléphone, horaires affichés, sur deux lignes : 61 px. Sur une ligne, avec son bouton de 44 px, il ne doit pas la dépasser.
HAUTEUR_BANDEAU_DEUX_LIGNES = 61

# La fin d'un sous-titre, quand la nouvelle navigation y remet le compte de l'ancien surtitre (R49) : « 12 notes enregistrées. »
COMPTE_NOTES = re.compile(r"\d+ notes? enregistrées?\.$")


def pluriel(n):
    return "s" if n > 1 else ""


def lundi_de(jour):
    return jour - datetime.timedelta(days=jour.weekday())


def ligne_promo_attendue(promo, aujourdhui):
    """« Promo <nom> · semaine <n> » : la semaine 1 est celle du premier jour de la promo (du lundi au dimanche) ; pas de numéro avant la promo ni
    après sa date de fin. Recalculé ici, sans reprendre le code de l'app."""
    debut = datetime.date.fromisoformat(promo["debut"])
    fin = datetime.date.fromisoformat(promo["fin"]) if promo["fin"] else None
    if aujourdhui < debut or (fin and aujourdhui > fin):
        return "Promo %s" % promo["nom"]
    return "Promo %s · semaine %d" % (promo["nom"], 1 + (lundi_de(aujourdhui) - lundi_de(debut)).days // 7)


def carte_attendue(evenements, aujourdhui):
    """(événement, état, jours) de la carte « Prochain événement majeur » : le premier examen ou stage qui n'est pas passé, dans l'ordre de l'agenda ;
    None sans événement majeur à venir. « a-venir » : jours jusqu'au début ; « en-cours » : commencé avant aujourd'hui, jours jusqu'à la fin. Recalculé
    ici, sans reprendre le code de l'app."""
    for e in evenements:
        if e["type"] not in ("examen", "stage"):
            continue
        debut = datetime.date.fromisoformat(e["debut"])
        fin = datetime.date.fromisoformat(e["fin"] or e["debut"])
        if aujourdhui > fin:
            continue
        if aujourdhui > debut:
            return e, "en-cours", (fin - aujourdhui).days
        return e, "a-venir", (debut - aujourdhui).days
    return None


def verifier_carte(res, vue, m):
    """La carte « Prochain événement majeur » (correction pour tous, les deux navigations) : le premier examen ou stage qui n'est pas passé, jamais un
    nombre négatif. Commencé, il est « En cours, fin dans N jours » (« fin demain », « fin aujourd'hui ») et sa pastille dit « En cours », sans nombre ni
    habillage de compte à rebours (vague finale, F9) ; à venir, il garde sa pastille d'avant (N jours, « Aujourd'hui ! » le jour même), sans ligne « en cours »."""
    attendu = carte_attendue(m["evenements"], datetime.date.fromisoformat(DATE_DU_BANC))
    carte = m["carte"]
    if attendu is None:
        if carte:
            res.echec("carte du prochain événement", vue, "la carte montre « %s » alors qu'aucun examen ni stage n'est à venir" % carte["titre"])
        return
    evenement, etat, jours = attendu
    if not carte:
        res.echec("carte du prochain événement", vue, "la carte « Prochain événement majeur » manque (attendu : « %s », %s)" % (evenement["titre"], etat))
        return
    if carte["titre"] != evenement["titre"]:
        res.echec("carte du prochain événement", vue, "la carte montre « %s », le premier examen ou stage qui n'est pas passé est « %s »" % (carte["titre"], evenement["titre"]))
    dit = "%s %s" % (carte["pastille"] or "", carte["statut"] or "")
    if re.search(r"[-−]\s*\d", dit):
        res.echec("carte du prochain événement", vue, "la carte montre un nombre négatif : « %s »" % dit.strip())
    # Un événement commencé : « En cours », sans nombre ni habillage de compte à rebours (jamais « Aujourd'hui ! » pour un stage qui finit aujourd'hui) ; un
    # événement à venir : les jours avant son début, habillés selon l'urgence (vague finale, F9).
    if etat == "en-cours":
        pastille, habillage = "En cours", "en-cours"
    else:
        pastille = "%d %s" % (jours, "Aujourd'hui !" if jours == 0 else "jour" if jours == 1 else "jours")
        habillage = "today" if jours == 0 else "soon" if jours <= 7 else "later"
    if carte["pastille"] != pastille:
        res.echec("carte du prochain événement", vue, "la pastille dit « %s », attendu « %s » (%s%s)"
                  % (carte["pastille"], pastille, etat, ", %d jour(s) jusqu'à son début" % jours if etat == "a-venir" else " : « En cours », sans nombre"))
    classes = (carte["classe"] or "").split()
    autres = [c for c in classes if c in ("today", "soon", "later", "en-cours") and c != habillage]
    if habillage not in classes or autres:
        res.echec("carte du prochain événement", vue, "la pastille porte l'habillage « %s », attendu « %s » (%s)" % (" ".join(classes), habillage, etat))
    if etat == "en-cours":
        mots = "fin aujourd'hui" if jours == 0 else "fin demain" if jours == 1 else "fin dans %d jours" % jours
        if carte["statut"] != "En cours, " + mots:
            res.echec("carte du prochain événement", vue, "la ligne de l'événement commencé est « %s », attendu « En cours, %s »" % (carte["statut"], mots))
    elif carte["statut"]:
        res.echec("carte du prochain événement", vue, "un événement à venir porte la ligne « %s » : seul un événement commencé est en cours" % carte["statut"])


def attendre_accueil(page, sauf=""):
    """L'accueil lit l'agenda après s'être posé : la carte et la liste n'y sont qu'une fois le « Chargement… » de la liste remplacé. `sauf` : la zone d'une carte
    qu'on n'attend pas (la carte « à traiter » d'Aujourd'hui quand ses lectures n'aboutissent pas)."""
    page.wait_for_function("(sauf) => { const l = document.getElementById('home-agenda-list'); return (!l || !/Chargement/.test(l.textContent))"
                           " && ![...document.querySelectorAll('#view .acc-carte')].some((c) => c.dataset.zone !== sauf && /Chargement/.test(c.querySelector('.acc-corps').textContent)); }",
                           arg=sauf, timeout=6000)


def ouvrir_accueil(page, res, vue):
    """L'accueil, posé et son agenda lu : ce que la page montre (accueil() de la page), ou None quand l'agenda ne se lit pas."""
    aller_a(page, "#/home")
    attendre(page)
    try:
        attendre_accueil(page)
    except DelaiDepasse:
        res.echec("accueil", vue, "la liste des prochains événements reste en « Chargement… »")
        return None
    res.vues += 1
    return page.evaluate("() => window.__verifNav.accueil()")


def verifier_accueil(page, res, sc):
    """Accueil, nouvelle navigation, les deux espaces : le logo n'y est qu'une fois (celui de la coquille, pas un second à côté de la date), la phrase qui
    énumérait les pages de l'ancienne barre est remplacée par « Promo <nom> · semaine <n> », aucune tuile ne double la barre. Le stagiaire a sa page
    (lot 2B, tâche 3), l'équipe la sienne, Aujourd'hui (tâche 4)."""
    vue = "%s/accueil" % sc.nom
    equipe = sc.espace == "equipe"
    if equipe and sc.a_traiter == "lent":
        # Les lectures « à traiter » n'aboutissent pas : la carte « À traiter » reste en « Chargement… » sans retenir le reste de la page.
        aller_a(page, "#/home")
        attendre(page)
        attendre_accueil(page, sauf="a-traiter")
        res.vues += 1
        m = page.evaluate("() => window.__verifNav.accueil()")
    else:
        m = ouvrir_accueil(page, res, vue)
    if m is None:
        return
    if m["logos"]:
        res.echec("accueil", vue, "%d logo(s) à côté de la date : la coquille porte déjà le logo" % m["logos"])
    if m["tuiles"]:
        res.echec("accueil", vue, "des tuiles doublent la barre : %s" % ", ".join(m["tuiles"]))
    if not equipe:
        attendue = ligne_promo_attendue(m["promo"], datetime.date.fromisoformat(DATE_DU_BANC))
        if m["lead"] != attendue:
            res.echec("accueil", vue, "la ligne sous la salutation est « %s », attendu « %s »" % (m["lead"], attendue))
        # Lot 2A, tâche 1 : les Nouveautés du lancement ouvrent la section ; la ligne Ctrl + Z et le lien du pied portent les noms de la nouvelle barre.
        verifier_nouveautes_de_l_accueil(page, res, vue, False)
    verifier_pied_de_l_accueil(res, vue, m, True)
    if equipe:
        # Lot 2B, tâche 4 : Aujourd'hui (l'émargement, ce qui est à traiter, au tableau, en voiture, à suivre de près) ; ni Nouveautés (le compte les porte), ni
        # « À retenir » (passé dans Mes préférences), ni compte à rebours, ni liste d'événements.
        verifier_aujourdhui_equipe(page, res, sc, vue)
    else:
        # Lot 2B, tâche 3 : le stagiaire a sa page (la journée, à faire, prochain rendez-vous) ; ni « À retenir » (passé dans Mes préférences), ni
        # compte à rebours, ni liste d'événements : la carte « Prochain événement majeur » n'existe plus de son côté.
        verifier_accueil_stagiaire(page, res, sc, vue)
    vider_console(res, vue)


JOURS_DE_LA_SEMAINE = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
MOIS_DE_L_ANNEE = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")
ZONES_DE_L_ACCUEIL = (("aujourdhui", "Aujourd'hui"), ("afaire", "À faire"), ("rendez-vous", "Prochain rendez-vous"), ("nouveaute", "Nouveauté"))
LIGNES_A_FAIRE = ("Examen ouvert", "QCM du thème", "Dossier professionnel", "Livret EPCF")   # l'ordre de la page : examen, QCM, dossier, livret


def verifier_accueil_stagiaire(page, res, sc, vue, jour=None):
    """Accueil du stagiaire, nouvelle navigation (lot 2B, tâche 3) : la pastille de date (jour, numéro, mois, sans l'année), les quatre cartes dans l'ordre (sur
    téléphone, « À faire » juste sous la journée), aucune tuile, ni « Prochains événements », ni compte à rebours, ni « À retenir » ; les lignes de « À faire »
    dans l'ordre examen, QCM, dossier, livret, vers leur page ; au départ (`?modules=depart`), QCM, dossier et livret fermés : plus aucune de ces lignes ; la
    journée porte le bouton « Signer pour ce matin » dans la rangée Matin, et le bandeau d'émargement ne dit pas « Signer » ici ; le pied de liens ;
    zones à toucher de 44 px sur téléphone ; rien ne déborde, rien ne se recouvre."""
    m = page.evaluate("() => window.__verifNav.accueilStagiaire()")
    jour = jour or datetime.date.fromisoformat(DATE_DU_BANC)
    telephone = sc.largeur < SEUIL_TELEPHONE
    attendu = [JOURS_DE_LA_SEMAINE[jour.weekday()], str(jour.day), MOIS_DE_L_ANNEE[jour.month - 1]]
    if not m["pastille"] or [x.lower() for x in m["pastille"]["parties"]] != attendu:
        res.echec("accueil du stagiaire", vue, "la pastille de date dit %s, attendu %s (jour, numéro, mois, sans l'année)" % (m["pastille"] and m["pastille"]["parties"], attendu))
    if m["tuiles"] or m["agenda"] or m["decompte"] or m["retenir"]:
        res.echec("accueil du stagiaire", vue, "l'Accueil montre encore des éléments d'avant : %d tuile(s), liste d'événements %s, compte à rebours %s, « À retenir » %s"
                  % (m["tuiles"], m["agenda"], m["decompte"], m["retenir"]))
    zones = [c["zone"] for c in m["cartes"]]
    if zones != [z for z, _ in ZONES_DE_L_ACCUEIL]:
        res.echec("accueil du stagiaire", vue, "les cartes sont %s, attendu %s" % (zones, [z for z, _ in ZONES_DE_L_ACCUEIL]))
        return
    for carte, (_, titre) in zip(m["cartes"], ZONES_DE_L_ACCUEIL):
        if carte["titre"] != titre:
            res.echec("accueil du stagiaire", vue, "la carte « %s » s'appelle « %s »" % (titre, carte["titre"]))
    par = {c["zone"]: c for c in m["cartes"]}
    if m["chargements"]:
        res.echec("accueil du stagiaire", vue, "%d carte(s) restent en « Chargement… »" % m["chargements"])
    if m["debordement"]:
        res.echec("accueil du stagiaire", vue, "la page défile de côté à %d px" % sc.largeur)
    # Aucune carte n'en recouvre une autre.
    for i, a in enumerate(m["cartes"]):
        for b in m["cartes"][i + 1:]:
            if a["haut"] < b["bas"] - 1 and b["haut"] < a["bas"] - 1 and a["gauche"] < b["droite"] - 1 and b["gauche"] < a["droite"] - 1:
                res.echec("accueil du stagiaire", vue, "les cartes « %s » et « %s » se recouvrent" % (a["titre"], b["titre"]))
    # Téléphone : une colonne, la journée puis « À faire » juste dessous, puis le reste. Ordinateur : « À faire » sous la journée.
    if telephone:
        ordre = [c["haut"] for c in m["cartes"]]
        if ordre != sorted(ordre):
            res.echec("accueil du stagiaire", vue, "sur téléphone, les cartes ne sont pas dans l'ordre journée, à faire, rendez-vous, nouveauté")
        if par["afaire"]["haut"] - par["aujourdhui"]["bas"] > 24:
            res.echec("accueil du stagiaire", vue, "sur téléphone, « À faire » est à %d px sous la journée : il doit la suivre" % (par["afaire"]["haut"] - par["aujourdhui"]["bas"]))
    elif par["afaire"]["haut"] < par["aujourdhui"]["bas"] - 1:
        res.echec("accueil du stagiaire", vue, "« À faire » remonte à côté de la journée au lieu de la suivre")
    # « À faire »
    titres = [l["titre"] for l in m["lignes"]]
    rang = [next((i for i, t in enumerate(LIGNES_A_FAIRE) if x.startswith(t)), None) for x in titres]
    if None in rang or rang != sorted(rang) or len(titres) > 4:
        res.echec("accueil du stagiaire", vue, "les lignes de « À faire » sont %s : au plus 4, dans l'ordre %s" % (titres, " ; ".join(LIGNES_A_FAIRE)))
    adresses = {"Examen ouvert": "#/themes", "QCM du thème": "#/themes", "Dossier professionnel": "#/mon-suivi/dp", "Livret EPCF": "#/mon-suivi/livret"}
    for l in m["lignes"]:
        for debut, href in adresses.items():
            if l["titre"].startswith(debut) and l["href"] != href:
                res.echec("accueil du stagiaire", vue, "la ligne « %s » mène à %s, attendu %s" % (l["titre"], l["href"], href))
    if sc.modules == "depart":
        if titres or "Rien à faire pour le moment." not in par["afaire"]["texte"]:
            res.echec("accueil du stagiaire", vue, "QCM, Dossier et Livret sont fermés : « À faire » ne propose plus de ligne (%s)" % (titres or par["afaire"]["texte"]))
    elif not any(t.startswith("Livret EPCF") or t.startswith("Dossier") for t in titres):
        res.echec("accueil du stagiaire", vue, "« À faire » ne propose ni le dossier ni le livret alors que ces modules sont ouverts (%s)" % (titres or par["afaire"]["texte"]))
    # La journée : une rangée Matin avec le bouton, aucun bouton ailleurs ; le bandeau ne dit pas « Signer » sur cette page.
    if jour.weekday() < 5:
        matin = next((c for c in m["creneaux"] if c["demi"] == "matin"), None)
        boutons = [(c["demi"], b) for c in m["creneaux"] for b in c["boutons"]]
        if not matin or matin["boutons"] != ["Signer pour ce matin"] or len(boutons) != 1:
            res.echec("accueil du stagiaire", vue, "le bouton « Signer pour ce matin » doit être seul, dans la rangée Matin (boutons : %s)" % boutons)
        bandeau = page.evaluate("() => window.__verifNav.bandeauEmargement()")
        if bandeau and re.search(r"Signer", bandeau["texte"]):
            res.echec("accueil du stagiaire", vue, "le bandeau d'émargement dit encore « Signer » sur l'Accueil : « %s »" % bandeau["texte"])
    # Le pied de liens
    liens = {l["texte"]: l for l in m["liens"]}
    contacts = "Contacts du centre" in liens
    if contacts == sc.ressources_fermees or (contacts and liens["Contacts du centre"]["href"] != "#/ressources"):
        res.echec("accueil du stagiaire", vue, "« Contacts du centre » %s (module Ressources %s)"
                  % ("est là" if contacts else "manque", "fermé" if sc.ressources_fermees else "ouvert"))
    if liens.get("Mes préférences", {}).get("href") != "#/preferences":
        res.echec("accueil du stagiaire", vue, "le lien « Mes préférences » mène à %s, attendu #/preferences" % liens.get("Mes préférences", {}).get("href"))
    if "Signaler un problème" not in liens or liens["Signaler un problème"]["balise"] != "BUTTON":
        res.echec("accueil du stagiaire", vue, "le bouton « Signaler un problème » manque du pied de liens (%s)" % list(liens))
    if m["liensDuPied"]:   # plus de « code source » (décision de Timy du 09/11) : le pied de page ne porte aucun lien
        res.echec("accueil du stagiaire", vue, "le pied de page garde %s, attendu aucun lien (« Mes préférences » est dans le pied de liens)" % [l["texte"] for l in m["liensDuPied"]])
    # Zones à toucher
    if telephone:
        petits = ["%s (%s px)" % (x["texte"], x["h"]) for x in m["boutons"] + m["plus"] + m["liens"] if min(x.get("h", 44), 44) < 43.5] \
            + ["%s (%s px)" % (l["titre"], l["h"]) for l in m["lignes"] if l["h"] < 43.5]
        if petits:
            res.echec("accueil du stagiaire", vue, "zones à toucher sous 44 px sur téléphone : %s" % ", ".join(petits))


ZONES_AUJOURDHUI = ("emargement", "a-traiter", "tableau", "voiture", "a-suivre")   # l'ordre du téléphone, celui du DOM
TITRES_AUJOURDHUI = {"a-traiter": "À traiter", "a-suivre": "À suivre de près"}


def verifier_aujourdhui_equipe(page, res, sc, vue, jour=None, feuille="ouverte", planning=True, avec_feuille=True, benevoles=False):
    """Aujourd'hui du formateur, nouvelle navigation (lot 2B, tâche 4) : la pastille de date, le titre « Aujourd'hui », la ligne « Promo <nom> · semaine <n> · N stagiaires
    en formation » ; les cartes dans l'ordre du téléphone (émargement, à traiter, au tableau, en voiture, à suivre) et, dès 1080 px, émargement, au tableau, en voiture sur une
    ligne puis à traiter et à suivre ; aucune Nouveauté, tuile, compte à rebours ni « À retenir » ; l'émargement (« N sur M », jauge, « Voir la feuille », « Pas encore ouverte »
    sans feuille, carte absente promo éteinte) et, pour qui a une fiche de stagiaire, son bouton « Signer » ; au tableau et en voiture selon le planning du jour, les liens vers
    le Planning et Stagiaires > Élèves bénévoles ; à traiter selon les comptes du banc ; le bandeau d'émargement ne dit rien ici ; le pied ; zones à toucher de 44 px sur
    téléphone ; rien ne déborde ni ne se recouvre. `feuille` : « ouverte » ou « aucune » (la feuille que le banc sert ce jour-là) ; `planning` : le jour a un planning ;
    `avec_feuille` : l'émargement est allumé pour la promo ; `benevoles` : le banc sert des élèves bénévoles (`?benevoles=1`) : la ligne qui mène à leur sous-onglet est là
    (sinon elle n'y est pas, rien n'est inventé)."""
    m = page.evaluate("() => window.__verifNav.aujourdhuiEquipe()")
    jour = jour or datetime.date.fromisoformat(DATE_DU_BANC)
    telephone = sc.largeur < SEUIL_TELEPHONE
    echec = lambda detail: res.echec("aujourd'hui du formateur", vue, detail)
    attendu = [JOURS_DE_LA_SEMAINE[jour.weekday()], str(jour.day), MOIS_DE_L_ANNEE[jour.month - 1]]
    if not m["pastille"] or [x.lower() for x in m["pastille"]["parties"]] != attendu:
        echec("la pastille de date dit %s, attendu %s (jour, numéro, mois, sans l'année)" % (m["pastille"] and m["pastille"]["parties"], attendu))
    if (m["titre"] or "").strip() != "Aujourd'hui":
        echec("le titre de la page est « %s », attendu « Aujourd'hui »" % m["titre"])
    ligne = "%s · %d stagiaires en formation" % (ligne_promo_attendue(m["promo"], jour), m["enFormation"])
    if m["lead"] != ligne:
        echec("la ligne sous le titre est « %s », attendu « %s »" % (m["lead"], ligne))
    if m["tuiles"] or m["agenda"] or m["decompte"] or m["retenir"]:
        echec("la page montre encore des éléments d'avant : %d tuile(s), liste d'événements %s, compte à rebours %s, « À retenir » %s" % (m["tuiles"], m["agenda"], m["decompte"], m["retenir"]))
    zones = [c["zone"] for c in m["cartes"]]
    attendues = [z for z in ZONES_AUJOURDHUI if avec_feuille or z != "emargement"]
    if zones != attendues:
        echec("les cartes sont %s, attendu %s (aucune Nouveauté : le compte les porte)" % (zones, attendues))
        return
    par = {c["zone"]: c for c in m["cartes"]}
    det = {d["zone"]: d for d in m["details"]}
    if planning and (par["tableau"]["titre"] != "Au tableau ce matin" or par["voiture"]["titre"] != "En voiture cet après-midi"):
        echec("les titres des cartes sont « %s » et « %s », attendu « Au tableau ce matin » et « En voiture cet après-midi » (le banc : un cours au tableau le matin, la voiture l'après-midi)"
              % (par["tableau"]["titre"], par["voiture"]["titre"]))
    for zone, titre in TITRES_AUJOURDHUI.items():
        if par[zone]["titre"] != titre:
            echec("la carte « %s » s'appelle « %s »" % (titre, par[zone]["titre"]))
    if m["chargements"] and sc.a_traiter != "lent":
        echec("%d carte(s) restent en « Chargement… »" % m["chargements"])
    if m["debordement"]:
        echec("la page défile de côté à %d px" % sc.largeur)
    for i, a in enumerate(m["cartes"]):
        for b in m["cartes"][i + 1:]:
            if a["haut"] < b["bas"] - 1 and b["haut"] < a["bas"] - 1 and a["gauche"] < b["droite"] - 1 and b["gauche"] < a["droite"] - 1:
                echec("les cartes « %s » et « %s » se recouvrent" % (a["titre"], b["titre"]))
    # Disposition : une colonne sur téléphone, dans l'ordre du DOM ; dès 1080 px, trois cartes sur la première ligne, deux sur la seconde.
    hauts = [c["haut"] for c in m["cartes"]]
    if telephone:
        if hauts != sorted(hauts):
            echec("sur téléphone, les cartes ne sont pas dans l'ordre %s" % " > ".join(attendues))
    elif sc.largeur >= 1080:
        premiere = [par[z] for z in ("emargement", "tableau", "voiture") if z in par]
        seconde = [par["a-traiter"], par["a-suivre"]]
        if max(c["haut"] for c in premiere) - min(c["haut"] for c in premiere) > 1:
            echec("sur ordinateur, %s ne sont pas sur une même ligne" % ", ".join(c["titre"] for c in premiere))
        if abs(seconde[0]["haut"] - seconde[1]["haut"]) > 1 or seconde[0]["haut"] < max(c["bas"] for c in premiere) - 1:
            echec("sur ordinateur, « À traiter » et « À suivre de près » ne sont pas sur une même ligne sous les trois premières cartes")
    # Émargement
    if avec_feuille:
        e = det["emargement"]
        if feuille == "aucune":
            if "Pas encore ouverte" not in par["emargement"]["texte"] or [(l["texte"], l["href"]) for l in e["liens"]] != [("Aller à l'émargement", "#/emargement")]:
                echec("sans feuille ouverte, la carte dit « %s » avec les liens %s : attendu « Pas encore ouverte » et le lien vers Émargement" % (par["emargement"]["texte"], e["liens"]))
        else:
            adresse = "#/emargement/%s/matin" % jour.isoformat()
            mots = (e["kpi"] or "").split(" ")
            if not re.fullmatch(r"\d+ sur \d+ ont signé", e["kpi"] or "") or e["repere"] != "Ouverte" or par["emargement"]["titre"] != "Émargement du matin":
                echec("la carte d'émargement dit « %s » (titre « %s », repère « %s »), attendu « Émargement du matin », « N sur M ont signé » et « Ouverte »"
                      % (e["kpi"], par["emargement"]["titre"], e["repere"]))
            elif not e["jauge"] or e["jauge"]["now"] != int(mots[0]) or e["jauge"]["max"] != int(mots[2]):
                echec("la jauge de l'émargement (%s) ne dit pas « %s »" % (e["jauge"], e["kpi"]))
            if ("Voir la feuille", adresse) not in [(l["texte"], l["href"]) for l in e["liens"]]:
                echec("« Voir la feuille » manque ou ne mène pas à %s (liens : %s)" % (adresse, e["liens"]))
            if not (e["attente"] or "").startswith("En attente : "):
                echec("la carte d'émargement ne dit pas qui attend (« %s »)" % e["attente"])
            # Le fondateur qui a une fiche de stagiaire signe depuis la carte ; un formateur sans fiche n'a pas ce bouton.
            signer = [b["texte"] for b in e["boutons"] if b["texte"].startswith("Signer")]
            if bool(res.profil_stagiaire) != bool(signer):
                echec("le bouton « Signer pour ce matin » est %s alors que la personne %s une fiche de stagiaire (boutons : %s)"
                      % ("là" if signer else "absent", "a" if res.profil_stagiaire else "n'a pas", [b["texte"] for b in e["boutons"]]))
    # Au tableau, en voiture
    if planning:
        if not [l for l in det["tableau"]["liens"] if l["href"].startswith("#/stagiaires/")]:
            echec("« Au tableau » ne montre personne alors que le banc en met au tableau le matin : %s" % par["tableau"]["texte"])
        voiture = {l["href"]: l["texte"] for l in det["voiture"]["liens"]}
        if "#/planning" not in voiture or ("#/stagiaires" in voiture) != benevoles \
                or (benevoles and not voiture["#/stagiaires"].startswith(("2 élèves bénévoles", "1 élève bénévole"))):
            echec("« En voiture » doit mener au Planning, et à Stagiaires (sous-onglet Élèves bénévoles) quand le banc sert des bénévoles (%s) : liens %s" % (benevoles, det["voiture"]["liens"]))
    else:
        for zone in ("tableau", "voiture"):
            if "Pas de formation aujourd'hui." not in par[zone]["texte"]:
                echec("un jour de repos, la carte « %s » dit « %s » : attendu « Pas de formation aujourd'hui. »" % (par[zone]["titre"], par[zone]["texte"]))
    # À traiter : les comptes du banc (A_TRAITER_DU_BANC)
    attendu_pastille, phrase = A_TRAITER_DU_BANC[sc.a_traiter]
    traiter = [(l["titre"], l["href"]) for l in m["lignes"] if l["href"] == "#/themes"]
    if sc.a_traiter == "lent":
        if "Chargement" not in par["a-traiter"]["texte"]:
            echec("les lectures n'aboutissent pas : « À traiter » doit rester en « Chargement… » sans retenir la page (%s)" % par["a-traiter"]["texte"])
    elif attendu_pastille is None:
        if traiter or "Le décompte n'a pas pu être lu." not in par["a-traiter"]["texte"]:
            echec("les lectures échouent : « À traiter » doit dire « Le décompte n'a pas pu être lu. » sans ligne (%s)" % par["a-traiter"]["texte"])
    else:
        attendues = [(titre, "#/themes") for titre in lignes_a_traiter_attendues(phrase)]
        if traiter != attendues:
            echec("« À traiter » dit %s, attendu %s (le banc : %s)" % (traiter, attendues, phrase))
    # À suivre de près
    if "Tout voir" not in {x["texte"]: x for x in m["plus"]}:
        echec("« À suivre de près » n'a pas son lien « Tout voir »")
    suivre = par["a-suivre"]["texte"]
    if "Personne ne cumule deux signaux." not in suivre and "À suivre" not in suivre:
        echec("« À suivre de près » ne dit ni qui suivre ni « Personne ne cumule deux signaux. » : « %s »" % suivre)
    # Les erreurs ne s'affichent que dans les pannes que le scénario sème (« À traiter » sans compte).
    attendues_en_panne = 1 if (attendu_pastille is None and sc.a_traiter != "lent") else 0
    if len(m["erreurs"]) != attendues_en_panne:
        echec("%d message(s) d'erreur à l'écran, attendu %d : %s" % (len(m["erreurs"]), attendues_en_panne, m["erreurs"]))
    # Le bandeau d'émargement ne double pas la carte (il reste sur les autres pages).
    if avec_feuille and m["bandeau"]:
        echec("le bandeau d'émargement est affiché sur la page qui porte la carte : « %s »" % m["bandeau"])
    # Pied : celui de l'Accueil d'avant, sans « code source » (décision de Timy du 09/11) : « réglages » seul, sans pied de liens.
    if [(l["texte"], l["href"]) for l in m["liensDuPied"]] != [("réglages", "#/config")]:
        echec("le pied de page garde %s, attendu « réglages » seul" % [(l["texte"], l["href"]) for l in m["liensDuPied"]])
    if m["liens"]:
        echec("le pied de liens du stagiaire (%s) n'a pas sa place chez l'équipe : ses liens sont dans la barre et le menu du compte" % [l["texte"] for l in m["liens"]])
    if telephone:
        petits = ["%s (%s px)" % (x["texte"], x["h"]) for d in m["details"] for x in d["liens"] + d["boutons"] if x["h"] < 43.5] \
            + ["%s (%s px)" % (x["texte"], x["h"]) for x in m["plus"] if x["h"] < 43.5]
        if petits:
            echec("zones à toucher sous 44 px sur téléphone : %s" % ", ".join(petits))


def recharger_au_banc(page, adresse, derniere_page=None, **parametres):
    """Recharge le banc avec d'autres paramètres (une autre date, une lenteur), puis ouvre `adresse`. `derniere_page` : la page que l'ouverture à froid retrouve
    (mémoire `derniere-route`) ; l'Accueil n'est alors pas encore lu quand on y arrive, aucune lecture n'est en mémoire."""
    u = urllib.parse.urlparse(page.url)
    q = dict(urllib.parse.parse_qsl(u.query, keep_blank_values=True))
    # Les paramètres du scénario, sans ceux d'un rechargement d'avant (date, lenteur) : chaque cas repart du banc ordinaire.
    for cle in ("lenteur", "lenteur_tables"):
        q.pop(cle, None)
    q.update(date=DATE_DU_BANC, emargement="1")
    q.update(parametres, cb="%d-%d-%d" % (int(time.time() * 1000), os.getpid(), next(COMPTEUR)))
    if derniere_page:
        page.evaluate("(r) => { try { localStorage.setItem('derniere-route', r); } catch (e) {} }", derniere_page)
    page.goto(urllib.parse.urlunparse(u._replace(query=urllib.parse.urlencode(q), fragment="")), wait_until="load", timeout=20000)
    page.evaluate(JS_OUTILS)
    attendre(page, calme=250, maximum=8000)
    aller_a(page, adresse)
    attendre(page, calme=150)


def dessiner_une_signature(page):
    """Trace un trait dans la fenêtre de signature, puis la valide."""
    page.wait_for_selector("canvas", timeout=5000)
    c = page.locator("canvas").first.bounding_box()
    page.mouse.move(c["x"] + c["width"] * 0.15, c["y"] + c["height"] * 0.3)
    page.mouse.down()
    for i in range(1, 13):
        page.mouse.move(c["x"] + c["width"] * (0.15 + 0.06 * i), c["y"] + c["height"] * (0.3 + 0.15 * (i % 3)))
    page.mouse.up()
    page.locator("button:has-text('Valider ma signature')").first.click(timeout=4000)


def jouer_accueil_du_stagiaire(page, res, sc):
    """Accueil du stagiaire, les cas limites (lot 2B, tâche 3), nouvelle navigation, un stagiaire : un samedi (« Pas de formation aujourd'hui. », aucune
    lecture du planning pour la journée), un samedi avec une feuille ouverte (la rangée de la séance et son bouton existent sans planning), des lectures en
    échec (chaque carte garde son erreur, la page reste, « Réessayer » relit le planning), un départ vers une autre page pendant le chargement (rien ne se repeint
    ni ne casse), le plus petit téléphone (320 px). Chaque rechargement ouvre l'app à froid : la page d'avant est mémorisée, l'Accueil n'est pas lu d'avance."""
    vue = "%s/accueil-cas-limites" % sc.nom
    samedi = datetime.date(2026, 10, 31)
    # 1. Un samedi, émargement éteint : la journée est un repos.
    recharger_au_banc(page, "#/home", date=samedi.isoformat(), emargement="0")
    attendre_accueil(page)
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.accueilStagiaire()")
    if m["vide"] != "Pas de formation aujourd'hui." or m["creneaux"]:
        res.echec("accueil du stagiaire, samedi", vue, "un samedi, la journée dit « %s » avec %d rangée(s) : attendu « Pas de formation aujourd'hui. » seul" % (m["vide"], len(m["creneaux"])))
    verifier_accueil_stagiaire(page, res, sc, vue + "/samedi", jour=samedi)
    # 2. Un samedi avec une feuille ouverte : la rangée de la séance existe sans planning, avec son bouton.
    recharger_au_banc(page, "#/home", date=samedi.isoformat(), emargement="1")
    attendre_accueil(page)
    m = page.evaluate("() => window.__verifNav.accueilStagiaire()")
    matin = next((c for c in m["creneaux"] if c["demi"] == "matin"), None)
    if not matin or matin["boutons"] != ["Signer pour ce matin"] or m["vide"]:
        res.echec("accueil du stagiaire, samedi", vue, "une feuille ouverte un samedi : la rangée Matin et son bouton « Signer pour ce matin » manquent (rangées : %s, texte vide : %s)"
                  % ([c["demi"] for c in m["creneaux"]], m["vide"]))
    vider_console(res, vue)
    # 3. Des lectures en échec, après le démarrage, sur un Accueil jamais lu : chaque carte garde son erreur.
    recharger_au_banc(page, "#/preferences", derniere_page="preferences")
    page.evaluate("() => { window.__HARNESS_FAIL = 'panne du banc'; }")
    aller_a(page, "#/home")
    try:
        attendre_accueil(page)
    except DelaiDepasse:
        res.echec("accueil du stagiaire, lectures en échec", vue, "une carte reste en « Chargement… » quand les lectures échouent")
    m = page.evaluate("() => window.__verifNav.accueilStagiaire()")
    if len(m["erreurs"]) < 3 or [c["zone"] for c in m["cartes"]] != [z for z, _ in ZONES_DE_L_ACCUEIL] or not m["pastille"]:
        res.echec("accueil du stagiaire, lectures en échec", vue, "chaque carte doit garder sa propre erreur, la page rester : erreurs %s, cartes %s"
                  % (m["erreurs"], [c["zone"] for c in m["cartes"]]))
    if page.evaluate("() => document.querySelectorAll('#view .view-error-box').length"):
        res.echec("accueil du stagiaire, lectures en échec", vue, "la page entière est en erreur : seules les cartes doivent l'être")
    res.console.clear()   # les trois « console.error » de l'Accueil sont le but de l'essai : la page dit pourquoi une carte est vide
    page.evaluate("() => { window.__HARNESS_FAIL = null; }")
    if cliquer(page, res, vue, "#view .acc-reessayer", "« Réessayer » du planning"):
        attendre(page, calme=150)
        if not page.evaluate("() => window.__verifNav.accueilStagiaire().creneaux.length"):
            res.echec("accueil du stagiaire, lectures en échec", vue, "« Réessayer » n'a pas relu le planning : la journée reste sans rangée")
    vider_console(res, vue)
    # 4. Départ vers une autre page pendant le chargement : les lectures lentes reviennent dans un nœud détaché.
    recharger_au_banc(page, "#/home", derniere_page="preferences", lenteur="1500", lenteur_tables="planning_entries,agenda_events,qcm_attempts,dp_dossiers,epcf_livrets")
    aller_a(page, "#/home")
    page.wait_for_timeout(300)
    aller_a(page, "#/planning")
    page.wait_for_timeout(2800)
    if page.evaluate("() => document.querySelectorAll('#view .acc-grille').length") or route_courante(page) != "planning":
        res.echec("accueil du stagiaire, départ pendant le chargement", vue, "l'Accueil s'est repeint par-dessus la page ouverte entre-temps (page : #/%s)" % route_courante(page))
    vider_console(res, vue)
    # 5. Le plus petit téléphone.
    page.set_viewport_size({"width": LARGEUR_ETROITE, "height": 800})
    recharger_au_banc(page, "#/home")
    attendre_accueil(page)
    verifier_accueil_stagiaire(page, res, replace(sc, largeur=LARGEUR_ETROITE), vue + "/320")
    page.set_viewport_size({"width": sc.largeur, "height": 800})
    vider_console(res, vue)


# Ce que dit une page à qui n'est pas pour elle (js/views/emargement.js...) : un lien qui y mène est une impasse.
REFUS_DE_PAGE = ("se gère par les formateurs", "n'est pas pour toi", "réservé aux formateurs", "réservée aux formateurs", "accès refusé")


def jouer_direction(page, res, sc):
    """La direction du centre (`?compte=direction` : rôle prof, ni administrateur ni fondateur), nouvelle navigation (relecture finale du lot 2B, B1, B2, I1). Elle lit
    sans écrire : Aujourd'hui sans carte Émargement ni À traiter (« À suivre de près » prend alors toute la dernière ligne sur ordinateur), Cours et QCM sans le
    sous-onglet QCM du stagiaire, ni Signalements, ni Propositions IA, et aucun lien de la barre ou d'Aujourd'hui ne mène à une page qui la refuse. Le siège
    emprunte les mêmes chemins de code (isProf vrai, isAdmin faux)."""
    vue = "%s/direction" % sc.nom
    preparer_coquille(page, res, sc, regles_de_la_page(page, res, sc))
    # 1. Aujourd'hui.
    aller_a(page, "#/home")
    attendre(page)
    try:
        attendre_accueil(page)
    except DelaiDepasse:
        res.echec("direction, aujourd'hui", vue, "une carte reste en « Chargement… »")
    verifier_vue(page, res, sc, "direction/aujourdhui", {})
    m = page.evaluate("""() => {
      const g = document.querySelector('#view .auj-grille');
      const cartes = [...document.querySelectorAll('#view .auj-grille > .acc-carte')];
      const suivre = cartes.find((c) => c.dataset.zone === 'a-suivre');
      return { grille: !!g, zones: cartes.map((c) => c.dataset.zone),
               largeurGrille: g ? Math.round(g.getBoundingClientRect().width) : 0,
               largeurSuivre: suivre ? Math.round(suivre.getBoundingClientRect().width) : 0,
               defile: document.documentElement.scrollWidth > innerWidth + 1 };
    }""")
    if not m["grille"]:
        res.echec("direction, aujourd'hui", vue, "la page Aujourd'hui ne s'affiche pas")
    else:
        if "emargement" in m["zones"]:
            res.echec("direction, aujourd'hui", vue, "la carte Émargement s'affiche : elle mène à une page réservée aux formateurs de la promo")
        if "a-traiter" in m["zones"]:
            res.echec("direction, aujourd'hui", vue, "la carte « À traiter » s'affiche : la direction ne traite ni signalement ni proposition de l'IA")
        if m["zones"] != ["tableau", "voiture", "a-suivre"]:
            res.echec("direction, aujourd'hui", vue, "cartes attendues : tableau, voiture, à suivre (lu : %s)" % m["zones"])
        if sc.largeur >= 1080 and abs(m["largeurSuivre"] - m["largeurGrille"]) > 1:
            res.echec("direction, aujourd'hui", vue, "« À suivre de près » ne prend pas toute la ligne (%d px pour %d px)" % (m["largeurSuivre"], m["largeurGrille"]))
        if m["defile"]:
            res.echec("direction, aujourd'hui", vue, "la page défile de côté")
    # 2. Aucun lien vers une page qui la refuse : chaque lien d'Aujourd'hui, cliqué (il peut écrire un sous-onglet), puis chaque entrée de la barre et du tiroir.
    liens = page.evaluate("() => [...document.querySelectorAll('#view a[href^=\"#/\"]')].filter((a) => a.getClientRects().length).map((a) => a.getAttribute('href'))")
    for i, href in enumerate(liens):
        aller_a(page, "#/home")
        attendre(page)
        try:
            attendre_accueil(page)
        except DelaiDepasse:
            pass
        try:
            page.locator('#view a[href^="#/"]:visible').nth(i).click(timeout=4000)
        except (DelaiDepasse, ErreurPlaywright) as e:
            res.echec("clic impossible", vue, "lien %s d'Aujourd'hui : %s" % (href, motif_du_clic(e)))
            continue
        attendre(page, calme=200)
        verifier_refus(page, res, vue, "lien %s d'Aujourd'hui" % href)
    routes = page.evaluate("() => [...new Set([...document.querySelectorAll('[data-nav-coquille] a[href^=\"#/\"]')].map((a) => a.getAttribute('href')))]")
    for href in routes:
        aller_a(page, href)
        attendre(page, calme=200)
        verifier_refus(page, res, vue, "entrée %s de la barre" % href)
    # 3. Cours et QCM : Thèmes, Compétences, Documents ; ni le QCM du stagiaire, ni Signalements, ni Propositions IA.
    aller_a(page, "#/themes")
    attendre(page, calme=200)
    onglets = page.evaluate("() => [...document.querySelectorAll('#view [role=tab]')].filter((t) => t.getClientRects().length).map((t) => t.textContent.trim())")
    for interdit in ("QCM", "Signalements", "Propositions IA"):
        if interdit in onglets:
            res.echec("direction, cours et qcm", vue, "le sous-onglet « %s » s'affiche (sous-onglets : %s)" % (interdit, ", ".join(onglets)))
    if "Thèmes" not in onglets:
        res.echec("direction, cours et qcm", vue, "le sous-onglet « Thèmes » manque (sous-onglets : %s)" % ", ".join(onglets))
    res.vues += 1
    vider_console(res, vue)


def verifier_refus(page, res, vue, quoi):
    texte = page.evaluate("() => (document.getElementById('view') || document.body).innerText")
    trouve = [r for r in REFUS_DE_PAGE if r in texte.lower()]
    res.vues += 1
    if trouve:
        res.echec("direction, lien vers une page refusée", vue, "%s ouvre #/%s, qui dit « %s »" % (quoi, route_courante(page), trouve[0]))


def jouer_aujourdhui_cas_limites(page, res, sc):
    """Aujourd'hui du formateur, les cas limites (lot 2B, tâche 4), nouvelle navigation, l'équipe : un samedi, émargement éteint (pas de carte d'émargement, « Pas de formation
    aujourd'hui. » au tableau et en voiture), un samedi avec une feuille ouverte (la carte d'émargement existe sans planning), un jour sans feuille (« Pas encore ouverte »),
    des lectures en échec (chaque carte garde son erreur, la page reste, « Réessayer » relit le planning), un départ vers une autre page pendant le chargement (rien ne se
    repeint ni ne casse), le plus petit téléphone (320 px). Chaque rechargement ouvre l'app à froid : la page d'avant est mémorisée, l'accueil n'est pas lu d'avance. Une
    bascule de promo recharge la page entière (choisirPromo) : il n'y a rien à repeindre."""
    vue = "%s/aujourdhui-cas-limites" % sc.nom
    samedi = datetime.date(2026, 10, 31)
    # 1. Un samedi, émargement éteint : pas de carte d'émargement, la journée est un repos.
    recharger_au_banc(page, "#/home", date=samedi.isoformat(), emargement="0")
    attendre_accueil(page)
    res.vues += 1
    verifier_aujourdhui_equipe(page, res, sc, vue + "/samedi", jour=samedi, planning=False, avec_feuille=False)
    # 2. Un samedi avec une feuille ouverte : la carte d'émargement existe sans planning.
    recharger_au_banc(page, "#/home", date=samedi.isoformat(), emargement="1")
    attendre_accueil(page)
    res.vues += 1
    verifier_aujourdhui_equipe(page, res, sc, vue + "/samedi-feuille", jour=samedi, planning=False)
    # 3. Un jour sans feuille : « Pas encore ouverte » et le lien vers Émargement (le banc retire ses feuilles, la page les relit au retour sur l'accueil).
    page.evaluate("() => { window.__FIXTURES_DU_BANC.emargement_seances.splice(0); }")
    aller_a(page, "#/planning")
    aller_a(page, "#/home")
    attendre_accueil(page)
    res.vues += 1
    verifier_aujourdhui_equipe(page, res, sc, vue + "/sans-feuille", jour=samedi, planning=False, feuille="aucune")
    vider_console(res, vue)
    # 4. Des lectures en échec, après le démarrage, sur une page jamais lue : chaque carte garde son erreur.
    recharger_au_banc(page, "#/preferences", derniere_page="preferences")
    page.evaluate("() => { window.__HARNESS_FAIL = 'panne du banc'; }")
    aller_a(page, "#/home")
    try:
        attendre_accueil(page)
    except DelaiDepasse:
        res.echec("aujourd'hui du formateur, lectures en échec", vue, "une carte reste en « Chargement… » quand les lectures échouent")
    m = page.evaluate("() => window.__verifNav.accueilStagiaire()")
    if len(m["erreurs"]) < 5 or [c["zone"] for c in m["cartes"]] != list(ZONES_AUJOURDHUI) or not m["pastille"]:
        res.echec("aujourd'hui du formateur, lectures en échec", vue, "chaque carte doit garder sa propre erreur, la page rester : erreurs %s, cartes %s"
                  % (m["erreurs"], [c["zone"] for c in m["cartes"]]))
    if page.evaluate("() => document.querySelectorAll('#view .view-error-box').length"):
        res.echec("aujourd'hui du formateur, lectures en échec", vue, "la page entière est en erreur : seules les cartes doivent l'être")
    res.console.clear()   # les « console.error » de la page sont le but de l'essai : elle dit pourquoi une carte est vide
    page.evaluate("() => { window.__HARNESS_FAIL = null; }")
    if cliquer(page, res, vue, '#view [data-zone="tableau"] .acc-reessayer', "« Réessayer » du planning"):
        try:
            page.wait_for_function("() => [...document.querySelectorAll('#view .acc-carte h2')].some((h) => /ce matin/.test(h.textContent))", timeout=4000)
        except DelaiDepasse:
            res.echec("aujourd'hui du formateur, lectures en échec", vue, "« Réessayer » n'a pas relu le planning : les cartes « Au tableau » et « En voiture » restent sans titre du jour")
    vider_console(res, vue)
    # 5. Départ vers une autre page pendant le chargement : les lectures lentes reviennent dans un nœud détaché.
    recharger_au_banc(page, "#/home", derniere_page="preferences", lenteur="1500", lenteur_tables="planning_entries,stagiaires,emargement_seances,qcm_signalements")
    aller_a(page, "#/home")
    page.wait_for_timeout(300)
    aller_a(page, "#/planning")
    page.wait_for_timeout(2800)
    if page.evaluate("() => document.querySelectorAll('#view .acc-grille').length") or route_courante(page) != "planning":
        res.echec("aujourd'hui du formateur, départ pendant le chargement", vue, "Aujourd'hui s'est repeint par-dessus la page ouverte entre-temps (page : #/%s)" % route_courante(page))
    vider_console(res, vue)
    # 6. Le plus petit téléphone.
    page.set_viewport_size({"width": LARGEUR_ETROITE, "height": 800})
    recharger_au_banc(page, "#/home")
    attendre_accueil(page)
    res.vues += 1
    verifier_aujourdhui_equipe(page, res, replace(sc, largeur=LARGEUR_ETROITE), vue + "/320")
    page.set_viewport_size({"width": sc.largeur, "height": 800})
    # 7. Des élèves bénévoles en voiture (le banc en sert avec `?benevoles=1`, que les rechargements suivants garderaient : en dernier) : la ligne qui mène à
    # Stagiaires, sous-onglet Élèves bénévoles.
    recharger_au_banc(page, "#/home", benevoles="1")
    attendre_accueil(page)
    res.vues += 1
    verifier_aujourdhui_equipe(page, res, sc, vue + "/benevoles", benevoles=True)
    vider_console(res, vue)


def jouer_signature_d_aujourdhui(page, res, sc):
    """Signature depuis Aujourd'hui (lot 2B, tâche 4), pour qui a une fiche de stagiaire (le fondateur) : le bouton « Signer pour ce matin » de la carte d'émargement ouvre
    la fenêtre de signature ; une fois validée, la carte dit « Signé à H h MM » (« H h » pile, espaces insécables : audit du 09/11, lot E), le bouton a disparu, et le bandeau ne dit rien sur cette page."""
    vue = "%s/signature-aujourdhui" % sc.nom
    recharger_au_banc(page, "#/home")
    attendre_accueil(page)
    if not cliquer(page, res, vue, '#view [data-zone="emargement"] button.btn', "« Signer pour ce matin »"):
        return
    dessiner_une_signature(page)
    try:
        page.wait_for_function("() => !!document.querySelector('#view [data-zone=\"emargement\"] .acc-signe')", timeout=6000)
    except DelaiDepasse:
        res.echec("signature depuis Aujourd'hui", vue, "la carte d'émargement ne dit pas « Signé à ... » après la signature")
        return
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.aujourdhuiEquipe()")
    e = next(d for d in m["details"] if d["zone"] == "emargement")
    if not re.fullmatch(r"Signé à \d{1,2}[ \u00a0]h(?:[ \u00a0]\d{2})?", (e["signe"] or "").strip()) or [b for b in e["boutons"] if b["texte"].startswith("Signer")]:
        res.echec("signature depuis Aujourd'hui", vue, "après la signature, la carte dit « %s » avec les boutons %s : attendu « Signé à H h MM » (« H h » pile), sans bouton « Signer »" % (e["signe"], [b["texte"] for b in e["boutons"]]))
    if m["bandeau"]:
        res.echec("signature depuis Aujourd'hui", vue, "le bandeau reste affiché sur la page après la signature : « %s » (la carte porte déjà la confirmation)" % m["bandeau"])
    vider_console(res, vue)


def verifier_accueil_voir_en_tant_que_stagiaire(page, res, sc, vue):
    """Le fondateur voit l'app en stagiaire : l'accueil est celui du stagiaire (salutation par le prénom, ses cartes), jamais Aujourd'hui. Sans fiche de stagiaire, aucune
    étiquette « Tu passes au tableau » ni signature."""
    aller_a(page, "#/home")
    attendre(page)
    attendre_accueil(page)
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.accueilStagiaire()")
    # Décision du 10/11 : le titre est « Accueil » (une page, un nom), la salutation par le prénom passe dessous.
    if ((m["titre"] or "").strip() != "Accueil" or not re.match(r"^(Bonjour|Bon après-midi|Bonsoir), ", (m["salut"] or "").strip())
            or [c["zone"] for c in m["cartes"]] != [z for z, _ in ZONES_DE_L_ACCUEIL]):
        res.echec("accueil en aperçu stagiaire", vue, "l'accueil n'est pas celui du stagiaire : titre « %s », salutation « %s », cartes %s"
                  % (m["titre"], m["salut"], [c["zone"] for c in m["cartes"]]))
    if not res.profil_stagiaire:
        dedans = page.evaluate("() => ({ puces: document.querySelectorAll('#view .acc-puce').length, signes: document.querySelectorAll('#view .acc-signe').length,"
                               " boutons: document.querySelectorAll('#view .acc-creneau button.btn').length })")
        if any(dedans.values()):
            res.echec("accueil en aperçu stagiaire", vue, "sans fiche de stagiaire, l'accueil montre des étiquettes ou des signatures : %s" % dedans)
    vider_console(res, vue)


def jouer_signature_de_l_accueil(page, res, sc):
    """Signature depuis l'Accueil du stagiaire (lot 2B, tâche 3), sur une feuille ouverte au banc : le bouton « Signer pour ce matin » ouvre la fenêtre de signature ;
    une fois validée, la rangée dit « Signé à H h MM » (« H h » pile), le bouton a disparu, le bandeau ne dit rien sur l'Accueil et ne propose plus de signature sur le Planning."""
    vue = "%s/signature-accueil" % sc.nom
    recharger_au_banc(page, "#/home")
    attendre_accueil(page)
    if not cliquer(page, res, vue, '#view [data-demi="matin"] button.btn', "« Signer pour ce matin »"):
        return
    dessiner_une_signature(page)
    try:
        page.wait_for_function("() => !!document.querySelector('#view [data-demi=\"matin\"] .acc-signe')", timeout=6000)
    except DelaiDepasse:
        res.echec("signature depuis l'Accueil", vue, "la rangée Matin ne dit pas « Signé à ... » après la signature")
        return
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.accueilStagiaire()")
    matin = next(c for c in m["creneaux"] if c["demi"] == "matin")
    if not re.fullmatch(r"Signé à \d{1,2}[ \u00a0]h(?:[ \u00a0]\d{2})?", (matin["signe"] or "").strip()) or matin["boutons"]:
        res.echec("signature depuis l'Accueil", vue, "après la signature, la rangée Matin dit « %s » avec les boutons %s : attendu « Signé à H h MM » (« H h » pile), sans bouton" % (matin["signe"], matin["boutons"]))
    bandeau = page.evaluate("() => window.__verifNav.bandeauEmargement()")
    if bandeau:
        res.echec("signature depuis l'Accueil", vue, "le bandeau reste affiché sur l'Accueil après la signature : « %s » (la page porte déjà la confirmation)" % bandeau["texte"])
    aller_a(page, "#/planning")
    attendre(page, calme=200)
    bandeau = page.evaluate("() => window.__verifNav.bandeauEmargement()")
    if bandeau and re.search(r"Signer", bandeau["texte"]):
        res.echec("signature depuis l'Accueil", vue, "le Planning propose encore « Signer » après la signature : « %s »" % bandeau["texte"])
    vider_console(res, vue)


def verifier_accueil_eteint(page, res, sc):
    """Interrupteur éteint : l'accueil de main (le logo à côté de la date, la phrase sur le suivi de la promo, les tuiles), à une correction près, celle de
    la carte du prochain événement majeur, qui ne montre plus de nombre négatif."""
    vue = "%s/accueil" % sc.nom
    m = ouvrir_accueil(page, res, vue)
    if m is None:
        return
    if m["logos"] != 1:
        res.echec("accueil, interrupteur éteint", vue, "%d logo(s) à côté de la date, main en a 1" % m["logos"])
    if not m["tuiles"]:
        res.echec("accueil, interrupteur éteint", vue, "aucune tuile : main montre les raccourcis")
    if not (m["lead"] or "").startswith("Tout le suivi de la promo TP ECSR"):
        res.echec("accueil, interrupteur éteint", vue, "la phrase sous la salutation est « %s », celle de main commence par « Tout le suivi de la promo TP ECSR »" % m["lead"])
    # Lot 2A, tâche 1 : la ligne Ctrl + Z et le lien du pied sont ceux de main, et aucune Nouveauté du lancement n'ouvre la section.
    verifier_pied_et_retenir(res, vue, m, "ancienne")
    verifier_pied_de_l_accueil(res, vue, m, False)
    lancement = [c["titre"] for c in page.evaluate("() => window.__verifNav.nouveautes()") if c["titre"] in (TITRE_LANCEMENT, TITRE_LANCEMENT_EQUIPE)]
    if lancement:
        res.echec("Nouveautés de l'accueil, interrupteur éteint", vue, "l'accueil montre « %s » : propre à la nouvelle navigation" % " », « ".join(lancement))
    if m["agenda"]:
        verifier_carte(res, vue, m)
    vider_console(res, vue)


def verifier_planning_semaine(page, res, sc):
    """Planning > Semaine, nouvelle navigation, sur la semaine du jour : ni la phrase « Lecture seule... », ni « Consultation », ni les boutons « Cette
    semaine », « Aujourd'hui », « Revenir à aujourd'hui » ou « Émargement », chez le stagiaire comme chez l'équipe (audit du 09/11, lots E et B)."""
    vue = "%s/planning/semaine" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    semaine = page.locator("#view .subtabs-bar > .subtab", has_text="Semaine")
    if semaine.count():
        semaine.first.click()
        attendre(page)
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.planningSemaine()")
    # Audit du 09/11, lot B : sur la semaine du jour, ni « Cette semaine », ni « Aujourd'hui » (le nom de l'onglet d'accueil de l'équipe), ni
    # « Revenir à aujourd'hui » (montré hors de la semaine du jour, verifier_aujourdhui) ; ni « Lecture seule... », ni « Consultation », ni
    # « Émargement » (la page est dans la barre, le bandeau mène à la feuille ouverte).
    qui = "planning du stagiaire" if sc.espace == "stagiaire" else "planning de l'équipe"
    for cle, libelle in (("cetteSemaine", "Cette semaine"), ("aujourdhui", "Aujourd'hui"), ("retour", "Revenir à aujourd'hui"), ("emargement", "Émargement")):
        if m[cle]:
            res.echec(qui, vue, "%d bouton(s) « %s » sur la semaine du jour, 0 attendu" % (m[cle], libelle))
    if m["lecture"]:
        res.echec(qui, vue, "la page dit encore « Lecture seule »")
    if m["consultation"]:
        res.echec(qui, vue, "la page dit encore « Consultation »")
    vider_console(res, vue)


# Planning en grille (lot 2B, tâche 5) : ce que la page montre de la semaine, mesuré d'un coup (la grille, la bande de jours du téléphone, la bascule,
# les cartes de la liste, les étiquettes « Toi ... »). `visible` : le nœud occupe de la place (display ne le cache pas).
JS_MESURE_GRILLE = """() => {
  const vue = document.getElementById("view"), net = (t) => (t || "").replace(/\\s+/g, " ").trim();
  const visible = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const grille = vue.querySelector(".wgrid"), bande = vue.querySelector(".daystrip"), racine = vue.querySelector(".wsem");
  const bascule = [...document.querySelectorAll(".vue-toggle")];
  const jours = grille ? [...grille.querySelectorAll(".wg-day")] : [];
  const rect = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; };
  const onglets = bande ? [...bande.querySelectorAll("button")] : [];
  const choisi = onglets.findIndex((b) => b.getAttribute("aria-selected") === "true");
  const panneau = vue.querySelector(".wg-jour");
  return {
    racine: !!racine, grilleVisible: visible(grille), bandeVisible: visible(bande),
    colonnes: grille ? getComputedStyle(grille).gridTemplateColumns.split(" ").length : 0,
    xDesJours: [...new Set(jours.map((j) => Math.round(j.getBoundingClientRect().x)))].length,
    jourRepere: jours.findIndex((j) => j.classList.contains("auj")),
    debordeGrille: grille ? grille.scrollWidth > grille.clientWidth + 1 : false,
    debordePage: document.documentElement.scrollWidth > window.innerWidth + 1,
    basculeDansOnglets: bascule.some((b) => !!b.closest("[role=tablist]")),
    bascule: bascule.map((b) => ({ boutons: [...b.querySelectorAll("button")].map((x) => ({ texte: net(x.innerText), actif: x.getAttribute("aria-pressed") })), h: Math.min(...[...b.querySelectorAll("button")].map((x) => rect(x).h)) })),
    onglets: onglets.map((b) => ({ ...rect(b), selectionne: b.getAttribute("aria-selected"), auj: b.classList.contains("auj") })),
    choisi, jourAujourdhui: onglets.findIndex((b) => b.classList.contains("auj")),
    jourMontre: panneau ? net(panneau.querySelector("h3").textContent) : "",
    cartesListe: vue.querySelectorAll(".p-day-card").length, impression: !!document.getElementById("print-container"),
    repos: [...vue.querySelectorAll(".wg-repos")].filter(visible).map((e) => net(e.textContent)), reposTel: [...vue.querySelectorAll(".wg-repos-tel")].filter(visible).map((e) => net(e.textContent)),
    vides: [...vue.querySelectorAll(".wg-vide")].filter(visible).length, cartesGrille: [...vue.querySelectorAll(".wg-carte")].filter(visible).length,
    toi: [...vue.querySelectorAll(".wg-moi")].map((e) => net(e.textContent)), erreur: !!vue.querySelector(".view-error-box"),
    modifier: [...vue.querySelectorAll("button")].filter((b) => /Modifier$/.test(net(b.textContent))).length,
  };
}"""


def ouvrir_semaine(page):
    """Planning > Semaine, ouverte (le sous-onglet cliqué quand la barre en a)."""
    aller_a(page, "#/planning")
    attendre(page)
    semaine = page.locator("#view .subtabs-bar > .subtab", has_text="Semaine")
    if semaine.count():
        semaine.first.click()
        attendre(page)


def choisir_vue_du_planning(page, res, vue, cible):
    """Touche « Grille » (ou « Jour » sur téléphone) ou « Liste » ; faux, et un échec, si le bouton manque."""
    return cliquer(page, res, vue, '.vue-toggle button[data-vue="%s"]' % cible, "la bascule « %s »" % cible)


def verifier_planning_grille(page, res, sc, complet=False):
    """Planning > Semaine, nouvelle navigation, hors mode Modifier (lot 2B, tâche 5) : la grille de la semaine. 1280, 1100, 900 px : cinq colonnes sans
    débordement, aujourd'hui repéré ; 375 et 320 px : la bande de cinq jours aux cibles de 44 px, aujourd'hui choisi, un jour touché change la carte. La bascule
    (« Jour » sur téléphone) mène à la liste (cinq cartes), qui se garde au rechargement. `complet` : la liste et le rechargement, le mode Modifier de l'équipe, la
    semaine vide, un jour de repos, la semaine verrouillée, l'impression, un aller-retour vers Dates clés."""
    vue = "%s/planning/grille" % sc.nom
    telephone = sc.largeur < SEUIL_TELEPHONE
    ouvrir_semaine(page)
    res.vues += 1
    m = page.evaluate(JS_MESURE_GRILLE)
    if not m["racine"] and m["cartesListe"]:
        # La liste est restée choisie sur l'appareil : on revient à la grille avant de mesurer.
        choisir_vue_du_planning(page, res, vue, "grille")
        m = page.evaluate(JS_MESURE_GRILLE)
    if not m["racine"]:
        res.echec("planning en grille", vue, "aucune grille de la semaine à l'ouverture de Planning > Semaine (%d carte(s) de liste)" % m["cartesListe"])
        return
    if m["cartesListe"]:
        res.echec("planning en grille", vue, "la liste (%d cartes de jour) est montrée en même temps que la grille" % m["cartesListe"])
    if m["erreur"]:
        res.echec("planning en grille", vue, "la semaine est en erreur")
    if m["debordePage"] or m["debordeGrille"]:
        res.echec("planning en grille", vue, "la page ou la grille défile de côté (page : %s, grille : %s)" % (m["debordePage"], m["debordeGrille"]))
    if m["basculeDansOnglets"]:
        res.echec("planning en grille", vue, "la bascule Grille / Liste est dans une tablist (la barre des sous-onglets ne contient que des onglets)")
    if len(m["bascule"]) != 1:
        res.echec("planning en grille", vue, "%d bascule(s) Grille / Liste, 1 attendue" % len(m["bascule"]))
    else:
        textes = [b["texte"] for b in m["bascule"][0]["boutons"]]
        attendu = ["Jour" if telephone else "Grille", "Liste"]
        if textes != attendu:
            res.echec("planning en grille", vue, "boutons de la bascule %s, attendu %s" % (textes, attendu))
        if [b["actif"] for b in m["bascule"][0]["boutons"]] != ["true", "false"]:
            res.echec("planning en grille", vue, "la grille n'est pas le bouton actif de la bascule (%s)" % [b["actif"] for b in m["bascule"][0]["boutons"]])
        if m["bascule"][0]["h"] < 43.5:
            res.echec("zones à toucher sous 44 px", vue, "la bascule Grille / Liste mesure %s px" % m["bascule"][0]["h"])
    if telephone:
        if m["grilleVisible"] or not m["bandeVisible"]:
            res.echec("planning en grille", vue, "sur téléphone la bande de jours doit remplacer la grille (grille %s, bande %s)" % (m["grilleVisible"], m["bandeVisible"]))
        if len(m["onglets"]) != 5 or any(o["h"] < 43.5 or o["w"] < 43.5 for o in m["onglets"]):
            res.echec("zones à toucher sous 44 px sur téléphone", vue, "bande de jours : %s" % [(o["w"], o["h"]) for o in m["onglets"]])
        if m["choisi"] != 1 or m["jourAujourdhui"] != 1:
            res.echec("planning en grille", vue, "le jour d'aujourd'hui (mardi) doit être choisi : choisi %s, repéré %s" % (m["choisi"], m["jourAujourdhui"]))
        if not m["jourMontre"].startswith("Mardi 27 octobre"):
            res.echec("planning en grille", vue, "le jour montré est « %s », « Mardi 27 octobre » attendu" % m["jourMontre"])
        if cliquer(page, res, vue, '.daystrip button:nth-child(4)', "le jeudi de la bande de jours"):
            n = page.evaluate(JS_MESURE_GRILLE)
            if n["choisi"] != 3 or not n["jourMontre"].startswith("Jeudi 29 octobre"):
                res.echec("planning en grille", vue, "toucher le jeudi montre « %s » (choisi %s)" % (n["jourMontre"], n["choisi"]))
    else:
        if not m["grilleVisible"] or m["bandeVisible"]:
            res.echec("planning en grille", vue, "sur ordinateur la grille doit remplacer la bande de jours (grille %s, bande %s)" % (m["grilleVisible"], m["bandeVisible"]))
        if m["colonnes"] != 6 or m["xDesJours"] != 5:
            res.echec("planning en grille", vue, "%d colonnes déclarées et %d colonnes de jours, 6 et 5 attendues" % (m["colonnes"], m["xDesJours"]))
        if m["jourRepere"] != 1:
            res.echec("planning en grille", vue, "le jour repéré est la colonne %s, la deuxième (mardi) attendue" % m["jourRepere"])
    if sc.espace == "stagiaire" and res.profil_stagiaire and "Toi au tableau" not in m["toi"]:
        res.echec("planning en grille", vue, "aucune étiquette « Toi au tableau » dans la semaine du stagiaire (étiquettes : %s)" % m["toi"])
    if sc.espace == "equipe" and m["toi"]:
        res.echec("planning en grille", vue, "l'équipe voit des étiquettes « Toi » : %s" % m["toi"])
    if not m["impression"]:
        res.echec("impression du planning", vue, "la cible d'impression (#print-container) manque en vue grille")
    vider_console(res, vue)
    if not complet:
        return

    # La liste : cinq cartes, plus de grille ; elle se garde au rechargement.
    if choisir_vue_du_planning(page, res, vue, "liste"):
        n = page.evaluate(JS_MESURE_GRILLE)
        if n["cartesListe"] != 5 or n["racine"]:
            res.echec("planning en liste", vue, "la liste montre %d cartes de jour (5 attendues) et la grille %s" % (n["cartesListe"], "reste" if n["racine"] else "est partie"))
        recharger_au_banc(page, "#/planning")
        attendre(page, calme=250)
        n = page.evaluate(JS_MESURE_GRILLE)
        if n["cartesListe"] != 5 or n["racine"]:
            res.echec("planning en liste", vue, "la liste ne se garde pas au rechargement (%d cartes, grille %s)" % (n["cartesListe"], n["racine"]))
        if not choisir_vue_du_planning(page, res, vue, "grille"):
            return
        n = page.evaluate(JS_MESURE_GRILLE)
        if not n["racine"] or n["cartesListe"]:
            res.echec("planning en grille", vue, "« Grille » ne rend pas la grille (grille %s, %d cartes de liste)" % (n["racine"], n["cartesListe"]))
        if page.evaluate("() => localStorage.getItem('planning.vue')") != "grille":
            res.echec("planning en grille", vue, "le choix de la grille n'est pas gardé sur l'appareil")

    # L'équipe : « Modifier » montre l'éditeur et ni grille ni bascule ; « Quitter l'édition » (ex-« Terminer », audit du 09/11, lot B) rend la grille.
    if sc.espace == "equipe":
        modifier = page.locator("#view button", has_text="Modifier")
        if not modifier.count():
            res.echec("planning en grille", vue, "le bouton « Modifier » manque chez l'équipe")
        else:
            modifier.first.click()
            page.wait_for_timeout(150)
            n = page.evaluate(JS_MESURE_GRILLE)
            if n["racine"] or n["cartesListe"] != 5 or n["bascule"]:
                res.echec("planning en grille", vue, "en mode Modifier : grille %s, %d cartes de jour, %d bascule(s) (aucune grille, 5 cartes et aucune bascule attendues)"
                          % (n["racine"], n["cartesListe"], len(n["bascule"])))
            termine = page.locator("#view .week-bar-actions button", has_text="Quitter l'édition")
            if termine.count():
                termine.first.click()
                page.wait_for_timeout(150)
                n = page.evaluate(JS_MESURE_GRILLE)
                if not n["racine"] or n["cartesListe"] or len(n["bascule"]) != 1:
                    res.echec("planning en grille", vue, "« Quitter l'édition » ne rend pas la grille (grille %s, %d cartes, %d bascule(s))" % (n["racine"], n["cartesListe"], len(n["bascule"])))
            else:
                res.echec("planning en grille", vue, "le bouton « Quitter l'édition » manque en mode Modifier")

    # Une semaine vide, puis la semaine du 11 novembre (repos) : les flèches de la barre de semaine gardent leur effet.
    if cliquer(page, res, vue, '#view button[aria-label="Semaine suivante"]', "la flèche « Semaine suivante »"):
        page.wait_for_timeout(250)
        n = page.evaluate(JS_MESURE_GRILLE)
        if not n["racine"] or n["erreur"]:
            res.echec("planning en grille", vue, "la semaine vide casse la grille (grille %s, erreur %s)" % (n["racine"], n["erreur"]))
        if n["cartesGrille"] != 0 or (not telephone and n["vides"] != 10):
            res.echec("planning en grille", vue, "semaine vide : %d carte(s) et %d case(s) « Rien de prévu » visibles (0 et 10 attendues)" % (n["cartesGrille"], n["vides"]))
        if cliquer(page, res, vue, '#view button[aria-label="Semaine suivante"]', "la flèche « Semaine suivante »"):
            page.wait_for_timeout(250)
            if telephone:
                cliquer(page, res, vue, '.daystrip button:nth-child(3)', "le mercredi de la bande de jours")
            n = page.evaluate(JS_MESURE_GRILLE)
            repos = n["reposTel"] if telephone else n["repos"]
            if repos != ["Armistice"]:
                res.echec("planning en grille", vue, "le mercredi 11 novembre doit porter le libellé « Armistice » (vu : %s)" % repos)
            if n["debordePage"] or n["debordeGrille"]:
                res.echec("planning en grille", vue, "la semaine du 11 novembre défile de côté")
            cliquer(page, res, vue, '#view button[aria-label="Semaine précédente"]', "la flèche « Semaine précédente »")
        cliquer(page, res, vue, '#view button[aria-label="Semaine précédente"]', "la flèche « Semaine précédente »")
        page.wait_for_timeout(250)

    # La semaine verrouillée : la grille reste (lecture seule), sans bouton « Modifier ».
    page.evaluate("""() => { const r = window.__FIXTURES_DU_BANC.settings.find((x) => x.key === 'semaines_verrouillees'); r.value = JSON.stringify(['2026-10-26']); }""")
    aller_a(page, "#/home")
    ouvrir_semaine(page)
    n = page.evaluate(JS_MESURE_GRILLE)
    if not n["racine"] or n["cartesListe"] or n["modifier"] or len(n["bascule"]) != 1:
        res.echec("planning en grille", vue, "semaine verrouillée : grille %s, %d cartes de jour, %d bouton(s) Modifier, %d bascule(s)"
                  % (n["racine"], n["cartesListe"], n["modifier"], len(n["bascule"])))
    page.evaluate("""() => { const r = window.__FIXTURES_DU_BANC.settings.find((x) => x.key === 'semaines_verrouillees'); r.value = '[]'; }""")

    # Dates clés puis retour : la bascule suit la semaine (elle n'est pas posée sur les autres sous-onglets).
    dates = page.locator("#view .subtabs-bar > .subtab", has_text="Dates clés")
    if dates.count():
        dates.first.click()
        page.wait_for_timeout(250)
        if page.evaluate("() => document.querySelectorAll('.vue-toggle').length"):
            res.echec("planning en grille", vue, "la bascule Grille / Liste reste sur Dates clés")
        aller_a(page, "#/home")
        ouvrir_semaine(page)
        n = page.evaluate(JS_MESURE_GRILLE)
        if not n["racine"] or len(n["bascule"]) != 1:
            res.echec("planning en grille", vue, "après Dates clés puis retour : grille %s, %d bascule(s) (1 attendue)" % (n["racine"], len(n["bascule"])))
    vider_console(res, vue)


def jouer_planning_etroit(page, res, sc):
    """La grille sur le plus petit téléphone (320 px) : la bande de cinq jours tient sans défiler de côté, aux cibles de 44 px."""
    vue = "%s/planning/grille-320" % sc.nom
    page.set_viewport_size({"width": LARGEUR_ETROITE, "height": 800})
    recharger_au_banc(page, "#/planning")
    attendre(page, calme=250)
    verifier_planning_grille(page, res, replace(sc, largeur=LARGEUR_ETROITE), complet=False)
    page.set_viewport_size({"width": sc.largeur, "height": 800})
    vider_console(res, vue)


def verifier_planning_eteint(page, res, sc):
    """Interrupteur éteint : le Planning de main, « Cette semaine » et la phrase « Lecture seule... » pour tous."""
    vue = "%s/planning/semaine" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.planningSemaine()")
    if m["cetteSemaine"] != 1:
        res.echec("planning, interrupteur éteint", vue, "%d bouton(s) « Cette semaine », main en a 1 pour tous" % m["cetteSemaine"])
    if not m["lecture"]:
        res.echec("planning, interrupteur éteint", vue, "la phrase « Lecture seule... » de main manque")
    vider_console(res, vue)


def verifier_planning_grille_eteint(page, res, sc):
    """Interrupteur éteint : le planning de main, sans bascule Grille / Liste ni grille, avec ses cinq cartes de jour."""
    vue = "%s/planning/grille-eteint" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    res.vues += 1
    m = page.evaluate(JS_MESURE_GRILLE)
    if m["bascule"] or m["racine"]:
        res.echec("planning, interrupteur éteint", vue, "%d bascule(s) et grille %s : main n'en a aucune" % (len(m["bascule"]), m["racine"]))
    if m["cartesListe"] != 5:
        res.echec("planning, interrupteur éteint", vue, "%d cartes de jour, main en a 5" % m["cartesListe"])
    vider_console(res, vue)


def verifier_epcf_de_l_equipe(page, res, sc):
    """Notes et examens > EPCF, page de l'équipe : le sous-onglet garde son rendu des moyennes de la classe sous son titre « Moyennes de la classe » (celui
    de La classe de Mon suivi est « Moyennes EPCF de la classe »), pour les deux épreuves."""
    vue = "%s/notes/epcf" % sc.nom
    res.vues += 1
    attendre(page)
    m = page.evaluate("() => window.__verifNav.epcfDeLEquipe()")
    if m["titre"] != "Moyennes de la classe":
        res.echec("notes de l'équipe, EPCF", vue, "le titre du sous-onglet EPCF est « %s », attendu « Moyennes de la classe »" % m["titre"])
    if m["epreuves"] != 2:
        res.echec("notes de l'équipe, EPCF", vue, "le sous-onglet EPCF montre %d épreuve(s), 2 attendues (salle et véhicule)" % m["epreuves"])
    vider_console(res, vue)


def verifier_moyennes_epcf(res, vue, e):
    """La section « Moyennes EPCF de la classe » de La classe (m["epcf"] de laClasse()) : titrée, sous la matrice, deux épreuves, le rendu des moyennes
    de la classe avec son k-anonymat (une moyenne n'est montrée qu'à partir de 2 stagiaires évalués). Le banc sert des moyennes sur 3 et 2 stagiaires,
    et un critère sur un seul stagiaire, qui ne doit jamais être montré."""
    if e is None:
        res.echec("la classe, moyennes EPCF", vue, "la section « Moyennes EPCF de la classe » manque sous la vue de la classe (le banc sert des évaluations EPCF)")
        return
    if e["titre"] != "Moyennes EPCF de la classe":
        res.echec("la classe, moyennes EPCF", vue, "le titre de la section est « %s », attendu « Moyennes EPCF de la classe »" % e["titre"])
    if not e["sousLaMatrice"]:
        res.echec("la classe, moyennes EPCF", vue, "la section n'est pas placée sous la vue de la classe (matrice, synthèse, graphiques)")
    evalues = max(n for rangees in MOYENNES_EPCF_DU_BANC.values() for (_, _, n) in rangees)
    if len(e["epreuves"]) != 2:
        res.echec("la classe, moyennes EPCF", vue, "la section montre %d épreuve(s), 2 attendues (salle et véhicule)" % len(e["epreuves"]))
    for epreuve, rangees in zip(e["epreuves"], (MOYENNES_EPCF_DU_BANC["salle"], MOYENNES_EPCF_DU_BANC["vehicule"])):
        # Le pluriel s'accorde (stagiairesEvalues de js/epcf-classe-rules.js), jamais « stagiaire(s) évalué(s) ».
        accorde = "aucun stagiaire évalué" if not evalues else "1 stagiaire évalué" if evalues == 1 else "%d stagiaires évalués" % evalues
        if not re.fullmatch(r".+ : %s" % re.escape(accorde), epreuve["titre"]):
            res.echec("la classe, moyennes EPCF", vue, "le titre d'une épreuve est « %s », attendu « <épreuve> : %s »" % (epreuve["titre"], accorde))
        montrees = [(ligne[1], ligne[2]) for ligne in epreuve["lignes"] if len(ligne) == 3 and ligne[2]]
        attendues = [("%.2f" % moyenne, str(n)) for (_, moyenne, n) in rangees if n >= K_ANONYMAT]
        if montrees != attendues:
            res.echec("la classe, moyennes EPCF", vue, "« %s » montre les critères évalués %s, attendu %s (k-anonymat de %d : un critère sur moins de %d stagiaires n'est jamais montré)"
                      % (epreuve["titre"], montrees, attendues, K_ANONYMAT, K_ANONYMAT))
        if any(int(effectif) < K_ANONYMAT for _, effectif in montrees):
            res.echec("k-anonymat", vue, "« %s » montre une moyenne sur moins de %d stagiaires : %s" % (epreuve["titre"], K_ANONYMAT, montrees))


def verifier_la_classe(page, res, sc):
    """Mon suivi > La classe (nouvelle navigation), pour toute personne qui y ouvre la classe, stagiaire ou formateur : la présentation suit le contexte
    (imbriquée dans Mon suivi), pas le rôle. Sans second titre « Notes & évaluations » ni « Notes et examens », sans seconde rangée Matrice / EPCF (deux
    « EPCF » se liraient à l'écran : aucun libellé « EPCF » isolé), sans « Lecture seule... » ; le stagiaire, qui ne saisit rien, ne lit pas non plus la
    phrase sur la saisie, et il ne reste que le nombre de notes, que l'équipe lit après sa phrase. Sous la vue de la classe, la section « Moyennes EPCF de la
    classe » (verifier_moyennes_epcf)."""
    vue = "%s/mon-suivi/classe" % sc.nom
    aller_a(page, "#/mon-suivi/classe")
    attendre(page)
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.laClasse()")
    if m is None:
        memorise = page.evaluate("() => { try { return localStorage.getItem('ecsr_notes_subtab'); } catch (e) { return null; } }")
        res.echec("la classe du stagiaire", vue, "la matrice des notes n'est pas à l'écran sur #/mon-suivi/classe (sous-onglet de Notes mémorisé sur l'appareil : %s)" % memorise)
        return
    if m["titres"]:
        res.echec("la classe du stagiaire", vue, "un second titre : « %s »" % " », « ".join(m["titres"]))
    if m["barres"] or m["sousOnglets"]:
        res.echec("la classe du stagiaire", vue, "une seconde rangée de sous-onglets (Matrice / EPCF) : deux « EPCF » se lisent à l'écran")
    if m["epcfIsoles"]:
        res.echec("la classe du stagiaire", vue, "%d libellé(s) « EPCF » isolé(s) (titre, bouton ou sous-onglet) : seul le titre de la section des moyennes le porte" % m["epcfIsoles"])
    stagiaire = sc.espace == "stagiaire"
    if len(m["entetes"]) != 1:
        res.echec("la classe du stagiaire", vue, "%d en-tête(s) dans la classe, 1 attendu : « %s »" % (len(m["entetes"]), " | ".join(m["entetes"])))
    elif stagiaire and not COMPTE_NOTES.fullmatch(m["entetes"][0]):
        res.echec("la classe du stagiaire", vue, "l'en-tête de la classe est « %s », attendu le seul nombre de notes (« N notes enregistrées. »)" % m["entetes"][0])
    elif not stagiaire and not (COMPTE_NOTES.search(m["entetes"][0]) and len(m["entetes"][0]) > len("0 note enregistrée.")):
        res.echec("la classe du formateur", vue, "l'en-tête de la classe est « %s », attendu sa phrase sur la saisie puis le nombre de notes" % m["entetes"][0])
    interdits = ["Lecture seule", "Notes & évaluations", "Notes et examens"] + (["Clique une cellule", "Touche une case"] if stagiaire else [])
    for dit in interdits:
        if dit in m["texte"]:
            res.echec("la classe du stagiaire" if stagiaire else "la classe du formateur", vue, "la page dit « %s »" % dit)
    verifier_moyennes_epcf(res, vue, m["epcf"])
    vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Mon suivi aux libellés clairs (lot 2B, tâche 7)
# --------------------------------------------------------------------------------------

# Mon suivi, nouvelle navigation : les parties dans l'ordre (sous-onglets sur ordinateur, lignes du sommaire sur téléphone).
PARTIES_MON_SUIVI = ["Résultats", "Passages", "EPCF", "Livret EPCF", "Dossier pro"]   # « Livret EPCF » : décision de Timy du 08/11
# La fiche de main : Mon espace éteint, et la fiche d'un stagiaire chez l'équipe dans les deux navigations.
PARTIES_FICHE_DE_MAIN = ["Passages", "EPCF", "Évolution", "Livret", "Dossier pro"]
# Les lignes du sommaire du stagiaire du banc (Timy, id 1, le 27/10/2026) : aucun passage à venir, aucune épreuve EPCF, pas de livret, un dossier ouvert le 02/10
# sans exemple rempli (que main écrivait « Dossier pro 02/10 »).
LIGNES_MON_SUIVI_DU_BANC = ["Résultats : moi et la classe", "Passages : aucun à venir", "EPCF : 0 épreuve sur 2", "Livret EPCF : pas encore commencé",
                            "Dossier pro : 0 exemple sur 6"]
CLE_VUE_RESULTATS = "ecsr_resultats_vue"
# La fiche d'un stagiaire chez l'équipe : Valentin (id 4), EPCF 1 sur 2, livret et dossier.
ID_DE_LA_FICHE_DE_L_EQUIPE = 4

# Ce que Mon suivi montre : ses sous-onglets (le premier groupe de la page), les lignes de son sommaire (texte, place, hauteur, texte coupé ou non), le haut de
# la barre du bas, l'en-tête de la page, le titre de la partie (téléphone), le groupe « Moi / La classe » et la vue qu'il montre.
JS_MON_SUIVI = r"""() => {
  const vue = document.getElementById('view');
  const net = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const lib = (x) => net(x.childNodes[0] ? x.childNodes[0].textContent : x.textContent);
  const visible = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const bar = vue.querySelector('.subtabs-bar');
  const onglets = bar ? [...bar.querySelectorAll(':scope > .subtab')].filter(visible).map(lib) : [];
  const actif = bar && bar.querySelector(':scope > .subtab.active');
  const bas = document.querySelector('.nav-bas');
  const barreBas = bas && visible(bas) ? bas.getBoundingClientRect().top : innerHeight;
  const coupe = (e) => { const s = getComputedStyle(e);
    return s.textOverflow === 'ellipsis' || ((s.overflowX === 'hidden' || s.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1); };
  const lignes = [...vue.querySelectorAll('nav.fiche-sommaire a.fiche-ligne')].map((a) => {
    const r = a.getBoundingClientRect();
    return { texte: net(a.innerText), noms: [...a.querySelectorAll('.fiche-ligne-nom')].map((n) => net(n.textContent)), haut: r.top, bas: r.bottom, h: r.height,
      coupee: [a, ...a.querySelectorAll('span')].some(coupe), clair: !!a.closest('.fiche-sommaire-clair') };
  });
  const groupe = vue.querySelector('.res-bar [role=group]');
  const vues = [...vue.querySelectorAll('.res-bar button')].map((b) => { const r = b.getBoundingClientRect();
    return { texte: net(b.textContent), presse: b.getAttribute('aria-pressed'), w: r.width, h: r.height }; });
  const titre = vue.querySelector('h2.fiche-titre');
  return { hash: location.hash, onglets, actif: actif ? lib(actif) : null, lignes, barreBas,
    entete: visible(vue.querySelector('.view-header')), titre: titre && visible(titre) ? net(titre.textContent) : null,
    groupe: groupe ? groupe.getAttribute('aria-label') : null, vues,
    moi: [...vue.querySelectorAll('.res-vue h3.ms-section-title')].some((h) => net(h.textContent) === 'Mon évolution'),
    classe: !!vue.querySelector('.res-vue .matrice-toolbar'), resultats: !!vue.querySelector('.res-bar'),
    texte: net(vue.innerText), defile: document.documentElement.scrollWidth > innerWidth + 1 };
}"""


def lire_mon_suivi(page):
    return page.evaluate(JS_MON_SUIVI)


def attendre_vue_de_resultats(page, cible):
    """La vue montrée par Résultats : « Mon évolution » pour Moi, la matrice des notes pour La classe (lue par la vue Notes, après ses données)."""
    js = ("() => !!document.querySelector('#view .res-vue .matrice-toolbar')" if cible == "classe"
          else "() => [...document.querySelectorAll('#view .res-vue h3.ms-section-title')].some((h) => h.textContent.trim() === 'Mon évolution')")
    try:
        page.wait_for_function(js, timeout=6000)
        return True
    except DelaiDepasse:
        return False


def verifier_resultats(res, vue, sc, m, cible, adresse_attendue="#/mon-suivi/resultats"):
    """Résultats affiché sur la vue `cible` (« moi » ou « classe ») : l'adresse, la partie allumée (sous-onglet) ou son titre (téléphone, en-tête de la page
    caché), le groupe « Moi / La classe » (nommé, deux boutons de 44 px, un seul pressé) et la vue qu'il montre, sans défilement de côté."""
    echec = lambda detail: res.echec("Mon suivi, Résultats", vue, detail)
    tel = sc.largeur < SEUIL_TELEPHONE
    if m["hash"] != adresse_attendue:
        echec("l'adresse est %s, attendu %s" % (m["hash"], adresse_attendue))
    if tel:
        if m["titre"] != "Résultats":
            echec("le titre de la partie est « %s », attendu « Résultats »" % m["titre"])
        if m["entete"]:
            echec("l'en-tête « Mon suivi » reste affiché au-dessus du retour « ‹ Mon suivi » : la page se nomme deux fois")
    elif m["actif"] != "Résultats":
        echec("le sous-onglet allumé est « %s », attendu « Résultats »" % m["actif"])
    if m["groupe"] != "Résultats à afficher":
        echec("le groupe « Moi / La classe » est nommé « %s », attendu « Résultats à afficher »" % m["groupe"])
    if [x["texte"] for x in m["vues"]] != ["Moi", "La classe"]:
        echec("les boutons de Résultats sont %s, attendu « Moi », « La classe »" % [x["texte"] for x in m["vues"]])
        return
    presses = [x["presse"] for x in m["vues"]]
    attendus = ["true", "false"] if cible == "moi" else ["false", "true"]
    if presses != attendus:
        echec("« Moi » et « La classe » sont pressés %s, attendu %s (vue « %s »)" % (presses, attendus, cible))
    petits = ["%s (%dx%d px)" % (x["texte"], x["w"], x["h"]) for x in m["vues"] if x["w"] < 43.5 or x["h"] < 43.5]
    if petits:
        echec("boutons sous 44 px : %s" % ", ".join(petits))
    if cible == "moi" and (not m["moi"] or m["classe"]):
        echec("la vue « Moi » montre %s, attendu le graphe « Mon évolution » seul" % ("la matrice de la classe" if m["classe"] else "autre chose"))
    if cible == "classe" and (not m["classe"] or m["moi"]):
        echec("la vue « La classe » montre %s, attendu la matrice des notes de la classe seule" % ("« Mon évolution »" if m["moi"] else "autre chose"))
    if m["defile"]:
        echec("la page défile de côté")


def verifier_parties_de_mon_suivi(page, res, sc, vue):
    """Mon suivi, ouvert sans partie : les cinq parties dans l'ordre. Téléphone : le sommaire, chaque ligne dit son état en entier, sans date « 02/10 », jamais
    coupée, de 44 px au moins, la dernière au-dessus de la barre du bas à l'ouverture et page défilée au bout. Ordinateur : les sous-onglets, Résultats allumé."""
    echec = lambda detail: res.echec("Mon suivi, parties", vue, detail)
    m = lire_mon_suivi(page)
    if sc.largeur >= SEUIL_TELEPHONE:
        if m["onglets"] != PARTIES_MON_SUIVI:
            echec("les sous-onglets sont %s, attendu %s" % (m["onglets"], PARTIES_MON_SUIVI))
        if m["actif"] != "Résultats":
            echec("le sous-onglet allumé à la première ouverture est « %s », attendu « Résultats »" % m["actif"])
        return
    textes = [l["texte"] for l in m["lignes"]]
    if textes != LIGNES_MON_SUIVI_DU_BANC:
        echec("les lignes du sommaire disent %s, attendu %s" % (textes, LIGNES_MON_SUIVI_DU_BANC))
    if [l["noms"][:1] for l in m["lignes"]] != [[p] for p in PARTIES_MON_SUIVI]:
        echec("les lignes ne commencent pas par le nom de leur partie, dans l'ordre %s : %s" % (PARTIES_MON_SUIVI, [l["noms"] for l in m["lignes"]]))
    for l in m["lignes"]:
        if re.search(r"\d{2}/\d{2}", l["texte"]):
            echec("la ligne « %s » porte une date jj/mm (« 02/10 » se lisait « 2 sur 10 »)" % l["texte"])
        if l["coupee"]:
            echec("la ligne « %s » est coupée (points de suspension ou débordement caché)" % l["texte"])
        if l["h"] < 43.5:
            echec("la ligne « %s » mesure %d px de haut (44 px au moins)" % (l["texte"], l["h"]))
        if not l["clair"]:
            echec("la ligne « %s » n'est pas dans le sommaire aux libellés clairs" % l["texte"])
    if not m["lignes"]:
        return
    der = m["lignes"][-1]
    if der["bas"] > m["barreBas"] + 0.5:
        echec("à l'ouverture, la dernière ligne (« %s ») descend à %d px, sous le haut de la barre du bas (%d px)" % (der["texte"], der["bas"], m["barreBas"]))
    page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(150)
    m2 = lire_mon_suivi(page)
    der = m2["lignes"][-1]
    if der["bas"] > m2["barreBas"] + 0.5:
        echec("page défilée au bout, la dernière ligne (« %s ») descend à %d px, sous le haut de la barre du bas (%d px)" % (der["texte"], der["bas"], m2["barreBas"]))
    page.evaluate("() => window.scrollTo(0, 0)")


def jouer_mon_suivi(page, res, sc):
    """Mon suivi aux libellés clairs (lot 2B, tâche 7), nouvelle navigation, toute personne qui a une fiche, à 1 280 et 375 px. Les parties dans l'ordre ; Résultats
    ouvre « Moi » sans mémoire, « La classe » se choisit, se garde en quittant la page et après un rechargement, « Moi » se rechoisit ; sur téléphone, le retour
    ramène au sommaire ; #/mon-suivi/classe, #/mon-suivi/evolution et #/notes (stagiaire) ouvrent Résultats sur la bonne vue, quelle que soit la mémoire, l'adresse
    devenue celle de Résultats sans étape d'historique ; sur téléphone, un exemple du dossier enregistré fait passer la ligne « Dossier pro » à « 1 exemple sur 6 »."""
    tel = sc.largeur < SEUIL_TELEPHONE
    base = "%s/mon-suivi" % sc.nom
    memoriser = lambda v: page.evaluate("(a) => { try { if (a[1]) localStorage.setItem(a[0], a[1]); else localStorage.removeItem(a[0]); } catch (e) {} }",
                                        [CLE_VUE_RESULTATS, v])
    # 1. Les parties, sans mémoire (ni vue de Résultats ni sous-onglet de Mon suivi).
    page.evaluate("() => { try { localStorage.removeItem('ecsr_monsuivi_subtab'); } catch (e) {} }")
    memoriser(None)
    aller_a(page, "#/home")
    attendre(page)
    aller_a(page, "#/mon-suivi")
    attendre(page)
    vue = base + "/parties"
    res.vues += 1
    verifier_parties_de_mon_suivi(page, res, sc, vue)
    # 2. Résultats, « Moi » par défaut.
    vue = base + "/resultats-moi"
    res.vues += 1
    if tel and not cliquer(page, res, vue, '#view nav.fiche-sommaire a.fiche-ligne[href="#/mon-suivi/resultats"]', "ligne « Résultats » du sommaire"):
        return
    attendre(page)
    if not attendre_vue_de_resultats(page, "moi"):
        res.echec("Mon suivi, Résultats", vue, "Résultats, ouvert sans mémoire, ne montre pas « Mon évolution »")
    # Sur ordinateur, Mon suivi ouvert sans partie garde son adresse jusqu'au premier choix d'onglet ; « Moi / La classe » ne la change pas.
    ouvert = "#/mon-suivi/resultats" if tel else "#/mon-suivi"
    verifier_resultats(res, vue, sc, lire_mon_suivi(page), "moi", ouvert)
    # 3. « La classe » se choisit.
    vue = base + "/resultats-la-classe"
    res.vues += 1
    if not cliquer(page, res, vue, '#view .res-bar button[data-vue="classe"]', "bouton « La classe »"):
        return
    if not attendre_vue_de_resultats(page, "classe"):
        res.echec("Mon suivi, Résultats", vue, "« La classe » ne montre pas la matrice des notes de la classe")
    verifier_resultats(res, vue, sc, lire_mon_suivi(page), "classe", ouvert)
    # 4. La mémoire : quitter la page puis revenir, puis rouvrir l'app (rechargement), « La classe » reste choisie.
    vue = base + "/resultats-memoire"
    res.vues += 1
    aller_a(page, "#/planning")
    attendre(page)
    aller_a(page, "#/mon-suivi/resultats")
    attendre(page)
    attendre_vue_de_resultats(page, "classe")
    verifier_resultats(res, vue, sc, lire_mon_suivi(page), "classe")
    vue = base + "/resultats-memoire-rechargee"
    res.vues += 1
    recharger_au_banc(page, "#/mon-suivi/resultats")
    attendre_vue_de_resultats(page, "classe")
    verifier_resultats(res, vue, sc, lire_mon_suivi(page), "classe")
    # 5. « Moi » se rechoisit ; sur téléphone, le retour ramène au sommaire.
    vue = base + "/resultats-retour-a-moi"
    res.vues += 1
    if cliquer(page, res, vue, '#view .res-bar button[data-vue="moi"]', "bouton « Moi »"):
        attendre_vue_de_resultats(page, "moi")
        verifier_resultats(res, vue, sc, lire_mon_suivi(page), "moi")
    if tel:
        vue = base + "/retour-au-sommaire"
        res.vues += 1
        if cliquer(page, res, vue, "#view a.fiche-retour", "retour « ‹ Mon suivi »"):
            attendre(page)
            m = lire_mon_suivi(page)
            if m["hash"] != "#/mon-suivi" or [l["texte"] for l in m["lignes"]] != LIGNES_MON_SUIVI_DU_BANC or not m["entete"]:
                res.echec("Mon suivi, Résultats", vue, "le retour mène à %s (lignes %s, en-tête %s), attendu le sommaire de #/mon-suivi et son en-tête"
                          % (m["hash"], [l["texte"] for l in m["lignes"]], "visible" if m["entete"] else "caché"))
    # 6. Les adresses d'avant ouvrent Résultats sur leur vue, quelle que soit la mémoire (la vue opposée y est écrite avant).
    adresses = [("#/mon-suivi/classe", "classe"), ("#/mon-suivi/evolution", "moi")] + ([("#/notes", "classe")] if sc.espace == "stagiaire" else [])
    for adresse, cible in adresses:
        vue = "%s/adresse/%s" % (base, adresse.rsplit("/", 1)[-1])
        res.vues += 1
        memoriser("moi" if cible == "classe" else "classe")
        aller_a(page, "#/home")
        attendre(page)
        aller_a(page, adresse)
        attendre(page)
        if not attendre_vue_de_resultats(page, cible):
            res.echec("Mon suivi, adresse d'avant", vue, "%s ne montre pas la vue « %s » de Résultats" % (adresse, "La classe" if cible == "classe" else "Moi"))
        verifier_resultats(res, vue, sc, lire_mon_suivi(page), cible)
        if adresse == "#/mon-suivi/classe":
            page.go_back()
            try:
                page.wait_for_function("() => location.hash === '#/home'", timeout=2000)
            except DelaiDepasse:
                res.echec("Mon suivi, adresse d'avant", vue, "« Précédent » depuis %s mène à %s, attendu #/home (l'adresse de Résultats remplace l'ancienne, sans étape de plus)"
                          % (adresse, page.evaluate("() => location.hash")))
            attendre(page)
    vider_console(res, base)
    # 7. Téléphone : le compte du dossier suit un enregistrement, sans recharger (le banc garde l'écriture, ?ecritures=1).
    if tel:
        jouer_compte_du_dossier(page, res, sc)


def jouer_compte_du_dossier(page, res, sc):
    vue = "%s/mon-suivi/dossier-enregistre" % sc.nom
    res.vues += 1
    recharger_au_banc(page, "#/mon-suivi/dp", ecritures="1")
    try:
        page.wait_for_selector('#view .lv-f[data-k="at1_ex1_titre"]', timeout=6000)
    except DelaiDepasse:
        res.echec("Mon suivi, dossier", vue, "la partie Dossier pro n'affiche pas le titre du premier exemple à remplir")
        return
    if not cliquer(page, res, vue, '#view .lv-f[data-k="at1_ex1_titre"]', "titre du premier exemple du dossier"):
        return
    page.keyboard.type("Leçon de conduite en ville")
    try:
        page.wait_for_function("() => /Enregistré/.test((document.querySelector('#view .lv-status') || {}).textContent || '')", timeout=6000)
    except DelaiDepasse:
        res.echec("Mon suivi, dossier", vue, "le dossier ne s'enregistre pas (statut « %s »)" % page.evaluate("() => (document.querySelector('#view .lv-status') || {}).textContent"))
        return
    if not cliquer(page, res, vue, "#view a.fiche-retour", "retour « ‹ Mon suivi »"):
        return
    attendre(page)
    lignes = [l["texte"] for l in lire_mon_suivi(page)["lignes"]]
    if "Dossier pro : 1 exemple sur 6" not in lignes:
        res.echec("Mon suivi, dossier", vue, "après l'enregistrement d'un exemple, le sommaire dit %s, attendu la ligne « Dossier pro : 1 exemple sur 6 »" % lignes)
    vider_console(res, vue)
    recharger_au_banc(page, "#/home", ecritures="")


def lire_fiche_de_main(page):
    """La fiche telle que main la montre : les noms des parties (lignes du sommaire sur téléphone, sous-onglets de la fiche sur ordinateur, sans ceux de la
    page Stagiaires), et ce que la nouvelle navigation de Mon suivi y ajouterait."""
    return page.evaluate(r"""() => {
      const vue = document.getElementById('view');
      const net = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const lignes = [...vue.querySelectorAll('nav.fiche-sommaire a.fiche-ligne .fiche-ligne-nom')].map((n) => net(n.textContent));
      const barres = [...vue.querySelectorAll('.subtabs-bar')].map((b) => [...b.querySelectorAll(':scope > .subtab')].filter((x) => x.getClientRects().length)
        .map((x) => net(x.childNodes[0] ? x.childNodes[0].textContent : x.textContent)));
      return { lignes, barres, ajouts: vue.querySelectorAll('.res-bar, .fiche-sommaire-clair, .fiche-ligne-texte').length };
    }""")


def parties_de_main_montrees(f, sc):
    if sc.largeur < SEUIL_TELEPHONE:
        return f["lignes"]
    return next((b for b in f["barres"] if b and b[0] == "Passages"), [])


def verifier_fiche_de_l_equipe(page, res, sc):
    """La fiche d'un stagiaire vue par l'équipe (page Stagiaires), dans les deux navigations : les parties de main (Passages, EPCF, Évolution, Livret, Dossier pro),
    sans Résultats ni « Moi / La classe » ni sommaire aux libellés clairs ; la partie Évolution s'ouvre sur son graphe."""
    vue = "%s/stagiaires/%d/fiche-de-main" % (sc.nom, ID_DE_LA_FICHE_DE_L_EQUIPE)
    echec = lambda detail: res.echec("fiche d'un stagiaire chez l'équipe", vue, detail)
    aller_a(page, "#/stagiaires/%d" % ID_DE_LA_FICHE_DE_L_EQUIPE)
    attendre(page)
    try:
        page.wait_for_function("() => !!document.querySelector('#view nav.fiche-sommaire, #view .stg-fiche .subtabs-bar, #view .subtab')", timeout=6000)
    except DelaiDepasse:
        pass
    res.vues += 1
    f = lire_fiche_de_main(page)
    montrees = parties_de_main_montrees(f, sc)
    if montrees != PARTIES_FICHE_DE_MAIN:
        echec("les parties sont %s, attendu celles de main %s (lignes %s, barres %s)" % (montrees, PARTIES_FICHE_DE_MAIN, f["lignes"], f["barres"]))
    if f["ajouts"] or "Résultats" in montrees:
        echec("la fiche montre Résultats, « Moi / La classe » ou le sommaire aux libellés clairs de Mon suivi")
    aller_a(page, "#/stagiaires/%d/evolution" % ID_DE_LA_FICHE_DE_L_EQUIPE)
    attendre(page)
    titre = page.evaluate(r"""() => [...document.querySelectorAll('#view h3.ms-section-title')].map((h) => h.textContent.trim())""")
    if "Évolution" not in titre:
        echec("la partie Évolution de la fiche ne montre pas sa section « Évolution » (titres : %s)" % titre)
    if page.evaluate("() => location.hash") != "#/stagiaires/%d/evolution" % ID_DE_LA_FICHE_DE_L_EQUIPE:
        echec("#/stagiaires/%d/evolution devient %s" % (ID_DE_LA_FICHE_DE_L_EQUIPE, page.evaluate("() => location.hash")))
    vider_console(res, vue)


def verifier_mon_espace_eteint(page, res, sc):
    """Interrupteur éteint : Mon espace garde les parties de main et leurs états (« EPCF 0/2 », « Dossier pro 02/10 » sont ceux de main), sans Résultats ni
    « Moi / La classe » ; #/mon-suivi/evolution ouvre la partie Évolution."""
    vue = "%s/mon-espace-de-main" % sc.nom
    echec = lambda detail: res.echec("Mon espace, interrupteur éteint", vue, detail)
    aller_a(page, "#/mon-suivi")
    attendre(page)
    res.vues += 1
    f = lire_fiche_de_main(page)
    montrees = parties_de_main_montrees(f, sc)
    if montrees != PARTIES_FICHE_DE_MAIN:
        echec("les parties sont %s, attendu celles de main %s" % (montrees, PARTIES_FICHE_DE_MAIN))
    if f["ajouts"] or "Résultats" in montrees:
        echec("Mon espace montre Résultats, « Moi / La classe » ou le sommaire aux libellés clairs de la nouvelle navigation")
    aller_a(page, "#/mon-suivi/evolution")
    attendre(page)
    m = lire_mon_suivi(page)
    if m["hash"] != "#/mon-suivi/evolution" or m["resultats"]:
        echec("#/mon-suivi/evolution devient %s%s, attendu la partie Évolution de main" % (m["hash"], " avec « Moi / La classe »" if m["resultats"] else ""))
    vider_console(res, vue)


def verifier_resultats_fermes(page, res, sc):
    """Module des notes fermé (`?modules=depart`), stagiaire : ni partie Résultats ni « Moi / La classe », ni par Mon suivi ni par #/mon-suivi/classe."""
    vue = "%s/mon-suivi/resultats-fermes" % sc.nom
    res.vues += 1
    for adresse in ("#/mon-suivi", "#/mon-suivi/classe", "#/mon-suivi/resultats"):
        aller_a(page, "#/home")
        attendre(page)
        aller_a(page, adresse)
        attendre(page)
        m = lire_mon_suivi(page)
        noms = m["onglets"] + [l["texte"] for l in m["lignes"]] + ([m["titre"]] if m["titre"] else [])
        if m["resultats"] or any(n.startswith("Résultats") for n in noms):
            res.echec("Mon suivi, notes fermées", vue, "%s montre Résultats (%s) alors que le module des notes est fermé" % (adresse, noms))
    vider_console(res, vue)


def verifier_notes_eteint(page, res, sc):
    """Interrupteur éteint, stagiaire : la page Notes de main (ses deux phrases, « Clique une cellule... » et « Lecture seule... », et ses deux sous-onglets)."""
    vue = "%s/notes" % sc.nom
    aller_a(page, "#/notes")
    attendre(page)
    res.vues += 1
    m = page.evaluate("""() => ({ texte: document.getElementById('view').innerText,
        onglets: [...document.querySelectorAll('#view .subtabs-bar > .subtab')].map((b) => b.textContent.trim()) })""")
    if "Lecture seule. Connexion admin requise pour modifier." not in m["texte"]:
        res.echec("notes, interrupteur éteint", vue, "la phrase « Lecture seule. Connexion admin requise pour modifier. » de main manque")
    if "Clique une cellule pour saisir la note" not in m["texte"]:
        res.echec("notes, interrupteur éteint", vue, "la phrase « Clique une cellule pour saisir la note » de main manque")
    if m["onglets"] != ["Matrice", "EPCF"]:
        res.echec("notes, interrupteur éteint", vue, "les sous-onglets sont « %s », main a « Matrice », « EPCF »" % " », « ".join(m["onglets"]))
    vider_console(res, vue)


def verifier_bandeau_emargement(page, res, sc):
    """Bandeau d'émargement, au-dessus de la page. Nouvelle navigation, sur téléphone : une seule ligne (« Émargement du matin ouvert » et son bouton), les
    horaires du stagiaire et les signatures du formateur cachés, le bouton de 44 px. Au-delà de 700 px, et interrupteur éteint : le bandeau de main, ses
    détails montrés."""
    vue = "%s/bandeau-emargement" % sc.nom
    # Lots 2B, tâches 3 et 4 : l'accueil de chaque espace (Accueil du stagiaire, Aujourd'hui du formateur) porte lui-même la feuille d'émargement, et le bandeau n'y
    # double rien : il se lit sur le Planning. Interrupteur éteint, il se lit sur l'accueil de main.
    aller_a(page, "#/planning" if res.coquille else "#/home")
    attendre(page)
    try:
        page.wait_for_function("() => { const b = document.getElementById('emargement-bandeau'); return !!b && !b.hidden; }", timeout=6000)
    except DelaiDepasse:
        res.echec("bandeau d'émargement", vue, "le bandeau n'est pas affiché alors qu'une feuille est ouverte pour aujourd'hui (émargement allumé au banc)")
        return
    attendre(page, calme=150)
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.bandeauEmargement()")
    if m is None:
        res.echec("bandeau d'émargement", vue, "le bandeau n'est pas affiché alors qu'une feuille est ouverte pour aujourd'hui (émargement allumé au banc)")
        return
    if not m["details"]:
        res.echec("bandeau d'émargement", vue, "le texte du bandeau n'a pas de détail à cacher (.em-bandeau-detail) : « %s »" % m["texte"])
    elif sc.passe == "allume" and sc.largeur < SEUIL_TELEPHONE:
        montres = [d["texte"] for d in m["details"] if d["visible"]]
        if montres:
            res.echec("bandeau d'émargement", vue, "détail montré sur téléphone : « %s » (« %s »)" % (" », « ".join(montres), m["texte"]))
        if m["lignes"] != 1:
            res.echec("bandeau d'émargement", vue, "le bandeau fait %d lignes sur téléphone, une seule attendue : « %s »" % (m["lignes"], m["texte"]))
        elif m["hauteur"] > HAUTEUR_BANDEAU_DEUX_LIGNES:
            res.echec("bandeau d'émargement", vue, "le bandeau d'une ligne mesure %s px, plus que les deux lignes d'avant (%d px) : « %s »"
                      % (m["hauteur"], HAUTEUR_BANDEAU_DEUX_LIGNES, m["texte"]))
        if not m["bouton"] or min(m["bouton"]["l"], m["bouton"]["h"]) < 43.5:
            res.echec("bandeau d'émargement", vue, "bouton « %s » de %s px (44 px au moins sur téléphone)"
                      % (m["bouton"]["nom"] if m["bouton"] else "?", "%sx%s" % (m["bouton"]["l"], m["bouton"]["h"]) if m["bouton"] else "0x0"))
    else:
        caches = [d["texte"] for d in m["details"] if not d["visible"]]
        if caches:
            res.echec("bandeau d'émargement", vue, "détail caché alors que la page est %s : « %s »"
                      % ("celle de main" if sc.passe == "eteint" else "large de %d px" % sc.largeur, " », « ".join(caches)))
    vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Cours et QCM : sous-onglets « QCM » (stagiaire) et « Propositions IA » (équipe), lot 2B, tâche 6
# --------------------------------------------------------------------------------------

SOUS_ONGLETS_COURS_STAGIAIRE = ["Thèmes", "Compétences", "QCM", "Documents"]
SOUS_ONGLETS_COURS_EQUIPE = ["Thèmes", "Compétences", "Signalements", "Propositions IA", "Documents"]
# Ce que le banc sert à la stagiaire du banc : le QCM 50 (thème 22, examen ouvert, deux entraînements à 10/20), le QCM 51 (thème 23, un entraînement à 20/20).
LIGNES_QCM_DU_BANC = [
    ("Thème 22 · Feux du véhicule", "Dernière note 10/20", ["Examen ouvert"]),
    ("Thème 23 · Pneumatiques", "Dernière note 20/20", []),
]
# `?propositions=1` : trois brouillons à relire, deux sur le QCM 50 (le thème 22, le plus récent le 21/10) et un sur le QCM 51 (le thème 23, le 12/10). Le plus ancien d'abord.
LIGNES_PROPOSITIONS_DU_BANC = [
    ("Thème 23 · Pneumatiques", "1 question à relire, proposée le 12/10/2026"),
    ("Thème 22 · Feux du véhicule", "2 questions à relire, la plus ancienne proposée le 20/10/2026"),
]
A_TRAITER_DU_BANC["propositions"] = ("8", "8 à traiter : 5 signalements, 3 propositions de l'IA")
A_TRAITER_DU_BANC["propositions-relue"] = ("7", "7 à traiter : 5 signalements, 2 propositions de l'IA")

JS_LISTE_ACTIONS = r"""() => {
  const vue = document.querySelector('#view');
  const carte = vue.querySelector('.acc-carte');
  const rc = carte ? carte.getBoundingClientRect() : null;
  const lignes = [...vue.querySelectorAll('.acc-ligne-action')].map((l) => {
    const b = l.querySelector('button');
    const r = b.getBoundingClientRect();
    const rl = l.getBoundingClientRect();
    const d = l.querySelector('.acc-ligne-texte span');
    const couleur = d ? (getComputedStyle(d).color.match(/\d+/g) || [0, 0, 0]).map(Number) : [0, 0, 0];
    return { titre: l.querySelector('b').textContent.trim(), detail: d ? d.textContent.trim() : '',
      puces: [...l.querySelectorAll('.acc-ligne-puce')].map((p) => p.textContent.trim()),
      bouton: b.textContent.trim(), nom: b.getAttribute('aria-label'), h: Math.round(r.height), w: Math.round(r.width),
      dehors: !rc || rl.left < rc.left - 0.5 || rl.right > rc.right + 0.5 || r.right > rc.right + 0.5, couleur };
  });
  const actif = vue.querySelector('.subtab.active');
  const compte = vue.querySelector('.acc-compte');
  const erreur = vue.querySelector('.acc-erreur');
  const corps = vue.querySelector('.acc-corps');
  const reessayer = vue.querySelector('.acc-reessayer');
  return { lignes, compte: compte ? compte.textContent : '', titre: (vue.querySelector('.acc-carte-tete h2') || {}).textContent || '',
    actif: actif ? actif.textContent.trim() : null, defile: document.documentElement.scrollWidth > innerWidth + 1,
    erreur: erreur ? erreur.textContent.trim() : null, reessayer: reessayer ? Math.round(reessayer.getBoundingClientRect().height) : null,
    texte: corps ? corps.innerText : '', intro: !!vue.querySelector('.acc-intro'),
    libelles: [...vue.querySelectorAll('.subtabs-bar > .subtab')].map((x) => x.textContent.trim()) };
}"""


def choisir_sous_onglet(page, res, vue, libelle):
    """Un vrai clic sur le sous-onglet, puis la page posée."""
    if cliquer(page, res, vue, '#view .subtabs-bar > .subtab:text-is("%s")' % libelle, "sous-onglet « %s »" % libelle):
        attendre(page)
        return True
    return False


def verifier_liste_d_actions(res, vue, sc, m, attendues, compte, titre_carte, quoi):
    """La liste d'une carte à lignes-boutons : les lignes attendues dans l'ordre (titre, détail, repères), un bouton nommé par sa ligne et de 44 px au moins, aucune
    ligne qui sort de la carte, aucun défilement de côté, aucune note en rouge (la couleur du détail n'est jamais un rouge), le compte et le titre de la carte."""
    echec = lambda detail: res.echec(quoi, vue, detail)
    lus = [(x["titre"], x["detail"], x["puces"]) if len(attendues[0]) == 3 else (x["titre"], x["detail"]) for x in m["lignes"]] if attendues else []
    if lus != attendues:
        echec("les lignes sont %s, attendu %s" % (lus, attendues))
    if m["compte"] != compte:
        echec("le compte de la carte dit « %s », attendu « %s »" % (m["compte"], compte))
    if m["titre"] != titre_carte:
        echec("le titre de la carte est « %s », attendu « %s »" % (m["titre"], titre_carte))
    if not m["intro"]:
        echec("la phrase qui explique la liste manque")
    if m["defile"]:
        echec("la page défile de côté à %d px" % sc.largeur)
    for x in m["lignes"]:
        if x["h"] < 43.5 or x["w"] < 43.5:
            echec("le bouton « %s » de « %s » mesure %dx%d px (44 px au moins)" % (x["bouton"], x["titre"], x["w"], x["h"]))
        if not x["nom"] or x["titre"] not in x["nom"] or not x["nom"].startswith(x["bouton"]):
            echec("le bouton « %s » est nommé « %s » : il doit dire de quelle ligne il est (« %s : %s »)" % (x["bouton"], x["nom"], x["bouton"], x["titre"]))
        if x["dehors"]:
            echec("la ligne « %s » sort de sa carte" % x["titre"])
        r, g, b = x["couleur"][:3]
        if r > 150 and g < 100 and b < 100:
            echec("le détail de « %s » est écrit en rouge (rgb %s %s %s) : jamais une note en rouge" % (x["titre"], r, g, b))


def jouer_qcm_du_stagiaire(page, res, sc):
    """Cours et QCM > QCM, le stagiaire (lot 2B, tâche 6) : les sous-onglets Thèmes, Compétences, QCM, Documents ; la liste de ses QCM (examen ouvert d'abord, sa DERNIÈRE
    note d'entraînement, « Examen ouvert » en repère) ; « Ouvrir » ouvre la fenêtre du QCM (entraîner, erreurs, examen), « Fermer » ramène à la liste ; la fenêtre
    d'entraînement s'ouvre puis se ferme sans rien perdre ; un entraînement fini met la note à jour sans recharger ; une lecture en échec dit sa panne et « Réessayer » la relit."""
    vue = "%s/cours/qcm" % sc.nom
    echec = lambda detail: res.echec("sous-onglet QCM du stagiaire", vue, detail)
    aller_a(page, "#/themes")
    attendre(page)
    res.vues += 1
    m = page.evaluate(JS_LISTE_ACTIONS)
    if m["libelles"] != SOUS_ONGLETS_COURS_STAGIAIRE:
        echec("les sous-onglets de Cours et QCM sont %s, attendu %s" % (m["libelles"], SOUS_ONGLETS_COURS_STAGIAIRE))
        return
    if not choisir_sous_onglet(page, res, vue, "QCM"):
        return
    page.wait_for_selector("#view .acc-ligne-action", timeout=6000)
    m = page.evaluate(JS_LISTE_ACTIONS)
    if m["actif"] != "QCM":
        echec("le sous-onglet allumé est « %s », attendu « QCM »" % m["actif"])
    verifier_liste_d_actions(res, vue, sc, m, LIGNES_QCM_DU_BANC, "2 QCM", "Tes QCM", "sous-onglet QCM du stagiaire")
    if [x["bouton"] for x in m["lignes"]] != ["Ouvrir"] * 2:
        echec("les boutons sont %s, attendu « Ouvrir » sur chaque ligne" % [x["bouton"] for x in m["lignes"]])
    # « Ouvrir » : la fenêtre du QCM, avec l'entraînement, les erreurs et l'examen ouvert ; « Fermer » ramène à la liste.
    vue_fenetre = vue + "/fenetre"
    res.vues += 1
    if not cliquer(page, res, vue_fenetre, '#view .acc-ligne-action button[aria-label="Ouvrir : Thème 22 · Feux du véhicule"]', "bouton « Ouvrir » du thème 22"):
        return
    page.wait_for_selector(".modal-backdrop .theme-modal", timeout=4000)
    page.wait_for_timeout(350)   # l'entrée de la fenêtre
    f = page.evaluate("""() => { const f = document.querySelector('.modal-backdrop .theme-modal'); const r = f.getBoundingClientRect();
        return { texte: f.innerText, boutons: [...f.querySelectorAll('button')].map((b) => b.textContent.trim()),
                 petits: [...f.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => b.textContent.trim() + ' (' + Math.round(b.getBoundingClientRect().height) + ' px)'),
                 dedans: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5 }; }""")
    if "QCM · Feux du véhicule" not in f["texte"]:
        res.echec("fenêtre du QCM", vue_fenetre, "la fenêtre ne porte pas le titre du QCM touché : « %s »" % f["texte"][:80])
    for attendu in ("S'entraîner", "Revoir mes erreurs", "Passer l'examen", "Fermer"):
        if attendu not in f["boutons"]:
            res.echec("fenêtre du QCM", vue_fenetre, "la fenêtre n'a pas son bouton « %s » (boutons : %s)" % (attendu, f["boutons"]))
    if not f["dedans"]:
        res.echec("fenêtre du QCM", vue_fenetre, "la fenêtre du QCM sort de l'écran à %d px" % sc.largeur)
    if sc.largeur < SEUIL_TELEPHONE and f["petits"]:
        res.echec("fenêtre du QCM", vue_fenetre, "zones à toucher sous 44 px sur téléphone dans la fiche du QCM : %s" % ", ".join(f["petits"]))
    # La fenêtre d'entraînement s'ouvre depuis la fiche et se ferme sur la liste.
    if cliquer(page, res, vue_fenetre, ".modal-backdrop .qcm-sheet-body .btn.primary", "« S'entraîner » de la fiche"):
        page.wait_for_selector(".qcm-overlay", timeout=4000)
        if page.locator(".modal-backdrop").count():
            res.echec("fenêtre du QCM", vue_fenetre, "la fiche du QCM reste ouverte sous la fenêtre d'entraînement")
        if cliquer(page, res, vue_fenetre, ".qcm-overlay .qcm-close", "fermeture de l'entraînement"):
            page.wait_for_timeout(300)
    else:
        page.locator(".modal-backdrop .modal-actions .btn").first.click()
    if page.locator(".qcm-overlay").count() or page.locator(".modal-backdrop").count():
        res.echec("fenêtre du QCM", vue_fenetre, "une fenêtre reste ouverte après le retour")
    m = page.evaluate(JS_LISTE_ACTIONS)
    if route_courante(page) != "themes" or m["actif"] != "QCM" or [x["titre"] for x in m["lignes"]] != [t for t, _, _ in LIGNES_QCM_DU_BANC]:
        res.echec("retour à la liste", vue_fenetre, "après la fenêtre : #/%s, sous-onglet %s, lignes %s ; la liste des QCM devait être là" % (route_courante(page), m["actif"], [x["titre"] for x in m["lignes"]]))
    vider_console(res, vue_fenetre)
    # La fiche se ferme aussi par son bouton « Fermer ».
    if cliquer(page, res, vue_fenetre, '#view .acc-ligne-action button[aria-label="Ouvrir : Thème 23 · Pneumatiques"]', "bouton « Ouvrir » du thème 23"):
        page.wait_for_selector(".modal-backdrop .theme-modal", timeout=4000)
        page.wait_for_timeout(350)
        if cliquer(page, res, vue_fenetre, ".modal-backdrop .modal-actions .btn", "« Fermer » de la fiche"):
            page.wait_for_timeout(200)
            if page.locator(".modal-backdrop").count():
                res.echec("fenêtre du QCM", vue_fenetre, "« Fermer » ne ferme pas la fiche")
    # Un entraînement fini (l'événement du lecteur) met la dernière note à jour, sans recharger la page.
    vue_note = vue + "/nouvelle-note"
    res.vues += 1
    page.evaluate("""() => { window.__FIXTURES_DU_BANC.qcm_attempts.push({ id: 990, qcm_id: 50, stagiaire_id: 1, mode: 'entrainement', score: 3, total: 4,
        note_20: 16, answers: {}, finished_at: '2026-10-27T09:00:00Z' }); window.dispatchEvent(new CustomEvent('qcm-attempt-saved', { detail: { qcm_id: 50, mode: 'entrainement', note_20: 16 } })); }""")
    try:
        page.wait_for_function("() => /Dernière note 16\\/20/.test(document.querySelector('#view .acc-ligne-action').innerText)", timeout=4000)
    except DelaiDepasse:
        res.echec("note à jour", vue_note, "après un entraînement fini, la ligne du thème 22 ne dit pas « Dernière note 16/20 » : %s" % page.evaluate(JS_LISTE_ACTIONS)["lignes"][:1])
    # Une lecture en échec : la panne se dit, « Réessayer » relit.
    vue_panne = vue + "/panne"
    res.vues += 1
    page.evaluate("() => { window.__HARNESS_FAIL = 'panne du banc'; }")
    if choisir_sous_onglet(page, res, vue_panne, "Thèmes") and choisir_sous_onglet(page, res, vue_panne, "QCM"):
        try:
            page.wait_for_selector("#view .acc-reessayer", timeout=4000)
        except DelaiDepasse:
            echec("une lecture en échec ne montre pas « Réessayer »")
        m = page.evaluate(JS_LISTE_ACTIONS)
        if m["erreur"] is None or "Tes QCM n'ont pas pu être chargés." not in m["erreur"]:
            res.echec("sous-onglet QCM du stagiaire", vue_panne, "la panne dit « %s », attendu « Tes QCM n'ont pas pu être chargés. »" % m["erreur"])
        if m["reessayer"] is not None and m["reessayer"] < 43.5:
            res.echec("sous-onglet QCM du stagiaire", vue_panne, "« Réessayer » mesure %s px de haut (44 px au moins)" % m["reessayer"])
        page.evaluate("() => { window.__HARNESS_FAIL = null; }")
        if cliquer(page, res, vue_panne, "#view .acc-reessayer", "« Réessayer »"):
            try:
                page.wait_for_selector("#view .acc-ligne-action", timeout=4000)
            except DelaiDepasse:
                res.echec("sous-onglet QCM du stagiaire", vue_panne, "« Réessayer » ne remet pas la liste")
    page.evaluate("() => { window.__HARNESS_FAIL = null; }")
    res.console.clear()   # le « console.error » de la page est le but de l'essai : elle journalise la lecture qui échoue, l'écran dit la panne
    vider_console(res, vue_panne)
    # À froid : l'app s'ouvre sur le sous-onglet mémorisé (QCM), dont la liste se charge d'elle-même (le panneau n'est pas encore dans la page au premier rendu).
    vue_froid = vue + "/a-froid"
    recharger_au_banc(page, "#/themes")
    res.vues += 1
    try:
        page.wait_for_selector("#view .acc-ligne-action", timeout=6000)
    except DelaiDepasse:
        res.echec("sous-onglet QCM du stagiaire", vue_froid, "ouvert à froid sur le sous-onglet mémorisé, la liste ne se charge pas : %s" % page.evaluate(JS_LISTE_ACTIONS)["texte"][:80])
    else:
        m = page.evaluate(JS_LISTE_ACTIONS)
        if m["actif"] != "QCM" or [x["titre"] for x in m["lignes"]] != [t for t, _, _ in LIGNES_QCM_DU_BANC]:
            res.echec("sous-onglet QCM du stagiaire", vue_froid, "à froid : sous-onglet %s, lignes %s" % (m["actif"], [x["titre"] for x in m["lignes"]]))
    vider_console(res, vue_froid)


def verifier_qcm_ferme(page, res, sc):
    """Le module « qcm » fermé pour la promo (le départ : Planning, Calendrier, Ressources) : le stagiaire n'a pas le sous-onglet « QCM » ni sa liste."""
    vue = "%s/cours/qcm-ferme" % sc.nom
    aller_a(page, "#/themes")
    attendre(page)
    res.vues += 1
    m = page.evaluate(JS_LISTE_ACTIONS)
    if "QCM" in m["libelles"] or m["lignes"] or "Tes QCM" in m["titre"]:
        res.echec("module QCM fermé", vue, "le module « qcm » est fermé et le stagiaire voit encore le sous-onglet QCM (sous-onglets %s, %d ligne(s))" % (m["libelles"], len(m["lignes"])))


def lire_a_traiter_de_la_barre(page, res, vue, sc, cle):
    """La pastille de « Cours et QCM » et la phrase du tiroir, comme les dit A_TRAITER_DU_BANC[cle] (le tiroir s'ouvre sur téléphone). Attend que la relecture de la barre aboutisse."""
    attendu, phrase = A_TRAITER_DU_BANC[cle]
    try:
        page.wait_for_function("(a) => [...document.querySelectorAll('[data-nav-coquille] [data-a-traiter]')].some((n) => n.dataset.aTraiter === a)", arg=attendu, timeout=4000)
    except DelaiDepasse:
        res.echec("pastille « à traiter »", vue, "la pastille ne dit pas « %s » (elle dit %s ; le banc : %s)" % (attendu, page.evaluate("() => [...document.querySelectorAll('[data-nav-coquille] [data-a-traiter]')].map((n) => n.dataset.aTraiter)"), phrase))
    sc2 = replace(sc, a_traiter=cle)
    verifier_a_traiter(page, res, sc2)
    if sc.largeur < SEUIL_TELEPHONE and cliquer(page, res, vue, '[data-nav-coquille] [data-nav-action="plus"]', "bouton « Plus »"):
        page.wait_for_timeout(300)
        verifier_a_traiter(page, res, sc2, tiroir=True)
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)


def jouer_propositions_ia(page, res, sc):
    """Cours et QCM > Propositions IA, l'équipe (lot 2B, tâche 6) : Thèmes, Compétences, Signalements, Propositions IA, Documents (pas de sous-onglet QCM) ; la liste vide dit
    « Aucune question à relire. » ; une lecture en échec dit sa panne et « Réessayer » la relit ; avec des brouillons, Aujourd'hui a sa ligne « 3 questions proposées par l'IA »
    qui mène au sous-onglet, la pastille et le tiroir disent le total, « Relire » ouvre l'éditeur du QCM, rejeter une question puis fermer l'éditeur remet la liste, la
    pastille et le tiroir à jour (7 au lieu de 8)."""
    vue = "%s/cours/propositions-ia" % sc.nom
    echec = lambda detail: res.echec("sous-onglet Propositions IA", vue, detail)
    telephone = sc.largeur < SEUIL_TELEPHONE
    aller_a(page, "#/themes")
    attendre(page)
    res.vues += 1
    m = page.evaluate(JS_LISTE_ACTIONS)
    if m["libelles"] != SOUS_ONGLETS_COURS_EQUIPE:
        echec("les sous-onglets de Cours et QCM sont %s, attendu %s" % (m["libelles"], SOUS_ONGLETS_COURS_EQUIPE))
        return
    # 1. Liste vide (le banc ordinaire n'a aucun brouillon).
    if not choisir_sous_onglet(page, res, vue, "Propositions IA"):
        return
    page.wait_for_selector("#view .acc-carte .acc-corps", timeout=4000)
    page.wait_for_function("() => !/Chargement/.test(document.querySelector('#view .acc-carte .acc-corps').innerText)", timeout=4000)
    m = page.evaluate(JS_LISTE_ACTIONS)
    if m["texte"].strip() != "Aucune question à relire." or m["lignes"] or m["compte"] != "":
        echec("sans brouillon, la liste dit « %s » (%d ligne(s), compte « %s »), attendu « Aucune question à relire. »" % (m["texte"].strip(), len(m["lignes"]), m["compte"]))
    # 2. Une lecture en échec.
    vue_panne = vue + "/panne"
    res.vues += 1
    page.evaluate("() => { window.__HARNESS_FAIL = 'panne du banc'; }")
    if choisir_sous_onglet(page, res, vue_panne, "Thèmes") and choisir_sous_onglet(page, res, vue_panne, "Propositions IA"):
        try:
            page.wait_for_selector("#view .acc-reessayer", timeout=4000)
        except DelaiDepasse:
            res.echec("sous-onglet Propositions IA", vue_panne, "une lecture en échec ne montre pas « Réessayer »")
        m = page.evaluate(JS_LISTE_ACTIONS)
        if m["erreur"] is None or "Les propositions de l'IA n'ont pas pu être chargées." not in m["erreur"]:
            res.echec("sous-onglet Propositions IA", vue_panne, "la panne dit « %s », attendu « Les propositions de l'IA n'ont pas pu être chargées. »" % m["erreur"])
        if m["reessayer"] is not None and m["reessayer"] < 43.5:
            res.echec("sous-onglet Propositions IA", vue_panne, "« Réessayer » mesure %s px de haut (44 px au moins)" % m["reessayer"])
        page.evaluate("() => { window.__HARNESS_FAIL = null; }")
        if cliquer(page, res, vue_panne, "#view .acc-reessayer", "« Réessayer »"):
            attendre(page)
            if page.evaluate(JS_LISTE_ACTIONS)["texte"].strip() != "Aucune question à relire.":
                res.echec("sous-onglet Propositions IA", vue_panne, "« Réessayer » ne remet pas la liste (« Aucune question à relire. » attendu)")
    page.evaluate("() => { window.__HARNESS_FAIL = null; }")
    res.console.clear()   # le « console.error » de la page est le but de l'essai : elle journalise la lecture qui échoue, l'écran dit la panne
    vider_console(res, vue_panne)
    # 3. Des brouillons à relire : la ligne d'Aujourd'hui, le sous-onglet, la pastille.
    recharger_au_banc(page, "#/home", propositions="1")
    attendre_accueil(page)
    vue_ligne = vue + "/ligne-d-aujourdhui"
    res.vues += 1
    lignes = page.evaluate("() => [...document.querySelectorAll('#view [data-zone=\"a-traiter\"] a.acc-ligne')].map((a) => [a.innerText.replace(/\\s+/g, ' ').trim(), a.getAttribute('href')])")
    attendues = [["5 signalements sur des QCM", "#/themes"], ["3 questions proposées par l'IA", "#/themes"]]
    if lignes != attendues:
        res.echec("ligne d'Aujourd'hui", vue_ligne, "la carte « À traiter » dit %s, attendu %s" % (lignes, attendues))
        return
    if not cliquer(page, res, vue_ligne, '#view [data-zone="a-traiter"] a.acc-ligne:has-text("proposées par l\'IA")', "ligne « 3 questions proposées par l'IA »"):
        return
    attendre(page)
    page.wait_for_selector("#view .acc-ligne-action", timeout=6000)
    m = page.evaluate(JS_LISTE_ACTIONS)
    if route_courante(page) != "themes" or m["actif"] != "Propositions IA":
        res.echec("ligne d'Aujourd'hui", vue_ligne, "la ligne mène à #/%s, sous-onglet « %s » ; attendu Cours et QCM > Propositions IA" % (route_courante(page), m["actif"]))
    verifier_liste_d_actions(res, vue_ligne, sc, m, [(t, d) for t, d in LIGNES_PROPOSITIONS_DU_BANC], "3 questions à relire", "Questions proposées par l'IA", "sous-onglet Propositions IA")
    if [x["bouton"] for x in m["lignes"]] != ["Relire"] * 2:
        res.echec("sous-onglet Propositions IA", vue_ligne, "les boutons sont %s, attendu « Relire » sur chaque ligne" % [x["bouton"] for x in m["lignes"]])
    lire_a_traiter_de_la_barre(page, res, vue_ligne, sc, "propositions")
    # 4. « Relire » ouvre l'éditeur du QCM ; rejeter une question, fermer : tout se met à jour.
    vue_editeur = vue + "/editeur"
    res.vues += 1
    if not cliquer(page, res, vue_editeur, '#view .acc-ligne-action button[aria-label="Relire : Thème 22 · Feux du véhicule"]', "bouton « Relire » du thème 22"):
        return
    try:
        page.wait_for_selector(".qcm-editor", timeout=4000)
        page.wait_for_function("() => [...document.querySelectorAll('.qcm-editor button')].some((b) => b.textContent.trim() === 'Rejeter')", timeout=4000)
    except DelaiDepasse:
        res.echec("sous-onglet Propositions IA", vue_editeur, "« Relire » n'ouvre pas l'éditeur du QCM du thème 22 avec ses brouillons")
        return
    titre = page.evaluate("() => (document.querySelector('.qcm-editor .qcm-head-title') || {}).textContent || ''")
    if "Feux du véhicule" not in titre:
        res.echec("sous-onglet Propositions IA", vue_editeur, "l'éditeur ouvert est « %s », attendu celui du thème 22 (Feux du véhicule)" % titre)
    page.evaluate("() => { window.confirm = () => true; }")
    if not cliquer(page, res, vue_editeur, ".qcm-editor button:text-is('Rejeter')", "« Rejeter » d'un brouillon"):
        return
    page.wait_for_timeout(500)
    fermer = page.locator(".qcm-editor .qcm-close").first.bounding_box()
    if not fermer or fermer["width"] < 43.5 or fermer["height"] < 43.5:
        res.echec("sous-onglet Propositions IA", vue_editeur, "la fermeture de l'éditeur mesure %s (44 px au moins)" % (fermer and "%dx%d px" % (fermer["width"], fermer["height"])))
    if not cliquer(page, res, vue_editeur, ".qcm-editor .qcm-close", "fermeture de l'éditeur"):
        return
    page.wait_for_timeout(300)
    if page.locator(".qcm-editor").count():
        res.echec("sous-onglet Propositions IA", vue_editeur, "l'éditeur reste ouvert après sa fermeture")
    vue_retour = vue + "/retour-de-l-editeur"
    res.vues += 1
    try:
        page.wait_for_function("() => /2 questions à relire/.test((document.querySelector('#view .acc-compte') || {}).textContent || '')", timeout=4000)
    except DelaiDepasse:
        res.echec("sous-onglet Propositions IA", vue_retour, "après le rejet et la fermeture de l'éditeur, la liste dit « %s », attendu « 2 questions à relire »" % page.evaluate(JS_LISTE_ACTIONS)["compte"])
    m = page.evaluate(JS_LISTE_ACTIONS)
    attendues = [("Thème 23 · Pneumatiques", "1 question à relire, proposée le 12/10/2026"), ("Thème 22 · Feux du véhicule", "1 question à relire, proposée le 21/10/2026")]
    verifier_liste_d_actions(res, vue_retour, sc, m, attendues, "2 questions à relire", "Questions proposées par l'IA", "sous-onglet Propositions IA")
    lire_a_traiter_de_la_barre(page, res, vue_retour, sc, "propositions-relue")
    vider_console(res, vue_retour)
    # À froid : l'app s'ouvre sur le sous-onglet mémorisé (Propositions IA), dont la liste se charge d'elle-même (la base du banc repart de ses trois brouillons).
    vue_froid = vue + "/a-froid"
    recharger_au_banc(page, "#/themes", propositions="1")
    res.vues += 1
    try:
        page.wait_for_selector("#view .acc-ligne-action", timeout=6000)
    except DelaiDepasse:
        res.echec("sous-onglet Propositions IA", vue_froid, "ouvert à froid sur le sous-onglet mémorisé, la liste ne se charge pas : %s" % page.evaluate(JS_LISTE_ACTIONS)["texte"][:80])
    else:
        m = page.evaluate(JS_LISTE_ACTIONS)
        if m["actif"] != "Propositions IA" or m["compte"] != "3 questions à relire":
            res.echec("sous-onglet Propositions IA", vue_froid, "à froid : sous-onglet %s, compte « %s » (attendu « 3 questions à relire »)" % (m["actif"], m["compte"]))
    vider_console(res, vue_froid)
    # Le décompte des signalements échoue, celui des propositions se lit : la carte d'Aujourd'hui garde sa ligne et DIT la panne (elle ne la cache pas).
    vue_panne_compte = vue + "/aujourdhui-un-compte-illisible"
    recharger_au_banc(page, "#/home", propositions="1", panne="qcm_signalements")
    attendre_accueil(page)
    res.vues += 1
    carte = page.evaluate(r"""() => { const c = document.querySelector('#view [data-zone="a-traiter"]');
        return { lignes: [...c.querySelectorAll('a.acc-ligne')].map((a) => a.innerText.replace(/\s+/g, ' ').trim()),
                 alertes: [...c.querySelectorAll('.acc-erreur[role="alert"]')].map((p) => p.textContent.trim()) }; }""")
    if carte["lignes"] != ["3 questions proposées par l'IA"] or carte["alertes"] != ["Le décompte des signalements n'a pas pu être lu."]:
        res.echec("ligne d'Aujourd'hui", vue_panne_compte, "signalements illisibles : la carte « À traiter » dit %s et %s, attendu la ligne « 3 questions proposées par l'IA » et l'alerte « Le décompte des signalements n'a pas pu être lu. »" % (carte["lignes"], carte["alertes"]))
    res.console.clear()   # le « console.error » de la page est le but de l'essai : elle journalise la lecture qui échoue, l'écran dit la panne
    vider_console(res, vue_panne_compte)
    recharger_au_banc(page, "#/home", panne="")


def jouer_allume(page, res, sc, options):
    regles = regles_de_la_page(page, res, sc)
    res.profil_stagiaire = bool(regles.get("profilStagiaire"))
    preparer_coquille(page, res, sc, regles)
    if sc.voir_en_tant_que:
        jouer_voir_en_tant_que(page, res, sc, options)
        return
    verifier_vue(page, res, sc, "ouverture/" + route_courante(page), options)
    # Avant la rubrique Nouveautés, dont l'ouverture marque tout comme lu (le point s'éteint alors) : le bouton du compte, et le menu du
    # compte, dont la ligne « Nouveautés » doit porter le nombre des non lues (que `verifier_menus`, joué après la rubrique, ne voit jamais).
    if res.coquille:
        verifier_bouton_du_compte(page, res, sc, "a-l-ouverture")
        verifier_menu_du_compte_a_l_ouverture(page, res, sc)
        verifier_a_traiter(page, res, sc)
        verifier_contacts_du_centre(page, res, sc)
    entrees = regles["entrees"]
    parcourir_entrees(page, res, sc, entrees, options)
    if res.coquille and sc.espace == "equipe" and sc.largeur == LARGEUR_DE_LA_FICHE:
        verifier_graphe_de_la_fiche(page, res, sc, options)
    # Les pages que le menu du compte ouvre sans avoir d'entrée à elles : Mon espace (qui a un profil
    # stagiaire), Mes préférences (tous les rôles), Nouveautés. Ouvertes par leur adresse : le menu est joué plus bas.
    routes = [e["route"] for e in entrees]
    for route in (["mon-suivi"] if regles.get("profilStagiaire") else []) + ["preferences", "nouveautes"]:
        if route not in routes:
            aller_a(page, "#/" + route)
            verifier_vue(page, res, sc, route, options)
            if route == "mon-suivi" and res.coquille:
                verifier_titre_de_page(page, res, sc, "mon-suivi", "Mon suivi")
            sous_vues(page, res, sc, route, options)
    # La rubrique Nouveautés vient d'être ouverte : tout est lu, le point doit être parti.
    if res.coquille:
        verifier_bouton_du_compte(page, res, sc, "tout-lu")
        verifier_nouveautes(page, res, sc)
        verifier_ccp2(page, res, sc)
    verifier_reglages(page, res, sc, regles)
    verifier_preferences(page, res, sc)
    if res.coquille and "planning" in routes:
        verifier_aujourdhui(page, res, sc)
        verifier_planning_semaine(page, res, sc)
        if sc.espace == "equipe":
            verifier_bouton_benevoles(page, res, sc)
        # Lot 2B, tâche 5 : la grille de la semaine ; les cas qui modifient le banc (liste mémorisée, semaines voisines, verrou) pour les parcours ordinaires.
        verifier_planning_grille(page, res, sc, complet=not (sc.modules or sc.ressources_fermees or sc.voir_en_tant_que or sc.a_traiter))
    if res.coquille:
        verifier_accueil(page, res, sc)
        verifier_bandeau_emargement(page, res, sc)
        if res.profil_stagiaire and sc.modules != "depart":
            verifier_la_classe(page, res, sc)
    if res.coquille and sc.espace == "equipe" and sc.largeur < SEUIL_TELEPHONE:
        aller_a(page, "#/stagiaires")
        verifier_assistant_en_tete(page, res, sc, options)
    jouer_anciennes_adresses(page, res, sc)
    if res.coquille:
        aller_a(page, "#/home")
        verifier_menus(page, res, sc, options)
        if not options.get("sans_menus"):
            verifier_retour_arriere(page, res, sc)
    verifier_lecteur(page, res, sc, options)
    # Lot 2B, tâche 3 : les cas limites de l'Accueil du stagiaire rechargent le banc (une autre date, des pannes) et la signature le modifie : en dernier.
    if res.coquille and sc.espace == "stagiaire" and not (sc.modules or sc.ressources_fermees or sc.voir_en_tant_que):
        if sc.largeur == 375:
            jouer_accueil_du_stagiaire(page, res, sc)
        if sc.largeur in (375, 1280):
            jouer_signature_de_l_accueil(page, res, sc)
        if sc.largeur == 375:
            jouer_planning_etroit(page, res, sc)
    # Lot 2B, tâche 4 : de même pour Aujourd'hui du formateur (la signature n'existe que pour qui a une fiche de stagiaire).
    if res.coquille and sc.espace == "equipe" and not (sc.modules or sc.ressources_fermees or sc.voir_en_tant_que or sc.a_traiter):
        if sc.largeur == 375:
            jouer_aujourdhui_cas_limites(page, res, sc)
        if sc.largeur in (375, 1280) and res.profil_stagiaire:
            jouer_signature_d_aujourdhui(page, res, sc)
    # Lot 2B, tâche 6 : Cours et QCM, sous-onglet QCM du stagiaire (absent quand le module « qcm » est fermé) et Propositions IA de l'équipe. Ils rechargent le banc ou le
    # modifient (une tentative de plus, un brouillon rejeté) : en dernier.
    if res.coquille and not (sc.ressources_fermees or sc.voir_en_tant_que or sc.a_traiter):
        if sc.espace == "stagiaire" and sc.modules == "depart":
            verifier_qcm_ferme(page, res, sc)
        elif sc.espace == "stagiaire" and not sc.modules and sc.largeur in (375, 1280):
            jouer_qcm_du_stagiaire(page, res, sc)
        elif sc.espace == "equipe" and not sc.modules and sc.largeur in (375, 1280):
            jouer_propositions_ia(page, res, sc)
    # Lot 2B, tâche 7 : Mon suivi aux libellés clairs (le compte du dossier recharge le banc et l'écrit : en dernier) ; la fiche d'un stagiaire chez l'équipe, inchangée.
    if res.coquille and not (sc.ressources_fermees or sc.voir_en_tant_que or sc.a_traiter or sc.sans_droits):
        if sc.espace == "stagiaire" and sc.modules == "depart":
            verifier_resultats_fermes(page, res, sc)
        elif not sc.modules and sc.largeur in (375, 1280):
            if sc.espace == "equipe":
                verifier_fiche_de_l_equipe(page, res, sc)
            if res.profil_stagiaire:
                jouer_mon_suivi(page, res, sc)
    # Lot 2B, tâche 8 : la page CCP2 ouverte sur le parcours, pour chaque rôle (les cas sans dates rechargent le banc : en dernier).
    if res.coquille and not (sc.modules or sc.ressources_fermees or sc.voir_en_tant_que or sc.a_traiter or sc.sans_droits) and sc.largeur in (375, 1280):
        jouer_ccp2(page, res, sc)
    # Lot 3, tâche 11 : choisir l'habillage dans le menu du compte et Mes préférences, chaque rôle (formateur sans fiche compris), dans les deux habillages ; sur
    # téléphone, l'enregistrement sur le compte en panne. La page change d'habillage et le banc est rechargé : en dernier.
    if res.coquille and not (sc.modules or sc.ressources_fermees or sc.voir_en_tant_que or sc.a_traiter or sc.sans_droits) and sc.largeur in (375, 1280):
        jouer_choix_d_habillage(page, res, sc, panne=sc.largeur == 375)


def focus_garde(page, res, vue, geste):
    perdu = page.evaluate("() => window.__verifNav.focusPerdu()")
    if perdu:
        res.echec("focus perdu", vue, "%s : le focus n'est plus dans la coquille (%s)" % (geste, perdu))


def jouer_focus_des_fenetres(page, res, sc):
    """Téléphone, fondateur dans l'espace de l'équipe : quand une fenêtre de la coquille se ferme et que son
    bouton a disparu ou ne s'affiche plus, le focus reste dans la coquille, jamais sur body. Deux chemins :
    « Plus », « Mon compte », Voir en tant que « Stagiaire » (la coquille du stagiaire n'a pas de « Plus ») ;
    tiroir ouvert puis écran élargi au-delà de 700 px (un iPhone couché), où le tiroir doit se fermer."""
    vue = "%s/focus-des-fenetres" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    if (cliquer(page, res, vue, '[data-nav-coquille] [data-nav-action="plus"]', "bouton « Plus »")
            and cliquer(page, res, vue, '[role="dialog"] [data-nav-action="compte"]', "« Mon compte » du tiroir")
            and cliquer(page, res, vue, '[role="dialog"] button:text-is("Stagiaire")', "« Stagiaire » de Voir en tant que")):
        attendre(page, calme=250)
        focus_garde(page, res, vue, "« Plus », « Mon compte », Voir en tant que « Stagiaire »")
    page.evaluate("(r) => window.__verifNav.voirEnTantQue(r)", None)
    attendre(page, calme=250)
    if cliquer(page, res, vue, '[data-nav-coquille] [data-nav-action="plus"]', "bouton « Plus »"):
        page.set_viewport_size({"width": 900, "height": HAUTEUR[900]})
        attendre(page, calme=250)
        if page.evaluate("() => window.__verifNav.popupsVisibles()"):
            res.echec("tiroir resté ouvert", vue, "le tiroir « Plus » reste ouvert quand l'écran passe de %d à 900 px" % sc.largeur)
            page.keyboard.press("Escape")
        focus_garde(page, res, vue, "tiroir ouvert, écran élargi à 900 px")
        page.set_viewport_size({"width": sc.largeur, "height": HAUTEUR[sc.largeur]})
        attendre(page, calme=250)
    vider_console(res, vue)


def jouer_voir_en_tant_que(page, res, sc, options):
    """Le fondateur bascule « Voir en tant que » : Stagiaire, Formateur, Stagiaire de nouveau, puis son
    rôle réel. À chaque bascule, la coquille change d'espace sans recharger la page, et l'entrée allumée
    suit la page affichée : la bascule se fait depuis le Planning (entrée des deux espaces), qui doit
    rester allumé dans le nouvel espace. Chaque espace voit ensuite toutes ses entrées."""
    if not res.coquille:
        return
    page.evaluate("() => { window.__vnMarqueur = 'avant'; }")
    if sc.largeur < SEUIL_TELEPHONE:
        jouer_focus_des_fenetres(page, res, sc)
    etapes = (("stagiaire", "stagiaire"), ("prof", "equipe"), ("stagiaire", "stagiaire"), (None, "equipe"))
    for i, (vu, espace) in enumerate(etapes, 1):
        nom_vu = "voir-en-tant-que-%d-%s" % (i, vu or "role-reel")
        aller_a(page, "#/planning")
        attendre(page)
        erreur = page.evaluate("(r) => window.__verifNav.voirEnTantQue(r)", vu)
        if erreur:
            res.echec("règles illisibles", "%s/%s" % (sc.nom, nom_vu), erreur)
            return
        attendre(page, calme=250)
        sc_vu = replace(sc, espace=espace)
        if page.evaluate("() => window.__vnMarqueur") != "avant":
            res.echec("rechargement", "%s/%s" % (sc.nom, nom_vu), "la page a été rechargée par « Voir en tant que » (la coquille doit changer d'espace sur place)")
            return
        regles = regles_de_la_page(page, res, sc_vu)
        if regles.get("espace") != espace:
            res.echec("espace du banc", "%s/%s" % (sc.nom, nom_vu), "les règles donnent l'espace « %s », attendu « %s »" % (regles.get("espace"), espace))
        verifier_vue(page, res, sc_vu, "%s/ouverture/%s" % (nom_vu, route_courante(page)), options)
        # Les comptes « à traiter » suivent l'espace : la pastille dans celui de l'équipe, rien du tout dans celui du stagiaire (lot 2A, tâche 6).
        verifier_a_traiter(page, res, sc_vu)
        if vu:
            verifier_assistant_sous_bandeau(page, res, sc_vu, "%s/%s/assistant" % (sc.nom, nom_vu))
        parcourir_entrees(page, res, sc_vu, regles["entrees"], options, avec_sous_vues=False)
        if vu == "stagiaire":
            verifier_accueil_voir_en_tant_que_stagiaire(page, res, sc_vu, "%s/%s/accueil" % (sc.nom, nom_vu))


def verifier_assistant_sous_bandeau(page, res, sc, vue):
    """« Voir en tant que » pose le bandeau d'aperçu en bas de l'écran : l'assistant, ouvert depuis la coquille (son bouton de l'en-tête
    ou de la barre, par « Plus » seulement si aucun n'est affiché), garde son champ et « Envoyer » à portée, rien ne couvre leur centre."""
    if not page.evaluate("() => !!document.getElementById('impersonation-banner')"):
        res.echec("bandeau d'aperçu absent", vue, "« Voir en tant que » ne montre pas le bandeau d'aperçu en bas de l'écran")
        return
    selecteur = '[data-nav-coquille] [data-nav-action="assistant"]:visible'
    if not page.locator(selecteur).count() and sc.largeur < SEUIL_TELEPHONE:
        if not cliquer(page, res, vue, '[data-nav-coquille] [data-nav-action="plus"]', "bouton « Plus »"):
            return
        page.wait_for_timeout(250)
        selecteur = '[data-nav-coquille="plus"] [data-nav-action="assistant"]'
    if not cliquer(page, res, vue, selecteur, "bouton « Assistant »"):
        return
    page.wait_for_timeout(300)
    controles = page.evaluate("() => window.__verifNav.controlesAssistant()")
    if controles is None:
        res.echec("le menu ne s'ouvre pas", vue, "« Assistant » n'ouvre pas le panneau de l'assistant")
    else:
        for c in controles:
            if c["dessus"]:
                res.echec("assistant recouvert", vue, "%s du panneau de l'assistant : %s en son centre, bandeau d'aperçu affiché" % (c["nom"], c["dessus"]))
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)
    vider_console(res, vue)


def jouer_agenda_vide(page, res, sc):
    """Accueil d'un formateur quand plus aucun événement n'est à venir (la date du banc recule après le dernier) : avec l'ancienne navigation, la liste le dit et dit où
    en ajouter (« l'onglet Calendrier ») et la carte « Prochain événement majeur » n'y est pas ; avec la nouvelle, Aujourd'hui ne lit pas l'agenda et n'en montre rien."""
    vue = "%s/accueil" % sc.nom
    m = ouvrir_accueil(page, res, vue)
    if m is None:
        return
    if sc.passe == "allume":
        # Aujourd'hui (lot 2B, tâche 4) ne lit pas l'agenda : ni liste, ni carte, ni phrase sur l'agenda vide ; la page se pose comme un autre jour.
        if m["agenda"] or m["carte"] or page.evaluate("() => !!document.querySelector('#view .home-empty-line')"):
            res.echec("accueil, agenda vide", vue, "Aujourd'hui montre l'agenda (liste %s, carte %s) : la page n'en lit aucun" % (m["agenda"], bool(m["carte"])))
        vider_console(res, vue)
        return
    attendu = "Aucun événement à venir. " + ("Ajoute-en depuis Planning, Dates clés." if sc.passe == "allume" else "Ajoute-en depuis l'onglet Calendrier.")
    dit = page.evaluate("() => { const e = document.querySelector('#view .home-empty-line'); return e ? e.textContent.trim() : null; }")
    if dit != attendu:
        res.echec("accueil, agenda vide", vue, "la ligne de l'agenda vide est « %s », attendu « %s »" % (dit, attendu))
    if m["carte"]:
        res.echec("accueil, agenda vide", vue, "la carte « Prochain événement majeur » (« %s ») est affichée alors qu'aucun événement n'est à venir" % m["carte"]["titre"])
    vider_console(res, vue)


def jouer_demarrage(page, res, sc):
    """Ruling R17 : l'appareil a vu la promo allumée à l'ouverture précédente et les lectures des réglages sont
    ralenties ; l'ancienne barre ne se peint à aucune image avant la coquille, et l'attente est levée l'app ouverte.
    Les pages et les menus sont joués par les autres scénarios."""
    vue = "%s/ouverture" % sc.nom
    res.vues += 1
    m = page.evaluate("() => ({ images: window.__vnImages || null, attente: document.body.hasAttribute('data-nav-attente'),"
                      " coquille: document.body.dataset.nav === 'v2' && !!document.querySelector('[data-nav-coquille]') })")
    if not m["coquille"]:
        res.echec("coquille absente", vue, "la nouvelle navigation ne s'est pas montée à l'ouverture (réglage de la promo semé)")
    if not m["images"]:
        res.echec("mesure impossible", vue, "l'échantillon des images de l'ouverture n'a pas tourné")
    elif m["images"]["eclair"]:
        res.echec("ancienne barre avant la coquille", vue, "l'ancienne barre est peinte pendant %d image(s) avant la coquille, dès %d ms, la mémoire de l'appareil disant « allumée »"
                  % (m["images"]["eclair"], m["images"]["premiere"]))
    if m["attente"]:
        res.echec("attente de la coquille non levée", vue, "body[data-nav-attente] est encore posé, l'app ouverte")
    vider_console(res, vue)


# `envois` : le relevé du banc (set_my_habillage), posé dès son chargement ; null quand le banc n'en a pas (un banc sans relevé passerait pour « rien envoyé »).
JS_APPAREIL = """(cle) => { let brut = null; try { brut = JSON.parse(localStorage.getItem(cle)); } catch (e) { /* illisible */ }
    return { suite: window.__vnHabillages || null, skin: document.documentElement.dataset.skin || null, appareil: brut,
             envois: Array.isArray(window.__HARNESS_HABILLAGES) ? window.__HARNESS_HABILLAGES.slice() : null }; }"""


def lire_appareil(page):
    """Ce que la page a porté (suite des habillages), porte, a retenu sur l'appareil, et a envoyé au compte du banc. Attend le défaut posé et l'appareil
    réécrit par le démarrage (il l'écrit après l'avoir appliqué) : plus l'habillage de l'autre personne, ni son e-mail."""
    page.wait_for_function("""([cle, autre]) => { if (document.documentElement.dataset.skin !== 'ecsr') return false;
        try { const a = JSON.parse(localStorage.getItem(cle)); return !!a && a.nom === 'ecsr' && a.email !== autre; } catch (e) { return false; } }""",
                           arg=[CLE_HABILLAGE, EMAIL_D_AUTRUI], timeout=4000)
    return page.evaluate(JS_APPAREIL, CLE_HABILLAGE)


def verifier_releve(res, vue, m):
    """Faux et un échec quand le banc ne relève pas les habillages envoyés : « rien envoyé » ne se prouverait pas."""
    if m["envois"] is None:
        res.echec("banc sans relevé des habillages", vue, "window.__HARNESS_HABILLAGES n'existe pas : le banc ne relève pas set_my_habillage, "
                  "« rien envoyé au compte » ne se prouve pas (relancer node _harness_build.mjs avec le faux client du lot 3)")
        return False
    return True


def jouer_appareil_d_autrui(page, res, sc, options):
    """Appareil partagé (Review Focus 1) : l'appareil retient le choix ECF d'une autre personne (son e-mail). Le script d'avant-peinture,
    qui ne sait pas encore qui se connecte, le montre ; une fois le profil lu, la page prend le choix de la personne connectée (ici aucun :
    le défaut), sans rechargement, n'y revient jamais, ne l'envoie pas au compte, et l'appareil ne l'attribue plus à personne : rechargée,
    la page s'ouvre directement dans le défaut. Le menu du compte montre « ECSR Promo » pressée (lot 3, tâche 11), pas le choix de l'autre."""
    regles = regles_de_la_page(page, res, sc)
    res.profil_stagiaire = bool(regles.get("profilStagiaire"))
    preparer_coquille(page, res, sc, regles)
    vue = "%s/ouverture" % sc.nom
    res.vues += 1
    try:
        m = lire_appareil(page)
    except (DelaiDepasse, ErreurPlaywright):
        m = page.evaluate(JS_APPAREIL, CLE_HABILLAGE)
    suite = m["suite"] or []
    if not suite or suite[0] != "ecf":
        res.echec("appareil d'une autre personne", vue, "avant la lecture du profil, la page porte « %s » : attendu « ecf », l'habillage que l'appareil retient (suite : %s)"
                  % (suite[0] if suite else "rien", " puis ".join(suite) or "aucune"))
    if m["skin"] != "ecsr":
        res.echec("appareil d'une autre personne", vue, "une fois le démarrage fini, html[data-skin] vaut « %s » : attendu « ecsr », le choix de la personne connectée (aucun)" % m["skin"])
    if "ecsr" in suite and "ecf" in suite[suite.index("ecsr"):]:
        res.echec("appareil d'une autre personne", vue, "la page revient à l'habillage de l'autre personne après avoir pris celui de la personne connectée (suite : %s)" % " puis ".join(suite))
    if verifier_releve(res, vue, m) and "ecf" in m["envois"]:
        res.echec("appareil d'une autre personne", vue, "le choix ECF de l'autre personne est envoyé au compte de la personne connectée (set_my_habillage : %s)" % m["envois"])
    a = m["appareil"] or {}
    if a.get("nom") != "ecsr" or a.get("email") == EMAIL_D_AUTRUI or a.get("choisi") is not False:
        res.echec("appareil d'une autre personne", vue, "l'appareil retient %s : attendu l'habillage appliqué (ecsr), sans l'e-mail de l'autre personne, et non choisi" % json.dumps(a))
    vider_console(res, vue)
    verifier_vue(page, res, sc, "ouverture/" + route_courante(page), options)
    # Lot 3, tâche 11 : le menu du compte montre le choix de la personne connectée (le défaut), « ECSR Promo » pressée, jamais celui de l'autre.
    vue = "%s/apparence" % sc.nom
    res.vues += 1
    if not res.coquille:
        # Le scénario attend la nouvelle barre : sans elle, le contrôle ne se joue pas, et c'est un échec, pas une vue réussie.
        res.echec("appareil d'une autre personne", vue, "la coquille est absente : le menu du compte et sa pastille « ECSR Promo » pressée ne se contrôlent pas")
    elif cliquer(page, res, vue, '[data-nav-coquille] button[data-nav-action="compte"]:visible', "bouton du compte"):
        page.wait_for_timeout(300)
        g = verifier_apparence(page, res, sc, vue, "menu")
        pressees = [p["habillage"] for p in (g or {"pastilles": []})["pastilles"] if p["presse"] == "true"]
        if g is not None and pressees != ["ecsr"]:
            res.echec("appareil d'une autre personne", vue, "le menu du compte presse %s : attendu « ECSR Promo », le choix de la personne connectée (aucun)" % (pressees or "aucune pastille"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
    vider_console(res, vue)
    # Rechargée, la page s'ouvre dans le défaut : l'appareil ne montre plus le choix de l'autre personne, même avant le profil.
    vue = "%s/rechargement" % sc.nom
    res.vues += 1
    page.reload(wait_until="load")
    page.evaluate(JS_OUTILS)
    attendre(page, calme=250, maximum=8000)
    try:
        m = lire_appareil(page)
    except (DelaiDepasse, ErreurPlaywright):
        m = page.evaluate(JS_APPAREIL, CLE_HABILLAGE)
    if (m["suite"] or ["?"])[0] != "ecsr" or "ecf" in (m["suite"] or []):
        res.echec("appareil d'une autre personne", vue, "rechargée, la page porte encore l'habillage de l'autre personne (suite : %s)" % " puis ".join(m["suite"] or ["aucune"]))
    vider_console(res, vue)


def jouer_case_du_fondateur(page, res, sc):
    """Le fondateur ouvre l'app, la lecture du réglage de la promo échoue (lot 2A, tâche 6, ruling R54) : la décision de la session est celle de l'aperçu de l'appareil s'il y
    en a un, sinon celle de la mémoire de l'appareil pour la promo (ruling R17). La case « Nouvelle navigation activée » de Réglages, elle, ne dit que le réglage de la promo,
    c'est-à-dire cette mémoire : cochée quand la promo a été vue allumée sur l'appareil, décochée sinon, quel que soit l'aperçu. Les six combinaisons (CASES_DU_FONDATEUR),
    la barre appliquée comprise (nouvelle ou ancienne) : c'est elle qui montre que la case ne la suit pas."""
    apercu, memoire, barre_nouvelle, cochee = CASES_DU_FONDATEUR[sc.reglage_illisible]
    vue = "%s/reglages/case-de-la-promo" % sc.nom
    res.vues += 1
    etat = page.evaluate("() => ({ nav: document.body.dataset.nav || null, coquilles: document.querySelectorAll('[data-nav-coquille]').length })")
    nouvelle = etat["nav"] == "v2" and etat["coquilles"] > 0
    contexte = "aperçu %s, mémoire de la promo %s, lecture du réglage ratée" % ({None: "aucun", "1": "allumé", "0": "éteint"}[apercu], "allumée" if memoire else "absente")
    if nouvelle != barre_nouvelle:
        res.echec("barre du banc", vue, "la barre est %s, attendue %s (%s)" % ("la nouvelle" if nouvelle else "l'ancienne", "la nouvelle" if barre_nouvelle else "l'ancienne", contexte))
    aller_a(page, "#/config")
    attendre(page, calme=250)
    coche = page.evaluate("() => { const c = document.getElementById('navigation-v2-promo'); return c ? c.checked : null; }")
    if coche is None:
        res.echec("case de la promo", vue, "la case « Nouvelle navigation activée pour la promo » est absente de Réglages (le fondateur la voit)")
    elif coche is not cochee:
        res.echec("case de la promo", vue, "la case est %s, attendue %s : elle ne dit que le réglage de la promo (la mémoire de l'appareil quand sa lecture a échoué), jamais l'aperçu (%s)"
                  % ("cochée" if coche else "décochée", "cochée" if cochee else "décochée", contexte))
    vider_console(res, vue)


def verifier_barre_des_jours(page, res, sc):
    """Ancienne barre : la barre des jours du planning se colle juste sous la barre du haut, quelle que soit sa
    hauteur (52 px, 57 avec la pastille de promo, 95,5 sur téléphone) ; aucune bande d'elle ne passe dessous."""
    aller_a(page, "#/planning")
    attendre(page, calme=250)
    m = page.evaluate("""() => { const b = document.querySelector('header.topbar'), j = document.querySelector('.p-daynav');
      return b && j && j.getClientRects().length
        ? { barre: b.getBoundingClientRect().height, top: parseFloat(getComputedStyle(j).top) } : null; }""")
    if m is None:
        return   # pas de planning ouvert à cette promo : rien à mesurer
    res.vues += 1
    if abs(m["barre"] - m["top"]) > 0.5:
        res.echec("barre des jours mal collée", "%s/planning/barre-des-jours" % sc.nom,
                  "la barre des jours se colle à %.1f px du haut, la barre du haut mesure %.1f px" % (m["top"], m["barre"]))


def verifier_bulle_sous_bandeaux(page, res, sc, options):
    """Ancienne barre, « Voir en tant que » et promos non chargées : les deux bandeaux du bas sont affichés. La bulle
    de l'assistant, puis le champ et « Envoyer » de son panneau, restent à portée : rien ne couvre leur centre. Le
    panneau s'arrête sous la barre du haut, sa croix se lit et, sur téléphone, croix et « Envoyer » font 44 px."""
    vue = "%s/assistant" % sc.nom
    res.vues += 1
    # Les promos sont en panne à dessein : les erreurs de leur chargement, à l'ouverture, sont attendues.
    res.console.clear()
    erreur = page.evaluate("(r) => window.__verifNav.voirEnTantQue(r)", "prof")
    if erreur:
        res.echec("règles illisibles", vue, erreur)
        return
    attendre(page, calme=250)
    bandeaux = page.evaluate("""() => ['impersonation-banner', 'promos-banner'].filter((i) => {
      const e = document.getElementById(i); return e && e.getClientRects().length; })""")
    if len(bandeaux) < 2:
        res.echec("bandeaux absents", vue, "attendus : le bandeau d'aperçu et celui des promos ; affichés : %s" % (", ".join(bandeaux) or "aucun"))
        return
    bulle = page.evaluate("""() => { const e = document.getElementById('chatbot-fab');
      if (!e || !e.getClientRects().length) return 'bulle absente';
      const r = e.getBoundingClientRect(), t = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return t && e.contains(t) ? null : (t ? ((t.closest('[id]') || t).id || t.tagName) : 'rien'); }""")
    if bulle:
        res.echec("assistant recouvert", vue, "bulle de l'assistant : %s en son centre, bandeaux du bas affichés" % bulle)
    page.evaluate("() => document.getElementById('chatbot-fab')?.click()")
    page.wait_for_timeout(300)
    controles = page.evaluate("() => window.__verifNav.controlesAssistant()")
    if controles is None:
        res.echec("le panneau ne s'ouvre pas", vue, "la bulle n'ouvre pas le panneau de l'assistant")
    else:
        for c in controles:
            if c["dessus"]:
                res.echec("assistant recouvert", vue, "%s du panneau de l'assistant : %s en son centre, bandeaux du bas affichés" % (c["nom"], c["dessus"]))
        geo = page.evaluate("""() => { const p = document.getElementById('chatbot-panel'), b = document.querySelector('header.topbar');
          const taille = (s) => { const e = p.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
            return [Math.round(r.width), Math.round(r.height)]; };
          // Contraste de la croix sur le fond du panneau (couleurs rgb ; une autre écriture n'est pas mesurée).
          const lum = (c) => { const m = /^rgba?\\(([^)]+)\\)$/.exec(c); if (!m) return null;
            const v = m[1].split(/[,\\s/]+/).filter(Boolean).slice(0, 3).map((x) => { x = Number(x) / 255;
              return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
            return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
          const x = p.querySelector('.chatbot-close');
          const a = x ? lum(getComputedStyle(x).color) : null, f = lum(getComputedStyle(p).backgroundColor);
          const contraste = a === null || f === null ? null : (Math.max(a, f) + 0.05) / (Math.min(a, f) + 0.05);
          return { haut: p.getBoundingClientRect().top, barre: b ? b.getBoundingClientRect().bottom : 0,
                   croix: taille('.chatbot-close'), envoyer: taille('.chatbot-form .btn'), contraste }; }""")
        if geo["contraste"] is not None and geo["contraste"] < 3:
            res.echec("contraste (assistant)", vue, "la croix « Fermer » du panneau : %.2f:1 sur son fond (3:1 au moins)" % geo["contraste"])
        if geo["haut"] < geo["barre"] - 0.5:
            res.echec("assistant sous la barre du haut", vue, "le panneau commence à %.1f px, la barre du haut finit à %.1f px" % (geo["haut"], geo["barre"]))
        if sc.largeur < SEUIL_TELEPHONE:
            for quoi, t in (("la croix « Fermer »", geo["croix"]), ("« Envoyer »", geo["envoyer"])):
                if t and min(t) < 44:
                    res.echec("zone à toucher (assistant)", vue, "%s du panneau : %dx%d px (44 px au moins)" % (quoi, t[0], t[1]))
        # La vue entière, panneau ouvert : contrastes (la croix comprise), débordements.
        verifier_vue(page, res, sc, "assistant/ouvert", options)
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)
    vider_console(res, vue)


def jouer_eteint(page, res, sc, options):
    if sc.voir_en_tant_que:
        verifier_bulle_sous_bandeaux(page, res, sc, options)
        return
    verifier_vue(page, res, sc, "ouverture/" + route_courante(page), options)
    routes = page.evaluate("""() => [...document.querySelectorAll('#tabs .tab')].filter((t) => t.getBoundingClientRect().width > 0)
        .map((t) => t.dataset.route)""")
    for route in dict.fromkeys(routes + ["mon-suivi"]):
        aller_a(page, "#/" + route)
        verifier_vue(page, res, sc, route, options)
        sous_vues(page, res, sc, route, options)
    if sc.role in ("prof", "fondateur") and sc.largeur == LARGEUR_DE_LA_FICHE:
        verifier_graphe_de_la_fiche(page, res, sc, options)
    jouer_anciennes_adresses(page, res, sc)
    verifier_preferences_eteint(page, res, sc)
    verifier_titres_eteint(page, res, sc)
    verifier_nouveautes_eteint(page, res, sc)
    verifier_ccp2(page, res, sc)
    verifier_accueil_eteint(page, res, sc)
    verifier_planning_eteint(page, res, sc)
    verifier_planning_grille_eteint(page, res, sc)
    if sc.role == "stagiaire":
        verifier_notes_eteint(page, res, sc)
    # Lot 2B, tâche 7 : éteint, Mon espace et la fiche d'un stagiaire chez l'équipe gardent les parties de main.
    if sc.largeur in (375, 1280) and not sc.voir_en_tant_que and not sc.agenda_vide:
        if sc.role in ("stagiaire", "fondateur"):
            verifier_mon_espace_eteint(page, res, sc)
        if sc.role in ("prof", "fondateur"):
            verifier_fiche_de_l_equipe(page, res, sc)
    verifier_bandeau_emargement(page, res, sc)
    if sc.role in ("prof", "fondateur"):
        verifier_benevoles_eteint(page, res, sc)
    verifier_barre_des_jours(page, res, sc)
    verifier_lecteur(page, res, sc, options)
    # Lot 3, tâche 11 : appareil en « Couleurs ECF », le retour à ECSR Promo par Paramètres (la page change d'habillage, puis se recharge : en dernier).
    if sc.habillage == "ecf" and not sc.voir_en_tant_que:
        jouer_retour_par_parametres(page, res, sc)


def jouer_scenario(navigateur, url, sc, options):
    res = Resultat(sc)
    debut = time.time()
    contexte = None
    try:
        contexte = nouveau_contexte(navigateur, sc, options)
        page = nouvelle_page(contexte, res)
        charger(page, url, sc)
        if sc.appareil_d_autrui:
            jouer_appareil_d_autrui(page, res, sc, options)
        elif sc.demarrage:
            jouer_demarrage(page, res, sc)
        elif sc.agenda_vide:
            jouer_agenda_vide(page, res, sc)
        elif sc.a_traiter:
            jouer_a_traiter(page, res, sc, options)
        elif sc.reglage_illisible:
            jouer_case_du_fondateur(page, res, sc)
        elif sc.ressources_fermees:
            jouer_ressources_fermees(page, res, sc, options)
        elif sc.compte == "direction":
            jouer_direction(page, res, sc)
        elif sc.passe == "allume":
            jouer_allume(page, res, sc, options)
        else:
            jouer_eteint(page, res, sc, options)
    except (DelaiDepasse, ErreurPlaywright) as e:
        res.echec("le script n'a pas pu continuer", sc.nom, "%s (dernière vue mesurée : %s)" % (str(e).strip().splitlines()[0][:200], res.derniere_vue or "aucune"))
    except Exception as e:   # une erreur du script lui-même : visible, et les autres scénarios continuent
        res.echec("erreur du script", sc.nom, "%s : %s" % (type(e).__name__, e))
    finally:
        if contexte:
            try:
                # Les fichiers encore en cours de lecture pour le cache se terminent avant la fermeture (sinon, du bruit).
                contexte.unroute_all(behavior="wait")
                contexte.close()
            except ErreurPlaywright:
                pass
    res.duree = time.time() - debut
    return res


def executer_lot(lot):
    """Un moteur, une liste de scénarios (exécuté dans un processus à part quand il y a plusieurs lots)."""
    moteur, url, options = lot["moteur"], lot["url"], lot["options"]
    scenarios = [Scenario(**s) for s in lot["scenarios"]]
    with sync_playwright() as p:
        navigateur, raison = lancer_navigateur(p, moteur)
        if navigateur is None:
            return {"moteur": moteur, "indisponible": True, "raison": raison, "resultats": []}
        try:
            resultats = [jouer_scenario(navigateur, url, sc, options).en_dict() for sc in scenarios]
        finally:
            navigateur.close()
    return {"moteur": moteur, "indisponible": False, "raison": None, "resultats": resultats}


# --------------------------------------------------------------------------------------
# Rapport
# --------------------------------------------------------------------------------------


def regrouper(elements, cle, vue):
    """[(clé, nombre d'occurrences, première vue)] du plus fréquent au plus rare."""
    comptes = {}
    for e in elements:
        k = cle(e)
        if k in comptes:
            comptes[k][0] += 1
        else:
            comptes[k] = [1, vue(e)]
    return sorted(((k, n, v) for k, (n, v) in comptes.items()), key=lambda x: -x[1])


def lister(groupes, limite):
    montres = groupes if limite is None else groupes[:limite]
    for cle, n, premiere in montres:
        print("    - %s%s" % (cle, "" if n == 1 else "  [%d fois, ex. %s]" % (n, premiere)))
    if len(montres) < len(groupes):
        print("    - ... et %d autre(s) cas (--tout pour les lister)" % (len(groupes) - len(montres)))


ENTETES_AVERTISSEMENTS = {}


def imprimer_rapport(resultats, globaux, tout, debut):
    echecs = [e for r in resultats for e in r["echecs"]] + list(globaux)
    avert = [a for r in resultats for a in r["avert"]]
    vues = sum(r["vues"] for r in resultats)
    limite = None if tout else 3
    print()
    if echecs:
        print("ÉCHECS : %d, dont %d cas distinct(s)" % (len(echecs), len({(t, d) for t, _, d in echecs})))
        par_type = {}
        for e in echecs:
            par_type.setdefault(e[0], []).append(e)
        for type_, liste in sorted(par_type.items(), key=lambda kv: -len(kv[1])):
            print("  %s (%d)" % (type_, len(liste)))
            lister(regrouper(liste, lambda e: e[2], lambda e: e[1]), limite)
    else:
        print("ÉCHECS : aucun")
    if avert:
        print()
        print("AVERTISSEMENTS (sans échec)")
        par_categorie = {}
        for a in avert:
            par_categorie.setdefault(a[0], []).append(a)
        for categorie, liste in par_categorie.items():
            print("  %s" % ENTETES_AVERTISSEMENTS.get(categorie, categorie))
            lister([(k, n, v) for k, n, v in regrouper(liste, lambda a: a[1], lambda a: a[2])], limite)
    c1 = sum(r["clics"][1] for r in resultats)
    c2 = sum(r["clics"][2] for r in resultats)
    if c1 or c2:
        print()
        print("entrées de la coquille ouvertes en cliquant : %d à 1 clic, %d à 2 clics (par « Plus »)" % (c1, c2))
    print("durée : %.0f s" % (time.time() - debut))
    print("%d vues, %d échec(s)" % (vues, len(echecs)))
    return len(echecs)


# --------------------------------------------------------------------------------------
# Programme
# --------------------------------------------------------------------------------------


def repond(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError, ValueError):
        return False


def banc_perime(url):
    """Les fichiers CSS et JS d'index.html que le banc ne charge pas. _harness.html se régénère par
    `node _harness_build.mjs` après toute modification d'index.html : un banc périmé fait jouer l'ancienne
    page (coquille sans sa feuille de style...) et rend le résultat trompeur."""
    index = pathlib.Path(__file__).resolve().parent.parent / "index.html"
    if not index.exists():
        return []
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            banc = r.read().decode("utf-8", "replace")
    except (urllib.error.URLError, OSError):
        return []
    fichiers = lambda texte: set(re.findall(r'(?:href|src)="((?:css|js)/[^"?]+)', texte))
    return sorted(fichiers(index.read_text(encoding="utf-8", errors="replace")) - fichiers(banc))


def adresse_du_banc(demandee, garder_hote):
    url = urllib.parse.urlparse(demandee or BANC_PAR_DEFAUT)
    if url.path in ("", "/"):
        url = url._replace(path="/_harness.html")
    if url.hostname == "localhost" and not garder_hote:
        voisine = url._replace(netloc="127.0.0.1" + (":%d" % url.port if url.port else ""))
        if repond(urllib.parse.urlunparse(voisine)):
            print("(localhost réécrit en 127.0.0.1 : le banc y répond sans le délai d'IPv6 ; --garder-hote pour l'éviter)")
            url = voisine
    return urllib.parse.urlunparse(url)


def liste_de(texte, permis, nom, convertir=str):
    valeurs = [convertir(x) for x in texte.split(",") if x.strip()]
    for v in valeurs:
        if v not in permis:
            raise SystemExit("--%s : « %s » inconnu (choix : %s)" % (nom, v, ", ".join(str(p) for p in permis)))
    return valeurs


def main(argv=None):
    ap = argparse.ArgumentParser(description="Vérifie la nouvelle navigation au banc d'essai (Chromium et WebKit).")
    ap.add_argument("url", nargs="?", help="adresse de _harness.html (défaut %s)" % BANC_PAR_DEFAUT)
    ap.add_argument("--moteurs", default=",".join(MOTEURS))
    ap.add_argument("--roles", default=",".join(ROLES))
    ap.add_argument("--largeurs", default=",".join(str(l) for l in LARGEURS))
    ap.add_argument("--passes", default="allume,eteint")
    ap.add_argument("--habillages", default=",".join(HABILLAGES),
                    help="habillages de la passe allumée (lot 3) : ecsr (défaut), ecf ; avec ecf s'ajoutent la passe éteinte d'un appareil en ECF et l'appareil d'une autre personne")
    ap.add_argument("--sans-menus", action="store_true", help="ne joue pas les menus (boutons du compte et de « Plus » pas encore câblés)")
    ap.add_argument("--tout", action="store_true", help="liste chaque échec et chaque avertissement")
    ap.add_argument("--captures", metavar="DOSSIER", help="une capture d'écran par vue en échec")
    ap.add_argument("--jobs", type=int, default=0, help="processus en parallèle (défaut : deux par moteur)")
    ap.add_argument("--garder-hote", action="store_true", help="n'écrit pas localhost en 127.0.0.1")
    ap.add_argument("--script-init", metavar="FICHIER.js", help="code JavaScript injecté au démarrage de chaque page (mise au point d'une coquille de prototype)")
    args = ap.parse_args(argv)

    moteurs = liste_de(args.moteurs, MOTEURS, "moteurs")
    roles = liste_de(args.roles, ROLES, "roles")
    largeurs = liste_de(args.largeurs, LARGEURS, "largeurs", int)
    passes = liste_de(args.passes, ("allume", "eteint"), "passes")
    habillages = liste_de(args.habillages, HABILLAGES, "habillages")
    scenarios = construire_scenarios(moteurs, roles, largeurs, passes, habillages)
    if not scenarios:
        raise SystemExit("rien à jouer avec ces options")

    url = adresse_du_banc(args.url, args.garder_hote)
    if not repond(url):
        print("Le banc ne répond pas à %s (lancer le serveur « maquette-nav » du worktree)." % url)
        return 2
    absents = banc_perime(url)
    options = {"sans_menus": args.sans_menus,
               "captures": args.captures, "script_init": os.path.abspath(args.script_init) if args.script_init else None}

    # Les scénarios d'un moteur sont répartis en autant de lots que de processus demandés.
    par_moteur = max(1, (args.jobs or 2 * len(moteurs)) // len(moteurs))
    lots = []
    for moteur in moteurs:
        propres = [asdict(sc) for sc in scenarios if sc.moteur == moteur]
        for i in range(par_moteur):
            if propres[i::par_moteur]:
                lots.append({"moteur": moteur, "scenarios": propres[i::par_moteur], "url": url, "options": options})
    print("%d scénario(s) sur %s, %d processus, banc %s" % (len(scenarios), " et ".join(moteurs), len(lots), url), flush=True)
    debut = time.time()
    sorties = []
    if len(lots) == 1:
        sorties.append(executer_lot(lots[0]))
    else:
        with concurrent.futures.ProcessPoolExecutor(max_workers=len(lots)) as pool:
            for futur in concurrent.futures.as_completed([pool.submit(executer_lot, lot) for lot in lots]):
                sorties.append(futur.result())
                print("  %s : %d scénario(s) joué(s) (%.0f s)" % (sorties[-1]["moteur"], len(sorties[-1]["resultats"]), time.time() - debut), flush=True)
    resultats, globaux = [], []   # globaux : échecs qui ne tiennent à aucune vue
    if absents:
        # Un banc périmé rend tout le reste trompeur : un échec à lui seul.
        globaux.append(("banc périmé", "banc", "_harness.html ne charge pas %s, qu'index.html charge : relancer `node _harness_build.mjs`" % ", ".join(absents)))
    for sortie in sorties:
        if sortie["indisponible"]:
            globaux.append(("moteur indisponible", sortie["moteur"], "%s : ses vues n'ont pas été jouées (l'écarter avec --moteurs)" % sortie["raison"]))
        else:
            resultats.extend(sortie["resultats"])
    ordre = {sc.nom: i for i, sc in enumerate(scenarios)}
    resultats.sort(key=lambda r: ordre[r["nom"]])
    for r in resultats:
        print("  %-60s %4d vues, %3d échec(s), %5.1f s" % (r["nom"], r["vues"], len(r["echecs"]), r["duree"]))
    return 1 if imprimer_rapport(resultats, globaux, args.tout, debut) else 0


if __name__ == "__main__":
    for flux in (sys.stdout, sys.stderr):
        flux.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
