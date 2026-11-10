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
