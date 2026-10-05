-- Preuve de l'effacement et de l'anonymisation (migration 20261005_effacement_donnees).
-- Rejouable : le bloc lève TOUJOURS une exception à la fin (verdict « VERT n/0 » ou « ROUGE »),
-- tout est annulé. Données 100 % fictives (example.invalid, promo 9999).
-- Répétition avant application : envoyer la migration puis ce fichier dans UNE seule requête.

set local lock_timeout = '3s';

do $preuve$
declare
  v_promo integer := 9999;
  e_x text := 'preuve.eff.x@example.invalid';     -- stagiaire qui demande l'effacement
  e_y text := 'preuve.eff.y@example.invalid';     -- stagiaire de la même promo
  e_z text := 'preuve.eff.z@example.invalid';     -- stagiaire qui est aussi admin
  e_adm text := 'preuve.eff.admin@example.invalid';
  sx integer; sy integer; sz integer; u_x uuid := gen_random_uuid(); q bigint;
  b1 integer; b2 integer; b3 integer; pe_vieille integer; pe_recente integer;
  r jsonb; v text; n bigint; t text;
  ok integer := 0; ko text[] := '{}';

begin
  -- Données fictives -----------------------------------------------------------------------
  insert into promos (id, lieu_id, nom, date_debut, date_fin)
  values (v_promo, 2, 'Preuve effacement', current_date - 800, current_date - 400);
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveX', 'CEFFACE', 991, v_promo, true) returning id into sx;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveY', 'GARDE', 992, v_promo, true) returning id into sy;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveZ', 'ADMIN', 993, v_promo, false) returning id into sz;
  insert into user_profiles (email, role, stagiaire_id) values (e_x, 'stagiaire', sx), (e_y, 'stagiaire', sy);
  insert into user_profiles (email, role, stagiaire_id, is_admin) values (e_z, 'stagiaire', sz, true);
  insert into user_profiles (email, role, is_admin) values (e_adm, 'prof', true);
  insert into auth.users (id, email) values (u_x, e_x);
  insert into chatbot_usage (user_id, jour, nb) values (u_x, current_date, 3);

  insert into stagiaires_prive (stagiaire_id, date_naissance) values (sx, '1990-01-01'), (sy, '1991-01-01');
  insert into dp_dossiers (stagiaire_id, promo_id, data) values (sx, v_promo, '{"nom":"PreuveX"}');
  insert into epcf_livrets (stagiaire_id, promo_id, data) values (sx, v_promo, '{"nom":"CEFFACE"}');
  insert into fiches_suivi (stagiaire_id, promo_id, besoins) values (sx, v_promo, 'PreuveX : besoin');
  insert into epcf_evaluations (stagiaire_id, promo_id, trame, scores, commentaire)
  values (sx, v_promo, 'salle', '{"c1": 3}', 'Bravo PreuveX');
  insert into evaluations (stagiaire_id, type, theme_numero, note, note_max, observation, created_by_email)
  values (sx, 'Thème', 1, 14, 20, 'PreuveX fatigué', e_x), (sy, 'Thème', 1, 12, 20, null, null);
  insert into passages (date, stagiaire_id, type, resultat, commentaire, created_by_who, updated_by_who, promo_id)
  values (current_date - 450, sx, 'Voiture', 'Effectué', 'RAS PreuveX', 'C. PreuveX', 'C. PreuveX', v_promo);
  select id into q from qcm_questions order by id limit 1;
  insert into qcm_signalements (question_id, email, stagiaire_id, motif) values (q, e_x, sx, 'autre');
  insert into conditions_acceptations (email, version) values (e_x, '2026-10-04'), (e_y, '2026-10-04');

  -- 1. Refus ---------------------------------------------------------------------------------
  perform set_config('request.headers', json_build_object('x-promo-id', v_promo::text)::text, true);
  perform set_config('request.jwt.claims', json_build_object('email', e_y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.anonymiser_stagiaire(sx); v := 'accepté'; exception when others then v := 'refusé'; end;
  begin perform public.anonymiser_promo(); v := v || '/accepté'; exception when others then v := v || '/refusé'; end;
  begin perform public.purger_benevoles(array[1]); v := v || '/accepté'; exception when others then v := v || '/refusé'; end;
  begin perform public._anonymiser_stagiaire(sx); v := v || '/accepté'; exception when others then v := v || '/refusé'; end;
  reset role;
  if v = 'refusé/refusé/refusé/refusé' then ok := ok + 1; else ko := ko || ('stagiaire non admin : ' || v); end if;

  perform set_config('request.jwt.claims', json_build_object('email', e_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.anonymiser_stagiaire(sx); v := 'accepté'; exception when others then v := sqlerrm; end;
  reset role;
  if v like '%abandon%' then ok := ok + 1; else ko := ko || ('stagiaire actif : ' || v); end if;

  set local role authenticated;
  begin perform public.anonymiser_stagiaire(sz); v := 'accepté'; exception when others then v := sqlerrm; end;
  reset role;
  if v like '%administrateur%' then ok := ok + 1; else ko := ko || ('compte admin : ' || v); end if;

  -- 2. Effacement d'un stagiaire en abandon ---------------------------------------------------
  update stagiaires set actif = false where id = sx;
  set local role authenticated;
  begin r := public.anonymiser_stagiaire(sx); v := 'ok'; exception when others then v := sqlerrm; end;
  reset role;
  if v <> 'ok' then ko := ko || ('effacement : ' || v); end if;

  if (select prenom = 'Anonyme ' || sx and nom is null and not actif and anonymise_le is not null from stagiaires where id = sx)
  then ok := ok + 1; else ko := ko || 'fiche non anonymisée'::text; end if;

  if (select count(*) from stagiaires_prive where stagiaire_id = sx) + (select count(*) from dp_dossiers where stagiaire_id = sx)
     + (select count(*) from epcf_livrets where stagiaire_id = sx) + (select count(*) from fiches_suivi where stagiaire_id = sx) = 0
  then ok := ok + 1; else ko := ko || 'documents privés restants'::text; end if;

  if (select count(*) from evaluations where stagiaire_id = sx) = 1
     and (select count(*) from passages where stagiaire_id = sx) = 1
     and (select count(*) from epcf_evaluations where stagiaire_id = sx and scores = '{"c1": 3}') = 1
  then ok := ok + 1; else ko := ko || 'résultats perdus'::text; end if;

  if (select count(*) from evaluations where stagiaire_id = sx and (observation is not null or created_by_email <> 'anonyme')) = 0
     and (select count(*) from passages where stagiaire_id = sx and (commentaire is not null or created_by_who <> 'Stagiaire anonyme')) = 0
     and (select count(*) from epcf_evaluations where stagiaire_id = sx and commentaire is not null) = 0
  then ok := ok + 1; else ko := ko || 'textes libres ou signatures restants'::text; end if;

  -- Aucune trace du nom ni de l'e-mail dans les historiques, signalements, acceptations, comptes.
  select string_agg(x, ', ') into t from (
    select 'passages_audit' x from passages_audit where (coalesce(before_data::text,'') || coalesce(after_data::text,'') || coalesce(changed_by_who,'')) ~ '(PreuveX|CEFFACE|preuve\.eff\.x)'
    union all select 'evaluations_audit' from evaluations_audit where (coalesce(before_data::text,'') || coalesce(after_data::text,'') || coalesce(changed_by_email,'')) ~ '(PreuveX|CEFFACE|preuve\.eff\.x)'
    union all select 'qcm_signalements' from qcm_signalements where email = e_x
    union all select 'conditions_acceptations' from conditions_acceptations where email = e_x
    union all select 'user_profiles' from user_profiles where email = e_x
    union all select 'auth.users' from auth.users where email = e_x
    union all select 'chatbot_usage' from chatbot_usage where user_id = u_x
  ) traces;
  if t is null then ok := ok + 1; else ko := ko || ('traces restantes : ' || t); end if;

  if (select count(*) from effacements_journal where type = 'stagiaire' and cible = 'stagiaire ' || sx
        and fait_par_email = e_adm and details::text !~ '(PreuveX|CEFFACE|preuve\.eff)') = 1
  then ok := ok + 1; else ko := ko || 'journal absent ou nominatif'::text; end if;

  -- La voisine n'est pas touchée.
  if (select prenom from stagiaires where id = sy) = 'PreuveY'
     and exists (select 1 from user_profiles where email = e_y)
     and exists (select 1 from conditions_acceptations where email = e_y)
     and exists (select 1 from stagiaires_prive where stagiaire_id = sy)
  then ok := ok + 1; else ko := ko || 'stagiaire voisine touchée'::text; end if;

  -- Deuxième appel : rien à refaire.
  set local role authenticated;
  r := public.anonymiser_stagiaire(sx);
  reset role;
  if coalesce((r ->> 'deja')::boolean, false) then ok := ok + 1; else ko := ko || 'second appel non idempotent'::text; end if;

  -- 3. Fin de promo + 12 mois ------------------------------------------------------------------
  update promos set date_fin = current_date - 100 where id = v_promo;
  set local role authenticated;
  r := public.etat_anonymisation_promo();
  begin perform public.anonymiser_promo(); v := 'accepté'; exception when others then v := sqlerrm; end;
  reset role;
  if not (r ->> 'anonymisable')::boolean and v like '%partir du%' then ok := ok + 1;
  else ko := ko || ('promo trop récente : ' || v || ' ' || r::text); end if;

  update promos set date_fin = current_date - 400 where id = v_promo;
  set local role authenticated;
  r := public.etat_anonymisation_promo();
  if not ((r ->> 'anonymisable')::boolean and (r ->> 'restants')::int = 2 and (r ->> 'comptes_admin')::int = 1) then
    ko := ko || ('état avant : ' || r::text);
  end if;
  r := public.anonymiser_promo();
  reset role;
  if (r ->> 'anonymises')::int = 1 and (r ->> 'comptes_admin_ignores')::int = 1
     and (select anonymise_le is not null from stagiaires where id = sy)
     and (select anonymise_le is null from stagiaires where id = sz)
     and not exists (select 1 from user_profiles where email = e_y)
  then ok := ok + 1; else ko := ko || ('anonymisation de promo : ' || r::text); end if;

  -- 4. Élèves bénévoles ------------------------------------------------------------------------
  insert into benevoles (prenom, nom, lieu_id, created_at) values ('PreuveB1', 'VIEUX', 2, now() - interval '3 years') returning id into b1;
  insert into benevoles (prenom, nom, lieu_id, created_at) values ('PreuveB2', 'ACTIF', 2, now() - interval '3 years') returning id into b2;
  insert into benevoles (prenom, nom, lieu_id, created_at) values ('PreuveB3', 'NOUVEAU', 2, now() - interval '1 month') returning id into b3;
  insert into planning_entries (semaine_lundi, day_index, half_day, slot, promo_id, benevoles_ids)
  values (date_trunc('week', current_date - 700)::date, 0, 'matin', 0, v_promo, array[b1]) returning id into pe_vieille;
  insert into planning_entries (semaine_lundi, day_index, half_day, slot, promo_id, benevoles_ids)
  values (date_trunc('week', current_date - 60)::date, 0, 'matin', 0, v_promo, array[b2]) returning id into pe_recente;

  set local role authenticated;
  select count(*) into n from public.benevoles_a_purger() where id in (b1, b2, b3);
  v := (select string_agg(display, ',') from public.benevoles_a_purger() where id in (b1, b2, b3));
  n := n * 10 + public.purger_benevoles(array[b1, b2, b3]);
  reset role;
  if n = 11 and v = 'V. PreuveB1'
     and not exists (select 1 from benevoles where id = b1)
     and exists (select 1 from benevoles where id = b2) and exists (select 1 from benevoles where id = b3)
     and (select benevoles_ids from planning_entries where id = pe_vieille) = '{}'
     and (select benevoles_ids from planning_entries where id = pe_recente) = array[b2]
     and exists (select 1 from effacements_journal where type = 'benevoles' and (details ->> 'supprimes')::int = 1)
  then ok := ok + 1; else ko := ko || format('bénévoles : n=%s, proposés=%s', n, v); end if;

  -- 5. Visiteur ----------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin perform public.anonymiser_stagiaire(sy); v := 'accepté'; exception when insufficient_privilege then v := 'refusé'; end;
  begin select count(*) into n from public.effacements_journal; v := v || '/lu'; exception when insufficient_privilege then v := v || '/refusé'; end;
  reset role;
  if v = 'refusé/refusé' then ok := ok + 1; else ko := ko || ('visiteur : ' || v); end if;

  if cardinality(ko) = 0 then raise exception 'VERT %/0', ok;
  else raise exception 'ROUGE %/% : %', ok, cardinality(ko), array_to_string(ko, ' | ');
  end if;
end $preuve$;
