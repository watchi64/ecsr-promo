-- Lot 4 (rôles et portées), étape 3 : les règles de la matrice des droits. C'est ici que les droits changent pour de
-- vrai : qui voit et qui écrit quoi, pour les stagiaires, les formateurs, les directions, le siège et le fondateur.
-- Les étapes 1 (affectations, vocabulaire) et 2 (fonctions) doivent être passées avant, et dans la même fenêtre :
-- entre les étapes 2 et 3, les anciennes règles appellent is_admin() sans (select ...) et coûtent bien plus cher.
--
-- Principes
--   * Une règle n'est supprimée que par son nom exact, sans « if exists » : un écart avec la production fait échouer
--     la migration au lieu de passer en silence. Les règles que la matrice laisse inchangées ne sont pas touchées.
--   * Noms : <table>_lecture, <table>_ajout, <table>_modification, <table>_suppression, ou <table>_ecriture pour une
--     règle « for all » (celle des anciennes règles *_admin_writes). Le stockage garde ses noms (seule l'expression change).
--   * Les rôles (clause to) sont ceux de la règle remplacée. Une règle « to public » appelle des fonctions ouvertes à
--     anon (étape 1) ; quand deux règles de rôles différents fusionnent (ajout d'un passage ou d'une tentative de QCM,
--     par le formateur ou par le stagiaire), la règle est « to authenticated » : aucune de ses deux conditions n'est
--     vraie pour anon, qui n'a ni adresse ni fiche.
--   * Les appels sans argument de colonne s'écrivent (select f()) : calculés une fois par requête, pas par ligne.
--   * Notation de la matrice : P = ligne de la promo affichée ; L = du lieu affiché ; F = formateur_courant() ;
--     D = direction_courante() ; E = equipe_courante() ; R = redacteur_contenus() ; Fo = est_fondateur() ;
--     M = la ligne de la personne (sa fiche, son adresse ou son identifiant).
--   * Aucune donnée n'est réécrite. Plus aucune règle de public ni de storage ne cite is_admin(), is_prof() ni
--     is_founder() (ces fonctions ne servent plus qu'aux anciens clients, avec leurs équivalents de l'étape 2).
--   * Hors matrice et inchangés : affectations (règles posées à l'étape 1), chatbot_usage, qcm_ia_usage, cours_chunks,
--     passages_audit, emargement_seances, planning et autres lectures « P (inchangé) », qcm_*_select_connectes et
--     _select_founder, promos_select, cours_images_lecture, qcm_images_read, qcm_signalements_insert.
--   * Les droits de table de user_profiles changent : insertion et modification retirées à anon et authenticated (elles
--     passent par les fonctions serveur de l'étape 2). Les autres droits de table et de colonne ne changent pas
--     (promos : UPDATE(nom) reste tel quel).
-- Le siège n'écrit ni dans qcm ni dans themes : ces tables portent encore les anciennes colonnes de Nîmes (ménage du
-- multi-promo, étape 5, pas encore fait). Il modifie et publie les cours et les questions de QCM.
-- Marche arrière : 20261028_roles_3_regles_retour.sql. Preuve : tests/sql/roles-preuve.sql, assemblée par
-- outils/assembler_repetition_roles.mjs (mode repetition).
set local lock_timeout = '3s';

-- public.agenda_events : écriture P et F (lecture P inchangée)
drop policy agenda_admin_writes on public.agenda_events;
create policy agenda_events_ecriture on public.agenda_events
  as permissive for all to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.planning_entries : écriture P et F (lecture P inchangée)
drop policy planning_entries_admin_writes on public.planning_entries;
create policy planning_entries_ecriture on public.planning_entries
  as permissive for all to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.planning_half_meta : écriture P et F (lecture P inchangée)
drop policy planning_half_meta_admin_writes on public.planning_half_meta;
create policy planning_half_meta_ecriture on public.planning_half_meta
  as permissive for all to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.planning_jours_off : écriture P et F (lecture P inchangée)
drop policy planning_jours_off_admin_writes on public.planning_jours_off;
create policy planning_jours_off_ecriture on public.planning_jours_off
  as permissive for all to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.stagiaires : ajout et modification P et E, la direction gère les fiches de son centre (inviter, abandon) ;
-- suppression P et F, le formateur de la promo ou le fondateur (la fiche emporte ses données en cascade) ; lecture P
-- inchangée
drop policy stagiaires_admin_writes on public.stagiaires;
create policy stagiaires_ajout on public.stagiaires
  as permissive for insert to public
  with check (promo_id = (select public.promo_courante()) and (select public.equipe_courante()));
create policy stagiaires_modification on public.stagiaires
  as permissive for update to public
  using (promo_id = (select public.promo_courante()) and (select public.equipe_courante()))
  with check (promo_id = (select public.promo_courante()) and (select public.equipe_courante()));
create policy stagiaires_suppression on public.stagiaires
  as permissive for delete to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.stagiaires_prive : lecture fiche de P et (E ou M) ; aucune écriture directe (set_date_naissance)
drop policy stagiaires_prive_select on public.stagiaires_prive;
create policy stagiaires_prive_lecture on public.stagiaires_prive
  as permissive for select to authenticated
  using (
    exists (select 1 from public.stagiaires s
             where s.id = stagiaires_prive.stagiaire_id and s.promo_id = (select public.promo_courante()))
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- public.settings : écriture P et, selon la clé, Fo (navigation_v2, emargement_actif), E (modules), F (autres)
drop policy settings_admin_writes on public.settings;
create policy settings_ecriture on public.settings
  as permissive for all to public
  using (
    promo_id = (select public.promo_courante())
    and case
          when key in ('navigation_v2', 'emargement_actif') then (select public.est_fondateur())
          when key = 'modules' then (select public.equipe_courante())
          else (select public.formateur_courant())
        end
  )
  with check (
    promo_id = (select public.promo_courante())
    and case
          when key in ('navigation_v2', 'emargement_actif') then (select public.est_fondateur())
          when key = 'modules' then (select public.equipe_courante())
          else (select public.formateur_courant())
        end
  );

-- public.evaluations : lecture P et (E ou fiche visible, notes_stagiaires_visibles) ; écriture P et F
drop policy evaluations_admin_writes on public.evaluations;
drop policy evaluations_select on public.evaluations;
create policy evaluations_lecture on public.evaluations
  as permissive for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id in (select public.notes_stagiaires_visibles()))
  );
create policy evaluations_ecriture on public.evaluations
  as permissive for all to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.evaluations_audit : lecture P et (E ou évaluation visible) ; écriture par déclencheur seulement
drop policy evaluations_audit_select on public.evaluations_audit;
create policy evaluations_audit_lecture on public.evaluations_audit
  as permissive for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or evaluation_id in (select e.id from public.evaluations e))
  );

