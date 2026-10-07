import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../js/scenes.js";
import { GABARITS, preparerScene, etatActeur, emprise, tempsAtteint, trajet, pointDansPolygone, polygonesSeChevauchent, rectangle }
  from "../js/scene-geometrie.js";
import { REGARD_PORTEE, DEBORD_SUIVI, oeil, cibleSuivie, regardDessine } from "../js/scene-regard.js";
import { TEINTES, FREQ_CLIGNOTANT, TAILLE_PANNEAU, RAYON_REPERE, ECART_REPERES, JEU_REPERE_VOITURE, PAS_REPERE,
  ALLONGEMENT_MAX_REPERE, MARGE_CADRE_REDUIT, FEUX_STOP, clignotantAllume, feuxDeRecul, feuxStop, cadreCamera, reperesEtapes,
  demiLargeurRepere, cadreReduit, emprisePanneau, facteurLecture, SEUIL_DEMARRAGE, SEUILS_VISIBILITE, actionVisibilite }
  from "../js/scene-rendu.js";

// Règles pures du rendu des scènes (correction de la tâche 11) : ce que montre l'image, en lecture comme sur les images
// figées (pas à pas, pause, animations réduites). Le moteur (js/scene-moteur.js) dessine avec ces fonctions.

const proche = (a, b, eps = 1e-9, quoi = "") => assert.ok(Math.abs(a - b) <= eps, `${quoi}${quoi ? " : " : ""}${a} au lieu de ${b}`);
const scenes = () => Object.entries(SCENES).map(([code, entree]) => [code, preparerScene(entree.construire())]);
const etatsA = (sc, t) => new Map(sc.acteurs.map((a) => [a.id, etatActeur(a, t)]));
// Le point [x, y] est-il dans le cadre c ({ x, y, largeur, hauteur }), bords compris ?
const dans = (c, [x, y]) => x >= c.x - 1e-9 && x <= c.x + c.largeur + 1e-9 && y >= c.y - 1e-9 && y <= c.y + c.hauteur + 1e-9;
// Le même point ramené dans le monde : une emprise qui déborde du monde n'y est montrée que pour sa partie intérieure.
const dansLeMonde = (sc, [x, y]) => [Math.min(Math.max(x, 0), sc.monde.largeur), Math.min(Math.max(y, 0), sc.monde.hauteur)];

// ===== Teintes =====

