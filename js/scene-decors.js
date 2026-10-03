/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Décors des scènes animées, construits en mètres à partir de règles écrites :
 * un carrefour en croix et un carrefour à sens giratoire. Module pur.
 *
 * Les dimensions de marquage viennent de l'IISR, 7e partie (version consolidée
 * VC20130321, Cerema) ; les autres sont des choix de dessin, nommés dans DESSIN
 * et consignés dans la fiche de vérification de chaque cours qui les utilise.
 */
import { DEG, trajet, tournerChemin, tournerPoint, rectangle, pointsArc, disque, secteurAnneau }
  from "./scene-geometrie.js?v=20261003c";

export const IISR = {
  u: 0.05,                                     // art. 113-1 C : largeur unité, routes ordinaires
  axialeAgglo: { trait: 1.5, vide: 5 },        // T'1, admise en agglomération (art. 113-2 A.2)
  transversale: { trait: 0.5, vide: 0.5 },     // T'2 (art. 113-1 B)
  largeurCedez: 0.5,                           // art. 113-2 C et 117-4 B
  axialeContinueAvantCedez: 15,                // art. 117-4 B : de 10 à 20 m, 15 m retenus
  passage: { bande: 0.5, intervalle: 0.5, longueur: 2.5, interruptionAxiale: 0.5 },   // art. 118
};

export const DESSIN = {
  voie: 3.5,                // largeur d'une voie
  rayonBordure: 6,          // arrondi des bordures du carrefour en croix
  ecartPassage: 0.5,        // de la fin de l'arrondi au passage piéton
  margeTrajectoire: 0.6,    // entre le flanc d'une voiture et la bordure qu'elle suit
  demiLargeurVoiture: 0.9,  // moitié de la largeur d'une voiture (GABARITS.voiture.largeur, 1,8 m), pour caler les trajectoires sur les bordures

  // Distance, vers l'intérieur du monde, du bord au premier et au dernier point d'un trajet de giratoire par
  // défaut : celui de l'élève, visible de bout en bout. Choix de dessin, sans source. Un véhicule qui apparaît
  // ou disparaît en cours de scène part et finit, lui, à HORS_MONDE au-delà du bord (option horsMonde).
  retraitBord: 0.5,
  // Jeu entre l'anneau et le bord aval de la ligne de cédez-le-passage du giratoire. La ligne marque la
  // limite de la chaussée prioritaire (IISR 7e partie, art. 117-4 B), ici le bord extérieur de l'anneau ;
  // les 5 cm sont un choix de dessin : la ligne est tenue juste hors de l'anneau.
  jeuCedezAnneau: 0.05,
  // Degrés, après l'axe de la sortie précédente, auxquels s'allume le clignotant d'un trajet de giratoire.
  // Le thème 11 enseigne seulement « après avoir dépassé la sortie précédente » : les 3 degrés sont un
  // choix de dessin.
  clignotantApresAxe: 3,
  // Secteur de l'anneau devant l'entrée sud (angles polaires en degrés, dans le repère de la branche sud) :
  // zone de conflit que l'élève ne doit pas pénétrer tant qu'un usager de l'anneau s'y trouve (priorité à
  // l'anneau, thème 11). Les deux bornes sont un choix de dessin.
  secteurConflit: [40, 125],

  // Panneaux : choix de dessin, sans source ; chacun est posé sur le trottoir, à droite de la voie entrante.
  // AB3a du carrefour en croix : écart au coin de la chaussée (avant l'arrondi), selon chaque axe, vers l'extérieur.
  ecartAB3aCroix: 2.5,
  // AB3a de chaque entrée du giratoire, dans le repère de la branche : déport au-delà de la bordure droite
  // de la voie entrante, et distance au centre de l'îlot (valeur absolue, adaptée à rExt = 14 m).
  deportAB3aGiratoire: 1.6,
  distanceAB3aGiratoire: 16.5,
  // AB25 de la branche sud : déport au-delà de la bordure droite de la voie entrante. Sa distance à l'anneau
  // est le paramètre distanceAB25 de giratoire (thème 11 : de l'ordre de 50 m en agglomération).
  deportAB25: 1.2,
};

