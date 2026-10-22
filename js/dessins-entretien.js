/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « entretien » (C1.1, le tour du véhicule et les pneus) : sous le capot, lire un niveau, contrôler un
 * pneu, la pression des pneus.
 *
 * Les mesures (mètres pour la voiture du kit et sous le capot, centimètres pour la jauge et le réservoir, millimètres pour le
 * pneu) et les places de la mise en page (colonnes, lignes d'étiquettes, ancres, marges) sont des constantes nommées ; les
 * points des étiquettes se déduisent des organes qu'ils désignent. La seule valeur réglementaire est la profondeur minimale
 * des sculptures, 1,6 mm, que marquent les témoins d'usure (TEMOIN_MM) ; les autres sont des choix de dessin, recopiés avec
 * leur raison dans sources/dessins-entretien.js. Style schématique (décision du formateur du 15/10/2026) : des aplats, deux ou
 * trois tons par objet, aucun détail décoratif ; la voiture, de profil comme vue du dessus, est celle du kit, en silhouette.
 * Titres et cadres viennent du catalogue des blocs (js/catalogue-blocs.js), la seule source de ces métadonnées.
 */
import { n } from "./dessin-svg.js?v=20261022a";
import { CHARTE, MATIERES, METRIQUES_POLICE, MISE_EN_PAGE, cadre, texte, etiquette, vignette, arrondir, arc, couper, trace, VOITURE,
  voitureDessus, voitureProfil, reperesProfil } from "./dessins-kit.js?v=20261022a";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261022a";

// ===== Mise en page commune (unités du cadre) =====
// Textes posés comme ceux du kit : espace du bout d'un filet à son texte, pas des lignes, repères d'Outfit (METRIQUES_POLICE).
const MARGE = 8;                          // du bord du cadre au contenu
const ESPACE_TEXTE = MISE_EN_PAGE.espaceEtiquette;
const PETIT = CHARTE.tailles.petite;      // 11 : étiquettes serrées
const MOYEN = CHARTE.tailles.etiquette;   // 12
const { interligne: INTERLIGNE, milieuCapitales: MILIEU_CAPITALES, haut: HAUT_TEXTE, bas: BAS_TEXTE } = METRIQUES_POLICE;
const GOUTTIERE = 8;                      // entre deux vignettes
const QUART = 90;                         // un quart de tour, en degrés

// ===== Géométrie =====
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

// Lignes d'étiquette mises en garde : la teinte « faux » de la charte, en demi-gras (testé).
function mettreEnGarde(noeud, lignes) {
  return { ...noeud, enfants: noeud.enfants.map((e) => (typeof e !== "string" && e.balise === "text" && lignes.includes(e.enfants[0])
    ? { ...e, attributs: { ...e.attributs, fill: CHARTE.faux, "font-weight": 600 } } : e)) };
}

// ===== Teintes =====
// Style schématique (décision du formateur du 15/10/2026, « pictogramme plutôt qu'illustration ») : des aplats, sans relief ni
// reflet, deux tons par objet, trois au plus. La voiture, en silhouette (option schema), garde les teintes du kit : c'est lui qui
// la dessine. Le fond sombre du compartiment et la gomme et la jante du pneu en coupe sont des matières du kit (MATIERES), celles
// de sa voiture. Le reste est propre à cette famille (choix de dessin) : sous le capot, moteur gris d'un seul ton, plastique
// translucide clair des réservoirs, plastique noir des bouchons et de la poignée de jauge, batterie d'un gris sombre aux cosses
// claires et aux câbles gris, assez clairs pour se lire sur le fond du compartiment ; lame d'acier et huile ambrée de la jauge ;
// liquide dans le vert doux de la charte ; témoin d'usure d'un ton plus clair que la gomme, pour qu'on le distingue (dans le pneu,
// c'est la même gomme).
const TEINTES = {
  fond: MATIERES.compartiment, moteur: "#7A847D",
  plastique: "#E3E8E1", plastiqueBord: "#A9B3A5", bouchon: "#262B28",
  batterie: "#5E6862", cosse: "#C5CAC4", cable: "#8E968F",
  lame: "#C3C9C4", lameBord: "#8E968F", huile: "#9A7234",
  liquide: "#C7D4A6", liquideSurface: CHARTE.accent, repere: CHARTE.texteDiscret, sol: CHARTE.texteDoux,
  air: CHARTE.carte, janteBord: "#8E968F", temoin: "#7E8A82", cote: CHARTE.carte,
  etiquette: CHARTE.carte, etiquetteBord: CHARTE.texteDoux,
};
const GOMME = MATIERES.pneu, JANTE = MATIERES.jante;

// ===== Sous le capot =====
// La voiture du kit vue du dessus, en silhouette (voitureDessus, option schema, cap 0 : l'avant à droite du dessin, la gauche de
// la voiture, côté conducteur, en haut), découpée du bas du pare-brise au nez : contour, pare-brise et teintes sont les siens.
// Capot ouvert (il n'est pas dessiné), le compartiment et ses organes, un schéma, sont posés par-dessus. Repère de la voiture
// du kit, en mètres : x vers l'avant depuis son centre, y vers sa droite.
const DEMI_LONGUEUR = VOITURE.longueur / 2, DEMI_LARGEUR = VOITURE.largeur / 2;
const PIED_PARE_BRISE = DEMI_LONGUEUR - VOITURE.pareBrise.recul + VOITURE.pareBrise.profondeur;
const CAPOT = {
  colonnes: { gauche: 103, droite: 62 },   // largeur prêtée par les contrôles communs à « de refroidissement » et « Lave-glace »
  jeu: 2,                                  // de l'ancre d'une étiquette au bord du dessin
  ecartMention: 10,                        // du bas du dessin au haut de la mention
  vitre: 0.08,                             // part du pare-brise montrée, derrière son pied
  auvent: 0.08,                            // du pied du pare-brise au fond du compartiment (la caisse entre les deux)
  devant: 0.23,                            // du bord avant du compartiment au nez : la traverse et les phares
  aile: 0.24,                              // du bord du compartiment au flanc : le dessus des ailes, joints du capot compris
  arrondi: 0.10,                           // coins du compartiment
  // Lignes des étiquettes, à pas égal : l'ordonnée (mètres) de l'organe que désigne chacune ; à gauche frein, huile, vase, à
  // droite batterie, jauge, lave-glace.
  lignes: { gauche: [-0.40, 0.02, 0.44], droite: [-0.51, 0.02, 0.55] },
  retrait: 1.2,                            // le point d'une étiquette, à cette distance (unités) du bord de l'organe : il en déborde
  moteur: { arriere: 1.48, avant: 1.88, gauche: -0.32, droite: 0.24, arrondi: 0.05 },
  // Organes à vérifier, agrandis (schéma) pour se reconnaître sur un téléphone : chacun mesure au moins une fois et demie le point
  // de son étiquette dans sa plus petite dimension.
  huile: { x: 1.64, rayon: 0.058 },
  jauge: { x: 1.83, longueur: 0.14, largeur: 0.09, arrondi: 0.035, trou: [0.08, 0.036], arrondiTrou: 0.018 },
  frein: { arriere: 1.34, avant: 1.50, demiLargeur: 0.11, arrondi: 0.03, bouchon: 0.044 },
  vase: { arriere: 1.55, avant: 1.79, demiLargeur: 0.14, arrondi: 0.035, bouchon: 0.052 },
  laveGlace: { x: 1.92, col: 0.072, bouchon: 0.05 },
  batterie: { arriere: 1.73, avant: 1.94, demiLargeur: 0.14, arrondi: 0.015,
    bornes: [{ dy: -0.09, signe: "+" }, { dy: 0.09, signe: "−" }], xBorne: 1.78, cosse: [0.04, 0.054], arrondiCosse: 0.008, xSigne: 1.87,
    cable: 0.08 },                         // amorce de chaque câble, depuis sa cosse vers l'arrière
};
let numeroCapot = 0;                       // numéro de chaque dessin du capot : identifiant de découpe unique par montage

function capot() {
  const [L, H] = CATALOGUE.capot.cadre;
  const C = CAPOT, debut = PIED_PARE_BRISE - C.vitre;
  const xAncreG = MARGE + C.colonnes.gauche + ESPACE_TEXTE, xAncreD = L - MARGE - C.colonnes.droite - ESPACE_TEXTE;
  // Unités par mètre : le dessin remplit l'entre-deux des colonnes d'étiquettes.
  const E = (xAncreD - xAncreG - 2 * C.jeu) / (DEMI_LONGUEUR - debut);
  const hauteurDessin = 2 * DEMI_LARGEUR * E, hauteurMention = (HAUT_TEXTE + BAS_TEXTE) * PETIT;
  const Y0 = MARGE + (H - 2 * MARGE - hauteurDessin - C.ecartMention - hauteurMention) / 2;
  const X0 = xAncreG + C.jeu;
  const v = ([x, y]) => [X0 + (x - debut) * E, Y0 + (y + DEMI_LARGEUR) * E];
  const rect = (x1, y1, x2, y2, r) => rectArrondi(x1, y1, x2, y2, r).map(v);
  const rond = ([cx, cy], r, attributs) => { const [x, y] = v([cx, cy]); return n("circle", { cx: x, cy: y, r: r * E, ...attributs }); };
  const boiteM = (x1, y1, x2, y2) => { const [a, b] = v([x1, y1]), [c, d] = v([x2, y2]); return boiteDe(a, b, c, d); };
  const fin = CHARTE.traits.fin;
  const [yFrein, yHuile, yVase] = C.lignes.gauche, [yBatterie, yJauge, yLave] = C.lignes.droite;

  // La voiture du kit, découpée à la fenêtre du dessin (son trait de contour compris) ; identifiant propre à ce montage.
  const idDecoupe = `capot-decoupe-${++numeroCapot}`;
  const [fx1, fy1] = v([debut, -DEMI_LARGEUR]), [fx2, fy2] = v([DEMI_LONGUEUR, DEMI_LARGEUR]);
  const voiture = [
    n("defs", {}, n("clipPath", { id: idDecoupe },
      n("rect", { x: fx1, y: fy1 - fin, width: fx2 - fx1 + fin, height: fy2 - fy1 + 2 * fin }))),
    n("g", { "clip-path": `url(#${idDecoupe})`, "data-r": "decoupe" },
      voitureDessus({ x: v([0, 0])[0], y: v([0, 0])[1], cap: 0, echelle: E, schema: true }))];

  // Compartiment ouvert, en retrait du pied du pare-brise ; le moteur, un seul aplat (sans nom : le cours ne le cite pas).
  const fond = PIED_PARE_BRISE + C.auvent, nez = DEMI_LONGUEUR - C.devant, demi = DEMI_LARGEUR - C.aile;
  const m = C.moteur;
  const compartiment = [
    forme(rect(fond, -demi, nez, demi, C.arrondi), { fill: TEINTES.fond, "data-r": "compartiment" }),
    forme(rect(m.arriere, m.gauche, m.avant, m.droite, m.arrondi), { fill: TEINTES.moteur, "data-r": "moteur" })];

  // Bouchon de remplissage d'huile, sur le moteur : un disque sombre.
  const hu = C.huile, ch = [hu.x, yHuile];
  const huile = n("g", { "data-r": "huile", ...boiteM(hu.x - hu.rayon, yHuile - hu.rayon, hu.x + hu.rayon, yHuile + hu.rayon) },
    rond(ch, hu.rayon, { fill: TEINTES.bouchon, "data-r": "bouchon" }));

  // Poignée de la jauge d'huile, devant le moteur : un anneau franc.
  const ja = C.jauge, jx1 = ja.x - ja.longueur / 2, jx2 = ja.x + ja.longueur / 2;
  const anneau = [rect(jx1, yJauge - ja.largeur / 2, jx2, yJauge + ja.largeur / 2, ja.arrondi),
    rect(ja.x - ja.trou[0] / 2, yJauge - ja.trou[1] / 2, ja.x + ja.trou[0] / 2, yJauge + ja.trou[1] / 2, ja.arrondiTrou)];
  const jauge = n("g", { "data-r": "jauge", ...boiteM(jx1, yJauge - ja.largeur / 2, jx2, yJauge + ja.largeur / 2) },
    n("path", { d: anneau.map((p) => trace(p)).join(" "), fill: TEINTES.bouchon, "fill-rule": "evenodd" }));

  // Réservoirs translucides et leur bouchon, au milieu : le plastique clair, le bouchon sombre.
  const reservoir = (role, R, y) => {
    const centreR = [(R.arriere + R.avant) / 2, y];
    return n("g", { "data-r": role, ...boiteM(R.arriere, y - R.demiLargeur, R.avant, y + R.demiLargeur) },
      forme(rect(R.arriere, y - R.demiLargeur, R.avant, y + R.demiLargeur, R.arrondi), { fill: TEINTES.plastique }),
      rond(centreR, R.bouchon, { fill: TEINTES.bouchon, "data-r": "bouchon" }));
  };
  const frein = reservoir("liquide-frein", C.frein, yFrein);
  const vase = reservoir("vase-expansion", C.vase, yVase);
  // Remplissage du lave-glace, dans le coin avant : le col translucide, son bouchon.
  const lg = C.laveGlace, cl = [lg.x, yLave];
  const laveGlace = n("g", { "data-r": "lave-glace", ...boiteM(lg.x - lg.col, yLave - lg.col, lg.x + lg.col, yLave + lg.col) },
    rond(cl, lg.col, { fill: TEINTES.plastique }),
    rond(cl, lg.bouchon, { fill: TEINTES.bouchon, "data-r": "bouchon" }));

  // Batterie : le bac, deux cosses serrées sur ses bornes, chacune au bout d'un câble, les signes + et − moulés à côté.
  const ba = C.batterie;
  const borne = ({ dy, signe }) => {
    const y = yBatterie + dy, [cx, cy] = v([ba.xBorne, y]), arriereCosse = ba.xBorne - ba.cosse[0] / 2;
    const [sx, sy] = v([ba.xSigne, y]);
    return [n("g", { "data-r": `cosse-${signe === "+" ? "plus" : "moins"}`, "data-x": cx, "data-y": cy },
      n("line", { x1: v([arriereCosse, y])[0], y1: cy, x2: v([arriereCosse - ba.cable, y])[0], y2: cy, stroke: TEINTES.cable,
        "stroke-width": CHARTE.traits.fort, "stroke-linecap": "round", "data-r": "cable" }),
      forme(rect(arriereCosse, y - ba.cosse[1] / 2, ba.xBorne + ba.cosse[0] / 2, y + ba.cosse[1] / 2, ba.arrondiCosse), { fill: TEINTES.cosse })),
    texte(sx, sy + MILIEU_CAPITALES * PETIT, signe, { taille: PETIT, ancrage: "middle", graisse: 600, couleur: CHARTE.fond })];
  };
  const batterie = n("g", { "data-r": "batterie", ...boiteM(ba.arriere, yBatterie - ba.demiLargeur, ba.avant, yBatterie + ba.demiLargeur) },
    forme(rect(ba.arriere, yBatterie - ba.demiLargeur, ba.avant, yBatterie + ba.demiLargeur, ba.arrondi), { fill: TEINTES.batterie }),
    ba.bornes.map(borne));

  // Étiquettes : chaque point part du bord de l'organe tourné vers son étiquette, à C.retrait unité dedans ; à gauche, les
  // organes du côté du pare-brise et du moteur, à droite ceux de l'avant.
  const gauche = (role, xBord, y, lignesTexte) => {
    const [x, yc] = v([xBord, y]);
    return etiquette({ cible: [x + C.retrait, yc], ancre: [xAncreG, yc], lignes: lignesTexte, ancrage: "end", taille: PETIT, role: `etiquette-${role}` });
  };
  const droite = (role, xBord, y, lignesTexte) => {
    const [x, yc] = v([xBord, y]);
    return etiquette({ cible: [x - C.retrait, yc], ancre: [xAncreD, yc], lignes: lignesTexte, ancrage: "start", taille: PETIT, role: `etiquette-${role}` });
  };
  const ALERTE = ["Jamais", "moteur chaud"];
  const bas = Y0 + hauteurDessin;

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.capot.titre,
    description: "Le compartiment moteur vu du dessus, l'avant de la voiture à droite : bouchon de remplissage et jauge d'huile, "
      + "vase d'expansion du liquide de refroidissement (jamais ouvert moteur chaud), réservoir de liquide de frein, remplissage du "
      + "lave-glace, batterie et ses cosses + et −. La disposition varie selon les modèles." },
  voiture, compartiment, huile, jauge, frein, vase, laveGlace, batterie,
  gauche("liquide-frein", C.frein.arriere, yFrein, ["Liquide de frein"]),
  gauche("huile", hu.x - hu.rayon, yHuile, ["Huile moteur"]),
  mettreEnGarde(gauche("vase-expansion", (C.vase.arriere + C.vase.avant) / 2 - C.vase.bouchon, yVase,
    ["Liquide", "de refroidissement", "(vase d'expansion)", ...ALERTE]), ALERTE),
  droite("batterie", ba.avant, yBatterie, ["Batterie"]),
  droite("jauge", jx2, yJauge, ["Jauge"]),
  droite("lave-glace", lg.x + lg.col, yLave, ["Lave-glace"]),
  texte(L / 2, bas + C.ecartMention + HAUT_TEXTE * PETIT, "La disposition varie selon les modèles",
    { taille: PETIT, ancrage: "middle", couleur: CHARTE.texteDoux, role: "mention" }));
}

