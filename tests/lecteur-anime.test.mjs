import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { etapeA, actionVisibilite, facteurLecture, SEUIL_DEMARRAGE, SEUILS_VISIBILITE } from "../js/lecteur-anime-regles.js";
import * as rendu from "../js/scene-rendu.js";
import { monterLecteur } from "../js/lecteur-anime.js";
import { avecBanc as banc } from "./aides-dom.mjs";

// scene-rendu.js importe le module des règles sous le jeton de cache de l'app (?v=…) : pour Node, c'est une autre instance que
// celle importée ci-dessus sans jeton. Les références réexportées se comparent donc à l'instance que voit scene-rendu.js, chargée
// sous le même jeton (celui d'index.html, que le hook de cache change à chaque version).
const jeton = readFileSync(new URL("../index.html", import.meta.url), "utf8").match(/\?v=([0-9a-z]+)/)[1];
const vuParLeRendu = await import(`../js/lecteur-anime-regles.js?v=${jeton}`);

test("etapeA : la dernière étape dont le début est atteint, 0 avant la première", () => {
  const etapes = [{ t: 0 }, { t: 1.5 }, { t: 3 }];
  assert.equal(etapeA(etapes, 0), 0);
  assert.equal(etapeA(etapes, 1.4999), 0);
  assert.equal(etapeA(etapes, 1.5), 1);
  assert.equal(etapeA(etapes, 2.9999999999), 2);   // tolérance de 1e-9 sur le début
  assert.equal(etapeA(etapes, 99), 2);
});

test("visibilité et facteur : mêmes règles qu'avant, toujours réexportées par scene-rendu.js", () => {
  assert.equal(SEUIL_DEMARRAGE, 0.6);
  assert.deepEqual(SEUILS_VISIBILITE, [0, 0.6]);
  assert.equal(actionVisibilite(0.6, false, false), "demarrer");
  assert.equal(actionVisibilite(0, true, true), "pause");
  assert.equal(actionVisibilite(0.3, true, false), null);
  assert.equal(facteurLecture(1), null);
  assert.deepEqual(facteurLecture(0.5), { texte: "× 0,5", libelle: "Lecture ralentie : 0,5 fois la vitesse réelle" });
  assert.equal(rendu.actionVisibilite, vuParLeRendu.actionVisibilite);
  assert.equal(rendu.facteurLecture, vuParLeRendu.facteurLecture);
  assert.equal(rendu.SEUIL_DEMARRAGE, SEUIL_DEMARRAGE);
  assert.deepEqual(rendu.SEUILS_VISIBILITE, SEUILS_VISIBILITE);
});

// ===== monterLecteur : le lecteur monté sur un DOM factice, avec un temps que le test pilote (tests/aides-dom.mjs) =====

const DUREE = 3, ETAPES = [{ t: 0 }, { t: 1.5 }];
const proche = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// Un lecteur sur un schéma sans contenu : `rendre` note chaque image demandée [instant, figée], `onEtape` chaque étape annoncée.
function monter(dom, options = {}) {
  const conteneur = dom.conteneur();
  const racine = dom.doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rendus = [], etapesVues = [];
  const lecteur = monterLecteur({ racine, conteneur, duree: DUREE, etapes: ETAPES,
    rendre: (instant, fige) => rendus.push([instant, fige]), onEtape: (k) => etapesVues.push(k), ...options });
  const barre = conteneur.childNodes[1];
  return { conteneur, racine, barre, lecture: barre.childNodes[0], rejouer: barre.childNodes[1], lecteur, rendus, etapesVues };
}

// Les éléments de la liste des étapes : un <li> qui contient un bouton, ou (sans bouton) un simple <span>.
const lignes = (dom, avecBouton = true, nombre = ETAPES.length) => Array.from({ length: nombre }, () => {
  const ligne = dom.doc.createElement(avecBouton ? "li" : "span");
  if (avecBouton) ligne.append(dom.doc.createElement("button"));
  return ligne;
});

// Des images toutes les `ms` millisecondes jusqu'à la fin de la lecture (borné : un lecteur qui ne finit pas rend `max`).
function jusquAuBout(temps, ms = 100, max = 200) {
  let images = 0;
  while (temps.enAttente() && images < max) { temps.avancer(ms); images++; }
  return images;
}

