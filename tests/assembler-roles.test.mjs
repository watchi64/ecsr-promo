import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ETAPES, ETAPES_GESTION, ETAPES_TITRES, MIGRATION_ESPACES, MIGRATION_ESPACES_2, MIGRATION_ESPACES_3, MIGRATION_ESPACES_4, NEUTRE, RACINE, assembler, assemblerMode, decrireMode, lireEtapes, md5, principal, sansVidesNiCommentaires,
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
  ["espaces", duDisque], ["espaces-contre-epreuve", duDisque], ["espaces-contre-epreuve-2", duDisque], ["espaces-contre-epreuve-3", duDisque], ["espaces-en-ligne", duDisque]];

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
const MIGRATION_6 = MIGRATION_ESPACES_2.migration;
const RETOUR_6 = MIGRATION_ESPACES_2.retour;
const MIGRATION_7 = MIGRATION_ESPACES_3.migration;
const RETOUR_7 = MIGRATION_ESPACES_3.retour;
const LOT_5 = [MIGRATION_5, RETOUR_5, MIGRATION_6, RETOUR_6, MIGRATION_7, RETOUR_7];

test("espaces : la requête d'empreinte, la fixture, les trois migrations et leurs retours s'y trouvent octet pour octet (md5), dans l'ordre du gabarit", () => {
  const r = assemblerMode("espaces", RACINE, { lire: duDisque });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE, MIGRATION_5, MIGRATION_6, MIGRATION_7, RETOUR_7, RETOUR_6, RETOUR_5]);
  assert.deepEqual(r.neutralises, []);
  verifierInjections(r, duDisque);
  assert.equal(r.mode, "espaces (migrations siège, équipe et habillage injectées)");
  assert.ok(r.texte.includes("\n'espaces (migrations siège, équipe et habillage injectées)'\n"), "le mode est écrit en littéral à la place de son marqueur");
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

test("espaces-contre-epreuve : sans aucune migration ni retour (six littéraux neutres, fichiers non lus), l'empreinte et la fixture toujours là", () => {
  const lus = [];
  const r = assemblerMode("espaces-contre-epreuve", RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE]);
  assert.deepEqual([...r.neutralises].sort(), [...LOT_5].sort());
  for (const chemin of r.neutralises) assert.ok(!lus.includes(chemin), `non lu : ${chemin}`);
  verifierInjections(r, duDisque);
  assert.equal(r.texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 6);
  assert.equal(r.mode, "espaces-contre-epreuve (aucune migration injectée)");
});

test("espaces-contre-epreuve-2 : la migration du siège et son retour injectés, ceux de l'équipe et de l'habillage neutralisés et non lus", () => {
  const lus = [];
  const r = assemblerMode("espaces-contre-epreuve-2", RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE, MIGRATION_5, RETOUR_5]);
  assert.deepEqual([...r.neutralises].sort(), [MIGRATION_6, RETOUR_6, MIGRATION_7, RETOUR_7].sort());
  for (const chemin of r.neutralises) assert.ok(!lus.includes(chemin), `non lu : ${chemin}`);
  verifierInjections(r, duDisque);
  assert.equal(r.texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 4);
  assert.equal(r.mode, "espaces-contre-epreuve-2 (migrations équipe et habillage non injectées)");
  assert.ok(!decrireMode("espaces-contre-epreuve-2").mode.startsWith("espaces-en-ligne"));
});

test("espaces-contre-epreuve-3 : les migrations du siège et de l'équipe injectées, celle de l'habillage et son retour neutralisés et non lus", () => {
  const lus = [];
  const r = assemblerMode("espaces-contre-epreuve-3", RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE, MIGRATION_5, MIGRATION_6, RETOUR_6, RETOUR_5]);
  assert.deepEqual([...r.neutralises].sort(), [MIGRATION_7, RETOUR_7].sort());
  for (const chemin of r.neutralises) assert.ok(!lus.includes(chemin), `non lu : ${chemin}`);
  verifierInjections(r, duDisque);
  assert.equal(r.texte.split("\n").filter((ligne) => ligne.trim() === NEUTRE).length, 2);
  assert.equal(r.mode, "espaces-contre-epreuve-3 (migration habillage non injectée)");
  assert.ok(!decrireMode("espaces-contre-epreuve-3").mode.startsWith("espaces-en-ligne"));
});

test("espaces-en-ligne : aucune migration injectée (ni texte ni md5), la migration réelle n'est pas lue, la fixture reste injectée", () => {
  const lus = [];
  const r = assemblerMode("espaces-en-ligne", RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, FIXTURE]);
  assert.deepEqual([...r.neutralises].sort(), [...LOT_5].sort());
  for (const chemin of LOT_5) {
    assert.ok(!lus.includes(chemin), `non lu : ${chemin}`);
    const texte = texteDuDepot(chemin);
    assert.ok(!r.texte.includes(texte), `texte absent : ${chemin}`);
    assert.ok(!r.texte.includes(md5(texte)), `md5 absent : ${chemin}`);
  }
  assert.equal(r.mode, "espaces-en-ligne (aucune migration injectée)");
  assert.ok(r.texte.includes("\n'espaces-en-ligne (aucune migration injectée)'\n"));
});

