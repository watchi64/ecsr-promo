/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « visibilité » (C1.2) : ce qu'on ne voit pas depuis le siège (zones-invisibles), le réglage des
 * rétroviseurs (retroviseurs) et les angles morts (angles-morts). Les voitures sont celles du kit (js/dessins-kit.js) ; un seul
 * modèle de rétroviseur, tiré de la géométrie du kit, sert aux deux derniers dessins. Les valeurs sans portée réglementaire
 * sont des choix de dessin, recopiés avec leur raison dans sources/dessins-visibilite.js. Titres et cadres viennent du
 * catalogue des blocs (js/catalogue-blocs.js).
 */
import { n, trouverRole } from "./dessin-svg.js?v=20261027a";
import { CHARTE, METRIQUES_POLICE, MISE_EN_PAGE, REGARD_SCENES, cadre, texte, etiquette, voitureProfil, reperesProfil,
  voitureDessus, reperesDessus, VOITURE, TEINTES_ROUTE, MIROIR_INTERIEUR, miroirInterieur, arrondir, couper, coord, trace, entre } from "./dessins-kit.js?v=20261027a";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261027a";
import { cycliste, GABARIT_VELO } from "./piece-cycliste.js?v=20261027a";

// ===== Géométrie plane =====
const DEG = Math.PI / 180;
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

// ===== Zones que le conducteur ne voit pas =====
// Style schématique (décision du formateur du 15/10/2026 : aplats, aucune texture) : un aplat de la teinte « faux » de la charte,
// translucide (TEINTES_ZONE.opacite), le même dans les deux dessins qui en montrent ; il laisse voir le sol dessous.
const TEINTES_ZONE = { fond: CHARTE.faux, opacite: 0.4 };
const zoneMasquee = (role, poly) => n("g", { "data-r": role },
  n("path", { d: trace(poly), fill: TEINTES_ZONE.fond, "fill-opacity": TEINTES_ZONE.opacite, "data-r": "zone" }));

// ===== Ce qu'on ne voit pas depuis le siège =====
// Deux vues de la voiture du kit de profil, côté conducteur (sens « gauche » : l'avant à gauche). En haut, le détail de l'avant :
// la voiture entière et la zone avant, au plus grand qui tienne, avec l'œil, la ligne de visée qui frôle le capot et un cône
// caché dessous. En bas, la vue d'ensemble : les deux lignes de visée jusqu'au sol, la zone avant et la zone arrière, celle-ci
// longue de 21,8 m pour la voiture du kit, ce qui impose une petite échelle. Style schématique (décision du formateur du
// 15/10/2026) : la voiture en silhouette (voitureProfil, option schema), les zones en aplats.
const ZONES = {
  marge: 8,                // du bord du cadre au point où une ligne de visée touche le sol, ou à l'arrière de la voiture
  detail: { sol: 86 },
  ensemble: { sol: 136 },
  legende: 16,             // de la ligne du sol à la ligne de base du nom d'une zone
  // Cône de signalisation courant de 50 cm, rouge à bande blanche, posé 30 cm devant le pare-chocs (m) : hauteur, largeur à la
  // base et au sommet, socle, bande blanche (de 22 à 33 cm du sol).
  cone: { hauteur: 0.50, base: 0.30, sommet: 0.04, socle: 0.36, epaisseurSocle: 0.03, bande: [0.22, 0.33], devant: 0.3 },
  tirets: "4 3",           // pointillé des lignes de visée
  etiquettes: { oeil: [-30, -28], obstacle: [-22, -26] },   // ancres, depuis l'œil et depuis la pointe du cône
  surPointe: 1.2,          // le point de l'étiquette de l'obstacle, posé sur la pointe du cône : son centre, à cette distance au-dessus
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
      zoneMasquee("zone-avant", [r.solAvant, solAv, aAbscisse(r.oeil, r.hautCapot, r.solAvant[0])]),
      arriere && zoneMasquee("zone-arriere", [r.solArriere, aAbscisse(r.oeil, r.hautCoffre, r.solArriere[0]), solAr]),
      n("line", { x1: solAv[0] - ZONES.marge / 2, y1: sol, x2: finSol + ZONES.marge / 2, y2: sol, stroke: TEINTES_PROFIL.sol,
        "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round", "data-r": "sol" }),
      voitureProfil({ x, y: sol, echelle, sens: "gauche", schema: true }),
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
    description: "La voiture de profil et l'œil du conducteur : la ligne de visée qui frôle le capot touche le sol devant la "
      + "voiture, celle qui frôle le bas de la lunette arrière touche le sol loin derrière. Devant le capot et derrière le coffre, "
      + "le sol n'est pas visible depuis le siège : un obstacle bas posé devant la voiture reste caché." },
  detail.noeud, cone,
  etiquette({ cible: r.oeil, ancre: [r.oeil[0] + eo[0], r.oeil[1] + eo[1]], lignes: ["Œil du conducteur"], ancrage: "end", role: "nom-oeil" }),
  etiquette({ cible: [pointe[0], pointe[1] - Z.surPointe], ancre: [pointe[0] + eb[0], pointe[1] + eb[1]], lignes: ["Obstacle caché"], ancrage: "end",
    role: "nom-obstacle" }),
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
// Simplification, écrite dans les sources : l'œil reflété est tenu devant le miroir, 3 cm hors du flanc, quelle que soit
// l'orientation, comme pour un verre au ras du flanc. Un miroir plan réellement tourné déplace son œil reflété ; avec le verre du
// kit, dont les 5 cm intérieurs sont en dedans du flanc, la caisse se verrait en coin, plus large vers le bas du miroir. Le dessin
// « retroviseurs » garde ce réglage (son point de fuite) et dessine la caisse en coin, en schéma (voir sa section).
export const PART_LISERE = 0.09;
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

