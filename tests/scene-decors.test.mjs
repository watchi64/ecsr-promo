import { test } from "node:test";
import assert from "node:assert/strict";
import { DEG, GABARITS, emprise, pointA, pointDansPolygone, polygonesSeChevauchent, rectangle, tournerPoint, trajet, centreArc,
  courbureA } from "../js/scene-geometrie.js";
import { IISR, DESSIN, HORS_MONDE, carrefourEnCroix, giratoire, trajetGiratoire, rue, routeVirages } from "../js/scene-decors.js";
import { controlerScene } from "../js/scene-controles.js";

const proche = (a, b, eps = 1e-6, quoi = "") => assert.ok(Math.abs(a - b) <= eps, `${quoi}${quoi ? " : " : ""}${a} au lieu de ${b}`);
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

// ===== Rue droite et route en virages (plan 2, lot C1) =====

// Route en virages d'essai : celle d'une scène plausible (rayon et angle par défaut), et une route plus serrée, à angle
// droit, pour vérifier que la construction ne tient pas aux valeurs par défaut.
const VIRAGES = { approche: 50, entreVirages: 20, sortie: 30, largeurTrottoir: 5 };
const VIRAGES_SERRES = { approche: 30, entreVirages: 12, sortie: 20, largeurTrottoir: 3, rayon: 25, angle: 90 };
const RUE = { longueur: 60, largeurTrottoir: 4 };

const trottoirs = (d) => d.obstacles.filter((o) => o.nature === "trottoir");
const surUnTrottoir = (d, q) => trottoirs(d).some((o) => pointDansPolygone(q, o.poly));
const droiteDe = (p) => [-Math.sin(p.cap), Math.cos(p.cap)];     // normale unitaire à droite du cap (y vers le bas)
const decale = (p, n, o) => [p.x + o * n[0], p.y + o * n[1]];   // point à o m de p dans la direction n

// Distance, depuis le point q et dans la direction unitaire n, au premier bord de trottoir rencontré : mesurée sur les
// polygones du décor, indépendamment de la façon dont ils ont été construits.
function premierBord(d, q, n) {
  let t = Infinity;
  for (const { poly } of trottoirs(d)) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], rx = a[0] - q[0], ry = a[1] - q[1];
      const det = ex * n[1] - n[0] * ey;
      if (Math.abs(det) < 1e-12) continue;                       // bord parallèle à la mesure
      const ti = (ex * ry - rx * ey) / det, si = (n[0] * ry - rx * n[1]) / det;
      if (ti >= 0 && si >= 0 && si <= 1) t = Math.min(t, ti);
    }
  }
  return t;
}

// Géométrie attendue d'une route en virages, calculée ici sans le module : dimensions du monde, abscisses (x) de l'axe
// sur les lignes droites d'approche et de sortie, et l'axe lui-même, du bord bas au bord haut, tracé à la tortue (virage
// à droite : angle positif, virage à gauche : angle négatif).
function routeAttendue({ approche, entreVirages, sortie, largeurTrottoir, rayon = 40, angle = 60 }) {
  const h = DESSIN.voie, a = angle * DEG;
  const hauteur = approche + 2 * rayon * Math.sin(a) + entreVirages * Math.cos(a) + sortie;
  const xApproche = largeurTrottoir + h, xSortie = xApproche + 2 * rayon * (1 - Math.cos(a)) + entreVirages * Math.sin(a);
  const axe = trajet(xApproche, hauteur, -90).droit(approche).virage(rayon, angle).droit(entreVirages).virage(rayon, -angle)
    .droit(sortie).fin();
  return { h, a, rayon, angle, hauteur, largeur: xSortie + h + largeurTrottoir, xApproche, xSortie, axe,
    centres: { droite: centreArc(axe.segments[1]), gauche: centreArc(axe.segments[3]) } };
}

// Scène minimale sur un décor : l'élève suit le trajet à 30 km/h, sans autre usager, et doit rester dans la voie de droite.
function sceneEssai(d, chemin) {
  return {
    code: "essai", titre: "Essai du décor", monde: d.monde, limite: 50, decor: d,
    acteurs: [{ id: "eleve", role: "eleve", gabarit: "voiture", chemin,
      profil: [{ s: 0, kmh: 30 }, { s: chemin.longueur, kmh: 30 }] }],
    etapes: [{ s: 0, regard: { angle: 0 } }, { s: chemin.longueur / 2, regard: { angle: 0 } }],
    attentes: [{ type: "dans", acteur: "eleve", nom: "voie de droite", zone: d.voies.droite, de: 0, a: chemin.longueur, emprise: true }],
  };
}

