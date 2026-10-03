import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEG, trajet, pointA, courbureA, tournerChemin, tournerPoint, premiereAbscisse, avant,
  chronologie, etatA, tempsAtteint, emprise, rectangle, pointsArc, disque, secteurAnneau,
  pointDansPolygone, segmentsSeCoupent, polygonesSeChevauchent, preparerScene, etatActeur,
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

// ===== Acteurs figés : immobiles hors de leur trajet, sortie du cadre =====

test("etatActeur : vitesse et accélération nulles avant le départ et après la fin du trajet", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const sc = preparerScene({
    code: "essai",
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }] },
      { id: "autre", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }], depart: 4 },
    ],
    etapes: [{ s: 0 }],
  });
  const [eleve, autre] = sc.acteurs;
  // Avant le départ : la chronologie interpole v de 0 à 10 m/s, mais l'acteur ne bouge pas.
  for (const t of [1, 2, 3.5, 3.999]) {
    const e = etatActeur(autre, t);
    assert.equal(e.v, 0, `v à t = ${t}`);
    assert.equal(e.a, 0, `a à t = ${t}`);
    assert.equal(e.s, 0, `s à t = ${t}`);
  }
  // Au départ et en route : la vitesse du profil.
  proche(etatActeur(autre, 4).v, 10);
  proche(etatActeur(autre, 9).v, 10);
  // Dernier instant du trajet (t = 14) : l'acteur roule encore.
  proche(etatActeur(autre, 14).v, 10);
  proche(etatActeur(autre, 14).s, 100);
  proche(etatActeur(eleve, 10).v, 10);
  // Après la fin de la chronologie : immobile à l'arrivée, vitesse et accélération nulles.
  for (const [acteur, t] of [[autre, 14.01], [autre, 20], [autre, 1000], [eleve, 10.01], [eleve, 12], [eleve, 1000]]) {
    const e = etatActeur(acteur, t);
    assert.equal(e.v, 0, `${acteur.id} : v à t = ${t}`);
    assert.equal(e.a, 0, `${acteur.id} : a à t = ${t}`);
    proche(e.s, 100);
  }
});

test("etatActeur : sortie du cadre selon la vitesse finale et le rôle", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const roule = [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }];
  const sc = preparerScene({
    code: "essai",
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin: c, profil: roule },
      { id: "croisement", gabarit: "voiture", chemin: c, profil: roule },
      { id: "gare", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 0 }] },
      { id: "marcheur", gabarit: "pieton", chemin: c, profil: [{ s: 0, kmh: 5 }, { s: 100, kmh: 5 }] },
    ],
    etapes: [{ s: 0 }],
  });
  const [eleve, croisement, gare, marcheur] = sc.acteurs;
  const visible = (acteur, t) => etatActeur(acteur, t).visible;
  // Un acteur autre que l'élève qui finit en mouvement quitte le cadre à la fin de sa chronologie.
  for (const acteur of [croisement, marcheur]) {
    const fin = acteur.chrono.duree;
    assert.equal(visible(acteur, fin / 2), true, `${acteur.id} visible en route`);
    assert.equal(visible(acteur, fin - 0.01), true, `${acteur.id} visible juste avant la fin`);
    assert.equal(visible(acteur, fin), true, `${acteur.id} visible au dernier instant`);
    assert.equal(visible(acteur, fin + 0.01), false, `${acteur.id} sorti du cadre juste après la fin`);
    assert.equal(visible(acteur, fin + 100), false, `${acteur.id} sorti du cadre longtemps après`);
  }
  // Celui qui finit à l'arrêt reste visible.
  for (const t of [5, gare.chrono.duree, gare.chrono.duree + 0.01, gare.chrono.duree + 100]) {
    assert.equal(visible(gare, t), true, `gare visible à t = ${t}`);
  }
  // L'élève reste visible jusqu'à la fin de la scène, même en finissant en mouvement.
  for (const t of [5, eleve.chrono.duree, eleve.chrono.duree + 0.01, sc.duree]) {
    assert.equal(visible(eleve, t), true, `élève visible à t = ${t}`);
  }
});

