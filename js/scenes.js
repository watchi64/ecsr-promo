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
 * Chaque entrée : titre et etapesModele (intitulés que propose l'éditeur : un
 * cours peut les reformuler, pas en changer le nombre), repris du catalogue des
 * blocs (js/catalogue-blocs.js, que l'éditeur lit sans charger ce module) ;
 * construire() (définition calculée une seule fois, puis gelée en profondeur :
 * le moteur, l'éditeur et les tests la partagent sans pouvoir la modifier).
 * Les sources de chaque scène (ce qu'elle montre et d'où cela vient, recopié dans
 * la fiche de vérification du cours) sont dans sources/scenes.js : hors du
 * module livré, seuls les tests et les fiches les lisent.
 */
import { KMH, DEG, GABARITS, PORTIERE, trajet, chronologie, tempsAtteint, premiereAbscisse, pointA, emprise, etatActeur,
  polygonesSeChevauchent, rectangle, pointDansPolygone } from "./scene-geometrie.js?v=20261022d";
import { DESSIN, HORS_MONDE, carrefourEnCroix, giratoire, trajetGiratoire, routeVirages, rue }
  from "./scene-decors.js?v=20261022d";
import { REGARD_PORTEE, REGARD_DUREE_TOUR_MIN, REGARD_MAX_SUIVI, oeil, regardContient, coneRegard }
  from "./scene-regard.js?v=20261022d";
import { SEUILS } from "./scene-controles.js?v=20261022d";
import { CATALOGUE } from "./catalogue-blocs.js?v=20261022d";

// Le code d'une scène et son titre : celui du catalogue des blocs (js/catalogue-blocs.js), la seule source des titres.
const identite = (code) => ({ code, titre: CATALOGUE[code].titre });

const MARGE_ARRET = 0.3;             // m entre la voiture arrêtée et la limite (passage, ligne)
const TOLERANCE_ARRET = 0.7;         // m : écart admis par l'attente arretAvant, mesuré au milieu du pare-chocs
const TOLERANCE_PLACE = 0.2;         // m : écart latéral admis par l'attente d'une place le long du trottoir, au-delà du jeu
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
    ...identite("tourner-droite"), monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
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
    ...identite("tourner-gauche"), monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
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
    ...identite("giratoire"), monde: g.monde, limite: LIMITE_AGGLOMERATION, decor: g,
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

// ===== Regarder autour de soi à l'approche d'une intersection (procédures de stage, 5.1 ; fiche ECF C1-I) =====
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
    ...identite("regard-intersection"), monde: d.monde,
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

// ===== Diriger la voiture en ligne droite et en courbe (C1.7, méthode de Timy du 07/10) =====
//
// Route d'agglomération en S (routeVirages), sans autre usager. Avant chaque virage, l'élève regarde loin devant, freine
// en ligne droite et se place dans sa voie (un peu écarté du bord avant le virage à droite, à droite de sa voie avant le
// virage à gauche) ; il regarde la sortie du virage en le parcourant, puis réaccélère en sortie. Les valeurs ci-dessous
// (angles du regard compris) sont des choix de dessin, recopiés dans les sources de la scène.
const TRAJECTOIRE_COURBE = geler({
  // Degrés dont chaque virage fait tourner la route ; le rayon est celui du décor (DESSIN.rayonVirage, 40 m sur l'axe).
  // La route tourne nettement, et toute la scène tient à une échelle lisible sur un téléphone : l'image fixe des
  // animations réduites montre toutes les étapes, à la largeur du cadre. À 60 degrés (la valeur par défaut du décor), la
  // ligne droite entre les virages, qui porte la reprise, le regard loin devant et le freinage, s'étirerait presque d'ouest
  // en est : le dessin ferait 125 m de large au lieu de 65, et la voiture y serait presque deux fois plus petite.
  angleVirage: 30,
  // m de trottoir montré à gauche de l'approche et à droite de la sortie : le plus petit nombre entier de mètres qui loge
  // dans le dessin le repère numéroté de la dernière étape (animations réduites), posé à droite de la voiture.
  largeurTrottoir: 3,
  hauteurCadre: 46,           // m : cadre qui suit l'élève, sur toute la largeur du monde, sans changer l'échelle
  // km/h : 50 en ligne droite, la vitesse maximale en agglomération ; 35 dans les virages, soit 2,46 et 2,25 m/s²
  // d'accélération latérale sur les rayons parcourus (38,50 et 42,00 m), sous les 3,0 m/s² des contrôles.
  kmh: { approche: 50, virage: 35 },
  freinage: 2.0,              // m/s² : freiner avant chaque virage, en ligne droite (freinage progressif ramené à sa moyenne)
  reprise: 1.5,               // m/s² : réaccélérer en sortie de virage, l'accélération des autres scènes
  // m d'avance pendant lesquels la voiture se déplace dans sa voie, comme pour serrer à droite avant de tourner : à 35 km/h,
  // l'étape dure 1,2 s.
  avanceDecalage: 12,
  duree: { loin: 1.0 },       // s à l'écran : regard loin devant, à 50 km/h, avant de freiner (la durée minimale d'une étape)
  regard: { devant: 0 },      // degrés par rapport au cap : droit devant, hors des virages
  // m : pendant chaque virage, le regard vise le trajet de la voiture, ce nombre de mètres au-delà de la sortie du virage,
  // dans la ligne droite qui suit : là où va la voiture, le regard porté loin dans la courbe (la voiture suit le regard). La
  // plus grande distance, en mètres entiers, qui garde le bout de l'axe du regard dans la voie de l'élève pendant les deux
  // virages : le bout de l'axe du triangle dessiné, au milieu de son bord lointain (21,15 m de l'œil), y reste avec 11 cm de
  // marge au plus près, à l'entrée du virage à gauche, et le point de l'axe à la portée du regard (22 m) avec 27 cm. À 11 m,
  // le bout de l'axe du triangle entrerait dans la voie opposée à l'entrée du virage à gauche ; en deçà de 5 m, il tomberait
  // sur le trottoir de droite à la fin du virage à gauche.
  viseeAuDelaSortie: 10,
});

function trajectoireCourbe() {
  const choix = TRAJECTOIRE_COURBE;
  const h = DESSIN.voie, demiLongueur = GABARITS.voiture.longueur / 2;
  const vitesse = { approche: choix.kmh.approche * KMH, virage: choix.kmh.virage * KMH };
  // Distances parcourues : à 50 km/h pendant le regard loin devant ; en freinant de 50 à 35 km/h ; en réaccélérant de 35
  // à 50 km/h.
  const dLoin = vitesse.approche * choix.duree.loin;
  const dFrein = (vitesse.approche ** 2 - vitesse.virage ** 2) / (2 * choix.freinage);
  const dReprise = (vitesse.approche ** 2 - vitesse.virage ** 2) / (2 * choix.reprise);
  // Placement dans la voie : la voiture quitte le centre de sa voie de `decalage`, vers l'axe avant le virage à droite
  // (s'écarter un peu du bord), vers la bordure avant le virage à gauche (rester à droite de sa voie). Son flanc finit à
  // DESSIN.margeTrajectoire (0,60 m) de la ligne qu'il approche, la marge des autres scènes le long d'une bordure.
  const decalage = h / 2 - DESSIN.demiLargeurVoiture - DESSIN.margeTrajectoire;    // 0,25 m
  if (!(decalage > 0)) throw new Error("trajectoire-courbe : voie trop étroite pour se placer dans la voie avant les virages");
  // Départ : l'arrière de la voiture à DESSIN.retraitBord du bord bas, la voiture entière dans l'image.
  const depart = DESSIN.retraitBord + demiLongueur;
  // Décor : chaque ligne droite loge exactement ce qui s'y passe. Approche : départ, regard loin devant, freinage,
  // placement ; entre les virages : reprise, regard loin devant, freinage, placement ; sortie : reprise, jusqu'à
  // DESSIN.retraitBord du bord haut, où finit le trajet de l'élève comme dans les autres scènes.
  const d = routeVirages({
    approche: depart + dLoin + dFrein + choix.avanceDecalage,
    entreVirages: dReprise + dLoin + dFrein + choix.avanceDecalage,
    sortie: dReprise + DESSIN.retraitBord,
    largeurTrottoir: choix.largeurTrottoir, angle: choix.angleVirage,
  });
  const { xAxeApproche, rayon, angle } = d.reperes;
  // Rayons parcourus : au centre de la voie, le virage à droite se prend à (rayon - h / 2) de son centre et le virage à
  // gauche à (rayon + h / 2) ; le placement les allonge tous deux de `decalage`. L'accélération latérale, à 35 km/h, se
  // mesure sur ces rayons.
  const rayons = { droite: rayon - h / 2 + decalage, gauche: rayon + h / 2 + decalage };
  for (const [cote, r] of Object.entries(rayons)) {
    const laterale = vitesse.virage ** 2 / r;
    if (!(laterale < SEUILS.accelerationLaterale)) {
      throw new Error(`trajectoire-courbe : ${laterale.toFixed(2)} m/s² d'accélération latérale dans le virage à ${cote},`
        + ` sur ${r} m de rayon : réduire l'allure de virage`);
    }
  }

  // Trajet : centre de la voie, regard loin devant, freinage, placement à gauche dans la voie, virage à droite qui suit la
  // route ; reprise, regard loin devant, freinage, placement à droite dans la voie, virage à gauche ; reprise jusqu'au
  // bord haut. Les placements sont des décalages dans la voie, sans changement de voie : pas de clignotant.
  const t = trajet(xAxeApproche + h / 2, d.monde.hauteur - depart, -90).droit(dLoin);
  const sFrein1 = t.longueur;
  t.droit(dFrein);
  const sEcart = t.longueur;
  t.decaler(-decalage, choix.avanceDecalage);
  const sVirage1 = t.longueur;
  t.virage(rayons.droite, angle, { suitLaRoute: true });
  const sFinVirage1 = t.longueur;
  t.droit(dReprise);
  const sLoin2 = t.longueur;
  t.droit(dLoin);
  const sFrein2 = t.longueur;
  t.droit(dFrein);
  const sDroite = t.longueur;
  t.decaler(2 * decalage, choix.avanceDecalage);
  const sVirage2 = t.longueur;
  t.virage(rayons.gauche, -angle, { suitLaRoute: true });
  const sFinVirage2 = t.longueur;
  t.droit(dReprise);
  const chemin = t.fin();
  // Points visés pendant les virages : sur le trajet de la voiture, viseeAuDelaSortie m après la fin de chaque virage, dans la
  // ligne droite qui suit (avant le placement qui précède le virage à gauche, avant le bout du trajet après lui).
  const visee = choix.viseeAuDelaSortie;
  if (!(visee > 0 && sFinVirage1 + visee <= sDroite && sFinVirage2 + visee <= chemin.longueur)) {
    throw new Error(`trajectoire-courbe : point visé à ${visee} m au-delà de la sortie : hors de la ligne droite qui suit le virage`);
  }
  const surLeTrajet = (s) => { const p = pointA(chemin, s); return [p.x, p.y]; };
  const vers = { droite: surLeTrajet(sFinVirage1 + visee), gauche: surLeTrajet(sFinVirage2 + visee) };

  // Allure : 50 km/h, freinage achevé avant le placement, donc avant le virage ; 35 km/h tenus dans le placement et dans
  // tout le virage ; reprise dès la sortie du virage.
  const { approche: v50, virage: v35 } = choix.kmh;
  const profil = [
    { s: 0, kmh: v50 }, { s: sFrein1, kmh: v50 }, { s: sEcart, kmh: v35 }, { s: sFinVirage1, kmh: v35 },
    { s: sLoin2, kmh: v50 }, { s: sFrein2, kmh: v50 }, { s: sDroite, kmh: v35 }, { s: sFinVirage2, kmh: v35 },
    { s: chemin.longueur, kmh: v50 },
  ];
  const { devant } = choix.regard;
  return {
    ...identite("trajectoire-courbe"), monde: d.monde,
    limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: choix.hauteurCadre },
    acteurs: [{ id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil }],
    etapes: [
      { s: 0, regard: { angle: devant } },
      { s: sFrein1, regard: { angle: devant } },
      { s: sEcart, regard: { angle: devant } },
      { s: sVirage1, regard: { vers: vers.droite } },
      { s: sFinVirage1, regard: { angle: devant } },
      { s: sLoin2, regard: { angle: devant } },
      { s: sFrein2, regard: { angle: devant } },
      { s: sDroite, regard: { angle: devant } },
      { s: sVirage2, regard: { vers: vers.gauche } },
      { s: sFinVirage2, regard: { angle: devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "voie de droite", zone: d.voies.droite, de: 0, a: chemin.longueur, emprise: true },
      { type: "vitesseMax", acteur: "eleve", kmh: v35, de: sVirage1, a: sFinVirage1 },
      { type: "pasDeDeceleration", acteur: "eleve", nom: "virage à droite", de: sVirage1, a: sFinVirage1 },
      { type: "vitesseMax", acteur: "eleve", kmh: v35, de: sVirage2, a: sFinVirage2 },
      { type: "pasDeDeceleration", acteur: "eleve", nom: "virage à gauche", de: sVirage2, a: sFinVirage2 },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "droite", s: chemin.longueur },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "gauche", s: chemin.longueur },
    ],
  };
}

