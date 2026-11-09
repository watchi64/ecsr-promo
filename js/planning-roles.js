// Rôles EFFECTIFS d'une carte du planning, fonctions PURES (testables en node, sans DOM).
// Déplacées de js/views/planning.js sans changer leur corps : le planning, l'impression et la
// lecture de la journée et de la semaine (js/journee-rules.js) lisent ainsi la même vérité.
import { ACTIVITY_SHAPES } from "./config.js?v=20261109c";

// Rôles EFFECTIFS d'un créneau selon la FORME de son activité (ACTIVITY_SHAPES).
// Quand on change l'activité d'un créneau, la donnée des rôles (tableau/élèves) reste
// stockée (pratique si on rebascule l'activité), mais un rôle absent de la forme courante
// (ex. élèves restés sur un Cours, ou « au tableau » resté sur une Voiture) ne doit JAMAIS
// être affiché ni utilisé. Source unique de vérité, utilisée par l'impression et le blocage
// de créneau (la validation et les compteurs filtrent déjà par activité).
export function entryShape(e) { return ACTIVITY_SHAPES[e.activite || ""] || ACTIVITY_SHAPES[""]; }
export function effPedagogueId(e, group = 1) {
  if (!entryShape(e).includes("pedagogue")) return null;
  if (group === 2) return e.salle_double ? (e.pedagogue_id_2 ?? null) : null;
  return e.pedagogue_id ?? null;
}
export function effElevesIds(e, group = 1) {
  if (!entryShape(e).includes("eleves")) return [];
  if (group === 2) return e.salle_double ? (e.eleves_ids_2 || []) : [];
  return e.eleves_ids || [];
}
export function effBenevolesIds(e) {
  if (!entryShape(e).includes("benevoles")) return [];
  return e.benevoles_ids || [];
}
// Sujets EFFECTIFS d'un créneau : `sujet` (groupe 1 / unique) + `sujet_2` (groupe 2,
// cartes salle 2 groupes seulement). Comme les rôles, `sujet_2` est conservé en base
// mais ignoré dès que la carte n'est plus une salle double.
export function effSujets(e) {
  if (!entryShape(e).includes("sujet")) return [];
  const out = [];
  if (e.sujet && String(e.sujet).trim()) out.push(e.sujet);
  if (e.activite === "Pédagogie salle" && e.salle_double && e.sujet_2 && String(e.sujet_2).trim()) out.push(e.sujet_2);
  return out;
}

function nonEmpty(v) {
  return v != null && String(v).trim() !== "";
}

export function entryHasContent(e) {
  const hasPed = effPedagogueId(e, 1) != null || effPedagogueId(e, 2) != null;
  const hasEl = effElevesIds(e, 1).length > 0 || effElevesIds(e, 2).length > 0;
  return nonEmpty(e.activite) || effSujets(e).length > 0 || nonEmpty(e.notes)
      || (e.prof_ids && e.prof_ids.length) || e.prof_id
      || hasPed || hasEl || effBenevolesIds(e).length > 0;
}

// Sujet multi-thèmes stocké en base comme chaîne "Thème A, Thème B".
// ⚠️ Certains titres de thèmes contiennent des virgules (ex. 03 « Stationnement, arrêt,
// immobilisation ») : un split naïf sur "," les découpe en plusieurs chips. On recolle donc
// les fragments consécutifs qui reforment le titre d'un thème CONNU (greedy, le plus long
// d'abord). Le texte libre à virgules reste découpé (impossible à désambiguïser).
// `titresConnus` : tableau ou Set de titres de thèmes.
export function sujetsDe(val, titresConnus) {
  if (!val) return [];
  const parts = String(val).split(",").map((s) => s.trim()).filter(Boolean);
  const known = new Set(titresConnus || []);
  const out = [];
  let i = 0;
  while (i < parts.length) {
    let merged = false;
    for (let j = parts.length; j > i + 1; j--) {
      const candidate = parts.slice(i, j).join(", ");
      if (known.has(candidate)) { out.push(candidate); i = j; merged = true; break; }
    }
    if (!merged) { out.push(parts[i]); i++; }
  }
  return out;
}

// Colonnes des activités parallèles d'une demi-journée, à l'écran : chaque créneau (`rows`, [{ lanes: [entrée] }]) range
// ses entrées par voie (`lane`, persistée), puis les numérote 0, 1, 2… sans les trous ; la demi-journée a autant de
// colonnes que son créneau le plus chargé. Une voie peut avoir un trou (activité parallèle supprimée) : avant ce rang,
// une carte seule en voie 3 n'occupait qu'un quart de la largeur en mode Modifier, titre coupé (audit du 09/11, B1).
// Rend { colonnes, rangs } : `rangs[i][k]`, la colonne (à partir de 0) de la k-ième entrée du créneau i, dans son ordre.
export function colonnesParalleles(rows) {
  const liste = Array.isArray(rows) ? rows : [];
  const rangs = liste.map((r) => {
    const lanes = Array.isArray(r.lanes) ? r.lanes : [];
    const ordre = lanes.map((e, k) => ({ k, voie: (e && e.lane) ?? 0 })).sort((a, b) => a.voie - b.voie || a.k - b.k);
    const rang = new Array(lanes.length);
    ordre.forEach((o, i) => { rang[o.k] = i; });
    return rang;
  });
  return { colonnes: Math.max(1, ...rangs.map((r) => r.length)), rangs };
}