// Luminance relative et rapport de contraste WCAG 2 d'une teinte #RRGGBB.
function luminance(teinte) {
  const n = parseInt(teinte.slice(1), 16);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
const contraste = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Teinte (degrés, cercle chromatique) d'une couleur #RRGGBB.
function teinteDeg(couleur) {
  const n = parseInt(couleur.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

test("TEINTES : le trajet prévu se lit sur la chaussée (3:1 au moins, WCAG 1.4.11), dans une teinte plus claire que celle de la voiture de l'élève", () => {
  assert.ok(contraste(TEINTES.trajet, TEINTES.chaussee) >= 3, `contraste de ${contraste(TEINTES.trajet, TEINTES.chaussee).toFixed(2)}:1 sur la chaussée`);
  assert.ok(Math.abs(teinteDeg(TEINTES.trajet) - teinteDeg(TEINTES.eleve)) <= 10, "même famille de teinte que la voiture de l'élève");
  assert.ok(luminance(TEINTES.trajet) > luminance(TEINTES.eleve), "plus claire que la voiture de l'élève");
  assert.notEqual(TEINTES.trajet, TEINTES.peinture, "jamais le blanc de la peinture");
});

test("TEINTES : les feux de recul sont blancs et se lisent sur la chaussée comme sur la voiture de l'élève, carrosserie et bordure (3:1 au moins, WCAG 1.4.11)", () => {
  for (const fond of ["chaussee", "eleve", "eleveBord"]) {
    const c = contraste(TEINTES.recul, TEINTES[fond]);
    assert.ok(c >= 3, `contraste de ${c.toFixed(2)}:1 sur ${fond}`);
  }
  const n = parseInt(TEINTES.recul.slice(1), 16), canaux = [n >> 16, (n >> 8) & 255, n & 255];
  assert.ok(luminance(TEINTES.recul) >= 0.9, "blancs : très clairs");
  assert.ok(Math.max(...canaux) - Math.min(...canaux) <= 16, "blancs : sans dominante de couleur");
});

// ===== Clignotant =====

test("clignotantAllume : en lecture, 1,5 Hz, allumé la première moitié de chaque période, comptée depuis l'allumage du clignotant", () => {
  assert.equal(FREQ_CLIGNOTANT, 1.5);
  // Allumages quelconques, dont 0,5 s, où une phase comptée depuis le début de la scène serait éteinte : seul compte le
  // temps écoulé depuis l'allumage (clignotantDepuis, donné par etatActeur).
  for (const depuis of [0, 0.5, 2.9, 19.3635]) {
    const droite = { clignotant: "droite", clignotantDepuis: depuis }, gauche = { clignotant: "gauche", clignotantDepuis: depuis };
    for (const dt of [0, 0.1, 0.32, 0.67, 0.704, 0.99, 1.34]) {
      assert.equal(clignotantAllume(droite, depuis + dt, false), "droite", `allumé à t = ${depuis} s, ${dt} s plus tard`);
    }
    for (const dt of [0.34, 0.5, 0.66, 1.01, 1.2]) {
      assert.equal(clignotantAllume(gauche, depuis + dt, false), null, `allumé à t = ${depuis} s, ${dt} s plus tard`);
    }
    assert.equal(clignotantAllume(gauche, depuis + 0.704, false), "gauche");
  }
  // Un instant à peine antérieur à l'allumage (l'état tolère 1e-9 m sur l'abscisse) compte comme l'allumage : éclat.
  assert.equal(clignotantAllume({ clignotant: "droite", clignotantDepuis: 2 }, 2 - 1e-9, false), "droite");
});

test("clignotantAllume : sur une image figée, le clignotant en marche est toujours dessiné allumé, de son côté", () => {
  for (const t of [0, 0.34, 0.5, 0.66, 1.0, 1.2, 9.086, 20.511]) {
    assert.equal(clignotantAllume({ clignotant: "droite" }, t, true), "droite", `t = ${t} s`);
    assert.equal(clignotantAllume({ clignotant: "gauche" }, t, true), "gauche", `t = ${t} s`);
  }
  for (const fige of [true, false]) assert.equal(clignotantAllume({ clignotant: null }, 0.1, fige), null, "éteint : jamais dessiné");
});

test("scènes, images figées : à chaque étape, le clignotant en marche est dessiné allumé, du bon côté", () => {
  let etapesAvecClignotant = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    let enMarche = 0;
    sc.etapes.forEach((et, i) => {
      const e = etatActeur(sc.eleve, et.t);
      assert.equal(clignotantAllume(e, et.t, true), e.clignotant, `${code}, étape ${i + 1}`);
      if (e.clignotant) enMarche++;
    });
    etapesAvecClignotant += enMarche;
  }
  assert.ok(etapesAvecClignotant > 0, "aucune scène n'a d'étape avec un clignotant en marche : le test ne vérifie rien");
});

test("scènes, en lecture : chaque clignotant de chaque acteur éclaire dès qu'il s'allume, une demi-période, puis suit le rythme ; celui de l'élève, dans l'étape en cours à cet instant", () => {
  // Les virages allument celui de l'élève sous l'étape 1 (contrôler, puis indiquer) ; le giratoire, traversé en face, sous
  // l'étape « Clignotant à droite après la sortie précédente ». tests/scenes.test.mjs épingle cette étape pour chaque scène.
  const demiPeriode = 1 / (2 * FREQ_CLIGNOTANT);
  let clignotantsVerifies = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    let verifies = 0;
    for (const a of sc.acteurs) {
      for (const c of a.clignotant || []) {
        const nom = `${code}, ${a.id}, clignotant ${c.cote} à partir de s = ${c.de.toFixed(3)} m`;
        // Allumage et extinction datés (delai, delaiFin : voir etatActeur) : un clignotant mis pendant un arrêt s'allume
        // delai secondes après l'arrivée en `de`, et non à cette arrivée.
        const tAllume = tempsAtteint(a.chrono, c.de) + (c.delai ?? 0), tEteint = tempsAtteint(a.chrono, c.a) + (c.delaiFin ?? 0);
        assert.ok(tEteint - tAllume > 3 * demiPeriode, `${nom} : intervalle trop court pour le vérifier`);
        // Au millième de seconde, depuis le millième qui précède l'allumage : premier éclat, extinction, éclat suivant.
        const eclaire = (t) => clignotantAllume(etatActeur(a, t), t, false) === c.cote;
        const bascules = [];
        let etat = false;
        for (let k = 0; bascules.length < 3; k++) {
          const t = Math.max(0, tAllume - 0.001) + k * 0.001;
          assert.ok(t <= tEteint, `${nom} : moins de trois bascules avant l'extinction`);
          if (eclaire(t) !== etat) { etat = !etat; bascules.push(t); }
        }
        const [premier, extinction, suivant] = bascules;
        assert.ok(Math.abs(premier - tAllume) <= 0.002, `${nom} : allumé à t = ${tAllume.toFixed(3)} s, premier éclat à t = ${premier.toFixed(3)} s`);
        proche(extinction - premier, demiPeriode, 0.003, `${nom} : durée du premier éclat`);
        proche(suivant - premier, 2 * demiPeriode, 0.003, `${nom} : éclat suivant`);
        if (a === sc.eleve) {
          // Étape en cours quand le clignotant s'allume, comme dans le moteur : la dernière commencée.
          let n = 0;
          sc.etapes.forEach((et, i) => { if (tAllume + 1e-9 >= et.t) n = i; });
          const debut = sc.etapes[n].t, fin = n + 1 < sc.etapes.length ? sc.etapes[n + 1].t : sc.duree;
          assert.ok(premier >= debut - 0.001 && premier < fin, `${nom} : premier éclat à t = ${premier.toFixed(3)} s, hors de l'étape ${n + 1}`);
        }
        verifies++;
      }
    }
    clignotantsVerifies += verifies;
  }
  assert.ok(clignotantsVerifies > 0, "aucune scène n'a de clignotant : le test ne vérifie rien");
});

// ===== Feux de recul =====

// Voiture de l'élève seule, sans décor : `chemin` et `profil` donnés, une seule étape.
const voitureSeule = (chemin, profil) => preparerScene({
  code: "essai", monde: { largeur: 20, hauteur: 40 }, decor: { panneaux: [], marquages: [], obstacles: [] },
  acteurs: [{ id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil }], etapes: [{ s: 0 }],
}).eleve;

test("feuxDeRecul : éteints en marche avant, allumés en marche arrière, à l'arrêt compris dès le rebroussement, la marche arrière étant engagée", () => {
  // Avance de 6 m vers le nord, s'arrête 2 s au rebroussement, recule de 6 m au pas, s'arrête.
  const a = voitureSeule(trajet(10, 30, -90).droit(6).inverser().droit(6).fin(),
    [{ s: 0, kmh: 10 }, { s: 4, kmh: 10 }, { s: 6, kmh: 0, pause: 2 }, { s: 7, kmh: 4 }, { s: 11, kmh: 4 }, { s: 12, kmh: 0 }]);
  const tArret = tempsAtteint(a.chrono, 6), tFin = a.chrono.duree;
  for (const t of [0, 1, tArret - 0.05]) {
    const e = etatActeur(a, t);
    assert.equal(e.marche, "avant", `t = ${t.toFixed(3)} s`);
    assert.equal(feuxDeRecul(e), false, `t = ${t.toFixed(3)} s, en marche avant`);
  }
  for (const t of [tArret + 1e-6, tArret + 1, tArret + 2 - 1e-6]) {
    const e = etatActeur(a, t);
    assert.equal(e.v, 0, `t = ${t.toFixed(3)} s : arrêté au rebroussement`);
    assert.equal(feuxDeRecul(e), true, `t = ${t.toFixed(3)} s, arrêté au rebroussement`);
  }
  for (const t of [tArret + 3, tArret + 5, tFin, tFin + 1]) {
    assert.equal(feuxDeRecul(etatActeur(a, t)), true, `t = ${t.toFixed(3)} s, en marche arrière`);
  }
});

test("feuxDeRecul : un trajet parti en marche arrière les allume dès le départ, à l'arrêt ; un rebroussement vers la marche avant les éteint dès l'arrêt ; un acteur posé ne les allume jamais", () => {
  // Arrêtée 3 s, recule de 4 m vers le sud au pas, s'arrête 2 s au rebroussement, repart en avant.
  const a = voitureSeule(trajet(10, 20, 90, { arriere: true }).droit(4).inverser().droit(4).fin(),
    [{ s: 0, kmh: 0, pause: 3 }, { s: 1, kmh: 4 }, { s: 3, kmh: 4 }, { s: 4, kmh: 0, pause: 2 }, { s: 5, kmh: 5 }, { s: 8, kmh: 5 }]);
  const tArret = tempsAtteint(a.chrono, 4);
  for (const t of [0, 1.5, 3, 4]) {
    assert.equal(feuxDeRecul(etatActeur(a, t)), true, `t = ${t} s, marche arrière engagée`);
  }
  for (const t of [tArret + 1e-6, tArret + 1, a.chrono.duree]) {
    assert.equal(feuxDeRecul(etatActeur(a, t)), false, `t = ${t.toFixed(3)} s, marche avant`);
  }
  const garee = { id: "garee", role: "autre", gabarit: "voiture", pose: { x: 3, y: 4, cap: -90 } };
  assert.equal(feuxDeRecul(etatActeur(garee, 5)), false);
});

// ===== Feux stop =====

test("feuxStop : allumés quand le véhicule freine (plus de 0,3 m/s²) ou qu'il est à l'arrêt (moins de 0,05 m/s), le pied sur le frein ; un acteur posé qui attend les garde allumés", () => {
  assert.deepEqual(FEUX_STOP, { deceleration: 0.3, arret: 0.05 });
  const roule = { id: "roule", gabarit: "voiture" };
  assert.equal(feuxStop(roule, { v: 8, a: 0 }), false, "à allure constante");
  assert.equal(feuxStop(roule, { v: 8, a: 1.5 }), false, "en accélérant");
  assert.equal(feuxStop(roule, { v: 8, a: -0.3 }), false, "décélération de 0,3 m/s², sans freiner");
  assert.equal(feuxStop(roule, { v: 8, a: -0.31 }), true, "en freinant");
  assert.equal(feuxStop(roule, { v: 0.05, a: 0 }), false, "à 0,05 m/s");
  assert.equal(feuxStop(roule, { v: 0.049, a: 0 }), true, "à l'arrêt");
  // Un acteur posé sans autre marque attend (au cédez-le-passage, au feu) : il garde le pied sur le frein.
  const attend = { id: "attend", gabarit: "voiture", pose: { x: 3, y: 4, cap: -90 } };
  for (const t of [0, 2, 9.5]) assert.equal(feuxStop(attend, etatActeur(attend, t)), true, `acteur posé qui attend, t = ${t} s`);
});

test("feuxStop : une voiture en stationnement (acteur posé marqué `stationne`) ne les allume jamais, personne ne freine ; la marque ne vaut que pour un acteur posé", () => {
  const garee = { id: "garee", gabarit: "voiture", pose: { x: 3, y: 4, cap: -90 }, stationne: true };
  for (const t of [0, 2, 9.5]) assert.equal(feuxStop(garee, etatActeur(garee, t)), false, `voiture garée, t = ${t} s`);
  // Une voiture qui roule n'est pas en stationnement : la marque ne change rien à ses feux.
  assert.equal(feuxStop({ id: "x", gabarit: "voiture", stationne: true }, { v: 0, a: 0 }), true);
});

test("scènes : une voiture en stationnement n'allume jamais ses feux stop", () => {
  let garees = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    for (const a of sc.acteurs.filter((x) => x.pose && x.stationne === true)) {
      garees++;
      for (let t = 0; t <= sc.duree; t += 0.25) assert.equal(feuxStop(a, etatActeur(a, t)), false, `${code}, ${a.id}, t = ${t} s`);
    }
  }
  assert.ok(garees > 0, "aucune scène n'a de voiture en stationnement : le test ne vérifie rien");
});

