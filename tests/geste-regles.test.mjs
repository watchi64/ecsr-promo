import { test } from "node:test";
import assert from "node:assert/strict";
import { problemesGeste, imageFigee, ETAPE_MIN, PAS_IMAGE, SAUT_MAX } from "../js/geste-regles.js";
import { n, trouverRole, trouverTous } from "../js/dessin-svg.js";
import { fleche } from "../js/dessins-kit.js";
import { cles } from "../js/animation-courbes.js";
import { gesteEssai, ETAPES_ESSAI } from "./geste-essai.mjs";

const def = gesteEssai();
const flechesVisibles = (noeud) => trouverTous(noeud, (x) => x.attributs["data-r"] === "fleche" && x.attributs.display !== "none");

test("un geste en règle n'a aucun problème, et les seuils sont ceux des scènes", () => {
  assert.deepEqual(problemesGeste(def, ETAPES_ESSAI), []);
  assert.equal(ETAPE_MIN, 1.0);
  assert.equal(PAS_IMAGE, 1 / 60);
  assert.equal(SAUT_MAX, 6);
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

test("une image dont la forme change est signalée, qu'un nœud s'ajoute en lecture, sur une image figée, ou que la flèche manque", () => {
  const x2 = def.etat(2).x;
  const avecNoeud = (condition) => gesteEssai({
    dessiner: (etat, options) => {
      const d = def.dessiner(etat, options);
      return condition(etat, options) ? { ...d, enfants: [...d.enfants, n("circle", { cx: 0, cy: 0, r: 1 })] } : d;
    },
  });
  // Un nœud en plus à partir de t = 2.
  assert.match(problemesGeste(avecNoeud((etat) => etat.x >= x2), ETAPES_ESSAI).join(" | "), /forme de l'image changée à \d\.\d{3} s/);
  // Un nœud en plus seulement sur l'image figée.
  assert.match(problemesGeste(avecNoeud((_, { fige }) => fige), ETAPES_ESSAI).join(" | "), /forme de l'image changée/);
  // La flèche n'existe que sur l'image figée : le faux moyen de ne la montrer qu'à l'arrêt.
  const conditionnelle = gesteEssai({
    dessiner: (etat, { fige, etape }) => {
      const d = def.dessiner(etat, { fige, etape });
      return fige ? d : { ...d, enfants: d.enfants.filter((x) => x.attributs["data-r"] !== "fleche") };
    },
  });
  assert.match(problemesGeste(conditionnelle, ETAPES_ESSAI).join(" | "), /forme de l'image changée/);
  // Le problème est dit une seule fois, pas à chaque échantillon.
  assert.equal(problemesGeste(avecNoeud((etat) => etat.x >= x2), ETAPES_ESSAI).filter((p) => /forme/.test(p)).length, 1);
});

test("la dernière image, celle de la fin, est vérifiée même quand la durée n'est pas un multiple de 0,1 s", () => {
  // 3,05 s : aucun échantillon régulier (une image sur six) ne tombe sur la fin. Un nœud n'apparaît qu'à x = 280, atteint à la fin.
  const fin = (t) => ({ x: cles([{ t: 0, v: 40 }, { t: 3.05, v: 280 }], t) });
  const seulementALaFin = gesteEssai({
    duree: 3.05,
    etat: fin,
    dessiner: (etat, options) => {
      const d = def.dessiner(etat, options);
      return etat.x >= 280 ? { ...d, enfants: [...d.enfants, n("circle", { cx: 0, cy: 0, r: 1 })] } : d;
    },
  });
  assert.deepEqual(problemesGeste(seulementALaFin, ETAPES_ESSAI), ["forme de l'image changée à 3.050 s"]);
  assert.deepEqual(problemesGeste(gesteEssai({ duree: 3.05, etat: fin }), ETAPES_ESSAI), []);
});

test("un saut de l'état entre deux images est signalé, un mouvement doux non", () => {
  // x passe de 40 à 200 en un soixantième de seconde, à t = 1.
  const saut = gesteEssai({ etat: (t) => ({ x: t < 1 ? 40 : 200 }) });
  const pb = problemesGeste(saut, ETAPES_ESSAI);
  assert.equal(pb.length, 1);
  assert.match(pb[0], /^saut de x à 1\.000 s : 40\.00 puis 200\.00$/);
  // Un saut dans un état imbriqué se nomme par son chemin.
  const imbrique = gesteEssai({ etat: (t) => ({ x: def.etat(t).x, main: { angle: t < 2 ? 0 : 90 } }) });
  assert.match(problemesGeste(imbrique, ETAPES_ESSAI).join(" | "), /saut de main\.angle à 2\.0\d\d s : 0\.00 puis 90\.00/);
  // Le seuil : à vitesse constante de `pas * 60` unités par seconde, x gagne `pas` unités à chaque image. 5,9 par image
  // passent, 6,5 non ; et un mouvement trop rapide n'est dit qu'une fois, pas à chaque image.
  const lineaire = (pas) => gesteEssai({ etat: (t) => ({ x: (pas * 60 * t) }) });
  assert.deepEqual(problemesGeste(lineaire(5.9), ETAPES_ESSAI), []);
  const rapide = problemesGeste(lineaire(6.5), ETAPES_ESSAI);
  assert.equal(rapide.length, 1);
  assert.match(rapide[0], /^saut de x à 0\.017 s : 0\.00 puis 6\.50$/);
  // Une valeur non finie dans l'état est une faute dite comme telle, jamais un saut qui passe (NaN ne dépasse aucun seuil).
  const nan = gesteEssai({ etat: (t) => ({ x: t > 2 ? NaN : def.etat(t).x }) });
  assert.match(problemesGeste(nan, ETAPES_ESSAI).join(" | "), /valeur non finie de x à \d\.\d{3} s/);
});

test("imageFigee : l'état au début de l'étape, flèche visible ; une image de lecture masque la flèche", () => {
  for (let i = 0; i < def.etapes.length; i++) {
    const figee = imageFigee(def, i);
    assert.equal(flechesVisibles(figee).length, 1, `étape ${i + 1}`);
    assert.equal(trouverRole(figee, "disque").attributs.cx, def.etat(def.etapes[i].t).x, `étape ${i + 1} : disque à l'instant de l'étape`);
    assert.equal(trouverRole(figee, "libelle").enfants[0], `Étape ${i + 1}`);
  }
  const lecture = def.dessiner(def.etat(2), { fige: false, etape: 1 });
  assert.equal(flechesVisibles(lecture).length, 0);
  assert.equal(trouverRole(lecture, "fleche").attributs.display, "none");
  // Une étape qui n'existe pas est dite comme telle, pas une erreur de lecture de propriété.
  assert.throws(() => imageFigee(def, 2), /Étape 2 inconnue : le geste en a 2/);
  assert.throws(() => imageFigee(def, -1), /Étape -1 inconnue/);
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
