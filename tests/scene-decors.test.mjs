import { test } from "node:test";
import assert from "node:assert/strict";
import { DEG, GABARITS, emprise, pointA, pointDansPolygone, polygonesSeChevauchent, rectangle } from "../js/scene-geometrie.js";
import { IISR, DESSIN, HORS_MONDE, carrefourEnCroix, giratoire, trajetGiratoire } from "../js/scene-decors.js";

const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} au lieu de ${b}`);
const surTrottoir = (d, p) => d.obstacles.some((o) => o.nature === "trottoir" && pointDansPolygone([p.x, p.y], o.poly));

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

test("carrefour en croix : cédez-le-passage des branches est et ouest (IISR 117-4 B)", () => {
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 8 }, passages: ["est"] });
  const { cx, cy } = d.reperes;
  const est = d.marquages.find((m) => m.role === "cedez-est");
  assert.equal(est.largeur, 0.5); assert.equal(est.trait, 0.5); assert.equal(est.vide, 0.5);
  assert.deepEqual([est.de[1], est.a[1]], [cy - DESSIN.voie, cy], "sur la seule voie entrante");
  // Axiale continue sur 15 m de route avant la ligne, interrompue à 0,50 m du passage.
  const continues = d.marquages.filter((m) => m.type === "ligne" && !m.trait && m.de[1] === cy && m.de[0] >= cx);
  const peint = continues.reduce((n, m) => n + Math.abs(m.a[0] - m.de[0]), 0);
  proche(peint, IISR.axialeContinueAvantCedez - (IISR.passage.longueur + 2 * IISR.passage.interruptionAxiale));
  for (const p of d.panneaux) assert.ok(surTrottoir(d, p), `${p.code} hors du trottoir`);
  assert.equal(d.panneaux.filter((p) => p.code === "AB3a").length, 2);
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