// ===== Cadres =====

test("cadreCamera : en lecture, le cadre de la caméra, centré sur l'élève et borné au monde ; sans caméra, le monde entier", () => {
  for (const [code, sc] of scenes()) {
    const { largeur: w, hauteur: h } = sc.camera;
    for (let t = 0; t <= sc.duree; t += 0.25) {
      const e = etatActeur(sc.eleve, t), c = cadreCamera(sc, e);
      assert.equal(c.largeur, w); assert.equal(c.hauteur, h);
      assert.equal(c.x, Math.min(Math.max(e.x - w / 2, 0), sc.monde.largeur - w), `${code}, t = ${t} s`);
      assert.equal(c.y, Math.min(Math.max(e.y - h / 2, 0), sc.monde.hauteur - h), `${code}, t = ${t} s`);
    }
    assert.deepEqual(cadreCamera({ ...sc, camera: undefined }, etatActeur(sc.eleve, 0)),
      { x: 0, y: 0, largeur: sc.monde.largeur, hauteur: sc.monde.hauteur });
  }
});

// Boîte d'un repère : rectangle englobant de son disque ou de sa pastille.
const boiteRepere = (r) => {
  const d = demiLargeurRepere(r.numeros);
  return rectangle(r.x - d, r.y - RAYON_REPERE, r.x + d, r.y + RAYON_REPERE);
};
// Dessin d'un panneau, et bande d'une ligne de marquage (rectangle de la largeur de la ligne, de m.de à m.a).
const dessinPanneau = (p) => { const r = emprisePanneau(p); return rectangle(r.x, r.y, r.x + r.largeur, r.y + r.hauteur); };
function bande(m) {
  const [x0, y0] = m.de, [x1, y1] = m.a, l = Math.hypot(x1 - x0, y1 - y0);
  const px = (-(y1 - y0) / l) * (m.largeur / 2), py = ((x1 - x0) / l) * (m.largeur / 2);
  return [[x0 + px, y0 + py], [x1 + px, y1 + py], [x1 - px, y1 - py], [x0 - px, y0 - py]];
}
const lignesCedez = (sc) => sc.decor.marquages.filter((m) => m.type === "ligne" && typeof m.role === "string" && m.role.startsWith("cedez-"));
// Emprise d'un acteur posé élargie de JEU_REPERE_VOITURE de chaque côté (rectangle de même centre et de même cap) : la place
// qu'un repère lui laisse.
function empriseElargie(a) {
  const e = etatActeur(a, 0), { longueur: L, largeur: W } = GABARITS[a.gabarit], j = JEU_REPERE_VOITURE;
  const c = Math.cos(e.cap), s = Math.sin(e.cap);
  return [[L / 2 + j, -W / 2 - j], [L / 2 + j, W / 2 + j], [-L / 2 - j, W / 2 + j], [-L / 2 - j, -W / 2 - j]]
    .map(([u, v]) => [e.x + u * c - v * s, e.y + u * s + v * c]);
}
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

