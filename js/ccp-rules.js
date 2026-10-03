// Règles pures de l'onglet CCP2 (chantier D). Aucune dépendance, aucun accès à la
// base ni au DOM : testées par node (tests/ccp-rules.test.mjs).

// Typographie du parcours : une espace insécable lie un nombre à la suite (« 40 000 »,
// « 30 minutes », « 1 h 30 »), pour qu'un retour à la ligne ne le coupe pas en deux.
// Le caractère est fabriqué par son code : écrit tel quel, il serait invisible dans le
// source.
const INSECABLE = String.fromCharCode(0xa0);
export function insecables(texte) {
  return String(texte)
    .replace(/(\d) (?=\d{3}(?!\d))/g, "$1" + INSECABLE)
    .replace(/(\d) (?=[A-Za-zÀ-ÿ])/g, "$1" + INSECABLE)
    .replace(/\bh (?=\d)/g, "h" + INSECABLE);
}

// Types d'événements du Calendrier repris dans le parcours CCP2.
export const TYPES_DATES_CCP2 = ["formation", "stage", "examen"];
const MOTIF_CCP2 = /\bccp\s*2\b/i;

// Événements CCP2 du Calendrier : formation, stages et examen dont le titre
// contient « CCP2 » (casse et espace ignorés), triés par date de début. Chacun
// reçoit `passe`, vrai s'il est terminé à la date `aujourdhui` (AAAA-MM-JJ). Les
// dates de la base sont des textes AAAA-MM-JJ : l'ordre du texte est celui du temps.
export function datesCcp2(evenements, aujourdhui) {
  return (Array.isArray(evenements) ? evenements : [])
    .filter((e) => e && TYPES_DATES_CCP2.includes(e.type) && typeof e.date_start === "string"
      && MOTIF_CCP2.test(e.title || ""))
    .map((e) => ({ ...e, passe: (e.date_end || e.date_start) < aujourdhui }))
    .sort((a, b) => (a.date_start < b.date_start ? -1 : a.date_start > b.date_start ? 1 : 0));
}
