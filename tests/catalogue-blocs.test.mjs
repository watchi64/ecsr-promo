import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOGUE, entreeBloc, MODULES_BLOCS } from "../js/catalogue-blocs.js";
import { SCENES } from "../js/scenes.js";
import { SOURCES_SCENES } from "../sources/scenes.js";

const TIRET_CADRATIN = String.fromCharCode(0x2014);

test("chaque entrée du catalogue est complète et bien formée", () => {
  for (const [code, e] of Object.entries(CATALOGUE)) {
    assert.match(code, /^[a-z0-9]+(-[a-z0-9]+)*$/, code);
    assert.ok(["scene", "dessin"].includes(e.bloc), code);
    assert.ok(MODULES_BLOCS.includes(e.module), `${code} : module ${e.module}`);
    assert.ok(e.titre && !e.titre.includes(TIRET_CADRATIN), code);
    if (e.bloc === "scene") assert.ok(Array.isArray(e.etapesModele) && e.etapesModele.length >= 2, code);
    else assert.ok(typeof e.legendeModele === "string" && e.legendeModele.length > 0, code);
    if (e.module !== "route") assert.ok(Array.isArray(e.cadre) && e.cadre[0] === 320 && e.cadre[1] >= 150, `${code} : cadre`);
    for (const texte of [e.titre, e.legendeModele || "", ...(e.etapesModele || [])]) assert.ok(!texte.includes(TIRET_CADRATIN), code);
  }
});

test("les scènes de route du registre sont exactement celles du catalogue, mêmes titres et étapes", () => {
  const route = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "route").sort();
  assert.deepEqual(Object.keys(SCENES).sort(), route);
  for (const code of route) {
    assert.equal(SCENES[code].titre, CATALOGUE[code].titre);
    assert.deepEqual(SCENES[code].etapesModele, CATALOGUE[code].etapesModele);
    assert.equal(SCENES[code].construire().etapes.length, CATALOGUE[code].etapesModele.length, code);
    assert.equal(SCENES[code].construire().titre, CATALOGUE[code].titre, `${code} : l'intitulé lu par les lecteurs d'écran`);
    assert.ok(Array.isArray(SOURCES_SCENES[code]) && SOURCES_SCENES[code].length >= 3, `${code} : sources`);
  }
});

test("js/scenes.js ne porte aucun titre en toutes lettres : le catalogue est la seule source des titres", () => {
  assert.deepEqual(readFileSync("js/scenes.js", "utf8").match(/\btitre:\s*"[^"]*"/g) || [], []);
});

test("entreeBloc ne prend que les codes propres au catalogue", () => {
  assert.equal(entreeBloc("constructor"), null);
  assert.equal(entreeBloc("toString"), null);
  assert.equal(entreeBloc("inconnu"), null);
  assert.equal(entreeBloc("mains-volant").module, "poste");
});

test("les 24 codes du lot D1 sont au catalogue, dans leur module", () => {
  const attendus = {
    poste: ["poste-commandes", "pedales", "mains-volant", "tirer-glisser", "chevauchement", "retour-volant"],
    voyants: ["voyants", "autotest"],
    conducteur: ["siege", "appuie-tete", "ceinture", "installation"],
    entretien: ["capot", "niveaux", "pneu", "pression"],
    visibilite: ["zones-invisibles", "retroviseurs", "angles-morts"],
    dessus: ["tour-vehicule", "roues-trottoir", "sous-survirage", "regard-loin"],
    route: ["sortie-portiere"],
  };
  for (const [module, codes] of Object.entries(attendus)) {
    for (const code of codes) assert.equal(entreeBloc(code)?.module, module, code);
  }
  const animes = Object.values(attendus).flat().filter((c) => CATALOGUE[c].bloc === "scene");
  assert.equal(Object.values(attendus).flat().length, 24);
  assert.equal(animes.length, 6);
});

// Complétude : chaque code du catalogue est fourni par son module, du genre que le catalogue annonce (un dessin fixe dans DESSINS,
// une animation dans GESTES, une scène de route dans SCENES), et chaque module ne fournit que des codes que le catalogue lui donne.
// Un code au catalogue sans dessin serait un bloc « pas encore disponible » dans un cours ; un dessin hors du catalogue, un dessin
// qu'aucun cours ne peut appeler. Titre et cadre du dessin rendu sont ceux du catalogue (le titre est lu par les lecteurs d'écran).
test("complétude : chaque code du catalogue est fourni par son module (DESSINS, GESTES ou SCENES) et réciproquement", async () => {
  const familles = MODULES_BLOCS.filter((m) => m !== "route");
  const fournis = {};
  for (const module of familles) {
    const f = await import(`../js/dessins-${module}.js`);
    assert.ok(f.DESSINS && typeof f.DESSINS === "object", `${module} : DESSINS exporté`);
    assert.equal(typeof f.versDom, "function", `${module} : versDom réexporté`);
    for (const [cle, genre] of [["DESSINS", "dessin"], ["GESTES", "scene"]]) {
      for (const code of Object.keys(f[cle] || {})) {
        assert.equal(fournis[code], undefined, `${code} : fourni deux fois`);
        fournis[code] = { module, genre, f };
      }
    }
  }
  for (const code of Object.keys(SCENES)) fournis[code] = { module: "route", genre: "scene" };
  for (const [code, e] of Object.entries(CATALOGUE)) {
    const p = fournis[code];
    assert.ok(p, `${code} : au catalogue, fourni par aucun module`);
    assert.equal(p.module, e.module, `${code} : fourni par ${p.module}, le catalogue dit ${e.module}`);
    assert.equal(p.genre, e.bloc, `${code} : ${p.genre === "dessin" ? "dans DESSINS" : "animé"}, le catalogue dit ${e.bloc}`);
    if (e.module === "route") continue;
    if (e.bloc === "dessin") {
      const d = p.f.DESSINS[code]();
      assert.equal(d.attributs.viewBox, `0 0 ${e.cadre[0]} ${e.cadre[1]}`, `${code} : cadre du catalogue`);
      assert.ok(String(d.attributs["aria-label"]).startsWith(`${e.titre}. `), `${code} : titre du catalogue, puis la description`);
    } else {
      const def = p.f.GESTES[code].construire();
      assert.equal(def.titre, e.titre, `${code} : titre du catalogue`);
      assert.deepEqual(def.cadre, e.cadre, `${code} : cadre du catalogue`);
    }
  }
  for (const code of Object.keys(fournis)) assert.ok(entreeBloc(code), `${code} : fourni par ${fournis[code].module}, absent du catalogue`);
});