// ===== Régler les rétroviseurs =====
// Deux temps, dans l'ordre du cours et du formateur (retour du 22/10/2026) : 1, le rétroviseur intérieur cadre toute la lunette
// arrière ; 2, les rétroviseurs extérieurs, côte à côte comme le conducteur les voit (le gauche à gauche) : l'horizon au milieu de
// la hauteur du miroir et, dans le coin inférieur côté voiture (en bas à droite du gauche, en bas à gauche du droit), la poignée de
// la portière arrière ; le reste du miroir montre la route derrière.
//
// La route d'une image extérieure est celle du miroir plan du kit, au réglage d'« angles-morts » (miroirExterieur, PART_LISERE) : la
// direction de l'arrière y fuit vers un point de l'horizon ; une droite du sol parallèle à la voiture, à l'écart l (m) de l'œil
// reflété, part de ce point avec la pente h / l (h, hauteur de l'œil reflété) ; son point à la distance D (m, le long de l'axe) est
// à f l / D et f h / D du point de fuite. La rue, celle des scènes avec stationnement : à double sens, voies de 3,5 m, une bande
// de stationnement de 2 m le long de chaque trottoir, la voiture au milieu de la voie de droite ; à sa gauche l'axiale T'1, la voie
// d'en face et le trottoir d'en face ; à sa droite la bande de stationnement, la bordure et le trottoir.
// La caisse et la poignée sont un schéma, dont les choix sont écrits dans les sources : la caisse, un coin dans le bas du miroir
// côté voiture, mince à l'horizon et large en bas ; la poignée, un pictogramme assez grand pour se reconnaître sur un téléphone,
// posé dans ce coin. Le miroir plan du kit, vu exactement, ne la montrerait que comme un trait de moins d'une unité de large.
const RUE = { voie: 3.5, stationnement: 2.0, bordure: 0.15 };
const RETROVISEURS = {
  marge: 8, ecart: 6,                      // bords du cadre ; entre les deux temps
  carte: MISE_EN_PAGE.margePastille,       // du bord d'une carte à son contenu
  // Numéro d'un temps : de la hauteur de la pastille du kit, le numéro en Outfit 700, le cercle d'un trait moyen.
  numero: { rayon: MISE_EN_PAGE.hauteurPastille / 2, taille: CHARTE.tailles.etiquette, graisse: 700, trait: CHARTE.traits.moyen },
  titre: { ecart: 6 },                     // du numéro au titre
  legende: { taille: CHARTE.tailles.petite, degagement: 6 },
  capitales: METRIQUES_POLICE.milieuCapitales, haut: METRIQUES_POLICE.haut, bas: METRIQUES_POLICE.bas,   // repères d'Outfit
  boitier: 3,                              // épaisseur du boîtier autour du miroir
  // Rétroviseur intérieur : verre de 134 unités de large ; le verre, la lunette qu'il cadre et l'horizon sont ceux de la pièce du
  // kit (miroirInterieur), la même que dans la vignette d'« installation » ; œil reflété à 1,3 m du sol ; carte de 68 unités.
  interieur: { largeur: 134, bras: { largeur: 8, hauteur: 6 }, hauteurOeil: 1.3, carte: 68 },
  // Rétroviseurs extérieurs : verre de 122 sur 74 unités (le côté extérieur plus arrondi) ; de la ligne de légende à celle des noms
  // (« Gauche », « Droit »), puis du bas des noms au haut des boîtiers.
  exterieur: { largeur: 122, hauteur: 74, arrondis: { exterieurHaut: 20, exterieurBas: 14, interieurHaut: 8, interieurBas: 6 },
    noms: 17, degagement: 5 },
  horizon: 0.5,                            // fraction de la hauteur d'un miroir extérieur, depuis le haut : le milieu
  hauteurMiroir: 1.04,     // m : hauteur du centre du miroir extérieur (kit : de 0,97 à 1,105 m), celle de son œil reflété
  // Axiale T'1 de la rue des scènes : traits de 1,5 m, intervalles de 5 m, 0,10 m de large ; premier trait (m de l'œil reflété),
  // un par image extérieure et intérieure ; un trait plus court que `tiretMin` unités dans l'image n'est plus dessiné.
  axiale: { largeur: 0.10, trait: 1.5, vide: 5, exterieur: 23, interieur: 16, tiretMin: 1 },
  // La caisse dans un miroir extérieur : sous l'horizon, du bord intérieur à une courbe qui part, à l'horizon, de la part `haut` de
  // la largeur (le liseré du réglage, PART_LISERE) et s'en écarte jusqu'à la part `bas`, au bas du verre ; elle s'élargit vite sous
  // l'horizon puis descend presque droite, en `pas` segments ; `hors` : de combien ses sommets du bord intérieur sont posés hors du
  // verre, que le découpage par le verre ramène sur son bord.
  caisse: { haut: PART_LISERE, bas: 0.32, courbure: 2, pas: 16, hors: 1 },
  // La poignée : centre (parts de la largeur depuis le bord intérieur et de la hauteur depuis le haut), longueur et hauteur
  // (unités) ; le point de son étiquette, sous elle (de son bord bas au centre du point).
  poignee: { centre: [0.14, 0.82], longueur: 20, hauteur: 7, point: 4, levier: { longueur: 14, hauteur: 2.6 } },
  filet: 9,                                // du bas des boîtiers extérieurs à l'ancre de l'étiquette des poignées
  repere: 4, jeuRepere: 1, // repères de mi-hauteur : longueur, et jeu au boîtier
};
// La voiture dans un miroir extérieur : la caisse et son bord aux teintes de la voiture de l'élève ; la poignée, un creux sombre
// (le texte de la charte) et son levier clair.
const TEINTES_RETRO = {
  ciel: "#E6EFF4", route: TEINTES_ROUTE.chaussee, trottoir: TEINTES_ROUTE.trottoir, bordure: "#B3AE9F",
  caisse: TEINTES_ROUTE.eleve, caisseBord: TEINTES_ROUTE.eleveBord, poignee: CHARTE.texte, levier: "#9DAE84",
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

// Un miroir extérieur, son verre de coin haut gauche (x, y) : le boîtier, le ciel, la route, la caisse et sa poignée, les repères de
// mi-hauteur. Rend le nœud et la poignée (son centre et son bord bas), que vise l'étiquette.
function vueExterieure({ x, y, cote }) {
  const R = RETROVISEURS, E = R.exterieur, W = E.largeur, Hm = E.hauteur, a = E.arrondis, s = COTE_IMAGE[cote], b = R.boitier;
  const m = miroirExterieur(cote, PART_LISERE), f = m.focale * W, h = R.hauteurMiroir;
  // Coins (haut gauche, haut droit, bas droit, bas gauche) : le côté extérieur, plus arrondi, est à gauche pour le miroir gauche.
  const rayons = s > 0 ? [a.exterieurHaut, a.interieurHaut, a.interieurBas, a.exterieurBas] : [a.interieurHaut, a.exterieurHaut, a.exterieurBas, a.interieurBas];
  const verre = rectangleArrondi(x, y, x + W, y + Hm, rayons);
  const boitier = rectangleArrondi(x - b, y - b, x + W + b, y + Hm + b, rayons.map((r) => r + b));
  const yH = y + R.horizon * Hm, bas = y + Hm;
  const interieur = s > 0 ? x + W : x;                          // bord du verre côté voiture
  const fuite = interieur - s * m.fuite * W;                    // point de fuite de la direction de l'arrière
  const route = couper(verre, (p) => yH - p[1]);
  const auDelaDe = (l) => (p) => s * (p[0] - fuite) * h + l * (p[1] - yH);   // <= 0 : au-delà de la droite d'écart l
  const dehors = couper(route, (p) => s * (p[0] - fuite));     // la route du côté extérieur du point de fuite
  // Écarts au miroir (m) : l'axiale à gauche, la bordure de droite, au-delà de la bande de stationnement ; la bordure d'en face.
  const centre = VOITURE.retroviseur.centre;
  const ecartAxiale = RUE.voie / 2 - centre, ecartBord = RUE.voie / 2 + RUE.stationnement - centre;
  const ecartEnFace = (3 * RUE.voie) / 2 + RUE.stationnement - centre;
  const trottoir = (l, role) => [n("path", { d: trace(couper(dehors, auDelaDe(l))), fill: TEINTES_RETRO.bordure, "data-r": role }),
    n("path", { d: trace(couper(dehors, auDelaDe(l + RUE.bordure))), fill: TEINTES_RETRO.trottoir })];
  const gauche = cote === "gauche";
  const tirets = gauche ? tiretsAxiale({ fuite, yH, f, h, l: ecartAxiale, signe: s, debut: R.axiale.exterieur, dans: verre }) : [];
  // La caisse : sous l'horizon, du bord intérieur à une courbe qui s'écarte de lui de la part `haut` de la largeur, à l'horizon, à
  // la part `bas`, au bas du verre : 1 - (1 - t) ** courbure de l'écart, t allant de 0 à l'horizon à 1 au bas.
  const C = R.caisse;
  const bordCaisse = Array.from({ length: C.pas + 1 }, (_, k) => {
    const t = k / C.pas;
    return [interieur - s * W * (C.haut + (C.bas - C.haut) * (1 - (1 - t) ** C.courbure)), yH + t * (bas - yH)];
  });
  const caisse = dansConvexe([[interieur + s * C.hors, yH], ...bordCaisse, [interieur + s * C.hors, bas + C.hors]], verre);
  // La poignée, en pictogramme : un creux aux bouts ronds, couché, et son levier, plus court et plus mince, au milieu.
  const P = R.poignee, milieu = [interieur - s * P.centre[0] * W, y + P.centre[1] * Hm];
  const [l2, h2] = [P.longueur / 2, P.hauteur / 2];
  const poignee = rectangleArrondi(milieu[0] - l2, milieu[1] - h2, milieu[0] + l2, milieu[1] + h2, [h2, h2, h2, h2]);
  const [lv2, hv2] = [P.levier.longueur / 2, P.levier.hauteur / 2];
  const levier = rectangleArrondi(milieu[0] - lv2, milieu[1] - hv2, milieu[0] + lv2, milieu[1] + hv2, [hv2, hv2, hv2, hv2]);
  const j = R.jeuRepere;
  const repere = (x1, x2) => n("line", { x1, y1: yH, x2, y2: yH, stroke: CHARTE.texteDiscret, "stroke-width": CHARTE.traits.fin, "data-r": "mi-hauteur" });
  const noeud = n("g", { "data-r": `miroir-${cote}`, "data-champ": m.champ, "data-lisere": m.beta, "data-focale": f, "data-hauteur": h,
    "data-fuite": fuite },
  n("path", { d: trace(boitier), fill: TEINTES_RETRO.boitier, "data-r": "boitier" }),
  n("path", { d: trace(verre), fill: TEINTES_RETRO.ciel, "data-r": "verre" }),
  n("path", { d: trace(route), fill: TEINTES_RETRO.route, "data-r": "route" }),
  gauche ? trottoir(ecartEnFace, "bord-en-face") : trottoir(ecartBord, "bord-chaussee"),
  tirets.map((t) => n("path", { d: trace(t.coins), fill: TEINTES_RETRO.peinture, "data-r": "tiret", "data-d1": t.d1, "data-d2": t.d2,
    "data-l": ecartAxiale })),
  n("line", { x1: x, y1: yH, x2: x + W, y2: yH, stroke: CHARTE.texteDiscret, "stroke-width": CHARTE.traits.fin, "data-r": "horizon" }),
  n("path", { d: trace(caisse), fill: TEINTES_RETRO.caisse, "data-r": "caisse" }),
  n("path", { d: trace(dansConvexe(bordCaisse, verre), false), fill: "none", stroke: TEINTES_RETRO.caisseBord, "stroke-width": CHARTE.traits.fin,
    "stroke-linejoin": "round", "data-r": "bord-caisse" }),
  n("path", { d: trace(poignee), fill: TEINTES_RETRO.poignee, "data-r": "poignee", "data-x": milieu[0], "data-y": milieu[1] }),
  n("path", { d: trace(levier), fill: TEINTES_RETRO.levier, "data-r": "levier" }),
  repere(x - b - j - R.repere, x - b - j), repere(x + W + b + j, x + W + b + j + R.repere));
  return { noeud, poignee: { centre: milieu, bas: milieu[1] + h2 } };
}

function vueInterieure({ x, y }) {
  const R = RETROVISEURS, I = R.interieur, W = I.largeur, b = R.boitier, h = I.hauteurOeil;
  const { hauteur: Hm, rayon: rx, verre, coins, lunette, horizon: yH } = miroirInterieur({ x, y, largeur: W });
  const boitier = rectangleArrondi(x - b, y - b, x + W + b, y + Hm + b, [rx + b, rx + b, rx + b, rx + b]);
  const cx = x + W / 2;
  // Focale : le haut de la lunette, sa partie la plus large dans l'image, couvre le champ du rétroviseur intérieur (angles-morts).
  const f = ((coins[1][0] - coins[0][0]) / 2) / Math.tan(champInterieur().demiAngle * DEG);
  const ciel = couper(lunette, (p) => p[1] - yH), route = couper(lunette, (p) => yH - p[1]);
  // Le miroir intérieur garde la gauche et la droite du conducteur : l'axiale à gauche, la bordure et le trottoir à droite.
  const aDroiteDe = (l) => (p) => l * (p[1] - yH) - (p[0] - cx) * h;   // <= 0 : à droite de la droite du sol d'écart l, à droite
  const aGaucheDe = (l) => (p) => l * (p[1] - yH) + (p[0] - cx) * h;   // <= 0 : à gauche de la droite du sol d'écart l, à gauche
  const ecart = RUE.voie / 2, bord = RUE.voie / 2 + RUE.stationnement, enFace = (3 * RUE.voie) / 2 + RUE.stationnement;
  const tirets = tiretsAxiale({ fuite: cx, yH, f, h, l: ecart, signe: 1, debut: R.axiale.interieur, dans: route });
  return n("g", { "data-r": "miroir-interieur", "data-champ": 2 * champInterieur().demiAngle, "data-focale": f },
    n("rect", { x: cx - I.bras.largeur / 2, y: y - b - I.bras.hauteur, width: I.bras.largeur, height: I.bras.hauteur + b, fill: TEINTES_RETRO.boitier }),
    n("path", { d: trace(boitier), fill: TEINTES_RETRO.boitier, "data-r": "boitier" }),
    n("path", { d: trace(verre), fill: TEINTES_RETRO.habitacle, "data-r": "verre" }),
    n("path", { d: trace(ciel), fill: TEINTES_RETRO.ciel }),
    n("path", { d: trace(route), fill: TEINTES_RETRO.route }),
    n("path", { d: trace(couper(route, aDroiteDe(bord))), fill: TEINTES_RETRO.bordure, "data-r": "bord-chaussee" }),
    n("path", { d: trace(couper(route, aDroiteDe(bord + RUE.bordure))), fill: TEINTES_RETRO.trottoir }),
    n("path", { d: trace(couper(route, aGaucheDe(enFace))), fill: TEINTES_RETRO.bordure, "data-r": "bord-en-face" }),
    n("path", { d: trace(couper(route, aGaucheDe(enFace + RUE.bordure))), fill: TEINTES_RETRO.trottoir }),
    tirets.map((t) => n("path", { d: trace(t.coins), fill: TEINTES_RETRO.peinture, "data-r": "tiret" })),
    n("path", { d: trace(lunette), fill: "none", stroke: TEINTES_RETRO.habitacle, "stroke-width": CHARTE.traits.fin, "data-r": "lunette" }));
}

// Numéro d'un temps : un disque clair cerclé de foncé, son numéro au centre, comme les repères numérotés des étapes de
// js/dessins-dessus.js (copie privée : ce repère n'est pas exporté).
function numero(rang, [x, y]) {
  const N = RETROVISEURS.numero;
  return n("g", { "data-r": `numero-${rang}`, "data-x": x, "data-y": y },
    n("circle", { cx: x, cy: y, r: N.rayon, fill: CHARTE.carte, stroke: CHARTE.texte, "stroke-width": N.trait }),
    texte(x, y + METRIQUES_POLICE.milieuCapitales * N.taille, String(rang), { taille: N.taille, ancrage: "middle", graisse: N.graisse }));
}

function retroviseurs() {
  const code = "retroviseurs";
  const [L, H] = CATALOGUE[code].cadre;
  const R = RETROVISEURS, N = R.numero, I = R.interieur, E = R.exterieur, b = R.boitier, t = R.legende.taille, c = R.carte;
  const largeur = L - 2 * R.marge;
  // Un temps : sa carte, son numéro en haut à gauche, le titre à côté, une ligne de légende dessous, puis ses miroirs.
  const temps = (rang, y, hauteur, titre, legende, miroirs) => {
    const centre = [R.marge + c + N.rayon, y + c + N.rayon];
    const base = y + c + 2 * N.rayon + R.legende.degagement + R.haut * t;
    return n("g", { "data-r": `temps-${rang}`, "data-y": y },
      n("rect", { x: R.marge, y, width: largeur, height: hauteur, rx: MISE_EN_PAGE.rayonVignette, fill: CHARTE.carte, stroke: CHARTE.filet,
        "stroke-width": CHARTE.traits.fin, "data-r": "carte" }),
      numero(rang, centre),
      n("g", { "data-r": `legende-${rang}` },
        texte(centre[0] + N.rayon + R.titre.ecart, centre[1] + R.capitales * t, titre, { taille: t, graisse: 600 }),
        texte(R.marge + c, base, legende, { taille: t })),
      miroirs(base));
  };
  // 1 : le rétroviseur intérieur, à droite de sa carte, centré en hauteur.
  const y1 = R.marge, hauteurInterieur = I.bras.hauteur + 2 * b + I.largeur / MIROIR_INTERIEUR.rapport;
  const droiteVerre = R.marge + largeur - c - b;
  // 2 : les rétroviseurs extérieurs, le gauche à gauche, chacun avec ses repères de mi-hauteur, sous leurs noms ; dessous,
  // l'étiquette commune des deux poignées.
  const y2 = y1 + I.carte + R.ecart;
  const groupe = E.largeur + 2 * (b + R.jeuRepere + R.repere);
  const ecartMiroirs = largeur - 2 * c - 2 * groupe;
  const xGauche = R.marge + c + (groupe - E.largeur) / 2, xDroit = xGauche + groupe + ecartMiroirs;
  const exterieurs = (base) => {
    const yNoms = base + E.noms, yVerre = yNoms + R.bas * t + E.degagement + b;
    const [g, d] = [["gauche", xGauche], ["droit", xDroit]].map(([cote, x]) => vueExterieure({ x, y: yVerre, cote }));
    const ancre = [L / 2, yVerre + E.hauteur + b + R.filet];
    const sous = (v) => [v.poignee.centre[0], v.poignee.bas + R.poignee.point];
    return [
      texte(xGauche + E.largeur / 2, yNoms, "Gauche", { taille: t, ancrage: "middle", role: "nom-gauche" }),
      texte(xDroit + E.largeur / 2, yNoms, "Droit", { taille: t, ancrage: "middle", role: "nom-droit" }),
      g.noeud, d.noeud,
      etiquette({ cible: sous(g), ancre, lignes: ["Poignée de la portière arrière"], ancrage: "middle", taille: t, role: "nom-poignee-gauche" }),
      etiquette({ cible: sous(d), ancre, lignes: [], ancrage: "middle", taille: t, role: "nom-poignee-droit" })];
  };
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Dans l'ordre. 1 : le rétroviseur intérieur cadre toute la lunette arrière. 2 : les rétroviseurs extérieurs, le gauche "
      + "et le droit, côte à côte : l'horizon au milieu de la hauteur du miroir ; dans le coin inférieur côté voiture, en bas à droite "
      + "du gauche et en bas à gauche du droit, un coin de carrosserie et la poignée de la portière arrière ; le reste du miroir "
      + "montre la route derrière." },
  temps(1, y1, I.carte, "Rétroviseur intérieur", "toute la lunette arrière",
    () => vueInterieure({ x: droiteVerre - I.largeur, y: y1 + (I.carte - hauteurInterieur) / 2 + I.bras.hauteur + b })),
  temps(2, y2, H - R.marge - y2, "Rétroviseurs extérieurs", "l'horizon au milieu", exterieurs));
}

