import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CAS_ROUTAGE, ETAPES, ETAPES_CLOISONNEMENT, ETAPES_GESTION, ETAPES_SUITE, ETAPES_TITRES, MIGRATION_ESPACES, MIGRATION_ESPACES_2, MIGRATION_ESPACES_3, MIGRATION_ESPACES_4, NEUTRE, RACINE, SABOTAGE_CLOISONNEMENT, assembler, assemblerMode, decrireMode, lireEtapes, md5, principal, sansVidesNiCommentaires,
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
  // La table de cas du routage (espace contact, partie 2) est un littéral de plus, sous le même délimiteur : mise à part.
  const cas = r.cas ? JSON.stringify(JSON.parse(lire(r.cas.chemin))) : null;
  const tous = litteraux(r.texte, [...delimiteurs][0]);
  const contenus = tous.filter((t) => t !== cas);
  assert.equal(tous.length - contenus.length, cas ? 1 : 0, "la table de cas, une fois, si le gabarit la demande");
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
    assert.throws(() => decrireMode(mode, { etapes: [1] }), /--etapes ne vaut que pour le mode repetition, titres, gestion, suite ou cloisonnement/, mode);
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
  assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES, "tests/sql/titres-gestion-aides.sql"]);
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
  for (const mauvaise of [[], [4], [4, 5], [5, 4], [6, 5], [4, 6], [5, 6, 4], [7], [5, 5]]) {
    assert.throws(() => decrireMode("gestion", { etapes: mauvaise }), /étapes refusées/, JSON.stringify(mauvaise));
  }
  assert.throws(() => assemblerMode("gestion", RACINE, { etapes: [6, 6], lire: depotGestion }), /étapes refusées/);
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
    assert.throws(() => decrireMode(mode, { etapes: [5] }), /--etapes ne vaut que pour le mode repetition, titres, gestion, suite ou cloisonnement/, mode);
  }
});

test("gestion --etapes 6 : la 6 seule (essai à blanc, la 5 déjà appliquée), la 5 et la 4 neutralisées et non lues, libellé reconnu par la preuve", () => {
  const lus = [];
  const r = assemblerMode("gestion", RACINE, { etapes: [6], lire: (c) => { lus.push(c); return depotGestion(c); } });
  assert.equal(r.mode, "gestion (etape 6 seule, la 5 en place)");
  assert.ok(r.texte.includes("\n'gestion (etape 6 seule, la 5 en place)'\n"));
  assert.ok(lus.includes(ETAPES_GESTION[6].migration) && lus.includes(ETAPES_GESTION[6].retour));
  for (const n of [4, 5]) for (const c of [ETAPES_GESTION[n].migration, ETAPES_GESTION[n].retour]) assert.ok(!lus.includes(c), `${c} non lu`);
  assert.deepEqual(decrireMode("gestion", { etapes: [6] }).etapesGestion, [6]);
  assert.match(texteDuDepot(GABARIT_GESTION), /v_mode like 'gestion \(etape 6 seule%'/, "la preuve reconnaît le libellé et refuse une base sans la 5");
  // Un fichier de la 6 manquant arrête l'assemblage, comme pour les autres suites.
  assert.throws(() => assemblerMode("gestion", RACINE, { etapes: [6], lire: sansGestion([GESTION_6.migration]) }),
    /Étape 6 demandée \(gestion\)/);
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
    assert.equal(principal(["gestion", "--etapes", "4", join(dossier, "refus.sql")], { racine: RACINE, journal: () => {}, erreur: (m) => refus.push(m) }), 1);
    assert.match(refus.join("\n"), /étapes refusées/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("les fichiers de la migration 5 : aucun tiret cadratin, fins de ligne LF, lock_timeout en tête, aucune adresse de connexion", () => {
  for (const chemin of [GESTION_5.migration, GESTION_5.retour, "outils/generer_fragments_titres_5.py"]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r") || chemin.endsWith(".py"), `${chemin} : fins de ligne LF`);
    assert.ok(!/postgres(ql)?:\/\/[^\s"')]*:[^\s"')]*@/.test(brut), `${chemin} : aucune adresse de connexion avec mot de passe`);
    if (chemin.startsWith("supabase/")) assert.match(brut, /^set local lock_timeout = '3s';$/m, `${chemin} : lock_timeout`);
  }
});

test("la migration 5 : retirer_titre fermée à public, anon et service_role, ouverte à authenticated seul ; règles réécrites par alter policy, jamais drop + create ; retour dans l'ordre inverse", () => {
  const m = texteDuDepot(GESTION_5.migration);
  assert.match(m, /revoke all on function public\.retirer_titre\(text, bigint, integer\) from public, anon, service_role;/);
  assert.match(m, /grant execute on function public\.retirer_titre\(text, bigint, integer\) to authenticated;/);
  assert.match(m, /language plpgsql security definer\s+set search_path to 'public', 'pg_temp'/);
  assert.match(m, /revoke insert, delete on public\.affectations from authenticated;/);
  assert.match(m, /alter policy affectations_ajout on public\.affectations\s+with check \(false\);/);
  assert.match(m, /alter policy affectations_retrait on public\.affectations\s+using \(false\);/);
  assert.ok(!/drop policy|create policy/.test(m), "aucune règle supprimée ni recréée");
  // Les phrases de refus de retirer_titre commencent par « titres: » ; un droit manquant lève 42501.
  assert.equal((m.match(/errcode = '42501'/g) ?? []).length >= 5, true);
  for (const phrase of ["Connexion requise.", "Titre introuvable.", "Ce titre ne se retire pas encore ici.", "Le centre est requis.", "Réservé à la direction du centre.",
    "Réservé au siège.", "Réservé au fondateur.", "Vous ne pouvez pas retirer votre propre titre.", "Cette personne n''a pas ce titre ici."]) {
    assert.ok(m.includes(`'titres: ${phrase}'`), `phrase « ${phrase} »`);
  }
  assert.ok(m.includes("invitation: Vous ne pouvez pas vous nommer vous-même à la direction."), "phrase d'inviter_compte");
  const r = texteDuDepot(GESTION_5.retour);
  assert.match(r, /grant delete on public\.affectations to authenticated;/);
  assert.match(r, /grant insert \(email, role, promo_id, lieu_id\) on public\.affectations to authenticated;/);
  assert.match(r, /drop function if exists public\.retirer_titre\(text, bigint, integer\);/);
  assert.ok(r.indexOf("grant delete on public.affectations") < r.indexOf("do $migration$"), "droits et règles d'abord, puis les fragments, puis la fonction");
  assert.ok(r.indexOf("do $migration$") < r.indexOf("drop function if exists public.retirer_titre"), "la fonction part en dernier");
  assert.match(r, /proname = 'donner_titre'/, "garde d'ordre : retour 6 d'abord");
  // Les deux expressions du retour sont celles de la migration 3, relues dans le fichier.
  const m3 = texteDuDepot(ETAPES_TITRES[3].migration);
  for (const nom of ["affectations_ajout", "affectations_retrait"]) {
    const re = new RegExp(`^alter policy ${nom} on public\.affectations\n  [^\n]*;$`, "m");
    assert.equal(re.exec(r)?.[0], re.exec(m3)?.[0], `${nom} : expression de la migration 3`);
  }
  assert.ok(m.includes("v_email = v_moi and (v_niveau <> 'promo' or not v_fixe) and not est_fondateur()"), "jamais sur soi : l'exemption porte sur le titre fixe Formateur");
  // Partie C : trois fonctions réécrites par fragments (le geste promos.lire, les notes visibles, le personnel) et deux règles de lecture.
  for (const morceau of ["'promos.lire'", "geste_promo(promo_courante(), 'notes.lire')", "membre_stagiaire(promo_courante())", "geste_reseau('directions.lire')"]) {
    assert.ok(m.includes(morceau), `fragment de la partie C : ${morceau}`);
  }
  assert.match(m, /alter policy affectations_lecture on public\.affectations\s+using \(/);
  assert.match(m, /alter policy user_profiles_lecture on public\.user_profiles\s+using \(/);
  assert.ok(!/alter policy user_profiles_lecture[^;]*public\.est_siege\(\)/.test(m), "user_profiles_lecture ne cite plus est_siege");
  assert.ok(/alter policy user_profiles_lecture[^;]*public\.est_siege\(\)/.test(texteDuDepot(GESTION_5.retour)), "le retour remet est_siege dans user_profiles_lecture");
  assert.match(r, /public\.est_direction\(public\.lieu_de_promo\(promo_id\)\)/, "le retour remet affectations_lecture du lot 4");
  // Le retour 3 refuse de se jouer tant que retirer_titre existe.
  assert.match(texteDuDepot(ETAPES_TITRES[3].retour), /to_regprocedure\('public\.retirer_titre\(text, bigint, integer\)'\) is not null/);
});

// --- Chantier « espace contact » : modes contact-1 à contact-5 (et leurs contre-épreuves, et en ligne) ---------------------------

const CONTACT = {
  1: { migration: "supabase/migrations/20261115_contact_1_annuaire.sql", retour: "supabase/migrations/20261115_contact_1_annuaire_retour.sql",
       suite: { migration: "supabase/migrations/20261115_contact_1b_fermeture.sql", retour: "supabase/migrations/20261115_contact_1b_fermeture_retour.sql" } },
  2: { migration: "supabase/migrations/20261115_contact_2_demandes.sql", retour: "supabase/migrations/20261115_contact_2_demandes_retour.sql" },
  3: { migration: "supabase/migrations/20261115_contact_3_absences.sql", retour: "supabase/migrations/20261115_contact_3_absences_retour.sql" },
  4: { migration: "supabase/migrations/20261116_contact_4_correctifs.sql", retour: "supabase/migrations/20261116_contact_4_correctifs_retour.sql" },
};
/** Les fichiers d'une étape : sa migration et son retour, puis ceux de sa suite (la 1b pour l'étape 1). */
const fichiersEtape = (n) => [CONTACT[n].migration, CONTACT[n].retour, ...(CONTACT[n].suite ? [CONTACT[n].suite.migration, CONTACT[n].suite.retour] : [])];
const TOUS_CONTACT = [1, 2, 3, 4].flatMap(fichiersEtape);
const GABARITS_CONTACT = { 1: "tests/sql/contact-annuaire-preuve.sql", 2: "tests/sql/contact-demandes-preuve.sql", 3: "tests/sql/contact-absences-preuve.sql",
  4: "tests/sql/contact-correctifs-preuve.sql" };
const AIDES_CONTACT = "tests/sql/contact-aides.sql";
// Les migrations de la partie n n'existent qu'avec leurs tâches : des textes factices en mémoire pour juger l'assembleur seul.
const FACTICES_CONTACT = Object.fromEntries([1, 2, 3, 4].flatMap((n) => [
  [CONTACT[n].migration, `-- factice : contact migration ${n}\r\nselect ${n};\r\n`],
  [CONTACT[n].retour, `-- factice : contact retour ${n}\r\nselect -${n};\r\n`]]).concat([
  [CONTACT[1].suite.migration, "-- factice : contact migration 1b\r\nselect 11;\r\n"],
  [CONTACT[1].suite.retour, "-- factice : contact retour 1b\r\nselect -11;\r\n"]]));
const depotContact = (chemin) => duDisque(chemin) ?? FACTICES_CONTACT[chemin] ?? null;
// Les factices d'abord, même quand les vraies migrations existent : pour juger l'ordre des injections par leur texte.
const facticesContact = (chemin) => FACTICES_CONTACT[chemin] ?? duDisque(chemin) ?? null;
const sansContact = (garde) => (chemin) => (TOUS_CONTACT.includes(chemin) && !garde.includes(chemin) ? null : depotContact(chemin));
/** L'ordre du gabarit de la partie n : migrations 1, 1b, 2 ... n, puis retours n ... 2, 1b, 1. */
const ordreContact = (n) => [...Array(n).keys()].flatMap((k) => [CONTACT[k + 1].migration, ...(CONTACT[k + 1].suite ? [CONTACT[k + 1].suite.migration] : [])])
  .concat([...Array(n).keys()].flatMap((k) => [...(CONTACT[n - k].suite ? [CONTACT[n - k].suite.retour] : []), CONTACT[n - k].retour]));

test("contact-n : migrations 1 à n puis retours n à 1 injectés octet pour octet, dans l'ordre du gabarit, après l'empreinte", () => {
  for (const n of [1, 2, 3, 4]) {
    const r = assemblerMode(`contact-${n}`, RACINE, { lire: depotContact });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ordreContact(n)], `contact-${n}`);
    assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES, AIDES_CONTACT], `contact-${n} : aides dans l'ordre`);
    assert.deepEqual(r.neutralises, [], `contact-${n}`);
    verifierInjections(r, depotContact);
    assert.equal(r.mode, `contact-${n} (migrations 1 a ${n} injectees)`);
    assert.ok(r.texte.includes(`\n'contact-${n} (migrations 1 a ${n} injectees)'\n`));
  }
});

test("contact-2 : les marqueurs des migrations 1, 1b et 2 dans cet ordre, puis les retours 2, 1b et 1", () => {
  const r = assemblerMode("contact-2", RACINE, { lire: facticesContact });
  const places = ["contact migration 1", "contact migration 1b", "contact migration 2", "contact retour 2", "contact retour 1b", "contact retour 1"]
    .map((marque) => r.texte.indexOf(`-- factice : ${marque}\n`));
  assert.ok(places.every((p) => p >= 0), "les six textes y sont");
  assert.deepEqual([...places].sort((a, b) => a - b), places, "ordre : migration 1, 1b, 2, retour 2, 1b, 1");
  assert.ok(!r.texte.includes("contact migration 3"), "la 3 n'est pas injectée dans la partie 2");
});

test("contact-4 : la migration 4 après la 3, son retour AVANT le retour 3 (le retour 3, gelé, ne la vérifie pas)", () => {
  const r = assemblerMode("contact-4", RACINE, { lire: facticesContact });
  const places = ["contact migration 3", "contact migration 4", "contact retour 4", "contact retour 3", "contact retour 2"]
    .map((marque) => r.texte.indexOf(`-- factice : ${marque}
`));
  assert.ok(places.every((p) => p >= 0), "les cinq textes y sont");
  assert.deepEqual([...places].sort((a, b) => a - b), places, "ordre : migration 3, 4, retour 4, 3, 2");
  assert.ok(!assemblerMode("contact-3", RACINE, { lire: facticesContact }).texte.includes("contact migration 4"), "la 4 n'est pas injectée dans la partie 3");
});

test("contact-n-contre-epreuve : migrations 1 à n-1 injectées, la n et son retour neutralisés (select 1) et non lus", () => {
  for (const n of [1, 2, 3, 4]) {
    const lus = [];
    const r = assemblerMode(`contact-${n}-contre-epreuve`, RACINE, { lire: (c) => { lus.push(c); return depotContact(c); } });
    const voulues = ordreContact(n).filter((c) => !fichiersEtape(n).includes(c));
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...voulues], `contact-${n}-contre-epreuve`);
    assert.deepEqual([...r.neutralises].sort(), [...fichiersEtape(n)].sort());
    for (const c of r.neutralises) assert.ok(!lus.includes(c), `${c} neutralisé donc non lu`);
    assert.equal((r.texte.match(/^\s*'select 1'$/gm) ?? []).length, fichiersEtape(n).length);
    assert.ok(r.mode.startsWith(`contact-${n}-contre-epreuve`));
    verifierInjections(r, depotContact);
  }
  const deux = assemblerMode("contact-2-contre-epreuve", RACINE, { lire: facticesContact });
  assert.ok(deux.texte.includes("-- factice : contact migration 1\n") && deux.texte.includes("-- factice : contact migration 1b\n")
    && !deux.texte.includes("-- factice : contact migration 2"));
  // La 1b suit la 1 : la contre-épreuve de la partie 1 neutralise les deux.
  const un = assemblerMode("contact-1-contre-epreuve", RACINE, { lire: facticesContact });
  assert.ok(!un.texte.includes("-- factice : contact migration 1"));
});

test("contact-n-en-ligne : rien d'injecté (sauf l'empreinte), tous les fichiers du gabarit neutralisés et non lus, libellé reconnu par préfixe", () => {
  for (const n of [1, 2, 3, 4]) {
    const lus = [];
    const r = assemblerMode(`contact-${n}-en-ligne`, RACINE, { lire: (c) => { lus.push(c); return depotContact(c); } });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE], `contact-${n}-en-ligne`);
    assert.deepEqual([...r.neutralises].sort(), [...ordreContact(n)].sort());
    assert.ok(TOUS_CONTACT.every((c) => !lus.includes(c)), "fichiers du chantier non lus");
    assert.ok(r.mode.startsWith(`contact-${n}-en-ligne`));
    assert.ok(!r.mode.startsWith(`contact-${n}-contre`));
  }
  // Sans aucun fichier du chantier dans le dépôt, les modes qui n'en demandent aucun s'assemblent.
  for (const mode of ["contact-4-en-ligne", "contact-3-en-ligne", "contact-1-contre-epreuve", "contact-1-en-ligne", "contact-2-en-ligne"]) {
    assert.doesNotThrow(() => assemblerMode(mode, RACINE, { lire: sansContact([]) }), mode);
  }
});

