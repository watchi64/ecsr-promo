import { test } from "node:test";
import assert from "node:assert/strict";
import { trajet, rectangle } from "../js/scene-geometrie.js";
import { controlerScene } from "../js/scene-controles.js";

const constant = (chemin, kmh) => [{ s: 0, kmh }, { s: chemin.longueur, kmh }];
const eleve = (chemin, profil, extra = {}) => ({ id: "eleve", role: "eleve", gabarit: "voiture", chemin, profil, ...extra });
function scene(acteurs, extra = {}) {
  return {
    code: "essai", titre: "Essai", monde: { largeur: 80, hauteur: 80 }, limite: 50,
    decor: { obstacles: [], marquages: [], panneaux: [] },
    acteurs, etapes: [{ s: 0 }, { s: 10 }], attentes: [], ...extra,
  };
}
const texte = (def) => controlerScene(def).join("\n");
const trottoir = { nature: "trottoir", poly: rectangle(3.5, 0, 10, 80) };

test("une scène conforme ne renvoie aucune erreur", () => {
  const c = trajet(1.75, 75, -90).droit(50).fin();
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 30))], { decor: { obstacles: [trottoir], marquages: [], panneaux: [] } })), []);
});

test("un véhicule qui mord le trottoir est signalé", () => {
  const c = trajet(3.0, 75, -90).droit(50).fin();
  assert.match(texte(scene([eleve(c, constant(c, 30))], { decor: { obstacles: [trottoir], marquages: [], panneaux: [] } })),
    /eleve touche un trottoir/);
});

test("la limite de vitesse est contrôlée", () => {
  const c = trajet(1.75, 75, -90).droit(50).fin();
  assert.match(texte(scene([eleve(c, constant(c, 60))])), /dépasse 50 km\/h/);
});

test("l'accélération latérale est bornée", () => {
  const c = trajet(0, 70, -90).droit(10).virage(5, 90, { suitLaRoute: true }).droit(10).fin();
  assert.match(texte(scene([eleve(c, constant(c, 30))])), /accélération latérale/);
});

test("l'accélération longitudinale est bornée", () => {
  const c = trajet(0, 70, -90).droit(50).fin();
  assert.match(texte(scene([eleve(c, [{ s: 0, kmh: 0 }, { s: 5, kmh: 50 }, { s: 50, kmh: 50 }])])), /accélération longitudinale/);
});

test("un changement de direction sans clignotant est signalé", () => {
  const c = trajet(0, 70, -90).droit(20).virage(10, 90).droit(10).fin();
  assert.match(texte(scene([eleve(c, constant(c, 15))])), /clignotant droite attendu/);
});

test("un clignotant allumé assez tôt du bon côté passe", () => {
  const c = trajet(0, 70, -90).droit(20).virage(10, 90).droit(10).fin();
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 15), { clignotant: [{ cote: "droite", de: 0, a: 40 }] })])), []);
});

test("un clignotant du mauvais côté est signalé", () => {
  const c = trajet(0, 70, -90).droit(20).virage(10, 90).droit(10).fin();
  const t = texte(scene([eleve(c, constant(c, 15), { clignotant: [{ cote: "gauche", de: 0, a: 40 }] })]));
  assert.match(t, /clignotant droite attendu/);
  assert.match(t, /clignotant gauche pendant un virage à droite/);
});

test("un virage qui suit la route n'exige pas de clignotant", () => {
  const c = trajet(0, 70, -90).droit(20).virage(10, 90, { suitLaRoute: true }).droit(10).fin();
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 15))])), []);
});

test("des étapes qui ne se suivent pas sont signalées", () => {
  const c = trajet(0, 70, -90).droit(50).fin();
  assert.match(texte(scene([eleve(c, constant(c, 30))], { etapes: [{ s: 10 }, { s: 5 }] })), /commence au plus tôt/);
});

test("deux acteurs qui se touchent sont signalés", () => {
  const c = trajet(0, 70, -90).droit(50).fin();
  const autre = { id: "autre", gabarit: "voiture", chemin: c, profil: constant(c, 15), depart: 0.5 };
  assert.match(texte(scene([eleve(c, constant(c, 15)), autre])), /eleve et autre se touchent/);
});

