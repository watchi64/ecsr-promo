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
import { KMH, DEG, GABARITS, trajet, chronologie, tempsAtteint, premiereAbscisse, pointA, emprise, etatActeur,
  polygonesSeChevauchent, pointDansPolygone } from "./scene-geometrie.js?v=20261005f";
import { DESSIN, HORS_MONDE, carrefourEnCroix, giratoire, trajetGiratoire, rue } from "./scene-decors.js?v=20261005f";
import { REGARD_PORTEE, REGARD_DUREE_TOUR_MIN, oeil, regardContient } from "./scene-regard.js?v=20261005f";
import { SEUILS } from "./scene-controles.js?v=20261005f";

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
// Première abscisse où l'emprise de la voiture est entièrement passée à l'ouest d'une limite (x < limite).
const xMaxSous = (chemin, limite) =>
  premiereAbscisse(chemin, (p) => Math.max(...emprise("voiture", p).map(([x]) => x)) < limite);

// Le même trajet privé de ses `longueur` premiers mètres, pris sur sa première ligne droite : le tracé ne change pas, le
// départ avance, et les abscisses repères (trajetGiratoire) reculent d'autant.
function raccourcirDebut({ chemin, s }, longueur) {
  const [premier, ...suite] = chemin.segments;
  if (premier.type !== "droite" || !(longueur > 0 && longueur < premier.longueur)) {
    throw new Error(`raccourcirDebut : impossible de retirer ${longueur} m d'un trajet qui commence par ${premier.longueur} m de ${premier.type}`);
  }
  const segments = [
    { ...premier, x0: premier.x0 + Math.cos(premier.cap) * longueur, y0: premier.y0 + Math.sin(premier.cap) * longueur,
      longueur: premier.longueur - longueur },
    ...suite.map((seg) => ({ ...seg, debut: seg.debut - longueur })),
  ];
  return {
    chemin: { segments, longueur: chemin.longueur - longueur },
    s: Object.fromEntries(Object.entries(s).map(([cle, abscisse]) => [cle, abscisse - longueur])),
  };
}

// Dernier instant où l'emprise d'un acteur parti à t = 0 touche une zone : relevé tous les 5 centièmes de seconde, puis
// précisé par dichotomie, au dix-millième de seconde, sur l'instant où l'emprise quitte la zone.
function derniereSortie(acteur, zone) {
  const a = { ...acteur, chrono: chronologie(acteur.chemin, acteur.profil), depart: 0 };
  const touche = (t) => polygonesSeChevauchent(emprise(a.gabarit, etatActeur(a, t)), zone);
  let derniere = null;
  for (let t = 0; t <= a.chrono.duree + 1e-9; t += 0.05) {
    if (touche(t)) derniere = t;
  }
  if (derniere === null) throw new Error(`${acteur.id} ne traverse pas la zone de conflit`);
  let dedans = derniere, dehors = Math.min(derniere + 0.05, a.chrono.duree);
  if (touche(dehors)) return dehors;
  while (dehors - dedans > 1e-4) {
    const milieu = (dedans + dehors) / 2;
    if (touche(milieu)) dedans = milieu; else dehors = milieu;
  }
  return dedans;
}

// ===== Tourner à droite en agglomération (fiche ECF C2-E) =====
//
// L'ordre des étapes et ce que regarde le conducteur suivent la fiche ; les valeurs ci-dessous (angles du regard
// compris) sont des choix de dessin, recopiés dans les sources de la scène.
const TOURNER_DROITE = geler({
  // m ; la branche sud porte le recul du départ (REGARD_PORTEE) et l'approche : le plus petit nombre entier de
  // mètres qui loge les durées ci-dessous avec le balayage à 10 km/h.
  branches: { nord: 8, sud: 67, est: 22, ouest: 8 },
  hauteurCadre: 46,           // m : cadre qui suit l'élève, sur toute la largeur du monde, sans changer l'échelle
  kmh: { approche: 25, virage: 10, sortie: 25 },
  ralentissement: 2.0,        // m/s² : pour réduire l'allure avant le virage
  reprise: 1.5,               // m/s² : accélération au redémarrage
  avanceSerrer: 12,           // m d'avance pendant lesquels la voiture se décale vers la droite
  // s à l'écran : coup d'œil aux rétroviseurs ; balayage, puis angle mort, au plus près de l'intersection ; regard
  // vers la sortie dans l'arc, avant de suivre le piéton et de freiner. indication : le clignotant s'allume ce temps
  // avant la fin du coup d'œil, dans sa seconde moitié (contrôler, puis indiquer, sous l'intitulé de l'étape 1).
  duree: { retroviseurs: 1.2, indication: 0.5, balayage: 2.0, angleMort: 1.0, sortie: 1.0 },
  regard: { retroviseurs: 170, devant: 0, angleMort: 120, sortie: 40 },   // degrés par rapport au cap, + à droite
  ecartPietonBord: 0.5,       // m du bord du trottoir au centre du piéton : à l'attente (nord) et à l'arrivée (sud)
  engagementAvantArret: 0.5,  // s : le piéton se met en marche quand la voiture est sur le point de s'arrêter
  attenteDegagement: 0.6,     // s entre le piéton entier sur le trottoir sud et le redémarrage
});

function tournerDroite() {
  const choix = TOURNER_DROITE;
  const d = carrefourEnCroix({ branches: choix.branches, passages: ["est"] });
  const { cy, bord } = d.reperes;
  const h = DESSIN.voie;
  // Serrer à droite sans se coller au trottoir : le flanc droit reste à DESSIN.margeTrajectoire (0,60 m) de la bordure.
  const serrer = h / 2 - DESSIN.demiLargeurVoiture - DESSIN.margeTrajectoire;    // 0,25 m
  const rond = d.reperes.arrondi.SE;                                              // arrondi de la bordure à suivre
  const xVoie = d.reperes.cx + h / 2;
  const rayon = rond.x - (xVoie + serrer);                                        // virage concentrique : 7,5 m
  const vitesse = { approche: choix.kmh.approche * KMH, virage: choix.kmh.virage * KMH, sortie: choix.kmh.sortie * KMH };

  // Trajet : départ à REGARD_PORTEE du bord bas (le cône des rétroviseurs, tourné vers l'arrière, tient dans le
  // monde), centre de la voie le temps du coup d'œil, décalage vers la droite, approche, virage, branche est.
  const t = trajet(xVoie, d.monde.hauteur - REGARD_PORTEE, -90).droit(vitesse.approche * choix.duree.retroviseurs);
  const sSerrer = t.longueur;      // fin du coup d'œil aux rétroviseurs, début du décalage
  const sClignotant = vitesse.approche * (choix.duree.retroviseurs - choix.duree.indication);
  t.decaler(serrer, choix.avanceSerrer);
  const sRalentir = t.longueur;
  t.droit(t.position.y - rond.y);
  const sVirage = t.longueur;
  t.virage(rayon, 90);
  const sFinVirage = t.longueur;
  t.droit(d.monde.largeur - DESSIN.retraitBord - rond.x);
  const chemin = t.fin();

  // Allure réduite avant le virage, jamais pendant ; balayage puis angle mort au plus près de l'intersection, l'angle
  // mort juste avant l'arc.
  const sAllureVirage = sRalentir + (vitesse.approche ** 2 - vitesse.virage ** 2) / (2 * choix.ralentissement);
  const sAngleMort = sVirage - vitesse.virage * choix.duree.angleMort;
  const sBalayage = sAngleMort - vitesse.virage * choix.duree.balayage;
  // Anticipation (R415-11, piéton qui manifeste l'intention de traverser) : peu après l'entrée dans l'arc, le
  // conducteur suit du regard le piéton qui attend et freine doucement jusqu'à l'arrêt, l'avant à MARGE_ARRET du
  // passage ; la décélération en découle (0,57 m/s²).
  const passage = d.reperes.passages.est;
  const sArret = xMaxAtteint(chemin, passage.x0 - MARGE_ARRET);
  const sFrein = sVirage + vitesse.virage * choix.duree.sortie;
  const sPleineAllure = sArret + vitesse.sortie ** 2 / (2 * choix.reprise);
  const profilSans = [
    { s: 0, kmh: choix.kmh.approche }, { s: sRalentir, kmh: choix.kmh.approche },
    { s: sAllureVirage, kmh: choix.kmh.virage }, { s: sFrein, kmh: choix.kmh.virage }, { s: sArret, kmh: 0 },
    { s: sPleineAllure, kmh: choix.kmh.sortie }, { s: chemin.longueur, kmh: choix.kmh.sortie },
  ];
  const tArrivee = tempsAtteint(chronologie(chemin, profilSans), sArret);

  // Le piéton attend sur le trottoir nord, au milieu du passage ; il se met en marche quand la voiture est sur le
  // point de s'arrêter et traverse jusqu'au trottoir sud ; la voiture repart quand son emprise y est entière
  // (dégagement complet).
  const vPieton = PIETON_KMH * KMH, demiPieton = GABARITS.pieton.longueur / 2;
  const departPieton = tArrivee - choix.engagementAvantArret;
  const yPieton0 = bord.nord - choix.ecartPietonBord;
  const cheminPieton = trajet((passage.x0 + passage.x1) / 2, yPieton0, 90)
    .droit(bord.sud - bord.nord + 2 * choix.ecartPietonBord).fin();
  const degagement = departPieton + (bord.sud + demiPieton - yPieton0) / vPieton;
  const pause = degagement + choix.attenteDegagement - tArrivee;
  const profil = profilSans.map((p) => (p.s === sArret ? { ...p, pause } : p));
  return {
    code: "tourner-droite", titre: "Tourner à droite en agglomération", monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: choix.hauteurCadre },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil,
        clignotant: [{ cote: "droite", de: sClignotant, a: sFinVirage }] },
      { id: "pieton", gabarit: "pieton", chemin: cheminPieton, depart: departPieton,
        profil: [{ s: 0, kmh: PIETON_KMH }, { s: cheminPieton.longueur, kmh: PIETON_KMH }] },
    ],
    etapes: [
      { s: 0, regard: { angle: choix.regard.retroviseurs } },
      { s: sSerrer, regard: { angle: choix.regard.devant } },
      { s: sRalentir, regard: { angle: choix.regard.devant } },
      { s: sBalayage, regard: { balayage: true } },
      { s: sAngleMort, regard: { angle: choix.regard.angleMort } },
      { s: sVirage, regard: { angle: choix.regard.sortie } },
      { s: sFrein, regard: { suivre: "pieton" } },
      { s: sArret, delai: pause, regard: { angle: choix.regard.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "voie de droite, branche sud", zone: d.voies.sudEntrante, de: 0, a: sVirage, emprise: true },
      { type: "dans", acteur: "eleve", nom: "voie de droite, branche est", zone: d.voies.estSortante, de: sFinVirage, a: chemin.longueur, emprise: true },
      { type: "arretAvant", acteur: "eleve", nom: "passage piéton", point: [passage.x0, cy], normale: [-1, 0], tolerance: TOLERANCE_ARRET },
      { type: "cede", acteur: "eleve", autre: "pieton", nom: "passage piéton, voie de l'élève", zone: passage.zoneSortante },
    ],
  };
}

