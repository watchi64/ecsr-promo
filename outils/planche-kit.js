/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Pièces du kit montrées par la planche de revue (outils/planche-dessins.html), section « Kit » : de quoi juger la charte et
 * les pièces communes (js/dessins-kit.js) à 343 px avant que la moindre famille de dessins existe. Une pièce est un exemple
 * pour le relecteur, pas un dessin de cours : rien ici n'est servi aux stagiaires.
 *
 * Une pièce : code (« kit-… »), titre, cadre [largeur, hauteur] et construire({ kit, svg }), qui rend le nœud du dessin avec
 * les modules qu'on lui passe (kit : js/dessins-kit.js ; svg : js/dessin-svg.js). Ce fichier n'importe rien : la planche
 * (navigateur, jeton de cache de l'app) et tests/planche-kit.test.mjs (Node, contrôles communs) le chargent chacun à leur façon.
 *
 * Les voitures du kit (tâche 5) y ont chacune leur pièce, vue du dessus et profil, dans leurs états ; le test les contrôle toutes.
 *
 * Choix de dessin : positions et dimensions sont des constantes nommées, en unités du cadre (320 de large, rendu à 343 px).
 */

const LARGEUR = 320;
// Hauteur du cadre de chaque pièce : écrite une seule fois, lue par la fonction qui la dessine et par PIECES_KIT qui l'annonce.
const HAUTEUR_PAIRE = 200, HAUTEUR_ETIQUETTES = 190;

// Paire juste et faux : deux cartes côte à côte, séparées d'une marge, chacune avec un objet d'essai (un disque et son moyeu).
function paire({ kit, svg }) {
  const { CHARTE, cadre, vignette, etiquette, fleche } = kit, { n } = svg;
  const HAUTEUR = HAUTEUR_PAIRE, MARGE = 8, GOUTTIERE = 8;
  const carte = { largeur: (LARGEUR - 2 * MARGE - GOUTTIERE) / 2, hauteur: HAUTEUR - 2 * MARGE };
  const gauche = MARGE, droite = MARGE + carte.largeur + GOUTTIERE;
  const RAYON = 34, PART_MOYEU = 1 / 4, DESCENTE = 104;   // disque d'essai, son moyeu (un quart du rayon) ; son centre sous le haut de la carte
  const centreY = MARGE + DESCENTE;
  const milieu = (xCarte) => xCarte + carte.largeur / 2;
  const objet = (x) => [
    n("circle", { cx: x, cy: centreY, r: RAYON, fill: CHARTE.accentDoux, stroke: CHARTE.accent, "stroke-width": CHARTE.traits.appuye }),
    n("circle", { cx: x, cy: centreY, r: RAYON * PART_MOYEU, fill: CHARTE.accent }),
  ];
  const ECART_ETIQUETTE = 14;                     // du bord du disque à l'ancre de l'étiquette
  const JEU_FLECHE = 4, HAUT_FLECHE = 20, DEMI_PORTEE = 38;   // la flèche passe au-dessus du disque, sans le toucher
  const sommet = centreY - RAYON - JEU_FLECHE;
  return cadre({ largeur: LARGEUR, hauteur: HAUTEUR, titre: "Pièces du kit",
    description: "Exemple pour la revue : deux vignettes, juste et faux, avec leur pastille écrite ; une étiquette et une flèche." },
  vignette({ x: gauche, y: MARGE, largeur: carte.largeur, hauteur: carte.hauteur, etat: "juste" },
    objet(milieu(gauche)),
    etiquette({ cible: [milieu(gauche), centreY + RAYON], ancre: [milieu(gauche), centreY + RAYON + ECART_ETIQUETTE],
      lignes: ["Objet désigné"], ancrage: "middle" })),
  vignette({ x: droite, y: MARGE, largeur: carte.largeur, hauteur: carte.hauteur, etat: "faux" },
    objet(milieu(droite)),
    fleche([[milieu(droite) - DEMI_PORTEE, sommet + HAUT_FLECHE], [milieu(droite), sommet], [milieu(droite) + DEMI_PORTEE, sommet + HAUT_FLECHE]])));
}

// Étiquettes aux trois ancrages (à gauche du filet, à droite, sous l'objet sur deux lignes), flèche droite et flèche courbe.
function etiquettes({ kit, svg }) {
  const { CHARTE, cadre, etiquette, fleche, texte } = kit, { n } = svg;
  const HAUTEUR = HAUTEUR_ETIQUETTES;
  const objet = { largeur: 100, hauteur: 52, rayon: 8, centreY: 70 };
  const gauche = (LARGEUR - objet.largeur) / 2, droite = gauche + objet.largeur;
  const haut = objet.centreY - objet.hauteur / 2, bas = haut + objet.hauteur, milieu = LARGEUR / 2;
  // Pointe d'un filet : à 16 du côté de l'objet, à 12 de son bord haut (ou bas) ; ancre de chaque étiquette : à 40 du côté,
  // à 14 au-dessus du bord haut, à 22 sous le bord bas.
  const POINTE = { dedans: 16, sous: 12 }, ANCRE = { cote: 40, haut: 14, bas: 22 };
  const MARGE = 24, PORTEE_DROITE = 76, PORTEE_COURBE = 72, FLECHE_Y = 154, FLECHE_HAUT = 18, LEGENDE_Y = 178;
  return cadre({ largeur: LARGEUR, hauteur: HAUTEUR, titre: "Étiquettes et flèches du kit",
    description: "Exemple pour la revue : étiquettes aux trois ancrages, dont une sur deux lignes ; une flèche droite et une flèche courbe." },
  n("rect", { x: gauche, y: haut, width: objet.largeur, height: objet.hauteur, rx: objet.rayon, fill: CHARTE.accentDoux,
    stroke: CHARTE.accent, "stroke-width": CHARTE.traits.appuye }),
  etiquette({ cible: [gauche + POINTE.dedans, haut + POINTE.sous], ancre: [gauche - ANCRE.cote, haut - ANCRE.haut],
    lignes: ["À gauche"], ancrage: "end" }),
  etiquette({ cible: [droite - POINTE.dedans, haut + POINTE.sous], ancre: [droite + ANCRE.cote, haut - ANCRE.haut],
    lignes: ["À droite"], ancrage: "start" }),
  etiquette({ cible: [milieu, bas - POINTE.sous], ancre: [milieu, bas + ANCRE.bas],
    lignes: ["Sous l'objet,", "sur deux lignes"], ancrage: "middle" }),
  fleche([[MARGE, FLECHE_Y], [MARGE + PORTEE_DROITE, FLECHE_Y]]),
  texte(MARGE, LEGENDE_Y, "Flèche droite"),
  fleche([[LARGEUR - MARGE - PORTEE_COURBE, FLECHE_Y], [LARGEUR - MARGE - PORTEE_COURBE / 2, FLECHE_Y - FLECHE_HAUT], [LARGEUR - MARGE, FLECHE_Y]]),
  texte(LARGEUR - MARGE - PORTEE_COURBE / 2, LEGENDE_Y, "Flèche courbe", { ancrage: "middle" }));
}

// Personne en pictogramme et repères des mains (style schématique) : une silhouette de face faite des pièces du kit (tête ronde,
// buste arrondi, bras « devant » bordés d'un liseré, jambes), un bras du ton éloigné à côté d'elle, puis les repères G et D,
// pleins (la main tient) et creux (elle a lâché ou se déplace), chacun avec sa légende.
const HAUTEUR_PERSONNE = 200;
function personne({ kit, svg }) {
  const { CHARTE, cadre, texte, gelule, formePictogramme, membrePictogramme, tetePictogramme, disqueMain, arrondir, trace } = kit;
  const { n } = svg;
  const LEGENDE = { taille: 11, y: 186 };
  // Silhouette de face (unités du cadre) : centre, tête, buste (demi-largeur, haut, bas, arrondis), bras, jambes.
  const X = 70, TETE = { y: 34, r: 16 }, BUSTE = { demi: 26, haut: 56, bas: 128, arrondiHaut: 11, arrondiBas: 6 };
  const BRAS = { x: 36, haut: 70, bas: 122, rayons: [7, 6] }, JAMBES = { x: 13, haut: 128, bas: 166, rayons: [10, 8.5] };
  const buste = arrondir([[X - BUSTE.demi, BUSTE.haut], [X + BUSTE.demi, BUSTE.haut], [X + BUSTE.demi, BUSTE.bas], [X - BUSTE.demi, BUSTE.bas]],
    [BUSTE.arrondiHaut, BUSTE.arrondiHaut, BUSTE.arrondiBas, BUSTE.arrondiBas]);
  // Bras du ton éloigné, isolé, pour montrer le second ton : de l'épaule au coude puis à la main.
  const LOIN = { points: [[150, 64], [146, 104], [168, 128]], rayons: [7, 6, 5.5] };
  // Repères : deux colonnes (G puis D), plein en haut, creux en bas.
  const REPERES = { x: [218, 268], y: [70, 128], rayon: 10.5, lettre: 12 };
  return cadre({ largeur: LARGEUR, hauteur: HAUTEUR_PERSONNE, titre: "Personne en pictogramme et repères des mains",
    description: "Exemple pour la revue : une silhouette de face faite des pièces du kit, un bras du ton éloigné, puis les repères G et D, pleins et creux." },
  formePictogramme([gelule([X - JAMBES.x, JAMBES.haut], JAMBES.rayons[0], [X - JAMBES.x, JAMBES.bas], JAMBES.rayons[1]),
    gelule([X + JAMBES.x, JAMBES.haut], JAMBES.rayons[0], [X + JAMBES.x, JAMBES.bas], JAMBES.rayons[1])]),
  formePictogramme(trace(buste)),
  tetePictogramme({ centre: [X, TETE.y], rayon: TETE.r }),
  [-1, 1].map((k) => membrePictogramme({ points: [[X + k * BRAS.x, BRAS.haut], [X + k * BRAS.x, BRAS.bas]], rayons: BRAS.rayons, plan: "devant" })),
  membrePictogramme({ ...LOIN, plan: "loin" }),
  ["gauche", "droite"].flatMap((cote, i) => [1, 0].map((plein, j) => disqueMain({ x: REPERES.x[i], y: REPERES.y[j], cote, plein,
    rayon: REPERES.rayon, lettre: REPERES.lettre, anneau: CHARTE.traits.appuye }))),
  texte(X, LEGENDE.y, "Silhouette", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }),
  texte(LOIN.points[1][0], LEGENDE.y, "Ton éloigné", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }),
  texte((REPERES.x[0] + REPERES.x[1]) / 2, REPERES.y[0] - 22, "Tient", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }),
  texte((REPERES.x[0] + REPERES.x[1]) / 2, REPERES.y[1] + 30, "Lâchée", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }));
}

