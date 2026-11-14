// Saisie des résultats du jury du titre (fenêtre de la page Indicateurs, js/views/centre.js) : règles pures, sans DOM ni base,
// testées en node (tests/jury-rules.test.mjs). La base (migration 20261114_jury_resultats) garde une ligne par stagiaire et
// refuse ce qui est mal formé ; ici, ce que la fenêtre propose et ce qu'elle envoie.

// Les choix de la liste, dans l'ordre affiché. Une validation partielle se saisit avec le CCP acquis.
export const CHOIX_JURY = [
  ["", "Non saisi"],
  ["obtenu", "Titre obtenu"],
  ["partiel1", "Validation partielle : CCP1 acquis"],
  ["partiel2", "Validation partielle : CCP2 acquis"],
  ["non_obtenu", "Non obtenu"],
  ["absent", "Absent au jury"],
];
const VALEURS = new Set(CHOIX_JURY.map(([v]) => v));

// La valeur de la liste pour une ligne de la base (ou "" sans ligne).
export function valeurDeLigne(ligne) {
  if (!ligne) return "";
  if (ligne.resultat === "partiel") return ligne.ccp2 ? "partiel2" : "partiel1";
  return ligne.resultat || "";
}

// La ligne à écrire pour une valeur de la liste.
export function ligneDeValeur(stagiaireId, valeur, sessionLe) {
  const partiel = valeur === "partiel1" || valeur === "partiel2";
  return {
    stagiaire_id: stagiaireId, session_le: sessionLe, resultat: partiel ? "partiel" : valeur,
    ccp1: valeur === "partiel1", ccp2: valeur === "partiel2",
  };
}

// Date de session acceptée : « AAAA-MM-JJ », pas avant 2020, pas après aujourd'hui (on saisit un jury passé).
export function dateSessionValide(date, aujourdhui) {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= "2020-01-01" && date <= aujourdhui;
}

// Ce que la fenêtre envoie. anciennes : Map(stagiaire_id -> ligne de la base) ; choix : Map(stagiaire_id -> valeur de la liste,
// ou { valeur, repasse }). Partent : les lignes dont la valeur change, et celles cochées « repassé à cette session » (même
// résultat, nouveau passage : la ligne prend la date de la session saisie, règle du dernier passage). Un résultat qui part prend
// la date de la session saisie ; « Non saisi » sur une ligne existante la retire ; une valeur inconnue est ignorée.
// Rend { ecrire, retirer, erreur } : erreur (une phrase) quand un résultat part sans date de session valide.
export function changementsJury(anciennes, choix, sessionLe, aujourdhui) {
  const ecrire = [];
  const retirer = [];
  for (const [id, choisi] of choix) {
    const valeur = typeof choisi === "object" && choisi !== null ? choisi.valeur : choisi;
    const repasse = typeof choisi === "object" && choisi !== null && !!choisi.repasse;
    if (!VALEURS.has(valeur)) continue;
    const avant = valeurDeLigne(anciennes.get(id));
    if (valeur === avant && !(repasse && valeur !== "")) continue;
    if (valeur === "") retirer.push(id);
    else ecrire.push(ligneDeValeur(id, valeur, sessionLe));
  }
  if (ecrire.length && !dateSessionValide(sessionLe, aujourdhui)) {
    return { ecrire: [], retirer: [], erreur: "Indiquez la date de la session du jury (une date passée, depuis 2020)." };
  }
  return { ecrire, retirer, erreur: null };
}

// La date proposée à l'ouverture : la dernière session déjà saisie, sinon aujourd'hui.
export function dateProposee(lignes, aujourdhui) {
  const dates = (lignes || []).map((l) => l.session_le).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : aujourdhui;
}