// ===== Tourner à gauche en agglomération (fiche ECF C2-E) =====
//
// Comme pour tourner à droite : l'ordre des étapes, ce que regarde le conducteur et la trajectoire suivent la fiche ;
// les valeurs ci-dessous (angles du regard compris) sont des choix de dessin, recopiés dans les sources de la scène.
const TOURNER_GAUCHE = geler({
  // m ; la branche sud porte le recul du départ (REGARD_PORTEE) et l'approche : le plus petit nombre entier de mètres
  // qui loge les durées ci-dessous avec le balayage à 8 km/h. Nord, est et ouest : longueurs du plan ; la branche nord
  // laisse le véhicule d'en face partir hors du monde avant que l'élève ralentisse pour lui, et la branche ouest fait
  // finir l'élève 1,5 s après la disparition de ce véhicule (l'image n'est jamais figée sur un véhicule qui roule).
  branches: { nord: 18, sud: 58, est: 8, ouest: 20 },
  hauteurCadre: 46,           // m : cadre qui suit l'élève, sur toute la largeur du monde, sans changer l'échelle
  // km/h ; allure réduite de 8 km/h : au début du freinage pour céder, le véhicule d'en face est déjà dans le cadre, son
  // centre dans le cône.
  kmh: { approche: 25, reduite: 8, virage: 10, sortie: 25, enFace: 30 },
  ralentissement: 2.0,        // m/s² : pour réduire l'allure, puis pour s'arrêter et céder le passage
  reprise: 1.5,               // m/s² : accélération au redémarrage, dans l'arc puis dans la branche ouest
  avanceSerrer: 12,           // m d'avance pendant lesquels la voiture se décale vers la gauche
  ecartAxe: 0.25,             // m entre le flanc gauche et l'axe médian : près de l'axe, sans le dépasser
  // m : rayon du virage, le plus petit retenu (braquage d'une citadine). L'arc part de l'attente et finit au centre de la
  // voie de sortie ouest : ce rayon place l'avant de la voiture, à l'attente, à 0,10 m de la hauteur du centre de
  // l'intersection, et le point central à 0,33 m à gauche du centre de la voiture au plus près (ne pas couper le virage).
  rayonVirage: 4.1,
  // s à l'écran : coup d'œil aux rétroviseurs ; balayage, juste avant le freinage pour le véhicule d'en face ; angle mort,
  // à l'arrêt. indication : le clignotant s'allume ce temps avant la fin du coup d'œil (contrôler, puis indiquer, sous
  // l'intitulé de l'étape 1).
  duree: { retroviseurs: 1.2, indication: 0.5, balayage: 2.0, angleMort: 1.2 },
  regard: { retroviseurs: -170, devant: 0, angleMort: -120, sortie: -40 },   // degrés par rapport au cap, - à gauche
  entreeEnFace: 0.3,          // s entre l'arrêt de l'élève et l'entrée du véhicule d'en face dans le carrefour
  apresPassage: 0.4,          // s entre la sortie du véhicule d'en face de la zone de conflit et le contrôle de l'angle mort
});

function tournerGauche() {
  const choix = TOURNER_GAUCHE;
  const d = carrefourEnCroix({ branches: choix.branches, passages: ["ouest"] });
  const { cx, cy, bord } = d.reperes;
  const h = DESSIN.voie, demiLongueur = GABARITS.voiture.longueur / 2;
  // Serrer à gauche sans dépasser l'axe médian (R415-4 I et II) : le flanc gauche finit à ecartAxe (0,25 m) de l'axe.
  const serrer = h / 2 - DESSIN.demiLargeurVoiture - choix.ecartAxe;            // 0,60 m
  const xVoie = cx + h / 2;
  // L'arc finit au centre de la voie de sortie ouest (y = cy - h / 2) : il commence rayonVirage plus au sud, à l'attente.
  const yVirage = cy - h / 2 + choix.rayonVirage;
  const vitesse = {
    approche: choix.kmh.approche * KMH, reduite: choix.kmh.reduite * KMH, virage: choix.kmh.virage * KMH,
    sortie: choix.kmh.sortie * KMH, enFace: choix.kmh.enFace * KMH,
  };

  // Trajet : départ à REGARD_PORTEE du bord bas (le cône des rétroviseurs, tourné vers l'arrière, tient dans le
  // monde), centre de la voie le temps du coup d'œil, décalage vers la gauche, approche jusqu'à l'attente, virage,
  // branche ouest.
  const t = trajet(xVoie, d.monde.hauteur - REGARD_PORTEE, -90).droit(vitesse.approche * choix.duree.retroviseurs);
  const sSerrer = t.longueur;      // fin du coup d'œil aux rétroviseurs, début du décalage
  const sClignotant = vitesse.approche * (choix.duree.retroviseurs - choix.duree.indication);
  t.decaler(-serrer, choix.avanceSerrer);
  const sRalentir = t.longueur;
  t.droit(t.position.y - yVirage);
  const sVirage = t.longueur;      // attente, puis début de l'arc
  t.virage(choix.rayonVirage, -90);
  const sFinVirage = t.longueur;
  t.droit(t.position.x - DESSIN.retraitBord);
  const chemin = t.fin();

  // Allure réduite avant l'intersection ; balayage dans les 2 s qui précèdent le freinage jusqu'à l'attente ; reprise
  // jusqu'à 10 km/h dans l'arc (jamais de freinage dans le virage), puis jusqu'à 25 km/h dans la branche ouest.
  const sAllureReduite = sRalentir + (vitesse.approche ** 2 - vitesse.reduite ** 2) / (2 * choix.ralentissement);
  const sFrein = sVirage - vitesse.reduite ** 2 / (2 * choix.ralentissement);
  const sBalayage = sFrein - vitesse.reduite * choix.duree.balayage;
  const sAllureVirage = sVirage + vitesse.virage ** 2 / (2 * choix.reprise);
  const sPleineAllure = sFinVirage + (vitesse.sortie ** 2 - vitesse.virage ** 2) / (2 * choix.reprise);
  const profilSans = [
    { s: 0, kmh: choix.kmh.approche }, { s: sRalentir, kmh: choix.kmh.approche },
    { s: sAllureReduite, kmh: choix.kmh.reduite }, { s: sFrein, kmh: choix.kmh.reduite }, { s: sVirage, kmh: 0 },
    { s: sAllureVirage, kmh: choix.kmh.virage }, { s: sFinVirage, kmh: choix.kmh.virage },
    { s: sPleineAllure, kmh: choix.kmh.sortie }, { s: chemin.longueur, kmh: choix.kmh.sortie },
  ];
  const tArrivee = tempsAtteint(chronologie(chemin, profilSans), sVirage);

  // Véhicule d'en face, tout droit vers le sud : son trajet commence et finit hors du monde (HORS_MONDE) ; il entre
  // dans le carrefour juste après l'arrêt de l'élève, qui lui cède le passage (R415-4 III) et le suit des yeux dès qu'il
  // ralentit pour lui. Passé derrière l'élève, il n'est plus suivi des yeux : l'élève regarde de nouveau devant lui, la
  // voie d'en face (scene-regard.js). Une fois le véhicule sorti de la zone de conflit (son arrière passe le bord sud du
  // carrefour), l'élève contrôle l'angle mort gauche, puis tourne.
  const y0Face = -HORS_MONDE;
  const cheminFace = trajet(cx - h / 2, y0Face, 90).droit(d.monde.hauteur + 2 * HORS_MONDE).fin();
  const departFace = tArrivee + choix.entreeEnFace - (bord.nord - demiLongueur - y0Face) / vitesse.enFace;
  if (departFace < 0) throw new Error("tourner-gauche : allonger la branche nord");
  const sortieFace = departFace + (bord.sud + demiLongueur - y0Face) / vitesse.enFace;
  const pause = sortieFace + choix.apresPassage + choix.duree.angleMort - tArrivee;
  const profil = profilSans.map((p) => (p.s === sVirage ? { ...p, pause } : p));
  return {
    code: "tourner-gauche", titre: "Tourner à gauche en agglomération", monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: choix.hauteurCadre },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil,
        clignotant: [{ cote: "gauche", de: sClignotant, a: sFinVirage }] },
      { id: "enFace", gabarit: "voiture", chemin: cheminFace, depart: departFace,
        profil: [{ s: 0, kmh: choix.kmh.enFace }, { s: cheminFace.longueur, kmh: choix.kmh.enFace }] },
    ],
    etapes: [
      { s: 0, regard: { angle: choix.regard.retroviseurs } },
      { s: sSerrer, regard: { angle: choix.regard.devant } },
      { s: sRalentir, regard: { angle: choix.regard.devant } },
      { s: sBalayage, regard: { balayage: true } },
      { s: sFrein, regard: { suivre: "enFace" } },
      { s: sVirage, delai: pause - choix.duree.angleMort, regard: { angle: choix.regard.angleMort } },
      { s: sVirage, delai: pause, regard: { angle: choix.regard.sortie } },
      { s: sFinVirage, regard: { angle: choix.regard.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "moitié droite de la chaussée", zone: d.voies.axeNordSudEst, de: 0, a: sVirage, emprise: true },
      { type: "arretAvant", acteur: "eleve", nom: "centre de l'intersection", point: [cx, cy], normale: [0, 1], tolerance: TOLERANCE_ARRET },
      { type: "dans", acteur: "eleve", nom: "voie de droite, branche ouest", zone: d.voies.ouestSortante,
        de: xMaxSous(chemin, bord.ouest), a: chemin.longueur, emprise: true },
      { type: "cede", acteur: "eleve", autre: "enFace", nom: "voie du véhicule d'en face", zone: d.zones.moitieOuestCarrefour },
    ],
  };
}

// ===== Traverser un carrefour à sens giratoire (fiche ECF C2-F) =====
//
// Petit giratoire urbain, traversé en face (deuxième sortie). Les étapes et ce que regarde le conducteur suivent la fiche,
// la sortie dans l'ordre du cours du thème 38, que suit C2.4 (rétroviseurs, clignotant, angle mort, manœuvre), avec les
// conventions des virages (rétroviseur intérieur à 180 degrés, angle mort à 120 ; balayage d'au moins 2 s ; regard sur
// l'usager à qui l'élève cède le passage) ; les valeurs ci-dessous sont des choix de dessin, recopiés dans les sources de
// la scène.
const GIRATOIRE = geler({
  // m ; décor du plan. La branche sud porte le recul du départ (REGARD_PORTEE) et l'approche de l'élève, la branche ouest
  // l'approche de l'usager de l'anneau (qui part hors du monde), la branche nord la sortie de l'élève.
  branches: { nord: 26, sud: 76, est: 26, ouest: 40 },
  cadre: { largeur: 40, hauteur: 46 },   // m : cadre qui suit l'élève, sans changer l'échelle (plan)
  // km/h : approche du plan ; allure adaptée avant le cédez-le-passage ; petit giratoire urbain à 20 km/h dans l'anneau
  // (choix de Timy ; la fiche indique 30 à 35 km/h pour un giratoire courant). Dans les arcs d'entrée et de sortie, de 9,5 m
  // de rayon, 20 km/h donneraient 3,25 m/s² d'accélération latérale : l'usager de l'anneau entre à 18 km/h, l'élève arrive
  // au bout de l'arc d'entrée en reprenant de l'arrêt (17,8 km/h), et tous deux cassent leur allure avant l'arc de sortie.
  // L'élève à 11 km/h (cassee) : ses trois regards de 1,0 s qui suivent le clignotant (vers la sortie, angle mort droit,
  // angle mort gauche) s'achèvent alors assez tôt pour que le balayage de la sortie commence près d'une seconde avant l'arc
  // de sortie (on contrôle, puis on tourne). Ces trois regards tiendraient avant l'arc jusqu'à 14,5 km/h, mais le balayage
  // commencerait alors à l'entrée de l'arc. L'usager de l'anneau garde 15 km/h (casseeUsager) : sa chronologie, déjà
  // validée (il passe devant l'entrée sud quand l'élève s'y arrête), ne dépend pas de l'allure cassée choisie pour
  // l'élève ; ne pas aligner l'une sur l'autre.
  kmh: { approche: 30, adaptee: 15, anneau: 20, arcEntree: 18, cassee: 11, casseeUsager: 15, sortie: 30 },
  // s : palier minimal à 20 km/h dans l'anneau, le plus court qui laisse voir les 20 km/h atteints : l'allure de l'anneau
  // est tenue avant de casser l'allure, et non touchée un instant. Les tests vérifient qu'il dure au moins un pas des
  // contrôles automatiques (SEUILS.pas). Le palier réel est plus long : il dure jusqu'à ce que le coup d'œil au rétroviseur
  // intérieur, en cassant l'allure, amène l'élève au point où s'allume le clignotant.
  palierAnneauMin: 0.1,
  ralentissement: 1.0,   // m/s² : adapter l'allure, progressivement, sur la longue approche de la branche sud
  freinage: 2.0,         // m/s² : s'arrêter au cédez-le-passage, casser l'allure, ralentir avant d'entrer (usager de l'anneau)
  reprise: 1.5,          // m/s² : accélération au redémarrage, dans l'anneau, puis dans la voie de sortie
  // s à l'écran : coup d'œil au rétroviseur intérieur à l'approche ; balayage, juste avant le freinage pour l'usager de
  // l'anneau ; regard à gauche, à l'arrêt, une fois l'usager sorti de la zone de conflit, jusqu'au redémarrage ; à la
  // sortie, rétroviseur intérieur en cassant l'allure (au moins retroviseurSortie, et tout le ralentissement), clignotant
  // avec le regard vers la sortie (indication), angle mort droit, angle mort gauche, avant de balayer la sortie.
  duree: { retroviseur: 1.2, balayage: 2.0, regardGauche: 1.0, retroviseurSortie: 1.0, indication: 1.0,
    angleMortDroit: 1.0, angleMortGauche: 1.0 },
  // degrés par rapport au cap, - à gauche. Gauche : à l'arrêt, le cône couvre l'anneau en amont de l'entrée, d'où viendrait
  // un autre usager (angles polaires 94 à 174 autour de l'îlot), dans le cadre. Sortie : le clignotant allumé, le regard
  // porte vers la sortie ; l'anneau tourne à gauche, et le début et la fin de l'arc de sortie sont alors de 26 à 15 degrés
  // à gauche du cap (droit devant, le regard tomberait sur la bordure extérieure, à 6,8 m de l'œil). Angles morts : tête
  // tournée vers l'épaule, le droit (cycliste ou cyclomotoriste le long du bord extérieur), puis le gauche (vélo ou
  // véhicule encore dans le giratoire).
  regard: { retroviseurInterieur: 180, devant: 0, gauche: -55, sortie: -21, angleMortDroit: 120, angleMortGauche: -120 },
  // s : l'usager de l'anneau passe devant l'entrée sud au moment où l'élève s'y arrête et quitte la zone de conflit ce temps
  // après l'arrêt ; l'élève regarde alors à gauche (duree.regardGauche), puis repart : 3,4 s d'attente en tout.
  sortieAnneauApresArret: 2.4,
});

