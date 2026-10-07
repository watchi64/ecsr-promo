import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEG, trajet, pointA, courbureA, tournerChemin, tournerPoint, premiereAbscisse, avant,
  chronologie, etatA, tempsAtteint, emprise, rectangle, pointsArc, disque, secteurAnneau,
  pointDansPolygone, segmentsSeCoupent, polygonesSeChevauchent, preparerScene, etatActeur,
  apparitionDe, sortDuCadre, pointSurSegment, rebroussements,
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

test("etatActeur : v et a nulles avant le départ ; après la fin, l'élève garde sa vitesse finale, les autres s'arrêtent", () => {
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
  // Après la fin de la chronologie, chacun est resté à l'arrivée (s = 100) et n'accélère plus.
  // Un autre acteur est à l'arrêt (ici, un véhicule sorti du cadre, donc invisible).
  for (const t of [14.01, 20, 1000]) {
    const e = etatActeur(autre, t);
    assert.equal(e.v, 0, `autre : v à t = ${t}`);
    assert.equal(e.a, 0, `autre : a à t = ${t}`);
    proche(e.s, 100);
  }
  // L'élève garde sa vitesse finale (10 m/s) jusqu'à la fin de la scène et au-delà : la fin tient
  // l'image, et sous 0,05 m/s le moteur allumerait les feux stop sur cette image tenue.
  for (const t of [10.01, 12, sc.duree, 1000]) {
    const e = etatActeur(eleve, t);
    proche(e.v, 10);
    assert.equal(e.a, 0, `élève : a à t = ${t}`);
    proche(e.s, 100);
  }
});

test("etatActeur : l'élève à départ différé est immobile avant de partir, puis garde sa vitesse finale", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const sc = preparerScene({
    code: "essai",
    acteurs: [{ id: "eleve", role: "eleve", gabarit: "voiture", chemin: c,
      profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }], depart: 3 }],
    etapes: [{ s: 0 }],
  });
  const eleve = sc.acteurs[0];
  // Avant le départ, la chronologie interpole v de 0 à 10 m/s : le rôle n'y change rien.
  for (const t of [0, 1, 2.999]) {
    const e = etatActeur(eleve, t);
    assert.equal(e.v, 0, `v à t = ${t}`);
    assert.equal(e.a, 0, `a à t = ${t}`);
    assert.equal(e.s, 0, `s à t = ${t}`);
  }
  proche(etatActeur(eleve, 3).v, 10);
  // La fin tombe à t = 13 (3 s d'attente, 10 s de route), puis la tenue dure jusqu'à sc.duree = 14.
  for (const t of [13.01, 14, 1000]) {
    const e = etatActeur(eleve, t);
    proche(e.v, 10);
    assert.equal(e.a, 0, `a à t = ${t}`);
    proche(e.s, 100);
  }
  proche(sc.duree, 14);
});

