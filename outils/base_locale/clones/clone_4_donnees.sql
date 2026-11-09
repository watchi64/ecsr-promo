-- Clone LOCAL, partie 4 : données FICTIVES, aux volumes et répartitions relevés (en nombre seulement) sur la
-- production le 28/10 au soir : 3 lieux (1, 2, 4), promos 1, 2, 7, 17 comptes (le fondateur avec une fiche en
-- promo 1, 3 formateurs role prof et is_admin, 13 stagiaires de la promo 1 dont 2 inactifs).
insert into public.lieux (id, nom) values (1, 'Lieu un'), (2, 'Lieu deux'), (4, 'Lieu quatre');
select setval(pg_get_serial_sequence('public.lieux', 'id'), 4);
insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values
  (1, 1, 'Promo un', '2026-03-30', '2026-12-11'), (2, 2, 'Promo deux', '2026-09-30', null), (7, 4, 'Promo sept', '2026-09-21', '2026-12-10');
select setval(pg_get_serial_sequence('public.promos', 'id'), 7);
insert into public.profs (nom, ordre) values ('Prof A', 1), ('Prof B', 2), ('Prof C', 3);

-- Fiches : promo 1 : le fondateur, 13 stagiaires avec compte (dont 2 inactifs), 1 sans compte ; promo 2 : 9 ; promo 7 : 10.
insert into public.stagiaires (prenom, nom, ordre, promo_id, actif) values ('Fondateur', 'LOCAL', 0, 1, true);
insert into public.stagiaires (prenom, nom, ordre, promo_id, actif)
  select 'S' || i, 'LOCAL', i, 1, i not in (12, 13) from generate_series(1, 14) i;
insert into public.stagiaires (prenom, nom, ordre, promo_id) select 'M' || i, 'LOCAL', i, 2 from generate_series(1, 9) i;
insert into public.stagiaires (prenom, nom, ordre, promo_id) select 'D' || i, 'LOCAL', i, 7 from generate_series(1, 10) i;

insert into auth.users (email) values ('fondateur@local.test'), ('formateur1@local.test'), ('formateur2@local.test'), ('formateur3@local.test');
insert into auth.users (email) select format('stagiaire%s@local.test', lpad(i::text, 2, '0')) from generate_series(1, 13) i;
insert into public.user_profiles (email, role, is_admin, is_founder, stagiaire_id)
  values ('fondateur@local.test', 'stagiaire', true, true, (select id from public.stagiaires where prenom = 'Fondateur'));
insert into public.user_profiles (email, role, is_admin, prof_id)
  select format('formateur%s@local.test', i), 'prof', true, (select id from public.profs where ordre = i) from generate_series(1, 3) i;
insert into public.user_profiles (email, role, stagiaire_id)
  select format('stagiaire%s@local.test', lpad(i::text, 2, '0')), 'stagiaire',
         (select id from public.stagiaires where prenom = 'S' || i and promo_id = 1) from generate_series(1, 13) i;

insert into public.competences (code, libelle, ordre) select 'C' || i, 'Compétence ' || i, i from generate_series(1, 6) i;
-- 57 thèmes et 55 notions (le déclencheur recopie chacun dans la progression de la promo 1), 15 progressions en promo 2.
insert into public.themes (numero, titre, type, ordre) select i, 'Thème ' || i, 'theme', i from generate_series(1, 57) i;
insert into public.themes (numero, titre, type, ordre) select null, 'Notion ' || i, 'notion', 100 + i from generate_series(1, 55) i;
insert into public.themes_progression (promo_id, theme_id, statut)
  select 2, t.id, 'À faire' from public.themes t where t.numero between 1 and 15;
