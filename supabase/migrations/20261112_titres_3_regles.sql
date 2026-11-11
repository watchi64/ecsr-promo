-- Titres et droits à la carte, étape 1, migration 3 : les 93 règles de sécurité passent par les gestes (geste_promo, geste_centre,
-- geste_reseau, membre_stagiaire, posés par la migration 2). Chaque règle garde son nom, sa commande et ses rôles (alter policy, jamais
-- drop + create) ; seul l'ancien prédicat (formateur_courant, equipe_courante, redacteur_contenus, direction_courante, est_siege...) est
-- remplacé par le geste qui lui correspond, appelé en sous-requête (select ...) pour n'être calculé qu'une fois par requête.
-- Pour les titres fixes d'aujourd'hui (Formateur, Direction de centre, Siège) chaque règle donne exactement les mêmes lignes qu'avant
-- (preuve du lot 4 inchangée) ; un titre non fixe n'ouvre que ce que ses cases ouvrent.
--   * Lectures « P » (toute personne qui a accès à la promo affichée) : membre stagiaire de la promo, ou geste de lecture de la page.
--   * Clauses « M » (sa fiche, son adresse, son identifiant) et clauses du fondateur : inchangées.
--   * Réglages : la clé « modules » suit le geste modules.modifier, les clés navigation_v2 et emargement_actif restent au fondateur.
--   * Affectations : formateurs.nommer pour une ligne de formateur, directions.nommer pour une ligne de direction ; la ligne de siège
--     reste au fondateur.
-- Garde : chaque règle nommée doit exister, sinon la migration s'arrête avec son nom et ne change rien.
-- Marche arrière : 20261112_titres_3_regles_retour.sql (remet l'expression d'origine, relue dans les fichiers de migration).
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

-- agenda_events.agenda_events_ecriture
alter policy agenda_events_ecriture on public.agenda_events
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')));

-- planning_entries.planning_entries_ecriture
alter policy planning_entries_ecriture on public.planning_entries
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')));

-- planning_half_meta.planning_half_meta_ecriture
alter policy planning_half_meta_ecriture on public.planning_half_meta
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')));

-- planning_jours_off.planning_jours_off_ecriture
alter policy planning_jours_off_ecriture on public.planning_jours_off
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')));

-- passages.passages_ajout
alter policy passages_ajout on public.passages
  with check (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'planning.modifier')) or stagiaire_id = (select public.my_stagiaire_id())));

-- passages.passages_modification
alter policy passages_modification on public.passages
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'planning.modifier')) or stagiaire_id = (select public.my_stagiaire_id())))
  with check (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'planning.modifier')) or stagiaire_id = (select public.my_stagiaire_id())));

-- passages.passages_suppression
alter policy passages_suppression on public.passages
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'planning.modifier')));

-- emargement_lignes.emargement_lignes_lecture
alter policy emargement_lignes_lecture on public.emargement_lignes
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'emargement.lire')) or stagiaire_id = (select public.my_stagiaire_id())));

-- emargement_formateurs.emargement_formateurs_lecture
alter policy emargement_formateurs_lecture on public.emargement_formateurs
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'emargement.lire')));

-- stagiaires.stagiaires_ajout
alter policy stagiaires_ajout on public.stagiaires
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.gerer')));

-- stagiaires.stagiaires_modification
alter policy stagiaires_modification on public.stagiaires
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.gerer')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.gerer')));

-- stagiaires.stagiaires_suppression
alter policy stagiaires_suppression on public.stagiaires
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.supprimer')));

-- stagiaires_prive.stagiaires_prive_lecture
alter policy stagiaires_prive_lecture on public.stagiaires_prive
  using (exists (select 1 from public.stagiaires s where s.id = stagiaires_prive.stagiaire_id and s.promo_id = (select public.promo_courante())) and ((select public.geste_promo((select public.promo_courante()), 'stagiaires.lire')) or stagiaire_id = (select public.my_stagiaire_id())));

