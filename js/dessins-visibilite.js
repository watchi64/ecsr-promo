/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « visibilité » (C1.2) : ce qu'on ne voit pas depuis le siège (zones-invisibles), ce que montrent les
 * rétroviseurs (retroviseurs) et les angles morts (angles-morts). Les voitures sont celles du kit (js/dessins-kit.js) ; un seul
 * modèle de rétroviseur, tiré de la géométrie du kit, sert aux deux derniers dessins. Les valeurs sans portée réglementaire
 * sont des choix de dessin, recopiés avec leur raison dans sources/dessins-visibilite.js. Titres et cadres viennent du
 * catalogue des blocs (js/catalogue-blocs.js).
 */
import { n, trouverRole } from "./dessin-svg.js?v=20261013a";
import { CHARTE, cadre, texte, etiquette, vignette, voitureProfil, reperesProfil, voitureDessus, reperesDessus, VOITURE, TEINTES_ROUTE, arrondir,
  couper, bande } from "./dessins-kit.js?v=20261013a";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261013a";

// ===== Géométrie plane =====
// coord, trace et entre : copies des aides privées du kit (js/dessins-kit.js), signalées pour la tâche d'intégration.
const DEG = Math.PI / 180;
const coord = (v) => String(Number(v.toFixed(2)));
const trace = (pts, ferme = true) => `M${pts.map(([x, y]) => `${coord(x)} ${coord(y)}`).join(" L")}${ferme ? " Z" : ""}`;
const entre = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// Point de la droite (a, b) d'ordonnée y, puis d'abscisse x.
const aOrdonnee = (a, b, y) => entre(a, b, (y - a[1]) / (b[1] - a[1]));
const aAbscisse = (a, b, x) => entre(a, b, (x - a[0]) / (b[0] - a[0]));
// Point où la droite (p, direction u) coupe la droite (q, direction v).
function croisement(p, u, q, v) {
  const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / (u[0] * v[1] - u[1] * v[0]);
  return [p[0] + t * u[0], p[1] + t * u[1]];
}
const unitaire = ([x, y]) => [x / Math.hypot(x, y), y / Math.hypot(x, y)];
const plusLoin = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
// Point où la demi-droite (p, direction u), partie de l'intérieur d'un polygone convexe, en sort.
function sortie(p, u, convexe) {
  let t = Infinity;
  convexe.forEach((a, i) => {
    const b = convexe[(i + 1) % convexe.length], e = [b[0] - a[0], b[1] - a[1]];
    const det = u[0] * -e[1] + e[0] * u[1];
    if (Math.abs(det) < 1e-12) return;
    const w = [a[0] - p[0], a[1] - p[1]];
    const tu = (w[0] * -e[1] + e[0] * w[1]) / det, se = (u[0] * w[1] - u[1] * w[0]) / det;
    if (tu > 1e-9 && se >= 0 && se <= 1) t = Math.min(t, tu);
  });
  return plusLoin(p, u, t);
}
// Partie d'un polygone dans un polygone convexe (ses sommets dans le sens des aiguilles d'une montre à l'écran, y vers le bas :
// l'intérieur est à droite de chaque côté) : un découpage du kit par chacun de ses côtés.
function dansConvexe(poly, convexe) {
  return convexe.reduce((morceau, a, i) => {
    const b = convexe[(i + 1) % convexe.length];
    return morceau.length ? couper(morceau, (p) => (b[1] - a[1]) * (p[0] - a[0]) - (b[0] - a[0]) * (p[1] - a[1])) : morceau;
  }, poly);
}
const rectangleArrondi = (x1, y1, x2, y2, rayons) => arrondir([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], rayons);
// Points d'un tracé « M x y L x y ... Z » du kit.
function pointsDe(d) {
  const v = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  return v.flatMap((_, i) => (i % 2 ? [] : [[v[i], v[i + 1]]]));
}
// Racine de f, croissante, entre a et b, par dichotomie.
function racine(f, a, b) {
  const PAS = 60;
  for (let i = 0; i < PAS; i++) { const m = (a + b) / 2; if (f(m) < 0) a = m; else b = m; }
  return (a + b) / 2;
}

// ===== Hachures =====
// Bandes pleines parallèles, découpées exactement dans le polygone (bande du kit) : une hachure se lit comme un trait, sans motif
// SVG ni identifiant. Pente 1 : des bandes à 45 degrés, montant vers la droite.
const HACHURES = { pas: 4.5, epaisseur: CHARTE.traits.fin, pente: 1 };
function hachures(poly) {
  const { pas, epaisseur, pente } = HACHURES;
  const etendue = Math.hypot(1, pente);                 // largeur mesurée le long de x d'une bande d'une unité
  const valeurs = poly.map(([x, y]) => x + pente * y);
  const [min, max] = [Math.min(...valeurs), Math.max(...valeurs)];
  const morceaux = [];
  for (let c = min + (pas * etendue) / 2; c < max; c += pas * etendue) {
    const b = bande(poly, { pente, debut: c - (epaisseur * etendue) / 2, fin: c + (epaisseur * etendue) / 2 });
    if (b.length > 2) morceaux.push(trace(b));
  }
  return morceaux.join(" ");
}
// Une zone que le conducteur ne voit pas : un fond clair et des hachures, dans les deux dessins qui en montrent.
const TEINTES_ZONE = { fond: CHARTE.fauxFond, hachure: CHARTE.faux };
const zoneHachuree = (role, poly, opacite = 1) => n("g", { "data-r": role },
  n("path", { d: trace(poly), fill: TEINTES_ZONE.fond, "fill-opacity": opacite, "data-r": "zone" }),
  n("path", { d: hachures(poly), fill: TEINTES_ZONE.hachure }));

// ===== Ce qu'on ne voit pas depuis le siège =====
// Deux vues de la voiture du kit de profil, côté conducteur (sens « gauche » : l'avant à gauche). En haut, le détail de l'avant :
// la voiture entière et la zone avant, au plus grand qui tienne, avec l'œil, la ligne de visée qui frôle le capot et un cône
// caché dessous. En bas, la vue d'ensemble : les deux lignes de visée jusqu'au sol, la zone avant et la zone arrière, celle-ci
// longue de 14,6 m pour la voiture du kit, ce qui impose une petite échelle.
const ZONES = {
  marge: 8,                // du bord du cadre au point où une ligne de visée touche le sol, ou à l'arrière de la voiture
  detail: { sol: 86 },
  ensemble: { sol: 136 },
  legende: 16,             // de la ligne du sol à la ligne de base du nom d'une zone
  // Cône de signalisation courant de 45 cm, rouge à bande blanche, posé 30 cm devant le pare-chocs (m) : hauteur, largeur à la
  // base et au sommet, socle, bande blanche (de 20 à 30 cm du sol).
  cone: { hauteur: 0.45, base: 0.30, sommet: 0.04, socle: 0.36, epaisseurSocle: 0.03, bande: [0.20, 0.30], devant: 0.3 },
  tirets: "4 3",           // pointillé des lignes de visée
  etiquettes: { oeil: [-30, -28], obstacle: [-22, -26] },   // ancres, depuis l'œil et depuis la pointe du cône
};
const TEINTES_PROFIL = { sol: CHARTE.texteDiscret, visee: CHARTE.texte, cone: TEINTES_ROUTE.stop, coneBande: TEINTES_ROUTE.peinture, socle: "#2E3430" };

