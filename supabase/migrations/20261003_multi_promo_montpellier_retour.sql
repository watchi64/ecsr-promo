-- Marche arrière de la correction Montpellier : la promo 2 revient à Nîmes et mes_promos()
-- reprend sa forme de l'étape 1. Attention : des bénévoles ou auto-écoles créés depuis dans
-- la banque de Montpellier ne seraient plus visibles depuis la promo 2.
set local lock_timeout = '3s';

update public.promos set lieu_id = 1, nom = 'Nîmes, septembre 2026' where id = 2;

drop function if exists public.mes_promos();
create function public.mes_promos()
returns table (id integer, nom text, lieu_id integer, lieu_nom text, date_debut date,
               date_fin date, par_defaut boolean, stagiaire_id integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select pr.id, pr.nom, pr.lieu_id, l.nom, pr.date_debut, pr.date_fin,
         coalesce(pr.id = d.pid, false),
         (select s.id from user_profiles up join stagiaires s on s.id = up.stagiaire_id
           where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = pr.id
           limit 1)
  from promos pr
  join lieux l on l.id = pr.lieu_id
  cross join (select promo_par_defaut() as pid) d
  where peut_acceder_promo(pr.id)
  order by pr.date_debut, pr.id;
$$;
revoke all on function public.mes_promos() from public;
grant execute on function public.mes_promos() to authenticated, service_role;
revoke execute on function public.mes_promos() from anon;
