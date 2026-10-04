// Statistiques de groupe de la page Notes (moyennes, médianes, répartition).
//
// Deux sources, une seule forme :
// - statsLocales() calcule depuis les notes chargées : réservé au personnel, qui lit toutes
//   les notes et doit voir ses saisies se refléter aussitôt ;
// - le serveur (RPC notes_stats_groupe) rend la même forme aux stagiaires, qui ne lisent plus
//   les notes des profils anonymes mais doivent voir des moyennes qui les comptent.
// Toute modification d'une définition ici se reporte dans la fonction SQL (migration
// 20261004_confidentialite_1_preparation), et inversement : tests/notes-stats.test.mjs.
//
// Forme : { n_lignes, n, somme, mediane, sous_10, repartition: [5 nombres],
//           themes: [{ num, n, somme, mediane }], competences: [{ code, n, somme }],
//           moy_stagiaire_max, moy_stagiaire_min }

// Bornes de la répartition (dernière borne > 20 pour inclure 20/20).
export const TRANCHES = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20.01]];

export function estNotee(e) {
  return e.note != null && !!e.note_max && Number(e.note_max) !== 0;
}

export function score20(e) {
  return (Number(e.note) / Number(e.note_max)) * 20;
}

export function mediane(valeurs) {
  if (valeurs.length === 0) return null;
  const v = valeurs.slice().sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// idsActifs : ensemble des stagiaires actifs (moyennes haute et basse).
export function statsLocales(evaluations, idsActifs) {
  const notees = evaluations.filter(estNotee);
  const scores = notees.map(score20);
  const parTheme = new Map();
  const parCompetence = new Map();
  const parStagiaire = new Map();
  notees.forEach((e, i) => {
    const s = scores[i];
    if (e.type === "Thème" && e.theme_numero != null) {
      if (!parTheme.has(e.theme_numero)) parTheme.set(e.theme_numero, []);
      parTheme.get(e.theme_numero).push(s);
    }
    if (e.type === "Compétence" && e.competence_code != null) {
      if (!parCompetence.has(e.competence_code)) parCompetence.set(e.competence_code, []);
      parCompetence.get(e.competence_code).push(s);
    }
    if (idsActifs.has(e.stagiaire_id)) {
      if (!parStagiaire.has(e.stagiaire_id)) parStagiaire.set(e.stagiaire_id, []);
      parStagiaire.get(e.stagiaire_id).push(s);
    }
  });
  const somme = (l) => l.reduce((a, b) => a + b, 0);
  const moyennes = [...parStagiaire.values()].map((l) => somme(l) / l.length);
  return {
    n_lignes: evaluations.length,
    n: scores.length,
    somme: somme(scores),
    mediane: mediane(scores),
    sous_10: scores.filter((s) => s < 10).length,
    repartition: TRANCHES.map(([min, max]) => scores.filter((s) => s >= min && s < max).length),
    themes: [...parTheme.entries()].sort((a, b) => a[0] - b[0])
      .map(([num, l]) => ({ num, n: l.length, somme: somme(l), mediane: mediane(l) })),
    competences: [...parCompetence.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([code, l]) => ({ code, n: l.length, somme: somme(l) })),
    moy_stagiaire_max: moyennes.length ? Math.max(...moyennes) : null,
    moy_stagiaire_min: moyennes.length ? Math.min(...moyennes) : null,
  };
}

// Réponse du serveur → forme ci-dessus (les nombres JSON de PostgreSQL arrivent déjà en
// nombres ; on protège seulement les champs absents).
export function statsServeur(json) {
  const j = json || {};
  const num = (x) => (x == null ? null : Number(x));
  return {
    n_lignes: Number(j.n_lignes || 0),
    n: Number(j.n || 0),
    somme: Number(j.somme || 0),
    mediane: num(j.mediane),
    sous_10: Number(j.sous_10 || 0),
    repartition: Array.isArray(j.repartition) ? j.repartition.map(Number) : TRANCHES.map(() => 0),
    themes: (j.themes || []).map((t) => ({ num: Number(t.num), n: Number(t.n), somme: Number(t.somme), mediane: num(t.mediane) })),
    competences: (j.competences || []).map((c) => ({ code: c.code, n: Number(c.n), somme: Number(c.somme) })),
    moy_stagiaire_max: num(j.moy_stagiaire_max),
    moy_stagiaire_min: num(j.moy_stagiaire_min),
  };
}

export function moyenneGenerale(stats) {
  return stats.n ? stats.somme / stats.n : null;
}

export function moyenneCompetence(stats, code) {
  const c = stats.competences.find((x) => x.code === code);
  return c && c.n ? c.somme / c.n : null;
}

// Plusieurs thèmes regroupés en une colonne : moyenne de toutes leurs notes.
export function moyenneThemes(stats, nums) {
  let n = 0, s = 0;
  stats.themes.forEach((t) => { if (nums.includes(t.num)) { n += t.n; s += t.somme; } });
  return n ? s / n : null;
}

// Moyenne classe par thème officiel : [{ num, titre, avg, med, count }].
export function statsParTheme(stats, themesOfficiels) {
  const out = [];
  themesOfficiels.forEach((th) => {
    if (th.numero == null) return;
    const t = stats.themes.find((x) => x.num === th.numero);
    if (!t || !t.n) return;
    out.push({ num: th.numero, titre: th.titre, avg: t.somme / t.n, med: t.mediane, count: t.n });
  });
  return out;
}