// Une vue de profil : la voiture, sa ligne de visée vers l'avant (et vers l'arrière si demandé), les zones qu'elles bornent.
function vueProfil({ x, sol, echelle, arriere, role }) {
  const r = reperesProfil({ x, y: sol, echelle, sens: "gauche" });
  const solAv = aOrdonnee(r.oeil, r.hautCapot, sol), solAr = aOrdonnee(r.oeil, r.hautCoffre, sol);
  const visee = (nom, repere, bout) => n("g", { "data-r": nom, "data-x": repere[0], "data-y": repere[1] },
    n("line", { x1: r.oeil[0], y1: r.oeil[1], x2: bout[0], y2: bout[1], stroke: CHARTE.carte,
      "stroke-width": CHARTE.traits.moyen + 2 * CHARTE.liseres, "stroke-linecap": "round", "data-r": "lisere-ligne" }),
    n("line", { x1: r.oeil[0], y1: r.oeil[1], x2: bout[0], y2: bout[1], stroke: TEINTES_PROFIL.visee, "stroke-width": CHARTE.traits.moyen,
      "stroke-dasharray": ZONES.tirets, "data-r": "ligne" }));
  const finSol = arriere ? solAr[0] : r.solArriere[0];
  return {
    r, solAv, solAr,
    noeud: n("g", { "data-r": role, "data-echelle": echelle, "data-x": x, "data-y": sol },
      zoneHachuree("zone-avant", [r.solAvant, solAv, aAbscisse(r.oeil, r.hautCapot, r.solAvant[0])]),
      arriere && zoneHachuree("zone-arriere", [r.solArriere, aAbscisse(r.oeil, r.hautCoffre, r.solArriere[0]), solAr]),
      n("line", { x1: solAv[0] - ZONES.marge / 2, y1: sol, x2: finSol + ZONES.marge / 2, y2: sol, stroke: TEINTES_PROFIL.sol,
        "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round", "data-r": "sol" }),
      voitureProfil({ x, y: sol, echelle, sens: "gauche" }),
      visee("visee-avant", r.hautCapot, solAv), arriere && visee("visee-arriere", r.hautCoffre, solAr)),
  };
}

function zonesInvisibles() {
  const code = "zones-invisibles";
  const [L, H] = CATALOGUE[code].cadre;
  const Z = ZONES, C = Z.cone;
  // À l'échelle 1, les points où les lignes de visée touchent le sol : ils fixent l'échelle de chaque vue.
  const u = reperesProfil({ x: 0, y: 0, echelle: 1, sens: "gauche" });
  const solAv = aOrdonnee(u.oeil, u.hautCapot, 0)[0], solAr = aOrdonnee(u.oeil, u.hautCoffre, 0)[0];
  const eD = (L - 2 * Z.marge) / (u.solArriere[0] - solAv), eE = (L - 2 * Z.marge) / (solAr - solAv);
  const detail = vueProfil({ x: Z.marge - solAv * eD, sol: Z.detail.sol, echelle: eD, arriere: false, role: "detail" });
  const ensemble = vueProfil({ x: Z.marge - solAv * eE, sol: Z.ensemble.sol, echelle: eE, arriere: true, role: "ensemble" });

  // Cône posé devant le pare-chocs, dans la vue de détail.
  const r = detail.r, xCone = r.solAvant[0] - (C.devant + C.socle / 2) * eD;
  const p = ([dx, h]) => [xCone + dx * eD, Z.detail.sol - h * eD];
  const demi = (h) => C.base / 2 + ((C.sommet - C.base) / 2) * ((h - C.epaisseurSocle) / (C.hauteur - C.epaisseurSocle));
  const [b1, b2] = C.bande;
  const pointe = p([0, C.hauteur]);
  const cone = n("g", { "data-r": "obstacle" },
    n("path", { d: trace([[-C.socle / 2, 0], [C.socle / 2, 0], [C.socle / 2, C.epaisseurSocle], [-C.socle / 2, C.epaisseurSocle]].map(p)),
      fill: TEINTES_PROFIL.socle, "data-r": "socle" }),
    n("path", { d: trace([[-C.base / 2, C.epaisseurSocle], [C.base / 2, C.epaisseurSocle], [C.sommet / 2, C.hauteur], [-C.sommet / 2, C.hauteur]].map(p)),
      fill: TEINTES_PROFIL.cone, "data-r": "cone" }),
    n("path", { d: trace([[-demi(b1), b1], [demi(b1), b1], [demi(b2), b2], [-demi(b2), b2]].map(p)), fill: TEINTES_PROFIL.coneBande }));

  const E = ensemble, nomZone = { taille: CHARTE.tailles.etiquette };    // la taille des étiquettes du kit, pour tous les textes
  const [eo, eb] = [Z.etiquettes.oeil, Z.etiquettes.obstacle];
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "La voiture de profil et l'œil du conducteur : la ligne de visée qui frôle l'avant du capot touche le sol devant la "
      + "voiture, celle qui frôle le bas de la lunette arrière touche le sol loin derrière. Devant le capot et derrière le coffre, "
      + "le sol n'est pas visible depuis le siège : un obstacle bas posé devant la voiture reste caché." },
  detail.noeud, cone,
  etiquette({ cible: r.oeil, ancre: [r.oeil[0] + eo[0], r.oeil[1] + eo[1]], lignes: ["Œil du conducteur"], ancrage: "end", role: "nom-oeil" }),
  etiquette({ cible: pointe, ancre: [pointe[0] + eb[0], pointe[1] + eb[1]], lignes: ["Obstacle caché"], ancrage: "end", role: "nom-obstacle" }),
  texte((detail.solAv[0] + r.solAvant[0]) / 2, Z.detail.sol + Z.legende, "Non visible", { ...nomZone, ancrage: "middle", role: "nom-zone-detail" }),
  E.noeud,
  texte(Z.marge, Z.ensemble.sol + Z.legende, "Devant le capot", { ...nomZone, role: "nom-zone-avant" }),
  texte((E.r.solArriere[0] + E.solAr[0]) / 2, Z.ensemble.sol + Z.legende, "Derrière le coffre", { ...nomZone, ancrage: "middle", role: "nom-zone-arriere" }));
}