-- public.epcf_evaluations : lecture P et (E ou M) ; écriture P et F
drop policy epcf_delete on public.epcf_evaluations;
drop policy epcf_insert on public.epcf_evaluations;
drop policy epcf_select on public.epcf_evaluations;
drop policy epcf_update on public.epcf_evaluations;
create policy epcf_evaluations_lecture on public.epcf_evaluations
  as permissive for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy epcf_evaluations_ajout on public.epcf_evaluations
  as permissive for insert to authenticated
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy epcf_evaluations_modification on public.epcf_evaluations
  as permissive for update to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy epcf_evaluations_suppression on public.epcf_evaluations
  as permissive for delete to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.epcf_livrets : lecture P et (E ou M) ; écriture P et F
drop policy epcf_livrets_delete on public.epcf_livrets;
drop policy epcf_livrets_insert on public.epcf_livrets;
drop policy epcf_livrets_select on public.epcf_livrets;
drop policy epcf_livrets_update on public.epcf_livrets;
create policy epcf_livrets_lecture on public.epcf_livrets
  as permissive for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy epcf_livrets_ajout on public.epcf_livrets
  as permissive for insert to authenticated
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy epcf_livrets_modification on public.epcf_livrets
  as permissive for update to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy epcf_livrets_suppression on public.epcf_livrets
  as permissive for delete to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.dp_dossiers : lecture P et (E ou M) ; ajout et modification P et (F ou M) ; suppression P et F
