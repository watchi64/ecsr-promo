import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  estServi, jetonIndex, citationsIndex, citationsManifeste, importsRelatifs, controler, fichiersSuivis,
} from "../outils/deployer/preparer.mjs";

// Liste blanche : la page, son manifeste, la page d'erreur, la page des liens d'e-mail, js/ css/ assets/ vendor/.
for (const p of ["index.html", "manifest.webmanifest", "404.html", "demande.html", "js/main.js", "css/app.css",
  "assets/logo/icon-192.png", "vendor/supabase-js-2.117.2.js"]) assert.ok(estServi(p), p);
for (const p of ["PROJECT_NOTES.md", "README.md", "LICENSE", "DEV.md", "docs/plan.md", "supabase/migrations/x.sql",
  "tests/a.test.mjs", "outils/psql_prod.sh", "scripts/cache-bust.js", "sources/scenes.js", "_harness.html",
  "js/_banc.js", "assets/.DS_Store", ".github/workflows/mise-en-ligne.yml", "deploiement/site.json",
  "_preview_dp.html", "dev.ps1"]) assert.ok(!estServi(p), p);

assert.equal(jetonIndex('<script type="module" src="js/main.js?v=20261114b"></script>'), "20261114b");
assert.equal(jetonIndex("<p>rien</p>"), null);

assert.deepEqual(citationsIndex('<link href="css/app.css?v=1"><script src="./js/main.js?v=1"></script>'
  + '<a href="https://x.fr/a.js"></a><a href="#/cours"></a><link rel="manifest" href="manifest.webmanifest">'),
  ["css/app.css", "js/main.js", "manifest.webmanifest"]);
// Un lien vers la racine du site n'est pas un fichier ; un chemin absolu se lit depuis la racine.
assert.deepEqual(citationsIndex('<a href="/">x</a><a href="./">y</a><a href="">z</a><link href="/css/a.css?v=1">'), ["css/a.css"]);
assert.deepEqual(citationsManifeste('{"icons":[{"src":"assets/logo/icon-192.png"},{"src":"./assets/logo/i.png?x"}]}'),
  ["assets/logo/icon-192.png", "assets/logo/i.png"]);
assert.deepEqual(importsRelatifs('import { a } from "./a.js?v=1";\nconst m = await import("../b.js?v=1");\nimport "./c.js";\n'
  + 'import x from "https://esm.sh/x";'), ["./a.js", "../b.js", "./c.js"]);

// Un faux dépôt : vert, puis chaque contrôle passe au rouge à son tour.
function depot(fichiers) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "deployer-"));
  for (const [p, contenu] of Object.entries(fichiers)) {
    fs.mkdirSync(path.dirname(path.join(r, p)), { recursive: true });
    fs.writeFileSync(path.join(r, p), contenu);
  }
  return r;
}
const base = {
  "index.html": '<link rel="manifest" href="manifest.webmanifest"><script type="module" src="js/main.js?v=20261114b"></script>',
  "manifest.webmanifest": '{"icons":[{"src":"assets/logo/icon.png"}]}',
  "assets/logo/icon.png": "png",
  "js/main.js": 'import { a } from "./a.js?v=20261114b";',
  "js/a.js": "export const a = 1;",
  "docs/secret.md": "eyJhbGciOiJIUzI1NiJ9xx.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnop",
};
const vert = controler(depot(base), Object.keys(base));
assert.deepEqual(vert.erreurs, [], "le faux dépôt de base doit être vert (docs/ n'est pas servi)");
assert.deepEqual(vert.servis, ["assets/logo/icon.png", "index.html", "js/a.js", "js/main.js", "manifest.webmanifest"]);

const sansA = { ...base }; delete sansA["js/a.js"];
assert.match(controler(depot(sansA), Object.keys(sansA)).erreurs.join("\n"), /js\/main\.js importe \.\/a\.js/);

const horsListe = { ...base, "js/main.js": 'import { s } from "../sources/scenes.js";', "sources/scenes.js": "" };
assert.match(controler(depot(horsListe), Object.keys(horsListe)).erreurs.join("\n"), /sources\/scenes\.js/);

