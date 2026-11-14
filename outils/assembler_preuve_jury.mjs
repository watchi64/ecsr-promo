// Assemble la preuve des résultats du jury (migration 20261114_jury_resultats) : tests/sql/jury-preuve.sql, avec la migration (et,
// en mode retour, son retour) injectée par `execute` à la place de la ligne « -- MIGRATION ». La levée finale de la preuve annule
// tout : rien ne reste en base.
//   node outils/assembler_preuve_jury.mjs essai <sortie.sql>      la migration injectée : VERT attendu
//   node outils/assembler_preuve_jury.mjs retour <sortie.sql>     la migration puis son retour : ROUGE attendu (table absente)
//   node outils/assembler_preuve_jury.mjs en-ligne <sortie.sql>   rien d'injecté : ROUGE avant application, VERT après
//   node outils/assembler_preuve_jury.mjs contre <sortie.sql>     contre-épreuve : la règle de lecture ouverte à tout compte
//                                                                connecté (using true) : ROUGE attendu sur L et D
// Le texte injecté est celui des migrations après leur ligne « set local lock_timeout », fins de ligne ramenées à LF.
import { readFileSync, writeFileSync } from "node:fs";

const MIGRATION = "supabase/migrations/20261114_jury_resultats.sql";
const RETOUR = "supabase/migrations/20261114_jury_resultats_retour.sql";
const [mode, sortie] = process.argv.slice(2);
if (!["essai", "retour", "en-ligne", "contre"].includes(mode) || !sortie) {
  console.error("usage : node outils/assembler_preuve_jury.mjs essai|retour|en-ligne|contre <sortie.sql>");
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

// Contre-épreuve : la règle de lecture remplacée par une lecture ouverte (elle doit y être, une seule fois).
function lectureOuverte(texte) {
  const motif = /\ncreate policy jury_resultats_lecture on public\.jury_resultats for select to authenticated\n  using \([^;]*\);\n/;
  if (!motif.test(texte)) {
    console.error("règle jury_resultats_lecture introuvable dans la migration");
    process.exit(2);
  }
  return texte.replace(motif, () => "\ncreate policy jury_resultats_lecture on public.jury_resultats for select to authenticated using (true);\n");
}

const preuve = lf(readFileSync("tests/sql/jury-preuve.sql", "utf8"));
const marque = "  -- MIGRATION";
if (preuve.split(marque).length !== 2) {
  console.error("la preuve doit contenir une seule ligne « -- MIGRATION »");
  process.exit(2);
}
const injection = mode === "essai" ? corps(MIGRATION)
  : mode === "contre" ? lectureOuverte(corps(MIGRATION))
  : mode === "retour" ? corps(MIGRATION) + "\n" + corps(RETOUR)
  : marque;
writeFileSync(sortie, preuve.replace(marque, () => injection));
console.log(`${sortie} écrit (mode ${mode})`);
