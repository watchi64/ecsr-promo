import { test } from "node:test";
import assert from "node:assert/strict";
import { DEG, pointDansPolygone } from "../js/scene-geometrie.js";
import { REGARD_MAX_SUIVI, REGARD_PORTEE, REGARD_OUVERTURE, REGARD_DUREE_TOUR_MIN, DEBORD_SUIVI, oeil, angleRegard, cibleSuivie,
  coneRegard, regardContient, longueurCone, secteurBalayage, secteurTour, etapeBornee, regardDessine } from "../js/scene-regard.js";

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
  // Vers le nord, 170 (rétroviseurs) regarde à 80 degrés à l'écran, presque vers l'arrière ; 120 (angle mort droit,
  // tête tournée vers l'épaule) à 30 degrés.
  proche(angleRegard(etape({ angle: 170 }), voiture(-90), 3, sans), 80 * DEG);
  proche(angleRegard(etape({ angle: 120 }), voiture(-90), 3, sans), 30 * DEG);
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

test("suivre : au-delà de REGARD_MAX_SUIVI degrés du cap, de chaque côté, la cible est passée derrière le conducteur, qui regarde de nouveau devant lui", () => {
  const n = voiture(-90);
  const suivi = (relatifDeg) => angleRegard(etape({ suivre: "pieton" }), n, 0, cibleVue(n, relatifDeg));
  proche(ecartDeg(suivi(99.9), n.cap), 99.9, 1e-6);
  proche(ecartDeg(suivi(-99.9), n.cap), -99.9, 1e-6);
  // Le regard rend le cap lui-même : un cône droit devant, jamais une absence de cône pour une cible visible.
  assert.equal(suivi(100.1), n.cap);
  assert.equal(suivi(-100.1), n.cap);
  assert.equal(suivi(180), n.cap);
});

test("suivre : l'écart au cap se mesure modulo un tour, quel que soit le cap accumulé", () => {
  // Après des virages, le cap peut sortir de ]-180 ; 180] : -450 degrés vise le nord comme -90.
  for (const capDeg of [-450, 270, 630]) {
    const e = voiture(capDeg);
    proche(ecartDeg(angleRegard(etape({ suivre: "pieton" }), e, 0, cibleVue(e, 30)), e.cap), 30, 1e-6);
    assert.equal(angleRegard(etape({ suivre: "pieton" }), e, 0, cibleVue(e, 150)), e.cap);
  }
});

test("cibleSuivie : la cible que le conducteur suit des yeux, visible et à au plus REGARD_MAX_SUIVI degrés du cap ; sinon null", () => {
  const n = voiture(-90), suivre = etape({ suivre: "pieton" });
  const vue = cibleVue(n, 30);
  assert.equal(cibleSuivie(suivre, n, vue), vue.get("pieton"));
  assert.equal(cibleSuivie(suivre, n, cibleVue(n, 100.1)), null, "passée derrière, à droite");
  assert.equal(cibleSuivie(suivre, n, cibleVue(n, -100.1)), null, "passée derrière, à gauche");
  assert.equal(cibleSuivie(suivre, n, cibleVue(n, 30, 10, false)), null, "invisible");
  assert.equal(cibleSuivie(etape({ suivre: "fantome" }), n, vue), null, "inconnue");
  // Seul un regard qui suit a une cible ; un balayage ou un angle l'emportent, comme dans angleRegard.
  assert.equal(cibleSuivie(undefined, n, vue), null);
  assert.equal(cibleSuivie({ s: 0, t: 0 }, n, vue), null);
  assert.equal(cibleSuivie(etape({ angle: 30 }), n, vue), null);
  assert.equal(cibleSuivie(etape({ balayage: true }), n, vue), null);
  assert.equal(cibleSuivie(etape({ angle: 30, suivre: "pieton" }), n, vue), null);
});

