import { test } from "node:test";
import assert from "node:assert/strict";
import { problemesGeste, imageFigee, imageA, ETAPE_MIN, PAS_IMAGE, PART_SAUT_MAX, BRUIT_CALCUL, SAUT_POINT_MAX, pointsDessines,
  ecartsFigeeLecture } from "../js/geste-regles.js";
import { n, trouverRole, trouverTous, problemeMiseAJour } from "../js/dessin-svg.js";
import { fleche } from "../js/dessins-kit.js";
import { cles, adoucir } from "../js/animation-courbes.js";
import { gesteEssai, ETAPES_ESSAI, avecAttributs, modifier, pointsFlecheEssai } from "./geste-essai.mjs";

const def = gesteEssai();
const flechesVisibles = (noeud) => trouverTous(noeud, (x) => x.attributs["data-r"] === "fleche" && x.attributs.display !== "none");
// Le geste d'essai, avec des valeurs d'état de plus (le dessin n'en lit aucune) : de quoi essayer la règle de continuité.
const avecEtat = (valeurs, surcharge = {}) => gesteEssai({ etat: (t) => ({ ...def.etat(t), ...valeurs(t) }), ...surcharge });
const sauts = (g) => problemesGeste(g, ETAPES_ESSAI).filter((p) => /^saut de /.test(p));

test("un geste en règle n'a aucun problème, et les seuils sont ceux des scènes", () => {
  assert.deepEqual(problemesGeste(def, ETAPES_ESSAI), []);
  assert.equal(ETAPE_MIN, 1.0);
  assert.equal(PAS_IMAGE, 1 / 60);
  assert.equal(PART_SAUT_MAX, 0.15);
  assert.equal(BRUIT_CALCUL, 1e-9);
});

test("PART_SAUT_MAX : une course adoucir sur toute sa plage en 1,0 s atteint 5 % de la plage par image au plus, la règle en laisse le triple", () => {
  // Pente maximale de adoucir : 3, soit 3/60 de la plage par image sur une étape de 1,0 s, la durée minimale.
  let pic = 0;
  for (let k = 0; k < 60; k++) pic = Math.max(pic, adoucir((k + 1) / 60) - adoucir(k / 60));
  assert.ok(pic > 0.048 && pic <= 0.05, `pic de ${pic}`);   // 0,0484 d'une image à l'autre ; 0,05 est la pente continue
  assert.ok(PART_SAUT_MAX >= 3 * pic - 1e-9, "toute la plage en 0,33 s passe");
  assert.ok(PART_SAUT_MAX < 4 * pic, "mais pas en 0,25 s");
});

test("le nombre d'étapes se compare au modèle du catalogue", () => {
  assert.deepEqual(problemesGeste(def, ["Un", "Deux", "Trois"]), ["2 étapes au lieu de 3"]);
  assert.deepEqual(problemesGeste(def, ["Un"]), ["2 étapes au lieu de 1"]);
  // Un modèle absent du catalogue est dit, pas une erreur de lecture de propriété.
  for (const modele of [undefined, null, "Un", 2]) {
    assert.deepEqual(problemesGeste(def, modele), ["modèle d'étapes du catalogue absent : le nombre d'étapes ne se compare pas"], String(modele));
  }
});

test("des instants qui ne croissent pas sont signalés, à l'étape fautive", () => {
  const pb = problemesGeste(gesteEssai({ etapes: [{ t: 0 }, { t: 2 }, { t: 1 }] }), ["Un", "Deux", "Trois"]);
  assert.deepEqual(pb, ["étape 3 : commence à 1 s, pas après l'étape 2 (2 s)"]);
  // Deux étapes au même instant : la seconde ne commence pas après la première.
  assert.deepEqual(problemesGeste(gesteEssai({ etapes: [{ t: 0 }, { t: 1.5 }, { t: 1.5 }] }), ["Un", "Deux", "Trois"]),
    ["étape 3 : commence à 1.5 s, pas après l'étape 2 (1.5 s)"]);
  // La première étape commence à 0, et rien ne s'écrit avant.
  assert.deepEqual(problemesGeste(gesteEssai({ etapes: [{ t: 0.5 }, { t: 2 }] }), ETAPES_ESSAI), ["la première étape ne commence pas à 0"]);
});

