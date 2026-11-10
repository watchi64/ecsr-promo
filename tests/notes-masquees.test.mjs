// Fiches dont les notes sont masquées : ce que la vue Notes reçoit de la base (fonction fiches_notes_masquees, ou les
// profils quand la base n'est pas encore migrée), ramené à un ensemble de numéros de fiche.
// Lancer depuis la racine du dépôt : node tests/notes-masquees.test.mjs
import assert from "node:assert/strict";
import { fichesDeLaFonction, fichesDesProfils } from "../js/notes-masquees.js";

const tri = (ensemble) => [...ensemble].sort((a, b) => a - b);

// La fonction rend une liste de nombres ; selon le client, chaque ligne peut aussi arriver en objet d'une colonne.
assert.deepEqual(tri(fichesDeLaFonction([3, 7])), [3, 7]);
assert.deepEqual(tri(fichesDeLaFonction([{ fiches_notes_masquees: 7 }, { fiches_notes_masquees: "3" }])), [3, 7]);
assert.deepEqual(tri(fichesDeLaFonction(["12"])), [12]);
assert.deepEqual(tri(fichesDeLaFonction(null)), []);
assert.deepEqual(tri(fichesDeLaFonction(undefined)), []);
// Une valeur illisible n'entre pas dans l'ensemble (elle ne masquerait personne et fausserait un compte).
assert.deepEqual(tri(fichesDeLaFonction([5, null, "abc", { x: null }])), [5]);
assert.ok(fichesDeLaFonction([4]).has(4));

// Repli sur les profils (base pas encore migrée) : les fiches des comptes qui ont masqué leurs notes.
const profils = [
  { email: "a@example.test", stagiaire_id: 1, anonymous_notes: false },
  { email: "b@example.test", stagiaire_id: 3, anonymous_notes: true },
  { email: "c@example.test", stagiaire_id: null, anonymous_notes: true },
  { email: "d@example.test", stagiaire_id: 9, anonymous_notes: true },
];
assert.deepEqual(tri(fichesDesProfils(profils)), [3, 9]);
assert.deepEqual(tri(fichesDesProfils([])), []);
assert.deepEqual(tri(fichesDesProfils(null)), []);

console.log("notes-masquees : OK");
