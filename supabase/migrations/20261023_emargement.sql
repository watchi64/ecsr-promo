-- Émargement numérique signé (spec docs/superpowers/specs/2026-10-23-emargement-design.md).
-- Trois tables propres à une promo ; AUCUNE écriture directe pour les comptes de l'app : tout
-- passe par les fonctions emargement_* (security definer), qui vérifient rôle, promo courante,
-- état de la feuille et jour. Les messages d'erreur commencent par « emargement: » ; l'app
-- affiche la phrase qui suit. Preuve : tests/sql/emargement-preuve.sql.
set local lock_timeout = '3s';

-- Une feuille = une demi-journée d'une promo.
create table public.emargement_seances (
  id bigserial primary key,
  promo_id integer not null references public.promos(id),
  jour date not null,
  demi_journee text not null check (demi_journee in ('matin', 'aprem')),
  debut text not null check (debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  fin text not null check (fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'close')),
  ouverte_le timestamptz not null default now(),
  ouverte_par text not null,
  close_le timestamptz,
  close_par text,
  unique (promo_id, jour, demi_journee),
  check (debut < fin),
  check ((statut = 'close') = (close_le is not null))
);

-- Une ligne au plus par stagiaire et par feuille : signature, absence, observation.
-- Pas de cascade depuis stagiaires : une fiche qui a signé ne se supprime pas par erreur.
create table public.emargement_lignes (
  id bigserial primary key,
  seance_id bigint not null references public.emargement_seances(id) on delete cascade,
  promo_id integer not null references public.promos(id),
  stagiaire_id integer not null references public.stagiaires(id),
  trace text check (trace is null or (length(trace) <= 20000
    and trace ~ '^(M[0-9]{1,3} [0-9]{1,3}(L[0-9]{1,3} [0-9]{1,3})*)+$')),
  signe_le timestamptz,
  signe_par text,
  sur_appareil_formateur boolean not null default false,
  absent boolean not null default false,
  absence_origine text check (absence_origine in ('formateur', 'planning', 'non_signe')),
  observation text check (observation is null or length(observation) <= 200),
  maj_le timestamptz not null default now(),
  maj_par text,
  unique (seance_id, stagiaire_id),
  check ((trace is null) = (signe_le is null) and (trace is null) = (signe_par is null)),
  check (not (absent and trace is not null)),
  check (absent = (absence_origine is not null))
);

create table public.emargement_formateurs (
  id bigserial primary key,
  seance_id bigint not null references public.emargement_seances(id) on delete cascade,
  promo_id integer not null references public.promos(id),
  nom text not null check (length(btrim(nom)) between 1 and 80),
  prof_id integer references public.profs(id) on delete set null,
  trace text not null check (length(trace) <= 20000
    and trace ~ '^(M[0-9]{1,3} [0-9]{1,3}(L[0-9]{1,3} [0-9]{1,3})*)+$'),
  signe_le timestamptz not null default now(),
  signe_par text not null
);

create unique index emargement_formateurs_nom on public.emargement_formateurs (seance_id, lower(nom));
create index emargement_lignes_stagiaire on public.emargement_lignes (stagiaire_id);
create index emargement_formateurs_seance on public.emargement_formateurs (seance_id);

-- Inaltérabilité : une signature posée ne change plus, même par une fonction serveur fautive.
-- Seule exception, pour une future migration d'effacement des données personnelles :
-- set_config('emargement.effacement', 'on', true) dans sa transaction.
create function public.emargement_signature_figee()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin
  if coalesce(current_setting('emargement.effacement', true), '') = 'on' then
    return new;
  end if;
  if tg_table_name = 'emargement_formateurs' then
    raise exception 'emargement: Une signature de formateur ne se modifie pas.';
  end if;
  if old.trace is not null and (
       new.trace is distinct from old.trace or new.signe_le is distinct from old.signe_le
       or new.signe_par is distinct from old.signe_par
       or new.sur_appareil_formateur is distinct from old.sur_appareil_formateur
       or new.stagiaire_id is distinct from old.stagiaire_id or new.seance_id is distinct from old.seance_id) then
    raise exception 'emargement: Une signature ne se modifie pas.';
  end if;
  return new;
end;
$function$;

