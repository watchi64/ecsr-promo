-- Retour de 20261114_restes_1_conditions.sql : accepter_conditions redevient celle de 20261004_conditions_acceptations.sql
-- (mot pour mot : toute version bien formée s'enregistre), conditions_version_publiee() disparaît. Les acceptations déjà
-- enregistrées ne changent pas.
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_restes_1_conditions_retour.sql
set local lock_timeout = '3s';

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
  insert into conditions_acceptations (email, version) values (v_email, p_version)
  on conflict (email, version) do nothing;
  select accepted_at into v_quand from conditions_acceptations
   where email = v_email and version = p_version;
  return v_quand;
end;
$function$;

revoke all on function public.accepter_conditions(text) from anon, public;
grant execute on function public.accepter_conditions(text) to authenticated;

drop function if exists public.conditions_version_publiee();
