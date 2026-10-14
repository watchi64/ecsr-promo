/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « visibilité » (C1.2) : ce qu'on ne voit pas depuis le siège (zones-invisibles), ce que montrent les
 * rétroviseurs (retroviseurs) et les angles morts (angles-morts). Les voitures sont celles du kit (js/dessins-kit.js) ; les
 * valeurs sans portée réglementaire sont des choix de dessin, recopiés avec leur raison dans sources/dessins-visibilite.js.
 * Titres et cadres viennent du catalogue des blocs (js/catalogue-blocs.js).
 */
import { n, trouverRole } from "./dessin-svg.js?v=20261013a";
import { CHARTE, cadre, texte, etiquette, vignette, voitureProfil, reperesProfil, voitureDessus, reperesDessus, VOITURE, TEINTES_ROUTE, arrondir,
  arc, couper, bande } from "./dessins-kit.js?v=20261013a";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261013a";

// ===== Géométrie plane =====
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
// la voiture entière et la zone avant, au plus grand qui tienne, avec l'œil, la ligne de visée qui frôle le capot et un cône de
// chantier caché dessous. En bas, la vue d'ensemble : les deux lignes de visée jusqu'au sol, la zone avant et la zone arrière,
// celle-ci longue de 14,6 m pour la voiture du kit, ce qui impose une petite échelle.
const ZONES = {
  marge: 8,                // du bord du cadre au point où une ligne de visée touche le sol, ou à l'arrière de la voiture
  detail: { sol: 86 },
  ensemble: { sol: 136 },
  legende: 16,             // de la ligne du sol à la ligne de base du nom d'une zone
  // Cône de signalisation courant de 50 cm, rouge à bande blanche, posé à 60 cm devant le pare-chocs (m) : hauteur, largeur à la
  // base et au sommet, socle, bande blanche (de 22 à 34 cm du sol).
  cone: { hauteur: 0.5, base: 0.3, sommet: 0.05, socle: 0.36, epaisseurSocle: 0.03, bande: [0.22, 0.34], devant: 0.6 },
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
      "stroke-width": CHARTE.traits.moyen + 2 * CHARTE.liseres, "stroke-linecap": "round" }),
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

  // Cône de chantier posé devant le pare-chocs, dans la vue de détail.
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

