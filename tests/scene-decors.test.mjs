import { test } from "node:test";
import assert from "node:assert/strict";
import { DEG, GABARITS, emprise, pointA, pointDansPolygone, polygonesSeChevauchent, rectangle, tournerPoint } from "../js/scene-geometrie.js";
import { IISR, DESSIN, HORS_MONDE, carrefourEnCroix, giratoire, trajetGiratoire } from "../js/scene-decors.js";

const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} au lieu de ${b}`);
const surTrottoir = (d, p) => d.obstacles.some((o) => o.nature === "trottoir" && pointDansPolygone([p.x, p.y], o.poly));
const etendue = (poly, i) => [Math.min(...poly.map((q) => q[i])), Math.max(...poly.map((q) => q[i]))];   // bornes d'un polygone selon un axe (0 : x, 1 : y)

test("carrefour en croix : monde, centre, voies de 3,5 m", () => {
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 8 }, passages: ["est"] });
  assert.deepEqual(d.monde, { largeur: 37, hauteur: 41 });
  assert.deepEqual(d.centre, { x: 11.5, y: 11.5 });
  const xs = d.voies.sudEntrante.map(([x]) => x);
  assert.equal(Math.min(...xs), 11.5);
  assert.equal(Math.max(...xs), 11.5 + DESSIN.voie);
});

test("carrefour en croix : arrondis des bordures, coins de chaussée dégagés", () => {
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 8 } });
  const { cx, cy } = d.reperes;
  assert.ok(!surTrottoir(d, { x: cx + 3.5 + 0.5, y: cy + 3.5 + 0.5 }), "le coin arrondi est de la chaussée");
  assert.ok(surTrottoir(d, { x: cx + 3.5 + 4, y: cy + 3.5 + 4 }), "au-delà de l'arrondi : trottoir");
  assert.ok(surTrottoir(d, { x: cx + 3.5 + 0.5, y: cy + 3.5 + 12 }), "le long de la branche : trottoir");
});

test("carrefour en croix : passage piéton conforme à l'IISR (art. 118)", () => {
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 8 }, passages: ["est"] });
  const p = d.reperes.passages.est;
  proche(p.x1 - p.x0, IISR.passage.longueur);
  proche(p.x0, d.reperes.cx + DESSIN.voie + DESSIN.rayonBordure + DESSIN.ecartPassage);
  const bandes = d.marquages.filter((m) => m.type === "surface");
  assert.ok(bandes.length >= 5 && bandes.length <= 7, "5 à 7 bandes pour une chaussée de 7 m");
  const ys = bandes.map((b) => Math.min(...b.poly.map(([, y]) => y))).sort((a, b) => a - b);
  for (const b of bandes) {
    const yb = b.poly.map(([, y]) => y);
    proche(Math.max(...yb) - Math.min(...yb), IISR.passage.bande);
  }
  for (let i = 1; i < ys.length; i++) proche(ys[i] - ys[i - 1] - IISR.passage.bande, IISR.passage.intervalle);
});

test("carrefour en croix : passage piéton de la branche ouest, 0,5 m après l'arrondi des bordures (IISR art. 118)", () => {
  // Branche ouest de 16 m : le passage (de 12,5 à 10 m à l'ouest de l'axe nord-sud) est dans le monde, de même
  // que les 15 m d'axiale continue qui le précèdent. Avec 8 m, comme aux autres tests, il déborderait du bord ouest.
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 16 }, passages: ["ouest"] });
  const { cx } = d.reperes;
  const p = d.reperes.passages.ouest;
  assert.deepEqual(Object.keys(d.reperes.passages), ["ouest"], "seule la branche ouest porte un passage");
  assert.ok(p.x0 >= 0 && p.x1 <= d.monde.largeur, "le passage est dans le monde");
  // x1 est le bord du passage côté carrefour : il commence 0,5 m après l'arrondi, à l'ouest de la bordure de la chaussée.
  proche(p.x1 - p.x0, IISR.passage.longueur);
  proche(p.x1, cx - DESSIN.voie - DESSIN.rayonBordure - DESSIN.ecartPassage);
  const bandes = d.marquages.filter((m) => m.type === "surface");
  assert.ok(bandes.length >= 5 && bandes.length <= 7, "5 à 7 bandes pour une chaussée de 7 m");
  const ys = bandes.map((b) => etendue(b.poly, 1)[0]).sort((a, b) => a - b);
  for (const b of bandes) {
    const [yMin, yMax] = etendue(b.poly, 1), [xMin, xMax] = etendue(b.poly, 0);
    proche(yMax - yMin, IISR.passage.bande);
    proche(xMin, p.x0); proche(xMax, p.x1);   // chaque bande occupe toute la longueur du passage
  }
  for (let i = 1; i < ys.length; i++) proche(ys[i] - ys[i - 1] - IISR.passage.bande, IISR.passage.intervalle);
});

test("carrefour en croix : passage piéton ouest, voie sortante au nord de l'axe, axiale continue interrompue de 0,5 m de chaque côté", () => {
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 16 }, passages: ["ouest"] });
  const { cx, cy } = d.reperes;
  const p = d.reperes.passages.ouest;
  // On roule à droite : les véhicules qui quittent le carrefour vers l'ouest sont au nord de l'axe, dans la voie sortante.
  const [yMin, yMax] = etendue(p.zoneSortante, 1), [xMin, xMax] = etendue(p.zoneSortante, 0);
  proche(yMin, cy - DESSIN.voie); proche(yMax, cy);
  proche(xMin, p.x0); proche(xMax, p.x1);
  // L'axiale continue d'avant la ligne de cédez-le-passage s'arrête à 0,50 m de chaque bord du passage : aucun de ses
  // segments ne couvre la zone de x0 - 0,5 à x1 + 0,5, et ce qui est peint est la longueur de 15 m moins cette zone.
  const xOuest = p.x0 - IISR.passage.interruptionAxiale, xEst = p.x1 + IISR.passage.interruptionAxiale;
  const continues = d.marquages.filter((m) => m.type === "ligne" && !m.trait && m.de[1] === cy && Math.max(m.de[0], m.a[0]) <= cx);
  assert.ok(continues.length >= 2, "le passage coupe l'axiale continue en deux");
  for (const m of continues) {
    const lo = Math.min(m.de[0], m.a[0]), hi = Math.max(m.de[0], m.a[0]);
    assert.ok(hi <= xOuest + 1e-9 || lo >= xEst - 1e-9, `un segment continu va de ${lo} à ${hi}, sur la zone du passage (de ${xOuest} à ${xEst})`);
  }
  const peint = continues.reduce((n, m) => n + Math.abs(m.a[0] - m.de[0]), 0);
  proche(peint, IISR.axialeContinueAvantCedez - (IISR.passage.longueur + 2 * IISR.passage.interruptionAxiale));
});

test("carrefour en croix : cédez-le-passage des branches est et ouest (IISR 117-4 B)", () => {
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 8 }, passages: ["est"] });
  const { cx, cy } = d.reperes;
  const est = d.marquages.find((m) => m.role === "cedez-est");
  assert.equal(est.largeur, 0.5); assert.equal(est.trait, 0.5); assert.equal(est.vide, 0.5);
  // Axiale continue sur 15 m de route avant la ligne, interrompue à 0,50 m du passage.
  const continues = d.marquages.filter((m) => m.type === "ligne" && !m.trait && m.de[1] === cy && m.de[0] >= cx);
  const peint = continues.reduce((n, m) => n + Math.abs(m.a[0] - m.de[0]), 0);
  proche(peint, IISR.axialeContinueAvantCedez - (IISR.passage.longueur + 2 * IISR.passage.interruptionAxiale));
  for (const p of d.panneaux) assert.ok(surTrottoir(d, p), `${p.code} hors du trottoir`);
  assert.equal(d.panneaux.filter((p) => p.code === "AB3a").length, 2);
});

test("carrefour en croix : la ligne de cédez-le-passage va de l'axe à la bordure arrondie (IISR 117-4 B)", () => {
  // La ligne s'étend sur toute la largeur de la voie qui doit céder le passage et marque la limite de la
  // chaussée prioritaire : son bord aval est sur cette limite. À cet endroit la chaussée est plus large que
  // la voie, à cause de l'arrondi du coin : le trait va jusqu'à la bordure, rencontrée à son bord amont (le
  // plus éloigné du carrefour, donc là où la chaussée est la moins large), pour rester entièrement sur la chaussée.
  const h = DESSIN.voie, r = DESSIN.rayonBordure;
  for (const [cote, coin, s] of [["est", "NE", 1], ["ouest", "SO", -1]]) {
    const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 8 }, passages: [cote] });
    const { cy, bord, arrondi } = d.reperes;
    const ligne = d.marquages.find((m) => m.role === "cedez-" + cote);
    // La voie entrante de l'est est au nord de l'axe (`de` du côté de la bordure), celle de l'ouest au sud (`a` de ce côté).
    const [axe, bordure] = cote === "est" ? [ligne.a, ligne.de] : [ligne.de, ligne.a];
    const xCentre = bord[cote] + (s * IISR.largeurCedez) / 2, xAmont = bord[cote] + s * IISR.largeurCedez;
    // Le long de la route, le trait n'a pas bougé : bord aval sur la limite de la chaussée prioritaire.
    proche(axe[0], xCentre); proche(bordure[0], xCentre);
    proche(axe[1], cy);
    // Son coin amont, côté bordure, est sur l'arc de l'arrondi : 9,5 - racine(36 - 5,5 au carré), soit 7,102 m de l'axe.
    const c = arrondi[coin];
    proche(Math.hypot(xAmont - c.x, bordure[1] - c.y), c.r);
    proche(Math.abs(bordure[1] - cy), h + r - Math.sqrt(r * r - (r - IISR.largeurCedez) ** 2));
    proche(Math.abs(bordure[1] - cy), 7.102, 1e-3);
    // Tout le trait est sur la chaussée : bord aval, axe et bord amont, de l'axe à la bordure.
    for (const x of [bord[cote], xCentre, xAmont]) {
      for (let k = 0; k <= 50; k++) {
        const p = { x, y: cy + ((bordure[1] - cy) * k) / 50 };
        assert.ok(!surTrottoir(d, p), `${cote} : le point (${p.x.toFixed(3)} ; ${p.y.toFixed(3)}) du trait est sur un trottoir`);
      }
    }
  }
});

test("giratoire : raccordements tangents, anneau, ligne de cédez hors de l'anneau", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const { cx, cy, yF, rFil, rAnneau, xLigne, thetaRacc } = g.reperes;
  proche(Math.hypot(DESSIN.voie + 8, yF), 14 + 8);
  proche(rFil, 9.5); proche(rAnneau, 12.5); proche(xLigne, 2.0);
  proche(thetaRacc, Math.atan2(yF, DESSIN.voie + 8) / DEG);
  assert.equal(g.obstacles.filter((o) => o.nature === "trottoir").length, 4);
  assert.equal(g.obstacles.filter((o) => o.nature === "ilot").length, 1);
  const ligne = g.marquages.find((m) => m.role === "cedez-sud");
  assert.equal(ligne.largeur, 0.5); assert.equal(ligne.trait, 0.5); assert.equal(ligne.vide, 0.5);
  assert.ok(Math.hypot(ligne.de[0] - cx, ligne.de[1] - 0.25 - cy) > 14, "bord aval hors de l'anneau");
  for (const p of g.panneaux) assert.ok(surTrottoir(g, p), `${p.code} hors du trottoir`);
  assert.equal(g.panneaux.filter((p) => p.code === "AB3a").length, 4);
  assert.equal(g.panneaux.filter((p) => p.code === "AB25").length, 1);
});

test("giratoire : la ligne de cédez-le-passage va de l'axe à la bordure du raccordement d'entrée (IISR 117-4 B)", () => {
  // Même règle que pour le carrefour en croix : le trait va jusqu'à la bordure, rencontrée à son bord amont
  // (le plus éloigné de l'anneau, là où la chaussée, évasée par le raccordement, est la moins large).
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const { cx, cy, yF, rExt, rRacc } = g.reperes;
  const h = DESSIN.voie;
  const rotation = { sud: 0, est: -90, nord: 180, ouest: 90 };   // du repère de la branche sud vers chaque branche
  for (const nom of Object.keys(rotation)) {
    const ligne = g.marquages.find((m) => m.role === "cedez-" + nom);
    // Les formules sont celles de la branche sud : on y ramène la ligne, puis on rapporte chaque point au décor.
    const versSud = (p) => tournerPoint(p, cx, cy, -rotation[nom]);
    const versDecor = (p) => tournerPoint(p, cx, cy, rotation[nom]);
    const [deX, deY] = versSud(ligne.de), [aX, aY] = versSud(ligne.a);
    proche(deX, cx);                                          // part de l'axe de la branche
    proche(aY, deY);                                          // trait perpendiculaire à l'axe
    proche(deY - IISR.largeurCedez / 2 - cy, rExt + 0.05);    // bord aval à 5 cm de l'anneau
    const yAmont = deY + IISR.largeurCedez / 2;
    // Le coin amont du trait, côté bordure, est sur l'arc du raccordement d'entrée (centre à 8 m de la bordure droite).
    proche(Math.hypot(aX - (cx + h + rRacc), yAmont - (cy + yF)), rRacc);
    assert.ok(aX > cx + h, `${nom} : la chaussée évasée est plus large que la voie`);
    // Tout le bord amont, de l'axe à la bordure, est sur la chaussée.
    for (let k = 0; k <= 50; k++) {
      const [x, y] = versDecor([deX + ((aX - deX) * k) / 50, yAmont]);
      assert.ok(!surTrottoir(g, { x, y }), `${nom} : le bord amont du trait est sur un trottoir (point ${k} sur 50)`);
    }
  }
});

test("giratoire : avec les rayons par défaut, chaque AB3a reste à 16,5 m du centre de l'îlot, dans le repère de sa branche", () => {
  // Position de référence des décors par défaut (rExt = 14 m) : poser le panneau par rapport à la ligne de
  // cédez-le-passage ne la déplace pas.
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const { cx, cy } = g.reperes;
  const ab3a = g.panneaux.filter((p) => p.code === "AB3a");
  assert.equal(ab3a.length, 4);
  const rotation = { sud: 0, est: -90, nord: 180, ouest: 90 };   // du repère de la branche sud vers chaque branche
  for (const [nom, rot] of Object.entries(rotation)) {
    const [x, y] = tournerPoint([cx + DESSIN.voie + DESSIN.deportAB3aGiratoire, cy + 16.5], cx, cy, rot);
    assert.ok(ab3a.some((p) => Math.hypot(p.x - x, p.y - y) < 1e-9), `${nom} : aucun AB3a en (${x.toFixed(3)} ; ${y.toFixed(3)})`);
  }
});

test("giratoire : chaque AB3a est sur un trottoir, à DESSIN.distanceAB3aAmontCedez en amont de sa ligne de cédez-le-passage, avec les rayons par défaut et avec d'autres", () => {
  const rotation = { sud: 0, est: -90, nord: 180, ouest: 90 };   // du repère de la branche sud vers chaque branche
  for (const rayons of [{ rIlot: 10, rExt: 16, rRacc: 10 }, {}]) {
    const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 }, ...rayons });
    const { cx, cy } = g.reperes;
    const ab3a = g.panneaux.filter((p) => p.code === "AB3a");
    assert.equal(ab3a.length, 4);
    for (const p of ab3a) assert.ok(surTrottoir(g, p), `${JSON.stringify(rayons)} : AB3a en (${p.x.toFixed(2)} ; ${p.y.toFixed(2)}) hors du trottoir`);
    for (const [nom, rot] of Object.entries(rotation)) {
      // La ligne de sa branche, ramenée à la branche sud : son ordonnée est celle de son axe, son bord amont est à une demi-largeur de plus.
      const ligne = g.marquages.find((m) => m.role === "cedez-" + nom);
      const yAmont = tournerPoint(ligne.de, cx, cy, -rot)[1] + IISR.largeurCedez / 2;
      const [x, y] = tournerPoint([cx + DESSIN.voie + DESSIN.deportAB3aGiratoire, yAmont + DESSIN.distanceAB3aAmontCedez], cx, cy, rot);
      assert.ok(ab3a.some((p) => Math.hypot(p.x - x, p.y - y) < 1e-9),
        `${JSON.stringify(rayons)} : ${nom} : aucun AB3a à ${DESSIN.distanceAB3aAmontCedez} m en amont de la ligne de cédez-le-passage`);
    }
  }
});

test("giratoire : un panneau qui ne tombe pas sur un trottoir fait refuser le décor, avec son code et sa position dans le message", () => {
  const branches = { nord: 26, sud: 76, est: 26, ouest: 40 };
  // Raccordements d'entrée très évasés : la chaussée s'élargit jusqu'à l'emplacement des AB3a.
  assert.throws(() => giratoire({ branches, rRacc: 30 }),
    /giratoire : le panneau AB3a ne tombe pas sur un trottoir, en \(-?[\d.]+ ; -?[\d.]+\) m : revoir les rayons \(rIlot 8 m, rExt 14 m, rRacc 30 m\) ou distanceAB25 \(50 m\)/);
  // AB25 à 0 m de l'anneau : il serait sur la chaussée évasée de l'entrée sud.
  assert.throws(() => giratoire({ branches, distanceAB25: 0 }),
    /giratoire : le panneau AB25 ne tombe pas sur un trottoir, en \(-?[\d.]+ ; -?[\d.]+\) m : revoir les rayons \(rIlot 8 m, rExt 14 m, rRacc 8 m\) ou distanceAB25 \(0 m\)/);
  // Le contrôle ne refuse pas à tort : les rayons par défaut et { rIlot: 10, rExt: 16, rRacc: 10 } sont acceptés.
  assert.doesNotThrow(() => giratoire({ branches }));
  assert.doesNotThrow(() => giratoire({ branches, rIlot: 10, rExt: 16, rRacc: 10 }));
});

test("trajetGiratoire : arcs tangents à l'anneau, sortie dans l'axe de la voie visée", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const { cx, cy, rAnneau } = g.reperes;
  const tr = trajetGiratoire(g, "sud", "nord");
  const pAnneau = pointA(tr.chemin, tr.s.anneau);
  proche(Math.hypot(pAnneau.x - cx, pAnneau.y - cy), rAnneau);
  const pSortie = pointA(tr.chemin, tr.s.sortie);
  proche(Math.hypot(pSortie.x - cx, pSortie.y - cy), rAnneau);
  const fin = pointA(tr.chemin, tr.chemin.longueur);
  proche(fin.x, cx + 2.0); proche(fin.y, 0.5); proche(fin.cap, -90 * DEG, 1e-9);
  assert.ok(tr.s.anneau < tr.s.clignotant && tr.s.clignotant < tr.s.sortie);
  const oe = trajetGiratoire(g, "ouest", "est");
  const finOE = pointA(oe.chemin, oe.chemin.longueur);
  proche(finOE.y, cy + 2.0); proche(finOE.cap, 0, 1e-9); proche(finOE.x, g.monde.largeur - 0.5);
  assert.throws(() => trajetGiratoire(g, "sud", "sud"), /demi-tour/);
});

test("trajetGiratoire : une branche inconnue est refusée, avec son nom dans le message", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  assert.throws(() => trajetGiratoire(g, "Sud", "nord"),
    /branche « Sud » inconnue pour « depuis » \(attendu : « sud », « est », « nord », « ouest »\)/);
  assert.throws(() => trajetGiratoire(g, "sud", "nord-est"), /branche « nord-est » inconnue pour « vers »/);
  assert.throws(() => trajetGiratoire(g, "x", "x"), /branche « x » inconnue/, "pas pris pour un demi-tour");
});

test("trajetGiratoire : le clignotant s'allume 3 degrés après l'axe de la sortie précédente", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const { cx, cy, rAnneau } = g.reperes;
  const polaire = (p) => Math.atan2(p.y - cy, p.x - cx) / DEG;   // repère de l'écran : 0 à l'est, 90 au sud, -90 au nord
  const surAnneau = (p) => proche(Math.hypot(p.x - cx, p.y - cy), rAnneau);
  for (const options of [{}, { horsMonde: true }]) {
    // Depuis le sud, deuxième sortie (nord) : la sortie précédente est l'est, à 0 degré ; on circule dans le sens des angles décroissants.
    const nord = trajetGiratoire(g, "sud", "nord", options);
    const pNord = pointA(nord.chemin, nord.s.clignotant);
    surAnneau(pNord); proche(polaire(pNord), -3);
    // Troisième sortie (ouest) : la sortie précédente est le nord, à -90 degrés.
    const ouest = trajetGiratoire(g, "sud", "ouest", options);
    const pOuest = pointA(ouest.chemin, ouest.s.clignotant);
    surAnneau(pOuest); proche(polaire(pOuest), -93);
  }
  // Les trois autres départs, deuxième et troisième sorties : même règle, tournée avec la branche.
  const ordre = ["sud", "est", "nord", "ouest"];
  const axe = { sud: 90, est: 0, nord: -90, ouest: 180 };
  const ecart = (a, b) => ((((a - b) + 180) % 360) + 360) % 360 - 180;   // a - b ramené dans [-180, 180[
  for (const depuis of ["est", "nord", "ouest"]) {
    for (const k of [2, 3]) {
      const vers = ordre[(ordre.indexOf(depuis) + k) % 4], precedente = ordre[(ordre.indexOf(depuis) + k - 1) % 4];
      const tr = trajetGiratoire(g, depuis, vers);
      const p = pointA(tr.chemin, tr.s.clignotant);
      surAnneau(p);
      const e = ecart(polaire(p), axe[precedente] - 3);
      assert.ok(Math.abs(e) < 1e-6, `${depuis} vers ${vers} : clignotant à ${polaire(p).toFixed(3)} degrés, attendu ${axe[precedente] - 3}`);
    }
  }
});

test("giratoire : la zone de conflit sud contient le point où l'élève (sud vers nord) rejoint l'anneau", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const zone = g.reperes.zoneConflitSud;
  const tr = trajetGiratoire(g, "sud", "nord");
  const entree = pointA(tr.chemin, tr.s.anneau);
  assert.ok(pointDansPolygone([entree.x, entree.y], zone), "le point où l'élève rejoint l'anneau est hors de la zone de conflit");
  // La zone n'est qu'un secteur de l'anneau : le point où l'élève en sort, au nord, n'en fait pas partie.
  const sortie = pointA(tr.chemin, tr.s.sortie);
  assert.ok(!pointDansPolygone([sortie.x, sortie.y], zone), "le point de sortie nord est dans la zone de conflit sud");
});

test("DESSIN.demiLargeurVoiture : moitié de la largeur du gabarit voiture", () => {
  // La valeur est recopiée dans DESSIN pour caler les trajectoires sur les bordures : elle doit suivre le gabarit.
  assert.equal(DESSIN.demiLargeurVoiture, GABARITS.voiture.largeur / 2);
});

// Amendement du 03/10 : un véhicule qui part en cours de scène apparaît à son départ, et un
// véhicule autre que celui de l'élève qui finit en roulant disparaît à la fin de son trajet.
// Ces deux instants se passent hors du monde : trajetGiratoire accepte { horsMonde: true }.

test("HORS_MONDE : demi-longueur d'une voiture plus 0,5 m de dégagement", () => {
  proche(HORS_MONDE, 2.75);
  proche(HORS_MONDE, GABARITS.voiture.longueur / 2 + 0.5);
});

test("trajetGiratoire avec horsMonde : l'emprise au départ et à l'arrivée ne touche pas le monde", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const monde = rectangle(0, 0, g.monde.largeur, g.monde.hauteur);
  const toucheLeMonde = (chemin, s) => polygonesSeChevauchent(emprise("voiture", pointA(chemin, s)), monde);
  for (const [depuis, vers] of [["ouest", "est"], ["sud", "nord"]]) {
    const libelle = `${depuis} vers ${vers}`;
    const hors = trajetGiratoire(g, depuis, vers, { horsMonde: true });
    assert.ok(!toucheLeMonde(hors.chemin, 0), `${libelle} : le départ touche le monde`);
    assert.ok(!toucheLeMonde(hors.chemin, hors.chemin.longueur), `${libelle} : l'arrivée touche le monde`);
    // Sans l'option, le trajet de l'élève part et finit dans le monde, visible : le contrôle ci-dessus discrimine.
    const visible = trajetGiratoire(g, depuis, vers);
    assert.ok(toucheLeMonde(visible.chemin, 0), `${libelle} : sans l'option, le départ est visible`);
    assert.ok(toucheLeMonde(visible.chemin, visible.chemin.longueur), `${libelle} : sans l'option, l'arrivée est visible`);
  }
});

