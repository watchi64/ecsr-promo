import test from "node:test";
import assert from "node:assert/strict";
import * as client from "../js/qcm-ia-rules.js";
import * as serveur from "../supabase/functions/qcm-ia/brouillons.mjs";

const ECHANTILLONS = [
  "Voir R413-3, R. 413-4, L.234-1, l'article 221-6 et D 221-10-1.",
  "Bilan 2024-2025, 50 km/h, LEGIARTI000006842030, 1-2 s, les 18-24 ans.",
  "| Excès | R413-14 | 135 € |\n_Textes : R412-6, R412-6-1_",
  "Art. L.  234-1 ; r413-17 ; d.221-3",
];

test("le navigateur et le serveur repèrent exactement les mêmes articles", () => {
  for (const t of ECHANTILLONS) assert.deepEqual(client.articlesCites(t), serveur.articlesCites(t), t);
});

test("le navigateur et le serveur lisent les mêmes titres de cours", () => {
  const md = "# T\n## 1. Intro\n### A. Un\n#### détail\n## 2. Suite\n";
  assert.deepEqual(client.titresDuCours(md), serveur.titresDuCours(md));
});

test("articlesHorsCours : seuls les articles absents du cours ressortent", () => {
  assert.deepEqual(client.articlesHorsCours(["Voir R. 413-3", "et R413-99"], ["R413-3"]), ["R413-99"]);
  assert.deepEqual(client.articlesHorsCours(["Aucun article ici."], []), []);
});

test("libelleTraceIa : nom et date au format JJ/MM, heure de Paris", () => {
  assert.equal(client.libelleTraceIa({ ia_validee_par: "Timy", ia_validee_le: "2026-10-23T21:30:00Z" }),
    "IA · validée par Timy le 23/10");
  // 23 h 30 UTC le 31/12 = 0 h 30 à Paris le 01/01 : le jour affiché est celui de Paris.
  assert.equal(client.libelleTraceIa({ ia_validee_par: "Hocine", ia_validee_le: "2026-12-31T23:30:00Z" }),
    "IA · validée par Hocine le 01/01");
  assert.equal(client.libelleTraceIa({ ia_validee_le: "2026-10-23T10:00:00Z" }), "IA · validée par un formateur le 23/10");
  assert.equal(client.libelleTraceIa({ ia_validee_par: "Timy", ia_validee_le: null }), null);
  assert.equal(client.libelleTraceIa(null), null);
});

test("brouillonVersQuestion : options au format du formulaire, sans id", () => {
  const q = client.brouillonVersQuestion({ id: 9, section: "S", enonce: "E ?", explication: null,
    options: [{ texte: "A", is_correct: true }, { texte: "B", is_correct: "oui" }] });
  assert.deepEqual(q, { section: "S", enonce: "E ?", explication: "",
    options: [{ texte: "A", is_correct: true }, { texte: "B", is_correct: false }] });
  assert.equal("id" in q, false);
});

test("resumeProposition : singulier, pluriel, écartés", () => {
  assert.equal(client.resumeProposition(1, 0), "1 brouillon à relire.");
  assert.equal(client.resumeProposition(3, 1), "3 brouillons à relire, 1 écarté par le contrôle.");
  assert.equal(client.resumeProposition(0, 2), "Aucun brouillon à relire, 2 écartés par le contrôle.");
});