test("contact-n : un fichier manquant d'une étape demandée arrête l'assemblage en le nommant (migration comme retour)", () => {
  assert.throws(() => assemblerMode("contact-3", RACINE, { lire: sansContact([...fichiersEtape(1), ...fichiersEtape(2)]) }),
    /Étape 3 demandée \(contact-3\) : supabase\/migrations\/20261115_contact_3_absences\.sql n'existe pas encore/);
  assert.throws(() => assemblerMode("contact-3", RACINE, { lire: (c) => (c === CONTACT[3].retour ? null : depotContact(c)) }),
    /Étape 3 demandée \(contact-3\) : supabase\/migrations\/20261115_contact_3_absences_retour\.sql n'existe pas encore/);
  assert.throws(() => assemblerMode("contact-2", RACINE, { lire: sansContact([CONTACT[2].migration, CONTACT[2].retour]) }),
    /Étape 1 demandée \(contact-2\) : supabase\/migrations\/20261115_contact_1_annuaire\.sql n'existe pas encore/);
  // La contre-épreuve de la partie n demande 1 à n-1 seulement.
  // La 1b manquante arrête l'étape 1, comme la 1.
  assert.throws(() => assemblerMode("contact-1", RACINE, { lire: (c) => (c === CONTACT[1].suite.retour ? null : depotContact(c)) }),
    /Étape 1 demandée \(contact-1\) : supabase\/migrations\/20261115_contact_1b_fermeture_retour\.sql n'existe pas encore/);
  assert.throws(() => assemblerMode("contact-3-contre-epreuve", RACINE, { lire: sansContact(fichiersEtape(1)) }),
    /Étape 2 demandée \(contact-3-contre-epreuve\)/);
  assert.doesNotThrow(() => assemblerMode("contact-3-contre-epreuve", RACINE, { lire: sansContact(TOUS_CONTACT.filter((c) => !c.includes("contact_3"))) }));
});

// La partie 5 (données sensibles) demande la migration _demo, son préalable : injectée entre la 3 et la 4 comme en production, son retour
// entre le retour 4 et le retour 3 ; la contre-épreuve la garde (état de la production d'avant la 5), le mode en ligne la neutralise.
const CINQ = { migration: "supabase/migrations/20261118_contact_5_donnees_sensibles.sql", retour: "supabase/migrations/20261118_contact_5_donnees_sensibles_retour.sql" };
const DEMO = { migration: "supabase/migrations/20261115_contact_demo.sql", retour: "supabase/migrations/20261115_contact_demo_retour.sql" };
const ORDRE_CINQ = [CONTACT[1].migration, CONTACT[1].suite.migration, CONTACT[2].migration, CONTACT[3].migration, DEMO.migration, CONTACT[4].migration,
  CINQ.migration, CINQ.retour, CONTACT[4].retour, DEMO.retour, CONTACT[3].retour, CONTACT[2].retour, CONTACT[1].suite.retour, CONTACT[1].retour];

test("contact-5 : migrations 1, 1b, 2, 3, _demo, 4, 5 puis retours 5, 4, _demo, 3, 2, 1b, 1, injectés octet pour octet", () => {
  const r = assemblerMode("contact-5", RACINE, { lire: duDisque });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ORDRE_CINQ]);
  assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES, AIDES_CONTACT]);
  assert.deepEqual(r.neutralises, []);
  verifierInjections(r, duDisque);
  assert.equal(r.mode, "contact-5 (migrations 1 a 5 injectees)");
});

test("contact-5-contre-epreuve : la 5 et son retour neutralisés et non lus ; la _demo reste injectée", () => {
  const lus = [];
  const r = assemblerMode("contact-5-contre-epreuve", RACINE, { lire: (c) => { lus.push(c); return duDisque(c); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ORDRE_CINQ.filter((c) => c !== CINQ.migration && c !== CINQ.retour)]);
  assert.deepEqual([...r.neutralises].sort(), [CINQ.migration, CINQ.retour].sort());
  assert.ok(!lus.includes(CINQ.migration) && !lus.includes(CINQ.retour), "la 5 n'est pas lue");
  assert.ok(r.mode.startsWith("contact-5-contre-epreuve"));
});

test("contact-5-en-ligne : rien d'injecté (sauf l'empreinte), la _demo neutralisée avec le reste", () => {
  const r = assemblerMode("contact-5-en-ligne", RACINE, { lire: duDisque });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE]);
  assert.deepEqual([...r.neutralises].sort(), [...ORDRE_CINQ].sort());
  assert.ok(r.mode.startsWith("contact-5-en-ligne"));
});