test("trajetGiratoire : départ et arrivée à 0,5 m à l'intérieur du bord, à HORS_MONDE au-delà avec horsMonde", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const { cx, cy, xLigne } = g.reperes;
  const { largeur, hauteur } = g.monde;
  const bouts = (depuis, vers, options) => {
    const { chemin } = trajetGiratoire(g, depuis, vers, options);
    return { debut: pointA(chemin, 0), fin: pointA(chemin, chemin.longueur) };
  };

  // Sud vers nord : l'élève roule plein nord, de la voie d'entrée sud à la voie de sortie nord.
  const sud = bouts("sud", "nord");
  proche(sud.debut.x, cx + xLigne); proche(sud.debut.y, hauteur - 0.5); proche(sud.debut.cap, -90 * DEG, 1e-9);
  proche(sud.fin.x, cx + xLigne); proche(sud.fin.y, 0.5); proche(sud.fin.cap, -90 * DEG, 1e-9);
  const sudHors = bouts("sud", "nord", { horsMonde: true });
  proche(sudHors.debut.x, cx + xLigne); proche(sudHors.debut.y, hauteur + HORS_MONDE); proche(sudHors.debut.cap, -90 * DEG, 1e-9);
  proche(sudHors.fin.x, cx + xLigne); proche(sudHors.fin.y, -HORS_MONDE); proche(sudHors.fin.cap, -90 * DEG, 1e-9);

  // Ouest vers est : l'usager de l'anneau roule plein est, de la voie d'entrée ouest à la voie de sortie est.
  const ouest = bouts("ouest", "est");
  proche(ouest.debut.x, 0.5); proche(ouest.debut.y, cy + xLigne); proche(ouest.debut.cap, 0, 1e-9);
  proche(ouest.fin.x, largeur - 0.5); proche(ouest.fin.y, cy + xLigne); proche(ouest.fin.cap, 0, 1e-9);
  const ouestHors = bouts("ouest", "est", { horsMonde: true });
  proche(ouestHors.debut.x, -HORS_MONDE); proche(ouestHors.debut.y, cy + xLigne); proche(ouestHors.debut.cap, 0, 1e-9);
  proche(ouestHors.fin.x, largeur + HORS_MONDE); proche(ouestHors.fin.y, cy + xLigne); proche(ouestHors.fin.cap, 0, 1e-9);
});

