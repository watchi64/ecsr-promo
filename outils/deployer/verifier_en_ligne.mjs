#!/usr/bin/env node
/*
 * Jalonya : application propriétaire.
 * © 2026 Timy Studio. Tous droits réservés. Voir LICENSE.
 *
 * Vérifie ce que sert vraiment une adresse en ligne, après une mise en ligne :
 *   - la racine et index.html répondent 200, en text/html ;
 *   - le jeton ?v= servi égale celui du index.html local (le commit déployé) ;
 *   - main.js et la feuille de style répondent 200 avec le bon type (un module JavaScript servi
 *     avec un mauvais type est refusé par le navigateur : écran blanc) ;
 *   - le manifeste, une icône et un PDF de référentiel répondent 200 ;
 *   - ce qui doit rester privé ne répond pas 200 (notes, docs, migrations, tests, outils).
 *
 *   node outils/deployer/verifier_en_ligne.mjs                 adresse de deploiement/site.json
 *   node outils/deployer/verifier_en_ligne.mjs https://x.fr/   adresse donnée
 *   option --essais N (défaut 10, une tentative toutes les 15 s tant que le jeton diffère)
 *
 * Code de sortie : 0 vert, 1 rouge. N'écrit rien, ne demande aucune clé.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jetonIndex } from "./preparer.mjs";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const PRIVES = [
  "PROJECT_NOTES.md", "README.md", "DEV.md", "LICENSE", "deploiement/site.json",
  "docs/direction-artistique.md", "outils/psql_prod.sh", "tests/adresse.test.mjs",
  "scripts/cache-bust.js", "sources/scenes.js", ".github/workflows/mise-en-ligne.yml",
];

export function typeAttendu(chemin) {
  if (/\.html$|\/$/.test(chemin)) return /^text\/html/;
  if (/\.js(\?|$)/.test(chemin)) return /^(text|application)\/(x-)?javascript/;
  if (/\.css(\?|$)/.test(chemin)) return /^text\/css/;
  if (/\.webmanifest$/.test(chemin)) return /^application\/(manifest\+)?json/;
  if (/\.png$/.test(chemin)) return /^image\/png/;
  if (/\.pdf$/.test(chemin)) return /^application\/pdf/;
  return /./;
}

async function obtenir(url) {
  // GET réel (Edge Services peut traiter HEAD autrement) et sans cache côté client.
  const r = await fetch(url, { headers: { "cache-control": "no-cache" }, redirect: "manual" });
  const corps = r.status === 200 ? await r.text() : "";
  return { statut: r.status, type: r.headers.get("content-type") || "", corps, cache: r.headers.get("x-cache") || "" };
}

const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function principal() {
  const args = process.argv.slice(2);
  const iEssais = args.indexOf("--essais");
  const essais = iEssais >= 0 ? Number(args[iEssais + 1]) : 10;
  let adresse = args.find((a) => /^https?:\/\//.test(a));
  if (!adresse) adresse = JSON.parse(fs.readFileSync(path.join(racine, "deploiement", "site.json"), "utf8")).adresse;
  if (!adresse) { console.error("[verifier] aucune adresse (deploiement/site.json vide et rien en argument)"); process.exit(1); }
  if (!adresse.endsWith("/")) adresse += "/";

  const attendu = jetonIndex(fs.readFileSync(path.join(racine, "index.html"), "utf8"));
  const erreurs = [];
  const ok = (m) => console.log("  OK   " + m);
  const ko = (m) => { console.log("  ROUGE " + m); erreurs.push(m); };

  console.log(`[verifier] ${adresse} : jeton attendu ${attendu}`);

  // 1. Le jeton servi, avec patience : Edge Services peut mettre quelques secondes à suivre la purge.
  let servi = null;
  for (let i = 1; i <= essais; i++) {
    const r = await obtenir(adresse + "?verif=" + Date.now());
    servi = r.statut === 200 ? jetonIndex(r.corps) : null;
    if (servi === attendu) break;
    console.log(`  … essai ${i}/${essais} : statut ${r.statut}, jeton servi ${servi}`);
    if (i < essais) await attendre(15000);
  }
  if (servi === attendu) ok(`jeton servi ${servi}`); else ko(`jeton servi ${servi}, attendu ${attendu}`);

  // 2. Ce qui doit répondre 200, avec le bon type.
  const publics = ["", "index.html", "manifest.webmanifest", `js/main.js?v=${attendu}`, `css/style.css?v=${attendu}`,
    "assets/logo/icon-192.png", "assets/referentiels/REAC_TP_ECSR_2021.pdf", "404.html"];
  for (const p of publics) {
    const r = await obtenir(adresse + p);
    const type = typeAttendu(p || "/");
    if (r.statut !== 200) ko(`/${p} : statut ${r.statut}`);
    else if (!type.test(r.type)) ko(`/${p} : type « ${r.type} »`);
    else ok(`/${p} : 200, ${r.type}${r.cache ? ", cache " + r.cache : ""}`);
  }

  // 3. Ce qui ne doit jamais être servi.
  for (const p of PRIVES) {
    const r = await obtenir(adresse + p);
    if (r.statut === 200) ko(`/${p} est servi (200) : il devrait rester privé`); else ok(`/${p} : ${r.statut}`);
  }

  // 4. Une adresse inconnue rend la page d'erreur, pas l'app ni une liste du bucket.
  const inconnue = await obtenir(adresse + "nexiste-pas-" + Date.now());
  if (inconnue.statut === 200) ko("une adresse inconnue répond 200");
  else ok(`adresse inconnue : ${inconnue.statut}`);

  console.log(erreurs.length ? `[verifier] ROUGE : ${erreurs.length} problème(s)` : "[verifier] VERT");
  process.exit(erreurs.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
