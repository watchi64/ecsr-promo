// Lot B de l'audit du 09/11/2026 (docs/qualite/audit-2026-11-09.md) : le Planning en édition et sur téléphone.
// Les vues touchent au DOM : ces gardes lisent les sources, comme tests/finitions-lot-e.test.mjs ; le robot des parcours et
// le vérificateur de navigation jouent les écrans.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const planning = lire("js/views/planning.js");
const grille = lire("js/views/planning-grille.js");
const style = lire("css/style.css");

test("B1 : chaque créneau a ses propres colonnes, et une carte étroite garde le nom de son activité", () => {
  assert.match(planning, /lanes\.style\.gridTemplateColumns = `repeat\(\$\{nb\}, minmax\(0, 1fr\)\) 40px`/);
  assert.ok(!/maxLanes/.test(planning), "plus de colonnes communes à la demi-journée");
  assert.match(style, /\.p-lane-header \{ flex-wrap: wrap; \}/);
  assert.match(style, /\.p-lane-activite-wrap \{ flex: 1 1 9\.5rem; min-width: min\(9\.5rem, 100%\); \}/);
});

test("B2 : nouvelle navigation, le planning d'abord", () => {
  // L'en-tête ne double plus la navigation : ni « Émargement » (sa page, son bandeau), ni « Aujourd'hui » (l'onglet d'accueil de l'équipe).
  assert.match(planning, /admin && emargementActif\(\) && !v2/);
  assert.ok(!/deco\(icon\.today\(\)\), "Aujourd'hui"\)/.test(planning), "plus de bouton nommé « Aujourd'hui » dans la page");
  // Le retour au jour : « Revenir à aujourd'hui », hors de la semaine du jour seulement.
  assert.match(planning, /const retourBtn = avecAujourdhui && horsSemaineDuJour/);
  assert.match(planning, /"Revenir à aujourd'hui"\)/);
  // « Lecture seule... » redisait « Modifier » : partie sous la nouvelle navigation, gardée sous l'ancienne.
  assert.match(planning, /\(v2 \? null : "Lecture seule\. Clique « Modifier » pour éditer la semaine\."\)/);
  // La bascule rejoint les actions de la semaine ; plus de ligne à elle sous les sous-onglets.
  assert.match(planning, /if \(groupeVue\) actionsGroup\.appendChild\(groupeVue\)/);
  assert.ok(!/plan-bar/.test(planning + lire("css/pages.css")), "plus de .plan-bar");
  // La banque des bénévoles : raccourci en mode Modifier seulement (nouvelle navigation).
  assert.match(planning, /if \(!v2\) actionsGroup\.appendChild\(bnvBtn\(\)\)/);
  // Imprimer : l'icône d'imprimante.
  assert.match(planning, /printBtn\.appendChild\(deco\(icon\.printer\(\)\)\)/);
  assert.match(lire("js/icons.js"), /^\s+printer: /m);
});

test("B3 : le stagiaire ne lit plus ce qui s'adresse à qui place", () => {
  // Nouvelle navigation : les règles pour l'équipe seule ; l'ancienne (celle des promos en service) les garde pour tous.
  assert.match(planning, /if \(formateurConnecte\(\) \|\| !v2\) container\.appendChild\(buildRulesNote\(\)\)/);
  // Le retour au jour suit la semaine où mène le geste (le lundi suivant le week-end).
  assert.match(planning, /const horsSemaineDuJour = semaineLundi !== lundiEnCours\(new Date\(\)\)/);
  assert.match(planning, /if \(editing\) container\.appendChild\(el\("div", \{ class: "planning-helper" \}/);
  assert.ok(!/lane \(rangée\)/.test(planning), "l'aide de l'éditeur sans « lane »");
  assert.ok(!/"Consultation"/.test(planning), "plus « Consultation » en surtitre");
  assert.match(planning, /\(editing \? "Édition · " : ""\) \+ "Semaine du " \+ longLabel/);
});

test("B4 : la grille de l'équipe donne les prénoms, pas des effectifs", () => {
  assert.match(grille, /"Au tableau : " \+ noms\(c\.tableau\)/);
  assert.match(grille, /"En voiture : " \+ noms\(c\.conducteurs\)/);
  assert.match(grille, /"Élèves bénévoles : " : "Élève bénévole : "\) \+ noms\(c\.benevoles\)/);
  assert.ok(!/au tableau`|en voiture`/.test(grille), "plus « 2 au tableau » ni « 2 en voiture »");
});

test("B5 : deux gestes, deux mots ; « Vider » à l'écart ; des icônes qui disent ce qu'elles font", () => {
  assert.match(planning, /deco\(icon\.close\(\)\), "Quitter l'édition"\)/);
  assert.ok(!/✓ Terminer/.test(planning), "plus « ✓ Terminer » (barre ni pastille)");
  // « Vider les placements » après « Imprimer », en bout de barre.
  assert.ok(planning.indexOf("actionsGroup.appendChild(printBtn)") < planning.indexOf("p-vider-btn"), "« Vider » après « Imprimer »");
  assert.match(style, /\.week-bar-actions \.p-vider-btn \{ margin-left: auto; \}/);
  assert.match(planning, /el\("span", \{ class: "p-dice-mot" \}, "Tirer"\)/);
  assert.equal((planning.match(/"p-dice-mot" \}, "Tirer au sort"\)/g) || []).length, 2, "dés des élèves en salle et en voiture");
  assert.match(planning, /deco\(icon\.ban\(\)\), el\("span", \{ class: "p-dice-mot" \}, "Absent"\)/);
  assert.match(planning, /"aria-pressed": absPeda \? "true" : "false"/);
  assert.ok(!/\}, "⊘"\)/.test(planning), "plus le cercle barré seul comme bouton");
  // Le bouton d'absence se lit sans opacité réduite (contraste AA).
  assert.match(style, /\n\.p-abs-btn \{\r?\n  height: 30px; padding: 0\.18rem 0\.45rem; opacity: 1;/);
});

test("téléphone, mode Modifier : les commandes de l'éditeur à 44 px", () => {
  const bloc = style.slice(style.indexOf("Téléphone, mode Modifier : les commandes de l'éditeur à 44 px"));
  for (const cible of [".p-dice-btn", ".p-abs-btn", ".p-lane-delete", ".p-lane-drag", ".p-salle-toggle-btn", ".p-day-toggle", ".p-add-suite",
    ".p-add-parallele-mini", ".p-dice-option", ".p-edit-pill-btn", ".p-half-head.editable", ".sujet-chip-x", ".p-daynav-btn"]) {
    assert.ok(bloc.includes(cible), cible);
  }
});