test("arretAvant : arrêt juste avant la ligne, trop loin, ou franchissement", () => {
  const c = trajet(0, 50, -90).droit(50).fin();
  const ligne = { type: "arretAvant", acteur: "eleve", nom: "ligne", point: [0, 20], normale: [0, 1], tolerance: 0.6 };
  const profil = (sArret) => [{ s: 0, kmh: 30 }, { s: 10, kmh: 30 }, { s: sArret, kmh: 0, pause: 1 }, { s: 50, kmh: 20 }];
  assert.deepEqual(controlerScene(scene([eleve(c, profil(27.45))], { attentes: [ligne] })), []);
  assert.match(texte(scene([eleve(c, profil(25.75))], { attentes: [ligne] })), /s'arrête à 2\.00 m/);
  assert.match(texte(scene([eleve(c, constant(c, 30))], { attentes: [ligne] })), /franchit « ligne »/);
});

test("rotation : le sens anti-horaire est vérifié", () => {
  const c = trajet(10, 0, -90).virage(10, -180, { suitLaRoute: true }).fin();
  const att = (sens) => ({ type: "rotation", acteur: "eleve", nom: "îlot", centre: [0, 0], sens, de: 0, a: c.longueur });
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 15))], { monde: { largeur: 30, hauteur: 30 }, attentes: [att("anti-horaire")] })), []);
  assert.match(texte(scene([eleve(c, constant(c, 15))], { attentes: [att("horaire")] })), /mauvais sens/);
});

test("cede : entrer dans la zone avant que l'autre en soit sorti est signalé", () => {
  const zone = rectangle(-3.5, -3.5, 3.5, 3.5);
  const cAutre = trajet(-40, -1.75, 0).droit(80).fin();
  const autre = { id: "autre", gabarit: "voiture", chemin: cAutre, profil: constant(cAutre, 30) };
  const c = trajet(1.75, 40, -90).droit(80).fin();
  const att = { type: "cede", acteur: "eleve", autre: "autre", nom: "carrefour", zone };
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 10)), autre], { attentes: [att] })), []);
  assert.match(texte(scene([eleve(c, constant(c, 30)), autre], { attentes: [att] })), /avant que autre en soit sorti/);
});

test("pasDeClignotantAvant et dans", () => {
  const c = trajet(1.75, 75, -90).droit(50).fin();
  const avecClignotant = eleve(c, constant(c, 30), { clignotant: [{ cote: "droite", de: 5, a: 40 }] });
  assert.match(texte(scene([avecClignotant], { attentes: [{ type: "pasDeClignotantAvant", acteur: "eleve", cote: "droite", s: 10 }] })),
    /clignotant droite allumé avant/);
  assert.deepEqual(controlerScene(scene([avecClignotant], { attentes: [{ type: "pasDeClignotantAvant", acteur: "eleve", cote: "droite", s: 4 }] })), []);
  const voie = rectangle(0, 0, 3.5, 80);
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 30))], { attentes: [{ type: "dans", acteur: "eleve", nom: "voie", zone: voie, de: 0, a: 50, emprise: true }] })), []);
  const decale = trajet(3.0, 75, -90).droit(50).fin();
  assert.match(texte(scene([eleve(decale, constant(decale, 30))], { attentes: [{ type: "dans", acteur: "eleve", nom: "voie", zone: voie, de: 0, a: 50, emprise: true }] })),
    /sort de « voie »/);
  assert.match(texte(scene([eleve(c, constant(c, 30))], { attentes: [{ type: "dans", acteur: "fantome", nom: "voie", zone: voie, de: 0, a: 1 }] })),
    /acteur « fantome » inconnu/);
});

// ===== Amendement du 03/10 : entrées et sorties hors du monde, continuité de la vitesse =====
//
// Décor des essais qui suivent : le monde fait 80 m sur 80 m (celui de scene()), l'élève monte vers le nord
// le long de x = 1,75 et les autres usagers évoluent à x = 40 ou plus, ou traversent sa rangée bien après lui :
// aucun contact ne vient brouiller le contrôle essayé. Sauf mention contraire, un véhicule roule à 36 km/h
// (10 m/s : un mètre de trajet dure un dixième de seconde), de sorte que les durées se lisent sans calcul. Une
// scène refusée ne porte qu'un seul défaut (on attend son message exact et rien d'autre) ; une scène acceptée
// est entièrement propre (aucun message, de quelque contrôle que ce soit).