test("rue : chaussée de deux voies de 3,5 m entre deux trottoirs, orientée sud-nord ; repères du bord droit, de l'axe et du bord gauche", () => {
  const d = rue(RUE);
  assert.deepEqual(d.monde, { largeur: 4 + 2 * DESSIN.voie + 4, hauteur: 60 });
  // Sans bande de stationnement, le bord droit de la voie de droite est la bordure du trottoir.
  assert.deepEqual(d.reperes, { xBordDroit: 11, xBordVoieDroite: 11, xAxe: 7.5, xBordGauche: 4 });
  // L'élève roule vers le nord : sa voie, la voie de droite, est à l'est de l'axe ; chacune a 3,5 m de large.
  assert.deepEqual(etendue(d.voies.droite, 0), [7.5, 11]);
  assert.deepEqual(etendue(d.voies.gauche, 0), [4, 7.5]);
  for (const voie of [d.voies.droite, d.voies.gauche]) {
    const [yMin, yMax] = etendue(voie, 1);
    assert.ok(yMin < 0 && yMax > 60, "la voie déborde du monde aux deux bouts");
  }
  assert.deepEqual(d.panneaux, []);
  assert.deepEqual(d.zones, {});
});

test("rue : un trottoir de chaque côté, de la bordure au bord du monde ; aucun sur la chaussée", () => {
  const d = rue(RUE);
  const { xBordDroit, xBordGauche } = d.reperes;
  assert.equal(trottoirs(d).length, 2);
  for (let y = 0; y <= 60; y += 0.5) {
    for (let x = xBordGauche + 0.001; x < xBordDroit; x += 0.25) assert.ok(!surUnTrottoir(d, [x, y]), `(${x} ; ${y}) : trottoir sur la chaussée`);
    assert.ok(!surUnTrottoir(d, [xBordDroit - 0.001, y]), `(${xBordDroit - 0.001} ; ${y}) : trottoir sur la chaussée`);
    for (const x of [0, xBordGauche - 0.001, xBordDroit + 0.001, d.monde.largeur]) {
      assert.ok(surUnTrottoir(d, [x, y]), `(${x} ; ${y}) : pas de trottoir au-delà de la bordure`);
    }
  }
});

test("rue : axiale T'1 de largeur 2u sur toute la longueur (IISR 7e partie, art. 113-1 et 113-2)", () => {
  const d = rue(RUE);
  assert.equal(d.marquages.length, 1);
  const [m] = d.marquages;
  assert.equal(m.type, "ligne");
  assert.equal(m.largeur, 2 * IISR.u); proche(m.largeur, 0.1);
  assert.equal(m.trait, 1.5); assert.equal(m.vide, 5);
  // Du bord bas au bord haut, sur l'axe : le pointillé commence en bas, par un trait.
  assert.deepEqual([m.de, m.a], [[7.5, 60], [7.5, 0]]);
});

test("rue : une longueur ou une largeur de trottoir absente, nulle, négative ou non numérique est refusée, avec son nom dans le message", () => {
  assert.throws(() => rue({ largeurTrottoir: 4 }), /rue : « longueur » attend un nombre de mètres strictement positif \(reçu : undefined\)/);
  assert.throws(() => rue({ longueur: 60, largeurTrottoir: 0 }), /rue : « largeurTrottoir » attend un nombre de mètres strictement positif \(reçu : 0\)/);
  assert.throws(() => rue({ longueur: -1, largeurTrottoir: 4 }), /« longueur »/);
  assert.throws(() => rue({ longueur: NaN, largeurTrottoir: 4 }), /« longueur »/);
  assert.throws(() => rue({ longueur: "60", largeurTrottoir: 4 }), /« longueur »/);
  assert.throws(() => rue(), /« longueur »/);
});

test("routeVirages : rayon de 40 m (mesuré sur l'axe) et angle de 60 degrés par défaut, choix de dessin nommés dans DESSIN", () => {
  assert.equal(DESSIN.rayonVirage, 40);
  assert.equal(DESSIN.angleVirage, 60);
  const d = routeVirages(VIRAGES);
  assert.equal(d.reperes.rayon, 40);
  assert.equal(d.reperes.angle, 60);
  const autre = routeVirages(VIRAGES_SERRES);
  assert.equal(autre.reperes.rayon, 25);
  assert.equal(autre.reperes.angle, 90);
});

