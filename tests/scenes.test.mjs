import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../js/scenes.js";
import { controlerScene } from "../js/scene-controles.js";
import { angleRegard } from "../js/scene-regard.js";
import { KMH, DEG, preparerScene, etatActeur, emprise, tempsAtteint, centreArc, rectangle, pointDansPolygone,
  polygonesSeChevauchent } from "../js/scene-geometrie.js";
import { DESSIN } from "../js/scene-decors.js";
import { SIGNAUX } from "../js/signaux.js";

const erreurs = (def) => controlerScene(def).join("\n");
const copie = (code) => structuredClone(SCENES[code].construire());
const proche = (a, b, eps = 1e-6, quoi = "") => assert.ok(Math.abs(a - b) <= eps, `${quoi}${quoi ? " : " : ""}${a} au lieu de ${b}`);

// ===== Règles de regard et de rythme, pour toutes les scènes (amendement du 03/10, relecture de la tâche 8) =====
const PAS = 0.1;                                   // s : échantillonnage, celui des contrôles automatiques
const ROULE = 0.5;                                 // m/s : au-delà, l'élève roule
const DUREE_MIN = { etape: 1.0, balayage: 2.0 };   // s à l'écran ; 2,0 s : un aller-retour complet du balayage

// Étape active à l'instant t, comme dans le moteur : la dernière commencée.
function etapeActive(sc, t) {
  let k = 0;
  sc.etapes.forEach((e, i) => { if (t + 1e-9 >= e.t) k = i; });
  return k;
}

// Chemins des objets non gelés d'une valeur, en profondeur.
function nonGeles(valeur, chemin = "définition", vus = new Set()) {
  if (valeur === null || typeof valeur !== "object" || vus.has(valeur)) return [];
  vus.add(valeur);
  const ici = Object.isFrozen(valeur) ? [] : [chemin];
  return ici.concat(...Object.entries(valeur).map(([k, v]) => nonGeles(v, `${chemin}.${k}`, vus)));
}

for (const [code, entree] of Object.entries(SCENES)) {
  test(`scène ${code} : conforme à tous les contrôles automatiques`, () => {
    assert.deepEqual(controlerScene(entree.construire()), []);
  });
  test(`scène ${code} : registre complet`, () => {
    const def = entree.construire();
    assert.equal(def.code, code);
    assert.equal(entree.etapesModele.length, def.etapes.length, "un intitulé proposé par étape");
    assert.ok(entree.sources.length >= 3, "sources consignées");
    for (const p of def.decor.panneaux) {
      assert.ok(SIGNAUX[p.code] && SIGNAUX[p.code].fichier, `panneau ${p.code} hors du registre vérifié`);
    }
  });
  test(`scène ${code} : tant que l'élève roule, le regard ne perd jamais la cible qu'il suit`, () => {
    // La scène change d'étape avant que la cible sorte du champ du conducteur (REGARD_MAX_SUIVI).
    const sc = preparerScene(entree.construire());
    const perdue = [];
    for (let k = 0; k * PAS <= sc.duree + 1e-9; k++) {
      const t = k * PAS, etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(sc.eleve, t);
      if (!(etape.regard && etape.regard.suivre) || e.v <= ROULE) continue;
      const etats = new Map(sc.acteurs.map((a) => [a.id, etatActeur(a, t)]));
      if (angleRegard(etape, e, t, etats) === null) perdue.push(`t = ${t.toFixed(1)} s`);
    }
    assert.deepEqual(perdue, []);
  });
  test(`scène ${code} : chaque étape dure au moins 1,0 s à l'écran, un balayage au moins 2,0 s`, () => {
    const sc = preparerScene(entree.construire());
    sc.etapes.forEach((e, i) => {
      const fin = i + 1 < sc.etapes.length ? sc.etapes[i + 1].t : sc.duree;   // la dernière, jusqu'à la fin de la scène
      const min = e.regard && e.regard.balayage ? DUREE_MIN.balayage : DUREE_MIN.etape;
      assert.ok(fin - e.t >= min - 1e-9, `étape ${i + 1} : ${(fin - e.t).toFixed(3)} s à l'écran, ${min} s au moins`);
    });
  });
  test(`scène ${code} : définition construite une seule fois et gelée en profondeur`, () => {
    const def = entree.construire();
    assert.equal(entree.construire(), def, "même objet à chaque appel");
    assert.deepEqual(nonGeles(def), []);
    // Les modules sont en mode strict : toute écriture dans la définition lève une erreur.
    assert.throws(() => { def.titre = "autre"; }, TypeError);
    assert.throws(() => { def.acteurs[0].profil[0].kmh = 0; }, TypeError);
    assert.throws(() => { def.etapes.push({ s: 0 }); }, TypeError);
    assert.throws(() => { def.decor.obstacles[0].poly[0][0] = 0; }, TypeError);
    // Une copie se modifie librement : les tests de sabotage travaillent sur structuredClone.
    const c = copie(code);
    c.acteurs[0].profil[0].kmh = 0;
    assert.notEqual(def.acteurs[0].profil[0].kmh, 0);
  });
}

