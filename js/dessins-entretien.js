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
import { n } from "./dessin-svg.js?v=20261023b";
import { CHARTE, MATIERES, METRIQUES_POLICE, MISE_EN_PAGE, SYMBOLE_FREIN, SYMBOLE_TEMPERATURE, vagueSymbole, cadre, texte, etiquette,
  vignette, arrondir, arc, couper, trace, point, VOITURE,
  VOITURE_PROFIL, voitureDessus, voitureProfil, reperesProfil } from "./dessins-kit.js?v=20261023b";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261023b";

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
// translucide clair des réservoirs, plastique noir des bouchons, batterie d'un gris sombre aux cosses claires et aux câbles
// gris, assez clairs pour se lire sur le fond du compartiment ; jauge : anneau de prise et col jaunes (retour du formateur du
// 22/10/2026 : « l'anneau où on vient tirer dessus est souvent jaune »), lame d'acier, huile ambrée, stries sèches et mouillées ;
// liquide dans le vert doux de la charte ; témoin d'usure d'un ton plus clair que la gomme, pour qu'on le distingue (dans le pneu,
// c'est la même gomme).
const TEINTES = {
  fond: MATIERES.compartiment, moteur: "#7A847D",
  plastique: "#E3E8E1", plastiqueBord: "#A9B3A5", bouchon: "#262B28",
  batterie: "#5E6862", cosse: "#C5CAC4", cable: "#8E968F",
  lame: "#C3C9C4", lameBord: "#8E968F", huile: "#B07A1E", striesSeches: "#7E867F", striesHuile: "#6A4510",
  poignee: "#F3C21B", poigneeBord: "#A57F00", bouchonStries: "#59615C", bouchonLaveGlace: "#2B64B0", pictogramme: "#F1F4F0",
  liquide: "#C7D4A6", liquideSurface: CHARTE.accent, repere: CHARTE.texteDiscret, sol: CHARTE.texteDoux,
  air: CHARTE.carte, janteBord: "#8E968F", cote: CHARTE.carte,
  // Morceau de bande de roulement : dessus des pains (le plus clair, celui qui touche la route), faces avant de la gomme (celle
  // de la coupe du haut), faces de côté, fond de la rainure (le plus sombre) ; le témoin, de la même gomme, d'un ton plus clair
  // pour qu'on le distingue.
  bande: { dessus: "#6B736E", cote: "#4B524E", fond: "#232825", temoinDessus: "#A3ACA6", temoinFace: "#87918A" },
  etiquette: CHARTE.carte, etiquetteBord: CHARTE.texteDoux,
};
const GOMME = MATIERES.pneu, JANTE = MATIERES.jante;

// ===== Pictogrammes des bouchons =====
// Retour du formateur du 22/10/2026 : « les logos, types voyants, sur les différents récipients, ça pourrait être intéressant de
// les ajouter ». Chaque bouchon porte le symbole que portent les vrais : ISO 7000-0248 « Engine oil » (la burette, qui repère le
// bouchon de remplissage d'huile), ISO 7000-0088 « Windscreen washer » (le pare-brise et son jet, celui du lave-glace) ; contours
// relevés sur leurs vectorisations de Wikimedia Commons (domaine public), dans leur carré d'origine (`boite` : x1, y1, x2, y2),
// puis simplifiés pour un téléphone : la burette en silhouette pleine (son anse ajourée), le pare-brise en trait de la charte, son
// jet en deux arcs pleins (des tirets dans la norme). Les bouchons du liquide de frein et du liquide de refroidissement portent le
// symbole de leur voyant (consignes du formateur du 22/10/2026, « c'est le même que le voyant ») : le freinage (ISO 7000-0239 ;
// SYMBOLE_FREIN du kit : cercle et deux arcs), le point d'exclamation remplacé par un disque plein, comme sur le bouchon
// photographié par le formateur ; la température du liquide de refroidissement (ISO 7000-0246 ; SYMBOLE_TEMPERATURE du kit : le
// thermomètre dans les vagues), tel quel. Leur `boite` est en parts du carré du voyant.
const PICTOGRAMMES = {
  huile: {
    iso: "7000-0248", boite: [4.1, 58.9, 190.4, 133.1],
    contour: [[11.95, 58.87], [4.14, 88.01], [42.04, 102.08], [42.04, 133.09], [129.69, 133.09], [171.48, 82.64], [179.99, 79.95],
      [184.55, 84.72], [190.22, 77.84], [181.58, 69.01], [162.53, 77.04], [113.84, 89.55], [105.89, 81.59], [83.6, 81.59], [83.6, 71.53],
      [94.86, 71.53], [94.86, 61.53], [62.34, 61.53], [62.34, 71.53], [73.6, 71.53], [73.6, 81.59], [52.04, 81.59], [52.04, 73.75]],
    anse: [[18.77, 72.06], [42.04, 80.7], [42.04, 91.41], [16.16, 81.81]],
    goutte: { pointe: [184.4, 96.7], centre: [184.8, 113.9], rayon: 5.6 },
  },
  refroidissement: {
    iso: "7000-0246",
    // Du bord gauche des vagues à leur bord droit, du haut de la tige au bas de la vague basse (son creux).
    boite: [Math.min(...SYMBOLE_TEMPERATURE.vagues.map((w) => w.gauche)), SYMBOLE_TEMPERATURE.tige.haut,
      Math.max(...SYMBOLE_TEMPERATURE.vagues.map((w) => w.droite)), Math.max(...SYMBOLE_TEMPERATURE.vagues.map((w) => w.v)) + SYMBOLE_TEMPERATURE.amplitude],
  },
  laveGlace: {
    iso: "7000-0088", boite: [12.82, 17.41, 187.18, 161.79],
    // Pare-brise : bas (de droite à gauche, bombé vers le haut), côté gauche, haut (de gauche à droite), côté droit.
    pareBrise: { bas: [[143.59, 161.79], [116.62, 146.22], [83.39, 146.22], [56.42, 161.79]], haut: [[12.82, 86.28], [66.77, 55.13], [133.24, 55.13], [187.18, 86.28]] },
    jet: { centres: [[70.65, 46.76], [129.35, 46.76]], rayon: 29.35 },
  },
  frein: {
    iso: "7000-0239", disque: 0.13,   // rayon du disque plein du centre, en part du carré (choix de dessin, d'après la photo)
    boite: [0.5 - SYMBOLE_FREIN.arcs.rayon, 0.5 - SYMBOLE_FREIN.cercle, 0.5 + SYMBOLE_FREIN.arcs.rayon, 0.5 + SYMBOLE_FREIN.cercle],
  },
};
const PAS_COURBE = 12;          // segments d'une courbe de Bézier d'un pictogramme
const bezier = ([a, b, c, d]) => Array.from({ length: PAS_COURBE + 1 }, (_, k) => {
  const t = k / PAS_COURBE, u = 1 - t;
  return [0, 1].map((i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i]);
});
const ouvert = (pts) => trace(pts, false);

