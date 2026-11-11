-- Marche arrière de 20261112_titres_3_regles.sql : chacune des 93 règles retrouve l'expression d'origine (celle de la dernière
-- migration qui la définit, relue dans les fichiers : 20261001_multi_promo_2_cloisonnement, 20261023_emargement, 20261028_roles_3_regles,
-- 20261110_profils_email_stagiaires). Même garde que l'aller : une règle absente arrête la migration avec son nom.
-- Généré par outils/generer_regles_titres_3.py : ne pas éditer à la main.
set local lock_timeout = '3s';

do $garde$
declare
  v_regle record;
begin
  for v_regle in
    select g.schema_name, g.table_name, g.policy_name
      from (values
    ('public', 'agenda_events', 'agenda_events_ecriture'),
    ('public', 'planning_entries', 'planning_entries_ecriture'),
    ('public', 'planning_half_meta', 'planning_half_meta_ecriture'),
    ('public', 'planning_jours_off', 'planning_jours_off_ecriture'),
    ('public', 'passages', 'passages_ajout'),
    ('public', 'passages', 'passages_modification'),
    ('public', 'passages', 'passages_suppression'),
    ('public', 'emargement_lignes', 'emargement_lignes_lecture'),
    ('public', 'emargement_formateurs', 'emargement_formateurs_lecture'),
    ('public', 'stagiaires', 'stagiaires_ajout'),
    ('public', 'stagiaires', 'stagiaires_modification'),
    ('public', 'stagiaires', 'stagiaires_suppression'),
    ('public', 'stagiaires_prive', 'stagiaires_prive_lecture'),
    ('public', 'user_profiles', 'user_profiles_lecture'),
    ('public', 'user_profiles', 'user_profiles_suppression'),
    ('public', 'conditions_acceptations', 'conditions_acceptations_lecture'),
    ('public', 'effacements_journal', 'effacements_journal_lecture'),
    ('public', 'auto_ecoles', 'auto_ecoles_lecture'),
    ('public', 'auto_ecoles', 'auto_ecoles_ajout'),
    ('public', 'auto_ecoles', 'auto_ecoles_modification'),
    ('public', 'benevoles', 'benevoles_lecture'),
    ('public', 'benevoles', 'benevoles_ajout'),
    ('public', 'benevoles', 'benevoles_modification'),
    ('public', 'benevole_suivi', 'benevole_suivi_lecture'),
    ('public', 'benevole_suivi', 'benevole_suivi_ajout'),
    ('public', 'benevole_suivi', 'benevole_suivi_modification'),
    ('public', 'auto_ecoles', 'auto_ecoles_suppression'),
    ('public', 'benevole_suivi', 'benevole_suivi_suppression'),
    ('public', 'benevoles', 'benevoles_suppression'),
    ('public', 'evaluations', 'evaluations_lecture'),
    ('public', 'evaluations', 'evaluations_ecriture'),
    ('public', 'evaluations_audit', 'evaluations_audit_lecture'),
    ('public', 'epcf_evaluations', 'epcf_evaluations_lecture'),
    ('public', 'epcf_evaluations', 'epcf_evaluations_ajout'),
    ('public', 'epcf_evaluations', 'epcf_evaluations_modification'),
    ('public', 'epcf_evaluations', 'epcf_evaluations_suppression'),
    ('public', 'epcf_livrets', 'epcf_livrets_lecture'),
    ('public', 'epcf_livrets', 'epcf_livrets_ajout'),
    ('public', 'epcf_livrets', 'epcf_livrets_modification'),
    ('public', 'epcf_livrets', 'epcf_livrets_suppression'),
    ('public', 'dp_dossiers', 'dp_dossiers_lecture'),
    ('public', 'dp_dossiers', 'dp_dossiers_ajout'),
    ('public', 'dp_dossiers', 'dp_dossiers_modification'),
    ('public', 'dp_dossiers', 'dp_dossiers_suppression'),
    ('public', 'fiches_suivi', 'fiches_suivi_lecture'),
    ('public', 'fiches_suivi', 'fiches_suivi_ajout'),
    ('public', 'fiches_suivi', 'fiches_suivi_modification'),
    ('public', 'fiches_suivi', 'fiches_suivi_suppression'),
    ('public', 'qcm_attempts', 'qcm_attempts_lecture'),
    ('public', 'qcm_attempts', 'qcm_attempts_ajout'),
    ('public', 'qcm_attempts', 'qcm_attempts_modification'),
    ('public', 'qcm_attempts', 'qcm_attempts_suppression'),
    ('public', 'qcm_examens', 'qcm_examens_ajout'),
    ('public', 'qcm_examens', 'qcm_examens_modification'),
    ('public', 'qcm_examens', 'qcm_examens_suppression'),
    ('public', 'themes_progression', 'themes_progression_ajout'),
    ('public', 'themes_progression', 'themes_progression_modification'),
    ('public', 'themes_progression', 'themes_progression_suppression'),
    ('public', 'cours', 'cours_lecture'),
    ('public', 'cours_versions', 'cours_versions_lecture'),
    ('public', 'cours', 'cours_modification'),
    ('public', 'cours_versions', 'cours_versions_ajout'),
    ('public', 'qcm_questions', 'qcm_questions_ecriture'),
    ('public', 'qcm_options', 'qcm_options_ecriture'),
    ('storage', 'objects', 'cours_images_ecriture'),
    ('storage', 'objects', 'qcm_images_admin_insert'),
    ('storage', 'objects', 'qcm_images_admin_update'),
    ('storage', 'objects', 'qcm_images_admin_delete'),
    ('public', 'qcm', 'qcm_ecriture'),
    ('public', 'themes', 'themes_ecriture'),
    ('public', 'competences', 'competences_ecriture'),
    ('public', 'ressources', 'ressources_ecriture'),
    ('public', 'qcm_signalements', 'qcm_signalements_lecture'),
    ('public', 'qcm_signalements', 'qcm_signalements_modification'),
    ('public', 'qcm_signalements', 'qcm_signalements_suppression'),
    ('public', 'qcm_signalement_instruction', 'qcm_signalement_instruction_lecture'),
    ('public', 'qcm_ia_brouillons', 'qcm_ia_brouillons_lecture'),
    ('public', 'settings', 'settings_ecriture'),
    ('public', 'contacts', 'contacts_ecriture'),
    ('public', 'profs', 'profs_ecriture'),
    ('public', 'agenda_events', 'agenda_select_authenticated'),
    ('public', 'planning_entries', 'planning_entries_select_all'),
    ('public', 'planning_half_meta', 'planning_half_meta_select_all'),
    ('public', 'planning_jours_off', 'planning_jours_off_select_all'),
    ('public', 'emargement_seances', 'emargement_seances_select'),
    ('public', 'stagiaires', 'stagiaires_select_all'),
    ('public', 'passages', 'passages_select_all'),
    ('public', 'passages_audit', 'passages_audit_select'),
    ('public', 'qcm_examens', 'qcm_examens_select'),
    ('public', 'themes_progression', 'themes_progression_select'),
    ('public', 'promos', 'promos_modification'),
    ('public', 'affectations', 'affectations_ajout'),
    ('public', 'affectations', 'affectations_retrait')
      ) as g(schema_name, table_name, policy_name)
     where not exists (select 1 from pg_policies p
                        where p.schemaname = g.schema_name and p.tablename = g.table_name and p.policyname = g.policy_name)
  loop
    raise exception 'titres_3: la règle % sur %.% n''existe pas', v_regle.policy_name, v_regle.schema_name, v_regle.table_name;
  end loop;
