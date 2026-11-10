// Chaque feuille de style a ses accolades équilibrées. Une fusion qui garde « les deux blocs » ajoutés en fin de fichier
// peut perdre l'accolade fermante d'un @media : tout ce qui suit ne s'applique alors plus qu'à cette largeur d'écran, et ni
// le navigateur ni les autres tests ne le disent (vu le 10/11 sur le lot 5 : le bloc du planning du lot B était passé sous
// @media (max-width: 480px)).
// Lancer : node --test tests/css-accolades.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Les accolades hors commentaires et hors chaînes : rend la ligne de chaque ouvrante restée seule et de chaque fermante en trop.
export function accoladesOrphelines(css) {
  const pile = [], enTrop = [];
  let ligne = 1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") { ligne++; continue; }
    if (c === "/" && css[i + 1] === "*") {
      const fin = css.indexOf("*/", i + 2);
      const bout = fin < 0 ? css.length : fin + 2;
      ligne += (css.slice(i, bout).match(/\n/g) || []).length;
      i = bout - 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c && css[j] !== "\n") j += css[j] === "\\" ? 2 : 1;
      i = j;
      continue;
    }
    if (c === "{") pile.push(ligne);
    else if (c === "}") { if (pile.length) pile.pop(); else enTrop.push(ligne); }
  }
  return { ouvertes: pile, enTrop };
}

test("accoladesOrphelines : équilibré, ouvrante seule, fermante en trop, commentaires et chaînes ignorés", () => {
  assert.deepEqual(accoladesOrphelines("a { b: c; }\n@media (x) {\n  d { e: f; }\n}\n"), { ouvertes: [], enTrop: [] });
  assert.deepEqual(accoladesOrphelines("@media (x) {\n  d { e: f; }\n"), { ouvertes: [1], enTrop: [] });
  assert.deepEqual(accoladesOrphelines("a { b: c; }\n}\n"), { ouvertes: [], enTrop: [2] });
  assert.deepEqual(accoladesOrphelines("/* { */ a { content: \"}\"; }"), { ouvertes: [], enTrop: [] });
});

test("toutes les feuilles de style de css/ ont leurs accolades équilibrées", () => {
  const fichiers = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css"));
  assert.ok(fichiers.length > 0, "aucune feuille trouvée");
  for (const f of fichiers) {
    const r = accoladesOrphelines(readFileSync(new URL("../css/" + f, import.meta.url), "utf8"));
    assert.deepEqual(r, { ouvertes: [], enTrop: [] }, `css/${f} : accolades ouvertes aux lignes ${r.ouvertes.join(", ") || "aucune"}, en trop aux lignes ${r.enTrop.join(", ") || "aucune"}`);
  }
});
