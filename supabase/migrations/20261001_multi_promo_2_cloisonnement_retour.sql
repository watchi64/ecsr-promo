-- Marche arrière de l'étape 2 : règles d'accès et fonctions telles que relevées le 01/10.
-- Attention : une fois septembre peuplé, ce retour rouvre les promos les unes aux autres
-- (lecture ouverte à tout connecté, comme avant l'étape 2), et il supprime venues_benevoles(),
-- dont l'app de l'étape 3 dépend. À n'employer qu'en urgence, app de l'étape 3 retirée.
-- Même en urgence, un verrou qui tarde fait échouer le retour (rien n'est fait, on relance)
-- plutôt que de faire attendre l'app derrière lui.
set local lock_timeout = '3s';

-- Règles des tables existantes
drop policy if exists stagiaires_admin_writes on public.stagiaires;
create policy stagiaires_admin_writes on public.stagiaires for all to public using (is_admin()) with check (is_admin());
drop policy if exists stagiaires_select_all on public.stagiaires;
create policy stagiaires_select_all on public.stagiaires for select to authenticated using (true);
drop policy if exists evaluations_admin_writes on public.evaluations;
create policy evaluations_admin_writes on public.evaluations for all to public using (is_admin()) with check (is_admin());
drop policy if exists evaluations_select_all on public.evaluations;
create policy evaluations_select_all on public.evaluations for select to authenticated using (true);
drop policy if exists planning_entries_admin_writes on public.planning_entries;
create policy planning_entries_admin_writes on public.planning_entries for all to public using (is_admin()) with check (is_admin());
drop policy if exists planning_entries_select_all on public.planning_entries;
create policy planning_entries_select_all on public.planning_entries for select to authenticated using (true);
drop policy if exists planning_half_meta_admin_writes on public.planning_half_meta;
create policy planning_half_meta_admin_writes on public.planning_half_meta for all to public using (is_admin()) with check (is_admin());
drop policy if exists planning_half_meta_select_all on public.planning_half_meta;
create policy planning_half_meta_select_all on public.planning_half_meta for select to authenticated using (true);
drop policy if exists planning_jours_off_admin_writes on public.planning_jours_off;
create policy planning_jours_off_admin_writes on public.planning_jours_off for all to public using (is_admin()) with check (is_admin());
drop policy if exists planning_jours_off_select_all on public.planning_jours_off;
create policy planning_jours_off_select_all on public.planning_jours_off for select to authenticated using (true);
drop policy if exists agenda_admin_writes on public.agenda_events;
create policy agenda_admin_writes on public.agenda_events for all to public using (is_admin()) with check (is_admin());
drop policy if exists agenda_select_authenticated on public.agenda_events;
create policy agenda_select_authenticated on public.agenda_events for select to authenticated using (true);
drop policy if exists settings_admin_writes on public.settings;
create policy settings_admin_writes on public.settings for all to public using (is_admin()) with check (is_admin());
drop policy if exists settings_select_all on public.settings;
create policy settings_select_all on public.settings for select to authenticated using (true);
drop policy if exists evaluations_audit_select on public.evaluations_audit;
create policy evaluations_audit_select on public.evaluations_audit for select to authenticated using (true);
drop policy if exists passages_audit_select on public.passages_audit;
create policy passages_audit_select on public.passages_audit for select to authenticated using (true);

drop policy if exists passages_admin_all on public.passages;
create policy passages_admin_all on public.passages for all to public using (is_admin()) with check (is_admin());
drop policy if exists passages_insert_own on public.passages;
create policy passages_insert_own on public.passages for insert to authenticated
  with check (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where lower(up.email) = lower(auth.email()) limit 1)));
drop policy if exists passages_select_all on public.passages;
create policy passages_select_all on public.passages for select to authenticated using (true);
drop policy if exists passages_update_own on public.passages;
create policy passages_update_own on public.passages for update to authenticated
  using (stagiaire_id = (select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1))
  with check (stagiaire_id = (select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1));

drop policy if exists qcm_attempts_admin_all on public.qcm_attempts;
create policy qcm_attempts_admin_all on public.qcm_attempts for all to public using (is_admin()) with check (is_admin());
drop policy if exists qcm_attempts_insert_own on public.qcm_attempts;
create policy qcm_attempts_insert_own on public.qcm_attempts for insert to authenticated
  with check ((stagiaire_id = (select up.stagiaire_id from user_profiles up
    where lower(up.email) = lower(auth.email()) limit 1))
    and ((mode = 'entrainement') or ((mode = 'examen') and qcm_exam_remise_toleree(qcm_id))));
