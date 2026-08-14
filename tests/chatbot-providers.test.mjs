import test from "node:test";
import assert from "node:assert/strict";
import { fournisseursDisponibles, planTentatives, appelLLM } from "../supabase/functions/chatbot/providers.mjs";

function envDe(objet) { return (cle) => objet[cle]; }

test("fournisseursDisponibles ne garde que les cles presentes, Mistral d'abord", () => {
  const les2 = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" }));
  assert.deepEqual(les2.map((f) => f.nom), ["mistral", "gemini"]);
  assert.equal(les2[0].modele, "mistral-small-latest");
  assert.equal(les2[1].modele, "gemini-2.5-flash");

  const seul = fournisseursDisponibles(envDe({ GEMINI_API_KEY: "g" }));
  assert.deepEqual(seul.map((f) => f.nom), ["gemini"]);
  assert.deepEqual(fournisseursDisponibles(envDe({})), []);
});

test("les modeles se surchargent par variable d'environnement", () => {
  const [m] = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-medium-latest" }));
  assert.equal(m.modele, "mistral-medium-latest");
});

test("planTentatives double Mistral (retry) puis passe au suivant", () => {
  const fs = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" }));
  assert.deepEqual(planTentatives(fs).map((f) => f.nom), ["mistral", "mistral", "gemini"]);
});

function reponseFlux(lignes) {
  const enc = new TextEncoder();
  const corps = new ReadableStream({
    start(c) {
      for (const l of lignes) c.enqueue(enc.encode(l));
      c.close();
    },
  });
  return new Response(corps, { status: 200 });
}

const DEUX_FOURNISSEURS = [
  { nom: "mistral", url: "https://mistral.test", cle: "m", modele: "m1" },
  { nom: "gemini", url: "https://gemini.test", cle: "g", modele: "g1" },
];

test("appelLLM bascule sur le suivant si l'echec precede tout texte", async () => {
  const appels = [];
  const fetchReel = globalThis.fetch;
  globalThis.fetch = async (url) => {
    appels.push(String(url));
    if (String(url).startsWith("https://mistral.test")) return new Response("boom", { status: 500 });
    return reponseFlux(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', "data: [DONE]\n\n"]);
  };
  try {
    const deltas = [];
    const etat = await appelLLM({ fournisseurs: DEUX_FOURNISSEURS, corps: { messages: [] }, surTexte: (x) => deltas.push(x) });
    assert.equal(etat.contenu, "ok");
    assert.deepEqual(deltas, ["ok"]);
    assert.equal(appels.length, 3);
  } finally {
    globalThis.fetch = fetchReel;
  }
});

test("appelLLM ne rejoue pas apres du texte deja streame : l'erreur remonte", async () => {
  const appels = [];
  const fetchReel = globalThis.fetch;
  globalThis.fetch = async (url) => {
    appels.push(String(url));
    if (String(url).startsWith("https://mistral.test")) {
      const enc = new TextEncoder();
      // pull : le premier read() livre le chunk, le second rejette. Avec
      // start(), c.error() ecrase le chunk enfile avant toute lecture et
      // aucun texte ne serait streame (constate sous Node 24).
      let tour = 0;
      const corps = new ReadableStream({
        pull(c) {
          tour += 1;
          if (tour === 1) c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"debut"}}]}\n\n'));
          else c.error(new Error("coupure reseau"));
        },
      });
      return new Response(corps, { status: 200 });
    }
    return reponseFlux(['data: {"choices":[{"delta":{"content":"jamais"}}]}\n\n']);
  };
  try {
    const deltas = [];
    await assert.rejects(
      appelLLM({ fournisseurs: DEUX_FOURNISSEURS, corps: { messages: [] }, surTexte: (x) => deltas.push(x) }),
    );
    assert.deepEqual(deltas, ["debut"]);
    assert.equal(appels.length, 1);
  } finally {
    globalThis.fetch = fetchReel;
  }
});