test("etatActeur : sortie du cadre selon la vitesse finale, le rôle et le gabarit", () => {
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
  // Un véhicule autre que l'élève qui finit en mouvement quitte le cadre à la fin de sa chronologie.
  const fin = croisement.chrono.duree;
  assert.equal(visible(croisement, fin / 2), true, "croisement visible en route");
  assert.equal(visible(croisement, fin - 0.01), true, "croisement visible juste avant la fin");
  assert.equal(visible(croisement, fin), true, "croisement visible au dernier instant");
  assert.equal(visible(croisement, fin + 0.01), false, "croisement sorti du cadre juste après la fin");
  assert.equal(visible(croisement, fin + 100), false, "croisement sorti du cadre longtemps après");
  // Un piéton qui finit en marchant s'arrête au bout de son trajet : il ne quitte jamais l'image.
  const finMarche = marcheur.chrono.duree;
  for (const t of [finMarche / 2, finMarche - 0.01, finMarche, finMarche + 0.01, finMarche + 100, sc.duree]) {
    assert.equal(visible(marcheur, t), true, `marcheur visible à t = ${t}`);
  }
  for (const t of [finMarche + 0.01, finMarche + 100, sc.duree]) {
    const e = etatActeur(marcheur, t);
    assert.equal(e.v, 0, `marcheur arrêté à t = ${t}`);
    proche(e.s, 100);
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

test("sortDuCadre : vrai seulement pour un véhicule autre que l'élève dont le trajet finit en mouvement", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const roule = [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }];
  const sc = preparerScene({
    code: "essai",
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin: c, profil: roule },
      { id: "croisement", gabarit: "voiture", chemin: c, profil: roule },
      { id: "ralenti", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 0.1 }] },
      { id: "gare", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 0 }] },
      { id: "marcheur", gabarit: "pieton", chemin: c, profil: [{ s: 0, kmh: 5 }, { s: 100, kmh: 5 }] },
      { id: "garee", gabarit: "voiture", pose: { x: 30, y: 4, cap: 0 } },
    ],
    etapes: [{ s: 0 }],
  });
  const [eleve, croisement, ralenti, gare, marcheur, garee] = sc.acteurs;
  assert.equal(sortDuCadre(croisement), true, "véhicule qui finit en mouvement");
  assert.equal(sortDuCadre(ralenti), true, "même très lent, il roule encore à la fin");
  assert.equal(sortDuCadre(eleve), false, "l'élève, qui finit pourtant en mouvement");
  assert.equal(sortDuCadre(marcheur), false, "piéton qui finit en marchant");
  assert.equal(sortDuCadre(gare), false, "véhicule qui finit à l'arrêt");
  assert.equal(sortDuCadre(garee), false, "acteur fixe (pose)");
  // Un acteur pas encore préparé n'a pas de chronologie : il ne sort pas.
  assert.equal(sortDuCadre({ gabarit: "voiture", chemin: c, profil: roule }), false);
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

test("apparitionDe : valeur explicite, sinon « debut » pour un piéton et « depart » pour un véhicule", () => {
  assert.equal(apparitionDe({ gabarit: "voiture" }), "depart");
  assert.equal(apparitionDe({ gabarit: "pieton" }), "debut");
  // Une valeur explicite l'emporte dans les deux sens.
  assert.equal(apparitionDe({ gabarit: "voiture", apparition: "debut" }), "debut");
  assert.equal(apparitionDe({ gabarit: "pieton", apparition: "depart" }), "depart");
  // Et elle reste la même quand elle coïncide avec le défaut.
  assert.equal(apparitionDe({ gabarit: "voiture", apparition: "depart" }), "depart");
  assert.equal(apparitionDe({ gabarit: "pieton", apparition: "debut" }), "debut");
});

test("etatActeur : clignotant gauche et droit, bornes de l'intervalle comprises ; clignotantDepuis, instant d'allumage de l'intervalle en cours", () => {
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
  // Deux intervalles successifs : chacun compte depuis son propre allumage (s = 10 à t = 1, s = 60 à t = 6), jusqu'à sa
  // borne de fin comprise ; clignotant éteint, avant, entre et après : null.
  for (const t of [0.5, 4, 9]) assert.equal(etatActeur(eleve, t).clignotantDepuis, null, `t = ${t} s`);
  for (const t of [1, 1.5, 2]) proche(etatActeur(eleve, t).clignotantDepuis, 1);
  for (const t of [6, 7, 8]) proche(etatActeur(eleve, t).clignotantDepuis, 6);
});

