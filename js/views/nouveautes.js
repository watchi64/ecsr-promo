// Rubrique Nouveautés : la carte (partagée avec la section d'Accueil) et la
// page complète #/nouveautes.
//
// La page n'est PAS dans la barre d'onglets : on y arrive par le lien
// « Tout voir » d'Accueil, comme #/mon-suivi n'a pas d'onglet non plus.

import { el, clear, formatDate } from "../utils.js?v=20260826b";
import { isAdmin, isProf } from "../auth-admin.js?v=20260826b";
import { NOUVEAUTES } from "../nouveautes-data.js?v=20260826b";
import {
  triees, visibles, nonLues, vuesEffectives, marquerVues, STORAGE_SOUS_ONGLET,
} from "../nouveautes.js?v=20260826b";

// Lien « Où le trouver ». Si l'entrée vise un sous-onglet, on écrit la clé que
// renderSubTabs relit à l'ouverture de la vue : sans ça, un lien « Notes,
// sous-onglet Livret EPCF » atterrirait sur la Matrice, et le lecteur devrait
// chercher lui-même ce qu'on venait de lui indiquer.
function lienOu(ou) {
  if (!ou) return null;
  return el("a", {
    class: "nv-ou",
    href: "#/" + ou.route,
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[ou.route];
      if (!cle || !ou.sousOnglet) return;
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

  const formateur = isAdmin() || isProf();
  const mesEntrees = triees(visibles(NOUVEAUTES, formateur));
  const neuves = new Set(nonLues(mesEntrees, vuesEffectives(NOUVEAUTES)).map((e) => e.id));

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
  marquerVues(mesEntrees.map((e) => e.id), NOUVEAUTES);
  window.dispatchEvent(new CustomEvent("nouveautes-vues"));
}
