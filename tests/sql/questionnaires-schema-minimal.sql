-- Schéma minimal pour jouer la preuve des questionnaires (tests/sql/questionnaires-preuve.sql) sur une base
-- Postgres LOCALE jetable (jamais en prod). Reprend de la prod ce dont 20261108_questionnaires.sql dépend :
-- rôles Supabase, auth.users, auth.jwt() / auth.uid(), les colonnes utiles de lieux, promos, stagiaires
-- (dont anonymise_le, migration du 05/10) et user_profiles, et les fonctions is_founder() et
-- peut_acceder_promo(), recopiées de tests/sql/signalements-app-schema-minimal.sql (définitions relevées en
-- lecture seule sur la base réelle le 28/10 ; aucune migration du dépôt ne les a changées depuis).
-- Lancement : voir l'en-tête de tests/sql/questionnaires-preuve.sql.

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
