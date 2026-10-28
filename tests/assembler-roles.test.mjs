import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ETAPES, NEUTRE, RACINE, assembler, assemblerMode, decrireMode, lireEtapes, md5, principal,
} from "../outils/assembler_repetition_roles.mjs";

// outils/assembler_repetition_roles.mjs fabrique le fichier SQL d'une répétition du lot 4 : le gabarit de la preuve,
// les aides communes collées telles quelles, et en littéraux dollar la requête d'empreinte, les migrations et leurs
// retours. Les premiers tests lisent les vrais fichiers du dépôt (ce qui part en base doit en être la copie exacte) ;
// les suivants donnent à la fonction pure des fichiers en mémoire, pour les modes et les refus.

const EMPREINTE = "tests/sql/roles-empreinte.sql";
const MIGRATION = "supabase/migrations/20261028_roles_1_fondations.sql";
const RETOUR = "supabase/migrations/20261028_roles_1_fondations_retour.sql";
const AIDES = "tests/sql/roles-aides.sql";
const GABARIT_ROLES = "tests/sql/roles-preuve.sql";
const SCRIPT = join(RACINE, "outils", "assembler_repetition_roles.mjs");

const texteDuDepot = (chemin) => readFileSync(join(RACINE, chemin), "utf8").replace(/\r/g, "");
const enMemoire = (fichiers) => (chemin) => (chemin in fichiers ? fichiers[chemin] : null);
const duDisque = (chemin) => (existsSync(join(RACINE, chemin)) ? readFileSync(join(RACINE, chemin), "utf8") : null);

// Les six fichiers des étapes, dans l'ordre où la preuve les joue : migrations 1, 2, 3, puis retours 3, 2, 1.
const ORDRE_JEU = [ETAPES[1].migration, ETAPES[2].migration, ETAPES[3].migration,
  ETAPES[3].retour, ETAPES[2].retour, ETAPES[1].retour];
const TOUS = [...ORDRE_JEU].sort();

// Des migrations 2 et 3 factices (elles n'existent pas encore dans le dépôt : Tasks 4 et 5), chacune avec un texte
// reconnaissable, en fins de ligne Windows pour vérifier que le littéral injecté est le texte sans retour chariot.
const FACTICES = {
  [ETAPES[2].migration]: "-- factice : migration 2\r\ncreate function public.factice_2() returns int language sql as $f$ select 2 $f$;\r\n",
  [ETAPES[3].migration]: "-- factice : migration 3\r\nselect 3;\r\n",
};
/** Le vrai dépôt, complété des migrations factices (un fichier réel l'emporte s'il existe déjà). */
const depotComplet = (chemin) => duDisque(chemin) ?? FACTICES[chemin] ?? null;

/** Les littéraux de la sortie, dans l'ordre : le texte entre chaque paire de délimiteurs. Le délimiteur ne figure nulle
 *  part ailleurs (l'assembleur le choisit ainsi), donc ses occurrences vont par paires. */
function litteraux(sortie, delimiteur) {
  const morceaux = sortie.split(delimiteur);
  assert.equal(morceaux.length % 2, 1, `${delimiteur} doit apparaître un nombre pair de fois`);
  return morceaux.filter((_, i) => i % 2 === 1);
}

/** Les littéraux d'une sortie rapprochés des fichiers injectés : chaque injection, son texte exact (md5). */
function verifierInjections(r, lire) {
  const delimiteurs = new Set(r.injections.map((x) => x.delimiteur));
  assert.equal(delimiteurs.size, 1, "un seul délimiteur pour toute la sortie");
  const contenus = litteraux(r.texte, [...delimiteurs][0]);
  assert.equal(contenus.length, r.injections.length);
  r.injections.forEach((x, i) => {
    const attendu = lire(x.chemin).replace(/\r/g, "");
    assert.equal(md5(contenus[i]), md5(attendu), `littéral de ${x.chemin}`);
    assert.equal(x.md5, md5(attendu), `md5 annoncé pour ${x.chemin}`);
  });
}

