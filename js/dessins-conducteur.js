/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Famille « conducteur » des dessins des cours de compétences (C1.2, « S'installer ») : le conducteur de profil (siège,
 * appuie-tête, volant, ceinture, rétroviseur intérieur) et de face (ceinture) ; dessins du siège, de l'appuie-tête et de la
 * ceinture, juste et faux, et geste animé de l'installation au poste de conduite, dans l'ordre du cours.
 *
 * Vue de profil : on voit le côté gauche du conducteur (celui de la portière), il regarde vers la gauche du dessin. Repère
 * de la voiture, en centimètres : x vers l'avant (depuis le talon au plancher), z au-dessus du plancher, y vers la gauche du
 * conducteur (vers celui qui regarde le dessin). Vue de face : on fait face au conducteur, assis à gauche dans la voiture ;
 * son épaule gauche, d'où part le brin diagonal de la ceinture (montant milieu, côté portière), est à droite du dessin.
 *
 * Deux valeurs viennent du cours : environ 25 cm du sternum au centre du volant ; haut de l'appuie-tête au sommet du crâne,
 * au plus près de la tête (« quelques centimètres au plus », thème 44, D). Tout le reste est choix de dessin (proportions
 * d'un adulte de taille moyenne, voiture courante), avec sa raison dans sources/dessins-conducteur.js.
 */
import { n } from "./dessin-svg.js?v=20261015c";
import { CHARTE, METRIQUES_POLICE, MISE_EN_PAGE, cadre, texte, etiquette, vignette, fleche, arrondir, couper, miroirInterieur, coord,
  point as ecrirePoint, trace, entre } from "./dessins-kit.js?v=20261015c";
import { adoucir, sortieDouce, avancement, interpoler, cles } from "./animation-courbes.js?v=20261015c";

// ===================================================================================================================
// Échelle, valeurs du cours, choix de dessin
// ===================================================================================================================

/** Échelle des dessins de la famille : unités du cadre par centimètre (un cadre de 320 unités couvre 2,67 m). */
export const CM = 1.2;

/** Du sternum au centre du volant, où loge l'airbag (cours : « environ 25 cm »). */
export const STERNUM_VOLANT = 25;
/** De l'arrière de la tête à la face de l'appuie-tête (cours : « au plus près de la tête » ; thème 44 : quelques cm au plus). */
export const ECART_APPUIE_TETE = 2.5;

// Morphologie d'un adulte de taille moyenne, assis (cm). Le buste se décrit dans le repère du dossier réglé : s le long du
// dos (vers le haut), f perpendiculaire (vers l'avant), depuis le point H (articulation de la hanche).
const MORPHO = {
  dos: 13,                 // du point H à la face arrière du buste, perpendiculairement au dossier
  cuisse: 44,              // du point H au genou
  jambe: 43,               // du genou à la cheville
  cheville: 8,             // hauteur de la cheville au-dessus de la semelle
  bras: 31,                // de l'épaule au coude
  avantBras: 26,           // du coude au poignet
  main: 8,                 // du poignet au milieu de la prise
  epauleY: 19,             // demi-écart des épaules (vers la gauche ou la droite du conducteur)
  // Repères du buste (s, f) : épaule (articulation), sternum (milieu, à la surface), dos (omoplates), aisselle, dessus de
  // l'épaule (là où passe le brin diagonal), crête iliaque (ligne des hanches), oreille (place de la tête).
  epaule: [45, -5], sternum: [35, 11.6], dosRepere: [38, -13], aisselle: [37, -4.5], dessusEpaule: [54.4, -2.2],
  hanches: [11, -2], oreille: [66.5, 4.5],
  teteSuit: 0.3,           // part de la rotation du buste que suit la tête (le cou garde le regard horizontal)
};
/** Épaisseurs des membres de profil (rayons, cm) : bras (épaule, coude), avant-bras (coude, poignet). */
export const MEMBRES = Object.freeze({ epaule: 5.0, coude: 4.2, coudeAvant: 4.0, poignet: 2.9 });
// Direction que prend le coude (repère de la voiture : x vers l'avant, y vers l'extérieur du corps, z vers le haut), autour
// de l'axe épaule-poignet : vers le bas et un peu en dehors au repos ; vers l'avant et le bas quand la main va chercher la
// languette derrière l'épaule ; en dehors quand le bras droit s'allonge vers le rétroviseur. Le geste passe de l'une à
// l'autre par des clés dans le temps (adoucir) : le coude ne dépend jamais d'un seuil sur la place de la main.
const COUDE = { bas: [0, 0.45, -1], avantBas: [0.75, 0.35, -0.55], dehors: [0.1, 0.9, -0.4] };

// Contour du buste (s, f, poids) : le poids dit quelle part de la rotation du buste suit le point (0 : le bassin, posé sur
// l'assise ; 1 : le haut du corps, contre le dossier). Les points du dos, de 42 à -4, sont sur la face du dossier (f = -dos).
const TORSE = [
  [-2, 10.5, 0], [6, 12.6, 0.15], [16, 13.1, 0.45], [26, 12.3, 0.8], [35, 11.6, 1], [42, 10.3, 1], [47.5, 7.8, 1],
  [51.8, 4.0, 1], [54.4, -1.2, 1], [53.6, -7.4, 1], [49.6, -11.7, 1], [42, -13, 1], [28, -13, 1], [16, -13, 0.6],
  [5, -13, 0.25], [-4, -13, 0], [-6.4, -12, 0], [-7.6, -8, 0], [-8.4, -2, 0], [-8.6, 4, 0],
];

// Tête de profil, dans son repère (cm, origine au conduit de l'oreille, x vers l'avant, z vers le haut) : silhouette sans
// détail du visage (front, nez, menton), cheveux du front à la nuque, oreille.
const TETE = [
  [0.6, 12.6], [6.4, 10.6], [9.5, 6.4], [10.3, 3.2], [10.1, 1.6], [12.0, -1.6], [10.3, -3.1], [10.5, -5.0], [10.0, -8.4],
  [7.6, -10.5], [2.4, -9.0], [-1.2, -6.4], [-5.6, -5.2], [-9.0, -1.0], [-9.8, 3.4], [-7.2, 9.6],
];
const TETE_NUQUE = 12, TETE_FRONT = 2;     // indices des points du contour où s'arrêtent les cheveux
const LISIERE = [[7.4, 6.6], [3.6, 5.2], [0.4, 4.2], [-2.6, 2.6], [-4.4, -1.2]];   // lisière des cheveux, du front à la nuque
const OREILLE = { centre: [-0.6, 0.6], demiLargeur: 1.6, demiHauteur: 2.9, points: 12 };
// Cou : sous le menton et sous la nuque (repère de la tête), naissance devant et derrière (repère du buste), et un point de
// la tête qui l'arrondit derrière la mâchoire.
const COU = { menton: [3.0, -9.6], nuque: [-5.6, -5.2], devant: [51.6, 4.6], derriere: [53.4, -7.6], machoire: [-1.5, -2.0] };

// Cuisse, jambe, pied (cm). La cuisse se décrit dans son repère (u le long de la cuisse depuis le point H, v au-dessus) :
// elle se pose sur l'assise, qui monte vers l'avant ; la jambe va du genou à la cheville, posée au-dessus du plancher.
const ANGLE_ASSISE = 10;
const CUISSE = { dessous: -8.5, dessusRacine: 8.6, dessusGenou: 6.4, genou: 5.6, arriere: -10, hanche: -9, rotule: 2.4, creux: -5.6,
  avantGenou: 1, rotuleHaut: 1.6, dessousRacine: 3 };
const MOLLET = { genou: 6.0, mollet: 6.2, cheville: 4.0, partMollet: 0.3, partTibia: 0.45, dessusGenou: 1.4, hautGenou: 2,
  avantCheville: 3, hautTibia: 1, rondGenou: 4.5 };
const CHAUSSURE = { talon: 5.5, pointe: 21, semelle: 2.2, cou: 9.5, bout: 3.4, retraitBout: 2, coudePied: 4, retraitCou: 0.5,
  retraitSemelle: 0.5, arrondi: 2.2, arrondiSemelle: 1 };

// Siège (cm). Assise sous la cuisse ; dossier qui pivote autour du point H (son articulation est à hauteur de la hanche : le
// dos reste contre lui pendant le réglage) ; appuie-tête sur deux tiges qui coulissent dans le haut du dossier ; base qui
// glisse sur le rail du plancher.
const SIEGE = {
  assise: { arriere: -17, avant: 31, epaisseur: 11, arrondi: 5 },
  dossier: { bas: -9, haut: 58, epaisseur: 9.5, arrondi: 4.5 },
  // Appuie-tête : coussin de 18 cm sur 9, tiges inclinées de 12 degrés vers l'avant par rapport au dossier (le coussin
  // vient près de la tête), enfoncées de 6 cm dans le dossier en position basse.
  appuieTete: { hauteur: 18, epaisseur: 9, arrondi: 3.2, tige: 1.4, enfoncement: 6, recouvrement: 1, versAvant: 12 },
  base: { avant: 22, arriere: -12, glissiere: 3, patin: 2.6, arrondi: 1.5 },
  rail: { avant: 34, arriere: -30, hauteur: 1.6, arrondi: 0.8 },
};
// Point H du siège tout avancé et tout bas (repère de la voiture).
const POINT_H_AVANCE = [-66, 24];

/** Siège réglé : recul (cm, sur le rail), hauteur (cm), dossier (degrés depuis la verticale). */
export const SIEGE_REGLE = Object.freeze({ recul: 14, hauteur: 4, dossier: 20 });
// Siège avant réglage (geste) : tout avancé, tout bas, dossier trop incliné.
const SIEGE_DEPART = Object.freeze({ recul: 0, hauteur: 0, dossier: 26 });
// Faux du siège : 12 cm plus reculé que le juste, buste penché de 22 degrés pour atteindre le volant.
const RECUL_TROP = 12, PENCHE = 22;

// Volant (cm, degrés). Le pied de colonne est fixe dans la planche de bord ; la colonne se règle en inclinaison et en
// longueur. Sa place est tirée du conducteur installé : centre à 25 cm du sternum, 11 degrés sous l'horizontale une fois
// réglé (colonne de 30 cm inclinée de 24 degrés), 6 degrés au-dessus avant réglage (volant trop haut).
export const VOLANT = Object.freeze({ rayon: 18.5, jante: 3.2, moyeu: 6.5, saillieMoyeu: 2.6, colonne: 5.2, arrondiMoyeu: 1.6 });
const VOLANT_SOUS_STERNUM = { regle: 11, depart: -6 };
const COLONNE_REGLEE = { inclinaison: 24, longueur: 30 };

// Ceinture (cm). Renvoi (haut du brin diagonal) sur le montant milieu, placé derrière et au-dessus de l'épaule du conducteur
// installé ; ancrage bas sur le siège (repère du point H) ; boucle sur le siège, du côté droit du conducteur : de profil,
// elle est cachée par la cuisse et la hanche proches, et la sangle bouclée tourne à l'avant de la hanche ; sangle de 4,8 cm ;
// languette ; place de la languette au repos le long de la sangle (part du chemin du renvoi à l'ancrage).
const CEINTURE = {
  sangle: 4.8, renvoiDerriere: 21, renvoiDessus: 9, ancrage: [-13, -9], boucle: [8, 4.5],
  languette: { longueur: 5.5, largeur: 2.6 }, boitier: { longueur: 6, largeur: 3.4 }, renvoi: { longueur: 6.5, largeur: 3.2 },
  rangee: 0.3,
  // Points de passage, bouclée : sur le dessus de l'épaule, sur la poitrine, devant le ventre (repère du buste, avec poids) ;
  // sur le côté de la hanche (cm, depuis le point H).
  epaule: [54.2, -3.2, 1], poitrine: [40.5, 8.4, 1], ventre: [20, 13.6, 0.6], coteHanche: [-2, 1.5],
  // Pendant le geste, la sangle se pose sur le corps point par point (parts de l'avancement, du début à la fin de la pose) :
  // épaule, poitrine, ventre ; puis côté de la hanche.
  poseDiagonal: [[0.1, 0.45], [0.3, 0.75], [0.5, 0.95]], poseVentral: [[0.65, 1]],
};

// Teintes (illustration à plat, deux ou trois tons par matière ; une seule peau, celle de la charte).
const TEINTES = {
  pull: "#B9C0B4", pullOmbre: "#9FA79A", pullClair: "#CDD3C8",
  pantalon: "#7A7266", pantalonOmbre: "#665F55",
  chaussure: "#3B3633", semelle: "#2A2624",
  cheveux: "#3F3833",
  siege: "#545B56", siegeOmbre: "#454B47", siegeClair: "#636A65",
  metal: "#9AA29C", metalOmbre: "#7C847E",
  volant: "#2F3532", moyeu: "#3D4440", colonne: "#4A514D",
  sangle: "#2E3430", boucle: "#8E9690",
  plancher: "#C7CEC2", tableau: "#C9CFC4", montant: "#CDD3C8",
  cote: CHARTE.texteDoux, guide: CHARTE.accentFort,
};
// Teintes de l'objet dont parle le cours (le vert de la charte) : siège, appuie-tête, ceinture.
const ACCENT = { base: CHARTE.accent, ombre: CHARTE.accentFort, clair: "#7E9163" };
const NEUTRE_SIEGE = { base: TEINTES.siege, ombre: TEINTES.siegeOmbre, clair: TEINTES.siegeClair };
// Contour qui sépare l'avant-bras proche du bras proche (même teinte) quand il passe dessus.
const CONTOUR_AVANT_BRAS = { couleur: TEINTES.pullOmbre, epaisseur: CHARTE.traits.fin };
// Contour du dossier quand le coussin de l'appuie-tête a sa teinte (geste sans accent) : teinte d'ombre du siège.
const CONTOUR_DOSSIER = { epaisseur: CHARTE.traits.fin };
// Petits boîtiers (renvoi, boucle, languette, ancrage) : arrondi de leurs coins, en part de leur petit côté.
const ARRONDI_BOITIER = 0.25;

// ===================================================================================================================
// Géométrie plane
// ===================================================================================================================

const RAD = Math.PI / 180;
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const moins = (a, b) => [a[0] - b[0], a[1] - b[1]];
const fois = (a, k) => [a[0] * k, a[1] * k];
const norme = (a) => Math.hypot(a[0], a[1]);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const unitaire = (a) => fois(a, 1 / norme(a));
const scalaire = (a, b) => a[0] * b[0] + a[1] * b[1];
const tourner = ([x, y], angle) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
const direction = (degres) => [Math.cos(degres * RAD), Math.sin(degres * RAD)];
const MILIEU = 0.5;

// Spline de Catmull-Rom centripète en segments de Bézier cubiques [départ, contrôle, contrôle, arrivée] : la courbe passe
// par chaque point, sans boucle ; fermée, elle revient au premier point ; ouverte, ses bouts se prolongent en ligne droite.
function spline(points, ferme) {
  const m = points.length;
  const p = (i) => {
    if (ferme) return points[((i % m) + m) % m];
    if (i < 0) return plus(points[0], moins(points[0], points[1]));
    if (i >= m) return plus(points[m - 1], moins(points[m - 1], points[m - 2]));
    return points[i];
  };
  const segments = [];
  for (let i = 0; i < (ferme ? m : m - 1); i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const [l1, l2, l3] = [dist(p0, p1), dist(p1, p2), dist(p2, p3)];
    const [r1, r2, r3] = [Math.sqrt(l1), Math.sqrt(l2), Math.sqrt(l3)];
    const b1 = [0, 1].map((k) => (l1 * p2[k] - l2 * p0[k] + (2 * l1 + 3 * r1 * r2 + l2) * p1[k]) / (3 * r1 * (r1 + r2)));
    const b2 = [0, 1].map((k) => (l3 * p1[k] - l2 * p3[k] + (2 * l3 + 3 * r3 * r2 + l2) * p2[k]) / (3 * r3 * (r3 + r2)));
    segments.push([p1, b1, b2, p2]);
  }
  return segments;
}
const traceSegments = (segments, ferme = true) => `M${ecrirePoint(segments[0][0])} ${segments.map((s) => `C${ecrirePoint(s[1])} ${ecrirePoint(s[2])} ${ecrirePoint(s[3])}`).join(" ")}${ferme ? " Z" : ""}`;
const courbe = (points, ferme = true) => traceSegments(spline(points, ferme), ferme);
const bezier = (s, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * s[0][k] + 3 * u * u * t * s[1][k] + 3 * u * t * t * s[2][k] + t * t * t * s[3][k]);
};
// Points d'une suite de segments, `pas` par segment, départ compris.
function echantillons(segments, pas) {
  const r = [segments[0][0]];
  for (const s of segments) for (let k = 1; k <= pas; k++) r.push(bezier(s, k / pas));
  return r;
}
// Point le plus haut (y le plus petit, repère du cadre) d'une suite de segments cubiques, exact : extrémités et zéros de la
// dérivée de y.
function plusHautCubique(segments) {
  let meilleur = segments[0][0];
  for (const s of segments) {
    const [y0, y1, y2, y3] = s.map((p) => p[1]);
    const a = -y0 + 3 * y1 - 3 * y2 + y3, b = 2 * (y0 - 2 * y1 + y2), c = y1 - y0;
    const racines = [];
    if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) racines.push(-c / b); }
    else {
      const delta = b * b - 4 * a * c;
      if (delta >= 0) racines.push((-b + Math.sqrt(delta)) / (2 * a), (-b - Math.sqrt(delta)) / (2 * a));
    }
    for (const t of [1, ...racines.filter((r) => r > 0 && r < 1)]) {
      const p = bezier(s, t);
      if (p[1] < meilleur[1]) meilleur = p;
    }
  }
  return meilleur;
}