// L'élève : `longueur` mètres vers le nord depuis (1,75 ; 75), donc `longueur` / 10 secondes.
function eleveNord(longueur, extra = {}) {
  const c = trajet(1.75, 75, -90).droit(longueur).fin();
  return eleve(c, constant(c, 36), extra);
}
// Un autre véhicule : `longueur` mètres vers le nord le long de x, depuis (x ; y0).
function nord(id, x, y0, longueur, extra = {}) {
  const c = trajet(x, y0, -90).droit(longueur).fin();
  return { id, gabarit: "voiture", chemin: c, profil: constant(c, 36), ...extra };
}
// Un véhicule qui traverse la rangée y = 60 vers l'est, de x0 à x1, parti à t = 5 s (l'élève a passé cette rangée
// vers t = 1,5 s).
function est(x0, x1, extra = {}) {
  const c = trajet(x0, 60, 0).droit(x1 - x0).fin();
  return { id: "autre", gabarit: "voiture", chemin: c, profil: constant(c, 36), depart: 5, ...extra };
}
// Un piéton qui marche 10 m vers l'est depuis (40 ; 40) à 5 km/h (7,2 s). Sans `apparition`, il est visible dès le début.
function marcheur(extra = {}) {
  const c = trajet(40, 40, 0).droit(10).fin();
  return { id: "pieton", gabarit: "pieton", chemin: c, profil: [{ s: 0, kmh: 5 }, { s: 10, kmh: 5 }], ...extra };
}
// Un véhicule qui entre par le sud du monde (y = 90) et en sort par le nord (y = -10) : il roule de t = 3 s à t = 13 s.
const traversee = () => nord("autre", 40, 90, 100, { depart: 3 });
// Les messages sans leur instant ni la suite : « autre apparaît dans le cadre ».
const sansInstant = (messages) => messages.map((m) => m.replace(/ à t = .*$/, ""));

test("un véhicule qui entre et sort par les bords du monde est conforme, même lancé à son apparition", () => {
  // Invisible avant t = 3 s, « autre » apparaît hors du monde (y = 90) déjà à 36 km/h : sans état visible
  // précédent, ce n'est pas un saut de vitesse. Il disparaît à t = 13 s hors du monde (y = -10), bien avant la
  // fin de l'élève (20 s). Un véhicule garé (acteur fixe) dans le monde n'est contrôlé ni à l'entrée ni à la sortie.
  const garee = { id: "garee", gabarit: "voiture", pose: { x: 60, y: 40, cap: 0 } };
  assert.deepEqual(controlerScene(scene([eleveNord(200), traversee(), garee])), []);
});

test("un véhicule qui apparaît dans le cadre à son départ est signalé", () => {
  // Parti de (40 ; 70), un point du monde : à t = 3 s la voiture surgirait de nulle part.
  assert.deepEqual(controlerScene(scene([eleveNord(200), nord("autre", 40, 70, 100, { depart: 3 })])),
    ["autre apparaît dans le cadre à t = 3.0 s : son trajet doit commencer hors du monde"]);
  // La règle suit l'apparition « depart », pas le gabarit : un piéton qui n'apparaît qu'à son départ y est soumis...
  assert.deepEqual(controlerScene(scene([eleveNord(200), marcheur({ depart: 2, apparition: "depart" })])),
    ["pieton apparaît dans le cadre à t = 2.0 s : son trajet doit commencer hors du monde"]);
  // ... et l'élève aussi, s'il part après le début de la scène.
  assert.deepEqual(controlerScene(scene([eleveNord(200, { depart: 2 })])),
    ["eleve apparaît dans le cadre à t = 2.0 s : son trajet doit commencer hors du monde"]);
});

test("un acteur visible dès le début, ou parti à t = 0, n'a pas à entrer par le bord du monde", () => {
  // Apparition « debut » : la voiture attend dans le cadre, visible dès la première image, puis démarre depuis l'arrêt.
  const attend = nord("autre", 40, 40, 20, { depart: 2, apparition: "debut", profil: [{ s: 0, kmh: 0 }, { s: 10, kmh: 20 }, { s: 20, kmh: 0 }] });
  assert.deepEqual(controlerScene(scene([eleveNord(200), attend])), []);
  // Parti à t = 0 : visible dès la première image, personne ne la voit apparaître.
  const presente = nord("autre", 40, 40, 20, { profil: [{ s: 0, kmh: 36 }, { s: 20, kmh: 0 }] });
  assert.deepEqual(controlerScene(scene([eleveNord(200), presente])), []);
  // Un piéton attend au bord du trottoir (apparition par défaut : « debut ») puis se met en marche à t = 2 s.
  assert.deepEqual(controlerScene(scene([eleveNord(200), marcheur({ depart: 2 })])), []);
});

