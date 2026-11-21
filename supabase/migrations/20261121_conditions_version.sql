-- Conditions d'utilisation : publication de la version groupée 2026-11-21 (espace contact, titres étape 4, résultats de jury,
-- ménage du 11/11), validée par Timy le 18/11 (docs/legal/conditions_version_groupee.md du dépôt ECSR). Copiée sur
-- 20261114_restes_1_conditions.sql : seule conditions_version_publiee() change ; accepter_conditions la lit.
-- ORDRE IMPOSÉ : cette migration AVANT la poussée de js/legal-data.js (VERSION_CONDITIONS = "2026-11-21") ; voir l'en-tête de
-- 20261114_restes_1_conditions.sql. Ensuite, le même jour : 20261114_autonomie_2_version.sql -v version=2026-11-21.
-- Retour : 20261121_conditions_version_retour.sql.
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261121_conditions_version.sql
set local lock_timeout = '3s';

do $garde$
begin
  if public.conditions_version_publiee() <> '2026-11-14' then
    raise exception 'conditions : la version publiée n''est pas 2026-11-14 (%) ; rien n''est changé', public.conditions_version_publiee();
  end if;
end $garde$;

create or replace function public.conditions_version_publiee()
returns text language sql immutable set search_path to 'public', 'pg_temp' as $f$
  select '2026-11-21'::text;
$f$;

revoke all on function public.conditions_version_publiee() from public, anon, authenticated;
