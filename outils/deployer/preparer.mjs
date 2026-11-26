#!/usr/bin/env node
/*
 * Jalonya : application propriétaire.
 * © 2026 Timy Studio. Tous droits réservés. Voir LICENSE.
 *
 * Prépare la mise en ligne : choisit, parmi les fichiers suivis par git, ceux que le navigateur
 * charge vraiment, et rien d'autre. docs/, supabase/, tests/, outils/, scripts/, les notes et le
 * banc d'essai ne quittent jamais le dépôt.
 *
 *   node outils/deployer/preparer.mjs --liste           à blanc : compte, taille, répartition
 *   node outils/deployer/preparer.mjs --sortie _site    copie les fichiers servis dans _site/
 *
 * Avant de rendre la main, quatre contrôles (le script s'arrête au premier rouge) :
 *   1. aucun fichier hors de la liste blanche (par construction, revérifié) ;
 *   2. tout ce que index.html et le manifeste citent est bien servi ;
 *   3. tout import relatif d'un module JavaScript servi vise un fichier servi ;
 *   4. aucun motif de secret (clé secrète Supabase, jeton JWT, clé privée) dans un fichier servi.
 * Utilisé par .github/workflows/mise-en-ligne.yml. Tests : tests/deployer.test.mjs.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Ce que le navigateur reçoit : la page, son manifeste, la page d'erreur, et quatre dossiers.
export const FICHIERS_RACINE = ["index.html", "manifest.webmanifest", "404.html"];
export const DOSSIERS_SERVIS = ["js/", "css/", "assets/", "vendor/"];

// Un segment qui commence par « _ » (banc d'essai, aperçus) ou « . » ne part jamais.
export function estServi(chemin) {
  if (chemin.split("/").some((s) => s.startsWith("_") || s.startsWith("."))) return false;
  if (chemin.endsWith(".DS_Store")) return false;
  return FICHIERS_RACINE.includes(chemin) || DOSSIERS_SERVIS.some((d) => chemin.startsWith(d));
}

export function fichiersSuivis(racine) {
  const sortie = execFileSync("git", ["ls-files", "-z"], { cwd: racine, encoding: "utf8", maxBuffer: 64 << 20 });
  return sortie.split("\0").filter(Boolean);
}

// Le jeton de cache ?v= posé sur main.js dans index.html (scripts/cache-bust.js).
export function jetonIndex(html) {
  const m = /main\.js\?v=([0-9a-z]+)/.exec(html);
  return m ? m[1] : null;
}

// Chemins locaux cités par index.html (src, href) et par le manifeste (icônes, start_url exclue).
export function citationsIndex(html) {
  const out = [];
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"'#]+)["']/g)) {
    const url = m[1].split("?")[0];
    if (/^(https?:|data:|mailto:|tel:|\/\/)/.test(url) || url === "" || url === "./") continue;
    out.push(url.replace(/^\.\//, ""));
  }
  return out;
}

export function citationsManifeste(json) {
  const m = JSON.parse(json);
  return (m.icons || []).map((i) => String(i.src).split("?")[0].replace(/^\.\//, ""));
}

// Imports relatifs littéraux d'un module (statiques, dynamiques, effet de bord), sans le ?v=.
export function importsRelatifs(code) {
  const out = [];
  const motifs = [
    /\bfrom\s*["'](\.\.?\/[^"'?\n]+)(?:\?[^"'\n]*)?["']/g,
    /\bimport\s*\(\s*["'](\.\.?\/[^"'?\n]+)(?:\?[^"'\n]*)?["']\s*\)/g,
    /\bimport\s*["'](\.\.?\/[^"'?\n]+)(?:\?[^"'\n]*)?["']/g,
  ];
  for (const re of motifs) for (const m of code.matchAll(re)) out.push(m[1]);
  return out;
}

export const MOTIFS_SECRETS = [
  { nom: "clé secrète Supabase", re: /sb_secret_[A-Za-z0-9_-]{8,}/ },
  { nom: "jeton JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { nom: "clé privée", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nom: "clé d'API Scaleway", re: /\bSCW[A-Z0-9]{17}\b/ },
];

// Rend { servis, erreurs } ; erreurs vide = vert.
export function controler(racine, suivis) {
  const servis = suivis.filter(estServi).sort();
  const ensemble = new Set(servis);
  const erreurs = [];
  const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8");

  for (const p of servis) if (!estServi(p)) erreurs.push(`hors liste blanche : ${p}`);
  for (const f of ["index.html", "manifest.webmanifest"]) if (!ensemble.has(f)) erreurs.push(`fichier indispensable absent : ${f}`);
  if (erreurs.length) return { servis, erreurs };

  for (const c of citationsIndex(lire("index.html"))) if (!ensemble.has(c)) erreurs.push(`index.html cite ${c}, qui ne serait pas servi`);
  for (const c of citationsManifeste(lire("manifest.webmanifest"))) if (!ensemble.has(c)) erreurs.push(`le manifeste cite ${c}, qui ne serait pas servi`);

  for (const p of servis.filter((x) => x.endsWith(".js"))) {
    const code = lire(p);
    for (const imp of importsRelatifs(code)) {
      const cible = path.posix.normalize(path.posix.join(path.posix.dirname(p), imp));
      if (!ensemble.has(cible)) erreurs.push(`${p} importe ${imp}, qui ne serait pas servi`);
    }
  }

  for (const p of servis) {
    if (!/\.(js|css|html|json|webmanifest|svg|txt|md)$/.test(p)) continue;
    const texte = lire(p);
    for (const { nom, re } of MOTIFS_SECRETS) if (re.test(texte)) erreurs.push(`${nom} trouvé dans ${p}`);
  }
  return { servis, erreurs };
}

function principal() {
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const args = process.argv.slice(2);
  const iSortie = args.indexOf("--sortie");
  const sortie = iSortie >= 0 ? args[iSortie + 1] : null;
  if (!sortie && !args.includes("--liste")) {
    console.error("Usage : node outils/deployer/preparer.mjs --liste | --sortie <dossier>");
    process.exit(2);
  }

  const { servis, erreurs } = controler(racine, fichiersSuivis(racine));
  if (erreurs.length) {
    console.error(`[preparer] ROUGE : ${erreurs.length} problème(s)`);
    for (const e of erreurs.slice(0, 50)) console.error("  - " + e);
    process.exit(1);
  }

  let octets = 0;
  const parDossier = new Map();
  for (const p of servis) {
    octets += fs.statSync(path.join(racine, p)).size;
    const tete = p.includes("/") ? p.split("/")[0] + "/" : p;
    parDossier.set(tete, (parDossier.get(tete) || 0) + 1);
  }
  const jeton = jetonIndex(fs.readFileSync(path.join(racine, "index.html"), "utf8"));
  console.log(`[preparer] VERT : ${servis.length} fichiers, ${(octets / 1048576).toFixed(1)} Mo, jeton ${jeton}`);
  console.log("  " + [...parDossier].map(([d, n]) => `${d} ${n}`).join(", "));

  if (sortie) {
    const cible = path.resolve(racine, sortie);
    fs.rmSync(cible, { recursive: true, force: true });
    for (const p of servis) {
      const dest = path.join(cible, p);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(racine, p), dest);
    }
    console.log(`[preparer] copiés dans ${path.relative(racine, cible) || cible}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
