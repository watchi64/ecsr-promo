/*
 * Multi-promo : règles pures, sans réseau ni DOM (spec
 * docs/superpowers/specs/2026-10-01-multi-promo-design.md), testées par
 * `node tests/promo-rules.test.mjs`. L'autorité reste la base : ces fonctions décident
 * seulement de ce que l'app envoie (l'en-tête de promo) et de la façon dont elle
 * présente ce que la base renvoie.
 */

export const ENTETE_PROMO = "x-promo-id";

// L'en-tête ne part que vers l'API de données (tables et RPC). Les fonctions Edge le
// refusent en CORS ; l'authentification et le stockage n'en ont pas l'usage. Les adresses sont
// analysées, non comparées comme du texte : une barre finale dans la configuration, un hôte en
// capitales ou le port par défaut ne doivent pas couper l'en-tête sans erreur, et un chemin
// remonté (..) ne doit pas l'envoyer vers une autre API. Adresse relative ou illisible : faux.
export function doitPorterEntetePromo(url, supabaseUrl) {
  if (typeof url !== "string" || !supabaseUrl) return false;
  try {
    const cible = new URL(url);
    const base = new URL(supabaseUrl);
    return cible.origin === base.origin
      && cible.pathname.startsWith(base.pathname.replace(/\/+$/, "") + "/rest/v1/");
  } catch (e) {
    return false;
  }
}

// Promo de départ : celle mémorisée sur l'appareil si elle est toujours accessible,
// sinon celle que la base marque par défaut, sinon la première de la liste.
export function choisirPromoInitiale(promos, memorisee) {
  if (!Array.isArray(promos) || promos.length === 0) return null;
  const voulue = Number(memorisee);
  if (memorisee != null && memorisee !== "" && Number.isInteger(voulue)
      && promos.some((p) => p.id === voulue)) {
    return voulue;
  }
  return (promos.find((p) => p.par_defaut) || promos[0]).id;
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// « sept. 2026 » ; précédé du lieu (« Nîmes · sept. 2026 ») dès que les promos
// accessibles couvrent plusieurs lieux, sinon deux promos du même mois se confondraient.
export function libelleCourtPromo(promo, promos = []) {
  if (!promo) return "";
  const [annee, mois] = String(promo.date_debut || "").split("-");
  const base = [MOIS_COURTS[Number(mois) - 1], annee].filter(Boolean).join(" ");
  const lieux = new Set((promos || []).map((p) => p.lieu_id));
  return lieux.size > 1 && promo.lieu_nom ? `${promo.lieu_nom} · ${base}` : base;
}

// Profil dans la promo courante : l'identité stagiaire vient de la promo (mes_promos),
// et un compte de rôle stagiaire sans fiche dans cette promo (cas du fondateur) y est un
// admin pur. Sans promo connue, le profil reste brut.
export function profilEffectif(profil, promo) {
  if (!profil) return null;
  if (!promo) return profil;
  const stagiaire_id = promo.stagiaire_id ?? null;
  const role = profil.role === "stagiaire" && stagiaire_id == null ? "admin" : profil.role;
  return { ...profil, stagiaire_id, role };
}

export const CHAMPS_PROGRESSION = ["statut", "date_fait", "date_qcm", "notes", "updated_by_email"];

const DEFAUTS_EXAMEN = {
  published: false,
  published_by_email: null,
  published_at: null,
  exam_nb_questions: null,
  exam_question_ids: null,
  exam_draw_mode: null,
  exam_seconds_per_question: 30,
  exam_ferme_a: null,
};
export const CHAMPS_EXAMEN = Object.keys(DEFAUTS_EXAMEN);

// Sépare un patch : les champs listés (propres à la promo) et les autres (communs).
export function separerChamps(patch, champs) {
  const dans = {};
  const hors = {};
  for (const [cle, valeur] of Object.entries(patch || {})) {
    (champs.includes(cle) ? dans : hors)[cle] = valeur;
  }
  return { dans, hors };
}

// Thème lu avec sa progression embarquée (`progression` : la ligne de la promo courante,
// ou rien). Les anciennes colonnes du thème sont TOUJOURS écrasées : pendant la bascule
// elles portent encore les valeurs de mars, qui ne doivent jamais apparaître ailleurs.
export function fusionnerProgression(theme) {
  const { progression, ...referentiel } = theme || {};
  const p = (Array.isArray(progression) ? progression[0] : progression) || {};
  return {
    ...referentiel,
    statut: p.statut ?? "À faire",
    date_fait: p.date_fait ?? null,
    date_qcm: p.date_qcm ?? null,
    notes: p.notes ?? null,
    updated_by_email: p.updated_by_email ?? null,
  };
}

// QCM lu avec l'état d'examen de la promo courante embarqué (`examen`). Même règle :
// les anciennes colonnes d'examen sont écrasées ; sans état dans la promo, l'examen est fermé.
export function fusionnerExamen(qcm) {
  const { examen, ...banque } = qcm || {};
  const e = (Array.isArray(examen) ? examen[0] : examen) || {};
  const sortie = { ...banque };
  for (const [cle, defaut] of Object.entries(DEFAUTS_EXAMEN)) sortie[cle] = e[cle] ?? defaut;
  return sortie;
}
