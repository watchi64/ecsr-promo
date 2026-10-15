import { test } from "node:test";
import assert from "node:assert/strict";
import { monterGeste } from "../js/geste-moteur.js";
import { readFileSync } from "node:fs";
import { imageFigee, imageA, problemesGeste } from "../js/geste-regles.js";
import { n, ecrireValeur, trouverRole } from "../js/dessin-svg.js";
import { avecBanc as banc, descendants, serialiserDom, serialiserDescription, ElementFactice } from "./aides-dom.mjs";
import { gesteEssai, ETAPES_ESSAI, avecAttributs } from "./geste-essai.mjs";

const NS = "http://www.w3.org/2000/svg";

// Monte le geste dans un conteneur posé dans le document factice ; `etapes` : les éléments de la liste d'étapes du cours.
function monter(dom, options = {}, def = gesteEssai()) {
  const conteneur = dom.conteneur();
  const g = monterGeste(def, { conteneur, ...options });
  return { def, g, conteneur, racine: conteneur.childNodes[0], barre: conteneur.childNodes[1] };
}
const trouver = (racine, role) => descendants(racine).find((x) => x instanceof ElementFactice && x.getAttribute("data-r") === role);
const lignes = (dom, nombre = 2) => Array.from({ length: nombre }, () => {
  const li = dom.doc.createElement("li");
  li.append(dom.doc.createElement("button"));
  return li;
});
const jusquAuBout = (temps, ms = 100, max = 200) => { let k = 0; while (temps.enAttente() && k < max) { temps.avancer(ms); k++; } return k; };
// L'image que le moteur doit avoir à l'instant t : le rendu neuf de la définition, par imageA comme le moteur et les contrôles.
const attendue = (def, t, fige) => serialiserDescription(imageA(def, t, fige));

test("monterGeste : le SVG est créé au montage, avant la barre de commandes ; ensuite seuls des attributs et des textes changent, sur les mêmes nœuds", () => banc((dom, temps) => {
  const { g, conteneur, racine } = monter(dom);
  assert.equal(racine.nodeName, "svg");
  assert.equal(racine.namespaceURI, NS);
  assert.equal(conteneur.childNodes.length, 2);
  assert.equal(conteneur.childNodes[1].className, "scene-commandes");
  const avant = descendants(racine), crees = { ...dom.compte };
  const disque = trouver(racine, "disque"), libelle = trouver(racine, "libelle");
  // Lecture, pause, étapes, instants, rejouer, fin de lecture : aucune création de nœud.
  g.jouer();
  temps.avancer(100);
  temps.avancer(100);
  g.pause();
  g.allerEtape(1);
  g.allerA(2.2);
  g.rejouer();
  jusquAuBout(temps);
  assert.deepEqual(dom.compte, crees, "ni élément ni texte créé après le montage");
  const apres = descendants(racine);
  assert.equal(apres.length, avant.length);
  assert.ok(avant.every((x, i) => x === apres[i]), "les mêmes nœuds, dans le même ordre");
  assert.equal(trouver(racine, "disque"), disque);
  // Le texte du libellé a changé sur son nœud de texte, sans en créer un autre : le libellé de l'étape 2 à la fin.
  assert.equal(trouver(racine, "libelle"), libelle);
  assert.equal(libelle.textContent, "Étape 2");
}));

test("monterGeste : la flèche est visible sur toute image figée (montage, pause, étape, fin) et masquée en lecture ; le disque suit l'état", () => banc((dom, temps) => {
  const { g, racine, def } = monter(dom);
  const fleche = trouver(racine, "fleche"), disque = trouver(racine, "disque");
  const cx = () => disque.getAttribute("cx");
  assert.equal(fleche.getAttribute("display"), "inline", "au montage : image figée du début");
  assert.equal(cx(), ecrireValeur(def.etat(0).x));
  g.jouer();
  assert.equal(fleche.getAttribute("display"), "inline", "lancée, la lecture n'a pas encore dessiné d'image");
  temps.avancer(100);
  assert.equal(fleche.getAttribute("display"), "none", "en lecture");
  assert.equal(cx(), ecrireValeur(def.etat(0.1).x));
  temps.avancer(100);
  assert.equal(cx(), ecrireValeur(def.etat(0.2).x), "le disque avance");
  g.pause();
  assert.equal(fleche.getAttribute("display"), "inline", "en pause");
  assert.equal(cx(), ecrireValeur(def.etat(0.2).x), "la pause laisse le disque où il est");
  g.jouer();
  temps.avancer(100);
  assert.equal(fleche.getAttribute("display"), "none");
  jusquAuBout(temps);
  assert.equal(fleche.getAttribute("display"), "inline", "en fin de lecture");
  assert.equal(cx(), ecrireValeur(def.etat(def.duree).x));
  g.rejouer();
  assert.equal(fleche.getAttribute("display"), "inline", "Rejouer montre d'abord l'image figée du début");
  assert.equal(cx(), ecrireValeur(def.etat(0).x));
  temps.avancer(100);
  assert.equal(fleche.getAttribute("display"), "none", "puis la lecture");
  g.allerEtape(1);
  assert.equal(fleche.getAttribute("display"), "inline", "pas à pas");
  assert.equal(cx(), ecrireValeur(def.etat(def.etapes[1].t).x));
}));