// ===== Démarrer et s'arrêter (C1.4 : méthode de Timy du 07/10/2026, fiche ECF C1-D) =====
//
// Rue calme, sans circulation (C1 : trafic faible ou nul). La voiture de l'élève, garée le long du trottoir droit entre
// deux voitures en stationnement, rejoint sa voie, roule, puis se rapproche du bord et s'arrête. Contrôles dans l'ordre de
// Timy : rétroviseur intérieur, rétroviseur extérieur du côté de la manœuvre, angle mort du même côté, clignotant, action.
// Les valeurs ci-dessous sont des choix de dessin, recopiés dans les sources de la scène.
const DEMARRER_ARRETER = geler({
  // m de trottoir montrés de chaque côté de la chaussée : le plus petit nombre entier de mètres qui garde dans l'image le
  // cône du rétroviseur intérieur au départ et celui du regard devant à l'arrêt (4,46 m au moins).
  trottoir: 5,
  hauteurCadre: 46,           // m : cadre qui suit l'élève, sur toute la largeur du monde, sans changer l'échelle
  // km/h : allure réduite tant que la voiture quitte sa place, entre les voitures garées ; rue calme, trafic nul.
  kmh: { deboitement: 10, rue: 30 },
  reprise: 1.5,               // m/s² : accélération au départ, puis jusqu'à l'allure de la rue
  freinage: 1.5,              // m/s² : ralentir progressivement, du début du rangement jusqu'à l'arrêt
  // m d'avance des deux décalages, la voiture braquant autour de son essieu arrière. Déboîtement : le plus progressif, en
  // mètres entiers, qui n'approche jamais la voiture garée devant à moins de l'écart que laisse la voie (0,75 m ; à 12 m,
  // l'élève la serrerait davantage) ; plus court, la voiture braquerait plus serré. Rangement : se rapprocher du bord en
  // douceur, à l'allure de la rue ; plus court, l'avant droit, qui balaie vers le trottoir en se rangeant, en passerait plus
  // près ; plus long, il ne resterait presque plus de ligne droite pour s'arrêter le long du trottoir.
  avance: { deboitement: 11, rangement: 20 },
  // m entre les pare-chocs : la voiture garée derrière l'élève, de près, comme dans une file de voitures en stationnement
  // (l'élève part en avant et ne s'en approche pas), et celle de devant (place assez dégagée pour partir sans manœuvre).
  ecartGarees: { derriere: 1.0, devant: 8 },
  // m : l'étape « Rouler au centre de sa voie » commence ce peu après la fin du déboîtement, où le clignotant gauche
  // s'éteint : la plus petite avance, au centimètre près, qui montre le clignotant éteint sur l'image figée de l'étape.
  avanceEtapeRouler: 0.01,
  // s à l'écran : coups d'œil aux rétroviseurs et à l'angle mort ; clignotant allumé avant d'agir (2 s au moins, pas
  // davantage pour ne pas allonger l'attente) ; allure de la rue tenue avant de préparer l'arrêt.
  duree: { retroviseurInterieur: 1.2, retroviseurExterieur: 1.2, angleMort: 1.0, clignotant: 2.0, rouler: 1.0 },
  // degrés par rapport au cap, donnés pour la droite : les contrôles du départ, à gauche, les prennent négatifs.
  regard: { retroviseurInterieur: 180, retroviseurExterieur: 170, angleMort: 120, devant: 0 },
});

