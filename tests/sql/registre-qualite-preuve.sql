-- Preuve de la migration 20261109_registre_qualite (registre qualité, Qualiopi Q4).
-- Rejouable : le bloc lève TOUJOURS une exception à la fin (verdict « VERT n/0 » ou « ROUGE ok/ko : cas »), tout est
-- annulé. Données 100 % fictives (example.invalid). Les dates sont posées par rapport à now() : la preuve tient quel
-- que soit le jour où on la joue.
--
-- Méthode (mémoire « Répétition de migration dans la preuve SQL ») : la migration et son retour sont joués PAR EXECUTE
-- à l'intérieur du bloc DO, entre deux empreintes md5 du schéma public (tables, colonnes, contraintes, fonctions,
-- droits, règles, déclencheurs) et des données existantes ; la levée finale annule tout. Si la table existe déjà (base
-- où la migration a été appliquée), la preuve joue les mêmes cas sans rejouer migration ni retour.
--
-- Jouée sur une base LOCALE jetable (Postgres de scoop, authentification « trust ») :
--   D=<dossier temporaire> ; initdb -D $D/pg -U postgres --auth=trust -E UTF8 --no-locale
--   pg_ctl -D $D/pg -o "-p <port>" -l $D/pg.log start ; createdb -p <port> -U postgres rq
--   export PGCLIENTENCODING=UTF8
--   psql -p <port> -U postgres -d rq -v ON_ERROR_STOP=1 \
--        -v lot4_fonctions=<chemin absolu de supabase/migrations/20261028_roles_2_fonctions.sql> \
--        -f tests/sql/registre-qualite-schema-minimal.sql
--   (le schéma minimal charge celui des questionnaires, puis rejoue 20261028_signalements_app.sql et
--   20261108_questionnaires.sql ; voir son en-tête)
--   psql -p <port> -U postgres -d rq -1 -v migration=<chemin absolu de 20261109_registre_qualite.sql> \
--        -v retour=<chemin absolu de 20261109_registre_qualite_retour.sql> -f tests/sql/registre-qualite-preuve.sql
--   pg_ctl -D $D/pg stop ; rm -rf $D
-- (pg_read_file lit les deux fichiers côté serveur : superutilisateur local seulement. Sur une autre base, remplacer
-- les deux pg_read_file par le texte des fichiers.) Les entrées closes il y a plus de 3 ans se préparent avec
-- session_replication_role = replica (déclencheur muet le temps de l'insertion), posé par une commande SET exécutée
-- (EXECUTE) et non par set_config() : Supabase n'accepte ce réglage du rôle postgres que par la commande.
--
-- Résultats du 09/11/2026, correction 1 de la relecture (Postgres 18.4 local, port 55473, base recréée à chaque
-- passage, schéma minimal ci-dessus). Le déclencheur ne repose plus le lieu d'après la promo qu'à la création, quand la
-- promo change ou quand le lieu change : une promo passée dans un autre centre ne bloque plus l'effacement. Cas ajoutés :
-- promo P3 passée du lieu 1 au lieu 2 après l'écriture de deux entrées (OLD5 close il y a plus de 3 ans et liée à un
-- signalement de 13 mois, EC en cours et liée elle aussi), effacement, modification, purge des deux liens.
--   - avant la migration (fichiers de migration et de retour vides) : ROUGE 6/125 ; les six cas qui passent sont sans
--     objet sur une base vide (peut_gerer_qualite() intacte, signalement purgé, compte fermé, trois cas du retour) ;
--   - après : VERT 131/0 (trois passages) ; base où la migration est déjà appliquée : VERT 128/0 (les trois cas du
--     retour ne se jouent pas), aucune ligne laissée (registre, signalements, comptes, profils, promos à 0) ;
--   - contre-épreuve 1 (règle de lecture using (true)) : ROUGE 123/8, sur la forme des règles et la lecture par le
--     formateur, le stagiaire, la direction et le fondateur en quatre aperçus ;
--   - contre-épreuve 2 (droit delete accordé à authenticated) : ROUGE 122/9, sur les droits de la table et les huit
--     suppressions (sans règle de suppression, elles touchent 0 ligne au lieu d'être refusées) ;
--   - contre-épreuve 3 (garde de la mise à nul seule du lien retirée) : ROUGE 125/6, sur la purge (signaler_probleme
--     échoue sur les entrées effacées liées), le lien de l'entrée purgée, l'entrée effacée purgée, les deux entrées de la
--     promo passée dans un autre centre et le compte fermé (modifie_le changé) ;
--   - contre-épreuve 4 (condition de l'échéance retirée du déclencheur et de la fonction) : ROUGE 127/4, sur l'échéance
--     unique, l'effacement avant toute échéance (2 au lieu de 0) et l'entrée à 3 ans moins un jour (deux cas) ; 4b
--     (déclencheur seul) : ROUGE 126/5, sur l'échéance unique, les deux écritures directes avant l'échéance et la même
--     entrée (deux cas) ; 4c (fonction seule) : ROUGE 114/17, l'effacement échoue en bloc sur l'entrée pas encore due (le
--     déclencheur la refuse) et tous les cas d'effacement qui suivent ;
--   - contre-épreuve 5 (corps de peut_gerer_qualite() remplacé par select fondateur_reel(), comme la contre-épreuve 8 de
--     Q3) : ROUGE 114/17, sur les seuls cas du fondateur en aperçu formateur, stagiaire, direction et siège (lecture,
--     ajout, modification, effacement) et le décompte qui en découle ;
--   - contre-épreuve 6 (déclencheur d'avant la correction : lieu reposé d'après la promo à chaque modification) :
--     ROUGE 114/17, l'effacement échoue en bloc sur l'entrée de la promo passée au lieu 2 (« L'effacement ne change que
--     les textes ») et tous les cas d'effacement qui suivent ; la modification de EC déplace son lieu ; la purge, elle,
--     passe (la mise à nul seule du lien sort du déclencheur avant le calcul du lieu), ses cas rougissent par contrecoup ;
--   - retour joué hors preuve (psql -1 -f) : empreinte 49bb5f5e… avant, c679ef40… migration appliquée, 49bb5f5e… après
--     le retour ; plus aucune table ni fonction du registre ; peut_gerer_qualite() reste.
--
-- Production (10/11/2026, accord de Timy) : les deux pg_read_file remplacés par le texte des fichiers ; essai à blanc
-- (migration jouée dans le bloc, tout annulé) VERT 131/0 ; migration appliquée (psql -1) ; puis VERT 128/0 deux fois,
-- aucune ligne laissée (registre, comptes, profils, promos, lieux, signalements de la preuve à 0).
--
-- Premiers résultats (09/11/2026, avant la correction 1) : ROUGE 6/121 à vide, VERT 127/0 trois fois, base appliquée
-- VERT 124/0, contre-épreuves 1 à 5 : ROUGE 119/8, 118/9, 123/4, 123/4 (4b 122/5, 4c 112/15), 110/17 ; empreinte de la
-- migration appliquée 0de8a57d….

select length(set_config('preuve.migration', pg_read_file(:'migration'), false)) as migration_lue,
       length(set_config('preuve.retour', pg_read_file(:'retour'), false)) as retour_lu;

set local lock_timeout = '3s';

do $preuve$
declare
  v_deja boolean := to_regclass('public.registre_qualite') is not null;
  v_empreinte text := $q$
    select md5(string_agg(x, E'\n' order by x)) from (
      select 'rel ' || c.relname || ' ' || c.relkind::text || ' ' || c.relrowsecurity::text || ' ' || coalesce(c.relacl::text, '')
        from pg_class c where c.relnamespace = 'public'::regnamespace
      union all
      select 'col ' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' '
             || a.attnotnull::text || ' ' || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
        from pg_attribute a join pg_class c on c.oid = a.attrelid
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where c.relnamespace = 'public'::regnamespace and a.attnum > 0 and not a.attisdropped
      union all
      select 'con ' || conrelid::regclass::text || ' ' || conname || ' ' || pg_get_constraintdef(oid)
        from pg_constraint where connamespace = 'public'::regnamespace
      union all
      select 'fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '')
        from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
      union all
      select 'pol ' || tablename || ' ' || policyname || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
        from pg_policies where schemaname = 'public'
      union all
      select 'trg ' || tgrelid::regclass::text || ' ' || tgname from pg_trigger t
        join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
      union all
      select 'lieux ' || md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from public.lieux t
      union all
      select 'promos ' || md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from public.promos t
      union all
      select 'stagiaires ' || md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from public.stagiaires t
      union all
      select 'profils ' || md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from public.user_profiles t
      union all
      select 'affectations ' || md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from public.affectations t
      union all
      select 'signalements ' || md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from public.signalements_app t
      union all
      select 'comptes ' || md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from auth.users t
    ) e(x) $q$;
  v_echeance constant text := 'clos_le + interval ''3 years'' < now()';
  md5_avant text; md5_apres text; md5_qualite_avant text; md5_qualite_apres text;
  L1 integer; L2 integer; P1 integer; P2 integer; P3 integer;
  sA bigint; sB bigint; sC bigint; sD bigint; sE bigint; sF bigint; sG bigint;
  E1 bigint; E2 bigint; E3 bigint; E4 bigint; EA bigint; EB bigint; NEAR bigint; OUV bigint;
  OLD1 bigint; OLD2 bigint; OLD3 bigint; OLD4 bigint; OLD5 bigint; EC bigint; ECL bigint;
  r text; t text; j jsonb; jk jsonb; n bigint; m bigint;
  c record; v_ok integer; v_ko integer; v_detail text;
  j1 jsonb; j2 jsonb; ja jsonb; jb jsonb; j3 jsonb; j5 jsonb; jc jsonb; j52 jsonb; jc2 jsonb; r2 text; r3 text;
begin
  -- 0. Outils de la preuve (schéma temporaire, annulés avec le reste) ------------------------------------------------
  execute $q$
    create table pg_temp.preuve_comptes (nom text primary key, email text not null, uid uuid not null);
    create table pg_temp.preuve_cas (n integer primary key, cas text not null, bon boolean not null, detail text);
    grant select on pg_temp.preuve_comptes to authenticated, anon, service_role;
    grant select, insert on pg_temp.preuve_cas to authenticated, anon, service_role;
    -- Se connecter sous un compte fictif (nul : sans session). Retire l'aperçu.
    create function pg_temp.qui(p_nom text) returns void language plpgsql as $f$
    declare c record;
    begin
      perform set_config('request.headers', '', true);
      if p_nom is null then perform set_config('request.jwt.claims', '', true); return; end if;
      select * into c from pg_temp.preuve_comptes where nom = p_nom;
      perform set_config('request.jwt.claims', json_build_object('email', c.email, 'sub', c.uid)::text, true);
    end $f$;
    -- Aperçu du lot 4 (en-têtes x-apercu-role et x-promo-id, comme l'app les envoie), pour le compte connecté.
    create function pg_temp.apercu(p_role text, p_promo integer default null) returns void language sql as $f$
      select set_config('request.headers', case when p_role is null then '' else
        jsonb_strip_nulls(jsonb_build_object('x-apercu-role', p_role, 'x-promo-id', p_promo::text))::text end, true);
    $f$;
    -- Jouer une requête sous le rôle courant : « ok » ou « code message ». Chaque appel est une sous-transaction.
    create function pg_temp.tente(p_sql text) returns text language plpgsql as $f$
    begin
      execute p_sql;
      return 'ok';
    exception when others then
      return sqlstate || ' ' || sqlerrm;
    end $f$;
    -- Nombre de lignes touchées, ou « code message ».
    create function pg_temp.lignes(p_sql text) returns text language plpgsql as $f$
    declare n bigint;
    begin
      execute p_sql;
      get diagnostics n = row_count;
      return n::text;
    exception when others then
      return sqlstate || ' ' || sqlerrm;
    end $f$;
    -- Première valeur d'une requête, en texte, ou « !code message ».
    create function pg_temp.val(p_sql text) returns text language plpgsql as $f$
    declare v text;
    begin
      execute p_sql into v;
      return v;
    exception when others then
      return '!' || sqlstate || ' ' || sqlerrm;
    end $f$;
    -- Ajouter une entrée (colonnes = clés de l'objet), sous le rôle courant : son numéro, ou « code message ».
    create function pg_temp.ajout(j jsonb) returns text language plpgsql as $f$
    declare cols text; v bigint;
    begin
      select string_agg(quote_ident(k), ', ') into cols from jsonb_object_keys(j) k;
      execute format('insert into public.registre_qualite (%s) select %s from jsonb_populate_record(null::public.registre_qualite, $1) returning id',
                     cols, cols) using j into v;
      return v::text;
    exception when others then
      return sqlstate || ' ' || sqlerrm;
    end $f$;
    -- Modifier une entrée (colonnes = clés de l'objet), sous le rôle courant : lignes touchées, ou « code message ».
    create function pg_temp.modif(p_id bigint, j jsonb) returns text language plpgsql as $f$
    declare sets text; n bigint;
    begin
      select string_agg(format('%I = r.%I', k, k), ', ') into sets from jsonb_object_keys(j) k;
      execute format('update public.registre_qualite t set %s from jsonb_populate_record(null::public.registre_qualite, $1) r where t.id = $2',
                     sets) using j, p_id;
      get diagnostics n = row_count;
      return n::text;
    exception when others then
      return sqlstate || ' ' || sqlerrm;
    end $f$;
    -- Une entrée entière (sous le rôle courant), ou nulle.
    create function pg_temp.ligne(p_id bigint) returns jsonb language plpgsql as $f$
    declare j jsonb;
    begin
      execute 'select to_jsonb(r) from public.registre_qualite r where r.id = $1' using p_id into j;
      return j;
    exception when others then
      return null;
    end $f$;
    -- Préparer une entrée telle quelle, déclencheur muet (superutilisateur) : son numéro, ou nul.
    create function pg_temp.prep(j jsonb) returns bigint language plpgsql as $f$
    declare cols text; v bigint;
    begin
      execute 'set local session_replication_role = replica';
      select string_agg(quote_ident(k), ', ') into cols from jsonb_object_keys(j) k;
      execute format('insert into public.registre_qualite (%s) select %s from jsonb_populate_record(null::public.registre_qualite, $1) returning id',
                     cols, cols) using j into v;
      execute 'set local session_replication_role = origin';
      return v;
    exception when others then
      execute 'set local session_replication_role = origin';
      return null;
    end $f$;
    create function pg_temp.num(p text) returns bigint language sql as $f$
      select case when p ~ '^[0-9]+$' then p::bigint end;
    $f$;
    -- Noter un cas.
    create function pg_temp.cas(p_cas text, p_bon boolean, p_detail text default null) returns void language sql as $f$
      insert into pg_temp.preuve_cas (n, cas, bon, detail)
      select coalesce(max(n), 0) + 1, p_cas, coalesce(p_bon, false), p_detail from pg_temp.preuve_cas;
    $f$;
  $q$;

  -- 1. Données fictives (avant la première empreinte : elles ne bougent plus ensuite, hors sous-transactions annulées) --
  insert into lieux (nom) values ('Lieu preuve 1') returning id into L1;
  insert into lieux (nom) values ('Lieu preuve 2') returning id into L2;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve P1', current_date - 300, current_date + 30) returning id into P1;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L2, 'Preuve P2', current_date - 300, current_date + 60) returning id into P2;
  -- P3 : au lieu 1 quand ses entrées sont écrites, puis passée au lieu 2 (une promo l'a déjà fait en production,
  -- 20261003_multi_promo_montpellier.sql) ; remise au lieu 1 avant le retour.
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve P3', current_date - 1600, current_date - 1200) returning id into P3;
  -- Comptes : T fondateur (sans fiche) ; F formateur de P1 ; S stagiaire de P1 ; DIR direction du lieu 1 ; S2 stagiaire
  -- de P2, qui signale (et purge) ; U stagiaire de P1 dont le compte sera fermé.
  insert into pg_temp.preuve_comptes (nom, email, uid)
  select k, 'preuve.rq.' || lower(k) || '@example.invalid', gen_random_uuid()
    from unnest(array['T', 'F', 'S', 'DIR', 'S2', 'U']) k;
  for c in select * from pg_temp.preuve_comptes loop
    if c.nom in ('S', 'S2', 'U') then
      insert into stagiaires (prenom, nom, promo_id) values (c.nom, 'Preuve', case when c.nom = 'S2' then P2 else P1 end)
      returning id into v_ok;
      insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id) values (c.email, 'stagiaire', false, false, v_ok);
    elsif c.nom = 'T' then
      insert into user_profiles (email, role, is_admin, is_founder) values (c.email, 'admin', true, true);
    else
      insert into user_profiles (email, role, is_admin, is_founder) values (c.email, 'prof', c.nom = 'F', false);
    end if;
  end loop;
  insert into auth.users (id, email) select uid, email from pg_temp.preuve_comptes;
  insert into affectations (email, role, promo_id, lieu_id)
  select k.email, v.role, v.promo, v.lieu
    from (values ('F', 'formateur', P1, null::integer), ('DIR', 'direction', null, L1)) v(nom, role, promo, lieu)
    join pg_temp.preuve_comptes k on k.nom = v.nom;
  -- Signalements : sA (S, 13 mois) et sD (S, 13 mois) partiront à la prochaine purge ; sB (U, récent) partira avec le
  -- compte de U ; sC et sE (S, récents) restent.
  insert into signalements_app (user_id, email, nom, role, promo_id, message, created_at)
  select k.uid, k.email, 'S. Preuve', 'stagiaire', P1, 'Signalement A ancien', now() - interval '13 months'
    from pg_temp.preuve_comptes k where k.nom = 'S' returning id into sA;
  insert into signalements_app (user_id, email, nom, role, promo_id, message)
  select k.uid, k.email, 'U. Preuve', 'stagiaire', P1, 'Signalement B de U'
    from pg_temp.preuve_comptes k where k.nom = 'U' returning id into sB;
  insert into signalements_app (user_id, email, nom, role, promo_id, message)
  select k.uid, k.email, 'S. Preuve', 'stagiaire', P1, 'Signalement C récent'
    from pg_temp.preuve_comptes k where k.nom = 'S' returning id into sC;
  insert into signalements_app (user_id, email, nom, role, promo_id, message, created_at)
  select k.uid, k.email, 'S. Preuve', 'stagiaire', P1, 'Signalement D ancien', now() - interval '13 months'
    from pg_temp.preuve_comptes k where k.nom = 'S' returning id into sD;
  insert into signalements_app (user_id, email, nom, role, promo_id, message)
  select k.uid, k.email, 'S. Preuve', 'stagiaire', P1, 'Signalement E récent'
    from pg_temp.preuve_comptes k where k.nom = 'S' returning id into sE;
  -- sF et sG (S, 13 mois) : liés aux entrées de P3, ils partiront aussi à la purge.
  insert into signalements_app (user_id, email, nom, role, promo_id, message, created_at)
  select k.uid, k.email, 'S. Preuve', 'stagiaire', P1, 'Signalement F ancien', now() - interval '13 months'
    from pg_temp.preuve_comptes k where k.nom = 'S' returning id into sF;
  insert into signalements_app (user_id, email, nom, role, promo_id, message, created_at)
  select k.uid, k.email, 'S. Preuve', 'stagiaire', P1, 'Signalement G ancien', now() - interval '13 months'
    from pg_temp.preuve_comptes k where k.nom = 'S' returning id into sG;

  -- 2. Migration jouée entre deux empreintes --------------------------------------------------------------------
  select md5(pg_get_functiondef('public.peut_gerer_qualite()'::regprocedure)) into md5_qualite_avant;
  if not v_deja then
    execute v_empreinte into md5_avant;
    if btrim(coalesce(current_setting('preuve.migration', true), ''), E' \t\r\n') <> '' then
      execute current_setting('preuve.migration');
    end if;
  end if;
  select md5(pg_get_functiondef('public.peut_gerer_qualite()'::regprocedure)) into md5_qualite_apres;
  perform pg_temp.cas('peut_gerer_qualite() existe et n''est pas touchée par la migration',
    md5_qualite_avant = md5_qualite_apres, md5_qualite_avant || ' / ' || md5_qualite_apres);

  -- 3. Catalogue -----------------------------------------------------------------------------------------------------
  select string_agg(attname, ',' order by attname) into t from pg_attribute
   where attrelid = to_regclass('public.registre_qualite') and attnum > 0 and not attisdropped;
  perform pg_temp.cas('colonnes du registre',
    t = 'action_decidee,clos_le,cree_le,date_constat,date_reponse,description,efface_le,etat,id,issu_signalement,'
        || 'lieu_id,mesure_prevention,modifie_le,origine,promo_id,reponse,signalement_id,type', t);
  select count(*) into n from pg_class where oid = to_regclass('public.registre_qualite') and relrowsecurity;
  perform pg_temp.cas('sécurité par ligne active', n = 1, n::text);
  select string_agg(cmd, ',' order by cmd),
         bool_and(roles = '{authenticated}'
                  and coalesce(qual, with_check) like '%peut_gerer_qualite()%'
                  and (with_check is null or with_check like '%peut_gerer_qualite()%'))::text
    into t, r from pg_policies where schemaname = 'public' and tablename = 'registre_qualite';
  perform pg_temp.cas('trois règles (lecture, ajout, modification), toutes sous peut_gerer_qualite(), aucune de suppression',
    t = 'INSERT,SELECT,UPDATE' and r = 'true', t || ' / ' || r);
  select string_agg(a.privilege_type, ',' order by a.privilege_type) into t
    from pg_class cl, aclexplode(cl.relacl) a
   where cl.oid = to_regclass('public.registre_qualite') and a.grantee = 'authenticated'::regrole;
  perform pg_temp.cas('authenticated : lecture, ajout, modification, rien d''autre', t = 'INSERT,SELECT,UPDATE', t);
  select count(*) into n from pg_class cl, aclexplode(cl.relacl) a
   where cl.oid = to_regclass('public.registre_qualite') and a.grantee in (0, 'anon'::regrole);
  select count(*) into m
    from (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) pr(priv)
   where to_regclass('public.registre_qualite') is not null and has_table_privilege('anon', 'public.registre_qualite', pr.priv);
  perform pg_temp.cas('anon et public : aucun droit sur la table',
    to_regclass('public.registre_qualite') is not null and n = 0 and m = 0, n || '/' || m);
  select count(*) into n from pg_depend dp join pg_class s on s.oid = dp.objid and s.relkind = 'S',
         aclexplode(s.relacl) a
   where dp.refobjid = to_regclass('public.registre_qualite') and a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole);
  select count(*) into m from pg_depend dp join pg_class s on s.oid = dp.objid and s.relkind = 'S'
   where dp.refobjid = to_regclass('public.registre_qualite');
  perform pg_temp.cas('séquence de l''identifiant fermée à public, anon et authenticated', m = 1 and n = 0, m || '/' || n);
  select count(*) into n from pg_proc p
   where p.oid = to_regprocedure('public.effacer_registre_qualite()') and p.prosecdef
     and p.prorettype = 'integer'::regtype
     and has_function_privilege('authenticated', p.oid, 'execute')
     and not has_function_privilege('anon', p.oid, 'execute')
     and not exists (select 1 from aclexplode(p.proacl) a where a.grantee in (0, 'anon'::regrole));
  perform pg_temp.cas('effacer_registre_qualite() : security definer, entier, authenticated seul (ni public ni anon)', n = 1, n::text);
  select count(*) into n from pg_proc p
   where p.oid = to_regprocedure('public._registre_qualite_avant()') and p.prosecdef
     and not has_function_privilege('authenticated', p.oid, 'execute')
     and not has_function_privilege('anon', p.oid, 'execute');
  perform pg_temp.cas('déclencheur : fonction security definer, aucun droit d''appel pour anon et authenticated', n = 1, n::text);
  select string_agg(pg_get_triggerdef(t2.oid), ' | ') into t from pg_trigger t2
   where t2.tgrelid = to_regclass('public.registre_qualite') and not t2.tgisinternal;
  perform pg_temp.cas('un seul déclencheur, avant ajout et modification, ligne par ligne',
    t like '%BEFORE INSERT OR UPDATE ON public.registre_qualite FOR EACH ROW EXECUTE FUNCTION %_registre_qualite_avant()'
    and t not like '%|%', t);
  select string_agg(confrelid::regclass::text || ':' || confdeltype::text, ',' order by confrelid::regclass::text) into t
    from pg_constraint where conrelid = to_regclass('public.registre_qualite') and contype = 'f';
  perform pg_temp.cas('clés étrangères : lieu et promo en restrict, signalement en set null',
    t = 'lieux:r,promos:r,signalements_app:n', t);
  select count(*) into n from pg_constraint
   where conrelid = to_regclass('public.registre_qualite') and contype = 'u'
     and conkey = array[(select attnum from pg_attribute where attrelid = to_regclass('public.registre_qualite')
                          and attname = 'signalement_id')];
  perform pg_temp.cas('un signalement ne va qu''à une entrée (unique)', n = 1, n::text);
  select count(*) into n from pg_proc p
   where p.oid in (to_regprocedure('public.effacer_registre_qualite()'), to_regprocedure('public._registre_qualite_avant()'))
     and position(v_echeance in pg_get_functiondef(p.oid)) > 0;
  perform pg_temp.cas('une seule échéance, écrite à l''identique dans la fonction et le déclencheur : ' || v_echeance,
    n = 2, n::text);

  -- 4. Entrées préparées, déclencheur muet : liées à un signalement, avec des dates passées ---------------------------
  EA := pg_temp.prep(jsonb_build_object('type', 'difficulte', 'origine', 'stagiaire', 'promo_id', P1, 'lieu_id', L1,
    'date_constat', current_date - 20, 'description', 'Planning illisible sur téléphone', 'etat', 'en_cours',
    'signalement_id', sA, 'issu_signalement', true, 'cree_le', now() - interval '20 days', 'modifie_le', now() - interval '10 days'));
  EB := pg_temp.prep(jsonb_build_object('type', 'difficulte', 'origine', 'stagiaire', 'promo_id', P1, 'lieu_id', L1,
    'date_constat', current_date - 5, 'description', 'Connexion refusée', 'etat', 'ouvert',
    'signalement_id', sB, 'issu_signalement', true, 'cree_le', now() - interval '5 days', 'modifie_le', now() - interval '5 days'));
  -- NEAR : close il y a 3 ans moins un jour (pas encore effaçable) ; OUV : ouverte, constat de 4 ans (jamais effacée).
  NEAR := pg_temp.prep(jsonb_build_object('type', 'amelioration', 'origine', 'equipe',
    'date_constat', current_date - 1200, 'description', 'Affichage des salles', 'reponse', 'Panneau posé',
    'date_reponse', current_date - 1190, 'etat', 'clos', 'clos_le', now() - interval '3 years' + interval '1 day',
    'cree_le', now() - interval '1200 days', 'modifie_le', now() - interval '1100 days'));
  OUV := pg_temp.prep(jsonb_build_object('type', 'difficulte', 'origine', 'entreprise', 'lieu_id', L2,
    'date_constat', current_date - 1500, 'description', 'Retard de convention', 'etat', 'ouvert',
    'cree_le', now() - interval '1500 days', 'modifie_le', now() - interval '1500 days'));
  perform pg_temp.cas('quatre entrées préparées (déclencheur muet)',
    EA is not null and EB is not null and NEAR is not null and OUV is not null, concat_ws(',', EA, EB, NEAR, OUV));

  -- 5. Le fondateur lit, ajoute, modifie -----------------------------------------------------------------------------
  set local role authenticated;
  perform pg_temp.qui('T');
  r := pg_temp.ajout(jsonb_build_object('type', 'reclamation', 'origine', 'stagiaire', 'promo_id', P1,
    'date_constat', current_date - 3, 'description', 'Salle trop froide en décembre'));
  E1 := pg_temp.num(r);
  perform pg_temp.cas('le fondateur ajoute une entrée', E1 is not null, r);
  r := pg_temp.val('select count(*) from public.registre_qualite');
  perform pg_temp.cas('le fondateur lit toutes les entrées', r = '5', r);
  r := pg_temp.modif(E1, jsonb_build_object('reponse', 'Chauffage réglé', 'date_reponse', current_date - 1,
    'action_decidee', 'Contrôle hebdomadaire', 'etat', 'en_cours'));
  perform pg_temp.cas('le fondateur modifie une entrée', r = '1', r);
  j1 := pg_temp.ligne(E1);
  perform pg_temp.cas('entrée ajoutée : état ouvert par défaut puis en cours, lieu posé d''après la promo, non issue d''un signalement',
    j1 ->> 'etat' = 'en_cours' and (j1 ->> 'lieu_id')::int = L1 and (j1 ->> 'issu_signalement')::boolean = false
    and j1 ->> 'reponse' = 'Chauffage réglé', j1::text);

  -- 6. Les autres ne lisent rien, n'ajoutent rien, ne modifient rien ; personne ne supprime --------------------------
  for c in select * from (values ('F', null, 'le formateur'), ('S', null, 'le stagiaire'), ('DIR', null, 'la direction'),
                                 ('T', 'formateur', 'le fondateur en aperçu formateur'),
                                 ('T', 'stagiaire', 'le fondateur en aperçu stagiaire'),
                                 ('T', 'direction', 'le fondateur en aperçu direction'),
                                 ('T', 'siege', 'le fondateur en aperçu siège')) v(nom, apercu, libelle) loop
    perform pg_temp.qui(c.nom);
    if c.apercu is not null then perform pg_temp.apercu(c.apercu, P1); end if;
    r := pg_temp.val('select count(*) from public.registre_qualite');
    perform pg_temp.cas(c.libelle || ' ne lit aucune entrée', r = '0', r);
    r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
      'description', 'Ajout interdit'));
    perform pg_temp.cas(c.libelle || ' n''ajoute rien', r like '42501%', r);
    r := pg_temp.modif(E1, jsonb_build_object('description', 'Modification interdite'));
    perform pg_temp.cas(c.libelle || ' : sa modification touche 0 ligne', r = '0', r);
    r := pg_temp.lignes('delete from public.registre_qualite');
    perform pg_temp.cas(c.libelle || ' : suppression refusée', r like '42501%', r);
    r := pg_temp.val('select public.effacer_registre_qualite()::text');
    perform pg_temp.cas(c.libelle || ' : effacement refusé', r like '!P0001 registre: %', r);
  end loop;
  perform pg_temp.qui('T');
  r := pg_temp.lignes(format('delete from public.registre_qualite where id = %s', E1));
  perform pg_temp.cas('suppression refusée au fondateur', r like '42501%', r);
  reset role;
  set local role anon;
  perform pg_temp.qui(null);
  r := pg_temp.val('select count(*) from public.registre_qualite');
  perform pg_temp.cas('anon : lecture refusée', r like '!42501%', r);
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date, 'description', 'Anon'));
  perform pg_temp.cas('anon : ajout refusé', r like '42501%', r);
  r := pg_temp.lignes('delete from public.registre_qualite');
  perform pg_temp.cas('anon : suppression refusée', r like '42501%', r);
  r := pg_temp.val('select public.effacer_registre_qualite()::text');
  perform pg_temp.cas('anon : effacement refusé', r like '!42501%', r);
  reset role;
  n := pg_temp.num(pg_temp.val('select count(*) from public.registre_qualite'));
  r := (pg_temp.ligne(E1)) ->> 'description';
  perform pg_temp.cas('aucun refus n''a rien écrit ni rien retiré', n = 5 and r = 'Salle trop froide en décembre', n || ' / ' || r);

  -- 7. Contraintes et déclencheur, sous le fondateur ------------------------------------------------------------------
  set local role authenticated;
  perform pg_temp.qui('T');
  for c in select * from (values
      ('type inconnu', '{"type": "plainte", "origine": "stagiaire", "description": "Texte valable"}'::jsonb),
      ('origine inconnue', '{"type": "alea", "origine": "parent", "description": "Texte valable"}'),
      ('mesure de prévention hors risque', '{"type": "alea", "origine": "equipe", "description": "Texte valable", "mesure_prevention": "Mesure"}'),
      ('risque clos sans mesure', '{"type": "risque", "origine": "equipe", "description": "Texte valable", "etat": "clos"}'),
      ('date de réponse avant le constat', '{"type": "alea", "origine": "equipe", "description": "Texte valable", "reponse": "Faite", "date_reponse": "2000-01-01"}'),
      ('date de réponse sans réponse', '{"type": "alea", "origine": "equipe", "description": "Texte valable", "date_reponse": "2099-01-01"}'),
      ('description de 2 caractères', '{"type": "alea", "origine": "equipe", "description": "ab"}'),
      ('description absente', '{"type": "alea", "origine": "equipe"}'),
      ('réponse vide', '{"type": "alea", "origine": "equipe", "description": "Texte valable", "reponse": ""}'),
      ('état inconnu', '{"type": "alea", "origine": "equipe", "description": "Texte valable", "etat": "fini"}')) v(libelle, champs) loop
    r := pg_temp.ajout(c.champs || jsonb_build_object('date_constat', current_date - 2));
    perform pg_temp.cas(c.libelle || ' : refusé', r like '23514%', r);
  end loop;
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', repeat('é', 2001)));
  perform pg_temp.cas('description de 2 001 caractères : refusée', r like '23514%', r);
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', repeat('é', 2000), 'action_decidee', repeat('a', 2001)));
  perform pg_temp.cas('action décidée de 2 001 caractères : refusée', r like '23514%', r);
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', repeat('é', 2000), 'reponse', repeat('r', 2000), 'date_reponse', current_date));
  perform pg_temp.cas('textes de 2 000 caractères et réponse datée du jour du constat : acceptés', pg_temp.num(r) is not null, r);
  r := pg_temp.ajout(jsonb_build_object('type', 'risque', 'origine', 'equipe', 'date_constat', current_date - 2,
    'description', 'Risque de panne du simulateur', 'etat', 'clos', 'mesure_prevention', 'Contrat de maintenance'));
  ECL := pg_temp.num(r);
  perform pg_temp.cas('risque clos avec sa mesure : accepté', ECL is not null, r);
  j := pg_temp.ligne(ECL);
  perform pg_temp.cas('ajout déjà clos : clos_le posé à l''instant', (j ->> 'clos_le')::timestamptz = now(), j ->> 'clos_le');
  r := pg_temp.modif(ECL, '{"mesure_prevention": null}');
  perform pg_temp.cas('risque clos : mesure retirée refusée', r like '23514%', r);

  -- cree_le, clos_le, efface_le fournis : ignorés ou refusés
  r := pg_temp.ajout(jsonb_build_object('type', 'amelioration', 'origine', 'formateur', 'date_constat', current_date,
    'description', 'Nouvelle fiche d''accueil', 'cree_le', '2000-01-01T00:00:00Z', 'modifie_le', '2000-01-01T00:00:00Z',
    'clos_le', '2000-01-01T00:00:00Z', 'issu_signalement', true));
  E4 := pg_temp.num(r);
  j := pg_temp.ligne(E4);
  perform pg_temp.cas('cree_le, modifie_le et clos_le fournis ignorés ; issu_signalement fourni sans lien ignoré',
    (j ->> 'cree_le')::timestamptz = now() and (j ->> 'modifie_le')::timestamptz = now() and j ->> 'clos_le' is null
    and (j ->> 'issu_signalement')::boolean = false, coalesce(j::text, r));
  r := pg_temp.ajout(jsonb_build_object('type', 'amelioration', 'origine', 'formateur', 'date_constat', current_date,
    'description', 'Effacée dès l''ajout', 'efface_le', '2000-01-01T00:00:00Z'));
  perform pg_temp.cas('ajout déjà effacé : refusé', r like 'P0001 registre: %', r);
  r := pg_temp.modif(E4, jsonb_build_object('cree_le', '2000-01-01T00:00:00Z'));
  j := pg_temp.ligne(E4);
  perform pg_temp.cas('cree_le modifié : ignoré', r = '1' and (j ->> 'cree_le')::timestamptz = now(), r || ' ' || (j ->> 'cree_le'));

  -- Clôture : posée au passage à clos, gardée tant que l'entrée reste close, remise à nul à la réouverture
  r := pg_temp.modif(E1, '{"etat": "clos"}');
  j := pg_temp.ligne(E1);
  perform pg_temp.cas('passage à clos : clos_le posé', r = '1' and (j ->> 'clos_le')::timestamptz = now(), r || ' ' || (j ->> 'clos_le'));
  r := pg_temp.modif(E1, '{"etat": "en_cours"}');
  j := pg_temp.ligne(E1);
  perform pg_temp.cas('réouverture : clos_le remis à nul', r = '1' and j ->> 'clos_le' is null, r || ' ' || coalesce(j ->> 'clos_le', 'nul'));
  reset role;
  j := pg_temp.ligne(NEAR);
  set local role authenticated;
  perform pg_temp.qui('T');
  r := pg_temp.modif(NEAR, jsonb_build_object('action_decidee', 'Signalétique revue', 'clos_le', now()));
  jk := pg_temp.ligne(NEAR);
  perform pg_temp.cas('entrée qui reste close : clos_le gardé (celui fourni ignoré), modifie_le posé',
    r = '1' and jk ->> 'clos_le' = j ->> 'clos_le' and (jk ->> 'modifie_le')::timestamptz = now(),
    r || ' ' || (j ->> 'clos_le') || ' / ' || (jk ->> 'clos_le'));

  -- Lieu : posé d'après la promo ; un lieu contraire est refusé ; sans promo, le lieu donné ou l'organisme entier
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', 'Lieu contraire', 'promo_id', P1, 'lieu_id', L2));
  perform pg_temp.cas('lieu contraire à la promo : refusé', r like 'P0001 registre: %', r);
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', 'Lieu concordant', 'promo_id', P1, 'lieu_id', L1));
  perform pg_temp.cas('lieu concordant avec la promo : accepté', pg_temp.num(r) is not null, r);
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', 'Sans promo, lieu 2', 'lieu_id', L2));
  j := pg_temp.ligne(pg_temp.num(r));
  perform pg_temp.cas('sans promo : le lieu donné est gardé', (j ->> 'lieu_id')::int = L2, coalesce(j::text, r));
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', 'Tout l''organisme'));
  j := pg_temp.ligne(pg_temp.num(r));
  perform pg_temp.cas('ni promo ni lieu : l''organisme entier', j is not null and j ->> 'lieu_id' is null, coalesce(j::text, r));
  r := pg_temp.modif(E1, jsonb_build_object('promo_id', P2));
  j := pg_temp.ligne(E1);
  perform pg_temp.cas('promo changée sans toucher au lieu : le lieu suit la promo', r = '1' and (j ->> 'lieu_id')::int = L2,
    r || ' ' || (j ->> 'lieu_id'));
  r := pg_temp.modif(E1, jsonb_build_object('lieu_id', L1));
  perform pg_temp.cas('lieu changé contre la promo : refusé', r like 'P0001 registre: %', r);
  r := pg_temp.modif(E1, jsonb_build_object('promo_id', P1));
  j := pg_temp.ligne(E1);
  perform pg_temp.cas('retour à la promo 1 : lieu 1', r = '1' and (j ->> 'lieu_id')::int = L1, r);

  -- Signalement : marque issu_signalement posée à la création, figée ; lien unique ; seule sa mise à nul passe
  r := pg_temp.ajout(jsonb_build_object('type', 'difficulte', 'origine', 'stagiaire', 'promo_id', P1,
    'date_constat', current_date, 'description', 'Signalement C au registre', 'signalement_id', sC, 'issu_signalement', false));
  E2 := pg_temp.num(r);
  j := pg_temp.ligne(E2);
  perform pg_temp.cas('entrée tirée d''un signalement : issu_signalement vrai (valeur fournie ignorée)',
    (j ->> 'issu_signalement')::boolean and (j ->> 'signalement_id')::bigint = sC, coalesce(j::text, r));
  r := pg_temp.ajout(jsonb_build_object('type', 'difficulte', 'origine', 'stagiaire', 'promo_id', P1,
    'date_constat', current_date, 'description', 'Signalement C une seconde fois', 'signalement_id', sC));
  perform pg_temp.cas('même signalement deux fois : refusé (23505)', r like '23505%', r);
  r := pg_temp.modif(E2, jsonb_build_object('signalement_id', sE));
  perform pg_temp.cas('lien changé vers un autre signalement : refusé', r like 'P0001 registre: %', r);
  r := pg_temp.modif(E4, jsonb_build_object('signalement_id', sE));
  perform pg_temp.cas('lien ajouté après la création : refusé', r like 'P0001 registre: %', r);
  r := pg_temp.modif(E2, '{"issu_signalement": false}');
  j := pg_temp.ligne(E2);
  perform pg_temp.cas('issu_signalement figé (vrai reste vrai)', r = '1' and (j ->> 'issu_signalement')::boolean, r);
  r := pg_temp.modif(E4, '{"issu_signalement": true}');
  j := pg_temp.ligne(E4);
  perform pg_temp.cas('issu_signalement figé (faux reste faux)', r = '1' and not (j ->> 'issu_signalement')::boolean, r);
  r := pg_temp.modif(E2, '{"signalement_id": null}');
  j := pg_temp.ligne(E2);
  perform pg_temp.cas('lien mis à nul par le fondateur : accepté, issu_signalement reste vrai',
    r = '1' and j ->> 'signalement_id' is null and (j ->> 'issu_signalement')::boolean, r);

  -- 8. Effacement avant l'échéance : rien n'est effacé, l'écriture directe est refusée ------------------------------
  r := pg_temp.val('select public.effacer_registre_qualite()::text');
  perform pg_temp.cas('effacement avant toute échéance : 0 entrée', r = '0', r);
  r := pg_temp.modif(NEAR, jsonb_build_object('description', null, 'reponse', null, 'action_decidee', null,
    'mesure_prevention', null, 'efface_le', now()));
  perform pg_temp.cas('écriture directe de l''effacement avant l''échéance (3 ans moins un jour) : refusée', r like 'P0001 registre: %', r);
  r := pg_temp.modif(ECL, jsonb_build_object('description', null, 'reponse', null, 'action_decidee', null,
    'mesure_prevention', null, 'efface_le', now()));
  perform pg_temp.cas('écriture directe de l''effacement d''une entrée close à l''instant : refusée', r like 'P0001 registre: %', r);
  reset role;
  j := pg_temp.ligne(NEAR);
  perform pg_temp.cas('entrée à 3 ans moins un jour : intacte', j ->> 'description' = 'Affichage des salles' and j ->> 'efface_le' is null,
    j::text);

  -- 9. Effacement après l'échéance -----------------------------------------------------------------------------------
  -- OLD1 : avec réponse datée et action ; OLD2 : risque avec sa mesure ; OLD3 : lié à sD (13 mois) ; OLD4 : effacé à la
  -- main (écriture directe). Toutes closes il y a plus de 3 ans.
  OLD1 := pg_temp.prep(jsonb_build_object('type', 'reclamation', 'origine', 'financeur', 'promo_id', P2, 'lieu_id', L2,
    'date_constat', current_date - 1500, 'description', 'Facture contestée', 'reponse', 'Avoir émis',
    'date_reponse', current_date - 1490, 'action_decidee', 'Relecture des devis', 'etat', 'clos',
    'clos_le', now() - interval '3 years' - interval '1 day',
    'cree_le', now() - interval '1500 days', 'modifie_le', now() - interval '1400 days'));
  OLD2 := pg_temp.prep(jsonb_build_object('type', 'risque', 'origine', 'equipe',
    'date_constat', current_date - 1600, 'description', 'Risque d''inondation de la salle', 'mesure_prevention', 'Pompe installée',
    'etat', 'clos', 'clos_le', now() - interval '3 years' - interval '2 days',
    'cree_le', now() - interval '1600 days', 'modifie_le', now() - interval '1500 days'));
  OLD3 := pg_temp.prep(jsonb_build_object('type', 'alea', 'origine', 'stagiaire', 'promo_id', P1, 'lieu_id', L1,
    'date_constat', current_date - 1300, 'description', 'Coupure de courant', 'etat', 'clos',
    'clos_le', now() - interval '3 years' - interval '1 day', 'signalement_id', sD, 'issu_signalement', true,
    'cree_le', now() - interval '1300 days', 'modifie_le', now() - interval '1200 days'));
  OLD4 := pg_temp.prep(jsonb_build_object('type', 'difficulte', 'origine', 'autre',
    'date_constat', current_date - 1400, 'description', 'Clé perdue', 'reponse', 'Serrure changée',
    'date_reponse', current_date - 1399, 'etat', 'clos', 'clos_le', now() - interval '3 years' - interval '5 days',
    'cree_le', now() - interval '1400 days', 'modifie_le', now() - interval '1300 days'));
  -- OLD5 (close il y a plus de 3 ans, avec réponse datée, liée à sF) et EC (en cours, liée à sG) : écrites quand P3 était
  -- au lieu 1 ; P3 passe ensuite au lieu 2.
  OLD5 := pg_temp.prep(jsonb_build_object('type', 'reclamation', 'origine', 'stagiaire', 'promo_id', P3, 'lieu_id', L1,
    'date_constat', current_date - 1250, 'description', 'Remboursement demandé', 'reponse', 'Remboursé',
    'date_reponse', current_date - 1240, 'etat', 'clos', 'clos_le', now() - interval '3 years' - interval '1 day',
    'signalement_id', sF, 'issu_signalement', true,
    'cree_le', now() - interval '1250 days', 'modifie_le', now() - interval '1150 days'));
  EC := pg_temp.prep(jsonb_build_object('type', 'difficulte', 'origine', 'formateur', 'promo_id', P3, 'lieu_id', L1,
    'date_constat', current_date - 400, 'description', 'Salle partagée', 'etat', 'en_cours',
    'signalement_id', sG, 'issu_signalement', true,
    'cree_le', now() - interval '400 days', 'modifie_le', now() - interval '390 days'));
  perform pg_temp.cas('six entrées préparées, dont cinq closes il y a plus de 3 ans et deux de la promo P3',
    OLD1 is not null and OLD2 is not null and OLD3 is not null and OLD4 is not null and OLD5 is not null and EC is not null,
    concat_ws(',', OLD1, OLD2, OLD3, OLD4, OLD5, EC));
  update promos set lieu_id = L2 where id = P3;
  j1 := pg_temp.ligne(OLD1); j2 := pg_temp.ligne(OLD2); j3 := pg_temp.ligne(OLD3); j5 := pg_temp.ligne(OLD5);
  set local role authenticated;
  perform pg_temp.qui('T');
  r := pg_temp.modif(OLD4, jsonb_build_object('description', null, 'efface_le', now()));
  perform pg_temp.cas('effacement direct qui garde un texte (la réponse) : refusé', r like 'P0001 registre: %', r);
  r := pg_temp.modif(OLD4, jsonb_build_object('description', null, 'reponse', null, 'efface_le', now(), 'type', 'alea'));
  perform pg_temp.cas('effacement direct qui change aussi le type : refusé', r like 'P0001 registre: %', r);
  r := pg_temp.modif(OLD4, jsonb_build_object('description', null, 'reponse', null, 'efface_le', '2000-01-01T00:00:00Z'));
  j := pg_temp.ligne(OLD4);
  perform pg_temp.cas('effacement direct après l''échéance, quatre textes à nul : accepté, efface_le posé à l''instant',
    r = '1' and (j ->> 'efface_le')::timestamptz = now() and j ->> 'description' is null and j ->> 'reponse' is null
    and j ->> 'date_reponse' = (current_date - 1399)::text, r || ' ' || coalesce(j::text, ''));
  r := pg_temp.val('select public.effacer_registre_qualite()::text');
  perform pg_temp.cas('effacement : les quatre entrées dues sont vidées (dont celle de la promo passée au lieu 2)', r = '4', r);
  jk := pg_temp.ligne(OLD1);
  perform pg_temp.cas('entrée avec réponse datée effacée : textes nuls',
    jk is not null and jk ->> 'description' is null and jk ->> 'reponse' is null and jk ->> 'action_decidee' is null
    and jk ->> 'mesure_prevention' is null and jk ->> 'efface_le' is not null,
    coalesce(jk::text, 'nul'));
  perform pg_temp.cas('entrée avec réponse datée effacée : type, origine, promo, lieu, dates (date de réponse comprise), état et clos_le gardés',
    (jk - array['description', 'reponse', 'action_decidee', 'mesure_prevention', 'efface_le', 'modifie_le'])
      = (j1 - array['description', 'reponse', 'action_decidee', 'mesure_prevention', 'efface_le', 'modifie_le'])
    and jk ->> 'date_reponse' = (current_date - 1490)::text and jk ->> 'etat' = 'clos',
    coalesce(jk::text, 'nul'));
  perform pg_temp.cas('entrée effacée : efface_le et modifie_le à l''instant',
    (jk ->> 'efface_le')::timestamptz = now() and (jk ->> 'modifie_le')::timestamptz = now(), jk ->> 'efface_le');
  jk := pg_temp.ligne(OLD2);
  perform pg_temp.cas('risque clos effacé : mesure vidée, type et état gardés',
    jk ->> 'mesure_prevention' is null and jk ->> 'description' is null and jk ->> 'type' = 'risque' and jk ->> 'etat' = 'clos'
    and jk ->> 'efface_le' is not null, coalesce(jk::text, 'nul'));
  jk := pg_temp.ligne(OLD3);
  perform pg_temp.cas('entrée liée effacée : le lien et la marque restent',
    (jk ->> 'signalement_id')::bigint = sD and (jk ->> 'issu_signalement')::boolean and jk ->> 'efface_le' is not null,
    coalesce(jk::text, 'nul'));
  jk := pg_temp.ligne(OLD5);
  perform pg_temp.cas('promo passée dans un autre centre : l''entrée close il y a plus de 3 ans est effacée, lieu 1 gardé, rien d''autre',
    jk ->> 'efface_le' is not null and jk ->> 'description' is null and jk ->> 'reponse' is null
    and (jk ->> 'lieu_id')::int = L1 and (jk ->> 'promo_id')::int = P3 and jk ->> 'date_reponse' = (current_date - 1240)::text
    and (jk - array['description', 'reponse', 'action_decidee', 'mesure_prevention', 'efface_le', 'modifie_le'])
      = (j5 - array['description', 'reponse', 'action_decidee', 'mesure_prevention', 'efface_le', 'modifie_le']),
    coalesce(jk::text, 'nul'));
  r := pg_temp.val('select public.effacer_registre_qualite()::text');
  perform pg_temp.cas('second effacement : 0 entrée', r = '0', r);
  r := pg_temp.modif(EC, '{"action_decidee": "Planning des salles revu"}');
  jk := pg_temp.ligne(EC);
  perform pg_temp.cas('promo passée dans un autre centre : modification sans toucher promo ni lieu acceptée, lieu 1 gardé',
    r = '1' and (jk ->> 'lieu_id')::int = L1 and jk ->> 'action_decidee' = 'Planning des salles revu', r || ' ' || coalesce(jk::text, ''));
  reset role;
  j := pg_temp.ligne(NEAR);
  jk := pg_temp.ligne(OUV);
  perform pg_temp.cas('après l''effacement : l''entrée à 3 ans moins un jour et l''entrée ouverte de 4 ans sont intactes',
    j ->> 'efface_le' is null and j ->> 'description' is not null and jk ->> 'efface_le' is null
    and jk ->> 'description' = 'Retard de convention', j::text || ' / ' || jk::text);
  set local role authenticated;
  perform pg_temp.qui('T');
  foreach t in array array['{"etat": "ouvert"}', '{"description": "Texte revenu"}', '{"efface_le": null}',
                           '{"type": "alea"}', '{"date_reponse": null}'] loop
    r := pg_temp.modif(OLD1, t::jsonb);
    perform pg_temp.cas('entrée effacée non modifiable : ' || t, r like 'P0001 registre: %', r);
  end loop;
  reset role;
  jk := pg_temp.ligne(OLD1);
  perform pg_temp.cas('entrée effacée inchangée après les refus', jk ->> 'etat' = 'clos' and jk ->> 'description' is null
    and jk ->> 'date_reponse' is not null, coalesce(jk::text, 'nul'));

  -- 10. Purge à 12 mois par un stagiaire qui signale (sous-transaction annulée) -------------------------------------
  ja := pg_temp.ligne(EA);
  j3 := pg_temp.ligne(OLD3);
  j5 := pg_temp.ligne(OLD5);
  jc := pg_temp.ligne(EC);
  begin
    set local role authenticated;
    perform pg_temp.qui('S2');
    r := pg_temp.val('select public.signaler_probleme(''Le planning ne charge pas'')::text');
    reset role;
    j := pg_temp.ligne(EA);
    jk := pg_temp.ligne(OLD3);
    j52 := pg_temp.ligne(OLD5);
    jc2 := pg_temp.ligne(EC);
    select count(*) into n from signalements_app where id in (sA, sD, sF, sG);
    raise exception 'preuve: annulé';
  exception when others then
    if sqlerrm <> 'preuve: annulé' then raise; end if;
  end;
  perform pg_temp.cas('purge : le stagiaire signale, les signalements de 13 mois partent',
    pg_temp.num(r) is not null and n = 0, r || ' / ' || n);
  perform pg_temp.cas('purge : lien de l''entrée à nul, issu_signalement vrai',
    j ->> 'signalement_id' is null and (j ->> 'issu_signalement')::boolean, coalesce(j::text, 'nul'));
  perform pg_temp.cas('purge : entrée intacte (modifie_le compris)',
    (j - 'signalement_id') = (ja - 'signalement_id'), coalesce(j::text, 'nul') || ' / ' || ja::text);
  perform pg_temp.cas('purge : entrée effacée, lien mis à nul quand même, rien d''autre',
    jk ->> 'signalement_id' is null and (jk - 'signalement_id') = (j3 - 'signalement_id') and jk ->> 'efface_le' is not null,
    coalesce(jk::text, 'nul'));
  perform pg_temp.cas('purge, promo passée dans un autre centre, entrée effacée : lien à nul, lieu 1 gardé, rien d''autre',
    j52 ->> 'signalement_id' is null and (j52 ->> 'lieu_id')::int = L1 and j52 ->> 'efface_le' is not null
    and (j52 - 'signalement_id') = (j5 - 'signalement_id'), coalesce(j52::text, 'nul'));
  perform pg_temp.cas('purge, promo passée dans un autre centre, entrée en cours : lien à nul, lieu 1 gardé, rien d''autre',
    jc2 ->> 'signalement_id' is null and (jc2 ->> 'lieu_id')::int = L1 and (jc2 ->> 'issu_signalement')::boolean
    and (jc2 - 'signalement_id') = (jc - 'signalement_id'), coalesce(jc2::text, 'nul'));

  -- 11. Compte fermé : ses signalements partent en cascade (sous-transaction annulée) -------------------------------
  jb := pg_temp.ligne(EB);
  begin
    r2 := pg_temp.lignes(format('delete from auth.users where id = %L', (select uid from pg_temp.preuve_comptes where nom = 'U')));
    j := pg_temp.ligne(EB);
    select count(*) into n from signalements_app where id = sB;
    raise exception 'preuve: annulé';
  exception when others then
    if sqlerrm <> 'preuve: annulé' then raise; end if;
  end;
  perform pg_temp.cas('compte fermé : son signalement part', r2 = '1' and n = 0, r2 || ' / ' || n);
  perform pg_temp.cas('compte fermé : lien à nul, issu_signalement vrai, entrée intacte',
    j ->> 'signalement_id' is null and (j ->> 'issu_signalement')::boolean and (j - 'signalement_id') = (jb - 'signalement_id'),
    coalesce(j::text, 'nul'));

  -- 12. service_role (outils du serveur) : le déclencheur s'applique aussi --------------------------------------------
  set local role service_role;
  r := pg_temp.ajout(jsonb_build_object('type', 'alea', 'origine', 'equipe', 'date_constat', current_date,
    'description', 'Écrit par le serveur', 'cree_le', '2000-01-01T00:00:00Z'));
  reset role;
  j := pg_temp.ligne(pg_temp.num(r));
  perform pg_temp.cas('service_role : écriture acceptée, cree_le posé par le déclencheur',
    (j ->> 'cree_le')::timestamptz = now(), coalesce(j::text, r));

  -- 13. Retour : la base revient à l'identique ---------------------------------------------------------------------
  reset role;
  update promos set lieu_id = L1 where id = P3;
  if not v_deja then
    if btrim(coalesce(current_setting('preuve.retour', true), ''), E' \t\r\n') <> '' then
      execute current_setting('preuve.retour');
    end if;
    execute v_empreinte into md5_apres;
    perform pg_temp.cas('retour : empreinte du schéma et des données identique à celle d''avant la migration',
      md5_apres = md5_avant, md5_avant || ' / ' || md5_apres);
    select count(*) into n from pg_class where relnamespace = 'public'::regnamespace and relname like 'registre%';
    select count(*) into m from pg_proc where pronamespace = 'public'::regnamespace and proname like '%registre_qualite%';
    perform pg_temp.cas('retour : plus aucune table ni fonction du registre', n = 0 and m = 0, n || '/' || m);
    perform pg_temp.cas('retour : peut_gerer_qualite() reste',
      to_regprocedure('public.peut_gerer_qualite()') is not null, null);
  end if;

  -- Verdict -----------------------------------------------------------------------------------------------------------
  select count(*) filter (where pc.bon), count(*) filter (where not pc.bon),
         string_agg(pc.cas || coalesce(' [' || pc.detail || ']', ''), ' | ' order by pc.n) filter (where not pc.bon)
    into v_ok, v_ko, v_detail from pg_temp.preuve_cas pc;
  if v_ko = 0 then
    raise exception 'VERT %/0', v_ok;
  end if;
  raise exception 'ROUGE %/% : %', v_ok, v_ko, v_detail;
end
$preuve$;
