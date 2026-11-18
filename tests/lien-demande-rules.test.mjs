// Règles de la page des liens d'e-mail. Lancer : node tests/lien-demande-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { jetonDeLAdresse, etatDeLaPage, libelleAction, titreDeLaDemande, lignesAbsence, estAbsence, PHRASE_DETAIL_ABSENCE, LECTURE_EN_ECHEC } from "../js/lien-demande-rules.js";
import { TYPES_DEMANDE } from "../js/contact-rules.js";

const JETON = "A".repeat(20) + "b_-" + "0".repeat(20);

test("jetonDeLAdresse : #j= et 43 caractères base64url, sinon nul", () => {
  assert.equal(JETON.length, 43);
  assert.equal(jetonDeLAdresse(`#j=${JETON}`), JETON);
  assert.equal(jetonDeLAdresse("#j=abc"), null);
  assert.equal(jetonDeLAdresse(`#j=${JETON}x`), null);
  assert.equal(jetonDeLAdresse(`#k=${JETON}`), null);
  assert.equal(jetonDeLAdresse(`#j=${"+".repeat(43)}`), null);
  assert.equal(jetonDeLAdresse(""), null);
  assert.equal(jetonDeLAdresse(undefined), null);
});

test("etatDeLaPage : l'ouverture rend a_confirmer, jamais fait sans toucher", () => {
  assert.equal(etatDeLaPage({ invalide: true }), "invalide");
  assert.equal(etatDeLaPage(null), "invalide");
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "prise", libelle_reponse: null, deja: false }), "a_confirmer");
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "reponse", libelle_reponse: "Absence enregistrée", deja: false }), "a_confirmer");
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "voir", libelle_reponse: null, deja: false }), "voir");
  assert.equal(etatDeLaPage({ fait: true }), "fait");
});

test("etatDeLaPage : deja après une action faite (lien rouvert, ou second toucher)", () => {
  assert.equal(etatDeLaPage({ demande: { id: 1 }, action: "prise", libelle_reponse: null, deja: true }), "deja");
  assert.equal(etatDeLaPage({ deja: true }), "deja");
});

test("libelleAction", () => {
  assert.equal(libelleAction("prise", null), "Pris en compte");
  assert.equal(libelleAction("reponse", "Absence enregistrée"), "Absence enregistrée");
  assert.equal(libelleAction("justificatif", null), "Justificatif reçu");
  assert.equal(libelleAction("reponse", "Justificatif reçu"), "Justificatif reçu");
});

// La forme réelle de _contact_srv_lien pour une absence (migration 5) : pas de sujet ; ni motif, ni mot, ni texte, ni messages ; les
// jours et le moment.
const ABSENCE = { id: 101, type: "absence", sujet: null, etat: "envoyee", auteur_nom: "Agathe O.",
  cree_le: "2026-10-27T17:30:00Z", jours: [{ jour: "2026-10-29", demi: "matin" }],
  moment: { du: "2026-10-29", au: "2026-10-29", quand: "matin", debut: null, fin: null } };
// La forme d'avant la migration 5 (motif, mot, texte, messages) : la page ne doit pas les montrer non plus.
const ABSENCE_AVANT_5 = { ...ABSENCE, texte: "Un mot.", messages: [{ auteur_nom: "Sophie", texte: "Bien noté." }], motif: "famille", mot: "Un mot." };

test("titreDeLaDemande : le sujet ; pour une absence sans sujet, le jour et le moment ; sinon le type", () => {
  assert.equal(titreDeLaDemande(ABSENCE, TYPES_DEMANDE), "jeudi 29 octobre, matin");
  assert.equal(titreDeLaDemande({ ...ABSENCE, moment: { du: "2026-10-29", au: null, quand: "heures", debut: "10:00:00", fin: "11:30:00" } }, TYPES_DEMANDE),
    "jeudi 29 octobre, de 10 h à 11 h 30");
  assert.equal(titreDeLaDemande({ type: "document", sujet: "Attestation", moment: null }, TYPES_DEMANDE), "Attestation");
  assert.equal(titreDeLaDemande({ type: "document", sujet: null, moment: null }, TYPES_DEMANDE), TYPES_DEMANDE.document);
  assert.equal(titreDeLaDemande({ type: "inconnu" }), "Message");
});

test("lignesAbsence : « Quand » seul pour une absence (jamais le motif, même s'il arrive), rien pour une autre demande", () => {
  assert.deepEqual(lignesAbsence(ABSENCE), [["Quand", "jeudi 29 octobre, matin"]]);
  assert.deepEqual(lignesAbsence(ABSENCE_AVANT_5), [["Quand", "jeudi 29 octobre, matin"]]);
  assert.deepEqual(lignesAbsence({ ...ABSENCE, moment: { du: "2026-11-19", au: "2026-11-23", quand: "journee" } }),
    [["Quand", "du 19 au 23 novembre"]]);
  assert.deepEqual(lignesAbsence({ type: "document", sujet: "Attestation", jours: [], motif: null, mot: null, moment: null }), []);
  assert.deepEqual(lignesAbsence(null), []);
});

test("LECTURE_EN_ECHEC : la phrase nomme le bouton que la page pose", () => {
  assert.equal(LECTURE_EN_ECHEC.bouton, "Réessayer");
  assert.ok(LECTURE_EN_ECHEC.phrase.includes(`« ${LECTURE_EN_ECHEC.bouton} »`));
  assert.ok(Object.isFrozen(LECTURE_EN_ECHEC));
});

test("estAbsence et PHRASE_DETAIL_ABSENCE : une absence renvoie à l'app, vouvoyée ; une autre demande garde son texte", () => {
  assert.equal(estAbsence(ABSENCE), true);
  assert.equal(estAbsence(ABSENCE_AVANT_5), true);
  assert.equal(estAbsence({ type: "document", sujet: "Attestation" }), false);
  assert.equal(estAbsence(null), false);
  assert.match(PHRASE_DETAIL_ABSENCE, /connectez-vous/);
  assert.doesNotMatch(PHRASE_DETAIL_ABSENCE, /\b(tu|ton|ta|te)\b/);
});