// Polygones : le tracé de points (segments seuls), `trace` du kit ; coins arrondis par `arrondir` du kit, un même rayon à chaque
// coin ; le point le plus haut d'une liste (y le plus petit).
const pointsArrondis = (sommets, rayon) => arrondir(sommets, sommets.map(() => rayon));
const formeArrondie = (sommets, rayon) => trace(pointsArrondis(sommets, rayon));
const plusHautPoints = (points) => points.reduce((m, p) => (p[1] < m[1] ? p : m));

// Membre en forme de gélule : enveloppe de deux disques (rayons r1 et r2), arcs exacts. Coordonnées du cadre.
function gelule(p1, r1, p2, r2) {
  const d = Math.max(dist(p1, p2), 1e-6);
  const u = fois(moins(p2, p1), 1 / d), v = [-u[1], u[0]];
  const sb = Math.max(-1, Math.min(1, (r1 - r2) / d)), cb = Math.sqrt(1 - sb * sb);
  const nA = plus(fois(u, sb), fois(v, cb)), nB = plus(fois(u, sb), fois(v, -cb));
  const a1 = plus(p1, fois(nA, r1)), a2 = plus(p2, fois(nA, r2)), b2 = plus(p2, fois(nB, r2)), b1 = plus(p1, fois(nB, r1));
  const vectoriel = (a, b) => a[0] * b[1] - a[1] * b[0];
  const sens2 = vectoriel(moins(a2, p2), u) > 0 ? 1 : 0, sens1 = vectoriel(moins(b1, p1), fois(u, -1)) > 0 ? 1 : 0;
  return `M${ecrirePoint(a1)} L${ecrirePoint(a2)} A${coord(r2)} ${coord(r2)} 0 ${sb < 0 ? 1 : 0} ${sens2} ${ecrirePoint(b2)} `
    + `L${ecrirePoint(b1)} A${coord(r1)} ${coord(r1)} 0 ${sb > 0 ? 1 : 0} ${sens1} ${ecrirePoint(a1)} Z`;
}

// Ruban d'une largeur donnée le long d'une courbe lisse (la sangle) : contour fermé fait de ses deux bords échantillonnés.
// (À ne pas confondre avec `bande` du kit, qui découpe un polygone entre deux droites.)
const PAS_RUBAN = 8;
function ruban(points, largeur) {
  const centre = echantillons(spline(points, false), PAS_RUBAN);
  const normales = centre.map((p, i) => {
    const a = centre[Math.max(0, i - 1)], b = centre[Math.min(centre.length - 1, i + 1)];
    const t = unitaire(moins(b, a));
    return [-t[1], t[0]];
  });
  const bordA = centre.map((p, i) => plus(p, fois(normales[i], largeur / 2)));
  const bordB = centre.map((p, i) => plus(p, fois(normales[i], -largeur / 2)));
  return { centre, bordA, bordB, d: trace([...bordA, ...[...bordB].reverse()]) };
}
const listePoints = (points) => points.map(([x, y]) => `${coord(x)},${coord(y)}`).join(" ");
// Bord haut d'un ruban : celui de ses deux bords qui est le plus haut dans le cadre.
const bordHaut = (r) => (r.bordA.reduce((s, p) => s + p[1], 0) < r.bordB.reduce((s, p) => s + p[1], 0) ? r.bordA : r.bordB);

// Petit boîtier (renvoi, boucle, languette, ancrage) : rectangle centré sur `centre` (repère de la vue), coins arrondis.
const boitier = (P, centre, longueur, largeur, teinte, attributs = {}) => {
  const [x, y] = P(centre);
  return n("rect", { x: x - longueur * CM / 2, y: y - largeur * CM / 2, width: longueur * CM, height: largeur * CM,
    rx: Math.min(longueur, largeur) * CM * ARRONDI_BOITIER, fill: teinte, ...attributs });
};

// Bras en trois dimensions (repère de la voiture, cm) : coude à l'intersection des deux sphères (bras, avant-bras), du côté
// que donne sa consigne (y vers l'extérieur du corps, d'où le facteur `cote` : +1 à gauche, -1 à droite).
const plus3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const moins3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const fois3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const scal3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norme3 = (a) => Math.sqrt(scal3(a, a));
function coude(epaule, poignet, cote, [cx, cy, cz]) {
  const { bras, avantBras } = MORPHO;
  const v = moins3(poignet, epaule);
  const d = Math.min(Math.max(norme3(v), Math.abs(bras - avantBras) + 1e-6), bras + avantBras - 1e-6);
  const u = fois3(v, 1 / norme3(v));
  const a = (bras * bras - avantBras * avantBras + d * d) / (2 * d), h = Math.sqrt(Math.max(0, bras * bras - a * a));
  const consigne = [cx, cote * cy, cz];
  const w = moins3(consigne, fois3(u, scal3(consigne, u)));
  return plus3(plus3(epaule, fois3(u, a)), fois3(w, h / (norme3(w) || 1)));
}

const repere = (role, [x, y], plusAttributs = {}) => n("g", { "data-r": role, "data-x": Number(x.toFixed(3)), "data-y": Number(y.toFixed(3)), ...plusAttributs });
// Un nombre écrit au millième ; un segment [a, b] porté par un rôle (data-x1, data-y1, data-x2, data-y2).
const ecrit = (v) => Number(v.toFixed(3));
const segmentRole = (role, [a, b]) => ({ "data-r": role, "data-x1": ecrit(a[0]), "data-y1": ecrit(a[1]), "data-x2": ecrit(b[0]), "data-y2": ecrit(b[1]) });
const affiche = (opacite) => ({ display: opacite > 0 ? "inline" : "none", opacity: Number(Math.min(1, Math.max(0, opacite)).toFixed(3)) });

// Identifiants des découpes (clip-path) : un numéro par montage, pour que deux montages du même dessin dans une page ne se
// les disputent pas (comme js/scene-moteur.js).
let montages = 0;
const nouvelId = (nom) => `conducteur-${nom}-${++montages}`;

// ===================================================================================================================
// Le conducteur de profil : pose
// ===================================================================================================================

const angleDe = (degres) => degres * RAD;
// Repère du dossier pour une inclinaison : a le long du dos (vers le haut), f vers l'avant.
const axesDossier = (degres) => {
  const t = angleDe(degres);
  return { a: [-Math.sin(t), Math.cos(t)], f: [Math.cos(t), Math.sin(t)] };
};
const pointH = ({ recul, hauteur }) => [POINT_H_AVANCE[0] - recul, POINT_H_AVANCE[1] + hauteur];

// Le buste se décrit dans la pose de référence (dossier réglé, dos contre lui) ; un point tourne autour du point H d'une
// part (son poids) de l'écart entre l'angle du haut du corps et celui de la référence.
function corpsDe(H, dossier, penche) {
  const ref = axesDossier(SIEGE_REGLE.dossier);
  const rotation = angleDe(dossier - penche - SIEGE_REGLE.dossier);
  return ([s, f, w = 1]) => plus(H, tourner(plus(fois(ref.a, s), fois(ref.f, f)), w * rotation));
}
const STERNUM_REGLE = corpsDe(pointH(SIEGE_REGLE), SIEGE_REGLE.dossier, 0)(MORPHO.sternum);
const EPAULE_REGLEE = corpsDe(pointH(SIEGE_REGLE), SIEGE_REGLE.dossier, 0)(MORPHO.dessusEpaule);

// Volant : pied de colonne fixe, centre au bout de la colonne. Réglé, son centre est à 25 cm du sternum du conducteur
// installé, 11 degrés sous l'horizontale ; avant réglage, à 25 cm aussi, 6 degrés au-dessus.
const centreVoulu = (sousSternum) => plus(STERNUM_REGLE, fois(direction(-sousSternum), STERNUM_VOLANT));
const PIED_COLONNE = plus(centreVoulu(VOLANT_SOUS_STERNUM.regle), fois(direction(-COLONNE_REGLEE.inclinaison), COLONNE_REGLEE.longueur));
// Réglage (inclinaison de la colonne, degrés sous l'horizontale ; longueur, cm) qui met le centre du volant en `centre`.
const reglageVolant = (centre) => ({
  inclinaison: Math.atan2(centre[1] - PIED_COLONNE[1], PIED_COLONNE[0] - centre[0]) / RAD,
  longueur: dist(centre, PIED_COLONNE),
});
/** Volant réglé (étape 3 finie) ; volant avant réglage. */
export const VOLANT_REGLE = Object.freeze(reglageVolant(centreVoulu(VOLANT_SOUS_STERNUM.regle)));
const VOLANT_DEPART = Object.freeze(reglageVolant(centreVoulu(VOLANT_SOUS_STERNUM.depart)));
/** Géométrie du volant de profil (repère de la voiture) : centre, axe de la colonne (du centre vers son pied, vers l'avant et
 *  le bas), et direction du haut de la jante dans son plan. Le plan de la jante contient l'axe y (la largeur de la voiture). */
export function geometrieVolant({ inclinaison, longueur }) {
  const axe = direction(-inclinaison);
  const centre = moins(PIED_COLONNE, fois(axe, longueur));
  const haut = [-axe[1], axe[0]];
  return { centre, axe, haut: haut[1] > 0 ? haut : fois(haut, -1) };
}

// Renvoi de la ceinture (repère de la voiture), derrière et au-dessus de l'épaule du conducteur installé.
const RENVOI = [EPAULE_REGLEE[0] - CEINTURE.renvoiDerriere, EPAULE_REGLEE[1] + CEINTURE.renvoiDessus];

// Appuie-tête : les tiges sortent du haut du dossier à la place `avanceTiges` (f, repère du dossier), inclinées de versAvant
// degrés vers l'avant par rapport au dossier ; le coussin, face avant parallèle aux tiges, coulisse avec elles (`sortie`, cm).
function appuieTeteDe(surDossier, dossier, sortie, avanceTiges) {
  const AT = SIEGE.appuieTete;
  const { a, f } = axesDossier(dossier);
  const v = AT.versAvant * RAD;
  const d = plus(fois(a, Math.cos(v)), fois(f, Math.sin(v)));            // le long des tiges, vers le haut
  const av = [d[1], -d[0]][0] > 0 ? [d[1], -d[0]] : [-d[1], d[0]];        // perpendiculaire, vers l'avant
  const pied = surDossier(SIEGE.dossier.haut, avanceTiges);
  const sur = (le, de) => plus(pied, plus(fois(d, le), fois(av, de)));
  const bas = sortie - AT.enfoncement;
  const coussinAT = [[bas, AT.epaisseur / 2], [bas + AT.hauteur, AT.epaisseur / 2], [bas + AT.hauteur, -AT.epaisseur / 2], [bas, -AT.epaisseur / 2]].map(([le, de]) => sur(le, de));
  const tigeAT = [[bas + AT.recouvrement, AT.tige / 2], [bas + AT.recouvrement, -AT.tige / 2], [-AT.enfoncement, -AT.tige / 2], [-AT.enfoncement, AT.tige / 2]].map(([le, de]) => sur(le, de));
  return { coussinAT, tigeAT, faceATDir: d, faceATAvant: av };
}

