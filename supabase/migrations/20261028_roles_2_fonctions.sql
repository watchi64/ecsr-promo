-- Lot 4 (rôles et portées), étape 2 : les fonctions. Les droits de lecture et d'écriture ne dépendent plus des colonnes
-- role, is_admin et prof_id de user_profiles : ils se lisent dans le vocabulaire de l'étape 1 (affectations, aperçu).
-- Ces trois colonnes restent en place pour les anciens clients (un iPhone resté en cache, la fonction Edge invite-user)
-- mais ne décident plus d'aucun droit. Aucune ligne n'est écrite par cette migration.
--   1. Accès aux promos : peut_acceder_promo, promo_par_defaut, promo_courante, my_stagiaire_id, mes_promos (colonne roles).
--   2. notes_stagiaires_visibles : l'équipe de la promo affichée voit tout.
--   3. Compatibilité le temps de la bascule : is_admin() et is_prof() valent formateur_courant(), is_founder() vaut
--      est_fondateur(). Les fonctions qui citent encore is_founder() (signalements de l'app) et la fonction Edge qcm-ia
--      (appel rpc is_admin) continuent de marcher. À ne plus utiliser dans du code neuf.
--   4. Fonctions serveur (émargement, anonymisation, bénévoles, brouillons IA) : formateur_courant() ou equipe_courante().
--   5. Trois fonctions nouvelles : inviter_compte (remplace l'appel à invite-user), creer_promo, modifier_dates_promo.
-- Les 21 fonctions existantes (dont _anonymiser_stagiaire, interne) sont modifiées par create or replace, mêmes paramètres, même type de retour : leurs droits
-- d'exécution d'origine (emargement_feuille fermée au public, notes_stagiaires_visibles sans anon) sont conservés.
-- Seule mes_promos est supprimée puis recréée, avec ses droits, car elle gagne une colonne. L'aperçu (en-tête
-- x-apercu-role) ne fait que retirer des droits ; la direction et le siège n'ont pas encore d'espace dans l'app (lot 5).
-- Marche arrière : 20261028_roles_2_fonctions_retour.sql. Preuve : tests/sql/roles-preuve.sql.
set local lock_timeout = '3s';

-- 1. Accès aux promos ----------------------------------------------------------------------------------------------

-- peut_acceder_promo(p) : la promo existe et l'appelant est le fondateur, un stagiaire de la promo, son formateur, ou la
-- direction de son centre. Le siège n'accède à aucune promo (aucune donnée nominative). L'aperçu ne joue pas ici :
-- la navigation entre promos reste celle de l'appelant.
CREATE OR REPLACE FUNCTION public.peut_acceder_promo(p integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from promos pr where pr.id = p)
     and (
          fondateur_reel()
       or exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                   where lower(up.email) = lower((select auth.jwt() ->> 'email'))
                     and s.promo_id = p)
       or exists (select 1 from affectations af
                   where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                     and (   (af.role = 'formateur' and af.promo_id = p)
                          or (af.role = 'direction' and af.lieu_id = lieu_de_promo(p))))
     );
$function$;

-- promo_par_defaut() : la promo de la fiche ; sinon la première promo accessible non finie (par date_debut, id) ; sinon la
-- dernière accessible. Même résultat qu'avant pour les comptes réels, mais l'accès vient de peut_acceder_promo.
CREATE OR REPLACE FUNCTION public.promo_par_defaut()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with moi as (
    select up.stagiaire_id
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id) and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id)
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$function$;

