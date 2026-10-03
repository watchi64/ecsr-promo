import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserScene, analyserQuiz, analyserCartes, melangerSansIdentite, corrigerOrdre, corrigerChoix }
  from "../js/cours-blocs-rules.js";

test("analyserScene : code et étapes, numérotation retirée, lignes vides ignorées", () => {
  assert.deepEqual(analyserScene("tourner-droite", ["1. Contrôle et clignotant", "  Serrer à droite  ", "", "3) Tourner"]),
    { code: "tourner-droite", etapes: ["Contrôle et clignotant", "Serrer à droite", "Tourner"] });
  assert.deepEqual(analyserScene("  giratoire  autre ", []), { code: "giratoire", etapes: [] });
});

test("quiz ordre : consigne facultative, éléments dans l'ordre juste", () => {
  const q = analyserQuiz("ordre", ["? Remets dans l'ordre", "A", "B", "C"]);
  assert.equal(q.ok, true);
  assert.equal(q.consigne, "Remets dans l'ordre");
  assert.deepEqual(q.elements, ["A", "B", "C"]);
  assert.equal(analyserQuiz("ordre", ["A", "B"]).consigne, "Remets les étapes dans l'ordre");
  assert.equal(analyserQuiz("ordre", ["A"]).ok, false);
  assert.equal(analyserQuiz("ordre", ["A", "A"]).ok, false);
  assert.equal(analyserQuiz("ordre", ["1", "2", "3", "4", "5", "6", "7", "8", "9"]).ok, false);
});

test("quiz vrai-faux : affirmation | vrai ou faux | explication", () => {
  const q = analyserQuiz("vrai-faux", ["Le ciel est bleu. | vrai | Par beau temps.", "Deux et deux font cinq. | FAUX"]);
  assert.equal(q.ok, true);
  assert.deepEqual(q.items, [
    { affirmation: "Le ciel est bleu.", vrai: true, explication: "Par beau temps." },
    { affirmation: "Deux et deux font cinq.", vrai: false, explication: "" },
  ]);
  assert.equal(analyserQuiz("vrai-faux", ["Sans réponse"]).ok, false);
  assert.equal(analyserQuiz("vrai-faux", ["Affirmation | peut-être"]).ok, false);
  assert.equal(analyserQuiz("vrai-faux", []).ok, false);
});

test("quiz choix : questions, options, bonnes réponses, explication", () => {
  const q = analyserQuiz("choix", ["? Première ?", "- non", "- [x] oui", "> Parce que.", "", "? Seconde ?", "- [x] a", "- [X] b", "- c"]);
  assert.equal(q.ok, true);
  assert.equal(q.questions.length, 2);
  assert.deepEqual(q.questions[0], {
    question: "Première ?",
    options: [{ texte: "non", juste: false }, { texte: "oui", juste: true }],
    explication: "Parce que.",
  });
  assert.deepEqual(q.questions[1].options.map((o) => o.juste), [true, true, false]);
  assert.equal(analyserQuiz("choix", ["? Q", "- a", "- b"]).ok, false);
  assert.equal(analyserQuiz("choix", ["- a", "- [x] b"]).ok, false);
  assert.equal(analyserQuiz("choix", ["? Q", "- [x] a"]).ok, false);
  assert.equal(analyserQuiz("choix", ["? Q", "- [x] a", "- b", "texte libre"]).ok, false);
});

test("forme de quiz inconnue", () => {
  assert.equal(analyserQuiz("devinette", ["x"]).ok, false);
});

test("cartes : paires Q puis R", () => {
  const c = analyserCartes(["Q : Un ?", "R : Une.", "", "Q: Deux ?", "R: Deux."]);
  assert.equal(c.ok, true);
  assert.deepEqual(c.cartes, [{ q: "Un ?", r: "Une." }, { q: "Deux ?", r: "Deux." }]);
  assert.equal(analyserCartes(["Q : seule"]).ok, false);
  assert.equal(analyserCartes(["R : orpheline"]).ok, false);
  assert.equal(analyserCartes(["Q : un", "Q : deux", "R : r"]).ok, false);
  assert.equal(analyserCartes(["texte libre"]).ok, false);
  assert.equal(analyserCartes([]).ok, false);
});

test("melangerSansIdentite : permutation stable, jamais l'ordre juste", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    const elements = Array.from({ length: n }, (_, i) => "étape " + i);
    const p = melangerSansIdentite(elements);
    assert.deepEqual([...p].sort((a, b) => a - b), elements.map((_, i) => i), "permutation");
    assert.ok(p.some((v, i) => v !== i), "jamais l'identité (n = " + n + ")");
    assert.deepEqual(melangerSansIdentite(elements), p, "déterministe");
  }
});

test("corrigerOrdre et corrigerChoix", () => {
  assert.deepEqual(corrigerOrdre(["A", "C", "B"], ["A", "B", "C"]),
    { justes: 1, total: 3, parPosition: [true, false, false] });
  const q = { options: [{ juste: true }, { juste: false }, { juste: true }] };
  assert.equal(corrigerChoix(q, new Set([0, 2])), true);
  assert.equal(corrigerChoix(q, new Set([0])), false);
  assert.equal(corrigerChoix(q, new Set([0, 1, 2])), false);
});
