-- Moyennes EPCF de la classe : le k-anonymat passe dans la base (09/11/2026).
-- Jusqu'ici, epcf_moyennes rendait tous les critères, y compris ceux évalués chez un seul stagiaire, à tout membre
-- connecté de la promo : l'app ne les montrait pas, mais un stagiaire pouvait lire dans les outils du navigateur la
-- note exacte d'un camarade. Désormais, la fonction suit la règle de lecture des évaluations EPCF
-- (epcf_evaluations_lecture) : l'équipe de la promo (formateur, direction), qui lit déjà chaque évaluation, reçoit
-- tous les critères ; les autres (les stagiaires) ne reçoivent que les critères évalués chez au moins 2 stagiaires
-- (SEUIL_MOYENNE_EPCF de js/epcf-classe-rules.js).
-- Seul changement : la clause having. Droits d'exécution inchangés (authenticated seulement).
-- Preuve : tests/sql/epcf-moyennes-preuve.sql. Retour : 20261109_epcf_moyennes_anonymat_retour.sql.

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
