/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Règles du rendu des scènes animées. Module pur (ni DOM ni réseau) : ce que montre
 * l'image, en lecture comme sur une image figée (pas à pas, pause, fin de lecture,
 * animations réduites). Le moteur (js/scene-moteur.js) dessine avec ces fonctions,
 * et les tests (tests/scene-rendu.test.mjs) les vérifient sur les scènes du registre.
 * Le regard du conducteur, lui, est dans js/scene-regard.js.
 *
 * Teintes, clignotant, cadres, repères des étapes, panneaux, facteur de lecture, visibilité du
 * schéma (quand la lecture démarre, quand elle s'interrompt).
 *
 * Toutes les valeurs ci-dessous sont des choix de dessin, sans portée réglementaire.
 */
import { GABARITS, etatActeur, emprise, rectangle, polygonesSeChevauchent } from "./scene-geometrie.js?v=20261005f";

// Teintes de la route réelle (donnée pédagogique), pas la palette de l'app ; la voiture de l'élève prend l'accent de l'app
// pour être repérée d'un coup d'œil.
export const TEINTES = {
  chaussee: "#5D635B", trottoir: "#DAD6CA", ilot: "#B9CB9B", peinture: "#FFFFFF",
  eleve: "#6B7F4E", eleveBord: "#3E4A2D", autre: "#8D97A3", autreBord: "#4E5863",
  pieton: "#2E2E2B", clignotant: "#F4A900", stop: "#D2232A", vitre: "#C9D6DF",
  regard: "#FFD45C", repere: "#1F2924",
  // Trajet prévu de l'élève : teinte claire de celle de sa voiture, opaque, en points ronds. 3,44:1 sur la chaussée
  // (WCAG 1.4.11 : 3:1 pour un graphique utile à la compréhension, tests/scene-rendu.test.mjs). La peinture routière
  // est blanche ou jaune, en traits : des points vert sauge ne passent pas pour un marquage.
  trajet: "#B5C98A",
};

/** Fréquence du clignotant, en hertz. */
export const FREQ_CLIGNOTANT = 1.5;
/** Côté (m) du dessin d'un panneau, centré sur sa position : agrandi pour rester lisible, mais tenu sur le trottoir
 *  (ses quatre coins y restent dans chaque scène, tests/scene-rendu.test.mjs). Au-delà de 1,48 m, un coin des AB3a du
 *  carrefour en croix, posés à 2,5 m du coin de la chaussée, déborderait sur l'arrondi de la bordure. */
export const TAILLE_PANNEAU = 1.4;
/** Rayon (m) du disque d'un repère d'étape (animations réduites) ; ses numéros sont écrits en chasse fixe de 1,2 m. */
export const RAYON_REPERE = 1.2;
// Chasse (m) d'un caractère des numéros d'un repère : 0,6 em d'une police à chasse fixe de 1,2 m (0,72 m), arrondie
// au-dessus pour les polices de repli, et jeu (m) de part et d'autre du texte.
const CHASSE_REPERE = 0.75, JEU_REPERE = 0.3;
/** Distance (m) en deçà de laquelle deux étapes partagent un repère. */
export const ECART_REPERES = 1.5;
/** Jeu (m) entre le flanc droit de la voiture de l'élève et le bord du repère de son étape, posé à sa droite : la voiture
 *  ne cache jamais un repère. */
export const JEU_REPERE_VOITURE = 0.3;
/** Pas (m) dont un repère s'écarte de la voiture quand sa place est prise, et écart supplémentaire maximal (m) à droite du
 *  cap : au-delà, le repère passe à gauche. */
export const PAS_REPERE = 0.1, ALLONGEMENT_MAX_REPERE = 3;
/** Marge (m) du cadre des animations réduites autour de ce qu'il montre. */
export const MARGE_CADRE_REDUIT = 1;

const borner = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * Côté du clignotant dessiné allumé ("droite", "gauche") pour un véhicule dans l'état e (etatActeur) à l'instant donné,
 * ou null. En lecture, il clignote à FREQ_CLIGNOTANT, allumé la première moitié de chaque période, comptée depuis son
 * allumage (`e.clignotantDepuis`) : tout clignotant éclaire dès qu'il s'allume, quel que soit l'instant de la scène, et
 * un instant à peine antérieur à l'allumage (l'état tolère 1e-9 m sur l'abscisse) compte comme l'allumage. Sur une
 * image figée (`fige`), il est dessiné allumé tant qu'il est en marche : l'image montre l'état du clignotant, pas une
 * phase de son clignotement.
 */
export function clignotantAllume(e, instant, fige) {
  if (!e.clignotant) return null;
  const ecoule = Math.max(0, instant - e.clignotantDepuis);
  return fige || Math.floor(ecoule * FREQ_CLIGNOTANT * 2) % 2 === 0 ? e.clignotant : null;
}

/** Cadre de la caméra en lecture, { x, y, largeur, hauteur } (m) : centré sur l'élève dans l'état e, borné au monde.
 *  Sans caméra, le monde entier. */
export function cadreCamera(sc, e) {
  if (!sc.camera) return { x: 0, y: 0, largeur: sc.monde.largeur, hauteur: sc.monde.hauteur };
  const { largeur, hauteur } = sc.camera;
  return { x: borner(e.x - largeur / 2, 0, sc.monde.largeur - largeur), y: borner(e.y - hauteur / 2, 0, sc.monde.hauteur - hauteur),
    largeur, hauteur };
}

// Boîte d'un repère : rectangle englobant de son disque ou de sa pastille.
function boiteRepere(r) {
  const d = demiLargeurRepere(r.numeros);
  return rectangle(r.x - d, r.y - RAYON_REPERE, r.x + d, r.y + RAYON_REPERE);
}

// Bande d'une ligne de marquage : rectangle de la largeur de la ligne, de m.de à m.a.
function bandeLigne(m) {
  const [x0, y0] = m.de, [x1, y1] = m.a, l = Math.hypot(x1 - x0, y1 - y0);
  const px = (-(y1 - y0) / l) * (m.largeur / 2), py = ((x1 - x0) / l) * (m.largeur / 2);
  return [[x0 + px, y0 + py], [x1 + px, y1 + py], [x1 - px, y1 - py], [x0 - px, y0 - py]];
}

/**
 * Repères des étapes (animations réduites), [{ x, y, numeros }] : un par position de l'élève au début d'une étape, sur la
 * perpendiculaire à son cap (celui de sa première étape). Il se pose à droite, au plus près : à la distance qui laisse
 * JEU_REPERE_VOITURE entre le flanc de la voiture et le bord du repère, quel que soit le cap (le disque ou la pastille
 * n'est pas tourné). Si cette place est prise (dessin d'un panneau, ligne de cédez-le-passage, voiture de l'élève au début
 * d'une étape, repère déjà posé) ou hors du monde, il s'écarte par pas de PAS_REPERE, jusqu'à ALLONGEMENT_MAX_REPERE plus
 * loin, puis essaie de même à gauche du cap. Une étape qui commence à moins de ECART_REPERES m de la position d'un repère
 * déjà posé le partage (numéros joints par un point médian).
 */
export function reperesEtapes(sc) {
  const groupes = [];
  sc.etapes.forEach((et, i) => {
    const e = etatActeur(sc.eleve, et.t);
    const proche = groupes.find((g) => Math.hypot(g.e.x - e.x, g.e.y - e.y) < ECART_REPERES);
    if (proche) proche.numeros.push(i + 1); else groupes.push({ e, numeros: [i + 1] });
  });
  const obstacles = sc.decor.panneaux.map((p) => { const r = emprisePanneau(p); return rectangle(r.x, r.y, r.x + r.largeur, r.y + r.hauteur); });
  for (const m of sc.decor.marquages) {
    if (m.type === "ligne" && typeof m.role === "string" && m.role.startsWith("cedez-")) obstacles.push(bandeLigne(m));
  }
  for (const et of sc.etapes) obstacles.push(emprise(sc.eleve.gabarit, etatActeur(sc.eleve, et.t)));
  const libre = (r) => {
    const b = boiteRepere(r);
    const dansLeMonde = b.every(([x, y]) => x >= 0 && x <= sc.monde.largeur && y >= 0 && y <= sc.monde.hauteur);
    return dansLeMonde && !obstacles.some((o) => polygonesSeChevauchent(b, o));
  };
  const demiVoiture = GABARITS[sc.eleve.gabarit].largeur / 2, pas = Math.round(ALLONGEMENT_MAX_REPERE / PAS_REPERE);
  return groupes.map(({ e, numeros }) => {
    const nx = -Math.sin(e.cap), ny = Math.cos(e.cap);     // droite du cap, l'axe y de l'écran allant vers le bas
    const d0 = demiVoiture + JEU_REPERE_VOITURE + demiLargeurRepere(numeros) * Math.abs(nx) + RAYON_REPERE * Math.abs(ny);
    const place = (d) => ({ x: e.x + d * nx, y: e.y + d * ny, numeros });
    let repere = null;
    for (const sens of [1, -1]) {
      for (let k = 0; k <= pas && !repere; k++) {
        const r = place(sens * (d0 + k * PAS_REPERE));
        if (libre(r)) repere = r;
      }
      if (repere) break;
    }
    repere ||= place(d0);                                   // aucune place libre : au plus près à droite (les tests le signalent)
    obstacles.push(boiteRepere(repere));
    return repere;
  });
}

/** Demi-largeur (m) du repère qui porte ces numéros : le disque de RAYON_REPERE pour un seul numéro, une pastille
 *  allongée qui contient tout le texte quand plusieurs étapes partagent le repère (« 5·6·7 »). */
export function demiLargeurRepere(numeros) {
  return Math.max(RAYON_REPERE, (numeros.join("·").length * CHASSE_REPERE) / 2 + JEU_REPERE);
}

/**
 * Cadre fixe des animations réduites, { x, y, largeur, hauteur } (m). Il montre, à MARGE_CADRE_REDUIT près : tous les
 * repères (disques et pastilles compris), le dessin entier de chaque panneau, la voiture de l'élève au début de chaque étape et chaque usager suivi des yeux au début de
 * l'étape qui le suit. Largeur de la caméra (même échelle qu'en lecture), hauteur au moins celle de la caméra, cadre
 * centré sur ce qu'il montre puis borné au monde. Sans caméra, le monde entier.
 */
export function cadreReduit(sc) {
  const { monde, camera } = sc;
  if (!camera) return { x: 0, y: 0, largeur: monde.largeur, hauteur: monde.hauteur };
  const points = [];
  for (const r of reperesEtapes(sc)) {
    const demi = demiLargeurRepere(r.numeros);
    points.push([r.x - demi, r.y - RAYON_REPERE], [r.x + demi, r.y + RAYON_REPERE]);
  }
  for (const p of sc.decor.panneaux) {
    const r = emprisePanneau(p);
    points.push([r.x, r.y], [r.x + r.largeur, r.y + r.hauteur]);
  }
  for (const et of sc.etapes) {
    points.push(...emprise(sc.eleve.gabarit, etatActeur(sc.eleve, et.t)));
    const suivi = et.regard && et.regard.suivre && sc.acteurs.find((a) => a.id === et.regard.suivre);
    if (!suivi) continue;
    const s = etatActeur(suivi, et.t);
    if (s.visible) points.push(...emprise(suivi.gabarit, s));
  }
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const x0 = Math.max(Math.min(...xs) - MARGE_CADRE_REDUIT, 0), x1 = Math.min(Math.max(...xs) + MARGE_CADRE_REDUIT, monde.largeur);
  const y0 = Math.max(Math.min(...ys) - MARGE_CADRE_REDUIT, 0), y1 = Math.min(Math.max(...ys) + MARGE_CADRE_REDUIT, monde.hauteur);
  const largeur = Math.min(camera.largeur, monde.largeur);
  const hauteur = Math.min(Math.max(y1 - y0, camera.hauteur), monde.hauteur);
  return { x: borner((x0 + x1 - largeur) / 2, 0, monde.largeur - largeur), y: borner((y0 + y1 - hauteur) / 2, 0, monde.hauteur - hauteur),
    largeur, hauteur };
}

/** Rectangle { x, y, largeur, hauteur } (m) du dessin d'un panneau posé en (p.x ; p.y) : centré sur sa position. */
export function emprisePanneau(p) {
  return { x: p.x - TAILLE_PANNEAU / 2, y: p.y - TAILLE_PANNEAU / 2, largeur: TAILLE_PANNEAU, hauteur: TAILLE_PANNEAU };
}

/**
 * Facteur de lecture affiché sous le schéma quand la scène ne se joue pas à sa vitesse réelle : { texte, libelle }
 * (« × 0,5 » et sa lecture en clair pour les lecteurs d'écran), ou null à vitesse réelle.
 */
export function facteurLecture(vitesse) {
  if (vitesse === 1) return null;
  const nombre = String(vitesse).replace(".", ",");
  return { texte: "× " + nombre, libelle: `Lecture ${vitesse < 1 ? "ralentie" : "accélérée"} : ${nombre} fois la vitesse réelle` };
}

/** Part visible du schéma (de 0 à 1) à partir de laquelle la première lecture démarre. */
export const SEUIL_DEMARRAGE = 0.6;
/** Seuils de l'observateur de visibilité du schéma : 0, pour être prévenu quand il sort tout à fait de l'écran, et
 *  SEUIL_DEMARRAGE. */
export const SEUILS_VISIBILITE = [0, SEUIL_DEMARRAGE];

/**
 * Ce que fait la lecture quand la part visible du schéma (`rapport`, de 0 à 1) change : "demarrer" la première fois que
 * 60 % au moins du schéma sont visibles, "pause" quand il sort tout à fait de l'écran en pleine lecture, sinon rien
 * (null). Lire les dernières étapes de la liste, sous un schéma à moitié sorti de l'écran, ne l'interrompt donc pas.
 * `dejaVu` : la première lecture a déjà été lancée (automatique ou demandée) ; `enCours` : la lecture tourne.
 */
export function actionVisibilite(rapport, dejaVu, enCours) {
  if (rapport >= SEUIL_DEMARRAGE && !dejaVu) return "demarrer";
  if (rapport <= 0 && enCours) return "pause";
  return null;
}
