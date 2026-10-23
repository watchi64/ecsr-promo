/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Dessins de la famille « poste » : tenir le volant (C1.3), les commandes du poste de conduite (C1.1), les pédales et les
 * pieds (C1.2). Les pièces volant, repereMain et pointHeure servent aussi aux gestes du volant (registre GESTES).
 *
 * Vue du siège : le volant est vu de face, comme le conducteur le voit ; « sens horaire » est celui des aiguilles d'une
 * montre pour lui, et les heures du volant sont celles d'un cadran (12 en haut, 3 à droite). Chaque dimension part d'une
 * mesure en centimètres, ramenée en unités du cadre par l'échelle du dessin : rien n'est placé à l'œil. Les valeurs sans
 * portée réglementaire sont des choix de dessin, recopiés avec leur raison dans sources/dessins-poste.js. Titres et cadres
 * viennent du catalogue des blocs (js/catalogue-blocs.js), la seule source de ces métadonnées.
 *
 * Style schématique (décision du formateur du 15/10/2026, essayé d'abord sur C1.3) : les dessins de C1.3 ne dessinent aucune
 * main ; chaque main est un repère, un disque marqué « G » ou « D » posé sur la jante (repereMain), et le volant comme la
 * voiture sont des silhouettes à plat. L'essai validé (22/10/2026), le style s'étend aux dessins de C1.1 et de C1.2 : volant à plat
 * et commandes en formes simples (poste-commandes), pédales en aplats et pieds en pictogrammes (pedales). Le repère d'une main est
 * la pièce du kit (disqueMain), commune à la famille « conducteur ».
 */
import { n } from "./dessin-svg.js?v=20261023d";
import { CHARTE, COULEURS_VOYANTS, METRIQUES_POLICE, cadre, texte, etiquette, fleche, arc, voitureDessus, coord, point as pt, trace,
  disqueMain, gelule, formePictogramme } from "./dessins-kit.js?v=20261023d";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261023d";
import { cles } from "./animation-courbes.js?v=20261023d";

// ===== Teintes de l'habitacle (choix de dessin) =====
// Tons neutres (spec § 3) : plastique sombre des commandes en trois tons (base, reflet, ombre), planche claire, symboles clairs
// sur les commandes ; le symbole des feux de détresse est rouge (règlement ONU n° 121, symbole 6), du rouge normalisé des voyants
// (COULEURS_VOYANTS du kit, celui du dessin « voyants »).
const TEINTES = {
  commande: "#2E3732", commandeReflet: "#56635B", commandeOmbre: "#1D2420",
  colonne: "#3E4843",
  planche: "#E1E6DB", plancheOmbre: "#CBD3C4", console: "#D3DACC",
  symbole: "#EEF2EB",
  metal: "#A9B2A8", metalOmbre: "#7F8A80",
};

// ===== Géométrie de base =====
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const fois = (a, k) => [a[0] * k, a[1] * k];
const moins = (a, b) => [a[0] - b[0], a[1] - b[1]];
const longueur = (a) => Math.hypot(a[0], a[1]);
const unitaire = (a) => fois(a, 1 / longueur(a));
const normale = ([x, y]) => [-y, x];
const PAS_HEURE = Math.PI / 6;           // une heure du cadran, en radians
const HEURES_PAR_TOUR = 12;
const DEGRES_PAR_HEURE = 30;

// Quadrilatère d'une tige, de `a` à `b`, de largeurs la et lb (commodos, fente de la clé).
function troncon(a, b, la, lb) {
  const nrm = normale(unitaire(moins(b, a)));
  return [plus(a, fois(nrm, la / 2)), plus(b, fois(nrm, lb / 2)), plus(b, fois(nrm, -lb / 2)), plus(a, fois(nrm, -la / 2))];
}

// ===== Volant =====

/** Point de la jante (ou d'un cercle de même centre) à une heure du cadran : 12 en haut, 3 à droite, sens horaire. */
export function pointHeure(cx, cy, rayon, heure) {
  const a = heure * PAS_HEURE;
  return [cx + rayon * Math.sin(a), cy - rayon * Math.cos(a)];
}

// Volant d'une voiture particulière, vu de face, en centimètres : ligne médiane de la jante (37 cm de diamètre), épaisseur
// de la jante, moyeu (le coussin de l'airbag, où est l'avertisseur), branches de 3 h et 9 h, branche de 6 h plus large.
// Reflets (lumière venue d'en haut à gauche, qui ne tourne pas avec le volant) : un trait moyen de la charte, de 9 h 40 à
// 11 h 20 sur la moitié intérieure de la jante, de 9 h 30 à 11 h 30 au bord du moyeu.
const VOLANT = {
  rayon: 18.5, jante: 3.4, moyeu: 6.6,
  branche: { moyeu: 5.6, jante: 4.4, depart: 3.0 },
  brancheBas: { moyeu: 6.4, jante: 4.8, depart: 3.0 },
  reflet: { debut: 9.67, fin: 11.33, decalage: -0.75 },
  refletMoyeu: { debut: 9.5, fin: 11.5, decalage: -0.6 },
};
/** Épaisseur de la jante vue de face, en fraction du rayon de sa ligne médiane. */
export const EPAISSEUR_JANTE = VOLANT.jante / VOLANT.rayon;

// Klaxon normalisé (règlement ONU n° 121, symbole 29) : l'embouchure, le tube, le pavillon qui s'évase vers la droite et
// l'ellipse de son ouverture ; abscisses et demi-hauteurs en fraction de sa longueur (6 cm), centré sur le moyeu.
const AVERTISSEUR = {
  longueur: 6.0, gauche: -0.5,
  embouchure: { largeur: 0.07, demi: 0.16 }, tube: { fin: -0.08, demi: 0.06 }, pavillon: { fin: 0.3, demi: 0.3 },
  ouverture: { centre: 0.34, rx: 0.14, ry: 0.31, epaisseur: 0.08 },
};

function arcHeures(cx, cy, rayon, debut, fin) {
  const [a, b] = [pointHeure(cx, cy, rayon, debut), pointHeure(cx, cy, rayon, fin)];
  const grand = (fin - debut) * DEGRES_PAR_HEURE > 180 ? 1 : 0;
  return `M${pt(a)} A${coord(rayon)} ${coord(rayon)} 0 ${grand} 1 ${pt(b)}`;
}
// Anneau plein entre deux cercles de même centre (la jante) : une surface, pas un trait épais hors du jeu de la charte.
function anneau(cx, cy, exterieur, interieur) {
  const cercle = (r) => `M${pt([cx - r, cy])} A${coord(r)} ${coord(r)} 0 1 0 ${pt([cx + r, cy])} A${coord(r)} ${coord(r)} 0 1 0 ${pt([cx - r, cy])} Z`;
  return `${cercle(exterieur)} ${cercle(interieur)}`;
}

/** Volant vu du conducteur : jante, trois branches à 3 h, 6 h et 9 h tournées de `angle` degrés (sens horaire positif),
 *  moyeu. Le groupe porte le centre (data-x, data-y), le rayon de la ligne médiane de la jante (data-rayon) et l'angle
 *  (data-angle). Les branches et le moyeu tournent autour du centre (groupe « volant-tournant », avec le klaxon) ; la jante
 *  et les reflets ne tournent pas (un cercle reste un cercle, la lumière ne tourne pas). `avertisseur` : le pictogramme du
 *  klaxon sur le moyeu, qui prend alors le rôle « avertisseur » et sa boîte. `schema` : le style schématique, à plat, sans
 *  reflet (jante, moyeu et trois branches en aplats). */
export function volant({ cx, cy, rayon, angle = 0, role = "volant", avertisseur = false, schema = false }) {
  const k = rayon / VOLANT.rayon;
  const centre = [cx, cy], e = EPAISSEUR_JANTE * rayon;
  const branche = (heure, { moyeu, jante, depart }) => {
    const a = heure * PAS_HEURE;
    const d = [Math.sin(a), -Math.cos(a)], p = normale(d);
    const [r0, r1] = [depart * k, rayon];
    const points = [
      plus(plus(centre, fois(d, r0)), fois(p, (moyeu * k) / 2)), plus(plus(centre, fois(d, r1)), fois(p, (jante * k) / 2)),
      plus(plus(centre, fois(d, r1)), fois(p, (-jante * k) / 2)), plus(plus(centre, fois(d, r0)), fois(p, (-moyeu * k) / 2)),
    ];
    const vrai = (((heure * DEGRES_PAR_HEURE + angle) % 360) + 360) % 360;
    // Repère : le bout de la branche sur la ligne médiane de la jante, tourné avec le volant (unités du cadre).
    const [bx, by] = pointHeure(cx, cy, rayon, heure + angle / DEGRES_PAR_HEURE);
    return n("path", { d: trace(points), fill: TEINTES.commande, "data-r": `branche-${heure}`, "data-angle": vrai, "data-x": bx, "data-y": by });
  };
  const rMoyeu = VOLANT.moyeu * k;
  const moyeu = n("g", avertisseur
    ? { "data-r": "avertisseur", "data-x": cx, "data-y": cy, "data-largeur": 2 * rMoyeu, "data-hauteur": 2 * rMoyeu }
    : { "data-r": "moyeu" },
  n("circle", { cx, cy, r: rMoyeu, fill: TEINTES.commande }),
  avertisseur ? pictoAvertisseur(cx, cy, AVERTISSEUR.longueur * k, TEINTES.commande) : null);
  const reflet = (r, { debut, fin }, roleReflet) => n("path", { d: arcHeures(cx, cy, r, debut, fin), fill: "none",
    stroke: TEINTES.commandeReflet, "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round", "data-r": roleReflet });
  return n("g", { "data-r": role, "data-x": cx, "data-y": cy, "data-rayon": rayon, "data-angle": angle },
    n("g", { "data-r": "volant-tournant", transform: `rotate(${angle} ${cx} ${cy})` },
      branche(3, VOLANT.branche), branche(9, VOLANT.branche), branche(6, VOLANT.brancheBas), moyeu),
    !schema && reflet(rMoyeu + VOLANT.refletMoyeu.decalage * k, VOLANT.refletMoyeu, "reflet-moyeu"),
    n("path", { d: anneau(cx, cy, rayon + e / 2, rayon - e / 2), fill: TEINTES.commande, "fill-rule": "evenodd", "data-r": "jante" }),
    !schema && reflet(rayon + VOLANT.reflet.decalage * k, VOLANT.reflet, "reflet-jante"));
}

// Le klaxon en plein, sur le fond `fond` (celui du moyeu, qui fait le creux de l'ouverture).
function pictoAvertisseur(cx, cy, longueur, fond) {
  const a = AVERTISSEUR, x = (f) => cx + f * longueur, h = (f) => f * longueur;
  const bord = a.gauche + a.embouchure.largeur;
  const haut = [[x(a.gauche), h(a.embouchure.demi)], [x(bord), h(a.embouchure.demi)], [x(bord), h(a.tube.demi)],
    [x(a.tube.fin), h(a.tube.demi)], [x(a.pavillon.fin), h(a.pavillon.demi)]];
  const corps = [...haut.map(([px, dy]) => [px, cy - dy]), ...[...haut].reverse().map(([px, dy]) => [px, cy + dy])];
  const o = a.ouverture;
  return n("g", { "data-r": "pictogramme-avertisseur" },
    n("path", { d: trace(corps), fill: TEINTES.symbole }),
    n("ellipse", { cx: x(o.centre), cy, rx: h(o.rx), ry: h(o.ry), fill: TEINTES.symbole }),
    n("ellipse", { cx: x(o.centre), cy, rx: h(o.rx - o.epaisseur), ry: h(o.ry - o.epaisseur), fill: fond }));
}

// ===== Mains : les repères G et D =====
// Style schématique : aucune main n'est dessinée. Chaque main est un disque marqué « G » (main gauche) ou « D » (main droite),
// posé sur la ligne médiane de la jante à sa place horaire, ou, main en l'air, déplacé vers le centre du volant. Plein (le ton
// sombre de la peau, la lettre claire) : la main tient la jante et tourne avec elle. Creux (un anneau de ce ton sur le fond
// clair, la lettre du ton de l'anneau) : la main a relâché la jante, la jante glisse dessous, ou la main se déplace hors d'elle.
// Un liseré clair borde chaque disque : il le détache de la jante sombre, et de l'autre repère quand l'un passe sur l'autre.
// Le ton sombre de la peau (CHARTE.peauOmbre) porte la lettre claire à un contraste de 5:1 (4,5:1 exigé pour un texte de cette
// taille), le ton clair (CHARTE.peau) ne la porterait qu'à 3,5:1. Le disque, son liseré, son anneau et sa lettre sont la pièce du
// kit (disqueMain, Outfit 700, la graisse la plus forte de l'app), commune à tous les repères de main ; ses mesures sur le volant :
const REPERE = {
  rayon: 10.5,                    // unités : 22,5 px de large sur un téléphone (343 px pour 320 unités)
  lettre: 12,                     // unités : 12,9 px sur un téléphone, au-dessus des 11 px de la charte
  anneau: CHARTE.traits.appuye,   // trait de l'anneau du repère creux
};
const COTES = ["gauche", "droite"];
/** Prises d'une main : 1, elle tient la jante ; `glisse`, la jante glisse dans ses doigts entrouverts ; 0, elle l'a lâchée. */
const PRISE = Object.freeze({ tient: 1, glisse: 0.5, lachee: 0 });
// Remplissage d'un repère, de 0 (creux) à 1 (plein) : plein quand la main tient la jante, creux dès qu'elle la laisse glisser ;
// entre les deux, le temps qu'elle referme ou ouvre les doigts (volant immobile), la teinte passe de l'un à l'autre en fondu.
// Courbe en S (3v² - 2v³, de pente nulle à ses deux bouts) : une main qui lâche la jante d'un coup (prise de 1 à 0 en 0,35 s)
// passe par PRISE.glisse à sa plus grande vitesse ; une simple proportion y arrêterait le fondu net.
const remplissage = (prise) => {
  const v = Math.min(1, Math.max(0, (prise - PRISE.glisse) / (PRISE.tient - PRISE.glisse)));
  return v * v * (3 - 2 * v);
};

function connu(valeur, permises, quoi) {
  if (!permises.includes(valeur)) throw new Error(`Repère : ${quoi} « ${valeur} » inconnu : ${permises.map((v) => `« ${v} »`).join(", ")} attendu.`);
  return valeur;
}

/** Repère d'une main sur un volant de centre (cx, cy) et de rayon `rayon` (ligne médiane de la jante, en unités), à `heure`
 *  (12 en haut, 3 à droite ; nombre continu), déplacé de `decalage` unités vers le centre du volant (0 : posé sur la jante ;
 *  plus : la main en l'air). `cote` : « gauche » (G) ou « droite » (D). `prise` : de 0 (lâchée) à 1 (elle tient la jante) ;
 *  plein à 1, creux dès 0,5 (PRISE.glisse). Rôles : main-<cote> (centre du disque en data-x et data-y ; data-heure, data-prise),
 *  disque-<cote> (le disque, plein ou du fond clair), anneau-<cote> (son contour), lettre-<cote>. Mêmes nœuds quels que soient
 *  l'heure, la prise, le décalage et le côté : une animation ne fait que changer leurs attributs. */
export function repereMain({ cx, cy, rayon, heure, cote, prise = PRISE.tient, decalage = 0 }) {
  connu(cote, COTES, "côté");
  if (!Number.isFinite(heure)) throw new Error(`Repère : heure « ${heure} » non finie.`);
  if (!(prise >= PRISE.lachee && prise <= PRISE.tient)) throw new Error(`Repère : prise « ${prise} » hors de 0 à 1.`);
  if (!(decalage >= 0 && decalage <= rayon)) throw new Error(`Repère : décalage « ${decalage} » hors de 0 au rayon du volant.`);
  const [x, y] = pointHeure(cx, cy, rayon - decalage, heure);
  // Pendant le fondu, le disque passe par des teintes mêlées : la lettre garde une des deux teintes pures, claire sur la moitié
  // pleine du fondu, sombre sur la moitié creuse, et s'efface au milieu (opacité |2f - 1|), là où elle change de teinte : elle
  // ne se pose jamais sur un disque de sa propre teinte (à demi visible, elle y garde un contraste de 3:1 au moins).
  return disqueMain({ x, y, cote, plein: remplissage(prise), ...REPERE, attributs: { "data-heure": heure, "data-prise": prise } });
}

// ===== Dessin 1 : tenir le volant (C1.3) =====
// Deux volants côte à côte, vus du siège, les mains en repères pleins (elles tiennent la jante) : à gauche la position de
// référence, 9 h 15 (main gauche à 9 h, main droite à 3 h ; remarque du formateur du 15/10/2026 : « 9 h 15, pas 9 h et 3 h ») ;
// à droite la variante que le cours admet, 10 h 10 (main gauche à 10 h,
// main droite à 2 h). « Midi » est écrit en haut de chaque volant, dans sa couronne, comme le 12 d'un cadran ; la position est
// écrite sous chaque volant ; sous la position de référence, son usage : « Lignes droites et courbes » (remarque du formateur du
// 15/10/2026 : 9 h 15 dans les courbes et lignes droites, tirer-glisser dans les virages, chevauchement dans les tournants et
// les manœuvres). Échelle des gestes : 3,2 unités par centimètre (un volant de 37 cm fait 118 unités, 127 px sur un téléphone).
const MAINS_VOLANT = {
  echelle: 3.2,
  colonnes: [80, 240],   // centres des deux volants : au quart et aux trois quarts du cadre
  positions: [
    { heures: { gauche: 9, droite: 3 }, legende: "9 h 15", usage: "Lignes droites et courbes" },
    { heures: { gauche: 10, droite: 2 }, legende: "ou 10 h 10" },
  ],
  legende: { taille: CHARTE.tailles.etiquette, ecart: 6 },   // la position sous le volant, à `ecart` unités du bord de la jante
  usage: { taille: CHARTE.tailles.petite },                  // l'usage, une ligne plus bas (interligne d'Outfit), plus discret
  // « Midi » : au milieu de la couronne, entre le moyeu et le bord intérieur de la jante, vers le haut.
  midi: { taille: CHARTE.tailles.petite, place: 0.5 },
};

function mainsVolant() {
  const code = "mains-volant";
  const [L, H] = CATALOGUE[code].cadre;
  const m = MAINS_VOLANT, M = METRIQUES_POLICE;
  const rayon = VOLANT.rayon * m.echelle, e = EPAISSEUR_JANTE * rayon, rMoyeu = VOLANT.moyeu * m.echelle;
  // Le volant, sa légende et la ligne d'usage, centrés en hauteur dans le cadre.
  const pasUsage = M.interligne * m.usage.taille;
  const hauteurLegende = M.haut * m.legende.taille + pasUsage + M.bas * m.usage.taille;
  const cy = (H - (2 * rayon + e + m.legende.ecart + hauteurLegende)) / 2 + rayon + e / 2;
  const rMidi = rMoyeu + m.midi.place * (rayon - e / 2 - rMoyeu);
  const yLegende = cy + rayon + e / 2 + m.legende.ecart + M.haut * m.legende.taille;
  const colonne = (cx, { heures, legende, usage }, i) => n("g", { "data-r": `position-${i + 1}` },
    volant({ cx, cy, rayon, schema: true }),
    texte(cx, cy - rMidi + M.milieuCapitales * m.midi.taille, "Midi", { taille: m.midi.taille, ancrage: "middle", couleur: CHARTE.texteDoux,
      role: "midi" }),
    COTES.map((cote) => repereMain({ cx, cy, rayon, heure: heures[cote], cote })),
    texte(cx, yLegende, legende, { taille: m.legende.taille, ancrage: "middle", role: "legende" }),
    usage && texte(cx, yLegende + pasUsage, usage, { taille: m.usage.taille, ancrage: "middle", couleur: CHARTE.texteDoux, role: "mention" }));
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Deux volants vus du siège, midi en haut, les mains en repères G et D posés sur la jante. À gauche, la position de "
      + "référence, 9 h 15 : main gauche à 9 h, main droite à 3 h, dans les lignes droites et les courbes. À droite, la variante admise, 10 h 10 : "
      + "main gauche à 10 h, main droite à 2 h." },
  m.colonnes.map((cx, i) => colonne(cx, m.positions[i], i)));
}