test("monterLecteur : le bouton dit Lecture, Pause puis Revoir ; Rejouer repart du début", () => banc((dom, temps) => {
  const m = monter(dom);
  assert.equal(m.lecture.textContent, "Lecture");
  assert.equal(m.rejouer.textContent, "Rejouer");
  assert.deepEqual(m.rendus, [[0, true]], "première image : le début, figé");
  assert.equal(temps.demandes, 0, "rien ne joue tant qu'on ne l'a pas demandé");
  m.lecture.click();
  assert.equal(m.lecture.textContent, "Pause");
  assert.equal(temps.enAttente(), 1);
  temps.avancer(100);
  const enLecture = m.rendus.at(-1);
  assert.equal(enLecture[1], false, "image de lecture : non figée");
  m.lecture.click();
  assert.equal(m.lecture.textContent, "Lecture");
  assert.equal(temps.enAttente(), 0, "l'image en attente est annulée à la pause");
  assert.deepEqual(m.rendus.at(-1), [enLecture[0], true], "la pause redessine, figée, l'image de l'instant où la lecture s'arrête");
  m.lecteur.jouer();
  jusquAuBout(temps);
  assert.equal(m.lecture.textContent, "Revoir");
  m.lecture.click();                                    // Revoir : repart du début
  assert.equal(m.lecture.textContent, "Pause");
  temps.avancer(100);
  assert.ok(proche(m.rendus.at(-1)[0], 0.1), "la lecture repart de 0");
  // Rejouer, au milieu de la lecture : image figée du début, puis lecture.
  temps.avancer(100);
  m.rejouer.click();
  assert.deepEqual(m.rendus.at(-1), [0, true]);
  assert.equal(m.lecture.textContent, "Pause");
  assert.equal(temps.enAttente(), 1);
  temps.avancer(100);
  assert.ok(proche(m.rendus.at(-1)[0], 0.1) && m.rendus.at(-1)[1] === false);
}));

test("monterLecteur : allerEtape marque l'étape (classe on, aria-current sur son bouton) et prévient onEtape", () => banc((dom, temps) => {
  const lis = lignes(dom), apres = [];
  const m = monter(dom, { elementsEtapes: lis, apresEtape: (i) => apres.push(i) });
  const marques = () => lis.map((li) => li.classList.contains("on"));
  const courants = () => lis.map((li) => li.querySelector("button").getAttribute("aria-current"));
  // Au montage, la première étape est marquée et annoncée.
  assert.deepEqual(marques(), [true, false]);
  assert.deepEqual(courants(), ["step", null]);
  assert.equal(lis[0].getAttribute("aria-current"), null, "aria-current est sur le bouton, pas sur l'élément qui le contient");
  assert.deepEqual(m.etapesVues, [0]);
  m.lecteur.allerEtape(1);
  assert.deepEqual(marques(), [false, true]);
  assert.deepEqual(courants(), [null, "step"]);
  assert.deepEqual(m.etapesVues, [0, 1]);
  assert.deepEqual(m.rendus.at(-1), [1.5, true], "l'image figée de l'étape, à son instant");
  assert.deepEqual(apres, [1]);
  // La même étape redemandée est redessinée, mais pas annoncée de nouveau.
  m.lecteur.allerEtape(1);
  assert.deepEqual(m.etapesVues, [0, 1]);
  assert.deepEqual(apres, [1, 1]);
  // Un appui pendant la lecture l'arrête sur l'image figée de l'étape.
  m.lecteur.allerEtape(0);
  m.lecteur.jouer();
  temps.avancer(100);
  m.lecteur.allerEtape(1);
  assert.equal(temps.enAttente(), 0);
  assert.equal(m.lecture.textContent, "Lecture");
  assert.deepEqual(m.rendus.at(-1), [1.5, true]);
  // La lecture elle-même change d'étape quand elle franchit l'instant de la suivante : une seule annonce.
  m.lecteur.allerEtape(0);
  const avant = m.etapesVues.length;
  m.lecteur.jouer();
  jusquAuBout(temps);
  assert.deepEqual(m.etapesVues.slice(avant), [1]);
  assert.deepEqual(marques(), [false, true]);
}));

test("monterLecteur : sans bouton dans l'élément d'une étape, aria-current va sur l'élément lui-même", () => banc((dom) => {
  const spans = lignes(dom, false);
  const m = monter(dom, { elementsEtapes: spans });
  assert.deepEqual(spans.map((s) => s.getAttribute("aria-current")), ["step", null]);
  m.lecteur.allerEtape(1);
  assert.deepEqual(spans.map((s) => s.getAttribute("aria-current")), [null, "step"]);
  assert.deepEqual(spans.map((s) => s.classList.contains("on")), [false, true]);
}));

