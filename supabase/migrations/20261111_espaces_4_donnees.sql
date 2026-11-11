-- Lot 5, suite (étape 4) : l'ancien stagiaire invité au personnel, et les données personnelles de la direction.
--   1. _orphelin_en_personnel : la règle unique de transformation, interne (aucun droit d'exécution). Le compte d'un ancien
--      stagiaire dont la fiche n'existe plus (profil de rôle stagiaire sans fiche reliée, « orphelin ») devient un compte du
--      personnel : rôle prof, droit d'administration selon la branche (vrai pour un formateur, faux pour la direction et le
--      siège), fiche formateur libre posée pour un formateur. Un profil relié à une fiche de stagiaire, le fondateur et un
--      profil du personnel ne changent pas.
--   2. inviter_compte et regler_affectations_formateur : redéfinies à partir de leur définition en base au moment de
--      l'exécution (pg_get_functiondef), par remplacement de fragments, chacun attendu exactement une fois. Différences : un
--      appel à _orphelin_en_personnel après le refus du compte stagiaire, et la clé « transforme » dans le jsonb rendu. Si un
--      fragment n'est pas trouvé exactement une fois, la migration s'arrête sans rien changer.
--   3. etat_anonymisation_promo(p_promo) et anonymiser_promo(p_promo) : les versions sans argument de l'équipe, pour n'importe
--      quelle promo du centre de la direction, sans changer la promo affichée. Droit : formateur de p_promo, direction du lieu
--      de p_promo, ou fondateur (hors aperçu siège). Les versions sans argument restent telles quelles.
--   4. benevoles_a_purger(p_lieu) et purger_benevoles(p_ids, p_lieu) : les élèves bénévoles d'un centre choisi, pour la
--      direction de ce centre (ou le fondateur). Une signature avec le centre plutôt que le lieu affiché : la page des
--      Réglages du centre est indépendante de la promo affichée dans la barre. Les versions du formateur restent telles quelles.
-- Marche arrière : 20261111_espaces_4_donnees_retour.sql (remet les fragments d'origine et retire les fonctions du lot).
-- Aucune table, aucune règle RLS touchée. Jamais appliquée sans l'accord de Timy.
set local lock_timeout = '3s';

-- 1. _orphelin_en_personnel -----------------------------------------------------------------------------------------

-- Transforme le profil orphelin de l'adresse p_email (s'il y en a un) en compte du personnel. p_admin : valeur de is_admin ;
-- p_prof_id : fiche formateur à relier (posée seulement si elle existe et n'est reliée à aucun compte, comme _profil_formateur) ;
-- p_par : qui invite (posé seulement si le profil n'a pas d'inviteur). Un compte déjà affecté est réparé sans rien perdre. L'adresse du profil passe en minuscules (comme celle que les insertions suivantes écrivent). Rend vrai si un profil a été transformé. Interne : inviter_compte et regler_affectations_formateur.
create function public._orphelin_en_personnel(p_email text, p_admin boolean, p_prof_id integer, p_par text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prof integer;
  v_n bigint;
begin
  -- Deux profils à la même adresse, à la casse près (l'ancienne clé, sensible à la casse, le permettait) : la mise en minuscules
  -- créerait un doublon. Refus clair, rien n'est changé.
  if exists (select 1 from user_profiles u where lower(u.email) = lower(p_email) and u.role = 'stagiaire' and u.stagiaire_id is null and not u.is_founder)
     and (select count(*) from user_profiles u where lower(u.email) = lower(p_email)) > 1 then
    raise exception 'invitation: Deux comptes existent pour cette adresse (écrite avec des majuscules sur l''un) : à régler par le fondateur.';
  end if;
  select pf.id into v_prof from profs pf
   where pf.id = p_prof_id and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
  -- Rien n'est retiré à un compte déjà affecté : is_admin ne passe jamais de vrai à faux, invited_by_email n'est jamais réécrit
  -- (posé seulement s'il manque), la fiche formateur n'est posée que si le profil n'en a pas.
  update user_profiles u
     set role = 'prof', is_admin = u.is_admin or p_admin, prof_id = coalesce(u.prof_id, v_prof),
         invited_by_email = coalesce(u.invited_by_email, p_par),
         email = lower(u.email)   -- adresse en minuscules (les affectations suivent, FK on update cascade) : pas de doublon à l'insertion qui suit
   where lower(u.email) = lower(p_email) and u.role = 'stagiaire' and u.stagiaire_id is null and not u.is_founder;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$function$;

revoke all on function public._orphelin_en_personnel(text, boolean, integer, text) from public, anon, authenticated, service_role;

-- 2. inviter_compte et regler_affectations_formateur : fragments ------------------------------------------------------

do $migration$
declare
  v_fonctions regprocedure[] := array[
    'public.inviter_compte(text, text, integer, integer, integer)'::regprocedure,
    'public.regler_affectations_formateur(text, integer, integer[], integer)'::regprocedure];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 1, 1, 1, 1, 2, 2, 2];
  v_anciens text[] := array[
$ancien$
  v_aff bigint := 0;
$ancien$,
$ancien$
    -- Le profil (et sa fiche formateur, si elle est libre) est créé par la fonction interne, commune avec
    -- regler_affectations_formateur.
    v_n := case when _profil_formateur(v_email, p_prof_id, v_moi) then 1 else 0 end;
$ancien$,
$ancien$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
$ancien$,
$ancien$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté au siège.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
$ancien$,
$ancien$
  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff);
$ancien$,
$ancien$
  v_cree boolean := false;
$ancien$,
$ancien$
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
$ancien$,
$ancien$
  return jsonb_build_object('email', v_cible, 'cree', v_cree, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
$ancien$];
  v_nouveaux text[] := array[
$nouveau$
  v_aff bigint := 0;
  v_transforme boolean := false;
$nouveau$,
$nouveau$
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel, avec la fiche formateur si elle est libre.
    v_transforme := _orphelin_en_personnel(v_email, true, p_prof_id, v_moi);
    -- Le profil (et sa fiche formateur, si elle est libre) est créé par la fonction interne, commune avec
    -- regler_affectations_formateur.
    v_n := case when _profil_formateur(v_email, p_prof_id, v_moi) then 1 else 0 end;
$nouveau$,
$nouveau$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
$nouveau$,
$nouveau$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté au siège.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
$nouveau$,
$nouveau$
  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff, 'transforme', v_transforme);
$nouveau$,
$nouveau$
  v_cree boolean := false;
  v_transforme boolean := false;
$nouveau$,
$nouveau$
  -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel, comme dans inviter_compte.
  if cardinality(v_liste) > 0 then
    v_transforme := _orphelin_en_personnel(v_email, true, p_prof_id, v_moi);
  end if;
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
$nouveau$,
$nouveau$
  return jsonb_build_object('email', v_cible, 'cree', v_cree, 'transforme', v_transforme, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
$nouveau$];
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : un seul fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..2 loop
    v_def := pg_get_functiondef(v_fonctions[f]);
    for i in 1..cardinality(v_de) loop
      if v_de[i] <> f then continue; end if;
      v_ancien := v_anciens[i];
      v_nouveau := v_nouveaux[i];
      -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : les fragments suivent.
      if position(E'\r' in v_def) > 0 then
        v_ancien := replace(v_ancien, E'\n', E'\r\n');
        v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
      end if;
      n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
      if n <> 1 then
        raise exception 'espaces_4_donnees : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f]::text, n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;

-- 3. etat_anonymisation_promo(p_promo) et anonymiser_promo(p_promo) ------------------------------------------------------

-- Même contenu et mêmes gardes que les versions sans argument (anonymisation possible 12 mois après la fin de la promo,
-- comptes du personnel gardés, journal des effacements), pour la promo donnée. Droit : formateur de cette promo, direction
-- de son centre, ou fondateur ; le siège seul et le fondateur en aperçu siège sont refusés (42501).
create function public.etat_anonymisation_promo(p_promo integer)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  p record;
begin
  if not (coalesce(est_formateur(p_promo), false) or coalesce(est_direction(lieu_de_promo(p_promo)), false)) then
    raise exception 'Réservé à la direction du centre ou au formateur de la promo' using errcode = '42501';
  end if;
  select * into p from promos where id = p_promo;
  if not found then return null; end if;
  return jsonb_build_object(
    'promo_id', p.id,
    'nom', p.nom,
    'date_fin', p.date_fin,
    'anonymisable_le', case when p.date_fin is null then null else (p.date_fin + interval '12 months')::date end,
    'anonymisable', p.date_fin is not null and current_date >= (p.date_fin + interval '12 months')::date,
    'restants', (select count(*) from stagiaires where promo_id = p.id and anonymise_le is null),
    'comptes_admin', (select count(*) from stagiaires s where s.promo_id = p.id and s.anonymise_le is null
                        and exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                                       and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email))))),
    'anonymises', (select count(*) from stagiaires where promo_id = p.id and anonymise_le is not null)
  );