// ===== Pictogrammes normalisés des commandes =====
// Formes du règlement ONU n° 121 (identification des commandes, témoins et indicateurs), tableau 1, « en substance identiques
// à l'ISO 2575:2004 » (note 2 du tableau) : feux de détresse (symbole 6, deux triangles l'un dans l'autre), dégivrage et
// désembuage du pare-brise (17 : le pare-brise et trois flèches ondulées), de la lunette arrière (18 : la lunette et trois
// flèches ondulées), climatisation (33 : le flocon), ventilateur du chauffage et de la climatisation (39 : l'hélice à quatre
// pales, pleines comme le permet la note 1). Proportions en fraction de la taille du pictogramme.
const HEURE_DROITE = 3, ANGLE_ENTRE_PALES = 90;   // l'axe des x du cadre pointe vers 3 h ; quatre pales
const PICTO = {
  detresse: { interieur: 0.42 },
  ondulee: { amplitude: 0.055, tete: { longueur: 0.17, largeur: 0.2 }, ecart: 0.21 },
  pareBrise: { bas: 0.62, bombeHaut: 0.12, bombeBas: 0.08, hauteur: 0.62 },
  lunette: { hauteur: 0.6, rayon: 0.13, talon: 0.16 },
  helice: { centre: 0.55, longueur: 0.44, largeur: 0.25, vrille: 20, moyeu: 0.17 },
  flocon: { bras: 6, premier: 90, branche: 0.62, longueurBranche: 0.3, ouverture: 40 },
};