test("etatActeur : piéton à départ différé visible et immobile avant ; apparition explicite", () => {
  const c = trajet(0, 0, 0).droit(20).fin();
  const marche = [{ s: 0, kmh: 5 }, { s: 20, kmh: 5 }];
  const sc = preparerScene({
    code: "essai",
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 20, kmh: 36 }] },
      { id: "pieton", gabarit: "pieton", chemin: c, profil: marche, depart: 5 },
      { id: "pieton_tardif", gabarit: "pieton", chemin: c, profil: marche, depart: 5, apparition: "depart" },
      { id: "voiture_en_attente", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 20, kmh: 36 }],
        depart: 5, apparition: "debut" },
    ],
    etapes: [{ s: 0 }],
  });
  const [, pieton, tardif, enAttente] = sc.acteurs;
  for (const t of [0, 2, 4.999]) {
    const e = etatActeur(pieton, t);
    assert.equal(e.visible, true, `piéton visible à t = ${t}`);
    assert.equal(e.v, 0, `piéton immobile à t = ${t}`);
    assert.equal(e.a, 0);
    assert.equal(e.s, 0);
    assert.equal(etatActeur(tardif, t).visible, false, `apparition « depart » : invisible à t = ${t}`);
    assert.equal(etatActeur(enAttente, t).visible, true, `apparition « debut » : visible à t = ${t}`);
  }
  assert.equal(etatActeur(tardif, 5).visible, true);
  proche(etatActeur(pieton, 6).v, 5 / 3.6, 1e-6);
});

test("etatActeur : clignotant gauche et droit, bornes de l'intervalle comprises", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const sc = preparerScene({
    code: "essai",
    acteurs: [{
      id: "eleve", role: "eleve", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }],
      clignotant: [{ cote: "droite", de: 10, a: 20 }, { cote: "gauche", de: 60, a: 80 }],
    }],
    etapes: [{ s: 0 }],
  });
  const eleve = sc.acteurs[0];
  // v = 10 m/s : l'abscisse vaut dix fois l'instant.
  assert.equal(etatActeur(eleve, 0.5).clignotant, null);
  assert.equal(etatActeur(eleve, 1.5).clignotant, "droite");
  assert.equal(etatActeur(eleve, 4).clignotant, null);
  assert.equal(etatActeur(eleve, 6).clignotant, "gauche");
  assert.equal(etatActeur(eleve, 7).clignotant, "gauche");
  assert.equal(etatActeur(eleve, 8).clignotant, "gauche");
  assert.equal(etatActeur(eleve, 9).clignotant, null);
});

// ===== Secteur d'anneau =====

test("secteurAnneau : contient son milieu, jamais le centre, quel que soit le sens des angles", () => {
  const polaire = (r, aDeg) => [r * Math.cos(aDeg * DEG), r * Math.sin(aDeg * DEG)];
  const zone = secteurAnneau(0, 0, 8, 14, 40, 125);
  assert.ok(pointDansPolygone(polaire(11, 80), zone));
  assert.ok(!pointDansPolygone(polaire(11, 10), zone));
  assert.ok(!pointDansPolygone([0, 0], zone));
  // Presque un demi-cercle : les deux arcs courent dans la même moitié du plan.
  const large = secteurAnneau(0, 0, 8, 14, 0, 179);
  assert.ok(pointDansPolygone(polaire(11, 90), large));
  assert.ok(pointDansPolygone(polaire(11, 5), large));
  assert.ok(pointDansPolygone(polaire(11, 175), large));
  assert.ok(!pointDansPolygone(polaire(11, 270), large));
  assert.ok(!pointDansPolygone([0, 0], large));
  assert.ok(large.every(([, y]) => y >= -1e-9), "tous les sommets dans la moitié y >= 0");
  // Les angles donnés à l'envers décrivent le même secteur.
  const envers = secteurAnneau(0, 0, 8, 14, 125, 40);
  assert.ok(pointDansPolygone(polaire(11, 80), envers));
  assert.ok(!pointDansPolygone(polaire(11, 10), envers));
  assert.ok(!pointDansPolygone([0, 0], envers));
});