-- user_profiles.user_profiles_lecture
alter policy user_profiles_lecture on public.user_profiles
  using (lower(email) = lower((select auth.jwt() ->> 'email')) or (stagiaire_id is null and role <> 'stagiaire' and ((select public.promo_par_defaut()) is not null or (select public.est_siege()) or (select public.est_fondateur()))) or (stagiaire_id is null and role = 'stagiaire' and ((select public.est_fondateur()) or lower(invited_by_email) = lower((select auth.jwt() ->> 'email')))) or (stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.lire'))));

-- user_profiles.user_profiles_suppression
alter policy user_profiles_suppression on public.user_profiles
  using (not is_founder and not public.a_une_affectation(email) and ( (stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.gerer'))) or (stagiaire_id is null and role = 'stagiaire' and ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'stagiaires.gerer')) and lower(invited_by_email) = lower((select auth.jwt() ->> 'email'))))) or (stagiaire_id is null and role <> 'stagiaire' and (select public.est_fondateur())) ));

-- conditions_acceptations.conditions_acceptations_lecture
alter policy conditions_acceptations_lecture on public.conditions_acceptations
  using (lower(email) = lower((select auth.jwt() ->> 'email')) or (select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'stagiaires.lire')) and lower(email) in (select lower(u.email) from public.user_profiles u where u.stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())))));

-- effacements_journal.effacements_journal_lecture
alter policy effacements_journal_lecture on public.effacements_journal
  using ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'stagiaires.lire')) and (cible = 'promo ' || (select public.promo_courante()) or cible = 'lieu ' || (select public.lieu_courant()) or cible in (select 'stagiaire ' || s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())))));

-- auto_ecoles.auto_ecoles_lecture
alter policy auto_ecoles_lecture on public.auto_ecoles
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.lire')));