end
$garde$;

-- agenda_events.agenda_events_ecriture (20261028_roles_3_regles.sql)
alter policy agenda_events_ecriture on public.agenda_events
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- planning_entries.planning_entries_ecriture (20261028_roles_3_regles.sql)
alter policy planning_entries_ecriture on public.planning_entries
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- planning_half_meta.planning_half_meta_ecriture (20261028_roles_3_regles.sql)
alter policy planning_half_meta_ecriture on public.planning_half_meta
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- planning_jours_off.planning_jours_off_ecriture (20261028_roles_3_regles.sql)
alter policy planning_jours_off_ecriture on public.planning_jours_off
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- passages.passages_ajout (20261028_roles_3_regles.sql)
alter policy passages_ajout on public.passages
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- passages.passages_modification (20261028_roles_3_regles.sql)
alter policy passages_modification on public.passages
  using (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  )
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- passages.passages_suppression (20261028_roles_3_regles.sql)
alter policy passages_suppression on public.passages
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- emargement_lignes.emargement_lignes_lecture (20261028_roles_3_regles.sql)
alter policy emargement_lignes_lecture on public.emargement_lignes
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- emargement_formateurs.emargement_formateurs_lecture (20261028_roles_3_regles.sql)
alter policy emargement_formateurs_lecture on public.emargement_formateurs
  using (promo_id = (select public.promo_courante()) and (select public.equipe_courante()));