test("reperesEtapes : un repère par position de l'élève au début d'une étape, à sa droite au plus près, écarté ou passé à sa gauche seulement si cette place est prise ou sort du monde ; deux étapes à moins de ECART_REPERES m partagent un repère", () => {
  assert.equal(RAYON_REPERE, 1.2);
  assert.equal(ECART_REPERES, 1.5);
  assert.equal(JEU_REPERE_VOITURE, 0.3);
  assert.equal(PAS_REPERE, 0.1);
  assert.equal(ALLONGEMENT_MAX_REPERE, 3);
  let deplaces = 0, horsDuMonde = 0;
  for (const [code, sc] of scenes()) {
    const reperes = reperesEtapes(sc);
    assert.deepEqual(reperes.flatMap((r) => r.numeros).sort((a, b) => a - b), sc.etapes.map((_, i) => i + 1),
      `${code} : chaque étape a un numéro, une seule fois`);
    const voitures = sc.etapes.map((et) => emprise(sc.eleve.gabarit, etatActeur(sc.eleve, et.t)));
    // Le décor, et les acteurs posés (dessinés au même endroit sur toute image), avec le jeu qu'un repère leur laisse.
    const decor = [...sc.decor.panneaux.map(dessinPanneau), ...lignesCedez(sc).map(bande),
      ...sc.acteurs.filter((a) => a.pose).map(empriseElargie)];
    reperes.forEach((r, i) => {
      const nom = `${code} : repère ${r.numeros.join("·")}`;
      const premier = etatActeur(sc.eleve, sc.etapes[r.numeros[0] - 1].t);
      // Sur la perpendiculaire au cap qui passe par l'élève : à droite (repère de l'écran, y vers le bas :
      // (-sin cap ; cos cap)) ou à gauche, au moins à la distance qui laisse JEU_REPERE_VOITURE entre le flanc de la
      // voiture et le bord du repère, au plus ALLONGEMENT_MAX_REPERE au-delà.
      const nx = -Math.sin(premier.cap), ny = Math.cos(premier.cap);
      const d0 = GABARITS.voiture.largeur / 2 + JEU_REPERE_VOITURE + demiLargeurRepere(r.numeros) * Math.abs(nx) + RAYON_REPERE * Math.abs(ny);
      proche((r.x - premier.x) * Math.cos(premier.cap) + (r.y - premier.y) * Math.sin(premier.cap), 0, 1e-9, `${nom}, décalé le long du cap`);
      const d = (r.x - premier.x) * nx + (r.y - premier.y) * ny;
      assert.ok(Math.abs(d) >= d0 - 1e-9 && Math.abs(d) <= d0 + ALLONGEMENT_MAX_REPERE + 1e-9, `${nom}, à ${d.toFixed(2)} m du centre de la voiture`);
      // Au plus près à droite, sauf si cette place est prise (panneau, ligne de cédez-le-passage, acteur posé et son jeu,
      // voiture de l'élève au début d'une étape, repère déjà posé) ou sort du monde, comme le dit la règle de rendu.
      if (Math.abs(d - d0) > 1e-9) {
        const auPlusPres = boiteRepere({ x: premier.x + d0 * nx, y: premier.y + d0 * ny, numeros: r.numeros });
        const dehors = auPlusPres.some(([x, y]) => x < 0 || x > sc.monde.largeur || y < 0 || y > sc.monde.hauteur);
        const obstacles = [...decor, ...voitures, ...reperes.slice(0, i).map(boiteRepere)];
        assert.ok(dehors || obstacles.some((o) => polygonesSeChevauchent(auPlusPres, o)),
          `${nom}, écarté alors que sa place à droite était libre et dans le monde`);
        deplaces++;
        if (dehors) horsDuMonde++;
      }
      for (const n of r.numeros) {
        const e = etatActeur(sc.eleve, sc.etapes[n - 1].t);
        assert.ok(Math.hypot(e.x - premier.x, e.y - premier.y) < ECART_REPERES, `${code} : étape ${n} trop loin de son repère`);
      }
    });
  }
  assert.ok(deplaces > 0, "aucun repère écarté : le cas n'est pas exercé");
  assert.ok(horsDuMonde > 0, "aucun repère écarté parce que sa place sortait du monde : le cas n'est pas exercé");
  // Tourner à gauche : l'angle mort et le virage commencent au même point d'arrêt, sous un seul repère.
  const sc = preparerScene(SCENES["tourner-gauche"].construire());
  assert.ok(reperesEtapes(sc).some((r) => r.numeros.includes(6) && r.numeros.includes(7)));
});