test("espaces : les modes sans migration s'assemblent même si elle manque ; le mode espaces s'arrête en nommant le fichier manquant", () => {
  const sans = (chemin) => (LOT_5.includes(chemin) ? null : duDisque(chemin));
  assert.doesNotThrow(() => assemblerMode("espaces-contre-epreuve", RACINE, { lire: sans }));
  assert.doesNotThrow(() => assemblerMode("espaces-en-ligne", RACINE, { lire: sans }));
  assert.throws(() => assemblerMode("espaces", RACINE, { lire: sans }), /Fichier introuvable : supabase\/migrations\/20261108_espaces_1_siege\.sql/);
  // La migration du siège présente, celle de l'équipe absente : le mode qui l'injecte s'arrête en la nommant.
  const sans6 = (chemin) => (chemin === MIGRATION_6 || chemin === RETOUR_6 ? null : duDisque(chemin));
  assert.doesNotThrow(() => assemblerMode("espaces-contre-epreuve-2", RACINE, { lire: sans6 }));
  assert.throws(() => assemblerMode("espaces", RACINE, { lire: sans6 }), /Fichier introuvable : supabase\/migrations\/20261108_espaces_2_equipe\.sql/);
  // Les deux premières présentes, celle de l'habillage absente : le mode sans elle s'assemble, celui qui l'injecte s'arrête.
  const sans7 = (chemin) => (chemin === MIGRATION_7 || chemin === RETOUR_7 ? null : duDisque(chemin));
  assert.doesNotThrow(() => assemblerMode("espaces-contre-epreuve-3", RACINE, { lire: sans7 }));
  assert.throws(() => assemblerMode("espaces", RACINE, { lire: sans7 }), /Fichier introuvable : supabase\/migrations\/20261108_espaces_3_habillage\.sql/);
  for (const mode of ["espaces", "espaces-contre-epreuve", "espaces-contre-epreuve-2", "espaces-contre-epreuve-3", "espaces-en-ligne"]) {
    assert.throws(() => decrireMode(mode, { etapes: [1] }), /--etapes ne vaut que pour le mode repetition/);
  }
});

test("le gabarit de la preuve du lot 5 injecte la requête d'empreinte, la fixture, les trois migrations et leurs retours (retour 3, puis 2, puis 1), une fois chacun, et porte son marqueur de mode", () => {
  const gabarit = texteDuDepot(GABARIT_ESPACES);
  const chemins = [EMPREINTE, FIXTURE, MIGRATION_5, MIGRATION_6, MIGRATION_7, RETOUR_7, RETOUR_6, RETOUR_5];
  for (const chemin of chemins) assert.equal(gabarit.split(`-- @@INJECTER ${chemin}@@`).length - 1, 1, `injecté une fois : ${chemin}`);
  const positions = chemins.map((chemin) => gabarit.indexOf(`-- @@INJECTER ${chemin}@@`));
  assert.deepEqual(positions, [...positions].sort((x, y) => x - y), "empreinte, fixture, migrations 1, 2 et 3, retours 3, 2, puis 1");
  assert.equal(gabarit.split("-- @@MODE@@").length - 1, 1);
  assert.ok(gabarit.includes(`-- @@INCLURE ${AIDES}@@`));
  assert.ok(!gabarit.includes(String.fromCharCode(0x2014)), "aucun tiret cadratin");
  assert.ok(!/\$\$/.test(gabarit), "pas de $$");
  // Le mode en ligne se reconnaît à un préfixe du libellé, et lui seul.
  const m = /v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m, "le gabarit reconnaît le mode en ligne à un préfixe du libellé");
  assert.ok(decrireMode("espaces-en-ligne").mode.startsWith(m[1]));
  for (const mode of ["espaces", "espaces-contre-epreuve", "espaces-contre-epreuve-2", "espaces-contre-epreuve-3"]) assert.ok(!decrireMode(mode).mode.startsWith(m[1]), mode);
});

test("le gabarit de la preuve du siège : le compactage ne retire aucune ligne vide ni de commentaire dans un littéral", () => {
  const texte = texteDuDepot(GABARIT_ESPACES);
  const { trouvees } = lignesRetireesDansUnLitteral(texte, [], ["fx", "f", "empreinte", "preuve"]);
  assert.deepEqual(trouvees, [], `des lignes vides ou de commentaire dans un littéral : ${JSON.stringify(trouvees.slice(0, 3))}`);
});