function pictoDetresse(x, y, t) {
  const triangle = (c) => {
    const h = (c * Math.sqrt(3)) / 2;
    return [[x, y - (2 * h) / 3], [x + c / 2, y + h / 3], [x - c / 2, y + h / 3]];
  };
  const trait = { fill: "none", stroke: COULEURS_VOYANTS.rouge, "stroke-width": CHARTE.traits.moyen };
  return [n("path", { d: trace(triangle(t)), ...trait }), n("path", { d: trace(triangle(t * PICTO.detresse.interieur)), ...trait })];
}

// Flèche ondulée qui monte de yBas à yHaut (une période de sinusoïde), tête pleine.
const ECHANTILLONS_ONDE = 12;
function flecheOndulee(x, yBas, yHaut, t) {
  const o = PICTO.ondulee, finTige = yHaut + o.tete.longueur * t;
  const points = Array.from({ length: ECHANTILLONS_ONDE + 1 }, (_, i) => {
    const u = i / ECHANTILLONS_ONDE;
    return [x + o.amplitude * t * Math.sin(2 * Math.PI * u), yBas + (finTige - yBas) * u];
  });
  const demi = (o.tete.largeur * t) / 2;
  return [
    n("path", { d: trace(points, false), fill: "none", stroke: TEINTES.symbole, "stroke-width": CHARTE.traits.fin, "stroke-linejoin": "round" }),
    n("path", { d: trace([[x, yHaut], [x + demi, finTige], [x - demi, finTige]]), fill: TEINTES.symbole }),
  ];
}
const troisFleches = (x, yBas, yHaut, t) => [-1, 0, 1].map((i) => flecheOndulee(x + i * PICTO.ondulee.ecart * t, yBas, yHaut, t));

function pictoPareBrise(x, y, t) {
  const p = PICTO.pareBrise, h = p.hauteur * t, haut = y - h / 2, bas = y + h / 2;
  const [g, d] = [x - t / 2, x + t / 2], [gb, db] = [x - (p.bas * t) / 2, x + (p.bas * t) / 2];
  const contour = `M${pt([g, haut])} Q${pt([x, haut - 2 * p.bombeHaut * t])} ${pt([d, haut])} L${pt([db, bas])} Q${pt([x, bas - 2 * p.bombeBas * t])} ${pt([gb, bas])} Z`;
  return [n("path", { d: contour, fill: "none", stroke: TEINTES.symbole, "stroke-width": CHARTE.traits.moyen, "stroke-linejoin": "round" }),
    troisFleches(x, bas + p.bombeBas * t * 2, haut + p.bombeHaut * t, t)];
}

