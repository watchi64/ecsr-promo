// Les deux sortes de jetons de couleur de l'app, listées une seule fois : le test node
// (tests/habillage-jetons.test.mjs) et le vérificateur du banc (importé dans la page) les lisent ici.
//
// PREFIXES_HABILLAGE : la couleur de l'interface (fonds, textes, traits, accent, barre sombre, repères,
// halos, lueurs, ombres, graphes, titres). L'habillage « Couleurs ECF » redéfinit chacun de ces jetons.
// FAMILLES_FIXES : une couleur qui porte un sens (note, activité, statut, document) et le garde dans
// les deux habillages ; ECF n'en redéfinit aucune.
// Règle de tri d'un littéral : il dit quelque chose (note, activité, statut, alerte) -> famille fixe ;
// il habille (surface, texte, trait, gris pur, axe de graphe, décor) -> famille d'habillage.
// Liste ouverte : une famille nouvelle née de la chasse aux couleurs s'ajoute ici, dans le même commit.

export const PREFIXES_HABILLAGE = Object.freeze([
  "--bg", "--line", "--text", "--accent", "--sur-sombre", "--sombre", "--repere", "--sur-repere",
  "--pastille", "--sur-pastille", "--halo", "--lueur", "--shadow", "--ombre", "--graphe",
  "--font-display", "--poids-titre", "--lisere-habillage", "--barre-etat",
]);

export const FAMILLES_FIXES = Object.freeze(["--note", "--act", "--c-", "--doc", "--apercu"]);

// Un préfixe couvre son nom exact et ses déclinaisons (« --bg » -> « --bg », « --bg-elev »), jamais un
// nom qui lui ressemble seulement (« --act » ne couvre pas « --accent »). Un préfixe qui finit par un
// tiret (« --c- ») couvre tout ce qui commence par lui.
export function correspond(nom, prefixe) {
  if (typeof nom !== "string" || !nom.startsWith("--")) return false;
  if (nom === prefixe) return true;
  return nom.startsWith(prefixe.endsWith("-") ? prefixe : prefixe + "-");
}

// « habillage », « fixe », ou null si le jeton n'appartient à aucune des deux listes.
export function familleDe(nom) {
  if (PREFIXES_HABILLAGE.some((p) => correspond(nom, p))) return "habillage";
  if (FAMILLES_FIXES.some((p) => correspond(nom, p))) return "fixe";
  return null;
}
