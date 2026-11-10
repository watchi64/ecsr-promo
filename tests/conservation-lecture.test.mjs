import test from "node:test";
import assert from "node:assert/strict";
import {
  messageErreurConservation, conservationAbsente, phraseConservation,
  PHRASE_DROIT, PHRASE_INDISPONIBLE, PHRASE_RESEAU,
} from "../js/conservation-erreurs.js";
import { feuilleDuJour } from "../js/aujourdhui-rules.js";

// Tâche 6 du lot Q5 : lecture et actions de la conservation. Les messages d'erreur de la base, et les listes de travail
// qui retirent une fiche sans nom (anonymise_le posé) alors que les feuilles closes la gardent.

const base = (phrase, code = "P0001") => ({ code, message: "conservation: " + phrase });

test("refus de la base : la phrase est reprise sans son préfixe", () => {
  assert.equal(phraseConservation(base("Possible à partir du 11/12/2027.")), "Possible à partir du 11/12/2027.");
  assert.equal(messageErreurConservation(base("Renseigne d'abord la date de fin de cette promo.")),
    "Renseigne d'abord la date de fin de cette promo.");
  assert.equal(phraseConservation({ message: "autre chose" }), null);
  assert.equal(phraseConservation(null), null);
});

test("refus de droit, fonction absente, panne de réseau", () => {
  assert.equal(messageErreurConservation({ code: "42501", message: "permission denied for function" }), PHRASE_DROIT);
  assert.equal(messageErreurConservation(base("Réservé à la gestion de la qualité.", "42501")), "Réservé à la gestion de la qualité.");
  assert.equal(conservationAbsente({ code: "PGRST202", message: "x" }), true);
  assert.equal(conservationAbsente({ code: "42883", message: "x" }), true);
  assert.equal(conservationAbsente(base("Fiche introuvable.")), false);
  assert.equal(messageErreurConservation({ code: "PGRST202", message: "Could not find the function public.etat_conservation" }), PHRASE_INDISPONIBLE);
  assert.equal(messageErreurConservation({ message: "Failed to fetch" }), PHRASE_RESEAU);
  assert.equal(messageErreurConservation(undefined), PHRASE_RESEAU);
});

const STAG = [
  { id: 1, prenom: "Timy", nom: "V.", actif: true },
  { id: 2, prenom: "Anonyme 2", nom: null, actif: true, anonymise_le: "2030-01-02T10:00:00Z" },
];
const ligne = (id, signe) => ({ stagiaire_id: id, signe_le: signe ? "2026-10-27T08:30:00Z" : null, absent: false });

test("feuille ouverte : une fiche sans nom n'est ni listée ni comptée", () => {
  const f = feuilleDuJour({
    seances: [{ statut: "ouverte", jour: "2026-10-27", demi_journee: "matin", lignes: [ligne(1, true), ligne(2, true)] }],
    stagiaires: STAG, entries: [],
  });
  assert.equal(f.total, 1);
});

test("feuille close : la fiche sans nom reste, comme preuve de présence", () => {
  const f = feuilleDuJour({
    seances: [{ statut: "close", jour: "2026-10-27", demi_journee: "matin", lignes: [ligne(1, true), ligne(2, true)] }],
    stagiaires: STAG, entries: [],
  });
  assert.equal(f.total, 2);
});

test("stagiairesDeFeuille : ouverte sans la fiche sans nom, close avec", async () => {
  const { stagiairesDeFeuille } = await import("../js/emargement-feuilles.js");
  const lignes = [ligne(1, true), ligne(2, true)];
  assert.deepEqual(stagiairesDeFeuille({ statut: "ouverte", lignes }, STAG).map((s) => s.id), [1]);
  assert.deepEqual(stagiairesDeFeuille({ statut: "close", lignes }, STAG).map((s) => s.id).sort(), [1, 2]);
});