/** Pictogramme `nom` centré en (cx, cy), large de `largeur` unités (sa hauteur suit), de la teinte `couleur` : le groupe
 *  « pictogramme », sa référence ISO (data-iso), sa boîte (data-x, data-y, data-largeur, data-hauteur). */
function pictogramme(nom, [cx, cy], largeur, couleur) {
  const P = PICTOGRAMMES[nom], [bx1, by1, bx2, by2] = P.boite;
  const k = largeur / (bx2 - bx1), hauteur = (by2 - by1) * k;
  const vp = ([x, y]) => [cx + (x - (bx1 + bx2) / 2) * k, cy + (y - (by1 + by2) / 2) * k];
  const trait = (epaisseur) => ({ fill: "none", stroke: couleur, "stroke-width": epaisseur, "stroke-linecap": "round", "stroke-linejoin": "round" });
  let dessin;
  if (nom === "huile") {
    const g = P.goutte, d = Math.hypot(g.pointe[0] - g.centre[0], g.pointe[1] - g.centre[1]);
    const vers = Math.atan2(g.pointe[1] - g.centre[1], g.pointe[0] - g.centre[0]) / (Math.PI / 180), ecart = Math.acos(g.rayon / d) / (Math.PI / 180);
    const goutte = [g.pointe, ...arc(g.centre, g.rayon, vers + ecart, vers + 360 - ecart)];
    dessin = [n("path", { d: `${trace(P.contour.map(vp))} ${trace(P.anse.map(vp))}`, fill: couleur, "fill-rule": "evenodd" }),
      n("path", { d: trace(goutte.map(vp)), fill: couleur })];
  } else if (nom === "refroidissement") {
    // Le carré du symbole a pour côté 1 : k unités par part. Comme le voyant : tige, graduations et vagues en trait moyen (bouts
    // francs pour les graduations et les vagues), bulbe plein.
    const F = SYMBOLE_TEMPERATURE, g = F.graduations, q = (u, v) => vp([u, v]), bulbe = q(F.tige.u, F.bulbe.v);
    dessin = [n("path", { d: ouvert([q(F.tige.u, F.tige.haut), bulbe]), ...trait(CHARTE.traits.moyen), "data-r": "tige" }),
      n("circle", { cx: bulbe[0], cy: bulbe[1], r: F.bulbe.rayon * k, fill: couleur, "data-r": "bulbe" }),
      n("path", { d: g.v.map((v) => ouvert([q(g.gauche, v), q(g.droite, v)])).join(" "), ...trait(CHARTE.traits.moyen), "stroke-linecap": "butt",
        "data-r": "graduations" }),
      n("path", { d: F.vagues.map((w) => vagueSymbole(q, w, F.amplitude)).join(" "), ...trait(CHARTE.traits.moyen), "stroke-linecap": "butt",
        "data-r": "vagues" })];
  } else if (nom === "frein") {
    // Le carré du symbole a pour côté 1 : k unités par part. Cercle en trait fin, disque plein au centre, deux arcs de part et
    // d'autre en trait moyen, bouts francs, comme le voyant.
    const centre = vp([0.5, 0.5]), A = SYMBOLE_FREIN.arcs, a = A.demiOuverture;
    dessin = [n("circle", { cx: centre[0], cy: centre[1], r: SYMBOLE_FREIN.cercle * k, ...trait(CHARTE.traits.fin), "data-r": "cercle" }),
      n("circle", { cx: centre[0], cy: centre[1], r: P.disque * k, fill: couleur, "data-r": "disque" }),
      ...[[180 - a, 180 + a], [-a, a]].map(([de, vers]) => n("path", { d: ouvert(arc([0.5, 0.5], A.rayon, de, vers).map(vp)),
        ...trait(CHARTE.traits.moyen), "stroke-linecap": "butt", "data-r": "arc" }))];
  } else {
    const pb = P.pareBrise, J = P.jet;
    const contour = [...bezier(pb.bas), ...bezier(pb.haut)];
    dessin = [n("path", { d: trace(contour.map(vp)), ...trait(CHARTE.traits.moyen) }),
      ...J.centres.map((c) => n("path", { d: ouvert(arc(c, J.rayon, 180, 360).map(vp)), ...trait(CHARTE.traits.fin) }))];
  }
  return n("g", { "data-r": "pictogramme", "data-iso": P.iso, "data-x": cx, "data-y": cy, "data-largeur": largeur, "data-hauteur": hauteur }, dessin);
}

