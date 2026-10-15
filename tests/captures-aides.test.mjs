import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as serveurHttp } from "node:http";
import { createServer as serveurTcp } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { USAGE, lireArguments, lireEtatPlanche, messageServeur, nettoyerProfil, resumerErreur } from "../outils/captures-aides.mjs";

// outils/captures.mjs sans Chrome : ses règles (arguments, lecture de la planche, diagnostic du serveur, nettoyage du profil)
// sont dans outils/captures-aides.mjs ; les trois derniers tests lancent le script lui-même, sur des serveurs qui n'existent que
// le temps du test, avec un Chrome qui n'existe pas (CHROME) : si le script le lançait quand même, le message dirait « Chrome
// introuvable » et non ce que le test attend.

test("lireArguments : --port est obligatoire (aucun port par défaut, partagé par tous les worktrees), un entier de 1 à 65535", () => {
  assert.match(lireArguments([]).erreur, /--port est obligatoire/);
  assert.match(lireArguments(["--codes", "kit"]).erreur, /--port est obligatoire/);
  for (const faux of ["abc", "0", "70000", "8766.5", "-1", ""]) {
    assert.match(lireArguments(["--port", faux]).erreur, /numéro de port entre 1 et 65535/, `--port « ${faux} »`);
  }
  assert.equal(lireArguments(["--port", "8766"]).port, 8766);
  assert.equal(lireArguments(["--port", "65535"]).port, 65535);
  assert.ok(USAGE.includes("--port <port>"), "le mode d'emploi montre le port obligatoire (sans crochets)");
});

test("lireArguments : valeurs par défaut, listes, et tout ce qui est mal écrit est refusé au lieu d'être ignoré", () => {
  assert.deepEqual(lireArguments(["--port", "8766"]),
    { port: 8766, sortie: "captures", largeurs: [343, 680], instants: [], codes: null });
  assert.deepEqual(lireArguments(["--port", "8766", "--codes", "a, b", "--largeurs", "343", "--instants", "0.5,1.2", "--sortie", "x"]),
    { port: 8766, sortie: "x", largeurs: [343], instants: [0.5, 1.2], codes: ["a", "b"] });
  // Une faute de frappe dans une option ne doit pas faire photographier « tout » sans prévenir.
  assert.match(lireArguments(["--port", "8766", "--code", "a"]).erreur, /Option inconnue « --code »/);
  assert.match(lireArguments(["--port", "8766", "--port=1"]).erreur, /Option inconnue/);
  assert.match(lireArguments(["8766"]).erreur, /Argument inattendu « 8766 »/);
  assert.match(lireArguments(["--port"]).erreur, /« --port » attend une valeur/);
  assert.match(lireArguments(["--port", "--codes", "a"]).erreur, /« --port » attend une valeur/);
  for (const [option, valeur] of [["--largeurs", "0"], ["--largeurs", "abc"], ["--largeurs", ","], ["--instants", "x"], ["--instants", "-1"], ["--codes", ""]]) {
    assert.match(lireArguments(["--port", "8766", option, valeur]).erreur, new RegExp(option), `${option} « ${valeur} »`);
  }
});

const PRETE = '<html><head><title>pret</title></head><body data-largeur="343" data-hauteur="543" data-rendus="2" data-absents="a,b" '
  + 'data-erreurs="0" data-mesures="343,343" data-disponibles="kit,kit-paire"><div id="planche"></div></body></html>';
const EN_COURS = '<html><head><title>Planche des dessins</title></head><body><div id="planche"></div></body></html>';
const PAGE_D_ERREUR = '<html><head><title>localhost</title></head><body><div id="main-frame-error"><span class="error-code">ERR_CONNECTION_REFUSED</span></div></body></html>';

test("lireEtatPlanche : la planche construite dit son état ; une planche qui n'a pas fini ou la page d'erreur de Chrome se distinguent", () => {
  assert.deepEqual(lireEtatPlanche(PRETE), { pret: true, reseau: null, hauteur: 543, rendus: 2, erreurs: 0,
    absents: ["a", "b"], mesures: [343, 343], disponibles: ["kit", "kit-paire"] });
  const enCours = lireEtatPlanche(EN_COURS);
  assert.equal(enCours.pret, false);
  assert.equal(enCours.reseau, null, "une planche qui n'a pas fini n'est pas un serveur absent");
  const erreur = lireEtatPlanche(PAGE_D_ERREUR);
  assert.equal(erreur.pret, false);
  assert.equal(erreur.reseau, "ERR_CONNECTION_REFUSED", "la page d'erreur de Chrome : le serveur a cessé de répondre");
  // Une planche prête dont une case rouge cite un code d'erreur de réseau reste une planche prête, qui a planté en route.
  assert.equal(lireEtatPlanche(PRETE.replace('<div id="planche">', '<div id="planche">ERR_FAILED')).reseau, null);
});

test("messageServeur : serveur injoignable, planche introuvable, autre réponse HTTP ; null quand la planche répond", () => {
  assert.equal(messageServeur(8766, { statut: 200 }), null);
  assert.equal(messageServeur(8766, { erreur: "ECONNREFUSED" }),
    "serveur injoignable sur le port 8766 (ECONNREFUSED) : lancer « python -m http.server 8766 » à la racine du dépôt.");
  assert.match(messageServeur(8766, { statut: 404 }), /^la planche est introuvable \(HTTP 404\) sur le port 8766 : le serveur sert-il la racine du dépôt/);
  assert.match(messageServeur(8766, { statut: 500 }), /répond HTTP 500 pour la planche/);
});

