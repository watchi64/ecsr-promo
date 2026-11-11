-- Marche arrière de 20261112_titres_1_tables.sql : retire le déclencheur et sa fonction, la colonne affectations.titre_id, la
-- table titres (ses trois lignes fixes, ses contraintes et ses index partent avec elle) puis les fonctions de plafond. Après ce
-- retour, la base est dans l'état d'avant la migration (empreinte des règles, des fonctions et des droits identique).
set local lock_timeout = '3s';

-- Garde : ce retour se joue en dernier (après les retours 4, 3 et 2). Joué seul, il laisserait des fonctions et des règles qui
-- citent une table titres disparue, et l'app tomberait pour l'équipe et les stagiaires.
do $garde$
begin
  if to_regclass('public.journal_droits') is not null
     or to_regprocedure('public.case_promo(integer, text)') is not null
     or to_regprocedure('public.geste_promo(integer, text)') is not null
     or to_regprocedure('public.effacer_adresse_journal(text)') is not null then
    raise exception 'titres_1_retour: jouer d''abord les retours 4, 3 et 2 (des objets des migrations 2 à 4 existent encore).' using errcode = 'P0001';
  end if;
end $garde$;

drop trigger if exists affectations_titre on public.affectations;
drop function if exists public._affectations_titre();
alter table public.affectations drop column if exists titre_id;
drop table if exists public.titres;
drop function if exists public._titres_stable();
drop function if exists public.titre_fixe(text);
drop function if exists public._cases_valides(text, jsonb);
drop function if exists public._pages_du_niveau(text);
