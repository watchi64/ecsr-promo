/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Décors des scènes animées, construits en mètres à partir de règles écrites :
 * un carrefour en croix, un carrefour à sens giratoire, une rue droite et une
 * route en virages. Module pur.
 *
 * Les dimensions de marquage viennent de l'IISR, 7e partie (version consolidée
 * VC20130321, Cerema) ; les autres sont des choix de dessin, nommés dans DESSIN
 * et consignés dans la fiche de vérification de chaque cours qui les utilise.
 */
import { DEG, trajet, pointA, tournerChemin, tournerPoint, rectangle, pointsArc, disque, secteurAnneau, pointDansPolygone }
  from "./scene-geometrie.js?v=20261008a";

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
  // de la voie entrante, et distance du bord amont de la ligne de cédez-le-passage au panneau, le long de l'axe
  // de la branche. Posé par rapport à la ligne, le panneau la suit quand les rayons changent ; avec les rayons
  // par défaut (rExt = 14 m), 1,95 m le met à 16,5 m du centre de l'îlot. Choix de dessin, sans source.
  deportAB3aGiratoire: 1.6,
  distanceAB3aAmontCedez: 1.95,
  // AB25 de la branche sud : déport au-delà de la bordure droite de la voie entrante. Sa distance à l'anneau
  // est le paramètre distanceAB25 de giratoire (thème 11 : de l'ordre de 50 m en agglomération).
  deportAB25: 1.2,

  // Route en virages (routeVirages) : rayon des deux virages, mesuré sur l'axe de la chaussée, et angle dont chacun
  // fait tourner la route. Valeurs par défaut, choix de dessin à recopier dans les sources de la scène qui les
  // emploie : 40 m, un virage d'agglomération ; 60 degrés, la route tourne franchement sans former l'angle droit
  // d'un coin de rue.
  rayonVirage: 40,
  angleVirage: 60,
  // Flèche maximale (m) des cordes qui dessinent les arcs de la route en virages (bordures, voies, traits de
  // l'axiale) : la chaussée garde sa largeur à 2 mm près dans les virages. Choix de dessin, sans source.
  flecheArc: 0.002,

  // Stationnement le long du trottoir droit de la rue (option stationnement de rue) : largeur de la bande, non marquée,
  // et jeu entre le flanc droit d'une voiture garée et la bordure. Choix de dessin, à recopier dans les sources de la
  // scène qui les emploie. Avec 2,0 m de bande, une voiture garée à 0,3 m du trottoir (1,8 m de large) déborde de 0,1 m
  // sur la voie de droite et lui laisse 3,4 m : on la dépasse sans franchir l'axe.
  largeurStationnement: 2.0,
  jeuStationnement: 0.3,
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
 * l'ordre de 50 m en agglomération). Chaque AB3a est posé à DESSIN.distanceAB3aAmontCedez
 * en amont de sa ligne de cédez-le-passage ; un panneau (AB3a ou AB25) qui ne tomberait
 * pas sur un trottoir fait lever une erreur. Les trajectoires suivent les bordures à
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
    const [px, py] = tourner([h + DESSIN.deportAB3aGiratoire, yAval + IISR.largeurCedez + DESSIN.distanceAB3aAmontCedez], rot);
    panneaux.push({ code: "AB3a", x: px, y: py });
    voies[nom + "Entrante"] = rectangle(0, rExt, h, LOIN).map((p) => tourner(p, rot));
    voies[nom + "Sortante"] = rectangle(-h, rExt, 0, LOIN).map((p) => tourner(p, rot));
  }
  panneaux.push({ code: "AB25", x: cx + h + DESSIN.deportAB25, y: cy + rExt + distanceAB25 });

  // Un panneau se pose sur un trottoir. Si les rayons ou la distance demandés le font tomber ailleurs (sur la
  // chaussée évasée d'une entrée), le décor serait faux sans que rien ne le signale : on le refuse.
  for (const p of panneaux) {
    if (!obstacles.some((o) => o.nature === "trottoir" && pointDansPolygone([p.x, p.y], o.poly))) {
      throw new Error(`giratoire : le panneau ${p.code} ne tombe pas sur un trottoir, en (${p.x.toFixed(2)} ; ${p.y.toFixed(2)}) m`
        + ` : revoir les rayons (rIlot ${rIlot} m, rExt ${rExt} m, rRacc ${rRacc} m) ou distanceAB25 (${distanceAB25} m)`);
    }
  }

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

