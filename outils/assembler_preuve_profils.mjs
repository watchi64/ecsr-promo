// Assemble l'essai à blanc de la migration 20261110_profils_email_stagiaires : la preuve
// tests/sql/profils-email-preuve.sql, avec la migration (et, en mode retour, son retour) injectée par `execute` à la
// place de la ligne « -- MIGRATION ». La levée finale de la preuve annule tout : rien ne reste en base.
//   node outils/assembler_preuve_profils.mjs essai <sortie.sql>      la migration injectée : VERT attendu
//   node outils/assembler_preuve_profils.mjs retour <sortie.sql>     la migration puis son retour : ROUGE attendu (la
//                                                                    fuite revient) et les empreintes d'avant
//   node outils/assembler_preuve_profils.mjs en-ligne <sortie.sql>   rien d'injecté : ROUGE avant application, VERT après
// Le texte injecté est celui des migrations après leur ligne « set local lock_timeout », fins de ligne ramenées à LF
// (la fonction créée a ainsi la même empreinte que celle appliquée par psql depuis un fichier LF).
import { readFileSync, writeFileSync } from "node:fs";

const MIGRATION = "supabase/migrations/20261110_profils_email_stagiaires.sql";
const RETOUR = "supabase/migrations/20261110_profils_email_stagiaires_retour.sql";
const [mode, sortie] = process.argv.slice(2);
if (!["essai", "retour", "en-ligne"].includes(mode) || !sortie) {
  console.error("usage : node outils/assembler_preuve_profils.mjs essai|retour|en-ligne <sortie.sql>");
  process.exit(2);
}
const lf = (t) => t.replace(/\r\n/g, "\n");

function corps(chemin) {
  const texte = lf(readFileSync(chemin, "utf8"));
  const m = texte.match(/^set local lock_timeout = '3s';\n/m);
  const reste = m ? texte.slice(m.index + m[0].length).trim() : "";
  if (!m || !reste.endsWith(";") || reste.includes("$migration$")) {
    console.error(`${chemin} illisible : une ligne « set local lock_timeout = '3s'; » puis des instructions attendues`);
    process.exit(2);
  }
  return "  execute $migration$\n" + reste + "\n$migration$;";
}

const preuve = lf(readFileSync("tests/sql/profils-email-preuve.sql", "utf8"));
const marque = "  -- MIGRATION";
if (preuve.split(marque).length !== 2) {
  console.error("la preuve doit contenir une seule ligne « -- MIGRATION »");
  process.exit(2);
}
const injection = mode === "essai" ? corps(MIGRATION)
  : mode === "retour" ? corps(MIGRATION) + "\n" + corps(RETOUR)
  : marque;
// Une fonction de remplacement, pas une chaîne : dans une chaîne de remplacement, « $$ » deviendrait « $ ».
writeFileSync(sortie, preuve.replace(marque, () => injection));
console.log(`${mode} : ${sortie}`);
