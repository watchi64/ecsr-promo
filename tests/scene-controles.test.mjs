import { test } from "node:test";
import assert from "node:assert/strict";
import { trajet, rectangle, KMH, rebroussements, preparerScene, etatActeur } from "../js/scene-geometrie.js";
import { controlerScene, SEUILS } from "../js/scene-controles.js";

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

test("les contrôles s'enchaînent dans l'ordre : étapes, trajectoires, marche arrière, entrées et sorties, clignotants, attentes", () => {
  // Un élève trop rapide qui vire sans clignotant, un véhicule qui attend puis part lancé (saut de vitesse), un
  // véhicule qui surgit dans le cadre, un livreur qui change de sens de marche sans s'arrêter puis recule trop vite,
  // des étapes à l'envers et une attente sur un acteur inconnu.
  const c = trajet(0, 70, -90).droit(20).virage(10, 90).droit(10).fin();
  const attend = nord("attend", 40, 40, 20, { depart: 1, apparition: "debut", profil: [{ s: 0, kmh: 36 }, { s: 20, kmh: 0 }] });
  const surgit = nord("surgit", 60, 70, 100, { depart: 3 });
  // Le livreur, à 9 km/h constants : 5 m vers le nord le long de x = 75, puis 60 m de recul, jusque hors du monde.
  const cLivreur = trajet(75, 30, -90).droit(5).inverser().droit(60).fin();
  const livreur = { id: "livreur", gabarit: "voiture", chemin: cLivreur, profil: constant(cLivreur, 9) };
  const messages = controlerScene(scene([eleve(c, constant(c, 60)), attend, surgit, livreur], {
    etapes: [{ s: 10 }, { s: 5 }],
    attentes: [{ type: "dans", acteur: "fantome", nom: "voie", zone: rectangle(0, 0, 1, 1), de: 0, a: 1 }],
  }));
  const groupes = [
    [/étape 2/],
    [/dépasse 50 km\/h/, /accélération latérale/, /saut de vitesse/],
    [/recule à/, /change de sens de marche/],
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
  // Éteint une fois passé s = 21 m : l'instant qui suit cette extinction (t = 5,04 s) est contrôlé.
  const c = virageDroite();
  assert.deepEqual(clignotantJusqua(c, constant(c, 15), 21),
    ["eleve : clignotant droite éteint pendant le changement de direction (t = 5.0 s)"]);
});

test("le clignotant doit tenir jusqu'au bout de l'arc : la fin de l'arc est un instant contrôlé", () => {
  const c = virageDroite();
  assert.deepEqual(clignotantJusqua(c, constant(c, 15), finArc(c)), []);
  // Éteint 1 cm avant la fin de l'arc, entre deux dixièmes de seconde (8,5 s et la fin, 8,57 s) : vu à l'instant qui
  // suit l'extinction (8,567 s).
  assert.deepEqual(clignotantJusqua(c, constant(c, 15), finArc(c) - 0.01),
    ["eleve : clignotant droite éteint pendant le changement de direction (t = 8.6 s)"]);
  // Un clignotant gauche qui l'emporte (premier du tableau) dans le dernier centimètre de l'arc, sans aucune extinction
  // dans l'arc : seul l'instant de la fin de l'arc le voit.
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 15), { clignotant: [
    { cote: "gauche", de: finArc(c) - 0.01, a: c.longueur }, { cote: "droite", de: 0, a: finArc(c) },
  ] })])), [
    "eleve : clignotant gauche pendant un virage à droite (t = 8.6 s)",
    "eleve : clignotant droite éteint pendant le changement de direction (t = 8.6 s)",
  ]);
});

