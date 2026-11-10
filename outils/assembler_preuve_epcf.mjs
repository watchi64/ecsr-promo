// Assemble l'essai à blanc de la migration 20261109_epcf_moyennes_anonymat : la preuve
// tests/sql/epcf-moyennes-preuve.sql, avec la fonction de la migration injectée par `execute` à la place de la ligne
// « -- MIGRATION ». La levée finale de la preuve annule la migration avec tout le reste : rien ne reste en base.
//   node outils/assembler_preuve_epcf.mjs essai <sortie.sql>      la migration injectée : VERT attendu
//   node outils/assembler_preuve_epcf.mjs en-ligne <sortie.sql>   rien d'injecté : ROUGE avant application, VERT après
import { readFileSync, writeFileSync } from "node:fs";

const [mode, sortie] = process.argv.slice(2);
if (!["essai", "en-ligne"].includes(mode) || !sortie) {
  console.error("usage : node outils/assembler_preuve_epcf.mjs essai|en-ligne <sortie.sql>");
  process.exit(2);
}
const preuve = readFileSync("tests/sql/epcf-moyennes-preuve.sql", "utf8");
const migration = readFileSync("supabase/migrations/20261109_epcf_moyennes_anonymat.sql", "utf8");
const debut = migration.indexOf("create or replace function");
const fonction = migration.slice(debut).trim();
if (debut < 0 || !fonction.endsWith("$$;") || fonction.includes("$migration$")) {
  console.error("migration illisible : « create or replace function ... $$; » attendu");
  process.exit(2);
}
const marque = "  -- MIGRATION";
if (preuve.split(marque).length !== 2) {
  console.error("la preuve doit contenir une seule ligne « -- MIGRATION »");
  process.exit(2);
}
const injection = mode === "essai" ? "  execute $migration$\n" + fonction.slice(0, -1) + "\n$migration$;" : marque;
// Une fonction de remplacement, pas une chaîne : dans une chaîne de remplacement, « $$ » deviendrait « $ ».
writeFileSync(sortie, preuve.replace(marque, () => injection));
console.log(`${mode} : ${sortie}`);
