-- Marche arrière de 20261028_roles_2_fonctions.sql (étape 2 du lot 4 : fonctions par rôle et par portée).
-- Remet dans leur définition d'avant le lot 4 les 21 fonctions que l'étape 2 modifie, supprime les trois
-- fonctions qu'elle crée, et recrée mes_promos() à l'ancienne (l'étape 2 change son type de retour), avec ses droits.
--
-- Fichier généré depuis la base de production le 2026-10-28, en lecture seule, la dernière migration appliquée
-- étant alors 20261027135732 (illustration_c34_v2). Chaque définition est le texte exact rendu par
-- pg_get_functiondef (sans son saut de ligne final), suivi d'un point-virgule. Requête de relevé :
--   select pg_get_functiondef(p.oid)
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('peut_acceder_promo', 'promo_par_defaut', 'promo_courante', 'my_stagiaire_id',
--                        'notes_stagiaires_visibles', 'is_admin', 'is_prof', 'is_founder', 'emargement_feuille',
--                        'emargement_ouvrir', 'emargement_signer', 'anonymiser_promo', 'anonymiser_stagiaire',
--                        'etat_anonymisation_promo', 'set_date_naissance', 'venues_benevoles', 'benevoles_a_purger',
--                        'purger_benevoles', 'accepter_brouillon_ia', 'rejeter_brouillon_ia', '_anonymiser_stagiaire', 'mes_promos');
-- Chaque nom désigne une seule fonction de public (aucune surcharge) ; aucune définition ne contient de retour
-- chariot. Les 21 fonctions existent déjà : create or replace leur laisse leur propriétaire et leurs droits
-- d'exécution, ceux de la production.
--
-- Ordre : les anciennes définitions d'abord, puis la suppression des nouvelles fonctions, puis mes_promos.
-- À passer après 20261028_roles_3_regles_retour.sql et avant 20261028_roles_1_fondations_retour.sql.
-- Contrôle : après les retours 3, 2 et 1, tests/sql/roles-empreinte.sql redonne l'empreinte relevée juste avant
-- d'appliquer le lot (ou au début du bloc de répétition) ; après ce seul retour, le vocabulaire de l'étape 1 fait
-- encore différer la colonne fonctions.
-- Recette de génération, à rejouer si la production a bougé : tests/sql/roles-retours-recette.sql.
set local lock_timeout = '3s';

-- 1. Les 21 fonctions modifiées par l'étape 2, dans leur définition d'avant le lot 4.

-- peut_acceder_promo(p integer)
CREATE OR REPLACE FUNCTION public.peut_acceder_promo(p integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from promos pr where pr.id = p)
     and exists (
       select 1 from user_profiles up
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and (   up.is_founder
              or up.role in ('prof', 'admin')
              or exists (select 1 from stagiaires s
                          where s.id = up.stagiaire_id and s.promo_id = p))
     );
$function$;

-- promo_par_defaut()
CREATE OR REPLACE FUNCTION public.promo_par_defaut()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with moi as (
    select up.stagiaire_id, (up.is_founder or up.role in ('prof', 'admin')) as tout_voir
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id),
    (select pr.id from promos pr, moi
      where moi.tout_voir and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr, moi
      where moi.tout_voir
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$function$;

-- promo_courante()
CREATE OR REPLACE FUNCTION public.promo_courante()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  brut text := nullif(current_setting('request.headers', true), '');
  entete text;
begin
  if brut is not null then
    -- En-têtes illisibles : aucune promo (PostgREST envoie toujours un JSON valide).
    if not pg_input_is_valid(brut, 'jsonb') then
      return null;
    end if;
    entete := brut::jsonb ->> 'x-promo-id';
  end if;
  if entete is null or entete = '' then
    return promo_par_defaut();
  end if;
  if entete ~ '^[0-9]{1,9}$' and peut_acceder_promo(entete::integer) then
    return entete::integer;
  end if;
  return null;
end;
$function$;

-- my_stagiaire_id()
CREATE OR REPLACE FUNCTION public.my_stagiaire_id()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select up.stagiaire_id from user_profiles up
  join stagiaires s on s.id = up.stagiaire_id
  where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    and s.promo_id = promo_courante()
  limit 1;
$function$;

-- notes_stagiaires_visibles()
CREATE OR REPLACE FUNCTION public.notes_stagiaires_visibles()
 RETURNS SETOF integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with moi as (
    select coalesce(bool_or(up.anonymous_notes), false) as anonyme
      from user_profiles up
     where lower(up.email) = lower((select auth.jwt() ->> 'email'))
  )
  select s.id
    from stagiaires s, moi
   where s.promo_id = promo_courante()
     and (
       is_admin() or is_prof()
       or s.id = my_stagiaire_id()
       or (not moi.anonyme
           and not exists (select 1 from user_profiles up2
                            where up2.stagiaire_id = s.id and up2.anonymous_notes))
     );
$function$;

-- is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from user_profiles
    where lower(email) = lower((select auth.jwt() ->> 'email'))
      and is_admin = true
  );
$function$;

-- is_prof()
CREATE OR REPLACE FUNCTION public.is_prof()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from user_profiles
    where lower(email) = lower((select auth.jwt() ->> 'email'))
      and role = 'prof'
  );