test("suivre : angleRegard vise la cible exactement quand cibleSuivie la rend, et le cap quand elle est passée derrière", () => {
  for (const capDeg of [-90, 0, 37, -450]) {
    const e = voiture(capDeg);
    for (let relatif = -177; relatif <= 177; relatif += 3) {
      const etats = cibleVue(e, relatif), suivre = etape({ suivre: "pieton" });
      const angle = angleRegard(suivre, e, 0, etats), suivie = cibleSuivie(suivre, e, etats);
      assert.equal(suivie !== null, Math.abs(relatif) <= REGARD_MAX_SUIVI, `cap ${capDeg}, cible à ${relatif} degrés`);
      if (suivie) proche(ecartDeg(angle, e.cap), relatif, 1e-6);
      else assert.equal(angle, e.cap, `cap ${capDeg}, cible à ${relatif} degrés : regard ramené devant`);
    }
  }
});

// ===== Cône du regard : portée et ouverture nommées (décision du 03/10, seconde relecture de la tâche 8) =====

// Point à `distance` m de o, dans la direction `deg` degrés (repère de l'écran).
const vers = (o, deg, distance) => ({ x: o.x + distance * Math.cos(deg * DEG), y: o.y + distance * Math.sin(deg * DEG) });

test("cône du regard : portée de 22 m, demi-ouverture de 16 degrés", () => {
  assert.equal(REGARD_PORTEE, 22);
  assert.equal(REGARD_OUVERTURE, 16);
});

test("coneRegard : le triangle dessiné, de l'œil aux deux pointes, à REGARD_PORTEE m et REGARD_OUVERTURE degrés de part et d'autre", () => {
  const o = { x: 10, y: 20 };
  const [sommet, gauche, droite] = coneRegard(-90 * DEG, o);   // regard vers le nord
  proche(sommet[0], 10); proche(sommet[1], 20);
  const g = vers(o, -106, 22), d = vers(o, -74, 22);
  proche(gauche[0], g.x); proche(gauche[1], g.y);
  proche(droite[0], d.x); proche(droite[1], d.y);
});

test("regardContient : dans l'ouverture et en deçà du bord lointain du triangle, bords compris", () => {
  const o = { x: 0, y: 0 };
  // Regard vers l'est. Sur l'axe, le bord lointain est à 22 cos 16 = 21,15 m ; les pointes sont à 22 m.
  assert.equal(regardContient(0, o, vers(o, 0, 10)), true);
  assert.equal(regardContient(0, o, vers(o, 0, 21.1)), true);
  assert.equal(regardContient(0, o, vers(o, 0, 21.2)), false);
  assert.equal(regardContient(0, o, vers(o, 15.9, 21.9)), true);
  assert.equal(regardContient(0, o, vers(o, 16.1, 10)), false);
  assert.equal(regardContient(0, o, vers(o, -15.9, 10)), true);
  assert.equal(regardContient(0, o, vers(o, -16.1, 10)), false);
  assert.equal(regardContient(0, o, vers(o, 180, 5)), false);
  assert.equal(regardContient(0, o, o), true, "l'œil est le sommet du cône");
  assert.equal(regardContient(2 * Math.PI, o, vers(o, 5, 10)), true, "un tour de plus ne change rien");
  // Pas de regard (angleRegard rend null) : pas de cône, rien n'est contenu.
  assert.equal(regardContient(null, o, vers(o, 0, 5)), false);
});

test("regardContient coïncide avec le triangle de coneRegard", () => {
  const o = { x: 1.3, y: -0.7 };
  let dedans = 0;
  for (const angleDeg of [0, 37, -100, 200, 451]) {
    const triangle = coneRegard(angleDeg * DEG, o);
    for (let x = -24.7; x <= 25; x += 0.731) {
      for (let y = -24.3; y <= 25; y += 0.677) {
        const attendu = pointDansPolygone([x, y], triangle);
        if (attendu) dedans++;
        assert.equal(regardContient(angleDeg * DEG, o, { x, y }), attendu, `angle ${angleDeg}, point (${x.toFixed(3)} ; ${y.toFixed(3)})`);
      }
    }
  }
  assert.ok(dedans > 500, "la grille traverse bien les cônes");
});

// ===== Cône dessiné par le moteur (correction de la tâche 11) =====

