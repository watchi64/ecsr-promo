-- Retour de 20261114_restes_2_truncate.sql : rend TRUNCATE aux tables qui l'avaient le 14/11/2026 (relevé de la production
-- avant la migration : anon 28 tables, authenticated les mêmes plus 8) et aux droits par défaut de postgres dans public.
-- Une table de la liste qui n'existe plus est sautée.
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_restes_2_truncate_retour.sql
set local lock_timeout = '3s';

do $retour$
declare
  t text;
begin
  foreach t in array array['agenda_events', 'chatbot_usage', 'competences', 'contacts', 'cours', 'cours_chunks',
    'cours_versions', 'epcf_evaluations', 'evaluations', 'evaluations_audit', 'passages', 'passages_audit',
    'planning_entries', 'planning_half_meta', 'planning_jours_off', 'profs', 'qcm', 'qcm_attempts', 'qcm_ia_brouillons',
    'qcm_ia_usage', 'qcm_options', 'qcm_questions', 'qcm_signalements', 'ressources', 'settings', 'stagiaires', 'themes',
    'user_profiles'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant truncate on table public.%I to anon, authenticated', t);
    end if;
  end loop;
  foreach t in array array['auto_ecoles', 'benevole_suivi', 'benevoles', 'dp_dossiers', 'epcf_livrets', 'qcm_examens',
    'qcm_signalement_instruction', 'themes_progression'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant truncate on table public.%I to authenticated', t);
    end if;
  end loop;
end $retour$;

alter default privileges for role postgres in schema public grant truncate on tables to anon, authenticated;
