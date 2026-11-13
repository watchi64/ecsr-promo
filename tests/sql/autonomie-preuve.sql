-- Preuve de la migration 20261114_autonomie_1_traces (e-learning, lot 1 : lecture et temps actif) : tables des traces,
-- règles de lecture, fonctions d'écriture, opposition, et leur retour.
-- Rejouable : tout se passe dans une transaction (begin sans commit) que le bloc final annule TOUJOURS en levant une
-- exception, qui porte le verdict (« VERT n/0 » ou « ROUGE ok/échecs : liste »). Données 100 % fictives (example.invalid,
-- prénoms « Preuve auto ») : personnages, lieu et promos sont créés par la preuve et partent avec l'annulation.
--
-- Méthode (comme tests/sql/conservation-preuve.sql) : la migration et son retour sont lus par psql (variables migration et
-- retour, chemins absolus) et joués PAR EXECUTE dans le bloc DO, entre deux empreintes du schéma public (relations et index,
-- colonnes, contraintes, fonctions et leurs droits, règles, déclencheurs). Les cas se jouent dans une sous-transaction
-- annulée (résultats recopiés avant l'annulation) ; le retour est ensuite joué sur la base « migration appliquée, aucune
-- trace », et l'empreinte comparée à celle d'avant. Si la migration est déjà appliquée (table cours_lectures présente), la
-- preuve joue les mêmes cas sans rejouer ni migration ni retour (preuve « en ligne »).
--
-- Jouée sur la base LOCALE jetable (outils/base_locale), jamais sur la production :
--   bash outils/base_locale/reconstruire.sh --port 55451
--   bash outils/base_locale/rejouer_suite.sh --port 55451 --titres 1,2,3
--   PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p 55451 -U postgres -d postgres -X -q \
--     -v migration=<chemin absolu de supabase/migrations/20261114_autonomie_1_traces.sql> \
--     -v retour=<chemin absolu de supabase/migrations/20261114_autonomie_1_traces_retour.sql> \
--     -f tests/sql/autonomie-preuve.sql
-- Contre-épreuve (avant la migration) : les mêmes variables vers un fichier vide : ROUGE attendu.
-- Preuve en ligne : appliquer d'abord la migration (psql -1 -f ...), puis jouer la preuve avec les mêmes variables (elles sont
-- lues mais ni la migration ni le retour ne sont rejoués).
--
-- Personnages (créés ici) : promo PA et promo PB d'un lieu de preuve.
--   SA  stagiaire de PA, conditions acceptées (version exigée par la base) : il lit les cours.
--   SB  stagiaire de PA, conditions acceptées : « un autre stagiaire de la promo » ; change ensuite de promo.
--   SC  stagiaire de PA, conditions acceptées dans une version plus ancienne seulement.
--   SD  stagiaire de PA, conditions acceptées : plafond de 8 h, puis fiche supprimée.
--   SO  stagiaire de PA, conditions acceptées : opposition.
--   SI  stagiaire de PA, conditions acceptées : lit un cours puis passe en abandon (non compté).
--   FOS fondateur qui a aussi une fiche de stagiaire dans PA (cas de Timy) ; EQ compte sans is_admin ni is_founder, rôle
--       « stagiaire », avec une fiche dans PA et une affectation de formateur sur PB (compte d'équipe avec fiche).
--   FA  formateur de PA ; FB formateur de PB seulement ; SG siège ; FO fondateur sans fiche.
-- Cours : cinq cours publiés pris par requête, réécrits pour la preuve (2 000 mots : plancher de lecture de 180 s) ; le
-- cinquième est dépublié. QCM : le premier par requête ; un identifiant inconnu au-delà du plus grand.
--
-- Résultats du 13/11/2026 (base locale, port 55451) :
--   - état de la production (suite rejouée, --titres 1,2,3) : fichiers vides ROUGE 6/2 ; migration et retour VERT 101/0 (deux
--     passages) ; migration appliquée à la main VERT 96/0 ; retour joué à la main sans erreur, puis refusé (rien à défaire) ;
--   - état le plus complet (--titres 1,2,3,4,5,6, puis 20261111_conservation_direction) : mêmes verdicts ;
--   - contre-épreuves, une garde retirée à la fois : compte d'équipe ROUGE 96/5 ; interrupteur dans la lecture ROUGE 96/5 ;
--     plafond de 8 h ROUGE 99/2 ; fin du cours ROUGE 98/3 ; droit d'appel donné à anon ROUGE 99/2 ; version des conditions
--     ROUGE 99/2 ; opposition ROUGE 100/1 ; stagiaires en abandon comptés ROUGE 100/1 ; retour incomplet ROUGE 99/2 ;
--   - preuve des rôles (mode en-ligne, matrice complétée des trois tables) : 11538/0 avant, 11976/0 après (titres 1,2,3) ;
--     11694/0 avant, 12132/0 après (état complet) ; règle sans interrupteur : ROUGE 11974/2.

select length(set_config('preuve.migration', pg_read_file(:'migration'), false)) as migration_lue,
       length(set_config('preuve.retour', pg_read_file(:'retour'), false)) as retour_lu;

begin;
set local lock_timeout = '3s';

create temp table preuve (num serial, libelle text, etat text, detail text);
create temp table preuve_comptes (nom text primary key, email text not null);

create function pg_temp.verifier(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into preuve (libelle, etat, detail)
  values (p_libelle, case when coalesce(p_ok, false) then 'ok' else 'échec' end, coalesce(p_detail, ''));
$f$;

-- Se connecter sous un personnage (nul : visiteur sans jeton), avec la promo affichée et un aperçu éventuels.
create function pg_temp.incarner(p_nom text, p_promo integer, p_apercu text default null)
returns void language plpgsql as $f$
declare v_email text;
begin
  select email into v_email from preuve_comptes where nom = p_nom;
  perform set_config('request.jwt.claims',
    case when v_email is null then '' else json_build_object('email', v_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    coalesce(jsonb_strip_nulls(jsonb_build_object('x-promo-id', p_promo::text, 'x-apercu-role', p_apercu))::text, ''), true);
  if v_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

create function pg_temp.proprio()
returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
end $f$;

-- Instruction jouée par un personnage. Une réussite est GARDÉE (la suite du scénario en dépend) ; un échec est annulé
-- (sous-transaction). Rend « OK <valeur> » ou « REFUS <code> <message> ».
create function pg_temp.essai(p_nom text, p_promo integer, p_sql text, p_apercu text default null)
returns text language plpgsql as $f$
declare v text;
begin
  begin
    perform pg_temp.incarner(p_nom, p_promo, p_apercu);
    execute p_sql into v;
    perform pg_temp.proprio();
    return 'OK ' || coalesce(v, '');
  exception when others then
    perform pg_temp.proprio();
    return 'REFUS ' || sqlstate || ' ' || sqlerrm;
  end;
end $f$;

-- Nombre rendu par une requête de comptage jouée par un personnage (-1 si elle échoue).
create function pg_temp.compter(p_nom text, p_promo integer, p_sql text)
returns bigint language plpgsql as $f$
declare n bigint;
begin
  begin
    perform pg_temp.incarner(p_nom, p_promo);
    execute p_sql into n;
    perform pg_temp.proprio();
    return n;
  exception when others then
    perform pg_temp.proprio();
    return -1;
  end;
end $f$;

do $preuve$
declare
  v_deja boolean := to_regclass('public.cours_lectures') is not null;
  v_empreinte constant text := $q$
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
      select 'fn ' || p.oid::regprocedure::text || ' ' || md5(replace(pg_get_functiondef(p.oid), chr(13), ''))
             || ' ' || coalesce(p.proacl::text, '')
        from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
      union all
      select 'pol ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || roles::text || ' ' || coalesce(qual, '') || ' '
             || coalesce(with_check, '')
        from pg_policies where schemaname = 'public'
      union all
      select 'trg ' || tgrelid::regclass::text || ' ' || tgname from pg_trigger t
        join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
    ) e(x) $q$;
  -- Les fonctions qui décident du sort des données d'un stagiaire (effacement sur demande et étapes de la conservation ;
  -- l'ancienne anonymisation si elle existe encore) : la migration ne doit pas les toucher.
  v_sort constant text := $q$
    select coalesce(md5(string_agg(p.oid::regprocedure::text || ' ' || md5(replace(pg_get_functiondef(p.oid), chr(13), ''))
                                   || ' ' || coalesce(p.proacl::text, ''), E'\n' order by p.oid::regprocedure::text)), 'aucune')
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like 'effacer%' or p.proname like '\_effacer%' or p.proname like '%anonymiser%') $q$;
  md5_avant text; md5_apres text; sort_avant text; sort_apres text;
  L integer; PA integer; PB integer; v_prof integer;
  SA integer; SB integer; SC integer; SD integer; SO integer; SI integer; SF integer; SQ integer;
  K1 uuid; K2 uuid; K3 uuid; K4 uuid; K5 uuid; Q1 bigint; Q_INCONNU bigint;
  v_version text; v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_mots constant text := btrim(repeat('mot ', 2000));
  r text; r2 text; n bigint; m bigint; t text; t2 text;
  v_sauve jsonb; v_erreur text; v_ok integer; v_ko integer; v_liste text;
begin
  -- 0. Empreintes et migration -----------------------------------------------------------------------------------------
  execute v_empreinte into md5_avant;
  execute v_sort into sort_avant;
  if not v_deja then
    begin
      if btrim(coalesce(current_setting('preuve.migration', true), ''), E' \t\r\n') <> '' then
        execute current_setting('preuve.migration');
      end if;
    exception when others then
      perform pg_temp.verifier('migration jouée sans erreur', false, sqlstate || ' ' || sqlerrm);
    end;
  end if;
  perform pg_temp.verifier('structure : les trois tables existent',
    to_regclass('public.cours_lectures') is not null and to_regclass('public.autonomie_temps') is not null
    and to_regclass('public.autonomie_oppositions') is not null);
  execute v_sort into sort_apres;
  perform pg_temp.verifier('la migration ne touche aucune fonction d''effacement ni d''anonymisation (md5 de pg_get_functiondef et droits)',
    sort_apres = sort_avant, sort_avant || ' / ' || sort_apres);

  -- 1. Les cas, dans une sous-transaction annulée ------------------------------------------------------------------
  begin
    -- 1.1 Droits ------------------------------------------------------------------------------------------------------
    perform pg_temp.verifier('RLS active sur les trois tables',
      (select count(*) from pg_class where oid in ('public.cours_lectures'::regclass, 'public.autonomie_temps'::regclass,
         'public.autonomie_oppositions'::regclass) and relrowsecurity) = 3);
    perform pg_temp.verifier('authenticated : lecture seule (select) des deux tables de traces, ni insert, ni update, ni delete, ni truncate',
      has_table_privilege('authenticated', 'public.cours_lectures', 'SELECT')
      and has_table_privilege('authenticated', 'public.autonomie_temps', 'SELECT')
      and not (has_table_privilege('authenticated', 'public.cours_lectures', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('authenticated', 'public.autonomie_temps', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')));
    perform pg_temp.verifier('autonomie_oppositions : aucun droit pour authenticated ni anon, aucune règle',
      not (has_table_privilege('authenticated', 'public.autonomie_oppositions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_table_privilege('anon', 'public.autonomie_oppositions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
      and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'autonomie_oppositions'));
    perform pg_temp.verifier('anon : aucun droit sur les deux tables de traces',
      not (has_table_privilege('anon', 'public.cours_lectures', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_table_privilege('anon', 'public.autonomie_temps', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')));
    perform pg_temp.verifier('règles : une seule par table de traces, en lecture (select) pour authenticated',
      (select string_agg(tablename || ':' || cmd || ':' || roles::text, ',' order by tablename)
         from pg_policies where schemaname = 'public' and tablename in ('cours_lectures', 'autonomie_temps'))
      = 'autonomie_temps:SELECT:{authenticated},cours_lectures:SELECT:{authenticated}',
      (select string_agg(tablename || ':' || policyname || ':' || cmd, ',') from pg_policies
        where schemaname = 'public' and tablename in ('cours_lectures', 'autonomie_temps')));
    select string_agg(x.f || '=' || has_function_privilege('authenticated', x.f, 'EXECUTE')::text
                      || has_function_privilege('anon', x.f, 'EXECUTE')::text, ',' order by x.f)
      into t
      from unnest(array['public.autonomie_tracer_cours(uuid,integer,boolean,text)', 'public.autonomie_tracer_qcm(bigint,integer)',
                        'public.autonomie_lectures_promo()', 'public.autonomie_opposer(integer)']) x(f);
    perform pg_temp.verifier('les quatre fonctions de l''app : authenticated oui, anon non',
      t = 'public.autonomie_lectures_promo()=truefalse,public.autonomie_opposer(integer)=truefalse,'
          'public.autonomie_tracer_cours(uuid,integer,boolean,text)=truefalse,public.autonomie_tracer_qcm(bigint,integer)=truefalse', t);
    select string_agg(p.oid::regprocedure::text, ',' order by p.proname) into t
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like '\_autonomie%'
       and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'));
    perform pg_temp.verifier('fonctions internes (_autonomie_*) : ni authenticated ni anon', t is null, t);
    select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like '\_autonomie%';
    perform pg_temp.verifier('fonctions internes présentes (au moins la version des conditions et le contrôle du compte)', n >= 2, n::text);
    select string_agg(p.oid::regprocedure::text, ',' order by p.proname) into t
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like '%autonomie%' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
    perform pg_temp.verifier('chaque fonction security definer de l''autonomie a un search_path fixé', t is null, t);
    perform pg_temp.verifier('version des conditions : une seule fonction interne, immuable, qui rend la sentinelle 9999-12-31',
      (select provolatile = 'i' from pg_proc where oid = to_regprocedure('public._autonomie_version_conditions()'))
      and public._autonomie_version_conditions() = '9999-12-31');
    select string_agg(p.proname, ',' order by p.proname) into t
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'autonomie\_tracer%'
       and position('9999-12-31' in pg_get_functiondef(p.oid)) > 0;
    perform pg_temp.verifier('aucune fonction d''écriture n''écrit la version en dur (elle passe par la fonction interne)', t is null, t);
    select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'autonomie\_tracer%';
    perform pg_temp.verifier('les deux fonctions d''écriture existent', n = 2, n::text);

    -- 1.2 Données fictives ------------------------------------------------------------------------------------------
    insert into lieux (nom) values ('Preuve autonomie') returning id into L;
    insert into promos (lieu_id, nom, date_debut, date_fin) values (L, 'Preuve auto A', v_jour - 30, v_jour + 200) returning id into PA;
    insert into promos (lieu_id, nom, date_debut, date_fin) values (L, 'Preuve auto B', v_jour - 30, v_jour + 200) returning id into PB;
    insert into profs (nom) values ('Preuve auto formateur') returning id into v_prof;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto A', 'PREUVE', PA, true) returning id into SA;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto B', 'PREUVE', PA, true) returning id into SB;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto C', 'PREUVE', PA, true) returning id into SC;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto D', 'PREUVE', PA, true) returning id into SD;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto O', 'PREUVE', PA, true) returning id into SO;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto I', 'PREUVE', PA, true) returning id into SI;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto F', 'PREUVE', PA, true) returning id into SF;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto Q', 'PREUVE', PA, true) returning id into SQ;
    insert into preuve_comptes (nom, email)
    select k, 'preuve.auto.' || lower(k) || '@example.invalid'
      from unnest(array['SA', 'SB', 'SC', 'SD', 'SO', 'SI', 'FOS', 'EQ', 'FA', 'FB', 'SG', 'FO']) k;
    insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id, prof_id)
    select k.email,
           case when k.nom in ('FA', 'FB', 'SG', 'FO') then 'prof' else 'stagiaire' end,
           k.nom in ('FA', 'FB', 'FOS', 'FO'), k.nom in ('FOS', 'FO'),
           case k.nom when 'SA' then SA when 'SB' then SB when 'SC' then SC when 'SD' then SD when 'SO' then SO
                      when 'SI' then SI when 'FOS' then SF when 'EQ' then SQ end,
           case when k.nom = 'FA' then v_prof end
      from preuve_comptes k;
    insert into affectations (email, role, promo_id, lieu_id)
    select k.email, v.role, v.promo, null::integer
      from (values ('FA', 'formateur', PA), ('FB', 'formateur', PB), ('EQ', 'formateur', PB), ('SG', 'siege', null::integer)) v(nom, role, promo)
      join preuve_comptes k on k.nom = v.nom;
    -- Conditions : la version exigée par la base pour tous, sauf SC (version d'aujourd'hui, plus ancienne).
    v_version := public._autonomie_version_conditions();
    insert into conditions_acceptations (email, version)
    select email, v_version from preuve_comptes where nom in ('SA', 'SB', 'SD', 'SO', 'SI', 'FOS', 'EQ', 'FA');
    insert into conditions_acceptations (email, version)
    select email, '2026-11-10' from preuve_comptes where nom = 'SC';
    -- Cours : cinq cours publiés, 2 000 mots chacun ; le cinquième est dépublié.
    select id into K1 from cours where published order by numero nulls last, id offset 0 limit 1;
    select id into K2 from cours where published order by numero nulls last, id offset 1 limit 1;
    select id into K3 from cours where published order by numero nulls last, id offset 2 limit 1;
    select id into K4 from cours where published order by numero nulls last, id offset 3 limit 1;
    select id into K5 from cours where published order by numero nulls last, id offset 4 limit 1;
    update cours set corps_md = v_mots where id in (K1, K2, K3, K4, K5);
    update cours set published = false where id = K5;
    select min(id) into Q1 from qcm;
    select coalesce(max(id), 0) + 1000 into Q_INCONNU from qcm;
    perform pg_temp.verifier('données : cinq cours publiés et un QCM trouvés',
      K5 is not null and Q1 is not null, coalesce(K5::text, 'K5 absent'));

    -- 1.3 Règle 1 : réservé aux stagiaires ---------------------------------------------------------------------------
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PA);
    r := pg_temp.essai('FA', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    perform pg_temp.verifier('règle 1 : formateur (tracer_cours) refusé', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    r := pg_temp.essai('FA', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('règle 1 : formateur (tracer_qcm) refusé', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    r := pg_temp.essai('SG', null, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    perform pg_temp.verifier('règle 1 : siège refusé', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    r := pg_temp.essai('FO', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    perform pg_temp.verifier('règle 1 : fondateur sans fiche refusé', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    r := pg_temp.essai(null, PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    perform pg_temp.verifier('règle 1 : visiteur sans jeton refusé (aucun droit d''appel)', r like 'REFUS 42501%', r);
    -- R3 : comptes d'équipe qui ont une fiche de stagiaire dans la promo affichée.
    r := pg_temp.essai('FOS', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    perform pg_temp.verifier('R3 : fondateur qui a une fiche de stagiaire refusé (tracer_cours)', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    r := pg_temp.essai('FOS', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('R3 : fondateur qui a une fiche de stagiaire refusé (tracer_qcm)', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    r := pg_temp.essai('FOS', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1), 'stagiaire');
    perform pg_temp.verifier('R3 : fondateur en aperçu stagiaire refusé', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    r := pg_temp.essai('EQ', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    perform pg_temp.verifier('R3 : compte « stagiaire » qui a une affectation (équipe) et une fiche refusé', r = 'REFUS P0001 autonomie: Réservé aux stagiaires.', r);
    perform pg_temp.verifier('R3 : aucune trace écrite par les comptes d''équipe',
      (select count(*) from cours_lectures where stagiaire_id in (SF, SQ)) + (select count(*) from autonomie_temps where stagiaire_id in (SF, SQ)) = 0);

    -- 1.4 Règle 2 : interrupteur de la promo -------------------------------------------------------------------------
    delete from settings where promo_id = PA and key = 'autonomie_active';
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 30, true, %L)::text', K1, 'Intro'));
    r2 := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('règle 2 : interrupteur absent, refus silencieux (faux, rien) et 0 ligne',
      r = 'OK false' and r2 = 'OK ' and (select count(*) from cours_lectures where stagiaire_id = SA) = 0
      and (select count(*) from autonomie_temps where stagiaire_id = SA) = 0, r || ' / ' || r2);
    insert into settings (key, value, promo_id) values ('autonomie_active', 'false', PA);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 30, true, %L)::text', K1, 'Intro'));
    perform pg_temp.verifier('règle 2 : interrupteur à « false », refus silencieux et 0 ligne',
      r = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = SA) = 0
      and (select count(*) from autonomie_temps where stagiaire_id = SA) = 0, r);
    -- Interrupteur allumé sur une AUTRE promo seulement : rien non plus.
    update settings set value = 'true', promo_id = PB where promo_id = PA and key = 'autonomie_active';
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 30, true, %L)::text', K1, 'Intro'));
    perform pg_temp.verifier('règle 2 : interrupteur allumé sur une autre promo seulement, 0 ligne',
      r = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = SA) = 0, r);
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PA);

    -- 1.5 Règle 3 : conditions acceptées dans la version exigée -----------------------------------------------------
    r := pg_temp.essai('SC', PA, format('select public.autonomie_tracer_cours(%L, 30, true, null)::text', K1));
    r2 := pg_temp.essai('SC', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('règle 3 (R1) : conditions acceptées dans une version plus ancienne (2026-11-10), refus silencieux et 0 ligne',
      r = 'OK false' and r2 = 'OK ' and (select count(*) from cours_lectures where stagiaire_id = SC) = 0
      and (select count(*) from autonomie_temps where stagiaire_id = SC) = 0, r || ' / ' || r2);
    delete from conditions_acceptations where lower(email) = (select email from preuve_comptes where nom = 'SC');
    r := pg_temp.essai('SC', PA, format('select public.autonomie_tracer_cours(%L, 30, true, null)::text', K1));
    perform pg_temp.verifier('règle 3 : aucune acceptation, refus silencieux et 0 ligne',
      r = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = SC) = 0
      and (select count(*) from autonomie_temps where stagiaire_id = SC) = 0, r);

    -- 1.6 Règle 4 : durée --------------------------------------------------------------------------------------------
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 61, false, null)::text', K1));
    perform pg_temp.verifier('règle 4 : 61 s refusées', r = 'REFUS P0001 autonomie: Durée invalide.', r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, -1, false, null)::text', K1));
    perform pg_temp.verifier('règle 4 : -1 s refusée', r = 'REFUS P0001 autonomie: Durée invalide.', r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 10000, true, null)::text', K1));
    perform pg_temp.verifier('règle 4 : 10 000 s d''un coup refusées', r = 'REFUS P0001 autonomie: Durée invalide.', r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, null, false, null)::text', K1));
    perform pg_temp.verifier('règle 4 : durée nulle (absente) refusée', r = 'REFUS P0001 autonomie: Durée invalide.', r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_qcm(%s, 61)::text', Q1));
    r2 := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_qcm(%s, -1)::text', Q1));
    perform pg_temp.verifier('règle 4 : tracer_qcm, 61 s et -1 s refusées',
      r = 'REFUS P0001 autonomie: Durée invalide.' and r2 = 'REFUS P0001 autonomie: Durée invalide.', r || ' / ' || r2);
    perform pg_temp.verifier('règle 4 : rien d''écrit par les appels refusés',
      (select count(*) from cours_lectures where stagiaire_id = SA) + (select count(*) from autonomie_temps where stagiaire_id = SA) = 0);

    -- 1.7 Règle 5 : ressource ----------------------------------------------------------------------------------------
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K5));
    perform pg_temp.verifier('règle 5 : cours non publié refusé', r = 'REFUS P0001 autonomie: Ressource introuvable.', r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', gen_random_uuid()));
    perform pg_temp.verifier('règle 5 : cours inconnu refusé', r = 'REFUS P0001 autonomie: Ressource introuvable.', r);
    r := pg_temp.essai('SA', PA, 'select public.autonomie_tracer_cours(null, 30, false, null)::text');
    perform pg_temp.verifier('règle 5 : cours nul refusé', r = 'REFUS P0001 autonomie: Ressource introuvable.', r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q_INCONNU));
    perform pg_temp.verifier('règle 5 : QCM inconnu refusé', r = 'REFUS P0001 autonomie: Ressource introuvable.', r);
    perform pg_temp.verifier('règle 5 : rien d''écrit par les appels refusés',
      (select count(*) from cours_lectures where stagiaire_id = SA) + (select count(*) from autonomie_temps where stagiaire_id = SA) = 0);

    -- 1.8 Règle 7 : lecture d'un cours (plancher de 180 s pour 2 000 mots) -------------------------------------------
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, false, %L)::text', K1, 'Partie 1'));
    perform pg_temp.verifier('règle 7 : premier appel, la ligne naît (ouvert_le = vu_le, fin non atteinte, non lu)',
      r = 'OK false' and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K1 and promo_id = PA
        and ouvert_le is not null and vu_le = ouvert_le and not fin_atteinte and lu_le is null and section = 'Partie 1'), r);
    -- ouvert_le reste celui du premier appel, vu_le avance (dates reculées en propriétaire pour les distinguer).
    update cours_lectures set ouvert_le = now() - interval '2 days', vu_le = now() - interval '1 day'
     where stagiaire_id = SA and cours_id = K1;
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K1));
    perform pg_temp.verifier('règle 7 : appel suivant, ouvert_le inchangé, vu_le à maintenant, section gardée (null ne l''efface pas)',
      r = 'OK false' and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K1
        and ouvert_le = now() - interval '2 days' and vu_le = now() and section = 'Partie 1'), r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, true, %L)::text', K1, 'Fin'));
    perform pg_temp.verifier('règle 7 : 3 appels de 60 s, p_fin au dernier : lu (vrai, lu_le posé)',
      r = 'OK true' and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K1
        and fin_atteinte and lu_le = now() and section = 'Fin'), r);
    perform pg_temp.verifier('règle 7 : temps du cours dans autonomie_temps (180 s, genre cours, ressource = identifiant, jour de Paris)',
      (select secondes from autonomie_temps where stagiaire_id = SA and jour = v_jour and genre = 'cours' and ressource = K1::text and promo_id = PA) = 180,
      (select string_agg(jour || ' ' || genre || ' ' || ressource || ' ' || secondes, ', ') from autonomie_temps where stagiaire_id = SA));
    r := '';
    for n in 1..3 loop
      r := r || pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K2)) || ';';
    end loop;
    perform pg_temp.verifier('règle 7 : 3 appels de 60 s sans p_fin : non lu',
      r = 'OK false;OK false;OK false;' and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K2
        and not fin_atteinte and lu_le is null), r);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, true, null)::text', K3));
    r2 := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K3));
    perform pg_temp.verifier('règle 7 : p_fin puis secondes insuffisantes (60 puis 120 s) : non lu ; fin_atteinte reste vrai après un appel sans p_fin',
      r = 'OK false' and r2 = 'OK false' and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K3
        and fin_atteinte and lu_le is null), r || ' / ' || r2);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K3));
    perform pg_temp.verifier('règle 7 : puis lu quand le plancher est atteint (180 s, sans p_fin à ce dernier appel)',
      r = 'OK true' and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K3 and lu_le is not null), r);
    -- Cours rallongé après lecture (10 000 mots : plancher de 900 s) : reste lu, lu_le inchangé.
    update cours_lectures set lu_le = now() - interval '1 hour' where stagiaire_id = SA and cours_id = K1;
    update cours set corps_md = btrim(repeat('mot ', 10000)) where id = K1;
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 0, false, null)::text', K1));
    perform pg_temp.verifier('règle 7 : cours rallongé après lecture, reste lu (vrai, lu_le inchangé)',
      r = 'OK true' and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K1
        and lu_le = now() - interval '1 hour'), r);
    -- Cours dépublié après lecture : ses traces restent ; le tracer de nouveau est refusé.
    update cours set published = false where id = K3;
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 10, false, null)::text', K3));
    perform pg_temp.verifier('cours dépublié après lecture : traces gardées, nouvel appel refusé (ressource introuvable)',
      r = 'REFUS P0001 autonomie: Ressource introuvable.'
      and exists (select 1 from cours_lectures where stagiaire_id = SA and cours_id = K3 and lu_le is not null)
      and (select secondes from autonomie_temps where stagiaire_id = SA and ressource = K3::text) = 180, r);
    update cours set published = true where id = K3;

    -- 1.9 Règle 6 : section tronquée -------------------------------------------------------------------------------
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 5, false, %L)::text', K2, repeat('é', 200)));
    perform pg_temp.verifier('règle 6 : section de 200 caractères tronquée à 80',
      r = 'OK false' and (select section from cours_lectures where stagiaire_id = SA and cours_id = K2) = repeat('é', 80), r);

    -- 1.10 QCM -----------------------------------------------------------------------------------------------------
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_qcm(%s, 45)::text', Q1));
    r2 := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_qcm(%s, 15)::text', Q1));
    perform pg_temp.verifier('tracer_qcm : 45 puis 15 s cumulées sur la ligne du jour (genre qcm, ressource = identifiant)',
      r = 'OK ' and r2 = 'OK ' and (select secondes from autonomie_temps where stagiaire_id = SA and jour = v_jour and genre = 'qcm'
        and ressource = Q1::text and promo_id = PA) = 60, r || ' / ' || r2);

    -- 1.11 Règle 4 : plafond de 8 h par jour --------------------------------------------------------------------------
    insert into autonomie_temps (stagiaire_id, promo_id, jour, genre, ressource, secondes)
    values (SD, PA, v_jour, 'qcm', Q1::text, 28770);
    r := pg_temp.essai('SD', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K4));
    r2 := pg_temp.essai('SD', PA, format('select public.autonomie_tracer_qcm(%s, 60)::text', Q1));
    perform pg_temp.verifier('règle 4 : plafond de 8 h, seules les 30 s restantes comptent, puis plus rien (cours et QCM)',
      r = 'OK false' and r2 = 'OK '
      and (select sum(secondes) from autonomie_temps where stagiaire_id = SD and jour = v_jour) = 28800
      and (select secondes from autonomie_temps where stagiaire_id = SD and ressource = K4::text) = 30,
      r || ' / ' || r2 || ' / ' || (select sum(secondes) from autonomie_temps where stagiaire_id = SD and jour = v_jour));
    perform pg_temp.verifier('règle 4 : au plafond, l''appel met encore à jour vu_le (la lecture continue d''être vue)',
      exists (select 1 from cours_lectures where stagiaire_id = SD and cours_id = K4));
    -- Le plafond est celui du jour : la veille ne compte pas.
    update autonomie_temps set jour = v_jour - 1 where stagiaire_id = SD and genre = 'qcm';
    r := pg_temp.essai('SD', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K4));
    perform pg_temp.verifier('règle 4 : le plafond est par jour (la veille pleine n''empêche pas aujourd''hui)',
      (select secondes from autonomie_temps where stagiaire_id = SD and jour = v_jour and ressource = K4::text) = 90, r);
    -- Le plafond ne compte que le temps du stagiaire lui-même : SD plein n'a rien retiré à SA.
    perform pg_temp.verifier('règle 4 : le plafond est par stagiaire (SD plein la veille, SA a écrit normalement)',
      (select sum(secondes) from autonomie_temps where stagiaire_id = SA and jour = v_jour) = 180 + 180 + 180 + 5 + 60);

    -- 1.12 Écriture directe refusée ------------------------------------------------------------------------------------
    r := pg_temp.essai('SA', PA, format('insert into public.cours_lectures (stagiaire_id, promo_id, cours_id, ouvert_le, vu_le, fin_atteinte) values (%s, %s, %L, now(), now(), true) returning 1', SA, PA, K4));
    perform pg_temp.verifier('stagiaire : insertion directe refusée (42501)', r like 'REFUS 42501%', r);
    r := pg_temp.essai('SA', PA, format('update public.autonomie_temps set secondes = 1 where stagiaire_id = %s returning 1', SA));
    perform pg_temp.verifier('stagiaire : modification directe refusée (42501)', r like 'REFUS 42501%', r);
    r := pg_temp.essai('SA', PA, format('delete from public.cours_lectures where stagiaire_id = %s returning 1', SA));
    perform pg_temp.verifier('stagiaire : suppression directe refusée (42501)', r like 'REFUS 42501%', r);
    r := pg_temp.essai('FA', PA, format('delete from public.autonomie_temps where stagiaire_id = %s returning 1', SA));
    perform pg_temp.verifier('formateur : suppression directe refusée (42501)', r like 'REFUS 42501%', r);

    -- 1.13 Lectures (règles RLS) -------------------------------------------------------------------------------------
    n := pg_temp.compter('SA', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA));
    m := pg_temp.compter('SA', PA, format('select count(*) from public.autonomie_temps where stagiaire_id = %s', SA));
    perform pg_temp.verifier('le stagiaire lit ses lignes (3 cours, 4 lignes de temps)', n = 3 and m = 4, n || '/' || m);
    n := pg_temp.compter('SA', PA, format('select count(*) from public.cours_lectures where stagiaire_id <> %s', SA))
       + pg_temp.compter('SA', PA, format('select count(*) from public.autonomie_temps where stagiaire_id <> %s', SA));
    perform pg_temp.verifier('le stagiaire ne lit aucune ligne des autres (SD a des lignes)', n = 0, n::text);
    n := pg_temp.compter('SB', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA))
       + pg_temp.compter('SB', PA, format('select count(*) from public.autonomie_temps where stagiaire_id = %s', SA));
    perform pg_temp.verifier('un autre stagiaire de la promo ne lit pas ces lignes', n = 0, n::text);
    n := pg_temp.compter('FA', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA));
    m := pg_temp.compter('FA', PA, format('select count(*) from public.autonomie_temps where stagiaire_id = %s', SA));
    perform pg_temp.verifier('le formateur de la promo les lit (3 et 4)', n = 3 and m = 4, n || '/' || m);
    n := pg_temp.compter('FA', PB, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA));
    perform pg_temp.verifier('le formateur de la promo, une autre promo affichée : rien', n = 0, n::text);
    n := pg_temp.compter('FB', PA, 'select count(*) from public.cours_lectures') + pg_temp.compter('FB', PA, 'select count(*) from public.autonomie_temps')
       + pg_temp.compter('FB', PB, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA))
       + pg_temp.compter('FB', PB, format('select count(*) from public.autonomie_temps where stagiaire_id = %s', SA));
    perform pg_temp.verifier('un formateur d''une autre promo ne les lit pas (promo de la trace ou la sienne affichée)', n = 0, n::text);
    n := pg_temp.compter('SG', null, 'select count(*) from public.cours_lectures') + pg_temp.compter('SG', null, 'select count(*) from public.autonomie_temps')
       + pg_temp.compter('SG', PA, 'select count(*) from public.cours_lectures') + pg_temp.compter('SG', PA, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('le siège ne lit rien (sans promo, ou la promo de la trace affichée)', n = 0, n::text);
    n := pg_temp.compter(null, PA, 'select count(*) from public.cours_lectures');
    perform pg_temp.verifier('visiteur sans jeton : lecture refusée', n = -1, n::text);
    n := pg_temp.compter('FO', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA));
    perform pg_temp.verifier('le fondateur (sans fiche) lit les lignes de la promo affichée', n = 3, n::text);
    -- Interrupteur éteint : le stagiaire ne lit plus rien, l'équipe toujours, les lignes restent ; rallumé, il les relit.
    update settings set value = 'false' where promo_id = PA and key = 'autonomie_active';
    n := pg_temp.compter('SA', PA, 'select count(*) from public.cours_lectures') + pg_temp.compter('SA', PA, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('interrupteur éteint : le stagiaire ne lit aucune de ses lignes', n = 0, n::text);
    n := pg_temp.compter('FA', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA));
    perform pg_temp.verifier('interrupteur éteint : l''équipe (notes.lire) les lit toujours', n = 3, n::text);
    perform pg_temp.verifier('interrupteur éteint : les lignes restent en base',
      (select count(*) from cours_lectures where stagiaire_id = SA) = 3 and (select count(*) from autonomie_temps where stagiaire_id = SA) = 4);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K2));
    perform pg_temp.verifier('interrupteur éteint : plus rien n''est écrit', r = 'OK false'
      and (select secondes from autonomie_temps where stagiaire_id = SA and ressource = K2::text) = 185, r);
    delete from settings where promo_id = PA and key = 'autonomie_active';
    n := pg_temp.compter('SA', PA, 'select count(*) from public.cours_lectures');
    perform pg_temp.verifier('interrupteur retiré (ligne absente) : le stagiaire ne lit rien', n = 0, n::text);
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PA);
    n := pg_temp.compter('SA', PA, 'select count(*) from public.cours_lectures');
    m := pg_temp.compter('SA', PA, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('interrupteur rallumé : le stagiaire relit ses lignes', n = 3 and m = 4, n || '/' || m);

    -- 1.14 autonomie_lectures_promo -----------------------------------------------------------------------------------
    -- SI lit K1 jusqu'au bout puis passe en abandon : sa lecture ne compte plus.
    r := '';
    for n in 1..3 loop
      r := r || pg_temp.essai('SI', PA, format('select public.autonomie_tracer_cours(%L, 60, true, null)::text', K2)) || ';';
    end loop;
    perform pg_temp.verifier('données : SI a lu le cours K2', r = 'OK false;OK false;OK true;', r);
    update stagiaires set actif = false where id = SI;
    r := pg_temp.essai('FA', PA, 'select coalesce(jsonb_agg(to_jsonb(l) order by l.cours_id), ''[]'')::text from public.autonomie_lectures_promo() l');
    t := case when r like 'OK %' then substr(r, 4) end;
    perform pg_temp.verifier('autonomie_lectures_promo (formateur) : K1 compte 1, K3 compte 1, K2 rien (SI en abandon, SA non lu)',
      t is not null
      and (select (e ->> 'lus')::integer from jsonb_array_elements(t::jsonb) e where e ->> 'cours_id' = K1::text) = 1
      and (select (e ->> 'lus')::integer from jsonb_array_elements(t::jsonb) e where e ->> 'cours_id' = K3::text) = 1
      and not exists (select 1 from jsonb_array_elements(t::jsonb) e where e ->> 'cours_id' = K2::text)
      and jsonb_array_length(t::jsonb) = 2, r);
    r := pg_temp.essai('FA', PB, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('autonomie_lectures_promo : une autre promo affichée ne compte pas ces lectures', r = 'OK 0', r);
    r := pg_temp.essai('SA', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('autonomie_lectures_promo : stagiaire, aucune ligne (pas d''erreur)', r = 'OK 0', r);
    r := pg_temp.essai('SG', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    r2 := pg_temp.essai('SG', null, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('autonomie_lectures_promo : siège, aucune ligne', r = 'OK 0' and r2 = 'OK 0', r || ' / ' || r2);
    r := pg_temp.essai('FB', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('autonomie_lectures_promo : formateur d''une autre promo, aucune ligne', r = 'OK 0', r);
    r := pg_temp.essai('FA', PA, 'select count(*)::text from public.autonomie_lectures_promo()', 'stagiaire');
    perform pg_temp.verifier('autonomie_lectures_promo : aperçu stagiaire, aucune ligne', r = 'OK 0', r);

    -- 1.15 Règle 3 bis : opposition ----------------------------------------------------------------------------------
    r := pg_temp.essai('SO', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K1));
    r2 := pg_temp.essai('SO', PA, format('select public.autonomie_tracer_qcm(%s, 20)::text', Q1));
    perform pg_temp.verifier('données : SO a des traces avant son opposition',
      (select count(*) from cours_lectures where stagiaire_id = SO) = 1 and (select count(*) from autonomie_temps where stagiaire_id = SO) = 2,
      r || ' / ' || r2);
    r := pg_temp.essai('FA', PA, format('select public.autonomie_opposer(%s)::text', SO));
    perform pg_temp.verifier('opposition : un formateur ne peut pas appeler autonomie_opposer', r = 'REFUS P0001 autonomie: Réservé au fondateur.', r);
    r := pg_temp.essai('SO', PA, format('select public.autonomie_opposer(%s)::text', SO));
    perform pg_temp.verifier('opposition : le stagiaire ne peut pas l''appeler lui-même', r = 'REFUS P0001 autonomie: Réservé au fondateur.', r);
    r := pg_temp.essai('FO', PA, format('select public.autonomie_opposer(%s)::text', SO), 'formateur');
    perform pg_temp.verifier('opposition : le fondateur en aperçu formateur ne peut pas l''appeler', r = 'REFUS P0001 autonomie: Réservé au fondateur.', r);
    r := pg_temp.essai('FO', PA, 'select public.autonomie_opposer(-1)::text');
    perform pg_temp.verifier('opposition : fiche inconnue refusée', r = 'REFUS P0001 autonomie: Fiche introuvable.', r);
    perform pg_temp.verifier('opposition : rien d''effacé par les appels refusés',
      (select count(*) from cours_lectures where stagiaire_id = SO) = 1 and not exists (select 1 from autonomie_oppositions where stagiaire_id = SO));
    r := pg_temp.essai('FO', PA, format('select public.autonomie_opposer(%s)::text', SO));
    perform pg_temp.verifier('opposition : le fondateur inscrit SO et ses traces sont effacées (0 ligne dans les deux tables)',
      r = 'OK ' and exists (select 1 from autonomie_oppositions where stagiaire_id = SO and depuis is not null)
      and (select count(*) from cours_lectures where stagiaire_id = SO) = 0 and (select count(*) from autonomie_temps where stagiaire_id = SO) = 0, r);
    r := pg_temp.essai('SO', PA, format('select public.autonomie_tracer_cours(%L, 60, true, null)::text', K1));
    r2 := pg_temp.essai('SO', PA, format('select public.autonomie_tracer_qcm(%s, 20)::text', Q1));
    perform pg_temp.verifier('opposition : ensuite, refus silencieux et 0 ligne nouvelle',
      r = 'OK false' and r2 = 'OK ' and (select count(*) from cours_lectures where stagiaire_id = SO) = 0
      and (select count(*) from autonomie_temps where stagiaire_id = SO) = 0, r || ' / ' || r2);
    r := pg_temp.essai('FO', PA, format('select public.autonomie_opposer(%s)::text', SO));
    perform pg_temp.verifier('opposition : un second appel ne change rien (date d''opposition gardée)', r = 'OK '
      and (select count(*) from autonomie_oppositions where stagiaire_id = SO) = 1, r);
    perform pg_temp.verifier('opposition : les traces des autres stagiaires sont intactes',
      (select count(*) from cours_lectures where stagiaire_id = SA) = 3);

    -- 1.16 R2 : les traces suivent le sort des tentatives de QCM -------------------------------------------------------
    -- Changement de promo (aucun mécanisme ne déplace les lignes d'un stagiaire : elles gardent la promo où elles ont été
    -- écrites, comme qcm_attempts).
    r := pg_temp.essai('SB', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (Q1, SB, 'entrainement', 5, 10, 10);
    update stagiaires set promo_id = PB where id = SB;
    perform pg_temp.verifier('R2, changement de promo : les traces gardent leur promo, comme les tentatives de QCM',
      (select promo_id from qcm_attempts where stagiaire_id = SB) = PA
      and (select promo_id from cours_lectures where stagiaire_id = SB) = PA
      and (select promo_id from autonomie_temps where stagiaire_id = SB) = PA, r);
    -- Fiche supprimée : clé étrangère « on delete cascade », comme qcm_attempts.
    insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (Q1, SD, 'entrainement', 5, 10, 10);
    delete from user_profiles where stagiaire_id = SD;
    delete from stagiaires where id = SD;
    perform pg_temp.verifier('R2, fiche supprimée : 0 ligne restante dans les deux tables, comme qcm_attempts',
      (select count(*) from qcm_attempts where stagiaire_id = SD) = 0
      and (select count(*) from cours_lectures where stagiaire_id = SD) = 0
      and (select count(*) from autonomie_temps where stagiaire_id = SD) = 0);
    perform pg_temp.verifier('R2 : les clés étrangères des trois tables vers stagiaires sont « on delete cascade », comme qcm_attempts',
      (select string_agg(conrelid::regclass::text || ':' || confdeltype::text, ',' order by conrelid::regclass::text)
         from pg_constraint where contype = 'f' and confrelid = 'public.stagiaires'::regclass
          and conrelid in ('public.cours_lectures'::regclass, 'public.autonomie_temps'::regclass,
                           'public.autonomie_oppositions'::regclass, 'public.qcm_attempts'::regclass))
      = 'autonomie_oppositions:c,autonomie_temps:c,cours_lectures:c,qcm_attempts:c');
    -- Effacement sur demande (conservation) : les tentatives de QCM restent, rattachées à la fiche sans nom ; les traces
    -- aussi, ni plus ni moins.
    insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (Q1, SA, 'entrainement', 5, 10, 10);
    select count(*) into n from qcm_attempts where stagiaire_id = SA;
    t := (select count(*) from cours_lectures where stagiaire_id = SA) || '/' || (select count(*) from autonomie_temps where stagiaire_id = SA);
    if to_regprocedure('public.effacer_sur_demande(integer)') is not null then
      r := pg_temp.essai('FO', PA, format('select public.effacer_sur_demande(%s)::text', SA));
      t2 := (select count(*) from cours_lectures where stagiaire_id = SA) || '/' || (select count(*) from autonomie_temps where stagiaire_id = SA);
      perform pg_temp.verifier('R2, effacement sur demande : fiche effacée, tentatives de QCM et traces gardées à l''identique',
        r like 'OK {%' and exists (select 1 from stagiaires where id = SA and anonymise_le is not null)
        and (select count(*) from qcm_attempts where stagiaire_id = SA) = n and n > 0 and t2 = t and t = '3/4',
        r || ' ; qcm ' || n || ' ; traces ' || t || ' -> ' || t2);
    else
      perform pg_temp.verifier('R2, effacement sur demande : effacer_sur_demande(integer) présente (conservation Q5)', false, 'absente');
    end if;

    select coalesce(jsonb_agg(to_jsonb(p) order by p.num), '[]'::jsonb) into v_sauve from preuve p;
    raise exception 'preuve: annulé';
  exception when others then
    if sqlerrm <> 'preuve: annulé' then
      v_erreur := sqlstate || ' ' || sqlerrm;
    end if;
  end;
  perform pg_temp.proprio();
  if v_sauve is not null then
    delete from preuve;
    insert into preuve select * from jsonb_populate_recordset(null::preuve, v_sauve);
  end if;
  if v_erreur is not null then
    perform pg_temp.verifier('structure : les cas se jouent sans erreur imprévue', false, v_erreur);
  end if;

  -- 2. Retour ------------------------------------------------------------------------------------------------------
  if not v_deja then
    r := 'joué';
    begin
      if btrim(coalesce(current_setting('preuve.retour', true), ''), E' \t\r\n') <> '' then
        execute current_setting('preuve.retour');
      end if;
    exception when others then
      r := sqlstate || ' ' || sqlerrm;
    end;
    perform pg_temp.verifier('retour joué sans erreur', r = 'joué', r);
    perform pg_temp.verifier('retour : les trois tables sont parties',
      to_regclass('public.cours_lectures') is null and to_regclass('public.autonomie_temps') is null
      and to_regclass('public.autonomie_oppositions') is null);
    select string_agg(p.oid::regprocedure::text, ',') into t from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname like '%autonomie%';
    perform pg_temp.verifier('retour : plus aucune fonction de l''autonomie', t is null, t);
    execute v_sort into sort_apres;
    perform pg_temp.verifier('retour : fonctions d''effacement et d''anonymisation identiques à avant (md5 de pg_get_functiondef)',
      sort_apres = sort_avant, sort_avant || ' / ' || sort_apres);
    execute v_empreinte into md5_apres;
    perform pg_temp.verifier('retour : empreinte du schéma public (droits compris) identique à celle d''avant la migration',
      md5_apres = md5_avant, md5_avant || ' / ' || md5_apres);
  end if;

  -- Verdict ----------------------------------------------------------------------------------------------------------
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat <> 'ok'),
         string_agg(case when etat <> 'ok' then num || '. ' || libelle || ' [' || detail || ']' end, ' | ' order by num)
    into v_ok, v_ko, v_liste from preuve;
  if v_ko = 0 then
    raise exception using message = format('VERT %s/0%s', v_ok, case when v_deja then ' (migration déjà appliquée : en ligne)' else '' end);
  end if;
  raise exception using message = format('ROUGE %s/%s : %s', v_ok, v_ko, v_liste);
end $preuve$;
