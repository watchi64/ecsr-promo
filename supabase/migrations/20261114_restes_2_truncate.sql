-- Droits TRUNCATE (vider une table d'un coup) retirés aux rôles de l'API, anon et authenticated (petits restes du 14/11).
-- Supabase les donne par défaut à toute table créée dans public (relevé du 14/11 : anon sur 28 tables, authenticated sur 36).
-- Aucun écran ne s'en sert (l'API de données ne sait pas vider une table), et TRUNCATE passe outre les règles de lecture et
-- d'écriture ligne à ligne (RLS) : c'est un droit à ne laisser qu'au propriétaire et à service_role.
-- Rien d'autre ne change : SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER restent tels quels (contrôlé ci-dessous).
-- Les droits par défaut du propriétaire postgres dans public sont retouchés aussi : une table créée demain ne les reçoit plus.
-- (Ceux de supabase_admin, que postgres ne peut pas modifier, ne servent pas : toutes les tables de public sont à postgres.)
-- Retour : 20261114_restes_2_truncate_retour.sql. Preuve : tests/sql/truncate-preuve.sql.
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_restes_2_truncate.sql
set local lock_timeout = '3s';

do $truncate$
declare
  t record;
  n integer := 0;
  v_autres_avant text;
  v_autres_apres text;
begin
  -- Empreinte de tous les autres droits des tables de public, pour tous les rôles, avant.
  select md5(coalesce(string_agg(c.oid::regclass::text || ':' || a.grantee::regrole::text || ':' || a.privilege_type
                                 || ':' || a.is_grantable::text, ','
                                 order by c.oid::regclass::text, a.grantee::regrole::text, a.privilege_type), ''))
    into v_autres_avant
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
   where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') and a.privilege_type <> 'TRUNCATE';

  for t in
    select c.oid::regclass as tbl,
           has_table_privilege('anon', c.oid, 'TRUNCATE') as anon,
           has_table_privilege('authenticated', c.oid, 'TRUNCATE') as auth
      from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
     order by 1
  loop
    execute format('revoke truncate on table %s from anon, authenticated', t.tbl);
    n := n + 1;
  end loop;

  execute 'alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated';

  select md5(coalesce(string_agg(c.oid::regclass::text || ':' || a.grantee::regrole::text || ':' || a.privilege_type
                                 || ':' || a.is_grantable::text, ','
                                 order by c.oid::regclass::text, a.grantee::regrole::text, a.privilege_type), ''))
    into v_autres_apres
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
   where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') and a.privilege_type <> 'TRUNCATE';

  if exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
              where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
                and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))) then
    raise exception 'restes_2 : une table de public garde TRUNCATE pour anon ou authenticated (droit donné à PUBLIC ?)';
  end if;
  if v_autres_apres <> v_autres_avant then
    raise exception 'restes_2 : un autre droit que TRUNCATE a changé';
  end if;
  if exists (select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
              where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
                and a.privilege_type = 'TRUNCATE' and a.grantee in ('anon'::regrole, 'authenticated'::regrole)) then
    raise exception 'restes_2 : les droits par défaut de postgres donnent encore TRUNCATE à anon ou authenticated';
  end if;
  raise notice 'restes_2 : TRUNCATE retiré sur % table(s)', n;
end $truncate$;