// ===== Rue droite et route en virages =====

// Une longueur de décor : un nombre fini de mètres, strictement positif. Sinon, une erreur qui nomme le décor et le
// paramètre.
function exigerLongueur(decor, nom, valeur) {
  if (!(Number.isFinite(valeur) && valeur > 0)) {
    throw new Error(`${decor} : « ${nom} » attend un nombre de mètres strictement positif (reçu : ${String(valeur)})`);
  }
}

/**
 * Rue droite d'agglomération, orientée sud-nord : l'élève y roule vers le haut de l'écran. Chaussée à double sens de
 * deux voies de `largeurVoie` m (DESSIN.voie par défaut), séparées par une axiale T'1 de largeur 2u (IISR 113-1 et
 * 113-2) dont le pointillé commence au bord bas du monde, et bordée d'un trottoir de chaque côté, sans ligne de rive (en
 * milieu urbain, les bordures de trottoir matérialisent généralement le bord de la chaussée : IISR 114-5). Le monde a
 * `longueur` m de haut et montre `largeurTrottoir` m de trottoir de chaque côté de la chaussée. Repères : abscisses (x)
 * du bord droit, de l'axe et du bord gauche de la chaussée, pour l'élève qui roule vers le nord, et celle du bord droit
 * de sa voie, voies.droite. Une scène qui élargit les voies le dit dans ses sources, avec sa raison.
 *
 * Option `stationnement` (m, 0 par défaut) : une bande de stationnement le long du trottoir droit, non marquée, entre
 * la voie de droite et la bordure (voies.stationnement). Les deux voies de circulation gardent `largeurVoie` et l'axiale
 * reste au milieu d'elles : la bande élargit la chaussée vers la droite (DESSIN.largeurStationnement pour une scène).
 * Sans bande, le bord droit de la voie de droite est la bordure.
 *
 * Les voitures en stationnement ne font pas partie du décor : ce sont des acteurs posés des scènes.
 */
export function rue({ longueur, largeurTrottoir, largeurVoie = DESSIN.voie, stationnement = 0 } = {}) {
  exigerLongueur("rue", "longueur", longueur);
  exigerLongueur("rue", "largeurTrottoir", largeurTrottoir);
  exigerLongueur("rue", "largeurVoie", largeurVoie);
  if (!(Number.isFinite(stationnement) && stationnement >= 0)) {
    throw new Error(`rue : « stationnement » attend un nombre de mètres positif ou nul (reçu : ${String(stationnement)})`);
  }
  const h = largeurVoie;
  const xBordGauche = largeurTrottoir, xAxe = xBordGauche + h, xBordVoieDroite = xAxe + h;
  const xBordDroit = xBordVoieDroite + stationnement;
  const voies = {
    droite: rectangle(xAxe, -LOIN, xBordVoieDroite, longueur + LOIN),    // vers le nord
    gauche: rectangle(xBordGauche, -LOIN, xAxe, longueur + LOIN),        // vers le sud
  };
  if (stationnement > 0) voies.stationnement = rectangle(xBordVoieDroite, -LOIN, xBordDroit, longueur + LOIN);
  return {
    monde: { largeur: xBordDroit + largeurTrottoir, hauteur: longueur },
    obstacles: [
      { nature: "trottoir", poly: rectangle(xBordDroit, -LOIN, xBordDroit + LOIN, longueur + LOIN) },
      { nature: "trottoir", poly: rectangle(xBordGauche - LOIN, -LOIN, xBordGauche, longueur + LOIN) },
    ],
    marquages: [axialeT1([xAxe, longueur], [xAxe, 0])],
    panneaux: [],
    voies,
    zones: {},
    reperes: { xBordDroit, xBordVoieDroite, xAxe, xBordGauche },
  };
}

