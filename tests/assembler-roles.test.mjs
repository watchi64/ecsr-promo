import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ETAPES, MIGRATION_ESPACES, NEUTRE, RACINE, assembler, assemblerMode, decrireMode, lireEtapes, md5, principal, sansVidesNiCommentaires,
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
    assert.match(usage.stderr, /Usage : node outils\/assembler_repetition_roles\.mjs <mode> \[--etapes 1,2\] \[--compact\] <sortie\.sql>/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

// ---- Compactage (--compact, R27) : la copie à transmettre à la base -------------------------------------------------

/** Ce que le compactage doit donner, calculé à part (autre code que l'assembleur) : la sortie complète sans ses lignes
 *  vides ni de commentaire, sauf l'en-tête et l'intérieur des littéraux injectés (le délimiteur y entre et en sort : on
 *  compte ses occurrences ligne par ligne). */
function compacteAttendu(complet) {
  const entete = 1 + (complet.mode != null ? 1 : 0) + complet.inclusions.length + complet.injections.length + complet.neutralises.length;
  const delimiteur = complet.injections[0]?.delimiteur;
  let dedans = false;
  return complet.texte.split("\n").filter((ligne, i) => {
    const etaitDedans = dedans;
    if (delimiteur && (ligne.split(delimiteur).length - 1) % 2 === 1) dedans = !dedans;
    if (i < entete || etaitDedans || dedans) return true;
    return ligne.trim() !== "" && !ligne.trimStart().startsWith("--");
  });
}

const LIGNE_COMPACT = "-- compact : lignes vides et de commentaire du gabarit et des aides retirées, textes injectés intacts";
const MODES_COMPACTS = [["etape-1", duDisque], ["contre-epreuve", duDisque], ["en-ligne", depotComplet], ["repetition", depotComplet],
  ["espaces", duDisque], ["espaces-contre-epreuve", duDisque], ["espaces-en-ligne", duDisque]];

test("compactage : les littéraux injectés restent identiques aux fichiers du dépôt, octet pour octet", () => {
  for (const [mode, lire] of MODES_COMPACTS) {
    const r = assemblerMode(mode, RACINE, { lire, compact: true });
    verifierInjections(r, lire);
    assert.equal(r.compact, true);
    assert.ok(!r.texte.includes("\r"));
    assert.ok(!/^\s*--\s*@@/m.test(r.texte), `plus aucun marqueur dans la sortie (${mode})`);
  }
});

test("compactage : la sortie compacte égale la sortie complète moins ses lignes vides et de commentaire (hors en-tête et littéraux)", () => {
  for (const [mode, lire] of MODES_COMPACTS) {
    const complet = assemblerMode(mode, RACINE, { lire });
    const compact = assemblerMode(mode, RACINE, { lire, compact: true });
    const lignes = compact.texte.split("\n");
    assert.equal(lignes.filter((l) => l === LIGNE_COMPACT).length, 1, `${mode} : une ligne d'en-tête dit le compactage`);
    assert.deepEqual(lignes.filter((l) => l !== LIGNE_COMPACT), compacteAttendu(complet), mode);
    assert.ok(compact.longueur < complet.longueur, `${mode} : plus court`);
    // Les md5 de l'en-tête sont ceux des fichiers (le compactage n'y touche pas), les mêmes qu'en sortie complète.
    assert.deepEqual(compact.inclusions, complet.inclusions);
    assert.deepEqual(compact.injections, complet.injections);
    assert.deepEqual(compact.neutralises, complet.neutralises);
  }
});

test("compactage : sur un petit gabarit, le gabarit et les fichiers inclus perdent leurs lignes vides et de commentaire, pas les littéraux injectés", () => {
  const gabarit = [
    "-- note-gabarit", "", "do $preuve$", "begin", "  -- note-bloc", "  execute",
    "-- @@INJECTER m.sql@@", "  ;", "", "-- @@INCLURE aides.sql@@", "   ", "end $preuve$;", "",
  ].join("\n");
  const fichiers = {
    "m.sql": "-- migration\n\nselect 1;\n   -- fin\n",
    "aides.sql": "-- aides\n\ncreate function f() returns int language sql as 'select 1';\n\n  -- fin des aides\n",
  };
  const r = assembler(gabarit, enMemoire(fichiers), { nom: "g.sql", compact: true });
  const d = r.injections[0].delimiteur;
  assert.deepEqual(litteraux(r.texte, d), [fichiers["m.sql"]], "littéral intact (lignes vides et commentaire comprises)");
  const entete = 1 + r.inclusions.length + r.injections.length + 1; // la première ligne, les md5, la ligne « compact »
  assert.deepEqual(r.texte.split("\n").slice(entete), [
    "do $preuve$", "begin", "  execute", `${d}-- migration`, "", "select 1;", "   -- fin", d,
    "  ;", "create function f() returns int language sql as 'select 1';", "end $preuve$;",
  ]);
  for (const note of ["note-gabarit", "note-bloc", "-- aides", "fin des aides"]) assert.ok(!r.texte.includes(note), `absent : ${note}`);
  assert.ok(r.texte.includes(`-- inclus : aides.sql (md5 ${md5(fichiers["aides.sql"])})`), "le md5 de l'en-tête est celui du fichier, pas de sa copie compactée");
  // Sans --compact : tout y est, comme avant.
  const complet = assembler(gabarit, enMemoire(fichiers), { nom: "g.sql" });
  assert.ok(complet.texte.includes("note-gabarit") && complet.texte.includes("note-bloc") && complet.texte.includes("fin des aides"));
  assert.equal(complet.compact, false);
  assert.deepEqual(sansVidesNiCommentaires("a\n\n  -- b\n--c\nd -- e\n  \nf"), ["a", "d -- e", "f"]);
});

test("compactage : taille et md5 du texte produit annoncés (caractères, octets UTF-8, md5), égaux à ceux du texte", () => {
  for (const compact of [false, true]) {
    const r = assemblerMode("contre-epreuve", RACINE, { compact });
    assert.equal(r.longueur, Array.from(r.texte).length);
    assert.equal(r.octets, Buffer.byteLength(r.texte, "utf8"));
    assert.equal(r.md5, md5(r.texte));
  }
  const accents = assembler("-- é\nselect 'é€';\n", enMemoire({}), { compact: true });
  assert.equal(accents.longueur, Array.from(accents.texte).length);
  assert.ok(accents.octets > accents.longueur, "les accents pèsent plus d'un octet");
});

// Les littéraux de texte d'un script SQL : { genre, debut, fin } (positions du premier et du dernier caractère, délimiteurs
// compris). Genres : « apostrophes » ('…' et E'…', doublement et barre oblique inverse admis), « dollar:<balise> ».
// Les corps de code ($fx$, $f$, $empreinte$, $preuve$ : `CODE`) ne sont pas des littéraux : on les parcourt comme du SQL
// (leurs commentaires, leurs apostrophes et leurs littéraux imbriqués comptent). Un commentaire (--) ou un identifiant
// entre guillemets n'est jamais un littéral. Une balise inconnue ou un littéral non fermé lève une Error.
function litterauxSql(texte, CODE) {
  const rendu = [];
  const pile = []; // balises de corps de code ouverts
  let i = 0;
  const n = texte.length;
  while (i < n) {
    const c = texte[i];
    if (c === "-" && texte[i + 1] === "-") { const f = texte.indexOf("\n", i); i = f < 0 ? n : f; continue; }
    if (c === "/" && texte[i + 1] === "*") { const f = texte.indexOf("*/", i + 2); if (f < 0) throw new Error("commentaire /* non fermé"); i = f + 2; continue; }
    if (c === '"') { const f = texte.indexOf('"', i + 1); if (f < 0) throw new Error("identifiant entre guillemets non fermé"); i = f + 1; continue; }
    if (c === "'") {
      const e = i > 0 && /[eE]/.test(texte[i - 1]) && !(i > 1 && /[A-Za-z0-9_]/.test(texte[i - 2]));
      const debut = e ? i - 1 : i;
      let j = i + 1;
      for (;;) {
        if (j >= n) throw new Error(`littéral '…' non fermé (position ${debut})`);
        if (e && texte[j] === "\\") { j += 2; continue; }
        if (texte[j] === "'") { if (texte[j + 1] === "'") { j += 2; continue; } break; }
        j++;
      }
      rendu.push({ genre: "apostrophes", debut, fin: j });
      i = j + 1;
      continue;
    }
    if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(texte.slice(i, i + 80));
      if (m) {
        const balise = m[1] ?? "";
        if (pile.length && pile[pile.length - 1] === balise) { pile.pop(); i += m[0].length; continue; }
        if (CODE.includes(balise)) { pile.push(balise); i += m[0].length; continue; }
        const f = texte.indexOf(m[0], i + m[0].length);
        if (f < 0) throw new Error(`littéral ${m[0]} non fermé (position ${i})`);
        rendu.push({ genre: `dollar:${balise}`, debut: i, fin: f + m[0].length - 1 });
        i = f + m[0].length;
        continue;
      }
    }
    i++;
  }
  if (pile.length) throw new Error(`corps de code non fermé : $${pile[pile.length - 1]}$`);
  return rendu;
}