test("secteurAnneau : polygone simple qui contient tout l'intérieur du secteur et rien d'autre", () => {
  const R0 = 8, R1 = 14;
  for (const [a0, a1, pas] of [[40, 125, 5], [125, 40, 5], [0, 179, 5], [-90, 60, 1], [100, 270, 5], [-10, 10, 5], [10, 170, 90]]) {
    const zone = secteurAnneau(0, 0, R0, R1, a0, a1, pas);
    const n = zone.length;
    // Simple : aucune arête n'en coupe une autre qui ne lui est pas adjacente.
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        assert.ok(!segmentsSeCoupent(zone[i], zone[(i + 1) % n], zone[j], zone[(j + 1) % n]),
          `arêtes ${i} et ${j} sécantes (secteur de ${a0} à ${a1}, pas ${pas})`);
      }
    }
    if (pas > 5) continue;   // approximation trop grossière pour juger les points proches des arcs
    const bas = Math.min(a0, a1), haut = Math.max(a0, a1);
    for (let a = bas - 40; a <= haut + 40; a += 3) {
      for (const r of [3, 7, 9, 11, 13, 15, 20]) {
        const net = (v, de, vers) => v > de + 3 && v < vers - 3;      // franchement entre les bornes
        const dedans = net(a, bas, haut) && r > R0 + 0.5 && r < R1 - 0.5;
        const dehors = a < bas - 3 || a > haut + 3 || r < R0 - 0.5 || r > R1 + 0.5;
        const pt = [r * Math.cos(a * DEG), r * Math.sin(a * DEG)];
        if (dedans) assert.ok(pointDansPolygone(pt, zone), `(${r} m, ${a}°) devrait être dans le secteur de ${a0} à ${a1}`);
        if (dehors) assert.ok(!pointDansPolygone(pt, zone), `(${r} m, ${a}°) devrait être hors du secteur de ${a0} à ${a1}`);
      }
    }
  }
});

test("secteurAnneau : une ouverture nulle ou de 180 degrés et plus est refusée", () => {
  assert.throws(() => secteurAnneau(0, 0, 8, 14, 0, 180), /180/);
  assert.throws(() => secteurAnneau(0, 0, 8, 14, 90, -90), /180/);
  assert.throws(() => secteurAnneau(0, 0, 8, 14, 0, 200), /180/);
  assert.throws(() => secteurAnneau(0, 0, 8, 14, 0, 360), /180/);
  assert.throws(() => secteurAnneau(0, 0, 8, 14, 30, 30), /180/);
  assert.throws(() => secteurAnneau(0, 0, 8, 14, 0, NaN), /180/);
});

// ===== Conventions sur lesquelles reposent le moteur et les contrôles =====

test("disque : polygone circonscrit, les milieux des côtés sont au moins à r du centre", () => {
  for (const pas of [5, 7, 10, 45]) {
    const d = disque(2, -3, 8, pas);
    for (let k = 0; k < d.length; k++) {
      const [x1, y1] = d[k], [x2, y2] = d[(k + 1) % d.length];
      const milieu = Math.hypot((x1 + x2) / 2 - 2, (y1 + y2) / 2 + 3);
      assert.ok(milieu >= 8 - 1e-9, `milieu du côté ${k} à ${milieu} du centre (pas ${pas})`);
    }
  }
});

test("emprise oblique : l'avant coïncide avec avant(), le flanc droit est à droite du cap", () => {
  const p = { x: 3, y: -2, cap: 30 * DEG };
  const e = emprise("voiture", p);
  const av = avant("voiture", p);
  proche((e[0][0] + e[1][0]) / 2, av.x);
  proche((e[0][1] + e[1][1]) / 2, av.y);
  const hx = Math.cos(p.cap), hy = Math.sin(p.cap);
  // Repère local de l'emprise : (a, b) = (long du cap, vers la droite). Les coins b > 0 sont ceux
  // d'indices 1 et 2 de la liste ([L/2, W/2] et [-L/2, W/2]) ; produit vectoriel > 0 = à droite du cap,
  // à l'écran.
  const croix = ([x, y]) => hx * (y - p.y) - hy * (x - p.x);
  for (const k of [1, 2]) assert.ok(croix(e[k]) > 0, `coin ${k} du flanc droit : produit vectoriel ${croix(e[k])}`);
  for (const k of [0, 3]) assert.ok(croix(e[k]) < 0, `coin ${k} du flanc gauche : produit vectoriel ${croix(e[k])}`);
  proche(croix(e[1]), 0.9);
  proche(croix(e[3]), -0.9);
});