// Place des tiges de l'appuie-tête (f, repère du dossier), calculée une fois : la face du coussin passe à ECART_APPUIE_TETE
// de l'arrière de la tête du conducteur installé, dos contre le dossier (le point du contour de la tête le moins avancé
// perpendiculairement à la face).
const PAS_CONTOUR_TETE = 48;
const AVANCE_TIGES = (() => {
  const H = pointH(SIEGE_REGLE);
  const oreille = corpsDe(H, SIEGE_REGLE.dossier, 0)(MORPHO.oreille);
  const { a, f } = axesDossier(SIEGE_REGLE.dossier);
  const surDossier = (s, d) => plus(H, plus(fois(a, s), fois(f, d)));
  const zero = appuieTeteDe(surDossier, SIEGE_REGLE.dossier, 0, 0);
  const av = zero.faceATAvant;
  const contour = echantillons(spline(TETE.map((p) => plus(oreille, p)), true), PAS_CONTOUR_TETE);
  const arriere = Math.min(...contour.map((p) => scalaire(p, av)));
  const face0 = scalaire(zero.coussinAT[0], av);                       // face avant du coussin, tiges en f = 0
  // Déplacer les tiges de 1 selon f avance la face de f·av.
  return (arriere - ECART_APPUIE_TETE - face0) / scalaire(f, av);
})();

// Ce qui ne dépend pas des mains : siège, corps, tête, jambes, appuie-tête. Repère de la voiture.
function poseCorps({ siege = SIEGE_REGLE, sortieAT = 0, dosColle = true }) {
  const H = pointH(siege);
  const penche = dosColle ? 0 : PENCHE;
  const corps = corpsDe(H, siege.dossier, penche);
  const { a, f } = axesDossier(siege.dossier);
  const surDossier = (s, d) => plus(H, plus(fois(a, s), fois(f, d)));
  const rotationBuste = angleDe(siege.dossier - penche - SIEGE_REGLE.dossier);
  const oreille = corps(MORPHO.oreille);
  const rotationTete = MORPHO.teteSuit * rotationBuste;
  const tete = (p) => plus(oreille, tourner(p, rotationTete));
  const t = direction(ANGLE_ASSISE), nt = [-t[1], t[0]];
  const cuisse = (u, v) => plus(H, plus(fois(t, u), fois(nt, v)));
  const genou = cuisse(MORPHO.cuisse, 0);
  const cheville = [genou[0] + Math.sqrt(MORPHO.jambe ** 2 - (genou[1] - MORPHO.cheville) ** 2), MORPHO.cheville];
  const at = appuieTeteDe(surDossier, siege.dossier, sortieAT, AVANCE_TIGES);
  return { H, a, f, corps, surDossier, oreille, tete, cuisse, t, nt, genou, cheville, siege, penche, ...at };
}

// Sortie de l'appuie-tête (cm, le long des tiges) qui met le haut de son coussin au niveau voulu : « sommet » (sommet du
// crâne) ou « nuque », pour ce siège, dos contre le dossier ; un nombre est la sortie même. Le coussin monte le long des
// tiges : son point le plus haut (coins arrondis compris) s'élève de la composante verticale de leur direction par cm.
function sortieAppuieTete(siege, hauteur) {
  if (typeof hauteur === "number") return hauteur;
  const geo = poseCorps({ siege, sortieAT: 0, dosColle: true });
  const versHaut = ([x, z]) => [x, -z];                        // le plus haut devient le plus petit y
  const sommet = -plusHautCubique(spline(TETE.map(geo.tete), true).map((s) => s.map(versHaut)))[1];
  const nuque = geo.tete(TETE[TETE_NUQUE])[1];
  const haut = -plusHautPoints(pointsArrondis(geo.coussinAT.map(versHaut), SIEGE.appuieTete.arrondi))[1];
  const cible = hauteur === "nuque" ? nuque : sommet;
  return (cible - haut) / geo.faceATDir[1];
}

// --- Mains : { x, y, z } (cm, repère de la voiture), angle (degrés, axe de la main de profil), prise (0 : ouverte, 1 :
// refermée sur la jante, la sangle ou le rétroviseur), coude (consigne de direction du coude, COUDE.bas si absente).
const ANGLE_MAIN_VOLANT = -8;
function mainsSurVolant(volant) {
  const { centre } = geometrieVolant(volant);
  return {
    gauche: { x: centre[0], y: VOLANT.rayon, z: centre[1], angle: ANGLE_MAIN_VOLANT, prise: 1 },
    droite: { x: centre[0], y: -VOLANT.rayon, z: centre[1], angle: ANGLE_MAIN_VOLANT, prise: 1 },
  };
}
// Main posée à plat sur la cuisse, près de la hanche : en arrière du plan du volant, et en dehors de sa jante.
const MAIN_CUISSE = { part: 0.3, dessus: 1.8, y: 14 };
function mainSurCuisse(geo, cote) {
  const p = geo.cuisse(MAIN_CUISSE.part * MORPHO.cuisse, CUISSE.dessusRacine + MAIN_CUISSE.dessus);
  return { x: p[0], y: cote * MAIN_CUISSE.y, z: p[1], angle: ANGLE_ASSISE, prise: 0 };
}

// ===================================================================================================================
// Le conducteur de profil : dessin
// ===================================================================================================================

// Main de profil, dans son repère (cm : u le long de la main depuis le poignet, v de côté) : poing fermé et main ouverte ont
// le même nombre de points, la prise passe de l'un à l'autre.
const MAIN_POING = [[0, 3.2], [3.6, 4.4], [7.4, 4.6], [10.6, 3.2], [11.4, 0], [10.4, -3.0], [7.0, -4.2], [3.2, -3.8], [0, -3.0]];
const MAIN_OUVERTE = [[0, 2.6], [5.0, 2.8], [11.0, 2.4], [16.4, 1.2], [17.6, 0], [16.4, -1.0], [11.0, -2.0], [5.0, -2.6], [0, -2.6]];
const POUCE = { poing: [[3.0, 4.0], [6.2, 6.0], [8.6, 5.6], [8.0, 4.0]], ouverte: [[2.6, 2.4], [6.0, 3.8], [9.0, 3.4], [8.4, 2.2]] };

// État de la ceinture de profil : { avancement (0 rangée, 1 bouclée), languette (opacité de la languette tenue en main) }.
function etatCeinture(ceinture) {
  if (ceinture === false) return null;
  if (ceinture === true) return { avancement: 1, languette: 0 };
  if (typeof ceinture === "number") return { avancement: ceinture, languette: 1 };
  return ceinture;
}

/**
 * Le conducteur de profil, son siège et son volant, à l'échelle CM. `x`, `y` : place dans le cadre du repère de la voiture
 * (le plancher, au talon). `siege` : { recul, hauteur, dossier } ; `appuieTete` : { hauteur } (« sommet », « nuque », ou la
 * sortie des tiges en cm) ; `dosColle` : dos contre le dossier, sinon buste penché de PENCHE degrés ; `ceinture` : false
 * (rangée, non dessinée), true (bouclée), l'avancement du geste qui la boucle (0 à 1, la languette dans la main gauche) ou
 * { avancement, languette } ; `mainsVolant` : mains à 9 h et 3 h, sinon posées sur les cuisses ; `mains` : place des mains,
 * qui l'emporte ; `volant` : { inclinaison, longueur } ; `accent` : la partie dont parle le cours, en vert (« siege »,
 * « appuie-tete », « ceinture »). Rend { noeud, reperes, geo, P } ; chaque repère est aussi un rôle du nœud (data-x, data-y,
 * unités du cadre), de même que les articulations des bras (épaule, coude, poignet, main, de chaque côté).
 */
