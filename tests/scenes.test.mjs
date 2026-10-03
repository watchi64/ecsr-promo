import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../js/scenes.js";
import { controlerScene } from "../js/scene-controles.js";
import { oeil, angleRegard, coneRegard, regardContient } from "../js/scene-regard.js";
import { KMH, DEG, preparerScene, etatActeur, emprise, tempsAtteint, centreArc, pointA, pointDansPolygone,
  polygonesSeChevauchent } from "../js/scene-geometrie.js";
import { DESSIN } from "../js/scene-decors.js";
import { SIGNAUX } from "../js/signaux.js";

const erreurs = (def) => controlerScene(def).join("\n");
const copie = (code) => structuredClone(SCENES[code].construire());
const proche = (a, b, eps = 1e-6, quoi = "") => assert.ok(Math.abs(a - b) <= eps, `${quoi}${quoi ? " : " : ""}${a} au lieu de ${b}`);

// ===== Règles de regard et de rythme, pour toutes les scènes (amendements du 03/10, relectures de la tâche 8) =====
const PAS = 0.1;                                   // s : échantillonnage, celui des contrôles automatiques
const ROULE = 0.5;                                 // m/s : au-delà, l'élève roule
const ARRET = 0.01;                                // m/s : en deçà, l'élève est arrêté (comme pour l'attente arretAvant)
const DUREE_MIN = { etape: 1.0, balayage: 2.0 };   // s à l'écran ; 2,0 s : un aller-retour complet du balayage

// Étape active à l'instant t, comme dans le moteur : la dernière commencée.
function etapeActive(sc, t) {
  let k = 0;
  sc.etapes.forEach((e, i) => { if (t + 1e-9 >= e.t) k = i; });
  return k;
}
const instantsPas = (sc) => Array.from({ length: Math.floor(sc.duree / PAS + 1e-9) + 1 }, (_, k) => k * PAS);
const etatsA = (sc, t) => new Map(sc.acteurs.map((a) => [a.id, etatActeur(a, t)]));

// Chemins des objets non gelés d'une valeur, en profondeur.
function nonGeles(valeur, chemin = "définition", vus = new Set()) {
  if (valeur === null || typeof valeur !== "object" || vus.has(valeur)) return [];
  vus.add(valeur);
  const ici = Object.isFrozen(valeur) ? [] : [chemin];
  return ici.concat(...Object.entries(valeur).map(([k, v]) => nonGeles(v, `${chemin}.${k}`, vus)));
}

