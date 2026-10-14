/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Sources des dessins de la famille « voyants » (js/dessins-voyants.js) : la phrase du cours illustrée, les sources, les
 * références des pictogrammes et les choix de dessin. Lues par les tests et les relecteurs, jamais servies aux stagiaires.
 */

// Références des formes, consultées le 14/10/2026 ; aucun fichier d'image repris : chaque forme est redessinée par le code.
const REFERENCES_PICTOGRAMMES = "Formes des pictogrammes : ISO 2575 (symboles des commandes, indicateurs et témoins des "
  + "véhicules routiers), reprise par le Règlement ONU n° 121 (tableau 1, note 2 : symboles « substantiellement identiques » "
  + "à ceux d'ISO 2575, proportions conservées ; note 1 : les zones encadrées peuvent être pleines ; note 13 : quatre ou cinq "
  + "traits pour les faisceaux des feux ; paragraphe 5.4.4 : la partie sombre d'un symbole peut être remplacée par son "
  + "contour). Dessins de référence des symboles ISO 7000 sur Wikimedia Commons (domaine public), un par voyant : "
  + "0248 huile moteur, 0246 température du liquide de refroidissement, 0239 défaillance du système de freinage, 0247 état de "
  + "charge de la batterie, 2108 airbag, 1407 défaillance de l'ABS, 1434A défaillance des pneumatiques, 0457 préchauffage "
  + "(aide au démarrage), 0245 carburant, 0084 indicateurs de direction, 0083 feux de croisement, 0082 feux de route "
  + "(https://commons.wikimedia.org/wiki/Category:ISO_7000_symbols, fichiers « ISO 7000 - Ref-No … .svg »).";

const REFERENCES_COULEURS = "Couleurs : Règlement ONU n° 121, tableau 1, colonne 5 (indicateurs de direction et feux de "
  + "croisement : vert ; feux de route : bleu ; carburant, ABS, préchauffage, basse pression des pneus : jaune ; pression "
  + "d'huile, température du liquide de refroidissement, charge : rouge ; airbag : jaune ou rouge, rouge dans le cours ; "
  + "freinage : Règlement n° 13-H, rouge) ; TCS (Touring Club Suisse), « Vue d'ensemble des témoins au cockpit », "
  + "22/07/2016 : airbag rouge, dispositif de freinage rouge, préchauffage jaune, réservoir de carburant jaune.";