function giratoireScene() {
  const choix = GIRATOIRE;
  const g = giratoire({ branches: choix.branches });
  const { cx, cy } = g.reperes;
  const vitesse = Object.fromEntries(Object.entries(choix.kmh).map(([cle, kmh]) => [cle, kmh * KMH]));
  // Élève : de la branche sud à la branche nord, deuxième sortie. Départ à REGARD_PORTEE du bord bas, dans l'axe de la voie
  // d'entrée : le cône du rétroviseur intérieur, tourné vers l'arrière, tient dans le monde (même départ que les virages).
  const { chemin, s: S } = raccourcirDebut(trajetGiratoire(g, "sud", "nord"), REGARD_PORTEE - DESSIN.retraitBord);

  // Approche : coup d'œil au rétroviseur intérieur, allure adaptée progressivement, balayage des véhicules engagés dans les
  // 2 s qui précèdent le freinage, arrêt au cédez-le-passage, l'avant à MARGE_ARRET de la ligne.
  const sRalentir = vitesse.approche * choix.duree.retroviseur;
  const sAllureAdaptee = sRalentir + (vitesse.approche ** 2 - vitesse.adaptee ** 2) / (2 * choix.ralentissement);
  const sArret = yMinAtteint(chemin, g.reperes.cedez.yAmont + MARGE_ARRET);
  const sFrein = sArret - vitesse.adaptee ** 2 / (2 * choix.freinage);
  const sBalayage = sFrein - vitesse.adaptee * choix.duree.balayage;
  if (sBalayage < sAllureAdaptee) throw new Error("giratoire : allonger la branche sud");

  // Anneau : reprise jusqu'à 20 km/h, tenus le temps d'un palier, puis la sortie dans l'ordre rétroviseurs, clignotant,
  // angle mort, manœuvre : coup d'œil au rétroviseur intérieur en cassant l'allure ; clignotant, qui s'allume à la fin de
  // ce coup d'œil, au plus tôt 3 degrés après l'axe de la sortie précédente (S.clignotant), avec le regard vers la sortie ;
  // angle mort droit, angle mort gauche, à l'allure cassée ; balayage de la sortie. Allure cassée tenue dans l'arc de
  // sortie, puis reprise dans la voie de sortie. Deux gardes refusent la scène : une avance du clignotant sur l'arc de
  // sortie sous celle qu'exigent les contrôles automatiques (SEUILS), et des angles morts qui ne finiraient pas avant l'arc
  // de sortie (casser alors davantage l'allure).
  const sAllureAnneau = sArret + vitesse.anneau ** 2 / (2 * choix.reprise);
  const dCasser = (vitesse.anneau ** 2 - vitesse.cassee ** 2) / (2 * choix.freinage);
  const tCasser = (vitesse.anneau - vitesse.cassee) / choix.freinage;
  // Distance parcourue pendant le coup d'œil au rétroviseur intérieur : tout le ralentissement, prolongé à l'allure cassée
  // s'il dure moins que duree.retroviseurSortie.
  const dRetroviseur = dCasser + vitesse.cassee * Math.max(0, choix.duree.retroviseurSortie - tCasser);
  // Palier à 20 km/h : ce qui reste avant le clignotant au plus tôt une fois le coup d'œil placé, sans descendre sous
  // palierAnneauMin.
  const dPalier = Math.max(vitesse.anneau * choix.palierAnneauMin, S.clignotant - (sAllureAnneau + dRetroviseur));
  const sCasser = sAllureAnneau + dPalier;
  const sIndication = sCasser + dRetroviseur;
  const sAngleMortDroit = sIndication + vitesse.cassee * choix.duree.indication;
  const sAngleMortGauche = sAngleMortDroit + vitesse.cassee * choix.duree.angleMortDroit;
  const sBalayageSortie = sAngleMortGauche + vitesse.cassee * choix.duree.angleMortGauche;
  // Du clignotant à l'arc de sortie, l'élève roule à l'allure cassée, atteinte pendant le coup d'œil au rétroviseur.
  const tAvanceClignotant = (S.sortie - sIndication) / vitesse.cassee;
  if (tAvanceClignotant < SEUILS.avanceClignotant) throw new Error("giratoire : clignotant allumé trop tard pour l'arc de sortie");
  if (sBalayageSortie >= S.sortie) throw new Error("giratoire : angles morts non achevés avant l'arc de sortie");
  const sPleineAllure = S.finSortie + (vitesse.sortie ** 2 - vitesse.cassee ** 2) / (2 * choix.reprise);
  const profilSans = [
    { s: 0, kmh: choix.kmh.approche }, { s: sRalentir, kmh: choix.kmh.approche },
    { s: sAllureAdaptee, kmh: choix.kmh.adaptee }, { s: sFrein, kmh: choix.kmh.adaptee }, { s: sArret, kmh: 0 },
    { s: sAllureAnneau, kmh: choix.kmh.anneau }, { s: sCasser, kmh: choix.kmh.anneau },
    { s: sCasser + dCasser, kmh: choix.kmh.cassee }, { s: S.finSortie, kmh: choix.kmh.cassee },
    { s: sPleineAllure, kmh: choix.kmh.sortie }, { s: chemin.longueur, kmh: choix.kmh.sortie },
  ];
  const tArrivee = tempsAtteint(chronologie(chemin, profilSans), sArret);

  // Usager de l'anneau : de la branche ouest à la branche est (deuxième sortie), son trajet commence et finit hors du monde
  // (HORS_MONDE). Il entre dans l'anneau à 18 km/h, y roule à 20 km/h, casse son allure (casseeUsager) avant l'arc de
  // sortie et met son clignotant droit après la sortie précédente : le sud, devant l'élève. Il passe devant l'entrée sud
  // quand l'élève s'y arrête ; l'élève lui cède le passage (R415-10) et le suit des yeux dès qu'il ralentit pour lui.
  const trO = trajetGiratoire(g, "ouest", "est", { horsMonde: true });
  const sRalentirO = trO.s.tangenceEntree - (vitesse.approche ** 2 - vitesse.arcEntree ** 2) / (2 * choix.freinage);
  const sAllureAnneauO = trO.s.anneau + (vitesse.anneau ** 2 - vitesse.arcEntree ** 2) / (2 * choix.reprise);
  const dCasserO = (vitesse.anneau ** 2 - vitesse.casseeUsager ** 2) / (2 * choix.freinage);
  const sPleineAllureO = trO.s.finSortie + (vitesse.sortie ** 2 - vitesse.casseeUsager ** 2) / (2 * choix.reprise);
  const anneau = {
    id: "anneau", gabarit: "voiture", chemin: trO.chemin,
    profil: [
      { s: 0, kmh: choix.kmh.approche }, { s: sRalentirO, kmh: choix.kmh.approche },
      { s: trO.s.tangenceEntree, kmh: choix.kmh.arcEntree }, { s: trO.s.anneau, kmh: choix.kmh.arcEntree },
      { s: sAllureAnneauO, kmh: choix.kmh.anneau }, { s: trO.s.sortie - dCasserO, kmh: choix.kmh.anneau },
      { s: trO.s.sortie, kmh: choix.kmh.casseeUsager }, { s: trO.s.finSortie, kmh: choix.kmh.casseeUsager },
      { s: sPleineAllureO, kmh: choix.kmh.sortie }, { s: trO.chemin.longueur, kmh: choix.kmh.sortie },
    ],
    clignotant: [{ cote: "droite", de: trO.s.clignotant, a: trO.s.finSortie }],
  };
  const zone = g.reperes.zoneConflitSud;
  const departAnneau = tArrivee + choix.sortieAnneauApresArret - derniereSortie(anneau, zone);
  if (departAnneau < 0) throw new Error("giratoire : allonger la branche ouest");
  // Une fois l'usager sorti de la zone de conflit, l'élève regarde à gauche l'anneau en amont (un autre usager pourrait le
  // suivre), puis s'insère.
  const pause = choix.sortieAnneauApresArret + choix.duree.regardGauche;
  const profil = profilSans.map((p) => (p.s === sArret ? { ...p, pause } : p));
  return {
    code: "giratoire", titre: "Traverser un carrefour à sens giratoire", monde: g.monde, limite: LIMITE_AGGLOMERATION, decor: g,
    camera: { largeur: choix.cadre.largeur, hauteur: choix.cadre.hauteur },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil,
        clignotant: [{ cote: "droite", de: sIndication, a: S.finSortie }] },
      { ...anneau, depart: departAnneau },
    ],
    etapes: [
      { s: 0, regard: { angle: choix.regard.retroviseurInterieur } },
      { s: sRalentir, regard: { angle: choix.regard.devant } },
      { s: sBalayage, regard: { balayage: true } },
      { s: sFrein, regard: { suivre: "anneau" } },
      { s: sArret, delai: choix.sortieAnneauApresArret, regard: { angle: choix.regard.gauche } },
      { s: sArret, delai: pause, regard: { angle: choix.regard.devant } },
      { s: sCasser, regard: { angle: choix.regard.retroviseurInterieur } },
      { s: sIndication, regard: { angle: choix.regard.sortie } },
      { s: sAngleMortDroit, regard: { angle: choix.regard.angleMortDroit } },
      { s: sAngleMortGauche, regard: { angle: choix.regard.angleMortGauche } },
      { s: sBalayageSortie, regard: { balayage: true } },
      { s: S.finSortie, regard: { angle: choix.regard.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "voie d'entrée sud", zone: g.voies.sudEntrante, de: 0, a: S.tangenceEntree, emprise: true },
      { type: "dans", acteur: "eleve", nom: "voie de sortie nord", zone: g.voies.nordSortante, de: S.finSortie, a: chemin.longueur, emprise: true },
      { type: "arretAvant", acteur: "eleve", nom: "ligne du cédez-le-passage", point: [cx, g.reperes.cedez.yAmont], normale: [0, 1], tolerance: TOLERANCE_ARRET },
      { type: "cede", acteur: "eleve", autre: "anneau", nom: "anneau devant l'entrée sud", zone },
      { type: "rotation", acteur: "eleve", nom: "îlot central", centre: [cx, cy], sens: "anti-horaire", de: S.anneau, a: S.sortie },
      { type: "rotation", acteur: "anneau", nom: "îlot central", centre: [cx, cy], sens: "anti-horaire", de: trO.s.anneau, a: trO.s.sortie },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "droite", s: S.clignotant },
      { type: "pasDeClignotantAvant", acteur: "anneau", cote: "droite", s: trO.s.clignotant },
    ],
  };
}

