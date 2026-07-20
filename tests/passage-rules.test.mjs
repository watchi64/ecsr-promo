import assert from "node:assert/strict";
import { compteDansEquite, meilleurResultat, RESULTAT_RANG } from "../js/passage-rules.js";

// Comptage d'équité : Effectué + Absence consomment le tour, Bonus + Report non.
assert.equal(compteDansEquite("Effectué"), true);
assert.equal(compteDansEquite("Absence"), true);
assert.equal(compteDansEquite("Bonus"), false);
assert.equal(compteDansEquite("Report"), false);
assert.equal(compteDansEquite(undefined), false);
assert.equal(compteDansEquite(null), false);

// Fusion à la validation : Effectué > Absence > Bonus > Report.
assert.equal(meilleurResultat("Absence", "Effectué"), "Effectué");
assert.equal(meilleurResultat("Effectué", "Absence"), "Effectué");
assert.equal(meilleurResultat("Bonus", "Absence"), "Absence");
assert.equal(meilleurResultat("Report", "Bonus"), "Bonus");
assert.equal(meilleurResultat("Effectué", "Effectué"), "Effectué");
assert.ok(RESULTAT_RANG["Effectué"] < RESULTAT_RANG["Absence"]);
assert.ok(RESULTAT_RANG["Absence"] < RESULTAT_RANG["Bonus"]);

console.log("passage-rules : 13 assertions OK");