test("routeVirages : ligne droite d'approche vers le nord, virage à droite, ligne droite courte, virage à gauche, ligne droite de sortie vers le nord", () => {
  for (const params of [VIRAGES, VIRAGES_SERRES]) {
    const d = routeVirages(params), g = routeAttendue(params), libelle = JSON.stringify(params);
    proche(d.monde.largeur, g.largeur, 1e-9, libelle); proche(d.monde.hauteur, g.hauteur, 1e-9, libelle);
    proche(d.reperes.xAxeApproche, g.xApproche, 1e-9, libelle); proche(d.reperes.xAxeSortie, g.xSortie, 1e-9, libelle);
    // L'axe tracé à la tortue entre par le bord bas et sort par le bord haut, cap au nord aux deux bouts.
    const fin = pointA(g.axe, g.axe.longueur);
    proche(fin.x, g.xSortie, 1e-9, libelle); proche(fin.y, 0, 1e-9, libelle); proche(fin.cap, -90 * DEG, 1e-12, libelle);
    // Le premier virage tourne à droite (centre à l'est de l'approche), le second à gauche (centre à l'ouest de la sortie).
    assert.ok(g.axe.segments[1].angle > 0 && g.axe.segments[3].angle < 0, libelle);
    const { virageDroite, virageGauche } = d.reperes.centres;
    proche(virageDroite[0], g.centres.droite.x, 1e-9, libelle); proche(virageDroite[1], g.centres.droite.y, 1e-9, libelle);
    proche(virageGauche[0], g.centres.gauche.x, 1e-9, libelle); proche(virageGauche[1], g.centres.gauche.y, 1e-9, libelle);
    assert.ok(virageDroite[0] > g.xApproche && virageGauche[0] < g.xSortie, libelle);
    // Le monde montre largeurTrottoir m de trottoir à gauche de la ligne droite d'approche et à droite de celle de sortie.
    proche(g.xApproche - g.h, params.largeurTrottoir, 1e-12, libelle);
    proche(d.monde.largeur - (g.xSortie + g.h), params.largeurTrottoir, 1e-9, libelle);
    assert.deepEqual(d.panneaux, []);
    assert.deepEqual(d.zones, {});
  }
});

test("routeVirages : la chaussée garde 7 m de large, 3,5 m de part et d'autre de l'axe, mesurés tous les 0,5 m, virages compris ; aucun trottoir ne la chevauche", () => {
  // Les arcs sont dessinés en cordes : la mesure est exacte en ligne droite, à DESSIN.flecheArc (2 mm) près dans les virages.
  assert.equal(DESSIN.flecheArc, 0.002);
  const eps = DESSIN.flecheArc;
  for (const params of [VIRAGES, VIRAGES_SERRES]) {
    const d = routeVirages(params), g = routeAttendue(params), libelle = JSON.stringify(params);
    assert.equal(trottoirs(d).length, 2, libelle);
    let mesuresEnVirage = 0;
    for (let s = 0; s <= g.axe.longueur; s += 0.5) {
      const p = pointA(g.axe, s), n = droiteDe(p), nom = `${libelle}, s = ${s.toFixed(1)} m`;
      proche(premierBord(d, [p.x, p.y], n), g.h, eps, `${nom} : bordure droite`);
      proche(premierBord(d, [p.x, p.y], [-n[0], -n[1]]), g.h, eps, `${nom} : bordure gauche`);
      // De bordure à bordure, aucun point de la chaussée n'est sur un trottoir ; juste au-delà, le trottoir commence.
      for (let k = -10; k <= 10; k++) {
        assert.ok(!surUnTrottoir(d, decale(p, n, (k / 10) * (g.h - 2 * eps))), `${nom} : trottoir sur la chaussée (${k / 10} de la demi-largeur)`);
      }
      for (const o of [g.h + 2 * eps, -(g.h + 2 * eps)]) assert.ok(surUnTrottoir(d, decale(p, n, o)), `${nom} : pas de trottoir à ${o} m de l'axe`);
      if (courbureA(g.axe, s) !== 0) mesuresEnVirage++;
    }
    assert.ok(mesuresEnVirage >= 140, `${libelle} : seulement ${mesuresEnVirage} mesures dans les virages`);
  }
});