test("un véhicule qui disparaît dans le cadre est signalé", () => {
  // Il entre par le sud (y = 90) mais finit à (40 ; 30) en roulant : à t = 9 s il s'évanouirait au milieu de l'image.
  assert.deepEqual(controlerScene(scene([eleveNord(200), nord("autre", 40, 90, 60, { depart: 3 })])),
    ["autre disparaît dans le cadre à t = 9.0 s : son trajet doit finir hors du monde"]);
});

test("l'élève, un véhicule arrêté et un piéton peuvent finir dans le monde", () => {
  // L'élève finit à (1,75 ; 25) en roulant : son image est tenue, rien ne disparaît.
  assert.deepEqual(controlerScene(scene([eleveNord(50)])), []);
  // Un véhicule qui finit à l'arrêt reste visible à son arrivée : il peut s'être garé dans le monde.
  const gare = nord("autre", 40, 90, 60, { depart: 3, profil: [{ s: 0, kmh: 36 }, { s: 60, kmh: 0 }] });
  assert.deepEqual(controlerScene(scene([eleveNord(200), gare])), []);
  // Un piéton s'arrête au bout de son trajet et ne quitte jamais l'image.
  assert.deepEqual(controlerScene(scene([eleveNord(200), marcheur()])), []);
});

test("c'est l'emprise entière qui compte : un contact avec le bord, ou un centre dehors et un coin dedans, est dans le cadre", () => {
  // Roulant vers l'est, la voiture a son avant à 2,25 m devant son centre et son arrière à 2,25 m derrière.
  const entree = (x0) => sansInstant(controlerScene(scene([eleveNord(200), est(x0, 100)])));
  assert.deepEqual(entree(-10), []);
  assert.deepEqual(entree(-2.26), []);                                  // pare-chocs avant à 1 cm du bord ouest
  assert.deepEqual(entree(-2.25), ["autre apparaît dans le cadre"]);    // pare-chocs avant sur le bord : un contact compte
  assert.deepEqual(entree(-1), ["autre apparaît dans le cadre"]);       // centre hors du monde, avant dedans
  const sortie = (x1) => sansInstant(controlerScene(scene([eleveNord(200), est(-10, x1)])));
  assert.deepEqual(sortie(100), []);
  assert.deepEqual(sortie(82.26), []);                                  // pare-chocs arrière à 1 cm du bord est
  assert.deepEqual(sortie(82.25), ["autre disparaît dans le cadre"]);   // pare-chocs arrière sur le bord
  assert.deepEqual(sortie(81), ["autre disparaît dans le cadre"]);      // centre hors du monde, arrière dedans
});

test("le monde n'est pas forcément carré : la largeur borne x, la hauteur borne y", () => {
  // « autre » traverse la rangée y = 60 de x = -10 à x = 100.
  const traverse = (monde) => controlerScene(scene([eleveNord(200), est(-10, 100)], { monde }));
  assert.deepEqual(sansInstant(traverse({ largeur: 120, hauteur: 80 })), ["autre disparaît dans le cadre"]);  // x = 100 : dans un monde large de 120 m
  assert.deepEqual(traverse({ largeur: 80, hauteur: 120 }), []);                                              // ... et hors d'un monde large de 80 m
});

test("l'élève qui finit en mouvement pendant qu'un autre usager roule encore est signalé", () => {
  // L'élève finit en roulant à t = 5 s : son image serait tenue pendant que « autre » roule 5 s de plus.
  assert.deepEqual(controlerScene(scene([eleveNord(50), nord("autre", 40, 90, 100)])),
    ["l'élève finit en mouvement à t = 5.0 s alors que autre bouge jusqu'à t = 10.0 s : son image resterait figée"]);
  // Un piéton qui marche encore (jusqu'à t = 2 + 7,2 s) compte comme un acteur mobile.
  assert.deepEqual(controlerScene(scene([eleveNord(50), marcheur({ depart: 2 })])),
    ["l'élève finit en mouvement à t = 5.0 s alors que pieton bouge jusqu'à t = 9.2 s : son image resterait figée"]);
});