test("une coupure de clignotant plus brève qu'un dixième de seconde, en plein arc, est refusée", () => {
  // Le droit s'éteint en s = 25 m (t = 6 s, delaiFin: 0) ; un autre droit se rallume 0,05 s plus tard (delai) : entre deux
  // dixièmes de seconde, mais l'instant qui suit l'extinction est contrôlé.
  const c = virageDroite();
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 15), { clignotant: [
    { cote: "droite", de: 0, a: 25, delaiFin: 0 }, { cote: "droite", de: 25, a: finArc(c), delai: 0.05 },
  ] })])), ["eleve : clignotant droite éteint pendant le changement de direction (t = 6.0 s)"]);
  // Sans coupure (rallumé à l'instant même de l'extinction) : accepté.
  assert.deepEqual(controlerScene(scene([eleve(c, constant(c, 15), { clignotant: [
    { cote: "droite", de: 0, a: 25, delaiFin: 0 }, { cote: "droite", de: 25, a: finArc(c), delai: 0 },
  ] })])), []);
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

// ===== Marche arrière : allure de recul, arrêt au rebroussement, côté du clignotant =====
//
// Les essais qui suivent gardent le monde de scene() (80 m sur 80 m) et des allures rondes : 18 km/h font 5 m/s, et
// 3,6 km/h font 1 m/s (un mètre de trajet dure une seconde). Une scène refusée ne porte qu'un seul défaut (on attend
// ses messages exacts et rien d'autre) ; une scène acceptée est entièrement propre.

// Aller et retour : 20 m vers le nord depuis (1,75 ; 60), rebroussement en s = 20 m, puis 20 m de recul vers le sud, la
// caisse toujours tournée vers le nord. Dans les profils, l'aller roule à 18 km/h pendant 15 m (3 s), puis freine sur
// les 5 derniers mètres (2,5 m/s² et 2 s pour s'arrêter : arrivée au rebroussement à t = 5 s).
const allerRetour = () => trajet(1.75, 60, -90).droit(20).inverser().droit(20).fin();

test("en marche arrière, l'allure ne dépasse pas SEUILS.vitesseMarcheArriere (6 km/h, l'allure du pas) ; en marche avant, la règle ne joue pas", () => {
  assert.equal(SEUILS.vitesseMarcheArriere, 6);
  // Départ en marche arrière, déjà lancé : 70 m de recul vers le sud depuis (1,75 ; 5), la caisse vers le nord.
  const recul = trajet(1.75, 5, 90, { arriere: true }).droit(70).fin();
  assert.deepEqual(controlerScene(scene([eleve(recul, constant(recul, 6))])), []);
  assert.deepEqual(controlerScene(scene([eleve(recul, constant(recul, 8))])),
    ["eleve recule à 8.0 km/h à t = 0.0 s (au plus 6 km/h)"]);
  // Le même déplacement en marche avant (la caisse vers le sud) : 8 km/h ne déclenchent rien.
  const avance = trajet(1.75, 5, 90).droit(70).fin();
  assert.deepEqual(controlerScene(scene([eleve(avance, constant(avance, 8))])), []);
});

test("après un rebroussement, l'allure de recul est contrôlée dès que la voiture recule ; l'aller n'est pas concerné", () => {
  // Aller à 18 km/h, arrêt d'une seconde au rebroussement (de t = 5 s à t = 6 s), puis reprise en recul à 2 m/s²
  // jusqu'à `kmh`, tenus jusqu'au bout.
  const c = allerRetour();
  const profil = (kmh) => [{ s: 0, kmh: 18 }, { s: 15, kmh: 18 }, { s: 20, kmh: 0, pause: 1 },
    { s: 20 + (kmh * KMH) ** 2 / (2 * 2), kmh }, { s: 40, kmh }];
  // 6 km/h tenus en recul sont admis.
  assert.deepEqual(controlerScene(scene([eleve(c, profil(6))])), []);
  // À 2 m/s² depuis t = 6 s, le recul passe 6 km/h à t = 6,83 s. L'allure se lit sur les échantillons de la chronologie
  // (tous les 4,9 cm sur cette rampe) : le premier au-delà est en s = 20,74 m, à t = 6,86 s et 6,20 km/h.
  assert.deepEqual(controlerScene(scene([eleve(c, profil(8))])),
    ["eleve recule à 6.2 km/h à t = 6.9 s (au plus 6 km/h)"]);
});