export function conducteurProfil({ x = 0, y = 0, siege = SIEGE_REGLE, appuieTete = { hauteur: "sommet" }, dosColle = true,
  ceinture = false, mainsVolant = true, mains = null, volant = VOLANT_REGLE, accent = null } = {}) {
  const origine = [x, y];
  const P = ([px, pz]) => [origine[0] - px * CM, origine[1] - pz * CM];
  const PS = (segments) => segments.map((s) => s.map(P));
  const geo = poseCorps({ siege, sortieAT: sortieAppuieTete(siege, appuieTete.hauteur), dosColle });
  const lesMains = mains || (mainsVolant ? mainsSurVolant(volant) : { gauche: mainSurCuisse(geo, 1), droite: mainSurCuisse(geo, -1) });
  const vol = geometrieVolant(volant);
  const teinteSiege = accent === "siege" ? ACCENT : NEUTRE_SIEGE;
  const teinteAT = accent === "appuie-tete" ? ACCENT : NEUTRE_SIEGE;
  const S = SIEGE, H = geo.H;

  // --- Siège : patin et base (glissent sur le rail), assise, dossier, tiges et coussin de l'appuie-tête.
  const dessousAssise = (u) => geo.cuisse(u, CUISSE.dessous - S.assise.epaisseur);
  const hautPatin = S.rail.hauteur + S.base.patin;
  const base = formeArrondie([dessousAssise(S.base.arriere), dessousAssise(S.base.avant), [H[0] + S.base.avant, hautPatin], [H[0] + S.base.arriere, hautPatin]].map(P), S.base.arrondi * CM);
  const patin = formeArrondie([[H[0] + S.base.arriere - S.base.glissiere, hautPatin], [H[0] + S.base.avant + S.base.glissiere, hautPatin],
    [H[0] + S.base.avant + S.base.glissiere, S.rail.hauteur], [H[0] + S.base.arriere - S.base.glissiere, S.rail.hauteur]].map(P), S.base.arrondi * CM);
  const assise = formeArrondie([geo.cuisse(S.assise.arriere, CUISSE.dessous), geo.cuisse(S.assise.avant, CUISSE.dessous),
    geo.cuisse(S.assise.avant, CUISSE.dessous - S.assise.epaisseur), geo.cuisse(S.assise.arriere, CUISSE.dessous - S.assise.epaisseur)].map(P), S.assise.arrondi * CM);
  const faceDossier = -MORPHO.dos;
  const dossier = formeArrondie([geo.surDossier(S.dossier.bas, faceDossier), geo.surDossier(S.dossier.haut, faceDossier),
    geo.surDossier(S.dossier.haut, faceDossier - S.dossier.epaisseur), geo.surDossier(S.dossier.bas, faceDossier - S.dossier.epaisseur)].map(P), S.dossier.arrondi * CM);
  const AT = S.appuieTete;
  const tige = formeArrondie(geo.tigeAT.map(P), AT.tige / 2 * CM);
  const coussin = pointsArrondis(geo.coussinAT.map(P), AT.arrondi * CM);

  // --- Corps : buste, tête (cheveux, oreille), cou ; cuisse, jambe, pied.
  const torse = PS(spline(TORSE.map(geo.corps), true));
  const teteSeg = PS(spline(TETE.map(geo.tete), true));
  // Cheveux : le contour de la tête de la nuque au front (les mêmes segments), puis la lisière, du front à la nuque.
  const lisiere = PS(spline([TETE[TETE_FRONT], ...LISIERE, TETE[TETE_NUQUE]].map(geo.tete), false));
  const cheveux = `${traceSegments([...teteSeg.slice(TETE_NUQUE), ...teteSeg.slice(0, TETE_FRONT), ...lisiere], false)} Z`;
  const oreille = Array.from({ length: OREILLE.points }, (_, i) => {
    const angle = (i / OREILLE.points) * 2 * Math.PI;
    return P(geo.tete(plus(OREILLE.centre, [OREILLE.demiLargeur * Math.cos(angle), OREILLE.demiHauteur * Math.sin(angle)])));
  });
  const cou = [geo.tete(COU.menton), geo.corps(COU.devant), geo.corps(COU.derriere), geo.tete(COU.nuque), geo.tete(COU.machoire)].map(P);
  const C = geo.cuisse, Lc = MORPHO.cuisse, Q = CUISSE;
  const cuisse = [C(Q.arriere, -Q.rotule), C(-Q.rotule, Q.dessusRacine), C(Lc * MILIEU, (Q.dessusRacine + Q.dessusGenou) * MILIEU),
    C(Lc - Q.avantGenou, Q.dessusGenou), C(Lc + Q.genou, Q.rotuleHaut), C(Lc + Q.rotule, Q.creux), C(Lc * MILIEU, Q.dessous),
    C(Q.hanche + Q.dessousRacine, Q.dessous), C(Q.arriere, Q.dessous * MILIEU)].map(P);
  const axeJambe = unitaire(moins(geo.cheville, geo.genou));
  const arriereJambe = axeJambe[1] < 0 ? [axeJambe[1], -axeJambe[0]] : [-axeJambe[1], axeJambe[0]];   // vers l'arrière (le mollet)
  const J = (u, v) => plus(geo.genou, plus(fois(axeJambe, u), fois(arriereJambe, v)));
  const Lj = MORPHO.jambe, M = MOLLET;
  const jambe = [J(-M.hautGenou, M.genou), J(Lj * M.partMollet, M.mollet), J(Lj - M.avantCheville, M.cheville), J(Lj, 0),
    J(Lj - M.avantCheville, -M.cheville), J(Lj * M.partTibia, -(M.genou - M.dessusGenou)), J(-M.hautTibia, -M.genou), J(-M.rondGenou, 0)].map(P);
  const ch = geo.cheville, K = CHAUSSURE;
  const pied = formeArrondie([[ch[0] - K.talon, 0], [ch[0] + K.pointe, 0], [ch[0] + K.pointe - K.retraitBout, K.semelle + K.bout],
    [ch[0] + K.coudePied, K.cou], [ch[0] - K.talon + K.retraitCou, K.cou]].map(P), K.arrondi * CM);
  const semelle = formeArrondie([[ch[0] - K.talon, 0], [ch[0] + K.pointe, 0], [ch[0] + K.pointe - K.retraitSemelle, K.semelle], [ch[0] - K.talon, K.semelle]].map(P), K.arrondiSemelle * CM);

  // --- Bras : coude placé en trois dimensions selon sa consigne, projeté de profil ; main au bout.
  const epaule = geo.corps(MORPHO.epaule);
  const bras = (main, cote) => {
    const axe = direction(main.angle);
    const poignet = [main.x - axe[0] * MORPHO.main, main.y, main.z - axe[1] * MORPHO.main];
    const e3 = [epaule[0], cote * MORPHO.epauleY, epaule[1]];
    const c3 = coude(e3, poignet, cote, main.coude ? [main.coude.x, main.coude.y, main.coude.z] : COUDE.bas);
    const pp = (p3) => P([p3[0], p3[2]]);
    const cotes = [-axe[1], axe[0]];
    const place = ([u, v]) => P(plus([poignet[0], poignet[2]], plus(fois(axe, u), fois(cotes, v))));
    const contour = MAIN_POING.map((p, i) => entre(MAIN_OUVERTE[i], p, main.prise)).map(place);
    const pouce = POUCE.poing.map((p, i) => entre(POUCE.ouverte[i], p, main.prise)).map(place);
    return {
      haut: gelule(pp(e3), MEMBRES.epaule * CM, pp(c3), MEMBRES.coude * CM),
      avant: gelule(pp(c3), MEMBRES.coudeAvant * CM, pp(poignet), MEMBRES.poignet * CM),
      main: courbe(contour), pouce: courbe(pouce),
      articulations: { epaule: pp(e3), coude: pp(c3), poignet: pp(poignet), main: P([main.x, main.z]) },
    };
  };
  const brasG = bras(lesMains.gauche, 1), brasD = bras(lesMains.droite, -1);

  // --- Volant : colonne, moyeu, jante vue par la tranche.
  const V = VOLANT, c = vol.centre;
  const bord = (h, d) => plus(plus(c, fois(vol.haut, h)), fois(vol.axe, d));
  const hautJante = P(plus(c, fois(vol.haut, V.rayon))), basJante = P(plus(c, fois(vol.haut, -V.rayon)));
  const jante = gelule(hautJante, V.jante / 2 * CM, basJante, V.jante / 2 * CM);
  const moyeu = formeArrondie([bord(V.moyeu / 2, -V.saillieMoyeu), bord(V.moyeu / 2, V.colonne), bord(-V.moyeu / 2, V.colonne), bord(-V.moyeu / 2, -V.saillieMoyeu)].map(P), V.arrondiMoyeu * CM);
  const colonne = gelule(P(bord(0, V.colonne)), V.colonne / 2 * CM, P(PIED_COLONNE), V.colonne / 2 * CM);

  // --- Ceinture.
  const ceint = etatCeinture(ceinture);
  const sangle = ceint ? cheminCeinture(geo, ceint.avancement, lesMains.gauche) : null;

  // --- Repères (unités du cadre).
  const reperes = {
    sternum: P(geo.corps(MORPHO.sternum)),
    dos: P(geo.corps(MORPHO.dosRepere)),
    centreVolant: P(c),
    epaule: P(geo.corps(MORPHO.dessusEpaule)),
    aisselle: P(geo.corps(MORPHO.aisselle)),
    hanches: P(geo.corps([...MORPHO.hanches, 0])),
    nuque: P(geo.tete(TETE[TETE_NUQUE])),
    sommetCrane: plusHautCubique(teteSeg),
    hautAppuieTete: plusHautPoints(coussin),
  };
  const face = [P(geo.surDossier(S.dossier.bas, faceDossier)), P(geo.surDossier(S.dossier.haut, faceDossier))];
  const ud = unitaire(moins(face[1], face[0]));
  reperes.dossier = plus(face[0], fois(ud, scalaire(moins(reperes.dos, face[0]), ud)));
  const versAvant = unitaire([-geo.faceATAvant[0], -geo.faceATAvant[1]]);     // normale de la face de l'appuie-tête, dans le cadre
  reperes.arriereTete = echantillons(teteSeg, PAS_CONTOUR_TETE).reduce((m, p) => (scalaire(p, versAvant) < scalaire(m, versAvant) ? p : m));
  const faceAT = [P(geo.coussinAT[0]), P(geo.coussinAT[1])];

  const peau = { fill: CHARTE.peau };
  const articulations = (b, cote) => Object.entries(b.articulations).map(([nom, p]) => repere(`${nom}-${cote}`, p));
  // Coussin et dossier de même teinte (sans accent) : le dossier, dessiné par-dessus le coussin en position basse, porte un
  // contour qui les sépare (même règle que l'avant-bras proche).
  const contourDossier = teinteAT === teinteSiege ? { stroke: teinteSiege.ombre, "stroke-width": CONTOUR_DOSSIER.epaisseur } : {};
  const noeud = n("g", { "data-r": "conducteur-profil" },
    n("path", { d: formeArrondie([[H[0] + S.rail.arriere, S.rail.hauteur], [H[0] + S.rail.avant, S.rail.hauteur], [H[0] + S.rail.avant, 0], [H[0] + S.rail.arriere, 0]].map(P), S.rail.arrondi * CM), fill: TEINTES.metalOmbre }),
    n("g", { "data-r": "siege", "data-recul": siege.recul, "data-hauteur": siege.hauteur, "data-dossier": siege.dossier },
      n("path", { d: patin, fill: TEINTES.metal }),
      n("path", { d: base, fill: teinteSiege.ombre }),
      n("path", { d: tige, fill: TEINTES.metal }),
      n("g", segmentRole("appuie-tete", faceAT), n("path", { d: trace(coussin), fill: teinteAT.base, "data-r": "appuie-tete-coussin" })),
      n("g", segmentRole("siege-dossier", face), n("path", { d: dossier, fill: teinteSiege.base, ...contourDossier })),
      n("path", { d: assise, fill: teinteSiege.clair })),
    n("g", { "data-r": "bras-droit" },
      n("path", { d: brasD.haut, fill: TEINTES.pullOmbre }), n("path", { d: brasD.avant, fill: TEINTES.pullOmbre }),
      n("path", { d: brasD.main, fill: CHARTE.peauOmbre, "data-r": "main-droite-forme" }), n("path", { d: brasD.pouce, fill: CHARTE.peauOmbre, "data-r": "pouce-droit" })),
    n("path", { d: courbe(cou), fill: CHARTE.peauOmbre }),
    n("path", { d: traceSegments(torse), fill: TEINTES.pull, "data-r": "buste" }),
    n("path", { d: traceSegments(teteSeg), ...peau, "data-r": "tete" }),
    n("path", { d: cheveux, fill: TEINTES.cheveux }),
    n("path", { d: courbe(oreille), fill: CHARTE.peauOmbre }),
    n("path", { d: pied, fill: TEINTES.chaussure }),
    n("path", { d: semelle, fill: TEINTES.semelle }),
    n("path", { d: courbe(jambe), fill: TEINTES.pantalon }),
    // Boucle (côté droit du conducteur) et languette engagée : derrière la cuisse et la hanche proches, donc cachées.
    sangle ? dessinBoucle(sangle, P) : null,
    n("path", { d: courbe(cuisse), fill: TEINTES.pantalon }),
    sangle ? dessinSangle(sangle, P, accent === "ceinture") : null,
    n("path", { d: colonne, fill: TEINTES.colonne }),
    n("path", { d: moyeu, fill: TEINTES.moyeu }),
    n("path", { d: jante, fill: TEINTES.volant, "data-r": "volant", "data-x1": ecrit(hautJante[0]), "data-y1": ecrit(hautJante[1]),
      "data-x2": ecrit(basJante[0]), "data-y2": ecrit(basJante[1]) }),
    n("g", { "data-r": "bras-gauche" },
      n("path", { d: brasG.haut, fill: TEINTES.pullClair }),
      n("path", { d: brasG.avant, fill: TEINTES.pullClair, stroke: CONTOUR_AVANT_BRAS.couleur, "stroke-width": CONTOUR_AVANT_BRAS.epaisseur, "data-r": "avant-bras-gauche" }),
      n("path", { d: brasG.main, ...peau, "data-r": "main-gauche-forme" }), n("path", { d: brasG.pouce, fill: CHARTE.peauOmbre })),
    sangle ? dessinRenvoiLanguette(sangle, P, ceint.languette) : null,
    ...articulations(brasG, "gauche"), ...articulations(brasD, "droite"),
    ...Object.entries(reperes).map(([role, p]) => repere(role, p)));
  return { noeud, reperes, geo, P };
}

// --- Ceinture de profil : renvoi, languette, boucle, ancrage ; chemin selon l'avancement du geste.
function cheminCeinture(geo, u, mainGauche) {
  const C = CEINTURE;
  const ancrage = plus(geo.H, C.ancrage), boucle = plus(geo.H, C.boucle);
  const repos = entre(RENVOI, ancrage, C.rangee);
  const languette = u <= 0 || !mainGauche ? repos : u >= 1 ? boucle : [mainGauche.x, mainGauche.z];
  // Bouclée : brin diagonal du renvoi au dessus de l'épaule, en travers de la poitrine, devant le ventre, à la boucle ; brin
  // ventral de la boucle, sur le côté de la hanche, à l'ancrage. Rangée ou tirée : la sangle va droit du renvoi à la languette
  // et de la languette à l'ancrage ; elle se pose sur le corps point par point pendant que la main la tire (mêmes points tout
  // du long : le dessin ne saute jamais).
  const finD = [RENVOI, geo.corps(C.epaule), geo.corps(C.poitrine), geo.corps(C.ventre), boucle];
  const finV = [boucle, plus(geo.H, C.coteHanche), ancrage];
  const poids = ([debut, fin]) => adoucir(avancement(u, debut, fin));
  const diagonal = finD.map((p, i) => (i === 0 ? RENVOI : i === finD.length - 1 ? languette
    : entre(entre(RENVOI, languette, i / (finD.length - 1)), p, poids(C.poseDiagonal[i - 1]))));
  const ventral = finV.map((p, i) => (i === 0 ? languette : i === finV.length - 1 ? ancrage
    : entre(entre(languette, ancrage, i / (finV.length - 1)), p, poids(C.poseVentral[i - 1]))));
  return { diagonal, ventral, languette, boucle, ancrage, avancement: u };
}
function dessinSangle(sangle, P, accent) {
  const teinte = accent ? ACCENT.ombre : TEINTES.sangle;
  const diag = ruban(sangle.diagonal.map(P), CEINTURE.sangle * CM);
  const vent = ruban(sangle.ventral.map(P), CEINTURE.sangle * CM);
  return n("g", { "data-r": "ceinture" },
    n("path", { d: diag.d, fill: teinte, "data-r": "brin-diagonal", "data-points": listePoints(diag.centre) }),
    n("path", { d: vent.d, fill: teinte, "data-r": "brin-ventral", "data-points": listePoints(vent.centre), "data-haut": listePoints(bordHaut(vent)) }));
}
// Boucle sur sa place et languette qui y est engagée (visible quand la ceinture est bouclée) : dessinées sous la cuisse.
function dessinBoucle(sangle, P) {
  const C = CEINTURE;
  return n("g", { "data-r": "boucle-ceinture" },
    boitier(P, sangle.boucle, C.boitier.longueur, C.boitier.largeur, TEINTES.sangle),
    boitier(P, sangle.boucle, C.languette.longueur, C.languette.largeur, TEINTES.boucle, { display: sangle.avancement >= 1 ? "inline" : "none" }));
}
// Renvoi (côté portière, au-dessus du dos) et languette tenue en main ou rangée, dessinés devant.
function dessinRenvoiLanguette(sangle, P, opaciteLanguette) {
  const C = CEINTURE;
  return n("g", { "data-r": "renvoi-ceinture" },
    boitier(P, RENVOI, C.renvoi.longueur, C.renvoi.largeur, TEINTES.siegeOmbre),
    n("g", { "data-r": "languette", ...affiche(opaciteLanguette) },
      boitier(P, sangle.languette, C.languette.longueur, C.languette.largeur, TEINTES.boucle)));
}

// ===================================================================================================================
// Dessins
// ===================================================================================================================

const L_CADRE = 320;
const MARGE = 8, GOUTTIERE = 8;
const LEGENDE = { bas: 12, taille: CHARTE.tailles.etiquette };      // légende sous le dessin, dans la vignette
const JEU_LEGENDE = 3, { haut: HAUT_TEXTE, interligne: INTERLIGNE } = METRIQUES_POLICE;

function paire(hauteur) {
  const largeur = (L_CADRE - 2 * MARGE - GOUTTIERE) / 2;
  return { largeur, hauteur: hauteur - 2 * MARGE, xJuste: MARGE, xFaux: MARGE + largeur + GOUTTIERE, y: MARGE };
}

// Vignette dont le dessin est rogné au bord de sa carte (les jambes du conducteur en sortent), avec sa légende au bas. La
// découpe a un identifiant propre à chaque montage.
const RAYON_CARTE = MISE_EN_PAGE.rayonVignette, LISERE_CARTE = 0.5;
function vignetteRognee({ x, y, largeur, hauteur, etat, nom, legende }, dessin, ...dessus) {
  const id = nouvelId(nom);
  return vignette({ x, y, largeur, hauteur, etat },
    n("clipPath", { id }, n("rect", { x: x + LISERE_CARTE, y: y + LISERE_CARTE, width: largeur - 2 * LISERE_CARTE, height: hauteur - 2 * LISERE_CARTE, rx: RAYON_CARTE - LISERE_CARTE })),
    n("g", { "clip-path": `url(#${id})` }, dessin),
    ...dessus,
    legende.map((ligne, i) => texte(x + largeur / 2, y + hauteur - LEGENDE.bas - (legende.length - 1 - i) * LEGENDE.taille * INTERLIGNE, ligne,
      { taille: LEGENDE.taille, ancrage: "middle", graisse: 600 })));
}