test("l'élève peut finir en même temps que les autres, ou à l'arrêt pendant qu'un autre roule encore", () => {
  // Même durée de part et d'autre (10 s) : personne ne bouge après l'élève.
  assert.deepEqual(controlerScene(scene([eleveNord(100), nord("autre", 40, 90, 100)])), []);
  // L'élève qui finit à l'arrêt (12 s, freinage à 2,5 m/s²) ne tient aucune image en mouvement : « autre » roule 20 s.
  const c = trajet(1.75, 75, -90).droit(100).fin();
  const freine = eleve(c, [{ s: 0, kmh: 36 }, { s: 80, kmh: 36 }, { s: 100, kmh: 0 }]);
  assert.deepEqual(controlerScene(scene([freine, nord("autre", 40, 90, 200)])), []);
});

test("un message par usager qui roule encore après l'élève", () => {
  assert.deepEqual(controlerScene(scene([eleveNord(50), nord("autre", 40, 90, 100), nord("second", 60, 90, 120)])), [
    "l'élève finit en mouvement à t = 5.0 s alors que autre bouge jusqu'à t = 10.0 s : son image resterait figée",
    "l'élève finit en mouvement à t = 5.0 s alors que second bouge jusqu'à t = 12.0 s : son image resterait figée",
  ]);
});

test("le départ lancé d'un véhicule visible qui attendait est un saut de vitesse", () => {
  // « autre » attend en (40 ; 40), visible dès le début, et part à t = 2 s directement à 36 km/h :
  // de 0 à 36 km/h en un dixième de seconde.
  const lance = nord("autre", 40, 40, 20, { depart: 2, apparition: "debut", profil: [{ s: 0, kmh: 36 }, { s: 20, kmh: 0 }] });
  assert.deepEqual(controlerScene(scene([eleveNord(200), lance])),
    ["autre : saut de vitesse de 36.0 km/h à t = 2.0 s"]);
  // L'élève n'y échappe pas.
  assert.deepEqual(controlerScene(scene([eleveNord(200, { depart: 2, apparition: "debut" })])),
    ["eleve : saut de vitesse de 36.0 km/h à t = 2.0 s"]);
});

test("un départ depuis l'arrêt, un piéton qui part au pas et une entrée lancée ne sont pas des sauts de vitesse", () => {
  // Une voiture visible qui démarre depuis l'arrêt, accélère à 1,5 m/s² puis s'arrête de même : vitesse continue.
  const douce = nord("autre", 40, 40, 20, { depart: 2, apparition: "debut", profil: [{ s: 0, kmh: 0 }, { s: 10, kmh: 20 }, { s: 20, kmh: 0 }] });
  assert.deepEqual(controlerScene(scene([eleveNord(200), douce])), []);
  // Un piéton qui attend au bord du trottoir et part d'un coup à 5 km/h (de 0 à 1,39 m/s en un dixième de
  // seconde) : les piétons sont exemptés.
  assert.deepEqual(controlerScene(scene([eleveNord(200), marcheur({ depart: 2 })])), []);
  // Un véhicule qui apparaît par le bord déjà à 36 km/h n'a pas d'état visible précédent : rien à comparer.
  assert.deepEqual(controlerScene(scene([eleveNord(200), traversee()])), []);
});

test("la limite d'un saut de vitesse est l'accélération de confort sur un pas de 0,1 s", () => {
  // Une voiture visible qui attendait part à t = 2 s avec une vitesse initiale non nulle, accélère à 2,5 m/s²
  // jusqu'à 36 km/h et sort du monde par le nord. 3 m/s² pendant 0,1 s font 0,3 m/s, soit 1,08 km/h : ce départ-là
  // passe, un peu plus vite non.
  const part = (kmh) => controlerScene(scene([eleveNord(200),
    nord("autre", 40, 15, 20, { depart: 2, apparition: "debut", profil: [{ s: 0, kmh }, { s: 20, kmh: 36 }] })]));
  assert.deepEqual(part(1.08), []);
  assert.deepEqual(part(1.2), ["autre : saut de vitesse de 1.2 km/h à t = 2.0 s"]);
});

