-- Vérification de l'étape 1 du multi-promo (fondations).
-- Ne laisse AUCUNE trace : le bloc final lève toujours une exception, qui annule les
-- écritures de test et porte le verdict (« VERDICT VERT » attendu).
-- Personnages choisis par requête : aucun email écrit ici (dépôt public).
-- Chaque écriture dans une table de l'app se fait dans un sous-bloc annulé par une exception
-- sentinelle. Seule trace possible : quelques numéros de séquence consommés par ces insertions
-- (des trous, sans effet). Aucun appel à nextval, aucune insertion dans lieux ni promos.

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

-- Même chose avec des en-têtes bruts : forme réelle de PostgREST, ou texte illisible.
create or replace function pg_temp.entetes_bruts(p_email text, p_brut text)
returns void language plpgsql as $f$
begin
  perform pg_temp.contexte(p_email, null);
  perform set_config('request.headers', p_brut, true);
end $f$;

do $verif$
declare
  v_stag1 text; v_form text; v_fond text; v_sid1 integer; v_sid_fond integer;
  v_table text; n bigint; m bigint; v_int integer; v_int2 integer; v_txt text; v_bool boolean;
  v_bool2 boolean; v_theme integer; v_theme2 integer; v_qcm bigint; v_ae integer;
  v_ae_nimes integer; v_qcm_examen bigint; v_id bigint; v_defaut_form integer;
  v_seq text; v_last bigint; v_etat text; v_contrainte text; v_colonne text;
  v_statut text; v_statut_avant text; v_date date; v_sec integer; v_sec_avant integer;
  v_total integer; v_ko integer; v_liste text;
