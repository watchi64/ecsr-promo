-- Marche arrière de l'étape 1 : retire tout ce que la migration 1 a ajouté. Rien
-- d'existant n'avait été modifié, sauf les deux fonctions d'audit, rétablies d'abord.

create or replace function public.audit_evaluations()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  who text := coalesce(auth.jwt()->>'email', 'anon');
begin
  if tg_op = 'INSERT' then
    insert into evaluations_audit(evaluation_id, action, after_data, changed_by_email)
    values (new.id, 'insert', to_jsonb(new), who);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into evaluations_audit(evaluation_id, action, before_data, after_data, changed_by_email)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who);
    return new;
  elsif tg_op = 'DELETE' then
    insert into evaluations_audit(evaluation_id, action, before_data, changed_by_email)
    values (old.id, 'delete', to_jsonb(old), who);
    return old;
  end if;
end;
$$;

create or replace function public.audit_passages()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  client_who text := coalesce(new.created_by_who, new.updated_by_who, old.created_by_who, old.updated_by_who, 'anon');
  jwt_email text := coalesce(auth.jwt()->>'email', null);
  who_trace text := case when jwt_email is null then client_who else jwt_email end;
begin
  if tg_op = 'INSERT' then
    insert into passages_audit(passage_id, action, after_data, changed_by_who)
    values (new.id, 'insert', to_jsonb(new), who_trace);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into passages_audit(passage_id, action, before_data, after_data, changed_by_who)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who_trace);
    return new;
  elsif tg_op = 'DELETE' then
    insert into passages_audit(passage_id, action, before_data, changed_by_who)
    values (old.id, 'delete', to_jsonb(old), who_trace);
    return old;
  end if;
end;
$$;

drop trigger if exists trg_sync_themes_progression on public.themes;
drop trigger if exists trg_sync_qcm_examens on public.qcm;
drop table if exists public.themes_progression;
drop table if exists public.qcm_examens;
drop trigger if exists trg_promo_du_stagiaire on public.evaluations;
drop trigger if exists trg_promo_du_stagiaire on public.passages;
drop trigger if exists trg_promo_du_stagiaire on public.qcm_attempts;
drop trigger if exists trg_promo_du_stagiaire on public.epcf_evaluations;
drop trigger if exists trg_promo_du_stagiaire on public.epcf_livrets;
drop trigger if exists trg_promo_du_stagiaire on public.dp_dossiers;
drop trigger if exists trg_promo_du_stagiaire on public.fiches_suivi;
drop trigger if exists trg_lieu_du_benevole on public.benevole_suivi;
drop trigger if exists trg_affiliation_meme_lieu on public.benevoles;

alter table public.settings drop constraint if exists settings_promo_key_unique;
alter table public.settings drop column if exists id;
alter table public.stagiaires         drop column if exists promo_id;
alter table public.evaluations        drop column if exists promo_id;
alter table public.evaluations_audit  drop column if exists promo_id;
alter table public.passages           drop column if exists promo_id;
alter table public.passages_audit     drop column if exists promo_id;
alter table public.planning_entries   drop column if exists promo_id;
alter table public.planning_half_meta drop column if exists promo_id;
alter table public.planning_jours_off drop column if exists promo_id;
alter table public.agenda_events      drop column if exists promo_id;
alter table public.qcm_attempts       drop column if exists promo_id;
alter table public.epcf_evaluations   drop column if exists promo_id;
alter table public.epcf_livrets       drop column if exists promo_id;
alter table public.dp_dossiers        drop column if exists promo_id;
alter table public.fiches_suivi       drop column if exists promo_id;
alter table public.settings           drop column if exists promo_id;
alter table public.benevoles          drop column if exists lieu_id;
alter table public.auto_ecoles        drop column if exists lieu_id;
alter table public.benevole_suivi     drop column if exists lieu_id;

drop function if exists public.sync_themes_vers_progression();
drop function if exists public.sync_progression_vers_themes();
drop function if exists public.sync_qcm_vers_examens();
drop function if exists public.sync_examens_vers_qcm();
drop function if exists public.imposer_promo_du_stagiaire();
drop function if exists public.imposer_lieu_du_benevole();
drop function if exists public.verifier_affiliation_meme_lieu();
drop function if exists public.mes_promos();
drop function if exists public.lieu_courant();
drop function if exists public.promo_courante();
drop function if exists public.promo_par_defaut();
drop function if exists public.peut_acceder_promo(integer);
drop function if exists public.diag_entete_promo();
drop table if exists public.promos;
drop table if exists public.lieux;
