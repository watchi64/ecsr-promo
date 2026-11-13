// Tests de source du travail en autonomie (relecture d'ensemble du lot 1 e-learning, 13/11/2026) : ce que les tests de règles
// ne voient pas, lu dans les fichiers, sans DOM ni réseau.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");
// Le corps d'une fonction de premier niveau : de sa ligne `function` à l'accolade fermante en colonne 0.
function corps(src, nom) {
  const m = new RegExp(String.raw`^(?:export )?(?:async )?function ${nom}\b[^\n]*\{\n`, "m").exec(src);
  assert.ok(m, `fonction ${nom} introuvable`);
  return src.slice(m.index, src.indexOf("\n}\n", m.index) + 2);
}

const DB = lire("js/db.js");
const PHRASE = "Tes formateurs et la direction de ton centre voient exactement cette page.";

test("listerAutonomie : les deux lectures passent par pages (toutesLesLignes), dans un ordre stable", () => {
  const c = corps(DB, "listerAutonomie");
  assert.equal((c.match(/toutesLesLignes\(/g) || []).length, 2, "deux lectures paginées");
  assert.match(c, /toutesLesLignes\(\(\) => supabase\.from\("cours_lectures"\)[^;]*?\.order\("promo_id"\)\.order\("cours_id"\)\)/);
  assert.match(c, /toutesLesLignes\(\(\) => supabase\.from\("autonomie_temps"\)[^;]*?\.order\("promo_id"\)\.order\("jour"\)\.order\("genre"\)\.order\("ressource"\)\)/);
});

test("listerAutonomie : seulement les colonnes que la fiche lit (minimisation)", () => {
  const c = corps(DB, "listerAutonomie");
  assert.match(c, /from\("cours_lectures"\)\.select\("cours_id, ouvert_le, vu_le, lu_le"\)/);
  assert.match(c, /from\("autonomie_temps"\)\.select\("jour, secondes"\)/);
  assert.doesNotMatch(c, /section|fin_atteinte/);
});

test("lecturesDeLaPromo : le commentaire dit qui la lit (l'équipe, interrupteur allumé)", () => {
  assert.doesNotMatch(DB, /Visible des stagiaires comme de l'équipe/);
  const i = DB.indexOf("export async function lecturesDeLaPromo");
  assert.match(DB.slice(i - 400, i), /notes\.lire/);
  assert.match(DB.slice(i - 400, i), /interrupteur/);
});

test("bouton Cours d'un cours lu : le nom accessible est le texte visible (pas d'aria-label), le titre garde « Relire le cours (lu) »", () => {
  const c = corps(lire("js/views/themes.js"), "marquerLigneAutonomie");
  assert.doesNotMatch(c, /setAttribute\("aria-label"|"aria-label":/);
  assert.match(c, /bouton\.title = "Relire le cours \(lu\)";/);
});

test("chargerAutonomieActive : éteint d'abord, et une lecture dépassée ne rallume rien", () => {
  const c = corps(lire("js/autonomie-etat.js"), "chargerAutonomieActive");
  const premiere = c.split("\n")[1].trim();
  assert.equal(premiere, "actif = false;", "la première instruction remet l'état à éteint");
  assert.match(c, /jeton/, "une lecture plus ancienne que la dernière demandée est ignorée");
});

test("la phrase du stagiaire est la même dans la règle, le robot et le guide de l'assistant", () => {
  assert.ok(lire("js/autonomie-rules.js").includes(`"${PHRASE}"`));
  const robot = lire("outils/parcours/autonomie.py");
  assert.ok(robot.includes(`NOTE_STAGIAIRE = "${PHRASE}"`));
  assert.ok(lire("supabase/functions/chatbot/aide.mjs").includes(`« ${PHRASE} »`));
  for (const f of ["js/autonomie-rules.js", "outils/parcours/autonomie.py", "supabase/functions/chatbot/aide.mjs"]) {
    assert.doesNotMatch(lire(f), /Ton formateur voit/, f);
  }
});