function demarrerArreter() {
  const choix = DEMARRER_ARRETER;
  const vitesse = { deboitement: choix.kmh.deboitement * KMH, rue: choix.kmh.rue * KMH };
  // Décalage de la place au centre de la voie de droite, par-dessus la bande de stationnement : du centre d'une voiture
  // garée (flanc droit à DESSIN.jeuStationnement du trottoir) au centre de la voie, 2,55 m.
  const ecart = DESSIN.voie / 2 + DESSIN.largeurStationnement - DESSIN.jeuStationnement - DESSIN.demiLargeurVoiture;
  const longueurDecalage = (avance) => trajet(0, 0, -90).decaler(ecart, avance).longueur;

  // Abscisses du trajet. Départ : décalage vers la gauche dès le départ, reprise jusqu'à 10 km/h, tenus jusqu'au centre de
  // la voie ; puis reprise jusqu'à 30 km/h, tenus duree.rouler avant les contrôles de l'arrêt (rétroviseur intérieur,
  // rétroviseur extérieur droit, angle mort droit, clignotant droit), faits à 30 km/h ; rangement : décalage vers la droite
  // en ralentissant dès son début, jusqu'à l'arrêt, en ligne droite le long du trottoir.
  const sVoie = longueurDecalage(choix.avance.deboitement);
  const sAllureDeboitement = vitesse.deboitement ** 2 / (2 * choix.reprise);
  if (!(sAllureDeboitement < sVoie)) throw new Error("demarrer-arreter : 10 km/h atteints après le centre de la voie : allonger le déboîtement");
  const sAllureRue = sVoie + (vitesse.rue ** 2 - vitesse.deboitement ** 2) / (2 * choix.reprise);
  const sRetroInterieur = sAllureRue + vitesse.rue * choix.duree.rouler;
  const sRetroExterieur = sRetroInterieur + vitesse.rue * choix.duree.retroviseurInterieur;
  const sAngleMort = sRetroExterieur + vitesse.rue * choix.duree.retroviseurExterieur;
  const sClignotant = sAngleMort + vitesse.rue * choix.duree.angleMort;
  const sRangement = sClignotant + vitesse.rue * choix.duree.clignotant;
  const sBord = sRangement + longueurDecalage(choix.avance.rangement);
  const sArret = sRangement + vitesse.rue ** 2 / (2 * choix.freinage);
  if (!(sArret > sBord)) throw new Error("demarrer-arreter : arrêt avant d'avoir rejoint le bord : freiner moins fort ou raccourcir le rangement");

  // Rue : REGARD_PORTEE derrière la place de départ (le cône du rétroviseur intérieur, tourné vers l'arrière, tient dans le
  // monde) et devant le point d'arrêt (le cône du regard devant aussi). Un décalage avance de son avance, exactement.
  const avance = choix.avance.deboitement + (sRangement - sVoie) + choix.avance.rangement + (sArret - sBord);
  const d = rue({ longueur: REGARD_PORTEE + avance + REGARD_PORTEE, largeurTrottoir: choix.trottoir,
    stationnement: DESSIN.largeurStationnement });
  const { xBordDroit, xAxe } = d.reperes;
  const xGaree = xBordDroit - DESSIN.jeuStationnement - DESSIN.demiLargeurVoiture;    // centre d'une voiture garée
  const y0 = d.monde.hauteur - REGARD_PORTEE;
  // La voiture braque autour du milieu de son essieu arrière (option essieu) : le trajet et ses abscisses sont ceux de
  // l'essieu, parti GABARITS.voiture.essieu derrière le centre de la voiture garée ; en ligne droite, cap au nord, le
  // centre est droit devant l'essieu, donc les décalages et les avances valent pour lui aussi.
  const chemin = trajet(xGaree, y0, -90, { essieu: GABARITS.voiture.essieu })
    .decaler(-ecart, choix.avance.deboitement, { changementDeVoie: true })
    .droit(sRangement - sVoie)
    .decaler(ecart, choix.avance.rangement, { changementDeVoie: true })
    .droit(sArret - sBord)
    .fin();

  // À l'arrêt : les trois contrôles, puis le clignotant gauche, allumé à la fin de l'angle mort et duree.clignotant avant
  // le départ. Il s'éteint au centre de la voie (fin du déboîtement) ; le clignotant droit, allumé après les contrôles de
  // l'arrêt, s'éteint à l'arrêt.
  const d1 = choix.duree.retroviseurInterieur, d2 = d1 + choix.duree.retroviseurExterieur, d3 = d2 + choix.duree.angleMort;
  const pause = d3 + choix.duree.clignotant;
  const profil = [
    { s: 0, kmh: 0, pause }, { s: sAllureDeboitement, kmh: choix.kmh.deboitement }, { s: sVoie, kmh: choix.kmh.deboitement },
    { s: sAllureRue, kmh: choix.kmh.rue }, { s: sRangement, kmh: choix.kmh.rue }, { s: chemin.longueur, kmh: 0 },
  ];
  const demiLongueur = GABARITS.voiture.longueur / 2;
  const r = choix.regard;
  // Côté droit de la chaussée (de l'axe au trottoir) ; place d'arrivée : le long du trottoir, flanc droit à
  // DESSIN.jeuStationnement du trottoir, à TOLERANCE_PLACE près.
  const coteDroit = rectangle(xAxe, 0, xBordDroit, d.monde.hauteur);
  const place = rectangle(xBordDroit - DESSIN.jeuStationnement - GABARITS.voiture.largeur - TOLERANCE_PLACE, 0, xBordDroit,
    d.monde.hauteur);
  return {
    ...identite("demarrer-arreter"), monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: choix.hauteurCadre },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil,
        clignotant: [
          { cote: "gauche", de: 0, a: sVoie, delai: d3, delaiFin: 0 },
          { cote: "droite", de: sClignotant, a: chemin.longueur, delaiFin: 0 },
        ] },
      { id: "gareeDerriere", gabarit: "voiture", stationne: true,
        pose: { x: xGaree, y: y0 + 2 * demiLongueur + choix.ecartGarees.derriere, cap: -90 } },
      { id: "gareeDevant", gabarit: "voiture", stationne: true,
        pose: { x: xGaree, y: y0 - 2 * demiLongueur - choix.ecartGarees.devant, cap: -90 } },
    ],
    etapes: [
      { s: 0, regard: { angle: r.retroviseurInterieur } },
      { s: 0, delai: d1, regard: { angle: -r.retroviseurExterieur } },
      { s: 0, delai: d2, regard: { angle: -r.angleMort } },
      { s: 0, delai: d3, regard: { angle: r.devant } },
      { s: 0, delai: pause, regard: { angle: r.devant } },
      { s: sVoie + choix.avanceEtapeRouler, regard: { angle: r.devant } },
      { s: sRetroInterieur, regard: { angle: r.retroviseurInterieur } },
      { s: sRetroExterieur, regard: { angle: r.retroviseurExterieur } },
      { s: sAngleMort, regard: { angle: r.angleMort } },
      { s: sClignotant, regard: { angle: r.devant } },
      { s: sRangement, regard: { angle: r.devant } },
      { s: sBord, regard: { angle: r.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "côté droit de la chaussée", zone: coteDroit, de: 0, a: chemin.longueur, emprise: true },
      { type: "dans", acteur: "eleve", nom: "voie de droite", zone: d.voies.droite, de: sVoie, a: sRangement, emprise: true },
      { type: "dans", acteur: "eleve", nom: "place le long du trottoir", zone: place, de: sBord, a: chemin.longueur, emprise: true },
      { type: "vitesseMax", acteur: "eleve", nom: "quitter la place", kmh: choix.kmh.deboitement, de: 0, a: sVoie },
      { type: "vitesseMax", acteur: "eleve", nom: "rue calme", kmh: choix.kmh.rue, de: 0, a: chemin.longueur },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "droite", s: sClignotant },
    ],
  };
}

