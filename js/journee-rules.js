// La journée et la semaine du planning, lues d'un seul endroit : règles PURES (testables en
// node, sans DOM ni base). Les pages Accueil, Aujourd'hui et la grille de la semaine ne
// recalculent rien : elles reçoivent ces cartes toutes lues (rôles effectifs, absences,
// horaires, repos). Ni heure ni lieu par carte : la base n'en a pas.
import { effPedagogueId, effElevesIds, effBenevolesIds, effSujets, entryHasContent, sujetsDe } from "./planning-roles.js?v=20261111d";
import { rolesPourEntry } from "./creneaux-rules.js?v=20261111d";
import { jourFerie } from "./emargement-rules.js?v=20261111d";

// Défauts horaires quand aucune ligne de planning_half_meta n'existe (déplacés de planning.js).
export const DEFAULT_HALF_META = {
  matin: { start_time: "09:00", end_time: "12:30", pause_start: "10:45", pause_minutes: 20 },
  aprem: { start_time: "13:30", end_time: "17:00", pause_start: "15:15", pause_minutes: 20 },
};

const DEMIS = [
  { demi: "matin", titre: "Matin" },
  { demi: "aprem", titre: "Après-midi" },
];

const JOURS_LONGS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
  "septembre", "octobre", "novembre", "décembre"];

const GENRES = {
  "Pédagogie salle": "salle",
  "Voiture (conduite)": "voiture",
  "Cours": "cours",
  "Contrôle": "controle",
};
const TITRES = {
  salle: "Salle", voiture: "Voiture", cours: "Cours", controle: "Contrôle",
  autonomie: "Autonomie", autre: "Autre",
};

// === Dates : tout passe par l'UTC, pour qu'un changement d'heure ne décale jamais un jour ===

function utc(iso) {
  const [a, m, j] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}
