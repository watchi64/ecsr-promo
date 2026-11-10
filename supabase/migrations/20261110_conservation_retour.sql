-- Retour de 20261110_conservation.sql (conservation à 3 ans, lot Q5), partie fiches et émargement.
-- Procédure : retirer d'abord de l'app le commit qui appelle les nouvelles fonctions (etat_conservation,
-- effacer_promo_etape1, effacer_promo_etape2, effacer_sur_demande) et remettre en ligne la version d'avant, PUIS jouer
-- ce fichier (psql -1, PGCLIENTENCODING=UTF8). À jouer avant tout retour du lot Q3 (questionnaires), dont ce lot lit
-- _questionnaire_jour() et peut_gerer_qualite().
-- Réversible seulement AVANT toute étape : un effacement ne se défait pas. Le retour commence donc par refuser (exception,
-- rien n'est touché) dès qu'une étape de ce lot a laissé une trace : une ligne de type etape1, etape2, demande,
-- questionnaires ou registre au journal des effacements, une fiche marquée par une étape (efface_le posé sans
-- anonymise_le, ou différent de anonymise_le), une signature effacée. Sinon il recrée à l'identique les quatre fonctions
-- d'anonymisation (version du lot 4, droits du 05/10), emargement_signer (version du lot 4), emargement_annoter et
-- emargement_clore (versions du 23/10), et les contraintes d'origine, puis retire les marques et les fonctions de ce lot.
set local lock_timeout = '3s';

do $garde$
begin
  if exists (select 1 from public.effacements_journal
              where type in ('etape1', 'etape2', 'demande', 'questionnaires', 'registre')) then
    raise exception 'conservation: Retour impossible : une étape de conservation a déjà effacé des données (journal des effacements).';
  end if;
  if exists (select 1 from public.stagiaires
              where efface_le is not null and (anonymise_le is null or efface_le <> anonymise_le)) then
    raise exception 'conservation: Retour impossible : une fiche porte la marque d''une étape de conservation.';
  end if;
  if exists (select 1 from public.emargement_lignes where signature_effacee_le is not null)
     or exists (select 1 from public.emargement_formateurs where signature_effacee_le is not null) then
    raise exception 'conservation: Retour impossible : une signature d''émargement a déjà été effacée.';
  end if;
end
$garde$;

-- 1. Fonctions de ce lot ---------------------------------------------------------------------------------------------
drop function public.effacer_sur_demande(integer);
drop function public.effacer_promo_etape2(integer);
drop function public.effacer_promo_etape1(integer);
drop function public.etat_conservation();
drop function public._effacer_etape2(integer);
drop function public._effacer_etape1(integer);

-- 2. Émargement : versions d'avant (create or replace : droits d'exécution gardés) ------------------------------------
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

CREATE OR REPLACE FUNCTION public.emargement_annoter(p_seance bigint, p_stagiaire integer, p_absent boolean, p_observation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

CREATE OR REPLACE FUNCTION public.emargement_clore(p_seance bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- 3. Les quatre fonctions d'anonymisation, version du lot 4, droits du 05/10 ------------------------------------------
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
revoke all on function public._anonymiser_stagiaire(integer) from anon, public, authenticated;

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
revoke all on function public.anonymiser_promo() from anon, public;
grant execute on function public.anonymiser_promo() to authenticated;

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
revoke all on function public.anonymiser_stagiaire(integer) from anon, public;
grant execute on function public.anonymiser_stagiaire(integer) to authenticated;

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
revoke all on function public.etat_anonymisation_promo() from anon, public;
grant execute on function public.etat_anonymisation_promo() to authenticated;

-- 4. Contraintes et marques d'origine ----------------------------------------------------------------------------------
alter table public.effacements_journal drop constraint effacements_journal_type_check;
alter table public.effacements_journal add constraint effacements_journal_type_check
  check (type in ('stagiaire', 'promo', 'benevoles'));

alter table public.emargement_formateurs drop constraint emargement_formateurs_signature;
alter table public.emargement_formateurs drop column signature_effacee_le;
alter table public.emargement_formateurs alter column trace set not null;
alter table public.emargement_lignes drop constraint emargement_lignes_signature;
alter table public.emargement_lignes drop column signature_effacee_le;
alter table public.emargement_lignes
  add constraint emargement_lignes_check check ((trace is null) = (signe_le is null) and (trace is null) = (signe_par is null));

alter table public.stagiaires drop constraint stagiaires_efface_avant_anonyme;
alter table public.stagiaires drop column efface_le;
