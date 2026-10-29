import test from "node:test";
import assert from "node:assert/strict";

// Le journal s'installe à l'import sur `window` et sur console.error : une fausse fenêtre, et une console
// muette pour que la sortie des tests reste lisible (l'enveloppe appelle toujours l'original).
globalThis.window = new EventTarget();
console.error = () => {};
const { dernieresErreurs } = await import("../js/journal-erreurs.js");

const evenement = (type, champs) => Object.assign(new Event(type), champs);

test("une erreur non rattrapée est notée avec son fichier et sa ligne", () => {
  window.dispatchEvent(evenement("error", { message: "boum", filename: "https://x/js/planning.js?v=1", lineno: 12 }));
  const e = dernieresErreurs().at(-1);
  assert.equal(e.type, "erreur");
  assert.equal(e.message, "boum");
  assert.equal(e.source, "planning.js:12");
  assert.match(e.a, /^\d\d:\d\d:\d\d$/);
});

test("une promesse rejetée est notée", () => {
  window.dispatchEvent(evenement("unhandledrejection", { reason: new Error("rejet") }));
  const e = dernieresErreurs().at(-1);
  assert.equal(e.type, "promesse");
  assert.equal(e.message, "rejet");
});

test("un message d'erreur écrit en console est noté", () => {
  console.error("chatbot:", new Error("x"));
  const e = dernieresErreurs().at(-1);
  assert.equal(e.type, "console");
  assert.equal(e.message, "chatbot: x");
});

test("cinq erreurs au plus, et une copie", () => {
  for (let i = 0; i < 8; i++) console.error("erreur " + i);
  const j = dernieresErreurs();
  assert.equal(j.length, 5);
  assert.equal(j.at(-1).message, "erreur 7");
  j.pop();
  assert.equal(dernieresErreurs().length, 5);
});