/** Les lignes que le compactage retire et qui touchent un littéral de données : [{ ligne, genre, texte }]. */
function lignesRetireesDansUnLitteral(texte, DONNEES, CODE) {
  const litteraux = litterauxSql(texte, CODE);
  const balises = new Set(litteraux.filter((l) => l.genre.startsWith("dollar:")).map((l) => l.genre.slice(7)));
  for (const b of balises) if (!DONNEES.includes(b)) throw new Error(`balise $${b}$ à classer (données ou code)`);
  const trouvees = [];
  const multi = litteraux.filter((l) => texte.slice(l.debut, l.fin + 1).includes("\n"));
  let debut = 0;
  texte.split("\n").forEach((ligne, k) => {
    const fin = debut + ligne.length; // la ligne couvre [debut, fin) ; son saut de ligne est à la position fin
    if (/^\s*(?:--.*)?$/.test(ligne)) {
      // une ligne que le compactage retirerait et qui chevauche un littéral sur plusieurs lignes, première et dernière lignes comprises
      const touche = multi.find((l) => l.debut <= fin && l.fin >= debut);
      if (touche) trouvees.push({ ligne: k + 1, genre: touche.genre, texte: ligne.trim().slice(0, 50) });
    }
    debut = fin + 1;
  });
  return { trouvees, litteraux };
}

