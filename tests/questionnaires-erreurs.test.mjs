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
  for (const p of ["Il manque des réponses.", "Questionnaire inconnu.", "Réservé à la gestion de la qualité.", "Promo introuvable."]) {
    assert.equal(messageErreurQuestionnaire(base(p)), p);
  }
  assert.equal(phraseDeLaBase({ message: "autre chose" }), null);
});

test("les refus de la migration qui tutoient sont redits en formule neutre (stagiaires et formateurs, règle du 10/11)", () => {
  assert.equal(messageErreurQuestionnaire(base("Ce questionnaire ne te concerne pas.")), "Ce questionnaire ne concerne pas ce compte.");
  assert.equal(messageErreurQuestionnaire(base("Le questionnaire a changé : recharge la page.")), "Le questionnaire a changé : merci de recharger la page.");
  assert.equal(messageErreurQuestionnaire(base("Ton commentaire dépasse 2 000 caractères.")), "Le commentaire dépasse 2 000 caractères.");
  assert.equal(messageErreurQuestionnaire(base("Reconnecte-toi pour répondre.")), "La session a expiré : une nouvelle connexion est nécessaire pour répondre.");
});

test("aucun message ne contient de tiret cadratin, ni « tu » ni « vous »", () => {
  const cadratin = String.fromCharCode(0x2014);
  const refus = ["Ce questionnaire ne te concerne pas.", "Le questionnaire a changé : recharge la page.",
    "Ton commentaire dépasse 2 000 caractères.", "Reconnecte-toi pour répondre.", "Tu as déjà répondu à ce questionnaire."]
    .map((p) => messageErreurQuestionnaire(base(p)));
  for (const p of [PHRASE_INDISPONIBLE, PHRASE_RESEAU, PHRASE_FERME, PHRASE_DEJA_REPONDU, ...refus]) {
    assert.equal(p.includes(cadratin), false);
    assert.doesNotMatch(p, /\b(tu|ton|ta|tes|te|toi|vous|votre|vos)\b|-toi\b/i, p);
  }
});
