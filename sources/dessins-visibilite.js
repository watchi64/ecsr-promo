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
  + "distance de l'œil, 3 cm hors du flanc), la caisse du kit s'arrête au point de l'arrondi de son coin arrière (rayon de 0,4 m) "
  + "que frôle le rayon issu de lui, 1,85 m derrière le centre ; le miroir est tourné pour qu'elle prenne 9 % de la largeur de son "
  + "image (le mince liseré du cours). C'est une simplification : l'œil reflété est tenu devant le miroir quelle que soit son "
  + "orientation, comme pour un verre au ras du flanc ; tourner un miroir plan déplace pourtant son œil reflété (de 5,6 cm vers la "
  + "caisse à gauche, 4,7 cm à droite, pour ce réglage). Le verre du kit, dont les 5 cm intérieurs sont au-dessus de la portière, "
  + "en dedans du flanc, réellement tourné jusque-là, montrerait la caisse en coin, plus large vers le bas du miroir (calcul exact "
  + "sur le volume simple de la caisse : réglé pour 9 % à 1,7 degré sous l'horizon, de rien à l'horizon à 31 % au bas du verre) ; un "
  + "verre au ras du flanc donnerait un liseré droit (9 à 10 % du haut au bas du verre, même calcul). La direction de "
  + "l'arrière fuit à 13,9 % de la largeur depuis le bord intérieur à gauche, 16,6 % à "
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
    "Choix de dessin : la voiture de profil du kit (une citadine à hayon réelle, la Dacia Sandero III, à ses cotes : 4,09 m sur "
      + "1,50 m, js/dessins-kit.js), côté conducteur, l'avant à gauche ; l'œil du conducteur à 1,20 m du sol et 0,15 m derrière le "
      + "milieu de la voiture (choix du kit). Chaque ligne de visée part de l'œil et frôle le repère du kit cherché sur le contour "
      + "dessiné : le point du capot le plus haut vu de l'œil (hautCapot ; le capot de cette voiture monte jusqu'au pare-brise, la "
      + "ligne le frôle près de lui) et le pied de la lunette arrière (hautCoffre, la lunette laissant voir) ; pour cette voiture, "
      + "elles touchent le sol 6,8 m devant elle et 21,8 m derrière (relevé de la silhouette, dans l'axe de la voiture : la ligne "
      + "réelle, de l'œil décalé à gauche, passe un peu plus bas sur le capot). Ces longueurs dépendent de la voiture et ne sont pas "
      + "au cours : aucune n'est écrite dans le dessin.",
    "Choix de dessin, deux vues : la zone arrière de 21,8 m impose, pour tout montrer, 9,3 unités par mètre (les 32,7 m d'un "
      + "point au sol à l'autre dans 304 unités) : la voiture n'y fait que 38 unités (41 px sur un téléphone) et un obstacle de "
      + "50 cm 4,6 unités. D'où, en haut, le détail de l'avant à 28,0 unités par mètre (la voiture entière et la zone avant dans "
      + "304 unités), où l'obstacle se reconnaît (14 unités), et en bas la vue d'ensemble, où les deux zones se comparent. Cône de "
      + "50 cm, une hauteur courante de cône de signalisation, et non plus 45 : à 45 cm, il ne ferait que 12,6 px de haut sur un "
      + "téléphone (test : 14 au moins) ; le point de son étiquette est posé sur sa pointe, son centre 1,2 unité au-dessus, pour "
      + "n'en cacher qu'une part (test : moins de 10 %).",
    "Choix de dessin, zones : la partie de l'espace sous la ligne de visée, entre la verticale de l'avant (ou de l'arrière) de la "
      + "voiture et le point où la ligne touche le sol : ce qui s'y trouve n'est pas vu depuis le siège. Un aplat translucide de la "
      + "teinte de correction du cours (faux, #A05A3D, à 0,4 d'opacité), sans contour ni hachures : le même que les angles morts du "
      + "dessin angles-morts. Lignes de visée en tirets (4 et 3 unités) bordés d'un liseré clair, sol en trait moyen.",
    "Choix de dessin : style schématique, décision du formateur du 15/10/2026 (« pictogramme plutôt qu'illustration » : aplats, "
      + "aucune texture). La voiture est la silhouette de profil du kit (voitureProfil, option schema), aux mêmes tracés que la voiture "
      + "détaillée, si bien que les lignes de visée frôlent les mêmes repères : la caisse et son contour, les vitres latérales, les "
      + "roues en deux tons, leurs passages de la teinte du pneu (sans anneau clair autour des roues) ; ni phare, ni feu, ni "
      + "rétroviseur, ni poignées, ni joints. Les zones, hachurées "
      + "jusque-là, deviennent des aplats ; le cône garde ses trois tons (socle, cône, bande blanche).",
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
      + "manœuvres et du stationnement.",
    "Retour du formateur sur le dessin (22/10/2026), mot pour mot : « aller proprement au rétroviseur intérieur, puis au "
      + "rétroviseur extérieur, déjà dans un premier temps. Ensuite, il faut la ligne d'horizon au milieu. Il faut qu'on aperçoive "
      + "la poignée de la portière arrière dans le coin inférieur, du côté voiture : pour le rétroviseur gauche dans le coin "
      + "inférieur droit, pour le rétroviseur droit dans le coin inférieur gauche. Cela doit être très net dans l'exemple, ou ne pas "
      + "le mettre. » Son principe pour tous les dessins : pas d'illustration plutôt qu'une illustration peu représentative.",
    "Choix de dessin, mise en page : deux temps numérotés, dans l'ordre du formateur, chacun sur une carte avec son numéro (un "
      + "disque clair cerclé de foncé, comme les repères numérotés des étapes), son titre et une ligne de légende : 1, « Rétroviseur "
      + "intérieur », « toute la lunette arrière », le miroir à droite de la carte ; 2, « Rétroviseurs extérieurs », « l'horizon au "
      + "milieu », puis les deux miroirs côte à côte comme le conducteur les voit, le gauche à gauche, chacun sous son nom, et "
      + "dessous l'étiquette « Poignée de la portière arrière », dont les deux filets partent des deux poignées. Cadre de 320 sur "
      + "270 unités ; verres extérieurs de 122 sur 74 unités (131 sur 79 px sur un téléphone). L'ancienne rangée « faux » "
      + "(rétroviseur tourné vers la carrosserie) quitte le dessin, qui ne garde que ce que le formateur demande ; le cours dit "
      + "toujours cette erreur dans ses risques et ses erreurs fréquentes.",
    MIROIR_PLAN,
    "Choix de dessin, image d'un miroir extérieur : ce que voit l'œil reflété, en projection plane perpendiculaire à l'axe de la "
      + "voiture ; la direction de l'arrière y fuit vers un point de l'horizon, au réglage du miroir plan ci-dessus (13,9 % de la "
      + "largeur depuis le bord intérieur à gauche, 16,6 % à droite), le même que dans le dessin angles-morts. La focale tient le "
      + "champ du miroir dans la largeur de l'image (737 unités à gauche, 1 348 à droite, pour 122 de large). Un point du sol à "
      + "l'écart l (m) de l'œil reflété, au recul D, se voit à f l / D du point de fuite et à f h / D sous l'horizon, h = 1,04 m "
      + "étant la hauteur du miroir (kit : de 0,97 à 1,105 m) et de son œil reflété. Les deux miroirs ont l'horizon au milieu de leur "
      + "hauteur, comme le demande le formateur : le droit « un peu plus bas » du cours n'est pas dessiné. L'image est une bande de "
      + "74 unités de haut centrée sur l'horizon : le verre du kit, haut de 13,5 cm, en montrerait 107 à gauche ; le dessin omet le "
      + "haut du ciel et le sol le plus proche (au bas de l'image, le sol est à 20,7 m à gauche, 37,9 m à droite).",
    "Choix de dessin, la ligne d'horizon : un trait fin gris (#6E7A6F) en travers du verre, à mi-hauteur, dans l'alignement de deux "
      + "repères de mi-hauteur posés hors du boîtier, de chaque côté ; c'est la « ligne d'horizon » du formateur. Sans lui, la limite "
      + "du ciel (#E6EFF4) et du trottoir (#DAD6CA), deux teintes claires, se voyait mal sur un téléphone.",
    "Choix de dessin, la rue des images, celle des scènes avec stationnement (js/scene-decors.js) : à double sens, voies de 3,5 m, "
      + "une bande de stationnement de 2 m le long de chaque trottoir, axiale T'1 (traits de 1,5 m, intervalles de 5 m, 0,10 m de "
      + "large), la voiture au milieu de la voie de droite. Dans le miroir gauche, l'axiale à 0,82 m et la bordure d'en face à "
      + "6,32 m ; dans le droit, la bordure de droite à 2,82 m ; dans l'intérieur, l'axiale à 1,75 m à gauche, la bordure à 3,75 m "
      + "à droite et celle d'en face à 7,25 m à gauche. Bordure de 0,15 m, teinte #B3AE9F ; trottoir et chaussée aux teintes des "
      + "scènes ; ciel #E6EFF4. Les bandes de stationnement, vides, laissent la route occuper le bas des miroirs (sans elles, le "
      + "trottoir prenait la plus grande part du miroir droit). Au bas de l'image gauche, les traits de l'axiale commencent à 23 m ; "
      + "un trait plus court qu'une unité dans l'image n'est plus dessiné.",
    "Choix de dessin, la caisse dans un miroir extérieur : un schéma, sous l'horizon, au bord intérieur du verre ; à l'horizon, elle "
      + "prend 9 % de la largeur (le mince liseré du cours, celui du réglage du miroir plan), puis s'élargit vite et descend presque "
      + "droite jusqu'à 32 % au bas du verre (écart au bord intérieur : 9 % + 23 % (1 - (1 - t)²), t allant de 0 à l'horizon à 1 au "
      + "bas) ; le vert de la voiture de l'élève, son bord tracé de la teinte du bord de la voiture (#3E4A2D). Pourquoi un coin plus "
      + "large en bas : le calcul exact sur le volume simple de la caisse et le verre du kit (voir le rétroviseur extérieur) la "
      + "montre en coin, de rien à l'horizon à 31 % au bas du verre ; les flancs réels, plus larges en bas qu'à la ligne de "
      + "ceinture, font de même. Pourquoi un bord arrondi plutôt que droit : un bord droit, qui file vers le haut du miroir comme "
      + "une ligne de la route, se lisait comme un bas-côté. La caisse prend 24 % du bas du miroir (un tiers au plus, test) : le "
      + "reste montre la route derrière.",
    "Choix de dessin, la poignée de la portière arrière : le modèle du miroir plan (l'œil reflété 3 cm hors du flanc) place la "
      + "poignée arrière de la voiture du kit (de 1,17 à 1,37 m derrière le centre, de 0,925 à 0,965 m du sol, 10 cm sous la ligne de "
      + "ceinture) à 8 % de la largeur depuis le bord intérieur et à 80 % de la hauteur dans le miroir gauche (8 % et 96 % dans le "
      + "droit) : le coin inférieur côté voiture que décrit le formateur. Mais vue presque par la tranche, elle n'y ferait que 0,4 "
      + "unité de large sur 9 de haut (0,6 sur 14 à droite) : un trait. Le dessin pose au même coin un pictogramme de 20 sur 7 "
      + "unités (21 sur 7,5 px sur un téléphone), son centre à 14 % de la largeur depuis le bord intérieur et à 82 % de la hauteur, "
      + "pour qu'il tienne entier sur la caisse (1,5 unité au moins de ses bords), à 7 unités du bord intérieur et à 10 du bas du "
      + "verre : un creux sombre aux bouts ronds (#1F2924, le texte de la charte, à 3,4:1 sur la caisse) et, au milieu, son levier "
      + "clair de 14 sur 2,6 (#9DAE84, à 6,3:1 sur le creux), l'allure d'une poignée de portière. Le point de l'étiquette est 4 "
      + "unités sous la poignée, sans la toucher.",
    "Choix de dessin, intérieur : verre de 134 sur 37,5 unités (un miroir intérieur courant de 25 cm sur 7), aux bouts arrondis "
      + "(rayon de 45 % de sa hauteur), boîtier et bras gris foncé #2E3430, habitacle #262B28 ; verre, lunette et horizon sont la "
      + "pièce du kit (miroirInterieur), la même que dans la vignette d'« installation » : la lunette remplit presque le verre (80 % "
      + "de sa largeur en haut, 75 % en bas, 78 % de sa hauteur, coins arrondis de 4/37 de la hauteur du verre, 4,06 unités ici), "
      + "plus large en haut, son bord haut étant le plus près de l'œil ; l'horizon dans son quart haut, le miroir étant au "
      + "haut du pare-brise, au-dessus de l'œil (œil reflété à 1,3 m du sol), d'où le regard plonge un peu par la lunette inclinée. "
      + "Le miroir intérieur du kit vu du dessus (26 cm, à 0,66 m de l'œil) ne couvrirait que 21,5 degrés pour les 23 de la "
      + "lunette : le dessin suit le cours (toute la lunette cadrée), comme un miroir plus large que celui du kit, d'environ 29 "
      + "degrés. Focale : le haut de la lunette couvre le champ du rétroviseur intérieur d'angles-morts (11,5 degrés de part et d'autre de "
      + "l'axe) ; ce champ est celui de la lunette, que le cours demande de cadrer en entier (le verre du miroir intérieur du kit, "
      + "26 cm, vu de l'œil, en couvrirait 21 degrés sur 23). Le miroir garde la gauche et la droite du conducteur : l'axiale et la "
      + "bordure d'en face à gauche, la bordure et le trottoir à droite. Boîtiers des trois miroirs gris foncé, pour que la caisse "
      + "verte et la route se distinguent du cadre.",
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
      + "derrière la voiture, n'est dans aucun champ ; il n'est pas teinté : le dessin montre l'angle mort latéral que le cours "
      + "nomme.",
    "Choix de dessin, angles morts : chacun commence à hauteur du conducteur, sur le rayon issu de l'œil à 90 degrés du cap (la "
      + "vision périphérique en regardant devant : les deux yeux couvrent environ 180 degrés, thème 26), là où ce rayon sort du champ "
      + "du rétroviseur : à 0,21 m du flanc à gauche, 0,15 m à droite ; il longe le flanc arrière (0,56 m du flanc à l'arrière de la "
      + "voiture à gauche, 0,34 m à droite) et s'étend vers l'arrière jusqu'au bord extérieur du champ du rétroviseur, et jusqu'aux "
      + "bords du dessin. Un aplat translucide de la teinte « faux » (0,4 d'opacité), comme les zones du dessin zones-invisibles : "
      + "il laisse voir la rue dessous.",
    "Choix de dessin, coup d'œil : l'axe du regard des scènes (-120 degrés), leur portée, leur teinte et leur opacité ; son "
      + "ouverture, 100 degrés (50 de part et d'autre de l'axe), est le champ visuel utile à faible allure (thème 26 : environ "
      + "100 degrés à 40 km/h) : la tête tournée vers l'épaule porte ce champ vers l'arrière gauche. Il couvre toute la zone gauche "
      + "dessinée, vue de l'œil de 90 à 162 degrés du cap. Le cône des scènes (16 degrés de part et d'autre) montre où se pose le "
      + "regard au fil d'une manœuvre ; ici, le dessin montre ce que le coup d'œil embrasse. Le cône, translucide, passe par-dessus la "
      + "zone gauche : elle prend la teinte du regard, la zone droite, que le coup d'œil ne couvre pas, garde la sienne. Le voile de la "
      + "version hachurée (il éclaircissait les hachures sous le cône) n'a plus lieu d'être avec des aplats.",
    "Choix de dessin, deux-roues : le cycliste de la scène « sortie-portiere », la même pièce (js/piece-cycliste.js : 1,8 sur "
      + "0,6 m, roues de 0,7 m aux bouts arrondis, guidon arrondi, teintes des scènes), posée cap vers le haut ; centré 1,85 m à gauche "
      + "de l'axe et 1,0 m derrière le centre de la voiture, il longe la portière arrière et l'aile arrière entre 0,65 et 1,25 m du "
      + "flanc : tout entier dans la zone gauche, à 0,1 m au moins de ses bords, hors du champ du rétroviseur gauche. C'est le "
      + "cycliste que le rétroviseur ne montre pas au moment d'ouvrir la portière. Étiquettes : « Angle mort » de chaque côté et "
      + "« Coup d'œil par-dessus l'épaule » en haut, les trois rétroviseurs en bas, chacune avec son point dans ce qu'elle nomme. Le "
      + "point du coup d'œil est sur l'axe du regard, à 2,6 m derrière l'œil (vers l'arrière gauche, à -120 degrés du cap), entre le "
      + "deux-roues et le point de l'étiquette « Angle mort » : il dit un regard tourné vers l'arrière, par-dessus l'épaule.",
    "Choix de dessin : style schématique, décision du formateur du 15/10/2026 (« pictogramme plutôt qu'illustration »). La voiture est "
      + "la silhouette du kit vue du dessus (voitureDessus, option schema), avec ses rétroviseurs, d'où partent les champs : la caisse "
      + "et son contour, le pare-brise, la lunette, les rétroviseurs ; ni toit, ni vitres latérales, ni phares, ni feux, ni "
      + "essuie-glaces ; mêmes tracés que la voiture détaillée, donc mêmes champs. Les angles morts sont des aplats. Le cycliste est "
      + "un pictogramme (js/piece-cycliste.js, la pièce de la scène « sortie-portiere ») : le cycliste d'une seule teinte, sa veste "
      + "orange clair (dos, bras et tête ronde, le dos et la tête bordés de foncé), le vélo d'une seule teinte foncée (pneus, cadre et "
      + "guidon), sans visage ni détail : trois teintes en tout.",
  ],
};