// Pour chaque attente « cede » : instants où l'élève est arrêté avant d'entrer dans la zone, que l'autre usager n'a
// pas encore quittée, sans que l'étape active suive cet usager du regard. Entrée et sortie mesurées comme le contrôle.
function regardsHorsCede(def) {
  const sc = preparerScene(def);
  const fautes = [];
  for (const att of (def.attentes || []).filter((a) => a.type === "cede")) {
    const eleve = sc.acteurs.find((a) => a.id === att.acteur), autre = sc.acteurs.find((a) => a.id === att.autre);
    let entree = Infinity, sortie = -Infinity;
    for (const t of instantsPas(sc)) {
      const ea = etatActeur(eleve, t), eb = etatActeur(autre, t);
      if (entree === Infinity && ea.visible && polygonesSeChevauchent(emprise(eleve.gabarit, ea), att.zone)) entree = t;
      if (eb.visible && polygonesSeChevauchent(emprise(autre.gabarit, eb), att.zone)) sortie = t;
    }
    for (const t of instantsPas(sc)) {
      if (etatActeur(eleve, t).v >= ARRET || t >= entree || t > sortie) continue;
      const r = sc.etapes[etapeActive(sc, t)].regard;
      if (!(r && r.suivre === att.autre)) fautes.push(`${att.nom} : t = ${t.toFixed(1)} s`);
    }
  }
  return fautes;
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
    for (const t of instantsPas(sc)) {
      const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(sc.eleve, t);
      if (!(etape.regard && etape.regard.suivre) || e.v <= ROULE) continue;
      if (angleRegard(etape, e, t, etatsA(sc, t)) === null) perdue.push(`t = ${t.toFixed(1)} s`);
    }
    assert.deepEqual(perdue, []);
  });
  test(`scène ${code} : arrêté pour céder le passage, l'élève suit du regard l'usager à qui il le cède`, () => {
    assert.deepEqual(regardsHorsCede(entree.construire()), []);
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

test("tourner-droite : un regard qui quitte le piéton pendant l'attente est détecté", () => {
  const def = copie("tourner-droite");
  const etape = def.etapes.find((e) => e.regard && e.regard.suivre === "pieton");
  etape.regard = { angle: 0 };
  assert.ok(regardsHorsCede(def).length > 0);
});

test("tourner-gauche : tourner avant que le véhicule d'en face soit passé est détecté", () => {
  const def = copie("tourner-gauche");
  // L'élève repart presque aussitôt et le véhicule d'en face arrive une seconde plus tard :
  // l'élève coupe sa voie avant qu'il l'ait libérée.
  def.acteurs[0].profil = def.acteurs[0].profil.map((p) => (p.pause ? { ...p, pause: 0.2 } : p));
  def.acteurs[1].depart += 1;
  def.etapes = def.etapes.slice(0, 5);
  assert.match(erreurs(def), /avant que enFace en soit sorti|eleve et enFace se touchent/);
});

test("tourner-gauche : dépasser l'axe médian avant de tourner est détecté", () => {
  const def = copie("tourner-gauche");
  for (const seg of def.acteurs[0].chemin.segments) seg.x0 -= 0.5;
  assert.match(erreurs(def), /sort de « moitié droite de la chaussée »/);
});

test("tourner-gauche : un regard qui quitte le véhicule d'en face pendant l'attente est détecté", () => {
  const def = copie("tourner-gauche");
  const etape = def.etapes.find((e) => e.regard && e.regard.suivre === "enFace");
  etape.regard = { angle: 0 };
  assert.ok(regardsHorsCede(def).length > 0);
});

// ===== tourner-droite : la scène suit la fiche ECF C2-E (amendements du 03/10) =====
//
// Les instants se lisent sur la définition même (trajet, chronologie, emprises), jamais recopiés à la main.

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

function lireTournerDroite() {
  const def = SCENES["tourner-droite"].construire(), sc = preparerScene(def);
  const eleve = sc.eleve, pieton = sc.acteurs.find((a) => a.id === "pieton");
  const segments = eleve.chemin.segments;
  const arc = segments.find((s) => s.type === "arc" && !s.decalage);
  const sVirage = arc.debut, sFinVirage = arc.debut + arc.longueur;
  const tVirage = tempsAtteint(eleve.chrono, sVirage), tFinVirage = tempsAtteint(eleve.chrono, sFinVirage);
  const tArret = premierInstant((t) => etatActeur(eleve, t).v < 1e-9, tVirage, tFinVirage);
  const tReprise = premierInstant((t) => etatActeur(eleve, t).v > 1e-9, tArret, sc.duree);
  return { def, sc, eleve, pieton, segments, arc, decalage: segments.filter((s) => s.decalage), sVirage, sFinVirage,
    tVirage, tFinVirage, tArret, tReprise, T: sc.etapes.map((e) => e.t), reperes: def.decor.reperes };
}

// Cadre de la caméra pour l'état e de l'élève, comme le moteur : centré sur lui, borné au monde.
function cadre(def, e) {
  const { largeur: w, hauteur: h } = def.camera;
  return { x0: Math.min(Math.max(e.x - w / 2, 0), def.monde.largeur - w), y0: Math.min(Math.max(e.y - h / 2, 0), def.monde.hauteur - h), w, h };
}

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

test("tourner-droite : 25 km/h, 10 km/h avant le balayage, freinage doux (1,0 m/s² au plus) 1,0 s après l'entrée dans l'arc, reprise de 1,5 m/s² au plus", () => {
  const { sc, eleve, tVirage, tArret, T } = lireTournerDroite();
  proche(kmh(eleve, 0), 25, 1e-9, "allure d'approche");
  // L'allure est réduite avant le virage, jamais pendant : 10 km/h atteints avant le balayage, puis tenus dans l'arc
  // jusqu'au freinage pour le piéton, qui commence 1,0 s après l'entrée dans l'arc.
  const tDix = premierInstant((t) => kmh(eleve, t) <= 10 + 1e-9, 0, tVirage);
  assert.ok(tDix !== null && tDix <= T[3] + 1e-9, "10 km/h atteints avant le balayage");
  const tFrein = premierInstant((t) => kmh(eleve, t) < 10 - 1e-9, tDix, tArret);
  proche(tFrein - tVirage, 1.0, 1e-6, "début du freinage après l'entrée dans l'arc");
  for (let t = tDix; t < tFrein; t += 0.01) proche(kmh(eleve, t), 10, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  // Décélération de 2,0 m/s² au plus pour réduire l'allure, de 1,0 m/s² au plus pour s'arrêter devant le passage.
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    const a = etatActeur(eleve, t).a, plancher = t >= tFrein && t <= tArret ? -1.0 : -2.0;
    assert.ok(a >= plancher - 1e-9 && a <= 1.5 + 1e-9, `accélération de ${a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
});

test("tourner-droite : contrôler puis indiquer, clignotant droit allumé dans la seconde moitié du coup d'œil aux rétroviseurs, au moins 3 s avant l'arc, jusqu'à la fin de l'arc", () => {
  const { def, eleve, sFinVirage, tVirage, T } = lireTournerDroite();
  assert.equal(def.acteurs[0].clignotant.length, 1, "un seul clignotant");
  const [clignotant] = def.acteurs[0].clignotant;
  assert.equal(clignotant.cote, "droite");
  proche(clignotant.a, sFinVirage, 1e-9, "allumé jusqu'à la fin de l'arc");
  // Le coup d'œil commence sans clignotant (contrôler d'abord) ; le clignotant s'allume avant que l'étape 2 commence,
  // pour que l'étape « Contrôler et mettre le clignotant » le montre : 0,5 s avant la fin du coup d'œil.
  const tAllume = tempsAtteint(eleve.chrono, clignotant.de);
  assert.equal(etatActeur(eleve, T[0]).clignotant, null, "le coup d'œil commence sans clignotant");
  assert.ok(tAllume > T[0] && tAllume < T[1], `clignotant allumé à t = ${tAllume.toFixed(3)} s, hors de l'étape 1`);
  assert.equal(etatActeur(eleve, T[1]).clignotant, "droite", "déjà allumé quand l'étape 2 commence");
  assert.ok(tAllume >= (T[0] + T[1]) / 2, "dans la seconde moitié du coup d'œil");
  proche(T[1] - tAllume, 0.5, 1e-9, "0,5 s avant la fin du coup d'œil");
  assert.ok(tVirage - tAllume >= 3, "allumé au moins 3 s avant l'arc");
});

test("tourner-droite : cadre de 46 m qui suit l'élève, cône des rétroviseurs entier dans le monde pendant l'étape 1", () => {
  const { def, sc, eleve, T } = lireTournerDroite();
  assert.deepEqual(def.camera, { largeur: def.monde.largeur, hauteur: 46 });
  for (let t = 0; t < T[1]; t += 0.01) {
    const e = etatActeur(eleve, t);
    for (const [x, y] of coneRegard(angleRegard(sc.etapes[0], e, t, etatsA(sc, t)), oeil(e))) {
      assert.ok(x >= 0 && x <= def.monde.largeur && y >= 0 && y <= def.monde.hauteur,
        `cône hors du monde à t = ${t.toFixed(2)} s : (${x.toFixed(2)} ; ${y.toFixed(2)})`);
    }
  }
});

test("tourner-droite : pendant le balayage, à 10 km/h, le piéton qui attend est dans le cadre et le cône le contient au moins un instant", () => {
  const { def, sc, eleve, pieton, T } = lireTournerDroite();
  const instants = instantsPas(sc).filter((t) => t + 1e-9 >= T[3] && t < T[4]);
  assert.ok(instants.length >= DUREE_MIN.balayage / PAS - 1, "le balayage est échantillonné");
  const vu = [];
  for (const t of instants) {
    const e = etatActeur(eleve, t), p = etatActeur(pieton, t), c = cadre(def, e);
    proche(e.v / KMH, 10, 1e-9, `allure à t = ${t.toFixed(1)} s`);
    assert.equal(p.v, 0, `le piéton attend à t = ${t.toFixed(1)} s`);
    for (const [x, y] of emprise("pieton", p)) {
      assert.ok(x >= c.x0 && x <= c.x0 + c.w && y >= c.y0 && y <= c.y0 + c.h, `piéton hors du cadre à t = ${t.toFixed(1)} s`);
    }
    if (regardContient(angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t)), oeil(e), p)) vu.push(t);
  }
  assert.ok(vu.length > 0, "le cône du balayage contient le piéton qui attend au moins un instant");
});

test("tourner-droite : 1,0 s après l'entrée dans l'arc, le conducteur suit le piéton qui attend et freine ; le piéton s'engage au plus 0,5 s avant l'arrêt", () => {
  const { sc, eleve, pieton, reperes, tVirage, tArret, T } = lireTournerDroite();
  const passage = reperes.passages.est;
  // Il attend au milieu du passage, son centre à 0,5 m du bord du trottoir nord.
  const p0 = etatActeur(pieton, 0);
  proche(p0.x, (passage.x0 + passage.x1) / 2, 1e-9);
  proche(reperes.bord.nord - p0.y, 0.5, 1e-9);
  proche(T[6], tVirage + 1.0, 1e-6, "étape 7 : 1,0 s après l'entrée dans l'arc");
  const tFrein = premierInstant((t) => kmh(eleve, t) < 10 - 1e-9, tVirage, tArret);
  proche(tFrein, T[6], 1e-6, "le freinage commence avec l'étape 7");
  assert.equal(etatActeur(pieton, tFrein).v, 0, "le piéton attend encore quand la voiture commence à freiner");
  // Pendant tout le freinage, le regard suit le piéton et le cône le contient.
  for (const t of instantsPas(sc).filter((t) => t + 1e-9 >= T[6] && t < tArret)) {
    const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(eleve, t);
    assert.equal(etape.regard.suivre, "pieton", `t = ${t.toFixed(1)} s`);
    assert.ok(regardContient(angleRegard(etape, e, t, etatsA(sc, t)), oeil(e), etatActeur(pieton, t)), `piéton hors du cône à t = ${t.toFixed(1)} s`);
  }
  // Il se met en marche quand la voiture est sur le point de s'arrêter.
  assert.ok(pieton.depart < tArret && tArret - pieton.depart <= 0.5 + 1e-9,
    `piéton en marche ${(tArret - pieton.depart).toFixed(3)} s avant l'arrêt`);
  // Arrêt : coin le plus avancé de la voiture à 0,3 m du passage, au centimètre près (abscisse calculée au centimètre).
  const coin = Math.max(...emprise("voiture", etatActeur(eleve, tArret)).map(([x]) => x));
  proche(passage.x0 - coin, 0.3, 0.01, "écart entre l'avant arrêté et le passage");
});

test("tourner-droite : la voiture repart 0,6 s après que le piéton est entier sur le trottoir sud (dégagement complet)", () => {
  const { sc, pieton, def, tReprise } = lireTournerDroite();
  const trottoirs = def.decor.obstacles.filter((o) => o.nature === "trottoir").map((o) => o.poly);
  const surTrottoir = (t) => {
    const coins = emprise("pieton", etatActeur(pieton, t));
    return trottoirs.some((poly) => coins.every((p) => pointDansPolygone(p, poly)));
  };
  assert.ok(surTrottoir(0), "il attend sur le trottoir nord");
  const tQuitte = premierInstant((t) => !surTrottoir(t), 0, sc.duree);
  const tSud = premierInstant(surTrottoir, tQuitte, sc.duree);
  assert.ok(tSud !== null, "il atteint le trottoir sud");
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
  const { def, eleve, decalage, tVirage, tReprise, T } = lireTournerDroite();
  assert.deepEqual(def.etapes.map((e) => e.regard), [
    { angle: 170 }, { angle: 0 }, { angle: 0 }, { balayage: true }, { angle: 120 }, { angle: 40 }, { suivre: "pieton" }, { angle: 0 },
  ]);
  proche(T[0], 0, 1e-12, "rétroviseurs dès le début");
  proche(T[1], tempsAtteint(eleve.chrono, decalage[0].debut), 1e-9, "serrer : début du décalage");
  proche(T[2], premierInstant((t) => kmh(eleve, t) < 25 - 1e-9, 0, tVirage), 1e-6, "réduire : début du ralentissement");
  proche(kmh(eleve, T[3]), 10, 1e-9, "balayer : à allure réduite");
  proche(T[4], tVirage - 1.0, 1e-6, "angle mort : la dernière seconde avant l'arc");
  proche(T[5], tVirage, 1e-9, "tourner : dès l'entrée dans l'arc");
  proche(T[6], tVirage + 1.0, 1e-6, "céder : 1,0 s après l'entrée dans l'arc");
  proche(T[7], tReprise, 1e-6, "repartir : au redémarrage");
});

// ===== tourner-gauche : la scène suit la fiche ECF C2-E (amendements du 03/10) =====
//
// Comme pour tourner-droite, les instants se lisent sur la définition (trajet, chronologie, emprises).

function lireTournerGauche() {
  const def = SCENES["tourner-gauche"].construire(), sc = preparerScene(def);
  const eleve = sc.eleve, enFace = sc.acteurs.find((a) => a.id === "enFace");
  const segments = eleve.chemin.segments;
  const arc = segments.find((s) => s.type === "arc" && !s.decalage);
  const sVirage = arc.debut, sFinVirage = arc.debut + arc.longueur;
  const tVirage = tempsAtteint(eleve.chrono, sVirage), tFinVirage = tempsAtteint(eleve.chrono, sFinVirage);
  const tArret = premierInstant((t) => etatActeur(eleve, t).v < 1e-9, 0, tFinVirage);
  const tReprise = premierInstant((t) => etatActeur(eleve, t).v > 1e-9, tArret, sc.duree);
  // Zone de conflit de l'attente « cede » : instants où le véhicule d'en face y entre et en sort (son emprise la touche).
  const zone = def.attentes.find((a) => a.type === "cede").zone;
  const touche = (t) => {
    const e = etatActeur(enFace, t);
    return e.visible && polygonesSeChevauchent(emprise("voiture", e), zone);
  };
  const tEntreeFace = premierInstant(touche, 0, sc.duree);
  const tSortieFace = premierInstant((t) => !touche(t), tEntreeFace, sc.duree);
  return { def, sc, eleve, enFace, segments, arc, decalage: segments.filter((s) => s.decalage), sVirage, sFinVirage,
    tVirage, tFinVirage, tArret, tReprise, tEntreeFace, tSortieFace, T: sc.etapes.map((e) => e.t), reperes: def.decor.reperes };
}

test("tourner-gauche : centre de la voie, puis serrer à gauche de 0,60 m sur 12 m au moins, flanc gauche à 0,25 m de l'axe médian sans toucher sa peinture", () => {
  const { def, eleve, segments, decalage, arc, reperes, tVirage } = lireTournerGauche();
  proche(segments[0].x0, reperes.cx + DESSIN.voie / 2, 1e-9, "départ au centre de la voie");
  proche(segments[0].cap, -90 * DEG, 1e-12);
  assert.equal(decalage.length, 2, "un décalage vers la gauche, en deux arcs opposés");
  const apres = segments[segments.indexOf(decalage[1]) + 1];
  proche(decalage[0].x0 - apres.x0, 0.6, 1e-9, "décalage vers la gauche");
  proche(apres.cap, -90 * DEG, 1e-12);
  assert.ok(decalage[0].y0 - apres.y0 >= 12 - 1e-9, "décalage étalé sur 12 m au moins");
  proche(apres.x0 - DESSIN.demiLargeurVoiture - reperes.cx, 0.25, 1e-9, "flanc gauche à 0,25 m de l'axe médian");
  assert.equal(segments.indexOf(arc), segments.indexOf(apres) + 1, "le virage suit l'approche décalée");
  // Sans dépasser l'axe médian (R415-4 II) : jusqu'à l'arc, l'emprise ne touche pas la peinture de l'axe de la branche sud.
  const axe = def.decor.marquages.find((m) => m.type === "ligne" && m.de[0] === reperes.cx && m.a[0] === reperes.cx
    && m.de[1] === reperes.bord.sud);
  const bordAxe = reperes.cx + axe.largeur / 2;
  for (let t = 0; t <= tVirage + 1e-9; t += 0.01) {
    const xMin = Math.min(...emprise("voiture", etatActeur(eleve, t)).map(([x]) => x));
    assert.ok(xMin > bordAxe, `flanc gauche sur la peinture de l'axe à t = ${t.toFixed(2)} s (x = ${xMin.toFixed(3)})`);
  }
});

test("tourner-gauche : attente au début de l'arc, l'avant au plus à la hauteur du centre de l'intersection, puis virage de 4,1 m de rayon au moins jusqu'au centre de la voie de sortie ouest", () => {
  const { eleve, arc, reperes, sVirage, tArret, tReprise } = lireTournerGauche();
  // Ne pas trop s'avancer avant d'amorcer le virage : jusqu'au redémarrage, aucun point de la voiture ne dépasse le centre.
  for (let t = 0; t <= tReprise + 1e-9; t += 0.01) {
    const yAvant = Math.min(...emprise("voiture", etatActeur(eleve, t)).map(([, y]) => y));
    assert.ok(yAvant >= reperes.cy, `avant ${(reperes.cy - yAvant).toFixed(3)} m au-delà du centre à t = ${t.toFixed(2)} s`);
  }
  const e = etatActeur(eleve, tArret);
  proche(e.s, sVirage, 1e-6, "arrêt au début de l'arc");
  proche(e.cap, -90 * DEG, 1e-12, "voiture droite, vers le nord, pendant l'attente");
  assert.ok(arc.rayon >= 4.1, `rayon de ${arc.rayon} m`);
  proche(arc.angle, -90 * DEG, 1e-12, "quart de tour à gauche");
  const fin = pointA(eleve.chemin, sVirage + arc.longueur);
  proche(fin.y, reperes.cy - DESSIN.voie / 2, 1e-9, "fin de l'arc au centre de la voie de sortie ouest");
  proche(fin.cap, -180 * DEG, 1e-12);
});

test("tourner-gauche : ne pas couper le virage, le point central de l'intersection reste à gauche de la voiture, à 0,30 m au moins de son centre", () => {
  const { eleve, reperes } = lireTournerGauche();
  let plusPres = null;
  for (let s = 0; s <= eleve.chemin.longueur; s += 0.001) {
    const p = pointA(eleve.chemin, s), d = Math.hypot(reperes.cx - p.x, reperes.cy - p.y);
    if (!plusPres || d < plusPres.d) plusPres = { d, p, s };
  }
  const { d, p, s } = plusPres;
  assert.ok(d >= 0.30, `point central à ${d.toFixed(3)} m du centre de la voiture (s = ${s.toFixed(3)} m)`);
  // À gauche du cap : produit vectoriel (cap, direction du point central) négatif, l'axe y étant tourné vers le bas.
  const produit = Math.cos(p.cap) * (reperes.cy - p.y) - Math.sin(p.cap) * (reperes.cx - p.x);
  assert.ok(produit < 0, "point central à gauche de la voiture, au plus près");
});

test("tourner-gauche : tourner après le point central, le centre de la voiture le contourne par le nord-est sans entrer dans le coin sud-ouest", () => {
  const { eleve, reperes } = lireTournerGauche();
  const { cx, cy } = reperes;
  let surAxeEstOuest = null, surAxeNordSud = null;
  for (let s = 0; s <= eleve.chemin.longueur; s += 0.001) {
    const p = pointA(eleve.chemin, s);
    assert.ok(!(p.x < cx && p.y > cy), `le centre de la voiture coupe le coin sud-ouest à s = ${s.toFixed(3)} m`);
    if (!surAxeEstOuest && p.y <= cy) surAxeEstOuest = p;
    if (!surAxeNordSud && p.x <= cx) surAxeNordSud = p;
  }
  assert.ok(surAxeEstOuest.x > cx, `axe est-ouest franchi en x = ${surAxeEstOuest.x.toFixed(3)}, pas à l'est du point central`);
  assert.ok(surAxeNordSud.y < cy, `axe nord-sud franchi en y = ${surAxeNordSud.y.toFixed(3)}, pas au nord du point central`);
});

test("tourner-gauche : 25 km/h, 10 km/h avant le balayage, arrêt pour céder, décélérations de 2,0 m/s² au plus, reprise de 1,5 m/s² au plus sans dépasser 10 km/h dans l'arc", () => {
  const { sc, eleve, tArret, tReprise, tFinVirage, T } = lireTournerGauche();
  proche(kmh(eleve, 0), 25, 1e-9, "allure d'approche");
  // Allure réduite avant l'intersection : 10 km/h atteints avant le balayage et tenus jusqu'au freinage pour le
  // véhicule d'en face (étape 5).
  const tDix = premierInstant((t) => kmh(eleve, t) <= 10 + 1e-9, 0, tArret);
  assert.ok(tDix !== null && tDix <= T[3] + 1e-9, "10 km/h atteints avant le balayage");
  for (let t = tDix; t < T[4]; t += 0.01) proche(kmh(eleve, t), 10, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  // Dans l'arc, reprise jusqu'à 10 km/h au plus et aucun freinage : l'allure se réduit avant le virage, jamais pendant.
  for (let t = tReprise; t <= tFinVirage + 1e-9; t += 0.01) {
    const e = etatActeur(eleve, t);
    assert.ok(e.v / KMH <= 10 + 1e-9 && e.a >= -1e-9, `${(e.v / KMH).toFixed(3)} km/h et ${e.a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
  proche(kmh(eleve, tFinVirage), 10, 1e-9, "10 km/h à la fin de l'arc");
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    const a = etatActeur(eleve, t).a;
    assert.ok(a >= -2.0 - 1e-9 && a <= 1.5 + 1e-9, `accélération de ${a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
});

test("tourner-gauche : contrôler puis indiquer, clignotant gauche allumé dans la seconde moitié du coup d'œil aux rétroviseurs, au moins 3 s avant l'arc, jusqu'à la fin de l'arc", () => {
  const { def, eleve, sFinVirage, tVirage, T } = lireTournerGauche();
  assert.equal(def.acteurs[0].clignotant.length, 1, "un seul clignotant");
  const [clignotant] = def.acteurs[0].clignotant;
  assert.equal(clignotant.cote, "gauche");
  proche(clignotant.a, sFinVirage, 1e-9, "allumé jusqu'à la fin de l'arc");
  const tAllume = tempsAtteint(eleve.chrono, clignotant.de);
  assert.equal(etatActeur(eleve, T[0]).clignotant, null, "le coup d'œil commence sans clignotant");
  assert.ok(tAllume > T[0] && tAllume < T[1], `clignotant allumé à t = ${tAllume.toFixed(3)} s, hors de l'étape 1`);
  assert.equal(etatActeur(eleve, T[1]).clignotant, "gauche", "déjà allumé quand l'étape 2 commence");
  assert.ok(tAllume >= (T[0] + T[1]) / 2, "dans la seconde moitié du coup d'œil");
  proche(T[1] - tAllume, 0.5, 1e-9, "0,5 s avant la fin du coup d'œil");
  assert.ok(tVirage - tAllume >= 3, "allumé au moins 3 s avant l'arc");
});

test("tourner-gauche : cadre de 46 m qui suit l'élève, cône des rétroviseurs entier dans le monde pendant l'étape 1", () => {
  const { def, sc, eleve, T } = lireTournerGauche();
  assert.ok(def.monde.hauteur > 46, "monde plus haut que le cadre");
  assert.deepEqual(def.camera, { largeur: def.monde.largeur, hauteur: 46 });
  for (let t = 0; t < T[1]; t += 0.01) {
    const e = etatActeur(eleve, t);
    for (const [x, y] of coneRegard(angleRegard(sc.etapes[0], e, t, etatsA(sc, t)), oeil(e))) {
      assert.ok(x >= 0 && x <= def.monde.largeur && y >= 0 && y <= def.monde.hauteur,
        `cône hors du monde à t = ${t.toFixed(2)} s : (${x.toFixed(2)} ; ${y.toFixed(2)})`);
    }
  }
});

test("tourner-gauche : balayage à 10 km/h, carrefour dans le cadre, le cône contient au moins un instant le point central et l'entrée de chaque voie qui arrive dans l'intersection", () => {
  const { def, sc, eleve, reperes, T } = lireTournerGauche();
  const { cx, cy, bord } = reperes, h = DESSIN.voie;
  const cedez = (cote) => def.decor.marquages.find((m) => m.role === "cedez-" + cote).de[0];
  const cibles = {
    "point central de l'intersection": { x: cx, y: cy },
    "voie entrante ouest, à sa ligne de cédez-le-passage": { x: cedez("ouest"), y: cy + h / 2 },
    "voie du véhicule d'en face, au bord nord du carrefour": { x: cx - h / 2, y: bord.nord },
    "voie entrante est, à sa ligne de cédez-le-passage": { x: cedez("est"), y: cy - h / 2 },
  };
  const instants = instantsPas(sc).filter((t) => t + 1e-9 >= T[3] && t < T[4]);
  assert.ok(instants.length >= DUREE_MIN.balayage / PAS - 1, "le balayage est échantillonné");
  const vus = new Map(Object.keys(cibles).map((nom) => [nom, 0]));
  for (const t of instants) {
    const e = etatActeur(eleve, t), c = cadre(def, e);
    proche(e.v / KMH, 10, 1e-9, `allure à t = ${t.toFixed(1)} s`);
    for (const [x, y] of def.decor.zones.carrefour) {
      assert.ok(x >= c.x0 && x <= c.x0 + c.w && y >= c.y0 && y <= c.y0 + c.h, `carrefour hors du cadre à t = ${t.toFixed(1)} s`);
    }
    const angle = angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t));
    for (const [nom, p] of Object.entries(cibles)) if (regardContient(angle, oeil(e), p)) vus.set(nom, vus.get(nom) + 1);
  }
  for (const [nom, n] of vus) assert.ok(n > 0, `le cône du balayage ne contient jamais : ${nom}`);
});

test("tourner-gauche : le véhicule d'en face roule à 30 km/h, part et finit hors du monde, et entre dans le carrefour 0,3 s après l'arrêt de l'élève", () => {
  const { def, sc, enFace, reperes, tArret } = lireTournerGauche();
  const ys = (t) => emprise("voiture", etatActeur(enFace, t)).map(([, y]) => y);
  assert.ok(enFace.depart > 0 && Math.max(...ys(enFace.depart)) < 0, "part au-delà du bord nord du monde");
  assert.ok(Math.min(...ys(enFace.chrono.duree)) > def.monde.hauteur, "finit au-delà du bord sud du monde");
  for (let t = enFace.depart; t <= enFace.chrono.duree; t += 0.01) proche(kmh(enFace, t), 30, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  const tEntree = premierInstant((t) => Math.max(...ys(t)) >= reperes.bord.nord, enFace.depart, sc.duree);
  proche(tEntree - tArret, 0.3, 1e-6, "entrée dans le carrefour après l'arrêt de l'élève");
});

test("tourner-gauche : l'élève suit des yeux le véhicule d'en face dès qu'il ralentit pour lui, jusqu'à ce qu'il ait quitté la zone de conflit", () => {
  const { def, sc, eleve, enFace, tArret, tSortieFace, T } = lireTournerGauche();
  // L'étape 5 commence avec le freinage pour céder le passage ; le véhicule d'en face est alors déjà à l'image.
  proche(T[4], premierInstant((t) => kmh(eleve, t) < 10 - 1e-9, T[3], tArret), 1e-6, "étape 5 au début du freinage");
  const eF = etatActeur(enFace, T[4]);
  assert.ok(eF.visible, "parti quand l'élève ralentit pour lui");
  assert.ok(Math.max(...emprise("voiture", eF).map(([, y]) => y)) > cadre(def, etatActeur(eleve, T[4])).y0,
    "dans le cadre quand l'élève ralentit pour lui");
  const instants = instantsPas(sc).filter((t) => t + 1e-9 >= T[4] && t <= tSortieFace);
  for (const t of instants) {
    const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(eleve, t);
    assert.equal(etape.regard.suivre, "enFace", `t = ${t.toFixed(1)} s`);
    // Le cône ne le lâche qu'une fois l'élève arrêté et le véhicule d'en face passé à sa hauteur (derrière son œil).
    if (angleRegard(etape, e, t, etatsA(sc, t)) === null) {
      assert.ok(e.v === 0 && etatActeur(enFace, t).y > oeil(e).y, `regard perdu à t = ${t.toFixed(1)} s`);
    }
  }
  // Arrêté, l'élève le garde dans le cône tant qu'il arrive vers lui.
  for (const t of instants.filter((t) => t >= tArret)) {
    const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(eleve, t), f = etatActeur(enFace, t);
    if (f.y >= oeil(e).y) continue;
    assert.ok(regardContient(angleRegard(etape, e, t, etatsA(sc, t)), oeil(e), f), `véhicule d'en face hors du cône à t = ${t.toFixed(1)} s`);
  }
});

test("tourner-gauche : angle mort gauche contrôlé à l'arrêt, au début de l'arc, une fois le véhicule d'en face sorti de la zone de conflit", () => {
  const { eleve, sVirage, tArret, tReprise, tSortieFace, T } = lireTournerGauche();
  assert.ok(T[5] > tSortieFace && T[5] > tArret, "angle mort après la sortie du véhicule d'en face, voiture arrêtée");
  proche(T[6], tReprise, 1e-6, "le virage commence au redémarrage, après l'angle mort");
  for (let t = T[5]; t < T[6]; t += 0.01) {
    const e = etatActeur(eleve, t);
    assert.ok(e.v === 0 && Math.abs(e.s - sVirage) < 1e-9, `voiture en mouvement pendant l'angle mort à t = ${t.toFixed(2)} s`);
  }
});

test("tourner-gauche : huit étapes de la fiche, dans l'ordre, chacune avec son regard et à son moment", () => {
  assert.deepEqual(SCENES["tourner-gauche"].etapesModele, [
    "Contrôler et mettre le clignotant",
    "Serrer à gauche, près de l'axe sans le franchir",
    "Réduire l'allure",
    "Balayer l'intersection du regard",
    "Céder le passage au véhicule d'en face",
    "Contrôler l'angle mort gauche",
    "Tourner après le point central",
    "Rejoindre la voie de droite",
  ]);
  const { def, eleve, decalage, tArret, tReprise, tFinVirage, tSortieFace, T } = lireTournerGauche();
  assert.deepEqual(def.etapes.map((e) => e.regard), [
    { angle: -170 }, { angle: 0 }, { angle: 0 }, { balayage: true }, { suivre: "enFace" }, { angle: -120 }, { angle: -40 }, { angle: 0 },
  ]);
  proche(T[0], 0, 1e-12, "rétroviseurs dès le début");
  proche(T[1], tempsAtteint(eleve.chrono, decalage[0].debut), 1e-9, "serrer : début du décalage");
  proche(T[2], premierInstant((t) => kmh(eleve, t) < 25 - 1e-9, 0, tArret), 1e-6, "réduire : début du ralentissement");
  proche(T[4] - T[3], 2.0, 1e-6, "balayer : les 2,0 s qui précèdent le freinage");
  proche(T[4], premierInstant((t) => kmh(eleve, t) < 10 - 1e-9, T[3], tArret), 1e-6, "céder : début du freinage");
  proche(T[5], tSortieFace + 0.4, 1e-6, "angle mort : 0,4 s après la sortie du véhicule d'en face");
  proche(T[6], tReprise, 1e-6, "tourner : au redémarrage");
  proche(T[7], tFinVirage, 1e-6, "rejoindre la voie de droite : à la fin de l'arc");
});
