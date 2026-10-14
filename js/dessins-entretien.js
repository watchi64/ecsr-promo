/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « entretien » (C1.1, le tour du véhicule et les pneus) : sous le capot, lire un niveau, contrôler un
 * pneu, la pression des pneus.
 *
 * Chaque dimension part d'une mesure (centimètres sous le capot, millimètres pour le pneu, mètres pour la voiture du kit),
 * ramenée en unités du cadre par l'échelle du dessin, ou d'une place de la mise en page, nommée : rien n'est placé à l'œil.
 * La seule valeur réglementaire est la profondeur minimale des sculptures, 1,6 mm, que marquent les témoins d'usure
 * (TEMOIN_MM) ; les autres sont des choix de dessin, recopiés avec leur raison dans sources/dessins-entretien.js. Titres et
 * cadres viennent du catalogue des blocs (js/catalogue-blocs.js), la seule source de ces métadonnées.
 */
import { n } from "./dessin-svg.js?v=20261013a";
import { CHARTE, cadre, texte, etiquette, vignette, arrondir, arc, couper, TEINTES_ROUTE, VOITURE, voitureProfil, reperesProfil }
  from "./dessins-kit.js?v=20261013a";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261013a";

// ===== Mise en page commune (unités du cadre) =====
const MARGE = 8;                          // du bord du cadre au contenu
const ESPACE_TEXTE = 4;                   // du bout d'un filet d'étiquette à son texte (celui du kit)
const PETIT = CHARTE.tailles.petite;      // 11 : étiquettes serrées
const MOYEN = CHARTE.tailles.etiquette;   // 12
const INTERLIGNE = 1.25;                  // pas des lignes, en tailles de texte (celui des étiquettes du kit)
const MILIEU_CAPITALES = 0.35;            // ligne de base sous le milieu des capitales, en tailles (celui du kit)
const HAUT_TEXTE = 0.8, BAS_TEXTE = 0.25; // place d'un texte au-dessus et au-dessous de sa ligne de base, en tailles
const GOUTTIERE = 8;                      // entre deux vignettes
const QUART = 90;                         // un quart de tour, en degrés

// ===== Géométrie =====
const coord = (v) => String(Number(v.toFixed(2)));
const pt = ([x, y]) => `${coord(x)} ${coord(y)}`;
const trace = (pts, ferme = true) => `M${pts.map(pt).join(" L")}${ferme ? " Z" : ""}`;
const coins = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
const rectArrondi = (x1, y1, x2, y2, r) => arrondir(coins(x1, y1, x2, y2), [r, r, r, r]);
const forme = (pts, attributs) => n("path", { d: trace(pts), ...attributs });
// Boîte d'une partie, lue par les tests : centre, largeur, hauteur.
const boiteDe = (x1, y1, x2, y2) => ({ "data-x": (x1 + x2) / 2, "data-y": (y1 + y2) / 2, "data-largeur": Math.abs(x2 - x1),
  "data-hauteur": Math.abs(y2 - y1) });
// Point à `distance` de `p`, dans la direction de `vers`.
function versPoint(p, vers, distance) {
  const dx = vers[0] - p[0], dy = vers[1] - p[1], l = Math.hypot(dx, dy);
  return [p[0] + (dx / l) * distance, p[1] + (dy / l) * distance];
}
// Polyligne redécoupée : un point au moins tous les `pas` le long de chaque segment (pour déformer un contour sans facettes).
function densifier(pts, pas) {
  const r = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / pas));
    for (let j = 0; j < k; j++) r.push([p[0] + ((q[0] - p[0]) * j) / k, p[1] + ((q[1] - p[1]) * j) / k]);
  });
  return r;
}
const miroir = (pts) => pts.map(([x, y]) => [-x, y]).reverse();

// Une ligne d'étiquette mise en garde : la teinte « faux » de la charte, en demi-gras.
function mettreEnGarde(noeud, ligne) {
  return { ...noeud, enfants: noeud.enfants.map((e) => (typeof e !== "string" && e.balise === "text" && e.enfants[0] === ligne
    ? { ...e, attributs: { ...e.attributs, fill: CHARTE.faux, "font-weight": 600 } } : e)) };
}

// ===== Teintes (choix de dessin) =====
// Caisse de la voiture de l'élève, vitre et phare : celles des voitures du kit (TEINTES_ROUTE, MATIERES de js/dessins-kit.js).
// Sous le capot, tons neutres : fond sombre du compartiment, moteur gris en trois tons, plastique translucide clair des
// réservoirs, bouchons noirs, batterie sombre aux bornes de plomb. Pneu : la gomme des roues du kit (MATIERES.pneu) ; le témoin
// d'usure, de la même gomme dans le pneu, est dessiné d'un ton plus clair pour qu'on le distingue.
const TEINTES = {
  caisse: TEINTES_ROUTE.eleve, caisseBord: TEINTES_ROUTE.eleveBord, vitre: TEINTES_ROUTE.vitre, phare: "#E9EEEA",
  fond: "#2B302D", auvent: "#3A403C", balai: "#1E2220",
  moteur: "#646E67", moteurCache: "#828C85", moteurReflet: "#99A29B", boite: "#59625C",
  plastique: "#E3E8E1", plastiqueBord: "#A9B3A5", plastiqueReflet: "#F6F8F4",
  bouchon: "#1E2220", bouchonHaut: "#3D4440",
  batterie: "#3F4642", batterieCouvercle: "#535B56", plomb: "#CBD0CC", cosse: "#8E968F", signe: "#F1F4F0",
  lame: "#C3C9C4", lameBord: "#8E968F", huile: "#9A7234", poignee: "#2E3430",
  liquide: "#C7D4A6", liquideSurface: CHARTE.accent, repere: CHARTE.texteDiscret, sol: CHARTE.texteDoux,
  gomme: "#343A36", air: CHARTE.carte, jante: "#B9C0BA", janteBord: "#8E968F",
  temoin: "#7E8A82", cote: CHARTE.carte,
  etiquette: CHARTE.carte, etiquetteBord: CHARTE.texteDoux,
};

