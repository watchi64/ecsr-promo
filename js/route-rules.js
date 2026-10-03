// Adresses de l'app à segments (chantier D, lot 2) : #/<route>/<id>/<partie>.
// Le premier segment choisit la page ; Mon espace lit une partie, la page
// Stagiaires une fiche puis une partie. Module pur, sans DOM : testé en node.

// Parties d'une fiche, dans l'ordre d'affichage (Mon espace et page Stagiaires).
export const PARTIES = ["passages", "epcf", "evolution", "livret", "dp"];

function partieValide(p) { return PARTIES.includes(p) ? p : null; }
function idValide(s) { return /^[1-9]\d*$/.test(String(s ?? "")) ? Number(s) : null; }

// "#/stagiaires/12/epcf" → { route: "stagiaires", id: 12, partie: "epcf" } ;
// "#/mon-suivi/dp" → { route: "mon-suivi", id: null, partie: "dp" } ; toute
// autre page garde seulement sa route. Une partie ou un id illisible vaut null.
export function lireAdresse(hash) {
  const segments = String(hash ?? "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const route = segments[0] || "";
  if (route === "stagiaires") {
    const id = idValide(segments[1]);
    return { route, id, partie: id ? partieValide(segments[2]) : null };
  }
  if (route === "mon-suivi") return { route, id: null, partie: partieValide(segments[1]) };
  return { route, id: null, partie: null };
}

// Adresse d'une fiche, d'une partie, ou de la page elle-même.
export function adresseFiche(route, id, partie) {
  let h = "#/" + route;
  if (route === "stagiaires" && id) h += "/" + id;
  if (partie && (route === "mon-suivi" || (route === "stagiaires" && id))) h += "/" + partie;
  return h;
}

// Lien « Où le trouver » : une partie de Mon espace se vise par l'adresse ; les
// sous-onglets de Notes et de Cours passent par la mémoire de renderSubTabs.
export function hrefLien(lien) {
  if (lien.route === "mon-suivi" && partieValide(lien.sousOnglet)) return "#/mon-suivi/" + lien.sousOnglet;
  return "#/" + lien.route;
}

// Page « à soi » : la page Stagiaires pour un formateur ou un admin sans profil
// stagiaire, Mon espace pour toute personne qui a un profil stagiaire.
export function pagePersonnelle({ formateur, stagiaireId }) {
  return formateur && stagiaireId == null ? "stagiaires" : "mon-suivi";
}
