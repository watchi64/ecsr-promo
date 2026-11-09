// Test de source (lot 5, Task 7) : en mode lecture (direction), aucune écriture de la page Émargement n'est atteignable. Chaque fonction
// de js/views/emargement.js qui appelle une écriture de db.js (ouvrir, signer, annoter, clore, rouvrir, régler l'en-tête) doit être gardée
// par `lecture` : soit avant son premier appel d'écriture, soit à chacun des endroits où elle est utilisée. Une lecture du fichier,
// sans DOM : elle échoue dès qu'un nouveau geste d'écriture est ajouté sans garde.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/views/emargement.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const ECRITURES = ["ouvrirEmargement", "signerEmargement", "signerEmargementFormateur", "annoterEmargement", "cloreEmargement",
  "rouvrirEmargement", "setEnteteEmargement"];

const appelDe = (nom) => new RegExp(String.raw`\b${nom}\(`);

// Fonctions de premier niveau : de la ligne `function` à l'accolade fermante en colonne 0.
function fonctions(src) {
  const sortie = [];
  const re = /^(?:export )?(?:async )?function (\w+)[^\n]*\{\n/gm;
  let m;
  while ((m = re.exec(src))) {
    const fin = src.indexOf("\n}\n", m.index);
    sortie.push({ nom: m[1], debut: m.index, fin, corps: src.slice(m.index, fin + 2) });
  }
  return sortie;
}
const FONCTIONS = fonctions(SOURCE);
const dans = (pos) => FONCTIONS.find((f) => pos >= f.debut && pos <= f.fin);
const usagesDe = (nom) => [...SOURCE.matchAll(new RegExp(String.raw`\b${nom}\b`, "g"))].map((m) => m.index);

test("la page repère bien ses fonctions d'écriture", () => {
  const ecrivaines = FONCTIONS.filter((f) => ECRITURES.some((e) => appelDe(e).test(f.corps)));
  assert.ok(ecrivaines.length >= 5, "au moins cinq fonctions d'écriture : " + ecrivaines.map((f) => f.nom));
});

// Un usage est gardé si sa fonction parle de `lecture` avant lui, ou si cette fonction n'est elle-même utilisée que de façon gardée.
function usageGarde(i, vus = new Set()) {
  const g = dans(i);
  if (!g) return false;
  if (g.corps.slice(0, i - g.debut).includes("lecture")) return true;
  if (vus.has(g.nom)) return false;
  vus.add(g.nom);
  const usages = usagesDe(g.nom).filter((j) => !(j >= g.debut && j <= g.fin) && !SOURCE.slice(Math.max(0, j - 9), j).includes("function "));
  return usages.length > 0 && usages.every((j) => usageGarde(j, vus));
}

test("chaque écriture de la page est gardée par le mode lecture", () => {
  for (const f of FONCTIONS) {
    const premier = Math.min(...ECRITURES.map((e) => { const i = f.corps.search(appelDe(e)); return i < 0 ? Infinity : i; }));
    if (premier === Infinity) continue;
    if (f.corps.slice(0, premier).includes("lecture")) continue;           // gardée dans la fonction elle-même
    const usages = usagesDe(f.nom).filter((i) => !(i >= f.debut && i <= f.fin) && !SOURCE.slice(Math.max(0, i - 9), i).includes("function "));
    assert.ok(usages.length > 0, f.nom + " écrit sans garde et n'est utilisée nulle part : à retirer ou à garder");
    for (const i of usages) assert.ok(usageGarde(i, new Set([f.nom])), `${f.nom} utilisée dans ${dans(i)?.nom} sans garde de lecture`);
  }
});

test("la lecture masque les gestes d'écriture visibles", () => {
  for (const geste of ["Faire signer ici", "Retirer l'absence", "Clore l'émargement", "Rouvrir", "Ouvrir l'émargement"]) {
    const i = SOURCE.indexOf('"' + geste + '"');
    assert.ok(i > 0, geste + " introuvable");
    const g = dans(i);
    const proche = SOURCE.slice(Math.max(g.debut, i - 1800), i);
    assert.ok(/if \(ctx\.lecture[ )]|!ctx\.lecture/.test(proche), `${geste} : aucune condition de lecture dans les 1800 caractères avant le bouton (${g.nom})`);
  }
});