test("etatActeur : clignotantDepuis tenu pendant un arrêt, intervalles contigus de côtés différents, départ différé, acteur fixe", () => {
  const c = trajet(0, 0, 0).droit(100).fin();
  const sc = preparerScene({
    code: "essai",
    acteurs: [
      // 10 m/s jusqu'à s = 30 (t = 3), arrêt en s = 40 (t = 5) tenu 2 s, reprise jusqu'à 10 m/s en s = 60 (t = 11), puis 10 m/s.
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin: c,
        profil: [{ s: 0, kmh: 36 }, { s: 30, kmh: 36 }, { s: 40, kmh: 0, pause: 2 }, { s: 60, kmh: 36 }, { s: 100, kmh: 36 }],
        clignotant: [{ cote: "gauche", de: 35, a: 50 }, { cote: "droite", de: 50, a: 70 }] },
      // Parti à t = 4, à 10 m/s : en s = 20 à t = 6.
      { id: "autre", gabarit: "voiture", chemin: c, profil: [{ s: 0, kmh: 36 }, { s: 100, kmh: 36 }], depart: 4,
        clignotant: [{ cote: "droite", de: 20, a: 40 }] },
      { id: "fixe", gabarit: "voiture", pose: { x: 50, y: 10, cap: 0 } },
    ],
    etapes: [{ s: 0 }],
  });
  const [eleve, autre, fixe] = sc.acteurs;
  // Gauche allumé en s = 35, pendant le freinage (t = 5 - √2) ; l'arrêt ne le rallume pas : pendant l'arrêt et à la
  // reprise, il compte toujours depuis cet instant.
  const tGauche = 5 - Math.SQRT2, tDroite = 7 + Math.sqrt(8);
  const attendu = [[3, null, null], [4, "gauche", tGauche], [6, "gauche", tGauche], [9, "gauche", tGauche],
    [10, "droite", tDroite], [11.5, "droite", tDroite], [13, null, null]];
  for (const [t, cote, depuis] of attendu) {
    const e = etatActeur(eleve, t);
    assert.equal(e.clignotant, cote, `t = ${t} s`);
    if (depuis === null) assert.equal(e.clignotantDepuis, null, `t = ${t} s`);
    else proche(e.clignotantDepuis, depuis);
  }
  // Le droit, contigu au gauche (s = 50, t = 7 + √8), a son propre allumage. Départ différé : l'instant est celui de la
  // scène, départ compris.
  proche(etatActeur(autre, 7).clignotantDepuis, 6);
  assert.equal(etatActeur(autre, 5).clignotantDepuis, null);
  // Acteur fixe : jamais de clignotant.
  assert.equal(etatActeur(fixe, 3).clignotant, null);
  assert.equal(etatActeur(fixe, 3).clignotantDepuis, null);
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
  // Un secteur qui franchit 0 écrit avec des angles de 0 à 360 est refusé : le message dit comment le réécrire.
  assert.throws(
    () => secteurAnneau(0, 0, 8, 14, 350, 10),
    (e) => /180/.test(e.message) && /-10 et 10 plutôt que 350 et 10/.test(e.message),
  );
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

// ===== Marche arrière : rebroussement, caisse et sens de marche =====

test("inverser : rebroussement sur place, caisse continue, marche arrière ensuite", () => {
  const ch = trajet(0, 0, 0).droit(5).inverser().droit(3).fin();
  assert.equal(ch.segments.length, 2);
  assert.equal(ch.segments[0].arriere, false);
  assert.equal(ch.segments[1].arriere, true);
  const avantRebroussement = pointA(ch, 5 - 1e-6), apres = pointA(ch, 6);
  // La voiture a avancé de 5 m vers +x, puis recule de 1 m : elle est en x = 4, caisse toujours vers +x.
  assert.ok(Math.abs(apres.x - 4) < 1e-9 && Math.abs(apres.y) < 1e-9);
  assert.ok(Math.abs(avantRebroussement.cap - apres.cap) < 1e-9);
  assert.ok(Math.abs(apres.capMarche - Math.PI) < 1e-9);
  assert.deepEqual(rebroussements(ch), [5]);
});

test("inverser deux fois : retour en marche avant", () => {
  const ch = trajet(0, 0, 0).droit(4).inverser().droit(2).inverser().droit(3).fin();
  assert.deepEqual(ch.segments.map((s) => s.arriere), [false, true, false]);
  assert.deepEqual(rebroussements(ch), [4, 6]);
  assert.ok(Math.abs(pointA(ch, 9).x - 5) < 1e-9);
});

test("marche arrière en virage : volant à droite, la caisse suit, l'avant reste à l'opposé du déplacement", () => {
  // Caisse vers le nord (cap -90), 1 m en avant, puis recul : la tortue (sens de marche, vers le sud) tourne à
  // gauche de 90 degrés sur 5 m de rayon, l'arrière part donc vers la droite de la caisse (l'est).
  const ch = trajet(0, 0, -90).droit(1).inverser().virage(5, -90).fin();
  const p = pointA(ch, ch.longueur);
  assert.ok(Math.abs(p.x - 5) < 1e-9 && Math.abs(p.y - 4) < 1e-9);
  assert.ok(Math.abs(Math.abs(p.cap) - Math.PI) < 1e-9);   // caisse vers l'ouest
  assert.ok(Math.abs(p.capMarche) < 1e-9);                 // déplacement vers l'est
  const f = avant("voiture", p);
  assert.ok(Math.abs(f.x - 2.75) < 1e-9 && Math.abs(f.y - 4) < 1e-9);
});

test("marche arrière en virage, volant à gauche : l'arrière part vers la gauche de la caisse", () => {
  // Caisse vers le nord, 1 m en avant, puis recul : la tortue (vers le sud) tourne à droite de 90 degrés sur 5 m de
  // rayon, l'arrière part donc vers la gauche de la caisse (l'ouest), et la caisse finit vers l'est.
  const ch = trajet(0, 0, -90).droit(1).inverser().virage(5, 90).fin();
  const p = pointA(ch, ch.longueur);
  proche(p.x, -5, 1e-9); proche(p.y, 4, 1e-9);
  proche(p.cap, 0, 1e-9);               // caisse vers l'est
  proche(p.capMarche, Math.PI, 1e-9);   // déplacement vers l'ouest
  const f = avant("voiture", p);
  proche(f.x, -2.75, 1e-9); proche(f.y, 4, 1e-9);
});

test("decaler en recul : un décalage positif écarte la voiture vers la gauche de la caisse", () => {
  // Caisse vers l'est : 1 m en avant, puis 10 m de recul vers l'ouest avec un décalage de +1 m, à droite de la tortue
  // (le nord), donc à gauche de la caisse.
  const ch = trajet(0, 0, 0).droit(1).inverser().decaler(1, 10).fin();
  const p = pointA(ch, ch.longueur);
  proche(p.x, -9, 1e-9); proche(p.y, -1, 1e-9);
  proche(p.cap, 0, 1e-9);   // caisse toujours vers l'est
  assert.equal(p.arriere, true);
});

test("etatActeur donne la marche, arrière dès le rebroussement", () => {
  const chemin = trajet(0, 0, 0).droit(5).inverser().droit(3).fin();
  const acteur = { id: "v", role: "eleve", gabarit: "voiture", chemin,
    profil: [{ s: 0, kmh: 0 }, { s: 2.5, kmh: 5 }, { s: 5, kmh: 0, pause: 1 }, { s: 6.5, kmh: 4 }, { s: 8, kmh: 0 }] };
  acteur.chrono = chronologie(chemin, acteur.profil);
  const tRebroussement = tempsAtteint(acteur.chrono, 5);
  assert.equal(etatActeur(acteur, tRebroussement - 0.5).marche, "avant");
  assert.equal(etatActeur(acteur, tRebroussement + 0.5).marche, "arriere");
  const fin = etatActeur(acteur, acteur.chrono.duree);
  assert.ok(Math.abs(fin.x - 2) < 1e-9);
  assert.ok(Math.abs(fin.cap) < 1e-9);   // la caisse regarde toujours vers +x
});

test("départ directement en marche arrière", () => {
  const ch = trajet(0, 0, 90, { arriere: true }).droit(4).fin();
  const p = pointA(ch, 4);
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y - 4) < 1e-9);
  assert.ok(Math.abs(p.cap + Math.PI / 2) < 1e-9);   // caisse vers le nord
  assert.equal(p.arriere, true);
  assert.deepEqual(rebroussements(ch), []);
});