// ===== Sous le capot =====
// La voiture du kit vue du dessus, en silhouette (voitureDessus, option schema, cap 0 : l'avant à droite du dessin, la gauche de
// la voiture, côté conducteur, en haut), découpée du bas du pare-brise au nez : contour, pare-brise et teintes sont les siens.
// Capot ouvert (il n'est pas dessiné), le compartiment et ses organes, un schéma, sont posés par-dessus, chacun à sa place la plus
// courante, de sa forme et de la couleur usuelle de son bouchon : bouchon d'huile noir sur le moteur, anneau jaune de la jauge,
// réservoirs translucides aux bouchons noirs, bouchon bleu du lave-glace ; chaque bouchon de remplissage porte son pictogramme
// normalisé (voir plus haut). Repère de la voiture du kit, en mètres : x vers l'avant depuis son centre, y vers sa droite.
const DEMI_LONGUEUR = VOITURE.longueur / 2, DEMI_LARGEUR = VOITURE.largeur / 2;
const PIED_PARE_BRISE = DEMI_LONGUEUR - VOITURE.pareBrise.recul + VOITURE.pareBrise.profondeur;
const CAPOT = {
  // Vue : capot ouvert, vu de l'avant, comme par celui qui se tient devant la voiture (consigne du formateur du 22/10/2026 : « le
  // côté extérieur de la voiture en bas ») : l'avant en bas, le pare-brise en haut (cap 90 : la gauche de la voiture, côté
  // conducteur, à droite du dessin) ; découpée sur cette demi-largeur (m) : le compartiment et une bande d'aile de chaque côté ;
  // elle remplit la largeur du cadre, marges comprises. Les noms des organes sont au-dessus (ceux du côté du pare-brise) et
  // au-dessous (ceux de l'avant) : la vue garde toute la largeur.
  demiLargeurVue: 0.80,
  jeu: 2,                                  // de l'ancre d'une étiquette au bord du dessin
  ecartMention: 10,                        // du bas des noms du dessous au haut de la mention
  vitre: 0.08,                             // part du pare-brise montrée, derrière son pied
  auvent: 0.08,                            // du pied du pare-brise au fond du compartiment (la caisse entre les deux)
  devant: 0.23,                            // du bord avant du compartiment au nez : la traverse et les phares
  aile: 0.24,                              // du bord du compartiment au flanc : le dessus des ailes, joints du capot compris
  arrondi: 0.10,                           // coins du compartiment
  // Place de chaque organe en travers de la voiture (m, vers sa droite) : frein, huile, vase ; batterie, jauge, lave-glace.
  lateraux: { frein: -0.40, huile: 0.02, vase: 0.44, batterie: -0.51, jauge: 0.02, laveGlace: 0.55 },
  // Décalage de l'ancre d'un nom par rapport à son organe (unités, vers la droite) : les noms du dessus ne se touchent pas.
  decalages: { "vase-expansion": -7 },
  retrait: 1.2,                            // le point d'une étiquette, à cette distance (unités) du bord de l'organe : il en déborde
  moteur: { arriere: 1.48, avant: 1.88, gauche: -0.32, droite: 0.24, arrondi: 0.05 },
  // Organes à vérifier, agrandis (schéma) pour se reconnaître sur un téléphone : chacun mesure au moins une fois et demie le point
  // de son étiquette dans sa plus petite dimension ; un bouchon qui porte un pictogramme, assez grand pour qu'il se lise.
  // pictogramme : sa largeur, en part du diamètre de son bouchon.
  huile: { x: 1.64, rayon: 0.10, pictogramme: 0.66 },
  jauge: { x: 1.83, longueur: 0.14, largeur: 0.09, arrondi: 0.035, trou: [0.08, 0.036], arrondiTrou: 0.018 },
  frein: { arriere: 1.34, avant: 1.50, demiLargeur: 0.11, arrondi: 0.03, bouchon: 0.075, pictogramme: 0.70 },
  vase: { arriere: 1.55, avant: 1.79, demiLargeur: 0.14, arrondi: 0.035, bouchon: 0.085, pictogramme: 0.70 },
  laveGlace: { x: 1.92, col: 0.095, bouchon: 0.085, pictogramme: 0.70 },
  batterie: { arriere: 1.73, avant: 1.94, demiLargeur: 0.14, arrondi: 0.015,
    bornes: [{ dy: -0.09, signe: "+" }, { dy: 0.09, signe: "−" }], xBorne: 1.78, cosse: [0.04, 0.054], arrondiCosse: 0.008, xSigne: 1.87,
    cable: 0.08 },                         // amorce de chaque câble, depuis sa cosse vers l'arrière
};
let numeroCapot = 0;                       // numéro de chaque dessin du capot : identifiant de découpe unique par montage