drop policy dp_dossiers_delete on public.dp_dossiers;
drop policy dp_dossiers_insert on public.dp_dossiers;
drop policy dp_dossiers_select on public.dp_dossiers;
drop policy dp_dossiers_update on public.dp_dossiers;
create policy dp_dossiers_lecture on public.dp_dossiers
  as permissive for select to public
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy dp_dossiers_ajout on public.dp_dossiers
  as permissive for insert to public
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy dp_dossiers_modification on public.dp_dossiers
  as permissive for update to public
  using (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  )
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy dp_dossiers_suppression on public.dp_dossiers
  as permissive for delete to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.fiches_suivi : lecture P et (E ou M) ; ajout et modification P et (F ou M) ; suppression P et F
drop policy fiches_suivi_delete on public.fiches_suivi;
drop policy fiches_suivi_insert on public.fiches_suivi;
drop policy fiches_suivi_select on public.fiches_suivi;
drop policy fiches_suivi_update on public.fiches_suivi;
create policy fiches_suivi_lecture on public.fiches_suivi
  as permissive for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy fiches_suivi_ajout on public.fiches_suivi
  as permissive for insert to authenticated
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy fiches_suivi_modification on public.fiches_suivi
  as permissive for update to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  )
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy fiches_suivi_suppression on public.fiches_suivi
  as permissive for delete to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.passages : ajout et modification P et (F ou la sienne) ; suppression P et F (lecture P inchangée)
drop policy passages_admin_all on public.passages;
drop policy passages_insert_own on public.passages;
drop policy passages_update_own on public.passages;
create policy passages_ajout on public.passages
  as permissive for insert to authenticated
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy passages_modification on public.passages
  as permissive for update to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  )
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy passages_suppression on public.passages
  as permissive for delete to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.qcm_attempts : lecture P et (E ou M) ; P et F, plus l'ajout des siennes (entraînement, ou examen toléré)
drop policy qcm_attempts_admin_all on public.qcm_attempts;
drop policy qcm_attempts_insert_own on public.qcm_attempts;
drop policy qcm_attempts_select_own on public.qcm_attempts;
create policy qcm_attempts_lecture on public.qcm_attempts
  as permissive for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );
create policy qcm_attempts_ajout on public.qcm_attempts
  as permissive for insert to authenticated
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant())
         or (stagiaire_id = (select public.my_stagiaire_id())
             and (mode = 'entrainement' or (mode = 'examen' and public.qcm_exam_remise_toleree(qcm_id)))))
  );
create policy qcm_attempts_modification on public.qcm_attempts
  as permissive for update to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy qcm_attempts_suppression on public.qcm_attempts
  as permissive for delete to public
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.qcm_examens : écriture P et F (lecture P inchangée)
drop policy qcm_examens_delete on public.qcm_examens;
drop policy qcm_examens_insert on public.qcm_examens;
drop policy qcm_examens_update on public.qcm_examens;
create policy qcm_examens_ajout on public.qcm_examens
  as permissive for insert to authenticated
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy qcm_examens_modification on public.qcm_examens
  as permissive for update to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy qcm_examens_suppression on public.qcm_examens
  as permissive for delete to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.themes_progression : écriture P et F (lecture P inchangée)