test("une étape de moins de 1,0 s est signalée, la dernière comprise", () => {
  assert.deepEqual(problemesGeste(gesteEssai({ etapes: [{ t: 0 }, { t: 0.5 }] }), ETAPES_ESSAI), ["étape 1 : 0.50 s, moins de 1 s"]);
  assert.deepEqual(problemesGeste(gesteEssai({ etapes: [{ t: 0 }, { t: 2.5 }] }), ETAPES_ESSAI), ["étape 2 : 0.50 s, moins de 1 s"]);
  // Exactement 1,0 s passe, une somme d'arrondis qui tombe à 0,9999999999 aussi.
  assert.deepEqual(problemesGeste(gesteEssai({ etapes: [{ t: 0 }, { t: 2 }], duree: 3 }), ETAPES_ESSAI), []);
  assert.deepEqual(problemesGeste(gesteEssai({ etapes: [{ t: 0 }, { t: 2 + 1e-10 }], duree: 3 }), ETAPES_ESSAI), []);
});

test("une durée qui ne dépasse pas la dernière étape est signalée", () => {
  assert.deepEqual(problemesGeste(gesteEssai({ duree: 1.5 }), ETAPES_ESSAI),
    ["la durée (1.5 s) ne dépasse pas le début de la dernière étape (1.5 s)"]);
  assert.deepEqual(problemesGeste(gesteEssai({ duree: 1 }), ETAPES_ESSAI),
    ["la durée (1 s) ne dépasse pas le début de la dernière étape (1.5 s)"]);
  // Une dernière étape de 1,2 s passe ; de 0,9 s, elle est trop courte, et c'est de cela qu'on parle, pas de la durée.
  assert.deepEqual(problemesGeste(gesteEssai({ duree: 2.7 }), ETAPES_ESSAI), []);
  assert.deepEqual(problemesGeste(gesteEssai({ duree: 2.4 }), ETAPES_ESSAI), ["étape 2 : 0.90 s, moins de 1 s"]);
});

test("imageA : l'image que le moteur dessine à un instant (état, étape de l'instant, figée ou de lecture) ; imageFigee est celle du début d'étape", () => {
  for (const [t, etape] of [[0, 0], [1.4999, 0], [1.5, 1], [2.9, 1], [3, 1]]) {
    const figee = imageA(def, t, true), lecture = imageA(def, t, false);
    assert.equal(trouverRole(figee, "libelle").enfants[0], `Étape ${etape + 1}`, `à ${t} s`);
    assert.equal(trouverRole(lecture, "libelle").enfants[0], `Étape ${etape + 1}`, `à ${t} s, en lecture`);
    assert.equal(trouverRole(figee, "disque").attributs.cx, def.etat(t).x, `à ${t} s : l'état de l'instant`);
    assert.equal(flechesVisibles(figee).length, 1, `à ${t} s : flèche visible sur l'image figée`);
    assert.equal(flechesVisibles(lecture).length, 0, `à ${t} s : flèche masquée en lecture`);
  }
  // La flèche est celle de l'étape de l'instant : la même dans toute l'étape, une autre à l'étape suivante.
  assert.deepEqual(trouverRole(imageA(def, 1.4999, true), "fleche"), trouverRole(imageFigee(def, 0), "fleche"));
  assert.deepEqual(trouverRole(imageA(def, 2.9, true), "fleche"), trouverRole(imageFigee(def, 1), "fleche"));
  assert.notDeepEqual(trouverRole(imageA(def, 1, true), "fleche-trait"), trouverRole(imageA(def, 2, true), "fleche-trait"));
  for (let i = 0; i < def.etapes.length; i++) {
    assert.deepEqual(imageFigee(def, i), imageA(def, def.etapes[i].t, true), `étape ${i + 1}`);
  }
  // Une étape qui n'existe pas est dite comme telle, pas une erreur de lecture de propriété.
  assert.throws(() => imageFigee(def, 2), /Étape 2 inconnue : le geste en a 2/);
  assert.throws(() => imageFigee(def, -1), /Étape -1 inconnue/);
});

test("imageFigee : l'état au début de l'étape, flèche visible ; une image de lecture masque la flèche", () => {
  for (let i = 0; i < def.etapes.length; i++) {
    const figee = imageFigee(def, i);
    assert.equal(flechesVisibles(figee).length, 1, `étape ${i + 1}`);
    assert.equal(trouverRole(figee, "disque").attributs.cx, def.etat(def.etapes[i].t).x, `étape ${i + 1} : disque à l'instant de l'étape`);
    assert.equal(trouverRole(figee, "libelle").enfants[0], `Étape ${i + 1}`);
  }
  const lecture = imageA(def, 2, false);
  assert.equal(flechesVisibles(lecture).length, 0);
  assert.equal(trouverRole(lecture, "fleche").attributs.display, "none");
});

