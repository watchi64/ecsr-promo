-- Marche arrière de 20261112_titres_1_tables.sql : retire le déclencheur et sa fonction, la colonne affectations.titre_id, la
-- table titres (ses trois lignes fixes, ses contraintes et ses index partent avec elle) puis les fonctions de plafond. Après ce
-- retour, la base est dans l'état d'avant la migration (empreinte des règles, des fonctions et des droits identique).
set local lock_timeout = '3s';

drop trigger if exists affectations_titre on public.affectations;
drop function if exists public._affectations_titre();
alter table public.affectations drop column if exists titre_id;
drop table if exists public.titres;
drop function if exists public._titres_stable();
drop function if exists public.titre_fixe(text);
drop function if exists public._cases_valides(text, jsonb);
drop function if exists public._pages_du_niveau(text);
