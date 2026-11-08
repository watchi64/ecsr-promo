-- Preuve de la migration 20261108_questionnaires (questionnaires anonymes, Qualiopi Q3).
-- Rejouable : le bloc lève TOUJOURS une exception à la fin (verdict « VERT n/0 » ou « ROUGE ok/ko : cas »), tout est
-- annulé. Données 100 % fictives (example.invalid). Les dates des promos sont posées par rapport au jour (heure de
-- Paris) : la preuve tient quel que soit le jour où on la joue.
--
-- Méthode (mémoire « Répétition de migration dans la preuve SQL ») : la migration et son retour sont joués PAR EXECUTE
-- à l'intérieur du bloc DO, entre deux empreintes md5 du schéma public (tables, colonnes, contraintes, fonctions,
-- droits, règles) et des données existantes ; la levée finale annule tout. Si les tables existent déjà (base où la
-- migration a été appliquée), la preuve joue les mêmes cas sans rejouer migration ni retour.
--
-- Jouée sur une base LOCALE jetable (Postgres de scoop, authentification « trust ») :
--   D=<dossier temporaire> ; initdb -D $D/pg -U postgres --auth=trust -E UTF8 --no-locale
--   pg_ctl -D $D/pg -o "-p 55441" -l $D/pg.log start ; createdb -p 55441 -U postgres qn
--   psql -p 55441 -U postgres -d qn -f tests/sql/questionnaires-schema-minimal.sql
--   psql -p 55441 -U postgres -d qn -1 -v migration=<chemin absolu de 20261108_questionnaires.sql> \
--        -v retour=<chemin absolu de 20261108_questionnaires_retour.sql> -f tests/sql/questionnaires-preuve.sql
--   pg_ctl -D $D/pg stop ; rm -rf $D
-- (pg_read_file lit les deux fichiers côté serveur : superutilisateur local seulement. Sur une autre base, remplacer
-- les deux pg_read_file par le texte des fichiers.)
--
-- Envois simultanés (hors de ce fichier : une preuve ne joue qu'une session). Sur la base locale, migration appliquée,
-- une promo à J+3 et quatre stagiaires : S1 puis S2 répondent ; puis, en même temps, S3 dans une session qui garde sa
-- transaction ouverte 4 s après son envoi (pg_sleep) et S4 dans une seconde session lancée 1 s plus tard. On relève
-- ensuite « select xmin, count(*) from questionnaire_reponses group by 1 » et le xmin de chaque participation.
-- Attendu : une seule ligne de réponses (4 réponses, xmin de S4, le dernier servi). Sans verrou, la réponse de S4
-- resterait seule avec le xmin de sa participation.
--
-- Résultats du 08/11/2026 (Postgres 18.4 local, port 55441, base recréée à chaque passage) :
--   - avant la migration (fichiers de migration et de retour vides) : échec, « relation questionnaire_questions does
--     not exist » ;
--   - correction 1 (relecture du 08/11) : VERT 144/0 (trois passages) ; base où la migration est déjà appliquée :
--     VERT 142/0 (les deux cas du retour ne se jouent pas), aucune ligne laissée ;
--   - contre-épreuve 1 (colonne created_at ajoutée aux réponses) : ROUGE 141/3, sur « colonnes des réponses »,
--     « aucune colonne de date… » et « seule valeur par défaut… » ;
--   - contre-épreuve 2 (règle et droit de lecture des réponses pour tout compte connecté) : ROUGE 139/5, sur « aucune
--     règle de lecture », « aucun droit des rôles de l'API » et la lecture directe par A1, F1 et T ;
--   - contre-épreuve 3 (brassage retiré) : ROUGE 142/2, sur « xmin » (5 numéros pour 5 réponses) et « TOAST » ;
--   - contre-épreuve 4 (seuil ramené à 1) : ROUGE 138/6, sur les seuls cas de seuil (stagiaires et formateurs) ;
--   - contre-épreuve 5 (verrou par portée retiré) : ROUGE 143/1, sur le seul cas « verrou » ; au test à deux sessions,
--     deux passages : réponses xmin S3 x3 et xmin S4 x1 (S4 reliée à sa participation) ; avec le verrou, deux
--     passages : un seul xmin pour les 4 réponses, celui de S4 ;
--   - contre-épreuve 6 (commentaire non recopié au brassage) : ROUGE 143/1, sur le seul cas « TOAST » (morceaux au
--     xmin de l'envoi de A2, lignes au xmin de A5) ;
--   - retour joué hors preuve (psql -f) : empreinte du schéma 66ec4630… avant, 24c0efd4… migration appliquée,
--     66ec4630… après le retour ; plus aucune table ni fonction des questionnaires.

select length(set_config('preuve.migration', pg_read_file(:'migration'), false)) as migration_lue,
       length(set_config('preuve.retour', pg_read_file(:'retour'), false)) as retour_lu;

set local lock_timeout = '3s';

do $preuve$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  y integer := extract(year from (now() at time zone 'Europe/Paris'))::integer;
  v_deja boolean := to_regclass('public.questionnaire_reponses') is not null;
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
    ) e(x) $q$;
  md5_avant text; md5_apres text;
  v_acces_promo text;
  L1 integer; L2 integer; L3 integer; P1 integer; P2 integer; P3 integer; P4 integer; P5 integer;
  pP1 jsonb; pP2 jsonb; pP3 jsonb; pP5 jsonb; pL1 jsonb; pL2 jsonb; pL3 jsonb;
  r text; j jsonb; n bigint; m bigint; t text;
  c record; v_ok integer; v_ko integer; v_detail text; v_ordres text[];
  Pb1 integer; Pb2 integer; Pb3 integer; Pb4 integer; v_long text; v_toast text; v_xmin text; f record;
begin
  -- 0. Outils de la preuve (schéma temporaire, annulés avec le reste) ------------------------------------------------
  execute $q$
    create table pg_temp.preuve_comptes (nom text primary key, email text not null, uid uuid not null);
    create table pg_temp.preuve_cas (n integer primary key, cas text not null, bon boolean not null, detail text);
    grant select on pg_temp.preuve_comptes to authenticated, anon;
    grant select, insert on pg_temp.preuve_cas to authenticated, anon;
    -- Se connecter sous un compte fictif (nul : sans session).
    create function pg_temp.qui(p_nom text) returns void language plpgsql as $f$
    declare c record;
    begin
      if p_nom is null then perform set_config('request.jwt.claims', '', true); return; end if;
      select * into c from pg_temp.preuve_comptes where nom = p_nom;
      perform set_config('request.jwt.claims', json_build_object('email', c.email, 'sub', c.uid)::text, true);
    end $f$;
    -- Jouer une requête sous le rôle courant : « ok » ou « code message ». Chaque appel est une sous-transaction.
    create function pg_temp.tente(p_sql text) returns text language plpgsql as $f$
    begin
      execute p_sql;
      return 'ok';
    exception when others then
      return sqlstate || ' ' || sqlerrm;
    end $f$;
    create function pg_temp.essai(p_cle text, p_portee jsonb, p_version integer, p_rep jsonb, p_com text default null)
    returns text language sql as $f$
      select pg_temp.tente(format('select public.repondre_questionnaire(%L, %L::jsonb, %L::integer, %L::jsonb, %L)',
                                  p_cle, p_portee, p_version, p_rep, p_com));
    $f$;
    -- Noter un cas.
    create function pg_temp.cas(p_cas text, p_bon boolean, p_detail text default null) returns void language sql as $f$
      insert into pg_temp.preuve_cas (n, cas, bon, detail)
      select coalesce(max(n), 0) + 1, p_cas, coalesce(p_bon, false), p_detail from pg_temp.preuve_cas;
    $f$;
    -- Réponses complètes de fin de formation (stagiaire) : chaque question à v ; « app » ajoutée si donnée.
    create function pg_temp.rep_fin(v jsonb, app jsonb default null) returns jsonb language sql as $f$
      select jsonb_build_object('objectifs', v, 'contenus', v, 'formateurs', v, 'organisation', v,
               'accompagnement', v, 'preparation', v, 'recommandation', v, 'globalement', v)
             || case when app is null then '{}'::jsonb else jsonb_build_object('app', app) end;
    $f$;
    create function pg_temp.rep_form(v jsonb) returns jsonb language sql as $f$
      select jsonb_build_object('objectifs', v, 'supports', v, 'organisation', v, 'niveau', v, 'suivi', v, 'globalement', v);
    $f$;
  $q$;

  -- 1. Données fictives (avant la première empreinte : elles ne bougent plus ensuite) ---------------------------------
  insert into lieux (nom) values ('Lieu preuve 1') returning id into L1;
  insert into lieux (nom) values ('Lieu preuve 2') returning id into L2;
  insert into lieux (nom) values ('Lieu preuve 3 sans promo') returning id into L3;
  -- P1 : fin dans 3 jours (fin de formation ouverte). P2 : fin dans 60 jours (pas encore). P3 : finie il y a 40 jours
  -- (fenêtre passée). P4 : sans date de fin. P5 : finie il y a 6 mois et 5 jours (questionnaire à six mois ouvert).
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve P1', v_jour - 300, v_jour + 3) returning id into P1;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve P2', v_jour - 100, v_jour + 60) returning id into P2;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L2, 'Preuve P3', v_jour - 400, v_jour - 40) returning id into P3;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L2, 'Preuve P4', v_jour - 50, null) returning id into P4;
  insert into promos (lieu_id, nom, date_debut, date_fin)
    values (L2, 'Preuve P5', v_jour - 700, (v_jour - interval '6 months' - interval '5 days')::date) returning id into P5;
  -- Bornes de la fin de formation : J+7 et J-30 ouvertes (premier et dernier jour), J+8 et J-31 fermées.
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve borne J+7', v_jour - 300, v_jour + 7) returning id into Pb1;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve borne J+8', v_jour - 300, v_jour + 8) returning id into Pb2;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve borne J-30', v_jour - 300, v_jour - 30) returning id into Pb3;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve borne J-31', v_jour - 300, v_jour - 31) returning id into Pb4;
  -- Commentaire long et incompressible (2 000 idéogrammes pseudo-aléatoires, 6 000 octets) : rangé dans la table TOAST.
  select string_agg(chr(19968 + (('x' || substr(md5(i::text), 1, 4))::bit(16)::integer % 20000)), '' order by i)
    into v_long from generate_series(1, 2000) i;
  pP1 := jsonb_build_object('promo_id', P1); pP2 := jsonb_build_object('promo_id', P2);
  pP3 := jsonb_build_object('promo_id', P3); pP5 := jsonb_build_object('promo_id', P5);
  pL1 := jsonb_build_object('lieu_id', L1, 'annee', y); pL2 := jsonb_build_object('lieu_id', L2, 'annee', y);
  pL3 := jsonb_build_object('lieu_id', L3, 'annee', y);

  -- Comptes : A1 à A6 stagiaires de P1 ; X stagiaire de P1 anonymisé ; B de P2 ; C de P3 ; D de P5 ; N profil sans
  -- fiche ; Z sans profil ; F1, F2, F3, F5 formateurs (prof) ; F4 administrateur ; T fondateur (stagiaire de P4).
  insert into pg_temp.preuve_comptes (nom, email, uid)
  select k, 'preuve.qn.' || lower(k) || '@example.invalid', gen_random_uuid()
    from unnest(array['A1','A2','A3','A4','A5','A6','X','B','C','D','N','Z','F1','F2','F3','F4','F5','T']) k;
  insert into auth.users (id, email) select uid, email from pg_temp.preuve_comptes;
  for c in select * from pg_temp.preuve_comptes loop
    if c.nom in ('A1','A2','A3','A4','A5','A6','X','B','C','D','T') then
      insert into stagiaires (prenom, nom, promo_id, anonymise_le)
      values (c.nom, 'Preuve',
              case c.nom when 'B' then P2 when 'C' then P3 when 'D' then P5 when 'T' then P4 else P1 end,
              case when c.nom = 'X' then now() end)
      returning id into v_ok;
      insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id)
      values (c.email, 'stagiaire', c.nom = 'T', c.nom = 'T', v_ok);
    elsif c.nom like 'F%' then
      insert into user_profiles (email, role, is_admin, is_founder)
      values (c.email, case when c.nom = 'F4' then 'admin' else 'prof' end, true, false);
    elsif c.nom = 'N' then
      insert into user_profiles (email, role, is_admin, is_founder) values (c.email, null, false, false);
    end if;
  end loop;

  -- 2. Migration jouée entre deux empreintes --------------------------------------------------------------------
  if not v_deja then
    execute v_empreinte into md5_avant;
    if btrim(coalesce(current_setting('preuve.migration', true), ''), E' \t\r\n') <> '' then
      execute current_setting('preuve.migration');
    end if;
  end if;

  -- 3. Catalogue : la forme même des tables interdit le recoupement ------------------------------------------------
  select string_agg(attname, ',' order by attname) into t from pg_attribute
   where attrelid = to_regclass('public.questionnaire_reponses') and attnum > 0 and not attisdropped;
  perform pg_temp.cas('colonnes des réponses : id, questionnaire, version, portée, réponses, commentaire',
    t = 'annee,cle,commentaire,id,lieu_id,promo_id,reponses,version', t);
  select count(*) into n from pg_attribute a
   where a.attrelid = to_regclass('public.questionnaire_reponses') and a.attnum > 0 and not a.attisdropped
     and (format_type(a.atttypid, null) in ('date', 'timestamp without time zone', 'timestamp with time zone',
                                            'time without time zone', 'time with time zone', 'interval')
          or (a.atttypid = 'uuid'::regtype and a.attname <> 'id') or a.attidentity <> '' or a.attgenerated <> '');
  perform pg_temp.cas('aucune colonne de date, d''heure, d''utilisateur ni d''identité dans les réponses',
    to_regclass('public.questionnaire_reponses') is not null and n = 0, n::text);
  select string_agg(pg_get_expr(d.adbin, d.adrelid), ',') into t from pg_attrdef d
   where d.adrelid = to_regclass('public.questionnaire_reponses');
  perform pg_temp.cas('seule valeur par défaut des réponses : un uuid tiré au hasard', t = 'gen_random_uuid()', t);
  select count(*) into n from pg_depend dp join pg_class s on s.oid = dp.objid and s.relkind = 'S'
   where dp.refobjid = to_regclass('public.questionnaire_reponses');
  perform pg_temp.cas('aucune séquence liée aux réponses', to_regclass('public.questionnaire_reponses') is not null and n = 0, n::text);
  select string_agg(attname, ',' order by attname) into t from pg_attribute
   where attrelid = to_regclass('public.questionnaire_participations') and attnum > 0 and not attisdropped;
  perform pg_temp.cas('colonnes des participations : questionnaire, portée, utilisateur (aucune date)',
    t = 'annee,cle,lieu_id,promo_id,user_id', t);
  select string_agg(a.attname, ',' order by a.attname) into t
    from pg_attribute a join pg_attribute b on b.attname = a.attname
   where a.attrelid = to_regclass('public.questionnaire_reponses') and a.attnum > 0 and not a.attisdropped
     and b.attrelid = to_regclass('public.questionnaire_participations') and b.attnum > 0 and not b.attisdropped;
  select count(*) into n from pg_constraint
   where contype = 'f'
     and ((conrelid = to_regclass('public.questionnaire_reponses') and confrelid = to_regclass('public.questionnaire_participations'))
       or (conrelid = to_regclass('public.questionnaire_participations') and confrelid = to_regclass('public.questionnaire_reponses')));
  perform pg_temp.cas('aucune clé commune aux réponses et aux participations hors portée, aucune clé étrangère entre elles',
    t = 'annee,cle,lieu_id,promo_id' and n = 0, coalesce(t, 'aucune') || ' / ' || n);
  select count(*) into n from pg_trigger
   where tgrelid in (to_regclass('public.questionnaire_reponses'), to_regclass('public.questionnaire_participations'))
     and not tgisinternal;
  perform pg_temp.cas('aucun déclencheur sur les réponses ni les participations', n = 0, n::text);
  select count(*) into n from pg_class
   where oid in (to_regclass('public.questionnaire_reponses'), to_regclass('public.questionnaire_participations'),
                 to_regclass('public.questionnaire_ouvertures'), to_regclass('public.questionnaire_questions'))
     and relrowsecurity;
  perform pg_temp.cas('sécurité par ligne active sur les quatre tables', n = 4, n::text);
  select count(*) into n from pg_policies where schemaname = 'public'
     and tablename in ('questionnaire_reponses', 'questionnaire_participations', 'questionnaire_questions');
  perform pg_temp.cas('aucune règle de lecture sur les réponses, les participations et les questions', n = 0, n::text);
  select count(*) into n
    from (values ('anon'), ('authenticated'), ('service_role')) ro(rol),
         (values ('public.questionnaire_reponses'), ('public.questionnaire_participations')) ta(tab),
         (values ('select'), ('insert'), ('update'), ('delete'), ('truncate')) pr(priv)
   where to_regclass(ta.tab) is not null and has_table_privilege(ro.rol, ta.tab, pr.priv);
  perform pg_temp.cas('aucun droit des rôles de l''API sur les réponses et les participations',
    to_regclass('public.questionnaire_reponses') is not null and n = 0, n::text);
  select count(*) into n from questionnaire_questions where version = 1;
  perform pg_temp.cas('19 questions en version 1 (miroir de questionnaires-data.js)', n = 19, n::text);
  -- Envois simultanés : la preuve ne joue qu'une session ; le test à deux sessions est décrit dans l'en-tête. Ici, le
  -- verrou par portée doit être pris avant l'écriture de la participation.
  t := pg_get_functiondef(to_regprocedure('public.repondre_questionnaire(text, jsonb, integer, jsonb, text)'));
  perform pg_temp.cas('verrou par portée pris avant l''écriture de la participation',
    position('pg_advisory_xact_lock(' in t) > 0
    and position('pg_advisory_xact_lock(' in t) < position('insert into questionnaire_participations' in t),
    coalesce(position('pg_advisory_xact_lock(' in t), -1) || ' / ' || coalesce(position('insert into questionnaire_participations' in t), -1));
  select string_agg(confdeltype::text, ',') into t from pg_constraint
   where conrelid = to_regclass('public.questionnaire_reponses') and contype = 'f';
  perform pg_temp.cas('supprimer une promo ou un lieu qui porte des réponses est refusé (on delete restrict)', t = 'r,r', t);
  select count(*) into n
    from (values ('anon'), ('service_role')) ro(rol),
         (values ('public.questionnaire_reponses'), ('public.questionnaire_participations'),
                 ('public.questionnaire_ouvertures'), ('public.questionnaire_questions')) ta(tab),
         (values ('select'), ('insert'), ('update'), ('delete'), ('truncate')) pr(priv)
   where to_regclass(ta.tab) is not null and has_table_privilege(ro.rol, ta.tab, pr.priv);
  perform pg_temp.cas('anon et service_role : aucun droit sur les quatre tables',
    to_regclass('public.questionnaire_questions') is not null and n = 0, n::text);
  select string_agg(ta.tab || ':' || pr.priv, ',' order by ta.tab, pr.priv) into t
    from (values ('public.questionnaire_ouvertures'), ('public.questionnaire_questions')) ta(tab),
         (values ('select'), ('insert'), ('update'), ('delete'), ('truncate')) pr(priv)
   where to_regclass(ta.tab) is not null and has_table_privilege('authenticated', ta.tab, pr.priv);
  perform pg_temp.cas('authenticated : la seule lecture des ouvertures, rien sur les questions',
    t = 'public.questionnaire_ouvertures:select', t);

  -- Fenêtres : dates fixes (fin de mois, année bissextile, Nîmes), comme fenetreQuestionnaire() en JS
  for f in select * from (values
      ('six_mois_stagiaire', date '2026-08-31', date '2027-02-28', date '2027-03-31'),
      ('six_mois_stagiaire', date '2027-08-31', date '2028-02-29', date '2028-03-31'),
      ('six_mois_stagiaire', date '2026-12-11', date '2027-06-11', date '2027-07-11'),
      ('fin_stagiaire', date '2026-12-11', date '2026-12-04', date '2027-01-10'),
      ('fin_formateur', date '2026-03-03', date '2026-02-24', date '2026-04-02')) v(cle, fin, du, au) loop
    select w.du || '/' || w.au into t from _questionnaire_fenetre(f.cle, f.fin) w;
    perform pg_temp.cas(format('fenêtre %s pour une fin au %s', f.cle, f.fin), t = f.du || '/' || f.au, t);
  end loop;
  select count(*) into n from _questionnaire_fenetre('fin_stagiaire', null) w where w.du is null and w.au is null;
  perform pg_temp.cas('aucune fenêtre sans date de fin', n = 1, n::text);
  -- Bornes au jour près, sur des promos réelles (aucune ouverture manuelle)
  perform pg_temp.cas('fin de formation ouverte à J+7 (premier jour)', _questionnaire_ouvert('fin_stagiaire', Pb1, null, null), null);
  perform pg_temp.cas('fin de formation fermée à J+8 (la veille)', not _questionnaire_ouvert('fin_stagiaire', Pb2, null, null), null);
  perform pg_temp.cas('fin de formation ouverte à J-30 (dernier jour)', _questionnaire_ouvert('fin_stagiaire', Pb3, null, null), null);
  perform pg_temp.cas('fin de formation fermée à J-31 (le lendemain)', not _questionnaire_ouvert('fin_stagiaire', Pb4, null, null), null);

  -- 4. Aucune lecture ni écriture directe, pour aucun rôle --------------------------------------------------------
  set local role authenticated;
  foreach t in array array['A1', 'F1', 'T'] loop
    perform pg_temp.qui(t);
    r := pg_temp.tente('select count(*) from public.questionnaire_reponses');
    perform pg_temp.cas('lecture directe des réponses refusée à ' || t, r like '42501%', r);
    r := pg_temp.tente('select count(*) from public.questionnaire_participations');
    perform pg_temp.cas('lecture directe des participations refusée à ' || t, r like '42501%', r);
    r := pg_temp.tente($s$insert into public.questionnaire_reponses (cle, version, promo_id, reponses) values ('fin_stagiaire', 1, 1, '{}')$s$);
    perform pg_temp.cas('écriture directe d''une réponse refusée à ' || t, r like '42501%', r);
    r := pg_temp.tente('delete from public.questionnaire_reponses');
    perform pg_temp.cas('effacement direct des réponses refusé à ' || t, r like '42501%', r);
    r := pg_temp.tente('select public._questionnaire_ouvert(''fin_stagiaire'', 1, null, null)');
    perform pg_temp.cas('outil interne inaccessible à ' || t, r like '42501%', r);
  end loop;
  reset role;
  set local role anon;
  r := pg_temp.tente('select count(*) from public.questionnaire_reponses');
  perform pg_temp.cas('lecture directe des réponses refusée à anon', r like '42501%', r);
  r := pg_temp.tente('select * from public.questionnaires_a_remplir()');
  perform pg_temp.cas('questionnaires_a_remplir refusé à anon', r like '42501%', r);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('repondre_questionnaire refusé à anon', r like '42501%', r);
  foreach t in array array[
      format('select public.resultats_questionnaire(%L, %L::jsonb)', 'fin_stagiaire', pP1),
      format('select public.commentaires_questionnaire(%L, %L::jsonb)', 'fin_stagiaire', pP1),
      format('select public.ouvrir_questionnaire(%L, %L::jsonb, true)', 'fin_stagiaire', pP1),
      'select public.peut_gerer_qualite()'] loop
    r := pg_temp.tente(t);
    perform pg_temp.cas('refusé à anon : ' || split_part(split_part(t, 'public.', 2), '(', 1), r like '42501%', r);
  end loop;
  reset role;

  -- 5. Ce que chacun a à remplir, au départ -------------------------------------------------------------------------
  set local role authenticated;
  perform pg_temp.qui('A6');
  select string_agg(q.cle || ' v' || q.version || ' ' || q.portee::text, ' ; ') into t from questionnaires_a_remplir() q;
  perform pg_temp.cas('A6 a la fin de formation de P1 à remplir', t = 'fin_stagiaire v1 ' || pP1::text, t);
  perform pg_temp.qui('B');
  select count(*) into n from questionnaires_a_remplir();
  perform pg_temp.cas('B (P2, fenêtre pas encore ouverte) n''a rien à remplir', n = 0, n::text);
  perform pg_temp.qui('C');
  select count(*) into n from questionnaires_a_remplir();
  perform pg_temp.cas('C (P3, fenêtre passée) n''a rien à remplir', n = 0, n::text);
  perform pg_temp.qui('D');
  select string_agg(q.cle || ' ' || q.portee::text, ' ; ') into t from questionnaires_a_remplir() q;
  perform pg_temp.cas('D a le questionnaire à six mois de P5, et lui seul', t = 'six_mois_stagiaire ' || pP5::text, t);
  perform pg_temp.qui('F1');
  select string_agg(q.cle || ' ' || q.portee::text, ' ; ') into t from questionnaires_a_remplir() q;
  perform pg_temp.cas('F1 a le questionnaire formateurs du lieu 1 pour l''année, et lui seul', t = 'fin_formateur ' || pL1::text, t);
  foreach t in array array['X', 'N', 'Z'] loop
    perform pg_temp.qui(t);
    select count(*) into n from questionnaires_a_remplir();
    perform pg_temp.cas(t || ' (anonymisé, sans fiche ou sans profil) n''a rien à remplir', n = 0, n::text);
  end loop;
  perform pg_temp.qui(null);
  select count(*) into n from questionnaires_a_remplir();
  perform pg_temp.cas('sans session, rien à remplir', n = 0, n::text);

  -- 6. Forme des réponses : chaque refus n'écrit rien ---------------------------------------------------------------
  perform pg_temp.qui('A6');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3') || '{"inconnue": 3}');
  perform pg_temp.cas('question inconnue refusée', r like '%Question inconnue%', r);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3') || '{"commentaire": 3}');
  perform pg_temp.cas('commentaire glissé parmi les réponses refusé', r like '%Question inconnue%', r);
  foreach t in array array['5', '0', '2.5', '3.0', '"3"', 'true', '[3]'] loop
    r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin(t::jsonb));
    perform pg_temp.cas('valeur ' || t || ' hors échelle refusée', r like '%hors de l''échelle%', r);
  end loop;
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3') - 'globalement');
  perform pg_temp.cas('question obligatoire manquante refusée', r like '%Il manque des réponses%', r);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, '[1, 2]');
  perform pg_temp.cas('réponses en tableau refusées', r like '%Réponses illisibles%', r);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, null);
  perform pg_temp.cas('réponses absentes refusées', r like '%Réponses illisibles%', r);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'), repeat('é', 2001));
  perform pg_temp.cas('commentaire de 2 001 caractères refusé', r like '%2 000 caractères%', r);
  r := pg_temp.essai('fin_stagiaire', pP1, 2, pg_temp.rep_fin('3'));
  perform pg_temp.cas('version périmée ou inconnue refusée', r like '%a changé%', r);
  r := pg_temp.essai('xyz', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('questionnaire inconnu refusé', r like '%Questionnaire inconnu%', r);
  r := pg_temp.essai('fin_stagiaire', pL1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('portée de formateur sur un questionnaire stagiaire refusée', r like '%Portée%illisible%', r);
  r := pg_temp.essai('fin_stagiaire', pP1 || '{"x": 1}', 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('portée avec une clé en trop refusée', r like '%Portée%illisible%', r);
  r := pg_temp.essai('fin_stagiaire', jsonb_build_object('promo_id', P1::text), 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('portée en texte refusée', r like '%Portée%illisible%', r);
  reset role;
  select count(*) into n from questionnaire_participations;
  select count(*) into m from questionnaire_reponses;
  perform pg_temp.cas('aucun refus n''a laissé de participation ni de réponse', n = 0 and m = 0, n || '/' || m);

  -- 7. Réponses des stagiaires de P1 ; deuxième envoi refusé ; seuil de 5 ------------------------------------------
  set local role authenticated;
  perform pg_temp.qui('A1');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('4', '1'), 'Bien');
  perform pg_temp.cas('A1 répond', r = 'ok', r);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('4', '1'), 'Encore');
  perform pg_temp.cas('deuxième réponse de A1 refusée', r like '%déjà répondu%', r);
  select count(*) into n from questionnaires_a_remplir();
  perform pg_temp.cas('après sa réponse, A1 n''a plus rien à remplir', n = 0, n::text);
  perform pg_temp.qui('A2');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('4', '3'), v_long);
  perform pg_temp.cas('A2 répond (commentaire long, rangé à part)', r = 'ok', r);
  perform pg_temp.qui('A3');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3', 'null'), 'Salle froide');
  perform pg_temp.cas('A3 répond', r = 'ok', r);
  perform pg_temp.qui('A4');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('2'), '   ');
  perform pg_temp.cas('A4 répond', r = 'ok', r);

  perform pg_temp.qui('T');
  j := resultats_questionnaire('fin_stagiaire', pP1);
  perform pg_temp.cas('à 4 réponses, résultats vides et nombre masqué',
    j -> 'questions' = '{}'::jsonb and jsonb_typeof(j -> 'reponses') = 'null' and (j ->> 'seuil')::int = 5, j::text);
  select count(*) into n from commentaires_questionnaire('fin_stagiaire', pP1);
  perform pg_temp.cas('à 4 réponses, aucun commentaire rendu', n = 0, n::text);

  perform pg_temp.qui('A5');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('null'), 'Merci');
  perform pg_temp.cas('A5 répond (sans avis partout)', r = 'ok', r);
  perform pg_temp.qui('T');
  j := resultats_questionnaire('fin_stagiaire', pP1);
  perform pg_temp.cas('à 5 réponses, le nombre apparaît', (j ->> 'reponses')::int = 5, j::text);
  perform pg_temp.cas('à 5 réponses, comptes exacts de la question globale',
    j #> '{questions,globalement}' = '{"4": 2, "3": 1, "2": 1, "sans_avis": 1}'::jsonb, (j #> '{questions,globalement}')::text);
  perform pg_temp.cas('à 5 réponses, toutes les questions obligatoires apparaissent',
    (select count(*) from jsonb_object_keys(j -> 'questions')) = 8, (j -> 'questions')::text);
  perform pg_temp.cas('question facultative à 3 réponses masquée', not ((j -> 'questions') ? 'app'), (j -> 'questions')::text);
  select string_agg(x, '|' order by x) into t from commentaires_questionnaire('fin_stagiaire', pP1) x;
  perform pg_temp.cas('à 5 réponses, les commentaires non vides sont rendus au fondateur',
    t = (select string_agg(e, '|' order by e) from unnest(array['Bien', 'Merci', 'Salle froide', v_long]) e), left(t, 60));
  v_ordres := '{}';
  for i in 1..20 loop
    select string_agg(x, '|') into t from commentaires_questionnaire('fin_stagiaire', pP1) x;
    v_ordres := v_ordres || t;
  end loop;
  select count(distinct o) into n from unnest(v_ordres) o;
  perform pg_temp.cas('l''ordre des commentaires change d''un appel à l''autre (20 appels)', n >= 2, n::text);
  reset role;
  -- Chaque réponse a été écrite dans sa propre sous-transaction (pg_temp.tente) : sans brassage, chacune porterait le
  -- xmin de sa participation.
  select count(distinct xmin::text), count(*) into n, m from questionnaire_reponses where cle = 'fin_stagiaire' and promo_id = P1;
  perform pg_temp.cas('xmin : les 5 réponses de la portée partagent un seul numéro de transaction (aucun appariement)',
    n = 1 and m = 5, n || ' numéros pour ' || m || ' réponses');
  -- Le commentaire long de A2 (écrit dans la sous-transaction de A2) est dans la table TOAST : ses morceaux doivent
  -- porter le numéro de la dernière transaction (celle de A5), comme les lignes, et non celui de l'envoi de A2.
  select min(xmin::text) into v_xmin from questionnaire_reponses where cle = 'fin_stagiaire' and promo_id = P1;
  select reltoastrelid::regclass::text into v_toast from pg_class where oid = 'public.questionnaire_reponses'::regclass;
  -- Postgres 17 et plus : les seuls morceaux des réponses de P1 ; avant : toute la table TOAST (aucun autre commentaire
  -- long attendu dans la base où l'on joue la preuve).
  if to_regproc('pg_column_toast_chunk_id') is not null then
    execute format('select count(*), count(distinct xmin::text), min(xmin::text) from %s where chunk_id in (
      select pg_column_toast_chunk_id(commentaire) from public.questionnaire_reponses
       where cle = %L and promo_id = %s)', v_toast, 'fin_stagiaire', P1) into n, m, t;
  else
    execute format('select count(*), count(distinct xmin::text), min(xmin::text) from %s', v_toast) into n, m, t;
  end if;
  perform pg_temp.cas('TOAST : le commentaire long est rangé à part, et ses morceaux portent le numéro des lignes',
    n > 0 and m = 1 and t = v_xmin, n || ' morceaux, ' || m || ' numéro(s), ' || coalesce(t, 'aucun') || ' / lignes ' || v_xmin);

  -- 8. Non-ayants droit et fenêtres ------------------------------------------------------------------------------------
  set local role authenticated;
  perform pg_temp.qui('B');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('stagiaire d''une autre promo refusé', r like '%ne te concerne pas%', r);
  perform pg_temp.qui('X');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('fiche anonymisée refusée', r like '%ne te concerne pas%', r);
  perform pg_temp.qui('N');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('compte sans fiche refusé', r like '%ne te concerne pas%', r);
  perform pg_temp.qui('Z');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('compte sans profil refusé', r like '%ne te concerne pas%', r);
  perform pg_temp.qui('F1');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('formateur refusé au questionnaire des stagiaires', r like '%ne te concerne pas%', r);
  perform pg_temp.qui(null);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('sans session, refusé', r like '%Reconnecte-toi%', r);
  perform pg_temp.qui('C');
  r := pg_temp.essai('fin_stagiaire', pP3, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('fenêtre passée refusée alors que C n''a pas répondu', r like '%fermé%', r);
  perform pg_temp.qui('B');
  r := pg_temp.essai('fin_stagiaire', pP2, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('fenêtre pas encore ouverte refusée', r like '%fermé%', r);
  perform pg_temp.qui('D');
  r := pg_temp.essai('fin_stagiaire', pP5, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('fin de formation de P5 (finie depuis 6 mois) refusée', r like '%fermé%', r);
  r := pg_temp.essai('six_mois_stagiaire', pP5, 1,
    '{"situation": "Je fais autre chose !", "utile": 3, "preparation": 4, "globalement": 3}');
  perform pg_temp.cas('choix hors des options refusé', r like '%Choix inconnu%', r);
  r := pg_temp.essai('six_mois_stagiaire', pP5, 1,
    '{"situation": "Je fais autre chose", "utile": 3, "preparation": 4, "globalement": 3}');
  perform pg_temp.cas('D répond au questionnaire à six mois', r = 'ok', r);
  reset role;
  select count(*) into n from questionnaire_participations p join pg_temp.preuve_comptes k on k.uid = p.user_id
   where k.nom in ('B', 'X', 'N', 'Z', 'C') or (k.nom = 'F1' and p.cle <> 'fin_formateur');
  perform pg_temp.cas('aucun refus n''a laissé de participation', n = 0, n::text);
  select string_agg(p.cle, ',' order by p.cle) into t
    from questionnaire_participations p join pg_temp.preuve_comptes k on k.uid = p.user_id where k.nom = 'D';
  perform pg_temp.cas('D : une seule participation, au questionnaire à six mois (ses refus n''ont rien laissé)',
    t = 'six_mois_stagiaire', t);

  -- 9. Ouverture manuelle : gestion seulement ; elle prime dans les deux sens --------------------------------------
  set local role authenticated;
  perform pg_temp.qui('A1');
  r := pg_temp.tente(format('select public.ouvrir_questionnaire(%L, %L::jsonb, true)', 'fin_stagiaire', pP2));
  perform pg_temp.cas('ouverture manuelle refusée à un stagiaire', r like '%Réservé à la gestion%', r);
  perform pg_temp.qui('F1');
  r := pg_temp.tente(format('select public.ouvrir_questionnaire(%L, %L::jsonb, true)', 'fin_stagiaire', pP2));
  perform pg_temp.cas('ouverture manuelle refusée à un formateur', r like '%Réservé à la gestion%', r);
  perform pg_temp.qui('T');
  r := pg_temp.tente(format('select public.ouvrir_questionnaire(%L, %L::jsonb, true)', 'fin_stagiaire', pP2));
  perform pg_temp.cas('le fondateur ouvre P2 avant sa fenêtre', r = 'ok', r);
  r := pg_temp.tente(format('insert into public.questionnaire_ouvertures (cle, promo_id, ouvert, par_email) values (%L, %s, true, %L)',
    'fin_stagiaire', P3, 'x@example.invalid'));
  perform pg_temp.cas('écriture directe d''une ouverture refusée, même au fondateur', r like '42501%', r);
  select count(*) into n from questionnaire_ouvertures;
  perform pg_temp.cas('le fondateur lit les ouvertures', n = 1, n::text);
  perform pg_temp.qui('A1');
  select count(*) into n from questionnaire_ouvertures;
  perform pg_temp.cas('un stagiaire ne lit aucune ouverture', n = 0, n::text);
  perform pg_temp.qui('B');
  select string_agg(q.cle || ' ' || q.portee::text, ' ; ') into t from questionnaires_a_remplir() q;
  perform pg_temp.cas('après l''ouverture manuelle, B a P2 à remplir', t = 'fin_stagiaire ' || pP2::text, t);
  r := pg_temp.essai('fin_stagiaire', pP2, 1, pg_temp.rep_fin('4'));
  perform pg_temp.cas('B répond hors de la fenêtre, ouverte à la main', r = 'ok', r);
  perform pg_temp.qui('T');
  r := pg_temp.tente(format('select public.ouvrir_questionnaire(%L, %L::jsonb, false)', 'fin_stagiaire', pP1));
  perform pg_temp.cas('le fondateur ferme P1 dans sa fenêtre', r = 'ok', r);
  perform pg_temp.qui('A6');
  select count(*) into n from questionnaires_a_remplir();
  perform pg_temp.cas('P1 fermée à la main : A6 n''a plus rien à remplir', n = 0, n::text);
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('P1 fermée à la main : A6 refusé dans la fenêtre', r like '%fermé%', r);
  perform pg_temp.qui('T');
  r := pg_temp.tente(format('select public.ouvrir_questionnaire(%L, %L::jsonb, null)', 'fin_stagiaire', pP1));
  perform pg_temp.cas('le fondateur rend P1 à ses dates', r = 'ok', r);
  perform pg_temp.qui('A6');
  r := pg_temp.essai('fin_stagiaire', pP1, 1, pg_temp.rep_fin('3'));
  perform pg_temp.cas('A6 répond après ses envois refusés (aucune trace des refus)', r = 'ok', r);

  -- 10. Formateurs : par lieu et par année, seuil de 3 ------------------------------------------------------------
  perform pg_temp.qui('F1');
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('4'), 'Salles trop petites');
  perform pg_temp.cas('F1 répond pour le lieu 1', r = 'ok', r);
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('4'));
  perform pg_temp.cas('deuxième réponse de F1 refusée', r like '%déjà répondu%', r);
  r := pg_temp.essai('fin_formateur', pL2, 1, pg_temp.rep_form('4'));
  perform pg_temp.cas('lieu 2 (aucune promo dans sa fenêtre) fermé pour F1', r like '%fermé%', r);
  r := pg_temp.essai('fin_formateur', jsonb_build_object('lieu_id', L1, 'annee', y + 1), 1, pg_temp.rep_form('4'));
  perform pg_temp.cas('année suivante fermée', r like '%fermé%', r);
  r := pg_temp.essai('fin_formateur', jsonb_build_object('lieu_id', L1), 1, pg_temp.rep_form('4'));
  perform pg_temp.cas('portée de formateur sans année refusée', r like '%Portée%illisible%', r);
  perform pg_temp.qui('F2');
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('3'));
  perform pg_temp.cas('F2 répond pour le lieu 1', r = 'ok', r);
  perform pg_temp.qui('T');
  j := resultats_questionnaire('fin_formateur', pL1);
  perform pg_temp.cas('formateurs : à 2 réponses, résultats vides',
    j -> 'questions' = '{}'::jsonb and jsonb_typeof(j -> 'reponses') = 'null' and (j ->> 'seuil')::int = 3, j::text);
  select count(*) into n from commentaires_questionnaire('fin_formateur', pL1);
  perform pg_temp.cas('formateurs : à 2 réponses, aucun commentaire', n = 0, n::text);
  perform pg_temp.qui('F3');
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('2'));
  perform pg_temp.cas('F3 répond pour le lieu 1', r = 'ok', r);
  perform pg_temp.qui('T');
  j := resultats_questionnaire('fin_formateur', pL1);
  perform pg_temp.cas('formateurs : à 3 réponses, résultats présents',
    (j ->> 'reponses')::int = 3 and j #> '{questions,globalement}' = '{"4": 1, "3": 1, "2": 1}'::jsonb, j::text);
  select string_agg(x, '|') into t from commentaires_questionnaire('fin_formateur', pL1) x;
  perform pg_temp.cas('formateurs : à 3 réponses, le commentaire est rendu au fondateur', t = 'Salles trop petites', t);
  perform pg_temp.qui('F4');
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('3'));
  perform pg_temp.cas('un administrateur de l''équipe répond pour le lieu 1', r = 'ok', r);
  perform pg_temp.qui('A1');
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('3'));
  perform pg_temp.cas('stagiaire refusé au questionnaire des formateurs', r like '%ne te concerne pas%', r);
  perform pg_temp.qui('T');
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('3'));
  perform pg_temp.cas('fondateur à fiche stagiaire refusé au questionnaire des formateurs', r like '%ne te concerne pas%', r);
  r := pg_temp.tente(format('select public.ouvrir_questionnaire(%L, %L::jsonb, true)', 'fin_formateur', pL3));
  perform pg_temp.cas('le fondateur ouvre à la main le lieu 3 (sans promo)', r = 'ok', r);
  perform pg_temp.qui('F1');
  r := pg_temp.essai('fin_formateur', pL3, 1, pg_temp.rep_form('3'));
  perform pg_temp.cas('formateur sans accès à aucune promo du lieu refusé, même ouvert à la main', r like '%ne te concerne pas%', r);
  select count(*) into n from questionnaires_a_remplir() q where q.portee = pL3;
  perform pg_temp.cas('le lieu 3 ouvert à la main n''est pas proposé à F1', n = 0, n::text);

  -- Droits de lecture des résultats et des commentaires
  r := pg_temp.tente(format('select public.resultats_questionnaire(%L, %L::jsonb)', 'fin_formateur', pL1));
  perform pg_temp.cas('résultats refusés à un formateur', r like '%Réservé à la gestion%', r);
  r := pg_temp.tente(format('select public.commentaires_questionnaire(%L, %L::jsonb)', 'fin_formateur', pL1));
  perform pg_temp.cas('commentaires refusés à un formateur', r like '%Réservé à l''éditeur%', r);
  perform pg_temp.qui('F4');
  r := pg_temp.tente(format('select public.commentaires_questionnaire(%L, %L::jsonb)', 'fin_stagiaire', pP1));
  perform pg_temp.cas('commentaires refusés à un administrateur', r like '%Réservé à l''éditeur%', r);
  perform pg_temp.qui('A1');
  r := pg_temp.tente(format('select public.resultats_questionnaire(%L, %L::jsonb)', 'fin_stagiaire', pP1));
  perform pg_temp.cas('résultats refusés à un stagiaire', r like '%Réservé à la gestion%', r);
  r := pg_temp.tente(format('select public.commentaires_questionnaire(%L, %L::jsonb)', 'fin_stagiaire', pP1));
  perform pg_temp.cas('commentaires refusés à un stagiaire', r like '%Réservé à l''éditeur%', r);
  reset role;

  -- 11. Formateur d'un autre lieu, quand l'accès aux promos sera resserré (lot 4) : on resserre peut_acceder_promo
  -- pour l'équipe au seul lieu 2, le temps de deux cas, puis on remet la définition d'origine (l'empreinte finale le
  -- vérifie).
  v_acces_promo := pg_get_functiondef('public.peut_acceder_promo(integer)'::regprocedure);
  execute format($f$
    create or replace function public.peut_acceder_promo(p integer) returns boolean
    language sql stable security definer set search_path to 'public', 'pg_temp' as $c$
      select exists (select 1 from promos pr where pr.id = p and pr.lieu_id = %s)
         and exists (select 1 from user_profiles up
                      where lower(up.email) = lower((select auth.jwt() ->> 'email')) and up.role in ('prof', 'admin'));
    $c$ $f$, L2);
  set local role authenticated;
  perform pg_temp.qui('T');
  perform ouvrir_questionnaire('fin_formateur', pL2, true);
  perform pg_temp.qui('F5');
  r := pg_temp.essai('fin_formateur', pL1, 1, pg_temp.rep_form('3'));
  perform pg_temp.cas('formateur d''un autre lieu refusé (accès resserré au lieu 2)', r like '%ne te concerne pas%', r);
  r := pg_temp.essai('fin_formateur', pL2, 1, pg_temp.rep_form('3'));
  perform pg_temp.cas('le même formateur répond pour son lieu', r = 'ok', r);
  reset role;
  execute v_acces_promo;

  -- 12. Retour : la base revient à l'identique ---------------------------------------------------------------------
  if not v_deja then
    if btrim(coalesce(current_setting('preuve.retour', true), ''), E' \t\r\n') <> '' then
      execute current_setting('preuve.retour');
    end if;
    execute v_empreinte into md5_apres;
    perform pg_temp.cas('retour : empreinte du schéma et des données identique à celle d''avant la migration',
      md5_apres = md5_avant, md5_avant || ' / ' || md5_apres);
    select count(*) into n from pg_class where relnamespace = 'public'::regnamespace and relname like 'questionnaire%';
    select count(*) into m from pg_proc where pronamespace = 'public'::regnamespace
       and (proname like '%questionnaire%' or proname = 'peut_gerer_qualite');
    perform pg_temp.cas('retour : plus aucune table ni fonction des questionnaires', n = 0 and m = 0, n || '/' || m);
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
