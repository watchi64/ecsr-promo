-- Schéma minimal pour jouer 20261109_habillage.sql et sa preuve sur une base Postgres LOCALE jetable
-- (jamais en prod). Reprend de la prod ce dont la migration dépend : rôles Supabase, auth.jwt(), et
-- public.user_profiles avec les règles du lot 4 (20261028_roles_3_regles.sql) qui comptent ici :
-- RLS active, politique user_profiles_lecture (chacun lit sa propre ligne), insertion et modification
-- retirées à anon et authenticated (d'où le security definer de set_my_habillage).
-- Lancement : voir l'en-tête de tests/sql/habillage-preuve.sql.

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

-- Comme Supabase : tout nouvel objet de public est accordé aux rôles d'API (la RLS filtre).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table public.user_profiles (
  email text primary key, role text, is_admin boolean default false, is_founder boolean default false,
  stagiaire_id integer);
alter table public.user_profiles enable row level security;
-- Version réduite de la politique du lot 4 : sa seule branche utile ici est « ma propre ligne ».
create policy user_profiles_lecture on public.user_profiles
  as permissive for select to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')));
revoke insert, update on public.user_profiles from anon, authenticated;

-- Données de jeu locales (adresses fictives) : deux stagiaires et un formateur.
insert into public.user_profiles (email, role, stagiaire_id) values
  ('a@exemple.test', 'stagiaire', 1),
  ('b@exemple.test', 'stagiaire', 2),
  ('f@exemple.test', 'prof', null);