test("à l'abscisse du rebroussement, le point est déjà dans la nouvelle marche, au même endroit", () => {
  const ch = trajet(0, 0, 0).droit(5).inverser().droit(3).fin();
  const juste = pointA(ch, 5 - 1e-9), sur = pointA(ch, 5);
  assert.equal(juste.arriere, false);
  assert.equal(sur.arriere, true);
  proche(sur.x, 5, 1e-12); proche(sur.y, 0, 1e-12);
  proche(sur.cap, 0, 1e-12); proche(sur.capMarche, Math.PI, 1e-12);
});

test("départ en marche arrière puis rebroussement : marche avant ensuite, sans que la caisse pivote", () => {
  const ch = trajet(0, 0, 90, { arriere: true }).droit(4).inverser().droit(2).fin();
  assert.deepEqual(ch.segments.map((s) => s.arriere), [true, false]);
  assert.deepEqual(rebroussements(ch), [4]);
  // Caisse vers le nord tout du long : la voiture recule vers le sud jusqu'en y = 4, puis repart vers le nord.
  const recul = pointA(ch, 4 - 1e-6), reprise = pointA(ch, 5);
  proche(recul.cap, -Math.PI / 2, 1e-9); proche(reprise.cap, -Math.PI / 2, 1e-9);
  proche(reprise.capMarche, -Math.PI / 2, 1e-9);
  assert.equal(reprise.arriere, false);
  proche(reprise.x, 0, 1e-9); proche(reprise.y, 3, 1e-9);
  proche(pointA(ch, ch.longueur).y, 2, 1e-9);
});

