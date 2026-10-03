import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=20261003b";
import { compteDansEquite } from "./passage-rules.js?v=20261003b";
import {
  ENTETE_PROMO, doitPorterEntetePromo, choisirPromoInitiale, profilEffectif,
  separerChamps, CHAMPS_PROGRESSION, CHAMPS_EXAMEN, fusionnerProgression, fusionnerExamen,
} from "./promo-rules.js?v=20261003b";

// Contexte de promo (spec multi-promo, C.1). La promo courante voyage dans l'en-tête
// x-promo-id de chaque requête de données ; la base vérifie le droit et filtre.
let mesPromos = [];          // lignes renvoyées par la RPC mes_promos()
let promoCouranteId = null;  // nulle tant que le contexte n'est pas chargé : pas d'en-tête
let cleMemoire = null;       // clé localStorage propre au compte
let compteContexte = null;   // compte (email en minuscules) auquel appartient le contexte
let epoque = 0;              // incrémentée à la déconnexion : un chargement en vol devient caduc
let basculeEnCours = false;  // une seule bascule à la fois (double appui, deux choix rapides)
let requetesBloquees = false; // rechargement décidé : plus aucune requête de données ne part
const avantBascule = new Set();

// fetch avec timeout : sans ça, une requête peut rester pendue indéfiniment
// (réseau mobile instable) → "Chargement" infini. Avec, elle échoue proprement après 15s.
function fetchWithTimeout(input, init = {}) {
  const url = typeof input === "string" ? input : String(input?.url ?? input);
  // Rechargement décidé (bloquerRequetesJusquAuRechargement) : aucune requête de données ne part,
  // avec ou sans contexte de promo. Rejet immédiat, avant le minuteur et le réseau.
  if (requetesBloquees && doitPorterEntetePromo(url, SUPABASE_URL)) {
    return Promise.reject(new Error("Rechargement en cours"));
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  // Si un signal externe existe déjà (rare), on le respecte aussi
  const externalSignal = init.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  // En-tête de promo : seulement vers l'API de données (cf. promo-rules.js).
  let options = init;
  if (promoCouranteId != null && doitPorterEntetePromo(url, SUPABASE_URL)) {
    // Un Request garde ses propres en-têtes (apikey, Authorization) s'il n'y en a pas dans init.
    const entetes = new Headers(init.headers
      || (typeof Request !== "undefined" && input instanceof Request ? input.headers : {}));
    entetes.set(ENTETE_PROMO, String(promoCouranteId));
    options = { ...init, headers: entetes };
  }
  return fetch(input, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,         // garde la session dans localStorage
    autoRefreshToken: true,       // renouvelle le token automatiquement
    detectSessionInUrl: true,     // reliquat magic link (retiré) : inoffensif, conservé par prudence
    storage: window.localStorage, // explicite : pas de sessionStorage volatile
    storageKey: "ecsr_supabase_session",
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

// === Cache mémoire des données de référence (changent quasi jamais) ===
// Évite de re-télécharger stagiaires/profs/thèmes/compétences à chaque navigation.
// Invalidé explicitement lors des écritures sur ces tables.
const _cache = new Map();
const _cacheExpiry = new Map();
const CACHE_TTL = 10 * 60 * 1000;  // 10 min de sécurité (en plus de l'invalidation sur write)

async function cachedQuery(key, fetcher) {
  const now = Date.now();
  if (_cache.has(key) && (_cacheExpiry.get(key) || 0) > now) {
    return _cache.get(key);
  }
  const data = await fetcher();
  _cache.set(key, data);
  _cacheExpiry.set(key, now + CACHE_TTL);
  return data;
}

export function invalidateCache(key) {
  if (key) { _cache.delete(key); _cacheExpiry.delete(key); }
  else { _cache.clear(); _cacheExpiry.clear(); }
}

// === Contexte de promo ===

// Charge les promos accessibles et fixe la promo courante : celle mémorisée sur cet
// appareil si elle est toujours accessible, sinon celle par défaut. Appelée à chaque
// événement d'authentification : la promo en cours est CONSERVÉE tant qu'elle reste
// accessible (un renouvellement de jeton ne doit jamais faire changer de promo, ni
// envoyer une requête sans en-tête pendant le rechargement de la liste). Renvoie la liste (vide si
// le compte n'a accès à aucune promo), ou null si une déconnexion a croisé le chargement : rien
// n'est alors posé, et l'appelant n'a rien à faire (ni refus, ni message).
export async function chargerMesPromos(email) {
  const compte = email ? String(email).trim().toLowerCase() : null;
  // Autre compte que celui du contexte en mémoire (appareil partagé) : on repart de zéro,
  // sans rien hériter de la promo du compte précédent.
  if (compte !== compteContexte) {
    mesPromos = [];
    promoCouranteId = null;
    cleMemoire = null;
    compteContexte = compte;
    invalidateCache();
  }
  const monEpoque = epoque;
  const { data, error } = await supabase.rpc("mes_promos");
  if (error) throw error;
  if (monEpoque !== epoque) return null;  // déconnexion pendant le chargement : rien à poser
  cleMemoire = compte ? "ecsr_promo:" + compte : null;
  mesPromos = data || [];
  let memorisee = null;
  try { memorisee = cleMemoire ? localStorage.getItem(cleMemoire) : null; } catch (e) { /* navigation privée */ }
  const garder = mesPromos.some((p) => p.id === promoCouranteId) ? promoCouranteId : null;
  const nouvelle = garder ?? choisirPromoInitiale(mesPromos, memorisee);
  if (nouvelle !== promoCouranteId) invalidateCache();
  promoCouranteId = nouvelle;
  return mesPromos;
}

export function getMesPromos() { return mesPromos; }

export function getPromoCourante() {
  return mesPromos.find((p) => p.id === promoCouranteId) || null;
}

// Déconnexion : le contexte est oublié en mémoire (le choix mémorisé, propre au compte, reste).
export function oublierPromo() {
  epoque += 1;
  mesPromos = [];
  promoCouranteId = null;
  cleMemoire = null;
  compteContexte = null;
  invalidateCache();
}

// Un module qui a des écritures en vol (le planning) s'inscrit ici : la bascule les attend.
export function avantChangementPromo(fn) {
  avantBascule.add(fn);
  return () => avantBascule.delete(fn);
}

// Bascule : attendre les enregistrements en cours, mémoriser, recharger. Le rechargement
// vide aussi les caches et la pile Ctrl+Z, qui ne doit jamais rejouer une action d'une
// promo dans une autre.
export async function choisirPromo(id) {
  id = Number(id);  // la valeur d'un <select> arrive en chaîne
  if (basculeEnCours || id === promoCouranteId || !mesPromos.some((p) => p.id === id)) return;
  basculeEnCours = true;
  await attendreEnregistrements();
  try { if (cleMemoire) localStorage.setItem(cleMemoire, String(id)); } catch (e) { /* ignore */ }
  location.reload();
}

// Rechargement sûr (bandeau « Réessayer ») : mêmes attentes qu'une bascule, sans changer de promo.
export async function rechargerApresEnregistrements() {
  if (basculeEnCours) return;
  basculeEnCours = true;
  await attendreEnregistrements();
  location.reload();
}

// Rechargement décidé SANS attendre les enregistrements (js/auth-admin.js : retour d'un état
// dégradé, promo devenue inaccessible). Les vues affichées sont celles d'une autre promo que le
// contexte qui vient d'être posé : tout ce qui est encore en route (enregistrement différé du
// planning, annulation Ctrl+Z, relecture) partirait sous l'en-tête de la nouvelle promo avec du
// contenu de l'ancienne. Jusqu'au rechargement, plus aucune requête de données ne part ;
// l'authentification, les fonctions et le stockage ne sont pas concernés. Sans retour en arrière :
// la page va disparaître. choisirPromo et rechargerApresEnregistrements ne l'appellent PAS : elles
// attendent d'abord les enregistrements en cours, qui doivent partir.
export function bloquerRequetesJusquAuRechargement() {
  requetesBloquees = true;
}

async function attendreEnregistrements() {
  for (const attendre of avantBascule) {
    try { await attendre(); } catch (e) { console.error("bascule de promo : attente", e); }
  }
}

export async function renommerPromo(id, nom) {
  // Sans .select(), un refus par les règles d'accès répond « 0 ligne, sans erreur ».
  const { data, error } = await supabase.from("promos").update({ nom }).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Renommage refusé : promo introuvable ou droits insuffisants.");
  const promo = mesPromos.find((p) => p.id === id);
  if (promo) promo.nom = nom;
}

// === Stagiaires & Profs ===

// Par défaut, ne renvoie que les stagiaires actifs (les abandons sont masqués
// partout : planning, notes, passages, liste d'invitation). Passer
// { includeInactive: true } pour récupérer aussi les abandons (gestion admin).
export async function listStagiaires({ includeInactive = false } = {}) {
  const key = includeInactive ? "stagiaires_all" : "stagiaires";
  return cachedQuery(key, async () => {
    let q = supabase.from("stagiaires").select("*").order("ordre");
    if (!includeInactive) q = q.eq("actif", true);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  });
}

export async function listProfs() {
  return cachedQuery("profs", async () => {
    const { data, error } = await supabase
      .from("profs").select("*").order("ordre");
    if (error) throw error;
    return data;
  });
}

export async function addStagiaire(prenom, nom = null) {
  const { data: max } = await supabase
    .from("stagiaires")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1);
  const ordre = (max?.[0]?.ordre || 0) + 1;
  const { error } = await supabase.from("stagiaires").insert({ prenom, nom: nom || null, ordre });
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}

export async function updateStagiaire(id, prenom) {
  const { error } = await supabase.from("stagiaires").update({ prenom }).eq("id", id);
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}

// Nom de famille : sert à l'affichage « V. Timy » et au tri alphabétique.
export async function updateStagiaireNom(id, nom) {
  const { error } = await supabase.from("stagiaires").update({ nom: nom || null }).eq("id", id);
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}

export async function deleteStagiaire(id) {
  const { error } = await supabase.from("stagiaires").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}

// Désactivation douce (abandon) : la ligne reste en base (historique / stats futures)
// mais le stagiaire est masqué partout (planning, dés, notes, passages) car
// listStagiaires() ne renvoie que actif = true. actif=false => abandon, true => réactivé.
export async function setStagiaireActif(id, actif) {
  const { error } = await supabase.from("stagiaires").update({ actif }).eq("id", id);
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}

export async function addProf(nom) {
  const { data: max } = await supabase
    .from("profs")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1);
  const ordre = (max?.[0]?.ordre || 0) + 1;
  const { error } = await supabase.from("profs").insert({ nom, ordre });
  if (error) throw error;
  invalidateCache("profs");
}

export async function updateProf(id, nom) {
  const { error } = await supabase.from("profs").update({ nom }).eq("id", id);
  if (error) throw error;
  invalidateCache("profs");
}

export async function deleteProf(id) {
  const { error } = await supabase.from("profs").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("profs");
}

// === Passages ===

export async function listPassages(filters = {}) {
  let q = supabase.from("passages").select("*, stagiaire:stagiaires!stagiaire_id(prenom), remplacant:stagiaires!remplacant_id(prenom)").order("date", { ascending: false }).order("id", { ascending: false });
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  if (filters.type) q = q.eq("type", filters.type);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function addPassage(p) {
  const { data, error } = await supabase.from("passages").insert(p).select().single();
  if (error) throw error;
  return data;
}

export async function updatePassage(id, patch) {
  const { data, error } = await supabase.from("passages").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePassage(id) {
  const { error } = await supabase.from("passages").delete().eq("id", id);
  if (error) throw error;
}

// Insertion groupée de passages (validation d'une semaine de planning).
export async function addPassagesBatch(rows) {
  if (!rows || rows.length === 0) return [];
  const { data, error } = await supabase.from("passages").insert(rows).select();
  if (error) throw error;
  return data;
}

// Suppression groupée (pour annuler une validation via Ctrl+Z).
export async function deletePassagesBatch(ids) {
  if (!ids || ids.length === 0) return;
  const { error } = await supabase.from("passages").delete().in("id", ids);
  if (error) throw error;
}

// Passages existants sur une plage de dates : sert à dédoublonner la validation hebdo
// (un stagiaire déjà saisi, manuel ou auto, ne doit pas être recréé).
export async function getPassagesInRange(dateFrom, dateTo) {
  const { data, error } = await supabase
    .from("passages")
    .select("stagiaire_id, type, date")
    .gte("date", dateFrom)
    .lte("date", dateTo);
  if (error) throw error;
  return data;
}

// Stats agrégées par stagiaire (pour Dashboard)
export async function getStats() {
  const { data, error } = await supabase
    .from("passages")
    .select("stagiaire_id, type, resultat");
  if (error) throw error;
  const map = {};
  data.forEach((p) => {
    const key = p.stagiaire_id;
    if (!map[key]) map[key] = { Salle: {}, Voiture: {} };
    const r = p.resultat;
    map[key][p.type][r] = (map[key][p.type][r] || 0) + 1;
  });
  return map;
}

// === Planning ===

export async function getPlanning(semaine_lundi) {
  const { data, error } = await supabase
    .from("planning_entries")
    .select("*")
    .eq("semaine_lundi", semaine_lundi);
  if (error) throw error;
  return data;
}

export async function upsertPlanningEntry(entry) {
  // entry doit contenir semaine_lundi, day_index, half_day, slot, lane + champs
  if (entry.lane == null) entry.lane = 0;
  const { error } = await supabase
    .from("planning_entries")
    .upsert(entry, { onConflict: "promo_id,semaine_lundi,day_index,half_day,slot,lane" });
  if (error) throw error;
}

export async function deletePlanningEntryById(id) {
  const { error } = await supabase.from("planning_entries").delete().eq("id", id);
  if (error) throw error;
}

// === Planning half-day metadata (horaires + pause) ===

export async function getHalfMetaForWeek(semaine_lundi) {
  const { data, error } = await supabase
    .from("planning_half_meta")
    .select("*")
    .eq("semaine_lundi", semaine_lundi);
  if (error) throw error;
  return data;
}

export async function upsertHalfMeta(meta) {
  const { error } = await supabase
    .from("planning_half_meta")
    .upsert(meta, { onConflict: "promo_id,semaine_lundi,day_index,half_day" });
  if (error) throw error;
}

// === Jours désactivés / fériés (planning_jours_off) ===

export async function getJoursOff(semaine_lundi) {
  // Résilient : si la table n'existe pas encore (migration pas appliquée), on renvoie []
  // au lieu de casser le chargement du planning.
  try {
    const { data, error } = await supabase
      .from("planning_jours_off")
      .select("*")
      .eq("semaine_lundi", semaine_lundi);
    if (error) throw error;
    return data;
  } catch (e) {
    console.warn("getJoursOff indisponible (migration manquante ?)", e?.message || e);
    return [];
  }
}

export async function setJourOff(semaine_lundi, day_index, label, who) {
  const { error } = await supabase
    .from("planning_jours_off")
    .upsert({ semaine_lundi, day_index, label: label ?? null, created_by_who: who ?? null },
            { onConflict: "promo_id,semaine_lundi,day_index" });
  if (error) throw error;
}

export async function deleteJourOff(semaine_lundi, day_index) {
  const { error } = await supabase
    .from("planning_jours_off")
    .delete()
    .eq("semaine_lundi", semaine_lundi)
    .eq("day_index", day_index);
  if (error) throw error;
}

// === Settings ===

// Réglage de la promo courante (la base ne renvoie que ceux-là), ou null.
export async function getSetting(key) {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

// Réglage propre à la promo courante (promo_id posé par la base). Porte d'entrée unique
// des modules du chantier B : aucune autre écriture dans la table settings.
export async function setSetting(key, value) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "promo_id,key" });
  if (error) throw error;
}

// === Thèmes (57 + notions pédagogiques) ===

export async function listThemes() {
  return cachedQuery("themes", async () => {
    const { data, error } = await supabase
      .from("themes")
      .select("*, progression:themes_progression(statut, date_fait, date_qcm, notes, updated_by_email)")
      .order("type")    // theme avant notion
      .order("ordre");
    if (error) throw error;
    // La base ne renvoie que la progression de la promo courante ; « À faire » sinon.
    return (data || []).map(fusionnerProgression);
  });
}

// Progression de la promo courante (promo_id posé par la base).
async function ecrireProgression(themeId, champs) {
  const { error } = await supabase
    .from("themes_progression")
    .upsert({ theme_id: themeId, ...champs }, { onConflict: "promo_id,theme_id" });
  if (error) throw error;
}

// Fait, dates et auteur vont à la progression de la promo ; le reste au référentiel commun.
export async function updateTheme(id, patch) {
  const { dans: progression, hors: referentiel } = separerChamps(patch, CHAMPS_PROGRESSION);
  try {
    if (Object.keys(progression).length) await ecrireProgression(id, progression);
    if (Object.keys(referentiel).length) {
      const { error } = await supabase.from("themes").update(referentiel).eq("id", id);
      if (error) throw error;
    }
  } finally {
    // Même en cas d'échec de la seconde écriture, la première a pu passer : relire.
    invalidateCache("themes");
  }
}

export async function addTheme(t) {
  const { dans: progression, hors: referentiel } = separerChamps(t, CHAMPS_PROGRESSION);
  const { data, error } = await supabase.from("themes").insert(referentiel).select("id").single();
  if (error) throw error;
  // Le thème existe désormais : la liste doit le montrer même si sa progression échoue
  // (sinon un second « Ajouter » créerait un doublon).
  invalidateCache("themes");
  if (Object.keys(progression).length) await ecrireProgression(data.id, progression);
}

export async function deleteTheme(id) {
  const { error } = await supabase.from("themes").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("themes");
}

// === QCM (par thème) ===

const SELECT_EXAMEN = "examen:qcm_examens(" + CHAMPS_EXAMEN.join(", ") + ")";

// Index léger des QCM : un par thème, avec le nombre de questions et l'état d'examen de
// la promo courante (fermé s'il n'existe pas, spec multi-promo C.4).
export async function listQcmIndex() {
  return cachedQuery("qcm_index", async () => {
    const { data, error } = await supabase
      .from("qcm")
      .select(`id, theme_id, titre, exam_pass_20, qcm_questions(count), ${SELECT_EXAMEN}`);
    if (error) throw error;
    return (data || []).map((q) => ({
      ...fusionnerExamen(q),
      nb_questions: q.qcm_questions?.[0]?.count ?? 0,
    }));
  });
}

// QCM complet (questions + options) pour le player, trié par ordre.
export async function getQcmFull(qcmId) {
  const { data, error } = await supabase
    .from("qcm")
    .select(`*, questions:qcm_questions(*, options:qcm_options(*)), ${SELECT_EXAMEN}`)
    .eq("id", qcmId)
    .single();
  if (error) throw error;
  const qcm = fusionnerExamen(data);
  (qcm.questions || []).sort((a, b) => a.ordre - b.ordre);
  (qcm.questions || []).forEach((q) => (q.options || []).sort((a, b) => a.ordre - b.ordre));
  return qcm;
}

// Enregistre une tentative (entraînement ou examen). Renvoie la ligne créée.
export async function insertQcmAttempt(payload) {
  const { data, error } = await supabase
    .from("qcm_attempts")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// État d'examen de la promo courante (promo_id posé par la base).
async function ecrireExamen(qcmId, champs) {
  const { error } = await supabase
    .from("qcm_examens")
    .upsert({ qcm_id: qcmId, ...champs }, { onConflict: "promo_id,qcm_id" });
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Publie l'examen d'un QCM pour la promo courante et gèle le tirage. email = auteur.
export async function publishQcm(qcmId, { examQuestionIds, drawMode, nbQuestions, secondsPerQuestion, email, fermeA = null }) {
  await ecrireExamen(qcmId, {
    published: true,
    published_by_email: email ?? null,
    published_at: new Date().toISOString(),
    exam_question_ids: examQuestionIds,
    exam_draw_mode: drawMode,
    exam_nb_questions: nbQuestions ?? null,
    exam_seconds_per_question: secondsPerQuestion ?? 30,
    exam_ferme_a: fermeA,
  });
}

// Ferme l'examen (conserve le tirage gelé). L'échéance est remise à nul pour qu'un
// examen fermé ne garde pas d'échéance fantôme, qui réapparaîtrait à la réouverture.
export async function unpublishQcm(qcmId) {
  await ecrireExamen(qcmId, { published: false, exam_ferme_a: null });
}

// Régénère le tirage gelé sans toucher à l'état de publication.
export async function setExamDraw(qcmId, { examQuestionIds, drawMode, nbQuestions }) {
  await ecrireExamen(qcmId, {
    exam_question_ids: examQuestionIds,
    exam_draw_mode: drawMode,
    exam_nb_questions: nbQuestions ?? null,
  });
}

// Met à jour la config d'examen sans changer l'état de publication. Un champ qui ne
// relève pas de l'examen (titre...) va à la banque commune.
export async function updateExamConfig(qcmId, patch) {
  const { dans: examen, hors: banque } = separerChamps(patch, CHAMPS_EXAMEN);
  if (Object.keys(examen).length) await ecrireExamen(qcmId, examen);
  if (Object.keys(banque).length) {
    const { error } = await supabase
      .from("qcm")
      .update({ ...banque, updated_at: new Date().toISOString() })
      .eq("id", qcmId);
    if (error) throw error;
    invalidateCache("qcm_index");
  }
}

// Toutes mes tentatives (RLS : mes lignes only), triées récent -> ancien.
// Sert à afficher ma note d'examen et mon dernier entraînement par thème.
export async function listMyQcmAttempts() {
  const { data, error } = await supabase
    .from("qcm_attempts")
    .select("qcm_id, mode, note_20, finished_at")
    .order("finished_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Mes tentatives détaillées (réponses incluses, les 2 modes) pour un QCM, triées ancien -> récent.
// stagiaireId explicite : un admin lié voit toutes les lignes via RLS, on ne garde que les siennes.
// Sert à l'entraînement adaptatif (questions échouées d'abord, « Revoir mes erreurs »).
export async function listMyQcmAttemptsFor(qcmId, stagiaireId) {
  const { data, error } = await supabase
    .from("qcm_attempts")
    .select("mode, answers, finished_at")
    .eq("qcm_id", qcmId)
    .eq("stagiaire_id", stagiaireId)
    .order("finished_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Ma tentative examen pour ce QCM (RLS : mes lignes uniquement). null si aucune.
export async function getMyExamAttempt(qcmId) {
  const { data, error } = await supabase
    .from("qcm_attempts")
    .select("*")
    .eq("qcm_id", qcmId)
    .eq("mode", "examen")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Tentatives examen de ce QCM (admin/formateur) : sélecteur de réinit + garde régénération.
export async function listExamAttempts(qcmId) {
  const { data, error } = await supabase
    .from("qcm_attempts")
    .select("id, stagiaire_id, note_20, finished_at, stagiaire:stagiaires!stagiaire_id(prenom)")
    .eq("qcm_id", qcmId)
    .eq("mode", "examen")
    .order("finished_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Réinitialise l'examen d'un stagiaire (admin) : supprime sa tentative (cascade -> miroir evaluations).
export async function resetExamAttempt(qcmId, stagiaireId) {
  const { error } = await supabase
    .from("qcm_attempts")
    .delete()
    .eq("qcm_id", qcmId)
    .eq("stagiaire_id", stagiaireId)
    .eq("mode", "examen");
  if (error) throw error;
}

// --- Éditeur de QCM (formateur / admin) ---

// Renvoie l'id du QCM du thème, en le créant s'il n'existe pas encore.
export async function getOrCreateQcm(themeId, titre, email) {
  const { data: existing, error: selErr } = await supabase
    .from("qcm").select("id").eq("theme_id", themeId).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("qcm").insert({ theme_id: themeId, titre, created_by_email: email }).select("id").single();
  if (error) throw error;
  invalidateCache("qcm_index");
  return data.id;
}

// Crée ou met à jour une question + remplace ses options. Renvoie l'id de la question.
export async function saveQcmQuestion(qcmId, q) {
  const row = {
    qcm_id: qcmId,
    section: q.section || null,
    enonce: q.enonce,
    explication: q.explication || null,
    ordre: q.ordre ?? 0,
    image_url: q.image_url ?? null,
  };
  let questionId = q.id;
  if (questionId) {
    const { error } = await supabase.from("qcm_questions").update(row).eq("id", questionId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("qcm_questions").insert(row).select("id").single();
    if (error) throw error;
    questionId = data.id;
  }
  // Remplace les options (simple et robuste pour l'édition).
  const { error: delErr } = await supabase.from("qcm_options").delete().eq("question_id", questionId);
  if (delErr) throw delErr;
  const opts = (q.options || [])
    .filter((o) => (o.texte || "").trim() !== "")
    .map((o, i) => ({ question_id: questionId, texte: o.texte.trim(), is_correct: !!o.is_correct, ordre: i }));
  if (opts.length) {
    const { error: insErr } = await supabase.from("qcm_options").insert(opts);
    if (insErr) throw insErr;
  }
  invalidateCache("qcm_index");
  return questionId;
}

// Supprime une question (cascade -> options).
export async function deleteQcmQuestion(questionId) {
  const { error } = await supabase.from("qcm_questions").delete().eq("id", questionId);
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Réordonne des questions : liste de { id, ordre }.
export async function reorderQcmQuestions(pairs) {
  for (const p of pairs) {
    const { error } = await supabase.from("qcm_questions").update({ ordre: p.ordre }).eq("id", p.id);
    if (error) throw error;
  }
  invalidateCache("qcm_index");
}

// Upload d'une image de question vers le bucket public qcm-images. Renvoie l'URL publique.
export async function uploadQcmImage(file, qcmId, questionId) {
  const ext = ((file.name || "img").split(".").pop() || "png").toLowerCase();
  const path = `qcm${qcmId}/q${questionId || "new"}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("qcm-images").upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from("qcm-images").getPublicUrl(path);
  return data.publicUrl;
}

// === Cours (par thème) ===

// Index léger des cours visibles (la RLS filtre : un stagiaire ne voit que le
// publié). Sert au badge « Cours » de la liste des thèmes sans tout charger.
export async function listCoursIndex() {
  return cachedQuery("cours_index", async () => {
    const { data, error } = await supabase
      .from("cours")
      .select("id, numero, titre, published, updated_by, updated_at");
    if (error) throw error;
    return data || [];
  });
}

// Le cours complet d'un thème (corps markdown compris).
export async function getCours(numero) {
  const { data, error } = await supabase
    .from("cours").select("*").eq("numero", numero).single();
  if (error) throw error;
  return data;
}

// Enregistre un cours avec garde-fou optimiste. `ouvertA` est le updated_at lu
// à l'ouverture de l'éditeur. Si le cours a bougé entre-temps, on ne touche à
// rien et on renvoie qui l'a modifié : l'appelant décide (écraser = rappeler
// avec le ouvertA frais). L'état précédent est archivé dans cours_versions.
export async function saveCours(id, { titre, corps_md, who, ouvertA }) {
  const { data: courant, error: e1 } = await supabase
    .from("cours").select("*").eq("id", id).single();
  if (e1) throw e1;
  if (courant.updated_at !== ouvertA) {
    return { conflit: true, par: courant.updated_by, quand: courant.updated_at };
  }
  const { error: e2 } = await supabase.from("cours_versions").insert({
    cours_id: id, titre: courant.titre, corps_md: courant.corps_md,
    saved_by: courant.updated_by, saved_at: courant.updated_at,
  });
  if (e2) throw e2;
  const { data, error: e3 } = await supabase
    .from("cours")
    .update({ titre, corps_md, updated_by: who, updated_at: new Date().toISOString() })
    .eq("id", id).eq("updated_at", ouvertA)
    .select();
  if (e3) throw e3;
  if (!data || !data.length) {
    // Doublé entre la lecture et l'écriture : rien d'écrasé (la clause eq a
    // retenu l'update), la version archivée en trop est sans gravité.
    const { data: frais } = await supabase
      .from("cours").select("updated_by, updated_at").eq("id", id).single();
    return { conflit: true, par: frais?.updated_by, quand: frais?.updated_at };
  }
  invalidateCache("cours_index");
  return { conflit: false, cours: data[0] };
}

// L'historique d'un cours, du plus récent au plus ancien (métadonnées seules).
export async function listCoursVersions(coursId) {
  const { data, error } = await supabase
    .from("cours_versions")
    .select("id, saved_by, saved_at")
    .eq("cours_id", coursId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Une version complète (pour l'aperçu ou la restauration).
export async function getCoursVersion(versionId) {
  const { data, error } = await supabase
    .from("cours_versions").select("*").eq("id", versionId).single();
  if (error) throw error;
  return data;
}

// Publie ou dépublie. Ne touche ni updated_by ni updated_at : publier n'est
// pas modifier, et y toucher déclencherait de faux conflits d'édition.
export async function setCoursPublie(id, publie) {
  const { error } = await supabase
    .from("cours").update({ published: !!publie }).eq("id", id);
  if (error) throw error;
  invalidateCache("cours_index");
}

// Téléverse une image de cours (déjà réduite) et renvoie son URL publique.
export async function uploadCoursImage(blob, chemin) {
  const { error } = await supabase.storage
    .from("cours-images")
    .upload(chemin, blob, { upsert: false, contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("cours-images").getPublicUrl(chemin);
  return data.publicUrl;
}

// === Compétences ===

export async function listCompetences() {
  return cachedQuery("competences", async () => {
    const { data, error } = await supabase.from("competences").select("*").order("ordre");
    if (error) throw error;
    return data;
  });
}

// === Évaluations ===

export async function listEvaluations(filters = {}) {
  let q = supabase
    .from("evaluations")
    .select("*, stagiaire:stagiaires!stagiaire_id(prenom), competence:competences!competence_code(libelle)")
    .order("date_eval", { ascending: false })
    .order("id", { ascending: false });
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  if (filters.type) q = q.eq("type", filters.type);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function addEvaluation(e) {
  const { data, error } = await supabase.from("evaluations").insert(e).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvaluation(id, e) {
  const { error } = await supabase.from("evaluations").update(e).eq("id", id);
  if (error) throw error;
}

export async function deleteEvaluation(id) {
  const { error } = await supabase.from("evaluations").delete().eq("id", id);
  if (error) throw error;
}

export async function listAuditForEvaluation(evaluation_id) {
  const { data, error } = await supabase
    .from("evaluations_audit")
    .select("*")
    .eq("evaluation_id", evaluation_id)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data;
}

// === EPCF (évaluations en cours de formation) ===

export async function listEpcf(filters = {}) {
  let q = supabase
    .from("epcf_evaluations")
    .select("*, evaluateur:profs!evaluateur_prof_id(nom), stagiaire:stagiaires!stagiaire_id(prenom, nom)")
    .order("date_eval", { ascending: false })
    .order("id", { ascending: false });
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  if (filters.trame) q = q.eq("trame", filters.trame);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Insert (pas d'id) ou update (id fourni). Renvoie la ligne écrite.
export async function upsertEpcf(evalRow) {
  const payload = { ...evalRow, updated_at: new Date().toISOString() };
  delete payload.evaluateur;   // colonnes jointes par listEpcf, pas des colonnes de la table
  delete payload.stagiaire;
  delete payload.created_by;   // colonnes d'audit : jamais réécrites par un update
  delete payload.created_at;
  let q;
  if (payload.id) {
    const id = payload.id;
    delete payload.id;
    q = supabase.from("epcf_evaluations").update(payload).eq("id", id).select().single();
  } else {
    q = supabase.from("epcf_evaluations").insert(payload).select().single();
  }
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function deleteEpcf(id) {
  const { error } = await supabase.from("epcf_evaluations").delete().eq("id", id);
  if (error) throw error;
}

export async function getStagiaire(id) {
  const { data, error } = await supabase.from("stagiaires").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// Date de naissance du profil stagiaire (alimente le livret EPCF officiel).
// RPC SECURITY DEFINER : autorisé pour le stagiaire lui-même ou formateur/admin.
export async function setDateNaissance(stagiaireId, dateIso) {
  const { error } = await supabase.rpc("set_date_naissance", {
    p_stagiaire_id: stagiaireId,
    p_date: dateIso || null,
  });
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}

// === Livret officiel EPCF (document ministère TP-01303, 1 livret / stagiaire) ===

// Index léger : la RLS limite déjà chacun à ce qu'il a le droit de voir
// (formateur/admin = tous, stagiaire = le sien).
export async function listEpcfLivrets() {
  const { data, error } = await supabase
    .from("epcf_livrets")
    .select("id, stagiaire_id, data, updated_at");
  if (error) throw error;
  return data;
}

export async function getEpcfLivret(stagiaireId) {
  const { data, error } = await supabase
    .from("epcf_livrets")
    .select("*")
    .eq("stagiaire_id", stagiaireId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Upsert par stagiaire (contrainte UNIQUE stagiaire_id côté base).
export async function upsertEpcfLivret({ stagiaire_id, data, updated_by_who }) {
  const { data: row, error } = await supabase
    .from("epcf_livrets")
    .upsert(
      { stagiaire_id, data, updated_by_who, updated_at: new Date().toISOString() },
      { onConflict: "stagiaire_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return row;
}

// Moyennes du groupe par critère (RPC SECURITY DEFINER, agrégats seuls).
export async function getEpcfMoyennes(trame) {
  const { data, error } = await supabase.rpc("epcf_moyennes", { p_trame: trame });
  if (error) throw error;
  return data;
}

// === Dossier Professionnel (document ministère, 1 dossier / stagiaire) ===
// Le DP appartient au candidat. La base l'ouvre en lecture et en écriture à son
// propriétaire, aux formateurs et aux admins de la promo (droits révisés le
// 16/09, vérifiés en production le 03/10/2026).

export async function listDpDossiers() {
  const { data, error } = await supabase
    .from("dp_dossiers")
    .select("id, stagiaire_id, data, updated_at");
  if (error) throw error;
  return data;
}

export async function getDpDossier(stagiaireId) {
  const { data, error } = await supabase
    .from("dp_dossiers")
    .select("*")
    .eq("stagiaire_id", stagiaireId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Upsert par stagiaire (contrainte UNIQUE stagiaire_id côté base).
export async function upsertDpDossier({ stagiaire_id, data, updated_by_who }) {
  const { data: row, error } = await supabase
    .from("dp_dossiers")
    .upsert(
      { stagiaire_id, data, updated_by_who, updated_at: new Date().toISOString() },
      { onConflict: "stagiaire_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return row;
}

// === Index légers des états (chantier D, lot 2) ===
// Juste ce que demandent les états de la page Stagiaires et du sommaire, sans le
// contenu des documents. La base filtre : un formateur lit sa promo, un stagiaire
// ses propres lignes.

export async function listEpcfEtats(filters = {}) {
  let q = supabase.from("epcf_evaluations").select("stagiaire_id, trame, date_eval");
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listLivretsIndex(filters = {}) {
  let q = supabase.from("epcf_livrets").select("stagiaire_id, updated_at");
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listDossiersIndex(filters = {}) {
  let q = supabase.from("dp_dossiers").select("stagiaire_id, updated_at");
  if (filters.stagiaire_id) q = q.eq("stagiaire_id", filters.stagiaire_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// === Audit passages (historique qui a modifié quoi) ===

export async function listRecentPassagesAudit(limit = 100) {
  const { data, error } = await supabase
    .from("passages_audit")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// === Ressources ===

export async function listRessources() {
  const { data, error } = await supabase
    .from("ressources")
    .select("*")
    .order("categorie")
    .order("ordre");
  if (error) throw error;
  return data;
}

export async function addRessource(r) {
  const { error } = await supabase.from("ressources").insert(r);
  if (error) throw error;
}

export async function updateRessource(id, r) {
  const { error } = await supabase.from("ressources").update(r).eq("id", id);
  if (error) throw error;
}

export async function deleteRessource(id) {
  const { error } = await supabase.from("ressources").delete().eq("id", id);
  if (error) throw error;
}

// === Contacts (administration, urgences, etc.) ===

export async function listContacts() {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("prenom", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addContact(payload) {
  const { data, error } = await supabase
    .from("contacts").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateContact(id, patch) {
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteContact(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

// === Élèves bénévoles (banque voiture conduite) ===
// Table RLS admin-only (le téléphone ne doit jamais transiter vers un stagiaire).
// Les non-admins passent par la RPC benevoles_noms() (SECURITY DEFINER) qui
// n'expose que id + nom d'affichage, inactifs compris (vieilles semaines lisibles).

export async function listBenevoles() {
  return cachedQuery("benevoles", async () => {
    const { data, error } = await supabase
      .from("benevoles").select("*").order("nom").order("prenom");
    if (error) throw error;
    return data;
  });
}

export async function listBenevolesNoms() {
  return cachedQuery("benevoles_noms", async () => {
    const { data, error } = await supabase.rpc("benevoles_noms");
    if (error) throw error;
    return data;
  });
}

export async function addBenevole(payload) {
  const { data, error } = await supabase.from("benevoles").insert(payload).select().single();
  if (error) throw error;
  invalidateCache("benevoles");
  invalidateCache("benevoles_noms");
  return data;
}

export async function updateBenevole(id, patch) {
  const { error } = await supabase.from("benevoles").update(patch).eq("id", id);
  if (error) throw error;
  invalidateCache("benevoles");
  invalidateCache("benevoles_noms");
}

// Retrait doux : la ligne reste en base (les vieilles semaines gardent leurs noms),
// le bénévole disparaît des sélecteurs et de la liste active.
export async function setBenevoleActif(id, actif) {
  const { error } = await supabase.from("benevoles").update({ actif }).eq("id", id);
  if (error) throw error;
  invalidateCache("benevoles");
  invalidateCache("benevoles_noms");
}

// === Auto-écoles partenaires (banque de contacts, RLS admin-only) ===

export async function listAutoEcoles() {
  return cachedQuery("auto_ecoles", async () => {
    const { data, error } = await supabase
      .from("auto_ecoles").select("*").order("nom");
    if (error) throw error;
    return data;
  });
}

export async function addAutoEcole(payload) {
  const { data, error } = await supabase.from("auto_ecoles").insert(payload).select().single();
  if (error) throw error;
  invalidateCache("auto_ecoles");
  return data;
}

export async function updateAutoEcole(id, patch) {
  const { error } = await supabase.from("auto_ecoles").update(patch).eq("id", id);
  if (error) throw error;
  invalidateCache("auto_ecoles");
}

export async function setAutoEcoleActif(id, actif) {
  const { error } = await supabase.from("auto_ecoles").update({ actif }).eq("id", id);
  if (error) throw error;
  invalidateCache("auto_ecoles");
}

// Suppression définitive : désaffilie d'abord ses bénévoles (la FK n'a pas de
// ON DELETE), qui restent dans la banque sans auto-école.
export async function deleteAutoEcole(id) {
  const { error: e1 } = await supabase.from("benevoles")
    .update({ auto_ecole_id: null }).eq("auto_ecole_id", id);
  if (e1) throw e1;
  const { error } = await supabase.from("auto_ecoles").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("auto_ecoles");
  invalidateCache("benevoles");
}

// === Suivi des venues des bénévoles ===
// Les venues sont DÉDUITES du planning (cartes Voiture où le bénévole est placé),
// jamais stockées. Seuls les commentaires vivent dans benevole_suivi.

// Toutes les cartes portant au moins un bénévole, sur les promos du lieu courant (la
// banque est commune au lieu). RPC réservée aux admins (is_admin(), liste vide sinon) ; chaque ligne porte aussi
// promo_id et promo_nom. Pas de cache : le planning bouge tout le temps.
export async function listVenuesBenevoles() {
  const { data, error } = await supabase.rpc("venues_benevoles");
  if (error) throw error;
  return data || [];
}

export async function listSuiviBenevole(benevole_id) {
  const { data, error } = await supabase
    .from("benevole_suivi").select("*").eq("benevole_id", benevole_id);
  if (error) throw error;
  return data;
}

export async function upsertSuiviBenevole(payload) {
  const { error } = await supabase
    .from("benevole_suivi")
    .upsert({ ...payload, updated_at: new Date().toISOString() },
            { onConflict: "benevole_id,semaine_lundi,day_index,half_day" });
  if (error) throw error;
}

// === Agenda (dates importantes : examens, stages, etc.) ===

export async function listAgendaEvents() {
  const { data, error } = await supabase
    .from("agenda_events")
    .select("*")
    .order("date_start");
  if (error) throw error;
  return data;
}

export async function addAgendaEvent(payload) {
  const { data, error } = await supabase
    .from("agenda_events")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAgendaEvent(id, patch) {
  const { error } = await supabase
    .from("agenda_events")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAgendaEvent(id) {
  const { error } = await supabase
    .from("agenda_events")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// === User profiles (whitelist email → stagiaire/prof + rôle) ===

export async function listUserProfiles() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("invited_at");
  if (error) throw error;
  return data;
}

// La RPC applique le verrou anti-yoyo côté serveur (2 min de grâce, puis 24 h)
// et renvoie l'état : { value, changed_at, locked_until }.
export async function setMyAnonymousNotes(val) {
  const { data, error } = await supabase.rpc("set_my_anonymous_notes", { val: !!val });
  if (error) throw error;
  return data;
}

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  // Profil effectif dans la promo courante (spec multi-promo C.3).
  return profilEffectif(data, getPromoCourante());
}

export async function deleteUserProfile(email) {
  const { error } = await supabase
    .from("user_profiles")
    .delete()
    .eq("email", email.toLowerCase().trim());
  if (error) throw error;
}

// Appelle l'Edge Function pour envoyer une invitation (magic link Supabase).
export async function inviteUser({ email, role, stagiaire_id = null, prof_id = null, is_admin = false }) {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: { email, role, stagiaire_id, prof_id, is_admin },
  });
  if (error) {
    // L'Edge Function renvoie { error: "..." } en cas d'échec ; le SDK le wrap.
    const msg = data?.error || error.message || "Erreur invitation";
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// === Auth (Supabase magic link) ===

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  // Si la confirmation par email est désactivée, on a déjà une session ici.
  return data;
}

// URL de retour du mail de réinitialisation. Doit figurer dans les Redirect URLs
// du tableau de bord Supabase, sinon le lien est refusé.
const URL_RETOUR = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? location.origin + "/"
  : "https://watchi64.github.io/ecsr-promo/";

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: URL_RETOUR },
  );
  if (error) throw error;
}

// Le lien du mail porte un `token_hash` : on l'échange contre une session de
// récupération. Ce chemin marche d'un appareil à l'autre, contrairement au PKCE
// qui exigerait le même navigateur que la demande.
export async function verifyRecoveryToken(tokenHash) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(session?.user ?? null));
}

// === Fiches de suivi (souhaits compétences permis B + besoins) ===

export async function listFiches() {
  const { data, error } = await supabase.from("fiches_suivi").select("*");
  if (error) throw error;
  return data;
}

export async function upsertFiche({ stagiaire_id, souhaits, besoins, updated_by_who }) {
  // On n'écrit QUE les colonnes explicitement fournies : un appel qui passe seulement
  // `souhaits` ne doit pas effacer `besoins` (et inversement) sur les fiches existantes.
  const payload = { stagiaire_id, updated_by_who, updated_at: new Date().toISOString() };
  if (souhaits !== undefined) payload.souhaits = souhaits;
  if (besoins !== undefined) payload.besoins = besoins;
  const { error } = await supabase
    .from("fiches_suivi")
    .upsert(payload, { onConflict: "stagiaire_id" });
  if (error) throw error;
}

// Agrégats voiture par stagiaire pour le placement : nb de séances avec élève,
// répartition par formateur. Règle 2026-07-19 : une ABSENCE COMPTE (tour consommé,
// y compris avec_eleve si le créneau avait un bénévole) ; Bonus/Report ne comptent pas.
// avec_eleve NULL (historique inconnu) ne compte PAS comme « avec élève ».
export async function getVoitureAggregats() {
  const { data, error } = await supabase
    .from("passages")
    .select("stagiaire_id, prof_id, avec_eleve, resultat, date")
    .eq("type", "Voiture");
  if (error) throw error;
  const map = {};
  data.forEach((p) => {
    if (!compteDansEquite(p.resultat)) return;
    const m = map[p.stagiaire_id] || (map[p.stagiaire_id] = { total: 0, avecEleve: 0, byProf: {}, lastDate: null });
    m.total++;
    if (p.avec_eleve === true) m.avecEleve++;
    if (p.prof_id != null) m.byProf[p.prof_id] = (m.byProf[p.prof_id] || 0) + 1;
    if (!m.lastDate || p.date > m.lastDate) m.lastDate = p.date;
  });
  return map;
}

// Agrégats Salle (passages au tableau) par stagiaire, pour le tirage des tableaux.
// Règle 2026-07-19 : une Absence COMPTE (tour consommé) ; Bonus/Report non.
export async function getSalleAggregats() {
  const { data, error } = await supabase
    .from("passages")
    .select("stagiaire_id, resultat")
    .eq("type", "Salle");
  if (error) throw error;
  const map = {};
  data.forEach((p) => {
    if (!compteDansEquite(p.resultat)) return;
    map[p.stagiaire_id] = (map[p.stagiaire_id] || 0) + 1;
  });
  return map;
}

// --- Signalements sur les questions de QCM ---
// Objectif : un élève qui trouve une question douteuse la signale en un clic,
// au lieu de le dire dans le groupe. Le formateur tranche depuis l'éditeur.

// Crée un signalement au nom de l'utilisateur connecté.
// L'email est imposé par la RLS (lower(email) = lower(auth.email())) : inutile de
// le passer, on le lit de la session pour que l'insert passe la policy.
// `optionId` / `optionTexte` sont facultatifs : un signalement peut viser l'énoncé ou
// l'explication, sans option en particulier. Le texte est enregistré en plus de l'id
// parce que c'est CE QUE L'ÉLÈVE A VU : il survit à la correction de l'option.
export async function createQcmSignalement({ questionId, motif, commentaire, optionId, optionTexte }) {
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) throw new Error("Session expirée : reconnecte-toi pour signaler.");
  const row = {
    question_id: questionId,
    email,
    motif: motif || "autre",
    commentaire: (commentaire || "").trim() || null,
    option_id: optionId || null,
    option_texte: optionId ? (optionTexte || null) : null,
  };
  const prof = await myStagiaireId();
  if (prof) row.stagiaire_id = prof;
  const { data, error } = await supabase.from("qcm_signalements").insert(row).select().single();
  if (error) throw error;
  return data;
}

// stagiaire_id de l'utilisateur courant, ou null (un formateur n'en a pas forcément).
async function myStagiaireId() {
  // Contexte de promo chargé : la fiche de CETTE promo (le fondateur n'en a pas en septembre).
  const promo = getPromoCourante();
  if (promo) return promo.stagiaire_id ?? null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase
    .from("user_profiles").select("stagiaire_id")
    .ilike("email", user.email).maybeSingle();
  return data?.stagiaire_id ?? null;
}

// Signalements d'un QCM, groupés par question. Vide pour un stagiaire (RLS).
// L'instruction automatique est jointe en LECTURE SEULE : aucune fonction de ce fichier
// n'écrit dans qcm_signalement_instruction, et la table n'a aucune politique d'écriture
// pour `authenticated`. Le navigateur ne peut pas fabriquer un verdict.
export async function listQcmSignalements(qcmId, { statut = "ouvert" } = {}) {
  let req = supabase
    .from("qcm_signalements")
    .select("*, question:qcm_questions!inner(id, qcm_id, enonce), "
          + "instruction:qcm_signalement_instruction(verdict_auto, analyse_auto, instruit_at)")
    .eq("question.qcm_id", qcmId)
    .order("created_at", { ascending: false });
  if (statut) req = req.eq("statut", statut);
  const { data, error } = await req;
  if (error) throw error;
  const parQuestion = {};
  (data || []).forEach((s) => {
    (parQuestion[s.question_id] = parQuestion[s.question_id] || []).push(s);
  });
  return { liste: data || [], parQuestion };
}

// Tous les signalements, tous QCM confondus : c'est la source de la console.
// `statut` vaut 'ouvert' (défaut), 'traite', 'rejete', ou null pour tout prendre.
// Le THÈME n'est volontairement pas joint : ce serait un troisième niveau d'imbrication
// payé à chaque chargement, alors que la vue Thèmes a déjà la liste des thèmes en
// mémoire et résout le libellé depuis `theme_id`.
export async function listTousSignalements({ statut = "ouvert" } = {}) {
  let req = supabase
    .from("qcm_signalements")
    .select("*, question:qcm_questions!inner(id, qcm_id, enonce, ordre, "
          + "qcm:qcm!inner(id, titre, theme_id)), "
          + "instruction:qcm_signalement_instruction(verdict_auto, analyse_auto, instruit_at)")
    .order("created_at", { ascending: false });
  if (statut) req = req.eq("statut", statut);
  const { data, error } = await req;
  if (error) throw error;
  return data || [];
}

// Nombre de signalements ouverts par qcm_id, pour les compteurs de l'index.
export async function countQcmSignalementsOuverts() {
  const { data, error } = await supabase
    .from("qcm_signalements")
    .select("question:qcm_questions!inner(qcm_id)")
    .eq("statut", "ouvert");
  if (error) throw error;
  const map = {};
  (data || []).forEach((s) => {
    const id = s.question?.qcm_id;
    if (id) map[id] = (map[id] || 0) + 1;
  });
  return map;
}

// Classe un signalement : 'traite' (corrigé) ou 'rejete' (la question était juste).
export async function setQcmSignalementStatut(id, statut, email) {
  const { error } = await supabase
    .from("qcm_signalements")
    .update({ statut, traite_at: new Date().toISOString(), traite_par_email: email || null })
    .eq("id", id);
  if (error) throw error;
}
