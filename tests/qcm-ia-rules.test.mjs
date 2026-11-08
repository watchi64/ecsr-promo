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

// Lot 2B, tâche 6 : la liste « Propositions IA » range les brouillons à relire par QCM.
const THEMES_IA = [
  { id: 1, type: "theme", numero: 22, titre: "Feux du véhicule" },
  { id: 2, type: "theme", numero: 12, titre: "Intersections" },
  { id: 101, type: "notion", categorie: "QCM transversal", titre: "QCM des sanctions" },
];
const brouillon = (id, qcm_id, theme_id, created_at, titre = "QCM " + qcm_id) =>
  ({ id, qcm_id, created_at, statut: "a_relire", qcm: { id: qcm_id, theme_id, titre } });

test("groupesDeBrouillons : un groupe par QCM, avec le nombre et le plus ancien", () => {
  const g = client.groupesDeBrouillons([
    brouillon(1, 50, 1, "2026-10-20T10:00:00Z"),
    brouillon(2, 50, 1, "2026-10-12T10:00:00Z"),
    brouillon(3, 51, 2, "2026-10-25T10:00:00Z"),
  ], THEMES_IA);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0], { theme: THEMES_IA[0], qcmId: 50, titre: "Thème 22 · Feux du véhicule", nombre: 2, plusAncien: "2026-10-12T10:00:00Z" });
  assert.equal(g[1].nombre, 1);
});

test("groupesDeBrouillons : trié par ancienneté, le QCM qui attend depuis le plus longtemps d'abord", () => {
  const g = client.groupesDeBrouillons([
    brouillon(1, 51, 2, "2026-10-25T10:00:00Z"),
    brouillon(2, 50, 1, "2026-10-12T10:00:00Z"),
    brouillon(3, 52, 101, "2026-10-18T10:00:00Z"),
  ], THEMES_IA);
  assert.deepEqual(g.map((x) => x.qcmId), [50, 52, 51]);
  assert.equal(g[1].titre, "QCM des sanctions", "un transversal n'a pas de numéro");
});

test("groupesDeBrouillons : un thème introuvable reste listé sous le titre du QCM", () => {
  const g = client.groupesDeBrouillons([brouillon(1, 60, 999, "2026-10-12T10:00:00Z", "Ronds-points")], THEMES_IA);
  assert.equal(g.length, 1);
  assert.equal(g[0].theme, null);
  assert.equal(g[0].titre, "Ronds-points");
});

test("groupesDeBrouillons : un brouillon sans QCM joint garde un titre lisible ; une liste vide donne une liste vide", () => {
  const g = client.groupesDeBrouillons([{ id: 1, qcm_id: 70, created_at: "2026-10-12T10:00:00Z", qcm: null }], THEMES_IA);
  assert.equal(g[0].titre, "QCM n° 70");
  assert.deepEqual(client.groupesDeBrouillons([], THEMES_IA), []);
  assert.deepEqual(client.groupesDeBrouillons(null, null), []);
});

test("groupesDeBrouillons : une date manquante ne fait pas le plus ancien", () => {
  const g = client.groupesDeBrouillons([
    brouillon(1, 50, 1, null), brouillon(2, 50, 1, "2026-10-12T10:00:00Z"), brouillon(3, 51, 2, "2026-10-14T10:00:00Z"),
  ], THEMES_IA);
  assert.equal(g[0].plusAncien, "2026-10-12T10:00:00Z");
  assert.deepEqual(g.map((x) => x.qcmId), [50, 51]);
});