drop policy themes_progression_delete on public.themes_progression;
drop policy themes_progression_insert on public.themes_progression;
drop policy themes_progression_update on public.themes_progression;
create policy themes_progression_ajout on public.themes_progression
  as permissive for insert to authenticated
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy themes_progression_modification on public.themes_progression
  as permissive for update to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));
create policy themes_progression_suppression on public.themes_progression
  as permissive for delete to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- public.emargement_lignes : lecture P et (E ou M) ; écriture par fonctions serveur (séances P inchangées)
drop policy emargement_lignes_select on public.emargement_lignes;
create policy emargement_lignes_lecture on public.emargement_lignes
  as permissive for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- public.emargement_formateurs : lecture P et E ; écriture par fonctions serveur
drop policy emargement_formateurs_select on public.emargement_formateurs;
create policy emargement_formateurs_lecture on public.emargement_formateurs
  as permissive for select to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.equipe_courante()));

-- public.auto_ecoles : banque du lieu, lecture L et E ; écriture L et F
drop policy auto_ecoles_delete_admin on public.auto_ecoles;
drop policy auto_ecoles_insert_admin on public.auto_ecoles;
drop policy auto_ecoles_select_admin on public.auto_ecoles;
drop policy auto_ecoles_update_admin on public.auto_ecoles;
create policy auto_ecoles_lecture on public.auto_ecoles
  as permissive for select to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.equipe_courante()));
create policy auto_ecoles_ajout on public.auto_ecoles
  as permissive for insert to authenticated
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));
create policy auto_ecoles_modification on public.auto_ecoles
  as permissive for update to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()))
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));
create policy auto_ecoles_suppression on public.auto_ecoles
  as permissive for delete to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- public.benevoles : banque du lieu, lecture L et E ; écriture L et F
drop policy benevoles_delete_admin on public.benevoles;
drop policy benevoles_insert_admin on public.benevoles;
drop policy benevoles_select_admin on public.benevoles;
drop policy benevoles_update_admin on public.benevoles;
create policy benevoles_lecture on public.benevoles
  as permissive for select to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.equipe_courante()));
create policy benevoles_ajout on public.benevoles
  as permissive for insert to authenticated
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));
create policy benevoles_modification on public.benevoles
  as permissive for update to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()))
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));
create policy benevoles_suppression on public.benevoles
  as permissive for delete to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- public.benevole_suivi : banque du lieu, lecture L et E ; écriture L et F
drop policy benevole_suivi_delete_admin on public.benevole_suivi;
drop policy benevole_suivi_insert_admin on public.benevole_suivi;
drop policy benevole_suivi_select_admin on public.benevole_suivi;
drop policy benevole_suivi_update_admin on public.benevole_suivi;
create policy benevole_suivi_lecture on public.benevole_suivi
  as permissive for select to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.equipe_courante()));
create policy benevole_suivi_ajout on public.benevole_suivi
  as permissive for insert to authenticated
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));
create policy benevole_suivi_modification on public.benevole_suivi
  as permissive for update to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()))
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));
create policy benevole_suivi_suppression on public.benevole_suivi
  as permissive for delete to authenticated
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- public.promos : nom modifiable par le formateur de la promo ou la direction du lieu (lecture inchangée ; la création
-- et les dates passent par creer_promo et modifier_dates_promo ; le droit de colonne UPDATE(nom) reste tel quel)
drop policy promos_update_nom on public.promos;
create policy promos_modification on public.promos
  as permissive for update to authenticated
  using (public.est_formateur(id) or public.est_direction(lieu_id))
  with check (public.est_formateur(id) or public.est_direction(lieu_id));

-- public.lieux : lecture du lieu d'une promo accessible, d'un lieu dont on est la direction, de tous pour le siège
drop policy lieux_select on public.lieux;
create policy lieux_lecture on public.lieux
  as permissive for select to authenticated
  using (
    exists (select 1 from public.promos p where p.lieu_id = lieux.id and public.peut_acceder_promo(p.id))
    or public.est_direction(id)
    or (select public.est_siege())
  );

