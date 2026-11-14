-- Preuve du retrait de TRUNCATE aux rôles de l'API (20261114_restes_2_truncate.sql). Lève TOUJOURS une exception à la fin
-- (verdict « VERT n/0 » ou « ROUGE »), donc rien n'est conservé (la table d'essai non plus).
-- Jouer la migration ET la preuve dans la même transaction (psql -1 enveloppe tous les -f) : l'exception finale annule tout,
-- migration comprise. C'est l'essai à blanc sur la base réelle :
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_restes_2_truncate.sql -f tests/sql/truncate-preuve.sql
-- Après application : -f tests/sql/truncate-preuve.sql seul. Contre-épreuve : sans la migration, ROUGE.
-- Aucun TRUNCATE n'est tenté sur une vraie table : l'essai se fait sur une table créée par la preuve.

do $preuve$
declare
  n integer;
  v text;
  ok integer := 0; ko text[] := '{}';
begin
  -- 1. Aucune table, vue ou table étrangère de public ne laisse TRUNCATE à anon ni à authenticated.
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege('anon', c.oid, 'TRUNCATE');
  if n = 0 then ok := ok + 1; else ko := ko || format('anon garde TRUNCATE sur %s table(s)', n); end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege('authenticated', c.oid, 'TRUNCATE');
  if n = 0 then ok := ok + 1; else ko := ko || format('authenticated garde TRUNCATE sur %s table(s)', n); end if;

  -- 2. Les autres droits restent : les rôles de l'API lisent toujours les tables qu'ils lisaient (au moins une), service_role
  --    garde TRUNCATE partout où il lit (certaines tables, comme affectations ou titres, ne lui donnent rien du tout).
  if exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
              where s.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'SELECT')) then
    ok := ok + 1;
  else ko := ko || 'authenticated ne lit plus aucune table'::text; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and pg_get_userbyid(c.relowner) = 'postgres'
     and has_table_privilege('service_role', c.oid, 'SELECT') and not has_table_privilege('service_role', c.oid, 'TRUNCATE');
  if n = 0 then ok := ok + 1; else ko := ko || format('service_role a perdu TRUNCATE sur %s table(s)', n); end if;

  -- 3. Droits par défaut : une table créée demain par postgres dans public ne donne pas TRUNCATE, mais garde le reste.
  if current_user = 'postgres' then
    create table public.preuve_restes_truncate (id integer);
    if not has_table_privilege('anon', 'public.preuve_restes_truncate', 'TRUNCATE')
       and not has_table_privilege('authenticated', 'public.preuve_restes_truncate', 'TRUNCATE') then ok := ok + 1;
    else ko := ko || 'table neuve : TRUNCATE donné à anon ou authenticated'::text; end if;
    if has_table_privilege('authenticated', 'public.preuve_restes_truncate', 'SELECT')
       = (select coalesce(bool_or(a.privilege_type = 'SELECT' and a.grantee = 'authenticated'::regrole), false)
            from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
           where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r') then
      ok := ok + 1;
    else ko := ko || 'table neuve : les autres droits par défaut ont changé'::text; end if;
    -- 4. Le geste lui-même, sur la table d'essai : refusé (42501) à authenticated et à anon.
    perform set_config('request.jwt.claims', json_build_object('email', 'preuve.truncate@example.invalid', 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin truncate public.preuve_restes_truncate; v := 'vidée';
    exception when insufficient_privilege then v := 'refusé'; end;
    reset role;
    set local role anon;
    begin truncate public.preuve_restes_truncate; v := v || ' / vidée';
    exception when insufficient_privilege then v := v || ' / refusé'; end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    if v = 'refusé / refusé' then ok := ok + 1; else ko := ko || ('TRUNCATE de la table d''essai : ' || v); end if;
  else
    ko := ko || format('preuve jouée par %s, pas par postgres : droits par défaut non vérifiés', current_user);
  end if;

  if cardinality(ko) = 0 then raise exception 'VERT %/0', ok;
  else raise exception 'ROUGE %/% : %', ok, cardinality(ko), array_to_string(ko, ' | ');
  end if;
end $preuve$;
