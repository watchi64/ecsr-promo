/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Schémas de marquage au sol.
 *
 * Une marque sur chaussée n'a pas de pictogramme : ce qui s'apprend, c'est la
 * MODULATION, le rapport entre la longueur du trait et celle de l'intervalle.
 * Chaque bande est donc dessinée à l'échelle de son propre cycle : deux cycles
 * occupent toujours la même largeur, ce qui rend la part de peinture
 * directement comparable d'une modulation à l'autre.
 *
 * Les valeurs viennent de nos cours contrôlés (thème 02, IISR 7e partie) :
 * aucune n'est estimée ici.
 */

const NS_MARQUAGE = "http://www.w3.org/2000/svg";
const ASPHALTE = "#4A4F49";
const PEINTURE = "#FFFFFF";
const COTE = "#8A9486";

// Gabarit de dessin : deux cycles sur 240 unités de large.
const LARGEUR = 240;
const HAUTEUR = 54;
const CYCLES = 2;

function fmt(n) {
  return String(n).replace(".", ",");
}

/**
 * Bande de chaussée portant une ligne discontinue.
 * trait et intervalle sont en mètres ; le dessin conserve leur rapport exact.
 */
function bandeDiscontinue(trait, intervalle) {
  const cycle = trait + intervalle;
  const pas = LARGEUR / CYCLES;
  const plein = pas * (trait / cycle);
  const y = HAUTEUR / 2 - 4;
  let marques = "";
  for (let i = 0; i < CYCLES; i++) {
    marques += `<rect x="${(i * pas).toFixed(1)}" y="${y}" width="${plein.toFixed(1)}" height="8" fill="${PEINTURE}"/>`;
  }
  // Cotation : le trait, puis l'intervalle.
  const cotes = `
    <g stroke="${COTE}" stroke-width="1" fill="none">
      <line x1="0" y1="${y + 14}" x2="${plein.toFixed(1)}" y2="${y + 14}"/>
      <line x1="${plein.toFixed(1)}" y1="${y + 14}" x2="${pas.toFixed(1)}" y2="${y + 14}"/>
      <line x1="0" y1="${y + 11}" x2="0" y2="${y + 17}"/>
      <line x1="${plein.toFixed(1)}" y1="${y + 11}" x2="${plein.toFixed(1)}" y2="${y + 17}"/>
      <line x1="${pas.toFixed(1)}" y1="${y + 11}" x2="${pas.toFixed(1)}" y2="${y + 17}"/>
    </g>
    <text x="${(plein / 2).toFixed(1)}" y="${y + 26}" text-anchor="middle" fill="${COTE}"
          font-family="Geist Mono, ui-monospace, monospace" font-size="9">${fmt(trait)} m</text>
    <text x="${(plein + (pas - plein) / 2).toFixed(1)}" y="${y + 26}" text-anchor="middle" fill="${COTE}"
          font-family="Geist Mono, ui-monospace, monospace" font-size="9">${fmt(intervalle)} m</text>`;
  return `<rect x="0" y="0" width="${LARGEUR}" height="${HAUTEUR}" fill="${ASPHALTE}" rx="3"/>${marques}${cotes}`;
}

function bandeContinue() {
  const y = HAUTEUR / 2 - 4;
  return `
    <rect x="0" y="0" width="${LARGEUR}" height="${HAUTEUR}" fill="${ASPHALTE}" rx="3"/>
    <rect x="0" y="${y}" width="${LARGEUR}" height="8" fill="${PEINTURE}"/>`;
}

// Ligne mixte : une continue doublée d'une discontinue. Le conducteur du côté
// de la discontinue peut franchir, l'autre non.
function bandeMixte() {
  const cycle = 3 + 1.33;
  const pas = LARGEUR / 4;
  const plein = pas * (3 / cycle);
  let pointilles = "";
  for (let i = 0; i < 4; i++) {
    pointilles += `<rect x="${(i * pas).toFixed(1)}" y="${HAUTEUR / 2 + 2}" width="${plein.toFixed(1)}" height="7" fill="${PEINTURE}"/>`;
  }
  return `
    <rect x="0" y="0" width="${LARGEUR}" height="${HAUTEUR}" fill="${ASPHALTE}" rx="3"/>
    <rect x="0" y="${HAUTEUR / 2 - 9}" width="${LARGEUR}" height="7" fill="${PEINTURE}"/>
    ${pointilles}`;
}

export const MARQUAGES = {
  T1: {
    nom: "T1", detail: "Axiale ou délimitation de voies",
    mesure: "3 m de trait, 10 m d'intervalle",
    dessin: () => bandeDiscontinue(3, 10),
  },
  T2: {
    nom: "T2", detail: "Ligne de rive des routes",
    mesure: "3 m de trait, 3,5 m d'intervalle",
    dessin: () => bandeDiscontinue(3, 3.5),
  },
  T3: {
    nom: "T3", detail: "Ligne de dissuasion",
    mesure: "3 m de trait, 1,33 m d'intervalle",
    dessin: () => bandeDiscontinue(3, 1.33),
  },
  "T'3": {
    nom: "T'3", detail: "Rive de bande d'arrêt d'urgence",
    mesure: "39 m de trait, 13 m d'intervalle",
    dessin: () => bandeDiscontinue(39, 13),
  },
  continue: {
    nom: "Ligne continue", detail: "Franchissement interdit",
    mesure: "Aucun intervalle",
    dessin: bandeContinue,
  },
  mixte: {
    nom: "Ligne mixte", detail: "Continue doublée d'une discontinue",
    mesure: "Franchissable du côté de la discontinue",
    dessin: bandeMixte,
  },
};

/** Le code correspond-il à un schéma de marquage disponible ? */
export function marquageConnu(code) {
  return Object.prototype.hasOwnProperty.call(MARQUAGES, code);
}

/** Carte d'une modulation : la bande à l'échelle, son nom et sa mesure. */
export function carteMarquage(code) {
  const m = MARQUAGES[code];
  if (!m) return null;
  const svg = document.createElementNS(NS_MARQUAGE, "svg");
  svg.setAttribute("xmlns", NS_MARQUAGE);
  svg.setAttribute("viewBox", `0 0 ${LARGEUR} ${HAUTEUR}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", m.nom + " : " + m.detail);
  svg.classList.add("marquage-svg");
  svg.innerHTML = m.dessin();

  const fig = document.createElement("figure");
  fig.className = "marquage-card";
  fig.appendChild(svg);
  const cap = document.createElement("figcaption");
  cap.className = "marquage-cap";
  const n = document.createElement("span");
  n.className = "marquage-nom";
  n.textContent = m.nom;
  const d = document.createElement("span");
  d.className = "marquage-detail";
  d.textContent = m.detail;
  const s = document.createElement("span");
  s.className = "marquage-mesure";
  s.textContent = m.mesure;
  cap.appendChild(n);
  cap.appendChild(d);
  cap.appendChild(s);
  fig.appendChild(cap);
  return fig;
}
