// Journal des dernières erreurs de la page (spec « Signaler un problème », § 6) : joint d'office à un
// signalement, pour que l'éditeur voie ce qui a cassé sans le demander. Il capte les erreurs non
// rattrapées, les promesses rejetées et les messages d'erreur que l'app écrit dans la console (elle y
// écrit ses échecs de chargement). Il vit en mémoire, ne part qu'avec un signalement et repart à zéro à
// chaque ouverture de l'app. Importé en premier par js/main.js, il s'installe à l'import.

import { entreeErreur, ajouterErreur } from "./signalement-rules.js?v=20261028a";

let journal = [];

// Le journal ne doit jamais produire une erreur de plus : tout ce qu'il fait est enveloppé.
function noter(type, message, source) {
  try {
    journal = ajouterErreur(journal, entreeErreur({ type, message, source, quand: new Date() }));
  } catch (e) { /* journal indisponible : l'erreur d'origine suit son cours */ }
}

// « planning.js:12 » : le nom du fichier, sans dossier ni jeton de version, et la ligne.
function fichierEtLigne(url, ligne) {
  const nom = String(url || "").split(/[?#]/)[0].split("/").pop();
  if (!nom) return "";
  return ligne ? `${nom}:${ligne}` : nom;
}

function texteDe(valeur) {
  if (valeur instanceof Error) return valeur.message;
  if (typeof valeur === "string") return valeur;
  try { return JSON.stringify(valeur); } catch (e) { return String(valeur); }
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("error", (e) => {
    noter("erreur", e.message || texteDe(e.error) || "Erreur", fichierEtLigne(e.filename, e.lineno));
  });
  window.addEventListener("unhandledrejection", (e) => noter("promesse", texteDe(e.reason), ""));
}

const consoleErreur = console.error;
console.error = function (...args) {
  try { noter("console", args.map(texteDe).join(" "), ""); } catch (e) { /* voir noter */ }
  return consoleErreur.apply(this, args);
};

// Les dernières erreurs, en copie (la fenêtre de signalement les joint au contexte).
export function dernieresErreurs() {
  return journal.map((e) => ({ ...e }));
}
