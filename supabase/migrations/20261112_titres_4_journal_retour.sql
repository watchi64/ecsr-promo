-- Marche arrière de 20261112_titres_4_journal.sql : les déclencheurs, les trois fonctions et la table du journal disparaissent.
-- Le journal est perdu avec la table : ce retour ne se joue que pour défaire l'étape.
set local lock_timeout = '3s';

drop trigger if exists journal_titres_ajuste on public.titres;
drop trigger if exists journal_titres_ecriture on public.titres;
drop trigger if exists journal_affectations_titre on public.affectations;
drop trigger if exists journal_affectations_ecriture on public.affectations;
drop function if exists public.effacer_adresse_journal(text);
drop function if exists public._journal_titres();
drop function if exists public._journal_affectations();
drop table if exists public.journal_droits;
