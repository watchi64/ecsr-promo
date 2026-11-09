import test from "node:test";
import assert from "node:assert/strict";
import { fenetreMessages, pageDepuisHash, extraireEvenements, corpsRequete } from "../js/chatbot-rules.js";

test("corpsRequete : la fenêtre, la page et la barre que voit la personne", () => {
  const histo = [{ role: "user", content: "Où est le calendrier ?", extra: true }];
  assert.deepEqual(corpsRequete(histo, "#/stagiaires/12", true), {
    messages: [{ role: "user", content: "Où est le calendrier ?" }], page: "stagiaires", navigation: "nouvelle",
  });
  assert.equal(corpsRequete(histo, "#/planning", false).navigation, "ancienne");
});

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

test("pageDepuisHash ne garde que la page, sans fiche ni partie", () => {
  assert.equal(pageDepuisHash("#/stagiaires/12/epcf"), "stagiaires");
  assert.equal(pageDepuisHash("#/mon-suivi/dp"), "mon-suivi");
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

test("corpsRequete : l'espace accompagne la requête, la direction et le siège ont toujours la nouvelle barre (D4)", () => {
  const histo = [{ role: "user", content: "Où sont mes promos ?" }];
  assert.deepEqual(corpsRequete(histo, "#/promos", false, "direction"), {
    messages: [{ role: "user", content: "Où sont mes promos ?" }], page: "promos", navigation: "nouvelle", espace: "direction",
  });
  assert.equal(corpsRequete(histo, "#/reseau", false, "siege").navigation, "nouvelle");
  assert.equal(corpsRequete(histo, "#/reseau", false, "siege").espace, "siege");
  // Formateur et stagiaire : la barre vient de la navigation, l'espace est joint.
  assert.equal(corpsRequete(histo, "#/home", false, "equipe").navigation, "ancienne");
  assert.equal(corpsRequete(histo, "#/home", true, "equipe").navigation, "nouvelle");
  assert.equal(corpsRequete(histo, "#/home", true, "stagiaire").espace, "stagiaire");
  // Un espace absent ou inconnu n'est pas envoyé : le corps est celui d'avant.
  for (const v of [undefined, null, "", "Direction", "admin", 3, {}]) {
    assert.ok(!("espace" in corpsRequete(histo, "#/home", true, v)), JSON.stringify(v));
  }
  assert.deepEqual(Object.keys(corpsRequete(histo, "#/home", true)).sort(), ["messages", "navigation", "page"]);
});