function pictoLunette(x, y, t) {
  const p = PICTO.lunette, h = p.hauteur * t, haut = y - h / 2, bas = y + h / 2, r = p.rayon * t;
  const [g, d] = [x - t / 2, x + t / 2], talon = p.talon * t;
  const contour = `M${pt([g + talon, bas])} L${pt([g + r, bas])} A${coord(r)} ${coord(r)} 0 0 1 ${pt([g, bas - r])} L${pt([g, haut + r])}`
    + ` A${coord(r)} ${coord(r)} 0 0 1 ${pt([g + r, haut])} L${pt([d - r, haut])} A${coord(r)} ${coord(r)} 0 0 1 ${pt([d, haut + r])}`
    + ` L${pt([d, bas - r])} A${coord(r)} ${coord(r)} 0 0 1 ${pt([d - r, bas])} L${pt([d - talon, bas])}`;
  return [n("path", { d: contour, fill: "none", stroke: TEINTES.symbole, "stroke-width": CHARTE.traits.moyen, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    troisFleches(x, bas + r, haut + r, t)];
}

function pictoHelice(x, y, t, fond) {
  const p = PICTO.helice, r = t / 2;
  const pales = Array.from({ length: 360 / ANGLE_ENTRE_PALES }, (_, i) => i * ANGLE_ENTRE_PALES).map((a) => {
    const rad = ((a + p.vrille) * Math.PI) / 180;
    const [px, py] = [x + p.centre * r * Math.cos(rad), y + p.centre * r * Math.sin(rad)];
    return n("ellipse", { cx: px, cy: py, rx: p.longueur * r, ry: p.largeur * r, fill: TEINTES.symbole,
      transform: `rotate(${a + p.vrille} ${coord(px)} ${coord(py)})` });
  });
  return [...pales, n("circle", { cx: x, cy: y, r: p.moyeu * r, fill: fond })];
}

function pictoFlocon(x, y, t) {
  const p = PICTO.flocon, r = t / 2;
  const fin = { fill: "none", stroke: TEINTES.symbole, "stroke-linecap": "round" };
  const angles = Array.from({ length: p.bras }, (_, i) => p.premier + (360 * i) / p.bras);   // un bras tous les 60 degrés
  const bras = angles.slice(0, p.bras / 2).map((a) => {
    const [dx, dy] = [r * Math.cos((a * Math.PI) / 180), -r * Math.sin((a * Math.PI) / 180)];
    return `M${pt([x - dx, y - dy])} L${pt([x + dx, y + dy])}`;
  }).join(" ");
  const branches = angles.map((a) => {
    const u = [Math.cos((a * Math.PI) / 180), -Math.sin((a * Math.PI) / 180)];
    const depart = [x + u[0] * p.branche * r, y + u[1] * p.branche * r];
    return [-1, 1].map((s) => {
      const b = ((a + s * p.ouverture) * Math.PI) / 180;
      return `M${pt(depart)} L${pt([depart[0] + Math.cos(b) * p.longueurBranche * r, depart[1] - Math.sin(b) * p.longueurBranche * r])}`;
    }).join(" ");
  }).join(" ");
  return [n("path", { d: bras, ...fin, "stroke-width": CHARTE.traits.moyen }), n("path", { d: branches, ...fin, "stroke-width": CHARTE.traits.fin })];
}

// Boîte d'un élément désigné par une étiquette (data-x, data-y : centre ; data-largeur, data-hauteur).
const boite = (x, y, largeur, hauteur) => ({ "data-x": x, "data-y": y, "data-largeur": largeur, "data-hauteur": hauteur });
function boiteDe(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return boite((x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1);
}

// ===== Dessin 2 : les commandes du poste de conduite (C1.1) =====
// Le poste vu du siège, dans la disposition la plus courante (elle varie selon les modèles) : le volant et ses deux commodos,
// l'avertisseur au centre du volant, le contacteur à droite de la colonne de direction ; au centre de la planche, le bouton
// des feux de détresse, puis les commandes de ventilation, de désembuage et de climatisation ; entre les sièges, le frein de
// stationnement. Plan schématique : le volant, sa colonne, ses commodos et le contacteur sont à l'échelle (2,6 unités par
// centimètre) ; la console centrale est placée à sa place relative courante, ses commandes à la taille qui garde leurs
// pictogrammes lisibles sur un téléphone. Style schématique (décision du formateur du 15/10/2026) : volant à plat ; commodo en
// une seule forme, une tige qui s'épaissit vers son bout ; contacteur en collerette et fente ; levier du frein sans bouton ;
// les pictogrammes normalisés des commandes gardent leur forme exacte.
const POSTE = {
  echelle: 2.6,
  volant: { cx: 96, cy: 116 },
  planche: { x1: 4, y1: 50, x2: 228, y2: 104, rayon: 10 },
  console: { x1: 188, x2: 228, rayon: 8 },
  // Colonne de direction (son carénage, derrière le volant), en centimètres depuis le centre du volant.
  colonne: { largeur: 13, haut: -4, bas: 11.5, rayon: 3 },
  // Commodo gauche (le droit en miroir), en centimètres depuis le centre du volant : du carénage au bout, à 29,2 cm du
  // centre et 2,2 cm au-dessus, soit 9,1 cm au-delà du bord de la jante ; une tige de 2 cm qui s'épaissit jusqu'à 2,8 cm à son
  // bout (la commande tournante, que désigne l'étiquette sur ses derniers 5 cm).
  commodo: { base: [-7, 0], bout: [-29.2, -2.2], tige: 2.0, epaisseurBout: 2.8, longueurBout: 5.0 },
  // Contacteur à droite de la colonne, vu par l'ouverture du volant entre 3 h et 6 h : centre, collerette, place du point de son
  // étiquette (entre la fente et le bord, à cette distance du centre), fente.
  contacteur: { centre: [6.6, 7.6], rayon: 2.5, cible: 2.05, fente: 2.3, largeurFente: 0.55, angleFente: -30 },
  boutons: { x: 208, largeur: 30, hauteur: 19, rayon: 4, picto: 16, cible: 2.5 },
  detresse: { y: 62, picto: 13 },
  ventilation: { y: 93, rayon: 11.5, picto: 16 },
  desembuage: { avant: 123, arriere: 147 },
  climatisation: { y: 171, picto: 13 },
  // Frein de stationnement (levier, vu d'au-dessus), entre les sièges.
  // Levier entre les sièges, vu d'au-dessus : son bout avant (vers la planche, en haut) porte la poignée et le bouton de
  // déverrouillage ; son pivot, sous le soufflet, est à l'arrière (vers le siège, en bas).
  frein: { x: 208, avant: 192, arriere: 233, largeur: 6, poignee: 22, largeurPoignee: 8, cible: 2,
    soufflet: { largeur: 14, hauteur: 9 } },
  etiquettes: { taille: 11, colonneDroite: 230, commodoGauche: [40, 44], commodoDroit: [140, 44], avertisseur: [40, 192],
    contacteur: [128, 192], mention: [8, 232], ciblePosteVolant: 0.55 },
};

function posteCommandes() {
  const code = "poste-commandes";
  const [L, H] = CATALOGUE[code].cadre;
  const p = POSTE, k = p.echelle;
  const { cx, cy } = p.volant;
  const rayon = VOLANT.rayon * k;
  const cm = ([x, y]) => [cx + x * k, cy + y * k];   // centimètres depuis le centre du volant vers le cadre
  const miroir = ([x, y]) => [-x, y];
  const b = p.boutons, t = p.etiquettes.taille;

  // Planche, console centrale (jusqu'en bas du cadre) et carénage de la colonne.
  const planche = n("g", { "data-r": "planche" },
    n("rect", { x: p.planche.x1, y: p.planche.y1, width: p.planche.x2 - p.planche.x1, height: p.planche.y2 - p.planche.y1, rx: p.planche.rayon, fill: TEINTES.planche }),
    n("rect", { x: p.console.x1, y: p.planche.y1, width: p.console.x2 - p.console.x1, height: H - p.planche.y1 + p.console.rayon, rx: p.console.rayon, fill: TEINTES.console }));
  const col = p.colonne;
  const colonne = n("rect", { x: cx - (col.largeur * k) / 2, y: cy + col.haut * k, width: col.largeur * k, height: (col.bas - col.haut) * k, rx: col.rayon * k,
    fill: TEINTES.colonne, "data-r": "colonne" });

  // Commodos : une gélule, de la tige au bout épaissi ; la boîte de l'élément est celle de son bout (ses derniers centimètres),
  // ce que l'étiquette désigne.
  const commodo = (cote) => {
    const c = p.commodo, sym = cote === "gauche" ? (q) => q : miroir;
    const [base, bout] = [cm(sym(c.base)), cm(sym(c.bout))];
    const axe = unitaire(moins(bout, base)), rBout = (c.epaisseurBout * k) / 2;
    const debutBout = moins(bout, fois(axe, c.longueurBout * k));
    return n("g", { "data-r": `commodo-${cote}`, ...boiteDe(troncon(debutBout, bout, 2 * rBout, 2 * rBout)) },
      n("path", { d: gelule(base, (c.tige * k) / 2, moins(bout, fois(axe, rBout)), rBout), fill: TEINTES.commande, "data-r": "levier" }));
  };

  // Contacteur : collerette métallique, fente de la clé, sombre.
  const ct = p.contacteur, [kx, ky] = cm(ct.centre);
  const fente = troncon(...[-1, 1].map((s) => [kx + s * Math.cos((ct.angleFente * Math.PI) / 180) * (ct.fente * k) / 2,
    ky + s * Math.sin((ct.angleFente * Math.PI) / 180) * (ct.fente * k) / 2]), ct.largeurFente * k, ct.largeurFente * k);
  const contacteur = n("g", { "data-r": "contacteur", ...boite(kx, ky, 2 * ct.rayon * k, 2 * ct.rayon * k) },
    n("circle", { cx: kx, cy: ky, r: ct.rayon * k, fill: TEINTES.metal }),
    n("path", { d: trace(fente), fill: TEINTES.commande, "data-r": "fente", "data-epaisseur": ct.largeurFente * k,
      "data-x1": (fente[0][0] + fente[3][0]) / 2, "data-y1": (fente[0][1] + fente[3][1]) / 2,
      "data-x2": (fente[1][0] + fente[2][0]) / 2, "data-y2": (fente[1][1] + fente[2][1]) / 2 }));

  // Commandes de la console centrale : un bouton, son pictogramme.
  const bouton = (y, role, ...picto) => n("g", { "data-r": role, ...boite(b.x, y, b.largeur, b.hauteur) },
    n("rect", { x: b.x - b.largeur / 2, y: y - b.hauteur / 2, width: b.largeur, height: b.hauteur, rx: b.rayon, fill: TEINTES.commande }),
    ...picto);
  const v = p.ventilation;
  const ventilation = n("g", { "data-r": "ventilation", ...boite(b.x, v.y, 2 * v.rayon, 2 * v.rayon) },
    n("circle", { cx: b.x, cy: v.y, r: v.rayon, fill: TEINTES.commande }),
    pictoHelice(b.x, v.y, v.picto, TEINTES.commande));
  const desembuage = n("g", { "data-r": "desembuage" },
    bouton(p.desembuage.avant, "desembuage-avant", pictoPareBrise(b.x, p.desembuage.avant, b.picto)),
    bouton(p.desembuage.arriere, "desembuage-arriere", pictoLunette(b.x, p.desembuage.arriere, b.picto)));

  // Frein de stationnement : soufflet du pivot à l'arrière, levier, poignée à l'avant (le bouton de déverrouillage, un détail, ne
  // se dessine pas).
  const f = p.frein;
  const frein = n("g", { "data-r": "frein-stationnement", ...boite(f.x, (f.avant + f.arriere) / 2, f.largeurPoignee, f.arriere - f.avant) },
    n("rect", { x: f.x - f.soufflet.largeur / 2, y: f.arriere - f.soufflet.hauteur / 2, width: f.soufflet.largeur, height: f.soufflet.hauteur,
      rx: f.soufflet.hauteur / 2, fill: TEINTES.commandeOmbre, "data-r": "soufflet" }),
    n("rect", { x: f.x - f.largeur / 2, y: f.avant, width: f.largeur, height: f.arriere - f.avant, rx: f.largeur / 2, fill: TEINTES.commande }),
    n("rect", { x: f.x - f.largeurPoignee / 2, y: f.avant, width: f.largeurPoignee, height: f.poignee, rx: f.largeurPoignee / 2, fill: TEINTES.commandeReflet,
      "data-r": "poignee" }));

  // Étiquettes : les mots du cours ; à droite de la console, en colonne ; les autres au-dessus ou au-dessous de leur commande.
  const e = p.etiquettes, droite = e.colonneDroite;
  const bordBouton = b.x + b.largeur / 2 - b.cible;   // le point de l'étiquette, à droite du pictogramme
  const lab = (role, cible, ancre, lignes, ancrage = "start") => etiquette({ cible, ancre, lignes, ancrage, taille: t, role: `etiquette-${role}` });
  // Le point de l'étiquette de la ventilation se pose entre deux pales, du côté de l'étiquette (3 h) : à la moitié de l'angle
  // entre deux pales avant la première, en heures du cadran.
  const heureEntrePales = HEURE_DROITE + (PICTO.helice.vrille - ANGLE_ENTRE_PALES / 2) / DEGRES_PAR_HEURE;
  const centreBague = (role) => [Number(commodos[role].attributs["data-x"]), Number(commodos[role].attributs["data-y"])];
  const commodos = { "commodo-gauche": commodo("gauche"), "commodo-droit": commodo("droit") };
  const rMoyeu = VOLANT.moyeu * k;
  const cibleAvertisseur = [cx - e.ciblePosteVolant * rMoyeu, cy + e.ciblePosteVolant * rMoyeu];
  const etiquettes = [
    lab("commodo-gauche", centreBague("commodo-gauche"), e.commodoGauche, ["Feux et", "clignotants"], "middle"),
    lab("commodo-droit", centreBague("commodo-droit"), e.commodoDroit, ["Essuie-glaces", "et lave-glace"], "middle"),
    lab("avertisseur", cibleAvertisseur, e.avertisseur, ["Avertisseur"], "middle"),
    lab("contacteur", plus([kx, ky], fois(unitaire(moins(e.contacteur, [kx, ky])), ct.cible * k)), e.contacteur, ["Contacteur"], "middle"),
    lab("feux-detresse", [bordBouton, p.detresse.y], [droite, p.detresse.y], ["Feux de", "détresse"]),
    lab("ventilation", pointHeure(b.x, v.y, v.rayon - b.cible, heureEntrePales), [droite, v.y], ["Ventilation"]),
    n("g", { "data-r": "etiquette-desembuage" },
      etiquette({ cible: [bordBouton, p.desembuage.avant], ancre: [droite, (p.desembuage.avant + p.desembuage.arriere) / 2], lignes: ["Désembuage"], taille: t }),
      etiquette({ cible: [bordBouton, p.desembuage.arriere], ancre: [droite, (p.desembuage.avant + p.desembuage.arriere) / 2], lignes: [], taille: t })),
    lab("climatisation", [bordBouton, p.climatisation.y], [droite, p.climatisation.y], ["Climatisation"]),
    lab("frein-stationnement", [f.x + f.largeurPoignee / 2 - f.cible, f.avant + f.poignee / 2], [droite, f.avant + f.poignee / 2], ["Frein de", "stationnement"]),
  ];

  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Vu du siège, disposition la plus courante : le commodo gauche commande les feux et les clignotants, le droit les essuie-glaces et le lave-glace ; l'avertisseur est au centre du volant, le contacteur à droite de la colonne ; au centre de la planche, les feux de détresse, la ventilation, le désembuage et la climatisation ; entre les sièges, le frein de stationnement." },
  planche, colonne, commodos["commodo-gauche"], commodos["commodo-droit"], contacteur,
  volant({ cx, cy, rayon, avertisseur: true, schema: true }),
  bouton(p.detresse.y, "feux-detresse", pictoDetresse(b.x, p.detresse.y, p.detresse.picto)),
  ventilation, desembuage,
  bouton(p.climatisation.y, "climatisation", pictoFlocon(b.x, p.climatisation.y, p.climatisation.picto)),
  frein,
  etiquettes,
  texte(e.mention[0], e.mention[1], "Disposition la plus courante", { taille: t, couleur: CHARTE.texteDoux, role: "mention" }));
}

// ===== Dessin 3 : les pédales et les pieds (C1.2) =====
// Le pédalier vu du siège : de gauche à droite l'embrayage, le frein, l'accélérateur, suspendus (leurs bras montent sous la
// planche, hors du cadre). Pied gauche sur l'embrayage, pied droit sur le frein, son talon posé entre le frein et
// l'accélérateur, d'où il pivote vers l'accélérateur (flèche). Échelle : 3,2 unités par centimètre. Mesures en centimètres
// depuis le centre de l'embrayage (x vers la droite) et le haut du cadre (y vers le bas, vers le siège). Style schématique
// (décision du formateur du 15/10/2026) : pédales en aplats, sans rainures ; pieds en pictogrammes, de la teinte des personnes
// du kit (SILHOUETTE), une gélule plus large au bout qu'au talon, bordée d'un liseré clair, sans lacets ni reflet.
const PEDALES = {
  echelle: 3.2, origine: [112, 8],
  // Centre des patins, largeur et hauteur ; l'accélérateur, plus étroit et plus long, descend un peu plus bas.
  embrayage: { x: 0, y: 19.5, largeur: 7, hauteur: 6.5 },
  frein: { x: 16, y: 19.5, largeur: 8, hauteur: 6.5 },
  accelerateur: { x: 30, y: 21, largeur: 5, hauteur: 11 },
  bras: 1.6, rayonPatin: 1.1,
  // Pieds : le bout à mi-hauteur du patin (le haut du patin reste visible), le talon au sol ; longueur vue du siège
  // (inclinée du talon au patin, une chaussure paraît plus courte qu'à plat), largeur au bout (10 cm) et au talon (8 cm) ;
  // appui : là où la semelle presse le patin, 1,5 cm derrière le bout.
  // Inclinaison de chaque pied (degrés, du bout vers le talon, comptée vers la droite) : le talon gauche un peu à
  // l'extérieur, le talon droit posé entre le frein et l'accélérateur (à 21,5 cm de l'embrayage), d'où le pied pivote.
  chaussure: { longueur: 25, largeur: 10, talon: 8, appui: 1.5 },
  inclinaison: { gauche: -2.3, droit: 12.7 },
  // Flèche du pied droit : un arc centré sur le talon droit, du frein vers l'accélérateur ; elle part à côté du bras du
  // frein et finit à côté de celui de l'accélérateur, au-dessus de son patin, son axe à 1,4 cm de chacun (son liseré, de
  // 0,8 cm de demi-largeur, ne les touche pas).
  pivot: { jeu: 1.4 },
  // Étiquettes : taille, écart (cm) entre l'objet et le bout du filet, ancre de « Frein » (cm), point du pied désigné (en
  // largeurs, côté extérieur, et en longueurs, depuis le bout), ligne de base de la règle du cours au-dessus du bas du cadre
  // (unités).
  etiquettes: { taille: 11, ecart: 2.4, frein: [8.5, 9.0], cibleChaussure: [0.3, 0.55], regleBas: 16 },
};
// Pédalier : le bras (métal) et le patin (sombre), deux tons.
const PEDALIER = { patin: "#2B322E", bras: "#6E7A70" };

function pedales() {
  const code = "pedales";
  const [L, H] = CATALOGUE[code].cadre;
  const p = PEDALES, k = p.echelle;
  const cm = ([x, y]) => [p.origine[0] + x * k, p.origine[1] + y * k];
  const t = p.etiquettes.taille;
  // Talon d'une chaussure : à sa longueur de son bout, posé à mi-hauteur du patin, selon son inclinaison.
  const talonDe = (cote) => {
    const q = p[cote === "gauche" ? "embrayage" : "frein"], a = (p.inclinaison[cote] * Math.PI) / 180;
    return [q.x + p.chaussure.longueur * Math.sin(a), q.y + p.chaussure.longueur * Math.cos(a)];
  };

  // Une pédale : bras qui monte sous la planche, patin ; la boîte de l'élément est celle du patin.
  const pedale = (role) => {
    const q = p[role], [x, y] = cm([q.x, q.y]), [l, h] = [q.largeur * k, q.hauteur * k];
    return n("g", { "data-r": role, ...boite(x, y, l, h) },
      n("rect", { x: x - (p.bras * k) / 2, y: 0, width: p.bras * k, height: y, fill: PEDALIER.bras, "data-r": "bras" }),
      n("rect", { x: x - l / 2, y: y - h / 2, width: l, height: h, rx: p.rayonPatin * k, fill: PEDALIER.patin, "data-r": "patin" }));
  };

  // Un pied en pictogramme : une gélule, de son bout posé sur le patin (le disque du bout le touche) à son talon au sol, plus
  // large au bout qu'au talon, bordée d'un liseré clair (pièce du kit). Point de référence (data-x, data-y) : l'appui de la
  // semelle sur le patin ; `cible` : un point du pied, côté extérieur, que désigne son étiquette ; `bords` : ses abscisses
  // extrêmes (unités du cadre).
  const pied = (cote, pedaleSous) => {
    const c = p.chaussure, q = p[pedaleSous], sens = cote === "gauche" ? 1 : -1;   // côté extérieur : à gauche pour le pied gauche
    const bout = [q.x, q.y], talon = talonDe(cote);
    const axe = unitaire(moins(talon, bout)), nrm = normale(axe);
    const longueurAxe = longueur(moins(talon, bout));
    // Repère du pied (fx en largeurs, côté extérieur positif ; fy en longueurs, du bout au talon) vers le cadre.
    const versCadre = ([fx, fy]) => cm(plus(plus(bout, fois(axe, fy * longueurAxe)), fois(nrm, sens * fx * c.largeur)));
    const [rBout, rTalon] = [c.largeur / 2, c.talon / 2];
    const [centreBout, centreTalon] = [cm(plus(bout, fois(axe, rBout))), cm(moins(talon, fois(axe, rTalon)))];
    const appui = cm(plus(bout, fois(axe, c.appui)));
    const xs = [centreBout[0] - rBout * k, centreBout[0] + rBout * k, centreTalon[0] - rTalon * k, centreTalon[0] + rTalon * k];
    return {
      cible: versCadre(p.etiquettes.cibleChaussure), bords: [Math.min(...xs), Math.max(...xs)],
      noeud: n("g", { "data-r": `pied-${cote}`, "data-x": appui[0], "data-y": appui[1] },
        formePictogramme(gelule(centreBout, rBout * k, centreTalon, rTalon * k), { plan: "devant", roles: [`semelle-${cote}`] })),
    };
  };
  const gauche = pied("gauche", "embrayage"), droit = pied("droit", "frein");

  // Flèche du pied droit : arc centré sur le talon droit, du frein à l'accélérateur.
  const [tx, ty] = cm(talonDe("droit"));
  const ecartBras = (p.bras / 2 + p.pivot.jeu) * k;
  const fin = [cm([p.accelerateur.x, 0])[0] - ecartBras, cm([0, p.accelerateur.y - p.accelerateur.hauteur / 2 - p.pivot.jeu])[1]];
  const rayon = Math.hypot(fin[0] - tx, fin[1] - ty);
  const angleDe = (x) => (Math.asin((x - tx) / rayon) * 180) / Math.PI - 90;   // angle du kit (degrés, sens horaire depuis 3 h)
  const trajet = arc([tx, ty], rayon, angleDe(cm([p.frein.x, 0])[0] + ecartBras), angleDe(fin[0]));
  const [depart, arrivee] = [trajet[0], trajet[trajet.length - 1]];
  const pivot = n("g", { "data-r": "pivot", "data-x1": depart[0], "data-y1": depart[1], "data-x2": arrivee[0], "data-y2": arrivee[1] },
    fleche(trajet));

  // Étiquettes : chaque pédale, chaque pied, puis la règle du cours.
  const e = p.etiquettes, ecart = e.ecart * k;
  const coinPatin = (role, cote) => {   // un point du patin, dans son quart haut, du côté demandé (-1 gauche, 1 droite)
    const q = p[role], [x, y] = cm([q.x, q.y]);
    return [x + (cote * q.largeur * k) / 4, y - (q.hauteur * k) / 4];
  };
  const bordPatin = (role, cote) => p[role].x * k + p.origine[0] + (cote * p[role].largeur * k) / 2;
  const lab = (role, cible, ancre, lignes, ancrage) => etiquette({ cible, ancre, lignes, ancrage, taille: t, role: `etiquette-${role}` });
  const [cibleEmb, cibleFrein, cibleAcc] = [coinPatin("embrayage", -1), coinPatin("frein", -1), coinPatin("accelerateur", 1)];
  const bordChaussure = (pied, cote) => (cote < 0 ? pied.bords[0] : pied.bords[1]);   // abscisse du bord extérieur du pied
  return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre,
    description: "Vu du siège, de gauche à droite : embrayage, frein, accélérateur. Pied gauche sur l'embrayage, pied droit sur le frein, prêt à pivoter vers l'accélérateur. Jamais deux pieds sur la même pédale." },
  pedale("embrayage"), pedale("frein"), pedale("accelerateur"),
  gauche.noeud, droit.noeud,
  pivot,
  lab("embrayage", cibleEmb, [bordPatin("embrayage", -1) - ecart, cibleEmb[1]], ["Embrayage"], "end"),
  lab("frein", cibleFrein, cm(e.frein), ["Frein"], "middle"),
  lab("accelerateur", cibleAcc, [bordPatin("accelerateur", 1) + ecart, cibleAcc[1]], ["Accélérateur"], "start"),
  lab("pied-gauche", gauche.cible, [bordChaussure(gauche, -1) - ecart, gauche.cible[1]], ["Pied gauche"], "end"),
  lab("pied-droit", droit.cible, [bordChaussure(droit, 1) + ecart, droit.cible[1]], ["Pied droit"], "start"),
  texte(L / 2, H - e.regleBas, "Jamais deux pieds sur la même pédale", { taille: t, ancrage: "middle", role: "regle" }));
}