test("gabarit : le compactage ne retire aucune ligne vide ni de commentaire dans un littéral (données, apostrophes, E'…') : il reste neutre", () => {
  // Littéraux de données : leur contenu part à la base (conditions de la matrice, gabarits d'ajout, requêtes modèles).
  // Corps de code : fonctions et bloc do, où une ligne vide ou un commentaire ne change rien (mais leurs littéraux
  // '…' et E'…' sont lus). Une balise inconnue fait échouer le test : il faut la classer.
  const DONNEES = ["mx", "aj", "pv"];
  const CODE = ["fx", "f", "empreinte", "preuve"];
  for (const chemin of [GABARIT_ROLES, AIDES]) {
    const texte = texteDuDepot(chemin);
    assert.ok(!/\$\$/.test(texte), `${chemin} : pas de $$`);
    const { trouvees, litteraux } = lignesRetireesDansUnLitteral(texte, DONNEES, CODE);
    assert.deepEqual(trouvees, [], `${chemin} : des lignes vides ou de commentaire dans un littéral : ${JSON.stringify(trouvees.slice(0, 3))}`);
    if (chemin === GABARIT_ROLES) {
      const vus = litteraux.filter((l) => l.genre.startsWith("dollar:")).length;
      assert.ok(vus > 300, "les littéraux de données du gabarit sont bien trouvés");
      assert.ok(litteraux.some((l) => l.genre === "apostrophes"), "des littéraux '…' sont parcourus (le gabarit n'en a aucun sur plusieurs lignes)");
    }
  }
});