test("les fichiers du lot 5, étapes 1 et 2 (migrations, retours, preuve, outillage) : aucun tiret cadratin, fins de ligne LF, aucune adresse de connexion, aucune adresse réelle", () => {
  for (const chemin of [...LOT_5, GABARIT_ESPACES, "outils/base_locale/reconstruire.sh", "outils/base_locale/LISEZMOI.md",
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

test("le retour de l'équipe contient le texte exact d'inviter_compte du lot 4 (source de ce que la production exécute) et retire les deux fonctions du lot", () => {
  const lot4 = texteDuDepot("supabase/migrations/20261028_roles_2_fonctions.sql");
  const debut = lot4.indexOf("CREATE FUNCTION public.inviter_compte");
  const fin = lot4.indexOf("$function$;", lot4.indexOf("AS $function$", debut)) + "$function$;".length;
  const definition = lot4.slice(debut, fin).replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");
  assert.ok(debut > 0 && definition.length > 2000);
  const retour = texteDuDepot(RETOUR_6);
  assert.ok(retour.includes(definition), "la définition du lot 4 figure telle quelle dans le retour");
  assert.equal(retour.split(definition).length - 1, 1);
  assert.match(retour, /drop function if exists public\.regler_affectations_formateur\(text, integer, integer\[\], integer\);/);
  assert.match(retour, /drop function if exists public\._profil_formateur\(text, integer, text\);/);
});

test("la migration de l'équipe : fragment cherché exactement une fois dans la définition lue en base, retours chariot suivis, fonction interne sans droit d'exécution", () => {
  const m = texteDuDepot(MIGRATION_6);
  assert.match(m, /pg_get_functiondef\('public\.inviter_compte\(text, text, integer, integer, integer\)'::regprocedure\)/);
  assert.match(m, /if n <> 1 then\s+raise exception 'espaces_2_equipe/);
  assert.match(m, /position\(E'\\r' in v_def\) > 0/);
  assert.match(m, /revoke all on function public\._profil_formateur\(text, integer, text\) from public, anon, authenticated, service_role;/);
  assert.ok(!/grant execute on function public\._profil_formateur/.test(m));
  assert.ok(!/grant execute on function public\.regler_affectations_formateur[^;]*\b(anon|public)\b/.test(m));
});

test(".gitattributes garde les scripts shell en LF", () => {
  assert.match(readFileSync(join(RACINE, ".gitattributes"), "utf8"), /^\*\.sh text eol=lf$/m);
});

// --- Suite du lot 5 (étape 4) : l'ancien stagiaire invité au personnel, les données personnelles de la direction -----------------

const GABARIT_DONNEES = "tests/sql/espaces-donnees-preuve.sql";
const MIGRATION_8 = MIGRATION_ESPACES_4.migration;
const RETOUR_8 = MIGRATION_ESPACES_4.retour;

test("donnees : la requête d'empreinte, la migration 4 puis son retour sont injectées octet pour octet (md5), une fois chacune, dans l'ordre du gabarit", () => {
  const r = assemblerMode("donnees", RACINE, { lire: duDisque });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, MIGRATION_8, RETOUR_8]);
  assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES]);
  assert.deepEqual(r.neutralises, []);
  for (const x of r.injections) {
    assert.equal(x.md5, md5(texteDuDepot(x.chemin)), x.chemin);
    assert.ok(r.texte.includes(x.delimiteur + texteDuDepot(x.chemin) + x.delimiteur), x.chemin + " : injecté tel quel");
  }
  assert.equal(r.mode, "donnees (migration 4 injectee)");
  assert.ok(r.texte.includes("\n'donnees (migration 4 injectee)'\n"));
});

test("donnees-contre-epreuve et donnees-en-ligne : migration et retour neutralisés et non lus, l'empreinte toujours là", () => {
  for (const mode of ["donnees-contre-epreuve", "donnees-en-ligne"]) {
    const lus = [];
    const r = assemblerMode(mode, RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE], mode);
    assert.deepEqual([...r.neutralises].sort(), [MIGRATION_8, RETOUR_8].sort(), mode);
    assert.ok(!lus.includes(MIGRATION_8) && !lus.includes(RETOUR_8), mode + " : fichiers non lus");
  }
  assert.ok(decrireMode("donnees-en-ligne").mode.startsWith("donnees-en-ligne"));
  assert.ok(!decrireMode("donnees").mode.startsWith("donnees-en-ligne") && !decrireMode("donnees-contre-epreuve").mode.startsWith("donnees-en-ligne"));
  assert.throws(() => assemblerMode("donnees", RACINE, { lire: (chemin) => (chemin === MIGRATION_8 ? null : duDisque(chemin)) }),
    /Fichier introuvable : supabase\/migrations\/20261111_espaces_4_donnees\.sql/);
});

test("la preuve des données : mode en ligne reconnu par préfixe, pas de $$, aucune adresse qui ne soit fictive", () => {
  const gabarit = texteDuDepot(GABARIT_DONNEES);
  assert.ok(!/\$\$/.test(gabarit), "pas de $$");
  const m = /v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m && decrireMode("donnees-en-ligne").mode.startsWith(m[1]));
  for (const adresse of gabarit.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? []) {
    assert.ok(adresse.endsWith("@exemple.invalid"), `adresse de la preuve fictive : ${adresse}`);
  }
});