// ===== Les rétroviseurs du kit : un seul modèle, pour « retroviseurs » et « angles-morts » =====
// Repère de la caisse : X vers l'avant depuis le centre de la voiture, Y vers sa droite (m) ; une direction se compte en degrés
// depuis l'arrière (l'axe de la voiture vers l'arrière), positive vers l'extérieur du côté du miroir.
//
// Rétroviseur extérieur plan. Son verre : 16 cm, la face arrière du boîtier du kit (de RETRO.pied à 2 RETRO.centre - RETRO.pied
// de l'axe), centré sur le miroir, orienté pour renvoyer l'arrière vers l'œil du conducteur (sa normale est la bissectrice de la
// direction de l'œil et de l'arrière). Son champ horizontal : l'angle sous lequel l'œil voit ce verre. Son image : ce que voit
// l'œil reflété, à la distance de l'œil devant le miroir, en projection plane perpendiculaire à l'axe ; la direction de l'arrière y
// fuit vers un point, à la part `fuite` de la largeur depuis le bord intérieur. La focale tient tout le champ dans la largeur :
// atan(fuite k) + atan((1 - fuite) k) = champ, k étant la largeur sur la focale. Le réglage se lit sur la caisse : son flanc, à
// `flanc` en dedans de l'œil reflété (3 cm), s'arrête dans l'image au point que frôle le rayon tangent à l'arrondi du coin arrière
// (`coin`, à `recul` de l'œil reflété le long de l'axe), à flanc / (k recul) du point de fuite ; la caisse prend la part `part`
// de la largeur (le « mince liseré » du cours : PART_LISERE) quand fuite - flanc / (k recul) = part. Vu du dessus, le champ va de
// -beta (vers la caisse) à champ - beta, beta = atan(fuite k) ; au-delà du verre, la caisse en cache la partie intérieure
// jusqu'au rayon rasant, de l'œil reflété par le coin.
export const PART_LISERE = 0.09;
export const PART_FAUX = 0.46;
const ARRIERE = [-1, 0];
const LARGEUR_K_MAX = 4;                 // borne haute de la recherche de k (un champ de plus de 100 degrés)

// Point de l'arrondi du coin arrière de la caisse, du côté `exterieur`, que frôle un rayon parti de p : la tangente à l'arc par
// l'extérieur (la caisse vue du dessus : 4,5 sur 1,8 m, coins de VOITURE.rayon).
function coinRasant(p, exterieur) {
  const r = VOITURE.rayon, C = [-(VOITURE.longueur / 2 - r), exterieur * (VOITURE.largeur / 2 - r)];
  const d = [p[0] - C[0], p[1] - C[1]];
  const a = Math.atan2(d[1], d[0]), b = Math.acos(r / Math.hypot(d[0], d[1]));
  const u = [a - b, a + b].map((t) => [Math.cos(t), Math.sin(t)]).find((v) => v[1] * exterieur > 0);
  return [C[0] + r * u[0], C[1] + r * u[1]];
}

export function miroirExterieur(cote, part) {
  const R = VOITURE.retroviseur, O = VOITURE.oeil;
  const exterieur = cote === "gauche" ? -1 : 1;             // signe de Y vers l'extérieur, du côté du miroir
  const M = [R.miroir, exterieur * R.centre], E = [O.avant, -O.gauche], demi = R.centre - R.pied;
  const e = unitaire([E[0] - M[0], E[1] - M[1]]);
  const normale = unitaire([e[0] + ARRIERE[0], e[1] + ARRIERE[1]]);
  const t = [-normale[1], normale[0]];
  const a = plusLoin(M, t, demi), b = plusLoin(M, t, -demi);
  const [interieur, exterieurVerre] = Math.abs(a[1]) < Math.abs(b[1]) ? [a, b] : [b, a];
  const vu = (p) => Math.atan2(p[1] - E[1], p[0] - E[0]);
  const champ = Math.abs(vu(exterieurVerre) - vu(interieur));
  const distance = Math.hypot(E[0] - M[0], E[1] - M[1]);
  const reflet = [M[0] + distance, M[1]];
  const coin = coinRasant(reflet, exterieur);
  const flanc = exterieur * (reflet[1] - coin[1]), recul = reflet[0] - coin[0];
  const kDe = (p) => racine((x) => Math.atan(p * x) + Math.atan((1 - p) * x) - champ, 0, LARGEUR_K_MAX);
  const fuite = racine((p) => p - flanc / (kDe(p) * recul) - part, part, 1);
  const k = kDe(fuite);
  const vers = (angle) => [-Math.cos(angle * DEG), exterieur * Math.sin(angle * DEG)];   // direction depuis l'arrière, vers l'extérieur
  const beta = Math.atan(fuite * k) / DEG;
  const rasant = unitaire([coin[0] - reflet[0], coin[1] - reflet[1]]);
  const surVerre = croisement(reflet, rasant, interieur, [exterieurVerre[0] - interieur[0], exterieurVerre[1] - interieur[1]]);
  return {
    cote, exterieur, champ: champ / DEG, beta, focale: 1 / k, fuite, miroir: M, distance, oeilReflete: reflet,
    verre: { interieur, exterieur: exterieurVerre }, coin, flanc, recul,
    bordRasant: { depart: surVerre, direction: rasant },
    bordExterieur: { depart: exterieurVerre, direction: vers(champ / DEG - beta) },
  };
}

// Champ du rétroviseur intérieur : la lunette dessinée du kit vue de l'œil reflété par le miroir (devant lui, dans l'axe, à la
// distance de l'œil). Les coins de la lunette vue du dessus ne sont pas des repères du kit : ils sont relus sur son tracé.
const ECHELLE_LECTURE = 100;             // unités par mètre pour relire le tracé (écrit à deux décimales : 0,1 mm près)
export function champInterieur() {
  const r = reperesDessus({ x: 0, y: 0, cap: 0, echelle: 1 });
  const voiture = voitureDessus({ x: 0, y: 0, cap: 0, echelle: ECHELLE_LECTURE });
  const lunette = pointsDe(trouverRole(voiture, "lunette").attributs.d).map(([x, y]) => [x / ECHELLE_LECTURE, y / ECHELLE_LECTURE]);
  const reflet = [r.retroInterieur[0] + Math.hypot(r.oeil[0] - r.retroInterieur[0], r.oeil[1] - r.retroInterieur[1]), r.retroInterieur[1]];
  const angle = (p) => Math.atan(Math.abs(p[1] - reflet[1]) / (reflet[0] - p[0]));
  const bord = lunette.reduce((m, p) => (angle(p) > angle(m) ? p : m));
  return { demiAngle: angle(bord) / DEG, oeilReflete: reflet, bord: [bord[0], Math.abs(bord[1])] };
}

