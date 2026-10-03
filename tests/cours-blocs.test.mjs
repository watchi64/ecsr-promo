import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserScene, analyserQuiz, analyserCartes, melangerSansIdentite, corrigerOrdre, corrigerChoix }
  from "../js/cours-blocs-rules.js";

// Un bloc refusé dit toujours pourquoi : l'éditeur affiche ce message tel quel.
// La fonction renvoie le message, pour que le test puisse aussi en contrôler la cause.
function refus(r) {
  assert.equal(r.ok, false, "le bloc doit être refusé");
  assert.equal(typeof r.erreur, "string", "erreur doit être une chaîne");
  assert.ok(r.erreur.trim().length > 0, "erreur ne doit pas être vide");
  return r.erreur;
}

test("analyserScene : code et étapes, numérotation retirée, lignes vides ignorées", () => {
  assert.deepEqual(analyserScene("tourner-droite", ["1. Contrôle et clignotant", "  Serrer à droite  ", "", "3) Tourner"]),
    { code: "tourner-droite", etapes: ["Contrôle et clignotant", "Serrer à droite", "Tourner"] });
  assert.deepEqual(analyserScene("  giratoire  autre ", []), { code: "giratoire", etapes: [] });
});

test("analyserScene : un décimal en tête de ligne n'est pas une numérotation", () => {
  assert.deepEqual(analyserScene("x", ["1.5 m du bord"]), { code: "x", etapes: ["1.5 m du bord"] });
  assert.deepEqual(analyserScene("x", ["10.5 m", "2,5 m", "0.3 s"]).etapes, ["10.5 m", "2,5 m", "0.3 s"]);
});

test("analyserScene : « 1. », « 2.Tourner » et « 3) » sont retirés, un numéro seul disparaît", () => {
  assert.deepEqual(analyserScene("x", ["1. Tourner", "2.Tourner", "3) Tourner", "10. Tourner"]).etapes,
    ["Tourner", "Tourner", "Tourner", "Tourner"]);
  assert.deepEqual(analyserScene("x", ["A", "3.", "B"]).etapes, ["A", "B"]);
});

