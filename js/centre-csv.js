// Export CSV de la matrice des notes (tableau de bord du centre). PUR : testé en node
// (tests/centre-csv.test.mjs). Mêmes cellules que la matrice de la page Notes : la dernière
// note de chaque compétence spéciale et de chaque thème, les thèmes 46 et 47 (évalués
// ensemble) en une colonne, la moyenne de toutes les notes. Format pour Excel en français :
// point-virgule, virgule décimale, UTF-8 avec BOM, fins de ligne CRLF.

import { estNotee, score20 } from "./notes-stats.js?v=20261023b";
import { compareByNom } from "./utils.js?v=20261023b";

const COLONNES_COMPETENCES = [
  { code: "C1", label: "C1" }, { code: "C2", label: "C2" },
  { code: "REMC", label: "REMC" }, { code: "MGDE", label: "GDE" },
];
// Thèmes groupés comme dans js/views/notes.js (THEME_GROUPS) : la note est portée par le premier.
const GROUPES = [[46, 47]];

function colonnesThemes() {
  const absorbes = new Set(GROUPES.flatMap((g) => g.slice(1)));
  const cols = [];
  for (let num = 1; num <= 57; num++) {
    if (absorbes.has(num)) continue;
    const g = GROUPES.find((x) => x[0] === num);
    cols.push({ num, label: g ? `Thèmes ${g.join("-")}` : `Thème ${String(num).padStart(2, "0")}` });
  }
  return cols;
}

function nombre(x) {
  const r = Math.round(x * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(".", ",");
}

// Neutralise une formule (= + - @ en tête) et cite ce qui casserait la ligne.
function cellule(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[;"\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function plusRecente(evals) {
  return evals.slice().sort((a, b) =>
    (a.date_eval < b.date_eval ? 1 : a.date_eval > b.date_eval ? -1 : (b.id ?? 0) - (a.id ?? 0)))[0] || null;
}

export function matriceNotesCsv({ stagiaires, evaluations, anonymiser }) {
  const themes = colonnesThemes();
  const entete = ["Stagiaire", "Moyenne", ...COLONNES_COMPETENCES.map((c) => c.label), ...themes.map((t) => t.label)];
  const notees = (evaluations || []).filter(estNotee);
  const lignes = [entete.map(cellule).join(";")];
  (stagiaires || []).filter((s) => s.actif).sort(compareByNom).forEach((s, i) => {
    const miennes = notees.filter((e) => e.stagiaire_id === s.id);
    const derniere = (filtre) => { const e = plusRecente(miennes.filter(filtre)); return e ? nombre(score20(e)) : ""; };
    const moyenne = miennes.length ? nombre(miennes.reduce((a, e) => a + score20(e), 0) / miennes.length) : "";
    const nom = anonymiser ? `Stagiaire ${i + 1}` : [s.nom, s.prenom].filter(Boolean).join(" ");
    lignes.push([
      nom, moyenne,
      ...COLONNES_COMPETENCES.map((c) => derniere((e) => e.type === "Compétence" && e.competence_code === c.code)),
      ...themes.map((t) => derniere((e) => e.type === "Thème" && e.theme_numero === t.num)),
    ].map(cellule).join(";"));
  });
  return "﻿" + lignes.join("\r\n") + "\r\n";
}

export function nomFichierCsv(nomPromo, dateIso) {
  const slug = String(nomPromo || "promo").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `matrice-notes_${slug || "promo"}_${dateIso}.csv`;
}
