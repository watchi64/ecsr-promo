-- Effacement et anonymisation des données personnelles (conditions d'utilisation, sections
-- 7, 10 et 12 ; registre des traitements). Spec : docs/superpowers/specs/2026-10-05-effacement-donnees-design.md
--
-- Principe : on n'efface pas la fiche d'un stagiaire (ses notes, QCM, passages et EPCF lui
-- sont liés en cascade, les supprimer fausserait les statistiques), on l'ANONYMISE : tout ce
-- qui identifie la personne disparaît, ses résultats restent sous « Anonyme <n> ».
--
-- 1. stagiaires.anonymise_le : date de l'anonymisation (null = fiche nominative).
-- 2. effacements_journal : trace de chaque effacement (qui l'a fait, quand, combien de
--    lignes), sans aucune donnée personnelle de la personne effacée.
-- 3. _anonymiser_stagiaire(id) : le cœur, interne (aucun droit d'appel depuis l'app).
-- 4. anonymiser_stagiaire(id) : admin, promo affichée, stagiaire déjà marqué en abandon.
-- 5. etat_anonymisation_promo() / anonymiser_promo() : fin de promo + 12 mois.
-- 6. benevoles_a_purger() / purger_benevoles(ids) : sans venue depuis 12 mois.

alter table public.stagiaires add column anonymise_le timestamptz;

