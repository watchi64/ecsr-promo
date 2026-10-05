-- Marche arrière de l'étape 4 : rétablit les règles d'accès aux cours relevées le 05/10/2026
-- (tout formateur et tout administrateur lisent et modifient tous les cours, publiés ou non) et
-- retire is_founder(). Après ce retour, les cours de compétence non publiés redeviennent visibles
-- de tous les formateurs.

drop policy cours_select on public.cours;
create policy cours_select on public.cours for select to authenticated
  using (published or is_admin() or is_prof());

drop policy cours_update on public.cours;
create policy cours_update on public.cours for update to authenticated
  using (is_admin() or is_prof())
  with check (is_admin() or is_prof());

drop policy cours_versions_select on public.cours_versions;
create policy cours_versions_select on public.cours_versions for select to authenticated
  using (is_admin() or is_prof());

drop policy cours_versions_insert on public.cours_versions;
create policy cours_versions_insert on public.cours_versions for insert to authenticated
  with check (is_admin() or is_prof());

drop function public.is_founder();

do $$
begin
  assert (select qual from pg_policies where schemaname = 'public' and tablename = 'cours' and policyname = 'cours_select')
         = '(published OR is_admin() OR is_prof())',
    'retour : règle de lecture des cours non rétablie';
end $$;