// ===== Sous le capot =====
// Vue du dessus, capot ouvert (il n'est pas dessiné), l'avant de la voiture à droite du dessin : le cap 0 des vues du dessus du
// kit et des scènes. Repère de la voiture, en centimètres : x vers l'avant depuis le centre de la voiture, y vers sa droite ; la
// gauche de la voiture, côté conducteur, est en haut du dessin. Le contour reprend la voiture du kit (4,5 m sur 1,8 m, coins de
// 40 cm, pied du pare-brise 1,25 m devant le centre, à 72 cm de l'axe) ; le compartiment et ses organes sont un schéma.
const CAPOT = {
  vue: { arriere: 117, avant: 225, demiLargeur: 90 },   // du bas du pare-brise au bout du nez, toute la largeur
  colonnes: { gauche: 116, droite: 62 },                // largeur des textes d'étiquettes : « Jamais moteur chaud » et « Lave-glace »
  jeu: 2,                                               // de l'ancre d'une étiquette au bord du dessin
  ecartMention: 10,                                     // du bas du dessin au haut de la mention
  pareBrise: { pied: 125, demiPied: 72, arrondi: 8 },
  essuieGlaces: [[[122.5, -62], [121.5, -14]], [[122.5, -6], [121.5, 38]]],
  nez: { rayon: 40 },
  compartiment: { arriere: 133, avant: 202, demiLargeur: 70, arrondi: 10 },
  phare: { debut: 42, angle: 50, retrait: 3, profondeur: 10, arrondi: 3 },
  calandre: { arriere: 210, avant: 217, demiLargeur: 24, arrondi: 3 },
  moteur: { arriere: 148, avant: 188, gauche: -32, droite: 24, arrondi: 5, cache: 3.5, arrondiCache: 4, reflet: 5 },
  boite: { arriere: 154, avant: 180, gauche: -56, droite: -32, arrondi: 4 },
  // Organes à vérifier : agrandis (schéma), pour qu'ils se lisent sur un téléphone et que le point d'une étiquette ne les cache pas.
  huile: { centre: [164, 2], rayon: 5.8, dessus: 4, prise: [8.6, 2.2] },
  jauge: { centre: [184, 2], longueur: 9.4, largeur: 6.4, arrondi: 3, trou: [5.2, 2.6], arrondiTrou: 1.3 },
  frein: { arriere: 134, avant: 150, gauche: -51, droite: -29, arrondi: 3, bouchon: [143, -40], rayon: 4.4, dessus: 2.8 },
  vase: { arriere: 155, avant: 179, gauche: 30, droite: 58, arrondi: 3.5, bouchon: [168, 44], rayon: 5.2, dessus: 3.4 },
  laveGlace: { centre: [192, 57], rayon: 5, col: 7.2, dessus: 3.2 },
  batterie: { arriere: 174, avant: 196, gauche: -68, droite: -38, arrondi: 1.5, couvercle: 1.2,
    bornes: [{ y: -62, signe: "+" }, { y: -44, signe: "−" }], xBorne: 179.5, rayonBorne: 1.6, cosse: [4, 5.4], xSigne: 188.5 },
  // Points de départ des filets : sur l'organe, au bord tourné vers son étiquette, pour que le point ne le cache pas. Les
  // lignes d'étiquettes sont à pas égal : à gauche y = -40, 2, 44 ; à droite y = -53, 2, 57.
  cibles: { frein: [137, -40], huile: [159.4, 2], vase: [164, 44], batterie: [193.6, -53], jauge: [187.8, 2], laveGlace: [197.2, 57] },
};

