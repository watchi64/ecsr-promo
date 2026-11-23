import assert from "node:assert/strict";
import { EPCF_TRAMES, EPCF_TRAME_KEYS, EPCF_PHASE_COLORS, EPCF_PHASE_TEXTE } from "../js/epcf-trames.js";
import { EPREUVES_EPCF } from "../js/fiche-rules.js";

// Grille EPCF du CCP2 (23/11/2026) : les critères de performance des compétences 8 à 11 du REAC TP-01303.
const t = EPCF_TRAMES.ccp2;
assert.deepEqual(EPCF_TRAME_KEYS, ["salle", "vehicule", "ccp2"]);
assert.deepEqual(EPREUVES_EPCF, EPCF_TRAME_KEYS, "la fiche compte les mêmes épreuves que les grilles");
assert.equal(t.version, 1);
assert.deepEqual(t.competences, ["C8", "C9", "C10", "C11"]);
assert.deepEqual(t.sections.map((s) => [s.code, s.criteres.length]), [["DEM", 5], ["CONS", 5], ["SENS", 6], ["PRAT", 7]]);
assert.deepEqual(t.sections.map((s) => s.competenceTP.split(".")[0]), ["8", "9", "10", "11"]);

// Codes uniques dans la grille, préfixés par leur section.
const codes = t.sections.flatMap((s) => s.criteres.map((c) => c.code));
assert.equal(new Set(codes).size, codes.length);
t.sections.forEach((s) => s.criteres.forEach((c, i) => assert.equal(c.code, s.code + (i + 1))));

// Chaque section a sa teinte et sa teinte de texte, et ne reprend pas le code d'une section du CCP1.
const ccp1 = new Set(["salle", "vehicule"].flatMap((k) => EPCF_TRAMES[k].sections.map((s) => s.code)));
t.sections.forEach((s) => {
  assert.ok(EPCF_PHASE_COLORS[s.code] && EPCF_PHASE_TEXTE[s.code], "teintes de " + s.code);
  assert.ok(!ccp1.has(s.code), s.code + " existe déjà au CCP1");
});

// Teinte de texte lisible (AA, 4,5:1) sur blanc, comme celles du CCP1.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
t.sections.forEach((s) => {
  const ratio = 1.05 / (lum(EPCF_PHASE_TEXTE[s.code]) + 0.05);
  assert.ok(ratio >= 4.5, `${s.code} : contraste ${ratio.toFixed(2)}`);
});

// Pas de tiret cadratin dans les libellés.
assert.ok(!JSON.stringify(t).includes("\u2014"));
console.log("epcf-ccp2 : OK");