// Distance du centre d'une voiture au bord du monde pour qu'elle soit entièrement hors du cadre :
// la demi-longueur d'une voiture (2,25 m) plus 0,5 m. Une voiture perpendiculaire au bord, centrée
// à cette distance au-delà, n'a aucun point dans le monde. Un véhicule qui part en cours de scène
// y commence son trajet (il apparaît à son départ) et un véhicule autre que celui de l'élève qui
// finit en roulant y finit le sien (il disparaît à la fin) : ces deux instants se passent hors de
// l'image. Le trajet de l'élève, lui, reste visible de bout en bout.
export const HORS_MONDE = 2.75;

const LOIN = 400;   // trottoirs et voies débordent largement du monde visible

const axialeT1 = (de, a) => ({ type: "ligne", de, a, largeur: 2 * IISR.u, trait: IISR.axialeAgglo.trait, vide: IISR.axialeAgglo.vide });
const axialeContinue = (de, a) => ({ type: "ligne", de, a, largeur: 2 * IISR.u });

// Bandes d'un passage piéton entre xA et xB (longueur des bandes, le long de l'axe),
// centrées sur la chaussée [yHaut, yBas] : 0,50 m, intervalles de 0,50 m (art. 118).
function bandesPassage(xA, xB, yHaut, yBas) {
  const { bande, intervalle } = IISR.passage;
  const largeur = yBas - yHaut;
  const n = Math.floor((largeur + intervalle) / (bande + intervalle));
  const y0 = yHaut + (largeur - (n * bande + (n - 1) * intervalle)) / 2;
  return Array.from({ length: n }, (_, k) => {
    const y = y0 + k * (bande + intervalle);
    return { type: "surface", poly: rectangle(xA, y, xB, y + bande) };
  });
}

// Intervalle [a, b] privé de [c, d] (bornes dans n'importe quel ordre) : 0, 1 ou 2 morceaux.
function retirer([a, b], creux) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (!creux) return [[lo, hi]];
  const cLo = Math.min(...creux), cHi = Math.max(...creux);
  const morceaux = [];
  if (cLo > lo) morceaux.push([lo, Math.min(cLo, hi)]);
  if (cHi < hi) morceaux.push([Math.max(cHi, lo), hi]);
  return morceaux.filter(([x, y]) => y - x > 1e-9);
}

/**
 * Carrefour en croix d'agglomération, chaussées à double sens, une voie par sens.
 * L'axe nord-sud est prioritaire. Les branches est et ouest portent un
 * cédez-le-passage : panneau AB3a au coin et ligne T'2 de 0,50 m, précédée de
 * 15 m d'axiale continue (IISR 117-4 B). La ligne s'étend sur toute la largeur de
 * la voie entrante : de l'axe à la bordure arrondie du coin, que son bord amont
 * rencontre, de sorte que tout le trait reste sur la chaussée. Passages piétons
 * sur les branches demandées, juste après l'arrondi des bordures (IISR 118).
 */
