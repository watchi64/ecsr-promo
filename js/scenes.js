/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Registre des scènes animées des cours de compétences. Une scène est une
 * DONNÉE : un décor, des acteurs (trajet et profil de vitesse en km/h), des
 * étapes (chacune avec le regard du conducteur, voir scene-regard.js), et les
 * attentes que vérifient les contrôles automatiques (tests/scenes.test.mjs).
 * Règle du chantier : une scène qu'on ne sait pas rendre exacte n'entre pas ici.
 *
 * Chaque entrée : titre ; etapesModele (intitulés que propose l'éditeur : un
 * cours peut les reformuler, pas en changer le nombre) ; sources (ce que montre
 * la scène et d'où cela vient, recopié dans la fiche de vérification du cours) ;
 * construire() (définition calculée une seule fois, puis gelée en profondeur :
 * le moteur, l'éditeur et les tests la partagent sans pouvoir la modifier).
 */
import { KMH, GABARITS, trajet, chronologie, tempsAtteint, premiereAbscisse, emprise, etatActeur, polygonesSeChevauchent }
  from "./scene-geometrie.js?v=20261003c";
import { DESSIN, carrefourEnCroix, giratoire, trajetGiratoire } from "./scene-decors.js?v=20261003c";

const MARGE_ARRET = 0.3;             // m entre la voiture arrêtée et la limite (passage, ligne)
const TOLERANCE_ARRET = 0.7;         // m : écart admis par l'attente arretAvant, mesuré au milieu du pare-chocs
const PIETON_KMH = 4.32;             // 1,2 m/s : allure de marche retenue pour le dessin
const LIMITE_AGGLOMERATION = 50;     // km/h : vitesse qu'aucun véhicule d'une scène d'agglomération ne dépasse

// Gel en profondeur : une écriture dans une définition lève une TypeError (les modules sont en mode strict).
function geler(valeur, vus = new Set()) {
  if (valeur === null || typeof valeur !== "object" || vus.has(valeur)) return valeur;
  vus.add(valeur);
  for (const v of Object.values(valeur)) geler(v, vus);
  return Object.freeze(valeur);
}

function unique(fabrique) {
  let valeur = null;
  return () => (valeur ??= geler(fabrique()));
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

// ===== Tourner à droite en agglomération (fiche ECF C2-E) =====
//
// L'ordre des étapes et ce que regarde le conducteur suivent la fiche ; les valeurs ci-dessous (angles du regard
// compris) sont des choix de dessin, recopiés dans les sources de la scène.
const TOURNER_DROITE = geler({
  branches: { nord: 8, sud: 46, est: 22, ouest: 8 },   // m ; la branche sud porte toute l'approche
  kmh: { approche: 25, virage: 10, sortie: 25 },
  deceleration: 2.0,      // m/s² : pour réduire l'allure avant le virage, puis pour s'arrêter devant le passage
  reprise: 1.5,           // m/s² : accélération au redémarrage
  avanceSerrer: 12,       // m d'avance pendant lesquels la voiture se décale vers la droite
  clignotantDes: 0.5,     // m : abscisse où s'allume le clignotant droit
  duree: { controle: 1.2, angleMort: 1.2 },   // s : rétroviseurs au départ ; angle mort, juste avant l'arc
  regard: { retroviseurs: 165, devant: 0, angleMort: 150, sortie: 40 },   // degrés par rapport au cap, + à droite
  ecartPietonBord: 0.5,   // m du bord du trottoir au centre du piéton : à l'attente (nord) et à l'arrivée (sud)
  reaction: 1.0,          // s entre le pied du piéton sur la chaussée et le début du freinage
  attenteDegagement: 0.6, // s entre le piéton entier sur le trottoir sud et le redémarrage
});

function tournerDroite() {
  const V = TOURNER_DROITE;
  const d = carrefourEnCroix({ branches: V.branches, passages: ["est"] });
  const { cy, bord } = d.reperes;
  const h = DESSIN.voie;
  // Serrer à droite sans se coller au trottoir : le flanc droit reste à DESSIN.margeTrajectoire (0,60 m) de la bordure.
  const serrer = h / 2 - DESSIN.demiLargeurVoiture - DESSIN.margeTrajectoire;    // 0,25 m
  const rond = d.reperes.arrondi.SE;                                              // arrondi de la bordure à suivre
  const xVoie = d.reperes.cx + h / 2;
  const rayon = rond.x - (xVoie + serrer);                                        // virage concentrique : 7,5 m
  const v = { approche: V.kmh.approche * KMH, virage: V.kmh.virage * KMH, sortie: V.kmh.sortie * KMH };

  // Trajet : centre de la voie le temps des contrôles, décalage vers la droite, approche, virage, branche est.
  const t = trajet(xVoie, d.monde.hauteur - DESSIN.retraitBord, -90).droit(v.approche * V.duree.controle);
  const sSerrer = t.longueur;
  t.decaler(serrer, V.avanceSerrer);
  const sRalentir = t.longueur;
  t.droit(t.position.y - rond.y);
  const sVirage = t.longueur;
  t.virage(rayon, 90);
  const sFinVirage = t.longueur;
  t.droit(d.monde.largeur - DESSIN.retraitBord - rond.x);
  const chemin = t.fin();

  // Allure réduite avant le virage, jamais pendant ; l'angle mort se contrôle juste avant l'arc.
  const sAllureVirage = sRalentir + (v.approche ** 2 - v.virage ** 2) / (2 * V.deceleration);
  const sAngleMort = sVirage - v.virage * V.duree.angleMort;
  // Arrêt devant le passage. En remontant le temps à 10 km/h : début du freinage, pied du piéton sur la chaussée
  // (V.reaction plus tôt), mise en marche du piéton (le temps de franchir l'écart entre son emprise et le bord).
  const passage = d.reperes.passages.est;
  const sArret = xMaxAtteint(chemin, passage.x0 - MARGE_ARRET);
  const sFrein = sArret - v.virage ** 2 / (2 * V.deceleration);
  const vPieton = PIETON_KMH * KMH, demiPieton = GABARITS.pieton.longueur / 2;
  const sPied = sFrein - v.virage * V.reaction;
  const sMarche = sPied - (v.virage * (V.ecartPietonBord - demiPieton)) / vPieton;
  const sPleineAllure = sArret + v.sortie ** 2 / (2 * V.reprise);
  const profilSans = [
    { s: 0, kmh: V.kmh.approche }, { s: sRalentir, kmh: V.kmh.approche },
    { s: sAllureVirage, kmh: V.kmh.virage }, { s: sFrein, kmh: V.kmh.virage }, { s: sArret, kmh: 0 },
    { s: sPleineAllure, kmh: V.kmh.sortie }, { s: chemin.longueur, kmh: V.kmh.sortie },
  ];
  const chrono = chronologie(chemin, profilSans);
  const tArrivee = tempsAtteint(chrono, sArret);

  // Le piéton attend sur le trottoir nord, au milieu du passage, puis traverse (R415-11 : la voiture lui cède le
  // passage) jusqu'au trottoir sud ; la voiture repart quand son emprise y est entière (dégagement complet).
  const departPieton = tempsAtteint(chrono, sMarche);
  const yPieton0 = bord.nord - V.ecartPietonBord;
  const cheminPieton = trajet((passage.x0 + passage.x1) / 2, yPieton0, 90)
    .droit(bord.sud - bord.nord + 2 * V.ecartPietonBord).fin();
  const degagement = departPieton + (bord.sud + demiPieton - yPieton0) / vPieton;
  const pause = degagement + V.attenteDegagement - tArrivee;
  const profil = profilSans.map((p) => (p.s === sArret ? { ...p, pause } : p));
  return {
    code: "tourner-droite", titre: "Tourner à droite en agglomération", monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil,
        clignotant: [{ cote: "droite", de: V.clignotantDes, a: sFinVirage }] },
      { id: "pieton", gabarit: "pieton", chemin: cheminPieton, depart: departPieton,
        profil: [{ s: 0, kmh: PIETON_KMH }, { s: cheminPieton.longueur, kmh: PIETON_KMH }] },
    ],
    etapes: [
      { s: 0, regard: { angle: V.regard.retroviseurs } },
      { s: sSerrer, regard: { angle: V.regard.devant } },
      { s: sRalentir, regard: { angle: V.regard.devant } },
      { s: sAllureVirage, regard: { balayage: true } },
      { s: sAngleMort, regard: { angle: V.regard.angleMort } },
      { s: sVirage, regard: { angle: V.regard.sortie } },
      { s: sMarche, regard: { suivre: "pieton" } },
      { s: sArret, delai: pause, regard: { angle: V.regard.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "voie de droite, branche sud", zone: d.voies.sudEntrante, de: 0, a: sVirage, emprise: true },
      { type: "dans", acteur: "eleve", nom: "voie de droite, branche est", zone: d.voies.estSortante, de: sFinVirage, a: chemin.longueur, emprise: true },
      { type: "arretAvant", acteur: "eleve", nom: "passage piéton", point: [passage.x0, cy], normale: [-1, 0], tolerance: TOLERANCE_ARRET },
      { type: "cede", acteur: "eleve", autre: "pieton", nom: "passage piéton, voie de l'élève", zone: passage.zoneSortante },
    ],
  };
}

export const SCENES = {
  "tourner-droite": {
    titre: "Tourner à droite en agglomération",
    etapesModele: [
      "Contrôler et mettre le clignotant",
      "Serrer à droite, sans se coller au trottoir",
      "Réduire l'allure avant le virage",
      "Balayer l'intersection du regard",
      "Contrôler l'angle mort droit",
      "Tourner en regardant la sortie",
      "Céder le passage au piéton",
      "Repartir une fois le passage dégagé",
    ],
    sources: [
      "Avertir les autres usagers avant de changer de direction (clignotant) : R412-10.",
      "Serrer le bord droit de la chaussée avant de quitter la route sur sa droite : R415-3 I. Sans se coller au trottoir, pour laisser de la place à un vélo : fiche ECF C2-E.",
      "Céder le passage, au besoin en s'arrêtant, au piéton qui s'engage dans la traversée ou manifeste clairement l'intention de traverser : R415-11.",
      "Rester constamment maître de sa vitesse et la régler selon les difficultés de la circulation et les obstacles prévisibles : R413-17 II. La réduire avant le virage et non pendant : fiche ECF C2-E.",
      "Marquage : unité u de 5 cm, modulations T'1 (traits de 1,50 m, vides de 5 m) et T'2 (traits et vides de 0,50 m) : IISR 7e partie, art. 113-1 ; axiale T'1 de largeur 2u, admise en agglomération, et ligne de cédez-le-passage T'2 de 0,50 m de large : art. 113-2 ; cette ligne s'étend sur toute la largeur de la voie entrante, de l'axe jusqu'à la bordure, marque la limite de la chaussée prioritaire et est précédée d'une axiale continue de largeur 2u sur 10 à 20 m (15 m retenus) : art. 117-4 B ; passage piéton de bandes de 0,50 m, espacées de 0,50 m (0,50 à 0,80 m admis) et longues de 2,50 m (minimum en ville), axiale interrompue à 0,50 m de part et d'autre : art. 118.",
      "Étapes et regards : d'après la fiche ECF C2-E (classeur de Timy), dont le clignotant maintenu jusqu'à la fin du virage et l'attente du dégagement complet du piéton.",
      "Choix de dessin, sans portée réglementaire : voies de 3,5 m ; arrondi de bordure de 6 m ; passage piéton à 0,5 m de la fin de l'arrondi ; axe nord-sud prioritaire (cédez-le-passage sur les branches est et ouest) ; branches de 8 m au nord et à l'ouest, 46 m au sud, 22 m à l'est ; départ au centre de la voie, décalage de 0,25 m vers la droite sur 12 m (flanc droit à 0,60 m de la bordure), virage de 7,5 m de rayon concentrique à la bordure ; 25 km/h en approche et en sortie, 10 km/h avant et dans le virage ; décélérations de 2,0 m/s², accélération de 1,5 m/s² au redémarrage ; regard, par rapport à l'axe de la voiture : 165 degrés à droite pendant 1,2 s (rétroviseur droit et arrière droit), balayage de 75 degrés de part et d'autre (un aller-retour en 2 s) pendant au moins 2 s, 150 degrés à droite pendant 1,2 s (angle mort), 40 degrés à droite dans le virage (sortie) ; clignotant dès 0,5 m de trajet ; piéton à 1,2 m/s, qui attend à 0,5 m du bord nord et s'arrête à 0,5 m du bord sud ; temps de réaction de 1,0 s ; redémarrage 0,6 s après le dégagement complet du piéton ; arrêt à 0,3 m du passage ; panneaux agrandis pour rester lisibles.",
    ],
    construire: unique(tournerDroite),
  },
};
