// Export CSV de la matrice des notes (tableau de bord du centre). PUR : testé en node
// (tests/centre-csv.test.mjs). Mêmes cellules que la matrice de la page Notes : la dernière
// note de chaque compétence spéciale et de chaque thème, les thèmes 46 et 47 (évalués
// ensemble) en une colonne, la moyenne de toutes les notes. Format pour Excel en français :
// point-virgule, virgule décimale, UTF-8 avec BOM, fins de ligne CRLF.

import { estNotee, score20 } from "./notes-stats.js?v=20261109f";
import { compareByNom } from "./utils.js?v=20261109f";
import { ratiosDeComptes } from "./comptes-reseau.js?v=20261109f";

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

export function nombre(x) {
  const r = Math.round(x * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(".", ",");
}

// Neutralise une formule (= + - @ en tête) et cite ce qui casserait la ligne.
export function cellule(v) {
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

// Texte réduit à des minuscules sans accent, les autres caractères remplacés par des tirets : sûr dans un nom de fichier.
// Les marques d'accent sont celles que la décomposition NFD sépare des lettres (U+0300 à U+036F).
const MARQUES_D_ACCENT = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");

export function slug(texte) {
  return String(texte || "").normalize("NFD").replace(MARQUES_D_ACCENT, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function nomFichierCsv(nomPromo, dateIso) {
  return `matrice-notes_${slug(nomPromo) || "promo"}_${dateIso}.csv`;
}

// === Tableaux de la direction et du siège (lot 5) : mêmes conventions que la matrice (BOM, point-virgule, virgule, CRLF) ===

const pourcent = (r) => (r == null ? "" : nombre(r * 100));
const sur20 = (r) => (r == null ? "" : nombre(r));

function fichier(entete, lignes) {
  const fin = String.fromCharCode(13, 10);
  return String.fromCharCode(0xFEFF) + [entete, ...lignes].map((l) => l.map(cellule).join(";")).join(fin) + fin;
}

// Une ligne par promo du centre. lignesParPromo : [{ nom, debut, fin, comptes }], `comptes` comme rend
// comptesDepuisIndicateurs (comptes additifs) ; un ratio sans base reste vide.
export function tableauCentreCsv(lignesParPromo) {
  const entete = ["Promo", "Début", "Fin", "Inscrits", "En formation", "Abandons (%)", "Absences (%)", "Réussite aux QCM (%)",
    "Examens QCM réussis (%)", "Moyenne des notes (/20)", "Critères EPCF acquis (%)"];
  const lignes = (lignesParPromo || []).map((p) => {
    const c = p.comptes;
    const r = ratiosDeComptes(c);
    return [p.nom, p.debut || "", p.fin || "", c.inscrits, c.enFormation, pourcent(r.abandon), pourcent(r.absences),
      pourcent(r.reussiteQcm), pourcent(r.examensQcm), sur20(r.notes), pourcent(r.epcf)];
  });
  return fichier(entete, lignes);
}

// Une ligne par centre, puis le total du réseau, puis la démonstration à part. vue : le résultat de vueDuReseau. Un centre masqué
// n'a aucun chiffre (les comptes qu'il porte sont ignorés), un centre sans promo en cours non plus.
export function tableauReseauCsv(vue) {
  const entete = ["Centre", "Promos en cours", "Stagiaires en formation", "Abandons (%)", "Absences (%)", "Réussite aux QCM (%)",
    "Moyenne des notes (/20)", "Critères EPCF acquis (%)", "Remarque"];
  const chiffres = (c) => {
    const r = ratiosDeComptes(c);
    return [c.enFormation, pourcent(r.abandon), pourcent(r.absences), pourcent(r.reussiteQcm), sur20(r.notes), pourcent(r.epcf)];
  };
  const ligne = (nom, c) => {
    if (c.promosEnCours === 0) return [nom, 0, "", "", "", "", "", "", "aucune promo en cours"];
    if (c.masque) return [nom, c.promosEnCours, "", "", "", "", "", "", "moins de 5 stagiaires en formation"];
    return [nom, c.promosEnCours, ...chiffres(c), ""];
  };
  const centres = (vue && vue.centres) || [];
  const lignes = centres.map((c) => ligne(c.lieuNom, c));
  const actifs = centres.filter((c) => !c.masque && c.promosEnCours > 0);
  lignes.push(["Total du réseau", actifs.reduce((a, c) => a + c.promosEnCours, 0), ...chiffres(vue.total),
    "hors centres de moins de 5 stagiaires en formation"]);
  if (vue.demonstration) lignes.push(ligne("Centre de démonstration (données fictives, hors totaux)", vue.demonstration));
  return fichier(entete, lignes);
}