test("un pic d'allure bref en marche arrière est vu : l'allure se lit sur les échantillons de la chronologie", () => {
  // Recul à 5 km/h, puis une rampe jusqu'à 6,4 km/h (point du profil en s = 1,625 m) et une autre qui redescend à 5 km/h
  // en s = 1,875 m. Le recul dépasse 6 km/h moins d'un dixième de seconde, entre les instants t = 1,1 s et t = 1,2 s des
  // contrôles ; le premier échantillon au-delà est à t = 1,12 s, à 6,15 km/h.
  const recul = trajet(1.75, 5, 90, { arriere: true }).droit(70).fin();
  const profil = [{ s: 0, kmh: 5 }, { s: 1.375, kmh: 5 }, { s: 1.625, kmh: 6.4 }, { s: 1.875, kmh: 5 }, { s: 70, kmh: 5 }];
  assert.deepEqual(controlerScene(scene([eleve(recul, profil)])), ["eleve recule à 6.1 km/h à t = 1.1 s (au plus 6 km/h)"]);
});

test("un rebroussement se fait à l'arrêt : le profil y passe par 0 km/h", () => {
  // Aller à 18 km/h, freinage jusqu'au rebroussement (s = 20 m), puis recul à 5 km/h.
  const c = allerRetour();
  const profil = (auRebroussement) => [{ s: 0, kmh: 18 }, { s: 15, kmh: 18 }, auRebroussement, { s: 25, kmh: 5 }, { s: 40, kmh: 5 }];
  assert.deepEqual(controlerScene(scene([eleve(c, profil({ s: 20, kmh: 0, pause: 1 }))])), []);
  // Rebroussement à 2 km/h : la voiture passe de la marche avant à la marche arrière sans s'arrêter.
  assert.deepEqual(controlerScene(scene([eleve(c, profil({ s: 20, kmh: 2 }))])),
    ["eleve change de sens de marche sans s'arrêter (s = 20.0 m)"]);
  // À 0,02 km/h, la voiture passerait pour arrêtée au seuil de l'attente arretAvant (moins de 0,01 m/s), mais son profil
  // ne passe pas par 0 km/h : ce n'est pas un arrêt.
  assert.deepEqual(controlerScene(scene([eleve(c, profil({ s: 20, kmh: 0.02 }))])),
    ["eleve change de sens de marche sans s'arrêter (s = 20.0 m)"]);
});

test("c'est au rebroussement même que la vitesse s'annule : un arrêt 50 cm avant ou 50 cm après ne compte pas", () => {
  const c = allerRetour();
  for (const autour of [
    [{ s: 19.5, kmh: 0, pause: 1 }, { s: 20, kmh: 2 }],   // arrêt, puis 50 cm à 2 km/h jusqu'au rebroussement
    [{ s: 20, kmh: 2 }, { s: 20.5, kmh: 0, pause: 1 }],   // rebroussement à 2 km/h, arrêt 50 cm plus loin, en recul
  ]) {
    const profil = [{ s: 0, kmh: 18 }, { s: 15, kmh: 18 }, ...autour, { s: 25, kmh: 5 }, { s: 40, kmh: 5 }];
    assert.deepEqual(controlerScene(scene([eleve(c, profil)])), ["eleve change de sens de marche sans s'arrêter (s = 20.0 m)"]);
  }
});

