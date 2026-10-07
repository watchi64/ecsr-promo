import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../js/scenes.js";
import { DEG, GABARITS, preparerScene, etatActeur, emprise, tempsAtteint, trajet, pointDansPolygone, polygonesSeChevauchent, rectangle }
  from "../js/scene-geometrie.js";
import { REGARD_PORTEE, REGARD_OUVERTURE, DIRECTIONS_TOUR_FIGE, DEBORD_SUIVI, oeil, cibleSuivie, regardDessine, conesTour }
  from "../js/scene-regard.js";
import { TEINTES, FREQ_CLIGNOTANT, TAILLE_PANNEAU, RAYON_REPERE, ECART_REPERES, JEU_REPERE_VOITURE, PAS_REPERE,
  ALLONGEMENT_MAX_REPERE, MARGE_CADRE_REDUIT, clignotantAllume, feuxDeRecul, cadreCamera, reperesEtapes, demiLargeurRepere, cadreReduit,
  emprisePanneau, facteurLecture, SEUIL_DEMARRAGE, SEUILS_VISIBILITE, actionVisibilite } from "../js/scene-rendu.js";

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

// Voitures autres que celle de l'élève qui reculent dans la scène `def` : un segment de leur trajet est parcouru en marche
// arrière (la marche se lit sur les segments, comme dans pointA).
const autresQuiReculent = (def) => def.acteurs
  .filter((a) => a.role !== "eleve" && a.gabarit === "voiture" && a.chemin && a.chemin.segments.some((seg) => seg.arriere === true))
  .map((a) => a.id);