test("garde de neutralité : elle voit une ligne vide ou de commentaire à l'intérieur d'un '…' ou d'un E'…' sur plusieurs lignes, premières et dernières lignes comprises", () => {
  const DONNEES = ["mx"];
  const CODE = ["fx"];
  const verifier = (sql) => lignesRetireesDansUnLitteral(sql, DONNEES, CODE).trouvees;
  assert.deepEqual(verifier("select 'a\n\nb';"), [{ ligne: 2, genre: "apostrophes", texte: "" }], "ligne vide dans '…'");
  assert.deepEqual(verifier("select E'a\\'\n-- c\nb';"), [{ ligne: 2, genre: "apostrophes", texte: "-- c" }], "commentaire dans E'…' (apostrophe échappée)");
  assert.deepEqual(verifier("select 'a''\n  \nb';"), [{ ligne: 2, genre: "apostrophes", texte: "" }], "apostrophe doublée puis ligne vide");
  assert.deepEqual(verifier("select $mx$a\n\n$mx$;"), [{ ligne: 2, genre: "dollar:mx", texte: "" }], "ligne vide dans $mx$");
  assert.deepEqual(verifier("select $mx$\n-- c\nx$mx$;"), [{ ligne: 2, genre: "dollar:mx", texte: "-- c" }], "commentaire juste après l'ouverture");
  assert.deepEqual(verifier("select 'a'; -- c\n\n-- d\nselect $mx$x$mx$;"), [], "commentaires et lignes vides hors littéral : rien");
  assert.deepEqual(verifier("create function f() returns void as $fx$\nbegin\n  -- l'apostrophe d'un commentaire\n\n  perform 'ok';\nend $fx$ language plpgsql;"), [],
    "dans un corps de code, un commentaire avec une apostrophe et une ligne vide ne sont pas un littéral");
  assert.deepEqual(verifier("create function f() returns text as $fx$\nbegin\n  return 'a\n-- c\nb';\nend $fx$ language plpgsql;"),
    [{ ligne: 4, genre: "apostrophes", texte: "-- c" }], "un '…' multi-lignes dans un corps de code est lu");
  assert.throws(() => verifier("select $inconnu$x$inconnu$;"), /à classer/, "balise inconnue");
  assert.throws(() => verifier("select 'non fermé;"), /non fermé/, "littéral non fermé");
});

test("gabarit : la requête reçue est hachée sans le suffixe de la passerelle, que ni le gabarit ni les sorties ne contiennent", () => {
  const gabarit = texteDuDepot(GABARIT_ROLES);
  assert.ok(gabarit.includes("regexp_replace(current_query(), E'\\n\\n-- source:"), "le gabarit retire le suffixe « -- source: » avant de hacher");
  for (const [mode, lire] of [["etape-1", duDisque], ["contre-epreuve", duDisque], ["repetition", depotComplet]]) {
    for (const compact of [false, true]) {
      const r = assemblerMode(mode, RACINE, { lire, compact });
      assert.ok(!r.texte.includes("\n\n-- source:"), `${mode}${compact ? " --compact" : ""} : le retrait du suffixe ne coupera rien dans le fichier`);
    }
  }
});

test("mode en-ligne : le libellé du mode et la détection du gabarit vont ensemble", () => {
  const gabarit = texteDuDepot(GABARIT_ROLES);
  const m = /v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m, "le gabarit reconnaît le mode en-ligne à un préfixe du libellé (v_mode like '...%')");
  const prefixe = m[1];
  assert.ok(decrireMode("en-ligne").mode.startsWith(prefixe), `le libellé du mode en-ligne commence par « ${prefixe} »`);
  for (const [mode, options] of [["contre-epreuve", {}], ["repetition", {}], ["repetition", { etapes: [1] }], ["repetition", { etapes: [1, 2] }]]) {
    assert.ok(!decrireMode(mode, options).mode.startsWith(prefixe), `le libellé de ${mode} ne passe pas pour en-ligne`);
  }
});

