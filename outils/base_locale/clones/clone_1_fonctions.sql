-- Clone LOCAL et jetable (hors dépôt) du schéma de production, relevé en lecture seule le 28/10 au soir, pour mettre au
-- point tests/sql/roles-preuve.sql avant de la jouer sur la production. Partie 1 : rôles, auth, stockage, fonctions
-- (hors les 21 du retour 2, jouées ensuite depuis le dépôt). Données fictives : clone_4_donnees.sql.
set check_function_bodies = off;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function auth.email() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.email', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'))::text $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(), metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text, owner_id text, user_metadata jsonb, archived_at timestamptz, is_delete_marker boolean, is_versioned boolean);
create unique index bucketid_objname on storage.objects (bucket_id, name);
alter table storage.objects enable row level security;
create function storage.protect_delete() returns trigger language plpgsql as $$
BEGIN
  IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
    RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END $$;
create trigger protect_objects_delete before delete on storage.objects for each statement execute function storage.protect_delete();
create function storage.update_updated_at_column() returns trigger language plpgsql as $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
create trigger update_objects_updated_at before update on storage.objects for each row execute function storage.update_updated_at_column();
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant all on storage.objects, storage.buckets to service_role;
grant select on storage.buckets to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

-- Fonctions relevées sur la production (pg_get_functiondef), hors les 21 du retour 2.
CREATE OR REPLACE FUNCTION public.agenda_touch_updated()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.audit_evaluations()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  who text := coalesce(auth.jwt()->>'email', 'anon');
begin
  if tg_op = 'INSERT' then
    insert into evaluations_audit(evaluation_id, action, after_data, changed_by_email, promo_id)
    values (new.id, 'insert', to_jsonb(new), who, new.promo_id);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into evaluations_audit(evaluation_id, action, before_data, after_data, changed_by_email, promo_id)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who, new.promo_id);
    return new;
  elsif tg_op = 'DELETE' then
    insert into evaluations_audit(evaluation_id, action, before_data, changed_by_email, promo_id)
    values (old.id, 'delete', to_jsonb(old), who, old.promo_id);
    return old;
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.audit_passages()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  client_who text := coalesce(new.created_by_who, new.updated_by_who, old.created_by_who, old.updated_by_who, 'anon');
  jwt_email text := coalesce(auth.jwt()->>'email', null);
  who_trace text := case when jwt_email is null then client_who else jwt_email end;
begin
  if tg_op = 'INSERT' then
    insert into passages_audit(passage_id, action, after_data, changed_by_who, promo_id)
    values (new.id, 'insert', to_jsonb(new), who_trace, new.promo_id);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into passages_audit(passage_id, action, before_data, after_data, changed_by_who, promo_id)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who_trace, new.promo_id);
    return new;
  elsif tg_op = 'DELETE' then
    insert into passages_audit(passage_id, action, before_data, changed_by_who, promo_id)
    values (old.id, 'delete', to_jsonb(old), who_trace, old.promo_id);
    return old;
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.contacts_touch_updated()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $function$;
CREATE OR REPLACE FUNCTION public.emargement_jour_paris()
 RETURNS date LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $function$
  select (now() at time zone 'Europe/Paris')::date;
$function$;
CREATE OR REPLACE FUNCTION public.emargement_signature_figee()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if coalesce(current_setting('emargement.effacement', true), '') = 'on' then
    return new;
  end if;
  if tg_table_name = 'emargement_formateurs' then
    raise exception 'emargement: Une signature de formateur ne se modifie pas.';
  end if;
  if old.trace is not null and (
       new.trace is distinct from old.trace or new.signe_le is distinct from old.signe_le
       or new.signe_par is distinct from old.signe_par
       or new.sur_appareil_formateur is distinct from old.sur_appareil_formateur
       or new.stagiaire_id is distinct from old.stagiaire_id or new.seance_id is distinct from old.seance_id) then
    raise exception 'emargement: Une signature ne se modifie pas.';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.emargement_trace_valide(p_trace text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'pg_temp'
AS $function$
  select p_trace is not null and length(p_trace) between 1 and 20000
     and p_trace ~ '^(M[0-9]{1,3} [0-9]{1,3}(L[0-9]{1,3} [0-9]{1,3})*)+$';
$function$;
CREATE OR REPLACE FUNCTION public.imposer_lieu_du_benevole()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  select b.lieu_id into new.lieu_id from public.benevoles b where b.id = new.benevole_id;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.imposer_promo_du_stagiaire()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  select s.promo_id into new.promo_id from public.stagiaires s where s.id = new.stagiaire_id;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lieu_courant()
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  select pr.lieu_id from promos pr where pr.id = promo_courante();
$function$;
CREATE OR REPLACE FUNCTION public.mirror_exam_to_evaluations()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_numero    integer;
  v_titre     text;
  v_qcm_titre text;
begin
  if NEW.mode <> 'examen' then
    return NEW;
  end if;
  select t.numero, t.titre, q.titre
    into v_numero, v_titre, v_qcm_titre
  from qcm q
  join themes t on t.id = q.theme_id
  where q.id = NEW.qcm_id;
  if v_numero is not null then
    insert into evaluations
      (stagiaire_id, type, theme_numero, theme_titre,
       note, note_max, observation, date_eval, controle_libelle, qcm_attempt_id)
    values
      (NEW.stagiaire_id, 'Thème', v_numero, v_titre,
       NEW.note_20, 20, 'QCM examen', current_date, v_qcm_titre, NEW.id);
  end if;
  return NEW;
end;
$function$;
CREATE OR REPLACE FUNCTION public.qcm_exam_demarrable(p_qcm_id bigint)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select e.published and (e.exam_ferme_a is null or now() < e.exam_ferme_a)
     from qcm_examens e where e.qcm_id = p_qcm_id and e.promo_id = promo_courante()),
    false);