test("nettoyerProfil : un profil qui ne part pas est signalé, jamais une exception ; un profil supprimé ne dit rien", () => {
  const mots = [];
  assert.equal(nettoyerProfil("C:/profil", { supprimer: () => {}, avertir: (m) => mots.push(m) }), true);
  assert.deepEqual(mots, []);
  const verrou = () => { throw Object.assign(new Error("EBUSY: resource busy or locked, rmdir 'C:/profil'\n    at rmSync (node:fs)"), { code: "EBUSY" }); };
  assert.equal(nettoyerProfil("C:/profil", { supprimer: verrou, avertir: (m) => mots.push(m) }), false);
  assert.equal(mots.length, 1);
  assert.match(mots[0], /^profil de Chrome non supprimé \(C:\/profil\) : EBUSY: resource busy or locked/);
  assert.ok(!mots[0].includes("\n"), "une ligne, pas une trace de pile");
  // Le vrai nettoyage, sur un dossier de ce test (préfixe propre à la tâche, supprimé par son chemin exact).
  const dossier = mkdtempSync(join(tmpdir(), "d1t3b-profil-"));
  try {
    writeFileSync(join(dossier, "Preferences"), "{}");
    assert.equal(nettoyerProfil(dossier, { avertir: (m) => mots.push(m) }), true);
    assert.equal(existsSync(dossier), false);
    assert.equal(mots.length, 1, "rien de plus n'a été dit");
  } finally { rmSync(dossier, { recursive: true, force: true }); }
});

test("resumerErreur : Chrome introuvable est dit comme tel, sinon la première ligne du message", () => {
  assert.equal(resumerErreur(Object.assign(new Error("spawnSync x ENOENT"), { code: "ENOENT" }), "C:/chrome.exe"),
    "Chrome introuvable (C:/chrome.exe) : renseigner la variable d'environnement CHROME.");
  assert.equal(resumerErreur(new Error("première ligne\nseconde ligne"), "C:/chrome.exe"), "première ligne");
  assert.equal(resumerErreur("texte seul", "C:/chrome.exe"), "texte seul");
});

// Lance outils/captures.mjs (Node, sans Chrome) et rend { status, sortie } : stdout et stderr ensemble.
function lancerCaptures(args) {
  return new Promise((resolu, rejete) => {
    const enfant = spawn(process.execPath, ["outils/captures.mjs", ...args], {
      env: { ...process.env, CHROME: "d1t3b-chrome-inexistant.exe" }, stdio: ["ignore", "pipe", "pipe"] });
    let sortie = "";
    enfant.stdout.on("data", (d) => { sortie += d; });
    enfant.stderr.on("data", (d) => { sortie += d; });
    const minuterie = setTimeout(() => { enfant.kill(); rejete(new Error(`captures.mjs ne rend pas la main : ${sortie}`)); }, 30000);
    enfant.on("close", (status) => { clearTimeout(minuterie); resolu({ status, sortie }); });
  });
}
const portLibre = () => new Promise((resolu) => {
  const s = serveurTcp();
  s.listen(0, () => { const { port } = s.address(); s.close(() => resolu(port)); });
});

test("captures.mjs sans --port : le mode d'emploi et la sortie 2, rien n'est lancé", async () => {
  const { status, sortie } = await lancerCaptures(["--codes", "kit"]);
  assert.equal(status, 2);
  assert.match(sortie, /--port est obligatoire/);
  assert.ok(sortie.includes(`Usage : ${USAGE}`));
  assert.doesNotMatch(sortie, /\n\s+at /, "pas de trace de pile");
});

test("captures.mjs : aucun serveur sur le port, un message qui le dit (sortie 1, pas de trace de pile, Chrome jamais lancé)", async () => {
  const port = await portLibre();
  for (const args of [["--codes", "kit", "--largeurs", "343"], []]) {   // avec codes, puis sans (la liste des codes disponibles)
    const { status, sortie } = await lancerCaptures(["--port", String(port), ...args]);
    assert.equal(status, 1, args.join(" "));
    assert.ok(sortie.includes(`serveur injoignable sur le port ${port}`), sortie);
    assert.doesNotMatch(sortie, /Chrome introuvable/, "Chrome n'a pas été lancé pour rien");
    assert.doesNotMatch(sortie, /\n\s+at /, "pas de trace de pile");
  }
});

test("captures.mjs : un serveur qui n'a pas la planche (mauvais dossier servi) est dit introuvable, pas injoignable", async () => {
  const serveur = serveurHttp((requete, reponse) => { reponse.statusCode = 404; reponse.end("non"); });
  await new Promise((resolu) => serveur.listen(0, resolu));
  try {
    const { status, sortie } = await lancerCaptures(["--port", String(serveur.address().port), "--codes", "kit"]);
    assert.equal(status, 1);
    assert.match(sortie, /la planche est introuvable \(HTTP 404\)/);
    assert.doesNotMatch(sortie, /injoignable/);
    assert.doesNotMatch(sortie, /\n\s+at /);
  } finally { await new Promise((resolu) => serveur.close(resolu)); }
});
