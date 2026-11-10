-- Moyennes EPCF de la classe : le seuil d'anonymat passe de 2 à 3 stagiaires (décision de Timy du 10/11/2026).
-- Avec un seuil de 2, chacun des deux évalués d'un critère retrouvait la note de l'autre à partir de la moyenne et de
-- la sienne. Désormais, les stagiaires ne reçoivent que les critères évalués chez au moins 3 stagiaires
-- (SEUIL_MOYENNE_EPCF de js/epcf-classe-rules.js) ; l'équipe de la promo (formateur, direction), qui lit déjà chaque
-- évaluation (epcf_evaluations_lecture), reçoit toujours tous les critères.
-- Seul changement par rapport à 20261109_epcf_moyennes_anonymat : le nombre de la clause having. Droits d'exécution
-- inchangés (authenticated seulement).
-- Preuve : tests/sql/epcf-moyennes-preuve.sql (outils/assembler_preuve_epcf.mjs). Retour :
-- 20261110_epcf_moyennes_seuil_3_retour.sql.

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
  having count(*) >= 3 or (select public.equipe_courante());
$$;