// Plancher et planche de bord (repère de la voiture), sous le conducteur de profil.
const PLANCHER = { epaisseur: 3, arriere: -170, avant: 60 };
function plancher(P) {
  return n("path", { d: trace([[PLANCHER.arriere, 0], [PLANCHER.avant, 0], [PLANCHER.avant, -PLANCHER.epaisseur], [PLANCHER.arriere, -PLANCHER.epaisseur]].map(P)), fill: TEINTES.plancher });
}
// Planche de bord de profil (repère de la voiture), coins arrondis : dessus, du pied du pare-brise au capuchon du combiné
// au-dessus du volant ; face arrière, où entre la colonne de direction ; dessous (place des genoux) ; tablier, qui descend au
// plancher devant les pieds.
const TABLEAU = [[56, 75], [-30, 82], [-36, 80], [-34, 72], [-27, 52], [-22, 44], [0, 41], [26, 37], [40, 26], [46, 8], [50, 0], [66, 0], [66, 74]];
const ARRONDI_TABLEAU = 3;
const traceTableau = (P) => formeArrondie(TABLEAU.map(P), ARRONDI_TABLEAU * CM);
function tableau(P) {
  return n("path", { d: traceTableau(P), fill: TEINTES.tableau });
}

// --- Siège : juste, dos contre le dossier et 25 cm ; faux, siège plus reculé, dos décollé pour atteindre le volant.
const H_SIEGE = 210;
const PLACE_H = 86;           // abscisse du point H dans chaque vignette : le siège y est à la même place, la voiture bouge
// Place du plancher dans une vignette : au-dessus de la légende (lignes de 1,25 taille), d'un jeu de 3 unités.
const solVignette = (p, lignes) => p.y + p.hauteur - LEGENDE.bas - HAUT_TEXTE * LEGENDE.taille - (lignes - 1) * INTERLIGNE * LEGENDE.taille
  - JEU_LEGENDE - PLANCHER.epaisseur * CM;
function vignetteProfil(xCarte, p, lignes, options) {
  const H = pointH(options.siege || SIEGE_REGLE);
  const profil = conducteurProfil({ x: xCarte + PLACE_H + H[0] * CM, y: solVignette(p, lignes), ...options });
  return { ...profil, decor: [plancher(profil.P), tableau(profil.P)] };
}

function dessinSiege() {
  const p = paire(H_SIEGE);
  const juste = vignetteProfil(p.xJuste, p, 1, { siege: SIEGE_REGLE, accent: "siege" });
  const faux = vignetteProfil(p.xFaux, p, 1, { siege: { ...SIEGE_REGLE, recul: SIEGE_REGLE.recul + RECUL_TROP }, dosColle: false, accent: "siege" });
  return cadre({ largeur: L_CADRE, hauteur: H_SIEGE, titre: "Régler le siège",
    description: "Juste : dos contre le dossier, environ 25 cm entre le sternum et le centre du volant, obtenus en reculant le siège. Faux : siège trop reculé, dos décollé du dossier pour atteindre le volant." },
  vignetteRognee({ x: p.xJuste, y: p.y, largeur: p.largeur, hauteur: p.hauteur, etat: "juste", nom: "siege-juste", legende: ["Dos contre le dossier"] },
    [...juste.decor, juste.noeud], cote(juste.reperes.sternum, juste.reperes.centreVolant, "25 cm")),
  vignetteRognee({ x: p.xFaux, y: p.y, largeur: p.largeur, hauteur: p.hauteur, etat: "faux", nom: "siege-faux", legende: ["Dos décollé du dossier"] },
    [...faux.decor, faux.noeud], ecartDos(faux.reperes.dos, faux.reperes.dossier)));
}

