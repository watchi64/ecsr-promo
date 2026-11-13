-- Marche arrière de 20261114_autonomie_1_traces.sql : retire le déclencheur de stagiaires, les trois règles restrictives de
-- settings, les fonctions, les règles et les trois tables de l'autonomie.
-- Les traces (lectures, temps actif) et la liste des oppositions sont perdues avec les tables. Aucune fonction existante
-- n'avait été modifiée par la migration : rien d'autre à rétablir. Garde : les trois tables doivent exister.
set local lock_timeout = '3s';

do $garde$
begin
  if to_regclass('public.cours_lectures') is null or to_regclass('public.autonomie_temps') is null
     or to_regclass('public.autonomie_oppositions') is null then
    raise exception 'autonomie_1 retour : une table de l''autonomie est absente, rien à défaire';
  end if;
end $garde$;

drop trigger stagiaires_autonomie_effacer on public.stagiaires;
drop function public._autonomie_effacer_fiche();
drop policy settings_autonomie_suppression on public.settings;
drop policy settings_autonomie_modification on public.settings;
drop policy settings_autonomie_ajout on public.settings;

drop function public.autonomie_opposer(integer);
drop function public.autonomie_lectures_promo();
drop function public.autonomie_tracer_qcm(bigint, integer);
drop function public.autonomie_tracer_cours(uuid, integer, boolean, text);
drop function public._autonomie_ajouter_temps(integer, integer, text, text, integer);
drop function public._autonomie_permis(integer, integer);
drop function public._autonomie_stagiaire();
drop function public._autonomie_version_conditions();

drop policy autonomie_temps_lecture on public.autonomie_temps;
drop policy cours_lectures_lecture on public.cours_lectures;

drop table public.autonomie_oppositions;
drop table public.autonomie_temps;
drop table public.cours_lectures;
