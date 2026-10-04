// Conditions d'utilisation : règle d'acceptation, extraction de l'essentiel, intégrité des
// textes. Lancer depuis la racine du dépôt : node tests/legal-rules.test.mjs
import assert from "node:assert/strict";
import { doitAccepter, aDejaAccepte, lignesEssentiel, dateVersion, reperesNonRemplis } from "../js/legal-rules.js";
import { VERSION_CONDITIONS, CONDITIONS_MD, MENTIONS_MD } from "../js/legal-data.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Acceptation par version
ok(doitAccepter([], "2026-10-04"), "aucune acceptation : on demande");
ok(doitAccepter(null, "2026-10-04"), "réponse vide : on demande");
ok(doitAccepter([{ version: "2026-09-02" }], "2026-10-04"), "ancienne version seulement : on redemande");
ok(!doitAccepter([{ version: "2026-09-02" }, { version: "2026-10-04" }], "2026-10-04"), "version en vigueur acceptée");
ok(!aDejaAccepte([]) && aDejaAccepte([{ version: "2026-09-02" }]), "première fois ou mise à jour");

// 2. Version : même format que le contrôle de accepter_conditions() en base
ok(/^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$/.test(VERSION_CONDITIONS), "format de version accepté par la base");
eq(dateVersion("2026-10-04"), "4 octobre 2026", "date lisible");
eq(dateVersion("2026-01-15b"), "15 janvier 2026", "suffixe de version ignoré");

// 3. L'essentiel : 8 lignes, reprises telles quelles dans la fenêtre d'acceptation
const essentiel = lignesEssentiel(CONDITIONS_MD);
eq(essentiel.length, 8, "l'essentiel en 8 lignes");
ok(essentiel.every((l) => !l.startsWith(">") && !l.includes("**L'essentiel")), "lignes nettoyées");
eq(lignesEssentiel("# Sans encadré"), [], "texte sans encadré");

// 4. Intégrité des textes
for (const [nom, md] of [["conditions", CONDITIONS_MD], ["mentions", MENTIONS_MD]]) {
  ok(!md.includes(String.fromCharCode(0x2014)), `${nom} : aucun tiret cadratin`);
  ok(md.startsWith("# "), `${nom} : commence par son titre`);
}
for (let s = 1; s <= 16; s++) ok(CONDITIONS_MD.includes(`\n## ${s}. `), `section ${s} présente`);
ok(/contact@timy-studio\.fr/.test(CONDITIONS_MD) && /contact@timy-studio\.fr/.test(MENTIONS_MD), "contact présent");
ok(/CNIL/.test(CONDITIONS_MD), "droit de réclamation auprès de la CNIL");
ok(!/Gemini|Google/.test(CONDITIONS_MD), "aucun prestataire retiré n'est cité");

// 5. Garde-fou de publication : aucun repère à compléter ne doit rester.
eq(reperesNonRemplis(CONDITIONS_MD), [], "conditions : repères à compléter");
eq(reperesNonRemplis(MENTIONS_MD), [], "mentions légales : SIRET et adresse à renseigner");

console.log(`legal-rules : ${n} vérifications OK`);