begin
  select up.email, s.id into v_stag1, v_sid1
    from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email, stagiaire_id into v_fond, v_sid_fond from user_profiles where is_founder order by email limit 1;
  perform pg_temp.ok('personnages trouvés', v_stag1 is not null and v_form is not null and v_fond is not null);
  -- Défaut du personnel : mars jusqu'à sa date de fin (11/12/2026 incluse), septembre ensuite.
  v_defaut_form := case when current_date <= date '2026-12-11' then 1 else 2 end;

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
  select string_agg(id || '|' || nom, ' ; ' order by id) into v_txt from lieux;
  perform pg_temp.ok('lieux : ids et noms', v_txt = '1|Nîmes ; 2|Montpellier', coalesce(v_txt, 'aucun'));
  select string_agg(concat_ws('|', id, nom, lieu_id, to_char(date_debut, 'YYYY-MM-DD'),
                              coalesce(to_char(date_fin, 'YYYY-MM-DD'), 'nulle')), ' ; ' order by id)
    into v_txt from promos;
  perform pg_temp.ok('promos : ids, noms, lieu et dates',
    v_txt = '1|Nîmes, mars 2026|1|2026-03-30|2026-12-11 ; 2|Nîmes, septembre 2026|1|2026-09-30|nulle',
    coalesce(v_txt, 'aucune'));
  -- Identités prêtes à donner 3 : lecture de l'état de la séquence, rien n'est consommé.
  foreach v_table in array array['lieux', 'promos'] loop
    v_seq := pg_get_serial_sequence('public.' || v_table, 'id');
    execute format('select last_value, is_called from %s', v_seq) into v_last, v_bool;
    perform pg_temp.ok('identité de ' || v_table || ' : prochaine valeur 3, rien de consommé',
      v_last = 3 and not v_bool, v_seq || ' : last_value ' || v_last || ', is_called ' || v_bool);
  end loop;

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
  perform pg_temp.ok('formateur sans en-tête : plus ancienne promo en cours', promo_courante() = v_defaut_form,
    coalesce(promo_courante()::text, 'nul') || ', attendu ' || v_defaut_form);
  select count(*), max(id) filter (where par_defaut), count(*) filter (where stagiaire_id is not null)
    into n, v_int, m from mes_promos();
  perform pg_temp.ok('formateur : deux promos, défaut daté, aucune fiche', n = 2 and v_int = v_defaut_form and m = 0,
    n || ' promo(s), défaut ' || coalesce(v_int::text, 'nul') || ', attendu ' || v_defaut_form);
  perform pg_temp.contexte(v_form, '2');
  perform pg_temp.ok('formateur en-tête 2 : septembre', promo_courante() = 2, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.ok('formateur en-tête 2 : lieu Nîmes', lieu_courant() = 1, coalesce(lieu_courant()::text, 'nul'));
  perform pg_temp.contexte(v_form, 'abc');
  perform pg_temp.ok('en-tête fantaisiste : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_form, '99');
  perform pg_temp.ok('promo inexistante : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_form, '');
  perform pg_temp.ok('en-tête présent mais vide : promo par défaut', promo_courante() = v_defaut_form,
    coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.entetes_bruts(v_form, '{"accept": "*/*"}');
  perform pg_temp.ok('en-têtes sans x-promo-id (forme PostgREST) : promo par défaut',
    promo_courante() = v_defaut_form, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.entetes_bruts(v_form, '{oops');
  perform pg_temp.ok('en-têtes illisibles : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
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

  -- Aucune promo en cours : repli sur la plus récente. Les dates sont changées en propriétaire
  -- (le test ne change jamais de rôle), puis annulées par la sentinelle.
  begin
    update promos set date_fin = current_date - 1 where id in (1, 2);
    perform pg_temp.contexte(v_form, null);
    raise exception 'sentinelle:%', coalesce(promo_par_defaut()::text, 'nul');
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('aucune promo en cours : repli sur la plus récente', v_txt = 'sentinelle:2', v_txt);

  -- Visiteur anonyme : aucun droit sur les nouvelles tables, RLS active, pas de mes_promos()
  foreach v_table in array array['lieux', 'promos', 'themes_progression', 'qcm_examens'] loop
    select string_agg(d.droit, ', ') into v_txt
      from unnest(array['select', 'insert', 'update', 'delete']) as d(droit)
     where has_table_privilege('anon', 'public.' || v_table, d.droit);
    v_bool2 := has_any_column_privilege('anon', 'public.' || v_table, 'select, insert, update');
    select relrowsecurity into v_bool from pg_class where oid = ('public.' || v_table)::regclass;
    perform pg_temp.ok('visiteur : aucun droit sur ' || v_table || ', RLS active',
      v_txt is null and not v_bool2 and v_bool,
      'droits : ' || coalesce(v_txt, 'aucun') || ', droits de colonne : ' || v_bool2 || ', RLS : ' || v_bool);
  end loop;
  perform pg_temp.ok('visiteur : mes_promos() non exécutable',
    not has_function_privilege('anon', 'public.mes_promos()', 'execute'));

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
  perform pg_temp.ok('trigger : pas d''affiliation à une auto-école d''un autre lieu',
    v_txt = '23514:Cette auto-école appartient à un autre lieu.', v_txt);

  begin
    insert into benevoles (prenom, lieu_id) values ('Verif', 2) returning id into v_int;
    insert into benevole_suivi (benevole_id, semaine_lundi, day_index, half_day, lieu_id)
      values (v_int, '2030-01-07', 0, 'matin', 1) returning lieu_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('trigger : le suivi prend le lieu du bénévole', v_txt = 'sentinelle:2', v_txt);

  -- Contexte nul (en-tête d'une promo inexistante) : l'insertion est refusée, rien n'est rangé.
  begin
    perform pg_temp.contexte(v_form, '99');
    insert into planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite)
      values ('2030-01-07', 0, 'matin', 0, 0, 'Cours');
    raise exception 'sentinelle:accepté';
  exception when others then
    get stacked diagnostics v_colonne = column_name;
    v_etat := sqlstate; v_txt := sqlerrm;
  end;
  perform pg_temp.ok('contexte nul : carte de planning refusée', v_etat = '23502' and v_colonne = 'promo_id',
    v_etat || ':' || v_colonne || ' : ' || v_txt);

  select id into v_ae_nimes from auto_ecoles where lieu_id = 1 order by id limit 1;
  begin
    perform pg_temp.contexte(v_form, '99');
    insert into benevoles (prenom, auto_ecole_id) values ('Verif', v_ae_nimes);
    raise exception 'sentinelle:accepté';
  exception when others then
    get stacked diagnostics v_colonne = column_name;
    v_etat := sqlstate; v_txt := sqlerrm;
  end;
  perform pg_temp.ok('contexte nul : bénévole affilié refusé faute de lieu, pas pour l''affiliation',
    v_ae_nimes is not null and v_etat = '23502' and v_colonne = 'lieu_id',
    'auto-école ' || coalesce(v_ae_nimes::text, 'introuvable') || ', ' || v_etat || ':' || v_colonne || ' : ' || v_txt);

  -- Historiques : la trace porte la promo de la ligne suivie. Contexte septembre exprès : la
  -- valeur 1 ne peut venir que du stagiaire.
  begin
    perform pg_temp.contexte(v_form, '2');
    insert into passages (date, stagiaire_id, type, resultat)
      values ('2030-01-07', v_sid1, 'Salle', 'Effectué') returning id, promo_id into v_id, v_int;
    select count(*), max(promo_id) into n, m from passages_audit where passage_id = v_id;
    raise exception 'sentinelle:%:%:%', v_int, n, m;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('historique : passage en mars, une trace en mars', v_txt = 'sentinelle:1:1:1', v_txt);

  begin
    perform pg_temp.contexte(v_form, '2');
    insert into evaluations (stagiaire_id, type, theme_numero, note)
      values (v_sid1, 'Thème', 1, 10) returning id, promo_id into v_id, v_int;
    select count(*), max(promo_id) into n, m from evaluations_audit where evaluation_id = v_id;
    raise exception 'sentinelle:%:%:%', v_int, n, m;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('historique : note en mars, une trace en mars', v_txt = 'sentinelle:1:1:1', v_txt);

  -- Recopie d'un examen (trg_mirror_exam) : un QCM à thème numéroté que le stagiaire n'a pas
  -- encore passé en examen (une seule tentative d'examen par QCM et par stagiaire).
  select q.id into v_qcm_examen
    from qcm q join themes t on t.id = q.theme_id
   where t.numero is not null
     and not exists (select 1 from qcm_attempts a
                      where a.qcm_id = q.id and a.stagiaire_id = v_sid1 and a.mode = 'examen')
   order by q.id limit 1;
  begin
    perform pg_temp.contexte(v_form, '2');
    insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20)
      values (v_qcm_examen, v_sid1, 'examen', 5, 10, 10) returning id, promo_id into v_id, v_int;
    select count(*), max(e.promo_id), max(a.promo_id) into n, m, v_int2
      from evaluations e join evaluations_audit a on a.evaluation_id = e.id
     where e.qcm_attempt_id = v_id;
    raise exception 'sentinelle:%:%:%:%', v_int, n, m, v_int2;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('historique : examen recopié en note, tentative, note et trace en mars',
    v_txt = 'sentinelle:1:1:1:1', 'QCM ' || coalesce(v_qcm_examen::text, 'introuvable') || ' : ' || v_txt);

  -- 5. Unicités et réglages
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
  -- Le contrôle précédent réussit aussi grâce à l'ancienne clé primaire (key) : on vérifie
  -- donc la propriété elle-même.
  select indnullsnotdistinct into v_bool from pg_index where indexrelid = 'public.settings_promo_key_unique'::regclass;
  perform pg_temp.ok('réglages : unicité (promo_id, key) en NULLS NOT DISTINCT', v_bool,
    coalesce(v_bool::text, 'index introuvable'));

  begin
    perform pg_temp.contexte(v_form, '99');
    insert into settings (key, value) values ('cle_de_test_multi_promo', 'x');
    raise exception 'sentinelle:accepté';
  exception when others then
    get stacked diagnostics v_contrainte = constraint_name;
    v_etat := sqlstate; v_txt := sqlerrm;
  end;
  perform pg_temp.ok('réglages : sans promo, une nouvelle clé est refusée',
    v_etat = '23514' and v_contrainte = 'settings_globaux_prevus', v_etat || ':' || v_contrainte || ' : ' || v_txt);

  -- Upsert de l'app (sur key) d'une clé globale : la ligne proposée reçoit la promo par défaut
  -- et passe le CHECK, la mise à jour ne touche pas promo_id, la clé reste globale.
  begin
    perform pg_temp.contexte(v_form, null);
    insert into settings (key, value) values ('chatbot_quota_jour', 'verif')
      on conflict (key) do update set value = excluded.value;
    select count(*), count(*) filter (where promo_id is null), max(value) into n, m, v_txt
      from settings where key = 'chatbot_quota_jour';
    raise exception 'sentinelle:%:%:%', n, m, v_txt;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('réglages : l''upsert de l''app sur une clé globale la laisse globale',
    v_txt = 'sentinelle:1:1:verif', v_txt);

  -- 6. Synchronisation de bascule. Chaque essai écrit une valeur différente de l'actuelle (sinon
  --    la copie suffirait à le faire réussir), dans un sous-bloc annulé.
  select id into v_theme from themes order by id limit 1;
  select id into v_theme2 from themes order by id desc limit 1;
  select id into v_qcm from qcm order by id limit 1;

  select case statut when 'En cours' then 'Fait' else 'En cours' end into v_statut from themes where id = v_theme;
  begin
    update themes set statut = v_statut where id = v_theme;
    select statut into v_txt from themes_progression where promo_id = 1 and theme_id = v_theme;
    raise exception 'sentinelle:%', v_txt;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('synchro : ancienne colonne vers progression de mars', v_txt = 'sentinelle:' || v_statut,
    v_txt || ' (écrit : ' || v_statut || ')');

  select case when date_qcm = date '2030-01-01' then date '2030-01-02' else date '2030-01-01' end
    into v_date from themes where id = v_theme;
  begin
    update themes_progression set date_qcm = v_date where promo_id = 1 and theme_id = v_theme;
    select to_char(date_qcm, 'YYYY-MM-DD') into v_txt from themes where id = v_theme;
    raise exception 'sentinelle:%', v_txt;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('synchro : progression de mars vers ancienne colonne',
    v_txt = 'sentinelle:' || to_char(v_date, 'YYYY-MM-DD'), v_txt);

  select statut, case statut when 'En cours' then 'Fait' else 'En cours' end
    into v_statut_avant, v_statut from themes where id = v_theme2;
  begin
    insert into themes_progression (promo_id, theme_id, statut) values (2, v_theme2, v_statut)
      on conflict (promo_id, theme_id) do update set statut = excluded.statut;
    select t.statut || ':' || p.statut into v_txt
      from themes t join themes_progression p on p.theme_id = t.id and p.promo_id = 2
     where t.id = v_theme2;
    raise exception 'sentinelle:%', v_txt;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('synchro : septembre ne touche pas les anciennes colonnes',
    v_txt = 'sentinelle:' || v_statut_avant || ':' || v_statut, v_txt);

  select exam_seconds_per_question into v_sec_avant from qcm where id = v_qcm;
  v_sec := case when v_sec_avant = 41 then 42 else 41 end;
  begin
    update qcm set exam_seconds_per_question = v_sec where id = v_qcm;
    select exam_seconds_per_question into v_int from qcm_examens where promo_id = 1 and qcm_id = v_qcm;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('synchro : ancien examen vers examens de mars', v_txt = 'sentinelle:' || v_sec, v_txt);

  v_sec := case when v_sec_avant = 43 then 44 else 43 end;
  begin
    update qcm_examens set exam_seconds_per_question = v_sec where promo_id = 1 and qcm_id = v_qcm;
    select exam_seconds_per_question into v_int from qcm where id = v_qcm;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('synchro : examens de mars vers ancien examen', v_txt = 'sentinelle:' || v_sec, v_txt);

  v_sec := case when v_sec_avant = 57 then 58 else 57 end;
  begin
    insert into qcm_examens (promo_id, qcm_id, exam_seconds_per_question) values (2, v_qcm, v_sec)
      on conflict (promo_id, qcm_id) do update set exam_seconds_per_question = excluded.exam_seconds_per_question;
    select q.exam_seconds_per_question || ':' || e.exam_seconds_per_question into v_txt
      from qcm q join qcm_examens e on e.qcm_id = q.id and e.promo_id = 2
     where q.id = v_qcm;
    raise exception 'sentinelle:%', v_txt;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('synchro : un examen de septembre ne touche pas la banque',
    v_txt = 'sentinelle:' || v_sec_avant || ':' || v_sec, v_txt);

  -- Verdict (annule tout)
  select count(*), count(*) filter (where not ok) into v_total, v_ko from verif;
  select string_agg('- ' || libelle || ' : ' || detail, E'\n') into v_liste from verif where not ok;
  raise exception E'VERDICT %\n% contrôles, % échec(s)%',
    case when v_ko = 0 then 'VERT' else 'ROUGE' end, v_total, v_ko, coalesce(E'\n' || v_liste, '');
end $verif$;
