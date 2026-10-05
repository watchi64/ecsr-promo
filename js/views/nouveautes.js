// Rubrique Nouveautés : la carte (partagée avec la section d'Accueil) et la
// page complète #/nouveautes.
//
// La page n'est PAS dans la barre d'onglets : on y arrive par le lien
// « Tout voir » d'Accueil, comme #/mon-suivi n'a pas d'onglet non plus.

import { el, clear, formatDate } from "../utils.js?v=20261005c";
import { nouveautesAffichables, marquerLues } from "../modules-etat.js?v=20261005c";
import { STORAGE_SOUS_ONGLET } from "../nouveautes.js?v=20261005c";
import { hrefLien } from "../route-rules.js?v=20261005c";

// Lien « Où le trouver ». Une partie de Mon espace se vise par l'adresse
// (#/mon-suivi/dp) ; un sous-onglet de Notes ou de Cours, par la clé que
// renderSubTabs relit à l'ouverture de la vue : sans ça, un lien « Notes,
// sous-onglet EPCF » atterrirait sur la Matrice, et le lecteur devrait
// chercher lui-même ce qu'on venait de lui indiquer.
function lienOu(ou) {
  if (!ou) return null;
  const href = hrefLien(ou);
  return el("a", {
    class: "nv-ou",
    href,
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[ou.route];
      if (!cle || !ou.sousOnglet || href !== "#/" + ou.route) return;
      try { localStorage.setItem(cle, ou.sousOnglet); } catch (e) { /* ignore */ }
    },
  }, "Où le trouver : ", el("strong", {}, ou.label));
}

// Guide facultatif, replié par défaut dans Accueil et déplié sur la page.
// <details> natif : pas de JavaScript d'ouverture, et le clavier fonctionne.
function blocGuide(guide, deplie) {
  if (!Array.isArray(guide) || guide.length === 0) return null;
  return el("details", { class: "nv-guide", open: deplie ? "" : null },
    el("summary", {}, "Comment faire"),
    el("ol", {}, ...guide.map((etape) => el("li", {}, etape))),
  );
}

export function carteNouveaute(entree, opts = {}) {
  const { neuve = false, guideDeplie = false } = opts;
  return el("article", { class: "nv-carte" },
    el("div", { class: "nv-head" },
      el("span", { class: "nv-date" }, formatDate(entree.date)),
      neuve ? el("span", { class: "nv-puce-neuf" }, "Nouveau") : null,
      entree.pour === "formateurs" ? el("span", { class: "nv-puce-role" }, "Formateurs") : null,
    ),
    el("h3", { class: "nv-titre" }, entree.titre),
    el("p", { class: "nv-resume" }, entree.resume),
    lienOu(entree.ou),
    blocGuide(entree.guide, guideDeplie),
  );
}

export async function renderNouveautes(container) {
  clear(container);

  // Nouveautés de la promo (annonces d'ouverture de module comprises), de la plus
  // récente à la plus ancienne, et celles qui sont encore neuves pour la personne.
  const { entrees: mesEntrees, neuves } = nouveautesAffichables();

  container.appendChild(el("div", { class: "view-header" },
    el("h1", {}, "Nouveautés"),
    el("p", { class: "muted" },
      "Toutes les mises à jour de l'app, de la plus récente à la plus ancienne."),
  ));

  if (mesEntrees.length === 0) {
    container.appendChild(el("p", { class: "muted" }, "Aucune nouveauté pour le moment."));
    return;
  }

  container.appendChild(el("div", { class: "nv-liste" },
    ...mesEntrees.map((e) => carteNouveaute(e, {
      neuve: neuves.has(e.id), guideDeplie: true,
    })),
  ));

  // La page complète marque TOUT comme lu, la section d'Accueil ne marque que
  // les entrées qu'elle affiche. La pastille se met à jour par l'événement, ce
  // qui évite un import circulaire avec main.js.
  marquerLues(mesEntrees.map((e) => e.id));
  window.dispatchEvent(new CustomEvent("nouveautes-vues"));
}