// Distance de l'œil o au point [x, y] et direction (radians) de ce point vue de l'œil.
const distance = (o, [x, y]) => Math.hypot(x - o.x, y - o.y);
const direction = (o, [x, y]) => Math.atan2(y - o.y, x - o.x);

test("longueurCone : le cône s'arrête DEBORD_SUIVI m au-delà de l'usager suivi des yeux, sans dépasser REGARD_PORTEE", () => {
  assert.equal(DEBORD_SUIVI, 2);
  const n = voiture(-90), suivre = etape({ suivre: "pieton" });
  proche(longueurCone(suivre, n, cibleVue(n, 30, 10)), 12);
  proche(longueurCone(suivre, n, cibleVue(n, -99, 5)), 7);
  proche(longueurCone(suivre, n, cibleVue(n, 0, 19.5)), 21.5);
  assert.equal(longueurCone(suivre, n, cibleVue(n, 30, 21)), REGARD_PORTEE, "22 m au plus");
});

test("longueurCone : regard ramené devant (cible passée derrière le conducteur), toute la portée et non la distance à la cible", () => {
  const n = voiture(-90), suivre = etape({ suivre: "pieton" });
  for (const relatif of [100.1, -100.1, 150, 180]) {
    assert.equal(longueurCone(suivre, n, cibleVue(n, relatif, 5)), REGARD_PORTEE, `cible à ${relatif} degrés du cap`);
  }
  // Sans cible suivie (inconnue, invisible), ou sans regard qui suit : toute la portée.
  assert.equal(longueurCone(etape({ suivre: "fantome" }), n, cibleVue(n, 10, 5)), REGARD_PORTEE);
  assert.equal(longueurCone(suivre, n, cibleVue(n, 10, 5, false)), REGARD_PORTEE);
  assert.equal(longueurCone(etape({ angle: 40 }), n, cibleVue(n, 40, 5)), REGARD_PORTEE);
  assert.equal(longueurCone(etape({ balayage: true }), n, cibleVue(n, 0, 5)), REGARD_PORTEE);
  assert.equal(longueurCone(undefined, n, sans), REGARD_PORTEE);
});

test("secteurBalayage : l'œil, puis l'arc de rayon REGARD_PORTEE, de 75 + 16 degrés de part et d'autre du cap", () => {
  const n = voiture(-90), o = oeil(n);
  const secteur = secteurBalayage(n.cap, o);
  proche(secteur[0][0], o.x); proche(secteur[0][1], o.y);
  const arc = secteur.slice(1);
  assert.ok(arc.length >= 37, "arc tracé par pas de 5 degrés au plus");
  for (const p of arc) proche(distance(o, p), REGARD_PORTEE, 1e-9);
  const relatifs = arc.map((p) => ecartDeg(direction(o, p), n.cap));
  proche(relatifs[0], -(75 + REGARD_OUVERTURE), 1e-9);
  proche(relatifs[relatifs.length - 1], 75 + REGARD_OUVERTURE, 1e-9);
  for (let k = 1; k < relatifs.length; k++) {
    assert.ok(relatifs[k] > relatifs[k - 1] && relatifs[k] - relatifs[k - 1] <= 5 + 1e-9, "arc parcouru dans un seul sens, sans saut");
  }
});

test("secteurBalayage : c'est la réunion des cônes du balayage, dont les pointes atteignent ses deux bords", () => {
  const n = voiture(-90), o = oeil(n), b = etape({ balayage: true });
  let min = Infinity, max = -Infinity;
  for (let t = 0; t < 2; t += 0.005) {
    for (const p of coneRegard(angleRegard(b, n, t, sans), o).slice(1)) {
      const relatif = ecartDeg(direction(o, p), n.cap);
      assert.ok(Math.abs(relatif) <= 75 + REGARD_OUVERTURE + 1e-9, `pointe du cône hors du secteur à t = ${t.toFixed(3)} s`);
      min = Math.min(min, relatif); max = Math.max(max, relatif);
    }
  }
  proche(min, -(75 + REGARD_OUVERTURE), 1e-6);
  proche(max, 75 + REGARD_OUVERTURE, 1e-6);
});