function capot() {
  const [L, H] = CATALOGUE.capot.cadre;
  const C = CAPOT, debut = PIED_PARE_BRISE - C.vitre, T = C.lateraux;
  const E = (L - 2 * MARGE) / (2 * C.demiLargeurVue);          // unités par mètre
  const fin = CHARTE.traits.fin, pas = INTERLIGNE * PETIT;
  const ALERTE = ["Jamais moteur chaud"];
  const NOMS = {
    haut: [["vase-expansion", ["Liquide", "de refroidissement", "(vase d'expansion)", ...ALERTE]], ["huile", ["Huile", "moteur"]],
      ["liquide-frein", ["Liquide", "de frein"]]],
    bas: [["lave-glace", ["Lave-glace"]], ["jauge", ["Jauge"]], ["batterie", ["Batterie"]]],
  };
  const lignesMax = (cote) => Math.max(...NOMS[cote].map(([, l]) => l.length));
  // Hauteurs : les noms du dessus, la voiture (du pare-brise, en haut, au nez), les noms du dessous, la mention ; le tout tient dans
  // le cadre.
  const hautNoms = (nb) => ESPACE_TEXTE + (HAUT_TEXTE + BAS_TEXTE) * PETIT + (nb - 1) * pas;
  const hautDessin = MARGE + hautNoms(lignesMax("haut")) + C.jeu;
  const hauteurDessin = (DEMI_LONGUEUR - debut) * E, basDessin = hautDessin + hauteurDessin;
  const basNoms = basDessin + C.jeu + hautNoms(lignesMax("bas"));
  const yMention = basNoms + C.ecartMention + HAUT_TEXTE * PETIT;
  if (yMention + BAS_TEXTE * PETIT > H - MARGE) throw new Error(`Sous le capot : cadre de ${H} unités de haut, il en faut ${Math.ceil(yMention + BAS_TEXTE * PETIT + MARGE)}.`);
  // Repère de la voiture (x vers l'avant, y vers sa droite, m) ramené au cadre : l'avant en bas, la droite de la voiture à gauche.
  const X0 = L / 2, Y0 = hautDessin - debut * E;
  const v = ([x, y]) => [X0 - y * E, Y0 + x * E];
  const rect = (x1, y1, x2, y2, r) => rectArrondi(x1, y1, x2, y2, r).map(v);
  const rond = ([cx, cy], r, attributs) => { const [x, y] = v([cx, cy]); return n("circle", { cx: x, cy: y, r: r * E, ...attributs }); };
  const boiteM = (x1, y1, x2, y2) => { const [a, b] = v([x1, y1]), [c, d] = v([x2, y2]); return boiteDe(a, b, c, d); };

  // La voiture du kit, découpée à la fenêtre du dessin (son trait de contour compris) ; identifiant propre à ce montage.
  const idDecoupe = `capot-decoupe-${++numeroCapot}`;
  const [gx, hy] = v([debut, C.demiLargeurVue]), [dx, by] = v([DEMI_LONGUEUR, -C.demiLargeurVue]);   // coins haut gauche, bas droit
  const voiture = [
    n("defs", {}, n("clipPath", { id: idDecoupe },
      n("rect", { x: gx, y: hy, width: dx - gx, height: by - hy + fin }))),
    n("g", { "clip-path": `url(#${idDecoupe})`, "data-r": "decoupe" },
      voitureDessus({ x: X0, y: Y0, cap: QUART, echelle: E, schema: true }))];

  // Compartiment ouvert, en retrait du pied du pare-brise ; le moteur, un seul aplat (sans nom : le cours ne le cite pas).
  const fond = PIED_PARE_BRISE + C.auvent, nez = DEMI_LONGUEUR - C.devant, demi = DEMI_LARGEUR - C.aile;
  const m = C.moteur;
  const compartiment = [
    forme(rect(fond, -demi, nez, demi, C.arrondi), { fill: TEINTES.fond, "data-r": "compartiment" }),
    forme(rect(m.arriere, m.gauche, m.avant, m.droite, m.arrondi), { fill: TEINTES.moteur, "data-r": "moteur" })];

  // Bouchon de remplissage d'huile, sur le moteur : un disque noir, la burette dessus.
  const hu = C.huile, ch = [hu.x, T.huile];
  const huile = n("g", { "data-r": "huile", ...boiteM(hu.x - hu.rayon, T.huile - hu.rayon, hu.x + hu.rayon, T.huile + hu.rayon) },
    rond(ch, hu.rayon, { fill: TEINTES.bouchon, "data-r": "bouchon" }),
    pictogramme("huile", v(ch), 2 * hu.rayon * E * hu.pictogramme, TEINTES.pictogramme));

  // Poignée de la jauge d'huile, devant le moteur : un anneau jaune, celui du dessin « niveaux ».
  const ja = C.jauge, jx1 = ja.x - ja.longueur / 2, jx2 = ja.x + ja.longueur / 2;
  const anneau = [rect(jx1, T.jauge - ja.largeur / 2, jx2, T.jauge + ja.largeur / 2, ja.arrondi),
    rect(ja.x - ja.trou[0] / 2, T.jauge - ja.trou[1] / 2, ja.x + ja.trou[0] / 2, T.jauge + ja.trou[1] / 2, ja.arrondiTrou)];
  const jauge = n("g", { "data-r": "jauge", ...boiteM(jx1, T.jauge - ja.largeur / 2, jx2, T.jauge + ja.largeur / 2) },
    n("path", { d: anneau.map((p) => trace(p)).join(" "), fill: TEINTES.poignee, "fill-rule": "evenodd", "data-r": "anneau" }));

  // Réservoirs translucides et leur bouchon noir : le symbole du freinage sur celui du liquide de frein, le thermomètre dans les
  // vagues sur celui du vase d'expansion.
  const reservoir = (role, R, y, picto) => {
    const centreR = [(R.arriere + R.avant) / 2, y];
    return n("g", { "data-r": role, ...boiteM(R.arriere, y - R.demiLargeur, R.avant, y + R.demiLargeur) },
      forme(rect(R.arriere, y - R.demiLargeur, R.avant, y + R.demiLargeur, R.arrondi), { fill: TEINTES.plastique }),
      rond(centreR, R.bouchon, { fill: TEINTES.bouchon, "data-r": "bouchon" }),
      picto && pictogramme(picto, v(centreR), 2 * R.bouchon * E * R.pictogramme, TEINTES.pictogramme));
  };
  const frein = reservoir("liquide-frein", C.frein, T.frein, "frein");
  const vase = reservoir("vase-expansion", C.vase, T.vase, "refroidissement");
  // Remplissage du lave-glace, dans le coin avant : le col translucide, son bouchon bleu, le pare-brise et son jet dessus.
  const lg = C.laveGlace, cl = [lg.x, T.laveGlace];
  const laveGlace = n("g", { "data-r": "lave-glace", ...boiteM(lg.x - lg.col, T.laveGlace - lg.col, lg.x + lg.col, T.laveGlace + lg.col) },
    rond(cl, lg.col, { fill: TEINTES.plastique }),
    rond(cl, lg.bouchon, { fill: TEINTES.bouchonLaveGlace, "data-r": "bouchon" }),
    pictogramme("laveGlace", v(cl), 2 * lg.bouchon * E * lg.pictogramme, TEINTES.pictogramme));

  // Batterie : le bac, deux cosses serrées sur ses bornes, chacune au bout d'un câble, les signes + et − moulés à côté.
  const ba = C.batterie;
  const borne = ({ dy, signe }) => {
    const y = T.batterie + dy, [cx, cy] = v([ba.xBorne, y]), arriereCosse = ba.xBorne - ba.cosse[0] / 2;
    const [sx, sy] = v([ba.xSigne, y]), [a1, b1] = v([arriereCosse, y]), [a2, b2] = v([arriereCosse - ba.cable, y]);
    return [n("g", { "data-r": `cosse-${signe === "+" ? "plus" : "moins"}`, "data-x": cx, "data-y": cy },
      n("line", { x1: a1, y1: b1, x2: a2, y2: b2, stroke: TEINTES.cable, "stroke-width": CHARTE.traits.fort, "stroke-linecap": "round",
        "data-r": "cable" }),
      forme(rect(arriereCosse, y - ba.cosse[1] / 2, ba.xBorne + ba.cosse[0] / 2, y + ba.cosse[1] / 2, ba.arrondiCosse), { fill: TEINTES.cosse })),
    texte(sx, sy + MILIEU_CAPITALES * PETIT, signe, { taille: PETIT, ancrage: "middle", graisse: 600, couleur: CHARTE.fond })];
  };
  const batterie = n("g", { "data-r": "batterie", ...boiteM(ba.arriere, T.batterie - ba.demiLargeur, ba.avant, T.batterie + ba.demiLargeur) },
    forme(rect(ba.arriere, T.batterie - ba.demiLargeur, ba.avant, T.batterie + ba.demiLargeur, ba.arrondi), { fill: TEINTES.batterie }),
    ba.bornes.map(borne));

  // Étiquettes : chaque point part du bord de l'organe tourné vers son nom, à C.retrait unité dedans ; au-dessus, les organes du
  // côté du pare-brise et du moteur ; au-dessous, ceux de l'avant. Le nom est centré sur son ancre, au-dessus ou au-dessous.
  const nom = (role, [xBord, y], lignesTexte, enHaut) => {
    const [x, yc] = v([xBord, y]), ancre = [x + (C.decalages[role] || 0), enHaut ? hautDessin - C.jeu : basDessin + C.jeu];
    return etiquette({ cible: [x, yc + (enHaut ? C.retrait : -C.retrait)], ancre, lignes: lignesTexte, ancrage: "middle", taille: PETIT,
      role: `etiquette-${role}` });
  };
  const centreVase = (C.vase.arriere + C.vase.avant) / 2;
  const bords = {
    batterie: [ba.avant, T.batterie], jauge: [jx2, T.jauge], "lave-glace": [lg.x + lg.col, T.laveGlace],
    "liquide-frein": [C.frein.arriere, T.frein], huile: [hu.x - hu.rayon, T.huile], "vase-expansion": [centreVase - C.vase.bouchon, T.vase],
  };
  const nomme = (role, l, enHaut) => (role === "vase-expansion" ? mettreEnGarde(nom(role, bords[role], l, enHaut), ALERTE) : nom(role, bords[role], l, enHaut));
  const noms = [...NOMS.haut.map(([role, l]) => nomme(role, l, true)), ...NOMS.bas.map(([role, l]) => nomme(role, l, false))];

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.capot.titre,
    description: "Capot ouvert, le compartiment moteur vu de l'avant, comme par celui qui se tient devant la voiture : l'avant en bas, "
      + "le pare-brise en haut. Bouchon de remplissage et jauge d'huile, "
      + "vase d'expansion du liquide de refroidissement (jamais ouvert moteur chaud), réservoir de liquide de frein, remplissage du "
      + "lave-glace, batterie et ses cosses + et −. Chaque bouchon de remplissage porte son pictogramme : la burette sur celui de "
      + "l'huile, le thermomètre dans les vagues sur celui du liquide de refroidissement, le symbole du freinage sur celui du "
      + "liquide de frein, le pare-brise et son jet sur celui du lave-glace. Disposition la plus courante : elle varie selon les "
      + "modèles." },
  voiture, compartiment, huile, jauge, frein, vase, laveGlace, batterie, noms,
  texte(L / 2, yMention, "Disposition la plus courante ; elle varie selon les modèles",
    { taille: PETIT, ancrage: "middle", couleur: CHARTE.texteDoux, role: "mention" }));
}

