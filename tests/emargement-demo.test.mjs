import test from "node:test";
import assert from "node:assert/strict";
import { signatureFictive } from "../scripts/emargement-demo.mjs";
import { cheminValide } from "../js/emargement-rules.js";

const xs = (d) => [...d.matchAll(/[ML](\d+) (\d+)/g)].map((m) => Number(m[1]));

test("chaque signature fictive est un tracé valide, assez large", () => {
  for (const nom of ["Camille Martin", "Kevin Mercier", "Claire", "Marc", "Léa Dubois", "Hugo"]) {
    for (let v = 0; v < 12; v++) {
      const d = signatureFictive(nom, v);
      assert.ok(cheminValide(d), `${nom} ${v} : ${d.slice(0, 60)}`);
      const x = xs(d);
      assert.ok(Math.max(...x) - Math.min(...x) >= 120, `${nom} ${v} trop étroite`);
    }
  }
});

test("même personne, même variation : même tracé ; autre variation : léger écart", () => {
  assert.equal(signatureFictive("Camille Martin", 3), signatureFictive("Camille Martin", 3));
  assert.notEqual(signatureFictive("Camille Martin", 3), signatureFictive("Camille Martin", 4));
  assert.notEqual(signatureFictive("Camille Martin", 3), signatureFictive("Kevin Mercier", 3));
});