test("routeVirages : axiale T'1 de largeur 2u, traits de 1,50 m et vides de 5 m comptés le long de l'axe, dans les virages comme en ligne droite (IISR 7e partie, art. 113-1 et 113-2)", () => {
  const { trait, vide } = IISR.axialeAgglo;
  assert.equal(trait, 1.5); assert.equal(vide, 5);
  const periode = trait + vide;
  for (const params of [VIRAGES, VIRAGES_SERRES]) {
    const d = routeVirages(params), g = routeAttendue(params), libelle = JSON.stringify(params);
    // Le moteur ne trace que des segments droits : chaque trait est une surface, une bande dont les bords suivent l'axe.
    assert.equal(d.marquages.length, Math.ceil(g.axe.longueur / periode), `${libelle} : nombre de traits`);
    const enVirage = { droite: 0, gauche: 0 };
    d.marquages.forEach((m, k) => {
      const nom = `${libelle} : trait ${k + 1}`;
      assert.equal(m.type, "surface", nom);
      assert.equal(m.role, "axiale", nom);
      const n = m.poly.length / 2;
      assert.ok(Number.isInteger(n) && n >= 2, `${nom} : ${m.poly.length} points`);
      // Points en vis-à-vis : le bord droit dans l'ordre, le bord gauche à rebours ; leur milieu est sur l'axe.
      const droit = m.poly.slice(0, n), gauche = m.poly.slice(n).reverse();
      const milieux = droit.map((q, i) => [(q[0] + gauche[i][0]) / 2, (q[1] + gauche[i][1]) / 2]);
      const s0 = k * periode, s1 = Math.min(s0 + trait, g.axe.longueur);
      const abscisses = [s0];
      for (let i = 1; i < n; i++) abscisses.push(abscisses[i - 1] + Math.hypot(milieux[i][0] - milieux[i - 1][0], milieux[i][1] - milieux[i - 1][1]));
      milieux.forEach((q, i) => {
        const p = pointA(g.axe, abscisses[i]), nd = droiteDe(p);
        proche(Math.hypot(q[0] - p.x, q[1] - p.y), 0, 1e-4, `${nom}, point ${i + 1} hors de l'axe`);
        // Largeur 2u, u de chaque côté de l'axe, perpendiculairement à lui.
        proche(Math.hypot(droit[i][0] - gauche[i][0], droit[i][1] - gauche[i][1]), 2 * IISR.u, 1e-9, `${nom}, largeur au point ${i + 1}`);
        proche((droit[i][0] - q[0]) * nd[0] + (droit[i][1] - q[1]) * nd[1], IISR.u, 1e-6, `${nom}, bord droit au point ${i + 1}`);
      });
      // Début et fin du trait aux abscisses de la modulation.
      const p0 = pointA(g.axe, s0), p1 = pointA(g.axe, s1);
      proche(milieux[0][0], p0.x, 1e-9, nom); proche(milieux[0][1], p0.y, 1e-9, nom);
      proche(milieux[n - 1][0], p1.x, 1e-9, nom); proche(milieux[n - 1][1], p1.y, 1e-9, nom);
      proche(abscisses[n - 1] - s0, s1 - s0, 1e-3, `${nom} : longueur peinte`);
      // Chaque corde, sur l'axe comme sur les deux bords, à moins de DESSIN.flecheArc de l'arc qu'elle remplace.
      for (let i = 1; i < n; i++) {
        const p = pointA(g.axe, (abscisses[i - 1] + abscisses[i]) / 2), nd = droiteDe(p);
        for (const [ligne, o] of [[milieux, 0], [droit, IISR.u], [gauche, -IISR.u]]) {
          const mx = (ligne[i][0] + ligne[i - 1][0]) / 2, my = (ligne[i][1] + ligne[i - 1][1]) / 2;
          const [ax, ay] = decale(p, nd, o);
          proche(Math.hypot(mx - ax, my - ay), 0, DESSIN.flecheArc + 1e-4, `${nom}, corde ${i} à ${o} m de l'axe`);
        }
      }
      const c = courbureA(g.axe, (s0 + s1) / 2);
      if (c > 0) enVirage.droite++;
      if (c < 0) enVirage.gauche++;
    });
    assert.ok(enVirage.droite >= 4 && enVirage.gauche >= 4, `${libelle} : traits dans les virages ${JSON.stringify(enVirage)}`);
  }
});

