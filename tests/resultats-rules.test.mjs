import assert from "node:assert/strict";
import { notesSur20, moyenne, tendance, forcesEtFaiblesses, moyenneDuGroupe, SEUIL_GROUPE, formatNote } from "../js/resultats-rules.js";

const evals = [
  { id: 1, note: 10, note_max: 20, date_eval: "2026-09-01", lib: "A" },
  { id: 2, note: 8, note_max: 10, date_eval: "2026-09-15", lib: "B" },
  { id: 3, note: 18, note_max: 20, date_eval: "2026-11-01", lib: "A" },
  { id: 4, note: null, note_max: 20, date_eval: "2026-11-02", lib: "C" },
  { id: 5, note: 12, note_max: 0, date_eval: "2026-11-02", lib: "C" },
  { id: 6, note: 20, note_max: 20, date_eval: null, lib: "D" },
];
const n = notesSur20(evals);
assert.deepEqual(n.map((e) => e.norm), [20, 10, 16, 18]);   // sans date en tête, puis par date
assert.equal(moyenne(n), 16);
assert.equal(moyenne([]), null);

// Tendance : moyenne d'aujourd'hui moins celle des notes de plus de 30 jours (datées).
assert.equal(tendance(n, "2026-11-11"), 3);       // 16 - (10+16)/2
assert.equal(tendance(n, "2026-09-10"), null);    // aucune note de plus de 30 jours
assert.equal(tendance(n.filter((e) => e.date_eval), "2026-11-11"), Math.round((44 / 3 - 13) * 10) / 10);

// Forces et faiblesses : moyenne par sujet ; 3 + 3 ; moitiés si moins de 6 ; rien avec un seul.
const parSujet = (pairs) => pairs.map(([lib, norm], i) => ({ id: i, lib, norm }));
const f = forcesEtFaiblesses(parSujet([["A", 10], ["A", 18], ["B", 16], ["C", 12], ["D", 20], ["E", 9], ["F", 15], ["G", 17]]), (e) => e.lib);
assert.deepEqual(f.forts.map((x) => x.lib), ["D", "G", "B"]);
assert.deepEqual(f.faibles.map((x) => x.lib), ["E", "C", "A"]);
assert.equal(f.faibles[2].moyenne, 14);
const g = forcesEtFaiblesses(parSujet([["A", 10], ["B", 16], ["C", 12]]), (e) => e.lib);
assert.deepEqual(g.forts.map((x) => x.lib), ["B"]);
assert.deepEqual(g.faibles.map((x) => x.lib), ["A"]);
const h = forcesEtFaiblesses(parSujet([["A", 10], ["A", 12]]), (e) => e.lib);
assert.deepEqual(h, { forts: [], faibles: [] });
// Sujet non identifiable écarté.
const k = forcesEtFaiblesses(parSujet([["A", 10], ["Évaluation", 2], ["B", 16]]), (e) => e.lib);
assert.deepEqual(k.faibles.map((x) => x.lib), ["A"]);

// Moyenne du groupe : seulement à partir de 3 stagiaires actifs.
assert.equal(SEUIL_GROUPE, 3);
assert.equal(moyenneDuGroupe({ n: 4, somme: 60 }, 3), 15);
assert.equal(moyenneDuGroupe({ n: 4, somme: 60 }, 2), null);
assert.equal(moyenneDuGroupe({ n: 0, somme: 0 }, 12), null);
assert.equal(moyenneDuGroupe(null, 12), null);

assert.equal(formatNote(17.36), "17,4");
assert.equal(formatNote(15), "15");

console.log("resultats-rules : OK");
