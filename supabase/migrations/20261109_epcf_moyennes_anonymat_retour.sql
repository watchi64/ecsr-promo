-- Marche arrière de 20261109_epcf_moyennes_anonymat : epcf_moyennes telle qu'en ligne avant le 09/11/2026
-- (version de 20261001_multi_promo_2_cloisonnement, empreinte md5 850b333a791a1b747afd1b1af030046a relevée en ligne
-- le 09/11). Attention : ce retour rouvre la fuite (les critères évalués chez un seul stagiaire redeviennent lisibles
-- par tous les membres de la promo). L'app reste juste avec l'une ou l'autre version : elle filtre aussi à l'affichage.

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
  group by critere;
$$;
