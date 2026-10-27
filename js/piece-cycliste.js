/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Le cycliste vu du dessus, une seule pièce pour la scène de route qui le montre (js/scene-moteur.js, « sortie-portiere ») et
 * pour le dessin des angles morts (js/dessins-visibilite.js) : son gabarit, ses teintes et son dessin. Module léger, sans moteur
 * ni dessin du kit : chacun des deux le charge sans charger l'autre. Les scènes en reprennent le gabarit (GABARITS.velo de
 * js/scene-geometrie.js) et les teintes (TEINTES de js/scene-rendu.js).
 *
 * Choix de dessin (sans portée réglementaire) : 1,8 m de long, deux roues de 0,7 m (la roue « 700 » d'un vélo de ville) aux
 * deux bouts du gabarit, soit 1,1 m d'empattement ; 0,6 m de large, la largeur du guidon ; pneus dessinés de 6 cm (35 mm en
 * vrai, élargis pour rester visibles sur un téléphone), aux bouts arrondis ; cadre dans l'axe ; guidon arrondi ; le cycliste
 * penché vers le guidon : le dos, des hanches (sur la selle) aux épaules, les bras jusqu'aux poignées, la tête ronde en avant des
 * épaules. Aucun trait sous 0,05 m : 1 px au moins à 343 px de large, dans le cadre de 15 m de « sortie-portiere ». Veste orange
 * clair au contour foncé : la veste se lit sur la chaussée (3,32:1), le contour sur la chaussée vue à travers le cône du regard
 * (4,94:1), contrastes vérifiés par tests/scene-rendu.test.mjs.
 *
 * Style schématique (décision du formateur du 15/10/2026 : une personne est une silhouette de pictogramme, en formes simples,
 * sans visage) : trois teintes en tout. Le cycliste, d'une seule teinte, celle de la veste : le dos et la tête, ronde, bordés
 * du contour foncé, et les bras ; le vélo, d'une seule teinte foncée : pneus, cadre et guidon.
 */
import { n, ecrireValeur } from "./dessin-svg.js?v=20261027a";

/** Gabarit du cycliste sur son vélo, vu du dessus (m). */
export const GABARIT_VELO = Object.freeze({ longueur: 1.8, largeur: 0.6 });

/** Teintes du cycliste : le cycliste (dos, bras et tête), son contour, le vélo (pneus, cadre et guidon). */
export const TEINTES_VELO = Object.freeze({ cycliste: "#F5B06A", cyclisteBord: "#1F2422", velo: "#2E2E2B" });

// Mesures du dessin (m), dans le repère du cycliste : x vers l'avant, y vers sa droite.
const VELO = {
  roue: 0.7, pneu: 0.06, cadre: 0.05, guidon: { x: 0.42, epaisseur: 0.05 },
  // Dos, le long du vélo et de part et d'autre de son axe : épaules (0,42 m de large) et hanches (0,30 m, sur la selle).
  dos: { epaules: 0.05, hanches: -0.33, demiEpaules: 0.21, demiHanches: 0.15, cou: 0.07, bassin: 0.09 },
  // Bras : de l'articulation de l'épaule au coude, un peu écarté, puis à la poignée du guidon.
  bras: { epaisseur: 0.075, epaule: [0.03, 0.18], coude: [0.22, 0.235], main: [0.42, 0.26] },
  tete: { x: 0.13, rayon: 0.105 },
  contour: 0.05,
};

// Un nombre d'un tracé ou d'une liste de points, écrit comme une valeur d'attribut (trois décimales au plus).
const e = (v) => ecrireValeur(v);

/** Le cycliste sur son vélo, vu du dessus, en mètres, dans son repère (centre du gabarit à l'origine, x vers l'avant) :
 *  un groupe que l'appelant pose (la scène par le transform de chaque image, un dessin par translate, rotate et scale).
 *  `attributs` : ceux du groupe. */
export function cycliste(attributs = {}) {
  const { longueur: L, largeur: W } = GABARIT_VELO, { roue, pneu, cadre, guidon, dos, bras, tete, contour } = VELO;
  const T = TEINTES_VELO, demiGuidon = W / 2;
  const { epaules: xe, hanches: xh, demiEpaules: we, demiHanches: wh, cou, bassin } = dos;
  // Le dos : les épaules à l'avant, arrondies vers le cou ; les flancs ; les hanches à l'arrière, arrondies sur la selle.
  const d = `M${e(xe)} ${e(-we)} C${e(xe + cou)} ${e(-we)} ${e(xe + cou)} ${e(we)} ${e(xe)} ${e(we)}`
    + ` L${e(xh)} ${e(wh)} C${e(xh - bassin)} ${e(wh)} ${e(xh - bassin)} ${e(-wh)} ${e(xh)} ${e(-wh)} Z`;
  return n("g", attributs,
    // Roues (pneus vus d'en haut), cadre et guidon.
    [-(L - roue) / 2, (L - roue) / 2].map((cx) => n("rect", { x: cx - roue / 2, y: -pneu / 2, width: roue, height: pneu, rx: pneu / 2, fill: T.velo })),
    n("rect", { x: -(L - roue) / 2, y: -cadre / 2, width: guidon.x + (L - roue) / 2, height: cadre, fill: T.velo }),
    n("rect", { x: guidon.x - guidon.epaisseur / 2, y: -demiGuidon, width: guidon.epaisseur, height: 2 * demiGuidon, rx: guidon.epaisseur / 2,
      fill: T.velo }),
    n("path", { d, fill: T.cycliste, stroke: T.cyclisteBord, "stroke-width": contour, "stroke-linejoin": "round" }),
    // Les bras, de l'épaule au coude puis à la poignée du guidon, de la teinte du cycliste.
    [-1, 1].map((s) => n("polyline", { points: [bras.epaule, bras.coude, bras.main].map(([x, y]) => `${e(x)},${e(s * y)}`).join(" "),
      fill: "none", stroke: T.cycliste, "stroke-width": bras.epaisseur, "stroke-linecap": "round", "stroke-linejoin": "round" })),
    n("circle", { cx: tete.x, cy: 0, r: tete.rayon, fill: T.cycliste, stroke: T.cyclisteBord, "stroke-width": contour }));
}
