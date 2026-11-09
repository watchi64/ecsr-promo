-- Retour de 20261109_registre_qualite.sql : la fonction d'effacement, la table (son déclencheur, ses règles et ses
-- entrées partent avec elle), puis la fonction du déclencheur. peut_gerer_qualite() (lot Q3) reste : elle n'est pas
-- à ce lot. Aucun autre objet n'est touché.
drop function if exists public.effacer_registre_qualite();
drop table if exists public.registre_qualite;
drop function if exists public._registre_qualite_avant();
