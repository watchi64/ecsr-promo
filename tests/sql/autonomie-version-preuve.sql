-- Preuve de la migration 20261114_autonomie_2_version (version datée des conditions d'utilisation) et de son retour.
-- Script psql (pas un bloc DO unique : la migration lit la variable psql « version », que seul psql sait poser). Tout se joue
-- dans UNE transaction annulée à la fin (rollback) ; ON_ERROR_ROLLBACK annule seulement l'instruction qui échoue, ce qui permet
-- de jouer les refus attendus et de lire leur message (variables psql ERROR et LAST_ERROR_MESSAGE). Le verdict est le message
-- de l'erreur finale : « VERT n/0 » ou « ROUGE ok/échecs : liste ». Données 100 % fictives (example.invalid).
--
-- Jouée sur la base LOCALE jetable (outils/base_locale), jamais sur la production, migration 1 appliquée et migration 2 NON
-- appliquée (la version en place est la sentinelle) :
--   bash outils/base_locale/reconstruire.sh --port 55451
--   bash outils/base_locale/rejouer_suite.sh --port 55451 --titres 1,2,3
--   psql -h 127.0.0.1 -p 55451 -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_autonomie_1_traces.sql
--   PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p 55451 -U postgres -d postgres -X -q \
--     -v migration2=<chemin absolu de supabase/migrations/20261114_autonomie_2_version.sql> \
--     -v retour2=<chemin absolu de supabase/migrations/20261114_autonomie_2_version_retour.sql> \
--     -f tests/sql/autonomie-version-preuve.sql
-- Contre-épreuve : migration2 et retour2 vers un fichier vide : ROUGE attendu.
--
-- Cas : variable absente, mal formée (lettres, deux lettres, mois 13, 30 février), datée demain, la sentinelle elle-même :
-- refusés, rien de changé. Puis version d'hier : appliquée, seul le littéral change (définition, droits, propriétaire,
-- volatilité), aucun rôle de l'API ne peut appeler la fonction ; T1 (a accepté la version d'hier, interrupteur allumé) écrit,
-- T2 (n'a accepté qu'une version plus ancienne) n'écrit pas. Version d'avant-hier ensuite : refusée (on ne recule pas) ; la même
-- version : rejouée sans erreur. Retour : la sentinelle revient, définition identique à celle de la migration 1, T1 n'écrit plus
-- rien ; retour rejoué : sans erreur.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on

begin;
set local lock_timeout = '3s';

create temp table pv (num serial, libelle text, etat text, detail text);
create temp table pv_ids (nom text primary key, id text not null);

create function pg_temp.verifier(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into pv (libelle, etat, detail)
  values (p_libelle, case when coalesce(p_ok, false) then 'ok' else 'échec' end, coalesce(p_detail, ''));
$f$;

-- Un refus attendu de la migration ou du retour : psql dit que la dernière instruction a échoué, avec ce motif dans le
-- message, et la version en place n'a pas bougé.
create function pg_temp.refus(p_libelle text, p_erreur text, p_message text, p_motif text, p_version text)
returns void language sql as $f$
  select pg_temp.verifier(p_libelle,
    p_erreur = 'true' and p_message like p_motif and public._autonomie_version_conditions() = p_version,
    'erreur ' || p_erreur || ' : ' || p_message || ' ; version en place ' || public._autonomie_version_conditions());
$f$;

-- Instruction jouée sous l'adresse d'un compte stagiaire (jeton fictif), promo affichée p_promo. Rend « OK <valeur> » ou
-- « REFUS <code> <message> ».
create function pg_temp.essai(p_email text, p_promo integer, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
    perform set_config('request.headers', json_build_object('x-promo-id', p_promo::text)::text, true);
    set local role authenticated;
    execute p_sql into v;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.headers', '', true);
    return 'OK ' || coalesce(v, '');
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.headers', '', true);
    return 'REFUS ' || sqlstate || ' ' || sqlerrm;
  end;
end $f$;

-- 0. Préalables et données -------------------------------------------------------------------------------------------
select to_char((now() at time zone 'Europe/Paris')::date - 1, 'YYYY-MM-DD') as hier,
       to_char((now() at time zone 'Europe/Paris')::date - 2, 'YYYY-MM-DD') as avant_hier,
       to_char((now() at time zone 'Europe/Paris')::date - 3, 'YYYY-MM-DD') as ancienne,
       to_char((now() at time zone 'Europe/Paris')::date + 1, 'YYYY-MM-DD') as demain \gset

select pg_temp.verifier('préalable : migration 1 appliquée, sentinelle en place (migration 2 non appliquée)',
  to_regprocedure('public._autonomie_version_conditions()') is not null
  and public._autonomie_version_conditions() = '9999-12-31');
select md5(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure)) as def_m1,
       coalesce((select proacl::text from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure), '') as acl_m1,
       (select proowner from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure) as proprio_m1 \gset

do $donnees$
declare l integer; p integer; s1 integer; s2 integer; k uuid;
begin
  insert into lieux (nom) values ('Preuve version') returning id into l;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (l, 'Preuve version', current_date - 30, current_date + 200) returning id into p;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve version 1', 'PREUVE', p, true) returning id into s1;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve version 2', 'PREUVE', p, true) returning id into s2;
  insert into user_profiles (email, role, stagiaire_id) values ('preuve.version.t1@example.invalid', 'stagiaire', s1),
                                                               ('preuve.version.t2@example.invalid', 'stagiaire', s2);
  insert into conditions_acceptations (email, version)
  values ('preuve.version.t1@example.invalid', to_char((now() at time zone 'Europe/Paris')::date - 1, 'YYYY-MM-DD')),
         ('preuve.version.t2@example.invalid', to_char((now() at time zone 'Europe/Paris')::date - 3, 'YYYY-MM-DD'));
  insert into settings (key, value, promo_id) values ('autonomie_active', 'true', p)
    on conflict (promo_id, key) do update set value = excluded.value;
  select id into k from cours where published order by numero nulls last, id limit 1;
  insert into pv_ids values ('P', p::text), ('T1', s1::text), ('T2', s2::text), ('K', k::text);