// Pas angulaire (degrés) de l'échantillonnage d'un arc de rayon r : la flèche de chaque corde reste sous DESSIN.flecheArc.
const pasArc = (r) => (2 * Math.acos(Math.max(-1, 1 - DESSIN.flecheArc / r))) / DEG;

// Abscisses qui découpent la portion [s0, s1] d'un trajet en cordes : ses deux bouts, chaque jonction de segments et,
// sur un arc, assez de points pour que la flèche de chaque corde reste sous DESSIN.flecheArc, sur le trajet et jusqu'à
// `ecart` m de part et d'autre (le côté extérieur d'un arc, de plus grand rayon, est le plus exigeant).
function abscissesCordes(chemin, s0, s1, ecart = 0) {
  const abscisses = [s0];
  for (const seg of chemin.segments) {
    const a = Math.max(s0, seg.debut), b = Math.min(s1, seg.debut + seg.longueur);
    if (b - a <= 1e-9) continue;
    const n = seg.type === "arc" ? Math.ceil((b - a) / (seg.rayon * pasArc(seg.rayon + ecart) * DEG)) : 1;
    for (let k = 1; k <= n; k++) abscisses.push(a + ((b - a) * k) / n);
  }
  return abscisses;
}

// Trait de l'axiale T'1 posé sur l'axe, de l'abscisse s0 à s1 : une bande de largeur 2u dessinée comme une surface, une
// seule forme sans couture, dont les deux bords, à u de part et d'autre de l'axe, sont tracés en cordes ; ses bouts sont
// perpendiculaires à l'axe. Le bord droit (pour le sens de l'axe) vient d'abord, puis le bord gauche, à rebours.
function traitAxial(axe, s0, s1) {
  const points = abscissesCordes(axe, s0, s1, IISR.u).map((s) => pointA(axe, s));
  const bord = (cote) => points.map((p) => [p.x - cote * IISR.u * Math.sin(p.cap), p.y + cote * IISR.u * Math.cos(p.cap)]);
  return { type: "surface", role: "axiale", poly: [...bord(1), ...bord(-1).reverse()] };
}

/**
 * Route d'agglomération à double sens : deux voies de DESSIN.voie séparées par une axiale T'1 de largeur 2u (IISR
 * 113-1, 113-2 et 114-5), un trottoir de chaque côté, sans ligne de rive. Du bas vers le haut de l'écran, elle
 * enchaîne une ligne droite d'approche orientée au nord (`approche` m), un virage à droite, une ligne droite courte
 * (`entreVirages` m), un virage à gauche qui la ramène au nord, puis une ligne droite de sortie (`sortie` m). Les deux
 * virages ont le même `rayon`, mesuré sur l'axe de la chaussée, et tournent du même `angle`, de 0 exclu à 90 degrés
 * (DESSIN.rayonVirage et DESSIN.angleVirage par défaut). Bordures et limites des voies sont des parallèles à l'axe :
 * la chaussée garde sa largeur dans les virages. Le monde montre `largeurTrottoir` m de trottoir à gauche de la ligne
 * droite d'approche et à droite de celle de sortie ; l'axe entre par le bord bas et sort par le bord haut. Rien ne
 * masque l'intérieur des virages : la visibilité n'y est pas réduite, ils restent en section courante, où l'axiale est
 * discontinue (IISR 114-5) ; un virage à visibilité réduite serait un point singulier (art. 115), où l'axiale devient
 * continue (art. 116).
 *
 * Dessin des arcs : en cordes, assez courtes pour que leur flèche reste sous DESSIN.flecheArc (pointsArc pour les
 * trottoirs et les voies). Le moteur ne trace que des segments droits : l'axiale est faite de ses traits eux-mêmes,
 * 1,50 m peints et 5 m de vide comptés le long de l'axe depuis le bord bas, chacun dessiné comme une bande de largeur
 * 2u qui suit l'axe (traitAxial).
 *
 * Repères : rayon et angle retenus ; xAxeApproche et xAxeSortie, abscisses (x) de l'axe de la chaussée sur les lignes
 * droites d'approche et de sortie ; centres des deux virages ; s, abscisses curvilignes du début et de la fin de chaque
 * virage sur l'axe de la voie de droite (celles de cheminAxeVoieDroite(0)) ; cheminAxeVoieDroite(decalage), le trajet
 * de la voie de droite décalé latéralement.
 */
