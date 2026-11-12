// Navigation interne (chantier D, lot 2).
// - Garde de saisie : une vue qui a une saisie en cours (grille EPCF) pose une
//   garde ; quitter (autre adresse, onglet, Actualiser) demande confirmation.
// - Mise à jour sur place : quand seule la fin de l'adresse change
//   (#/stagiaires/12 → /14, #/mon-suivi → /epcf), la page se met à jour
//   elle-même au lieu d'être reconstruite (liste gardée, défilement gardé).
// Rien n'est touché au chargement du module : testable en node.

let garde = null;          // { estSale: () => boolean, message: string }
let majSurPlace = null;    // { route, fn(adresse) }
let adresse = "";          // dernière adresse affichée, remise si la garde refuse

export function poserGardeSortie(g) { garde = g; }
// Sans argument : lève toute garde. Avec : seulement si c'est encore la sienne.
export function leverGardeSortie(g) { if (!g || garde === g) garde = null; }
export function gardeActive() { return !!garde && !!garde.estSale(); }

// Peut-on quitter ce qui est affiché ? La réponse est immédiate : le routeur et les sous-onglets ne savent pas attendre.
// Sans saisie en cours : oui. Avec : non pour l'instant, et la question se pose dans une fenêtre de l'app (la question de
// la garde si elle en porte une, sinon son message) ; en cas d'accord, la garde tombe et `reprendre` rejoue le geste
// retenu (aller à l'adresse voulue, changer d'onglet). Une seule question à la fois. `demander` : pour les tests.
let questionOuverte = false;
const questionDeLApp = async (question) => {
  const { confirmer } = await import("./confirmer.js?v=20261112d");
  return confirmer(question);
};
export function peutQuitter(reprendre = null, { demander = questionDeLApp } = {}) {
  if (!gardeActive()) return true;
  if (questionOuverte) return false;
  questionOuverte = true;
  const g = garde;
  const question = g.question || { titre: g.message, oui: "Quitter", non: "Rester" };
  Promise.resolve(demander(question)).then((oui) => {
    questionOuverte = false;
    if (!oui) return;
    if (garde === g) garde = null;
    if (reprendre) reprendre();
  }, () => { questionOuverte = false; });
  return false;
}

export function surChangementAdresse(route, fn) { majSurPlace = { route, fn }; }
export function majSurPlacePour(route) { return majSurPlace && majSurPlace.route === route ? majSurPlace.fn : null; }
export function oublierMajSurPlace() { majSurPlace = null; }

export function noterAdresse(h) { adresse = h; }
export function adresseCourante() { return adresse; }

// Met l'adresse à jour sans étape d'historique ni nouveau rendu (onglet choisi,
// adresse remise après un refus de la garde).
export function remplacerAdresse(h) {
  adresse = h;
  try { history.replaceState(null, "", h || location.pathname + location.search); } catch (e) { /* hors navigateur */ }
}

// Fermer ou recharger la page avec une saisie en cours : alerte du navigateur.
export function installerGardeNavigateur() {
  window.addEventListener("beforeunload", (e) => {
    if (!gardeActive()) return;
    e.preventDefault();
    e.returnValue = "";
  });
}
