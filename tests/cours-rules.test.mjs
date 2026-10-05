import { test } from "node:test";
import assert from "node:assert/strict";
import {
  titreDepuisMarkdown, tempsLecture, insererSyntaxe, cheminImage, interpolerAncres,
  cleCours, estCodeCompetence, estOuverture, libelleCle, comparerCodes, coursSuivant, cibleLienCours, coursVisibleEnApercu,
} from "../js/cours-rules.js";

test("titreDepuisMarkdown retire le préfixe THÈME XX", () => {
  assert.equal(titreDepuisMarkdown("# THÈME 12 - La vitesse\n\ntexte"), "La vitesse");
  assert.equal(titreDepuisMarkdown("# THEME 3 : Croisements"), "Croisements");
  assert.equal(titreDepuisMarkdown("pas de titre"), null);
});

test("tempsLecture arrondit et plancher à 1", () => {
  assert.equal(tempsLecture("mot"), 1);
  assert.equal(tempsLecture(Array(400).fill("mot").join(" ")), 2);
});

test("insererSyntaxe enrobe la sélection", () => {
  const r = insererSyntaxe("un mot ici", 3, 6, "**", "**", "texte");
  assert.equal(r.texte, "un **mot** ici");
  assert.equal(r.texte.slice(r.debutSel, r.finSel), "mot");
});

test("insererSyntaxe insère le défaut sans sélection", () => {
  const r = insererSyntaxe("ab", 1, 1, "**", "**", "gras");
  assert.equal(r.texte, "a**gras**b");
  assert.equal(r.texte.slice(r.debutSel, r.finSel), "gras");
});

test("cheminImage nettoie le nom et pose le préfixe du thème", () => {
  assert.equal(
    cheminImage(7, "Photo Vacances.PNG", "1723100000000"),
    "theme_07/1723100000000_photo-vacances.jpg");
  assert.equal(cheminImage(43, "???.jpg", "1"), "theme_43/1_image.jpg");
});

test("interpolerAncres suit les segments et borne aux extrémités", () => {
  const src = [0, 100, 300];
  const dst = [0, 50, 250];
  assert.equal(interpolerAncres(src, dst, 0), 0);
  assert.equal(interpolerAncres(src, dst, 100), 50);
  assert.equal(interpolerAncres(src, dst, 50), 25);       // milieu du 1er segment
  assert.equal(interpolerAncres(src, dst, 200), 150);     // milieu du 2e segment
  assert.equal(interpolerAncres(src, dst, -10), 0);       // avant la première ancre
  assert.equal(interpolerAncres(src, dst, 999), 250);     // après la dernière
});

test("interpolerAncres rend y tel quel si les ancres sont inutilisables", () => {
  assert.equal(interpolerAncres([], [], 42), 42);
  assert.equal(interpolerAncres([0, 10], [0], 42), 42);
});

test("titreDepuisMarkdown retire aussi le code d'une compétence", () => {
  assert.equal(titreDepuisMarkdown("# C2.4 - Tourner à droite et à gauche en agglomération"),
    "Tourner à droite et à gauche en agglomération");
  assert.equal(titreDepuisMarkdown("# C2 - Appréhender la route"), "Appréhender la route");
  assert.equal(titreDepuisMarkdown("# THÈME 12 - La vitesse"), "La vitesse");
});

test("cleCours : numéro d'un thème, code d'une compétence, rien pour une notion", () => {
  assert.equal(cleCours({ numero: 7 }), 7);
  assert.equal(cleCours({ numero: "12" }), 12);
  assert.equal(cleCours({ code: "C2.4", numero: null }), "C2.4");
  assert.equal(cleCours({ numero: null }), null);
  assert.equal(cleCours({ numero: null, code: null }), null);
  assert.equal(cleCours(null), null);
});

test("estCodeCompetence et estOuverture", () => {
  for (const c of ["C1", "C2.4", "C3.9", "C4.7"]) assert.ok(estCodeCompetence(c), c);
  for (const c of ["C5", "C2.0", "C2.10", "c2.4", 12, "12", null]) assert.ok(!estCodeCompetence(c), String(c));
  assert.ok(estOuverture("C3"));
  assert.ok(!estOuverture("C3.1"));
  assert.ok(!estOuverture(12));
});

test("libelleCle : numéro sur deux chiffres, code tel quel", () => {
  assert.equal(libelleCle(7), "07");
  assert.equal(libelleCle(42), "42");
  assert.equal(libelleCle("C2.4"), "C2.4");
});

test("comparerCodes suit l'ordre du livret", () => {
  assert.deepEqual(["C2.1", "C1.9", "C2", "C1", "C1.2"].sort(comparerCodes),
    ["C1", "C1.2", "C1.9", "C2", "C2.1"]);
});

test("coursSuivant : sous-compétence suivante visible, puis ouverture suivante, rien après C4.7", () => {
  const visibles = ["C1", "C1.1", "C1.9", "C2", "C2.4", "C2.6", "C4.7", 12];
  assert.equal(coursSuivant("C2.4", visibles), "C2.6");
  assert.equal(coursSuivant("C1.9", visibles), "C2");
  assert.equal(coursSuivant("C2", visibles), "C2.4");
  assert.equal(coursSuivant("C4.7", visibles), null);
  assert.equal(coursSuivant(12, visibles), null);
});

test("cibleLienCours : thème 1 à 57 ou code, sinon null", () => {
  assert.equal(cibleLienCours("cours:31"), 31);
  assert.equal(cibleLienCours("cours:C2.5"), "C2.5");
  assert.equal(cibleLienCours("cours:1"), 1);
  assert.equal(cibleLienCours("cours:57"), 57);
  assert.equal(cibleLienCours("cours:58"), null);
  assert.equal(cibleLienCours("cours:0"), null);
  assert.equal(cibleLienCours("cours:C5"), null);
  assert.equal(cibleLienCours("https://exemple.fr"), null);
});

test("cheminImage range les images d'une compétence à part", () => {
  assert.equal(cheminImage("C2.4", "Schéma.png", "1"), "competence_c2-4/1_schema.jpg");
  assert.equal(cheminImage(7, "Photo.PNG", "2"), "theme_07/2_photo.jpg");
});

test("coursVisibleEnApercu rejoue la règle de lecture de la base pour le rôle simulé", () => {
  const theme = { numero: 12, code: null, published: true };
  const themeBrouillon = { numero: 58, code: null, published: false };
  const competence = { numero: null, code: "C2.4", published: true };
  const competenceBrouillon = { numero: null, code: "C2.6", published: false };
  // Hors aperçu, la base a déjà filtré : tout ce qu'elle a rendu passe.
  for (const c of [theme, themeBrouillon, competence, competenceBrouillon]) assert.equal(coursVisibleEnApercu(c, null), true);
  // Aperçu stagiaire : seulement le publié.
  assert.deepEqual([theme, themeBrouillon, competence, competenceBrouillon].map((c) => coursVisibleEnApercu(c, "stagiaire")),
    [true, false, true, false]);
  // Aperçu formateur : le publié et les cours de thème non publiés, jamais un cours de compétence non publié.
  assert.deepEqual([theme, themeBrouillon, competence, competenceBrouillon].map((c) => coursVisibleEnApercu(c, "prof")),
    [true, true, true, false]);
});
