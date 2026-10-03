import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../js/scenes.js";
import { preparerScene, etatActeur, emprise, tempsAtteint, trajet, pointDansPolygone } from "../js/scene-geometrie.js";
import { REGARD_PORTEE, DEBORD_SUIVI, oeil, cibleSuivie, regardDessine } from "../js/scene-regard.js";
import { FREQ_CLIGNOTANT, TAILLE_PANNEAU, RAYON_REPERE, ECART_REPERES, MARGE_CADRE_REDUIT, clignotantAllume, cadreCamera,
  reperesEtapes, demiLargeurRepere, cadreReduit, emprisePanneau, facteurLecture } from "../js/scene-rendu.js";

// Règles pures du rendu des scènes (correction de la tâche 11) : ce que montre l'image, en lecture comme sur les images
// figées (pas à pas, pause, animations réduites). Le moteur (js/scene-moteur.js) dessine avec ces fonctions.

const proche = (a, b, eps = 1e-9, quoi = "") => assert.ok(Math.abs(a - b) <= eps, `${quoi}${quoi ? " : " : ""}${a} au lieu de ${b}`);
const scenes = () => Object.entries(SCENES).map(([code, entree]) => [code, preparerScene(entree.construire())]);
const etatsA = (sc, t) => new Map(sc.acteurs.map((a) => [a.id, etatActeur(a, t)]));
// Le point [x, y] est-il dans le cadre c ({ x, y, largeur, hauteur }), bords compris ?
const dans = (c, [x, y]) => x >= c.x - 1e-9 && x <= c.x + c.largeur + 1e-9 && y >= c.y - 1e-9 && y <= c.y + c.hauteur + 1e-9;
// Le même point ramené dans le monde : une emprise qui déborde du monde n'y est montrée que pour sa partie intérieure.
const dansLeMonde = (sc, [x, y]) => [Math.min(Math.max(x, 0), sc.monde.largeur), Math.min(Math.max(y, 0), sc.monde.hauteur)];

// ===== Clignotant =====

test("clignotantAllume : en lecture, 1,5 Hz, allumé la première moitié de chaque période depuis le début de la scène", () => {
  assert.equal(FREQ_CLIGNOTANT, 1.5);
  const droite = { clignotant: "droite" }, gauche = { clignotant: "gauche" };
  for (const t of [0, 0.1, 0.32, 0.67, 0.704, 0.99, 1.34]) assert.equal(clignotantAllume(droite, t, false), "droite", `t = ${t} s`);
  for (const t of [0.34, 0.5, 0.66, 1.0, 1.2]) assert.equal(clignotantAllume(gauche, t, false), null, `t = ${t} s`);
  assert.equal(clignotantAllume(gauche, 0.704, false), "gauche");
});

test("clignotantAllume : sur une image figée, le clignotant en marche est toujours dessiné allumé, de son côté", () => {
  for (const t of [0, 0.34, 0.5, 0.66, 1.0, 1.2, 9.086, 20.511]) {
    assert.equal(clignotantAllume({ clignotant: "droite" }, t, true), "droite", `t = ${t} s`);
    assert.equal(clignotantAllume({ clignotant: "gauche" }, t, true), "gauche", `t = ${t} s`);
  }
  for (const fige of [true, false]) assert.equal(clignotantAllume({ clignotant: null }, 0.1, fige), null, "éteint : jamais dessiné");
});

test("scènes, images figées : à chaque étape, le clignotant en marche est dessiné allumé, du bon côté", () => {
  for (const [code, sc] of scenes()) {
    let enMarche = 0;
    sc.etapes.forEach((et, i) => {
      const e = etatActeur(sc.eleve, et.t);
      assert.equal(clignotantAllume(e, et.t, true), e.clignotant, `${code}, étape ${i + 1}`);
      if (e.clignotant) enMarche++;
    });
    assert.ok(enMarche > 0, `${code} : aucune étape n'a de clignotant en marche, le test ne vérifie rien`);
  }
});