// ===== Ce que montrent les rétroviseurs =====
// La rue des images : à double sens, voies de 3,5 m (celles des scènes), la voiture au milieu de la voie de droite ; à sa gauche
// l'axiale T'1, la voie d'en face et le trottoir d'en face ; à sa droite la bordure et le trottoir. Une droite du sol parallèle à la
// voiture, à l'écart l (m) de l'œil reflété, part du point de fuite avec la pente h / l (h, hauteur de l'œil reflété) ; son point à
// la distance D (m, le long de l'axe) est à f l / D et f h / D du point de fuite.
const RUE = { voie: 3.5, bordure: 0.15 };
const RETROVISEURS = {
  marge: 8, ecart: 6, rangee: 68,          // bords du cadre ; entre deux rangées ; hauteur d'une rangée
  // Pastille d'une vignette du kit (à 8 unités des bords, 20 de haut, « Juste » de 52,9 de large) : recopie de valeurs privées.
  pastille: { marge: 8, haut: 20, largeur: 53 },
  titre: { ecart: 6 },                     // de la pastille au titre
  legende: { taille: CHARTE.tailles.petite, interligne: 1.25, degagement: 6 },
  capitales: 0.35, haut: 0.8,              // milieu des capitales et haut du texte d'Outfit, en tailles de texte (recopie du kit)
  boitier: 3,                              // épaisseur du boîtier autour du miroir
  interieur: { largeur: 134, hauteur: 37, arrondi: 0.45, bras: { largeur: 8, hauteur: 6 },
    // Lunette dans le miroir (fractions du miroir) : plus large en haut, plus près de l'œil ; l'horizon dans son quart haut ; œil
    // reflété à 1,3 m du sol.
    lunette: { haut: 0.80, bas: 0.75, hauteur: 0.78, arrondi: 4 }, horizon: 0.25, hauteurOeil: 1.3 },
  exterieur: { largeur: 100, hauteur: 56, arrondis: { exterieurHaut: 18, exterieurBas: 12, interieurHaut: 7, interieurBas: 5 } },
  horizon: { juste: 0.5, droit: 0.36 },    // fraction de la hauteur du miroir, depuis le haut
  hauteurMiroir: 1.04,     // m : hauteur du centre du miroir extérieur (kit : de 0,97 à 1,105 m), celle de son œil reflété
  // Axiale T'1 de la rue des scènes : traits de 1,5 m, intervalles de 5 m, 0,10 m de large ; premier trait (m de l'œil reflété),
  // un par image extérieure et intérieure ; un trait plus court que `tiretMin` unités dans l'image n'est plus dessiné.
  axiale: { largeur: 0.10, trait: 1.5, vide: 5, exterieur: 23, interieur: 16, tiretMin: 1 },
  // Vitres latérales : leur face extérieure, à 0,75 m de l'axe (0,15 m en retrait du flanc), relue sur la vitre arrière gauche de
  // la voiture du kit vue du dessus (ce n'est pas un repère du kit).
  vitre: (() => {
    const v = voitureDessus({ x: 0, y: 0, cap: 0, echelle: ECHELLE_LECTURE });
    return Math.max(...pointsDe(trouverRole(v, "vitre-arriere-gauche").attributs.d).map((p) => Math.abs(p[1]))) / ECHELLE_LECTURE;
  })(),
  repere: 4, jeuRepere: 1, // repères de mi-hauteur : longueur, et jeu au boîtier
};
// La caisse du kit vue d'un rétroviseur extérieur, en volume simple : le flanc, à la demi-largeur de la voiture, de son bas à la
// ligne de ceinture ; au-dessus, en retrait (RETROVISEURS.vitre), les vitres latérales et le montant arrière jusqu'à la lunette ;
// entre les deux, l'épaule, à hauteur de ceinture. La ligne de ceinture est le bas des vitres du kit, droite prolongée sur toute la
// longueur comme le fait le kit pour son épaule ; le contour des vitres est celui du kit, arrondi de ses arrondis. Copies de l'aide
// privée ceinture et de la constante privée VITRAGE_CONTOUR de js/dessins-kit.js, refaites de ses valeurs exportées et signalées
// pour la tâche d'intégration.
function ceinture(X) {
  const { arriereBas: a, avantBas: b } = VOITURE.vitrage;
  return a[1] + ((X - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}
const VITRES_PROFIL = arrondir(["avantBas", "avantHaut", "hautAvant", "hautArriere", "arriereHaut", "arriereBas"].map((k) => VOITURE.vitrage[k]),
  VOITURE.vitrage.arrondis);
// Montant arrière, de profil : du pied de la vitre arrière au haut de son cadre, puis le long du toit jusqu'à la lunette, dont il suit
// le bord jusqu'à son pied (la vitre, dessinée par-dessus, en couvre la part qui lui revient).
const MONTANT_PROFIL = [VOITURE.vitrage.arriereBas, VOITURE.vitrage.hautArriere, VOITURE.lunette.haut, VOITURE.lunette.bas];
const TEINTES_RETRO = {
  ciel: "#E6EFF4", route: TEINTES_ROUTE.chaussee, trottoir: TEINTES_ROUTE.trottoir, bordure: "#B3AE9F",
  caisse: TEINTES_ROUTE.eleve, caisseBord: TEINTES_ROUTE.eleveBord, vitre: TEINTES_ROUTE.vitre,
  habitacle: "#262B28", boitier: "#2E3430", peinture: TEINTES_ROUTE.peinture,
};
const COTE_IMAGE = { gauche: 1, droit: -1 };   // côté de la caisse dans l'image : à droite du miroir gauche, à gauche du droit

// Tirets de l'axiale T'1 à l'écart l du point de fuite (vers `signe`), de la distance `debut`, tant qu'ils se voient.
function tiretsAxiale({ fuite, yH, f, h, l, signe, debut, dans }) {
  const A = RETROVISEURS.axiale, auSol = (lat, D) => [fuite - signe * (f * lat) / D, yH + (f * h) / D];
  const tirets = [];
  for (let d1 = debut; ; d1 += A.trait + A.vide) {
    const d2 = d1 + A.trait;
    if ((f * h) * (1 / d1 - 1 / d2) < A.tiretMin) break;
    const coins = [auSol(l, d1), auSol(l + A.largeur, d1), auSol(l + A.largeur, d2), auSol(l, d2)];
    const morceau = dansConvexe(coins, dans);
    if (morceau.length > 2) tirets.push({ coins: morceau, d1, d2 });
  }
  return tirets;
}

function vueExterieure({ x, y, cote, horizon, faux = false, bord = false, axiale = false, enFace = false }) {
  const R = RETROVISEURS, E = R.exterieur, W = E.largeur, Hm = E.hauteur, a = E.arrondis, s = COTE_IMAGE[cote], b = R.boitier;
  const m = miroirExterieur(cote, faux ? PART_FAUX : PART_LISERE), f = m.focale * W, h = R.hauteurMiroir;
  // Coins (haut gauche, haut droit, bas droit, bas gauche) : le côté extérieur, plus arrondi, est à gauche pour le miroir gauche.
  const rayons = s > 0 ? [a.exterieurHaut, a.interieurHaut, a.interieurBas, a.exterieurBas] : [a.interieurHaut, a.exterieurHaut, a.exterieurBas, a.interieurBas];
  const verre = rectangleArrondi(x, y, x + W, y + Hm, rayons);
  const boitier = rectangleArrondi(x - b, y - b, x + W + b, y + Hm + b, rayons.map((r) => r + b));
  const yH = y + horizon * Hm;
  const fuite = (s > 0 ? x + W : x) - s * m.fuite * W;          // point de fuite de la direction de l'arrière
  const ciel = couper(verre, (p) => p[1] - yH), route = couper(verre, (p) => yH - p[1]);
  const auDelaDe = (l) => (p) => s * (p[0] - fuite) * h + l * (p[1] - yH);   // <= 0 : au-delà de la droite d'écart l
  const dehors = couper(route, (p) => s * (p[0] - fuite));     // la route du côté extérieur du point de fuite
  // Écarts au miroir (m) : bord de sa voie (l'axiale à gauche, la bordure à droite), bord opposé de la chaussée à gauche.
  const ecartBord = RUE.voie / 2 - VOITURE.retroviseur.centre, ecartEnFace = (3 * RUE.voie) / 2 - VOITURE.retroviseur.centre;
  const trottoir = (l, role) => [n("path", { d: trace(couper(dehors, auDelaDe(l))), fill: TEINTES_RETRO.bordure, "data-r": role }),
    n("path", { d: trace(couper(dehors, auDelaDe(l + RUE.bordure))), fill: TEINTES_RETRO.trottoir })];
  const tirets = axiale ? tiretsAxiale({ fuite, yH, f, h, l: ecartBord, signe: s, debut: R.axiale.exterieur, dans: verre }) : [];
  // La caisse : un point [X, distance à l'axe, hauteur] (m) se voit, de l'œil reflété, à l'écart l vers l'intérieur et au recul D.
  const vu = ([X, d, z]) => {
    const D = m.oeilReflete[0] - X;
    return [fuite + (s * f * (VOITURE.retroviseur.centre - d)) / D, yH + (f * (h - z)) / D];
  };
  const montant = dansConvexe(MONTANT_PROFIL.map(([X, z]) => vu([X, R.vitre, z])), verre);
  const vitre = dansConvexe(VITRES_PROFIL.map(([X, z]) => vu([X, R.vitre, z])), verre);
  // Flanc et épaule : du bord intérieur au coin arrière que frôle le rayon rasant, sous le haut de l'épaule au coin et sous le pied
  // des vitres (dans l'image, la droite de la ceinture en retrait).
  const [xCoin, yCoin] = vu([m.coin[0], Math.abs(m.coin[1]), ceinture(m.coin[0])]);
  const [piedA, piedB] = [VOITURE.vitrage.arriereBas[0], VOITURE.vitrage.avantBas[0]].map((X) => vu([X, R.vitre, ceinture(X)]));
  const sousPied = (p) => piedA[1] + ((p[0] - piedA[0]) / (piedB[0] - piedA[0])) * (piedB[1] - piedA[1]) - p[1];   // <= 0 : dessous
  const caisse = couper(couper(couper(verre, (p) => s * (xCoin - p[0])), (p) => yCoin - p[1]), sousPied);
  const yMi = y + Hm / 2, j = R.jeuRepere;
  const repere = (x1, x2) => n("line", { x1, y1: yMi, x2, y2: yMi, stroke: CHARTE.texteDiscret, "stroke-width": CHARTE.traits.fin, "data-r": "mi-hauteur" });
  return n("g", { "data-r": `miroir-${cote}${faux ? "-faux" : ""}`, "data-champ": m.champ, "data-lisere": m.beta, "data-focale": f,
    "data-hauteur": h, "data-fuite": fuite },
    n("path", { d: trace(boitier), fill: TEINTES_RETRO.boitier, "data-r": "boitier" }),
    n("path", { d: trace(verre), fill: TEINTES_RETRO.ciel, "data-r": "verre" }),
    n("path", { d: trace(route), fill: TEINTES_RETRO.route, "data-r": "route" }),
    bord && trottoir(ecartBord, "bord-chaussee"), enFace && trottoir(ecartEnFace, "bord-en-face"),
    tirets.map((t) => n("path", { d: trace(t.coins), fill: TEINTES_RETRO.peinture, "data-r": "tiret", "data-d1": t.d1, "data-d2": t.d2,
      "data-l": ecartBord })),
    montant.length > 2 && n("path", { d: trace(montant), fill: TEINTES_RETRO.caisse, "data-r": "montant" }),
    vitre.length > 2 && n("path", { d: trace(vitre), fill: TEINTES_RETRO.vitre, "data-r": "vitre" }),
    n("path", { d: trace(caisse), fill: TEINTES_RETRO.caisse, "data-r": faux ? "carrosserie" : "lisere" }),
    repere(x - b - j - R.repere, x - b - j), repere(x + W + b + j, x + W + b + j + R.repere));
}

function vueInterieure({ x, y }) {
  const R = RETROVISEURS, I = R.interieur, W = I.largeur, Hm = I.hauteur, b = R.boitier, Lu = I.lunette, h = I.hauteurOeil;
  const rx = I.arrondi * Hm;
  const verre = rectangleArrondi(x, y, x + W, y + Hm, [rx, rx, rx, rx]);
  const boitier = rectangleArrondi(x - b, y - b, x + W + b, y + Hm + b, [rx + b, rx + b, rx + b, rx + b]);
  const cx = x + W / 2, hl = Lu.hauteur * Hm, yHaut = y + (Hm - hl) / 2, yBas = yHaut + hl;
  const lunette = arrondir([[cx - (Lu.haut * W) / 2, yHaut], [cx + (Lu.haut * W) / 2, yHaut], [cx + (Lu.bas * W) / 2, yBas],
    [cx - (Lu.bas * W) / 2, yBas]], [Lu.arrondi, Lu.arrondi, Lu.arrondi, Lu.arrondi]);
  const yH = yHaut + I.horizon * hl;
  // Focale : le haut de la lunette, sa partie la plus large dans l'image, couvre le champ du rétroviseur intérieur (angles-morts).
  const f = ((Lu.haut * W) / 2) / Math.tan(champInterieur().demiAngle * DEG);
  const ciel = couper(lunette, (p) => p[1] - yH), route = couper(lunette, (p) => yH - p[1]);
  // Le miroir intérieur garde la gauche et la droite du conducteur : l'axiale à gauche, la bordure et le trottoir à droite.
  const aDroiteDe = (l) => (p) => l * (p[1] - yH) - (p[0] - cx) * h;   // <= 0 : à droite de la droite du sol d'écart l, à droite
  const aGaucheDe = (l) => (p) => l * (p[1] - yH) + (p[0] - cx) * h;   // <= 0 : à gauche de la droite du sol d'écart l, à gauche
  const enFace = (3 * RUE.voie) / 2;
  const ecart = RUE.voie / 2;
  const tirets = tiretsAxiale({ fuite: cx, yH, f, h, l: ecart, signe: 1, debut: R.axiale.interieur, dans: route });
  return n("g", { "data-r": "miroir-interieur", "data-champ": 2 * champInterieur().demiAngle, "data-focale": f },
    n("rect", { x: cx - I.bras.largeur / 2, y: y - b - I.bras.hauteur, width: I.bras.largeur, height: I.bras.hauteur + b, fill: TEINTES_RETRO.boitier }),
    n("path", { d: trace(boitier), fill: TEINTES_RETRO.boitier, "data-r": "boitier" }),
    n("path", { d: trace(verre), fill: TEINTES_RETRO.habitacle, "data-r": "verre" }),
    n("path", { d: trace(ciel), fill: TEINTES_RETRO.ciel }),
    n("path", { d: trace(route), fill: TEINTES_RETRO.route }),
    n("path", { d: trace(couper(route, aDroiteDe(ecart))), fill: TEINTES_RETRO.bordure, "data-r": "bord-chaussee" }),
    n("path", { d: trace(couper(route, aDroiteDe(ecart + RUE.bordure))), fill: TEINTES_RETRO.trottoir }),
    n("path", { d: trace(couper(route, aGaucheDe(enFace))), fill: TEINTES_RETRO.bordure, "data-r": "bord-en-face" }),
    n("path", { d: trace(couper(route, aGaucheDe(enFace + RUE.bordure))), fill: TEINTES_RETRO.trottoir }),
    tirets.map((t) => n("path", { d: trace(t.coins), fill: TEINTES_RETRO.peinture, "data-r": "tiret" })),
    n("path", { d: trace(lunette), fill: "none", stroke: TEINTES_RETRO.habitacle, "stroke-width": CHARTE.traits.fin, "data-r": "lunette" }));
}

function retroviseurs() {
  const code = "retroviseurs";
  const [L, H] = CATALOGUE[code].cadre;
  const R = RETROVISEURS, P = R.pastille, I = R.interieur, E = R.exterieur, b = R.boitier, t = R.legende.taille;
  const largeur = L - 2 * R.marge, droiteVerre = R.marge + largeur - P.marge - b;
  const pas = t * R.legende.interligne;
  // Une rangée : la vignette, sa pastille et le titre à côté, une ou deux lignes de légende dessous, le miroir à droite.
  const rangee = (i, etat, titre, lignes, miroir) => {
    const y = R.marge + i * (R.rangee + R.ecart), xTexte = R.marge + P.marge;
    const premiereLigne = y + P.marge + P.haut + R.legende.degagement + R.haut * t;
    return vignette({ x: R.marge, y, largeur, hauteur: R.rangee, etat },
      miroir(y),
      n("g", { "data-r": `legende-${i}` },
        texte(xTexte + P.largeur + R.titre.ecart, y + P.marge + P.haut / 2 + R.capitales * t, titre, { taille: t, graisse: 600 }),
        lignes.map((l, k) => texte(xTexte, premiereLigne + k * pas, l, { taille: t }))));
  };
  const exterieur = (cote, horizon, options) => (y) => vueExterieure({ x: droiteVerre - E.largeur, y: y + (R.rangee - E.hauteur) / 2, cote, horizon, ...options });
  const hauteurInterieur = I.bras.hauteur + 2 * b + I.hauteur;
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Juste : le rétroviseur intérieur cadre toute la lunette arrière. Juste : l'extérieur gauche montre l'horizon à "
      + "mi-hauteur et un mince liseré de carrosserie au bord intérieur. Juste : le droit, souvent un peu plus bas, montre le bord de "
      + "la chaussée. Faux : l'extérieur gauche tourné vers la carrosserie en montre une large bande, l'angle mort s'élargit." },
  rangee(0, "juste", "Intérieur", ["toute la lunette arrière"],
    (y) => vueInterieure({ x: droiteVerre - I.largeur, y: y + (R.rangee - hauteurInterieur) / 2 + I.bras.hauteur + b })),
  rangee(1, "juste", "Extérieur gauche", ["horizon à mi-hauteur,", "mince liseré de carrosserie"],
    exterieur("gauche", R.horizon.juste, { axiale: true, enFace: true })),
  rangee(2, "juste", "Extérieur droit", ["souvent un peu plus bas :", "le bord de la chaussée"], exterieur("droit", R.horizon.droit, { bord: true })),
  rangee(3, "faux", "Extérieur gauche", ["tourné vers la carrosserie :", "angle mort élargi"],
    exterieur("gauche", R.horizon.juste, { faux: true, axiale: true, enFace: true })));
}

