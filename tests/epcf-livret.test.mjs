// Le livret EPCF officiel (TP-01303, millésime 02) est unique : il porte les deux activités-types du titre, donc le CCP1 et le CCP2.
// Contrôle du gabarit (js/views/epcf-livret.js, lu en texte : la vue a besoin d'un navigateur) contre les grilles EPCF.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { EPCF_TRAMES } from "../js/epcf-trames.js";

const source = readFileSync(new URL("../js/views/epcf-livret.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const liste = (nom) => [...source.match(new RegExp(`const ${nom} = \\[([\\s\\S]*?)\\];`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const nu = (t) => t.replace(/^\d+\.\s*/, "").replace(/’/g, "'").trim();

test("le livret porte la fiche de résultats et les évaluations complémentaires des deux activités-types, et leur synthèse", () => {
  for (const at of [1, 2]) {
    assert.match(source, new RegExp(`fichePages\\(\\d, ${at}, AT${at}_TITRE, AT${at}_COMPETENCES, "at${at}"`), `fiche de l'activité-type ${at}`);
    assert.match(source, new RegExp(`complPage\\(\\d, "at${at}c"`), `évaluations complémentaires de l'activité-type ${at}`);
    assert.match(source, new RegExp(`synthActiviteRows\\(${at}, AT${at}_TITRE, AT${at}_COMPETENCES`), `synthèse de l'activité-type ${at}`);
  }
});

test("les compétences de l'activité-type 2 sont celles de la grille EPCF du CCP2 (C8 à C11, numérotées 1 à 4 sur le livret)", () => {
  assert.deepEqual(liste("AT2_COMPETENCES").map(nu), EPCF_TRAMES.ccp2.sections.map((s) => nu(s.competenceTP)));
});

test("la page du livret dit qu'il sert aux deux CCP", () => {
  assert.match(source, /Un livret par stagiaire, le même pour le CCP1 et le CCP2/);
});