drop policy if exists qcm_attempts_select_own on public.qcm_attempts;
create policy qcm_attempts_select_own on public.qcm_attempts for select to authenticated
  using (stagiaire_id = (select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1));

drop policy if exists epcf_select on public.epcf_evaluations;
create policy epcf_select on public.epcf_evaluations for select to authenticated
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_insert on public.epcf_evaluations;
create policy epcf_insert on public.epcf_evaluations for insert to authenticated with check (is_admin() or is_prof());
drop policy if exists epcf_update on public.epcf_evaluations;
create policy epcf_update on public.epcf_evaluations for update to authenticated
  using (is_admin() or is_prof()) with check (is_admin() or is_prof());
drop policy if exists epcf_delete on public.epcf_evaluations;
create policy epcf_delete on public.epcf_evaluations for delete to authenticated using (is_admin() or is_prof());
drop policy if exists epcf_livrets_select on public.epcf_livrets;
create policy epcf_livrets_select on public.epcf_livrets for select to authenticated
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_livrets_insert on public.epcf_livrets;
create policy epcf_livrets_insert on public.epcf_livrets for insert to authenticated with check (is_admin() or is_prof());
drop policy if exists epcf_livrets_update on public.epcf_livrets;
create policy epcf_livrets_update on public.epcf_livrets for update to authenticated
  using (is_admin() or is_prof()) with check (is_admin() or is_prof());
drop policy if exists epcf_livrets_delete on public.epcf_livrets;
create policy epcf_livrets_delete on public.epcf_livrets for delete to authenticated using (is_admin() or is_prof());

drop policy if exists dp_dossiers_select on public.dp_dossiers;
create policy dp_dossiers_select on public.dp_dossiers for select to public
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_insert on public.dp_dossiers;
create policy dp_dossiers_insert on public.dp_dossiers for insert to public
  with check (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_update on public.dp_dossiers;
create policy dp_dossiers_update on public.dp_dossiers for update to public
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()))
  with check (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_delete on public.dp_dossiers;
create policy dp_dossiers_delete on public.dp_dossiers for delete to public using (is_admin());

drop policy if exists fiches_suivi_select on public.fiches_suivi;
create policy fiches_suivi_select on public.fiches_suivi for select to authenticated using (true);
drop policy if exists fiches_suivi_insert on public.fiches_suivi;
create policy fiches_suivi_insert on public.fiches_suivi for insert to authenticated
  with check (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where (up.email = lower((auth.jwt() ->> 'email'::text))))));
drop policy if exists fiches_suivi_update on public.fiches_suivi;
create policy fiches_suivi_update on public.fiches_suivi for update to authenticated
  using (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where (up.email = lower((auth.jwt() ->> 'email'::text))))))
  with check (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where (up.email = lower((auth.jwt() ->> 'email'::text))))));
drop policy if exists fiches_suivi_delete on public.fiches_suivi;
create policy fiches_suivi_delete on public.fiches_suivi for delete to authenticated using (is_admin());

drop policy if exists benevoles_select_admin on public.benevoles;
create policy benevoles_select_admin on public.benevoles for select to authenticated using (is_admin());
drop policy if exists benevoles_insert_admin on public.benevoles;
create policy benevoles_insert_admin on public.benevoles for insert to authenticated with check (is_admin());
drop policy if exists benevoles_update_admin on public.benevoles;
create policy benevoles_update_admin on public.benevoles for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists benevoles_delete_admin on public.benevoles;
create policy benevoles_delete_admin on public.benevoles for delete to authenticated using (is_admin());
drop policy if exists auto_ecoles_select_admin on public.auto_ecoles;
create policy auto_ecoles_select_admin on public.auto_ecoles for select to authenticated using (is_admin());
drop policy if exists auto_ecoles_insert_admin on public.auto_ecoles;
create policy auto_ecoles_insert_admin on public.auto_ecoles for insert to authenticated with check (is_admin());
drop policy if exists auto_ecoles_update_admin on public.auto_ecoles;
create policy auto_ecoles_update_admin on public.auto_ecoles for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists auto_ecoles_delete_admin on public.auto_ecoles;
create policy auto_ecoles_delete_admin on public.auto_ecoles for delete to authenticated using (is_admin());
drop policy if exists benevole_suivi_select_admin on public.benevole_suivi;
create policy benevole_suivi_select_admin on public.benevole_suivi for select to authenticated using (is_admin());
drop policy if exists benevole_suivi_insert_admin on public.benevole_suivi;
create policy benevole_suivi_insert_admin on public.benevole_suivi for insert to authenticated with check (is_admin());
drop policy if exists benevole_suivi_update_admin on public.benevole_suivi;
create policy benevole_suivi_update_admin on public.benevole_suivi for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists benevole_suivi_delete_admin on public.benevole_suivi;
create policy benevole_suivi_delete_admin on public.benevole_suivi for delete to authenticated using (is_admin());

