import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { CHARTE, cadre, etiquette, vignette, pastille, fleche, texte } from "../js/dessins-kit.js";
import { VOITURE, TEINTES_ROUTE, voitureDessus, reperesDessus, voitureProfil, reperesProfil } from "../js/dessins-kit.js";
import { arrondir, arc, couper, bande } from "../js/dessins-kit.js";
import { n, trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { verifierDessin, boitesTextes, largeurTexte, formeArbre, HAUTEURS_MESUREES } from "./aides-dessins.mjs";
import * as kit from "../js/dessins-kit.js";
import { GABARITS, DEG } from "../js/scene-geometrie.js";
import { TEINTES } from "../js/scene-rendu.js";
import { oeil, REGARD_PORTEE, REGARD_OUVERTURE } from "../js/scene-regard.js";
import { OPACITE_CONE } from "../js/scene-moteur.js";

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
    etiquette({ cible: [60, 150], ancre: [100, 175], lignes: ["Jante"] }),
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
  // Masquée, elle garde sa forme d'une image à l'autre : elle exige aussi deux points distincts, et le dit.
  for (const points of [[], [[10, 10]], [[10, 10], [10, 10]]]) {
    assert.throws(() => fleche(points, { visible: false }), /deux points distincts, même masquée/);
  }
  // Épaisseur hors du jeu de quatre de la charte : erreur.
  assert.throws(() => fleche(p, { epaisseur: 2 }), /épaisseur 2 hors du jeu de la charte/);
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

// Relecture de la tâche 3a, première série : les contrôles communs échouent fermés sur un texte qu'ils ne savent pas
// placer, ignorent ce qui est masqué, voient le filet qui passe sur un texte ; les pièces refusent les valeurs inconnues.
const texteBrut = (attributs, contenu, omis = []) => {
  const a = { x: 10, y: 50, "font-size": 12, "font-family": CHARTE.police, "font-weight": 400, "text-anchor": "start", ...attributs };
  for (const k of omis) delete a[k];
  return n("text", a, contenu);
};
const problemes = (...enfants) => verifierDessin(cadre({ largeur: 320, hauteur: 100, titre: "Essai" }, ...enfants), [320, 100]).join(" | ");

test("contrôles communs, sonde 1 : un texte tourné qui sort du cadre est signalé", () => {
  assert.match(problemes(n("g", { transform: "rotate(90 300 50)" }, texte(300, 50, "Texte tourné qui sort du cadre"))),
    /« Texte tourné qui sort du cadre » sous rotate, matrix ou skew/);
});

test("contrôles communs, sonde 2 : un texte réduit par une matrice est signalé", () => {
  assert.match(problemes(n("g", { transform: "matrix(0.5 0 0 0.5 0 0)" }, texte(20, 50, "Réduit"))), /« Réduit » sous rotate, matrix ou skew/);
});

test("contrôles communs, sonde 3 : un texte sans x est signalé", () => {
  assert.match(problemes(texteBrut({}, "Sans x", ["x"])), /« Sans x » : x non numérique/);
  assert.match(problemes(texteBrut({ y: "haut" }, "Y en mots")), /« Y en mots » : y non numérique/);
});

test("contrôles communs, sonde 4 : un ancrage posé par le groupe et non par le texte est signalé", () => {
  assert.match(problemes(n("g", { "text-anchor": "end" }, texteBrut({ x: 310 }, "Ancré par le groupe", ["text-anchor"]))),
    /« Ancré par le groupe » sans text-anchor à lui/);
});

test("contrôles communs, sonde 5 : une ligne de base suspendue est signalée", () => {
  assert.match(problemes(texteBrut({ y: 95, "dominant-baseline": "hanging" }, "Suspendu")),
    /« Suspendu » : attribut « dominant-baseline » que les contrôles ne savent pas lire/);
});

test("contrôles communs : tout ce qui déplace un texte hors de sa boîte estimée est signalé", () => {
  for (const k of ["dx", "dy", "letter-spacing", "style"]) {
    assert.match(problemes(texteBrut({ [k]: "2" }, `Avec ${k}`)), new RegExp(`« Avec ${k} » : attribut « ${k} »`));
  }
  assert.match(problemes(n("text", { x: 10, y: 50, "font-size": 12, "font-family": CHARTE.police, "font-weight": 400,
    "text-anchor": "start" }, n("tspan", { dy: 20 }, "Morceau"))), /« Morceau » : élément « tspan » à l'intérieur/);
  assert.match(problemes(texteBrut({ "font-weight": 800 }, "Trop gras")), /« Trop gras » : graisse « 800 » au-delà de 700/);
  assert.match(problemes(texteBrut({ "font-family": "Arial" }, "Autre police")), /« Autre police » : police « Arial » au lieu de celle de la charte/);
  assert.match(problemes(n("g", { "letter-spacing": 3 }, texteBrut({}, "Espacé par le groupe"))),
    /« Espacé par le groupe » sous un groupe qui porte « letter-spacing »/);
  assert.match(problemes(n("defs", {}, texteBrut({}, "Défini"))), /« Défini » dans un élément « defs »/);
  assert.match(problemes(n("foreignObject", { x: 0, y: 0, width: 10, height: 10 })), /foreignObject : contenu que les contrôles ne savent pas lire/);
  // Les textes du kit portent tout ce qu'il faut : rien à signaler.
  assert.equal(problemes(texte(10, 50, "Jante"), texte(160, 50, "Moyeu", { ancrage: "middle", graisse: 600 })), "");
});

test("contrôles communs : un sous-arbre masqué n'a pas de boîte, mais garde ses contrôles de taille, de trait et de valeur", () => {
  const pb = problemes(texte(10, 50, "Visible"),
    n("g", { display: "none" }, texte(10, 50, "Masqué au même endroit"), texte(300, 80, "Masqué hors du cadre"),
      texte(10, 80, "Minuscule", { taille: 8 }), n("line", { x1: 0, y1: 0, x2: 5, y2: 5, stroke: "#000", "stroke-width": 0.5 })));
  assert.doesNotMatch(pb, /se chevauchent/);
  assert.doesNotMatch(pb, /hors du cadre/);
  assert.match(pb, /« Minuscule » : 8\.6 px/);
  assert.match(pb, /line : trait de 0\.5 unité/);
});

test("contrôles communs : le filet d'une étiquette ne passe sur aucun texte, le sien compris", () => {
  // Cible à droite d'une étiquette ancrée à gauche (la planche d'origine du brief) : le filet coupe son propre texte.
  const propre = cadre({ largeur: 320, hauteur: 200, titre: "Essai" }, etiquette({ cible: [60, 150], ancre: [20, 175], lignes: ["Jante"] }));
  assert.match(verifierDessin(propre, [320, 200]).join(" | "), /filet d'étiquette qui passe sur le texte « Jante »/);
  // Filet bien posé pour son texte, mais qui traverse un texte voisin.
  const voisin = cadre({ largeur: 320, hauteur: 200, titre: "Essai" }, texte(100, 100, "Moyeu"),
    etiquette({ cible: [40, 60], ancre: [160, 140], lignes: ["Jante"] }));
  assert.deepEqual(verifierDessin(voisin, [320, 200]), ["filet d'étiquette qui passe sur le texte « Moyeu »"]);
  // Un filet masqué ne compte pas.
  const masque = cadre({ largeur: 320, hauteur: 200, titre: "Essai" }, texte(100, 100, "Moyeu"),
    n("g", { display: "none" }, etiquette({ cible: [40, 60], ancre: [160, 140], lignes: ["Jante"] })));
  assert.deepEqual(verifierDessin(masque, [320, 200]), []);
});

test("pièces : un état ou un ancrage inconnu est une erreur, jamais une pastille « Faux » par défaut", () => {
  assert.throws(() => pastille({ x: 0, y: 0, etat: "Juste" }), /état « Juste » inconnu/);
  assert.throws(() => vignette({ x: 0, y: 0, largeur: 100, hauteur: 80, etat: "vrai" }), /état « vrai » inconnu/);
  assert.throws(() => etiquette({ cible: [0, 0], ancre: [10, 10], lignes: ["a"], ancrage: "left" }), /ancrage « left » inconnu/);
  assert.throws(() => texte(0, 0, "a", { ancrage: "centre" }), /ancrage « centre » inconnu/);
});

test("pièces : traits pris dans le jeu de quatre de la charte ; liserés clairs nommés à part", () => {
  const jeu = Object.values(CHARTE.traits);
  assert.deepEqual(jeu, [1, 1.5, 2.5, 4]);
  assert.ok(Number.isFinite(CHARTE.liseres) && CHARTE.liseres > 0);
  const liseres = new Set([2 * CHARTE.liseres, ...jeu.map((t) => t + 2 * CHARTE.liseres)]);
  const d = cadre({ largeur: 320, hauteur: 200, titre: "Essai" },
    vignette({ x: 8, y: 8, largeur: 148, hauteur: 184, etat: "juste" }), vignette({ x: 164, y: 8, largeur: 148, hauteur: 184, etat: "faux" }),
    etiquette({ cible: [60, 150], ancre: [100, 175], lignes: ["Jante"] }),
    ...jeu.map((e, i) => fleche([[180, 40 + 30 * i], [290, 40 + 30 * i]], { epaisseur: e })));
  let vus = 0;
  for (const x of trouverTous(d, (x) => "stroke-width" in x.attributs)) {
    const l = x.attributs["stroke-width"], lisere = x.attributs.stroke === CHARTE.carte;
    assert.ok(lisere ? liseres.has(l) : jeu.includes(l), `${x.balise} : épaisseur ${l}${lisere ? " (liseré)" : ""}`);
    vus++;
  }
  assert.ok(vus > 10);
});

test("contrôles communs : une valeur nulle est signalée", () => {
  assert.match(problemes(n("rect", { x: 0, y: 0, width: null, height: 4 })), /rect width="null"/);
});

test("charte : une seule teinte de peau, deux tons, lisibles sur les fonds de l'app", () => {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => { const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  for (const teinte of [CHARTE.peau, CHARTE.peauOmbre]) assert.match(String(teinte), /^#[0-9A-F]{6}$/);
  // Une main se lit sans contour sur le fond et sur la carte : contraste d'un élément graphique, 3:1 au moins.
  assert.ok(contraste(CHARTE.peau, CHARTE.fond) >= 3, `peau sur fond : ${contraste(CHARTE.peau, CHARTE.fond).toFixed(2)}`);
  assert.ok(contraste(CHARTE.peau, CHARTE.carte) >= 3, `peau sur carte : ${contraste(CHARTE.peau, CHARTE.carte).toFixed(2)}`);
  assert.ok(luminance(CHARTE.peauOmbre) < luminance(CHARTE.peau));
});

// Tâche 5 : les deux voitures du kit, vue du dessus et profil, aux dimensions et aux teintes de celle des scènes.
test("la voiture des dessins a les dimensions et les teintes de celle des scènes", () => {
  assert.equal(VOITURE.longueur, GABARITS.voiture.longueur);
  assert.equal(VOITURE.largeur, GABARITS.voiture.largeur);
  assert.equal(VOITURE.essieu, GABARITS.voiture.essieu);
  for (const k of Object.keys(TEINTES_ROUTE)) assert.equal(TEINTES_ROUTE[k], TEINTES[k], k);
});

test("voiture vue du dessus : caisse à l'échelle, roues avant braquées, rétroviseurs de part et d'autre", () => {
  const v = voitureDessus({ x: 160, y: 100, cap: 0, echelle: 20, retroviseurs: true, roues: true, braquage: 25 });
  const caisse = trouverRole(v, "caisse");
  assert.equal(caisse.attributs.width, 4.5 * 20);
  assert.equal(caisse.attributs.height, 1.8 * 20);
  assert.equal(trouverRole(v, "roue-avant-gauche").attributs["data-angle"], 25);
  assert.equal(trouverRole(v, "roue-arriere-gauche").attributs["data-angle"], 0);
  const r = reperesDessus({ x: 160, y: 100, cap: 0, echelle: 20 });
  assert.ok(r.retroGauche[1] < 100 - 0.9 * 20 && r.retroDroit[1] > 100 + 0.9 * 20);   // hors de la caisse, de chaque côté
  assert.ok(r.oeil[0] > 160 - 1 * 20 && r.oeil[0] < 160 + 1 * 20 && r.oeil[1] < 100);  // conducteur à gauche (France)
});

test("voiture de profil : le capot et le coffre masquent le sol près de la voiture", () => {
  const p = reperesProfil({ x: 160, y: 140, echelle: 20 });
  assert.ok(p.oeil[1] < p.hautCapot[1] && p.hautCapot[1] < 140);
  assert.ok(p.avantCapot[0] > p.oeil[0] && p.arriereCoffre[0] < p.oeil[0]);
});

// Suite : l'exactitude des deux voitures, relue sur ce qui est dessiné.
const paires = (d) => {
  const v = nombres(d), r = [];
  for (let i = 0; i + 1 < v.length; i += 2) r.push([v[i], v[i + 1]]);
  return r;
};
function dansPolygone([px, py], poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
// Le point est-il sur le contour fermé (au rendu des tracés près, deux décimales) ?
function surContour(p, pts, tolerance = 0.02) {
  let min = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const u = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2)) : 0;
    min = Math.min(min, Math.hypot(p[0] - a[0] - u * (b[0] - a[0]), p[1] - a[1] - u * (b[1] - a[1])));
  }
  return min <= tolerance;
}
// Vue du dessus : du repère de la caisse (mètres, x vers l'avant, y vers la droite) au cadre, et retour.
const versCadre = ({ x, y, cap, echelle }) => ([ax, ay]) => {
  const c = Math.cos(cap * DEG), s = Math.sin(cap * DEG);
  return [x + echelle * (ax * c - ay * s), y + echelle * (ax * s + ay * c)];
};
const versCaisse = ({ x, y, cap, echelle }) => ([px, py]) => {
  const c = Math.cos(cap * DEG), s = Math.sin(cap * DEG), dx = (px - x) / echelle, dy = (py - y) / echelle;
  return [dx * c + dy * s, -dx * s + dy * c];
};
// Rotation (degrés, sens des aiguilles d'une montre à l'écran, comme rotate en SVG) d'un point autour d'un centre.
const tournerAutour = ([px, py], [cx, cy], angle) => {
  const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG), dx = px - cx, dy = py - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};

test("voiture vue du dessus : l'œil du conducteur est celui des scènes (js/scene-regard.js), dans toute pose", () => {
  for (const [x, y, cap, echelle] of [[160, 100, 0, 20], [80, 60, 30, 12.5], [200, 150, 90, 7], [40, 30, -135, 33], [10, 10, 217.5, 50]]) {
    const o = oeil({ x: 0, y: 0, cap: cap * DEG });
    const r = reperesDessus({ x, y, cap, echelle });
    proche(r.oeil[0], x + o.x * echelle, 1e-9, `œil, x, cap ${cap}`);
    proche(r.oeil[1], y + o.y * echelle, 1e-9, `œil, y, cap ${cap}`);
  }
});

test("voiture vue du dessus : la caisse arrondie, le pare-brise et les teintes de dessinerVoiture (js/scene-moteur.js)", () => {
  const source = readFileSync(new URL("../js/scene-moteur.js", import.meta.url), "utf8");
  const corps = source.match(/x: -L \/ 2, y: -W \/ 2, width: L, height: W, rx: ([\d.]+), fill: teinte/);
  const vitre = source.match(/x: L \/ 2 - ([\d.]+), y: -W \/ 2 \+ ([\d.]+), width: ([\d.]+), height: W - ([\d.]+), rx: [\d.]+, fill: TEINTES\.vitre/);
  assert.ok(corps && vitre, "dessinerVoiture a changé : revoir la recopie du kit");
  assert.equal(VOITURE.rayon, Number(corps[1]));
  assert.deepEqual([VOITURE.pareBrise.recul, VOITURE.pareBrise.marge, VOITURE.pareBrise.profondeur, 2 * VOITURE.pareBrise.marge],
    [1, 2, 3, 4].map((i) => Number(vitre[i])));
  const pose = { x: 160, y: 100, cap: 30, echelle: 20 }, e = pose.echelle;
  for (const teinte of ["eleve", "autre"]) {
    const v = voitureDessus({ ...pose, teinte });
    assert.equal(v.attributs.transform, "translate(160 100) rotate(30)");
    const caisse = trouverRole(v, "caisse").attributs;
    assert.deepEqual([caisse.x, caisse.y, caisse.rx], [-2.25 * e, -0.9 * e, 0.4 * e]);
    assert.equal(caisse.fill, TEINTES[teinte], teinte);
    assert.equal(caisse.stroke, TEINTES[`${teinte}Bord`], teinte);
    // Pare-brise : du haut, à L/2 - 1,55 m, au pied, 0,55 m plus loin ; dans la largeur de celui des scènes, qu'il remplit.
    const pb = trouverRole(v, "pare-brise");
    assert.equal(pb.attributs.fill, TEINTES.vitre);
    const pts = paires(pb.attributs.d), haut = 2.25 - 1.55, demi = 0.9 - 0.18;
    proche(Math.min(...pts.map((p) => p[0])), haut * e, 0.01, "haut du pare-brise");
    proche(Math.max(...pts.map((p) => p[0])), (haut + 0.55) * e, 0.01, "pied du pare-brise");
    const large = Math.max(...pts.map((p) => Math.abs(p[1])));
    assert.ok(large <= demi * e + 0.01 && large >= 0.95 * demi * e, `largeur du pare-brise : ${large}`);
    // Lunette et vitres latérales de la teinte des vitres, feux arrière de celle des feux stop.
    for (const role of ["lunette", "vitre-avant-gauche", "vitre-arriere-droite"]) assert.equal(trouverRole(v, role).attributs.fill, TEINTES.vitre, role);
    for (const role of ["feu-gauche", "feu-droit"]) assert.equal(trouverRole(v, role).attributs.fill, TEINTES.stop, role);
  }
});

test("voiture vue du dessus : roues aux essieux et à la voie choisie, avant braquées, arrière droites ; sans roues, rien", () => {
  const pose = { x: 150, y: 110, cap: 30, echelle: 20 }, e = pose.echelle, cadreDe = versCadre(pose);
  const v = voitureDessus({ ...pose, roues: true, braquage: -18 });
  const r = reperesDessus(pose);
  assert.deepEqual([VOITURE.empattement, VOITURE.voie, VOITURE.roue.diametre, VOITURE.roue.largeur], [2.6, 1.52, 0.64, 0.21]);
  const avant = VOITURE.empattement - VOITURE.essieu, arriere = -VOITURE.essieu, demi = VOITURE.voie / 2;
  for (const [role, centre, angle, repere] of [["roue-avant-gauche", [avant, -demi], -18, r.roueAvantGauche],
    ["roue-avant-droite", [avant, demi], -18, r.roueAvantDroite], ["roue-arriere-gauche", [arriere, -demi], 0],
    ["roue-arriere-droite", [arriere, demi], 0]]) {
    const roue = trouverRole(v, role), attendu = cadreDe(centre);
    proche(roue.attributs["data-x"], attendu[0], 1e-9, role);
    proche(roue.attributs["data-y"], attendu[1], 1e-9, role);
    assert.equal(roue.attributs["data-angle"], angle, role);
    if (repere) { proche(repere[0], attendu[0], 1e-9, role); proche(repere[1], attendu[1], 1e-9, role); }
    // Le pneu, 0,64 m sur 0,21 m, centré sur la roue, tourné du braquage dans le repère de la caisse.
    const t = nombres(roue.attributs.transform);
    [centre[0] * e, centre[1] * e, angle].forEach((val, i) => proche(t[i], val, 0.01, `${role}, transform`));
    const pneu = trouverRole(roue, "pneu").attributs;
    [[pneu.width, 0.64 * e], [pneu.height, 0.21 * e], [pneu.x, -0.32 * e], [pneu.y, -0.105 * e]].forEach(([a, b]) => proche(a, b, 1e-9, `${role}, pneu`));
  }
  assert.equal(trouverRole(voitureDessus(pose), "roue-avant-gauche"), null);
});

test("voiture vue du dessus : rétroviseurs extérieurs symétriques et hors de la caisse, intérieur dans l'axe au haut du pare-brise ; repères et dessin d'accord", () => {
  for (const cap of [0, 30, -120]) {
    const pose = { x: 160, y: 100, cap, echelle: 20 };
    const v = voitureDessus({ ...pose, retroviseurs: true });
    const r = reperesDessus(pose), local = versCaisse(pose);
    for (const [role, p] of [["retroviseur-gauche", r.retroGauche], ["retroviseur-droit", r.retroDroit], ["retroviseur-interieur", r.retroInterieur]]) {
      const noeud = trouverRole(v, role);
      proche(noeud.attributs["data-x"], p[0], 1e-9, `${role}, cap ${cap}`);
      proche(noeud.attributs["data-y"], p[1], 1e-9, `${role}, cap ${cap}`);
    }
    const [g, d, i] = [r.retroGauche, r.retroDroit, r.retroInterieur].map(local);
    proche(g[0], d[0], 1e-9, "même avancée");
    proche(g[1], -d[1], 1e-9, "symétriques par rapport à l'axe");
    assert.ok(g[1] < -0.9 && d[1] > 0.9, `hors de la caisse (cap ${cap})`);
    assert.ok(g[0] > VOITURE.oeil.avant, "devant le conducteur");
    proche(i[1], 0, 1e-9, "rétroviseur intérieur dans l'axe");
    assert.ok(i[0] >= 2.25 - 1.55 && i[0] <= 2.25 - 1.55 + 0.55, "vu à travers le pare-brise");
  }
  assert.equal(trouverRole(voitureDessus({ x: 160, y: 100, echelle: 20 }), "retroviseur-gauche"), null);
});

test("voiture vue du dessus : la portière du conducteur s'ouvre vers l'extérieur autour de sa charnière, son rétroviseur avec elle", () => {
  const pose = { x: 160, y: 100, cap: 30, echelle: 20 }, e = pose.echelle, local = versCaisse(pose);
  const ferme = voitureDessus({ ...pose, retroviseurs: true }), ouvert = voitureDessus({ ...pose, retroviseurs: true, portiere: 40 });
  assert.equal(formeArbre(ferme), formeArbre(ouvert), "mêmes nœuds : une animation peut l'ouvrir");
  assert.equal(trouverRole(ferme, "portiere").attributs.display, "none");
  const p = trouverRole(ouvert, "portiere");
  assert.equal(p.attributs.display, "inline");
  assert.equal(p.attributs["data-angle"], 40);
  // Rotation de 40 degrés autour de la charnière : à l'avant de la portière, en dedans du flanc gauche.
  const { charniere, arriere } = VOITURE.portiere, pivot = [charniere[0], -charniere[1]];
  const [angle, cx, cy] = nombres(p.attributs.transform);
  assert.equal(angle, 40);
  proche(cx, pivot[0] * e, 0.01, "charnière, x");
  proche(cy, pivot[1] * e, 0.01, "charnière, y");
  const h = local([p.attributs["data-x"], p.attributs["data-y"]]);
  proche(h[0], pivot[0], 1e-9, "repère de la charnière, x");
  proche(h[1], pivot[1], 1e-9, "repère de la charnière, y");
  assert.ok(pivot[0] > arriere && pivot[1] > -0.9, "charnière à l'avant de la portière, dans la caisse");
  // L'arrière de la portière sort du flanc gauche ; le rétroviseur gauche a tourné autour de la même charnière.
  assert.ok(tournerAutour([arriere, -0.9], pivot, 40)[1] < -0.9 - 0.5, "portière ouverte vers l'extérieur");
  const r0 = local(reperesDessus(pose).retroGauche), r40 = local(reperesDessus({ ...pose, portiere: 40 }).retroGauche);
  const attendu = tournerAutour(r0, pivot, 40);
  proche(r40[0], attendu[0], 1e-9, "rétroviseur, x");
  proche(r40[1], attendu[1], 1e-9, "rétroviseur, y");
  const dessine = trouverRole(ouvert, "retroviseur-gauche").attributs;
  const dessineLocal = local([dessine["data-x"], dessine["data-y"]]);
  proche(dessineLocal[0], attendu[0], 1e-9, "rétroviseur dessiné, x");
  proche(dessineLocal[1], attendu[1], 1e-9, "rétroviseur dessiné, y");
  assert.deepEqual(nombres(dessine.transform), nombres(p.attributs.transform));
});

test("voitures : une valeur inconnue ou hors de ses bornes est une erreur, jamais une voiture devinée", () => {
  const base = { x: 160, y: 100, echelle: 20 };
  assert.throws(() => voitureDessus({ ...base, teinte: "rouge" }), /teinte « rouge » inconnu/);
  assert.throws(() => voitureProfil({ ...base, teinte: "Eleve" }), /teinte « Eleve » inconnu/);
  assert.throws(() => voitureProfil({ ...base, sens: "avant" }), /sens « avant » inconnu/);
  assert.throws(() => reperesProfil({ ...base, sens: "haut" }), /sens « haut » inconnu/);
  for (const braquage of [41, -41, NaN]) assert.throws(() => voitureDessus({ ...base, braquage }), /braquage/);
  for (const portiere of [-1, 71, NaN]) {
    assert.throws(() => voitureDessus({ ...base, portiere }), /portière/);
    assert.throws(() => reperesDessus({ ...base, portiere }), /portière/);
  }
  for (const echelle of [0, -5, NaN, undefined]) {
    for (const f of [voitureDessus, reperesDessus, voitureProfil, reperesProfil]) assert.throws(() => f({ ...base, echelle }), /échelle/);
  }
  assert.throws(() => voitureDessus({ ...base, cap: NaN }), /: cap : nombre fini attendu/);
  assert.throws(() => reperesDessus({ ...base, cap: Infinity }), /: cap : nombre fini attendu/);
  assert.throws(() => voitureProfil({ ...base, x: undefined }), /: x : nombre fini attendu/);
  assert.throws(() => reperesProfil({ ...base, y: "bas" }), /: y : nombre fini attendu/);
});

test("voitures : contrôles communs et traits du jeu de la charte, à toutes les échelles et dans tous leurs états", () => {
  const d = cadre({ largeur: 320, hauteur: 420, titre: "Voitures", description: "Essai." },
    voitureDessus({ x: 30, y: 25, cap: 0, echelle: 6, retroviseurs: true, roues: true, braquage: 30, portiere: 70 }),
    voitureDessus({ x: 110, y: 35, cap: 30, echelle: 12, teinte: "autre", retroviseurs: true, roues: true }),
    voitureDessus({ x: 240, y: 55, cap: 90, echelle: 20, retroviseurs: true, roues: true, braquage: -40, portiere: 35 }),
    voitureDessus({ x: 120, y: 140, cap: -150, echelle: 40, retroviseurs: true, roues: true, portiere: 10 }),
    voitureProfil({ x: 60, y: 250, echelle: 10 }),
    voitureProfil({ x: 220, y: 260, echelle: 25, sens: "gauche", teinte: "autre", portiereOuverte: true, trappeOuverte: true }),
    voitureProfil({ x: 160, y: 410, echelle: 60, portiereOuverte: true, trappeOuverte: true }));
  assert.deepEqual(verifierDessin(d, [320, 420]), []);
  const jeu = Object.values(CHARTE.traits);
  let vus = 0;
  for (const x of trouverTous(d, (x) => "stroke-width" in x.attributs && x.attributs["data-r"] !== "fond")) {
    assert.ok(jeu.includes(x.attributs["stroke-width"]), `${x.balise} ${x.attributs["data-r"] || ""} : épaisseur ${x.attributs["stroke-width"]}`);
    vus++;
  }
  assert.ok(vus > 20);
});

test("voiture de profil : roues posées au sol, aux essieux et à la taille de la vue du dessus", () => {
  const [x, y, e] = [160, 140, 20];
  const v = voitureProfil({ x, y, echelle: e }), p = reperesProfil({ x, y, echelle: e });
  const rayon = VOITURE.roue.diametre / 2;
  for (const [role, ax] of [["roue-avant", VOITURE.empattement - VOITURE.essieu], ["roue-arriere", -VOITURE.essieu]]) {
    const roue = trouverRole(v, role), pneu = trouverRole(roue, "pneu").attributs;
    proche(roue.attributs["data-x"], x + ax * e, 1e-9, role);
    proche(roue.attributs["data-y"], y - rayon * e, 1e-9, role);
    [[pneu.cx, x + ax * e], [pneu.cy, y - rayon * e], [pneu.r, rayon * e]].forEach(([a, b]) => proche(a, b, 1e-9, `${role}, pneu`));
    proche(pneu.cy + pneu.r, y, 1e-9, `${role} posée au sol`);
    proche(trouverRole(roue, "jante").attributs.r, (VOITURE.roue.jante / 2) * e, 1e-9, `${role}, jante`);
  }
  assert.deepEqual(p.solAvant, [x + 2.25 * e, y]);
  assert.deepEqual(p.solArriere, [x - 2.25 * e, y]);
});

test("voiture de profil : caisse de 4,5 m à la hauteur choisie, avant et arrière à ses extrémités, œil derrière la vitre", () => {
  const [x, y, e] = [160, 140, 20];
  const v = voitureProfil({ x, y, echelle: e }), p = reperesProfil({ x, y, echelle: e });
  const pts = paires(trouverRole(v, "caisse").attributs.d), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  proche(Math.max(...xs), x + 2.25 * e, 0.01, "avant");
  proche(Math.min(...xs), x - 2.25 * e, 0.01, "arrière");
  assert.equal(VOITURE.hauteur, 1.45);
  proche(Math.min(...ys), y - VOITURE.hauteur * e, 0.01, "toit");
  proche(Math.max(...ys), y - VOITURE.profil.basCaisse * e, 0.01, "bas de caisse");
  proche(p.avantCapot[0], Math.max(...xs), 0.01, "avantCapot : le point le plus avancé");
  proche(p.arriereCoffre[0], Math.min(...xs), 0.01, "arriereCoffre : le point le plus reculé");
  assert.ok(surContour(p.avantCapot, pts) && surContour(p.arriereCoffre, pts), "sur le contour de la caisse");
  proche(p.oeil[0], x + VOITURE.oeil.avant * e, 1e-9, "œil, x");
  proche(p.oeil[1], y - VOITURE.oeil.hauteur * e, 1e-9, "œil, y");
  assert.ok(dansPolygone(p.oeil, paires(trouverRole(v, "vitrage").attributs.d)), "œil derrière les vitres latérales");
});

test("voiture de profil : la ligne de visée frôle le rebord du capot (hautCapot) et le pied de la lunette (hautCoffre), sans entrer dans la caisse", () => {
  for (const sens of ["droite", "gauche"]) {
    const [x, y, e] = [160, 140, 20], s = sens === "droite" ? 1 : -1;
    const pts = paires(trouverRole(voitureProfil({ x, y, echelle: e, sens }), "caisse").attributs.d);
    const p = reperesProfil({ x, y, echelle: e, sens });
    const auvent = x + s * VOITURE.profil.auvent[0] * e, basLunette = x + s * VOITURE.profil.basLunette[0] * e;
    // Ordonnée de la ligne œil-repère à l'abscisse de q ; « sous la ligne » : y du cadre plus grand, au rendu près.
    const sous = (repere, q) => q[1] >= p.oeil[1] + ((q[0] - p.oeil[0]) / (repere[0] - p.oeil[0])) * (repere[1] - p.oeil[1]) - 0.02;
    let devant = 0, derriere = 0;
    for (const q of pts) {
      if (s * (q[0] - auvent) >= 0) { devant++; assert.ok(sous(p.hautCapot, q), `${sens} : la ligne du capot entre dans la caisse en ${q}`); }
      if (s * (q[0] - basLunette) <= 0) { derriere++; assert.ok(sous(p.hautCoffre, q), `${sens} : la ligne du coffre entre dans la caisse en ${q}`); }
    }
    assert.ok(devant > 10 && derriere > 10, `${sens} : contour lu`);
    assert.ok(surContour(p.hautCapot, pts) && surContour(p.hautCoffre, pts), `${sens} : repères sur la caisse`);
    // Le repère du capot est à son rebord avant ; celui du coffre, au pied de la lunette.
    assert.ok(s * (p.hautCapot[0] - auvent) > 0 && s * (p.avantCapot[0] - p.hautCapot[0]) > 0, `${sens} : sur le capot`);
    proche(p.hautCapot[0], x + s * VOITURE.profil.levreCapot[0] * e, 0.15 * e, `${sens} : au rebord avant du capot`);
    proche(p.hautCoffre[0], basLunette, 0.01, `${sens} : pied de la lunette, x`);
    proche(p.hautCoffre[1], y - VOITURE.profil.basLunette[1] * e, 0.01, `${sens} : pied de la lunette, y`);
  }
});

test("voiture de profil : vers la gauche, la même voiture en miroir, vue de son côté conducteur", () => {
  const [x, y, e] = [160, 140, 20];
  for (const options of [{}, { portiereOuverte: true, trappeOuverte: true }]) {
    const d = reperesProfil({ x, y, echelle: e, ...options }), g = reperesProfil({ x, y, echelle: e, sens: "gauche", ...options });
    assert.deepEqual(Object.keys(g).sort(), ["arriereCoffre", "avantCapot", "hautCapot", "hautCoffre", "montantPortiere", "oeil",
      "solArriere", "solAvant", "trappe"]);
    for (const k of Object.keys(d)) { proche(g[k][0], 2 * x - d[k][0], 1e-9, k); proche(g[k][1], d[k][1], 1e-9, k); }
    const cd = paires(trouverRole(voitureProfil({ x, y, echelle: e, ...options }), "caisse").attributs.d);
    const cg = paires(trouverRole(voitureProfil({ x, y, echelle: e, sens: "gauche", ...options }), "caisse").attributs.d);
    assert.equal(cg.length, cd.length);
    cd.forEach((q, i) => { proche(cg[i][0], 2 * x - q[0], 0.011, "caisse, x"); proche(cg[i][1], q[1], 1e-9, "caisse, y"); });
  }
});

test("voiture de profil : portière ouverte, le montant se découvre ; trappe ouverte, sa face intérieure se montre", () => {
  const [x, y, e] = [160, 140, 40];
  const ferme = voitureProfil({ x, y, echelle: e }), ouvert = voitureProfil({ x, y, echelle: e, portiereOuverte: true, trappeOuverte: true });
  assert.equal(formeArbre(ferme), formeArbre(ouvert), "mêmes nœuds, ouverte ou fermée");
  for (const [role, fermee, ouverte] of [["portiere-ouverte", "none", "inline"], ["trappe-ouverte", "none", "inline"],
    ["portiere-fermee", "inline", "none"], ["trappe-fermee", "inline", "none"]]) {
    assert.equal(trouverRole(ferme, role).attributs.display, fermee, role);
    assert.equal(trouverRole(ouvert, role).attributs.display, ouverte, role);
  }
  // Portière : tournée autour de sa charnière verticale, à l'avant, elle se voit raccourcie du cosinus de son ouverture ;
  // sa peau, à dz hors de l'axe de la charnière, glisse de dz sinus ; son chant (l'épaisseur de son bord arrière) se montre
  // derrière elle. La part devant la charnière rentre sous l'aile.
  const { charniere, arriere, epaisseur, ouvertureProfil } = VOITURE.portiere;
  const porte = trouverRole(ouvert, "portiere-ouverte");
  assert.equal(porte.attributs["data-angle"], ouvertureProfil);
  proche(porte.attributs["data-x"], x + charniere[0] * e, 1e-9, "charnière");
  const cos = Math.cos(ouvertureProfil * DEG), sin = Math.sin(ouvertureProfil * DEG), peau = VOITURE.largeur / 2 - charniere[1];
  const vu = (xl, dz) => x + (charniere[0] + (xl - charniere[0]) * cos + dz * sin) * e;
  const panneau = paires(trouverRole(porte, "panneau").attributs.d).map((q) => q[0]);
  proche(Math.min(...panneau), vu(arriere, peau), 0.01, "bord arrière de la portière ouverte");
  proche(Math.max(...panneau), vu(charniere[0], peau), 0.01, "bord avant, à la charnière");
  const chant = paires(trouverRole(porte, "chant").attributs.d).map((q) => q[0]);
  proche(Math.min(...chant), vu(arriere, peau - epaisseur), 0.01, "chant, face intérieure");
  proche(Math.max(...chant), vu(arriere, peau), 0.01, "chant, peau");
  // Le montant, où se colle souvent l'étiquette des pressions, est découvert, dans l'ouverture.
  const p = reperesProfil({ x, y, echelle: e, portiereOuverte: true, trappeOuverte: true });
  assert.ok(p.montantPortiere[0] < Math.min(...chant), "montant découvert par la portière ouverte");
  assert.ok(dansPolygone(p.montantPortiere, paires(trouverRole(porte, "montant").attributs.d)), "repère sur le montant");
  // Trappe : ouverte au-delà de l'angle droit, sa face intérieure se voit ; le repère est sur elle.
  const trappe = trouverRole(ouvert, "trappe-ouverte");
  assert.ok(trappe.attributs["data-angle"] > 90 && trappe.attributs["data-angle"] < 180);
  assert.ok(dansPolygone(p.trappe, paires(trouverRole(trappe, "volet").attributs.d)), "repère sur la face intérieure");
  // Fermée : au-dessus du passage de la roue arrière, entre la portière arrière et le feu ; repère en son centre.
  const f = reperesProfil({ x, y, echelle: e });
  const voletFerme = paires(trouverRole(trouverRole(ferme, "trappe-fermee"), "volet").attributs.d);
  assert.ok(dansPolygone(f.trappe, voletFerme), "repère sur la trappe fermée");
  const passage = paires(trouverRole(ferme, "passage-arriere").attributs.d);
  assert.ok(Math.max(...voletFerme.map((q) => q[1])) < Math.min(...passage.map((q) => q[1])), "au-dessus du passage de roue");
  const feu = paires(trouverRole(ferme, "feu").attributs.d);
  assert.ok(Math.min(...voletFerme.map((q) => q[0])) > Math.max(...feu.map((q) => q[0])), "devant le feu arrière");
});

// Relecture de la tâche 5, premier tour.
test("voiture de profil : une compacte à hayon, pas un break : toit arrêté à 0,7 m de l'arrière, lunette penchée de plus de 45 degrés", () => {
  const [haut, bas] = [VOITURE.lunette.haut, VOITURE.lunette.bas];
  assert.ok(VOITURE.longueur / 2 + haut[0] >= 0.7, `toit arrêté à ${(VOITURE.longueur / 2 + haut[0]).toFixed(2)} m de l'arrière`);
  const inclinaison = Math.atan2(haut[0] - bas[0], haut[1] - bas[1]) / DEG;
  assert.ok(inclinaison > 45 && inclinaison < 60, `lunette penchée de ${inclinaison.toFixed(1)} degrés sur la verticale`);
  // Le contour dessiné suit ces choix : le haut de la lunette et son pied sont sur la caisse.
  const pts = paires(trouverRole(voitureProfil({ x: 160, y: 140, echelle: 20 }), "caisse").attributs.d);
  assert.ok(surContour([160 + bas[0] * 20, 140 - bas[1] * 20], pts), "pied de la lunette sur la caisse");
});

test("voiture vue du dessus : l'habitacle découvert est l'empreinte de la portière fermée ; il croît avec l'angle, sans saut", () => {
  const pose = { x: 160, y: 100, cap: 0, echelle: 20 }, e = pose.echelle;
  const { charniere } = VOITURE.portiere, pivot = [charniere[0] * e, -charniere[1] * e];
  for (const angle of [0, 1, 40]) {
    const v = voitureDessus({ ...pose, retroviseurs: true, portiere: angle });
    // La portière qui tourne est exactement l'empreinte de l'ouverture : à 0 degré, elle la couvre tout entière.
    assert.equal(trouverRole(trouverRole(v, "portiere"), "panneau").attributs.d, trouverRole(v, "ouverture").attributs.d, `${angle} degré(s)`);
  }
  // À 1 degré, aucun point de l'empreinte ne bouge de plus de 2 cm : l'habitacle découvert n'est qu'un mince coin.
  const empreinte = paires(trouverRole(voitureDessus({ ...pose, portiere: 1 }), "ouverture").attributs.d);
  const deplacement = Math.max(...empreinte.map((p) => { const q = tournerAutour(p, pivot, 1); return Math.hypot(q[0] - p[0], q[1] - p[1]); }));
  assert.ok(deplacement <= 0.02 * e, `déplacement de ${(deplacement / e).toFixed(3)} m à 1 degré`);
  // Le contour de la portière apparaît sur ses premiers degrés, sans saut ; il est entier à 40 degrés.
  const contour = (angle) => trouverRole(trouverRole(voitureDessus({ ...pose, portiere: angle }), "portiere"), "panneau").attributs["stroke-opacity"];
  assert.ok(contour(1) > 0 && contour(1) < 0.5 && contour(40) === 1, `opacités ${contour(1)} et ${contour(40)}`);
});

test("voiture vue du dessus : les roues passent sous la portière ouverte et sous les rétroviseurs", () => {
  const v = voitureDessus({ x: 160, y: 100, echelle: 20, roues: true, retroviseurs: true, portiere: 40 });
  const rang = (role) => v.enfants.findIndex((x) => typeof x !== "string" && x.attributs["data-r"] === role);
  for (const role of ["roue-avant-gauche", "ouverture", "portiere", "retroviseur-gauche"]) assert.ok(rang(role) >= 0, role);
  assert.ok(rang("roue-avant-gauche") < rang("ouverture") && rang("ouverture") < rang("portiere") && rang("portiere") < rang("retroviseur-gauche"),
    "roues, puis l'habitacle découvert, puis la portière, puis les rétroviseurs");
});

test("voitures : à petite échelle les détails de finition s'effacent, les pièces demandées et les grandes surfaces restent", () => {
  const options = { retroviseurs: true, roues: true, portiere: 30 };
  const petit = voitureDessus({ x: 40, y: 40, echelle: 6, ...options }), grand = voitureDessus({ x: 160, y: 100, echelle: 20, ...options });
  for (const role of ["phare-gauche", "feu-droit", "vitre-avant-gauche", "essuie-glaces", "reflet-pare-brise"]) {
    assert.equal(trouverRole(petit, role), null, `${role} à l'échelle 6`);
    assert.ok(trouverRole(grand, role), `${role} à l'échelle 20`);
  }
  for (const role of ["caisse", "toit", "pare-brise", "lunette", "retroviseur-gauche", "retroviseur-interieur", "roue-avant-gauche", "portiere"]) {
    assert.ok(trouverRole(petit, role), `${role} à l'échelle 6`);
  }
  const profil = { portiereOuverte: true, trappeOuverte: true };
  // De profil, à l'échelle 40 (une poignée de 4 cm n'y fait que 1,6 unité).
  const p6 = voitureProfil({ x: 40, y: 60, echelle: 6 }), p40 = voitureProfil({ x: 160, y: 140, echelle: 40 });
  for (const role of ["phare", "feu", "montant-milieu", "poignee-arriere", "retroviseur", "bas-de-caisse"]) {
    assert.equal(trouverRole(p6, role), null, `${role} de profil à l'échelle 6`);
    assert.ok(trouverRole(p40, role), `${role} de profil à l'échelle 40`);
  }
  const p6o = voitureProfil({ x: 40, y: 60, echelle: 6, ...profil });
  for (const role of ["caisse", "vitrage", "roue-avant", "passage-arriere", "portiere-ouverte", "trappe-ouverte"]) assert.ok(trouverRole(p6o, role), role);
});

test("formes du kit : coins arrondis, arcs, demi-plans et bandes, pour les familles de dessins", () => {
  // Coin arrondi : le sommet devient une courbe qui part et finit à son rayon du sommet, sans l'atteindre ; rayon nul, coin vif.
  const carre = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const rond = arrondir(carre, [2, 0, 0, 0]);
  assert.deepEqual(rond.slice(-3), [[10, 0], [10, 10], [0, 10]]);
  assert.deepEqual(rond[0], [0, 2]);
  assert.deepEqual(rond[rond.length - 4], [2, 0]);
  assert.ok(rond.every(([x, y]) => x >= 0 && y >= 0) && !rond.some(([x, y]) => x === 0 && y === 0));
  // Arc : extrémités comprises, chaque point sur le cercle, pas d'au plus six degrés.
  const a = arc([1, 2], 3, 0, 90);
  proche(a[0][0], 4, 1e-12, "arc, début"); proche(a.at(-1)[1], 5, 1e-12, "arc, fin");
  assert.ok(a.length >= 16 && a.every(([x, y]) => Math.abs(Math.hypot(x - 1, y - 2) - 3) < 1e-12));
  // Demi-plan : ce qui reste où f <= 0, le bord coupé exactement sur la droite.
  assert.deepEqual(couper(carre, (p) => p[0] - 4), [[0, 0], [4, 0], [4, 10], [0, 10]]);
  // Bande : entre deux droites parallèles (ici verticales, pente nulle).
  assert.deepEqual(bande(carre, { pente: 0, debut: 3, fin: 6 }).map(([x]) => x).sort((u, w) => u - w), [3, 3, 6, 6]);
});

// ===== Ce que le kit exporte pour les familles (tâche d'intégration du lot D1) : une seule définition, celle qu'il dessine =====

test("tracés : coord, point et trace écrivent chaque coordonnée à deux décimales au plus, fermé par défaut", () => {
  assert.equal(kit.coord(12), "12");
  assert.equal(kit.coord(3.14159), "3.14");
  assert.equal(kit.point([1.005, -2.5]), "1 -2.5");
  assert.equal(kit.trace([[0, 0], [10.126, 0], [10, 5.5]]), "M0 0 L10.13 0 L10 5.5 Z");
  assert.equal(kit.trace([[0, 0], [1, 1]], false), "M0 0 L1 1");
  assert.deepEqual(kit.entre([0, 10], [10, 30], 0.25), [2.5, 15]);
});

test("METRIQUES_POLICE : les repères d'Outfit que mesurent les contrôles communs, et ceux qui posent les étiquettes du kit", () => {
  const m = kit.METRIQUES_POLICE;
  assert.deepEqual({ haut: m.haut, hautAccent: m.hautAccent, bas: m.bas }, HAUTEURS_MESUREES);
  // Une étiquette d'une ligne, ancrée à gauche : texte à l'espace d'étiquette de l'ancre, ligne de base sous le milieu des capitales.
  const une = etiquette({ cible: [10, 50], ancre: [40, 50], lignes: ["Jante"] });
  const [t1] = trouverTous(une, (x) => x.balise === "text");
  assert.equal(t1.attributs.x, 40 + kit.MISE_EN_PAGE.espaceEtiquette);
  proche(t1.attributs.y, 50 + m.milieuCapitales * CHARTE.tailles.etiquette, 1e-9, "ligne de base");
  // Deux lignes : pas de l'interligne, en tailles de texte.
  const deux = trouverTous(etiquette({ cible: [10, 50], ancre: [40, 50], lignes: ["Feux et", "clignotants"] }), (x) => x.balise === "text");
  proche(deux[1].attributs.y - deux[0].attributs.y, m.interligne * CHARTE.tailles.etiquette, 1e-9, "interligne");
});

test("MISE_EN_PAGE et largeurPastille : les mesures de la vignette et de sa pastille que le kit dessine", () => {
  const P = kit.MISE_EN_PAGE;
  for (const etat of ["juste", "faux"]) {
    const v = vignette({ x: 20, y: 30, largeur: 140, hauteur: 100, etat });
    assert.equal(v.enfants[0].attributs.rx, P.rayonVignette, `${etat} : rayon de la carte`);
    const fond = trouverRole(v, `pastille-${etat}`).enfants[0].attributs;
    assert.deepEqual([fond.x, fond.y], [20 + P.margePastille, 30 + P.margePastille], `${etat} : marge de la pastille`);
    assert.equal(fond.height, P.hauteurPastille, `${etat} : hauteur de la pastille`);
    proche(fond.width, kit.largeurPastille(etat), 1e-9, `${etat} : largeur de la pastille`);
  }
  assert.throws(() => kit.largeurPastille("vrai"), /état « vrai » inconnu/);
});

test("REGARD_SCENES : le cône du regard des scènes, portée, demi-ouverture et opacité, celui que dessine leur moteur", () => {
  assert.deepEqual(kit.REGARD_SCENES, { portee: REGARD_PORTEE, demiOuverture: REGARD_OUVERTURE, opacite: OPACITE_CONE });
  // Le moteur dessine bien le cône dans la teinte du regard, à cette opacité.
  const source = readFileSync(new URL("../js/scene-moteur.js", import.meta.url), "utf8");
  assert.match(source, /OPACITE_REGARD = \{ cone: OPACITE_CONE,/);
  assert.match(source, /fill: TEINTES\.regard, opacity: OPACITE_REGARD\.cone/);
  assert.equal(kit.TEINTES_ROUTE.regard, TEINTES.regard);
});

test("MATIERES, jointsCapot, VITRAGE_CONTOUR, ceinture : ce que dessinent les voitures du kit", () => {
  const M = kit.MATIERES, e = 20;
  const dessus = voitureDessus({ x: 0, y: 0, cap: 0, echelle: e, roues: true });
  for (const [role, matiere] of [["pare-brise", "vitre"], ["lunette", "vitre"], ["phare-gauche", "phare"], ["feu-droit", "feu"]]) {
    assert.equal(trouverRole(dessus, role).attributs.fill, M[matiere], role);
  }
  assert.equal(trouverRole(trouverRole(dessus, "roue-avant-gauche"), "pneu").attributs.fill, M.pneu);
  const profil = voitureProfil({ x: 0, y: 0, echelle: e });
  assert.equal(trouverRole(profil, "pneu").attributs.fill, M.pneu);
  assert.equal(trouverRole(profil, "jante").attributs.fill, M.jante);
  assert.equal(trouverRole(profil, "vitrage").attributs.fill, M.vitre);
  // Les deux joints du capot vus du dessus : les traits de la caisse, de chaque côté, du bord arrière du capot à son bord avant.
  const { arriere, avant } = VOITURE.jointsCapot;
  const joints = dessus.enfants.filter((x) => x.balise === "line").map((l) => [l.attributs.x1, l.attributs.y1, l.attributs.x2, l.attributs.y2]);
  assert.deepEqual(joints, [-1, 1].map((c) => [arriere[0] * e, c * arriere[1] * e, avant[0] * e, c * avant[1] * e]));
  // Le contour des vitres de profil est celui que le kit dessine (sens « droite » : x vers la droite, hauteur vers le haut).
  assert.equal(trouverRole(profil, "vitrage").attributs.d, kit.trace(kit.VITRAGE_CONTOUR.map(([x, h]) => [x * e, -h * e])));
  // Ligne de ceinture : le bas des vitres, du pied du montant arrière au pied du montant de pare-brise.
  const { arriereBas, avantBas } = VOITURE.vitrage;
  proche(kit.ceinture(arriereBas[0]), arriereBas[1], 1e-12, "ceinture au montant arrière");
  proche(kit.ceinture(avantBas[0]), avantBas[1], 1e-12, "ceinture au pied du pare-brise");
});

// Les familles de dessins lisent dans le kit ce qu'il exporte (décision commune 1 du lot : réutiliser, jamais recopier). Trois
// façons de recopier, que ce test refuse : déclarer au premier niveau d'une famille un nom que le kit exporte (une copie de trace,
// de coord, de MATIERES...) ; réécrire l'écriture des coordonnées du kit sous un autre nom (String(Number(x.toFixed(2)))) ;
// redonner en dur un repère d'Outfit ou une mesure de vignette (MILIEU_CAPITALES = 0.35...).
test("aucune famille de dessins ne recopie une aide, une matière ou une mesure que le kit exporte", () => {
  const exports = new Set(Object.keys(kit));
  const familles = readdirSync(new URL("../js/", import.meta.url)).filter((f) => /^dessins-[a-z]+\.js$/.test(f) && f !== "dessins-kit.js");
  assert.ok(familles.length >= 6, "les six familles sont lues");
  const fautes = [];
  for (const f of familles) {
    const src = readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/^(?:export\s+)?(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (exports.has(m[1])) fautes.push(`${f} : déclare ${m[1]}, qu'exporte le kit`);
    }
    if (/String\(Number\([^()]*\.toFixed\(2\)\)\)/.test(src)) fautes.push(`${f} : réécrit coord`);
    for (const m of src.matchAll(/\b(MILIEU_CAPITALES|HAUT_TEXTE|BAS_TEXTE|INTERLIGNE|ESPACE_TEXTE|RAYON_VIGNETTE|RAYON_CARTE|SOUS_PASTILLE)\s*=\s*[\d.]+[,;]/g)) {
      fautes.push(`${f} : ${m[1]} écrit en dur`);
    }
  }
  assert.deepEqual(fautes, []);
});

// Rétroviseur intérieur vu de face, pièce commune de « retroviseurs » et de la vignette d'« installation » (relecture finale du
// lot D1, m5) : verre de 25 sur 7 aux bouts arrondis ; lunette centrée qui le remplit presque, plus large en haut ; horizon dans
// son quart haut ; décalée (miroir pas encore réglé), elle sort du verre.
test("rétroviseur intérieur vu de face : verre de 25 sur 7, lunette centrée et plus large en haut, horizon au quart haut", () => {
  const m = kit.miroirInterieur({ x: 10, y: 20, largeur: 125 });
  proche(m.hauteur, 35, 1e-9, "verre de 25 sur 7");
  proche(m.rayon, 0.45 * 35, 1e-9, "bouts du verre arrondis");
  const [hg, hd, bd, bg] = m.coins;
  proche(hd[0] - hg[0], 0.80 * 125, 1e-9, "80 % de la largeur du verre en haut");
  proche(bd[0] - bg[0], 0.75 * 125, 1e-9, "75 % en bas");
  proche(bg[1] - hg[1], 0.78 * 35, 1e-9, "78 % de sa hauteur");
  proche((hg[1] + bg[1]) / 2, 20 + 35 / 2, 1e-9, "centrée en hauteur");
  proche((hg[0] + hd[0] + bg[0] + bd[0]) / 4, 10 + 125 / 2, 1e-9, "centrée en largeur");
  proche(m.horizon, hg[1] + 0.25 * (bg[1] - hg[1]), 1e-9, "horizon au quart haut de la lunette");
  // Contours : le verre et la lunette sont convexes, tournés dans le même sens ; un point est dedans s'il est du même côté
  // de chaque côté.
  const dedans = (p, poly) => poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
  });
  assert.ok(m.lunette.every((p) => dedans(p, m.verre)), "la lunette tient dans le verre");
  assert.ok(m.lunette.every((p) => p[1] >= hg[1] - 1e-9 && p[1] <= bg[1] + 1e-9), "coins arrondis : la lunette ne dépasse pas ses bords");
  const decale = kit.miroirInterieur({ x: 10, y: 20, largeur: 125 }, [20, 10]);
  assert.ok(decale.lunette.some((p) => !dedans(p, decale.verre)), "décalée, la lunette sort du verre");
  proche(decale.hauteur, m.hauteur, 1e-9, "le décalage ne touche pas au verre");
  assert.throws(() => kit.miroirInterieur({ x: 0, y: 0, largeur: 0 }), /largeur/);
  assert.throws(() => kit.miroirInterieur({ x: 0, y: 0, largeur: 10 }, [Number.NaN, 0]), /décalage/);
});
