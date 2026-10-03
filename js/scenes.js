/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Registre des scènes animées des cours de compétences. Une scène est une
 * DONNÉE : un décor, des acteurs (trajet et profil de vitesse en km/h), des
 * étapes, et les attentes que vérifient les contrôles automatiques
 * (tests/scenes.test.mjs). Règle du chantier : une scène qu'on ne sait pas
 * rendre exacte n'entre pas ici.
 *
 * Chaque entrée : titre ; etapesModele (intitulés que propose l'éditeur : un
 * cours peut les reformuler, pas en changer le nombre) ; sources (ce que montre
 * la scène et d'où cela vient, recopié dans la fiche de vérification du cours) ;
 * construire() (définition calculée une seule fois).
 */
import { KMH, trajet, chronologie, tempsAtteint, premiereAbscisse, emprise, etatActeur, polygonesSeChevauchent }
  from "./scene-geometrie.js?v=20261003c";
import { DESSIN, carrefourEnCroix, giratoire, trajetGiratoire } from "./scene-decors.js?v=20261003c";

const MARGE_ARRET = 0.3;    // m entre la voiture arrêtée et la limite (passage, ligne)
const PIETON_KMH = 4.32;    // 1,2 m/s : allure de marche retenue pour le dessin

function unique(fabrique) {
  let valeur = null;
  return () => (valeur ??= fabrique());
}

// Première abscisse où l'emprise de la voiture atteint une limite.
const xMaxAtteint = (chemin, limite) =>
  premiereAbscisse(chemin, (p) => Math.max(...emprise("voiture", p).map(([x]) => x)) >= limite);
const yMinAtteint = (chemin, limite) =>
  premiereAbscisse(chemin, (p) => Math.min(...emprise("voiture", p).map(([, y]) => y)) <= limite);

// Dernier instant où l'emprise d'un acteur parti à t = 0 touche une zone.
function derniereSortie(acteur, zone) {
  const a = { ...acteur, chrono: chronologie(acteur.chemin, acteur.profil), depart: 0 };
  let derniere = null;
  for (let t = 0; t <= a.chrono.duree + 1e-9; t += 0.05) {
    if (polygonesSeChevauchent(emprise(a.gabarit, etatActeur(a, t)), zone)) derniere = t;
  }
  if (derniere === null) throw new Error(`${acteur.id} ne traverse pas la zone de conflit`);
  return derniere;
}

function tournerDroite() {
  const d = carrefourEnCroix({ branches: { nord: 8, sud: 26, est: 22, ouest: 8 }, passages: ["est"] });
  const { cx, cy } = d.reperes;
  const h = DESSIN.voie;
  const serrer = 0.45;                             // R415-3 I : serrer le bord droit
  const rond = d.reperes.arrondi.SE;               // arrondi de la bordure à suivre
  const xVoie = cx + h / 2, xSerre = xVoie + serrer;
  const rayon = rond.x - xSerre;                   // virage concentrique à la bordure : 7,3 m
  const yDepart = d.monde.hauteur - 0.5;
  const t = trajet(xVoie, yDepart, -90).droit(4).decaler(serrer, 6);
  t.droit(t.position.y - rond.y);
  const sVirage = t.longueur;
  t.virage(rayon, 90);
  const sFinVirage = t.longueur;
  t.droit(d.monde.largeur - 0.5 - rond.x);
  const chemin = t.fin();
  const passage = d.reperes.passages.est;
  const sArret = xMaxAtteint(chemin, passage.x0 - MARGE_ARRET);
  const profilSans = [
    { s: 0, kmh: 25 }, { s: 11, kmh: 25 }, { s: sVirage, kmh: 15 },
    { s: sArret, kmh: 0 }, { s: sFinVirage + 4, kmh: 15 }, { s: chemin.longueur, kmh: 25 },
  ];
  const tArrivee = tempsAtteint(chronologie(chemin, profilSans), sArret);
  // Le piéton attend au bord du trottoir nord, s'engage 3,5 s avant l'arrêt de la
  // voiture et traverse jusqu'au trottoir sud (R415-11 : la voiture lui cède le passage).
  const xPieton = (passage.x0 + passage.x1) / 2;
  const yPieton0 = cy - h - 1.5;
  const cheminPieton = trajet(xPieton, yPieton0, 90).droit(2 * h + 3).fin();
  const departPieton = tArrivee - 3.5;
  if (departPieton < 0) throw new Error("tourner-droite : allonger la branche sud");
  const liberation = departPieton + (cy + h + 0.25 - yPieton0) / (PIETON_KMH * KMH);
  const pause = liberation - tArrivee + 0.6;
  const profil = profilSans.map((p) => (p.s === sArret ? { ...p, pause } : p));
  return {
    code: "tourner-droite", titre: "Tourner à droite en agglomération", monde: d.monde, limite: 50, decor: d,
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil,
        clignotant: [{ cote: "droite", de: 0.5, a: sFinVirage }] },
      { id: "pieton", gabarit: "pieton", chemin: cheminPieton, depart: departPieton,
        profil: [{ s: 0, kmh: PIETON_KMH }, { s: cheminPieton.longueur, kmh: PIETON_KMH }] },
    ],
    etapes: [
      { s: 0 },
      { s: 4 },
      { s: 11 },
      { s: 15, regard: { balayage: true } },
      { s: sVirage, regard: { angle: 60 } },
      { s: sArret, regard: { suivre: "pieton" } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "voie de droite, branche sud", zone: d.voies.sudEntrante, de: 0, a: sVirage, emprise: true },
      { type: "dans", acteur: "eleve", nom: "voie de droite, branche est", zone: d.voies.estSortante, de: sFinVirage, a: chemin.longueur, emprise: true },
      { type: "arretAvant", acteur: "eleve", nom: "passage piéton", point: [passage.x0, cy], normale: [-1, 0], tolerance: 0.7 },
      { type: "cede", acteur: "eleve", autre: "pieton", nom: "passage piéton, voie de l'élève", zone: passage.zoneSortante },
    ],
  };
}

export const SCENES = {
  "tourner-droite": {
    titre: "Tourner à droite en agglomération",
    etapesModele: [
      "Contrôle et clignotant", "Serrer à droite", "Adapter l'allure",
      "Balayer du regard", "Tourner", "Céder le passage au piéton",
    ],
    sources: [
      "Avertir avant de changer de direction (clignotant) : R412-10.",
      "Serrer le bord droit de la chaussée avant de tourner à droite : R415-3 I.",
      "Céder le passage au piéton engagé dans la traversée : R415-11.",
      "Rester maître de sa vitesse : R413-17 II.",
      "Marquage : axiale T'1 (1,5 m / 5 m), ligne de cédez-le-passage T'2 de 0,50 m précédée de 15 m d'axiale continue, passage piéton (bandes de 0,50 m, intervalles de 0,50 m, 2,50 m de long), axiale interrompue à 0,50 m du passage : IISR 7e partie, art. 113-2, 117-4 et 118.",
      "Étapes : procédure enseignée à l'ECF (classeur de Timy, compétence 2, partie E).",
      "Choix de dessin, sans portée réglementaire : voies de 3,5 m, arrondi de bordure de 6 m, 25 km/h en approche et 15 km/h dans le virage, piéton à 1,2 m/s, panneaux agrandis pour rester lisibles.",
    ],
    construire: unique(tournerDroite),
  },
};
