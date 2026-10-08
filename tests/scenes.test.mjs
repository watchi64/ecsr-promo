import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../js/scenes.js";
import { controlerScene, SEUILS } from "../js/scene-controles.js";
import { REGARD_PORTEE, REGARD_OUVERTURE, REGARD_DUREE_TOUR_MIN, oeil, angleRegard, cibleSuivie, coneRegard, regardContient,
  regardDessine } from "../js/scene-regard.js";
import { KMH, DEG, GABARITS, preparerScene, etatActeur, emprise, tempsAtteint, centreArc, pointA, pointDansPolygone,
  polygonesSeChevauchent, rectangle, avant, rebroussements } from "../js/scene-geometrie.js";
import { DESSIN, trajetGiratoire } from "../js/scene-decors.js";
import { feuxDeRecul, cadreReduit } from "../js/scene-rendu.js";
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

// Étapes trop courtes à l'écran, de leur instant `t` à leur fin `fin` (bornes posées par preparerScene : la dernière va
// jusqu'à la fin de la scène) : au moins DUREE_MIN.etape, un balayage au moins DUREE_MIN.balayage, un tour du regard au
// moins DUREE_MIN.tour.
function etapesTropCourtes(def) {
  const fautes = [];
  preparerScene(def).etapes.forEach((e, i) => {
    const r = e.regard || {};
    const min = r.balayage ? DUREE_MIN.balayage : r.tour ? DUREE_MIN.tour : DUREE_MIN.etape;
    if (e.fin - e.t < min - 1e-9) fautes.push(`étape ${i + 1} : ${(e.fin - e.t).toFixed(3)} s à l'écran, ${min} s au moins`);
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
  // Durées à l'écran lues sur les bornes des étapes (fin - t) : le balayage de l'intersection, la première étape plus
  // courte qu'un balayage, la première qui dure au moins un tour du regard.
  const etapes = preparerScene(SCENES["tourner-droite"].construire()).etapes;
  const duree = (i) => etapes[i].fin - etapes[i].t;
  const sabote = (i, regard) => { const def = copie("tourner-droite"); def.etapes[i].regard = regard; return etapesTropCourtes(def); };
  const balayage = etapes.findIndex((e) => e.regard && e.regard.balayage);
  const courte = etapes.findIndex((_, i) => duree(i) < DUREE_MIN.balayage);
  const longue = etapes.findIndex((_, i) => duree(i) >= DUREE_MIN.tour);
  assert.ok(balayage >= 0 && duree(balayage) < DUREE_MIN.tour && courte >= 0 && longue >= 0, "les trois cas sont exercés");
  assert.deepEqual(sabote(balayage, { tour: true }),
    [`étape ${balayage + 1} : ${duree(balayage).toFixed(3)} s à l'écran, ${DUREE_MIN.tour} s au moins`]);
  assert.deepEqual(sabote(courte, { balayage: true }),
    [`étape ${courte + 1} : ${duree(courte).toFixed(3)} s à l'écran, ${DUREE_MIN.balayage} s au moins`]);
  assert.deepEqual(sabote(longue, { tour: true }), []);
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

// ===== regard-intersection : la scène suit les procédures de Fabrice (5.1) et les fiches ECF C1-I et C1-H =====
//
// Comme pour les autres scènes, les instants se lisent sur la définition (trajet, chronologie, emprises). L'élève roule
// tout droit vers le nord : l'avant de sa voiture est le haut de son emprise, l'arrière le bas.

// km/h et degrés : choix de dessin consignés dans les sources de la scène.
const INTERSECTION_KMH = { approche: 50, reduite: 30 };
const INTERSECTION_REGARDS = [{ angle: 0 }, { angle: 180 }, { angle: 0 }, { angle: 0 }, { angle: -30 }, { angle: 30 }, { angle: 0 }];

const yAvant = (e) => Math.min(...emprise("voiture", e).map(([, y]) => y));
const yArriere = (e) => Math.max(...emprise("voiture", e).map(([, y]) => y));

function lireIntersection(def = SCENES["regard-intersection"].construire()) {
  const sc = preparerScene(def);
  const eleve = sc.eleve, aDroite = sc.acteurs.find((a) => a.id === "aDroite");
  const reperes = def.decor.reperes, intersection = def.decor.zones.carrefour;
  // Entrée dans l'intersection : premier contact de l'emprise de l'élève avec le carrefour.
  const touche = (t) => polygonesSeChevauchent(emprise("voiture", etatActeur(eleve, t)), intersection);
  const tEntree = premierInstant(touche, 0, sc.duree);
  // Distance (m) de l'avant de la voiture au bord sud de l'intersection : positive avant d'y entrer.
  const avantBord = (t) => yAvant(etatActeur(eleve, t)) - reperes.bord.sud;
  return { def, sc, eleve, aDroite, reperes, intersection, tEntree, avantBord, T: sc.etapes.map((e) => e.t) };
}

// Angle (degrés, positif à droite) sous lequel le conducteur de la voiture dans l'état e voit le point p, depuis son œil,
// par rapport à l'axe de la voiture.
function releve(e, p) {
  const o = oeil(e);
  let a = (Math.atan2(p.y - o.y, p.x - o.x) - e.cap) / DEG;
  while (a > 180) a -= 360;
  while (a <= -180) a += 360;
  return a;
}

// Entrée de la voie entrante ouest : son milieu, au bord amont de sa ligne de cédez-le-passage (là où s'arrêterait un
// usager venant de gauche).
function entreeOuest(def) {
  const ligne = def.decor.marquages.find((m) => m.role === "cedez-ouest");
  return { x: ligne.de[0] - ligne.largeur / 2, y: def.decor.reperes.cy + DESSIN.voie / 2 };
}

// Regard de l'étape k + 1 (5 : à gauche, 6 : à droite), de son début à sa fin comprise, au millième de seconde : nombre
// d'instants relevés, instants où le cône ne contient pas le point p, instants où les coins donnés ne sont pas tous dans
// le cadre.
function regardLateral(def, k, p, coins) {
  const { sc, eleve, T } = lireIntersection(def);
  const horsCone = [], horsCadre = [];
  let n = 0;
  for (let j = 0; T[k] + j * 0.001 <= T[k + 1] + 1e-9; j++, n++) {
    const t = T[k] + j * 0.001, e = etatActeur(eleve, t), c = cadre(def, e);
    if (!regardContient(angleRegard(sc.etapes[k], e, t, etatsA(sc, t)), oeil(e), p)) horsCone.push(`t = ${t.toFixed(3)} s`);
    if (!coins.every(([x, y]) => x >= c.x0 && x <= c.x0 + c.w && y >= c.y0 && y <= c.y0 + c.h)) horsCadre.push(`t = ${t.toFixed(3)} s`);
  }
  return { n, horsCone, horsCadre };
}
// À gauche : l'entrée de la voie entrante ouest ; à droite : le centre du véhicule qui attend, son emprise dans le cadre.
const regardAGauche = (def) => { const p = entreeOuest(def); return regardLateral(def, 4, p, [[p.x, p.y]]); };
const regardADroite = (def) => {
  const v = etatActeur(lireIntersection(def).aDroite, 0);
  return regardLateral(def, 5, v, emprise("voiture", v));
};

// Approche, du départ à l'entrée dans l'intersection, relevée au centième de seconde : la suite des regards (angle par
// rapport au cap, en degrés arrondis) avec l'allure (« à 50 km/h », « en ralentissant », « à 30 km/h »), chaque élément
// avec sa durée.
function sequenceApproche(def) {
  const { sc, eleve, tEntree } = lireIntersection(def);
  const suite = [];
  for (let t = 0; t < tEntree - 1e-9; t += 0.01) {
    const e = etatActeur(eleve, t), angle = angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t));
    let a = Math.round(((angle - e.cap) / DEG) % 360);
    if (a > 180) a -= 360;
    else if (a <= -180) a += 360;
    const v = e.v / KMH;
    const allure = Math.abs(v - INTERSECTION_KMH.approche) < 1e-6 ? `à ${INTERSECTION_KMH.approche} km/h`
      : Math.abs(v - INTERSECTION_KMH.reduite) < 1e-6 ? `à ${INTERSECTION_KMH.reduite} km/h` : "en ralentissant";
    const libelle = `${a} ${allure}`, der = suite[suite.length - 1];
    if (der && der.libelle === libelle) der.duree += 0.01;
    else suite.push({ libelle, duree: 0.01 });
  }
  return suite;
}

// Assertion d'ordre de l'approche (fiche C1-H et méthode C.I.A. : contrôler l'arrière, puis ralentir ; procédures de
// Fabrice, 5.1 : contrôles à l'approche en face, à gauche, à droite) : regard loin devant à 50 km/h, rétroviseur intérieur
// à 50 km/h, regard devant en ralentissant, puis, à 30 km/h, en face, à gauche (-30), à droite (30), chacun pendant 1,0 s
// au moins, tous achevés avant l'entrée dans l'intersection. Lève une AssertionError sinon.
function verifierApproche(def) {
  const suite = sequenceApproche(def);
  const libelles = suite.map((r) => r.libelle);
  assert.deepEqual(libelles, ["0 à 50 km/h", "180 à 50 km/h", "0 en ralentissant", "0 à 30 km/h", "-30 à 30 km/h", "30 à 30 km/h"],
    `approche : ${libelles.join(", ")}`);
  for (const r of suite) assert.ok(r.duree >= DUREE_MIN.etape - 0.011, `${r.libelle} pendant ${r.duree.toFixed(2)} s`);
}

// Instants (au centième de seconde) où l'élève touche déjà l'intersection alors que l'étape « Traverser en regardant
// devant » (la dernière) n'a pas commencé : les contrôles à l'approche s'achèvent avant d'y entrer.
function controlesDansIntersection(def) {
  const { sc, eleve, intersection } = lireIntersection(def);
  const tTraverser = sc.etapes[sc.etapes.length - 1].t, fautes = [];
  for (let t = 0; t < tTraverser - 1e-9; t += 0.01) {
    if (polygonesSeChevauchent(emprise("voiture", etatActeur(eleve, t)), intersection)) fautes.push(`t = ${t.toFixed(2)} s`);
  }
  return fautes;
}

// Partie de la voie entrante ouest (en son milieu) que couvre le cône du regard à gauche à la fin de ce regard, relevée au
// millimètre : distances (m) en amont du bord amont de sa ligne de cédez-le-passage, ou null si le cône ne la touche pas.
function gaucheEnFinDeRegard(def) {
  const { sc, eleve, T } = lireIntersection(def);
  const { x: xAmont, y } = entreeOuest(def);
  const e = etatActeur(eleve, T[5]), o = oeil(e), angle = angleRegard(sc.etapes[4], e, T[5], etatsA(sc, T[5]));
  const couverts = [];
  for (let k = 0; k * 0.001 <= xAmont + 1e-9; k++) if (regardContient(angle, o, { x: xAmont - k * 0.001, y })) couverts.push(k * 0.001);
  return couverts.length ? { de: Math.min(...couverts), a: Math.max(...couverts) } : null;
}

test("regard-intersection : tout droit vers le nord au centre de la voie de droite, de 22 m du bord bas à 0,5 m du bord haut, sans clignotant", () => {
  const { def, sc, eleve, reperes } = lireIntersection();
  assert.equal(eleve.chemin.segments.length, 1, "une seule ligne droite");
  const [seg] = eleve.chemin.segments;
  assert.equal(seg.type, "droite");
  proche(seg.cap, -90 * DEG, 1e-12, "vers le nord");
  proche(seg.x0, reperes.cx + DESSIN.voie / 2, 1e-12, "au centre de la voie de droite");
  proche(def.monde.hauteur - seg.y0, REGARD_PORTEE, 1e-9, "départ à 22 m du bord bas");
  proche(seg.y0 - eleve.chemin.longueur, DESSIN.retraitBord, 1e-9, "arrivée à 0,5 m du bord haut");
  assert.ok(!(eleve.clignotant && eleve.clignotant.length), "aucun clignotant déclaré");
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) assert.equal(etatActeur(eleve, t).clignotant, null, `t = ${t.toFixed(2)} s`);
});