// ===== Marche arrière en ligne droite le long du trottoir (C1.9, méthode de Timy du 07/10/2026) =====
//
// La voiture de l'élève est arrêtée dans la voie de droite, le long du trottoir, tournée vers le nord ; elle recule tout
// droit vers le sud, sans autre usager en mouvement (C1 : trafic faible ou nul). Ordre des étapes, choix du contrôleur de
// chantier soumis à la validation de Timy, aligné sur la méthode V·V·C·C (vitesse, volant, contrôles, clignotants), moyen
// mnémotechnique du demi-tour appliqué ici par extension, et sur le temps 2 du demi-tour en trois temps : la marche arrière
// s'engage d'abord (ses feux de recul préviennent les autres usagers), puis le tour du regard, à l'arrêt ; ensuite le recul
// à l'allure du pas, le regard par-dessus l'épaule droite vers la lunette arrière ; enfin l'arrêt, regard devant. Les
// valeurs ci-dessous (angles du regard compris) sont des choix de dessin, recopiés dans les sources de la scène.
const MARCHE_ARRIERE = geler({
  // m de trottoir montrés de chaque côté : le plus petit nombre entier de mètres pour que, sur l'image figée du tour, le
  // cône du regard à droite, côté trottoir, se voie au-delà de la voiture sur au moins la largeur d'une voie (DESSIN.voie).
  largeurTrottoir: 4,
  // m : longueur de la rue, le plus petit nombre entier de mètres qui garde dans le dessin le cône du regard par la lunette
  // jusqu'à l'arrêt.
  longueur: 60,
  // m, du bord haut au centre de la voiture au départ : le plus petit nombre entier de mètres qui garde dans le dessin le
  // cône du regard pendant tout le tour, dont la pointe passe à REGARD_PORTEE de l'œil dans toutes les directions.
  depart: 23,
  // m : cadre qui suit l'élève, sur toute la largeur du monde, sans changer l'échelle ; il montre en entier les cônes du
  // tour tournés devant et derrière.
  hauteurCadre: 46,
  jeuTrottoir: 0.3,           // m entre le flanc droit de la voiture et la bordure du trottoir (plan)
  recul: 15,                  // m parcourus en marche arrière, en ligne droite le long du trottoir (plan)
  // m entre l'arrière de la voiture de l'élève arrêtée et l'avant de la voiture garée, posée au-delà de la zone de recul :
  // la zone de recul est libre sur ses 15 m, et l'élève ne s'arrête pas contre la voiture garée.
  ecartVoitureGaree: 2,
  kmh: { recul: 4 },          // allure du pas (plan), sous le garde-fou des contrôles automatiques (SEUILS.vitesseMarcheArriere)
  reprise: 1.0,               // m/s² : mise en mouvement progressive, en marche arrière
  freinage: 1.0,              // m/s² : arrêt progressif
  // s à l'écran : engager la marche arrière (la durée minimale d'une étape) ; tour du regard, à l'arrêt (sa durée minimale :
  // un quart de tour par seconde).
  duree: { engager: 1.0, tour: REGARD_DUREE_TOUR_MIN },
  // degrés par rapport au cap de la caisse, + à droite : devant ; par-dessus l'épaule droite, vers la lunette arrière (plan :
  // 165, distinct du rétroviseur intérieur, à 180).
  regard: { devant: 0, lunette: 165 },
});

