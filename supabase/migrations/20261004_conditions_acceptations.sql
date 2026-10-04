-- Acceptation des conditions d'utilisation : qui a accepté quelle version, et quand.
-- Une ligne par compte et par version (preuve de l'acceptation, art. 7 RGPD pour la trace,
-- et engagement de la section 16 des conditions : toute version substantielle se réaccepte).
-- Propre au compte, pas à la promo. Écriture seulement par accepter_conditions() : l'adresse
-- vient du jeton de connexion, impossible d'accepter au nom d'un autre.

create table public.conditions_acceptations (
  id bigserial primary key,
  email text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (email, version)
);

create index conditions_acceptations_email on public.conditions_acceptations (lower(email));

alter table public.conditions_acceptations enable row level security;

-- Chacun lit les siennes ; les admins lisent tout (savoir qui n'a pas encore accepté).
create policy conditions_acceptations_select on public.conditions_acceptations
  for select to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')) or (select public.is_admin()));

revoke all on public.conditions_acceptations from anon, public;
revoke insert, update, delete, truncate, references, trigger on public.conditions_acceptations from authenticated;
grant select on public.conditions_acceptations to authenticated;
revoke all on sequence public.conditions_acceptations_id_seq from anon, public, authenticated;

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