test("quiz ordre : consigne facultative, éléments dans l'ordre juste", () => {
  const q = analyserQuiz("ordre", ["? Remets dans l'ordre", "A", "B", "C"]);
  assert.equal(q.ok, true);
  assert.equal(q.consigne, "Remets dans l'ordre");
  assert.deepEqual(q.elements, ["A", "B", "C"]);
  assert.equal(analyserQuiz("ordre", ["A", "B"]).consigne, "Remets les étapes dans l'ordre");
  assert.match(refus(analyserQuiz("ordre", ["A"])), /au moins deux/);
  assert.match(refus(analyserQuiz("ordre", ["A", "A"])), /identiques/);
  // Les bornes : huit éléments passent, neuf sont refusés pour cette seule raison.
  assert.match(refus(analyserQuiz("ordre", ["1", "2", "3", "4", "5", "6", "7", "8", "9"])), /huit/);
  const huit = analyserQuiz("ordre", ["1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.equal(huit.ok, true, huit.erreur);
  assert.equal(huit.elements.length, 8);
});

test("quiz ordre : la numérotation devant les éléments est retirée", () => {
  const q = analyserQuiz("ordre", ["1. A", "2. B"]);
  assert.equal(q.ok, true, q.erreur);
  assert.deepEqual(q.elements, ["A", "B"]);
  const r = analyserQuiz("ordre", ["? Consigne", "1. A", "2.B", "3) C"]);
  assert.equal(r.ok, true, r.erreur);
  assert.equal(r.consigne, "Consigne");
  assert.deepEqual(r.elements, ["A", "B", "C"]);
});

test("quiz ordre : un décimal n'est pas une numérotation", () => {
  const q = analyserQuiz("ordre", ["1.5 m", "2.5 m"]);
  assert.equal(q.ok, true, q.erreur);
  assert.deepEqual(q.elements, ["1.5 m", "2.5 m"]);
});

test("quiz ordre : un numéro seul ne fait pas un élément vide", () => {
  const q = analyserQuiz("ordre", ["A", "B", "3."]);
  assert.equal(q.ok, true, q.erreur);
  assert.deepEqual(q.elements, ["A", "B"]);
  assert.match(refus(analyserQuiz("ordre", ["A", "3."])), /au moins deux/);
});

test("quiz vrai-faux : affirmation | vrai ou faux | explication", () => {
  const q = analyserQuiz("vrai-faux", ["Le ciel est bleu. | vrai | Par beau temps.", "Deux et deux font cinq. | FAUX"]);
  assert.equal(q.ok, true);
  assert.deepEqual(q.items, [
    { affirmation: "Le ciel est bleu.", vrai: true, explication: "Par beau temps." },
    { affirmation: "Deux et deux font cinq.", vrai: false, explication: "" },
  ]);
  refus(analyserQuiz("vrai-faux", ["Sans réponse"]));
  refus(analyserQuiz("vrai-faux", ["Affirmation | peut-être"]));
  refus(analyserQuiz("vrai-faux", []));
});

test("quiz vrai-faux : une barre dans l'explication est conservée", () => {
  const q = analyserQuiz("vrai-faux", ["Affirmation | faux | Cas 1 | cas 2 | cas 3"]);
  assert.equal(q.ok, true, q.erreur);
  assert.deepEqual(q.items, [{ affirmation: "Affirmation", vrai: false, explication: "Cas 1 | cas 2 | cas 3" }]);
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
  assert.match(refus(analyserQuiz("choix", ["? Q", "- a", "- b"])), /bonne réponse/);
  assert.match(refus(analyserQuiz("choix", ["- a", "- [x] b"])), /rattachée à aucune question/);
  assert.match(refus(analyserQuiz("choix", ["? Q", "- [x] a"])), /moins de deux options/);
  assert.match(refus(analyserQuiz("choix", ["? Q", "- [x] a", "- b", "texte libre"])), /non reconnue/);
  assert.match(refus(analyserQuiz("choix", [])), /aucune question/);
});

test("quiz choix : « - [ ] » est une fausse explicite, seule la case x ou X est juste", () => {
  const q = analyserQuiz("choix", ["? Q", "- [ ] faux", "- [x] vrai", "- [X] vrai", "- sans crochets"]);
  assert.equal(q.ok, true, q.erreur);
  assert.deepEqual(q.questions[0].options, [
    { texte: "faux", juste: false },
    { texte: "vrai", juste: true },
    { texte: "vrai", juste: true },
    { texte: "sans crochets", juste: false },
  ]);
  // Des « [ ] » partout : toujours pas de bonne réponse.
  assert.match(refus(analyserQuiz("choix", ["? Q", "- [ ] a", "- [ ] b"])), /bonne réponse/);
});

test("quiz choix : une explication sur deux lignes « > » est jointe par une espace", () => {
  const q = analyserQuiz("choix", ["? Q", "- [x] a", "- b", "> Première phrase.", ">  Seconde phrase."]);
  assert.equal(q.ok, true, q.erreur);
  assert.equal(q.questions[0].explication, "Première phrase. Seconde phrase.");
});

test("quiz choix : une ligne vide termine la question en cours", () => {
  const orpheline = /rattachée à aucune question/;
  // Options séparées de leur question par une ligne vide : le message cite la ligne et la cause.
  const message = refus(analyserQuiz("choix", ["? Q", "", "- [x] a", "- b"]));
  assert.match(message, orpheline);
  assert.match(message, /« - \[x\] a »/);
  assert.match(message, /une ligne vide termine la question en cours/);
  // Ligne vide au milieu des options.
  assert.match(refus(analyserQuiz("choix", ["? Q", "- [x] a", "", "- b"])), orpheline);
  // Explication séparée de ses options.
  assert.match(refus(analyserQuiz("choix", ["? Q", "- [x] a", "- b", "", "> Parce que."])), orpheline);
});

test("forme de quiz inconnue", () => {
  refus(analyserQuiz("devinette", ["x"]));
  refus(analyserQuiz(undefined, ["x"]));
});

test("cartes : paires Q puis R", () => {
  const c = analyserCartes(["Q : Un ?", "R : Une.", "", "Q: Deux ?", "R: Deux."]);
  assert.equal(c.ok, true);
  assert.deepEqual(c.cartes, [{ q: "Un ?", r: "Une." }, { q: "Deux ?", r: "Deux." }]);
  refus(analyserCartes(["Q : seule"]));
  refus(analyserCartes(["R : orpheline"]));
  refus(analyserCartes(["Q : un", "Q : deux", "R : r"]));
  refus(analyserCartes(["texte libre"]));
  refus(analyserCartes([]));
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
