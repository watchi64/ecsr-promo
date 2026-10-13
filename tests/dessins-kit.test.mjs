import { test } from "node:test";
import assert from "node:assert/strict";
import { CHARTE, cadre, etiquette, vignette, pastille, fleche, texte } from "../js/dessins-kit.js";
import { n, trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { verifierDessin, boitesTextes, largeurTexte, formeArbre } from "./aides-dessins.mjs";

test("la charte reprend les teintes de l'app", () => {
  assert.equal(CHARTE.fond, "#F1F4F0");
  assert.equal(CHARTE.texte, "#1F2924");
  assert.equal(CHARTE.accent, "#6B7F4E");
  assert.equal(CHARTE.juste, "#4D7C0F");
  assert.equal(CHARTE.faux, "#A05A3D");
});

test("une planche faite des pièces de la charte passe les contrôles communs", () => {
  const d = cadre({ largeur: 320, hauteur: 200, titre: "Essai", description: "Deux vignettes." },
    vignette({ x: 8, y: 8, largeur: 148, hauteur: 184, etat: "juste" }, texte(82, 120, "Juste ici", { ancrage: "middle" })),
    vignette({ x: 164, y: 8, largeur: 148, hauteur: 184, etat: "faux" }),
    etiquette({ cible: [60, 150], ancre: [20, 175], lignes: ["Jante"] }),
    fleche([[200, 100], [240, 80], [270, 100]]));
  assert.deepEqual(verifierDessin(d, [320, 200]), []);
});

test("une pastille dit son état en toutes lettres", () => {
  assert.equal(texteDe(pastille({ x: 0, y: 0, etat: "juste" })), "Juste");
  assert.equal(texteDe(pastille({ x: 0, y: 0, etat: "faux" })), "Faux");
  assert.ok(trouverRole(vignette({ x: 0, y: 0, largeur: 100, hauteur: 80, etat: "faux" }), "pastille-faux"));
});

test("les contrôles communs repèrent un texte trop petit, un texte hors cadre, deux textes superposés", () => {
  const d = cadre({ largeur: 320, hauteur: 100, titre: "Essai" },
    texte(10, 50, "petit", { taille: 8 }), texte(300, 50, "dehors du cadre"), texte(10, 80, "un"), texte(12, 81, "deux"));
  const pb = verifierDessin(d, [320, 100]).join(" | ");
  assert.match(pb, /« petit » : 8\.6 px/);
  assert.match(pb, /« dehors du cadre » hors du cadre/);
  assert.match(pb, /« un » et « deux » qui se chevauchent/);
});

// Suite : le reste des contrôles communs, et les pièces telles que le kit les affine.
const nombres = (d) => String(d).match(/-?\d+(?:\.\d+)?/g).map(Number);
const proche = (a, b, eps, quoi) => assert.ok(Math.abs(a - b) <= eps, `${quoi} : ${a} au lieu de ${b}`);

test("les contrôles communs repèrent aussi un trait trop fin, même hérité ou réduit, un tiret cadratin, une échelle sur du texte, une valeur absente, un cadre faux", () => {
  const tiret = String.fromCharCode(0x2014);
  const d = n("svg", { viewBox: "0 0 300 100", role: "img" },
    n("line", { x1: 0, y1: 5, x2: 10, y2: 5, stroke: "#000", "stroke-width": 0.5 }),
    n("g", { stroke: "#000", "stroke-width": 0.6 }, n("path", { d: "M0 0 L5 5" })),
    n("g", { transform: "translate(10 10) scale(0.5)" },
      n("circle", { cx: 5, cy: 5, r: 2, stroke: "#000", "stroke-width": 1.5 }), texte(10, 40, "réduit")),
    texte(10, 70, `a ${tiret} b`),
    n("rect", { x: 0, y: 0, width: undefined, height: 4 }));
  const pb = verifierDessin(d, [320, 100]).join(" | ");
  assert.match(pb, /viewBox « 0 0 300 100 » au lieu de « 0 0 320 100 »/);
  assert.match(pb, /role img et aria-label requis/);
  assert.match(pb, /line : trait de 0\.5 unité/);
  assert.match(pb, /path : trait de 0\.6 unité/);
  assert.match(pb, /circle : trait de 0\.75 unité/);
  assert.match(pb, /texte « réduit » sous un transform qui change l'échelle/);
  assert.match(pb, /tiret cadratin dans « a /);
  assert.match(pb, /rect width="undefined"/);
  // Un trait d'une unité passe, qu'il soit posé ou hérité.
  const juste = cadre({ largeur: 320, hauteur: 100, titre: "Essai" },
    n("line", { x1: 0, y1: 5, x2: 10, y2: 5, stroke: "#000", "stroke-width": 1 }),
    n("g", { stroke: "#000" }, n("path", { d: "M0 0 L5 5" })));
  assert.deepEqual(verifierDessin(juste, [320, 100]), []);
});

test("boîtes de texte : la largeur majore celle d'Outfit mesurée dans Chrome, sans l'exagérer", () => {
  // Largeurs réelles en fraction de la taille du texte, graisse 600 (mesure du 14/10/2026, css/fonts.css).
  const mesures = { "Juste": 2.4, "Faux": 2.2, "MAX": 2.23, "MIN": 1.86, "Commodo gauche": 8.19, "Désembuage": 5.96,
    "ÉTAT DU MOTEUR": 8.38, "Frein de stationnement": 10.48, "La disposition varie selon les modèles": 16.7,
    "S'arrêter dès que possible en sécurité, couper le moteur": 24.7 };
  for (const [s, reel] of Object.entries(mesures)) {
    const estime = largeurTexte(s, 1);
    assert.ok(estime >= reel && estime <= 1.25 * reel, `« ${s} » : ${estime.toFixed(2)} pour ${reel}`);
  }
  // Une capitale accentuée monte plus haut que les minuscules : sa boîte aussi.
  const [plat, accent] = boitesTextes(n("g", {}, texte(0, 50, "Avant"), texte(100, 50, "À froid")));
  assert.ok(accent.y1 < plat.y1);
});

test("étiquette : le point sur la cible, le texte à côté du bout du filet, du côté de son ancrage, lignes centrées", () => {
  const cas = [
    { ancrage: "start", cible: [40, 60], ancre: [90, 40] },
    { ancrage: "end", cible: [200, 60], ancre: [150, 40] },
    { ancrage: "middle", cible: [160, 30], ancre: [160, 60] },
    { ancrage: "middle", cible: [160, 90], ancre: [160, 60] },
  ];
  for (const { ancrage, cible, ancre } of cas) {
    for (const lignes of [["Jante"], ["Frein de", "stationnement"]]) {
      const e = etiquette({ cible, ancre, lignes, ancrage });
      assert.deepEqual([e.attributs["data-x"], e.attributs["data-y"]], cible);
      const point = trouverTous(e, (x) => x.balise === "circle").at(-1);
      assert.deepEqual([point.attributs.cx, point.attributs.cy], cible);
      const boites = boitesTextes(e);
      assert.equal(boites.length, lignes.length);
      const [ax, ay] = ancre, quoi = `${ancrage} ${lignes.length} ligne(s)`;
      for (const b of boites) {
        if (ancrage === "start") assert.ok(b.x1 >= ax + 3, quoi);
        if (ancrage === "end") assert.ok(b.x2 <= ax - 3, quoi);
        if (ancrage === "middle" && cible[1] < ay) assert.ok(b.y1 >= ay + 3, quoi);
        if (ancrage === "middle" && cible[1] > ay) assert.ok(b.y2 <= ay - 3, quoi);
      }
      // Bloc de lignes centré sur le bout du filet quand le texte est à côté de lui ; lignes qui ne se touchent pas.
      if (ancrage !== "middle") proche((boites[0].y1 + boites.at(-1).y2) / 2, ay, 1.5, quoi);
      for (let i = 1; i < boites.length; i++) assert.ok(boites[i].y1 >= boites[i - 1].y2, quoi);
    }
  }
});

test("flèche : la tête finit sur le dernier point, le trait passe par les autres et s'arrête sous la tête", () => {
  const points = [[200, 100], [240, 80], [270, 100]];
  const f = fleche(points);
  const trait = trouverRole(f, "fleche-trait"), tete = trouverRole(f, "fleche-tete");
  const t = nombres(trait.attributs.d), h = nombres(tete.attributs.d);
  assert.deepEqual(t.slice(0, 2), points[0]);
  assert.ok(String(trait.attributs.d).includes("240 80"), "le trait lissé passe par le point du milieu");
  proche(h[0], 270, 1e-9, "pointe x");
  proche(h[1], 100, 1e-9, "pointe y");
  // Bout du trait : sous la tête, son arrondi compris (point intérieur, à au moins une demi-épaisseur des bords).
  const bout = t.slice(-2), demi = Number(trait.attributs["stroke-width"]) / 2;
  const sommets = [];
  for (let i = 0; i < h.length; i += 2) sommets.push([h[i], h[i + 1]]);
  let dedans = false;
  for (let i = 0, j = sommets.length - 1; i < sommets.length; j = i++) {
    const [xi, yi] = sommets[i], [xj, yj] = sommets[j];
    if ((yi > bout[1]) !== (yj > bout[1]) && bout[0] < ((xj - xi) * (bout[1] - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  assert.ok(dedans, `bout du trait ${bout} hors de la tête`);
  for (let i = 0; i < sommets.length; i++) {
    const [a, b] = [sommets[i], sommets[(i + 1) % sommets.length]];
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const u = Math.max(0, Math.min(1, ((bout[0] - a[0]) * (b[0] - a[0]) + (bout[1] - a[1]) * (b[1] - a[1])) / l2));
    const dist = Math.hypot(bout[0] - a[0] - u * (b[0] - a[0]), bout[1] - a[1] - u * (b[1] - a[1]));
    assert.ok(dist >= demi - 1e-6, `arrondi du trait à ${dist.toFixed(2)} du bord de la tête`);
  }
});

test("flèche : un arc donné par peu de points reste sur son cercle, et la tête suit la courbe à la pointe", () => {
  // Quart de cercle de 3 heures à midi (rayon 40, centre 100 ; 60), en 3 puis 5 points : la main qui monte sur la jante.
  const [cx, cy, r] = [100, 60, 40];
  const surArc = (nb) => Array.from({ length: nb }, (_, i) => {
    const a = ((Math.PI / 2) * i) / (nb - 1);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  });
  for (const nb of [3, 5]) {
    const f = fleche(surArc(nb));
    const t = nombres(trouverRole(f, "fleche-trait").attributs.d), h = nombres(trouverRole(f, "fleche-tete").attributs.d);
    // Segments de Bézier du trait (M x y, puis C x1 y1 x2 y2 x y) : chaque point évalué est à 1 % du rayon au plus.
    for (let i = 2; i + 6 <= t.length; i += 6) {
      const s = [[t[i - 2], t[i - 1]], [t[i], t[i + 1]], [t[i + 2], t[i + 3]], [t[i + 4], t[i + 5]]];
      for (const u of [0.25, 0.5, 0.75]) {
        const c = [0, 1].map((k) => (1 - u) ** 3 * s[0][k] + 3 * (1 - u) ** 2 * u * s[1][k] + 3 * (1 - u) * u ** 2 * s[2][k] + u ** 3 * s[3][k]);
        proche(Math.hypot(c[0] - cx, c[1] - cy), r, 0.01 * r, `${nb} points, écart au cercle`);
      }
    }
    // Axe de la tête (de l'encoche à la pointe) : la tangente du cercle à midi, vers la gauche, à 3 degrés près.
    const axe = Math.atan2(h[1] - h[5], h[0] - h[4]) * 180 / Math.PI;
    proche(Math.abs(axe), 180, 3, `${nb} points, axe de la tête`);
  }
});

test("flèche : mêmes nœuds visible ou masquée, seul l'attribut display change ; une flèche visible a deux points distincts", () => {
  const p = [[40, 150], [280, 150]];
  const visible = fleche(p, { visible: true }), masquee = fleche(p, { visible: false });
  assert.equal(formeArbre(visible), formeArbre(masquee));
  assert.equal(visible.attributs["data-r"], "fleche");
  assert.equal(visible.attributs.display, "inline");
  assert.equal(masquee.attributs.display, "none");
  assert.throws(() => fleche([[10, 10], [10, 10]]), /deux points distincts/);
  assert.equal(formeArbre(fleche([[10, 10]], { visible: false })), formeArbre(masquee));
  // Un point non fini est une erreur dite comme telle, même sur une flèche masquée : jamais un point écarté en silence.
  for (const visible of [true, false]) assert.throws(() => fleche([[0, 0], [NaN, 5], [10, 10]], { visible }), /non fini/);
});

test("pastille et vignette : le mot et l'icône dans la pastille, la pastille en haut à gauche de la vignette, par-dessus son contenu", () => {
  for (const etat of ["juste", "faux"]) {
    const p = pastille({ x: 10, y: 20, etat });
    const fond = p.enfants[0];
    const [b] = boitesTextes(p);
    assert.ok(b.x1 >= fond.attributs.x + 12 && b.x2 <= fond.attributs.x + fond.attributs.width - 3, etat);
    assert.ok(b.y1 >= fond.attributs.y && b.y2 <= fond.attributs.y + fond.attributs.height, etat);
    const v = vignette({ x: 8, y: 8, largeur: 148, hauteur: 120, etat }, n("circle", { "data-r": "contenu", cx: 80, cy: 60, r: 20 }));
    assert.equal(v.enfants.at(-1).attributs["data-r"], `pastille-${etat}`);
    const rangContenu = v.enfants.findIndex((x) => x.attributs["data-r"] === "contenu");
    assert.ok(rangContenu > 0 && rangContenu < v.enfants.length - 1, `${etat} : contenu entre la carte et la pastille`);
    const carte = v.enfants[0].attributs, pf = trouverRole(v, `pastille-${etat}`).enfants[0].attributs;
    assert.ok(pf.x >= carte.x + 4 && pf.y >= carte.y + 4 && pf.x + pf.width <= carte.x + carte.width / 2, etat);
  }
});

test("le cadre décrit le dessin pour les lecteurs d'écran", () => {
  const d = cadre({ largeur: 320, hauteur: 120, titre: "Mains sur le volant", description: "Juste : 9 h et 3 h." });
  assert.equal(d.attributs["aria-label"], "Mains sur le volant. Juste : 9 h et 3 h.");
  assert.equal(cadre({ largeur: 320, hauteur: 120, titre: "Essai" }).attributs["aria-label"], "Essai");
  assert.equal(trouverRole(d, "fond").attributs.width, 320);
});