create trigger emargement_lignes_figee before update on public.emargement_lignes
  for each row execute function public.emargement_signature_figee();
create trigger emargement_formateurs_figee before update on public.emargement_formateurs
  for each row execute function public.emargement_signature_figee();

-- Lecture : feuilles de la promo pour tous ; lignes pour les formateurs et le stagiaire
-- concerné ; signatures de formateurs pour les formateurs.
alter table public.emargement_seances enable row level security;
alter table public.emargement_lignes enable row level security;
alter table public.emargement_formateurs enable row level security;

create policy emargement_seances_select on public.emargement_seances
  for select to authenticated
  using (promo_id = (select public.promo_courante()));

create policy emargement_lignes_select on public.emargement_lignes
  for select to authenticated
  using (promo_id = (select public.promo_courante())
         and ((select public.is_admin()) or (select public.is_prof())
              or stagiaire_id = (select public.my_stagiaire_id())));

create policy emargement_formateurs_select on public.emargement_formateurs
  for select to authenticated
  using (promo_id = (select public.promo_courante())
         and ((select public.is_admin()) or (select public.is_prof())));

revoke all on public.emargement_seances, public.emargement_lignes, public.emargement_formateurs from anon, public;
revoke insert, update, delete, truncate, references, trigger
  on public.emargement_seances, public.emargement_lignes, public.emargement_formateurs from authenticated;
grant select on public.emargement_seances, public.emargement_lignes, public.emargement_formateurs to authenticated;
revoke all on sequence public.emargement_seances_id_seq, public.emargement_lignes_id_seq,
  public.emargement_formateurs_id_seq from anon, public, authenticated;
revoke all on function public.emargement_signature_figee() from anon, public, authenticated;

-- Outils internes des fonctions ci-dessous (non exposés).
create function public.emargement_jour_paris()
returns date language sql stable set search_path to 'public', 'pg_temp' as $function$
  select (now() at time zone 'Europe/Paris')::date;
$function$;

create function public.emargement_trace_valide(p_trace text)
returns boolean language sql immutable set search_path to 'public', 'pg_temp' as $function$
  select p_trace is not null and length(p_trace) between 1 and 20000
     and p_trace ~ '^(M[0-9]{1,3} [0-9]{1,3}(L[0-9]{1,3} [0-9]{1,3})*)+$';
$function$;

-- Contrôles communs : connecté, formateur si demandé, feuille de la promo courante (verrouillée).
create function public.emargement_feuille(p_seance bigint, p_formateur boolean)
returns public.emargement_seances language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  s emargement_seances;
begin
  if auth.jwt() ->> 'email' is null then
    raise exception 'emargement: Connexion requise.';
  end if;
  if p_formateur and not (is_admin() or is_prof()) then
    raise exception 'emargement: Réservé aux formateurs.';
  end if;
  select * into s from emargement_seances
   where id = p_seance and promo_id = promo_courante()
   for update;
  if not found then
    raise exception 'emargement: Feuille introuvable dans cette promo.';
  end if;
  return s;
end;
$function$;

revoke all on function public.emargement_jour_paris(), public.emargement_trace_valide(text),
  public.emargement_feuille(bigint, boolean) from anon, public, authenticated;

-- Ouvrir la feuille d'une demi-journée du jour. Déjà ouverte : rend son id (double appui).
create function public.emargement_ouvrir(p_demi text, p_debut text, p_fin text)
returns bigint language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_promo integer := promo_courante();
  v_jour date := emargement_jour_paris();
  v_id bigint;
  v_statut text;