-- promo_courante() : rend null en aperçu siège (le siège n'a aucune promo) ; le reste est inchangé.
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
  -- Aperçu siège : le siège ne voit aucune promo.
  if apercu_role() = 'siege' then
    return null;
  end if;
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

-- my_stagiaire_id() : null dans tout aperçu autre que stagiaire (un aperçu ne fait que retirer des droits).
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
    and coalesce(apercu_role(), 'stagiaire') = 'stagiaire'
  limit 1;
$function$;

-- mes_promos() : gagne la dernière colonne roles (text[], rôles réels sur chaque promo). Supprimée puis recréée car son type
-- de retour change, avec les mêmes droits qu'avant : ni public ni anon, authenticated et service_role.
drop function public.mes_promos();
CREATE FUNCTION public.mes_promos()
 RETURNS TABLE(id integer, nom text, lieu_id integer, lieu_nom text, date_debut date, date_fin date, par_defaut boolean, stagiaire_id integer, nb_stagiaires integer, roles text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select pr.id, pr.nom, pr.lieu_id, l.nom, pr.date_debut, pr.date_fin,
         coalesce(pr.id = d.pid, false),
         (select s.id from user_profiles up join stagiaires s on s.id = up.stagiaire_id
           where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = pr.id
           limit 1),
         (select count(*)::integer from stagiaires s where s.promo_id = pr.id and s.actif),
         roles_reels(pr.id)
  from promos pr
  join lieux l on l.id = pr.lieu_id
  cross join (select promo_par_defaut() as pid) d
  where peut_acceder_promo(pr.id)
  order by pr.date_debut, pr.id;
$function$;
revoke all on function public.mes_promos() from public, anon, authenticated, service_role;
grant execute on function public.mes_promos() to authenticated, service_role;

-- 2. Notes ---------------------------------------------------------------------------------------------------------

-- notes_stagiaires_visibles() : equipe_courante() (formateur ou direction de la promo affichée) à la place de is_admin() ou is_prof().
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
       equipe_courante()
       or s.id = my_stagiaire_id()
       or (not moi.anonyme
           and not exists (select 1 from user_profiles up2
                            where up2.stagiaire_id = s.id and up2.anonymous_notes))
     );
$function$;

-- 3. Compatibilité (le temps de la bascule) -------------------------------------------------------------------------

-- is_admin() : vaut formateur_courant() (ne lit plus la colonne is_admin).
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select formateur_courant();
$function$;

-- is_prof() : vaut formateur_courant() (ne lit plus la colonne role).
CREATE OR REPLACE FUNCTION public.is_prof()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select formateur_courant();
$function$;

-- is_founder() : vaut est_fondateur() (hors aperçu).
CREATE OR REPLACE FUNCTION public.is_founder()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select est_fondateur();
$function$;

-- 4. Fonctions serveur ----------------------------------------------------------------------------------------------

-- emargement_feuille : le contrôle formateur lit formateur_courant().
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
  if p_formateur and not formateur_courant() then
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

-- emargement_ouvrir : formateur_courant().
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
  if not formateur_courant() then
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

-- emargement_signer : la signature sur l'appareil du formateur lit formateur_courant().
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
  elsif formateur_courant() then
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

-- _anonymiser_stagiaire (interne, vrai garde-fou) : un compte d'équipe n'est jamais anonymisé. Est d'équipe un compte qui a une
-- affectation (formateur, direction, siège), en plus des colonnes is_admin et is_founder des anciens clients. Un exists direct
-- sur affectations : a_une_affectation n'existe qu'à l'étape 3. create or replace, droits d'exécution inchangés.
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

  if exists (select 1 from user_profiles u where u.stagiaire_id = p_id
                and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
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

-- anonymiser_promo : equipe_courante().
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
  if not equipe_courante() then raise exception 'Réservé aux administrateurs'; end if;
  select * into p from promos where id = promo_courante();
  if not found then raise exception 'Aucune promo affichée'; end if;
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

-- anonymiser_stagiaire : equipe_courante().
CREATE OR REPLACE FUNCTION public.anonymiser_stagiaire(p_stagiaire_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v jsonb;
begin
  if not equipe_courante() then raise exception 'Réservé aux administrateurs'; end if;
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

-- etat_anonymisation_promo : equipe_courante().
CREATE OR REPLACE FUNCTION public.etat_anonymisation_promo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p record;
begin
  if not equipe_courante() then raise exception 'Réservé aux administrateurs'; end if;
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
                        and exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                                       and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email))))),
    'anonymises', (select count(*) from stagiaires where promo_id = p.id and anonymise_le is not null)
  );
end;
$function$;