// ===== Lire un niveau =====
// Trois colonnes alignées sur une même base : la jauge d'huile (centimètres, tenue pointe en bas), un réservoir translucide
// (centimètres), une petite voiture de profil (mètres, la voiture du kit en silhouette) posée sur un sol plat ; une légende sous
// chacune. Retour du formateur du 22/10/2026 (« quelque chose de plus représentatif de la réalité : un thème de design et un thème
// de couleurs ; l'anneau où on vient tirer dessus est souvent jaune ») : la jauge d'une voiture courante, anneau de prise et col
// en plastique jaune, lame d'acier, repères MIN et MAX à son extrémité, la zone striée entre eux, la trace d'huile ambrée qui
// s'y arrête ; le réservoir d'un circuit (un vase d'expansion) : plastique blanc translucide, col et bouchon noir strié, tuyau de
// sortie, repères MIN et MAX moulés, le liquide vu au travers. Aplats, deux tons par pièce, sans reflet ni dégradé.
const NIVEAUX = {
  base: 172,          // pointe de la jauge, fond du réservoir, sol
  legende: 187,       // ligne de base des légendes
  jauge: {
    echelle: 11, decalage: -12,              // unités par centimètre ; axe de la lame, depuis le milieu de la colonne
    lame: 1.0, mini: 2.0, maxi: 4.5, huile: 3.4,   // largeur de la lame ; hauteurs au-dessus de la pointe, en centimètres
    bas: 8.0, coupure: 0.7, pente: 0.15, haut: 1.0,  // lame dessinée jusqu'à 8 cm, coupure, morceau du haut jusqu'au col
    encoche: { profondeur: 0.16, demiHauteur: 0.16 },
    stries: { pas: 0.26, retrait: 0.07 },   // zone striée : écart des stries (cm), retrait des bords de la lame
    col: { largeur: 1.1, hauteur: 0.9, arrondi: 0.2 },
    poignee: { largeur: 3.6, hauteur: 2.8, arrondi: 1.1, trou: [2.2, 1.3], arrondiTrou: 0.55 },
    trait: { ecart: 0.25, longueur: 0.5 }, texte: 0.3,   // trait de chaque repère, puis son nom
  },
  reservoir: {
    echelle: 6.8,
    corps: { largeur: 12.6, hauteur: 13, arrondi: 2.0 },
    col: { gauche: 3.0, droite: 7.4, hauteur: 1.6 },                    // sur le haut du corps
    bouchon: { gauche: 2.3, droite: 8.1, hauteur: 2.4, arrondi: 0.5, stries: 5 },   // posé sur le col
    tuyau: { longueur: 1.4, bas: 1.0, haut: 2.6, dedans: 0.3 },        // sortie sur le flanc droit, près du fond ; part sous le corps
    max: 10.5, min: 4.5, niveau: 7.5,        // hauteurs au-dessus du fond
    trait: { debut: 1.0, fin: 3.6 }, texte: 4.2,
  },
  voiture: { echelle: 16, sol: 92 },         // unités par mètre ; longueur du sol dessiné
};

