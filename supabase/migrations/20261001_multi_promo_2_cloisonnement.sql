-- Multi-promo, étape 2 : cloisonnement (spec B.3 à B.5). Chaque table propre à une promo
-- (ou à un lieu) ajoute la condition de promo (ou de lieu) à ses règles actuelles.
-- Marche arrière : 20261001_multi_promo_2_cloisonnement_retour.sql

-- Un verrou qui tarde fait échouer la migration (rien n'est appliqué, on relance) au lieu de
-- faire attendre l'app derrière elle.
set local lock_timeout = '3s';

drop function if exists public.diag_entete_promo();

-- ===== Tables propres à une promo, écriture réservée aux admins =====
drop policy if exists stagiaires_admin_writes on public.stagiaires;
create policy stagiaires_admin_writes on public.stagiaires for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists stagiaires_select_all on public.stagiaires;
create policy stagiaires_select_all on public.stagiaires for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists evaluations_admin_writes on public.evaluations;
create policy evaluations_admin_writes on public.evaluations for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists evaluations_select_all on public.evaluations;
create policy evaluations_select_all on public.evaluations for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists planning_entries_admin_writes on public.planning_entries;
create policy planning_entries_admin_writes on public.planning_entries for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists planning_entries_select_all on public.planning_entries;
create policy planning_entries_select_all on public.planning_entries for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists planning_half_meta_admin_writes on public.planning_half_meta;
create policy planning_half_meta_admin_writes on public.planning_half_meta for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists planning_half_meta_select_all on public.planning_half_meta;
create policy planning_half_meta_select_all on public.planning_half_meta for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists planning_jours_off_admin_writes on public.planning_jours_off;
create policy planning_jours_off_admin_writes on public.planning_jours_off for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists planning_jours_off_select_all on public.planning_jours_off;
create policy planning_jours_off_select_all on public.planning_jours_off for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists agenda_admin_writes on public.agenda_events;
create policy agenda_admin_writes on public.agenda_events for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists agenda_select_authenticated on public.agenda_events;
create policy agenda_select_authenticated on public.agenda_events for select to authenticated
  using (promo_id = (select promo_courante()));

-- Réglages : les lignes globales (promo_id nulle) ne sont plus ni lues ni écrites par l'app.
drop policy if exists settings_admin_writes on public.settings;
create policy settings_admin_writes on public.settings for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists settings_select_all on public.settings;
create policy settings_select_all on public.settings for select to authenticated
  using (promo_id = (select promo_courante()));

-- ===== Historiques (écrits par triggers seulement) =====
drop policy if exists evaluations_audit_select on public.evaluations_audit;
create policy evaluations_audit_select on public.evaluations_audit for select to authenticated
  using (promo_id = (select promo_courante()));
drop policy if exists passages_audit_select on public.passages_audit;
create policy passages_audit_select on public.passages_audit for select to authenticated
  using (promo_id = (select promo_courante()));

-- ===== Passages =====
drop policy if exists passages_admin_all on public.passages;
create policy passages_admin_all on public.passages for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists passages_insert_own on public.passages;
create policy passages_insert_own on public.passages for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1)));
drop policy if exists passages_select_all on public.passages;
create policy passages_select_all on public.passages for select to authenticated
  using (promo_id = (select promo_courante()));
drop policy if exists passages_update_own on public.passages;
create policy passages_update_own on public.passages for update to authenticated
  using (promo_id = (select promo_courante()) and stagiaire_id = (
    select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1))
  with check (promo_id = (select promo_courante()) and stagiaire_id = (
    select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1));

-- ===== Tentatives QCM =====
drop policy if exists qcm_attempts_admin_all on public.qcm_attempts;
create policy qcm_attempts_admin_all on public.qcm_attempts for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists qcm_attempts_insert_own on public.qcm_attempts;
create policy qcm_attempts_insert_own on public.qcm_attempts for insert to authenticated
  with check (promo_id = (select promo_courante())
    and stagiaire_id = (select up.stagiaire_id from user_profiles up
                        where lower(up.email) = lower(auth.email()) limit 1)
    and (mode = 'entrainement' or (mode = 'examen' and qcm_exam_remise_toleree(qcm_id))));
drop policy if exists qcm_attempts_select_own on public.qcm_attempts;
create policy qcm_attempts_select_own on public.qcm_attempts for select to authenticated
  using (promo_id = (select promo_courante())
    and stagiaire_id = (select up.stagiaire_id from user_profiles up
                        where lower(up.email) = lower(auth.email()) limit 1));

