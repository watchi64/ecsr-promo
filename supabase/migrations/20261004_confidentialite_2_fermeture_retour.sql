-- Marche arrière de 20261004_confidentialite_2_fermeture : rouvre les lectures comme avant
-- (promo entière) et recopie les dates de naissance dans l'ancienne colonne.

alter table public.stagiaires drop constraint if exists stagiaires_date_naissance_videe;

update public.stagiaires s set date_naissance = p.date_naissance
  from public.stagiaires_prive p where p.stagiaire_id = s.id;

create or replace function public.set_date_naissance(p_stagiaire_id integer, p_date date)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Non autorise : ce stagiaire n''appartient pas a la promo affichee';
  end if;
  if not (is_admin() or is_prof() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  insert into stagiaires_prive (stagiaire_id, date_naissance, updated_at)
  values (p_stagiaire_id, p_date, now())
  on conflict (stagiaire_id) do update set date_naissance = excluded.date_naissance, updated_at = now();
  update stagiaires set date_naissance = p_date where id = p_stagiaire_id;
end;
$function$;

drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select_all on public.evaluations
  for select to authenticated using (promo_id = (select public.promo_courante()));

drop policy if exists evaluations_audit_select on public.evaluations_audit;
create policy evaluations_audit_select on public.evaluations_audit
  for select to authenticated using (promo_id = (select public.promo_courante()));

drop policy if exists fiches_suivi_select on public.fiches_suivi;
create policy fiches_suivi_select on public.fiches_suivi
  for select to authenticated using (promo_id = (select public.promo_courante()));
