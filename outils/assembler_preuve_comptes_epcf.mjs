// Assemble la preuve des EPCF du CCP2 dans les chiffres du réseau (migration 20261124_epcf_ccp2_reseau) :
// tests/sql/comptes-epcf-ccp2-preuve.sql, avec la fixture commune à la place de la ligne « -- FIXTURE » et, selon le mode, la migration
// (et son retour) injectée par `execute` à la place de la ligne « -- MIGRATION ». La levée finale de la preuve annule tout.
//   node outils/assembler_preuve_comptes_epcf.mjs essai <sortie.sql>      la migration injectée : VERT attendu
//   node outils/assembler_preuve_comptes_epcf.mjs retour <sortie.sql>     la migration puis son retour : ROUGE attendu (CCP1 seul)
//   node outils/assembler_preuve_comptes_epcf.mjs contre <sortie.sql>     la migration dont le seuil de 3 est retiré : ROUGE attendu
//   node outils/assembler_preuve_comptes_epcf.mjs en-ligne <sortie.sql>   rien d'injecté : ROUGE avant application, VERT après
// Le texte injecté est celui des migrations après leur ligne « set local lock_timeout », fins de ligne ramenées à LF.
import { readFileSync, writeFileSync } from "node:fs";

const MIGRATION = "supabase/migrations/20261124_epcf_ccp2_reseau.sql";
const RETOUR = "supabase/migrations/20261124_epcf_ccp2_reseau_retour.sql";
const FIXTURE = "tests/fixtures/comptes-epcf-ccp2.json";
const PREUVE = "tests/sql/comptes-epcf-ccp2-preuve.sql";
const [mode, sortie] = process.argv.slice(2);
if (!["essai", "retour", "contre", "en-ligne"].includes(mode) || !sortie) {
  console.error("usage : node outils/assembler_preuve_comptes_epcf.mjs essai|retour|contre|en-ligne <sortie.sql>");
  process.exit(2);
}
const lire = (chemin) => readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
function arreter(message) {
  console.error(message);
  process.exit(2);
}

function corps(chemin) {
  const texte = lire(chemin);
  const m = texte.match(/^set local lock_timeout = '3s';\n/m);
  const reste = m ? texte.slice(m.index + m[0].length).trim() : "";
  if (!m || !reste.endsWith(";") || reste.includes("$migration$")) {
    arreter(`${chemin} illisible : une ligne « set local lock_timeout = '3s'; » puis des instructions attendues`);
  }
  return "  execute $migration$\n" + reste + "\n$migration$;";
}

// Contre-épreuve : le seuil retiré (il doit y être, une seule fois). La garde de la migration porte sur le corps d'avant : elle passe.
function sansSeuil(texte) {
  const seuil = "where g.trame <> 'ccp2' or g.evalues >= 3";
  if (texte.split(seuil).length !== 2) arreter("le seuil du CCP2 est introuvable dans la migration");
  return texte.replace(seuil, () => "where true");
}

function remplacer(texte, ligne, contenu) {
  if (texte.split("\n" + ligne + "\n").length !== 2) arreter(`la preuve doit contenir une seule ligne « ${ligne.trim()} »`);
  return texte.replace("\n" + ligne + "\n", () => "\n" + contenu + "\n");
}

const fixture = JSON.stringify(JSON.parse(lire(FIXTURE)));
if (fixture.includes("$fixture$") || fixture.includes("$preuve$")) arreter("la fixture contient un délimiteur de la preuve");
const injection = mode === "essai" ? corps(MIGRATION)
  : mode === "contre" ? sansSeuil(corps(MIGRATION))
  : mode === "retour" ? corps(MIGRATION) + "\n" + corps(RETOUR)
  : "  -- rien d'injecté";
let preuve = remplacer(lire(PREUVE), "-- FIXTURE", "$fixture$" + fixture + "$fixture$");
preuve = remplacer(preuve, "  -- MIGRATION", injection);
writeFileSync(sortie, preuve);
console.log(`${sortie} écrit (mode ${mode})`);
