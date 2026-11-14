-- Preuve de l'enregistrement des acceptations des conditions d'utilisation (20261004_conditions_acceptations.sql, durcie par
-- 20261114_restes_1_conditions.sql : seule la version publiée s'accepte). Lève TOUJOURS une exception à la fin (verdict
-- « VERT n/0 » ou « ROUGE »), donc rien n'est conservé. Personnages fictifs (example.invalid) ; le fondateur fictif est créé le
-- temps de la preuve. Depuis le lot 4, la règle de lecture (conditions_acceptations_lecture) ouvre toutes les lignes au
-- fondateur (est_fondateur) et, à l'équipe, celles des stagiaires de sa promo : la preuve lit donc avec un fondateur fictif.
--
-- Jouer la migration ET la preuve dans la même transaction (psql -1 enveloppe tous les -f) : l'exception finale annule tout,
-- migration comprise. C'est ainsi que se fait l'essai à blanc sur la base réelle :
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_restes_1_conditions.sql \
--            -f tests/sql/conditions-acceptations-preuve.sql
-- Sur une base où la migration est déjà appliquée : -f tests/sql/conditions-acceptations-preuve.sql seul.
-- Contre-épreuve : jouée sans la migration (fonction d'avant), la preuve sort ROUGE (conditions_version_publiee absente).

do $preuve$
declare
  e_a text := 'preuve.cgu.a@example.invalid';
  e_b text := 'preuve.cgu.b@example.invalid';
  e_fond text := 'preuve.cgu.fondateur@example.invalid';
  v_pub text;
  v_essai text;
  v text; n bigint; q1 timestamptz; q2 timestamptz;
  ok integer := 0; ko text[] := '{}';
begin
  if to_regprocedure('public.conditions_version_publiee()') is null then
    raise exception 'ROUGE : conditions_version_publiee() absente (migration 20261114_restes_1_conditions non jouée)';
  end if;
  v_pub := public.conditions_version_publiee();

  -- 0. La version publiée est une vraie date, pas dans l'avenir ; la fonction n'est ouverte à aucun rôle de l'API.
  if v_pub ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$' and to_char(left(v_pub, 10)::date, 'YYYY-MM-DD') = left(v_pub, 10)
     and left(v_pub, 10)::date <= (now() at time zone 'Europe/Paris')::date then ok := ok + 1;
  else ko := ko || format('version publiée « %s » impossible', v_pub); end if;
  if not has_function_privilege('anon', 'public.conditions_version_publiee()', 'execute')
     and not has_function_privilege('authenticated', 'public.conditions_version_publiee()', 'execute') then ok := ok + 1;
  else ko := ko || 'conditions_version_publiee() exécutable par un rôle de l''API'::text; end if;
  if (select prosecdef and proconfig is not null from pg_proc where oid = 'public.accepter_conditions(text)'::regprocedure)
     and has_function_privilege('authenticated', 'public.accepter_conditions(text)', 'execute')
     and not has_function_privilege('anon', 'public.accepter_conditions(text)', 'execute') then ok := ok + 1;
  else ko := ko || 'accepter_conditions : security definer, search_path ou droits changés'::text; end if;

  insert into user_profiles (email, role, is_founder) values (e_fond, 'prof', true);

  -- 1. A accepte deux fois la version publiée : une seule ligne, même date.
  perform set_config('request.jwt.claims', json_build_object('email', upper(e_a), 'role', 'authenticated')::text, true);
  set local role authenticated;
  q1 := public.accepter_conditions(v_pub);
  q2 := public.accepter_conditions(v_pub);
  -- Versions refusées : mal formée, date impossible, future, ancienne version publiée, révision jamais publiée, sentinelle.
  v := '';
  foreach v_essai in array array['n''importe quoi', '2026-13-45', '2099-01-01', '2026-10-04', v_pub || 'z', '9999-12-31',
                                 left(v_pub, 10) || ' '] loop
    begin
      perform public.accepter_conditions(v_essai);
      v := v || format(' [%s acceptée]', v_essai);
    exception when raise_exception then
      if sqlerrm not in ('Version de conditions invalide', 'Version de conditions inconnue') then
        v := v || format(' [%s : %s]', v_essai, sqlerrm);
      end if;
    end;
  end loop;
  begin
    perform public.accepter_conditions(null);
    v := v || ' [nulle acceptée]';
  exception when raise_exception then null;
  end;
  begin insert into public.conditions_acceptations (email, version) values (e_b, v_pub); v := v || ' [directe acceptée]';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.conditions_acceptations;
  reset role;
  if q1 = q2 and q1 is not null then ok := ok + 1; else ko := ko || 'A : deux acceptations, dates différentes ou nulles'::text; end if;
  if v = '' then ok := ok + 1; else ko := ko || ('A, refus attendus :' || v); end if;
  if (select count(*) from conditions_acceptations where email = e_a) = 1
     and (select version from conditions_acceptations where email = e_a) = v_pub then ok := ok + 1;
  else ko := ko || 'A : doublon, adresse non normalisée ou version refusée enregistrée'::text; end if;
  if (select count(*) from conditions_acceptations where email = e_b) = 0 then ok := ok + 1;
  else ko := ko || 'insertion directe enregistrée pour B'::text; end if;
  if n = 1 then ok := ok + 1; else ko := ko || format('A lit %s ligne(s), attendu 1 (les siennes)', n); end if;

  -- 2. B ne voit pas l'acceptation de A.
  perform set_config('request.jwt.claims', json_build_object('email', e_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.conditions_acceptations where email = e_a;
  reset role;
  if n = 0 then ok := ok + 1; else ko := ko || 'B lit l''acceptation de A'::text; end if;

  -- 3. Le fondateur voit toutes les lignes.
  perform set_config('request.jwt.claims', json_build_object('email', e_fond, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.conditions_acceptations where email = e_a;
  reset role;
  if n = 1 then ok := ok + 1; else ko := ko || 'le fondateur ne lit pas les acceptations'::text; end if;

  -- 4. Visiteur non connecté : ni lecture ni acceptation.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin select count(*) into n from public.conditions_acceptations; v := 'lecture permise';
  exception when insufficient_privilege then v := 'lecture refusée'; end;
  begin perform public.accepter_conditions(v_pub); v := v || ' / acceptation permise';
  exception when insufficient_privilege then v := v || ' / acceptation refusée'; end;
  reset role;
  if v = 'lecture refusée / acceptation refusée' then ok := ok + 1; else ko := ko || ('visiteur : ' || v); end if;

  -- 5. Jeton connecté sans courriel : refusé.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.accepter_conditions(v_pub); v := 'acceptée';
  exception when raise_exception then v := sqlerrm; end;
  reset role;
  if v = 'Non connecte' then ok := ok + 1; else ko := ko || ('sans courriel : ' || v); end if;

  if cardinality(ko) = 0 then raise exception 'VERT %/0', ok;
  else raise exception 'ROUGE %/% : %', ok, cardinality(ko), array_to_string(ko, ' | ');
  end if;
end $preuve$;
