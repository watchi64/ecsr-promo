// Assemble l'essai à blanc de la migration 20261110_epcf_moyennes_seuil_3 (seuil d'anonymat de 3) : la preuve
// tests/sql/epcf-moyennes-preuve.sql, avec la fonction de la migration injectée par `execute` à la place de la ligne
// « -- MIGRATION ». La levée finale de la preuve annule la migration avec tout le reste : rien ne reste en base.
//   node outils/assembler_preuve_epcf.mjs essai <sortie.sql>      la migration injectée : VERT attendu
//   node outils/assembler_preuve_epcf.mjs retour <sortie.sql>     le retour injecté : ROUGE attendu (seuil de 2), et
//                                                                 l'empreinte rendue égale celle d'avant la migration
//   node outils/assembler_preuve_epcf.mjs en-ligne <sortie.sql>   rien d'injecté : ROUGE avant application, VERT après
// Les fins de ligne CRLF d'une copie de travail Windows sont ramenées à LF : la fonction injectée a ainsi le même texte
// (et la même empreinte) que celle appliquée par psql depuis un fichier LF.
import { readFileSync, writeFileSync } from "node:fs";

const MIGRATIONS = {
  essai: "supabase/migrations/20261110_epcf_moyennes_seuil_3.sql",
  retour: "supabase/migrations/20261110_epcf_moyennes_seuil_3_retour.sql",
};
const [mode, sortie] = process.argv.slice(2);
if (!["essai", "retour", "en-ligne"].includes(mode) || !sortie) {
  console.error("usage : node outils/assembler_preuve_epcf.mjs essai|retour|en-ligne <sortie.sql>");
  process.exit(2);
}
const lf = (t) => t.replace(/\r\n/g, "\n");
const preuve = lf(readFileSync("tests/sql/epcf-moyennes-preuve.sql", "utf8"));
const marque = "  -- MIGRATION";
if (preuve.split(marque).length !== 2) {
  console.error("la preuve doit contenir une seule ligne « -- MIGRATION »");
  process.exit(2);
}
let injection = marque;
if (mode !== "en-ligne") {
  const migration = lf(readFileSync(MIGRATIONS[mode], "utf8"));
  const debut = migration.indexOf("create or replace function");
  const fonction = migration.slice(debut).trim();
  if (debut < 0 || !fonction.endsWith("$$;") || fonction.includes("$migration$")) {
    console.error("migration illisible : « create or replace function ... $$; » attendu");
    process.exit(2);
  }
  injection = "  execute $migration$\n" + fonction.slice(0, -1) + "\n$migration$;";
}
// Une fonction de remplacement, pas une chaîne : dans une chaîne de remplacement, « $$ » deviendrait « $ ».
writeFileSync(sortie, preuve.replace(marque, () => injection));
console.log(`${mode} : ${sortie}`);