function marcheArriere() {
  const choix = MARCHE_ARRIERE;
  const d = rue({ longueur: choix.longueur, largeurTrottoir: choix.largeurTrottoir });
  const demiLongueur = GABARITS.voiture.longueur / 2;

  // Trajet parti en marche arrière (la tortue va vers le sud, cap de marche 90 ; la caisse regarde le nord), le flanc droit
  // à jeuTrottoir de la bordure du trottoir, sur toute la longueur du recul.
  const x = d.reperes.xBordDroit - choix.jeuTrottoir - DESSIN.demiLargeurVoiture;
  const chemin = trajet(x, choix.depart, 90, { arriere: true }).droit(choix.recul).fin();
  const arret = pointA(chemin, chemin.longueur);

  // Les cônes du regard restent dans la hauteur du dessin : pendant le tour, la pointe du cône passe à REGARD_PORTEE de l'œil
  // dans toutes les directions ; le cône de la lunette, qui recule avec la voiture, descend le plus bas à l'arrêt.
  const oDepart = oeil(pointA(chemin, 0));
  if (oDepart.y - REGARD_PORTEE < 0) throw new Error("marche-arriere : le tour du regard sort du dessin, éloigner le départ du bord haut");
  const lunette = coneRegard(arret.cap + choix.regard.lunette * DEG, oeil(arret));
  if (Math.max(oDepart.y + REGARD_PORTEE, ...lunette.map(([, y]) => y)) > d.monde.hauteur) {
    throw new Error("marche-arriere : un cône du regard sort du dessin par le bas, allonger la rue");
  }

  // À l'arrêt pendant l'étape 1 (la marche arrière s'engage) et le tour du regard, puis recul à l'allure du pas, atteinte et
  // quittée progressivement, jusqu'au bout du recul.
  const v = choix.kmh.recul * KMH;
  const sAllure = v ** 2 / (2 * choix.reprise);
  const sFrein = chemin.longueur - v ** 2 / (2 * choix.freinage);
  if (!(sAllure < sFrein)) throw new Error("marche-arriere : recul trop court pour atteindre l'allure du pas");
  const attente = choix.duree.engager + choix.duree.tour;
  const profil = [
    { s: 0, kmh: 0, pause: attente }, { s: sAllure, kmh: choix.kmh.recul },
    { s: sFrein, kmh: choix.kmh.recul }, { s: chemin.longueur, kmh: 0 },
  ];

  // Voiture en stationnement, au-delà de la zone de recul : le long du même trottoir, tournée vers le nord comme celle de
  // l'élève, son avant à ecartVoitureGaree de l'arrière de la voiture de l'élève arrêtée. Feux éteints (stationne).
  const yGaree = arret.y + 2 * demiLongueur + choix.ecartVoitureGaree;
  if (yGaree + demiLongueur > d.monde.hauteur) throw new Error("marche-arriere : la voiture garée sort du dessin, allonger la rue");
  return {
    ...identite("marche-arriere"), monde: d.monde,
    limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: choix.hauteurCadre },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil },
      { id: "garee", gabarit: "voiture", stationne: true, pose: { x, y: yGaree, cap: -90 } },
    ],
    etapes: [
      { s: 0, regard: { angle: choix.regard.devant } },
      { s: 0, delai: choix.duree.engager, regard: { tour: true } },
      { s: 0, delai: attente, regard: { angle: choix.regard.lunette } },
      { s: chemin.longueur, regard: { angle: choix.regard.devant } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "voie de droite", zone: d.voies.droite, de: 0, a: chemin.longueur, emprise: true },
      { type: "vitesseMax", acteur: "eleve", kmh: choix.kmh.recul, de: 0, a: chemin.longueur },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "droite", s: chemin.longueur },
      { type: "pasDeClignotantAvant", acteur: "eleve", cote: "gauche", s: chemin.longueur },
      { type: "dans", acteur: "garee", nom: "voie de droite", zone: d.voies.droite, de: 0, a: 0, emprise: true },
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
  // m : trottoir montré de chaque côté de la chaussée, le plus petit nombre entier de mètres qui garde dans le monde le cône
  // du rétroviseur intérieur au départ, tourné vers l'arrière (4,46 m au moins) ; il loge aussi, à droite de la voiture au
  // départ, le repère des étapes 1 à 5 (animations réduites). Rue montrée au nord du départ : le plus petit nombre entier de
  // mètres où chaque repère des animations réduites trouve sa place ; à 7 m, celui des étapes 6 à 9 ne tiendrait plus sur
  // la diagonale devant la voiture arrêtée au bout du premier temps : il passerait derrière elle, sur les places de celui
  // des étapes 10 à 15, qui n'en aurait plus aucune (au sud du départ, REGARD_PORTEE : le cône du rétroviseur intérieur,
  // tourné vers l'arrière, tient dans le monde, comme dans les autres scènes). Le cadre, fixe, est le monde entier : la
  // manœuvre entière se voit à chaque instant, plus grande que dans un cadre de 46 m de haut.
  trottoir: 5,
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
    ...identite("demi-tour"), monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
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

