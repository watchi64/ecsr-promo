import test from "node:test";
import assert from "node:assert/strict";
import { fournisseursDisponibles, planTentatives, appelLLM } from "../supabase/functions/chatbot/providers.mjs";

function envDe(objet) { return (cle) => objet[cle]; }

test("fournisseursDisponibles : Mistral seul, la cle Gemini est ignoree (conditions du 04/10)", () => {
  const les2 = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" }));
  assert.deepEqual(les2.map((f) => f.nom), ["mistral"]);
  assert.equal(les2[0].modele, "mistral-small-latest");
  assert.ok(les2.every((f) => !/google/.test(f.url)), "aucun appel vers Google");

  assert.deepEqual(fournisseursDisponibles(envDe({ GEMINI_API_KEY: "g" })), []);
  assert.deepEqual(fournisseursDisponibles(envDe({})), []);
});

test("les modeles se surchargent par variable d'environnement", () => {
  const [m] = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-medium-latest" }));
  assert.equal(m.modele, "mistral-medium-latest");
  const [s] = fournisseursDisponibles(envDe({ SCW_SECRET_KEY: "s", SCALEWAY_MODEL: "mistral-small-3.2-24b-instruct-2506" }));
  assert.equal(s.modele, "mistral-small-3.2-24b-instruct-2506");
});

test("fournisseursDisponibles : Scaleway (Paris) d'abord, Mistral ensuite, jamais hors Europe", () => {
  const fs = fournisseursDisponibles(envDe({ SCW_SECRET_KEY: "s", MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" }));
  assert.deepEqual(fs.map((f) => f.nom), ["scaleway", "mistral"]);
  assert.equal(fs[0].url, "https://api.scaleway.ai/v1/chat/completions");
  assert.equal(fs[0].cle, "s");
  assert.equal(fs[0].modele, "mistral-medium-3.5-128b");
  assert.deepEqual(fournisseursDisponibles(envDe({ SCW_SECRET_KEY: "s" })).map((f) => f.nom), ["scaleway"]);
});

test("planTentatives : une relance par fournisseur, dans l'ordre", () => {
  const fs = fournisseursDisponibles(envDe({ MISTRAL_API_KEY: "m", GEMINI_API_KEY: "g" }));
  assert.deepEqual(planTentatives(fs).map((f) => f.nom), ["mistral", "mistral"]);
  const deux = fournisseursDisponibles(envDe({ SCW_SECRET_KEY: "s", MISTRAL_API_KEY: "m" }));
  assert.deepEqual(planTentatives(deux).map((f) => f.nom), ["scaleway", "scaleway", "mistral", "mistral"]);
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