test("reperesEtapes : aucun repère n'est caché par la voiture de l'élève, quelle que soit l'étape montrée", () => {
  for (const [code, sc] of scenes()) {
    const reperes = reperesEtapes(sc);
    sc.etapes.forEach((et, j) => {
      const voiture = emprise(sc.eleve.gabarit, etatActeur(sc.eleve, et.t));
      for (const r of reperes) {
        assert.ok(!polygonesSeChevauchent(voiture, boiteRepere(r)), `${code} : le repère ${r.numeros.join("·")} passe sous la voiture à l'étape ${j + 1}`);
      }
    });
  }
});

test("reperesEtapes : un repère garde autour de chaque acteur posé (voiture garée, véhicule qui attend) le jeu qu'il garde autour de la voiture de l'élève, JEU_REPERE_VOITURE", () => {
  // Un acteur posé est dessiné au même endroit sur toute image, par-dessus les repères : un repère qui passerait dessous
  // serait caché, et un repère collé à lui se lirait comme le désignant.
  let scenesAvecPoses = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    const poses = sc.acteurs.filter((a) => a.pose);
    scenesAvecPoses += (poses.length > 0 ? 1 : 0);
    for (const r of reperesEtapes(sc)) {
      for (const a of poses) {
        const d = distancePolygones(boiteRepere(r), emprise(a.gabarit, etatActeur(a, 0)));
        assert.ok(d >= JEU_REPERE_VOITURE - 1e-9, `${code} : le repère ${r.numeros.join("·")} à ${d.toFixed(3)} m de ${a.id}`);
      }
    }
  }
  assert.ok(scenesAvecPoses > 0, "aucune scène n'a d'acteur posé : le test ne vérifie rien");
});

