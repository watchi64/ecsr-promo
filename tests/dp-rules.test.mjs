import assert from "node:assert/strict";
import { CHAMPS_EXEMPLE, cleExemple, exempleRempli, exempleImprime,
         rubriquesImprimees, rubriquesEdition, sommaire } from "../js/dp-rules.js";

// --- Clés de sérialisation ---
assert.equal(cleExemple(1, 2, "taches"), "at1_ex2_taches");
assert.ok(CHAMPS_EXEMPLE.includes("titre"));
assert.ok(CHAMPS_EXEMPLE.includes("complement"));

// --- Un exemple est rempli dès qu'un seul de ses champs porte du texte ---
assert.equal(exempleRempli({}, 1, 1), false);
assert.equal(exempleRempli({ at1_ex1_titre: "   " }, 1, 1), false, "espaces seuls = vide");
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 1), true);
assert.equal(exempleRempli({ at1_ex1_complement: "RAS" }, 1, 1), true);
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 2), false);
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 2, 1), false);

// --- L'exemple n°1 s'imprime toujours, même vide (DP vierge imprimable) ---
assert.equal(exempleImprime({}, 1, 1), true);
assert.equal(exempleImprime({}, 2, 1), true);
assert.equal(exempleImprime({}, 1, 2), false);
assert.equal(exempleImprime({ at1_ex2_moyens: "Fiches" }, 1, 2), true);

// --- Dossier vierge : 8 rubriques, sans aucun numéro de page ---
const vierge = rubriquesImprimees({});
assert.deepEqual(vierge.map((r) => r.type),
  ["couverture", "presentation", "sommaire", "intercalaire",
   "exemple", "exemple", "titres", "declaration"]);
// Plus aucune rubrique ne porte de numéro de page : il vient de la pagination réelle.
assert.ok(vierge.every((r) => r.page === undefined),
  "rubriquesImprimees ne calcule plus de numéro de page");
// Les rubriques « documents » et « annexes » ont quitté le document.
assert.ok(!vierge.some((r) => r.type === "documents" || r.type === "annexes"));
assert.deepEqual(vierge.filter((r) => r.type === "exemple").map((r) => [r.at, r.n]),
  [[1, 1], [2, 1]]);

// --- Dossier complet : 6 fiches d'exemple, 12 rubriques ---
const plein = {};
for (const at of [1, 2]) for (const n of [1, 2, 3]) plein[cleExemple(at, n, "titre")] = `T${at}${n}`;
const tout = rubriquesImprimees(plein);
assert.equal(tout.length, 12);
assert.equal(tout.filter((r) => r.type === "exemple").length, 6);
assert.equal(tout[tout.length - 1].type, "declaration");

// --- Cas intermédiaire : AT1 a 3 exemples, AT2 seulement le premier ---
const mixte = { at1_ex2_titre: "B", at1_ex3_titre: "C" };
assert.deepEqual(rubriquesImprimees(mixte).filter((r) => r.type === "exemple").map((r) => [r.at, r.n]),
  [[1, 1], [1, 2], [1, 3], [2, 1]]);

// --- Sommaire : titres saisis, exemples non imprimés absents, aucun numéro ---
assert.deepEqual(sommaire(mixte),
  [{ at: 1, n: 1, titre: "" },
   { at: 1, n: 2, titre: "B" },
   { at: 1, n: 3, titre: "C" },
   { at: 2, n: 1, titre: "" }]);
assert.equal(sommaire({ at1_ex1_titre: "  Première leçon  " })[0].titre, "Première leçon");

// --- Mode édition : les 6 fiches sont toujours là, marquées imprimées ou non ---
const edition = rubriquesEdition(mixte);
assert.equal(edition.filter((r) => r.type === "exemple").length, 6);
assert.deepEqual(edition.filter((r) => r.type === "exemple").map((r) => r.imprime),
  [true, true, true, true, false, false]);
// Les rubriques fixes sont toujours imprimées.
assert.ok(edition.filter((r) => r.type !== "exemple").every((r) => r.imprime === true));
assert.deepEqual(edition.map((r) => r.type),
  ["couverture", "presentation", "sommaire", "intercalaire",
   "exemple", "exemple", "exemple", "exemple", "exemple", "exemple",
   "titres", "declaration"]);

console.log("dp-rules : OK");