-- Aide de la suppression des comptes. Un compte qui a une affectation ne se supprime pas ; comme la table
-- affectations est sous RLS, une sous-requête de la règle serait filtrée pour l'appelant et laisserait supprimer un
-- compte « cumulé » : la question est posée par cette fonction (security definer). Pour ne pas servir à sonder les
-- adresses du personnel, elle répond « oui » à qui n'est ni fondateur ni équipe de la promo affichée (la règle de
-- suppression refuse de toute façon ces appelants).
create function public.a_une_affectation(p_email text)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select not ((select public.est_fondateur()) or (select public.equipe_courante()))
      or exists (select 1 from affectations af where lower(af.email) = lower(p_email));
$function$;
revoke all on function public.a_une_affectation(text) from public;
grant execute on function public.a_une_affectation(text) to anon, authenticated;

-- public.user_profiles : lecture M ; personnel (sans fiche, role <> 'stagiaire') pour un compte qui a une promo
-- (promo_par_defaut non nulle), le siège ou Fo ; orphelins (sans fiche, role 'stagiaire') pour Fo ou pour celui qui
-- les a invités ; stagiaires de P. Plus d'ajout ni de modification directs (fonctions serveur). Suppression jamais du
-- fondateur ni d'un compte affecté : un stagiaire de P par E, un orphelin par Fo ou par E qui l'a invité, le personnel
-- par Fo
drop policy "user_profiles delete admin" on public.user_profiles;
drop policy "user_profiles insert admin" on public.user_profiles;
drop policy "user_profiles update admin" on public.user_profiles;
drop policy user_profiles_select_authenticated on public.user_profiles;
revoke insert, update on public.user_profiles from anon, authenticated;
create policy user_profiles_lecture on public.user_profiles
  as permissive for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (stagiaire_id is null and role <> 'stagiaire'
        and ((select public.promo_par_defaut()) is not null or (select public.est_siege()) or (select public.est_fondateur())))
    or (stagiaire_id is null and role = 'stagiaire'
        and ((select public.est_fondateur()) or lower(invited_by_email) = lower((select auth.jwt() ->> 'email'))))
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))
  );
create policy user_profiles_suppression on public.user_profiles
  as permissive for delete to public
  using (
    not is_founder
    and not public.a_une_affectation(email)
    and (
      (stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))
       and (select public.equipe_courante()))
      or (stagiaire_id is null and role = 'stagiaire'
          and ((select public.est_fondateur())
               or ((select public.equipe_courante()) and lower(invited_by_email) = lower((select auth.jwt() ->> 'email')))))
      or (stagiaire_id is null and role <> 'stagiaire' and (select public.est_fondateur()))
    )
  );

-- public.cours : lecture des cours publiés, du fondateur, des cours de thème pour F, D et S ; modification Fo, ou
-- (F ou S) sur un cours de thème ou publié ; ni ajout ni suppression
drop policy cours_select on public.cours;
drop policy cours_update on public.cours;
create policy cours_lecture on public.cours
  as permissive for select to authenticated
  using (
    published
    or (select public.est_fondateur())
    or (code is null and ((select public.formateur_courant()) or (select public.direction_courante())
                          or (select public.est_siege())))
  );
create policy cours_modification on public.cours
  as permissive for update to authenticated
  using (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.est_siege())) and (code is null or published))
  )
  with check (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.est_siege())) and (code is null or published))
  );

-- public.cours_versions : lecture Fo, ou (F, D ou S) sur un cours de thème ou publié ; ajout Fo, ou (F ou S) idem
drop policy cours_versions_insert on public.cours_versions;
drop policy cours_versions_select on public.cours_versions;
create policy cours_versions_lecture on public.cours_versions
  as permissive for select to authenticated
  using (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.direction_courante()) or (select public.est_siege()))
        and exists (select 1 from public.cours c
                     where c.id = cours_versions.cours_id and (c.code is null or c.published)))
  );