test("contact-5 : la _demo manquante arrête l'assemblage en la nommant", () => {
  assert.throws(() => assemblerMode("contact-5", RACINE, { lire: (c) => (c === DEMO.retour ? null : duDisque(c)) }),
    /Étape 5 demandée \(contact-5\) : supabase\/migrations\/20261115_contact_demo_retour\.sql n'existe pas encore/);
});

test("contact-n : --etapes refusé, la ligne de commande écrit hors du dépôt et nomme le fichier manquant", () => {
  assert.throws(() => decrireMode("contact-1", { etapes: [1] }), /--etapes ne vaut que pour/);
  const dossier = mkdtempSync(join(tmpdir(), "contact-"));
  try {
    const erreurs = [];
    const sortie = join(dossier, "contact.sql");
    assert.equal(principal(["contact-2-en-ligne", sortie], { racine: RACINE, journal: () => {}, erreur: (m) => erreurs.push(m) }), 0, erreurs.join("\n"));
    assert.ok(readFileSync(sortie, "utf8").includes("-- mode : contact-2-en-ligne"));
    // Tant que les migrations ne sont pas écrites : contact-3 s'arrête (code 1) et nomme le fichier.
    if (!existsSync(join(RACINE, CONTACT[1].migration))) {
      const refus = [];
      assert.equal(principal(["contact-3", join(dossier, "refus.sql")], { racine: RACINE, journal: () => {}, erreur: (m) => refus.push(m) }), 1);
      assert.match(refus.join("\n"), /20261115_contact_1_annuaire\.sql/);
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

// --- Étape 3 du chantier : modes suite, suite-contre-epreuve, suite-en-ligne -------------------------------------------------------

const GABARIT_SUITE = "tests/sql/titres-suite-preuve.sql";
const AIDES_GESTION = "tests/sql/titres-gestion-aides.sql";
const S = ETAPES_SUITE;
const TOUS_FICHIERS_SUITE = [7, 8, 4, 9].flatMap((n) => [S[n].migration, S[n].retour]);
// Les migrations 7, 8 et 9 naissent avec leurs tâches : des textes factices en mémoire (la 4 est dans le dépôt), pour juger l'assembleur seul.
const FACTICES_SUITE = Object.fromEntries([7, 8, 9].flatMap((n) => [
  [S[n].migration, `-- factice : suite migration ${n}\r\nselect ${n};\r\n`],
  [S[n].retour, `-- factice : suite retour ${n}\r\nselect -${n};\r\n`]]));
const depotSuite = (chemin) => duDisque(chemin) ?? FACTICES_SUITE[chemin] ?? null;
// L'ordre du gabarit : migrations 7, 8, 4 (juste avant la 9), 9, puis retours 9, 8, 7, 4.
const ORDRE_SUITE = [7, 8, 4, 9].map((n) => S[n].migration).concat([9, 8, 7, 4].map((n) => S[n].retour));
const SUITES_ADMISES = [[7], [7, 8], [7, 8, 9], [8], [8, 9], [9], [4, 9]];

test("suite : étapes 7, 8 et 9 par défaut, injectées octet pour octet dans l'ordre du gabarit (retours 9, 8, 7), la 4 neutralisée et non lue", () => {
  const lus = [];
  const r = assemblerMode("suite", RACINE, { lire: (c) => { lus.push(c); return depotSuite(c); } });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, S[7].migration, S[8].migration, S[9].migration, S[9].retour, S[8].retour, S[7].retour]);
  assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES, AIDES_GESTION]);
  assert.deepEqual([...r.neutralises].sort(), [S[4].migration, S[4].retour].sort());
  assert.ok(!lus.includes(S[4].migration) && !lus.includes(S[4].retour), "étape 4 non demandée, donc non lue");
  verifierInjections(r, depotSuite);
  assert.equal(r.mode, "suite (etapes 7, 8, 9 injectees)");
  assert.ok(r.texte.includes("\n'suite (etapes 7, 8, 9 injectees)'\n"));
  assert.deepEqual(decrireMode("suite").etapesSuite, [7, 8, 9]);
});

test("suite : chaque mode a ses marqueurs (les huit fichiers une fois chacun, dans l'ordre 7, 8, 4, 9 puis 9, 8, 7, 4, et le marqueur de mode)", () => {
  const gabarit = texteDuDepot(GABARIT_SUITE);
  const places = ORDRE_SUITE.map((c) => gabarit.indexOf(`-- @@INJECTER ${c}@@`));
  assert.ok(places.every((x) => x >= 0), "les huit fichiers sont injectés");
  assert.deepEqual([...places].sort((a, b) => a - b), places, "dans l'ordre d'application, puis des retours");
  for (const c of [...ORDRE_SUITE, EMPREINTE]) {
    assert.equal(gabarit.split(`-- @@INJECTER ${c}@@`).length, 2, `${c} injecté une seule fois`);
  }
  assert.equal((gabarit.match(/^-- @@MODE@@$/gm) ?? []).length, 1);
  for (const c of [AIDES, AIDES_TITRES, AIDES_GESTION]) assert.ok(gabarit.includes(`-- @@INCLURE ${c}@@`), `${c} inclus`);
  for (const [mode, lire] of [["suite", depotSuite], ["suite-contre-epreuve", duDisque], ["suite-en-ligne", duDisque]]) {
    const r = assemblerMode(mode, RACINE, { lire });
    assert.equal(r.injections.length + r.neutralises.length, 9, `${mode} : l'empreinte et les huit fichiers, injectés ou neutralisés`);
    assert.ok(r.mode.startsWith(mode === "suite" ? "suite (" : mode), mode);
  }
});

test("suite --etapes : chaque suite admise injecte ses étapes dans l'ordre du gabarit et ne lit jamais un fichier d'une étape non demandée", () => {
  for (const etapes of SUITES_ADMISES) {
    const lus = [];
    const r = assemblerMode("suite", RACINE, { etapes, lire: (c) => { lus.push(c); return depotSuite(c); } });
    const attendus = ORDRE_SUITE.filter((c) => etapes.some((n) => c === S[n].migration || c === S[n].retour));
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...attendus], JSON.stringify(etapes));
    assert.equal(r.neutralises.length, 8 - attendus.length, JSON.stringify(etapes));
    for (const c of TOUS_FICHIERS_SUITE.filter((x) => !attendus.includes(x))) assert.ok(!lus.includes(c), `${JSON.stringify(etapes)} : ${c} non demandé, donc non lu`);
    assert.equal(r.mode, `suite (${etapes.length === 1 ? "etape" : "etapes"} ${etapes.join(", ")} injectees)`);
    verifierInjections(r, depotSuite);
  }
});

test("suite --etapes 4,9 : la 4 injectée juste avant la 9, puis les retours 9 et 4 ; 7 et 8 neutralisées", () => {
  const r = assemblerMode("suite", RACINE, { etapes: [4, 9], lire: depotSuite });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, S[4].migration, S[9].migration, S[9].retour, S[4].retour]);
  assert.deepEqual([...r.neutralises].sort(), [S[7].migration, S[7].retour, S[8].migration, S[8].retour].sort());
  const delimiteur = r.injections[0].delimiteur;
  const ordre = [S[4].migration, S[9].migration, S[9].retour, S[4].retour].map((c) => r.texte.indexOf(delimiteur + depotSuite(c).replace(/\r/g, "") + delimiteur));
  assert.ok(ordre.every((x) => x >= 0));
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, "4, 9, puis retours 9, 4 dans le texte produit");
});

test("suite : suites refusées (7,9 et les autres), fichier manquant d'une étape demandée arrêté avec un message clair, --etapes refusé aux autres modes suite", () => {
  for (const mauvaise of [[7, 9], [], [4, 7], [8, 7], [9, 8], [7, 8, 9, 4], [4, 7, 8, 9], [5], [6], [7, 7], [1, 2, 3]]) {
    assert.throws(() => decrireMode("suite", { etapes: mauvaise }), /étapes refusées/, JSON.stringify(mauvaise));
  }
  assert.throws(() => assemblerMode("suite", RACINE, { etapes: [7, 9], lire: depotSuite }), /étapes refusées : « 7,9 »/);
  // 4 seule : le journal sur une base où la 9 est déjà appliquée (l'essai à blanc de la 4 depuis que la 9 est en ligne).
  assert.doesNotThrow(() => decrireMode("suite", { etapes: [4] }));
  const sans = (c) => (TOUS_FICHIERS_SUITE.includes(c) && c !== S[4].migration && c !== S[4].retour ? null : duDisque(c));
  assert.throws(() => assemblerMode("suite", RACINE, { lire: sans }),
    /Étape 7 demandée \(suite\) : supabase\/migrations\/20261115_titres_7_correctifs\.sql n'existe pas encore.*suite-contre-epreuve/s);
  assert.throws(() => assemblerMode("suite", RACINE, { etapes: [7], lire: (c) => (c === S[7].retour ? null : depotSuite(c)) }),
    /Étape 7 demandée \(suite\) : supabase\/migrations\/20261115_titres_7_correctifs_retour\.sql n'existe pas encore/);
  assert.throws(() => assemblerMode("suite", RACINE, { etapes: [4, 9], lire: (c) => (c === S[9].migration ? null : depotSuite(c)) }), /Étape 9 demandée \(suite\)/);
  // Sur le vrai disque : tant que la migration 7 manque, suite --etapes 7 est refusé (Task 20, Step 5) ; dès qu'elle et son retour
  // existent, ils sont injectés tels quels (l'assertion dit toujours quelque chose).
  if (!existsSync(join(RACINE, S[7].migration)) || !existsSync(join(RACINE, S[7].retour))) {
    assert.throws(() => assemblerMode("suite", RACINE, { etapes: [7] }), /Étape 7 demandée \(suite\)/);
  } else {
    const r = assemblerMode("suite", RACINE, { etapes: [7] });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, S[7].migration, S[7].retour]);
    verifierInjections(r, duDisque);
  }
  for (const mode of ["suite-contre-epreuve", "suite-en-ligne"]) {
    assert.throws(() => decrireMode(mode, { etapes: [7] }), /--etapes ne vaut que pour le mode repetition, titres, gestion, suite ou cloisonnement/, mode);
  }
});

test("suite-contre-epreuve et suite-en-ligne : les huit fichiers neutralisés et non lus, l'empreinte toujours là, libellés distincts", () => {
  for (const mode of ["suite-contre-epreuve", "suite-en-ligne"]) {
    const lus = [];
    const r = assemblerMode(mode, RACINE, { lire: (chemin) => { lus.push(chemin); return duDisque(chemin); } });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE], mode);
    assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES, AIDES_GESTION], mode);
    assert.deepEqual([...r.neutralises].sort(), [...TOUS_FICHIERS_SUITE].sort(), mode);
    assert.ok(TOUS_FICHIERS_SUITE.every((c) => !lus.includes(c)), mode + " : fichiers non lus");
  }
  assert.ok(decrireMode("suite-en-ligne").mode.startsWith("suite-en-ligne"));
  assert.ok(decrireMode("suite-contre-epreuve").mode.startsWith("suite-contre-epreuve"));
});

test("la preuve de la suite : modes reconnus par préfixe, marqueurs de présence, personnages Preuve9, pas de $$, adresses fictives, aucun délimiteur partagé", () => {
  const gabarit = texteDuDepot(GABARIT_SUITE);
  assert.ok(!/\$\$/.test(gabarit), "pas de $$");
  const m = /v_en_ligne := v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m && decrireMode("suite-en-ligne").mode.startsWith(m[1]));
  assert.ok(gabarit.includes("p_mode like 'suite-contre-epreuve%'") && decrireMode("suite-contre-epreuve").mode.startsWith("suite-contre-epreuve"));
  assert.ok(gabarit.includes("p_mode like 'suite-en-ligne%'"));
  for (const marqueur of ["to_regclass('public.titres_version_unique')", "to_regprocedure('public.apercu_titre()')",
    "cree_par = 'migration 20261115_titres_9_catalogue') = 6", "to_regclass('public.journal_droits')"]) {
    assert.ok(gabarit.includes(marqueur), `marqueur de présence : ${marqueur}`);
  }
  for (const prerequis of ["public.donner_titre(text, bigint, integer, integer[], integer)", "public._refus_gestion(text, integer, jsonb)", "public.titres_ouverts()"]) {
    assert.ok(gabarit.includes(`to_regprocedure('${prerequis}')`), `prérequis ${prerequis}`);
  }
  assert.match(gabarit, /from pg_policies where schemaname = 'public'/, "md5 des règles du schéma public");
  assert.match(gabarit, /order by tablename collate "C", policyname collate "C"/);
  assert.ok(gabarit.includes("'Preuve9 réseau R'") && gabarit.includes("'Preuve9 réseau R promo'"));
  for (const nom of gabarit.match(/'Preuve[0-9][^']*'/g) ?? []) assert.ok(nom.startsWith("'Preuve9"), `nom posé par la preuve de la suite : ${nom}`);
  // Le retrait des titres non fixes précède le jeu du premier retour (les textes des retours sont lus dans le declare du bloc).
  const retrait = gabarit.lastIndexOf("pg_temp.retirer_titres_non_fixes()");
  assert.ok(retrait > gabarit.indexOf("do $tsprg$") && retrait < gabarit.indexOf("pg_temp.jouer('retour '"), "retrait, puis retours");
  const adresses = [...(gabarit.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? []), ...(texteDuDepot(AIDES_GESTION).match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? [])];
  for (const adresse of adresses) assert.ok(adresse.endsWith("@exemple.invalid"), `adresse de la preuve fictive : ${adresse}`);
  const delimiteurs = new Set(gabarit.match(/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g));
  for (const chemin of TOUS_FICHIERS_SUITE.filter((c) => existsSync(join(RACINE, c)))) {
    for (const d of delimiteurs) assert.ok(!texteDuDepot(chemin).includes(d), `${chemin} : ${d} figure aussi dans le gabarit`);
  }
});