test("routeVirages : voie de droite et voie de gauche de part et d'autre de l'axe, sur toute la route", () => {
  for (const params of [VIRAGES, VIRAGES_SERRES]) {
    const d = routeVirages(params), g = routeAttendue(params), libelle = JSON.stringify(params);
    for (let s = 0; s <= g.axe.longueur; s += 0.5) {
      const p = pointA(g.axe, s), n = droiteDe(p), nom = `${libelle}, s = ${s.toFixed(1)} m`;
      for (const o of [0.01, g.h / 2, g.h - 0.01]) {
        const aDroite = decale(p, n, o), aGauche = decale(p, n, -o);
        assert.ok(pointDansPolygone(aDroite, d.voies.droite) && !pointDansPolygone(aDroite, d.voies.gauche), `${nom} : ${o} m à droite de l'axe`);
        assert.ok(pointDansPolygone(aGauche, d.voies.gauche) && !pointDansPolygone(aGauche, d.voies.droite), `${nom} : ${o} m à gauche de l'axe`);
      }
    }
  }
});

test("routeVirages : le trajet de la voie de droite, décalé de -0,5 à +0,5 m, suit l'axe de la voie à la distance demandée et garde la voiture entière dans voies.droite, sans toucher de trottoir", () => {
  for (const params of [VIRAGES, VIRAGES_SERRES]) {
    const d = routeVirages(params), g = routeAttendue(params);
    for (const decalage of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const { chemin, s } = d.reperes.cheminAxeVoieDroite(decalage);
      const o = g.h / 2 + decalage, nom = `${JSON.stringify(params)}, décalage ${decalage} m`;
      // Bouts : à DESSIN.retraitBord à l'intérieur des bords bas et haut, cap au nord, à o m à droite de l'axe.
      const debut = pointA(chemin, 0), fin = pointA(chemin, chemin.longueur);
      proche(debut.x, g.xApproche + o, 1e-9, nom); proche(debut.y, g.hauteur - DESSIN.retraitBord, 1e-9, nom);
      proche(fin.x, g.xSortie + o, 1e-9, nom); proche(fin.y, DESSIN.retraitBord, 1e-9, nom);
      proche(debut.cap, -90 * DEG, 1e-12, nom); proche(fin.cap, -90 * DEG, 1e-12, nom);
      // Dans les virages : à (rayon - o) du centre du virage à droite, à (rayon + o) du centre du virage à gauche.
      for (const [de, a, c, r] of [[s.debutVirageDroite, s.finVirageDroite, g.centres.droite, g.rayon - o],
        [s.debutVirageGauche, s.finVirageGauche, g.centres.gauche, g.rayon + o]]) {
        for (let k = 0; k <= 20; k++) {
          const p = pointA(chemin, de + ((a - de) * k) / 20);
          proche(Math.hypot(p.x - c.x, p.y - c.y), r, 1e-9, `${nom}, virage`);
        }
      }
      const n = Math.ceil(chemin.longueur / 0.1);
      for (let k = 0; k <= n; k++) {
        const sk = Math.min(chemin.longueur, k * 0.1);
        const voiture = emprise("voiture", pointA(chemin, sk));
        assert.ok(voiture.every((q) => pointDansPolygone(q, d.voies.droite)), `${nom}, s = ${sk.toFixed(1)} m : la voiture sort de voies.droite`);
        assert.ok(!trottoirs(d).some((t) => polygonesSeChevauchent(voiture, t.poly)), `${nom}, s = ${sk.toFixed(1)} m : la voiture touche un trottoir`);
      }
    }
  }
});

