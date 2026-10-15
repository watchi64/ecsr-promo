// Ce que outils/captures.mjs sait faire sans Chrome ni serveur : lire ses arguments, lire la planche que Chrome a imprimée, dire
// ce qui ne va pas avec le serveur, nettoyer un profil, résumer une erreur. Séparé du script pour être testé sous Node
// (tests/captures-aides.test.mjs).
import { rmSync } from "node:fs";

export const USAGE = "node outils/captures.mjs --port <port> [--codes a,b] [--largeurs 343,680] [--instants 0.5,1.2] [--sortie captures]";
const OPTIONS = ["port", "codes", "largeurs", "instants", "sortie"];

/** Les arguments de la ligne de commande : { port, sortie, largeurs, instants, codes } (`codes` null : tout ce qui existe déjà),
 *  ou { erreur }. Tout ce qui est mal écrit est refusé, jamais ignoré : une option mal tapée ferait photographier « tout » sans
 *  prévenir. --port est obligatoire : un port par défaut serait partagé par tous les worktrees, et une capture prise sur le serveur
 *  d'une autre branche passerait pour celle de la sienne. */
export function lireArguments(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) return { erreur: `Argument inattendu « ${a} » : chaque option s'écrit « --nom valeur ».` };
    const nom = a.slice(2);
    if (!OPTIONS.includes(nom)) return { erreur: `Option inconnue « ${a} » (attendu : ${OPTIONS.map((o) => `--${o}`).join(", ")}).` };
    const valeur = argv[i + 1];
    if (valeur === undefined || valeur.startsWith("--")) return { erreur: `L'option « ${a} » attend une valeur.` };
    args[nom] = valeur;
    i++;
  }
  if (args.port === undefined) {
    return { erreur: "--port est obligatoire : le serveur est celui de ce worktree (python -m http.server <port> à la racine du dépôt) ; "
      + "un port par défaut, partagé par tous les worktrees, ferait photographier la branche d'un autre sans qu'on le voie." };
  }
  const port = Number(args.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { erreur: `--port « ${args.port} » : un numéro de port entre 1 et 65535.` };
  const liste = (valeur) => valeur.split(",").map((x) => x.trim()).filter(Boolean);
  const largeurs = args.largeurs === undefined ? [343, 680] : liste(args.largeurs).map(Number);
  if (!largeurs.length || largeurs.some((x) => !Number.isFinite(x) || x <= 0)) {
    return { erreur: `--largeurs « ${args.largeurs} » : des largeurs en pixels, supérieures à 0 (343,680).` };
  }
  const instants = args.instants === undefined ? [] : liste(args.instants).map(Number);
  if (instants.some((x) => !Number.isFinite(x) || x < 0)) return { erreur: `--instants « ${args.instants} » : des instants en secondes, à partir de 0 (0.5,1.2).` };
  const codes = args.codes === undefined ? null : liste(args.codes);
  if (codes !== null && !codes.length) return { erreur: `--codes « ${args.codes} » : au moins un code.` };
  return { port, sortie: args.sortie || "captures", largeurs, instants, codes };
}

/** Ce que dit la planche (outils/planche-dessins.html) une fois construite, lu dans le DOM que Chrome a imprimé (--dump-dom) : le
 *  titre « pret » et les attributs data-* du corps. `reseau` : le code d'erreur de la page que Chrome met à la place d'une page qu'il
 *  n'a pas pu charger (ERR_CONNECTION_REFUSED…) quand la planche n'est pas prête ; null si elle l'est (une case rouge qui cite un tel
 *  code est une planche qui a planté en route, pas un serveur absent). */
export function lireEtatPlanche(html) {
  const pret = /<title>pret<\/title>/.test(html);
  const corps = (html.match(/<body[^>]*>/) || [""])[0];
  const lire = (nom) => (corps.match(new RegExp(`data-${nom}="([^"]*)"`)) || [null, ""])[1];
  const liste = (nom) => lire(nom).split(",").filter(Boolean);
  return {
    pret, reseau: pret ? null : (html.match(/\bERR_[A-Z_]+\b/) || [null])[0],
    hauteur: Number(lire("hauteur")), rendus: Number(lire("rendus")), erreurs: Number(lire("erreurs")),
    absents: liste("absents"), mesures: liste("mesures").map(Number), disponibles: liste("disponibles"),
  };
}

/** Le premier contact avec le serveur : null quand la planche répond, sinon la phrase qui dit quoi faire. `reponse` : { statut } (le
 *  serveur a répondu) ou { erreur } (il n'a pas répondu). « Injoignable » et « planche introuvable » ne se soignent pas pareil : le
 *  premier veut un serveur lancé, le second un serveur lancé dans le bon dossier. */
export function messageServeur(port, reponse) {
  if (reponse.erreur) return `serveur injoignable sur le port ${port} (${reponse.erreur}) : lancer « python -m http.server ${port} » à la racine du dépôt.`;
  if (reponse.statut === 404) return `la planche est introuvable (HTTP 404) sur le port ${port} : le serveur sert-il la racine du dépôt (outils/planche-dessins.html) ?`;
  if (reponse.statut >= 200 && reponse.statut < 400) return null;
  return `le serveur du port ${port} répond HTTP ${reponse.statut} pour la planche.`;
}

const premiereLigne = (erreur) => String(erreur && erreur.message ? erreur.message : erreur).split("\n")[0];

/** Une erreur en une ligne : Chrome introuvable dit où on l'a cherché et comment le donner, le reste en première ligne du message. */
export function resumerErreur(erreur, chrome) {
  if (erreur && erreur.code === "ENOENT") return `Chrome introuvable (${chrome}) : renseigner la variable d'environnement CHROME.`;
  return premiereLigne(erreur);
}

/** Supprime le profil de Chrome d'une passe, au mieux : Windows garde parfois un verrou un instant après la sortie de Chrome. Un
 *  profil qui reste est dit (`avertir`), jamais une exception : il ne doit pas faire échouer la capture. Rend true si le profil est
 *  parti. `supprimer` et `avertir` se remplacent pour les tests. */
export function nettoyerProfil(chemin, {
  supprimer = (c) => rmSync(c, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
  avertir = console.warn,
} = {}) {
  try { supprimer(chemin); return true; } catch (erreur) {
    avertir(`profil de Chrome non supprimé (${chemin}) : ${premiereLigne(erreur)}`);
    return false;
  }
}
