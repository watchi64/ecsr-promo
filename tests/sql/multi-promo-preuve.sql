-- Preuve du cloisonnement multi-promo (spec E.1 et E.2). Rejouable à volonté : le bloc
-- final lève TOUJOURS une exception, qui annule les données de test et porte le verdict.
-- Personnages réels choisis par requête : aucun email réel n'est écrit ici (dépôt public).
-- Si la table temporaire « photo » existe (répétition de l'étape 2), la non-régression de
-- mars est comparée à elle, avant toute donnée de test.
--
-- Écritures. Dans la matrice, un refus attendu se tente sans RETURNING ni ON CONFLICT, et une
-- modification ou une suppression qui ne doit rien toucher hors de la portée se fait sans citer
-- aucune colonne (sur toute la table, valeur constante) : dès qu'une instruction lit une colonne,
-- PostgreSQL applique aussi la règle de LECTURE (doc CREATE POLICY, « Policies Applied by Command
-- Type »), qui masquerait une règle d'écriture ayant perdu sa condition de promo ou de lieu. Le
-- résultat se constate en propriétaire dans la même sous-transaction, puis tout est annulé. Hors
-- matrice, les upserts de réglages gardent la forme de l'app : ils contrôlent ce que l'app
-- obtient, la matrice contrôle la règle.

set local lock_timeout = '3s';

drop table if exists pg_temp.preuve;
create temp table preuve (num serial, groupe text, tbl text, controle text, contexte text,
  libelle text, etat text, detail text, temoin integer);

-- Contrôle hors matrice (fonctions, promos, examens, cas particuliers d'écriture).
create or replace function pg_temp.verifier(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into preuve (groupe, libelle, etat, detail)
  values ('hors matrice', p_libelle, case when coalesce(p_ok, false) then 'ok' else 'échec' end,
          coalesce(p_detail, ''));
$f$;

-- Contrôle d'un groupe nommé (non-régression, lecture, écriture, couverture). p_temoin : lignes
-- (ou écritures) qu'une règle privée de sa condition de promo ou de lieu laisserait passer.
create or replace function pg_temp.verifier_g(p_groupe text, p_tbl text, p_controle text,
  p_contexte text, p_ok boolean, p_detail text default '', p_temoin integer default null)
returns void language sql as $f$
  insert into preuve (groupe, tbl, controle, contexte, libelle, etat, detail, temoin)
  values (p_groupe, p_tbl, p_controle, p_contexte,
          concat_ws(' ', p_contexte, p_tbl) || ' : ' || p_controle,
          case when coalesce(p_ok, false) then 'ok' else 'échec' end, coalesce(p_detail, ''), p_temoin);
$f$;

-- Contrôle non joué : il figure au verdict et ne compte jamais comme réussi.
create or replace function pg_temp.reporter(p_groupe text, p_libelle text, p_detail text)
returns void language sql as $f$
  insert into preuve (groupe, libelle, etat, detail) values (p_groupe, p_libelle, 'reporté', p_detail);
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

-- Compte ce qu'un personnage voit. Un refus de droit ne vaut 0 que pour le visiteur (tables
-- qui lui sont fermées) ; toute autre erreur rend -1, qui ne correspond à aucune attente.
create or replace function pg_temp.compter(p_email text, p_entete text, p_sql text)
returns bigint language plpgsql as $f$
declare n bigint;
begin
  perform pg_temp.incarner(p_email, p_entete);
  begin
    execute p_sql into n;
  exception
    when insufficient_privilege then n := case when p_email is null then 0 else -1 end;
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

-- Écriture tentée par un personnage, TOUJOURS annulée (sous-transaction). Rend « OK <lignes> »
-- suivi, si p_constat est donné, de la valeur qu'il relit EN PROPRIÉTAIRE dans la même
-- sous-transaction (« absente » si rien), ou « REFUS <code> ».
create or replace function pg_temp.ecrire(p_email text, p_entete text, p_sql text,
  p_constat text default null)
returns text language plpgsql as $f$
declare n bigint; v text;
begin
  begin
    perform pg_temp.incarner(p_email, p_entete);
    execute p_sql;
    get diagnostics n = row_count;
    reset role;
    if p_constat is not null then
      execute p_constat into v;
      v := ' ' || coalesce(v, 'absente');
    end if;
    raise exception using errcode = 'P0001', message = 'OK ' || n || coalesce(v, '');
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'OK %' then return sqlerrm; end if;
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

-- Règles d'écriture de la spec (B.3, B.4), qui reprennent les conditions de rôle actuelles :
-- la ligne (promo, lieu, fiche stagiaire, ligne du personnel) peut-elle être écrite par ce
-- personnage dans ce contexte ? Opérations : ajout, modification, suppression. Avec
-- p_portee = false, la condition de promo ou de lieu est retirée : c'est ce que laisserait
-- passer une règle qui l'aurait perdue (témoin de discrimination des contrôles).
create or replace function pg_temp.permis(p_table text, p_op text, p_admin boolean, p_prof boolean,
  p_soi integer, p_promo integer, p_lieu integer, r_promo integer, r_lieu integer, r_fiche integer,
  r_personnel boolean, p_portee boolean)
returns boolean language plpgsql as $f$
declare
  dans_promo boolean := (not p_portee) or coalesce(r_promo = p_promo, false);
  dans_lieu boolean := (not p_portee) or coalesce(r_lieu = p_lieu, false);
  a_soi boolean := coalesce(r_fiche = p_soi, false);
begin
  return coalesce(case
    when p_table in ('stagiaires', 'evaluations', 'planning_entries', 'planning_half_meta',
                     'planning_jours_off', 'agenda_events', 'settings', 'themes_progression') then
      p_admin and dans_promo
    when p_table = 'passages' then
      dans_promo and (p_admin or (p_op in ('ajout', 'modification') and a_soi))
    when p_table = 'qcm_attempts' then
      dans_promo and (p_admin or (p_op = 'ajout' and a_soi))
    when p_table in ('epcf_evaluations', 'epcf_livrets') then
      dans_promo and (p_admin or p_prof)
    when p_table = 'dp_dossiers' then
      dans_promo and (p_admin or (p_op <> 'suppression' and (p_prof or a_soi)))
    when p_table = 'fiches_suivi' then
      dans_promo and (p_admin or (p_op <> 'suppression' and a_soi))
    when p_table = 'qcm_examens' then
      dans_promo and (p_admin or (p_op <> 'suppression' and p_prof))
    when p_table in ('benevoles', 'auto_ecoles', 'benevole_suivi') then
      p_admin and dans_lieu
    when p_table = 'user_profiles' then
      p_admin and (coalesce(r_personnel, false) or dans_promo)
    else false -- historiques et lieux : aucune écriture depuis l'app
  end, false);
end $f$;

do $preuve$
declare
  v_stag1 text; v_form text; v_fond text; v_stag2 text;
  v_fictif text := 'preuve.fictif@example.invalid';
  v_sid1 integer; v_sid_fond integer; v_sid_fictif integer; v_sid_fictif2 integer; v_sid_mars integer;
  v_mtp integer := 9999; v_vide integer := 9998; v_lieu_vide integer := 9999;
  v_theme_a integer := 2000000001; v_theme_b integer := 2000000002;
  v_qcm_a bigint := 2000000001; v_qcm_b bigint := 2000000002;
  v_ae_mtp integer; v_ae_nimes integer; v_bnv_mtp integer; v_bnv_nimes integer;
  v_defaut_form integer; v_defaut_fond integer; v_photo boolean := false;
  v_seq_lieux text; v_seq_promos text; v_cle_epcf text; v_global text;
  v_p record; v_c record; v_m record; v_t text; v_vu bigint; v_att bigint; v_hors bigint;
  v_n bigint; v_n2 bigint; v_lieu integer; v_txt text; v_att_txt text; v_contexte text; v_sql text;
  v_role text; v_admin boolean; v_prof boolean; v_staff boolean; v_soi integer; v_soi_promo integer;
  v_ctx integer; v_ctx_lieu integer; v_hors_promo integer; v_hors_lieu integer;
  v_sens text; v_op text; v_attendu text; v_obtenu text; v_cible_sid integer; v_cible_bnv integer;
  r_promo integer; r_lieu integer; r_fiche integer;
  v_priv boolean; v_permis boolean; v_permis_sans boolean; v_existe boolean;
  v_total integer; v_ok integer; v_ko integer; v_rep integer; v_groupes text; v_liste text;
  v_familles text; v_reportes text; v_message text;
  tables_promo text[] := array['stagiaires','evaluations','evaluations_audit','passages',
    'passages_audit','planning_entries','planning_half_meta','planning_jours_off','agenda_events',
    'settings','qcm_attempts','epcf_evaluations','epcf_livrets','dp_dossiers','fiches_suivi',
    'themes_progression','qcm_examens'];
  tables_lieu text[] := array['benevoles','auto_ecoles','benevole_suivi'];
begin
  -- Identités de lieux et promos, relues à la fin : la preuve ne doit en consommer aucune.
  select last_value || ',' || is_called into v_seq_lieux from public.lieux_id_seq;
  select last_value || ',' || is_called into v_seq_promos from public.promos_id_seq;

  -- Personnages réels
  select up.email, s.id into v_stag1, v_sid1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif and s.promo_id = 1
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email, stagiaire_id into v_fond, v_sid_fond from user_profiles where is_founder order by email limit 1;
  select up.email into v_stag2 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.promo_id = 2
   order by s.id limit 1;
  perform pg_temp.verifier('personnages réels trouvés',
    v_stag1 is not null and v_form is not null and v_fond is not null);
  -- Promo par défaut (spec A.2) : celle de la fiche pour un compte qui en a une ; pour le
  -- personnel, la plus ancienne promo en cours, mars jusqu'au 11/12/2026 inclus, septembre ensuite.
  v_defaut_form := case when current_date <= date '2026-12-11' then 1 else 2 end;
  v_defaut_fond := coalesce((select promo_id from stagiaires where id = v_sid_fond), v_defaut_form);

  -- A. Non-régression de mars, si la photo « avant » est là (répétition de l'étape 2)
  if to_regclass('pg_temp.photo') is not null then
    v_photo := true;
    for v_p in select ph.personnage, ph.table_nom, ph.n from photo ph order by 1, 2 loop
      v_txt := case v_p.personnage when 'stagiaire de mars' then v_stag1
                                   when 'formateur' then v_form else v_fond end;
      v_att := v_p.n - case when v_p.table_nom = 'settings'
                            then (select count(*) from settings where promo_id is null) else 0 end;
      v_vu := pg_temp.compter(v_txt, null, format('select count(*) from public.%I', v_p.table_nom));
      v_n := pg_temp.compter(v_txt, '1', format('select count(*) from public.%I', v_p.table_nom));
      perform pg_temp.verifier_g('non-régression', v_p.table_nom, 'mêmes lignes qu''avant l''étape 2',
        v_p.personnage, v_p.n >= 0 and v_vu = v_att and v_n = v_att,
        format('avant %s, après %s sans en-tête et %s en-tête 1', v_p.n, v_vu, v_n));
    end loop;
  else
    perform pg_temp.reporter('non-régression', 'non-régression de mars : non jouée',
      'photo absente : elle se joue dans le lot de répétition (photo, migration 2, preuve)');
  end if;

  -- B. Données de test (annulées par la levée finale). Identifiants explicites pour les lieux
  -- et les promos : une exécution annulée ne consomme aucun numéro de leurs identités.
  insert into lieux (id, nom) values (v_lieu_vide, 'Preuve, lieu vide');
  insert into promos (id, lieu_id, nom, date_debut) values
    (v_mtp, 2, 'Preuve, Montpellier', current_date),
    (v_vide, v_lieu_vide, 'Preuve, lieu vide', current_date);
  insert into stagiaires (prenom, nom, ordre, promo_id) values ('PreuveFictif', 'PREUVE', 999, 2)
    returning id into v_sid_fictif;
  insert into stagiaires (prenom, nom, ordre, promo_id) values ('PreuveFictifDeux', 'PREUVE', 998, 2)
    returning id into v_sid_fictif2;
  insert into stagiaires (prenom, nom, ordre, promo_id, date_naissance)
    values ('PreuveMars', 'PREUVE', 997, 1, '2000-01-01') returning id into v_sid_mars;
  insert into user_profiles (email, role, stagiaire_id) values (v_fictif, 'stagiaire', v_sid_fictif);
  -- Thèmes et QCM fictifs : aucun examen ni aucune progression réels ne sont touchés. A sert aux
  -- examens et à la progression de septembre, B aux écritures de la matrice.
  insert into themes (id, numero, titre, type, ordre) values
    (v_theme_a, 9999, 'Preuve, thème A', 'theme', 9999), (v_theme_b, null, 'Preuve, thème B', 'notion', 9999);
  insert into qcm (id, theme_id, titre) values
    (v_qcm_a, v_theme_a, 'Preuve, QCM A'), (v_qcm_b, v_theme_b, 'Preuve, QCM B');
  -- La synchro de bascule les a recopiés en mars ; B ne doit figurer dans aucune promo.
  delete from themes_progression where theme_id = v_theme_b;
  delete from qcm_examens where qcm_id = v_qcm_b;
  -- État voulu posé explicitement, par upsert (rejouable une fois septembre en service).
  insert into themes_progression (promo_id, theme_id, statut) values (2, v_theme_a, 'Fait')
    on conflict (promo_id, theme_id) do update set statut = excluded.statut;
  insert into qcm_examens (promo_id, qcm_id, published, exam_ferme_a) values (2, v_qcm_a, false, null)
    on conflict (promo_id, qcm_id) do update set published = excluded.published, exam_ferme_a = excluded.exam_ferme_a;
  update qcm_examens set published = false, exam_ferme_a = null where promo_id = 1 and qcm_id = v_qcm_a;
  -- Banques : une auto-école et un bénévole à Montpellier, une auto-école et un bénévole témoins
  -- à Nîmes (le suivi des venues de Nîmes est vide aujourd'hui).
  insert into auto_ecoles (nom, lieu_id) values ('Preuve AE Montpellier', 2) returning id into v_ae_mtp;
  insert into auto_ecoles (nom, lieu_id) values ('Preuve AE Nîmes', 1) returning id into v_ae_nimes;
  insert into benevoles (prenom, lieu_id, auto_ecole_id) values ('PreuveBenevole', 2, v_ae_mtp)
    returning id into v_bnv_mtp;
  insert into benevoles (prenom, lieu_id) values ('PreuveBenevoleNimes', 1) returning id into v_bnv_nimes;
  insert into benevole_suivi (benevole_id, semaine_lundi, day_index, half_day) values
    (v_bnv_mtp, '2030-01-07', 0, 'matin'), (v_bnv_nimes, '2030-01-07', 1, 'matin');
  -- Planning : une carte de septembre sans bénévole, une venue en septembre et une à
  -- Montpellier (créneaux distincts : l'ancienne unicité sans promo vit jusqu'à la bascule).
  insert into planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, lane, activite, benevoles_ids) values
    (2, '2030-01-07', 0, 'matin', 0, 0, 'Cours', '{}'),
    (2, '2030-01-14', 0, 'matin', 0, 0, 'Cours', array[v_bnv_nimes]),
    (v_mtp, '2030-01-21', 0, 'matin', 0, 0, 'Cours', array[v_bnv_mtp]);
  insert into planning_half_meta (promo_id, semaine_lundi, day_index, half_day, start_time, end_time)
    values (2, '2030-01-07', 0, 'matin', '08:30', '12:00');
  insert into planning_jours_off (promo_id, semaine_lundi, day_index, label) values (2, '2030-01-07', 4, 'Preuve');
  insert into agenda_events (promo_id, date_start, title) values (2, '2030-01-07', 'Preuve');
  insert into settings (promo_id, key, value) values (2, 'preuve_cle', 'x');
  insert into evaluations (stagiaire_id, type, theme_numero, note) values (v_sid_fictif, 'Thème', 1, 12);
  insert into passages (date, stagiaire_id, type, resultat) values ('2030-01-07', v_sid_fictif, 'Salle', 'Effectué');
  insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20)
    values (v_qcm_a, v_sid_fictif, 'entrainement', 1, 2, 10);
  -- EPCF de septembre noté : un critère commun avec mars (s'il en existe un) et un critère propre.
  select k into v_cle_epcf from epcf_evaluations e, jsonb_object_keys(e.scores) k
   where e.trame = 'salle' and e.contexte = 'EPCF' and not e.auto_eval and e.promo_id = 1
   order by k limit 1;
  insert into epcf_evaluations (stagiaire_id, trame, scores) values (v_sid_fictif, 'salle',
    jsonb_build_object('PREUVE1', 'A')
      || case when v_cle_epcf is null then '{}'::jsonb else jsonb_build_object(v_cle_epcf, 'NA') end);
  insert into epcf_livrets (stagiaire_id) values (v_sid_fictif);
  insert into dp_dossiers (stagiaire_id) values (v_sid_fictif);
  insert into fiches_suivi (stagiaire_id) values (v_sid_fictif);

  -- C. Matrice de lecture : chaque personnage, chaque contexte, chaque table
  drop table if exists pg_temp.personas;
  create temp table personas (ordre serial, nom text, email text, entete text, promo integer);
  insert into personas (nom, email, entete, promo) values
    ('stagiaire de mars', v_stag1, null, 1), ('stagiaire de mars', v_stag1, '1', 1),
    ('stagiaire de mars', v_stag1, '2', null), ('stagiaire de mars', v_stag1, v_mtp::text, null),
    ('stagiaire de mars', v_stag1, 'abc', null),
    ('formateur', v_form, null, v_defaut_form), ('formateur', v_form, '1', 1), ('formateur', v_form, '2', 2),
    ('formateur', v_form, v_mtp::text, v_mtp), ('formateur', v_form, v_vide::text, v_vide),
    ('formateur', v_form, 'abc', null), ('formateur', v_form, '99', null),
    ('fondateur', v_fond, null, v_defaut_fond), ('fondateur', v_fond, '1', 1), ('fondateur', v_fond, '2', 2),
    ('fondateur', v_fond, v_mtp::text, v_mtp), ('fondateur', v_fond, 'abc', null),
    ('stagiaire fictif de septembre', v_fictif, null, 2), ('stagiaire fictif de septembre', v_fictif, '1', null),
    ('stagiaire fictif de septembre', v_fictif, '2', 2),
    ('stagiaire fictif de septembre', v_fictif, v_mtp::text, null),
    ('visiteur', null, null, null), ('visiteur', null, '1', null), ('visiteur', null, '2', null);
  if v_stag2 is not null then
    insert into personas (nom, email, entete, promo) values ('vrai stagiaire de septembre', v_stag2, null, 2),
      ('vrai stagiaire de septembre', v_stag2, '1', null), ('vrai stagiaire de septembre', v_stag2, '2', 2);
  else
    perform pg_temp.reporter('hors matrice', 'vrai stagiaire de septembre : lectures et écritures non jouées',
      'aucun compte de stagiaire en promo 2 pour l''instant (à rejouer à la Tâche 17)');
  end if;

  for v_p in select * from personas order by ordre loop
    v_contexte := format('%s [%s]', v_p.nom, coalesce(v_p.entete, 'sans en-tête'));
    foreach v_t in array tables_promo loop
      v_vu := pg_temp.compter(v_p.email, v_p.entete, format('select count(*) from public.%I', v_t));
      v_att := pg_temp.attendu(v_t, v_p.email, v_p.promo);
      v_hors := pg_temp.compter(v_p.email, v_p.entete,
        format('select count(*) from public.%I where promo_id is distinct from %s', v_t,
               coalesce(v_p.promo::text, 'null')));
      perform pg_temp.verifier_g('lecture', v_t, 'voit ce qu''il doit', v_contexte,
        v_vu = v_att, format('vu %s, attendu %s', v_vu, v_att));
      perform pg_temp.verifier_g('lecture', v_t, 'rien d''une autre promo', v_contexte,
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
      perform pg_temp.verifier_g('lecture', v_t, 'voit sa banque', v_contexte,
        v_vu = v_att, format('vu %s, attendu %s', v_vu, v_att));
      perform pg_temp.verifier_g('lecture', v_t, 'rien d''un autre lieu', v_contexte,
        v_hors = 0, format('%s ligne(s) hors lieu', v_hors));
    end loop;
    v_vu := pg_temp.compter(v_p.email, v_p.entete, 'select count(*) from public.user_profiles');
    v_att := pg_temp.attendu('user_profiles', v_p.email, v_p.promo);
    perform pg_temp.verifier_g('lecture', 'user_profiles', 'comptes visibles', v_contexte,
      v_vu = v_att, format('vu %s, attendu %s', v_vu, v_att));
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
  perform pg_temp.verifier('stagiaire de mars, en-tête interdit : aucune fiche',
    pg_temp.valeur(v_stag1, '2', 'select my_stagiaire_id()::text') is null);
  v_sql := $q$select count(*)::text || ':' || coalesce(string_agg(id::text, ',') filter (where par_defaut), 'aucune') from mes_promos()$q$;
  v_txt := pg_temp.valeur(v_fond, null, v_sql);
  perform pg_temp.verifier('mes_promos du fondateur : toutes, la promo de sa fiche par défaut',
    v_txt = (select count(*) from promos) || ':' || v_defaut_fond, coalesce(v_txt, 'nul'));
  v_txt := pg_temp.valeur(v_form, null, v_sql);
  perform pg_temp.verifier('mes_promos du formateur : toutes, la plus ancienne promo en cours par défaut',
    v_txt = (select count(*) from promos) || ':' || v_defaut_form, coalesce(v_txt, 'nul'));
  perform pg_temp.verifier('mes_promos du stagiaire fictif : septembre seul',
    pg_temp.valeur(v_fictif, null, 'select string_agg(id::text, '','') from mes_promos()') = '2');

  -- Noms des bénévoles : la banque du lieu courant, comparée identifiant par identifiant.
  v_sql := $q$select coalesce(string_agg(id::text, ',' order by id), '') from benevoles_noms()$q$;
  select coalesce(string_agg(id::text, ',' order by id), ''), count(*) into v_att_txt, v_n from benevoles where lieu_id = 1;
  v_txt := pg_temp.valeur(v_fictif, '2', v_sql);
  perform pg_temp.verifier('noms des bénévoles depuis septembre : la banque de Nîmes, rien d''autre',
    v_txt = v_att_txt, format('%s nom(s) attendu(s), obtenu %s', v_n,
      case when v_txt = v_att_txt then 'la même liste' else coalesce(left(v_txt, 60), 'nul') end));
  select coalesce(string_agg(id::text, ',' order by id), ''), count(*) into v_att_txt, v_n from benevoles where lieu_id = 2;
  v_txt := pg_temp.valeur(v_form, v_mtp::text, v_sql);
  perform pg_temp.verifier('noms des bénévoles depuis la promo de Montpellier : la banque de Montpellier, rien d''autre',
    v_txt = v_att_txt, format('%s nom(s) attendu(s), obtenu %s', v_n,
      case when v_txt = v_att_txt then 'la même liste' else coalesce(left(v_txt, 60), 'nul') end));
  perform pg_temp.verifier('noms des bénévoles sans promo courante : aucun',
    pg_temp.valeur(v_stag1, 'abc', 'select count(*)::text from benevoles_noms()') = '0');

  -- Venues des bénévoles : toutes les promos du lieu courant, avec le nom de la promo,
  -- comparées ligne à ligne au calcul en propriétaire.
  v_sql := $q$select coalesce(string_agg(x, ';' order by x), '') from (select concat_ws('|', promo_id, promo_nom, semaine_lundi, day_index, half_day, sujet, eleves_ids::text, benevoles_ids::text) as x from venues_benevoles()) v$q$;
  foreach v_txt in array array['1', '2', v_mtp::text] loop
    v_lieu := (select lieu_id from promos where id = v_txt::integer);
    select coalesce(string_agg(x, ';' order by x), ''), count(*) into v_att_txt, v_n
      from (select concat_ws('|', pe.promo_id, pr.nom, pe.semaine_lundi, pe.day_index, pe.half_day, pe.sujet,
                             pe.eleves_ids::text, pe.benevoles_ids::text) as x
              from planning_entries pe join promos pr on pr.id = pe.promo_id
             where pr.lieu_id = v_lieu and pe.benevoles_ids <> '{}') v;
    v_obtenu := pg_temp.valeur(v_form, v_txt, v_sql);
    perform pg_temp.verifier(format('venues depuis la promo %s : les cartes à bénévoles de toutes les promos du lieu %s',
        v_txt, v_lieu),
      v_obtenu = v_att_txt,
      format('%s venue(s) attendue(s), obtenu %s', v_n,
        case when v_obtenu = v_att_txt then 'les mêmes'
             when v_obtenu is null or v_obtenu like 'ERREUR %' then coalesce(v_obtenu, 'nul')
             else coalesce(array_length(string_to_array(nullif(v_obtenu, ''), ';'), 1), 0) || ' venue(s), différentes' end));
    if v_txt = '1' then
      perform pg_temp.verifier('venues depuis mars : la venue de septembre y figure, avec le nom de sa promo',
        strpos(v_obtenu, concat_ws('|', 2, (select nom from promos where id = 2), date '2030-01-14')) > 0,
        coalesce(left(v_obtenu, 40), 'nul'));
    end if;
  end loop;
  perform pg_temp.verifier('venues : nom de promo toujours renseigné',
    pg_temp.valeur(v_form, '1', 'select count(*)::text from venues_benevoles() where promo_nom is null') = '0');
  v_txt := pg_temp.valeur(v_stag1, null, 'select count(*)::text from venues_benevoles()');
  perform pg_temp.verifier('venues : rien pour un stagiaire', v_txt = '0', coalesce(v_txt, 'nul'));
  v_txt := pg_temp.valeur(null, null, 'select count(*)::text from venues_benevoles()');
  perform pg_temp.verifier('venues : rien pour le visiteur (0 ou 42501)',
    v_txt in ('0', 'ERREUR 42501'), coalesce(v_txt, 'nul'));

  -- Moyennes EPCF : celles de la promo courante, calculées en propriétaire pour chaque promo.
  v_sql := $q$select coalesce(string_agg(critere || ':' || moyenne || ':' || effectif, ',' order by critere), '') from epcf_moyennes('salle')$q$;
  foreach v_txt in array array['2', '1'] loop
    select coalesce(string_agg(critere || ':' || moyenne || ':' || effectif, ',' order by critere), '')
      into v_att_txt
      from (select k.key as critere,
                   round(avg(case k.value when 'A' then 2 when 'R' then 1 when 'NA' then 0 end)::numeric, 3) as moyenne,
                   count(*)::integer as effectif
              from (select distinct on (stagiaire_id) scores from epcf_evaluations
                     where trame = 'salle' and contexte = 'EPCF' and auto_eval = false and promo_id = v_txt::integer
                     order by stagiaire_id, date_eval desc, id desc) d,
                   jsonb_each_text(d.scores) k
             where k.value in ('A', 'R', 'NA')
             group by k.key) x;
    v_obtenu := pg_temp.valeur(v_form, v_txt, v_sql);
    perform pg_temp.verifier(format('moyennes EPCF depuis la promo %s : celles de cette promo seulement', v_txt),
      v_obtenu = v_att_txt and v_att_txt <> '',
      format('obtenu %s, attendu %s', coalesce(left(v_obtenu, 80), 'nul'), left(v_att_txt, 80)));
  end loop;

  -- Date de naissance (fiches fictives de mars et de septembre) : relue en propriétaire avant,
  -- puis après chaque appel, dans une sous-transaction annulée. Le refus porte le code P0001 de
  -- la fonction.
  for v_p in select * from (values
      ('refusée', v_form, '2', v_sid_mars, 'formateur, fiche de mars'),
      ('modifiable', v_form, '1', v_sid_mars, 'formateur, fiche de mars'),
      ('modifiable', v_fictif, '2', v_sid_fictif, 'stagiaire fictif, sa fiche'),
      ('refusée', v_fictif, '1', v_sid_fictif, 'stagiaire fictif, sa fiche')) as t(attente, email, entete, sid, qui) loop
    select coalesce(date_naissance::text, 'nulle') into v_att_txt from stagiaires where id = v_p.sid;
    begin
      perform pg_temp.incarner(v_p.email, v_p.entete);
      perform set_date_naissance(v_p.sid, date '1999-12-31');
      reset role;
      raise exception using errcode = 'P0001',
        message = 'ACCEPTÉ ' || coalesce((select date_naissance::text from stagiaires where id = v_p.sid), 'nulle');
    exception when others then
      v_obtenu := case when sqlerrm like 'ACCEPTÉ %' then sqlerrm else 'ERREUR ' || sqlstate end;
    end;
    perform pg_temp.verifier(format('date de naissance : %s depuis la promo %s (%s)', v_p.attente, v_p.entete, v_p.qui),
      case when v_p.attente = 'refusée' then v_obtenu = 'ERREUR P0001' else v_obtenu = 'ACCEPTÉ 1999-12-31' end
        and (select coalesce(date_naissance::text, 'nulle') from stagiaires where id = v_p.sid) = v_att_txt,
      format('avant %s, obtenu %s', v_att_txt, v_obtenu));
  end loop;

  -- G. Examens propres à chaque promo (QCM fictif A ; aucun examen réel n'est touché)
  update qcm_examens set published = true, exam_ferme_a = null where promo_id = 1 and qcm_id = v_qcm_a;
  perform pg_temp.verifier('examen ouvert en mars : démarrable pour mars',
    pg_temp.valeur(v_stag1, null, format('select qcm_exam_demarrable(%s)::text', v_qcm_a)) = 'true');
  perform pg_temp.verifier('examen ouvert en mars : fermé pour septembre',
    pg_temp.valeur(v_fictif, '2', format('select qcm_exam_demarrable(%s)::text', v_qcm_a)) = 'false');
  v_sql := 'insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) '
    || 'values (%s, %s, ''examen'', 1, 2, 10)';
  v_att_txt := 'select a.promo_id || '':'' || coalesce((select string_agg(e.promo_id::text, '','') from public.evaluations e '
    || 'where e.qcm_attempt_id = a.id), ''aucune'') from public.qcm_attempts a where a.qcm_id = %s and a.stagiaire_id = %s '
    || 'and a.mode = ''examen''';
  v_txt := pg_temp.ecrire(v_fictif, '2', format(v_sql, v_qcm_a, v_sid_fictif), format(v_att_txt, v_qcm_a, v_sid_fictif));
  perform pg_temp.verifier('septembre ne passe pas un examen ouvert seulement en mars (42501)', v_txt = 'REFUS 42501', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, format(v_sql, v_qcm_a, v_sid1), format(v_att_txt, v_qcm_a, v_sid1));
  perform pg_temp.verifier('mars passe l''examen ouvert en mars (tentative et note recopiée en mars)', v_txt = 'OK 1 1:1', v_txt);
  update qcm_examens set published = true, exam_ferme_a = null where promo_id = 2 and qcm_id = v_qcm_a;
  v_txt := pg_temp.ecrire(v_fictif, '2', format(v_sql, v_qcm_a, v_sid_fictif), format(v_att_txt, v_qcm_a, v_sid_fictif));
  perform pg_temp.verifier('septembre passe son examen une fois ouvert pour septembre (tentative et note en septembre)',
    v_txt = 'OK 1 2:2', v_txt);

  -- H. Matrice d'écriture : table x opération x personnage x contexte. Chaque table a son
  -- modèle de ligne valide. %1$s promo visée, %2$s stagiaire visé, %3$s lieu visé, %4$s
  -- bénévole visé, %5$s QCM fictif B, %6$s thème fictif B. « ligne » projette une ligne r
  -- existante en (promo, lieu, fiche stagiaire, ligne du personnel) pour la règle de la spec.
  drop table if exists pg_temp.modeles;
  create temp table modeles (ordre integer, t text, portee text, col_maj text, ins text, ins_defaut text,
    ups text, constat text, maj text, sup text, depl text, ligne text);
  insert into modeles values
  (1, 'stagiaires', 'promo', 'ordre',
   $q$insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('PreuveEcriture', 'PREUVE', 996, %1$s)$q$,
   $q$insert into public.stagiaires (prenom, nom, ordre) values ('PreuveEcriture', 'PREUVE', 996)$q$, null,
   $q$select promo_id::text from public.stagiaires where prenom = 'PreuveEcriture'$q$,
   $q$update public.stagiaires set ordre = 995$q$, $q$delete from public.stagiaires$q$,
   $q$update public.stagiaires set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (2, 'evaluations', 'stagiaire', 'observation',
   $q$insert into public.evaluations (stagiaire_id, type, theme_numero, note, observation) values (%2$s, 'Thème', 1, 10, 'PreuveEcriture')$q$,
   null, null,
   $q$select promo_id::text from public.evaluations where observation = 'PreuveEcriture'$q$,
   $q$update public.evaluations set observation = 'PreuveMaj'$q$, $q$delete from public.evaluations$q$,
   $q$update public.evaluations set stagiaire_id = %2$s$q$,
   $q$r.promo_id, null::integer, r.stagiaire_id, false$q$),
  (3, 'evaluations_audit', 'historique', 'changed_by_email',
   $q$insert into public.evaluations_audit (action, changed_by_email, promo_id) values ('insert', 'PreuveEcriture', %1$s)$q$,
   null, null,
   $q$select promo_id::text from public.evaluations_audit where changed_by_email = 'PreuveEcriture'$q$,
   $q$update public.evaluations_audit set changed_by_email = 'PreuveMaj'$q$, $q$delete from public.evaluations_audit$q$,
   null, $q$r.promo_id, null::integer, null::integer, false$q$),
  (4, 'passages', 'stagiaire', 'commentaire',
   $q$insert into public.passages (date, stagiaire_id, type, resultat, commentaire) values ('2031-01-06', %2$s, 'Salle', 'Effectué', 'PreuveEcriture')$q$,
   null, null,
   $q$select promo_id::text from public.passages where commentaire = 'PreuveEcriture'$q$,
   $q$update public.passages set commentaire = 'PreuveMaj'$q$, $q$delete from public.passages$q$,
   $q$update public.passages set stagiaire_id = %2$s$q$,
   $q$r.promo_id, null::integer, r.stagiaire_id, false$q$),
  (5, 'passages_audit', 'historique', 'changed_by_who',
   $q$insert into public.passages_audit (action, changed_by_who, promo_id) values ('insert', 'PreuveEcriture', %1$s)$q$,
   null, null,
   $q$select promo_id::text from public.passages_audit where changed_by_who = 'PreuveEcriture'$q$,
   $q$update public.passages_audit set changed_by_who = 'PreuveMaj'$q$, $q$delete from public.passages_audit$q$,
   null, $q$r.promo_id, null::integer, null::integer, false$q$),
  (6, 'planning_entries', 'promo', 'notes',
   $q$insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite, promo_id) values ('2031-01-06', 0, 'matin', 7, 7, 'Cours', %1$s)$q$,
   $q$insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite) values ('2031-01-06', 0, 'matin', 7, 7, 'Cours')$q$,
   null,
   $q$select promo_id::text from public.planning_entries where semaine_lundi = '2031-01-06' and slot = 7 and lane = 7$q$,
   $q$update public.planning_entries set notes = 'PreuveMaj'$q$, $q$delete from public.planning_entries$q$,
   $q$update public.planning_entries set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (7, 'planning_half_meta', 'promo', 'pause_minutes',
   $q$insert into public.planning_half_meta (semaine_lundi, day_index, half_day, start_time, end_time, promo_id) values ('2031-01-06', 1, 'aprem', '13:30', '17:00', %1$s)$q$,
   $q$insert into public.planning_half_meta (semaine_lundi, day_index, half_day, start_time, end_time) values ('2031-01-06', 1, 'aprem', '13:30', '17:00')$q$,
   null,
   $q$select promo_id::text from public.planning_half_meta where semaine_lundi = '2031-01-06' and day_index = 1 and half_day = 'aprem'$q$,
   $q$update public.planning_half_meta set pause_minutes = 21$q$, $q$delete from public.planning_half_meta$q$,
   $q$update public.planning_half_meta set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (8, 'planning_jours_off', 'promo', 'label',
   $q$insert into public.planning_jours_off (semaine_lundi, day_index, label, promo_id) values ('2031-01-06', 3, 'PreuveEcriture', %1$s)$q$,
   $q$insert into public.planning_jours_off (semaine_lundi, day_index, label) values ('2031-01-06', 3, 'PreuveEcriture')$q$,
   null,
   $q$select promo_id::text from public.planning_jours_off where label = 'PreuveEcriture'$q$,
   $q$update public.planning_jours_off set label = 'PreuveMaj'$q$, $q$delete from public.planning_jours_off$q$,
   $q$update public.planning_jours_off set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (9, 'agenda_events', 'promo', 'location',
   $q$insert into public.agenda_events (date_start, title, promo_id) values ('2031-01-06', 'PreuveEcriture', %1$s)$q$,
   $q$insert into public.agenda_events (date_start, title) values ('2031-01-06', 'PreuveEcriture')$q$,
   null,
   $q$select promo_id::text from public.agenda_events where title = 'PreuveEcriture'$q$,
   $q$update public.agenda_events set location = 'PreuveMaj'$q$, $q$delete from public.agenda_events$q$,
   $q$update public.agenda_events set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (10, 'settings', 'promo', 'value',
   $q$insert into public.settings (key, value, promo_id) values ('preuve_ecriture', 'x', %1$s)$q$,
   $q$insert into public.settings (key, value) values ('preuve_ecriture', 'x')$q$,
   null,
   $q$select coalesce(promo_id::text, 'nulle') from public.settings where key = 'preuve_ecriture'$q$,
   $q$update public.settings set value = 'PreuveMaj'$q$, $q$delete from public.settings$q$,
   $q$update public.settings set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (11, 'qcm_attempts', 'stagiaire', 'started_at',
   $q$insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (%5$s, %2$s, 'entrainement', 1, 4242, 10)$q$,
   null, null,
   $q$select promo_id::text from public.qcm_attempts where total = 4242$q$,
   $q$update public.qcm_attempts set started_at = '2031-01-06'$q$, $q$delete from public.qcm_attempts$q$,
   $q$update public.qcm_attempts set stagiaire_id = %2$s$q$,
   $q$r.promo_id, null::integer, r.stagiaire_id, false$q$),
  (12, 'epcf_evaluations', 'stagiaire', 'commentaire',
   $q$insert into public.epcf_evaluations (stagiaire_id, trame, commentaire) values (%2$s, 'salle', 'PreuveEcriture')$q$,
   null, null,
   $q$select promo_id::text from public.epcf_evaluations where commentaire = 'PreuveEcriture'$q$,
   $q$update public.epcf_evaluations set commentaire = 'PreuveMaj'$q$, $q$delete from public.epcf_evaluations$q$,
   $q$update public.epcf_evaluations set stagiaire_id = %2$s$q$,
   $q$r.promo_id, null::integer, r.stagiaire_id, false$q$),
  (13, 'epcf_livrets', 'stagiaire', 'updated_by_who',
   $q$insert into public.epcf_livrets (stagiaire_id, updated_by_who) values (%2$s, 'PreuveEcriture')$q$,
   null, null,
   $q$select promo_id::text from public.epcf_livrets where updated_by_who = 'PreuveEcriture'$q$,
   $q$update public.epcf_livrets set updated_by_who = 'PreuveMaj'$q$, $q$delete from public.epcf_livrets$q$,
   $q$update public.epcf_livrets set stagiaire_id = %2$s$q$,
   $q$r.promo_id, null::integer, r.stagiaire_id, false$q$),
  (14, 'dp_dossiers', 'stagiaire', 'updated_by_who',
   $q$insert into public.dp_dossiers (stagiaire_id, updated_by_who) values (%2$s, 'PreuveEcriture')$q$,
   null,
   $q$insert into public.dp_dossiers (stagiaire_id, updated_by_who) values (%2$s, 'PreuveEcriture') on conflict (stagiaire_id) do update set updated_by_who = excluded.updated_by_who$q$,
   $q$select promo_id::text from public.dp_dossiers where updated_by_who = 'PreuveEcriture'$q$,
   $q$update public.dp_dossiers set updated_by_who = 'PreuveMaj'$q$, $q$delete from public.dp_dossiers$q$,
   $q$update public.dp_dossiers set stagiaire_id = %2$s$q$,
   $q$r.promo_id, null::integer, r.stagiaire_id, false$q$),
  (15, 'fiches_suivi', 'stagiaire', 'updated_by_who',
   $q$insert into public.fiches_suivi (stagiaire_id, besoins) values (%2$s, 'PreuveEcriture')$q$,
   null,
   $q$insert into public.fiches_suivi (stagiaire_id, besoins) values (%2$s, 'PreuveEcriture') on conflict (stagiaire_id) do update set besoins = excluded.besoins$q$,
   $q$select promo_id::text from public.fiches_suivi where besoins = 'PreuveEcriture'$q$,
   $q$update public.fiches_suivi set updated_by_who = 'PreuveMaj'$q$, $q$delete from public.fiches_suivi$q$,
   $q$update public.fiches_suivi set stagiaire_id = %2$s$q$,
   $q$r.promo_id, null::integer, r.stagiaire_id::integer, false$q$),
  (16, 'themes_progression', 'promo', 'notes',
   $q$insert into public.themes_progression (promo_id, theme_id, statut, notes) values (%1$s, %6$s, 'En cours', 'PreuveEcriture')$q$,
   $q$insert into public.themes_progression (theme_id, statut, notes) values (%6$s, 'En cours', 'PreuveEcriture')$q$,
   null,
   $q$select promo_id::text from public.themes_progression where notes = 'PreuveEcriture'$q$,
   $q$update public.themes_progression set notes = 'PreuveMaj'$q$, $q$delete from public.themes_progression$q$,
   $q$update public.themes_progression set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (17, 'qcm_examens', 'promo', 'published_by_email',
   $q$insert into public.qcm_examens (promo_id, qcm_id, published_by_email) values (%1$s, %5$s, 'preuve.ecriture@example.invalid')$q$,
   $q$insert into public.qcm_examens (qcm_id, published_by_email) values (%5$s, 'preuve.ecriture@example.invalid')$q$,
   null,
   $q$select promo_id::text from public.qcm_examens where published_by_email = 'preuve.ecriture@example.invalid'$q$,
   $q$update public.qcm_examens set published_by_email = 'preuve.maj@example.invalid'$q$, $q$delete from public.qcm_examens$q$,
   $q$update public.qcm_examens set promo_id = %1$s$q$,
   $q$r.promo_id, null::integer, null::integer, false$q$),
  (18, 'benevoles', 'lieu', 'notes',
   $q$insert into public.benevoles (prenom, lieu_id) values ('PreuveEcriture', %3$s)$q$,
   $q$insert into public.benevoles (prenom) values ('PreuveEcriture')$q$,
   null,
   $q$select lieu_id::text from public.benevoles where prenom = 'PreuveEcriture'$q$,
   $q$update public.benevoles set notes = 'PreuveMaj'$q$, $q$delete from public.benevoles$q$,
   $q$update public.benevoles set lieu_id = %3$s, auto_ecole_id = null$q$,
   $q$null::integer, r.lieu_id, null::integer, false$q$),
  (19, 'auto_ecoles', 'lieu', 'notes',
   $q$insert into public.auto_ecoles (nom, lieu_id) values ('PreuveEcriture', %3$s)$q$,
   $q$insert into public.auto_ecoles (nom) values ('PreuveEcriture')$q$,
   null,
   $q$select lieu_id::text from public.auto_ecoles where nom = 'PreuveEcriture'$q$,
   $q$update public.auto_ecoles set notes = 'PreuveMaj'$q$, $q$delete from public.auto_ecoles$q$,
   $q$update public.auto_ecoles set lieu_id = %3$s$q$,
   $q$null::integer, r.lieu_id, null::integer, false$q$),
  (20, 'benevole_suivi', 'benevole', 'commentaire',
   $q$insert into public.benevole_suivi (benevole_id, semaine_lundi, day_index, half_day, commentaire) values (%4$s, '2031-01-06', 2, 'aprem', 'PreuveEcriture')$q$,
   null, null,
   $q$select lieu_id::text from public.benevole_suivi where commentaire = 'PreuveEcriture'$q$,
   $q$update public.benevole_suivi set commentaire = 'PreuveMaj'$q$, $q$delete from public.benevole_suivi$q$,
   $q$update public.benevole_suivi set benevole_id = %4$s$q$,
   $q$null::integer, r.lieu_id, null::integer, false$q$),
  (21, 'user_profiles', 'comptes', 'invited_by_email',
   $q$insert into public.user_profiles (email, role, stagiaire_id) values ('preuve.ecriture@example.invalid', 'stagiaire', %2$s)$q$,
   null, null,
   $q$select coalesce((select s.promo_id::text from public.stagiaires s where s.id = up.stagiaire_id), 'personnel') from public.user_profiles up where up.email = 'preuve.ecriture@example.invalid'$q$,
   $q$update public.user_profiles set invited_by_email = 'preuve.maj@example.invalid'$q$, $q$delete from public.user_profiles$q$,
   $q$update public.user_profiles set stagiaire_id = %2$s$q$,
   $q$(select s.promo_id from public.stagiaires s where s.id = r.stagiaire_id), null::integer, r.stagiaire_id, r.stagiaire_id is null$q$),
  (22, 'lieux', 'lieux', 'nom',
   $q$insert into public.lieux (id, nom) values (9997, 'PreuveEcriture')$q$,
   null, null,
   $q$select id::text from public.lieux where id = 9997$q$,
   $q$update public.lieux set nom = 'PreuveMaj'$q$, $q$delete from public.lieux$q$,
   null, $q$null::integer, r.id, null::integer, false$q$);
  -- Ligne de test de chaque table, dans la portée de septembre (banque de Nîmes pour les tables
  -- de lieu, lieu vide de test pour lieux) : cible des jumeaux de la modification et de la
  -- suppression, positifs là où le personnel a le droit d'écrire. %2$s stagiaire fictif de
  -- septembre, %4$s bénévole témoin de Nîmes, %5$s QCM A, %6$s thème A.
  alter table modeles add column cible text;
  update modeles m set cible = c.cible
    from (values
      ('stagiaires', $q$prenom = 'PreuveFictifDeux'$q$), ('evaluations', $q$stagiaire_id = %2$s$q$),
      ('evaluations_audit', $q$promo_id = 2$q$), ('passages', $q$stagiaire_id = %2$s$q$),
      ('passages_audit', $q$promo_id = 2$q$),
      ('planning_entries', $q$promo_id = 2 and semaine_lundi = '2030-01-07'$q$),
      ('planning_half_meta', $q$promo_id = 2 and semaine_lundi = '2030-01-07'$q$),
      ('planning_jours_off', $q$promo_id = 2 and label = 'Preuve'$q$),
      ('agenda_events', $q$promo_id = 2 and title = 'Preuve'$q$),
      ('settings', $q$promo_id = 2 and key = 'preuve_cle'$q$), ('qcm_attempts', $q$stagiaire_id = %2$s$q$),
      ('epcf_evaluations', $q$stagiaire_id = %2$s$q$), ('epcf_livrets', $q$stagiaire_id = %2$s$q$),
      ('dp_dossiers', $q$stagiaire_id = %2$s$q$), ('fiches_suivi', $q$stagiaire_id = %2$s$q$),
      ('themes_progression', $q$promo_id = 2 and theme_id = %6$s$q$),
      ('qcm_examens', $q$promo_id = 2 and qcm_id = %5$s$q$),
      ('benevoles', $q$prenom = 'PreuveBenevoleNimes'$q$), ('auto_ecoles', $q$nom = 'Preuve AE Nîmes'$q$),
      ('benevole_suivi', $q$benevole_id = %4$s$q$),
      ('user_profiles', $q$email = 'preuve.fictif@example.invalid'$q$), ('lieux', $q$id = 9999$q$)) as c(t, cible)
   where m.t = c.t;

  -- Contextes d'écriture : promo courante attendue (spec B.2) ; balayage (modification et
  -- suppression sur toute la table) là où la portée légitime est vide, ou réduite aux lignes du
  -- stagiaire lui-même et aux comptes du personnel ; déplacement (changer la promo ou le lieu
  -- d'une ligne) depuis septembre et Montpellier.
  drop table if exists pg_temp.contextes;
  create temp table contextes (ordre serial, nom text, email text, entete text, promo integer,
    balayage boolean, deplacement boolean);
  insert into contextes (nom, email, entete, promo, balayage, deplacement) values
    ('formateur', v_form, null, v_defaut_form, false, false), ('formateur', v_form, '1', 1, false, false),
    ('formateur', v_form, '2', 2, false, true), ('formateur', v_form, v_mtp::text, v_mtp, false, true),
    ('formateur', v_form, v_vide::text, v_vide, true, false), ('formateur', v_form, 'abc', null, true, false),
    ('formateur', v_form, '99', null, true, false),
    ('fondateur', v_fond, null, v_defaut_fond, false, false), ('fondateur', v_fond, '1', 1, false, false),
    ('fondateur', v_fond, '2', 2, false, true), ('fondateur', v_fond, v_mtp::text, v_mtp, false, true),
    ('fondateur', v_fond, v_vide::text, v_vide, true, false), ('fondateur', v_fond, 'abc', null, true, false),
    ('stagiaire de mars', v_stag1, null, 1, true, false), ('stagiaire de mars', v_stag1, '1', 1, false, false),
    ('stagiaire de mars', v_stag1, '2', null, true, false), ('stagiaire de mars', v_stag1, 'abc', null, true, false),
    ('stagiaire fictif de septembre', v_fictif, null, 2, true, false),
    ('stagiaire fictif de septembre', v_fictif, '2', 2, false, false),
    ('stagiaire fictif de septembre', v_fictif, '1', null, true, false),
    ('stagiaire fictif de septembre', v_fictif, 'abc', null, true, false),
    ('visiteur', null, null, null, true, false), ('visiteur', null, '1', null, true, false);
  if v_stag2 is not null then
    insert into contextes (nom, email, entete, promo, balayage, deplacement) values
      ('vrai stagiaire de septembre', v_stag2, null, 2, true, false),
      ('vrai stagiaire de septembre', v_stag2, '2', 2, false, false),
      ('vrai stagiaire de septembre', v_stag2, '1', null, true, false);
  end if;
  -- Jumeaux de la modification et de la suppression : depuis septembre, par le personnel.
  alter table contextes add column jumeau boolean not null default false;
  update contextes set jumeau = true where entete = '2' and nom in ('formateur', 'fondateur');

  for v_c in select * from contextes order by ordre loop
    v_role := case when v_c.email is null then 'anon' else 'authenticated' end;
    v_admin := false; v_prof := false; v_staff := false; v_soi := null; v_soi_promo := null;
    if v_c.email is not null then
      select coalesce(up.is_admin, false), coalesce(up.role = 'prof', false),
             coalesce(up.is_founder or up.role in ('prof', 'admin'), false), up.stagiaire_id, s.promo_id
        into v_admin, v_prof, v_staff, v_soi, v_soi_promo
        from user_profiles up left join stagiaires s on s.id = up.stagiaire_id
       where lower(up.email) = lower(v_c.email);
    end if;
    v_ctx := v_c.promo;
    v_ctx_lieu := (select pr.lieu_id from promos pr where pr.id = v_ctx);
    v_hors_promo := case when v_ctx = 1 then 2 else 1 end;
    v_hors_lieu := case when v_ctx_lieu = 1 then 2 else 1 end;
    v_contexte := format('%s [%s]', v_c.nom, coalesce(v_c.entete, 'sans en-tête'));

    for v_m in select * from modeles order by ordre loop
      -- 1. Ajouts : dans la portée du contexte (jumeau positif quand le personnage en a le
      --    droit), puis hors portée (autre promo, autre lieu, ou stagiaire d'une autre promo).
      foreach v_sens in array array['dans la portée', 'hors portée'] loop
        v_sql := null; r_promo := null; r_lieu := null; r_fiche := null; v_cible_sid := null; v_cible_bnv := null;
        case v_m.portee
          when 'promo' then
            if v_sens = 'dans la portée' then
              v_sql := format(v_m.ins_defaut, null, null, null, null, v_qcm_b, v_theme_b); r_promo := v_ctx;
            else
              v_sql := format(v_m.ins, v_hors_promo, null, null, null, v_qcm_b, v_theme_b); r_promo := v_hors_promo;
            end if;
          when 'stagiaire', 'comptes' then
            if v_sens = 'dans la portée' then
              v_cible_sid := case when not v_staff and v_soi is not null then v_soi
                                  when v_ctx = 1 then v_sid_mars when v_ctx = 2 then v_sid_fictif2 end;
            else
              v_cible_sid := case when v_soi is not null and v_ctx is not null and v_soi_promo is distinct from v_ctx
                                    then v_soi
                                  when v_hors_promo = 1 then v_sid_mars else v_sid_fictif2 end;
            end if;
            if v_cible_sid is not null then
              r_fiche := v_cible_sid;
              r_promo := (select s.promo_id from stagiaires s where s.id = v_cible_sid);
              v_sql := format(v_m.ins, null, v_cible_sid, null, null, v_qcm_b, v_theme_b);
            end if;
          when 'lieu' then
            if v_sens = 'dans la portée' then
              v_sql := v_m.ins_defaut; r_lieu := v_ctx_lieu;
            else
              v_sql := format(v_m.ins, null, null, v_hors_lieu); r_lieu := v_hors_lieu;
            end if;
          when 'benevole' then
            v_cible_bnv := case when v_sens = 'dans la portée'
                                  then case v_ctx_lieu when 1 then v_bnv_nimes when 2 then v_bnv_mtp end
                                else case v_hors_lieu when 1 then v_bnv_nimes else v_bnv_mtp end end;
            if v_cible_bnv is not null then
              r_lieu := (select b.lieu_id from benevoles b where b.id = v_cible_bnv);
              v_sql := format(v_m.ins, null, null, null, v_cible_bnv);
            end if;
          when 'historique' then
            r_promo := case when v_sens = 'dans la portée' then coalesce(v_ctx, 1) else v_hors_promo end;
            v_sql := format(v_m.ins, r_promo);
          when 'lieux' then
            if v_sens = 'hors portée' then v_sql := v_m.ins; end if;
          else null;
        end case;
        continue when v_sql is null;
        v_priv := has_table_privilege(v_role, 'public.' || v_m.t, 'insert');
        v_permis := v_priv and pg_temp.permis(v_m.t, 'ajout', v_admin, v_prof, v_soi, v_ctx, v_ctx_lieu,
                                              r_promo, r_lieu, r_fiche, false, true);
        v_permis_sans := v_priv and pg_temp.permis(v_m.t, 'ajout', v_admin, v_prof, v_soi, v_ctx, v_ctx_lieu,
                                                   r_promo, r_lieu, r_fiche, false, false);
        -- Fiche ou dossier déjà là : l'app passe par un upsert. Seulement quand l'écriture est
        -- permise : un refus se tente toujours en insertion simple.
        if v_permis and v_m.ups is not null then
          execute format('select exists (select 1 from public.%I where stagiaire_id = $1)', v_m.t)
            into v_existe using r_fiche;
          if v_existe then v_sql := format(v_m.ups, null, r_fiche); end if;
        end if;
        v_attendu := case when v_permis then 'OK 1 ' || coalesce(r_promo, r_lieu)::text else 'REFUS 42501' end;
        v_obtenu := pg_temp.ecrire(v_c.email, v_c.entete, v_sql, v_m.constat);
        perform pg_temp.verifier_g('écriture', v_m.t, 'ajout ' || v_sens, v_contexte, v_obtenu = v_attendu,
          format('obtenu %s, attendu %s', v_obtenu, v_attendu),
          case when v_permis_sans and not v_permis then 1 else 0 end);
      end loop;

      -- 2. Modification et suppression sur toute la table, sans citer de colonne : seules les
      --    lignes de la portée doivent être touchées (nombre calculé en propriétaire).
      if v_c.balayage then
        foreach v_op in array array['modification', 'suppression'] loop
          v_sql := case v_op when 'modification' then v_m.maj else v_m.sup end;
          v_priv := case v_op when 'modification'
                      then has_column_privilege(v_role, 'public.' || v_m.t, v_m.col_maj, 'update')
                      else has_table_privilege(v_role, 'public.' || v_m.t, 'delete') end;
          if v_priv then
            execute format('select count(*) filter (where pg_temp.permis(%1$L, %2$L, $1, $2, $3, $4, $5, %3$s, true)), '
                || 'count(*) filter (where pg_temp.permis(%1$L, %2$L, $1, $2, $3, $4, $5, %3$s, false)) '
                || 'from public.%4$I r', v_m.t, v_op, v_m.ligne, v_m.t)
              into v_n, v_n2 using v_admin, v_prof, v_soi, v_ctx, v_ctx_lieu;
            v_attendu := 'OK ' || v_n;
          else
            v_n := 0; v_n2 := 0; v_attendu := 'REFUS 42501';
          end if;
          v_obtenu := pg_temp.ecrire(v_c.email, v_c.entete, v_sql);
          perform pg_temp.verifier_g('écriture', v_m.t, v_op || ' sur toute la table', v_contexte,
            v_obtenu = v_attendu,
            format('obtenu %s, attendu %s (une règle sans condition toucherait %s ligne(s) de plus)',
                   v_obtenu, v_attendu, v_n2 - v_n),
            (v_n2 - v_n)::integer);
        end loop;
      end if;

      -- 3. Déplacement : passer les lignes de la portée dans une autre promo (ou un autre lieu),
      --    sans citer de colonne. La nouvelle ligne doit être refusée.
      if v_c.deplacement and v_m.depl is not null
         and ((v_m.portee in ('promo', 'stagiaire', 'comptes') and v_ctx = 2)
              or (v_m.portee in ('lieu', 'benevole') and v_ctx = v_mtp)) then
        execute format('select count(*) from public.%I r where pg_temp.permis(%L, ''modification'', $1, $2, $3, $4, $5, %s, true)',
                       v_m.t, v_m.t, v_m.ligne)
          into v_n using v_admin, v_prof, v_soi, v_ctx, v_ctx_lieu;
        r_promo := null; r_lieu := null; r_fiche := null;
        case v_m.portee
          when 'promo' then
            r_promo := v_hors_promo; v_sql := format(v_m.depl, v_hors_promo);
          when 'stagiaire', 'comptes' then
            r_fiche := case when v_hors_promo = 1 then v_sid_mars else v_sid_fictif2 end;
            r_promo := (select s.promo_id from stagiaires s where s.id = r_fiche);
            v_sql := format(v_m.depl, null, r_fiche);
          when 'lieu' then
            r_lieu := v_hors_lieu; v_sql := format(v_m.depl, null, null, v_hors_lieu);
          else
            v_cible_bnv := case v_hors_lieu when 1 then v_bnv_nimes else v_bnv_mtp end;
            r_lieu := (select b.lieu_id from benevoles b where b.id = v_cible_bnv);
            v_sql := format(v_m.depl, null, null, null, v_cible_bnv);
        end case;
        v_permis := pg_temp.permis(v_m.t, 'modification', v_admin, v_prof, v_soi, v_ctx, v_ctx_lieu,
                                   r_promo, r_lieu, r_fiche, false, true);
        v_permis_sans := pg_temp.permis(v_m.t, 'modification', v_admin, v_prof, v_soi, v_ctx, v_ctx_lieu,
                                        r_promo, r_lieu, r_fiche, false, false);
        v_attendu := case when v_n = 0 or v_permis then 'OK ' || v_n else 'REFUS 42501' end;
        v_obtenu := pg_temp.ecrire(v_c.email, v_c.entete, v_sql);
        perform pg_temp.verifier_g('écriture', v_m.t, 'déplacement hors portée', v_contexte,
          v_obtenu = v_attendu,
          format('obtenu %s, attendu %s (%s ligne(s) de la portée, cible %s)', v_obtenu, v_attendu, v_n,
                 coalesce(r_promo, r_lieu)),
          case when v_n > 0 and v_permis_sans and not v_permis then 1 else 0 end);
      end if;

      -- 4. Jumeaux positifs : la ligne de test de la portée reste modifiable et supprimable par
      --    qui en a le droit (nombre calculé en propriétaire ; la ligne doit exister). Elle est
      --    ciblée par ses colonnes : la règle de lecture s'applique aussi, ce qui est voulu ici.
      if v_c.jumeau and v_m.cible is not null then
        v_txt := format(v_m.cible, null, v_sid_fictif, null, v_bnv_nimes, v_qcm_a, v_theme_a);
        foreach v_op in array array['modification', 'suppression'] loop
          v_sql := case v_op when 'modification' then v_m.maj else v_m.sup end || ' where ' || v_txt;
          v_priv := case v_op when 'modification'
                      then has_column_privilege(v_role, 'public.' || v_m.t, v_m.col_maj, 'update')
                      else has_table_privilege(v_role, 'public.' || v_m.t, 'delete') end;
          execute format('select count(*) filter (where pg_temp.permis(%1$L, %2$L, $1, $2, $3, $4, $5, %3$s, true)), '
              || 'count(*) from public.%4$I r where %5$s', v_m.t, v_op, v_m.ligne, v_m.t, v_txt)
            into v_n, v_n2 using v_admin, v_prof, v_soi, v_ctx, v_ctx_lieu;
          v_attendu := case when v_priv then 'OK ' || v_n else 'REFUS 42501' end;
          v_obtenu := pg_temp.ecrire(v_c.email, v_c.entete, v_sql);
          perform pg_temp.verifier_g('écriture', v_m.t, v_op || ' de la ligne de test de la portée', v_contexte,
            v_obtenu = v_attendu and v_n2 > 0,
            format('obtenu %s, attendu %s (%s ligne(s) de test)', v_obtenu, v_attendu, v_n2));
        end loop;
      end if;
    end loop;
  end loop;

  -- Couverture : pour chaque table et chaque opération, au moins un contrôle qu'une règle
  -- privée de sa condition de promo (ou de lieu) ferait échouer.
  for v_m in select * from modeles where portee not in ('historique', 'lieux') order by ordre loop
    foreach v_op in array array['ajout hors portée', 'modification sur toute la table',
                                'suppression sur toute la table', 'déplacement hors portée'] loop
      continue when v_op = 'déplacement hors portée' and v_m.depl is null;
      select count(*) into v_n from preuve
       where groupe = 'écriture' and tbl = v_m.t and controle = v_op and temoin > 0;
      perform pg_temp.verifier_g('couverture', v_m.t, v_op, 'couverture', v_n > 0,
        format('%s contrôle(s) qu''une règle sans condition de %s ferait échouer', v_n,
               case when v_m.portee in ('lieu', 'benevole') then 'lieu' else 'promo' end));
    end loop;
  end loop;

  -- I. Cas particuliers d'écriture (hors matrice)
  -- Clé « modules » du chantier B : un formateur la règle pour la promo affichée, un stagiaire
  -- jamais. Avant la bascule, la clé primaire porte encore sur « key » : si mars a déjà sa clé
  -- « modules », l'écriture pour septembre attend la bascule (Tâche 16).
  if exists (select 1 from settings where key = 'modules' and promo_id = 1)
     and exists (select 1 from pg_constraint where conrelid = 'public.settings'::regclass
                  and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (key)') then
    perform pg_temp.reporter('hors matrice', 'modules (chantier B) : un formateur règle la promo affichée',
      'clé primaire encore sur key et mars a déjà sa clé : à rejouer après la bascule (Tâche 16)');
  else
    v_att_txt := coalesce((select '1=' || value || ',' from settings where key = 'modules' and promo_id = 1), '') || '2={}';
    v_txt := pg_temp.ecrire(v_form, '2',
      $q$insert into public.settings (key, value) values ('modules', '{}') on conflict (promo_id, key) do update set value = excluded.value$q$,
      $q$select string_agg(coalesce(promo_id::text, 'nulle') || '=' || value, ',' order by promo_id) from public.settings where key = 'modules'$q$);
    perform pg_temp.verifier('modules (chantier B) : un formateur règle la promo affichée, mars intacte',
      v_txt = 'OK 1 ' || v_att_txt, v_txt);
  end if;
  v_txt := pg_temp.ecrire(v_fictif, '2',
    $q$insert into public.settings (key, value) values ('modules', '{}') on conflict (promo_id, key) do update set value = excluded.value$q$);
  perform pg_temp.verifier('modules (chantier B) : un stagiaire ne règle rien (42501)', v_txt = 'REFUS 42501', v_txt);
  -- Réglage global : plus aucune écriture depuis l'app. Tant que la clé primaire est sur
  -- « key », l'upsert d'une ancienne version vise la ligne globale : refus attendu.
  select value into v_global from settings where promo_id is null and key = 'chatbot_quota_jour';
  if v_global is null then
    perform pg_temp.reporter('hors matrice', 'réglage global : non écrit depuis l''app', 'aucun réglage global chatbot_quota_jour');
  elsif exists (select 1 from pg_constraint where conrelid = 'public.settings'::regclass
                 and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (key)') then
    v_txt := pg_temp.ecrire(v_form, null,
      $q$insert into public.settings (key, value) values ('chatbot_quota_jour', 'PreuveMaj') on conflict (key) do update set value = excluded.value$q$);
    perform pg_temp.verifier('réglage global : l''upsert d''une ancienne version est refusé (42501)', v_txt = 'REFUS 42501', v_txt);
  else
    v_txt := pg_temp.ecrire(v_form, null,
      $q$insert into public.settings (key, value) values ('chatbot_quota_jour', 'PreuveMaj') on conflict (promo_id, key) do update set value = excluded.value$q$,
      $q$select value from public.settings where promo_id is null and key = 'chatbot_quota_jour'$q$);
    perform pg_temp.verifier('réglage global : intact après un upsert de la nouvelle version', v_txt = 'OK 1 ' || v_global, v_txt);
  end if;
  -- Affiliation d'un bénévole : contrôle du lieu par trigger (23514)
  v_txt := pg_temp.ecrire(v_form, v_mtp::text,
    format($q$insert into public.benevoles (prenom, auto_ecole_id) values ('PreuveEcriture', %s)$q$, v_ae_nimes),
    $q$select lieu_id::text from public.benevoles where prenom = 'PreuveEcriture'$q$);
  perform pg_temp.verifier('pas d''affiliation à une auto-école d''un autre lieu (23514)', v_txt = 'REFUS 23514', v_txt);
  -- Promos : seul le nom se modifie, par un admin ; ni création ni suppression depuis l'app.
  v_txt := pg_temp.ecrire(v_form, '2', $q$update public.promos set nom = 'Preuve, renommée' where id = 2$q$,
    $q$select nom from public.promos where id = 2$q$);
  perform pg_temp.verifier('formateur : renomme la promo', v_txt = 'OK 1 Preuve, renommée', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', $q$update public.promos set date_fin = date '2031-01-01' where id = 2$q$);
  perform pg_temp.verifier('formateur : ne touche que le nom de la promo (42501)', v_txt = 'REFUS 42501', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2',
    $q$insert into public.promos (id, lieu_id, nom, date_debut) values (9997, 1, 'PreuveEcriture', current_date)$q$,
    $q$select id::text from public.promos where id = 9997$q$);
  perform pg_temp.verifier('aucune promo créée depuis l''app (42501)', v_txt = 'REFUS 42501', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('delete from public.promos where id = %s', v_vide));
  perform pg_temp.verifier('aucune promo supprimée depuis l''app (42501)', v_txt = 'REFUS 42501', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, $q$update public.promos set nom = 'PreuveMaj'$q$);
  perform pg_temp.verifier('stagiaire : ne renomme aucune promo', v_txt = 'OK 0', v_txt);
  v_txt := pg_temp.ecrire(null, null, $q$update public.promos set nom = 'PreuveMaj'$q$);
  perform pg_temp.verifier('visiteur : ne renomme aucune promo (42501)', v_txt = 'REFUS 42501', v_txt);
  -- Comptes : élévation de droits refusée à un stagiaire (sa propre ligne comprise), compte
  -- du personnel créé par un formateur depuis septembre.
  foreach v_op in array array['is_admin = true', 'role = ''prof''', 'is_founder = true'] loop
    v_txt := pg_temp.ecrire(v_stag1, null, 'update public.user_profiles set ' || v_op,
      format($q$select is_admin || ',' || role || ',' || is_founder from public.user_profiles where lower(email) = lower(%L)$q$, v_stag1));
    perform pg_temp.verifier(format('stagiaire de mars : pas d''élévation de droits (%s, sur toute la table)', v_op),
      v_txt = 'OK 0 false,stagiaire,false', v_txt);
  end loop;
  v_txt := pg_temp.ecrire(v_stag1, null,
    format('update public.user_profiles set is_admin = true where lower(email) = lower(%L)', v_stag1),
    format($q$select is_admin::text from public.user_profiles where lower(email) = lower(%L)$q$, v_stag1));
  perform pg_temp.verifier('stagiaire de mars : ne se rend pas admin (sa propre ligne)', v_txt = 'OK 0 false', v_txt);
  v_txt := pg_temp.ecrire(v_fictif, '2', 'update public.user_profiles set is_admin = true',
    format($q$select is_admin::text from public.user_profiles where lower(email) = lower(%L)$q$, v_fictif));
  perform pg_temp.verifier('stagiaire fictif : ne se rend pas admin', v_txt = 'OK 0 false', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2',
    $q$insert into public.user_profiles (email, role) values ('preuve.personnel@example.invalid', 'prof')$q$,
    $q$select coalesce(stagiaire_id::text, 'personnel') from public.user_profiles where email = 'preuve.personnel@example.invalid'$q$);
  perform pg_temp.verifier('formateur en septembre : crée un compte du personnel', v_txt = 'OK 1 personnel', v_txt);

  -- J. Verdict (annule tout)
  select last_value || ',' || is_called into v_txt from public.lieux_id_seq;
  select last_value || ',' || is_called into v_att_txt from public.promos_id_seq;
  perform pg_temp.verifier('identités de lieux et promos non consommées',
    v_txt = v_seq_lieux and v_att_txt = v_seq_promos,
    format('lieux_id_seq %s puis %s, promos_id_seq %s puis %s', v_seq_lieux, v_txt, v_seq_promos, v_att_txt));

  select count(*), count(*) filter (where etat = 'ok'), count(*) filter (where etat = 'échec'),
         count(*) filter (where etat = 'reporté')
    into v_total, v_ok, v_ko, v_rep from preuve;
  select string_agg(format('%s %s/%s%s', groupe, ko, n, case when rep > 0 then format(' (%s reporté(s))', rep) else '' end),
                    ' ; ' order by premier)
    into v_groupes
    from (select groupe, count(*) as n, count(*) filter (where etat = 'échec') as ko,
                 count(*) filter (where etat = 'reporté') as rep, min(num) as premier
            from preuve group by groupe) g;
  -- Échecs hors matrices, hors matrice d'abord, dans l'ordre d'exécution. Le verdict reste court
  -- (l'outil qui le rend tronque les messages longs) : 40 lignes, puis 50 familles au plus.
  select count(*) into v_n from preuve where etat = 'échec' and groupe not in ('lecture', 'écriture');
  select string_agg('- ' || libelle || coalesce(' : ' || left(nullif(detail, ''), 110), ''), E'\n' order by rang, num)
    into v_liste
    from (select num, libelle, detail,
                 case groupe when 'hors matrice' then 1 when 'couverture' then 2 else 3 end as rang
            from preuve where etat = 'échec' and groupe not in ('lecture', 'écriture')
           order by rang, num limit 40) x;
  -- Échecs des matrices, regroupés par table et contrôle (écriture d'abord), un exemple chacun
  select count(*) into v_n2
    from (select 1 from preuve where etat = 'échec' and groupe in ('lecture', 'écriture')
           group by groupe, tbl, controle) f;
  select string_agg(ligne, E'\n' order by rang, premier) into v_familles
    from (select format('- %s %s, %s : %s/%s ; ex. %s', groupe, tbl, controle, ko, n, left(exemple, 110)) as ligne,
                 case groupe when 'écriture' then 1 else 2 end as rang, premier
            from (select groupe, tbl, controle, count(*) as n, count(*) filter (where etat = 'échec') as ko,
                         min(num) as premier,
                         (array_agg(contexte || ' : ' || detail order by num) filter (where etat = 'échec'))[1] as exemple
                    from preuve where groupe in ('lecture', 'écriture') group by groupe, tbl, controle) f
           where ko > 0 order by rang, premier limit 50) y;
  select string_agg('- ' || libelle || ' : ' || detail, E'\n' order by num) into v_reportes
    from preuve where etat = 'reporté';
  v_message := format(E'VERDICT %s\n%s contrôles : %s réussis, %s échec(s), %s reporté(s) ; %s ms depuis le début du lot\n'
                      || E'état : photo %s ; vrai stagiaire de septembre : %s\n'
                      || 'échecs par groupe (échecs/contrôles) : %s',
    case when v_ko = 0 then 'VERT' else 'ROUGE' end, v_total, v_ok, v_ko, v_rep,
    round(extract(epoch from clock_timestamp() - now()) * 1000),
    case when v_photo then 'présente' else 'absente' end,
    case when v_stag2 is not null then 'présent' else 'absent' end, v_groupes);
  if v_n > 0 then
    v_message := v_message || format(E'\néchecs hors matrices (%s premiers sur %s) :\n%s', least(v_n, 40), v_n, v_liste);
  end if;
  if v_n2 > 0 then
    v_message := v_message || format(E'\néchecs des matrices par table et contrôle (%s premières familles sur %s) :\n%s',
      least(v_n2, 50), v_n2, v_familles);
  end if;
  if v_rep > 0 then
    v_message := v_message || E'\nreportés (jamais comptés comme réussis) :\n' || v_reportes;
  end if;
  raise exception '%', v_message;
end $preuve$;
