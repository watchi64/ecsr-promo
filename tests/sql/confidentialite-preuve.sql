-- Preuve de la confidentialité des notes (spec 2026-10-04-confidentialite-notes-design).
-- Rejouable à volonté : le bloc lève TOUJOURS une exception à la fin, qui annule toutes les
-- données de test et porte le verdict (« VERT n/0 » ou « ROUGE n/k : … »).
-- Données 100 % fictives (adresses en example.invalid, promo 9999) : aucun email réel ici.
--
-- Répétition de l'étape 2 avant de l'appliquer : envoyer dans UNE SEULE requête le texte de
-- supabase/migrations/20261004_confidentialite_2_fermeture.sql suivi de ce fichier ; la levée
-- finale annule aussi la migration. Sans l'étape 2, les contrôles de lecture sont ROUGES :
-- c'est la fuite que la preuve doit détecter.
--
-- Le jeu de notes et les attendus des statistiques sont ceux de tests/notes-stats.test.mjs.

set local lock_timeout = '3s';

do $preuve$
declare
  v_promo integer := 9999;
  e_a text := 'preuve.conf.a@example.invalid';      -- stagiaire 1, notes visibles
  e_b text := 'preuve.conf.b@example.invalid';      -- stagiaire 2, notes masquées
  e_c text := 'preuve.conf.c@example.invalid';      -- stagiaire 3, notes visibles
  e_prof text := 'preuve.conf.prof@example.invalid'; -- formateur sans droit admin
  e_adm text := 'preuve.conf.admin@example.invalid'; -- formateur admin
  s1 integer; s2 integer; s3 integer; s4 integer;
  c1 text; c2 text;
  st jsonb; v text; n bigint;
  ok integer := 0; ko text[] := '{}';