begin
  if v_email is null then
    raise exception 'emargement: Connexion requise.';
  end if;
  if not (is_admin() or is_prof()) then
    raise exception 'emargement: Réservé aux formateurs.';
  end if;
  if v_promo is null then
    raise exception 'emargement: Promo introuvable.';
  end if;
  if p_demi is null or p_demi not in ('matin', 'aprem') then
    raise exception 'emargement: Demi-journée inconnue.';
  end if;
  if coalesce(p_debut, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(p_fin, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_debut >= p_fin then
    raise exception 'emargement: Horaires invalides : le début doit précéder la fin.';
  end if;
  insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par)
  values (v_promo, v_jour, p_demi, p_debut, p_fin, v_email)
  on conflict (promo_id, jour, demi_journee) do nothing
  returning id into v_id;
  if v_id is not null then
    return v_id;
  end if;
  select id, statut into v_id, v_statut from emargement_seances
   where promo_id = v_promo and jour = v_jour and demi_journee = p_demi;
  if v_statut = 'close' then
    raise exception 'emargement: Cette feuille est close : rouvre-la pour la compléter.';
  end if;
  return v_id;
end;
$function$;

-- Signer : un stagiaire pour lui-même, ou un formateur pour un stagiaire, sur son appareil.
create function public.emargement_signer(p_seance bigint, p_stagiaire integer, p_trace text)
returns timestamptz language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, false);
  v_appareil boolean;
  v_quand timestamptz;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: La feuille est close.';
  end if;
  if s.jour <> emargement_jour_paris() then
    raise exception 'emargement: Une feuille ne se signe que le jour même.';
  end if;
  if p_stagiaire is not null and p_stagiaire = my_stagiaire_id() then
    v_appareil := false;
  elsif is_admin() or is_prof() then
    v_appareil := true;
  else
    raise exception 'emargement: Tu ne peux signer que pour toi.';
  end if;
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id and actif) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if not emargement_trace_valide(p_trace) then
    raise exception 'emargement: Signature illisible, recommence.';
  end if;
  if exists (select 1 from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire and absent) then
    raise exception 'emargement: Noté absent : un formateur doit d''abord retirer l''absence.';
  end if;
  insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par,
                                 sur_appareil_formateur, maj_par)
  values (s.id, s.promo_id, p_stagiaire, p_trace, now(), v_email, v_appareil, v_email)
  on conflict (seance_id, stagiaire_id) do update
    set trace = excluded.trace, signe_le = excluded.signe_le, signe_par = excluded.signe_par,
        sur_appareil_formateur = excluded.sur_appareil_formateur, maj_le = now(), maj_par = excluded.maj_par
    where emargement_lignes.trace is null and not emargement_lignes.absent
  returning signe_le into v_quand;
  if v_quand is null then
    raise exception 'emargement: Déjà signé.';
  end if;
  return v_quand;
end;
$function$;

-- Signature d'un formateur (nom imprimé sur la feuille).
create function public.emargement_signer_formateur(p_seance bigint, p_nom text, p_trace text)
returns timestamptz language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  v_nom text := btrim(coalesce(p_nom, ''));
  v_prof integer;
  v_quand timestamptz;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: La feuille est close.';
  end if;
  if s.jour <> emargement_jour_paris() then
    raise exception 'emargement: Une feuille ne se signe que le jour même.';
  end if;
  if length(v_nom) not between 1 and 80 then
    raise exception 'emargement: Nom du formateur requis.';
  end if;
  if not emargement_trace_valide(p_trace) then
    raise exception 'emargement: Signature illisible, recommence.';
  end if;
  -- Fiche formateur reliée seulement si le nom est celui du compte qui signe.
  select pr.id into v_prof from user_profiles up join profs pr on pr.id = up.prof_id
   where lower(up.email) = v_email and lower(pr.nom) = lower(v_nom);
  insert into emargement_formateurs (seance_id, promo_id, nom, prof_id, trace, signe_par)
  values (s.id, s.promo_id, v_nom, v_prof, p_trace, v_email)
  on conflict (seance_id, lower(nom)) do nothing
  returning signe_le into v_quand;
  if v_quand is null then
    raise exception 'emargement: Ce formateur a déjà signé cette feuille.';
  end if;
  return v_quand;
end;
$function$;

