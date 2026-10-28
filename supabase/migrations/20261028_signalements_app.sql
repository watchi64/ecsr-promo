-- Signaler un problème depuis l'app (chantier du 2026-10-28).
-- Spec : docs/superpowers/specs/2026-10-28-signaler-un-probleme-design.md (§ 7). Retour :
-- 20261028_signalements_app_retour.sql. Preuve : tests/sql/signalements-app-preuve.sql.
--
-- Un signalement : le message d'une personne connectée, le contexte joint d'office (page, appareil,
-- navigateur, version, erreurs récentes) et une capture facultative. Lu par la personne qui l'a envoyé et
-- par le fondateur (Timy, l'éditeur), et par personne d'autre. Aucune écriture directe : tout passe par
-- les fonctions ci-dessous, qui posent elles-mêmes l'auteur, son nom, son rôle et la promo affichée.
-- Droits écrits avec les fonctions actuelles (is_founder) : à reprendre par le lot 4 (rôles et portées).

-- 1. Signalements -----------------------------------------------------------------------------------
create table if not exists public.signalements_app (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- Fermer le compte efface ses signalements (anonymisation d'un stagiaire ou d'une promo comprise).
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  nom text,
  role text not null check (role in ('stagiaire', 'formateur', 'fondateur')),
  promo_id integer references public.promos(id) on delete set null,
  message text not null check (char_length(message) between 3 and 2000),
  contexte jsonb not null default '{}'::jsonb
    check (jsonb_typeof(contexte) = 'object' and octet_length(contexte::text) <= 16384),
  avec_capture boolean not null default false,
  statut text not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'regle', 'non_retenu')),
  reponse text check (reponse is null or char_length(reponse) between 1 and 2000),
  repondu_le timestamptz,
  -- Dernière avancée visible de la personne (statut ou réponse), et quand elle l'a vue.
  suivi_le timestamptz,
  suivi_lu_le timestamptz,
  traite_le timestamptz,
  traite_par_email text
);
create index if not exists signalements_app_user_idx on public.signalements_app (user_id, created_at desc);
create index if not exists signalements_app_statut_idx on public.signalements_app (statut);
create index if not exists signalements_app_created_idx on public.signalements_app (created_at);

