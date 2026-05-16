import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Stagiaires & Profs ===

export async function listStagiaires() {
  const { data, error } = await supabase
    .from("stagiaires")
    .select("*")
    .order("ordre");
  if (error) throw error;
  return data;
}

export async function listProfs() {
  const { data, error } = await supabase
    .from("profs")
    .select("*")
    .order("ordre");
  if (error) throw error;
  return data;
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
}

export async function updateStagiaire(id, prenom) {
  const { error } = await supabase.from("stagiaires").update({ prenom }).eq("id", id);
  if (error) throw error;
}

export async function deleteStagiaire(id) {
  const { error } = await supabase.from("stagiaires").delete().eq("id", id);
  if (error) throw error;
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
}

export async function updateProf(id, nom) {
  const { error } = await supabase.from("profs").update({ nom }).eq("id", id);
  if (error) throw error;
}

export async function deleteProf(id) {
  const { error } = await supabase.from("profs").delete().eq("id", id);
  if (error) throw error;
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
  const { error } = await supabase.from("passages").insert(p);
  if (error) throw error;
}

export async function updatePassage(id, p) {
  const { error } = await supabase.from("passages").update(p).eq("id", id);
  if (error) throw error;
}

export async function deletePassage(id) {
  const { error } = await supabase.from("passages").delete().eq("id", id);
  if (error) throw error;
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
  // entry must have semaine_lundi, day_index, half_day, slot + champs à mettre à jour
  const { error } = await supabase
    .from("planning_entries")
    .upsert(entry, { onConflict: "semaine_lundi,day_index,half_day,slot" });
  if (error) throw error;
}

export async function deletePlanningEntry(semaine_lundi, day_index, half_day, slot) {
  const { error } = await supabase
    .from("planning_entries")
    .delete()
    .match({ semaine_lundi, day_index, half_day, slot });
  if (error) throw error;
}

export async function deletePlanningEntryById(id) {
  const { error } = await supabase.from("planning_entries").delete().eq("id", id);
  if (error) throw error;
}

// Pédagogues du planning courant (pour ajouter au compteur Tableau de bord)
export async function getPedagogueCountsFromPlanning(semaine_lundi) {
  const { data, error } = await supabase
    .from("planning_entries")
    .select("pedagogue_id")
    .eq("semaine_lundi", semaine_lundi)
    .eq("activite", "Pédagogie salle")
    .not("pedagogue_id", "is", null);
  if (error) throw error;
  const counts = {};
  data.forEach((row) => {
    counts[row.pedagogue_id] = (counts[row.pedagogue_id] || 0) + 1;
  });
  return counts;
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

// === Compétences ===

export async function listCompetences() {
  const { data, error } = await supabase.from("competences").select("*").order("ordre");
  if (error) throw error;
  return data;
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

export async function listRecentAudit(limit = 50) {
  const { data, error } = await supabase
    .from("evaluations_audit")
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

// === Auth (Supabase magic link) ===

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(session?.user ?? null));
}