$function$;

-- is_founder()
CREATE OR REPLACE FUNCTION public.is_founder()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from user_profiles
    where lower(email) = lower((select auth.jwt() ->> 'email'))
      and is_founder = true
  );
$function$;

-- emargement_feuille(p_seance bigint, p_formateur boolean)
CREATE OR REPLACE FUNCTION public.emargement_feuille(p_seance bigint, p_formateur boolean)
 RETURNS emargement_seances
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- emargement_ouvrir(p_demi text, p_debut text, p_fin text)
CREATE OR REPLACE FUNCTION public.emargement_ouvrir(p_demi text, p_debut text, p_fin text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- Interrupteur par promo (réglage emargement_actif, posé par le fondateur dans Paramètres).
  if not exists (select 1 from settings where promo_id = v_promo and key = 'emargement_actif' and value = 'true') then
    raise exception 'emargement: L''émargement n''est pas activé pour cette promo.';
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

-- emargement_signer(p_seance bigint, p_stagiaire integer, p_trace text)
CREATE OR REPLACE FUNCTION public.emargement_signer(p_seance bigint, p_stagiaire integer, p_trace text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- anonymiser_promo()
CREATE OR REPLACE FUNCTION public.anonymiser_promo()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- anonymiser_stagiaire(p_stagiaire_id integer)
CREATE OR REPLACE FUNCTION public.anonymiser_stagiaire(p_stagiaire_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- etat_anonymisation_promo()
CREATE OR REPLACE FUNCTION public.etat_anonymisation_promo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- set_date_naissance(p_stagiaire_id integer, p_date date)
CREATE OR REPLACE FUNCTION public.set_date_naissance(p_stagiaire_id integer, p_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Non autorise : ce stagiaire n''appartient pas a la promo affichee';
  end if;
  if not (is_admin() or is_prof() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  insert into stagiaires_prive (stagiaire_id, date_naissance, updated_at)
  values (p_stagiaire_id, p_date, now())
  on conflict (stagiaire_id) do update set date_naissance = excluded.date_naissance, updated_at = now();
end;
$function$;

-- venues_benevoles()
CREATE OR REPLACE FUNCTION public.venues_benevoles()
 RETURNS TABLE(promo_id integer, promo_nom text, semaine_lundi date, day_index integer, half_day text, sujet text, eleves_ids integer[], benevoles_ids integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select pe.promo_id, pr.nom, pe.semaine_lundi, pe.day_index, pe.half_day, pe.sujet,
         pe.eleves_ids, pe.benevoles_ids
  from planning_entries pe
  join promos pr on pr.id = pe.promo_id
  where is_admin()
    and pr.lieu_id = lieu_courant()
    and peut_acceder_promo(pe.promo_id)
    and pe.benevoles_ids <> '{}'
  order by pe.semaine_lundi desc, pe.day_index;
$function$;

-- benevoles_a_purger()
CREATE OR REPLACE FUNCTION public.benevoles_a_purger()
 RETURNS TABLE(id integer, display text, derniere_venue date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- purger_benevoles(p_ids integer[])
CREATE OR REPLACE FUNCTION public.purger_benevoles(p_ids integer[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- accepter_brouillon_ia(p_brouillon_id bigint, p_section text, p_enonce text, p_explication text, p_options jsonb)
CREATE OR REPLACE FUNCTION public.accepter_brouillon_ia(p_brouillon_id bigint, p_section text, p_enonce text, p_explication text, p_options jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b qcm_ia_brouillons%rowtype;
  v_qid bigint;
  v_nom text;
  v_nb integer;
  v_bonnes integer;
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if not is_admin() then
    raise exception 'Réservé aux formateurs' using errcode = '42501';
  end if;
  select * into b from qcm_ia_brouillons where id = p_brouillon_id for update;
  if not found then raise exception 'Brouillon introuvable'; end if;
  if b.statut <> 'a_relire' then raise exception 'Ce brouillon a déjà été traité'; end if;
  if coalesce(trim(p_enonce), '') = '' then raise exception 'L''énoncé est requis'; end if;
  if jsonb_typeof(coalesce(p_options, 'null'::jsonb)) <> 'array' then
    raise exception 'Réponses illisibles';
  end if;

  select count(*), count(*) filter (where coalesce((e->>'is_correct')::boolean, false))
    into v_nb, v_bonnes
    from jsonb_array_elements(p_options) e
   where coalesce(trim(e->>'texte'), '') <> '';
  if v_nb < 2 then raise exception 'Ajoute au moins deux réponses'; end if;
  if v_bonnes < 1 then raise exception 'Coche au moins une bonne réponse'; end if;

  select coalesce(p.nom, s.prenom, up.email) into v_nom
    from user_profiles up
    left join profs p on p.id = up.prof_id
    left join stagiaires s on s.id = up.stagiaire_id
   where lower(up.email) = v_email
   limit 1;

  insert into qcm_questions (qcm_id, section, enonce, explication, ordre,
                             ia_brouillon_id, ia_validee_par, ia_validee_le)
  values (b.qcm_id, nullif(trim(p_section), ''), trim(p_enonce), nullif(trim(p_explication), ''),
          (select coalesce(max(ordre) + 1, 0) from qcm_questions where qcm_id = b.qcm_id),
          b.id, coalesce(v_nom, v_email), now())
  returning id into v_qid;

  insert into qcm_options (question_id, texte, is_correct, ordre)
  select v_qid, trim(e.value->>'texte'), coalesce((e.value->>'is_correct')::boolean, false),
         (row_number() over (order by e.n) - 1)::integer
    from jsonb_array_elements(p_options) with ordinality as e(value, n)
   where coalesce(trim(e.value->>'texte'), '') <> '';

  update qcm_ia_brouillons
     set statut = 'acceptee', traite_par_email = v_email, traite_le = now()
   where id = b.id;
  return v_qid;
end $function$;

-- rejeter_brouillon_ia(p_brouillon_id bigint)
CREATE OR REPLACE FUNCTION public.rejeter_brouillon_ia(p_brouillon_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then
    raise exception 'Réservé aux formateurs' using errcode = '42501';
  end if;
  update qcm_ia_brouillons
     set statut = 'rejetee', traite_par_email = lower(auth.jwt() ->> 'email'), traite_le = now()
   where id = p_brouillon_id and statut = 'a_relire';
  if not found then raise exception 'Ce brouillon a déjà été traité'; end if;
end $function$;

-- _anonymiser_stagiaire(p_id integer)
CREATE OR REPLACE FUNCTION public._anonymiser_stagiaire(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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

-- 2. Les trois fonctions créées par l'étape 2 : elles n'existaient pas avant le lot 4. Supprimées par leur
-- nom, quelle que soit leur signature, pour qu'un écart de type ou d'argument ne laisse aucune orpheline.
do $retour$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('inviter_compte', 'creer_promo', 'modifier_dates_promo') loop
    execute format('drop function %s', f);
  end loop;
end
$retour$;

-- 3. mes_promos() : l'étape 2 lui ajoute la colonne roles, donc un autre type de retour, que create or replace
-- n'accepte pas. On la supprime puis on la recrée à l'ancienne, avec ses droits d'avant : ni PUBLIC ni anon,
-- exécutable par authenticated et service_role (relevé : {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}).
drop function public.mes_promos();
CREATE OR REPLACE FUNCTION public.mes_promos()
 RETURNS TABLE(id integer, nom text, lieu_id integer, lieu_nom text, date_debut date, date_fin date, par_defaut boolean, stagiaire_id integer, nb_stagiaires integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select pr.id, pr.nom, pr.lieu_id, l.nom, pr.date_debut, pr.date_fin,
         coalesce(pr.id = d.pid, false),
         (select s.id from user_profiles up join stagiaires s on s.id = up.stagiaire_id
           where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = pr.id
           limit 1),
         (select count(*)::integer from stagiaires s where s.promo_id = pr.id and s.actif)
  from promos pr
  join lieux l on l.id = pr.lieu_id
  cross join (select promo_par_defaut() as pid) d
  where peut_acceder_promo(pr.id)
  order by pr.date_debut, pr.id;
$function$;
revoke all on function public.mes_promos() from public, anon, authenticated, service_role;
grant execute on function public.mes_promos() to authenticated, service_role;