-- auto_ecoles.auto_ecoles_ajout
alter policy auto_ecoles_ajout on public.auto_ecoles
  with check (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- auto_ecoles.auto_ecoles_modification
alter policy auto_ecoles_modification on public.auto_ecoles
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')))
  with check (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- benevoles.benevoles_lecture
alter policy benevoles_lecture on public.benevoles
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.lire')));

-- benevoles.benevoles_ajout
alter policy benevoles_ajout on public.benevoles
  with check (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- benevoles.benevoles_modification
alter policy benevoles_modification on public.benevoles
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')))
  with check (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- benevole_suivi.benevole_suivi_lecture
alter policy benevole_suivi_lecture on public.benevole_suivi
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.lire')));

-- benevole_suivi.benevole_suivi_ajout
alter policy benevole_suivi_ajout on public.benevole_suivi
  with check (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- benevole_suivi.benevole_suivi_modification
alter policy benevole_suivi_modification on public.benevole_suivi
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')))
  with check (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- auto_ecoles.auto_ecoles_suppression
alter policy auto_ecoles_suppression on public.auto_ecoles
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- benevole_suivi.benevole_suivi_suppression
alter policy benevole_suivi_suppression on public.benevole_suivi
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.gerer')));

-- benevoles.benevoles_suppression
alter policy benevoles_suppression on public.benevoles
  using (lieu_id = (select public.lieu_courant()) and (select public.geste_promo((select public.promo_courante()), 'benevoles.purger')));

-- evaluations.evaluations_lecture
alter policy evaluations_lecture on public.evaluations
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.lire')) or ((select public.membre_stagiaire((select public.promo_courante()))) and stagiaire_id in (select public.notes_stagiaires_visibles()))));

-- evaluations.evaluations_ecriture
alter policy evaluations_ecriture on public.evaluations
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- evaluations_audit.evaluations_audit_lecture
alter policy evaluations_audit_lecture on public.evaluations_audit
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.lire')) or evaluation_id in (select e.id from public.evaluations e)));

-- epcf_evaluations.epcf_evaluations_lecture
alter policy epcf_evaluations_lecture on public.epcf_evaluations
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.lire')) or stagiaire_id = (select public.my_stagiaire_id())));

-- epcf_evaluations.epcf_evaluations_ajout
alter policy epcf_evaluations_ajout on public.epcf_evaluations
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- epcf_evaluations.epcf_evaluations_modification
alter policy epcf_evaluations_modification on public.epcf_evaluations
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- epcf_evaluations.epcf_evaluations_suppression
alter policy epcf_evaluations_suppression on public.epcf_evaluations
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- epcf_livrets.epcf_livrets_lecture
alter policy epcf_livrets_lecture on public.epcf_livrets
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.lire')) or stagiaire_id = (select public.my_stagiaire_id())));

-- epcf_livrets.epcf_livrets_ajout
alter policy epcf_livrets_ajout on public.epcf_livrets
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- epcf_livrets.epcf_livrets_modification
alter policy epcf_livrets_modification on public.epcf_livrets
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- epcf_livrets.epcf_livrets_suppression
alter policy epcf_livrets_suppression on public.epcf_livrets
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- dp_dossiers.dp_dossiers_lecture
alter policy dp_dossiers_lecture on public.dp_dossiers
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.lire')) or stagiaire_id = (select public.my_stagiaire_id())));

-- dp_dossiers.dp_dossiers_ajout
alter policy dp_dossiers_ajout on public.dp_dossiers
  with check (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.saisir')) or stagiaire_id = (select public.my_stagiaire_id())));

-- dp_dossiers.dp_dossiers_modification
alter policy dp_dossiers_modification on public.dp_dossiers
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.saisir')) or stagiaire_id = (select public.my_stagiaire_id())))
  with check (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.saisir')) or stagiaire_id = (select public.my_stagiaire_id())));

-- dp_dossiers.dp_dossiers_suppression
alter policy dp_dossiers_suppression on public.dp_dossiers
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- fiches_suivi.fiches_suivi_lecture
alter policy fiches_suivi_lecture on public.fiches_suivi
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.lire')) or stagiaire_id = (select public.my_stagiaire_id())));

-- fiches_suivi.fiches_suivi_ajout
alter policy fiches_suivi_ajout on public.fiches_suivi
  with check (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.saisir')) or stagiaire_id = (select public.my_stagiaire_id())));

-- fiches_suivi.fiches_suivi_modification
alter policy fiches_suivi_modification on public.fiches_suivi
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.saisir')) or stagiaire_id = (select public.my_stagiaire_id())))
  with check (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.saisir')) or stagiaire_id = (select public.my_stagiaire_id())));

-- fiches_suivi.fiches_suivi_suppression
alter policy fiches_suivi_suppression on public.fiches_suivi
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- qcm_attempts.qcm_attempts_lecture
alter policy qcm_attempts_lecture on public.qcm_attempts
  using (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.lire')) or stagiaire_id = (select public.my_stagiaire_id())));

-- qcm_attempts.qcm_attempts_ajout
alter policy qcm_attempts_ajout on public.qcm_attempts
  with check (promo_id = (select public.promo_courante()) and ((select public.geste_promo((select public.promo_courante()), 'notes.saisir')) or (stagiaire_id = (select public.my_stagiaire_id()) and (mode = 'entrainement' or (mode = 'examen' and public.qcm_exam_remise_toleree(qcm_id))))));

-- qcm_attempts.qcm_attempts_modification
alter policy qcm_attempts_modification on public.qcm_attempts
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- qcm_attempts.qcm_attempts_suppression
alter policy qcm_attempts_suppression on public.qcm_attempts
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- qcm_examens.qcm_examens_ajout
alter policy qcm_examens_ajout on public.qcm_examens
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- qcm_examens.qcm_examens_modification
alter policy qcm_examens_modification on public.qcm_examens
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- qcm_examens.qcm_examens_suppression
alter policy qcm_examens_suppression on public.qcm_examens
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- themes_progression.themes_progression_ajout
alter policy themes_progression_ajout on public.themes_progression
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- themes_progression.themes_progression_modification
alter policy themes_progression_modification on public.themes_progression
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- themes_progression.themes_progression_suppression
alter policy themes_progression_suppression on public.themes_progression
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));

-- cours.cours_lecture
alter policy cours_lecture on public.cours
  using (published or (select public.est_fondateur()) or (code is null and (select public.geste_promo((select public.promo_courante()), 'contenus.lire_internes'))));

-- cours_versions.cours_versions_lecture
alter policy cours_versions_lecture on public.cours_versions
  using ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.lire_internes')) and exists (select 1 from public.cours c where c.id = cours_versions.cours_id and (c.code is null or c.published))));

-- cours.cours_modification
alter policy cours_modification on public.cours
  using ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.rediger')) and (code is null or published)))
  with check ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.rediger')) and (code is null or published)));

-- cours_versions.cours_versions_ajout
alter policy cours_versions_ajout on public.cours_versions
  with check ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.rediger')) and exists (select 1 from public.cours c where c.id = cours_versions.cours_id and (c.code is null or c.published))));

-- qcm_questions.qcm_questions_ecriture
alter policy qcm_questions_ecriture on public.qcm_questions
  using ((select public.geste_promo((select public.promo_courante()), 'contenus.rediger')))
  with check ((select public.geste_promo((select public.promo_courante()), 'contenus.rediger')));

-- qcm_options.qcm_options_ecriture
alter policy qcm_options_ecriture on public.qcm_options
  using ((select public.geste_promo((select public.promo_courante()), 'contenus.rediger')))
  with check ((select public.geste_promo((select public.promo_courante()), 'contenus.rediger')));

-- objects.cours_images_ecriture
alter policy cours_images_ecriture on storage.objects
  with check (bucket_id = 'cours-images' and (select public.geste_promo((select public.promo_courante()), 'contenus.rediger')));

-- objects.qcm_images_admin_insert
alter policy qcm_images_admin_insert on storage.objects
  with check (bucket_id = 'qcm-images' and (select public.geste_promo((select public.promo_courante()), 'contenus.rediger')));

-- objects.qcm_images_admin_update
alter policy qcm_images_admin_update on storage.objects
  using (bucket_id = 'qcm-images' and (select public.geste_promo((select public.promo_courante()), 'contenus.rediger')))
  with check (bucket_id = 'qcm-images' and (select public.geste_promo((select public.promo_courante()), 'contenus.rediger')));

-- objects.qcm_images_admin_delete
alter policy qcm_images_admin_delete on storage.objects
  using (bucket_id = 'qcm-images' and (select public.geste_promo((select public.promo_courante()), 'contenus.rediger')));

-- qcm.qcm_ecriture
alter policy qcm_ecriture on public.qcm
  using ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')))
  with check ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')));

-- themes.themes_ecriture
alter policy themes_ecriture on public.themes
  using ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')))
  with check ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')));

-- competences.competences_ecriture
alter policy competences_ecriture on public.competences
  using ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')))
  with check ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')));

-- ressources.ressources_ecriture
alter policy ressources_ecriture on public.ressources
  using ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')))
  with check ((select public.geste_promo((select public.promo_courante()), 'referentiel.modifier')));

-- qcm_signalements.qcm_signalements_lecture
alter policy qcm_signalements_lecture on public.qcm_signalements
  using (lower(email) = lower((select auth.jwt() ->> 'email')) or (select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.traiter')) and (stagiaire_id is null or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())))));

-- qcm_signalements.qcm_signalements_modification
alter policy qcm_signalements_modification on public.qcm_signalements
  using ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.traiter')) and (stagiaire_id is null or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())))))
  with check ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.traiter')) and (stagiaire_id is null or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())))));

-- qcm_signalements.qcm_signalements_suppression
alter policy qcm_signalements_suppression on public.qcm_signalements
  using ((select public.est_fondateur()) or ((select public.geste_promo((select public.promo_courante()), 'contenus.traiter')) and (stagiaire_id is null or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())))));

-- qcm_signalement_instruction.qcm_signalement_instruction_lecture
alter policy qcm_signalement_instruction_lecture on public.qcm_signalement_instruction
  using ((select public.geste_promo((select public.promo_courante()), 'contenus.traiter')));

-- qcm_ia_brouillons.qcm_ia_brouillons_lecture
alter policy qcm_ia_brouillons_lecture on public.qcm_ia_brouillons
  using ((select public.geste_promo((select public.promo_courante()), 'contenus.traiter')));

-- settings.settings_ecriture
alter policy settings_ecriture on public.settings
  using (promo_id = (select public.promo_courante()) and case when key in ('navigation_v2', 'emargement_actif') then (select public.est_fondateur()) when key = 'modules' then (select public.geste_promo((select public.promo_courante()), 'modules.modifier')) else (select public.geste_promo((select public.promo_courante()), 'reglages.modifier')) end)
  with check (promo_id = (select public.promo_courante()) and case when key in ('navigation_v2', 'emargement_actif') then (select public.est_fondateur()) when key = 'modules' then (select public.geste_promo((select public.promo_courante()), 'modules.modifier')) else (select public.geste_promo((select public.promo_courante()), 'reglages.modifier')) end);

-- contacts.contacts_ecriture
alter policy contacts_ecriture on public.contacts
  using ((select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')))
  with check ((select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')));

-- profs.profs_ecriture
alter policy profs_ecriture on public.profs
  using ((select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')))
  with check ((select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')));

-- agenda_events.agenda_select_authenticated
alter policy agenda_select_authenticated on public.agenda_events
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'planning.lire'))));

-- planning_entries.planning_entries_select_all
alter policy planning_entries_select_all on public.planning_entries
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'planning.lire'))));

-- planning_half_meta.planning_half_meta_select_all
alter policy planning_half_meta_select_all on public.planning_half_meta
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'planning.lire'))));

-- planning_jours_off.planning_jours_off_select_all
alter policy planning_jours_off_select_all on public.planning_jours_off
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'planning.lire'))));

-- emargement_seances.emargement_seances_select
alter policy emargement_seances_select on public.emargement_seances
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'emargement.lire'))));