// ===== Lire un niveau =====
// Trois colonnes alignées sur une même base : la jauge d'huile (centimètres, tenue pointe en bas), un réservoir translucide
// (centimètres), une petite voiture de profil (mètres, la voiture du kit en silhouette) posée sur un sol plat ; une légende sous
// chacune. Style schématique : des aplats, ni reflet, ni col, ni dessus de bouchon.
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
    bouchon: { largeur: 5.6, hauteur: 2.0, arrondi: 0.6 },   // posé sur le haut du réservoir
    max: 11.5, min: 5.0, niveau: 8.0,        // hauteurs au-dessus du fond
    trait: { debut: 1.0, fin: 4.0 }, texte: 4.6,
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
    n("path", { d: poigneePts.map((p) => trace(p)).join(" "), fill: TEINTES.bouchon, "fill-rule": "evenodd", "data-r": "poignee-jauge",
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
  const B = R.bouchon;
  const bouchon = rectArrondi(...vr([(R.largeur - B.largeur) / 2, R.hauteur + B.hauteur]), ...vr([(R.largeur + B.largeur) / 2, R.hauteur]), B.arrondi);
  const marque = (nom, h) => {
    const y = vr([0, h])[1];
    return n("g", { "data-r": `repere-${nom.toLowerCase()}`, "data-y": y },
      n("line", { x1: vr([R.trait.debut, 0])[0], y1: y, x2: vr([R.trait.fin, 0])[0], y2: y, stroke: TEINTES.repere, "stroke-width": moyen,
        "stroke-linecap": "round" }),
      texte(vr([R.texte, 0])[0], y + MILIEU_CAPITALES * PETIT, nom, { taille: PETIT, graisse: 600, couleur: CHARTE.texteDoux }));
  };
  const reservoir = n("g", { "data-r": "reservoir" },
    forme(corps, { fill: TEINTES.plastique }),
    forme(liquide, { fill: TEINTES.liquide, "data-r": "liquide" }),
    n("line", { x1: xg, y1: yNiveau, x2: xd, y2: yNiveau, stroke: TEINTES.liquideSurface, "stroke-width": moyen, "data-r": "niveau", "data-y": yNiveau }),
    forme(corps, { fill: "none", stroke: TEINTES.plastiqueBord, "stroke-width": moyen }),
    forme(bouchon, { fill: TEINTES.bouchon, "data-r": "bouchon" }),
    marque("MAX", R.max), marque("MIN", R.min));

  // Voiture du kit en silhouette, posée sur un sol horizontal.
  const xv = milieu(2), demiSol = N.voiture.sol / 2;
  const voiture = [
    n("line", { x1: xv - demiSol, y1: N.base, x2: xv + demiSol, y2: N.base, stroke: TEINTES.sol, "stroke-width": moyen, "stroke-linecap": "round",
      "data-r": "sol" }),
    voitureProfil({ x: xv, y: N.base, echelle: N.voiture.echelle, schema: true })];

  const legende = (i, mots) => texte(milieu(i), N.legende, mots, { taille: MOYEN, ancrage: "middle", graisse: 500, couleur: CHARTE.texteDoux });
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.niveaux.titre,
    description: "À gauche, la jauge d'huile tenue pointe en bas : la trace d'huile s'arrête entre les repères mini et maxi. Au milieu, "
      + "un réservoir translucide : le niveau est entre MIN et MAX. À droite, la voiture sur un sol plat." },
  jauge, reservoir, voiture,
  legende(0, "Jauge d'huile"), legende(1, "Réservoir"), legende(2, "Sol plat"));
}

