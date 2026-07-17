-- Migration planning : formateur « Autre »/« Groupe (autonomie) » + jours désactivés/fériés
-- 2026-07-09 — ADDITIVE UNIQUEMENT (aucune suppression, aucune donnée existante touchée).
-- À exécuter dans Supabase → SQL Editor → New query → coller → Run.

-- Feature 2 : formateur « Autre » (nom libre) + « Groupe (autonomie) »
alter table public.planning_entries
  add column if not exists prof_autre text,
  add column if not exists autonomie boolean not null default false;

-- Feature 3 : jours désactivés / fériés manuels
-- (les fériés français connus sont calculés côté client, pas stockés ici)
create table if not exists public.planning_jours_off (
  id             bigint generated always as identity primary key,
  semaine_lundi  date    not null,
  day_index      int     not null check (day_index between 0 and 4),
  label          text,
  created_at     timestamptz default now(),
  created_by_who text,
  unique (semaine_lundi, day_index)
);

alter table public.planning_jours_off enable row level security;

-- Lecture ouverte à tout compte authentifié (comme les autres tables partagées)
drop policy if exists planning_jours_off_select_all on public.planning_jours_off;
create policy planning_jours_off_select_all
  on public.planning_jours_off for select to authenticated using (true);

-- Écriture réservée aux admins
drop policy if exists planning_jours_off_admin_writes on public.planning_jours_off;
create policy planning_jours_off_admin_writes
  on public.planning_jours_off for all using (public.is_admin()) with check (public.is_admin());
