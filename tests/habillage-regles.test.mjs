import test from "node:test";
import assert from "node:assert/strict";
import {
  HABILLAGES, HABILLAGE_PAR_DEFAUT, CLE_APPAREIL,
  habillageValide, lireAppareil, ecrireAppareil, habillageRetenu,
} from "../js/habillage-regles.js";

const app = (nom, email, aEnvoyer = false, choisi = true) => ({ nom, email, aEnvoyer, choisi });

test("constantes : deux habillages gelés, ecsr par défaut", () => {
  assert.deepEqual([...HABILLAGES], ["ecsr", "ecf"]);
  assert.ok(Object.isFrozen(HABILLAGES));
  assert.equal(HABILLAGE_PAR_DEFAUT, "ecsr");
  assert.equal(CLE_APPAREIL, "ecsr_habillage");
  assert.equal(habillageValide("ecf"), true);
  assert.equal(habillageValide("violet"), false);
  assert.equal(habillageValide(null), false);
});

test("1. rien du tout : ecsr par défaut, rien à envoyer", () => {
  assert.deepEqual(habillageRetenu({ appareil: null, compte: null, email: "A" }),
    { nom: "ecsr", source: "defaut", envoi: null });
});

test("2. choix en attente sur l'appareil : il gagne et part au compte", () => {
  assert.deepEqual(habillageRetenu({ appareil: app("ecf", "A", true), compte: "ecsr", email: "A" }),
    { nom: "ecf", source: "appareil", envoi: "ecf" });
});

test("3. appareil déjà envoyé, compte changé ailleurs : le compte l'emporte", () => {
  assert.deepEqual(habillageRetenu({ appareil: app("ecf", "A"), compte: "ecsr", email: "A" }),
    { nom: "ecsr", source: "compte", envoi: null });
});

test("4. appareil d'une autre personne : ignoré et jamais envoyé", () => {
  assert.deepEqual(habillageRetenu({ appareil: app("ecf", "B", true), compte: null, email: "A" }),
    { nom: "ecsr", source: "defaut", envoi: null });
});

test("5. appareil sans e-mail, compte vide : il sert et part au compte", () => {
  assert.deepEqual(habillageRetenu({ appareil: app("ecf", null), compte: null, email: "A" }),
    { nom: "ecf", source: "appareil", envoi: "ecf" });
});

test("6. compte avec un nom inconnu : ignoré", () => {
  assert.deepEqual(habillageRetenu({ appareil: null, compte: "violet", email: "A" }),
    { nom: "ecsr", source: "defaut", envoi: null });
});

test("7. centre, réseau, ordre et centre imposé", () => {
  const base = { appareil: null, compte: null, email: "A" };
  assert.deepEqual(habillageRetenu({ ...base, centre: "ecf" }), { nom: "ecf", source: "centre", envoi: null });
  assert.deepEqual(habillageRetenu({ ...base, reseau: "ecf" }), { nom: "ecf", source: "reseau", envoi: null });
  assert.deepEqual(habillageRetenu({ ...base, centre: "ecsr", reseau: "ecf" }), { nom: "ecsr", source: "centre", envoi: null });
  assert.deepEqual(habillageRetenu({ ...base, compte: "ecsr", centre: "ecf", reseau: "ecf" }),
    { nom: "ecsr", source: "compte", envoi: null });
  assert.deepEqual(habillageRetenu({ ...base, appareil: app("ecsr", "A", true), compte: "ecf", centre: "ecf", reseau: "ecf" }),
    { nom: "ecsr", source: "appareil", envoi: "ecsr" });
  assert.deepEqual(habillageRetenu({ ...base, compte: "ecsr", centre: "ecf", libre: false }),
    { nom: "ecf", source: "centre", envoi: null });
  assert.deepEqual(habillageRetenu({ ...base, appareil: app("ecsr", "A", true), compte: "ecsr", centre: "ecf", libre: false }),
    { nom: "ecf", source: "centre", envoi: "ecsr" });
});

test("8. lireAppareil : illisible ou inconnu donne null, sinon les quatre champs", () => {
  for (const t of [null, "", "{", '"ecf"', '{"nom":"sombre"}']) assert.equal(lireAppareil(t), null);
  assert.deepEqual(lireAppareil('{"nom":"ecf"}'), { nom: "ecf", email: null, aEnvoyer: false, choisi: true });
  assert.equal(lireAppareil('{"nom":"ecf","choisi":false,"aEnvoyer":true}').aEnvoyer, false);
  assert.equal(lireAppareil('{"nom":"ecf","aEnvoyer":true}').aEnvoyer, true);
});

test("9. le défaut ne devient jamais un choix", () => {
  assert.deepEqual(habillageRetenu({ appareil: app("ecsr", "A", false, false), compte: null, email: "A" }),
    { nom: "ecsr", source: "defaut", envoi: null });
  assert.deepEqual(habillageRetenu({ appareil: app("ecsr", "A", false, false), compte: null, email: "A", centre: "ecf" }),
    { nom: "ecf", source: "centre", envoi: null });
  assert.deepEqual(habillageRetenu({ appareil: app("ecf", "A", false, false), compte: null, email: "A", centre: "ecsr" }),
    { nom: "ecsr", source: "centre", envoi: null });
});

test("ecrireAppareil : aller-retour par lireAppareil", () => {
  const a = app("ecf", "A", true, true);
  assert.deepEqual(lireAppareil(ecrireAppareil(a)), a);
  const b = app("ecsr", "A", false, false);
  assert.deepEqual(lireAppareil(ecrireAppareil(b)), b);
});
