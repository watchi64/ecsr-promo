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
 * Tâche 5 (les voitures du kit) : ajouter ici une pièce par voiture, sur le même modèle ; le test les contrôle toutes.
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

export const PIECES_KIT = [
  { code: "kit-paire", titre: "Paire juste et faux : vignettes, pastilles, étiquette, flèche", cadre: [LARGEUR, HAUTEUR_PAIRE], construire: paire },
  { code: "kit-etiquettes", titre: "Étiquettes aux trois ancrages, flèche droite et flèche courbe", cadre: [LARGEUR, HAUTEUR_ETIQUETTES], construire: etiquettes },
];
