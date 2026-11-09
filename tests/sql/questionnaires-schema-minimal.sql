-- Schéma minimal pour jouer la preuve des questionnaires (tests/sql/questionnaires-preuve.sql) sur une base
-- Postgres LOCALE jetable (jamais en prod). Reprend de la prod ce dont 20261108_questionnaires.sql dépend, dans
-- l'état où la prod est depuis le 08/11 (lot 4, rôles et portées, appliqué) :
--   1. Avant le lot 4 : rôles Supabase, auth.users, auth.jwt() / auth.uid(), les colonnes utiles de lieux, promos,
--      stagiaires (dont anonymise_le, migration du 05/10) et user_profiles ; is_founder() et peut_acceder_promo()
--      d'avant le lot 4 (relevées en lecture seule sur la base réelle le 28/10, comme dans
--      tests/sql/signalements-app-schema-minimal.sql) ; promo_par_defaut(), promo_courante() et lieu_courant()
--      recopiées telles quelles de supabase/migrations/20261001_multi_promo_1_fondations.sql.
--   2. Étape 1 du lot 4 rejouée telle quelle : supabase/migrations/20261028_roles_1_fondations.sql (table affectations,
--      vocabulaire fondateur_reel, apercu_role, est_fondateur, est_formateur, est_direction, est_siege,
--      lieu_de_promo, formateur_courant, direction_courante, equipe_courante, redacteur_contenus, roles_reels ; ses
--      droits et ses règles). L'amorce n'écrit rien : aucun profil n'existe encore.
--   3. Étape 2 du lot 4 : le fichier entier ne se rejoue pas ici (il touche une vingtaine de fonctions et de tables
--      absentes de ce schéma). Les quatre fonctions dont dépendent le vocabulaire et la migration des questionnaires
--      (peut_acceder_promo, promo_par_defaut, promo_courante, is_founder) sont EXTRAITES du fichier du dépôt
--      supabase/migrations/20261028_roles_2_fonctions.sql au chargement et jouées telles quelles (create or replace :
--      droits d'exécution gardés, comme en prod). Une fonction introuvable fait échouer le chargement.
--   L'étape 3 (règles) ne change aucun objet que lisent les questionnaires : elle n'est pas jouée.
-- Lancement (psql lit l'étape 1 par \ir, le serveur lit l'étape 2 par pg_read_file : superutilisateur local) :
--   psql -p <port> -U postgres -d qn -v ON_ERROR_STOP=1 \
--        -v lot4_fonctions=<chemin absolu de supabase/migrations/20261028_roles_2_fonctions.sql> \
--        -f tests/sql/questionnaires-schema-minimal.sql
-- Puis la preuve : voir l'en-tête de tests/sql/questionnaires-preuve.sql.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth, public to anon, authenticated, service_role;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Comme Supabase : tout nouvel objet de public est accordé aux rôles d'API (la RLS filtre). La migration doit
-- donc retirer elle-même ces droits : la preuve le vérifie.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- 1. Avant le lot 4 -------------------------------------------------------------------------------------------------
create table public.lieux (id serial primary key, nom text not null);
create table public.promos (id serial primary key, lieu_id integer not null references public.lieux(id),
  nom text not null, date_debut date not null, date_fin date);
create table public.stagiaires (id serial primary key, prenom text not null, nom text,
  promo_id integer not null references public.promos(id), actif boolean not null default true,
  anonymise_le timestamptz);
create table public.user_profiles (
  email text primary key, role text, is_admin boolean default false, is_founder boolean default false,
  stagiaire_id integer references public.stagiaires(id));

create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select exists (
    select 1 from user_profiles
    where lower(email) = lower((select auth.jwt() ->> 'email'))
      and is_founder = true
  );
$function$;

create or replace function public.peut_acceder_promo(p integer) returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select exists (select 1 from promos pr where pr.id = p)
     and exists (
       select 1 from user_profiles up
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and (   up.is_founder
              or up.role in ('prof', 'admin')
              or exists (select 1 from stagiaires s
                          where s.id = up.stagiaire_id and s.promo_id = p))
     );
$function$;

-- Recopiées de 20261001_multi_promo_1_fondations.sql (section 3), avec leurs droits.
create or replace function public.promo_par_defaut()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with moi as (
    select up.stagiaire_id, (up.is_founder or up.role in ('prof', 'admin')) as tout_voir
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id),
    (select pr.id from promos pr, moi
      where moi.tout_voir and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr, moi
      where moi.tout_voir
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$$;

create or replace function public.promo_courante()
returns integer language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  brut text := nullif(current_setting('request.headers', true), '');
  entete text;
begin
  if brut is not null then
    if not pg_input_is_valid(brut, 'jsonb') then
      return null;
    end if;
    entete := brut::jsonb ->> 'x-promo-id';
  end if;
  if entete is null or entete = '' then
    return promo_par_defaut();
  end if;
  if entete ~ '^[0-9]{1,9}$' and peut_acceder_promo(entete::integer) then
    return entete::integer;
  end if;
  return null;
end;
$$;

create or replace function public.lieu_courant()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select pr.lieu_id from promos pr where pr.id = promo_courante();
$$;

revoke all on function public.peut_acceder_promo(integer), public.promo_par_defaut(),
  public.promo_courante(), public.lieu_courant() from public;
grant execute on function public.peut_acceder_promo(integer), public.promo_par_defaut(),
  public.promo_courante(), public.lieu_courant() to anon, authenticated, service_role;

-- 2. Étape 1 du lot 4, rejouée telle quelle (son « set local » hors transaction n'est qu'un avertissement) ----------
\ir ../../supabase/migrations/20261028_roles_1_fondations.sql

-- 3. Étape 2 du lot 4 : les quatre fonctions utiles, extraites du fichier du dépôt ----------------------------------
select length(set_config('schema.lot4_fonctions', pg_read_file(:'lot4_fonctions'), false)) as etape_2_lue;
do $$
declare
  v_src text := current_setting('schema.lot4_fonctions');
  v_nom text;
  v_bloc text;
begin
  foreach v_nom in array array['peut_acceder_promo', 'promo_par_defaut', 'promo_courante', 'is_founder'] loop
    -- Du titre de la fonction à la fin de son corps (premier « $function$; » qui suit).
    v_bloc := (regexp_match(v_src, 'CREATE OR REPLACE FUNCTION public\.' || v_nom || '\(.*?\$function\$;'))[1];
    if v_bloc is null then
      raise exception 'schéma minimal : % introuvable dans l''étape 2 du lot 4', v_nom;
    end if;
    execute v_bloc;
  end loop;
end $$;