// ===== Sortir du véhicule côté chaussée (C1.2, « Sortir » ; ordre des contrôles de Timy) =====
//
// Rue calme. La voiture de l'élève est garée le long du trottoir de droite, immobilisée, moteur coupé : un acteur posé, qui
// ne bouge pas de toute la scène. Un cycliste arrive par l'arrière dans la voie de droite, le guidon assez près du flanc de
// la voiture pour passer dans la zone de la portière. Avant d'ouvrir, le conducteur contrôle au rétroviseur intérieur, puis
// au rétroviseur extérieur gauche, où le cycliste se voit ; il le laisse passer en le suivant des yeux, contrôle l'angle mort
// gauche par-dessus l'épaule, puis ouvre la portière, le regard gardé vers l'arrière gauche. Les valeurs ci-dessous sont des
// choix de dessin, recopiés dans les sources de la scène.
const SORTIE_PORTIERE = geler({
  // m de trottoir montrés de chaque côté de la chaussée : le plus petit nombre entier de mètres où le repère des étapes des
  // animations réduites (« 1-5 », 2,85 m de large) tient à droite de la voiture.
  trottoir: 3,
  kmhCycliste: 18,            // km/h : l'allure d'un cycliste en ville, de 15 à 20 km/h
  // m entre le flanc gauche de la voiture et le guidon du cycliste : il la longe de près, dans la zone que balaierait la
  // portière, qui s'écarte du flanc de 0,63 m (PORTIERE, à 35 degrés).
  ecartGuidon: 0.4,
  // s à l'écran : coups d'œil aux rétroviseurs et à l'angle mort, ceux de demarrer-arreter ; laisser passer le cycliste, la
  // plus courte durée, au dixième de seconde, qui le met à devantPortiere m au moins devant la portière quand elle s'ouvre,
  // après l'angle mort ; ouverture de la portière, départ et arrivée amortis.
  duree: { retroviseurInterieur: 1.2, retroviseurExterieur: 1.2, laisserPasser: 1.4, angleMort: 1.0, ouverture: 1.5 },
  // degrés : où le conducteur voit le cycliste au début de l'étape où il le suit des yeux : à hauteur du conducteur, dans les
  // REGARD_MAX_SUIVI (100) degrés où le regard suit un usager ; plus tôt, le cycliste serait encore derrière lui.
  angleSuivi: 95,
  ouverture: PORTIERE.ouvertureMax,   // degrés : une première ouverture, mesurée
  devantPortiere: 10,         // m : quand la portière s'ouvre, le cycliste est au moins à cette distance devant elle
  // degrés par rapport à l'axe de la voiture, - à gauche : rétroviseur intérieur, rétroviseur extérieur gauche, angle mort
  // gauche (tête tournée vers l'épaule), gardé pendant l'ouverture.
  regard: { retroviseurInterieur: 180, retroviseurExterieur: -170, angleMort: -120 },
});

