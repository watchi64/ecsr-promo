-- Preuve de la migration 20261110_conservation (conservation à 3 ans, Qualiopi Q5) : fiches et émargement (tâche 2),
-- Production (11/11/2026) : essai à blanc VERT 240/0 puis, migration appliquée, VERT 227/0 deux fois, rien laissé. Deux
-- ajustements pour la vraie base : passage d'essai en « Voiture / Effectué » et audit en « update » (contraintes de la
-- production, reportées dans le schéma minimal) ; empreinte sans retours chariot (effacer_registre_qualite de Q4 a été
-- appliquée depuis un fichier CRLF : le retour la recrée identique aux retours chariot près).
-- questionnaires (tâche 3 : sections 3 bis, 4.0, 4.1 bis, 4.7 bis, 4.9 et les cas ajoutés aux étapes).
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
-- Ordre réel (11/11) : le schéma minimal rejoue la suite du lot 5 (20261111_espaces_4_donnees, fonctions de la direction),
-- puis la navigation unique, phase 1 (20261110_navigation_unique_1_reglages et _2_menage : themes.updated_by_email retirée,
-- _anonymiser_stagiaire recréée sans elle et conditionnelle sur fiches_suivi) et phase 2 (20261111_navigation_unique_3_phase2,
-- appliquée en production le 11/11 à 14 h 55 : fiches_suivi retirée) : c'est le cas réel, joué par défaut. Variante
-- « complète » (fiches_suivi encore là) : schéma minimal lancé avec -v phase1_seule=1. La preuve s'y adapte (fiches de suivi
-- comptées 0 sans la table) ; thème témoin jamais créé depuis la phase 1 (colonne retirée). Le retour recrée les six fonctions
-- d'anonymisation mot pour mot (versions en base avant ce lot) : l'empreinte les compte toutes.
--
-- Base réelle avec des données (11/11/2026, soir) : rejouée en lecture sur la production, l'ancienne version sortait ROUGE
-- 225/2, parce que six vraies entrées du registre faussaient les totaux attendus. Désormais : l'attendu de etat_conservation
-- (registre) est la part de RQ1 à RQ6 plus celle des autres entrées, mesurée avant le cas avec la même règle (b_*), et
-- l'effacement attend 2 + les autres entrées déjà dues ; le journal n'est lu qu'au-dessus de sa dernière ligne d'avant la
-- preuve (v_journal0). Pour la base locale, tests/sql/conservation-preuve-donnees-reelles.sql pose avant la preuve des
-- entrées « réelles » (une due, une à échéance plus proche que RQ3, une ouverte, une en cours, une vidée, une close) et
-- des lignes de journal de chaque type accepté. Postgres local, ports 55641 à 55645 :
--   - avec ces données, sans fiches_suivi et avec : VERT 240/0 (deux passages), migration appliquée et données reposées
--     (journal de tous types) : VERT 227/0 (deux passages), rien laissé ; sans ces données : mêmes verdicts ;
--   - contre-épreuve, la version d'avant sur les mêmes données : ROUGE 234/6, appliquée ROUGE 219/8 ;
--   - production (migration appliquée, 6 entrées au registre, journal vide), psql -1, pg_read_file remplacés par le texte
--     des fichiers : VERT 227/0 ; aucune ligne d'essai avant ni après (lieux, promos, registre, journal, profils, comptes).
--
-- Conservation ouverte à la direction (20261111_conservation_direction.sql, 11/11/2026) : sur une base où elle est appliquée,
-- le cas 4.2 « fondateur en aperçu direction » joue les deux étapes de PA à blanc et les attend permises (comme la purge des
-- bénévoles, même geste) ; tout le reste est inchangé. Base locale (outils/base_locale, suite rejouée, titres 1 à 3, migration
-- de la direction appliquée), port 55571 : VERT 227/0. Les autres cas de la direction : tests/sql/conservation-direction-preuve.sql.
-- Résultats du 11/11/2026, réconciliation avec la suite du lot 5 (fusion de main d5e60dc7 : lot 5 étape 4, navigation unique
-- phase 1), Postgres 18.4 local, port 55587, schéma minimal dans l'ordre réel :
--   - avec fiches_suivi (navigation unique 1 et 2) : VERT 240/0 (deux passages, puis encore après le retour) ; appliquée : VERT
--     227/0 ; questionnaires-preuve.sql et registre-qualite-preuve.sql sur la base appliquée : VERT 207/0 et VERT 128/0 ; retour
--     hors preuve : empreinte du schéma 69ea1dfa… avant, a8d210ac… appliquée et après les preuves, 69ea1dfa… après le retour ;
--   - variante phase 2 (fiches_suivi retirée, le cas réel) : mêmes verdicts ; empreinte f1a0d9d4… avant et après le retour ;
--   - contre-épreuve, migration et retour d'avant la réconciliation (b50cebeb) : ROUGE 234/6 (versions à argument restées,
--     « ton périmètre », retour sans les versions à argument).
-- Résultats du 11/11/2026, vague finale (fusion de main ce08b81, relecture finale : e-mails d'un compte déjà retiré,
-- textes écrits après l'étape 1), Postgres local, port 55623, tous les fichiers SQL en LF comme leurs blobs :
--   - base complète : VERT 237/0 (trois passages) ; variante sans fiches_suivi ni themes.updated_by_email : VERT 238/0
--     (deux passages) ; bases où la migration est appliquée : VERT 226/0 ; questionnaires-preuve.sql et
--     registre-qualite-preuve.sql sur la base appliquée : VERT 207/0 et VERT 128/0 ;
--   - retour hors preuve (psql -1), base complète : empreinte du schéma 13f48aa7… avant, ec2aebec… appliquée et après les
--     preuves, 13f48aa7… après le retour ; variante : seul le corps de _anonymiser_stagiaire diffère (cas dédié ci-dessous) ;
--   - contre-épreuve, la preuve du jour sur la migration d'avant les corrections (b3168483) : ROUGE 230/7 ;
--   - piège : une copie de travail encore en CRLF (extraction d'avant .gitattributes) met des retours chariot dans les
--     corps recréés par le retour et fait échouer le cas de l'empreinte ; toujours jouer sur des fichiers en LF.
-- Résultats du 10/11/2026, indépendance de l'ordre (fiches_suivi, themes.updated_by_email), Postgres 18.4 local, port
-- 55523, deux bases (complète ; variante sans les deux objets) :
--   - base complète : VERT 227/0 (trois passages) ; appliquée : VERT 216/0 ; retour hors preuve : empreinte 2109cee5…
--     avant, 3762102f… appliquée et après la preuve, 2109cee5… après le retour ;
--   - variante : VERT 228/0 (trois passages) ; appliquée : VERT 216/0 ; retour hors preuve sans erreur, ancienne
--     _anonymiser_stagiaire jouée ensuite (fiche_suivi 0) ; second aller-retour : empreinte identique (2a5af637…) ;
--   - contre-épreuves sur la variante : suppression de fiches_suivi non conditionnée ROUGE 181/47 ; mise à jour de
--     themes.updated_by_email non conditionnée ROUGE 181/47 (les deux restent VERT 227/0 sur la base complète) ;
--   - sans migration : ROUGE 12/21 (complète), ROUGE 12/22 (variante).
--
-- Résultats du 10/11/2026, tâche 4 (journal du registre qualité, Postgres local, port 55561, schéma minimal complété par
-- la table du registre, section 8) : données RQ1 à RQ6, cas 4.0 bis et 4.9 bis :
--   - preuve complétée jouée sur la migration d'avant : ROUGE 31/2 (état : « registre » scalaire, empreinte du retour) ;
--   - migration et retour : VERT 216/0 (trois passages) ; base où la migration est appliquée : VERT 205/0 ; preuve du lot
--     Q4 (tests/sql/registre-qualite-preuve.sql) rejouée sur cette base : VERT 128/0 ;
--   - contre-épreuves : journal écrit même à 0 entrée ROUGE 214/2 ; seconde ligne au journal ROUGE 213/3 ; droit d'appel
--     donné à anon ROUGE 213/3 ; entrées déjà vidées recomptées ROUGE 214/2 ; échéance décalée de 40 jours ROUGE 209/7 ;
--     journal jamais écrit ROUGE 212/4 ; retour sans la recréation de la version Q4 ROUGE 215/1 (empreinte).
-- Résultats du 10/11/2026, tâche 3, correction 1 de la relecture (rien sous le seuil : aucun nombre de répondants
-- sous 5 ou 3 dans etat_conservation, les retours et le journal ; lieu 3 à un seul formateur) :
--   - nouveaux attendus sur la migration d'avant la correction : ROUGE 189/14 ;
--   - après : VERT 203/0 (trois passages) ; base appliquée VERT 193/0 ; base appliquée qui a déjà des réponses, des
--     participations et une ouverture : VERT 193/0 ;
--   - contre-épreuves rejouées : seuil 178/25, rebrassage 201/2, verrou 199/4, dates des formateurs 196/7, date de l'étape
--     1 196/7, année close 194/9, fiche 202/1, revoke 202/1, participations 201/2, lieu 202/1, commentaires de l'étape 1
--     201/2 ; nombres donnés sous le seuil (état, trois fonctions, étape 1) ROUGE 196/7 ;
--   - retour hors preuve : empreinte de70774d… avant, c7e3214b… appliquée et après les preuves, de70774d… après le retour.
-- Résultats du 10/11/2026, tâche 3 (questionnaires), Postgres 18.4 local, port 55531, même schéma minimal :
--   - la preuve complétée, jouée sur la migration de la tâche 2 : ROUGE 16/17 (fonctions et tables absentes, puis
--     « structure » : relation questionnaire_resultats_figes absente) ;
--   - migration et retour : VERT 199/0 (trois passages) ; base où la migration est appliquée : VERT 189/0, rien laissé
--     (empreinte du schéma et des données identique avant et après) ;
--   - contre-épreuves, une garde retirée à la fois : seuil ramené à 1 dans _questionnaire_comptes ROUGE 177/22 ;
--     rebrassage retiré de l'effacement des commentaires ROUGE 197/2 ; verrou par portée retiré (effacement, figeage,
--     clôture) ROUGE 195/4 ; dates des formateurs retirées ROUGE 192/7 ; date de l'étape 1 retirée de _questionnaire_clos
--     ROUGE 192/7 ; année close ignorée par _questionnaire_clos ROUGE 190/9 ; fiche ignorée par questionnaires_a_remplir
--     ROUGE 198/1 ; revoke des fonctions internes retiré ROUGE 198/1 ; participations gardées par _effacer_etape1 ROUGE
--     197/2 ; lieu ignoré par les fonctions des formateurs ROUGE 198/1 ; commentaires gardés par l'étape 1 ROUGE 197/2 ;
--   - retour joué hors preuve (psql -1 -f) : empreinte identique avant la migration et après le retour ; retour refusé
--     avec un résultat figé, une année close, une ligne « questionnaires » au journal.
-- Résultats du 10/11/2026, correction 1 de la relecture (déclencheur des marques efface_le et anonymise_le), Postgres 18.4
-- local, port 55519, schéma minimal tests/sql/conservation-schema-minimal.sql :
--   - avant la migration (fichiers de migration et de retour vides) : ROUGE 25/80 ;
--   - migration et retour : VERT 105/0 (trois passages) ; base où la migration est appliquée : VERT 99/0, rien laissé
--     (empreinte du schéma et des données identique avant et après) ;
--   - contre-épreuves, une garde retirée à la fois : date ROUGE 99/6 ; droit ROUGE 68/37 ; lieu ROUGE 103/2 ; équipe,
--     fonctions internes ROUGE 103/2 ; équipe, boucles de promo ROUGE 84/21 ; actif écrit ROUGE 98/7 ; revoke des
--     fonctions internes ROUGE 104/1 ; émargement : signature ROUGE 103/2, clôture ROUGE 104/1, annotation ROUGE 103/2 ;
--     déclencheur des marques retiré ROUGE 96/9 ; drapeau conservation.effacement non remis à vide ROUGE 103/2 ;
--   - retour joué hors preuve (psql -1 -f) : empreinte 459971c5… avant, 958f4937… migration appliquée (et après la preuve
--     en mode appliqué), 459971c5… après le retour ; retour refusé quand le journal porte une ligne « etape1 ».
-- Résultats de la première version (tâche 2, port 55517) : ROUGE 23/74 sans migration, VERT 97/0, VERT 92/0 appliquée ;
-- contre-épreuves 1 à 10 ROUGES ; retour à empreinte identique (265d820a…).

select length(set_config('preuve.migration', pg_read_file(:'migration'), false)) as migration_lue,
       length(set_config('preuve.retour', pg_read_file(:'retour'), false)) as retour_lu;

set local lock_timeout = '3s';

do $preuve$
declare
  v_jour_reel date := (now() at time zone 'Europe/Paris')::date;
  v_deja boolean := to_regprocedure('public.effacer_sur_demande(integer)') is not null;
  -- Variante « navigation-unique » : table fiches_suivi et colonne themes.updated_by_email retirées.
  v_suivi boolean := to_regclass('public.fiches_suivi') is not null;
  v_themes_email boolean := exists (select 1 from pg_attribute where attrelid = to_regclass('public.themes')
                                      and attname = 'updated_by_email' and attnum > 0 and not attisdropped);
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
  md5_avant text; md5_apres text; photo_avant text; photo_apres text;
  L1 integer; L2 integer; L3 integer; PF integer; PA integer; PB integer; PC integer; PD integer; PE integer; v_prof integer;
  S1 integer; S2 integer; S3 integer; S4 integer; S6 integer; S7 integer; S8 integer; SE integer; SC integer; SX integer;
  feA bigint; feD bigint; feJ bigint; feE bigint; fM bigint; fP bigint;
  r text; t text; j jsonb; n bigint; m bigint; d1 text; d2 text;
  v_avant_S7 text; v_avant_SC text; v_avant_SE text; v_avant_S8 text;
  c record; v_ok integer; v_ko integer; v_detail text; v_sauve jsonb; v_erreur text;
  v_tr constant text := 'M10 10L20 20L30 25';
  -- Questionnaires (tâche 3).
  RQ1 bigint; RQ2 bigint; RQ3 bigint; RQ4 bigint; RQ5 bigint; RQ6 bigint;
  -- Base réelle (11/11) : le registre et le journal ont déjà des lignes. v_journal0 : dernière ligne du journal avant la
  -- preuve (la preuve ne lit que les siennes) ; b_* : part des entrées du registre que la preuve n'a pas créées.
  v_journal0 bigint; b_eff bigint; b_clore bigint; b_efface bigint; b_echeance timestamptz; v_echeance text;
  v_rs jsonb; v_rf jsonb; j_fin jsonb; j_six jsonb; j_l1 jsonb; j_l2 jsonb; pPA jsonb; pPD jsonb; pL1 jsonb; pL2 jsonb;
  fe_r text[]; fe_c text;
  -- Relecture finale : compte déjà retiré puis demande (constat 2), textes écrits après l'étape 1 (constat 3).
  cr text[]; v_tard text;
  a1 text[]; a2 text[]; v_notes1 text; v_notes2 text; n_part bigint; r2 text; t2 text; m2 bigint; v_lignes bigint;
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
    -- Fiches de suivi d'une fiche (0 si la table a été retirée : variante sans fiches_suivi, voir l'en-tête).
    create function pg_temp.nb_suivi(p_id integer) returns bigint language plpgsql as $f$
    declare n bigint := 0;
    begin
      if to_regclass('public.fiches_suivi') is not null then
        execute 'select count(*) from public.fiches_suivi where stagiaire_id = $1' into n using p_id;
      end if;
      return n;
    end $f$;
    -- État d'une fiche, en une ligne : ce que les étapes doivent effacer ou garder.
    create function pg_temp.fiche(p_id integer) returns text language sql as $f$
      select concat_ws(' ',
        'profil:' || (select count(*) from public.user_profiles where stagiaire_id = p_id),
        'compte:' || (select count(*) from auth.users u join pg_temp.preuve_comptes k on k.uid = u.id where k.fiche = p_id),
        'prive:' || (select count(*) from public.stagiaires_prive where stagiaire_id = p_id),
        'suivi:' || pg_temp.nb_suivi(p_id),
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
    -- Où une adresse se lit encore (relecture finale, constat 2) : lignes d'émargement (signataire ou mise à jour),
    -- évaluations et leur historique, signalements de questions, acceptations des conditions, profils, comptes.
    create function pg_temp.traces(p_email text) returns text language sql as $f$
      select concat_ws(' ',
        'lignes:' || (select count(*) from public.emargement_lignes where lower(signe_par) = p_email or lower(maj_par) = p_email),
        'evaluations:' || ((select count(*) from public.evaluations where lower(created_by_email) = p_email or lower(updated_by_email) = p_email)
                         + (select count(*) from public.evaluations_audit where lower(changed_by_email) = p_email)),
        'signalements:' || (select count(*) from public.qcm_signalements where lower(email) = p_email),
        'conditions:' || (select count(*) from public.conditions_acceptations where lower(email) = p_email),
        'profils:' || (select count(*) from public.user_profiles where lower(email) = p_email),
        'comptes:' || (select count(*) from auth.users where lower(email) = p_email));
    $f$;
    -- Questionnaires : réponses complètes (chaque échelle à v, le premier choix), envoi, et ce qu'une portée contient.
    create function pg_temp.rep(p_cle text, v jsonb) returns jsonb language sql as $f$
      select jsonb_object_agg(question_id, case when type = 'choix' then to_jsonb(options[1]) else v end)
        from public.questionnaire_questions where cle = p_cle and version = 1 and not facultative;
    $f$;
    create function pg_temp.repond(p_cle text, p_portee jsonb, p_rep jsonb) returns text language sql as $f$
      select pg_temp.tente(format('select public.repondre_questionnaire(%L, %L::jsonb, 1, %L::jsonb, null)::text',
                                  p_cle, p_portee, p_rep));
    $f$;
    create function pg_temp.resultats(p_cle text, p_portee jsonb) returns jsonb language sql as $f$
      select pg_temp.res(pg_temp.tente(format('select public.resultats_questionnaire(%L, %L::jsonb)::text', p_cle, p_portee)));
    $f$;
    create function pg_temp.ids(p_cle text, p_promo integer, p_lieu integer, p_annee integer) returns text[] language sql as $f$
      select coalesce(array_agg(id::text order by id::text), '{}') from public.questionnaire_reponses
       where cle = p_cle and promo_id is not distinct from p_promo and lieu_id is not distinct from p_lieu
         and annee is not distinct from p_annee;
    $f$;
    -- Notes de la portée (multiensemble) et nombre de commentaires : « notes | n commentaires ».
    create function pg_temp.notes(p_cle text, p_promo integer, p_lieu integer, p_annee integer) returns text language sql as $f$
      select coalesce(string_agg(reponses::text, ';' order by reponses::text), '') || ' | ' || count(commentaire)
        from public.questionnaire_reponses
       where cle = p_cle and promo_id is not distinct from p_promo and lieu_id is not distinct from p_lieu
         and annee is not distinct from p_annee;
    $f$;
    -- Participations d'une portée (toutes, avec ou sans compte).
    create function pg_temp.parts(p_cle text, p_promo integer, p_lieu integer, p_annee integer) returns bigint language sql as $f$
      select count(*) from public.questionnaire_participations
       where cle = p_cle and promo_id is not distinct from p_promo and lieu_id is not distinct from p_lieu
         and annee is not distinct from p_annee;
    $f$;
    -- Lignes d'une table de public (0 si elle n'existe pas).
    create function pg_temp.lignes(p_table text) returns bigint language plpgsql as $f$
    declare n bigint := 0;
    begin
      if to_regclass('public.' || p_table) is not null then
        execute format('select count(*) from public.%I', p_table) into n;
      end if;
      return n;
    end $f$;
    -- Participations rattachées à une fiche (colonne de ce lot ; 0 si elle n'existe pas).
    create function pg_temp.parts_fiche(p_id integer) returns bigint language sql as $f$
      select count(*) from public.questionnaire_participations p where to_jsonb(p) ->> 'stagiaire_id' = p_id::text;
    $f$;
    grant execute on all functions in schema pg_temp to authenticated, anon;
  $q$;
  -- Données des tables que les étapes touchent (empreinte : contenu ; photo : nombre de lignes et de valeurs non
  -- nulles, hors colonnes nouvelles de ce lot).
  execute $q$
    create function pg_temp.tables_suivies() returns text[] language sql stable as $f$
      select array_agg(t order by o) from unnest(array['lieux', 'promos', 'stagiaires', 'user_profiles', 'affectations', 'profs', 'settings', 'stagiaires_prive',
                   'dp_dossiers', 'epcf_livrets', 'fiches_suivi', 'epcf_evaluations', 'evaluations', 'evaluations_audit',
                   'passages', 'passages_audit', 'agenda_events', 'qcm_signalements', 'themes', 'themes_progression',
                   'conditions_acceptations', 'planning_jours_off', 'emargement_seances', 'emargement_lignes',
                   'emargement_formateurs', 'effacements_journal', 'questionnaire_participations',
                   'questionnaire_reponses', 'questionnaire_ouvertures', 'questionnaire_resultats_figes',
                   'questionnaire_clotures', 'registre_qualite']) with ordinality u(t, o)
       where to_regclass('public.' || t) is not null;
    $f$;
    create function pg_temp.donnees() returns text language plpgsql as $f$
    declare t text; v text; acc text := '';
    begin
      foreach t in array pg_temp.tables_suivies() loop
        if to_regclass('public.' || t) is null then acc := acc || t || '=absente '; continue; end if;
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
        -- Participations (rattachées à la fiche, doublons fusionnés) et tables nouvelles : cas à part.
        if t in ('questionnaire_participations', 'questionnaire_resultats_figes', 'questionnaire_clotures') then continue; end if;
        execute format('select count(*) || ''/'' || coalesce(sum((select count(*) from jsonb_each(to_jsonb(x) - ''efface_le'' - ''signature_effacee_le'') e where e.value <> ''null''::jsonb)), 0) from public.%I x', t) into v;
        acc := acc || t || ' ' || v || '; ';
      end loop;
      select count(*) into v from auth.users;
      return acc || 'auth.users ' || v;
    end $f$;
  $q$;

  -- 1. Données fictives (avant la première empreinte : elles ne bougent plus ensuite) ---------------------------------
  select coalesce(max(id), 0) into v_journal0 from effacements_journal;
  insert into lieux (nom) values ('Preuve conservation L1') returning id into L1;
  insert into lieux (nom) values ('Preuve conservation L2') returning id into L2;
  insert into lieux (nom) values ('Preuve conservation L3') returning id into L3;
  -- PA : « Nîmes », finie le 11/12/2026 (étape 1 le 11/12/2027, étape 2 le 01/01/2030). PB : sans date de fin. PC :
  -- même dates, autre centre. PD : en cours (feuille ouverte aujourd'hui). PE : finie le 11/12/2026, pour l'étape 2
  -- jouée sans étape 1.
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve Nîmes', date '2026-03-02', date '2026-12-11') returning id into PA;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve sans date', date '2026-09-01', null) returning id into PB;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L2, 'Preuve autre centre', date '2026-03-02', date '2026-12-11') returning id into PC;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve en cours', v_jour_reel - 100, v_jour_reel + 60) returning id into PD;
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L1, 'Preuve sans étape 1', date '2026-03-02', date '2026-12-11') returning id into PE;
  -- PF : seule promo du lieu 3, où un seul formateur a répondu (rien sous le seuil, tâche 3).
  insert into promos (lieu_id, nom, date_debut, date_fin) values (L3, 'Preuve un formateur', date '2026-03-02', date '2026-12-11') returning id into PF;
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
  -- (sur une base où ce lot est appliqué, la contrainte demande efface_le avec anonymise_le, et le déclencheur des
  -- marques demande le drapeau de la conservation)
  perform set_config('conservation.effacement', 'on', true);
  execute format('update stagiaires set prenom = %L, anonymise_le = now() - interval ''1 day''%s where id = %s',
                 'Anonyme ' || SX, case when v_deja then ', efface_le = now() - interval ''1 day''' else '' end, SX);
  perform set_config('conservation.effacement', '', true);

  -- Comptes : FO fondateur (sans fiche ni affectation), FORM formateur de PA et PD, DIR2 direction du lieu 2, E1, E2, EQ,
  -- E4, E7, E6, EC les comptes des fiches ; E6B, second compte de la fiche S6 (doublon de fiche, tâche 3). Profils
  -- d'abord (liste blanche de la base réelle), puis comptes.
  insert into pg_temp.preuve_comptes (nom, email, uid, fiche)
  select k, 'preuve.cons.' || lower(k) || '@example.invalid', gen_random_uuid(),
         case k when 'E1' then S1 when 'E2' then S2 when 'EQ' then SE when 'E4' then S4 when 'E7' then S7
                when 'E6' then S6 when 'E6B' then S6 when 'EC' then SC end
    from unnest(array['FO', 'FORM', 'DIR2', 'E1', 'E2', 'EQ', 'E4', 'E7', 'E6', 'E6B', 'EC']) k;
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

  -- Registre qualité (lot Q4, tâche 4). RQ1 : close il y a plus de 3 ans. RQ2 : risque clos il y a plus de 3 ans (avec sa
  -- mesure). RQ3 : close depuis 3 ans moins 30 jours (pas encore due). RQ4 : en cours depuis plus de 5 ans, RQ5 : ouverte
  -- depuis plus de 5 ans (jamais closes : jamais effacées). RQ6 : close il y a 4 ans et déjà vidée. Le déclencheur du registre
  -- pose clos_le à la clôture : les dates anciennes se posent déclencheur muet (commande SET, pas set_config).
  execute 'set local session_replication_role = replica';
  insert into registre_qualite (type, date_constat, origine, description, reponse, action_decidee, etat, clos_le)
  values ('reclamation', v_jour_reel - 1600, 'stagiaire', 'Preuve registre RQ1', 'Réponse RQ1', 'Action RQ1', 'clos',
          now() - interval '3 years' - interval '10 days') returning id into RQ1;
  insert into registre_qualite (type, date_constat, origine, description, mesure_prevention, etat, clos_le)
  values ('risque', v_jour_reel - 1600, 'equipe', 'Preuve registre RQ2', 'Mesure RQ2', 'clos',
          now() - interval '3 years' - interval '2 days') returning id into RQ2;
  insert into registre_qualite (type, date_constat, origine, description, etat, clos_le)
  values ('alea', v_jour_reel - 1000, 'formateur', 'Preuve registre RQ3', 'clos',
          now() - interval '3 years' + interval '30 days') returning id into RQ3;
  insert into registre_qualite (type, date_constat, origine, description, etat)
  values ('difficulte', v_jour_reel - 1900, 'entreprise', 'Preuve registre RQ4', 'en_cours') returning id into RQ4;
  insert into registre_qualite (type, date_constat, origine, description, etat)
  values ('amelioration', v_jour_reel - 1900, 'autre', 'Preuve registre RQ5', 'ouvert') returning id into RQ5;
  insert into registre_qualite (type, date_constat, origine, description, etat, clos_le)
  values ('alea', v_jour_reel - 1600, 'equipe', 'Preuve registre RQ6', 'clos', now() - interval '4 years') returning id into RQ6;
  update registre_qualite set description = null, efface_le = now() - interval '1 year' where id = RQ6;
  execute 'set local session_replication_role = origin';

  -- Données personnelles de chaque fiche nominative : date de naissance, fiche de suivi, dossier, livret, trois textes
  -- libres, et, pour un compte, une évaluation signée de son e-mail et une acceptation des conditions.
  for c in select s.id, k.email from stagiaires s left join pg_temp.preuve_comptes k on k.fiche = s.id and k.nom <> 'E6B'
            where s.id in (S1, S2, S3, SE, S4, S7, S8, S6, SC) loop
    insert into stagiaires_prive (stagiaire_id, date_naissance) values (c.id, date '1990-01-01');
    if v_suivi then
      execute 'insert into public.fiches_suivi (stagiaire_id, promo_id, besoins)
               select $1, promo_id, ''Besoin de la fiche preuve'' from public.stagiaires where id = $1' using c.id;
    end if;
    insert into dp_dossiers (stagiaire_id, promo_id, data) select c.id, promo_id, '{"preuve": true}' from stagiaires where id = c.id;
    insert into epcf_livrets (stagiaire_id, promo_id, data) select c.id, promo_id, '{"preuve": true}' from stagiaires where id = c.id;
    insert into evaluations (stagiaire_id, promo_id, type, note, observation, created_by_email)
      select c.id, promo_id, 'Thème', 12, 'Observation preuve', c.email from stagiaires where id = c.id;
    insert into epcf_evaluations (stagiaire_id, promo_id, trame, commentaire)
      select c.id, promo_id, 'salle', 'Commentaire preuve' from stagiaires where id = c.id;
    insert into passages (stagiaire_id, promo_id, date, type, resultat, commentaire)
      select c.id, promo_id, date '2026-10-01', 'Voiture', 'Effectué', 'Commentaire preuve' from stagiaires where id = c.id;
    if c.email is not null then
      insert into conditions_acceptations (email, version) values (c.email, '2026-11-08');
    end if;
  end loop;
  -- Un thème modifié par S1 (quand la colonne existe : variante sans themes.updated_by_email, voir l'en-tête).
  if v_themes_email then
    execute 'insert into public.themes (titre, updated_by_email) values (''Preuve thème'', ''preuve.cons.e1@example.invalid'')';
  end if;

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

  -- Questionnaires (tâche 3), forme du lot Q3, écrits en direct (les fenêtres de réponse se jouent plus bas, au jour
  -- réglé). PA : fin de formation, 5 réponses dont 3 commentaires ; à six mois, 4 réponses (sous le seuil) dont 1
  -- commentaire. PD : fin de formation, 1 réponse. Formateurs 2026 : lieu 1, 3 réponses dont 2 commentaires ; lieu 2,
  -- 2 réponses (sous le seuil) dont 1 commentaire. Participations : E1 (S1) à la fin de formation de PA ; E4 (S4) à celle
  -- de PD ; E6 (S6) à celle de PE ; FO, DIR2 et EQ au lieu 1, FO et DIR2 au lieu 2 (des comptes quelconques : seule la
  -- portée compte ici). Sur une base où ce lot est appliqué, les participations des stagiaires naissent rattachées à
  -- leur fiche. Le doublon de fiche (E6B, second compte de S6) se joue à part, plus bas.
  v_rs := pg_temp.rep('fin_stagiaire', '3'); v_rf := pg_temp.rep('fin_formateur', '3');
  pPA := jsonb_build_object('promo_id', PA); pPD := jsonb_build_object('promo_id', PD);
  pL1 := jsonb_build_object('lieu_id', L1, 'annee', 2026); pL2 := jsonb_build_object('lieu_id', L2, 'annee', 2026);
  insert into questionnaire_reponses (cle, version, promo_id, lieu_id, annee, reponses, commentaire)
  select v.cle, 1, v.promo, v.lieu, v.annee, pg_temp.rep(v.cle, v.note::jsonb), v.com
    from (values ('fin_stagiaire', PA, null::integer, null::integer, '4', 'Preuve commentaire A'),
                 ('fin_stagiaire', PA, null, null, '4', null), ('fin_stagiaire', PA, null, null, '3', 'Preuve commentaire C'),
                 ('fin_stagiaire', PA, null, null, '2', 'Preuve commentaire D'), ('fin_stagiaire', PA, null, null, 'null', null),
                 ('six_mois_stagiaire', PA, null, null, '3', 'Preuve commentaire six mois'),
                 ('six_mois_stagiaire', PA, null, null, '3', null), ('six_mois_stagiaire', PA, null, null, '2', null),
                 ('six_mois_stagiaire', PA, null, null, '4', null), ('fin_stagiaire', PD, null, null, '4', null),
                 ('fin_formateur', null, L1, 2026, '4', 'Preuve formateur 1'), ('fin_formateur', null, L1, 2026, '3', 'Preuve formateur 2'),
                 ('fin_formateur', null, L1, 2026, '2', null), ('fin_formateur', null, L2, 2026, '3', 'Preuve formateur 3'),
                 ('fin_formateur', null, L2, 2026, '3', null),
                 ('fin_formateur', null, L3, 2026, '4', 'Preuve formateur seul')) v(cle, promo, lieu, annee, note, com);
  execute 'create table pg_temp.preuve_parts (cle text, promo integer, lieu integer, annee integer, nom text)';
  insert into pg_temp.preuve_parts values ('fin_stagiaire', PA, null, null, 'E1'), ('fin_stagiaire', PD, null, null, 'E4'),
    ('fin_stagiaire', PE, null, null, 'E6'),
    ('fin_formateur', null, L1, 2026, 'FO'), ('fin_formateur', null, L1, 2026, 'DIR2'), ('fin_formateur', null, L1, 2026, 'EQ'),
    ('fin_formateur', null, L2, 2026, 'FO'), ('fin_formateur', null, L2, 2026, 'DIR2'), ('fin_formateur', null, L3, 2026, 'FO');
  execute format('insert into questionnaire_participations (cle, promo_id, lieu_id, annee, user_id%s)
    select v.cle, v.promo, v.lieu, v.annee, k.uid%s from pg_temp.preuve_parts v join pg_temp.preuve_comptes k on k.nom = v.nom
',
    case when v_deja then ', stagiaire_id' else '' end,
    case when v_deja then ', case when v.cle <> ''fin_formateur'' then k.fiche end' else '' end);

  -- 2. Migration jouée entre deux empreintes --------------------------------------------------------------------
  if not v_deja then
    -- Doublon de fiche (deux comptes de S6 qui ont tous deux répondu) : migration jouée à part puis annulée. La ligne en
    -- trop ne revient pas au retour : hors de l'empreinte, donc.
    t := null;
    begin
      insert into questionnaire_participations (cle, promo_id, user_id)
      select 'fin_stagiaire', PE, uid from pg_temp.preuve_comptes where nom = 'E6B';
      select count(*) into n_part from questionnaire_participations;
      if btrim(coalesce(current_setting('preuve.migration', true), ''), E' \t\r\n') <> '' then
        execute current_setting('preuve.migration');
      end if;
      t := pg_temp.parts('fin_stagiaire', PE, null, null) || '/' || pg_temp.parts_fiche(S6) || '/'
           || (n_part - (select count(*) from questionnaire_participations));
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then t := 'erreur : ' || sqlerrm; end if;
    end;
    perform pg_temp.cas('migration : deux comptes de la même fiche (S6) : une seule participation gardée, rattachée à S6',
      t = '1/1/1', t);
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
  perform pg_temp.cas('les anciennes fonctions d''anonymisation sont supprimées (sans argument, à argument de la direction, interne)', n = 0, n::text);
  perform pg_temp.cas('les deux versions à argument de la direction (20261111_espaces_4_donnees) n''existent plus après la migration',
    to_regprocedure('public.anonymiser_promo(integer)') is null and to_regprocedure('public.etat_anonymisation_promo(integer)') is null, null);
  select string_agg(ro.rol || ':' || f.fn, ',' order by ro.rol, f.fn) into t
    from (values ('anon'), ('authenticated'), ('service_role')) ro(rol),
         (values ('public._effacer_etape1(integer)'), ('public._effacer_etape2(integer)'),
                 ('public._effacer_textes_libres(integer)')) f(fn)
   where case when to_regprocedure(f.fn) is null then true else has_function_privilege(ro.rol, f.fn, 'execute') end;
  perform pg_temp.cas('aucun droit d''appel des fonctions internes pour anon, authenticated, service_role', t is null, t);
  select string_agg(ro.rol || ':' || f.fn || ':' || case when to_regprocedure(f.fn) is null then 'absente'
                    else has_function_privilege(ro.rol, f.fn, 'execute')::text end, ',' order by ro.rol, f.fn) into t
    from (values ('anon'), ('authenticated')) ro(rol),
         (values ('public.etat_conservation()'), ('public.effacer_promo_etape1(integer)'),
                 ('public.effacer_promo_etape2(integer)'), ('public.effacer_sur_demande(integer)'),
                 ('public.clore_annee_formateurs(integer, integer)'), ('public.effacer_commentaires_formateurs(integer, integer)'),
                 ('public.figer_questionnaire_formateurs(integer, integer)'),
                 ('public.questionnaires_a_remplir()'), ('public.repondre_questionnaire(text, jsonb, integer, jsonb, text)'),
                 ('public.resultats_questionnaire(text, jsonb)'), ('public.ouvrir_questionnaire(text, jsonb, boolean)')) f(fn)
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
  perform set_config('conservation.effacement', 'on', true);  -- pour atteindre la contrainte derrière le déclencheur
  r := pg_temp.tente_blanc('update public.stagiaires set anonymise_le = now() where id = ' || S7 || ' returning id::text');
  perform set_config('conservation.effacement', '', true);
  perform pg_temp.cas('contrainte : pas d''anonymise_le sans efface_le', r like '23514%', r);
  r := pg_temp.tente_blanc('update public.stagiaires set efface_le = now() where id = ' || S7 || ' returning id::text');
  perform pg_temp.cas('déclencheur : même le propriétaire ne pose pas efface_le sans le drapeau de la conservation',
    r like '%conservation: Les marques d''effacement%', r);
  r := pg_temp.tente_blanc(format('update public.emargement_lignes set trace = null where seance_id = %s and stagiaire_id = %s returning id::text', feA, S1));
  perform pg_temp.cas('contrainte : un tracé ne s''efface pas sans signature_effacee_le (déclencheur ou contrainte)',
    r like 'P0001%' or r like '23514%', r);
  perform pg_temp.cas('état initial de S1 (PA, active, compte)', pg_temp.fiche(S1)
    = 'profil:1 compte:1 prive:1 suivi:' || case when v_suivi then 1 else 0 end || ' textes:3 emails:3 emobs:1 dossier:1 livret:1 traces:1 signees:1 absences:0 nom:nominatif actif:true efface:false anonymise:false',
    pg_temp.fiche(S1));
  v_avant_S7 := pg_temp.fiche(S7); v_avant_SC := pg_temp.fiche(SC); v_avant_SE := pg_temp.fiche(SE); v_avant_S8 := pg_temp.fiche(S8);

  -- 3 bis. Questionnaires : participations rattachées à la fiche, tables nouvelles fermées aux rôles de l'API -----------
  select string_agg(attname, ',' order by attname) into t from pg_attribute
   where attrelid = 'public.questionnaire_participations'::regclass and attnum > 0 and not attisdropped;
  perform pg_temp.cas('participations : colonnes annee, cle, lieu_id, promo_id, stagiaire_id, user_id',
    t = 'annee,cle,lieu_id,promo_id,stagiaire_id,user_id', t);
  select string_agg(a.attname || ':' || co.confdeltype::text, ',' order by a.attname) into t
    from pg_constraint co join pg_attribute a on a.attrelid = co.conrelid and a.attnum = co.conkey[1]
   where co.conrelid = 'public.questionnaire_participations'::regclass and co.contype = 'f'
     and a.attname in ('user_id', 'stagiaire_id');
  perform pg_temp.cas('participations : compte supprimé, ligne gardée sans compte (set null) ; fiche supprimée, ligne supprimée (cascade)',
    t = 'stagiaire_id:c,user_id:n', t);
  select string_agg(pg_get_constraintdef(co.oid), ' ; ' order by co.conname) into t from pg_constraint co
   where co.conrelid = 'public.questionnaire_participations'::regclass and co.contype = 'u';
  perform pg_temp.cas('participations : une seule par fiche et par questionnaire de promo',
    t = 'UNIQUE (cle, promo_id, stagiaire_id)', t);
  select string_agg(pg_get_indexdef(i.indexrelid), ' ; ') into t from pg_index i
   where i.indrelid = 'public.questionnaire_participations'::regclass and i.indisunique and i.indpred is not null;
  perform pg_temp.cas('participations : une seule par compte et par portée, pour les lignes qui ont un compte',
    t like '%UNIQUE INDEX%(cle, promo_id, lieu_id, annee, user_id) NULLS NOT DISTINCT WHERE (user_id IS NOT NULL)', t);
  perform pg_temp.cas('participations : celle de E1 rattachée à sa fiche S1',
    (select string_agg(coalesce(to_jsonb(p) ->> 'stagiaire_id', '-'), ',') from questionnaire_participations p
       join pg_temp.preuve_comptes k on k.uid = p.user_id where k.nom = 'E1') = S1::text, null);
  perform pg_temp.cas('participations : celles des formateurs sans fiche',
    (select count(*) from questionnaire_participations p where p.cle = 'fin_formateur' and p.lieu_id in (L1, L2, L3)) = 6
    and (select count(*) from questionnaire_participations p where p.cle = 'fin_formateur' and p.lieu_id in (L1, L2, L3)
            and to_jsonb(p) ->> 'stagiaire_id' is not null) = 0, null);
  select string_agg(ro.rol || ':' || ta.tab || ':' || pr.priv, ',') into t
    from (values ('anon'), ('authenticated'), ('service_role')) ro(rol),
         (values ('public.questionnaire_resultats_figes'), ('public.questionnaire_clotures')) ta(tab),
         (values ('select'), ('insert'), ('update'), ('delete'), ('truncate')) pr(priv)
   where to_regclass(ta.tab) is null or has_table_privilege(ro.rol, ta.tab, pr.priv);
  perform pg_temp.cas('résultats figés et clôtures : aucun droit des rôles de l''API', t is null, left(t, 300));
  perform pg_temp.cas('résultats figés et clôtures : sécurité par ligne active, aucune règle de lecture',
    (select count(*) from pg_class where oid in (to_regclass('public.questionnaire_resultats_figes'),
                                                 to_regclass('public.questionnaire_clotures')) and relrowsecurity) = 2
    and (select count(*) from pg_policies where schemaname = 'public'
            and tablename in ('questionnaire_resultats_figes', 'questionnaire_clotures')) = 0, null);
  select string_agg(confdeltype::text, ',' order by confdeltype::text) into t from pg_constraint
   where conrelid = to_regclass('public.questionnaire_resultats_figes') and contype = 'f';
  perform pg_temp.cas('résultats figés : supprimer la promo ou le lieu est refusé (on delete restrict)', t = 'r,r', t);
  select string_agg(ro.rol || ':' || f.fn, ',' order by ro.rol, f.fn) into t
    from (values ('anon'), ('authenticated'), ('service_role')) ro(rol),
         (values ('public._questionnaire_rebrasser(text, integer, integer, integer)'),
                 ('public._questionnaire_comptes(text, integer, integer, integer)'),
                 ('public._questionnaire_effacer_commentaires(text, integer, integer, integer)'),
                 ('public._questionnaire_figer(text, integer, integer, integer)'),
                 ('public._questionnaire_clore(integer, integer)'),
                 ('public._questionnaire_clos(text, integer, integer, integer)'),
                 ('public._questionnaire_ouvert(text, integer, integer, integer)')) f(fn)
   where case when to_regprocedure(f.fn) is null then true else has_function_privilege(ro.rol, f.fn, 'execute') end;
  perform pg_temp.cas('questionnaires : aucun droit d''appel des fonctions internes pour anon, authenticated, service_role', t is null, left(t, 300));
  -- Verrou par portée (celui de repondre_questionnaire) pris avant toute écriture des réponses ou des participations.
  foreach t in array array['_questionnaire_effacer_commentaires(text, integer, integer, integer)|update questionnaire_reponses',
                           '_questionnaire_figer(text, integer, integer, integer)|insert into questionnaire_resultats_figes',
                           '_questionnaire_figer(text, integer, integer, integer)|delete from questionnaire_participations',
                           '_questionnaire_clore(integer, integer)|delete from questionnaire_participations',
                           'repondre_questionnaire(text, jsonb, integer, jsonb, text)|insert into questionnaire_participations'] loop
    r := case when to_regprocedure('public.' || split_part(t, '|', 1)) is not null
              then pg_get_functiondef(to_regprocedure('public.' || split_part(t, '|', 1))) end;
    perform pg_temp.cas('verrou par portée pris avant « ' || split_part(t, '|', 2) || ' » : ' || split_part(split_part(t, '|', 1), '(', 1),
      r is not null and position('pg_advisory_xact_lock(hashtext(''questionnaire:''' in r) > 0
      and position(split_part(t, '|', 2) in r) > position('pg_advisory_xact_lock(hashtext(''questionnaire:''' in r),
      coalesce(position('pg_advisory_xact_lock(' in r) || ' / ' || position(split_part(t, '|', 2) in r), 'absente'));
  end loop;

  -- 4. Les étapes, dans une sous-transaction annulée -----------------------------------------------------------------
  begin
    -- Le jour réglable (voir l'en-tête).
    execute $q$
      create or replace function public._questionnaire_jour() returns date language sql stable
      set search_path to 'public', 'pg_temp' as $f$
        select coalesce(nullif(current_setting('preuve.jour', true), '')::date, (now() at time zone 'Europe/Paris')::date);
      $f$;
    $q$;

    v_lignes := pg_temp.lignes('questionnaire_clotures') + pg_temp.lignes('questionnaire_resultats_figes');
    -- 4.0 Retour refusé dès qu'une ligne existe dans les résultats figés (seule copie des pourcentages) ou les clôtures
    -- des formateurs, même sans ligne au journal.
    if not v_deja then
      foreach t in array array[
          format('insert into questionnaire_resultats_figes (cle, promo_id, seuil, reponses, questions, fige_le) values (''fin_stagiaire'', %s, 5, null, ''{}'', current_date)', PB),
          format('insert into questionnaire_clotures (lieu_id, annee) values (%s, 2020)', L1)] loop
        r := null;
        begin
          execute t;
          begin
            execute current_setting('preuve.retour');
            r := 'joué';
          exception when others then
            r := sqlerrm;
          end;
          raise exception 'preuve: annulé';
        exception when others then
          if sqlerrm <> 'preuve: annulé' then r := 'préparation : ' || sqlerrm; end if;
        end;
        perform pg_temp.cas('retour refusé quand ' || split_part(split_part(t, 'into ', 2), ' ', 1) || ' a une ligne',
          r like 'conservation: Retour impossible%', r);
      end loop;
    end if;
    -- 4.0 bis Retour refusé dès qu'une ligne « registre » est au journal (seule trace de l'effacement du registre).
    if not v_deja then
      r := null; r2 := null;
      begin
        set local role authenticated;
        perform pg_temp.qui('FO');
        r2 := pg_temp.tente('select public.effacer_registre_qualite()::text');
        reset role;
        begin
          execute current_setting('preuve.retour');
          r := 'joué';
        exception when others then
          r := sqlerrm;
        end;
        raise exception 'preuve: annulé';
      exception when others then
        if sqlerrm <> 'preuve: annulé' then r := 'préparation : ' || sqlerrm; end if;
      end;
      perform pg_temp.cas('retour refusé après un effacement du registre qualité (seule ligne « registre » au journal)',
        -- RQ1 et RQ2, plus les autres entrées déjà dues (0 en temps normal).
        r2 = 'ok ' || (2 + (select count(*) from registre_qualite where id not in (RQ1, RQ2, RQ3, RQ4, RQ5, RQ6)
                              and etat = 'clos' and efface_le is null and clos_le + interval '3 years' < now()))
        and r like 'conservation: Retour impossible%', r2 || ' | ' || coalesce(r, 'null'));
    end if;
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
    perform pg_temp.cas('etat_conservation : jour = jour de Paris réglé, registre : quatre clés (nombres et une date)',
      pg_temp.etat() ->> 'jour' = '2027-12-10'
      and (select array_agg(k order by k) from jsonb_object_keys(pg_temp.etat() -> 'registre') k)
          = array['a_clore', 'a_effacer', 'efface', 'prochaine_echeance'], (pg_temp.etat() - 'promos')::text);
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'portees_formateurs') p
           where (p ->> 'lieu_id')::int = L1 and (p ->> 'annee')::int = 2026);
    perform pg_temp.cas('etat_conservation, formateurs 2026 du lieu 1 (au seuil) : 3 participations, 2 commentaires, 3 réponses, dates 01/01/2027, 31/12/2027, 01/01/2030',
      j = jsonb_build_object('lieu_id', L1, 'lieu_nom', 'Preuve conservation L1', 'annee', 2026,
                             'a_participations', true, 'participations', 3, 'cloture_du', '2027-01-01', 'close', false,
                             'a_commentaires', true, 'commentaires', 2, 'commentaires_du', '2027-12-31',
                             'a_reponses', true, 'reponses', 3, 'sous_seuil', false, 'fige', false, 'figeage_du', '2030-01-01'),
      coalesce(j::text, 'absente'));
    select string_agg(p ->> 'lieu_id' || '/' || (p ->> 'annee') || '/' || coalesce(p ->> 'participations', '-') || '/'
                      || coalesce(p ->> 'commentaires', '-') || '/' || coalesce(p ->> 'reponses', '-') || '/'
                      || (p ->> 'a_participations') || '/' || (p ->> 'a_commentaires') || '/' || (p ->> 'a_reponses') || '/'
                      || (p ->> 'sous_seuil'), ',' order by (p ->> 'lieu_id')::int) into t
      from jsonb_array_elements(pg_temp.etat() -> 'portees_formateurs') p where (p ->> 'lieu_id')::int in (L1, L2, L3);
    perform pg_temp.cas('etat_conservation : lieux 2 (2 réponses) et 3 (1 réponse) sous le seuil : aucun nombre, seulement « il reste » et « sous le seuil »',
      t = L1 || '/2026/3/2/3/true/true/true/false,' || L2 || '/2026/-/-/-/true/true/true/true,'
          || L3 || '/2026/-/-/-/true/true/true/true', t);
    -- Résultats d'avant tout effacement (comparés aux résultats figés plus bas).
    j_fin := pg_temp.resultats('fin_stagiaire', pPA); j_six := pg_temp.resultats('six_mois_stagiaire', pPA);
    j_l1 := pg_temp.resultats('fin_formateur', pL1); j_l2 := pg_temp.resultats('fin_formateur', pL2);
    perform pg_temp.cas('résultats vivants de PA : 5 réponses à la fin de formation, six mois sous le seuil ; formateurs 3 (lieu 1) et 2 (lieu 2)',
      (j_fin ->> 'reponses')::int = 5 and j_fin #> '{questions,globalement}' = '{"4": 2, "3": 1, "2": 1, "sans_avis": 1}'::jsonb
      and j_six -> 'reponses' = 'null'::jsonb and j_six -> 'questions' = '{}'::jsonb
      and (j_l1 ->> 'reponses')::int = 3 and j_l2 -> 'reponses' = 'null'::jsonb and not (j_fin ? 'fige'),
      concat_ws(' | ', j_fin::text, j_six::text, j_l1::text, j_l2::text));
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'promos') p where (p ->> 'id')::int = PB);
    perform pg_temp.cas('etat_conservation : promo sans date de fin listée sans échéance',
      j is not null and j -> 'date_fin' = 'null'::jsonb and j -> 'etape1_du' = 'null'::jsonb and j -> 'etape2_du' = 'null'::jsonb,
      coalesce(j::text, 'absente'));
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA));
    perform pg_temp.cas('étape 1 refusée la veille (10/12/2027)', r like '%conservation: Possible à partir du 11/12/2027.', r);
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PB));
    perform pg_temp.cas('étape 1 refusée sans date de fin', r like '%conservation: Renseignez d''abord la date de fin de cette promo.', r);
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PB));
    perform pg_temp.cas('étape 2 refusée sans date de fin', r like '%conservation: Renseignez d''abord la date de fin de cette promo.', r);

    -- 4.1 bis Questionnaires des stagiaires : fermés pour de bon à la date de l'étape 1, ouverture manuelle comprise.
    r := null; t := null;
    begin
      r := pg_temp.tente(format('select public.ouvrir_questionnaire(''fin_stagiaire'', %L::jsonb, true)::text', pPA));
      perform pg_temp.qui('E2');
      t := pg_temp.repond('fin_stagiaire', pPA, v_rs);
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then raise; end if;
    end;
    perform pg_temp.cas('jumeau : la veille de l''étape 1 (10/12/2027), PA rouverte à la main, E2 y répond',
      r like 'ok%' and t like 'ok%', r || ' | ' || t);
    perform pg_temp.jour(date '2027-12-11');
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.ouvrir_questionnaire(''fin_stagiaire'', %L::jsonb, true)::text', pPA));
    perform pg_temp.cas('le 11/12/2027 (étape 1), ouverture manuelle de la fin de formation de PA refusée',
      r like '%questionnaire: Ce questionnaire est clos%', r);
    r := pg_temp.tente(format('select public.ouvrir_questionnaire(''six_mois_stagiaire'', %L::jsonb, true)::text', pPA));
    perform pg_temp.cas('le 11/12/2027, ouverture manuelle du questionnaire à six mois de PA refusée',
      r like '%questionnaire: Ce questionnaire est clos%', r);
    -- Une ouverture manuelle posée avant la date (écrite ici en direct) ne prime plus.
    reset role;
    insert into questionnaire_ouvertures (cle, promo_id, ouvert, par_email) values ('fin_stagiaire', PA, true, 'preuve.cons.fo@example.invalid')
      on conflict on constraint questionnaire_ouvertures_unique do update set ouvert = true;
    set local role authenticated;
    perform pg_temp.qui('E2');
    r := pg_temp.repond('fin_stagiaire', pPA, v_rs);
    perform pg_temp.cas('le 11/12/2027, envoi de E2 refusé malgré une ouverture manuelle posée avant',
      r like '%questionnaire: Ce questionnaire est fermé.', r);
    select count(*) into n from public.questionnaires_a_remplir();
    perform pg_temp.cas('le 11/12/2027, rien n''est proposé à E2', n = 0, n::text);
    reset role;
    delete from questionnaire_ouvertures where cle = 'fin_stagiaire' and promo_id = PA;
    set local role authenticated;
    perform pg_temp.jour(date '2027-12-10');
    perform pg_temp.qui('FO');
    r := pg_temp.tente('select count(*)::text from public.questionnaire_resultats_figes');
    r2 := pg_temp.tente('select count(*)::text from public.questionnaire_clotures');
    perform pg_temp.cas('lecture directe des résultats figés et des clôtures refusée, même au fondateur',
      r like '42501%' and r2 like '42501%', r || ' | ' || r2);

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
                               'select public.etat_conservation()::text',
                               format('select public.clore_annee_formateurs(%s, 2026)::text', L1),
                               format('select public.effacer_commentaires_formateurs(%s, 2026)::text', L1),
                               format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L1)] loop
        -- Conservation ouverte à la direction (20261111_conservation_direction, si appliquée) : en aperçu direction sur le
        -- centre de PA, le fondateur a les deux étapes de PA, comme la purge des bénévoles (geste donnees.purger) ; jouées à
        -- blanc. Tout le reste est toujours refusé.
        if c.apercu = 'direction' and to_regprocedure('public._peut_conserver_promo(integer)') is not null
           and t like '%effacer_promo_etape%' then
          r := pg_temp.tente_blanc(t);
          perform pg_temp.cas(format('%s, conservation ouverte à la direction : %s permise (à blanc)', c.lib,
            split_part(split_part(t, 'public.', 2), '(', 1)), r like 'ok {%', r);
          continue;
        end if;
        r := pg_temp.tente(t);
        perform pg_temp.cas(format('%s refusé : %s', c.lib, split_part(split_part(t, 'public.', 2), '(', 1)),
          r like '%conservation: Réservé à la gestion de la qualité.', r);
      end loop;
    end loop;
    set local role anon;
    perform pg_temp.qui('FO');
    foreach t in array array[format('select public.effacer_promo_etape1(%s)::text', PA),
                             format('select public.effacer_sur_demande(%s)::text', S1), 'select public.etat_conservation()::text',
                             format('select public.clore_annee_formateurs(%s, 2026)::text', L1),
                             format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L1)] loop
      r := pg_temp.tente(t);
      perform pg_temp.cas('rôle anon refusé (droit d''exécution) : ' || split_part(split_part(t, 'public.', 2), '(', 1),
        r like '42501%', r);
    end loop;
    reset role;
    perform pg_temp.cas('aucun refus n''a rien changé', pg_temp.donnees() = d1, null);
    set local role authenticated;

    -- 4.2 bis Marques : l'équipe de la promo (qui peut modifier une fiche) ne les pose ni ne les retire en direct.
    perform pg_temp.jour(null);
    perform pg_temp.qui('FORM', PA);
    r := pg_temp.tente_blanc(format('update public.stagiaires set efface_le = now() where id = %s returning id::text', S1));
    perform pg_temp.cas('formateur de la promo : poser efface_le en direct refusé', r like '%conservation: Les marques d''effacement%', r);
    r := pg_temp.tente_blanc(format('update public.stagiaires set efface_le = now(), anonymise_le = now() where id = %s returning id::text', S1));
    perform pg_temp.cas('formateur de la promo : poser les deux marques en direct refusé', r like '%conservation: Les marques d''effacement%', r);
    r := pg_temp.tente_blanc(format('insert into public.stagiaires (prenom, promo_id, efface_le) values (''Preuve marquée'', %s, now()) returning id::text', PA));
    perform pg_temp.cas('formateur de la promo : créer une fiche déjà marquée refusé', r like '%conservation: Les marques d''effacement%', r);
    r := pg_temp.tente_blanc(format('update public.stagiaires set nom = ''PREUVE BIS'' where id = %s returning id::text', S1));
    perform pg_temp.cas('jumeau : le formateur modifie le nom de la fiche', r = 'ok ' || S1, r);

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
      r2 := pg_temp.tente(format('select public.clore_annee_formateurs(%s, 2026)::text', L1))
            || ' | ' || pg_temp.tente(format('select public.effacer_commentaires_formateurs(%s, 2026)::text', L1))
            || ' | ' || pg_temp.tente(format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L1));
      select string_agg(p ->> 'lieu_id', ',' order by (p ->> 'lieu_id')::int) into t2
        from jsonb_array_elements(pg_temp.etat() -> 'portees_formateurs') p where (p ->> 'lieu_id')::int in (L1, L2);
      m2 := null;
      if pg_temp.tente(format('select public.clore_annee_formateurs(%s, 2026)::text', L2)) = 'ok {"efface": true}' then
        reset role;
        m2 := pg_temp.parts('fin_formateur', null, L2, 2026);
        set local role authenticated;
      end if;
      reset role;
      select count(*) into m from user_profiles where stagiaire_id = SC;
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then raise; end if;
    end;
    set local role authenticated;
    perform pg_temp.cas('direction d''un autre centre (droit élargi) : refusée sur PA et sur une fiche de PA',
      r like '%conservation: Cette promo n''est pas dans votre périmètre.%conservation: Cette promo n''est pas dans votre périmètre.%conservation: Cette fiche n''est pas dans votre périmètre.', r);
    perform pg_temp.cas('direction d''un autre centre (droit élargi) : etat_conservation ne liste que la promo de son lieu',
      t = PC::text, t);
    perform pg_temp.cas('direction d''un autre centre (droit élargi), jumeau : étape 1 de sa promo PC acceptée',
      j #>> '{}' = 'ok 1' and m = 0, j::text || ' / profil ' || m);
    perform pg_temp.cas('direction d''un autre centre (droit élargi) : refusée sur les questionnaires des formateurs du lieu 1',
      r2 like '%conservation: Ce lieu n''est pas dans votre périmètre.%conservation: Ce lieu n''est pas dans votre périmètre.%conservation: Ce lieu n''est pas dans votre périmètre.', r2);
    perform pg_temp.cas('direction d''un autre centre (droit élargi) : etat_conservation ne liste que les formateurs de son lieu',
      t2 = L2::text, t2);
    perform pg_temp.cas('direction d''un autre centre (droit élargi), jumeau : clôture des formateurs 2026 de son lieu acceptée',
      m2 = 0, coalesce(m2::text, 'refusée'));

    -- 4.4 Étape 1 le jour même.
    reset role;
    a1 := pg_temp.ids('fin_stagiaire', PA, null, null); a2 := pg_temp.ids('six_mois_stagiaire', PA, null, null);
    v_notes1 := pg_temp.notes('fin_stagiaire', PA, null, null); v_notes2 := pg_temp.notes('six_mois_stagiaire', PA, null, null);
    d2 := pg_temp.notes('fin_stagiaire', PD, null, null) || pg_temp.notes('fin_formateur', null, L1, 2026)
          || pg_temp.notes('fin_formateur', null, L2, 2026);
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_promo_etape1(%s)::text', PA));
    perform pg_temp.cas('étape 1 acceptée le 11/12/2027 : 3 fiches, 1 compte d''équipe ignoré',
      (pg_temp.res(r) ->> 'fiches')::int = 3 and (pg_temp.res(r) ->> 'comptes_equipe')::int = 1, r);
    perform pg_temp.cas(format('étape 1 : compte rendu fiche_suivi présent, %s (%s)',
        case when v_suivi then 3 else 0 end, case when v_suivi then 'table fiches_suivi présente' else 'table retirée' end),
      (pg_temp.res(r) ->> 'fiche_suivi')::int = case when v_suivi then 3 else 0 end, r);
    reset role;
    if v_themes_email then
      execute 'select string_agg(updated_by_email, '','') from public.themes where titre = ''Preuve thème''' into t;
      perform pg_temp.cas('étape 1 : e-mail de S1 remplacé dans themes.updated_by_email', t = 'anonyme', t);
    else
      perform pg_temp.cas('étape 1 : colonne themes.updated_by_email retirée, rien à remplacer, aucune erreur',
        not exists (select 1 from pg_attribute where attrelid = 'public.themes'::regclass and attname = 'updated_by_email'
                       and not attisdropped), null);
    end if;
    set local role authenticated;
    perform pg_temp.cas('étape 1 : emargement.effacement et conservation.effacement vides après la fonction',
      coalesce(current_setting('emargement.effacement', true), '') = ''
      and coalesce(current_setting('conservation.effacement', true), '') = '',
      current_setting('emargement.effacement', true) || '/' || current_setting('conservation.effacement', true));
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
    perform pg_temp.cas('étape 1 : commentaires de questionnaires de PA effacés (fin de formation et six mois) ; six mois sous le seuil : aucun nombre, au retour ni au journal',
      pg_temp.res(r) -> 'questionnaires_commentaires_effaces' = 'true'::jsonb and not (pg_temp.res(r) ? 'commentaires_questionnaires')
      and (select details -> 'questionnaires_commentaires_effaces' = 'true'::jsonb and not (details ? 'commentaires_questionnaires')
             from effacements_journal where type = 'etape1' and cible = 'promo ' || PA)
      and pg_temp.notes('fin_stagiaire', PA, null, null) = split_part(v_notes1, ' | ', 1) || ' | 0'
      and pg_temp.notes('six_mois_stagiaire', PA, null, null) = split_part(v_notes2, ' | ', 1) || ' | 0', r);
    perform pg_temp.cas('étape 1 : notes des questionnaires de PA intactes (avant : 3 et 1 commentaires)',
      split_part(pg_temp.notes('fin_stagiaire', PA, null, null), ' | ', 1) = split_part(v_notes1, ' | ', 1)
      and split_part(pg_temp.notes('six_mois_stagiaire', PA, null, null), ' | ', 1) = split_part(v_notes2, ' | ', 1)
      and split_part(v_notes1, ' | ', 2) = '3' and split_part(v_notes2, ' | ', 2) = '1', null);
    perform pg_temp.cas('étape 1 : identifiants des réponses de PA tous changés (rebrassage)',
      cardinality(a1) = 5 and cardinality(a2) = 4
      and not (a1 && pg_temp.ids('fin_stagiaire', PA, null, null)) and not (a2 && pg_temp.ids('six_mois_stagiaire', PA, null, null))
      and cardinality(pg_temp.ids('fin_stagiaire', PA, null, null)) = 5, null);
    perform pg_temp.cas('étape 1 : participation de S1 supprimée avec sa fiche', pg_temp.parts_fiche(S1) = 0
      and pg_temp.parts('fin_stagiaire', PA, null, null) = 0, pg_temp.parts_fiche(S1)::text);
    perform pg_temp.cas('étape 1 : questionnaires de PD et des formateurs intacts',
      pg_temp.notes('fin_stagiaire', PD, null, null) || pg_temp.notes('fin_formateur', null, L1, 2026)
      || pg_temp.notes('fin_formateur', null, L2, 2026) = d2, null);
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

    perform pg_temp.qui('FORM', PA);
    r := pg_temp.tente_blanc(format('update public.stagiaires set efface_le = null where id = %s returning id::text', S1));
    perform pg_temp.cas('formateur de la promo : retirer efface_le après l''étape 1 refusé', r like '%conservation: Les marques d''effacement%', r);

    -- 4.4 bis Textes libres écrits après l'étape 1 (relecture finale, constat 3) : S1 garde son nom et reste listée ; un
    -- formateur y écrit une observation de note, un commentaire de passage et d'EPCF (et leur copie dans l'historique),
    -- et annote la feuille close. L'étape 2 les revide, compteurs au retour.
    r := pg_temp.tente(format('select public.emargement_annoter(%s, %s, null, %L)::text', feA, S1, 'Observation tardive'));
    perform pg_temp.cas('après l''étape 1, un formateur annote encore la ligne de S1 sur la feuille close', r like 'ok%', r);
    reset role;
    update evaluations set observation = 'Observation tardive' where stagiaire_id = S1;
    update passages set commentaire = 'Commentaire tardif' where stagiaire_id = S1;
    update epcf_evaluations set commentaire = 'Commentaire tardif' where stagiaire_id = S1;
    insert into evaluations_audit (evaluation_id, action, before_data, after_data, changed_by_email, promo_id)
    select e.id, 'update', jsonb_build_object('stagiaire_id', S1, 'observation', null),
           jsonb_build_object('stagiaire_id', S1, 'observation', 'Observation tardive'), 'preuve.cons.form@example.invalid', PA
      from evaluations e where e.stagiaire_id = S1;
    v_tard := pg_temp.fiche(S1);
    perform pg_temp.cas('après l''étape 1, textes tardifs posés sur S1 (3 textes, 1 observation d''émargement)',
      v_tard like '% textes:3 % emobs:1 %', v_tard);
    set local role authenticated;
    perform pg_temp.qui('FO');

    -- 4.5 Étape 2 : le 31/12 de la 3e année, refusée ; le 01/01, acceptée.
    perform pg_temp.jour(date '2029-12-31');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA));
    perform pg_temp.cas('étape 2 refusée le 31/12/2029', r like '%conservation: Possible à partir du 01/01/2030.', r);
    perform pg_temp.jour(date '2030-01-01');
    r := pg_temp.tente(format('select public.effacer_promo_etape2(%s)::text', PA));
    perform pg_temp.cas('étape 2 acceptée le 01/01/2030 : 3 fiches, 1 compte d''équipe ignoré, 3 tracés (dont SX), 2 formateurs',
      (pg_temp.res(r) ->> 'fiches')::int = 3 and (pg_temp.res(r) ->> 'comptes_equipe')::int = 1
      and (pg_temp.res(r) ->> 'signatures')::int = 3 and (pg_temp.res(r) ->> 'signatures_formateurs')::int = 2, r);
    perform pg_temp.cas('étape 2 : emargement.effacement et conservation.effacement vides après la fonction',
      coalesce(current_setting('emargement.effacement', true), '') = ''
      and coalesce(current_setting('conservation.effacement', true), '') = '',
      current_setting('emargement.effacement', true) || '/' || current_setting('conservation.effacement', true));
    reset role;
    perform pg_temp.cas('étape 2 : les textes écrits après l''étape 1 sont partis, comptés au retour (1 de chaque sorte), historique compris',
      (pg_temp.res(r) ->> 'epcf_textes')::int = 1 and (pg_temp.res(r) ->> 'observations')::int = 1
      and (pg_temp.res(r) ->> 'commentaires_passages')::int = 1 and (pg_temp.res(r) ->> 'emargement_observations')::int = 1
      and (select count(*) from evaluations_audit where (after_data ->> 'stagiaire_id')::int = S1
             and (after_data ->> 'observation' is not null or before_data ->> 'observation' is not null)) = 0, r);
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
    perform pg_temp.cas('étape 2 : les deux questionnaires de PA figés, réponses et participations de PA supprimées',
      (select details ->> 'questionnaires_figes' from effacements_journal where type = 'etape2' and cible = 'promo ' || PA) = '2'
      and pg_temp.parts('fin_stagiaire', PA, null, null) + pg_temp.parts('six_mois_stagiaire', PA, null, null) = 0
      and cardinality(pg_temp.ids('fin_stagiaire', PA, null, null)) + cardinality(pg_temp.ids('six_mois_stagiaire', PA, null, null)) = 0,
      (select details::text from effacements_journal where type = 'etape2' and cible = 'promo ' || PA));
    perform pg_temp.cas('étape 2 : fin de formation de PA (5 réponses), comptes figés égaux à ceux d''avant',
      (select reponses || '/' || seuil || '/' || (questions = j_fin -> 'questions') || '/' || fige_le from questionnaire_resultats_figes
        where cle = 'fin_stagiaire' and promo_id = PA) = '5/5/true/2030-01-01', null);
    perform pg_temp.cas('étape 2 : six mois de PA (4 réponses), aucun compte figé, seulement la marque sous le seuil',
      (select coalesce(reponses::text, 'nul') || '/' || seuil || '/' || questions::text from questionnaire_resultats_figes
        where cle = 'six_mois_stagiaire' and promo_id = PA) = 'nul/5/{}', null);
    perform pg_temp.cas('étape 2 : questionnaires de PD et des formateurs intacts',
      pg_temp.notes('fin_stagiaire', PD, null, null) || pg_temp.notes('fin_formateur', null, L1, 2026)
      || pg_temp.notes('fin_formateur', null, L2, 2026) = d2
      and (select count(*) from questionnaire_resultats_figes where promo_id in (PB, PC, PD, PE) or lieu_id in (L1, L2)) = 0, null);
    set local role authenticated;
    perform pg_temp.qui('FO');
    j := pg_temp.resultats('fin_stagiaire', pPA); m := null;
    perform pg_temp.cas('après figeage, resultats_questionnaire rend la ligne figée (fige, fige_le), mêmes comptes qu''avant',
      j - 'fige' - 'fige_le' = j_fin and j -> 'fige' = 'true'::jsonb and j ->> 'fige_le' = '2030-01-01', j::text);
    j := pg_temp.resultats('six_mois_stagiaire', pPA);
    perform pg_temp.cas('après figeage sous le seuil, resultats_questionnaire : figé, nombre masqué, aucune question',
      j - 'fige' - 'fige_le' = j_six and j -> 'fige' = 'true'::jsonb, j::text);
    reset role;
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
    perform pg_temp.cas('étape 2 sans étape 1 : participation de S6 supprimée, rien à figer (aucune réponse dans PE)',
      pg_temp.parts_fiche(S6) = 0 and pg_temp.parts('fin_stagiaire', PE, null, null) = 0
      and (pg_temp.res(r) ->> 'questionnaires_figes')::int = 0
      and (select count(*) from questionnaire_resultats_figes where promo_id = PE) = 0, r);

    -- 4.7 Effacement sur demande d'une fiche active (S4, promo en cours), au vrai jour.
    perform pg_temp.jour(null);
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', S4));
    perform pg_temp.cas('demande sur une fiche active : acceptée', pg_temp.res(r) is not null and (pg_temp.res(r) ->> 'deja') is null, r);
    perform pg_temp.cas('demande : emargement.effacement et conservation.effacement vides après la fonction',
      coalesce(current_setting('emargement.effacement', true), '') = ''
      and coalesce(current_setting('conservation.effacement', true), '') = '',
      current_setting('emargement.effacement', true) || '/' || current_setting('conservation.effacement', true));
    reset role;
    perform pg_temp.cas('après la demande, S4 : tout effacé tout de suite, actif toujours vrai (pas d''abandon)',
      pg_temp.fiche(S4) = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:0 livret:0 traces:0 signees:1 absences:0 nom:anonyme actif:true efface:true anonymise:true',
      pg_temp.fiche(S4));
    set local role authenticated;
    perform pg_temp.qui('FORM', PD);
    r := pg_temp.tente_blanc(format('update public.stagiaires set efface_le = null, anonymise_le = null where id = %s returning id::text', S4));
    reset role;
    perform pg_temp.cas('formateur de la promo : retirer les marques d''une fiche effacée sur demande refusé (elle resterait non signable)',
      r like '%conservation: Les marques d''effacement%', r);
    perform pg_temp.cas('demande : une ligne « demande », cible « stagiaire n »',
      (select count(*) from effacements_journal where type = 'demande' and cible = 'stagiaire ' || S4) = 1, null);
    perform pg_temp.cas('demande : la participation de S4 est supprimée, la réponse anonyme de PD reste',
      pg_temp.parts_fiche(S4) = 0 and pg_temp.parts('fin_stagiaire', PD, null, null) = 0
      and cardinality(pg_temp.ids('fin_stagiaire', PD, null, null)) = 1, pg_temp.parts_fiche(S4)::text);
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

    -- 4.7 ter fiches_effacees_sur_demande : réservée à l'équipe de chaque promo (fondateur, formateur de la promo, direction
    -- de son lieu). S4 (PD) est demandée par la section précédente ; SC (PC, autre centre) l'est ici, dans une
    -- sous-transaction annulée. Un stagiaire de la promo (qui passe peut_acceder_promo) reçoit une liste vide, sans erreur.
    fe_r := array_fill(''::text, array[10]);
    begin
      reset role;
      insert into effacements_journal (type, cible, fait_par_email, details)
      values ('demande', 'stagiaire ' || SC, 'preuve@example.invalid', '{}'::jsonb);
      set local role authenticated;
      fe_c := 'select coalesce(string_agg(x::text, '','' order by x), ''vide'') from public.fiches_effacees_sur_demande(%s) x';
      perform pg_temp.qui('FORM', PD);
      fe_r[1] := pg_temp.tente(format(fe_c, format('array[%s, %s]', PD, PC)));
      fe_r[2] := pg_temp.tente(format(fe_c, format('array[%s]', PC)));
      perform pg_temp.qui('E7', PD);
      fe_r[3] := pg_temp.tente(format(fe_c, format('array[%s, %s]', PD, PC)));
      perform pg_temp.qui('DIR2', PC);
      fe_r[4] := pg_temp.tente(format(fe_c, format('array[%s, %s]', PD, PC)));
      perform pg_temp.qui('FO');
      fe_r[5] := pg_temp.tente(format(fe_c, format('array[%s, %s]', PD, PC)));
      fe_r[6] := pg_temp.tente(format(fe_c, '''{}''::integer[]'));
      fe_r[7] := pg_temp.tente(format(fe_c, 'null::integer[]'));
      perform pg_temp.qui(null);
      fe_r[8] := pg_temp.tente(format(fe_c, format('array[%s]', PD)));
      -- Contre-épreuve : sans la condition d'équipe (peut_acceder_promo seul), le stagiaire verrait la fiche.
      reset role;
      execute $q$
        create or replace function public.fiches_effacees_sur_demande(p_promo_ids integer[])
        returns setof integer language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
          select s.id from stagiaires s
           where s.promo_id = any (coalesce(p_promo_ids, '{}'::integer[])) and peut_acceder_promo(s.promo_id)
             and exists (select 1 from effacements_journal j where j.type = 'demande' and j.cible = 'stagiaire ' || s.id)
           order by s.id;
        $f$;
      $q$;
      set local role authenticated;
      perform pg_temp.qui('E7', PD);
      fe_r[9] := pg_temp.tente(format(fe_c, format('array[%s, %s]', PD, PC)));
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then raise; end if;
    end;
    reset role;
    perform pg_temp.cas('fiches effacées : le formateur de la promo voit la fiche demandée en PD, pas celle de PC', fe_r[1] = 'ok ' || S4, fe_r[1]);
    perform pg_temp.cas('fiches effacées : ne voit rien pour une promo qui n''est pas la sienne', fe_r[2] = 'ok vide', fe_r[2]);
    perform pg_temp.cas('fiches effacées : un stagiaire de la promo reçoit une liste vide, sans erreur', fe_r[3] = 'ok vide', fe_r[3]);
    perform pg_temp.cas('fiches effacées : la direction d''un lieu ne voit que la fiche de son lieu', fe_r[4] = 'ok ' || SC, fe_r[4]);
    perform pg_temp.cas('fiches effacées : le fondateur voit les deux', fe_r[5] = 'ok ' || S4 || ',' || SC, fe_r[5]);
    perform pg_temp.cas('fiches effacées : tableau vide ou nul, liste vide', fe_r[6] = 'ok vide' and fe_r[7] = 'ok vide', fe_r[6] || ' | ' || fe_r[7]);
    perform pg_temp.cas('fiches effacées : sans session, liste vide', fe_r[8] = 'ok vide', fe_r[8]);
    perform pg_temp.cas('fiches effacées : contre-épreuve, sans la condition d''équipe le stagiaire verrait la fiche (le cas stagiaire serait ROUGE)',
      fe_r[9] = 'ok ' || S4, fe_r[9]);
    perform pg_temp.cas('fiches effacées : droits d''exécution (anon et public non, authenticated oui)',
      not has_function_privilege('anon', 'public.fiches_effacees_sur_demande(integer[])', 'execute')
      and has_function_privilege('authenticated', 'public.fiches_effacees_sur_demande(integer[])', 'execute')
      and not exists (select 1 from pg_proc p, aclexplode(p.proacl) ac
                       where p.oid = 'public.fiches_effacees_sur_demande(integer[])'::regprocedure and ac.grantee = 0),
      null);
    set local role authenticated;

    -- 4.7 bis Compte supprimé puis recréé sur la même fiche : la participation, tenue par la fiche, refuse une deuxième
    -- réponse. PD est dans sa fenêtre le jour de sa fin.
    perform pg_temp.jour((select date_fin from promos where id = PD));
    set local role authenticated;
    perform pg_temp.qui('E7');
    r := pg_temp.repond('fin_stagiaire', pPD, v_rs);
    perform pg_temp.cas('E7 (fiche S7) répond à la fin de formation de PD', r like 'ok%', r);
    reset role;
    perform pg_temp.cas('la participation de E7 porte sa fiche S7',
      (select count(*) from questionnaire_participations p join pg_temp.preuve_comptes k on k.uid = p.user_id
        where k.nom = 'E7' and p.promo_id = PD and to_jsonb(p) ->> 'stagiaire_id' = S7::text) = 1, null);
    r := null; t := null; r2 := null; t2 := null; m2 := null;
    begin
      delete from user_profiles where email = 'preuve.cons.e7@example.invalid';
      delete from auth.users where email = 'preuve.cons.e7@example.invalid';
      select count(*) into m2 from questionnaire_participations p
       where p.promo_id = PD and p.user_id is null and to_jsonb(p) ->> 'stagiaire_id' = S7::text;
      insert into pg_temp.preuve_comptes (nom, email, uid, fiche) values
        ('E7BIS', 'preuve.cons.e7bis@example.invalid', gen_random_uuid(), S7),
        ('E8', 'preuve.cons.e8@example.invalid', gen_random_uuid(), S8);
      insert into user_profiles (email, role, stagiaire_id)
      select email, 'stagiaire', fiche from pg_temp.preuve_comptes where nom in ('E7BIS', 'E8');
      insert into auth.users (id, email) select uid, email from pg_temp.preuve_comptes where nom in ('E7BIS', 'E8');
      set local role authenticated;
      perform pg_temp.qui('E7BIS');
      select string_agg(q.cle || ' ' || q.portee::text, ',') into t from public.questionnaires_a_remplir() q;
      r := pg_temp.repond('fin_stagiaire', pPD, v_rs);
      perform pg_temp.qui('E8');
      select string_agg(q.cle || ' ' || q.portee::text, ',') into t2 from public.questionnaires_a_remplir() q;
      r2 := pg_temp.repond('fin_stagiaire', pPD, v_rs);
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then raise; end if;
    end;
    perform pg_temp.cas('compte de E7 supprimé : sa participation reste, sans compte, rattachée à S7', m2 = 1, m2::text);
    perform pg_temp.cas('compte recréé (E7BIS) sur la fiche S7 : rien n''est proposé', t is null, t);
    perform pg_temp.cas('compte recréé sur la fiche S7 : deuxième réponse refusée', r like '%questionnaire: Tu as déjà répondu à ce questionnaire.', r);
    perform pg_temp.cas('jumeau : E8 (fiche S8, sans participation) a la fin de formation de PD et y répond',
      t2 = 'fin_stagiaire ' || pPD::text and r2 like 'ok%', t2 || ' | ' || r2);

    -- 4.7 quater Demande d'une personne dont l'équipe a déjà retiré le compte (relecture finale, constat 2). S7 (PD) a signé
    -- sa ligne de la feuille close sur son appareil, fait un signalement de question depuis sa fiche, accepté les conditions,
    -- et une évaluation porte son adresse. L'équipe retire son profil (le compte de connexion reste, comme dans l'app). La
    -- demande retrouve son adresse par sa ligne signée et son signalement : plus aucune trace, compte de connexion compris.
    -- Jumeau : la même adresse sert de nouveau à un profil, sur une autre fiche (S8, qui a aussi signé sous cette adresse) :
    -- l'adresse ne part que des lignes de S7 ; le profil, le compte, l'acceptation et la ligne de S8 restent. Deux
    -- sous-transactions annulées.
    reset role;
    cr := array_fill(''::text, array[8]);
    begin
      insert into qcm_signalements (question_id, email, stagiaire_id, motif)
      values (1, 'preuve.cons.e7@example.invalid', S7, 'autre');
      cr[1] := pg_temp.traces('preuve.cons.e7@example.invalid');
      delete from user_profiles where email = 'preuve.cons.e7@example.invalid';
      set local role authenticated;
      perform pg_temp.qui('FO');
      cr[2] := pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', S7));
      reset role;
      cr[3] := pg_temp.traces('preuve.cons.e7@example.invalid');
      cr[4] := pg_temp.fiche(S7);
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then raise; end if;
    end;
    reset role;
    begin
      insert into qcm_signalements (question_id, email, stagiaire_id, motif)
      values (1, 'preuve.cons.e7@example.invalid', S7, 'autre');
      update user_profiles set stagiaire_id = S8 where email = 'preuve.cons.e7@example.invalid';
      insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par, maj_par)
      values (feD, PD, S8, v_tr, now() - interval '7 days', 'preuve.cons.e7@example.invalid', 'preuve.cons.e7@example.invalid');
      set local role authenticated;
      perform pg_temp.qui('FO');
      cr[5] := pg_temp.tente(format('select public.effacer_sur_demande(%s)::text', S7));
      reset role;
      cr[6] := pg_temp.traces('preuve.cons.e7@example.invalid');
      cr[7] := (select count(*)::text from emargement_lignes where stagiaire_id = S7
                  and ('preuve.cons.e7@example.invalid' in (lower(signe_par), lower(maj_par))))
               || '/' || (select count(*)::text from emargement_lignes where stagiaire_id = S8
                  and lower(signe_par) = 'preuve.cons.e7@example.invalid' and lower(maj_par) = 'preuve.cons.e7@example.invalid');
      raise exception 'preuve: annulé';
    exception when others then
      if sqlerrm <> 'preuve: annulé' then raise; end if;
    end;
    reset role;
    perform pg_temp.cas('compte retiré : avant la demande, l''adresse de S7 est sur sa ligne, son évaluation, son signalement, ses conditions',
      cr[1] = 'lignes:1 evaluations:1 signalements:1 conditions:1 profils:1 comptes:1', cr[1]);
    perform pg_temp.cas('compte retiré puis demande : acceptée', cr[2] like 'ok {%' and cr[2] not like '%"deja"%', cr[2]);
    perform pg_temp.cas('compte retiré puis demande : plus aucune trace de l''adresse (ligne, évaluation, signalement, conditions, compte de connexion)',
      cr[3] = 'lignes:0 evaluations:0 signalements:0 conditions:0 profils:0 comptes:0', cr[3]);
    perform pg_temp.cas('compte retiré puis demande : la fiche S7 a tout perdu',
      cr[4] = 'profil:0 compte:0 prive:0 suivi:0 textes:0 emails:0 emobs:0 dossier:0 livret:0 traces:0 signees:2 absences:0 nom:anonyme actif:true efface:true anonymise:true',
      cr[4]);
    perform pg_temp.cas('jumeau : adresse de S7 servant de nouveau à un profil (fiche S8) : demande acceptée',
      cr[5] like 'ok {%' and cr[5] not like '%"deja"%', cr[5]);
    perform pg_temp.cas('jumeau : l''adresse reste au profil, au compte, aux conditions et à la ligne de S8 ; partie des lignes, de l''évaluation et du signalement de S7',
      cr[6] = 'lignes:1 evaluations:0 signalements:0 conditions:1 profils:1 comptes:1', cr[6]);
    perform pg_temp.cas('jumeau : aucune ligne de S7 ne porte plus l''adresse, la ligne de S8 la garde', cr[7] = '0/1', cr[7]);

    -- 4.9 Formateurs (lieu 1, 2026) : liste des répondants effacée à partir du 01/01/2027, commentaires à partir du
    -- 31/12/2027, pourcentages seuls à partir du 01/01/2030 ; chaque étape refusée la veille, rejouable sans effet.
    set local role authenticated;
    perform pg_temp.qui('FO');
    perform pg_temp.jour(date '2026-12-31');
    r := pg_temp.tente(format('select public.clore_annee_formateurs(%s, 2026)::text', L1));
    perform pg_temp.cas('formateurs : clôture de 2026 refusée le 31/12/2026', r like '%conservation: Possible à partir du 01/01/2027.', r);
    perform pg_temp.jour(date '2027-01-01');
    r := pg_temp.tente(format('select public.ouvrir_questionnaire(''fin_formateur'', %L::jsonb, true)::text', pL1));
    perform pg_temp.qui('FORM');
    select count(*) into n from public.questionnaires_a_remplir() q where q.portee = pL1;
    t := pg_temp.tente_blanc(format('select public.repondre_questionnaire(''fin_formateur'', %L::jsonb, 1, %L::jsonb, null)::text', pL1, v_rf));
    perform pg_temp.cas('jumeau : avant la clôture, l''année 2026 rouverte à la main est proposée à FORM, qui peut y répondre',
      r like 'ok%' and n = 1 and t like 'ok%', r || ' | ' || n || ' | ' || t);
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.clore_annee_formateurs(%s, 2026)::text', L1));
    perform pg_temp.cas('formateurs : clôture de 2026 acceptée le 01/01/2027, 3 participations effacées', r = 'ok {"efface": true, "participations": 3}', r);
    reset role;
    perform pg_temp.cas('formateurs : après la clôture, plus aucune participation au lieu 1 pour 2026 ; lieu 2 intact',
      pg_temp.parts('fin_formateur', null, L1, 2026) = 0 and pg_temp.parts('fin_formateur', null, L2, 2026) = 2, null);
    perform pg_temp.cas('formateurs : une ligne de journal « questionnaires », cible « lieu n, année 2026 »',
      (select count(*) from effacements_journal where type = 'questionnaires' and cible = 'lieu ' || L1 || ', année 2026') = 1, null);
    set local role authenticated;
    perform pg_temp.qui('FORM');
    select count(*) into n from public.questionnaires_a_remplir() q where q.portee = pL1;
    perform pg_temp.cas('formateurs : après la clôture, l''année 2026 n''est plus proposée malgré l''ouverture manuelle', n = 0, n::text);
    r := pg_temp.repond('fin_formateur', pL1, v_rf);
    perform pg_temp.cas('formateurs : après la clôture, envoi refusé pour 2026', r like '%questionnaire: Ce questionnaire est fermé.', r);
    select count(*) into n from public.questionnaires_a_remplir() q where q.portee = jsonb_build_object('lieu_id', L1, 'annee', 2027);
    perform pg_temp.cas('jumeau : l''année 2027 du lieu 1 (dans sa fenêtre) reste proposée à FORM', n = 1, n::text);
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.ouvrir_questionnaire(''fin_formateur'', %L::jsonb, true)::text', pL1));
    perform pg_temp.cas('formateurs : après la clôture, ouverture manuelle de 2026 refusée', r like '%questionnaire: Ce questionnaire est clos%', r);
    reset role;
    d1 := pg_temp.donnees();
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.clore_annee_formateurs(%s, 2026)::text', L1));
    reset role;
    perform pg_temp.cas('formateurs : clôture rejouée, rien ne change, aucune seconde ligne de journal',
      r = 'ok {"efface": false, "participations": 0}' and pg_temp.donnees() = d1, r);

    -- Commentaires : refusés le 30/12/2027, effacés le 31/12/2027, notes intactes, identifiants changés.
    a1 := pg_temp.ids('fin_formateur', null, L1, 2026); v_notes1 := pg_temp.notes('fin_formateur', null, L1, 2026);
    v_notes2 := pg_temp.notes('fin_formateur', null, L2, 2026);
    set local role authenticated;
    perform pg_temp.qui('FO');
    perform pg_temp.jour(date '2027-12-30');
    r := pg_temp.tente(format('select public.effacer_commentaires_formateurs(%s, 2026)::text', L1));
    perform pg_temp.cas('formateurs : commentaires de 2026 refusés le 30/12/2027', r like '%conservation: Possible à partir du 31/12/2027.', r);
    perform pg_temp.jour(date '2027-12-31');
    r := pg_temp.tente(format('select public.effacer_commentaires_formateurs(%s, 2026)::text', L1));
    reset role;
    perform pg_temp.cas('formateurs : 2 commentaires effacés le 31/12/2027, notes intactes, lieu 2 intact',
      pg_temp.res(r) = '{"efface": true, "commentaires": 2, "participations": 0}'::jsonb
      and pg_temp.notes('fin_formateur', null, L1, 2026) = split_part(v_notes1, ' | ', 1) || ' | 0'
      and split_part(v_notes1, ' | ', 2) = '2' and pg_temp.notes('fin_formateur', null, L2, 2026) = v_notes2, r);
    perform pg_temp.cas('formateurs : identifiants des réponses tous changés (rebrassage)',
      cardinality(a1) = 3 and cardinality(pg_temp.ids('fin_formateur', null, L1, 2026)) = 3
      and not (a1 && pg_temp.ids('fin_formateur', null, L1, 2026)), null);
    perform pg_temp.cas('formateurs : une seconde ligne de journal pour le lieu 1 (commentaires)',
      (select count(*) from effacements_journal where type = 'questionnaires' and cible = 'lieu ' || L1 || ', année 2026') = 2, null);
    d1 := pg_temp.donnees();
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.effacer_commentaires_formateurs(%s, 2026)::text', L1));
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'portees_formateurs') p
           where (p ->> 'lieu_id')::int = L1 and (p ->> 'annee')::int = 2026);
    reset role;
    perform pg_temp.cas('formateurs : effacement des commentaires rejoué, rien ne change (identifiants compris), aucune ligne de journal',
      pg_temp.res(r) = '{"efface": false, "commentaires": 0, "participations": 0}'::jsonb and pg_temp.donnees() = d1, r);
    perform pg_temp.cas('etat_conservation, formateurs 2026 du lieu 1 après clôture et commentaires : 0 participation, 0 commentaire, close',
      (j ->> 'participations')::int = 0 and (j ->> 'commentaires')::int = 0 and (j ->> 'reponses')::int = 3
      and j -> 'close' = 'true'::jsonb and j -> 'fige' = 'false'::jsonb, j::text);

    -- Figeage : refusé le 31/12/2029, fait le 01/01/2030 (lieu 1 : 3 réponses, comptes ; lieu 2 : 2 réponses, marque
    -- sous le seuil, clôture faite au passage).
    set local role authenticated;
    perform pg_temp.qui('FO');
    perform pg_temp.jour(date '2029-12-31');
    r := pg_temp.tente(format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L1));
    perform pg_temp.cas('formateurs : figeage de 2026 refusé le 31/12/2029', r like '%conservation: Possible à partir du 01/01/2030.', r);
    perform pg_temp.jour(date '2030-01-01');
    r := pg_temp.tente(format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L1));
    j := pg_temp.resultats('fin_formateur', pL1);
    reset role;
    perform pg_temp.cas('formateurs : figeage du lieu 1 accepté le 01/01/2030, comptes égaux à ceux d''avant',
      pg_temp.res(r) -> 'fige' = 'true'::jsonb and j - 'fige' - 'fige_le' = j_l1 and j -> 'fige' = 'true'::jsonb
      and j ->> 'fige_le' = '2030-01-01', r || ' | ' || j::text);
    perform pg_temp.cas('formateurs : après figeage, réponses et participations du lieu 1 pour 2026 absentes',
      cardinality(pg_temp.ids('fin_formateur', null, L1, 2026)) = 0 and pg_temp.parts('fin_formateur', null, L1, 2026) = 0, null);
    d1 := pg_temp.donnees();
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L1));
    reset role;
    perform pg_temp.cas('formateurs : figeage rejoué, { deja: true }, rien ne change, aucune ligne de journal',
      r = 'ok {"deja": true}' and pg_temp.donnees() = d1, r);
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente(format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L2));
    j := pg_temp.resultats('fin_formateur', pL2);
    reset role;
    perform pg_temp.cas('formateurs : lieu 2 (2 réponses) figé sous le seuil : aucun compte, nombre masqué',
      j - 'fige' - 'fige_le' = j_l2 and j -> 'fige' = 'true'::jsonb and j -> 'reponses' = 'null'::jsonb
      and (select coalesce(reponses::text, 'nul') || '/' || seuil || '/' || questions::text from questionnaire_resultats_figes
            where lieu_id = L2 and annee = 2026) = 'nul/3/{}', r || ' | ' || j::text);
    perform pg_temp.cas('formateurs : lieu 2 figé sans clôture préalable : participations effacées, année close',
      pg_temp.parts('fin_formateur', null, L2, 2026) = 0 and cardinality(pg_temp.ids('fin_formateur', null, L2, 2026)) = 0
      and (select count(*) from questionnaire_clotures where lieu_id = L2 and annee = 2026) = 1, null);
    set local role authenticated;
    perform pg_temp.qui('FO');
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'portees_formateurs') p
           where (p ->> 'lieu_id')::int = L1 and (p ->> 'annee')::int = 2026);
    reset role;
    perform pg_temp.cas('etat_conservation, formateurs 2026 du lieu 1 après figeage : figé, plus aucune réponse',
      j -> 'fige' = 'true'::jsonb and j -> 'a_reponses' = 'false'::jsonb and j -> 'a_participations' = 'false'::jsonb
      and j -> 'a_commentaires' = 'false'::jsonb and j -> 'sous_seuil' = 'false'::jsonb, j::text);

    -- Lieu 3 : un seul formateur a répondu. Aucun nombre, nulle part : état, retours des trois fonctions, journal.
    set local role authenticated;
    perform pg_temp.qui('FO');
    j := (select p from jsonb_array_elements(pg_temp.etat() -> 'portees_formateurs') p
           where (p ->> 'lieu_id')::int = L3 and (p ->> 'annee')::int = 2026);
    r := pg_temp.tente(format('select public.clore_annee_formateurs(%s, 2026)::text', L3));
    r2 := pg_temp.tente(format('select public.effacer_commentaires_formateurs(%s, 2026)::text', L3));
    t2 := pg_temp.tente(format('select public.figer_questionnaire_formateurs(%s, 2026)::text', L3));
    t := (select string_agg(p::text, ',') from jsonb_array_elements(pg_temp.etat() -> 'portees_formateurs') p
           where (p ->> 'lieu_id')::int = L3);
    reset role;
    perform pg_temp.cas('lieu 3 (un seul répondant), état : il reste des participations, un commentaire, une réponse, sans aucun nombre',
      j - 'lieu_id' - 'lieu_nom' - 'cloture_du' - 'commentaires_du' - 'figeage_du' - 'annee'
        = '{"a_participations": true, "participations": null, "close": false, "a_commentaires": true, "commentaires": null, "a_reponses": true, "reponses": null, "sous_seuil": true, "fige": false}'::jsonb,
      coalesce(j::text, 'absente'));
    perform pg_temp.cas('lieu 3 : clôture, commentaires et figeage faits, retours sans aucun nombre',
      r = 'ok {"efface": true}' and r2 = 'ok {"efface": true}'
      and pg_temp.res(t2) = '{"fige": true, "reponses": null, "sous_seuil": true}'::jsonb
      and pg_temp.parts('fin_formateur', null, L3, 2026) = 0 and cardinality(pg_temp.ids('fin_formateur', null, L3, 2026)) = 0,
      r || ' | ' || r2 || ' | ' || t2);
    perform pg_temp.cas('lieu 3 : après figeage, état sans aucun nombre (figé, plus rien)',
      t like '%"fige": true%' and t like '%"reponses": null%' and t like '%"participations": null%'
      and t like '%"commentaires": null%', t);
    select string_agg(cible || ' ' || details::text, ' | ') into t from effacements_journal
     where type = 'questionnaires' and cible in ('lieu ' || L2 || ', année 2026', 'lieu ' || L3 || ', année 2026')
       and exists (select 1 from jsonb_each(details) e where jsonb_typeof(e.value) = 'number');
    perform pg_temp.cas('journal des lieux 2 et 3 (sous le seuil) : aucun nombre dans les détails',
      t is null and (select count(*) from effacements_journal where type = 'questionnaires'
                      and cible = 'lieu ' || L3 || ', année 2026') = 3, t);
    select string_agg(type || ' ' || cible || ' ' || details::text, ' | ') into t from effacements_journal
     where type = 'questionnaires' and fait_par_email like 'preuve.cons.%'
       and (cible !~ ('^lieu [0-9]+, année [0-9]{4}$') or details::text ~* '@|preuve|martin|durand|example'
            or fait_par_email <> 'preuve.cons.fo@example.invalid');
    perform pg_temp.cas('journal « questionnaires » : cibles « lieu n, année aaaa », aucun nom ni commentaire, auteur le fondateur',
      t is null and (select count(*) from effacements_journal where type = 'questionnaires'
                      and cible in ('lieu ' || L1 || ', année 2026', 'lieu ' || L2 || ', année 2026',
                                    'lieu ' || L3 || ', année 2026')) = 7
      and (select count(*) from effacements_journal where type = 'questionnaires' and fait_par_email like 'preuve.cons.%') = 7, t);

    -- 4.8 Rien d'autre n'a bougé : fiches témoins des autres promos, journal sans nom ni e-mail.
    perform pg_temp.cas('témoin S7 (PD) : seule sa signature du jour s''ajoute',
      pg_temp.fiche(S7) = replace(v_avant_S7, 'traces:1 signees:1', 'traces:2 signees:2'),
      pg_temp.fiche(S7) || ' / avant ' || v_avant_S7);
    perform pg_temp.cas('témoin S8 (PD) : seule l''absence de la clôture s''ajoute',
      pg_temp.fiche(S8) = replace(v_avant_S8, 'absences:0', 'absences:1'), pg_temp.fiche(S8) || ' / avant ' || v_avant_S8);
    perform pg_temp.cas('témoin SC (autre centre) : intacte', pg_temp.fiche(SC) = v_avant_SC, pg_temp.fiche(SC));
    select string_agg(type || ' ' || cible || ' ' || details::text, ' | ') into t from effacements_journal
     where id > v_journal0 and type in ('etape1', 'etape2', 'demande')
       and (cible !~ '^(promo|stagiaire) [0-9]+$' or details::text ~* '@|preuve|martin|durand|example');
    perform pg_temp.cas('journal : cibles « promo n » ou « stagiaire n », aucun nom ni e-mail dans les détails', t is null, t);
    perform pg_temp.cas('journal : le fondateur est l''auteur de chaque ligne de ce lot',
      (select count(*) from effacements_journal where id > v_journal0 and type in ('etape1', 'etape2', 'demande')
          and fait_par_email <> 'preuve.cons.fo@example.invalid') = 0
      and (select count(*) from effacements_journal where id > v_journal0 and type in ('etape1', 'etape2', 'demande')) = 4, null);
    perform pg_temp.cas('aucune étape n''écrit actif : S1, S3, S4, S6 actives ; S2 en abandon',
      (select string_agg(id || ':' || actif, ',' order by id) from stagiaires where id in (S1, S2, S3, S4, S6))
        = (select string_agg(x.id || ':' || (x.id <> S2), ',' order by x.id) from unnest(array[S1, S2, S3, S4, S6]) x(id)), null);

    -- 4.9 bis Registre qualité : l'effacement à 3 ans écrit une ligne au journal, une seule fois.
    -- etat_conservation compte tout le registre : l'attendu est la part de RQ1 à RQ6 (2 à effacer, 2 jamais closes,
    -- 1 vidée, échéance de RQ3) plus celle des autres entrées, mesurée ici avec la même règle (b_*).
    select count(*) filter (where etat = 'clos' and efface_le is null and clos_le + interval '3 years' < now()),
           count(*) filter (where etat <> 'clos'), count(*) filter (where efface_le is not null),
           min(clos_le + interval '3 years') filter (where etat = 'clos' and efface_le is null
                                                     and clos_le + interval '3 years' >= now())
      into b_eff, b_clore, b_efface, b_echeance
      from registre_qualite where id not in (RQ1, RQ2, RQ3, RQ4, RQ5, RQ6);
    v_echeance := to_char((least(b_echeance, (select clos_le + interval '3 years' from registre_qualite where id = RQ3))
                           at time zone 'Europe/Paris')::date, 'YYYY-MM-DD');
    set local role authenticated;
    perform pg_temp.qui('FO');
    j := pg_temp.etat() -> 'registre';
    reset role;
    perform pg_temp.cas('etat_conservation, registre avant : 2 entrées à effacer, 2 jamais closes, 1 déjà vidée, prochaine échéance de RQ3 (plus les autres entrées)',
      j = jsonb_build_object('a_effacer', 2 + b_eff, 'a_clore', 2 + b_clore, 'efface', 1 + b_efface,
            'prochaine_echeance', v_echeance)
      and (j ->> 'prochaine_echeance')::date > (now() at time zone 'Europe/Paris')::date,
      j::text || ' / autres : ' || b_eff || ',' || b_clore || ',' || b_efface || ',' || coalesce(b_echeance::text, 'aucune'));
    -- Refus : ni le formateur administrateur, ni un stagiaire, ni un visiteur ne vident le registre ni ne laissent de ligne.
    foreach t in array array['FORM', 'E1'] loop
      set local role authenticated;
      perform pg_temp.qui(t);
      r := pg_temp.tente('select public.effacer_registre_qualite()::text');
      reset role;
      perform pg_temp.cas('registre : effacement refusé à ' || t, r like 'P0001 registre: %', r);
    end loop;
    set local role anon;
    perform pg_temp.qui(null);
    r := pg_temp.tente('select public.effacer_registre_qualite()::text');
    reset role;
    perform pg_temp.cas('registre : effacement refusé à anon (aucun droit d''appel)', r like '42501%', r);
    perform pg_temp.cas('registre : les refus n''ont rien vidé ni écrit au journal',
      (select count(*) from effacements_journal where id > v_journal0 and type = 'registre') = 0
      and (select count(*) from registre_qualite where id in (RQ1, RQ2, RQ3, RQ4, RQ5, RQ6) and efface_le is not null) = 1
      and (select count(*) from registre_qualite where id not in (RQ1, RQ2, RQ3, RQ4, RQ5, RQ6) and efface_le is not null) = b_efface, null);
    -- Droits et signature : comme au lot Q4.
    perform pg_temp.cas('effacer_registre_qualite() : security definer, entier, authenticated seul (ni anon ni public)',
      (select p.prosecdef and pg_get_function_result(p.oid) = 'integer' from pg_proc p
        where p.oid = to_regprocedure('public.effacer_registre_qualite()'))
      and has_function_privilege('authenticated', 'public.effacer_registre_qualite()', 'execute')
      and not has_function_privilege('anon', 'public.effacer_registre_qualite()', 'execute')
      and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                       where p.oid = to_regprocedure('public.effacer_registre_qualite()') and a.grantee = 0), null);
    -- Premier effacement : les deux entrées dues, rien d'autre (plus les autres entrées dues, b_eff : 0 en temps normal).
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente('select public.effacer_registre_qualite()::text');
    reset role;
    perform pg_temp.cas('registre : le fondateur vide 2 entrées dues (RQ1 et RQ2)', r = 'ok ' || (2 + b_eff), r);
    select string_agg(id || ':' || (description is null)::text || (reponse is null)::text || (action_decidee is null)::text
                       || (mesure_prevention is null)::text || (efface_le is not null)::text, ',' order by id) into t
      from registre_qualite where id in (RQ1, RQ2, RQ3, RQ4, RQ5);
    perform pg_temp.cas('registre : les quatre textes de RQ1 et RQ2 sont vidés ; RQ3 (pas due), RQ4 et RQ5 (jamais closes) gardent les leurs',
      t = RQ1 || ':truetruetruetruetrue,' || RQ2 || ':truetruetruetruetrue,' || RQ3 || ':falsetruetruetruefalse,'
          || RQ4 || ':falsetruetruetruefalse,' || RQ5 || ':falsetruetruetruefalse', t);
    select string_agg(type || '|' || cible || '|' || fait_par_email || '|' || details::text, ' ; ') into t
      from effacements_journal where id > v_journal0 and type = 'registre';
    perform pg_temp.cas('journal : une seule ligne « registre », cible « registre », auteur le fondateur, {"entrees": 2}, aucun texte',
      t = 'registre|registre|preuve.cons.fo@example.invalid|{"entrees": ' || (2 + b_eff) || '}', t);
    -- Second appel : sans effet, sans ligne de plus.
    set local role authenticated;
    perform pg_temp.qui('FO');
    r := pg_temp.tente('select public.effacer_registre_qualite()::text');
    j := pg_temp.etat() -> 'registre';
    reset role;
    perform pg_temp.cas('registre : un second appel ne vide rien et n''écrit rien au journal',
      r = 'ok 0' and (select count(*) from effacements_journal where id > v_journal0 and type = 'registre') = 1, r);
    perform pg_temp.cas('etat_conservation, registre après : rien à effacer, 3 entrées vidées, 2 jamais closes (plus les autres entrées)',
      (j ->> 'a_effacer')::int = 0 and (j ->> 'efface')::int = 3 + b_efface + b_eff and (j ->> 'a_clore')::int = 2 + b_clore,
      j::text || ' / autres : ' || b_eff || ',' || b_clore || ',' || b_efface);
    perform pg_temp.cas('registre : RQ3 à 30 jours de l''échéance n''est pas vidée, aucune ligne de plus au journal',
      (select description from registre_qualite where id = RQ3) = 'Preuve registre RQ3'
      and (select count(*) from effacements_journal where id > v_journal0 and type = 'registre') = 1, null);

    -- 4.10 Retour refusé après une étape.
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
  perform pg_temp.cas('les étapes ont été annulées (aucune ligne de ce lot au journal, aucun résultat figé, aucune clôture)',
    (select count(*) from effacements_journal where type in ('etape1', 'etape2', 'demande', 'questionnaires', 'registre')
        and fait_par_email like 'preuve.cons.%') = 0
    and pg_temp.lignes('questionnaire_clotures') + pg_temp.lignes('questionnaire_resultats_figes') = v_lignes, null);

  -- 5. Retour : la base revient à l'identique ---------------------------------------------------------------------
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
    -- _anonymiser_stagiaire revient dans la version de la navigation unique (fiche de suivi effacée seulement si la table
    -- existe, plus de themes.updated_by_email), avec ou sans fiches_suivi ; le reste est dans l'empreinte, mot pour mot.
    t := pg_get_functiondef(to_regprocedure('public._anonymiser_stagiaire(integer)'));
    perform pg_temp.cas('retour : _anonymiser_stagiaire dans la version de la navigation unique (fiches_suivi conditionnelle, sans themes.updated_by_email)',
      position('to_regclass(''public.fiches_suivi'')' in t) > 0 and t !~* 'update\s+(public\.)?themes\s+set'
      and position('delete from fiches_suivi where' in t) = 0, null);
    perform pg_temp.cas('retour : les deux versions à argument de la direction reviennent, avec leurs droits (authenticated oui ; anon et service_role non)',
      (select string_agg(f || ':' || case when to_regprocedure(f) is null then 'absente'
                                          else has_function_privilege('authenticated', f, 'execute')::text || has_function_privilege('anon', f, 'execute')::text
                                               || has_function_privilege('service_role', f, 'execute')::text end, ',' order by f)
         from unnest(array['public.anonymiser_promo(integer)', 'public.etat_anonymisation_promo(integer)']) f(f))
      = 'public.anonymiser_promo(integer):truefalsefalse,public.etat_anonymisation_promo(integer):truefalsefalse', null);
    execute v_empreinte into md5_apres;
    perform pg_temp.cas('retour : empreinte du schéma (droits compris) et des données identique à celle d''avant la migration',
      md5_apres = md5_avant, md5_avant || ' / ' || md5_apres);
    select count(*) into n from pg_proc where pronamespace = 'public'::regnamespace
       and proname in ('anonymiser_promo', 'anonymiser_stagiaire', 'etat_anonymisation_promo', '_anonymiser_stagiaire');
    select count(*) into m from pg_proc where pronamespace = 'public'::regnamespace
       and proname in ('etat_conservation', 'effacer_promo_etape1', 'effacer_promo_etape2', 'effacer_sur_demande',
                       '_effacer_etape1', '_effacer_etape2', 'clore_annee_formateurs', 'effacer_commentaires_formateurs',
                       'figer_questionnaire_formateurs', '_questionnaire_rebrasser', '_questionnaire_comptes',
                       '_questionnaire_effacer_commentaires', '_questionnaire_figer', '_questionnaire_clore',
                       '_questionnaire_clos');
    perform pg_temp.cas('retour : les six anciennes fonctions sont revenues (dont les deux à argument de la direction), les quinze de ce lot sont parties',
      n = 6 and m = 0, n || '/' || m);
    select string_agg(attname, ',' order by attname) into t from pg_attribute
     where attrelid = 'public.questionnaire_participations'::regclass and attnum > 0 and not attisdropped;
    perform pg_temp.cas('retour : participations à leur forme du lot Q3, tables des résultats figés et des clôtures retirées',
      t = 'annee,cle,lieu_id,promo_id,user_id' and to_regclass('public.questionnaire_resultats_figes') is null
      and to_regclass('public.questionnaire_clotures') is null, t);
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
