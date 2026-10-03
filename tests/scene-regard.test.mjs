import { test } from "node:test";
import assert from "node:assert/strict";
import { DEG } from "../js/scene-geometrie.js";
import { REGARD_MAX_SUIVI, oeil, angleRegard } from "../js/scene-regard.js";

const proche = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} au lieu de ${b}`);
// Écart signé (degrés) de l'angle a à l'angle b (radians), ramené dans ]-180 ; 180].
function ecartDeg(a, b) {
  let d = ((a - b) / DEG) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

// Voiture de l'élève en (10 ; 20). Repère de l'écran : y vers le bas, cap croissant dans le sens horaire ;
// cap -90 degrés : vers le nord (haut de l'écran), cap 0 : vers l'est.
const voiture = (capDeg) => ({ x: 10, y: 20, cap: capDeg * DEG, v: 5, visible: true });
const etape = (regard) => ({ s: 0, t: 0, regard });
const sans = new Map();
// Un piéton à `distance` m de l'œil, dans la direction cap + `relatifDeg`.
function cibleVue(e, relatifDeg, distance = 10, visible = true) {
  const o = oeil(e), a = e.cap + relatifDeg * DEG;
  return new Map([["pieton", { x: o.x + distance * Math.cos(a), y: o.y + distance * Math.sin(a), cap: 0, v: 1.2, visible }]]);
}

test("REGARD_MAX_SUIVI vaut 100 degrés", () => {
  assert.equal(REGARD_MAX_SUIVI, 100);
});

test("oeil : place du conducteur, 0,2 m en avant du centre et 0,4 m à gauche (France)", () => {
  // Vers le nord, la gauche est à l'ouest (x décroissant) et l'avant au nord (y décroissant).
  const n = oeil(voiture(-90));
  proche(n.x, 9.6); proche(n.y, 19.8);
  // Vers l'est, la gauche est au nord.
  const e = oeil(voiture(0));
  proche(e.x, 10.2); proche(e.y, 19.6);
});

test("sans étape ou sans regard, pas de cône", () => {
  assert.equal(angleRegard(undefined, voiture(-90), 0, sans), null);
  assert.equal(angleRegard({ s: 0, t: 0 }, voiture(-90), 0, sans), null);
  assert.equal(angleRegard(etape({}), voiture(-90), 0, sans), null);
});

test("angle : en degrés par rapport au cap, positif à droite, négatif à gauche", () => {
  // Vers le nord, 165 (rétroviseur droit, arrière droit) regarde au sud-sud-est : 75 degrés à l'écran.
  proche(angleRegard(etape({ angle: 165 }), voiture(-90), 3, sans), 75 * DEG);
  proche(angleRegard(etape({ angle: 150 }), voiture(-90), 3, sans), 60 * DEG);
  proche(angleRegard(etape({ angle: 0 }), voiture(-90), 3, sans), -90 * DEG);
  proche(angleRegard(etape({ angle: -40 }), voiture(0), 3, sans), -40 * DEG);
});

test("balayage : 75 degrés de part et d'autre du cap, un aller-retour complet toutes les 2,0 s", () => {
  const relatif = (t) => ecartDeg(angleRegard(etape({ balayage: true }), voiture(-90), t, sans), -90 * DEG);
  proche(relatif(0), 0);
  proche(relatif(0.5), 75);
  proche(relatif(1), 0);
  proche(relatif(1.5), -75);
  for (const t of [0.13, 0.7, 1.21, 3.9]) proche(relatif(t + 2), relatif(t));
});

test("suivre : vers la cible, mesuré depuis l'œil du conducteur et non depuis le centre de la voiture", () => {
  // Cible à 1,5 m à droite du centre d'une voiture tournée vers l'est : 90 degrés depuis le centre, mais
  // l'œil est 0,2 m en avant et 0,4 m à gauche : la cible est vue à atan2(1,9 ; -0,2), soit 96,0 degrés.
  const e = voiture(0);
  const etats = new Map([["pieton", { x: 10, y: 21.5, cap: 0, v: 0, visible: true }]]);
  proche(angleRegard(etape({ suivre: "pieton" }), e, 0, etats), Math.atan2(1.9, -0.2));
  // Devant à droite d'une voiture tournée vers le nord.
  const n = voiture(-90);
  proche(ecartDeg(angleRegard(etape({ suivre: "pieton" }), n, 0, cibleVue(n, 30)), n.cap), 30);
});

test("suivre : pas de cône si la cible est inconnue ou invisible", () => {
  const n = voiture(-90);
  assert.equal(angleRegard(etape({ suivre: "fantome" }), n, 0, cibleVue(n, 10)), null);
  assert.equal(angleRegard(etape({ suivre: "pieton" }), n, 0, cibleVue(n, 10, 10, false)), null);
});

test("suivre : pas de cône au-delà de REGARD_MAX_SUIVI degrés du cap, de chaque côté", () => {
  const n = voiture(-90);
  const suivi = (relatifDeg) => angleRegard(etape({ suivre: "pieton" }), n, 0, cibleVue(n, relatifDeg));
  proche(ecartDeg(suivi(99.9), n.cap), 99.9, 1e-6);
  proche(ecartDeg(suivi(-99.9), n.cap), -99.9, 1e-6);
  assert.equal(suivi(100.1), null);
  assert.equal(suivi(-100.1), null);
  assert.equal(suivi(180), null);
});

test("suivre : l'écart au cap se mesure modulo un tour, quel que soit le cap accumulé", () => {
  // Après des virages, le cap peut sortir de ]-180 ; 180] : -450 degrés vise le nord comme -90.
  for (const capDeg of [-450, 270, 630]) {
    const e = voiture(capDeg);
    proche(ecartDeg(angleRegard(etape({ suivre: "pieton" }), e, 0, cibleVue(e, 30)), e.cap), 30, 1e-6);
    assert.equal(angleRegard(etape({ suivre: "pieton" }), e, 0, cibleVue(e, 150)), null);
  }
});