-- stagiaires.stagiaires_ajout (20261028_roles_3_regles.sql)
alter policy stagiaires_ajout on public.stagiaires
  with check (promo_id = (select public.promo_courante()) and (select public.equipe_courante()));

-- stagiaires.stagiaires_modification (20261028_roles_3_regles.sql)
alter policy stagiaires_modification on public.stagiaires
  using (promo_id = (select public.promo_courante()) and (select public.equipe_courante()))
  with check (promo_id = (select public.promo_courante()) and (select public.equipe_courante()));

-- stagiaires.stagiaires_suppression (20261028_roles_3_regles.sql)
alter policy stagiaires_suppression on public.stagiaires
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- stagiaires_prive.stagiaires_prive_lecture (20261028_roles_3_regles.sql)
alter policy stagiaires_prive_lecture on public.stagiaires_prive
  using (
    exists (select 1 from public.stagiaires s
             where s.id = stagiaires_prive.stagiaire_id and s.promo_id = (select public.promo_courante()))
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- user_profiles.user_profiles_lecture (20261110_profils_email_stagiaires.sql)
alter policy user_profiles_lecture on public.user_profiles
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (stagiaire_id is null and role <> 'stagiaire'
        and ((select public.promo_par_defaut()) is not null or (select public.est_siege()) or (select public.est_fondateur())))
    or (stagiaire_id is null and role = 'stagiaire'
        and ((select public.est_fondateur()) or lower(invited_by_email) = lower((select auth.jwt() ->> 'email'))))
    or (stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))
        and (select public.equipe_courante()))
  );

-- user_profiles.user_profiles_suppression (20261028_roles_3_regles.sql)
alter policy user_profiles_suppression on public.user_profiles
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

-- conditions_acceptations.conditions_acceptations_lecture (20261028_roles_3_regles.sql)
alter policy conditions_acceptations_lecture on public.conditions_acceptations
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (select public.est_fondateur())
    or ((select public.equipe_courante())
        and lower(email) in (select lower(u.email) from public.user_profiles u
                              where u.stagiaire_id in (select s.id from public.stagiaires s
                                                        where s.promo_id = (select public.promo_courante()))))
  );

-- effacements_journal.effacements_journal_lecture (20261028_roles_3_regles.sql)
alter policy effacements_journal_lecture on public.effacements_journal
  using (
    (select public.est_fondateur())
    or ((select public.equipe_courante())
        and (cible = 'promo ' || (select public.promo_courante())
             or cible = 'lieu ' || (select public.lieu_courant())
             or cible in (select 'stagiaire ' || s.id from public.stagiaires s
                           where s.promo_id = (select public.promo_courante()))))
  );

-- auto_ecoles.auto_ecoles_lecture (20261028_roles_3_regles.sql)
alter policy auto_ecoles_lecture on public.auto_ecoles
  using (lieu_id = (select public.lieu_courant()) and (select public.equipe_courante()));

-- auto_ecoles.auto_ecoles_ajout (20261028_roles_3_regles.sql)
alter policy auto_ecoles_ajout on public.auto_ecoles
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- auto_ecoles.auto_ecoles_modification (20261028_roles_3_regles.sql)
alter policy auto_ecoles_modification on public.auto_ecoles
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()))
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- benevoles.benevoles_lecture (20261028_roles_3_regles.sql)
alter policy benevoles_lecture on public.benevoles
  using (lieu_id = (select public.lieu_courant()) and (select public.equipe_courante()));

-- benevoles.benevoles_ajout (20261028_roles_3_regles.sql)
alter policy benevoles_ajout on public.benevoles
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- benevoles.benevoles_modification (20261028_roles_3_regles.sql)
alter policy benevoles_modification on public.benevoles
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()))
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- benevole_suivi.benevole_suivi_lecture (20261028_roles_3_regles.sql)
alter policy benevole_suivi_lecture on public.benevole_suivi
  using (lieu_id = (select public.lieu_courant()) and (select public.equipe_courante()));