// ===== Gestes du volant (C1.3) : tirer-glisser, chevauchement, retour du volant =====
// Le volant vu du siège, comme dans « mains-volant », les mains en repères G et D (repereMain : plein, la main tient la jante ;
// creux, elle l'a relâchée, la laisse glisser ou se déplace en l'air) ; à côté, la voiture vue du dessus, en silhouette, braque
// ses roues avant dans le même sens que le volant, et un compteur dit l'angle du volant ; en haut à droite, un libellé dit la
// situation (dans les virages, tournants et manœuvres, en roulant, basse allure). Les trois gestes tournent à droite (le cours : « Symétrique
// pour la gauche »).
//
// État d'une image : { volant, mains: { gauche, droite }, allure? }. `volant` : degrés, sens horaire positif vu du conducteur.
// Une main : { heure, prise, decalage } : `heure`, sa place dans l'espace (12 en haut ; nombre continu, 15 est 3 h un tour
// plus loin) ; `prise` (PRISE), 1 quand elle tient la jante (elle tourne alors avec le volant : heure - volant / 30 reste
// constant), moins de 1 quand la jante glisse dans ses doigts (elle reste en place quand le volant tourne, ou se déplace volant
// immobile), 0 quand elle l'a lâchée ; `decalage`, en centimètres vers le centre du volant, la main en l'air (0 sur la jante).
// `allure` (retour du volant) : « roulant » ou « basse ». Le libellé de situation se lit dans l'état : il nomme la situation
// d'une étape et change à l'instant où l'étape commence, comme la légende des étapes du lecteur, sans fondu.
const GESTE = {
  echelle: 3.2,             // unités par centimètre : un volant de 37 cm fait 118 unités, 127 px sur un téléphone
  centre: [114, 102],
  voiture: { x: 268, y: 106, echelle: 24, cap: -90 },   // vue du dessus, l'avant vers le haut (unités par mètre)
  rapport: 15,              // rapport de direction : degrés au volant pour un degré aux roues avant
  compteur: { x: 268, libelle: 180, valeur: 198, tailleLibelle: 11, tailleValeur: 14 },
  // Pastille du libellé de situation, calée sur le bord droit du cadre (à 8 unités) : sa largeur, par geste, loge son plus long
  // libellé, Outfit 600 à 11 unités, avec 7 unités au moins de chaque côté (« Tournants et manœuvres » : 137 unités au plus).
  indication: { droite: 312, haut: 8, hauteur: 22, taille: 11, largeurs: { "tirer-glisser": 106, chevauchement: 154, "retour-volant": 92 } },
  // Flèches d'une main qui se déplace le long de la jante (qu'elle y glisse ou qu'elle tourne avec le volant), et du volant qui
  // revient droit : arcs à 24,5 cm du centre, juste au-delà des repères (le bord de leur liseré est à 22,2 cm) ; écart (heures)
  // qui sépare deux flèches qui se suivent, à leur jonction.
  // Arc d'une traction dessinée avec la montée de la même main, dans la même étape (retour du volant, cas 2) : 3,5 cm plus loin.
  fleche: { rayon: 24.5, jeu: 0.25, rayonTraction: 28 },
  // Flèche d'une main qui remonte en l'air (chevauchement) : elle part du bord du repère, à 3 h, et s'arrête avant celui qui
  // est à midi, à `jeu` unités de leur liseré.
  traversee: { echantillons: 24, jeu: 2 },
};
const MILIEU_CAPITALES = METRIQUES_POLICE.milieuCapitales;   // ligne de base sous le milieu des capitales d'Outfit
// Position de référence du cours, 9 h 15 : main gauche à 9 h, main droite à 3 h ; midi en haut.
const POSITION = { gauche: 9, droite: 3, midi: 0 };
const posee = (heure, prise, decalage = 0) => ({ heure, prise, decalage });

