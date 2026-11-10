-- Preuve de la migration 20261110_conservation (conservation à 3 ans, Qualiopi Q5), partie fiches et émargement.
-- Remplace tests/sql/effacement-preuve.sql (migration du 05/10), qui ne se joue plus après ce lot.
-- Rejouable : le bloc lève TOUJOURS une exception à la fin (verdict « VERT n/0 » ou « ROUGE ok/ko : cas »), tout est
-- annulé. Données 100 % fictives (example.invalid, noms « Preuve »).
--
-- Méthode (mémoire « Répétition de migration dans la preuve SQL ») : la migration et son retour sont joués PAR EXECUTE
-- à l'intérieur du bloc DO, entre deux empreintes md5 du schéma public (tables, colonnes, contraintes, fonctions et leurs
-- droits, règles, déclencheurs) et des données ; la levée finale annule tout. Les étapes elles-mêmes se jouent dans une
-- sous-transaction annulée (les cas sont recopiés avant l'annulation) : la base revient à l'état « migration appliquée,
-- rien effacé », sur lequel le retour est joué puis l'empreinte comparée. Si la migration est déjà appliquée
-- (effacer_sur_demande existe), la preuve joue les mêmes cas sans rejouer migration ni retour.
-- Le jour : les fonctions lisent _questionnaire_jour() (lot Q3) ; dans la sous-transaction, la preuve la remplace par
-- une version qui lit le réglage preuve.jour (vide : le vrai jour), pour jouer les veilles et les lendemains exacts de la
-- promo « Nîmes » (fin le 11/12/2026). Le remplacement part avec l'annulation.
-- Pour Supabase (base réelle) : aucun set_config de session_replication_role ; les profils sont créés avant les comptes
-- (liste blanche d'auth.users) et ont tous un rôle (user_profiles.role NOT NULL) ; pg_read_file remplacés par le texte
-- des fichiers.
--
-- Jouée sur une base LOCALE jetable (Postgres de scoop, authentification « trust ») :
--   D=<dossier temporaire> ; initdb -D $D/pg -U postgres --auth=trust -E UTF8 --no-locale
--   pg_ctl -D $D/pg -o "-p 55517" -l $D/pg.log start ; createdb -p 55517 -U postgres cs
--   export PGCLIENTENCODING=UTF8
--   psql -p 55517 -U postgres -d cs -v ON_ERROR_STOP=1 -v migrations=<chemin absolu de supabase/migrations> \
--        -f tests/sql/conservation-schema-minimal.sql
--   psql -p 55517 -U postgres -d cs -1 -v migration=<chemin absolu de 20261110_conservation.sql> \
--        -v retour=<chemin absolu de 20261110_conservation_retour.sql> -f tests/sql/conservation-preuve.sql
--   pg_ctl -D $D/pg stop ; rm -rf $D
--
-- Résultats du 10/11/2026, tâche 2 (fiches et émargement), Postgres 18.4 local, port 55517, schéma minimal
-- tests/sql/conservation-schema-minimal.sql (détail : rapport de la tâche 2 dans .superpowers/sdd/) :
--   - avant la migration (fichiers de migration et de retour vides) : ROUGE 23/74 ;
--   - migration et retour : VERT 97/0 (trois passages) ; base où la migration est appliquée : VERT 92/0, rien laissé
--     (empreinte du schéma et des données identique avant et après) ;
--   - contre-épreuves, une garde retirée à la fois : date ROUGE 92/5 ; droit (peut_gerer_qualite) ROUGE 62/35 ; lieu
--     (peut_acceder_promo) ROUGE 95/2 ; compte d'équipe, garde des fonctions internes ROUGE 95/2 ; compte d'équipe,
--     garde des boucles de promo ROUGE 77/20 ; actif écrit par l'étape 1 ROUGE 90/7 ; revoke des fonctions internes
--     ROUGE 96/1 ; émargement : signature d'une fiche sans nom ROUGE 95/2, clôture ROUGE 96/1, annotation ROUGE 95/2 ;
--   - retour joué hors preuve (psql -1 -f) : empreinte 265d820a… avant, 6f412e78… migration appliquée, 265d820a… après
--     le retour ; retour refusé (exception) quand le journal porte une ligne « etape1 ».

select length(set_config('preuve.migration', pg_read_file(:'migration'), false)) as migration_lue,
       length(set_config('preuve.retour', pg_read_file(:'retour'), false)) as retour_lu;

set local lock_timeout = '3s';

do $preuve$
declare
  v_jour_reel date := (now() at time zone 'Europe/Paris')::date;
  v_deja boolean := to_regprocedure('public.effacer_sur_demande(integer)') is not null;
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
      select 'donnees ' || pg_temp.donnees()
    ) e(x) $q$;
  md5_avant text; md5_apres text; photo_avant text; photo_apres text;
  L1 integer; L2 integer; PA integer; PB integer; PC integer; PD integer; PE integer; v_prof integer;
  S1 integer; S2 integer; S3 integer; S4 integer; S6 integer; S7 integer; S8 integer; SE integer; SC integer; SX integer;
  feA bigint; feD bigint; feJ bigint; feE bigint; fM bigint; fP bigint;
  r text; t text; j jsonb; n bigint; m bigint; d1 text; d2 text;
  v_avant_S7 text; v_avant_SC text; v_avant_SE text; v_avant_S8 text;
  c record; v_ok integer; v_ko integer; v_detail text; v_sauve jsonb; v_erreur text;
  v_tr constant text := 'M10 10L20 20L30 25';
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
    -- Noter un cas.
    -- Comme tente(), mais toujours annulé (sous-transaction) : rien ne reste, même quand l'écriture passe.
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
    -- Le résultat jsonb d'un appel réussi (nul sinon).
    create function pg_temp.res(p text) returns jsonb language sql as $f$
      select case when p like 'ok {%' then substr(p, 4)::jsonb end;
    $f$;
    -- etat_conservation() pour le compte connecté (nul si refusée ou absente).
    create function pg_temp.etat() returns jsonb language sql as $f$
      select pg_temp.res(pg_temp.tente('select public.etat_conservation()::text'));
    $f$;
    create function pg_temp.cas(p_cas text, p_bon boolean, p_detail text default null) returns void language sql as $f$
      insert into pg_temp.preuve_cas (n, cas, bon, detail)
      select coalesce(max(n), 0) + 1, p_cas, coalesce(p_bon, false), p_detail from pg_temp.preuve_cas;
    $f$;
    -- Le jour vu par les fonctions (_questionnaire_jour remplacée dans la sous-transaction) ; nul : le vrai jour.
    create function pg_temp.jour(p date) returns void language sql as $f$
      select set_config('preuve.jour', coalesce(p::text, ''), true);
    $f$;
    -- État d'une fiche, en une ligne : ce que les étapes doivent effacer ou garder.
    create function pg_temp.fiche(p_id integer) returns text language sql as $f$
      select concat_ws(' ',
        'profil:' || (select count(*) from public.user_profiles where stagiaire_id = p_id),
        'compte:' || (select count(*) from auth.users u join pg_temp.preuve_comptes k on k.uid = u.id where k.fiche = p_id),
        'prive:' || (select count(*) from public.stagiaires_prive where stagiaire_id = p_id),
        'suivi:' || (select count(*) from public.fiches_suivi where stagiaire_id = p_id),
        'textes:' || ((select count(*) from public.evaluations where stagiaire_id = p_id and observation is not null)
                    + (select count(*) from public.epcf_evaluations where stagiaire_id = p_id and commentaire is not null)
                    + (select count(*) from public.passages where stagiaire_id = p_id and commentaire is not null)),
        'emails:' || ((select count(*) from public.evaluations e join pg_temp.preuve_comptes k
                         on lower(e.created_by_email) = k.email where k.fiche = p_id)
                    + (select count(*) from public.conditions_acceptations ca join pg_temp.preuve_comptes k
                         on lower(ca.email) = k.email where k.fiche = p_id)
                    + (select count(*) from public.emargement_lignes l join pg_temp.preuve_comptes k
                         on lower(l.signe_par) = k.email or lower(l.maj_par) = k.email where k.fiche = p_id)),
        'emobs:' || (select count(*) from public.emargement_lignes where stagiaire_id = p_id and observation is not null),
        'dossier:' || (select count(*) from public.dp_dossiers where stagiaire_id = p_id),
        'livret:' || (select count(*) from public.epcf_livrets where stagiaire_id = p_id),
        'traces:' || (select count(*) from public.emargement_lignes where stagiaire_id = p_id and trace is not null),
        'signees:' || (select count(*) from public.emargement_lignes where stagiaire_id = p_id and signe_le is not null),
        'absences:' || (select count(*) from public.emargement_lignes where stagiaire_id = p_id and absent),
        (select 'nom:' || case when s.prenom = 'Anonyme ' || s.id and s.nom is null then 'anonyme' else 'nominatif' end
                || ' actif:' || s.actif
                || ' efface:' || (to_jsonb(s) ->> 'efface_le' is not null)
                || ' anonymise:' || (s.anonymise_le is not null)
           from public.stagiaires s where s.id = p_id));
    $f$;
    grant execute on all functions in schema pg_temp to authenticated, anon;
  $q$;
  -- Données des tables que les étapes touchent (empreinte : contenu ; photo : nombre de lignes et de valeurs non
  -- nulles, hors colonnes nouvelles de ce lot).
  execute $q$
    create function pg_temp.tables_suivies() returns text[] language sql immutable as $f$
      select array['lieux', 'promos', 'stagiaires', 'user_profiles', 'affectations', 'profs', 'settings', 'stagiaires_prive',
                   'dp_dossiers', 'epcf_livrets', 'fiches_suivi', 'epcf_evaluations', 'evaluations', 'evaluations_audit',
                   'passages', 'passages_audit', 'agenda_events', 'qcm_signalements', 'themes', 'themes_progression',
                   'conditions_acceptations', 'planning_jours_off', 'emargement_seances', 'emargement_lignes',
                   'emargement_formateurs', 'effacements_journal', 'questionnaire_participations'];
    $f$;
    create function pg_temp.donnees() returns text language plpgsql as $f$
    declare t text; v text; acc text := '';
    begin
      foreach t in array pg_temp.tables_suivies() loop
        execute format('select md5(coalesce(string_agg(to_jsonb(x)::text, '','' order by to_jsonb(x)::text), '''')) from public.%I x', t) into v;
        acc := acc || t || '=' || v || ' ';
      end loop;
      select md5(coalesce(string_agg(u::text, ',' order by u::text), '')) into v from auth.users u;
      return acc || 'auth.users=' || v;
    end $f$;
    create function pg_temp.photo() returns text language plpgsql as $f$
    declare t text; v text; acc text := '';
    begin
      foreach t in array pg_temp.tables_suivies() loop
        execute format('select count(*) || ''/'' || coalesce(sum((select count(*) from jsonb_each(to_jsonb(x) - ''efface_le'' - ''signature_effacee_le'') e where e.value <> ''null''::jsonb)), 0) from public.%I x', t) into v;
        acc := acc || t || ' ' || v || '; ';
      end loop;
      select count(*) into v from auth.users;
      return acc || 'auth.users ' || v;
    end $f$;
  $q$;

  -- 1. Données fictives (avant la première empreinte : elles ne bougent plus ensuite) ---------------------------------
  insert into lieux (nom) values ('Preuve conservation L1') returning id into L1;
  insert into lieux (nom) values ('Preuve conservation L2') returning id into L2;
  -- PA : « Nîmes », finie le 11/12/2026 (étape 1 le 11/12/2027, étape 2 le 01/01/2030). PB : sans date de fin. PC :
  -- même dates, autre centre. PD : en cours (feuille ouverte aujourd'hui). PE : finie le 11/12/2026, pour l'étape 2
  -- jouée sans étape 1.
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve Nîmes', date '2026-03-02', date '2026-12-11') returning id into PA;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve sans date', date '2026-09-01', null) returning id into PB;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L2, 'Preuve autre centre', date '2026-03-02', date '2026-12-11') returning id into PC;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve en cours', v_jour_reel - 100, v_jour_reel + 60) returning id into PD;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve sans étape 1', date '2026-03-02', date '2026-12-11') returning id into PE;
  insert into profs (nom) values ('Preuve Marie Durand') returning id into v_prof;

  -- Fiches : S1 (PA, active, compte), S2 (PA, abandon, compte), S3 (PA, active, sans compte), SE (PA, compte d'équipe :
  -- affectation formateur sur PB), S4 (PD, active, compte : demande), S7 (PD, active, compte : témoin), S8 (PD, active,
  -- sans compte : témoin de clôture), S6 (PE, compte), SC (PC, compte), SX (PA, anonymisée avant ce lot, sans efface_le).
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Un', 'PREUVE', PA, true) returning id into S1;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Deux', 'PREUVE', PA, false) returning id into S2;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Trois', 'PREUVE', PA, true) returning id into S3;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Equipe', 'PREUVE', PA, true) returning id into SE;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Quatre', 'PREUVE', PD, true) returning id into S4;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Sept', 'PREUVE', PD, true) returning id into S7;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Huit', 'PREUVE', PD, true) returning id into S8;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Six', 'PREUVE', PE, true) returning id into S6;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Preuve Centre', 'PREUVE', PC, true) returning id into SC;
  insert into stagiaires (prenom, nom, promo_id, actif) values ('Anonyme', null, PA, false) returning id into SX;
  -- (sur une base où ce lot est appliqué, la contrainte demande efface_le avec anonymise_le)
  execute format('update stagiaires set prenom = %L, anonymise_le = now() - interval ''1 day''%s where id = %s',
                 'Anonyme ' || SX, case when v_deja then ', efface_le = now() - interval ''1 day''' else '' end, SX);

  -- Comptes : FO fondateur (sans fiche ni affectation), FORM formateur de PA et PD, DIR2 direction du lieu 2, E1, E2, EQ,
  -- E4, E7, E6, EC les comptes des fiches. Profils d'abord (liste blanche de la base réelle), puis comptes.
  insert into pg_temp.preuve_comptes (nom, email, uid, fiche)
  select k, 'preuve.cons.' || lower(k) || '@example.invalid', gen_random_uuid(),
         case k when 'E1' then S1 when 'E2' then S2 when 'EQ' then SE when 'E4' then S4 when 'E7' then S7
                when 'E6' then S6 when 'EC' then SC end
    from unnest(array['FO', 'FORM', 'DIR2', 'E1', 'E2', 'EQ', 'E4', 'E7', 'E6', 'EC']) k;
  insert into user_profiles (email, role, is_admin, is_founder, stagiaire_id, prof_id)
  select k.email,
         case k.nom when 'FO' then 'admin' when 'FORM' then 'prof' when 'DIR2' then 'prof' else 'stagiaire' end,
         k.nom in ('FO', 'FORM'), k.nom = 'FO', k.fiche, case when k.nom = 'FORM' then v_prof end
    from pg_temp.preuve_comptes k;
  insert into auth.users (id, email) select uid, email from pg_temp.preuve_comptes;
  insert into affectations (email, role, promo_id, lieu_id)
  select k.email, v.role, v.promo, v.lieu
    from (values ('FORM', 'formateur', PA, null::integer), ('FORM', 'formateur', PD, null), ('DIR2', 'direction', null, L2),
                 ('EQ', 'formateur', PB, null)) v(nom, role, promo, lieu)
    join pg_temp.preuve_comptes k on k.nom = v.nom;
  insert into settings (promo_id, key, value) values (PD, 'emargement_actif', 'true');

  -- Données personnelles de chaque fiche nominative : date de naissance, fiche de suivi, dossier, livret, trois textes
  -- libres, et, pour un compte, une évaluation signée de son e-mail et une acceptation des conditions.
  for c in select s.id, k.email from stagiaires s left join pg_temp.preuve_comptes k on k.fiche = s.id
            where s.id in (S1, S2, S3, SE, S4, S7, S8, S6, SC) loop
    insert into stagiaires_prive (stagiaire_id, date_naissance) values (c.id, date '1990-01-01');
    insert into fiches_suivi (stagiaire_id, promo_id, besoins)
      select c.id, promo_id, 'Besoin de la fiche preuve' from stagiaires where id = c.id;
    insert into dp_dossiers (stagiaire_id, promo_id, data) select c.id, promo_id, '{"preuve": true}' from stagiaires where id = c.id;
    insert into epcf_livrets (stagiaire_id, promo_id, data) select c.id, promo_id, '{"preuve": true}' from stagiaires where id = c.id;
    insert into evaluations (stagiaire_id, promo_id, type, note, observation, created_by_email)
      select c.id, promo_id, 'Thème', 12, 'Observation preuve', c.email from stagiaires where id = c.id;
    insert into epcf_evaluations (stagiaire_id, promo_id, trame, commentaire)
      select c.id, promo_id, 'salle', 'Commentaire preuve' from stagiaires where id = c.id;
    insert into passages (stagiaire_id, promo_id, date, type, resultat, commentaire)
      select c.id, promo_id, date '2026-10-01', 'Conduite', 'Réussi', 'Commentaire preuve' from stagiaires where id = c.id;
    if c.email is not null then
      insert into conditions_acceptations (email, version) values (c.email, '2026-11-08');
    end if;
  end loop;

  -- Émargement. PA, feuille close du 05/10/2026 : deux formateurs (Paul signe à 9 h, inscrit en premier ; Marie à 8 h 30),
  -- S1 signe lui-même (observation), S2 signé sur l'appareil du formateur (observation), S3 absent (observation), SE
  -- signe, SX (anonymisée par l'ancien bouton, qui ne touchait pas l'émargement) aussi. PD : feuille close d'il y a 7 jours (S4 et S7 signent), feuille ouverte aujourd'hui. PE : S6 signe.
  insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_par, close_le, close_par)
  values (PA, date '2026-10-05', 'matin', '08:30', '12:00', 'close', 'preuve.cons.form@example.invalid',
          timestamptz '2026-10-05 12:05+02', 'preuve.cons.form@example.invalid') returning id into feA;
  insert into emargement_formateurs (seance_id, promo_id, nom, prof_id, trace, signe_le, signe_par)
  values (feA, PA, 'Paul Martin', null, v_tr, timestamptz '2026-10-05 09:00+02', 'preuve.cons.form@example.invalid')
  returning id into fP;
  insert into emargement_formateurs (seance_id, promo_id, nom, prof_id, trace, signe_le, signe_par)
  values (feA, PA, 'Preuve Marie Durand', v_prof, v_tr, timestamptz '2026-10-05 08:30+02', 'preuve.cons.form@example.invalid')
  returning id into fM;
  insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par, sur_appareil_formateur,
                                 absent, absence_origine, observation, maj_par) values
    (feA, PA, S1, v_tr, timestamptz '2026-10-05 08:40+02', 'preuve.cons.e1@example.invalid', false, false, null, 'Arrivé malade', 'preuve.cons.e1@example.invalid'),
    (feA, PA, S2, v_tr, timestamptz '2026-10-05 08:45+02', 'preuve.cons.form@example.invalid', true, false, null, 'Observation S2', 'preuve.cons.form@example.invalid'),
    (feA, PA, S3, null, null, null, false, true, 'formateur', 'Absence excusée', 'preuve.cons.form@example.invalid'),
    (feA, PA, SE, v_tr, timestamptz '2026-10-05 08:50+02', 'preuve.cons.eq@example.invalid', false, false, null, null, 'preuve.cons.eq@example.invalid'),
    (feA, PA, SX, v_tr, timestamptz '2026-10-05 08:55+02', 'preuve.cons.sx@example.invalid', false, false, null, null, 'preuve.cons.sx@example.invalid');
  insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_par, close_le, close_par)
  values (PD, v_jour_reel - 7, 'matin', '08:30', '12:00', 'close', 'preuve.cons.form@example.invalid', now() - interval '7 days',
          'preuve.cons.form@example.invalid') returning id into feD;
  insert into emargement_formateurs (seance_id, promo_id, nom, prof_id, trace, signe_le, signe_par)
  values (feD, PD, 'Preuve Marie Durand', v_prof, v_tr, now() - interval '7 days', 'preuve.cons.form@example.invalid');
  insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par, maj_par) values
    (feD, PD, S4, v_tr, now() - interval '7 days', 'preuve.cons.e4@example.invalid', 'preuve.cons.e4@example.invalid'),
    (feD, PD, S7, v_tr, now() - interval '7 days', 'preuve.cons.e7@example.invalid', 'preuve.cons.e7@example.invalid');
  insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par)
  values (PD, v_jour_reel, 'matin', '08:30', '12:00', 'preuve.cons.form@example.invalid') returning id into feJ;
  insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_par, close_le, close_par)
  values (PE, date '2026-10-05', 'matin', '08:30', '12:00', 'close', 'preuve.cons.form@example.invalid',
          timestamptz '2026-10-05 12:05+02', 'preuve.cons.form@example.invalid') returning id into feE;
  insert into emargement_formateurs (seance_id, promo_id, nom, trace, signe_le, signe_par)
  values (feE, PE, 'Paul Martin', v_tr, timestamptz '2026-10-05 08:30+02', 'preuve.cons.form@example.invalid');
  insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par, maj_par) values
    (feE, PE, S6, v_tr, timestamptz '2026-10-05 08:40+02', 'preuve.cons.e6@example.invalid', 'preuve.cons.e6@example.invalid');

  -- 2. Migration jouée entre deux empreintes --------------------------------------------------------------------
  if not v_deja then
    execute v_empreinte into md5_avant;
    photo_avant := pg_temp.photo();
    select string_agg(id || ':' || actif, ',' order by id) into d2 from stagiaires;
    if btrim(coalesce(current_setting('preuve.migration', true), ''), E' \t\r\n') <> '' then
      execute current_setting('preuve.migration');
    end if;
    photo_apres := pg_temp.photo();
    perform pg_temp.cas('la migration seule n''efface rien (lignes et valeurs non nulles identiques, table par table)',
      photo_apres = photo_avant, case when photo_apres <> photo_avant then photo_avant || ' / ' || photo_apres end);
    perform pg_temp.cas('la migration ne touche pas actif',
      (select string_agg(id || ':' || actif, ',' order by id) from stagiaires) = d2, null);
  end if;

  -- 3. Catalogue ----------------------------------------------------------------------------------------------------
  perform pg_temp.cas('fiche déjà anonymisée par l''ancien bouton : efface_le = anonymise_le',
    (select to_jsonb(s) ->> 'efface_le' = to_jsonb(s) ->> 'anonymise_le' from stagiaires s where s.id = SX), null);
  select count(*) into n from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('anonymiser_promo', 'anonymiser_stagiaire', 'etat_anonymisation_promo', '_anonymiser_stagiaire');
  perform pg_temp.cas('les quatre anciennes fonctions d''anonymisation sont supprimées', n = 0, n::text);
  select string_agg(ro.rol || ':' || f.fn, ',' order by ro.rol, f.fn) into t
    from (values ('anon'), ('authenticated'), ('service_role')) ro(rol),
         (values ('public._effacer_etape1(integer)'), ('public._effacer_etape2(integer)')) f(fn)
   where case when to_regprocedure(f.fn) is null then true else has_function_privilege(ro.rol, f.fn, 'execute') end;
  perform pg_temp.cas('aucun droit d''appel des fonctions internes pour anon, authenticated, service_role', t is null, t);
  select string_agg(ro.rol || ':' || f.fn || ':' || case when to_regprocedure(f.fn) is null then 'absente'
                    else has_function_privilege(ro.rol, f.fn, 'execute')::text end, ',' order by ro.rol, f.fn) into t
    from (values ('anon'), ('authenticated')) ro(rol),
         (values ('public.etat_conservation()'), ('public.effacer_promo_etape1(integer)'),
                 ('public.effacer_promo_etape2(integer)'), ('public.effacer_sur_demande(integer)')) f(fn)
   where case when to_regprocedure(f.fn) is null then true
              else has_function_privilege(ro.rol, f.fn, 'execute') <> (ro.rol = 'authenticated') end;
  perform pg_temp.cas('fonctions appelables : authenticated oui, anon non', t is null, t);
  perform pg_temp.cas('emargement_signer, emargement_annoter, emargement_clore : droits du 23/10 gardés (authenticated, pas anon)',
    has_function_privilege('authenticated', 'public.emargement_signer(bigint, integer, text)', 'execute')
    and has_function_privilege('authenticated', 'public.emargement_annoter(bigint, integer, boolean, text)', 'execute')
    and has_function_privilege('authenticated', 'public.emargement_clore(bigint)', 'execute')
    and not has_function_privilege('anon', 'public.emargement_signer(bigint, integer, text)', 'execute')
    and not has_function_privilege('anon', 'public.emargement_annoter(bigint, integer, boolean, text)', 'execute')
    and not has_function_privilege('anon', 'public.emargement_clore(bigint)', 'execute'), null);
  r := pg_temp.tente_blanc('update public.stagiaires set anonymise_le = now() where id = ' || S7 || ' returning id::text');
  perform pg_temp.cas('contrainte : pas d''anonymise_le sans efface_le', r like '23514%', r);
  r := pg_temp.tente_blanc(format('update public.emargement_lignes set trace = null where seance_id = %s and stagiaire_id = %s returning id::text', feA, S1));
  perform pg_temp.cas('contrainte : un tracé ne s''efface pas sans signature_effacee_le (déclencheur ou contrainte)',
    r like 'P0001%' or r like '23514%', r);
  perform pg_temp.cas('état initial de S1 (PA, active, compte)', pg_temp.fiche(S1)
    = 'profil:1 compte:1 prive:1 suivi:1 textes:3 emails:3 emobs:1 dossier:1 livret:1 traces:1 signees:1 absences:0 nom:nominatif actif:true efface:false anonymise:false',
    pg_temp.fiche(S1));
  v_avant_S7 := pg_temp.fiche(S7); v_avant_SC := pg_temp.fiche(SC); v_avant_SE := pg_temp.fiche(SE); v_avant_S8 := pg_temp.fiche(S8);

  -- 4. Les étapes, dans une sous-transaction annulée -----------------------------------------------------------------
  begin
    -- Le jour réglable (voir l'en-tête).
    execute $q$
      create or replace function public._questionnaire_jour() returns date language sql stable
      set search_path to 'public', 'pg_temp' as $f$
        select coalesce(nullif(current_setting('preuve.jour', true), '')::date, (now() at time zone 'Europe/Paris')::date);
      $f$;
    $q$;
    set local role authenticated;

    -- 4.1 Étape 1 : la veille, refusée ; état des échéances.
    perform pg_temp.jour(date '2027-12-10');
    perform pg_temp.qui('FO');
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'promos') p where (p ->> 'id')::int = PA);
    perform pg_temp.cas('etat_conservation, PA la veille de l''étape 1 : dates, 3 fiches à effacer, 1 compte d''équipe',
      j ->> 'date_fin' = '2026-12-11' and j ->> 'etape1_du' = '2027-12-11' and j ->> 'etape2_du' = '2030-01-01'
      and (j ->> 'a_effacer_etape1')::int = 3 and (j ->> 'a_effacer_etape2')::int = 3 and (j ->> 'comptes_equipe')::int = 1
      and j ->> 'lieu_nom' = 'Preuve conservation L1' and j ->> 'nom' = 'Preuve Nîmes'
      and (j ->> 'emargement_etape2')::int = 3, j::text);
    perform pg_temp.cas('etat_conservation : jour = jour de Paris réglé, portées formateurs vides (tâche 3), registre nul (tâche 4)',
      pg_temp.etat() ->> 'jour' = '2027-12-10' and pg_temp.etat() -> 'portees_formateurs' = '[]'::jsonb
      and pg_temp.etat() -> 'registre' = 'null'::jsonb, (pg_temp.etat() - 'promos')::text);
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'promos') p where (p ->> 'id')::int = PB);
    perform pg_temp.cas('etat_conservation : promo sans date de fin listée sans échéance',
      j is not null and j -> 'date_fin' = 'null'::jsonb and j -> 'etape1_du' = 'null'::jsonb and j -> 'etape2_du' = 'null'::jsonb,
      coalesce(j::text, 'absente'));
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA));
    perform pg_temp.cas('étape 1 refusée la veille (10/12/2027)', r like '%conservation: Possible à partir du 11/12/2027.', r);
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PB));
    perform pg_temp.cas('étape 1 refusée sans date de fin', r like '%conservation: Renseigne d''abord la date de fin de cette promo.', r);
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PB));
    perform pg_temp.cas('étape 2 refusée sans date de fin', r like '%conservation: Renseigne d''abord la date de fin de cette promo.', r);

    -- 4.2 Droits : au 01/01/2030 (aucune date ne refuse), personne d'autre que le fondateur hors aperçu.
    perform pg_temp.jour(date '2030-01-01');
    reset role;
    d1 := pg_temp.donnees();
    set local role authenticated;
    for c in select * from (values ('FORM', 'formateur de PA', PA, null::text), ('E7', 'stagiaire', PD, null),
                                   ('FO', 'fondateur en aperçu formateur', PA, 'formateur'),
                                   ('FO', 'fondateur en aperçu direction', PA, 'direction'),
                                   ('DIR2', 'direction d''un autre centre', null, null), (null, 'sans session', null, null)) v(nom, lib, promo, apercu) loop
      perform pg_temp.qui(c.nom, c.promo);
      if c.apercu is not null then perform pg_temp.apercu(c.apercu, c.promo); end if;
      foreach t in array array[format('select public.effacer_promo_etape1(%s)::text', PA),
                               format('select public.effacer_promo_etape2(%s)::text', PA),
                               format('select public.effacer_sur_demande(%s)::text', S1),
                               'select public.etat_conservation()::text'] loop
        r := pg_temp.tente(t);
        perform pg_temp.cas(format('%s refusé : %s', c.lib, split_part(split_part(t, 'public.', 2), '(', 1)),
          r like '%conservation: Réservé à la gestion de la qualité.', r);
      end loop;
    end loop;
    set local role anon;
    perform pg_temp.qui('FO');
    foreach t in array array[format('select public.effacer_promo_etape1(%s)::text', PA),
                             format('select public.effacer_sur_demande(%s)::text', S1), 'select public.etat_conservation()::text'] loop
      r := pg_temp.tente(t);
      perform pg_temp.cas('rôle anon refusé (droit d''exécution) : ' || split_part(split_part(t, 'public.', 2), '(', 1),
        r like '42501%', r);
    end loop;
    reset role;
    perform pg_temp.cas('aucun refus n''a rien changé', pg_temp.donnees() = d1, null);
    set local role authenticated;

    -- 4.3 Lieu : le lot 5 élargira peut_gerer_qualite() à la direction ; simulé ici (sous-transaction annulée), la
    -- direction d'un autre centre reste refusée sur une promo et une fiche hors de son lieu, et ne voit que son lieu.
    perform pg_temp.jour(date '2027-12-11');
    r := null; t := null; j := null; m := null;
    begin
      reset role;
      execute $q$
        create or replace function public.peut_gerer_qualite() returns boolean language sql stable security definer
        set search_path to 'public', 'pg_temp' as $f$
          select est_fondateur() or exists (select 1 from affectations af
            where lower(af.email) = lower((select auth.jwt() ->> 'email')) and af.role = 'direction');
        $f$;
      $q$;
      set local role authenticated;
      perform pg_temp.qui('DIR2');
      r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA))
           || ' | ' || pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA))
           || ' | ' || pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', S1));
      select string_agg(p ->> 'id', ',' order by (p ->> 'id')::int) into t
        from jsonb_array_elements(pg_temp.etat() -> 'promos') p
       where (p ->> 'id')::int in (PA, PB, PC, PD, PE);
      j := to_jsonb(pg_temp.tente(format('select public.effacer_promo_etape1(%s) ->> ''fiches''', PC)));
      reset role;
      select count(*) into m from user_profiles where stagiaire_id = SC;
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then raise; end if;
    end;
    set local role authenticated;
    perform pg_temp.cas('direction d''un autre centre (droit élargi) : refusée sur PA et sur une fiche de PA',
      r like '%conservation: Cette promo n''est pas dans ton périmètre.%conservation: Cette promo n''est pas dans ton périmètre.%conservation: Cette fiche n''est pas dans ton périmètre.', r);
    perform pg_temp.cas('direction d''un autre centre (droit élargi) : etat_conservation ne liste que la promo de son lieu',
      t = PC::text, t);
    perform pg_temp.cas('direction d''un autre centre (droit élargi), jumeau : étape 1 de sa promo PC acceptée',
      j #>> '{}' = 'ok 1' and m = 0, j::text || ' / profil ' || m);

    -- 4.4 Étape 1 le jour même.
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA));
    perform pg_temp.cas('étape 1 acceptée le 11/12/2027 : 3 fiches, 1 compte d''équipe ignoré',
      (pg_temp.res(r) ->> 'fiches')::int = 3 and (pg_temp.res(r) ->> 'comptes_equipe')::int = 1, r);
    perform pg_temp.cas('étape 1 : emargement.effacement vide après la fonction',
      coalesce(current_setting('emargement.effacement', true), '') = '', current_setting('emargement.effacement', true));
    reset role;
    perform pg_temp.cas('après l''étape 1, S1 (active) : compte, e-mails, naissance, suivi, textes, observations partis ; nom, dossier, livret, tracé restent ; actif vrai',
      pg_temp.fiche(S1) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:1 livret:1 traces:1 signees:1 absences:0 nom:nominatif actif:true efface:true anonymise:false',
      pg_temp.fiche(S1));
    perform pg_temp.cas('après l''étape 1, S2 (abandon) : idem, actif faux',
      pg_temp.fiche(S2) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:1 livret:1 traces:1 signees:1 absences:0 nom:nominatif actif:false efface:true anonymise:false',
      pg_temp.fiche(S2));
    perform pg_temp.cas('après l''étape 1, S3 (sans compte, absente) : textes et observation partis, absence gardée',
      pg_temp.fiche(S3) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:1 livret:1 traces:0 signees:0 absences:1 nom:nominatif actif:true efface:true anonymise:false',
      pg_temp.fiche(S3));
    perform pg_temp.cas('après l''étape 1, SE (compte d''équipe) : intacte', pg_temp.fiche(SE) = v_avant_SE, pg_temp.fiche(SE));
    perform pg_temp.cas('après l''étape 1, la ligne de S2 signée sur l''appareil du formateur garde l''e-mail du formateur',
      (select signe_par from emargement_lignes where seance_id = feA and stagiaire_id = S2) = 'preuve.cons.form@example.invalid', null);
    perform pg_temp.cas('après l''étape 1, signatures des formateurs intactes',
      (select string_agg(nom || '/' || (trace is not null) || '/' || coalesce(prof_id::text, '-'), ',' order by id)
         from emargement_formateurs where seance_id = feA) = 'Paul Martin/true/-,Preuve Marie Durand/true/' || v_prof, null);
    select count(*) into n from effacements_journal where type = 'etape1' and cible = 'promo ' || PA;
    perform pg_temp.cas('étape 1 : une ligne de journal « etape1 », cible « promo n »', n = 1, n::text);
    d1 := pg_temp.donnees();
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA));
    reset role;
    perform pg_temp.cas('étape 1 rejouée : rien ne change, aucune seconde ligne de journal',
      (pg_temp.res(r) ->> 'fiches')::int = 0 and pg_temp.donnees() = d1, r);
    -- Date de fin déplacée après l'étape 1 : rien n'est défait.
    d1 := pg_temp.fiche(S1) || pg_temp.fiche(S2) || pg_temp.fiche(S3);
    update promos set date_fin = date '2027-06-30' where id = PA;
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA));
    reset role;
    perform pg_temp.cas('date de fin déplacée après l''étape 1 : rien n''est défait (fiches identiques, étape 1 à nouveau datée)',
      pg_temp.fiche(S1) || pg_temp.fiche(S2) || pg_temp.fiche(S3) = d1
      and r like '%conservation: Possible à partir du 30/06/2028.', r);
    update promos set date_fin = date '2026-12-11' where id = PA;
    set local role authenticated;
    perform pg_temp.qui('FO');
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'promos') p where (p ->> 'id')::int = PA);
    perform pg_temp.cas('etat_conservation après l''étape 1 : 0 fiche pour l''étape 1, 3 pour l''étape 2',
      (j ->> 'a_effacer_etape1')::int = 0 and (j ->> 'a_effacer_etape2')::int = 3, j::text);

    -- 4.5 Étape 2 : le 31/12 de la 3e année, refusée ; le 01/01, acceptée.
    perform pg_temp.jour(date '2029-12-31');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA));
    perform pg_temp.cas('étape 2 refusée le 31/12/2029', r like '%conservation: Possible à partir du 01/01/2030.', r);
    perform pg_temp.jour(date '2030-01-01');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA));
    perform pg_temp.cas('étape 2 acceptée le 01/01/2030 : 3 fiches, 1 compte d''équipe ignoré, 3 tracés (dont SX), 2 formateurs',
      (pg_temp.res(r) ->> 'fiches')::int = 3 and (pg_temp.res(r) ->> 'comptes_equipe')::int = 1
      and (pg_temp.res(r) ->> 'signatures')::int = 3 and (pg_temp.res(r) ->> 'signatures_formateurs')::int = 2, r);
    perform pg_temp.cas('étape 2 : emargement.effacement vide après la fonction',
      coalesce(current_setting('emargement.effacement', true), '') = '', current_setting('emargement.effacement', true));
    reset role;
    perform pg_temp.cas('après l''étape 2, S1 : plus de nom, de dossier, de livret ni de tracé ; signée, actif vrai',
      pg_temp.fiche(S1) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:0 livret:0 traces:0 signees:1 absences:0 nom:anonyme actif:true efface:true anonymise:true',
      pg_temp.fiche(S1));
    perform pg_temp.cas('après l''étape 2, S2 : idem, actif faux',
      pg_temp.fiche(S2) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:0 livret:0 traces:0 signees:1 absences:0 nom:anonyme actif:false efface:true anonymise:true',
      pg_temp.fiche(S2));
    perform pg_temp.cas('après l''étape 2, S3 : absence gardée',
      pg_temp.fiche(S3) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:0 livret:0 traces:0 signees:0 absences:1 nom:anonyme actif:true efface:true anonymise:true',
      pg_temp.fiche(S3));
    perform pg_temp.cas('après l''étape 2, SE (compte d''équipe) : nom, dossier et tracé gardés',
      pg_temp.fiche(SE) = replace(v_avant_SE, 'emails:3', 'emails:2'), pg_temp.fiche(SE) || ' / avant ' || v_avant_SE);
    select string_agg(stagiaire_id || ':' || coalesce(to_char(signe_le at time zone 'Europe/Paris', 'HH24:MI'), '-') || ':'
                      || coalesce(signe_par, '-') || ':' || coalesce(maj_par, '-') || ':' || (to_jsonb(l) ->> 'signature_effacee_le' is not null)
                      || ':' || absent, ',' order by stagiaire_id) into t
      from emargement_lignes l where seance_id = feA;
    perform pg_temp.cas('après l''étape 2, lignes de la feuille de PA : heures et présences intactes, signataires « anonyme », tracés effacés datés (sauf SE, y compris SX anonymisée avant ce lot)',
      t = format('%s:08:40:anonyme:anonyme:true:false,%s:08:45:anonyme:anonyme:true:false,%s:-:-:anonyme:false:true,%s:08:50:anonyme:anonyme:false:false,%s:08:55:anonyme:anonyme:true:false',
                 S1, S2, S3, SE, SX), t);
    select string_agg(nom || '/' || to_char(signe_le at time zone 'Europe/Paris', 'HH24:MI') || '/' || coalesce(prof_id::text, '-')
                      || '/' || (trace is null) || '/' || signe_par || '/' || (to_jsonb(f) ->> 'signature_effacee_le' is not null), ',' order by id) into t
      from emargement_formateurs f where seance_id = feA;
    perform pg_temp.cas('feuille à deux formateurs : « Formateur 1 » (8 h 30) et « Formateur 2 » (9 h) dans l''ordre des signatures, sans fiche ni tracé',
      t = 'Formateur 2/09:00/-/true/anonyme/true,Formateur 1/08:30/-/true/anonyme/true', t);
    perform pg_temp.cas('feuille de PA : ouverture et clôture « anonyme »',
      (select ouverte_par || '/' || close_par from emargement_seances where id = feA) = 'anonyme/anonyme', null);
    perform pg_temp.cas('étape 2 : les feuilles des autres promos ne bougent pas',
      (select count(*) from emargement_formateurs where promo_id in (PC, PD, PE) and nom like 'Formateur %') = 0
      and (select count(*) from emargement_seances where promo_id in (PC, PD, PE) and ouverte_par = 'anonyme') = 0, null);
    select count(*) into n from effacements_journal where type = 'etape2' and cible = 'promo ' || PA;
    perform pg_temp.cas('étape 2 : une ligne de journal « etape2 »', n = 1, n::text);
    set local role authenticated;
    perform pg_temp.qui('FO');
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'promos') p where (p ->> 'id')::int = PA);
    reset role;
    perform pg_temp.cas('etat_conservation après l''étape 2 : plus rien à effacer, le compte d''équipe toujours compté',
      (j ->> 'a_effacer_etape1')::int = 0 and (j ->> 'a_effacer_etape2')::int = 0 and (j ->> 'comptes_equipe')::int = 1
      and (j ->> 'emargement_etape2')::int = 0, j::text);
    d1 := pg_temp.donnees();
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA));
    reset role;
    perform pg_temp.cas('étape 2 rejouée : rien ne change, aucune seconde ligne de journal',
      (pg_temp.res(r) ->> 'fiches')::int = 0 and pg_temp.donnees() = d1, r);

    -- 4.6 Étape 2 sur une promo dont l'étape 1 n'a pas été faite (fondateur en retard) : faite d'abord, sans refus.
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PE));
    reset role;
    perform pg_temp.cas('étape 2 sans étape 1 (PE) : acceptée', (pg_temp.res(r) ->> 'fiches')::int = 1, r);
    perform pg_temp.cas('étape 2 sans étape 1 : S6 a tout perdu (compte, e-mails, textes, dossier, nom, tracé)',
      pg_temp.fiche(S6) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:0 livret:0 traces:0 signees:1 absences:0 nom:anonyme actif:true efface:true anonymise:true',
      pg_temp.fiche(S6));
    perform pg_temp.cas('étape 2 sans étape 1 : une ligne « etape2 », aucune « etape1 » pour PE',
      (select count(*) from effacements_journal where cible = 'promo ' || PE and type = 'etape2') = 1
      and (select count(*) from effacements_journal where cible = 'promo ' || PE and type = 'etape1') = 0, null);

    -- 4.7 Effacement sur demande d'une fiche active (S4, promo en cours), au vrai jour.
    perform pg_temp.jour(null);
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', S4));
    perform pg_temp.cas('demande sur une fiche active : acceptée', pg_temp.res(r) is not null and (pg_temp.res(r) ->> 'deja') is null, r);
    perform pg_temp.cas('demande : emargement.effacement vide après la fonction',
      coalesce(current_setting('emargement.effacement', true), '') = '', current_setting('emargement.effacement', true));
    reset role;
    perform pg_temp.cas('après la demande, S4 : tout effacé tout de suite, actif toujours vrai (pas d''abandon)',
      pg_temp.fiche(S4) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:0 livret:0 traces:0 signees:1 absences:0 nom:anonyme actif:true efface:true anonymise:true',
      pg_temp.fiche(S4));
    perform pg_temp.cas('demande : une ligne « demande », cible « stagiaire n »',
      (select count(*) from effacements_journal where type = 'demande' and cible = 'stagiaire ' || S4) = 1, null);
    d1 := pg_temp.donnees();
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', S4));
    reset role;
    perform pg_temp.cas('demande rejouée : { deja: true }, rien ne change, aucune seconde ligne',
      r = 'ok {"deja": true}' and pg_temp.donnees() = d1, r);
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', SE));
    reset role;
    perform pg_temp.cas('demande sur la fiche d''un compte d''équipe : refusée, fiche intacte',
      r like '%conservation: Cette fiche est reliée à un compte d''équipe%' and pg_temp.fiche(SE) = replace(v_avant_SE, 'emails:3', 'emails:2'), r);
    -- Feuille ouverte aujourd'hui dans PD : la fiche effacée ne signe plus, n'est plus annotée, ne reçoit pas d'absence.
    set local role authenticated;
    perform pg_temp.qui('FORM', PD);
    r := pg_temp.tente(format('select public.emargement_signer(%s, %s, %L)::text', feJ, S4, v_tr));
    perform pg_temp.cas('après la demande, signature de la fiche refusée sur une feuille ouverte',
      r like '%emargement: Stagiaire introuvable dans cette promo.', r);
    r := pg_temp.tente(format('select public.emargement_annoter(%s, %s, true, null)::text', feJ, S4))
         || ' | ' || pg_temp.tente(format('select public.emargement_annoter(%s, %s, null, %L)::text', feJ, S4, 'Observation'));
    perform pg_temp.cas('après la demande, absence et observation de la fiche refusées',
      r like '%emargement: Stagiaire introuvable dans cette promo.%emargement: Stagiaire introuvable dans cette promo.', r);
    r := pg_temp.tente(format('select public.emargement_signer(%s, %s, %L)::text', feJ, S7, v_tr));
    perform pg_temp.cas('jumeau : S7 (nominative) signe sur la même feuille', r like 'ok %', r);
    r := pg_temp.tente(format('select public.emargement_signer_formateur(%s, %L, %L)::text', feJ, 'Preuve Marie Durand', v_tr));
    perform pg_temp.cas('le formateur signe la feuille', r like 'ok %', r);
    r := pg_temp.tente(format('select public.emargement_clore(%s)::text', feJ));
    reset role;
    perform pg_temp.cas('clôture : une absence (S8), aucune pour la fiche effacée',
      r = 'ok 1' and (select string_agg(stagiaire_id::text || ':' || absent, ',' order by stagiaire_id) from emargement_lignes where seance_id = feJ)
                     = S7 || ':false,' || S8 || ':true', r);

    -- 4.8 Rien d'autre n'a bougé : fiches témoins des autres promos, journal sans nom ni e-mail.
    perform pg_temp.cas('témoin S7 (PD) : seule sa signature du jour s''ajoute',
      pg_temp.fiche(S7) = replace(v_avant_S7, 'traces:1 signees:1', 'traces:2 signees:2'),
      pg_temp.fiche(S7) || ' / avant ' || v_avant_S7);
    perform pg_temp.cas('témoin S8 (PD) : seule l''absence de la clôture s''ajoute',
      pg_temp.fiche(S8) = replace(v_avant_S8, 'absences:0', 'absences:1'), pg_temp.fiche(S8) || ' / avant ' || v_avant_S8);
    perform pg_temp.cas('témoin SC (autre centre) : intacte', pg_temp.fiche(SC) = v_avant_SC, pg_temp.fiche(SC));
    select string_agg(type || ' ' || cible || ' ' || details::text, ' | ') into t from effacements_journal
     where type in ('etape1', 'etape2', 'demande')
       and (cible !~ '^(promo|stagiaire) [0-9]+$' or details::text ~* '@|preuve|martin|durand|example');
    perform pg_temp.cas('journal : cibles « promo n » ou « stagiaire n », aucun nom ni e-mail dans les détails', t is null, t);
    perform pg_temp.cas('journal : le fondateur est l''auteur de chaque ligne de ce lot',
      (select count(*) from effacements_journal where type in ('etape1', 'etape2', 'demande')
          and fait_par_email <> 'preuve.cons.fo@example.invalid') = 0
      and (select count(*) from effacements_journal where type in ('etape1', 'etape2', 'demande')) = 4, null);
    perform pg_temp.cas('aucune étape n''écrit actif : S1, S3, S4, S6 actives ; S2 en abandon',
      (select string_agg(id || ':' || actif, ',' order by id) from stagiaires where id in (S1, S2, S3, S4, S6))
        = (select string_agg(x.id || ':' || (x.id <> S2), ',' order by x.id) from unnest(array[S1, S2, S3, S4, S6]) x(id)), null);

    -- 4.9 Retour refusé après une étape.
    if not v_deja then
      begin
        execute current_setting('preuve.retour');
        r := 'joué';
      exception when others then
        r := sqlerrm;
      end;
      perform pg_temp.cas('retour refusé après une étape', r like 'conservation: Retour impossible%', r);
    end if;

    select coalesce(jsonb_agg(to_jsonb(xc) order by xc.n), '[]'::jsonb) into v_sauve from pg_temp.preuve_cas xc;
    raise exception 'preuve: annulé';
  exception when others then
    if sqlerrm <> 'preuve: annulé' then
      v_erreur := sqlstate || ' ' || sqlerrm;
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
  perform pg_temp.cas('les étapes ont été annulées (aucune ligne de ce lot au journal)',
    (select count(*) from effacements_journal where type in ('etape1', 'etape2', 'demande')) = 0, null);

  -- 5. Retour : la base revient à l'identique ---------------------------------------------------------------------
  if not v_deja then
    if btrim(coalesce(current_setting('preuve.retour', true), ''), E' \t\r\n') <> '' then
      execute current_setting('preuve.retour');
    end if;
    execute v_empreinte into md5_apres;
    perform pg_temp.cas('retour : empreinte du schéma (droits compris) et des données identique à celle d''avant la migration',
      md5_apres = md5_avant, md5_avant || ' / ' || md5_apres);
    select count(*) into n from pg_proc where pronamespace = 'public'::regnamespace
       and proname in ('anonymiser_promo', 'anonymiser_stagiaire', 'etat_anonymisation_promo', '_anonymiser_stagiaire');
    select count(*) into m from pg_proc where pronamespace = 'public'::regnamespace
       and proname in ('etat_conservation', 'effacer_promo_etape1', 'effacer_promo_etape2', 'effacer_sur_demande',
                       '_effacer_etape1', '_effacer_etape2');
    perform pg_temp.cas('retour : les quatre anciennes fonctions sont revenues, les six de ce lot sont parties',
      n = 4 and m = 0, n || '/' || m);
  end if;

  -- Verdict -----------------------------------------------------------------------------------------------------------
  select count(*) filter (where xc.bon), count(*) filter (where not xc.bon),
         string_agg(xc.cas || coalesce(' [' || xc.detail || ']', ''), ' | ' order by xc.n) filter (where not xc.bon)
    into v_ok, v_ko, v_detail from pg_temp.preuve_cas xc;
  if v_ko = 0 then
    raise exception 'VERT %/0', v_ok;
  end if;
  raise exception 'ROUGE %/% : %', v_ok, v_ko, v_detail;
end
$preuve$;