// ===== Ce que montrent les rétroviseurs =====
// Chaque miroir montre la route vue de son œil virtuel (l'œil du conducteur reflété), en projection plane : l'axe de la voiture
// vers l'arrière y est le point de fuite. Une droite du sol parallèle à la voiture, à l'écart l (m) du miroir, part du point de
// fuite avec la pente h / l, h étant la hauteur du miroir ; ses points à la distance D sont à f l / D et f h / D du point de fuite,
// f étant la distance focale de l'image, que fixe le champ du miroir.
const CHAMP_EXTERIEUR = 36;              // degrés : champ horizontal d'un miroir extérieur (le même dans angles-morts)
const RETROVISEURS = {
  marge: 8, ecart: 6, rangee: 68,          // bords du cadre ; entre deux rangées ; hauteur d'une rangée
  pastille: { marge: 8, haut: 20, largeur: 53 },   // pastille d'une vignette du kit : à 8 des bords, 20 de haut, « Juste » 52,9 de large
  titre: { ecart: 6 },                     // de la pastille au titre
  legende: { taille: CHARTE.tailles.petite, interligne: 1.25, degagement: 6 },
  boitier: 3,                              // épaisseur du boîtier autour du miroir
  interieur: { largeur: 134, hauteur: 37, arrondi: 0.45, bras: { largeur: 8, hauteur: 6 },
    // Lunette dans le miroir (fractions du miroir) : plus large en haut, plus près de l'œil ; l'horizon dans son quart haut.
    lunette: { haut: 0.80, bas: 0.75, hauteur: 0.78, arrondi: 4 }, horizon: 0.25, hauteurOeil: 1.3, voie: 1.75 },
  exterieur: { largeur: 100, hauteur: 56, arrondis: { exterieurHaut: 18, exterieurBas: 12, interieurHaut: 7, interieurBas: 5 } },
  horizon: { juste: 0.5, droit: 0.36 },    // fraction de la hauteur du miroir, depuis le haut
  lisere: 0.09, faux: 0.46,                // part de la largeur du miroir prise par la carrosserie
  hauteurMiroir: 1.04,     // m : hauteur du centre du miroir extérieur (kit : de 0,97 à 1,105 m)
  ecartBord: 0.82,         // m : du miroir au bord de sa voie (voie de 3,5 m, voiture au milieu, miroir à 0,93 m de l'axe)
  bordure: 0.15,           // m : largeur de la bordure du trottoir, vue de dessus
  axiale: { largeur: 0.10, trait: 1.5, vide: 5, debut: 6, nombre: 4 },   // T'1 de la rue des scènes ; premier trait, en m
  repere: 4, jeuRepere: 1, // repères de mi-hauteur : longueur, et jeu au boîtier
  capitales: 0.35, haut: 0.8,   // milieu des capitales et haut du texte d'Outfit, en tailles de texte
};
const TEINTES_RETRO = {
  ciel: "#E6EFF4", route: TEINTES_ROUTE.chaussee, trottoir: TEINTES_ROUTE.trottoir, bordure: "#B3AE9F",
  caisse: TEINTES_ROUTE.eleve, caisseBord: TEINTES_ROUTE.eleveBord, vitre: TEINTES_ROUTE.vitre,
  habitacle: "#262B28", boitier: "#2E3430", peinture: TEINTES_ROUTE.peinture,
};
const COTE = { gauche: 1, droit: -1 };   // côté intérieur du miroir : à droite pour le gauche, à gauche pour le droit