-- 66 QCM (le déclencheur ouvre chacun en promo 1), 16 questions chacun, 5 réponses par question (à 2 près).
insert into public.qcm (theme_id, titre) select t.id, 'QCM ' || t.titre from public.themes t order by t.id limit 66;
insert into public.qcm_questions (qcm_id, enonce, ordre) select q.id, 'Question ' || i, i from public.qcm q cross join generate_series(1, 16) i;
insert into public.qcm_questions (qcm_id, enonce, ordre) select q.id, 'Question bis', 17 from public.qcm q order by q.id limit 6;
insert into public.qcm_options (question_id, texte, is_correct, ordre)
  select qq.id, 'Réponse ' || i, i = 1, i from public.qcm_questions qq cross join generate_series(1, 5) i;
-- Tentatives : 551 en promo 1, 140 en promo 7.
insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20)
  select (select id from public.qcm order by id offset (i % 66) limit 1),
         (select id from public.stagiaires where promo_id = 1 order by id offset (i % 15) limit 1), 'entrainement', 3, 5, 12
    from generate_series(1, 551) i;
insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20)
  select (select id from public.qcm order by id offset (i % 66) limit 1),
         (select id from public.stagiaires where promo_id = 7 order by id offset (i % 10) limit 1), 'entrainement', 3, 5, 12
    from generate_series(1, 140) i;
-- Notes (l'historique suit par déclencheur) : 627, 63, 103.
insert into public.evaluations (stagiaire_id, type, theme_numero, note)
  select (select id from public.stagiaires where promo_id = 1 order by id offset (i % 15) limit 1), 'Thème', 1 + i % 57, 10
    from generate_series(1, 627) i;
insert into public.evaluations (stagiaire_id, type, theme_numero, note)
  select (select id from public.stagiaires where promo_id = 2 order by id offset (i % 9) limit 1), 'Thème', 1 + i % 57, 11
    from generate_series(1, 63) i;
insert into public.evaluations (stagiaire_id, type, theme_numero, note)
  select (select id from public.stagiaires where promo_id = 7 order by id offset (i % 10) limit 1), 'Thème', 1 + i % 57, 12
    from generate_series(1, 103) i;
-- Passages (l'historique suit) : 286 en promo 1, 62 en promo 7 ; quelques-uns citent un formateur.
insert into public.passages (date, stagiaire_id, type, resultat, prof_id)
  select date '2026-04-06' + i, (select id from public.stagiaires where promo_id = 1 order by id offset (i % 15) limit 1),
         'Salle', 'Effectué', case when i % 10 = 0 then (select id from public.profs order by id limit 1) end
    from generate_series(1, 286) i;
insert into public.passages (date, stagiaire_id, type, resultat)
  select date '2026-09-22' + i, (select id from public.stagiaires where promo_id = 7 order by id offset (i % 10) limit 1), 'Voiture', 'Effectué'
    from generate_series(1, 62) i;
-- Planning : 378, 61, 95 cartes ; demi-journées : 3 et 9 ; jours fériés : 10 et 2 ; agenda : 10 et 3.
insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite, promo_id, benevoles_ids)
  select date '2026-03-30' + 7 * (i / 10), i % 5, case when (i / 5) % 2 = 0 then 'matin' else 'aprem' end, 0, 0, 'Cours', 1,
         case when i % 20 = 0 then array[1] else '{}' end
    from generate_series(0, 377) i;
insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite, promo_id)
  select date '2026-09-28' + 7 * (i / 10), i % 5, case when (i / 5) % 2 = 0 then 'matin' else 'aprem' end, 0, 0, 'Cours', 2
    from generate_series(0, 60) i;
insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite, promo_id)
  select date '2026-09-21' + 7 * (i / 10), i % 5, case when (i / 5) % 2 = 0 then 'matin' else 'aprem' end, 0, 0, 'Cours', 7
    from generate_series(0, 94) i;
insert into public.planning_half_meta (semaine_lundi, day_index, half_day, start_time, end_time, promo_id)
  select date '2026-04-06', i, 'matin', '08:30', '12:00', 1 from generate_series(0, 2) i;