test("la caisse ne pivote pas au rebroussement, quel que soit le cap atteint : pas même d'un tour", () => {
  for (const { chemin, capCaisse, finX, finY } of [
    // Cas du relecteur : quart de tour à gauche depuis le nord, caisse vers l'ouest (-180 degrés), puis 2 m de recul
    // vers l'est.
    { chemin: trajet(0, 0, -90).virage(5, -90).inverser().droit(2).fin(), capCaisse: -Math.PI, finX: -3, finY: -5 },
    // Trois quarts de tour à gauche depuis l'est : caisse vers le sud (-270 degrés), puis 2 m de recul vers le nord.
    { chemin: trajet(0, 0, 0).virage(5, -270).inverser().droit(2).fin(), capCaisse: -3 * Math.PI / 2, finX: -5, finY: -7 },
  ]) {
    const [sRebroussement] = rebroussements(chemin);
    const juste = pointA(chemin, sRebroussement - 1e-9), sur = pointA(chemin, sRebroussement);
    const fin = pointA(chemin, chemin.longueur);
    for (const p of [juste, sur, fin]) proche(p.cap, capCaisse, 1e-9);
    proche(sur.capMarche, capCaisse + Math.PI, 1e-9);
    assert.equal(sur.arriere, true);
    proche(fin.x, finX, 1e-9); proche(fin.y, finY, 1e-9);
  }
});

test("le cap de la caisse est continu tout le long d'un trajet qui recule puis repart, sans saut d'un tour", () => {
  // Trois quarts de tour en avant, quart de tour en recul, puis 200 degrés en avant : chaque marche franchit un multiple
  // de 180 degrés. Sur 1 cm, la caisse tourne au plus de 1 cm / 5 m (le plus petit rayon), rebroussements compris.
  const ch = trajet(0, 0, 0).virage(5, -270).inverser().virage(5, 90).inverser().virage(6, -200).droit(1).fin();
  assert.equal(rebroussements(ch).length, 2);
  const pas = 0.01, rotationMax = pas / 5 + 1e-9;
  let precedent = pointA(ch, 0);
  for (let k = 1; k * pas <= ch.longueur; k++) {
    const p = pointA(ch, k * pas);
    assert.ok(Math.abs(p.cap - precedent.cap) <= rotationMax,
      `la caisse tourne de ${p.cap - precedent.cap} rad sur 1 cm, en s = ${(k * pas).toFixed(2)} m`);
    precedent = p;
  }
  proche(precedent.cap, -3 * Math.PI / 2 + Math.PI / 2 - 200 * DEG, 1e-9);
});

