-- Multi-promo, ménage (étape 5), quand plus aucun appareil ne tourne sur une version
-- antérieure à la Tâche 15 : la synchronisation de bascule et les anciennes colonnes de
-- progression et d'examen disparaissent. Pas de marche arrière utile : tout vit dans
-- themes_progression et qcm_examens.
drop trigger if exists trg_sync_themes_progression on public.themes;
drop trigger if exists trg_sync_progression_themes on public.themes_progression;
drop trigger if exists trg_sync_qcm_examens on public.qcm;
drop trigger if exists trg_sync_examens_qcm on public.qcm_examens;
drop function if exists public.sync_themes_vers_progression();
drop function if exists public.sync_progression_vers_themes();
drop function if exists public.sync_qcm_vers_examens();
drop function if exists public.sync_examens_vers_qcm();
alter table public.themes
  drop column if exists statut, drop column if exists date_fait, drop column if exists date_qcm,
  drop column if exists notes, drop column if exists updated_by_email;
alter table public.qcm
  drop column if exists published, drop column if exists published_by_email,
  drop column if exists published_at, drop column if exists exam_nb_questions,
  drop column if exists exam_question_ids, drop column if exists exam_draw_mode,
  drop column if exists exam_seconds_per_question, drop column if exists exam_ferme_a;
delete from public.settings where promo_id is null and key in ('cohort_name', 'password_hash');