create table public.effacements_journal (
  id bigserial primary key,
  type text not null check (type in ('stagiaire', 'promo', 'benevoles')),
  cible text not null,          -- « stagiaire 12 », « promo 1 », « lieu 1 » : jamais un nom
  fait_par_email text not null,
  fait_le timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
alter table public.effacements_journal enable row level security;
create policy effacements_journal_select on public.effacements_journal
  for select to authenticated using ((select public.is_admin()));
revoke all on public.effacements_journal from anon, public;
revoke insert, update, delete, truncate, references, trigger on public.effacements_journal from authenticated;
grant select on public.effacements_journal to authenticated;
revoke all on sequence public.effacements_journal_id_seq from anon, public, authenticated;

-- 3. Cœur de l'anonymisation ------------------------------------------------------------
create or replace function public._anonymiser_stagiaire(p_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare
  s record;
  v_emails text[];
  v_noms text[];          -- formes sous lesquelles la personne apparaît dans les champs « qui »
  v_remplace constant text := 'Stagiaire anonyme';
  v_n jsonb := '{}'::jsonb;
  n integer;
  x text;
begin
  select * into s from stagiaires where id = p_id for update;
  if not found then raise exception 'Stagiaire introuvable'; end if;
  if s.anonymise_le is not null then return jsonb_build_object('deja', true); end if;

  if exists (select 1 from user_profiles where stagiaire_id = p_id and (is_admin or is_founder)) then
    raise exception 'Compte administrateur : anonymisation refusée (retirer d''abord le droit admin)';
  end if;

  select coalesce(array_agg(distinct lower(email)), '{}') into v_emails
    from user_profiles where stagiaire_id = p_id;
  -- Nom affiché dans l'app (« V. Timy », cf. displayStagiaire) et e-mails (repli de getProfileWho).
  v_noms := array[case when coalesce(trim(s.nom), '') <> ''
                       then upper(left(trim(s.nom), 1)) || '. ' || s.prenom else s.prenom end]
            || v_emails;

  -- Documents et données privées : supprimés.
  delete from stagiaires_prive where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('date_naissance', n);
  delete from dp_dossiers where stagiaire_id = p_id;      get diagnostics n = row_count; v_n := v_n || jsonb_build_object('dossier_pro', n);
  delete from epcf_livrets where stagiaire_id = p_id;     get diagnostics n = row_count; v_n := v_n || jsonb_build_object('livret', n);
  delete from fiches_suivi where stagiaire_id = p_id;     get diagnostics n = row_count; v_n := v_n || jsonb_build_object('fiche_suivi', n);

  -- Résultats conservés, textes libres vidés (ils peuvent contenir un prénom, une santé…).
  -- (epcf_evaluations.contexte n'est pas un texte libre : c'est un code, « EPCF ».)
  update epcf_evaluations set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('epcf_textes', n);
  update evaluations set observation = null where stagiaire_id = p_id and observation is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('observations', n);
  update passages set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('commentaires_passages', n);

  -- E-mails de la personne, partout où ils servent de signature.
  if cardinality(v_emails) > 0 then
    update evaluations set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update evaluations set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update evaluations_audit set changed_by_email = 'anonyme' where lower(changed_by_email) = any(v_emails);
    update agenda_events set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update qcm_signalements set email = 'anonyme' where lower(email) = any(v_emails);
    update themes set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update themes_progression set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update user_profiles set invited_by_email = 'anonyme' where lower(invited_by_email) = any(v_emails);
    delete from conditions_acceptations where lower(email) = any(v_emails);
  end if;

  -- Champs « qui a fait la modification » (nom affiché ou e-mail).
  update passages set created_by_who = v_remplace where created_by_who = any(v_noms);
  update passages set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update passages_audit set changed_by_who = v_remplace where changed_by_who = any(v_noms);
  update epcf_evaluations set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update planning_jours_off set created_by_who = v_remplace where created_by_who = any(v_noms);

  -- Historiques : les mêmes valeurs dans les instantanés JSON (valeurs exactes entre guillemets).
  foreach x in array v_noms loop
    update passages_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
    update evaluations_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
  end loop;

  -- Les historiques gardent une copie des lignes : on y vide aussi les textes libres.
  update evaluations_audit
     set before_data = case when before_data ? 'observation' then jsonb_set(before_data, '{observation}', 'null') else before_data end,
         after_data  = case when after_data  ? 'observation' then jsonb_set(after_data,  '{observation}', 'null') else after_data end
   where (before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id;
  update passages_audit
     set before_data = case when before_data ? 'commentaire' then jsonb_set(before_data, '{commentaire}', 'null') else before_data end,
         after_data  = case when after_data  ? 'commentaire' then jsonb_set(after_data,  '{commentaire}', 'null') else after_data end
   where (before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id;

  -- Compte : profil puis compte de connexion (sessions, compteur de l'assistant en cascade).
  delete from user_profiles where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('profils', n);
  if cardinality(v_emails) > 0 then
    delete from auth.users where lower(email) = any(v_emails); get diagnostics n = row_count;
    v_n := v_n || jsonb_build_object('comptes', n);
  end if;

  update stagiaires
     set prenom = 'Anonyme ' || p_id, nom = null, actif = false, date_naissance = null, anonymise_le = now()
   where id = p_id;

  return v_n;
end;
$function$;
revoke all on function public._anonymiser_stagiaire(integer) from anon, public, authenticated;

-- 4. À la demande d'un stagiaire ---------------------------------------------------------
create or replace function public.anonymiser_stagiaire(p_stagiaire_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v jsonb;
begin
  if not is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Ce stagiaire n''appartient pas à la promo affichée';
  end if;
  if exists (select 1 from stagiaires where id = p_stagiaire_id and actif) then
    raise exception 'Marquez d''abord ce stagiaire en abandon';
  end if;
  v := _anonymiser_stagiaire(p_stagiaire_id);
  if not coalesce((v ->> 'deja')::boolean, false) then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('stagiaire', 'stagiaire ' || p_stagiaire_id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;
revoke all on function public.anonymiser_stagiaire(integer) from anon, public;
grant execute on function public.anonymiser_stagiaire(integer) to authenticated;

-- 5. Fin de promo + 12 mois ---------------------------------------------------------------
create or replace function public.etat_anonymisation_promo()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare
  p record;
begin
  if not is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select * into p from promos where id = promo_courante();
  if not found then return null; end if;
  return jsonb_build_object(
    'promo_id', p.id,
    'nom', p.nom,
    'date_fin', p.date_fin,
    'anonymisable_le', case when p.date_fin is null then null else (p.date_fin + interval '12 months')::date end,
    'anonymisable', p.date_fin is not null and current_date >= (p.date_fin + interval '12 months')::date,
    'restants', (select count(*) from stagiaires where promo_id = p.id and anonymise_le is null),
    'comptes_admin', (select count(*) from stagiaires s where s.promo_id = p.id and s.anonymise_le is null
                        and exists (select 1 from user_profiles u where u.stagiaire_id = s.id and (u.is_admin or u.is_founder))),
    'anonymises', (select count(*) from stagiaires where promo_id = p.id and anonymise_le is not null)
  );
end;
$function$;
revoke all on function public.etat_anonymisation_promo() from anon, public;
grant execute on function public.etat_anonymisation_promo() to authenticated;

create or replace function public.anonymiser_promo()
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  p record;
  s record;
  v_faits integer := 0;
  v_ignores integer := 0;
begin
  if not is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select * into p from promos where id = promo_courante();
  if not found then raise exception 'Aucune promo affichée'; end if;
  if p.date_fin is null then raise exception 'Date de fin de promo non renseignée'; end if;
  if current_date < (p.date_fin + interval '12 months')::date then
    raise exception 'Anonymisation possible à partir du %', to_char((p.date_fin + interval '12 months')::date, 'DD/MM/YYYY');
  end if;
  for s in select id from stagiaires where promo_id = p.id and anonymise_le is null order by id loop
    if exists (select 1 from user_profiles u where u.stagiaire_id = s.id and (u.is_admin or u.is_founder)) then
      v_ignores := v_ignores + 1;
      continue;
    end if;
    perform _anonymiser_stagiaire(s.id);
    v_faits := v_faits + 1;
  end loop;
  insert into effacements_journal (type, cible, fait_par_email, details)
  values ('promo', 'promo ' || p.id, lower(auth.jwt() ->> 'email'),
          jsonb_build_object('anonymises', v_faits, 'comptes_admin_ignores', v_ignores));
  return jsonb_build_object('anonymises', v_faits, 'comptes_admin_ignores', v_ignores);
end;
$function$;
revoke all on function public.anonymiser_promo() from anon, public;
grant execute on function public.anonymiser_promo() to authenticated;

-- 6. Élèves bénévoles sans venue depuis 12 mois -------------------------------------------
-- Dernière venue = dernier créneau du planning (toutes promos du lieu) qui le cite ; à défaut,
-- sa date d'enregistrement : un élève ajouté il y a moins d'un an n'est jamais proposé.
create or replace function public.benevoles_a_purger()
returns table (id integer, display text, derniere_venue date)
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with venues as (
    select b.id,
           max(pe.semaine_lundi + pe.day_index) as derniere
      from benevoles b
      left join planning_entries pe
        on b.id = any(pe.benevoles_ids)
       and pe.promo_id in (select pr.id from promos pr where pr.lieu_id = b.lieu_id)
     where b.lieu_id = lieu_courant()
     group by b.id
  )
  select b.id,
         case when coalesce(trim(b.nom), '') <> '' then upper(left(trim(b.nom), 1)) || '. ' || b.prenom else b.prenom end,
         v.derniere
    from benevoles b join venues v on v.id = b.id
   where is_admin()
     and coalesce(v.derniere, b.created_at::date) < (current_date - interval '12 months')::date
   order by coalesce(v.derniere, b.created_at::date);
$function$;
revoke all on function public.benevoles_a_purger() from anon, public;
grant execute on function public.benevoles_a_purger() to authenticated;

create or replace function public.purger_benevoles(p_ids integer[])
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_ids integer[];
  n integer;
begin
  if not is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  -- Seuls ceux qui sont réellement éligibles en ce moment, dans le lieu affiché.
  select coalesce(array_agg(id), '{}') into v_ids
    from benevoles_a_purger() where id = any(coalesce(p_ids, '{}'));
  if cardinality(v_ids) = 0 then return 0; end if;
  update planning_entries pe
     set benevoles_ids = (select coalesce(array_agg(x), '{}') from unnest(pe.benevoles_ids) x where x <> all(v_ids))
   where pe.benevoles_ids && v_ids;
  delete from benevoles where id = any(v_ids);   -- benevole_suivi suit en cascade
  get diagnostics n = row_count;
  insert into effacements_journal (type, cible, fait_par_email, details)
  values ('benevoles', 'lieu ' || lieu_courant(), lower(auth.jwt() ->> 'email'), jsonb_build_object('supprimes', n));
  return n;
end;
$function$;
revoke all on function public.purger_benevoles(integer[]) from anon, public;
grant execute on function public.purger_benevoles(integer[]) to authenticated;
