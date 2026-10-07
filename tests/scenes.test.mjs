import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../js/scenes.js";
import { controlerScene, SEUILS } from "../js/scene-controles.js";
import { REGARD_PORTEE, REGARD_DUREE_TOUR_MIN, oeil, angleRegard, cibleSuivie, coneRegard, regardContient } from "../js/scene-regard.js";
import { KMH, DEG, GABARITS, preparerScene, etatActeur, emprise, tempsAtteint, centreArc, pointA, pointDansPolygone,
  polygonesSeChevauchent, rectangle } from "../js/scene-geometrie.js";
import { DESSIN, trajetGiratoire } from "../js/scene-decors.js";
import { SIGNAUX } from "../js/signaux.js";

const erreurs = (def) => controlerScene(def).join("\n");
const copie = (code) => structuredClone(SCENES[code].construire());
const proche = (a, b, eps = 1e-6, quoi = "") => assert.ok(Math.abs(a - b) <= eps, `${quoi}${quoi ? " : " : ""}${a} au lieu de ${b}`);

// ===== Règles de regard et de rythme, pour toutes les scènes (amendements du 03/10, relectures de la tâche 8) =====
const PAS = SEUILS.pas;                            // s : échantillonnage, celui des contrôles automatiques
const ROULE = 0.5;                                 // m/s : au-delà, l'élève roule
const ARRET = 0.01;                                // m/s : en deçà, l'élève est arrêté (comme pour l'attente arretAvant)
// s à l'écran ; 2,0 s : un aller-retour complet du balayage ; un tour du regard : REGARD_DUREE_TOUR_MIN (js/scene-regard.js)
const DUREE_MIN = { etape: 1.0, balayage: 2.0, tour: REGARD_DUREE_TOUR_MIN };

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