-- 2. Captures : à part, pour qu'aucune liste ne charge une image sans le vouloir --------------------
create table if not exists public.signalements_app_captures (
  signalement_id bigint primary key references public.signalements_app(id) on delete cascade,
  image text not null check (char_length(image) <= 700000 and image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')
);

-- 3. Droits ------------------------------------------------------------------------------------------
alter table public.signalements_app enable row level security;
alter table public.signalements_app_captures enable row level security;

drop policy if exists signalements_app_select on public.signalements_app;
create policy signalements_app_select on public.signalements_app
  for select to authenticated using (user_id = (select auth.uid()) or (select is_founder()));
drop policy if exists signalements_app_delete on public.signalements_app;
create policy signalements_app_delete on public.signalements_app
  for delete to authenticated using ((select is_founder()));
drop policy if exists signalements_app_captures_select on public.signalements_app_captures;
create policy signalements_app_captures_select on public.signalements_app_captures
  for select to authenticated using (exists (
    select 1 from public.signalements_app s
     where s.id = signalement_id and (s.user_id = (select auth.uid()) or (select is_founder()))));

revoke all on public.signalements_app, public.signalements_app_captures from anon;
revoke insert, update, truncate, references, trigger on public.signalements_app from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.signalements_app_captures from authenticated;
grant select, delete on public.signalements_app to authenticated;
grant select on public.signalements_app_captures to authenticated;

-- 4. Envoyer : la base pose l'auteur, son nom affiché, son rôle et la promo affichée ----------------
-- Refus en « signalement: <phrase> », la phrase étant montrée telle quelle par l'app.
create or replace function public.signaler_probleme(p_message text, p_contexte jsonb default '{}'::jsonb, p_capture text default null)
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_profil user_profiles%rowtype;
  v_message text := btrim(coalesce(p_message, ''), E' \t\r\n');
  v_contexte jsonb := coalesce(p_contexte, '{}'::jsonb);
  v_nom text;
  v_role text;
  v_id bigint;
begin
  if v_uid is null or v_email is null then
    raise exception 'signalement: Reconnecte-toi pour signaler un problème.';
  end if;
  select * into v_profil from user_profiles where lower(email) = v_email limit 1;
  if not found then
    raise exception 'signalement: Reconnecte-toi pour signaler un problème.';
  end if;
  if char_length(v_message) < 3 then
    raise exception 'signalement: Écris quelques mots sur ce qui se passe.';
  end if;
  if char_length(v_message) > 2000 then
    raise exception 'signalement: 2 000 caractères au plus.';
  end if;
  if jsonb_typeof(v_contexte) <> 'object' then
    raise exception 'signalement: Le détail joint n''est pas lisible.';
  end if;
  if octet_length(v_contexte::text) > 16384 then
    raise exception 'signalement: Le détail joint est trop long.';
  end if;
  if p_capture is not null then
    if char_length(p_capture) > 700000 then
      raise exception 'signalement: La capture est trop lourde.';
    end if;
    if p_capture !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then
      raise exception 'signalement: La capture n''est pas une image valable.';
    end if;
  end if;
  if (select count(*) from signalements_app
       where user_id = v_uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'signalement: Tu as déjà envoyé 10 signalements aujourd''hui. Réessaie demain.';
  end if;

  v_role := case when v_profil.is_founder then 'fondateur'
                 when v_profil.role = 'stagiaire' then 'stagiaire'
                 else 'formateur' end;
  -- Le nom que l'app affiche : « V. Timy » pour un stagiaire (initiale du nom, prénom), le nom du
  -- formateur, sinon l'adresse.
  v_nom := coalesce(
    (select case when coalesce(btrim(s.nom), '') <> '' then upper(left(btrim(s.nom), 1)) || '. ' || s.prenom
                 else s.prenom end
       from stagiaires s where s.id = v_profil.stagiaire_id),
    (select p.nom from profs p where p.id = v_profil.prof_id),
    v_email);

  -- Conservation : douze mois au plus (spec § 7.3), purgés au passage.
  delete from signalements_app where created_at < now() - interval '12 months';

  insert into signalements_app (user_id, email, nom, role, promo_id, message, contexte, avec_capture)
  values (v_uid, v_email, v_nom, v_role, promo_courante(), v_message, v_contexte, p_capture is not null)
  returning id into v_id;
  if p_capture is not null then
    insert into signalements_app_captures (signalement_id, image) values (v_id, p_capture);
  end if;
  return v_id;
end;
$function$;

-- 5. Traiter (fondateur) : statut et réponse. Une avancée prévient la personne : statut changé vers En
-- cours, Réglé ou Pas retenu, ou réponse écrite ou modifiée. Repasser à Nouveau ne prévient pas.
create or replace function public.traiter_signalement_app(p_id bigint, p_statut text, p_reponse text)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  s signalements_app%rowtype;
  v_reponse text := nullif(btrim(coalesce(p_reponse, ''), E' \t\r\n'), '');
  v_avance boolean;
begin
  if not is_founder() then
    raise exception 'signalement: Réservé à l''éditeur.';
  end if;
  if p_statut is null or p_statut not in ('nouveau', 'en_cours', 'regle', 'non_retenu') then
    raise exception 'signalement: Statut inconnu.';
  end if;
  if char_length(coalesce(v_reponse, '')) > 2000 then
    raise exception 'signalement: 2 000 caractères au plus.';
  end if;
  select * into s from signalements_app where id = p_id for update;
  if not found then
    raise exception 'signalement: Signalement introuvable.';
  end if;
  v_avance := (p_statut is distinct from s.statut and p_statut <> 'nouveau')
           or (v_reponse is not null and v_reponse is distinct from s.reponse);
  update signalements_app
     set statut = p_statut,
         reponse = v_reponse,
         repondu_le = case when v_reponse is not distinct from s.reponse then s.repondu_le
                           when v_reponse is null then null
                           else now() end,
         suivi_le = case when v_avance then now() else s.suivi_le end,
         suivi_lu_le = case when v_avance then null else s.suivi_lu_le end,
         traite_le = now(),
         traite_par_email = lower(auth.jwt() ->> 'email')
   where id = p_id;
end;
$function$;

-- 6. La personne a vu la suite de ses signalements -----------------------------------------------
create or replace function public.marquer_suivis_vus()
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  n integer;
begin
  update signalements_app set suivi_lu_le = now()
   where user_id = auth.uid() and suivi_le is not null and suivi_lu_le is null;
  get diagnostics n = row_count;
  return n;
end;
$function$;

-- 7. Les dix plus récents de la personne connectée, celui qui vient d'avancer en tête. La règle de
-- lecture laisserait le fondateur tout voir : la fonction filtre sur le compte.
create or replace function public.mes_signalements_app()
returns table (id bigint, created_at timestamptz, message text, statut text, reponse text,
               repondu_le timestamptz, suivi_le timestamptz, suivi_lu_le timestamptz, avec_capture boolean)
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select s.id, s.created_at, s.message, s.statut, s.reponse, s.repondu_le, s.suivi_le, s.suivi_lu_le, s.avec_capture
    from signalements_app s
   where s.user_id = auth.uid()
   order by coalesce(s.suivi_le, s.created_at) desc, s.id desc
   limit 10;
$function$;

-- 8. Compteurs des pastilles : nouveaux (fondateur seulement, 0 sinon), suivis non vus de la personne.
create or replace function public.compter_signalements_app()
returns jsonb
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select jsonb_build_object(
    'nouveaux', case when is_founder() then (select count(*) from signalements_app where statut = 'nouveau') else 0 end,
    'suivis', (select count(*) from signalements_app
                where user_id = auth.uid() and suivi_le is not null and suivi_lu_le is null));
$function$;

revoke all on function public.signaler_probleme(text, jsonb, text) from public, anon;
revoke all on function public.traiter_signalement_app(bigint, text, text) from public, anon;
revoke all on function public.marquer_suivis_vus() from public, anon;
revoke all on function public.mes_signalements_app() from public, anon;
revoke all on function public.compter_signalements_app() from public, anon;
grant execute on function public.signaler_probleme(text, jsonb, text) to authenticated;
grant execute on function public.traiter_signalement_app(bigint, text, text) to authenticated;
grant execute on function public.marquer_suivis_vus() to authenticated;
grant execute on function public.mes_signalements_app() to authenticated;
grant execute on function public.compter_signalements_app() to authenticated;
