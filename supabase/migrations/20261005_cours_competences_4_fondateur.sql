-- Cours des compétences de conduite, étape 4 : un cours de compétence (colonne code) non publié
-- n'est visible et modifiable que du fondateur. Consigne de Timy du 05/10/2026 : il vérifie chaque
-- cours de compétence, un par un, avant de le publier, et lui seul les voit d'ici là.
-- Les cours des 57 thèmes (colonne numero) gardent exactement leurs règles. Publié, un cours de
-- compétence suit les règles des autres cours (lisible par tous, modifiable par les formateurs) ;
-- seul le fondateur peut le dépublier.
-- À appliquer AVANT l'import des cours de compétence.
-- Marche arrière : 20261005_cours_competences_4_fondateur_retour.sql

do $$
begin
  assert (select count(*) from public.user_profiles where is_founder) = 1,
    'un seul compte fondateur attendu : revoir la migration';
  assert (select qual from pg_policies where schemaname = 'public' and tablename = 'cours' and policyname = 'cours_select')
         = '(published OR is_admin() OR is_prof())',
    'la règle de lecture des cours a changé depuis le relevé du 05/10 : revoir la migration';
end $$;

-- Même forme que is_admin() et is_prof().
create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from user_profiles
    where lower(email) = lower((select auth.jwt() ->> 'email'))
      and is_founder = true
  );
$$;
revoke all on function public.is_founder() from public;
grant execute on function public.is_founder() to authenticated, anon, service_role;

drop policy cours_select on public.cours;
create policy cours_select on public.cours for select to authenticated
  using (published or is_founder() or (code is null and (is_admin() or is_prof())));

drop policy cours_update on public.cours;
create policy cours_update on public.cours for update to authenticated
  using (is_founder() or ((is_admin() or is_prof()) and (code is null or published)))
  with check (is_founder() or ((is_admin() or is_prof()) and (code is null or published)));

drop policy cours_versions_select on public.cours_versions;
create policy cours_versions_select on public.cours_versions for select to authenticated
  using (is_founder() or ((is_admin() or is_prof()) and exists (
    select 1 from public.cours c where c.id = cours_versions.cours_id and (c.code is null or c.published))));

drop policy cours_versions_insert on public.cours_versions;
create policy cours_versions_insert on public.cours_versions for insert to authenticated
  with check (is_founder() or ((is_admin() or is_prof()) and exists (
    select 1 from public.cours c where c.id = cours_versions.cours_id and (c.code is null or c.published))));
