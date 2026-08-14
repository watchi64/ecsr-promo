import test from "node:test";
import assert from "node:assert/strict";
import { extraireLignesSSE, nouvelEtat, accumulerChunk } from "../supabase/functions/chatbot/sse.mjs";

test("extraireLignesSSE gere une ligne coupee entre deux morceaux", () => {
  const un = extraireLignesSSE("", 'data: {"a":1}\ndata: {"b"');
  assert.deepEqual(un.datas, ['{"a":1}']);
  const deux = extraireLignesSSE(un.restant, ':2}\n\ndata: [DONE]\n');
  assert.deepEqual(deux.datas, ['{"b":2}']);
  assert.equal(deux.restant, "");
});

test("extraireLignesSSE tolere les fins de ligne CRLF", () => {
  const r = extraireLignesSSE("", 'data: {"a":1}\r\ndata: [DONE]\r\n');
  assert.deepEqual(r.datas, ['{"a":1}']);
});

test("accumulerChunk agrege texte, tool_calls fragmentes et fin", () => {
  const etat = nouvelEtat();
  assert.equal(accumulerChunk(etat, { choices: [{ delta: { content: "Bon" } }] }), "Bon");
  assert.equal(accumulerChunk(etat, { choices: [{ delta: { content: "jour" } }] }), "jour");
  accumulerChunk(etat, { choices: [{ delta: { tool_calls: [
    { index: 0, id: "call_1", function: { name: "chercher_dans_les_cours", arguments: '{"quest' } },
  ] } }] });
  accumulerChunk(etat, { choices: [{ delta: { tool_calls: [
    { index: 0, function: { arguments: 'ion":"feux"}' } },
  ] } }, ] });
  accumulerChunk(etat, { choices: [{ delta: {}, finish_reason: "tool_calls" }] });
  assert.equal(etat.contenu, "Bonjour");
  assert.equal(etat.finRaison, "tool_calls");
  assert.equal(etat.toolCalls[0].id, "call_1");
  assert.equal(etat.toolCalls[0].function.name, "chercher_dans_les_cours");
  assert.deepEqual(JSON.parse(etat.toolCalls[0].function.arguments), { question: "feux" });
});

test("accumulerChunk ignore les chunks sans choix", () => {
  const etat = nouvelEtat();
  assert.equal(accumulerChunk(etat, {}), "");
  assert.equal(etat.contenu, "");
});
