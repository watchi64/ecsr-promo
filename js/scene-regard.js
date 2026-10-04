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
 * image figée, le secteur que parcourt un balayage (secteurBalayage).
 */
import { DEG } from "./scene-geometrie.js?v=20261004a";

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
 * passée derrière le conducteur). Mêmes priorités qu'angleRegard : un balayage ou un angle l'emportent sur suivre.
 * Les tests des scènes s'en servent pour savoir si le regard est posé sur la cible ou ramené devant.
 */
export function cibleSuivie(etape, e, etats) {
  const r = etape && etape.regard;
  if (!r || r.balayage || typeof r.angle === "number" || !r.suivre) return null;
  const cible = etats.get(r.suivre);
  return cible && cible.visible && devantLeConducteur(e, cible) ? cible : null;
}

/**
 * Direction du regard (radians, repère de l'écran) pendant l'étape `etape`, pour la voiture de l'élève dans
 * l'état e, à l'instant t de la scène ; `etats` : Map des états des acteurs (id -> etatActeur). null : pas de
 * cône à dessiner (étape sans regard, cible inconnue ou invisible). Une cible suivie qui passe à plus de
 * REGARD_MAX_SUIVI degrés du cap est derrière le conducteur : il ne la suit plus des yeux et regarde de nouveau
 * devant lui (le regard rend le cap).
 */
export function angleRegard(etape, e, t, etats) {
  const r = etape && etape.regard;
  if (!r) return null;
  if (r.balayage) return e.cap + BALAYAGE.amplitude * DEG * Math.sin(2 * Math.PI * BALAYAGE.frequence * t);
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
 * Regard que dessine le moteur à l'instant t de l'étape `etape`, pour la voiture de l'élève dans l'état e ; `etats` :
 * Map des états des acteurs. null : pas de regard (étape sans regard, cible inconnue ou invisible).
 * - { forme: "cone", poly } : le triangle de coneRegard, dans la direction d'angleRegard, ramené vers l'œil à la
 *   longueur de longueurCone ;
 * - { forme: "secteur", poly } : sur une image figée (`fige` : pas à pas, pause, fin de lecture, animations réduites),
 *   un balayage se montre par le secteur qu'il parcourt (secteurBalayage), et non par la direction que son va-et-vient
 *   aurait par hasard à cet instant. Un angle ou un usager suivi gardent le même cône qu'en lecture.
 */
export function regardDessine(etape, e, t, etats, fige = false) {
  const r = etape && etape.regard;
  if (fige && r && r.balayage) return { forme: "secteur", poly: secteurBalayage(e.cap, oeil(e)) };
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