test("fin() mémorise les rebroussements, les mêmes que rebroussements() lit sur les segments", () => {
  const ch = trajet(0, 0, 0).droit(4).inverser().virage(6, 30).inverser().droit(3).inverser().droit(1).fin();
  const arc = 6 * 30 * DEG;
  assert.equal(ch.rebroussements.length, 3);
  [4, 4 + arc, 7 + arc].forEach((s, i) => proche(ch.rebroussements[i], s, 1e-12));
  assert.deepEqual(rebroussements(ch), ch.rebroussements);
  assert.deepEqual(ch.segments.map((s) => s.arriere), [false, true, false, true]);
  // La fonction fait foi : un chemin recopié sans le champ (comme le fait raccourcirDebut) garde ses rebroussements.
  assert.deepEqual(rebroussements({ segments: ch.segments, longueur: ch.longueur }), ch.rebroussements);
  // Un trajet sans rebroussement n'en a aucun.
  assert.deepEqual(trajet(0, 0, 0).droit(4).fin().rebroussements, []);
});

test("rebroussement refusé en tête de trajet, sans segment avant lui : partir en marche arrière se dit par l'option", () => {
  for (const depart of [trajet(0, 0, 0), trajet(0, 0, 90, { arriere: true })]) {
    assert.throws(() => depart.inverser(), (e) => /en tête de trajet/.test(e.message) && /\{ arriere: true \}/.test(e.message));
  }
});

test("deux rebroussements de suite sont refusés (rebroussement vide) ; un segment entre eux suffit", () => {
  assert.throws(() => trajet(0, 0, 0).droit(5).inverser().inverser(), /rebroussement vide/);
  assert.doesNotThrow(() => trajet(0, 0, 0).droit(5).inverser().droit(0.5).inverser().droit(1).fin());
});

test("un trajet qui finit sur un rebroussement est refusé : aucun segment ne le parcourt", () => {
  assert.throws(() => trajet(0, 0, 0).droit(5).inverser().fin(), /finit sur un rebroussement/);
});

test("l'option arriere attend un booléen", () => {
  for (const valeur of ["oui", 1, null]) {
    assert.throws(() => trajet(0, 0, 0, { arriere: valeur }), /arriere.*booléen/, `arriere = ${String(valeur)}`);
  }
  assert.equal(pointA(trajet(0, 0, 0, {}).droit(1).fin(), 0).arriere, false);
  assert.equal(pointA(trajet(0, 0, 0, { arriere: false }).droit(1).fin(), 0).arriere, false);
});

test("une option de segment arriere est refusée : la marche se règle au départ et par inverser()", () => {
  for (const [nom, poserSegment] of [
    ["droit", (t) => t.droit(3, { arriere: true })],
    ["virage", (t) => t.virage(5, 90, { arriere: false })],
    ["decaler", (t) => t.decaler(1, 10, { arriere: true })],
  ]) {
    assert.throws(() => poserSegment(trajet(0, 0, 0)),
      (e) => /segment/.test(e.message) && /arriere/.test(e.message) && /inverser/.test(e.message), nom);
  }
});

test("courbureA reste dans le repère de marche : un recul où la tortue tourne à gauche a une courbure négative", () => {
  const ch = trajet(0, 0, -90).droit(1).inverser().virage(5, -90).fin();
  assert.equal(courbureA(ch, 0.5), 0);
  assert.equal(courbureA(ch, 3), -1 / 5);
  // Le même arc parcouru en marche avant a la même courbure.
  assert.equal(courbureA(trajet(0, -1, 90).virage(5, -90).fin(), 2), -1 / 5);
});

test("emprise et avant suivent la caisse : en recul, l'avant reste du côté opposé au déplacement", () => {
  const ch = trajet(0, 0, 0).droit(5).inverser().droit(3).fin();
  const p = pointA(ch, 6);   // recule vers -x, en x = 4 ; caisse vers +x
  assert.deepEqual(emprise("voiture", p).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]),
    [[6.25, -0.9], [6.25, 0.9], [1.75, 0.9], [1.75, -0.9]]);
  const f = avant("voiture", p);
  proche(f.x, 6.25, 1e-9); proche(f.y, 0, 1e-9);
});

