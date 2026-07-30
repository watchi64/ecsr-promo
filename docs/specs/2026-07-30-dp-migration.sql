-- Dossier Professionnel : stockage par stagiaire.
-- Appliqué le 2026-07-30 sur le projet crpduennbqaemhfaywrz.
-- Migrations : create_dp_dossiers, puis revoke_anon_on_dp_dossiers.
--
-- Miroir inversé de epcf_livrets : sur le livret le formateur écrit et le
-- stagiaire lit, sur le DP c'est le contraire. Le DP appartient au candidat,
-- lui seul le rédige ; les formateurs le consultent.

create table public.dp_dossiers (
  id bigint generated always as identity primary key,
  stagiaire_id integer not null unique references public.stagiaires(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_by_who text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dp_dossiers enable row level security;

-- Lecture : formateurs et admins voient tous les dossiers, un stagiaire ne voit que le sien.
create policy dp_dossiers_select on public.dp_dossiers
  for select using (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id());

-- Ecriture reservee au candidat proprietaire (le DP lui appartient), admin pour depannage.
create policy dp_dossiers_insert on public.dp_dossiers
  for insert with check (is_admin() or stagiaire_id = my_stagiaire_id());

create policy dp_dossiers_update on public.dp_dossiers
  for update using (is_admin() or stagiaire_id = my_stagiaire_id())
          with check (is_admin() or stagiaire_id = my_stagiaire_id());

create policy dp_dossiers_delete on public.dp_dossiers
  for delete using (is_admin());

grant select, insert, update, delete on public.dp_dossiers to authenticated;

-- Durcissement aligne sur epcf_livrets : le role anon (visiteur non connecte) ne
-- doit avoir aucun privilege sur les dossiers professionnels. Les default
-- privileges du schema public l'avaient accorde a la creation de la table.
revoke all on public.dp_dossiers from anon;
