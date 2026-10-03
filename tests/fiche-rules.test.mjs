// États de la fiche et de la page Stagiaires (chantier D, lot 2).
import assert from "node:assert/strict";
import {
  EPREUVES_EPCF, EVT_DOCUMENT, epreuvesEvaluees, jourMois, passagesAVenir, ligneListe, etatsSommaire,
} from "../js/fiche-rules.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Épreuves EPCF
eq(EPREUVES_EPCF, ["salle", "vehicule"], "deux épreuves");
eq(epreuvesEvaluees([]), 0, "aucune évaluation");
eq(epreuvesEvaluees(undefined), 0, "liste absente");
eq(epreuvesEvaluees([{ trame: "salle" }, { trame: "salle" }]), 1, "deux évaluations salle : une épreuve");
eq(epreuvesEvaluees([{ trame: "salle" }, { trame: "vehicule" }]), 2, "les deux épreuves");
eq(epreuvesEvaluees([{ trame: "autre" }]), 0, "épreuve inconnue ignorée");

// 2. Dates
eq(jourMois("2026-09-29"), "29/09", "date seule");
eq(jourMois("2026-09-29T10:00:00"), "29/09", "horodatage");
eq(jourMois(null), null, "absente");
eq(jourMois("pas une date"), null, "illisible");

// 3. Passages à venir : aujourd'hui compris, vrais passages seulement
const items = [
  { iso: "2026-10-02", role: "passage" },
  { iso: "2026-10-03", role: "passage" },
  { iso: "2026-10-03", role: "eleve" },
  { iso: "2026-10-06", role: "passage" },
];
eq(passagesAVenir(items, "2026-10-03"), 2, "passé exclu, élève en salle exclu");
eq(passagesAVenir(undefined, "2026-10-03"), 0, "rien de planifié");

// 4. Ligne de la liste (vue formateur)
eq(ligneListe({ evals: [{ trame: "salle" }], livret: { updated_at: "2026-09-20T08:00:00" },
  dossier: { updated_at: "2026-09-29T08:00:00" } }),
  [{ texte: "EPCF 1/2", afaire: true }, { texte: "Livret", afaire: false }, { texte: "Dossier 29/09", afaire: false }],
  "en cours");
eq(ligneListe({ evals: [], livret: null, dossier: null }),
  [{ texte: "EPCF 0/2", afaire: true }, { texte: "Livret vierge", afaire: true }, { texte: "Dossier vierge", afaire: true }],
  "rien de commencé");
eq(ligneListe({ evals: [{ trame: "salle" }, { trame: "vehicule" }], livret: {}, dossier: { updated_at: "bidon" } }),
  [{ texte: "EPCF 2/2", afaire: false }, { texte: "Livret", afaire: false }, { texte: "Dossier", afaire: false }],
  "tout fait, date illisible");

// 5. Sommaire : orange pour le formateur, seulement le dossier pour soi
const vu = { aVenir: 2, evals: [{ trame: "salle" }], livret: null, dossier: null };
const f = etatsSommaire({ ...vu, soi: false });
eq(f.passages, { texte: "2 à venir", afaire: false }, "passages");
eq(f.epcf, { texte: "1/2", afaire: true }, "EPCF en orange chez le formateur");
eq(f.evolution, null, "évolution sans état");
eq(f.livret, { texte: "vierge", afaire: true }, "livret vierge en orange chez le formateur");
eq(f.dp, { texte: "vierge", afaire: true }, "dossier vierge");
const s = etatsSommaire({ ...vu, soi: true });
eq(s.epcf, { texte: "1/2", afaire: false }, "EPCF en gris chez le stagiaire");
eq(s.livret, { texte: "pas encore créé", afaire: false }, "livret pas encore créé, en gris");
eq(s.dp, { texte: "vierge", afaire: true }, "son dossier vierge reste en orange");
const fait = etatsSommaire({ aVenir: 0, evals: [], livret: { updated_at: "x" }, dossier: { updated_at: "2026-10-01" }, soi: true });
eq(fait.passages, { texte: "aucun à venir", afaire: false }, "aucun à venir");
eq(fait.livret, { texte: "commencé", afaire: false }, "livret commencé");
eq(fait.dp, { texte: "01/10", afaire: false }, "dossier daté");

eq(EVT_DOCUMENT, "document-enregistre", "nom de l'événement");

console.log(`fiche-rules : ${n} assertions OK`);
