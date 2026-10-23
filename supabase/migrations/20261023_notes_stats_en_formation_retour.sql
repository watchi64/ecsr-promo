-- Marche arrière de 20261023_notes_stats_en_formation : la synthèse de la page Notes compte
-- de nouveau les notes des abandons (version de 20261004_confidentialite_1_preparation).
-- À jouer avec la version de js/notes-stats.js qui va avec, sinon le personnel et les
-- stagiaires ne voient plus les mêmes chiffres.

create or replace function public.notes_stats_groupe()
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with notes as (
    select e.stagiaire_id, e.type, e.theme_numero, e.competence_code,
           (e.note::numeric / e.note_max::numeric) * 20 as s
      from evaluations e
     where e.promo_id = promo_courante()
       and e.note is not null and e.note_max is not null and e.note_max <> 0
  ),
  -- Moyennes individuelles des stagiaires actifs (comme la liste de la page Notes).
  par_stagiaire as (
    select avg(n.s) as moy from notes n
      join stagiaires st on st.id = n.stagiaire_id and st.actif
     group by n.stagiaire_id
  )
  select jsonb_build_object(
    'n_lignes', (select count(*) from evaluations where promo_id = promo_courante()),
    'n', (select count(*) from notes),
    'somme', (select coalesce(sum(s), 0) from notes),
    'mediane', (select percentile_cont(0.5) within group (order by s) from notes),
    'sous_10', (select count(*) from notes where s < 10),
    'repartition', jsonb_build_array(
      (select count(*) from notes where s >= 0 and s < 4),
      (select count(*) from notes where s >= 4 and s < 8),
      (select count(*) from notes where s >= 8 and s < 12),
      (select count(*) from notes where s >= 12 and s < 16),
      (select count(*) from notes where s >= 16 and s < 20.01)),
    'themes', coalesce((select jsonb_agg(jsonb_build_object(
        'num', theme_numero, 'n', n, 'somme', somme, 'mediane', mediane) order by theme_numero)
      from (select theme_numero, count(*) as n, sum(s) as somme,
                   percentile_cont(0.5) within group (order by s) as mediane
              from notes where type = 'Thème' and theme_numero is not null
             group by theme_numero) t), '[]'::jsonb),
    'competences', coalesce((select jsonb_agg(jsonb_build_object(
        'code', competence_code, 'n', n, 'somme', somme) order by competence_code)
      from (select competence_code, count(*) as n, sum(s) as somme
              from notes where type = 'Compétence' and competence_code is not null
             group by competence_code) c), '[]'::jsonb),
    'moy_stagiaire_max', (select max(moy) from par_stagiaire),
    'moy_stagiaire_min', (select min(moy) from par_stagiaire)
  );
$function$;

revoke all on function public.notes_stats_groupe() from anon, public;
grant execute on function public.notes_stats_groupe() to authenticated;
