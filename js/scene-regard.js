/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Regard du conducteur dans les scènes animées. Module pur (ni DOM ni réseau) :
 * le moteur de rendu dessine le cône du regard avec ces fonctions, et les tests
 * des scènes vérifient avec elles le regard montré (tests/scenes.test.mjs).
 *
 * Une étape porte au plus un regard, dans le repère des scènes (cap mesuré depuis
 * +x, croissant dans le sens des aiguilles d'une montre à l'écran) :
 * - { angle } : degrés par rapport au cap, positifs à droite, négatifs à gauche
 *   (0 droit devant, 40 la sortie d'un virage à droite, 120 l'angle mort droit, tête tournée vers
 *   l'épaule, 170 les rétroviseurs ; -120 et -170 pour la gauche) ;
 * - { balayage: true } : va-et-vient de part et d'autre du cap (BALAYAGE) ;
 * - { tour: true } : le regard fait le tour complet, de 0 à -360 degrés, linéairement pendant toute l'étape : devant, la
 *   gauche (rétroviseur extérieur et angle mort), l'arrière (lunette), la droite (angle mort et rétroviseur extérieur),
 *   puis de nouveau devant. Ce sont les contrôles tout autour de la voiture avant une marche arrière (méthode de Timy).
 *   L'étape dure au moins REGARD_DUREE_TOUR_MIN s, et le regard se règle sur ses bornes, son instant `t` et sa fin
 *   `fin`, que pose preparerScene ;
 * - { suivre: id } : vers l'acteur id, depuis l'œil du conducteur, tant qu'il est
 *   visible et à au plus REGARD_MAX_SUIVI degrés du cap (cibleSuivie le rend). Le
 *   conducteur ne suit pas des yeux ce qui passe derrière lui : au-delà, il regarde
 *   de nouveau devant lui, et le regard rend le cap.
 * Sans regard, ou quand la cible est inconnue ou invisible, angleRegard rend null :
 * pas de cône.
 *
 * Le cône dessiné (coneRegard) est un triangle : l'œil, puis deux pointes à REGARD_PORTEE m, à REGARD_OUVERTURE
 * degrés de part et d'autre de la direction du regard. regardContient dit si un point y est. Le moteur dessine ce que
 * rend regardDessine : ce triangle, arrêté DEBORD_SUIVI m au-delà d'un usager suivi des yeux (longueurCone), ou, sur une
 * image figée, le secteur que parcourt un balayage (secteurBalayage), ou quatre cônes pour un tour du regard (conesTour :
 * devant, à gauche, derrière, à droite).
 */
import { DEG } from "./scene-geometrie.js?v=20261005f";

/** Écart maximal, en degrés, entre le cap et la direction d'une cible suivie des yeux : au-delà, elle est passée derrière
 *  le conducteur, qui regarde de nouveau devant lui. */
export const REGARD_MAX_SUIVI = 100;

// Portée (m) et demi-ouverture (degrés) du cône du regard : choix de dessin, sans portée réglementaire, partagés par
// le moteur de rendu (tâche 11, par regardDessine) et par les tests des scènes. Un conducteur voit un piéton à 20 m :
// la portée doit atteindre, depuis l'approche, le piéton qui attend de l'autre côté du carrefour.
export const REGARD_PORTEE = 22;
export const REGARD_OUVERTURE = 16;

// Balayage : 75 degrés de part et d'autre du cap, un aller-retour complet toutes les 2 s (0,5 Hz).
// Choix de dessin du moteur (plan, tâche 11). La phase suit l'instant de la scène.
const BALAYAGE = { amplitude: 75, frequence: 0.5 };

/** Durée minimale (s) d'une étape dont le regard fait le tour : un quart de tour par seconde au plus. Choix de dessin
 *  (plan 2, tâche 3) : chaque quart du tour (vers la gauche, vers l'arrière, vers la droite, de nouveau devant) reste
 *  ainsi au moins 1,0 s à l'écran, la durée minimale d'une étape. tests/scenes.test.mjs le contrôle pour chaque scène. */
export const REGARD_DUREE_TOUR_MIN = 4;

/** Directions (degrés par rapport au cap, négatives à gauche) des quatre cônes qui montrent un tour du regard sur une image
 *  figée : devant, à gauche, derrière, à droite, dans l'ordre du tour. Décision du contrôleur de chantier (plan 2, tâche
 *  3b) : un disque de toute la portée, plus large que le cadre d'une rue, n'y montrait qu'une teinte uniforme. */
export const DIRECTIONS_TOUR_FIGE = [0, -90, 180, 90];

// Place du conducteur (France : à gauche) : 0,2 m en avant du centre de la voiture, 0,4 m à sa gauche.
const OEIL = { avant: 0.2, gauche: 0.4 };

/** Position de l'œil du conducteur, pour l'état { x, y, cap } de sa voiture. */
export function oeil(e) {
  const c = Math.cos(e.cap), s = Math.sin(e.cap);
  return { x: e.x + OEIL.avant * c + OEIL.gauche * s, y: e.y + OEIL.avant * s - OEIL.gauche * c };
}

// Écart signé de l'angle a à l'angle b, en radians, ramené dans ]-pi ; pi] : un cap peut avoir fait plusieurs tours.
function ecart(a, b) {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

// Direction (radians, repère de l'écran) d'une cible vue depuis l'œil du conducteur de la voiture e.
function directionDepuisOeil(e, cible) {
  const o = oeil(e);
  return Math.atan2(cible.y - o.y, cible.x - o.x);
}

// La cible est-elle devant le conducteur, à au plus REGARD_MAX_SUIVI degrés du cap ?
const devantLeConducteur = (e, cible) => Math.abs(ecart(directionDepuisOeil(e, cible), e.cap)) <= REGARD_MAX_SUIVI * DEG;

/**
 * Cible que le conducteur suit des yeux pendant l'étape `etape` (regard { suivre: id }), pour sa voiture dans l'état
 * e ; `etats` : Map des états des acteurs (id -> etatActeur). Rend l'état de la cible quand elle est connue, visible
 * et à au plus REGARD_MAX_SUIVI degrés du cap ; null sinon (étape sans regard qui suit, cible inconnue, invisible ou
 * passée derrière le conducteur). Mêmes priorités qu'angleRegard : un balayage, un tour du regard ou un angle l'emportent
 * sur suivre. Les tests des scènes s'en servent pour savoir si le regard est posé sur la cible ou ramené devant.
 */
export function cibleSuivie(etape, e, etats) {
  const r = etape && etape.regard;
  if (!r || r.balayage || r.tour || typeof r.angle === "number" || !r.suivre) return null;
  const cible = etats.get(r.suivre);
  return cible && cible.visible && devantLeConducteur(e, cible) ? cible : null;
}

// Part du tour du regard accomplie à l'instant t : de 0 au début de l'étape (etape.t) à 1 à sa fin (etape.fin), bornée
// (le moteur entre dans une étape à 1e-9 s près). Une étape sans fin (construite à la main), ou qui ne dure pas, est
// refusée.
function partDuTour(etape, t) {
  const debut = etape.t, fin = etape.fin;
  if (!(Number.isFinite(debut) && Number.isFinite(fin) && fin > debut)) {
    throw new Error(`tour du regard : l'étape qui commence à t = ${debut} s doit porter sa fin, après son début`
      + ` (etape.fin reçu : ${String(fin)}) : une étape préparée par preparerScene la porte`);
  }
  return Math.min(1, Math.max(0, (t - debut) / (fin - debut)));
}

/**
 * Direction du regard (radians, repère de l'écran) pendant l'étape `etape`, pour la voiture de l'élève dans
 * l'état e, à l'instant t de la scène ; `etats` : Map des états des acteurs (id -> etatActeur). null : pas de
 * cône à dessiner (étape sans regard, cible inconnue ou invisible). Une cible suivie qui passe à plus de
 * REGARD_MAX_SUIVI degrés du cap est derrière le conducteur : il ne la suit plus des yeux et regarde de nouveau
 * devant lui (le regard rend le cap). Un tour du regard tourne vers la gauche, de 0 à -360 degrés, du début de
 * l'étape à sa fin : elle doit porter `fin`, comme toute étape préparée par preparerScene.
 */
export function angleRegard(etape, e, t, etats) {
  const r = etape && etape.regard;
  if (!r) return null;
  if (r.balayage) return e.cap + BALAYAGE.amplitude * DEG * Math.sin(2 * Math.PI * BALAYAGE.frequence * t);
  if (r.tour) return e.cap - 2 * Math.PI * partDuTour(etape, t);
  if (typeof r.angle === "number") return e.cap + r.angle * DEG;
  if (r.suivre) {
    const cible = etats.get(r.suivre);
    if (!cible || !cible.visible) return null;
    return devantLeConducteur(e, cible) ? directionDepuisOeil(e, cible) : e.cap;
  }
  return null;
}

/** Triangle du cône dessiné pour un regard de direction `angle` (radians) depuis l'œil o : [[x, y] x 3]. */
export function coneRegard(angle, o) {
  const pointe = (a) => [o.x + REGARD_PORTEE * Math.cos(a), o.y + REGARD_PORTEE * Math.sin(a)];
  return [[o.x, o.y], pointe(angle - REGARD_OUVERTURE * DEG), pointe(angle + REGARD_OUVERTURE * DEG)];
}

/** Le cône d'un regard posé sur un usager suivi des yeux s'arrête DEBORD_SUIVI m au-delà de lui (choix de dessin,
 *  amendement de la tâche 11) : il désigne la personne regardée au lieu de déborder du cadre. */
export const DEBORD_SUIVI = 2;

/**
 * Longueur (m) des côtés du cône dessiné pendant l'étape `etape`, pour la voiture de l'élève dans l'état e ; `etats` :
 * Map des états des acteurs (id -> etatActeur). REGARD_PORTEE, sauf quand le conducteur suit des yeux un usager
 * (cibleSuivie le rend) : le cône s'arrête alors DEBORD_SUIVI m au-delà de lui, sans dépasser REGARD_PORTEE. Un regard
 * ramené devant parce que la cible est passée derrière le conducteur reprend toute la portée.
 */
export function longueurCone(etape, e, etats) {
  const cible = cibleSuivie(etape, e, etats);
  if (!cible) return REGARD_PORTEE;
  const o = oeil(e);
  return Math.min(REGARD_PORTEE, Math.hypot(cible.x - o.x, cible.y - o.y) + DEBORD_SUIVI);
}

/**
 * Secteur que parcourt le cône pendant un balayage, pour une voiture de cap `cap` (radians) dont l'œil est en o : de
 * BALAYAGE.amplitude + REGARD_OUVERTURE degrés (75 + 16) de part et d'autre du cap, rayon REGARD_PORTEE. C'est la
 * réunion exacte des cônes du balayage : leurs pointes décrivent l'arc. Polygone [[x, y], ...] : l'œil, puis l'arc, par
 * pas d'au plus `pasDeg` degrés.
 */
export function secteurBalayage(cap, o, pasDeg = 5) {
  const demi = (BALAYAGE.amplitude + REGARD_OUVERTURE) * DEG;
  const n = Math.ceil((2 * demi) / (pasDeg * DEG));
  const arc = Array.from({ length: n + 1 }, (_, k) => {
    const a = cap - demi + (2 * demi * k) / n;
    return [o.x + REGARD_PORTEE * Math.cos(a), o.y + REGARD_PORTEE * Math.sin(a)];
  });
  return [[o.x, o.y], ...arc];
}

/**
 * Quatre cônes qui montrent un tour du regard sur une image figée, pour une voiture de cap `cap` (radians) dont l'œil est
 * en o : un par direction de DIRECTIONS_TOUR_FIGE (devant, à gauche, derrière, à droite), chacun le triangle d'un cône
 * ordinaire (coneRegard : REGARD_PORTEE, REGARD_OUVERTURE). Ce sont les cônes que la lecture montre au début du tour, puis
 * au quart, à la moitié et aux trois quarts. [[[x, y] x 3] x 4], dans l'ordre du tour.
 */
export function conesTour(cap, o) {
  return DIRECTIONS_TOUR_FIGE.map((d) => coneRegard(cap + d * DEG, o));
}

/**
 * Regard que dessine le moteur à l'instant t de l'étape `etape`, pour la voiture de l'élève dans l'état e ; `etats` :
 * Map des états des acteurs. null : pas de regard (étape sans regard, cible inconnue ou invisible).
 * - { forme: "cone", poly } : le triangle de coneRegard, dans la direction d'angleRegard, ramené vers l'œil à la
 *   longueur de longueurCone ;
 * - sur une image figée (`fige` : pas à pas, pause, fin de lecture, animations réduites), un regard en mouvement se
 *   montre par ce qu'il parcourt, et non par la direction qu'il aurait par hasard à cet instant : { forme: "secteur",
 *   poly } pour un balayage (secteurBalayage), { forme: "cones", polys } pour un tour du regard (les quatre cônes de
 *   conesTour). Un angle ou un usager suivi gardent le même cône qu'en lecture.
 */
export function regardDessine(etape, e, t, etats, fige = false) {
  const r = etape && etape.regard;
  if (fige && r && r.balayage) return { forme: "secteur", poly: secteurBalayage(e.cap, oeil(e)) };
  if (fige && r && r.tour) return { forme: "cones", polys: conesTour(e.cap, oeil(e)) };
  const angle = angleRegard(etape, e, t, etats);
  if (angle === null) return null;
  const o = oeil(e), k = Math.min(1, longueurCone(etape, e, etats) / REGARD_PORTEE);
  const triangle = coneRegard(angle, o);
  return { forme: "cone", poly: k === 1 ? triangle : triangle.map(([x, y]) => [o.x + (x - o.x) * k, o.y + (y - o.y) * k]) };
}

/**
 * Le cône d'un regard de direction `angle` (radians, ou null : pas de cône) depuis l'œil o contient-il le point
 * { x, y } ? Même triangle que coneRegard, bords compris : le point est dans l'ouverture et en deçà du bord
 * lointain, perpendiculaire à l'axe à REGARD_PORTEE cos(REGARD_OUVERTURE) de l'œil.
 */
export function regardContient(angle, o, point) {
  if (angle === null || angle === undefined) return false;
  const dx = point.x - o.x, dy = point.y - o.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;
  const horsAxe = ecart(Math.atan2(dy, dx), angle);
  return Math.abs(horsAxe) <= REGARD_OUVERTURE * DEG
    && distance * Math.cos(horsAxe) <= REGARD_PORTEE * Math.cos(REGARD_OUVERTURE * DEG);
}