test("monterGeste : le DOM mis à jour égale toujours le rendu neuf de la même image (étapes, instants, images de lecture)", () => banc((dom, temps) => {
  const { g, racine, def } = monter(dom);
  assert.equal(serialiserDom(racine), attendue(def, 0, true));
  for (let i = 0; i < def.etapes.length; i++) {
    g.allerEtape(i);
    assert.equal(serialiserDom(racine), serialiserDescription(imageFigee(def, i)), `étape ${i + 1}`);
  }
  for (const t of [0, 0.4, 1.4999, 1.5, 2.2, 3]) {
    g.allerA(t);
    assert.equal(serialiserDom(racine), attendue(def, t, true), `instant ${t}`);
  }
  // Une image de lecture : le même instant que le lecteur calcule (0,7 s puis une image de 0,1 s).
  g.allerA(0.7);
  g.jouer();
  temps.avancer(100);
  assert.equal(serialiserDom(racine), attendue(def, 0.7 + 0.1, false));
  // Et le libellé suit l'étape que franchit la lecture.
  temps.avancer(100);
  g.allerA(1.45);
  g.jouer();
  temps.avancer(100);
  assert.equal(trouver(racine, "libelle").textContent, "Étape 2");
}));

test("monterGeste : en animations réduites, aucune lecture automatique ; chaque étape est une image figée avec sa flèche, et la liste d'étapes reste commandée", () => banc((dom, temps) => {
  const lis = lignes(dom), vues = [];
  const { g, racine, def } = monter(dom, { etapes: lis, reduit: true, onEtape: (k) => vues.push(k) });
  assert.equal(temps.observateurs.length, 0, "pas d'observateur de visibilité");
  assert.equal(temps.demandes, 0, "aucune image d'animation demandée");
  const fleche = trouver(racine, "fleche");
  for (let i = 0; i < def.etapes.length; i++) {
    g.allerEtape(i);
    assert.equal(serialiserDom(racine), serialiserDescription(imageFigee(def, i)), `étape ${i + 1}`);
    assert.equal(fleche.getAttribute("display"), "inline", `étape ${i + 1} : flèche visible`);
    assert.equal(lis[i].classList.contains("on"), true, `étape ${i + 1} marquée`);
    assert.equal(lis[i].querySelector("button").getAttribute("aria-current"), "step");
  }
  assert.deepEqual(vues, [0, 1]);
  assert.equal(temps.demandes, 0, "passer d'étape en étape ne lance aucune animation");
}));

test("monterGeste : hors animations réduites, la lecture démarre à 60 % de visibilité ; detruire arrête tout", () => banc((dom, temps) => {
  const { g, racine, barre } = monter(dom);
  assert.equal(temps.observateurs.length, 1);
  const observateur = temps.observateurs[0];
  assert.deepEqual(observateur.observes, [racine]);
  observateur.declencher(0.6);
  assert.equal(barre.childNodes[0].textContent, "Pause");
  temps.avancer(100);
  assert.equal(trouver(racine, "fleche").getAttribute("display"), "none");
  const attente = [...temps.file.keys()];
  g.detruire();
  assert.deepEqual(temps.annules.slice(-1), attente);
  assert.equal(observateur.deconnecte, true);
  assert.equal(temps.enAttente(), 0);
}));

test("monterGeste : la vitesse de lecture du geste est celle du lecteur ; absente, la lecture est à vitesse réelle", () => banc((dom, temps) => {
  const lent = monter(dom, {}, gesteEssai({ vitesseLecture: 0.5 }));
  lent.g.jouer();
  temps.avancer(100);
  assert.equal(trouver(lent.racine, "disque").getAttribute("cx"), ecrireValeur(lent.def.etat(0.05).x));
  assert.equal(lent.barre.childNodes[2].childNodes[0].textContent, "× 0,5");
  lent.g.pause();
  const reel = monter(dom);
  reel.g.jouer();
  temps.avancer(100);
  assert.equal(trouver(reel.racine, "disque").getAttribute("cx"), ecrireValeur(reel.def.etat(0.1).x));
  assert.equal(reel.barre.childNodes.length, 2, "pas de facteur à vitesse réelle");
  reel.g.pause();
}));