// ===== Contrôler un pneu =====
// Quatre vignettes. En haut, le pneu 205/55 R16 des roues du kit coupé en travers sur sa jante (millimètres) : flanc sans
// déformation (juste), flanc avec une hernie (faux). En bas, un détail de la bande de roulement coupé en travers d'une rainure
// qui porte un témoin d'usure (millimètres, à l'échelle MM), les pains arrêtés par un trait de brisure : sculptures au-dessus du
// témoin (juste), témoin qui affleure (faux).
export const MM = 5;                // unités par millimètre, coupe de la bande de roulement
const TEMOIN_MM = 1.6;              // profondeur minimale des sculptures : la hauteur des témoins d'usure
const SOUS_PASTILLE = MISE_EN_PAGE.margePastille + MISE_EN_PAGE.hauteurPastille;   // bas de la pastille d'une vignette, depuis son haut
const RECOUVREMENT = 1;             // deux formes de même teinte se chevauchent d'une unité : aucun joint clair entre elles
const PNEU = {
  hauteurFlanc: 104,                // hauteur des vignettes du flanc ; celles de la bande prennent le reste
  section: {
    echelle: 0.5,                   // unités par millimètre : la plus grande coupe qui tient dans la vignette, sous la pastille
    // Sommets du contour, moitié droite (x depuis le plan médian, y vers le bas depuis la bande de roulement, millimètres) et
    // l'arrondi de chacun : épaule, flanc, bas du flanc, talon contre le rebord de la jante, pointe du talon ; puis le dedans,
    // du talon à la bande. Arrondis, ils donnent 203 mm au plus large et 113 mm de haut : un 205/55.
    exterieur: [[78, 0, 18], [107, 50, 45], [90, 100, 12], [84, 112.75, 2], [68, 112.75, 3]],
    interieur: [[70, 98, 6], [95, 50, 40], [72, 16, 14]],
    rainures: { centres: [21, 55], largeur: 9, profondeur: 8, arrondi: 1.5 },
    // Jante coupée en travers, en pictogramme : une bande plate de rebord à rebord (dessus, puis dessous, millimètres, et leurs
    // arrondis), les talons posés sur elle contre ses rebords ; le creux de montage n'est pas dessiné (style schématique).
    jante: {
      dessus: [[-93, 104, 4], [-84, 104, 1], [-84, 112.75, 1], [84, 112.75, 1], [84, 104, 1], [93, 104, 4]],
      dessous: [[93, 118.5, 2], [-93, 118.5, 2]],
    },
    // Hernie : une bulle (profil en demi-ellipse, plein au sommet, qui naît net du flanc), la paroi amincie.
    hernie: { centre: 52, demiHauteur: 26, saillie: 13, amincissement: 4 },
    pas: 2,                         // redécoupage du contour sous la bosse, millimètres
    epaule: 20, talon: 98,          // le flanc s'étend entre ces deux profondeurs
    axe: 0.4,                       // place du plan médian dans la vignette (fraction de sa largeur)
  },
  // Le point d'une étiquette du flanc, à cette distance (unités) hors du contour, au plus large : il touche la gomme sans
  // couvrir la paroi, plus mince que lui.
  ecartPoint: 2,
  bande: {
    rainure: 9, base: 3, sculpture: 7, arrondiTemoin: 0.4,   // millimètres ; la rainure, celle de la coupe du haut ;
    // sculpture : profondeur du pneu bon
    hautPains: 76,                  // haut des pains du pneu bon, depuis le haut de la vignette
    bord: 8,                        // de la coupe au bord de la vignette, de chaque côté
    brisure: { amplitude: 1.6, points: 12 },   // trait de brisure (unités) : une onde sur la hauteur de la coupe
    tic: 1.2,                       // demi-longueur des traits de la cote, millimètres
    cibleTemoin: 1.2,               // le point du nom du témoin, à cette distance (mm) de la paroi droite de la rainure
  },
  // Noms des vignettes, en haut à droite (flanc, hernie, témoin) ou à gauche (sculptures) : largeur réservée au plus long, à 11
  // unités, celle que lui prêtent les contrôles communs (« Hernie » 36,5 ; « Sculptures » 57,3 ; « d'usure » 39,7), un majorant de
  // sa largeur en Outfit (32,5 ; 50,3 ; 35,0 dans Chrome) ; et hauteur de l'ancre sous le haut de la vignette.
  noms: { flanc: 38, sculptures: 58, temoin: 44, ancreFlanc: 36, ancreBande: 66 },
};