test("chaque rebroussement est contrôlé, lu sur les segments du trajet", () => {
  // 20 m vers le nord, 10 m de recul, puis 20 m vers le nord : rebroussements en s = 20 m et en s = 30 m. Arrêt d'une
  // seconde au premier ; au second, arrêt d'une seconde aussi, ou passage à 3 km/h.
  const c = trajet(1.75, 60, -90).droit(20).inverser().droit(10).inverser().droit(20).fin();
  const profil = (auSecond) => [{ s: 0, kmh: 18 }, { s: 15, kmh: 18 }, { s: 20, kmh: 0, pause: 1 }, { s: 25, kmh: 5 },
    { s: 28, kmh: 5 }, auSecond, { s: 35, kmh: 18 }, { s: 50, kmh: 18 }];
  assert.deepEqual(controlerScene(scene([eleve(c, profil({ s: 30, kmh: 0, pause: 1 }))])), []);
  const sansArret = profil({ s: 30, kmh: 3 });
  assert.deepEqual(controlerScene(scene([eleve(c, sansArret)])), ["eleve change de sens de marche sans s'arrêter (s = 30.0 m)"]);
  // Le champ chemin.rebroussements n'est qu'une lecture : un trajet recopié sans lui (comme le fait raccourcirDebut,
  // dans js/scenes.js) garde ses rebroussements, lus sur les segments.
  const recopie = { segments: c.segments, longueur: c.longueur };
  assert.deepEqual(controlerScene(scene([eleve(recopie, sansArret)])), ["eleve change de sens de marche sans s'arrêter (s = 30.0 m)"]);
});

test("un arrêt d'un instant, sans pause, suffit au rebroussement : la vitesse y est nulle", () => {
  // Le profil touche 0 km/h au rebroussement (s = 20 m) et repart aussitôt en recul, sans pause.
  const c = allerRetour();
  assert.deepEqual(controlerScene(scene([eleve(c, [{ s: 0, kmh: 18 }, { s: 15, kmh: 18 }, { s: 20, kmh: 0 }, { s: 25, kmh: 5 },
    { s: 40, kmh: 5 }])])), []);
});

test("les piétons sont exemptés de l'allure de recul et de l'arrêt au rebroussement ; une voiture sur le même trajet ne l'est pas", () => {
  // 4 m vers l'est depuis (40 ; 40) à 8 km/h, rebroussement sans s'arrêter, puis 5 m à reculons jusqu'à l'arrêt.
  const chemin = trajet(40, 40, 0).droit(4).inverser().droit(5).fin();
  const profil = [{ s: 0, kmh: 8 }, { s: 4, kmh: 8 }, { s: 9, kmh: 0 }];
  assert.deepEqual(controlerScene(scene([eleveNord(200), { id: "pieton", gabarit: "pieton", chemin, profil }])), []);
  assert.deepEqual(controlerScene(scene([eleveNord(200), { id: "voiture", gabarit: "voiture", chemin, profil }])), [
    "voiture recule à 8.0 km/h à t = 1.8 s (au plus 6 km/h)",
    "voiture change de sens de marche sans s'arrêter (s = 4.0 m)",
  ]);
});

// Recul en virage, à 3,6 km/h : départ en marche arrière depuis (20 ; 40), la caisse vers le nord ; 5 m vers le sud, un
// quart de tour de 5 m de rayon (de s = 5 m à s = 12,85 m, donc de t = 5 s à t = 12,85 s), puis 5 m. Un virage de la
// tortue à gauche (-90) se fait volant tourné à droite : l'arrière part vers la droite de la caisse, l'est. Un virage de
// la tortue à droite (+90) se fait volant tourné à gauche.
const reculVirage = (angle, options) => trajet(20, 40, 90, { arriere: true }).droit(5).virage(5, angle, options).droit(5).fin();
const reculAvec = (c, clignotant) => controlerScene(scene([eleve(c, constant(c, 3.6), clignotant ? { clignotant } : {})]));

test("en marche arrière, le clignotant est celui de la caisse : volant à droite, clignotant droit ; volant à gauche, clignotant gauche", () => {
  const volantDroite = reculVirage(-90), volantGauche = reculVirage(90);
  assert.deepEqual(reculAvec(volantDroite, [{ cote: "droite", de: 0, a: finArc(volantDroite) }]), []);
  assert.deepEqual(reculAvec(volantGauche, [{ cote: "gauche", de: 0, a: finArc(volantGauche) }]), []);
  // Clignotant gauche pendant un recul volant à droite.
  assert.deepEqual(reculAvec(volantDroite, [{ cote: "gauche", de: 0, a: finArc(volantDroite) }]), [
    "eleve : clignotant droite attendu 2 s avant le changement de direction de s = 5.0 m (absent à t = 3.0 s)",
    "eleve : clignotant gauche pendant un virage à droite (t = 5.0 s)",
    "eleve : clignotant droite éteint pendant le changement de direction (t = 5.0 s)",
  ]);
});