-- ===== EPCF et livret =====
drop policy if exists epcf_select on public.epcf_evaluations;
create policy epcf_select on public.epcf_evaluations for select to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_insert on public.epcf_evaluations;
create policy epcf_insert on public.epcf_evaluations for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_update on public.epcf_evaluations;
create policy epcf_update on public.epcf_evaluations for update to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()))
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_delete on public.epcf_evaluations;
create policy epcf_delete on public.epcf_evaluations for delete to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()));

drop policy if exists epcf_livrets_select on public.epcf_livrets;
create policy epcf_livrets_select on public.epcf_livrets for select to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_livrets_insert on public.epcf_livrets;
create policy epcf_livrets_insert on public.epcf_livrets for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_livrets_update on public.epcf_livrets;
create policy epcf_livrets_update on public.epcf_livrets for update to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()))
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_livrets_delete on public.epcf_livrets;
create policy epcf_livrets_delete on public.epcf_livrets for delete to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()));

-- ===== Dossier professionnel =====
drop policy if exists dp_dossiers_select on public.dp_dossiers;
create policy dp_dossiers_select on public.dp_dossiers for select to public
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_insert on public.dp_dossiers;
create policy dp_dossiers_insert on public.dp_dossiers for insert to public
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_update on public.dp_dossiers;
create policy dp_dossiers_update on public.dp_dossiers for update to public
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()))
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_delete on public.dp_dossiers;
create policy dp_dossiers_delete on public.dp_dossiers for delete to public
  using (is_admin() and promo_id = (select promo_courante()));

-- ===== Fiches de suivi =====
drop policy if exists fiches_suivi_select on public.fiches_suivi;
create policy fiches_suivi_select on public.fiches_suivi for select to authenticated
  using (promo_id = (select promo_courante()));
drop policy if exists fiches_suivi_insert on public.fiches_suivi;
create policy fiches_suivi_insert on public.fiches_suivi for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where up.email = lower((auth.jwt() ->> 'email'::text)))));
drop policy if exists fiches_suivi_update on public.fiches_suivi;
create policy fiches_suivi_update on public.fiches_suivi for update to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where up.email = lower((auth.jwt() ->> 'email'::text)))))
  with check (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where up.email = lower((auth.jwt() ->> 'email'::text)))));
drop policy if exists fiches_suivi_delete on public.fiches_suivi;
create policy fiches_suivi_delete on public.fiches_suivi for delete to authenticated
  using (is_admin() and promo_id = (select promo_courante()));

-- ===== Progression des thèmes et examens (nouvelles tables) =====
create policy themes_progression_select on public.themes_progression for select to authenticated
  using (promo_id = (select promo_courante()));
create policy themes_progression_insert on public.themes_progression for insert to authenticated
  with check (is_admin() and promo_id = (select promo_courante()));
create policy themes_progression_update on public.themes_progression for update to authenticated
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
create policy themes_progression_delete on public.themes_progression for delete to authenticated
  using (is_admin() and promo_id = (select promo_courante()));

create policy qcm_examens_select on public.qcm_examens for select to authenticated
  using (promo_id = (select promo_courante()));
create policy qcm_examens_insert on public.qcm_examens for insert to authenticated
  with check ((is_admin() or is_prof()) and promo_id = (select promo_courante()));
create policy qcm_examens_update on public.qcm_examens for update to authenticated
  using ((is_admin() or is_prof()) and promo_id = (select promo_courante()))
  with check ((is_admin() or is_prof()) and promo_id = (select promo_courante()));
create policy qcm_examens_delete on public.qcm_examens for delete to authenticated
  using (is_admin() and promo_id = (select promo_courante()));

-- ===== Promos et lieux =====
create policy promos_select on public.promos for select to authenticated
  using (peut_acceder_promo(id));
create policy promos_update_nom on public.promos for update to authenticated
  using (is_admin() and peut_acceder_promo(id))
  with check (is_admin() and peut_acceder_promo(id));
create policy lieux_select on public.lieux for select to authenticated
  using (exists (select 1 from public.promos p where p.lieu_id = lieux.id and peut_acceder_promo(p.id)));

-- ===== Banques par lieu =====
drop policy if exists benevoles_select_admin on public.benevoles;
create policy benevoles_select_admin on public.benevoles for select to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevoles_insert_admin on public.benevoles;
create policy benevoles_insert_admin on public.benevoles for insert to authenticated
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevoles_update_admin on public.benevoles;
create policy benevoles_update_admin on public.benevoles for update to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()))
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevoles_delete_admin on public.benevoles;
create policy benevoles_delete_admin on public.benevoles for delete to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));