test("etape-1 : chaque fichier injecté s'y trouve octet pour octet (md5 du texte sans retour chariot = md5 du littéral)", () => {
  const r = assemblerMode("etape-1");
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, MIGRATION, RETOUR]);
  assert.deepEqual(r.neutralises, []);
  verifierInjections(r, duDisque);
  assert.ok(!r.texte.includes("\r"), "la sortie est en fins de ligne LF");
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

test("contre-epreuve : l'étape 1 octet pour octet, les migrations et retours 2 et 3 neutralisés sans être lus", () => {
  const lus = [];
  const r = assemblerMode("contre-epreuve", RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, MIGRATION, RETOUR]);
  assert.deepEqual([...r.neutralises].sort(), [ETAPES[2].migration, ETAPES[2].retour, ETAPES[3].migration, ETAPES[3].retour].sort());
  for (const chemin of r.neutralises) assert.ok(!lus.includes(chemin), `non lu : ${chemin}`);
  verifierInjections(r, duDisque);
  assert.equal(r.texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 4);
  assert.equal(r.mode, "contre-epreuve (étape 1 seule)");
  assert.ok(r.texte.includes("\n'contre-epreuve (étape 1 seule)'\n"), "le mode est écrit en littéral à la place de son marqueur");
  assert.ok(r.texte.includes("-- mode : contre-epreuve (étape 1 seule)"), "et dans l'en-tête");
  assert.ok(r.texte.includes(texteDuDepot(AIDES)), "les aides sont collées");
  assert.ok(!/^\s*--\s*@@/m.test(r.texte), "plus aucun marqueur dans la sortie");
  assert.ok(!r.texte.includes("\r"));
});

test("en-ligne : aucune migration ni aucun retour (ni texte ni md5), six littéraux neutres, l'empreinte toujours là", () => {
  const r = assemblerMode("en-ligne", RACINE, { lire: depotComplet });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE]);
  assert.deepEqual([...r.neutralises].sort(), TOUS);
  assert.equal(r.texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 6);
  const [contenu] = litteraux(r.texte, r.injections[0].delimiteur);
  assert.equal(md5(contenu), md5(texteDuDepot(EMPREINTE)));
  for (const chemin of TOUS) {
    const texte = depotComplet(chemin).replace(/\r/g, "");
    assert.ok(!r.texte.includes(texte), `texte absent : ${chemin}`);
    assert.ok(!r.texte.includes(md5(texte)), `md5 absent : ${chemin}`);
  }
  assert.equal(r.mode, "en-ligne (aucune migration injectée)");
  assert.ok(r.texte.includes("\n'en-ligne (aucune migration injectée)'\n"));
});

test("repetition (migrations factices pour 2 et 3) : les six fichiers octet pour octet, migrations 1, 2, 3 puis retours 3, 2, 1", () => {
  const r = assemblerMode("repetition", RACINE, { lire: depotComplet });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ORDRE_JEU]);
  assert.deepEqual(r.neutralises, []);
  verifierInjections(r, depotComplet);
  assert.equal(r.mode, "repetition (étapes 1, 2, 3)");
  assert.equal(r.texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 0, "rien de neutralisé");
  assert.ok(!r.texte.includes("\r"), "les fins de ligne Windows des fichiers factices sont retirées");
});

