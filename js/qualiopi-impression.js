// Impression des documents Qualiopi (spec docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md, § 6.4 et 6.5) : le
// document est monté dans #qualiopi-print (caché à l'écran, css/qualiopi.css), sous un format A4 portrait injecté pour
// l'occasion, le temps d'imprimer.
//
// Ce module part avec l'app, au contraire de la page (js/views/qualiopi.js, chargée à la demande par js/main.js) : navigate()
// en appelle teardownQualiopiPrint() à chaque changement de page, que la page Qualiopi ait été ouverte ou non. Il reste donc
// tout petit et sans aucun import : une erreur dans la page ou dans ses modules de calcul ne peut pas l'atteindre.

const ID_IMPRESSION = "qualiopi-print";
const ID_PAGE = "qualiopi-page-style";
const CLASSE_IMPRESSION = "qualiopi-printable";
let titreAvant = null;      // titre de la page avant qu'il ne nomme le PDF, à rendre
let ecouteurFin = null;     // écouteur d'afterprint de l'impression en cours

// Ne laisse ni conteneur, ni format de page, ni classe sur <body>, ni titre emprunté : appelée à afterprint, avant chaque
// impression (la deuxième remplace la première) et par js/main.js à chaque changement de page.
export function teardownQualiopiPrint() {
  document.querySelectorAll("#" + ID_IMPRESSION + ", #" + ID_PAGE).forEach((noeud) => noeud.remove());
  document.body.classList.remove(CLASSE_IMPRESSION);
  if (titreAvant !== null) { document.title = titreAvant; titreAvant = null; }
  if (ecouteurFin) { window.removeEventListener("afterprint", ecouteurFin); ecouteurFin = null; }
}

// Imprime `contenu` (le document, déjà construit : un nœud) sous le nom `titre`, qui devient le titre de la page le temps
// d'imprimer et donc le nom du PDF. Rien n'est posé dans la page avant que le conteneur ne soit prêt : un contenu qui n'en est
// pas un fait lever l'erreur avant le moindre effet.
export function imprimerQualiopi(contenu, titre) {
  const conteneur = document.createElement("div");
  conteneur.id = ID_IMPRESSION;
  conteneur.appendChild(contenu);
  teardownQualiopiPrint();
  const format = document.createElement("style");
  format.id = ID_PAGE;
  format.textContent = "@page { size: A4 portrait; margin: 12mm; }";
  document.head.appendChild(format);
  document.body.appendChild(conteneur);
  document.body.classList.add(CLASSE_IMPRESSION);
  titreAvant = document.title;
  document.title = titre;
  ecouteurFin = () => teardownQualiopiPrint();
  window.addEventListener("afterprint", ecouteurFin);
  window.print();
}