-- stagiaires.stagiaires_select_all
alter policy stagiaires_select_all on public.stagiaires
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'stagiaires.lire'))));

-- passages.passages_select_all
alter policy passages_select_all on public.passages
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'stagiaires.lire'))));

-- passages_audit.passages_audit_select
alter policy passages_audit_select on public.passages_audit
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'stagiaires.lire'))));

-- qcm_examens.qcm_examens_select
alter policy qcm_examens_select on public.qcm_examens
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'notes.lire'))));

-- themes_progression.themes_progression_select
alter policy themes_progression_select on public.themes_progression
  using (promo_id = (select public.promo_courante()) and ((select public.membre_stagiaire((select public.promo_courante()))) or (select public.geste_promo((select public.promo_courante()), 'notes.lire'))));

-- promos.promos_modification
alter policy promos_modification on public.promos
  using (public.geste_promo(id, 'promo.renommer'))
  with check (public.geste_promo(id, 'promo.renommer'));

-- affectations.affectations_ajout
alter policy affectations_ajout on public.affectations
  with check ((role = 'formateur' and public.geste_centre(public.lieu_de_promo(promo_id), 'formateurs.nommer')) or (role = 'direction' and (select public.geste_reseau('directions.nommer'))) or (role = 'siege' and (select public.est_fondateur())));

-- affectations.affectations_retrait
alter policy affectations_retrait on public.affectations
  using ((role = 'formateur' and public.geste_centre(public.lieu_de_promo(promo_id), 'formateurs.nommer')) or (role = 'direction' and (select public.geste_reseau('directions.nommer'))) or (role = 'siege' and (select public.est_fondateur())));