// Instants où l'élève roule pendant une étape qui suit un usager sans que le conducteur le suive des yeux (cible
// invisible, ou passée derrière lui au-delà de REGARD_MAX_SUIVI : son regard est alors ramené devant). La scène doit
// changer d'étape avant que la cible sorte du champ du conducteur.
function ciblesPerdues(def) {
  const sc = preparerScene(def);
  const perdues = [];
  for (const t of instantsPas(sc)) {
    const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(sc.eleve, t);
    if (!(etape.regard && etape.regard.suivre) || e.v <= ROULE) continue;
    if (cibleSuivie(etape, e, etatsA(sc, t)) === null) perdues.push(`t = ${t.toFixed(1)} s`);
  }
  return perdues;
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

// Étapes trop courtes à l'écran, de leur début à celui de la suivante (la dernière, jusqu'à la fin de la scène) : au
// moins DUREE_MIN.etape, un balayage au moins DUREE_MIN.balayage, un tour du regard au moins DUREE_MIN.tour.
function etapesTropCourtes(def) {
  const sc = preparerScene(def);
  const fautes = [];
  sc.etapes.forEach((e, i) => {
    const fin = i + 1 < sc.etapes.length ? sc.etapes[i + 1].t : sc.duree;
    const r = e.regard || {};
    const min = r.balayage ? DUREE_MIN.balayage : r.tour ? DUREE_MIN.tour : DUREE_MIN.etape;
    if (fin - e.t < min - 1e-9) fautes.push(`étape ${i + 1} : ${(fin - e.t).toFixed(3)} s à l'écran, ${min} s au moins`);
  });
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
    assert.deepEqual(ciblesPerdues(entree.construire()), []);
  });
  test(`scène ${code} : arrêté pour céder le passage, l'élève suit du regard l'usager à qui il le cède`, () => {
    assert.deepEqual(regardsHorsCede(entree.construire()), []);
  });
  test(`scène ${code} : chaque étape dure au moins 1,0 s à l'écran, un balayage au moins 2,0 s, un tour du regard au moins 4 s`, () => {
    assert.deepEqual(etapesTropCourtes(entree.construire()), []);
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
    // Une copie se modifie librement : les tests de sabotage travaillent sur structuredClone. La valeur écrite diffère de
    // l'originale, que la scène commence en roulant ou à l'arrêt.
    const c = copie(code);
    const kmhDepart = def.acteurs[0].profil[0].kmh;
    c.acteurs[0].profil[0].kmh = kmhDepart + 1;
    assert.equal(def.acteurs[0].profil[0].kmh, kmhDepart);
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

test("tourner-droite : une étape qui suit encore le piéton une fois la voiture repartie est détectée", () => {
  // Sans l'étape « Repartir », l'étape qui suit le piéton dure pendant que la voiture s'éloigne : il passe derrière le
  // conducteur, qui ne le suit plus des yeux (son regard est ramené devant) alors que l'étape affichée dit le contraire.
  const def = copie("tourner-droite");
  def.etapes = def.etapes.slice(0, 7);
  assert.ok(ciblesPerdues(def).length > 0);
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

test("tourner-droite : un tour du regard de moins de 4 s, comme un balayage de moins de 2 s, est détecté ; un tour qui dure assez passe", () => {
  // Étape 4 : balayage de 2,0 s ; étape 5 : angle mort pendant 1,0 s ; étape 8 : regard devant pendant 5,9 s (repartir).
  const tourCourt = copie("tourner-droite");
  tourCourt.etapes[3].regard = { tour: true };
  assert.deepEqual(etapesTropCourtes(tourCourt), ["étape 4 : 2.000 s à l'écran, 4 s au moins"]);
  const balayageCourt = copie("tourner-droite");
  balayageCourt.etapes[4].regard = { balayage: true };
  assert.deepEqual(etapesTropCourtes(balayageCourt), ["étape 5 : 1.000 s à l'écran, 2 s au moins"]);
  const tourAssezLong = copie("tourner-droite");
  tourAssezLong.etapes[7].regard = { tour: true };
  assert.deepEqual(etapesTropCourtes(tourAssezLong), []);
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

const ALLURE_REDUITE = 8;   // km/h : allure du balayage, avant de s'arrêter pour céder (choix de dessin, sources de la scène)

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

test("tourner-gauche : 25 km/h, 8 km/h avant le balayage, arrêt pour céder, décélérations de 2,0 m/s² au plus, reprise de 1,5 m/s² au plus sans dépasser 10 km/h dans l'arc", () => {
  const { sc, eleve, tArret, tReprise, tFinVirage, T } = lireTournerGauche();
  proche(kmh(eleve, 0), 25, 1e-9, "allure d'approche");
  // Allure réduite avant l'intersection : 8 km/h atteints avant le balayage et tenus jusqu'au freinage pour le
  // véhicule d'en face (étape 5).
  const tReduite = premierInstant((t) => kmh(eleve, t) <= ALLURE_REDUITE + 1e-9, 0, tArret);
  assert.ok(tReduite !== null && tReduite <= T[3] + 1e-9, "allure réduite atteinte avant le balayage");
  for (let t = tReduite; t < T[4]; t += 0.01) proche(kmh(eleve, t), ALLURE_REDUITE, 1e-9, `allure à t = ${t.toFixed(2)} s`);
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

test("tourner-gauche : balayage à 8 km/h, carrefour dans le cadre, le cône contient au moins un instant le point central, l'entrée de chaque voie qui arrive dans l'intersection et le passage piéton de la voie de sortie", () => {
  const { def, sc, eleve, reperes, T } = lireTournerGauche();
  const { cx, cy, bord, passages } = reperes, h = DESSIN.voie;
  const cedez = (cote) => def.decor.marquages.find((m) => m.role === "cedez-" + cote).de[0];
  const cibles = {
    "point central de l'intersection": { x: cx, y: cy },
    "voie entrante ouest, à sa ligne de cédez-le-passage": { x: cedez("ouest"), y: cy + h / 2 },
    "voie du véhicule d'en face, au bord nord du carrefour": { x: cx - h / 2, y: bord.nord },
    "voie entrante est, à sa ligne de cédez-le-passage": { x: cedez("est"), y: cy - h / 2 },
    "passage piéton de la branche ouest, sur la voie de sortie": { x: (passages.ouest.x0 + passages.ouest.x1) / 2, y: cy - h / 2 },
  };
  const instants = instantsPas(sc).filter((t) => t + 1e-9 >= T[3] && t < T[4]);
  assert.ok(instants.length >= DUREE_MIN.balayage / PAS - 1, "le balayage est échantillonné");
  const vus = new Map(Object.keys(cibles).map((nom) => [nom, 0]));
  for (const t of instants) {
    const e = etatActeur(eleve, t), c = cadre(def, e);
    proche(e.v / KMH, ALLURE_REDUITE, 1e-9, `allure à t = ${t.toFixed(1)} s`);
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

test("tourner-gauche : l'élève suit des yeux le véhicule d'en face dès qu'il ralentit pour lui, puis, le véhicule passé, regarde de nouveau devant lui la voie d'en face avant l'angle mort", () => {
  const { def, sc, eleve, enFace, reperes, tArret, tSortieFace, T } = lireTournerGauche();
  // L'étape 5 commence avec le freinage pour céder le passage : le centre du véhicule d'en face est alors dans le cadre
  // et dans le cône.
  proche(T[4], premierInstant((t) => kmh(eleve, t) < ALLURE_REDUITE - 1e-9, T[3], tArret), 1e-6, "étape 5 au début du freinage");
  const e4 = etatActeur(eleve, T[4]), f4 = etatActeur(enFace, T[4]), c4 = cadre(def, e4);
  assert.ok(f4.visible, "parti quand l'élève ralentit pour lui");
  assert.ok(f4.x >= c4.x0 && f4.x <= c4.x0 + c4.w && f4.y >= c4.y0 && f4.y <= c4.y0 + c4.h,
    "centre du véhicule d'en face dans le cadre quand l'élève ralentit pour lui");
  assert.ok(regardContient(angleRegard(sc.etapes[4], e4, T[4], etatsA(sc, T[4])), oeil(e4), f4),
    "centre du véhicule d'en face dans le cône quand l'élève ralentit pour lui");
  // Pendant toute l'étape 5, l'étape suit le véhicule d'en face (jusqu'à sa sortie de la zone de conflit, et au-delà
  // jusqu'à l'angle mort) ; le regard est posé sur lui, sauf une fois l'élève arrêté et le véhicule passé derrière son
  // œil (au-delà de REGARD_MAX_SUIVI) : il est alors ramené devant, jamais absent.
  assert.ok(T[5] > tSortieFace, "étape 5 jusqu'après la sortie de la zone de conflit");
  const instants = instantsPas(sc).filter((t) => t + 1e-9 >= T[4] && t + 1e-9 < T[5]);
  const devant = [];
  for (const t of instants) {
    const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(eleve, t), etats = etatsA(sc, t);
    assert.equal(etape.regard.suivre, "enFace", `t = ${t.toFixed(1)} s`);
    if (cibleSuivie(etape, e, etats)) continue;
    assert.ok(e.v === 0 && etatActeur(enFace, t).y > oeil(e).y, `regard détourné du véhicule d'en face à t = ${t.toFixed(1)} s`);
    assert.equal(angleRegard(etape, e, t, etats), e.cap, `regard ramené devant à t = ${t.toFixed(1)} s`);
    devant.push(t);
  }
  // Arrêté, l'élève garde le véhicule d'en face dans le cône tant qu'il arrive vers lui.
  for (const t of instants.filter((t) => t >= tArret)) {
    const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(eleve, t), f = etatActeur(enFace, t);
    if (f.y >= oeil(e).y) continue;
    assert.ok(regardContient(angleRegard(etape, e, t, etatsA(sc, t)), oeil(e), f), `véhicule d'en face hors du cône à t = ${t.toFixed(1)} s`);
  }
  // Le véhicule passé, le regard ramené devant couvre de nouveau la voie d'en face en amont du carrefour (un autre
  // véhicule peut suivre le premier), jusqu'à l'angle mort.
  assert.ok(devant.length > 0, "regard ramené devant avant l'angle mort");
  for (let k = 1; k < devant.length; k++) proche(devant[k] - devant[k - 1], PAS, 1e-9, "regard ramené devant sans interruption");
  assert.ok(T[5] - devant[devant.length - 1] <= PAS + 1e-9, "regard ramené devant jusqu'à l'angle mort");
  for (const t of devant) {
    const e = etatActeur(eleve, t), angle = angleRegard(sc.etapes[4], e, t, etatsA(sc, t));
    for (const amont of [5, 10, 15]) {
      const p = { x: reperes.cx - DESSIN.voie / 2, y: reperes.bord.nord - amont };
      assert.ok(regardContient(angle, oeil(e), p), `voie d'en face, ${amont} m en amont du carrefour, hors du cône à t = ${t.toFixed(1)} s`);
    }
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
  proche(T[4], premierInstant((t) => kmh(eleve, t) < ALLURE_REDUITE - 1e-9, T[3], tArret), 1e-6, "céder : début du freinage");
  proche(T[5], tSortieFace + 0.4, 1e-6, "angle mort : 0,4 s après la sortie du véhicule d'en face");
  proche(T[6], tReprise, 1e-6, "tourner : au redémarrage");
  proche(T[7], tFinVirage, 1e-6, "rejoindre la voie de droite : à la fin de l'arc");
});

// ===== giratoire : la scène suit la fiche ECF C2-F (amendements du 03/10, réponses de Timy du 04/10) =====
//
// Comme pour les virages, les instants se lisent sur la définition (trajet, chronologie, emprises).

// km/h : choix de dessin consignés dans les sources de la scène. Approche du plan ; allure adaptée avant le
// cédez-le-passage ; petit giratoire urbain à 20 km/h dans l'anneau (choix de Timy) ; au plus 19 km/h dans les arcs
// d'entrée et de sortie (9,5 m de rayon : 20 km/h y donneraient 3,25 m/s² d'accélération latérale) ; allure cassée avant
// l'arc de sortie, celle de l'élève (ses contrôles de sortie tiennent avant l'arc) et celle de l'usager de l'anneau.
const GIRATOIRE_KMH = { approche: 30, adaptee: 15, anneau: 20, arcMax: 19, cassee: 11, casseeUsager: 15, sortie: 30 };

// Instants où l'élève de la scène préparée sc s'arrête pour la première fois, puis repart.
function arretEtReprise(sc) {
  const tArret = premierInstant((t) => etatActeur(sc.eleve, t).v < 1e-9, 0, sc.duree);
  const tReprise = premierInstant((t) => etatActeur(sc.eleve, t).v > 1e-9, tArret, sc.duree);
  return { tArret, tReprise };
}

function lireGiratoire() {
  const def = SCENES.giratoire.construire(), sc = preparerScene(def);
  const eleve = sc.eleve, anneau = sc.acteurs.find((a) => a.id === "anneau");
  const [arcEntree, arcAnneau, arcSortie] = eleve.chemin.segments.filter((s) => s.type === "arc");
  const tA = (s) => tempsAtteint(eleve.chrono, s);
  const { tArret, tReprise } = arretEtReprise(sc);
  // Zone de conflit de l'attente « cede » : instants où l'usager de l'anneau y entre et en sort (son emprise la touche).
  const zone = def.attentes.find((a) => a.type === "cede").zone;
  const touche = (t) => {
    const e = etatActeur(anneau, t);
    return e.visible && polygonesSeChevauchent(emprise("voiture", e), zone);
  };
  const tEntreeAnneau = premierInstant(touche, 0, sc.duree);
  const tSortieAnneau = premierInstant((t) => !touche(t), tEntreeAnneau, sc.duree);
  return { def, sc, eleve, anneau, arcEntree, arcAnneau, arcSortie, fin: (seg) => seg.debut + seg.longueur, tA, tArret, tReprise,
    tEntreeAnneau, tSortieAnneau, T: sc.etapes.map((e) => e.t), reperes: def.decor.reperes };
}

// Angle polaire (degrés) d'un point autour du centre de l'îlot : 0 à l'est, 90 au sud, -90 au nord (y vers le bas).
const polaire = (reperes, p) => Math.atan2(p.y - reperes.cy, p.x - reperes.cx) / DEG;
// Le point (centre d'un acteur) est-il dans le cadre c, bords compris ?
const dansCadre = (c, p) => p.x >= c.x0 && p.x <= c.x0 + c.w && p.y >= c.y0 && p.y <= c.y0 + c.h;

// Anneau parcouru en amont de l'entrée sud, d'où viendrait un autre usager : angles polaires de 100 à 170 degrés, tous les
// degrés (l'entrée sud est à 90, l'arc d'entrée ouest rejoint l'anneau à 148,5).
const AMONT = Array.from({ length: 71 }, (_, k) => 100 + k);

// Instants, au centième de seconde, de la sortie de l'usager de l'anneau de la zone de conflit au redémarrage de l'élève,
// et ceux où le cône du regard contient tout l'anneau en amont.
function anneauAmontRegarde(def) {
  const sc = preparerScene(def), eleve = sc.eleve, anneau = sc.acteurs.find((a) => a.id === "anneau");
  const { cx, cy, rAnneau } = def.decor.reperes;
  const zone = def.attentes.find((a) => a.type === "cede").zone;
  const touche = (t) => {
    const e = etatActeur(anneau, t);
    return e.visible && polygonesSeChevauchent(emprise("voiture", e), zone);
  };
  const { tReprise } = arretEtReprise(sc);
  const tSortie = premierInstant((t) => !touche(t), premierInstant(touche, 0, sc.duree), sc.duree);
  const points = AMONT.map((p) => ({ x: cx + rAnneau * Math.cos(p * DEG), y: cy + rAnneau * Math.sin(p * DEG) }));
  const instants = [], couverts = [];
  for (let t = tSortie; t < tReprise; t += 0.01) {
    instants.push(t);
    const e = etatActeur(eleve, t), angle = angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t));
    if (points.every((p) => regardContient(angle, oeil(e), p))) couverts.push(t);
  }
  return { instants, couverts, points };
}

// Sortie de l'élève, du redémarrage au début du balayage de la sortie, relevée au centième de seconde : la suite des
// regards (angle par rapport au cap, en degrés arrondis) avec l'état du clignotant, chaque élément avec sa durée.
function sequenceSortie(def) {
  const sc = preparerScene(def), eleve = sc.eleve;
  const { tReprise } = arretEtReprise(sc);
  const balayage = sc.etapes.find((e) => e.regard && e.regard.balayage && e.t > tReprise);
  assert.ok(balayage, "sortie : aucune étape de balayage de la sortie après le redémarrage");
  const tBalayage = balayage.t;
  const suite = [];
  for (let t = tReprise; t < tBalayage - 1e-9; t += 0.01) {
    const e = etatActeur(eleve, t), angle = angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t));
    let a = Math.round(((angle - e.cap) / DEG) % 360);
    if (a > 180) a -= 360;
    else if (a <= -180) a += 360;
    const libelle = e.clignotant ? `${a} + clignotant ${e.clignotant}` : String(a);
    const der = suite[suite.length - 1];
    if (der && der.libelle === libelle) der.duree += 0.01;
    else suite.push({ libelle, duree: 0.01 });
  }
  return suite;
}

// Assertion d'ordre de la sortie (C2.4 et thème 38 : rétroviseurs, clignotant, angle mort, manœuvre) : du redémarrage au
// balayage de la sortie, regard devant (insertion), puis 180 degrés sans clignotant (rétroviseur intérieur), clignotant
// droit allumé avec le regard vers la sortie (-21), puis 120 (angle mort droit) et -120 degrés (angle mort gauche),
// clignotant toujours allumé ; chacun de ces quatre regards pendant 1,0 s au moins. Lève une AssertionError sinon.
function verifierControlesSortie(def) {
  const suite = sequenceSortie(def);
  const libelles = suite.map((r) => r.libelle);
  assert.deepEqual(libelles, ["0", "180", "-21 + clignotant droite", "120 + clignotant droite", "-120 + clignotant droite"],
    `sortie : ${libelles.join(", ")}`);
  for (const r of suite.slice(1)) assert.ok(r.duree >= DUREE_MIN.etape - 0.011, `${r.libelle} pendant ${r.duree.toFixed(2)} s`);
}

test("giratoire : s'insérer devant un usager de l'anneau est détecté", () => {
  const def = copie("giratoire");
  // L'usager de l'anneau arrive trois secondes plus tard : l'élève, qui repart à l'heure
  // prévue, s'insère devant lui.
  def.acteurs[1].depart += 3;
  assert.match(erreurs(def), /avant que anneau en soit sorti|eleve et anneau se touchent/);
});

test("giratoire : un clignotant allumé avant la sortie précédente est détecté", () => {
  const def = copie("giratoire");
  def.acteurs[0].clignotant = [{ cote: "droite", de: 60, a: 200 }];
  assert.match(erreurs(def), /clignotant droite allumé avant/);
});

test("giratoire : la scène suit la voiture de l'élève", () => {
  const def = SCENES.giratoire.construire();
  assert.deepEqual(def.camera, { largeur: 40, hauteur: 46 });
});

test("giratoire : un regard qui quitte l'usager de l'anneau pendant l'attente est détecté", () => {
  const def = copie("giratoire");
  const etape = def.etapes.find((e) => e.regard && e.regard.suivre === "anneau");
  etape.regard = { angle: 0 };
  assert.ok(regardsHorsCede(def).length > 0);
});

test("giratoire : sortir sans contrôler l'angle mort droit est refusé par l'assertion d'ordre de la sortie", () => {
  // Étape de l'angle mort droit retirée : le regard vers la sortie dure jusqu'à l'angle mort gauche.
  const def = copie("giratoire");
  const k = def.etapes.findIndex((e) => e.regard && e.regard.angle === 120);
  assert.ok(k > 0, "étape de l'angle mort droit");
  def.etapes.splice(k, 1);
  assert.throws(() => verifierControlesSortie(def), /sortie : 0, 180, -21 \+ clignotant droite, -120 \+ clignotant droite(?!,)/);
});

test("giratoire : les deux angles morts gardés mais inversés (gauche, puis droit) sont refusés par l'assertion d'ordre de la sortie", () => {
  const def = copie("giratoire");
  const droit = def.etapes.find((e) => e.regard && e.regard.angle === 120);
  const gauche = def.etapes.find((e) => e.regard && e.regard.angle === -120);
  assert.ok(droit && gauche && def.etapes.indexOf(droit) + 1 === def.etapes.indexOf(gauche), "angle mort droit, puis gauche");
  [droit.regard, gauche.regard] = [gauche.regard, droit.regard];
  assert.throws(() => verifierControlesSortie(def),
    /sortie : 0, 180, -21 \+ clignotant droite, -120 \+ clignotant droite, 120 \+ clignotant droite(?!,)/);
});

test("giratoire : un clignotant rallumé seulement après les angles morts est refusé par l'assertion d'ordre de la sortie", () => {
  // Ordre de la fiche C2-F (angles morts, puis clignotant) au lieu de celui de C2.4 et du thème 38 : le clignotant ne
  // s'allume qu'au balayage de la sortie.
  const def = copie("giratoire");
  const sArret = def.acteurs[0].profil.find((p) => p.pause).s;
  const balayage = def.etapes.find((e) => e.regard && e.regard.balayage && e.s > sArret);
  assert.ok(balayage, "étape du balayage de la sortie");
  def.acteurs[0].clignotant[0].de = balayage.s;
  assert.throws(() => verifierControlesSortie(def), /sortie : 0, 180, -21, 120, -120(?!,)/);
  assert.match(erreurs(def), /clignotant droite attendu 2 s avant le changement de direction/);
});

test("giratoire : s'insérer sans regarder à gauche l'anneau en amont est détecté", () => {
  // Regard droit devant, ou usager de l'anneau suivi des yeux jusqu'au redémarrage : l'anneau d'où viendrait un autre
  // usager n'est jamais regardé entre la sortie du premier et l'insertion.
  const devant = copie("giratoire");
  assert.deepEqual(devant.etapes[4].regard, { angle: -55 }, "étape 5 : regard à gauche");
  devant.etapes[4].regard = { angle: 0 };
  assert.equal(anneauAmontRegarde(devant).couverts.length, 0);
  const sansEtape = copie("giratoire");
  sansEtape.etapes.splice(4, 1);
  assert.equal(anneauAmontRegarde(sansEtape).couverts.length, 0);
});

test("giratoire : un clignotant coupé dans l'arc de sortie est détecté", () => {
  const def = copie("giratoire");
  const arcSortie = def.acteurs[0].chemin.segments.filter((s) => s.type === "arc")[2];
  def.acteurs[0].clignotant = [{ cote: "droite", de: def.acteurs[0].clignotant[0].de, a: arcSortie.debut + 1 }];
  assert.match(erreurs(def), /clignotant droite éteint pendant le changement de direction/);
});

test("giratoire : un clignotant allumé moins de 2 s avant l'arc de sortie est détecté", () => {
  const def = copie("giratoire");
  const arcSortie = def.acteurs[0].chemin.segments.filter((s) => s.type === "arc")[2];
  def.acteurs[0].clignotant = [{ cote: "droite", de: arcSortie.debut - 2, a: arcSortie.debut + arcSortie.longueur }];
  assert.match(erreurs(def), /clignotant droite attendu 2 s avant le changement de direction/);
});

test("giratoire : sortir sans casser l'allure est détecté", () => {
  const def = copie("giratoire");
  // Après l'arrêt, l'allure cassée (11 km/h) est remplacée par celle de l'anneau : 20 km/h dans l'arc de sortie, de 9,5 m.
  const sArret = def.acteurs[0].profil.find((p) => p.pause).s;
  def.acteurs[0].profil = def.acteurs[0].profil.map((p) => (p.s > sArret && p.kmh === GIRATOIRE_KMH.cassee ? { ...p, kmh: GIRATOIRE_KMH.anneau } : p));
  assert.match(erreurs(def), /eleve : accélération latérale de 3\.\d+ m\/s²/);
});

test("giratoire : tourner autour de l'îlot dans le mauvais sens est détecté", () => {
  const def = copie("giratoire");
  const { cx } = def.decor.reperes;
  // Même trajet, en miroir de l'axe nord-sud : la voiture prend l'anneau par la gauche, dans le sens des aiguilles d'une montre.
  for (const seg of def.acteurs[0].chemin.segments) {
    seg.x0 = 2 * cx - seg.x0;
    seg.cap = Math.PI - seg.cap;
    if (seg.type === "arc") seg.angle = -seg.angle;
  }
  assert.match(erreurs(def), /eleve tourne dans le mauvais sens autour de « îlot central »/);
});

test("giratoire : trajet du décor, du sud au nord par la deuxième sortie, parti à 22 m du bord bas dans l'axe de la voie d'entrée", () => {
  const { def, eleve, arcEntree, arcAnneau, arcSortie, reperes } = lireGiratoire();
  const tr = trajetGiratoire(def.decor, "sud", "nord");
  // Le tracé est celui du décor, privé de ses premiers mètres : départ à REGARD_PORTEE du bord bas, pour que le cône du
  // rétroviseur intérieur, tourné vers l'arrière, tienne dans le monde.
  const coupe = REGARD_PORTEE - DESSIN.retraitBord;
  const depart = pointA(eleve.chemin, 0);
  proche(depart.x, reperes.cx + reperes.xLigne, 1e-9, "départ dans l'axe de la voie d'entrée");
  proche(def.monde.hauteur - depart.y, REGARD_PORTEE, 1e-9, "départ à 22 m du bord bas");
  proche(depart.cap, -90 * DEG, 1e-12);
  proche(eleve.chemin.longueur, tr.chemin.longueur - coupe, 1e-9, "longueur du trajet");
  for (let s = 0; s <= eleve.chemin.longueur; s += 0.25) {
    const a = pointA(eleve.chemin, s), b = pointA(tr.chemin, s + coupe);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-9 && Math.abs(a.cap - b.cap) < 1e-12, `écart au tracé du décor en s = ${s} m`);
  }
  // Arcs d'entrée et de sortie concentriques aux raccordements, à 0,6 m de la bordure (9,5 m de rayon) ; anneau parcouru
  // à 12,5 m du centre de l'îlot ; deuxième sortie, en face.
  for (const arc of [arcEntree, arcSortie]) proche(arc.rayon, 9.5, 1e-12);
  proche(arcAnneau.rayon, 12.5, 1e-12);
  proche(arcEntree.debut, tr.s.tangenceEntree - coupe, 1e-9);
  proche(arcAnneau.debut, tr.s.anneau - coupe, 1e-9);
  proche(arcSortie.debut, tr.s.sortie - coupe, 1e-9);
  const arrivee = pointA(eleve.chemin, eleve.chemin.longueur);
  proche(arrivee.x, reperes.cx + reperes.xLigne, 1e-9, "arrivée dans l'axe de la voie de sortie nord");
  proche(arrivee.cap, -90 * DEG, 1e-12);
});

test("giratoire : 30 km/h pendant le coup d'œil, allure adaptée à 15 km/h (1,0 m/s² au plus) avant le balayage, puis freinage de 2,0 m/s² au plus jusqu'à l'arrêt", () => {
  const { eleve, tArret, T } = lireGiratoire();
  for (let t = 0; t < T[1]; t += 0.01) proche(kmh(eleve, t), GIRATOIRE_KMH.approche, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  const tAdaptee = premierInstant((t) => kmh(eleve, t) <= GIRATOIRE_KMH.adaptee + 1e-9, 0, tArret);
  assert.ok(tAdaptee !== null && tAdaptee <= T[2] + 1e-9, "allure adaptée atteinte avant le balayage");
  for (let t = tAdaptee; t < T[3]; t += 0.01) proche(kmh(eleve, t), GIRATOIRE_KMH.adaptee, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  for (let t = T[1]; t < tAdaptee; t += 0.01) {
    const a = etatActeur(eleve, t).a;
    assert.ok(a >= -1.0 - 1e-9 && a <= 1e-9, `adapter l'allure : ${a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
  for (let t = T[3]; t < tArret; t += 0.01) {
    const a = etatActeur(eleve, t).a;
    assert.ok(a >= -2.0 - 1e-9 && a <= 1e-9, `freinage : ${a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
});

test("giratoire : reprise de 1,5 m/s² au plus, au plus 19 km/h dans l'arc d'entrée, 20 km/h dans l'anneau, allure cassée à 11 km/h avant l'arc de sortie et tenue jusqu'à sa fin", () => {
  const { sc, eleve, arcEntree, arcAnneau, arcSortie, fin, tA, tReprise, T } = lireGiratoire();
  const tAnneau = tA(arcAnneau.debut), tSortie = tA(arcSortie.debut), tFinSortie = tA(fin(arcSortie));
  for (let t = tReprise; t <= tAnneau + 1e-9; t += 0.01) {
    const e = etatActeur(eleve, t);
    assert.ok(e.v / KMH <= GIRATOIRE_KMH.arcMax + 1e-9 && e.a >= -1e-9 && e.a <= 1.5 + 1e-9,
      `arc d'entrée : ${(e.v / KMH).toFixed(3)} km/h et ${e.a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
  let vMax = 0;
  for (let t = tAnneau; t <= tSortie + 1e-9; t += 0.01) vMax = Math.max(vMax, kmh(eleve, t));
  proche(vMax, GIRATOIRE_KMH.anneau, 1e-9, "allure dans l'anneau");
  // Les 20 km/h sont réellement atteints avant de casser l'allure (début de l'étape 7) : tenus au moins 0,1 s, le pas des
  // contrôles automatiques, et non touchés un instant.
  const t20 = premierInstant((t) => kmh(eleve, t) >= GIRATOIRE_KMH.anneau - 1e-9, tReprise, sc.duree);
  assert.ok(t20 !== null && t20 <= T[6] + 1e-6, `20 km/h atteints à t = ${t20} s, après le début de l'étape 7 (t = ${T[6]} s)`);
  assert.ok(T[6] - t20 >= PAS - 1e-6, `palier à 20 km/h de ${(T[6] - t20).toFixed(3)} s`);
  for (let t = t20; t <= T[6] + 1e-9; t += 0.01) proche(kmh(eleve, t), GIRATOIRE_KMH.anneau, 1e-6, `palier, t = ${t.toFixed(2)} s`);
  for (let t = tSortie; t <= tFinSortie + 1e-9; t += 0.01) proche(kmh(eleve, t), GIRATOIRE_KMH.cassee, 1e-9, `arc de sortie, t = ${t.toFixed(2)} s`);
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    const a = etatActeur(eleve, t).a;
    assert.ok(a >= -2.0 - 1e-9 && a <= 1.5 + 1e-9, `accélération de ${a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
  // Accélération latérale sous 3,0 m/s² dans les trois arcs.
  for (const [nom, arc] of [["d'entrée", arcEntree], ["de l'anneau", arcAnneau], ["de sortie", arcSortie]]) {
    for (let t = tA(arc.debut); t <= tA(fin(arc)) + 1e-9; t += 0.01) {
      const e = etatActeur(eleve, t), lat = e.v * e.v * Math.abs(e.courbure);
      assert.ok(lat < 3.0, `arc ${nom} : ${lat.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
    }
  }
});

test("giratoire : pas de clignotant à l'entrée ; rétroviseur intérieur, puis clignotant droit après la sortie précédente (3 degrés au moins après son axe), puis les angles morts ; clignotant au moins 2 s avant l'arc de sortie, jusqu'à la fin de cet arc", () => {
  const { def, eleve, arcSortie, fin, tA, reperes, T } = lireGiratoire();
  assert.equal(def.acteurs[0].clignotant.length, 1, "un seul clignotant");
  const [clignotant] = def.acteurs[0].clignotant;
  assert.equal(clignotant.cote, "droite");
  proche(clignotant.a, fin(arcSortie), 1e-9, "allumé jusqu'à la fin de l'arc de sortie");
  // La sortie précédente est l'est, à l'angle polaire 0 ; on circule dans le sens des angles décroissants.
  const angleAllumage = polaire(reperes, pointA(eleve.chemin, clignotant.de));
  assert.ok(angleAllumage <= -DESSIN.clignotantApresAxe + 1e-9, `clignotant allumé à l'angle polaire ${angleAllumage.toFixed(2)}`);
  const tAllume = tA(clignotant.de);
  for (let t = 0; t < tAllume - 1e-6; t += 0.01) assert.equal(etatActeur(eleve, t).clignotant, null, `clignotant en marche à t = ${t.toFixed(2)} s`);
  // Ordre de C2.4 et du thème 38 : rétroviseur intérieur (étape 7), clignotant (il s'allume au début de l'étape 8), angle
  // mort droit (étape 9), angle mort gauche (étape 10), puis balayage de la sortie (étape 11).
  assert.ok(T[6] < T[7] && T[7] < T[8] && T[8] < T[9] && T[9] < T[10], "ordre de la sortie");
  proche(T[7], tAllume, 1e-9, "le clignotant s'allume au début de l'étape 8");
  const avance = tA(arcSortie.debut) - tAllume;
  assert.ok(avance >= 2.0, `allumé ${avance.toFixed(3)} s avant l'arc de sortie`);
  for (let t = tAllume; t <= tA(fin(arcSortie)) - 1e-6; t += 0.01) assert.equal(etatActeur(eleve, t).clignotant, "droite", `t = ${t.toFixed(2)} s`);
  assert.equal(etatActeur(eleve, tA(fin(arcSortie)) + 0.1).clignotant, null, "éteint après l'arc de sortie");
});

test("giratoire : sortie dans l'ordre de C2.4 et du thème 38 : rétroviseur intérieur, clignotant, angle mort droit, angle mort gauche, chacun pendant 1,0 s au moins", () => {
  verifierControlesSortie(SCENES.giratoire.construire());
});

test("giratoire : les deux angles morts finissent avant l'arc de sortie, et le balayage de la sortie commence avant lui", () => {
  const { arcSortie, fin, tA, T } = lireGiratoire();
  const tArc = tA(arcSortie.debut);
  // Étape 10 (angle mort gauche) de T[9] à T[10] ; étape 11 (balayage de la sortie) de T[10] à la fin de l'arc de sortie.
  assert.ok(T[10] < tArc, `angle mort gauche achevé à t = ${T[10].toFixed(3)} s, arc de sortie à t = ${tArc.toFixed(3)} s`);
  proche(T[11], tA(fin(arcSortie)), 1e-6, "balayage de la sortie jusqu'à la fin de l'arc de sortie");
});

test("giratoire : les valeurs calculées que citent les sources (palier à 20 km/h, coup d'œil au rétroviseur intérieur en cassant l'allure, angle et avance du clignotant, marge des angles morts sur l'arc de sortie) sont celles de la scène, à l'arrondi écrit près", () => {
  const { def, sc, eleve, arcSortie, tA, tReprise, reperes, T } = lireGiratoire();
  const choixDeDessin = SCENES.giratoire.sources.find((s) => s.startsWith("Choix de dessin"));
  // Nombre écrit à la française dans les sources ; tolérance : la moitié de son dernier chiffre.
  const ecrit = (motif) => {
    const m = choixDeDessin.match(motif);
    assert.ok(m, `${motif} introuvable dans les sources`);
    return { valeur: Number(m[1].replace(",", ".")), tolerance: 0.5 * 10 ** -(m[1].split(",")[1] || "").length };
  };
  const t20 = premierInstant((t) => kmh(eleve, t) >= GIRATOIRE_KMH.anneau - 1e-9, tReprise, sc.duree);
  const deClignotant = def.acteurs[0].clignotant[0].de;
  const mesures = [
    ["palier à 20 km/h (s)", T[6] - t20, ecrit(/20 km\/h tenus (\d+(?:,\d+)?) s/)],
    ["rétroviseur intérieur en cassant l'allure (s)", T[7] - T[6], ecrit(/180 degrés pendant (\d+(?:,\d+)?) s en cassant l'allure/)],
    ["clignotant après l'axe de la sortie précédente (degrés)", -polaire(reperes, pointA(eleve.chemin, deClignotant)),
      ecrit(/allumé juste après le rétroviseur intérieur, (\d+(?:,\d+)?) degrés après l'axe de la sortie précédente/)],
    ["avance du clignotant sur l'arc de sortie (s)", tA(arcSortie.debut) - tA(deClignotant), ecrit(/et (\d+(?:,\d+)?) s avant l'arc de sortie/)],
    ["marge des angles morts sur l'arc de sortie (s)", tA(arcSortie.debut) - T[10], ecrit(/angles morts finissent (\d+(?:,\d+)?) s avant l'arc de sortie/)],
  ];
  for (const [nom, mesure, { valeur, tolerance }] of mesures) {
    assert.ok(Math.abs(mesure - valeur) <= tolerance + 1e-9, `${nom} : ${mesure} dans la scène, ${valeur} dans les sources`);
  }
});

test("giratoire : le clignotant allumé, le regard porte vers la sortie : le cône contient le début et la fin de l'arc de sortie pendant toute l'étape 8", () => {
  // L'anneau tourne à gauche : droit devant, le regard tomberait sur la bordure extérieure, à 6,8 m de l'œil.
  const { sc, eleve, arcSortie, fin, T } = lireGiratoire();
  const debutSortie = pointA(eleve.chemin, arcSortie.debut), finSortie = pointA(eleve.chemin, fin(arcSortie));
  const instants = instantsPas(sc).filter((t) => t + 1e-9 >= T[7] && t < T[8]);
  assert.ok(instants.length >= DUREE_MIN.etape / PAS - 1, "l'étape 8 est échantillonnée");
  for (const t of instants) {
    const e = etatActeur(eleve, t), angle = angleRegard(sc.etapes[7], e, t, etatsA(sc, t));
    for (const [nom, p] of [["début", debutSortie], ["fin", finSortie]]) {
      assert.ok(regardContient(angle, oeil(e), p), `${nom} de l'arc de sortie hors du cône à t = ${t.toFixed(1)} s`);
    }
  }
});

test("giratoire : cadre de 40 x 46 m qui suit l'élève, cône du rétroviseur intérieur entier dans le monde pendant l'étape 1", () => {
  const { def, sc, eleve, T } = lireGiratoire();
  assert.ok(def.monde.hauteur > 46 && def.monde.largeur > 40, "monde plus grand que le cadre");
  for (let t = 0; t < T[1]; t += 0.01) {
    const e = etatActeur(eleve, t);
    for (const [x, y] of coneRegard(angleRegard(sc.etapes[0], e, t, etatsA(sc, t)), oeil(e))) {
      assert.ok(x >= 0 && x <= def.monde.largeur && y >= 0 && y <= def.monde.hauteur,
        `cône hors du monde à t = ${t.toFixed(2)} s : (${x.toFixed(2)} ; ${y.toFixed(2)})`);
    }
  }
});

test("giratoire : pendant le balayage, à 15 km/h, l'usager de l'anneau entre dans le cadre et le cône le contient au moins un instant", () => {
  const { def, sc, eleve, anneau, T } = lireGiratoire();
  // Au centième de seconde : le cône ne passe sur l'usager que pendant une fenêtre d'environ un dixième de seconde.
  const instants = [];
  for (let t = T[2]; t < T[3] - 1e-9; t += 0.01) instants.push(t);
  assert.ok(instants.length >= DUREE_MIN.balayage / 0.01 - 1, "le balayage est échantillonné");
  let dansLeCadre = 0;
  const vu = [];
  for (const t of instants) {
    const e = etatActeur(eleve, t), a = etatActeur(anneau, t);
    proche(e.v / KMH, GIRATOIRE_KMH.adaptee, 1e-9, `allure à t = ${t.toFixed(2)} s`);
    if (!a.visible) continue;
    if (dansCadre(cadre(def, e), a)) dansLeCadre++;
    if (regardContient(angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t)), oeil(e), a)) vu.push(t);
  }
  assert.ok(dansLeCadre > 0, "l'usager de l'anneau n'entre pas dans le cadre pendant le balayage");
  assert.ok(vu.length > 0, "le cône du balayage contient l'usager de l'anneau au moins un instant");
});

test("giratoire : l'élève suit des yeux l'usager de l'anneau dès qu'il ralentit pour lui ; arrêté, il le voit passer devant lui et quitter la zone de conflit, puis regarde à gauche et repart 1,0 s plus tard", () => {
  const { def, sc, eleve, anneau, tArret, tReprise, tSortieAnneau, T } = lireGiratoire();
  // L'étape 4 commence avec le freinage : le centre de l'usager de l'anneau est alors dans le cadre et dans le cône.
  proche(T[3], premierInstant((t) => kmh(eleve, t) < GIRATOIRE_KMH.adaptee - 1e-9, T[2], tArret), 1e-6, "étape 4 au début du freinage");
  const e3 = etatActeur(eleve, T[3]), a3 = etatActeur(anneau, T[3]);
  assert.ok(a3.visible && dansCadre(cadre(def, e3), a3), "centre de l'usager de l'anneau dans le cadre quand l'élève ralentit pour lui");
  assert.ok(regardContient(angleRegard(sc.etapes[3], e3, T[3], etatsA(sc, T[3])), oeil(e3), a3),
    "centre de l'usager de l'anneau dans le cône quand l'élève ralentit pour lui");
  // Pendant toute l'étape 4 (freinage, arrêt), le regard est posé sur lui et le cône le contient.
  for (const t of instantsPas(sc).filter((t) => t + 1e-9 >= T[3] && t + 1e-9 < T[4])) {
    const etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(eleve, t), etats = etatsA(sc, t);
    assert.equal(etape.regard.suivre, "anneau", `t = ${t.toFixed(1)} s`);
    assert.ok(cibleSuivie(etape, e, etats), `regard détourné de l'usager de l'anneau à t = ${t.toFixed(1)} s`);
    assert.ok(regardContient(angleRegard(etape, e, t, etats), oeil(e), etats.get("anneau")), `usager de l'anneau hors du cône à t = ${t.toFixed(1)} s`);
  }
  // Il passe devant l'élève arrêté : à l'arrêt, son centre est encore à gauche de l'axe de la voiture (produit vectoriel
  // négatif, l'axe y étant tourné vers le bas), à droite au redémarrage.
  const cote = (t) => {
    const e = etatActeur(eleve, t), a = etatActeur(anneau, t);
    return Math.cos(e.cap) * (a.y - e.y) - Math.sin(e.cap) * (a.x - e.x);
  };
  assert.ok(cote(tArret) < 0, "l'usager de l'anneau est déjà passé devant l'élève quand il s'arrête");
  assert.ok(cote(tReprise) > 0, "l'usager de l'anneau n'est pas passé devant l'élève avant le redémarrage");
  // Il quitte la zone de conflit 2,4 s après l'arrêt : l'étape 4 le suit des yeux jusque-là, l'étape 5 (regard à gauche)
  // commence alors, et l'élève repart 1,0 s plus tard, le regard devant (instants calculés par la scène au dix-millième de
  // seconde). L'attente totale reste de 3,4 s.
  proche(tSortieAnneau - tArret, 2.4, 1e-3, "sortie de l'usager de l'anneau après l'arrêt de l'élève");
  proche(T[4], tSortieAnneau, 1e-3, "étape 5 à la sortie de l'usager de l'anneau");
  proche(tReprise - tSortieAnneau, 1.0, 1e-3, "redémarrage après la sortie de l'usager de l'anneau");
  proche(tReprise - tArret, 3.4, 1e-6, "attente au cédez-le-passage");
  proche(T[5], tReprise, 1e-6, "étape 6 au redémarrage");
  assert.deepEqual(def.etapes[5].regard, { angle: 0 });
});

test("giratoire : l'usager de l'anneau sorti de la zone de conflit, l'élève arrêté regarde à gauche l'anneau en amont, d'où viendrait un autre usager, avant de s'insérer", () => {
  const { def, sc, eleve, tSortieAnneau, tReprise, T } = lireGiratoire();
  assert.deepEqual(def.etapes[4].regard, { angle: -55 });
  assert.ok(T[5] - T[4] >= DUREE_MIN.etape - 1e-9, `regard à gauche pendant ${(T[5] - T[4]).toFixed(3)} s`);
  // De la sortie de l'usager au redémarrage, au centième de seconde : élève arrêté, cône sur tout l'anneau en amont (angles
  // polaires 100 à 170), dans le cadre.
  const { instants, couverts, points } = anneauAmontRegarde(def);
  assert.ok(instants.length >= (tReprise - tSortieAnneau) / 0.01 - 1 && instants.length >= 99, "l'attente est échantillonnée");
  assert.ok(couverts.length > 0, "l'anneau en amont n'est jamais dans le cône entre la sortie de l'usager et le redémarrage");
  assert.equal(couverts.length, instants.length, "l'anneau en amont sort du cône avant le redémarrage");
  for (const t of instants) {
    const e = etatActeur(eleve, t), c = cadre(def, e);
    assert.equal(e.v, 0, `élève en mouvement à t = ${t.toFixed(2)} s`);
    assert.equal(sc.etapes[etapeActive(sc, t)], sc.etapes[4], `t = ${t.toFixed(2)} s hors de l'étape 5`);
    for (const p of points) assert.ok(dansCadre(c, p), `anneau en amont hors du cadre à t = ${t.toFixed(2)} s`);
  }
});

test("giratoire : l'usager de l'anneau part et finit hors du monde, entre dans l'anneau à au plus 19 km/h, y roule à 20 km/h, casse son allure avant l'arc de sortie et clignote à droite après la sortie précédente, au moins 2 s avant cet arc", () => {
  const { def, anneau, reperes } = lireGiratoire();
  const monde = rectangle(0, 0, def.monde.largeur, def.monde.hauteur);
  const dansLeMonde = (t) => polygonesSeChevauchent(emprise("voiture", etatActeur(anneau, t)), monde);
  assert.ok(anneau.depart > 0 && !dansLeMonde(anneau.depart), "part au-delà du bord ouest du monde");
  assert.ok(!dansLeMonde(anneau.chrono.duree), "finit au-delà du bord est du monde");
  const [arcE, arcA, arcS] = anneau.chemin.segments.filter((s) => s.type === "arc");
  const tA = (s) => tempsAtteint(anneau.chrono, s), fin = (seg) => seg.debut + seg.longueur;
  proche(kmh(anneau, anneau.depart), GIRATOIRE_KMH.approche, 1e-9, "allure d'approche");
  for (let t = tA(arcE.debut); t <= tA(fin(arcE)) + 1e-9; t += 0.01) {
    assert.ok(kmh(anneau, t) <= GIRATOIRE_KMH.arcMax + 1e-9, `arc d'entrée : ${kmh(anneau, t).toFixed(3)} km/h à t = ${t.toFixed(2)} s`);
  }
  let vMax = 0;
  for (let t = tA(arcA.debut); t <= tA(fin(arcA)) + 1e-9; t += 0.01) vMax = Math.max(vMax, kmh(anneau, t));
  proche(vMax, GIRATOIRE_KMH.anneau, 1e-9, "allure dans l'anneau");
  for (let t = tA(arcS.debut); t <= tA(fin(arcS)) + 1e-9; t += 0.01) proche(kmh(anneau, t), GIRATOIRE_KMH.casseeUsager, 1e-9, `arc de sortie, t = ${t.toFixed(2)} s`);
  // Clignotant droit : 3 degrés après l'axe de la sortie précédente (sud, angle polaire 90), jusqu'à la fin de l'arc de sortie.
  assert.equal(anneau.clignotant.length, 1, "un seul clignotant");
  const [c] = anneau.clignotant;
  assert.equal(c.cote, "droite");
  proche(polaire(reperes, pointA(anneau.chemin, c.de)), 90 - DESSIN.clignotantApresAxe, 1e-6, "angle polaire de l'allumage");
  proche(c.a, fin(arcS), 1e-9, "jusqu'à la fin de l'arc de sortie");
  assert.ok(tA(arcS.debut) - tA(c.de) >= 2.0, `allumé ${(tA(arcS.debut) - tA(c.de)).toFixed(3)} s avant l'arc de sortie`);
});

test("giratoire : douze étapes (fiche C2-F, ordre de sortie de C2.4 et du thème 38), dans l'ordre, chacune avec son regard et à son moment", () => {
  assert.deepEqual(SCENES.giratoire.etapesModele, [
    "Contrôler au rétroviseur intérieur, sans clignotant",
    "Adapter l'allure à l'approche",
    "Balayer les véhicules engagés",
    "Céder le passage à l'usager de l'anneau",
    "Regarder à gauche avant de s'insérer",
    "S'insérer et circuler dans l'anneau",
    "Casser l'allure, rétroviseur intérieur",
    "Clignotant à droite après la sortie précédente",
    "Contrôler l'angle mort droit",
    "Contrôler l'angle mort gauche",
    "Balayer la sortie et sortir",
    "Reprendre l'allure dans la voie de sortie",
  ]);
  const { def, sc, eleve, arcSortie, fin, tA, tArret, tReprise, tSortieAnneau, T } = lireGiratoire();
  assert.deepEqual(def.etapes.map((e) => e.regard), [
    { angle: 180 }, { angle: 0 }, { balayage: true }, { suivre: "anneau" }, { angle: -55 }, { angle: 0 },
    { angle: 180 }, { angle: -21 }, { angle: 120 }, { angle: -120 }, { balayage: true }, { angle: 0 },
  ]);
  proche(T[0], 0, 1e-12, "rétroviseur intérieur dès le début");
  proche(T[1], 1.2, 1e-9, "coup d'œil de 1,2 s");
  proche(T[1], premierInstant((t) => kmh(eleve, t) < GIRATOIRE_KMH.approche - 1e-9, 0, tArret), 1e-6, "adapter l'allure : début du ralentissement");
  proche(T[3] - T[2], 2.0, 1e-6, "balayer les véhicules engagés : les 2,0 s qui précèdent le freinage");
  proche(T[3], premierInstant((t) => kmh(eleve, t) < GIRATOIRE_KMH.adaptee - 1e-9, T[2], tArret), 1e-6, "céder : début du freinage");
  proche(T[4], tSortieAnneau, 1e-3, "regarder à gauche : à la sortie de l'usager de la zone de conflit");
  proche(T[5], tReprise, 1e-6, "s'insérer : au redémarrage");
  const t20 = premierInstant((t) => kmh(eleve, t) >= GIRATOIRE_KMH.anneau - 1e-9, tReprise, sc.duree);
  proche(T[6], premierInstant((t) => kmh(eleve, t) < GIRATOIRE_KMH.anneau - 1e-9, t20, sc.duree), 1e-6,
    "casser l'allure : début du ralentissement, 20 km/h une fois atteints");
  // Le coup d'œil au rétroviseur intérieur dure le temps de casser l'allure, de 20 à 11 km/h à 2,0 m/s² : 1,25 s.
  proche(T[7] - T[6], 1.25, 1e-6, "rétroviseur intérieur pendant 1,25 s, en cassant l'allure");
  proche(kmh(eleve, T[7]), GIRATOIRE_KMH.cassee, 1e-6, "allure cassée quand le clignotant s'allume");
  proche(T[8] - T[7], 1.0, 1e-6, "clignotant, regard vers la sortie, pendant 1,0 s");
  proche(T[9] - T[8], 1.0, 1e-6, "angle mort droit pendant 1,0 s");
  proche(T[10] - T[9], 1.0, 1e-6, "angle mort gauche pendant 1,0 s");
  proche(T[11], tA(fin(arcSortie)), 1e-6, "reprendre l'allure : à la fin de l'arc de sortie");
});

// ===== demarrer-arreter : quitter le bord du trottoir, rouler, s'arrêter au bord (C1.4 : méthode de Timy du 07/10, fiche ECF C1-D) =====
//
// Comme pour les autres scènes, les instants se lisent sur la définition (trajet, chronologie, emprises).

// Choix de dessin consignés dans les sources de la scène : allures (km/h), accélérations (m/s²), durées des regards (s),
// avances des deux décalages (m) et écarts entre pare-chocs des voitures garées (m).
const DEMARRER = {
  kmh: { deboitement: 10, rue: 30 }, reprise: 1.5, freinage: 1.5,
  duree: { retroviseurInterieur: 1.2, retroviseurExterieur: 1.2, angleMort: 1.0, clignotant: 2.0, rouler: 1.0 },
  avance: { deboitement: 12, rangement: 20 }, ecartGarees: { derriere: 1.0, devant: 8 },
};
// Décalage de la place au centre de la voie de droite : du centre d'une voiture garée (flanc droit à jeuStationnement du
// trottoir) au centre de la voie, par-dessus la bande de stationnement.
const ECART_PLACE_VOIE = DESSIN.voie / 2 + DESSIN.largeurStationnement - DESSIN.jeuStationnement - DESSIN.demiLargeurVoiture;

function lireDemarrerArreter(def = SCENES["demarrer-arreter"].construire()) {
  const sc = preparerScene(def);
  const eleve = sc.eleve;
  const [deboitement1, deboitement2, rangement1, rangement2] = eleve.chemin.segments.filter((s) => s.decalage);
  const tA = (s) => tempsAtteint(eleve.chrono, s);
  const tDepart = premierInstant((t) => etatActeur(eleve, t).v > 1e-9, 0, sc.duree);
  const tArret = premierInstant((t) => etatActeur(eleve, t).v < 1e-9, tDepart, sc.duree);
  const garees = Object.fromEntries(sc.acteurs.filter((a) => a.pose).map((a) => [a.id, a]));
  return { def, sc, eleve, garees, deboitement: [deboitement1, deboitement2], rangement: [rangement1, rangement2],
    fin: (seg) => seg.debut + seg.longueur, tA, tDepart, tArret, T: sc.etapes.map((e) => e.t), S: sc.etapes.map((e) => e.s),
    reperes: def.decor.reperes };
}

// Flanc droit (x le plus grand) de l'emprise d'une voiture vers le nord.
const flancDroit = (e) => Math.max(...emprise("voiture", e).map(([x]) => x));

// Distance (m) entre deux polygones convexes : 0 s'ils se touchent, sinon la plus petite distance d'un sommet de l'un à un
// côté de l'autre.
function distancePolygones(A, B) {
  if (polygonesSeChevauchent(A, B)) return 0;
  const auSegment = ([px, py], [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - ax - u * dx, py - ay - u * dy);
  };
  let d = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) {
    for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, auSegment(p, Q[i], Q[(i + 1) % Q.length]));
  }
  return d;
}

// Suite des regards de l'élève (angle par rapport au cap, en degrés arrondis) avec l'état du clignotant, relevée au
// centième de seconde de t0 à t1 (exclu) ; chaque élément avec sa durée.
function suiteDesRegards(sc, t0, t1) {
  const suite = [];
  for (let k = 0; t0 + k * 0.01 < t1 - 1e-9; k++) {
    const t = t0 + k * 0.01;
    const e = etatActeur(sc.eleve, t), angle = angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t));
    let a = Math.round(((angle - e.cap) / DEG) % 360);
    if (a > 180) a -= 360;
    else if (a <= -180) a += 360;
    const libelle = e.clignotant ? `${a} + clignotant ${e.clignotant}` : String(a);
    const der = suite[suite.length - 1];
    if (der && der.libelle === libelle) der.duree += 0.01;
    else suite.push({ libelle, duree: 0.01 });
  }
  return suite;
}

// Ordre des contrôles de Timy (07/10), du côté de la manœuvre : rétroviseur intérieur (180), rétroviseur extérieur (170),
// angle mort (120), puis le clignotant, regard devant, jusqu'à l'action (t1). Chacun pendant 1,0 s au moins. Lève une
// AssertionError sinon.
function verifierControles(sc, t0, t1, cote) {
  const signe = cote === "gauche" ? -1 : 1;
  const suite = suiteDesRegards(sc, t0, t1), libelles = suite.map((r) => r.libelle);
  assert.deepEqual(libelles, ["180", String(170 * signe), String(120 * signe), `0 + clignotant ${cote}`],
    `contrôles ${cote} : ${libelles.join(", ")}`);
  for (const r of suite) assert.ok(r.duree >= DUREE_MIN.etape - 0.011, `${r.libelle} pendant ${r.duree.toFixed(2)} s`);
}

test("demarrer-arreter : rue à double sens, voies de 3,5 m, bande de stationnement de 2,0 m le long du trottoir droit ; l'élève garé entre deux voitures en stationnement, flanc droit à 0,3 m du trottoir, 1,0 m devant l'une et 8 m derrière l'autre ; aucune circulation", () => {
  const { def, eleve, garees, reperes } = lireDemarrerArreter();
  const { xBordDroit, xBordVoieDroite, xAxe, xBordGauche } = reperes;
  proche(xAxe - xBordGauche, DESSIN.voie, 1e-12); proche(xBordVoieDroite - xAxe, DESSIN.voie, 1e-12);
  proche(xBordDroit - xBordVoieDroite, DESSIN.largeurStationnement, 1e-12, "bande de stationnement");
  assert.equal(def.decor.marquages.length, 1, "seule l'axiale est marquée");
  // L'élève et deux voitures en stationnement, rien d'autre (C1 : trafic faible ou nul).
  assert.deepEqual(def.acteurs.map((a) => a.id), ["eleve", "gareeDerriere", "gareeDevant"]);
  const depart = pointA(eleve.chemin, 0);
  proche(depart.cap, -90 * DEG, 1e-12);
  proche(xBordDroit - flancDroit(depart), DESSIN.jeuStationnement, 1e-9, "flanc droit de l'élève au départ");
  for (const a of Object.values(garees)) {
    assert.equal(a.stationne, true, `${a.id} : en stationnement (feux stop éteints)`);
    assert.equal(a.gabarit, "voiture");
    const e = etatActeur(a, 0);
    proche(e.cap, -90 * DEG, 1e-12, a.id);
    proche(xBordDroit - flancDroit(e), DESSIN.jeuStationnement, 1e-9, `${a.id} : flanc droit`);
  }
  // Écarts entre pare-chocs (l'axe y est tourné vers le bas : derrière, c'est au sud).
  const L = GABARITS.voiture.longueur;
  proche(garees.gareeDerriere.pose.y - L / 2 - (depart.y + L / 2), DEMARRER.ecartGarees.derriere, 1e-9, "voiture garée derrière");
  proche(depart.y - L / 2 - (garees.gareeDevant.pose.y + L / 2), DEMARRER.ecartGarees.devant, 1e-9, "voiture garée devant");
  assert.deepEqual(def.camera, { largeur: def.monde.largeur, hauteur: 46 });
});

test("demarrer-arreter : à l'arrêt, rétroviseur intérieur, rétroviseur extérieur gauche, angle mort gauche, puis clignotant gauche, allumé au début de l'étape 4, 2,0 s avant le départ ; aucun clignotant pendant les contrôles", () => {
  const { sc, eleve, tDepart, T } = lireDemarrerArreter();
  verifierControles(sc, 0, tDepart, "gauche");
  const d = DEMARRER.duree;
  proche(T[0], 0, 1e-12, "rétroviseur intérieur dès le début");
  proche(T[1] - T[0], d.retroviseurInterieur, 1e-9); proche(T[2] - T[1], d.retroviseurExterieur, 1e-9);
  proche(T[3] - T[2], d.angleMort, 1e-9); proche(tDepart - T[3], d.clignotant, 1e-6, "clignotant avant le départ");
  assert.ok(tDepart - T[3] >= SEUILS.avanceClignotant - 1e-6, "au moins 2 s avant de déboîter");
  // Voiture arrêtée à sa place pendant les contrôles et le clignotant.
  for (let t = 0; t < tDepart - 1e-6; t += 0.01) {
    const e = etatActeur(eleve, t);
    assert.ok(e.v === 0 && e.s === 0, `voiture en mouvement à t = ${t.toFixed(2)} s`);
  }
  // Le clignotant s'allume au début de l'étape 4 : son clignotement se compte de là.
  assert.equal(etatActeur(eleve, T[3] - 0.01).clignotant, null);
  assert.equal(etatActeur(eleve, T[3]).clignotant, "gauche");
  proche(etatActeur(eleve, T[3]).clignotantDepuis, T[3], 1e-12);
  proche(T[4], tDepart, 1e-6, "étape 5 au départ");
});

test("demarrer-arreter : démarrer et rejoindre sa voie : décalage de 2,55 m vers la gauche sur 12 m d'avance dès le départ, marqué changement de voie ; 1,5 m/s² jusqu'à 10 km/h, tenus jusqu'au centre de la voie ; clignotant gauche jusque-là, puis éteint", () => {
  const { eleve, deboitement: [arc1, arc2], fin, tA, tDepart, reperes, T } = lireDemarrerArreter();
  proche(ECART_PLACE_VOIE, 2.55, 1e-12);
  assert.equal(arc1.debut, 0, "le décalage commence au départ");
  assert.ok(arc1.angle < 0 && arc2.angle > 0, "vers la gauche, puis redressé");
  assert.ok(arc1.premier === true && arc1.changementDeVoie === true && arc2.changementDeVoie === true, "changement de voie signalé");
  const depart = pointA(eleve.chemin, 0), voie = pointA(eleve.chemin, fin(arc2));
  proche(depart.x - voie.x, ECART_PLACE_VOIE, 1e-9, "décalage vers la gauche");
  proche(voie.x, reperes.xAxe + DESSIN.voie / 2, 1e-9, "centre de la voie de droite");
  proche(depart.y - voie.y, DEMARRER.avance.deboitement, 1e-9, "avance");
  proche(voie.cap, -90 * DEG, 1e-12);
  // Allure : reprise de 1,5 m/s² au plus, 10 km/h au plus, tenus du moment où ils sont atteints jusqu'au centre de la voie.
  const tVoie = tA(fin(arc2));
  const tDix = premierInstant((t) => kmh(eleve, t) >= DEMARRER.kmh.deboitement - 1e-9, tDepart, tVoie);
  assert.ok(tDix !== null && tDix < tVoie, "10 km/h atteints avant le centre de la voie");
  for (let t = tDepart; t <= tVoie; t += 0.01) {
    const e = etatActeur(eleve, t);
    assert.ok(e.a >= -1e-9 && e.a <= DEMARRER.reprise + 1e-9 && e.v / KMH <= DEMARRER.kmh.deboitement + 1e-9,
      `${(e.v / KMH).toFixed(3)} km/h et ${e.a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
  // Tolérance de 1e-6 km/h : tDix est l'instant où l'allure franchit 10 km/h moins 1e-9.
  for (let t = tDix; t <= tVoie; t += 0.01) proche(kmh(eleve, t), DEMARRER.kmh.deboitement, 1e-6, `allure à t = ${t.toFixed(2)} s`);
  // Clignotant gauche jusqu'à la fin du décalage, éteint ensuite.
  for (let t = T[3]; t <= tVoie - 1e-6; t += 0.01) assert.equal(etatActeur(eleve, t).clignotant, "gauche", `t = ${t.toFixed(2)} s`);
  assert.equal(etatActeur(eleve, tVoie + 0.05).clignotant, null, "éteint au centre de la voie");
  proche(T[5], tVoie, 1e-9, "étape 6 au centre de la voie");
});

test("demarrer-arreter : rouler au centre de sa voie : 1,5 m/s² jusqu'à 30 km/h, tenus 1,0 s avant les contrôles de l'arrêt et jusqu'au rangement, cap au nord", () => {
  const { eleve, deboitement: [, arc2], rangement: [arc3], fin, tA, reperes, T } = lireDemarrerArreter();
  const tVoie = tA(fin(arc2)), tRangement = tA(arc3.debut);
  const t30 = premierInstant((t) => kmh(eleve, t) >= DEMARRER.kmh.rue - 1e-9, tVoie, tRangement);
  assert.ok(t30 !== null, "30 km/h atteints avant le rangement");
  proche(T[6] - t30, DEMARRER.duree.rouler, 1e-6, "30 km/h tenus avant l'étape 7");
  for (let t = tVoie; t < t30; t += 0.01) {
    const a = etatActeur(eleve, t).a;
    assert.ok(a >= -1e-9 && a <= DEMARRER.reprise + 1e-9, `${a.toFixed(3)} m/s² à t = ${t.toFixed(2)} s`);
  }
  // Tolérance de 1e-6 km/h : t30 est l'instant où l'allure franchit 30 km/h moins 1e-9.
  for (let t = t30; t <= tRangement; t += 0.01) proche(kmh(eleve, t), DEMARRER.kmh.rue, 1e-6, `allure à t = ${t.toFixed(2)} s`);
  for (let s = fin(arc2); s <= arc3.debut; s += 0.5) {
    const p = pointA(eleve.chemin, s);
    proche(p.x, reperes.xAxe + DESSIN.voie / 2, 1e-9, `centre de la voie en s = ${s.toFixed(1)} m`);
    proche(p.cap, -90 * DEG, 1e-12);
  }
});

test("demarrer-arreter : en roulant à 30 km/h, rétroviseur intérieur, rétroviseur extérieur droit, angle mort droit, puis clignotant droit, allumé au début de l'étape 10, 2,0 s avant de se rapprocher du bord ; aucun clignotant avant", () => {
  const { sc, eleve, rangement: [arc3], tA, T } = lireDemarrerArreter();
  const tRangement = tA(arc3.debut);
  verifierControles(sc, T[6], tRangement, "droite");
  const d = DEMARRER.duree;
  proche(T[7] - T[6], d.retroviseurInterieur, 1e-6); proche(T[8] - T[7], d.retroviseurExterieur, 1e-6);
  proche(T[9] - T[8], d.angleMort, 1e-6); proche(tRangement - T[9], d.clignotant, 1e-6, "clignotant avant le rangement");
  proche(etatActeur(eleve, T[9]).clignotantDepuis, T[9], 1e-9);
  for (let t = T[5] + 0.05; t < T[9] - 1e-6; t += 0.01) assert.equal(etatActeur(eleve, t).clignotant, null, `t = ${t.toFixed(2)} s`);
});

test("demarrer-arreter : ralentir et se rapprocher du bord : décalage de 2,55 m vers la droite sur 20 m d'avance, marqué changement de voie, en ralentissant à 1,5 m/s² dès son début ; arrêt en ligne droite après le décalage, flanc droit à 0,3 m du trottoir, aligné sur les voitures garées ; clignotant droit jusqu'à l'arrêt, puis éteint", () => {
  const { sc, eleve, garees, rangement: [arc3, arc4], fin, tA, tArret, reperes, T } = lireDemarrerArreter();
  assert.ok(arc3.angle > 0 && arc4.angle < 0, "vers la droite, puis redressé");
  assert.ok(arc3.premier === true && arc3.changementDeVoie === true && arc4.changementDeVoie === true, "changement de voie signalé");
  const debut = pointA(eleve.chemin, arc3.debut), bord = pointA(eleve.chemin, fin(arc4));
  proche(bord.x - debut.x, ECART_PLACE_VOIE, 1e-9, "décalage vers la droite");
  proche(debut.y - bord.y, DEMARRER.avance.rangement, 1e-9, "avance");
  proche(bord.cap, -90 * DEG, 1e-12);
  const tRangement = tA(arc3.debut);
  proche(T[10], tRangement, 1e-9, "étape 11 au début du rangement");
  for (let t = tRangement + 0.01; t < tArret - 0.01; t += 0.01) proche(etatActeur(eleve, t).a, -DEMARRER.freinage, 1e-6, `t = ${t.toFixed(2)} s`);
  proche(T[11], tA(fin(arc4)), 1e-9, "étape 12 à la fin du décalage");
  assert.ok(tArret - T[11] >= DUREE_MIN.etape, "arrêt en ligne droite, après le décalage");
  const arret = etatActeur(eleve, tArret);
  proche(arret.s, eleve.chemin.longueur, 1e-6, "arrêt au bout du trajet");
  proche(arret.cap, -90 * DEG, 1e-12);
  proche(reperes.xBordDroit - flancDroit(arret), DESSIN.jeuStationnement, 1e-9, "flanc droit à l'arrêt");
  for (const g of Object.values(garees)) proche(arret.x, g.pose.x, 1e-9, `aligné sur ${g.id}`);
  for (let t = T[9]; t <= tArret - 1e-6; t += 0.01) assert.equal(etatActeur(eleve, t).clignotant, "droite", `t = ${t.toFixed(2)} s`);
  assert.equal(etatActeur(eleve, tArret + 0.05).clignotant, null, "éteint à l'arrêt");
  proche(sc.duree - tArret, 1.0, 1e-6, "image tenue 1,0 s après l'arrêt");
});

test("demarrer-arreter : cône du rétroviseur intérieur entier dans le monde pendant l'étape 1, cône du regard devant entier dans le monde pendant l'étape 12", () => {
  const { def, sc, eleve, T } = lireDemarrerArreter();
  for (const [k, t0, t1] of [[0, T[0], T[1]], [11, T[11], sc.duree]]) {
    for (let t = t0; t < t1; t += 0.01) {
      const e = etatActeur(eleve, t);
      for (const [x, y] of coneRegard(angleRegard(sc.etapes[k], e, t, etatsA(sc, t)), oeil(e))) {
        assert.ok(x >= 0 && x <= def.monde.largeur && y >= 0 && y <= def.monde.hauteur,
          `étape ${k + 1} : cône hors du monde à t = ${t.toFixed(2)} s : (${x.toFixed(2)} ; ${y.toFixed(2)})`);
      }
    }
  }
});

test("demarrer-arreter : douze étapes de la méthode de Timy, dans l'ordre, chacune avec son regard, à son moment et à son abscisse", () => {
  assert.deepEqual(SCENES["demarrer-arreter"].etapesModele, [
    "Contrôler au rétroviseur intérieur",
    "Contrôler au rétroviseur extérieur gauche",
    "Contrôler l'angle mort gauche",
    "Mettre le clignotant gauche",
    "Démarrer et rejoindre sa voie",
    "Rouler au centre de sa voie",
    "Contrôler au rétroviseur intérieur",
    "Contrôler au rétroviseur extérieur droit",
    "Contrôler l'angle mort droit",
    "Mettre le clignotant droit",
    "Ralentir et se rapprocher du bord",
    "S'arrêter au bord",
  ]);
  const { def, eleve, deboitement: [, arc2], rangement: [arc3, arc4], fin, tA, tDepart, T, S } = lireDemarrerArreter();
  assert.deepEqual(def.etapes.map((e) => e.regard), [
    { angle: 180 }, { angle: -170 }, { angle: -120 }, { angle: 0 }, { angle: 0 }, { angle: 0 },
    { angle: 180 }, { angle: 170 }, { angle: 120 }, { angle: 0 }, { angle: 0 }, { angle: 0 },
  ]);
  const d = DEMARRER.duree, vRue = DEMARRER.kmh.rue * KMH;
  // Étapes 1 à 5 à la place de départ ; puis au centre de la voie, aux contrôles de l'arrêt, au rangement, au bord.
  for (let k = 0; k < 5; k++) assert.equal(S[k], 0, `étape ${k + 1} à la place de départ`);
  proche(T[1], d.retroviseurInterieur, 1e-9); proche(T[2], T[1] + d.retroviseurExterieur, 1e-9);
  proche(T[3], T[2] + d.angleMort, 1e-9); proche(T[4], tDepart, 1e-6);
  proche(S[5], fin(arc2), 1e-9); proche(T[5], tA(fin(arc2)), 1e-9);
  for (const [k, duree] of [[7, d.retroviseurInterieur], [8, d.retroviseurExterieur], [9, d.angleMort], [10, d.clignotant]]) {
    proche(S[k] - S[k - 1], vRue * duree, 1e-9, `étape ${k + 1} : abscisse`);
    proche(T[k] - T[k - 1], duree, 1e-6, `étape ${k + 1} : instant`);
  }
  for (let k = 0; k < 12; k++) proche(etatActeur(eleve, T[k]).s, S[k], 1e-6, `étape ${k + 1} : abscisse atteinte à son instant`);
  proche(S[10], arc3.debut, 1e-9); proche(S[11], fin(arc4), 1e-9);
});

test("demarrer-arreter : les valeurs calculées que citent les sources (décalage, accélérations latérales, distances au trottoir et à la voiture garée devant, allure au bord, arrêt après le décalage, durée) sont celles de la scène, à l'arrondi écrit près", () => {
  const { sc, eleve, garees, deboitement: [, arc2], rangement: [arc3, arc4], fin, tA, tDepart, reperes } = lireDemarrerArreter();
  const choixDeDessin = SCENES["demarrer-arreter"].sources.find((s) => s.startsWith("Choix de dessin"));
  // Nombre écrit à la française dans les sources ; tolérance : la moitié de son dernier chiffre.
  const ecrit = (motif) => {
    const m = choixDeDessin.match(motif);
    assert.ok(m, `${motif} introuvable dans les sources`);
    return { valeur: Number(m[1].replace(",", ".")), tolerance: 0.5 * 10 ** -(m[1].split(",")[1] || "").length };
  };
  const lateraleMax = (t0, t1) => {
    let max = 0;
    for (let t = t0; t <= t1; t += 0.001) {
      const e = etatActeur(eleve, t);
      max = Math.max(max, e.v * e.v * Math.abs(e.courbure));
    }
    return max;
  };
  let trottoir = Infinity, devant = Infinity;
  const voitureDevant = emprise("voiture", etatActeur(garees.gareeDevant, 0));
  for (let s = 0; s <= fin(arc2); s += 0.001) {
    const p = pointA(eleve.chemin, s);
    trottoir = Math.min(trottoir, reperes.xBordDroit - flancDroit(p));
    devant = Math.min(devant, distancePolygones(emprise("voiture", p), voitureDevant));
  }
  const { def } = lireDemarrerArreter();
  const flancGaucheGaree = Math.min(...emprise("voiture", etatActeur(garees.gareeDevant, 0)).map(([x]) => x));
  const mesures = [
    ["débord d'une voiture garée sur la voie de droite (m)", reperes.xBordVoieDroite - flancGaucheGaree,
      ecrit(/y déborde de (\d+(?:,\d+)?) m sur la voie de droite/)],
    ["voie de droite laissée par une voiture garée (m)", flancGaucheGaree - reperes.xAxe, ecrit(/qui garde (\d+(?:,\d+)?) m/)],
    ["largeur du cadre (m)", def.camera.largeur, ecrit(/cadre de (\d+(?:,\d+)?) x 46 m/)],
    ["départ, du bord bas (m)", def.monde.hauteur - pointA(eleve.chemin, 0).y, ecrit(/départ à (\d+(?:,\d+)?) m du bord bas/)],
    ["arrêt, du bord haut (m)", pointA(eleve.chemin, eleve.chemin.longueur).y, ecrit(/arrêt à (\d+(?:,\d+)?) m du bord haut/)],
    ["décalage de la place au centre de la voie (m)", ECART_PLACE_VOIE, ecrit(/décalage de (\d+(?:,\d+)?) m vers la gauche/)],
    ["décalage du centre de la voie au bord (m)", pointA(eleve.chemin, fin(arc4)).x - pointA(eleve.chemin, arc3.debut).x,
      ecrit(/décalage de (\d+(?:,\d+)?) m vers la droite/)],
    ["accélération latérale en rejoignant sa voie (m/s²)", lateraleMax(tDepart, tA(fin(arc2))),
      ecrit(/accélération latérale de (\d+(?:,\d+)?) m\/s² au plus en rejoignant sa voie/)],
    ["plus petite distance au trottoir en déboîtant (m)", trottoir, ecrit(/l'arrière, qui pivote, passe à (\d+(?:,\d+)?) m du trottoir/)],
    ["plus petite distance à la voiture garée devant (m)", devant, ecrit(/l'avant à (\d+(?:,\d+)?) m de la voiture garée devant/)],
    ["accélération latérale en se rapprochant du bord (m/s²)", lateraleMax(tA(arc3.debut), tA(fin(arc4))),
      ecrit(/accélération latérale de (\d+(?:,\d+)?) m\/s² au plus en se rapprochant du bord/)],
    ["allure à la fin du rangement (km/h)", kmh(eleve, tA(fin(arc4))), ecrit(/bord atteint à (\d+(?:,\d+)?) km\/h/)],
    ["arrêt après la fin du décalage (m)", eleve.chemin.longueur - fin(arc4), ecrit(/arrêt (\d+(?:,\d+)?) m plus loin/)],
    ["durée de la scène (s)", sc.duree, ecrit(/scène de (\d+(?:,\d+)?) s/)],
  ];
  for (const [nom, mesure, { valeur, tolerance }] of mesures) {
    assert.ok(Math.abs(mesure - valeur) <= tolerance + 1e-9, `${nom} : ${mesure} dans la scène, ${valeur} dans les sources`);
  }
});

// Sabotages : chaque défaut est refusé, par les contrôles automatiques ou par l'assertion d'ordre des contrôles de Timy.

test("demarrer-arreter : un clignotant gauche allumé moins de 2 s avant le départ est détecté", () => {
  const def = copie("demarrer-arreter");
  def.acteurs[0].clignotant.find((c) => c.cote === "gauche").delai += 1.0;   // allumé 1,0 s seulement avant le départ
  assert.match(erreurs(def), /eleve : clignotant gauche attendu 2 s avant le changement de direction de s = 0\.0 m/);
});

test("demarrer-arreter : démarrer sans clignotant, ou se rapprocher du bord sans clignotant, est détecté", () => {
  for (const cote of ["gauche", "droite"]) {
    const def = copie("demarrer-arreter");
    def.acteurs[0].clignotant = def.acteurs[0].clignotant.filter((c) => c.cote !== cote);
    assert.match(erreurs(def), new RegExp(`eleve : clignotant ${cote} attendu 2 s avant le changement de direction`));
  }
});

test("demarrer-arreter : un clignotant éteint avant la fin du premier arc d'un décalage est détecté", () => {
  const def = copie("demarrer-arreter");
  const [arc1] = def.acteurs[0].chemin.segments.filter((s) => s.decalage);
  def.acteurs[0].clignotant.find((c) => c.cote === "gauche").a = arc1.longueur / 2;
  assert.match(erreurs(def), /eleve : clignotant gauche éteint pendant le changement de direction/);
});

test("demarrer-arreter : un clignotant droit mis avant les contrôles de l'arrêt est détecté", () => {
  const def = copie("demarrer-arreter");
  def.acteurs[0].clignotant.find((c) => c.cote === "droite").de = def.etapes[6].s;   // dès le rétroviseur intérieur
  assert.match(erreurs(def), /eleve : clignotant droite allumé avant s = /);
});

test("demarrer-arreter : contrôles dans le désordre, ou clignotant mis avant la fin des contrôles, refusés par l'assertion d'ordre de Timy", () => {
  // Angle mort avant le rétroviseur extérieur, au départ puis à l'arrêt.
  for (const [i, cote, attendu] of [[1, "gauche", /contrôles gauche : 180, -120, -170, 0 \+ clignotant gauche(?!,)/],
    [7, "droite", /contrôles droite : 180, 120, 170, 0 \+ clignotant droite(?!,)/]]) {
    const def = copie("demarrer-arreter");
    [def.etapes[i].regard, def.etapes[i + 1].regard] = [def.etapes[i + 1].regard, def.etapes[i].regard];
    const { sc, tDepart, rangement: [arc3], tA, T } = lireDemarrerArreter(def);
    const [t0, t1] = cote === "gauche" ? [0, tDepart] : [T[6], tA(arc3.debut)];
    assert.throws(() => verifierControles(sc, t0, t1, cote), attendu);
  }
  // Clignotant gauche allumé dès l'angle mort : les contrôles automatiques l'acceptent (plus de 2 s avant le départ),
  // l'ordre de Timy non.
  const def = copie("demarrer-arreter");
  def.acteurs[0].clignotant.find((c) => c.cote === "gauche").delai = def.etapes[2].delai;
  assert.deepEqual(controlerScene(def), []);
  const { sc, tDepart } = lireDemarrerArreter(def);
  assert.throws(() => verifierControles(sc, 0, tDepart, "gauche"), /contrôles gauche : 180, -170, -120 \+ clignotant gauche, 0 \+ clignotant gauche(?!,)/);
});

test("demarrer-arreter : une place trop courte devant (voiture garée à 4 m) est détectée", () => {
  const def = copie("demarrer-arreter");
  def.acteurs.find((a) => a.id === "gareeDevant").pose.y += DEMARRER.ecartGarees.devant - 4;
  assert.match(erreurs(def), /eleve et gareeDevant se touchent/);
});

test("demarrer-arreter : rouler sur l'axe, ou s'arrêter loin du bord, est détecté", () => {
  const surAxe = copie("demarrer-arreter");
  surAxe.acteurs[0].chemin.segments[2].x0 -= 1.5;   // la ligne droite entre les deux décalages, 1,5 m plus à gauche
  assert.match(erreurs(surAxe), /eleve sort de « voie de droite »/);
  assert.match(erreurs(surAxe), /eleve sort de « côté droit de la chaussée »/);
  const loinDuBord = copie("demarrer-arreter");
  const segments = loinDuBord.acteurs[0].chemin.segments;
  segments[segments.length - 1].x0 -= 1.0;          // la ligne droite de l'arrêt, 1,0 m plus loin du trottoir
  assert.match(erreurs(loinDuBord), /eleve sort de « place le long du trottoir »/);
});

test("demarrer-arreter : rejoindre sa voie à plus de 10 km/h, ou rouler à plus de 30 km/h, est détecté", () => {
  const vite = copie("demarrer-arreter");
  vite.acteurs[0].profil = vite.acteurs[0].profil.map((p) => (p.kmh === DEMARRER.kmh.deboitement ? { ...p, kmh: 12 } : p));
  assert.match(erreurs(vite), /eleve dépasse 10 km\/h entre s = 0 et s = /);
  const rapide = copie("demarrer-arreter");
  rapide.acteurs[0].profil = rapide.acteurs[0].profil.map((p) => (p.kmh === DEMARRER.kmh.rue ? { ...p, kmh: 40 } : p));
  assert.match(erreurs(rapide), /eleve dépasse 30 km\/h entre s = 0 et s = /);
});