test("repetition --etapes 1,2 : l'étape 3 neutralisée et non lue ; --etapes 1 : le contenu de la contre-épreuve", () => {
  const lus = [];
  const r = assemblerMode("repetition", RACINE, { etapes: [1, 2], lire: (c) => { lus.push(c); return depotComplet(c); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ETAPES[1].migration, ETAPES[2].migration,
    ETAPES[2].retour, ETAPES[1].retour]);
  assert.deepEqual([...r.neutralises].sort(), [ETAPES[3].migration, ETAPES[3].retour].sort());
  assert.ok(!lus.includes(ETAPES[3].migration) && !lus.includes(ETAPES[3].retour));
  verifierInjections(r, depotComplet);
  assert.equal(r.mode, "repetition (étapes 1, 2)");

  const un = assemblerMode("repetition", RACINE, { etapes: [1] });
  const contre = assemblerMode("contre-epreuve");
  assert.equal(un.mode, "repetition (étape 1)");
  assert.equal(un.texte.split(un.mode).join("MODE"), contre.texte.split(contre.mode).join("MODE"),
    "même texte, au libellé du mode près");
});

test("repetition : refus clair tant qu'une migration ou un retour d'une étape demandée manque", () => {
  const sansMigration2 = (c) => (c === ETAPES[2].migration ? null : depotComplet(c));
  assert.throws(() => assemblerMode("repetition", RACINE, { lire: sansMigration2 }),
    /Étape 2 demandée \(repetition\) : supabase\/migrations\/20261028_roles_2_fonctions\.sql n'existe pas encore.*contre-epreuve.*--etapes 1/s);
  const sansRetour3 = (c) => (c === ETAPES[3].retour ? null : depotComplet(c));
  assert.throws(() => assemblerMode("repetition", RACINE, { lire: sansRetour3 }),
    /Étape 3 demandée \(repetition\) : supabase\/migrations\/20261028_roles_3_regles_retour\.sql n'existe pas encore/);
  // Sur le vrai dépôt : la répétition complète s'assemble si les six fichiers existent, sinon elle nomme le premier
  // qui manque (vrai jusqu'aux Tasks 4 et 5, toujours vrai après).
  const manquants = lireEtapes([1, 2, 3]).filter((chemin) => duDisque(chemin) == null);
  if (manquants.length === 0) {
    assert.equal(assemblerMode("repetition").injections.length, 7);
  } else {
    assert.throws(() => assemblerMode("repetition"), new RegExp(manquants[0].replace(/[.]/g, "\\.") + " n'existe pas encore"));
  }
});

test("modes : description, étapes au choix pour repetition seulement, listes d'étapes refusées", () => {
  assert.deepEqual(decrireMode("repetition").etapes, [1, 2, 3]);
  assert.deepEqual(decrireMode("repetition", { etapes: [1, 2] }).etapes, [1, 2]);
  assert.deepEqual(decrireMode("contre-epreuve").etapes, [1]);
  assert.deepEqual(decrireMode("en-ligne").etapes, []);
  for (const mauvaise of [[2], [2, 3], [1, 3], [1, 2, 3, 4], [], [1, 1]]) {
    assert.throws(() => decrireMode("repetition", { etapes: mauvaise }), /étapes refusées/, JSON.stringify(mauvaise));
  }
  assert.throws(() => decrireMode("contre-epreuve", { etapes: [1] }), /--etapes ne vaut que pour le mode repetition/);
  assert.throws(() => decrireMode("etape-1", { etapes: [1] }), /--etapes ne vaut que pour le mode repetition/);
  assert.throws(() => decrireMode("pas-un-mode"), /Mode inconnu « pas-un-mode »/);
});

test("marqueur de mode : écrit en littéral ; absent, en double, mal placé, ou sans mode : refusé", () => {
  const avec = "do $p$\ndeclare\n  v constant text :=\n-- @@MODE@@\n  ;\nbegin\nend $p$;\n";
  const r = assembler(avec, enMemoire({}), { mode: "essai (l'étape 1)" });
  assert.ok(r.texte.includes("\n'essai (l''étape 1)'\n"), "apostrophe doublée dans le littéral");
  assert.throws(() => assembler(avec, enMemoire({}), { nom: "g.sql" }), /g\.sql, ligne 4 : marqueur de mode, mais aucun mode donné/);
  assert.throws(() => assembler("select 1;\n", enMemoire({}), { nom: "g.sql", mode: "x" }),
    /Mode mal décrit : g\.sql n'a pas de marqueur -- @@MODE@@/);
  assert.throws(() => assembler(avec + "-- @@MODE@@\n", enMemoire({}), { mode: "x" }), /marqueur de mode en double/);
  assert.throws(() => assembler("select 1; -- @@MODE@@\n", enMemoire({}), { mode: "x" }), /marqueur mal placé/);
  assert.throws(() => assembler("-- @@MODE x@@\n", enMemoire({}), { mode: "x" }), /marqueur mal formé/);
  assert.throws(() => assembler(avec, enMemoire({}), { mode: "x$injection$" }), /libellé de mode refusé/);
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

test("le gabarit de la preuve rôle par rôle injecte les six fichiers des étapes, l'empreinte, et porte son marqueur de mode", () => {
  const gabarit = texteDuDepot(GABARIT_ROLES);
  for (const chemin of [EMPREINTE, ...ORDRE_JEU]) {
    assert.equal(gabarit.split(`-- @@INJECTER ${chemin}@@`).length - 1, 1, `injecté une fois : ${chemin}`);
  }
  const positions = ORDRE_JEU.map((chemin) => gabarit.indexOf(`-- @@INJECTER ${chemin}@@`));
  assert.deepEqual(positions, [...positions].sort((x, y) => x - y), "migrations 1, 2, 3 puis retours 3, 2, 1");
  assert.equal(gabarit.split("-- @@MODE@@").length - 1, 1);
  assert.ok(gabarit.includes(`-- @@INCLURE ${AIDES}@@`));
  assert.ok(!gabarit.includes(String.fromCharCode(0x2014)), "aucun tiret cadratin");
});

test("ligne de commande : écrit la sortie hors du dépôt ; --etapes ; mode inconnu, sortie dans le dépôt, arguments manquants : code 1", () => {
  const dossier = mkdtempSync(join(tmpdir(), "assembler-roles-"));
  try {
    const sortie = join(dossier, "etape-1-sans.sql");
    const ok = spawnSync(process.execPath, [SCRIPT, "etape-1-sans", sortie], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(readFileSync(sortie, "utf8"), assemblerMode("etape-1-sans").texte);
    assert.match(ok.stdout, /neutralisé {2}supabase\/migrations\/20261028_roles_1_fondations\.sql/);

    const contre = join(dossier, "contre.sql");
    const c = spawnSync(process.execPath, [SCRIPT, "contre-epreuve", contre], { encoding: "utf8" });
    assert.equal(c.status, 0, c.stderr);
    assert.equal(readFileSync(contre, "utf8"), assemblerMode("contre-epreuve").texte);
    assert.match(c.stdout, /mode {8}contre-epreuve \(étape 1 seule\)/);

    const un = join(dossier, "repetition-1.sql");
    for (const args of [["repetition", "--etapes", "1", un], ["repetition", un, "--etapes=1"]]) {
      const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(readFileSync(un, "utf8"), assemblerMode("repetition", RACINE, { etapes: [1] }).texte);
    }

    const mauvaise = spawnSync(process.execPath, [SCRIPT, "repetition", "--etapes", "2,3", join(dossier, "y.sql")], { encoding: "utf8" });
    assert.equal(mauvaise.status, 1);
    assert.match(mauvaise.stderr, /étapes refusées/);
    const ailleurs = spawnSync(process.execPath, [SCRIPT, "en-ligne", "--etapes", "1", join(dossier, "z.sql")], { encoding: "utf8" });
    assert.equal(ailleurs.status, 1);
    assert.match(ailleurs.stderr, /--etapes ne vaut que pour le mode repetition/);
    const vide = spawnSync(process.execPath, [SCRIPT, "repetition", "--etapes"], { encoding: "utf8" });
    assert.equal(vide.status, 1);

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
    assert.match(usage.stderr, /Usage : node outils\/assembler_repetition_roles\.mjs <mode> \[--etapes 1,2\] <sortie\.sql>/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
