import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { etapeA, actionVisibilite, facteurLecture, SEUIL_DEMARRAGE, SEUILS_VISIBILITE } from "../js/lecteur-anime-regles.js";
import * as rendu from "../js/scene-rendu.js";

// scene-rendu.js importe le module des règles sous le jeton de cache de l'app (?v=…) : pour Node, c'est une autre instance que
// celle importée ci-dessus sans jeton. Les références réexportées se comparent donc à l'instance que voit scene-rendu.js, chargée
// sous le même jeton (celui d'index.html, que le hook de cache change à chaque version).
const jeton = readFileSync(new URL("../index.html", import.meta.url), "utf8").match(/\?v=([0-9a-z]+)/)[1];
const vuParLeRendu = await import(`../js/lecteur-anime-regles.js?v=${jeton}`);

test("etapeA : la dernière étape dont le début est atteint, 0 avant la première", () => {
  const etapes = [{ t: 0 }, { t: 1.5 }, { t: 3 }];
  assert.equal(etapeA(etapes, 0), 0);
  assert.equal(etapeA(etapes, 1.4999), 0);
  assert.equal(etapeA(etapes, 1.5), 1);
  assert.equal(etapeA(etapes, 2.9999999999), 2);   // tolérance de 1e-9 sur le début
  assert.equal(etapeA(etapes, 99), 2);
});

test("visibilité et facteur : mêmes règles qu'avant, toujours réexportées par scene-rendu.js", () => {
  assert.equal(SEUIL_DEMARRAGE, 0.6);
  assert.deepEqual(SEUILS_VISIBILITE, [0, 0.6]);
  assert.equal(actionVisibilite(0.6, false, false), "demarrer");
  assert.equal(actionVisibilite(0, true, true), "pause");
  assert.equal(actionVisibilite(0.3, true, false), null);
  assert.equal(facteurLecture(1), null);
  assert.deepEqual(facteurLecture(0.5), { texte: "× 0,5", libelle: "Lecture ralentie : 0,5 fois la vitesse réelle" });
  assert.equal(rendu.actionVisibilite, vuParLeRendu.actionVisibilite);
  assert.equal(rendu.facteurLecture, vuParLeRendu.facteurLecture);
  assert.equal(rendu.SEUIL_DEMARRAGE, SEUIL_DEMARRAGE);
  assert.deepEqual(rendu.SEUILS_VISIBILITE, SEUILS_VISIBILITE);
});