test("les contrôles s'enchaînent dans l'ordre : étapes, trajectoires, entrées et sorties, clignotants, attentes", () => {
  // Un élève trop rapide qui vire sans clignotant, un véhicule qui attend puis part lancé (saut de vitesse), un
  // véhicule qui surgit dans le cadre, des étapes à l'envers et une attente sur un acteur inconnu.
  const c = trajet(0, 70, -90).droit(20).virage(10, 90).droit(10).fin();
  const attend = nord("attend", 40, 40, 20, { depart: 1, apparition: "debut", profil: [{ s: 0, kmh: 36 }, { s: 20, kmh: 0 }] });
  const surgit = nord("surgit", 60, 70, 100, { depart: 3 });
  const messages = controlerScene(scene([eleve(c, constant(c, 60)), attend, surgit], {
    etapes: [{ s: 10 }, { s: 5 }],
    attentes: [{ type: "dans", acteur: "fantome", nom: "voie", zone: rectangle(0, 0, 1, 1), de: 0, a: 1 }],
  }));
  const groupes = [
    [/étape 2/],
    [/dépasse 50 km\/h/, /accélération latérale/, /saut de vitesse/],
    [/apparaît dans le cadre/, /image resterait figée/],
    [/clignotant droite attendu/],
    [/« fantome » inconnu/],
  ];
  const rangs = groupes.map((groupe) => groupe.map((motif) => {
    const i = messages.findIndex((m) => motif.test(m));
    assert.ok(i >= 0, `message absent : ${motif}\n${messages.join("\n")}`);
    return i;
  }));
  for (let k = 0; k + 1 < rangs.length; k++) {
    assert.ok(Math.max(...rangs[k]) < Math.min(...rangs[k + 1]), `le groupe ${k + 1} doit précéder le groupe ${k + 2}\n${messages.join("\n")}`);
  }
});

// ===== Amendement du 03/10 (fiche ECF C2-E) : clignotant tôt et tout le long =====
//
// Trajet des essais : 20 m vers le nord, un virage à droite de 10 m de rayon (de s = 20 m à s = 35,71 m), puis
// 10 m vers l'est. À 15 km/h constants, l'arc est parcouru de t = 4,8 s à t = 8,57 s.
const virageDroite = () => trajet(0, 70, -90).droit(20).virage(10, 90).droit(10).fin();
const finArc = (c) => c.segments[1].debut + c.segments[1].longueur;
const clignotantJusqua = (c, profil, a) => controlerScene(scene([eleve(c, profil, { clignotant: [{ cote: "droite", de: 0, a }] })]));

test("un clignotant coupé juste après l'entrée dans l'arc est refusé", () => {
  // Éteint à s = 21 m (t = 5,04 s) : le premier dixième de seconde échantillonné sans lui est t = 5,1 s.
  const c = virageDroite();
  assert.deepEqual(clignotantJusqua(c, constant(c, 15), 21),
    ["eleve : clignotant droite éteint pendant le changement de direction (t = 5.1 s)"]);
});

test("le clignotant doit tenir jusqu'au bout de l'arc : la fin de l'arc est un instant contrôlé", () => {
  const c = virageDroite();
  assert.deepEqual(clignotantJusqua(c, constant(c, 15), finArc(c)), []);
  // Éteint 1 cm avant la fin de l'arc, entre deux dixièmes de seconde (8,5 s et la fin, 8,57 s).
  assert.deepEqual(clignotantJusqua(c, constant(c, 15), finArc(c) - 0.01),
    ["eleve : clignotant droite éteint pendant le changement de direction (t = 8.6 s)"]);
});

test("un arrêt dans l'arc ne dispense pas du clignotant : il reste allumé jusqu'à la fin de l'arc", () => {
  // La voiture ralentit jusqu'à l'arrêt à s = 25 m (dans l'arc, t = 12 s), attend 2 s puis repart.
  const c = virageDroite();
  const profil = [{ s: 0, kmh: 15 }, { s: 25, kmh: 0, pause: 2 }, { s: c.longueur, kmh: 15 }];
  assert.deepEqual(clignotantJusqua(c, profil, finArc(c)), []);
  // Coupé à l'arrêt : allumé pendant l'attente, éteint dès que la voiture repart (t = 14 s).
  assert.deepEqual(clignotantJusqua(c, profil, 25),
    ["eleve : clignotant droite éteint pendant le changement de direction (t = 14.0 s)"]);
});
