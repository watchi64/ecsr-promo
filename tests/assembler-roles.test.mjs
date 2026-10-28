import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NEUTRE, RACINE, assembler, assemblerMode, md5, principal } from "../outils/assembler_repetition_roles.mjs";

// outils/assembler_repetition_roles.mjs fabrique le fichier SQL d'une répétition du lot 4 : le gabarit de la preuve,
// les aides communes collées telles quelles, et en littéraux dollar la requête d'empreinte, la migration et son retour.
// Les premiers tests lisent les vrais fichiers du dépôt (ce qui part en base doit en être la copie exacte) ; les
// suivants donnent à la fonction pure des fichiers en mémoire, pour les refus.

const EMPREINTE = "tests/sql/roles-empreinte.sql";
const MIGRATION = "supabase/migrations/20261028_roles_1_fondations.sql";
const RETOUR = "supabase/migrations/20261028_roles_1_fondations_retour.sql";
const AIDES = "tests/sql/roles-aides.sql";
const SCRIPT = join(RACINE, "outils", "assembler_repetition_roles.mjs");

const texteDuDepot = (chemin) => readFileSync(join(RACINE, chemin), "utf8").replace(/\r/g, "");
const enMemoire = (fichiers) => (chemin) => (chemin in fichiers ? fichiers[chemin] : null);

/** Les littéraux de la sortie, dans l'ordre : le texte entre chaque paire de délimiteurs. Le délimiteur ne figure nulle
 *  part ailleurs (l'assembleur le choisit ainsi), donc ses occurrences vont par paires. */
function litteraux(sortie, delimiteur) {
  const morceaux = sortie.split(delimiteur);
  assert.equal(morceaux.length % 2, 1, `${delimiteur} doit apparaître un nombre pair de fois`);
  return morceaux.filter((_, i) => i % 2 === 1);
}

test("etape-1 : chaque fichier injecté s'y trouve octet pour octet (md5 du texte sans retour chariot = md5 du littéral)", () => {
  const { texte, injections, neutralises } = assemblerMode("etape-1");
  assert.deepEqual(injections.map((x) => x.chemin), [EMPREINTE, MIGRATION, RETOUR]);
  assert.deepEqual(neutralises, []);
  const delimiteurs = new Set(injections.map((x) => x.delimiteur));
  assert.equal(delimiteurs.size, 1, "un seul délimiteur pour toute la sortie");
  const contenus = litteraux(texte, [...delimiteurs][0]);
  assert.equal(contenus.length, injections.length);
  injections.forEach((x, i) => {
    assert.equal(md5(contenus[i]), md5(texteDuDepot(x.chemin)), x.chemin);
    assert.equal(x.md5, md5(texteDuDepot(x.chemin)), `md5 annoncé pour ${x.chemin}`);
  });
  assert.ok(!texte.includes("\r"), "la sortie est en fins de ligne LF");
});

test("etape-1 : les aides sont collées telles quelles, l'en-tête dit d'où vient chaque morceau", () => {
  const { texte, inclusions } = assemblerMode("etape-1");
  assert.deepEqual(inclusions.map((x) => x.chemin), [AIDES]);
  assert.ok(texte.includes(texteDuDepot(AIDES)));
  for (const chemin of [AIDES, EMPREINTE, MIGRATION, RETOUR]) {
    assert.ok(texte.includes(`${chemin} (md5 ${md5(texteDuDepot(chemin))})`), `en-tête : ${chemin}`);
  }
  assert.ok(!/^\s*--\s*@@/m.test(texte), "plus aucun marqueur dans la sortie");
});

test("etape-1-sans : ni la migration ni son retour, deux littéraux 'select 1' à leur place, l'empreinte toujours là", () => {
  const { texte, injections, neutralises } = assemblerMode("etape-1-sans");
  assert.deepEqual(neutralises, [MIGRATION, RETOUR]);
  assert.deepEqual(injections.map((x) => x.chemin), [EMPREINTE]);
  assert.equal(texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 2);
  assert.equal(texte.split(NEUTRE).length - 1, 2, "le littéral neutre n'apparaît nulle part ailleurs");
  for (const extrait of ["create table public.affectations", "create function public.", "drop table public.affectations",
    "drop function public.", texteDuDepot(MIGRATION), texteDuDepot(RETOUR)]) {
    assert.ok(!texte.includes(extrait), `absent : ${extrait.slice(0, 40)}`);
  }
  const [contenu] = litteraux(texte, injections[0].delimiteur);
  assert.equal(md5(contenu), md5(texteDuDepot(EMPREINTE)));
});

test("etape-1-sans ne lit pas les fichiers neutralisés : elle s'assemble même s'ils n'existent pas encore", () => {
  const gabarit = "do $preuve$\nbegin\n  execute\n-- @@INJECTER m.sql@@\n  ;\nend $preuve$;\n";
  const r = assembler(gabarit, enMemoire({}), { neutres: ["m.sql"] });
  assert.ok(r.texte.includes(`\n${NEUTRE}\n`));
  assert.deepEqual(r.neutralises, ["m.sql"]);
});

test("fins de ligne : gabarit et fichiers en CRLF donnent une sortie en LF, le littéral égale le texte sans retour chariot", () => {
  const gabarit = "do $preuve$\r\nbegin\r\n  execute\r\n-- @@INJECTER m.sql@@\r\n  ;\r\nend $preuve$;\r\n";
  const r = assembler(gabarit, enMemoire({ "m.sql": "select 1;\r\nselect 2;\r\n" }));
  assert.ok(!r.texte.includes("\r"));
  assert.deepEqual(litteraux(r.texte, r.injections[0].delimiteur), ["select 1;\nselect 2;\n"]);
});