// Cote parallèle au segment (a, b), décalée au-dessus, avec ses lignes d'attache et son texte.
const DECALAGE_COTE = 9, TEXTE_COTE = 4;
function cote(a, b, libelle) {
  const u = unitaire(moins(b, a));
  const haut = [u[1], -u[0]][1] < 0 ? [u[1], -u[0]] : [-u[1], u[0]];
  const d = DECALAGE_COTE * CM;
  const a2 = plus(a, fois(haut, d)), b2 = plus(b, fois(haut, d));
  const m = entre(a2, b2, MILIEU);
  const trait = (p, q) => n("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: TEINTES.cote, "stroke-width": CHARTE.traits.fin, "stroke-linecap": "round" });
  return n("g", { "data-r": "cote" }, trait(a, a2), trait(b, b2), trait(a2, b2),
    texte(m[0], m[1] - TEXTE_COTE, libelle, { ancrage: "middle", graisse: 600 }));
}
// Écart entre le dos et le dossier : petite double flèche (pointes de 3 unités de long, 2 de demi-largeur).
const POINTE_ECART = { longueur: 3, demiLargeur: 2 };
function ecartDos(dos, dossier) {
  const u = unitaire(moins(dossier, dos));
  const pointe = (p, sens) => {
    const q = plus(p, fois(u, -sens * POINTE_ECART.longueur));
    const nn = [-u[1], u[0]];
    return `M${ecrirePoint(plus(q, fois(nn, POINTE_ECART.demiLargeur)))} L${ecrirePoint(p)} L${ecrirePoint(plus(q, fois(nn, -POINTE_ECART.demiLargeur)))}`;
  };
  return n("g", { "data-r": "ecart-dos" },
    n("line", { x1: dos[0], y1: dos[1], x2: dossier[0], y2: dossier[1], stroke: CHARTE.faux, "stroke-width": CHARTE.traits.moyen }),
    n("path", { d: `${pointe(dos, -1)} ${pointe(dossier, 1)}`, fill: "none", stroke: CHARTE.faux, "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round", "stroke-linejoin": "round" }));
}

// --- Appuie-tête : juste, haut au sommet du crâne, au plus près de la tête ; faux, trop bas (au niveau de la nuque).
const H_APPUIE_TETE = 200;
const DEBUT_GUIDE = 66, FIN_GUIDE = 4;    // ligne du sommet du crâne : après la pastille, jusqu'au bord de la carte
function dessinAppuieTete() {
  const p = paire(H_APPUIE_TETE);
  const juste = vignetteProfil(p.xJuste, p, 2, { appuieTete: { hauteur: "sommet" }, accent: "appuie-tete" });
  const faux = vignetteProfil(p.xFaux, p, 2, { appuieTete: { hauteur: "nuque" }, accent: "appuie-tete" });
  const guide = (xCarte, r) => {
    const y = r.sommetCrane[1];
    return n("line", { x1: xCarte + DEBUT_GUIDE, y1: y, x2: xCarte + p.largeur - FIN_GUIDE, y2: y, stroke: TEINTES.guide, "stroke-width": CHARTE.traits.fin, "stroke-dasharray": "3 2" });
  };
  return cadre({ largeur: L_CADRE, hauteur: H_APPUIE_TETE, titre: "Régler l'appuie-tête",
    description: "Juste : le haut de l'appuie-tête au niveau du sommet du crâne, au plus près de la tête. Faux : appuie-tête trop bas, au niveau de la nuque." },
  vignetteRognee({ x: p.xJuste, y: p.y, largeur: p.largeur, hauteur: p.hauteur, etat: "juste", nom: "appuie-tete-juste", legende: ["Haut au niveau", "du sommet du crâne"] },
    [...juste.decor, juste.noeud], guide(p.xJuste, juste.reperes)),
  vignetteRognee({ x: p.xFaux, y: p.y, largeur: p.largeur, hauteur: p.hauteur, etat: "faux", nom: "appuie-tete-faux", legende: ["Trop bas, au niveau", "de la nuque"] },
    [...faux.decor, faux.noeud], guide(p.xFaux, faux.reperes)));
}

// ===================================================================================================================
// Le conducteur de face (ceinture)
// ===================================================================================================================

// Vue de face (cm) : x vers la gauche du conducteur (à droite du dessin), z au-dessus du plancher, origine au plancher dans
// l'axe du conducteur. Mêmes proportions que de profil : point H à 28 cm du plancher, crête iliaque 10 cm au-dessus, nombril
// 3 cm au-dessus de la crête, épaules à 40 cm l'une de l'autre, tête de 23 cm.
const FACE = {
  // Contours (moitié gauche du conducteur, à droite du dessin, de haut en bas ; l'autre moitié en miroir).
  tete: [[0, 104.2], [5.4, 102.4], [7.6, 97.4], [7.7, 92.4], [7.1, 87.6], [5.4, 83.6], [2.9, 81.4], [0, 80.9]],
  tempe: 3,                                   // indice de la tempe dans la moitié de la tête : les cheveux s'y arrêtent
  lisiere: [[6.2, 96.6], [3.2, 99.2], [0, 99.8]],
  oreille: { centre: [7.9, 91], demiLargeur: 1.4, demiHauteur: 2.8 },
  cou: { bas: 78, haut: 86.5, demiLargeur: 5.2 },
  // Buste : naissance du cou, trapèze, bout de l'épaule, épaule, aisselle, poitrine, taille, bas du pull.
  buste: [[0, 81.4], [5.6, 80.4], [12.6, 78.7], [19.6, 75.8], [21.0, 71.5], [19.4, 66.5], [16.6, 63.5], [16.4, 56], [15.0, 47], [15.6, 41], [16.2, 38.6], [0, 37.6]],
  // Bassin et genoux (le pantalon, de face : la taille, la hanche, le genou, l'entrejambe).
  bassin: [[0, 42.6], [14.6, 42], [17.4, 34], [19.4, 27], [18.4, 21.6], [13.6, 20.2], [9.6, 20.8], [5.0, 21.6], [1.6, 24.4], [0, 25.6]],
  jambe: [[16.2, 22], [16.6, 15], [13.6, 7], [8.4, 7], [5.4, 15], [5.6, 22]],
  chaussure: [[7.0, 6.8], [15.0, 6.8], [16.4, 2.6], [15.6, 0.2], [6.4, 0.2], [5.6, 2.6]],
  bras: { epaule: [18.4, 73.6], coude: [21.6, 51], poignet: [22.6, 30.5] },
  main: [[20.4, 31.2], [24.8, 31.2], [25.4, 25.6], [24.0, 21.8], [21.4, 21.6], [20.0, 25.4]],
  // Repères : bout de l'épaule, naissance du cou, aisselle, ligne des crêtes iliaques, nombril.
  reperes: { epaule: [19.6, 75.8], cou: [5.6, 80.4], aisselle: [16.6, 63.5], hanches: 38, nombril: [0, 41] },
  // Siège de face : dossier, coussin d'appuie-tête (haut au sommet du crâne), tiges, assise, base.
  dossier: { demiLargeur: 25, bas: 22, haut: 83, arrondi: 6 },
  appuieTete: { demiLargeur: 13, hauteur: 18, arrondi: 4, tige: 0.7, ecartTiges: 7 },
  assise: { demiLargeur: 25, bas: 11, haut: 22, arrondi: 3 },
  base: { demiLargeur: 19, bas: 2, haut: 11, arrondi: 1.5 },
  // Montant milieu (côté portière, derrière le siège) et renvoi de la ceinture ; ancrage bas ; boucle sur sa tige.
  montant: { gauche: 27.5, droite: 32, bas: 0, haut: 140 },
  renvoi: [29.8, 84.6], ancrage: [22.6, 25.0], boucle: [-19.8, 31.2], tigeBoucle: { bas: 13, demiLargeur: 1.1 },
};
// Chemins de la sangle (axe, cm) : juste, le brin diagonal passe sur le milieu de l'épaule et le sternum, le brin ventral bas
// sur le bassin ; faux, le brin ventral sur le ventre, le brin diagonal sous le bras (derrière l'épaule et le bras, il
// ressort sous l'aisselle).
const CHEMINS_FACE = {
  juste: {
    diagonal: [FACE.renvoi, [21.2, 81.6], [12.6, 79.0], [8.4, 72.0], [2.0, 62.0], [-6.5, 50.0], [-14.5, 38.5], FACE.boucle],
    ventral: [FACE.boucle, [-13, 30.0], [0, 29.6], [13, 30.0], [19.4, 28.8], FACE.ancrage],
  },
  faux: {
    cache: [FACE.renvoi, [24.0, 76.0], [21.0, 68.0], [18.8, 62.4]],
    diagonal: [[17.6, 61.0], [9.0, 54.0], [0, 47.0], [-9.0, 40.6], [-16.0, 35.0], FACE.boucle],
    ventral: [FACE.boucle, [-15, 38.5], [-6, 44.5], [0, 45.2], [6, 44.5], [15, 38.0], [19.6, 31.0], FACE.ancrage],
  },
};

const miroirX = (points) => points.map(([px, pz]) => [-px, pz]);
// Contour fermé symétrique : la moitié donnée, de l'axe à l'axe, puis son miroir parcouru en sens inverse (les points de
// l'axe ne sont pas répétés).
function symetrique(moitie) {
  const horsAxe = moitie.filter(([px]) => Math.abs(px) > 1e-9);
  return [...moitie, ...miroirX(horsAxe).reverse()];
}

/**
 * Le conducteur de face, assis à gauche dans la voiture, sa ceinture placée « juste » ou « faux ». `x`, `y` : place, dans le
 * cadre, du plancher dans son axe. Rend { noeud, reperes } ; repères (unités du cadre) : epauleGauche, epauleDroite, cou,
 * hanches (ligne des crêtes iliaques), nombril, aisselleGauche, aussi rôles du nœud.
 */
export function conducteurFace({ x = 0, y = 0, ceinture = "juste" } = {}) {
  if (!["juste", "faux"].includes(ceinture)) throw new Error(`Ceinture « ${ceinture} » inconnue : « juste » ou « faux » attendu.`);
  const P = ([px, pz]) => [x + px * CM, y - pz * CM];
  const F = FACE;
  const rect = ({ demiLargeur, bas, haut }) => [[-demiLargeur, haut], [demiLargeur, haut], [demiLargeur, bas], [-demiLargeur, bas]];
  const decale = (points, dx) => points.map(([px, pz]) => [px + dx, pz]);
  // Tête : sommet du contour dessiné ; l'appuie-tête a son haut à ce niveau, comme le veut le cours.
  const tete = symetrique(F.tete);
  const teteSeg = spline(tete.map(P), true);
  const zSommet = (y - plusHautCubique(teteSeg)[1]) / CM;
  const AT = F.appuieTete;
  const coussin = rect({ demiLargeur: AT.demiLargeur, bas: zSommet - AT.hauteur, haut: zSommet });
  const tiges = [-1, 1].map((k) => formeArrondie(decale(rect({ demiLargeur: AT.tige, bas: F.dossier.haut - AT.arrondi, haut: zSommet - AT.hauteur + AT.arrondi }), k * AT.ecartTiges).map(P), AT.tige * CM));
  // Cheveux : le contour de la tête d'une tempe à l'autre en passant par le sommet (mêmes segments), puis la lisière.
  const n2 = tete.length;
  const segCheveux = [...teteSeg.slice(n2 - F.tempe), ...teteSeg.slice(0, F.tempe)];
  const tempe = F.tete[F.tempe];
  const lisiere = spline([tempe, ...F.lisiere, ...miroirX(F.lisiere.slice(0, -1)).reverse(), [-tempe[0], tempe[1]]].map(P), false);
  const cheveux = `${traceSegments([...segCheveux, ...lisiere], false)} Z`;
  const oreilles = [-1, 1].map((k) => courbe(Array.from({ length: OREILLE.points }, (_, i) => {
    const a = (i / OREILLE.points) * 2 * Math.PI;
    return P([k * F.oreille.centre[0] + F.oreille.demiLargeur * Math.cos(a), F.oreille.centre[1] + F.oreille.demiHauteur * Math.sin(a)]);
  })));
  const cou = formeArrondie(rect({ demiLargeur: F.cou.demiLargeur, bas: F.cou.bas, haut: F.cou.haut }).map(P), F.cou.demiLargeur * CM * MILIEU);
  const buste = courbe(symetrique(F.buste).map(P));
  const bassin = courbe(symetrique(F.bassin).map(P));
  const jambes = [1, -1].map((k) => courbe(F.jambe.map(([px, pz]) => P([k * px, pz]))));
  const chaussures = [1, -1].map((k) => courbe(F.chaussure.map(([px, pz]) => P([k * px, pz]))));
  const B = F.bras;
  const bras = [1, -1].map((k) => {
    const q = ([px, pz]) => P([k * px, pz]);
    return [gelule(q(B.epaule), MEMBRES.epaule * CM, q(B.coude), MEMBRES.coude * CM),
      gelule(q(B.coude), MEMBRES.coudeAvant * CM, q(B.poignet), MEMBRES.poignet * CM), courbe(F.main.map(q))];
  });
  // Ceinture.
  const chemin = CHEMINS_FACE[ceinture];
  const largeur = CEINTURE.sangle * CM;
  const diag = ruban(chemin.diagonal.map(P), largeur), vent = ruban(chemin.ventral.map(P), largeur);
  const cache = chemin.cache ? ruban(chemin.cache.map(P), largeur) : null;
  const teinte = ACCENT.ombre;
  const R = F.reperes;
  const reperes = {
    epauleGauche: P(R.epaule), epauleDroite: P([-R.epaule[0], R.epaule[1]]), cou: P(R.cou), aisselleGauche: P(R.aisselle),
    hanches: P([0, R.hanches]), nombril: P(R.nombril),
  };
  const C = CEINTURE, M = F.montant;
  const noeud = n("g", { "data-r": "conducteur-face", "data-ceinture": ceinture },
    n("path", { d: trace(rect({ demiLargeur: (M.droite - M.gauche) / 2, bas: M.bas, haut: M.haut }).map(([px, pz]) => P([px + (M.droite + M.gauche) / 2, pz]))), fill: TEINTES.montant }),
    n("path", { d: formeArrondie(rect(F.base).map(P), F.base.arrondi * CM), fill: TEINTES.siegeOmbre }),
    n("path", { d: formeArrondie(rect(F.dossier).map(P), F.dossier.arrondi * CM), fill: TEINTES.siege }),
    ...tiges.map((d) => n("path", { d, fill: TEINTES.metal })),
    n("path", { d: formeArrondie(coussin.map(P), AT.arrondi * CM), fill: TEINTES.siege, "data-r": "appuie-tete-coussin" }),
    n("path", { d: formeArrondie(rect(F.assise).map(P), F.assise.arrondi * CM), fill: TEINTES.siegeClair }),
    n("path", { d: trace(decale(rect({ demiLargeur: F.tigeBoucle.demiLargeur, bas: F.tigeBoucle.bas, haut: F.boucle[1] }), F.boucle[0]).map(P)), fill: TEINTES.sangle }),
    cache ? n("path", { d: cache.d, fill: teinte, "data-r": "brin-cache" }) : null,
    boitier(P, F.renvoi, C.renvoi.largeur, C.renvoi.longueur, TEINTES.siegeOmbre),
    ...oreilles.map((d) => n("path", { d, fill: CHARTE.peauOmbre })),
    n("path", { d: cou, fill: CHARTE.peauOmbre }),
    n("path", { d: traceSegments(teteSeg), fill: CHARTE.peau, "data-r": "tete" }),
    n("path", { d: cheveux, fill: TEINTES.cheveux }),
    ...jambes.map((d) => n("path", { d, fill: TEINTES.pantalonOmbre })),
    ...chaussures.map((d) => n("path", { d, fill: TEINTES.chaussure })),
    n("path", { d: bassin, fill: TEINTES.pantalon }),
    n("path", { d: buste, fill: TEINTES.pull, "data-r": "buste" }),
    n("g", { "data-r": "ceinture" },
      n("path", { d: vent.d, fill: teinte, "data-r": "brin-ventral", "data-points": listePoints(vent.centre), "data-haut": listePoints(bordHaut(vent)) }),
      n("path", { d: diag.d, fill: teinte, "data-r": "brin-diagonal", "data-points": listePoints(diag.centre) })),
    boitier(P, F.boucle, C.boitier.largeur, C.boitier.longueur, TEINTES.sangle),
    boitier(P, plus(F.boucle, [C.boitier.largeur * MILIEU, 0]), C.languette.longueur, C.languette.largeur, TEINTES.boucle),
    boitier(P, F.ancrage, C.renvoi.largeur, C.renvoi.longueur * MILIEU, TEINTES.siegeOmbre),
    ...bras.map(([h, a, m]) => n("g", {}, n("path", { d: h, fill: TEINTES.pullClair }), n("path", { d: a, fill: TEINTES.pullClair }), n("path", { d: m, fill: CHARTE.peau }))),
    ...Object.entries(reperes).map(([role, p]) => repere(role, p)));
  return { noeud, reperes };
}

// --- Ceinture (vue de face) : juste, brin ventral bas sur le bassin, diagonal au milieu de l'épaule ; faux, ventral sur le
// ventre, diagonal sous le bras.
const H_CEINTURE = 220;
function dessinCeinture() {
  const p = paire(H_CEINTURE);
  const sol = solVignette(p, 2);
  const juste = conducteurFace({ x: p.xJuste + p.largeur / 2, y: sol, ceinture: "juste" });
  const faux = conducteurFace({ x: p.xFaux + p.largeur / 2, y: sol, ceinture: "faux" });
  const decor = (xCarte) => n("path", { d: trace([[xCarte, sol], [xCarte + p.largeur, sol], [xCarte + p.largeur, sol + PLANCHER.epaisseur * CM], [xCarte, sol + PLANCHER.epaisseur * CM]]), fill: TEINTES.plancher });
  return cadre({ largeur: L_CADRE, hauteur: H_CEINTURE, titre: "Placer la ceinture",
    description: "Conducteur vu de face. Juste : brin ventral bas sur le bassin, brin diagonal à plat au milieu de l'épaule. Faux : brin ventral sur le ventre, brin diagonal sous le bras." },
  vignetteRognee({ x: p.xJuste, y: p.y, largeur: p.largeur, hauteur: p.hauteur, etat: "juste", nom: "ceinture-juste", legende: ["Bas sur le bassin", "Milieu de l'épaule"] },
    [decor(p.xJuste), juste.noeud]),
  vignetteRognee({ x: p.xFaux, y: p.y, largeur: p.largeur, hauteur: p.hauteur, etat: "faux", nom: "ceinture-faux", legende: ["Sur le ventre", "Sous le bras"] },
    [decor(p.xFaux), faux.noeud]));
}

// ===================================================================================================================
// Geste : s'installer, dans l'ordre du cours
// ===================================================================================================================

// Cabine de profil (repère de la voiture, cm), en écorché (toit ôté au-dessus du conducteur) : pare-brise du pied à la
// traverse, traverse qui porte le rétroviseur intérieur, montant milieu (celui de la ceinture), plancher. La planche de bord
// est TABLEAU.
const CABINE = {
  pareBrise: { pied: [55, 74], haut: [-40, 110], epaisseur: 1.6 },
  traverse: { avant: -36, arriere: -47, bas: 106.5, haut: 112, arrondi: 2 },
  montant: { largeur: 8, bas: 0, haut: 118, arrondi: 3 },      // le renvoi est fixé sur sa face avant
  plancher: { arriere: -150, avant: 52 },
};
// Rétroviseur intérieur de profil : rotule sous la traverse, tige (qui mord d'un cm dans la traverse), boîtier (profondeur,
// hauteur) centré sous la rotule ; tangage (degrés) avant et après réglage : positif, le bas du boîtier part vers l'avant et
// le verre se tourne vers le plancher ; négatif, le bas vient vers le conducteur et le verre regarde le pavillon (départ). La
// main droite le tient par-dessous, côté conducteur, et pousse son bas vers l'avant ; sa prise, sous le boîtier, n'en cache
// que le bas (40 % au plus) : on voit le boîtier tourner (prise : écart du milieu de la prise au centre du boîtier, cm ; y de
// la main).
const RETRO = { rotule: [-42, 105], recouvrementTige: 1, centre: [-1.5, -3.3], profondeur: 2.6, hauteur: 6.8, arrondi: 1.2,
  tangageDepart: -9, tangageRegle: 0, prise: [-2, -6.5], mainY: -28 };
// Vignette du rétroviseur (unités du cadre) : la carte, le boîtier, le verre et ce qu'il montre (lunette arrière, ciel, sol,
// route). Verre, lunette et horizon sont la pièce du kit (miroirInterieur), la même que dans « retroviseurs » : un seul
// rétroviseur intérieur dans le cours. Avant réglage, la vue est décalée : de côté par le lacet du miroir (que le profil ne
// montre pas), en hauteur par son tangage, de `parDegre` unités par degré. Un verre tourné vers le pavillon (tangage négatif)
// montre plus haut : la lunette descend dans le miroir. C'est le tangage du boîtier dessiné qui place la vue : boîtier et
// vignette ne peuvent pas se contredire.
const VIGNETTE = {
  carte: { x: 10, y: 10, largeur: 128, hauteur: 70, arrondi: 8 },
  boitier: 4,                                                  // épaisseur du boîtier autour du verre
  miroir: { x: 20, y: 20, largeur: 108 },                      // coin haut gauche et largeur du verre (30,24 de haut : 25 sur 7)
  route: { haut: 3, bas: 30 },                                 // demi-largeurs de la route à l'horizon et au bas
  lacet: 24,                                                   // décalage de côté avant réglage
  parDegre: 1.33,                                              // décalage en hauteur par degré de tangage
  legende: { y: 70 },
  attache: [138, 66],                                          // départ du filet vers le rétroviseur
};
const TEINTES_VUE = { habitacle: "#4D5550", boitier: "#2F3532", ciel: "#E6ECEF", sol: "#B9C3B6", route: "#8C938D" };

// Calendrier du geste (secondes). Les mouvements de main durent 0,8 s et les réglages de 0,7 à 1,4 s (adoucir) ; une prise
// ou un lâcher 0,2 s (adoucir) ; une apparition 0,2 s, une disparition 0,13 s (sortieDouce). Les repères d'une étape
// (cote, ligne du sommet du crâne) disparaissent avant la fin de leur étape ; la vignette du rétroviseur apparaît à
// l'étape 5, quand la main le saisit.
const T = {
  recul: [0.35, 1.45], hauteur: [1.6, 2.3], dossier: [2.45, 3.15], cote: [3.2, 4.05],
  etape2: 4.3, monteeAT: [4.6, 5.6], guide: [5.65, 6.65],
  etape3: 6.9, versVolant: [7.05, 7.85], fermeVolant: [7.65, 7.85], reglageVolant: [8.1, 9.1],
  etape4: 10.1, lacheG: [10.25, 10.45], versLanguette: [10.4, 11.2], saisieLanguette: [11.2, 11.4], tirage: [11.45, 12.85],
  coudeTirage: 12.08, clic: [12.85, 13.05], retourG: [13.05, 13.85], resaisieG: [13.65, 13.85],
  etape5: 14.5, lacheD: [14.65, 14.85], versRetro: [14.8, 15.6], saisieRetro: [15.6, 15.8], vignette: 15.6,
  orientation: [15.85, 16.95], lacheRetro: [16.95, 17.15], retourD: [17.15, 17.95], resaisieD: [17.75, 17.95], lunette: 17.0,
  duree: 18.7,
};
const APPARITION = 0.2, DISPARITION = 0.13;
// Prises : main à plat (0), main entrouverte qui se déplace (PRISE_EN_ROUTE), refermée sur la jante ou la languette (1), sur
// le rétroviseur (PRISE_RETRO).
const PRISE_EN_ROUTE = 0.45, PRISE_RETRO = 0.8;
// Places des mains (cm, degrés) : sur la languette rangée ; à la boucle ; au rétroviseur.
const MAIN_LANGUETTE = { y: 26, angle: 120 }, MAIN_BOUCLE = { y: -14, angle: -60 }, MAIN_RETRO = { angle: 45 };
// Chemin de la languette tirée (repère du buste) : en dehors de l'épaule, à sa hauteur (la main la contourne côté portière,
// jamais dessous : le coude resterait sans côté), devant la poitrine ; écart de la main sur y (de la portière vers la boucle).
const TIRAGE = { cote: [47, -1], poitrine: [30, 17], y: [26, 34, 4, -14] };
// Passages des mains (cm) : vers la jante, la main passe derrière le plan du volant (côté conducteur), sous son centre, pour
// la saisir par l'arrière ; vers la languette, en dehors de l'épaule, à sa hauteur (jamais devant le visage ni sous l'épaule).
const VERS_JANTE = { sousCentre: 10, derriere: 9 };
const VERS_LANGUETTE = { epaule: TIRAGE.cote, y: TIRAGE.y[1] };

// Constantes du geste, calculées une fois : sorties basse et haute de l'appuie-tête (haut à la nuque, puis au sommet du
// crâne), pour le siège réglé.
const SORTIE_BASSE = sortieAppuieTete(SIEGE_REGLE, "nuque"), SORTIE_HAUTE = sortieAppuieTete(SIEGE_REGLE, "sommet");

const suivant = (t, [t0, t1]) => adoucir(avancement(t, t0, t1));
function reglagesA(t) {
  const k = (de, a, intervalle) => interpoler(de, a, suivant(t, intervalle));
  return {
    siege: { recul: k(SIEGE_DEPART.recul, SIEGE_REGLE.recul, T.recul), hauteur: k(SIEGE_DEPART.hauteur, SIEGE_REGLE.hauteur, T.hauteur),
      dossier: k(SIEGE_DEPART.dossier, SIEGE_REGLE.dossier, T.dossier) },
    appuieTete: { hauteur: k(SORTIE_BASSE, SORTIE_HAUTE, T.monteeAT) },
    volant: { inclinaison: k(VOLANT_DEPART.inclinaison, VOLANT_REGLE.inclinaison, T.reglageVolant),
      longueur: k(VOLANT_DEPART.longueur, VOLANT_REGLE.longueur, T.reglageVolant) },
    // La languette tenue en main disparaît dans la boucle (cachée par la hanche) au clic.
    ceinture: { avancement: suivant(t, T.tirage), languette: 1 - sortieDouce(avancement(t, ...T.clic)) },
    retroviseur: { orientation: suivant(t, T.orientation) },
  };
}

// Rétroviseur de profil : boîtier tourné autour de sa rotule (haut et bas : milieux de ses deux petits côtés).
function retroviseurDe(orientation) {
  const tangage = interpoler(RETRO.tangageDepart, RETRO.tangageRegle, orientation) * RAD;
  const centre = plus(RETRO.rotule, tourner(RETRO.centre, tangage));
  const coins = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([a, b]) => plus(centre, tourner([a * RETRO.profondeur / 2, b * RETRO.hauteur / 2], tangage)));
  const [haut, bas] = [1, -1].map((b) => plus(centre, tourner([0, b * RETRO.hauteur / 2], tangage)));
  return { centre, coins, haut, bas, tangage, orientation };
}