// Les voitures du kit (tâche 5), telles que les familles les posent : vue du dessus, puis de profil, chacune dans un état sobre et
// dans un état chargé (toutes ses pièces à la demande), avec une légende qui nomme l'état. Échelles choisies pour la revue : la
// plus grande qui tient dans le cadre, le détail de finition s'y voit (voir DETAIL_MIN du kit).
const HAUTEUR_DESSUS = 296, HAUTEUR_PROFIL = 240;
const LEGENDE = { taille: 11, ecart: 16 };   // légende sous chaque voiture : taille, et écart à la ligne de base

function voituresDessus({ kit }) {
  const { CHARTE, cadre, texte, voitureDessus } = kit;
  const ECHELLE = 48, X = LARGEUR / 2;
  // Deux voitures, cap 0 (l'avant à droite) : la première avec ses rétroviseurs, la seconde avec roues avant braquées de 25 degrés
  // à droite et portière du conducteur ouverte de 40 degrés (elle s'ouvre vers le haut du cadre, côté gauche de la voiture).
  // Centres et lignes de base des légendes : la voiture fermée déborde de 49 unités de son centre (rétroviseurs), la portière
  // ouverte de 82 au-dessus ; 13 unités de la voiture à sa légende, 10 de la légende à la voiture suivante.
  const Y1 = 58, Y2 = 218, BAS1 = 122, BAS2 = 282;
  return cadre({ largeur: LARGEUR, hauteur: HAUTEUR_DESSUS, titre: "Voiture du kit vue du dessus",
    description: "Exemple pour la revue : la voiture des scènes vue du dessus, avec ses rétroviseurs ; puis roues avant braquées et portière du conducteur ouverte." },
  voitureDessus({ x: X, y: Y1, cap: 0, echelle: ECHELLE, retroviseurs: true }),
  texte(X, BAS1, "Rétroviseurs", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }),
  voitureDessus({ x: X, y: Y2, cap: 0, echelle: ECHELLE, retroviseurs: true, roues: true, braquage: 25, portiere: 40 }),
  texte(X, BAS2, "Roues braquées de 25 degrés, portière ouverte de 40", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }));
}