test("délimiteur : choisi absent du gabarit et de tous les fichiers, et sans se former avec la fin d'un texte", () => {
  const gabarit = "do $preuve$\nbegin\n  execute\n-- @@INJECTER a.sql@@\n  ;\n  execute\n-- @@INJECTER b.sql@@\n  ;\nend $preuve$;\n";
  const a = "select '$injection$';\n";
  const b = "select 1 -- $injection_1";
  const r = assembler(gabarit, enMemoire({ "a.sql": a, "b.sql": b }));
  const d = r.injections[0].delimiteur;
  assert.equal(d, "$injection_2$");
  assert.deepEqual(litteraux(r.texte, d), [a, b]);
});

test("collision : un fichier injecté qui contient un délimiteur du gabarit est refusé", () => {
  const gabarit = "do $preuve$\nbegin\n  execute\n-- @@INJECTER m.sql@@\n  ;\nend $preuve$;\n";
  assert.throws(() => assembler(gabarit, enMemoire({ "m.sql": "select $preuve$x$preuve$;\n" }), { nom: "g.sql" }),
    /Collision de délimiteur : \$preuve\$ figure dans m\.sql et dans g\.sql/);
  assert.throws(() => assembler("do $$\nbegin\n  execute\n-- @@INJECTER m.sql@@\n  ;\nend $$;\n",
    enMemoire({ "m.sql": "create function f() returns int language sql as $$ select 1 $$;\n" })), /Collision de délimiteur : \$\$/);
});

test("fichier absent : injecté ou inclus, l'assemblage s'arrête en le nommant", () => {
  assert.throws(() => assembler("execute\n-- @@INJECTER absent.sql@@\n;\n", enMemoire({}), { nom: "g.sql" }),
    /Fichier introuvable : absent\.sql \(marqueur @@INJECTER de g\.sql\)/);
  assert.throws(() => assembler("-- @@INCLURE aides.sql@@\n", enMemoire({})), /Fichier introuvable : aides\.sql/);
  assert.throws(() => assemblerMode("pas-un-mode"), /Mode inconnu « pas-un-mode »/);
});

test("marqueurs : inconnu, mal formé, mal placé, chemin hors du dépôt, marqueur dans un fichier inclus : refusés", () => {
  const f = enMemoire({ "a.sql": "select 1;\n", "aides.sql": "-- @@INJECTER a.sql@@\n" });
  assert.throws(() => assembler("-- @@INJECT a.sql@@\n", f), /ligne 1 : marqueur inconnu « @@INJECT »/);
  assert.throws(() => assembler("-- @@AUTRE a.sql@@\n", f), /marqueur inconnu « @@AUTRE »/);
  assert.throws(() => assembler("x\n-- @@INJECTER a.sql\n", f), /ligne 2 : marqueur mal formé/);
  assert.throws(() => assembler("-- @@INJECTER@@\n", f), /marqueur mal formé/);
  assert.throws(() => assembler("-- @@INJECTER a.sql@@ et la suite\n", f), /marqueur mal formé/);
  assert.throws(() => assembler("select 1; -- @@INCLURE a.sql@@\n", f), /marqueur mal placé, il doit être seul sur sa ligne/);
  assert.throws(() => assembler("-- @@INJECTER ../a.sql@@\n", f), /chemin « \.\.\/a\.sql » refusé/);
  assert.throws(() => assembler("-- @@INJECTER /a.sql@@\n", f), /chemin « \/a\.sql » refusé/);
  assert.throws(() => assembler("-- @@INCLURE aides.sql@@\n", f), /aides\.sql, ligne 1 : marqueur dans un fichier inclus/);
  assert.throws(() => assembler("execute\n-- @@INJECTER a.sql@@\n;\n", f, { neutres: ["b.sql"] }),
    /Mode mal décrit : b\.sql est à neutraliser/);
});

test("ligne de commande : écrit la sortie hors du dépôt ; mode inconnu, sortie dans le dépôt, arguments manquants : code 1", () => {
  const dossier = mkdtempSync(join(tmpdir(), "assembler-roles-"));
  try {
    const sortie = join(dossier, "etape-1-sans.sql");
    const ok = spawnSync(process.execPath, [SCRIPT, "etape-1-sans", sortie], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(readFileSync(sortie, "utf8"), assemblerMode("etape-1-sans").texte);
    assert.match(ok.stdout, /neutralisé {2}supabase\/migrations\/20261028_roles_1_fondations\.sql/);

    const inconnu = spawnSync(process.execPath, [SCRIPT, "pas-un-mode", join(dossier, "x.sql")], { encoding: "utf8" });
    assert.equal(inconnu.status, 1);
    assert.match(inconnu.stderr, /Mode inconnu « pas-un-mode »/);
    assert.ok(!existsSync(join(dossier, "x.sql")));

    const messages = [];
    const dedans = principal(["etape-1-sans", join(RACINE, "tests", "sql", "assemble.sql")], { erreur: (m) => messages.push(m) });
    assert.equal(dedans, 1);
    assert.match(messages[0], /sortie dans le dépôt refusée/);
    assert.ok(!existsSync(join(RACINE, "tests", "sql", "assemble.sql")));

    const usage = spawnSync(process.execPath, [SCRIPT, "etape-1"], { encoding: "utf8" });
    assert.equal(usage.status, 1);
    assert.match(usage.stderr, /Usage : node outils\/assembler_repetition_roles\.mjs <mode> <sortie\.sql>/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