end $donnees$;
select (select id from pv_ids where nom = 'P') as p, (select id from pv_ids where nom = 'T1') as t1,
       (select id from pv_ids where nom = 'T2') as t2, (select id from pv_ids where nom = 'K') as k \gset
select pg_temp.verifier('données : promo, deux stagiaires et un cours publié', :'k' <> '');

-- Avant la migration 2 : la sentinelle ferme tout (T1 n'écrit pas).
select pg_temp.verifier('avant la migration 2 : T1 (version d''hier acceptée, interrupteur allumé) n''écrit rien (sentinelle)',
  pg_temp.essai('preuve.version.t1@example.invalid', :p, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', :'k')) = 'OK false'
  and (select count(*) from autonomie_temps where stagiaire_id = :t1) = 0);

-- 1. Refus : rien ne change ----------------------------------------------------------------------------------------
\unset version
\i :migration2
select pg_temp.refus('refus : variable version absente', :'ERROR', :'LAST_ERROR_MESSAGE', '%variable version absente%', '9999-12-31');

\set version 13-11-2026
\i :migration2
select pg_temp.refus('refus : version mal formée (13-11-2026)', :'ERROR', :'LAST_ERROR_MESSAGE', '%mal formée%', '9999-12-31');

\set version 2026-11-12bb
\i :migration2
select pg_temp.refus('refus : version mal formée (deux lettres)', :'ERROR', :'LAST_ERROR_MESSAGE', '%mal formée%', '9999-12-31');

\set version 2026-11-12B
\i :migration2
select pg_temp.refus('refus : version mal formée (lettre majuscule)', :'ERROR', :'LAST_ERROR_MESSAGE', '%mal formée%', '9999-12-31');

\set version 2026-13-01
\i :migration2
select pg_temp.refus('refus : pas une date (mois 13)', :'ERROR', :'LAST_ERROR_MESSAGE', '%n''est pas une date%', '9999-12-31');

\set version 2026-02-30
\i :migration2
select pg_temp.refus('refus : pas une date (30 février)', :'ERROR', :'LAST_ERROR_MESSAGE', '%n''est pas une date%', '9999-12-31');

\set version :demain
\i :migration2
select pg_temp.refus('refus : version datée de demain', :'ERROR', :'LAST_ERROR_MESSAGE', '%après aujourd''hui%', '9999-12-31');

\set version 9999-12-31
\i :migration2
select pg_temp.refus('refus : la sentinelle elle-même (dans l''avenir)', :'ERROR', :'LAST_ERROR_MESSAGE', '%après aujourd''hui%', '9999-12-31');

select pg_temp.verifier('après les refus : définition et droits identiques à ceux de la migration 1',
  md5(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure)) = :'def_m1'
  and coalesce((select proacl::text from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure), '') = :'acl_m1');

-- 2. Version d'hier : appliquée --------------------------------------------------------------------------------------
\set version :hier
\i :migration2
select pg_temp.verifier('version d''hier : appliquée sans erreur, la fonction la rend',
  :'ERROR' = 'false' and public._autonomie_version_conditions() = :'hier',
  :'ERROR' || ' / ' || public._autonomie_version_conditions());
select pg_temp.verifier('version d''hier : seul le littéral change (définition de la migration 1, littéral excepté ; droits ; propriétaire ; immuable ; search_path)',
  md5(replace(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure),
              quote_literal(:'hier') || '::text', quote_literal('9999-12-31') || '::text')) = :'def_m1'
  and (select coalesce(proacl::text, '') = :'acl_m1' and proowner::text = :'proprio_m1' and provolatile = 'i' and not prosecdef
              and proconfig = array['search_path=public, pg_temp']
         from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure),
  (select coalesce(proacl::text, '') || ' ' || provolatile::text || ' ' || coalesce(array_to_string(proconfig, ';'), '')
     from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure));