function enIso(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function plusJours(iso, n) {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return enIso(d);
}
// 0 = lundi ... 6 = dimanche
function indexDuJour(iso) {
  return (utc(iso).getUTCDay() + 6) % 7;
}
// Date locale (celle de l'utilisateur) ou chaîne "AAAA-MM-JJ" -> "AAAA-MM-JJ".
function versIso(v) {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  return String(v).slice(0, 10);
}

// Le lundi de la semaine à afficher : celui de la semaine en cours, et le lundi SUIVANT un
// samedi ou un dimanche (la semaine est finie, on prépare la suivante).
export function lundiEnCours(aujourdhui) {
  const iso = versIso(aujourdhui);
  const i = indexDuJour(iso);
  return i >= 5 ? plusJours(iso, 7 - i) : plusJours(iso, -i);
}

// === Horaires ===

function heureLisible(t) {
  const [h, m] = String(t).split(":");
  const minutes = Number(m || 0);
  return minutes ? `${Number(h)} h ${String(minutes).padStart(2, "0")}` : `${Number(h)} h`;
}

function horaireDe(metas, dayIndex, demi) {
  const m = (metas || []).find((x) => x.day_index === dayIndex && x.half_day === demi);
  const defaut = DEFAULT_HALF_META[demi];
  const debut = (m && m.start_time) || defaut.start_time;
  const fin = (m && m.end_time) || defaut.end_time;
  return `${heureLisible(debut)} à ${heureLisible(fin)}`;
}

// === Repos ===

// « Samedi », « Dimanche », libellé du jour off (manuel d'abord, comme le planning) ou nom du férié.
function reposDe(iso, joursOff) {
  const i = indexDuJour(iso);
  if (i === 5) return "Samedi";
  if (i === 6) return "Dimanche";
  const manuel = (joursOff || []).find((j) => j.day_index === i);
  if (manuel) return manuel.label || "Désactivé";
  return jourFerie(iso);
}

// === Une carte ===

// Absences (spec 2026-07-19) : `sid` reste dans son champ de rôle, `rid` le remplace. Pour la
// lecture, un absent remplacé cède sa place à `rid`, un absent sans remplaçant disparaît.
function sansAbsents(ids, absences) {
  const out = [];
  for (const id of ids || []) {
    const a = absences.find((x) => x && x.sid === id);
    const effectif = a ? a.rid : id;
    if (effectif != null && !out.includes(effectif)) out.push(effectif);
  }
  return out;
}

function cartePresente(e) {
  const absences = Array.isArray(e.absences) ? e.absences : [];
  const un = (id) => (id == null ? null : (sansAbsents([id], absences)[0] ?? null));
  return {
    ...e,
    pedagogue_id: un(e.pedagogue_id),
    pedagogue_id_2: un(e.pedagogue_id_2),
    eleves_ids: sansAbsents(e.eleves_ids, absences),
    eleves_ids_2: sansAbsents(e.eleves_ids_2, absences),
  };
}

// `prof_ids` se normalise comme dans loadPlanning : prof_ids, sinon [prof_id] ; `prof_autre`
// est un nom libre ajouté à la suite.
function profsDe(e, noms) {
  let ids = e.prof_ids;
  if ((!ids || ids.length === 0) && e.prof_id) ids = [e.prof_id];
  const out = (ids || []).map((id) => noms.formateurs?.get(id)).filter(Boolean);
  if (e.prof_autre) out.push(e.prof_autre);
  return out;
}

const TEXTE_MOI = {
  tableau: "Tu passes au tableau",
  voiture: "Tu conduis",
  eleve: "En salle",
};

// Le rôle de la personne sur la carte, tel que le lisent les rôles du suivi (rolesPourEntry) ;
// calculé sur la carte AVEC les remplacements : l'absent n'a plus de rôle, son remplaçant le reprend.
function moiSur(present, moi) {
  if (moi == null) return null;
  const roles = rolesPourEntry(present, moi);
  if (!roles.length) return null;
  const choisi = roles.find((r) => r.role === "passage") || roles[0];
  const role = choisi.role === "eleve" ? "eleve" : (choisi.type === "Voiture" ? "voiture" : "tableau");
  return { role, texte: TEXTE_MOI[role] };
}

function carteJour(e, noms, moi) {
  const present = cartePresente(e);
  const genre = e.autonomie ? "autonomie" : (GENRES[e.activite] || "autre");
  const nomStagiaire = (id) => ({ id, nom: noms.stagiaires?.get(id) ?? "" });
  const tableau = [];
  const g1 = effPedagogueId(present, 1);
  const g2 = effPedagogueId(present, 2);
  if (g1 != null) tableau.push({ ...nomStagiaire(g1), groupe: 1 });
  if (g2 != null) tableau.push({ ...nomStagiaire(g2), groupe: 2 });
  const ids = [...effElevesIds(present, 1), ...effElevesIds(present, 2)]
    .filter((id, i, a) => a.indexOf(id) === i);
  const titres = noms.titres || [];
  const voiture = e.activite === "Voiture (conduite)";
  // Salle double de pédagogie : le sujet de chaque groupe (`sujet` pour le groupe 1, `sujet_2` pour le groupe 2), pour
  // qu'« Au tableau » dise à chaque pédagogue son propre sujet ; null ailleurs, où `sujets` suffit.
  const parGroupe = e.activite === "Pédagogie salle" && e.salle_double && effSujets(e).length
    ? { 1: sujetsDe(e.sujet, titres), 2: sujetsDe(e.sujet_2, titres) }
    : null;
  return {
    id: e.id ?? `${e.day_index}-${e.half_day}-${e.slot ?? 0}-${e.lane ?? 0}`,
    genre,
    titre: TITRES[genre],
    sujets: effSujets(e).flatMap((v) => sujetsDe(v, titres)),
    sujetsParGroupe: parGroupe,
    formateurs: profsDe(e, noms),
    tableau,
    eleves: voiture ? [] : ids.map(nomStagiaire),
    conducteurs: voiture ? ids.map(nomStagiaire) : [],
    benevoles: effBenevolesIds(e).map((id) => noms.benevoles?.get(id)).filter(Boolean),
    notes: e.notes && String(e.notes).trim() ? String(e.notes).trim() : "",
    moi: moiSur(present, moi),
  };
}

// === La journée ===

export function journeeDuJour({ entries, metas, joursOff, jour, moi, noms }) {
  const repos = reposDe(jour, joursOff);
  if (repos) return { repos, demis: [] };
  const index = indexDuJour(jour);
  const demis = DEMIS.map(({ demi, titre }) => {
    const cartes = (entries || [])
      .filter((e) => e.day_index === index && e.half_day === demi && entryHasContent(e))
      .sort((a, b) => ((a.slot ?? 0) - (b.slot ?? 0)) || ((a.lane ?? 0) - (b.lane ?? 0)))
      .map((e) => carteJour(e, noms, moi));
    return { demi, titre, horaire: horaireDe(metas, index, demi), cartes };
  });
  return { repos: null, demis };
}

// === La semaine ===

export function semaineEnGrille({ entries, metas, joursOff, lundi, moi, noms, aujourdhui }) {
  const auj = aujourdhui == null ? null : versIso(aujourdhui);
  return [0, 1, 2, 3, 4].map((index) => {
    const iso = plusJours(lundi, index);
    const d = utc(iso);
    const numero = d.getUTCDate();
    const { repos, demis } = journeeDuJour({ entries, metas, joursOff, jour: iso, moi, noms });
    return {
      index,
      iso,
      court: JOURS_COURTS[index],
      long: `${JOURS_LONGS[index]} ${numero === 1 ? "1er" : numero} ${MOIS[d.getUTCMonth()]}`,
      numero,
      aujourdhui: iso === auj,
      repos,
      demis,
    };
  });
}

// L'index du jour affiché d'abord sur téléphone : aujourd'hui s'il est dans la semaine, sinon lundi.
export function jourParDefaut(jours, aujourdhui) {
  const auj = aujourdhui == null ? null : versIso(aujourdhui);
  const trouve = (jours || []).find((j) => j.iso === auj);
  return trouve ? trouve.index : 0;
}

// L'alerte d'une carte de la semaine : une voiture sans stagiaire au volant (tous absents, personne en remplacement) ne
// doit pas passer pour une voiture ordinaire dans la grille (audit du 09/11, A9). null sinon.
export function alerteDeCarte(c) {
  if (c && c.genre === "voiture" && Array.isArray(c.conducteurs) && c.conducteurs.length === 0) return "Aucun stagiaire en voiture";
  return null;
}

// Étiquette du rôle de la personne dans une case de la grille.
export function etiquetteSemaine(moi) {
  if (!moi) return null;
  if (moi.role === "tableau") return "Toi au tableau";
  if (moi.role === "voiture") return "Toi en voiture";
  return "Toi en salle";
}

// La forme du planning à l'ouverture, d'après ce que l'appareil a mémorisé (`planning.vue`) : la
// grille, sauf si la liste a été choisie. Une valeur inconnue ou abîmée ne bloque rien.
export function vuePlanningInitiale(valeurMemorisee) {
  return valeurMemorisee === "liste" ? "liste" : "grille";
}
