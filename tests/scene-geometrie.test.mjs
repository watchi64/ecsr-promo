import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEG, trajet, pointA, courbureA, tournerChemin, tournerPoint, premiereAbscisse, avant,
  chronologie, etatA, tempsAtteint, emprise, rectangle, pointsArc, disque, secteurAnneau,
  pointDansPolygone, polygonesSeChevauchent, preparerScene, etatActeur,
} from "../js/scene-geometrie.js";

const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} au lieu de ${b}`);

test("ligne droite vers le nord (cap -90°)", () => {
  const c = trajet(0, 10, -90).droit(10).fin();
  const p = pointA(c, 4);
  proche(p.x, 0); proche(p.y, 6); proche(p.cap, -90 * DEG);
});

test("virage à droite de 90° depuis le nord : vers l'est, décalé à droite et en avant", () => {
  const c = trajet(0, 0, -90).virage(5, 90).fin();
  const p = pointA(c, c.longueur);
  proche(p.x, 5); proche(p.y, -5); proche(p.cap, 0);
  proche(c.longueur, 5 * Math.PI / 2);
  proche(courbureA(c, 1), 1 / 5);
});

test("virage à gauche de 90° depuis le nord : vers l'ouest", () => {
  const c = trajet(0, 0, -90).virage(5, -90).fin();
  const p = pointA(c, c.longueur);
  proche(p.x, -5); proche(p.y, -5); proche(p.cap, -180 * DEG);
  proche(courbureA(c, 1), -1 / 5);
});

test("decaler : décalage latéral exact, cap rétabli, avance exacte", () => {
  const c = trajet(0, 0, -90).decaler(0.6, 6).fin();
  const p = pointA(c, c.longueur);
  proche(p.x, 0.6, 1e-9); proche(p.y, -6, 1e-9); proche(p.cap, -90 * DEG, 1e-9);
  assert.equal(c.segments.length, 2);
  assert.ok(c.segments[0].premier && c.segments[0].decalage && !c.segments[1].premier && c.segments[1].decalage);
});

test("tournerChemin : la fin du trajet tourné est la fin tournée", () => {
  const c = trajet(10, 20, -90).droit(3).virage(4, 90).fin();
  const t = tournerChemin(c, 0, 0, 90);
  const fin = pointA(c, c.longueur), finT = pointA(t, t.longueur);
  const [x, y] = tournerPoint([fin.x, fin.y], 0, 0, 90);
  proche(finT.x, x); proche(finT.y, y); proche(finT.cap, fin.cap + 90 * DEG);
});

test("premiereAbscisse et avant", () => {
  const c = trajet(0, 0, 0).droit(20).fin();
  proche(premiereAbscisse(c, (p) => avant("voiture", p).x >= 10), 7.75, 0.011);
  assert.equal(premiereAbscisse(c, () => false), null);
});

test("chronologie : vitesse constante, départ arrêté, pause, erreurs", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  proche(chronologie(c, [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }]).duree, 10, 1e-9);
  proche(chronologie(c, [{ s: 0, kmh: 0 }, { s: 100, kmh: 72 }]).duree, 10, 1e-9);
  proche(chronologie(c, [{ s: 0, kmh: 36 }, { s: 50, kmh: 0, pause: 3 }, { s: 100, kmh: 36 }]).duree, 23, 1e-9);
  assert.throws(() => chronologie(c, [{ s: 0, kmh: 0 }, { s: 100, kmh: 0 }]), /vitesse nulle/);
  assert.throws(() => chronologie(c, [{ s: 0, kmh: 30 }, { s: 90, kmh: 30 }]), /profil finit/);
  assert.throws(() => chronologie(c, [{ s: 0, kmh: 30 }, { s: 50, kmh: 10, pause: 2 }, { s: 100, kmh: 30 }]), /pause exige/);
});

test("etatA et tempsAtteint", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const ch = chronologie(c, [{ s: 0, kmh: 36 }, { s: 50, kmh: 0, pause: 3 }, { s: 100, kmh: 36 }]);
  proche(tempsAtteint(ch, 50), 10, 1e-6);
  const pendant = etatA(ch, 11.5);
  proche(pendant.s, 50, 1e-9); proche(pendant.v, 0, 1e-9);
  proche(etatA(ch, 5).a, -1, 1e-3);
  proche(etatA(ch, 5).s, 37.5, 1e-3);
  proche(etatA(ch, 1000).s, 100);
});

test("emprise : rectangle orienté, flanc droit vers +y en roulant vers l'est", () => {
  const e = emprise("voiture", { x: 0, y: 0, cap: 0 });
  assert.deepEqual(e.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]),
    [[2.25, -0.9], [2.25, 0.9], [-2.25, 0.9], [-2.25, -0.9]]);
});

test("polygones : chevauchement, contact, inclusion, séparation", () => {
  const a = rectangle(0, 0, 2, 2);
  assert.ok(polygonesSeChevauchent(a, rectangle(1, 1, 3, 3)));
  assert.ok(polygonesSeChevauchent(a, rectangle(2, 0, 4, 2)));
  assert.ok(polygonesSeChevauchent(a, rectangle(0.5, 0.5, 1, 1)));
  assert.ok(!polygonesSeChevauchent(a, rectangle(2.01, 0, 4, 2)));
  assert.ok(pointDansPolygone([1, 1], a));
  assert.ok(!pointDansPolygone([3, 1], a));
});

test("disque circonscrit, arcs et secteur d'anneau", () => {
  for (const [x, y] of disque(0, 0, 8)) assert.ok(Math.hypot(x, y) >= 8 - 1e-9);
  const arc = pointsArc(0, 0, 10, 180, 90);
  proche(arc[0][0], -10); proche(arc[arc.length - 1][1], 10);
  const milieu = arc[Math.floor(arc.length / 2)];
  assert.ok(milieu[0] < 0 && milieu[1] > 0, "le plus court chemin passe par 135°");
  const zone = secteurAnneau(0, 0, 8, 14, 40, 125);
  assert.ok(pointDansPolygone([11 * Math.cos(80 * DEG), 11 * Math.sin(80 * DEG)], zone));
  assert.ok(!pointDansPolygone([11 * Math.cos(10 * DEG), 11 * Math.sin(10 * DEG)], zone));
});

test("preparerScene et etatActeur : étapes, durée, visibilité, clignotant", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const sc = preparerScene({
    code: "essai",
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }],
        clignotant: [{ cote: "droite", de: 20, a: 40 }] },
      { id: "autre", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }], depart: 4 },
    ],
    etapes: [{ s: 0 }, { s: 50 }, { s: 50, delai: 2 }],
  });
  assert.deepEqual(sc.etapes.map((e) => Math.round(e.t * 1000) / 1000), [0, 5, 7]);
  proche(sc.duree, 15);
  assert.equal(etatActeur(sc.acteurs[1], 3).visible, false);
  assert.equal(etatActeur(sc.acteurs[1], 4).visible, true);
  assert.equal(etatActeur(sc.acteurs[0], 3).clignotant, "droite");
  assert.equal(etatActeur(sc.acteurs[0], 5).clignotant, null);
  assert.throws(() => preparerScene({ code: "x", acteurs: [], etapes: [] }), /eleve/);
});
