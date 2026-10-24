-- Retour de 20261023_qcm_ia.sql. Les questions deja acceptees restent dans leur QCM :
-- seule leur trace (colonnes ia_*) disparait.
drop function if exists public.rejeter_brouillon_ia(bigint);
drop function if exists public.accepter_brouillon_ia(bigint, text, text, text, jsonb);
drop function if exists public.qcm_ia_consommer(uuid, integer);
drop table if exists public.qcm_ia_usage;
alter table public.qcm_questions
  drop column if exists ia_validee_le,
  drop column if exists ia_validee_par,
  drop column if exists ia_brouillon_id;
drop table if exists public.qcm_ia_brouillons;