-- benevole_suivi.benevole_suivi_ajout (20261028_roles_3_regles.sql)
alter policy benevole_suivi_ajout on public.benevole_suivi
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- benevole_suivi.benevole_suivi_modification (20261028_roles_3_regles.sql)
alter policy benevole_suivi_modification on public.benevole_suivi
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()))
  with check (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- auto_ecoles.auto_ecoles_suppression (20261028_roles_3_regles.sql)
alter policy auto_ecoles_suppression on public.auto_ecoles
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- benevole_suivi.benevole_suivi_suppression (20261028_roles_3_regles.sql)
alter policy benevole_suivi_suppression on public.benevole_suivi
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- benevoles.benevoles_suppression (20261028_roles_3_regles.sql)
alter policy benevoles_suppression on public.benevoles
  using (lieu_id = (select public.lieu_courant()) and (select public.formateur_courant()));

-- evaluations.evaluations_lecture (20261028_roles_3_regles.sql)
alter policy evaluations_lecture on public.evaluations
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id in (select public.notes_stagiaires_visibles()))
  );

-- evaluations.evaluations_ecriture (20261028_roles_3_regles.sql)
alter policy evaluations_ecriture on public.evaluations
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- evaluations_audit.evaluations_audit_lecture (20261028_roles_3_regles.sql)
alter policy evaluations_audit_lecture on public.evaluations_audit
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or evaluation_id in (select e.id from public.evaluations e))
  );

-- epcf_evaluations.epcf_evaluations_lecture (20261028_roles_3_regles.sql)
alter policy epcf_evaluations_lecture on public.epcf_evaluations
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- epcf_evaluations.epcf_evaluations_ajout (20261028_roles_3_regles.sql)
alter policy epcf_evaluations_ajout on public.epcf_evaluations
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- epcf_evaluations.epcf_evaluations_modification (20261028_roles_3_regles.sql)
alter policy epcf_evaluations_modification on public.epcf_evaluations
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- epcf_evaluations.epcf_evaluations_suppression (20261028_roles_3_regles.sql)
alter policy epcf_evaluations_suppression on public.epcf_evaluations
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- epcf_livrets.epcf_livrets_lecture (20261028_roles_3_regles.sql)
alter policy epcf_livrets_lecture on public.epcf_livrets
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- epcf_livrets.epcf_livrets_ajout (20261028_roles_3_regles.sql)
alter policy epcf_livrets_ajout on public.epcf_livrets
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- epcf_livrets.epcf_livrets_modification (20261028_roles_3_regles.sql)
alter policy epcf_livrets_modification on public.epcf_livrets
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- epcf_livrets.epcf_livrets_suppression (20261028_roles_3_regles.sql)
alter policy epcf_livrets_suppression on public.epcf_livrets
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- dp_dossiers.dp_dossiers_lecture (20261028_roles_3_regles.sql)
alter policy dp_dossiers_lecture on public.dp_dossiers
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- dp_dossiers.dp_dossiers_ajout (20261028_roles_3_regles.sql)
alter policy dp_dossiers_ajout on public.dp_dossiers
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- dp_dossiers.dp_dossiers_modification (20261028_roles_3_regles.sql)
alter policy dp_dossiers_modification on public.dp_dossiers
  using (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  )
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- dp_dossiers.dp_dossiers_suppression (20261028_roles_3_regles.sql)
alter policy dp_dossiers_suppression on public.dp_dossiers
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- fiches_suivi.fiches_suivi_lecture (20261028_roles_3_regles.sql)
alter policy fiches_suivi_lecture on public.fiches_suivi
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- fiches_suivi.fiches_suivi_ajout (20261028_roles_3_regles.sql)
alter policy fiches_suivi_ajout on public.fiches_suivi
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- fiches_suivi.fiches_suivi_modification (20261028_roles_3_regles.sql)
alter policy fiches_suivi_modification on public.fiches_suivi
  using (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  )
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- fiches_suivi.fiches_suivi_suppression (20261028_roles_3_regles.sql)
alter policy fiches_suivi_suppression on public.fiches_suivi
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- qcm_attempts.qcm_attempts_lecture (20261028_roles_3_regles.sql)
alter policy qcm_attempts_lecture on public.qcm_attempts
  using (
    promo_id = (select public.promo_courante())
    and ((select public.equipe_courante()) or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- qcm_attempts.qcm_attempts_ajout (20261028_roles_3_regles.sql)
alter policy qcm_attempts_ajout on public.qcm_attempts
  with check (
    promo_id = (select public.promo_courante())
    and ((select public.formateur_courant())
         or (stagiaire_id = (select public.my_stagiaire_id())
             and (mode = 'entrainement' or (mode = 'examen' and public.qcm_exam_remise_toleree(qcm_id)))))
  );

-- qcm_attempts.qcm_attempts_modification (20261028_roles_3_regles.sql)
alter policy qcm_attempts_modification on public.qcm_attempts
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- qcm_attempts.qcm_attempts_suppression (20261028_roles_3_regles.sql)
alter policy qcm_attempts_suppression on public.qcm_attempts
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- qcm_examens.qcm_examens_ajout (20261028_roles_3_regles.sql)
alter policy qcm_examens_ajout on public.qcm_examens
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- qcm_examens.qcm_examens_modification (20261028_roles_3_regles.sql)
alter policy qcm_examens_modification on public.qcm_examens
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- qcm_examens.qcm_examens_suppression (20261028_roles_3_regles.sql)
alter policy qcm_examens_suppression on public.qcm_examens
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- themes_progression.themes_progression_ajout (20261028_roles_3_regles.sql)
alter policy themes_progression_ajout on public.themes_progression
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- themes_progression.themes_progression_modification (20261028_roles_3_regles.sql)
alter policy themes_progression_modification on public.themes_progression
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()))
  with check (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- themes_progression.themes_progression_suppression (20261028_roles_3_regles.sql)
alter policy themes_progression_suppression on public.themes_progression
  using (promo_id = (select public.promo_courante()) and (select public.formateur_courant()));

-- cours.cours_lecture (20261028_roles_3_regles.sql)
alter policy cours_lecture on public.cours
  using (
    published
    or (select public.est_fondateur())
    or (code is null and ((select public.formateur_courant()) or (select public.direction_courante())
                          or (select public.est_siege())))
  );

-- cours_versions.cours_versions_lecture (20261028_roles_3_regles.sql)
alter policy cours_versions_lecture on public.cours_versions
  using (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.direction_courante()) or (select public.est_siege()))
        and exists (select 1 from public.cours c
                     where c.id = cours_versions.cours_id and (c.code is null or c.published)))
  );

