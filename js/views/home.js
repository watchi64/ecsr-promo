/**
 * Page d'accueil (#/home) : un aiguillage. Chaque espace a sa page, le stagiaire son Accueil
 * (js/views/accueil-stagiaire.js), l'équipe Aujourd'hui (js/views/aujourdhui.js).
 */
import { formateurConnecte } from "../modules-etat.js?v=20261112d";
import { renderAccueilStagiaire } from "./accueil-stagiaire.js?v=20261112d";
import { renderAujourdhui } from "./aujourdhui.js?v=20261112d";

export async function renderHome(container) {
  return formateurConnecte() ? renderAujourdhui(container) : renderAccueilStagiaire(container);
}
