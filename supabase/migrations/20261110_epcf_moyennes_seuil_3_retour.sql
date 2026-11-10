-- Marche arrière de 20261110_epcf_moyennes_seuil_3 : epcf_moyennes telle qu'en ligne du 09 au 10/11/2026 (version de
-- 20261109_epcf_moyennes_anonymat, seuil de 2, empreinte md5 ff95931b6f607093717653eab23981f3 relevée en ligne le 10/11).
-- Attention : ce retour rouvre le cas des deux évalués (chacun retrouve la note de l'autre). L'app reste juste avec
-- l'une ou l'autre version : elle filtre aussi à l'affichage, au seuil de 3.

set local lock_timeout = '3s';

create or replace function public.epcf_moyennes(p_trame text)
returns table(critere text, moyenne numeric, effectif integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with dernieres as (
    select distinct on (stagiaire_id) scores
    from epcf_evaluations
    where trame = p_trame and contexte = 'EPCF' and auto_eval = false
      and promo_id = promo_courante()
    order by stagiaire_id, date_eval desc, id desc
  ),
  notes as (
    select k.key as critere,
           case k.value when 'A' then 2 when 'R' then 1 when 'NA' then 0 end as val
    from dernieres d, jsonb_each_text(d.scores) k
    where k.value in ('A','R','NA')
  )
  select critere, round(avg(val)::numeric, 3) as moyenne, count(*)::integer as effectif
  from notes
  group by critere
  having count(*) >= 2 or (select public.equipe_courante());
$$;