test("chaque arc se lit dans sa propre marche : un virage de la tortue à droite est à droite en avant, à gauche en recul", () => {
  // À 3,6 km/h : 5 m vers le nord depuis (20 ; 70), quart de tour à droite (5 m de rayon), 5 m vers l'est ; freinage
  // sur le dernier mètre (2 s) jusqu'au rebroussement (s = 17,85 m, t = 18,85 s) et une seconde d'arrêt. Puis le recul :
  // 3 m vers l'ouest (reprise sur le premier, en 2 s), un quart de tour de la tortue à droite, volant tourné à gauche
  // (l'arrière part vers le nord, à gauche de la caisse), et 5 m vers le nord. L'arc du recul commence en s = 20,85 m, à
  // t = 23,85 s.
  const c = trajet(20, 70, -90).droit(5).virage(5, 90).droit(5).inverser().droit(3).virage(5, 90).droit(5).fin();
  const [, enAvant, , , enRecul] = c.segments;
  const sRebroussement = c.segments[3].debut;
  const profil = [{ s: 0, kmh: 3.6 }, { s: sRebroussement - 1, kmh: 3.6 }, { s: sRebroussement, kmh: 0, pause: 1 },
    { s: sRebroussement + 1, kmh: 3.6 }, { s: c.longueur, kmh: 3.6 }];
  const avec = (clignotant) => controlerScene(scene([eleve(c, profil, { clignotant })]));
  assert.deepEqual(avec([{ cote: "droite", de: 0, a: enAvant.debut + enAvant.longueur },
    { cote: "gauche", de: sRebroussement, a: enRecul.debut + enRecul.longueur }]), []);
  // Le clignotant droit gardé tout du long convient au virage en avant, pas à celui du recul.
  assert.deepEqual(avec([{ cote: "droite", de: 0, a: c.longueur }]), [
    "eleve : clignotant gauche attendu 2 s avant le changement de direction de s = 20.9 m (absent à t = 21.9 s)",
    "eleve : clignotant droite pendant un virage à gauche (t = 23.9 s)",
    "eleve : clignotant gauche éteint pendant le changement de direction (t = 23.9 s)",
  ]);
});

test("en marche arrière, le clignotant s'allume toujours au moins 2 s avant le virage et tient jusqu'à la fin de l'arc", () => {
  const c = reculVirage(-90);
  // Allumé en s = 4 m, à t = 4 s : une seconde seulement avant le virage.
  assert.deepEqual(reculAvec(c, [{ cote: "droite", de: 4, a: finArc(c) }]),
    ["eleve : clignotant droite attendu 2 s avant le changement de direction de s = 5.0 m (absent à t = 3.0 s)"]);
  // Éteint en s = 8,05 m, dans l'arc : le premier dixième de seconde échantillonné sans lui est t = 8,1 s.
  assert.deepEqual(reculAvec(c, [{ cote: "droite", de: 0, a: 8.05 }]),
    ["eleve : clignotant droite éteint pendant le changement de direction (t = 8.1 s)"]);
});

test("en marche arrière, virage qui suit la route, arc de moins de 30 degrés et décalage sans changement de voie se passent de clignotant ; un changement de voie se signale du côté de la caisse", () => {
  assert.deepEqual(reculAvec(reculVirage(-90, { suitLaRoute: true })), []);
  assert.deepEqual(reculAvec(reculVirage(-20)), []);
  // Après 3 m de recul (t = 3 s), décalage de 1 m vers la droite de la tortue (l'ouest), donc vers la gauche de la
  // caisse, sur 10 m d'avance.
  const decale = (options) => trajet(20, 40, 90, { arriere: true }).droit(3).decaler(1, 10, options).droit(3).fin();
  assert.deepEqual(reculAvec(decale()), []);
  const changement = decale({ changementDeVoie: true });
  assert.deepEqual(reculAvec(changement, [{ cote: "gauche", de: 0, a: changement.longueur }]), []);
  assert.deepEqual(reculAvec(changement), [
    "eleve : clignotant gauche attendu 2 s avant le changement de direction de s = 3.0 m (absent à t = 1.0 s)",
    "eleve : clignotant gauche éteint pendant le changement de direction (t = 3.0 s)",
  ]);
});