-- cours.cours_modification (20261028_roles_3_regles.sql)
alter policy cours_modification on public.cours
  using (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.est_siege())) and (code is null or published))
  )
  with check (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.est_siege())) and (code is null or published))
  );

-- cours_versions.cours_versions_ajout (20261028_roles_3_regles.sql)
alter policy cours_versions_ajout on public.cours_versions
  with check (
    (select public.est_fondateur())
    or (((select public.formateur_courant()) or (select public.est_siege()))
        and exists (select 1 from public.cours c
                     where c.id = cours_versions.cours_id and (c.code is null or c.published)))
  );

-- qcm_questions.qcm_questions_ecriture (20261028_roles_3_regles.sql)
alter policy qcm_questions_ecriture on public.qcm_questions
  using ((select public.redacteur_contenus()))
  with check ((select public.redacteur_contenus()));

-- qcm_options.qcm_options_ecriture (20261028_roles_3_regles.sql)
alter policy qcm_options_ecriture on public.qcm_options
  using ((select public.redacteur_contenus()))
  with check ((select public.redacteur_contenus()));

-- objects.cours_images_ecriture (20261028_roles_3_regles.sql)
alter policy cours_images_ecriture on storage.objects
  with check (bucket_id = 'cours-images' and (select public.redacteur_contenus()));

-- objects.qcm_images_admin_insert (20261028_roles_3_regles.sql)
alter policy qcm_images_admin_insert on storage.objects
  with check (bucket_id = 'qcm-images' and (select public.redacteur_contenus()));

-- objects.qcm_images_admin_update (20261028_roles_3_regles.sql)
alter policy qcm_images_admin_update on storage.objects
  using (bucket_id = 'qcm-images' and (select public.redacteur_contenus()))
  with check (bucket_id = 'qcm-images' and (select public.redacteur_contenus()));

-- objects.qcm_images_admin_delete (20261028_roles_3_regles.sql)
alter policy qcm_images_admin_delete on storage.objects
  using (bucket_id = 'qcm-images' and (select public.redacteur_contenus()));

-- qcm.qcm_ecriture (20261028_roles_3_regles.sql)
alter policy qcm_ecriture on public.qcm
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- themes.themes_ecriture (20261028_roles_3_regles.sql)
alter policy themes_ecriture on public.themes
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- competences.competences_ecriture (20261028_roles_3_regles.sql)
alter policy competences_ecriture on public.competences
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- ressources.ressources_ecriture (20261028_roles_3_regles.sql)
alter policy ressources_ecriture on public.ressources
  using ((select public.formateur_courant()))
  with check ((select public.formateur_courant()));

-- qcm_signalements.qcm_signalements_lecture (20261028_roles_3_regles.sql)
alter policy qcm_signalements_lecture on public.qcm_signalements
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (select public.est_fondateur())
    or ((select public.formateur_courant())
        and (stagiaire_id is null
             or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))))
  );