test("trajetGiratoire avec horsMonde : même tracé, prolongé de HORS_MONDE + 0,5 m à chaque bout", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const prolongement = HORS_MONDE + 0.5;   // de 0,5 m à l'intérieur du bord à HORS_MONDE au-delà
  const branches = ["sud", "est", "nord", "ouest"];
  for (const depuis of branches) {
    for (const vers of branches) {
      if (vers === depuis) continue;
      const libelle = `${depuis} vers ${vers}`;
      const egal = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${libelle} : ${a} au lieu de ${b}`);
      const sans = trajetGiratoire(g, depuis, vers);
      const avec = trajetGiratoire(g, depuis, vers, { horsMonde: true });
      egal(avec.chemin.longueur - sans.chemin.longueur, 2 * prolongement);
      // Les abscisses repères suivent le tracé : décalées de l'allongement de l'approche. Un clignotant
      // posé au début du trajet (première sortie) y reste.
      for (const cle of ["tangenceEntree", "anneau", "sortie", "finSortie"]) {
        egal(avec.s[cle] - sans.s[cle], prolongement);
      }
      egal(avec.s.clignotant, sans.s.clignotant === 0 ? 0 : sans.s.clignotant + prolongement);
      // Le tracé commun est le même, point par point : seules les deux lignes droites s'allongent.
      const memePoint = (s) => {
        const a = pointA(avec.chemin, s + prolongement), b = pointA(sans.chemin, s);
        egal(a.x, b.x); egal(a.y, b.y); egal(a.cap, b.cap, 1e-9);
      };
      for (let s = 0; s < sans.chemin.longueur; s += 0.5) memePoint(s);
      memePoint(sans.chemin.longueur);
      // Il finit toujours cap dans l'axe de la voie de sortie, avec ou sans l'option.
      const finAvec = pointA(avec.chemin, avec.chemin.longueur), finSans = pointA(sans.chemin, sans.chemin.longueur);
      egal(finAvec.cap, finSans.cap, 1e-9);
    }
  }
});

test("trajetGiratoire : sur les 12 trajets, avec et sans horsMonde, la voiture ne touche ni trottoir ni îlot", () => {
  const g = giratoire({ branches: { nord: 26, sud: 76, est: 26, ouest: 40 } });
  const saillies = g.obstacles.filter((o) => o.nature === "trottoir" || o.nature === "ilot");
  assert.equal(saillies.length, 5, "quatre trottoirs et l'îlot : sinon la vérification ne porterait sur rien");
  const branches = ["sud", "est", "nord", "ouest"];
  const pas = 0.05;   // l'emprise de la voiture est relevée tous les 5 cm le long du trajet
  for (const depuis of branches) {
    for (const vers of branches) {
      if (vers === depuis) continue;
      for (const options of [{}, { horsMonde: true }]) {
        const { chemin } = trajetGiratoire(g, depuis, vers, options);
        const libelle = `${depuis} vers ${vers}${options.horsMonde ? " (horsMonde)" : ""}`;
        const n = Math.ceil(chemin.longueur / pas);
        for (let k = 0; k <= n; k++) {
          const s = Math.min(chemin.longueur, k * pas);
          const voiture = emprise("voiture", pointA(chemin, s));
          const touche = saillies.find((o) => polygonesSeChevauchent(voiture, o.poly));
          assert.ok(!touche, `${libelle} : à s = ${s.toFixed(2)} m, la voiture touche ${touche && touche.nature}`);
        }
      }
    }
  }
});