test("reperesEtapes : aucun repère sur le dessin d'un panneau", () => {
  let scenesAvecPanneaux = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    scenesAvecPanneaux += (sc.decor.panneaux.length > 0 ? 1 : 0);
    for (const r of reperesEtapes(sc)) {
      for (const p of sc.decor.panneaux) {
        assert.ok(!polygonesSeChevauchent(boiteRepere(r), dessinPanneau(p)), `${code} : le repère ${r.numeros.join("·")} couvre le panneau ${p.code} en (${p.x.toFixed(2)} ; ${p.y.toFixed(2)})`);
      }
    }
  }
  assert.ok(scenesAvecPanneaux > 0, "aucune scène n'a de panneau : le test ne vérifie rien");
});

test("reperesEtapes : aucun repère sur une ligne de cédez-le-passage", () => {
  let scenesAvecCedez = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    const lignes = lignesCedez(sc);
    scenesAvecCedez += (lignes.length > 0 ? 1 : 0);
    for (const r of reperesEtapes(sc)) {
      for (const m of lignes) assert.ok(!polygonesSeChevauchent(boiteRepere(r), bande(m)), `${code} : le repère ${r.numeros.join("·")} couvre la ligne ${m.role}`);
    }
  }
  assert.ok(scenesAvecCedez > 0, "aucune scène n'a de ligne de cédez-le-passage : le test ne vérifie rien");
});

test("reperesEtapes : les repères ne se chevauchent pas", () => {
  for (const [code, sc] of scenes()) {
    const reperes = reperesEtapes(sc);
    reperes.forEach((a, i) => reperes.slice(i + 1).forEach((b) => {
      assert.ok(!polygonesSeChevauchent(boiteRepere(a), boiteRepere(b)), `${code} : les repères ${a.numeros.join("·")} et ${b.numeros.join("·")} se chevauchent`);
    }));
  }
});

test("demiLargeurRepere : un disque pour un seul numéro, une pastille qui contient tout le texte quand des étapes partagent un repère", () => {
  for (const numeros of [[1], [8], [12]]) assert.equal(demiLargeurRepere(numeros), RAYON_REPERE, numeros.join("·"));
  // Le texte est en chasse fixe de 1,2 m, soit 0,72 m par caractère (0,6 em) : la pastille le contient, avec du jeu.
  for (const numeros of [[6, 7], [5, 6, 7], [1, 2, 3, 4]]) {
    const texte = numeros.join("·");
    assert.ok(2 * demiLargeurRepere(numeros) >= texte.length * 0.72 + 0.4, `« ${texte} » déborde de sa pastille`);
  }
});