export function carrefourEnCroix({ branches, passages = [] }) {
  const h = DESSIN.voie, r = DESSIN.rayonBordure;
  const { nord, sud, est, ouest } = branches;
  const cx = ouest + h, cy = nord + h;
  const largeur = ouest + 2 * h + est, hauteur = nord + 2 * h + sud;
  const bord = { nord: cy - h, sud: cy + h, est: cx + h, ouest: cx - h };

  // Trottoirs : un bloc par coin, l'angle arrondi au rayon r (bloc convexe).
  const obstacles = [];
  const arrondi = {};
  for (const [nom, sx, sy] of [["NE", 1, -1], ["SE", 1, 1], ["SO", -1, 1], ["NO", -1, -1]]) {
    const xc = cx + sx * h, yc = cy + sy * h;      // coin de la chaussée
    const ox = xc + sx * r, oy = yc + sy * r;      // centre de l'arrondi
    arrondi[nom] = { x: ox, y: oy, r };
    const xLoin = cx + sx * LOIN, yLoin = cy + sy * LOIN;
    const aHorizontal = Math.atan2(yc - oy, 0) / DEG;   // point (ox, yc)
    const aVertical = Math.atan2(0, xc - ox) / DEG;     // point (xc, oy)
    obstacles.push({ nature: "trottoir", poly: [[xc, yLoin], [xLoin, yLoin], [xLoin, yc], ...pointsArc(ox, oy, r, aHorizontal, aVertical)] });
  }

  const voies = {
    sudEntrante: rectangle(cx, bord.sud, cx + h, cy + LOIN),       // vers le nord
    sudSortante: rectangle(cx - h, bord.sud, cx, cy + LOIN),
    nordEntrante: rectangle(cx - h, cy - LOIN, cx, bord.nord),     // vers le sud
    nordSortante: rectangle(cx, cy - LOIN, cx + h, bord.nord),
    estEntrante: rectangle(bord.est, cy - h, cx + LOIN, cy),       // vers l'ouest
    estSortante: rectangle(bord.est, cy, cx + LOIN, cy + h),
    ouestEntrante: rectangle(cx - LOIN, cy, bord.ouest, cy + h),   // vers l'est
    ouestSortante: rectangle(cx - LOIN, cy - h, bord.ouest, cy),
    axeNordSudEst: rectangle(cx, cy - LOIN, cx + h, cy + LOIN),    // moitié est de l'axe nord-sud, carrefour compris
  };
  const zones = {
    carrefour: rectangle(bord.ouest, bord.nord, bord.est, bord.sud),
    moitieOuestCarrefour: rectangle(bord.ouest, bord.nord, cx, bord.sud),
  };

  const marquages = [axialeT1([cx, bord.sud], [cx, hauteur]), axialeT1([cx, bord.nord], [cx, 0])];
  const panneaux = [];
  const passagesPietons = {};
  for (const cote of ["est", "ouest"]) {
    const s = cote === "est" ? 1 : -1;
    const xBord = cx + s * h;
    // Ligne de cédez-le-passage (IISR 117-4 B) : elle s'étend sur toute la largeur de la voie qui doit céder le
    // passage et marque la limite de la chaussée prioritaire, d'où son bord aval sur xBord. À cet endroit la
    // chaussée est élargie par l'arrondi du coin : le trait va de l'axe à la bordure, que son bord amont (le
    // plus éloigné du carrefour, donc là où la chaussée est la moins large) rencontre, pour rester sur la chaussée.
    const [coin, sy] = cote === "est" ? [arrondi.NE, -1] : [arrondi.SO, 1];   // coin à droite de la voie entrante, et son côté de l'axe
    const xAmont = xBord + s * IISR.largeurCedez;
    const yBordure = coin.y - sy * Math.sqrt(coin.r * coin.r - (xAmont - coin.x) ** 2);
    const [yDe, yA] = cote === "est" ? [yBordure, cy] : [cy, yBordure];
    marquages.push({ type: "ligne", role: "cedez-" + cote,
      de: [xBord + (s * IISR.largeurCedez) / 2, yDe], a: [xBord + (s * IISR.largeurCedez) / 2, yA],
      largeur: IISR.largeurCedez, trait: IISR.transversale.trait, vide: IISR.transversale.vide });
    let creux = null;
    if (passages.includes(cote)) {
      const x0 = xBord + s * (r + DESSIN.ecartPassage), x1 = x0 + s * IISR.passage.longueur;
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      marquages.push(...bandesPassage(xa, xb, cy - h, cy + h));
      passagesPietons[cote] = {
        x0: xa, x1: xb,
        zone: rectangle(xa, cy - h, xb, cy + h),
        zoneSortante: cote === "est" ? rectangle(xa, cy, xb, cy + h) : rectangle(xa, cy - h, xb, cy),
      };
      creux = [xa - IISR.passage.interruptionAxiale, xb + IISR.passage.interruptionAxiale];
    }
    const xFinContinue = xBord + s * IISR.axialeContinueAvantCedez;
    for (const [a, b] of retirer([xBord, xFinContinue], creux)) marquages.push(axialeContinue([a, cy], [b, cy]));
    marquages.push(axialeT1([xFinContinue, cy], [cote === "est" ? largeur : 0, cy]));
    // Panneau AB3a au coin, à droite de la voie entrante, sur le trottoir.
    const e = DESSIN.ecartAB3aCroix;
    panneaux.push({ code: "AB3a", x: xBord + s * e, y: cote === "est" ? cy - h - e : cy + h + e });
  }

  return {
    monde: { largeur, hauteur }, centre: { x: cx, y: cy },
    obstacles, marquages, panneaux, voies, zones,
    reperes: { cx, cy, bord, arrondi, passages: passagesPietons },
  };
}

const ORDRE_BRANCHES = ["sud", "est", "nord", "ouest"];         // ordre de passage, sens giratoire
const ROTATION = { sud: 0, est: -90, nord: 180, ouest: 90 };   // du repère de la branche sud vers chaque branche

