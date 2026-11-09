// Contenu des questionnaires Qualiopi : clés, fourchettes, ids, globale, textes interdits, mentions des conditions
// d'utilisation, et accord du catalogue avec la table questionnaire_questions de la migration.
// Lancer : node tests/questionnaires-data.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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
ok(/sans (votre )?nom/.test(CONDITIONS_MD), "conditions : réponses aux questionnaires enregistrées sans nom");
ok(/trois ans/.test(CONDITIONS_MD), "conditions : conservation trois ans");
ok(!CONDITIONS_MD.includes(tiret), "conditions : aucun tiret cadratin");
ok(!/\bprof\b/i.test(CONDITIONS_MD), "conditions : jamais « prof »");

// Ce que l'anonymat garantit vraiment (relecture finale, I1) : rien face à qui lit les tables de la base (éditeur SQL),
// tout dans l'application et ses documents. Aucun texte ne promet plus que cela.
const PROMESSES_FAUSSES = [/pas même l'éditeur/i, /personne ne peut savoir/i, /personne ne peut relier/i];
for (const t of [CONDITIONS_MD, ...Object.values(QUESTIONNAIRES).map((q) => q.intro)]) {
  for (const m of PROMESSES_FAUSSES) ok(!m.test(t), `aucune promesse au-delà de ce que la base garantit : ${m}`);
}
ok(/\*\*Limite de cet anonymat\.\*\*/.test(CONDITIONS_MD) && /ne pas lire ces tables directement/.test(CONDITIONS_MD),
  "conditions : la limite technique et l'engagement de l'éditeur sont écrits");
const ligneDuree = CONDITIONS_MD.split("\n").find((l) => l.startsWith("| Questionnaires de satisfaction |"));
ok(ligneDuree && !/sans limite/.test(ligneDuree) && /trois ans/.test(ligneDuree), "conditions : réponses gardées trois ans, plus sans limite");
ok(/31 décembre de l'année suivante/.test(ligneDuree), "conditions : effacement des commentaires des formateurs daté");
for (const q of Object.values(QUESTIONNAIRES)) {
  ok(/sans ton nom, sans ton compte et sans date/.test(q.intro), `${q.cle} : introduction, sans nom, sans compte, sans date`);
  ok(q.intro.includes(`à partir de ${seuilDe(q.public)} réponses`), `${q.cle} : introduction, le seuil de son public`);
}

// Le catalogue de l'app et la table questionnaire_questions de la base disent la même chose (relecture finale, I2).
// La base refuse un envoi dont une question, une option ou une version lui est inconnue : un écart ne se verrait qu'au
// dernier écran du questionnaire, et pour celui à six mois, des mois plus tard. On relit donc chaque
// `insert into public.questionnaire_questions` des migrations et on compare, pour la version en cours de chaque
// questionnaire : ids, types, facultatives, options (le commentaire libre est une colonne à part, pas une question).
const DOSSIER_MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);

// Valeurs SQL d'une liste `values (...), (...)` : chaînes '...' (avec '' pour une apostrophe), entiers, true, false,
// null, array['...', ...]. Rend un tableau de lignes, chaque ligne un tableau de valeurs.
function lignesSql(source) {
  let i = 0;
  const blanc = () => { while (i < source.length && /\s/.test(source[i])) i++; };
  const attendre = (c) => { blanc(); assert.equal(source[i], c, `SQL : « ${c} » attendu à la position ${i}`); i++; };
  const chaine = () => {
    attendre("'");
    let s = "";
    for (;;) {
      assert.ok(i < source.length, "SQL : chaîne non fermée");
      if (source[i] === "'") {
        if (source[i + 1] === "'") { s += "'"; i += 2; continue; }
        i++;
        return s;
      }
      s += source[i++];
    }
  };
  const valeur = () => {
    blanc();
    if (source[i] === "'") return chaine();
    const mot = /^[a-z0-9_]+/i.exec(source.slice(i))?.[0];
    assert.ok(mot, `SQL : valeur illisible à la position ${i}`);
    i += mot.length;
    if (mot.toLowerCase() === "array") {
      attendre("[");
      const liste = [];
      blanc();
      while (source[i] !== "]") { liste.push(chaine()); blanc(); if (source[i] === ",") i++; blanc(); }
      i++;
      return liste;
    }
    if (/^\d+$/.test(mot)) return Number(mot);
    const fixes = { true: true, false: false, null: null };
    assert.ok(mot.toLowerCase() in fixes, `SQL : mot inattendu « ${mot} »`);
    return fixes[mot.toLowerCase()];
  };
  const lignes = [];
  for (;;) {
    attendre("(");
    const ligne = [valeur()];
    for (blanc(); source[i] === ","; blanc()) { i++; ligne.push(valeur()); }
    attendre(")");
    lignes.push(ligne);
    blanc();
    if (source[i] === ";") return lignes;
    attendre(",");
  }
}

const COLONNES = "cle, version, question_id, type, facultative, options";
const lignesBase = [];
for (const nom of readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith(".sql") && !f.includes("_retour")).sort()) {
  const sql = readFileSync(new URL(nom, DOSSIER_MIGRATIONS), "utf8");
  const motif = /insert\s+into\s+public\.questionnaire_questions\s*\(([^)]*)\)\s*values/gi;
  for (let m; (m = motif.exec(sql));) {
    eq(m[1].replace(/\s+/g, " ").trim(), COLONNES, `${nom} : colonnes de questionnaire_questions dans l'ordre attendu`);
    lignesBase.push(...lignesSql(sql.slice(motif.lastIndex)));
  }
}
ok(lignesBase.length > 0, "migrations : au moins un insert dans questionnaire_questions");

const forme = ([cle, version, id, type, facultative, options]) =>
  JSON.stringify({ cle, version, id, type, facultative, options: options ?? null });
const parId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
for (const q of Object.values(QUESTIONNAIRES)) {
  const app = q.questions.filter((x) => x.type !== "commentaire")
    .map((x) => forme([q.cle, q.version, x.id, x.type, x.facultative, x.type === "choix" ? x.options : null]))
    .sort(parId);
  const base = lignesBase.filter(([cle, version]) => cle === q.cle && version === q.version).map(forme).sort(parId);
  eq(base, app, `${q.cle} version ${q.version} : la migration et js/questionnaires-data.js disent les mêmes questions`);
}
const clesBase = [...new Set(lignesBase.map(([cle]) => cle))].sort();
eq(clesBase, Object.keys(QUESTIONNAIRES).sort(), "migration : aucune clé de questionnaire inconnue de l'app");

console.log(`questionnaires-data : ${n} vérifications OK`);