-- Absence (feuille ouverte, ligne non signée) et observation (toujours). p_absent nul :
-- absence inchangée ; p_observation nulle : inchangée, vide : effacée.
create function public.emargement_annoter(p_seance bigint, p_stagiaire integer, p_absent boolean, p_observation text)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  l emargement_lignes;
  v_obs text := nullif(btrim(p_observation), '');
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if length(v_obs) > 200 then
    raise exception 'emargement: Observation trop longue (200 caractères au plus).';
  end if;
  select * into l from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire for update;
  if p_absent is not null then
    if s.statut <> 'ouverte' then
      raise exception 'emargement: La feuille est close : rouvre-la pour changer une absence.';
    end if;
    if p_absent and l.trace is not null then
      raise exception 'emargement: Déjà signé : ajoute plutôt une observation.';
    end if;
  end if;
  if l.id is null then
    if p_absent is not true and v_obs is null then
      return;  -- rien à noter
    end if;
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, observation, maj_par)
    values (s.id, s.promo_id, p_stagiaire, coalesce(p_absent, false),
            case when p_absent then 'formateur' end, v_obs, v_email);
    return;
  end if;
  update emargement_lignes
     set absent = coalesce(p_absent, absent),
         absence_origine = case when p_absent is null then absence_origine
                                when p_absent then 'formateur' end,
         observation = case when p_observation is null then observation else v_obs end,
         maj_le = now(), maj_par = v_email
   where id = l.id;
  delete from emargement_lignes
   where id = l.id and trace is null and not absent and observation is null;
end;
$function$;

-- Clore : il faut au moins une signature de formateur ; tout stagiaire actif sans signature
-- devient absent (origine planning s'il est noté absent sur une carte de la demi-journée).
-- Permis un autre jour (feuille oubliée). Rend le nombre d'absences posées.
create function public.emargement_clore(p_seance bigint)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  v_jour_index integer;
  v_n integer;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: Cette feuille est déjà close.';
  end if;
  if not exists (select 1 from emargement_formateurs where seance_id = s.id) then
    raise exception 'emargement: Il manque la signature du formateur.';
  end if;
  v_jour_index := extract(isodow from s.jour)::integer - 1;
  with planning as (
    select distinct case when (a ->> 'sid') ~ '^[0-9]{1,9}$' then (a ->> 'sid')::integer end as sid
      from planning_entries pe
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(pe.absences) = 'array' then pe.absences else '[]'::jsonb end) a
     where pe.promo_id = s.promo_id
       and pe.semaine_lundi = s.jour - v_jour_index
       and pe.day_index = v_jour_index
       and pe.half_day = s.demi_journee
  ), absents as (
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, maj_par)
    select s.id, s.promo_id, st.id, true,
           case when st.id in (select sid from planning where sid is not null) then 'planning' else 'non_signe' end,
           v_email
      from stagiaires st
     where st.promo_id = s.promo_id and st.actif
    on conflict (seance_id, stagiaire_id) do update
      set absent = true, absence_origine = excluded.absence_origine, maj_le = now(), maj_par = excluded.maj_par
      where emargement_lignes.trace is null and not emargement_lignes.absent
    returning 1
  )
  select count(*) into v_n from absents;
  update emargement_seances set statut = 'close', close_le = now(), close_par = v_email where id = s.id;
  return v_n;
end;
$function$;

-- Rouvrir, le jour même seulement : les absences posées par la clôture s'effacent.
create function public.emargement_rouvrir(p_seance bigint)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  s emargement_seances := emargement_feuille(p_seance, true);
begin
  if s.statut <> 'close' then
    raise exception 'emargement: Cette feuille est déjà ouverte.';
  end if;
  if s.jour <> emargement_jour_paris() then
    raise exception 'emargement: Une feuille ne se rouvre que le jour même.';
  end if;
  update emargement_lignes set absent = false, absence_origine = null, maj_le = now(),
         maj_par = lower(auth.jwt() ->> 'email')
   where seance_id = s.id and absence_origine in ('planning', 'non_signe');
  delete from emargement_lignes
   where seance_id = s.id and trace is null and not absent and observation is null;
  update emargement_seances set statut = 'ouverte', close_le = null, close_par = null where id = s.id;
end;
$function$;

revoke all on function public.emargement_ouvrir(text, text, text),
  public.emargement_signer(bigint, integer, text),
  public.emargement_signer_formateur(bigint, text, text),
  public.emargement_annoter(bigint, integer, boolean, text),
  public.emargement_clore(bigint),
  public.emargement_rouvrir(bigint) from anon, public;
grant execute on function public.emargement_ouvrir(text, text, text),
  public.emargement_signer(bigint, integer, text),
  public.emargement_signer_formateur(bigint, text, text),
  public.emargement_annoter(bigint, integer, boolean, text),
  public.emargement_clore(bigint),
  public.emargement_rouvrir(bigint) to authenticated;
