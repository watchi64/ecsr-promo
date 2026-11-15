// demande.html est tamponnée par scripts/cache-bust.js comme index.html. Le test travaille sur une COPIE dans un dossier
// temporaire : le script calcule sa racine depuis son emplacement, il ne touche jamais le dépôt.
// Lancer : node tests/cache-bust-demande.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const depot = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

test("demande.html porte le token sur ses liens css/ et js/", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cache-bust-demande-"));
  try {
    fs.mkdirSync(path.join(tmp, "scripts"));
    fs.copyFileSync(path.join(depot, "scripts", "cache-bust.js"), path.join(tmp, "scripts", "cache-bust.js"));
    fs.copyFileSync(path.join(depot, "index.html"), path.join(tmp, "index.html"));
    fs.copyFileSync(path.join(depot, "demande.html"), path.join(tmp, "demande.html"));
    fs.cpSync(path.join(depot, "js"), path.join(tmp, "js"), { recursive: true });

    execFileSync(process.execPath, [path.join(tmp, "scripts", "cache-bust.js"), "20991231a"], { cwd: tmp, stdio: "pipe" });

    const page = fs.readFileSync(path.join(tmp, "demande.html"), "utf8");
    const liens = [...page.matchAll(/(?:src|href)="((?:css|js)\/[^"?]+\.(?:css|js))(\?v=[^"]*)?"/g)];
    assert.ok(liens.length >= 4, "css/fonts.css, css/style.css, css/contact.css et js/lien-demande.js");
    for (const [, chemin, jeton] of liens) assert.equal(jeton, "?v=20991231a", chemin);
    assert.ok(page.includes("js/lien-demande.js?v=20991231a"));
    // Le dépôt n'a pas bougé : la page d'origine n'a pas reçu le token imposé.
    assert.ok(!fs.readFileSync(path.join(depot, "demande.html"), "utf8").includes("20991231a"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