// ===== Les angles morts =====
// Style schématique (décision du formateur du 15/10/2026) : la voiture en silhouette (voitureDessus, option schema), avec ses
// rétroviseurs, d'où partent les champs ; les angles morts en aplats, le cycliste en pictogramme (js/piece-cycliste.js).
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
  regard: { angle: -120, demiOuverture: 50, portee: REGARD_SCENES.portee, opacite: REGARD_SCENES.opacite },
  cycliste: [-1.0, -1.85], // m : centre du deux-roues, le long du flanc arrière gauche
  oeil: 1.8,               // rayon du point de l'œil
  champs: { opacite: 0.42 },
  // Étiquettes : ancre x (unités) et cible (m) ; en haut, le texte au-dessus de l'ancre, posée au bas de la bande ; en bas, le
  // texte sous l'ancre, posée en haut de la bande. Le coup d'œil : sa cible sur l'axe du regard, à `distance` m de l'œil, derrière lui,
  // entre le deux-roues et le point de l'étiquette « Angle mort ».
  etiquettes: {
    gauche: { x: 38, cible: [-1.0, -3.4] }, regard: { x: 128, distance: 2.6 }, droite: { x: 282, cible: [-1.0, 2.3] },
    champGauche: { x: 64, cible: [-3.3, -1.3] }, champInterieur: { x: 192, cible: [-3.3, 0] }, champDroit: { x: 266, cible: [-3.3, 1.1] },
    jeu: 4,                // de l'ancre au bord de la chaussée
  },
};
const TEINTES_DESSUS = { champ: CHARTE.carte, champBord: CHARTE.carte };
// Le cycliste de la scène « sortie-portiere » (js/piece-cycliste.js : gabarit, teintes, dessin en mètres, x vers l'avant), centré
// en (x, y) du cadre, cap vers le haut (rotate(-90) : l'avant du vélo vers le haut du cadre), à `s` unités par mètre (scale).
function cyclisteDessus([x, y], s) {
  return cycliste({ "data-r": "deux-roues", "data-x": x, "data-y": y, "data-longueur": GABARIT_VELO.longueur * s,
    "data-largeur": GABARIT_VELO.largeur * s, transform: `translate(${coord(x)} ${coord(y)}) rotate(-90) scale(${coord(s)})` });
}