test("regard-intersection : le véhicule qui attend est posé au centre de la voie entrante est, tourné vers l'ouest, l'avant à 0,3 m de sa ligne de cédez-le-passage, à l'arrêt pendant toute la scène", () => {
  const { def, sc, aDroite, reperes } = lireIntersection();
  assert.ok(aDroite.pose && !aDroite.chemin && !aDroite.profil && !aDroite.chrono, "acteur posé, sans trajet");
  const ligne = def.decor.marquages.find((m) => m.role === "cedez-est");
  const xAmont = ligne.de[0] + ligne.largeur / 2;
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.1) {
    const v = etatActeur(aDroite, t);
    assert.ok(v.visible && v.v === 0 && v.clignotant === null, `t = ${t.toFixed(1)} s`);
    proche(v.y, reperes.cy - DESSIN.voie / 2, 1e-12, "centre de la voie entrante est");
    proche(v.cap, 180 * DEG, 1e-12, "tourné vers l'ouest");
    proche(Math.min(...emprise("voiture", v).map(([x]) => x)) - xAmont, 0.3, 1e-9, "avant à 0,3 m du bord amont de la ligne");
  }
});

test("regard-intersection : 50 km/h jusqu'à la fin du coup d'œil au rétroviseur intérieur, ralentissement de 2,0 m/s² jusqu'à 30 km/h, atteints au début du regard en face et tenus jusqu'à la fin, sans arrêt", () => {
  const { sc, eleve, T } = lireIntersection();
  for (let t = 0; t <= T[2] + 1e-9; t += 0.01) proche(kmh(eleve, t), INTERSECTION_KMH.approche, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  for (let t = T[2] + 0.01; t < T[3] - 0.01; t += 0.01) proche(etatActeur(eleve, t).a, -2.0, 1e-6, `décélération à t = ${t.toFixed(2)} s`);
  for (let t = T[3]; t <= sc.duree + 1e-9; t += 0.01) proche(kmh(eleve, t), INTERSECTION_KMH.reduite, 1e-9, `allure à t = ${t.toFixed(2)} s`);
});

test("regard-intersection : sept étapes, dans l'ordre, chacune avec son regard, à son moment et à sa place", () => {
  assert.deepEqual(SCENES["regard-intersection"].etapesModele, [
    "Regarder loin devant",
    "Contrôler au rétroviseur intérieur",
    "Ralentir à l'approche",
    "Regarder en face",
    "Regarder à gauche",
    "Regarder à droite",
    "Traverser en regardant devant",
  ]);
  const { def, sc, eleve, tEntree, avantBord, T } = lireIntersection();
  assert.deepEqual(def.etapes.map((e) => e.regard), INTERSECTION_REGARDS);
  sc.etapes.forEach((e, k) => proche(etatActeur(eleve, T[k]).s, e.s, 1e-6, `étape ${k + 1} : abscisse atteinte à son instant`));
  const d30 = INTERSECTION_KMH.reduite * KMH * DUREE_MIN.etape;   // m parcourus pendant un regard de 1,0 s à 30 km/h
  // Étape 1 : regard loin devant, dès le départ, à 50 km/h.
  proche(T[0], 0, 1e-12, "regarder loin devant : dès le départ");
  // Étape 2 : rétroviseur intérieur pendant 1,0 s, qui s'achève quand le ralentissement commence (étape 3).
  proche(T[2] - T[1], 1.0, 1e-9, "rétroviseur intérieur pendant 1,0 s");
  proche(T[2], premierInstant((t) => kmh(eleve, t) < INTERSECTION_KMH.approche - 1e-9, 0, tEntree), 1e-6, "ralentir : début du ralentissement");
  // Étapes 4 à 6 : en face dès l'allure réduite atteinte, puis à gauche, puis à droite, 1,0 s chacune, à 25, 16,67 et 8,33 m
  // de l'intersection.
  proche(T[3], premierInstant((t) => kmh(eleve, t) <= INTERSECTION_KMH.reduite + 1e-9, 0, tEntree), 1e-6, "en face : allure réduite atteinte");
  for (const k of [3, 4, 5]) {
    proche(T[k + 1] - T[k], 1.0, 1e-9, `étape ${k + 1} pendant 1,0 s`);
    proche(avantBord(T[k]), (6 - k) * d30, 1e-6, `étape ${k + 1} : avant à ${((6 - k) * d30).toFixed(2)} m de l'intersection`);
  }
  // Étape 7 : traverser en regardant devant, dès que l'avant atteint le bord de l'intersection.
  proche(T[6], tEntree, 1e-6, "traverser : à l'entrée dans l'intersection");
  proche(avantBord(T[6]), 0, 1e-6, "traverser : avant au bord de l'intersection");
});

test("regard-intersection : contrôler l'arrière avant de ralentir, puis en face, à gauche et à droite, chacun pendant 1,0 s au moins, tous achevés avant l'intersection", () => {
  const def = SCENES["regard-intersection"].construire();
  verifierApproche(def);
  assert.deepEqual(controlesDansIntersection(def), []);
});

test("regard-intersection : pendant tout le regard à droite, achevé quand l'avant atteint le bord de l'intersection, le véhicule qui attend est entier dans le cadre et dans le cône", () => {
  const def = SCENES["regard-intersection"].construire();
  const { n, horsCone, horsCadre } = regardADroite(def);
  assert.ok(n >= 1000, `${n} instants relevés pendant le regard à droite`);
  assert.deepEqual(horsCone, [], "véhicule qui attend hors du cône");
  assert.deepEqual(horsCadre, [], "véhicule qui attend hors du cadre");
  // Il n'est pas dans le cône du regard en face, ni dans celui du regard à gauche : seul le regard à droite le montre.
  const { sc, eleve, aDroite, T } = lireIntersection(def);
  const v = etatActeur(aDroite, 0);
  for (const k of [3, 4]) {
    for (let t = T[k]; t < T[k + 1] - 1e-9; t += 0.01) {
      const e = etatActeur(eleve, t);
      assert.ok(!regardContient(angleRegard(sc.etapes[k], e, t, etatsA(sc, t)), oeil(e), v), `étape ${k + 1}, t = ${t.toFixed(2)} s`);
    }
  }
});

test("regard-intersection : pendant tout le regard à gauche, le cône contient l'entrée de la voie entrante ouest, dans le cadre ; en fin de regard, il couvre cette voie depuis sa ligne de cédez-le-passage", () => {
  const def = SCENES["regard-intersection"].construire();
  const { n, horsCone, horsCadre } = regardAGauche(def);
  assert.ok(n >= 1000, `${n} instants relevés pendant le regard à gauche`);
  assert.deepEqual(horsCone, [], "entrée de la voie entrante ouest hors du cône");
  assert.deepEqual(horsCadre, [], "entrée de la voie entrante ouest hors du cadre");
  const couverte = gaucheEnFinDeRegard(def);
  assert.ok(couverte && couverte.de === 0 && couverte.a > 0, `voie entrante ouest couverte : ${JSON.stringify(couverte)}`);
});

test("regard-intersection : cadre de 46 m qui suit l'élève sur toute la largeur ; cône du rétroviseur intérieur entier dans le monde pendant l'étape 2", () => {
  const { def, sc, eleve, T } = lireIntersection();
  assert.deepEqual(def.camera, { largeur: def.monde.largeur, hauteur: 46 });
  assert.ok(def.monde.hauteur > 46, "monde plus haut que le cadre");
  for (let t = T[1]; t < T[2]; t += 0.01) {
    const e = etatActeur(eleve, t);
    for (const [x, y] of coneRegard(angleRegard(sc.etapes[1], e, t, etatsA(sc, t)), oeil(e))) {
      assert.ok(x >= 0 && x <= def.monde.largeur && y >= 0 && y <= def.monde.hauteur,
        `cône hors du monde à t = ${t.toFixed(2)} s : (${x.toFixed(2)} ; ${y.toFixed(2)})`);
    }
  }
});

test("regard-intersection : branches sud, est et ouest au plus petit nombre entier de mètres : un mètre de moins, le regard loin devant durerait moins de 1,0 s, ou le cône du regard à gauche ou à droite déborderait de la largeur du dessin", () => {
  const { def, sc, eleve, T } = lireIntersection();
  const v50 = INTERSECTION_KMH.approche * KMH;
  assert.ok(T[1] >= DUREE_MIN.etape - 1e-9 && T[1] - 1 / v50 < DUREE_MIN.etape, `regard loin devant pendant ${T[1].toFixed(4)} s`);
  let xMin = Infinity, xMax = -Infinity;
  for (const k of [4, 5]) {
    for (let t = T[k]; t < T[k + 1] - 1e-9; t += 0.01) {
      const e = etatActeur(eleve, t);
      for (const [x] of coneRegard(angleRegard(sc.etapes[k], e, t, etatsA(sc, t)), oeil(e))) {
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
      }
    }
  }
  assert.ok(xMin >= 0 && xMin < 1, `cône du regard à gauche jusqu'à x = ${xMin.toFixed(3)} m`);
  assert.ok(xMax <= def.monde.largeur && xMax > def.monde.largeur - 1, `cône du regard à droite jusqu'à x = ${xMax.toFixed(3)} m (largeur ${def.monde.largeur} m)`);
});

test("regard-intersection : les valeurs calculées que citent les sources (regard loin devant, ralentissement, place des trois contrôles, regards à gauche et à droite, regards à 60 degrés, sortie de l'intersection) sont celles de la scène, à l'arrondi écrit près", () => {
  const def = SCENES["regard-intersection"].construire();
  const { sc, eleve, aDroite, reperes, avantBord, T } = lireIntersection(def);
  const choixDeDessin = SCENES["regard-intersection"].sources.find((s) => s.startsWith("Choix de dessin"));
  // Nombre écrit à la française dans les sources (groupe k du motif) ; tolérance : la moitié de son dernier chiffre.
  const ecrit = (motif, k = 1) => {
    const m = choixDeDessin.match(motif);
    assert.ok(m, `${motif} introuvable dans les sources`);
    return { valeur: Number(m[k].replace(",", ".")), tolerance: 0.5 * 10 ** -(m[k].split(",")[1] || "").length };
  };
  const v = etatActeur(aDroite, 0), entree = entreeOuest(def);
  // À 60 degrés : premier instant où le cône du regard à droite contient le véhicule qui attend, et où celui du regard à
  // gauche atteint la voie entrante ouest (son triangle touche la voie).
  const t60droite = premierInstant((t) => {
    const e = etatActeur(eleve, t);
    return regardContient(e.cap + 60 * DEG, oeil(e), v);
  }, 0, sc.duree);
  const t60gauche = premierInstant((t) => {
    const e = etatActeur(eleve, t);
    return polygonesSeChevauchent(coneRegard(e.cap - 60 * DEG, oeil(e)), def.decor.voies.ouestEntrante);
  }, T[4], T[5]);
  const gauche = gaucheEnFinDeRegard(def);
  const mesures = [
    ["regard loin devant (s)", T[1] - T[0], ecrit(/droit devant pendant (\d+(?:,\d+)?) s \(regarder loin devant\)/)],
    ["durée du ralentissement (s)", T[3] - T[2], ecrit(/ramené à une valeur moyenne : (\d+(?:,\d+)?) s sur/)],
    ["distance du ralentissement (m)", etatActeur(eleve, T[3]).s - etatActeur(eleve, T[2]).s, ecrit(/ s sur (\d+(?:,\d+)?) m\)/)],
    ["trois contrôles à l'approche (m avant l'intersection)", avantBord(T[3]), ecrit(/tiennent sur les (\d+(?:,\d+)?) derniers mètres/)],
    ["entrée de la voie entrante ouest, au début du regard à gauche (degrés à gauche)", -releve(etatActeur(eleve, T[4]), entree),
      ecrit(/qui passe de (\d+(?:,\d+)?) à (\d+(?:,\d+)?) degrés à gauche/, 1)],
    ["entrée de la voie entrante ouest, à la fin du regard à gauche (degrés à gauche)", -releve(etatActeur(eleve, T[5]), entree),
      ecrit(/qui passe de (\d+(?:,\d+)?) à (\d+(?:,\d+)?) degrés à gauche/, 2)],
    ["voie entrante ouest couverte en fin de regard à gauche (m en amont)", gauche.a, ecrit(/il couvre cette voie jusqu'à (\d+(?:,\d+)?) m en amont/)],
    ["véhicule qui attend, au début du regard à droite (degrés à droite)", releve(etatActeur(eleve, T[5]), v),
      ecrit(/qui passe de (\d+(?:,\d+)?) à (\d+(?:,\d+)?) degrés à droite/, 1)],
    ["véhicule qui attend, à la fin du regard à droite (degrés à droite)", releve(etatActeur(eleve, T[6]), v),
      ecrit(/qui passe de (\d+(?:,\d+)?) à (\d+(?:,\d+)?) degrés à droite/, 2)],
    ["regard à gauche à 60 degrés : voie entrante ouest atteinte après (s)", t60gauche - T[4], ecrit(/qu'après (\d+(?:,\d+)?) s de regard/)],
    ["regard à droite à 60 degrés : avant dans l'intersection (m)", -avantBord(t60droite), ecrit(/l'avant de la voiture à (\d+(?:,\d+)?) m dans l'intersection/)],
    ["arrière au-delà de l'intersection, à la fin du trajet (m)", reperes.bord.nord - yArriere(etatActeur(eleve, eleve.chrono.duree)),
      ecrit(/son arrière en est à (\d+(?:,\d+)?) m/)],
  ];
  for (const [nom, mesure, { valeur, tolerance }] of mesures) {
    assert.ok(Math.abs(mesure - valeur) <= tolerance + 1e-9, `${nom} : ${mesure} dans la scène, ${valeur} dans les sources`);
  }
});

// Sabotages : chaque défaut est refusé par le contrôle ou l'assertion qui le vise.

test("regard-intersection : un regard à droite à 60 degrés laisse le véhicule qui attend hors du cône pendant tout le regard", () => {
  const def = copie("regard-intersection");
  def.etapes[5].regard = { angle: 60 };
  const { n, horsCone } = regardADroite(def);
  assert.ok(n >= 1000);
  assert.equal(horsCone.length, n, `seulement ${horsCone.length} instants hors du cône sur ${n}`);
});

test("regard-intersection : un regard à gauche à 60 degrés laisse l'entrée de la voie entrante ouest hors du cône pendant tout le regard", () => {
  const def = copie("regard-intersection");
  def.etapes[4].regard = { angle: -60 };
  const { n, horsCone } = regardAGauche(def);
  assert.ok(n >= 1000);
  assert.equal(horsCone.length, n, `seulement ${horsCone.length} instants hors du cône sur ${n}`);
});

test("regard-intersection : ralentir sans contrôler au rétroviseur intérieur est refusé par l'assertion d'ordre de l'approche", () => {
  const def = copie("regard-intersection");
  def.etapes.splice(1, 1);
  assert.throws(() => verifierApproche(def), /approche : 0 à 50 km\/h, 0 en ralentissant, 0 à 30 km\/h, -30 à 30 km\/h, 30 à 30 km\/h(?!,)/);
});

test("regard-intersection : le rétroviseur intérieur regardé en ralentissant, et non avant, est refusé par l'assertion d'ordre de l'approche", () => {
  const def = copie("regard-intersection");
  [def.etapes[1].regard, def.etapes[2].regard] = [def.etapes[2].regard, def.etapes[1].regard];
  assert.throws(() => verifierApproche(def), /approche : 0 à 50 km\/h, 180 en ralentissant, 0 à 30 km\/h/);
});

test("regard-intersection : regarder à droite avant de regarder à gauche est refusé par l'assertion d'ordre de l'approche", () => {
  const def = copie("regard-intersection");
  [def.etapes[4].regard, def.etapes[5].regard] = [def.etapes[5].regard, def.etapes[4].regard];
  assert.throws(() => verifierApproche(def), /approche : 0 à 50 km\/h, 180 à 50 km\/h, 0 en ralentissant, 0 à 30 km\/h, 30 à 30 km\/h, -30 à 30 km\/h(?!,)/);
});

test("regard-intersection : un contrôle encore en cours dans l'intersection est détecté", () => {
  const def = copie("regard-intersection");
  def.etapes[6].s += 3;   // le regard à droite se prolonge sur les 3 premiers mètres de l'intersection
  assert.ok(controlesDansIntersection(def).length > 0);
});

test("regard-intersection : un clignotant, à droite comme à gauche, est détecté", () => {
  for (const cote of ["droite", "gauche"]) {
    const def = copie("regard-intersection");
    def.acteurs[0].clignotant = [{ cote, de: 60, a: 90 }];
    assert.match(erreurs(def), new RegExp(`eleve : clignotant ${cote} allumé avant s = `));
  }
});

test("regard-intersection : traverser l'intersection sans ralentir est détecté", () => {
  const def = copie("regard-intersection");
  def.acteurs[0].profil = def.acteurs[0].profil.map((p) => ({ ...p, kmh: INTERSECTION_KMH.approche }));
  assert.match(erreurs(def), /eleve dépasse 30 km\/h entre s = /);
});

test("regard-intersection : une voiture qui mord sur la voie opposée est détectée", () => {
  const def = copie("regard-intersection");
  for (const seg of def.acteurs[0].chemin.segments) seg.x0 -= 1;
  assert.match(erreurs(def), /eleve sort de « moitié droite de la chaussée, intersection comprise »/);
});

test("regard-intersection : un véhicule qui attend au-delà de sa ligne de cédez-le-passage est détecté", () => {
  const def = copie("regard-intersection");
  def.acteurs[1].pose.x -= 1;
  assert.match(erreurs(def), /aDroite franchit « ligne de cédez-le-passage, branche est » sans s'être arrêté/);
});

// ===== marche-arriere : la méthode de Timy du 07/10/2026 (C1.9) =====
//
// La voiture de l'élève, arrêtée dans la voie de droite le long du trottoir et tournée vers le nord, recule tout droit vers
// le sud. Comme pour les autres scènes, les instants se lisent sur la définition (trajet, chronologie, emprises).

// km/h et degrés : choix de dessin consignés dans les sources de la scène.
const MARCHE_ARRIERE_KMH = 4;
const MARCHE_ARRIERE_REGARDS = [{ angle: 0 }, { tour: true }, { angle: 165 }, { angle: 0 }];

function lireMarcheArriere(def = SCENES["marche-arriere"].construire()) {
  const sc = preparerScene(def);
  const eleve = sc.eleve, garee = sc.acteurs.find((a) => a.id === "garee");
  // Départ : premier instant où la voiture bouge ; arrêt : son arrivée au bout du trajet.
  const tDepart = premierInstant((t) => etatActeur(eleve, t).v > 0, 0, sc.duree);
  const tArret = tempsAtteint(eleve.chrono, eleve.chemin.longueur);
  return { def, sc, eleve, garee, tDepart, tArret, T: sc.etapes.map((e) => e.t), reperes: def.decor.reperes };
}

// Milieu du pare-chocs arrière d'une voiture dans l'état e : à l'opposé de son avant, selon le cap de la caisse.
function arriereDe(e) {
  const l = GABARITS.voiture.longueur / 2;
  return { x: e.x - Math.cos(e.cap) * l, y: e.y - Math.sin(e.cap) * l };
}

// Scène relevée au centième de seconde, au milieu de chaque centième (aucun relevé ne tombe sur la borne d'une étape) : la
// suite des regards (angle par rapport au cap, en degrés arrondis, ou « tour » pendant une étape dont le regard fait le
// tour), avec l'état de la voiture (« arrêtée », « en reculant », « en avançant ») et celui de ses feux de recul, chaque
// élément avec sa durée.
function sequenceMarcheArriere(def) {
  const sc = preparerScene(def), suite = [];
  for (let k = 0; (k + 0.5) * 0.01 < sc.duree; k++) {
    const t = (k + 0.5) * 0.01, etape = sc.etapes[etapeActive(sc, t)], e = etatActeur(sc.eleve, t);
    let regard = "tour";
    if (!(etape.regard && etape.regard.tour)) {
      let a = Math.round(((angleRegard(etape, e, t, etatsA(sc, t)) - e.cap) / DEG) % 360);
      if (a > 180) a -= 360;
      else if (a <= -180) a += 360;
      regard = String(a);
    }
    const etat = e.v === 0 ? "arrêtée" : e.marche === "arriere" ? "en reculant" : "en avançant";
    const libelle = `${regard}, ${etat}, ${feuxDeRecul(e) ? "feux de recul" : "sans feux de recul"}`;
    const der = suite[suite.length - 1];
    if (der && der.libelle === libelle) der.duree += 0.01;
    else suite.push({ libelle, duree: 0.01 });
  }
  return suite;
}

// Assertion d'ordre (V·V·C·C, choix du contrôleur de chantier soumis à Timy : la vitesse d'abord, puis les contrôles, le
// mouvement en dernier) : regard devant, voiture arrêtée, marche arrière engagée (feux de recul) ; tour du regard, arrêtée ;
// 165 degrés en reculant ; regard devant, arrêtée ; chacun pendant 1,0 s au moins, le tour pendant REGARD_DUREE_TOUR_MIN au
// moins. Lève une AssertionError sinon.
function verifierMarcheArriere(def) {
  const suite = sequenceMarcheArriere(def);
  const libelles = suite.map((r) => r.libelle);
  assert.deepEqual(libelles, ["0, arrêtée, feux de recul", "tour, arrêtée, feux de recul", "165, en reculant, feux de recul",
    "0, arrêtée, feux de recul"], `marche arrière : ${libelles.join(" ; ")}`);
  for (const r of suite) {
    const min = r.libelle.startsWith("tour") ? DUREE_MIN.tour : DUREE_MIN.etape;
    assert.ok(r.duree >= min - 0.011, `${r.libelle} pendant ${r.duree.toFixed(2)} s`);
  }
}

test("marche-arriere : quatre étapes, dans l'ordre V·V·C·C (la marche arrière engagée, puis le tour du regard), chacune avec son regard, à son moment et à sa place", () => {
  assert.deepEqual(SCENES["marche-arriere"].etapesModele, [
    "Engager la marche arrière",
    "Faire le tour du regard",
    "Reculer en regardant par la lunette arrière",
    "S'arrêter",
  ]);
  const { def, sc, eleve, tDepart, tArret, T } = lireMarcheArriere();
  assert.deepEqual(def.etapes.map((e) => e.regard), MARCHE_ARRIERE_REGARDS);
  // Étapes 1 à 3 au point de départ (à l'arrêt, puis au redémarrage) ; étape 4 au bout des 15 m, à l'arrêt.
  [0, 0, 0, eleve.chemin.longueur].forEach((s, k) => proche(etatActeur(eleve, T[k]).s, s, 1e-9, `étape ${k + 1} : abscisse`));
  proche(T[0], 0, 1e-12, "engager la marche arrière : dès le début");
  proche(T[1] - T[0], 1.0, 1e-9, "engager la marche arrière : 1,0 s");
  proche(T[2] - T[1], REGARD_DUREE_TOUR_MIN, 1e-9, "tour du regard : 4,0 s");
  proche(T[2], tDepart, 1e-6, "reculer : au redémarrage");
  proche(T[3], tArret, 1e-9, "s'arrêter : à l'arrivée");
  proche(sc.duree - T[3], 1.0, 1e-9, "s'arrêter : l'image finale, tenue 1,0 s");
});

test("marche-arriere : trajet parti en marche arrière, 15 m tout droit vers le sud depuis 23 m du bord haut, la caisse tournée vers le nord, le flanc droit à 0,3 m de la bordure du trottoir ; aucun rebroussement", () => {
  const { sc, eleve, reperes } = lireMarcheArriere();
  assert.equal(eleve.chemin.segments.length, 1, "une seule ligne droite");
  const [seg] = eleve.chemin.segments;
  assert.equal(seg.type, "droite");
  assert.equal(seg.arriere, true, "parcourue en marche arrière");
  proche(seg.cap, 90 * DEG, 1e-12, "déplacement vers le sud");
  proche(seg.y0, 23, 1e-12, "départ à 23 m du bord haut");
  proche(eleve.chemin.longueur, 15, 1e-12, "15 m de recul");
  assert.deepEqual(rebroussements(eleve.chemin), [], "parti en marche arrière : aucun rebroussement");
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    const e = etatActeur(eleve, t), nom = `t = ${t.toFixed(2)} s`;
    assert.equal(e.marche, "arriere", nom);
    proche(e.cap, -90 * DEG, 1e-12, `caisse vers le nord, ${nom}`);
    proche(reperes.xBordDroit - Math.max(...emprise("voiture", e).map(([x]) => x)), 0.3, 1e-9, `flanc droit, ${nom}`);
  }
});

test("marche-arriere : la marche arrière est engagée dès le début, voiture à l'arrêt : feux de recul allumés à chaque instant, jusqu'à l'arrêt final compris ; aucun clignotant", () => {
  const { sc, eleve } = lireMarcheArriere();
  assert.ok(!(eleve.clignotant && eleve.clignotant.length), "aucun clignotant déclaré");
  assert.equal(etatActeur(eleve, 0).v, 0, "à l'arrêt quand la marche arrière s'engage");
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    const e = etatActeur(eleve, t);
    assert.equal(feuxDeRecul(e), true, `feux de recul éteints à t = ${t.toFixed(2)} s`);
    assert.equal(e.clignotant, null, `clignotant à t = ${t.toFixed(2)} s`);
  }
});

test("marche-arriere : à l'arrêt pendant l'étape 1 et le tour du regard ; recul à 4 km/h, l'allure du pas, atteints puis quittés à 1,0 m/s² ; arrêt au bout des 15 m, jusqu'à la fin", () => {
  const { sc, eleve, tArret, T } = lireMarcheArriere();
  for (let t = 0; t < T[2] - 1e-9; t += 0.01) assert.equal(etatActeur(eleve, t).v, 0, `en mouvement à t = ${t.toFixed(2)} s`);
  const t4 = premierInstant((t) => kmh(eleve, t) >= MARCHE_ARRIERE_KMH - 1e-9, T[2], tArret);
  const tFrein = premierInstant((t) => kmh(eleve, t) < MARCHE_ARRIERE_KMH - 1e-9, t4, tArret);
  const rampe = (MARCHE_ARRIERE_KMH * KMH) / 1.0;   // s pour passer de 0 à 4 km/h, ou de 4 km/h à 0, à 1,0 m/s²
  proche(t4 - T[2], rampe, 1e-6, "allure du pas atteinte à 1,0 m/s²");
  proche(tArret - tFrein, rampe, 1e-6, "arrêt à 1,0 m/s²");
  for (let t = T[2] + 0.01; t < t4 - 0.01; t += 0.01) proche(etatActeur(eleve, t).a, 1.0, 1e-6, `mise en mouvement, t = ${t.toFixed(2)} s`);
  for (let t = t4; t <= tFrein; t += 0.01) proche(kmh(eleve, t), MARCHE_ARRIERE_KMH, 1e-9, `allure à t = ${t.toFixed(2)} s`);
  for (let t = tFrein + 0.01; t < tArret - 0.01; t += 0.01) proche(etatActeur(eleve, t).a, -1.0, 1e-6, `arrêt, t = ${t.toFixed(2)} s`);
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    assert.ok(kmh(eleve, t) <= MARCHE_ARRIERE_KMH + 1e-9, `${kmh(eleve, t).toFixed(3)} km/h à t = ${t.toFixed(2)} s`);
  }
  for (let t = tArret; t <= sc.duree + 1e-9; t += 0.01) {
    const e = etatActeur(eleve, t);
    assert.equal(e.v, 0, `en mouvement à t = ${t.toFixed(2)} s`);
    proche(e.s, eleve.chemin.longueur, 1e-9);
  }
});

test("marche-arriere : voiture en stationnement (feux éteints), posée au-delà de la zone de recul, le long du même trottoir et tournée vers le nord, son avant à 2 m de l'arrière de la voiture arrêtée ; au départ, 17 m libres derrière la voiture", () => {
  const { def, eleve, garee, tArret } = lireMarcheArriere();
  assert.ok(garee.pose && !garee.chemin && !garee.profil && !garee.chrono, "acteur posé, sans trajet");
  assert.equal(garee.stationne, true, "voiture en stationnement : feux stop éteints");
  const g = etatActeur(garee, 0), depart = etatActeur(eleve, 0), arret = etatActeur(eleve, tArret);
  proche(g.x, depart.x, 1e-12, "le long du même trottoir, à 0,3 m de la bordure");
  proche(g.cap, -90 * DEG, 1e-12, "tournée vers le nord");
  const avantGaree = avant("voiture", g);
  proche(avantGaree.y - arriereDe(arret).y, 2, 1e-9, "écart à l'arrêt");
  proche(avantGaree.y - arriereDe(depart).y, 17, 1e-9, "zone libre derrière la voiture au départ");
  for (const [x, y] of emprise("voiture", g)) {
    assert.ok(x >= 0 && x <= def.monde.largeur && y >= 0 && y <= def.monde.hauteur, `voiture garée hors du dessin en (${x} ; ${y})`);
  }
});

test("marche-arriere : pendant tout le recul, regard par-dessus l'épaule droite, à 165 degrés (et non 180, le rétroviseur intérieur) : le cône contient le chemin qu'il reste au milieu du pare-chocs arrière à parcourir et l'avant de la voiture garée ; le coin arrière gauche et son chemin n'y entrent jamais", () => {
  const { sc, eleve, garee, tArret, T } = lireMarcheArriere();
  const arret = etatActeur(eleve, tArret), fin = arriereDe(arret), avantGaree = avant("voiture", etatActeur(garee, 0));
  // Coin arrière gauche : le quatrième coin de l'emprise (arrière, côté gauche de la caisse).
  const coinArriereGauche = (e) => { const [x, y] = emprise("voiture", e)[3]; return { x, y }; };
  const coinFin = coinArriereGauche(arret);
  let n = 0;
  for (let t = T[2]; t < tArret - 1e-9; t += 0.01, n++) {
    const e = etatActeur(eleve, t), angle = angleRegard(sc.etapes[etapeActive(sc, t)], e, t, etatsA(sc, t));
    proche((angle - e.cap) / DEG, 165, 1e-9, `regard à t = ${t.toFixed(2)} s`);
    // Le cône est un triangle : il contient le chemin du milieu du pare-chocs arrière, de sa place à celle de la voiture
    // arrêtée, s'il en contient les deux bouts.
    for (const [nom, p] of [["le milieu du pare-chocs arrière", arriereDe(e)], ["le milieu du pare-chocs arrière de la voiture arrêtée", fin],
      ["l'avant de la voiture garée", avantGaree]]) {
      assert.ok(regardContient(angle, oeil(e), p), `${nom} hors du cône à t = ${t.toFixed(2)} s`);
    }
    // Le coin arrière gauche et le chemin qu'il lui reste, relevé en 21 points : jamais dans le cône (à gauche de la voiture,
    // le tour du regard les a vus avant de partir).
    const coin = coinArriereGauche(e);
    for (let k = 0; k <= 20; k++) {
      const p = { x: coin.x + ((coinFin.x - coin.x) * k) / 20, y: coin.y + ((coinFin.y - coin.y) * k) / 20 };
      assert.ok(!regardContient(angle, oeil(e), p), `chemin du coin arrière gauche dans le cône à t = ${t.toFixed(2)} s (point ${k})`);
    }
  }
  assert.ok(n >= 1400, `${n} instants relevés pendant le recul`);
});

test("marche-arriere : au milieu du tour, le regard vers l'arrière couvre toute la zone de recul, de l'arrière de la voiture à l'endroit où elle s'arrêtera, et l'avant de la voiture garée", () => {
  const { sc, eleve, garee, tArret, T } = lireMarcheArriere();
  const t = (T[1] + T[2]) / 2, e = etatActeur(eleve, t), angle = angleRegard(sc.etapes[1], e, t, etatsA(sc, t));
  proche(angle - e.cap, -Math.PI, 1e-9, "l'arrière, à la moitié du tour");
  for (const [nom, p] of [["l'arrière de la voiture", arriereDe(e)], ["l'arrière de la voiture arrêtée", arriereDe(etatActeur(eleve, tArret))],
    ["l'avant de la voiture garée", avant("voiture", etatActeur(garee, 0))]]) {
    assert.ok(regardContient(angle, oeil(e), p), `${nom} hors du cône`);
  }
});

test("marche-arriere : la marche arrière engagée, puis le tour du regard à l'arrêt, puis le recul à 165 degrés, puis le regard devant à l'arrêt, chacun pendant 1,0 s au moins, le tour pendant 4 s au moins", () => {
  verifierMarcheArriere(SCENES["marche-arriere"].construire());
});

test("marche-arriere : cadre de 46 m de haut sur toute la largeur, qui suit l'élève ; les cônes du regard restent dans la hauteur du dessin, en lecture comme sur les images figées ; départ à 23 m du bord haut et rue de 60 m, au plus petit nombre entier de mètres", () => {
  const { def, sc, eleve } = lireMarcheArriere();
  assert.deepEqual(def.camera, { largeur: def.monde.largeur, hauteur: 46 });
  assert.equal(def.monde.hauteur, 60);
  let yMin = Infinity, yMax = -Infinity;
  const releve = (r) => {
    for (const poly of r.polys || [r.poly]) for (const [, y] of poly) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
  };
  for (let t = 0; t <= sc.duree + 1e-9; t += 0.01) {
    const etats = etatsA(sc, t);
    releve(regardDessine(sc.etapes[etapeActive(sc, t)], etats.get("eleve"), t, etats));
  }
  sc.etapes.forEach((et) => { const etats = etatsA(sc, et.t); releve(regardDessine(et, etats.get("eleve"), et.t, etats, true)); });
  assert.ok(yMin >= 0 && yMax <= def.monde.hauteur, `cônes de y = ${yMin.toFixed(3)} à y = ${yMax.toFixed(3)} m`);
  // Un mètre de moins au départ : pendant le tour, la pointe du cône, qui passe à REGARD_PORTEE de l'œil dans toutes les
  // directions, sortirait du dessin par le haut. Un mètre de moins à la rue : le cône de la lunette en sortirait par le
  // bas avant l'arrêt.
  const o = oeil(etatActeur(eleve, 0));
  assert.ok(o.y - REGARD_PORTEE >= 0 && o.y - 1 - REGARD_PORTEE < 0, `œil à ${o.y} m du bord haut au départ`);
  assert.ok(yMax > def.monde.hauteur - 1, `cônes jusqu'à y = ${yMax.toFixed(3)} m`);
});

test("marche-arriere : 4 m de trottoir montrés de chaque côté, le plus petit nombre entier de mètres pour que, dans le cadre réduit, chaque cône du tour figé se voie au-delà de la voiture sur au moins la largeur d'une voie", () => {
  const { def, sc, eleve, T } = lireMarcheArriere();
  assert.equal(def.decor.reperes.xBordGauche, 4, "trottoir montré à gauche");
  assert.equal(def.monde.largeur - def.decor.reperes.xBordDroit, 4, "trottoir montré à droite");
  const c = cadreReduit(sc), e = etatActeur(eleve, T[1]), o = oeil(e);
  const L = GABARITS.voiture.longueur / 2, W = GABARITS.voiture.largeur / 2;
  // La voiture est tournée vers le nord : les axes des quatre cônes partent de l'œil vers le nord, l'ouest, le sud et l'est.
  // Longueur de chacun que montre le cadre au-delà de la voiture, jusqu'au bord du cadre ou au bout du cône (le bord
  // lointain du triangle, à REGARD_PORTEE cos REGARD_OUVERTURE de l'œil).
  const bout = REGARD_PORTEE * Math.cos(REGARD_OUVERTURE * DEG);
  const vus = {
    devant: (e.y - L) - Math.max(c.y, o.y - bout),
    gauche: (e.x - W) - Math.max(c.x, o.x - bout),
    derriere: Math.min(c.y + c.hauteur, o.y + bout) - (e.y + L),
    droite: Math.min(c.x + c.largeur, o.x + bout) - (e.x + W),
  };
  for (const [nom, l] of Object.entries(vus)) assert.ok(l >= DESSIN.voie, `cône ${nom} : ${l.toFixed(2)} m au-delà de la voiture`);
  proche(vus.droite, 4.3, 1e-9, "cône à droite, côté trottoir");
  assert.ok(vus.droite - 1 < DESSIN.voie, "avec un mètre de trottoir de moins, le cône à droite resterait sous la largeur d'une voie");
});

test("marche-arriere : les valeurs calculées que citent les sources (cône à droite du tour, zone libre au départ, mise en mouvement et arrêt, allure tenue, durée du recul, départ) sont celles de la scène, à l'arrondi écrit près", () => {
  const { def, sc, eleve, garee, tArret, T } = lireMarcheArriere();
  const choixDeDessin = SCENES["marche-arriere"].sources.find((s) => s.startsWith("Choix de dessin"));
  // Nombre écrit à la française dans les sources (groupe k du motif) ; tolérance : la moitié de son dernier chiffre.
  const ecrit = (motif, k = 1) => {
    const m = choixDeDessin.match(motif);
    assert.ok(m, `${motif} introuvable dans les sources`);
    return { valeur: Number(m[k].replace(",", ".")), tolerance: 0.5 * 10 ** -(m[k].split(",")[1] || "").length };
  };
  const t4 = premierInstant((t) => kmh(eleve, t) >= MARCHE_ARRIERE_KMH - 1e-9, T[2], tArret);
  const tFrein = premierInstant((t) => kmh(eleve, t) < MARCHE_ARRIERE_KMH - 1e-9, t4, tArret);
  const e = etatActeur(eleve, T[1]), c = cadreReduit(sc), bout = REGARD_PORTEE * Math.cos(REGARD_OUVERTURE * DEG);
  const mesures = [
    ["cône à droite du tour, au-delà de la voiture (m)", Math.min(c.x + c.largeur, oeil(e).x + bout) - (e.x + GABARITS.voiture.largeur / 2),
      ecrit(/sur au moins la largeur d'une voie : (\d+(?:,\d+)?) m/)],
    ["zone libre derrière la voiture au départ (m)", avant("voiture", etatActeur(garee, 0)).y - arriereDe(etatActeur(eleve, 0)).y,
      ecrit(/au départ, (\d+(?:,\d+)?) m sont libres/)],
    ["mise en mouvement (s)", t4 - T[2], ecrit(/\((\d+(?:,\d+)?) s et (\d+(?:,\d+)?) m chacun\)/, 1)],
    ["mise en mouvement (m)", etatActeur(eleve, t4).s, ecrit(/\((\d+(?:,\d+)?) s et (\d+(?:,\d+)?) m chacun\)/, 2)],
    ["arrêt (s)", tArret - tFrein, ecrit(/\((\d+(?:,\d+)?) s et (\d+(?:,\d+)?) m chacun\)/, 1)],
    ["arrêt (m)", eleve.chemin.longueur - etatActeur(eleve, tFrein).s, ecrit(/\((\d+(?:,\d+)?) s et (\d+(?:,\d+)?) m chacun\)/, 2)],
    ["allure du pas tenue (s)", tFrein - t4, ecrit(/tenus (\d+(?:,\d+)?) s/)],
    ["durée du recul (s)", tArret - T[2], ecrit(/(\d+(?:,\d+)?) s de recul/)],
    ["départ de la voiture (s)", T[2], ecrit(/la voiture recule (\d+(?:,\d+)?) s après le début/)],
  ];
  for (const [nom, mesure, { valeur, tolerance }] of mesures) {
    assert.ok(Math.abs(mesure - valeur) <= tolerance + 1e-9, `${nom} : ${mesure} dans la scène, ${valeur} dans les sources`);
  }
  assert.equal(def.acteurs.length, 2, "l'élève et la voiture garée, sans autre usager");
});

// Sabotages : chaque défaut est refusé par le contrôle ou l'assertion qui le vise.

test("marche-arriere : le tour du regard fait avant d'engager la marche arrière, un recul sans tour du regard, ou au rétroviseur intérieur (180) au lieu de la lunette, sont refusés par l'assertion d'ordre", () => {
  const tourAvant = copie("marche-arriere");
  [tourAvant.etapes[0].regard, tourAvant.etapes[1].regard] = [tourAvant.etapes[1].regard, tourAvant.etapes[0].regard];
  assert.throws(() => verifierMarcheArriere(tourAvant),
    /marche arrière : tour, arrêtée, feux de recul ; 0, arrêtée, feux de recul ; 165, en reculant, feux de recul ; 0, arrêtée, feux de recul(?! ;)/);
  const sansTour = copie("marche-arriere");
  sansTour.etapes[1].regard = { angle: 0 };
  assert.throws(() => verifierMarcheArriere(sansTour),
    /marche arrière : 0, arrêtée, feux de recul ; 165, en reculant, feux de recul ; 0, arrêtée, feux de recul(?! ;)/);
  const retroviseur = copie("marche-arriere");
  retroviseur.etapes[2].regard = { angle: 180 };
  assert.throws(() => verifierMarcheArriere(retroviseur), /marche arrière : 0, arrêtée, feux de recul ; tour, arrêtée, feux de recul ; 180, en reculant/);
});

test("marche-arriere : reculer pendant le tour du regard, ou partir en marche avant (caisse vers le sud, feux de recul éteints), est refusé par l'assertion d'ordre", () => {
  const sansAttente = copie("marche-arriere");
  sansAttente.acteurs[0].profil[0] = { s: 0, kmh: 0 };   // sans attente au départ : la voiture recule dès le début
  assert.throws(() => verifierMarcheArriere(sansAttente), /marche arrière : 0, en reculant, feux de recul ; tour, en reculant, feux de recul/);
  const enAvant = copie("marche-arriere");
  enAvant.acteurs[0].chemin.segments[0].arriere = false;
  assert.throws(() => verifierMarcheArriere(enAvant), /marche arrière : 0, arrêtée, sans feux de recul ; tour, arrêtée, sans feux de recul ; 165, en avançant/);
});

test("marche-arriere : reculer plus vite que l'allure du pas est refusé : à 7 km/h par les contrôles automatiques (6 km/h au plus en marche arrière), à 5 km/h par l'attente de la scène (4 km/h)", () => {
  for (const [kmhRecul, motif] of [[7, /eleve recule à \d+\.\d km\/h à t = \d+\.\d s \(au plus 6 km\/h\)/], [5, /eleve dépasse 4 km\/h entre s = 0 et s = 15 /]]) {
    const def = copie("marche-arriere");
    def.acteurs[0].profil = def.acteurs[0].profil.map((p) => (p.kmh === MARCHE_ARRIERE_KMH ? { ...p, kmh: kmhRecul } : p));
    assert.match(erreurs(def), motif);
  }
});

test("marche-arriere : une voiture qui touche le trottoir, qui mord la voie de gauche ou qui touche la voiture garée est détectée", () => {
  const trottoir = copie("marche-arriere");
  trottoir.acteurs[0].chemin.segments[0].x0 += 0.4;
  assert.match(erreurs(trottoir), /eleve touche un trottoir/);
  const voieGauche = copie("marche-arriere");
  voieGauche.acteurs[0].chemin.segments[0].x0 -= 1.5;
  assert.match(erreurs(voieGauche), /eleve sort de « voie de droite »/);
  const contreLaGaree = copie("marche-arriere");
  contreLaGaree.acteurs[1].pose.y -= 2.5;
  assert.match(erreurs(contreLaGaree), /eleve et garee se touchent/);
});

test("marche-arriere : un tour du regard de moins de 4 s est refusé ; un clignotant, à droite comme à gauche, aussi", () => {
  const court = copie("marche-arriere");
  court.acteurs[0].profil[0].pause = 4;
  court.etapes[2].delai = 4;
  assert.deepEqual(etapesTropCourtes(court), ["étape 2 : 3.000 s à l'écran, 4 s au moins"]);
  for (const cote of ["droite", "gauche"]) {
    const def = copie("marche-arriere");
    def.acteurs[0].clignotant = [{ cote, de: 0, a: 15 }];
    assert.match(erreurs(def), new RegExp(`eleve : clignotant ${cote} allumé avant s = 15\\.0 m`));
  }
});
