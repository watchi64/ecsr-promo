-- Marche arrière de 20261112_titres_2_gestes.sql (partie A) : retire les fonctions des cases et des gestes. Rien d'autre ne les
-- cite à ce stade (les règles et les fonctions de l'app ne s'en servent qu'après la partie B et la migration 3, retirées avant).
set local lock_timeout = '3s';

drop function if exists public.geste_reseau(text);
drop function if exists public.geste_centre(integer, text);
drop function if exists public.geste_promo(integer, text);
drop function if exists public.membre_stagiaire(integer);
drop function if exists public.siege_fixe();
drop function if exists public.direction_fixe(integer);
drop function if exists public.formateur_fixe(integer);
drop function if exists public.case_reseau(text);
drop function if exists public.case_centre(integer, text);
drop function if exists public.case_promo(integer, text);