select pg_temp.verifier('version d''hier : aucun rôle de l''API (anon, authenticated, service_role) ne peut appeler la fonction',
  not (has_function_privilege('anon', 'public._autonomie_version_conditions()', 'EXECUTE')
       or has_function_privilege('authenticated', 'public._autonomie_version_conditions()', 'EXECUTE')
       or has_function_privilege('service_role', 'public._autonomie_version_conditions()', 'EXECUTE')));
select pg_temp.essai('preuve.version.t1@example.invalid', :p, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', :'k')) as r_t1 \gset
select pg_temp.verifier('version d''hier : T1, qui l''a acceptée, écrit (une lecture, 30 s)',
  :'r_t1' = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = :t1) = 1
  and (select sum(secondes) from autonomie_temps where stagiaire_id = :t1) = 30, :'r_t1');
select pg_temp.essai('preuve.version.t2@example.invalid', :p, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', :'k')) as r_t2 \gset
select pg_temp.verifier('version d''hier : T2, qui n''a accepté qu''une version plus ancienne, n''écrit rien',
  :'r_t2' = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = :t2)
                           + (select count(*) from autonomie_temps where stagiaire_id = :t2) = 0, :'r_t2');

\set version :avant_hier
\i :migration2
select pg_temp.refus('refus : version d''avant-hier, antérieure à celle en place', :'ERROR', :'LAST_ERROR_MESSAGE', '%antérieure à la version en place%', :'hier');

\set version :hier
\i :migration2
select pg_temp.verifier('la même version rejouée : sans erreur, rien ne change',
  :'ERROR' = 'false' and public._autonomie_version_conditions() = :'hier', :'ERROR');

-- 3. Retour : tout se referme ----------------------------------------------------------------------------------------
\i :retour2
select pg_temp.verifier('retour : joué sans erreur, la sentinelle revient',
  :'ERROR' = 'false' and public._autonomie_version_conditions() = '9999-12-31',
  :'ERROR' || ' / ' || public._autonomie_version_conditions());
select pg_temp.verifier('retour : définition et droits identiques à ceux de la migration 1',
  md5(pg_get_functiondef('public._autonomie_version_conditions()'::regprocedure)) = :'def_m1'
  and coalesce((select proacl::text from pg_proc where oid = 'public._autonomie_version_conditions()'::regprocedure), '') = :'acl_m1');
select pg_temp.essai('preuve.version.t1@example.invalid', :p, format('select public.autonomie_tracer_cours(%L, 30, false, null)::text', :'k')) as r_t1b \gset
select pg_temp.verifier('retour : T1 n''écrit plus rien (toujours une lecture, 30 s)',
  :'r_t1b' = 'OK false' and (select count(*) from cours_lectures where stagiaire_id = :t1) = 1
  and (select sum(secondes) from autonomie_temps where stagiaire_id = :t1) = 30, :'r_t1b');
\i :retour2
select pg_temp.verifier('retour rejoué : sans erreur, la sentinelle reste', :'ERROR' = 'false'
  and public._autonomie_version_conditions() = '9999-12-31', :'ERROR');

-- Verdict ----------------------------------------------------------------------------------------------------------
-- Un contrôle dont l'instruction échoue (ON_ERROR_ROLLBACK l'annule) ne laisse aucune ligne : le verdict exige donc le
-- nombre exact de contrôles écrits dans ce fichier (23), sinon il compte les manquants comme des échecs.
do $verdict$
declare v_ok integer; v_ko integer; v_liste text; v_attendus constant integer := 23; v_n integer;
begin
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat <> 'ok'),
         string_agg(case when etat <> 'ok' then num || '. ' || libelle || ' [' || detail || ']' end, ' | ' order by num), count(*)
    into v_ok, v_ko, v_liste, v_n from pv;
  if v_n <> v_attendus then
    v_ko := v_ko + abs(v_attendus - v_n);
    v_liste := concat_ws(' | ', v_liste, format('%s contrôle(s) sur %s seulement : une instruction de contrôle a échoué (voir la sortie de psql)', v_n, v_attendus));
  end if;
  if v_ko = 0 then
    raise exception using message = format('VERT %s/0', v_ok);
  end if;
  raise exception using message = format('ROUGE %s/%s : %s', v_ok, v_ko, v_liste);
end $verdict$;
rollback;
