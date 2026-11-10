// Erreurs de la conservation des données (page Qualiopi) : ce que la base répond, dit en français lisible à l'écran
// (tutoiement). PUR : ni DOM ni réseau. Testé en node (tests/conservation-lecture.test.mjs).
//
// La migration lève ses refus sous la forme « conservation: <phrase> » : la phrase est déjà du français à l'écran, on la
// reprend telle quelle. Un refus de droit (42501) sans phrase, une fonction absente de la base (migration pas encore
// appliquée) et une panne de réseau ont chacun la leur.

export const PHRASE_DROIT = "Réservé à la gestion de la qualité : ce compte n'a pas ce droit.";
export const PHRASE_INDISPONIBLE = "La conservation des données n'est pas encore disponible. Réessaie un peu plus tard.";
export const PHRASE_RESEAU = "L'opération n'a pas abouti : vérifie ta connexion, puis réessaie.";

const PREFIXE = "conservation:";

// La phrase de la base, sans son préfixe, ou nul si l'erreur n'est pas un refus de la migration.
export function phraseConservation(erreur) {
  const texte = String(erreur?.message ?? erreur ?? "").trim();
  const i = texte.indexOf(PREFIXE);
  if (i < 0) return null;
  return texte.slice(i + PREFIXE.length).trim() || null;
}

// La fonction n'existe pas dans la base (PostgREST : PGRST202 ; Postgres : 42883).
export function conservationAbsente(erreur) {
  const code = String(erreur?.code ?? "");
  const texte = String(erreur?.message ?? erreur ?? "");
  return code === "PGRST202" || code === "42883" || /could not find the function|function .* does not exist/i.test(texte);
}

// Message à afficher pour une erreur de lecture ou d'action.
export function messageErreurConservation(erreur) {
  if (conservationAbsente(erreur)) return PHRASE_INDISPONIBLE;
  const phrase = phraseConservation(erreur);
  if (phrase) return phrase;
  if (String(erreur?.code ?? "") === "42501") return PHRASE_DROIT;
  return PHRASE_RESEAU;
}