/** Volant des gestes du volant, en unités du cadre : centre (cx, cy), rayon de la ligne médiane de la jante, et échelle (unités
 *  par centimètre, celle du décalage d'une main en l'air). */
export function repereGeste() {
  const g = GESTE, [cx, cy] = g.centre;
  return { cx, cy, rayon: VOLANT.rayon * g.echelle, echelle: g.echelle };
}

// Arc de cercle autour du volant, de l'heure `debut` à l'heure `fin` (sens horaire si fin > debut), à `rayonCm` du centre.
const arcAutour = (debut, fin, rayonCm) => arc(GESTE.centre, rayonCm * GESTE.echelle, (debut - HEURE_DROITE) * DEGRES_PAR_HEURE,
  (fin - HEURE_DROITE) * DEGRES_PAR_HEURE);
// Flèche d'une main qui tourne avec le volant (ou qui glisse sur la jante) de `debut` à `fin`, en arc hors des repères ; `jeu`
// retranché aux bouts quand deux flèches se suivent.
const flecheArc = (debut, fin, { avant = 0, apres = 0 } = {}) => {
  const sens = Math.sign(fin - debut);
  return arcAutour(debut + sens * avant, fin - sens * apres, GESTE.fleche.rayon);
};

/** Dessin d'une image d'un geste du volant : `code` (titre et cadre du catalogue), `description` (lecteurs d'écran),
 *  `fleches(etape)` : les trajets (listes de points) que montrent les flèches de l'étape, deux au plus, null pour aucune ;
 *  `libelle(etat)` : le libellé de situation. De dessous à dessus : le volant, les flèches de l'image figée (sous les repères :
 *  la flèche de la jante qui glisse passe sous la main qui la laisse glisser), le repère G, puis le repère D, toujours : dans le
 *  chevauchement, la droite (la main du côté du virage) passe par-dessus la gauche, et la gauche remonte sous la droite. */
const FLECHES_PAR_ETAPE = 2;
function dessinGeste({ code, description, fleches, libelle }) {
  const [L, H] = CATALOGUE[code].cadre;
  const { cx, cy, rayon, echelle } = repereGeste(), g = GESTE;
  const repli = [[cx, cy], [cx + 1, cy]];   // trajet d'une flèche masquée : elle garde sa forme (le kit l'exige)
  const repere = (cote, { heure, prise, decalage }) => repereMain({ cx, cy, rayon, heure, cote, prise, decalage: decalage * echelle });
  const largeurIndication = g.indication.largeurs[code];
  return (etat, { fige, etape }) => {
    const c = g.compteur, ind = g.indication, v = g.voiture;
    const trajets = fleches(etape);
    return cadre({ largeur: L, hauteur: H, titre: CATALOGUE[code].titre, description },
      volant({ cx, cy, rayon, angle: etat.volant, schema: true }),
      n("g", { "data-r": "fleche", display: fige ? "inline" : "none" },
        Array.from({ length: FLECHES_PAR_ETAPE }, (_, i) =>
          fleche(trajets[i] || repli, { role: `fleche-${i + 1}`, visible: Boolean(trajets[i]) }))),
      repere("gauche", etat.mains.gauche), repere("droite", etat.mains.droite),
      voitureDessus({ x: v.x, y: v.y, cap: v.cap, echelle: v.echelle, roues: true, braquage: etat.volant / g.rapport, schema: true }),
      texte(c.x, c.libelle, "Volant", { taille: c.tailleLibelle, ancrage: "middle", couleur: CHARTE.texteDoux }),
      texte(c.x, c.valeur, `${Math.round(etat.volant)}°`, { taille: c.tailleValeur, ancrage: "middle", graisse: 600, role: "compteur" }),
      n("g", { "data-r": "indication" },
        n("rect", { x: ind.droite - largeurIndication, y: ind.haut, width: largeurIndication, height: ind.hauteur, rx: ind.hauteur / 2,
          fill: CHARTE.accentDoux, stroke: CHARTE.accent, "stroke-width": CHARTE.traits.fin, "data-r": "indication-pastille" }),
        texte(ind.droite - largeurIndication / 2, ind.haut + ind.hauteur / 2 + MILIEU_CAPITALES * ind.taille, libelle(etat),
          { taille: ind.taille, ancrage: "middle", graisse: 600, role: "indication-texte" })));
  };
}

// Durées (secondes ; choix de dessin, raisons dans les sources) : doigts qui s'entrouvrent ou se referment en 0,3 s, main qui
// lâche ou reprend la jante tout à fait en 0,35 s, main qui glisse d'un quart de tour sur la jante en 1 s, main qui remonte en
// l'air de 3 h à midi en 1,1 s, volant tourné de 30 degrés en 0,65 s, d'un quart de tour en 1 s, d'un demi-tour en 1,5 s ;
// chaque étape commence par une pause de 0,3 s (0,4 s à la première étape du retour du volant), le temps de lire l'étape, et
// finit sur une pause courte, de 0,3 à 0,7 s.
// Une main qui tient la jante tourne avec le volant : sa place se calcule à partir de l'angle du volant, jamais à part.

// 1. Tirer-glisser, virage à droite.
// Traction d'un quart de tour au plus, de midi à 3 h (remarque du formateur du 15/10/2026 : « pas plus de 90 degrés, de petits
// gestes pour être précis ») ; un virage qui demande plus de braquage répète le geste.
const TIRER_GLISSER = {
  debuts: [0, 2.2], duree: 4.2,
  lacher: [0.3, 0.6], montee: [0.6, 1.6], reprise: [1.6, 1.9],   // étape 1 : la droite monte à midi en glissant sur la jante
  tirage: [2.5, 3.5], angle: 90,                                 // étape 2 : elle tire le volant vers le bas, jusqu'à 3 h
};
function etatTirerGlisser(t) {
  const T = TIRER_GLISSER, G = PRISE.glisse;
  const volant = cles([{ t: T.tirage[0], v: 0 }, { t: T.tirage[1], v: T.angle }], t);
  const droite = t < T.reprise[1]
    ? posee(cles([{ t: T.montee[0], v: POSITION.droite }, { t: T.montee[1], v: POSITION.midi }], t),
      cles([{ t: T.lacher[0], v: 1 }, { t: T.lacher[1], v: G }, { t: T.reprise[0], v: G }, { t: T.reprise[1], v: 1 }], t))
    : posee(POSITION.midi + volant / DEGRES_PAR_HEURE, 1);
  // La gauche tient la jante pendant que la droite monte, puis entrouvre les doigts : la jante y glisse, elle reste à 9 h.
  const gauche = posee(POSITION.gauche, cles([{ t: T.reprise[0], v: 1 }, { t: T.reprise[1], v: G }], t));
  return { volant, mains: { gauche, droite } };
}
// Flèches : étape 1, la droite qui monte ; étape 2, sa traction. La jante qui glisse dans la main gauche ne porte pas de flèche :
// son repère creux le dit (remarque du formateur du 15/10/2026 : une flèche sur la main gauche peut porter à confusion).
const FLECHES_TIRER_GLISSER = [
  [flecheArc(POSITION.droite, POSITION.midi), null],
  [flecheArc(POSITION.midi, TIRER_GLISSER.angle / DEGRES_PAR_HEURE), null],
];

