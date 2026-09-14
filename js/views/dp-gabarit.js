// Gabarit du Dossier Professionnel : le HTML du document, reproduisant le modèle
// officiel du ministère chargé de l'emploi, version du 11/09/2017.
//
// Le gabarit ne décide pas des pages : il produit un FLUX de blocs, que
// js/dp-pagination.js répartit sur des feuilles A4. Aucun comportement ici.
//
// Sécurité : ce module produit du HTML par concaténation. La SEULE donnée saisie
// par le candidat qui y est injectée est l'intitulé d'une fiche d'exemple, repris
// au sommaire, et il passe obligatoirement par escapeHtml. Toutes les autres
// valeurs entrent par fillData, qui écrit en textContent.

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const MENTION_VERSION_IMPAIRE = "DOSSIER PROFESSIONNEL - Version Traitement de texte - Version du 11/09/2017";
const MENTION_VERSION_PAIRE = "DOSSIER PROFESSIONNEL - Version du 11/09/2017";

// En-tête officiel. La couverture porte le logo du ministère et un titre plus
// grand ; les autres feuilles n'ont que le titre. C'est le partage du modèle,
// qui réserve son en-tête illustré à la première page.
export function entete(estCouverture) {
  const titre = `<div class="dp-entete-titre"><b>Dossier Professionnel</b> <span>(DP)</span></div>`;
  const bande = `<div class="dp-entete-bande"></div>`;
  if (!estCouverture) return `<div class="dp-entete">${bande}${titre}</div>`;
  return `<div class="dp-entete">
    <div class="dp-entete-logo">
      <img src="assets/dp/ministere-emploi.jpg" alt="Ministère chargé de l'emploi">
    </div>
    <div class="dp-entete-bloc">${bande}${titre}</div>
  </div>`;
}

// Pied officiel. Le modèle alterne la mention et le numéro selon la parité de la
// feuille, et ne donne jamais de nombre total de pages.
export function pied(numero) {
  const paire = numero % 2 === 0;
  const page = `<span>Page ${numero}</span>`;
  const mention = `<span>${paire ? MENTION_VERSION_PAIRE : MENTION_VERSION_IMPAIRE}</span>`;
  return `<div class="dp-pied">${paire ? page + mention : mention + page}</div>`;
}

// Une feuille A4 complète.
export function feuille(interieur, numero, estCouverture) {
  return `<section class="dp-feuille${estCouverture ? " dp-couverture" : ""}">`
       + entete(estCouverture)
       + `<div class="dp-corps">${interieur}</div>`
       + pied(numero)
       + `</section>`;
}