function vueExterieure({ x, y, cote, horizon, faux = false, bord = false, axiale = false }) {
  const R = RETROVISEURS, E = R.exterieur, W = E.largeur, Hm = E.hauteur, a = E.arrondis, s = COTE[cote], b = R.boitier;
  const f = W / (2 * Math.tan((CHAMP_EXTERIEUR * DEG) / 2));
  // Coins (haut gauche, haut droit, bas droit, bas gauche) : le côté extérieur, plus arrondi, est à gauche pour le miroir gauche.
  const rayons = s > 0 ? [a.exterieurHaut, a.interieurHaut, a.interieurBas, a.exterieurBas] : [a.interieurHaut, a.exterieurHaut, a.exterieurBas, a.interieurBas];
  const verre = rectangleArrondi(x, y, x + W, y + Hm, rayons);
  const boitier = rectangleArrondi(x - b, y - b, x + W + b, y + Hm + b, rayons.map((r) => r + b));
  const yH = y + horizon * Hm;
  const xFuite = (s > 0 ? x + W : x) - s * (faux ? R.faux : R.lisere) * W;   // la caisse, vue de l'arrière, fuit vers ce point
  const ciel = couper(verre, (p) => p[1] - yH), route = couper(verre, (p) => yH - p[1]);
  const interieurDe = (p) => s * (xFuite - p[0]);                 // <= 0 : du côté de la caisse
  const exterieurDe = (p) => -interieurDe(p);
  const auSol = (l, D) => [xFuite - (s * f * l) / D, yH + (f * R.hauteurMiroir) / D];
  const auDelaDe = (l) => (p) => s * (p[0] - xFuite) * R.hauteurMiroir + l * (p[1] - yH);   // <= 0 : au-delà de la droite d'écart l
  const dehors = couper(route, exterieurDe);
  const bordure = bord ? couper(dehors, auDelaDe(R.ecartBord)) : [];
  const trottoir = bord ? couper(dehors, auDelaDe(R.ecartBord + R.bordure)) : [];
  const A = R.axiale;
  const tirets = axiale ? Array.from({ length: A.nombre }, (_, k) => {
    const d1 = A.debut + k * (A.trait + A.vide), d2 = d1 + A.trait;
    return couper(couper([auSol(R.ecartBord, d1), auSol(R.ecartBord + A.largeur, d1), auSol(R.ecartBord + A.largeur, d2), auSol(R.ecartBord, d2)],
      (p) => p[1] - (y + Hm)), exterieurDe);
  }).filter((t) => t.length > 2) : [];
  const caisse = couper(route, interieurDe);
  const vitre = faux ? couper(ciel, interieurDe) : [];
  const yMi = y + Hm / 2, j = R.jeuRepere;
  const repere = (x1, x2) => n("line", { x1, y1: yMi, x2, y2: yMi, stroke: CHARTE.texteDiscret, "stroke-width": CHARTE.traits.fin, "data-r": "mi-hauteur" });
  return n("g", { "data-r": `miroir-${cote}${faux ? "-faux" : ""}` },
    n("path", { d: trace(boitier), fill: TEINTES_RETRO.boitier, "data-r": "boitier" }),
    n("path", { d: trace(verre), fill: TEINTES_RETRO.ciel, "data-r": "verre" }),
    n("path", { d: trace(route), fill: TEINTES_RETRO.route, "data-r": "route" }),
    bordure.length > 2 && n("path", { d: trace(bordure), fill: TEINTES_RETRO.bordure, "data-r": "bord-chaussee" }),
    trottoir.length > 2 && n("path", { d: trace(trottoir), fill: TEINTES_RETRO.trottoir }),
    tirets.map((t) => n("path", { d: trace(t), fill: TEINTES_RETRO.peinture })),
    vitre.length > 2 && n("path", { d: trace(vitre), fill: TEINTES_RETRO.vitre, stroke: TEINTES_RETRO.caisseBord, "stroke-width": CHARTE.traits.fin,
      "stroke-linejoin": "round", "data-r": "vitre" }),
    n("path", { d: trace(caisse), fill: TEINTES_RETRO.caisse, "data-r": faux ? "carrosserie" : "lisere" }),
    repere(x - b - j - R.repere, x - b - j), repere(x + W + b + j, x + W + b + j + R.repere));
}

