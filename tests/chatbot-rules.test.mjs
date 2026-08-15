import test from "node:test";
import assert from "node:assert/strict";
import { fenetreMessages, pageDepuisHash, extraireEvenements } from "../js/chatbot-rules.js";

test("fenetreMessages garde les derniers messages et epure les champs", () => {
  const histo = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user", content: "m" + i, extra: true,
  }));
  const f = fenetreMessages(histo, 8);
  assert.equal(f.length, 8);
  assert.equal(f[0].content, "m4");
  assert.deepEqual(Object.keys(f[0]).sort(), ["content", "role"]);
});

test("pageDepuisHash extrait la route, defaut mon-suivi", () => {
  assert.equal(pageDepuisHash("#/planning"), "planning");
  assert.equal(pageDepuisHash(""), "mon-suivi");
  assert.equal(pageDepuisHash(undefined), "mon-suivi");
});

test("extraireEvenements decode nos evenements SSE malgre la fragmentation", () => {
  const un = extraireEvenements("", 'data: {"type":"delta","texte":"Bon"}\ndata: {"ty');
  assert.deepEqual(un.evenements, [{ type: "delta", texte: "Bon" }]);
  const deux = extraireEvenements(un.restant, 'pe":"fin"}\n\n');
  assert.deepEqual(deux.evenements, [{ type: "fin" }]);
});

test("extraireEvenements tolere les fins de ligne CRLF", () => {
  const r = extraireEvenements("", 'data: {"type":"fin"}\r\n\r\n');
  assert.deepEqual(r.evenements, [{ type: "fin" }]);
});
