// Règles de la saisie des notes thème par thème et des états vides de la page Notes (lot C de l'audit du 09/11).
// Lancer depuis la racine du dépôt : node tests/notes-saisie-rules.test.mjs
import assert from "node:assert/strict";
import {
  parseNoteInput, ciblesDeSaisie, filtrerCibles, derniereNote, avancement, libelleAvancement,
  origineNote, etatVideNotes, champsDeCible, raisonEchecNote, contexteEtatVide,
} from "../js/notes-saisie-rules.js";

// --- Lecture d'une saisie : virgule, espaces, conversion X/Y ---
assert.deepEqual(parseNoteInput("14,5"), { note: 14.5, note_max: 20, converted: false });
assert.deepEqual(parseNoteInput("7 / 10"), { note: 14, note_max: 20, converted: true, original: "7/10" });
assert.equal(parseNoteInput("  "), null);
assert.deepEqual(parseNoteInput("14 , 5"), { note: 14.5, note_max: 20, converted: false }, "espaces autour de la virgule");
assert.deepEqual(parseNoteInput("7 , 5 / 10"), { note: 15, note_max: 20, converted: true, original: "7.5/10" });
assert.ok(parseNoteInput("21").error, "au-dessus de 20 : refus");
assert.ok(parseNoteInput("abc").error, "pas un nombre : refus");

// --- Les cibles : 4 compétences, puis les thèmes ; 47 absorbé par 46 ---
const c = ciblesDeSaisie([
  { numero: 46, titre: "A" }, { numero: 22, titre: "Feux du véhicule" }, { numero: 47, titre: "B" },
]);
assert.deepEqual(c.map((x) => x.cle), ["C1", "C2", "REMC", "MGDE", "T22", "T46"]);
assert.equal(c.find((x) => x.cle === "T46").libelle, "A et B");
assert.equal(c.find((x) => x.cle === "MGDE").numero, "GDE");
assert.equal(c.find((x) => x.cle === "C1").libelle, "Accueillir et sensibiliser à la sécurité routière");
assert.equal(c.find((x) => x.cle === "T22").numero, "22");
assert.deepEqual(filtrerCibles(c, "vehicule").map((x) => x.cle), ["T22"], "accents ignorés");
assert.deepEqual(filtrerCibles(c, "FEUX").map((x) => x.cle), ["T22"], "majuscules ignorées");
assert.deepEqual(filtrerCibles(c, "22").map((x) => x.cle), ["T22"]);
assert.equal(filtrerCibles(c, "  ").length, c.length, "recherche vide : tout");

// --- Ce qui part en base : jamais les champs d'affichage de la cible ---
const t22 = c.find((x) => x.cle === "T22");
assert.deepEqual(champsDeCible(t22), { type: "Thème", theme_numero: 22, theme_titre: "Feux du véhicule" });
assert.deepEqual(champsDeCible(c.find((x) => x.cle === "REMC")), { type: "Compétence", competence_code: "REMC" });
assert.deepEqual(champsDeCible({ type: "Thème", theme_numero: 3, theme_titre: null }),
  { type: "Thème", theme_numero: 3, theme_titre: null }, "l'objet de la matrice passe tel quel");

// --- La note affichée : la plus récente, comme la matrice ---
const evs = [
  { id: 1, stagiaire_id: 3, type: "Thème", theme_numero: 22, note: 9, date_eval: "2026-10-01" },
  { id: 2, stagiaire_id: 3, type: "Thème", theme_numero: 22, note: 14, date_eval: "2026-10-12", qcm_attempt_id: 8 },
  { id: 3, stagiaire_id: 4, type: "Compétence", competence_code: "REMC", note: 11, date_eval: "2026-10-02" },
  { id: 4, stagiaire_id: 4, type: "Thème", theme_numero: 23, note: 12, date_eval: "2026-10-02" },
];
assert.equal(derniereNote(evs, 3, t22).id, 2);
assert.equal(derniereNote(evs, 4, t22), null, "une note d'un autre thème ne compte pas");
assert.equal(derniereNote(evs, 4, { type: "Compétence", competence_code: "REMC" }).id, 3);
assert.deepEqual(avancement(evs, [3, 4], t22), { n: 1, total: 2 });
assert.equal(libelleAvancement({ n: 0, total: 6 }), "aucune");
assert.equal(libelleAvancement({ n: 2, total: 6 }), "2 sur 6");
assert.equal(libelleAvancement({ n: 6, total: 6 }), "6 sur 6");

// --- D'où vient une note ---
assert.equal(origineNote(evs[1]), "Examen QCM du 12 oct.");
assert.equal(origineNote({ ...evs[0], observation: "QCM examen" }), "Examen QCM du 1 oct.");
assert.equal(origineNote(evs[0]), "Saisie le 1 oct.");

// --- États vides : une phrase et une action, selon le contexte ---
assert.equal(etatVideNotes({ nbNotes: 3, contexte: "equipe-matrice" }), null);
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "equipe-matrice" }), {
  titre: "Aucune note pour l'instant",
  phrase: "Les notes arrivent ici toutes seules quand un stagiaire passe un examen QCM. Tu peux aussi les saisir toi-même.",
  actions: ["examen", "saisir"] });
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "equipe-saisir" }).actions, ["examen"]);
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "classe-stagiaire" }), {
  titre: "Pas encore de notes",
  phrase: "Les notes de la classe apparaîtront après le premier examen.",
  actions: ["entrainement"] });
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "classe-formateur" }).actions, ["examen"]);
assert.deepEqual(etatVideNotes({ nbNotes: 0, contexte: "direction" }), {
  titre: "Aucune note pour l'instant",
  phrase: "Les notes arrivent ici avec les examens QCM.",
  actions: [] });

// --- La raison d'un échec d'écriture, en français (jamais le message brut du réseau ou de la base) ---
assert.equal(raisonEchecNote(new TypeError("Failed to fetch")), "la connexion a échoué");
assert.equal(raisonEchecNote({ message: "network error" }), "la connexion a échoué");
assert.equal(raisonEchecNote({ message: "JWT expired", code: "PGRST301" }), "ta session a expiré, reconnecte-toi");
assert.equal(raisonEchecNote({ message: "new row violates row-level security policy", code: "42501" }),
  "tu n'as pas le droit de modifier cette note");
assert.equal(raisonEchecNote(null), "la connexion a échoué");

// --- Quelle carte vide, selon la page et la personne : la direction (personnel sans droit d'écrire) n'a ni
// « Saisir » ni « M'entraîner », le stagiaire n'a que « M'entraîner » ---
assert.equal(contexteEtatVide({ classe: false, admin: true, personnel: true }), "equipe-matrice");
assert.equal(contexteEtatVide({ classe: false, admin: false, personnel: true }), "direction");
assert.equal(contexteEtatVide({ classe: false, admin: false, personnel: false }), "classe-stagiaire");
assert.equal(contexteEtatVide({ classe: true, admin: true, personnel: true }), "classe-formateur");
assert.equal(contexteEtatVide({ classe: true, admin: false, personnel: true }), "direction");
assert.equal(contexteEtatVide({ classe: true, admin: false, personnel: false }), "classe-stagiaire");

console.log("notes-saisie-rules : OK");