create policy cours_versions_ajout on public.cours_versions
  as permissive for insert to authenticated
  with check (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.est_siege()))
        and exists (select 1 from public.cours c
                     where c.id = cours_versions.cours_id and (c.code is null or c.published)))
  );

-- public.qcm_questions : écriture R, le siège rédige les contenus communs (lecture des connectés inchangée)
drop policy qcm_questions_admin_all on public.qcm_questions;
create policy qcm_questions_ecriture on public.qcm_questions
  as permissive for all to public
  using ((select public.redacteur_contenus()))
  with check ((select public.redacteur_contenus()));

-- public.qcm_options : écriture R (lecture des connectés inchangée)
drop policy qcm_options_admin_all on public.qcm_options;
create policy qcm_options_ecriture on public.qcm_options
  as permissive for all to public
  using ((select public.redacteur_contenus()))
  with check ((select public.redacteur_contenus()));

-- public.qcm : écriture F, pas le siège ; qcm_update_formateur est retirée, l'écriture F couvre déjà la modification
drop policy qcm_admin_all on public.qcm;
drop policy qcm_update_formateur on public.qcm;
create policy qcm_ecriture on public.qcm
  as permissive for all to public
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- public.themes : écriture F, pas le siège (lecture des connectés inchangée)
drop policy themes_admin_writes on public.themes;
create policy themes_ecriture on public.themes
  as permissive for all to public
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- public.competences : écriture F (lecture des connectés inchangée)
drop policy competences_admin_writes on public.competences;
create policy competences_ecriture on public.competences
  as permissive for all to public
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- public.ressources : écriture F (lecture des connectés inchangée)
drop policy ressources_admin_writes on public.ressources;
create policy ressources_ecriture on public.ressources
  as permissive for all to public
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- public.contacts : écriture E (lecture des connectés inchangée)
drop policy contacts_admin_writes on public.contacts;
create policy contacts_ecriture on public.contacts
  as permissive for all to public
  using ((select public.equipe_courante()))
  with check ((select public.equipe_courante()));

-- public.profs : écriture E (lecture des connectés inchangée)
drop policy profs_admin_writes on public.profs;
create policy profs_ecriture on public.profs
  as permissive for all to public
  using ((select public.equipe_courante()))
  with check ((select public.equipe_courante()));

-- public.qcm_signalements : lecture M, Fo, ou F sur les signalements d'une fiche de P et ceux sans fiche (faits par
-- l'équipe) ; traitement et suppression : Fo, ou F avec la même portée (ajout du sien inchangé)
drop policy qcm_signalements_delete on public.qcm_signalements;
drop policy qcm_signalements_select on public.qcm_signalements;
drop policy qcm_signalements_update on public.qcm_signalements;
create policy qcm_signalements_lecture on public.qcm_signalements
  as permissive for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (select public.est_fondateur())
    or ((select public.formateur_courant())
        and (stagiaire_id is null
             or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))))
  );
create policy qcm_signalements_modification on public.qcm_signalements
  as permissive for update to authenticated
  using (
    (select public.est_fondateur())
    or ((select public.formateur_courant())
        and (stagiaire_id is null
             or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))))
  )
  with check (
    (select public.est_fondateur())
    or ((select public.formateur_courant())
        and (stagiaire_id is null
             or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))))
  );
create policy qcm_signalements_suppression on public.qcm_signalements
  as permissive for delete to authenticated
  using (
    (select public.est_fondateur())
    or ((select public.formateur_courant())
        and (stagiaire_id is null
             or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))))
  );

-- public.qcm_signalement_instruction : lecture F ; écriture par fonctions serveur
drop policy qcm_signalement_instruction_select on public.qcm_signalement_instruction;
create policy qcm_signalement_instruction_lecture on public.qcm_signalement_instruction
  as permissive for select to authenticated
  using ((select public.formateur_courant()));

