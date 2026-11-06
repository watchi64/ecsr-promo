-- Retour de 20261028_signalements_app.sql : les fonctions, puis les signalements et leurs captures
-- (supprimés avec leurs tables).
drop function if exists public.compter_signalements_app();
drop function if exists public.mes_signalements_app();
drop function if exists public.marquer_suivis_vus();
drop function if exists public.traiter_signalement_app(bigint, text, text);
drop function if exists public.signaler_probleme(text, jsonb, text);
drop table if exists public.signalements_app_captures;
drop table if exists public.signalements_app;