test("regardDessine : en lecture, le triangle de coneRegard dans la direction d'angleRegard, à la longueur de longueurCone", () => {
  const n = voiture(-90), o = oeil(n);
  for (const [regard, etats, t] of [[{ angle: 120 }, sans, 3], [{ balayage: true }, sans, 0.37], [{ suivre: "pieton" }, cibleVue(n, 30, 10), 1]]) {
    const r = regardDessine(etape(regard), n, t, etats);
    assert.equal(r.forme, "cone", JSON.stringify(regard));
    const angle = angleRegard(etape(regard), n, t, etats), longueur = longueurCone(etape(regard), n, etats);
    const attendu = coneRegard(angle, o);
    proche(r.poly[0][0], o.x); proche(r.poly[0][1], o.y);
    for (let k = 1; k < 3; k++) {
      proche(distance(o, r.poly[k]), longueur, 1e-9);
      proche(direction(o, r.poly[k]), direction(o, attendu[k]), 1e-9);
    }
  }
  assert.equal(regardDessine(etape({}), n, 0, sans), null, "pas de regard, pas de cône");
  assert.equal(regardDessine(etape({ suivre: "pieton" }), n, 0, cibleVue(n, 30, 10, false)), null, "cible invisible");
});

test("regardDessine : regard ramené devant, le cône de toute la portée droit devant", () => {
  const n = voiture(-90), o = oeil(n);
  const r = regardDessine(etape({ suivre: "pieton" }), n, 0, cibleVue(n, 160, 4));
  assert.equal(r.forme, "cone");
  for (const p of r.poly.slice(1)) proche(distance(o, p), REGARD_PORTEE, 1e-9);
  proche(ecartDeg(direction(o, r.poly[1]) / 2 + direction(o, r.poly[2]) / 2, n.cap), 0, 1e-9);
});

test("regardDessine : sur une image figée, un balayage montre le secteur balayé ; un angle ou un regard qui suit, le même cône qu'en lecture", () => {
  const n = voiture(-90), o = oeil(n);
  const balayage = regardDessine(etape({ balayage: true }), n, 0.37, sans, true);
  assert.equal(balayage.forme, "secteur");
  assert.deepEqual(balayage.poly, secteurBalayage(n.cap, o));
  for (const [regard, etats] of [[{ angle: -170 }, sans], [{ suivre: "pieton" }, cibleVue(n, -30, 8)], [{ suivre: "pieton" }, cibleVue(n, 120, 8)]]) {
    assert.deepEqual(regardDessine(etape(regard), n, 2.2, etats, true), regardDessine(etape(regard), n, 2.2, etats), JSON.stringify(regard));
  }
  assert.equal(regardDessine(undefined, n, 0, sans, true), null);
});

// ===== Tour du regard : contrôles tout autour avant une marche arrière (plan 2, tâche 3) =====

// Étape dont le regard fait le tour, de `debut` à `fin` (s) : bornée, comme le moteur la passe (etapeBornee).
const tour = (debut, fin) => ({ s: 0, t: debut, fin, regard: { tour: true } });
// Angle du regard par rapport au cap (degrés), sans le ramener dans un intervalle : -270 et 90 ne s'y confondent pas.
const relatifBrut = (et, e, t) => (angleRegard(et, e, t, sans) - e.cap) / DEG;
// Direction (radians) de l'axe d'un cône dessiné : de l'œil vers le milieu de ses deux pointes.
const axe = (o, poly) => direction(o, [(poly[1][0] + poly[2][0]) / 2, (poly[1][1] + poly[2][1]) / 2]);

test("REGARD_DUREE_TOUR_MIN : une étape dont le regard fait le tour dure au moins 4 s", () => {
  assert.equal(REGARD_DUREE_TOUR_MIN, 4);
});