test("une marche arrière dans une rue à droite est conforme : arrêt au rebroussement, recul au pas, clignotant droit", () => {
  // 20 m vers le nord depuis (20 ; 70) à 18 km/h, freinage jusqu'à l'arrêt au rebroussement (s = 20 m), 2 s d'arrêt,
  // puis recul à 5 km/h : 2 m, un quart de tour volant tourné à droite (6 m de rayon) et 10 m vers l'est. Le clignotant
  // droit s'allume à l'arrêt et tient jusqu'à la fin du virage.
  const c = trajet(20, 70, -90).droit(20).inverser().droit(2).virage(6, -90).droit(10).fin();
  const arc = c.segments[2];
  const profil = [{ s: 0, kmh: 18 }, { s: 15, kmh: 18 }, { s: 20, kmh: 0, pause: 2 }, { s: 21, kmh: 5 }, { s: c.longueur, kmh: 5 }];
  assert.deepEqual(controlerScene(scene([eleve(c, profil, { clignotant: [{ cote: "droite", de: 20, a: arc.debut + arc.longueur }] })])), []);
});

// ===== Clignotant pendant un arrêt : changement de direction compté depuis le redémarrage, allumage daté =====

test("départ arrêté : le clignotant allumé pendant l'attente (delai) doit l'être au moins 2 s avant le redémarrage", () => {
  // L'élève attend 4 s en (20 ; 70), puis déboîte vers la gauche (changement de voie : décalage de 1,5 m sur 12 m
  // d'avance, dont le premier arc commence en s = 0) en accélérant jusqu'à 10 km/h sur 3 m, et file vers le nord.
  const c = trajet(20, 70, -90).decaler(-1.5, 12, { changementDeVoie: true }).droit(20).fin();
  const arrete = [{ s: 0, kmh: 0, pause: 4 }, { s: 3, kmh: 10 }, { s: c.longueur, kmh: 10 }];
  const avec = (delai, profil = arrete, extra = {}) =>
    controlerScene(scene([eleve(c, profil, { clignotant: [{ cote: "gauche", de: 0, a: c.longueur, delai }], ...extra })]));
  // Allumé à t = 1 s, 3 s avant le redémarrage (t = 4 s) : accepté.
  assert.deepEqual(avec(1), []);
  // Allumé à t = 3 s, une seconde seulement avant le redémarrage.
  const unePlusTot = ["eleve : clignotant gauche attendu 2 s avant le changement de direction de s = 0.0 m (absent à t = 2.0 s)"];
  assert.deepEqual(avec(3), unePlusTot);
  // Un départ différé (depart, l'élève visible dès le début) compte de même : l'attente en s = 0 dure jusqu'à t = 4 s.
  const differe = [{ s: 0, kmh: 0 }, { s: 3, kmh: 10 }, { s: c.longueur, kmh: 10 }];
  assert.deepEqual(avec(1, differe, { depart: 4, apparition: "debut" }), []);
  assert.deepEqual(avec(3, differe, { depart: 4, apparition: "debut" }), unePlusTot);
});

test("un arrêt au début d'un arc : le clignotant compte jusqu'au redémarrage, et tient de là jusqu'à la fin de l'arc", () => {
  // virageDroite à 15 km/h, arrêté 3 s au début de l'arc (s = 20 m) : freinage et reprise sur 5 m.
  const c = virageDroite();
  const profil = [{ s: 0, kmh: 15 }, { s: 15, kmh: 15 }, { s: 20, kmh: 0, pause: 3 }, { s: 25, kmh: 15 }, { s: c.longueur, kmh: 15 }];
  // Allumé à l'arrivée à l'arrêt (sans délai), il brille 3 s avant le redémarrage : accepté. Compté depuis l'arrivée,
  // il lui aurait manqué ces 2 s.
  assert.deepEqual(controlerScene(scene([eleve(c, profil, { clignotant: [{ cote: "droite", de: 20, a: finArc(c) }] })])), []);
});