test("les aides de gestion : sorties de la preuve de gestion, sans marqueur, incluses après les deux autres ; le retour 6 suit le retrait des titres non fixes", () => {
  const aides = texteDuDepot(AIDES_GESTION);
  assert.ok(!/@@(?:INJECTER|INCLURE|MODE)/.test(aides), "aucun marqueur dans un fichier inclus");
  assert.ok(aides.includes("create or replace function pg_temp.poser_titres_gestion()"));
  assert.ok(aides.includes("create or replace function pg_temp.retirer_titres_non_fixes()"));
  const gestion = texteDuDepot(GABARIT_GESTION);
  assert.ok(!gestion.includes("function pg_temp.poser_titres_gestion()"), "poser_titres_gestion n'est plus dans la preuve de gestion");
  assert.ok(gestion.indexOf(`-- @@INCLURE ${AIDES_TITRES}@@`) < gestion.indexOf(`-- @@INCLURE ${AIDES_GESTION}@@`));
  const retrait = gestion.indexOf("pg_temp.retirer_titres_non_fixes()");
  // Le texte du retour 6 est lu juste avant le groupe d5 (qui l'essaie, annulé) ; le retrait précède son vrai jeu.
  assert.ok(retrait > 0 && retrait < gestion.indexOf("pg_temp.jouer('retour 6', v_r6)"), "le retrait précède le jeu du retour 6");
  assert.ok(gestion.indexOf(`-- @@INJECTER ${ETAPES_GESTION[6].retour}@@`) < gestion.indexOf("perform pg_temp.groupe_d5('retour 6'"), "le texte du retour 6 est lu avant d5");
  assert.ok(retrait > gestion.lastIndexOf("perform pg_temp.groupe_"), "et suit le dernier groupe");
});