-- set_date_naissance : l'équipe de la promo affichée ou le stagiaire lui-même.
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
  if not (equipe_courante() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  insert into stagiaires_prive (stagiaire_id, date_naissance, updated_at)
  values (p_stagiaire_id, p_date, now())
  on conflict (stagiaire_id) do update set date_naissance = excluded.date_naissance, updated_at = now();
end;
$function$;

-- venues_benevoles : equipe_courante().
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
  where equipe_courante()
    and pr.lieu_id = lieu_courant()
    and peut_acceder_promo(pe.promo_id)
    and pe.benevoles_ids <> '{}'
  order by pe.semaine_lundi desc, pe.day_index;
$function$;

-- benevoles_a_purger : formateur_courant().
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
   where formateur_courant()
     and coalesce(v.derniere, b.created_at::date) < (current_date - interval '12 months')::date
   order by coalesce(v.derniere, b.created_at::date);
$function$;

-- purger_benevoles : formateur_courant().
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
  if not formateur_courant() then raise exception 'Réservé aux administrateurs'; end if;
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

-- accepter_brouillon_ia : formateur_courant().
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
  if not formateur_courant() then
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

-- rejeter_brouillon_ia : formateur_courant().
CREATE OR REPLACE FUNCTION public.rejeter_brouillon_ia(p_brouillon_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not formateur_courant() then
    raise exception 'Réservé aux formateurs' using errcode = '42501';
  end if;
  update qcm_ia_brouillons
     set statut = 'rejetee', traite_par_email = lower(auth.jwt() ->> 'email'), traite_le = now()
   where id = p_brouillon_id and statut = 'a_relire';
  if not found then raise exception 'Ce brouillon a déjà été traité'; end if;
end $function$;

-- 5. Fonctions nouvelles --------------------------------------------------------------------------------------------
-- Exécutables par authenticated seulement ; un droit manquant lève l'état 42501, avec une phrase que l'app affiche telle quelle.

-- inviter_compte : crée le profil (s'il manque) puis l'affectation, selon qui invite quel rôle. Un profil existant n'est jamais
-- rétrogradé ni relié à une seconde fiche, et une fiche déjà reliée à un compte n'en reçoit pas un second (refus).
-- Les colonnes role, is_admin et prof_id sont posées comme avant pour les anciens clients ; prof_id n'est posé que si la
-- fiche formateur existe et n'est reliée à aucun compte. Le retour dit si le profil vient d'être créé (cree) et combien
-- d'affectations viennent d'être ajoutées (affecte : 0 ou 1) ; ni l'un ni l'autre : rien n'a changé.
CREATE FUNCTION public.inviter_compte(p_email text, p_role text, p_stagiaire_id integer DEFAULT NULL::integer, p_prof_id integer DEFAULT NULL::integer, p_lieu_id integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_role text := case when p_role = 'prof' then 'formateur' else p_role end;
  v_promo integer;
  v_promo_fiche integer;
  v_anonymise timestamptz;
  v_prof integer;
  v_n bigint;
  v_aff bigint := 0;
begin
  if v_moi is null then
    raise exception 'invitation: Connexion requise.' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('stagiaire', 'formateur', 'direction', 'siege') then
    raise exception 'invitation: Rôle inconnu.';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'invitation: Adresse e-mail invalide.';
  end if;

  if v_role = 'stagiaire' then
    -- Formateur ou direction de la promo de la fiche.
    select s.promo_id, s.anonymise_le into v_promo_fiche, v_anonymise from stagiaires s where s.id = p_stagiaire_id;
    if v_promo_fiche is null or not (est_formateur(v_promo_fiche) or est_direction(lieu_de_promo(v_promo_fiche))) then
      raise exception 'invitation: Pas de droit sur la promo de ce stagiaire.' using errcode = '42501';
    end if;
    if v_anonymise is not null then
      raise exception 'invitation: Cette fiche est anonymisée.';
    end if;
    -- Une fiche n'a qu'un compte : celui qui tiendrait une seconde adresse signerait et écrirait comme le stagiaire.
    if exists (select 1 from user_profiles u where u.stagiaire_id = p_stagiaire_id and lower(u.email) <> v_email) then
      raise exception 'invitation: Cette fiche est déjà reliée à un autre compte.';
    end if;
    insert into user_profiles (email, role, is_admin, stagiaire_id, invited_by_email)
    values (v_email, 'stagiaire', false, p_stagiaire_id, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;

  elsif v_role = 'formateur' then
    -- Direction du centre de la promo affichée, ou fondateur : l'affectation porte sur la promo affichée.
    v_promo := promo_courante();
    if v_promo is null or not est_direction(lieu_de_promo(v_promo)) then
      raise exception 'invitation: Réservé à la direction du centre.' using errcode = '42501';
    end if;
    -- La fiche formateur n'est posée que si elle existe et n'est reliée à aucun compte.
    select pf.id into v_prof from profs pf
     where pf.id = p_prof_id and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
    insert into user_profiles (email, role, is_admin, prof_id, invited_by_email)
    values (v_email, 'prof', true, v_prof, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, promo_id)
    values (v_email, 'formateur', v_promo)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  elsif v_role = 'direction' then
    -- Siège ou fondateur ; le centre est donné.
    if not est_siege() then
      raise exception 'invitation: Réservé au siège.' using errcode = '42501';
    end if;
    if p_lieu_id is null or not exists (select 1 from lieux l where l.id = p_lieu_id) then
      raise exception 'invitation: Le centre est requis.';
    end if;
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, lieu_id)
    values (v_email, 'direction', p_lieu_id)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  else
    -- Siège : le fondateur seul.
    if not est_fondateur() then
      raise exception 'invitation: Réservé au fondateur.' using errcode = '42501';
    end if;
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role)
    values (v_email, 'siege')
    on conflict do nothing;
    get diagnostics v_aff = row_count;
  end if;

  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff);
end;
$function$;

-- creer_promo : la direction du centre (ou le fondateur) crée une promo ; rend son identifiant.
CREATE FUNCTION public.creer_promo(p_lieu_id integer, p_nom text, p_debut date, p_fin date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id integer;
begin
  if auth.jwt() ->> 'email' is null or not est_direction(p_lieu_id) then
    raise exception 'promo: Réservé à la direction du centre.' using errcode = '42501';
  end if;
  if not exists (select 1 from lieux l where l.id = p_lieu_id) then
    raise exception 'promo: Centre introuvable.';
  end if;
  if coalesce(trim(p_nom), '') = '' then
    raise exception 'promo: Le nom est requis.';
  end if;
  if p_debut is null then
    raise exception 'promo: La date de début est requise.';
  end if;
  if p_fin is not null and p_fin < p_debut then
    raise exception 'promo: La fin ne peut pas précéder le début.';
  end if;
  insert into promos (lieu_id, nom, date_debut, date_fin)
  values (p_lieu_id, trim(p_nom), p_debut, p_fin)
  returning id into v_id;
  return v_id;
end;
$function$;

-- modifier_dates_promo : la direction du centre de la promo (ou le fondateur) change ses dates.
CREATE FUNCTION public.modifier_dates_promo(p_promo_id integer, p_debut date, p_fin date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.jwt() ->> 'email' is null or not est_direction(lieu_de_promo(p_promo_id)) then
    raise exception 'promo: Réservé à la direction du centre.' using errcode = '42501';
  end if;
  if p_debut is null then
    raise exception 'promo: La date de début est requise.';
  end if;
  if p_fin is not null and p_fin < p_debut then
    raise exception 'promo: La fin ne peut pas précéder le début.';
  end if;
  update promos set date_debut = p_debut, date_fin = p_fin where id = p_promo_id;
  if not found then
    raise exception 'promo: Promo introuvable.';
  end if;
end;
$function$;

revoke all on function public.inviter_compte(text, text, integer, integer, integer),
  public.creer_promo(integer, text, date, date), public.modifier_dates_promo(integer, date, date) from public, anon, service_role;
grant execute on function public.inviter_compte(text, text, integer, integer, integer),
  public.creer_promo(integer, text, date, date), public.modifier_dates_promo(integer, date, date) to authenticated;
