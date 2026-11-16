// Titres, étape 4 (migration 9, partie B) : la page Directions de centre du siège montre, sous chaque centre, ses titres en lecture.
// Lancer : node --test tests/siege-titres-centre.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ligneDeTitreEnLecture, titresDuCentreEnLecture } from "../js/titres-rules.js";

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const corps = (texte, debut) => {
  const i = texte.indexOf(debut);
  assert.ok(i >= 0, `introuvable : ${debut}`);
  const j = texte.indexOf("\n}\n", i);
  return texte.slice(i, j + 2);
};

// Des lignes comme titres_visibles(centre) les rend (titre fixe, titre du réseau, titre propre au centre, version d'un titre du réseau).
const direction = { id: 2, nom: "Direction de centre", niveau: "centre", lieu_id: null, fixe: true, origine_id: null, cases: {}, porteurs: 1, donnable: true };
const intervenant = { id: 7, nom: "Intervenant", niveau: "promo", lieu_id: null, fixe: false, origine_id: null, cases: {}, porteurs: 0, donnable: false };
const propre = { id: 40, nom: "Accueil", niveau: "centre", lieu_id: 1, fixe: false, origine_id: null, cases: {}, porteurs: 3, donnable: false };
const version = { id: 41, nom: "Secrétariat", niveau: "centre", lieu_id: 1, fixe: false, origine_id: 8, cases: {}, porteurs: 2, donnable: false };

test("ligneDeTitreEnLecture : nom, cadenas, niveau en clair, origine, version, porteurs", () => {
  assert.deepEqual(ligneDeTitreEnLecture(direction),
    { id: 2, nom: "Direction de centre", fixe: true, niveau: "Centre", origine: "Réseau", version: false, porteurs: 1 });
  assert.deepEqual(ligneDeTitreEnLecture(intervenant),
    { id: 7, nom: "Intervenant", fixe: false, niveau: "Promo", origine: "Réseau", version: false, porteurs: 0 });
  assert.deepEqual(ligneDeTitreEnLecture(propre),
    { id: 40, nom: "Accueil", fixe: false, niveau: "Centre", origine: "Centre", version: false, porteurs: 3 });
  assert.equal(ligneDeTitreEnLecture(version).version, true, "une version d'un titre du réseau est signalée");
  assert.equal(ligneDeTitreEnLecture({ ...propre, porteurs: null }).porteurs, 0, "porteurs absents : zéro");
});

test("titresDuCentreEnLecture : l'ordre de la base ; nul quand rien d'utilisable (repli silencieux)", () => {
  assert.deepEqual(titresDuCentreEnLecture([direction, intervenant, propre, version]).map((l) => l.id), [2, 7, 40, 41]);
  assert.deepEqual(titresDuCentreEnLecture([]), [], "aucun titre : liste vide, pas nul");
  for (const rien of [null, undefined, { message: "titres: Réservé à l'équipe du centre." }, "erreur"]) {
    assert.equal(titresDuCentreEnLecture(rien), null);
  }
  assert.deepEqual(titresDuCentreEnLecture([null, { id: 3 }, { nom: "Sans id" }, propre]).map((l) => l.id), [40], "lignes incomplètes écartées");
});

test("page du siège : les titres de chaque centre se lisent après l'affichage, en lecture seule, et leur refus ne dit rien", () => {
  const vue = lire("js/views/siege-directions.js");
  const bloc = corps(vue, "export function blocTitresDuCentre(");
  const ajout = corps(vue, "async function ajouterTitresDesCentres(");
  // Lecture seule : aucun bouton, aucun geste, aucune donnée de stagiaire.
  for (const interdit of ["button", "onClick", "donnerTitre", "creerTitre", "supprimerTitre", "ouvrirEditeurTitre", "donnable"]) {
    assert.ok(!bloc.includes(interdit), `bloc en lecture : ${interdit} absent`);
  }
  assert.ok(bloc.includes("cellulesDeTitre(") && bloc.includes("titresDuCentreEnLecture(") && bloc.includes("tableauEnListe("));
  assert.ok(bloc.includes('"Titres du centre"'), "intitulé « Titres du centre »");
  for (const colonne of ['"Titre"', '"Niveau"', '"Origine"', '"Porteurs"']) assert.ok(bloc.includes(colonne), `colonne ${colonne}`);
  // Un centre par lecture, en parallèle ; un refus : un avertissement de console, jamais une erreur affichée.
  assert.ok(ajout.includes("Promise.allSettled(") && ajout.includes("lireTitresVisibles(centre.id)"));
  for (const interdit of ["toast(", "boiteErreur(", "role: \"alert\"", "phraseDeRefus("]) assert.ok(!ajout.includes(interdit), `repli silencieux : ${interdit} absent`);
  assert.ok(ajout.includes("if (jeton !== rendu) return;"), "une page relue entre-temps n'est pas touchée");
  // Seulement quand les titres du réseau se lisent (sinon, la page d'avant, Task 32) ; la page attend la lecture avant de rendre la main.
  const page = corps(vue, "export async function renderDirections(");
  const garde = page.indexOf("if (!titresLus) return;");
  const appel = page.indexOf("ajouterTitresDesCentres(racine, centres, jeton)");
  assert.ok(garde > 0 && appel > garde, "lu après la garde du repli");
  assert.ok(page.includes("await titresDesCentres;"));
});

test("page Équipe : les cellules d'un titre sont la pièce partagée, sans changement d'affichage", () => {
  const equipe = lire("js/views/direction-equipe.js");
  const cellules = corps(equipe, "export function cellulesDeTitre(");
  assert.ok(cellules.includes("ligneDeTitreEnLecture(t)") && cellules.includes("icon.lock()") && cellules.includes('"Fixe"')
    && cellules.includes(" (version d'un titre du réseau)") && cellules.includes('pluriel(l.porteurs, "personne")'));
  assert.ok(corps(equipe, "function sectionTitres(").includes("...cellulesDeTitre(t)"), "la section Titres du centre de la direction s'en sert");
  assert.ok(lire("js/views/siege-directions.js").includes("cellulesDeTitre, PHRASE_COMPTE_CREE } from \"./direction-equipe.js"));
});

test("aucun tiret cadratin ni « prof » dans les fichiers de la tâche", () => {
  for (const chemin of ["js/views/siege-directions.js", "js/views/direction-equipe.js", "js/titres-rules.js", "tests/siege-titres-centre.test.mjs"]) {
    const t = lire(chemin);
    assert.ok(!t.includes(String.fromCharCode(0x2014)), `${chemin} : tiret cadratin`);
  }
  assert.ok(!/\bprof\b/i.test(corps(lire("js/views/siege-directions.js"), "export function blocTitresDuCentre(")));
});
