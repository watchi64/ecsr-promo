-- Preuve de l'enregistrement des acceptations des conditions d'utilisation. Lève TOUJOURS une
-- exception à la fin (verdict « VERT n/0 » ou « ROUGE »), donc rien n'est conservé.
-- Personnages fictifs (example.invalid) ; l'admin fictif est créé le temps de la preuve.

do $preuve$
declare
  e_a text := 'preuve.cgu.a@example.invalid';
  e_b text := 'preuve.cgu.b@example.invalid';
  e_adm text := 'preuve.cgu.admin@example.invalid';
  v text; n bigint; q1 timestamptz; q2 timestamptz;
  ok integer := 0; ko text[] := '{}';
begin
  insert into user_profiles (email, role, is_admin) values (e_adm, 'prof', true);

  -- A accepte deux fois la même version : une seule ligne, même date.
  perform set_config('request.jwt.claims', json_build_object('email', upper(e_a), 'role', 'authenticated')::text, true);
  set local role authenticated;
  q1 := public.accepter_conditions('2026-10-04');
  q2 := public.accepter_conditions('2026-10-04');
  begin perform public.accepter_conditions('n''importe quoi'); v := 'acceptée';
  exception when others then v := 'refusée'; end;
  begin insert into public.conditions_acceptations (email, version) values (e_b, '2026-10-04'); v := v || ' / directe acceptée';
  exception when others then v := v || ' / directe refusée'; end;
  select count(*) into n from public.conditions_acceptations;
  reset role;
  if q1 = q2 and v = 'refusée / directe refusée' then ok := ok + 1; else ko := ko || ('A : ' || v); end if;
  if (select count(*) from conditions_acceptations where email = e_a) = 1 then ok := ok + 1;
  else ko := ko || 'A : doublon ou adresse non normalisée'::text; end if;
  if n = 1 then ok := ok + 1; else ko := ko || format('A lit %s ligne(s), attendu 1 (les siennes)', n); end if;

  -- B ne voit pas l'acceptation de A.
  perform set_config('request.jwt.claims', json_build_object('email', e_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.conditions_acceptations where email = e_a;
  reset role;
  if n = 0 then ok := ok + 1; else ko := ko || 'B lit l''acceptation de A'::text; end if;

  -- L'admin voit toutes les lignes.
  perform set_config('request.jwt.claims', json_build_object('email', e_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.conditions_acceptations where email = e_a;
  reset role;
  if n = 1 then ok := ok + 1; else ko := ko || 'admin ne lit pas les acceptations'::text; end if;

  -- Visiteur non connecté : ni lecture ni acceptation.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin select count(*) into n from public.conditions_acceptations; v := 'lecture permise';
  exception when insufficient_privilege then v := 'lecture refusée'; end;
  begin perform public.accepter_conditions('2026-10-04'); v := v || ' / acceptation permise';
  exception when insufficient_privilege then v := v || ' / acceptation refusée'; end;
  reset role;
  if v = 'lecture refusée / acceptation refusée' then ok := ok + 1; else ko := ko || ('visiteur : ' || v); end if;

  if cardinality(ko) = 0 then raise exception 'VERT %/0', ok;
  else raise exception 'ROUGE %/% : %', ok, cardinality(ko), array_to_string(ko, ' | ');
  end if;
end $preuve$;
