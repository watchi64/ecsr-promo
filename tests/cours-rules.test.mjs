import { test } from "node:test";
import assert from "node:assert/strict";
import { titreDepuisMarkdown, tempsLecture, insererSyntaxe, cheminImage }
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