test("cadreReduit : un cadre fixe qui montre tous les repères, les panneaux, les acteurs posés, la voiture de l'élève à chaque étape et chaque usager suivi des yeux à l'instant de son étape", () => {
  assert.equal(MARGE_CADRE_REDUIT, 1);
  let cadresQuiBougent = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    const c = cadreReduit(sc);
    assert.equal(c.largeur, sc.camera.largeur, `${code} : largeur de la caméra (même échelle)`);
    assert.ok(c.hauteur >= sc.camera.hauteur, `${code} : au moins la hauteur de la caméra`);
    assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.largeur <= sc.monde.largeur + 1e-9 && c.y + c.hauteur <= sc.monde.hauteur + 1e-9,
      `${code} : cadre dans le monde`);
    const montres = [];
    for (const r of reperesEtapes(sc)) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const p = [r.x + dx * demiLargeurRepere(r.numeros), r.y + dy * RAYON_REPERE];
        assert.ok(dans(c, p), `${code} : repère ${r.numeros.join("·")} hors du cadre`);
        montres.push(p);
      }
    }
    for (const panneau of sc.decor.panneaux) {
      const r = emprisePanneau(panneau);
      for (const p of [[r.x, r.y], [r.x + r.largeur, r.y + r.hauteur]]) {
        assert.ok(dans(c, dansLeMonde(sc, p)), `${code} : panneau ${panneau.code} en (${panneau.x} ; ${panneau.y}) coupé par le cadre`);
        montres.push(dansLeMonde(sc, p));
      }
    }
    // Un acteur posé (voiture garée, véhicule qui attend) est dessiné au même endroit sur toute image : il y est entier.
    for (const a of sc.acteurs.filter((x) => x.pose)) {
      for (const p of emprise(a.gabarit, etatActeur(a, 0))) {
        assert.ok(dans(c, dansLeMonde(sc, p)), `${code} : ${a.id} (acteur posé) coupé par le cadre`);
        montres.push(dansLeMonde(sc, p));
      }
    }
    sc.etapes.forEach((et, i) => {
      for (const p of emprise(sc.eleve.gabarit, etatActeur(sc.eleve, et.t))) {
        assert.ok(dans(c, dansLeMonde(sc, p)), `${code} : voiture de l'élève hors du cadre à l'étape ${i + 1}`);
        montres.push(dansLeMonde(sc, p));
      }
      const id = et.regard && et.regard.suivre;
      if (!id) return;
      const autre = sc.acteurs.find((a) => a.id === id), s = etatActeur(autre, et.t);
      assert.ok(s.visible, `${code} : ${id} invisible au début de l'étape ${i + 1}, qui le suit des yeux`);
      for (const p of emprise(autre.gabarit, s)) {
        assert.ok(dans(c, dansLeMonde(sc, p)), `${code} : ${id} hors du cadre au début de l'étape ${i + 1}`);
        montres.push(dansLeMonde(sc, p));
      }
    });
    // Marge d'environ 1 m : le cadre ne dépasse ce qu'il montre que de MARGE_CADRE_REDUIT, ou pour garder la hauteur
    // de la caméra.
    const ys = montres.map(([, y]) => y);
    assert.ok(c.hauteur <= Math.max(sc.camera.hauteur, Math.max(...ys) - Math.min(...ys) + 2 * MARGE_CADRE_REDUIT) + 1e-9,
      `${code} : cadre de ${c.hauteur} m de haut, plus que nécessaire`);
    // Le cadre de départ de la caméra ne montrait qu'une partie des repères : c'est ce que ce cadre corrige.
    const depart = cadreCamera(sc, etatActeur(sc.eleve, 0));
    cadresQuiBougent += (reperesEtapes(sc).some((r) => !dans(depart, [r.x, r.y])) ? 1 : 0);
  }
  assert.ok(cadresQuiBougent > 0, "aucune scène ne demande un cadre réduit plus grand que celui du départ : le test ne vérifie rien");
});

test("cadreReduit : au moins la hauteur de la caméra, centré sur ce qu'il montre puis borné au monde ; sans caméra, le monde entier", () => {
  const camera = { largeur: 30, hauteur: 40 };
  const definition = (y, camera) => ({
    code: "essai", monde: { largeur: 30, hauteur: 100 }, camera, decor: { panneaux: [], marquages: [] },
    acteurs: [{ id: "eleve", role: "eleve", gabarit: "voiture", chemin: trajet(15, y, -90).droit(5).fin(),
      profil: [{ s: 0, kmh: 18 }, { s: 5, kmh: 18 }] }],
    etapes: [{ s: 0 }, { s: 5 }],
  });
  // Voiture de y = 62,25 à y = 52,75 : cadre de 40 m centré sur 57,5.
  const c = cadreReduit(preparerScene(definition(60, camera)));
  assert.deepEqual([c.x, c.largeur, c.hauteur], [0, 30, 40]);
  proche(c.y, 37.5);
  // Près du bord bas : le cadre s'arrête au bord du monde.
  const bas = cadreReduit(preparerScene(definition(97, camera)));
  proche(bas.y, 60); assert.equal(bas.hauteur, 40);
  assert.deepEqual(cadreReduit(preparerScene(definition(60, undefined))), { x: 0, y: 0, largeur: 30, hauteur: 100 });
});

// ===== Regard sur les images figées =====

test("scènes, images figées : le regard de chaque étape est dessiné, un cône pour un angle ou un usager suivi, le secteur parcouru pour un balayage ou un tour du regard", () => {
  for (const [code, sc] of scenes()) {
    sc.etapes.forEach((et, i) => {
      const e = etatActeur(sc.eleve, et.t);
      const r = regardDessine(et, e, et.t, etatsA(sc, et.t), true);
      if (!et.regard) { assert.equal(r, null); return; }
      assert.ok(r, `${code}, étape ${i + 1} : pas de regard sur l'image figée`);
      assert.equal(r.forme, et.regard.balayage || et.regard.tour ? "secteur" : "cone", `${code}, étape ${i + 1}`);
    });
  }
});

