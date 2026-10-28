-- Empreinte de la base pour le lot 4 (rôles et portées) : trois md5 qui servent de témoin.
-- Relevées avant la première migration du lot, elles doivent redevenir identiques après les retours
-- des étapes 3, 2 et 1 (aller-retour de la répétition, ou marche arrière sur la vraie base).
--   regles    : règles de sécurité (RLS) des schémas public et storage
--   fonctions : fonctions du schéma public (définition, propriétaire, droits d'exécution)
--   droits    : droits de anon et authenticated (et de PUBLIC) sur les tables et colonnes de public
-- Lecture seule : un seul select, rejouable à tout moment (MCP execute_sql, ou EXECUTE ... INTO dans un bloc).
-- Les lignes sont triées en collation C, les valeurs nulles s'écrivent NULL (format %L) et les listes de
-- droits (aclitem) sont éclatées puis triées : l'empreinte ne dépend ni de l'ordre de création des règles,
-- ni de l'ordre dans lequel les droits ont été accordés.
-- Les valeurs de référence ont été relevées avec le chemin de recherche de la session MCP ("$user", public,
-- extensions) : la base qualifie par leur schéma les noms que le chemin ne rend pas visibles, donc un autre
-- chemin peut donner un autre md5 sans que rien n'ait changé.
select
  (select md5(coalesce(string_agg(l, E'\n' order by l collate "C"), ''))
     from (select format('%L|%L|%L|%L|%L|%L|%L|%L',
                         schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check) as l
             from pg_policies
            where schemaname in ('public', 'storage')) r) as regles,
  (select md5(coalesce(string_agg(l, E'\n' order by l collate "C"), ''))
     from (select format('%L|%L|%L|%L|%L',
                         p.proname,
                         pg_get_function_identity_arguments(p.oid),
                         md5(pg_get_functiondef(p.oid)),
                         pg_get_userbyid(p.proowner),
                         (select string_agg(g, ',' order by g collate "C")
                            from (select format('%s>%s:%s:%s', a.grantor::regrole,
                                                case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
                                                a.privilege_type, a.is_grantable) as g
                                    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a) acl)) as l
             from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.prokind <> 'a') f) as fonctions,
  (select md5(coalesce(string_agg(l, E'\n' order by l collate "C"), ''))
     from (select format('table|%s|%s>%s|%s|%s', c.relname, a.grantor::regrole,
                         case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
                         a.privilege_type, a.is_grantable) as l
             from pg_class c
            cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
            where c.relnamespace = 'public'::regnamespace
              and c.relkind in ('r', 'p', 'v', 'm', 'f')
              and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))
           union all
           select format('colonne|%s.%s|%s>%s|%s|%s', c.relname, t.attname, a.grantor::regrole,
                         case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
                         a.privilege_type, a.is_grantable)
             from pg_class c
             join pg_attribute t on t.attrelid = c.oid and t.attnum > 0 and not t.attisdropped and t.attacl is not null
            cross join lateral aclexplode(t.attacl) a
            where c.relnamespace = 'public'::regnamespace
              and c.relkind in ('r', 'p', 'v', 'm', 'f')
              and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))) d) as droits;