drop policy if exists user_profiles_select_authenticated on public.user_profiles;
create policy user_profiles_select_authenticated on public.user_profiles for select to authenticated using (true);
drop policy if exists "user_profiles insert admin" on public.user_profiles;
create policy "user_profiles insert admin" on public.user_profiles for insert to public with check (is_admin());
drop policy if exists "user_profiles update admin" on public.user_profiles;
create policy "user_profiles update admin" on public.user_profiles for update to public using (is_admin()) with check (is_admin());
drop policy if exists "user_profiles delete admin" on public.user_profiles;
create policy "user_profiles delete admin" on public.user_profiles for delete to public using (is_admin());

-- Règles des nouvelles tables : retirées (état de l'étape 1)
drop policy if exists themes_progression_select on public.themes_progression;
drop policy if exists themes_progression_insert on public.themes_progression;
drop policy if exists themes_progression_update on public.themes_progression;
drop policy if exists themes_progression_delete on public.themes_progression;
drop policy if exists qcm_examens_select on public.qcm_examens;
drop policy if exists qcm_examens_insert on public.qcm_examens;
drop policy if exists qcm_examens_update on public.qcm_examens;
drop policy if exists qcm_examens_delete on public.qcm_examens;
drop policy if exists promos_select on public.promos;
drop policy if exists promos_update_nom on public.promos;
drop policy if exists lieux_select on public.lieux;

-- Fonctions telles que relevées le 01/10
create or replace function public.my_stagiaire_id()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select stagiaire_id from user_profiles
  where lower(email) = lower((select auth.jwt() ->> 'email'))
  limit 1;
$$;

create or replace function public.qcm_exam_demarrable(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select q.published and (q.exam_ferme_a is null or now() < q.exam_ferme_a)
     from qcm q where q.id = p_qcm_id),
    false);
$$;

create or replace function public.qcm_exam_remise_toleree(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select q.published and (
      q.exam_ferme_a is null
      or now() < q.exam_ferme_a + make_interval(secs =>
           coalesce(q.exam_seconds_per_question, 30) * coalesce(
             case when jsonb_typeof(q.exam_question_ids) = 'array'
                  then jsonb_array_length(q.exam_question_ids) end,
             q.exam_nb_questions,
             (select count(*)::int from qcm_questions qq where qq.qcm_id = q.id),
             0))
    )
    from qcm q where q.id = p_qcm_id), false);
$$;

create or replace function public.epcf_moyennes(p_trame text)
returns table(critere text, moyenne numeric, effectif integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with dernieres as (
    select distinct on (stagiaire_id) scores
    from epcf_evaluations
    where trame = p_trame and contexte = 'EPCF' and auto_eval = false
    order by stagiaire_id, date_eval desc, id desc
  ),
  notes as (
    select k.key as critere,
           case k.value when 'A' then 2 when 'R' then 1 when 'NA' then 0 end as val
    from dernieres d, jsonb_each_text(d.scores) k
    where k.value in ('A','R','NA')
  )
  select critere, round(avg(val)::numeric, 3) as moyenne, count(*)::integer as effectif
  from notes
  group by critere;
$$;

create or replace function public.set_date_naissance(p_stagiaire_id integer, p_date date)
returns void language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not (is_admin() or is_prof() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  update stagiaires set date_naissance = p_date where id = p_stagiaire_id;
end;
$$;

create or replace function public.benevoles_noms()
returns table(id integer, display text)
language sql stable security definer
set search_path to 'public'
as $$
  select b.id,
         case when coalesce(trim(b.nom), '') <> ''
              then upper(left(trim(b.nom), 1)) || '. ' || b.prenom
              else b.prenom
         end
  from public.benevoles b;
$$;

drop function if exists public.venues_benevoles();

create or replace function public.diag_entete_promo()
returns text language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> 'x-promo-id';
$$;
revoke all on function public.diag_entete_promo() from public;
grant execute on function public.diag_entete_promo() to anon, authenticated;