/**
 * Carrefour à sens giratoire d'agglomération : îlot central infranchissable,
 * chaussée annulaire à une voie, à sens unique par la droite (R110-2), quatre
 * branches à double sens (une voie par sens), sans îlot séparateur. À chaque
 * entrée : panneau AB3a et ligne T'2 de 0,50 m, de l'axe à la bordure du
 * raccordement d'entrée, précédée de 15 m d'axiale continue (IISR 117-4 B).
 * Panneau AB25 sur la branche sud, à `distanceAB25` m de l'anneau (thème 11 : de
 * l'ordre de 50 m en agglomération). Les trajectoires suivent les bordures à
 * DESSIN.margeTrajectoire près, d'où le rayon de l'anneau parcouru (rAnneau) et
 * l'écart à l'axe des voies d'entrée et de sortie (xLigne).
 */
export function giratoire({ branches, rIlot = 8, rExt = 14, rRacc = 8, distanceAB25 = 50 }) {
  const h = DESSIN.voie;
  const { nord, sud, est, ouest } = branches;
  const cx = ouest + rExt, cy = nord + rExt;
  const largeur = ouest + 2 * rExt + est, hauteur = nord + 2 * rExt + sud;
  const dF = rExt + rRacc;
  const yF = Math.sqrt(dF * dF - (h + rRacc) ** 2);         // raccordements de la branche sud (relatif)
  const thetaRacc = Math.atan2(yF, h + rRacc) / DEG;        // angle polaire des tangences côté est
  const rFil = rRacc + DESSIN.demiLargeurVoiture + DESSIN.margeTrajectoire;
  const rAnneau = dF - rFil;
  const xLigne = h + rRacc - rFil;

  // Bloc de trottoir sud-est (repère centré sur l'îlot), puis trois rotations.
  const A = [h + rRacc, yF];   // raccordement est de la branche sud
  const B = [yF, h + rRacc];   // raccordement sud de la branche est
  const angle = ([x, y]) => Math.atan2(y, x) / DEG;
  const blocSE = [
    [h, LOIN], [LOIN, LOIN], [LOIN, h],
    ...pointsArc(B[0], B[1], rRacc, -90, angle([-B[0], -B[1]])),
    ...pointsArc(0, 0, rExt, angle(B), angle(A)),
    ...pointsArc(A[0], A[1], rRacc, angle([-A[0], -A[1]]), 180),
  ];
  const tourner = (p, rot) => tournerPoint([cx + p[0], cy + p[1]], cx, cy, rot);
  const obstacles = [0, -90, 180, 90].map((rot) => ({ nature: "trottoir", poly: blocSE.map((p) => tourner(p, rot)) }));
  obstacles.push({ nature: "ilot", poly: disque(cx, cy, rIlot) });

  // Marquage et panneaux d'une branche, dans le repère de la branche sud, puis rotation.
  const yAval = rExt + DESSIN.jeuCedezAnneau;                // bord aval de la ligne, juste hors de l'anneau
  const yLigne = yAval + IISR.largeurCedez / 2;
  // Comme au carrefour en croix, la ligne va de l'axe à la bordure (IISR 117-4 B : toute la largeur de la voie qui
  // doit céder le passage). La chaussée, évasée par le raccordement d'entrée, est la moins large au bord amont du
  // trait, le plus éloigné de l'anneau : c'est là que la bordure borne le trait, pour qu'il reste sur la chaussée.
  const yAmontLigne = yLigne + IISR.largeurCedez / 2;
  const xBordure = h + rRacc - Math.sqrt(rRacc * rRacc - (yAmontLigne - yF) ** 2);
  const marquages = [];
  const panneaux = [];
  const voies = {};
  for (const nom of ORDRE_BRANCHES) {
    const rot = ROTATION[nom];
    marquages.push({ type: "ligne", role: "cedez-" + nom, de: tourner([0, yLigne], rot), a: tourner([xBordure, yLigne], rot),
      largeur: IISR.largeurCedez, trait: IISR.transversale.trait, vide: IISR.transversale.vide });
    marquages.push(axialeContinue(tourner([0, rExt], rot), tourner([0, rExt + IISR.axialeContinueAvantCedez], rot)));
    marquages.push(axialeT1(tourner([0, rExt + IISR.axialeContinueAvantCedez], rot), tourner([0, LOIN], rot)));
    const [px, py] = tourner([h + DESSIN.deportAB3aGiratoire, DESSIN.distanceAB3aGiratoire], rot);
    panneaux.push({ code: "AB3a", x: px, y: py });
    voies[nom + "Entrante"] = rectangle(0, rExt, h, LOIN).map((p) => tourner(p, rot));
    voies[nom + "Sortante"] = rectangle(-h, rExt, 0, LOIN).map((p) => tourner(p, rot));
  }
  panneaux.push({ code: "AB25", x: cx + h + DESSIN.deportAB25, y: cy + rExt + distanceAB25 });

  return {
    monde: { largeur, hauteur }, centre: { x: cx, y: cy },
    obstacles, marquages, panneaux, voies, zones: {},
    reperes: {
      cx, cy, rIlot, rExt, rRacc, yF, thetaRacc, rFil, rAnneau, xLigne,
      cedez: { yAmont: cy + yAval + IISR.largeurCedez },      // branche sud
      zoneConflitSud: secteurAnneau(cx, cy, rIlot, rExt, ...DESSIN.secteurConflit),
      distances: { sud: hauteur - cy, nord: cy, est: largeur - cx, ouest: cx },
    },
  };
}