// Places des mains (les places suivent le siège, le volant et le rétroviseur).
function placesMains(reglages) {
  const geo = poseCorps({ siege: reglages.siege, sortieAT: reglages.appuieTete.hauteur, dosColle: true });
  const volant = mainsSurVolant(reglages.volant);
  const vol = geometrieVolant(reglages.volant);
  const ancrage = plus(geo.H, CEINTURE.ancrage);
  const repos = entre(RENVOI, ancrage, CEINTURE.rangee);
  const retro = retroviseurDe(reglages.retroviseur.orientation);
  const prise = plus(retro.centre, tourner(RETRO.prise, retro.tangage));
  const boucle = plus(geo.H, CEINTURE.boucle);
  // Point de passage vers la jante : sous le centre du volant, derrière son plan (côté conducteur).
  const passage = plus(plus(vol.centre, fois(vol.haut, -VERS_JANTE.sousCentre)), fois(vol.axe, -VERS_JANTE.derriere));
  const versLanguette = geo.corps(VERS_LANGUETTE.epaule);
  return {
    cuisseG: mainSurCuisse(geo, 1), cuisseD: mainSurCuisse(geo, -1), volantG: volant.gauche, volantD: volant.droite,
    languette: { x: repos[0], y: MAIN_LANGUETTE.y, z: repos[1], angle: MAIN_LANGUETTE.angle },
    boucle: { x: boucle[0], y: MAIN_BOUCLE.y, z: boucle[1], angle: MAIN_BOUCLE.angle },
    retro: { x: prise[0], y: RETRO.mainY, z: prise[1], angle: MAIN_RETRO.angle },
    passageJante: (y) => ({ x: passage[0], y, z: passage[1] }),
    passageLanguette: { x: versLanguette[0], y: VERS_LANGUETTE.y, z: versLanguette[1] },
    geo,
  };
}

// Chemin de la languette tirée par la main gauche (repère de la voiture) : du repos, à côté de l'épaule, devant la poitrine,
// à la boucle ; paramétré par la longueur parcourue, pour une vitesse régulière avant la courbe d'accélération.
const PAS_TIRAGE = 64;
function cheminTirage(places) {
  const geo = places.geo;
  const pts = [[places.languette.x, places.languette.z], geo.corps(TIRAGE.cote), geo.corps(TIRAGE.poitrine), [places.boucle.x, places.boucle.z]];
  const echant = echantillons(spline(pts, false), PAS_TIRAGE / (pts.length - 1));
  const cumul = [0];
  for (let i = 1; i < echant.length; i++) cumul.push(cumul[i - 1] + dist(echant[i - 1], echant[i]));
  const total = cumul[cumul.length - 1];
  return (u) => {
    const part = Math.min(1, Math.max(0, u));
    const cible = part * total;
    let i = 1;
    while (i < cumul.length - 1 && cumul[i] < cible) i++;
    const r = (cible - cumul[i - 1]) / ((cumul[i] - cumul[i - 1]) || 1);
    const p = entre(echant[i - 1], echant[i], r);
    const yIndice = part * (TIRAGE.y.length - 1);
    const j = Math.min(TIRAGE.y.length - 2, Math.floor(yIndice));
    return { x: p[0], z: p[1], y: interpoler(TIRAGE.y[j], TIRAGE.y[j + 1], yIndice - j), angle: interpoler(MAIN_LANGUETTE.angle, MAIN_BOUCLE.angle, part) };
  };
}

// Une main qui va d'une place à une autre (x, y, z, angle) sur adoucir, par un point de passage facultatif (x, y, z) : la
// trajectoire est une courbe de Bézier quadratique qui passe par lui au milieu du mouvement.
function trajetMain(t, intervalle, de, vers, passage = null) {
  const u = suivant(t, intervalle);
  const position = (k) => {
    if (!passage) return interpoler(de[k], vers[k], u);
    const controle = 2 * passage[k] - (de[k] + vers[k]) / 2;
    return (1 - u) * (1 - u) * de[k] + 2 * u * (1 - u) * controle + u * u * vers[k];
  };
  return { x: position("x"), y: position("y"), z: position("z"), angle: interpoler(de.angle, vers.angle, u) };
}
// Valeur d'une suite de clés [instant, valeur] (adoucir entre deux clés), pour un nombre ou un vecteur.
const clesNombre = (liste, t) => cles(liste.map(([ti, v]) => ({ t: ti, v })), t);
const clesVecteur = (liste, t) => [0, 1, 2].map((k) => clesNombre(liste.map(([ti, v]) => [ti, v[k]]), t));

function mainsA(t, reglages) {
  const p = placesMains(reglages);
  // Main gauche : cuisse, volant (par l'arrière ; suit son réglage), languette (par le côté de l'épaule), boucle (le long du
  // chemin de tirage), volant (par l'arrière).
  let g;
  if (t < T.versLanguette[0]) g = trajetMain(t, T.versVolant, p.cuisseG, p.volantG, p.passageJante(interpoler(p.cuisseG.y, p.volantG.y, MILIEU)));
  else if (t < T.tirage[0]) g = trajetMain(t, T.versLanguette, p.volantG, p.languette, p.passageLanguette);
  else if (t < T.retourG[0]) g = cheminTirage(p)(reglages.ceinture.avancement);
  else g = trajetMain(t, T.retourG, p.boucle, p.volantG, p.passageJante(interpoler(p.boucle.y, p.volantG.y, MILIEU)));
  // Main droite : cuisse, volant (par l'arrière), rétroviseur (tourne avec lui), volant.
  let d;
  if (t < T.versRetro[0]) d = trajetMain(t, T.versVolant, p.cuisseD, p.volantD, p.passageJante(interpoler(p.cuisseD.y, p.volantD.y, MILIEU)));
  else if (t < T.retourD[0]) d = trajetMain(t, T.versRetro, p.volantD, p.retro);
  else d = trajetMain(t, T.retourD, p.retro, p.volantD);
  const priseG = clesNombre([[0, 0], [T.versVolant[0], 0], [T.fermeVolant[0], PRISE_EN_ROUTE], [T.fermeVolant[1], 1], [T.lacheG[0], 1],
    [T.lacheG[1], PRISE_EN_ROUTE], [T.saisieLanguette[0], PRISE_EN_ROUTE], [T.saisieLanguette[1], 1], [T.clic[0], 1], [T.clic[1], PRISE_EN_ROUTE],
    [T.resaisieG[0], PRISE_EN_ROUTE], [T.resaisieG[1], 1]], t);
  const priseD = clesNombre([[0, 0], [T.versVolant[0], 0], [T.fermeVolant[0], PRISE_EN_ROUTE], [T.fermeVolant[1], 1], [T.lacheD[0], 1],
    [T.lacheD[1], PRISE_EN_ROUTE], [T.saisieRetro[0], PRISE_EN_ROUTE], [T.saisieRetro[1], PRISE_RETRO], [T.lacheRetro[0], PRISE_RETRO],
    [T.lacheRetro[1], PRISE_EN_ROUTE], [T.resaisieD[0], PRISE_EN_ROUTE], [T.resaisieD[1], 1]], t);
  // Consignes des coudes : vers l'avant et le bas pour aller chercher la languette, puis en bas dès que la main a contourné
  // l'épaule (T.coudeTirage, au premier tiers du tirage) ; en dehors pour le bras droit tendu vers le rétroviseur.
  const [gx, gy, gz] = clesVecteur([[0, COUDE.bas], [T.versLanguette[0], COUDE.bas], [T.versLanguette[1], COUDE.avantBas],
    [T.tirage[0], COUDE.avantBas], [T.coudeTirage, COUDE.bas]], t);
  const [dx, dy, dz] = clesVecteur([[0, COUDE.bas], [T.versRetro[0], COUDE.bas], [T.versRetro[1], COUDE.dehors],
    [T.retourD[0], COUDE.dehors], [T.retourD[1], COUDE.bas]], t);
  return { gauche: { ...g, prise: priseG, coude: { x: gx, y: gy, z: gz } }, droite: { ...d, prise: priseD, coude: { x: dx, y: dy, z: dz } } };
}

// Opacité d'un repère qui apparaît au début de `[debut, fin]` et disparaît à sa fin (sans fin : il reste).
function opacite(t, debut, fin = Infinity) {
  const entree = sortieDouce(avancement(t, debut, debut + APPARITION));
  const sortie = fin === Infinity ? 0 : sortieDouce(avancement(t, fin, fin + DISPARITION));
  return Math.max(0, entree - sortie);
}

function etatInstallation(t) {
  const reglages = reglagesA(t);
  return {
    ...reglages,
    mains: mainsA(t, reglages),
    reperes: {
      cote: opacite(t, ...T.cote), guide: opacite(t, ...T.guide), vignette: opacite(t, T.vignette), lunette: opacite(t, T.lunette),
    },
  };
}

// Vue dans le rétroviseur `retro` (retroviseurDe) : habitacle sombre, lunette (ciel, sol, route vers l'horizon), décalée tant
// que le miroir n'est pas réglé (de côté par son lacet, en hauteur par le tangage même du boîtier dessiné). Tous les points
// sont dans le repère du cadre.
function vueRetroviseur(retro, opaciteVue, idMiroir) {
  const V = VIGNETTE, M = V.miroir, e = V.boitier;
  const decal = [V.lacet * (1 - retro.orientation), -V.parDegre * (retro.tangage / RAD)];
  const { hauteur, rayon, verre, coins: [hg, hd, bd, bg], lunette, horizon: yHorizon } = miroirInterieur(M, decal);
  const surBord = (a, b, y) => entre(a, b, (y - a[1]) / (b[1] - a[1]));
  const gH = surBord(hg, bg, yHorizon), dH = surBord(hd, bd, yHorizon);
  const milieuX = (gH[0] + dH[0]) / 2;
  const route = [[milieuX - V.route.haut, yHorizon], [milieuX + V.route.haut, yHorizon], [milieuX + V.route.bas, bd[1]], [milieuX - V.route.bas, bg[1]]];
  const sol = couper(lunette, (p) => yHorizon - p[1]);                     // la part de la lunette sous l'horizon
  const boitier = arrondir([[M.x - e, M.y - e], [M.x + M.largeur + e, M.y - e], [M.x + M.largeur + e, M.y + hauteur + e],
    [M.x - e, M.y + hauteur + e]], [rayon + e, rayon + e, rayon + e, rayon + e]);
  const { carte } = V;
  return n("g", { "data-r": "vignette-retroviseur", ...affiche(opaciteVue) },
    n("rect", { x: carte.x, y: carte.y, width: carte.largeur, height: carte.hauteur, rx: carte.arrondi, fill: CHARTE.carte, stroke: CHARTE.filet, "stroke-width": CHARTE.traits.fin }),
    n("path", { d: trace(boitier), fill: TEINTES_VUE.boitier, "data-r": "boitier-vignette" }),
    n("clipPath", { id: idMiroir }, n("path", { d: trace(verre) })),
    n("g", { "clip-path": `url(#${idMiroir})` },
      n("path", { d: trace(verre), fill: TEINTES_VUE.habitacle }),
      n("path", { d: trace(lunette), fill: TEINTES_VUE.ciel, "data-r": "lunette", "data-points": listePoints(lunette) }),
      n("path", { d: trace(sol), fill: TEINTES_VUE.sol }),
      n("polygon", { points: listePoints(route), fill: TEINTES_VUE.route })),
    n("path", { d: trace(verre), fill: "none", stroke: TEINTES_VUE.boitier, "stroke-width": CHARTE.traits.moyen, "data-r": "miroir",
      "data-points": listePoints(verre) }));
}