test("suite : la ligne de commande écrit hors du dépôt et refuse suite --etapes 7,9 avec un message clair", () => {
  const dossier = mkdtempSync(join(tmpdir(), "suite-"));
  try {
    const erreurs = [];
    assert.equal(principal(["suite-contre-epreuve", join(dossier, "suite.sql")], { racine: RACINE, journal: () => {}, erreur: (m) => erreurs.push(m) }), 0, erreurs.join("\n"));
    assert.ok(readFileSync(join(dossier, "suite.sql"), "utf8").includes("-- mode : suite-contre-epreuve (aucune migration injectee)"));
    const refus = [];
    assert.equal(principal(["suite", "--etapes", "7,9", join(dossier, "refus.sql")], { racine: RACINE, journal: () => {}, erreur: (m) => refus.push(m) }), 1);
    assert.match(refus.join("\n"), /étapes refusées : « 7,9 »/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("les gabarits contact : aides sans marqueur, pas de $$, mode en ligne reconnu par préfixe, adresses fictives, aucun délimiteur partagé avec les migrations", () => {
  assert.ok(!/@@(?:INJECTER|INCLURE|MODE)/.test(texteDuDepot(AIDES_CONTACT)), "contact-aides.sql ne porte aucun marqueur");
  for (const n of [1, 2, 3, 4]) {
    const gabarit = texteDuDepot(GABARITS_CONTACT[n]);
    assert.ok(!/\$\$/.test(gabarit), `partie ${n} : pas de $$`);
    const m = /v_en_ligne := v_mode like '([^'%]*)%'/.exec(gabarit);
    assert.ok(m && decrireMode(`contact-${n}-en-ligne`).mode.startsWith(m[1]), `partie ${n} : préfixe du mode en ligne`);
    const adresses = gabarit.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? [];
    for (const adresse of adresses) assert.ok(adresse.endsWith("@exemple.invalid"), `adresse fictive : ${adresse}`);
    const delimiteurs = new Set(gabarit.match(/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g));
    for (const chemin of TOUS_CONTACT.filter((c) => existsSync(join(RACINE, c)))) {
      for (const d of delimiteurs) assert.ok(!texteDuDepot(chemin).includes(d), `${chemin} : ${d} figure aussi dans le gabarit`);
    }
    assert.ok(!gabarit.includes(String.fromCharCode(0x2014)), "aucun tiret cadratin");
    assert.ok(!gabarit.includes("\r"), "fins de ligne LF");
  }
  const aides = texteDuDepot(AIDES_CONTACT);
  const adresses = aides.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? [];
  assert.ok(adresses.length > 0 && adresses.every((a) => a.endsWith("@exemple.invalid")));
  assert.ok(!aides.includes(String.fromCharCode(0x2014)));
});

// --- Table de cas du routage (espace contact, partie 2) : le marqueur -- @@CAS_ROUTAGE@@ ----------------------------------------------

test("contact-2 : le marqueur de la table de cas devient un littéral jsonb qui contient chaque nom de cas", () => {
  const table = JSON.parse(texteDuDepot(CAS_ROUTAGE));
  for (const mode of ["contact-2", "contact-2-contre-epreuve", "contact-2-en-ligne"]) {
    const r = assemblerMode(mode, RACINE, { lire: depotContact });
    assert.ok(!/@@CAS_ROUTAGE@@/.test(r.texte), `${mode} : marqueur remplacé`);
    const ligne = r.texte.split("\n").find((l) => l.includes('"cas":['));
    assert.ok(ligne && /^\s*(\$[A-Za-z_0-9]*\$)\{.*\}\1::jsonb$/.test(ligne), `${mode} : un littéral jsonb sur une ligne`);
    for (const c of table.cas) assert.ok(ligne.includes(`"nom":"${c.nom}"`), `${mode} : cas ${c.nom}`);
    assert.deepEqual(r.cas, { chemin: CAS_ROUTAGE, md5: md5(texteDuDepot(CAS_ROUTAGE)) });
    assert.ok(r.texte.includes(`-- cas de routage : ${CAS_ROUTAGE} (md5 `));
  }
  // Les parties 1 et 3 ne portent pas le marqueur : la table n'y est ni lue ni collée.
  const lus = [];
  const un = assemblerMode("contact-1", RACINE, { lire: (c) => { lus.push(c); return depotContact(c); } });
  assert.equal(un.cas, null);
  assert.ok(!lus.includes(CAS_ROUTAGE));
});

test("marqueur de la table de cas : fichier absent, JSON illisible, marqueur en double ou mal placé : refus clair", () => {
  const gabarit = "do $g$ begin perform\n-- @@CAS_ROUTAGE@@\n; end $g$;\n";
  const avec = (texte) => (c) => (c === CAS_ROUTAGE ? texte : null);
  assert.match(assembler(gabarit, avec('{"cas":[{"nom":"un"}]}')).texte, /\n\$injection\$\{"cas":\[\{"nom":"un"\}\]\}\$injection\$::jsonb\n/);
  assert.throws(() => assembler(gabarit, avec(null)), /Fichier introuvable : tests\/fixtures\/contact-routage\.json/);
  assert.throws(() => assembler(gabarit, avec("{pas du json")), /JSON illisible/);
  assert.throws(() => assembler(gabarit, avec('{"cas":"$g$"}')), /Collision de délimiteur : \$g\$/);
  assert.throws(() => assembler(gabarit + "-- @@CAS_ROUTAGE@@\n", avec("{}")), /marqueur de la table de cas en double/);
  assert.throws(() => assembler("select 1; -- @@CAS_ROUTAGE@@\n", avec("{}")), /marqueur mal placé/);
  // Le délimiteur choisi ne figure pas dans la table.
  assert.match(assembler(gabarit, avec('{"x":"$injection$"}')).texte, /\$injection_1\$\{"x":"\$injection\$"\}\$injection_1\$::jsonb/);
});

test("les fichiers de l'étape 3 (gabarit, aides, base locale) : aucun tiret cadratin, fins de ligne LF, aucune adresse de connexion", () => {
  for (const chemin of [GABARIT_SUITE, AIDES_GESTION, GABARIT_GESTION, "outils/base_locale/rejouer_suite.sh", "outils/base_locale/LISEZMOI.md"]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r"), `${chemin} : fins de ligne LF`);
    assert.ok(!/postgres(ql)?:\/\/[^\s"')]*:[^\s"')]*@/.test(brut), `${chemin} : aucune adresse de connexion avec mot de passe`);
  }
  const script = texteDuDepot("outils/base_locale/rejouer_suite.sh");
  assert.ok(script.includes('"$MIGRATIONS"/2026111?_titres_"$1"_*.sql'), "--titres cherche toute date du 10 au 19/11");
  assert.ok(script.includes(`--production) PRODUCTION=1; AUTONOMIE="1,2"`), "--production : e-learning 1, 2");
  // --production suit l'ordre réel : titres 1 à 3, contacts, conservation de la direction, titres 5 et 6.
  const prod = /if \[ "\$PRODUCTION" = 1 \]; then\n([\s\S]*?)\nelse/.exec(script)?.[1] ?? "";
  const places = ["for n in 1 2 3;", "$CONTACTS 20261111_conservation_direction", "for n in 5 6;"].map((x) => prod.indexOf(x));
  assert.ok(places.every((x) => x >= 0), "les trois morceaux de la liste de production");
  assert.deepEqual([...places].sort((a, b) => a - b), places, "dans l'ordre de la production");
  assert.ok(script.includes("-v version=2026-11-14 -1 -f \"$MIGRATIONS/20261114_autonomie_2_version.sql\""), "la migration 2 de l'e-learning avec la version de la production");
  // Puis les petits restes du 14/11, avec --production seulement : restes_1 (elle contrôle la version de l'autonomie), puis restes_2.
  const restes = ["20261114_autonomie_2_version.sql", "for f in 20261114_restes_1_conditions 20261114_restes_2_truncate; do"].map((x) => script.indexOf(x));
  assert.ok(restes.every((x) => x >= 0) && restes[0] < restes[1], "restes_1 puis restes_2, après l'e-learning");
  assert.match(script, /if \[ "\$PRODUCTION" = 1 \]; then\n  for f in 20261114_restes_1_conditions 20261114_restes_2_truncate; do/, "les restes avec --production seulement");
  assert.match(script, /done\nfi\n(?:#[^\n]*\n)+if \[ "\$PRODUCTION" = 1 \]; then\n  \$P -1 -f "\$MIGRATIONS\/20261114_jury_resultats\.sql"/, "puis le jury, avec --production seulement");
  const jury = script.indexOf('$P -1 -f "$MIGRATIONS/20261114_jury_resultats.sql"'), sept = script.indexOf('$P -1 -f "$MIGRATIONS/20261115_titres_7_correctifs.sql"');
  assert.ok(jury > 0 && sept > jury, "puis la migration 7 des titres, après le jury");
  assert.ok(script.includes('if [ "$PRODUCTION" = 1 ]; then\n  $P -1 -f "$MIGRATIONS/20261115_titres_7_correctifs.sql"'), "avec --production seulement");
  // La migration 8 des titres (aperçu par titre), appliquée en production le 14/11 après la 7 : 29 migrations.
  const huit = script.indexOf('$P -1 -f "$MIGRATIONS/20261115_titres_8_apercu.sql"');
  assert.ok(huit > sept, "puis la migration 8 des titres, après la 7");
  assert.match(script, /titres_7_correctifs\.sql"[^\n]*\n  N=\$\(\(N \+ 1\)\)\n  \$P -1 -f "\$MIGRATIONS\/20261115_titres_8_apercu\.sql"[^\n]*\n  N=\$\(\(N \+ 1\)\)\nfi\n/, "dans le même bloc --production, chacune comptée");
  // La migration 9 des titres (catalogue du réseau), appliquée en production le 16/11 après la 8, dans un bloc --production à elle : 30 migrations.
  const neuf = script.indexOf('$P -1 -f "$MIGRATIONS/20261115_titres_9_catalogue.sql"');
  assert.ok(neuf > huit, "puis la migration 9 des titres, après la 8");
  assert.match(script, /fi\n(?:#[^\n]*\n)+if \[ "\$PRODUCTION" = 1 \]; then\n  \$P -1 -f "\$MIGRATIONS\/20261115_titres_9_catalogue\.sql"[^\n]*\n  N=\$\(\(N \+ 1\)\)\nfi\n/, "avec --production seulement, comptée");
  assert.ok(script.includes("(sortie : 30 migrations)"), "l'en-tête du script annonce 30 migrations");
  assert.ok(texteDuDepot("outils/base_locale/LISEZMOI.md").includes("`OK : suite rejouée (30 migrations)`"), "le LISEZMOI aussi");
});

test("la preuve de la suite : l'aiguillage des groupes (sort_du_groupe) couvre chaque cas, contrôlé au groupe structure à chaque jeu", () => {
  const gabarit = texteDuDepot(GABARIT_SUITE);
  const corps = /function pg_temp\.groupe_suite_a_jouer[\s\S]*?end \$tsg\$;/.exec(gabarit)?.[0] ?? "";
  assert.ok(corps.includes("pg_temp.sort_du_groupe(p_mode, pg_temp.migration_presente(p_etape)"), "groupe_suite_a_jouer s'en remet à la décision pure");
  assert.ok(corps.includes("pg_temp.etapes_injectees"), "et lui dit si la migration est injectée");
  assert.match(gabarit, /insert into pg_temp\.etapes_injectees \(etape\) select v_etapes\[i\] from generate_subscripts\(v_etapes, 1\) i where v_textes\[i\] <> 'select 1';/);
  assert.ok(gabarit.indexOf("insert into pg_temp.etapes_injectees") < gabarit.indexOf("pg_temp.jouer('migration '"), "posées avant les migrations");
  // Les cas contrôlés : (mode, présente, injectée, journal requis, journal présent) -> sort.
  const cas = [...gabarit.matchAll(/\('(suite[^']*)', (true|false), (true|false), (true|false), (true|false), '([a-z-]+)'\)/g)]
    .map((m) => ({ mode: m[1], presente: m[2] === "true", injectee: m[3] === "true", requis: m[4] === "true", journal: m[5] === "true", sort: m[6] }));
  const trouve = (f, sort) => cas.some((c) => f(c) && c.sort === sort);
  const injecte = (c) => c.mode.startsWith("suite (");
  assert.ok(trouve((c) => injecte(c) && !c.presente && !c.injectee && !c.requis, "sauter-non-demandee"), "mode injecté, migration non demandée : sautée (suite --etapes 7 peut sortir VERT)");
  assert.ok(trouve((c) => injecte(c) && !c.presente && c.injectee && !c.requis, "echec"), "mode injecté, migration demandée mais absente : échec");
  assert.ok(trouve((c) => injecte(c) && c.presente && !c.requis, "jouer"), "mode injecté, migration en place : joué");
  assert.ok(trouve((c) => c.mode.startsWith("suite-contre-epreuve") && !c.presente && !c.requis, "jouer"), "contre-épreuve : joué même sans migration");
  assert.ok(trouve((c) => c.mode.startsWith("suite-en-ligne") && !c.presente && !c.requis, "sauter-en-ligne"), "en ligne, migration absente : sauté");
  assert.ok(trouve((c) => c.requis && !c.journal, "sauter-journal"), "journal requis et absent : sauté");
  assert.match(gabarit, /perform pg_temp\.controler_sort_du_groupe\(\);/, "les cas se jouent au groupe structure");
  // Le retrait des titres non fixes : seulement dans les modes qui injectent des retours.
  assert.match(gabarit, /if v_mode like 'suite \(%' then\n    perform pg_temp\.informer\('avant les retours'/);
  assert.match(texteDuDepot(GABARIT_GESTION), /if v_mode like 'gestion \(%' then\n    perform pg_temp\.informer\('avant les retours'/);
  for (const [mode, prefixe] of [["suite", "suite ("], ["suite-en-ligne", "suite-en-ligne"], ["suite-contre-epreuve", "suite-contre-epreuve"]]) {
    const libelle = mode === "suite" ? assemblerMode("suite", RACINE, { lire: depotSuite }).mode : decrireMode(mode).mode;
    assert.equal(libelle.startsWith("suite ("), mode === "suite", `${mode} : seul le mode injecté commence par « suite ( »`);
    assert.ok(libelle.startsWith(prefixe));
  }
  assert.ok(!decrireMode("gestion-en-ligne").mode.startsWith("gestion (") && !decrireMode("gestion-contre-epreuve").mode.startsWith("gestion ("));
});

test("la preuve de la suite : le groupe journal_suite (étape 4) demande la table, se joue en contre-épreuve et laisse l'état comme avant", () => {
  const gabarit = texteDuDepot(GABARIT_SUITE);
  assert.match(gabarit, /if pg_temp\.groupe_suite_a_jouer\('journal_suite', 9, v_mode, true\) then\n    perform pg_temp\.groupe_journal_suite\(\);/, "appelé derrière l'aiguillage, journal requis");
  const decision = /returns text language sql immutable as \$tsd\$[\s\S]*?\$tsd\$;/.exec(gabarit)?.[0] ?? "";
  assert.ok(decision.indexOf("suite-contre-epreuve") < decision.indexOf("sauter-journal"), "la contre-épreuve joue le groupe avant l'aiguillage du journal absent (rouge sans la table)");
  const corps = /function pg_temp\.groupe_journal_suite[\s\S]*?end \$tsjs\$;/.exec(gabarit)?.[0] ?? "";
  assert.ok(corps.includes("la table journal_droits existe") && corps.includes("to_regclass('public.journal_droits') is null"), "le groupe vérifie la table avant tout");
  assert.ok(corps.includes("raise exception 'preuve journal_suite : essai annulé'"), "les gestes sont joués dans une sous-transaction toujours annulée");
  for (const mot of ["effacer_adresse_journal", "journal_des_droits", "'cree'", "'retire'", "'donne'"]) assert.ok(corps.includes(mot), mot);
  assert.ok(!corps.includes(String.fromCharCode(0x2014)), "aucun tiret cadratin");
  assert.match(gabarit, /v_r4 <> 'select 1' and not v_en_ligne and v_jouees > 0/, "le retour 4 : table, déclencheurs et fonctions retirés");
});

test("la migration 7 (partie A, D1) : fichiers propres, aucune règle touchée, _refus_gestion remplacée en entier après garde, retour au texte exact de la migration 6", () => {
  for (const chemin of [S[7].migration, S[7].retour, "outils/generer_fragments_titres_7.py"]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r") || chemin.endsWith(".py"), `${chemin} : fins de ligne LF`);
    if (chemin.startsWith("supabase/")) {
      assert.match(brut, /^set local lock_timeout = '3s';$/m, `${chemin} : lock_timeout`);
      assert.ok(!/(alter|create|drop) policy/i.test(brut), `${chemin} : aucune règle réécrite`);
    }
  }
  const m = texteDuDepot(S[7].migration);
  const r = texteDuDepot(S[7].retour);
  const six = texteDuDepot("supabase/migrations/20261112_titres_6_gestion.sql");
  const corps = (def) => def.slice(def.indexOf("\nas $f$") + "\nas $f$".length, def.lastIndexOf("$f$;"));
  const corps6 = corps(/^create function public\._refus_gestion\([\s\S]*?^\$f\$;$/m.exec(six)[0]);
  const pose = (t) => corps(/^create or replace function public\._refus_gestion\([\s\S]*?^\$f\$;$/m.exec(t)[0]);
  const garde = (t) => /\$attendu\$([\s\S]*?)\$attendu\$/.exec(t)[1];
  assert.equal(garde(m), corps6, "l'aller ne remplace que le texte de la migration 6");
  assert.equal(pose(r), corps6, "le retour remet le texte de la migration 6, octet pour octet");
  assert.equal(garde(r), pose(m), "le retour ne défait que le texte posé par l'aller");
  const d1 = pose(m);
  assert.ok(d1.includes("return 'titres: Réservé au siège.';"), "règle 4 : le siège fixe seul");
  assert.ok(d1.includes("if case_centre(p_lieu_id, 'equipe') <> 2 and not coalesce(siege_fixe(), false) then"), "règle 3 : équipe du centre ou siège fixe");
  assert.ok(d1.includes("if not coalesce(direction_fixe(p_lieu_id), false) and not coalesce(siege_fixe(), false) then"), "règle 3 : jamais plus que soi, sauf direction fixe ou siège fixe");
  assert.equal((d1.match(/case_reseau\('directions'\)/g) ?? []).length, 1, "case_reseau ne garde que la règle 5 (titre du réseau de niveau réseau)");
  for (const t of [m, r]) {
    assert.match(t, /revoke all on function public\._refus_gestion\(text, integer, jsonb\) from public, anon, authenticated, service_role;/);
    assert.ok(!/grant execute on function public\._refus_gestion/.test(t), "aucun droit d'exécution");
  }
});

test("la migration 7 (partie B, D4) : index unique partiel après garde, verrous d'ajuster_titre et de donner_titre en fragments, retour inverse", () => {
  const m = texteDuDepot(S[7].migration);
  const r = texteDuDepot(S[7].retour);
  const six = texteDuDepot("supabase/migrations/20261112_titres_6_gestion.sql");
  const index = "create unique index titres_version_unique on public.titres (origine_id, lieu_id) where origine_id is not null;";
  assert.equal(m.split(index).length - 1, 1, "l'index, une fois");
  assert.ok(m.indexOf("do $garde_versions$") < m.indexOf(index), "la garde des doublons précède l'index");
  assert.match(m, /having count\(\*\) > 1\) d;\n  if v_n > 0 then\n    raise exception 'titres_7_correctifs : % titre\(s\) du réseau ont plus d''une version dans un même centre ; rien n''est changé', v_n;/);
  assert.match(r, /^drop index public\.titres_version_unique;$/m, "le retour retire l'index");
  // Les anciens de l'aller sont des textes de la migration 6, chacun une seule fois dans sa fonction.
  const fonction6 = (nom) => new RegExp(`^create function public\\.${nom}\\([\\s\\S]*?^\\$f\\$;$`, "m").exec(six)[0];
  const tableau = (t, d) => [...t.matchAll(new RegExp(`\\$${d}\\$([\\s\\S]*?)\\$${d}\\$`, "g"))].map((x) => x[1]);
  const anciens = tableau(m, "ancien"), nouveaux = tableau(m, "nouveau");
  // Partie B : les trois premiers fragments d'ajuster_titre (rangs 0 à 2) et le premier de donner_titre (rang 4) ; la partie C suit (test suivant).
  assert.equal(anciens.length, 9, "neuf fragments (B : trois pour ajuster_titre, un pour donner_titre ; C : cinq)");
  assert.match(m, /v_de integer\[\] := array\[1, 1, 1, 1, 2, 2, 2, 2, 3\];/);
  assert.match(m, /'public\.ajuster_titre\(bigint, integer, text, jsonb\)',\n    'public\.donner_titre\(text, bigint, integer, integer\[\], integer\)',\n    'public\.creer_titre\(bigint, text, integer\)'\];/);
  const sources = [fonction6("ajuster_titre"), fonction6("ajuster_titre"), fonction6("ajuster_titre"), fonction6("ajuster_titre"),
    fonction6("donner_titre"), fonction6("donner_titre"), fonction6("donner_titre"), fonction6("donner_titre"), fonction6("creer_titre")];
  anciens.forEach((a, i) => assert.equal(sources[i].split(a).length - 1, 1, `fragment ${i + 1} : trouvé une fois dans la migration 6`));
  assert.ok(nouveaux[0].includes("  v_contrainte text;"));
  assert.ok(nouveaux[1].includes("  perform 1 from titres where id = p_titre_id for update;\n  if t.lieu_du_titre is null"), "verrou avant la recherche de la version");
  assert.ok(nouveaux[2].includes("get stacked diagnostics v_contrainte = constraint_name;"));
  assert.ok(nouveaux[2].includes("raise exception 'titres: Ce titre vient d''être ajusté pour ce centre par une autre personne : rouvrez-le, puis réessayez.';"));
  assert.ok(nouveaux[2].includes("raise exception 'titres: Un titre de ce nom existe déjà ici.';"), "l'ancienne phrase reste pour un nom en double");
  assert.ok(nouveaux[4].includes("  perform 1 from titres where id = p_titre_id for share;\n  select v.id into v_ancien"), "verrou partagé avant la recherche de la version");
  // Le retour : les mêmes fragments, anciens et nouveaux échangés.
  assert.deepEqual(tableau(r, "ancien"), nouveaux);
  assert.deepEqual(tableau(r, "nouveau"), anciens);
});

test("la migration 7 (partie C, M4, M5, M7) : fiche et is_admin au seul Formateur fixe, noms sans doublon d'une portée à l'autre, après le droit", () => {
  const m = texteDuDepot(S[7].migration);
  const r = texteDuDepot(S[7].retour);
  const tableau = (t, d) => [...t.matchAll(new RegExp(`\\$${d}\\$([\\s\\S]*?)\\$${d}\\$`, "g"))].map((x) => x[1]);
  const anciens = tableau(m, "ancien"), nouveaux = tableau(m, "nouveau");
  const m4 = "raise exception 'titres: Une fiche formateur ne se relie qu''au titre Formateur.';";
  const reseau = "raise exception 'titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';";
  const centre = "raise exception 'titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';";
  // ajuster_titre (rang 3) : M7 après le second contrôle du droit (cases actuelles), le titre, sa racine et ses versions écartés.
  assert.ok(anciens[3].startsWith("  v_phrase := _refus_gestion(t.niveau, v_lieu, _cases_effectives(coalesce(v_version, p_titre_id)));"));
  assert.ok(nouveaux[3].startsWith(anciens[3]), "M7 vient après le contrôle du droit");
  for (const p of [reseau, centre]) assert.ok(nouveaux[3].includes(p));
  assert.equal(nouveaux[3].split("<> t.racine").length - 1, 2, "racine écartée dans les deux refus");
  assert.ok(nouveaux[3].includes("if v_nom is not null then"), "le nom seulement");
  // donner_titre (rangs 5 à 7) : le refus M4 après la lecture du titre (donc après _refus_titre), puis le seul Formateur fixe.
  assert.ok(nouveaux[5].startsWith("  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;\n"));
  assert.ok(nouveaux[5].includes("if p_prof_id is not null and not (t.niveau = 'promo' and t.fixe) then") && nouveaux[5].includes(m4));
  assert.ok(nouveaux[6].includes("_orphelin_en_personnel(v_email, t.niveau = 'promo' and t.fixe, case when t.niveau = 'promo' and t.fixe then p_prof_id end, v_moi);"));
  assert.equal(nouveaux[7], "    if t.niveau = 'promo' and t.fixe then\n      v_cree := _profil_formateur(");
  // creer_titre (rang 8) : M7 juste avant l'insertion, donc après _refus_gestion.
  assert.ok(nouveaux[8].endsWith(anciens[8]) && anciens[8] === "  begin\n    insert into titres (nom, niveau, lieu_id, cases, cree_par)");
  for (const p of [reseau, centre]) assert.ok(nouveaux[8].includes(p));
  // Le retour défait la partie C (fragments échangés) ; aucune phrase de C n'est posée par le retour.
  for (const p of [m4, reseau, centre]) assert.ok(!tableau(r, "nouveau").some((x) => x.includes(p)), `le retour ne pose pas ${p}`);
});

test("garde D5 : les retours 6, 7, 8 et 9 commencent, juste après le lock_timeout, par le compte des titres non fixes portés et la phrase D5", () => {
  for (const [chemin, prefixe] of [[ETAPES_GESTION[6].retour, "titres_6_gestion_retour"], [S[7].retour, "titres_7_correctifs_retour"],
    [S[8].retour, "titres_8_apercu_retour"], [S[9].retour, "titres_9_catalogue_retour"]]) {
    const t = texteDuDepot(chemin);
    const code = t.split("\n").filter((l) => l.trim() !== "" && !l.trimStart().startsWith("--"));
    assert.equal(code[0], "set local lock_timeout = '3s';", `${chemin} : lock_timeout d'abord`);
    assert.equal(code[1], "do $garde_d5$", `${chemin} : la garde D5 est la première instruction après le lock_timeout`);
    const garde = t.slice(t.indexOf("do $garde_d5$"), t.indexOf("end $garde_d5$;"));
    assert.ok(garde.includes("from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe"), `${chemin} : compte des titres non fixes portés`);
    assert.ok(garde.includes(`raise exception '${prefixe} : % affectation(s) portent un titre non fixe ; les retirer d''abord (page Équipe ou Directions de centre) ; rien n''est changé', v_n;`),
      `${chemin} : phrase D5`);
    assert.equal(t.split("$garde_d5$").length - 1, 2, `${chemin} : une seule garde D5`);
    const verrou = garde.indexOf("lock table public.affectations in share mode;");
    assert.ok(verrou > 0 && verrou < garde.indexOf("select count(*) into v_n"), `${chemin} : affectations verrouillée avant le compte`);
    assert.ok(t.includes(`-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f ${chemin}.`), `${chemin} : en-tête psql -1`);
  }
  // Les deux preuves jouent le groupe d5 commun (aides de gestion) avant le retrait des titres non fixes.
  const aides = texteDuDepot(AIDES_GESTION);
  assert.ok(aides.includes("create or replace function pg_temp.groupe_d5(p_nom text, p_texte text, p_prefixe text, p_fonctions text[])"));
  const suite = texteDuDepot(GABARIT_SUITE);
  assert.ok(suite.indexOf("pg_temp.groupe_d5('retour 7', v_r7, 'titres_7_correctifs_retour'") > 0);
  assert.ok(suite.indexOf("pg_temp.groupe_d5('retour 7'") < suite.lastIndexOf("pg_temp.retirer_titres_non_fixes()"), "suite : d5 avant le retrait");
  assert.ok(suite.indexOf("pg_temp.groupe_d5('retour 8', v_r8, 'titres_8_apercu_retour'") > 0);
  assert.ok(suite.indexOf("pg_temp.groupe_d5('retour 8'") < suite.lastIndexOf("pg_temp.retirer_titres_non_fixes()"), "suite : d5 du retour 8 avant le retrait");
  assert.ok(suite.indexOf("pg_temp.groupe_d5('retour 9', v_r9, 'titres_9_catalogue_retour'") > 0);
  assert.ok(suite.indexOf("pg_temp.groupe_d5('retour 9'") < suite.lastIndexOf("pg_temp.retirer_titres_non_fixes()"), "suite : d5 du retour 9 avant le retrait");
  const gestion = texteDuDepot(GABARIT_GESTION);
  assert.ok(gestion.indexOf("pg_temp.groupe_d5('retour 6', v_r6, 'titres_6_gestion_retour'") > 0);
  assert.ok(gestion.indexOf("pg_temp.groupe_d5('retour 6'") < gestion.indexOf("pg_temp.retirer_titres_non_fixes()"), "gestion : d5 avant le retrait");
});

test("la migration 8 (aperçu par titre) : fichiers propres, aides de l'aperçu sans droit et posées avant le bloc, six fonctions en fragments relus dans la migration 2, mes_titres remplacée en entier, retour inverse", () => {
  for (const chemin of [S[8].migration, S[8].retour, "outils/generer_fragments_titres_8.py"]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r") || chemin.endsWith(".py"), `${chemin} : fins de ligne LF`);
    if (chemin.startsWith("supabase/")) {
      assert.match(brut, /^set local lock_timeout = '3s';$/m, `${chemin} : lock_timeout`);
      assert.ok(!/(alter|create|drop) policy/i.test(brut), `${chemin} : aucune règle réécrite`);
    }
  }
  const m = texteDuDepot(S[8].migration);
  const r = texteDuDepot(S[8].retour);
  const deux = texteDuDepot("supabase/migrations/20261112_titres_2_gestes.sql");
  const six = texteDuDepot("supabase/migrations/20261112_titres_6_gestion.sql");
  // Les aides de l'aperçu : aucune exécution, posées avant le bloc généré (case_promo et les autres, en SQL, sont validées à leur création).
  const debutBloc = m.indexOf("-- debut du bloc genere");
  for (const [sig, cree] of [["apercu_titre()", "create function public.apercu_titre()"], ["_case_apercu(text, integer)", "create function public._case_apercu(p_page text, p_plafond integer)"],
    ["_apercu_fixe()", "create function public._apercu_fixe()"]]) {
    assert.ok(m.indexOf(cree) > 0 && m.indexOf(cree) < debutBloc, `${sig} posée avant le bloc`);
    assert.ok(m.includes(`revoke all on function public.${sig} from public, anon, authenticated, service_role;`), `${sig} : aucun droit`);
    assert.ok(!m.includes(`grant execute on function public.${sig}`), `${sig} : aucun grant`);
    assert.ok(r.includes(`drop function public.${sig};`), `${sig} : retirée par le retour`);
  }
  for (const sig of ["titres_ajustables(integer)", "journal_present()"]) {
    assert.ok(m.includes(`revoke all on function public.${sig} from public, anon, service_role;\ngrant execute on function public.${sig} to authenticated;`), `${sig} : authenticated seul`);
    assert.ok(r.includes(`drop function public.${sig};`), `${sig} : retirée par le retour`);
  }
  // apercu_titre : le fondateur, l'aperçu, le niveau et le centre affiché ; chiffres seuls.
  assert.ok(m.includes("entete !~ '^[0-9]{1,18}$'"));
  assert.ok(m.includes("v_role not in ('formateur', 'direction', 'siege') or not coalesce(fondateur_reel(), false)"));
  assert.ok(m.includes("and t.niveau = case v_role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end"));
  assert.ok(m.includes("and (t.lieu_id is null or t.lieu_id = lieu_courant());"));
  // Les fragments : chaque ancien figure une fois dans la définition de sa fonction (migration 2) ; le retour les échange.
  const tableau = (t, d) => [...t.matchAll(new RegExp(`\\$${d}\\$([\\s\\S]*?)\\$${d}\\$`, "g"))].map((x) => x[1]);
  const anciens = tableau(m, "ancien"), nouveaux = tableau(m, "nouveau");
  const noms = ["case_promo", "case_centre", "case_reseau", "formateur_fixe", "direction_fixe", "siege_fixe"];
  assert.equal(anciens.length, 6);
  assert.match(m, /v_de integer\[\] := array\[1, 2, 3, 4, 5, 6\];/);
  const fonction2 = (nom) => new RegExp(`^create function public\\.${nom}\\([\\s\\S]*?^\\$f\\$;$`, "m").exec(deux)[0];
  anciens.forEach((a, i) => assert.equal(fonction2(noms[i]).split(a).length - 1, 1, `${noms[i]} : fragment trouvé une fois dans la migration 2`));
  for (const i of [0, 1, 2]) assert.equal(nouveaux[i], anciens[i].replace("then pg.plafond else 0 end", "then _case_apercu(p_page, pg.plafond) else 0 end"), noms[i]);
  for (const i of [3, 4, 5]) assert.equal(nouveaux[i], anciens[i].replace(/\n$/, " and _apercu_fixe()\n"), noms[i]);
  assert.deepEqual(tableau(r, "ancien"), nouveaux);
  assert.deepEqual(tableau(r, "nouveau"), anciens);
  // mes_titres : remplacée en entier après garde ; le retour remet le texte de la migration 6, octet pour octet.
  const corps = (def) => def.slice(def.indexOf("\nas $f$") + "\nas $f$".length, def.lastIndexOf("$f$;"));
  const corps6 = corps(/^create function public\.mes_titres\([\s\S]*?^\$f\$;$/m.exec(six)[0]);
  const pose = (t) => corps(/^create or replace function public\.mes_titres\([\s\S]*?^\$f\$;$/m.exec(t)[0]);
  const garde = (t) => /\$attendu\$([\s\S]*?)\$attendu\$/.exec(t)[1];
  assert.equal(garde(m), corps6, "l'aller ne remplace que le texte de la migration 6");
  assert.equal(pose(r), corps6, "le retour remet le texte de la migration 6");
  assert.equal(garde(r), pose(m), "le retour ne défait que le texte posé par l'aller");
  const m10 = pose(m);
  assert.ok(m10.indexOf("raise exception 'titres: Connexion requise.' using errcode = '42501';") < m10.indexOf("v_apercu := apercu_role();"), "la garde de connexion en tête");
  assert.ok(m10.includes("if v_apercu = 'stagiaire' then\n    return;"), "aperçu stagiaire : aucune ligne");
  assert.ok(m10.includes("v_titre := coalesce(apercu_titre(), titre_fixe(v_niveau));"));
  assert.ok(m10.endsWith(corps6.slice(corps6.indexOf("  return query"))), "hors aperçu : la requête de la migration 6");
  // Le retour : garde D5, lectures retirées, bloc inverse, puis les aides.
  assert.ok(r.indexOf("drop function public.titres_ajustables(integer);") < r.indexOf("-- debut du bloc genere"));
  assert.ok(r.indexOf("-- fin du bloc genere") < r.indexOf("drop function public.apercu_titre();"));
});

// --- Chantier « cloisonnement par organisme » : modes cloisonnement, -contre-epreuve, -en-ligne, -sabotage ------------------------

const GABARIT_CLO = "tests/sql/cloisonnement-preuve.sql";
const AIDES_CLO = "tests/sql/cloisonnement-aides.sql";
const NUMEROS_CLO = ["1", "2a", "2b", "2c"];
const FICHIERS_CLO = NUMEROS_CLO.flatMap((n) => [ETAPES_CLOISONNEMENT[n].migration, ETAPES_CLOISONNEMENT[n].retour]);
const SABOTAGE_CLO = [SABOTAGE_CLOISONNEMENT.migration, SABOTAGE_CLOISONNEMENT.retour];
// Les étapes 2a, 2b, 2c et le sabotage n'existent qu'avec leurs tâches (3, 4, 5) : des textes factices en mémoire.
const FACTICES_CLO = Object.fromEntries([
  ...["2a", "2b", "2c"].flatMap((n) => [
    [ETAPES_CLOISONNEMENT[n].migration, `-- factice : cloisonnement migration ${n}\r\nselect '${n}';\r\n`],
    [ETAPES_CLOISONNEMENT[n].retour, `-- factice : cloisonnement retour ${n}\r\nselect '-${n}';\r\n`]]),
  [SABOTAGE_CLOISONNEMENT.migration, "-- factice : sabotage\nselect 'sabotage';\n"],
  [SABOTAGE_CLOISONNEMENT.retour, "-- factice : retour du sabotage\nselect 'retour du sabotage';\n"]]);
const depotClo = (chemin) => duDisque(chemin) ?? FACTICES_CLO[chemin] ?? null;
const depotCloSans = (absents) => (chemin) => (absents.includes(chemin) ? null : depotClo(chemin));
// L'ordre du gabarit : migrations 1, 2a, 2b, 2c, sabotage, retour du sabotage, retours 2c, 2b, 2a, 1.
const ORDRE_CLO = [...NUMEROS_CLO.map((n) => ETAPES_CLOISONNEMENT[n].migration), ...SABOTAGE_CLO,
  ...[...NUMEROS_CLO].reverse().map((n) => ETAPES_CLOISONNEMENT[n].retour)];
const ETAPE_2A_ECRITE = existsSync(join(RACINE, ETAPES_CLOISONNEMENT["2a"].migration));

test("cloisonnement sans --etapes, dépôt réel : l'étape 1 injectée octet pour octet, les étapes absentes et le sabotage neutralisés", () => {
  const lus = [];
  const r = assemblerMode("cloisonnement", RACINE, { lire: (c) => { lus.push(c); return duDisque(c); } });
  assert.deepEqual(r.inclusions.map((x) => x.chemin), [AIDES, AIDES_TITRES, AIDES_CLO]);
  assert.equal(r.injections[0].chemin, EMPREINTE);
  assert.ok(r.injections.some((x) => x.chemin === ETAPES_CLOISONNEMENT["1"].migration));
  assert.ok(r.injections.some((x) => x.chemin === ETAPES_CLOISONNEMENT["1"].retour));
  verifierInjections(r, duDisque);
  for (const c of SABOTAGE_CLO) assert.ok(r.neutralises.includes(c) && !lus.includes(c), `${c} : neutralisé et jamais lu hors du mode sabotage`);
  assert.equal(r.neutralises.length + r.injections.length - 1, 10);
  if (!ETAPE_2A_ECRITE) {
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ETAPES_CLOISONNEMENT["1"].migration, ETAPES_CLOISONNEMENT["1"].retour]);
    assert.equal(r.mode, "cloisonnement (etape 1 injectees)");
    assert.ok(r.texte.includes("\n'cloisonnement (etape 1 injectees)'\n"));
  }
});

test("cloisonnement sans --etapes : la plus longue suite d'étapes présentes depuis la 1 ; une étape absente arrête la suite", () => {
  const r = assemblerMode("cloisonnement", RACINE, { lire: depotClo });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ORDRE_CLO.filter((c) => !SABOTAGE_CLO.includes(c))]);
  assert.deepEqual([...r.neutralises].sort(), [...SABOTAGE_CLO].sort());
  verifierInjections(r, depotClo);
  assert.equal(r.mode, "cloisonnement (etapes 1, 2a, 2b, 2c injectees)");
  // 2b et 2c présentes mais un fichier de la 2a absent : seule la 1 est injectée, jamais une suite trouée.
  const trou = assemblerMode("cloisonnement", RACINE, { lire: depotCloSans([ETAPES_CLOISONNEMENT["2a"].retour]) });
  assert.equal(trou.mode, "cloisonnement (etape 1 injectees)");
  assert.equal(trou.injections.length, 3);
  // Aucune étape : tout neutralisé, libellé qui le dit.
  const rien = assemblerMode("cloisonnement", RACINE, { lire: depotCloSans([ETAPES_CLOISONNEMENT["1"].migration]) });
  assert.equal(rien.mode, "cloisonnement (aucune etape injectee)");
  assert.deepEqual(rien.injections.map((x) => x.chemin), [EMPREINTE]);
});

test("cloisonnement --etapes 1, 1,2a, 1,2a,2b, 1,2a,2b,2c : les étapes demandées injectées dans l'ordre du gabarit, les autres neutralisées et non lues", () => {
  for (const [etapes, mode] of [[["1"], "cloisonnement (etape 1 injectees)"], [["1", "2a"], "cloisonnement (etapes 1, 2a injectees)"],
    [["1", "2a", "2b"], "cloisonnement (etapes 1, 2a, 2b injectees)"], [["1", "2a", "2b", "2c"], "cloisonnement (etapes 1, 2a, 2b, 2c injectees)"]]) {
    const lus = [];
    const r = assemblerMode("cloisonnement", RACINE, { etapes, lire: (c) => { lus.push(c); return depotClo(c); } });
    const injectes = etapes.flatMap((n) => [ETAPES_CLOISONNEMENT[n].migration, ETAPES_CLOISONNEMENT[n].retour]);
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ORDRE_CLO.filter((c) => injectes.includes(c))], mode);
    assert.equal(r.neutralises.length, 10 - injectes.length, mode);
    for (const c of r.neutralises) assert.ok(!lus.includes(c), `${c} neutralisé donc non lu (${mode})`);
    verifierInjections(r, depotClo);
    assert.equal(r.mode, mode);
  }
  // La ligne de commande lit « 1 » comme un nombre : decrireMode l'accepte aussi.
  assert.deepEqual(decrireMode("cloisonnement", { etapes: [1] }).etapesCloisonnement, ["1"]);
  assert.deepEqual(decrireMode("cloisonnement", { etapes: [1, "2a"] }).etapesCloisonnement, ["1", "2a"]);
  assert.equal(decrireMode("cloisonnement").etapesCloisonnement, null);
});

test("cloisonnement : une étape demandée dont un fichier manque arrête l'assemblage en le nommant ; étapes refusées ; --etapes refusé ailleurs", () => {
  assert.throws(() => assemblerMode("cloisonnement", RACINE, { etapes: ["1", "2a"], lire: depotCloSans([ETAPES_CLOISONNEMENT["2a"].migration]) }),
    /Étape 2a demandée \(cloisonnement\) : supabase\/migrations\/20261128_cloisonnement_2a_noyau\.sql n'existe pas encore.*cloisonnement-contre-epreuve.*cloisonnement --etapes 1\./s);
  assert.throws(() => assemblerMode("cloisonnement", RACINE, { etapes: ["1", "2a", "2b"], lire: depotCloSans([ETAPES_CLOISONNEMENT["2b"].retour]) }),
    /Étape 2b demandée \(cloisonnement\) : supabase\/migrations\/20261128_cloisonnement_2b_siege_titres_retour\.sql n'existe pas encore.*--etapes 1,2a\./s);
  assert.throws(() => assemblerMode("cloisonnement", RACINE, { etapes: ["1"], lire: depotCloSans([ETAPES_CLOISONNEMENT["1"].retour]) }),
    /Étape 1 demandée \(cloisonnement\) : supabase\/migrations\/20261128_cloisonnement_1_fondations_retour\.sql n'existe pas encore\. En attendant : mode cloisonnement-contre-epreuve\./);
  for (const mauvaise of [[], ["2a"], ["1", "2b"], ["2a", "1"], ["1", "2a", "2b", "2c", "3"], [1, 2], ["1", "2"]]) {
    assert.throws(() => decrireMode("cloisonnement", { etapes: mauvaise }), /étapes refusées.*1, 1,2a, 1,2a,2b ou 1,2a,2b,2c/, JSON.stringify(mauvaise));
  }
  for (const mode of ["cloisonnement-contre-epreuve", "cloisonnement-en-ligne", "cloisonnement-sabotage"]) {
    assert.throws(() => decrireMode(mode, { etapes: ["1"] }), /--etapes ne vaut que pour le mode repetition, titres, gestion, suite ou cloisonnement/, mode);
  }
  // Les autres modes à étapes refusent une étape en lettres.
  assert.throws(() => decrireMode("titres", { etapes: [1, "2a"] }), /étapes refusées/);
  assert.throws(() => decrireMode("repetition", { etapes: [1, "2a"] }), /étapes refusées/);
});

test("cloisonnement-contre-epreuve et cloisonnement-en-ligne : les dix fichiers neutralisés et non lus, l'empreinte toujours là, libellés distincts", () => {
  for (const mode of ["cloisonnement-contre-epreuve", "cloisonnement-en-ligne"]) {
    const lus = [];
    const r = assemblerMode(mode, RACINE, { lire: (c) => { lus.push(c); return depotClo(c); } });
    assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE], mode);
    assert.deepEqual([...r.neutralises].sort(), [...FICHIERS_CLO, ...SABOTAGE_CLO].sort(), mode);
    assert.ok([...FICHIERS_CLO, ...SABOTAGE_CLO].every((c) => !lus.includes(c)), mode + " : fichiers non lus");
  }
  assert.ok(decrireMode("cloisonnement-en-ligne").mode.startsWith("cloisonnement-en-ligne"));
  assert.ok(!decrireMode("cloisonnement-contre-epreuve").mode.startsWith("cloisonnement-en-ligne"));
});

test("cloisonnement-sabotage : les quatre étapes et la règle relâchée injectées dans l'ordre du gabarit ; tant que la tâche 5 manque, refus qui nomme le fichier", () => {
  const r = assemblerMode("cloisonnement-sabotage", RACINE, { lire: depotClo });
  assert.deepEqual(r.injections.map((x) => x.chemin), [EMPREINTE, ...ORDRE_CLO]);
  assert.deepEqual(r.neutralises, []);
  verifierInjections(r, depotClo);
  assert.equal(r.mode, "cloisonnement-sabotage (etapes 1, 2a, 2b, 2c et regle relachee injectees)");
  assert.ok(!r.mode.startsWith("cloisonnement-en-ligne"));
  assert.throws(() => assemblerMode("cloisonnement-sabotage", RACINE, { lire: depotCloSans([SABOTAGE_CLOISONNEMENT.migration]) }),
    /Sabotage demandé \(cloisonnement-sabotage\) : tests\/sql\/cloisonnement-sabotage\.sql n'existe pas encore \(écrit par la tâche 5/);
  assert.throws(() => assemblerMode("cloisonnement-sabotage", RACINE, { lire: depotCloSans([SABOTAGE_CLOISONNEMENT.retour]) }),
    /Sabotage demandé \(cloisonnement-sabotage\) : tests\/sql\/cloisonnement-sabotage-retour\.sql n'existe pas encore/);
  // Sur le dépôt réel tant que les étapes 2a à 2c ne sont pas écrites : la première étape manquante est nommée.
  if (!ETAPE_2A_ECRITE) {
    assert.throws(() => assemblerMode("cloisonnement-sabotage"), /Étape 2a demandée \(cloisonnement-sabotage\) : supabase\/migrations\/20261128_cloisonnement_2a_noyau\.sql n'existe pas encore/);
  }
});

test("cloisonnement : la ligne de commande lit --etapes 1,2a, écrit hors du dépôt, refuse une étape absente ou une suite impossible (code 1)", () => {
  const dossier = mkdtempSync(join(tmpdir(), "assembler-clo-"));
  try {
    const un = join(dossier, "clo-1.sql");
    const ok = spawnSync(process.execPath, [SCRIPT, "cloisonnement", "--etapes", "1", un], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(readFileSync(un, "utf8"), assemblerMode("cloisonnement", RACINE, { etapes: ["1"] }).texte);
    assert.match(ok.stdout, /mode {8}cloisonnement \(etape 1 injectees\)/);
    const impossible = spawnSync(process.execPath, [SCRIPT, "cloisonnement", "--etapes", "1,2b", join(dossier, "x.sql")], { encoding: "utf8" });
    assert.equal(impossible.status, 1);
    assert.match(impossible.stderr, /étapes refusées : « 1,2b »/);
    const mal = spawnSync(process.execPath, [SCRIPT, "cloisonnement", "--etapes", "1,2A", join(dossier, "y.sql")], { encoding: "utf8" });
    assert.equal(mal.status, 1);
    assert.match(mal.stderr, /étapes refusées : « 1,2A »/);
    if (!ETAPE_2A_ECRITE) {
      const absente = spawnSync(process.execPath, [SCRIPT, "cloisonnement", "--etapes=1,2a", join(dossier, "z.sql")], { encoding: "utf8" });
      assert.equal(absente.status, 1);
      assert.match(absente.stderr, /Étape 2a demandée \(cloisonnement\)/);
      assert.ok(!existsSync(join(dossier, "z.sql")));
    }
    const dedans = spawnSync(process.execPath, [SCRIPT, "cloisonnement-contre-epreuve", join(RACINE, ".superpowers", "clo.sql")], { encoding: "utf8" });
    assert.equal(dedans.status, 1);
    assert.match(dedans.stderr, /sortie dans le dépôt refusée/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("la preuve du cloisonnement : mode en ligne reconnu par préfixe, pas de $$, adresses fictives, aides sans marqueur, marqueurs dans l'ordre du jeu, aucun délimiteur partagé", () => {
  const gabarit = texteDuDepot(GABARIT_CLO);
  const aides = texteDuDepot(AIDES_CLO);
  assert.ok(!/\$\$/.test(gabarit) && !/\$\$/.test(aides), "pas de $$");
  const m = /v_mode like '([^'%]*)%'/.exec(gabarit);
  assert.ok(m && decrireMode("cloisonnement-en-ligne").mode.startsWith(m[1]));
  for (const adresse of [...(gabarit.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? []), ...(aides.match(/[\w.+-]+@[\w.-]+\.[a-z]+/g) ?? [])]) {
    assert.ok(adresse.toLowerCase().endsWith("@exemple.invalid"), `adresse de la preuve fictive : ${adresse}`);
  }
  assert.ok(!/@@/.test(aides), "aides sans marqueur");
  const delimiteurs = new Set(gabarit.match(/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g));
  for (const chemin of [...FICHIERS_CLO, ...SABOTAGE_CLO].filter((c) => existsSync(join(RACINE, c)))) {
    for (const d of delimiteurs) assert.ok(!texteDuDepot(chemin).includes(d), `${chemin} : ${d} figure aussi dans le gabarit`);
  }
  const places = ORDRE_CLO.map((c) => gabarit.indexOf(`-- @@INJECTER ${c}@@`));
  assert.ok(places.every((p) => p > 0), "tous les marqueurs présents");
  assert.deepEqual([...places].sort((a, b) => a - b), places, "marqueurs dans l'ordre du jeu");
});

test("les fichiers de l'étape 1 du cloisonnement : aucun tiret cadratin, fins de ligne LF, lock_timeout, aucune fonction ni règle existante réécrite, droits explicites, retour complet", () => {
  for (const chemin of [ETAPES_CLOISONNEMENT["1"].migration, ETAPES_CLOISONNEMENT["1"].retour, GABARIT_CLO, AIDES_CLO]) {
    const brut = readFileSync(join(RACINE, chemin), "utf8");
    assert.ok(!brut.includes(String.fromCharCode(0x2014)), `${chemin} : aucun tiret cadratin`);
    assert.ok(!brut.includes("\r"), `${chemin} : fins de ligne LF`);
    assert.ok(!/postgres(ql)?:\/\/[^\s"')]*:[^\s"')]*@/.test(brut), `${chemin} : aucune adresse de connexion avec mot de passe`);
    if (chemin.startsWith("supabase/")) assert.match(brut, /^set local lock_timeout = '3s';$/m, `${chemin} : lock_timeout`);
  }
  const m = texteDuDepot(ETAPES_CLOISONNEMENT["1"].migration);
  assert.ok(!/create or replace function/i.test(m), "aucune fonction existante remplacée");
  assert.ok(!/(alter|drop) policy/i.test(m), "aucune règle existante touchée");
  assert.deepEqual(m.match(/create policy \w+/g), ["create policy acces_fondateur_lecture"]);
  const creees = [...m.matchAll(/^create function public\.(\w+)\(/gm)].map((x) => x[1]);
  assert.equal(creees.length, 15);
  for (const nom of creees) {
    const def = new RegExp(`^create function public\\.${nom}\\([\\s\\S]*?^\\$function\\$;$`, "m").exec(m)[0];
    assert.match(def, /^ security definer$/m, `${nom} : security definer`);
    assert.match(def, /^ set search_path to 'public', 'pg_temp'$/m, `${nom} : chemin de recherche`);
    assert.match(m, new RegExp(`revoke all on function public\\.${nom}\\([^)]*\\) from public, anon, authenticated, service_role;`), `${nom} : droits retirés`);
  }
  const ouvertes = [...m.matchAll(/^grant execute on function public\.(\w+)\(/gm)].map((x) => x[1]).sort();
  assert.deepEqual(ouvertes, ["est_siege_de", "fermer_acces_support", "mon_organisme", "organismes_pour_support", "ouvrir_acces_support"]);
  // service_role compris : sur Supabase, les droits par défaut donnent tout sur une table ou une séquence neuve à service_role.
  for (const objet of ["public.organismes", "sequence public.organismes_id_seq", "public.acces_fondateur", "sequence public.acces_fondateur_id_seq"]) {
    assert.ok(m.includes(`revoke all on ${objet} from public, anon, authenticated, service_role;`), `${objet} : droits retirés à tous, service_role compris`);
  }
  // Le journal : insertion seulement sous le marqueur posé par ouvrir_acces_support et _rattachement_fondateur ; motif nettoyé de tout
  // blanc (tabulations, retours à la ligne) dans la fonction comme dans la contrainte ; verrou du fondateur avant de fermer l'ancien support.
  assert.match(m, /^create trigger acces_fondateur_journal before insert or update or delete on public\.acces_fondateur$/m);
  assert.ok(m.includes("if coalesce(current_setting('cloisonnement.journal_fondateur', true), '') <> 'oui' then"));
  for (const nom of ["ouvrir_acces_support", "_rattachement_fondateur"]) {
    const def = new RegExp(`^create function public\\.${nom}\\([\\s\\S]*?^\\$function\\$;$`, "m").exec(m)[0];
    const pose = def.indexOf("perform set_config('cloisonnement.journal_fondateur', 'oui', true);");
    const ote = def.indexOf("perform set_config('cloisonnement.journal_fondateur', '', true);");
    const insere = def.indexOf("insert into acces_fondateur");
    assert.ok(pose > 0 && pose < insere && insere < ote, `${nom} : marqueur posé juste avant l'insertion, retiré juste après`);
  }
  const ouvrir = /^create function public\.ouvrir_acces_support\([\s\S]*?^\$function\$;$/m.exec(m)[0];
  assert.ok(ouvrir.includes("v_motif text := regexp_replace(p_motif, '^\\s+|\\s+$', '', 'g');"), "motif nettoyé de tout blanc");
  const verrou = ouvrir.indexOf("perform pg_advisory_xact_lock(hashtext('acces_fondateur:' || v_moi));");
  assert.ok(verrou > 0 && verrou < ouvrir.indexOf("update acces_fondateur af set ferme_le = now()"), "verrou du fondateur avant la fermeture de l'ancien support");
  assert.ok(m.includes("constraint acces_fondateur_motif check (motif is null or char_length(regexp_replace(motif, '^\\s+|\\s+$', '', 'g')) >= 10),"));
  assert.ok(!/btrim\(/.test(m), "aucun btrim : il ne retire que les espaces");
  assert.deepEqual(m.match(/^grant (?!execute).*$/gm), ["grant select on public.acces_fondateur to authenticated;"]);
  assert.ok(m.includes("raise exception 'Organisme introuvable pour cette ligne.' using errcode = '22023';"));
  const r = texteDuDepot(ETAPES_CLOISONNEMENT["1"].retour);
  for (const nom of creees) assert.match(r, new RegExp(`^drop function public\\.${nom}\\(`, "m"), `${nom} : retirée par le retour`);
  for (const declencheur of ["organisme_par_defaut on public.lieux", "journal_droits_organisme on public.journal_droits", "rattachement_fondateur on public.user_profiles"]) {
    assert.ok(r.includes(`drop trigger ${declencheur};`), `${declencheur} : retiré par le retour`);
  }
  assert.ok(r.indexOf("drop function public.ouvrir_acces_support") < r.indexOf("drop table public.acces_fondateur"), "la fonction qui rend une ligne du journal part avant la table");
  assert.ok(r.indexOf("drop table public.acces_fondateur") < r.indexOf("drop function public.est_siege_de"), "la règle part avec la table, avant est_siege_de");
  assert.ok(r.lastIndexOf("drop table public.organismes") > r.lastIndexOf("drop column organisme_id"), "organismes part en dernier");
});
