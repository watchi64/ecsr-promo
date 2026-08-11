import { test } from "node:test";
import assert from "node:assert/strict";
import { titreDepuisMarkdown, tempsLecture, insererSyntaxe, cheminImage, interpolerAncres }
  from "../js/cours-rules.js";

test("titreDepuisMarkdown retire le préfixe THÈME XX", () => {
  assert.equal(titreDepuisMarkdown("# THÈME 12 - La vitesse\n\ntexte"), "La vitesse");
  assert.equal(titreDepuisMarkdown("# THEME 3 : Croisements"), "Croisements");
  assert.equal(titreDepuisMarkdown("pas de titre"), null);
});

test("tempsLecture arrondit et plancher à 1", () => {
  assert.equal(tempsLecture("mot"), 1);
  assert.equal(tempsLecture(Array(400).fill("mot").join(" ")), 2);
});

test("insererSyntaxe enrobe la sélection", () => {
  const r = insererSyntaxe("un mot ici", 3, 6, "**", "**", "texte");
  assert.equal(r.texte, "un **mot** ici");
  assert.equal(r.texte.slice(r.debutSel, r.finSel), "mot");
});

test("insererSyntaxe insère le défaut sans sélection", () => {
  const r = insererSyntaxe("ab", 1, 1, "**", "**", "gras");
  assert.equal(r.texte, "a**gras**b");
  assert.equal(r.texte.slice(r.debutSel, r.finSel), "gras");
});

test("cheminImage nettoie le nom et pose le préfixe du thème", () => {
  assert.equal(
    cheminImage(7, "Photo Vacances.PNG", "1723100000000"),
    "theme_07/1723100000000_photo-vacances.jpg");
  assert.equal(cheminImage(43, "???.jpg", "1"), "theme_43/1_image.jpg");
});

test("interpolerAncres suit les segments et borne aux extrémités", () => {
  const src = [0, 100, 300];
  const dst = [0, 50, 250];
  assert.equal(interpolerAncres(src, dst, 0), 0);
  assert.equal(interpolerAncres(src, dst, 100), 50);
  assert.equal(interpolerAncres(src, dst, 50), 25);       // milieu du 1er segment
  assert.equal(interpolerAncres(src, dst, 200), 150);     // milieu du 2e segment
  assert.equal(interpolerAncres(src, dst, -10), 0);       // avant la première ancre
  assert.equal(interpolerAncres(src, dst, 999), 250);     // après la dernière
});

test("interpolerAncres rend y tel quel si les ancres sont inutilisables", () => {
  assert.equal(interpolerAncres([], [], 42), 42);
  assert.equal(interpolerAncres([0, 10], [0], 42), 42);
});