/**
 * Trajet d'une voiture dans le giratoire, d'une branche à une autre : approche
 * dans l'axe de la voie d'entrée, arc d'entrée concentrique au raccordement,
 * arc de l'anneau, arc de sortie, puis la voie de sortie jusqu'au bord du monde.
 * Les arcs sont tangents par construction. Abscisses repères renvoyées :
 * tangenceEntree, anneau, clignotant (DESSIN.clignotantApresAxe degrés après
 * l'axe de la sortie précédente : le thème 11 enseigne seulement « après avoir
 * dépassé la sortie précédente », l'écart est un choix de dessin), sortie,
 * finSortie. Une branche inconnue et le demi-tour sont refusés.
 *
 * Par défaut, le trajet part et finit à DESSIN.retraitBord (0,5 m) à l'intérieur du
 * bord du monde : c'est celui de l'élève, visible dès son départ et jusqu'à son
 * arrivée. Avec `horsMonde`, il part et finit à HORS_MONDE au-delà du bord, pour un
 * véhicule qui apparaît à son départ ou disparaît à la fin de son trajet. Le tracé
 * est le même, prolongé de HORS_MONDE + DESSIN.retraitBord (3,25 m) à chaque bout,
 * et les abscisses repères suivent le tracé.
 */
export function trajetGiratoire(g, depuis, vers, { horsMonde = false } = {}) {
  for (const [argument, branche] of [["depuis", depuis], ["vers", vers]]) {
    if (!ORDRE_BRANCHES.includes(branche)) {
      const attendues = ORDRE_BRANCHES.map((b) => `« ${b} »`).join(", ");
      throw new Error(`trajetGiratoire : branche « ${branche} » inconnue pour « ${argument} » (attendu : ${attendues})`);
    }
  }
  const k = (ORDRE_BRANCHES.indexOf(vers) - ORDRE_BRANCHES.indexOf(depuis) + 4) % 4;   // 1 : première sortie
  if (k === 0) throw new Error("trajetGiratoire : le demi-tour n'est pas prévu");
  const { cx, cy, yF, thetaRacc, rFil, rAnneau, xLigne, distances } = g.reperes;
  const auDela = horsMonde ? HORS_MONDE : -DESSIN.retraitBord;   // position des extrémités par rapport au bord du monde (+ : au-delà)
  const approche = distances[depuis] + auDela - yF;
  const longueurSortie = distances[vers] + auDela - yF;
  const balayage = 2 * thetaRacc + 90 * (k - 2);
  const t = trajet(cx + xLigne, cy + yF + approche, -90).droit(approche);
  const tangenceEntree = t.longueur;
  t.virage(rFil, thetaRacc, { suitLaRoute: true });
  const anneau = t.longueur;
  t.virage(rAnneau, -balayage, { suitLaRoute: true });
  const debutSortie = t.longueur;
  t.virage(rFil, thetaRacc);
  const finSortie = t.longueur;
  t.droit(longueurSortie);
  // L'axe de la sortie précédente est à l'angle polaire 180 - 90 k (repère de la branche sud) ;
  // on circule dans le sens des angles décroissants, le clignotant s'allume donc à cet angle moins l'écart.
  const clignotant = k === 1 ? 0 : anneau + (thetaRacc - (180 - 90 * k - DESSIN.clignotantApresAxe)) * DEG * rAnneau;
  return {
    chemin: tournerChemin(t.fin(), cx, cy, ROTATION[depuis]),
    s: { tangenceEntree, anneau, clignotant, sortie: debutSortie, finSortie },
  };
}