// ===== Sabotages : chaque défaut est refusé par le contrôle qui le vise =====

test("tourner-droite : un clignotant à gauche est détecté", () => {
  const def = copie("tourner-droite");
  def.acteurs[0].clignotant = [{ cote: "gauche", de: 0.5, a: 40 }];
  assert.match(erreurs(def), /clignotant droite attendu/);
});

test("tourner-droite : repartir avant que le piéton ait libéré la voie est détecté", () => {
  const def = copie("tourner-droite");
  def.acteurs[0].profil = def.acteurs[0].profil.map((p) => (p.pause ? { ...p, pause: 0.2 } : p));
  assert.match(erreurs(def), /avant que pieton en soit sorti|eleve et pieton se touchent/);
});

test("tourner-droite : une voiture qui mord la voie opposée est détectée", () => {
  const def = copie("tourner-droite");
  // Même trajet décalé de 1,5 m vers la gauche : la voiture déborde sur la voie de l'autre sens.
  for (const seg of def.acteurs[0].chemin.segments) seg.x0 -= 1.5;
  assert.match(erreurs(def), /sort de « voie de droite, branche sud »/);
});

test("tourner-droite : un clignotant coupé dans l'arc est détecté", () => {
  const def = copie("tourner-droite");
  const arc = def.acteurs[0].chemin.segments.find((s) => s.type === "arc" && !s.decalage);
  def.acteurs[0].clignotant = [{ cote: "droite", de: 0.5, a: arc.debut + 1 }];
  assert.match(erreurs(def), /clignotant droite éteint pendant le changement de direction/);
});

// ===== tourner-droite : la scène suit la fiche ECF C2-E (amendement du 03/10) =====
//
// Les instants se lisent sur la définition même (trajet, profil, chronologie, emprises), jamais recopiés à la main.

function lireTournerDroite() {
  const def = SCENES["tourner-droite"].construire(), sc = preparerScene(def);
  const eleve = sc.eleve, pieton = sc.acteurs.find((a) => a.id === "pieton");
  const segments = eleve.chemin.segments;
  const arc = segments.find((s) => s.type === "arc" && !s.decalage);
  const sVirage = arc.debut, sFinVirage = arc.debut + arc.longueur;
  return { def, sc, eleve, pieton, segments, arc, decalage: segments.filter((s) => s.decalage), sVirage, sFinVirage,
    tVirage: tempsAtteint(eleve.chrono, sVirage), tFinVirage: tempsAtteint(eleve.chrono, sFinVirage), reperes: def.decor.reperes };
}

// Premier instant de [t0, t1] où vrai(t) devient vrai : balayage au centième de seconde, puis dichotomie. null sinon.
function premierInstant(vrai, t0, t1) {
  if (vrai(t0)) return t0;
  for (let prec = t0, t = t0 + 0.01; t <= t1 + 1e-9; prec = t, t += 0.01) {
    if (!vrai(t)) continue;
    let lo = prec, hi = t;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (vrai(m)) hi = m; else lo = m; }
    return hi;
  }
  return null;
}

const kmh = (acteur, t) => etatActeur(acteur, t).v / KMH;

