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
 *   (0 droit devant, 40 la sortie d'un virage à droite, 150 l'angle mort droit,
 *   165 le rétroviseur droit et l'arrière droit) ;
 * - { balayage: true } : va-et-vient de part et d'autre du cap (BALAYAGE) ;
 * - { suivre: id } : vers l'acteur id, depuis l'œil du conducteur, tant qu'il est
 *   visible et à au plus REGARD_MAX_SUIVI degrés du cap : le conducteur ne suit
 *   pas des yeux ce qui passe derrière lui.
 * Sans regard, ou quand la cible est perdue, angleRegard rend null : pas de cône.
 */
import { DEG } from "./scene-geometrie.js?v=20261003c";

/** Écart maximal, en degrés, entre le cap et la direction d'une cible suivie des yeux. */
export const REGARD_MAX_SUIVI = 100;

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

/**
 * Direction du regard (radians, repère de l'écran) pendant l'étape `etape`, pour la voiture de l'élève dans
 * l'état e, à l'instant t de la scène ; `etats` : Map des états des acteurs (id -> etatActeur). null : pas de
 * cône à dessiner (étape sans regard, cible inconnue, invisible, ou à plus de REGARD_MAX_SUIVI degrés du cap).
 */
export function angleRegard(etape, e, t, etats) {
  const r = etape && etape.regard;
  if (!r) return null;
  if (r.balayage) return e.cap + BALAYAGE.amplitude * DEG * Math.sin(2 * Math.PI * BALAYAGE.frequence * t);
  if (typeof r.angle === "number") return e.cap + r.angle * DEG;
  if (r.suivre) {
    const cible = etats.get(r.suivre);
    if (!cible || !cible.visible) return null;
    const o = oeil(e);
    const direction = Math.atan2(cible.y - o.y, cible.x - o.x);
    return Math.abs(ecart(direction, e.cap)) > REGARD_MAX_SUIVI * DEG ? null : direction;
  }
  return null;
}