test("les fichiers de la suite du lot 5 : aucun tiret cadratin, fins de ligne LF, aucune adresse de connexion", () => {
  for (const chemin of [MIGRATION_8, RETOUR_8, GABARIT_DONNEES]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r"), `${chemin} : fins de ligne LF`);
    assert.ok(!/postgres(ql)?:\/\/[^\s"')]*:[^\s"')]*@/.test(brut), `${chemin} : aucune adresse de connexion avec mot de passe`);
  }
});

test("la migration 4 : fragments cherchés exactement une fois, retours chariot suivis, fonction interne fermée, droits des nouvelles fonctions aux comptes connectés seulement", () => {
  const m = texteDuDepot(MIGRATION_8);
  assert.match(m, /pg_get_functiondef\(v_fonctions\[f\]\)/);
  assert.match(m, /if n <> 1 then\s+raise exception 'espaces_4_donnees/);
  assert.match(m, /position\(E'\\r' in v_def\) > 0/);
  assert.match(m, /revoke all on function public\._orphelin_en_personnel\(text, boolean, integer, text\) from public, anon, authenticated, service_role;/);
  assert.ok(!/grant execute on function public\._orphelin_en_personnel/.test(m));
  for (const f of ["etat_anonymisation_promo\\(integer\\)", "anonymiser_promo\\(integer\\)", "benevoles_a_purger\\(integer\\)", "purger_benevoles\\(integer\\[\\], integer\\)"]) {
    assert.match(m, new RegExp(`revoke all on function public\\.${f} from public, anon, service_role;`), f);
    assert.match(m, new RegExp(`grant execute on function public\\.${f} to authenticated;`), f);
  }
  assert.ok(!/grant execute[^;]* to [^;]*\b(anon|public)\b/.test(m), "jamais de droit à anon ni à public");
});

test("le retour de la migration 4 remet les fragments d'origine (les mêmes, dans l'autre sens) et retire les cinq fonctions du lot", () => {
  const fragments = (texte, tableau) => {
    const debut = texte.indexOf(`${tableau} text[] := array[`);
    const fin = texte.indexOf("];", debut);
    return [...texte.slice(debut, fin + 2).matchAll(/\$(ancien|nouveau)\$([\s\S]*?)\$\1\$/g)].map((x) => x[2]);
  };
  const m = texteDuDepot(MIGRATION_8);
  const r = texteDuDepot(RETOUR_8);
  assert.equal(fragments(m, "v_anciens").length, 8);
  assert.deepEqual(fragments(r, "v_anciens"), fragments(m, "v_nouveaux"));
  assert.deepEqual(fragments(r, "v_nouveaux"), fragments(m, "v_anciens"));
  assert.match(r, /if n <> 1 then\s+raise exception 'espaces_4_donnees_retour/);
  for (const f of ["purger_benevoles\\(integer\\[\\], integer\\)", "benevoles_a_purger\\(integer\\)", "anonymiser_promo\\(integer\\)", "etat_anonymisation_promo\\(integer\\)",
    "_orphelin_en_personnel\\(text, boolean, integer, text\\)"]) {
    assert.match(r, new RegExp(`drop function if exists public\\.${f};`), f);
  }
  assert.ok(!/drop function[^;]*(anonymiser_promo\(\)|etat_anonymisation_promo\(\)|benevoles_a_purger\(\)|purger_benevoles\(integer\[\]\))/.test(r), "les versions sans argument ne sont jamais retirées");
});

// --- Chantier titres et droits à la carte : modes titres, titres-contre-epreuve, titres-en-ligne ------------------------------

const GABARIT_TITRES = "tests/sql/titres-preuve.sql";
const AIDES_TITRES = "tests/sql/titres-aides.sql";
const GABARIT_GESTION = "tests/sql/titres-gestion-preuve.sql";
const TITRES_1 = ETAPES_TITRES[1];
// Les fichiers des étapes 2 à 4 n'existent qu'avec leurs tâches : des textes factices en mémoire, pour juger l'assembleur seul.
const FACTICES_TITRES = Object.fromEntries([2, 3, 4].flatMap((n) => [
  [ETAPES_TITRES[n].migration, `-- factice : titres migration ${n}\r\nselect ${n};\r\n`],
  [ETAPES_TITRES[n].retour, `-- factice : titres retour ${n}\r\nselect -${n};\r\n`]]));
const depotTitres = (chemin) => duDisque(chemin) ?? FACTICES_TITRES[chemin] ?? null;
const TOUS_FICHIERS_TITRES = Object.values(ETAPES_TITRES).flatMap((e) => [e.migration, e.retour]);
// Le dépôt réel, privé de tout fichier du chantier sauf ceux qu'on garde (le cas d'une étape non encore faite).
const sansTitres = (garde) => (chemin) => (TOUS_FICHIERS_TITRES.includes(chemin) && !garde.includes(chemin) ? null : duDisque(chemin));
const ORDRE_TITRES = [1, 2, 3, 4].map((n) => ETAPES_TITRES[n].migration).concat([4, 3, 2, 1].map((n) => ETAPES_TITRES[n].retour));

test("titres : migrations 1 à 4 puis retours 4, 3, 2, 1 injectés octet pour octet, dans l'ordre du gabarit, après l'empreinte", () => {
  const r = assemblerMode("titres", RACINE, { lire: depotTitres });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ORDRE_TITRES]);
  assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES]);
  assert.deepEqual(r.neutralises, []);
  verifierInjections(r, depotTitres);
  assert.equal(r.mode, "titres (etapes 1, 2, 3, 4 injectees)");
  assert.ok(r.texte.includes("\n'titres (etapes 1, 2, 3, 4 injectees)'\n"));
});

