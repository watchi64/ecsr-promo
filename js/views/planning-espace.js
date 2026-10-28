// Nouvelle navigation (refonte, lot 1) : la page Planning regroupe trois sous-onglets, la
// semaine (le planning actuel), les dates clés (ex-page Calendrier) et les priorités de
// passage (ex-page Priorités). Chaque sous-onglet rend la page actuelle, inchangée. Avec
// l'ancienne navigation, la route planning rend la semaine seule (js/main.js).

import { el, clear } from "../utils.js?v=20261028b";
import { renderSubTabs } from "../subtabs.js?v=20261028b";
import { CLES_SOUS_ONGLETS } from "../nav-rules.js?v=20261028b";
import { renderPlanning, teardownPrintTarget, resetPlanningEditMode } from "./planning.js?v=20261028b";
import { renderCalendrier } from "./calendrier.js?v=20261028b";
import { renderDashboard } from "./dashboard.js?v=20261028b";
import { afficherErreur } from "./mon-suivi.js?v=20261028b";

// Passer de la semaine à un autre sous-onglet vaut quitter la page du planning (js/main.js) :
// le mode Modifier retombe, la barre des jours n'est plus suivie et la cible d'impression part
// (une impression depuis Dates clés n'imprime pas la semaine).
function quitterSemaine() {
  resetPlanningEditMode();
  teardownPrintTarget();
}

// Chaque page se rend dans un conteneur neuf, posé dans le panneau que renderSubTabs partage
// entre ses sous-onglets. Les classes que la semaine pose sur son conteneur (read-only,
// p-compact, p-editing) partent avec lui, et un rendu tardif (données arrivées après un
// changement de sous-onglet) écrit dans un nœud détaché au lieu du sous-onglet affiché. Une
// erreur de chargement s'affiche dans le sous-onglet, avec « Réessayer » (sans sous-onglets,
// c'est le routeur qui l'affiche).
function dansUnConteneur(rendre) {
  return (panneau) => {
    const conteneur = el("div");
    panneau.appendChild(conteneur);
    const lancer = async () => {
      try { await rendre(conteneur); }
      catch (e) {
        if (conteneur.isConnected) afficherErreur(conteneur, e, lancer);
        else console.error(e);
      }
    };
    lancer();
  };
}

// Chaque sous-onglet suit le module de son ancienne page : la page s'ouvre dès que l'un d'eux
// est ouvert (routeVisibleV2, js/nav-rules.js) et ne montre que ceux-là chez un stagiaire.
// `aujourdhui` : le geste du bouton « Aujourd'hui » de l'ancienne barre (js/main.js), que la semaine
// porte en haut de sa vue (ruling R29).
export async function renderPlanningEspace(view, { aujourdhui = null } = {}) {
  clear(view);
  view.appendChild(renderSubTabs([
    { key: "semaine", label: "Semaine", module: "planning", render: dansUnConteneur((c) => renderPlanning(c, { aujourdhui })) },
    { key: "dates", label: "Dates clés", module: "calendrier",
      render: dansUnConteneur((c) => { quitterSemaine(); return renderCalendrier(c); }) },
    { key: "priorites", label: "Priorités", module: "priorites",
      render: dansUnConteneur((c) => { quitterSemaine(); return renderDashboard(c, { embedded: true }); }) },
  ], { storageKey: CLES_SOUS_ONGLETS.planning }));
}
