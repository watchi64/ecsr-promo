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
-- lues mais ni la migration ni le retour ne sont rejoués). Elle est aussi VERTE après la seconde migration
-- (20261114_autonomie_2_version, version datée) : la version en place doit être la sentinelle ou une version bien formée qui
-- n'est pas après aujourd'hui ; les cas de la sentinelle la remettent dans la transaction annulée. La seconde migration a sa
-- propre preuve : tests/sql/autonomie-version-preuve.sql.
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
-- Suite (A : interrupteur réservé au fondateur ; B : traces effacées à l'étape 1 de la conservation), même jour, mêmes états :
--   - fichiers vides ROUGE 7/2 ; migration et retour VERT 120/0 (deux passages par état) ; appliquée VERT 114/0 ;
--   - contre-épreuves : règle d'ajout ouverte ROUGE 118/2 ; règle de modification sans using ROUGE 115/5, sans with check
--     ROUGE 119/1 ; règle de suppression ouverte ROUGE 116/4 ; déclencheur vide ROUGE 117/3 ; garde efface_le retirée
--     ROUGE 119/1 ; retour sans le déclencheur ROUGE 117/3 ;
--   - preuve des rôles : 11538/0 avant, 11976/0 après (1,2,3) ; 11694/0 avant, 12132/0 après (état complet) ; suppression de
--     l'interrupteur rouverte : ROUGE 11973/3 ;
--   - preuve de la conservation (base où la conservation est appliquée) : VERT 227/0 avant et après la migration, deux états.
-- Tour de correction 1 (verrou avant les contrôles, traces par promo, version des conditions fermée), mêmes états :
--   - fichiers vides ROUGE 7/2 ; migration et retour VERT 134/0 (deux passages par état) ; appliquée VERT 128/0 ;
--   - contre-épreuves : plancher compté toutes promos ROUGE 133/1 ; lectures de la promo par promo du stagiaire ROUGE 133/1 ;
--     version d'avant le tour (dc8f22ad) ROUGE 113/21 ; sentinelle et borne « pas dans l'avenir » retirées ROUGE 120/14 ;
--     sentinelle seule ROUGE 133/1 (contrôle de texte : la borne suffit tant que l'horloge est juste) ; borne seule ROUGE 132/2 ;
--   - rôles 11538/0 puis 11976/0 (1,2,3), 11694/0 puis 12132/0 (complet) ; conservation 227/0 avant et après ;
--   - ordre des verrous entre deux sessions : tests/sql/autonomie-concurrence.sh, VERT 8/0 (deux états) ; version d'avant le
--     tour : ROUGE 6/2 (traces écrites après l'opposition et après l'effacement).
-- Tour 1 bis (le compteur de lecteurs ne compte que les stagiaires actifs de la promo, aujourd'hui) : migration et retour VERT
--   136/0 (deux passages par état), appliquée VERT 130/0, concurrence VERT 8/0 ; lecteurs partis comptés : ROUGE 134/2.
-- La sentinelle livrée est contrôlée d'abord ; puis, dans la transaction seulement, la version exigée est datée d'hier
-- (calculé). accepter_conditions, absente des clones de la base locale, est posée par la preuve si elle manque (mot pour mot).
-- Personnages de la suite : SX (PA, fiche marquée effacée en gardant son compte), SE et SE2 (promo PE finie depuis plus de
-- 12 mois : traces, opposition).
-- Vague de correction de la relecture d'ensemble (13/11/2026) : interrupteurs posés avant la migration supprimés par elle et
-- par le retour ; interrupteur éteint, PERSONNE ne lit par l'API (équipe comprise, compteur de la promo compris), relu tel quel
-- une fois rallumé ; version comparée entière (SV : acceptation sans la lettre exigée, acceptation mal formée) ; opposition
-- par les fonctions internes du propriétaire (_autonomie_opposer, _autonomie_lever_opposition), fermées à tout rôle de l'API.
-- Verdicts : voir le rapport .superpowers/sdd/2026-11-12-e-learning-lot-1-lecture-temps-actif/final-fix-report.md.

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

-- Acceptation posée directement dans la table, par le propriétaire (« OK <date> », comme l'aurait rendu
-- accepter_conditions). Depuis 20261114_restes_1_conditions, l'API n'enregistre plus que la version publiée : une acceptation
-- d'une autre version ne peut venir que d'une écriture directe. La défense de l'autonomie (sentinelle, version comparée
-- entière, pas dans l'avenir) se prouve donc sur des lignes posées ainsi, quelle que soit la version de accepter_conditions.
create function pg_temp.accepter_en_base(p_nom text, p_version text)
returns text language plpgsql as $f$
declare v timestamptz;
begin
  insert into conditions_acceptations (email, version)
  select email, p_version from preuve_comptes where nom = p_nom
  on conflict (email, version) do nothing;
  select ca.accepted_at into v from conditions_acceptations ca join preuve_comptes k on lower(ca.email) = k.email
   where k.nom = p_nom and ca.version = p_version;
  return 'OK ' || coalesce(v::text, '');
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
  L integer; PA integer; PB integer; PE integer; v_prof integer;
  SA integer; SB integer; SC integer; SD integer; SO integer; SI integer; SF integer; SQ integer; SX integer; SE integer; SE2 integer;
  SV integer; v_promo_ex integer; v_avant text; v_apres text;
  K1 uuid; K2 uuid; K3 uuid; K4 uuid; K5 uuid; Q1 bigint; Q_INCONNU bigint;
  v_version text; v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_mots constant text := btrim(repeat('mot ', 2000));
  r text; r2 text; r3 text; n bigint; m bigint; t text; t2 text;
  v_sauve jsonb; v_erreur text; v_ok integer; v_ko integer; v_liste text;
begin
  -- 0. Empreintes et migration -----------------------------------------------------------------------------------------
  execute v_empreinte into md5_avant;
  execute v_sort into sort_avant;
  if not v_deja then
    -- Un interrupteur posé avant la migration (par un compte qui avait reglages.modifier) : la migration le supprime.
    select min(id) into v_promo_ex from promos;
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', v_promo_ex)
      on conflict (promo_id, key) do update set value = excluded.value;
    begin
      if btrim(coalesce(current_setting('preuve.migration', true), ''), E' \t\r\n') <> '' then
        execute current_setting('preuve.migration');
      end if;
    exception when others then
      perform pg_temp.verifier('migration jouée sans erreur', false, sqlstate || ' ' || sqlerrm);
    end;
    perform pg_temp.verifier('migration : les interrupteurs posés avant elle sont supprimés (chaque promo repart éteinte)',
      v_promo_ex is not null and not exists (select 1 from settings where key = 'autonomie_active'),
      coalesce((select string_agg(promo_id || '=' || value, ',') from settings where key = 'autonomie_active'), 'aucun'));
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
    -- Migration 1 seule : la sentinelle ; migration 2 appliquée : une version bien formée, pas après aujourd'hui (Paris).
    t := public._autonomie_version_conditions();
    perform pg_temp.verifier('version des conditions : une seule fonction interne, immuable, qui rend la sentinelle 9999-12-31 ou une version bien formée qui n''est pas après aujourd''hui (migration 2)',
      (select provolatile = 'i' from pg_proc where oid = to_regprocedure('public._autonomie_version_conditions()'))
      and (t = '9999-12-31'
           or (t ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$' and left(t, 10) collate "C" <= to_char(v_jour, 'YYYY-MM-DD') collate "C")), t);
    select string_agg(x.fn || ':' || y.rl, ',' order by x.fn, y.rl) into t
      from unnest(array['public._autonomie_opposer(integer)', 'public._autonomie_lever_opposition(integer)']) x(fn)
      cross join unnest(array['anon', 'authenticated', 'service_role']) y(rl)
     where case when to_regprocedure(x.fn) is null then true else has_function_privilege(y.rl, to_regprocedure(x.fn), 'EXECUTE') end;
    perform pg_temp.verifier('opposition : _autonomie_opposer et _autonomie_lever_opposition présentes, aucun rôle de l''API (anon, authenticated, service_role) ne peut les appeler',
      t is null, t);
    -- La fermeture dure ne se voit pas par le comportement tant que l'horloge est juste (la borne « pas dans l'avenir » refuse
    -- déjà une acceptation de 9999-12-31) : contrôle de texte.
    perform pg_temp.verifier('R11 : _autonomie_permis refuse tout tant que la version est la sentinelle (garde écrite en tête)',
      position('_autonomie_version_conditions() <> ''9999-12-31''' in pg_get_functiondef('public._autonomie_permis(integer,integer)'::regprocedure)) > 0);
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
    -- PE : finie depuis plus de 12 mois (étape 1 de la conservation possible).
    insert into promos (lieu_id, nom, date_debut, date_fin) values (L, 'Preuve auto E', v_jour - 700, v_jour - 400) returning id into PE;
    insert into profs (nom) values ('Preuve auto formateur') returning id into v_prof;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto A', 'PREUVE', PA, true) returning id into SA;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto B', 'PREUVE', PA, true) returning id into SB;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto C', 'PREUVE', PA, true) returning id into SC;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto D', 'PREUVE', PA, true) returning id into SD;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto O', 'PREUVE', PA, true) returning id into SO;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto I', 'PREUVE', PA, true) returning id into SI;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto F', 'PREUVE', PA, true) returning id into SF;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto Q', 'PREUVE', PA, true) returning id into SQ;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto X', 'PREUVE', PA, true) returning id into SX;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto E', 'PREUVE', PE, true) returning id into SE;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto E2', 'PREUVE', PE, true) returning id into SE2;
    insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve auto V', 'PREUVE', PA, true) returning id into SV;
    insert into preuve_comptes (nom, email)
    select k, 'preuve.auto.' || lower(k) || '@example.invalid'
      from unnest(array['SA', 'SB', 'SC', 'SD', 'SO', 'SI', 'SX', 'EE', 'FOS', 'EQ', 'FA', 'FB', 'SG', 'FO', 'SV']) k;
    insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id, prof_id)
    select k.email,
           case when k.nom in ('FA', 'FB', 'SG', 'FO') then 'prof' else 'stagiaire' end,
           k.nom in ('FA', 'FB', 'FOS', 'FO'), k.nom in ('FOS', 'FO'),
           case k.nom when 'SA' then SA when 'SB' then SB when 'SC' then SC when 'SD' then SD when 'SO' then SO
                      when 'SI' then SI when 'SX' then SX when 'EE' then SE when 'FOS' then SF when 'EQ' then SQ
                      when 'SV' then SV end,
           case when k.nom = 'FA' then v_prof end
      from preuve_comptes k;
    insert into affectations (email, role, promo_id, lieu_id)
    select k.email, v.role, v.promo, null::integer
      from (values ('FA', 'formateur', PA), ('FB', 'formateur', PB), ('EQ', 'formateur', PB), ('SG', 'siege', null::integer)) v(nom, role, promo)
      join preuve_comptes k on k.nom = v.nom;
    -- Conditions : la version que la preuve datera plus bas (hier, calculé : la preuve reste rejouable) pour tous, sauf SC
    -- (2026-11-10, plus ancienne). Tant que la migration garde sa sentinelle, ces acceptations ne comptent pas.
    v_version := to_char(v_jour - 1, 'YYYY-MM-DD');
    insert into conditions_acceptations (email, version)
    select email, v_version from preuve_comptes where nom in ('SA', 'SB', 'SD', 'SO', 'SI', 'SX', 'EE', 'FOS', 'EQ', 'FA', 'SV');
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

    -- 1.2 bis Interrupteur réservé au fondateur (règles restrictives sur settings) ----------------------------------
    perform pg_temp.verifier('interrupteur : trois règles restrictives sur settings (insert, update, delete), pour public comme la règle permissive, aucune en lecture',
      (select string_agg(cmd || ':' || permissive || ':' || roles::text, ',' order by cmd) from pg_policies
        where schemaname = 'public' and tablename = 'settings' and policyname like 'settings\_autonomie%')
      = 'DELETE:RESTRICTIVE:{public},INSERT:RESTRICTIVE:{public},UPDATE:RESTRICTIVE:{public}',
      (select string_agg(policyname || ':' || cmd || ':' || permissive, ',') from pg_policies
        where schemaname = 'public' and tablename = 'settings' and policyname like 'settings\_autonomie%'));
    perform pg_temp.verifier('interrupteur : RLS de settings non forcée (le propriétaire n''est pas concerné)',
      not (select relforcerowsecurity from pg_class where oid = 'public.settings'::regclass));
    r := pg_temp.essai('FA', PA, format('insert into public.settings (key, value, promo_id) values (''autonomie_active'', ''true'', %s) returning value', PA));
    perform pg_temp.verifier('interrupteur : le formateur ne crée pas la clé (42501)',
      r like 'REFUS 42501%' and not exists (select 1 from settings where promo_id = PA and key = 'autonomie_active'), r);
    insert into settings (key, value, promo_id) values ('autonomie_active', 'false', PA), ('preuve_auto_cle', 'avant', PA)
      on conflict (promo_id, key) do update set value = excluded.value;
    r := pg_temp.essai('FA', PA, format('update public.settings set value = ''true'' where promo_id = %s and key = ''autonomie_active'' returning value', PA));
    perform pg_temp.verifier('interrupteur : le formateur ne l''allume pas (aucune ligne modifiée)',
      r = 'OK ' and (select value from settings where promo_id = PA and key = 'autonomie_active') = 'false', r);
    update settings set value = 'true' where promo_id = PA and key = 'autonomie_active';
    r := pg_temp.essai('FA', PA, format('update public.settings set value = ''false'' where promo_id = %s and key = ''autonomie_active'' returning value', PA));
    r2 := pg_temp.essai('FA', PA, format('delete from public.settings where promo_id = %s and key = ''autonomie_active'' returning value', PA));
    perform pg_temp.verifier('interrupteur : le formateur ne l''éteint pas et ne le supprime pas',
      r = 'OK ' and r2 = 'OK ' and (select value from settings where promo_id = PA and key = 'autonomie_active') = 'true', r || ' / ' || r2);
    r := pg_temp.essai('FA', PA, format('update public.settings set key = ''preuve_auto_renommee'' where promo_id = %s and key = ''autonomie_active'' returning key', PA));
    r2 := pg_temp.essai('FA', PA, format('update public.settings set key = ''autonomie_active'' where promo_id = %s and key = ''preuve_auto_cle'' returning key', PA));
    perform pg_temp.verifier('interrupteur : le formateur ne renomme ni depuis la clé (aucune ligne) ni vers elle (42501)',
      r = 'OK ' and r2 like 'REFUS 42501%' and exists (select 1 from settings where promo_id = PA and key = 'autonomie_active')
      and exists (select 1 from settings where promo_id = PA and key = 'preuve_auto_cle'), r || ' / ' || r2);
    r := pg_temp.essai('FA', PA, format('update public.settings set value = ''apres'' where promo_id = %s and key = ''preuve_auto_cle'' returning value', PA));
    r2 := pg_temp.essai('FA', PA, format('insert into public.settings (key, value, promo_id) values (''preuve_auto_cle2'', ''x'', %s) returning value', PA));
    t := pg_temp.essai('FA', PA, format('delete from public.settings where promo_id = %s and key = ''preuve_auto_cle2'' returning key', PA));
    perform pg_temp.verifier('interrupteur : le formateur écrit toujours une autre clé (modifier, créer, supprimer)',
      r = 'OK apres' and r2 = 'OK x' and t = 'OK preuve_auto_cle2', r || ' / ' || r2 || ' / ' || t);
    r := pg_temp.essai('FO', PA, format('update public.settings set value = ''false'' where promo_id = %s and key = ''autonomie_active'' returning value', PA), 'formateur');
    r2 := pg_temp.essai('FO', PA, format('delete from public.settings where promo_id = %s and key = ''autonomie_active'' returning value', PA), 'formateur');
    perform pg_temp.verifier('interrupteur : le fondateur en aperçu formateur ne l''éteint ni ne le supprime',
      r = 'OK ' and r2 = 'OK ' and (select value from settings where promo_id = PA and key = 'autonomie_active') = 'true', r || ' / ' || r2);
    r := pg_temp.essai('FO', PA, format('update public.settings set value = ''false'' where promo_id = %s and key = ''autonomie_active'' returning value', PA));
    r2 := pg_temp.essai('FO', PA, format('update public.settings set value = ''true'' where promo_id = %s and key = ''autonomie_active'' returning value', PA));
    t := pg_temp.essai('FO', PA, format('delete from public.settings where promo_id = %s and key = ''autonomie_active'' returning value', PA));
    t2 := pg_temp.essai('FO', PA, format('insert into public.settings (key, value, promo_id) values (''autonomie_active'', ''true'', %s) returning value', PA));
    perform pg_temp.verifier('interrupteur : le fondateur hors aperçu l''éteint, l''allume, le supprime et le recrée',
      r = 'OK false' and r2 = 'OK true' and t = 'OK true' and t2 = 'OK true', r || ' / ' || r2 || ' / ' || t || ' / ' || t2);
    r := pg_temp.essai('FO', PA, format('insert into public.settings (key, value, promo_id) values (''preuve_auto_cle3'', ''x'', %s) on conflict (promo_id, key) do nothing returning value', PA), 'formateur');
    delete from settings where promo_id = PA and key = 'autonomie_active';
    r2 := pg_temp.essai('FO', PA, format('insert into public.settings (key, value, promo_id) values (''autonomie_active'', ''true'', %s) returning value', PA), 'formateur');
    perform pg_temp.verifier('interrupteur : en aperçu formateur, le fondateur écrit une autre clé mais ne crée pas l''interrupteur',
      r = 'OK x' and r2 like 'REFUS 42501%', r || ' / ' || r2);
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PA)
      on conflict (promo_id, key) do update set value = excluded.value;
    n := pg_temp.compter('SA', PA, format('select count(*) from public.settings where promo_id = %s and key = ''autonomie_active'' and value = ''true''', PA));
    perform pg_temp.verifier('interrupteur : le stagiaire lit toujours le réglage de sa promo', n = 1, n::text);
    -- service_role : les règles restrictives ne le visent pas ; même résultat pour l'interrupteur que pour une autre clé.
    begin
      set local role service_role;
      update public.settings set value = 'false' where promo_id = PA and key = 'autonomie_active';
      get diagnostics n = row_count;
      update public.settings set value = 'sr' where promo_id = PA and key = 'preuve_auto_cle';
      get diagnostics m = row_count;
      reset role;
      r := n || '/' || m;
    exception when others then
      reset role;
      r := sqlstate || ' ' || sqlerrm;
    end;
    perform pg_temp.verifier('interrupteur : service_role écrit l''interrupteur comme une autre clé (règles restrictives sans effet sur lui)',
      r = '1/1', r);
    update settings set value = 'false' where promo_id = PA and key = 'autonomie_active';
    get diagnostics n = row_count;
    perform pg_temp.verifier('interrupteur : le propriétaire de la table écrit la clé', n = 1, n::text);
    delete from settings where promo_id = PA and key in ('autonomie_active', 'preuve_auto_cle', 'preuve_auto_cle3');

    -- 1.2 ter Sentinelle (migration 1 telle que livrée) : fermeture dure ----------------------------------------------
    -- Si la migration 2 a daté la version, la sentinelle est remise ici, dans la transaction annulée seulement (même
    -- définition que la migration 1 : la seconde migration ne change que le littéral).
    if public._autonomie_version_conditions() <> '9999-12-31' then
      t := quote_literal(public._autonomie_version_conditions()) || '::text';
      execute replace(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure), t, '''9999-12-31''::text');
    end if;
    perform pg_temp.verifier('preuve : la sentinelle est en place pour les cas de la fermeture dure',
      public._autonomie_version_conditions() = '9999-12-31', public._autonomie_version_conditions());
    -- SA a l'interrupteur allumé, une acceptation plausible (hier) et « accepte » la sentinelle par la vraie fonction.
    -- accepter_conditions (20261004_conditions_acceptations.sql) est en production mais absente des clones de la base
    -- locale : si elle manque, la preuve la pose ici, mot pour mot, dans sa transaction annulée (hors empreinte).
    if to_regprocedure('public.accepter_conditions(text)') is null then
      execute $ac$
create or replace function public.accepter_conditions(p_version text)
returns timestamptz language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_quand timestamptz;
begin
  if v_email is null then
    raise exception 'Non connecte';
  end if;
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$' then
    raise exception 'Version de conditions invalide';
  end if;
  insert into conditions_acceptations (email, version) values (v_email, p_version)
  on conflict (email, version) do nothing;
  select accepted_at into v_quand from conditions_acceptations
   where email = v_email and version = p_version;
  return v_quand;
end;
$function$;
revoke all on function public.accepter_conditions(text) from anon, public;
grant execute on function public.accepter_conditions(text) to authenticated;
$ac$;
    end if;
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PA);
    r := pg_temp.accepter_en_base('SA', '9999-12-31');
    r2 := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 30, true, null)::text', K1));
    r3 := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('R11 : sentinelle livrée, acceptation ''9999-12-31'' en base puis tracer : refus silencieux, 0 ligne',
      r like 'OK 2%' and r2 = 'OK false' and r3 = 'OK '
      and exists (select 1 from conditions_acceptations ca join preuve_comptes k on lower(ca.email) = k.email
                   where k.nom = 'SA' and ca.version = '9999-12-31')
      and (select count(*) from cours_lectures where stagiaire_id = SA) + (select count(*) from autonomie_temps where stagiaire_id = SA) = 0,
      r || ' / ' || r2 || ' / ' || r3);
    -- Dans la transaction de la preuve seulement : la version exigée devient hier (calculé), comme le fera la vraie date.
    -- Le retour supprime cette fonction comme celle livrée (même signature) : l'empreinte reste comparable.
    execute format('create or replace function public._autonomie_version_conditions() returns text language sql immutable '
                   'set search_path to ''public'', ''pg_temp'' as $v$ select %L::text $v$', v_version);
    perform pg_temp.verifier('preuve : version exigée datée d''hier pour la suite du scénario',
      public._autonomie_version_conditions() = v_version, public._autonomie_version_conditions());

    -- 1.3 Règle 1 : réservé aux stagiaires ---------------------------------------------------------------------------
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
    -- Le stagiaire envoie l'en-tête de la promo allumée, qui n'est pas la sienne : aucune fiche là, refus des non-stagiaires.
    r := pg_temp.essai('SA', PB, format('select public.autonomie_tracer_cours(%L, 30, true, null)::text', K1));
    r2 := pg_temp.essai('SA', PB, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('règle 2 : en-tête d''une autre promo (allumée) : « Réservé aux stagiaires. », 0 ligne',
      r = 'REFUS P0001 autonomie: Réservé aux stagiaires.' and r2 = 'REFUS P0001 autonomie: Réservé aux stagiaires.'
      and (select count(*) from cours_lectures where stagiaire_id = SA) + (select count(*) from autonomie_temps where stagiaire_id = SA) = 0,
      r || ' / ' || r2);
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
    r := pg_temp.accepter_en_base('SC', '2099-01-01');
    r2 := pg_temp.essai('SC', PA, format('select public.autonomie_tracer_cours(%L, 30, true, null)::text', K1));
    perform pg_temp.verifier('règle 3 (R11) : version datée dans l''avenir (2099-01-01, posée en base), refus silencieux et 0 ligne',
      r like 'OK 2%' and r2 = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = SC) = 0
      and (select count(*) from autonomie_temps where stagiaire_id = SC) = 0, r || ' / ' || r2);
    r := pg_temp.accepter_en_base('SC', v_version || 'b');
    r2 := pg_temp.essai('SC', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K4));
    perform pg_temp.verifier('règle 3 (R11) : la version exigée avec une lettre (« b ») compte : écrit',
      r like 'OK 2%' and r2 = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = SC) = 1
      and (select secondes from autonomie_temps where stagiaire_id = SC) = 30, r || ' / ' || r2);
    -- Version comparée ENTIÈRE. La version exigée devient « <hier>b » (dans la transaction) : SV, qui a accepté « <hier> » sans
    -- la lettre, n'écrit plus ; SC (« <hier>b ») écrit toujours ; une acceptation mal formée (« <hier>b  », espace final) ne
    -- compte pas ; « <hier>c », postérieure, compte.
    execute replace(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure),
                    quote_literal(v_version) || '::text', quote_literal(v_version || 'b') || '::text');
    r := pg_temp.essai('SV', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K4));
    r2 := pg_temp.essai('SV', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('règle 3 (version entière) : version exigée « <hier>b », acceptation « <hier> » sans la lettre : refus silencieux, 0 ligne',
      public._autonomie_version_conditions() = v_version || 'b' and r = 'OK false' and r2 = 'OK '
      and (select count(*) from cours_lectures where stagiaire_id = SV) + (select count(*) from autonomie_temps where stagiaire_id = SV) = 0,
      public._autonomie_version_conditions() || ' : ' || r || ' / ' || r2);
    r := pg_temp.essai('SC', PA, format('select public.autonomie_tracer_qcm(%s, 10)::text', Q1));
    perform pg_temp.verifier('règle 3 (version entière) : version exigée « <hier>b », acceptation « <hier>b » : écrit',
      r = 'OK ' and (select secondes from autonomie_temps where stagiaire_id = SC and genre = 'qcm') = 10, r);
    insert into conditions_acceptations (email, version)
    select email, v_version || 'b ' from preuve_comptes where nom = 'SV';
    r := pg_temp.essai('SV', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K4));
    perform pg_temp.verifier('règle 3 : une acceptation mal formée (« <hier>b » suivi d''un espace, au-dessus de la version exigée en ordre de texte) ne compte pas',
      r = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = SV) + (select count(*) from autonomie_temps where stagiaire_id = SV) = 0, r);
    r := pg_temp.accepter_en_base('SV', v_version || 'c');
    r2 := pg_temp.essai('SV', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K4));
    perform pg_temp.verifier('règle 3 (version entière) : acceptation « <hier>c », postérieure à « <hier>b » : écrit',
      r like 'OK 2%' and r2 = 'OK false' and (select secondes from autonomie_temps where stagiaire_id = SV) = 30, r || ' / ' || r2);
    execute replace(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure),
                    quote_literal(v_version || 'b') || '::text', quote_literal(v_version) || '::text');
    perform pg_temp.verifier('preuve : version exigée remise à hier', public._autonomie_version_conditions() = v_version,
      public._autonomie_version_conditions());

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
    -- Interrupteur éteint : PERSONNE ne lit plus rien par l'API (le stagiaire, l'équipe, le fondateur, le compteur de la
    -- promo), les lignes restent en base ; rallumé, tous les relisent, inchangées.
    v_avant := pg_temp.essai('FA', PA, format('select md5(coalesce((select string_agg(to_jsonb(c)::text, '','' order by c.cours_id) from public.cours_lectures c where c.stagiaire_id = %s), '''')'
                                              || ' || coalesce((select string_agg(to_jsonb(a)::text, '','' order by a.jour, a.genre, a.ressource) from public.autonomie_temps a where a.stagiaire_id = %s), ''''))', SA, SA));
    r := pg_temp.essai('FA', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('données : interrupteur allumé, le compteur de la promo rend des cours lus (SA a lu K1 et K3)', r = 'OK 2', r);
    update settings set value = 'false' where promo_id = PA and key = 'autonomie_active';
    n := pg_temp.compter('SA', PA, 'select count(*) from public.cours_lectures') + pg_temp.compter('SA', PA, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('interrupteur éteint : le stagiaire ne lit aucune de ses lignes', n = 0, n::text);
    n := pg_temp.compter('FA', PA, 'select count(*) from public.cours_lectures') + pg_temp.compter('FA', PA, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('interrupteur éteint : l''équipe (notes.lire) ne lit aucune ligne', n = 0, n::text);
    n := pg_temp.compter('FO', PA, 'select count(*) from public.cours_lectures') + pg_temp.compter('FO', PA, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('interrupteur éteint : le fondateur ne lit aucune ligne', n = 0, n::text);
    r := pg_temp.essai('FA', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    r2 := pg_temp.essai('FO', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('interrupteur éteint : autonomie_lectures_promo ne rend rien (formateur, fondateur), sans erreur',
      r = 'OK 0' and r2 = 'OK 0', r || ' / ' || r2);
    perform pg_temp.verifier('interrupteur éteint : les lignes restent en base',
      (select count(*) from cours_lectures where stagiaire_id = SA) = 3 and (select count(*) from autonomie_temps where stagiaire_id = SA) = 4);
    r := pg_temp.essai('SA', PA, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K2));
    perform pg_temp.verifier('interrupteur éteint : plus rien n''est écrit', r = 'OK false'
      and (select secondes from autonomie_temps where stagiaire_id = SA and ressource = K2::text) = 185, r);
    delete from settings where promo_id = PA and key = 'autonomie_active';
    n := pg_temp.compter('SA', PA, 'select count(*) from public.cours_lectures');
    m := pg_temp.compter('FA', PA, 'select count(*) from public.cours_lectures') + pg_temp.compter('FA', PA, 'select count(*) from public.autonomie_temps');
    r := pg_temp.essai('FA', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('interrupteur retiré (ligne absente) : ni le stagiaire ni l''équipe ne lisent rien, compteur vide',
      n = 0 and m = 0 and r = 'OK 0', n || '/' || m || ' / ' || r);
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PA);
    n := pg_temp.compter('SA', PA, 'select count(*) from public.cours_lectures');
    m := pg_temp.compter('SA', PA, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('interrupteur rallumé : le stagiaire relit ses lignes', n = 3 and m = 4, n || '/' || m);
    v_apres := pg_temp.essai('FA', PA, format('select md5(coalesce((select string_agg(to_jsonb(c)::text, '','' order by c.cours_id) from public.cours_lectures c where c.stagiaire_id = %s), '''')'
                                              || ' || coalesce((select string_agg(to_jsonb(a)::text, '','' order by a.jour, a.genre, a.ressource) from public.autonomie_temps a where a.stagiaire_id = %s), ''''))', SA, SA));
    r := pg_temp.essai('FA', PA, 'select count(*)::text from public.autonomie_lectures_promo()');
    perform pg_temp.verifier('interrupteur rallumé : l''équipe relit les mêmes lignes, inchangées (empreinte identique), et le compteur revient',
      v_avant like 'OK %' and v_avant <> 'OK ' || md5('') and v_apres = v_avant and r = 'OK 2'
      and pg_temp.compter('FA', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SA)) = 3
      and pg_temp.compter('FA', PA, format('select count(*) from public.autonomie_temps where stagiaire_id = %s', SA)) = 4,
      v_avant || ' / ' || v_apres || ' / ' || r);

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
    -- Fonctions internes du propriétaire (psql) : fermées à tout compte de l'API, fondateur compris.
    r := pg_temp.essai('FO', PA, format('select public._autonomie_lever_opposition(%s)::text', SO));
    r2 := pg_temp.essai('FO', PA, format('select public._autonomie_opposer(%s)::text', SB));
    r3 := pg_temp.essai('SO', PA, format('select public._autonomie_lever_opposition(%s)::text', SO));
    perform pg_temp.verifier('opposition : _autonomie_lever_opposition et _autonomie_opposer refusées par l''API (fondateur, stagiaire : 42501)',
      r like 'REFUS 42501%' and r2 like 'REFUS 42501%' and r3 like 'REFUS 42501%'
      and exists (select 1 from autonomie_oppositions where stagiaire_id = SO)
      and not exists (select 1 from autonomie_oppositions where stagiaire_id = SB), r || ' / ' || r2 || ' / ' || r3);
    -- Le propriétaire lève l'opposition : SO peut de nouveau être tracé, ses traces d'avant ne reviennent pas.
    select depuis::text into t from autonomie_oppositions where stagiaire_id = SO;
    r := public._autonomie_lever_opposition(SO)::text;
    r2 := public._autonomie_lever_opposition(SO)::text;
    perform pg_temp.verifier('opposition levée par le propriétaire (vrai), l''inscription part ; la lever une seconde fois rend faux, sans erreur',
      r = 'true' and r2 = 'false' and t is not null and not exists (select 1 from autonomie_oppositions where stagiaire_id = SO),
      coalesce(t, 'aucune') || ' : ' || r || ' / ' || r2);
    r := pg_temp.essai('SO', PA, format('select public.autonomie_tracer_cours(%L, 40, false, null)::text', K1));
    perform pg_temp.verifier('opposition levée : SO est de nouveau tracé (une ligne neuve, 40 s), rien d''avant n''est revenu',
      r = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = SO) = 1
      and (select sum(secondes) from autonomie_temps where stagiaire_id = SO) = 40, r);
    -- Le propriétaire oppose de nouveau, par la fonction interne : traces effacées, inscription posée.
    perform public._autonomie_opposer(SO);
    r := pg_temp.essai('SO', PA, format('select public.autonomie_tracer_cours(%L, 40, false, null)::text', K1));
    perform pg_temp.verifier('opposition par _autonomie_opposer (propriétaire) : traces effacées, inscription posée, plus rien d''écrit',
      r = 'OK false' and exists (select 1 from autonomie_oppositions where stagiaire_id = SO)
      and (select count(*) from cours_lectures where stagiaire_id = SO) + (select count(*) from autonomie_temps where stagiaire_id = SO) = 0, r);
    begin
      perform public._autonomie_opposer(-1);
      r := 'accepté';
    exception when others then
      r := sqlerrm;
    end;
    begin
      perform public._autonomie_lever_opposition(null);
      r2 := 'accepté';
    exception when others then
      r2 := sqlerrm;
    end;
    perform pg_temp.verifier('opposition interne : fiche inconnue ou nulle refusée', r = 'autonomie: Fiche introuvable.'
      and r2 = 'autonomie: Fiche introuvable.', r || ' / ' || r2);
    perform pg_temp.verifier('opposition : les traces des autres stagiaires sont intactes',
      (select count(*) from cours_lectures where stagiaire_id = SA) = 3);

    -- 1.16 R2 : les traces suivent le sort des tentatives de QCM -------------------------------------------------------
    -- Changement de promo (R10) : SB lit K2 jusqu'au bout dans PA, passe dans PB et retrace K2. Les lignes de PA ne bougent
    -- plus ; des lignes neuves naissent dans PB ; le plancher compte le temps de la seule promo ; chaque équipe lit sa promo.
    r := '';
    for n in 1..3 loop
      r := r || pg_temp.essai('SB', PA, format('select public.autonomie_tracer_cours(%L, 60, %L, null)::text', K2, n = 3)) || ';';
    end loop;
    insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (Q1, SB, 'entrainement', 5, 10, 10);
    select to_jsonb(c)::text into t from cours_lectures c where stagiaire_id = SB and promo_id = PA and cours_id = K2;
    select to_jsonb(a)::text into t2 from autonomie_temps a where stagiaire_id = SB and promo_id = PA;
    r2 := pg_temp.essai('FA', PA, 'select coalesce(jsonb_agg(to_jsonb(l) order by l.cours_id), ''[]'')::text from public.autonomie_lectures_promo() l');
    perform pg_temp.verifier('R10, données : SB a lu K2 dans PA (2 000 mots, plancher 180 s) (3 appels, fin au dernier)', r = 'OK false;OK false;OK true;' and t is not null, r);
    update stagiaires set promo_id = PB where id = SB;
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PB)
      on conflict (promo_id, key) do update set value = 'true';
    r := pg_temp.essai('SB', PB, format('select public.autonomie_tracer_cours(%L, 60, true, %L)::text', K2, 'Nouvelle promo'));
    perform pg_temp.verifier('R10, changement de promo : la ligne de PA est identique octet pour octet (promo, ouvert_le, vu_le, lu_le, section) et son temps aussi',
      (select to_jsonb(c)::text from cours_lectures c where stagiaire_id = SB and promo_id = PA and cours_id = K2) = t
      and (select to_jsonb(a)::text from autonomie_temps a where stagiaire_id = SB and promo_id = PA) = t2, r);
    perform pg_temp.verifier('R10 : une ligne neuve dans PB, non lue (60 s dans PB, le temps de PA ne compte pas pour le plancher)',
      r = 'OK false' and exists (select 1 from cours_lectures where stagiaire_id = SB and promo_id = PB and cours_id = K2
        and fin_atteinte and lu_le is null and section = 'Nouvelle promo')
      and (select secondes from autonomie_temps where stagiaire_id = SB and promo_id = PB and ressource = K2::text) = 60, r);
    perform pg_temp.verifier('R10 : les tentatives de QCM gardent aussi leur promo', (select promo_id from qcm_attempts where stagiaire_id = SB) = PA);
    n := pg_temp.compter('FA', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s and promo_id = %s', SB, PA));
    m := pg_temp.compter('FA', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SB));
    perform pg_temp.verifier('R10 : l''équipe de PA lit la ligne de PA et pas celle de PB', n = 1 and m = 1, n || '/' || m);
    n := pg_temp.compter('FB', PB, format('select count(*) from public.cours_lectures where stagiaire_id = %s and promo_id = %s', SB, PB));
    m := pg_temp.compter('FB', PB, format('select count(*) from public.cours_lectures where stagiaire_id = %s', SB))
       + pg_temp.compter('FB', PB, format('select count(*) from public.autonomie_temps where stagiaire_id = %s and promo_id <> %s', SB, PB));
    perform pg_temp.verifier('R10 : l''équipe de PB lit la ligne de PB et pas celle de PA', n = 1 and m = 1, n || '/' || m);
    r := pg_temp.essai('FA', PA, 'select coalesce(jsonb_agg(to_jsonb(l) order by l.cours_id), ''[]'')::text from public.autonomie_lectures_promo() l');
    perform pg_temp.verifier('R10 : autonomie_lectures_promo de PA perd SB pour K2 (1 avant son départ, plus rien après : N ne dépasse jamais T)',
      (select (e ->> 'lus')::integer from jsonb_array_elements(substr(r2, 4)::jsonb) e where e ->> 'cours_id' = K2::text) = 1
      and not exists (select 1 from jsonb_array_elements(substr(r, 4)::jsonb) e where e ->> 'cours_id' = K2::text)
      and r like 'OK [%', r2 || ' -> ' || r);
    r := pg_temp.essai('FB', PB, 'select coalesce(jsonb_agg(to_jsonb(l) order by l.cours_id), ''[]'')::text from public.autonomie_lectures_promo() l');
    perform pg_temp.verifier('R10 : autonomie_lectures_promo de PB ne compte pas SB tant qu''il n''a pas lu K2 dans PB', r = 'OK []', r);
    n := pg_temp.compter('SB', PB, 'select count(*) from public.cours_lectures') + pg_temp.compter('SB', PB, 'select count(*) from public.autonomie_temps');
    perform pg_temp.verifier('R10 : le stagiaire, dans sa nouvelle promo, ne lit que les lignes de PB', n = 2, n::text);
    -- Plafond de 8 h : la journée du stagiaire toutes promos confondues.
    update autonomie_temps set secondes = 28780 - 60 where stagiaire_id = SB and promo_id = PA and jour = v_jour;
    r := pg_temp.essai('SB', PB, format('select public.autonomie_tracer_cours(%L, 60, false, null)::text', K2));
    perform pg_temp.verifier('R10 : le plafond de 8 h compte la journée toutes promos (28 780 s, 20 s ajoutées dans PB)',
      (select secondes from autonomie_temps where stagiaire_id = SB and promo_id = PB and ressource = K2::text) = 80
      and (select sum(secondes) from autonomie_temps where stagiaire_id = SB and jour = v_jour) = 28800, r);
    -- SB atteint le plancher dans PB (temps posé en propriétaire : la journée est pleine) : il compte alors dans PB, pas dans PA.
    update autonomie_temps set secondes = 180 where stagiaire_id = SB and promo_id = PB and ressource = K2::text;
    r := pg_temp.essai('SB', PB, format('select public.autonomie_tracer_cours(%L, 0, false, null)::text', K2));
    r2 := pg_temp.essai('FB', PB, 'select coalesce(jsonb_agg(to_jsonb(l) order by l.cours_id), ''[]'')::text from public.autonomie_lectures_promo() l');
    r3 := pg_temp.essai('FA', PA, 'select coalesce(jsonb_agg(to_jsonb(l) order by l.cours_id), ''[]'')::text from public.autonomie_lectures_promo() l');
    perform pg_temp.verifier('R10 : lu dans PB, SB compte pour K2 dans PB (1) et toujours pas dans PA ; sa ligne de PA reste lisible par l''équipe de PA',
      r = 'OK true' and r2 like 'OK [%'
      and (select (e ->> 'lus')::integer from jsonb_array_elements(substr(r2, 4)::jsonb) e where e ->> 'cours_id' = K2::text) = 1
      and not exists (select 1 from jsonb_array_elements(substr(r3, 4)::jsonb) e where e ->> 'cours_id' = K2::text)
      and pg_temp.compter('FA', PA, format('select count(*) from public.cours_lectures where stagiaire_id = %s and lu_le is not null', SB)) = 1,
      r || ' / ' || r2 || ' / ' || r3);
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
    -- Étape 1 de la conservation (R2b) : le travail en autonomie est de la catégorie « formation + 12 mois », que l'étape 1
    -- vide ; les tentatives de QCM (résultats, 3 ans) restent. Le déclencheur suit la marque efface_le.
    perform pg_temp.verifier('R2b : déclencheur after update of efface_le sur stagiaires, borné au passage de nul à une date',
      exists (select 1 from pg_trigger where tgrelid = 'public.stagiaires'::regclass and tgname = 'stagiaires_autonomie_effacer'
                and not tgisinternal and tgenabled = 'O'
                and pg_get_triggerdef(oid) like '%AFTER UPDATE OF efface_le ON public.stagiaires%'
                and pg_get_triggerdef(oid) like '%old.efface_le IS NULL%new.efface_le IS NOT NULL%'));
    -- Effacement sur demande.
    insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (Q1, SA, 'entrainement', 5, 10, 10);
    select count(*) into n from qcm_attempts where stagiaire_id = SA;
    t := (select count(*) from cours_lectures where stagiaire_id = SA) || '/' || (select count(*) from autonomie_temps where stagiaire_id = SA);
    r := pg_temp.essai('FO', PA, format('select public.effacer_sur_demande(%s)::text', SA));
    t2 := (select count(*) from cours_lectures where stagiaire_id = SA) || '/' || (select count(*) from autonomie_temps where stagiaire_id = SA);
    perform pg_temp.verifier('R2b, effacement sur demande : 0 trace pour la fiche, tentatives de QCM gardées',
      r like 'OK {%' and exists (select 1 from stagiaires where id = SA and efface_le is not null)
      and (select count(*) from qcm_attempts where stagiaire_id = SA) = n and n > 0 and t = '3/4' and t2 = '0/0',
      r || ' ; qcm ' || n || ' ; traces ' || t || ' -> ' || t2);
    perform pg_temp.verifier('R2b : les traces des autres stagiaires sont intactes après l''effacement d''une fiche',
      (select count(*) from cours_lectures where stagiaire_id = SI) = 1);
    -- Étape 1 d'une promo finie depuis plus de 12 mois : SE a des traces, SE2 une opposition.
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', PE);
    r := pg_temp.essai('EE', PE, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    r2 := pg_temp.essai('EE', PE, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    insert into autonomie_oppositions (stagiaire_id) values (SE2);
    insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (Q1, SE, 'entrainement', 5, 10, 10);
    t := (select count(*) from cours_lectures where stagiaire_id = SE) || '/' || (select count(*) from autonomie_temps where stagiaire_id = SE)
         || '/' || (select count(*) from autonomie_oppositions where stagiaire_id = SE2);
    r3 := pg_temp.essai('FO', PE, format('select public.effacer_promo_etape1(%s)::text', PE));
    t2 := (select count(*) from cours_lectures where stagiaire_id = SE) || '/' || (select count(*) from autonomie_temps where stagiaire_id = SE)
          || '/' || (select count(*) from autonomie_oppositions where stagiaire_id = SE2);
    perform pg_temp.verifier('R2b, étape 1 de la promo (fin + 12 mois) : traces et opposition supprimées, tentatives de QCM gardées',
      r = 'OK false' and r2 = 'OK ' and r3 like 'OK {%' and t = '1/2/1' and t2 = '0/0/0'
      and (select count(*) from qcm_attempts where stagiaire_id = SE) = 1,
      r || ' / ' || r2 || ' / ' || r3 || ' ; ' || t || ' -> ' || t2);
    -- Fiche marquée effacée qui garde un compte (marque posée en propriétaire, sous le drapeau de la conservation) : ses
    -- traces partent, et une écriture ensuite n'écrit rien.
    r := pg_temp.essai('SX', PA, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', K1));
    t := (select count(*) from cours_lectures where stagiaire_id = SX)::text;
    perform set_config('conservation.effacement', 'on', true);
    update stagiaires set efface_le = now() where id = SX;
    perform set_config('conservation.effacement', '', true);
    r2 := pg_temp.essai('SX', PA, format('select public.autonomie_tracer_cours(%L, 30, true, null)::text', K1));
    r3 := pg_temp.essai('SX', PA, format('select public.autonomie_tracer_qcm(%s, 30)::text', Q1));
    perform pg_temp.verifier('R2b : fiche marquée effacée, traces supprimées puis refus silencieux (0 ligne)',
      r = 'OK false' and t = '1' and r2 = 'OK false' and r3 = 'OK '
      and (select count(*) from cours_lectures where stagiaire_id = SX) + (select count(*) from autonomie_temps where stagiaire_id = SX) = 0,
      r || ' / ' || t || ' / ' || r2 || ' / ' || r3);
    -- Une autre modification d'une fiche ne déclenche rien (SB a une lecture dans PA et une dans PB).
    update stagiaires set actif = false where id = SB;
    perform pg_temp.verifier('R2b : une autre modification de la fiche ne supprime rien',
      (select count(*) from cours_lectures where stagiaire_id = SB) = 2);

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
    -- Une promo restée allumée au moment du retour : le retour supprime l'interrupteur (sinon une nouvelle application de la
    -- migration reprendrait la collecte d'elle-même).
    insert into settings (key, value, promo_id) values ('autonomie_active', 'true', v_promo_ex)
      on conflict (promo_id, key) do update set value = excluded.value;
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
    perform pg_temp.verifier('retour : les interrupteurs autonomie_active sont supprimés (toutes promos)',
      not exists (select 1 from settings where key = 'autonomie_active'),
      coalesce((select string_agg(promo_id || '=' || value, ',') from settings where key = 'autonomie_active'), 'aucun'));
    perform pg_temp.verifier('retour : déclencheur de stagiaires et règles restrictives de settings retirés',
      not exists (select 1 from pg_trigger where tgrelid = 'public.stagiaires'::regclass and tgname = 'stagiaires_autonomie_effacer')
      and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname like 'settings\_autonomie%'));
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