// ===== Les angles morts =====
// La voiture garée le long du trottoir de droite, vue du dessus, dans la rue des scènes avec stationnement (js/scene-decors.js) :
// bande de 2 m, voiture à 0,3 m de la bordure, voie de 3,5 m, axiale T'1. Tout le dessin est bâti cap vers le haut du cadre
// (CAP_HAUT) : versCadre et direction le supposent. Un angle se compte depuis le cap, en degrés, négatif à gauche, comme le
// regard des scènes.
const CAP_HAUT = -90;
const ANGLES_MORTS = {
  bande: 38, bas: 36,      // bandes des étiquettes, au-dessus et au-dessous de la chaussée
  gauche: 4.8, droite: 3.2,// m : de l'axe de la voiture aux bords gauche et droit du cadre
  avant: 0.3,              // m : du haut de la chaussée à l'avant de la voiture
  arriere: 3.75,           // m : du centre de la voiture au bas de la chaussée, 1,5 m derrière elle
  rue: { stationnement: 2.0, jeu: 0.3, voie: 3.5, axiale: { largeur: 0.10, trait: 1.5, vide: 5, debut: 1.0 } },
  peripherie: 90,          // degrés de part et d'autre du cap : la vision périphérique en regardant devant (thème 26)
  // Coup d'œil par-dessus l'épaule gauche : l'axe, la portée, la teinte et l'opacité du regard des scènes ; l'ouverture, le champ
  // visuel utile à faible allure (thème 26 : environ 100 degrés à 40 km/h).
  regard: { angle: -120, demiOuverture: 50, portee: 22, opacite: 0.4 },
  cycliste: [-1.0, -1.85], // m : centre du deux-roues, le long du flanc arrière gauche
  oeil: 1.8,               // rayon du point de l'œil
  champs: { opacite: 0.42 },
  zones: { opacite: 0.85 },
  // Étiquettes : ancre x (unités) et cible (m) ; en haut, le texte au-dessus de l'ancre, posée au bas de la bande ; en bas, le
  // texte sous l'ancre, posée en haut de la bande.
  etiquettes: {
    gauche: { x: 38, cible: [-1.0, -3.4] }, regard: { x: 128, cible: [0.6, -2.4] }, droite: { x: 282, cible: [-1.0, 2.3] },
    champGauche: { x: 64, cible: [-3.3, -1.3] }, champInterieur: { x: 192, cible: [-3.3, 0] }, champDroit: { x: 266, cible: [-3.3, 1.1] },
    jeu: 4,                // de l'ancre au bord de la chaussée
  },
};
const TEINTES_DESSUS = {
  champ: CHARTE.carte, champBord: CHARTE.carte,
  // Cycliste vu du dessus : teintes des scènes (TEINTES de js/scene-rendu.js, plan 3, tâche 13), absentes de TEINTES_ROUTE.
  cycliste: "#F5B06A", cyclisteOmbre: "#D98E4A", cyclisteBord: "#1F2422", tete: "#5A4636", velo: "#2E2E2B", pneu: "#1F2422",
};
// Cycliste sur son vélo vu du dessus, celui des scènes (js/scene-moteur.js, dessinerVelo, non exporté ; GABARITS.velo : 1,8 sur
// 0,6 m) : roues de 0,7 m aux bouts arrondis, cadre, guidon arrondi, dos du cycliste penché, bras, tête. Repère local : x vers
// l'avant, y vers la droite (m).
const VELO = {
  longueur: 1.8, largeur: 0.6,
  roue: 0.7, pneu: 0.06, cadre: 0.05, guidon: { x: 0.42, epaisseur: 0.05 },
  dos: { epaules: 0.05, hanches: -0.33, demiEpaules: 0.21, demiHanches: 0.15, cou: 0.07, bassin: 0.09 },
  bras: { epaisseur: 0.075, epaule: [0.03, 0.18], coude: [0.22, 0.235], main: [0.42, 0.26] },
  tete: { x: 0.13, demiLongueur: 0.12, demiLargeur: 0.095 },
  contour: 0.05,
};

