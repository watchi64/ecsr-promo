import assert from "node:assert/strict";
import { parseDate, formatDate } from "../js/utils.js";

// --- Date seule : lecture en heure LOCALE, comportement à préserver à l'identique ---
// (new Date("2026-07-30") se lirait en UTC et reculerait d'un jour à l'ouest de Greenwich)
const seule = parseDate("2026-07-30");
assert.equal(seule.getFullYear(), 2026);
assert.equal(seule.getMonth(), 6, "juillet");
assert.equal(seule.getDate(), 30);
assert.equal(seule.getHours(), 0, "minuit local, pas minuit UTC");
assert.equal(formatDate("2026-07-30"), "30/07/2026");

// --- Horodatage complet : c'est la forme que Postgres renvoie pour un timestamptz ---
// Assertions indépendantes du fuseau de la machine : on compare en UTC.
const avecZ = parseDate("2026-07-30T09:00:00Z");
assert.ok(!Number.isNaN(avecZ.getTime()), "un horodatage ISO doit donner une date valide");
assert.ok(avecZ.toISOString().startsWith("2026-07-30T09:00"),
  "l'instant est conservé tel quel, sans décalage ajouté");

const sansZ = parseDate("2026-07-30T09:00:00");
assert.ok(!Number.isNaN(sansZ.getTime()), "un horodatage sans fuseau doit rester valide");

// --- Le symptôme d'origine : plus aucun NaN à l'écran ---
assert.match(formatDate("2026-07-30T09:00:00Z"), /^\d{2}\/\d{2}\/\d{4}$/,
  "le panneau des signalements affichait NaN/NaN/NaN sur chaque ligne");

console.log("utils-dates : OK");
