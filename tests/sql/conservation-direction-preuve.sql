-- Preuve de la migration 20261111_conservation_direction (les deux étapes de conservation de Q5 ouvertes à la direction d'un
-- centre, pour les promos de son centre). Rejouable : le bloc lève TOUJOURS une exception à la fin (verdict « VERT n/0 » ou
-- « ROUGE ok/ko : cas »), tout est annulé. Données 100 % fictives (example.invalid, noms « Preuve »).
--
-- Méthode (mémoire « Répétition de migration dans la preuve SQL ») : la migration et son retour sont joués PAR EXECUTE dans le
-- bloc DO, entre deux empreintes md5 du schéma public (tables, colonnes, contraintes, fonctions et leurs droits, règles,
-- déclencheurs) et des données ; la levée finale annule tout. Les étapes se jouent dans une sous-transaction annulée (les cas
-- sont recopiés avant l'annulation) : la base revient à l'état « migration appliquée, rien effacé », sur lequel le retour est
-- joué puis l'empreinte comparée. Si la migration est déjà appliquée (_peut_conserver_promo existe), la preuve joue les mêmes
-- cas sans rejouer migration ni retour.
-- Le jour : les étapes lisent _questionnaire_jour() (lot Q3) ; dans la sous-transaction, la preuve la remplace par une version
-- qui lit le réglage preuve.jour (vide : le vrai jour), pour jouer la veille et le jour exact de chaque étape (promos finies le
-- 11/12/2026 : étape 1 le 11/12/2027, étape 2 le 01/01/2030). Le remplacement part avec l'annulation.
-- Le retour de Q5 (variable retour_q5, facultative : vide, le cas est sauté) est joué après une étape lancée par la direction :
-- il doit rester refusé (une trace au journal, quelle que soit la personne).
-- Pour Supabase (base réelle) : aucun set_config de session_replication_role ; profils avant comptes, tous avec un rôle ;
-- pg_read_file remplacés par le texte des fichiers.
--
-- Ordre réel (11/11/2026, 18 h 27) : lot 4, suite du lot 5 jusqu'à 20261111_espaces_4_donnees, navigation unique 1, 2 et 3,
-- Qualiopi Q5 (20261110_conservation), puis titres et droits étape 1 (20261112_titres_1 à _3 ; la _4, journal, n'est pas
-- appliquée). La condition de la direction passe par geste_centre(lieu, 'donnees.purger') des titres : la preuve ne se joue
-- donc que sur une base qui a les migrations des titres. Base locale jetable (outils/base_locale, jamais la production) :
--   export PATH=<postgresql>/bin:$PATH PGCLIENTENCODING=UTF8
--   bash outils/base_locale/reconstruire.sh --port <p> --donnees <dossier hors dépôt>
--   bash outils/base_locale/rejouer_suite.sh --port <p>                      (jusqu'à Q5 comprise)
--   psql -h 127.0.0.1 -p <p> -U postgres -d postgres -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261112_titres_1_tables.sql
--   (de même 20261112_titres_2_gestes.sql puis 20261112_titres_3_regles.sql)
--   psql -h 127.0.0.1 -p <p> -U postgres -d postgres -1 -v migration=<chemin absolu de 20261111_conservation_direction.sql> \
--        -v retour=<chemin absolu de 20261111_conservation_direction_retour.sql> \
--        -v retour_q5=<chemin absolu de 20261110_conservation_retour.sql> -f tests/sql/conservation-direction-preuve.sql
-- Contre-épreuves : la même commande avec une copie de la migration où une garde est retirée (ROUGE attendu).
-- Relecture du 11/11 (correctif critique) : une direction qui recule la date de fin d'une promo en cours (modifier_dates_promo)
-- est refusée ; chaque source d'activité datée après la fin bloque la direction à elle seule ; une activité le jour même de la fin
-- ne bloque pas ; le fondateur garde la règle de Q5 ; l'en-tête x-apercu-role d'une direction n'ouvre rien hors de son centre.
-- Relecture ciblée (cycle 2) : sources ajoutées (signatures d'émargement, essais de QCM, livret, dossier professionnel, audits des
-- notes et des passages : une suppression tardive bloque, une modification non ; fiche de suivi si la table existe), la date de
-- création des fiches n'est plus lue ; fondateur en aperçu direction bloqué par une activité ; direction, date de fin nulle.
-- Les dates de création et d'activité des données de la preuve sont posées en dur (rejouable à toute date).

select length(set_config('preuve.migration', pg_read_file(:'migration'), false)) as migration_lue,
       length(set_config('preuve.retour', pg_read_file(:'retour'), false)) as retour_lu,
       length(set_config('preuve.retour_q5', coalesce(pg_read_file(nullif(:'retour_q5', '')), ''), false)) as retour_q5_lu;

set local lock_timeout = '3s';

do $preuve$
declare
  v_deja boolean := to_regprocedure('public._peut_conserver_promo(integer)') is not null;
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
      select 'fn ' || p.oid::regprocedure::text || ' '
             || md5(replace(pg_get_functiondef(p.oid), chr(13), ''))
             || ' ' || coalesce(p.proacl::text, '')
        from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
      union all
      select 'pol ' || tablename || ' ' || policyname || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
        from pg_policies where schemaname = 'public'
      union all
      select 'trg ' || tgrelid::regclass::text || ' ' || tgname from pg_trigger t
        join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
      union all
      select 'donnees ' || pg_temp.donnees()
    ) e(x) $q$;
  -- Fonctions que ce lot ne doit pas toucher (fondateur seul) : leur définition et leurs droits avant et après la migration.
  v_intactes text[] := array['public.etat_conservation()', 'public.effacer_sur_demande(integer)',
    'public.clore_annee_formateurs(integer, integer)', 'public.effacer_commentaires_formateurs(integer, integer)',
    'public.figer_questionnaire_formateurs(integer, integer)', 'public.effacer_registre_qualite()',
    'public._effacer_etape1(integer)', 'public._effacer_etape2(integer)', 'public.benevoles_a_purger(integer)',
    'public.purger_benevoles(integer[], integer)', 'public.peut_gerer_qualite()', 'public.geste_centre(integer, text)'];
  v_garde_q5 constant text := $g$
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_promo is null or not peut_acceder_promo(p_promo) then
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
$g$;
  v_garde_lot constant text := $g$
  -- Fondateur (garde de Q5) ou direction du centre de la promo (_peut_conserver_promo) ; les refus restent ceux de Q5.
  if p_promo is null or not _peut_conserver_promo(p_promo) then
    if not peut_gerer_qualite() then
      raise exception 'conservation: Réservé à la gestion de la qualité.';
    end if;
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
$g$;
  v_verrou_q5 constant text := $g$
  select * into p from promos where id = p_promo for no key update;
$g$;
  v_verrou_lot constant text := $g$
  select * into p from promos where id = p_promo for no key update;
  -- Direction (hors fondateur) : la date de fin, qu'elle peut modifier, ne suffit pas. Aucune activité de la promo ne doit être
  -- datée après sa fin (_activite_apres_fin), relue après le verrou : un changement de dates simultané attend la fin de l'étape.
  if not (peut_gerer_qualite() and peut_acceder_promo(p_promo)) and _activite_apres_fin(p_promo) is not null then
    raise exception 'conservation: Des activités de cette promo sont datées après sa date de fin (jusqu''au %) : si cette date est fausse, corrigez-la ; sinon, demandez cet effacement au fondateur.', to_char(_activite_apres_fin(p_promo), 'DD/MM/YYYY');
  end if;
$g$;
  REFUS_A text;
  PA3 integer; SA3 integer;
  md5_avant text; md5_apres text; photo_avant text; photo_apres text; intactes_avant text; intactes_apres text;
  etapes_avant text[]; etapes_apres text[];
  LA integer; LB integer; PA1 integer; PA2 integer; PB1 integer; SA1 integer; SA2 integer; SB1 integer;
  r text; r2 text; t text; j jsonb; n bigint; m bigint; d1 text;
  c record; v_ok integer; v_ko integer; v_detail text; v_sauve jsonb; v_erreur text;
  REFUS_Q constant text := '%conservation: Réservé à la gestion de la qualité.';
  REFUS_P constant text := '%conservation: Cette promo n''est pas dans votre périmètre.';
  REFUS_C constant text := '%conservation: Réservé à la direction du centre.';
begin
  -- 0. Outils de la preuve (schéma temporaire, annulés avec le reste) ------------------------------------------------
  execute $q$
    create table pg_temp.preuve_comptes (nom text primary key, email text not null, uid uuid not null, fiche integer);
    create table pg_temp.preuve_cas (n integer primary key, cas text not null, bon boolean not null, detail text);
    grant select on pg_temp.preuve_comptes to authenticated, anon;
    grant select, insert on pg_temp.preuve_cas to authenticated, anon;
    -- Se connecter sous un compte fictif (nul : sans session), avec la promo affichée (en-tête x-promo-id) si donnée.
    create function pg_temp.qui(p_nom text, p_promo integer default null) returns void language plpgsql as $f$
    declare c record;
    begin
      perform set_config('request.headers', case when p_promo is null then ''
        else jsonb_build_object('x-promo-id', p_promo::text)::text end, true);
      if p_nom is null then perform set_config('request.jwt.claims', '', true); return; end if;
      select * into c from pg_temp.preuve_comptes where nom = p_nom;
      perform set_config('request.jwt.claims', json_build_object('email', c.email, 'sub', c.uid)::text, true);
    end $f$;
    -- Aperçu du lot 4 (en-têtes x-apercu-role et x-promo-id), pour le compte connecté.
    create function pg_temp.apercu(p_role text, p_promo integer default null) returns void language sql as $f$
      select set_config('request.headers', case when p_role is null then '' else
        jsonb_strip_nulls(jsonb_build_object('x-apercu-role', p_role, 'x-promo-id', p_promo::text))::text end, true);
    $f$;
    -- Jouer une requête sous le rôle courant : « ok <valeur> » ou « code message ». Chaque appel est une sous-transaction.
    create function pg_temp.tente(p_sql text) returns text language plpgsql as $f$
    declare v text;
    begin
      execute p_sql into v;
      return 'ok ' || coalesce(v, '');
    exception when others then
      return sqlstate || ' ' || sqlerrm;
    end $f$;
    -- Comme tente(), mais toujours annulé : rien ne reste, même quand l'écriture passe.
    create function pg_temp.tente_blanc(p_sql text) returns text language plpgsql as $f$
    declare r text;
    begin
      begin
        r := pg_temp.tente(p_sql);
        raise exception 'preuve: annulé';
      exception when others then
        if sqlerrm <> 'preuve: annulé' then raise; end if;
      end;
      return r;
    end $f$;
    create function pg_temp.res(p text) returns jsonb language sql as $f$
      select case when p like 'ok {%' then substr(p, 4)::jsonb end;
    $f$;
    create function pg_temp.cas(p_cas text, p_bon boolean, p_detail text default null) returns void language sql as $f$
      insert into pg_temp.preuve_cas (n, cas, bon, detail)
      select coalesce(max(n), 0) + 1, p_cas, coalesce(p_bon, false), p_detail from pg_temp.preuve_cas;
    $f$;
    create function pg_temp.jour(p date) returns void language sql as $f$
      select set_config('preuve.jour', coalesce(p::text, ''), true);
    $f$;
    -- Données des tables que les étapes touchent.
    create function pg_temp.donnees() returns text language plpgsql as $f$
    declare t text; v text; acc text := '';
    begin
      foreach t in array array['lieux', 'promos', 'stagiaires', 'user_profiles', 'affectations', 'stagiaires_prive',
                               'dp_dossiers', 'epcf_livrets', 'evaluations', 'epcf_evaluations', 'passages',
                               'emargement_seances', 'emargement_lignes', 'emargement_formateurs', 'effacements_journal',
                               'questionnaire_reponses', 'questionnaire_participations', 'conditions_acceptations'] loop
        if to_regclass('public.' || t) is null then acc := acc || t || '=absente '; continue; end if;
        execute format('select md5(coalesce(string_agg(to_jsonb(x)::text, '','' order by to_jsonb(x)::text), '''')) from public.%I x', t) into v;
        acc := acc || t || '=' || v || ' ';
      end loop;
      select md5(coalesce(string_agg(u::text, ',' order by u::text), '')) into v from auth.users u;
      return acc || 'auth.users=' || v;
    end $f$;
    -- État d'une fiche, en une ligne : marques, compte, date de naissance, nom.
    create function pg_temp.fiche(p_id integer) returns text language sql as $f$
      select concat_ws(' ',
        'efface:' || (s.efface_le is not null), 'anonyme:' || (s.anonymise_le is not null),
        'profil:' || (select count(*) from public.user_profiles where stagiaire_id = p_id),
        'naissance:' || (select count(date_naissance) from public.stagiaires_prive where stagiaire_id = p_id),
        'nom:' || coalesce(s.nom, '-'))
        from public.stagiaires s where s.id = p_id;
    $f$;
    grant execute on all functions in schema pg_temp to authenticated, anon;
  $q$;

  -- 1. Données fictives -------------------------------------------------------------------------------------------------
  -- LA : centre de la direction DA, promos PA1 (finie le 11/12/2026) et PA2 (sans date de fin). LB : centre de la direction DB,
  -- promo PB1 (mêmes dates que PA1).
  insert into lieux (nom) values ('Preuve direction A') returning id into LA;
  insert into lieux (nom) values ('Preuve direction B') returning id into LB;
  -- PA3 : promo de A en formation (fin le 30/06/2027), avec des créneaux, une séance, une note et un passage (relecture du 11/11).
  insert into promos (lieu_id, nom, date_debut, date_fin, created_at) values (LA, 'Preuve A finie', date '2026-03-02', date '2026-12-11', timestamptz '2026-02-15 10:00+01') returning id into PA1;
  insert into promos (lieu_id, nom, date_debut, date_fin, created_at) values (LA, 'Preuve A sans date', date '2026-09-01', null, timestamptz '2026-08-15 10:00+02') returning id into PA2;
  insert into promos (lieu_id, nom, date_debut, date_fin, created_at) values (LB, 'Preuve B finie', date '2026-03-02', date '2026-12-11', timestamptz '2026-02-15 10:00+01') returning id into PB1;
  insert into promos (lieu_id, nom, date_debut, date_fin, created_at) values (LA, 'Preuve A en formation', date '2026-09-07', date '2027-06-30', timestamptz '2026-08-20 10:00+02') returning id into PA3;
  insert into stagiaires (prenom, nom, promo_id, actif, created_at) values ('Preuve Alba', 'PREUVENOM', PA1, true, timestamptz '2026-02-20 10:00+01') returning id into SA1;
  insert into stagiaires (prenom, nom, promo_id, actif, created_at) values ('Preuve Basile', 'PREUVENOM', PA1, false, timestamptz '2026-02-20 10:00+01') returning id into SA2;
  insert into stagiaires (prenom, nom, promo_id, actif, created_at) values ('Preuve Corto', 'PREUVENOM', PB1, true, timestamptz '2026-02-20 10:00+01') returning id into SB1;
  insert into stagiaires (prenom, nom, promo_id, actif, created_at) values ('Preuve Dora', 'PREUVENOM', PA3, true, timestamptz '2026-08-25 10:00+02') returning id into SA3;
  insert into evaluations (stagiaire_id, promo_id, type, note, date_eval) values (SA3, PA3, 'Thème', 14, date '2026-11-05');
  insert into passages (stagiaire_id, promo_id, date, type, resultat) values (SA3, PA3, date '2026-11-09', 'Voiture', 'Effectué');
  insert into planning_entries (semaine_lundi, day_index, half_day, slot, promo_id) values (date '2027-01-11', 4, 'matin', 0, PA3);
  insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_par)
  values (PA3, date '2026-11-10', 'matin', '08:30', '12:00', 'ouverte', 'preuve.consdir.form@example.invalid');
  insert into stagiaires_prive (stagiaire_id, date_naissance) values (SA1, date '1990-01-01'), (SB1, date '1991-02-02');
  insert into evaluations (stagiaire_id, promo_id, type, note, observation, date_eval)
  values (SA1, PA1, 'Thème', 12, 'Observation preuve', date '2026-10-01'), (SB1, PB1, 'Thème', 13, 'Observation preuve', date '2026-10-01');

  -- Comptes : FO fondateur ; DA direction de LA ; DB direction de LB ; FORM formateur de PA1 ; SIEGE siège ; EA1 et EB1 les
  -- comptes des fiches SA1 et SB1. Profils d'abord, puis comptes.
  insert into pg_temp.preuve_comptes (nom, email, uid, fiche)
  select k, 'preuve.consdir.' || lower(k) || '@example.invalid', gen_random_uuid(),
         case k when 'EA1' then SA1 when 'EB1' then SB1 end
    from unnest(array['FO', 'DA', 'DB', 'FORM', 'SIEGE', 'EA1', 'EB1']) k;
  insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id)
  select k.email, case when k.nom = 'FO' then 'admin' when k.fiche is null then 'prof' else 'stagiaire' end,
         k.nom in ('FO', 'FORM'), k.nom = 'FO', k.fiche
    from pg_temp.preuve_comptes k;
  insert into auth.users (id, email) select uid, email from pg_temp.preuve_comptes;
  insert into affectations (email, role, promo_id, lieu_id)
  select k.email, v.role, v.promo, v.lieu
    from (values ('DA', 'direction', null::integer, LA), ('DB', 'direction', null, LB), ('FORM', 'formateur', PA1, null),
                 ('SIEGE', 'siege', null, null)) v(nom, role, promo, lieu)
    join pg_temp.preuve_comptes k on k.nom = v.nom;

  -- 2. Migration jouée entre deux empreintes ----------------------------------------------------------------------------
  select string_agg(f || '=' || md5(replace(pg_get_functiondef(f::regprocedure), chr(13), '')) || coalesce(
           (select proacl::text from pg_proc where oid = f::regprocedure), ''), ' ' order by f)
    into intactes_avant from unnest(v_intactes) f;
  if not v_deja then
    etapes_avant := array[md5(replace(pg_get_functiondef('public.effacer_promo_etape1(integer)'::regprocedure), chr(13), '')),
                          md5(replace(pg_get_functiondef('public.effacer_promo_etape2(integer)'::regprocedure), chr(13), ''))];
    execute v_empreinte into md5_avant;
    photo_avant := pg_temp.donnees();
    if btrim(coalesce(current_setting('preuve.migration', true), ''), E' \t\r\n') <> '' then
      execute current_setting('preuve.migration');
    end if;
    photo_apres := pg_temp.donnees();
    perform pg_temp.cas('la migration seule ne change aucune donnée', photo_apres = photo_avant, null);
    select string_agg(f || '=' || md5(replace(pg_get_functiondef(f::regprocedure), chr(13), '')) || coalesce(
             (select proacl::text from pg_proc where oid = f::regprocedure), ''), ' ' order by f)
      into intactes_apres from unnest(v_intactes) f;
    perform pg_temp.cas('etat_conservation, effacer_sur_demande, fonctions des formateurs, registre, bénévoles, gestes : inchangés (définition et droits)',
      intactes_apres = intactes_avant, null);
  end if;

  -- 3. Catalogue -----------------------------------------------------------------------------------------------------------
  perform pg_temp.cas('les quatre fonctions du lot existent',
    to_regprocedure('public._activite_apres_fin(integer)') is not null
    and to_regprocedure('public._peut_conserver_promo(integer)') is not null
    and to_regprocedure('public._peut_conserver_centre(integer)') is not null
    and to_regprocedure('public.etat_conservation_centre(integer)') is not null, null);
  if to_regprocedure('public.etat_conservation_centre(integer)') is not null then
    select string_agg(coalesce(proacl::text, 'nul'), ' ' order by oid) into t
      from pg_proc where oid in ('public._peut_conserver_promo(integer)'::regprocedure, 'public._peut_conserver_centre(integer)'::regprocedure,
                   'public._activite_apres_fin(integer)'::regprocedure);
    perform pg_temp.cas('fonctions internes : aucun droit d''exécution pour anon, authenticated, service_role, public (propriétaire seul)',
      (select bool_and(not has_function_privilege(rl, f, 'execute'))
         from unnest(array['anon', 'authenticated', 'service_role']) rl,
              unnest(array['public._peut_conserver_promo(integer)', 'public._peut_conserver_centre(integer)',
                           'public._activite_apres_fin(integer)']) f)
      and (select bool_and(proacl is not null and array_length(proacl, 1) = 1 and proacl[1]::text like (pg_get_userbyid(proowner) || '=X/%'))
             from pg_proc where oid in ('public._peut_conserver_promo(integer)'::regprocedure, 'public._peut_conserver_centre(integer)'::regprocedure,
                   'public._activite_apres_fin(integer)'::regprocedure)),
      t);
    perform pg_temp.cas('etat_conservation_centre : authenticated et service_role oui, anon non',
      has_function_privilege('authenticated', 'public.etat_conservation_centre(integer)', 'execute')
      and has_function_privilege('service_role', 'public.etat_conservation_centre(integer)', 'execute')
      and not has_function_privilege('anon', 'public.etat_conservation_centre(integer)', 'execute'), null);
    perform pg_temp.cas('les trois fonctions du lot : security definer, search_path public puis pg_temp',
      (select bool_and(p.prosecdef and p.proconfig = array['search_path=public, pg_temp'])
         from pg_proc p where p.oid in ('public._peut_conserver_promo(integer)'::regprocedure,
                                        'public._peut_conserver_centre(integer)'::regprocedure,
                                        'public.etat_conservation_centre(integer)'::regprocedure)), null);
  end if;
  perform pg_temp.cas('étapes 1 et 2 : droits d''exécution de Q5 gardés (authenticated et service_role oui, anon non)',
    (select bool_and(has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')
                     and not has_function_privilege('anon', f, 'execute'))
       from unnest(array['public.effacer_promo_etape1(integer)', 'public.effacer_promo_etape2(integer)']) f), null);
  perform pg_temp.cas('étapes 1 et 2 : la garde passe par _peut_conserver_promo, la garde de Q5 n''y est plus',
    (select bool_and(position('_peut_conserver_promo(p_promo)' in pg_get_functiondef(f::regprocedure)) > 0
                     and position(v_garde_q5 in replace(pg_get_functiondef(f::regprocedure), chr(13), '')) = 0)
       from unnest(array['public.effacer_promo_etape1(integer)', 'public.effacer_promo_etape2(integer)']) f), null);
  perform pg_temp.cas('la condition de la direction n''est écrite qu''à un endroit : _peut_conserver_centre (geste donnees.purger)',
    (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
        and position('''donnees.purger''' in pg_get_functiondef(p.oid)) > 0
        and p.proname in ('_peut_conserver_promo', '_peut_conserver_centre', 'etat_conservation_centre',
                          'effacer_promo_etape1', 'effacer_promo_etape2')) = 1
    and position('geste_centre(p_lieu, ''donnees.purger'')' in coalesce(pg_get_functiondef(to_regprocedure('public._peut_conserver_centre(integer)')), '')) > 0,
    null);
  if not v_deja then
    -- Même corps que Q5 : la garde de ce lot remplacée par celle de Q5 redonne exactement la définition d'avant.
    select array_agg(md5(replace(replace(replace(pg_get_functiondef(f::regprocedure), chr(13), ''), v_verrou_lot, v_verrou_q5),
                                 v_garde_lot, v_garde_q5)) order by o)
      into etapes_apres from unnest(array['public.effacer_promo_etape1(integer)', 'public.effacer_promo_etape2(integer)'])
           with ordinality u(f, o);
    perform pg_temp.cas('étapes 1 et 2 : même corps que Q5 (seuls la garde et le contrôle des activités changent)',
      etapes_avant = etapes_apres, array_to_string(etapes_avant || etapes_apres, ' '));
  end if;

  -- 4. Les étapes, dans une sous-transaction annulée -----------------------------------------------------------------------
  begin
    execute $q$
      create or replace function public._questionnaire_jour() returns date language sql stable
      set search_path to 'public', 'pg_temp' as $f$
        select coalesce(nullif(current_setting('preuve.jour', true), '')::date, (now() at time zone 'Europe/Paris')::date);
      $f$;
    $q$;
    set local role authenticated;

    -- 4.1 La veille de l'étape 1 (10/12/2027) : refusée, rien ne change.
    perform pg_temp.jour(date '2027-12-10');
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA1));
    perform pg_temp.cas('direction de A : étape 1 de PA1 refusée la veille (10/12/2027)', r like '%conservation: Possible à partir du 11/12/2027.', r);

    -- 4.2 Le jour de l'étape 1 (11/12/2027) : l'état du centre A, et les refus.
    perform pg_temp.jour(date '2027-12-11');
    j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA)));
    perform pg_temp.cas('etat_conservation_centre(A) pour la direction de A : les promos de A seulement (PA1, PA2, PA3), jour du 11/12/2027',
      j is not null and j ->> 'jour' = '2027-12-11'
      and (select string_agg(p ->> 'id', ',' order by (p ->> 'id')::int) from jsonb_array_elements(j -> 'promos') p) = PA1 || ',' || PA2 || ',' || PA3,
      coalesce(j::text, 'refusée'));
    j := (select p from jsonb_array_elements(j -> 'promos') p where (p ->> 'id')::int = PA1);
    perform pg_temp.cas('etat_conservation_centre : PA1 avec ses dates et ses nombres, même forme que etat_conservation()',
      j is not null and j ->> 'etape1_du' = '2027-12-11' and j ->> 'etape2_du' = '2030-01-01' and j ->> 'date_fin' = '2026-12-11'
      and (j ->> 'a_effacer_etape1')::int = 2 and (j ->> 'a_effacer_etape2')::int = 2 and (j ->> 'comptes_equipe')::int = 0
      and j ->> 'lieu_nom' = 'Preuve direction A' and j ? 'emargement_etape2' and j ->> 'nom' = 'Preuve A finie'
      and (select array_agg(k order by k) from jsonb_object_keys(j) k)
          = array['a_effacer_etape1', 'a_effacer_etape2', 'comptes_equipe', 'date_fin', 'emargement_etape2', 'etape1_du',
                  'etape2_du', 'fin_contredite_le', 'id', 'lieu_nom', 'nom']
      and j -> 'fin_contredite_le' = 'null'::jsonb,
      coalesce(j::text, 'absente'));
    j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA)));
    perform pg_temp.cas('etat_conservation_centre : portées des formateurs vides, registre nul, aucun nom de personne',
      j -> 'portees_formateurs' = '[]'::jsonb and j -> 'registre' = 'null'::jsonb and position('PREUVENOM' in j::text) = 0
      and position('Alba' in j::text) = 0, coalesce(j::text, 'refusée'));
    reset role;
    d1 := pg_temp.donnees();
    set local role authenticated;
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LB));
    perform pg_temp.cas('direction de A : etat_conservation_centre(B) refusé', r like REFUS_C, r);
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PB1));
    r2 := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PB1));
    perform pg_temp.cas('direction de A : étapes 1 et 2 d''une promo de B refusées (refus de Q5)', r like REFUS_Q and r2 like REFUS_Q, r || ' | ' || r2);
    r := pg_temp.tente('select public.effacer_promo_etape1(null)::text');
    perform pg_temp.cas('direction de A : étape 1 d''une promo nulle refusée (refus de Q5)', r like REFUS_Q, r);
    foreach t in array array[format('select public.effacer_sur_demande(%s)::text', SA1),
                             'select public.etat_conservation()::text',
                             format('select public.clore_annee_formateurs(%s, 2026)::text', LA),
                             format('select public.effacer_commentaires_formateurs(%s, 2026)::text', LA),
                             format('select public.figer_questionnaire_formateurs(%s, 2026)::text', LA)] loop
      r := pg_temp.tente(t);
      perform pg_temp.cas('direction de A : ' || split_part(split_part(t, 'public.', 2), '(', 1) || ' refusé (fondateur seul)', r like REFUS_Q, r);
    end loop;
    r := pg_temp.tente('select public.effacer_registre_qualite()::text');
    perform pg_temp.cas('direction de A : effacer_registre_qualite refusé (fondateur seul)', r not like 'ok%', r);
    r := pg_temp.tente(format('select public._peut_conserver_promo(%s)::text', PA1))
         || ' | ' || pg_temp.tente(format('select public._peut_conserver_centre(%s)::text', LA))
         || ' | ' || pg_temp.tente(format('select public._activite_apres_fin(%s)::text', PA1));
    perform pg_temp.cas('direction de A : les fonctions internes ne s''appellent pas (42501)', r like '42501%| 42501%| 42501%', r);
    reset role;
    perform pg_temp.cas('aucun refus n''a rien changé', pg_temp.donnees() = d1, null);
    set local role authenticated;

    -- 4.2 bis Relecture du 11/11 : l'activité après la date de fin bloque la direction, jamais le fondateur.
    REFUS_A := '%conservation: Des activités de cette promo sont datées après sa date de fin (jusqu''au @) : si cette date est fausse, corrigez-la ; sinon, demandez cet effacement au fondateur.';
    -- Chaque source, seule, sur PA1 (finie le 11/12/2026) : une ligne datée du 15/01/2027. « bloque » : la direction est refusée et
    -- la date est dite ; « passe » : l'étape se fait (2 fiches). La fiche de suivi n'est jouée que si sa table existe.
    for c in select * from (values
        ('bloque', 'création de la promo', format('update promos set created_at = timestamptz ''2027-01-15 10:00+01'' where id = %s', PA1)),
        ('bloque', 'séance d''émargement', format('insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_par) values (%s, date ''2027-01-15'', ''matin'', ''08:30'', ''12:00'', ''ouverte'', ''preuve@example.invalid'')', PA1)),
        ('bloque', 'signature d''émargement', format('with s as (insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_par) values (%s, date ''2026-12-10'', ''matin'', ''08:30'', ''12:00'', ''ouverte'', ''preuve@example.invalid'') returning id) insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par, maj_par) select s.id, %s, %s, ''M10 10L20 20L30 25'', timestamptz ''2027-01-15 10:00+01'', ''preuve@example.invalid'', ''preuve@example.invalid'' from s', PA1, PA1, SA1)),
        ('bloque', 'créneau du planning', format('insert into planning_entries (semaine_lundi, day_index, half_day, slot, promo_id) values (date ''2027-01-11'', 4, ''matin'', 0, %s)', PA1)),
        ('bloque', 'note', format('insert into evaluations (stagiaire_id, promo_id, type, note, date_eval) values (%s, %s, ''Thème'', 10, date ''2027-01-15'')', SA1, PA1)),
        ('bloque', 'évaluation EPCF', format('insert into epcf_evaluations (stagiaire_id, promo_id, trame, date_eval) values (%s, %s, ''salle'', date ''2027-01-15'')', SA1, PA1)),
        ('bloque', 'passage', format('insert into passages (stagiaire_id, promo_id, date, type, resultat) values (%s, %s, date ''2027-01-15'', ''Voiture'', ''Effectué'')', SA1, PA1)),
        ('bloque', 'essai de QCM', format('insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20, finished_at, promo_id) select min(id), %s, ''entrainement'', 1, 2, 10, timestamptz ''2027-01-15 10:00+01'', %s from qcm having min(id) is not null', SA1, PA1)),
        ('bloque', 'livret EPCF', format('insert into epcf_livrets (stagiaire_id, promo_id, updated_at) values (%s, %s, timestamptz ''2027-01-15 10:00+01'')', SA1, PA1)),
        ('bloque', 'dossier professionnel', format('insert into dp_dossiers (stagiaire_id, promo_id, updated_at) values (%s, %s, timestamptz ''2027-01-15 10:00+01'')', SA1, PA1)),
        ('bloque', 'note supprimée après la fin (audit)', format('insert into evaluations_audit (evaluation_id, action, before_data, changed_at, promo_id) values (999999, ''delete'', ''{}'', timestamptz ''2027-01-15 10:00+01'', %s)', PA1)),
        ('bloque', 'passage supprimé après la fin (audit)', format('insert into passages_audit (passage_id, action, before_data, changed_at, promo_id) values (999999, ''delete'', ''{}'', timestamptz ''2027-01-15 10:00+01'', %s)', PA1)),
        ('passe', 'note modifiée après la fin (audit « update »)', format('insert into evaluations_audit (evaluation_id, action, before_data, after_data, changed_at, promo_id) values (999999, ''update'', ''{}'', ''{}'', timestamptz ''2027-01-15 10:00+01'', %s)', PA1)),
        ('passe', 'passage modifié après la fin (audit « update »)', format('insert into passages_audit (passage_id, action, before_data, after_data, changed_at, promo_id) values (999999, ''update'', ''{}'', ''{}'', timestamptz ''2027-01-15 10:00+01'', %s)', PA1)),
        ('passe', 'fiche créée après la fin (date modifiable par la direction : non lue)', format('update stagiaires set created_at = timestamptz ''2027-01-15 10:00+01'' where id = %s', SA2)),
        ('bloque', 'fiche de suivi', case when to_regclass('public.fiches_suivi') is not null then format('insert into fiches_suivi (stagiaire_id, promo_id, updated_at) values (%s, %s, timestamptz ''2027-01-15 10:00+01'')', SA1, PA1) end)
      ) v(attendu, lib, sql) loop
      if c.sql is null then continue; end if;
      r := null;
      begin
        reset role;
        execute c.sql;
        get diagnostics n = row_count;
        if n = 0 then raise exception 'aucune ligne écrite'; end if;
        set local role authenticated;
        perform pg_temp.qui('DA');
        r := pg_temp.tente(format('select public.effacer_promo_etape1(%s) ->> ''fiches''', PA1));
        raise exception 'preuve: annulé';
      exception when others then
        if sqlerrm <> 'preuve: annulé' then r := 'préparation : ' || sqlerrm; end if;
      end;
      if c.attendu = 'bloque' then
        perform pg_temp.cas('activité après la fin (' || c.lib || ') : la direction est refusée, la date est dite',
          r like replace(REFUS_A, '@', '15/01/2027'), r);
      else
        perform pg_temp.cas('jumeau, ' || c.lib || ' : l''étape se fait', r = 'ok 2', r);
      end if;
    end loop;
    -- Fondateur en aperçu direction (promo PA1 affichée) : même chemin que la direction, bloqué par une activité après la fin.
    r := null;
    begin
      reset role;
      execute format('insert into passages (stagiaire_id, promo_id, date, type, resultat) values (%s, %s, date ''2027-01-15'', ''Voiture'', ''Effectué'')', SA1, PA1);
      set local role authenticated;
      perform pg_temp.qui('FO');
      perform pg_temp.apercu('direction', PA1);
      r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA1));
      j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA)));
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then r := 'préparation : ' || sqlerrm; end if;
    end;
    perform pg_temp.cas('fondateur en aperçu direction : bloqué par une activité après la fin, comme la direction (étape et état)',
      r like replace(REFUS_A, '@', '15/01/2027')
      and (select p ->> 'fin_contredite_le' from jsonb_array_elements(j -> 'promos') p where (p ->> 'id')::int = PA1) = '2027-01-15', r);
    -- Direction, date de fin nulle (PA2) : refus de Q5, aucune date contredite dans l'état.
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA2));
    r2 := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA2));
    j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA)));
    perform pg_temp.cas('direction, date de fin nulle : étapes refusées (« Renseignez d''abord la date de fin »), fin_contredite_le nulle',
      r like '%conservation: Renseignez d''abord la date de fin de cette promo.' and r2 like '%conservation: Renseignez d''abord la date de fin de cette promo.'
      and (select p -> 'fin_contredite_le' from jsonb_array_elements(j -> 'promos') p where (p ->> 'id')::int = PA2) = 'null'::jsonb,
      r || ' | ' || r2);
    -- Jumeau : une séance le jour même de la fin ne bloque pas.
    r := null;
    begin
      reset role;
      execute format('insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_par) values (%s, date ''2026-12-11'', ''matin'', ''08:30'', ''12:00'', ''ouverte'', ''preuve@example.invalid'')', PA1);
      set local role authenticated;
      perform pg_temp.qui('DA');
      r := pg_temp.tente(format('select public.effacer_promo_etape1(%s) ->> ''fiches''', PA1));
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then r := 'préparation : ' || sqlerrm; end if;
    end;
    perform pg_temp.cas('jumeau : une séance le jour même de la fin ne bloque pas la direction', r = 'ok 2', r);
    -- La direction recule la date de fin de PA3 (en formation) : la base accepte le changement, puis refuse les étapes.
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.modifier_dates_promo(%s, date ''2020-01-06'', date ''2020-03-31'')::text', PA3));
    perform pg_temp.cas('la direction de A peut reculer la date de fin de PA3 (modifier_dates_promo)', r like 'ok%', r);
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA3));
    r2 := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA3));
    perform pg_temp.cas('date de fin reculée d''une promo en formation : étapes 1 et 2 refusées à la direction',
      r like replace(REFUS_A, '@', '15/01/2027') and r2 like replace(REFUS_A, '@', '15/01/2027'), r || ' | ' || r2);
    reset role;
    perform pg_temp.cas('date de fin reculée : rien n''est effacé de PA3', pg_temp.fiche(SA3) = 'efface:false anonyme:false profil:0 naissance:0 nom:PREUVENOM',
      pg_temp.fiche(SA3));
    set local role authenticated;
    perform pg_temp.qui('DA');
    j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA)));
    perform pg_temp.cas('etat_conservation_centre : PA3 porte fin_contredite_le (dernière activité), PA1 non',
      (select p ->> 'fin_contredite_le' from jsonb_array_elements(j -> 'promos') p where (p ->> 'id')::int = PA3) = '2027-01-15'
      and (select p -> 'fin_contredite_le' from jsonb_array_elements(j -> 'promos') p where (p ->> 'id')::int = PA1) = 'null'::jsonb,
      coalesce(j::text, 'refusée'));
    perform pg_temp.qui('FO');
    r := pg_temp.tente_blanc(format('select public.effacer_promo_etape1(%s) ->> ''fiches''', PA3));
    j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA)));
    perform pg_temp.cas('fondateur : la règle de Q5 telle quelle (étape 1 de PA3 permise, fin_contredite_le nulle)',
      r = 'ok 1' and (select p -> 'fin_contredite_le' from jsonb_array_elements(j -> 'promos') p where (p ->> 'id')::int = PA3) = 'null'::jsonb,
      r);
    -- En-tête x-apercu-role direction envoyé par la direction de A, promo de B affichée : refusée (seul le fondateur a un aperçu).
    perform pg_temp.qui('DA');
    perform pg_temp.apercu('direction', PB1);
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PB1));
    r2 := pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LB));
    perform pg_temp.cas('direction de A avec l''en-tête x-apercu-role direction sur une promo de B : refusée',
      r like REFUS_Q and r2 like REFUS_C, r || ' | ' || r2);
    perform pg_temp.qui('DA');

    -- 4.3 L'étape 1 de PA1 par la direction de A, le jour même.
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA1));
    j := pg_temp.res(r);
    perform pg_temp.cas('direction de A : étape 1 de PA1 le 11/12/2027 acceptée, 2 fiches traitées', (j ->> 'fiches')::int = 2, r);
    reset role;
    perform pg_temp.cas('étape 1 : SA1 a perdu compte et date de naissance, garde son nom ; SB1 (centre B) intact',
      pg_temp.fiche(SA1) = 'efface:true anonyme:false profil:0 naissance:0 nom:PREUVENOM'
      and pg_temp.fiche(SB1) = 'efface:false anonyme:false profil:1 naissance:1 nom:PREUVENOM',
      pg_temp.fiche(SA1) || ' / ' || pg_temp.fiche(SB1));
    select count(*), max(details::text) into n, t from effacements_journal
     where type = 'etape1' and cible = 'promo ' || PA1 and fait_par_email = 'preuve.consdir.da@example.invalid';
    perform pg_temp.cas('journal : une ligne etape1 pour PA1, au nom de l''adresse de la direction', n = 1, n::text);
    perform pg_temp.cas('journal sans nom : aucun prénom ni nom de fiche dans le détail',
      t is not null and position('PREUVENOM' in t) = 0 and position('Alba' in t) = 0 and position('Basile' in t) = 0, t);
    set local role authenticated;
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA1));
    reset role;
    select count(*) into m from effacements_journal where cible = 'promo ' || PA1;
    perform pg_temp.cas('second appel de l''étape 1 : aucune fiche, rien de plus au journal', (pg_temp.res(r) ->> 'fiches')::int = 0 and m = 1, r || ' / ' || m);
    set local role authenticated;
    perform pg_temp.qui('DA');
    j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA)));
    j := (select p from jsonb_array_elements(j -> 'promos') p where (p ->> 'id')::int = PA1);
    perform pg_temp.cas('après l''étape 1 : etat_conservation_centre ne compte plus rien à l''étape 1 de PA1',
      (j ->> 'a_effacer_etape1')::int = 0 and (j ->> 'a_effacer_etape2')::int = 2, coalesce(j::text, 'absente'));
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA1));
    perform pg_temp.cas('direction de A : étape 2 de PA1 refusée avant sa date', r like '%conservation: Possible à partir du 01/01/2030.', r);

    -- 4.4 Le retour de Q5 reste refusé après une étape lancée par la direction ; celui de ce lot reste possible.
    reset role;
    if btrim(current_setting('preuve.retour_q5', true), E' \t\r\n') <> '' then
      r := null;
      begin
        execute current_setting('preuve.retour_q5');
        r := 'joué';
        raise exception 'preuve: annulé';
      exception when others then
        if sqlerrm <> 'preuve: annulé' then r := sqlerrm; end if;
      end;
      perform pg_temp.cas('retour de Q5 refusé après une étape lancée par la direction (journal)',
        r like 'conservation: Retour impossible : une étape de conservation a déjà effacé des données%', r);
    end if;
    if not v_deja then
      r := null;
      begin
        execute current_setting('preuve.retour');
        set local role authenticated;
        perform pg_temp.qui('DA');
        r := 'joué ; ' || pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA1));
        reset role;
        raise exception 'preuve: annulé';
      exception when others then
        if sqlerrm <> 'preuve: annulé' then r := sqlerrm; end if;
      end;
      reset role;
      perform pg_temp.cas('retour de ce lot possible après une étape (il ne retire qu''un droit) ; la direction est ensuite refusée',
        r like 'joué ; %' and r like REFUS_Q, r);
    end if;

    -- 4.5 Au 01/01/2030 (aucune date ne refuse) : qui est refusé, qui est permis.
    perform pg_temp.jour(date '2030-01-01');
    d1 := pg_temp.donnees();
    set local role authenticated;
    for c in select * from (values ('FORM', 'formateur de PA1', PA1, null::text), ('EA1', 'stagiaire de PA1', PA1, null),
                                   ('SIEGE', 'siège', null, null), ('DB', 'direction d''un autre centre', null, null),
                                   ('FO', 'fondateur en aperçu formateur', PA1, 'formateur'),
                                   ('FO', 'fondateur en aperçu siège', PA1, 'siege'),
                                   ('FO', 'fondateur en aperçu stagiaire', PA1, 'stagiaire'),
                                   ('DA', 'direction de A affichant une promo de B (en-tête)', PB1, null),
                                   (null, 'sans session', null, null)) v(nom, lib, promo, apercu) loop
      perform pg_temp.qui(c.nom, c.promo);
      if c.apercu is not null then perform pg_temp.apercu(c.apercu, c.promo); end if;
      if c.nom = 'DA' then
        -- La direction de A garde son centre, quelle que soit la promo affichée : seules les promos de B lui sont refusées.
        r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PB1));
        perform pg_temp.cas(c.lib || ' : étape 2 de PB1 refusée', r like REFUS_Q, r);
        continue;
      end if;
      foreach t in array array[format('select public.effacer_promo_etape1(%s)::text', PA1),
                               format('select public.effacer_promo_etape2(%s)::text', PA1)] loop
        r := pg_temp.tente(t);
        perform pg_temp.cas(format('%s refusé : %s', c.lib, split_part(split_part(t, 'public.', 2), '(', 1)), r like REFUS_Q, r);
      end loop;
      r := pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA));
      perform pg_temp.cas(c.lib || ' refusé : etat_conservation_centre(A)', r like REFUS_C, r);
    end loop;
    reset role;
    perform pg_temp.cas('aucun de ces refus n''a rien changé', pg_temp.donnees() = d1, null);
    set local role authenticated;

    -- Fondateur en aperçu direction (promo affichée PA1) : la condition de la purge des bénévoles (geste_centre(lieu,
    -- 'donnees.purger')) le traite comme la direction du centre affiché, et seulement de celui-là ; même chose ici.
    perform pg_temp.qui('FO');
    perform pg_temp.apercu('direction', PA1);
    r := pg_temp.tente(format('select public.purger_benevoles(''{}''::integer[], %s)::text', LA));
    r2 := pg_temp.tente(format('select public.purger_benevoles(''{}''::integer[], %s)::text', LB));
    perform pg_temp.cas('repère : en aperçu direction sur A, la purge des bénévoles est permise sur A, refusée sur B',
      r = 'ok 0' and r2 like '42501%', r || ' | ' || r2);
    r := pg_temp.tente_blanc(format('select public.effacer_promo_etape2(%s) ->> ''fiches''', PA1));
    r2 := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PB1));
    perform pg_temp.cas('fondateur en aperçu direction sur A : étape 2 de PA1 permise (comme la purge), de PB1 refusée',
      r = 'ok 2' and r2 like REFUS_Q, r || ' | ' || r2);
    r := pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA));
    r2 := pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LB));
    perform pg_temp.cas('fondateur en aperçu direction sur A : etat_conservation_centre(A) permis, (B) refusé',
      r like 'ok {%' and r2 like REFUS_C, left(r, 60) || ' | ' || r2);
    r := pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', SA1));
    perform pg_temp.cas('fondateur en aperçu direction : effacer_sur_demande refusé (fondateur hors aperçu seul)', r like REFUS_Q, r);

    -- Fondateur hors aperçu : toujours permis, partout.
    perform pg_temp.qui('FO');
    r := pg_temp.tente_blanc(format('select public.effacer_promo_etape1(%s) ->> ''fiches''', PB1));
    r2 := pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LB));
    perform pg_temp.cas('fondateur : étape 1 de PB1 permise, etat_conservation_centre(B) permis',
      r = 'ok 1' and r2 like 'ok {%' and (select string_agg(p ->> 'id', ',') from jsonb_array_elements(pg_temp.res(r2) -> 'promos') p) = PB1::text,
      r || ' | ' || left(r2, 80));
    r := pg_temp.tente('select public.effacer_promo_etape1(null)::text') || ' | '
         || pg_temp.tente('select public.effacer_promo_etape1(2000000000)::text');
    perform pg_temp.cas('fondateur : promo nulle ou inconnue refusée comme dans Q5 (« pas dans votre périmètre »)',
      r like REFUS_P || ' | ' || REFUS_P, r);
    r := pg_temp.tente('select public.etat_conservation_centre(null)::text');
    perform pg_temp.cas('fondateur : etat_conservation_centre(null) refusé', r like REFUS_C, r);
    j := pg_temp.res(pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', 2000000000)));
    perform pg_temp.cas('fondateur : centre inconnu, aucune promo', j -> 'promos' = '[]'::jsonb, coalesce(j::text, 'refusé'));

    -- 4.6 L'étape 2 de PA1 par la direction de A, le jour même (01/01/2030).
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA1));
    reset role;
    perform pg_temp.cas('direction de A : étape 2 de PA1 le 01/01/2030 acceptée, nom effacé',
      (pg_temp.res(r) ->> 'fiches')::int = 2 and pg_temp.fiche(SA1) = 'efface:true anonyme:true profil:0 naissance:0 nom:-'
      and pg_temp.fiche(SB1) = 'efface:false anonyme:false profil:1 naissance:1 nom:PREUVENOM', r || ' / ' || pg_temp.fiche(SA1));
    select count(*), max(details::text) into n, t from effacements_journal
     where type = 'etape2' and cible = 'promo ' || PA1 and fait_par_email = 'preuve.consdir.da@example.invalid';
    perform pg_temp.cas('journal : une ligne etape2, sans nom', n = 1 and position('PREUVENOM' in t) = 0 and position('Alba' in t) = 0, n || ' ' || t);
    set local role authenticated;
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA1));
    reset role;
    select count(*) into m from effacements_journal where cible = 'promo ' || PA1;
    perform pg_temp.cas('second appel de l''étape 2 : rien de plus au journal', (pg_temp.res(r) ->> 'fiches')::int = 0 and m = 2, r || ' / ' || m);

    -- 4.7 Rôle anon : aucun droit d'exécution.
    set local role anon;
    perform pg_temp.qui('DA');
    r := pg_temp.tente(format('select public.etat_conservation_centre(%s)::text', LA));
    perform pg_temp.cas('rôle anon refusé (droit d''exécution) : etat_conservation_centre', r like '42501%', r);
    reset role;

    v_sauve := (select jsonb_agg(to_jsonb(x)) from pg_temp.preuve_cas x);
    raise exception 'preuve: annulé';
  exception when others then
    if sqlerrm <> 'preuve: annulé' then
      v_erreur := sqlstate || ' ' || sqlerrm;
      v_sauve := null;
    end if;
  end;
  reset role;
  if v_sauve is not null then
    delete from pg_temp.preuve_cas;
    insert into pg_temp.preuve_cas select * from jsonb_populate_recordset(null::pg_temp.preuve_cas, v_sauve);
  end if;
  if v_erreur is not null then
    perform pg_temp.cas('structure : les étapes se jouent sans erreur imprévue', false, v_erreur);
  end if;
  perform pg_temp.cas('les étapes ont été annulées (aucune ligne de la preuve au journal)',
    (select count(*) from effacements_journal where fait_par_email like 'preuve.consdir.%') = 0, null);

  -- 5. Retour : la base revient à l'identique ----------------------------------------------------------------------------
  if not v_deja then
    r := 'joué';
    if btrim(coalesce(current_setting('preuve.retour', true), ''), E' \t\r\n') <> '' then
      begin
        execute current_setting('preuve.retour');
      exception when others then
        r := sqlstate || ' ' || sqlerrm;
      end;
    end if;
    perform pg_temp.cas('retour joué sans erreur', r = 'joué', r);
    execute v_empreinte into md5_apres;
    perform pg_temp.cas('retour : empreinte du schéma (droits compris) et des données identique à celle d''avant la migration',
      md5_apres = md5_avant, md5_avant || ' / ' || md5_apres);
    perform pg_temp.cas('retour : les quatre fonctions du lot sont parties, la garde de Q5 est revenue',
      to_regprocedure('public._activite_apres_fin(integer)') is null and to_regprocedure('public._peut_conserver_promo(integer)') is null and to_regprocedure('public._peut_conserver_centre(integer)') is null
      and to_regprocedure('public.etat_conservation_centre(integer)') is null
      and (select bool_and(position(v_garde_q5 in replace(pg_get_functiondef(f::regprocedure), chr(13), '')) > 0)
             from unnest(array['public.effacer_promo_etape1(integer)', 'public.effacer_promo_etape2(integer)']) f), null);
  end if;

  -- Verdict -----------------------------------------------------------------------------------------------------------------
  select count(*) filter (where xc.bon), count(*) filter (where not xc.bon),
         string_agg(xc.cas || coalesce(' [' || xc.detail || ']', ''), ' | ' order by xc.n) filter (where not xc.bon)
    into v_ok, v_ko, v_detail from pg_temp.preuve_cas xc;
  if v_ko = 0 then
    raise exception 'VERT %/0 (%)', v_ok, case when v_deja then 'migration déjà appliquée' else 'migration et retour joués' end;
  end if;
  raise exception 'ROUGE %/% : %', v_ok, v_ko, v_detail;
end
$preuve$;
