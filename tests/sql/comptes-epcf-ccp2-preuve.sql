-- Preuve de 20261124_epcf_ccp2_reseau : comptes_reseau() compte les EPCF du CCP2 à partir de 3 stagiaires évalués dans le centre, et
-- rien d'autre ne change.
-- Rejouable à volonté : le bloc lève TOUJOURS une exception à la fin, qui annule les données de test (et la migration injectée) et
-- porte le verdict (« VERT n/0 » ou « ROUGE n/k : ... »), suivi de l'empreinte md5 du corps de la fonction (retours chariot retirés).
-- Données fictives (adresses en example.invalid, centres et promos de preuve). Les centres réels sont seulement comptés par la
-- fonction elle-même, avant et après, et comparés ; aucune de leurs valeurs n'est affichée.
--
-- Assemblage : node outils/assembler_preuve_comptes_epcf.mjs <mode> <sortie.sql>
--   essai     la migration injectée : VERT attendu
--   retour    la migration puis son retour : ROUGE attendu sur F (cas à trois stagiaires) et P, l'empreinte est celle d'avant
--   contre    la migration dont le seuil est retiré : ROUGE attendu sur F (cas sous le seuil) et P (centre sous le seuil)
--   en-ligne  rien d'injecté : ROUGE avant application, VERT après
--
-- Contrôles :
--   F  la fixture commune (tests/fixtures/comptes-epcf-ccp2.json, jouée aussi par tests/comptes-reseau.test.mjs) : cas par cas, les
--      critères acquis et renseignés du centre ;
--   P  le seuil se juge sur le centre entier : deux promos en cours de 2 et 1 stagiaires évalués le passent ensemble ; une promo
--      terminée n'y compte pas ; le CCP2 d'un autre centre non plus ;
--   M  un centre de moins de 5 stagiaires en formation reste masqué, CCP2 compris ;
--   D  droits et forme : siège et fondateur seuls, les 19 colonnes dans l'ordre, droits d'exécution inchangés ;
--   N  non-régression : tous les centres déjà en base, avant et après ; seuls epcf_acquis et epcf_renseignes peuvent bouger, et
--      seulement dans un centre qui a des évaluations du CCP2.

set local lock_timeout = '3s';

-- Appelle p_sql (une valeur texte) sous un compte, ou rend le code du refus.
create or replace function pg_temp.appeler(p_email text, p_apercu text, p_sql text)
returns text language plpgsql as $appeler$
declare v text;
begin
  execute format('set local request.jwt.claims = %L',
    case when p_email is null then '' else json_build_object('email', p_email, 'role', 'authenticated')::text end);
  execute format('set local request.headers = %L',
    case when p_apercu is null then '{}' else json_build_object('x-apercu-role', p_apercu)::text end);
  if p_email is null then set local role anon; else set local role authenticated; end if;
  begin
    execute p_sql into v;
  exception when others then v := 'REFUS ' || sqlstate;
  end;
  reset role;
  return v;
end $appeler$;

do $preuve$
declare
  c_lire constant text := 'select coalesce(jsonb_object_agg(c.lieu_id::text, to_jsonb(c)), ''{}''::jsonb)::text from public.comptes_reseau() c';
  c_compter constant text := 'select ''OK '' || (count(*) > 0) from public.comptes_reseau()';
  c_colonnes constant text := 'lieu_id,lieu_nom,demonstration,promos_en_cours,masque,inscrits,en_formation,abandons,absences,prevus,'
    || 'qcm_bonnes,qcm_questions,examens_passes,examens_reussis,notes_n,notes_somme,notes_sous10,epcf_acquis,epcf_renseignes';
  c_fx constant jsonb :=
-- FIXTURE
  ;
  e_si text := 'preuve.comptes.siege@example.invalid';
  e_fo text := 'preuve.comptes.fondateur@example.invalid';
  e_di text := 'preuve.comptes.direction@example.invalid';
  e_fr text := 'preuve.comptes.formateur@example.invalid';
  e_st text := 'preuve.comptes.stagiaire@example.invalid';
  l_fx integer; l_deux integer; l_petit integer; l_autre integer;
  p_fx integer := 9971; p_d1 integer := 9972; p_d2 integer := 9973; p_finie integer := 9974; p_petit integer := 9975; p_autre integer := 9976;
  v_ids jsonb := '{}';                     -- numéro de la fixture -> identifiant de fiche
  v_avant jsonb; v_apres jsonb; v_l jsonb;
  v_id integer; v_cas jsonb; e jsonb; r record; v text; k text; i integer;
  v_md5 text; v_oid regprocedure;
  ok integer := 0; ko text[] := '{}';