function sortiePortiere() {
  const choix = SORTIE_PORTIERE, dur = choix.duree, r = choix.regard;
  const { largeur: W } = GABARITS.voiture, demiVelo = GABARITS.velo.longueur / 2;
  const v = choix.kmhCycliste * KMH;
  if (choix.angleSuivi > REGARD_MAX_SUIVI) throw new Error("sortie-portiere : le regard ne suivrait pas le cycliste, derrière le conducteur");
  // Instants des étapes, la voiture à l'arrêt : rétroviseur intérieur dès le début, rétroviseur extérieur, le cycliste suivi
  // des yeux, angle mort, puis l'ouverture de la portière.
  const tExterieur = dur.retroviseurInterieur;
  const tSuivi = tExterieur + dur.retroviseurExterieur;
  const tAngleMort = tSuivi + dur.laisserPasser;
  const tOuverture = tAngleMort + dur.angleMort;

  // Positions du cycliste le long de la rue, mesurées depuis le centre de la voiture vers le sud (y de l'écran ; la voiture
  // regarde le nord). Au début de l'étape 3, le conducteur le voit à angleSuivi degrés de l'axe : il est derrière l'œil de
  // l'écart latéral fois tan(angleSuivi - 90). Il roule tout droit à allure constante.
  const repere = { x: 0, y: 0, cap: -90 * DEG }, o = oeil(repere);
  const dxCycliste = -W / 2 - choix.ecartGuidon - GABARITS.velo.largeur / 2;      // à gauche du centre de la voiture
  const ySuivi = o.y + (o.x - dxCycliste) * Math.tan((choix.angleSuivi - 90) * DEG);
  const yCycliste = (t) => ySuivi - v * (t - tSuivi);
  // Quand la portière s'ouvre, l'arrière du cycliste est au moins à devantPortiere m devant la charnière.
  const devant = -(yCycliste(tOuverture) + demiVelo) - PORTIERE.charniere;
  if (devant < choix.devantPortiere) {
    throw new Error(`sortie-portiere : le cycliste n'est qu'à ${devant.toFixed(2)} m devant la portière quand elle s'ouvre :`
      + " le laisser passer plus longtemps");
  }
  // Rue : la voiture au milieu, le cycliste entier dans le dessin, à DESSIN.retraitBord au moins des bords, au début de la
  // scène (à l'arrière) et quand la portière s'ouvre (à l'avant) : le plus petit nombre entier de mètres.
  const demiRue = Math.max(yCycliste(0) + demiVelo, -(yCycliste(tOuverture) - demiVelo)) + DESSIN.retraitBord;
  const d = rue({ longueur: Math.ceil(2 * demiRue), largeurTrottoir: choix.trottoir, stationnement: DESSIN.largeurStationnement });
  const { xBordDroit } = d.reperes;
  const voiture = { x: xBordDroit - DESSIN.jeuStationnement - W / 2, y: d.monde.hauteur / 2, cap: -90 };

  // Cycliste : parti dans le dessin, dans la voie de droite, il sort par le bord haut (son trajet finit HORS_MONDE au-delà).
  const y0 = voiture.y + yCycliste(0);
  const chemin = trajet(voiture.x + dxCycliste, y0, -90).droit(y0 + HORS_MONDE).fin();
  // Place de la voiture : le long du trottoir, flanc droit à DESSIN.jeuStationnement du trottoir, à TOLERANCE_PLACE près.
  const place = rectangle(xBordDroit - DESSIN.jeuStationnement - W - TOLERANCE_PLACE, 0, xBordDroit, d.monde.hauteur);
  return {
    ...identite("sortie-portiere"), monde: d.monde, limite: LIMITE_AGGLOMERATION, decor: d,
    camera: { largeur: d.monde.largeur, hauteur: d.monde.hauteur },
    acteurs: [
      { id: "eleve", role: "eleve", gabarit: "voiture", stationne: true, pose: voiture,
        portiere: [{ t: tOuverture, angle: 0 }, { t: tOuverture + dur.ouverture, angle: choix.ouverture }] },
      { id: "cycliste", gabarit: "velo", chemin,
        profil: [{ s: 0, kmh: choix.kmhCycliste }, { s: chemin.longueur, kmh: choix.kmhCycliste }] },
    ],
    etapes: [
      { s: 0, regard: { angle: r.retroviseurInterieur } },
      { s: 0, delai: tExterieur, regard: { angle: r.retroviseurExterieur } },
      { s: 0, delai: tSuivi, regard: { suivre: "cycliste" } },
      { s: 0, delai: tAngleMort, regard: { angle: r.angleMort } },
      { s: 0, delai: tOuverture, regard: { angle: r.angleMort } },
    ],
    attentes: [
      { type: "dans", acteur: "eleve", nom: "place le long du trottoir", zone: place, de: 0, a: 0, emprise: true },
      { type: "dans", acteur: "cycliste", nom: "voie de droite", zone: d.voies.droite, de: 0, a: chemin.longueur, emprise: true },
    ],
  };
}

// Titre et étapes modèles : ceux du catalogue des blocs (js/catalogue-blocs.js), que lit aussi l'éditeur.
const meta = (code) => ({ titre: CATALOGUE[code].titre, etapesModele: CATALOGUE[code].etapesModele });

export const SCENES = {
  "tourner-droite": { ...meta("tourner-droite"), construire: unique(tournerDroite) },
  "tourner-gauche": { ...meta("tourner-gauche"), construire: unique(tournerGauche) },
  giratoire: { ...meta("giratoire"), construire: unique(giratoireScene) },
  "regard-intersection": { ...meta("regard-intersection"), construire: unique(regardIntersection) },
  "trajectoire-courbe": { ...meta("trajectoire-courbe"), construire: unique(trajectoireCourbe) },
  "demarrer-arreter": { ...meta("demarrer-arreter"), construire: unique(demarrerArreter) },
  "marche-arriere": { ...meta("marche-arriere"), construire: unique(marcheArriere) },
  "demi-tour": { ...meta("demi-tour"), construire: unique(demiTour) },
  "sortie-portiere": { ...meta("sortie-portiere"), construire: unique(sortiePortiere) },
};