// Contour d'un pneu coupé en travers (un seul tracé : l'extérieur, puis le dedans), en millimètres. Avec une hernie, le flanc
// droit sort en bulle, le dedans plus que l'extérieur : la paroi s'amincit. Rend aussi le point le plus large et le morceau
// de contour extérieur que déforme la bosse.
function contourPneu(hernie) {
  const S = PNEU.section, xy = ([x, y]) => [x, y], rayon = ([, , r]) => r;
  const sommets = [...miroir(S.exterieur.map(xy)), ...S.exterieur.map(xy), ...S.interieur.map(xy), ...miroir(S.interieur.map(xy))];
  const rayons = [...S.exterieur.map(rayon).reverse(), ...S.exterieur.map(rayon), ...S.interieur.map(rayon),
    ...S.interieur.map(rayon).reverse()];
  const plusLarge = (pts) => pts.reduce((a, p) => (p[0] > a[0] ? p : a));
  const pts = arrondir(sommets, rayons);
  if (!hernie) return { pts, sommet: plusLarge(pts), bosse: [] };
  const H = S.hernie, dense = densifier(pts, S.pas), m = dense.length;
  const bulle = (y) => (Math.abs(y - H.centre) < H.demiHauteur ? Math.sqrt(1 - ((y - H.centre) / H.demiHauteur) ** 2) : 0);
  // À droite, le contour extérieur descend (y croît le long du tracé) et le dedans remonte.
  const descend = (i) => dense[(i + 1) % m][1] > dense[(i - 1 + m) % m][1];
  const deforme = dense.map(([x, y], i) => (x > 0 ? [x + bulle(y) * (H.saillie + (descend(i) ? 0 : H.amincissement)), y] : [x, y]));
  const bosse = deforme.filter((_, i) => dense[i][0] > 0 && descend(i) && bulle(dense[i][1]) > 0);
  return { pts: deforme, sommet: plusLarge(bosse), bosse };
}

