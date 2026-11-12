// Règles PURES de l'Ordre de passage (Planning), spec docs/superpowers/specs/2026-11-11-ordre-passage-resultats-design.md.
// Module sans DOM ni réseau, testé en node (tests/ordre-passage-rules.test.mjs).
// Comptage : la règle d'équité du placement (compteDansEquite) : Effectué et Absence comptent, Bonus et Report non.
import { compteDansEquite } from "./passage-rules.js?v=20261112e";
import { rolesPourEntry } from "./creneaux-rules.js?v=20261112e";

export const TYPES = ["Salle", "Voiture"];

// rows : lignes de la table passages. Retourne { [stagiaire_id]: { Salle, Voiture } }.
export function compteurs(rows) {
  const out = {};
  (rows || []).forEach((p) => {
    if (!TYPES.includes(p.type) || !compteDansEquite(p.resultat)) return;
    const c = out[p.stagiaire_id] || (out[p.stagiaire_id] = { Salle: 0, Voiture: 0 });
    c[p.type]++;
  });
  return out;
}

// Passages placés dans le planning d'une semaine : { [stagiaire_id]: { Salle?: day_index, Voiture?: day_index } }, le premier
// jour où la personne passe (au tableau, au volant). Être élève dans la salle ne compte pas ; joursOff : day_index désactivés
// ou fériés.
export function placesDeLaSemaine(entries, joursOff) {
  const out = {};
  const ids = new Set();
  (entries || []).forEach((e) => {
    [e.pedagogue_id, e.pedagogue_id_2, ...(e.eleves_ids || []), ...(e.eleves_ids_2 || [])]
      .forEach((id) => { if (id != null) ids.add(id); });
  });
  (entries || []).forEach((e) => {
    if (joursOff && joursOff.has(e.day_index)) return;
    ids.forEach((id) => {
      rolesPourEntry(e, id).forEach((r) => {
        if (r.role !== "passage") return;
        const p = out[id] || (out[id] = {});
        if (p[r.type] == null || e.day_index < p[r.type]) p[r.type] = e.day_index;
      });
    });
  });
  return out;
}

function compareNom(a, b) {
  return String(a.nom || "").localeCompare(String(b.nom || ""), "fr")
    || String(a.prenom || "").localeCompare(String(b.prenom || ""), "fr");
}

// stagiaires : actifs (listStagiaires). places : placesDeLaSemaine (facultatif).
// Retourne { objectif, parId, files: { Salle, Voiture }, aJour, resume: { aPlacer, dejaPlaces, aJour } }.
export function ordreDePassage(stagiaires, rows, places = {}) {
  const list = stagiaires || [];
  const c = compteurs(rows);
  const n = list.length;
  const objectif = {};
  TYPES.forEach((t) => {
    const somme = list.reduce((s, st) => s + (c[st.id]?.[t] || 0), 0);
    objectif[t] = n ? Math.round(somme / n) : 0;
  });
  const parId = {};
  const files = { Salle: [], Voiture: [] };
  const aJour = [];
  const resume = { aPlacer: 0, dejaPlaces: 0, aJour: 0 };
  list.forEach((s) => {
    const compte = { Salle: c[s.id]?.Salle || 0, Voiture: c[s.id]?.Voiture || 0 };
    const retard = {};
    TYPES.forEach((t) => { retard[t] = Math.max(0, objectif[t] - compte[t]); });
    parId[s.id] = { compte, retard };
    const enRetard = TYPES.filter((t) => retard[t] > 0);
    enRetard.forEach((t) => files[t].push({ id: s.id, s, retard: retard[t], placeLe: places[s.id]?.[t] ?? null }));
    if (!enRetard.length) { aJour.push(s); resume.aJour++; }
    else if (enRetard.every((t) => places[s.id]?.[t] != null)) resume.dejaPlaces++;
    else resume.aPlacer++;
  });
  const tri = (a, b) => b.retard - a.retard || (a.s.ordre ?? 0) - (b.s.ordre ?? 0) || compareNom(a.s, b.s);
  TYPES.forEach((t) => files[t].sort(tri));
  aJour.sort(compareNom);
  return { objectif, parId, files, aJour, resume };
}

// La phrase de la carte « Mes passages » (tutoiement : seul le stagiaire la lit).
export function maSituation(retard) {
  const en = [];
  if (retard?.Salle > 0) en.push("en salle");
  if (retard?.Voiture > 0) en.push("en voiture");
  if (!en.length) return "Tu es à jour partout.";
  return "Tu passes en priorité " + en.join(" et ") + ".";
}
