/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Sources des dessins de la famille « visibilité » (js/dessins-visibilite.js) : la phrase du cours illustrée, les sources et
 * les choix de dessin. Lues par les tests et les relecteurs, jamais servies aux stagiaires.
 */

export const SOURCES = {
  "zones-invisibles": [
    "Cours C1.2, « Entrer » : avant de monter, faire le tour du véhicule, vérifications (C1.1) et obstacles, l'avant du capot et "
      + "l'arrière du coffre n'étant pas visibles depuis le siège.",
    "Thème 24, F (« Les angles morts qui ne sont pas latéraux ») : il existe aussi un angle mort devant le capot et derrière le "
      + "coffre, d'où le contour du véhicule avant toute marche arrière ; § 3, comportement attendu : faire le tour du véhicule "
      + "avant de reculer, et considérer que l'avant du capot et l'arrière du coffre ne sont pas vus. Fiche ECF C1-A (méthode) : "
      + "sortir et faire le tour du véhicule.",
    "Choix de dessin : la voiture du kit (compacte à hayon de 4,5 m, js/dessins-kit.js) de profil, côté conducteur, l'avant à "
      + "gauche ; l'œil du conducteur à 1,15 m du sol et 0,20 m devant le centre de la voiture (choix du kit). Chaque ligne de "
      + "visée part de l'œil et frôle le repère du kit cherché sur le contour dessiné : le rebord avant du capot (hautCapot) et le "
      + "pied de la lunette arrière (hautCoffre, la lunette laissant voir) ; pour cette voiture, elles touchent le sol 4,2 m devant "
      + "elle et 14,6 m derrière. Ces longueurs dépendent de la voiture et ne sont pas au cours : aucune n'est écrite dans le dessin.",
    "Choix de dessin, deux vues : la zone arrière de 14,6 m impose, pour tout montrer, 13,0 unités par mètre (les 23,4 m d'un "
      + "point au sol à l'autre dans 304 unités) : la voiture n'y fait que 58 unités (62 px sur un téléphone) et un obstacle de "
      + "50 cm 6 unités. D'où, en haut, le détail de l'avant à 34,8 unités par mètre (la voiture entière et la zone avant dans "
      + "304 unités), où l'obstacle se reconnaît (17 unités), et en bas la vue d'ensemble, où les deux zones se comparent.",
    "Choix de dessin, zones : la partie de l'espace sous la ligne de visée, entre la verticale de l'avant (ou de l'arrière) de la "
      + "voiture et le point où la ligne touche le sol : ce qui s'y trouve n'est pas vu depuis le siège. Fond clair et hachures à "
      + "45 degrés (bandes d'une unité, pas de 4,5 unités), aux teintes de correction du cours (faux) : les mêmes que les angles "
      + "morts du dessin angles-morts. Lignes de visée en tirets (4 et 3 unités) bordés d'un liseré clair, sol en trait moyen.",
    "Choix de dessin, obstacle : un cône de signalisation courant de 50 cm, rouge à bande blanche, base de 30 cm, posé 0,6 m devant "
      + "le pare-chocs : un objet bas que chacun reconnaît. Sa pointe reste 0,13 m (4,6 unités) sous la ligne de visée. Le point de "
      + "son étiquette est posé sur sa pointe et en cache moins de 10 % (test).",
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
      + "une vignette du kit avec sa pastille, son titre et la phrase du cours ; le miroir à droite. Cadre de 320 sur 306 unités "
      + "(260 au plan) : un miroir extérieur de 100 unités de large, où le liseré de 9 unités fait 9,6 px sur un téléphone.",
    "Choix de dessin, image d'un miroir : la route vue de l'œil virtuel du miroir, en projection plane ; l'axe de la voiture vers "
      + "l'arrière en est le point de fuite, au bord de la carrosserie. Une droite du sol parallèle à la voiture, à l'écart l du "
      + "miroir, en part avec la pente h / l : h = 1,04 m, hauteur du miroir extérieur (kit : de 0,97 à 1,105 m) ; l = 0,82 m, "
      + "du miroir au bord de sa voie (voie de 3,5 m des scènes, voiture au milieu, miroir à 0,93 m de l'axe, kit). Champ "
      + "horizontal d'un miroir extérieur : 36 degrés, celui du dessin angles-morts (miroir convexe ou asphérique).",
    "Choix de dessin, extérieur gauche juste : l'horizon à mi-hauteur (cours), la carrosserie sur 9 % de la largeur (un mince "
      + "liseré ; 12 % au plus, test), sous l'horizon seulement : la ceinture de caisse est à la hauteur du miroir et les vitres, "
      + "en retrait du flanc, sortent du champ. La ligne axiale de la rue des scènes (T'1 : traits de 1,5 m, intervalles de "
      + "5 m, 0,10 m de large), premier trait à 6 m, fuit vers le point de fuite.",
    "Choix de dessin, extérieur droit juste : l'horizon au tiers haut (36 % de la hauteur), soit le miroir baissé de 3 degrés "
      + "environ : un peu plus bas ; on y voit la voie jusqu'à la bordure du trottoir (0,15 m de large, plus foncée) et le "
      + "trottoir. Faux : le miroir tourné vers la carrosserie, qui prend 46 % de la largeur (40 % au moins, test) : le flanc sous "
      + "l'horizon, la vitre latérale (teinte des vitres du kit, bordée) au-dessus.",
    "Choix de dessin, intérieur : miroir de 134 sur 37 unités (un miroir intérieur courant de 25 cm sur 7) ; la lunette le "
      + "remplit presque (80 % de sa largeur en haut, 75 % en bas, 78 % de sa hauteur), plus large en haut, son bord haut étant "
      + "le plus près de l'œil ; l'horizon dans son quart haut, le miroir étant au haut du pare-brise, au-dessus de l'œil, d'où "
      + "le regard plonge un peu par la lunette inclinée ; les bords de la voie (1,75 m de part et d'autre) fuient vers le "
      + "centre. Boîtiers gris foncé, pour que le liseré vert se distingue ; repères de mi-hauteur de part et d'autre de chaque "
      + "miroir extérieur. Ciel #E6EFF4 ; chaussée, trottoir, carrosserie et vitre aux teintes des scènes.",
  ],
  "angles-morts": [
    "Cours C1.2, « Sortir », 2 : contrôler : rétroviseur intérieur, rétroviseur extérieur du côté de la portière, puis angle mort "
      + "par-dessus l'épaule, qu'aucun rétroviseur ne montre ; « S'installer », 5 : le réglage des rétroviseurs.",
    "Thème 24, F : l'angle mort est la portion d'espace autour du véhicule qui n'est vue ni directement par le conducteur, ni dans "
      + "aucun de ses rétroviseurs ; le rétroviseur intérieur renvoie ce qui se trouve derrière le véhicule, dans l'axe ; chaque "
      + "rétroviseur extérieur renvoie un cône qui s'écarte vers l'arrière et sur le côté ; l'angle mort latéral est ce qui "
      + "subsiste entre la limite de ce cône et le début de la vision périphérique ; le contrôle direct, un coup d'œil par-dessus "
      + "l'épaule du côté du déplacement, reste obligatoire, notamment avant toute ouverture de portière. Thème 03, C : ouvrir la "
      + "portière en contrôlant vers l'arrière. Thème 35 : un deux-roues tient tout entier dans l'angle mort latéral.",
    "Conventions du regard des scènes (js/scene-regard.js) : regard en degrés par rapport au cap, négatif à gauche ; angle mort "
      + "gauche à -120 degrés ; cône de 22 m de portée et de 16 degrés de demi-ouverture (REGARD_PORTEE, REGARD_OUVERTURE), "
      + "teinte du regard et opacité 0,4 des scènes ; œil du conducteur 0,2 m devant le centre et 0,4 m à gauche.",
    "Choix de dessin : vue du dessus, cap vers le haut ; la voiture des scènes (4,5 sur 1,8 m, teintes) avec ses rétroviseurs "
      + "(kit) ; 34,8 unités par mètre (le cadre couvre 4,6 m de part et d'autre de l'axe) ; une bande claire de 38 unités au-dessus "
      + "de la chaussée porte les étiquettes, lisibles hors de la chaussée sombre ; la chaussée a les coins du bas du cadre. Trois "
      + "voies de 3,5 m (celle des scènes), la voiture au milieu de la sienne ; lignes de délimitation T1 (traits de 3 m) à 1,75 m "
      + "de part et d'autre, un trait de 0,5 à 3,5 m derrière le centre de la voiture.",
    "Choix de dessin, champs : intérieur, de l'œil reflété par le miroir intérieur (devant lui, à la distance de l'œil) par les "
      + "bords de la lunette dessinée, soit 11,5 degrés de part et d'autre de l'axe ; extérieurs, de chaque miroir, le bord intérieur "
      + "le long du flanc (le mince liseré du cours), le bord extérieur à 36 degrés : un miroir convexe ou asphérique, que le "
      + "règlement ONU n° 46 admet côté conducteur et que le thème 24 donne fréquent à droite ; un miroir plan (12 à 20 degrés) "
      + "laisserait un angle mort plus long vers l'arrière. Champs clairs à 0,42 d'opacité, bordés d'un trait fin.",
    "Choix de dessin, angles morts : chacun commence au rayon issu de l'œil à 105 degrés du cap, au-delà duquel le conducteur ne "
      + "voit plus sans tourner la tête (le champ visuel d'un œil qui regarde devant s'étend de 100 à 110 degrés de son axe vers "
      + "l'extérieur ; le thème 26 donne environ 180 degrés pour les deux yeux) : ce rayon passe à la hauteur des portières "
      + "(thème 24) ; il finit au bord extérieur du champ du miroir, et au bord du cadre. À ce bord (4,6 m de l'axe), le bord du "
      + "champ est à 135,6 degrés du cap, dans le cône du coup d'œil (136) : le regard couvre toute la zone dessinée. Fond clair à "
      + "0,85 d'opacité et hachures, comme les zones du dessin zones-invisibles.",
    "Choix de dessin, deux-roues : le cycliste des scènes (js/scene-moteur.js, dessinerVelo : 1,8 sur 0,6 m, roues de 0,7 m, "
      + "teintes de js/scene-rendu.js), recopié en description pure, centré 4,1 m à gauche de l'axe et 1,97 m derrière le centre de "
      + "la voiture : tout entier dans la zone gauche, à 0,12 m au moins de ses bords. Étiquettes : « Angle mort » de chaque côté, "
      + "« Coup d'œil par-dessus l'épaule », leur point dans ce qu'elles nomment ; noms des champs dans les champs.",
  ],
};
