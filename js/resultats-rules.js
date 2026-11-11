// Règles PURES de Mon suivi > Résultats (vue « Moi »), spec docs/superpowers/specs/2026-11-11-ordre-passage-resultats-design.md.
// Module sans DOM ni réseau, testé en node (tests/resultats-rules.test.mjs).

// Seuil d'anonymat de la moyenne du groupe (le même que l'EPCF, js/epcf-classe-rules.js) : en dessous de 3 stagiaires
// actifs, une moyenne laisserait deviner la note d'un camarade.
export const SEUIL_GROUPE = 3;
const SUJET_INCONNU = "Évaluation";
const JOURS_TENDANCE = 30;

// Les notes renseignées, ramenées sur 20 (champ `norm`), triées par date puis id.
export function notesSur20(evals) {
  return (evals || [])
    .filter((e) => e.note != null && e.note_max && Number(e.note_max) !== 0)
    .map((e) => ({ ...e, norm: (Number(e.note) / Number(e.note_max)) * 20 }))
    .sort((a, b) => String(a.date_eval || "").localeCompare(String(b.date_eval || "")) || (a.id - b.id));
}

export function moyenne(notes) {
  if (!notes || !notes.length) return null;
  return notes.reduce((s, e) => s + e.norm, 0) / notes.length;
}

function arrondi1(v) { return Math.round(v * 10) / 10; }

// Écart, arrondi au dixième, entre la moyenne d'aujourd'hui et celle des notes datées de plus de 30 jours ; null sans
// note assez ancienne.
export function tendance(notes, aujourdhuiIso) {
  const limite = new Date(aujourdhuiIso + "T00:00:00Z");
  limite.setUTCDate(limite.getUTCDate() - JOURS_TENDANCE);
  const lim = limite.toISOString().slice(0, 10);
  const anciennes = (notes || []).filter((e) => e.date_eval && String(e.date_eval) < lim);
  if (!anciennes.length) return null;
  return arrondi1(moyenne(notes) - moyenne(anciennes));
}

// Moyenne par sujet (libelle(e)), puis les trois meilleurs et les trois plus bas, sans doublon ; avec moins de 6 sujets,
// la moitié haute et la moitié basse ; rien avec moins de 2 sujets.
export function forcesEtFaiblesses(notes, libelle) {
  const groupes = new Map();
  (notes || []).forEach((e) => {
    const lib = libelle(e);
    if (!lib || lib === SUJET_INCONNU) return;
    const g = groupes.get(lib) || { lib, somme: 0, n: 0 };
    g.somme += e.norm; g.n++;
    groupes.set(lib, g);
  });
  const sujets = [...groupes.values()].map((g) => ({ lib: g.lib, moyenne: arrondi1(g.somme / g.n), n: g.n }));
  if (sujets.length < 2) return { forts: [], faibles: [] };
  const k = Math.min(3, Math.floor(sujets.length / 2));
  const parNote = (a, b) => b.moyenne - a.moyenne || a.lib.localeCompare(b.lib, "fr");
  const tries = sujets.slice().sort(parNote);
  return { forts: tries.slice(0, k), faibles: tries.slice(-k).reverse() };
}

// stats : retour de notes_stats_groupe ({ n, somme }) ; effectif : stagiaires actifs de la promo.
export function moyenneDuGroupe(stats, effectif) {
  if (!stats || !stats.n || effectif < SEUIL_GROUPE) return null;
  return Number(stats.somme) / Number(stats.n);
}

// 17.36 -> "17,4" ; 15 -> "15".
export function formatNote(v) {
  return String(arrondi1(v)).replace(".", ",");
}