test("routeVirages : abscisses du début et de la fin de chaque virage sur l'axe de la voie de droite (reperes.s), et sur le trajet décalé", () => {
  const d = routeVirages(VIRAGES), g = routeAttendue(VIRAGES);
  assert.deepEqual(d.reperes.s, d.reperes.cheminAxeVoieDroite(0).s);
  assert.deepEqual(d.reperes.s, d.reperes.cheminAxeVoieDroite().s, "décalage nul par défaut");
  // Valeurs de référence (rayon 40 m, angle 60 degrés) : l'axe de la voie de droite est à 38,25 m du centre du virage à
  // droite et à 41,75 m de celui du virage à gauche.
  proche(d.reperes.s.debutVirageDroite, 49.5);
  proche(d.reperes.s.finVirageDroite, 49.5 + (38.25 * Math.PI) / 3);
  proche(d.reperes.s.debutVirageGauche, 69.5 + (38.25 * Math.PI) / 3);
  proche(d.reperes.s.finVirageGauche, 69.5 + (80 * Math.PI) / 3);
  for (const decalage of [0, -0.3, 0.25]) {
    const o = g.h / 2 + decalage, nom = `décalage ${decalage} m`;
    const { chemin, s } = d.reperes.cheminAxeVoieDroite(decalage);
    assert.deepEqual(Object.keys(s), ["debutVirageDroite", "finVirageDroite", "debutVirageGauche", "finVirageGauche"]);
    proche(s.debutVirageDroite, VIRAGES.approche - DESSIN.retraitBord, 1e-9, nom);
    proche(s.finVirageDroite - s.debutVirageDroite, (g.rayon - o) * g.a, 1e-9, nom);
    proche(s.debutVirageGauche - s.finVirageDroite, VIRAGES.entreVirages, 1e-9, nom);
    proche(s.finVirageGauche - s.debutVirageGauche, (g.rayon + o) * g.a, 1e-9, nom);
    proche(chemin.longueur - s.finVirageGauche, VIRAGES.sortie - DESSIN.retraitBord, 1e-9, nom);
    // La courbure change exactement à ces abscisses : droite, virage à droite, droite, virage à gauche, droite.
    const juste = 1e-6;
    assert.equal(courbureA(chemin, s.debutVirageDroite - juste), 0, nom);
    proche(courbureA(chemin, s.debutVirageDroite + juste), 1 / (g.rayon - o), 1e-12, nom);
    proche(courbureA(chemin, s.finVirageDroite - juste), 1 / (g.rayon - o), 1e-12, nom);
    assert.equal(courbureA(chemin, s.finVirageDroite + juste), 0, nom);
    assert.equal(courbureA(chemin, s.debutVirageGauche - juste), 0, nom);
    proche(courbureA(chemin, s.debutVirageGauche + juste), -1 / (g.rayon + o), 1e-12, nom);
    proche(courbureA(chemin, s.finVirageGauche - juste), -1 / (g.rayon + o), 1e-12, nom);
    assert.equal(courbureA(chemin, s.finVirageGauche + juste), 0, nom);
    // Le virage à droite commence à la hauteur où l'axe de la chaussée commence à tourner.
    proche(pointA(chemin, s.debutVirageDroite).y, g.hauteur - VIRAGES.approche, 1e-9, nom);
  }
});

test("routeVirages : les arcs du trajet de la voie de droite suivent la route (suitLaRoute) : pour les contrôles automatiques, ses virages ne sont pas des changements de direction", () => {
  const d = routeVirages(VIRAGES);
  const { chemin } = d.reperes.cheminAxeVoieDroite(0);
  assert.deepEqual(chemin.segments.map((seg) => seg.type), ["droite", "arc", "droite", "arc", "droite"]);
  proche(chemin.segments[1].angle, 60 * DEG); proche(chemin.segments[3].angle, -60 * DEG);
  for (const seg of chemin.segments) assert.equal(seg.suitLaRoute === true, seg.type === "arc");
  assert.deepEqual(controlerScene(sceneEssai(d, chemin)), []);
  // Témoin : les mêmes arcs, sans la marque, sont des changements de direction (plus de 30 degrés) qui exigent un clignotant.
  const sansMarque = { ...chemin, segments: chemin.segments.map((seg) => ({ ...seg, suitLaRoute: false })) };
  const erreurs = controlerScene(sceneEssai(d, sansMarque));
  assert.ok(erreurs.some((e) => /clignotant droite attendu/.test(e)), erreurs.join("\n"));
  assert.ok(erreurs.some((e) => /clignotant gauche attendu/.test(e)), erreurs.join("\n"));
});

test("rue : une voiture qui roule au centre de la voie de droite, d'un bout à l'autre, passe tous les contrôles automatiques", () => {
  const d = rue(RUE);
  const chemin = trajet(d.reperes.xAxe + DESSIN.voie / 2, RUE.longueur - DESSIN.retraitBord, -90)
    .droit(RUE.longueur - 2 * DESSIN.retraitBord).fin();
  assert.deepEqual(controlerScene(sceneEssai(d, chemin)), []);
});

// ===== Rue avec une bande de stationnement (plan 2, tâche 5 : décision du contrôleur de chantier) =====

const RUE_STATIONNEMENT = { ...RUE, stationnement: DESSIN.largeurStationnement };

test("DESSIN : bande de stationnement de 2,0 m et jeu de 0,3 m entre le flanc droit d'une voiture garée et le trottoir, choix de dessin nommés", () => {
  assert.equal(DESSIN.largeurStationnement, 2.0);
  assert.equal(DESSIN.jeuStationnement, 0.3);
});

