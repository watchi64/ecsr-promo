import test from "node:test";
import assert from "node:assert/strict";
import {
  messageErreurQuestionnaire, fonctionAbsente, phraseDeLaBase,
  PHRASE_INDISPONIBLE, PHRASE_RESEAU, PHRASE_FERME, PHRASE_DEJA_REPONDU,
} from "../js/questionnaires-erreurs.js";

const base = (phrase) => ({ code: "P0001", message: "questionnaire: " + phrase });

test("fonction absente : PostgREST, Postgres ou texte", () => {
  assert.equal(fonctionAbsente({ code: "PGRST202", message: "x" }), true);
  assert.equal(fonctionAbsente({ code: "42883", message: "x" }), true);
  assert.equal(fonctionAbsente({ message: "Could not find the function public.repondre_questionnaire in the schema cache" }), true);
  assert.equal(fonctionAbsente(base("Ce questionnaire est fermé.")), false);
  assert.equal(fonctionAbsente(null), false);
});

test("messages précisés : fermé, déjà répondu, absent, réseau", () => {
  assert.equal(messageErreurQuestionnaire(base("Ce questionnaire est fermé.")), PHRASE_FERME);
  assert.equal(messageErreurQuestionnaire(base("Tu as déjà répondu à ce questionnaire.")), PHRASE_DEJA_REPONDU);
  assert.equal(messageErreurQuestionnaire({ code: "PGRST202", message: "Could not find the function" }), PHRASE_INDISPONIBLE);
  assert.equal(messageErreurQuestionnaire(new TypeError("Failed to fetch")), PHRASE_RESEAU);
  assert.equal(messageErreurQuestionnaire(undefined), PHRASE_RESEAU);
});

test("les autres refus de la migration sont repris tels quels", () => {
  for (const p of ["Ce questionnaire ne te concerne pas.", "Il manque des réponses.", "Le questionnaire a changé : recharge la page.",
    "Ton commentaire dépasse 2 000 caractères.", "Reconnecte-toi pour répondre."]) {
    assert.equal(messageErreurQuestionnaire(base(p)), p);
  }
  assert.equal(phraseDeLaBase({ message: "autre chose" }), null);
});

test("aucun message ne contient de tiret cadratin", () => {
  const cadratin = String.fromCharCode(0x2014);
  for (const p of [PHRASE_INDISPONIBLE, PHRASE_RESEAU, PHRASE_FERME, PHRASE_DEJA_REPONDU]) assert.equal(p.includes(cadratin), false);
});