// Hachures croisées (à 45 degrés dans les deux sens) d'un rectangle du cadre [x1, x2] sur [y1, y2], à `pas` unités d'écart : la
// liste des segments, coupés aux bords du rectangle.
function hachures(x1, y1, x2, y2, pas) {
  const segments = [], ecart = pas * Math.SQRT2;
  for (const sens of [1, -1]) {
    // Droites y = sens x + c ; c va d'un coin à l'autre du rectangle.
    const cs = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].map(([x, y]) => y - sens * x);
    const [cMin, cMax] = [Math.min(...cs), Math.max(...cs)];
    const premier = cMin + ((cMax - cMin) % ecart) / 2;
    for (let c = premier; c <= cMax; c += ecart) {
      const [a, b] = sens > 0 ? [Math.max(x1, y1 - c), Math.min(x2, y2 - c)] : [Math.max(x1, c - y2), Math.min(x2, c - y1)];
      if (b - a > 1e-6) segments.push([[a, sens * a + c], [b, sens * b + c]]);
    }
  }
  return segments;
}
const traceSegments = (segments) => segments.map(([a, b]) => `M${point(a)} L${point(b)}`).join(" ");

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
  // Zone striée, entre les deux repères, en retrait des bords et des encoches : sèche au-dessus de la trace d'huile, mouillée
  // dessous (les stries retiennent l'huile : c'est là que se lit le niveau).
  const S = J.stries, [sx1, sx2] = [vj([-d + S.retrait, 0])[0], vj([d - S.retrait, 0])[0]];
  const [yMaxi, yMini] = [vj([0, J.maxi - e.demiHauteur])[1], vj([0, J.mini + e.demiHauteur])[1]];
  const pas = S.pas * J.echelle;
  const striesSeches = hachures(sx1, yMaxi, sx2, yHuile, pas), striesMouillees = hachures(sx1, yHuile, sx2, yMini, pas);
  const hautCoupure = J.bas + J.coupure;
  const lameHaut = [[d, hautCoupure - J.pente], [d, hautCoupure + J.haut], [-d, hautCoupure + J.haut], [-d, hautCoupure + J.pente]].map(vj);
  const C = J.col, basCol = hautCoupure + J.haut;
  const col = rectArrondi(-C.largeur / 2, basCol, C.largeur / 2, basCol + C.hauteur, C.arrondi).map(vj);
  const P = J.poignee, basPoignee = basCol + C.hauteur;
  const poigneePts = [rectArrondi(-P.largeur / 2, basPoignee, P.largeur / 2, basPoignee + P.hauteur, P.arrondi),
    rectArrondi(-P.trou[0] / 2, basPoignee + (P.hauteur - P.trou[1]) / 2, P.trou[0] / 2, basPoignee + (P.hauteur + P.trou[1]) / 2, P.arrondiTrou)]
    .map((pts) => pts.map(vj));
  const centrePoignee = vj([0, basPoignee + P.hauteur / 2]);
  const repere = (role, nom, h) => {
    const y = vj([0, h])[1], x1 = vj([d + J.trait.ecart, 0])[0], x2 = vj([d + J.trait.ecart + J.trait.longueur, 0])[0];
    return n("g", { "data-r": `repere-${role}`, "data-y": y },
      n("line", { x1, y1: y, x2, y2: y, stroke: TEINTES.repere, "stroke-width": fin, "stroke-linecap": "round" }),
      texte(x2 + J.texte * J.echelle, y + MILIEU_CAPITALES * PETIT, nom, { taille: PETIT, graisse: 600, couleur: CHARTE.texteDoux }));
  };
  const jauge = n("g", { "data-r": "jauge" },
    forme(lameHaut, { fill: TEINTES.lame, stroke: TEINTES.lameBord, "stroke-width": fin, "stroke-linejoin": "round" }),
    forme(col, { fill: TEINTES.poignee, stroke: TEINTES.poigneeBord, "stroke-width": fin, "data-r": "col-jauge" }),
    n("path", { d: poigneePts.map((p) => trace(p)).join(" "), fill: TEINTES.poignee, stroke: TEINTES.poigneeBord, "stroke-width": fin,
      "fill-rule": "evenodd", "data-r": "poignee-jauge", "data-x": centrePoignee[0], "data-y": centrePoignee[1] }),
    forme(lameBasPts, { fill: TEINTES.lame, stroke: TEINTES.lameBord, "stroke-width": fin, "stroke-linejoin": "round", "data-r": "pointe-jauge",
      "data-x": ax, "data-y": N.base }),
    forme(traceHuile, { fill: TEINTES.huile, "data-r": "trace-huile", "data-y": yHuile }),
    n("g", { "data-r": "stries", "data-x1": sx1, "data-x2": sx2, "data-y1": yMaxi, "data-y2": yMini },
      n("path", { d: traceSegments(striesSeches), fill: "none", stroke: TEINTES.striesSeches, "stroke-width": fin, "data-r": "stries-seches" }),
      n("path", { d: traceSegments(striesMouillees), fill: "none", stroke: TEINTES.striesHuile, "stroke-width": fin, "data-r": "stries-huile" })),
    repere("maxi", "MAX", J.maxi), repere("mini", "MIN", J.mini));

  // Réservoir : repère (u depuis le bord gauche du corps, h au-dessus du fond, centimètres) ramené au cadre ; le corps et son
  // tuyau, centrés dans la colonne.
  const R = N.reservoir, K = R.corps, T = R.tuyau;
  const gaucheR = milieu(1) - ((K.largeur + T.longueur) * R.echelle) / 2;
  const vr = ([u, h]) => [gaucheR + u * R.echelle, N.base - h * R.echelle];
  const corps = rectArrondi(0, 0, K.largeur, K.hauteur, K.arrondi).map(vr);
  const colR = coins(R.col.gauche, K.hauteur, R.col.droite, K.hauteur + R.col.hauteur).map(vr);
  const tuyau = coins(K.largeur - T.dedans, T.bas, K.largeur + T.longueur, T.haut).map(vr);
  const yNiveau = vr([0, R.niveau])[1];
  const liquide = couper(corps, (p) => yNiveau - p[1]);
  const xg = vr([0, 0])[0], xd = vr([K.largeur, 0])[0];
  const B = R.bouchon, basBouchon = K.hauteur + R.col.hauteur;
  const bouchon = rectArrondi(B.gauche, basBouchon, B.droite, basBouchon + B.hauteur, B.arrondi).map(vr);
  // Stries de prise du bouchon : des traits verticaux, à pas égal entre ses bords arrondis.
  const stries = Array.from({ length: B.stries }, (_, k) => {
    const u = B.gauche + B.arrondi + ((B.droite - B.gauche - 2 * B.arrondi) * (k + 1)) / (B.stries + 1);
    return [vr([u, basBouchon + B.arrondi / 2]), vr([u, basBouchon + B.hauteur - B.arrondi / 2])];
  });
  const marque = (nom, h) => {
    const y = vr([0, h])[1];
    return n("g", { "data-r": `repere-${nom.toLowerCase()}`, "data-y": y },
      n("line", { x1: vr([R.trait.debut, 0])[0], y1: y, x2: vr([R.trait.fin, 0])[0], y2: y, stroke: TEINTES.repere, "stroke-width": moyen,
        "stroke-linecap": "round" }),
      texte(vr([R.texte, 0])[0], y + MILIEU_CAPITALES * PETIT, nom, { taille: PETIT, graisse: 600, couleur: CHARTE.texteDoux }));
  };
  const reservoir = n("g", { "data-r": "reservoir" },
    forme(tuyau, { fill: TEINTES.liquide, stroke: TEINTES.plastiqueBord, "stroke-width": moyen, "stroke-linejoin": "round", "data-r": "tuyau" }),
    forme(colR, { fill: TEINTES.plastique, stroke: TEINTES.plastiqueBord, "stroke-width": moyen, "stroke-linejoin": "round", "data-r": "col" }),
    forme(corps, { fill: TEINTES.plastique, "data-r": "corps" }),
    forme(liquide, { fill: TEINTES.liquide, "data-r": "liquide" }),
    n("line", { x1: xg, y1: yNiveau, x2: xd, y2: yNiveau, stroke: TEINTES.liquideSurface, "stroke-width": moyen, "data-r": "niveau", "data-y": yNiveau }),
    forme(corps, { fill: "none", stroke: TEINTES.plastiqueBord, "stroke-width": moyen, "data-r": "contour" }),
    n("g", { "data-r": "bouchon" },
      forme(bouchon, { fill: TEINTES.bouchon, "data-r": "bouchon-corps" }),
      n("path", { d: traceSegments(stries), fill: "none", stroke: TEINTES.bouchonStries, "stroke-width": fin, "stroke-linecap": "round",
        "data-r": "bouchon-stries" })),
    marque("MAX", R.max), marque("MIN", R.min));

  // Voiture du kit en silhouette, posée sur un sol horizontal.
  const xv = milieu(2), demiSol = N.voiture.sol / 2;
  const voiture = [
    n("line", { x1: xv - demiSol, y1: N.base, x2: xv + demiSol, y2: N.base, stroke: TEINTES.sol, "stroke-width": moyen, "stroke-linecap": "round",
      "data-r": "sol" }),
    voitureProfil({ x: xv, y: N.base, echelle: N.voiture.echelle, schema: true })];

  const legende = (i, mots) => texte(milieu(i), N.legende, mots, { taille: MOYEN, ancrage: "middle", graisse: 500, couleur: CHARTE.texteDoux });
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.niveaux.titre,
    description: "À gauche, la jauge d'huile tenue pointe en bas, son anneau jaune en haut : la trace d'huile s'arrête dans la zone "
      + "striée, entre les repères MIN et MAX. Au milieu, un réservoir translucide : le niveau du liquide est entre MIN et MAX. À droite, "
      + "la voiture sur un sol plat." },
  jauge, reservoir, voiture,
  legende(0, "Jauge d'huile"), legende(1, "Réservoir"), legende(2, "Sol plat"));
}