test("rue avec stationnement : bande le long du trottoir droit ; les deux voies de circulation gardent 3,5 m et l'axiale reste au milieu d'elles, pas au milieu de la chaussée", () => {
  for (const stationnement of [DESSIN.largeurStationnement, 2.5]) {
    const d = rue({ ...RUE, stationnement }), nom = `bande de ${stationnement} m`;
    assert.deepEqual(d.monde, { largeur: 4 + 2 * DESSIN.voie + stationnement + 4, hauteur: 60 }, nom);
    assert.deepEqual(d.reperes, { xBordGauche: 4, xAxe: 7.5, xBordVoieDroite: 11, xBordDroit: 11 + stationnement }, nom);
    // Voies de circulation de 3,5 m de part et d'autre de l'axe ; la bande, de la voie de droite à la bordure.
    assert.deepEqual(etendue(d.voies.gauche, 0), [4, 7.5], nom);
    assert.deepEqual(etendue(d.voies.droite, 0), [7.5, 11], nom);
    assert.deepEqual(etendue(d.voies.stationnement, 0), [11, 11 + stationnement], nom);
    for (const voie of Object.values(d.voies)) {
      const [yMin, yMax] = etendue(voie, 1);
      assert.ok(yMin < 0 && yMax > 60, `${nom} : chaque voie déborde du monde aux deux bouts`);
    }
    // Un seul marquage, l'axiale T'1 : la bande n'est pas marquée.
    assert.equal(d.marquages.length, 1, nom);
    const [m] = d.marquages;
    assert.equal(m.type, "ligne");
    assert.equal(m.largeur, 2 * IISR.u); assert.equal(m.trait, IISR.axialeAgglo.trait); assert.equal(m.vide, IISR.axialeAgglo.vide);
    assert.deepEqual([m.de, m.a], [[7.5, 60], [7.5, 0]], nom);
    const { xBordGauche, xBordVoieDroite, xBordDroit } = d.reperes;
    proche(m.de[0] - xBordGauche, xBordVoieDroite - m.de[0], 1e-12, `${nom} : axiale au milieu des voies de circulation`);
    assert.ok(xBordDroit - m.de[0] > m.de[0] - xBordGauche + 1, `${nom} : axiale décalée du milieu de la chaussée`);
    assert.deepEqual(d.panneaux, []);
    assert.deepEqual(d.zones, {});
  }
});

test("rue avec stationnement : la bande est de la chaussée, le trottoir droit commence à son bord ; aucun trottoir sur la chaussée", () => {
  const d = rue(RUE_STATIONNEMENT);
  const { xBordGauche, xBordVoieDroite, xBordDroit } = d.reperes;
  assert.equal(trottoirs(d).length, 2);
  for (let y = 0; y <= 60; y += 0.5) {
    for (let x = xBordGauche + 0.001; x < xBordDroit; x += 0.25) assert.ok(!surUnTrottoir(d, [x, y]), `(${x} ; ${y}) : trottoir sur la chaussée`);
    for (const x of [xBordVoieDroite + 0.001, xBordDroit - 0.001]) assert.ok(!surUnTrottoir(d, [x, y]), `(${x} ; ${y}) : trottoir sur la bande`);
    for (const x of [0, xBordGauche - 0.001, xBordDroit + 0.001, d.monde.largeur]) {
      assert.ok(surUnTrottoir(d, [x, y]), `(${x} ; ${y}) : pas de trottoir au-delà de la bordure`);
    }
  }
});

test("rue sans stationnement (option absente ou nulle) : la rue de deux voies, le bord droit de la voie de droite sur la bordure, sans bande", () => {
  for (const d of [rue(RUE), rue({ ...RUE, stationnement: 0 })]) {
    assert.deepEqual(d.monde, { largeur: 4 + 2 * DESSIN.voie + 4, hauteur: 60 });
    assert.equal(d.reperes.xBordVoieDroite, d.reperes.xBordDroit);
    assert.deepEqual(Object.keys(d.voies).sort(), ["droite", "gauche"]);
    assert.deepEqual(etendue(d.voies.droite, 0), [7.5, 11]);
  }
});

test("rue : une bande de stationnement négative ou non numérique est refusée, avec son nom dans le message", () => {
  for (const stationnement of [-0.5, NaN, Infinity, "2", null]) {
    assert.throws(() => rue({ ...RUE, stationnement }),
      new RegExp(`rue : « stationnement » attend un nombre de mètres positif ou nul \\(reçu : ${String(stationnement)}\\)`));
  }
});

