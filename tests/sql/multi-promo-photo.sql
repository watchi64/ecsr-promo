-- Photo « avant » de la répétition de l'étape 2 (spec E.2) : ce que voient, table par
-- table et sans en-tête, les trois personnages réels de mars, sous les règles du moment.
-- À enchaîner dans le MÊME lot que la migration 2 puis la preuve (Tâche 4, étape 2).
create temp table if not exists photo (personnage text, table_nom text, n bigint);
truncate photo;

create or replace function pg_temp.incarner(p_email text, p_entete text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then ''
         else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_entete is null then ''
         else json_build_object('x-promo-id', p_entete)::text end, true);
  if p_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

-- Compte ce qu'un personnage voit. Un refus de droit (visiteur sur une table fermée)
-- compte 0 ; toute autre erreur rend -1, qui ne correspond à aucune attente.
create or replace function pg_temp.compter(p_email text, p_entete text, p_sql text)
returns bigint language plpgsql as $f$
declare n bigint;
begin
  perform pg_temp.incarner(p_email, p_entete);
  begin
    execute p_sql into n;
  exception
    when insufficient_privilege then n := 0;
    when others then n := -1;
  end;
  reset role;
  return n;
end $f$;

do $photo$
declare
  v_p record; v_t text; v_n bigint;
  v_stag1 text; v_form text; v_fond text;
  tables text[] := array['stagiaires','evaluations','evaluations_audit','passages','passages_audit',
    'planning_entries','planning_half_meta','planning_jours_off','agenda_events','settings',
    'qcm_attempts','epcf_evaluations','epcf_livrets','dp_dossiers','fiches_suivi','user_profiles',
    'benevoles','auto_ecoles','benevole_suivi','themes','qcm','qcm_questions','qcm_options',
    'qcm_signalements','cours','ressources','contacts','profs','competences','chatbot_usage'];
begin
  select up.email into v_stag1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif and s.promo_id = 1
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email into v_fond from user_profiles where is_founder order by email limit 1;
  for v_p in select * from (values ('stagiaire de mars', v_stag1), ('formateur', v_form),
                                   ('fondateur', v_fond)) as t(nom, email) loop
    foreach v_t in array tables loop
      v_n := pg_temp.compter(v_p.email, null, format('select count(*) from public.%I', v_t));
      insert into photo values (v_p.nom, v_t, v_n);
    end loop;
  end loop;
end $photo$;
