import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=20260719b";

// fetch avec timeout : sans ça, une requête peut rester pendue indéfiniment
// (réseau mobile instable) → "Chargement" infini. Avec, elle échoue proprement après 15s.
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  // Si un signal externe existe déjà (rare), on le respecte aussi
  const externalSignal = init.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal })
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

export async function addStagiaire(prenom) {
  const { data: max } = await supabase
    .from("stagiaires")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1);
  const ordre = (max?.[0]?.ordre || 0) + 1;
  const { error } = await supabase.from("stagiaires").insert({ prenom, ordre });
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
    .upsert(entry, { onConflict: "semaine_lundi,day_index,half_day,slot,lane" });
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
    .upsert(meta, { onConflict: "semaine_lundi,day_index,half_day" });
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
            { onConflict: "semaine_lundi,day_index" });
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

export async function getSetting(key) {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setSetting(key, value) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// === Thèmes (57 + notions pédagogiques) ===

export async function listThemes() {
  return cachedQuery("themes", async () => {
    const { data, error } = await supabase
      .from("themes")
      .select("*")
      .order("type")    // theme avant notion
      .order("ordre");
    if (error) throw error;
    return data;
  });
}

export async function updateTheme(id, patch) {
  const { error } = await supabase.from("themes").update(patch).eq("id", id);
  if (error) throw error;
  invalidateCache("themes");
}

export async function addTheme(t) {
  const { error } = await supabase.from("themes").insert(t);
  if (error) throw error;
  invalidateCache("themes");
}

export async function deleteTheme(id) {
  const { error } = await supabase.from("themes").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("themes");
}

// === QCM (par thème) ===

// Index léger des QCM : un par thème, avec le nombre de questions.
// Sert à afficher l'accès QCM sur la liste des thèmes sans tout charger.
export async function listQcmIndex() {
  return cachedQuery("qcm_index", async () => {
    const { data, error } = await supabase
      .from("qcm")
      .select("id, theme_id, titre, published, published_by_email, published_at, exam_nb_questions, exam_pass_20, exam_seconds_per_question, exam_draw_mode, exam_question_ids, qcm_questions(count)");
    if (error) throw error;
    return (data || []).map((q) => ({
      ...q,
      nb_questions: q.qcm_questions?.[0]?.count ?? 0,
    }));
  });
}

// QCM complet (questions + options) pour le player, trié par ordre.
export async function getQcmFull(qcmId) {
  const { data, error } = await supabase
    .from("qcm")
    .select("*, questions:qcm_questions(*, options:qcm_options(*))")
    .eq("id", qcmId)
    .single();
  if (error) throw error;
  (data.questions || []).sort((a, b) => a.ordre - b.ordre);
  (data.questions || []).forEach((q) => (q.options || []).sort((a, b) => a.ordre - b.ordre));
  return data;
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

// Publie l'examen d'un QCM et gèle le tirage (formateur/admin). email = auteur.
export async function publishQcm(qcmId, { examQuestionIds, drawMode, nbQuestions, secondsPerQuestion, email }) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("qcm")
    .update({
      published: true,
      published_by_email: email ?? null,
      published_at: now,
      exam_question_ids: examQuestionIds,
      exam_draw_mode: drawMode,
      exam_nb_questions: nbQuestions ?? null,
      exam_seconds_per_question: secondsPerQuestion ?? 30,
      updated_at: now,
    })
    .eq("id", qcmId);
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Dépublie l'examen (conserve le tirage gelé).
export async function unpublishQcm(qcmId) {
  const { error } = await supabase
    .from("qcm")
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq("id", qcmId);
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Régénère le tirage gelé sans toucher à l'état de publication.
export async function setExamDraw(qcmId, { examQuestionIds, drawMode, nbQuestions }) {
  const { error } = await supabase
    .from("qcm")
    .update({
      exam_question_ids: examQuestionIds,
      exam_draw_mode: drawMode,
      exam_nb_questions: nbQuestions ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", qcmId);
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Met à jour la config d'examen (questions gelées, temps, mode) sans changer l'état de publication.
export async function updateExamConfig(qcmId, patch) {
  const { error } = await supabase
    .from("qcm")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", qcmId);
  if (error) throw error;
  invalidateCache("qcm_index");
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

// Moyennes du groupe par critère (RPC SECURITY DEFINER — agrégats seuls).
export async function getEpcfMoyennes(trame) {
  const { data, error } = await supabase.rpc("epcf_moyennes", { p_trame: trame });
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

// Toutes les cartes portant au moins un bénévole (pour compter les venues et
// construire la fiche de suivi). Pas de cache : le planning bouge tout le temps.
export async function listVenuesBenevoles() {
  const { data, error } = await supabase
    .from("planning_entries")
    .select("semaine_lundi, day_index, half_day, sujet, eleves_ids, benevoles_ids")
    .neq("benevoles_ids", "{}")
    .order("semaine_lundi", { ascending: false })
    .order("day_index", { ascending: true });
  if (error) throw error;
  return data;
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

export async function setMyAnonymousNotes(val) {
  const { error } = await supabase.rpc("set_my_anonymous_notes", { val: !!val });
  if (error) throw error;
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
  return data;
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
// répartition par formateur. Les absences/reports ne comptent pas comme exposition.
// avec_eleve NULL (historique inconnu) ne compte PAS comme « avec élève ».
export async function getVoitureAggregats() {
  const { data, error } = await supabase
    .from("passages")
    .select("stagiaire_id, prof_id, avec_eleve, resultat, date")
    .eq("type", "Voiture");
  if (error) throw error;
  const map = {};
  data.forEach((p) => {
    if (p.resultat === "Absence" || p.resultat === "Report") return;
    const m = map[p.stagiaire_id] || (map[p.stagiaire_id] = { total: 0, avecEleve: 0, byProf: {}, lastDate: null });
    m.total++;
    if (p.avec_eleve === true) m.avecEleve++;
    if (p.prof_id != null) m.byProf[p.prof_id] = (m.byProf[p.prof_id] || 0) + 1;
    if (!m.lastDate || p.date > m.lastDate) m.lastDate = p.date;
  });
  return map;
}

// Agrégats Salle (passages au tableau) par stagiaire, pour le tirage des tableaux.
// Absences/reports exclus, comme pour la voiture.
export async function getSalleAggregats() {
  const { data, error } = await supabase
    .from("passages")
    .select("stagiaire_id, resultat")
    .eq("type", "Salle");
  if (error) throw error;
  const map = {};
  data.forEach((p) => {
    if (p.resultat === "Absence" || p.resultat === "Report") return;
    map[p.stagiaire_id] = (map[p.stagiaire_id] || 0) + 1;
  });
  return map;
}