// ===== Regarder autour de soi à l'approche d'une intersection (procédures de Fabrice, 5.1 ; fiche ECF C1-I) =====
//
// L'élève traverse tout droit, sans clignotant, sur l'axe nord-sud prioritaire ; un véhicule attend, arrêté à la ligne de
// cédez-le-passage de la branche est : l'indice à repérer. Les étapes suivent la méthode P.P.D.A. (percevoir loin et large,
// prévoir, décider, agir) et les contrôles à l'approche (en face, à gauche, à droite) ; les valeurs ci-dessous (angles du
// regard compris) sont des choix de dessin, recopiés dans les sources de la scène.
const REGARD_INTERSECTION = geler({
  // m ; la branche sud porte le recul du départ (REGARD_PORTEE) et l'approche : le plus petit nombre entier de mètres qui
  // loge les durées ci-dessous, le regard loin devant durant au moins duree.loin. Est et ouest : le plus petit nombre entier
  // de mètres pour que le cône du regard à droite, puis celui du regard à gauche, tiennent dans la largeur du monde. Nord :
  // l'élève a quitté l'intersection quand son trajet s'achève.
  branches: { nord: 8, sud: 108, est: 14, ouest: 11 },
  hauteurCadre: 46,           // m : cadre qui suit l'élève, sur toute la largeur du monde, sans changer l'échelle
  // km/h : allure d'approche en agglomération, puis allure réduite à l'approche de l'intersection, tenue jusqu'à la fin
  // (l'élève la traverse sans s'arrêter : l'axe nord-sud est prioritaire).
  kmh: { approche: 50, reduite: 30 },
  ralentissement: 2.0,        // m/s² : pour réduire l'allure, progressivement
  // s à l'écran : regard loin devant (au moins) ; coup d'œil au rétroviseur intérieur, juste avant de ralentir ; puis, à
  // l'allure réduite, les trois contrôles à l'approche, le dernier achevé quand l'avant atteint le bord de l'intersection.
  duree: { loin: 1.0, retroviseur: 1.0, enFace: 1.0, gauche: 1.0, droite: 1.0 },
  // degrés par rapport au cap, - à gauche. Gauche et droite : vers l'entrée de chaque branche transversale. Pendant tout le
  // regard à gauche, le cône contient l'entrée de la voie entrante ouest, au bord amont de sa ligne de cédez-le-passage (de
  // 14,6 à 23,8 degrés à gauche de l'axe de la voiture, vu de l'œil du conducteur) ; pendant tout le regard à droite, il
  // contient le véhicule qui attend (de 18,4 à 35,5 degrés à droite). À 60 degrés, le cône du regard à gauche n'atteindrait
  // la voie entrante ouest qu'après 0,35 s de regard, et celui du regard à droite ne contiendrait le véhicule qui attend
  // qu'une fois l'avant de la voiture à 1,9 m dans l'intersection.
  regard: { devant: 0, retroviseurInterieur: 180, gauche: -30, droite: 30 },
});

function regardIntersection() {
  const choix = REGARD_INTERSECTION;
  const d = carrefourEnCroix({ branches: choix.branches });
  const { cx, cy, bord } = d.reperes;
  const h = DESSIN.voie, demiLongueur = GABARITS.voiture.longueur / 2;
  const vitesse = { approche: choix.kmh.approche * KMH, reduite: choix.kmh.reduite * KMH };

  // Trajet : tout droit vers le nord, au centre de la voie de droite, du départ à REGARD_PORTEE du bord bas (le cône du
  // rétroviseur intérieur, tourné vers l'arrière, tient dans le monde) jusqu'à DESSIN.retraitBord du bord haut.
  const yDepart = d.monde.hauteur - REGARD_PORTEE;
  const chemin = trajet(cx + h / 2, yDepart, -90).droit(yDepart - DESSIN.retraitBord).fin();

  // Étapes placées depuis l'intersection, à rebours : le regard à droite s'achève quand l'avant atteint le bord de
  // l'intersection ; avant lui, à l'allure réduite, le regard à gauche, puis le regard en face ; avant eux, le
  // ralentissement, et juste avant lui le coup d'œil au rétroviseur intérieur, à l'allure d'approche. Le regard loin devant
  // occupe le début du trajet.
  const sEntree = yDepart - demiLongueur - bord.sud;
  const sDroite = sEntree - vitesse.reduite * choix.duree.droite;
  const sGauche = sDroite - vitesse.reduite * choix.duree.gauche;
  const sEnFace = sGauche - vitesse.reduite * choix.duree.enFace;
  const sRalentir = sEnFace - (vitesse.approche ** 2 - vitesse.reduite ** 2) / (2 * choix.ralentissement);
  const sRetroviseur = sRalentir - vitesse.approche * choix.duree.retroviseur;
  if (sRetroviseur < vitesse.approche * choix.duree.loin) throw new Error("regard-intersection : allonger la branche sud");

  // Véhicule qui attend au cédez-le-passage de la branche est : posé au centre de la voie entrante, tourné vers l'ouest,
  // l'avant à MARGE_ARRET du bord amont de la ligne.
  const ligne = d.marquages.find((m) => m.role === "cedez-est");
  const xLigneAmont = ligne.de[0] + ligne.largeur / 2;
  const pose = { x: xLigneAmont + MARGE_ARRET + demiLongueur, y: cy - h / 2, cap: 180 };
  // Ce que chaque regard latéral contient tout du long : à gauche, l'entrée de la voie entrante ouest (son milieu, au bord
  // amont de sa ligne de cédez-le-passage) ; à droite, le véhicule qui attend. En ligne droite, le cône, un triangle, ne
  // tourne pas : il contient tout le chemin du point vu de l'œil s'il en contient les deux bouts, au début et à la fin du
  // regard.
  const ligneOuest = d.marquages.find((m) => m.role === "cedez-ouest");
  const entreeOuest = { x: ligneOuest.de[0] - ligneOuest.largeur / 2, y: cy + h / 2 };
  for (const [nom, angle, cible, debut, fin] of [
    ["l'entrée de la voie entrante ouest", choix.regard.gauche, entreeOuest, sGauche, sDroite],
    ["le véhicule qui attend", choix.regard.droite, pose, sDroite, sEntree],
  ]) {
    for (const s of [debut, fin]) {
      const p = pointA(chemin, s);
      if (!regardContient(p.cap + angle * DEG, oeil(p), cible)) {
        throw new Error(`regard-intersection : ${nom} sort du cône du regard à ${angle < 0 ? "gauche" : "droite"}`);
      }
    }
  }

  const profil = [
    { s: 0, kmh: choix.kmh.approche }, { s: sRalentir, kmh: choix.kmh.approche },
    { s: sEnFace, kmh: choix.kmh.reduite }, { s: chemin.longueur, kmh: choix.kmh.reduite },
  ];
  return {
    code: "regard-intersection", titre: "Regarder autour de soi à l'approche d'une intersection", monde: d.monde,
    limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: choix.hauteurCadre },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil },
      { id: "aDroite", gabarit: "voiture", pose },
    ],
    etapes: [
      { s: 0, regard: { angle: choix.regard.devant } },
      { s: sRetroviseur, regard: { angle: choix.regard.retroviseurInterieur } },
      { s: sRalentir, regard: { angle: choix.regard.devant } },
      { s: sEnFace, regard: { angle: choix.regard.devant } },
      { s: sGauche, regard: { angle: choix.regard.gauche } },
      { s: sDroite, regard: { angle: choix.regard.droite } },
      { s: sEntree, regard: { angle: choix.regard.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "moitié droite de la chaussée, intersection comprise", zone: d.voies.axeNordSudEst,
        de: 0, a: chemin.longueur, emprise: true },
      { type: "vitesseMax", acteur: "eleve", kmh: choix.kmh.reduite, de: sEnFace, a: chemin.longueur },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "droite", s: chemin.longueur },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "gauche", s: chemin.longueur },
      { type: "dans", acteur: "aDroite", nom: "voie entrante, branche est", zone: d.voies.estEntrante, de: 0, a: 0, emprise: true },
      { type: "arretAvant", acteur: "aDroite", nom: "ligne de cédez-le-passage, branche est", point: [xLigneAmont, cy - h / 2],
        normale: [1, 0], tolerance: TOLERANCE_ARRET },
    ],
  };
}

// ===== Demi-tour en trois temps (C1.9 : méthode de Timy du 07/10/2026 ; V·V·C·C, procédures de stage, section 4.3) =====
//
// Rue calme, sans circulation ni voiture garée (C1 : trafic faible ou nul). Arrêtée au bord droit, la voiture de l'élève fait
// demi-tour en trois temps : en avant vers la gauche jusqu'au trottoir opposé, en arrière volant à droite jusqu'au bord de
// départ, en avant pour repartir dans la voie de droite du nouveau sens. Chaque temps suit la méthode V·V·C·C : vitesse (le
// rapport) et volant (tourné à fond) à l'arrêt, puis les contrôles, dans l'ordre de Timy, puis le clignotant, puis le
// mouvement ; clignotants gauche, droit, gauche (décision de Timy). La voiture pivote autour de son essieu arrière (option
// essieu du trajet, js/scene-geometrie.js). Les valeurs ci-dessous sont des choix de dessin, recopiés dans les sources.
const DEMI_TOUR = geler({
  // m : voies de 3,6 m, chaussée de 7,2 m. Dans la rue de 7 m des autres scènes, la voiture, braquée à fond et arrêtée à
  // MARGE_ARRET de chaque trottoir, mordrait sur le trottoir opposé au troisième temps : son coin avant droit balaie un
  // cercle de 6,01 m de rayon autour du centre de rotation. 7,2 m est la plus petite largeur, au décimètre, où elle n'y
  // passe pas plus près d'un trottoir qu'au premier temps, quand son arrière se déporte vers le trottoir de départ.
  largeurVoie: 3.6,
  // m : trottoir montré de chaque côté de la chaussée, le plus petit nombre entier de mètres qui loge sur le trottoir droit
  // le repère des étapes 1 à 5 (animations réduites), à droite de la voiture au départ ; rue montrée au nord du départ, le
  // plus petit nombre entier de mètres qui loge au nord de la voiture arrêtée le repère des étapes 6 à 9 (au sud du départ,
  // REGARD_PORTEE : le cône du rétroviseur intérieur, tourné vers l'arrière, tient dans le monde, comme dans les autres
  // scènes). Le cadre, fixe, est le monde entier : la manœuvre entière se voit à chaque instant, plus grande que dans un
  // cadre de 46 m de haut.
  trottoir: 8,
  nord: 8,
  // m : rayon de braquage mesuré au centre de la voiture, le plus petit retenu au plan 1 (braquage d'une citadine, celui
  // de tourner-gauche). Le trajet étant celui de l'essieu arrière, son rayon s'en déduit (demiTour).
  rayonCentre: 4.1,
  kmh: { avant: 5, arriere: 4 },   // km/h : au pas ; en marche arrière, sous le garde-fou de l'allure du pas (6 km/h)
  reprise: 1.0,         // m/s² : la voiture prend son allure en un peu plus d'une seconde, sur moins d'un mètre
  freinage: 1.0,        // m/s² : de même pour s'arrêter avant le trottoir
  // m d'avance du recentrage dans la voie, après le troisième temps : le plus petit nombre entier de mètres pour que, en se
  // replaçant au milieu de sa voie, la voiture ne passe pas à moins de DESSIN.margeTrajectoire (0,60 m) de la bordure, la
  // marge des autres scènes entre un flanc et la bordure qu'il longe (7 m la mèneraient à 0,56 m, 5 m à 0,31 m : la caisse
  // pivote d'autant plus que le recentrage est court).
  avanceRecentrage: 8,
  // s à l'écran : coups d'œil aux rétroviseurs et à l'angle mort (ceux des autres scènes) ; clignotant mis 2 s avant de
  // repartir (le minimum : l'attente n'en est pas allongée) ; arrêt montré avant les gestes du temps suivant ; tour du regard ;
  // roues droites au milieu de la voie, à la fin. Les durées de 1,0 s sont la durée minimale d'une étape.
  duree: { retroviseurInterieur: 1.2, retroviseurExterieur: 1.2, angleMort: 1.0, clignotant: 2.0, arret: 1.0,
    tour: REGARD_DUREE_TOUR_MIN, rouler: 1.0 },
  // degrés par rapport au cap de la caisse, - à gauche. lunette : par-dessus l'épaule droite, vers la lunette arrière
  // (distinct du rétroviseur intérieur, à 180). En avançant volant tourné à gauche, le regard va vers un point fixe, là où
  // va la voiture (regarder où l'on va : la voiture suit le regard, fiche ECF C1-C) : au premier temps, la bordure du
  // trottoir opposé droit devant la voiture à son arrêt (demiTour) ; au troisième, le milieu de la voie loin devant
  // (regardLoin).
  regard: { retroviseurInterieur: 180, retroviseurExterieur: -170, angleMort: -120, devant: 0, lunette: 165 },
  // s : au troisième temps, du départ jusqu'au milieu de la voie, le regard va vers un point fixe, le milieu de la voie de
  // droite du nouveau sens, loin devant : là où la voiture s'aligne sur sa voie (le bout du troisième virage), plus la
  // distance qu'elle parcourt en ce temps à 5 km/h. Regard loin : analyser la situation 10 à 15 s devant (fiche ECF C1-I) ;
  // 10 s, le bas de la fourchette, gardent le point dans l'image.
  regardLoin: 10,
});

