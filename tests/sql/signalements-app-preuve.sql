-- Preuve de la migration 20261028_signalements_app (signaler un problème depuis l'app).
-- Rejouable : le bloc lève TOUJOURS une exception à la fin (verdict « VERT n/0 » ou « ROUGE »), tout
-- est annulé. Données 100 % fictives (example.invalid).
-- Jouée sur une base LOCALE jetable :
--   initdb -D pg -U postgres --auth=trust -E UTF8 --no-locale ; pg_ctl -D pg -o "-p 55433" start
--   createdb -p 55433 -U postgres sg
--   psql -p 55433 -U postgres -d sg -f tests/sql/signalements-app-schema-minimal.sql
--   psql -p 55433 -U postgres -d sg -f supabase/migrations/20261028_signalements_app.sql
--   psql -p 55433 -U postgres -d sg -1 -f tests/sql/signalements-app-preuve.sql
-- Après l'application en prod (accord de Timy), elle se rejoue telle quelle sur la base réelle : la
-- levée finale annule tout.
-- Résultat du 28/10 (Postgres 18.4 local) : VERT 38/0 ; migration sabotée (lecture ouverte à tous, traiter sans
-- contrôle du fondateur) : ROUGE 33/5 sur exactement ces cas. Retour joué : plus aucun objet signal%.

set local lock_timeout = '3s';

do $preuve$
declare
  eA text := 'preuve.sg.alpha@example.invalid';
  eB text := 'preuve.sg.bravo@example.invalid';
  eF text := 'preuve.sg.formateur@example.invalid';
  eT text := 'preuve.sg.fondateur@example.invalid';
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uF uuid := gen_random_uuid(); uT uuid := gen_random_uuid();
  v_lieu integer; p1 integer; v_prof integer; sA integer; sB integer; sT integer;
  a1 bigint; f1 bigint; t1 bigint; c1 bigint; vieux bigint; x bigint; n bigint; j jsonb; r record;
  ok integer := 0; ko text[] := '{}';
begin
  -- Données fictives ---------------------------------------------------------------------------
  insert into lieux (nom) values ('Lieu preuve') returning id into v_lieu;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (v_lieu, 'Promo preuve', date '2000-01-01', null) returning id into p1;
  insert into profs (nom) values ('Formateur Preuve') returning id into v_prof;
  insert into stagiaires (prenom, nom, promo_id) values ('Alpha', 'Preuve', p1) returning id into sA;
  insert into stagiaires (prenom, nom, promo_id) values ('Bravo', 'Essai', p1) returning id into sB;
  insert into stagiaires (prenom, nom, promo_id) values ('Tango', 'Fondateur', p1) returning id into sT;
  insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id) values (eA, 'stagiaire', false, false, sA);
  insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id) values (eB, 'stagiaire', false, false, sB);
  insert into user_profiles (email, role, is_admin, is_founder, prof_id) values (eF, 'prof', true, false, v_prof);
  insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id) values (eT, 'stagiaire', true, true, sT);
  insert into auth.users (id, email) values (uA, eA), (uB, eB), (uF, eF), (uT, eT);

  -- 1. Envoi : la base pose l'auteur, le nom, le rôle et la promo -------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  a1 := signaler_probleme('  Le bouton Enregistrer ne réagit pas  ', '{"page":"notes"}', null);
  perform set_config('request.jwt.claims', json_build_object('email', eF, 'sub', uF)::text, true);
  f1 := signaler_probleme('Le planning ne s''affiche pas', '{}', null);
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  t1 := signaler_probleme('Note pour moi-même', '{}', null);
  reset role;
  select * into r from signalements_app where id = a1;
  if r.email = eA and r.nom = 'P. Alpha' and r.role = 'stagiaire' and r.promo_id = p1 and r.user_id = uA
     and r.message = 'Le bouton Enregistrer ne réagit pas' and r.statut = 'nouveau' and not r.avec_capture
  then ok := ok + 1; else ko := ko || format('envoi A mal posé : %s', row_to_json(r)); end if;
  select * into r from signalements_app where id = f1;
  if r.role = 'formateur' and r.nom = 'Formateur Preuve' and r.promo_id = p1 then ok := ok + 1;
  else ko := ko || format('envoi F mal posé : %s', row_to_json(r)); end if;
  select * into r from signalements_app where id = t1;
  if r.role = 'fondateur' and r.nom = 'F. Tango' then ok := ok + 1;
  else ko := ko || format('envoi T mal posé : %s', row_to_json(r)); end if;

  -- 2. Aucune écriture directe -------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  begin
    insert into signalements_app (user_id, email, role, message) values (uA, eA, 'fondateur', 'direct');
    ko := ko || text 'insertion directe acceptée';
  exception when others then ok := ok + 1; end;
  begin
    insert into signalements_app_captures (signalement_id, image) values (a1, 'data:image/jpeg;base64,AAAA');
    ko := ko || text 'capture directe acceptée';
  exception when others then ok := ok + 1; end;
  begin
    update signalements_app set statut = 'regle' where id = a1;
    ko := ko || text 'mise à jour directe acceptée';
  exception when others then ok := ok + 1; end;
  reset role;
  if (select statut from signalements_app where id = a1) = 'nouveau' then ok := ok + 1;
  else ko := ko || text 'statut changé par une écriture directe'; end if;

  -- 3. Chacun ne lit que les siens -----------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', eB, 'sub', uB)::text, true);
  select count(*) into n from signalements_app where id = a1;
  if n = 0 then ok := ok + 1; else ko := ko || text 'B voit le signalement de A'; end if;
  select count(*) into n from mes_signalements_app();
  if n = 0 then ok := ok + 1; else ko := ko || text 'mes_signalements_app de B non vide'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  select count(*) into n from signalements_app;
  if n = 1 then ok := ok + 1; else ko := ko || format('A voit %s signalements au lieu de 1', n); end if;

  -- 4. Le fondateur lit tout ; « mes signalements » ne rend que les siens ---------------------------
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  select count(*) into n from signalements_app;
  if n = 3 then ok := ok + 1; else ko := ko || format('le fondateur voit %s signalements au lieu de 3', n); end if;
  select count(*) into n from mes_signalements_app();
  if n = 1 then ok := ok + 1; else ko := ko || format('mes_signalements_app du fondateur rend %s lignes', n); end if;

  -- 5. Traiter et supprimer : le fondateur seulement --------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  begin
    perform traiter_signalement_app(a1, 'regle', 'moi-même');
    ko := ko || text 'A a traité un signalement';
  exception when others then
    if sqlerrm like '%Réservé à l''éditeur%' then ok := ok + 1; else ko := ko || ('traiter par A : ' || sqlerrm); end if;
  end;
  delete from signalements_app where id = a1;
  perform set_config('request.jwt.claims', json_build_object('email', eF, 'sub', uF)::text, true);
  begin
    perform traiter_signalement_app(a1, 'regle', null);
    ko := ko || text 'le formateur a traité un signalement';
  exception when others then ok := ok + 1; end;
  reset role;
  if exists (select 1 from signalements_app where id = a1 and statut = 'nouveau') then ok := ok + 1;
  else ko := ko || text 'A a supprimé ou changé son signalement'; end if;

  -- 6. Un statut seul fait avancer le signalement ----------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  perform traiter_signalement_app(a1, 'regle', null);
  j := compter_signalements_app();
  if (j ->> 'nouveaux')::int = 2 then ok := ok + 1; else ko := ko || format('nouveaux du fondateur : %s', j); end if;
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  j := compter_signalements_app();
  if (j ->> 'suivis')::int = 1 and (j ->> 'nouveaux')::int = 0 then ok := ok + 1;
  else ko := ko || format('compteurs de A après Réglé : %s', j); end if;

  -- 7. Marquer la suite comme vue : les siens seulement ----------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('email', eB, 'sub', uB)::text, true);
  n := marquer_suivis_vus();
  if n = 0 then ok := ok + 1; else ko := ko || text 'B a marqué la suite de A'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  n := marquer_suivis_vus();
  j := compter_signalements_app();
  if n = 1 and (j ->> 'suivis')::int = 0 then ok := ok + 1; else ko := ko || format('marquer par A : %s, %s', n, j); end if;

  -- 8. Une réponse fait avancer ; repasser à Nouveau, non ----------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  perform traiter_signalement_app(a1, 'regle', '  Corrigé, merci !  ');
  reset role;
  select * into r from signalements_app where id = a1;
  if r.reponse = 'Corrigé, merci !' and r.repondu_le is not null and r.suivi_le is not null and r.suivi_lu_le is null
     and r.traite_par_email = eT
  then ok := ok + 1; else ko := ko || format('réponse mal posée : %s', row_to_json(r)); end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  perform marquer_suivis_vus();
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  perform traiter_signalement_app(a1, 'nouveau', 'Corrigé, merci !');
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  j := compter_signalements_app();
  if (j ->> 'suivis')::int = 0 then ok := ok + 1; else ko := ko || text 'repasser à Nouveau a prévenu la personne'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  begin
    perform traiter_signalement_app(a1, 'ferme', null);
    ko := ko || text 'statut inconnu accepté';
  exception when others then
    if sqlerrm like '%Statut inconnu%' then ok := ok + 1; else ko := ko || ('statut inconnu : ' || sqlerrm); end if;
  end;

  -- 9. Longueur du message, en points de code --------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  begin
    perform signaler_probleme(' ab ', '{}', null);
    ko := ko || text 'message de 2 caractères accepté';
  exception when others then
    if sqlerrm like '%quelques mots%' then ok := ok + 1; else ko := ko || ('message court : ' || sqlerrm); end if;
  end;
  begin
    perform signaler_probleme(repeat('😀', 2001), '{}', null);
    ko := ko || text '2 001 émojis acceptés';
  exception when others then
    if sqlerrm like '%2 000 caractères%' then ok := ok + 1; else ko := ko || ('message long : ' || sqlerrm); end if;
  end;
  x := signaler_probleme(repeat('😀', 2000), '{}', null);
  if x is not null then ok := ok + 1; else ko := ko || text '2 000 émojis refusés'; end if;

  -- 10. Contexte : un objet de 16 Ko au plus ------------------------------------------------------------
  begin
    perform signaler_probleme('Contexte en tableau', '[1, 2]', null);
    ko := ko || text 'contexte tableau accepté';
  exception when others then ok := ok + 1; end;
  begin
    perform signaler_probleme('Contexte trop long', jsonb_build_object('x', repeat('a', 17000)), null);
    ko := ko || text 'contexte de 17 Ko accepté';
  exception when others then
    if sqlerrm like '%trop long%' then ok := ok + 1; else ko := ko || ('contexte long : ' || sqlerrm); end if;
  end;

  -- 11. Capture : JPEG encodé, 700 000 caractères au plus, lisible de l'auteur et du fondateur ----------
  begin
    perform signaler_probleme('Capture PNG', '{}', 'data:image/png;base64,AAAA');
    ko := ko || text 'capture PNG acceptée';
  exception when others then
    if sqlerrm like '%image valable%' then ok := ok + 1; else ko := ko || ('capture PNG : ' || sqlerrm); end if;
  end;
  begin
    perform signaler_probleme('Capture lourde', '{}', 'data:image/jpeg;base64,' || repeat('A', 700000));
    ko := ko || text 'capture de plus de 700 000 caractères acceptée';
  exception when others then
    if sqlerrm like '%trop lourde%' then ok := ok + 1; else ko := ko || ('capture lourde : ' || sqlerrm); end if;
  end;
  c1 := signaler_probleme('Avec capture', '{}', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  select count(*) into n from signalements_app_captures where signalement_id = c1;
  if n = 1 and (select avec_capture from signalements_app where id = c1) then ok := ok + 1;
  else ko := ko || text 'capture valable non enregistrée'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', eB, 'sub', uB)::text, true);
  select count(*) into n from signalements_app_captures where signalement_id = c1;
  if n = 0 then ok := ok + 1; else ko := ko || text 'B lit la capture de A'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  select count(*) into n from signalements_app_captures where signalement_id = c1;
  if n = 1 then ok := ok + 1; else ko := ko || text 'le fondateur ne lit pas la capture'; end if;

  -- 12. Dix par 24 heures, fondateur compris -------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('email', eA, 'sub', uA)::text, true);
  for i in 1..7 loop
    perform signaler_probleme('Envoi en série ' || i, '{}', null);
  end loop;
  begin
    perform signaler_probleme('Le onzième', '{}', null);
    ko := ko || text 'onzième signalement du jour accepté';
  exception when others then
    if sqlerrm like '%déjà envoyé 10 signalements%' then ok := ok + 1; else ko := ko || ('limite : ' || sqlerrm); end if;
  end;

  -- 13. Purge à 12 mois au prochain envoi -----------------------------------------------------------
  reset role;
  insert into signalements_app (created_at, user_id, email, role, message)
  values (now() - interval '13 months', uB, eB, 'stagiaire', 'Très ancien') returning id into vieux;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', eB, 'sub', uB)::text, true);
  perform signaler_probleme('Un envoi qui purge', '{}', null);
  reset role;
  if not exists (select 1 from signalements_app where id = vieux) then ok := ok + 1;
  else ko := ko || text 'signalement de 13 mois non purgé'; end if;

  -- 14. Sans session, ni envoi ni appel anonyme ---------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', '', true);
  begin
    perform signaler_probleme('Sans session', '{}', null);
    ko := ko || text 'envoi sans session accepté';
  exception when others then
    if sqlerrm like '%Reconnecte-toi%' then ok := ok + 1; else ko := ko || ('sans session : ' || sqlerrm); end if;
  end;
  reset role;
  set local role anon;
  begin
    perform signaler_probleme('Anonyme', '{}', null);
    ko := ko || text 'le rôle anon peut appeler signaler_probleme';
  exception when others then ok := ok + 1; end;
  reset role;

  -- 15. Le fondateur supprime ; la capture suit ---------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('email', eT, 'sub', uT)::text, true);
  delete from signalements_app where id = f1;
  reset role;
  if not exists (select 1 from signalements_app where id = f1) then ok := ok + 1;
  else ko := ko || text 'le fondateur ne peut pas supprimer'; end if;

  -- 16. Fermer le compte efface ses signalements et leurs captures -------------------------------------
  delete from auth.users where id = uA;
  if not exists (select 1 from signalements_app where user_id = uA)
     and not exists (select 1 from signalements_app_captures where signalement_id = c1)
  then ok := ok + 1; else ko := ko || text 'signalements ou captures de A survivent à son compte'; end if;

  -- Verdict -----------------------------------------------------------------------------------------
  if cardinality(ko) = 0 then
    raise exception 'VERT %/0', ok;
  end if;
  raise exception 'ROUGE %/% : %', ok, cardinality(ko), array_to_string(ko, ' | ');
end
$preuve$;
