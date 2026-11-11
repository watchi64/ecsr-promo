-- Navigation unique, phase 2 (décisions du fondateur du 10/11). À appliquer APRÈS la mise en ligne de l'app de la phase 2,
-- qui ne lit plus ni la « semaine épinglée » ni les fiches de suivi. Copie de sauvegarde de `fiches_suivi` hors du dépôt avant.
--   1. `current_week_lundi` : plus de lecteur ni d'écrivain, chacun suit la vraie semaine (la suivante le week-end).
--   2. Critère « souhaits » du placement retiré : `fiches_suivi` (plus écrite depuis le 14/07, 13 fiches figées au 11/07).
--      _anonymiser_stagiaire ne la cite plus depuis 20261110_navigation_unique_2_menage ; les fonctions de Qualiopi Q5 n'y
--      touchent que si elle existe.
set local lock_timeout = '3s';

delete from public.settings where key = 'current_week_lundi';
drop table if exists public.fiches_suivi;

do $controle$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = '_anonymiser_stagiaire' and p.prosrc ilike '%fiches_suivi%') then
    raise exception '_anonymiser_stagiaire cite encore fiches_suivi : migration annulée.';
  end if;
end
$controle$;
