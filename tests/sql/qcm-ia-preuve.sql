-- Preuve de la migration 20261023_qcm_ia (questions proposees par l'IA).
-- Rejouable : le bloc leve TOUJOURS une exception a la fin (verdict « VERT n/0 » ou « ROUGE »),
-- tout est annule. Donnees 100 % fictives (example.invalid).
-- Jouee sur une base LOCALE jetable, jamais en prod :
--   initdb -D pgdata -U postgres --auth=trust -E UTF8 ; pg_ctl -D pgdata -o "-p 55432" start
--   psql -p 55432 -U postgres -c "create database ia"
--   psql ... -d ia -f tests/sql/qcm-ia-schema-minimal.sql
--   psql ... -d ia -f supabase/migrations/20261023_qcm_ia.sql
--   psql ... -d ia -1 -f tests/sql/qcm-ia-preuve.sql
-- Resultat du 23/10 : VERT 11/0 ; migration sabotee (lecture ouverte, trace sans nom) : ROUGE 9/2.

set local lock_timeout = '3s';

do $preuve$
declare
  e_adm text := 'preuve.ia.formateur@example.invalid';
  e_sta text := 'preuve.ia.stagiaire@example.invalid';
  v_prof integer; v_stag integer; v_theme integer; v_qcm bigint; v_cours uuid;
  b1 bigint; b2 bigint; b3 bigint; q bigint; n bigint; v text; r record;
  ok integer := 0; ko text[] := '{}';
  u uuid := gen_random_uuid();
begin
  -- Donnees fictives ---------------------------------------------------------------------
  insert into profs (nom) values ('Formateur Preuve') returning id into v_prof;
  -- En prod, un stagiaire appartient à une promo (colonne obligatoire, absente du schéma minimal).
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'stagiaires' and column_name = 'promo_id') then
    execute 'insert into stagiaires (prenom, promo_id) values ($1, (select min(id) from promos)) returning id'
      into v_stag using 'StagiairePreuve';
  else
    insert into stagiaires (prenom) values ('StagiairePreuve') returning id into v_stag;
  end if;
  insert into user_profiles (email, role, is_admin, prof_id) values (e_adm, 'prof', true, v_prof);
  insert into user_profiles (email, role, is_admin, stagiaire_id) values (e_sta, 'stagiaire', false, v_stag);
  insert into auth.users (id, email) values (u, e_adm);
  insert into themes (numero, titre) values (null, 'Thème preuve') returning id into v_theme;
  insert into qcm (theme_id, titre) values (v_theme, 'QCM preuve') returning id into v_qcm;
  insert into qcm_questions (qcm_id, enonce, ordre) values (v_qcm, 'Question existante', 4);
  -- Comme la fonction qcm-ia (service role) : trois brouillons a relire, un ecarte.
  insert into qcm_ia_brouillons (qcm_id, demande_par_email, enonce, options, statut)
  values (v_qcm, e_adm, 'Brouillon 1 ?', '[{"texte":"A","is_correct":true},{"texte":"B","is_correct":false}]', 'a_relire')
  returning id into b1;
  insert into qcm_ia_brouillons (qcm_id, demande_par_email, enonce, options, statut)
  values (v_qcm, e_adm, 'Brouillon 2 ?', '[]', 'a_relire') returning id into b2;
  insert into qcm_ia_brouillons (qcm_id, demande_par_email, enonce, options, statut)
  values (v_qcm, e_adm, 'Brouillon 3 ?', '[]', 'a_relire') returning id into b3;
  insert into qcm_ia_brouillons (qcm_id, demande_par_email, enonce, options, statut, motif)
  values (v_qcm, e_adm, 'Ecarte ?', '[]', 'ecartee', 'cite R413-99, absent du cours');

  -- 1. Un stagiaire ne voit aucun brouillon --------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('email', e_sta, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from qcm_ia_brouillons;
  reset role;
  if n = 0 then ok := ok + 1; else ko := ko || format('stagiaire voit %s brouillons', n); end if;

  -- 2. Un stagiaire ne peut ni accepter, ni rejeter, ni ecrire directement ---------------------
  set local role authenticated;
  begin perform accepter_brouillon_ia(b1, null, 'X', null, '[{"texte":"A","is_correct":true},{"texte":"B"}]'); v := 'accepte';
  exception when others then v := 'refusé'; end;
  begin perform rejeter_brouillon_ia(b1); v := v || '/rejete';
  exception when others then v := v || '/refusé'; end;
  begin insert into qcm_ia_brouillons (qcm_id, demande_par_email, enonce) values (v_qcm, e_sta, 'Pirate'); v := v || '/insere';
  exception when others then v := v || '/refusé'; end;
  begin perform qcm_ia_consommer(u, 99); v := v || '/quota';
  exception when others then v := v || '/refusé'; end;
  reset role;
  if v = 'refusé/refusé/refusé/refusé' then ok := ok + 1; else ko := ko || ('stagiaire : ' || v); end if;

  -- 3. Un formateur voit les brouillons, mais ne les modifie pas en direct ----------------------
  perform set_config('request.jwt.claims', json_build_object('email', e_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from qcm_ia_brouillons where qcm_id = v_qcm;
  update qcm_ia_brouillons set statut = 'acceptee' where id = b2;
  reset role;
  if n = 4 and (select statut from qcm_ia_brouillons where id = b2) = 'a_relire' then ok := ok + 1;
  else ko := ko || format('formateur : %s brouillons visibles, b2 %s', n, (select statut from qcm_ia_brouillons where id = b2)); end if;

  -- 4. Accepter : question corrigee par le formateur, options, trace, ordre en fin de QCM -------
  set local role authenticated;
  q := accepter_brouillon_ia(b1, ' Section relue ', ' Énoncé corrigé ? ', 'Explication.',
    '[{"texte":"Bonne","is_correct":true},{"texte":"  "},{"texte":"Fausse 1","is_correct":false},{"texte":"Fausse 2"}]');
  reset role;
  select * into r from qcm_questions where id = q;
  if r.enonce = 'Énoncé corrigé ?' and r.section = 'Section relue' and r.ordre = 5
     and r.ia_validee_par = 'Formateur Preuve' and r.ia_validee_le is not null and r.ia_brouillon_id = b1
  then ok := ok + 1; else ko := ko || ('question : ' || row_to_json(r)::text); end if;
  select string_agg(texte || ':' || is_correct || ':' || ordre, ' | ' order by ordre) into v from qcm_options where question_id = q;
  if v = 'Bonne:true:0 | Fausse 1:false:1 | Fausse 2:false:2' then ok := ok + 1; else ko := ko || ('options : ' || coalesce(v, 'aucune')); end if;
  if (select statut = 'acceptee' and traite_par_email = e_adm and traite_le is not null from qcm_ia_brouillons where id = b1)
  then ok := ok + 1; else ko := ko || 'brouillon non marqué accepté'::text; end if;

  -- 5. La question acceptee est visible des stagiaires (et seulement elle) ----------------------
  perform set_config('request.jwt.claims', json_build_object('email', e_sta, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from qcm_questions where qcm_id = v_qcm;
  reset role;
  if n = 2 then ok := ok + 1; else ko := ko || format('stagiaire voit %s questions (2 attendues)', n); end if;

  -- 6. Pas de double acceptation, pas d'acceptation sans bonne reponse ou a une seule reponse ---
  perform set_config('request.jwt.claims', json_build_object('email', e_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform accepter_brouillon_ia(b1, null, 'Encore ?', null, '[{"texte":"A","is_correct":true},{"texte":"B"}]'); v := 'deux fois';
  exception when others then v := sqlerrm; end;
  begin perform accepter_brouillon_ia(b2, null, 'Sans bonne ?', null, '[{"texte":"A"},{"texte":"B"}]'); v := v || '/sans bonne';
  exception when others then v := v || '/' || sqlerrm; end;
  begin perform accepter_brouillon_ia(b2, null, 'Une seule ?', null, '[{"texte":"A","is_correct":true}]'); v := v || '/une seule';
  exception when others then v := v || '/' || sqlerrm; end;
  begin perform accepter_brouillon_ia(b2, null, '  ', null, '[{"texte":"A","is_correct":true},{"texte":"B"}]'); v := v || '/vide';
  exception when others then v := v || '/' || sqlerrm; end;
  reset role;
  if v = 'Ce brouillon a déjà été traité/Coche au moins une bonne réponse/Ajoute au moins deux réponses/L''énoncé est requis'
  then ok := ok + 1; else ko := ko || ('garde-fous : ' || v); end if;

  -- 7. Rejeter : une fois, pas deux ; un brouillon ecarte n'est ni acceptable ni rejetable -------
  set local role authenticated;
  perform rejeter_brouillon_ia(b3);
  begin perform rejeter_brouillon_ia(b3); v := 'deux fois';
  exception when others then v := sqlerrm; end;
  begin perform accepter_brouillon_ia((select id from qcm_ia_brouillons where statut = 'ecartee' and qcm_id = v_qcm),
    null, 'Ecarte ?', null, '[{"texte":"A","is_correct":true},{"texte":"B"}]'); v := v || '/ecarte accepte';
  exception when others then v := v || '/' || sqlerrm; end;
  reset role;
  if (select statut from qcm_ia_brouillons where id = b3) = 'rejetee'
     and v = 'Ce brouillon a déjà été traité/Ce brouillon a déjà été traité'
  then ok := ok + 1; else ko := ko || ('rejet : ' || v); end if;

  -- 8. Quota (service role, comme la fonction) : limite 2 => oui, oui, non ---------------------
  perform set_config('request.jwt.claims', '', true);
  v := qcm_ia_consommer(u, 2)::text || '/' || qcm_ia_consommer(u, 2)::text || '/' || qcm_ia_consommer(u, 2)::text;
  if v = 'true/true/false' then ok := ok + 1; else ko := ko || ('quota : ' || v); end if;

  -- 9. Effacer la question acceptee laisse le brouillon au journal ------------------------------
  delete from qcm_questions where id = q;
  if (select statut from qcm_ia_brouillons where id = b1) = 'acceptee' then ok := ok + 1;
  else ko := ko || 'journal perdu à la suppression de la question'::text; end if;

  perform set_config('request.jwt.claims', '', true);
  if array_length(ko, 1) is null then
    raise exception 'VERT %/0 (tout est annulé)', ok;
  else
    raise exception 'ROUGE %/% : %', ok, array_length(ko, 1), array_to_string(ko, ' ; ');
  end if;
end $preuve$;