export function routeVirages({ approche, entreVirages, sortie, largeurTrottoir, rayon = DESSIN.rayonVirage,
  angle = DESSIN.angleVirage } = {}) {
  for (const [nom, valeur] of Object.entries({ approche, entreVirages, sortie, largeurTrottoir, rayon })) {
    exigerLongueur("routeVirages", nom, valeur);
  }
  const h = DESSIN.voie, retrait = DESSIN.retraitBord;
  if (!(Number.isFinite(angle) && angle > 0 && angle <= 90)) {
    throw new Error(`routeVirages : « angle » attend un nombre de degrés, plus de 0 et au plus 90 (reçu : ${String(angle)})`);
  }
  if (!(rayon > h)) {
    throw new Error(`routeVirages : « rayon » de ${rayon} m, mesuré sur l'axe : il doit dépasser la largeur d'une voie`
      + ` (${h} m), sans quoi la bordure intérieure des virages n'existe pas`);
  }
  for (const [nom, valeur] of [["approche", approche], ["sortie", sortie]]) {
    if (!(valeur > retrait)) {
      throw new Error(`routeVirages : « ${nom} » de ${valeur} m : plus de ${retrait} m attendus, le trajet de la voie de`
        + ` droite partant et finissant en ligne droite, à ${retrait} m à l'intérieur du monde`);
    }
  }
  const a = angle * DEG;
  const hauteur = approche + 2 * rayon * Math.sin(a) + entreVirages * Math.cos(a) + sortie;
  const xAxeApproche = largeurTrottoir + h;
  const xAxeSortie = xAxeApproche + 2 * rayon * (1 - Math.cos(a)) + entreVirages * Math.sin(a);
  // Le virage à droite commence en haut de la ligne droite d'approche : son centre est à `rayon` à l'est de l'axe. Le
  // virage à gauche finit en bas de la ligne droite de sortie : son centre est à `rayon` à l'ouest de l'axe.
  const centreDroite = [xAxeApproche + rayon, hauteur - approche];
  const centreGauche = [xAxeSortie - rayon, sortie];

  // Parallèle à l'axe de la chaussée, à `o` m à sa droite pour l'élève qui roule vers le nord (o négatif : à sa
  // gauche), du bas vers le haut, prolongée de LOIN au-delà du monde aux deux bouts. Le virage à droite la porte au
  // rayon (rayon - o), de l'angle polaire 180 à 180 + angle ; le virage à gauche au rayon (rayon + o), de l'angle
  // polaire `angle` à 0 (angles de l'écran, y vers le bas). Chaque appel rend des points neufs.
  const parallele = (o) => [
    [xAxeApproche + o, hauteur + LOIN],
    ...pointsArc(centreDroite[0], centreDroite[1], rayon - o, 180, 180 + angle, pasArc(rayon - o)),
    ...pointsArc(centreGauche[0], centreGauche[1], rayon + o, angle, 0, pasArc(rayon + o)),
    [xAxeSortie + o, -LOIN],
  ];
  // Trottoirs : de la bordure jusqu'à LOIN au-delà du monde. Avec un angle d'au plus 90 degrés, la bordure va toujours
  // vers le nord et vers l'est, sans revenir en arrière : fermé par deux points lointains, le polygone est simple.
  const xLoinEst = xAxeSortie + h + LOIN, xLoinOuest = xAxeApproche - h - LOIN;
  const obstacles = [
    { nature: "trottoir", poly: [...parallele(h), [xLoinEst, -LOIN], [xLoinEst, hauteur + LOIN]] },
    { nature: "trottoir", poly: [...parallele(-h), [xLoinOuest, -LOIN], [xLoinOuest, hauteur + LOIN]] },
  ];
  const voies = {
    droite: [...parallele(0), ...parallele(h).reverse()],    // vers le nord
    gauche: [...parallele(-h), ...parallele(0).reverse()],   // vers le sud
  };

  // Axiale : l'axe de la chaussée, du bord bas au bord haut, tracé à la tortue, porte les traits de la modulation T'1.
  const axe = trajet(xAxeApproche, hauteur, -90).droit(approche).virage(rayon, angle).droit(entreVirages)
    .virage(rayon, -angle).droit(sortie).fin();
  const { trait, vide } = IISR.axialeAgglo;
  const marquages = [];
  for (let k = 0; k * (trait + vide) < axe.longueur - 1e-9; k++) {
    const s0 = k * (trait + vide);
    marquages.push(traitAxial(axe, s0, Math.min(s0 + trait, axe.longueur)));
  }

  /**
   * Trajet de la voie de droite, { chemin, s } comme celui de trajetGiratoire : l'axe de la voie (DESSIN.voie / 2 à
   * droite de l'axe de la chaussée), décalé de `decalage` m vers la droite (négatif : vers l'axe), pour placer la
   * voiture « un peu écartée du bord » ou « à droite de sa voie ». Il part et finit à DESSIN.retraitBord à l'intérieur
   * du monde, cap au nord, et ses arcs suivent la route (suitLaRoute) : y rouler n'est pas changer de direction.
   * s : abscisses du début et de la fin de chaque virage sur ce trajet. Le trajet reste dans la voie : un décalage de
   * DESSIN.voie / 2 ou plus, d'un côté ou de l'autre, est refusé ; tenir la voiture entière dans voies.droite revient
   * à la scène.
   */
  function cheminAxeVoieDroite(decalage = 0) {
    if (!(Number.isFinite(decalage) && Math.abs(decalage) < h / 2)) {
      throw new Error(`routeVirages.cheminAxeVoieDroite : décalage de ${String(decalage)} m : le trajet doit rester dans`
        + ` la voie de droite, à moins de ${h / 2} m de son axe`);
    }
    const o = h / 2 + decalage;
    const t = trajet(xAxeApproche + o, hauteur - retrait, -90).droit(approche - retrait);
    const debutVirageDroite = t.longueur;
    t.virage(rayon - o, angle, { suitLaRoute: true });
    const finVirageDroite = t.longueur;
    t.droit(entreVirages);
    const debutVirageGauche = t.longueur;
    t.virage(rayon + o, -angle, { suitLaRoute: true });
    const finVirageGauche = t.longueur;
    t.droit(sortie - retrait);
    return { chemin: t.fin(), s: { debutVirageDroite, finVirageDroite, debutVirageGauche, finVirageGauche } };
  }

  const reperes = {
    rayon, angle, xAxeApproche, xAxeSortie,
    centres: { virageDroite: centreDroite, virageGauche: centreGauche },
    s: cheminAxeVoieDroite(0).s,
  };
  // Propriété non énumérée : le décor reste une donnée que structuredClone copie, comme tests/scenes.test.mjs le fait
  // de chaque définition de scène, décor compris (une fonction énumérée ferait échouer la copie).
  Object.defineProperty(reperes, "cheminAxeVoieDroite", { value: cheminAxeVoieDroite });
  return {
    monde: { largeur: xAxeSortie + h + largeurTrottoir, hauteur },
    obstacles, marquages, panneaux: [], voies, zones: {}, reperes,
  };
}