function vueInterieure({ x, y }) {
  const R = RETROVISEURS, I = R.interieur, W = I.largeur, Hm = I.hauteur, b = R.boitier, Lu = I.lunette;
  const rx = I.arrondi * Hm;
  const verre = rectangleArrondi(x, y, x + W, y + Hm, [rx, rx, rx, rx]);
  const boitier = rectangleArrondi(x - b, y - b, x + W + b, y + Hm + b, [rx + b, rx + b, rx + b, rx + b]);
  const cx = x + W / 2, hl = Lu.hauteur * Hm, yHaut = y + (Hm - hl) / 2, yBas = yHaut + hl;
  const lunette = arrondir([[cx - (Lu.haut * W) / 2, yHaut], [cx + (Lu.haut * W) / 2, yHaut], [cx + (Lu.bas * W) / 2, yBas],
    [cx - (Lu.bas * W) / 2, yBas]], [Lu.arrondi, Lu.arrondi, Lu.arrondi, Lu.arrondi]);
  const yH = yHaut + I.horizon * hl;
  const ciel = couper(lunette, (p) => p[1] - yH), route = couper(lunette, (p) => yH - p[1]);
  // Bords de la voie, à I.voie m de part et d'autre de l'axe : du point de fuite au bas de la lunette, pente hauteurOeil / voie.
  const ecart = ((yBas - yH) * I.voie) / I.hauteurOeil, e = CHARTE.traits.moyen;
  const ligne = (sg) => couper(couper([[cx, yH], [cx + sg * ecart, yBas], [cx + sg * (ecart + e), yBas]], (p) => p[1] - yBas), (p) => yH - p[1]);
  return n("g", { "data-r": "miroir-interieur" },
    n("rect", { x: cx - I.bras.largeur / 2, y: y - b - I.bras.hauteur, width: I.bras.largeur, height: I.bras.hauteur + b, fill: TEINTES_RETRO.boitier }),
    n("path", { d: trace(boitier), fill: TEINTES_RETRO.boitier, "data-r": "boitier" }),
    n("path", { d: trace(verre), fill: TEINTES_RETRO.habitacle, "data-r": "verre" }),
    n("path", { d: trace(ciel), fill: TEINTES_RETRO.ciel }),
    n("path", { d: trace(route), fill: TEINTES_RETRO.route }),
    n("path", { d: trace(ligne(-1)), fill: TEINTES_RETRO.peinture }),
    n("path", { d: trace(ligne(1)), fill: TEINTES_RETRO.peinture }),
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
      + "mi-hauteur et un mince liseré de carrosserie au bord intérieur. Juste : le droit, un peu plus bas, montre le bord de la "
      + "chaussée. Faux : l'extérieur gauche tourné vers la carrosserie en montre une large bande, l'angle mort s'élargit." },
  rangee(0, "juste", "Intérieur", ["toute la lunette arrière"],
    (y) => vueInterieure({ x: droiteVerre - I.largeur, y: y + (R.rangee - hauteurInterieur) / 2 + I.bras.hauteur + b })),
  rangee(1, "juste", "Extérieur gauche", ["horizon à mi-hauteur,", "mince liseré de carrosserie"], exterieur("gauche", R.horizon.juste, { axiale: true })),
  rangee(2, "juste", "Extérieur droit", ["un peu plus bas :", "le bord de la chaussée"], exterieur("droit", R.horizon.droit, { bord: true })),
  rangee(3, "faux", "Extérieur gauche", ["tourné vers la carrosserie :", "angle mort élargi"], exterieur("gauche", R.horizon.juste, { faux: true, axiale: true })));
}

