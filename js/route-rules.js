// Adresses de l'app à segments (chantier D, lot 2) : #/<route>/<id>/<partie>.
// Le premier segment choisit la page ; Mon espace lit une partie, la page
// Stagiaires une fiche puis une partie. Module pur, sans DOM : testé en node.

// Toutes les parties qu'une adresse peut nommer (Mon espace et page Stagiaires). L'ordre
// d'affichage d'une fiche est celui de partiesDeLaFiche. `evolution` et `classe` restent
// lisibles sous la nouvelle navigation, où elles ouvrent Résultats (ouvertureDeMonSuivi) :
// favoris et liens d'avant gardent leur destination.
export const PARTIES = ["resultats", "passages", "epcf", "evolution", "livret", "dp", "classe"];

// Parties d'une fiche, dans l'ordre d'affichage. Mon suivi sous la nouvelle navigation (lot 2B,
// tâche 7) : Résultats d'abord, qui réunit Évolution (« Moi ») et les notes de la classe (« La
// classe ») ; deux mots vagues de moins sur le sommaire. La fiche d'un stagiaire vue par
// l'équipe et l'ancienne navigation gardent la fiche de main.
export function partiesDeLaFiche({ soi = false, navigationV2 = false } = {}) {
  return soi && navigationV2
    ? ["resultats", "passages", "epcf", "livret", "dp"]
    : ["passages", "epcf", "evolution", "livret", "dp"];
}

// Les deux vues de Résultats, et la clé de mémoire de la dernière ouverte (une redirection
// l'écrit pour ouvrir « La classe », comme pour un sous-onglet : js/nav-rules.js).
export const VUES_RESULTATS = ["moi", "classe"];
export const CLE_VUE_RESULTATS = "ecsr_resultats_vue";
const VUE_DE_PARTIE = new Map([["evolution", "moi"], ["classe", "classe"]]);

// Ce que Mon suivi ouvre pour une partie lue dans l'adresse, sous la nouvelle navigation :
// Évolution et La classe deviennent Résultats sur leur vue ; `vue` nulle, la mémoire décide.
export function ouvertureDeMonSuivi(partie) {
  const vue = VUE_DE_PARTIE.get(partie) || null;
  return { partie: vue ? "resultats" : (partie ?? null), vue };
}

// Vue de Résultats à montrer d'après la mémoire : « Moi » par défaut.
export function vueDeResultats(memorisee) {
  return VUES_RESULTATS.includes(memorisee) ? memorisee : "moi";
}

// Vue à montrer : celle que l'adresse (ou le dernier choix fait sur la page) demande passe avant la
// mémoire de l'appareil, qui n'est qu'un confort. Sans cela, un stockage indisponible (navigation privée)
// ferait ouvrir « Moi » sur #/mon-suivi/classe.
export function vueAAfficher(demandee, memorisee) {
  return VUES_RESULTATS.includes(demandee) ? demandee : vueDeResultats(memorisee);
}

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
