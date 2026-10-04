import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserScene, analyserQuiz, analyserCartes, melangerSansIdentite, corrigerOrdre, corrigerChoix,
  BLOCS_INTERACTIFS, ouvertureBloc, lireBloc, erreurDirective, erreurNonRefermee,
  messageOrdre, messageVraiFaux, messageChoix }
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
  const q = analyserQuiz("ordre", ["? Remettre dans l'ordre", "A", "B", "C"]);
  assert.equal(q.ok, true);
  assert.equal(q.consigne, "Remettre dans l'ordre");
  assert.deepEqual(q.elements, ["A", "B", "C"]);
  // Les textes d'un cours sont à l'infinitif : la consigne par défaut aussi.
  assert.equal(analyserQuiz("ordre", ["A", "B"]).consigne, "Remettre les étapes dans l'ordre");
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

// ===== Lecture des blocs « ::: » du texte =====

test("BLOCS_INTERACTIFS : les trois blocs que rend js/cours-blocs.js", () => {
  assert.deepEqual(BLOCS_INTERACTIFS, ["scene", "quiz", "cartes"]);
});

test("ouvertureBloc : nom et argument d'une ligne d'ouverture, nom lu tel qu'écrit", () => {
  assert.deepEqual(ouvertureBloc(":::scene tourner-droite"), { nom: "scene", arg: "tourner-droite" });
  assert.deepEqual(ouvertureBloc("  :::quiz   ordre  "), { nom: "quiz", arg: "ordre" });
  assert.deepEqual(ouvertureBloc(":::cartes"), { nom: "cartes", arg: "" });
  // Une directive mal écrite est lue telle quelle : le lecteur la signale au lieu de l'ignorer.
  assert.deepEqual(ouvertureBloc(":::scène x"), { nom: "scène", arg: "x" });
  assert.deepEqual(ouvertureBloc(":::Quiz ordre"), { nom: "Quiz", arg: "ordre" });
  assert.deepEqual(ouvertureBloc(":::scenery"), { nom: "scenery", arg: "" });
});

test("ouvertureBloc : une ligne qui n'ouvre rien donne null", () => {
  for (const ligne of [":::", "  :::  ", "::: scene", "Texte", "", "- :::scene", "x :::quiz"]) {
    assert.equal(ouvertureBloc(ligne), null, JSON.stringify(ligne));
  }
});

test("lireBloc : le contenu va jusqu'à la ligne « ::: », la lecture reprend après elle", () => {
  const lignes = ["a", ":::quiz ordre", "A", "", "B", ":::", "après"];
  assert.deepEqual(lireBloc(lignes, 2), { contenu: ["A", "", "B"], suivante: 6, ferme: true });
  // Une fermeture indentée ou suivie d'espaces ferme aussi, comme pour les planches.
  assert.deepEqual(lireBloc(["A", "  :::  ", "B"], 0), { contenu: ["A"], suivante: 2, ferme: true });
  assert.deepEqual(lireBloc([":::cartes", ":::"], 1), { contenu: [], suivante: 2, ferme: true });
});

test("lireBloc : un bloc sans fermeture est signalé et va jusqu'à la fin du texte", () => {
  const lignes = ["Début.", ":::quiz ordre", "A", "B", "", "Fin du texte"];
  assert.deepEqual(lireBloc(lignes, 2), { contenu: ["A", "B", "", "Fin du texte"], suivante: 6, ferme: false });
  assert.deepEqual(lireBloc([":::quiz ordre"], 1), { contenu: [], suivante: 1, ferme: false });
});

test("erreurs de bloc : la directive inconnue et le bloc non refermé sont nommés", () => {
  assert.match(erreurDirective("scène"), /« :::scène » inconnue/);
  assert.match(erreurDirective("Quiz"), /scene, quiz, cartes, signaux ou marquage/);
  assert.match(erreurNonRefermee("quiz"), /« :::quiz » non refermé/);
  assert.match(erreurNonRefermee("quiz"), /« ::: »/);
});

// ===== Messages de correction : texte brut, lu par les lecteurs d'écran =====