// 2. Chevauchement, tournant à droite (tournants et manœuvres ; le cours : la main du côté où l'on tourne monte vers midi et tire ; l'autre
// suit sans lâcher prise jusqu'à midi, puis tire à son tour pendant que la première remonte ; l'alternance continue). Chaque
// traction fait un quart de tour, de midi à 3 h : la gauche, qui suit de 9 h à midi puis tire jusqu'à 3 h, tient ainsi la
// jante un demi-tour sans la lâcher, ce que permet la rotation de l'avant-bras (raison dans les sources). Celle qui a tiré
// lâche la jante et remonte à midi pendant que l'autre tire : la droite par-dessus la gauche (étape 3), la gauche sous la
// droite (étape 4).
const CHEVAUCHEMENT = {
  debuts: [0, 2.2, 3.8, 5.9], duree: 9.0,
  traction: 90,                                                  // degrés : un quart de tour, de midi à 3 h
  lacher: [0.3, 0.6], montee: [0.6, 1.6], reprise: [1.6, 1.9],   // étape 1 : la droite monte à midi en glissant sur la jante
  tirage1: [2.5, 3.5],                                           // étape 2 : elle tire ; la gauche suit, de 9 h à midi
  lacherDroite: [4.1, 4.45],                                     // étape 3 : la droite lâche la jante à 3 h ;
  tirage2: [4.6, 5.6], traversee: [4.5, 5.6],                    //   la gauche tire, la droite remonte à midi en l'air,
  passage: 13.5,                                                 //   en dedans de la jante, par-dessus la gauche
  repriseDroite: [6.2, 6.55], lacherGauche: [6.55, 6.9],         // étape 4 : la droite reprend la jante, la gauche la lâche ;
  tirage3: [7.0, 8.0], traverseeGauche: [6.95, 8.05],            //   la droite tire, la gauche remonte à midi sous la droite
  repriseGauche: [8.2, 8.55],                                    //   et reprend la jante
};
// Une main en l'air qui remonte de 3 h à midi (la droite à l'étape 3, la gauche à l'étape 4), à l'avancée `u` (0 à 3 h, 1 à
// midi) : le centre de son repère suit une courbe de Bézier quadratique, du point de la jante à 3 h à celui de midi, qui passe à
// mi-chemin à `passage` cm du centre du volant, sur la bissectrice : en dedans de la jante, là où passe la main qui tire. La
// main a lâché la jante (prise 0) ; son décalage est l'écart à la ligne médiane de la jante ; `tours` : tours ajoutés à son heure
// (la gauche, à 3 h un tour plus loin que 9 h, y est à 15 h).
function enTraversee(u, tours = 0) {
  const C = CHEVAUCHEMENT, R = VOLANT.rayon;
  const [a, b] = [POSITION.droite, POSITION.midi].map((h) => fois([Math.sin(h * PAS_HEURE), -Math.cos(h * PAS_HEURE)], R));
  const bissectrice = ((POSITION.droite + POSITION.midi) / 2) * PAS_HEURE;
  const m = fois([Math.sin(bissectrice), -Math.cos(bissectrice)], C.passage);
  const q = moins(fois(m, 2), fois(plus(a, b), 1 / 2));   // point de contrôle : la courbe passe par m à mi-chemin
  const p = plus(plus(fois(a, (1 - u) ** 2), fois(q, 2 * u * (1 - u))), fois(b, u ** 2));
  const heure = Math.atan2(p[0], -p[1]) / PAS_HEURE + tours * HEURES_PAR_TOUR;
  return posee(heure, PRISE.lachee, Math.max(0, R - longueur(p)));
}
function etatChevauchement(t) {
  const C = CHEVAUCHEMENT, G = PRISE.glisse, q = C.traction;
  const volant = cles([{ t: C.tirage1[0], v: 0 }, { t: C.tirage1[1], v: q }, { t: C.tirage2[0], v: q }, { t: C.tirage2[1], v: 2 * q },
    { t: C.tirage3[0], v: 2 * q }, { t: C.tirage3[1], v: 3 * q }], t);
  const avancee = ([debut, fin]) => cles([{ t: debut, v: 0 }, { t: fin, v: 1 }], t);
  const ouvre = ([debut, fin]) => cles([{ t: debut, v: 1 }, { t: fin, v: 0 }], t);
  // La droite : elle glisse jusqu'à midi, tire, lâche la jante à 3 h, remonte en l'air, la reprend à midi et tire.
  let droite;
  if (t < C.reprise[1]) {
    droite = posee(cles([{ t: C.montee[0], v: POSITION.droite }, { t: C.montee[1], v: POSITION.midi }], t),
      cles([{ t: C.lacher[0], v: 1 }, { t: C.lacher[1], v: G }, { t: C.reprise[0], v: G }, { t: C.reprise[1], v: 1 }], t));
  } else if (t < C.traversee[0]) {
    droite = posee(POSITION.midi + volant / DEGRES_PAR_HEURE, ouvre(C.lacherDroite));
  } else if (t < C.repriseDroite[0]) {
    droite = enTraversee(avancee(C.traversee));
  } else {
    droite = posee(POSITION.midi + (volant - 2 * q) / DEGRES_PAR_HEURE, avancee(C.repriseDroite));
  }
  // La gauche : elle tient la jante de 9 h à 3 h (elle suit, puis tire), la lâche, remonte en l'air et la reprend à midi.
  let gauche;
  if (t < C.traverseeGauche[0]) {
    gauche = posee(POSITION.gauche + volant / DEGRES_PAR_HEURE, ouvre(C.lacherGauche));
  } else if (t < C.repriseGauche[0]) {
    gauche = enTraversee(avancee(C.traverseeGauche), 1);
  } else {
    gauche = posee(HEURES_PAR_TOUR + (volant - 3 * q) / DEGRES_PAR_HEURE, avancee(C.repriseGauche));
  }
  return { volant, mains: { gauche, droite } };
}
// Trajet d'une main en l'air qui remonte (centre de son repère), pour sa flèche : la part de la courbe qui va du bord du repère
// à 3 h jusqu'avant celui qui est à midi, au début de l'étape (GESTE.traversee.jeu unités au-delà de leur liseré).
function trajetTraversee() {
  const T = GESTE.traversee, k = GESTE.echelle;
  const points = Array.from({ length: T.echantillons * 8 + 1 }, (_, i) => {
    const { heure, decalage } = enTraversee(i / (T.echantillons * 8));
    return pointHeure(...GESTE.centre, (VOLANT.rayon - decalage) * k, heure);
  });
  const [depart, arrivee] = [points[0], points[points.length - 1]];
  const libre = (REPERE.rayon + CHARTE.liseres + T.jeu);
  const loin = (p) => Math.hypot(p[0] - depart[0], p[1] - depart[1]) >= libre && Math.hypot(p[0] - arrivee[0], p[1] - arrivee[1]) >= libre;
  const vus = points.filter(loin);
  return Array.from({ length: T.echantillons + 1 }, (_, i) => vus[Math.round((i * (vus.length - 1)) / T.echantillons)]);
}
// Flèches : étape 1, la droite qui monte ; étape 2, la droite qui tire, la gauche qui suit jusqu'à midi ; étapes 3 et 4, la
// main à midi qui tire jusqu'à 3 h et l'autre qui remonte de 3 h à midi, en dedans de la jante.
const FLECHES_CHEVAUCHEMENT = (() => {
  const C = CHEVAUCHEMENT, j = GESTE.fleche.jeu, midi = HEURES_PAR_TOUR, quart = C.traction / DEGRES_PAR_HEURE;
  const alternance = [flecheArc(POSITION.midi, quart), trajetTraversee()];
  return [
    [flecheArc(POSITION.droite, POSITION.midi), null],
    [flecheArc(POSITION.midi, quart, { avant: j }), flecheArc(POSITION.gauche, midi, { apres: j })],
    alternance,
    alternance,
  ];
})();

