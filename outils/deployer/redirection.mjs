#!/usr/bin/env node
/*
 * Jalonya : application propriétaire.
 * © 2026 Timy Studio. Tous droits réservés. Voir LICENSE.
 *
 * Fabrique les deux pages du petit dépôt public de redirection (index.html et 404.html, même
 * contenu), servi par GitHub Pages à l'ANCIENNE adresse watchi64.github.io/ecsr-promo/ une fois
 * le dépôt de l'app renommé et passé en privé. Toute ancienne adresse arrive sur la nouvelle avec
 * son chemin, sa recherche et sa route : un lien de mot de passe oublié (?token_hash=…), un lien
 * profond (#/cours) ou un PDF (assets/referentiels/…) continuent de marcher.
 *
 *   node outils/deployer/redirection.mjs --sortie <dossier>     adresse lue dans deploiement/site.json
 *   node outils/deployer/redirection.mjs --sortie <dossier> https://app.exemple.fr/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function pageRedirection(adresse, ancienChemin = "/ecsr-promo") {
  const cible = adresse.endsWith("/") ? adresse : adresse + "/";
  const echappe = cible.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>L'application a changé d'adresse</title>
<script>
  var NOUVELLE = ${JSON.stringify(cible)};
  var reste = location.pathname.replace(/^${ancienChemin.replace(/\//g, "\\/")}\\/?/, "");
  location.replace(NOUVELLE + reste + location.search + location.hash);
</script>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;box-sizing:border-box}</style>
</head>
<body>
<p>L'application a changé d'adresse : <a href="${echappe}">ouvrir la nouvelle</a>.</p>
</body>
</html>
`;
}

function principal() {
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const args = process.argv.slice(2);
  const i = args.indexOf("--sortie");
  if (i < 0 || !args[i + 1]) { console.error("Usage : node outils/deployer/redirection.mjs --sortie <dossier> [adresse]"); process.exit(2); }
  const adresse = args.find((a) => /^https:\/\//.test(a))
    || JSON.parse(fs.readFileSync(path.join(racine, "deploiement", "site.json"), "utf8")).adresse;
  if (!/^https:\/\/[^/]+/.test(adresse || "")) { console.error("[redirection] adresse absente ou invalide : " + adresse); process.exit(1); }
  const dossier = path.resolve(args[i + 1]);
  fs.mkdirSync(dossier, { recursive: true });
  const page = pageRedirection(adresse);
  for (const f of ["index.html", "404.html"]) fs.writeFileSync(path.join(dossier, f), page);
  console.log(`[redirection] index.html et 404.html vers ${adresse} dans ${dossier}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