test("scènes, en lecture : le premier éclat du clignotant tombe dans l'étape 1, dès que le clignotant s'allume", () => {
  for (const [code, sc] of scenes()) {
    const [clignotant] = sc.eleve.clignotant;
    const tAllume = tempsAtteint(sc.eleve.chrono, clignotant.de);
    let premier = null;
    for (let k = 0; k * 0.001 <= sc.etapes[1].t; k++) {
      const t = k * 0.001;
      if (clignotantAllume(etatActeur(sc.eleve, t), t, false)) { premier = t; break; }
    }
    assert.ok(premier !== null && premier >= sc.etapes[0].t && premier < sc.etapes[1].t, `${code} : premier éclat à t = ${premier} s, hors de l'étape 1`);
    assert.ok(premier - tAllume <= 0.002, `${code} : clignotant allumé à t = ${tAllume.toFixed(3)} s, premier éclat à t = ${premier} s`);
  }
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

test("reperesEtapes : la position de l'élève au début de chaque étape ; deux étapes à moins de ECART_REPERES m partagent un repère", () => {
  assert.equal(RAYON_REPERE, 1.2);
  assert.equal(ECART_REPERES, 1.5);
  for (const [code, sc] of scenes()) {
    const reperes = reperesEtapes(sc);
    assert.deepEqual(reperes.flatMap((r) => r.numeros).sort((a, b) => a - b), sc.etapes.map((_, i) => i + 1),
      `${code} : chaque étape a un numéro, une seule fois`);
    for (const r of reperes) {
      const premier = etatActeur(sc.eleve, sc.etapes[r.numeros[0] - 1].t);
      proche(r.x, premier.x); proche(r.y, premier.y);
      for (const n of r.numeros) {
        const e = etatActeur(sc.eleve, sc.etapes[n - 1].t);
        assert.ok(Math.hypot(e.x - r.x, e.y - r.y) < ECART_REPERES, `${code} : étape ${n} trop loin de son repère`);
      }
    }
  }
  // Tourner à gauche : l'angle mort et le virage commencent au même point d'arrêt, sous un seul repère.
  const sc = preparerScene(SCENES["tourner-gauche"].construire());
  assert.ok(reperesEtapes(sc).some((r) => r.numeros.includes(6) && r.numeros.includes(7)));
});

test("demiLargeurRepere : un disque pour un seul numéro, une pastille qui contient tout le texte quand des étapes partagent un repère", () => {
  for (const numeros of [[1], [8], [12]]) assert.equal(demiLargeurRepere(numeros), RAYON_REPERE, numeros.join("·"));
  // Le texte est en chasse fixe de 1,2 m, soit 0,72 m par caractère (0,6 em) : la pastille le contient, avec du jeu.
  for (const numeros of [[6, 7], [5, 6, 7], [1, 2, 3, 4]]) {
    const texte = numeros.join("·");
    assert.ok(2 * demiLargeurRepere(numeros) >= texte.length * 0.72 + 0.4, `« ${texte} » déborde de sa pastille`);
  }
});

test("cadreReduit : un cadre fixe qui montre tous les repères, la voiture de l'élève à chaque étape et chaque usager suivi des yeux à l'instant de son étape", () => {
  assert.equal(MARGE_CADRE_REDUIT, 1);
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
    assert.ok(reperesEtapes(sc).some((r) => !dans(depart, [r.x, r.y])), `${code} : le cadre de départ montrait déjà tout`);
  }
});

test("cadreReduit : au moins la hauteur de la caméra, centré sur ce qu'il montre puis borné au monde ; sans caméra, le monde entier", () => {
  const camera = { largeur: 30, hauteur: 40 };
  const definition = (y, camera) => ({
    code: "essai", monde: { largeur: 30, hauteur: 100 }, camera,
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

test("scènes, images figées : le regard de chaque étape est dessiné, un cône pour un angle ou un usager suivi, le secteur balayé pour un balayage", () => {
  for (const [code, sc] of scenes()) {
    sc.etapes.forEach((et, i) => {
      const e = etatActeur(sc.eleve, et.t);
      const r = regardDessine(et, e, et.t, etatsA(sc, et.t), true);
      if (!et.regard) { assert.equal(r, null); return; }
      assert.ok(r, `${code}, étape ${i + 1} : pas de regard sur l'image figée`);
      assert.equal(r.forme, et.regard.balayage ? "secteur" : "cone", `${code}, étape ${i + 1}`);
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
  for (const [code, sc] of scenes()) {
    const trottoirs = sc.decor.obstacles.filter((o) => o.nature === "trottoir");
    assert.ok(sc.decor.panneaux.length > 0, `${code} : aucun panneau, le test ne vérifie rien`);
    for (const p of sc.decor.panneaux) {
      const r = emprisePanneau(p);
      assert.equal(r.largeur, TAILLE_PANNEAU); assert.equal(r.hauteur, TAILLE_PANNEAU);
      proche(r.x + r.largeur / 2, p.x); proche(r.y + r.hauteur / 2, p.y);
      const coins = [[r.x, r.y], [r.x + r.largeur, r.y], [r.x + r.largeur, r.y + r.hauteur], [r.x, r.y + r.hauteur]];
      assert.ok(trottoirs.some((o) => coins.every((q) => pointDansPolygone(q, o.poly))),
        `${code} : le dessin du panneau ${p.code} en (${p.x} ; ${p.y}) déborde du trottoir`);
    }
  }
});

test("facteurLecture : « × n » avec une virgule décimale et un libellé lisible ; rien à vitesse réelle", () => {
  assert.equal(facteurLecture(1), null);
  assert.deepEqual(facteurLecture(0.5), { texte: "× 0,5", libelle: "Lecture ralentie : 0,5 fois la vitesse réelle" });
  assert.deepEqual(facteurLecture(0.25), { texte: "× 0,25", libelle: "Lecture ralentie : 0,25 fois la vitesse réelle" });
  assert.deepEqual(facteurLecture(2), { texte: "× 2", libelle: "Lecture accélérée : 2 fois la vitesse réelle" });
});