test("decaler à gauche : décalage négatif, cap rétabli, braque d'abord à gauche", () => {
  const c = trajet(0, 0, -90).decaler(-0.6, 6).fin();
  const p = pointA(c, c.longueur);
  proche(p.x, -0.6, 1e-9); proche(p.y, -6, 1e-9); proche(p.cap, -90 * DEG, 1e-9);
  assert.ok(c.segments[0].angle < 0 && c.segments[1].angle > 0, "gauche puis droite");
});

test("polygonesSeChevauchent : inclusion dans les deux sens, polygone non convexe en L", () => {
  const grand = rectangle(0, 0, 10, 10), petit = rectangle(4, 4, 6, 6);
  assert.ok(polygonesSeChevauchent(grand, petit));
  assert.ok(polygonesSeChevauchent(petit, grand));
  // L : deux bras de 1 m de large, coude plein en (0, 0), encoche de (1, 1) à (4, 4).
  const L = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
  const encoche = rectangle(2, 2, 3, 3);
  assert.ok(!polygonesSeChevauchent(L, encoche), "dans l'encoche");
  assert.ok(!polygonesSeChevauchent(encoche, L), "dans l'encoche, ordre inverse");
  assert.ok(polygonesSeChevauchent(L, rectangle(2, -1, 3, 2)), "traverse le bras horizontal");
  assert.ok(polygonesSeChevauchent(rectangle(-1, 2, 2, 3), L), "traverse le bras vertical");
  assert.ok(polygonesSeChevauchent(L, rectangle(0.2, 0.2, 0.8, 3.5)), "entièrement dans le bras vertical");
  assert.ok(polygonesSeChevauchent(rectangle(0.2, 0.2, 0.8, 3.5), L), "contient le bras vertical, ordre inverse");
});

// ===== Validation des entrées =====

test("chronologie : une pause présente doit être strictement positive", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  for (const pause of [0, -2, NaN, Infinity, "3", null]) {
    assert.throws(
      () => chronologie(c, [{ s: 0, kmh: 36 }, { s: 50, kmh: 0, pause }, { s: 100, kmh: 36 }]),
      /pause doit être strictement positive/,
      `pause = ${String(pause)}`,
    );
  }
  // Sans pause (champ absent ou undefined) ou avec une vraie pause : accepté.
  assert.doesNotThrow(() => chronologie(c, [{ s: 0, kmh: 36 }, { s: 50, kmh: 0, pause: undefined }, { s: 100, kmh: 36 }]));
  proche(chronologie(c, [{ s: 0, kmh: 36 }, { s: 50, kmh: 0, pause: 0.5 }, { s: 100, kmh: 36 }]).duree, 20.5, 1e-9);
});

test("preparerScene : une apparition inconnue est refusée en nommant l'acteur", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const profil = [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }];
  const avec = (...autres) => ({
    code: "essai",
    acteurs: [{ id: "eleve", role: "eleve", gabarit: "voiture", chemin: c, profil }, ...autres],
    etapes: [{ s: 0 }],
  });
  const scene = (apparition) => avec({ id: "badaud", gabarit: "pieton", chemin: c, profil, apparition });
  for (const inconnue of ["debout", "Depart", "", null, 0]) {
    assert.throws(
      () => preparerScene(scene(inconnue)),
      (e) => /apparition/.test(e.message) && /badaud/.test(e.message) && /essai/.test(e.message),
      `apparition = ${JSON.stringify(inconnue)}`,
    );
  }
  for (const valide of [undefined, "debut", "depart"]) {
    assert.doesNotThrow(() => preparerScene(scene(valide)), `apparition = ${String(valide)}`);
  }
  // Un acteur fixe (pose) est contrôlé comme les autres ; sans id, l'acteur est désigné par son rang.
  assert.throws(
    () => preparerScene(avec({ id: "panneau", pose: { x: 0, y: 0, cap: 0 }, apparition: "partout" })),
    (e) => /panneau/.test(e.message) && /partout/.test(e.message),
  );
  assert.throws(
    () => preparerScene(avec({ gabarit: "pieton", chemin: c, profil, apparition: "tard" })),
    (e) => /n° 2/.test(e.message) && /tard/.test(e.message),
  );
});
