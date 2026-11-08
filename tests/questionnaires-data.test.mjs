// Contenu des questionnaires Qualiopi : clés, fourchettes, ids, globale, textes interdits,
// et mentions des conditions d'utilisation. Lancer : node tests/questionnaires-data.test.mjs
import assert from "node:assert/strict";
import { QUESTIONNAIRES, ECHELLE, seuilDe } from "../js/questionnaires-data.js";
import { VERSION_CONDITIONS, CONDITIONS_MD } from "../js/legal-data.js";

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const tiret = String.fromCharCode(0x2014);

eq(Object.keys(QUESTIONNAIRES).sort(), ["fin_formateur", "fin_stagiaire", "six_mois_stagiaire"], "trois clés exactes");

const fourchettes = {
  fin_stagiaire: [8, 10, "stagiaire"],
  six_mois_stagiaire: [4, 5, "stagiaire"],
  fin_formateur: [6, 8, "formateur"],
};
for (const [cle, [min, max, pub]] of Object.entries(fourchettes)) {
  const q = QUESTIONNAIRES[cle];
  eq(q.cle, cle, `${cle} : clé interne`);
  eq(q.public, pub, `${cle} : public`);
  eq(q.version, 1, `${cle} : version 1`);
  ok(q.titre && q.intro, `${cle} : titre et introduction`);
  ok(q.questions.length >= min && q.questions.length <= max, `${cle} : ${q.questions.length} questions dans ${min}-${max}`);
  const ids = q.questions.map((x) => x.id);
  eq(new Set(ids).size, ids.length, `${cle} : ids uniques`);
  eq(q.questions.filter((x) => x.globale === true).length, 1, `${cle} : une seule question globale`);
  const g = q.questions.find((x) => x.globale);
  eq(g.type, "echelle", `${cle} : la globale est une échelle`);
  ok(!g.facultative, `${cle} : la globale est obligatoire`);
  for (const x of q.questions) {
    ok(["echelle", "choix", "commentaire"].includes(x.type), `${cle}/${x.id} : type connu`);
    ok(x.texte && x.texte.length > 5, `${cle}/${x.id} : texte`);
    ok(typeof x.facultative === "boolean", `${cle}/${x.id} : facultative explicite`);
    if (x.type === "choix") ok(Array.isArray(x.options) && x.options.length >= 2, `${cle}/${x.id} : options`);
  }
  const com = q.questions.filter((x) => x.type === "commentaire");
  eq(com.length, 1, `${cle} : un seul commentaire`);
  ok(com[0].facultative && /cite personne/i.test(com[0].texte), `${cle} : commentaire facultatif, ne cite personne`);
  const texte = JSON.stringify(q);
  ok(!texte.includes(tiret), `${cle} : aucun tiret cadratin`);
  ok(!/\bprof\b/i.test(texte), `${cle} : jamais « prof »`);
}

ok(QUESTIONNAIRES.fin_stagiaire.questions.some((x) => x.id === "app" && x.facultative), "fin de formation : question facultative sur l'app");

// Échelle : 1 à 4 plus « sans avis »
eq(ECHELLE.map((e) => e.valeur), [1, 2, 3, 4, null], "échelle 1 à 4 et sans avis");
ok(ECHELLE.every((e) => e.libelle), "libellés d'échelle");

// Seuils
eq(seuilDe("stagiaire"), 5, "seuil stagiaires");
eq(seuilDe("formateur"), 3, "seuil formateurs");

// Conditions d'utilisation
ok(/^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$/.test(VERSION_CONDITIONS), "format de version");
ok(VERSION_CONDITIONS !== "2026-10-23", "nouvelle version des conditions");
ok(VERSION_CONDITIONS === "2026-11-08", "version du jour");
ok(/Qualiopi/.test(CONDITIONS_MD), "conditions : Qualiopi cité");
ok(/financeurs/.test(CONDITIONS_MD), "conditions : financeurs cités");
ok(/anonymes?/.test(CONDITIONS_MD) && /sans (votre )?nom/.test(CONDITIONS_MD), "conditions : questionnaires anonymes");
ok(/trois ans/.test(CONDITIONS_MD), "conditions : conservation trois ans");
ok(!CONDITIONS_MD.includes(tiret), "conditions : aucun tiret cadratin");
ok(!/\bprof\b/i.test(CONDITIONS_MD), "conditions : jamais « prof »");

console.log(`questionnaires-data : ${n} vérifications OK`);