function capot() {
  const [L, H] = CATALOGUE.capot.cadre;
  const C = CAPOT, V = C.vue;
  const xAncreG = MARGE + C.colonnes.gauche + ESPACE_TEXTE, xAncreD = L - MARGE - C.colonnes.droite - ESPACE_TEXTE;
  // Unités par centimètre : le dessin remplit l'entre-deux des colonnes d'étiquettes.
  const K = (xAncreD - xAncreG - 2 * C.jeu) / (V.avant - V.arriere);
  const hauteurDessin = 2 * V.demiLargeur * K, hauteurMention = (HAUT_TEXTE + BAS_TEXTE) * PETIT;
  const Y0 = MARGE + (H - 2 * MARGE - hauteurDessin - C.ecartMention - hauteurMention) / 2;
  const X0 = xAncreG + C.jeu;
  const v = ([x, y]) => [X0 + (x - V.arriere) * K, Y0 + (y + V.demiLargeur) * K];
  const vs = (pts) => pts.map(v);
  const rect = (x1, y1, x2, y2, r) => vs(rectArrondi(x1, y1, x2, y2, r));
  const rond = ([cx, cy], r, attributs) => { const [x, y] = v([cx, cy]); return n("circle", { cx: x, cy: y, r: r * K, ...attributs }); };
  const boiteCm = (x1, y1, x2, y2) => { const [a, b] = v([x1, y1]), [c, d] = v([x2, y2]); return boiteDe(a, b, c, d); };
  const fin = CHARTE.traits.fin;

  // Caisse : de la coupe, au bas du pare-brise, jusqu'au nez arrondi ; le pare-brise et ses balais ; l'auvent ; les phares et la
  // calandre ; le compartiment ouvert.
  const r = C.nez.rayon, xc = V.avant - r, yc = V.demiLargeur - r;
  const caisse = [[V.arriere, -V.demiLargeur], ...arc([xc, -yc], r, -QUART, 0), ...arc([xc, yc], r, 0, QUART), [V.arriere, V.demiLargeur]];
  const pb = C.pareBrise;
  const pareBrise = arrondir(coins(V.arriere, -pb.demiPied, pb.pied, pb.demiPied), [0, pb.arrondi, pb.arrondi, 0]);
  const cp = C.compartiment;
  const phare = (cote) => {
    const p = C.phare, cy = cote * yc;
    const exterieur = [[V.avant - p.retrait, cote * p.debut], ...arc([xc, cy], r - p.retrait, 0, cote * p.angle)];
    const interieur = arc([xc, cy], r - p.retrait - p.profondeur, cote * p.angle, 0);
    const pts = [...exterieur, ...interieur, [V.avant - p.retrait - p.profondeur, cote * p.debut]];
    const sommets = [0, exterieur.length - 1, exterieur.length, pts.length - 1];
    return arrondir(pts, pts.map((_, i) => (sommets.includes(i) ? p.arrondi : 0)));
  };
  const ca = C.calandre;

  // Moteur et boîte de vitesses (sans nom : le cours ne les cite pas), en trois tons.
  const m = C.moteur, bo = C.boite;
  const moteur = n("g", { "data-r": "moteur" },
    forme(rect(m.arriere, m.gauche, m.avant, m.droite, m.arrondi), { fill: TEINTES.moteur }),
    forme(rect(m.arriere + m.cache, m.gauche + m.cache, m.avant - m.cache, m.droite - m.cache, m.arrondiCache), { fill: TEINTES.moteurCache }),
    forme(rect(m.arriere + m.cache, m.gauche + m.cache, m.arriere + m.cache + m.reflet, m.droite - m.cache, m.arrondiCache),
      { fill: TEINTES.moteurReflet }));
  const boite = forme(rect(bo.arriere, bo.gauche, bo.avant, bo.droite, bo.arrondi), { fill: TEINTES.boite, "data-r": "boite" });

  // Bouchon de remplissage d'huile, sur le cache du moteur : disque noir, dessus, barre de prise.
  const hu = C.huile, [hx, hy] = hu.centre;
  const huile = n("g", { "data-r": "huile", ...boiteCm(hx - hu.rayon, hy - hu.rayon, hx + hu.rayon, hy + hu.rayon) },
    rond(hu.centre, hu.rayon, { fill: TEINTES.bouchon }),
    rond(hu.centre, hu.dessus, { fill: TEINTES.bouchonHaut }),
    forme(rect(hx - hu.prise[1] / 2, hy - hu.prise[0] / 2, hx + hu.prise[1] / 2, hy + hu.prise[0] / 2, hu.prise[1] / 2), { fill: TEINTES.bouchon }));

  // Poignée de la jauge d'huile, devant le moteur : un anneau.
  const ja = C.jauge, [jx, jy] = ja.centre;
  const anneau = [rect(jx - ja.longueur / 2, jy - ja.largeur / 2, jx + ja.longueur / 2, jy + ja.largeur / 2, ja.arrondi),
    rect(jx - ja.trou[0] / 2, jy - ja.trou[1] / 2, jx + ja.trou[0] / 2, jy + ja.trou[1] / 2, ja.arrondiTrou)];
  const jauge = n("g", { "data-r": "jauge", ...boiteCm(jx - ja.longueur / 2, jy - ja.largeur / 2, jx + ja.longueur / 2, jy + ja.largeur / 2) },
    n("path", { d: anneau.map((p) => trace(p)).join(" "), fill: TEINTES.poignee, "fill-rule": "evenodd" }));

  // Réservoirs translucides et leur bouchon.
  const reservoir = (role, R) => n("g", { "data-r": role, ...boiteCm(R.arriere, R.gauche, R.avant, R.droite) },
    forme(rect(R.arriere, R.gauche, R.avant, R.droite, R.arrondi), { fill: TEINTES.plastique, stroke: TEINTES.plastiqueBord, "stroke-width": fin }),
    rond(R.bouchon, R.rayon, { fill: TEINTES.bouchon, "data-r": "bouchon" }),
    rond(R.bouchon, R.dessus, { fill: TEINTES.bouchonHaut }));
  const frein = reservoir("liquide-frein", C.frein);
  const vase = reservoir("vase-expansion", C.vase);
  // Remplissage du lave-glace, à l'avant : le col translucide, son bouchon.
  const lg = C.laveGlace, [lx, ly] = lg.centre;
  const laveGlace = n("g", { "data-r": "lave-glace", ...boiteCm(lx - lg.col, ly - lg.col, lx + lg.col, ly + lg.col) },
    rond(lg.centre, lg.col, { fill: TEINTES.plastique, stroke: TEINTES.plastiqueBord, "stroke-width": fin }),
    rond(lg.centre, lg.rayon, { fill: TEINTES.bouchon, "data-r": "bouchon" }),
    rond(lg.centre, lg.dessus, { fill: TEINTES.bouchonHaut }));

  // Batterie : bac, couvercle, deux bornes et leurs cosses, les signes + et − moulés à côté.
  const ba = C.batterie;
  const borne = ({ y, signe }) => {
    const [cx, cy] = v([ba.xBorne, y]);
    return [n("g", { "data-r": `cosse-${signe === "+" ? "plus" : "moins"}`, "data-x": cx, "data-y": cy },
      forme(rect(ba.xBorne - ba.cosse[0] / 2, y - ba.cosse[1] / 2, ba.xBorne + ba.cosse[0] / 2, y + ba.cosse[1] / 2, ba.rayonBorne / 2), { fill: TEINTES.cosse }),
      rond([ba.xBorne, y], ba.rayonBorne, { fill: TEINTES.plomb })),
    texte(v([ba.xSigne, y])[0], v([ba.xSigne, y])[1] + MILIEU_CAPITALES * PETIT, signe,
      { taille: PETIT, ancrage: "middle", graisse: 600, couleur: TEINTES.signe })];
  };
  const batterie = n("g", { "data-r": "batterie", ...boiteCm(ba.arriere, ba.gauche, ba.avant, ba.droite) },
    forme(rect(ba.arriere, ba.gauche, ba.avant, ba.droite, ba.arrondi), { fill: TEINTES.batterie }),
    forme(rect(ba.arriere + ba.couvercle, ba.gauche + ba.couvercle, ba.avant - ba.couvercle, ba.droite - ba.couvercle, ba.arrondi),
      { fill: TEINTES.batterieCouvercle }),
    ba.bornes.map(borne));

  // Étiquettes : à gauche, celles des organes du côté du pare-brise et du moteur ; à droite, celles de l'avant.
  const gauche = (role, cibleCm, lignesTexte) => {
    const c = v(cibleCm);
    return etiquette({ cible: c, ancre: [xAncreG, c[1]], lignes: lignesTexte, ancrage: "end", taille: PETIT, role: `etiquette-${role}` });
  };
  const droite = (role, cibleCm, lignesTexte) => {
    const c = v(cibleCm);
    return etiquette({ cible: c, ancre: [xAncreD, c[1]], lignes: lignesTexte, ancrage: "start", taille: PETIT, role: `etiquette-${role}` });
  };
  const ci = C.cibles;
  const ALERTE = "Jamais moteur chaud";
  const bas = Y0 + hauteurDessin;

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.capot.titre,
    description: "Le compartiment moteur vu du dessus, l'avant de la voiture à droite : bouchon de remplissage et jauge d'huile, "
      + "vase d'expansion du liquide de refroidissement (jamais ouvert moteur chaud), réservoir de liquide de frein, remplissage du "
      + "lave-glace, batterie et ses cosses + et −. La disposition varie selon les modèles." },
  n("g", { "data-r": "caisse" },
    forme(vs(caisse), { fill: TEINTES.caisse, stroke: TEINTES.caisseBord, "stroke-width": fin, "stroke-linejoin": "round" }),
    forme(vs(pareBrise), { fill: TEINTES.vitre }),
    C.essuieGlaces.map(([a, b]) => n("line", { x1: v(a)[0], y1: v(a)[1], x2: v(b)[0], y2: v(b)[1], stroke: TEINTES.balai,
      "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round" })),
    forme(vs(coins(pb.pied, -cp.demiLargeur, cp.arriere, cp.demiLargeur)), { fill: TEINTES.auvent }),
    [-1, 1].map((cote) => forme(vs(phare(cote)), { fill: TEINTES.phare })),
    forme(rect(ca.arriere, -ca.demiLargeur, ca.avant, ca.demiLargeur, ca.arrondi), { fill: TEINTES.fond }),
    forme(rect(cp.arriere, -cp.demiLargeur, cp.avant, cp.demiLargeur, cp.arrondi), { fill: TEINTES.fond, "data-r": "compartiment" })),
  boite, moteur, huile, jauge, frein, vase, laveGlace, batterie,
  gauche("liquide-frein", ci.frein, ["Liquide de frein"]),
  gauche("huile", ci.huile, ["Huile moteur"]),
  mettreEnGarde(gauche("vase-expansion", ci.vase, ["Liquide de", "refroidissement", "(vase d'expansion)", ALERTE]), ALERTE),
  droite("batterie", ci.batterie, ["Batterie"]),
  droite("jauge", ci.jauge, ["Jauge"]),
  droite("lave-glace", ci.laveGlace, ["Lave-glace"]),
  texte(L / 2, bas + C.ecartMention + HAUT_TEXTE * PETIT, "La disposition varie selon les modèles",
    { taille: PETIT, ancrage: "middle", couleur: CHARTE.texteDoux, role: "mention" }));
}

