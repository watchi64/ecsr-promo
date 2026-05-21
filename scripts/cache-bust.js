#!/usr/bin/env node
/*
 * cache-bust.js — Source unique de vérité pour le cache-busting JS/CSS.
 *
 * Pose un même token ?v=AAAAMMJJx :
 *   - sur index.html        (lien CSS + script d'entrée main.js)
 *   - sur tous les imports relatifs des fichiers js/ ** / *.js
 *
 * Le token est UNIFORME sur tout le projet, posé en un seul passage. C'est
 * indispensable : un module importé sous deux URLs différentes (?v=i et ?v=j)
 * serait chargé deux fois par le navigateur — donc deux instances, état dupliqué
 * (client Supabase en double, Sets partagés divergents, etc.).
 *
 * Les URLs externes (https://esm.sh/...) ne commencent pas par un point :
 * elles ne matchent aucun pattern et restent intactes.
 *
 * Usage :
 *   node scripts/cache-bust.js              token auto (date du jour + lettre)
 *   node scripts/cache-bust.js 20260521b    token imposé
 *   node scripts/cache-bust.js --staged     + git add des fichiers modifiés (hook)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const JS_DIR = path.join(ROOT, "js");

const args = process.argv.slice(2);
const staged = args.includes("--staged");
const override = args.find((a) => /^\d{8}[a-z]+$/.test(a)) || null;

// Imports relatifs uniquement (./ ou ../), spécifier finissant par .js.
const JS_PATTERNS = [
  /(\bfrom\s*["'])(\.\.?\/[^"'?\n]*?\.js)(\?v=[^"'\n]*)?(["'])/g,        // import / export ... from
  /(\bimport\s*\(\s*["'])(\.\.?\/[^"'?\n]*?\.js)(\?v=[^"'\n]*)?(["'])/g, // import() dynamique
  /(\bimport\s*["'])(\.\.?\/[^"'?\n]*?\.js)(\?v=[^"'\n]*)?(["'])/g,      // import "..." (effet de bord)
];

// index.html : uniquement les assets locaux sous js/ et css/.
const HTML_PATTERN =
  /((?:src|href)\s*=\s*["'])((?:js|css)\/[^"'?\n]*?\.(?:js|css))(\?v=[^"'\n]*)?(["'])/g;

function nextLetter(suffix) {
  const last = suffix[suffix.length - 1];
  if (last < "z") {
    return suffix.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
  }
  return suffix + "a";
}

// Le plus "récent" : suffixe plus long gagne, sinon ordre lexical.
function laterSuffix(a, b) {
  if (a.length !== b.length) return a.length > b.length ? a : b;
  return a > b ? a : b;
}

function computeToken(indexHtml) {
  if (override) return override;
  const d = new Date();
  const date =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  let best = null;
  for (const m of indexHtml.matchAll(/\?v=(\d{8})([a-z]+)/g)) {
    if (m[1] === date) best = best === null ? m[2] : laterSuffix(best, m[2]);
  }
  return date + (best === null ? "a" : nextLetter(best));
}

function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsFiles(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function stamp(content, patterns, token) {
  let count = 0;
  for (const rx of patterns) {
    content = content.replace(rx, (_m, pre, spec, _old, post) => {
      count++;
      return pre + spec + "?v=" + token + post;
    });
  }
  return { content, count };
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

// --- Exécution --------------------------------------------------------------

const indexBefore = fs.readFileSync(INDEX, "utf8");
const token = computeToken(indexBefore);
console.log("cache-bust: token " + token);

const changed = [];

const html = stamp(indexBefore, [HTML_PATTERN], token);
if (html.content !== indexBefore) {
  fs.writeFileSync(INDEX, html.content);
  changed.push(INDEX);
  console.log("  index.html  (" + html.count + " refs)");
}

for (const file of collectJsFiles(JS_DIR)) {
  const before = fs.readFileSync(file, "utf8");
  const { content, count } = stamp(before, JS_PATTERNS, token);
  if (content !== before) {
    fs.writeFileSync(file, content);
    changed.push(file);
    console.log("  " + rel(file) + "  (" + count + " imports)");
  }
}

console.log(changed.length + " fichier(s) mis a jour.");

if (staged && changed.length > 0) {
  const list = changed.map((f) => JSON.stringify(rel(f))).join(" ");
  execSync("git add -- " + list, { cwd: ROOT, stdio: "inherit" });
  console.log("  git add: " + changed.length + " fichier(s) re-stage(s).");
}
