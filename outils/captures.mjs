// Captures PNG de la planche des dessins, par Chrome sans interface : une par dessin, par étape de chaque animation
// et par largeur. Il faut un serveur statique à la racine du dépôt : python -m http.server <port>.
// node outils/captures.mjs --port 8762 [--codes a,b] [--largeurs 343,680] [--instants 0.5,1.2] [--sortie captures]
//
// --codes     codes du catalogue, « kit » (les pièces du kit) ou « kit-... » (une pièce) ; sans --codes, le kit puis tous les
//             dessins et gestes déjà écrits, et la scène « sortie-portiere » si elle existe (les autres scènes de route
//             s'obtiennent en les nommant). Un code qui n'existe pas encore est signalé et sauté.
// --largeurs  largeurs de colonne en pixels (343 : un iPhone ; 680 : un ordinateur), 343 et 680 par défaut.
// --instants  pour une animation, des images prises à ces instants (en secondes), en plus d'une image par étape.
//
// Fichiers : <code>-<largeur>.png (un dessin), <code>-e<N>-<largeur>.png (étape N, à partir de 1), <code>-t<instant>-<largeur>.png,
// <code>-reduit-<largeur>.png (animations réduites, étape 1).
//
// Chaque image se prend en deux passes de Chrome : la première lit la planche (outils/planche-dessins.html) une fois construite
// (hauteur de la page, largeur réelle des dessins, erreurs), la seconde la photographie dans une fenêtre de cette hauteur, donc
// sans coupe ni vide. Chaque passe a son profil de Chrome neuf, jeté ensuite : le cache HTTP de Chrome rejoue sinon d'anciens
// modules. Chrome reçoit toujours une adresse (sans adresse, il reste ouvert). Un Chrome sans interface ne met jamais une page en
// forme à moins de 492 px environ : la fenêtre fait au moins 520 px, et la planche fixe la colonne en pixels (paramètre largeur).
import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CATALOGUE } from "../js/catalogue-blocs.js";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
const liste = (valeur, defaut) => (valeur === undefined ? defaut : String(valeur).split(",").map((x) => x.trim()).filter(Boolean));
const port = args.port || "8762";
const sortie = args.sortie || "captures";
const largeurs = liste(args.largeurs, ["343", "680"]).map(Number);
const instants = liste(args.instants, []).map(Number);
if ([...largeurs, ...instants].some((x) => !Number.isFinite(x)) || largeurs.some((x) => x <= 0)) {
  console.error("Largeurs et instants : des nombres (largeurs > 0).");
  process.exit(2);
}
const MARGE_FENETRE = 40, FENETRE_MIN = 520, SURPLUS_HAUTEUR = 8, ECART_LARGEUR_PX = 0.5;
const fenetre = (largeur) => Math.max(largeur + MARGE_FENETRE, FENETRE_MIN);

