// Les nombres écrits en français, une seule source (js/nombres.js) : le pluriel existait en quatorze copies sous trois
// noms (pluriel, nb, nombre), les pourcentages et les décimales en plusieurs.
import test from "node:test";
import assert from "node:assert/strict";
import { entier, pct, fr1, pluriel, dixieme, fr2 } from "../js/nombres.js";

const FINE = " ";   // espace insécable fine, séparateur des milliers en français
const INSECABLE = " ";

test("entier : séparateur des milliers français", () => {
  assert.equal(entier(7), "7");
  assert.equal(entier(1234), `1${FINE}234`);
  assert.equal(entier("12"), "12", "une chaîne de chiffres est lue comme un nombre");
});

test("pourcentage : arrondi, espace insécable avant le signe", () => {
  assert.equal(pct(0.734), `73${INSECABLE}%`);
  assert.equal(pct(1), `100${INSECABLE}%`);
  assert.equal(pct(0), `0${INSECABLE}%`);
});

test("une décimale, virgule française", () => {
  assert.equal(fr1(11.84), "11,8");
  assert.equal(fr1(12), "12,0");
});

test("pluriel : zéro et un au singulier, pluriel régulier ou donné", () => {
  assert.equal(pluriel(0, "note"), "0 note");
  assert.equal(pluriel(1, "note"), "1 note");
  assert.equal(pluriel(4, "note"), "4 notes");
  assert.equal(pluriel(2, "travail", "travaux"), "2 travaux");
  assert.equal(pluriel(1, "absent prévu", "absents prévus"), "1 absent prévu");
  assert.equal(pluriel(3, "absent prévu", "absents prévus"), "3 absents prévus");
  assert.equal(pluriel(1500, "heure"), `1${FINE}500 heures`, "les milliers séparés comme partout");
});

test("dixieme : une note au dixième, virgule, sans « ,0 » (chasse aux défauts du film, 11/11)", () => {
  assert.equal(dixieme(13.46), "13,5");
  assert.equal(dixieme(14), "14");
  assert.equal(dixieme("12.25"), "12,3", "une note lue en base comme texte");
  assert.equal(dixieme(0), "0");
});

test("fr2 : deux décimales, virgule (scores des grilles EPCF)", () => {
  assert.equal(fr2(1.256), "1,26");
  assert.equal(fr2(2), "2,00");
});