test("TEINTES : sur la carrosserie grise des autres voitures, les feux de recul n'ont que 2,96:1 (sous 3:1), ce qui est accepté tant que seule la voiture de l'élève recule", () => {
  proche(contraste(TEINTES.recul, TEINTES.autre), 2.96, 0.005, "feux de recul sur la carrosserie grise");
  for (const [code, entree] of Object.entries(SCENES)) {
    assert.deepEqual(autresQuiReculent(entree.construire()), [], `${code} : une autre voiture que celle de l'élève recule`);
  }
  // Le contrôle mord : la voiture d'en face de tourner-gauche, mise en marche arrière, est signalée.
  const def = structuredClone(SCENES["tourner-gauche"].construire());
  def.acteurs.find((a) => a.id === "enFace").chemin.segments[0].arriere = true;
  assert.deepEqual(autresQuiReculent(def), ["enFace"]);
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
    // Une scène où l'élève a un clignotant le montre allumé à une étape au moins.
    if ((sc.eleve.clignotant || []).length) assert.ok(enMarche > 0, `${code} : aucune étape n'a de clignotant en marche, le test ne vérifie rien`);
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
        const tAllume = tempsAtteint(a.chrono, c.de), tEteint = tempsAtteint(a.chrono, c.a);
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
          const { t: debut, fin } = sc.etapes[n];
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

test("reperesEtapes : un repère par position de l'élève au début d'une étape, à sa droite au plus près, écarté ou passé à sa gauche seulement si cette place est prise ; deux étapes à moins de ECART_REPERES m partagent un repère", () => {
  assert.equal(RAYON_REPERE, 1.2);
  assert.equal(ECART_REPERES, 1.5);
  assert.equal(JEU_REPERE_VOITURE, 0.3);
  assert.equal(PAS_REPERE, 0.1);
  assert.equal(ALLONGEMENT_MAX_REPERE, 3);
  let deplaces = 0;
  for (const [code, sc] of scenes()) {
    const reperes = reperesEtapes(sc);
    assert.deepEqual(reperes.flatMap((r) => r.numeros).sort((a, b) => a - b), sc.etapes.map((_, i) => i + 1),
      `${code} : chaque étape a un numéro, une seule fois`);
    const voitures = sc.etapes.map((et) => emprise(sc.eleve.gabarit, etatActeur(sc.eleve, et.t)));
    const decor = [...sc.decor.panneaux.map(dessinPanneau), ...lignesCedez(sc).map(bande)];
    reperes.forEach((r, i) => {
      // Le repère qui porte une étape où le regard fait le tour suit sa propre règle (test suivant).
      if (r.numeros.some((n) => sc.etapes[n - 1].regard && sc.etapes[n - 1].regard.tour)) return;
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
      // Au plus près à droite, sauf si cette place est prise : panneau, ligne de cédez-le-passage, voiture de l'élève au
      // début d'une étape, ou repère déjà posé.
      if (Math.abs(d - d0) > 1e-9) {
        const auPlusPres = boiteRepere({ x: premier.x + d0 * nx, y: premier.y + d0 * ny, numeros: r.numeros });
        const obstacles = [...decor, ...voitures, ...reperes.slice(0, i).map(boiteRepere)];
        assert.ok(obstacles.some((o) => polygonesSeChevauchent(auPlusPres, o)), `${nom}, écarté alors que sa place à droite était libre`);
        deplaces++;
      }
      for (const n of r.numeros) {
        const e = etatActeur(sc.eleve, sc.etapes[n - 1].t);
        assert.ok(Math.hypot(e.x - premier.x, e.y - premier.y) < ECART_REPERES, `${code} : étape ${n} trop loin de son repère`);
      }
    });
  }
  assert.ok(deplaces > 0, "aucun repère écarté : le cas n'est pas exercé");
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

// ===== Repères et tour du regard figé (mineure de la relecture du regard) =====

// Fautes de placement des repères qui portent une étape où le regard fait le tour (js/scene-rendu.js, reperesEtapes), relevées
// sur des repères donnés : [] quand chacun suit la règle. Le repère se pose sur la diagonale à 45 degrés du cap (devant à
// droite, puis derrière à gauche), sans toucher les quatre cônes du tour figé ; si toute la diagonale est prise, le long du cap
// (devant, puis derrière). Dans chaque direction, de la distance au centre de la voiture qui laisse JEU_REPERE_VOITURE entre la
// voiture et le repère le long de cette direction (leurs demi-étendues), par pas de PAS_REPERE, jusqu'à ALLONGEMENT_MAX_REPERE
// au-delà ; il prend la première place libre dans cet ordre. Une place est prise si le repère y sortirait du monde, ou y
// toucherait un panneau, une ligne de cédez-le-passage, un acteur posé, la voiture de l'élève au début d'une étape, un repère
// déjà posé ou, sur la diagonale, un cône du tour figé.
function fautesReperesTour(sc, reperes) {
  const fautes = [], { longueur: L, largeur: W } = GABARITS[sc.eleve.gabarit];
  const voitures = sc.etapes.map((et) => emprise(sc.eleve.gabarit, etatActeur(sc.eleve, et.t)));
  // Le décor, et les acteurs posés, dessinés au même endroit sur toute image.
  const decor = [...sc.decor.panneaux.map(dessinPanneau), ...lignesCedez(sc).map(bande),
    ...sc.acteurs.filter((a) => a.pose).map((a) => emprise(a.gabarit, etatActeur(a, 0)))];
  const pas = Math.round(ALLONGEMENT_MAX_REPERE / PAS_REPERE);
  reperes.forEach((r, i) => {
    const tour = r.numeros.map((n) => sc.etapes[n - 1]).find((et) => et.regard && et.regard.tour);
    if (!tour) return;
    const nom = `repère ${r.numeros.join("·")}`;
    const premier = etatActeur(sc.eleve, sc.etapes[r.numeros[0] - 1].t), vue = etatActeur(sc.eleve, tour.t);
    const cones = conesTour(vue.cap, oeil(vue)), obstacles = [...decor, ...voitures, ...reperes.slice(0, i).map(boiteRepere)];
    const prise = (p, avecCones) => {
      const b = boiteRepere({ x: p.x, y: p.y, numeros: r.numeros });
      return b.some(([x, y]) => x < 0 || x > sc.monde.largeur || y < 0 || y > sc.monde.hauteur)
        || [...obstacles, ...(avecCones ? cones : [])].some((o) => polygonesSeChevauchent(b, o));
    };
    // La diagonale, puis le cap : direction (cos (cap + a) ; sin (cap + a)), l'axe y de l'écran allant vers le bas ;
    // demi-étendue de la voiture le long de chacune ; places dans l'ordre de la règle (devant, puis derrière).
    const directions = [["la diagonale", 45, (L / 2 + W / 2) * Math.SQRT1_2, true], ["le cap", 0, L / 2, false]]
      .map(([quoi, a, demi, avecCones]) => {
        const nx = Math.cos(premier.cap + a * DEG), ny = Math.sin(premier.cap + a * DEG);
        const d0 = demi + JEU_REPERE_VOITURE + demiLargeurRepere(r.numeros) * Math.abs(nx) + RAYON_REPERE * Math.abs(ny);
        const places = [1, -1].flatMap((sens) => Array.from({ length: pas + 1 }, (_, k) => sens * (d0 + k * PAS_REPERE)))
          .map((d) => ({ x: premier.x + d * nx, y: premier.y + d * ny }));
        return { quoi, nx, ny, avecCones, places };
      });
    const ou = directions.findIndex(({ nx, ny }) => Math.abs((r.x - premier.x) * ny - (r.y - premier.y) * nx) < 1e-9);
    if (ou < 0) {
      fautes.push(`${nom} : ni sur la diagonale ni sur le cap`);
      return;
    }
    const { quoi, avecCones, places } = directions[ou];
    const rang = places.findIndex((p) => Math.hypot(p.x - r.x, p.y - r.y) < 1e-9);
    if (rang < 0) fautes.push(`${nom} : sur ${quoi}, hors des places de la règle`);
    if (prise(r, avecCones)) fautes.push(`${nom} : sur ${quoi}, à une place prise`);
    if (ou === 1 && directions[0].places.some((p) => !prise(p, true))) fautes.push(`${nom} : sur le cap alors que la diagonale avait une place libre`);
    if (rang > 0 && places.slice(0, rang).some((p) => !prise(p, avecCones))) fautes.push(`${nom} : sur ${quoi}, écarté alors qu'une place plus proche était libre`);
  });
  return fautes;
}

// Repère qui porte une étape de tour, et l'état de la voiture de l'élève à sa première étape.
function repereDuTour(sc, reperes) {
  const k = reperes.findIndex((r) => r.numeros.some((n) => sc.etapes[n - 1].regard && sc.etapes[n - 1].regard.tour));
  assert.ok(k >= 0, "un repère porte le tour du regard");
  return { k, r: reperes[k], e: etatActeur(sc.eleve, sc.etapes[reperes[k].numeros[0] - 1].t) };
}

// Scène d'essai : la voiture de l'élève, tournée vers le nord au milieu d'un monde de 8 m de large, regarde devant, fait le tour
// du regard à l'arrêt, puis avance de 5 m. La diagonale sort du monde des deux côtés : le repère des deux premières étapes se
// replie sur le cap. `etapeDevant` : une troisième étape, au bout des 5 m, dont la voiture prend la place devant.
function tourAuMilieu(etapeDevant) {
  const chemin = trajet(4, 40, -90).droit(5).fin();
  return preparerScene({
    code: "essai", monde: { largeur: 8, hauteur: 60 }, camera: { largeur: 8, hauteur: 46 }, decor: { panneaux: [], marquages: [], obstacles: [] },
    acteurs: [{ id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil: [{ s: 0, kmh: 0, pause: 5 }, { s: 5, kmh: 5 }] }],
    etapes: [{ s: 0, regard: { angle: 0 } }, { s: 0, delai: 1, regard: { tour: true } }, ...(etapeDevant ? [{ s: 5, regard: { angle: 0 } }] : [])],
  });
}

test("reperesEtapes : le repère d'une étape où le regard fait le tour se pose sur la diagonale à 45 degrés du cap, hors des quatre cônes du tour figé, ou sur le cap si toute la diagonale est prise, chaque fois à la première place libre", () => {
  let tours = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    const reperes = reperesEtapes(sc);
    assert.deepEqual(fautesReperesTour(sc, reperes), [], code);
    for (const r of reperes.filter((x) => x.numeros.some((n) => sc.etapes[n - 1].regard && sc.etapes[n - 1].regard.tour))) {
      tours++;
      const premier = etatActeur(sc.eleve, sc.etapes[r.numeros[0] - 1].t);
      for (const n of r.numeros) {
        const e = etatActeur(sc.eleve, sc.etapes[n - 1].t);
        assert.ok(Math.hypot(e.x - premier.x, e.y - premier.y) < ECART_REPERES, `${code} : étape ${n} trop loin de son repère`);
      }
    }
  }
  assert.ok(tours > 0, "aucun repère ne porte d'étape de tour : le cas n'est pas exercé");
  // Marche arrière : devant à droite, la diagonale sort de la rue ; le repère des étapes 1 à 3 passe derrière à gauche, sur la
  // diagonale.
  const sc = preparerScene(SCENES["marche-arriere"].construire());
  const { r, e } = repereDuTour(sc, reperesEtapes(sc));
  assert.deepEqual(r.numeros, [1, 2, 3]);
  assert.ok(r.x < e.x && r.y > e.y, "derrière à gauche de la voiture");
  proche(r.x - e.x, -(r.y - e.y), 1e-9, "sur la diagonale");
});

test("reperesEtapes : toute la diagonale prise, le repère du tour se replie sur le cap : devant, contre la voiture, ou derrière si la voiture d'une autre étape prend la place devant", () => {
  const { longueur: L } = GABARITS.voiture;
  for (const [etapeDevant, sens, ou] of [[false, 1, "devant"], [true, -1, "derrière"]]) {
    const sc = tourAuMilieu(etapeDevant), reperes = reperesEtapes(sc);
    assert.deepEqual(fautesReperesTour(sc, reperes), [], ou);
    const { r, e } = repereDuTour(sc, reperes);
    assert.deepEqual(r.numeros, [1, 2], ou);
    // Sur le cap, au plus près : JEU_REPERE_VOITURE entre le pare-chocs et le repère.
    proche(r.x, e.x, 1e-9, `${ou} : sur le cap`);
    proche(sens * (e.y - r.y), L / 2 + JEU_REPERE_VOITURE + RAYON_REPERE, 1e-9, `${ou} : au plus près`);
    // Le critère des cônes tient : devant, le repère ne couvre que le début du cône avant.
    assert.deepEqual(conesTourMasques(sc, reperes), [], ou);
  }
});

test("reperesEtapes : la règle du repère d'un tour mord : sur le cap alors que la diagonale a une place libre, derrière alors que la place devant est libre, ou sur une diagonale qui sort du monde, il est refusé", () => {
  const replacer = (sc, reperes, dx, dy) => {
    const { k, e } = repereDuTour(sc, reperes);
    return reperes.map((x, i) => (i === k ? { ...x, x: e.x + dx, y: e.y + dy } : x));
  };
  const L = GABARITS.voiture.longueur;
  // Marche arrière : le repère 1·2·3 posé devant la voiture, sur le cap, alors que la diagonale derrière à gauche est libre.
  const ma = preparerScene(SCENES["marche-arriere"].construire());
  const d = L / 2 + JEU_REPERE_VOITURE + RAYON_REPERE;
  assert.deepEqual(fautesReperesTour(ma, replacer(ma, reperesEtapes(ma), 0, -d)),
    ["repère 1·2·3 : sur le cap alors que la diagonale avait une place libre"]);
  // Scène d'essai, la place devant libre : le repère posé derrière, puis sur la diagonale devant à droite, qui sort du monde.
  const sc = tourAuMilieu(false);
  assert.deepEqual(fautesReperesTour(sc, replacer(sc, reperesEtapes(sc), 0, d)),
    ["repère 1·2 : sur le cap, écarté alors qu'une place plus proche était libre"]);
  const d0 = (L / 2 + GABARITS.voiture.largeur / 2) * Math.SQRT1_2 + JEU_REPERE_VOITURE + (demiLargeurRepere([1, 2]) + RAYON_REPERE) * Math.SQRT1_2;
  assert.deepEqual(fautesReperesTour(sc, replacer(sc, reperesEtapes(sc), d0 * Math.SQRT1_2, -d0 * Math.SQRT1_2)),
    ["repère 1·2 : sur la diagonale, à une place prise"]);
});

// Abscisses t (m, depuis le point o, le long de la direction unitaire u) où le point o + t u est dans le rectangle de
// centre (cx ; cy), tourné de `angle` radians, de demi-côtés hx (le long de son axe tourné) et hy : [t0, t1], ou null si
// la droite ne le traverse pas (méthode des tranches).
function traversee(o, u, { cx, cy, angle = 0, hx, hy }) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const tranches = [
    [(o.x - cx) * c + (o.y - cy) * s, u.x * c + u.y * s, hx],
    [-(o.x - cx) * s + (o.y - cy) * c, -u.x * s + u.y * c, hy],
  ];
  let t0 = -Infinity, t1 = Infinity;
  for (const [p, v, h] of tranches) {
    if (Math.abs(v) < 1e-12) {
      if (Math.abs(p) > h) return null;
      continue;
    }
    const a = (-h - p) / v, b = (h - p) / v;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  return t0 <= t1 ? [t0, t1] : null;
}

// Critère : sur l'image figée d'un tour du regard (animations réduites), chaque cône garde une partie visible hors des
// repères. Le long de l'axe de chaque cône, on mesure ce que le cadre réduit en montre hors de la voiture de l'élève, dessinée
// par-dessus le regard : de la carrosserie jusqu'au bord du cadre, ou jusqu'au bord lointain du cône. Les repères, dessinés eux
// aussi par-dessus le regard, n'en couvrent jamais plus de la moitié : un repère qui couvrirait la plus grande partie d'un cône
// le ferait paraître oublié, et le tour se lirait en trois cônes. Posé contre la voiture, devant elle (repli de la règle de
// placement), un repère ne couvre que le début du cône avant. Les repères ne se chevauchent pas (test plus haut), leurs
// traversées d'un axe non plus : leurs longueurs s'ajoutent. Rend la liste des fautes, [] quand chaque cône de chaque tour figé
// y satisfait.
function conesTourMasques(sc, reperes) {
  const cadre = cadreReduit(sc), fautes = [];
  const boutAxe = REGARD_PORTEE * Math.cos(REGARD_OUVERTURE * DEG);   // de l'œil au bord lointain du cône, sur son axe
  sc.etapes.forEach((et, k) => {
    if (!(et.regard && et.regard.tour)) return;
    const e = etatActeur(sc.eleve, et.t), o = oeil(e);
    for (const dir of DIRECTIONS_TOUR_FIGE) {
      const u = { x: Math.cos(e.cap + dir * DEG), y: Math.sin(e.cap + dir * DEG) }, nom = `étape ${k + 1}, cône à ${dir} degrés`;
      const dansCadre = traversee(o, u, { cx: cadre.x + cadre.largeur / 2, cy: cadre.y + cadre.hauteur / 2, hx: cadre.largeur / 2, hy: cadre.hauteur / 2 });
      const voiture = traversee(o, u, { cx: e.x, cy: e.y, angle: e.cap, hx: GABARITS.voiture.longueur / 2, hy: GABARITS.voiture.largeur / 2 });
      const debut = Math.max(0, voiture ? voiture[1] : 0, dansCadre ? dansCadre[0] : Infinity);
      const fin = Math.min(boutAxe, dansCadre ? dansCadre[1] : -Infinity);
      if (!(fin > debut)) {
        fautes.push(`${nom} : le cadre réduit n'en montre rien hors de la voiture`);
        continue;
      }
      let couvert = 0;
      for (const r of reperes) {
        const t = traversee(o, u, { cx: r.x, cy: r.y, hx: demiLargeurRepere(r.numeros), hy: RAYON_REPERE });
        if (t) couvert += Math.max(0, Math.min(t[1], fin) - Math.max(t[0], debut));
      }
      if (couvert > (fin - debut) / 2) {
        fautes.push(`${nom} : les repères en couvrent ${couvert.toFixed(2)} m sur ${(fin - debut).toFixed(2)} m d'axe montrés`);
      }
    }
  });
  return fautes;
}

test("reperesEtapes : sur l'image figée d'un tour du regard, les repères ne couvrent jamais plus de la moitié de ce que le cadre réduit montre de l'axe d'un cône", () => {
  let tours = 0;   // au moins une scène du registre exerce ce test
  for (const [code, sc] of scenes()) {
    tours += sc.etapes.filter((et) => et.regard && et.regard.tour).length;
    assert.deepEqual(conesTourMasques(sc, reperesEtapes(sc)), [], code);
  }
  assert.ok(tours > 0, "aucune scène n'a de tour du regard : le test ne vérifie rien");
});

test("reperesEtapes : le critère des cônes mord : le repère du tour posé contre le flanc droit, sur la perpendiculaire au cap, couvre la plus grande partie du cône à droite ; le seuil est la moitié de l'axe montré", () => {
  const sc = preparerScene(SCENES["marche-arriere"].construire());
  const reperes = reperesEtapes(sc), { k, r, e } = repereDuTour(sc, reperes);
  // Règle ordinaire : sur la perpendiculaire au cap, au plus près à droite, à JEU_REPERE_VOITURE du flanc.
  const nx = -Math.sin(e.cap), ny = Math.cos(e.cap);
  const d0 = GABARITS.voiture.largeur / 2 + JEU_REPERE_VOITURE + demiLargeurRepere(r.numeros) * Math.abs(nx) + RAYON_REPERE * Math.abs(ny);
  const sabote = reperes.map((x, i) => (i === k ? { ...x, x: e.x + d0 * nx, y: e.y + d0 * ny } : x));
  assert.deepEqual(conesTourMasques(sc, sabote), ["étape 2, cône à 90 degrés : les repères en couvrent 4.00 m sur 4.30 m d'axe montrés"]);
  // Seuil : dans la scène d'essai, le cadre montre 3,10 m de l'axe du cône à gauche, du flanc au bord du monde. Un repère d'un
  // seul numéro posé sur cet axe, contre le bord, qui en couvre 1,60 m (plus de la moitié), est refusé ; 1,50 m, accepté.
  const essai = tourAuMilieu(false), reperesEssai = reperesEtapes(essai), y = oeil(etatActeur(essai.eleve, essai.etapes[1].t)).y;
  const disque = (couvre) => ({ x: couvre - RAYON_REPERE, y, numeros: [9] });
  assert.deepEqual(conesTourMasques(essai, [...reperesEssai, disque(1.6)]),
    ["étape 2, cône à -90 degrés : les repères en couvrent 1.60 m sur 3.10 m d'axe montrés"]);
  assert.deepEqual(conesTourMasques(essai, [...reperesEssai, disque(1.5)]), []);
});

test("demiLargeurRepere : un disque pour un seul numéro, une pastille qui contient tout le texte quand des étapes partagent un repère", () => {
  for (const numeros of [[1], [8], [12]]) assert.equal(demiLargeurRepere(numeros), RAYON_REPERE, numeros.join("·"));
  // Le texte est en chasse fixe de 1,2 m, soit 0,72 m par caractère (0,6 em) : la pastille le contient, avec du jeu.
  for (const numeros of [[6, 7], [5, 6, 7], [1, 2, 3, 4]]) {
    const texte = numeros.join("·");
    assert.ok(2 * demiLargeurRepere(numeros) >= texte.length * 0.72 + 0.4, `« ${texte} » déborde de sa pastille`);
  }
});

test("cadreReduit : un cadre fixe qui montre tous les repères, les panneaux, la voiture de l'élève à chaque étape et chaque usager suivi des yeux à l'instant de son étape", () => {
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

test("scènes, images figées : le regard de chaque étape est dessiné, un cône pour un angle ou un usager suivi, le secteur parcouru pour un balayage, quatre cônes pour un tour du regard", () => {
  for (const [code, sc] of scenes()) {
    sc.etapes.forEach((et, i) => {
      const e = etatActeur(sc.eleve, et.t);
      const r = regardDessine(et, e, et.t, etatsA(sc, et.t), true);
      if (!et.regard) { assert.equal(r, null); return; }
      assert.ok(r, `${code}, étape ${i + 1} : pas de regard sur l'image figée`);
      assert.equal(r.forme, et.regard.balayage ? "secteur" : et.regard.tour ? "cones" : "cone", `${code}, étape ${i + 1}`);
      if (r.forme === "cones") assert.equal(r.polys.length, 4, `${code}, étape ${i + 1} : quatre cônes`);
    });
  }
});

test("scènes : le cône d'un usager suivi s'arrête 2 m au-delà de lui ; ramené devant, il reprend toute la portée", () => {
  let ramene = 0;
  for (const [code, sc] of scenes()) {
    sc.etapes.forEach((et) => {
      if (!(et.regard && et.regard.suivre)) return;
      for (let t = et.t; t < et.fin; t += 0.05) {
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
