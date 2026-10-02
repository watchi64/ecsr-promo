-- Vérification de l'étape 1 du multi-promo (fondations).
-- Ne laisse AUCUNE trace : le bloc final lève toujours une exception, qui annule les
-- écritures de test et porte le verdict (« VERDICT VERT » attendu).
-- Personnages choisis par requête : aucun email écrit ici (dépôt public).

create temp table if not exists verif (libelle text, ok boolean, detail text);
truncate verif;

create or replace function pg_temp.ok(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into verif values (p_libelle, coalesce(p_ok, false), coalesce(p_detail, ''));
$f$;

-- Pose le jeton et l'en-tête d'un personnage, sans changer de rôle : on teste ici les
-- fonctions et les défauts, pas encore les règles d'accès.
create or replace function pg_temp.contexte(p_email text, p_entete text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then ''
         else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_entete is null then ''
         else json_build_object('x-promo-id', p_entete)::text end, true);
end $f$;

do $verif$
declare
  v_stag1 text; v_form text; v_fond text; v_sid1 integer; v_sid_fond integer;
  v_table text; n bigint; m bigint; v_int integer; v_txt text; v_bool boolean;
  v_theme integer; v_theme2 integer; v_qcm bigint; v_ae integer;
  v_total integer; v_ko integer; v_liste text;
begin
  select up.email, s.id into v_stag1, v_sid1
    from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email, stagiaire_id into v_fond, v_sid_fond from user_profiles where is_founder order by email limit 1;
  perform pg_temp.ok('personnages trouvés', v_stag1 is not null and v_form is not null and v_fond is not null);

  -- 1. Les lignes existantes sont rattachées à mars (promo 1) et à Nîmes (lieu 1)
  foreach v_table in array array['stagiaires','evaluations','evaluations_audit','passages',
      'passages_audit','planning_entries','planning_half_meta','planning_jours_off','agenda_events',
      'qcm_attempts','epcf_evaluations','epcf_livrets','dp_dossiers','fiches_suivi'] loop
    execute format('select count(*), count(*) filter (where promo_id = 1) from public.%I', v_table) into n, m;
    perform pg_temp.ok('rattachement à mars : ' || v_table, n = m, n || ' lignes dont ' || m || ' en promo 1');
  end loop;
  -- Réglages : les trois clés globales sans promo, toutes les autres en mars (y compris une
  -- éventuelle clé « modules » posée avant la migration, cf. chantier B).
  select count(*) filter (where promo_id is null),
         count(*) filter (where promo_id is distinct from 1
                            and key not in ('chatbot_quota_jour', 'cohort_name', 'password_hash'))
    into n, m from settings;
  perform pg_temp.ok('réglages : 3 globaux, tous les autres en mars', n = 3 and m = 0,
    n || ' globaux, ' || m || ' hors mars');
  select count(*) into n from settings
   where promo_id is null and key not in ('chatbot_quota_jour', 'cohort_name', 'password_hash');
  perform pg_temp.ok('réglages globaux : seulement les trois prévus', n = 0, n || ' en trop');
  foreach v_table in array array['benevoles','auto_ecoles','benevole_suivi'] loop
    execute format('select count(*), count(*) filter (where lieu_id = 1) from public.%I', v_table) into n, m;
    perform pg_temp.ok('rattachement à Nîmes : ' || v_table, n = m, n || ' lignes dont ' || m || ' à Nîmes');
  end loop;
  select count(*) into n from promos where lieu_id = 1;
  perform pg_temp.ok('deux promos, à Nîmes', n = 2 and (select count(*) from promos) = 2, n || ' promo(s) à Nîmes');

  -- 2. Copies fidèles de la progression et de l'état des examens
  select count(*) into n from themes t
    left join themes_progression p on p.theme_id = t.id and p.promo_id = 1
   where p.theme_id is null or p.statut is distinct from t.statut
      or p.date_fait is distinct from t.date_fait or p.date_qcm is distinct from t.date_qcm
      or p.notes is distinct from t.notes or p.updated_by_email is distinct from t.updated_by_email;
  perform pg_temp.ok('progression de mars copiée à l''identique', n = 0, n || ' écart(s)');
  select count(*) into n from qcm q
    left join qcm_examens e on e.qcm_id = q.id and e.promo_id = 1
   where e.qcm_id is null or e.published is distinct from q.published
      or e.published_by_email is distinct from q.published_by_email
      or e.published_at is distinct from q.published_at
      or e.exam_nb_questions is distinct from q.exam_nb_questions
      or e.exam_question_ids is distinct from q.exam_question_ids
      or e.exam_draw_mode is distinct from q.exam_draw_mode
      or e.exam_seconds_per_question is distinct from q.exam_seconds_per_question
      or e.exam_ferme_a is distinct from q.exam_ferme_a;
  perform pg_temp.ok('examens de mars copiés à l''identique', n = 0, n || ' écart(s)');

  -- 3. Fonctions de contexte
  perform pg_temp.contexte(v_stag1, null);
  perform pg_temp.ok('stagiaire sans en-tête : mars', promo_courante() = 1, coalesce(promo_courante()::text, 'nul'));
  select count(*), bool_and(par_defaut), max(stagiaire_id) into n, v_bool, v_int from mes_promos();
  perform pg_temp.ok('stagiaire : une seule promo, la sienne, avec sa fiche', n = 1 and v_bool and v_int = v_sid1,
    n || ' promo(s), fiche ' || coalesce(v_int::text, 'nulle'));
  perform pg_temp.contexte(v_stag1, '1');
  perform pg_temp.ok('stagiaire en-tête 1 : mars', promo_courante() = 1, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_stag1, '2');
  perform pg_temp.ok('stagiaire en-tête 2 : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_form, null);
  perform pg_temp.ok('formateur sans en-tête : mars, plus ancienne en cours', promo_courante() = 1,
    coalesce(promo_courante()::text, 'nul'));
  select count(*), max(id) filter (where par_defaut), count(*) filter (where stagiaire_id is not null)
    into n, v_int, m from mes_promos();
  perform pg_temp.ok('formateur : deux promos, mars par défaut, aucune fiche', n = 2 and v_int = 1 and m = 0,
    n || ' promo(s), défaut ' || coalesce(v_int::text, 'nul'));
  perform pg_temp.contexte(v_form, '2');
  perform pg_temp.ok('formateur en-tête 2 : septembre', promo_courante() = 2, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.ok('formateur en-tête 2 : lieu Nîmes', lieu_courant() = 1, coalesce(lieu_courant()::text, 'nul'));
  perform pg_temp.contexte(v_form, 'abc');
  perform pg_temp.ok('en-tête fantaisiste : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_form, '99');
  perform pg_temp.ok('promo inexistante : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_fond, null);
  perform pg_temp.ok('fondateur sans en-tête : mars, sa fiche', promo_courante() = 1,
    coalesce(promo_courante()::text, 'nul'));
  select count(*), max(stagiaire_id) filter (where id = 1), count(*) filter (where id = 2 and stagiaire_id is null)
    into n, v_int, m from mes_promos();
  perform pg_temp.ok('fondateur : deux promos, fiche en mars seulement', n = 2 and v_int = v_sid_fond and m = 1,
    n || ' promo(s)');
  perform pg_temp.contexte(v_fond, '2');
  perform pg_temp.ok('fondateur en-tête 2 : septembre', promo_courante() = 2, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(null, null);
  perform pg_temp.ok('visiteur : aucune promo', promo_courante() is null and (select count(*) from mes_promos()) = 0);
  perform pg_temp.contexte(null, '1');
  perform pg_temp.ok('visiteur en-tête 1 : rien', promo_courante() is null);

  -- 4. Valeurs par défaut et triggers (chaque écriture est annulée par son sous-bloc)
  begin
    perform pg_temp.contexte(v_form, '2');
    insert into planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite)
      values ('2030-01-07', 0, 'matin', 0, 0, 'Cours') returning promo_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('défaut : carte ajoutée en contexte septembre, rangée en septembre', v_txt = 'sentinelle:2', v_txt);

  begin
    perform pg_temp.contexte(v_form, '2');
    insert into evaluations (stagiaire_id, type, theme_numero, note, promo_id)
      values (v_sid1, 'Thème', 1, 10, 2) returning promo_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('trigger : la note d''un stagiaire de mars reste en mars', v_txt = 'sentinelle:1', v_txt);

  begin
    perform pg_temp.contexte(v_form, '2');
    insert into benevoles (prenom) values ('Verif') returning lieu_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('défaut : bénévole créé depuis septembre, banque de Nîmes', v_txt = 'sentinelle:1', v_txt);

  begin
    insert into auto_ecoles (nom, lieu_id) values ('Verif Montpellier', 2) returning id into v_ae;
    insert into benevoles (prenom, lieu_id, auto_ecole_id) values ('Verif', 1, v_ae);
    raise exception 'sentinelle:accepté';
  exception when others then v_txt := sqlstate || ':' || sqlerrm; end;
  perform pg_temp.ok('trigger : pas d''affiliation à une auto-école d''un autre lieu', v_txt like '23514:%', v_txt);

  begin
    insert into benevoles (prenom, lieu_id) values ('Verif', 2) returning id into v_int;
    insert into benevole_suivi (benevole_id, semaine_lundi, day_index, half_day, lieu_id)
      values (v_int, '2030-01-07', 0, 'matin', 1) returning lieu_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('trigger : le suivi prend le lieu du bénévole', v_txt = 'sentinelle:2', v_txt);

  -- 5. Unicités
  begin
    insert into settings (promo_id, key, value) values (2, 'verif_cle', 'a')
      on conflict (promo_id, key) do update set value = excluded.value;
    insert into settings (promo_id, key, value) values (2, 'verif_cle', 'b')
      on conflict (promo_id, key) do update set value = excluded.value;
    select count(*), max(value) into n, v_txt from settings where promo_id = 2 and key = 'verif_cle';
    raise exception 'sentinelle:%:%', n, v_txt;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('réglages : la cible (promo_id, key) est reconnue par ON CONFLICT', v_txt = 'sentinelle:1:b', v_txt);

  begin
    insert into settings (promo_id, key, value) values (null, 'chatbot_quota_jour', '99');
    raise exception 'sentinelle:accepté';
  exception when others then v_txt := sqlstate; end;
  perform pg_temp.ok('réglages globaux : pas de doublon de clé', v_txt = '23505', v_txt);

  -- 6. Synchronisation de bascule (écritures annulées par la levée finale)
  select id into v_theme from themes order by id limit 1;
  select id into v_theme2 from themes order by id desc limit 1;
  select id into v_qcm from qcm order by id limit 1;
  update themes set statut = 'En cours' where id = v_theme;
  select statut into v_txt from themes_progression where promo_id = 1 and theme_id = v_theme;
  perform pg_temp.ok('synchro : ancienne colonne vers progression de mars', v_txt = 'En cours', coalesce(v_txt, 'nul'));
  update themes_progression set date_qcm = '2030-01-01' where promo_id = 1 and theme_id = v_theme;
  select date_qcm::text into v_txt from themes where id = v_theme;
  perform pg_temp.ok('synchro : progression de mars vers ancienne colonne', v_txt = '2030-01-01', coalesce(v_txt, 'nul'));
  select statut into v_txt from themes where id = v_theme2;
  insert into themes_progression (promo_id, theme_id, statut) values (2, v_theme2, 'En cours')
    on conflict (promo_id, theme_id) do update set statut = excluded.statut;
  perform pg_temp.ok('synchro : septembre ne touche pas les anciennes colonnes',
    (select statut from themes where id = v_theme2) = v_txt, v_txt);
  update qcm set exam_seconds_per_question = 41 where id = v_qcm;
  select exam_seconds_per_question into v_int from qcm_examens where promo_id = 1 and qcm_id = v_qcm;
  perform pg_temp.ok('synchro : ancien examen vers examens de mars', v_int = 41, coalesce(v_int::text, 'nul'));
  update qcm_examens set exam_seconds_per_question = 43 where promo_id = 1 and qcm_id = v_qcm;
  select exam_seconds_per_question into v_int from qcm where id = v_qcm;
  perform pg_temp.ok('synchro : examens de mars vers ancien examen', v_int = 43, coalesce(v_int::text, 'nul'));
  insert into qcm_examens (promo_id, qcm_id, exam_seconds_per_question) values (2, v_qcm, 57)
    on conflict (promo_id, qcm_id) do update set exam_seconds_per_question = excluded.exam_seconds_per_question;
  select exam_seconds_per_question into v_int from qcm where id = v_qcm;
  perform pg_temp.ok('synchro : un examen de septembre ne touche pas la banque', v_int = 43, coalesce(v_int::text, 'nul'));

  -- Verdict (annule tout)
  select count(*), count(*) filter (where not ok) into v_total, v_ko from verif;
  select string_agg('- ' || libelle || ' : ' || detail, E'\n') into v_liste from verif where not ok;
  raise exception E'VERDICT %\n% contrôles, % échec(s)%',
    case when v_ko = 0 then 'VERT' else 'ROUGE' end, v_total, v_ko, coalesce(E'\n' || v_liste, '');
end $verif$;