// ===== Lire un niveau =====
// Trois colonnes alignées sur une même base : la jauge d'huile (centimètres, tenue pointe en bas), un réservoir translucide
// (centimètres), une petite voiture de profil (mètres, la voiture du kit) posée sur un sol plat ; une légende sous chacune.
const NIVEAUX = {
  base: 172,          // pointe de la jauge, fond du réservoir, sol
  legende: 187,       // ligne de base des légendes
  jauge: {
    echelle: 11, decalage: -12,              // unités par centimètre ; axe de la lame, depuis le milieu de la colonne
    lame: 0.6, mini: 2.0, maxi: 4.5, huile: 3.4,   // hauteurs au-dessus de la pointe, en centimètres
    bas: 9.0, coupure: 0.7, pente: 0.15, haut: 1.2,  // lame dessinée jusqu'à 9 cm, coupure, morceau du haut jusqu'à la poignée
    encoche: { profondeur: 0.14, demiHauteur: 0.14 },
    poignee: { largeur: 3.4, hauteur: 2.6, arrondi: 1.0, trou: [2.0, 1.1], arrondiTrou: 0.5 },
    trait: { ecart: 0.25, longueur: 0.5 }, texte: 0.3,   // trait de chaque repère, puis son nom
  },
  reservoir: {
    echelle: 6.8, largeur: 14, hauteur: 16, arrondi: 1.6,
    // Col de remplissage et bouchon vissé dessus : il en couvre le haut, le col dépasse d'un liseré au-dessus du réservoir.
    col: { largeur: 4.2, hauteur: 1.0 }, bouchon: { largeur: 5.6, hauteur: 2.0, bas: 0.45, arrondi: 0.6, dessus: 0.55 },
    max: 11.5, min: 5.0, niveau: 8.0,        // hauteurs au-dessus du fond
    trait: { debut: 1.0, fin: 4.0 }, texte: 4.6,
    reflet: { debut: 11.0, fin: 12.2, haut: 1.4, bas: 1.4, opacite: 0.7 },   // bande claire : le plastique est translucide
  },
  voiture: { echelle: 16, sol: 92 },         // unités par mètre ; longueur du sol dessiné
};