test("etatActeur rend aussi le cap de marche ; un acteur fixe est en marche avant", () => {
  const chemin = trajet(0, 0, 0).droit(5).inverser().droit(3).fin();
  const profil = [{ s: 0, kmh: 0 }, { s: 2.5, kmh: 5 }, { s: 5, kmh: 0, pause: 1 }, { s: 6.5, kmh: 4 }, { s: 8, kmh: 0 }];
  const acteur = { id: "v", role: "eleve", gabarit: "voiture", chemin, profil, chrono: chronologie(chemin, profil) };
  const tRebroussement = tempsAtteint(acteur.chrono, 5);
  const enAvant = etatActeur(acteur, tRebroussement - 0.5), enRecul = etatActeur(acteur, tRebroussement + 1.5);
  proche(enAvant.cap, 0, 1e-12); proche(enAvant.capMarche, 0, 1e-12);
  assert.ok(enRecul.s > 5 && enRecul.v > 0, "en mouvement, en recul");
  proche(enRecul.cap, 0, 1e-12); proche(enRecul.capMarche, Math.PI, 1e-12);
  const garee = etatActeur({ id: "garee", gabarit: "voiture", pose: { x: 3, y: 4, cap: 90 } }, 2);
  assert.equal(garee.marche, "avant");
  proche(garee.cap, Math.PI / 2, 1e-12);
  assert.equal(garee.capMarche, garee.cap);
});

test("tournerChemin garde la marche de chaque segment et les rebroussements", () => {
  const c = trajet(0, 0, 0).droit(5).inverser().droit(3).fin();
  const t = tournerChemin(c, 0, 0, 90);
  assert.deepEqual(t.segments.map((s) => s.arriere), [false, true]);
  assert.deepEqual(t.rebroussements, [5]);
  assert.deepEqual(rebroussements(t), [5]);
  const p = pointA(t, 6), q = pointA(c, 6);
  proche(p.x, 0, 1e-9); proche(p.y, 4, 1e-9);
  // Caisse et marche tournées d'un quart de tour, sans saut d'un tour : la caisse vers le sud, la voiture recule vers
  // le nord (3π/2, soit -π/2 à un tour près).
  proche(p.cap, q.cap + Math.PI / 2, 1e-12); proche(p.cap, Math.PI / 2, 1e-12);
  proche(p.capMarche, q.capMarche + Math.PI / 2, 1e-12);
  assert.equal(p.arriere, true);
});

test("sans rebroussement, rien ne change : marche avant partout, aucun rebroussement, caps de la tortue gardés tels quels", () => {
  // Le virage à gauche du pilote : 3 m vers le nord, décalage de 0,60 m vers la gauche sur 12 m, quart de tour à gauche
  // de 4,1 m de rayon (centre en (-4,7 ; -15)), puis 5 m vers l'ouest. Il finit au cap -180 degrés et le garde.
  const ch = trajet(0, 0, -90).droit(3).decaler(-0.6, 12).virage(4.1, -90).droit(5).fin();
  assert.ok(ch.segments.every((seg) => seg.arriere === false));
  assert.deepEqual(ch.rebroussements, []);
  assert.deepEqual(rebroussements(ch), []);
  const arc = ch.segments.find((seg) => seg.type === "arc" && !seg.decalage);
  const milieu = pointA(ch, arc.debut + arc.longueur / 2);
  proche(milieu.x, -4.7 + 4.1 * Math.SQRT1_2, 1e-9); proche(milieu.y, -15 - 4.1 * Math.SQRT1_2, 1e-9);
  proche(milieu.cap, -3 * Math.PI / 4, 1e-9);
  const fin = pointA(ch, ch.longueur);
  proche(fin.x, -9.7, 1e-9); proche(fin.y, -19.1, 1e-9);
  const der = ch.segments[ch.segments.length - 1];
  assert.equal(fin.cap, pointSurSegment(der, der.longueur).cap);
  proche(fin.cap, -Math.PI, 1e-12);
});
