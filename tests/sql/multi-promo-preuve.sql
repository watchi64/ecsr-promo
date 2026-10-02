-- Preuve du cloisonnement multi-promo (spec E.1 et E.2). Rejouable à volonté : le bloc
-- final lève TOUJOURS une exception, qui annule les données de test et porte le verdict.
-- Personnages réels choisis par requête : aucun email n'est écrit ici (dépôt public).
-- Si la table temporaire « photo » existe (répétition de l'étape 2), la non-régression de
-- mars est comparée à elle, avant toute donnée de test.

create temp table if not exists preuve (libelle text, ok boolean, detail text);
truncate preuve;

create or replace function pg_temp.verifier(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into preuve values (p_libelle, coalesce(p_ok, false), coalesce(p_detail, ''));
$f$;

create or replace function pg_temp.incarner(p_email text, p_entete text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then ''
         else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_entete is null then ''
         else json_build_object('x-promo-id', p_entete)::text end, true);
  if p_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

create or replace function pg_temp.compter(p_email text, p_entete text, p_sql text)
returns bigint language plpgsql as $f$
declare n bigint;
begin
  perform pg_temp.incarner(p_email, p_entete);
  begin
    execute p_sql into n;
  exception
    when insufficient_privilege then n := 0;
    when others then n := -1;
  end;
  reset role;
  return n;
end $f$;

-- Valeur scalaire lue par un personnage (en texte), ou « ERREUR <code> ».
create or replace function pg_temp.valeur(p_email text, p_entete text, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  perform pg_temp.incarner(p_email, p_entete);
  begin
    execute p_sql into v;
  exception when others then
    v := 'ERREUR ' || sqlstate;
  end;
  reset role;
  return v;
end $f$;

-- Écriture tentée par un personnage, TOUJOURS annulée. Rend « OK <lignes> <valeur
-- renvoyée> » ou « REFUS <code> ». p_sql se termine par RETURNING.
create or replace function pg_temp.ecrire(p_email text, p_entete text, p_sql text)
returns text language plpgsql as $f$
declare v text; n bigint;
begin
  begin
    perform pg_temp.incarner(p_email, p_entete);
    execute p_sql into v;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0001', message = 'OK ' || n || ' ' || coalesce(v, 'nul');
  exception when others then
    if sqlerrm like 'OK %' then return sqlerrm; end if;
    return 'REFUS ' || sqlstate;
  end;
end $f$;

-- Nombre de lignes qu'un personnage DOIT voir, calculé sans les règles d'accès.
create or replace function pg_temp.attendu(p_table text, p_email text, p_promo integer)
returns bigint language plpgsql as $f$
declare
  v_admin boolean := false; v_prof boolean := false; v_sid integer; v_lieu integer; n bigint;
begin
  if p_email is null then return 0; end if;
  select coalesce(up.is_admin, false), coalesce(up.role = 'prof', false),
         (select s.id from public.stagiaires s where s.id = up.stagiaire_id and s.promo_id = p_promo)
    into v_admin, v_prof, v_sid
    from public.user_profiles up where lower(up.email) = lower(p_email);
  if p_table = 'user_profiles' then
    select count(*) into n from public.user_profiles up
     where lower(up.email) = lower(p_email) or up.stagiaire_id is null
        or up.stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = p_promo);
    return n;
  end if;
  if p_promo is null then return 0; end if;
  select pr.lieu_id into v_lieu from public.promos pr where pr.id = p_promo;
  if p_table = 'qcm_attempts' then
    select count(*) into n from public.qcm_attempts
     where promo_id = p_promo and (v_admin or stagiaire_id = v_sid);
  elsif p_table in ('epcf_evaluations', 'epcf_livrets', 'dp_dossiers') then
    execute format('select count(*) from public.%I where promo_id = $1 and ($2 or $3 or stagiaire_id = $4)', p_table)
      into n using p_promo, v_admin, v_prof, v_sid;
  elsif p_table in ('benevoles', 'auto_ecoles', 'benevole_suivi') then
    if v_admin then
      execute format('select count(*) from public.%I where lieu_id = $1', p_table) into n using v_lieu;
    else
      n := 0;
    end if;
  else
    execute format('select count(*) from public.%I where promo_id = $1', p_table) into n using p_promo;
  end if;
  return n;
end $f$;

do $preuve$
declare
  v_stag1 text; v_form text; v_fond text; v_stag2 text;
  v_fictif text := 'preuve.fictif@example.invalid';
  v_sid1 integer; v_sid_fond integer; v_sid_fictif integer; v_mtp integer;
  v_theme integer; v_qcm bigint; v_ae_mtp integer; v_ae_nimes integer; v_bnv_mtp integer;
  v_p record; v_t text; v_vu bigint; v_att bigint; v_hors bigint; v_n bigint; v_lieu integer;
  v_txt text; v_contexte text; v_total integer; v_ko integer; v_liste text;
  tables_promo text[] := array['stagiaires','evaluations','evaluations_audit','passages',
    'passages_audit','planning_entries','planning_half_meta','planning_jours_off','agenda_events',
    'settings','qcm_attempts','epcf_evaluations','epcf_livrets','dp_dossiers','fiches_suivi',
    'themes_progression','qcm_examens'];
  tables_lieu text[] := array['benevoles','auto_ecoles','benevole_suivi'];
begin
  -- Personnages réels
  select up.email, s.id into v_stag1, v_sid1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif and s.promo_id = 1
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email, stagiaire_id into v_fond, v_sid_fond from user_profiles where is_founder order by email limit 1;
  select up.email into v_stag2 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and s.promo_id = 2 order by s.id limit 1;
  perform pg_temp.verifier('personnages réels trouvés',
    v_stag1 is not null and v_form is not null and v_fond is not null);

  -- A. Non-régression de mars, si la photo « avant » est là (répétition de l'étape 2)
  if to_regclass('pg_temp.photo') is not null then
    for v_p in select ph.personnage, ph.table_nom, ph.n from photo ph order by 1, 2 loop
      v_txt := case v_p.personnage when 'stagiaire de mars' then v_stag1
                                   when 'formateur' then v_form else v_fond end;
      v_att := v_p.n - case when v_p.table_nom = 'settings'
                            then (select count(*) from settings where promo_id is null) else 0 end;
      v_vu := pg_temp.compter(v_txt, null, format('select count(*) from public.%I', v_p.table_nom));
      v_n := pg_temp.compter(v_txt, '1', format('select count(*) from public.%I', v_p.table_nom));
      perform pg_temp.verifier(format('non-régression : %s, %s', v_p.personnage, v_p.table_nom),
        v_vu = v_att and v_n = v_att,
        format('avant %s, après %s sans en-tête et %s en-tête 1', v_p.n, v_vu, v_n));
    end loop;
  end if;

  -- B. Données de test (annulées par la levée finale)
  insert into promos (lieu_id, nom, date_debut) values (2, 'Preuve, Montpellier', current_date)
    returning id into v_mtp;
  insert into stagiaires (prenom, nom, ordre, promo_id) values ('PreuveFictif', 'PREUVE', 999, 2)
    returning id into v_sid_fictif;
  insert into user_profiles (email, role, stagiaire_id) values (v_fictif, 'stagiaire', v_sid_fictif);
  select id into v_theme from themes order by id limit 1;
  select id into v_qcm from qcm order by id limit 1;
  select id into v_ae_nimes from auto_ecoles where lieu_id = 1 order by id limit 1;
  insert into planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, lane, activite)
    values (2, '2030-01-07', 0, 'matin', 0, 0, 'Cours');
  insert into planning_half_meta (promo_id, semaine_lundi, day_index, half_day, start_time, end_time)
    values (2, '2030-01-07', 0, 'matin', '08:30', '12:00');
  insert into planning_jours_off (promo_id, semaine_lundi, day_index, label) values (2, '2030-01-07', 4, 'Preuve');
  insert into agenda_events (promo_id, date_start, title) values (2, '2030-01-07', 'Preuve');
  insert into settings (promo_id, key, value) values (2, 'preuve_cle', 'x');
  insert into evaluations (stagiaire_id, type, theme_numero, note) values (v_sid_fictif, 'Thème', 1, 12);
  insert into passages (date, stagiaire_id, type, resultat) values ('2030-01-07', v_sid_fictif, 'Salle', 'Effectué');
  insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20)
    values (v_qcm, v_sid_fictif, 'entrainement', 1, 2, 10);
  insert into epcf_evaluations (stagiaire_id, trame) values (v_sid_fictif, 'salle');
  insert into epcf_livrets (stagiaire_id) values (v_sid_fictif);
  insert into dp_dossiers (stagiaire_id) values (v_sid_fictif);
  insert into fiches_suivi (stagiaire_id) values (v_sid_fictif);
  insert into themes_progression (promo_id, theme_id, statut) values (2, v_theme, 'Fait');
  insert into qcm_examens (promo_id, qcm_id) values (2, v_qcm);
  insert into auto_ecoles (nom, lieu_id) values ('Preuve AE Montpellier', 2) returning id into v_ae_mtp;
  insert into benevoles (prenom, lieu_id, auto_ecole_id) values ('PreuveBenevole', 2, v_ae_mtp)
    returning id into v_bnv_mtp;
  insert into benevole_suivi (benevole_id, semaine_lundi, day_index, half_day)
    values (v_bnv_mtp, '2030-01-07', 0, 'matin');

  -- C. Matrice : chaque personnage, chaque contexte, chaque table
  create temp table if not exists personas (nom text, email text, entete text, promo integer);
  truncate personas;
  insert into personas values
    ('stagiaire de mars', v_stag1, null, 1), ('stagiaire de mars', v_stag1, '1', 1),
    ('stagiaire de mars', v_stag1, '2', null), ('stagiaire de mars', v_stag1, v_mtp::text, null),
    ('stagiaire de mars', v_stag1, 'abc', null),
    ('formateur', v_form, null, 1), ('formateur', v_form, '1', 1), ('formateur', v_form, '2', 2),
    ('formateur', v_form, v_mtp::text, v_mtp), ('formateur', v_form, 'abc', null),
    ('fondateur', v_fond, null, 1), ('fondateur', v_fond, '1', 1), ('fondateur', v_fond, '2', 2),
    ('fondateur', v_fond, v_mtp::text, v_mtp), ('fondateur', v_fond, 'abc', null),
    ('stagiaire fictif de septembre', v_fictif, null, 2), ('stagiaire fictif de septembre', v_fictif, '1', null),
    ('stagiaire fictif de septembre', v_fictif, '2', 2),
    ('stagiaire fictif de septembre', v_fictif, v_mtp::text, null),
    ('visiteur', null, null, null), ('visiteur', null, '1', null), ('visiteur', null, '2', null);
  if v_stag2 is not null then
    insert into personas values ('vrai stagiaire de septembre', v_stag2, null, 2),
      ('vrai stagiaire de septembre', v_stag2, '1', null), ('vrai stagiaire de septembre', v_stag2, '2', 2);
  end if;

  for v_p in select * from personas loop
    v_contexte := format('%s [%s]', v_p.nom, coalesce(v_p.entete, 'sans en-tête'));
    foreach v_t in array tables_promo loop
      v_vu := pg_temp.compter(v_p.email, v_p.entete, format('select count(*) from public.%I', v_t));
      v_att := pg_temp.attendu(v_t, v_p.email, v_p.promo);
      v_hors := pg_temp.compter(v_p.email, v_p.entete,
        format('select count(*) from public.%I where promo_id is distinct from %s', v_t,
               coalesce(v_p.promo::text, 'null')));
      perform pg_temp.verifier(format('%s %s : voit ce qu''il doit', v_contexte, v_t),
        v_vu = v_att, format('vu %s, attendu %s', v_vu, v_att));
      perform pg_temp.verifier(format('%s %s : rien d''une autre promo', v_contexte, v_t),
        v_hors = 0, format('%s ligne(s) hors promo', v_hors));
    end loop;
    v_lieu := null;
    select lieu_id into v_lieu from promos where id = v_p.promo;
    foreach v_t in array tables_lieu loop
      v_vu := pg_temp.compter(v_p.email, v_p.entete, format('select count(*) from public.%I', v_t));
      v_att := pg_temp.attendu(v_t, v_p.email, v_p.promo);
      v_hors := pg_temp.compter(v_p.email, v_p.entete,
        format('select count(*) from public.%I where lieu_id is distinct from %s', v_t,
               coalesce(v_lieu::text, 'null')));
      perform pg_temp.verifier(format('%s %s : voit sa banque', v_contexte, v_t),
        v_vu = v_att, format('vu %s, attendu %s', v_vu, v_att));
      perform pg_temp.verifier(format('%s %s : rien d''un autre lieu', v_contexte, v_t),
        v_hors = 0, format('%s ligne(s) hors lieu', v_hors));
    end loop;
    v_vu := pg_temp.compter(v_p.email, v_p.entete, 'select count(*) from public.user_profiles');
    v_att := pg_temp.attendu('user_profiles', v_p.email, v_p.promo);
    perform pg_temp.verifier(format('%s : comptes visibles', v_contexte), v_vu = v_att,
      format('vu %s, attendu %s', v_vu, v_att));
  end loop;

  -- D. Promos et lieux visibles (indépendants de l'en-tête)
  perform pg_temp.verifier('stagiaire de mars : voit sa seule promo',
    pg_temp.compter(v_stag1, null, 'select count(*) from public.promos') = 1);
  perform pg_temp.verifier('stagiaire fictif : voit septembre et rien d''autre',
    pg_temp.compter(v_fictif, null, 'select count(*) from public.promos') = 1
    and pg_temp.compter(v_fictif, null, 'select count(*) from public.promos where id = 2') = 1);
  perform pg_temp.verifier('formateur : voit toutes les promos',
    pg_temp.compter(v_form, null, 'select count(*) from public.promos') = (select count(*) from promos));
  perform pg_temp.verifier('formateur : voit les lieux qui ont une promo',
    pg_temp.compter(v_form, null, 'select count(*) from public.lieux') = (select count(distinct lieu_id) from promos));
  perform pg_temp.verifier('stagiaire de mars : voit Nîmes seulement',
    pg_temp.compter(v_stag1, null, 'select count(*) from public.lieux') = 1);
  perform pg_temp.verifier('visiteur : aucune promo',
    pg_temp.compter(null, null, 'select count(*) from public.promos') = 0);

  -- E. Emails d'une promo à l'autre
  perform pg_temp.verifier('le stagiaire fictif ne voit pas les comptes de mars',
    pg_temp.compter(v_fictif, '2', format('select count(*) from public.user_profiles where stagiaire_id = %s', v_sid1)) = 0);
  perform pg_temp.verifier('un stagiaire de mars ne voit pas les comptes de septembre',
    pg_temp.compter(v_stag1, null, format('select count(*) from public.user_profiles where lower(email) = %L', v_fictif)) = 0);

  -- F. Fonctions serveur
  perform pg_temp.verifier('fondateur en mars : sa fiche',
    pg_temp.valeur(v_fond, '1', 'select my_stagiaire_id()::text') = v_sid_fond::text);
  perform pg_temp.verifier('fondateur en septembre : aucune fiche',
    pg_temp.valeur(v_fond, '2', 'select my_stagiaire_id()::text') is null);
  perform pg_temp.verifier('stagiaire fictif : sa fiche',
    pg_temp.valeur(v_fictif, null, 'select my_stagiaire_id()::text') = v_sid_fictif::text);
  perform pg_temp.verifier('mes_promos du fondateur : toutes, mars par défaut',
    pg_temp.valeur(v_fond, null, 'select count(*)::text from mes_promos()') = (select count(*)::text from promos)
    and pg_temp.valeur(v_fond, null, 'select id::text from mes_promos() where par_defaut') = '1');
  perform pg_temp.verifier('mes_promos du stagiaire fictif : septembre seul',
    pg_temp.valeur(v_fictif, null, 'select string_agg(id::text, '','') from mes_promos()') = '2');
  perform pg_temp.verifier('noms des bénévoles depuis septembre : banque de Nîmes',
    pg_temp.valeur(v_fictif, '2', 'select count(*)::text from benevoles_noms()')
      = (select count(*)::text from benevoles where lieu_id = 1));
  perform pg_temp.verifier('noms des bénévoles depuis la promo de Montpellier : banque de Montpellier',
    pg_temp.valeur(v_form, v_mtp::text, 'select count(*)::text from benevoles_noms()') = '1');
  perform pg_temp.verifier('venues : rien pour un stagiaire',
    pg_temp.valeur(v_stag1, null, 'select count(*)::text from venues_benevoles()') = '0');
  perform pg_temp.verifier('venues : promos du lieu courant pour un formateur',
    pg_temp.valeur(v_form, '1', 'select count(*)::text from venues_benevoles()')
      = (select count(*)::text from planning_entries pe join promos pr on pr.id = pe.promo_id
          where pr.lieu_id = 1 and pe.benevoles_ids <> '{}'));
  perform pg_temp.verifier('moyennes EPCF : septembre ne compte que septembre',
    pg_temp.valeur(v_form, '2', 'select count(*)::text from epcf_moyennes(''salle'')') = '0');
  perform pg_temp.verifier('date de naissance : refusée hors de la promo affichée',
    pg_temp.valeur(v_form, '2', format(
      'select set_date_naissance(%s, (select date_naissance from public.stagiaires where id = %s))::text',
      v_sid1, v_sid1)) like 'ERREUR%');

  -- G. Examens propres à chaque promo
  update qcm_examens set published = true, exam_ferme_a = null where promo_id = 1 and qcm_id = v_qcm;
  perform pg_temp.verifier('examen ouvert en mars : démarrable pour mars',
    pg_temp.valeur(v_stag1, null, format('select qcm_exam_demarrable(%s)::text', v_qcm)) = 'true');
  perform pg_temp.verifier('examen ouvert en mars : fermé pour septembre',
    pg_temp.valeur(v_fictif, '2', format('select qcm_exam_demarrable(%s)::text', v_qcm)) = 'false');
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, '
    || 'score, total, note_20) values (%s, %s, ''examen'', 1, 2, 10) returning promo_id::text', v_qcm, v_sid_fictif));
  perform pg_temp.verifier('septembre ne passe pas un examen ouvert seulement en mars', v_txt like 'REFUS%', v_txt);
  update qcm_examens set published = true where promo_id = 2 and qcm_id = v_qcm;
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, '
    || 'score, total, note_20) values (%s, %s, ''examen'', 1, 2, 10) returning promo_id::text', v_qcm, v_sid_fictif));
  perform pg_temp.verifier('septembre passe son examen une fois ouvert pour septembre', v_txt = 'OK 1 2', v_txt);

  -- H. Écritures (toutes annulées)
  v_txt := pg_temp.ecrire(v_fictif, '2', 'insert into public.planning_entries (semaine_lundi, day_index, '
    || 'half_day, slot, lane, activite) values (''2030-01-14'', 0, ''matin'', 0, 0, ''Cours'') returning promo_id::text');
  perform pg_temp.verifier('un stagiaire ne crée pas de carte de planning', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.planning_entries (semaine_lundi, day_index, '
    || 'half_day, slot, lane, activite) values (''2030-01-14'', 0, ''matin'', 0, 0, ''Cours'') returning promo_id::text');
  perform pg_temp.verifier('formateur en septembre : la carte va en septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', 'insert into public.planning_entries (promo_id, semaine_lundi, day_index, '
    || 'half_day, slot, lane, activite) values (2, ''2030-01-14'', 1, ''matin'', 0, 0, ''Cours'') returning promo_id::text');
  perform pg_temp.verifier('formateur en mars : pas d''écriture forcée en septembre', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'update public.planning_entries set notes = notes where promo_id = 1 returning id::text');
  perform pg_temp.verifier('formateur en septembre : les cartes de mars sont hors d''atteinte', v_txt = 'OK 0 nul', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, format('insert into public.passages (date, stagiaire_id, type, resultat) '
    || 'values (current_date, %s, ''Salle'', ''Effectué'') returning promo_id::text', v_sid1));
  perform pg_temp.verifier('stagiaire de mars : ajoute son passage, en mars', v_txt = 'OK 1 1', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, format('insert into public.passages (date, stagiaire_id, type, resultat) '
    || 'values (current_date, %s, ''Salle'', ''Effectué'') returning promo_id::text', v_sid_fictif));
  perform pg_temp.verifier('stagiaire de mars : pas de passage pour un stagiaire de septembre', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.passages (date, stagiaire_id, type, resultat) '
    || 'values (current_date, %s, ''Salle'', ''Effectué'') returning promo_id::text', v_sid_fictif));
  perform pg_temp.verifier('stagiaire fictif : ajoute son passage, en septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('insert into public.evaluations (stagiaire_id, type, theme_numero, note) '
    || 'values (%s, ''Thème'', 1, 10) returning promo_id::text', v_sid1));
  perform pg_temp.verifier('formateur en septembre : pas de note pour un stagiaire de mars', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', format('insert into public.evaluations (stagiaire_id, type, theme_numero, note) '
    || 'values (%s, ''Thème'', 1, 10) returning promo_id::text', v_sid1));
  perform pg_temp.verifier('formateur en mars : note en mars', v_txt = 'OK 1 1', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.settings (key, value) values (''preuve_cle'', ''y'') '
    || 'on conflict (promo_id, key) do update set value = excluded.value returning promo_id::text');
  perform pg_temp.verifier('formateur en septembre : réglage de septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, 'update public.settings set value = value returning key');
  perform pg_temp.verifier('stagiaire : aucun réglage modifiable', v_txt = 'OK 0 nul' or v_txt like 'REFUS%', v_txt);
  -- Clé « modules » du chantier B : un formateur la règle pour la promo affichée, un stagiaire
  -- jamais. Avant la bascule, la clé primaire porte encore sur « key » : si mars a déjà sa clé
  -- « modules », l'écriture pour septembre attend la bascule (Tâche 16).
  if exists (select 1 from settings where key = 'modules' and promo_id = 1)
     and exists (select 1 from pg_constraint where conrelid = 'public.settings'::regclass
                  and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (key)') then
    perform pg_temp.verifier('modules (chantier B) : écriture par promo, à rejouer après la bascule', true,
      'clé primaire encore sur key');
  else
    v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.settings (key, value) values (''modules'', ''{}'') '
      || 'on conflict (promo_id, key) do update set value = excluded.value returning promo_id::text');
    perform pg_temp.verifier('modules (chantier B) : un formateur règle la promo affichée', v_txt = 'OK 1 2', v_txt);
  end if;
  v_txt := pg_temp.ecrire(v_fictif, '2', 'insert into public.settings (key, value) values (''modules'', ''{}'') '
    || 'on conflict (promo_id, key) do update set value = excluded.value returning promo_id::text');
  perform pg_temp.verifier('modules (chantier B) : un stagiaire ne règle rien', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.benevoles (prenom) values (''PreuveB'') returning lieu_id::text');
  perform pg_temp.verifier('bénévole créé depuis septembre : banque de Nîmes', v_txt = 'OK 1 1', v_txt);
  v_txt := pg_temp.ecrire(v_form, v_mtp::text, 'insert into public.benevoles (prenom) values (''PreuveB'') returning lieu_id::text');
  perform pg_temp.verifier('bénévole créé depuis Montpellier : banque de Montpellier', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, v_mtp::text, format('insert into public.benevoles (prenom, auto_ecole_id) '
    || 'values (''PreuveB'', %s) returning lieu_id::text', v_ae_nimes));
  perform pg_temp.verifier('pas d''affiliation à une auto-école d''un autre lieu', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', format('update public.benevoles set notes = notes where id = %s returning id::text', v_bnv_mtp));
  perform pg_temp.verifier('depuis Nîmes, la banque de Montpellier est hors d''atteinte', v_txt = 'OK 0 nul', v_txt);
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.themes_progression (theme_id, statut) values (%s, ''Fait'') '
    || 'on conflict (promo_id, theme_id) do update set statut = excluded.statut returning promo_id::text', v_theme));
  perform pg_temp.verifier('un stagiaire ne coche pas un thème', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('insert into public.themes_progression (theme_id, statut) values (%s, ''En cours'') '
    || 'on conflict (promo_id, theme_id) do update set statut = excluded.statut returning promo_id::text', v_theme));
  perform pg_temp.verifier('formateur en septembre : progression de septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'update public.promos set nom = nom where id = 2 returning id::text');
  perform pg_temp.verifier('formateur : renomme la promo', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'update public.promos set date_fin = date_fin where id = 2 returning id::text');
  perform pg_temp.verifier('formateur : ne touche que le nom de la promo', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.promos (lieu_id, nom, date_debut) values (1, ''X'', current_date) returning id::text');
  perform pg_temp.verifier('aucune promo créée depuis l''app', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, 'update public.promos set nom = nom where id = 1 returning id::text');
  perform pg_temp.verifier('stagiaire : ne renomme pas sa promo', v_txt = 'OK 0 nul' or v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('delete from public.stagiaires where id = %s returning id::text', v_sid1));
  perform pg_temp.verifier('formateur en septembre : les stagiaires de mars sont hors d''atteinte', v_txt = 'OK 0 nul', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('insert into public.user_profiles (email, role, stagiaire_id) '
    || 'values (''preuve.invite@example.invalid'', ''stagiaire'', %s) returning email', v_sid1));
  perform pg_temp.verifier('formateur en septembre : pas d''accès donné à un stagiaire de mars', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', format('insert into public.user_profiles (email, role, stagiaire_id) '
    || 'values (''preuve.invite@example.invalid'', ''stagiaire'', %s) returning email', v_sid1));
  perform pg_temp.verifier('formateur en mars : accès donné à un stagiaire de mars', v_txt like 'OK 1%', v_txt);

  -- I. Verdict (annule tout)
  select count(*), count(*) filter (where not ok) into v_total, v_ko from preuve;
  select string_agg('- ' || libelle || ' : ' || detail, E'\n') into v_liste
    from (select libelle, detail from preuve where not ok limit 60) x;
  raise exception E'VERDICT %\n% contrôles, % échec(s)%',
    case when v_ko = 0 then 'VERT' else 'ROUGE' end, v_total, v_ko, coalesce(E'\n' || v_liste, '');
end $preuve$;