function niveaux() {
  const [L, H] = CATALOGUE.niveaux.cadre;
  const N = NIVEAUX, colonne = (L - 2 * MARGE) / 3, milieu = (i) => MARGE + colonne * (i + 1 / 2);
  const fin = CHARTE.traits.fin, moyen = CHARTE.traits.moyen;

  // Jauge : repère de la lame (u en travers, h au-dessus de la pointe, centimètres) ramené au cadre.
  const J = N.jauge, ax = milieu(0) + J.decalage;
  const vj = ([u, h]) => [ax + u * J.echelle, N.base - h * J.echelle];
  const d = J.lame / 2, e = J.encoche;
  const encoches = (cote, h) => (cote > 0
    ? [[d, h + e.demiHauteur], [d - e.profondeur, h], [d, h - e.demiHauteur]]
    : [[-d, h - e.demiHauteur], [-d + e.profondeur, h], [-d, h + e.demiHauteur]]);
  const lameBas = [[d, J.bas - J.pente], ...encoches(1, J.maxi), ...encoches(1, J.mini), [d, 0], [-d, 0],
    ...encoches(-1, J.mini), ...encoches(-1, J.maxi), [-d, J.bas + J.pente]];
  const arrondisLame = lameBas.map((p) => (p[1] === 0 ? d : 0));
  const lameBasPts = arrondir(lameBas, arrondisLame).map(vj);
  const yHuile = vj([0, J.huile])[1];
  const traceHuile = couper(lameBasPts, (p) => yHuile - p[1]);
  const hautCoupure = J.bas + J.coupure;
  const lameHaut = [[d, hautCoupure - J.pente], [d, hautCoupure + J.haut], [-d, hautCoupure + J.haut], [-d, hautCoupure + J.pente]].map(vj);
  const P = J.poignee, basPoignee = hautCoupure + J.haut;
  const poigneePts = [rectArrondi(-P.largeur / 2, basPoignee, P.largeur / 2, basPoignee + P.hauteur, P.arrondi),
    rectArrondi(-P.trou[0] / 2, basPoignee + (P.hauteur - P.trou[1]) / 2, P.trou[0] / 2, basPoignee + (P.hauteur + P.trou[1]) / 2, P.arrondiTrou)]
    .map((pts) => pts.map(vj));
  const centrePoignee = vj([0, basPoignee + P.hauteur / 2]);
  const repere = (nom, h) => {
    const y = vj([0, h])[1], x1 = vj([d + J.trait.ecart, 0])[0], x2 = vj([d + J.trait.ecart + J.trait.longueur, 0])[0];
    return n("g", { "data-r": `repere-${nom}`, "data-y": y },
      n("line", { x1, y1: y, x2, y2: y, stroke: TEINTES.repere, "stroke-width": fin, "stroke-linecap": "round" }),
      texte(x2 + J.texte * J.echelle, y + MILIEU_CAPITALES * PETIT, nom, { taille: PETIT, couleur: CHARTE.texteDoux }));
  };
  const jauge = n("g", { "data-r": "jauge" },
    n("path", { d: poigneePts.map((p) => trace(p)).join(" "), fill: TEINTES.poignee, "fill-rule": "evenodd", "data-r": "poignee-jauge",
      "data-x": centrePoignee[0], "data-y": centrePoignee[1] }),
    forme(lameHaut, { fill: TEINTES.lame, stroke: TEINTES.lameBord, "stroke-width": fin, "stroke-linejoin": "round" }),
    forme(lameBasPts, { fill: TEINTES.lame, stroke: TEINTES.lameBord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "pointe-jauge",
      "data-x": ax, "data-y": N.base }),
    forme(traceHuile, { fill: TEINTES.huile, "data-r": "trace-huile", "data-y": yHuile }),
    repere("maxi", J.maxi), repere("mini", J.mini));

  // Réservoir : repère (u depuis le bord gauche, h au-dessus du fond, centimètres) ramené au cadre.
  const R = N.reservoir, gaucheR = milieu(1) - (R.largeur * R.echelle) / 2;
  const vr = ([u, h]) => [gaucheR + u * R.echelle, N.base - h * R.echelle];
  const corps = rectArrondi(0, 0, R.largeur, R.hauteur, R.arrondi).map(vr);
  const yNiveau = vr([0, R.niveau])[1];
  const liquide = couper(corps, (p) => yNiveau - p[1]);
  const xg = vr([0, 0])[0], xd = vr([R.largeur, 0])[0];
  const col = coins(...vr([(R.largeur - R.col.largeur) / 2, R.hauteur]), ...vr([(R.largeur + R.col.largeur) / 2, R.hauteur + R.col.hauteur]));
  const B = R.bouchon, basBouchon = R.hauteur + B.bas;
  const bouchon = rectArrondi(...vr([(R.largeur - B.largeur) / 2, basBouchon + B.hauteur]), ...vr([(R.largeur + B.largeur) / 2, basBouchon]), B.arrondi);
  const dessusBouchon = rectArrondi(...vr([(R.largeur - B.largeur) / 2, basBouchon + B.hauteur]),
    ...vr([(R.largeur + B.largeur) / 2, basBouchon + B.hauteur - B.dessus]), B.arrondi);
  const marque = (nom, h) => {
    const y = vr([0, h])[1];
    return n("g", { "data-r": `repere-${nom.toLowerCase()}`, "data-y": y },
      n("line", { x1: vr([R.trait.debut, 0])[0], y1: y, x2: vr([R.trait.fin, 0])[0], y2: y, stroke: TEINTES.repere, "stroke-width": moyen,
        "stroke-linecap": "round" }),
      texte(vr([R.texte, 0])[0], y + MILIEU_CAPITALES * PETIT, nom, { taille: PETIT, graisse: 600, couleur: CHARTE.texteDoux }));
  };
  const reflet = rectArrondi(...vr([R.reflet.debut, R.hauteur - R.reflet.haut]), ...vr([R.reflet.fin, R.reflet.bas]), (R.reflet.fin - R.reflet.debut) / 2 * R.echelle);
  const reservoir = n("g", { "data-r": "reservoir" },
    forme(col, { fill: TEINTES.plastique, stroke: TEINTES.plastiqueBord, "stroke-width": fin }),
    forme(bouchon, { fill: TEINTES.bouchon }),
    forme(dessusBouchon, { fill: TEINTES.bouchonHaut }),
    forme(corps, { fill: TEINTES.plastique }),
    forme(liquide, { fill: TEINTES.liquide, "data-r": "liquide" }),
    n("line", { x1: xg, y1: yNiveau, x2: xd, y2: yNiveau, stroke: TEINTES.liquideSurface, "stroke-width": moyen, "data-r": "niveau", "data-y": yNiveau }),
    forme(reflet, { fill: TEINTES.plastiqueReflet, opacity: R.reflet.opacite }),
    forme(corps, { fill: "none", stroke: TEINTES.plastiqueBord, "stroke-width": moyen }),
    marque("MAX", R.max), marque("MIN", R.min));

  // Voiture du kit, posée sur un sol horizontal.
  const xv = milieu(2), demiSol = N.voiture.sol / 2;
  const voiture = [
    n("line", { x1: xv - demiSol, y1: N.base, x2: xv + demiSol, y2: N.base, stroke: TEINTES.sol, "stroke-width": moyen, "stroke-linecap": "round",
      "data-r": "sol" }),
    voitureProfil({ x: xv, y: N.base, echelle: N.voiture.echelle })];

  const legende = (i, mots) => texte(milieu(i), N.legende, mots, { taille: MOYEN, ancrage: "middle", graisse: 500, couleur: CHARTE.texteDoux });
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.niveaux.titre,
    description: "À gauche, la jauge d'huile tenue pointe en bas : la trace d'huile s'arrête entre les repères mini et maxi. Au milieu, "
      + "un réservoir translucide : le niveau est entre MIN et MAX. À droite, la voiture sur un sol plat." },
  jauge, reservoir, voiture,
  legende(0, "Jauge d'huile"), legende(1, "Réservoir"), legende(2, "Sol plat"));
}