test("demi-tour en trois temps, arcs collés aux rebroussements : le clignotant de chaque temps s'allume pendant l'arrêt qui le précède", () => {
  // Temps 1 en avant, volant à gauche (60 degrés, 4,1 m de rayon) ; temps 2 en recul, volant à droite (tortue à
  // gauche) ; temps 3 en avant, volant à gauche, puis 5 m. 5 km/h en avant, 4 km/h en arrière, freinage et reprise sur
  // 1 m, 3 s d'arrêt à chaque rebroussement (r1 = 4,29 m, arrivée à t = 3,81 s ; r2 = 8,59 m, arrivée à t = 12,48 s).
  const c = trajet(40, 60, -90).virage(4.1, -60).inverser().virage(4.1, -60).inverser().virage(4.1, -60).droit(5).fin();
  const [r1, r2] = rebroussements(c);
  const arc3 = c.segments[2];
  const profil = [{ s: 0, kmh: 5 }, { s: r1 - 1, kmh: 5 }, { s: r1, kmh: 0, pause: 3 }, { s: r1 + 1, kmh: 4 },
    { s: r2 - 1, kmh: 4 }, { s: r2, kmh: 0, pause: 3 }, { s: r2 + 1, kmh: 5 }, { s: c.longueur, kmh: 5 }];
  // Clignotants gauche, droit, gauche : celui de la marche avant finit au rebroussement, celui du temps suivant
  // s'allume `delai` secondes après l'arrivée à l'arrêt et le remplace.
  const avec = (delai) => controlerScene(scene([eleve(c, profil, { clignotant: [
    { cote: "gauche", de: 0, a: r1 }, { cote: "droite", de: r1, a: r2, delai },
    { cote: "gauche", de: r2, a: arc3.debut + arc3.longueur, delai },
  ] })]));
  // Allumés 0,5 s après chaque arrivée, 2,5 s avant chaque redémarrage : accepté.
  assert.deepEqual(avec(0.5), []);
  // Allumés 2,5 s après l'arrivée, 0,5 s seulement avant le redémarrage : au début de la fenêtre des 2 s (1 s après
  // l'arrivée), c'est encore le clignotant du temps précédent qui brille.
  assert.deepEqual(avec(2.5), [
    "eleve : clignotant droite attendu 2 s avant le changement de direction de s = 4.3 m (absent à t = 4.8 s)",
    "eleve : clignotant gauche attendu 2 s avant le changement de direction de s = 8.6 m (absent à t = 13.5 s)",
  ]);
});

// ===== Extinction datée : jamais avant la fin de l'arc =====

test("delaiFin : refusé s'il est négatif ; une extinction pile à l'arrivée en fin d'arc est acceptée, une plus tôt non", () => {
  // virageDroite à 15 km/h, freiné à partir de s = 32 m jusqu'à l'arrêt en fin d'arc (s = 35,71 m), 2 s d'arrêt, puis
  // reprise sur 5 m.
  const c = virageDroite(), fin = finArc(c);
  const profil = [{ s: 0, kmh: 15 }, { s: 32, kmh: 15 }, { s: fin, kmh: 0, pause: 2 }, { s: fin + 5, kmh: 15 }, { s: c.longueur, kmh: 15 }];
  const avec = (a, delaiFin) => controlerScene(scene([eleve(c, profil, { clignotant: [{ cote: "droite", de: 0, a, delaiFin }] })]));
  assert.deepEqual(avec(fin, -0.5),
    ["scène essai : acteur « eleve » : délai de fin de clignotant « -0.5 » invalide (nombre fini de secondes, positif ou nul, attendu)"]);
  // Éteint dès l'arrivée à l'arrêt en fin d'arc : l'arc est couvert jusqu'à son bout, instant d'arrivée compris.
  assert.deepEqual(avec(fin, 0), []);
  // Éteint une fois l'arrivée en s = 30,5 m passée (t = 7,32 s), dans l'arc : l'instant qui suit cette extinction est
  // contrôlé.
  assert.deepEqual(avec(30.5, 0), ["eleve : clignotant droite éteint pendant le changement de direction (t = 7.3 s)"]);
});

