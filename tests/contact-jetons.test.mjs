import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { nouveauJeton, hacherJeton, actionsDe, preparerJetons } from "../supabase/functions/contact-envois/jetons.mjs";

test("actions : aucune pour un stagiaire, voir seul pour un avis", () => {
  assert.deepEqual(actionsDe("prise", { stagiaire: true }, "absence"), []);
  assert.deepEqual(actionsDe("avis_absence", { stagiaire: false }, "absence"), ["voir"]);
  assert.ok(actionsDe("nouvelle", { stagiaire: false }, "retard").includes("prise"));
  assert.ok(actionsDe("nouvelle", { stagiaire: false }, "absence").includes("justificatif"));
  assert.ok(!actionsDe("nouvelle", { stagiaire: false }, "retard").includes("justificatif"));
});

test("actions : nouvelle et réponse à l'équipe ; annulations : voir ; prise impossible : pas de bouton de prise", () => {
  assert.deepEqual(actionsDe("nouvelle", { stagiaire: false }, "retard"), ["voir", "prise", "reponse"]);
  assert.deepEqual(actionsDe("reponse", { stagiaire: false }, "autre"), ["voir", "prise", "reponse"]);
  assert.deepEqual(actionsDe("annulation", { stagiaire: false }, "retard"), ["voir"]);
  assert.deepEqual(actionsDe("annulation_absence", { stagiaire: false }, "absence"), ["voir"]);
  assert.deepEqual(actionsDe("reponse", { stagiaire: false, peut_prendre: false }, null), ["voir", "reponse"]);
});

test("le jeton fait 43 caractères base64url et son haché 64 hex", async () => {
  const j = nouveauJeton((n) => new Uint8Array(n).fill(255));
  assert.match(j, /^[A-Za-z0-9_-]{43}$/);
  assert.match(await hacherJeton(globalThis.crypto.subtle, j), /^[0-9a-f]{64}$/);
});

test("le haché est le sha256 du jeton (celui que la base compare)", async () => {
  const j = nouveauJeton((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
  assert.equal(await hacherJeton(globalThis.crypto.subtle, j), createHash("sha256").update(j).digest("hex"));
  assert.notEqual(nouveauJeton((n) => new Uint8Array(n).fill(1)), nouveauJeton((n) => new Uint8Array(n).fill(2)));
});

test("preparerJetons : un jeton nu par action pour l'e-mail, son haché pour la base ; rien pour un stagiaire", async () => {
  let n = 0;
  const aleatoire = (k) => new Uint8Array(k).fill(++n);
  const item = { evenement: "nouvelle", demande: { type: "absence" }, destinataire: { stagiaire: false },
    reponses: [{ id: 4, libelle: "Absence enregistrée" }, { id: 5, libelle: "Bien reçu" }] };
  const { nus, haches } = await preparerJetons(item, aleatoire, globalThis.crypto.subtle);
  assert.deepEqual(haches.map((h) => [h.action, h.reponse_id ?? null]),
    [["voir", null], ["prise", null], ["reponse", 4], ["reponse", 5], ["justificatif", null]]);
  assert.deepEqual(nus.reponses.map((r) => r.libelle), ["Absence enregistrée", "Bien reçu"]);
  for (const [i, nu] of [nus.voir, nus.prise, nus.reponses[0].jeton, nus.reponses[1].jeton, nus.justificatif].entries()) {
    assert.match(nu, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(haches[i].hash, createHash("sha256").update(nu).digest("hex"));
  }
  const stag = await preparerJetons({ evenement: "prise", demande: { type: "absence" }, destinataire: { stagiaire: true }, reponses: [] },
    aleatoire, globalThis.crypto.subtle);
  assert.deepEqual(stag, { nus: {}, haches: [] });
});