// ===== Contrôler un pneu =====
// Quatre vignettes. En haut, le pneu 205/55 R16 du kit coupé en travers sur sa jante (millimètres) : flanc sans déformation
// (juste), flanc avec une hernie (faux). En bas, la bande de roulement coupée en travers d'une rainure qui porte un témoin
// d'usure (millimètres, à l'échelle MM) : sculptures au-dessus du témoin (juste), témoin qui affleure (faux).
export const MM = 5;                // unités par millimètre, coupe de la bande de roulement
const TEMOIN_MM = 1.6;              // profondeur minimale des sculptures : la hauteur des témoins d'usure
const SOUS_PASTILLE = 28;           // bas de la pastille d'une vignette, depuis son haut (marge et hauteur de la pastille du kit)
const RECOUVREMENT = 1;             // deux formes de même teinte se chevauchent d'une unité : aucun joint clair entre elles
const PNEU = {
  hauteurFlanc: 104,                // hauteur des vignettes du flanc ; celles de la bande prennent le reste
  section: {
    echelle: 0.42,                  // unités par millimètre
    // Sommets du contour, moitié droite (x depuis le plan médian, y vers le bas depuis la bande de roulement, millimètres) et
    // l'arrondi de chacun : épaule, flanc, bas du flanc, talon contre le rebord de la jante, pointe du talon ; puis le dedans,
    // du talon à la bande. Arrondis, ils donnent 203 mm au plus large et 113 mm de haut : un 205/55.
    exterieur: [[78, 0, 18], [107, 50, 45], [90, 100, 12], [84, 112.75, 2], [68, 112.75, 3]],
    interieur: [[70, 98, 6], [95, 50, 40], [72, 16, 14]],
    rainures: { centres: [21, 55], largeur: 9, profondeur: 8, arrondi: 1.5 },
    // Jante coupée en travers : une tôle de rebord à rebord (dessus, puis dessous, millimètres, et leurs arrondis), les talons
    // posés sur ses portées, son creux au milieu.
    jante: {
      dessus: [[-93, 104, 4], [-84, 104, 1], [-84, 112.75, 1], [-62, 112.75, 3], [-52, 124, 3], [52, 124, 3], [62, 112.75, 3],
        [84, 112.75, 1], [84, 104, 1], [93, 104, 4]],
      dessous: [[93, 118.5, 2], [66, 118.5, 3], [56, 129.5, 3], [-56, 129.5, 3], [-66, 118.5, 3], [-93, 118.5, 2]],
    },
    hernie: { centre: 52, demiHauteur: 24, saillie: 14, amincissement: 4, visee: 0.5 },   // visée : le point de l'étiquette,
    // sur la pente haute de la bosse, à cette fraction de sa demi-hauteur au-dessus du sommet (le sommet reste visible)
    pas: 2,                         // redécoupage du contour sous la bosse, millimètres
    epaule: 20, talon: 98,          // le flanc s'étend entre ces deux profondeurs
    dansLaGomme: 4,                 // le point d'une étiquette, posé dans la gomme à cette distance du bord
    axe: 0.36,                      // place du plan médian dans la vignette (fraction de sa largeur)
  },
  bande: {
    pain: 8, rainure: 10, base: 3, sculpture: 7, arrondiTemoin: 0.4,   // millimètres ; sculpture : profondeur du pneu bon
    hautPains: 76,                  // haut des pains du pneu bon, depuis le haut de la vignette
    tic: 1.2,                       // demi-longueur des traits de la cote, millimètres
    cibleTemoin: 1.5,               // le point du nom du témoin, à cette distance (mm) de la paroi droite de la rainure
  },
  // Noms des vignettes, en haut à droite (le témoin) ou à gauche (les sculptures) : largeur réservée au plus long, à 11 unités
  // (« Hernie » 36,5 ; « Sculptures » 57,3 ; « d'usure » 39,7), et hauteur de l'ancre sous le haut de la vignette.
  noms: { flanc: 38, sculptures: 58, temoin: 44, ancreFlanc: 36, ancreBande: 66 },
};

// Contour d'un pneu coupé en travers (un seul tracé : l'extérieur, puis le dedans), en millimètres. Avec une hernie, le flanc
// droit sort en cloche, le dedans plus que l'extérieur : la paroi s'amincit. Rend aussi le sommet de la bosse et le morceau de
// contour extérieur qu'elle déforme.
function contourPneu(hernie) {
  const S = PNEU.section, xy = ([x, y]) => [x, y], rayon = ([, , r]) => r;
  const sommets = [...miroir(S.exterieur.map(xy)), ...S.exterieur.map(xy), ...S.interieur.map(xy), ...miroir(S.interieur.map(xy))];
  const rayons = [...S.exterieur.map(rayon).reverse(), ...S.exterieur.map(rayon), ...S.interieur.map(rayon),
    ...S.interieur.map(rayon).reverse()];
  const pts = arrondir(sommets, rayons);
  if (!hernie) return { pts, sommet: null, bosse: [] };
  const H = S.hernie, dense = densifier(pts, S.pas), m = dense.length;
  const cloche = (y) => (Math.abs(y - H.centre) < H.demiHauteur ? (1 + Math.cos((Math.PI * (y - H.centre)) / H.demiHauteur)) / 2 : 0);
  // À droite, le contour extérieur descend (y croît le long du tracé) et le dedans remonte.
  const descend = (i) => dense[(i + 1) % m][1] > dense[(i - 1 + m) % m][1];
  const deforme = dense.map(([x, y], i) => (x > 0 ? [x + cloche(y) * (H.saillie + (descend(i) ? 0 : H.amincissement)), y] : [x, y]));
  const bosse = deforme.filter((_, i) => dense[i][0] > 0 && descend(i) && cloche(dense[i][1]) > 0);
  return { pts: deforme, sommet: bosse.reduce((a, p) => (p[0] > a[0] ? p : a)), bosse };
}

