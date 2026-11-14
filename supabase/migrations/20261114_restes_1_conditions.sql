-- Conditions d'utilisation : accepter_conditions n'enregistre plus que la version publiée (petits restes du 14/11).
-- Avant : toute version de la forme AAAA-MM-JJ (lettre éventuelle) était enregistrée, même impossible (2026-13-45), future
-- (2099-01-01) ou jamais publiée. Désormais la base connaît la version en vigueur, conditions_version_publiee(), qui doit être
-- EXACTEMENT VERSION_CONDITIONS de js/legal-data.js (contrôlé par tests/conditions-version.test.mjs).
-- Retour : 20261114_restes_1_conditions_retour.sql. Preuve : tests/sql/conditions-acceptations-preuve.sql.
--
-- Usage (une seule transaction, arrêt à la première erreur) :
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_restes_1_conditions.sql
--
-- PUBLIER UNE NOUVELLE VERSION DES CONDITIONS, plus tard : une migration neuve, copiée sur celle-ci, qui remplace
-- conditions_version_publiee() par la nouvelle date, appliquée en même temps que la poussée de js/legal-data.js. Si l'app
-- part avant la base, la fenêtre d'acceptation refuse « Continuer » (la base attend l'ancienne version) et demande de
-- recharger ; si la base part avant l'app, même chose pour les onglets restés ouverts. Les acceptations déjà enregistrées ne
-- changent pas. La version exigée pour le travail en autonomie (_autonomie_version_conditions) reste à part : elle ne doit
-- jamais dépasser la version publiée (contrôle ci-dessous).
set local lock_timeout = '3s';

create or replace function public.conditions_version_publiee()
returns text language sql immutable set search_path to 'public', 'pg_temp' as $f$
  select '2026-11-14'::text;
$f$;

revoke all on function public.conditions_version_publiee() from public, anon, authenticated;

create or replace function public.accepter_conditions(p_version text)
returns timestamptz language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_quand timestamptz;
begin
  if v_email is null then
    raise exception 'Non connecte';
  end if;
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$' then
    raise exception 'Version de conditions invalide';
  end if;
  -- Seule la version publiée s'accepte : une date impossible, future ou jamais publiée est refusée.
  if p_version <> public.conditions_version_publiee() then
    raise exception 'Version de conditions inconnue';
  end if;
  insert into conditions_acceptations (email, version) values (v_email, p_version)
  on conflict (email, version) do nothing;
  select accepted_at into v_quand from conditions_acceptations
   where email = v_email and version = p_version;
  return v_quand;
end;
$function$;

revoke all on function public.accepter_conditions(text) from anon, public;
grant execute on function public.accepter_conditions(text) to authenticated;

do $controle$
declare
  v_publiee text := public.conditions_version_publiee();
  v_jour date;
  v_autonomie text;
begin
  begin
    v_jour := left(v_publiee, 10)::date;
  exception when others then
    v_jour := null;
  end;
  if v_publiee !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$' or v_jour is null or to_char(v_jour, 'YYYY-MM-DD') <> left(v_publiee, 10) then
    raise exception 'restes_1 : version publiée « % » : pas une date', v_publiee;
  end if;
  if v_jour > (now() at time zone 'Europe/Paris')::date then
    raise exception 'restes_1 : version publiée « % » datée après aujourd''hui', v_publiee;
  end if;
  -- La version exigée pour le travail en autonomie, quand elle existe et n'est plus la sentinelle, ne dépasse pas la publiée
  -- (sinon personne ne pourrait l'accepter et aucune trace ne s'écrirait jamais).
  if to_regprocedure('public._autonomie_version_conditions()') is not null then
    execute 'select public._autonomie_version_conditions()' into v_autonomie;
    if v_autonomie <> '9999-12-31' and v_autonomie collate "C" > v_publiee collate "C" then
      raise exception 'restes_1 : la version exigée pour le travail en autonomie (« % ») dépasse la version publiée (« % »)',
        v_autonomie, v_publiee;
    end if;
  end if;
  raise notice 'restes_1 : version publiée des conditions « % »', v_publiee;
end $controle$;