// 3. Retour du volant, en sortie d'un virage à droite. En roulant (étapes 1 et 2), les doigts s'entrouvrent et le volant revient
// droit seul. À basse allure, la méthode du formateur (15/10/2026) : « soit on a toujours les mains à 9 h 15 parce qu'on a tourné
// le volant de moins de 45 degrés, alors on le ramène à deux mains ; soit on a fait un tirer-glisser, et dans ce cas, s'il faut
// ramener les roues de plus de 45 degrés, je refais un tirer-glisser ; je ne pousse jamais le volant ». Chaque cas en deux étapes,
// pour que l'image figée de son retour s'ouvre sur le volant tourné : le volant est tourné dans la première, ramené dans la
// seconde. Cas 1 (étapes 3 et 4) : les mains reprennent la jante à 9 h 15, la tournent de 30 degrés ensemble, puis la ramènent
// ensemble. Cas 2 (étapes 5 et 6) : un tirer-glisser vers la droite tourne le volant d'un quart de tour (la droite monte à midi
// en glissant sur la jante et tire jusqu'à 3 h, la gauche reste à 9 h, la jante glisse dessous) ; un tirer-glisser vers la
// gauche le ramène (la gauche monte à midi et tire jusqu'à 9 h, la droite reste à 3 h, la jante glisse dessous), puis la droite
// reprend la jante : mains à 9 h 15. Aucune main seule ne pousse le volant : celle qui le tourne seule descend toujours.
const RETOUR_VOLANT = {
  debuts: [0, 1.3, 3.6, 5.4, 6.8, 10.2], duree: 13.9,
  angle: 180,                                     // en roulant : volant tourné d'un demi-tour en sortie de virage
  ouverture: [0.4, 0.7],                          // étape 1 : les doigts s'entrouvrent, volant encore tourné
  retour: [1.6, 3.1],                             // étape 2 : il revient droit seul, en glissant dans les doigts
  petit: 30,                                      // cas 1 : moins de 45 degrés, mains restées à 9 h 15
  prise: [3.9, 4.2], tourne: [4.35, 5.0],         // étape 3 : les mains reprennent la jante et la tournent ensemble
  ramene: [5.7, 6.35],                            // étape 4 : elles la ramènent ensemble
  grand: 90,                                      // cas 2 : un tirer-glisser, un quart de tour (plus de 45 degrés)
  lacheDroite: [7.1, 7.4], monteDroite: [7.4, 8.4], // étape 5 : la droite entrouvre les doigts et monte à midi sur la jante,
  repriseDroite: [8.4, 8.7], tireDroite: [8.85, 9.85], //   la reprend (la gauche entrouvre les siens) et tire jusqu'à 3 h ;
  monteGauche: [10.5, 11.5], repriseGauche: [11.5, 11.8], // étape 6 : la gauche monte à midi sur la jante, la reprend (la
  tireGauche: [11.95, 12.95], repriseFin: [13.1, 13.4],   //   droite entrouvre les siens), tire jusqu'à 9 h ; la droite reprend
};
const LIBELLES_ALLURE = { roulant: "En roulant", basse: "Basse allure" };
function etatRetourVolant(t) {
  const R = RETOUR_VOLANT, G = PRISE.glisse, h = DEGRES_PAR_HEURE;
  const volant = cles([{ t: R.retour[0], v: R.angle }, { t: R.retour[1], v: 0 }, { t: R.tourne[0], v: 0 }, { t: R.tourne[1], v: R.petit },
    { t: R.ramene[0], v: R.petit }, { t: R.ramene[1], v: 0 }, { t: R.tireDroite[0], v: 0 }, { t: R.tireDroite[1], v: R.grand },
    { t: R.tireGauche[0], v: R.grand }, { t: R.tireGauche[1], v: 0 }], t);
  const [, , T3, , T5] = R.debuts;
  const allure = t >= T3 ? "basse" : "roulant";
  if (t < T5) {
    // En roulant, les mains restent à 9 h 15 dans l'espace (la jante glisse dedans) ; à basse allure (cas 1), elles reprennent la
    // jante et tournent avec elle : leur place sur la jante ne change pas.
    const prise = cles([{ t: R.ouverture[0], v: 1 }, { t: R.ouverture[1], v: G }, { t: R.prise[0], v: G }, { t: R.prise[1], v: 1 }], t);
    const place = (base) => (t >= T3 ? base + volant / h : base);
    return { volant, mains: { gauche: posee(place(POSITION.gauche), prise), droite: posee(place(POSITION.droite), prise) }, allure };
  }
  // Cas 2 : deux tirer-glisser, l'un vers la droite, l'autre vers la gauche ; volant droit au début de l'étape 5.
  const droite = (() => {
    if (t < R.repriseDroite[0]) {
      return posee(cles([{ t: R.monteDroite[0], v: POSITION.droite }, { t: R.monteDroite[1], v: POSITION.midi }], t),
        cles([{ t: R.lacheDroite[0], v: 1 }, { t: R.lacheDroite[1], v: G }], t));
    }
    // Elle reprend la jante à midi, la tire jusqu'à 3 h (elle tourne avec elle), puis entrouvre les doigts et reste à 3 h pendant
    // que la gauche ramène le volant, et reprend la jante à la fin.
    const tient = t < R.repriseGauche[0];
    return posee(tient ? POSITION.midi + volant / h : POSITION.droite,
      cles([{ t: R.repriseDroite[0], v: G }, { t: R.repriseDroite[1], v: 1 }, { t: R.repriseGauche[0], v: 1 }, { t: R.repriseGauche[1], v: G },
        { t: R.repriseFin[0], v: G }, { t: R.repriseFin[1], v: 1 }], t));
  })();
  const gauche = (() => {
    if (t < R.repriseGauche[0]) {
      // Elle tient à 9 h, entrouvre les doigts quand la droite reprend la jante à midi (la jante glisse dessous pendant la traction),
      // puis monte à midi sur la jante, volant immobile.
      return posee(cles([{ t: R.monteGauche[0], v: POSITION.gauche }, { t: R.monteGauche[1], v: HEURES_PAR_TOUR }], t),
        cles([{ t: R.repriseDroite[0], v: 1 }, { t: R.repriseDroite[1], v: G }], t));
    }
    // Elle reprend la jante à midi et tire jusqu'à 9 h : elle tourne avec elle.
    return posee(HEURES_PAR_TOUR + (volant - R.grand) / h, cles([{ t: R.repriseGauche[0], v: G }, { t: R.repriseGauche[1], v: 1 }], t));
  })();
  return { volant, mains: { gauche, droite }, allure };
}
// Flèche du volant qui revient (étape 2) : arc en haut, raccourci de `bord` heure de chaque côté pour ne pas toucher les repères.
const RETOUR_FLECHES = { bord: 0.5 };
// Flèches : étape 1, aucune : les doigts s'entrouvrent, et les repères creux disent que la jante glisse dans les mains (comme dans
// le tirer-glisser, une flèche sur la jante au bord d'une main peut porter à confusion, remarque du formateur du 15/10/2026) ;
// étape 2, le volant qui revient droit (arc en haut) ; étape 3, chaque main qui tourne le volant de 30 degrés ; étape 4, chaque
// main qui le ramène ; étapes 5 et 6, un tirer-glisser : la main qui monte à midi en glissant sur la jante (arc proche) puis tire
// (arc plus loin, GESTE.fleche.rayonTraction : les deux arcs, de sens contraires sur le même quart de tour, ne se recouvrent pas).
const FLECHES_RETOUR_VOLANT = (() => {
  const R = RETOUR_VOLANT, F = RETOUR_FLECHES, f = GESTE.fleche;
  const [demi, petit] = [R.angle / DEGRES_PAR_HEURE / 2, R.petit / DEGRES_PAR_HEURE];
  const [g, d, midi] = [POSITION.gauche, POSITION.droite, POSITION.midi];
  const traction = (debut, fin) => arcAutour(debut, fin, f.rayonTraction);
  return [
    [null, null],
    [arcAutour(POSITION.midi + demi - F.bord, POSITION.midi - demi + F.bord, f.rayon), null],
    [flecheArc(g, g + petit), flecheArc(d, d + petit)],
    [flecheArc(g + petit, g), flecheArc(d + petit, d)],
    [flecheArc(d, midi), traction(midi, R.grand / DEGRES_PAR_HEURE)],
    [flecheArc(g, HEURES_PAR_TOUR), traction(HEURES_PAR_TOUR, g)],
  ];
})();

// Construction d'un geste du volant : le registre appelle construire() à chaque montage.
function geste(code, { debuts, duree }, etat, fleches, description, libelle) {
  return {
    titre: CATALOGUE[code].titre,
    description,
    cadre: CATALOGUE[code].cadre,
    duree,
    etapes: debuts.map((t) => ({ t })),
    etat,
    dessiner: dessinGeste({ code, description, fleches: (etape) => fleches[etape], libelle }),
  };
}

const DESCRIPTIONS = {
  "tirer-glisser": "Volant vu du siège, virage à droite ; chaque main est un repère, G ou D, posé sur la jante, plein quand elle "
    + "tient la jante, creux quand elle la laisse glisser. La main droite monte de 3 h à midi en glissant sur la jante, volant "
    + "immobile, puis tire le volant vers le bas, d'un quart de tour, jusqu'à 3 h ; la main gauche reste à 9 h et laisse le volant "
    + "glisser entre ses doigts. Les mains "
    + "ne se croisent jamais. À côté, la voiture vue du dessus braque ses roues avant à droite ; un compteur dit l'angle du volant.",
  chevauchement: "Volant vu du siège, tournant à droite ; chaque main est un repère, G ou D, plein quand elle tient la "
    + "jante, creux quand elle l'a lâchée. La main droite monte à midi et tire d'un quart de tour ; la gauche suit sans lâcher prise "
    + "jusqu'à midi, puis tire à son tour d'un quart de tour pendant que la droite lâche la jante et remonte à midi en passant "
    + "par-dessus la gauche. Puis la droite reprend la jante et tire, pendant que la gauche la lâche et remonte à midi en passant "
    + "sous la droite. À côté, la voiture vue du dessus braque ses roues avant à droite ; un compteur dit l'angle du volant.",
  "retour-volant": "Volant vu du siège, en sortie d'un virage à droite ; chaque main est un repère, G ou D, plein quand elle tient "
    + "la jante, creux quand elle la laisse glisser. En roulant, les doigts s'entrouvrent et le volant revient droit seul en glissant "
    + "dans les mains, qui restent à 9 h 15. À basse allure, il ne revient pas seul. Tourné de 30 degrés, moins de 45, par les deux "
    + "mains restées à 9 h 15, elles le ramènent ensemble. Tourné d'un quart de tour, plus de 45 degrés, par un tirer-glisser, un "
    + "tirer-glisser dans l'autre sens le ramène : la main gauche monte à midi en glissant sur la jante et tire vers le bas, la droite "
    + "reste à 3 h et la jante glisse dessous ; aucune main ne pousse le volant. À côté, la voiture vue du dessus et ses roues avant ; "
    + "un compteur dit l'angle du volant.",
};
// Libellé de situation de chaque geste, lu dans l'état.
const LIBELLES = {
  "tirer-glisser": () => "Dans les virages",
  chevauchement: () => "Tournants et manœuvres",
  "retour-volant": (etat) => LIBELLES_ALLURE[etat.allure],
};

// ===== Registre =====
export const DESSINS = {
  "poste-commandes": posteCommandes,
  "mains-volant": mainsVolant,
  pedales,
};
export const GESTES = {
  "tirer-glisser": { construire: () => geste("tirer-glisser", TIRER_GLISSER, etatTirerGlisser, FLECHES_TIRER_GLISSER, DESCRIPTIONS["tirer-glisser"], LIBELLES["tirer-glisser"]) },
  chevauchement: { construire: () => geste("chevauchement", CHEVAUCHEMENT, etatChevauchement, FLECHES_CHEVAUCHEMENT, DESCRIPTIONS.chevauchement, LIBELLES.chevauchement) },
  "retour-volant": { construire: () => geste("retour-volant", RETOUR_VOLANT, etatRetourVolant, FLECHES_RETOUR_VOLANT, DESCRIPTIONS["retour-volant"], LIBELLES["retour-volant"]) },
};
export { versDom } from "./dessin-svg.js?v=20261023d";