function chrome(argsChrome) {
  const profil = mkdtempSync(join(tmpdir(), "planche-chrome-"));
  try {
    return execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profil}`, ...argsChrome], { encoding: "utf8", maxBuffer: 1 << 28, timeout: 120000, stdio: ["ignore", "pipe", "ignore"] });
  } finally {
    // Windows garde parfois un verrou un instant après la sortie de Chrome : un profil qui reste ne fait pas échouer la capture.
    try { rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* nettoyé plus tard avec le dossier temporaire */ }
  }
}
const adresse = (requete) => `http://localhost:${port}/outils/planche-dessins.html?${new URLSearchParams(requete)}`;

// Première passe : la planche construite, lue par ses attributs data-* (voir outils/planche-dessins.html).
function sonder(requete, largeur) {
  const html = chrome(["--force-device-scale-factor=1", `--window-size=${fenetre(largeur)},1000`, "--virtual-time-budget=8000",
    "--dump-dom", adresse(requete)]);
  if (!/<title>pret<\/title>/.test(html)) {
    throw new Error(`la planche n'a pas fini de se construire (serveur lancé sur le port ${port} ?) : ${adresse(requete)}`);
  }
  const corps = (html.match(/<body[^>]*>/) || [""])[0];
  const lire = (nom) => (corps.match(new RegExp(`data-${nom}="([^"]*)"`)) || [, ""])[1];
  const virgules = (nom) => lire(nom).split(",").filter(Boolean);
  return { hauteur: Number(lire("hauteur")), rendus: Number(lire("rendus")), erreurs: Number(lire("erreurs")),
    absents: virgules("absents"), mesures: virgules("mesures").map(Number), disponibles: virgules("disponibles") };
}

function dimensionsPng(fichier) {
  const tete = Buffer.alloc(24), fd = openSync(fichier, "r");
  try { readSync(fd, tete, 0, 24, 0); } finally { closeSync(fd); }
  return `${tete.readUInt32BE(16)}x${tete.readUInt32BE(20)} px`;
}

let problemes = 0;
const sautes = new Set();
function capturer(requete, fichier, largeur) {
  if (sautes.has(requete.code)) return;
  const m = sonder(requete, largeur);
  if (m.rendus === 0 && m.erreurs === 0) {
    sautes.add(requete.code);
    console.log(`sauté, pas encore disponible : ${requete.code}${m.absents.length ? ` (${m.absents.join(", ")})` : ""}`);
    return;
  }
  // Une erreur est photographiée aussi : la case rouge de la planche dit laquelle.
  if (m.erreurs) { problemes++; console.warn(`ERREUR dans la planche (${m.erreurs}) : ${adresse(requete)}`); }
  for (const mesure of m.mesures) {
    if (Math.abs(mesure - largeur) > ECART_LARGEUR_PX) {
      problemes++;
      console.warn(`LARGEUR : un dessin mesure ${mesure} px au lieu de ${largeur} px : ${adresse(requete)}`);
    }
  }
  chrome(["--force-device-scale-factor=2", `--window-size=${fenetre(largeur)},${m.hauteur + SURPLUS_HAUTEUR}`, "--virtual-time-budget=8000",
    `--screenshot=${resolve(fichier)}`, adresse(requete)]);
  console.log(`${fichier} (${dimensionsPng(fichier)}, ${m.mesures.length ? `colonne mesurée ${m.mesures.join(" / ")} px` : "aucun dessin"})`);
}

// Une image qui échoue (Chrome qui plante, serveur absent) est comptée et signalée, sans arrêter les suivantes.
function essayer(requete, fichier, largeur) {
  try { capturer(requete, fichier, largeur); } catch (erreur) {
    problemes++;
    console.warn(`ECHEC ${fichier} : ${String(erreur.message).split("\n")[0]}`);
  }
}

mkdirSync(sortie, { recursive: true });
let codes = liste(args.codes, null);
if (!codes) {
  const dispo = new Set(sonder({ liste: 1 }, 343).disponibles);
  codes = ["kit", ...Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module !== "route" || c === "sortie-portiere")].filter((c) => dispo.has(c));
  console.log(`${codes.length} code(s) disponible(s) : ${codes.join(", ")}`);
}
for (const code of codes) {
  const entree = Object.hasOwn(CATALOGUE, code) ? CATALOGUE[code] : null;
  for (const largeur of largeurs) {
    if (!entree || entree.bloc === "dessin") { essayer({ code, largeur }, `${sortie}/${code}-${largeur}.png`, largeur); continue; }
    entree.etapesModele.forEach((_, i) => essayer({ code, largeur, etape: i }, `${sortie}/${code}-e${i + 1}-${largeur}.png`, largeur));
    for (const t of instants) essayer({ code, largeur, t }, `${sortie}/${code}-t${t}-${largeur}.png`, largeur);
    essayer({ code, largeur, etape: 0, reduit: 1 }, `${sortie}/${code}-reduit-${largeur}.png`, largeur);
  }
}
if (problemes) { console.error(`${problemes} problème(s) : voir les lignes ECHEC, ERREUR et LARGEUR ci-dessus.`); process.exitCode = 1; }
