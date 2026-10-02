// Vérifie que les jointures PostgREST de l'app se résolvent toujours : une relation
// devenue ambiguë après une migration casse une vue entière. Lecture seule, clé
// publique : les règles d'accès renvoient des listes vides ou un refus de droit, ce
// qui suffit. Seules les erreurs de relation (PGRST200, PGRST201) comptent comme échec.
// Usage : node scripts/verifier-embarquements.mjs
import { SUPABASE_URL, SUPABASE_KEY } from "../js/config.js";

const EXAMEN = "published, published_by_email, published_at, exam_nb_questions, "
  + "exam_question_ids, exam_draw_mode, exam_seconds_per_question, exam_ferme_a";

const REQUETES = [
  ["passages", "*, stagiaire:stagiaires!stagiaire_id(prenom), remplacant:stagiaires!remplacant_id(prenom)"],
  ["evaluations", "*, stagiaire:stagiaires!stagiaire_id(prenom), competence:competences!competence_code(libelle)"],
  ["epcf_evaluations", "*, evaluateur:profs!evaluateur_prof_id(nom), stagiaire:stagiaires!stagiaire_id(prenom, nom)"],
  ["qcm_attempts", "id, stagiaire_id, note_20, finished_at, stagiaire:stagiaires!stagiaire_id(prenom)"],
  ["qcm", "*, questions:qcm_questions(*, options:qcm_options(*))"],
  ["qcm_signalements", "*, question:qcm_questions!inner(id, qcm_id, enonce), "
    + "instruction:qcm_signalement_instruction(verdict_auto, analyse_auto, instruit_at)"],
  ["qcm_signalements", "*, question:qcm_questions!inner(id, qcm_id, enonce, ordre, "
    + "qcm:qcm!inner(id, titre, theme_id)), instruction:qcm_signalement_instruction(verdict_auto, analyse_auto, instruit_at)"],
  ["qcm_signalements", "question:qcm_questions!inner(qcm_id)"],
  // Formes de la nouvelle version (Tâche 8)
  ["themes", "*, progression:themes_progression(statut, date_fait, date_qcm, notes, updated_by_email)"],
  ["qcm", `id, theme_id, titre, exam_pass_20, qcm_questions(count), examen:qcm_examens(${EXAMEN})`],
  ["qcm", `*, questions:qcm_questions(*, options:qcm_options(*)), examen:qcm_examens(${EXAMEN})`],
];

let echecs = 0;
for (const [table, select] of REQUETES) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=0`;
  const rep = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  const corps = await rep.text();
  let code = "";
  try { code = JSON.parse(corps).code || ""; } catch (e) { /* liste vide */ }
  const casse = code === "PGRST200" || code === "PGRST201";
  if (casse) echecs++;
  console.log(`${casse ? "ÉCHEC" : "ok   "} ${rep.status} ${code || "-"} ${table} : ${select.slice(0, 70)}`);
}
console.log(echecs ? `${echecs} jointure(s) cassée(s)` : "Toutes les jointures se résolvent");
process.exit(echecs ? 1 : 0);
