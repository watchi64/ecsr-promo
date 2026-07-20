// Règles PURES de comptage des passages — spec docs/specs/2026-07-19-absences-comptage-placement-design.md.
// Module sans dépendance : importé par db.js et planning.js, testable directement en node
// (tests/passage-rules.test.mjs).

// Résultats qui consomment le tour dans les compteurs d'équité du placement.
// « Absence » COMPTE (tour consommé, règle du 2026-07-19 : une absence de dernière
// minute ne redonne pas la priorité) ; « Bonus » (dépannage au pied levé) et
// « Report » (cas manuel, onglet Passages) ne comptent pas.
export function compteDansEquite(resultat) {
  return resultat === "Effectué" || resultat === "Absence";
}

// Fusion de deux candidats du même (stagiaire, type, jour) à « Valider la semaine » :
// un vrai passage n'est jamais écrasé par une absence ni par un bonus.
export const RESULTAT_RANG = { "Effectué": 0, "Absence": 1, "Bonus": 2, "Report": 3 };

export function meilleurResultat(a, b) {
  return (RESULTAT_RANG[a] ?? 9) <= (RESULTAT_RANG[b] ?? 9) ? a : b;
}
