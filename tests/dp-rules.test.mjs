import assert from "node:assert/strict";
import { CHAMPS_EXEMPLE, cleExemple, exempleRempli, exempleImprime,
         blocsImprimes, blocsEdition, sommaire } from "../js/dp-rules.js";

// --- Clés de sérialisation ---
assert.equal(cleExemple(1, 2, "taches"), "at1_ex2_taches");
assert.ok(CHAMPS_EXEMPLE.includes("titre"));
assert.ok(CHAMPS_EXEMPLE.includes("complement"));

// --- Un exemple est rempli dès qu'un seul de ses champs porte du texte ---
assert.equal(exempleRempli({}, 1, 1), false);
assert.equal(exempleRempli({ at1_ex1_titre: "   " }, 1, 1), false, "espaces seuls = vide");
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 1), true);
assert.equal(exempleRempli({ at1_ex1_complement: "RAS" }, 1, 1), true);
// Une clé d'un autre exemple ne doit pas déteindre.
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 2), false);
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 2, 1), false);

// --- L'exemple n°1 s'imprime toujours, même vide (DP vierge imprimable) ---
assert.equal(exempleImprime({}, 1, 1), true);
assert.equal(exempleImprime({}, 2, 1), true);
assert.equal(exempleImprime({}, 1, 2), false);
assert.equal(exempleImprime({ at1_ex2_moyens: "Fiches" }, 1, 2), true);

// --- Composition d'un DP vierge : 4 blocs d'ouverture, 2 exemples, 4 de fin ---
const vierge = blocsImprimes({});
assert.equal(vierge.length, 10);
assert.deepEqual(vierge.map((b) => b.type),
  ["couverture", "presentation", "sommaire", "intercalaire",
   "exemple", "exemple", "titres", "declaration", "documents", "annexes"]);
assert.deepEqual(vierge.map((b) => b.page), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
// Les deux exemples imprimés sont bien le n°1 de chaque activité-type.
assert.deepEqual(vierge.filter((b) => b.type === "exemple").map((b) => [b.at, b.n]),
  [[1, 1], [2, 1]]);

// --- DP complet : 6 exemples, 14 blocs ---
const plein = {};
for (const at of [1, 2]) for (const n of [1, 2, 3]) plein[cleExemple(at, n, "titre")] = `T${at}${n}`;
const tout = blocsImprimes(plein);
assert.equal(tout.length, 14);
assert.equal(tout.find((b) => b.type === "declaration").page, 12);
assert.equal(tout.find((b) => b.type === "annexes").page, 14);

// --- Cas intermédiaire : AT1 a 3 exemples, AT2 seulement le premier ---
const mixte = { at1_ex2_titre: "B", at1_ex3_titre: "C" };
const blocs = blocsImprimes(mixte);
assert.deepEqual(blocs.filter((b) => b.type === "exemple").map((b) => [b.at, b.n, b.page]),
  [[1, 1, 5], [1, 2, 6], [1, 3, 7], [2, 1, 8]]);
assert.equal(blocs.find((b) => b.type === "titres").page, 9);

// --- Sommaire : titres saisis et pages, exemples non imprimés absents ---
assert.deepEqual(sommaire(mixte),
  [{ at: 1, n: 1, page: 5, titre: "" },
   { at: 1, n: 2, page: 6, titre: "B" },
   { at: 1, n: 3, page: 7, titre: "C" },
   { at: 2, n: 1, page: 8, titre: "" }]);
// Le titre est nettoyé de ses espaces de bord.
assert.deepEqual(sommaire({ at1_ex1_titre: "  Première leçon  " })[0].titre, "Première leçon");

// --- Mode édition : les 6 exemples sont toujours présents ---
// Sans cela, le candidat n'aurait aucun champ où saisir son 2e ou 3e exemple.
const edition = blocsEdition({});
assert.equal(edition.length, 14, "14 blocs en édition, quel que soit le remplissage");
assert.equal(edition.filter((b) => b.type === "exemple").length, 6);
// Les exemples n°1 sont imprimés et numérotés, les autres non.
const exVierge = edition.filter((b) => b.type === "exemple");
assert.deepEqual(exVierge.map((b) => [b.at, b.n, b.imprime, b.page]),
  [[1, 1, true, 5], [1, 2, false, null], [1, 3, false, null],
   [2, 1, true, 6], [2, 2, false, null], [2, 3, false, null]]);
// Les blocs fixes gardent la pagination de l'impression.
assert.equal(edition.find((b) => b.type === "annexes").page, 10);
assert.equal(edition.find((b) => b.type === "annexes").imprime, true);

// Édition avec l'exemple AT1 n°3 rempli : il devient imprimé et numéroté,
// le n°2 reste exclu, et la pagination des blocs suivants suit.
const ed2 = blocsEdition({ at1_ex3_titre: "C" });
assert.deepEqual(ed2.filter((b) => b.type === "exemple").map((b) => [b.at, b.n, b.imprime, b.page]),
  [[1, 1, true, 5], [1, 2, false, null], [1, 3, true, 6],
   [2, 1, true, 7], [2, 2, false, null], [2, 3, false, null]]);
assert.equal(ed2.find((b) => b.type === "titres").page, 8);
// Les blocs imprimés de blocsEdition sont exactement ceux de blocsImprimes.
assert.deepEqual(ed2.filter((b) => b.imprime).map((b) => b.page),
  blocsImprimes({ at1_ex3_titre: "C" }).map((b) => b.page));

// --- Robustesse : data absent ne doit pas jeter ---
assert.equal(exempleRempli(null, 1, 1), false);
assert.equal(blocsImprimes(null).length, 10);
assert.equal(blocsEdition(null).length, 14);

console.log("dp-rules : OK");