drop policy if exists auto_ecoles_select_admin on public.auto_ecoles;
create policy auto_ecoles_select_admin on public.auto_ecoles for select to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists auto_ecoles_insert_admin on public.auto_ecoles;
create policy auto_ecoles_insert_admin on public.auto_ecoles for insert to authenticated
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists auto_ecoles_update_admin on public.auto_ecoles;
create policy auto_ecoles_update_admin on public.auto_ecoles for update to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()))
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists auto_ecoles_delete_admin on public.auto_ecoles;
create policy auto_ecoles_delete_admin on public.auto_ecoles for delete to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));

drop policy if exists benevole_suivi_select_admin on public.benevole_suivi;
create policy benevole_suivi_select_admin on public.benevole_suivi for select to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevole_suivi_insert_admin on public.benevole_suivi;
create policy benevole_suivi_insert_admin on public.benevole_suivi for insert to authenticated
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevole_suivi_update_admin on public.benevole_suivi;
create policy benevole_suivi_update_admin on public.benevole_suivi for update to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()))
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevole_suivi_delete_admin on public.benevole_suivi;
create policy benevole_suivi_delete_admin on public.benevole_suivi for delete to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));

-- ===== Comptes (spec B.4) =====
drop policy if exists user_profiles_select_authenticated on public.user_profiles;
create policy user_profiles_select_authenticated on public.user_profiles for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))
  );
drop policy if exists "user_profiles insert admin" on public.user_profiles;
create policy "user_profiles insert admin" on public.user_profiles for insert to public
  with check (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))));
drop policy if exists "user_profiles update admin" on public.user_profiles;
create policy "user_profiles update admin" on public.user_profiles for update to public
  using (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))))
  with check (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))));
drop policy if exists "user_profiles delete admin" on public.user_profiles;
create policy "user_profiles delete admin" on public.user_profiles for delete to public
  using (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))));

-- ===== Fonctions serveur (spec B.2 et B.5) =====
create or replace function public.my_stagiaire_id()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select up.stagiaire_id from user_profiles up
  join stagiaires s on s.id = up.stagiaire_id
  where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    and s.promo_id = promo_courante()
  limit 1;
$$;

create or replace function public.qcm_exam_demarrable(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select e.published and (e.exam_ferme_a is null or now() < e.exam_ferme_a)
     from qcm_examens e where e.qcm_id = p_qcm_id and e.promo_id = promo_courante()),
    false);
$$;

create or replace function public.qcm_exam_remise_toleree(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select e.published and (
      e.exam_ferme_a is null
      or now() < e.exam_ferme_a + make_interval(secs =>
           coalesce(e.exam_seconds_per_question, 30) * coalesce(
             case when jsonb_typeof(e.exam_question_ids) = 'array'
                  then jsonb_array_length(e.exam_question_ids) end,
             e.exam_nb_questions,
             (select count(*)::int from qcm_questions qq where qq.qcm_id = e.qcm_id),
             0))
    )
    from qcm_examens e where e.qcm_id = p_qcm_id and e.promo_id = promo_courante()), false);
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
      and promo_id = promo_courante()
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
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Non autorise : ce stagiaire n''appartient pas a la promo affichee';
  end if;
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
  from public.benevoles b
  where b.lieu_id = public.lieu_courant();
$$;

-- Venues des bénévoles : cartes du planning de TOUTES les promos du lieu courant (la
-- banque est commune au lieu). Réservée aux admins.
create or replace function public.venues_benevoles()
returns table(promo_id integer, promo_nom text, semaine_lundi date, day_index integer,
              half_day text, sujet text, eleves_ids integer[], benevoles_ids integer[])
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select pe.promo_id, pr.nom, pe.semaine_lundi, pe.day_index, pe.half_day, pe.sujet,
         pe.eleves_ids, pe.benevoles_ids
  from planning_entries pe
  join promos pr on pr.id = pe.promo_id
  where is_admin()
    and pr.lieu_id = lieu_courant()
    and peut_acceder_promo(pe.promo_id)
    and pe.benevoles_ids <> '{}'
  order by pe.semaine_lundi desc, pe.day_index;
$$;
revoke all on function public.venues_benevoles() from public, anon;
grant execute on function public.venues_benevoles() to authenticated, service_role;
