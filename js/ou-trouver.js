// « Où le trouver » selon la navigation (refonte, lot 2A) : module pur, sans DOM ni stockage, testé en node
// (tests/ou-trouver.test.mjs).
//
// Les liens des Nouveautés (js/nouveautes-data.js) et des annonces d'ouverture de module (js/modules-data.js) sont écrits avec les
// noms de l'ancienne barre : « Calendrier », « Ressources », « Mon espace personnel, partie Livret », « Paramètres »... Avec la
// nouvelle, le libellé suit la barre. Le lien, lui, ne change pas : la route, le sous-onglet et l'adresse restent ceux de l'entrée
// (les redirections du lot 1, js/nav-rules.js, mènent chaque ancienne adresse à sa nouvelle page, le bon sous-onglet ouvert) ; seul
// le nom écrit à l'écran est celui que la personne lit dans sa barre, à deux destinations près, qui ont vraiment changé de place et que
// le lien suit (destinationChangee) : les réglages de la personne (Mes préférences, route `preferences`, ruling R55) et la banque des
// élèves bénévoles (Stagiaires, sous-onglet `benevoles`). Avec l'ancienne navigation, `ou` est rendu tel quel : l'app d'une promo
// éteinte reste celle de main.

// Un libellé qui commence par `ancien` (le nom seul, ou suivi d'une virgule et d'un détail) : le reste du libellé, détail compris
// (« , partie Livret »), ou null quand il commence autrement.
function reste(label, ancien) {
  if (label === ancien) return "";
  return label.startsWith(ancien + ",") ? label.slice(ancien.length) : null;
}

// Le libellé de `ou` sous la nouvelle navigation. `espace` : « equipe » (formateur ou admin) ou « stagiaire ».
function libelleNouvelle(ou, espace) {
  const label = String(ou.label ?? "");
  switch (ou.route) {
    case "calendrier": return "Planning, Dates clés";
    case "ressources": return "Cours et QCM, Documents";
    case "dashboard": return "Planning, Priorités";
    case "centre": return "Indicateurs";
    case "themes": {
      const suite = reste(label, "Cours");
      return suite === null ? label : "Cours et QCM" + suite;
    }
    case "mon-suivi": {
      // « Mon espace personnel, partie X » devient « Mon suivi, partie X » ; un geste de l'ancienne barre (« Le logo en haut à
      // gauche ») devient le nom de la page.
      const suite = reste(label, "Mon espace personnel") ?? reste(label, "Mon espace");
      if (suite !== null) return "Mon suivi" + suite;
      return label.startsWith("Mon suivi") ? label : "Mon suivi";
    }
    case "notes": {
      // Chez le stagiaire, les notes de la classe sont une partie de Mon suivi ; chez l'équipe, la page garde son entrée.
      if (espace !== "equipe") return "Mon suivi, La classe";
      const suite = reste(label, "Notes");
      return suite === null ? label : "Notes et examens" + suite;
    }
    // Réglages est la page de la promo, réservée à l'équipe ; la page de la personne est Mes préférences, son menu du compte.
    // Un stagiaire n'est jamais envoyé vers « Réglages ».
    case "config": return espace === "equipe" ? "Réglages" : "Mes préférences";
    case "stagiaires": return label.startsWith("Accueil, tuile") ? "Stagiaires" : label;   // la tuile de l'Accueil n'existe plus
    // La promo est en tête de la barre de gauche sur ordinateur, en haut de l'écran sur téléphone : « en tête de la barre » dit vrai des deux.
    case "home": return label === "Pastille en haut, à côté de ton nom" ? "La promo, en tête de la barre" : label;
    default: return label;
  }
}

// Les deux destinations qui ont changé de place, libellé compris, sous la nouvelle navigation (null pour tout autre lien) :
//   - un lien vers Paramètres dont le détail désigne Mes préférences (« Paramètres, Mes préférences ») : la page de la personne, pour les
//     deux espaces (ruling R55). Réglages, chez l'équipe, ne garde que la promo : l'y envoyer serait faux, et le stagiaire n'y va jamais ;
//   - un lien vers le bouton « Bénévoles » du Planning : la banque des élèves bénévoles est le sous-onglet « Élèves bénévoles » de
//     Stagiaires, que le bouton du Planning ouvre aussi, mais que la barre nomme. Les deux Nouveautés qui en parlent sont pour
//     les formateurs, seuls à avoir cette banque : le libellé ne dépend pas de l'espace.
function destinationChangee(ou) {
  const label = String(ou.label ?? "");
  if (ou.route === "config" && (reste(label, "Paramètres") ?? "").startsWith(", Mes préférences")) {
    return { label: "Mes préférences", route: "preferences" };
  }
  if (ou.route === "planning" && reste(label, "Planning, bouton Bénévoles") !== null) {
    return { label: "Stagiaires, Élèves bénévoles", route: "stagiaires", sousOnglet: "benevoles" };
  }
  return null;
}

// `ou` : { label, route, sousOnglet? }, tel que l'écrivent les Nouveautés et le catalogue des modules. Rend `ou` lui-même quand rien
// ne change (ancienne navigation, ou libellé déjà à jour), sinon une copie dont seul le libellé diffère, hors les deux destinations
// qui ont changé de place (destinationChangee : libellé, route et sous-onglet). `ou` n'est jamais modifié.
export function ouSelonNavigation(ou, { navigationV2 = false, espace = "stagiaire" } = {}) {
  if (!ou || !navigationV2) return ou;
  const deplace = destinationChangee(ou);
  if (deplace) return { ...ou, ...deplace };
  const label = libelleNouvelle(ou, espace);
  return label === ou.label ? ou : { ...ou, label };
}