test("scènes : le cône d'un usager suivi s'arrête 2 m au-delà de lui ; ramené devant, il reprend toute la portée", () => {
  let ramene = 0;
  for (const [code, sc] of scenes()) {
    sc.etapes.forEach((et, i) => {
      if (!(et.regard && et.regard.suivre)) return;
      const fin = i + 1 < sc.etapes.length ? sc.etapes[i + 1].t : sc.duree;
      for (let t = et.t; t < fin; t += 0.05) {
        const etats = etatsA(sc, t), e = etats.get(sc.eleve.id), o = oeil(e);
        const r = regardDessine(et, e, t, etats), cible = cibleSuivie(et, e, etats);
        const attendu = cible ? Math.min(REGARD_PORTEE, Math.hypot(cible.x - o.x, cible.y - o.y) + DEBORD_SUIVI) : REGARD_PORTEE;
        if (!cible) ramene++;
        for (const p of r.poly.slice(1)) proche(Math.hypot(p[0] - o.x, p[1] - o.y), attendu, 1e-9, `${code}, t = ${t.toFixed(2)} s`);
      }
    });
  }
  assert.ok(ramene > 0, "aucun regard ramené devant : le cas n'est pas exercé");
});

// ===== Panneaux et facteur de lecture =====

test("emprisePanneau : le dessin du panneau est centré sur sa position, de TAILLE_PANNEAU de côté, ses quatre coins sur le trottoir", () => {
  let panneauxVerifies = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    const trottoirs = sc.decor.obstacles.filter((o) => o.nature === "trottoir");
    panneauxVerifies += sc.decor.panneaux.length;
    for (const p of sc.decor.panneaux) {
      const r = emprisePanneau(p);
      assert.equal(r.largeur, TAILLE_PANNEAU); assert.equal(r.hauteur, TAILLE_PANNEAU);
      proche(r.x + r.largeur / 2, p.x); proche(r.y + r.hauteur / 2, p.y);
      const coins = [[r.x, r.y], [r.x + r.largeur, r.y], [r.x + r.largeur, r.y + r.hauteur], [r.x, r.y + r.hauteur]];
      assert.ok(trottoirs.some((o) => coins.every((q) => pointDansPolygone(q, o.poly))),
        `${code} : le dessin du panneau ${p.code} en (${p.x} ; ${p.y}) déborde du trottoir`);
    }
  }
  assert.ok(panneauxVerifies > 0, "aucune scène n'a de panneau : le test ne vérifie rien");
});

test("facteurLecture : « × n » avec une virgule décimale et un libellé lisible ; rien à vitesse réelle", () => {
  assert.equal(facteurLecture(1), null);
  assert.deepEqual(facteurLecture(0.5), { texte: "× 0,5", libelle: "Lecture ralentie : 0,5 fois la vitesse réelle" });
  assert.deepEqual(facteurLecture(0.25), { texte: "× 0,25", libelle: "Lecture ralentie : 0,25 fois la vitesse réelle" });
  assert.deepEqual(facteurLecture(2), { texte: "× 2", libelle: "Lecture accélérée : 2 fois la vitesse réelle" });
});

// ===== Visibilité du schéma : quand la lecture démarre, quand elle s'interrompt =====

test("SEUILS_VISIBILITE : l'observateur notifie à 0 (le schéma sort tout à fait de l'écran) et à 60 % (assez visible pour démarrer)", () => {
  assert.equal(SEUIL_DEMARRAGE, 0.6);
  assert.deepEqual(SEUILS_VISIBILITE, [0, 0.6]);
});

test("actionVisibilite : la première lecture démarre dès que 60 % du schéma est visible, une seule fois", () => {
  for (const rapport of [0.6, 0.85, 1]) assert.equal(actionVisibilite(rapport, false, false), "demarrer", `${rapport}`);
  for (const rapport of [0, 0.01, 0.3, 0.59]) assert.equal(actionVisibilite(rapport, false, false), null, `${rapport} : pas assez visible`);
  for (const rapport of [0.6, 1]) assert.equal(actionVisibilite(rapport, true, false), null, `${rapport} : déjà lu, on attend « Rejouer »`);
});

test("actionVisibilite : la lecture ne s'interrompt que lorsque le schéma est tout à fait hors de l'écran", () => {
  // Lire les dernières étapes de la liste, sous un schéma à moitié sorti de l'écran, ne l'interrompt pas.
  for (const rapport of [1, 0.9, 0.6, 0.59, 0.4, 0.1, 0.001]) assert.equal(actionVisibilite(rapport, true, true), null, `${rapport} : encore visible`);
  assert.equal(actionVisibilite(0, true, true), "pause");
  // Rien à suspendre quand rien ne joue.
  assert.equal(actionVisibilite(0, true, false), null);
  assert.equal(actionVisibilite(0, false, false), null);
});

test("actionVisibilite : un défilement de bout en bout démarre une fois, ne suspend qu'à la sortie complète, ne relance pas", () => {
  let dejaVu = false, enCours = false;
  const journal = [];
  for (const rapport of [0, 0.2, 0.7, 0.5, 0.05, 0, 0.3, 0.8]) {
    const action = actionVisibilite(rapport, dejaVu, enCours);
    if (action === "demarrer") { dejaVu = true; enCours = true; }
    if (action === "pause") enCours = false;
    journal.push(action);
  }
  assert.deepEqual(journal, [null, null, "demarrer", null, null, "pause", null, null]);
});
