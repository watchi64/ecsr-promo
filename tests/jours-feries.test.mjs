// Jours fériés (navigation unique, phase 2, 11/11) : le planning et Mon suivi avaient chacun leur copie du calcul
// (easterSunday et frenchHolidays, sur des dates locales) ; ils passent désormais par jourFerie (js/emargement-rules.js).
// Ce test garde la preuve que le résultat est le même, jour par jour, sur 2026 et 2027 : l'ancienne copie est reprise
// ici telle quelle comme référence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jourFerie } from "../js/emargement-rules.js";

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; };

// L'ancienne copie de js/views/planning.js et js/views/mon-suivi.js, à l'identique.
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function frenchHolidays(year) {
  const map = {};
  const add = (dt, label) => { map[isoDate(dt)] = label; };
  add(new Date(year, 0, 1), "Jour de l'an");
  add(new Date(year, 4, 1), "Fête du Travail");
  add(new Date(year, 4, 8), "Victoire 1945");
  add(new Date(year, 6, 14), "Fête nationale");
  add(new Date(year, 7, 15), "Assomption");
  add(new Date(year, 10, 1), "Toussaint");
  add(new Date(year, 10, 11), "Armistice");
  add(new Date(year, 11, 25), "Noël");
  const easter = easterSunday(year);
  add(addDays(easter, 1), "Lundi de Pâques");
  add(addDays(easter, 39), "Ascension");
  add(addDays(easter, 50), "Lundi de Pentecôte");
  return map;
}

for (const annee of [2026, 2027]) {
  test(`jourFerie rend, jour par jour, les mêmes fériés que l'ancienne copie (${annee})`, () => {
    const reference = frenchHolidays(annee);
    let feries = 0;
    for (let d = new Date(annee, 0, 1); d.getFullYear() === annee; d = addDays(d, 1)) {
      const iso = isoDate(d);
      assert.equal(jourFerie(iso), reference[iso] ?? null, iso);
      if (reference[iso]) feries++;
    }
    assert.equal(feries, 11, "onze jours fériés nationaux");
  });
}

test("dates mobiles connues : Pâques 2026 le 5 avril, 2027 le 28 mars", () => {
  assert.equal(jourFerie("2026-04-06"), "Lundi de Pâques");
  assert.equal(jourFerie("2026-05-14"), "Ascension");
  assert.equal(jourFerie("2026-05-25"), "Lundi de Pentecôte");
  assert.equal(jourFerie("2027-03-29"), "Lundi de Pâques");
  assert.equal(jourFerie("2027-05-06"), "Ascension");
  assert.equal(jourFerie("2027-05-17"), "Lundi de Pentecôte");
});

test("le planning et Mon suivi n'ont plus leur propre calcul : ils lisent jourFerie", () => {
  for (const f of ["js/views/planning.js", "js/views/mon-suivi.js"]) {
    const source = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(!/easterSunday|frenchHolidays/.test(source), f + " : plus de copie du calcul");
    assert.match(source, /jourFerie\(isoDate\(date\)\)/, f + " : jourFerie");
  }
});