// ===== Contrôler un pneu =====
// Quatre vignettes. En haut, le pneu 205/55 R16 des roues du kit coupé en travers sur sa jante (millimètres) : flanc sans
// déformation (juste), flanc avec une hernie (faux). En bas (retour du formateur du 22/10/2026 sur la coupe précédente : « le bas
// pour la sculpture, on ne comprend pas »), un morceau de la bande de roulement vu en perspective (millimètres, à l'échelle MM) :
// deux pains et la rainure qui les sépare, le témoin d'usure, petite bosse au fond de la rainure, à l'avant du morceau, coté
// « 1,6 mm » ; sculptures nettement au-dessus du témoin (juste), pains usés au niveau du témoin : il affleure (faux).
export const MM = 4.4;              // unités par millimètre, morceau de la bande de roulement
const TEMOIN_MM = 1.6;              // profondeur minimale des sculptures : la hauteur des témoins d'usure
const SOUS_PASTILLE = MISE_EN_PAGE.margePastille + MISE_EN_PAGE.hauteurPastille;   // bas de la pastille d'une vignette, depuis son haut
const RECOUVREMENT_MM = 0.2;        // deux faces de même teinte se chevauchent de 0,2 mm : aucun joint clair entre elles
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
    // Millimètres : la rainure (celle de la coupe du haut), la part montrée de chaque pain, la gomme sous la rainure, la
    // profondeur des sculptures du pneu bon, la longueur du morceau le long de la bande, celle du témoin le long de la rainure.
    rainure: 9, pain: 6, base: 3.5, sculpture: 7, longueur: 18, temoin: 6,
    // Perspective cavalière : l'axe de la longueur fuit vers le haut et la droite, de cet angle (degrés), raccourci de ce rapport.
    fuite: { angle: 30, rapport: 0.5 },
    fondFace: 116,                  // du haut de la vignette au fond de la rainure, sur la face avant
    tic: 1.2,                       // demi-longueur des traits de la cote, millimètres
    cibleTemoin: [0.15, 2],         // le point du nom du témoin, sur son dessus : à cette part de la rainure depuis sa paroi gauche,
                                    // à tant de millimètres de l'avant (hors de la cote, au milieu)
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

  // Vignettes de la bande de roulement : un morceau de gomme en perspective cavalière, vu de devant, d'au-dessus et de la droite.
  // Repère du morceau (millimètres) : u en travers, depuis son bord gauche ; h au-dessus du fond de la rainure ; z le long de la
  // bande, depuis sa face avant. Peint du fond vers l'avant : fond de la rainure, sa paroi gauche (la face droite du pain gauche,
  // tournée vers nous), le dessus du témoin, les faces avant, les dessus des pains, la face droite du morceau. Le pain droit, peint
  // après, cache ce que la rainure a derrière lui.
  const bande = (etat, x) => {
    const bon = etat === "juste", S = bon ? B.sculpture : TEMOIN_MM;
    const g1 = B.pain, g2 = B.pain + B.rainure, W = 2 * B.pain + B.rainure, D = B.longueur, T = TEMOIN_MM;
    const fx = B.fuite.rapport * Math.cos((B.fuite.angle * Math.PI) / (2 * QUART)), fy = B.fuite.rapport * Math.sin((B.fuite.angle * Math.PI) / (2 * QUART));
    const ox = x + (largeur - (W + D * fx) * MM) / 2, oy = yBande + B.fondFace;
    const vb = ([u, h, z]) => [ox + (u + z * fx) * MM, oy - (h + z * fy) * MM];
    const face = (pts, teinte, role) => forme(pts.map(vb), { fill: teinte, ...(role ? { "data-r": role } : {}) });
    const T3 = TEINTES.bande;
    const fondRainure = face([[g1, 0, 0], [g2, 0, 0], [g2, 0, D], [g1, 0, D]], T3.fond, "fond-rainure");
    const paroi = face([[g1, 0, 0], [g1, 0, D], [g1, S, D], [g1, S, 0]], T3.cote, "paroi");
    const temoinDessus = face([[g1, T, 0], [g2, T, 0], [g2, T, B.temoin], [g1, T, B.temoin]], T3.temoinDessus, "temoin-dessus");
    const faces = [face([[0, -B.base, 0], [g1, -B.base, 0], [g1, S, 0], [0, S, 0]], GOMME, "sculpture"),
      face([[g2, -B.base, 0], [W, -B.base, 0], [W, S, 0], [g2, S, 0]], GOMME, "sculpture"),
      face([[g1 - RECOUVREMENT_MM, -B.base, 0], [g2 + RECOUVREMENT_MM, -B.base, 0], [g2 + RECOUVREMENT_MM, 0, 0], [g1 - RECOUVREMENT_MM, 0, 0]], GOMME, "base"),
      face([[g1, 0, 0], [g2, 0, 0], [g2, T, 0], [g1, T, 0]], T3.temoinFace, "temoin")];
    const dessus = [[0, g1], [g2, W]].map(([a, b]) => face([[a, S, 0], [b, S, 0], [b, S, D], [a, S, D]], T3.dessus, "dessus-pain"));
    const flanc = face([[W, -B.base, 0], [W, -B.base, D], [W, S, D], [W, S, 0]], T3.cote, "cote-droite");
    // Cote du témoin, sur sa face avant ; « 1,6 mm » dessous, sur la gomme de la face avant.
    const um = (g1 + g2) / 2, [xc, yTemoin] = vb([um, T, 0]), yFond = vb([um, 0, 0])[1], tic = B.tic * MM;
    const cote = n("g", { "data-r": "cote", "data-y1": yTemoin, "data-y2": yFond },
      n("line", { x1: xc, y1: yTemoin, x2: xc, y2: yFond, stroke: TEINTES.cote, "stroke-width": fin }),
      [yTemoin, yFond].map((y) => n("line", { x1: xc - tic, y1: y, x2: xc + tic, y2: y, stroke: TEINTES.cote, "stroke-width": fin,
        "stroke-linecap": "round" })),
      texte(xc, vb([um, -B.base / 2, 0])[1] + MILIEU_CAPITALES * PETIT, "1,6 mm", { taille: PETIT, ancrage: "middle", graisse: 600,
        couleur: TEINTES.cote }));
    const legende = bon ? ["Sculptures au-dessus", "du témoin d'usure"] : ["Le témoin affleure :", "le pneu se remplace"];
    const yLegende = yBande + hauteurBande - MARGE - BAS_TEXTE * PETIT - INTERLIGNE * PETIT;
    const ancreY = yBande + N.ancreBande;
    return vignette({ x, y: yBande, largeur, hauteur: hauteurBande, etat },
      n("g", { "data-r": `bande-${etat}`, "data-x": ox, "data-y": oy, "data-echelle": MM },
        fondRainure, paroi, temoinDessus, faces, dessus, flanc, cote,
        nom(vb([g1 / 2, S, D / 2]), [x + MARGE + N.sculptures / 2, ancreY], ["Sculptures"], "nom-sculptures"),
        nom(vb([g1 + B.cibleTemoin[0] * B.rainure, T, B.cibleTemoin[1]]), [x + largeur - MARGE - N.temoin / 2, ancreY], ["Témoin", "d'usure"], "nom-temoin"),
        legende.map((l, i) => texte(x + largeur / 2, yLegende + i * INTERLIGNE * PETIT, l, { taille: PETIT, ancrage: "middle", couleur: CHARTE.texteDoux }))));
  };

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE.pneu.titre,
    description: "Juste : flanc sans déformation. Faux : hernie, une bosse sur le flanc. Juste : un morceau de la bande de roulement, "
      + "deux pains et la rainure qui les sépare, le témoin d'usure, une bosse de 1,6 mm au fond de la rainure, sous les sculptures. "
      + "Faux : les pains sont usés au niveau du témoin, il affleure : le pneu se remplace." },
  flanc("juste", xs[0]), flanc("faux", xs[1]), bande("juste", xs[0]), bande("faux", xs[1]));
}

// ===== La pression des pneus =====
// La voiture du kit de profil, en silhouette (option schema), côté conducteur (son avant à gauche : sens « gauche » du kit),
// portière avant et trappe à carburant ouvertes ; l'étiquette des pressions sur le montant découvert et dans la trappe, chacune
// entourée d'un cercle.
const PRESSION = {
  echelle: 62,                 // unités par mètre : la voiture et ses noms au-dessus tiennent dans le cadre, marges comprises
  sol: 150,                    // ligne du sol
  etiquette: { largeur: 0.08, hauteur: 0.12 },   // mètres : une étiquette courante, sur le montant découvert (9 cm)
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
  const biais = Math.abs(Math.cos((VOITURE_PROFIL.trappe.ouverture * Math.PI) / (2 * QUART)));
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
export { versDom } from "./dessin-svg.js?v=20261023b";