end;
$function$;

revoke all on function public.etat_anonymisation_promo(integer) from public, anon, service_role;
grant execute on function public.etat_anonymisation_promo(integer) to authenticated;

create function public.anonymiser_promo(p_promo integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  p record;
  s record;
  v_faits integer := 0;
  v_ignores integer := 0;
begin
  if not (coalesce(est_formateur(p_promo), false) or coalesce(est_direction(lieu_de_promo(p_promo)), false)) then
    raise exception 'Réservé à la direction du centre ou au formateur de la promo' using errcode = '42501';
  end if;
  select * into p from promos where id = p_promo;
  if not found then raise exception 'Promo introuvable'; end if;
  if p.date_fin is null then raise exception 'Date de fin de promo non renseignée'; end if;
  if current_date < (p.date_fin + interval '12 months')::date then
    raise exception 'Anonymisation possible à partir du %', to_char((p.date_fin + interval '12 months')::date, 'DD/MM/YYYY');
  end if;
  for s in select id from stagiaires where promo_id = p.id and anonymise_le is null order by id loop
    if exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                  and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
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

revoke all on function public.anonymiser_promo(integer) from public, anon, service_role;
grant execute on function public.anonymiser_promo(integer) to authenticated;

-- 4. benevoles_a_purger(p_lieu) et purger_benevoles(p_ids, p_lieu) -----------------------------------------------------

-- Les élèves bénévoles d'un centre sans venue depuis 12 mois (ou jamais venus et créés il y a plus de 12 mois), comme
-- benevoles_a_purger() pour le lieu affiché. Direction de ce centre ou fondateur ; sinon refus 42501.
create function public.benevoles_a_purger(p_lieu integer)
 returns table(id integer, display text, derniere_venue date)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not coalesce(est_direction(p_lieu), false) then
    raise exception 'Réservé à la direction du centre' using errcode = '42501';
  end if;
  return query
  with venues as (
    select b.id,
           max(pe.semaine_lundi + pe.day_index) as derniere
      from benevoles b
      left join planning_entries pe
        on b.id = any(pe.benevoles_ids)
       and pe.promo_id in (select pr.id from promos pr where pr.lieu_id = b.lieu_id)
     where b.lieu_id = p_lieu
     group by b.id
  )
  select b.id,
         case when coalesce(trim(b.nom), '') <> '' then upper(left(trim(b.nom), 1)) || '. ' || b.prenom else b.prenom end,
         v.derniere
    from benevoles b join venues v on v.id = b.id
   where coalesce(v.derniere, b.created_at::date) < (current_date - interval '12 months')::date
   order by coalesce(v.derniere, b.created_at::date);
end;
$function$;

revoke all on function public.benevoles_a_purger(integer) from public, anon, service_role;
grant execute on function public.benevoles_a_purger(integer) to authenticated;

-- Supprime parmi p_ids ceux qui sont réellement éligibles en ce moment dans le centre p_lieu, retire leur nom des plannings,
-- note l'effacement au journal, rend le nombre supprimé.
create function public.purger_benevoles(p_ids integer[], p_lieu integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ids integer[];
  n integer;
begin
  if not coalesce(est_direction(p_lieu), false) then
    raise exception 'Réservé à la direction du centre' using errcode = '42501';
  end if;
  select coalesce(array_agg(a.id), '{}') into v_ids
    from benevoles_a_purger(p_lieu) a where a.id = any(coalesce(p_ids, '{}'));
  if cardinality(v_ids) = 0 then return 0; end if;
  update planning_entries pe
     set benevoles_ids = (select coalesce(array_agg(x), '{}') from unnest(pe.benevoles_ids) x where x <> all(v_ids))
   where pe.benevoles_ids && v_ids;
  delete from benevoles where id = any(v_ids);   -- benevole_suivi suit en cascade
  get diagnostics n = row_count;
  insert into effacements_journal (type, cible, fait_par_email, details)
  values ('benevoles', 'lieu ' || p_lieu, lower(auth.jwt() ->> 'email'), jsonb_build_object('supprimes', n));
  return n;
end;
$function$;

revoke all on function public.purger_benevoles(integer[], integer) from public, anon, service_role;
grant execute on function public.purger_benevoles(integer[], integer) to authenticated;