test("tourner-droite : centre de la voie, puis serrer à droite de 0,25 m sur 12 m au moins, virage concentrique à la bordure", () => {
  const { segments, decalage, arc, reperes } = lireTournerDroite();
  const h = DESSIN.voie, serrer = h / 2 - DESSIN.demiLargeurVoiture - DESSIN.margeTrajectoire;
  proche(serrer, 0.25, 1e-12);
  proche(segments[0].x0, reperes.cx + h / 2, 1e-9, "départ au centre de la voie");
  proche(segments[0].cap, -90 * DEG, 1e-12);
  assert.equal(decalage.length, 2, "un décalage vers la droite, en deux arcs opposés");
  const apres = segments[segments.indexOf(decalage[1]) + 1];
  proche(apres.x0 - decalage[0].x0, serrer, 1e-9, "décalage vers la droite");
  proche(apres.cap, -90 * DEG, 1e-12);
  assert.ok(decalage[0].y0 - apres.y0 >= 12 - 1e-9, "décalage étalé sur 12 m au moins");
  // Flanc droit à DESSIN.margeTrajectoire (0,60 m) de la bordure de la voie entrante (x = cx + h).
  proche(reperes.cx + h - (apres.x0 + DESSIN.demiLargeurVoiture), DESSIN.margeTrajectoire, 1e-9, "flanc droit");
  // Virage à droite de 90 degrés concentrique à l'arrondi de la bordure : 6 + 0,6 + 0,9 = 7,5 m.
  assert.equal(segments.indexOf(arc), segments.indexOf(apres) + 1, "le virage suit l'approche décalée");
  const rond = reperes.arrondi.SE, centre = centreArc(arc);
  proche(arc.angle, 90 * DEG, 1e-12);
  proche(centre.x, rond.x, 1e-9); proche(centre.y, rond.y, 1e-9);
  proche(arc.rayon, rond.r + DESSIN.margeTrajectoire + DESSIN.demiLargeurVoiture, 1e-9);
  proche(arc.rayon, 7.5, 1e-9);
});

