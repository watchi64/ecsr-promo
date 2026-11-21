-- Retour de 20261121_conditions_version.sql : la base republie la version 2026-11-14. À jouer avec le retour de l'app
-- (js/legal-data.js à 2026-11-14), la base d'abord ; si l'e-learning a été rejoué à 2026-11-21, rejouer aussi
-- 20261114_autonomie_2_version.sql -v version=2026-11-14 (il ne doit jamais dépasser la version publiée).
set local lock_timeout = '3s';

create or replace function public.conditions_version_publiee()
returns text language sql immutable set search_path to 'public', 'pg_temp' as $f$
  select '2026-11-14'::text;
$f$;

revoke all on function public.conditions_version_publiee() from public, anon, authenticated;