function anglesMorts() {
  const code = "angles-morts";
  const [L, H] = CATALOGUE[code].cadre;
  const A = ANGLES_MORTS, R = A.regard, Et = A.etiquettes, Ru = A.rue;
  const s = L / (A.gauche + A.droite), cx = A.gauche * s, cy = A.bande + (A.avant + VOITURE.longueur / 2) * s;
  const versCadre = ([X, Y]) => [cx + Y * s, cy - X * s];                   // cap vers le haut
  const versCadreDirection = ([dX, dY]) => [dY, -dX];
  const r = reperesDessus({ x: cx, y: cy, cap: CAP_HAUT, echelle: s });
  const voiture = voitureDessus({ x: cx, y: cy, cap: CAP_HAUT, echelle: s, retroviseurs: true, schema: true });
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
  const nomHaut = (cle, lignes, cible = versCadre(Et[cle].cible)) => etiquette({ cible, ancre: [Et[cle].x, haut - Et.jeu], lignes,
    ancrage: "middle", taille: t, role: `nom-${cle}` });
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
  zoneMasquee("angle-mort-gauche", zone(miroirs.gauche)), zoneMasquee("angle-mort-droit", zone(miroirs.droit)),
  n("path", { d: trace(cone), fill: TEINTES_ROUTE.regard, opacity: R.opacite, "data-r": "coup-d-oeil" }),
  n("g", { "data-r": "vue-dessus", "data-echelle": s, "data-x": cx, "data-y": cy }, voiture),
  n("circle", { cx: r.oeil[0], cy: r.oeil[1], r: A.oeil + CHARTE.liseres, fill: CHARTE.carte }),
  n("circle", { cx: r.oeil[0], cy: r.oeil[1], r: A.oeil, fill: CHARTE.texte, "data-r": "oeil" }),
  cyclisteDessus(versCadre(A.cycliste), s),
  nomHaut("gauche", ["Angle mort"]), nomHaut("droite", ["Angle mort"]),
  nomHaut("regard", ["Coup d'œil", "par-dessus l'épaule"], plusLoin(r.oeil, direction(R.angle), Et.regard.distance * s)),
  nomBas("champGauche", ["Rétroviseur", "gauche"]), nomBas("champInterieur", ["Rétroviseur", "intérieur"]), nomBas("champDroit", ["Rétroviseur", "droit"]));
}

export const DESSINS = { "zones-invisibles": zonesInvisibles, retroviseurs, "angles-morts": anglesMorts };
export const GESTES = {};
export { versDom } from "./dessin-svg.js?v=20261027a";
