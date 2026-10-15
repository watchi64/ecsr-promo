/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Sources des dessins de la famille « visibilité » (js/dessins-visibilite.js) : la phrase du cours illustrée, les sources et
 * les choix de dessin. Lues par les tests et les relecteurs, jamais servies aux stagiaires.
 */

// Le rétroviseur extérieur, commun à « retroviseurs » et « angles-morts » (miroirExterieur dans le module).
const MIROIR_PLAN = "Choix de dessin, rétroviseur extérieur (le même dans « retroviseurs » et « angles-morts ») : un miroir plan, "
  + "tiré de la géométrie du kit. Son verre fait 16 cm, la face arrière du boîtier du kit (de 0,85 à 1,01 m de l'axe), centré sur "
  + "le miroir (0,96 m devant le centre de la voiture, 0,93 m de l'axe) et orienté pour renvoyer l'arrière vers l'œil du "
  + "conducteur ; son champ horizontal est l'angle sous lequel l'œil voit ce verre : 9,4 degrés à gauche (verre à 0,93 m de "
  + "l'œil), 5,2 degrés à droite (à 1,53 m). Le réglage se lit sur la caisse : vue de l'œil reflété (devant le miroir, à la "
  + "distance de l'œil), la caisse du kit s'arrête au point de l'arrondi de son coin arrière (rayon de 0,4 m) que frôle le rayon "
  + "issu de lui, 1,85 m derrière le centre ; le miroir est tourné pour qu'elle prenne 9 % de la largeur de son image (le mince "
  + "liseré du cours). La direction de l'arrière y fuit alors à 13,9 % de la largeur depuis le bord intérieur à gauche, 16,6 % à "
  + "droite ; vu du dessus, le champ entre de 1,3 degré dans la caisse à gauche (0,9 à droite) et s'écarte de 8,1 degrés vers "
  + "l'extérieur (4,3 à droite). Au-delà du verre, la caisse en cache la partie intérieure : le champ visible s'arrête au rayon "
  + "rasant, de l'œil reflété par le coin arrière. Le kit ne dit pas si ses miroirs sont plans ou bombés ; le miroir droit est "
  + "fréquemment convexe (thème 24, G), ce qui élargit son champ et raccourcit l'angle mort droit : le miroir plan est le seul que "
  + "donne la géométrie du kit sans rayon de courbure inventé.";