// ===== Les angles morts =====
// Vue du dessus, cap vers le haut. Repère de la voiture : X vers l'avant depuis son centre, Y vers sa droite (m) ; un angle se
// compte depuis le cap, en degrés, négatif à gauche, comme le regard des scènes.
const RAYON_CADRE = 10;                  // le rayon des coins du cadre du kit (tests/dessins-visibilite.test.mjs)
const ANGLES_MORTS = {
  bande: 38,               // hauteur de la bande des étiquettes, au-dessus de la chaussée
  bord: 4.6,               // m : du centre de la voiture aux bords gauche et droit du cadre
  avant: 0.3,              // m : du haut de la chaussée à l'avant de la voiture
  voie: 3.5,               // m : largeur d'une voie (celle des scènes), la voiture au milieu de la sienne
  // Ligne de délimitation des voies T1 (traits de 3 m, intervalles de 10 m : un seul trait dans le cadre) ; X du début du trait.
  t1: { trait: 3, largeur: 0.10, debut: -0.5 },
  cap: -90,                // degrés : la voiture regarde le haut du cadre (0 vers la droite, sens des aiguilles d'une montre)
  regard: { angle: -120, demiOuverture: 16, portee: 22, opacite: 0.4 },   // le coup d'œil des scènes (js/scene-regard.js)
  peripherie: 105,         // degrés : où commence la zone qu'on ne voit plus sans tourner la tête
  champ: CHAMP_EXTERIEUR,  // degrés : champ d'un miroir extérieur, son bord intérieur le long du flanc
  cycliste: [-1.97, -4.1], // m : centre du deux-roues
  oeil: 1.8,               // rayon du point de l'œil
  champs: { opacite: 0.42 },
  zones: { opacite: 0.85 },
  // Étiquettes : ancre x (unités) et cible (m) ; le texte au-dessus de l'ancre, posée au bas de la bande.
  etiquettes: {
    gauche: { x: 38, cible: [-1.2, -3.0] }, droite: { x: 282, cible: [-1.7, 3.45] }, regard: { x: 128, cible: [-0.38, -1.3] },
    jeu: 4,                // de l'ancre au bord de la chaussée
  },
  noms: { bas: 8, marge: 8, interligne: 1.25 },   // noms des champs : du bas du cadre à la dernière ligne de base, des côtés
};
const TEINTES_DESSUS = {
  champ: CHARTE.carte, champBord: CHARTE.carte,
  // Cycliste vu du dessus : teintes des scènes (TEINTES de js/scene-rendu.js, plan 3, tâche 13).
  cycliste: "#F5B06A", cyclisteOmbre: "#D98E4A", cyclisteBord: "#1F2422", tete: "#5A4636", velo: "#2E2E2B", pneu: "#1F2422",
};
// Cycliste sur son vélo vu du dessus, celui des scènes (js/scene-moteur.js, dessinerVelo ; GABARITS.velo : 1,8 sur 0,6 m) :
// roues de 0,7 m, cadre, guidon, dos du cycliste penché, bras, tête. Repère local : x vers l'avant, y vers la droite (m).
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
  const rect = (x1, y1, x2, y2) => trace([[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(p));
  const { epaules: xe, hanches: xh, demiEpaules: we, demiHanches: wh, cou, bassin } = d;
  const dos = `M${ecrit([xe, -we])} C${ecrit([xe + cou, -we])} ${ecrit([xe + cou, we])} ${ecrit([xe, we])}`
    + ` L${ecrit([xh, wh])} C${ecrit([xh - bassin, wh])} ${ecrit([xh - bassin, -wh])} ${ecrit([xh, -wh])} Z`;
  const [tx, ty] = p([V.tete.x, 0]);
  return n("g", { "data-r": "deux-roues", "data-x": x, "data-y": y, "data-longueur": V.longueur * s, "data-largeur": V.largeur * s },
    [-1, 1].map((sg) => n("path", { d: rect(sg * roue - V.roue / 2, -V.pneu / 2, sg * roue + V.roue / 2, V.pneu / 2), fill: TEINTES_DESSUS.pneu })),
    n("path", { d: rect(-roue, -V.cadre / 2, V.guidon.x, V.cadre / 2), fill: TEINTES_DESSUS.velo }),
    n("path", { d: rect(V.guidon.x - V.guidon.epaisseur / 2, -V.largeur / 2, V.guidon.x + V.guidon.epaisseur / 2, V.largeur / 2), fill: TEINTES_DESSUS.velo }),
    n("path", { d: dos, fill: TEINTES_DESSUS.cycliste, stroke: TEINTES_DESSUS.cyclisteBord, "stroke-width": V.contour * s, "stroke-linejoin": "round" }),
    [-1, 1].map((sg) => n("path", { d: trace([V.bras.epaule, V.bras.coude, V.bras.main].map(([lx, ly]) => p([lx, sg * ly])), false), fill: "none",
      stroke: TEINTES_DESSUS.cyclisteOmbre, "stroke-width": V.bras.epaisseur * s, "stroke-linecap": "round", "stroke-linejoin": "round" })),
    n("ellipse", { cx: tx, cy: ty, rx: V.tete.demiLargeur * s, ry: V.tete.demiLongueur * s, fill: TEINTES_DESSUS.tete,
      stroke: TEINTES_DESSUS.cyclisteBord, "stroke-width": V.contour * s }));
}

function anglesMorts() {
  const code = "angles-morts";
  const [L, H] = CATALOGUE[code].cadre;
  const A = ANGLES_MORTS, R = A.regard, Et = A.etiquettes;
  const demiLongueur = VOITURE.longueur / 2;     // m : la voiture du kit, celle des scènes (4,5 m)
  const s = L / (2 * A.bord), cx = L / 2, cy = A.bande + (A.avant + demiLongueur) * s;
  const versCadre = ([X, Y]) => [cx + Y * s, cy - X * s];
  const r = reperesDessus({ x: cx, y: cy, cap: A.cap, echelle: s });
  const voiture = voitureDessus({ x: cx, y: cy, cap: A.cap, echelle: s, retroviseurs: true });
  // La chaussée : sous la bande des étiquettes, jusqu'au bas du cadre, coins du bas arrondis en arcs de cercle du rayon de ceux
  // du cadre (les cordes restent en deçà de l'arc du cadre). Tout ce qui est tracé dessus y est découpé.
  const QUART = 90, DEMI = 180;
  const chaussee = [[0, A.bande], [L, A.bande], ...arc([L - RAYON_CADRE, H - RAYON_CADRE], RAYON_CADRE, 0, QUART),
    ...arc([RAYON_CADRE, H - RAYON_CADRE], RAYON_CADRE, QUART, DEMI)];
  const surChaussee = (poly) => dansConvexe(poly, chaussee);
  const loin = 2 * Math.hypot(L, H);                                  // une longueur qui sort toujours du cadre
  const direction = (angle) => [Math.sin(angle * DEG), -Math.cos(angle * DEG)];

  // Champ du rétroviseur intérieur : de l'œil reflété par le miroir (devant lui, à la distance de l'œil), par les bords de la
  // lunette dessinée.
  const distanceOeil = Math.hypot(r.oeil[0] - r.retroInterieur[0], r.oeil[1] - r.retroInterieur[1]);
  const reflet = [r.retroInterieur[0], r.retroInterieur[1] - distanceOeil];
  const lunette = pointsDe(trouverRole(voiture, "lunette").attributs.d).map(([u, v]) => [cx + v, cy - u]);   // repère de la caisse, tourné
  const pente = (q) => (q[0] - reflet[0]) / (q[1] - reflet[1]);
  const [bordG, bordD] = [lunette.reduce((m, q) => (pente(q) < pente(m) ? q : m)), lunette.reduce((m, q) => (pente(q) > pente(m) ? q : m))];
  const versBord = (q) => unitaire([q[0] - reflet[0], q[1] - reflet[1]]);
  const versLoin = (q) => plusLoin(reflet, versBord(q), loin);
  const champInterieur = surChaussee([bordG, bordD, versLoin(bordD), versLoin(bordG)]);
  // Champs des rétroviseurs extérieurs : du miroir, le bord intérieur le long du flanc, le bord extérieur à A.champ degrés.
  const ARRIERE = 180;                                                // degrés depuis le cap : droit vers l'arrière
  const exterieur = (sg) => direction(sg * (ARRIERE - A.champ));
  const champExterieur = (miroir, sg) => surChaussee([miroir, plusLoin(miroir, exterieur(sg), loin), plusLoin(miroir, direction(ARRIERE), loin)]);
  // Angle mort : derrière le début de la zone qu'on ne voit pas sans tourner la tête, au-delà du bord extérieur du champ du miroir.
  const zone = (miroir, sg) => {
    const debut = direction(sg * A.peripherie);
    return surChaussee([croisement(r.oeil, debut, miroir, exterieur(sg)), plusLoin(r.oeil, debut, loin), plusLoin(miroir, exterieur(sg), loin)]);
  };
  const cone = surChaussee([r.oeil, plusLoin(r.oeil, direction(R.angle - R.demiOuverture), R.portee * s),
    plusLoin(r.oeil, direction(R.angle + R.demiOuverture), R.portee * s)]);
  const t1 = (Y) => surChaussee([[A.t1.debut, Y - A.t1.largeur / 2], [A.t1.debut, Y + A.t1.largeur / 2],
    [A.t1.debut - A.t1.trait, Y + A.t1.largeur / 2], [A.t1.debut - A.t1.trait, Y - A.t1.largeur / 2]].map(versCadre));

  // Les champs, clairs, sans contour ; seuls leurs bords qui s'écartent sont tracés (le bord extérieur d'un champ extérieur, qui
  // borne l'angle mort, et les deux bords du champ intérieur) : des traits le long des flancs passeraient pour du marquage.
  const champ = (role, poly) => n("path", { d: trace(poly), fill: TEINTES_DESSUS.champ, "fill-opacity": A.champs.opacite, "data-r": role });
  const bord = (role, p, u) => {
    const q = sortie(p, u, chaussee);
    return n("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: TEINTES_DESSUS.champBord, "stroke-width": CHARTE.traits.fin,
      "stroke-linecap": "round", "data-r": role });
  };
  const nom = (cle, lignes) => etiquette({ cible: versCadre(Et[cle].cible), ancre: [Et[cle].x, A.bande - Et.jeu], lignes, ancrage: "middle",
    taille: CHARTE.tailles.petite, role: `nom-${cle}` });
  const t = CHARTE.tailles.petite, pas = t * A.noms.interligne, yNom = H - A.noms.bas;
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "La voiture vue du dessus. Le rétroviseur intérieur montre l'arrière, dans l'axe ; chaque rétroviseur extérieur, un "
      + "cône qui s'écarte vers l'arrière et sur le côté. Entre ce cône et ce que le conducteur voit sans tourner la tête, de chaque "
      + "côté, à l'arrière du conducteur, une zone qu'aucun rétroviseur ne montre : l'angle mort. Un coup d'œil par-dessus l'épaule "
      + "gauche le couvre, et y découvre un cycliste." },
  n("path", { d: trace(chaussee), fill: TEINTES_ROUTE.chaussee, "data-r": "chaussee" }),
  [-1, 1].map((sg) => n("path", { d: trace(t1((sg * A.voie) / 2)), fill: TEINTES_ROUTE.peinture, "data-r": "t1" })),
  champ("champ-interieur", champInterieur), champ("champ-gauche", champExterieur(r.retroGauche, -1)), champ("champ-droit", champExterieur(r.retroDroit, 1)),
  bord("bord-interieur-gauche", bordG, versBord(bordG)), bord("bord-interieur-droit", bordD, versBord(bordD)),
  bord("bord-gauche", r.retroGauche, exterieur(-1)), bord("bord-droit", r.retroDroit, exterieur(1)),
  zoneHachuree("angle-mort-gauche", zone(r.retroGauche, -1), A.zones.opacite), zoneHachuree("angle-mort-droit", zone(r.retroDroit, 1), A.zones.opacite),
  n("path", { d: trace(cone), fill: TEINTES_ROUTE.regard, opacity: R.opacite, "data-r": "coup-d-oeil" }),
  n("g", { "data-r": "vue-dessus", "data-echelle": s, "data-x": cx, "data-y": cy }, voiture),
  n("circle", { cx: r.oeil[0], cy: r.oeil[1], r: A.oeil + CHARTE.liseres, fill: CHARTE.carte }),
  n("circle", { cx: r.oeil[0], cy: r.oeil[1], r: A.oeil, fill: CHARTE.texte, "data-r": "oeil" }),
  cyclisteDessus(versCadre(A.cycliste), s),
  nom("gauche", ["Angle mort"]), nom("droite", ["Angle mort"]), nom("regard", ["Coup d'œil", "par-dessus l'épaule"]),
  texte(cx, yNom - pas, "Rétroviseur", { taille: t, ancrage: "middle", role: "nom-champ-interieur" }),
  texte(cx, yNom, "intérieur", { taille: t, ancrage: "middle" }),
  texte(A.noms.marge, yNom, "Rétroviseur gauche", { taille: t, role: "nom-champ-gauche" }),
  texte(L - A.noms.marge, yNom, "Rétroviseur droit", { taille: t, ancrage: "end", role: "nom-champ-droit" }));
}

export const DESSINS = { "zones-invisibles": zonesInvisibles, retroviseurs, "angles-morts": anglesMorts };
export const GESTES = {};
export { versDom } from "./dessin-svg.js?v=20261013a";