test("tour : l'angle va de 0 à -360 degrés, linéairement pendant l'étape : devant, la gauche au quart, l'arrière à la moitié, la droite aux trois quarts, de nouveau devant à la fin", () => {
  for (const [debut, fin] of [[0, 4], [12.5, 16.5], [3.2, 9.7]]) {
    for (const capDeg of [-90, 0, 37, -450]) {
      const e = voiture(capDeg), et = tour(debut, fin), duree = fin - debut;
      const relatif = (part) => relatifBrut(et, e, debut + part * duree);
      proche(relatif(0), 0);
      proche(relatif(1 / 4), -90);
      proche(relatif(1 / 2), -180);
      proche(relatif(3 / 4), -270);
      proche(relatif(1), -360);
      for (const part of [0.1, 0.37, 0.62, 0.9]) proche(relatif(part), -360 * part);
    }
  }
});

test("tour : vers le nord, le regard passe à l'ouest (la gauche), au sud (l'arrière), à l'est (la droite), puis revient au nord", () => {
  const n = voiture(-90), et = tour(0, 4);
  // Repère de l'écran, y vers le bas : nord (0 ; -1), ouest (-1 ; 0), sud (0 ; 1), est (1 ; 0).
  for (const [t, [x, y]] of [[0, [0, -1]], [1, [-1, 0]], [2, [0, 1]], [3, [1, 0]], [4, [0, -1]]]) {
    const a = angleRegard(et, n, t, sans);
    proche(Math.cos(a), x); proche(Math.sin(a), y);
  }
  // D'abord vers la gauche, jamais vers la droite : 45 degrés à gauche au huitième du tour.
  proche(ecartDeg(angleRegard(et, n, 0.5, sans), n.cap), -45);
});

test("tour : l'angle reste borné à l'étape : devant à son début (l'étape commence à 1e-9 s près, comme dans le moteur), revenu devant à sa fin", () => {
  const n = voiture(-90), et = tour(5, 9);
  proche(relatifBrut(et, n, 5 - 1e-9), 0, 1e-12);
  proche(relatifBrut(et, n, 9), -360, 1e-12);
  proche(relatifBrut(et, n, 9.4), -360, 1e-12);
});

test("tour : une étape sans fin, ou qui ne dure pas, est refusée par un message qui dit comment la borner", () => {
  const n = voiture(-90);
  assert.throws(() => angleRegard({ s: 0, t: 2, regard: { tour: true } }, n, 2, sans), /tour du regard.*etapeBornee/);
  assert.throws(() => regardDessine({ s: 0, t: 2, regard: { tour: true } }, n, 2, sans), /tour du regard.*etapeBornee/);
  assert.throws(() => angleRegard(tour(2, 2), n, 2, sans), /tour du regard/);
  assert.throws(() => angleRegard(tour(2, 1.5), n, 2, sans), /tour du regard/);
});

test("tour : le cône de toute la portée, sans usager suivi ; un balayage l'emporte sur lui, lui sur un angle ou un usager suivi", () => {
  const n = voiture(-90), vue = cibleVue(n, -90, 5);
  const et = (regard) => ({ s: 0, t: 0, fin: 4, regard });
  assert.equal(longueurCone(et({ tour: true }), n, vue), REGARD_PORTEE);
  assert.equal(cibleSuivie(et({ tour: true, suivre: "pieton" }), n, vue), null);
  assert.equal(longueurCone(et({ tour: true, suivre: "pieton" }), n, vue), REGARD_PORTEE);
  // Au quart d'un tour de 4 s : 90 degrés à gauche ; un balayage, lui, regarde à 75 degrés à droite à 0,5 s.
  proche(ecartDeg(angleRegard(et({ tour: true, angle: 30 }), n, 1, sans), n.cap), -90);
  proche(ecartDeg(angleRegard(et({ tour: true, suivre: "pieton" }), n, 1, vue), n.cap), -90);
  proche(ecartDeg(angleRegard(et({ balayage: true, tour: true }), n, 0.5, sans), n.cap), 75);
});