$function$;
CREATE OR REPLACE FUNCTION public.qcm_exam_remise_toleree(p_qcm_id bigint)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select e.published and (
      e.exam_ferme_a is null
      or now() < e.exam_ferme_a + make_interval(secs =>
           coalesce(e.exam_seconds_per_question, 30) * coalesce(
             case when jsonb_typeof(e.exam_question_ids) = 'array'
                  then jsonb_array_length(e.exam_question_ids) end,
             e.exam_nb_questions,
             (select count(*)::int from qcm_questions qq where qq.qcm_id = e.qcm_id),
             0))
    )
    from qcm_examens e where e.qcm_id = p_qcm_id and e.promo_id = promo_courante()), false);
$function$;
CREATE OR REPLACE FUNCTION public.sync_examens_vers_qcm()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if pg_trigger_depth() > 1 or new.promo_id <> 1 then return new; end if;
  update qcm set published = new.published, published_by_email = new.published_by_email,
    published_at = new.published_at, exam_nb_questions = new.exam_nb_questions,
    exam_question_ids = new.exam_question_ids, exam_draw_mode = new.exam_draw_mode,
    exam_seconds_per_question = new.exam_seconds_per_question, exam_ferme_a = new.exam_ferme_a
   where id = new.qcm_id;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.sync_progression_vers_themes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if pg_trigger_depth() > 1 or new.promo_id <> 1 then return new; end if;
  update themes set statut = new.statut, date_fait = new.date_fait, date_qcm = new.date_qcm,
                    notes = new.notes, updated_by_email = new.updated_by_email
   where id = new.theme_id;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.sync_qcm_vers_examens()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  insert into qcm_examens (promo_id, qcm_id, published, published_by_email, published_at,
    exam_nb_questions, exam_question_ids, exam_draw_mode, exam_seconds_per_question, exam_ferme_a)
  values (1, new.id, new.published, new.published_by_email, new.published_at, new.exam_nb_questions,
    new.exam_question_ids, new.exam_draw_mode, new.exam_seconds_per_question, new.exam_ferme_a)
  on conflict (promo_id, qcm_id) do update
    set published = excluded.published, published_by_email = excluded.published_by_email,
        published_at = excluded.published_at, exam_nb_questions = excluded.exam_nb_questions,
        exam_question_ids = excluded.exam_question_ids, exam_draw_mode = excluded.exam_draw_mode,
        exam_seconds_per_question = excluded.exam_seconds_per_question,
        exam_ferme_a = excluded.exam_ferme_a;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.sync_themes_vers_progression()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  insert into themes_progression (promo_id, theme_id, statut, date_fait, date_qcm, notes, updated_by_email)
  values (1, new.id, new.statut, new.date_fait, new.date_qcm, new.notes, new.updated_by_email)
  on conflict (promo_id, theme_id) do update
    set statut = excluded.statut, date_fait = excluded.date_fait, date_qcm = excluded.date_qcm,
        notes = excluded.notes, updated_by_email = excluded.updated_by_email;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.verifier_affiliation_meme_lieu()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.lieu_id is not null and new.auto_ecole_id is not null and not exists (
    select 1 from public.auto_ecoles a where a.id = new.auto_ecole_id and a.lieu_id = new.lieu_id
  ) then
    raise exception 'Cette auto-école appartient à un autre lieu.' using errcode = '23514';
  end if;
  return new;
end;
$function$;
-- Remplaçant local : le découpage des cours n'a pas d'effet sur les droits.
CREATE OR REPLACE FUNCTION public.rechunk_cours()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$ begin return null; end; $function$;
-- Remplacée par le retour 2 (drop puis création), comme sur la production.
create function public.mes_promos() returns integer language sql as 'select 1';
-- Esquisses que le retour 2 remplace (mêmes signatures) : les défauts des tables les citent.
create function public.promo_courante() returns integer language sql stable as 'select null::integer';
create function public.promo_par_defaut() returns integer language sql stable as 'select null::integer';
create function public.peut_acceder_promo(p integer) returns boolean language sql stable as 'select false';

revoke all on function public.audit_evaluations(), public.audit_passages(), public.emargement_jour_paris(),
  public.emargement_signature_figee(), public.emargement_trace_valide(text), public.imposer_lieu_du_benevole(),
  public.imposer_promo_du_stagiaire(), public.mirror_exam_to_evaluations(), public.sync_examens_vers_qcm(),
  public.sync_progression_vers_themes(), public.sync_qcm_vers_examens(), public.sync_themes_vers_progression(),
  public.verifier_affiliation_meme_lieu() from public;
revoke all on function public.lieu_courant() from public;
grant execute on function public.lieu_courant() to anon, authenticated, service_role;