test("titres sans --etapes : les quatre étapes par défaut, un fichier manquant arrête l'assemblage (jamais un VERT sur moins d'étapes)", () => {
  const r = assemblerMode("titres", RACINE, { lire: depotTitres });
  assert.equal(r.mode, "titres (etapes 1, 2, 3, 4 injectees)");
  assert.deepEqual(r.neutralises, []);
  assert.throws(() => assemblerMode("titres", RACINE, { lire: sansTitres([TITRES_1.migration, TITRES_1.retour]) }),
    /Étape 2 demandée \(titres\) : supabase\/migrations\/20261112_titres_2_gestes\.sql n'existe pas encore/);
  assert.throws(() => assemblerMode("titres", RACINE, { lire: sansTitres([]) }), /Étape 1 demandée \(titres\)/);
});

test("titres --etapes 1 à 1,2,3,4 : les étapes demandées injectées, les autres neutralisées et non lues ; un fichier manquant d'une étape demandée arrête l'assemblage", () => {
  for (const [etapes, mode] of [[[1], "titres (etape 1 injectees)"], [[1, 2], "titres (etapes 1, 2 injectees)"], [[1, 2, 3], "titres (etapes 1, 2, 3 injectees)"], [[1, 2, 3, 4], "titres (etapes 1, 2, 3, 4 injectees)"]]) {
    const lus = [];
    const r = assemblerMode("titres", RACINE, { etapes, lire: (c) => { lus.push(c); return depotTitres(c); } });
    const injectes = etapes.flatMap((n) => [ETAPES_TITRES[n].migration, ETAPES_TITRES[n].retour]);
    assert.deepEqual(r.injections.map((x) => x.chemin).sort(), [EMPREINTE, ...injectes].sort(), JSON.stringify(etapes));
    for (const c of r.neutralises) assert.ok(!lus.includes(c), `${c} neutralisé donc non lu`);
    assert.equal(r.neutralises.length, 8 - injectes.length);
    assert.equal(r.mode, mode);
  }
  assert.throws(() => assemblerMode("titres", RACINE, { etapes: [1, 2], lire: sansTitres([TITRES_1.migration, TITRES_1.retour]) }),
    /Étape 2 demandée \(titres\) : supabase\/migrations\/20261112_titres_2_gestes\.sql n'existe pas encore.*titres-contre-epreuve.*--etapes 1/s);
  assert.throws(() => assemblerMode("titres", RACINE, { etapes: [1], lire: sansTitres([]) }),
    /Étape 1 demandée \(titres\) : supabase\/migrations\/20261112_titres_1_tables\.sql n'existe pas encore.*titres-contre-epreuve/s);
  // Seul le retour manque : l'étape demandée arrête aussi l'assemblage.
  assert.throws(() => assemblerMode("titres", RACINE, { etapes: [1, 2], lire: (c) => (c === ETAPES_TITRES[2].retour ? null : depotTitres(c)) }),
    /Étape 2 demandée \(titres\) : supabase\/migrations\/20261112_titres_2_gestes_retour\.sql n'existe pas encore/);
});

test("titres : étapes refusées (hors 1 à 4, non consécutives), --etapes refusé ailleurs, mode repetition inchangé", () => {
  assert.deepEqual(decrireMode("titres").etapesTitres, [1, 2, 3, 4]);
  assert.deepEqual(decrireMode("titres", { etapes: [1, 2, 3, 4] }).etapesTitres, [1, 2, 3, 4]);
  for (const mauvaise of [[], [2], [1, 3], [2, 1], [1, 2, 3, 4, 5], [0]]) {
    assert.throws(() => decrireMode("titres", { etapes: mauvaise }), /étapes refusées/, JSON.stringify(mauvaise));
  }
  for (const mode of ["titres-contre-epreuve", "titres-en-ligne"]) {
    assert.throws(() => decrireMode(mode, { etapes: [1] }), /--etapes ne vaut que pour le mode repetition, titres ou gestion/, mode);
  }
  assert.throws(() => decrireMode("repetition", { etapes: [1, 2, 3, 4] }), /étapes refusées/);
  assert.deepEqual(decrireMode("repetition", { etapes: [1, 2, 3] }).etapes, [1, 2, 3]);
});

test("titres-contre-epreuve et titres-en-ligne : les huit fichiers neutralisés et non lus, l'empreinte toujours là, libellés distincts", () => {
  for (const mode of ["titres-contre-epreuve", "titres-en-ligne"]) {
    const lus = [];
    const r = assemblerMode(mode, RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE], mode);
    assert.deepEqual([...r.neutralises].sort(), [...TOUS_FICHIERS_TITRES].sort(), mode);
    assert.ok(TOUS_FICHIERS_TITRES.every((c) => !lus.includes(c)), mode + " : fichiers non lus");
    assert.equal(r.neutralises.length, 8);
  }
  assert.ok(decrireMode("titres-en-ligne").mode.startsWith("titres-en-ligne"));
  assert.ok(!decrireMode("titres-contre-epreuve").mode.startsWith("titres-en-ligne"));
});

test("la preuve des titres : mode en ligne reconnu par préfixe, pas de $$, aucune adresse qui ne soit fictive, aucun délimiteur partagé avec les migrations", () => {
  const gabarit = texteDuDepot(GABARIT_TITRES);
  assert.ok(!/\$\$/.test(gabarit), "pas de $$");
  const m = /v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m && decrireMode("titres-en-ligne").mode.startsWith(m[1]));
  for (const adresse of gabarit.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? []) {
    assert.ok(adresse.endsWith("@exemple.invalid"), `adresse de la preuve fictive : ${adresse}`);
  }
  // Une migration qui utiliserait un délimiteur déjà dans le gabarit ferait refuser l'assemblage : on le garde ici.
  const delimiteurs = new Set(gabarit.match(/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g));
  for (const chemin of TOUS_FICHIERS_TITRES.filter((c) => existsSync(join(RACINE, c)))) {
    for (const d of delimiteurs) assert.ok(!texteDuDepot(chemin).includes(d), `${chemin} : ${d} figure aussi dans le gabarit`);
  }
});

test("les fichiers du chantier titres présents : aucun tiret cadratin, fins de ligne LF, aucune adresse de connexion, lock_timeout en tête des migrations", () => {
  for (const chemin of [...TOUS_FICHIERS_TITRES.filter((c) => existsSync(join(RACINE, c))), GABARIT_TITRES, AIDES_TITRES, GABARIT_GESTION]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r"), `${chemin} : fins de ligne LF`);
    assert.ok(!/postgres(ql)?:\/\/[^\s"')]*:[^\s"')]*@/.test(brut), `${chemin} : aucune adresse de connexion avec mot de passe`);
    if (chemin.startsWith("supabase/")) assert.match(brut, /^set local lock_timeout = '3s';$/m, `${chemin} : lock_timeout`);
  }
});

test("la migration 1 des titres : fonctions internes sans droit d'exécution, table sans droit pour anon ni authenticated, aucun grant, retour dans l'ordre inverse", () => {
  const m = texteDuDepot(TITRES_1.migration);
  assert.match(m, /revoke all on public\.titres from public, anon, authenticated;/);
  assert.match(m, /alter table public\.titres enable row level security;/);
  for (const f of ["_pages_du_niveau\\(text\\)", "_cases_valides\\(text, jsonb\\)", "titre_fixe\\(text\\)", "_affectations_titre\\(\\)", "_titres_stable\\(\\)"]) {
    assert.match(m, new RegExp(`revoke all on function public\\.${f} from public, anon, authenticated, service_role;`), f);
  }
  assert.ok(!/^\s*grant /m.test(m), "aucun grant : rien n'est donné aux comptes connectés avant l'étape 2");
  assert.ok(!/create policy/.test(m), "aucune règle sur titres");
  assert.match(m, /before insert or update of titre_id, email, role, promo_id, lieu_id on public\.affectations/);
  const r = texteDuDepot(TITRES_1.retour);
  const ordre = ["drop trigger", "drop function if exists public._affectations_titre", "drop column if exists titre_id", "drop table if exists public.titres", "drop function if exists public._titres_stable",
    "drop function if exists public.titre_fixe", "drop function if exists public._cases_valides", "drop function if exists public._pages_du_niveau"];
  const places = ordre.map((x) => r.indexOf(x));
  assert.ok(places.every((x) => x >= 0), "tous les retraits présents");
  assert.deepEqual([...places].sort((a, b) => a - b), places, "retraits dans l'ordre");
});

test("la migration 2 des titres (A) : dix fonctions stable security definer, exécution pour anon et authenticated sans PUBLIC, code inconnu 22023, retour qui les retire", () => {
  const m = texteDuDepot(ETAPES_TITRES[2].migration);
  const fonctions = ["case_promo(integer, text)", "case_centre(integer, text)", "case_reseau(text)", "formateur_fixe(integer)", "direction_fixe(integer)",
    "siege_fixe()", "membre_stagiaire(integer)", "geste_promo(integer, text)", "geste_centre(integer, text)", "geste_reseau(text)"];
  assert.equal((m.match(/^create function public\./gm) ?? []).length, fonctions.length);
  assert.equal((m.match(/language (?:sql|plpgsql) stable security definer/g) ?? []).length, fonctions.length);
  assert.equal((m.match(/set search_path to 'public', 'pg_temp'/g) ?? []).length, fonctions.length);
  for (const f of fonctions) {
    assert.ok(m.includes(`public.${f}`), `${f} citée dans les droits`);
  }
  const revoke = /revoke all on function ([^;]*) from public;/.exec(m);
  const grant = /grant execute on function ([^;]*) to anon, authenticated;/.exec(m);
  assert.ok(revoke && grant, "revoke from public puis grant to anon, authenticated");
  for (const f of fonctions) {
    assert.ok(revoke[1].includes(`public.${f}`) && grant[1].includes(`public.${f}`), `${f} : droits`);
  }
  assert.ok(!/\$\$/.test(m), "délimiteur $f$ seul");
  assert.equal((m.match(/errcode = '22023'/g) ?? []).length, 3, "un code inconnu lève 22023 dans les trois fonctions de gestes");
  assert.ok(!/create policy|alter policy/.test(m), "aucune règle touchée");
  const r = texteDuDepot(ETAPES_TITRES[2].retour);
  const places = fonctions.map((f) => r.indexOf(`drop function if exists public.${f};`));
  assert.ok(places.every((x) => x >= 0), "tous les retraits présents");
  const ordreRetrait = ["geste_reseau", "geste_centre", "geste_promo", "membre_stagiaire", "siege_fixe", "direction_fixe", "formateur_fixe", "case_reseau", "case_centre", "case_promo"]
    .map((nom) => r.indexOf(`drop function if exists public.${nom}(`));
  assert.deepEqual([...ordreRetrait].sort((a, b) => a - b), ordreRetrait, "retraits dans l'ordre inverse");
});

// --- Étape 2 du chantier : modes gestion, gestion-contre-epreuve, gestion-en-ligne ---------------------------------------------

const GESTION_4 = ETAPES_GESTION[4];
const GESTION_5 = ETAPES_GESTION[5];
const GESTION_6 = ETAPES_GESTION[6];
const TOUS_FICHIERS_GESTION = [4, 5, 6].flatMap((n) => [ETAPES_GESTION[n].migration, ETAPES_GESTION[n].retour]);
// Les fichiers des migrations 5 et 6 naissent avec leurs tâches : des textes factices en mémoire, pour juger l'assembleur seul.
const FACTICES_GESTION = Object.fromEntries([5, 6].flatMap((n) => [
  [ETAPES_GESTION[n].migration, `-- factice : gestion migration ${n}\r\nselect ${n};\r\n`],
  [ETAPES_GESTION[n].retour, `-- factice : gestion retour ${n}\r\nselect -${n};\r\n`]]));
const depotGestion = (chemin) => duDisque(chemin) ?? FACTICES_GESTION[chemin] ?? null;
const sansGestion = (garde) => (chemin) => (TOUS_FICHIERS_GESTION.includes(chemin) && !garde.includes(chemin) ? null : depotGestion(chemin));
// L'ordre du gabarit : migrations 4, 5, 6 puis retours 6, 5, 4.
const ORDRE_GESTION = [4, 5, 6].map((n) => ETAPES_GESTION[n].migration).concat([6, 5, 4].map((n) => ETAPES_GESTION[n].retour));

test("gestion : étapes 5 et 6 par défaut, injectées octet pour octet dans l'ordre du gabarit, la migration 4 et son retour neutralisés et non lus", () => {
  const lus = [];
  const r = assemblerMode("gestion", RACINE, { lire: (c) => { lus.push(c); return depotGestion(c); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, GESTION_5.migration, GESTION_6.migration, GESTION_6.retour, GESTION_5.retour]);
  assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES]);
  assert.deepEqual([...r.neutralises].sort(), [GESTION_4.migration, GESTION_4.retour].sort());
  assert.ok(!lus.includes(GESTION_4.migration) && !lus.includes(GESTION_4.retour), "étape 4 non demandée, donc non lue");
  verifierInjections(r, depotGestion);
  assert.equal(r.mode, "gestion (etapes 5, 6 injectees)");
  assert.ok(r.texte.includes("\n'gestion (etapes 5, 6 injectees)'\n"));
});

test("gestion --etapes 5, 5,6 ou 4,5,6 : les étapes demandées injectées dans l'ordre du gabarit, les autres neutralisées et non lues", () => {
  for (const [etapes, mode] of [[[5], "gestion (etape 5 injectees)"], [[5, 6], "gestion (etapes 5, 6 injectees)"], [[4, 5, 6], "gestion (etapes 4, 5, 6 injectees)"]]) {
    const lus = [];
    const r = assemblerMode("gestion", RACINE, { etapes, lire: (c) => { lus.push(c); return depotGestion(c); } });
    const attendus = ORDRE_GESTION.filter((c) => etapes.some((n) => c === ETAPES_GESTION[n].migration || c === ETAPES_GESTION[n].retour));
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...attendus], JSON.stringify(etapes));
    assert.equal(r.neutralises.length, 6 - attendus.length, JSON.stringify(etapes));
    for (const c of r.neutralises) assert.ok(!lus.includes(c), `${c} neutralisé donc non lu`);
    assert.equal(r.mode, mode);
    verifierInjections(r, depotGestion);
  }
});

test("gestion : étapes refusées (la 6 demande la 5, la 4 demande les deux), un fichier manquant d'une étape demandée arrête l'assemblage", () => {
  assert.deepEqual(decrireMode("gestion").etapesGestion, [5, 6]);
  for (const mauvaise of [[], [6], [4], [4, 5], [5, 4], [6, 5], [4, 6], [5, 6, 4], [7], [5, 5]]) {
    assert.throws(() => decrireMode("gestion", { etapes: mauvaise }), /étapes refusées/, JSON.stringify(mauvaise));
  }
  assert.throws(() => assemblerMode("gestion", RACINE, { etapes: [6], lire: depotGestion }), /étapes refusées/);
  assert.throws(() => assemblerMode("gestion", RACINE, { lire: sansGestion([]) }),
    /Étape 5 demandée \(gestion\) : supabase\/migrations\/20261112_titres_5_fermetures\.sql n'existe pas encore.*gestion-contre-epreuve/s);
  assert.throws(() => assemblerMode("gestion", RACINE, { etapes: [5], lire: sansGestion([]) }), /Étape 5 demandée \(gestion\)/);
  assert.throws(() => assemblerMode("gestion", RACINE, { lire: sansGestion([GESTION_5.migration, GESTION_5.retour]) }),
    /Étape 6 demandée \(gestion\) : supabase\/migrations\/20261112_titres_6_gestion\.sql n'existe pas encore.*gestion --etapes 5/s);
  // Seul le retour manque : l'étape demandée arrête aussi l'assemblage.
  assert.throws(() => assemblerMode("gestion", RACINE, { etapes: [5], lire: (c) => (c === GESTION_5.retour ? null : depotGestion(c)) }),
    /Étape 5 demandée \(gestion\) : supabase\/migrations\/20261112_titres_5_fermetures_retour\.sql n'existe pas encore/);
  // La migration 4 est dans le dépôt, mais les étapes 5 et 6 se jouent sans elle : un fichier de la 4 absent ne gêne pas.
  assert.doesNotThrow(() => assemblerMode("gestion", RACINE, {
    lire: (c) => (c === GESTION_4.migration || c === GESTION_4.retour ? null : depotGestion(c)) }));
  for (const mode of ["gestion-contre-epreuve", "gestion-en-ligne"]) {
    assert.throws(() => decrireMode(mode, { etapes: [5] }), /--etapes ne vaut que pour le mode repetition, titres ou gestion/, mode);
  }
});

test("gestion-contre-epreuve et gestion-en-ligne : les six fichiers neutralisés et non lus, l'empreinte toujours là, libellés distincts", () => {
  for (const mode of ["gestion-contre-epreuve", "gestion-en-ligne"]) {
    const lus = [];
    const r = assemblerMode(mode, RACINE, { lire: (chemin) => { lus.push(chemin); return depotGestion(chemin); } });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE], mode);
    assert.deepEqual([...r.neutralises].sort(), [...TOUS_FICHIERS_GESTION].sort(), mode);
    assert.ok(TOUS_FICHIERS_GESTION.every((c) => !lus.includes(c)), mode + " : fichiers non lus");
    assert.equal(r.neutralises.length, 6);
  }
  assert.ok(decrireMode("gestion-en-ligne").mode.startsWith("gestion-en-ligne"));
  assert.ok(!decrireMode("gestion-contre-epreuve").mode.startsWith("gestion-en-ligne"));
});

test("la preuve de gestion : mode en ligne reconnu par préfixe, pas de $$, aucune adresse qui ne soit fictive, aucun délimiteur partagé avec les migrations, aides sans marqueur", () => {
  const gabarit = texteDuDepot(GABARIT_GESTION);
  assert.ok(!/\$\$/.test(gabarit), "pas de $$");
  const m = /v_en_ligne := v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m && decrireMode("gestion-en-ligne").mode.startsWith(m[1]));
  assert.ok(!/@@(?:INJECTER|INCLURE|MODE)/.test(texteDuDepot(AIDES_TITRES)), "les aides collées telles quelles ne portent aucun marqueur");
  const adresses = [...(gabarit.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? []), ...(texteDuDepot(AIDES_TITRES).match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? [])];
  for (const adresse of adresses) assert.ok(adresse.endsWith("@exemple.invalid"), `adresse de la preuve fictive : ${adresse}`);
  const delimiteurs = new Set(gabarit.match(/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g));
  for (const chemin of TOUS_FICHIERS_GESTION.filter((c) => existsSync(join(RACINE, c)))) {
    for (const d of delimiteurs) assert.ok(!texteDuDepot(chemin).includes(d), `${chemin} : ${d} figure aussi dans le gabarit`);
  }
});

test("gestion : la ligne de commande écrit hors du dépôt et refuse une suite d'étapes impossible avec un message clair", () => {
  const dossier = mkdtempSync(join(tmpdir(), "gestion-"));
  try {
    const sortie = join(dossier, "gestion.sql");
    const erreurs = [];
    const code = principal(["gestion-contre-epreuve", sortie], { racine: RACINE, journal: () => {}, erreur: (m) => erreurs.push(m) });
    assert.equal(code, 0, erreurs.join("\n"));
    assert.ok(readFileSync(sortie, "utf8").includes("-- mode : gestion-contre-epreuve (aucune migration injectee)"));
    const refus = [];
    assert.equal(principal(["gestion", "--etapes", "6", join(dossier, "refus.sql")], { racine: RACINE, journal: () => {}, erreur: (m) => refus.push(m) }), 1);
    assert.match(refus.join("\n"), /étapes refusées/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