test("monterLecteur : allerA ramène l'instant dans [0, durée] et arrête la lecture", () => banc((dom, temps) => {
  const m = monter(dom);
  m.lecteur.allerA(1.2);
  assert.deepEqual(m.rendus.at(-1), [1.2, true]);
  m.lecteur.allerA(-5);
  assert.deepEqual(m.rendus.at(-1), [0, true]);
  assert.equal(m.lecture.textContent, "Lecture");
  m.lecteur.allerA(99);
  assert.deepEqual(m.rendus.at(-1), [DUREE, true]);
  assert.equal(m.lecture.textContent, "Revoir", "à la durée, le bouton propose de revoir");
  // En pleine lecture, allerA s'arrête sur l'image demandée.
  m.lecteur.allerA(0);
  m.lecteur.jouer();
  temps.avancer(100);
  m.lecteur.allerA(2);
  assert.equal(temps.enAttente(), 0);
  assert.deepEqual(m.rendus.at(-1), [2, true]);
  assert.equal(m.lecture.textContent, "Lecture");
}));

test("monterLecteur : allerA ignore un instant qui n'est pas un nombre fini, sans rien changer, et la lecture va quand même à sa fin", () => banc((dom, temps) => {
  // À l'arrêt : l'appel ne change rien (ni image, ni bouton), et une lecture ultérieure se termine.
  const m = monter(dom);
  m.lecteur.allerA(1);
  const images = m.rendus.length;
  for (const v of [NaN, undefined, Infinity, -Infinity, null, "1", {}]) m.lecteur.allerA(v);
  assert.equal(m.rendus.length, images, "aucune image demandée pour un instant ignoré");
  assert.equal(m.lecture.textContent, "Lecture");
  m.lecteur.jouer();
  const n = jusquAuBout(temps);
  assert.ok(n < 100, `la lecture ne finit pas (${n} images)`);
  assert.deepEqual(m.rendus.at(-1), [DUREE, true]);
  assert.equal(m.lecture.textContent, "Revoir");
  // En pleine lecture : elle continue, avec la même image en attente.
  m.lecteur.jouer();
  temps.avancer(100);
  const attente = [...temps.file.keys()], vues = m.rendus.length;
  for (const v of [NaN, undefined, Infinity]) m.lecteur.allerA(v);
  assert.equal(m.rendus.length, vues);
  assert.equal(m.lecture.textContent, "Pause");
  assert.deepEqual([...temps.file.keys()], attente, "l'image en attente n'a pas été annulée");
  assert.ok(jusquAuBout(temps) < 100);
  assert.deepEqual(m.rendus.at(-1), [DUREE, true]);
  // Un appel ignoré ne compte pas comme une première lecture demandée : la lecture automatique reste possible.
  const neuf = monter(dom);
  neuf.lecteur.allerA(NaN);
  temps.observateurs.at(-1).declencher(0.6);
  assert.equal(neuf.lecture.textContent, "Pause");
}));

test("monterLecteur : la lecture avance d'au plus 0,1 s par image, s'arrête à la durée sur une image figée et laisse Revoir", () => banc((dom, temps) => {
  const m = monter(dom);
  m.lecteur.jouer();
  temps.avancer(16);                                     // une image à 60 Hz
  assert.ok(proche(m.rendus.at(-1)[0], 0.016));
  assert.equal(m.rendus.at(-1)[1], false, "image de lecture : non figée");
  temps.avancer(5000);                                   // une image très longue (onglet en arrière-plan) : plafonnée à 0,1 s
  assert.ok(proche(m.rendus.at(-1)[0], 0.116));
  jusquAuBout(temps);
  assert.deepEqual(m.rendus.at(-1), [DUREE, true], "la dernière image est une image figée à la durée");
  const lecture = m.rendus.slice(1, -1);
  assert.ok(lecture.length > 10 && lecture.every(([, fige]) => fige === false), "toute image de lecture est non figée");
  const instants = m.rendus.slice(1).map(([t]) => t);
  assert.ok(instants.every((t, i) => i === 0 || t > instants[i - 1]), "les instants croissent");
  assert.equal(temps.enAttente(), 0, "plus aucune image demandée");
  assert.equal(m.lecture.textContent, "Revoir");
}));