function pneu() {
  const [L, H] = CATALOGUE.pneu.cadre;
  const S = PNEU.section, B = PNEU.bande, N = PNEU.noms, fin = CHARTE.traits.fin;
  const largeur = (L - 2 * MARGE - GOUTTIERE) / 2;
  const xs = [MARGE, MARGE + largeur + GOUTTIERE];
  const yFlanc = MARGE, yBande = MARGE + PNEU.hauteurFlanc + GOUTTIERE;
  const hauteurBande = H - yBande - MARGE;
  const nom = (cible, ancre, lignes, role) => etiquette({ cible, ancre, lignes, ancrage: "middle", taille: PETIT, role });
  // Le flanc du pneu sain à son plus large : demi-largeur du pneu et profondeur de ce point.
  const [demiSain, yFlancSain] = contourPneu(false).pts.reduce((a, p) => (p[0] > a[0] ? p : a));

  // Vignettes du flanc : la coupe posée sur sa jante, au milieu de la place sous la pastille.
  const flanc = (etat, x) => {
    const hernie = etat === "faux", k = S.echelle, J = S.jante, He = S.hernie;
    const tole = [...J.dessus, ...J.dessous], basCoupe = Math.max(...J.dessous.map(([, y]) => y));
    const ox = x + largeur * S.axe;
    const oy = (yFlanc + SOUS_PASTILLE + yFlanc + PNEU.hauteurFlanc - MARGE) / 2 - (basCoupe * k) / 2;
    const vp = ([px, py]) => [ox + px * k, oy + py * k];
    const { pts, sommet, bosse } = contourPneu(hernie);
    const jante = arrondir(tole.map(([px, py]) => [px, py]), tole.map(([, , r]) => r));
    const R = S.rainures;
    const rainures = R.centres.flatMap((c) => [-c, c]).map((c) => forme(arrondir(coins(c - R.largeur / 2, -R.profondeur, c + R.largeur / 2,
      R.profondeur), [0, 0, R.arrondi, R.arrondi]).map(vp), { fill: TEINTES.air }));
    const yVisee = He.centre - He.demiHauteur * He.visee;
    const visee = hernie && bosse.reduce((a, p) => (Math.abs(p[1] - yVisee) < Math.abs(a[1] - yVisee) ? p : a));
    const cible = hernie ? vp([visee[0] - S.dansLaGomme, visee[1]]) : vp([demiSain - S.dansLaGomme, yFlancSain]);
    const [sx, sy] = hernie ? vp(sommet) : [0, 0];
    return vignette({ x, y: yFlanc, largeur, hauteur: PNEU.hauteurFlanc, etat },
      n("g", { "data-r": `flanc-${etat}`, "data-x": ox, "data-echelle": k, "data-epaule": oy + S.epaule * k, "data-talon": oy + S.talon * k },
        forme(jante.map(vp), { fill: TEINTES.jante, stroke: TEINTES.janteBord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "jante" }),
        forme(pts.map(vp), { fill: TEINTES.gomme, "data-r": "pneu" }),
        rainures,
        hernie && n("path", { d: trace(bosse.map(vp), false), fill: "none", stroke: CHARTE.faux, "stroke-width": CHARTE.traits.appuye,
          "stroke-linecap": "round", "stroke-linejoin": "round", "data-r": "hernie", "data-x": sx, "data-y": sy }),
        nom(cible, [x + largeur - MARGE - N.flanc / 2, yFlanc + N.ancreFlanc], [hernie ? "Hernie" : "Flanc"], `nom-${hernie ? "hernie" : "flanc"}`)));
  };

  // Vignettes de la bande de roulement : un pain, la rainure et son témoin, un pain ; la base sous la rainure. Le fond de la
  // rainure est au même niveau dans les deux vignettes.
  const bande = (etat, x) => {
    const bon = etat === "juste";
    const sculpture = bon ? B.sculpture : TEMOIN_MM;
    const largeurCoupe = (2 * B.pain + B.rainure) * MM;
    const gx = x + (largeur - largeurCoupe) / 2;
    const yFond = yBande + B.hautPains + B.sculpture * MM;
    const vb = ([mx, my]) => [gx + mx * MM, yFond - my * MM];       // mx depuis le bord gauche, my au-dessus du fond
    const total = 2 * B.pain + B.rainure;
    const pains = [[0, B.pain], [B.pain + B.rainure, total]];
    // Les pains descendent jusqu'au bas de la base, qui ne garnit que le dessous de la rainure : aucun bord n'est tracé deux fois.
    const base = coins(vb([B.pain, 0])[0] - RECOUVREMENT, yFond - RECOUVREMENT, vb([B.pain + B.rainure, 0])[0] + RECOUVREMENT, vb([0, -B.base])[1]);
    const t = B.arrondiTemoin * MM;
    const temoin = arrondir(coins(...vb([B.pain, TEMOIN_MM]), ...vb([B.pain + B.rainure, 0])), [t, t, 0, 0]);
    const xMilieu = vb([B.pain + B.rainure / 2, 0])[0], yTemoin = vb([0, TEMOIN_MM])[1], tic = B.tic * MM;
    const cote = n("g", { "data-r": "cote", "data-y1": yTemoin, "data-y2": yFond },
      n("line", { x1: xMilieu, y1: yTemoin, x2: xMilieu, y2: yFond, stroke: TEINTES.cote, "stroke-width": fin }),
      [yTemoin, yFond].map((y) => n("line", { x1: xMilieu - tic, y1: y, x2: xMilieu + tic, y2: y, stroke: TEINTES.cote, "stroke-width": fin,
        "stroke-linecap": "round" })),
      texte(xMilieu, yTemoin - ESPACE_TEXTE - BAS_TEXTE * PETIT, "1,6 mm", { taille: PETIT, ancrage: "middle", graisse: 600 }));
    const legende = bon ? ["Sculptures au-dessus", "du témoin d'usure"] : ["Le témoin affleure :", "le pneu se remplace"];
    const yLegende = yBande + hauteurBande - MARGE - BAS_TEXTE * PETIT - INTERLIGNE * PETIT;
    const ancreY = yBande + N.ancreBande;
    return vignette({ x, y: yBande, largeur, hauteur: hauteurBande, etat },
      n("g", { "data-r": `bande-${etat}` },
        forme(base, { fill: TEINTES.gomme }),
        pains.map(([a, b]) => forme(coins(...vb([a, sculpture]), ...vb([b, -B.base])), { fill: TEINTES.gomme, "data-r": "sculpture" })),
        forme(temoin, { fill: TEINTES.temoin, "data-r": "temoin" }),
        cote,
        nom(vb([B.pain / 2, sculpture / 2]), [x + MARGE + N.sculptures / 2, ancreY], ["Sculptures"], "nom-sculptures"),
        nom(vb([B.pain + B.rainure - B.cibleTemoin, TEMOIN_MM / 2]), [x + largeur - MARGE - N.temoin / 2, ancreY], ["Témoin", "d'usure"], "nom-temoin"),
        legende.map((l, i) => texte(x + largeur / 2, yLegende + i * INTERLIGNE * PETIT, l, { taille: PETIT, ancrage: "middle", couleur: CHARTE.texteDoux }))));
  };

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.pneu.titre,
    description: "Juste : flanc sans déformation. Faux : hernie, une bosse sur le flanc. Juste : la bande de roulement coupée en travers, "
      + "sculptures au-dessus du témoin d'usure de 1,6 mm. Faux : le témoin affleure, le pneu se remplace." },
  flanc("juste", xs[0]), flanc("faux", xs[1]), bande("juste", xs[0]), bande("faux", xs[1]));
}