begin
  -- Contrôle : enregistre le résultat.
  -- (fonction locale impossible en plpgsql : on passe par un tableau d'échecs)

  select code into c1 from competences order by code limit 1;
  select code into c2 from competences order by code offset 1 limit 1;

  -- Données fictives ------------------------------------------------------------------
  insert into promos (id, lieu_id, nom, date_debut) values (v_promo, 2, 'Preuve confidentialité', current_date);
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveA', 'CONF', 991, v_promo, true) returning id into s1;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveB', 'CONF', 992, v_promo, true) returning id into s2;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveC', 'CONF', 993, v_promo, true) returning id into s3;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveD', 'CONF', 994, v_promo, false) returning id into s4;
  insert into user_profiles (email, role, stagiaire_id, anonymous_notes) values
    (e_a, 'stagiaire', s1, false), (e_b, 'stagiaire', s2, true), (e_c, 'stagiaire', s3, false);
  insert into user_profiles (email, role, is_admin) values (e_prof, 'prof', false), (e_adm, 'prof', true);

  insert into evaluations (stagiaire_id, type, theme_numero, competence_code, note, note_max) values
    (s1, 'Thème', 1, null, 10, 20), (s1, 'Thème', 1, null, 15, 20), (s2, 'Thème', 1, null, 4, 5),
    (s2, 'Thème', 2, null, 8, 20), (s3, 'Compétence', null, c1, 20, 20), (s4, 'Thème', 2, null, 3, 20),
    (s3, 'Thème', 3, null, null, 20), (s1, 'Thème', 2, null, 5, 0), (s2, 'Compétence', null, c2, 12, 20);
  insert into fiches_suivi (stagiaire_id, besoins) values (s1, 'PreuveA'), (s2, 'PreuveB');
  insert into stagiaires_prive (stagiaire_id, date_naissance) values (s1, '2000-01-01'), (s2, '2000-02-02');

  -- Lectures par personnage -------------------------------------------------------------
  -- Chaque ligne : personnage, table, attendu. Notes : 1 → 3 lignes, 2 → 3, 3 → 2, 4 → 1.
  declare
    r record;
  begin
    for r in select * from (values
      (e_a, 'evaluations', 6), (e_b, 'evaluations', 3), (e_c, 'evaluations', 6),
      (e_prof, 'evaluations', 9), (e_adm, 'evaluations', 9),
      (e_a, 'evaluations_audit', 6), (e_b, 'evaluations_audit', 3), (e_prof, 'evaluations_audit', 9),
      (e_a, 'fiches_suivi', 1), (e_c, 'fiches_suivi', 0), (e_prof, 'fiches_suivi', 2), (e_adm, 'fiches_suivi', 2),
      (e_a, 'stagiaires_prive', 1), (e_c, 'stagiaires_prive', 0), (e_prof, 'stagiaires_prive', 2), (e_adm, 'stagiaires_prive', 2),
      (e_a, 'stagiaires', 4)
    ) as t(email, tbl, attendu)
    loop
      perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
      perform set_config('request.headers', json_build_object('x-promo-id', v_promo::text)::text, true);
      set local role authenticated;
      begin
        if r.tbl = 'stagiaires_prive' then
          execute 'select count(*) from public.stagiaires_prive p join public.stagiaires s on s.id = p.stagiaire_id where s.promo_id = $1' into n using v_promo;
        else
          execute format('select count(*) from public.%I where promo_id = $1', r.tbl) into n using v_promo;
        end if;
      exception when others then n := -1;
      end;
      reset role;
      if n = r.attendu then ok := ok + 1;
      else ko := ko || format('%s lit %s ligne(s) de %s, attendu %s', split_part(r.email, '@', 1), n, r.tbl, r.attendu);
      end if;
    end loop;
  end;

  -- Statistiques du groupe : identiques pour tous, anonymes comprises -------------------
  declare
    p text;
  begin
    foreach p in array array[e_a, e_b, e_prof] loop
      perform set_config('request.jwt.claims', json_build_object('email', p, 'role', 'authenticated')::text, true);
      perform set_config('request.headers', json_build_object('x-promo-id', v_promo::text)::text, true);
      set local role authenticated;
      begin
        st := public.notes_stats_groupe();
      exception when others then st := null;
      end;
      reset role;
      if st is not null
         and (st->>'n_lignes')::int = 9 and (st->>'n')::int = 7
         and abs((st->>'somme')::numeric - 84) < 1e-9 and (st->>'mediane')::numeric = 12
         and (st->>'sous_10')::int = 2 and st->'repartition' = '[1,0,2,2,2]'::jsonb
         and jsonb_array_length(st->'themes') = 2
         and (st->'themes'->0->>'num')::int = 1 and (st->'themes'->0->>'n')::int = 3
         and abs((st->'themes'->0->>'somme')::numeric - 41) < 1e-9 and (st->'themes'->0->>'mediane')::numeric = 15
         and (st->'themes'->1->>'num')::int = 2 and (st->'themes'->1->>'n')::int = 2
         and abs((st->'themes'->1->>'somme')::numeric - 11) < 1e-9 and (st->'themes'->1->>'mediane')::numeric = 5.5
         and jsonb_array_length(st->'competences') = 2
         and st->'competences'->0->>'code' = c1 and abs((st->'competences'->0->>'somme')::numeric - 20) < 1e-9
         and st->'competences'->1->>'code' = c2 and abs((st->'competences'->1->>'somme')::numeric - 12) < 1e-9
         and abs((st->>'moy_stagiaire_max')::numeric - 20) < 1e-9
         and abs((st->>'moy_stagiaire_min')::numeric - 12) < 1e-9
      then ok := ok + 1;
      else ko := ko || format('statistiques fausses pour %s : %s', split_part(p, '@', 1), left(coalesce(st::text, 'erreur'), 300));
      end if;
    end loop;
  end;

  -- Sans authentification ni promo : rien.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
  set local role anon;
  begin
    st := public.notes_stats_groupe();
    v := 'exécutée';
  exception when insufficient_privilege then v := 'refusée';
  when others then v := 'erreur ' || sqlstate;
  end;
  reset role;
  if v = 'refusée' then ok := ok + 1; else ko := ko || ('statistiques par un visiteur : ' || v); end if;

  -- Date de naissance : écriture par l'intéressé, refus pour autrui -------------------------
  perform set_config('request.jwt.claims', json_build_object('email', e_a, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', json_build_object('x-promo-id', v_promo::text)::text, true);
  set local role authenticated;
  begin
    perform public.set_date_naissance(s1, '1999-09-09');
    v := 'ok';
  exception when others then v := 'erreur ' || sqlerrm;
  end;
  begin
    perform public.set_date_naissance(s2, '1999-09-09');
    v := v || ' / autrui accepté';
  exception when others then v := v || ' / autrui refusé';
  end;
  begin
    insert into public.stagiaires_prive (stagiaire_id, date_naissance) values (s3, '1999-09-09');
    v := v || ' / écriture directe acceptée';
  exception when others then v := v || ' / écriture directe refusée';
  end;
  reset role;
  if v = 'ok / autrui refusé / écriture directe refusée'
     and (select date_naissance from stagiaires_prive where stagiaire_id = s1) = '1999-09-09'
     and (select date_naissance from stagiaires_prive where stagiaire_id = s2) = '2000-02-02'
  then ok := ok + 1; else ko := ko || ('date de naissance : ' || v); end if;

  -- L'ancienne colonne reste vide (étape 2) ------------------------------------------------
  if exists (select 1 from stagiaires where date_naissance is not null) then
    ko := ko || 'stagiaires.date_naissance encore renseignée'::text;
  else ok := ok + 1;
  end if;

  if cardinality(ko) = 0 then
    raise exception 'VERT %/0', ok;
  else
    raise exception 'ROUGE %/% : %', ok, cardinality(ko), array_to_string(ko, ' | ');
  end if;
end $preuve$;