const H_INSTALLATION = 220;
// Place du repère de la voiture dans le cadre : plancher à 12 unités du bas, talon à 143 unités du bord gauche. Cadre de 320
// sur 220 (catalogue) : la cabine et le conducteur, à l'échelle de la famille, font 145 unités de haut ; la vignette du
// rétroviseur tient au-dessus de la planche de bord, à gauche du rétroviseur.
const ORIGINE_INSTALLATION = [143, H_INSTALLATION - 12];
const P_INSTALLATION = ([px, pz]) => [ORIGINE_INSTALLATION[0] - px * CM, ORIGINE_INSTALLATION[1] - pz * CM];
// Ligne du sommet du crâne : de juste après le rétroviseur au montant ; son libellé au-dessus de la traverse, qui finit 10
// unités avant le montant (unités du cadre).
const GUIDE = { apresRetro: 6, dessusTraverse: 3, avantMontant: 10 };
// Filet de la vignette : l'étiquette du kit (trait et point sur leur liseré), qui finit devant la face avant du boîtier réglé,
// à mi-hauteur, sans le toucher (décision commune 3 : le point d'une étiquette ne cache pas le détail désigné). Le point (2,2
// unités de rayon, liseré de 1,25) a son centre à RECUL_POINT_FILET unités de la face. Pendant le réglage, le boîtier s'en
// écarte (son bas recule vers le conducteur au départ) : le filet ne bouge pas, et la vue visée a le même.
const RECUL_POINT_FILET = 4;
const CIBLE_FILET = (() => {
  const r = retroviseurDe(1);
  const normale = tourner([1, 0], r.tangage);                              // face avant, vers le pare-brise
  const faceAvant = plus(r.centre, fois(normale, RETRO.profondeur / 2));
  return P_INSTALLATION(plus(faceAvant, fois(normale, RECUL_POINT_FILET / CM)));
})();
const ETAPE_RETROVISEUR = 4;                                               // indice de l'étape 5
// Vignette du rétroviseur et son filet, à l'opacité donnée : la vignette vivante (état du geste) et la vue visée (rangée avec
// la flèche de l'étape 5) sont le même dessin. La légende « Toute la lunette » est à part, dessinée après le groupe des
// flèches : sur une image figée prise après 17 s (pause, fin), elle passe par-dessus la vue visée ; une seconde légende dans
// la vue visée ferait deux textes l'un sur l'autre.
function vignetteRetroviseur(retro, opacite, idMiroir) {
  return [
    n("g", { "data-r": "filet-vignette", ...affiche(opacite) },
      etiquette({ cible: CIBLE_FILET, ancre: VIGNETTE.attache, lignes: [], role: "filet-retroviseur" })),
    vueRetroviseur(retro, opacite, idMiroir),
  ];
}
const TITRE_INSTALLATION = "S'installer, dans l'ordre";
const DESCRIPTION_INSTALLATION = "Le conducteur s'installe à l'arrêt, dans l'ordre : il recule et règle le siège jusqu'à environ 25 cm entre le sternum et le centre du volant, dos contre le dossier ; l'appuie-tête monte au niveau du sommet du crâne ; il règle le volant, mains à 9 h et 3 h ; il boucle la ceinture ; il oriente le rétroviseur intérieur, qui cadre alors toute la lunette arrière.";

// Flèches des cinq étapes (repère du cadre), à partir des états de début et de fin de chaque étape ; calculées une fois par
// construction du geste.
const FLECHE_SIEGE = { devant: 22, hauteur: 6 };           // cm : devant la base (la pointe s'arrête 8 cm devant elle), au-dessus du plancher
const FLECHE_AT = { derriere: 5 };                           // cm derrière le coussin
// Volant : arc autour du pied de colonne, 4 cm au-dessus du haut de la jante (elle part de lui, loin de la flèche du
// rétroviseur), prolongé de part et d'autre des trois quarts de la rotation réelle (le volant ne bouge que de quelques
// centimètres : la flèche doit se lire sur un téléphone).
const FLECHE_VOLANT = { ecart: 4, prolongement: 0.75, points: 5 };
const FLECHE_CEINTURE = { parts: [0.04, 0.3, 0.55, 0.8, 0.97] };
// Rétroviseur : arc autour de la rotule, à 12 cm (juste sous le boîtier, au-dessus de la flèche du volant), sept fois plus
// ouvert que le tangage réel (9 degrés), dans son sens : le boîtier ne tourne que de quelques millimètres, la flèche doit se
// lire sur un téléphone.
const FLECHE_RETRO = { rayon: 12, ouverture: 7, points: 7 };
const EPAISSEUR_FLECHES = [CHARTE.traits.appuye, CHARTE.traits.appuye, CHARTE.traits.appuye, CHARTE.traits.appuye, CHARTE.traits.moyen];
function flechesInstallation() {
  const P = P_INSTALLATION;
  // 1. Le siège recule : le long du rail, devant la base, du recul de départ au recul réglé.
  const avant0 = pointH(SIEGE_DEPART)[0] + SIEGE.base.avant + FLECHE_SIEGE.devant;
  const fl1 = [P([avant0, FLECHE_SIEGE.hauteur]), P([avant0 - (SIEGE_REGLE.recul - SIEGE_DEPART.recul), FLECHE_SIEGE.hauteur])];
  // 2. L'appuie-tête monte le long de ses tiges : derrière le coussin, de son haut en position basse à son haut réglé.
  const geoB = poseCorps({ siege: SIEGE_REGLE, sortieAT: SORTIE_BASSE }), geoH = poseCorps({ siege: SIEGE_REGLE, sortieAT: SORTIE_HAUTE });
  const derriere = (g) => plus(g.coussinAT[2], fois(g.faceATAvant, -FLECHE_AT.derriere));
  const fl2 = [P(derriere(geoB)), P(derriere(geoH))];
  // 3. Le volant se règle : arc autour du pied de colonne, du haut de la jante au départ à son haut réglé, prolongé.
  const hautJante = (v) => { const g = geometrieVolant(v); return plus(g.centre, fois(g.haut, VOLANT.rayon)); };
  const angleDepuisPied = (p) => Math.atan2(p[1] - PIED_COLONNE[1], p[0] - PIED_COLONNE[0]);
  const [h0, h1] = [hautJante(VOLANT_DEPART), hautJante(VOLANT_REGLE)];
  const [a0, a1] = [angleDepuisPied(h0), angleDepuisPied(h1)];
  const rayonV = dist(h1, PIED_COLONNE) + FLECHE_VOLANT.ecart;
  const ouvertureV = (a1 - a0) * FLECHE_VOLANT.prolongement;
  const fl3 = Array.from({ length: FLECHE_VOLANT.points }, (_, i) => {
    const a = interpoler(a0 - ouvertureV, a1 + ouvertureV, i / (FLECHE_VOLANT.points - 1));
    return P(plus(PIED_COLONNE, fois([Math.cos(a), Math.sin(a)], rayonV)));
  });
  // 4. La ceinture se boucle : le chemin de la languette, du repos à la boucle.
  const chemin = cheminTirage(placesMains(reglagesA(T.tirage[0])));
  const fl4 = FLECHE_CEINTURE.parts.map((u) => { const m = chemin(u); return P([m.x, m.z]); });
  // 5. Le rétroviseur s'oriente : arc autour de sa rotule, dans le sens de son tangage.
  const base = Math.atan2(RETRO.centre[1], RETRO.centre[0]);
  const [r0, r1] = [RETRO.tangageDepart * RAD, RETRO.tangageRegle * RAD];
  const milieu = (r0 + r1) / 2, demi = ((r1 - r0) / 2) * FLECHE_RETRO.ouverture;
  const fl5 = Array.from({ length: FLECHE_RETRO.points }, (_, i) => {
    const a = base + interpoler(milieu - demi, milieu + demi, i / (FLECHE_RETRO.points - 1));
    return P(plus(RETRO.rotule, fois([Math.cos(a), Math.sin(a)], FLECHE_RETRO.rayon)));
  });
  return [fl1, fl2, fl3, fl4, fl5];
}

// Image du geste à un état. L'image figée est la même image, groupe des flèches visible : la flèche de l'étape et, à
// l'étape 5, la vue visée (miroir réglé, lunette cadrée), à la place de la vignette vivante, encore à l'opacité 0 au début de
// l'étape.
function dessinerInstallation(etat, { fige, etape }, { fleches, idMiroir, vueVisee }) {
  const P = P_INSTALLATION;
  const profil = conducteurProfil({ x: ORIGINE_INSTALLATION[0], y: ORIGINE_INSTALLATION[1], siege: etat.siege,
    appuieTete: { hauteur: etat.appuieTete.hauteur }, ceinture: etat.ceinture, mains: etat.mains, volant: etat.volant });
  const r = profil.reperes;
  // Cabine.
  const C = CABINE;
  const pb = C.pareBrise, nPb = fois(unitaire([pb.haut[1] - pb.pied[1], pb.pied[0] - pb.haut[0]]), pb.epaisseur / 2);
  const pareBrise = trace([plus(pb.pied, nPb), plus(pb.haut, nPb), moins(pb.haut, nPb), moins(pb.pied, nPb)].map(P));
  const tr = C.traverse;
  const traverse = formeArrondie([[tr.avant, tr.haut], [tr.arriere, tr.haut], [tr.arriere, tr.bas], [tr.avant, tr.bas]].map(P), tr.arrondi * CM);
  const mo = C.montant, xm = RENVOI[0] - mo.largeur / 2;
  const montant = formeArrondie([[xm + mo.largeur / 2, mo.haut], [xm - mo.largeur / 2, mo.haut], [xm - mo.largeur / 2, mo.bas], [xm + mo.largeur / 2, mo.bas]].map(P), mo.arrondi * CM);
  const pl = C.plancher;
  const sol = trace([[pl.arriere, 0], [pl.avant, 0], [pl.avant, -PLANCHER.epaisseur], [pl.arriere, -PLANCHER.epaisseur]].map(P));
  const retro = retroviseurDe(etat.retroviseur.orientation);
  const tigeRetro = [plus(RETRO.rotule, [0, tr.bas - RETRO.rotule[1] + RETRO.recouvrementTige]), RETRO.rotule];
  // Repères : cote des 25 cm (étape 1), ligne du sommet du crâne (étape 2).
  const sommet = r.sommetCrane;
  const xMontant = P([RENVOI[0], 0])[0];
  const guide = n("g", { "data-r": "repere-sommet", ...affiche(etat.reperes.guide) },
    n("line", { x1: P(RETRO.rotule)[0] + GUIDE.apresRetro, y1: sommet[1], x2: xMontant, y2: sommet[1], stroke: TEINTES.guide, "stroke-width": CHARTE.traits.fin, "stroke-dasharray": "3 2" }),
    texte(xMontant - GUIDE.avantMontant, P([0, tr.haut])[1] - GUIDE.dessusTraverse, "Sommet du crâne",
      { taille: CHARTE.tailles.petite, ancrage: "end", graisse: 600, couleur: TEINTES.guide }));
  const coteVolant = n("g", { "data-r": "repere-25", ...affiche(etat.reperes.cote) }, cote(r.sternum, r.centreVolant, "25 cm"));
  // Vignette vivante du rétroviseur (son filet, la vue) ; sa légende, dessinée après le groupe des flèches.
  const vignetteVivante = n("g", { "data-r": "vignette-vivante" }, vignetteRetroviseur(retro, etat.reperes.vignette, idMiroir));
  const legendeLunette = n("g", { "data-r": "legende-lunette", ...affiche(etat.reperes.lunette) },
    texte(VIGNETTE.carte.x + VIGNETTE.carte.largeur / 2, VIGNETTE.legende.y, "Toute la lunette", { ancrage: "middle", graisse: 600 }));
  // Groupe des flèches, visible sur l'image figée seulement : la flèche de l'étape (mêmes points dans toute l'étape) et la vue
  // visée, montrée à l'étape 5 seule.
  const groupeFleches = n("g", { "data-r": "fleche", display: fige ? "inline" : "none" },
    fleche(fleches[etape], { role: "fleche-etape", epaisseur: EPAISSEUR_FLECHES[etape] }),
    n("g", { "data-r": "vue-visee", display: etape === ETAPE_RETROVISEUR ? "inline" : "none" }, vueVisee));
  return cadre({ largeur: L_CADRE, hauteur: H_INSTALLATION, titre: TITRE_INSTALLATION, description: DESCRIPTION_INSTALLATION },
    n("path", { d: montant, fill: TEINTES.montant }),
    n("path", { d: traceTableau(P), fill: TEINTES.tableau }),
    n("path", { d: pareBrise, fill: TEINTES_VUE.ciel, stroke: TEINTES.montant, "stroke-width": CHARTE.traits.fin }),
    n("path", { d: traverse, fill: TEINTES.montant }),
    n("line", { x1: P(tigeRetro[0])[0], y1: P(tigeRetro[0])[1], x2: P(tigeRetro[1])[0], y2: P(tigeRetro[1])[1], stroke: TEINTES.volant, "stroke-width": CHARTE.traits.appuye, "stroke-linecap": "round", "data-r": "tige-retroviseur" }),
    n("path", { d: formeArrondie(retro.coins.map(P), RETRO.arrondi * CM), fill: TEINTES_VUE.boitier, ...segmentRole("retroviseur", [P(retro.haut), P(retro.bas)]),
      "data-angle": ecrit(retro.tangage / RAD) }),
    n("path", { d: sol, fill: TEINTES.plancher }),
    profil.noeud,
    coteVolant, guide,
    vignetteVivante,
    groupeFleches,
    legendeLunette);
}

function construireInstallation() {
  const montage = {
    fleches: flechesInstallation(),
    idMiroir: nouvelId("installation-miroir"),
    // Vue visée : la vignette du rétroviseur réglé, telle que la lecture la montre à la fin (calculée une fois par montage).
    vueVisee: vignetteRetroviseur(retroviseurDe(1), 1, nouvelId("installation-miroir-vise")),
  };
  return {
    titre: TITRE_INSTALLATION,
    description: DESCRIPTION_INSTALLATION,
    cadre: [L_CADRE, H_INSTALLATION],
    duree: T.duree,
    etapes: [0, T.etape2, T.etape3, T.etape4, T.etape5].map((t) => ({ t })),
    // Apparitions (0,2 s) et disparitions (0,13 s) sur sortieDouce, des repères et de la languette qui entre dans la boucle :
    // jusqu'au tiers de leur plage en une image.
    sautsMax: { "reperes.cote": 0.35, "reperes.guide": 0.35, "reperes.vignette": 0.35, "reperes.lunette": 0.35, "ceinture.languette": 0.35 },
    etat: etatInstallation,
    dessiner: (etat, options) => dessinerInstallation(etat, options, montage),
  };
}

export const DESSINS = {
  siege: dessinSiege,
  "appuie-tete": dessinAppuieTete,
  ceinture: dessinCeinture,
};

export const GESTES = {
  installation: { construire: construireInstallation },
};

export { versDom } from "./dessin-svg.js?v=20261015c";