test("ligne de commande : --compact écrit la copie compacte, affiche sa longueur et son md5 (n'importe où dans les arguments)", () => {
  const dossier = mkdtempSync(join(tmpdir(), "assembler-roles-"));
  try {
    const sortie = join(dossier, "contre-c.sql");
    const attendu = assemblerMode("contre-epreuve", RACINE, { compact: true });
    const complet = assemblerMode("contre-epreuve");
    for (const args of [["contre-epreuve", "--compact", sortie], ["--compact", "contre-epreuve", sortie], ["contre-epreuve", sortie, "--compact"]]) {
      const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(readFileSync(sortie, "utf8"), attendu.texte);
      assert.ok(r.stdout.includes(`texte       ${attendu.longueur} caractères, ${attendu.octets} octets, md5 ${attendu.md5}`), r.stdout);
      assert.ok(r.stdout.includes(`compact     ${attendu.longueur} caractères au lieu de ${complet.longueur}`), r.stdout);
    }
    // Sans --compact : la même annonce pour le texte complet, et pas de ligne « compact ».
    const fichier = join(dossier, "contre.sql");
    const c = spawnSync(process.execPath, [SCRIPT, "contre-epreuve", fichier], { encoding: "utf8" });
    assert.equal(c.status, 0, c.stderr);
    assert.ok(c.stdout.includes(`texte       ${complet.longueur} caractères, ${complet.octets} octets, md5 ${complet.md5}`), c.stdout);
    assert.ok(!/^ {2}compact /m.test(c.stdout));
    assert.equal(md5(readFileSync(fichier, "utf8")), complet.md5, "le md5 annoncé est celui du fichier écrit");
    // La preuve compare ce md5 et cette longueur à ceux de la requête reçue : les caractères sont des points de code.
    assert.equal(Array.from(readFileSync(fichier, "utf8")).length, complet.longueur);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

// --- Lot 5, étape 1 (siège) : preuve tests/sql/espaces-preuve.sql -------------------------------------------------------

const GABARIT_ESPACES = "tests/sql/espaces-preuve.sql";
const FIXTURE = "tests/fixtures/comptes-promo.json";
const MIGRATION_5 = MIGRATION_ESPACES.migration;
const RETOUR_5 = MIGRATION_ESPACES.retour;

test("espaces : la requête d'empreinte, la fixture, la migration et son retour s'y trouvent octet pour octet (md5), dans l'ordre du gabarit", () => {
  const r = assemblerMode("espaces", RACINE, { lire: duDisque });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE, MIGRATION_5, RETOUR_5]);
  assert.deepEqual(r.neutralises, []);
  verifierInjections(r, duDisque);
  assert.equal(r.mode, "espaces (migration du siège injectée)");
  assert.ok(r.texte.includes("\n'espaces (migration du siège injectée)'\n"), "le mode est écrit en littéral à la place de son marqueur");
  assert.ok(r.texte.includes(texteDuDepot(AIDES)), "les aides du lot 4 sont collées");
  assert.ok(!/^\s*--\s*@@/m.test(r.texte), "plus aucun marqueur dans la sortie");
  assert.ok(!r.texte.includes("\r"));
});

test("espaces : la fixture est injectée telle quelle (le texte du fichier, lisible comme JSON, qui porte l'attendu)", () => {
  const r = assemblerMode("espaces", RACINE, { lire: duDisque });
  const injection = r.injections.find((x) => x.chemin === FIXTURE);
  const contenu = litteraux(r.texte, injection.delimiteur)[r.injections.indexOf(injection)];
  assert.equal(contenu, texteDuDepot(FIXTURE));
  assert.deepEqual(JSON.parse(contenu), JSON.parse(readFileSync(join(RACINE, FIXTURE), "utf8")));
  assert.ok("attendu" in JSON.parse(contenu) && "donnees" in JSON.parse(contenu));
});

test("espaces-contre-epreuve : sans la migration ni son retour (deux littéraux neutres, fichiers non lus), l'empreinte et la fixture toujours là", () => {
  const lus = [];
  const r = assemblerMode("espaces-contre-epreuve", RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE]);
  assert.deepEqual([...r.neutralises].sort(), [MIGRATION_5, RETOUR_5].sort());
  for (const chemin of r.neutralises) assert.ok(!lus.includes(chemin), `non lu : ${chemin}`);
  verifierInjections(r, duDisque);
  assert.equal(r.texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 2);
  assert.equal(r.mode, "espaces-contre-epreuve (migration non injectée)");
});

test("espaces-en-ligne : aucune migration injectée (ni texte ni md5), la migration réelle n'est pas lue, la fixture reste injectée", () => {
  const lus = [];
  const r = assemblerMode("espaces-en-ligne", RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE]);
  assert.deepEqual([...r.neutralises].sort(), [MIGRATION_5, RETOUR_5].sort());
  for (const chemin of [MIGRATION_5, RETOUR_5]) {
    assert.ok(!lus.includes(chemin), `non lu : ${chemin}`);
    const texte = texteDuDepot(chemin);
    assert.ok(!r.texte.includes(texte), `texte absent : ${chemin}`);
    assert.ok(!r.texte.includes(md5(texte)), `md5 absent : ${chemin}`);
  }
  assert.equal(r.mode, "espaces-en-ligne (aucune migration injectée)");
  assert.ok(r.texte.includes("\n'espaces-en-ligne (aucune migration injectée)'\n"));
});