insert into public.planning_half_meta (semaine_lundi, day_index, half_day, start_time, end_time, promo_id)
  select date '2026-10-05', i % 5, case when i < 5 then 'matin' else 'aprem' end, '08:30', '12:00', 2 from generate_series(0, 8) i;
insert into public.planning_jours_off (semaine_lundi, day_index, label, promo_id)
  select date '2026-04-06' + 7 * i, 0, 'Férié', 1 from generate_series(0, 9) i;
insert into public.planning_jours_off (semaine_lundi, day_index, label, promo_id) values ('2026-11-02', 1, 'Férié', 2), ('2026-11-09', 2, 'Férié', 2);
insert into public.agenda_events (date_start, title, promo_id) select date '2026-04-01' + i, 'Événement ' || i, 1 from generate_series(1, 10) i;
insert into public.agenda_events (date_start, title, promo_id) select date '2026-10-01' + i, 'Événement ' || i, 7 from generate_series(1, 3) i;
-- Réglages, aux clés relevées.
insert into public.settings (key, value, promo_id) values
  ('chatbot_quota_jour', '30', null), ('cohort_name', 'Local', null), ('password_hash', 'x', null),
  ('current_week_lundi', '2026-10-26', 1), ('profs_autres', '[]', 1), ('semaines_verrouillees', '[]', 1),
  ('current_week_lundi', '2026-10-26', 2), ('modules', '{}', 2),
  ('current_week_lundi', '2026-10-26', 7), ('emargement_actif', 'true', 7), ('emargement_entete', 'x', 7), ('modules', '{}', 7),
  ('profs_autres', '[]', 7);
-- Dossiers, EPCF, fiches de suivi, données privées.
insert into public.dp_dossiers (stagiaire_id) select id from public.stagiaires where promo_id = 1 and prenom like 'S%' order by id limit 12;
insert into public.dp_dossiers (stagiaire_id) select id from public.stagiaires where promo_id = 7 order by id limit 1;
insert into public.epcf_evaluations (stagiaire_id, trame, evaluateur_prof_id)
  select (select id from public.stagiaires where promo_id = 1 order by id offset (i % 15) limit 1), 'salle',
         case when i % 8 = 0 then (select id from public.profs order by id offset 1 limit 1) end
    from generate_series(1, 32) i;
insert into public.epcf_evaluations (stagiaire_id, trame)
  select (select id from public.stagiaires where promo_id = 7 order by id offset (i % 10) limit 1), 'vehicule' from generate_series(1, 15) i;
insert into public.epcf_livrets (stagiaire_id) select id from public.stagiaires where promo_id = 1 order by id limit 13;
insert into public.epcf_livrets (stagiaire_id) select id from public.stagiaires where promo_id = 7 order by id limit 1;
insert into public.fiches_suivi (stagiaire_id) select id from public.stagiaires where promo_id = 1 order by id limit 13;
insert into public.stagiaires_prive (stagiaire_id, date_naissance) select id, '2000-01-01' from public.stagiaires where promo_id = 1 order by id limit 8;
-- Émargement de la promo 7 : 20 séances, 10 lignes et 2 signatures de formateur chacune.
insert into public.emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par)
  select 7, date '2026-09-21' + (i / 2), case when i % 2 = 0 then 'matin' else 'aprem' end, '08:30', '12:00', 'formateur1@local.test'
    from generate_series(0, 19) i;
insert into public.emargement_lignes (seance_id, promo_id, stagiaire_id)
  select se.id, 7, s.id from public.emargement_seances se cross join public.stagiaires s where s.promo_id = 7;
insert into public.emargement_formateurs (seance_id, promo_id, nom, trace, signe_par)
  select se.id, 7, 'Formateur ' || i, 'M1 1L2 2', 'formateur1@local.test' from public.emargement_seances se cross join generate_series(1, 2) i;