test("secteurTour : tout le tour de l'œil, le cercle de rayon REGARD_PORTEE, parcouru depuis le cap vers la gauche comme le regard", () => {
  for (const capDeg of [-90, 0, 37, -450]) {
    const e = voiture(capDeg), o = oeil(e);
    const cercle = secteurTour(e.cap, o);
    assert.ok(cercle.length >= 72, "cercle tracé par pas de 5 degrés au plus");
    for (const p of cercle) proche(distance(o, p), REGARD_PORTEE);
    proche(ecartDeg(direction(o, cercle[0]), e.cap), 0);
    // D'un point au suivant, le dernier refermant le polygone sur le premier : vers la gauche, de 5 degrés au plus, un
    // tour en tout.
    let total = 0;
    cercle.forEach((p, k) => {
      const pas = ecartDeg(direction(o, cercle[(k + 1) % cercle.length]), direction(o, p));
      assert.ok(pas < 0 && pas >= -5 - 1e-9, `cap ${capDeg} : pas de ${pas} degrés après le point ${k}`);
      total += pas;
    });
    proche(total, -360);
  }
});

test("secteurTour : c'est la réunion des cônes du tour, dont les pointes, sur son cercle, passent par toutes les directions autour de l'œil", () => {
  const n = voiture(-90), o = oeil(n), et = tour(0, 4);
  const directions = new Set();
  for (let t = 0; t <= 4; t += 0.005) {
    for (const p of coneRegard(angleRegard(et, n, t, sans), o).slice(1)) {
      proche(distance(o, p), REGARD_PORTEE);
      directions.add(Math.round(ecartDeg(direction(o, p), 0) + 180) % 360);
    }
  }
  assert.equal(directions.size, 360, "pointes des cônes du tour, au degré près");
});

test("regardDessine : un tour du regard, en lecture, le cône de toute la portée dans la direction d'angleRegard ; sur une image figée, tout le tour de l'œil (secteurTour)", () => {
  const n = voiture(-90), o = oeil(n), et = tour(2, 6);
  for (const t of [2, 3, 4.1, 5.5]) {
    const r = regardDessine(et, n, t, sans);
    assert.equal(r.forme, "cone", `t = ${t} s`);
    proche(r.poly[0][0], o.x); proche(r.poly[0][1], o.y);
    for (const p of r.poly.slice(1)) proche(distance(o, p), REGARD_PORTEE);
    proche(ecartDeg(axe(o, r.poly), angleRegard(et, n, t, sans)), 0);
  }
  const fige = regardDessine(et, n, 3, sans, true);
  assert.equal(fige.forme, "secteur");
  assert.deepEqual(fige.poly, secteurTour(n.cap, o));
  // L'image figée montre tout le tour quel que soit l'instant, sans avoir besoin de la fin de l'étape.
  assert.deepEqual(regardDessine(et, n, 5.9, sans, true), fige);
  assert.deepEqual(regardDessine({ s: 0, t: 2, regard: { tour: true } }, n, 2, sans, true), fige);
});

test("etapeBornee : l'étape k d'une scène préparée, avec sa fin : le début de l'étape suivante, la fin de la scène pour la dernière", () => {
  const sc = { duree: 21, etapes: [{ s: 0, t: 0, regard: { angle: 0 } }, { s: 6, t: 4.32, regard: { tour: true } },
    { s: 6, t: 9.32, delai: 5, regard: { angle: 165 } }] };
  assert.deepEqual(etapeBornee(sc, 0), { s: 0, t: 0, regard: { angle: 0 }, fin: 4.32 });
  assert.deepEqual(etapeBornee(sc, 1), { s: 6, t: 4.32, regard: { tour: true }, fin: 9.32 });
  assert.deepEqual(etapeBornee(sc, 2), { s: 6, t: 9.32, delai: 5, regard: { angle: 165 }, fin: 21 });
  assert.equal(sc.etapes[1].fin, undefined, "l'étape de la scène n'est pas modifiée");
  // Ainsi bornée, l'étape du tour se dessine : au quart de ses 5 s, la gauche.
  proche(relatifBrut(etapeBornee(sc, 1), voiture(-90), 4.32 + 1.25), -90);
});