// Le cycliste, centré en (x, y) du cadre, cap vers le haut, à `s` unités par mètre.
function cyclisteDessus([x, y], s) {
  const V = VELO, d = V.dos, demiL = V.longueur / 2, roue = demiL - V.roue / 2;
  const p = ([lx, ly]) => [x + ly * s, y - lx * s];
  const ecrit = (q) => { const [px, py] = p(q); return `${coord(px)} ${coord(py)}`; };
  // Un rectangle du repère local (x de x1 à x2 vers l'avant, y de y1 à y2), droit dans le cadre puisque le cap est vers le haut.
  const rect = (x1, y1, x2, y2, arrondi, attributs) => {
    const [ax, ay] = p([x2, y1]);
    return n("rect", { x: ax, y: ay, width: (y2 - y1) * s, height: (x2 - x1) * s, ...(arrondi ? { rx: arrondi * s } : {}), ...attributs });
  };
  const { epaules: xe, hanches: xh, demiEpaules: we, demiHanches: wh, cou, bassin } = d;
  const dos = `M${ecrit([xe, -we])} C${ecrit([xe + cou, -we])} ${ecrit([xe + cou, we])} ${ecrit([xe, we])}`
    + ` L${ecrit([xh, wh])} C${ecrit([xh - bassin, wh])} ${ecrit([xh - bassin, -wh])} ${ecrit([xh, -wh])} Z`;
  const [tx, ty] = p([V.tete.x, 0]);
  return n("g", { "data-r": "deux-roues", "data-x": x, "data-y": y, "data-longueur": V.longueur * s, "data-largeur": V.largeur * s },
    [-1, 1].map((sg) => rect(sg * roue - V.roue / 2, -V.pneu / 2, sg * roue + V.roue / 2, V.pneu / 2, V.pneu / 2, { fill: TEINTES_DESSUS.pneu })),
    rect(-roue, -V.cadre / 2, V.guidon.x, V.cadre / 2, 0, { fill: TEINTES_DESSUS.velo }),
    rect(V.guidon.x - V.guidon.epaisseur / 2, -V.largeur / 2, V.guidon.x + V.guidon.epaisseur / 2, V.largeur / 2, V.guidon.epaisseur / 2,
      { fill: TEINTES_DESSUS.velo }),
    n("path", { d: dos, fill: TEINTES_DESSUS.cycliste, stroke: TEINTES_DESSUS.cyclisteBord, "stroke-width": V.contour * s, "stroke-linejoin": "round" }),
    [-1, 1].map((sg) => n("path", { d: trace([V.bras.epaule, V.bras.coude, V.bras.main].map(([lx, ly]) => p([lx, sg * ly])), false), fill: "none",
      stroke: TEINTES_DESSUS.cyclisteOmbre, "stroke-width": V.bras.epaisseur * s, "stroke-linecap": "round", "stroke-linejoin": "round" })),
    n("ellipse", { cx: tx, cy: ty, rx: V.tete.demiLargeur * s, ry: V.tete.demiLongueur * s, fill: TEINTES_DESSUS.tete,
      stroke: TEINTES_DESSUS.cyclisteBord, "stroke-width": V.contour * s }));
}

