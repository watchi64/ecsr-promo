import test from "node:test";
import assert from "node:assert/strict";
import { signatureFictive, migrationDemo } from "../scripts/emargement-demo.mjs";
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

test("migration de démonstration : 200 lignes, tracés valides, aucun cadratin, à jour dans le dépôt", async () => {
  const texte = migrationDemo();
  assert.ok(!texte.includes("—"), "tiret cadratin");
  const traces = [...texte.matchAll(/\('[^']+', \d, '(M[^']+)'\)/g)].map((m) => m[1]);
  assert.equal(traces.length, 48);
  for (const t of traces) assert.ok(cheminValide(t));
  const lignes = texte.match(/\('2026-10-\d\d', '(matin|aprem)', /g) || [];
  assert.equal(lignes.length, 200);
  const { readFileSync } = await import("node:fs");
  assert.equal(readFileSync("supabase/migrations/20261023_emargement_demo.sql", "utf8").replace(/\r\n/g, "\n"), texte,
    "fichier de migration à regénérer : node scripts/emargement-demo.mjs");
});

test("même personne, même variation : même tracé ; autre variation : léger écart", () => {
  assert.equal(signatureFictive("Camille Martin", 3), signatureFictive("Camille Martin", 3));
  assert.notEqual(signatureFictive("Camille Martin", 3), signatureFictive("Camille Martin", 4));
  assert.notEqual(signatureFictive("Camille Martin", 3), signatureFictive("Kevin Mercier", 3));
});
