import test from "node:test";
import assert from "node:assert/strict";
import { creerVerrou, autoriserNumero, pousserDelta, viderVerrou } from "../supabase/functions/chatbot/verrou-articles.mjs";

function rejouer(texte, taille, verrou) {
  let sortie = "";
  for (let i = 0; i < texte.length; i += taille) {
    sortie += pousserDelta(verrou, texte.slice(i, i + taille));
  }
  return sortie + viderVerrou(verrou);
}

test("un numero non verifie est masque quel que soit le decoupage", () => {
  const phrase = "L'article applicable est le R412-6-1 du code de la route.";
  for (const taille of [1, 2, 3, 5, 7, 11, 13, 64]) {
    const s = rejouer(phrase, taille, creerVerrou());
    assert.ok(!s.includes("R412-6-1"), `fuite avec des deltas de ${taille}`);
    assert.ok(s.includes("[verification en cours]"), `masque absent avec ${taille}`);
  }
});

test("un numero verifie passe en clair, un autre reste masque", () => {
  const verrou = creerVerrou();
  autoriserNumero(verrou, "R412-6-1");
  const s = rejouer("Selon R412-6-1, mais aussi R416-15.", 3, verrou);
  assert.ok(s.includes("R412-6-1"));
  assert.ok(!s.includes("R416-15"));
});

test("pas de faux positif sur une plage d'annees", () => {
  const s = rejouer("bilan l 2024-2025 en hausse", 4, creerVerrou());
  assert.ok(s.includes("2024-2025"));
});

test("le texte sans motif traverse intact", () => {
  const phrase = "Les feux de croisement eclairent a 30 m minimum.";
  assert.equal(rejouer(phrase, 5, creerVerrou()), phrase);
});