function voituresProfil({ kit }) {
  const { CHARTE, cadre, texte, voitureProfil } = kit;
  const ECHELLE = 60, X = LARGEUR / 2;
  // De profil : côté droit (sens « droite », l'avant à droite), puis côté conducteur (sens « gauche »), portière avant et trappe
  // à carburant ouvertes. Sol de chaque voiture, puis sa légende dessous.
  const SOL1 = 96, SOL2 = 212;   // le toit à 90 unités du sol ; la légende à 16 sous le sol, puis 6 jusqu'au toit suivant
  return cadre({ largeur: LARGEUR, hauteur: HAUTEUR_PROFIL, titre: "Voiture du kit de profil",
    description: "Exemple pour la revue : la citadine à hayon du kit de profil (Dacia Sandero III, à ses cotes), côté droit ; puis côté conducteur, portière avant et trappe à carburant ouvertes." },
  voitureProfil({ x: X, y: SOL1, echelle: ECHELLE }),
  texte(X, SOL1 + LEGENDE.ecart, "Côté droit", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }),
  voitureProfil({ x: X, y: SOL2, echelle: ECHELLE, sens: "gauche", portiereOuverte: true, trappeOuverte: true }),
  texte(X, SOL2 + LEGENDE.ecart, "Côté conducteur, portière et trappe ouvertes", { taille: LEGENDE.taille, ancrage: "middle", couleur: CHARTE.texteDoux }));
}

export const PIECES_KIT = [
  { code: "kit-paire", titre: "Paire juste et faux : vignettes, pastilles, étiquette, flèche", cadre: [LARGEUR, HAUTEUR_PAIRE], construire: paire },
  { code: "kit-etiquettes", titre: "Étiquettes aux trois ancrages, flèche droite et flèche courbe", cadre: [LARGEUR, HAUTEUR_ETIQUETTES], construire: etiquettes },
  { code: "kit-personne", titre: "Personne en pictogramme et repères des mains (style schématique)", cadre: [LARGEUR, HAUTEUR_PERSONNE],
    construire: personne },
  { code: "kit-voiture-dessus", titre: "Voiture vue du dessus : rétroviseurs, roues braquées, portière ouverte", cadre: [LARGEUR, HAUTEUR_DESSUS],
    construire: voituresDessus },
  { code: "kit-voiture-profil", titre: "Voiture de profil : côté droit, côté conducteur portière et trappe ouvertes", cadre: [LARGEUR, HAUTEUR_PROFIL],
    construire: voituresProfil },
];