test("une image dont la forme change est signalée avec son instant, qu'un nœud s'ajoute en lecture, sur l'image figée, ou que la flèche manque", () => {
  const x2 = def.etat(2).x;
  const avecNoeud = (condition) => gesteEssai({
    dessiner: (etat, options) => {
      const d = def.dessiner(etat, options);
      return condition(etat, options) ? { ...d, enfants: [...d.enfants, n("circle", { cx: 0, cy: 0, r: 1 })] } : d;
    },
  });
  // La première image du moteur est l'image figée de 0 s : c'est à elle que chaque image se compare, comme à l'exécution.
  const enPlus = problemesGeste(avecNoeud((etat) => etat.x >= x2), ETAPES_ESSAI);
  assert.deepEqual(enPlus, ["2.000 s, image de lecture : Structure du dessin changée : 5 enfants au lieu de 4 (svg)"], "un nœud en plus dès 2 s : dit une fois");
  assert.deepEqual(problemesGeste(avecNoeud((_, { fige }) => fige), ETAPES_ESSAI),
    ["0.000 s, image de lecture : Structure du dessin changée : 4 enfants au lieu de 5 (svg)"], "un nœud en plus sur l'image figée seulement");
  // La flèche n'existe que sur l'image figée : le faux moyen de ne la montrer qu'à l'arrêt.
  const conditionnelle = gesteEssai({
    dessiner: (etat, { fige, etape }) => {
      const d = def.dessiner(etat, { fige, etape });
      return fige ? d : { ...d, enfants: d.enfants.filter((x) => x.attributs["data-r"] !== "fleche") };
    },
  });
  assert.deepEqual(problemesGeste(conditionnelle, ETAPES_ESSAI),
    ["0.000 s, image de lecture : Structure du dessin changée : 3 enfants au lieu de 4 (svg)"]);
  // Un texte à la place d'un nœud, ou l'inverse, se refuse aussi à l'exécution.
  const echange = gesteEssai({ dessiner: (etat, o) => modifier(def.dessiner(etat, o), "libelle", (x) => (etat.x > 150 ? { ...x, enfants: [n("tspan", {})] } : x)) });
  assert.match(problemesGeste(echange, ETAPES_ESSAI).join(" | "), /image de lecture : Structure du dessin changée : texte et nœud échangés sous/);
});