// ===== La pression des pneus =====
// La voiture du kit de profil, côté conducteur (son avant à gauche : sens « gauche » du kit), portière avant et trappe à
// carburant ouvertes ; l'étiquette des pressions sur le montant découvert et dans la trappe, chacune entourée d'un cercle.
const PRESSION = {
  echelle: 62,                 // unités par mètre : la plus grande voiture qui tient dans le cadre, marges comprises
  sol: 150,                    // ligne du sol
  etiquette: { largeur: 0.08, hauteur: 0.12 },   // mètres : une étiquette courante, aussi large que le montant découvert
  cercle: 7,                   // rayon du cercle qui désigne chaque étiquette
  ancres: { montant: [124, 54], trappe: [272, 54] },   // ancres des deux noms (le texte au-dessus)
  bas: 172,                    // ligne de base de la première ligne du bas
  solDessine: 2.45,            // sol dessiné de part et d'autre du milieu, en mètres
};

function pression() {
  const [L, H] = CATALOGUE.pression.cadre;
  const P = PRESSION, e = P.echelle, x = L / 2;
  const r = reperesProfil({ x, y: P.sol, echelle: e, sens: "gauche", trappeOuverte: true });
  const voiture = voitureProfil({ x, y: P.sol, echelle: e, sens: "gauche", portiereOuverte: true, trappeOuverte: true });
  const autocollant = (role, [cx, cy], largeurM) => {
    const l = largeurM * e, h = P.etiquette.hauteur * e;
    return forme(rectArrondi(cx - l / 2, cy - h / 2, cx + l / 2, cy + h / 2, CHARTE.traits.fin),
      { fill: TEINTES.etiquette, stroke: TEINTES.etiquetteBord, "stroke-width": CHARTE.traits.fin, "data-r": role, "data-x": cx, "data-y": cy });
  };
  // Sur la trappe ouverte, l'étiquette est vue de biais, comme la face intérieure de la trappe (son ouverture, celle du kit).
  const biais = Math.abs(Math.cos((VOITURE.trappe.ouverture * Math.PI) / (2 * QUART)));
  // Cercle qui désigne une étiquette : un trait sombre bordé d'un liseré clair, comme les filets du kit, lisible sur la caisse.
  const cercle = (role, [cx, cy]) => [
    n("circle", { cx, cy, r: P.cercle, fill: "none", stroke: CHARTE.carte, "stroke-width": CHARTE.traits.moyen + 2 * CHARTE.liseres }),
    n("circle", { cx, cy, r: P.cercle, fill: "none", stroke: CHARTE.texteDoux, "stroke-width": CHARTE.traits.moyen, "data-r": role })];
  const nom = (role, centreEtiquette, ancre, lignesTexte) => etiquette({ cible: versPoint(centreEtiquette, ancre, P.cercle), ancre,
    lignes: lignesTexte, ancrage: "middle", taille: MOYEN, role: `nom-${role}` });
  const bas = ["À froid, roue de secours comprise,", "aux valeurs de l'étiquette du véhicule"];
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.pression.titre,
    description: "La voiture de profil, côté conducteur, portière avant et trappe à carburant ouvertes : l'étiquette des pressions est "
      + "souvent sur le montant de la portière conducteur ou dans la trappe à carburant. La pression se contrôle à froid, roue de "
      + "secours comprise, aux valeurs de cette étiquette." },
  n("line", { x1: x - P.solDessine * e, y1: P.sol, x2: x + P.solDessine * e, y2: P.sol, stroke: TEINTES.sol, "stroke-width": CHARTE.traits.moyen,
    "stroke-linecap": "round", "data-r": "sol" }),
  voiture,
  autocollant("etiquette-montant", r.montantPortiere, P.etiquette.largeur),
  autocollant("etiquette-trappe", r.trappe, P.etiquette.largeur * biais),
  cercle("repere-montant", r.montantPortiere), cercle("repere-trappe", r.trappe),
  nom("montant", r.montantPortiere, P.ancres.montant, ["Souvent : montant de la", "portière conducteur"]),
  nom("trappe", r.trappe, P.ancres.trappe, ["ou trappe", "à carburant"]),
  bas.map((l, i) => texte(x, P.bas + i * INTERLIGNE * MOYEN, l, { taille: MOYEN, ancrage: "middle" })));
}

export const DESSINS = { capot, niveaux, pneu, pression };
export const GESTES = {};
export { versDom } from "./dessin-svg.js?v=20261013a";