test("monterLecteur : la vitesse de lecture multiplie l'avance ; le facteur s'affiche sous le schéma seulement quand elle n'est pas 1", () => banc((dom, temps) => {
  const lent = monter(dom, { vitesseLecture: 0.5 });
  lent.lecteur.jouer();
  temps.avancer(100);
  assert.ok(proche(lent.rendus.at(-1)[0], 0.05), "0,1 s d'horloge font 0,05 s de geste à la moitié de la vitesse");
  lent.lecteur.pause();
  const facteur = lent.barre.childNodes[2];
  assert.equal(facteur.className, "scene-facteur");
  assert.equal(facteur.childNodes[0].textContent, "× 0,5");
  assert.equal(facteur.childNodes[0].getAttribute("aria-hidden"), "true");
  assert.equal(facteur.childNodes[1].className, "scene-lecteur-ecran");
  assert.equal(facteur.childNodes[1].textContent, "Lecture ralentie : 0,5 fois la vitesse réelle");
  const rapide = monter(dom, { vitesseLecture: 2 });
  rapide.lecteur.jouer();
  temps.avancer(100);
  assert.ok(proche(rapide.rendus.at(-1)[0], 0.2));
  assert.equal(rapide.barre.childNodes[2].childNodes[1].textContent, "Lecture accélérée : 2 fois la vitesse réelle");
  rapide.lecteur.pause();
  assert.equal(monter(dom).barre.childNodes.length, 2, "à la vitesse réelle, pas de facteur affiché");
}));

test("monterLecteur : l'observateur lance la lecture à 60 % de visibilité, une seule fois, et l'arrête quand le schéma sort de l'écran", () => banc((dom, temps) => {
  const m = monter(dom);
  assert.equal(temps.observateurs.length, 1);
  const observateur = temps.observateurs[0];
  assert.deepEqual(observateur.options, { threshold: [0, 0.6] });
  assert.deepEqual(observateur.observes, [m.racine]);
  observateur.declencher(0.3);                           // pas assez visible
  assert.equal(m.lecture.textContent, "Lecture");
  observateur.declencher(0.6);                           // 60 % : démarre
  assert.equal(m.lecture.textContent, "Pause");
  observateur.declencher(0.3);                           // à moitié sorti : la lecture continue
  assert.equal(m.lecture.textContent, "Pause");
  observateur.declencher(0);                             // tout à fait sorti : pause
  assert.equal(m.lecture.textContent, "Lecture");
  observateur.declencher(0.9);                           // de retour : ne repart pas tout seul
  assert.equal(m.lecture.textContent, "Lecture");
  assert.equal(temps.enAttente(), 0);
  // Une lecture ou une étape demandée avant l'arrivée à l'écran l'emporte sur la lecture automatique.
  const demande = monter(dom);
  demande.lecteur.allerEtape(1);
  temps.observateurs[1].declencher(0.6);
  assert.equal(demande.lecture.textContent, "Lecture");
  assert.equal(temps.enAttente(), 0);
}));

test("monterLecteur : en animations réduites, aucun observateur donc aucune lecture automatique, et toute image est figée", () => banc((dom, temps) => {
  const m = monter(dom, { reduit: true });
  assert.equal(temps.observateurs.length, 0, "aucun observateur de visibilité");
  assert.equal(temps.demandes, 0, "aucune image d'animation demandée");
  m.lecteur.allerEtape(1);
  m.lecteur.allerA(0.7);
  assert.deepEqual(m.rendus, [[0, true], [1.5, true], [0.7, true]]);
  assert.equal(m.lecture.textContent, "Lecture");
  assert.equal(temps.demandes, 0);
  // Sans IntersectionObserver (navigateur ancien), même absence d'observateur et aucune erreur, hors animations réduites.
  delete globalThis.IntersectionObserver;
  assert.doesNotThrow(() => monter(dom));
  assert.equal(temps.observateurs.length, 0);
}));

test("monterLecteur : detruire annule l'image en attente et déconnecte l'observateur ; un schéma sorti du document se détruit seul", () => banc((dom, temps) => {
  const m = monter(dom);
  const observateur = temps.observateurs[0];
  m.lecteur.jouer();
  temps.avancer(100);
  const attente = [...temps.file.keys()];
  assert.equal(attente.length, 1);
  m.lecteur.detruire();
  assert.deepEqual(temps.annules.slice(-1), attente, "l'image en attente est annulée");
  assert.equal(temps.enAttente(), 0);
  assert.equal(observateur.deconnecte, true);
  const images = m.rendus.length;
  assert.equal(temps.avancer(100), false, "plus rien ne tourne");
  assert.equal(m.rendus.length, images);
  // Sorti du document pendant la lecture : la prochaine image détruit le lecteur sans rien dessiner.
  const sortant = monter(dom);
  sortant.lecteur.jouer();
  temps.avancer(100);
  const dessinees = sortant.rendus.length;
  sortant.conteneur.dansLeDocument = false;
  temps.avancer(100);
  assert.equal(sortant.rendus.length, dessinees, "aucune image dessinée hors du document");
  assert.equal(temps.enAttente(), 0, "aucune image redemandée");
  assert.equal(temps.observateurs[1].deconnecte, true);
}));
