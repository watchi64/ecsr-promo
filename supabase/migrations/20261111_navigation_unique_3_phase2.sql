-- Navigation unique, phase 2 (décisions du fondateur du 10/11). À appliquer APRÈS la mise en ligne de l'app de la phase 2,
-- qui ne lit plus ni la « semaine épinglée » ni les fiches de suivi. Un onglet ouvert AVANT cette mise en ligne garde l'ancien
-- code jusqu'à son rechargement : son placement automatique perdrait l'historique des passages (lecture groupée qui
-- échoue) ; prévenir l'équipe de recharger l'app au moment d'appliquer. Copie de sauvegarde de `fiches_suivi` hors du dépôt avant.
--   1. `current_week_lundi` : plus de lecteur ni d'écrivain, chacun suit la vraie semaine (la suivante le week-end).
--   2. Critère « souhaits » du placement retiré : `fiches_suivi` (plus écrite depuis le 14/07, 13 fiches figées au 11/07).
--      _anonymiser_stagiaire (20261110_navigation_unique_2_menage) et les fonctions de Qualiopi Q5 n'y touchent que si elle
--      existe (SQL dynamique gardé par to_regclass).
set local lock_timeout = '3s';

delete from public.settings where key = 'current_week_lundi';
drop table if exists public.fiches_suivi;

do $controle$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.prosrc ilike '%fiches_suivi%' and p.prosrc not ilike '%to_regclass(''public.fiches_suivi'')%') then
    raise exception 'Une fonction cite encore fiches_suivi sans garde to_regclass : migration annulée.';
  end if;
end
$controle$;