-- Banque du lieu : 3 auto-écoles et 29 bénévoles au lieu 1 (dont 5 affiliés), 2 bénévoles au lieu 4.
insert into public.auto_ecoles (nom, lieu_id) select 'Auto-école ' || i, 1 from generate_series(1, 3) i;
insert into public.benevoles (prenom, lieu_id, auto_ecole_id)
  select 'B' || i, 1, case when i <= 5 then (select id from public.auto_ecoles order by id limit 1) end from generate_series(1, 29) i;
insert into public.benevoles (prenom, lieu_id) select 'B4-' || i, 4 from generate_series(1, 2) i;
-- Compteurs d'usage, acceptations, contacts, ressources.
insert into public.chatbot_usage (user_id, jour, nb)
  select u.id, date '2026-10-01' + d, 3 from auth.users u cross join generate_series(0, 1) d order by u.email limit 28;
insert into public.qcm_ia_usage (user_id, jour, nb) select u.id, '2026-10-20', 2 from auth.users u where u.email = 'formateur1@local.test';
insert into public.conditions_acceptations (email, version)
  select email, '2026-09' from public.user_profiles where role = 'stagiaire' order by email limit 13;
insert into public.contacts (prenom) values ('Contact 1'), ('Contact 2'), ('Contact 3');
insert into public.ressources (titre, url, categorie, ordre) select 'Ressource ' || i, 'https://exemple.invalid/' || i, 'docs', i from generate_series(1, 13) i;
-- Cours : 57 thèmes publiés, 36 compétences non publiées ; 220 versions ; 1 384 morceaux.
insert into public.cours (numero, titre, corps_md, published) select i, 'Cours ' || i, 'texte', true from generate_series(1, 57) i;
insert into public.cours (code, titre, corps_md, published)
  select c, 'Compétence ' || c, 'texte', false
    from (select 'C' || a as c from generate_series(1, 4) a
          union all select 'C' || a || '.' || b from generate_series(1, 4) a cross join generate_series(1, 9) b
           where (a, b) not in ((2, 8), (2, 9), (4, 8), (4, 9))) x;
insert into public.cours_versions (cours_id, titre, corps_md)
  select c.id, c.titre, 'version' from public.cours c cross join generate_series(1, 3) i order by c.id limit 220;
insert into public.cours_chunks (cours_id, titre, contenu, ordre)
  select c.id, c.titre, 'morceau ' || i, i from public.cours c cross join generate_series(1, 15) i order by c.id, i limit 1384;
-- Signalements de questions : 57 (56 avec fiche), 56 instruits ; 3 brouillons de l'IA.
insert into public.qcm_signalements (question_id, email, stagiaire_id, motif)
  select (select id from public.qcm_questions order by id offset i limit 1), 'stagiaire01@local.test',
         case when i > 0 then (select id from public.stagiaires where prenom = 'S1') end, 'autre'
    from generate_series(0, 56) i;
insert into public.qcm_signalement_instruction (signalement_id, verdict_auto, analyse_auto)
  select id, 'ambigu', 'analyse' from public.qcm_signalements order by id limit 56;
insert into public.qcm_ia_brouillons (qcm_id, demande_par_email, enonce)
  select (select id from public.qcm order by id limit 1), 'formateur1@local.test', 'Brouillon ' || i from generate_series(1, 3) i;
-- Stockage : 103 images de cours, 11 de QCM.
insert into storage.buckets (id, name, public) values ('cours-images', 'cours-images', true), ('qcm-images', 'qcm-images', true);
insert into storage.objects (bucket_id, name) select 'cours-images', 'cours/' || i || '.png' from generate_series(1, 103) i;
insert into storage.objects (bucket_id, name) select 'qcm-images', 'qcm/' || i || '.png' from generate_series(1, 11) i;
-- 6 passages de la promo 1 avec un remplaçant de la même promo, comme sur la production (cause du 23502 du passage 1).
update public.passages p set remplacant_id = (select s.id from public.stagiaires s where s.promo_id = 1 and s.id <> p.stagiaire_id order by s.id limit 1)
 where p.id in (select id from public.passages where promo_id = 1 order by id limit 6);
analyze;