export const SOURCES = {
  "zones-invisibles": [
    "Cours C1.2, « Entrer » : avant de monter, faire le tour du véhicule, vérifications (C1.1) et obstacles, l'avant du capot et "
      + "l'arrière du coffre n'étant pas visibles depuis le siège.",
    "Thème 24, F (« Les angles morts qui ne sont pas latéraux ») : il existe aussi un angle mort devant le capot et derrière le "
      + "coffre, d'où le contour du véhicule avant toute marche arrière ; § 3, comportement attendu : faire le tour du véhicule "
      + "avant de reculer, et considérer que l'avant du capot et l'arrière du coffre ne sont pas vus. Fiche ECF C1-A (points "
      + "clés) : tour du véhicule avant chaque départ.",
    "Choix de dessin : la voiture du kit (compacte à hayon de 4,5 m, js/dessins-kit.js) de profil, côté conducteur, l'avant à "
      + "gauche ; l'œil du conducteur à 1,15 m du sol et 0,20 m devant le centre de la voiture (choix du kit). Chaque ligne de "
      + "visée part de l'œil et frôle le repère du kit cherché sur le contour dessiné : le rebord avant du capot (hautCapot) et le "
      + "pied de la lunette arrière (hautCoffre, la lunette laissant voir) ; pour cette voiture, elles touchent le sol 4,2 m devant "
      + "elle et 14,6 m derrière. Ces longueurs dépendent de la voiture et ne sont pas au cours : aucune n'est écrite dans le dessin.",
    "Choix de dessin, deux vues : la zone arrière de 14,6 m impose, pour tout montrer, 13,0 unités par mètre (les 23,4 m d'un "
      + "point au sol à l'autre dans 304 unités) : la voiture n'y fait que 58,5 unités (63 px sur un téléphone) et un obstacle de "
      + "45 cm 6 unités. D'où, en haut, le détail de l'avant à 34,8 unités par mètre (la voiture entière et la zone avant dans "
      + "304 unités), où l'obstacle se reconnaît (16 unités), et en bas la vue d'ensemble, où les deux zones se comparent.",
    "Choix de dessin, zones : la partie de l'espace sous la ligne de visée, entre la verticale de l'avant (ou de l'arrière) de la "
      + "voiture et le point où la ligne touche le sol : ce qui s'y trouve n'est pas vu depuis le siège. Fond clair et hachures à "
      + "45 degrés (bandes d'une unité, pas de 4,5 unités), aux teintes de correction du cours (faux) : les mêmes que les angles "
      + "morts du dessin angles-morts. Lignes de visée en tirets (4 et 3 unités) bordés d'un liseré clair, sol en trait moyen.",
    "Choix de dessin, obstacle : un cône de signalisation courant de 45 cm, rouge à bande blanche, base de 30 cm (socle de 36 cm, "
      + "gris foncé #2E3430), posé 0,3 m devant le pare-chocs : un objet bas que chacun reconnaît. Sa pointe reste 0,24 m (8,4 unités) "
      + "sous la ligne de visée. Le point de son étiquette est posé sur sa pointe : il en cache moins de 10 % et laisse 2 unités au "
      + "moins entre son liseré et celui de la ligne (tests), pour que l'écart entre la pointe et la ligne se voie.",
    "Choix de dessin, étiquettes : « Œil du conducteur » (le point de l'étiquette marque l'œil), « Obstacle caché », « Non visible » "
      + "sous la zone du détail ; « Devant le capot » et « Derrière le coffre », les mots du cours, sous les zones de la vue "
      + "d'ensemble.",
  ],
  retroviseurs: [
    "Cours C1.2, « S'installer », 5 : rétroviseurs : l'intérieur cadre toute la lunette arrière sans bouger la tête ; l'extérieur "
      + "gauche, l'horizon à mi-hauteur et un mince liseré de carrosserie au bord intérieur ; le droit, même principe, souvent un "
      + "peu plus bas pour voir le bord de la chaussée en manœuvre. « Risques » : rétroviseur extérieur tourné vers la "
      + "carrosserie : angle mort élargi. « Erreurs fréquentes » : tourner le rétroviseur extérieur vers la carrosserie.",
    "Thème 24, G (réglage des rétroviseurs) : intérieur, cadrer la lunette arrière en entier, sans bouger la tête ; extérieur "
      + "gauche, ligne d'horizon à mi-hauteur du miroir, un mince liseré de la carrosserie visible au bord intérieur, pas "
      + "davantage ; extérieur droit, même principe, souvent légèrement plus bas pour voir le bord de la chaussée lors des "
      + "manœuvres et du stationnement. Thème 24, F : orienté trop vers l'intérieur, le rétroviseur extérieur montre une large part "
      + "du flanc de la voiture, et l'espace non couvert s'élargit d'autant.",
    "Choix de dessin : quatre rangées dans l'ordre du cours (intérieur, gauche, droit, puis l'erreur que le cours nomme), chacune "
      + "une vignette du kit avec sa pastille, son titre et la phrase du cours ; le miroir à droite. Cadre de 320 sur 306 unités : "
      + "un miroir extérieur de 100 unités de large, où le liseré de 9 unités fait 9,6 px sur un téléphone.",
    MIROIR_PLAN,
    "Choix de dessin, image d'un miroir extérieur : ce que voit l'œil reflété, en projection plane perpendiculaire à l'axe de la "
      + "voiture ; la direction de l'arrière y fuit vers un point. La focale tient le champ du miroir dans la largeur de l'image "
      + "(604 unités à gauche, 1 105 à droite pour 100 de large). Un point à l'écart l (m) de l'œil reflété vers la caisse, à la "
      + "hauteur z et au recul D, se voit à f l / D du point de fuite et à f (h - z) / D sous l'horizon, h = 1,04 m étant la hauteur "
      + "du miroir (kit : de 0,97 à 1,105 m) et de son œil reflété. L'image est une bande de 56 unités de haut placée selon le "
      + "réglage de l'horizon : le verre du kit, haut de 13,5 cm, en montrerait 87 à gauche ; le dessin omet le haut du ciel et le "
      + "sol le plus proche.",
    "Choix de dessin, la rue des images : à double sens, voies de 3,5 m (celles des scènes), la voiture au milieu de la voie de "
      + "droite ; à sa gauche l'axiale T'1 de la rue des scènes (traits de 1,5 m, intervalles de 5 m, 0,10 m de large), la voie d'en "
      + "face et la bordure d'en face (à 4,32 m du miroir gauche), puis le trottoir ; à sa droite la bordure (à 0,82 m du miroir "
      + "droit) et le trottoir. Bordure de 0,15 m, teinte #B3AE9F ; trottoir et chaussée aux teintes des scènes ; ciel #E6EFF4. Au "
      + "bas de l'image gauche, le sol est à 22 m : les traits de l'axiale y sont à 23 et 29,5 m, le trottoir d'en face près de "
      + "l'horizon ; un trait plus court qu'une unité dans l'image n'est plus dessiné.",
    "Choix de dessin, la caisse dans l'image : le flanc de la voiture du kit, à sa demi-largeur (3 cm en dedans de l'œil reflété), "
      + "jusqu'à la ligne de ceinture (le bas des vitres du kit, de 0,985 m à l'avant à 1,05 m au pied du montant arrière, droite "
      + "prolongée comme le fait le kit) ; au-dessus, en retrait de 0,15 m (les vitres du kit vues du dessus, à 0,75 m de l'axe), "
      + "les vitres latérales et le montant arrière jusqu'à la lunette, tracés des contours du kit ; entre les deux, l'épaule. Dans "
      + "une image juste, la caisse va du bord intérieur au coin arrière, 9 % de la largeur, et du bas du miroir à l'épaule au "
      + "coin, un peu au-dessus de l'horizon (3 unités à gauche, 5 à droite : la ceinture y dépasse de 2 cm la hauteur du miroir) ; "
      + "les vitres, en retrait, restent hors du champ. Entre la caisse et le point de fuite, la route derrière la voiture.",
    "Choix de dessin, extérieur gauche juste : l'horizon à mi-hauteur et le liseré de 9 % (12 % au plus, test). Extérieur droit "
      + "juste : l'horizon au tiers haut (36 % de la hauteur) ; avec la focale du miroir droit, la vue reflétée baisse de "
      + "0,4 degré et le miroir de 0,2 degré (un miroir tourné d'un angle tourne l'image du double) ; on y voit la voie jusqu'à la "
      + "bordure, puis le trottoir.",
    "Choix de dessin, faux : le miroir gauche tourné vers la carrosserie, qui prend 46 % de la largeur (40 % au moins, test) ; la "
      + "direction de l'arrière fuit à 51 % de la largeur. Au-dessus de la caisse, la vitre latérale arrière et le montant arrière, "
      + "en retrait : le montant commence à 28 unités du point de fuite (le pied de la lunette), la vitre à 33 (le pied du montant) ; "
      + "le pied des vitres passe sous l'horizon près du bord intérieur et remonte vers l'arrière. Entre le montant et le point de "
      + "fuite, le ciel derrière la voiture.",
    "Choix de dessin, intérieur : miroir de 134 sur 37 unités (un miroir intérieur courant de 25 cm sur 7), boîtier et bras gris "
      + "foncé #2E3430, habitacle #262B28 ; la lunette le remplit presque (80 % de sa largeur en haut, 75 % en bas, 78 % de sa "
      + "hauteur), plus large en haut, son bord haut étant le plus près de l'œil ; l'horizon dans son quart haut, le miroir étant au "
      + "haut du pare-brise, au-dessus de l'œil (œil reflété à 1,3 m du sol), d'où le regard plonge un peu par la lunette inclinée. "
      + "Focale : le haut de la lunette couvre le champ du rétroviseur intérieur d'angles-morts (11,5 degrés de part et d'autre de "
      + "l'axe) ; ce champ est celui de la lunette, que le cours demande de cadrer en entier (le verre du miroir intérieur du kit, "
      + "26 cm, vu de l'œil, en couvrirait 21 degrés sur 23). Le miroir garde la gauche et la droite du conducteur : l'axiale et la "
      + "bordure d'en face à gauche, la bordure et le trottoir à droite. Repères de mi-hauteur de part et d'autre de chaque miroir "
      + "extérieur ; boîtiers gris foncé, pour que le liseré vert se distingue.",
  ],
  "angles-morts": [
    "Cours C1.2, « Sortir », 2 : contrôler : rétroviseur intérieur, rétroviseur extérieur du côté de la portière, puis angle mort "
      + "par-dessus l'épaule, qu'aucun rétroviseur ne montre ; « S'installer », 5 : le réglage des rétroviseurs.",
    "Thème 24, F : l'angle mort est la portion d'espace autour du véhicule qui n'est vue ni directement par le conducteur, ni dans "
      + "aucun de ses rétroviseurs ; le rétroviseur intérieur renvoie ce qui se trouve derrière le véhicule, dans l'axe ; chaque "
      + "rétroviseur extérieur renvoie un cône qui s'écarte vers l'arrière et sur le côté ; la vision périphérique couvre les côtés "
      + "du véhicule jusqu'à la hauteur des portières ; l'angle mort latéral est ce qui subsiste entre la limite de ce cône et le "
      + "début de la vision périphérique ; le contrôle direct, un coup d'œil par-dessus l'épaule du côté du déplacement, reste "
      + "obligatoire, notamment avant toute ouverture de portière. Thème 26 : champ visuel d'environ 180 degrés pour les deux yeux "
      + "à l'arrêt ; l'angle mort, notamment le long des flancs arrière ; champ visuel utile d'environ 100 degrés à 40 km/h. Thème "
      + "35 : à l'ouverture d'une portière, le rétroviseur seul laisse subsister un angle mort ; le contrôle se fait au rétroviseur "
      + "puis par un regard en arrière. Thème 03, C : ouvrir la portière avec la main opposée, ce qui tourne le buste et le regard "
      + "vers l'arrière.",
    "Conventions du regard des scènes (js/scene-regard.js, js/scene-moteur.js) : regard en degrés par rapport au cap, négatif à "
      + "gauche ; angle mort gauche à -120 degrés ; portée de 22 m (REGARD_PORTEE) ; teinte du regard, opacité 0,4 ; œil du "
      + "conducteur 0,2 m devant le centre et 0,4 m à gauche.",
    "Choix de dessin : vue du dessus, cap vers le haut, de la voiture garée le long du trottoir de droite, comme dans la scène "
      + "sortie-portiere : la rue des scènes avec stationnement (js/scene-decors.js : bande de 2,0 m, voiture à 0,3 m de la bordure, "
      + "voie de 3,5 m, axiale T'1 à traits de 1,5 m et intervalles de 5 m, 0,10 m de large) ; la voiture des scènes (4,5 sur 1,8 m, "
      + "teintes) avec ses rétroviseurs (kit). 40 unités par mètre : 4,8 m à gauche de l'axe (l'axiale et un peu de la voie d'en "
      + "face), 3,2 m à droite (le trottoir), de 0,3 m devant la voiture à 1,5 m derrière. Bandes claires de 38 et 36 unités au-dessus "
      + "et au-dessous de la chaussée pour les étiquettes, lisibles hors de la chaussée sombre.",
    MIROIR_PLAN,
    "Choix de dessin, champs : intérieur, de l'œil reflété par le miroir intérieur (devant lui, dans l'axe, à la distance de l'œil) "
      + "par les bords de la lunette dessinée, soit 11,5 degrés de part et d'autre de l'axe ; extérieurs, le miroir plan ci-dessus, "
      + "du verre vers l'arrière, entre le rayon rasant et le bord extérieur. Champs clairs à 0,42 d'opacité ; seuls leurs bords qui "
      + "s'écartent sont tracés : le bord extérieur de chaque champ extérieur, qui borne l'angle mort, et les deux bords du champ "
      + "intérieur. Juste derrière chaque coin arrière, entre le rayon rasant et le champ intérieur, un petit secteur, jusqu'à 0,75 m "
      + "derrière la voiture, n'est dans aucun champ ; il n'est pas hachuré : le dessin montre l'angle mort latéral que le cours "
      + "nomme.",
    "Choix de dessin, angles morts : chacun commence à hauteur du conducteur, sur le rayon issu de l'œil à 90 degrés du cap (la "
      + "vision périphérique en regardant devant : les deux yeux couvrent environ 180 degrés, thème 26), là où ce rayon sort du champ "
      + "du rétroviseur : à 0,21 m du flanc à gauche, 0,15 m à droite ; il longe le flanc arrière (0,56 m du flanc à l'arrière de la "
      + "voiture à gauche, 0,34 m à droite) et s'étend vers l'arrière jusqu'au bord extérieur du champ du rétroviseur, et jusqu'aux "
      + "bords du dessin. Fond clair à 0,85 d'opacité et hachures, comme les zones du dessin zones-invisibles.",
    "Choix de dessin, coup d'œil : l'axe du regard des scènes (-120 degrés), leur portée, leur teinte et leur opacité ; son "
      + "ouverture, 100 degrés (50 de part et d'autre de l'axe), est le champ visuel utile à faible allure (thème 26 : environ "
      + "100 degrés à 40 km/h) : la tête tournée vers l'épaule porte ce champ vers l'arrière gauche. Il couvre toute la zone gauche "
      + "dessinée, vue de l'œil de 90 à 162 degrés du cap. Le cône des scènes (16 degrés de part et d'autre) montre où se pose le "
      + "regard au fil d'une manœuvre ; ici, le dessin montre ce que le coup d'œil embrasse.",
    "Choix de dessin, deux-roues : le cycliste des scènes (js/scene-moteur.js, dessinerVelo, non exporté : 1,8 sur 0,6 m, roues de "
      + "0,7 m aux bouts arrondis, guidon arrondi, teintes de js/scene-rendu.js), recopié en description pure ; centré 1,85 m à gauche "
      + "de l'axe et 1,0 m derrière le centre de la voiture, il longe la portière arrière et l'aile arrière entre 0,65 et 1,25 m du "
      + "flanc : tout entier dans la zone gauche, à 0,1 m au moins de ses bords, hors du champ du rétroviseur gauche. C'est le "
      + "cycliste que le rétroviseur ne montre pas au moment d'ouvrir la portière. Étiquettes : « Angle mort » de chaque côté et "
      + "« Coup d'œil par-dessus l'épaule » en haut, les trois rétroviseurs en bas, chacune avec son point dans ce qu'elle nomme.",
  ],
};