test("espaces : les modes sans migration s'assemblent même si elle manque ; le mode espaces s'arrête en nommant le fichier manquant", () => {
  const sans = (chemin) => (chemin === MIGRATION_5 || chemin === RETOUR_5 ? null : duDisque(chemin));
  assert.doesNotThrow(() => assemblerMode("espaces-contre-epreuve", RACINE, { lire: sans }));
  assert.doesNotThrow(() => assemblerMode("espaces-en-ligne", RACINE, { lire: sans }));
  assert.throws(() => assemblerMode("espaces", RACINE, { lire: sans }), /Fichier introuvable : supabase\/migrations\/20261108_espaces_1_siege\.sql/);
  for (const mode of ["espaces", "espaces-contre-epreuve", "espaces-en-ligne"]) {
    assert.throws(() => decrireMode(mode, { etapes: [1] }), /--etapes ne vaut que pour le mode repetition/);
  }
});

test("le gabarit de la preuve du siège injecte la requête d'empreinte, la fixture, la migration et le retour, une fois chacun, et porte son marqueur de mode", () => {
  const gabarit = texteDuDepot(GABARIT_ESPACES);
  const chemins = [EMPREINTE, FIXTURE, MIGRATION_5, RETOUR_5];
  for (const chemin of chemins) assert.equal(gabarit.split(`-- @@INJECTER ${chemin}@@`).length - 1, 1, `injecté une fois : ${chemin}`);
  const positions = chemins.map((chemin) => gabarit.indexOf(`-- @@INJECTER ${chemin}@@`));
  assert.deepEqual(positions, [...positions].sort((x, y) => x - y), "empreinte, fixture, migration, puis retour");
  assert.equal(gabarit.split("-- @@MODE@@").length - 1, 1);
  assert.ok(gabarit.includes(`-- @@INCLURE ${AIDES}@@`));
  assert.ok(!gabarit.includes(String.fromCharCode(0x2014)), "aucun tiret cadratin");
  assert.ok(!/\$\$/.test(gabarit), "pas de $$");
  // Le mode en ligne se reconnaît à un préfixe du libellé, et lui seul.
  const m = /v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m, "le gabarit reconnaît le mode en ligne à un préfixe du libellé");
  assert.ok(decrireMode("espaces-en-ligne").mode.startsWith(m[1]));
  for (const mode of ["espaces", "espaces-contre-epreuve"]) assert.ok(!decrireMode(mode).mode.startsWith(m[1]), mode);
});

test("le gabarit de la preuve du siège : le compactage ne retire aucune ligne vide ni de commentaire dans un littéral", () => {
  const texte = texteDuDepot(GABARIT_ESPACES);
  const { trouvees } = lignesRetireesDansUnLitteral(texte, [], ["fx", "f", "empreinte", "preuve"]);
  assert.deepEqual(trouvees, [], `des lignes vides ou de commentaire dans un littéral : ${JSON.stringify(trouvees.slice(0, 3))}`);
});

test("les fichiers du lot 5, étape 1 (migration, retour, preuve, outillage) : aucun tiret cadratin, fins de ligne LF, aucune adresse de connexion, aucune adresse réelle", () => {
  for (const chemin of [MIGRATION_5, RETOUR_5, GABARIT_ESPACES, "outils/base_locale/reconstruire.sh", "outils/base_locale/LISEZMOI.md",
    "outils/psql_prod.sh"]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r"), `${chemin} : fins de ligne LF`);
    assert.ok(!/postgres(ql)?:\/\/[^\s"')]*:[^\s"')]*@/.test(brut), `${chemin} : aucune adresse de connexion avec mot de passe`);
  }
  const preuve = texteDuDepot(GABARIT_ESPACES);
  for (const adresse of preuve.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? []) {
    assert.ok(adresse.endsWith("@exemple.invalid"), `adresse de la preuve fictive : ${adresse}`);
  }
});