// Instants (s, comptés depuis l'arrivée à un arrêt) où commencent les gestes faits à l'arrêt, chacun pendant sa durée, et
// instant du départ, une fois le dernier achevé.
function enchainer(durees) {
  const debuts = [];
  let t = 0;
  for (const duree of durees) { debuts.push(t); t += duree; }
  return { debuts, depart: t };
}

function demiTour() {
  const choix = DEMI_TOUR, dur = choix.duree, r = choix.regard;
  const { largeur, essieu } = GABARITS.voiture;
  // Rayon du trajet de l'essieu arrière qui met le centre de la voiture à rayonCentre du centre de rotation : 3,835 m.
  // Vraisemblance : avec 2,7 m d'empattement et 1,55 m de voie, la roue avant extérieure tourne alors à 5,3 m de ce centre,
  // soit un diamètre de braquage de 10,7 m entre trottoirs, l'ordre de grandeur d'une compacte.
  const rayon = Math.sqrt(choix.rayonCentre ** 2 - essieu ** 2);
  const vitesse = { avant: choix.kmh.avant * KMH, arriere: choix.kmh.arriere * KMH };
  const d = rue({ longueur: choix.nord + REGARD_PORTEE, largeurTrottoir: choix.trottoir, largeurVoie: choix.largeurVoie });
  const { xBordGauche, xBordDroit } = d.reperes;
  // Jeux (m) entre l'emprise de la voiture, au point p, et chacun des deux trottoirs.
  const jeux = (p) => {
    const xs = emprise("voiture", p).map(([x]) => x);
    return { gauche: Math.min(...xs) - xBordGauche, droit: xBordDroit - Math.max(...xs) };
  };
  // Départ arrêté au bord droit, flanc droit à MARGE_ARRET du trottoir, à REGARD_PORTEE du bord bas : le cône du
  // rétroviseur intérieur, tourné vers l'arrière, tient dans le monde, comme dans les autres scènes.
  const depart = () => trajet(xBordDroit - MARGE_ARRET - largeur / 2, d.monde.hauteur - REGARD_PORTEE, -90, { essieu });
  // Plus grand angle (degrés) du dernier virage, posé par poser(angle), qui laisse la voiture arrêtée à MARGE_ARRET (au
  // moins) du trottoir `cote` : dichotomie, l'emprise s'en approchant à mesure que l'angle croît, jusqu'au quart de tour.
  const jusquAuTrottoir = (poser, cote) => {
    let ok = 0, trop = 90;
    for (let k = 0; k < 60; k++) {
      const angle = (ok + trop) / 2, ch = poser(angle).fin();
      if (jeux(pointA(ch, ch.longueur))[cote] >= MARGE_ARRET) ok = angle; else trop = angle;
    }
    return ok;
  };
  // Temps 1 : en avant, volant à gauche, jusqu'au trottoir opposé ; temps 2 : en arrière, volant à droite (la tortue, qui
  // va vers l'arrière de la caisse, tourne à gauche), jusqu'au trottoir de départ ; temps 3 : en avant, volant à gauche,
  // jusqu'au cap opposé à celui du départ, puis le recentrage dans la voie et roues droites.
  const angle1 = jusquAuTrottoir((a) => depart().virage(rayon, -a), "gauche");
  const angle2 = jusquAuTrottoir((a) => depart().virage(rayon, -angle1).inverser().virage(rayon, -a), "droit");
  const angle3 = 180 - angle1 - angle2;
  const t = depart().virage(rayon, -angle1);
  const sArret1 = t.longueur;
  t.inverser().virage(rayon, -angle2);
  const sArret2 = t.longueur;
  t.inverser().virage(rayon, -angle3);
  const sFinVirage = t.longueur;
  // Recentrage : au bout du troisième temps, la voiture est dans sa voie, mais à gauche de son milieu ; elle s'y replace
  // en roulant (un déplacement dans la voie, pas un changement de direction : sans clignotant), puis roule roues droites.
  const recentrage = pointA(t.fin(), sFinVirage).x - (xBordGauche + choix.largeurVoie / 2);
  t.decaler(recentrage, choix.avanceRecentrage);
  const sMilieuVoie = t.longueur;
  t.droit(vitesse.avant * dur.rouler);
  const chemin = t.fin();
  // Gardes : la voiture ne touche jamais un trottoir (relevé au millimètre du trajet), et finit dans la voie de droite du
  // nouveau sens.
  for (let k = 0; k * 0.001 <= chemin.longueur; k++) {
    const j = jeux(pointA(chemin, k * 0.001));
    if (!(j.gauche > 0 && j.droit > 0)) {
      throw new Error(`demi-tour : la voiture touche un trottoir en s = ${(k * 0.001).toFixed(3)} m : élargir la chaussée`);
    }
  }
  if (!emprise("voiture", pointA(chemin, sFinVirage)).every((p) => pointDansPolygone(p, d.voies.gauche))) {
    throw new Error("demi-tour : au bout du troisième temps, la voiture n'est pas dans la voie de droite du nouveau sens");
  }
  for (let k = 0; sFinVirage + k * 0.001 <= sMilieuVoie; k++) {
    if (jeux(pointA(chemin, sFinVirage + k * 0.001)).gauche < DESSIN.margeTrajectoire) {
      throw new Error(`demi-tour : en se recentrant, la voiture passe à moins de ${DESSIN.margeTrajectoire} m de la bordure :`
        + " allonger le recentrage");
    }
  }
  // Point regardé au premier temps : la bordure du trottoir opposé droit devant la voiture à son arrêt, là où l'axe de la
  // caisse arrêtée la coupe ; il est devant elle.
  const arret = pointA(chemin, sArret1);
  const versBordure = (xBordGauche - arret.x) / Math.cos(arret.cap);
  if (!(versBordure > 0)) throw new Error("demi-tour : à l'arrêt du premier temps, la voiture ne fait pas face au trottoir opposé");
  const pointBordure = [xBordGauche, arret.y + versBordure * Math.sin(arret.cap)];
  // Point regardé au troisième temps : le milieu de la voie de droite du nouveau sens, regardLoin s devant à l'allure du
  // temps, au-delà du bout du troisième virage ; il doit rester dans l'image.
  const pointLoin = [xBordGauche + choix.largeurVoie / 2, pointA(chemin, sFinVirage).y + vitesse.avant * choix.regardLoin];
  if (!(pointLoin[1] < d.monde.hauteur)) throw new Error("demi-tour : le point regardé au troisième temps sort de l'image");

  // Allures : reprise jusqu'à l'allure du temps, puis freinage jusqu'à l'arrêt avant le trottoir ; arrêt à chaque
  // rebroussement, le temps des gestes du temps suivant.
  const prendre = (v) => v ** 2 / (2 * choix.reprise), perdre = (v) => v ** 2 / (2 * choix.freinage);
  for (const [nom, de, a, v] of [["premier", 0, sArret1, vitesse.avant], ["deuxième", sArret1, sArret2, vitesse.arriere]]) {
    if (!(de + prendre(v) < a - perdre(v))) throw new Error(`demi-tour : ${nom} temps trop court pour prendre son allure et s'arrêter`);
  }
  if (!(sArret2 + prendre(vitesse.avant) < sFinVirage)) throw new Error("demi-tour : troisième temps trop court pour prendre son allure");
  const arretDepart = enchainer([dur.retroviseurInterieur, dur.retroviseurExterieur, dur.angleMort, dur.clignotant]);
  const arret1 = enchainer([dur.arret, dur.tour, dur.clignotant]);
  const arret2 = enchainer([dur.arret, dur.retroviseurInterieur, dur.retroviseurExterieur, dur.angleMort, dur.clignotant]);
  const profil = [
    { s: 0, kmh: 0, pause: arretDepart.depart },
    { s: prendre(vitesse.avant), kmh: choix.kmh.avant }, { s: sArret1 - perdre(vitesse.avant), kmh: choix.kmh.avant },
    { s: sArret1, kmh: 0, pause: arret1.depart },
    { s: sArret1 + prendre(vitesse.arriere), kmh: choix.kmh.arriere }, { s: sArret2 - perdre(vitesse.arriere), kmh: choix.kmh.arriere },
    { s: sArret2, kmh: 0, pause: arret2.depart },
    { s: sArret2 + prendre(vitesse.avant), kmh: choix.kmh.avant }, { s: chemin.longueur, kmh: choix.kmh.avant },
  ];

  return {
    code: "demi-tour", titre: "Faire demi-tour en trois temps", monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: d.monde.hauteur },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil,
        // Chaque clignotant s'allume pendant l'arrêt, après les contrôles. Celui des deux premiers temps s'éteint dès
        // l'arrêt qui le termine (rien ne brille pendant les contrôles du temps suivant) ; le dernier, au bout du
        // troisième virage, avant le recentrage.
        clignotant: [
          { cote: "gauche", de: 0, a: sArret1, delai: arretDepart.debuts[3], delaiFin: 0 },
          { cote: "droite", de: sArret1, a: sArret2, delai: arret1.debuts[2], delaiFin: 0 },
          { cote: "gauche", de: sArret2, a: sFinVirage, delai: arret2.debuts[4] },
        ] },
    ],
    etapes: [
      { s: 0, regard: { angle: r.retroviseurInterieur } },
      { s: 0, delai: arretDepart.debuts[1], regard: { angle: r.retroviseurExterieur } },
      { s: 0, delai: arretDepart.debuts[2], regard: { angle: r.angleMort } },
      { s: 0, delai: arretDepart.debuts[3], regard: { angle: r.devant } },
      { s: 0, delai: arretDepart.depart, regard: { vers: pointBordure } },
      { s: sArret1, regard: { angle: r.devant } },
      { s: sArret1, delai: arret1.debuts[1], regard: { tour: true } },
      { s: sArret1, delai: arret1.debuts[2], regard: { angle: r.devant } },
      { s: sArret1, delai: arret1.depart, regard: { angle: r.lunette } },
      { s: sArret2, regard: { angle: r.lunette } },
      { s: sArret2, delai: arret2.debuts[1], regard: { angle: r.retroviseurInterieur } },
      { s: sArret2, delai: arret2.debuts[2], regard: { angle: r.retroviseurExterieur } },
      { s: sArret2, delai: arret2.debuts[3], regard: { angle: r.angleMort } },
      { s: sArret2, delai: arret2.debuts[4], regard: { angle: r.devant } },
      { s: sArret2, delai: arret2.depart, regard: { vers: pointLoin } },
      { s: sMilieuVoie, regard: { angle: r.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "voie de droite, au départ", zone: d.voies.droite, de: 0, a: 0, emprise: true },
      { type: "dans", acteur: "eleve", nom: "voie de droite du nouveau sens", zone: d.voies.gauche, de: sFinVirage,
        a: chemin.longueur, emprise: true },
      { type: "vitesseMax", acteur: "eleve", nom: "au pas", kmh: choix.kmh.avant, de: 0, a: chemin.longueur },
      { type: "vitesseMax", acteur: "eleve", nom: "marche arrière, au pas", kmh: choix.kmh.arriere, de: sArret1, a: sArret2 },
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
      "Avertir les autres usagers avant de changer de direction (clignotant) : R412-10. Contrôler, puis indiquer : fiche ECF C2-E (mémo R·A·P·S·C) ; méthode C.I.A. (contrôles, indications, actions) : fiche ECF C2-F.",
      "Serrer le bord droit de la chaussée avant de quitter la route sur sa droite : R415-3 I. Sans se coller au trottoir, pour laisser de la place à un vélo : fiche ECF C2-E.",
      "Céder le passage, au besoin en s'arrêtant, au piéton qui s'engage dans la traversée ou manifeste clairement l'intention de traverser : R415-11. Ici le piéton attend au bord du passage : repéré pendant le balayage, il voit la voiture s'arrêter pour lui avant de s'engager.",
      "Rester constamment maître de sa vitesse et la régler selon les difficultés de la circulation et les obstacles prévisibles : R413-17 II. La réduire avant le virage et non pendant : fiche ECF C2-E.",
      "Marquage : unité u de 5 cm, modulations T'1 (traits de 1,50 m, vides de 5 m) et T'2 (traits et vides de 0,50 m) : IISR 7e partie, art. 113-1 ; axiale T'1 de largeur 2u, admise en agglomération, et ligne de cédez-le-passage T'2 de 0,50 m de large : art. 113-2 ; cette ligne s'étend sur toute la largeur de la voie entrante, de l'axe jusqu'à la bordure, marque la limite de la chaussée prioritaire et est précédée d'une axiale continue de largeur 2u sur 10 à 20 m (15 m retenus) : art. 117-4 B ; passage piéton de bandes de 0,50 m, espacées de 0,50 m (0,50 à 0,80 m admis) et longues de 2,50 m (minimum en ville), axiale interrompue à 0,50 m de part et d'autre : art. 118.",
      "Étapes et regards : d'après la fiche ECF C2-E (classeur de Timy), dont le clignotant maintenu jusqu'à la fin du virage et l'attente du dégagement complet du piéton.",
      "Choix de dessin, sans portée réglementaire : voies de 3,5 m ; arrondi de bordure de 6 m ; passage piéton à 0,5 m de la fin de l'arrondi ; axe nord-sud prioritaire (cédez-le-passage sur les branches est et ouest) ; branches de 8 m au nord et à l'ouest, 67 m au sud, 22 m à l'est ; cadre de 46 m de haut sur toute la largeur, qui suit l'élève ; départ à 22 m du bord bas (la portée du cône du regard, pour que le cône des rétroviseurs reste dans l'image) ; départ au centre de la voie, décalage de 0,25 m vers la droite sur 12 m (flanc droit à 0,60 m de la bordure), virage de 7,5 m de rayon concentrique à la bordure ; 25 km/h en approche et en sortie, 10 km/h avant et dans le virage ; décélération de 2,0 m/s² pour réduire l'allure ; freinage doux pour le piéton, commencé 1,0 s après l'entrée dans le virage (0,57 m/s², 1,0 m/s² au plus) ; accélération de 1,5 m/s² au redémarrage ; cône du regard de 22 m, ouvert de 16 degrés de part et d'autre, qui s'arrête 2 m au-delà de l'usager suivi des yeux ; regard, par rapport à l'axe de la voiture : 170 degrés à droite pendant 1,2 s (rétroviseurs), balayage de 75 degrés de part et d'autre (un aller-retour en 2 s) pendant 2 s au plus près de l'intersection, 120 degrés à droite pendant 1,0 s (angle mort, tête tournée vers l'épaule), 40 degrés à droite pendant 1,0 s (sortie), puis le piéton suivi des yeux ; clignotant allumé 0,5 s avant la fin du coup d'œil aux rétroviseurs ; piéton à 1,2 m/s, qui attend à 0,5 m du bord nord, se met en marche 0,5 s avant l'arrêt de la voiture et s'arrête à 0,5 m du bord sud ; redémarrage 0,6 s après son dégagement complet ; arrêt à 0,3 m du passage ; panneaux agrandis pour rester lisibles.",
    ],
    construire: unique(tournerDroite),
  },
  "tourner-gauche": {
    titre: "Tourner à gauche en agglomération",
    etapesModele: [
      "Contrôler et mettre le clignotant",
      "Serrer à gauche, près de l'axe sans le franchir",
      "Réduire l'allure",
      "Balayer l'intersection du regard",
      "Céder le passage au véhicule d'en face",
      "Contrôler l'angle mort gauche",
      "Tourner après le point central",
      "Rejoindre la voie de droite",
    ],
    sources: [
      "Avertir les autres usagers avant de changer de direction, notamment pour se porter à gauche (clignotant) : R412-10. Contrôler, puis indiquer : fiche ECF C2-E (mémo R·A·P·S·C) ; méthode C.I.A. (contrôles, indications, actions) : fiche ECF C2-F.",
      "Serrer à gauche avant de quitter la route sur sa gauche et, la chaussée étant à double sens, ne pas en dépasser l'axe médian : R415-4 I et II. Se placer près de la ligne centrale : fiche ECF C2-E.",
      "Céder le passage aux véhicules venant en sens inverse sur la chaussée que l'on s'apprête à quitter : R415-4 III. Ici l'élève s'arrête parce que le véhicule d'en face arrive : il le suit des yeux dès qu'il ralentit pour lui et jusqu'à ce qu'il soit passé, regarde de nouveau devant lui la voie d'en face (un autre véhicule pourrait suivre le premier), contrôle l'angle mort gauche une fois le carrefour dégagé, puis tourne.",
      "Rester constamment maître de sa vitesse et la régler selon les difficultés de la circulation et les obstacles prévisibles : R413-17 II. La réduire avant le virage et non pendant : fiche ECF C2-E.",
      "Marquage : unité u de 5 cm, modulations T'1 (traits de 1,50 m, vides de 5 m) et T'2 (traits et vides de 0,50 m) : IISR 7e partie, art. 113-1 ; axiale T'1 de largeur 2u, admise en agglomération, et ligne de cédez-le-passage T'2 de 0,50 m de large : art. 113-2 ; cette ligne s'étend sur toute la largeur de la voie entrante, de l'axe jusqu'à la bordure, marque la limite de la chaussée prioritaire et est précédée d'une axiale continue de largeur 2u sur 10 à 20 m (15 m retenus) : art. 117-4 B ; passage piéton de bandes de 0,50 m, espacées de 0,50 m (0,50 à 0,80 m admis) et longues de 2,50 m (minimum en ville), axiale interrompue à 0,50 m de part et d'autre : art. 118.",
      "Étapes et trajectoire : d'après la fiche ECF C2-E (classeur de Timy) : placement près de l'axe médian, clignotant mis tôt et maintenu jusqu'à la fin du virage, angle mort gauche contrôlé avant de braquer, priorité laissée aux véhicules venant en face, attente sans trop s'avancer dans l'intersection, virage pris après le point central de l'intersection (ne pas couper le virage).",
      "Choix de dessin, sans portée réglementaire : voies de 3,5 m ; arrondi de bordure de 6 m ; passage piéton sur la branche ouest, à 0,5 m de la fin de l'arrondi ; axe nord-sud prioritaire (cédez-le-passage sur les branches est et ouest) ; branches de 18 m au nord, 58 m au sud, 8 m à l'est et 20 m à l'ouest ; cadre de 46 m de haut sur toute la largeur, qui suit l'élève ; départ à 22 m du bord bas (la portée du cône du regard, pour que le cône des rétroviseurs reste dans l'image) ; départ au centre de la voie, décalage de 0,60 m vers la gauche sur 12 m (flanc gauche à 0,25 m de l'axe médian) ; attente l'avant à 0,10 m de la hauteur du centre de l'intersection, puis virage de 4,1 m de rayon (le plus petit retenu, braquage d'une citadine) jusqu'au centre de la voie de sortie, qui laisse le point central de l'intersection à 0,33 m à gauche du centre de la voiture ; 25 km/h en approche et en sortie, 8 km/h pour le balayage ; décélération de 2,0 m/s² pour réduire l'allure, puis pour s'arrêter ; reprise à 1,5 m/s² jusqu'à 10 km/h dans le virage, puis jusqu'à 25 km/h ; véhicule d'en face à 30 km/h, qui part et finit hors du dessin et entre dans le carrefour 0,3 s après l'arrêt de l'élève ; cône du regard de 22 m, ouvert de 16 degrés de part et d'autre, qui s'arrête 2 m au-delà de l'usager suivi des yeux ; regard, par rapport à l'axe de la voiture : 170 degrés à gauche pendant 1,2 s (rétroviseurs), balayage de 75 degrés de part et d'autre (un aller-retour en 2 s) pendant les 2 s qui précèdent le freinage, véhicule d'en face suivi des yeux dès le début du freinage puis, une fois passé derrière l'élève (à plus de 100 degrés de l'axe de la voiture), regard ramené droit devant, 120 degrés à gauche pendant 1,2 s (angle mort, tête tournée vers l'épaule) à partir de 0,4 s après que le véhicule d'en face a quitté le carrefour, 40 degrés à gauche dans le virage (sortie), puis droit devant ; clignotant allumé 0,5 s avant la fin du coup d'œil aux rétroviseurs ; panneaux agrandis pour rester lisibles.",
    ],
    construire: unique(tournerGauche),
  },
  giratoire: {
    titre: "Traverser un carrefour à sens giratoire",
    etapesModele: [
      "Contrôler au rétroviseur intérieur, sans clignotant",
      "Adapter l'allure à l'approche",
      "Balayer les véhicules engagés",
      "Céder le passage à l'usager de l'anneau",
      "Regarder à gauche avant de s'insérer",
      "S'insérer et circuler dans l'anneau",
      "Casser l'allure, rétroviseur intérieur",
      "Clignotant à droite après la sortie précédente",
      "Contrôler l'angle mort droit",
      "Contrôler l'angle mort gauche",
      "Balayer la sortie et sortir",
      "Reprendre l'allure dans la voie de sortie",
    ],
    sources: [
      "Carrefour à sens giratoire : place ou carrefour dont le terre-plein central est matériellement infranchissable, ceinturé par une chaussée mise à sens unique par la droite (on tourne en laissant l'îlot à sa gauche) et annoncé par une signalisation spécifique : R110-2.",
      "Céder le passage aux usagers circulant sur l'anneau, quel que soit le classement de la route que l'on quitte : R415-10. Ici l'usager de l'anneau passe devant l'entrée sud au moment où l'élève s'y arrête : repéré pendant le balayage, il est suivi des yeux dès que l'élève ralentit pour lui et pendant l'arrêt ; une fois qu'il a quitté la zone de conflit, l'élève regarde à gauche l'anneau en amont, d'où viendrait un autre usager, puis s'insère, le regard devant.",
      "Avertir les autres usagers avant de changer de direction, donc pour sortir du giratoire (clignotant) : R412-10. En face, pas de clignotant à l'entrée et clignotant droit à la sortie : fiche ECF C2-F ; ce clignotant s'allume après avoir dépassé la sortie qui précède la sienne : cours du thème 11 (contrôlé). Contrôler, puis indiquer, ici le rétroviseur intérieur avant le clignotant : fiche ECF C2-E (mémo R·A·P·S·C) et fiche ECF C2-F (méthode C.I.A. : contrôles, indications, actions). Les angles morts viennent ensuite, après le clignotant, dans l'ordre « rétroviseurs, clignotant, angle mort, manœuvre » du cours du thème 38 (contrôlé), retenu par Timy le 04/10. La scène allume le clignotant juste après le contrôle au rétroviseur intérieur, après la sortie précédente et au moins 2 s avant l'arc de sortie, et le garde jusqu'à la fin de cet arc ; la fiche C2-F place « sortir en allumant le clignotant droit » après le balayage de la sortie.",
      "Dans un anneau à plusieurs voies, le conducteur qui vise une sortie située sur sa gauche par rapport à son axe d'entrée peut serrer à gauche, et tout changement de voie dans l'anneau reste soumis à la priorité et doit être signalé : R412-9. Non montré : l'anneau dessiné n'a qu'une voie.",
      "Rester constamment maître de sa vitesse et la régler selon les difficultés de la circulation et les obstacles prévisibles : R413-17 II. Adapter l'allure à l'approche, puis casser l'allure avant de sortir : fiche ECF C2-F.",
      "Signalisation : panneau AB25 de l'ordre de 50 m avant le giratoire en agglomération, panneau AB3a et ligne de cédez-le-passage à chaque entrée : cours du thème 11 (contrôlé). Marquage : unité u de 5 cm, modulations T'1 (traits de 1,50 m, vides de 5 m) et T'2 (traits et vides de 0,50 m) : IISR 7e partie, art. 113-1 ; axiale T'1 de largeur 2u, admise en agglomération, et ligne de cédez-le-passage T'2 de 0,50 m de large : art. 113-2 ; cette ligne s'étend sur toute la largeur de la voie entrante, de l'axe jusqu'à la bordure, marque la limite de la chaussée prioritaire (ici le bord de l'anneau) et est précédée d'une axiale continue de largeur 2u sur 10 à 20 m (15 m retenus) : art. 117-4 B.",
      "Étapes et regards : d'après la fiche ECF C2-F (classeur de Timy) : à l'insertion, contrôles, allure adaptée, balayage des véhicules engagés, recherche de l'indice (allure de l'usager de l'anneau, son clignotant, sa position dans l'anneau), puis la décision, ici attendre ; l'usager passé, l'élève regarde de nouveau à gauche les véhicules qui pourraient être engagés avant de s'insérer. Sortie dans l'ordre « rétroviseurs, clignotant, angle mort, manœuvre » : cours du thème 38 (contrôlé), que suit le cours C2.4 (décision de Timy du 04/10). Soit, dans la scène : allure cassée sous le contrôle au rétroviseur intérieur (fiche ECF C2-F) ; clignotant droit après la sortie précédente (cours du thème 11, contrôlé) ; angle mort droit, un cycliste ou un cyclomotoriste pouvant longer le bord extérieur de l'anneau (cours du thème 11, contrôlé) ; angle mort gauche, vélo ou véhicule encore dans le giratoire (fiche ECF C2-F) ; balayage de la sortie. La fiche C2-F, elle, place l'angle mort avant le clignotant. L'anneau dessiné n'ayant qu'une voie, l'étape « se replacer sur la voie extérieure » de la fiche n'a pas lieu d'être.",
      "Choix de dessin, sans portée réglementaire : petit giratoire urbain à une voie : îlot central de 8 m de rayon, anneau de 6 m de large (bord extérieur à 14 m du centre), raccordements de bordure de 8 m de rayon, quatre branches à double sens de voies de 3,5 m, sans îlot séparateur ; ligne de cédez-le-passage à 5 cm de l'anneau, AB3a à 1,95 m en amont de la ligne, AB25 à 50 m de l'anneau ; branches de 26 m au nord et à l'est, 76 m au sud, 40 m à l'ouest ; cadre de 40 x 46 m qui suit l'élève ; départ à 22 m du bord bas (la portée du cône du regard, pour que le cône du rétroviseur intérieur reste dans l'image), dans l'axe de la voie d'entrée ; trajectoires à 0,6 m des bordures (anneau parcouru à 12,5 m du centre, arcs d'entrée et de sortie de 9,5 m de rayon) ; 30 km/h en approche et en sortie ; allure adaptée progressivement à 15 km/h (1,0 m/s²), puis freinage de 2,0 m/s² jusqu'à l'arrêt, au début de l'arc d'entrée, le coin avant gauche à 0,3 m de la ligne ; 20 km/h dans l'anneau (petit giratoire urbain ; la fiche indique 30 à 35 km/h pour un giratoire courant) ; au plus 19 km/h dans les arcs d'entrée et de sortie, pour une accélération latérale sous 3,0 m/s² (20 km/h y donneraient 3,25 m/s²) : reprise de 1,5 m/s² depuis l'arrêt (17,8 km/h au bout de l'arc d'entrée), 20 km/h tenus 1,06 s, puis allure cassée à 11 km/h (2,0 m/s²) pendant le contrôle au rétroviseur intérieur, qui s'achève là où s'allume le clignotant, et tenue jusqu'à la fin de l'arc de sortie : à 11 km/h, le regard vers la sortie et les deux angles morts, qui suivent le clignotant, s'achèvent assez tôt pour que le balayage de la sortie commence près d'une seconde avant l'arc de sortie (ces trois regards tiendraient avant l'arc jusqu'à 14,5 km/h, mais le balayage commencerait alors à l'entrée de l'arc) ; usager de l'anneau venu de l'ouest et sorti à l'est, qui part et finit hors du dessin, à 30 km/h en approche, 18 km/h dans l'arc d'entrée, 20 km/h dans l'anneau et 15 km/h dans l'arc de sortie, et quitte la zone de conflit (le secteur de l'anneau de 40 à 125 degrés, devant l'entrée sud) 2,4 s après l'arrêt de l'élève ; regard de l'élève à gauche pendant 1,0 s, puis redémarrage (attente de 3,4 s au cédez-le-passage) ; clignotant droit allumé juste après le rétroviseur intérieur, 3,0 degrés après l'axe de la sortie précédente (3 degrés au moins) et 3,96 s avant l'arc de sortie (2 s au moins) ; les deux angles morts finissent 0,96 s avant l'arc de sortie ; cône du regard de 22 m, ouvert de 16 degrés de part et d'autre, qui s'arrête 2 m au-delà de l'usager suivi des yeux ; regard, par rapport à l'axe de la voiture : 180 degrés pendant 1,2 s (rétroviseur intérieur), droit devant, balayage de 75 degrés de part et d'autre (un aller-retour en 2 s) pendant les 2 s qui précèdent le freinage, usager de l'anneau suivi des yeux jusqu'à sa sortie de la zone de conflit, 55 degrés à gauche pendant 1,0 s à l'arrêt (l'anneau en amont, d'où viendrait un autre usager), droit devant, 180 degrés pendant 1,25 s en cassant l'allure, 21 degrés à gauche pendant 1,0 s une fois le clignotant allumé (vers la sortie : l'anneau tourne à gauche, et droit devant le regard tomberait sur la bordure extérieure, à 6,8 m), 120 degrés à droite pendant 1,0 s (angle mort droit), 120 degrés à gauche pendant 1,0 s (angle mort gauche ; tête tournée vers l'épaule pour les deux), balayage de la sortie jusqu'à la fin de l'arc de sortie, puis droit devant ; panneaux agrandis pour rester lisibles.",
    ],
    construire: unique(giratoireScene),
  },
  "regard-intersection": {
    titre: "Regarder autour de soi à l'approche d'une intersection",
    etapesModele: [
      "Regarder loin devant",
      "Contrôler au rétroviseur intérieur",
      "Ralentir à l'approche",
      "Regarder en face",
      "Regarder à gauche",
      "Regarder à droite",
      "Traverser en regardant devant",
    ],
    sources: [
      "Franchir une intersection, méthode P.P.D.A. : percevoir (regard loin et large), prévoir (« on s'attend toujours au pire »), décider, agir ; contrôles à l'approche : en face, à gauche, à droite ; rechercher les indices utiles, formels (panneaux, marquages, feux) et informels (regard, vitesse, attitude des autres) : procédures de Fabrice (classeur de Timy), section 5.1. Ici l'indice à repérer est le véhicule arrêté à la ligne de cédez-le-passage de la branche est : indice informel (il attend), sur une branche qui porte un panneau et une ligne de cédez-le-passage (indices formels).",
      "Regarder autour de soi : regard loin (analyser la situation 10 à 15 s devant), balayage gauche, centre, droite et rétroviseurs toutes les 4 à 5 s : fiche ECF C1-I (classeur de Timy), qui nomme la méthode PADA : percevoir, analyser, décider, agir. Les clignotants servent lors d'un arrêt, d'un départ et d'un changement de direction (même fiche) : l'élève va tout droit, sans clignotant.",
      "Contrôler l'arrière au rétroviseur intérieur, puis casser l'allure et freiner progressivement : fiche ECF C1-H (freinage normal) ; contrôler avant d'agir, la première action étant de ralentir : méthode C.I.A. (contrôles, indications, actions), procédures de Fabrice, section 1, et fiche ECF C1-I. L'élève ralentit sans se déporter : le contrôle est le coup d'œil au rétroviseur intérieur, le premier de l'ordre de Timy (rétroviseur intérieur, rétroviseur extérieur, angle mort).",
      "Marquage : unité u de 5 cm, modulations T'1 (traits de 1,50 m, vides de 5 m) et T'2 (traits et vides de 0,50 m) : IISR 7e partie, art. 113-1 ; axiale T'1 de largeur 2u, admise en agglomération, et ligne de cédez-le-passage T'2 de 0,50 m de large : art. 113-2 ; cette ligne s'étend sur toute la largeur de la voie entrante, de l'axe jusqu'à la bordure, marque la limite de la chaussée prioritaire et est précédée d'une axiale continue de largeur 2u sur 10 à 20 m (15 m retenus) : art. 117-4 B.",
      "Étapes et regards : d'après les procédures de Fabrice (section 5.1) et les fiches ECF C1-I et C1-H (classeur de Timy) : regarder loin devant, contrôler au rétroviseur intérieur avant de ralentir, ralentir à l'approche, regarder en face, à gauche, puis à droite, où attend le véhicule à repérer, les trois contrôles achevés avant d'entrer dans l'intersection, puis traverser en regardant devant. La scène montre une méthode de regard ; la règle de priorité (ici l'axe nord-sud, choix de dessin) relève de C2.5.",
      "Choix de dessin, sans portée réglementaire : voies de 3,5 m ; arrondi de bordure de 6 m ; axe nord-sud prioritaire (cédez-le-passage sur les branches est et ouest), sans passage piéton ; branches de 108 m au sud (le recul du départ et l'approche : le plus petit nombre entier de mètres qui loge les étapes, le regard loin devant durant au moins 1,0 s), 14 m à l'est et 11 m à l'ouest (le plus petit nombre entier de mètres pour que le cône du regard à droite, puis celui du regard à gauche, tiennent dans la largeur du dessin), 8 m au nord (la voiture de l'élève sort de l'intersection : son arrière en est à 5,25 m quand son trajet s'achève) ; cadre de 46 m de haut sur toute la largeur, qui suit l'élève ; départ à 22 m du bord bas (la portée du cône du regard : tourné vers l'arrière, le cône du rétroviseur intérieur reste dans l'image), au centre de la voie de droite, trajet tout droit vers le nord ; 50 km/h en approche, la vitesse maximale en agglomération ; décélération constante de 2,0 m/s² (le freinage progressif de la fiche C1-H ramené à une valeur moyenne : 2,78 s sur 30,9 m) jusqu'à 30 km/h, allure réduite à l'approche de l'intersection, tenue jusqu'à la fin : les trois contrôles à l'approche, de 1,0 s chacun, tiennent sur les 25 derniers mètres avant l'intersection, que l'élève traverse sans s'arrêter ; véhicule qui attend posé au centre de la voie entrante est, tourné vers l'ouest, l'avant à 0,3 m de la ligne de cédez-le-passage, feux stop allumés comme tout véhicule à l'arrêt ; cône du regard de 22 m, ouvert de 16 degrés de part et d'autre ; regard, par rapport à l'axe de la voiture : droit devant pendant 1,01 s (regarder loin devant) ; 180 degrés pendant 1,0 s (rétroviseur intérieur), achevé quand le ralentissement commence ; droit devant pendant le ralentissement, puis pendant 1,0 s (en face) ; 30 degrés à gauche pendant 1,0 s, vers l'entrée de la branche ouest : pendant tout le regard, le cône contient l'entrée de sa voie entrante (au bord amont de la ligne de cédez-le-passage), qui passe de 14,6 à 23,8 degrés à gauche de l'axe de la voiture, vu de l'œil du conducteur, et, en fin de regard, il couvre cette voie jusqu'à 7,2 m en amont de la ligne ; 30 degrés à droite pendant 1,0 s, vers l'entrée de la branche est, achevé quand l'avant de la voiture atteint le bord de l'intersection : pendant tout le regard, le cône contient le véhicule qui attend, qui passe de 18,4 à 35,5 degrés à droite ; à 60 degrés de part et d'autre, le cône du regard à gauche n'atteindrait la voie entrante ouest qu'après 0,35 s de regard, et celui du regard à droite ne contiendrait le véhicule qui attend qu'une fois l'avant de la voiture à 1,9 m dans l'intersection ; droit devant pour traverser ; panneaux agrandis pour rester lisibles.",
    ],
    construire: unique(regardIntersection),
  },
  "demi-tour": {
    titre: "Faire demi-tour en trois temps",
    etapesModele: [
      "Temps 1 : contrôler au rétroviseur intérieur",
      "Contrôler au rétroviseur extérieur gauche",
      "Contrôler l'angle mort gauche",
      "Mettre le clignotant gauche",
      "Avancer volant à gauche jusqu'au trottoir opposé",
      "S'arrêter avant le trottoir, engager la marche arrière",
      "Temps 2 : faire le tour du regard",
      "Mettre le clignotant droit",
      "Reculer volant à droite, par la lunette arrière",
      "S'arrêter avant le trottoir, engager la première",
      "Temps 3 : contrôler au rétroviseur intérieur",
      "Contrôler au rétroviseur extérieur gauche",
      "Contrôler l'angle mort gauche",
      "Mettre le clignotant gauche",
      "Repartir volant à gauche, puis se replacer au milieu de la voie",
      "Rouler dans la voie de droite",
    ],
    sources: [
      "Avertir les autres usagers avant de changer de direction, notamment pour se porter à gauche ou traverser la chaussée, ou pour reprendre sa place dans la circulation après un arrêt : R412-10. Chaque temps du demi-tour est annoncé : clignotant gauche au premier, droit au deuxième, gauche au troisième (décision de Timy du 07/10/2026). Au deuxième temps, en marche arrière volant à droite, l'arrière de la voiture part vers sa droite : le clignotant est de ce côté.",
      "Demi-tour en trois temps, méthode de Timy (07/10/2026) : en avant vers la gauche jusqu'au trottoir opposé ; en arrière, volant à droite, jusqu'au bord de départ ; en avant pour repartir dans la voie de droite du nouveau sens. À chaque temps, la méthode V·V·C·C (vitesse, volant, contrôles, clignotants) : procédures de stage (classeur de Timy), section 4.3, et mémo de la fiche ECF C1-D. La scène engage le rapport et tourne le volant à l'arrêt, puis montre les contrôles, le clignotant et le mouvement ; le volant ne se voit pas d'en haut, la trajectoire en montre l'effet.",
      "Contrôles dans l'ordre de Timy (07/10/2026), du côté de la manœuvre, puis clignotant, puis action : rétroviseur intérieur, rétroviseur extérieur gauche, angle mort gauche, aux premier et troisième temps. Avant de reculer, le regard qui fait le tour complet (devant ; à gauche, rétroviseur et angle mort ; lunette arrière ; à droite, rétroviseur et angle mort) ; pendant le recul, regard par-dessus l'épaule droite vers la lunette arrière, à l'allure du pas : méthode de Timy pour la marche arrière.",
      "Feux de recul blancs, qui s'allument au passage de la marche arrière : cours du thème 22 (contrôlé). La scène les allume dès l'arrêt qui finit le premier temps, où la marche arrière est engagée, et les éteint dès l'arrêt qui finit le deuxième, où la première l'est.",
      "Marquage : unité u de 5 cm, modulation T'1 (traits de 1,50 m, vides de 5 m) : IISR 7e partie, art. 113-1 ; axiale T'1 de largeur 2u, admise en agglomération : art. 113-2 ; pas de ligne de rive, les bordures de trottoir matérialisant généralement le bord de la chaussée en milieu urbain : art. 114-5.",
      "Choix de dessin, sans portée réglementaire : rue droite d'agglomération, sans circulation ni voiture garée (C1 : trafic faible ou nul) ; chaussée de 7,2 m, en deux voies de 3,6 m : dans la rue de 7 m des autres scènes, la voiture, braquée à fond et arrêtée à 0,3 m de chaque trottoir, mordrait de 0,12 m sur le trottoir opposé au troisième temps, son coin avant droit balayant un cercle de 6,01 m de rayon autour du centre de rotation, et une chaussée de 7,1 m ne lui laisserait que 0,08 m : 7,2 m est la plus petite largeur, au décimètre, où elle n'en passe pas plus près (0,28 m) qu'au premier temps ; 8 m de trottoir de chaque côté et 8 m de rue au nord du départ (le plus petit nombre entier de mètres qui loge à leur place les repères des animations réduites), 22 m au sud (la portée du cône du regard : le cône du rétroviseur intérieur, tourné vers l'arrière, tient dans l'image) ; cadre fixe de 23,2 m sur 30 m, le monde entier : toute la manœuvre se voit à chaque instant, plus grande que dans un cadre de 46 m de haut ; voiture de 4,5 m sur 1,8 m qui pivote autour de son essieu arrière, à 1,45 m de son centre (porte-à-faux arrière de 0,80 m, l'ordre de grandeur d'une compacte) ; braquage de 4,1 m de rayon au centre de la voiture (le plus petit retenu, celui d'une citadine), soit 3,835 m à l'essieu et, avec 2,7 m d'empattement et 1,55 m de voie (l'écart entre les roues d'un essieu), un diamètre de braquage d'environ 10,7 m entre trottoirs, l'ordre de grandeur d'une compacte ; volant tourné à fond à l'arrêt : chaque temps est un arc qui part de l'arrêt ; départ arrêté au bord droit, flanc droit à 0,3 m du trottoir ; chaque temps va jusqu'à 0,3 m du trottoir qu'il approche : 61,7 degrés au premier temps, 31,9 au deuxième, 86,4 au troisième, jusqu'au cap opposé à celui du départ ; en roulant, au plus près des trottoirs, 0,23 m au premier temps (l'arrière se déporte de 0,07 m vers le trottoir de départ) et 0,28 m au troisième ; recentrage dans la voie, sans clignotant (un déplacement dans sa voie, pas un changement de direction) : 0,65 m vers la droite sur 8 m d'avance, le plus petit nombre entier de mètres qui garde la voiture à 0,6 m au moins de la bordure, la marge des autres scènes entre un flanc et la bordure qu'il longe (0,63 m au plus près ; 7 m la mèneraient à 0,56 m, 5 m à 0,31 m), puis roues droites au milieu de la voie pendant 1,0 s ; 5 km/h en avant, 4 km/h en arrière, au pas, mesurés au milieu de l'essieu arrière (dans les arcs, le centre de la voiture va 7 % plus vite), allure prise et perdue à 1,0 m/s² ; arrêts de 5,4 s au départ, puis de 7,0 s et 6,4 s aux deux rebroussements : le temps des gestes faits à l'arrêt ; clignotant allumé après les contrôles, 2,0 s avant chaque départ, éteint dès l'arrêt qui finit son temps, le dernier au bout du troisième virage ; cône du regard de 22 m, ouvert de 16 degrés de part et d'autre ; regard, par rapport à l'axe de la voiture : 180 degrés pendant 1,2 s (rétroviseur intérieur), 170 degrés à gauche pendant 1,2 s (rétroviseur extérieur gauche), 120 degrés à gauche pendant 1,0 s (angle mort, tête tournée vers l'épaule), droit devant pendant les 2,0 s du clignotant ; au premier temps, en avançant volant à gauche, regard vers un point fixe, là où va la voiture (regarder où l'on va : la voiture suit le regard, fiche ECF C1-C) : la bordure du trottoir opposé droit devant la voiture à son arrêt, là où l'axe de la voiture arrêtée la coupe ; le regard part à 55,3 degrés à gauche et suit le point : pendant tout le premier temps, le cône contient l'endroit où s'arrête l'avant de la voiture ; pendant ses quatre premiers cinquièmes, le trajet de la voiture 3 m plus loin, jusqu'à l'arrêt au plus ; pendant son dernier cinquième, le freinage vers le trottoir, le trajet de l'avant de la voiture 1 et 2 m plus loin, jusqu'à l'arrêt au plus (il ne reste alors au centre de la voiture que 0,83 m à parcourir, à côté du conducteur) ; au troisième temps, du départ jusqu'au milieu de la voie, regard vers un point fixe, le milieu de la voie de droite du nouveau sens, loin devant : 13,9 m au-delà du bout du troisième virage, où la voiture s'aligne sur sa voie, soit 10 s à 5 km/h (regard loin, analyser la situation 10 à 15 s devant : fiche ECF C1-I ; 10 s, le bas de la fourchette, gardent le point dans l'image) ; le regard part à 78,4 degrés à gauche, vers où va la voiture, et suit le point : le cône contient, pendant toute l'étape, le milieu de la voie 10 m devant la voiture et son trajet 6 m plus loin ; pendant le dernier cinquième du virage, son trajet 2, 3, 4 et 6 m plus loin ; pendant le recentrage, son trajet 3, 4 et 6 m plus loin, et 2 m plus loin pendant 68 % du recentrage (ce point proche, vu de l'œil, passe jusqu'à 18,4 degrés à droite de l'axe de la voiture) ; dans ces deux phases, jamais le milieu de la voie opposée 10 m devant ; à chaque arrivée, pendant 1,0 s, le regard reste sur le trottoir devant lequel la voiture s'arrête (droit devant, puis par la lunette arrière) ; tour du regard en 4,0 s (devant, à gauche, derrière, à droite) ; recul par-dessus l'épaule droite, 165 degrés à droite, distinct du rétroviseur intérieur à 180 ; droit devant une fois la voiture au milieu de sa voie ; scène de 38,8 s, dont 1,0 s d'image tenue à la fin.",
    ],
    construire: unique(demiTour),
  },
};