test("rue avec stationnement : une voiture garée à DESSIN.jeuStationnement du trottoir a son centre dans la bande ; une voiture au centre de la voie de droite la dépasse à 0,75 m, sans franchir l'axe ni la toucher", () => {
  const d = rue(RUE_STATIONNEMENT);
  const { xAxe, xBordDroit } = d.reperes;
  const pose = { x: xBordDroit - DESSIN.jeuStationnement - DESSIN.demiLargeurVoiture, y: 30, cap: -90 };
  const garee = { id: "garee", gabarit: "voiture", pose };
  const empriseGaree = emprise("voiture", { x: pose.x, y: pose.y, cap: pose.cap * DEG });
  proche(xBordDroit - etendue(empriseGaree, 0)[1], DESSIN.jeuStationnement, 1e-9, "flanc droit de la voiture garée");
  assert.ok(pointDansPolygone([pose.x, pose.y], d.voies.stationnement), "centre de la voiture garée dans la bande");
  // Bande de 2,0 m, voiture de 1,8 m à 0,3 m du trottoir : elle déborde de 0,1 m sur la voie de droite.
  proche(xAxe + DESSIN.voie - etendue(empriseGaree, 0)[0], 0.1, 1e-9, "débord sur la voie de droite");
  const chemin = trajet(xAxe + DESSIN.voie / 2, RUE.longueur - DESSIN.retraitBord, -90).droit(RUE.longueur - 2 * DESSIN.retraitBord).fin();
  const essai = sceneEssai(d, chemin);
  assert.deepEqual(controlerScene({ ...essai, acteurs: [...essai.acteurs, garee] }), []);
  proche(etendue(empriseGaree, 0)[0] - etendue(emprise("voiture", pointA(chemin, 30)), 0)[1], 0.75, 1e-9, "écart entre les flancs");
});

test("routeVirages : paramètres refusés avec leur nom dans le message (longueurs, rayon, angle, décalage du trajet)", () => {
  assert.throws(() => routeVirages({ ...VIRAGES, approche: undefined }),
    /routeVirages : « approche » attend un nombre de mètres strictement positif \(reçu : undefined\)/);
  assert.throws(() => routeVirages({ ...VIRAGES, entreVirages: 0 }), /routeVirages : « entreVirages »/);
  assert.throws(() => routeVirages({ ...VIRAGES, sortie: -2 }), /routeVirages : « sortie »/);
  assert.throws(() => routeVirages({ ...VIRAGES, largeurTrottoir: NaN }), /routeVirages : « largeurTrottoir »/);
  assert.throws(() => routeVirages({ ...VIRAGES, rayon: 0 }), /routeVirages : « rayon » attend un nombre de mètres/);
  assert.throws(() => routeVirages({ ...VIRAGES, rayon: DESSIN.voie }), /routeVirages : « rayon » de 3.5 m/);
  for (const angle of [0, -30, 91, NaN]) assert.throws(() => routeVirages({ ...VIRAGES, angle }), /routeVirages : « angle »/);
  assert.throws(() => routeVirages({ ...VIRAGES, approche: 0.5 }), /routeVirages : « approche » de 0.5 m/);
  assert.throws(() => routeVirages({ ...VIRAGES, sortie: 0.4 }), /routeVirages : « sortie » de 0.4 m/);
  assert.throws(() => routeVirages(), /« approche »/);
  assert.doesNotThrow(() => routeVirages({ ...VIRAGES, angle: 90 }));
  const d = routeVirages(VIRAGES);
  for (const decalage of [DESSIN.voie / 2, -DESSIN.voie / 2, 2, NaN]) {
    assert.throws(() => d.reperes.cheminAxeVoieDroite(decalage), /cheminAxeVoieDroite : décalage de .* m/);
  }
  assert.doesNotThrow(() => d.reperes.cheminAxeVoieDroite(1.7));
});

test("rue et routeVirages : décors clonables par structuredClone, comme toute définition de scène ; cheminAxeVoieDroite n'est pas une donnée énumérée", () => {
  // tests/scenes.test.mjs copie chaque définition de scène, décor compris, par structuredClone : une fonction énumérée
  // dans le décor ferait échouer cette copie.
  const r = rue(RUE);
  assert.deepEqual(structuredClone(r), r);
  const s = rue(RUE_STATIONNEMENT);
  assert.deepEqual(structuredClone(s), s);
  const d = routeVirages(VIRAGES);
  assert.deepEqual(structuredClone(d), d);
  assert.equal(typeof d.reperes.cheminAxeVoieDroite, "function");
  assert.deepEqual(Object.keys(d.reperes), ["rayon", "angle", "xAxeApproche", "xAxeSortie", "centres", "s"]);
});
