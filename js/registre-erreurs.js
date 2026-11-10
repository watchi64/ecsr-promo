// Erreurs du registre qualité : ce que la base répond, dit en français lisible à l'écran (vouvoiement : le registre est
// réservé à l'équipe, règle du 10/11). PUR : ni DOM ni réseau. Testé en node (tests/registre-erreurs.test.mjs).
//
// La migration lève ses refus sous la forme « registre: <phrase> » : la phrase est déjà du français à l'écran, on la
// reprend telle quelle. Un problème signalé déjà versé au registre (doublon, 23505), un refus de droit (42501), un refus de
// contrainte (23514) et une panne de réseau ont chacun leur phrase.

export const PHRASE_DOUBLON = "Ce problème est déjà au registre.";
export const PHRASE_DROIT = "Réservé à la gestion de la qualité : ce compte n'a pas ce droit.";
export const PHRASE_CONTRAINTE = "Une valeur n'est pas acceptée par le registre : vérifiez les dates et les champs, puis réessayez.";
export const PHRASE_RESEAU = "Le registre n'a pas pu être enregistré : vérifiez votre connexion, puis réessayez.";

const PREFIXE = "registre:";

// La phrase de la base, sans son préfixe, ou nul si l'erreur n'est pas un refus de la migration.
function phraseDeLaBase(erreur) {
  const texte = String(erreur?.message ?? erreur ?? "").trim();
  const i = texte.indexOf(PREFIXE);
  if (i < 0) return null;
  return texte.slice(i + PREFIXE.length).trim() || null;
}

// Message à afficher pour une erreur d'enregistrement ou de lecture du registre.
export function messageErreurRegistre(error) {
  const code = String(error?.code ?? "");
  if (code === "23505") return PHRASE_DOUBLON;
  if (code === "42501") return PHRASE_DROIT;
  if (code === "23514") return PHRASE_CONTRAINTE;
  return phraseDeLaBase(error) ?? PHRASE_RESEAU;
}

// La table n'existe pas dans la base (migration pas encore appliquée).
export function tableAbsente(error) {
  const code = String(error?.code ?? "");
  const texte = String(error?.message ?? "");
  return code === "PGRST205" || code === "42P01" || /could not find the table|relation .* does not exist/i.test(texte);
}
