#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vérification de la nouvelle navigation au banc d'essai (refonte, lot 1 : la coquille).

Usage
-----
    python outils/verifier_navigation.py [URL_DU_BANC] [options]

    python outils/verifier_navigation.py                              # tout, deux moteurs (environ 3 minutes)
    python outils/verifier_navigation.py --roles stagiaire --sans-menus   # coquille du stagiaire seule (Task 4)

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
    du lot qui déborde de `body[data-nav="v2"]` y fait échouer la page), sauf une liste qui ne donne qu'un
    avertissement, jamais un échec : la dette ouverte du lecteur de cours (DETTE_LECTEUR_DE_COURS, ruling R52),
    dont le sommaire (`.cours-sommaire`) et les tableaux (`.cours-table-wrap`) défilent encore de côté, hors du
    banc, à corriger au lot 2B. Les autres conteneurs des rulings R10 et R11 qui défilaient déjà sur main (graphe de
    Notes, tableaux du centre et des passages, lien Légifrance de Cours > Signalements, graphe de Mon évolution,
    moyennes EPCF de la classe) ont été corrigés au lot 2A, tâche 5, et n'ont aucune exception ;
  * notes en rouge (lot 2A, tâche 5) : le remplissage d'une forme d'un graphe de notes (barres des graphes de Notes, points de
    Mon évolution) n'est jamais rouge (teinte de 345° à 15°, saturation au-dessus de 50 %), mesuré sur la couleur affichée. Les
    trois graphes de Notes sont les onglets d'une même section (Par stagiaire, Par thème, Distribution) : la page n'en montre
    qu'un, les autres sont ouverts un à un et mesurés comme toute vue (défilement de côté compris), puis le premier est rouvert.
    Le banc sert pour cela des notes (NOTES_DU_BANC) qui dessinent chaque teinte de l'échelle des notes ;
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
  * contraste du texte de la coquille et des menus (couleur et fond réels) : 4,5:1, 3:1 pour le grand texte ;
  * barre du bas (téléphone) : 5 entrées au plus, toutes nommées, libellés sur une ligne ;
  * la coquille et le contenu ne se recouvrent pas, tout ce qui est fixe reste dans la fenêtre, l'ancienne
    barre d'onglets est masquée ;
  * menus et tiroirs : entièrement dans l'écran, fermés par Échap (le retour du focus sur le bouton qui les
    a ouverts n'est qu'un avertissement) ;
  * fenêtre ouverte (menu du compte, tiroir « Plus ») : fermée quand « Précédent » change l'adresse, le
    focus restant dans la coquille ; sur téléphone, fermée aussi par son « Fermer » ;
  * Planning > Semaine (ruling R29) : allumé, un bouton nommé « Aujourd'hui », de 44 px, qui, cliqué sur
    une autre semaine que celle du jour, affiche la semaine du jour et amène sa carte en haut de l'écran ;
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
    promo affichée. Accueil et Planning n'en font pas partie (TITRES_DES_PAGES) : l'accueil sera remplacé par Aujourd'hui au lot 2, le Planning garde
    le titre de sa semaine ; Émargement, lui, s'appelle « Émargement » (ruling R50). Les sous-pages reprennent le nom de leur sous-onglet : Planning > Dates clés (ex-Calendrier), Cours et
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
  * Notes et examens (équipe, lot 2A) : sur un écran tactile (le téléphone du banc), le sous-titre est « Touche une case pour saisir la note. » et la
    phrase sur Entrée et Échap n'est pas montrée ; avec une souris, le sous-titre d'avant et la phrase de la barre d'outils ;
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
  * pied de l'Accueil (vague finale, F7) : avec la nouvelle navigation, « TP ECSR App · Promo <nom de la promo affichée> · connecté comme <rôle> », où le rôle d'un administrateur est
    « formateur » (jamais « admin ») ; avec l'ancienne, le texte de main (« Promo 2026 » écrit en dur, « admin ») ;
  * Planning > Semaine : chez le stagiaire, ni « Lecture seule... » ni « Cette semaine » (« Aujourd'hui », en tête de la page, le remplace) ; chez
    l'équipe, « Cette semaine » reste ;
  * Mon suivi > La classe, pour toute personne qui a une fiche (le contexte décide, pas le rôle : le stagiaire, et le fondateur dans l'espace de l'équipe) : ni
    second titre, ni seconde rangée Matrice / EPCF (aucun libellé « EPCF » isolé), ni « Lecture seule... » ; le stagiaire, qui ne saisit rien, ne lit pas non plus
    la phrase sur la saisie et n'a que le nombre de notes. Sous la vue de la classe, la section « Moyennes EPCF de la classe » (ruling R51) : le rendu de l'onglet
    EPCF de la page de l'équipe, avec son k-anonymat (le banc sert des moyennes sur 3 et 2 stagiaires, et un critère sur un seul, jamais montré). Notes et examens,
    page de l'équipe : ses deux sous-onglets Matrice et EPCF, et le titre « Moyennes de la classe » du second ;
  * accueil, agenda vide (lot 2A, tour de correction 1) : un scénario à part par moteur et par passe, la date du banc reculée après le dernier événement
    (DATE_AGENDA_VIDE), formateur : la liste dit où ajouter des événements, « Planning, Dates clés » avec la nouvelle navigation, « l'onglet Calendrier » avec celle de
    main, et la carte du prochain événement majeur n'y est pas ;
  * bandeau d'émargement (stagiaire et équipe) : sur téléphone, une seule ligne (« Émargement du matin ouvert » et son bouton), ses horaires (stagiaire) ou
    ses signatures (équipe) cachés, son bouton de 44 px, sa hauteur au plus celle des deux lignes de main (61 px) ; au-delà de 700 px, et interrupteur
    éteint, ses détails sont montrés ;
  * les quatre anciennes adresses (`#/calendrier`, `#/dashboard`, `#/ressources`, `#/notes`, ruling R26) : allumé, la nouvelle
    page et son sous-onglet allumé (Planning : Dates clés, Priorités ; Cours : Documents ; Mon espace : La classe chez
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

Options utiles pendant le développement : `--roles`, `--moteurs`, `--largeurs`, `--passes`,
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
CLE_REGLAGE = "navigation_v2"  # réglage de la promo, ligne de `settings` (js/nav-etat-regles.js)
CLE_MEMOIRE_PROMO_1 = "ecsr_nav_v2_promo:1"   # mémoire de l'appareil pour la promo 1 du banc (cleMemoire, ruling R17)
CLE_SOUS_ONGLET_STAGIAIRES = "stagiaires.subtab"   # mémoire du sous-onglet de la page Stagiaires (CLES_SOUS_ONGLETS, js/nav-rules.js)
CLE_SOUS_ONGLET_COURS = "themes.subtab"          # celle de Cours et QCM
LENTEUR_DEMARRAGE_MS = 600     # lectures des réglages ralenties dans le scénario de l'ouverture (ruling R17)

# « À traiter » (lot 2A, tâche 6) : ce que la barre de l'équipe montre sur « Cours et QCM » (js/a-traiter.js). Le banc sert cinq signalements
# ouverts (un par groupe de la console) et aucun brouillon de l'IA ; les scénarios « à traiter » ajoutent des brouillons à relire (BROUILLONS_IA_DU_BANC,
# jamais comptés avant le lot 2B, ruling R56), des signalements ouverts (SIGNALEMENTS_EN_PLUS_DU_BANC), des signalements et des brouillons déjà traités (ils
# ne comptent pas non plus), ou font échouer ou traîner les lectures. Par scénario : la pastille attendue sur l'entrée et la phrase en tête du tiroir
# « Plus » (« 5 à traiter : 5 signalements »), None quand rien ne doit s'afficher.
A_TRAITER_DU_BANC = {
    "": ("5", "5 à traiter : 5 signalements"),
    # Des brouillons de l'IA à relire sont semés, mais ils ne comptent pas avant le sous-onglet « Propositions IA » du lot 2B (ruling R56) : la pastille
    # et la phrase ne parlent que des signalements de QCM.
    "ia": ("5", "5 à traiter : 5 signalements"),
    # Six signalements ouverts de plus (5 + 6 = 11, « 9+ ») et six brouillons de l'IA, qui, eux, ne comptent toujours pas.
    "beaucoup": ("9+", "11 à traiter : 11 signalements"),
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
SIGNALER_DU_BANC = "2"

# Aucun défilement de côté, à aucune largeur (règle de Timy du 27/10) : seule la matrice des notes (saisie case
# par case) est admise, sans avertissement. Les conteneurs des rulings R10 et R11 qui défilaient déjà sur main ont été
# corrigés au lot 2A, tâche 5 (graphe de Notes, tableaux du centre et des passages, lien Légifrance de Cours >
# Signalements, graphe de Mon évolution, moyennes EPCF de la classe), à l'exception du lecteur de cours.
EXCEPTION_ADMISE = ".matrice-wrap"
# Dette ouverte (ruling R52) : le sommaire et les tableaux du lecteur de cours défilent encore de côté (css/style.css,
# `.cours-sommaire` et `.cours-table-wrap`). Lecteur de cours, hors du banc, à corriger au lot 2B : un avertissement s'ils
# sont vus, jamais un échec, pour que la trace ne se perde pas.
DETTE_LECTEUR_DE_COURS = (".cours-sommaire", ".cours-table-wrap")

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
function mesurerContrastes(portees, echecs, avert) {
  const W = largeur(), H = hauteur(), deja = new Set();
  let indetermines = 0;
  portees.forEach((racine) => {
    [racine, ...racine.querySelectorAll("*")].forEach((e) => {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      if (!visible(e) || e.closest(SEL_CACHE) || e.closest("button:disabled, [aria-disabled='true']")) return;
      const r = rect(e);
      if (r.right <= 0 || r.left >= W || r.bottom <= 0 || r.top >= H) return;
      const s = style(e);
      let opacite = 1;
      for (let n = e; n && n !== document.body; n = n.parentElement) opacite *= parseFloat(style(n).opacity);
      const fond = fondDe(e);
      if (!fond) { indetermines++; return; }
      const c = analyser(s.color);
      const texteCouleur = sur(c, fond, c.a * opacite);
      const taille = parseFloat(s.fontSize), gras = parseInt(s.fontWeight, 10) >= 700;
      const seuil = (taille >= 24 || (taille >= 18.66 && gras)) ? 3 : 4.5;
      const ratio = rapport(texteCouleur, fond);
      if (ratio >= seuil) return;
      const cle = nom(e) + "|" + hex(texteCouleur) + "|" + hex(fond);
      if (deja.has(cle)) return;
      deja.add(cle);
      echecs.push(["contraste", `${ratio.toFixed(2)}:1 (minimum ${seuil}) ${hex(texteCouleur)} sur ${hex(fond)} : ${nom(e)} « ${texte(e).slice(0, 24)} »`]);
    });
  });
  if (indetermines) avert.push(["contraste indéterminé", `${indetermines} texte(s) de la coquille sur un fond en image ou en dégradé, non mesurés`]);
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
    const d = e.closest(o.dette.join(", "));
    if (d) return "dette:" + o.dette.find((s) => d.matches(s));
    return "page";
  };
  const vus = new Set();
  [document.getElementById("view"), ...racines()].filter(Boolean).forEach((racine) => {
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

// Le cache de lecture de l'app pour une clé (js/db.js, invalidateCache) : une donnée semée dans le faux Supabase après une première lecture ne se relit pas sans cela.
async function invaliderCache(cles) {
  const [db] = await modulesDeLApp(["db"]);
  cles.forEach((c) => db.invalidateCache(c));
}

// ---- Mesure d'une vue ----
async function mesurer(o) {
  const echecs = [], dettes = [], avert = [];
  const W = largeur(), H = hauteur();
  const tel = W < o.seuilTelephone;
  const allume = o.passe === "allume";
  const route = (location.hash || "").replace(/^#\//, "").split("/")[0];
  window.scrollTo(0, 0);
  const vue = document.getElementById("view");

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
  // body[data-nav="v2"] se voit là). Aucun conteneur n'a d'exception, hors la matrice des notes ; seul le lecteur de cours,
  // dette ouverte (ruling R52), ne donne qu'un avertissement, rangé sous le sélecteur de son conteneur.
  const trouves = debordements(o);
  trouves.forEach((t) => {
    if (t.cat === "ignore") return;
    if (t.cat === "coquille") echecs.push(["défilement de côté dans la coquille", t.detail]);
    else if (t.cat === "sous-onglets") echecs.push(["défilement de côté d'une barre de sous-onglets", t.detail]);
    else if (t.cat.startsWith("dette:")) dettes.push([t.cat.slice(6), t.detail]);
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
  return { route, echecs, dettes, avert };
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

  // Contraste du texte de la coquille.
  mesurerContrastes(racines().filter(visible), echecs, avert);

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
function contrasteDuPoint(e) {
  const s = style(e), couleur = analyser(s.backgroundColor), m = /rgba?\([^)]*\)/.exec(s.boxShadow || "");
  return { couleur: hex(couleur), lisere: rapportOuNul(couleur, m ? analyser(m[0]) : null), fond: rapportOuNul(couleur, fondDe(e.parentElement)) };
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
      fond: rapportOuNul(fond, fondDe(e.parentElement)), couleurs: hex(chiffre) + " sur " + hex(fond) };
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
    // Vague finale, F7 : le pied de page (« TP ECSR App · Promo ... · connecté comme ... ») et qui est connecté (de quoi en déduire le rôle écrit).
    piedTexte: (() => { const e = vue.querySelector(".home-footer-v2 p"); return e ? net(e.textContent) : null; })(),
    qui: { admin: auth.isAdmin(), role: (auth.getProfile() || {}).role || null },
    evenements: (await db.listAgendaEvents()).map((e) => ({ type: e.type, titre: e.title, debut: e.date_start, fin: e.date_end })),
  };
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
  return { lecture: /Lecture seule/.test(texte(vue)), cetteSemaine: boutons("Cette semaine"), aujourdhui: boutons("Aujourd'hui") };
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
  pageDeReglages, boutonDuCompte, menuDuCompte, enTeteDePage, panneauBenevoles, enTeteDeLEquipe,
  accueil, comptesDesPages, planningSemaine, laClasse, epcfDeLEquipe, bandeauEmargement, aTraiter, nouveautes, lienDossierPro, graphe, invaliderCache };
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

    @property
    def nom(self):
        variante = "-sans-droits" if self.sans_droits else ""
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


def construire_scenarios(moteurs, roles, largeurs, passes):
    """Les contextes à jouer, dans l'ordre : par moteur, la passe allumée puis la passe éteinte."""
    espace_de = {"stagiaire": "stagiaire", "prof": "equipe", "fondateur": "equipe"}
    # Le fondateur et le stagiaire du banc (fondateur lui aussi) ont l'aperçu de l'appareil ; le
    # formateur prof, qui n'est pas fondateur, n'en a pas : le réglage de la promo l'allume.
    allumage_de = {"stagiaire": "apercu", "prof": "reglage", "fondateur": "apercu"}
    etroit = [l for l in (1280, 375) if l in largeurs]
    # « Voir en tant que » joue aussi 900 px : la colonne d'icônes de l'équipe, où le panneau de l'assistant se pose
    # contre le bandeau d'aperçu, comme à 1280 px (barre dépliée) et à 375 px (barre du bas).
    voir = [l for l in (1280, 900, 375) if l in largeurs]
    scenarios = []
    for moteur in moteurs:
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
    return scenarios


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
        lignes.append("RPC.compter_signalements_app = %s;" % json.dumps(COMPTEURS_SIGNALER_DU_BANC))
    if sc.a_traiter == "signaler":
        # Les lectures « à traiter » échouent (aucun compte), mais « Signaler un problème » a une pastille : la personne du banc a des signalements qui ont avancé.
        lignes.append(JS_PANNE_A_TRAITER)
        lignes.append("RPC.compter_signalements_app = %s;" % json.dumps(COMPTEURS_SIGNALER_DU_BANC))
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
         "dette": list(DETTE_LECTEUR_DE_COURS), "exception": EXCEPTION_ADMISE}
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
    for cle, detail in m["dettes"]:
        res.avertir("dette ouverte, lecteur de cours", cle, vue, detail)
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
        return 0 if depart else 3      # Thèmes, Compétences, Documents (et Signalements chez un formateur)
    if route == "mon-suivi" and res.profil_stagiaire:
        return 0 if depart else 6      # Passages, EPCF, Évolution, Livret, Dossier pro, La classe
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
        if route == "notes" and sc.espace == "equipe" and libelles != ["Matrice", "EPCF"]:
            res.echec("sous-onglets de Notes", "%s/%s" % (sc.nom, route), "la page Notes de l'équipe montre « %s », attendu « Matrice », « EPCF »" % " », « ".join(libelles))
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
                      "ressources": ("#/themes", "Documents"), "notes": ("#/mon-suivi/classe", "La classe")}
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
             hauteur: innerHeight };
}"""


def verifier_aujourdhui(page, res, sc):
    """Ruling R29 : sous la nouvelle navigation, Planning > Semaine porte en haut le bouton « Aujourd'hui » de
    l'ancienne barre du haut, nommé, de 44 px. Cliqué sur la page déjà affichée, une autre semaine que celle du
    jour à l'écran, il affiche la semaine du jour et amène la carte du jour en haut de l'écran."""
    vue = "%s/planning/aujourdhui" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    semaine = page.locator("#view .subtabs-bar > .subtab", has_text="Semaine")
    if semaine.count():
        semaine.first.click()
        attendre(page)
    res.vues += 1
    bouton = page.get_by_role("button", name="Aujourd'hui", exact=True)
    if bouton.count() != 1:
        res.echec("bouton « Aujourd'hui »", vue, "Planning > Semaine montre %d bouton(s) nommé(s) « Aujourd'hui », 1 attendu" % bouton.count())
        return
    boite = bouton.bounding_box()
    if not boite or boite["width"] < 43.5 or boite["height"] < 43.5:
        res.echec("bouton « Aujourd'hui »", vue, "zone à toucher de %s px (44 px au moins)" % ("%dx%d" % (boite["width"], boite["height"]) if boite else "0x0"))
    lundi, jour = lundi_et_jour(DATE_DU_BANC)
    if page.evaluate(JS_SEMAINE_AFFICHEE)["lundi"] == lundi:
        # Déjà la semaine du jour : une autre d'abord, le bouton doit aussi changer de semaine.
        page.get_by_role("button", name="Semaine précédente").click()
        attendre(page)
    bouton.click()
    page.wait_for_timeout(100)
    attendre(page)
    page.wait_for_timeout(400)   # le saut vers le jour : défilement fluide, puis direct après 250 ms (scrollToDay)
    m = page.evaluate(JS_SEMAINE_AFFICHEE)
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
SECTIONS_PREFERENCES = ("Dans les notes de la classe", "Informations")
# Le sous-titre de Mes préférences, selon qu'il y a un réglage à montrer (l'anonymat, pour qui a une fiche de stagiaire) ou seulement les informations.
SOUS_TITRE_PREFERENCES = ("Ce qui ne concerne que toi, et les informations sur l'application.", "Les informations sur l'application.")
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
        c = b["pointContraste"]
        for contre, valeur in (("son liseré", c and c["lisere"]), ("le fond derrière lui", c and c["fond"])):
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


def nombre_de_la_phrase(phrase):
    """Le total que dit la phrase du tiroir (« 7 à traiter : ... » donne 7)."""
    return int(phrase.split(" ")[0])


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
        if p["fond"] is not None and p["fond"] < 3:
            res.echec("contraste d'une pastille « à traiter »", vue, "la pastille ne tient que %.2f:1 contre ce qui l'entoure (%s), 3:1 au moins pour un repère" % (p["fond"], p["couleurs"]))
    # Toute pastille de la barre sombre, celle de « Signaler un problème » comme celle de « Cours et QCM » (relecture de la tâche 6, point 4) : le chiffre tient 4,5:1 contre
    # son fond, la pastille 3:1 contre la barre (le vert d'origine, --accent, n'en tenait que 2,9 contre elle). Les scénarios avec brouillons sèment les compteurs de « Signaler
    # un problème » : sa pastille y est, sinon le contrôle ne verrait que la première.
    for p in m["barreSombre"]:
        de = "de « Signaler un problème »" if p["de"] == "signaler" else "de l'entrée %s" % (p["de"] or "?")
        if p["chiffre"] is not None and p["chiffre"] < 4.5:
            res.echec("contraste d'une pastille de la barre sombre", vue, "le chiffre de la pastille %s ne tient que %.2f:1 (%s), 4,5:1 au moins" % (de, p["chiffre"], p["couleurs"]))
        if p["fond"] is not None and p["fond"] < 3:
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
        for contre, valeur in (("son liseré", p["lisere"]), ("le fond derrière lui", p["fond"])):
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
        for contre, valeur in (("son liseré", p["lisere"]), ("le fond derrière lui", p["fond"])):
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
    if p["sousTitre"] != SOUS_TITRE_PREFERENCES[0 if avec_reglage else 1]:
        res.echec("page Mes préférences", vue, "le sous-titre est « %s », attendu « %s »" % (p["sousTitre"], SOUS_TITRE_PREFERENCES[0 if avec_reglage else 1]))
    if avec_reglage and p["anonymat"] is None:
        res.echec("page Mes préférences", vue, "la personne a une fiche de stagiaire : le réglage de l'anonymat dans les notes manque")
    if not res.profil_stagiaire and p["anonymat"] is not None:
        res.echec("page Mes préférences", vue, "la personne n'a pas de fiche de stagiaire : le réglage de l'anonymat dans les notes est montré (« %s »)" % p["anonymat"][:60])
    verifier_texte_de_l_anonymat(res, vue, p, "page Mes préférences")
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

# Pages dont le titre (h2) est le libellé de leur entrée, par espace (ruling R30, une page, un nom). N'en font pas partie : Accueil, que
# la page Aujourd'hui remplacera au lot 2, et Planning, dont la semaine garde son titre (« Planning de la semaine », le surtitre disant la
# semaine). Émargement en fait partie depuis la tâche 4 (ruling R50 : « Émargement », et non « Feuilles d'émargement »). Le titre de Mon
# suivi se lit aussi chez qui n'a pas cette entrée (fondateur).
TITRES_DES_PAGES = {
    "equipe": ("emargement", "stagiaires", "notes", "themes", "centre", "config", "ccp2"),
    "stagiaire": ("themes", "mon-suivi", "ccp2"),
}
# Parmi elles, celles dont le surtitre est le nom de la promo affichée (CCP2 garde « Titre professionnel ECSR »).
SURTITRE_PROMO = ("emargement", "stagiaires", "notes", "themes", "centre", "config", "mon-suivi")
SOUS_ONGLETS_STAGIAIRES = ["Stagiaires", "Élèves bénévoles"]
# Sous-pages qui ont repris le nom de leur sous-onglet : Planning > Dates clés (ex-Calendrier), Cours et QCM > Documents (ex-Ressources).
SOUS_PAGES = (("planning", "Dates clés"), ("themes", "Documents"))
PHRASE_TACTILE = "Touche une case pour saisir la note."


def verifier_titre_de_page(page, res, sc, route, libelle):
    """Le titre de la page est le libellé de son entrée et, sauf pour CCP2, son surtitre est le nom de la promo affichée (celui que
    l'app lit, getPromoCourante). Mon suivi est lu aussi chez qui n'a pas d'entrée à ce nom : le fondateur, par le menu du compte."""
    vue = "%s/titre/%s" % (sc.nom, route)
    res.vues += 1
    p = page.evaluate("() => window.__verifNav.enTeteDePage()")
    if p["route"] != route:
        return   # la page n'est pas celle qu'on attendait : le défaut est noté à l'ouverture
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
    """Planning, nouvelle navigation : le bouton « Élèves bénévoles » (« Bénévoles » sur téléphone) ne s'ouvre plus en fenêtre : il mène à la
    page Stagiaires, sous-onglet « Élèves bénévoles »."""
    vue = "%s/planning/benevoles" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    semaine = page.locator("#view .subtabs-bar > .subtab", has_text="Semaine")
    if semaine.count():
        semaine.first.click()
        attendre(page)
    res.vues += 1
    bouton = page.locator('#view button[title^="Banque d\'élèves bénévoles"]')
    if bouton.count() != 1:
        res.echec("bouton des bénévoles", vue, "Planning > Semaine montre %d bouton(s) de la banque des bénévoles, 1 attendu" % bouton.count())
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
    """Notes et examens, équipe : sur un écran tactile (le téléphone du banc), le sous-titre dit « Touche une case pour saisir la note. » et
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
        ("Mon suivi, La classe", "Notes et examens, Synthèse classe", "Notes, Synthèse classe", "#/notes"),
    "Tes notes et ta fiche mieux protégées": ("Mon suivi, La classe", "Notes et examens", "Notes", "#/notes"),
    "Ton Dossier Professionnel se remplit dans l'app":
        ("Mon suivi, partie Dossier pro", "Mon suivi, partie Dossier pro", "Mon espace personnel, partie Dossier pro", "#/mon-suivi/dp"),
    "Ton livret officiel TP-01303 se remplit dans l'app":
        ("Mon suivi, partie Livret", "Mon suivi, partie Livret", "Mon espace personnel, partie Livret", "#/mon-suivi/livret"),
    "Des vidéos conseillées dans la boîte à outils CCP2":
        ("Cours et QCM, Documents", "Cours et QCM, Documents", "Ressources, Examens", "#/ressources"),
    "Une boîte à outils numérique pour ton CCP2": ("Cours et QCM, Documents", "Cours et QCM, Documents", "Ressources", "#/ressources"),
    "Un passage oublié ? Ajoute-le toi-même, même ancien": ("Planning, Priorités", "Planning, Priorités", "Planning, bouton Priorités", "#/dashboard"),
    "Anonyme pour de vrai dans le tableau de notes": ("Mes préférences", "Mes préférences", "Paramètres, Mes préférences", "#/config"),
    "Les cours des 57 thèmes sont ouverts à toute la promo": ("Cours et QCM", "Cours et QCM", "Cours", "#/themes"),
    "Ta progression d'entraînement se voit d'un coup d'œil": ("Cours et QCM, colonne QCM", "Cours et QCM, colonne QCM", "Cours, colonne QCM", "#/themes"),
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
    # « Plus »), celle de main avec l'ancienne (F4). Et le bouton « Aujourd'hui », en tête de Planning, Semaine (la carte du lancement est cachée avec l'ancienne barre).
    "Signaler un problème en deux gestes":
        ("Ouvre ton compte avec tes initiales, en haut à droite, puis choisis « Signaler un problème ». Chez les formateurs, le bouton est en bas de la barre de "
         "gauche sur ordinateur, et dans « Plus » sur téléphone.", "Touche ton nom en haut de l'écran, ou ouvre l'Assistant."),
    TITRE_LANCEMENT:
        ("Dans Planning, Semaine, le bouton « Aujourd'hui », en tête de la page, t'amène à la journée du jour.", "(carte cachée avec l'ancienne barre)"),
    "Ton Dossier Professionnel se remplit dans l'app":
        ("Ouvre Mon suivi, dans la barre.", "Ouvre ton espace personnel avec le logo en haut à gauche."),
    "Ton livret officiel TP-01303 se remplit dans l'app":
        ("Ouvre Mon suivi, partie Livret.", "Renseigne ta date de naissance dans ton espace personnel si ce n'est pas déjà fait."),
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
}
LIEN_DES_BENEVOLES = ("Stagiaires, Élèves bénévoles", "#/stagiaires")   # le lien de la Nouveauté de lancement de l'équipe
PIED_DE_L_ACCUEIL = {"ancienne": ("paramètres", "#/config"), "stagiaire": ("mes préférences", "#/preferences"), "equipe": ("réglages", "#/config")}
CTRL_Z = {"ancienne": "Ctrl + Z annule la dernière action. Sur Notes, Passages, Thèmes et Calendrier.",
          "nouvelle": "Ctrl + Z annule la dernière action. Sur les notes, les passages, les thèmes et les dates clés."}
SOCLE = {"ancienne": "Toujours ouverts : Accueil, Mon espace personnel (Passages), Paramètres, Nouveautés.",
         "nouvelle": "Toujours ouverts : Accueil, Mon suivi (Passages), Mes préférences, Nouveautés."}
LIEN_DOSSIER_PRO = "Ton dossier professionnel, à remplir dans l'app"


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
    vider_console(res, vue)


def verifier_nouveautes_de_l_accueil(page, res, vue, equipe):
    """Accueil, nouvelle navigation : les trois plus récentes Nouveautés de la section commencent par celles du lancement (la première pour tous, la
    seconde pour l'équipe). Appelé depuis l'accueil déjà ouvert."""
    titres = [c["titre"] for c in page.evaluate("() => window.__verifNav.nouveautes()")]
    attendus = [TITRE_LANCEMENT] + ([TITRE_LANCEMENT_EQUIPE] if equipe else [])
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
    """Le pied de l'Accueil dit la promo et le rôle (vague finale, F7). Avec la nouvelle navigation : « TP ECSR App · Promo <nom de la promo affichée> · connecté comme
    <rôle> », où le rôle d'un administrateur est « formateur » (jamais « admin »). Avec l'ancienne : le texte de main, « Promo 2026 » écrit en dur, « admin » compris.
    Le rôle se déduit de la personne connectée, lue dans la page (administrateur, ou son rôle de profil)."""
    qui = m["qui"]
    if qui["admin"]:
        role = "formateur" if nouvelle else "admin"
    else:
        role = {"prof": "formateur", "stagiaire": "stagiaire"}.get(qui["role"], "")
    promo = ("Promo %s" % m["promo"]["nom"]) if nouvelle else "Promo 2026"
    attendu = "TP ECSR App · %s · connecté comme %s" % (promo, role) if role else "TP ECSR App · %s ·" % promo
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
    dossier professionnel, à remplir dans l'app » et mène à la partie Dossier pro (#/mon-suivi/dp). Rien si CCP2 est fermé pour ce stagiaire."""
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
    vider_console(res, vue)


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
K_ANONYMAT = 2    # une moyenne de la classe n'est montrée qu'à partir de 2 stagiaires évalués (js/epcf-restitution.js)
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


def attendre_accueil(page):
    """L'accueil lit l'agenda après s'être posé : la carte et la liste n'y sont qu'une fois le « Chargement… » de la liste remplacé."""
    page.wait_for_function("() => { const l = document.getElementById('home-agenda-list'); return !l || !/Chargement/.test(l.textContent); }", timeout=6000)


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
    énumérait les pages de l'ancienne barre est remplacée par « Promo <nom> · semaine <n> », aucune tuile ne double la barre ; la carte « Prochain
    événement majeur » compte les jours qui restent, jamais en nombre négatif."""
    vue = "%s/accueil" % sc.nom
    m = ouvrir_accueil(page, res, vue)
    if m is None:
        return
    if m["logos"]:
        res.echec("accueil", vue, "%d logo(s) à côté de la date : la coquille porte déjà le logo" % m["logos"])
    if m["tuiles"]:
        res.echec("accueil", vue, "des tuiles doublent la barre : %s" % ", ".join(m["tuiles"]))
    attendue = ligne_promo_attendue(m["promo"], datetime.date.fromisoformat(DATE_DU_BANC))
    if m["lead"] != attendue:
        res.echec("accueil", vue, "la ligne sous la salutation est « %s », attendu « %s »" % (m["lead"], attendue))
    # Lot 2A, tâche 1 : les Nouveautés du lancement ouvrent la section, la ligne Ctrl + Z et le lien du pied portent les noms de la nouvelle barre.
    verifier_nouveautes_de_l_accueil(page, res, vue, sc.espace == "equipe")
    verifier_pied_et_retenir(res, vue, m, sc.espace)
    verifier_pied_de_l_accueil(res, vue, m, True)
    if m["agenda"]:
        verifier_carte(res, vue, m)
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
    """Planning > Semaine, nouvelle navigation : chez le stagiaire, ni la phrase « Lecture seule... » ni le bouton « Cette semaine » (« Aujourd'hui », en tête
    de la page, le remplace) ; chez l'équipe, le bouton reste."""
    vue = "%s/planning/semaine" % sc.nom
    aller_a(page, "#/planning")
    attendre(page)
    semaine = page.locator("#view .subtabs-bar > .subtab", has_text="Semaine")
    if semaine.count():
        semaine.first.click()
        attendre(page)
    res.vues += 1
    m = page.evaluate("() => window.__verifNav.planningSemaine()")
    if sc.espace == "stagiaire":
        if m["cetteSemaine"]:
            res.echec("planning du stagiaire", vue, "le bouton « Cette semaine » est encore montré (« Aujourd'hui » le remplace)")
        if m["aujourdhui"] != 1:
            res.echec("planning du stagiaire", vue, "%d bouton(s) « Aujourd'hui » dans la page, 1 attendu" % m["aujourdhui"])
        if m["lecture"]:
            res.echec("planning du stagiaire", vue, "la page dit encore « Lecture seule » à un stagiaire")
    elif m["cetteSemaine"] != 1:
        res.echec("planning de l'équipe", vue, "%d bouton(s) « Cette semaine » chez l'équipe, 1 attendu" % m["cetteSemaine"])
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
        if not re.fullmatch(r".+ : %d stagiaire\(s\) évalué\(s\)" % evalues, epreuve["titre"]):
            res.echec("la classe, moyennes EPCF", vue, "le titre d'une épreuve est « %s », attendu « <épreuve> : %d stagiaire(s) évalué(s) »" % (epreuve["titre"], evalues))
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
    aller_a(page, "#/home")
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
    """Accueil d'un formateur quand plus aucun événement n'est à venir (la date du banc recule après le dernier) : la liste le dit et dit où en ajouter,
    « Planning, Dates clés » avec la nouvelle navigation, « l'onglet Calendrier » avec celle de main ; la carte « Prochain événement majeur » n'y est pas."""
    vue = "%s/accueil" % sc.nom
    m = ouvrir_accueil(page, res, vue)
    if m is None:
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
    if sc.role == "stagiaire":
        verifier_notes_eteint(page, res, sc)
    verifier_bandeau_emargement(page, res, sc)
    if sc.role in ("prof", "fondateur"):
        verifier_benevoles_eteint(page, res, sc)
    verifier_barre_des_jours(page, res, sc)


def jouer_scenario(navigateur, url, sc, options):
    res = Resultat(sc)
    debut = time.time()
    contexte = None
    try:
        contexte = nouveau_contexte(navigateur, sc, options)
        page = nouvelle_page(contexte, res)
        charger(page, url, sc)
        if sc.demarrage:
            jouer_demarrage(page, res, sc)
        elif sc.agenda_vide:
            jouer_agenda_vide(page, res, sc)
        elif sc.a_traiter:
            jouer_a_traiter(page, res, sc, options)
        elif sc.reglage_illisible:
            jouer_case_du_fondateur(page, res, sc)
        elif sc.ressources_fermees:
            jouer_ressources_fermees(page, res, sc, options)
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


ENTETES_AVERTISSEMENTS = {
    "dette ouverte, lecteur de cours": "dette ouverte, lecteur de cours (ruling R52) : défilement de côté du sommaire ou d'un tableau d'un cours, hors du banc, à corriger au lot 2B (avertissement sans échec)",
}


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
    scenarios = construire_scenarios(moteurs, roles, largeurs, passes)
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