test("tourner-droite : 25 km/h, réduits à 10 km/h avant l'arc et tenus jusqu'au freinage, 2,0 m/s² de décélération et 1,5 m/s² de reprise au plus", () => {
  const { sc, eleve, tVirage, tFinVirage } = lireTournerDroite();
  proche(kmh(eleve, 0), 25, 1e-9, "allure d'approche");
  // L'allure est réduite avant le virage, jamais pendant : 10 km/h atteints avant l'arc, puis tenus dans l'arc
  // jusqu'au freinage pour le piéton.
  const tDix = premierInstant((t) => kmh(eleve, t) <= 10 + 1e-9, 0, tVirage);
  assert.ok(tDix !== null && tDix < tVirage, "10 km/h atteints avant l'arc");
  const tFrein = premierInstant((t) => kmh(eleve, t) < 10 - 1e-9, tDix, tFinVirage);
  assert.ok(tFrein > tVirage, "pas de freinage avant l'arc une fois les 10 km/h atteints");
  for (let t = tDix; t < tFrein; t += 0.01) proche(kmh(eleve, t), 10, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    const a = etatActeur(eleve, t).a;
    assert.ok(a >= -2.0 - 1e-9 && a <= 1.5 + 1e-9, `accélération de ${a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
});

test("tourner-droite : clignotant droit de s = 0,5 m jusqu'à la fin de l'arc, allumé au moins 3 s avant l'arc", () => {
  const { def, eleve, sFinVirage, tVirage } = lireTournerDroite();
  assert.deepEqual(def.acteurs[0].clignotant, [{ cote: "droite", de: 0.5, a: sFinVirage }]);
  assert.ok(tVirage - tempsAtteint(eleve.chrono, 0.5) >= 3, "allumé au moins 3 s avant l'arc");
});

test("tourner-droite : le piéton pose le pied sur la chaussée pendant l'arc, la voiture freine au plus tôt 1,0 s après et s'arrête l'avant à 0,3 m du passage", () => {
  const { sc, eleve, pieton, reperes, tVirage, tFinVirage } = lireTournerDroite();
  const { bord } = reperes, passage = reperes.passages.est;
  // Il attend sur le trottoir nord, à 0,5 m du bord, au milieu du passage.
  const p0 = etatActeur(pieton, 0);
  proche(p0.x, (passage.x0 + passage.x1) / 2, 1e-9);
  proche(bord.nord - p0.y, 0.5, 1e-9);
  const chaussee = rectangle(passage.x0 - 1, bord.nord, passage.x1 + 1, bord.sud);
  const tPied = premierInstant((t) => polygonesSeChevauchent(emprise("pieton", etatActeur(pieton, t)), chaussee), 0, sc.duree);
  assert.ok(tPied > tVirage && tPied < tFinVirage, `pied sur la chaussée à t = ${tPied.toFixed(3)} s, hors de l'arc`);
  const tFrein = premierInstant((t) => kmh(eleve, t) < 10 - 1e-9, tVirage, tFinVirage);
  assert.ok(tFrein - tPied >= 1.0 - 1e-6, `freinage ${(tFrein - tPied).toFixed(3)} s après le pied sur la chaussée`);
  // Arrêt : coin le plus avancé de la voiture à 0,3 m du passage, au centimètre près (abscisse calculée au centimètre).
  const tArret = premierInstant((t) => etatActeur(eleve, t).v < 1e-9, tFrein, tFinVirage);
  const coin = Math.max(...emprise("voiture", etatActeur(eleve, tArret)).map(([x]) => x));
  proche(passage.x0 - coin, 0.3, 0.01, "écart entre l'avant arrêté et le passage");
});

test("tourner-droite : la voiture repart 0,6 s après que le piéton est entier sur le trottoir sud (dégagement complet)", () => {
  const { sc, eleve, pieton, def, tVirage, tFinVirage } = lireTournerDroite();
  const trottoirs = def.decor.obstacles.filter((o) => o.nature === "trottoir").map((o) => o.poly);
  const surTrottoir = (t) => {
    const coins = emprise("pieton", etatActeur(pieton, t));
    return trottoirs.some((poly) => coins.every((p) => pointDansPolygone(p, poly)));
  };
  assert.ok(surTrottoir(0), "il attend sur le trottoir nord");
  const tQuitte = premierInstant((t) => !surTrottoir(t), 0, sc.duree);
  const tSud = premierInstant(surTrottoir, tQuitte, sc.duree);
  assert.ok(tSud !== null, "il atteint le trottoir sud");
  const tArret = premierInstant((t) => etatActeur(eleve, t).v < 1e-9, tVirage, tFinVirage);
  const tReprise = premierInstant((t) => etatActeur(eleve, t).v > 1e-9, tArret, sc.duree);
  proche(tReprise - tSud, 0.6, 1e-6, "délai entre le dégagement complet et le redémarrage");
});

test("tourner-droite : huit étapes de la fiche, dans l'ordre, chacune avec son regard et à son moment", () => {
  assert.deepEqual(SCENES["tourner-droite"].etapesModele, [
    "Contrôler et mettre le clignotant",
    "Serrer à droite, sans se coller au trottoir",
    "Réduire l'allure avant le virage",
    "Balayer l'intersection du regard",
    "Contrôler l'angle mort droit",
    "Tourner en regardant la sortie",
    "Céder le passage au piéton",
    "Repartir une fois le passage dégagé",
  ]);
  const { def, sc, eleve, pieton, decalage, tVirage, tFinVirage } = lireTournerDroite();
  assert.deepEqual(def.etapes.map((e) => e.regard), [
    { angle: 165 }, { angle: 0 }, { angle: 0 }, { balayage: true }, { angle: 150 }, { angle: 40 }, { suivre: "pieton" }, { angle: 0 },
  ]);
  const T = sc.etapes.map((e) => e.t);
  proche(T[0], 0, 1e-12, "contrôles et clignotant dès le début");
  proche(T[1], tempsAtteint(eleve.chrono, decalage[0].debut), 1e-9, "serrer : début du décalage");
  proche(T[2], premierInstant((t) => kmh(eleve, t) < 25 - 1e-9, 0, tVirage), 1e-6, "réduire : début du ralentissement");
  proche(T[3], premierInstant((t) => kmh(eleve, t) <= 10 + 1e-9, 0, tVirage), 1e-6, "balayer : allure réduite atteinte");
  proche(T[5], tVirage, 1e-9, "tourner : dès l'entrée dans l'arc, l'angle mort juste avant");
  proche(T[6], pieton.depart, 1e-6, "céder : dès que le piéton se met en marche");
  const tArret = premierInstant((t) => etatActeur(eleve, t).v < 1e-9, tVirage, tFinVirage);
  proche(T[7], premierInstant((t) => etatActeur(eleve, t).v > 1e-9, tArret, sc.duree), 1e-6, "repartir : au redémarrage");
});