function anglesMorts() {
  const code = "angles-morts";
  const [L, H] = CATALOGUE[code].cadre;
  const A = ANGLES_MORTS, R = A.regard, Et = A.etiquettes, Ru = A.rue;
  const s = L / (A.gauche + A.droite), cx = A.gauche * s, cy = A.bande + (A.avant + VOITURE.longueur / 2) * s;
  const versCadre = ([X, Y]) => [cx + Y * s, cy - X * s];                   // cap vers le haut
  const versCadreDirection = ([dX, dY]) => [dY, -dX];
  const r = reperesDessus({ x: cx, y: cy, cap: CAP_HAUT, echelle: s });
  const voiture = voitureDessus({ x: cx, y: cy, cap: CAP_HAUT, echelle: s, retroviseurs: true });
  const haut = A.bande, basChaussee = cy + A.arriere * s;
  const sol = [[0, haut], [L, haut], [L, basChaussee], [0, basChaussee]];   // chaussée et trottoir, entre les deux bandes
  const surSol = (poly) => dansConvexe(poly, sol);
  const loin = 2 * Math.hypot(L, H);                                       // une longueur qui sort toujours du cadre
  const direction = (angle) => [Math.sin(angle * DEG), -Math.cos(angle * DEG)];   // depuis le cap, positif à droite

  // La rue : bordure à Ru.jeu m du flanc droit ; bande de stationnement puis voie de droite ; axiale T'1.
  const yBordure = VOITURE.largeur / 2 + Ru.jeu, yAxiale = yBordure - Ru.stationnement - Ru.voie;
  const xBordure = versCadre([0, yBordure])[0];
  const trottoir = [[xBordure, haut], [L, haut], [L, basChaussee], [xBordure, basChaussee]];
  const Ax = Ru.axiale;
  const axiale = [];
  for (let X = Ax.debut; X - Ax.trait > -A.arriere - Ax.trait - Ax.vide; X -= Ax.trait + Ax.vide) {
    const t = surSol([[X, yAxiale - Ax.largeur / 2], [X, yAxiale + Ax.largeur / 2], [X - Ax.trait, yAxiale + Ax.largeur / 2],
      [X - Ax.trait, yAxiale - Ax.largeur / 2]].map(versCadre));
    if (t.length > 2) axiale.push(t);
  }

  // Champs : intérieur, de l'œil reflété par les bords de la lunette ; extérieurs, le modèle de « retroviseurs » : du verre vers
  // l'arrière, entre le bord extérieur et le rayon rasant qui frôle le coin arrière (en deçà, la caisse cache ce que montrerait
  // le miroir).
  const ci = champInterieur();
  const reflet = versCadre(ci.oeilReflete);
  const bordsLunette = [-1, 1].map((sg) => versCadre([ci.bord[0], sg * ci.bord[1]]));
  const versLoinDe = (q) => plusLoin(reflet, unitaire([q[0] - reflet[0], q[1] - reflet[1]]), loin);
  const champInt = surSol([bordsLunette[0], bordsLunette[1], versLoinDe(bordsLunette[1]), versLoinDe(bordsLunette[0])]);
  const miroirs = { gauche: miroirExterieur("gauche", PART_LISERE), droit: miroirExterieur("droit", PART_LISERE) };
  const bordDe = (bd) => ({ depart: versCadre(bd.depart), direction: versCadreDirection(bd.direction) });
  const champExt = (m) => {
    const i = bordDe(m.bordRasant), e = bordDe(m.bordExterieur);
    return surSol([i.depart, e.depart, plusLoin(e.depart, e.direction, loin), plusLoin(i.depart, i.direction, loin)]);
  };
  // Angle mort : derrière la limite de la vision périphérique (le rayon de l'œil à 90 degrés du cap), au-delà du bord extérieur du
  // champ du rétroviseur ; il commence où ces deux limites se croisent, le long du flanc à hauteur du conducteur.
  const zone = (m) => {
    const sg = m.exterieur, e = bordDe(m.bordExterieur), cote = direction(sg * A.peripherie);
    const sommet = croisement(r.oeil, cote, e.depart, e.direction);
    return surSol([sommet, plusLoin(sommet, cote, loin), plusLoin(sommet, e.direction, loin)]);
  };
  const cone = surSol([r.oeil, plusLoin(r.oeil, direction(R.angle - R.demiOuverture), R.portee * s),
    plusLoin(r.oeil, direction(R.angle + R.demiOuverture), R.portee * s)]);

  // Les champs, clairs, sans contour ; seuls leurs bords qui s'écartent sont tracés (le bord extérieur d'un champ extérieur, qui
  // borne l'angle mort, et les deux bords du champ intérieur) : un trait le long d'un flanc passerait pour du marquage.
  const champ = (role, poly, angle) => n("path", { d: trace(poly), fill: TEINTES_DESSUS.champ, "fill-opacity": A.champs.opacite, "data-r": role,
    "data-champ": angle });
  const bord = (role, p, u) => {
    const q = sortie(p, u, sol);
    return n("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: TEINTES_DESSUS.champBord, "stroke-width": CHARTE.traits.fin,
      "stroke-linecap": "round", "data-r": role });
  };
  const t = CHARTE.tailles.petite;
  const nomHaut = (cle, lignes) => etiquette({ cible: versCadre(Et[cle].cible), ancre: [Et[cle].x, haut - Et.jeu], lignes, ancrage: "middle",
    taille: t, role: `nom-${cle}` });
  const nomBas = (cle, lignes) => etiquette({ cible: versCadre(Et[cle].cible), ancre: [Et[cle].x, basChaussee + Et.jeu], lignes,
    ancrage: "middle", taille: t, role: `nom-${cle}` });
  const eg = bordDe(miroirs.gauche.bordExterieur), ed = bordDe(miroirs.droit.bordExterieur);
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "La voiture garée le long du trottoir, vue du dessus. Le rétroviseur intérieur montre l'arrière, dans l'axe ; chaque "
      + "rétroviseur extérieur, un cône étroit qui s'écarte vers l'arrière et sur le côté. De chaque côté, de la hauteur du "
      + "conducteur vers l'arrière, le long du flanc : une zone qu'aucun rétroviseur ne montre, l'angle mort. Un coup d'œil "
      + "par-dessus l'épaule gauche la couvre et y découvre un cycliste qui longe la voiture." },
  n("path", { d: trace(sol), fill: TEINTES_ROUTE.chaussee, "data-r": "chaussee" }),
  n("path", { d: trace(trottoir), fill: TEINTES_ROUTE.trottoir, "data-r": "trottoir" }),
  axiale.map((tt) => n("path", { d: trace(tt), fill: TEINTES_ROUTE.peinture, "data-r": "axiale" })),
  champ("champ-interieur", champInt, 2 * ci.demiAngle), champ("champ-gauche", champExt(miroirs.gauche), miroirs.gauche.champ),
  champ("champ-droit", champExt(miroirs.droit), miroirs.droit.champ),
  bord("bord-interieur-gauche", bordsLunette[0], unitaire([bordsLunette[0][0] - reflet[0], bordsLunette[0][1] - reflet[1]])),
  bord("bord-interieur-droit", bordsLunette[1], unitaire([bordsLunette[1][0] - reflet[0], bordsLunette[1][1] - reflet[1]])),
  bord("bord-gauche", eg.depart, eg.direction), bord("bord-droit", ed.depart, ed.direction),
  zoneHachuree("angle-mort-gauche", zone(miroirs.gauche), A.zones.opacite), zoneHachuree("angle-mort-droit", zone(miroirs.droit), A.zones.opacite),
  n("path", { d: trace(cone), fill: TEINTES_ROUTE.regard, opacity: R.opacite, "data-r": "coup-d-oeil" }),
  n("g", { "data-r": "vue-dessus", "data-echelle": s, "data-x": cx, "data-y": cy }, voiture),
  n("circle", { cx: r.oeil[0], cy: r.oeil[1], r: A.oeil + CHARTE.liseres, fill: CHARTE.carte }),
  n("circle", { cx: r.oeil[0], cy: r.oeil[1], r: A.oeil, fill: CHARTE.texte, "data-r": "oeil" }),
  cyclisteDessus(versCadre(A.cycliste), s),
  nomHaut("gauche", ["Angle mort"]), nomHaut("regard", ["Coup d'œil", "par-dessus l'épaule"]), nomHaut("droite", ["Angle mort"]),
  nomBas("champGauche", ["Rétroviseur", "gauche"]), nomBas("champInterieur", ["Rétroviseur", "intérieur"]), nomBas("champDroit", ["Rétroviseur", "droit"]));
}

export const DESSINS = { "zones-invisibles": zonesInvisibles, retroviseurs, "angles-morts": anglesMorts };
export const GESTES = {};
export { versDom } from "./dessin-svg.js?v=20261013a";
