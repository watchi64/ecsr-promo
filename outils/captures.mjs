// Captures PNG de la planche des dessins, par Chrome sans interface : une par dessin, par étape de chaque animation
// et par largeur. Il faut un serveur statique à la racine du dépôt : python -m http.server <port>.
// node outils/captures.mjs --port <port> [--codes a,b] [--largeurs 343,680] [--instants 0.5,1.2] [--sortie captures]
//
// --port      obligatoire : le port du serveur de ce worktree. Pas de port par défaut : il serait partagé par tous les worktrees, et
//             une capture prise sur le serveur d'une autre branche passerait pour celle de la sienne.
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
//
// Ce qui ne va pas est dit en une ligne, sans trace de pile, et la sortie vaut 1 (2 pour un mauvais argument) :
//   ECHEC serveur injoignable / planche introuvable : le serveur n'est pas lancé, ou pas dans le bon dossier (avant tout Chrome) ;
//   ECHEC <fichier> : une image n'a pas pu se prendre (Chrome en échec, planche qui ne finit pas) ; les suivantes sont prises ;
//   ERREUR dans la planche : la planche a répondu, mais elle a planté ou un code est en panne ; l'image montre la case rouge ;
//   LARGEUR : un dessin ne mesure pas la largeur demandée.
// Les règles qui ne lancent rien (arguments, lecture de la planche, diagnostic du serveur) sont dans outils/captures-aides.mjs.
import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import { USAGE, lireArguments, lireEtatPlanche, messageServeur, nettoyerProfil, resumerErreur } from "./captures-aides.mjs";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MARGE_FENETRE = 40, FENETRE_MIN = 520, SURPLUS_HAUTEUR = 8, ECART_LARGEUR_PX = 0.5, DELAI_SERVEUR_MS = 5000;
const fenetre = (largeur) => Math.max(largeur + MARGE_FENETRE, FENETRE_MIN);

let port = 0;              // fixé une fois les arguments lus
let problemes = 0;
const sautes = new Set();

function chrome(argsChrome) {
  const profil = mkdtempSync(join(tmpdir(), "planche-chrome-"));
  try {
    return execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profil}`, ...argsChrome], { encoding: "utf8", maxBuffer: 1 << 28, timeout: 120000, stdio: ["ignore", "pipe", "ignore"] });
  } finally {
    nettoyerProfil(profil);   // au mieux, et dit s'il échoue : un profil qui reste ne fait pas échouer la capture
  }
}
const page = () => `http://localhost:${port}/outils/planche-dessins.html`;
const adresse = (requete) => `${page()}?${new URLSearchParams(requete)}`;

// Une étape qui échoue est comptée et dite en une ligne, sans trace de pile ; elle rend null.
function proteger(libelle, fonction) {
  try { return fonction(); } catch (erreur) {
    problemes++;
    console.warn(`ECHEC ${libelle} : ${resumerErreur(erreur, CHROME)}`);
    return null;
  }
}

// Le premier contact : le serveur répond-il, et a-t-il la planche ? Avant tout Chrome, pour que « le serveur n'est pas là » ne se
// confonde jamais avec « la planche a planté ».
async function sonderServeur() {
  try {
    const reponse = await fetch(page(), { method: "HEAD", signal: AbortSignal.timeout(DELAI_SERVEUR_MS) });
    return { statut: reponse.status };
  } catch (erreur) {
    const cause = erreur.cause;
    return { erreur: String((cause && (cause.code || (cause.errors && cause.errors[0] && cause.errors[0].code))) || erreur.name || erreur.message) };
  }
}

// Première passe : la planche construite, lue par ses attributs data-* (voir outils/planche-dessins.html).
function sonder(requete, largeur) {
  const html = chrome(["--force-device-scale-factor=1", `--window-size=${fenetre(largeur)},1000`, "--virtual-time-budget=8000",
    "--dump-dom", adresse(requete)]);
  const etat = lireEtatPlanche(html);
  if (!etat.pret) {
    throw new Error(etat.reseau
      ? `le serveur a cessé de répondre (${etat.reseau}) : ${adresse(requete)}`
      : `la planche n'a pas fini de se construire (un module qui ne répond pas ? ouvrir l'adresse dans Chrome et lire sa console) : ${adresse(requete)}`);
  }
  return etat;
}

function dimensionsPng(fichier) {
  const tete = Buffer.alloc(24), fd = openSync(fichier, "r");
  try { readSync(fd, tete, 0, 24, 0); } finally { closeSync(fd); }
  return `${tete.readUInt32BE(16)}x${tete.readUInt32BE(20)} px`;
}

function capturer(requete, fichier, largeur) {
  if (sautes.has(requete.code)) return;
  const m = sonder(requete, largeur);
  if (m.rendus === 0 && m.erreurs === 0) {
    sautes.add(requete.code);
    console.log(`sauté, pas encore disponible : ${requete.code}${m.absents.length ? ` (${m.absents.join(", ")})` : ""}`);
    return;
  }
  // Une erreur est photographiée aussi : la case rouge de la planche dit laquelle.
  if (m.erreurs) { problemes++; console.warn(`ERREUR dans la planche (${m.erreurs}) : la case rouge de l'image dit laquelle : ${adresse(requete)}`); }
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

async function principal({ sortie, largeurs, instants, codes: demandes }) {
  const probleme = messageServeur(port, await sonderServeur());
  if (probleme) { console.error(`ECHEC ${probleme}`); return 1; }
  mkdirSync(sortie, { recursive: true });
  let codes = demandes;
  if (!codes) {
    const etat = proteger("liste des codes disponibles", () => sonder({ liste: 1 }, 343));
    if (!etat) return 1;
    if (etat.erreurs) {
      problemes++;
      console.warn(`ERREUR dans la planche (liste des codes) : ${etat.erreurs} code(s) en panne, absents de la liste ; les nommer avec --codes montre la case rouge.`);
    }
    const dispo = new Set(etat.disponibles);
    codes = ["kit", ...Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module !== "route" || c === "sortie-portiere")].filter((c) => dispo.has(c));
    console.log(`${codes.length} code(s) disponible(s) : ${codes.join(", ")}`);
  }
  const essayer = (requete, fichier, largeur) => proteger(fichier, () => capturer(requete, fichier, largeur));
  for (const code of codes) {
    const entree = Object.hasOwn(CATALOGUE, code) ? CATALOGUE[code] : null;
    for (const largeur of largeurs) {
      if (!entree || entree.bloc === "dessin") { essayer({ code, largeur }, `${sortie}/${code}-${largeur}.png`, largeur); continue; }
      entree.etapesModele.forEach((_, i) => essayer({ code, largeur, etape: i }, `${sortie}/${code}-e${i + 1}-${largeur}.png`, largeur));
      for (const t of instants) essayer({ code, largeur, t }, `${sortie}/${code}-t${t}-${largeur}.png`, largeur);
      essayer({ code, largeur, etape: 0, reduit: 1 }, `${sortie}/${code}-reduit-${largeur}.png`, largeur);
    }
  }
  if (problemes) { console.error(`${problemes} problème(s) : voir les lignes ECHEC, ERREUR et LARGEUR ci-dessus.`); return 1; }
  return 0;
}

const lecture = lireArguments(process.argv.slice(2));
if (lecture.erreur) {
  console.error(`${lecture.erreur}\nUsage : ${USAGE}`);
  process.exitCode = 2;
} else {
  port = lecture.port;
  process.exitCode = await principal(lecture);
}