test("une image dont une valeur ne s'écrirait pas, même à une ou deux images sur cent quatre-vingts, est signalée avec son instant : ce que mettreAJour refuserait", () => {
  assert.ok(Number.isNaN(Math.acos(1.0000001)));
  // La sonde du relecteur : le rayon du disque est NaN tant que |x - 100| < 2, soit deux images seulement.
  const rayon = (etat) => (Math.abs(etat.x - 100) < 2 ? Math.acos(1.0000001) : 14);
  const sonde = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque", { r: rayon(etat) }) });
  const dedans = Array.from({ length: 181 }, (_, k) => k).filter((k) => Number.isNaN(rayon(def.etat(k * PAS_IMAGE))));
  assert.deepEqual(dedans, [71, 72], "la sonde touche deux images");
  const pb = problemesGeste(sonde, ETAPES_ESSAI);
  assert.equal(pb.length, 1);
  assert.match(pb[0], /^1\.183 s, image de lecture : Valeur d'attribut non finie : NaN \(svg\[1\] > circle, attribut r\)$/);
  // Le message est celui de la vérification de mettreAJour elle-même, appliquée à l'image figée de 0 s (celle du montage).
  assert.ok(pb[0].endsWith(problemeMiseAJour(imageA(sonde, 0, true), imageA(sonde, 71 * PAS_IMAGE, false))));
  // Une seule image, la 71e, qui n'est pas un multiple de six : un échantillon sur six ne la verrait pas.
  const uneSeule = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque", { r: Math.abs(etat.x - def.etat(71 * PAS_IMAGE).x) < 1e-9 ? NaN : 14 }) });
  assert.match(problemesGeste(uneSeule, ETAPES_ESSAI).join(" | "), /^1\.183 s, image de lecture : Valeur d'attribut non finie/);
  // Image figée seulement, ou de lecture seulement : chacune est contrôlée.
  const figeSeulement = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque", { r: o.fige && etat.x > 150 ? NaN : 14 }) });
  assert.match(problemesGeste(figeSeulement, ETAPES_ESSAI).join(" | "), /^\d\.\d{3} s, image figée : Valeur d'attribut non finie : NaN/);
  // Toute valeur que l'écriture refuse : non finie, infinie, absente.
  for (const [valeur, message] of [[NaN, /non finie : NaN/], [Infinity, /non finie : Infinity/], [null, /absente : null/], [undefined, /absente : undefined/]]) {
    const g = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque", { r: etat.x > 200 ? valeur : 14 }) });
    assert.match(problemesGeste(g, ETAPES_ESSAI).join(" | "), message, String(valeur));
  }
});

test("la dernière image, celle de la fin, est vérifiée même quand la durée n'est pas un multiple de 1/60 s", () => {
  // 3,051 s : aucun échantillon régulier ne tombe sur la fin. Un nœud n'apparaît qu'à x = 280, atteint à la fin.
  const fin = (t) => ({ x: cles([{ t: 0, v: 40 }, { t: 3.051, v: 280 }], t) });
  const seulementALaFin = gesteEssai({
    duree: 3.051,
    etat: fin,
    dessiner: (etat, options) => {
      const d = def.dessiner(etat, options);
      return etat.x >= 280 ? { ...d, enfants: [...d.enfants, n("circle", { cx: 0, cy: 0, r: 1 })] } : d;
    },
  });
  assert.deepEqual(problemesGeste(seulementALaFin, ETAPES_ESSAI), ["3.051 s, image de lecture : Structure du dessin changée : 5 enfants au lieu de 4 (svg)"]);
  assert.deepEqual(problemesGeste(gesteEssai({ duree: 3.051, etat: fin }), ETAPES_ESSAI), []);
});

test("continuité : un saut est jugé sur la plage de la valeur, sans unité ; une prise ou une opacité de 0 à 1 en une image est signalée", () => {
  // Les sondes du relecteur : 0 puis 1 en une image, à t = 1.
  assert.deepEqual(problemesGeste(avecEtat((t) => ({ prise: t < 1 ? 0 : 1 })), ETAPES_ESSAI),
    ["saut de prise à 1.000 s : 0.00 puis 1.00 (plus de 15 % de la plage de 1.00 en une image)"]);
  assert.deepEqual(problemesGeste(avecEtat((t) => ({ opacite: t < 1 ? 0 : 1 })), ETAPES_ESSAI),
    ["saut de opacite à 1.000 s : 0.00 puis 1.00 (plus de 15 % de la plage de 1.00 en une image)"]);
  // Un cran partiel est un saut aussi : la plage est 0,5, le cran est toute la plage.
  assert.deepEqual(problemesGeste(avecEtat((t) => ({ prise: t < 1 ? 0 : 0.5 })), ETAPES_ESSAI),
    ["saut de prise à 1.000 s : 0.00 puis 0.50 (plus de 15 % de la plage de 0.50 en une image)"]);
  // x de 40 à 200 en une image, une valeur à grande plage : saut aussi.
  assert.deepEqual(problemesGeste(gesteEssai({ etat: (t) => ({ x: t < 1 ? 40 : 200 }) }), ETAPES_ESSAI),
    ["saut de x à 1.000 s : 40.00 puis 200.00 (plus de 15 % de la plage de 160.00 en une image)"]);
  // Un état imbriqué se nomme par son chemin.
  assert.match(problemesGeste(avecEtat((t) => ({ main: { angle: t < 2 ? 0 : 90 } })), ETAPES_ESSAI).join(" | "), /^saut de main\.angle à 2\.0\d\d s : 0\.00 puis 90\.00/);
  // Un interrupteur instantané que le cours permet se modélise par un booléen : il ne se juge pas.
  assert.deepEqual(problemesGeste(avecEtat((t) => ({ prise: t >= 1 })), ETAPES_ESSAI), []);
  // Une valeur non finie dans l'état est une faute dite comme telle, jamais un saut qui passe (NaN ne dépasse aucun seuil).
  const nan = gesteEssai({ etat: (t) => ({ x: t > 2 ? NaN : def.etat(t).x }) });
  assert.match(problemesGeste(nan, ETAPES_ESSAI).join(" | "), /valeur non finie de x à \d\.\d{3} s/);
});

test("continuité : un mouvement adoucir sur toute sa plage passe à partir d'environ 0,3 s (180° en une étape de 1,0 s), pas plus vite ; un mouvement trop rapide n'est dit qu'une fois", () => {
  // 180° en 1,0 s, la durée minimale d'une étape : 9° par image au pic, que l'ancienne règle de 6 par image refusait.
  const tour = gesteEssai({ etapes: [{ t: 0 }, { t: 1 }], duree: 2, etat: (t) => ({ x: def.etat(t).x, angle: cles([{ t: 0, v: 0 }, { t: 1, v: 180 }, { t: 2, v: 180 }], t) }) });
  assert.deepEqual(problemesGeste(tour, ETAPES_ESSAI), []);
  // 90° en `s` secondes à partir de 1 s. La limite se situe vers 0,3 s : à 18 images, le pic est de 14,9 % de la plage (0,3 s
  // passe), à 17 images de 16,6 % (0,29 s est un saut) ; les cas proches de la limite ne sont pas posés ici.
  const virage = (s) => avecEtat((t) => ({ angle: cles([{ t: 0, v: 0 }, { t: 1, v: 0 }, { t: 1 + s, v: 90 }], t) }));
  for (const s of [1, 0.5, 0.34]) assert.deepEqual(sauts(virage(s)), [], `${s} s`);
  for (const s of [0.25, 0.2, 0.1]) assert.equal(sauts(virage(s)).length, 1, `${s} s`);
  // Un mouvement linéaire de 15° par image sur une plage de 90° : un seul message, à sa première image, pas un par image.
  const rapide = problemesGeste(avecEtat((t) => ({ angle: Math.min(90, 900 * Math.max(0, t - 1)) })), ETAPES_ESSAI);
  assert.equal(rapide.length, 1);
  assert.match(rapide[0], /^saut de angle à 1\.017 s : 0\.00 puis 15\.00 \(plus de 15 % de la plage de 90\.00 en une image\)$/);
  // Les valeurs constantes ne se jugent pas, ni celles dont la seule variation est du bruit de calcul (1e-12, comme une valeur
  // constante calculée en virgule flottante) ; une variation de 5e-9, au-delà du bruit, sur sa propre plage, est un saut.
  assert.deepEqual(problemesGeste(avecEtat((t) => ({ y: 5, bruit: Math.round(t * 60) % 2 ? 1e-12 : 0 })), ETAPES_ESSAI), []);
  assert.deepEqual(problemesGeste(avecEtat((t) => ({ y: 5 + 3e-14 * (Math.round(t * 60) % 7), constante: 100 * (Math.cos(t) ** 2 + Math.sin(t) ** 2) })), ETAPES_ESSAI), []);
  assert.equal(sauts(avecEtat((t) => ({ pas: Math.round(t * 60) % 2 ? 5e-9 : 0 }))).length, 1);
  // La fin de course compte dans la plage : une valeur qui ne change qu'à la dernière image a pour plage ce changement.
  assert.deepEqual(problemesGeste(avecEtat((t) => ({ fin: t >= 3 ? 1 : 0 })), ETAPES_ESSAI),
    ["saut de fin à 3.000 s : 0.00 puis 1.00 (plus de 15 % de la plage de 1.00 en une image)"]);
});

test("sautsMax : la variation maximale par image d'une valeur qui doit aller plus vite, dans son unité, remplace la règle relative ; une valeur rapide non déclarée est signalée", () => {
  const deux = (t) => ({ prise: t < 1 ? 0 : 1, opacite: t < 2 ? 0 : 1 });
  assert.equal(sauts(avecEtat(deux)).length, 2);
  // prise déclarée : acceptée ; opacite ne l'est pas : signalée.
  const pb = problemesGeste(avecEtat(deux, { sautsMax: { prise: 1 } }), ETAPES_ESSAI);
  assert.equal(pb.length, 1);
  assert.match(pb[0], /^saut de opacite à 2\.000 s : 0\.00 puis 1\.00 \(plus de 15 % de la plage/);
  assert.deepEqual(problemesGeste(avecEtat(deux, { sautsMax: { prise: 1, opacite: 1 } }), ETAPES_ESSAI), []);
  // La borne est absolue : un cran de 1 ne passe pas sous une borne de 0,5.
  assert.deepEqual(problemesGeste(avecEtat(deux, { sautsMax: { prise: 0.5, opacite: 1 } }), ETAPES_ESSAI),
    ["saut de prise à 1.000 s : 0.00 puis 1.00 (plus que les 0.5 déclarés par sautsMax en une image)"]);
  // Elle remplace la règle relative dans les deux sens : plus lâche, un saut de 160 sur une plage de 160 passe ; plus serrée,
  // un mouvement doux qui fait 4 unités par image au pic est refusé.
  assert.deepEqual(problemesGeste(gesteEssai({ etat: (t) => ({ x: t < 1 ? 40 : 200 }), sautsMax: { x: 200 } }), ETAPES_ESSAI), []);
  const serree = problemesGeste(gesteEssai({ sautsMax: { x: 3 } }), ETAPES_ESSAI);
  assert.equal(serree.length, 1);
  assert.match(serree[0], /^saut de x à \d\.\d{3} s : .* \(plus que les 3 déclarés par sautsMax en une image\)$/);
  assert.deepEqual(problemesGeste(gesteEssai({ sautsMax: { x: 10 } }), ETAPES_ESSAI), []);
});

test("sautsMax mal déclaré est un problème dit : chemin qui n'est pas dans l'état, borne qui n'est pas un nombre fini positif, déclaration qui n'est pas un objet", () => {
  assert.deepEqual(problemesGeste(gesteEssai({ sautsMax: { inconnu: 5 } }), ETAPES_ESSAI), ["sautsMax : « inconnu » n'est pas une valeur numérique de l'état"]);
  assert.deepEqual(problemesGeste(avecEtat(() => ({ main: { angle: 1 } }), { sautsMax: { "main.angle": 5, main: 5 } }), ETAPES_ESSAI),
    ["sautsMax : « main » n'est pas une valeur numérique de l'état"], "un chemin se donne en entier : main.angle");
  for (const borne of [0, -1, NaN, Infinity, "1", null]) {
    assert.match(problemesGeste(gesteEssai({ sautsMax: { x: borne } }), ETAPES_ESSAI).join(" | "),
      /^sautsMax : « x » .* : un nombre fini strictement positif est attendu$/, `borne ${String(borne)}`);
  }
  for (const declaration of [[], null, "x", 5, true]) {
    assert.deepEqual(problemesGeste(gesteEssai({ sautsMax: declaration }), ETAPES_ESSAI),
      ["sautsMax : un objet { chemin: variation maximale par image } est attendu"], JSON.stringify(declaration));
  }
  // Absente (ou posée à undefined) : rien à dire.
  assert.deepEqual(problemesGeste(gesteEssai({ sautsMax: undefined }), ETAPES_ESSAI), []);
  // Un nom que le prototype d'un objet possède n'est pas une déclaration.
  assert.deepEqual(problemesGeste(gesteEssai({ sautsMax: { constructor: 5 } }), ETAPES_ESSAI), ["sautsMax : « constructor » n'est pas une valeur numérique de l'état"]);
});

test("la flèche d'une étape garde tous ses attributs d'une image figée à l'autre dans l'étape ; elle peut changer d'une étape à l'autre", () => {
  // Le geste d'essai : une flèche par étape, constante dans l'étape, différente d'une étape à l'autre.
  assert.deepEqual(problemesGeste(def, ETAPES_ESSAI), []);
  assert.notDeepEqual(pointsFlecheEssai(0), pointsFlecheEssai(1));
  assert.notEqual(trouverRole(imageFigee(def, 0), "fleche-trait").attributs.d, trouverRole(imageFigee(def, 1), "fleche-trait").attributs.d, "une flèche par étape");
  // Des points qui suivent le disque : la flèche bouge d'une image à l'autre, dit pour chaque étape, une fois.
  const suiveuse = gesteEssai({ dessiner: (etat, o) => modifier(def.dessiner(etat, o), "fleche", () => fleche([[40, 150], [etat.x + 50, 150]], { visible: o.fige })) });
  const pb = problemesGeste(suiveuse, ETAPES_ESSAI);
  assert.equal(pb.length, 2);
  // (Le kit écrit les tracés à deux décimales : la flèche ne change qu'à la première image où le tracé écrit diffère.)
  assert.match(pb[0], /^la flèche de l'étape 1 change à l'intérieur de l'étape \(à 0\.\d{3} s\)/);
  assert.match(pb[1], /^la flèche de l'étape 2 change à l'intérieur de l'étape \(à 1\.\d{3} s\)/);
  // Un attribut d'un de ses enfants qui change (la couleur du trait) : la même faute.
  const clignote = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "fleche-trait", etat.x > 100 ? { stroke: "#000000" } : {}) });
  assert.match(problemesGeste(clignote, ETAPES_ESSAI).join(" | "), /^la flèche de l'étape 1 change à l'intérieur de l'étape/);
  // Un attribut de la flèche elle-même, display compris (visible au début de l'étape seulement).
  const sEteint = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "fleche", { display: o.fige && etat.x < 100 ? "inline" : "none" }) });
  assert.match(problemesGeste(sEteint, ETAPES_ESSAI).join(" | "), /la flèche de l'étape 1 change à l'intérieur de l'étape/);
  // Sa constance ne se juge que sur les images figées ; en lecture, masquée, elle doit pourtant porter les mêmes points que sur
  // l'image figée du même instant (une image figée est l'image de lecture au seul affichage des flèches près) : c'est cette
  // règle-là, et elle seule, qui la signale.
  const libreEnLecture = gesteEssai({ dessiner: (etat, o) => (o.fige ? def.dessiner(etat, o)
    : modifier(def.dessiner(etat, o), "fleche", () => fleche([[40, 150], [etat.x + 50, 150]], { visible: false }))) });
  const pbLecture = problemesGeste(libreEnLecture, ETAPES_ESSAI);
  assert.ok(pbLecture.length > 0 && pbLecture.every((p) => /l'image figée diffère de l'image de lecture ailleurs que par l'affichage du groupe des flèches/.test(p)),
    pbLecture.join(" | "));
  // Sans flèche du tout, il n'y a rien à comparer ici (verifierGeste dit qu'elle manque).
  const sansFleche = gesteEssai({ dessiner: (etat, o) => { const d = def.dessiner(etat, o); return { ...d, enfants: d.enfants.filter((x) => x.attributs["data-r"] !== "fleche") }; } });
  assert.deepEqual(problemesGeste(sansFleche, ETAPES_ESSAI), []);
});

test("un geste sans étapes, ou dont elles sont absentes, est un problème dit, jamais une exception", () => {
  for (const etapes of [undefined, null, [], "abc", {}]) {
    let pb;
    assert.doesNotThrow(() => { pb = problemesGeste(gesteEssai({ etapes }), ETAPES_ESSAI); }, `etapes ${JSON.stringify(etapes)}`);
    assert.deepEqual(pb, ["étapes absentes ou vides : le lecteur en exige au moins une"], `etapes ${JSON.stringify(etapes)}`);
  }
  // Une étape sans instant fini est signalée, et les règles qui en dépendent ne s'exécutent pas.
  for (const t of [undefined, NaN, Infinity, "1"]) {
    const pb = problemesGeste(gesteEssai({ etapes: [{ t: 0 }, { t }] }), ETAPES_ESSAI);
    assert.deepEqual(pb, ["étape 2 : instant non fini"], `instant ${t}`);
  }
});

test("une vitesse de lecture qui n'est pas un nombre fini positif est signalée ; absente ou valide, non", () => {
  for (const v of [0, -1, -0.5, NaN, Infinity, "2", null, true]) {
    assert.match(problemesGeste(gesteEssai({ vitesseLecture: v }), ETAPES_ESSAI).join(" | "),
      /^vitesseLecture .* : un nombre fini strictement positif est attendu$/, `vitesse ${String(v)}`);
  }
  for (const v of [undefined, 0.5, 1, 2, 1.25]) assert.deepEqual(problemesGeste(gesteEssai({ vitesseLecture: v }), ETAPES_ESSAI), [], `vitesse ${v}`);
  // La clé absente (et non posée à undefined) passe aussi.
  const sansCle = gesteEssai();
  assert.equal("vitesseLecture" in sansCle, false);
  assert.deepEqual(problemesGeste(sansCle, ETAPES_ESSAI), []);
});

test("une durée qui n'est pas un nombre fini positif est signalée, sans boucle infinie", () => {
  for (const duree of [NaN, 0, -3, Infinity, "3", undefined]) {
    const pb = problemesGeste(gesteEssai({ duree }), ETAPES_ESSAI);
    assert.equal(pb.length >= 1 && /^durée .* : un nombre fini strictement positif est attendu$/.test(pb[0]), true, `durée ${String(duree)} : ${pb}`);
  }
});

test("une image impossible à produire, ou un état qui lève, est un problème dit avec son instant", () => {
  const leve = gesteEssai({ dessiner: (etat, o) => { if (etat.x > 200) throw new Error("point hors tracé"); return def.dessiner(etat, o); } });
  const pb = problemesGeste(leve, ETAPES_ESSAI);
  assert.equal(pb.length, 1);
  assert.match(pb[0], /^image impossible à produire à \d\.\d{3} s : point hors tracé$/);
  const etatQuiLeve = gesteEssai({ etat: (t) => { if (t > 2) throw new Error("clé absente"); return def.etat(t); } });
  assert.match(problemesGeste(etatQuiLeve, ETAPES_ESSAI).join(" | "), /^image impossible à produire à 2\.\d{3} s : clé absente$/);
  // La flèche du kit, elle, refuse deux points confondus : l'erreur arrive dite avec son instant.
  const flecheDegeneree = gesteEssai({
    dessiner: (etat, o) => { const d = def.dessiner(etat, o); return etat.x > 150 ? fleche([[10, 10], [10, 10]]) : d; },
  });
  assert.match(problemesGeste(flecheDegeneree, ETAPES_ESSAI).join(" | "), /image impossible à produire à \d\.\d{3} s : Flèche « fleche » : il faut au moins deux points distincts/);
});

// ===== Règles communes ajoutées à l'intégration du lot D1 : image figée et image de lecture, continuité des points dessinés =====

const ecartsFiges = (g) => problemesGeste(g, ETAPES_ESSAI).filter((p) => /l'image figée diffère de l'image de lecture/.test(p));
const sautsPoints = (g) => problemesGeste(g, ETAPES_ESSAI).filter((p) => /^saut du point/.test(p));

test("image figée : l'image de lecture du même instant, au seul affichage du groupe des flèches près ; tout autre écart est dit, une fois", () => {
  // Le geste d'essai : seul le display du groupe de la flèche distingue les deux images, à chaque instant.
  for (const t of [0, 0.7, 1.5, 2.2, 3]) assert.deepEqual(ecartsFigeeLecture(imageA(def, t, true), imageA(def, t, false)), [], `${t} s`);
  assert.deepEqual(ecartsFiges(def), []);
  // Le disque posé ailleurs sur l'image figée : l'image figée ne serait plus une image de l'animation (un saut au passage du pas
  // à pas à la lecture). Dit une fois, avec le premier instant, le nœud et l'attribut.
  const deplace = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque", o.fige ? { cx: etat.x + 3 } : {}) });
  assert.deepEqual(ecartsFiges(deplace), ["0.000 s : l'image figée diffère de l'image de lecture ailleurs que par l'affichage du groupe des flèches (/svg[1]/circle[disque] cx)"]);
  // Un texte, une marque rangée dans le groupe des flèches ou la flèche elle-même qui changent : signalés aussi. Seul le display
  // du groupe des flèches peut différer.
  const libelle = gesteEssai({ dessiner: (etat, o) => modifier(def.dessiner(etat, o), "libelle", (x) => (o.fige ? { ...x, enfants: ["Pause"] } : x)) });
  assert.match(ecartsFiges(libelle).join(" | "), /\(\/svg\[2\]\/text\[libelle\]\[0\] texte\)/);
  const marque = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "fleche-tete", o.fige ? {} : { fill: "#000000" }) });
  assert.match(ecartsFiges(marque).join(" | "), /fleche-tete\] fill\)/);
  const groupe = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "fleche", o.fige ? {} : { opacity: 0.5 }) });
  assert.match(ecartsFiges(groupe).join(" | "), /g\[fleche\] opacity\)/);
  // Le display d'un autre nœud que le groupe des flèches n'a pas cette exemption.
  const cache = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque", { display: o.fige ? "inline" : "none" }) });
  assert.match(ecartsFiges(cache).join(" | "), /circle\[disque\] display\)/);
});

