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
  from "./scene-geometrie.js?v=20261004a";
import { DESSIN, HORS_MONDE, carrefourEnCroix, giratoire, trajetGiratoire } from "./scene-decors.js?v=20261004a";
import { REGARD_PORTEE } from "./scene-regard.js?v=20261004a";
import { SEUILS } from "./scene-controles.js?v=20261004a";

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
};