function pneu() {
  const [L, H] = CATALOGUE.pneu.cadre;
  const S = PNEU.section, B = PNEU.bande, N = PNEU.noms, fin = CHARTE.traits.fin;
  const largeur = (L - 2 * MARGE - GOUTTIERE) / 2;
  const xs = [MARGE, MARGE + largeur + GOUTTIERE];
  const yFlanc = MARGE, yBande = MARGE + PNEU.hauteurFlanc + GOUTTIERE;
  const hauteurBande = H - yBande - MARGE;
  const nom = (cible, ancre, lignes, role) => etiquette({ cible, ancre, lignes, ancrage: "middle", taille: PETIT, role });

  // Vignettes du flanc : la coupe posée sur sa jante, au milieu de la place sous la pastille.
  const flanc = (etat, x) => {
    const hernie = etat === "faux", k = S.echelle, J = S.jante;
    const tole = [...J.dessus, ...J.dessous], basCoupe = Math.max(...J.dessous.map(([, y]) => y));
    const ox = x + largeur * S.axe;
    const oy = (yFlanc + SOUS_PASTILLE + yFlanc + PNEU.hauteurFlanc - MARGE) / 2 - (basCoupe * k) / 2;
    const vp = ([px, py]) => [ox + px * k, oy + py * k];
    const { pts, sommet, bosse } = contourPneu(hernie);
    const jante = arrondir(tole.map(([px, py]) => [px, py]), tole.map(([, , r]) => r));
    const R = S.rainures;
    const rainures = R.centres.flatMap((c) => [-c, c]).map((c) => forme(arrondir(coins(c - R.largeur / 2, -R.profondeur, c + R.largeur / 2,
      R.profondeur), [0, 0, R.arrondi, R.arrondi]).map(vp), { fill: TEINTES.air, "data-r": "rainure" }));
    const [sx, sy] = vp(sommet);
    return vignette({ x, y: yFlanc, largeur, hauteur: PNEU.hauteurFlanc, etat },
      n("g", { "data-r": `flanc-${etat}`, "data-x": ox, "data-echelle": k, "data-epaule": oy + S.epaule * k, "data-talon": oy + S.talon * k },
        forme(jante.map(vp), { fill: JANTE, stroke: TEINTES.janteBord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "jante" }),
        forme(pts.map(vp), { fill: GOMME, "data-r": "pneu" }),
        rainures,
        hernie && n("path", { d: trace(bosse.map(vp), false), fill: "none", stroke: CHARTE.faux, "stroke-width": CHARTE.traits.appuye,
          "stroke-linecap": "round", "stroke-linejoin": "round", "data-r": "hernie", "data-x": sx, "data-y": sy }),
        nom([sx + PNEU.ecartPoint, sy], [x + largeur - MARGE - N.flanc / 2, yFlanc + N.ancreFlanc], [hernie ? "Hernie" : "Flanc"],
          `nom-${hernie ? "hernie" : "flanc"}`)));
  };

  // Vignettes de la bande de roulement : un pain, la rainure et son témoin, un pain, la base sous la rainure ; chaque pain
  // s'arrête au bord de la coupe par un trait de brisure (le pneu continue). Le fond de la rainure est au même niveau dans les
  // deux vignettes.
  const bande = (etat, x) => {
    const bon = etat === "juste";
    const sculpture = bon ? B.sculpture : TEMOIN_MM;
    const total = (largeur - 2 * B.bord) / MM;                     // largeur de la coupe, millimètres
    const g1 = (total - B.rainure) / 2, g2 = g1 + B.rainure;        // parois de la rainure
    const gx = x + B.bord;
    const yFond = yBande + B.hautPains + B.sculpture * MM;
    const vb = ([mx, my]) => [gx + mx * MM, yFond - my * MM];       // mx depuis le bord gauche de la coupe, my au-dessus du fond
    // Trait de brisure d'un bord de la coupe (abscisse mx), du bas de la base au haut du pain : une onde.
    const brisure = (mx) => Array.from({ length: B.brisure.points + 1 }, (_, k) => {
      const t = k / B.brisure.points;
      return [mx + (B.brisure.amplitude / MM) * Math.sin(2 * Math.PI * t), -B.base + t * (sculpture + B.base)];
    });
    const painGauche = [[g1, sculpture], [g1, -B.base], ...brisure(0)];
    const painDroit = [[g2, sculpture], ...brisure(total).reverse(), [g2, -B.base]];
    // Les pains descendent jusqu'au bas de la base, qui ne garnit que le dessous de la rainure : aucun bord n'est tracé deux fois.
    const base = coins(vb([g1, 0])[0] - RECOUVREMENT, yFond - RECOUVREMENT, vb([g2, 0])[0] + RECOUVREMENT, vb([0, -B.base])[1]);
    const t = B.arrondiTemoin * MM;
    const temoin = arrondir(coins(...vb([g1, TEMOIN_MM]), ...vb([g2, 0])), [t, t, 0, 0]);
    const xMilieu = vb([(g1 + g2) / 2, 0])[0], yTemoin = vb([0, TEMOIN_MM])[1], tic = B.tic * MM;
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
        forme(base, { fill: GOMME }),
        [painGauche, painDroit].map((p) => forme(p.map(vb), { fill: GOMME, "data-r": "sculpture" })),
        forme(temoin, { fill: TEINTES.temoin, "data-r": "temoin" }),
        cote,
        nom(vb([g1 / 2, sculpture / 2]), [x + MARGE + N.sculptures / 2, ancreY], ["Sculptures"], "nom-sculptures"),
        nom(vb([g2 - B.cibleTemoin, TEMOIN_MM / 2]), [x + largeur - MARGE - N.temoin / 2, ancreY], ["Témoin", "d'usure"], "nom-temoin"),
        legende.map((l, i) => texte(x + largeur / 2, yLegende + i * INTERLIGNE * PETIT, l, { taille: PETIT, ancrage: "middle", couleur: CHARTE.texteDoux }))));
  };

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.pneu.titre,
    description: "Juste : flanc sans déformation. Faux : hernie, une bosse sur le flanc. Juste : la bande de roulement coupée en travers, "
      + "sculptures au-dessus du témoin d'usure de 1,6 mm. Faux : le témoin affleure, le pneu se remplace." },
  flanc("juste", xs[0]), flanc("faux", xs[1]), bande("juste", xs[0]), bande("faux", xs[1]));
}

// ===== La pression des pneus =====
// La voiture du kit de profil, en silhouette (option schema), côté conducteur (son avant à gauche : sens « gauche » du kit),
// portière avant et trappe à carburant ouvertes ; l'étiquette des pressions sur le montant découvert et dans la trappe, chacune
// entourée d'un cercle.
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
  const voiture = voitureProfil({ x, y: P.sol, echelle: e, sens: "gauche", portiereOuverte: true, trappeOuverte: true, schema: true });
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
  nom("montant", r.montantPortiere, P.ancres.montant, ["Souvent : montant", "de la portière conducteur"]),
  nom("trappe", r.trappe, P.ancres.trappe, ["ou trappe", "à carburant"]),
  bas.map((l, i) => texte(x, P.bas + i * INTERLIGNE * MOYEN, l, { taille: MOYEN, ancrage: "middle" })));
}

export const DESSINS = { capot, niveaux, pneu, pression };
export const GESTES = {};
export { versDom } from "./dessin-svg.js?v=20261022a";