test("points dessinés : data-x et data-y d'un rôle, bouts data-x1 à data-y2 d'un segment ; un nœud masqué, ou sous un groupe masqué, n'en a pas", () => {
  const image = n("svg", {},
    n("g", { "data-r": "main", "data-x": 10, "data-y": 20 }, n("circle", { "data-r": "doigt", "data-x": "11.5", "data-y": "21" })),
    n("line", { "data-r": "brin", "data-x1": 0, "data-y1": 1, "data-x2": 2, "data-y2": 3 }),
    n("g", { display: "none" }, n("circle", { "data-r": "cache", "data-x": 1, "data-y": 1 })),
    n("circle", { "data-r": "sans-y", "data-x": 4 }));
  assert.deepEqual([...pointsDessines(image).values()], [
    { role: "main", point: [10, 20] }, { role: "doigt", point: [11.5, 21] },
    { role: "brin (bout 1)", point: [0, 1] }, { role: "brin (bout 2)", point: [2, 3] }]);
  assert.equal(SAUT_POINT_MAX, 8);
});

test("continuité des points dessinés : aucun ne bouge de plus de SAUT_POINT_MAX unités d'une image de lecture à la suivante, lu dans le dessin", () => {
  // Le disque porte son point : 240 unités en 3 s sur une course adoucie, 2 unités par image au plus. En règle.
  const avecPoint = (decaler) => gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque",
    { "data-x": etat.x + decaler(etat), "data-y": 100 }) });
  assert.deepEqual(sautsPoints(avecPoint(() => 0)), []);
  // Un décalage de 9 unités quand le disque passe le milieu, où il va déjà à 4 unités par image : l'état est continu, le dessin
  // saute de 13 unités. Dit une fois, avec le rôle et les deux instants ; un décalage de 3 unités (7 en tout) passe.
  const pb = sautsPoints(avecPoint((e) => (e.x > 160 ? 9 : 0)));
  assert.equal(pb.length, 1);
  assert.match(pb[0], /^saut du point « disque » de 1\.500 à 1\.517 s : 12\.\d{2} unités en une image \(8 au plus\)$/);
  assert.deepEqual(sautsPoints(avecPoint((e) => (e.x > 160 ? 3 : 0))), []);
  // Un point masqué ne se juge pas ; un point qui apparaît ailleurs non plus (une apparition n'est pas un saut).
  const masque = gesteEssai({ dessiner: (etat, o) => avecAttributs(def.dessiner(etat, o), "disque",
    { "data-x": etat.x > 160 ? 300 : 0, "data-y": 100, display: etat.x > 150 && etat.x < 170 ? "none" : "inline" }) });
  assert.deepEqual(sautsPoints(masque), []);
});