test("messageOrdre : juste, ou nombre de places justes puis l'ordre juste numéroté", () => {
  assert.equal(messageOrdre(3, 3, ["A", "B", "C"]), "Juste : tout est dans l'ordre.");
  // Numéroté et séparé par « ; » : les intitulés des étapes contiennent des virgules.
  assert.equal(messageOrdre(1, 3, ["Contrôler et mettre le clignotant", "Serrer à droite, sans se coller au trottoir", "Tourner"]),
    "1 sur 3 à la bonne place. Ordre juste : 1. Contrôler et mettre le clignotant ; 2. Serrer à droite, sans se coller au trottoir ; 3. Tourner.");
  // Un élément qui finit par un point ne double pas le point final.
  assert.equal(messageOrdre(0, 2, ["A.", "B."]), "0 sur 2 à la bonne place. Ordre juste : 1. A. ; 2. B.");
});

test("messageVraiFaux : toutes justes, ou chaque affirmation fausse avec la bonne valeur et son explication", () => {
  const items = [
    { affirmation: "Le clignotant se met avant de serrer à droite.", vrai: true, explication: "On prévient, puis on se place." },
    { affirmation: "Le compteur se regarde en tournant", vrai: false, explication: "" },
    { affirmation: "Le piéton passe en premier ?", vrai: true, explication: "Il est engagé" },
  ];
  assert.equal(messageVraiFaux(items, new Map([[0, true], [1, false], [2, true]])), "3 sur 3 justes.");
  assert.equal(messageVraiFaux(items, new Map([[0, false], [1, false], [2, true]])),
    "2 sur 3 justes. À corriger : « Le clignotant se met avant de serrer à droite » est vrai. On prévient, puis on se place.");
  // Plusieurs erreurs : valeur juste de chacune ; l'explication reçoit un point final s'il manque.
  assert.equal(messageVraiFaux(items, new Map([[0, true], [1, true], [2, false]])),
    "1 sur 3 justes. À corriger : « Le compteur se regarde en tournant » est faux. « Le piéton passe en premier ? » est vrai. Il est engagé.");
});

test("messageVraiFaux : le texte brut est demandé par une fonction, le balisage ne passe pas", () => {
  const items = [{ affirmation: "On serre **à droite**.", vrai: false, explication: "Voir `R415-3`." }];
  const plat = (t) => t.replace(/\*\*|`/g, "");
  assert.equal(messageVraiFaux(items, new Map([[0, true]]), plat),
    "0 sur 1 justes. À corriger : « On serre à droite » est faux. Voir R415-3.");
});

test("messageChoix : bonne(s) réponse(s) de chaque question ratée, avec son explication", () => {
  const unique = { question: "Q", options: [{ texte: "a", juste: false }, { texte: "b", juste: true }], explication: "Parce que." };
  const multiple = { question: "Q", options: [{ texte: "a", juste: true }, { texte: "b", juste: true }, { texte: "c", juste: false }], explication: "" };
  // Une seule question : pas de numéro.
  assert.equal(messageChoix([unique], [new Set([0])]), "0 sur 1 justes. Bonne réponse : b. Parce que.");
  assert.equal(messageChoix([unique], [new Set([1])]), "1 sur 1 justes.");
  assert.equal(messageChoix([multiple], [new Set([0])]), "0 sur 1 justes. Bonnes réponses : a ; b.");
  // Plusieurs questions : seules les ratées sont détaillées, avec leur numéro.
  assert.equal(messageChoix([unique, multiple], [new Set([1]), new Set([0, 2])]),
    "1 sur 2 justes. Question 2, bonnes réponses : a ; b.");
  assert.equal(messageChoix([unique, multiple], [new Set([0]), new Set([0, 1])]),
    "1 sur 2 justes. Question 1, bonne réponse : b. Parce que.");
  assert.equal(messageChoix([unique, multiple], [new Set([1]), new Set([0, 1])]), "2 sur 2 justes.");
});

test("messageChoix : le texte brut est demandé par une fonction, le balisage ne passe pas", () => {
  const q = { question: "Q", options: [{ texte: "la **voie** de sortie", juste: true }, { texte: "x", juste: false }], explication: "Côté `trottoir`" };
  const plat = (t) => t.replace(/\*\*|`/g, "");
  assert.equal(messageChoix([q], [new Set([1])], plat), "0 sur 1 justes. Bonne réponse : la voie de sortie. Côté trottoir.");
});