test("monterGeste : une image qui change de structure lève à l'appelant sans toucher au dessin, et le moteur reste utilisable", () => banc((dom) => {
  const base = gesteEssai();
  const fautif = gesteEssai({
    dessiner: (etat, options) => {
      const d = base.dessiner(etat, options);
      return etat.x > 200 ? { ...d, enfants: [...d.enfants, n("circle", { cx: 0, cy: 0, r: 1 })] } : d;
    },
  });
  const { g, racine } = monter(dom, {}, fautif);
  const avant = serialiserDom(racine);
  assert.throws(() => g.allerA(2.5), /Structure du dessin changée/);
  assert.equal(serialiserDom(racine), avant, "le dessin n'a pas bougé");
  g.allerA(0.5);
  assert.equal(serialiserDom(racine), attendue(fautif, 0.5, true), "une image correcte s'affiche ensuite");
}));

test("monterGeste : un geste dont la première image ne se dessine pas lève au montage, sans rien laisser dans le conteneur", () => banc((dom, temps) => {
  const conteneur = dom.conteneur();
  assert.throws(() => monterGeste(gesteEssai({ dessiner: () => { throw new Error("dessin impossible"); } }), { conteneur }), /dessin impossible/);
  assert.equal(conteneur.childNodes.length, 0);
  assert.equal(temps.observateurs.length, 0);
}));

test("monterGeste : rend les commandes du lecteur et le geste lui-même", () => banc((dom) => {
  const { g, def } = monter(dom);
  assert.deepEqual(Object.keys(g).sort(), ["allerA", "allerEtape", "detruire", "geste", "jouer", "pause", "rejouer"]);
  assert.equal(g.geste, def);
}));

test("monterGeste : la flèche de chaque étape est celle de l'étape, tracé mis à jour dans le DOM d'une étape à l'autre, immobile dans l'étape", () => banc((dom) => {
  const { g, racine, def } = monter(dom);
  const trace = () => trouver(racine, "fleche-trait").getAttribute("d");
  g.allerEtape(0);
  const d0 = trace();
  g.allerEtape(1);
  const d1 = trace();
  assert.notEqual(d0, d1, "une flèche par étape");
  assert.equal(d0, trouverRole(imageFigee(def, 0), "fleche-trait").attributs.d);
  assert.equal(d1, trouverRole(imageFigee(def, 1), "fleche-trait").attributs.d);
  // En pas à pas dans une étape (pause à des instants quelconques), la flèche ne bouge pas ; elle change avec l'étape.
  for (const t of [0.4, 1.49]) { g.allerA(t); assert.equal(trace(), d0, `à ${t} s`); }
  for (const t of [1.5, 1.6, 3]) { g.allerA(t); assert.equal(trace(), d1, `à ${t} s`); }
}));

test("monterGeste : ce que le contrôle des images signale est ce que l'exécution refuse, et la lecture s'y fige (la sonde du relecteur : rayon NaN près de x = 100)", () => banc((dom, temps) => {
  const base = gesteEssai();
  const rayon = (etat) => (Math.abs(etat.x - 100) < 2 ? Math.acos(1.0000001) : 14);
  const sonde = gesteEssai({ dessiner: (etat, o) => avecAttributs(base.dessiner(etat, o), "disque", { r: rayon(etat) }) });
  // Le contrôle la signale, avec son instant.
  const pb = problemesGeste(sonde, ETAPES_ESSAI);
  assert.equal(pb.length, 1);
  assert.match(pb[0], /^1\.\d{3} s, image de lecture : Valeur d'attribut non finie : NaN/);
  // Le moteur la refuse bien : en lecture, la boucle lève à la première image fautive, avant d'écrire, et ne demande pas la
  // suivante. La lecture se fige, bouton encore sur « Pause » : c'est ce que le contrôle doit empêcher d'arriver.
  const { g, racine, barre } = monter(dom, {}, sonde);
  const disque = trouver(racine, "disque");
  g.jouer();
  let erreur = null;
  for (let i = 0; i < 200 && erreur === null && temps.enAttente(); i++) {
    try { temps.avancer(16); } catch (e) { erreur = e; }
  }
  assert.ok(erreur, "la boucle a levé");
  assert.ok(pb[0].endsWith(erreur.message), "le contrôle dit mot pour mot ce que l'exécution refuse");
  assert.equal(disque.getAttribute("r"), "14", "rien n'a été écrit de l'image fautive");
  assert.equal(temps.enAttente(), 0, "plus aucune image demandée : la lecture est figée");
  assert.equal(barre.childNodes[0].textContent, "Pause");
}));

test("le moteur et les contrôles ne dessinent un geste que par imageA : ce qu'on vérifie est exactement ce qu'on montre", () => {
  // Test de source : les lignes de commentaire écartées, aucun appel direct à dessiner hors d'imageA.
  const code = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  for (const chemin of ["../js/geste-moteur.js", "./aides-dessins.mjs"]) {
    const s = code(chemin);
    assert.ok(/\bimageA\(/.test(s), `${chemin} passe par imageA`);
    assert.equal(/\.dessiner\(/.test(s), false, `${chemin} ne dessine pas lui-même`);
  }
  assert.equal(code("../js/geste-regles.js").match(/\.dessiner\(/g).length, 1, "js/geste-regles.js : un seul appel, dans imageA");
});