test("demi-tour en trois temps : à l'instant de chaque étape de contrôles, aucun clignotant ; l'arrivée montre encore l'ancien", () => {
  // Arcs collés aux rebroussements comme plus haut, mais 4,5 s d'arrêt à chaque rebroussement. Le clignotant d'un temps
  // s'éteint dès l'arrivée à l'arrêt qui le termine (delaiFin: 0) ; celui du temps suivant s'allume 2 s après l'arrivée
  // (delai: 2), 2,5 s avant le redémarrage. Le pas à pas fige l'instant exact d'une étape : à chaque arrêt, l'étape
  // d'arrivée ({ s: r }) montre la fin de l'arc, ancien clignotant encore allumé à cet instant précis ; les contrôles
  // commencent 1 s après ({ s: r, delai: 1 }) et le clignotant 2 s après ({ s: r, delai: 2 }).
  const c = trajet(40, 60, -90).virage(4.1, -60).inverser().virage(4.1, -60).inverser().virage(4.1, -60).droit(5).fin();
  const [r1, r2] = rebroussements(c);
  const arc3 = c.segments[2];
  const profil = [{ s: 0, kmh: 5 }, { s: r1 - 1, kmh: 5 }, { s: r1, kmh: 0, pause: 4.5 }, { s: r1 + 1, kmh: 4 },
    { s: r2 - 1, kmh: 4 }, { s: r2, kmh: 0, pause: 4.5 }, { s: r2 + 1, kmh: 5 }, { s: c.longueur, kmh: 5 }];
  const def = scene([eleve(c, profil, { clignotant: [
    { cote: "gauche", de: 0, a: r1, delaiFin: 0 },
    { cote: "droite", de: r1, a: r2, delai: 2, delaiFin: 0 },
    { cote: "gauche", de: r2, a: arc3.debut + arc3.longueur, delai: 2 },
  ] })], { etapes: [{ s: 0 }, { s: r1 }, { s: r1, delai: 1 }, { s: r1, delai: 2 }, { s: r2 }, { s: r2, delai: 1 }, { s: r2, delai: 2 }] });
  assert.deepEqual(controlerScene(def), []);
  const sc = preparerScene(def), e = sc.acteurs[0];
  const cote = (t) => etatActeur(e, t).clignotant;
  for (const [arrivee, controles, clignotant, ancien, suivant] of [[1, 2, 3, "gauche", "droite"], [4, 5, 6, "droite", "gauche"]]) {
    const [tArrivee, tControles, tAllumage] = [arrivee, controles, clignotant].map((k) => sc.etapes[k].t);
    // L'étape d'arrivée, à son instant même : l'ancien clignotant brille encore (borne comprise, fin de l'arc).
    assert.equal(cote(tArrivee), ancien);
    // L'étape des contrôles, à son instant même, puis jusqu'à l'allumage : aucun clignotant ; et dès après l'arrivée.
    assert.equal(cote(tControles), null);
    for (let t = tArrivee + 0.05; t < tAllumage; t += 0.1) assert.equal(cote(t), null, `t = ${t.toFixed(2)} s`);
    // De l'allumage au redémarrage (2,5 s plus tard) : le clignotant du temps suivant, compté depuis son allumage.
    assert.equal(etatActeur(e, tAllumage).clignotantDepuis, tAllumage);
    for (let t = tAllumage; t < tAllumage + 2.5; t += 0.1) assert.equal(cote(t), suivant, `t = ${t.toFixed(2)} s`);
  }
});