export const SOURCES = {
  voyants: [
    "Cours C1.1, « Les voyants » : tableau Couleur, Exemples, Conduite à tenir. Rouge (pression d'huile, température moteur, "
      + "freinage, charge de la batterie, airbag) : s'arrêter dès que possible en sécurité, couper le moteur. Orange (ABS, "
      + "antiblocage des roues ; pression des pneus ; préchauffage ; réserve de carburant) : poursuivre prudemment, faire "
      + "contrôler sans attendre. Vert ou bleu (clignotants, feux de croisement, feux de route en bleu) : aucune action.",
    "Thème 25, D (les témoins du tableau de bord : couleur, conduite à tenir) et C (témoin de frein) ; thème 48, F (voyants : "
      + "pression d'huile et température sans délai, préchauffage parmi les orange) ; fiche ECF C1-A (voyants du tableau de "
      + "bord : huile, température, frein, pression des pneumatiques, feux, clignotants, ABS, airbag, batterie, préchauffage).",
    REFERENCES_PICTOGRAMMES,
    REFERENCES_COULEURS,
    "Choix de dessin : chaque pictogramme se dessine dans le carré de base de son symbole ISO 7000, de 27 unités de côté "
      + "(28,9 px sur un téléphone), sur une tuile sombre de 32 unités comme au tableau de bord ; proportions relevées sur les "
      + "dessins de référence ; traits de 1,5 unité, un peu plus appuyés que ceux des dessins ISO 7000 (0,04 du carré) pour "
      + "rester nets à cette taille, et 1 unité pour les traits fins (cercle intérieur du freinage et de l'ABS, lettres ABS, "
      + "ceinture de l'airbag) ; flèches des indicateurs de direction et silhouette de l'airbag pleines (zones encadrées "
      + "pleines, permises par la note 1) ; quatre faisceaux aux feux (quatre ou cinq permis, note 13), plus lisibles que cinq "
      + "à cette taille.",
    "Choix de dessin : teintes d'écran des quatre couleurs (rouge #FF453A, orange ou jaune ambre #FFAA00, vert #30D158, bleu "
      + "#3D8BFF), franches et lisibles allumées sur la tuile (contraste de 3:1 au moins, testé) ; la norme fixe des couleurs "
      + "de lumière, qu'un écran ne reproduit qu'à peu près. Chaque voyant est nommé sous sa tuile avec les mots du tableau "
      + "du cours, et les feux de route sont dits bleus, comme dans le cours : la couleur ne porte jamais seule l'information.",
    "Choix de dessin : trois groupes dans l'ordre du tableau du cours (rouge, orange, vert ou bleu), chacun avec sa couleur "
      + "nommée et sa conduite à tenir mot pour mot ; cinq voyants rouges en deux rangées (trois, puis deux) : sur une seule, "
      + "« Température » (72 unités) ne tiendrait pas dans le pas d'une tuile ; cadre de 320 sur 380 unités au lieu de 330 : "
      + "les douze noms du cours en 11 px sous leur tuile et les trois conduites à tenir en entier ne tiennent pas dans 330 "
      + "sans serrer les noms les uns contre les autres.",
  ],
  autotest: [
    "Cours C1.1, « Les voyants » : « À la mise du contact, les voyants s'allument puis s'éteignent : c'est l'autotest. Un "
      + "voyant qui ne s'allume pas est aussi anormal qu'un voyant resté allumé. » Thème 25, D : à la mise du contact, les "
      + "témoins s'allument brièvement puis s'éteignent.",
    "Huile et charge allumés jusqu'au démarrage du moteur (phrase que le rédacteur ajoute au cours avec cette source) : "
      + "Kia, manuel du propriétaire du Stonic 2026 (édition française), « Voyants d'avertissement » : témoin de pression "
      + "d'huile moteur et témoin du système de charge, « Une fois le contact d'allumage […] en position ON. Il reste allumé "
      + "jusqu'au démarrage du moteur. » ; « Après le démarrage du moteur, vérifier que tous les voyants d'avertissement sont "
      + "éteints. » (https://ownersmanual.kia.com/full_webhelp/YBC/2026/fr_FR/topics/chapter4_15_1.html, lu le 14/10/2026). "
      + "Le même manuel : airbag allumé environ 6 s, ABS et pression des pneus environ 3 s, puis éteints. TCS, « Vue "
      + "d'ensemble des témoins au cockpit » (22/07/2016) : les témoins importants s'allument brièvement au contact, « avec "
      + "des exceptions, comme le témoin de la pression d'huile et celui de charge de la batterie qui ne doivent s'éteindre "
      + "que lorsque le moteur démarre ». Le comportement varie selon les modèles : la notice de la Renault Clio (2026) dit "
      + "du témoin de pression d'huile qu'il s'allume à la mise sous contact ou au démarrage puis s'éteint après quelques "
      + "secondes ; le cours le dira donc pour « la plupart des voitures » (spec, § 2).",
    "Voyants montrés : airbag, ABS, pression des pneus, température moteur, pression d'huile, charge de la batterie. Le "
      + "freinage, la réserve et le préchauffage n'y sont pas : leur état dépend du frein de stationnement (Kia, même page : "
      + "le témoin reste allumé si le frein de stationnement est serré ; thème 25, C), du plein (même page : le témoin de "
      + "niveau bas ne s'allume que réservoir presque vide) ou du moteur diesel (fiche ECF C1-A : attendre l'extinction du "
      + "préchauffage avant de démarrer). Compte-tours et régime : thème 48, A (« régime moteur […] lu au compte-tours ») ; "
      + "C1.4 (800 tr/min, régime du moteur au ralenti, sans accélérer).",
    REFERENCES_PICTOGRAMMES,
    REFERENCES_COULEURS,
    "Choix de dessin : déroulé en trois étapes (0 ; 2,4 ; 4,4 s ; fin à 7 s), le changement de chaque étape 0,4 s après son "
      + "début, le temps de lire l'étape. Étape 1 : combiné éteint, contact coupé (les deux pastilles creuses) ; à 0,4 s, la "
      + "mise du contact allume ensemble les six voyants et la pastille « Contact ». Étape 2 : à 2,8 s, les quatre voyants de "
      + "l'autotest s'éteignent ensemble (la durée réelle varie selon les systèmes et les modèles, de 3 à 6 s environ). Étape "
      + "3 : à 4,8 s, la pastille « Moteur » s'allume (« Contact » reste allumé : le contact reste mis moteur tournant) et "
      + "l'aiguille monte au ralenti en 1,0 s ; huile et charge s'éteignent quand elle l'atteint (de 5,68 à 5,8 s), jamais "
      + "pendant que le compte-tours lit à peu près zéro (« Il reste allumé jusqu'au démarrage du moteur »).",
    "Choix de dessin : les six voyants s'allument en 0,2 s et la pastille « Contact » avec eux, la pastille « Moteur » en 0,2 "
      + "s, un voyant s'éteint en 0,12 s (courbe sortieDouce, arrivée amortie, sans rebond) : une lampe de tableau de bord "
      + "change d'état presque instantanément, et ces durées laissent seulement l'œil voir le changement ; d'une image à la "
      + "suivante (1/60 s), la luminosité varie donc de 0,23 au plus à l'allumage et de 0,36 à l'extinction, et une pastille "
      + "de 0,23, plus vite que la règle générale de continuité (15 % de la plage par image), d'où les sautsMax déclarés (0,4 "
      + "pour un voyant, 0,3 pour une pastille). L'aiguille monte en 1,0 s (adoucir), sans dépasser le ralenti.",
    "Choix de dessin : une image figée (pas à pas, pause, fin, animations réduites) est l'image de l'animation à cet instant ; "
      + "seules s'y ajoutent les marques de l'étape, rangées dans le groupe de sa flèche : étape 1, la flèche de la pastille "
      + "« Contact » vers le combiné, qui va s'allumer ; étape 2, un anneau autour de chacun des quatre voyants qui vont "
      + "s'éteindre ; étape 3, un anneau autour de huile et de charge et la flèche de la montée de l'aiguille, juste hors du "
      + "cadran, de 0 au ralenti.",
    "Choix de dessin : cadran du compte-tours gradué de 0 à 7 000 tr/min sur 240 degrés (de 8 h à 4 h), un grand trait "
      + "tous les 1 000 tr/min, un petit à mi-chemin, ordre de grandeur d'un moteur à essence ; sans chiffres (au repos, "
      + "l'aiguille couvrirait le zéro), nommé « Compte-tours » dessous ; voyants éteints à peine visibles (un symbole qu'on "
      + "devine sous la vitre du combiné) ; noms courts sous les voyants (Airbag, ABS, Pneus, Température, Huile, Charge), ceux "
      + "des étapes du cours (« sauf huile et charge ») ; repère en deux pastilles au mot toujours sombre, l'état porté par un "
      + "témoin rond plein ou creux et par le fond de la pastille, lisibles à chaque image du passage de l'un à l'autre.",
  ],
};