-- qcm_signalements.qcm_signalements_modification (20261028_roles_3_regles.sql)
alter policy qcm_signalements_modification on public.qcm_signalements
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

-- qcm_signalements.qcm_signalements_suppression (20261028_roles_3_regles.sql)
alter policy qcm_signalements_suppression on public.qcm_signalements
  using (
    (select public.est_fondateur())
    or ((select public.formateur_courant())
        and (stagiaire_id is null
             or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))))
  );

-- qcm_signalement_instruction.qcm_signalement_instruction_lecture (20261028_roles_3_regles.sql)
alter policy qcm_signalement_instruction_lecture on public.qcm_signalement_instruction
  using ((select public.formateur_courant()));

-- qcm_ia_brouillons.qcm_ia_brouillons_lecture (20261028_roles_3_regles.sql)
alter policy qcm_ia_brouillons_lecture on public.qcm_ia_brouillons
  using ((select public.formateur_courant()));

-- settings.settings_ecriture (20261028_roles_3_regles.sql)
alter policy settings_ecriture on public.settings
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

-- contacts.contacts_ecriture (20261028_roles_3_regles.sql)
alter policy contacts_ecriture on public.contacts
  using ((select public.equipe_courante()))
  with check ((select public.equipe_courante()));

-- profs.profs_ecriture (20261028_roles_3_regles.sql)
alter policy profs_ecriture on public.profs
  using ((select public.equipe_courante()))
  with check ((select public.equipe_courante()));

-- agenda_events.agenda_select_authenticated (20261001_multi_promo_2_cloisonnement.sql)
alter policy agenda_select_authenticated on public.agenda_events
  using (promo_id = (select promo_courante()));

-- planning_entries.planning_entries_select_all (20261001_multi_promo_2_cloisonnement.sql)
alter policy planning_entries_select_all on public.planning_entries
  using (promo_id = (select promo_courante()));

-- planning_half_meta.planning_half_meta_select_all (20261001_multi_promo_2_cloisonnement.sql)
alter policy planning_half_meta_select_all on public.planning_half_meta
  using (promo_id = (select promo_courante()));

-- planning_jours_off.planning_jours_off_select_all (20261001_multi_promo_2_cloisonnement.sql)
alter policy planning_jours_off_select_all on public.planning_jours_off
  using (promo_id = (select promo_courante()));

-- emargement_seances.emargement_seances_select (20261023_emargement.sql)
alter policy emargement_seances_select on public.emargement_seances
  using (promo_id = (select public.promo_courante()));

-- stagiaires.stagiaires_select_all (20261001_multi_promo_2_cloisonnement.sql)
alter policy stagiaires_select_all on public.stagiaires
  using (promo_id = (select promo_courante()));

-- passages.passages_select_all (20261001_multi_promo_2_cloisonnement.sql)
alter policy passages_select_all on public.passages
  using (promo_id = (select promo_courante()));

-- passages_audit.passages_audit_select (20261001_multi_promo_2_cloisonnement.sql)
alter policy passages_audit_select on public.passages_audit
  using (promo_id = (select promo_courante()));

-- qcm_examens.qcm_examens_select (20261001_multi_promo_2_cloisonnement.sql)
alter policy qcm_examens_select on public.qcm_examens
  using (promo_id = (select promo_courante()));

-- themes_progression.themes_progression_select (20261001_multi_promo_2_cloisonnement.sql)
alter policy themes_progression_select on public.themes_progression
  using (promo_id = (select promo_courante()));

-- promos.promos_modification (20261028_roles_3_regles.sql)
alter policy promos_modification on public.promos
  using (public.est_formateur(id) or public.est_direction(lieu_id))
  with check (public.est_formateur(id) or public.est_direction(lieu_id));

-- affectations.affectations_ajout (20261028_roles_1_fondations.sql)
alter policy affectations_ajout on public.affectations
  with check (
       (role = 'formateur' and public.est_direction(public.lieu_de_promo(promo_id)))
    or (role = 'direction' and (select public.est_siege()))
    or (role = 'siege' and (select public.est_fondateur()))
  );

-- affectations.affectations_retrait (20261028_roles_1_fondations.sql)
alter policy affectations_retrait on public.affectations
  using (
       (role = 'formateur' and public.est_direction(public.lieu_de_promo(promo_id)))
    or (role = 'direction' and (select public.est_siege()))
    or (role = 'siege' and (select public.est_fondateur()))
  );