begin
  -- Les comptes qui lisent, puis la photo des centres déjà en base, AVANT la migration.
  insert into user_profiles (email, role, is_admin) values (e_si, 'prof', false), (e_di, 'prof', false), (e_fr, 'prof', true);
  insert into user_profiles (email, role, is_admin, is_founder) values (e_fo, 'prof', true, true);
  insert into affectations (email, role) values (e_si, 'siege');
  v_avant := pg_temp.appeler(e_si, null, c_lire)::jsonb;

  -- MIGRATION

  v_oid := to_regprocedure('public.comptes_reseau()');
  select md5(replace(p.prosrc, E'\r', '')) into v_md5 from pg_proc p where p.oid = v_oid;
  v_apres := pg_temp.appeler(e_si, null, c_lire)::jsonb;

  -- N : non-régression ------------------------------------------------------------------------------------------
  for r in select key as lieu, value as avant from jsonb_each(v_avant) loop
    if (r.avant - 'epcf_acquis' - 'epcf_renseignes') = ((v_apres -> r.lieu) - 'epcf_acquis' - 'epcf_renseignes') then ok := ok + 1;
    else ko := ko || format('N centre %s : une colonne hors EPCF a changé', r.lieu); end if;
    if exists (select 1 from epcf_evaluations x join promos p on p.id = x.promo_id where p.lieu_id = r.lieu::integer and x.trame = 'ccp2') then
      ok := ok + 1;   -- le CCP2 y est commencé : ses EPCF peuvent bouger, la fixture dit comment
    elsif (r.avant -> 'epcf_acquis') is not distinct from (v_apres -> r.lieu -> 'epcf_acquis')
      and (r.avant -> 'epcf_renseignes') is not distinct from (v_apres -> r.lieu -> 'epcf_renseignes') then ok := ok + 1;
    else ko := ko || format('N centre %s : les EPCF ont changé sans évaluation du CCP2', r.lieu); end if;
  end loop;

  -- Centres et promos de preuve ---------------------------------------------------------------------------------
  insert into lieux (nom) values ('Preuve CCP2 fixture') returning id into l_fx;
  insert into lieux (nom) values ('Preuve CCP2 deux promos') returning id into l_deux;
  insert into lieux (nom) values ('Preuve CCP2 petit') returning id into l_petit;
  insert into lieux (nom) values ('Preuve CCP2 autre') returning id into l_autre;
  insert into promos (id, lieu_id, nom, date_debut, date_fin) values
    (p_fx, l_fx, 'Preuve CCP2 fixture', current_date - 60, null),
    (p_d1, l_deux, 'Preuve CCP2 une', current_date - 60, null), (p_d2, l_deux, 'Preuve CCP2 deux', current_date - 60, current_date),
    (p_finie, l_autre, 'Preuve CCP2 finie', current_date - 400, current_date - 100),
    (p_petit, l_petit, 'Preuve CCP2 petite', current_date - 60, null), (p_autre, l_autre, 'Preuve CCP2 autre', current_date - 60, null);
  for i in 1 .. 7 loop
    insert into stagiaires (prenom, nom, ordre, promo_id, actif)
      values ('PreuveF' || i, 'CCP2', 900 + i, p_fx, not (c_fx -> 'abandons' @> to_jsonb(i))) returning id into v_id;
    v_ids := v_ids || jsonb_build_object(i::text, v_id);
  end loop;
  insert into user_profiles (email, role, stagiaire_id) values (e_st, 'stagiaire', (v_ids ->> '1')::integer);
  insert into affectations (email, role, promo_id) values (e_fr, 'formateur', p_fx);
  insert into affectations (email, role, lieu_id) values (e_di, 'direction', l_fx);

  -- F : la fixture, cas par cas ---------------------------------------------------------------------------------
  for v_cas in select * from jsonb_array_elements(c_fx -> 'cas') loop
    delete from epcf_evaluations where promo_id = p_fx;
    for e in select * from jsonb_array_elements((c_fx -> 'ccp1') || (v_cas -> 'ccp2')) loop
      continue when e ->> 'date' is null;   -- la colonne est obligatoire : ce cas n'existe qu'au calcul de l'app
      insert into epcf_evaluations (stagiaire_id, trame, trame_version, contexte, auto_eval, date_eval, scores, promo_id)
      values ((v_ids ->> (e ->> 's'))::integer, coalesce(e ->> 'trame', 'ccp2'), 1, coalesce(e ->> 'contexte', 'EPCF'),
              coalesce((e ->> 'auto')::boolean, false), (e ->> 'date')::date, e -> 'scores', p_fx);
    end loop;
    v_l := (pg_temp.appeler(e_si, null, c_lire)::jsonb) -> l_fx::text;
    v := (v_l ->> 'epcf_acquis') || '/' || (v_l ->> 'epcf_renseignes');
    if v = (v_cas ->> 'acquis') || '/' || (v_cas ->> 'renseignes') then ok := ok + 1;
    else ko := ko || format('F %s : %s, attendu %s/%s', v_cas ->> 'nom', v, v_cas ->> 'acquis', v_cas ->> 'renseignes'); end if;
  end loop;

  -- P : le centre entier ----------------------------------------------------------------------------------------
  -- Centre « deux promos » : 3 + 3 fiches actives ; 2 évaluées dans la première promo (A, NA), 1 dans la seconde (A).
  -- Centre « autre » : 5 fiches actives, 2 évaluées ; sa promo finie en a 3 de plus, qui ne comptent pas.
  for r in select * from (values (p_d1, 3, 2, '{"DEM1":"A"}'), (p_d2, 3, 1, '{"DEM1":"A","DEM2":"R"}'), (p_autre, 5, 2, '{"DEM1":"A"}'),
                                 (p_finie, 5, 3, '{"DEM1":"A"}'), (p_petit, 4, 4, '{"DEM1":"A"}')) as t(promo, fiches, evalues, scores) loop
    for i in 1 .. r.fiches loop
      insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveP' || i, 'CCP2', 900 + i, r.promo, true) returning id into v_id;
      if i <= r.evalues then
        insert into epcf_evaluations (stagiaire_id, trame, trame_version, contexte, auto_eval, date_eval, scores, promo_id)
        values (v_id, 'ccp2', 1, 'EPCF', false, current_date - 1, r.scores::jsonb, r.promo);
      end if;
    end loop;
  end loop;
  v_apres := pg_temp.appeler(e_si, null, c_lire)::jsonb;
  v := (v_apres -> l_deux::text ->> 'epcf_acquis') || '/' || (v_apres -> l_deux::text ->> 'epcf_renseignes');
  if v = '3/4' then ok := ok + 1; else ko := ko || format('P deux promos (2 + 1 évalués) : %s, attendu 3/4', v); end if;
  v := (v_apres -> l_autre::text ->> 'epcf_acquis') || '/' || (v_apres -> l_autre::text ->> 'epcf_renseignes');
  if v = '0/0' then ok := ok + 1; else ko := ko || format('P centre sous le seuil (2 évalués, 3 autres dans une promo finie) : %s, attendu 0/0', v); end if;

  -- M : le masque -----------------------------------------------------------------------------------------------
  v_l := v_apres -> l_petit::text;
  if (v_l ->> 'masque')::boolean and v_l ->> 'epcf_acquis' is null and v_l ->> 'epcf_renseignes' is null and v_l ->> 'inscrits' is null then ok := ok + 1;
  else ko := ko || 'M centre de 4 stagiaires, tous évalués au CCP2 : pas masqué'::text; end if;

  -- D : droits et forme -----------------------------------------------------------------------------------------
  for r in select * from (values
    ('siège', e_si, null::text, 'OK true'), ('fondateur', e_fo, null, 'OK true'), ('fondateur en aperçu siège', e_fo, 'siege', 'OK true'),
    ('fondateur en aperçu direction', e_fo, 'direction', 'REFUS 42501'), ('direction', e_di, null, 'REFUS 42501'),
    ('direction qui envoie un aperçu siège', e_di, 'siege', 'REFUS 42501'), ('formateur', e_fr, null, 'REFUS 42501'),
    ('stagiaire', e_st, null, 'REFUS 42501'), ('sans compte', null, null, 'REFUS 42501')
  ) as t(nom, email, apercu, attendu) loop
    v := pg_temp.appeler(r.email, r.apercu, c_compter);
    if v = r.attendu then ok := ok + 1; else ko := ko || format('D %s : %s, attendu %s', r.nom, v, r.attendu); end if;
  end loop;
  select string_agg(u.n, ',' order by u.o) into v
    from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as u(n, m, o) where p.oid = v_oid and u.m = 't';
  if v = c_colonnes then ok := ok + 1; else ko := ko || format('D colonnes : %s', v); end if;
  v := concat_ws(',', has_function_privilege('authenticated', v_oid, 'execute'), has_function_privilege('anon', v_oid, 'execute'),
                 has_function_privilege('service_role', v_oid, 'execute'));
  if v = 't,f,f' then ok := ok + 1; else ko := ko || format('D droits d''exécution (authenticated, anon, service_role) : %s', v); end if;
  select concat_ws(',', p.prosecdef, p.provolatile, p.proconfig::text) into v from pg_proc p where p.oid = v_oid;
  if v = 't,s,{"search_path=public, pg_temp"}' then ok := ok + 1;
  else ko := ko || format('D fonction (definer, stable, search_path) : %s', v); end if;

  if cardinality(ko) = 0 then
    raise exception 'VERT %/0 (comptes_reseau md5 %)', ok, v_md5;
  else
    raise exception 'ROUGE %/% (comptes_reseau md5 %) : %', ok, cardinality(ko), v_md5, array_to_string(ko, ' ; ');
  end if;
end
$preuve$;