const iconeAbsente = { ...base }; delete iconeAbsente["assets/logo/icon.png"];
assert.match(controler(depot(iconeAbsente), Object.keys(iconeAbsente)).erreurs.join("\n"), /manifeste cite assets\/logo\/icon\.png/);

const fuite = { ...base, "js/a.js": 'export const k = "sb_secret_abcdefghijkl";' };
assert.match(controler(depot(fuite), Object.keys(fuite)).erreurs.join("\n"), /clé secrète Supabase trouvé dans js\/a\.js/);

// Les autres pages de la racine sont contrôlées comme index.html : une feuille citée et absente est rouge.
const demande = { ...base, "demande.html": '<link href="css/contact.css?v=1"><script type="module" src="js/a.js?v=1"></script>',
  "404.html": '<a href="/">Ouvrir</a>' };
assert.deepEqual(controler(depot(demande), Object.keys(demande)).erreurs,
  ["demande.html cite css/contact.css, qui ne serait pas servi"]);
const demandeComplete = { ...demande, "css/contact.css": "" };
assert.deepEqual(controler(depot(demandeComplete), Object.keys(demandeComplete)).erreurs, []);

const sansIndex = { ...base }; delete sansIndex["index.html"];
assert.match(controler(depot(sansIndex), Object.keys(sansIndex)).erreurs.join("\n"), /indispensable absent : index\.html/);

// Le vrai dépôt : vert, et rien de ce qui doit rester privé.
const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const reel = controler(racine, fichiersSuivis(racine));
assert.deepEqual(reel.erreurs, [], reel.erreurs.join("\n"));
assert.ok(reel.servis.length > 600, `seulement ${reel.servis.length} fichiers servis`);
assert.ok(!reel.servis.some((p) => /^(docs|supabase|tests|outils|scripts|sources|deploiement|\.github)\//.test(p)));
assert.ok(!reel.servis.some((p) => /^(PROJECT_NOTES|README|DEV)\.md$|^LICENSE$/.test(p)));
// Toute page HTML suivie à la racine part en ligne, sauf les aperçus « _ » : une page oubliée par la
// liste blanche répondrait 404 sur le nouvel hébergement (demande.html, constat du 27/11/2026).
const pagesRacine = fichiersSuivis(racine).filter((p) => !p.includes("/") && p.endsWith(".html") && !p.startsWith("_"));
assert.ok(pagesRacine.includes("demande.html"));
for (const p of pagesRacine) assert.ok(reel.servis.includes(p), `${p} est suivie à la racine mais ne serait pas servie`);
for (const p of ["css/contact.css", "js/lien-demande.js", "js/lien-demande-rules.js"]) assert.ok(reel.servis.includes(p), p);

console.log("deployer : OK");

// Page de redirection de l'ancienne adresse : chemin, recherche et route conservés.
{
  const { pageRedirection } = await import("../outils/deployer/redirection.mjs");
  const page = pageRedirection("https://app.exemple.fr");
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  const suivre = (pathname, search = "", hash = "") => {
    let vers = null;
    new Function("location", script)({ pathname, search, hash, replace: (u) => { vers = u; } });
    return vers;
  };
  assert.equal(suivre("/ecsr-promo/"), "https://app.exemple.fr/");
  assert.equal(suivre("/ecsr-promo"), "https://app.exemple.fr/");
  assert.equal(suivre("/ecsr-promo/", "?token_hash=abc&type=recovery"), "https://app.exemple.fr/?token_hash=abc&type=recovery");
  assert.equal(suivre("/ecsr-promo/", "", "#/cours"), "https://app.exemple.fr/#/cours");
  assert.equal(suivre("/ecsr-promo/assets/referentiels/REAC_TP_ECSR_2021.pdf"), "https://app.exemple.fr/assets/referentiels/REAC_TP_ECSR_2021.pdf");
  assert.equal(suivre("/ecsr-promo/index.html", "", "#/informations-legales"), "https://app.exemple.fr/index.html#/informations-legales");
  assert.match(page, /href="https:\/\/app\.exemple\.fr\/"/);
  console.log("redirection : OK");
}