-- public.qcm_ia_brouillons : lecture F ; écriture par fonctions serveur
drop policy qcm_ia_brouillons_select on public.qcm_ia_brouillons;
create policy qcm_ia_brouillons_lecture on public.qcm_ia_brouillons
  as permissive for select to authenticated
  using ((select public.formateur_courant()));

-- public.conditions_acceptations : lecture M, Fo, ou E sur les adresses des comptes dont la fiche est dans P ; écriture
-- par fonction serveur
drop policy conditions_acceptations_select on public.conditions_acceptations;
create policy conditions_acceptations_lecture on public.conditions_acceptations
  as permissive for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (select public.est_fondateur())
    or ((select public.equipe_courante())
        and lower(email) in (select lower(u.email) from public.user_profiles u
                              where u.stagiaire_id in (select s.id from public.stagiaires s
                                                        where s.promo_id = (select public.promo_courante()))))
  );

-- public.effacements_journal : lecture Fo, ou E sur les lignes de P et de L selon la cible (« promo <id> », « stagiaire
-- <id> » d'une fiche de P, « lieu <id> ») ; écriture par fonctions serveur
drop policy effacements_journal_select on public.effacements_journal;
create policy effacements_journal_lecture on public.effacements_journal
  as permissive for select to authenticated
  using (
    (select public.est_fondateur())
    or ((select public.equipe_courante())
        and (cible = 'promo ' || (select public.promo_courante())
             or cible = 'lieu ' || (select public.lieu_courant())
             or cible in (select 'stagiaire ' || s.id from public.stagiaires s
                           where s.promo_id = (select public.promo_courante()))))
  );

-- public.signalements_app : lecture M ou Fo, suppression Fo (R20 : mêmes droits, écrits avec le vocabulaire)
drop policy signalements_app_select on public.signalements_app;
drop policy signalements_app_delete on public.signalements_app;
create policy signalements_app_lecture on public.signalements_app
  as permissive for select to authenticated
  using (user_id = (select auth.uid()) or (select public.est_fondateur()));
create policy signalements_app_suppression on public.signalements_app
  as permissive for delete to authenticated
  using ((select public.est_fondateur()));

-- public.signalements_app_captures : lecture des captures d'un signalement lisible (R20)
drop policy signalements_app_captures_select on public.signalements_app_captures;
create policy signalements_app_captures_lecture on public.signalements_app_captures
  as permissive for select to authenticated
  using (
    exists (select 1 from public.signalements_app s
             where s.id = signalements_app_captures.signalement_id
               and (s.user_id = (select auth.uid()) or (select public.est_fondateur())))
  );

-- storage.objects : écriture R sur les images de cours (ajout) et de questions (ajout, modification, suppression) ;
-- les noms sont gardés (R5), la lecture publique ne change pas
drop policy cours_images_ecriture on storage.objects;
drop policy qcm_images_admin_delete on storage.objects;
drop policy qcm_images_admin_insert on storage.objects;
drop policy qcm_images_admin_update on storage.objects;
create policy cours_images_ecriture on storage.objects
  as permissive for insert to authenticated
  with check (bucket_id = 'cours-images' and (select public.redacteur_contenus()));
create policy qcm_images_admin_delete on storage.objects
  as permissive for delete to authenticated
  using (bucket_id = 'qcm-images' and (select public.redacteur_contenus()));
create policy qcm_images_admin_insert on storage.objects
  as permissive for insert to authenticated
  with check (bucket_id = 'qcm-images' and (select public.redacteur_contenus()));
create policy qcm_images_admin_update on storage.objects
  as permissive for update to authenticated
  using (bucket_id = 'qcm-images' and (select public.redacteur_contenus()))
  with check (bucket_id = 'qcm-images' and (select public.redacteur_contenus()));
